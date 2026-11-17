import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import * as Juice from "../../gfx/Juice";
import { FONT } from "../../ui/theme";

/**
 * The first look at Krelford: a 2.5D flyover. The town is snapshotted once into a texture and laid on a ground plane
 * (a Mesh whose vertices we project ourselves through a simple perspective camera); every tall thing in town
 * (buildings, the Kreltower, the trees, the people) is stamped into an atlas and stood up as a billboard that leans up
 * out of the ground as the camera tilts towards the horizon. Clouds, birds and the sky are placed in the same 3D
 * space, so parallax, orbits and the dive through the clouds all come out of one projection.
 *
 * It runs on a fixed timeline (seconds), driven off the scene's update, so skipping just tears it down and hands the
 * caller back the camera. At the end the camera is looking straight down at the player at the live camera's zoom,
 * which is exactly what the live camera shows, so the hand-off is seamless.
 */

/** The eight landmarks, in flying order. `head` is the start of `cap` (the rest of the caption follows it). */
export const FLY_STOPS: { x: number; y: number; head: string; cap: string }[] = [
  { x: 1280, y: 1300, head: "WILDERN ACADEMY", cap: "WILDERN ACADEMY. The local school. The new headmaster is said to be very… krazy." },
  { x: 1650, y: 1080, head: "THE KRELTOWER", cap: "THE KRELTOWER. The tallest building in Krelford. Nobody's sure what's on the top floor. Nobody's asked." },
  { x: 2440, y: 1010, head: "POLSON TOWERS", cap: "POLSON TOWERS (down that road). Polson HQ. Home of Polson, a lot of stuff, and every decision he's ever not made. Thoughts? Wbu?" },
  { x: 1900, y: 440, head: "THE HISTORICAL ARCHIVE", cap: "THE HISTORICAL ARCHIVE. Every message ever sent, kept forever. The FGM War Room is in the basement." },
  { x: 1280, y: 440, head: "KRELFORD TOWN HALL", cap: "KRELFORD TOWN HALL. Where the cabinet meets, argues, and governs." },
  { x: 1280, y: 800, head: "THE GREAT PUSSY JUICE TAP", cap: "THE GREAT PUSSY JUICE TAP. It heals. It nourishes. It is the national drink. Never let it stop. It comes from the juice of women's pussies" },
  { x: 560, y: 840, head: "THE KREZZ ARMS", cap: "THE KREZZ ARMS. Fizzy Bongos on tap. SanMik & SanChz on most nights. A strip club. You have been warned." },
  { x: 160, y: 825, head: "THE KREDDLE BRIDGE", cap: "THE KREDDLE BRIDGE. Over there: Kreddle, the casino universe. They hate us. Their slot machines are excellent." },
];
export const FLY_LAST = "And this is you. Off to the Town Hall. Don't be late.";

/** The rest of a caption after its headline (the headline plus this is the whole caption, word for word). */
export const capBody = (s: { head: string; cap: string }) => s.cap.slice(s.head.length).replace(/^\.\s*/, "");

// ---- the timeline (seconds) ----
const OPEN = 5.2;
const HOLD = 2.6;
const TRAVEL = 0.9;
const STOP_T = (i: number) => OPEN + i * (HOLD + TRAVEL);
const LAST_HOLD_END = STOP_T(FLY_STOPS.length - 1) + HOLD;
const RISE = 1.4;
const TITLE_T = LAST_HOLD_END + RISE;
const TITLE_HOLD = 2.2;
const DIVE = 2.5;
const LAND_T = TITLE_T + TITLE_HOLD + DIVE;
const FADE = 0.5;
/** Total running time (s). */
export const FLY_LENGTH = LAND_T + FADE + 0.3;

/** Focal length (px): 1 world px = 1 screen px at this distance, looking straight down. */
const FOCAL = 600;
const NEAR = 30;
const DEG = Math.PI / 180;
const SW = 960;
const SH = 540;
const BAR = 62;

interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}
/** A camera aimed at a point on the ground: from `d` away, `p` degrees below the horizon, heading `yaw` (0 = north). */
interface Aim {
  x: number;
  y: number;
  d: number;
  p: number;
  yaw: number;
  r: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));
const easeIO3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function aimToPose(a: Aim): Pose {
  const yaw = a.yaw * DEG;
  const p = a.p * DEG;
  const fx = Math.cos(p) * Math.sin(yaw);
  const fy = -Math.cos(p) * Math.cos(yaw);
  const fz = -Math.sin(p);
  return { x: a.x - fx * a.d, y: a.y - fy * a.d, z: -fz * a.d, yaw, pitch: p, roll: a.r * DEG };
}

function lerpAim(a: Aim, b: Aim, u: number, hop = 0): Aim {
  let dy = b.yaw - a.yaw;
  while (dy > 180) dy -= 360;
  while (dy < -180) dy += 360;
  const arc = Math.sin(Math.PI * u);
  return {
    x: lerp(a.x, b.x, u),
    y: lerp(a.y, b.y, u),
    d: Math.exp(lerp(Math.log(a.d), Math.log(b.d), u)) * (1 + hop * arc),
    p: lerp(a.p, b.p, u) - hop * 10 * arc,
    yaw: a.yaw + dy * u,
    // bank into the turn
    r: lerp(a.r, b.r, u) + clamp(-dy * 0.22, -12, 12) * arc * (hop > 0 ? 1 : 0),
  };
}

