import Phaser from "phaser";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import type { DungeonDef } from "../../../data/dungeons";
import { type BoardSpec, type CamKey, type ShotCtx, type Sprite3D, camPath, clamp, mixC, playShot, span } from "../../gfx/Pseudo3D";
import { type TownMood, MOODS, townSet } from "./townSet";
import { crobleyFloor3d } from "./crobleyFactory3d";

/**
 * The establishing swoop before a dungeon's anime entry card (gfx/DungeonIntro.ts): a quick pseudo-3D flight over
 * Krelford onto the building the dungeon is in, as seen from the town (or, for places that aren't in town, a fitting
 * stand-in). Once per dungeon per playthrough (a save flag), skippable, about four seconds, then the card.
 * Da Drongus Dungeon has its own Chapter 7 arrival (citadel/citadel3d.ts), so it gets none here.
 */

type Fx = "lamp" | "mind";
interface Plan {
  /** a Hub building id, or "plane" (the runway east of town), "crater" (the middle of the ruins) */
  at: string;
  mood: TownMood;
  /** lower-third over the swoop */
  where: string;
  fx?: Fx;
  ruined?: boolean;
}

const PLANS: Record<string, Plan> = {
  wildern: { at: "WILDERN", mood: "day", where: "KRELFORD · WILDERN ACADEMY" },
  polson_towers: { at: "POLSON_ROAD", mood: "dusk", where: "KRELFORD · POLSON TOWERS" },
  ministry: { at: "MINISTRY", mood: "day", where: "KRELFORD · THE MINISTRY OF BONER CONTROL" },
  crobley_factory: { at: "CROBLEY_FACTORY", mood: "dusk", where: "KRELFORD · CROBLEY CORP HQ" },
  airport: { at: "plane", mood: "day", where: "KRELFORD INTERNATIONAL · FLIGHT KR-069" },
  krelford_finale: { at: "crater", mood: "ruin", where: "WHAT'S LEFT OF KRELFORD", ruined: true },
  arena_brand: { at: "UNIVERSITY", mood: "day", where: "KRELFORD UNIVERSITY · THE SPORTS HALL" },
  arena_troll: { at: "PUB", mood: "night", where: "THE KREZZ ARMS · THE BACK ROOM" },
  arena_flatmate: { at: "OLD_FLAT", mood: "day", where: "YOUR OLD FLAT · THE CUPBOARD" },
  arena_rival: { at: "GYM", mood: "dusk", where: "KRUNCH GYM" },
  arena_lukemind: { at: "POLICE", mood: "night", where: "KRELFORD CONSTABULARY · A CELL · LULON'S HEAD", fx: "mind" },
  arena_sanmik: { at: "PUB", mood: "night", where: "THE KREZZ ARMS · THE MAGIC LAMP", fx: "lamp" },
  sanmik_hangout: { at: "PUB", mood: "night", where: "THE KREZZ ARMS · THE MAGIC LAMP", fx: "lamp" },
};

const LENGTH = 4.0;
const flagKey = (id: string) => `p3d_swoop_${id}`;

/** Has this dungeon a swoop to play (and not played yet this playthrough)? */
export function wantsSwoop(d: DungeonDef) {
  if (!G.hasRun()) return false;
  if (d.id === "citadel") return false;
  if (!PLANS[d.id] && d.id !== "rik_colon") return false;
  return !G.s.flags[flagKey(d.id)];
}

/**
 * Play the swoop for `d` over `sc` (once per playthrough) and wait for it. Safe to call from create(). The scene
 * underneath is paused while it plays (so nothing moves in the room behind it); time spent watching is given back
 * to a dungeon-wide countdown.
 */
export async function dungeonSwoop(sc: Phaser.Scene, d: DungeonDef): Promise<void> {
  if (!wantsSwoop(d)) return;
  G.s.flags[flagKey(d.id)] = true;
  // called from create(): wait until the scene is running
  for (let i = 0; i < 60 && sc.sys && !sc.sys.isActive() && !sc.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 20));
  const t0 = Date.now();
  let paused = false;
  const ext = await playShot(sc, {
    length: d.id === "rik_colon" ? 3.6 : LENGTH,
    fromBlack: true,
    fadeIn: 420,
    toBlack: true,
    fadeOut: 320,
    onCovered: () => {
      if (sc.sys.isActive()) {
        sc.scene.pause();
        paused = true;
      }
    },
    build: (c) => (d.id === "rik_colon" ? rikBuild(c) : townBuild(c, PLANS[d.id])),
  });
  // the Crobley factory: then inside, a glide along the factory floor in full swing (unless they skipped the swoop)
  if (d.id === "crobley_factory" && paused && !ext.skipped && sc.sys && sc.sys.isPaused()) await crobleyFloor3d(sc);
  if (paused && sc.sys && sc.sys.isPaused()) sc.scene.resume();
  if (G.rt.timerEnd) G.rt.timerEnd += Date.now() - t0;
}

