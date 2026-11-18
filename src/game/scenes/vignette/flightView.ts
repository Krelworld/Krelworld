import Phaser from "phaser";
import * as Juice from "../../gfx/Juice";

/**
 * What KR-069's pilot sees out of the windscreen: a pseudo-3D view in the style of the intro flyover. One perspective
 * camera (no yaw: steering slides you sideways and banks you, up/down pitches the nose and trades height for speed)
 * projects everything:
 *  - the sky (drawn once, a gradient with distant hills sat on the horizon) rolls and pitches as one piece;
 *  - the ground is a single Mesh whose vertices are re-projected each frame, with world-space UVs into a repeating
 *    (power-of-two, mipmapped) countryside texture, so the fields stream towards you at the right speed;
 *  - the railway is a ribbon Mesh laid along a gently curving line, and the Kreddle Express is a quad stood up on it;
 *  - clouds are billboards at real positions (some at your height: fly through those and the screen whites out);
 *  - the sun, its glare, and speed streaks when you dive.
 * Everything is made once; per frame only vertices, positions and alphas change. destroy() removes it all, textures
 * included.
 */

export interface FlightViewOpts {
  /** Screen point the nose points at (the centre of the windscreen). */
  cx: number;
  cy: number;
  /** Base depth: the view occupies [depth, depth + 1). */
  depth: number;
}

export interface FlightFrame {
  /** Steering, -1..1 (left..right). */
  ax: number;
  /** Pitch, -1..1 (climb..dive). */
  ay: number;
  /** ms since the last frame */
  dt: number;
  /** 0..1: how far you've closed on the Kreddle Express */
  progress: number;
  /** 0..1: how much the train has faded out of the view (the drugs take over at the end) */
  trainFade?: number;
}

export interface FlightView {
  update(f: FlightFrame): void;
  /** The screen roll this frame (radians, Phaser's sense), so the caller can roll its own things with the horizon. */
  readonly roll: number;
  /** For tests / the HUD. */
  readonly state: { alt: number; speed: number; trainDist: number; roll: number; pitch: number; white: number };
  destroy(): void;
}

const F = 600;
const NEAR = 40;
/** Ground texture repeat (world units per texture). */
const TILE = 6000;
const FAR = 52000;
const ROWS = 26;
const COLS = 18;
const RAIL_SEGS = 40;
const RAIL_W = 240;
/** The railway's line: x = RAIL_X + RAIL_A * sin(y / RAIL_P). */
const RAIL_X = 1500;
const RAIL_A = 1300;
const RAIL_P = 9000;
const TRAIN_L = 3000;
const TRAIN_H = TRAIN_L * (29 / 221);
const N_CLOUDS = 16;
const N_STREAKS = 26;
const SKY_TOP = 0x2f5fb8;
const SKY_MID = 0x6ea8e6;
const SKY_HAZE = 0xd9e6f2;
const FOG = 0xc8d7e6;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (a: number, b: number, v: number) => {
  const u = clamp((v - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const mixC = (a: number, b: number, k: number) =>
  (Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k)) << 16) | (Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k)) << 8) | Math.round(lerp(a & 255, b & 255, k));
const railX = (y: number) => RAIL_X + RAIL_A * Math.sin(y / RAIL_P);
const railDX = (y: number) => (RAIL_A / RAIL_P) * Math.cos(y / RAIL_P);

let seq = 0;