/** Each landmark's shot: where the camera is as it arrives, and as it leaves (it drifts / orbits between the two). */
const SHOTS: [Omit<Aim, "x" | "y">, Omit<Aim, "x" | "y">][] = [
  // Wildern: a slow push in
  [{ d: 900, p: 48, yaw: 0, r: 0 }, { d: 720, p: 52, yaw: -10, r: 0 }],
  // the Kreltower: low, orbiting round it
  [{ d: 1000, p: 16, yaw: 125, r: 4 }, { d: 880, p: 20, yaw: 195, r: -3 }],
  // Polson Towers: looking east down the road
  [{ d: 560, p: 15, yaw: 84, r: 0 }, { d: 720, p: 12, yaw: 98, r: 2 }],
  // the Archive: a truck along the front
  [{ d: 760, p: 40, yaw: 28, r: 0 }, { d: 700, p: 44, yaw: 8, r: 0 }],
  // the Town Hall: head-on, pushing in
  [{ d: 1100, p: 22, yaw: 0, r: 0 }, { d: 800, p: 30, yaw: 0, r: 0 }],
  // the Tap: nearly overhead, turning
  [{ d: 640, p: 70, yaw: -40, r: 0 }, { d: 560, p: 76, yaw: 25, r: 0 }],
  // the Krezz Arms: low and to the side
  [{ d: 820, p: 30, yaw: -18, r: 0 }, { d: 720, p: 36, yaw: -38, r: -2 }],
  // the Kreddle Bridge: looking west, out of town
  [{ d: 1000, p: 15, yaw: -78, r: 0 }, { d: 1250, p: 12, yaw: -96, r: 0 }],
];
const TITLE_A: Aim = { x: 1320, y: 900, d: 2700, p: 13, yaw: -24, r: -2 };
const TITLE_B: Aim = { x: 1300, y: 880, d: 2450, p: 16, yaw: 6, r: 1 };

/** The opening: high above the clouds, gliding, then a dive through the cloud deck (camera positions). */
function openingPose(t: number): Pose {
  const arrive = aimToPose({ x: FLY_STOPS[0].x, y: FLY_STOPS[0].y, ...SHOTS[0][0] });
  const keys: Pose[] = [
    { x: 1280, y: 7800, z: 5400, yaw: 0, pitch: 4 * DEG, roll: 0 },
    { x: 1300, y: 6900, z: 5100, yaw: 0.02, pitch: 8 * DEG, roll: 2 * DEG },
    { x: 1310, y: 4700, z: 2900, yaw: 0.0, pitch: 34 * DEG, roll: -5 * DEG },
    { x: 1290, y: 2700, z: 1250, yaw: 0.0, pitch: 46 * DEG, roll: -2 * DEG },
    arrive,
  ];
  const times = [0, 1.9, 3.3, 4.3, OPEN];
  let i = 0;
  while (i < times.length - 2 && t > times[i + 1]) i++;
  const u = clamp((t - times[i]) / (times[i + 1] - times[i]), 0, 1);
  // Catmull-Rom through the keys, so the dive never kinks
  const k = i + u;
  const cr = (f: (p: Pose) => number) => Phaser.Math.Interpolation.CatmullRom(keys.map(f), k / (keys.length - 1));
  return { x: cr((p) => p.x), y: cr((p) => p.y), z: cr((p) => p.z), yaw: cr((p) => p.yaw), pitch: cr((p) => p.pitch), roll: cr((p) => p.roll) };
}

/** Where the camera is at time t (s). `end` is the live camera's view of the player. */
function poseAt(t: number, end: Aim): Pose {
  if (t <= OPEN) return openingPose(t);
  const stopAim = (i: number, leave: boolean): Aim => ({ x: FLY_STOPS[i].x, y: FLY_STOPS[i].y, ...SHOTS[i][leave ? 1 : 0] });
  for (let i = 0; i < FLY_STOPS.length; i++) {
    const t0 = STOP_T(i);
    if (t < t0 + HOLD) return aimToPose(lerpAim(stopAim(i, false), stopAim(i, true), ease((t - t0) / HOLD)));
    if (i < FLY_STOPS.length - 1 && t < t0 + HOLD + TRAVEL) return aimToPose(lerpAim(stopAim(i, true), stopAim(i + 1, false), easeIO3((t - t0 - HOLD) / TRAVEL), 0.35));
  }
  if (t < TITLE_T) return aimToPose(lerpAim(stopAim(FLY_STOPS.length - 1, true), TITLE_A, easeIO3((t - LAST_HOLD_END) / RISE), 0.2));
  if (t < TITLE_T + TITLE_HOLD) return aimToPose(lerpAim(TITLE_A, TITLE_B, ease((t - TITLE_T) / TITLE_HOLD)));
  const u = clamp((t - TITLE_T - TITLE_HOLD) / DIVE, 0, 1);
  // the dive: fast at first, settling softly onto the live view
  const k = 1 - Math.pow(1 - u, 3);
  const a = lerpAim(TITLE_B, end, k);
  a.p = lerp(TITLE_B.p, 90, Math.pow(k, 0.8));
  a.r = lerp(TITLE_B.r, 0, k) + Math.sin(Math.PI * k) * 6;
  return aimToPose(a);
}

