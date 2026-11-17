import Phaser from "phaser";
import { G } from "../../G";
import { calm, loopProp } from "../../gfx/ambient";
import { hasVfx, vfx } from "../../gfx/Vfx";

/**
 * KRELFORD, ALIVE: chimney smoke, birds, flags on the Town Hall, and a town that changes as the story goes on
 * (graffiti piling up, the Krunchers' mess, the Krel Tower memorial, the Town Hall party's bunting).
 * Everything here is set up once in create(): sprite sheets and tweens, no per-frame work.
 */

export interface TownBuilding {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TownLifeOpts {
  /** Chapter 7: the bombed town (it has its own fires and smoke). */
  ruined: boolean;
  /** One of the story's nights (no birds about). */
  night: boolean;
  /** After the Krel Tower falls (until the lads decide to hit back). */
  mourning: boolean;
}

/** Chimney tops, in pixels from the top-left of each building's picture. */
const CHIMNEYS: Record<string, [number, number][]> = {
  HOME: [
    [50, 4],
    [142, 4],
  ],
  PUB: [[108, 4]],
  TOWN_HALL: [[146, 8]],
  OLD_FLAT: [[62, 22]],
  FIXER_UPPER: [[128, 16]],
  ARCHIVE: [[126, 4]],
  BAN_TRIBUNAL: [[168, 22]],
  GYM: [[28, 4]],
};

interface Tag {
  /** building, x from the picture's left edge, height up from its bottom edge */
  at: [string, number, number];
  text: string;
  color: string;
  size?: number;
  angle?: number;
  /** crossed out (a Krelworlder's had a go at the Krunchers' tags) */
  struck?: () => boolean;
  when: () => boolean;
}

export function townLife(sc: Phaser.Scene, buildings: TownBuilding[], o: TownLifeOpts) {
  const f = G.s.flags;
  const ch = G.s.chapter;
  const bld = (id: string) => buildings.find((b) => b.id === id);
  if (!o.ruined) {
    chimneySmoke(sc, bld);
    townHallFlags(sc, bld);
    if (!o.night) birds(sc);
  }
  if (o.ruined) return;
  // the Kreddle Krunchers came over the bridge (start of Chapter 3) and left their mark
  const krunched = f.krunchers_shoved !== undefined || ch >= 4;
  graffiti(sc, bld, krunched);
  if (krunched && ch === 3) krunchMess(sc);
  // the Krel Tower memorial: from the day it falls until Krelford itself goes
  if (f.kreltower_fell && ch === 6) memorial(sc, o.mourning);
  // the victory party at the Town Hall (the night of the Krunch Protocol)
  if (ch === 6 && f.krunch_started && !f.krelworld_bombed) bunting(sc, bld("TOWN_HALL"));
}

// ------------------------------------------------------------------ everyday life

function chimneySmoke(sc: Phaser.Scene, bld: (id: string) => TownBuilding | undefined) {
  if (!hasVfx(sc, "vfx_smokecol")) return;
  for (const [id, tops] of Object.entries(CHIMNEYS)) {
    const b = bld(id);
    if (!b) continue;
    // the burnt-out and the knocked-down don't light the fire
    if ((id === "CROBLEY_FACTORY" && G.s.flags.crobley_factory_destroyed) || (id === "WILDERN" && G.s.flags.wildern_destroyed)) continue;
    const x0 = b.x - b.w / 2;
    const y0 = b.y - b.h / 2;
    tops.forEach(([cx, cy], i) => {
      const s = vfx(sc, "vfx_smokecol", x0 + cx, y0 + cy + 2, { scale: 0.55 + (i % 2) * 0.1, alpha: 0.45, depth: b.y + b.h / 2, tint: 0xd8d4e8, speed: 0.6 + Math.random() * 0.25 });
      s?.anims.setProgress(Math.random());
    });
  }
}

function townHallFlags(sc: Phaser.Scene, bld: (id: string) => TownBuilding | undefined) {
  const b = bld("TOWN_HALL");
  if (!b || !sc.textures.exists("hd_flag_anim")) return;
  const bottom = b.y + b.h / 2;
  // either side of the steps, on the front corners (the pole is a third of the way across the picture)
  for (const side of [-1, 1]) {
    const x = b.x + side * (b.w / 2 + 6);
    const s = loopProp(sc, "hd_flag_anim", x + 12, bottom + 4, 7);
    s?.setOrigin(0.32, 1).setDepth(bottom + 4);
    if (side > 0) s?.setFlipX(false);
  }
}

/** Every so often a few pigeons flap across the sky over wherever you are. */
function birds(sc: Phaser.Scene) {
  if (!sc.textures.exists("hd_bird_anim")) return;
  const flock = () => {
    if (!sc.scene.isActive()) return;
    const v = sc.cameras.main.worldView;
    const east = Math.random() < 0.5;
    const n = 2 + Math.floor(Math.random() * 4);
    const y0 = v.y + 40 + Math.random() * v.height * 0.4;
    const dur = 7000 + Math.random() * 3000;
    for (let i = 0; i < n; i++) {
      const s = loopProp(sc, "hd_bird_anim", east ? v.x - 30 - i * 26 : v.right + 30 + i * 26, y0 + (i % 2) * 14 + i * 4, 9 + (i % 3), { scale: 1.6 });
      if (!s) return;
      s.setDepth(4150).setFlipX(!east).setAlpha(0.9);
      sc.tweens.add({ targets: s, x: east ? v.right + 120 : v.x - 120, y: s.y - 40 + Math.random() * 60, duration: dur, ease: "Sine.inOut", onComplete: () => s.destroy() });
    }
  };
  sc.time.delayedCall(2500, flock);
  sc.time.addEvent({ delay: 11000, loop: true, callback: () => Math.random() < 0.7 && flock() });
}

// ------------------------------------------------------------------ the town changes with the story

function graffiti(sc: Phaser.Scene, bld: (id: string) => TownBuilding | undefined, krunched: boolean) {
  const f = G.s.flags;
  const ch = G.s.chapter;
  const tags: Tag[] = [
    // the Great Silence: nobody's reacted to the song
    { at: ["ABANDONED", 34, 24], text: "REACT TO\nTHE SONG", color: "#c084fc", when: () => ch >= 2 },
    { at: ["PUB", 28, 15], text: "SEEN BY 9", color: "#f8fafc", size: 9, angle: -4, when: () => ch >= 2 },
    // the Kreddle Krunchers were here
    { at: ["GYM", 76, 22], text: "KRUNCHERS\nRULE", color: "#ff4fd8", size: 12, angle: -6, struck: () => ch >= 4, when: () => krunched },
    { at: ["BAN_TRIBUNAL", 165, 30], text: "SMELL-\nWORLD", color: "#22d3ee", angle: 5, struck: () => ch >= 4, when: () => krunched },
    { at: ["FIXER_UPPER", 120, 56], text: "KRELWORLD\nDROOLS", color: "#ff4fd8", size: 9, angle: -10, when: () => krunched },
    // Krelford writes back
    { at: ["GYM", 112, 12], text: "KREDDLE\nSTINKS", color: "#fde047", size: 9, angle: 4, when: () => krunched && ch >= 4 },
    { at: ["MINISTRY", 212, 40], text: "WHERE'S\nDRONGUS??", color: "#a3e635", angle: -3, when: () => ch >= 4 },
    { at: ["UNIVERSITY", 226, 32], text: "DELETE\nTHE LOGS", color: "#f87171", angle: 4, when: () => ch >= 5 },
    { at: ["BAN_TRIBUNAL", 34, 20], text: "LORE IS\nREAL", color: "#fbbf24", size: 9, angle: -5, when: () => ch >= 5 },
    // the Krel Tower falls
    { at: ["TOWN_HALL", 40, 26], text: "RIP\nKRELTOWER", color: "#f8fafc", size: 9, angle: -4, when: () => !!f.kreltower_fell },
    { at: ["POLICE", 26, 26], text: "NEVER\nFORGET", color: "#93c5fd", size: 9, angle: 3, when: () => !!f.kreltower_fell },
    // and the lads decide to hit back
    { at: ["TOWN_HALL", 150, 26], text: "KRUNCH\nKREDDLE", color: "#ef4444", angle: 5, when: () => !!f.revenge_meeting },
    { at: ["ABANDONED", 100, 32], text: "REVENGE.\nTOTAL.", color: "#ef4444", size: 9, angle: -6, when: () => !!f.revenge_meeting },
  ];
  for (const t of tags) {
    if (!t.when()) continue;
    const b = bld(t.at[0]);
    if (!b) continue;
    const bottom = b.y + b.h / 2;
    const x = b.x - b.w / 2 + t.at[1];
    const y = bottom - t.at[2];
    const col = Phaser.Display.Color.HexStringToColor(t.color).color;
    const txt = sc.add
      .text(x, y, t.text, { fontFamily: "Impact, Arial Black, sans-serif", fontSize: `${t.size ?? 10}px`, color: t.color, align: "center", stroke: "#1a1024", strokeThickness: 2, lineSpacing: -3 })
      .setOrigin(0.5)
      .setAngle(t.angle ?? 0)
      .setAlpha(0.88)
      .setDepth(bottom - 0.5);
    const g = sc.add.graphics().setDepth(bottom - 0.4);
    // paint drips under the tag
    const w = txt.width * 0.8;
    for (let i = 0; i < 4; i++) {
      const dx = x - w / 2 + ((i * 37) % 100) / 100 * w;
      g.fillStyle(col, 0.75).fillRect(Math.round(dx), Math.round(y + txt.height / 2 - 2), 1, 3 + ((i * 5) % 6));
    }
    // a Krelworlder's crossed it out
    if (t.struck?.()) {
      g.lineStyle(2, 0xf8fafc, 0.85).lineBetween(x - w / 2 - 4, y + 3, x + w / 2 + 4, y - 5);
      g.lineStyle(2, 0xf8fafc, 0.85).lineBetween(x - w / 2 - 4, y - 4, x + w / 2 + 4, y + 2);
    }
  }
}

/** Chapter 3, after the Krunchers have been and gone: their rubbish all over town. */
function krunchMess(sc: Phaser.Scene) {
  if (!sc.textures.exists("hd_kr_litter")) return;
  // by the Tap (where Kredbon did his business), and on the way back to the bridge (clear of the road and the doors)
  for (const [x, y, flip] of [
    [1385, 905, false],
    [330, 745, true],
    [1000, 755, false],
  ] as [number, number, boolean][]) {
    sc.add.image(x, y, "hd_kr_litter").setOrigin(0.5, 1).setDepth(3).setFlipX(flip).setScale(0.55);
  }
  // a yellow ring on the Tap's basin that won't scrub off
  const T = { x: 1280, y: 805 };
  const stain = sc.add.ellipse(T.x + 6, T.y + 2, 46, 12, 0xf7e04a, 0.22).setDepth(851);
  sc.tweens.add({ targets: stain, alpha: 0.12, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
}

/** Flowers, candles and photos where the Krel Tower stood. */
function memorial(sc: Phaser.Scene, mourning: boolean) {
  const X = 1532;
  const Y = 1104;
  const s = loopProp(sc, "hd_shrine_anim", X, Y, 5, { yoyo: true });
  s?.setOrigin(0.5, 1).setDepth(Y);
  // candlelight: warm, soft, steady (it breathes; it never blinks)
  for (const [dx, dy] of [
    [-30, -14],
    [6, -10],
    [40, -24],
  ]) {
    // (above the mourning greyness: the only warm colour in town)
    const glow = sc.add.circle(X + dx, Y + dy, 14, 0xffc46b, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(4904);
    sc.tweens.add({ targets: glow, alpha: { from: 0.1, to: mourning ? 0.24 : 0.16 }, scale: { from: 0.9, to: 1.1 }, duration: calm() ? 2600 : 900 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }
  // more bunches left on the Town Hall steps
  if (sc.textures.exists("hd_flowerbed") && mourning) {
    for (const dx of [-62, 62]) sc.add.image(1280 + dx, 548, "hd_flowerbed").setOrigin(0.5, 1).setScale(0.6).setDepth(548);
  }
}

/** The victory party: bunting strung across the Town Hall, and the windows throbbing pink and cyan. */
function bunting(sc: Phaser.Scene, b?: TownBuilding) {
  if (!b) return;
  const bottom = b.y + b.h / 2;
  const left = b.x - b.w / 2;
  const right = b.x + b.w / 2;
  const cols = [0xff4fd8, 0xfacc15, 0x22d3ee, 0x4ade80, 0xa855f7, 0xf8fafc];
  const strand = (x0: number, y0: number, x1: number, y1: number, sag: number, depth: number) => {
    const g = sc.add.graphics().setDepth(depth);
    const pts: Phaser.Math.Vector2[] = [];
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2((x0 + x1) / 2, Math.max(y0, y1) + sag), new Phaser.Math.Vector2(x1, y1));
    curve.getPoints(Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 11)), undefined, pts);
    g.lineStyle(1, 0x1a1024, 0.9);
    curve.draw(g, 24);
    pts.slice(0, -1).forEach((p, i) => {
      g.fillStyle(cols[i % cols.length], 1).fillTriangle(p.x - 5, p.y, p.x + 5, p.y, p.x, p.y + 10);
    });
    // a gentle sway
    sc.tweens.add({ targets: g, y: 1.5, duration: 1300 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  };
  // across the front, and out to the flagpoles
  strand(left + 14, bottom - 92, right - 14, bottom - 92, 18, bottom + 1);
  strand(left + 10, bottom - 58, b.x - 24, bottom - 64, 10, bottom + 1);
  strand(b.x + 24, bottom - 64, right - 10, bottom - 58, 10, bottom + 1);
  strand(left - 2, bottom - 100, left + 24, bottom - 40, 4, bottom + 1);
  strand(right + 2, bottom - 100, right - 24, bottom - 40, 4, bottom + 1);
  // the party inside: coloured light in the windows, pulsing to the music
  const slow = calm();
  [0xff4fd8, 0x22d3ee, 0xfacc15].forEach((c, i) => {
    // (over the night sky's darkening, so the party shines out across the square)
    const glow = sc.add.ellipse(b.x + (i - 1) * 56, bottom - 62, 64, 54, c, 0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(4904);
    sc.tweens.add({ targets: glow, alpha: { from: 0.05, to: slow ? 0.14 : 0.24 }, duration: slow ? 1800 : 460, delay: i * (slow ? 600 : 150), yoyo: true, repeat: -1, ease: "Sine.inOut" });
  });
  const sign = sc.add
    .text(b.x, bottom - 118, "★ VICTORY PARTY ★", { fontFamily: "Impact, sans-serif", fontSize: "13px", color: "#fde047", stroke: "#1a1024", strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(bottom + 2);
  sign.setShadow(0, 0, "#ff4fd8", 8, true, true);
}
