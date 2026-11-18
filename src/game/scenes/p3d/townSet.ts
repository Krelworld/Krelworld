import Phaser from "phaser";
import { G } from "../../G";
import { type BoardSpec, type ShotCtx, type SkyOpts, type Sprite3D } from "../../gfx/Pseudo3D";

/**
 * Krelford as a pseudo-3D set (gfx/Pseudo3D.ts), built from the art without the Hub running: the Hub's streets on
 * a ground texture, every building stood up as a cut-out where the Hub puts it, trees in the Hub's loose rows, and
 * lamps. Used by the establishing shots that need the town from outside (dungeon entries).
 *
 * Coordinates are the Hub's own (2560 x 1792, x east, y south). The layout mirrors HubScene's BUILDINGS / roads; it
 * is copied rather than imported so the Hub stays untouched.
 */

export const TOWN_W = 2560;
export const TOWN_H = 1792;

export interface TownBuilding {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  door: { x: number; y: number };
}

/** HubScene's BUILDINGS (position, footprint, door), and the name on the sign. */
export const TOWN_BUILDINGS: TownBuilding[] = [
  { id: "CITADEL", name: "DA DRONGUS DUNGEON", x: 1280, y: 110, w: 380, h: 170, door: { x: 1280, y: 195 } },
  { id: "TOWN_HALL", name: "KRELFORD TOWN HALL", x: 1280, y: 420, w: 420, h: 230, door: { x: 1280, y: 535 } },
  { id: "ARCHIVE", name: "THE HISTORICAL ARCHIVE", x: 1900, y: 420, w: 300, h: 200, door: { x: 1900, y: 520 } },
  { id: "BAN_TRIBUNAL", name: "THE BAN TRIBUNAL", x: 660, y: 420, w: 280, h: 190, door: { x: 660, y: 515 } },
  { id: "PUB", name: "THE KREZZ ARMS", x: 560, y: 820, w: 300, h: 200, door: { x: 560, y: 920 } },
  { id: "HOME", name: "HOME", x: 520, y: 1250, w: 260, h: 180, door: { x: 520, y: 1340 } },
  { id: "WILDERN", name: "WILDERN ACADEMY", x: 1280, y: 1300, w: 420, h: 220, door: { x: 1280, y: 1410 } },
  { id: "MINISTRY", name: "THE MINISTRY OF BONER CONTROL", x: 2000, y: 1270, w: 340, h: 220, door: { x: 2000, y: 1380 } },
  { id: "UNIVERSITY", name: "KRELFORD UNIVERSITY", x: 840, y: 1260, w: 260, h: 180, door: { x: 840, y: 1350 } },
  { id: "GYM", name: "KRUNCH GYM", x: 2350, y: 600, w: 240, h: 170, door: { x: 2350, y: 685 } },
  { id: "FIXER_UPPER", name: "THE FIXER-UPPER", x: 2350, y: 1300, w: 220, h: 160, door: { x: 2350, y: 1380 } },
  { id: "BOOTH", name: "THE BOOTH", x: 940, y: 680, w: 150, h: 110, door: { x: 940, y: 735 } },
  { id: "ABANDONED", name: "THE ABANDONED BUILDING", x: 1000, y: 1660, w: 220, h: 140, door: { x: 1000, y: 1730 } },
  { id: "POLICE", name: "KRELFORD CONSTABULARY", x: 1700, y: 1670, w: 240, h: 130, door: { x: 1700, y: 1735 } },
  { id: "CROBLEY_FACTORY", name: "CROBLEY CORP HQ", x: 1660, y: 1255, w: 288, h: 224, door: { x: 1660, y: 1367 } },
  { id: "OLD_FLAT", name: "YOUR OLD FLAT", x: 700, y: 1650, w: 200, h: 130, door: { x: 700, y: 1715 } },
  { id: "POLSON_ROAD", name: "POLSON TOWERS", x: 2470, y: 970, w: 168, h: 160, door: { x: 2470, y: 1050 } },
];

const ROADS: [number, number, number, number][] = [
  [80, 780, TOWN_W - 80, 90],
  [1235, 200, 90, 1500],
  [300, 1500, 2000, 70],
  [500, 560, 1700, 60],
  [200, 1000, 70, 700],
  [2340, 1045, 220, 105],
  [2340, 860, 60, 200],
];

