// What stands in the world: PixelLab street furniture and vehicles at 32 px to the metre, the
// procedural buildings (see build.ts) on their real footprints, and the clutter that makes a
// match-day street look lived in. Everything at 1:1, so nothing is a different size of pixel.
import Phaser from "phaser";
import type { Venue } from "../stadium/layout";
import type { BuildingSpec } from "./build";
import { repaintSign } from "./build";
import EIGHT from "../../assets/world/eight.json";

export const KIT_KEYS = ["barrier", "bench", "bigscreen", "bin", "bollard", "burgervan", "cone", "crates", "door_pub", "door_shop", "door_steel", "flowerbox",
  "lamppost", "litter", "merchstall", "pallets", "phonebox", "policevan", "portaloo", "programmes", "puddle", "staffdoor", "ticketbooth", "turnstile",
  "pubtable", "fruitmachine", "pooltable", "pubtv", "pumps", "clothesrail", "shelves", "betscreens", "tree", "statue", "binbags", "aboard", "desk", "kitbench", "kitchen", "lockers", "dugout", "tvcamera", "stretcher", "cart",
  "shed", "skip", "parkedcar", "hamper", "medbed", "grate", "hatch", "scaffold", "piestand", "obtruck", "horsebox", "ladder", "kitbag", "canopy",
  "roofvent", "gantry", "skylight", "foodkiosk", "condiments", "tvpost", "urinal", "sinks", "massage", "tactics", "icebath", "boots", "showers", "kitpegs", "cornerflag", "pubchair", "detector",
  "kegs", "busstop", "manhole", "chippaper", "pigeons", "gritbin", "flagpole", "newsboard", "scarf", "doormat", "smokerbin",
  "headless_fan", "headless_steward", "headless_woman", "bricks", "window", "window_broken", "ladder_s", "door_shut", "door_open", "door_players",
  "shopcounter", "armycounter", "betcounter", "reception", "mannequin", "camomannequin", "brictable", "bookcase", "camorack", "ammoboxes", "betstand", "sofa", "bigplant", "luggage", "ladder_pub", "ladder_shop", "ladder_hotel", "ladder_stand", "turnstile_shut", "turnstile_open", "pawncounter", "tvstack", "guitarrack", "bikerack", "toiletsign"] as const;
export type KitKey = (typeof KIT_KEYS)[number];
/** Eight-way pictures (S, SE, E, NE, N, NW, W, SW in a row) for things that turn. */
export const WORLD_8 = ["coach", "lorry"] as const;

/** A picture in the world: its drawn part centred on x, its bottom edge on the ground line y. */
export interface Placement {
  id: string;
  key: KitKey | "floodlight";
  x: number;
  y: number;
  flip?: boolean;
  /** Lies on the ground (litter, puddles): under everyone's feet. */
  flat?: boolean;
  /** Inside this building: only seen once you're in it. */
  room?: string;
}

/** The PixelLab buildings: one picture each, roof above and front below, painted to the footprint.
 *  `px`: art pixels per world pixel (the pub and hotel are drawn at half size and doubled). `sign`: the
 *  blank fascia board in the picture (its own pixels), where the name is painted on. */
export const BLD_ART: Record<string, { px: number; sign?: { x: number; y: number; w: number; h: number; fg: string; shadow?: string } }> = {
  charity: { px: 1, sign: { x: 26, y: 281, w: 428, h: 40, fg: "#2f5d50", shadow: "rgba(0,0,0,0.25)" } },
  surplus: { px: 1, sign: { x: 64, y: 259, w: 374, h: 40, fg: "#2f3d22", shadow: "rgba(0,0,0,0.25)" } },
  bookies: { px: 1, sign: { x: 160, y: 288, w: 220, h: 24, fg: "#f2c94c", shadow: "rgba(0,0,0,0.5)" } },
  pub: { px: 2, sign: { x: 26, y: 237, w: 274, h: 14, fg: "#e8c25a", shadow: "rgba(0,0,0,0.5)" } },
  hotel: { px: 2, sign: { x: 108, y: 421, w: 80, h: 12, fg: "#f4f1ea", shadow: "rgba(0,0,0,0.5)" } },
  cabin: { px: 1, sign: { x: 206, y: 230, w: 54, h: 32, fg: "#1c2a1c" } },
};