// ------------------------------------------------------------------------------------------------ over the town

function townBuild(c: ShotCtx, p: Plan) {
  const { st, sc, calm } = c;
  const extras: BoardSpec[] = [];
  const PLANE = { x: 3350, y: 1660 };
  if (p.at === "plane") {
    const k = sc.textures.exists("p_plane_hd") ? "p_plane_hd" : sc.textures.exists("hd_plane") ? "hd_plane" : null;
    if (k) {
      const src = sc.textures.get(k).getSourceImage();
      extras.push({ key: k, x: PLANE.x, y: PLANE.y, w: 760, h: (760 * src.height) / src.width });
    }
  }
  if (p.at === "crater" && sc.textures.exists("r_crater")) {
    // the crater where the Great Tap was (the Hub's ruin prop), lying flat
    const src = sc.textures.get("r_crater").getSourceImage();
    const w = src.width * 2.4;
    const h = src.height * 2.4;
    extras.push({ key: "r_crater", x: 1280, y: 830, w, h, flat: [1280 - w / 2, 830 - h / 2, 1280 + w / 2, 830 + h / 2] });
  }
  const set = townSet(c, { mood: p.mood, ruined: p.ruined, extras, runway: p.at === "plane" });
  // what we're flying to: its base centre and size
  const tg =
    p.at === "plane"
      ? { x: PLANE.x, y: PLANE.y, w: 760, h: extras.length ? extras[0].h : 260 }
      : p.at === "crater"
        ? { x: 1280, y: 830, w: 620, h: 260 }
        : (set.at[p.at] ?? { x: 1280, y: 900, w: 300, h: 220 });
  // in from over the middle of town, down onto its front
  const side = tg.x < 1280 ? 1 : -1;
  const D = Math.max(tg.h * 2.0, tg.w * 1.3);
  const keys: [number, CamKey][] = [
    [0, { x: tg.x + side * 1500, y: tg.y + 1650, z: 1150, tx: tg.x + side * 200, ty: tg.y - 100, tz: 0, r: 0 }],
    [1.8, { x: tg.x + side * 560, y: tg.y + 820, z: 420, tx: tg.x + side * 30, ty: tg.y, tz: tg.h * 0.3, r: -side * 5 }],
    [3.5, { x: tg.x + side * 40, y: tg.y + D, z: tg.h * 0.42, tx: tg.x, ty: tg.y - 10, tz: tg.h * 0.55, r: 0 }],
  ];
  if (p.at === "crater") {
    // over the ruins, low through the smoke, onto the crater where the Great Tap was
    keys[0][1] = { x: 1280 - 1300, y: 2500, z: 900, tx: 1280, ty: 900, tz: 0 };
    keys[1][1] = { x: 1280 - 500, y: 1700, z: 360, tx: 1280, ty: 900, tz: 40, r: 4 };
    keys[2][1] = { x: 1280, y: 1300, z: 240, tx: 1280, ty: 800, tz: 60 };
  }
  // a glow on the place, so the eye goes to it
  const mark = st.addSprite(set.glow, tg.x, tg.y + 20, tg.h * 0.4, tg.w * 1.4, { add: true, tint: p.mood === "ruin" ? 0xff5a1a : 0xffe7a0, alpha: 0, layer: "back" });
  // the lamp: gold sparkles spiralling round the pub door; the mind: the station goes teal and swims
  const sparks: { s: Sprite3D; a: number; r: number; v: number }[] = [];
  if (p.fx)
    for (let i = 0; i < (calm ? 12 : 22); i++)
      sparks.push({
        s: st.addSprite(set.glow, tg.x, tg.y + 30, 0, 40, { add: true, tint: p.fx === "lamp" ? (i % 3 ? 0xffd23f : 0xfff3b0) : i % 2 ? 0x2dd4bf : 0xf472b6, alpha: 0, layer: "front" }),
        a: (i / 22) * Math.PI * 2,
        r: 60 + (i % 5) * 26,
        v: 1.6 + (i % 4) * 0.4,
      });
  const veil = st.keep(sc.add.rectangle(480, 270, 1040, 620, p.fx === "lamp" ? 0xffe9a8 : 0x2dd4bf, 0).setDepth(25));
  if (p.fx === "mind") veil.setBlendMode(Phaser.BlendModes.ADD);
  sc.time.delayedCall(450, () => c.caption(p.where, { hold: 2.4, color: p.mood === "ruin" ? "#ffb08a" : "#ffffff" }));
  synth.play("fly_wind", 0.55);
  sc.time.delayedCall(1300, () => synth.play("fly_whoosh", 0.6));
  if (p.fx === "lamp") sc.time.delayedCall(2600, () => synth.play("ding", 0.6));
  if (p.fx === "mind") sc.time.delayedCall(2500, () => synth.play("wonk", 0.6));
  const light0 = st.light;
  return (t: number, dt: number) => {
    set.tick(t, dt);
    mark.alpha = 0.35 * span(t, 1.2, 2.6) * (0.85 + 0.15 * Math.sin(t * 3));
    if (p.fx) {
      const k = span(t, 2.2, 3.2);
      for (const sp of sparks) {
        sp.a += sp.v * dt * (p.fx === "lamp" ? 1.6 : 0.9);
        const r = sp.r * (1 - 0.5 * span(t, 3.0, 3.9));
        sp.s.x = tg.x + Math.cos(sp.a) * r;
        sp.s.y = tg.y + 60 + Math.sin(sp.a) * r * 0.5;
        sp.s.z = 20 + ((t * 40 * sp.v + sp.r) % (tg.h * 0.9));
        sp.s.alpha = 0.9 * k;
      }
      // pulled in: a gold whiteout for the lamp (soft with calm flashes), the set swimming teal for the mind
      if (p.fx === "lamp") veil.setAlpha((calm ? 0.35 : 0.85) * span(t, 3.2, 3.95));
      else {
        st.light = mixC(light0, 0x7af0e0, 0.5 * k + (calm ? 0 : 0.12 * k * Math.sin(t * 5)));
        veil.setAlpha(0.25 * span(t, 3.0, 3.95));
      }
    }
    const pose = camPath(keys, clamp(t, 0, keys[keys.length - 1][0]));
    if (p.fx === "mind") pose.roll += 0.08 * span(t, 2.4, 4) * Math.sin(t * 3);
    return pose;
  };
}