export function createFlightView(sc: Phaser.Scene, o: FlightViewOpts): FlightView {
  const id = `__flt${++seq}`;
  const calm = Juice.calm();
  const gl = sc.game.renderer.type === Phaser.WEBGL;
  const made: Phaser.GameObjects.GameObject[] = [];
  const texKeys: string[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(g: T) => (made.push(g), g);
  const D = o.depth;
  const SW = sc.scale.width;
  const SH = sc.scale.height;

  // ---- camera state ----
  let camX = 0;
  let camY = 0;
  let alt = 1100;
  let speed = 2600;
  let roll = 0;
  let pitch = 0;
  let sideVel = 0;
  let prevAx = 0;
  let t = 0;
  let white = 0;
  /** when the next cloud is put right on your nose (a brief white-out every so often) */
  let nextPunch = 7;
  let trainD = 22000;
  let cp = 1;
  let sp = 0;
  let cr = 1;
  let sr = 0;
  const out = { x: 0, y: 0, zc: 0 };
  /** World (x lateral, y forward, z up) to screen. zc is the depth along the view axis (not clamped: check it). */
  const project = (x: number, y: number, z: number) => {
    const dx = x - camX;
    const dy = y - camY;
    const dz = z - alt;
    // forward f = (0, cp, -sp), right r = (1, 0, 0), up u = (0, sp, cp)
    const zc = dy * cp - dz * sp;
    const yu = dy * sp + dz * cp;
    const z2 = Math.max(zc, NEAR);
    const sx = (F * dx) / z2;
    const sy = (-F * yu) / z2;
    out.x = o.cx + sx * cr - sy * sr;
    out.y = o.cy + sx * sr + sy * cr;
    out.zc = zc;
    return out;
  };

  // ---- textures ----
  const glow = `${id}_glow`;
  {
    const c = sc.textures.createCanvas(glow, 128, 128)!;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,250,225,0.95)");
    g.addColorStop(0.45, "rgba(255,236,170,0.35)");
    g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    c.refresh();
    c.setFilter(Phaser.Textures.FilterMode.LINEAR);
    texKeys.push(glow);
  }
  // the railway: ballast, sleepers, two rails (16 x 64, so it repeats along its length)
  const railKey = `${id}_rail`;
  {
    const c = sc.textures.createCanvas(railKey, 16, 64)!;
    const ctx = c.getContext();
    ctx.fillStyle = "#5a5148";
    ctx.fillRect(0, 0, 16, 64);
    ctx.fillStyle = "#4a3b2c";
    for (let y = 0; y < 64; y += 8) ctx.fillRect(2, y, 12, 4);
    ctx.fillStyle = "#c9ccd1";
    ctx.fillRect(4, 0, 2, 64);
    ctx.fillRect(10, 0, 2, 64);
    ctx.fillStyle = "#857b6e";
    ctx.fillRect(0, 0, 1, 64);
    ctx.fillRect(15, 0, 1, 64);
    c.refresh();
    texKeys.push(railKey);
    mipmap(sc, railKey);
  }
  // the land: a repeating, mipmapped copy of the countryside (power-of-two, so WebGL lets it wrap)
  const landKey = `${id}_land`;
  const haveLand = sc.textures.exists("fly_land");
  if (haveLand) {
    const src = sc.textures.get("fly_land").getSourceImage() as HTMLImageElement;
    const c = sc.textures.createCanvas(landKey, 1024, 1024)!;
    c.getContext().drawImage(src, 0, 0, 1024, 1024);
    c.refresh();
    texKeys.push(landKey);
    mipmap(sc, landKey);
  }

  // ---- the sky: one container, drawn once, that rolls and pitches about the horizon ----
  const sky = keep(sc.add.container(o.cx, o.cy).setDepth(D));
  {
    const g = sc.add.graphics();
    const W = 2600;
    g.fillStyle(SKY_TOP, 1).fillRect(-W / 2, -3000, W, 2000);
    g.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_MID, SKY_MID, 1).fillRect(-W / 2, -1000, W, 760);
    g.fillGradientStyle(SKY_MID, SKY_MID, SKY_HAZE, SKY_HAZE, 1).fillRect(-W / 2, -240, W, 242);
    // below the horizon (seen past the end of the ground, and where it fades out)
    g.fillStyle(FOG, 1).fillRect(-W / 2, 0, W, 3000);
    sky.add(g);
  }
  // distant hills, two ranges, drawn twice over so they can slide (they barely move: they're a long way off)
  const hills = sc.add.graphics();
  {
    const range = (seed: number, hgt: number, col: number, step: number) => {
      const pts: Phaser.Types.Math.Vector2Like[] = [{ x: -1800, y: 30 }];
      for (let x = -1800; x <= 1800; x += step) {
        const u = ((x + 1800) / 1800) * Math.PI * 2;
        const h = hgt * (0.55 + 0.25 * Math.sin(u * 3 + seed) + 0.15 * Math.sin(u * 7 + seed * 2.3) + 0.08 * Math.sin(u * 13 + seed * 0.7));
        pts.push({ x, y: -Math.max(2, h) });
      }
      pts.push({ x: 1800, y: 30 });
      hills.fillStyle(col, 1).fillPoints(pts, true);
    };
    range(1.3, 34, 0x9fb3c9, 24);
    range(4.1, 20, 0x8aa38f, 18);
    hills.fillStyle(FOG, 1).fillRect(-1800, 0, 3600, 30);
    sky.add(hills);
  }

  // the sun, up and to the right, and its glare
  const SUN = { x: 0.42, z: 0.2 };
  const sun = keep(sc.add.image(0, 0, glow).setDepth(D + 0.05).setScale(1.3));
  const sunCore = keep(sc.add.circle(0, 0, 13, 0xfffbe8, 1).setDepth(D + 0.06));
  const glare = keep(sc.add.image(0, 0, glow).setDepth(D + 0.9).setBlendMode(Phaser.BlendModes.ADD).setScale(5).setAlpha(0));
  const flares = [0.35, 0.65, 1.25].map((k, i) => ({
    k,
    img: keep(
      sc.add
        .image(0, 0, glow)
        .setDepth(D + 0.9)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale([0.5, 0.3, 0.8][i])
        .setTint([0xffd27a, 0x9fe3ff, 0xff9ad5][i]),
    ),
  }));

  // ---- the ground ----
  let ground: Phaser.GameObjects.Mesh | null = null;
  let rail: Phaser.GameObjects.Mesh | null = null;
  let train: Phaser.GameObjects.Mesh | null = null;
  let flat: Phaser.GameObjects.Graphics | null = null;
  if (gl) {
    ground = keep(sc.add.mesh(0, 0, haveLand ? landKey : "__WHITE").setDepth(D + 0.1));
    gridMesh(ground, COLS, ROWS, haveLand ? 0xffffff : 0x5f8a45);
    rail = keep(sc.add.mesh(0, 0, railKey).setDepth(D + 0.15));
    gridMesh(rail, 1, RAIL_SEGS, 0xffffff);
    train = keep(sc.add.mesh(0, 0, sc.textures.exists("p_train") ? "p_train" : "__WHITE").setDepth(D + 0.5));
    gridMesh(train, 1, 1, 0xffffff);
  } else flat = keep(sc.add.graphics().setDepth(D + 0.1));
  const marker = keep(
    sc.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "11px", color: "#ff4fd8", fontStyle: "bold", stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5, 1)
      .setDepth(D + 0.95),
  );
  // a smoke plume off the engine
  const puffs = Array.from({ length: 7 }, (_, i) => ({ age: i / 7, img: keep(sc.add.image(0, 0, glow).setDepth(D + 0.49).setTint(0xb8b8b8)) }));

  // ---- clouds ----
  const cloudKeys = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter((k) => sc.textures.exists(k));
  interface Cloud {
    img: Phaser.GameObjects.Image;
    x: number;
    y: number;
    z: number;
    size: number;
    hit: boolean;
    /** 0..1 fade-in, so a cloud put somewhere new doesn't pop */
    fade: number;
  }
  const clouds: Cloud[] = [];
  const placeCloud = (c: Cloud, first: boolean) => {
    const d = first ? lerp(2500, 36000, Math.random()) : lerp(26000, 38000, Math.random());
    c.y = camY + d;
    const r = Math.random();
    // a third at your height (you'll go through some), the rest above and below
    c.z = r < 0.34 ? alt + lerp(-250, 250, Math.random()) : r < 0.75 ? alt + lerp(600, 2600, Math.random()) : Math.max(220, alt - lerp(250, 700, Math.random()));
    c.x = camX + lerp(-1, 1, Math.random()) * (r < 0.34 ? 0.35 : 0.9) * d;
    c.size = lerp(900, 2400, Math.random());
    c.hit = false;
  };
  for (let i = 0; i < (cloudKeys.length ? N_CLOUDS : 0); i++) {
    const img = keep(sc.add.image(0, 0, cloudKeys[i % cloudKeys.length]).setDepth(D + 0.3));
    const c: Cloud = { img, x: 0, y: 0, z: 0, size: 1000, hit: false, fade: 1 };
    placeCloud(c, true);
    clouds.push(c);
  }

  // ---- speed streaks, the white-out ----
  const streakG = keep(sc.add.graphics().setDepth(D + 0.92));
  const streaks = Array.from({ length: N_STREAKS }, () => ({ x: 0, y: 0, z: 0 }));
  const placeStreak = (s: { x: number; y: number; z: number }, first: boolean) => {
    const a = Math.random() * Math.PI * 2;
    const r = lerp(120, 520, Math.random());
    s.x = camX + Math.cos(a) * r;
    s.z = alt + Math.sin(a) * r * 0.6;
    s.y = camY + (first ? lerp(200, 3000, Math.random()) : lerp(2200, 3200, Math.random()));
  };
  for (const s of streaks) placeStreak(s, true);
  const whiteout = keep(sc.add.rectangle(SW / 2, SH / 2, SW, SH, 0xffffff, 1).setDepth(D + 0.97).setAlpha(0));

  // ---- per frame ----
  const groundV = ground?.vertices ?? [];
  const railV = rail?.vertices ?? [];
  const trainV = train?.vertices ?? [];
  const rowD: number[] = [];
  const state = { alt, speed, trainDist: trainD, roll, pitch, white };

  const update = (f: FlightFrame) => {
    const dt = Math.min(f.dt, 50) / 1000;
    t += dt;
    const ax = clamp(f.ax, -1, 1);
    const ay = clamp(f.ay, -1, 1);
    // bank with the stick, and harder while you're actually rolling across
    const vel = (ax - prevAx) / Math.max(dt, 0.001);
    prevAx = ax;
    sideVel = lerp(sideVel, clamp(vel, -2, 2), Math.min(1, dt * 6));
    roll = -(ax * 0.2 + sideVel * 0.12) + Math.sin(t / 0.7) * 0.03;
    pitch = ay * 0.2 + Math.sin(t / 1.3) * 0.01;
    // height: diving trades it for speed; the cruise height comes down as you close on the train
    const cruise = lerp(1150, 520, f.progress);
    alt = clamp(alt + (-ay * 1100 - (alt - cruise) * 0.35) * dt, 260, 2400);
    speed = lerp(speed, 2600 * (1 + 0.55 * ay) + f.progress * 600, Math.min(1, dt * 2));
    camY += speed * dt;
    camX = lerp(camX, ax * 2400, Math.min(1, dt * 3));
    cp = Math.cos(pitch);
    sp = Math.sin(pitch);
    cr = Math.cos(roll);
    sr = Math.sin(roll);

    // sky: centred on where the horizon crosses the view's centre line
    const hz = -F * Math.tan(pitch);
    sky.setPosition(o.cx - sr * hz, o.cy + cr * hz).setRotation(roll);
    hills.setX(((((-camX * 0.03) % 1200) + 1800) % 1200) - 600);

    // the sun (a direction, not a place)
    const sq = project(camX + SUN.x * 1e6, camY + 1e6, alt + SUN.z * 1e6);
    sun.setPosition(sq.x, sq.y);
    sunCore.setPosition(sq.x, sq.y);
    const onScreen = 1 - smooth(260, 560, Math.hypot(sq.x - o.cx, sq.y - o.cy));
    glare.setPosition(sq.x, sq.y).setAlpha(onScreen * (calm ? 0.18 : 0.3));
    for (const fl of flares) fl.img.setPosition(lerp(sq.x, o.cx, 1 + fl.k * 0.6), lerp(sq.y, o.cy, 1 + fl.k * 0.6)).setAlpha(onScreen * 0.22);

    // ground rows: geometric spacing from just ahead of the nose (always in front of the camera) out to the haze
    const d0 = Math.max(120, (NEAR + alt * Math.max(0, -sp)) / Math.max(0.2, cp) + 60);
    for (let j = 0; j <= ROWS; j++) rowD[j] = d0 * Math.pow(FAR / d0, j / ROWS);
    const fogK = (d: number) => smooth(FAR * 0.18, FAR * 0.95, d);
    if (ground) {
      for (let j = 0; j <= ROWS; j++) {
        const d = rowD[j];
        const wy = camY + d;
        const half = d * 1.6 + 2000;
        const fk = fogK(d);
        const col = mixC(0xffffff, FOG, fk * 0.8);
        const a = 1 - smooth(FAR * 0.55, FAR, d);
        for (let i = 0; i <= COLS; i++) {
          const wx = camX + lerp(-half, half, i / COLS);
          const q = project(wx, wy, 0);
          const v = groundV[j * (COLS + 1) + i];
          v.x = q.x;
          v.y = -q.y;
          v.u = wx / TILE;
          v.v = wy / TILE;
          v.color = col;
          v.alpha = a;
        }
      }
    } else if (flat) {
      flat.clear();
      const near = project(camX, camY + d0, 0);
      flat.fillStyle(0x5f8a45, 1).fillPoints(
        [
          { x: near.x - cr * 3000 - sr * 0, y: near.y - sr * 3000 },
          { x: near.x + cr * 3000, y: near.y + sr * 3000 },
          { x: near.x + cr * 3000 - sr * 3000, y: near.y + sr * 3000 + cr * 3000 },
          { x: near.x - cr * 3000 - sr * 3000, y: near.y - sr * 3000 + cr * 3000 },
        ],
        true,
      );
    }

    // the railway
    if (rail) {
      for (let j = 0; j <= RAIL_SEGS; j++) {
        const d = d0 * Math.pow((FAR * 0.9) / d0, j / RAIL_SEGS);
        const wy = camY + d;
        const rx = railX(wy);
        const nx = 1 / Math.hypot(1, railDX(wy));
        const a = 1 - smooth(FAR * 0.4, FAR * 0.9, d);
        for (let i = 0; i <= 1; i++) {
          const q = project(rx + (i ? 1 : -1) * RAIL_W * 0.5 * nx, wy, 0);
          const v = railV[j * 2 + i];
          v.x = q.x;
          v.y = -q.y;
          v.u = i;
          v.v = wy / (RAIL_W * 4);
          v.alpha = a;
          v.color = mixC(0xffffff, FOG, fogK(d) * 0.8);
        }
      }
    }

    // the Kreddle Express: closing as you collect, then gone in the haze when the drugs take over
    const target = lerp(22000, 3000, clamp(f.progress, 0, 1));
    trainD = lerp(trainD, target, Math.min(1, dt * 1.2));
    const fade = clamp(f.trainFade ?? 0, 0, 1);
    const ty = camY + trainD;
    const tx = railX(ty);
    const tdx = railDX(ty);
    // the art is a side view, so stand it mostly broadside to you (as if the line swings across your path just there):
    // edge-on along the track it'd be a sliver
    const bx = 0.88 + 0.12 * (tdx / Math.hypot(tdx, 1));
    const by = 0.12 / Math.hypot(tdx, 1);
    const tl = Math.hypot(bx, by);
    const ux = bx / tl;
    const uy = by / tl;
    const ta = (1 - smooth(FAR * 0.5, FAR * 0.85, trainD)) * (1 - fade);
    if (train) {
      // corners: rear-base, nose-base (u = 1: the art's nose is on the right), rear-top, nose-top
      const pts: [number, number, number][] = [
        [tx - (ux * TRAIN_L) / 2, ty - (uy * TRAIN_L) / 2, 0],
        [tx + (ux * TRAIN_L) / 2, ty + (uy * TRAIN_L) / 2, 0],
        [tx - (ux * TRAIN_L) / 2, ty - (uy * TRAIN_L) / 2, TRAIN_H],
        [tx + (ux * TRAIN_L) / 2, ty + (uy * TRAIN_L) / 2, TRAIN_H],
      ];
      // the mesh's grid rows run v 0..1 top to bottom; row 0 is the top
      const order = [2, 3, 0, 1];
      for (let k = 0; k < 4; k++) {
        const p = pts[order[k]];
        const q = project(p[0], p[1], p[2]);
        const v = trainV[k];
        v.x = q.x;
        v.y = -q.y;
        v.alpha = ta;
        v.color = mixC(0xffffff, FOG, fogK(trainD) * 0.7);
      }
      // sort it in with the clouds
      train.setDepth(D + 0.3 + 0.35 * (1 - clamp(trainD / FAR, 0, 1)));
    }
    // its smoke, drifting back off the cab
    for (const p of puffs) {
      p.age = (p.age + dt * 0.5) % 1;
      const back = p.age * 900;
      const q = project(tx + ux * (TRAIN_L / 2 - 120 - back), ty + uy * (TRAIN_L / 2 - 120 - back), TRAIN_H + 40 + p.age * 260);
      const s = (F * (80 + p.age * 260)) / Math.max(q.zc, NEAR) / 64;
      p.img.setPosition(q.x, q.y).setScale(s).setAlpha(ta * 0.45 * (1 - p.age)).setDepth(D + 0.29 + 0.35 * (1 - clamp(trainD / FAR, 0, 1)));
    }
    // the marker over it, kept inside the windscreen
    const mq = project(tx, ty, TRAIN_H + 260);
    const km = (trainD * 0.0005).toFixed(1);
    marker
      .setText(`◆\nKREDDLE EXPRESS ${km} KM`)
      .setPosition(clamp(mq.x, 120, SW - 120), clamp(mq.y, o.cy - 110, o.cy + 90))
      .setAlpha(ta > 0.05 && mq.zc > NEAR ? Math.min(1, ta * 1.4) * (0.75 + 0.25 * Math.sin(t * 6)) : 0);

    // clouds: every so often one sits dead ahead at your height, so you punch through it
    if (t > nextPunch && clouds.length) {
      nextPunch = t + lerp(8, 13, Math.random());
      const c = clouds.reduce((a, b) => (b.y > a.y ? b : a));
      c.y = camY + speed * 3.2;
      c.x = camX + (ax * 2400 - camX) + lerp(-150, 150, Math.random());
      c.z = alt - ay * 1100 * 1.5;
      c.size = lerp(1800, 2600, Math.random());
      c.hit = false;
      c.fade = 0;
    }
    let through = 0;
    for (const c of clouds) {
      const q = project(c.x, c.y, c.z);
      if (q.zc < 150) {
        // gone past: if it was round you, you've just been through it
        placeCloud(c, false);
        continue;
      }
      const s = (F * c.size) / q.zc / c.img.width;
      const near = smooth(150, 1400, q.zc);
      const far = 1 - smooth(FAR * 0.55, FAR * 0.75, q.zc);
      c.img
        .setPosition(q.x, q.y)
        .setScale(s, s * 0.8)
        .setRotation(roll)
        .setAlpha(near * far * 0.95 * (c.fade = Math.min(1, c.fade + dt * 1.2)))
        .setDepth(D + 0.3 + 0.35 * (1 - clamp(q.zc / FAR, 0, 1)));
      // inside the cloud's puff as it passes over the nose
      if (q.zc < 1600 && Math.abs(c.x - camX) < c.size * 0.42 && Math.abs(c.z - alt) < c.size * 0.22) through = Math.max(through, 1 - q.zc / 1600);
    }
    // a brief white-out (gentler, and slower to come and go, under calm flashes)
    const peak = calm ? 0.45 : 0.85;
    white = through > 0 ? Math.max(white, through * peak) : Math.max(0, white - dt * (calm ? 0.9 : 2.4));
    if (calm) white = Math.min(white, peak);
    whiteout.setAlpha(white);

    // speed streaks: when you dive (or you're really moving)
    const rush = clamp((ay - 0.15) * 1.4, 0, 1) * 0.85 + clamp((speed - 3000) / 2500, 0, 0.35);
    streakG.clear();
    if (rush > 0.02) {
      for (const s of streaks) {
        s.y -= speed * dt * 0.6;
        if (s.y - camY < 150) placeStreak(s, false);
        const a = project(s.x, s.y, s.z);
        const ax0 = a.x;
        const ay0 = a.y;
        const b = project(s.x, s.y + 380 + rush * 420, s.z);
        streakG.lineStyle(1.5, 0xffffff, rush * 0.55).lineBetween(ax0, ay0, b.x, b.y);
      }
    }

    state.alt = alt;
    state.speed = speed;
    state.trainDist = trainD;
    state.roll = roll;
    state.pitch = pitch;
    state.white = white;
  };

  let dead = false;
  const destroy = () => {
    if (dead) return;
    dead = true;
    sc.events.off("shutdown", destroy);
    for (const g of made) g.destroy();
    for (const k of texKeys) if (sc.textures.exists(k)) sc.textures.remove(k);
  };
  sc.events.once("shutdown", destroy);
  update({ ax: 0, ay: 0, dt: 0, progress: 0 });

  return {
    update,
    get roll() {
      return roll;
    },
    state,
    destroy,
  };

  /** A (cols x rows) grid of shared vertices (row-major, v 0..1 top to bottom), drawn in screen space. */
  function gridMesh(m: Phaser.GameObjects.Mesh, cols: number, rows: number, color: number) {
    const v: number[] = [];
    const uv: number[] = [];
    const ix: number[] = [];
    const cs: number[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        v.push(0, 0);
        uv.push(i / cols, j / rows);
        cs.push(color);
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        ix.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    m.addVertices(v, uv, ix, false, undefined, cs);
    // one vertex per point, so moving vertices[i] moves every triangle that uses it
    const all = m.vertices;
    const pts: Phaser.Geom.Mesh.Vertex[] = new Array((cols + 1) * (rows + 1));
    ix.forEach((p, k) => (pts[p] ??= all[k]));
    m.faces.forEach((f, k) => {
      f.vertex1 = pts[ix[k * 3]];
      f.vertex2 = pts[ix[k * 3 + 1]];
      f.vertex3 = pts[ix[k * 3 + 2]];
    });
    m.vertices = pts;
    m.hideCCW = false;
    m.setOrtho(SW, SH);
    m.ignoreDirtyCache = true;
  }
}

/** Give a (power-of-two) canvas texture mipmaps, so the far fields don't shimmer. */
function mipmap(sc: Phaser.Scene, key: string) {
  const r = sc.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (sc.game.renderer.type !== Phaser.WEBGL || !r.gl) return;
  const wrapper = sc.textures.get(key).source[0]?.glTexture as unknown as { webGLTexture?: WebGLTexture; minFilter?: number; magFilter?: number } | null;
  const tex = wrapper?.webGLTexture;
  if (!tex) return;
  const gl = r.gl;
  gl.activeTexture(gl.TEXTURE0);
  const cur = gl.getParameter(gl.TEXTURE_BINDING_2D);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  // (the ground is seen at a grazing angle: without this the middle distance goes to mush)
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  if (wrapper) {
    wrapper.minFilter = gl.LINEAR_MIPMAP_LINEAR;
    wrapper.magFilter = gl.NEAREST;
  }
  if (cur) gl.bindTexture(gl.TEXTURE_2D, cur);
}