export class WorldArt {
  /** The drawn part of each picture (px): left, right and the bottom row. */
  base: Record<string, { foot: number; left: number; right: number }> = {};

  constructor(private scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    for (const k of KIT_KEYS) scene.load.image(`k-${k}-src`, `kit/${k}.png`);
    for (const k of Object.keys(BLD_ART)) scene.load.image(`w-bld-${k}`, `world/bld-${k}.png`);
    for (const k of ["a", "b", "c"]) scene.load.image(`w-bay-${k}`, `world/bld-bay-${k}.png`);
    scene.load.spritesheet("fx-headburst", "world/fx-headburst.png", { frameWidth: 64, frameHeight: 64 });
    for (const k of ["pub", "charity", "surplus", "bookies", "hotel", "cabin", ...ROOM_WALLS]) scene.load.image(`w-wall-${k}`, `world/bld-wall-${k}.png`);
    scene.load.spritesheet("w-coach8", "world/coach-8.png", { frameWidth: 160, frameHeight: 160 });
    scene.load.spritesheet("w-lorry8", "world/lorry-8.png", { frameWidth: 128, frameHeight: 128 });
    scene.load.spritesheet("w-bike8", "world/bike-8.png", { frameWidth: 64, frameHeight: 64 });
    // Cars for the ring road, 168 px frames at 1:1.
    for (const k of EIGHT) if (k !== "coach" && k !== "lorry" && k !== "bike") scene.load.spritesheet(`w-${k}8`, `world/${k}-8.png`, { frameWidth: 168, frameHeight: 168 });
  }

  img(k: string): HTMLImageElement | null {
    const key = `k-${k}-src`;
    return this.scene.textures.exists(key) ? (this.scene.textures.get(key).getSourceImage() as HTMLImageElement) : null;
  }

  /** Measure each picture once, and fix the turnstile's misspelt sign. */
  prepare(): void {
    for (const k of KIT_KEYS) {
      if (this.scene.textures.exists(`k-${k}`)) continue;
      const src = this.img(k);
      if (!src) continue;
      const cv = k === "turnstile" ? repaintSign(src, { x: 61, y: 24, w: 74, h: 21 }, "TURNSTILE", "#3fcf5c", "#0f2a14") : k === "turnstile_shut" || k === "turnstile_open" ? repaintSign(src, { x: 42, y: 20, w: 108, h: 19 }, "ENTRANCE", "#f2ecd0", "#1b2a6b") : k === "toiletsign" ? repaintSign(src, { x: 6, y: 4, w: 52, h: 17 }, "TOILETS", "#1c5c3c", "#f4f1ea") : (() => {
        const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d")!.drawImage(src, 0, 0); return c;
      })();
      const d = cv.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, cv.width, cv.height).data;
      let foot = 0, left = cv.width, right = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 120) { foot = Math.max(foot, y + 1); left = Math.min(left, x); right = Math.max(right, x); }
      this.base[k] = { foot, left, right };
      this.scene.textures.addCanvas(`k-${k}`, cv);
    }
  }
}

const r = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

/** The buildings on the street, quarter-final layout; the semi-final mirrors them. */
/** Rooms under the stands with a painted back wall (their art is bld-wall-<area id>.png). */
export const ROOM_WALLS = ["security", "kitchen", "medical", "kitroom", "ref_room"];