export type TownMood = "day" | "dusk" | "night" | "ruin";

export const MOODS: Record<TownMood, { sky: SkyOpts; fog: number; light: number; apron: number; lamps: number }> = {
  day: { sky: { top: 0x3d64a8, horizon: 0xdce8f8 }, fog: 0xc9d8ef, light: 0xffffff, apron: 0x3c6a33, lamps: 0 },
  dusk: { sky: { top: 0x2a1f4d, horizon: 0xf08a5d }, fog: 0x8a5a78, light: 0xffd8bc, apron: 0x2e4a2a, lamps: 0.35 },
  night: { sky: { top: 0x07020f, horizon: 0x2a0f3d, stars: 120 }, fog: 0x1a1030, light: 0x8a90c4, apron: 0x162016, lamps: 0.6 },
  ruin: { sky: { top: 0x0a0306, horizon: 0x5a1a10, stars: 30 }, fog: 0x2a1210, light: 0xa07868, apron: 0x221a14, lamps: 0 },
};

export interface TownSet {
  /** where each building stands in the set: base centre, its board's width and height */
  at: Record<string, { x: number; y: number; w: number; h: number }>;
  glow: string;
  dot: string;
  /** per-frame: fires flicker, lamps breathe */
  tick: (t: number, dt: number) => void;
  /** extra cut-outs placed in the set (in `extras` order) */
  extras: ReturnType<ShotCtx["st"]["addBoards"]>;
}

/** The Hub's key for a building now (the ruins after they've gone). */
function buildingKey(sc: Phaser.Scene, id: string) {
  const f = G.hasRun() ? G.s.flags : {};
  if (id === "CROBLEY_FACTORY" && f.crobley_factory_destroyed && sc.textures.exists("bld_CROBLEY_FACTORY_RUIN")) return "bld_CROBLEY_FACTORY_RUIN";
  if (id === "WILDERN" && f.wildern_destroyed && sc.textures.exists("bld_WILDERN_RUIN")) return "bld_WILDERN_RUIN";
  return `bld_${id}`;
}

/**
 * Build Krelford in the shot's stage. `ruined`: what's left of it in Chapter 7 (stumps of buildings, fires).
 * `extras`: more cut-outs (a plane on the runway…), stood up with the town so they sort with it.
 */