// ------------------------------------------------------------------------------------------------ Uncle Rik

/** Into the transverse colon: shrunk, on the decking of a Catford back yard, looking up at Uncle Rik, then in. */
function rikBuild(c: ShotCtx) {
  const { st, sc, calm } = c;
  const m = MOODS.night;
  st.maxLean = 90;
  st.light = 0xd8c8ff;
  st.fog = { color: 0x14185a, start: 900, span: 4200, max: 0.7 };
  // the sky is the colour of Pepsi Max
  st.setSky({ top: 0x02030f, horizon: 0x1d3ec8, stars: 60 });
  st.addGround({ x0: -6000, y0: -6000, x1: 6000, y1: 6000, cols: 36, rows: 36, color: 0x1a2a18, depth: 1 });
  const gk = st.groundTexture("deck", 512, 512, (dt) => {
    const g = sc.make.graphics({}, false);
    g.fillStyle(0x6b4527, 1).fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) g.fillStyle(y % 64 ? 0x5a3a20 : 0x7a5030, 1).fillRect(0, y + 2, 512, 28);
    dt.draw(g);
    g.destroy();
  });
  st.addGround({ key: gk, rt: true, x0: -1400, y0: -900, x1: 1400, y1: 1900, cols: 10, rows: 10, depth: 1.5 });
  const RW = 1000;
  const specs: BoardSpec[] = [];
  if (sc.textures.exists("boss_rik")) specs.push({ key: "boss_rik", frame: 0, x: 0, y: 0, w: RW, h: (RW * 124) / 119 });
  const rh = (RW * 124) / 119;
  if (sc.textures.exists("hd_lamp")) specs.push({ key: "hd_lamp", x: -620, y: 260, w: 140, h: 140 });
  st.addBoards(specs);
  // fairy lights strung across the yard
  const glow = st.softDot("glow", 0.3);
  const cols = [0xff4fd8, 0x22d3ee, 0xfacc15, 0x4ade80];
  const bulbs: Sprite3D[] = [];
  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    bulbs.push(st.addSprite(glow, -1300 + u * 2600, 700, 520 - Math.sin(u * Math.PI) * 160, 60, { add: true, tint: cols[i % 4], alpha: 0.8 }));
  }
  void m;
  const keys: [number, CamKey][] = [
    [0, { x: 260, y: 1700, z: 30, tx: 0, ty: 0, tz: rh * 0.55, r: -3 }],
    [1.7, { x: 140, y: 950, z: 120, tx: 0, ty: 0, tz: rh * 0.7, r: 2 }],
    [3.2, { x: 0, y: 260, z: rh * 0.72, tx: 0, ty: -40, tz: rh * 0.74, r: 0 }],
  ];
  sc.time.delayedCall(350, () => c.caption("CATFORD · UNCLE RIK (YOU ARE VERY SMALL NOW)", { hold: 2.2 }));
  synth.play("fly_wind", 0.5);
  sc.time.delayedCall(1500, () => synth.play("fly_dive", 0.6));
  sc.time.delayedCall(2700, () => synth.play("gulp", 0.8));
  return (t: number) => {
    bulbs.forEach((b, i) => (b.alpha = 0.6 + (calm ? 0.1 : 0.3) * Math.sin(t * 4 + i)));
    return camPath(keys, Math.min(t, 3.2));
  };
}