export function buildings(venue: Venue): BuildingSpec[] {
  const out: BuildingSpec[] = [
    { id: "pub", rect: r(-62.5, 61.5, -34, 80.5), height: 4.2, mat: "brick", roof: "slate", front: "pub", chimney: true,
      doors: [{ x0: -48, x1: -44, kind: "pub" }], sign: { text: "THE THREE LIONS", bg: 0x1c2440, fg: 0xf2c94c } },
    { id: "charity", rect: r(-18.5, 61.5, -3.5, 72.5), height: 3.6, mat: "stock", roof: "slate", front: "charity",
      doors: [{ x0: -14.6, x1: -10.6, kind: "shop" }], sign: { text: "SECOND HAND ROSE", bg: 0x2f5d50, fg: 0xf4efe0 }, awning: [0x2f5d50, 0xe8e0c8] },
    { id: "surplus", rect: r(7.5, 61.5, 22.5, 72.5), height: 3.6, mat: "stock", roof: "slate", front: "surplus",
      doors: [{ x0: 13, x1: 17, kind: "shop" }], sign: { text: "ARMY & NAVY", bg: 0xd9cfa8, fg: 0x2f3d22 } },
    { id: "bookies", rect: r(27.5, 61.5, 44.5, 72.5), height: 3.6, mat: "render", roof: "felt", front: "bookies",
      doors: [{ x0: 34, x1: 38, kind: "glass" }], sign: { text: "CASH KINGS", bg: 0x141416, fg: 0xf2c94c } },
    { id: "hotel", rect: r(73.5, -40.5, 92, -14), height: 7, mat: "render", roof: "felt", front: "hotel",
      doors: [{ x0: 80, x1: 84, kind: "glass" }], sign: { text: "TEAM HOTEL", bg: 0x22262c, fg: 0xf4f1ea } },
    { id: "cabin", rect: r(76, 50, 88, 58), height: 2.8, mat: "cabin", roof: "ribbed", front: "cabin", doors: [], sign: { text: "STEWARDS", bg: 0xf4f4f4, fg: 0x1c2a1c } },
  ];
  const list = venue.features.fanZone ? out.filter((b) => b.id !== "pub") : out;
  if (venue.id === "sf") for (const b of list) {
    b.rect = { x0: -b.rect.x1, x1: -b.rect.x0, y0: b.rect.y0, y1: b.rect.y1 };
    b.doors = b.doors.map((d) => ({ ...d, x0: -d.x1, x1: -d.x0 }));
  }
  return list;
}