class Projector {
  fx = 0;
  fy = 0;
  fz = 0;
  rx = 0;
  ry = 0;
  ux = 0;
  uy = 0;
  uz = 0;
  cr = 1;
  sr = 0;
  p!: Pose;
  set(p: Pose) {
    this.p = p;
    const cp = Math.cos(p.pitch);
    this.fx = cp * Math.sin(p.yaw);
    this.fy = -cp * Math.cos(p.yaw);
    this.fz = -Math.sin(p.pitch);
    this.rx = Math.cos(p.yaw);
    this.ry = Math.sin(p.yaw);
    // U = F x R (R has no z)
    this.ux = -this.fz * this.ry;
    this.uy = this.fz * this.rx;
    this.uz = this.fx * this.ry - this.fy * this.rx;
    this.cr = Math.cos(p.roll);
    this.sr = Math.sin(p.roll);
  }
  /** Screen x, y and the depth along the view (clamped to the near plane: check `zc` against NEAR yourself). */
  out = { x: 0, y: 0, zc: 0 };
  project(x: number, y: number, z: number) {
    const dx = x - this.p.x;
    const dy = y - this.p.y;
    const dz = z - this.p.z;
    const zc = dx * this.fx + dy * this.fy + dz * this.fz;
    const xr = dx * this.rx + dy * this.ry;
    const yu = dx * this.ux + dy * this.uy + dz * this.uz;
    const z2 = Math.max(zc, NEAR);
    const sx = (FOCAL * xr) / z2;
    const sy = (-FOCAL * yu) / z2;
    this.out.x = SW / 2 + sx * this.cr - sy * this.sr;
    this.out.y = SH / 2 + sx * this.sr + sy * this.cr;
    this.out.zc = zc;
    return this.out;
  }
  /** Where the horizon crosses the screen's vertical centre line (before roll), and the roll. */
  horizonY() {
    return SH / 2 - FOCAL * Math.tan(this.p.pitch);
  }
}

interface Board {
  /** the base line's centre and half-width, and the height, in world px */
  x: number;
  y: number;
  hw: number;
  h: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  vi: number;
}

interface Cloud {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  size: number;
  a: number;
}

export interface FlyoverOpts {
  worldW: number;
  worldH: number;
  /** what the live camera will show at the end: the point it's centred on and its zoom */
  end: { x: number; y: number; zoom: number };
  playerName: string;
  /** world objects to leave out of the snapshot entirely */
  skip?: Phaser.GameObjects.GameObject[];
}

/** Can this device do the 3D version? (Meshes need WebGL.) */
export const canFly3d = (sc: Phaser.Scene) => sc.game.renderer.type === Phaser.WEBGL;

/**
 * Run the flyover. Resolves when it's over (played out or skipped), with everything it made cleaned up and the world
 * visible again; the caller puts the camera back on the player and the UI back on.
 */