export function townSet(c: ShotCtx, o: { mood: TownMood; ruined?: boolean; extras?: BoardSpec[]; runway?: boolean }): TownSet {
  const { st, sc, calm } = c;
  const mood = MOODS[o.mood];
  st.maxLean = 90;
  st.light = mood.light;
  st.fog = { color: mood.fog, start: 1100, span: 5200, max: o.mood === "day" ? 0.6 : 0.8 };
  st.setSky(mood.sky);
  st.addGround({ x0: -12000, y0: -12000, x1: 14000, y1: 14000, cols: 10, rows: 10, color: mood.apron, depth: 1 });
  const has = (k: string) => sc.textures.exists(k);
  // the streets, as the Hub lays them (scorched in the ruins)
  const S = 0.4;
  const PAD = 600;
  const GW = TOWN_W + PAD * 2 + (o.runway ? 1400 : 0);
  const GH = TOWN_H + PAD * 2;
  const gk = st.groundTexture("town", Math.ceil(GW * S), Math.ceil(GH * S), (dt) => {
    dt.camera.setOrigin(0, 0);
    dt.camera.setZoom(S);
    dt.camera.setScroll(-PAD, -PAD);
    const tmp: Phaser.GameObjects.GameObject[] = [];
    const t = <T extends Phaser.GameObjects.GameObject>(g: T) => (tmp.push(g), g);
    const scorch = (x: Phaser.GameObjects.TileSprite, tint: number) => (o.ruined ? x.setTint(tint) : x);
    const tile = (k: string, x: number, y: number, w: number, h: number, fallback: number, tint: number) => {
      if (has(k)) dt.draw(t(scorch(new Phaser.GameObjects.TileSprite(sc, x, y, w, h, k).setOrigin(0), tint)));
      else dt.draw(t(new Phaser.GameObjects.Rectangle(sc, x, y, w, h, fallback).setOrigin(0)));
    };
    tile("tile_grass", -PAD, -PAD, GW, GH, 0x3c6a33, 0x3b2f27);
    for (const [x, y, w, h] of ROADS) tile("tile_road", x, y, w, h, 0x4a4a52, 0x5a4c48);
    tile("tile_cobble", 1060, 650, 440, 340, 0x6b6b72, 0x5a4c48);
    // the docks, and (for the airport) the runway east of town
    tile("tile_sea", -PAD, 1700, 560 + PAD, 92 + PAD, 0x1e4b7a, 0x1e3048);
    if (o.runway) {
      dt.draw(t(new Phaser.GameObjects.Rectangle(sc, 2600, 1530, 1800, 240, 0x3a3a40).setOrigin(0)));
      const g = t(new Phaser.GameObjects.Graphics(sc));
      for (let x = 2640; x < 4400; x += 120) g.fillStyle(0xf5f5f5, 0.9).fillRect(x, 1645, 60, 8);
      g.fillStyle(0xfacc15, 0.9).fillRect(2600, 1530, 1800, 6).fillRect(2600, 1764, 1800, 6);
      dt.draw(g);
    }
    // the town's edge fades into the land round it
    const edge = t(new Phaser.GameObjects.Graphics(sc));
    const ac = mood.apron;
    edge.fillGradientStyle(ac, ac, ac, ac, 1, 1, 0, 0).fillRect(-PAD, -PAD, GW, PAD);
    edge.fillGradientStyle(ac, ac, ac, ac, 0, 0, 1, 1).fillRect(-PAD, TOWN_H, GW, PAD);
    edge.fillGradientStyle(ac, ac, ac, ac, 1, 0, 1, 0).fillRect(-PAD, -PAD, PAD, GH);
    edge.fillGradientStyle(ac, ac, ac, ac, 0, 1, 0, 1).fillRect(GW - PAD * 2, -PAD, PAD, GH);
    dt.draw(edge);
    for (const g of tmp) g.destroy();
  });
  st.addGround({ key: gk, rt: true, x0: -PAD, y0: -PAD, x1: GW - PAD, y1: GH - PAD, cols: 18, rows: 14, depth: 1.5 });

  // the buildings, the trees, and anything extra (one atlas, so they sort together)
  const f = G.hasRun() ? G.s.flags : {};
  const towerUp = !!f.drongus_dungeon_risen && !f.citadel_fallen;
  const specs: BoardSpec[] = [];
  const at: TownSet["at"] = {};
  for (const b of TOWN_BUILDINGS) {
    if (b.id === "CITADEL" && !towerUp) continue;
    const key = buildingKey(sc, b.id);
    if (!has(key)) continue;
    const src = sc.textures.get(key).getSourceImage();
    const w = b.id === "CITADEL" ? 520 : b.w;
    const h = (w * src.height) / src.width;
    const y = b.y + b.h * 0.45;
    if (o.ruined && b.id !== "CITADEL") {
      // a stump: the bottom of the building, blackened
      const ch = Math.round(src.height * 0.42);
      specs.push({ key, crop: [0, src.height - ch, src.width, ch], x: b.x, y, w, h: (w * ch) / src.width, tint: 0x6a5048 });
      at[b.id] = { x: b.x, y, w, h: (w * ch) / src.width };
    } else {
      specs.push({ key, x: b.x, y, w, h });
      at[b.id] = { x: b.x, y, w, h };
    }
  }
  const near = (x: number, y: number) =>
    TOWN_BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + 60 && y > b.y - b.h / 2 - 50 && y < b.y + b.h / 2 + 110) ||
    ROADS.some(([x0, y0, w, h]) => x > x0 - 40 && x < x0 + w + 40 && y > y0 - 50 && y < y0 + h + 40) ||
    (x > 1020 && x < 1540 && y > 610 && y < 1030);
  const rnd = new Phaser.Math.RandomDataGenerator(["krelford3d"]);
  const treeKey = o.ruined ? (has("r_deadtree") ? "r_deadtree" : null) : has("hd_tree") ? "hd_tree" : null;
  if (treeKey) {
    const ts = sc.textures.get(treeKey).getSourceImage();
    for (let gy = 90, row = 0; gy < TOWN_H - 120; gy += 230, row++)
      for (let gx = 70 + (row % 2) * 130; gx < TOWN_W - 40; gx += 260) {
        const x = gx + rnd.between(-14, 14);
        const y = gy + rnd.between(-10, 10);
        if (near(x, y)) continue;
        const k = !o.ruined && (row + gx) % 3 === 0 && has("hd_tree2") ? "hd_tree2" : treeKey;
        const w = rnd.between(78, 96);
        specs.push({ key: k, x, y: y + 14, w, h: (w * ts.height) / ts.width });
      }
    // a ring of trees out in the country, so the town doesn't end at a cliff
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const r = rnd.realInRange(1700, 2300);
      const w = rnd.between(90, 130);
      specs.push({ key: treeKey, x: 1280 + Math.cos(a) * r * 1.15, y: 900 + Math.sin(a) * r, w, h: (w * ts.height) / ts.width });
    }
  }
  const nMain = specs.length;
  specs.push(...(o.extras ?? []));
  const boards = st.addBoards(specs);
  const extras = boards.slice(boards.length - (o.extras?.length ?? 0));
  void nMain;

  // lights: lamps along the main road (at dusk / night), fires in the ruins
  const glow = st.softDot("glow", 0.3);
  const dot = st.softDot("dust", 0.55);
  const lamps: { s: Sprite3D; a: number }[] = [];
  if (mood.lamps)
    for (const [y0, x0, x1] of [[770, 160, 2480], [1495, 320, 2280], [555, 520, 2180]] as [number, number, number][])
      for (let x = x0; x < x1; x += 240) lamps.push({ s: st.addSprite(glow, x, y0, 46, 120, { add: true, tint: 0xffc070, alpha: mood.lamps }), a: mood.lamps });
  // windows lit at night
  if (o.mood === "night" || o.mood === "dusk")
    for (const id in at) {
      const b = at[id];
      lamps.push({ s: st.addSprite(glow, b.x, b.y + 4, b.h * 0.35, b.w * 0.9, { add: true, tint: 0xffb35c, alpha: mood.lamps * 0.5 }), a: mood.lamps * 0.5 });
    }
  const fires: { s: Sprite3D; ph: number; base: number }[] = [];
  if (o.ruined) {
    for (const id in at) {
      const b = at[id];
      for (let i = 0; i < 2; i++)
        fires.push({ s: st.addSprite(glow, b.x + rnd.between(-b.w * 0.3, b.w * 0.3), b.y - 6, b.h + 20, 150, { add: true, tint: rnd.pick([0xff7a1a, 0xff4a1a, 0xffb020]), alpha: 0.7 }), ph: rnd.frac() * 6, base: 150 });
    }
    for (let i = 0; i < 26; i++)
      fires.push({ s: st.addSprite(glow, rnd.between(100, TOWN_W - 100), rnd.between(150, TOWN_H - 150), 20, 110, { add: true, tint: 0xff6a1a, alpha: 0.55 }), ph: rnd.frac() * 6, base: 110 });
    // smoke, hanging over it
    for (let i = 0; i < 20; i++) st.addSprite(dot, rnd.between(0, TOWN_W), rnd.between(0, TOWN_H), rnd.between(260, 520), rnd.between(500, 900), { tint: 0x2a2224, alpha: 0.5 });
  }
  // clouds
  const clouds = ["fly_cloud_a", "fly_cloud_b", "fly_cloud_c"].filter(has);
  if (clouds.length && o.mood !== "ruin")
    for (let i = 0; i < 14; i++) {
      const a = rnd.realInRange(0, Math.PI * 2);
      const r = rnd.realInRange(1800, 5200);
      st.addSprite(rnd.pick(clouds), 1280 + Math.cos(a) * r, 900 + Math.sin(a) * r, rnd.realInRange(1700, 2600), rnd.realInRange(1100, 1900), { tint: o.mood === "day" ? 0xffffff : 0x4a3a62, alpha: 0.8, layer: "back" });
    }
  const tick = (t: number) => {
    for (const fi of fires) {
      const k = calm ? 0.06 : 0.18;
      fi.s.size = fi.base * (1 + k * Math.sin(t * (calm ? 3 : 11) + fi.ph) + k * 0.5 * Math.sin(t * 17 + fi.ph * 2));
    }
    lamps.forEach((l, i) => (l.s.alpha = l.a * (0.85 + 0.15 * Math.sin(t * 2 + i))));
  };
  return { at, glow, dot, tick, extras };
}