/** Everything placed outside, for the quarter-final ground; the semi-final mirrors it. */
export function placements(venue: Venue): Placement[] {
  const furn: Placement[] = [];
  const out: Placement[] = [
    { id: "ticketbooth", key: "ticketbooth", x: 21, y: 48.4 },
    { id: "merch", key: "merchstall", x: -21, y: 48.4 },
    { id: "staffdoor", key: "staffdoor", x: 59.5, y: 51.1 },
    { id: "policevan", key: "policevan", x: 32, y: 55.6 },
    { id: "burgervan", key: "burgervan", x: 46, y: 53 },
    { id: "programmes", key: "programmes", x: -34, y: 50 },
    { id: "phonebox", key: "phonebox", x: -30, y: 83.4 },
  ];
  for (const x of [-9, -3, 3, 9]) out.push({ id: `bar${x}`, key: "barrier", x, y: 50.6 });
  for (let x = -52; x <= 52; x += 13) if (Math.abs(x) > 8) out.push({ id: `bol${x}`, key: "bollard", x, y: 60.7 });
  for (let x = -84; x <= 84; x += 24) out.push({ id: `lamp${x}`, key: "lamppost", x, y: 83.7 });
  for (const [i, x, y] of [[0, -2, 73.5], [1, 23.6, 73.5], [2, -33, 81.7], [3, 45.6, 73.5]] as const) out.push({ id: `bin${i}`, key: "bin", x, y });
  for (const [i, x, y] of [[0, -28, 72], [1, -28, 77.5]] as const) out.push({ id: `bench${i}`, key: "bench", x, y });
  // Street life, so every frontage tells you what it is and the pavements look walked on.
  out.push(
    { id: "kegs0", key: "kegs", x: -24.5, y: 78.6 }, { id: "smoker0", key: "smokerbin", x: -50.6, y: 81.4 }, { id: "smoker1", key: "smokerbin", x: 32.4, y: 73.6 },
    { id: "busstop", key: "busstop", x: 12, y: 94.6 }, { id: "news0", key: "newsboard", x: -9.5, y: 58.4 }, { id: "news1", key: "newsboard", x: 25.5, y: 82.8 },
    { id: "flagw", key: "flagpole", x: -40, y: 46.4 }, { id: "flage", key: "flagpole", x: 40, y: 46.4, flip: true }, { id: "grit0", key: "gritbin", x: 60.2, y: 82.8 },
    { id: "pige0", key: "pigeons", x: -15, y: 55.5 }, { id: "pige1", key: "pigeons", x: 34, y: 58.2, flip: true }, { id: "pige2", key: "pigeons", x: -64, y: 12 },
  );
  for (const [i, x, y] of [[0, -46, 81.1], [1, -12.6, 73.1], [2, 15, 73.1], [3, 36, 73.1], [4, 82, -13.3]] as const) out.push({ id: `mat${i}`, key: "doormat", x, y, flat: true });
  for (const [i, x, y] of [[0, 5, 55.8], [1, -38, 57.4], [2, 40, 79.4], [3, -66, 10], [4, 66.8, 20], [5, -20, 82.4]] as const) out.push({ id: `mhole${i}`, key: "manhole", x, y, flat: true });
  for (const [i, x, y] of [[0, 43.5, 57.2], [1, -19.5, 58.6], [2, 9, 82.2], [3, -40.5, 83.3], [4, 49, 55.6], [5, -3, 48.2]] as const) out.push({ id: `chips${i}`, key: "chippaper", x, y, flat: true });
  for (const [i, x, y] of [[0, -5.5, 47.6], [1, 28.5, 58.8], [2, -52, 82.5]] as const) out.push({ id: `scarf${i}`, key: "scarf", x, y, flat: true });
  // Floodlights at the four corners of the ground.
  for (const [i, x, y] of [[0, -54.5, 43.5], [1, 54, 43.5], [2, -54.5, -37], [3, 54, -37]] as const) out.push({ id: `flood${i}`, key: "floodlight", x, y });
  // Clutter: things nobody walks into. Crates and pallets against walls, cones on the service road,
  // litter and puddles underfoot.
  for (const [i, x, y] of [[0, -23.2, 66], [1, -23.2, 68.4]] as const) out.push({ id: `crate${i}`, key: "crates", x, y });
  for (const [i, x, y] of [[0, 59.5, -55], [1, 59.5, -51.5], [2, 43, -58.5]] as const) out.push({ id: `pallet${i}`, key: "pallets", x, y });
  for (const [i, x, y] of [[0, 58, -40], [1, 61, -58.5]] as const) out.push({ id: `lcrate${i}`, key: "crates", x, y });
  for (const [i, x, y] of [[0, 64.2, 40], [1, 64.2, 46], [2, 64.2, 52], [3, 69.8, 70], [4, 29, 80.5], [5, -60, 58.5]] as const) out.push({ id: `cone${i}`, key: "cone", x, y });
  // The service alley: wheelie bins and bin bags against the stand wall, pallets and crates by the
  // players' entrance, cones and puddles. Beyond the fence, the railway embankment's trees.
  for (const [i, y] of [-44, -30, -8, 6, 24, 38].entries()) { out.push({ id: `abin${i}`, key: "bin", x: -57.8, y }); out.push({ id: `abag${i}`, key: "binbags", x: -58.3, y: y + 1.6 }); }
  for (const [i, x, y] of [[0, -60, -47], [1, -61.5, -45], [2, -66.5, 30], [3, -67, 32.6]] as const) out.push({ id: `apal${i}`, key: "pallets", x, y });
  for (const [i, x, y] of [[0, -58.4, -58.5], [1, -58.4, -47.6], [2, -68.4, -2], [3, -68.4, 0.5], [4, -68.6, 50]] as const) out.push({ id: `acrate${i}`, key: "crates", x, y });
  for (const [i, x, y] of [[0, -63, -26], [1, -64.5, -24], [2, -61, 44], [3, -62, 66]] as const) out.push({ id: `acone${i}`, key: "cone", x, y });
  for (const [i, x, y] of [[0, -63, -40], [1, -66, 20], [2, -60.5, 55], [3, -64, -10]] as const) out.push({ id: `apud${i}`, key: "puddle", x, y, flat: true });
  for (const [i, x, y] of [[0, -55.5, -20], [1, -55.5, 10], [2, -52, 41], [3, 55.5, -20], [4, 55.5, 10], [5, 52, 41], [6, -30, 41.5], [7, 30, 41.5]] as const) out.push({ id: `cbin${i}`, key: "bin", x, y });
  for (const [i, x, y] of [[0, -54.8, -33], [1, -54.8, 30], [2, 54.8, -33], [3, 54.8, 30]] as const) out.push({ id: `ccrate${i}`, key: "crates", x, y });
  {
    let ts = 7;
    const tr = () => ((ts = (ts * 16807) % 2147483647) / 2147483647);
    let i = 0;
    for (let y = -58; y < 82; y += 5.5) for (const cx of [-74, -80.5, -87]) out.push({ id: `etree${i++}`, key: "tree", x: cx + (tr() - 0.5) * 3, y: y + (tr() - 0.5) * 2.5, flip: tr() < 0.5 });
  }
  // Inside the ground: spilt beer, programmes and pie wrappers along the concourses.
  {
    let cs = 31;
    const cr = () => ((cs = (cs * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const side = i % 3, x = side === 0 ? -52 + cr() * 104 : side === 1 ? -55.5 + cr() * 4.5 : 51 + cr() * 4.5, y = side === 0 ? 40 + cr() * 3.5 : -36 + cr() * 64;
      if (side === 0 && ((x > -20 && x < -6) || (x > 6 && x < 16))) continue;
      out.push({ id: `clit${i}`, key: i % 4 === 0 ? "puddle" : "litter", x, y, flat: true, flip: cr() < 0.5 });
    }
  }
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 26; i++) {
    const x = -56 + rnd() * 112, y = 52 + rnd() * 30;
    if (y > 60.5 && y < 73 && Math.abs(x) < 46) continue; // not inside the shops
    if (x < -33 && y > 61) continue; // nor the pub
    out.push({ id: `litter${i}`, key: "litter", x, y, flat: true, flip: rnd() < 0.5 });
  }
  for (const [i, x, y] of [[0, -70, 88.5], [1, 12, 90], [2, 48, 76], [3, 67, 20], [4, 36, 69.5 + 10], [5, -80, 70]] as const) out.push({ id: `puddle${i}`, key: "puddle", x, y, flat: true });
  if (venue.features.fanZone) {
    // The pub's an open-air fan zone here: a big screen, portable toilets and benches.
    out.push({ id: "bigscreen", key: "bigscreen", x: -48, y: 64.5 });
    for (const [i, x] of [[0, -61], [1, -59.6], [2, -58.2]] as const) out.push({ id: `loo${i}`, key: "portaloo", x, y: 67.6 });
    for (const [i, x, y] of [[0, -50, 72], [1, -44, 72], [2, -50, 76], [3, -44, 76]] as const) out.push({ id: `fzb${i}`, key: "bench", x, y });
  }
  // Furniture and dressing (already mirrored for the semi-final by the layout).
  venue.furniture.forEach((q, i) => furn.push({ id: `furn${i}`, key: q.key as KitKey, x: q.x, y: q.y, room: q.room, flat: q.key === "grate" || q.key === "hatch" || q.key === "boots" }));
  // Mirrored for the semi-final; anything with writing on it keeps its writing the right way round.
  const LETTERED = new Set(["ticketbooth", "merchstall", "staffdoor", "policevan", "programmes", "burgervan", "phonebox", "bigscreen"]);
  if (venue.id === "sf") for (const p of out) { p.x = -p.x; if (!LETTERED.has(p.key)) p.flip = !p.flip; }
  return out.concat(furn);
}