export function runFlyover(sc: Phaser.Scene, o: FlyoverOpts): Promise<{ skipped: boolean }> {
  const calm = Juice.calm();
  const made: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(g: T) => (made.push(g), g);
  const D = 8000;

  // ---- snapshot the town ----
  const skipSet = new Set(o.skip ?? []);
  const world = (sc.children.list as Phaser.GameObjects.GameObject[]).filter((g) => {
    const v = g as unknown as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
    return v.visible && v.scrollFactorX === 1 && v.depth < 3000 && !skipSet.has(g);
  });
  const order = world.map((g, i) => ({ g, i, d: (g as unknown as Phaser.GameObjects.Components.Depth).depth })).sort((a, b) => a.d - b.d || a.i - b.i);
  const isBoard = (g: Phaser.GameObjects.GameObject) => {
    if (g.type !== "Image" && g.type !== "Sprite") return false;
    const im = g as Phaser.GameObjects.Image;
    return im.depth > 2 && im.displayHeight >= 36 && im.alpha > 0.2 && im.rotation === 0 && im.blendMode === Phaser.BlendModes.NORMAL;
  };
  const S = 0.5;
  const GW = Math.ceil(o.worldW * S);
  const GH = Math.ceil(o.worldH * S);
  const gKey = "__fly_ground";
  const bKey = "__fly_boards";
  for (const k of [gKey, bKey]) if (sc.textures.exists(k)) sc.textures.remove(k);
  const ground = sc.textures.addDynamicTexture(gKey, GW, GH)!;
  ground.camera.setOrigin(0, 0);
  ground.camera.setZoom(S);
  ground.fill(0x3f6b34);
  const flat = order.filter((e) => !isBoard(e.g) && e.g.type !== "Text").map((e) => e.g);
  ground.draw(flat);
  ground.setFilter(Phaser.Textures.FilterMode.LINEAR);

  // the tall things, packed into an atlas (shelf packing)
  const boards: Board[] = [];
  const bObjs = order.filter((e) => isBoard(e.g)).map((e) => e.g as Phaser.GameObjects.Image);
  const AW = 2048;
  let BS = 1;
  const pack = (scale: number) => {
    let x = 0;
    let y = 0;
    let row = 0;
    const at: { x: number; y: number; w: number; h: number }[] = [];
    for (const im of bObjs) {
      const w = Math.ceil(im.displayWidth * scale) + 2;
      const h = Math.ceil(im.displayHeight * scale) + 2;
      if (x + w > AW) {
        x = 0;
        y += row;
        row = 0;
      }
      at.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2 });
      x += w;
      row = Math.max(row, h);
    }
    return { at, h: y + row };
  };
  let packed = pack(BS);
  while (packed.h > 2048 && BS > 0.3) packed = pack((BS *= 0.8));
  const AH = Math.max(4, Math.min(2048, packed.h));
  const atlas = sc.textures.addDynamicTexture(bKey, AW, AH)!;
  bObjs.forEach((im, i) => {
    const a = packed.at[i];
    if (a.y + a.h > AH) return;
    atlas.stamp(im.texture.key, im.frame.name, a.x, a.y, { originX: 0, originY: 0, scaleX: a.w / im.frame.width, scaleY: a.h / im.frame.height, tint: im.tintTopLeft, alpha: im.alpha });
    const left = im.x - im.displayWidth * im.originX;
    const top = im.y - im.displayHeight * im.originY;
    let u0 = a.x / AW;
    let u1 = (a.x + a.w) / AW;
    if (im.flipX) [u0, u1] = [u1, u0];
    boards.push({ x: left + im.displayWidth / 2, y: top + im.displayHeight, hw: im.displayWidth / 2, h: im.displayHeight, u0, u1, v0: a.y / AH, v1: (a.y + a.h) / AH, vi: 0 });
  });

  // the world itself isn't needed while we fly (it's all under the sky): stop drawing it
  const hidden = world.filter((g) => (g as unknown as Phaser.GameObjects.Components.Visible).visible);
  for (const g of hidden) (g as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);

  // ---- the layers, back to front ----
  const P = new Projector();
  // the sky: the PixelLab backdrop (its horizon sits on ours), with the top of the cloud deck below it
  const skyTex = sc.textures.exists("fly_sky");
  const sky = keep(sc.add.container(SW / 2, 0).setScrollFactor(0).setDepth(D));
  const SKY_K = 3;
  const SKY_HZ = 86;
  if (skyTex) sky.add(sc.add.image(0, -SKY_HZ * SKY_K, "fly_sky").setOrigin(0.5, 0).setScale(SKY_K * 1.2, SKY_K));
  else sky.add(sc.add.rectangle(0, -400, 1600, 400, 0x7fb2e8).setOrigin(0.5, 0));
  sky.add(sc.add.rectangle(0, (224 - SKY_HZ) * SKY_K - 2, 2400, 2400, 0xdce8f8).setOrigin(0.5, 0));
  sky.add(sc.add.rectangle(0, -SKY_HZ * SKY_K + 2, 2400, 2400, 0x3d64a8).setOrigin(0.5, 1));

  // the land around the town, and the town
  const apron = keep(sc.add.mesh(0, 0, "__WHITE").setScrollFactor(0).setDepth(D + 1));
  const APR = 9;
  const apronSpan = { x0: -9000, x1: o.worldW + 9000, y0: -9000, y1: o.worldH + 9000 };
  gridMesh(apron, APR, APR, 0, 0, 1, 1, 0x3c6a33);
  const GX = 30;
  const GY = 22;
  const gm = keep(sc.add.mesh(0, 0, gKey).setScrollFactor(0).setDepth(D + 2));
  // a render texture is stored upside down
  gridMesh(gm, GX, GY, 0, 1, 1, 0, 0xffffff);
  const bm = keep(sc.add.mesh(0, 0, bKey).setScrollFactor(0).setDepth(D + 4));
  {
    const v: number[] = [];
    const uv: number[] = [];
    const ix: number[] = [];
    boards.forEach((b, i) => {
      b.vi = i * 4;
      v.push(0, 0, 0, 0, 0, 0, 0, 0);
      // corners: base-left, base-right, top-left, top-right (atlas is upside down too)
      uv.push(b.u0, b.v1, b.u1, b.v1, b.u0, b.v0, b.u1, b.v0);
      ix.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3);
    });
    if (boards.length) {
      bm.addVertices(v, uv, ix);
      shareVerts(bm, ix, boards.length * 4);
    }
    bm.hideCCW = false;
    bm.setOrtho(SW, SH);
    bm.ignoreDirtyCache = true;
  }

  // clouds: a deck to dive through, and a ring of them round the town for the wide shot
  const cloudKeys = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter((k) => sc.textures.exists(k));
  const clouds: Cloud[] = [];
  const rnd = new Phaser.Math.RandomDataGenerator(["krelford"]);
  const addCloud = (x: number, y: number, z: number, size: number, a = 1) => {
    if (!cloudKeys.length) return;
    const img = keep(sc.add.image(0, 0, rnd.pick(cloudKeys)).setScrollFactor(0).setVisible(false).setFlipX(rnd.frac() < 0.5));
    clouds.push({ img, x, y, z, size, a });
  };
  for (let i = 0; i < 46; i++) addCloud(1280 + rnd.realInRange(-2600, 2600), rnd.realInRange(2400, 7600), rnd.realInRange(1700, 3300), rnd.realInRange(700, 1500), 0.95);
  // a few right on the dive path, so you go through them
  for (let i = 0; i < 6; i++) addCloud(1300 + rnd.realInRange(-500, 500), 4800 - i * 420, 2950 - i * 260, rnd.realInRange(500, 800), 0.9);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd.realInRange(-0.15, 0.15);
    const r = rnd.realInRange(1700, 2600);
    addCloud(1280 + Math.cos(a) * r * 1.2, 900 + Math.sin(a) * r, rnd.realInRange(1150, 1700), rnd.realInRange(500, 900), 0.85);
  }

  // birds (a loose flock, flapping), sun shafts, speed streaks, the cloud whiteout
  const birdsG = keep(sc.add.graphics().setScrollFactor(0).setDepth(D + 6));
  const flocks = [
    { t0: STOP_T(1) - 0.4, x: 1450, y: 1150, z: 260, vx: 210, vy: -60 },
    { t0: STOP_T(6) - 0.6, x: 760, y: 980, z: 230, vx: -170, vy: -40 },
    { t0: TITLE_T - 1.2, x: 900, y: 1500, z: 900, vx: 260, vy: -150 },
  ].map((f) => ({ ...f, birds: Array.from({ length: 7 }, (_, i) => ({ ox: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 34 + rnd.realInRange(-8, 8), oy: Math.ceil(i / 2) * 30 + rnd.realInRange(-8, 8), oz: rnd.realInRange(-12, 12), ph: rnd.frac() * 6 })) }));
  const shafts = keep(sc.add.graphics().setScrollFactor(0).setDepth(D + 7).setBlendMode(Phaser.BlendModes.ADD));
  shafts.setPosition(1010, -90);
  for (let i = 0; i < 5; i++) {
    const a0 = (118 + i * 9 + rnd.realInRange(-2, 2)) * DEG;
    const w = rnd.realInRange(2.2, 4.5) * DEG;
    shafts.fillStyle(0xfff2c4, 0.05 + 0.03 * (i % 2));
    shafts.fillTriangle(0, 0, Math.cos(a0) * 1500, Math.sin(a0) * 1500, Math.cos(a0 + w) * 1500, Math.sin(a0 + w) * 1500);
  }
  const streaks = keep(sc.add.graphics().setScrollFactor(0).setDepth(D + 8));
  const streakP = Array.from({ length: 26 }, () => ({ a: rnd.frac() * Math.PI * 2, r: rnd.realInRange(80, 520), s: rnd.realInRange(0.7, 1.3) }));
  const white = keep(sc.add.rectangle(SW / 2, SH / 2, SW + 40, SH + 40, 0xf2f6ff, 0).setScrollFactor(0).setDepth(D + 9));
  const hazeG = keep(sc.add.graphics().setScrollFactor(0).setDepth(D + 3));

  // ---- the overlays: letterbox, lower thirds, the title, the skip hint ----
  const barT = keep(sc.add.rectangle(SW / 2, -BAR, SW + 40, BAR, 0x000000).setOrigin(0.5, 0).setScrollFactor(0).setDepth(D + 50));
  const barB = keep(sc.add.rectangle(SW / 2, SH + BAR, SW + 40, BAR, 0x000000).setOrigin(0.5, 1).setScrollFactor(0).setDepth(D + 50));
  sc.tweens.add({ targets: barT, y: 0, duration: 700, ease: "Cubic.out" });
  sc.tweens.add({ targets: barB, y: SH, duration: 700, ease: "Cubic.out" });
  const hint = keep(sc.add.text(SW - 16, SH - BAR / 2, "SKIP  ▸▸   (Space / Esc / tap)", { fontFamily: FONT, fontSize: "11px", color: "#cfc6e6" }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(D + 51).setAlpha(0));
  sc.tweens.add({ targets: hint, alpha: 0.65, duration: 600, delay: 900 });

  let card: Phaser.GameObjects.Container | null = null;
  const showCard = (kicker: string, head: string, body: string) => {
    hideCard();
    const c = keep(sc.add.container(0, SH - BAR - 16).setScrollFactor(0).setDepth(D + 40));
    const k = sc.add.text(34, 0, kicker, { fontFamily: FONT, fontSize: "11px", color: "#9fd3ff", fontStyle: "bold" }).setOrigin(0, 1);
    const h = sc.add.text(32, 0, head, { fontFamily: "Impact, sans-serif", fontSize: "38px", color: "#ffd23f", stroke: "#2a1400", strokeThickness: 6 }).setOrigin(0, 1);
    const b = sc.add.text(34, 0, body, { fontFamily: FONT, fontSize: "14px", color: "#f5f0ff", wordWrap: { width: 560 }, lineSpacing: 2 }).setOrigin(0, 1);
    b.setShadow(1, 1, "#000000", 2, false, true);
    // stack up from the bottom: body, headline, kicker
    const bodyH = body ? b.height : 0;
    h.y = -bodyH - (body ? 4 : 0);
    k.y = h.y - h.height + 6;
    const panelH = bodyH + h.height + k.height + 14;
    const panelW = Math.max(h.width, body ? b.width : 0) + 90;
    const g = sc.add.graphics();
    g.fillStyle(0x0b0614, 0.8).fillPoints([new Phaser.Math.Vector2(0, -panelH), new Phaser.Math.Vector2(panelW, -panelH), new Phaser.Math.Vector2(panelW - 34, 8), new Phaser.Math.Vector2(0, 8)], true);
    g.fillStyle(0xffd23f, 1).fillRect(18, -panelH + 8, 5, panelH - 8);
    g.fillStyle(0xff4fa3, 1).fillRect(34, h.y + 2, Math.min(h.width, 220), 2);
    c.add([g, k, h, b]);
    if (!body) b.setVisible(false);
    // slide in from the left, the headline a beat behind the panel
    c.x = -panelW - 40;
    sc.tweens.add({ targets: c, x: 0, duration: 520, ease: "Cubic.out" });
    h.setAlpha(0).x = 12;
    sc.tweens.add({ targets: h, x: 32, alpha: 1, duration: 420, delay: 160, ease: "Cubic.out" });
    b.setAlpha(0);
    sc.tweens.add({ targets: b, alpha: 1, duration: 380, delay: 300 });
    card = c;
  };
  const hideCard = () => {
    const c = card;
    if (!c) return;
    card = null;
    sc.tweens.add({ targets: c, x: -c.getBounds().width - 60, alpha: 0, duration: 360, ease: "Cubic.in", onComplete: () => c.destroy() });
  };

  const title = keep(sc.add.text(SW / 2, 150, "KRELFORD", { fontFamily: "Impact, sans-serif", fontSize: "104px", color: "#ffd23f", stroke: "#2a1400", strokeThickness: 12 }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 30).setAlpha(0));
  title.setShadow(0, 6, "#000000", 0, true, true);
  const sub = keep(sc.add.text(SW / 2, 222, "capital of Krelworld · population: the group chat, and some others", { fontFamily: FONT, fontSize: "16px", color: "#ffe9a8" }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 30).setAlpha(0));
  sub.setShadow(1, 1, "#000000", 3, false, true);

  // ---- the beats ----
  const beats: [number, () => void][] = [
    [0.05, () => synth.play("fly_wind", 0.8)],
    [2.0, () => synth.play("fly_dive", 0.85)],
    [LAST_HOLD_END + 0.1, () => synth.play("fly_whoosh", 0.8)],
    [TITLE_T - 0.25, slam],
    [TITLE_T + TITLE_HOLD - 0.3, () => {
      sc.tweens.add({ targets: [title, sub], alpha: 0, y: "-=24", duration: 500, ease: "Cubic.in" });
      synth.play("fly_dive", 0.7);
    }],
    [TITLE_T + TITLE_HOLD + 0.5, () => showCard("AND FINALLY", o.playerName.toUpperCase(), FLY_LAST)],
  ];
  FLY_STOPS.forEach((s, i) => {
    beats.push([STOP_T(i) - 0.15, () => showCard(`LANDMARK ${i + 1} / ${FLY_STOPS.length}`, s.head, capBody(s))]);
    beats.push([STOP_T(i) + HOLD + 0.2, hideCard]);
    if (i < FLY_STOPS.length - 1) beats.push([STOP_T(i) + HOLD - 0.05, () => synth.play("fly_whoosh", 0.75)]);
  });
  beats.sort((a, b) => a[0] - b[0]);
  function slam() {
    synth.play("fly_slam", 0.9);
    title.setAlpha(0).setScale(2.6);
    sc.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 300, ease: "Cubic.in", onComplete: () => {
      Juice.shake(sc, 260, calm ? 0.002 : 0.006);
      // a slow settle after the slam
      sc.tweens.add({ targets: title, scale: 1.04, duration: 1800, ease: "Sine.out" });
    } });
    sub.setAlpha(0).y = 240;
    sc.tweens.add({ targets: sub, alpha: 1, y: 222, duration: 500, delay: 380, ease: "Cubic.out" });
  }

  // ---- the frame ----
  const end: Aim = { x: o.end.x, y: o.end.y, d: FOCAL / o.end.zoom, p: 90, yaw: 0, r: 0 };
  let t = 0;
  let bi = 0;
  let prev: { x: number; y: number } | null = null;
  let speed = 0;
  const groundVerts = gm.vertices;
  const apronVerts = apron.vertices;
  const fogC = Phaser.Display.Color.ValueToColor(0xc9d8ef);
  const mixFog = (base: number, k: number) => {
    const r = (base >> 16) & 255;
    const g = (base >> 8) & 255;
    const b = base & 255;
    return (Math.round(lerp(r, fogC.red, k)) << 16) | (Math.round(lerp(g, fogC.green, k)) << 8) | Math.round(lerp(b, fogC.blue, k));
  };
  const frame = (dt: number) => {
    t += dt;
    // (for tests: how far in we are)
    (sc as unknown as { flyT?: number }).flyT = t;
    while (bi < beats.length && beats[bi][0] <= t) beats[bi++][1]();
    const pose = poseAt(Math.min(t, LAND_T), end);
    P.set(pose);
    // sky
    const hz = P.horizonY();
    sky.setPosition(SW / 2 - Math.sin(pose.roll) * (hz - SH / 2), SH / 2 + Math.cos(pose.roll) * (hz - SH / 2)).setRotation(pose.roll);
    // the cloud whiteout and how much ground shows (it's under the deck until we're through it)
    const inDeck = clamp(1 - Math.abs(pose.z - 2300) / 900, 0, 1);
    white.setAlpha(t < OPEN + 0.5 ? inDeck * (calm ? 0.45 : 0.7) : 0);
    const groundA = clamp((3200 - pose.z) / 900, 0, 1);
    // ground: the apron, then the town
    const fogAt = (zc: number) => clamp((zc - 2200) / 9000, 0, 0.75);
    for (let j = 0; j <= APR; j++)
      for (let i = 0; i <= APR; i++) {
        const v = apronVerts[j * (APR + 1) + i];
        const q = P.project(lerp(apronSpan.x0, apronSpan.x1, i / APR), lerp(apronSpan.y0, apronSpan.y1, j / APR), -1);
        v.x = q.x;
        v.y = -q.y;
        v.color = mixFog(0x3c6a33, fogAt(q.zc));
        v.alpha = groundA;
      }
    for (let j = 0; j <= GY; j++)
      for (let i = 0; i <= GX; i++) {
        const v = groundVerts[j * (GX + 1) + i];
        const q = P.project((o.worldW * i) / GX, (o.worldH * j) / GY, 0);
        v.x = q.x;
        v.y = -q.y;
        v.color = mixFog(0xffffff, fogAt(q.zc));
        v.alpha = groundA;
      }
    // haze along the horizon
    hazeG.clear();
    if (hz > -200 && groundA > 0) {
      hazeG.setPosition(SW / 2 - Math.sin(pose.roll) * (hz - SH / 2), SH / 2 + Math.cos(pose.roll) * (hz - SH / 2)).setRotation(pose.roll);
      hazeG.fillGradientStyle(0xdbe6f6, 0xdbe6f6, 0xdbe6f6, 0xdbe6f6, 0, 0, 0.85 * groundA, 0.85 * groundA).fillRect(-1200, -30, 2400, 30);
      hazeG.fillGradientStyle(0xdbe6f6, 0xdbe6f6, 0xdbe6f6, 0xdbe6f6, 0.85 * groundA, 0.85 * groundA, 0, 0).fillRect(-1200, 0, 2400, 120);
    }
    // the billboards lean up out of the ground as the camera comes down towards the horizon
    const lean = clamp((90 - pose.pitch / DEG) * 1.15, 0, 80) * DEG;
    const hx = Math.sin(pose.yaw);
    const hy = -Math.cos(pose.yaw);
    const lx = Math.cos(pose.yaw);
    const ly = Math.sin(pose.yaw);
    const up = Math.sin(lean);
    const back = Math.cos(lean);
    const bv = bm.vertices;
    for (const b of boards) {
      // turned to face the camera's heading, by up to how far it's leaned (flat on the ground, it lies as drawn)
      const k = clamp(lean / (40 * DEG), 0, 1);
      const ax = lerp(1, lx, k);
      const ay = lerp(0, ly, k);
      const al = Math.hypot(ax, ay) || 1;
      const ex = ax / al;
      const ey = ay / al;
      const bx = lerp(0, hx, k);
      const by = lerp(-1, hy, k);
      const bl = Math.hypot(bx, by) || 1;
      const nx = bx / bl;
      const ny = by / bl;
      const pts = [
        [b.x - ex * b.hw, b.y - ey * b.hw, 0],
        [b.x + ex * b.hw, b.y + ey * b.hw, 0],
        [b.x - ex * b.hw + nx * b.h * back, b.y - ey * b.hw + ny * b.h * back, b.h * up],
        [b.x + ex * b.hw + nx * b.h * back, b.y + ey * b.hw + ny * b.h * back, b.h * up],
      ];
      let minZ = Infinity;
      let sumZ = 0;
      for (let c = 0; c < 4; c++) {
        const q = P.project(pts[c][0], pts[c][1], pts[c][2]);
        const v = bv[b.vi + c];
        v.x = q.x;
        v.y = -q.y;
        minZ = Math.min(minZ, q.zc);
        sumZ += q.zc;
      }
      const far = sumZ / 4;
      const vis = minZ > NEAR + 10 ? groundA : 0;
      const col = mixFog(0xffffff, fogAt(far));
      for (let c = 0; c < 4; c++) {
        const v = bv[b.vi + c];
        v.alpha = vis;
        v.color = col;
        // depth: far first (larger z is drawn earlier)
        v.z = clamp(far / 30, 0, 990);
      }
    }
    // clouds: in front of the subject, or behind it (past the point we're looking at)
    const aimD = Math.max(400, pose.z / Math.max(0.15, Math.sin(pose.pitch)));
    for (const c of clouds) {
      const q = P.project(c.x, c.y, c.z);
      if (q.zc < 120 || q.zc > 16000) {
        c.img.setVisible(false);
        continue;
      }
      const s = (FOCAL * c.size) / q.zc / c.img.width;
      if (q.x < -c.img.width * s || q.x > SW + c.img.width * s || q.y < -c.img.height * s || q.y > SH + c.img.height * s) {
        c.img.setVisible(false);
        continue;
      }
      const near = clamp((q.zc - 120) / 380, 0, 1);
      const farA = clamp((16000 - q.zc) / 5000, 0, 1);
      c.img
        .setVisible(true)
        .setPosition(q.x, q.y)
        .setScale(s)
        .setRotation(pose.roll)
        .setAlpha(c.a * near * farA)
        .setDepth(q.zc > aimD ? D + 3.5 - q.zc / 1e6 : D + 5 - q.zc / 1e6);
    }
    // birds
    birdsG.clear();
    for (const f of flocks) {
      const ft = t - f.t0;
      if (ft < 0 || ft > 6) continue;
      for (const b of f.birds) {
        const q = P.project(f.x + f.vx * ft + b.ox, f.y + f.vy * ft + b.oy, f.z + b.oz + Math.sin(ft * 2 + b.ph) * 6);
        if (q.zc < 60) continue;
        const sz = clamp((FOCAL * 9) / q.zc, 1.5, 14);
        const flap = Math.sin(ft * 14 + b.ph) * 0.8;
        birdsG.lineStyle(Math.max(1, sz / 4), 0x1a1424, 0.9);
        birdsG.beginPath();
        birdsG.moveTo(q.x - sz, q.y - sz * flap * 0.6);
        birdsG.lineTo(q.x, q.y);
        birdsG.lineTo(q.x + sz, q.y - sz * flap * 0.6);
        birdsG.strokePath();
      }
    }
    // sun shafts: strongest looking east-ish, and not inside a cloud
    shafts.setAlpha((0.55 + 0.45 * Math.cos(pose.yaw - 0.7)) * (1 - inDeck) * (0.6 + 0.4 * Math.sin(t * 0.7)));
    shafts.setRotation(Math.sin(t * 0.35) * 0.04 + pose.roll);
    // speed: how fast the middle of the screen is sweeping over the ground (screen px/s), as streaks
    const cur = { x: pose.x, y: pose.y };
    if (prev && dt > 0) {
      const v = Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt / Math.max(300, aimD);
      speed = lerp(speed, v, 0.2);
    }
    prev = cur;
    streaks.clear();
    const sk = clamp((speed - 0.9) / 2.2, 0, 1) * (calm ? 0.5 : 1);
    if (sk > 0.02)
      for (const p of streakP) {
        p.r += dt * 1500 * p.s;
        if (p.r > 620) {
          p.r = 80 + Math.random() * 120;
          p.a = Math.random() * Math.PI * 2;
        }
        const len = 40 + 120 * sk;
        streaks.lineStyle(2, 0xffffff, 0.35 * sk * clamp((p.r - 80) / 120, 0, 1));
        streaks.lineBetween(SW / 2 + Math.cos(p.a) * p.r, SH / 2 + Math.sin(p.a) * p.r * 0.7, SW / 2 + Math.cos(p.a) * (p.r + len), SH / 2 + Math.sin(p.a) * (p.r + len) * 0.7);
      }
  };

  return new Promise((resolve) => {
    let done = false;
    let skipped = false;
    const onUpdate = (_time: number, delta: number) => {
      if (done) return;
      frame(Math.min(delta, 100) / 1000);
      if (t >= LAND_T && !finishing) finish(false);
    };
    let finishing = false;
    const finish = (skip: boolean) => {
      if (finishing) return;
      finishing = true;
      skipped = skip;
      off();
      // the live camera takes over exactly where the flight ends
      sc.cameras.main.centerOn(o.end.x, o.end.y);
      const fade = keep(sc.add.rectangle(SW / 2, SH / 2, SW + 40, SH + 40, 0x000000, 0).setScrollFactor(0).setDepth(D + 60));
      if (skip) {
        // a quick dip to black, then straight to the end
        sc.tweens.add({ targets: fade, alpha: 1, duration: 260, onComplete: () => teardown(fade) });
        return;
      }
      // played out: the 3D view is now the live camera's view, so just let the live world show through
      for (const g of hidden) if (g.active) (g as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
      hideCard();
      sc.tweens.add({ targets: barT, y: -BAR, duration: 500, ease: "Cubic.in" });
      sc.tweens.add({ targets: barB, y: SH + BAR, duration: 500, ease: "Cubic.in" });
      sc.tweens.add({ targets: [sky, apron, gm, bm, hazeG, birdsG, shafts, streaks, white, hint, ...clouds.map((c) => c.img)], alpha: 0, duration: FADE * 1000, onComplete: () => sc.time.delayedCall(250, () => teardown(null)) });
    };
    const teardown = (fade: Phaser.GameObjects.Rectangle | null) => {
      if (done) return;
      done = true;
      for (const g of hidden) if (g.active) (g as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
      card = null;
      for (const g of made) if (g !== fade && g.active) g.destroy();
      for (const k of [gKey, bKey]) if (sc.textures.exists(k)) sc.textures.remove(k);
      if (fade) {
        sc.tweens.add({ targets: fade, alpha: 0, duration: 380, delay: 60, onComplete: () => fade.destroy() });
      }
      resolve({ skipped });
    };
    const skipKey = () => {
      if (t > 0.5) finish(true);
    };
    const kb = sc.input.keyboard;
    kb?.on("keydown-SPACE", skipKey);
    kb?.on("keydown-ESC", skipKey);
    kb?.on("keydown-ENTER", skipKey);
    sc.input.on("pointerdown", skipKey);
    const off = () => {
      sc.events.off("update", onUpdate);
      kb?.off("keydown-SPACE", skipKey);
      kb?.off("keydown-ESC", skipKey);
      kb?.off("keydown-ENTER", skipKey);
      sc.input.off("pointerdown", skipKey);
    };
    // if the scene goes away mid-flight, just stop
    sc.events.once("shutdown", () => {
      off();
      done = true;
      resolve({ skipped: true });
    });
    sc.events.on("update", onUpdate);
    frame(0);
  });

  /**
   * addVertices makes a vertex per index; make the faces share one vertex per point instead, so `m.vertices[i]` is
   * point i and moving it moves every triangle that uses it.
   */
  function shareVerts(m: Phaser.GameObjects.Mesh, ix: number[], n: number) {
    const all = m.vertices;
    const pts: Phaser.Geom.Mesh.Vertex[] = new Array(n);
    ix.forEach((p, k) => (pts[p] ??= all[k]));
    m.faces.forEach((f, k) => {
      f.vertex1 = pts[ix[k * 3]];
      f.vertex2 = pts[ix[k * 3 + 1]];
      f.vertex3 = pts[ix[k * 3 + 2]];
    });
    m.vertices = pts;
  }

  /** A (cols x rows) grid of vertices over [u0..u1] x [v0..v1], in row-major order, with its triangles. */
  function gridMesh(m: Phaser.GameObjects.Mesh, cols: number, rows: number, u0: number, v0: number, u1: number, v1: number, color: number) {
    const v: number[] = [];
    const uv: number[] = [];
    const ix: number[] = [];
    const cs: number[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        v.push(0, 0);
        uv.push(lerp(u0, u1, i / cols), lerp(v0, v1, j / rows));
        cs.push(color);
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        ix.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    m.addVertices(v, uv, ix, false, undefined, cs);
    shareVerts(m, ix, (cols + 1) * (rows + 1));
    m.hideCCW = false;
    m.setOrtho(SW, SH);
    m.ignoreDirtyCache = true;
  }
}
