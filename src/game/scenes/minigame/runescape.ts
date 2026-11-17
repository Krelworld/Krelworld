import Phaser from "phaser";
import type { Line } from "../../../data/types";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { FONT, PIXEL_BOLD, PIXEL_FONT } from "../../ui/theme";
import { dir } from "../../../content/dsl";
import { animateWalker, charMeta, type Facing } from "../../gfx/HD";
import { playerKey } from "../../gfx/sanmikForm";

/**
 * RUNESCAPE (keep the gear coming): Kreblis's 99 Woodcutting session, as an old-school MMO woodcutting trip.
 *
 * Click / tap a tree to walk over and chop it; logs land in a 28-slot pack; trees fall to stumps and come back.
 * Bigger trees unlock as the level climbs (Tree, Oak, Willow, Maple, Yew, Magic). While Kreblis has "gear" he's
 * manic (fast chops, and a timing ring for bonus XP); when it runs out he crawls until he re-ups off Gary,
 * who turns up at the edge of the map like a random event. 99 is the win; the timer running out is the fail.
 *
 * Parody of the 2007-era look: stone/brown frame, chatbox, minimap with compass, inventory, XP drops, the
 * hover text and the level-up popup. Everything is drawn here or is our own PixelLab art.
 */

export interface RsHost {
  scene: Phaser.Scene;
  hud: Phaser.GameObjects.Text;
  box: { active: boolean };
  ended: () => boolean;
  finish: (win: boolean, lines: Line[]) => void;
}

// ---------------------------------------------------------------- layout
const VX = 8, VY = 8, VW = 700, VH = 366; // the game view
const CX = 8, CY = 382, CW = 700, CH = 150; // the chatbox
const PX = 716, PW = 236; // the right-hand panel
const MM = { x: 864, y: 90, r: 64 }; // minimap
const INV = { x: 724, y: 206, w: 55, h: 42 }; // inventory grid origin and slot size (4 x 7)
const WALK = { x0: 40, x1: 680, y0: 112, y1: 362 };

const SESSION_S = 110;

interface Tier {
  key: string;
  name: string;
  log: string;
  req: number;
  /** levels per log (the XP table is squashed so 99 takes about a minute) */
  dl: number;
  logs: [number, number];
  tint: number;
  /** minimap dot */
  dot: number;
}
const TIERS: Tier[] = [
  { key: "rs_tree", name: "Tree", log: "Logs", req: 1, dl: 1.95, logs: [1, 2], tint: 0xffffff, dot: 0x3f8f2f },
  { key: "rs_oak", name: "Oak", log: "Oak logs", req: 15, dl: 2.1, logs: [2, 4], tint: 0xe6c48a, dot: 0x2f7a2a },
  { key: "rs_willow", name: "Willow", log: "Willow logs", req: 30, dl: 2.3, logs: [3, 5], tint: 0xc9d27a, dot: 0x9ab83a },
  { key: "rs_maple", name: "Maple", log: "Maple logs", req: 45, dl: 2.5, logs: [3, 5], tint: 0xf0a060, dot: 0xd8642a },
  { key: "rs_yew", name: "Yew", log: "Yew logs", req: 60, dl: 2.8, logs: [4, 6], tint: 0xa8644a, dot: 0x1f4f1f },
  { key: "rs_magic", name: "Magic tree", log: "Magic logs", req: 75, dl: 3.2, logs: [4, 7], tint: 0x9fe0ff, dot: 0x7fd8ff },
];

const SPOTS: [number, number][] = [
  [150, 186], [278, 146], [486, 146], [612, 182], [236, 268], [566, 272], [404, 222],
];
const CHEST: [number, number] = [372, 346];

const GARY_LINES = ["Alright Kreb.", "Same again?", "For the RuneScape?", "You're my best customer."];
const CRAWL_LINES = ["Feel a bit manic… better get some gear in!", "Hands… so… slow…", "Where's Gary. WHERE IS GARY.", "This is not the RuneScape way."];

/** The real old-school XP table (xp needed for each level), so the numbers on screen look right. */
const XP_TABLE: number[] = (() => {
  const t = [0, 0];
  let pts = 0;
  for (let l = 1; l < 99; l++) {
    pts += Math.floor(l + 300 * Math.pow(2, l / 7));
    t.push(Math.floor(pts / 4));
  }
  return t;
})();
/** XP at a fractional level (between table rows, linearly). */
const xpAt = (L: number) => {
  if (L >= 99) return XP_TABLE[99];
  const l = Math.max(1, Math.floor(L));
  return Math.round(XP_TABLE[l] + (XP_TABLE[l + 1] - XP_TABLE[l]) * (L - l));
};
const fmt = (n: number) => n.toLocaleString("en-GB");

interface Tree {
  i: number;
  x: number;
  y: number;
  tier: Tier;
  img: Phaser.GameObjects.Image;
  stump: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  left: number;
  down: boolean;
}

type Goal = { kind: "tree"; tree: Tree } | { kind: "chest" } | { kind: "gary" } | { kind: "ground"; x: number; y: number };

export function runescape(host: RsHost) {
  const sc = host.scene;
  const calm = !!G.meta?.settings?.calmFlash;
  const over = () => host.ended() || won;
  let won = false;

  // ---------------------------------------------------------------- state
  let L = 1; // fractional level
  let level = 1;
  let gear = 100;
  let reups = 0;
  let logsTotal = 0;
  let banked = 0;
  let dropped = 0;
  let perfects = 0;
  let firstChop = false;
  const inv: (Tier | null)[] = new Array(28).fill(null);
  // session time, counted from (clamped) frame deltas: a stalled frame or a hidden tab never eats the session
  let elapsed = 0;
  /** the game clock for chops, rings and logs: the same clamped deltas, so all of it slows together on a stalled frame */
  let clock = 0;

  // ---------------------------------------------------------------- frame
  const px = sc.textures.exists("rs_px") ? null : sc.add.graphics().fillStyle(0xffffff).fillRect(0, 0, 4, 4);
  px?.generateTexture("rs_px", 4, 4).destroy();

  if (sc.textures.exists("rs_bg")) sc.add.image(VX, VY, "rs_bg").setOrigin(0).setDisplaySize(VW, VH).setDepth(-15);
  else sc.add.rectangle(VX, VY, VW, VH, 0x4f8a2f).setOrigin(0).setDepth(-15);

  const frame = sc.add.graphics().setDepth(55);
  const STONE = 0x4b4033, STONE_D = 0x2c251c, STONE_L = 0x6d5d45;
  // the stone frame: everything but the game view
  frame.fillStyle(STONE);
  frame.fillRect(0, 0, 960, VY).fillRect(0, VY + VH, 960, 540 - VY - VH).fillRect(0, 0, VX, 540).fillRect(VX + VW, 0, 960 - VX - VW, 540);
  // a little hand-placed stonework so it isn't a flat brown slab (fixed pattern, not random each run)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 260; k++) {
    const x = rnd() * 960, y = rnd() * 540;
    if (x > VX - 4 && x < VX + VW + 4 && y > VY - 4 && y < VY + VH + 4) continue;
    frame.fillStyle(rnd() < 0.5 ? STONE_D : STONE_L, 0.35).fillRect(Math.floor(x), Math.floor(y), 6 + Math.floor(rnd() * 14), 3 + Math.floor(rnd() * 5));
  }
  const bevel = (x: number, y: number, w: number, h: number, inset = true) => {
    frame.lineStyle(2, inset ? STONE_D : STONE_L).beginPath().moveTo(x, y + h).lineTo(x, y).lineTo(x + w, y).strokePath();
    frame.lineStyle(2, inset ? STONE_L : STONE_D).beginPath().moveTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).strokePath();
  };
  bevel(VX - 2, VY - 2, VW + 4, VH + 4);
  frame.lineStyle(1, 0x000000).strokeRect(VX - 1, VY - 1, VW + 2, VH + 2);
  // chatbox: parchment
  frame.fillStyle(0xcfbf98).fillRect(CX, CY, CW, CH - 24);
  frame.fillStyle(0xbcaa80).fillRect(CX, CY + CH - 50, CW, 1);
  bevel(CX - 2, CY - 2, CW + 4, CH + 4);
  // the right panel: minimap well, tabs, inventory
  frame.fillStyle(0x3a3127).fillRect(PX, 192 + 6, PW, 300);
  bevel(PX, 198, PW, 300);
  frame.fillStyle(0x15120d).fillCircle(MM.x, MM.y, MM.r + 5);
  frame.lineStyle(3, STONE_L).strokeCircle(MM.x, MM.y, MM.r + 5);

  const txt = (x: number, y: number, s: string, color = "#ffff00", size = 13, depth = 60, font = PIXEL_FONT) =>
    sc.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color }).setShadow(1, 1, "#000000", 0, false, true).setDepth(depth);

  // ---------------------------------------------------------------- minimap + compass + orbs
  const mmMaskG = sc.make.graphics({}, false).fillStyle(0xffffff).fillCircle(MM.x, MM.y, MM.r);
  const mmMask = mmMaskG.createGeometryMask();
  const MS = 0.2; // view px -> minimap px
  const mmX = (x: number) => MM.x + (x - (VX + VW / 2)) * MS;
  const mmY = (y: number) => MM.y + (y - (VY + VH / 2)) * MS;
  sc.add.circle(MM.x, MM.y, MM.r, 0x24461a).setDepth(56);
  if (sc.textures.exists("rs_bg")) sc.add.image(MM.x, MM.y, "rs_bg").setDisplaySize(VW * MS, VH * MS).setDepth(57).setMask(mmMask);
  const mmDots = sc.add.graphics().setDepth(58).setMask(mmMask);
  // compass
  const comp = sc.add.container(PX + 28, 26).setDepth(60);
  const needle = sc.add.graphics();
  needle.fillStyle(0x2b2418).fillCircle(0, 0, 15).lineStyle(2, 0xa89470).strokeCircle(0, 0, 15);
  needle.fillStyle(0xd02020).fillTriangle(-4, 0, 4, 0, 0, -12).fillStyle(0xe8e0d0).fillTriangle(-4, 0, 4, 0, 0, 12);
  comp.add([needle, txt(0, -12, "N", "#ffffff", 9, 61).setOrigin(0.5, 1)]);
  sc.tweens.add({ targets: comp, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 2600, ease: "Sine.inOut" });
  // orbs (HP and the gear orb, which is the re-up button)
  const orb = (y: number, col: number, label: string) => {
    sc.add.circle(PX + 52, y, 15, 0x15120d).setStrokeStyle(2, 0xa89470).setDepth(58);
    const fill = sc.add.circle(PX + 52, y, 12, col).setDepth(59);
    const num = txt(PX + 30, y, "", "#00ff00", 13, 60).setOrigin(1, 0.5);
    txt(PX + 52, y, label, "#ffffff", 9, 60).setOrigin(0.5);
    return { fill, num };
  };
  const hpOrb = orb(70, 0xb81d1d, "HP");
  hpOrb.num.setText("99");
  const gearOrb = orb(112, 0x2fbf3f, "GEAR");
  const gearZone = sc.add.zone(PX + 40, 112, 50, 34).setInteractive({ useHandCursor: true }).setDepth(61);
  // tab stones
  const TABS = ["⚔", "📊", "📜", "🎒", "🛡", "🙏", "✨"];
  TABS.forEach((t, i) => {
    const x = PX + 4 + i * 33;
    sc.add.rectangle(x, 168, 31, 26, i === 3 ? 0x7a2a1a : 0x3a3127).setOrigin(0).setStrokeStyle(1, 0x1a150f).setDepth(58);
    sc.add.text(x + 15, 181, t, { fontFamily: FONT, fontSize: "13px" }).setOrigin(0.5).setDepth(59).setAlpha(i === 3 ? 1 : 0.6);
  });

  // ---------------------------------------------------------------- inventory
  const slots: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 28; i++) {
    const c = i % 4, r = Math.floor(i / 4);
    const x = INV.x + c * INV.w + INV.w / 2, y = INV.y + r * INV.h + INV.h / 2;
    const im = sc.add.image(x, y, sc.textures.exists("rs_log") ? "rs_log" : "rs_px").setScale(1.25).setDepth(60).setVisible(false);
    slots.push(im);
    const z = sc.add.zone(x, y, INV.w - 2, INV.h - 2).setInteractive({ useHandCursor: true }).setDepth(61);
    z.on("pointerover", () => inv[i] && hover("Drop", inv[i]!.log, "#ff9040", "Shift-click: drop all"));
    z.on("pointerout", () => hover("", ""));
    z.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (over() || host.box.active || !inv[i]) return;
      if (p.event && (p.event as MouseEvent).shiftKey) dropAll();
      else dropOne(i);
    });
  }
  const invFullFlash = sc.add.rectangle(PX, 198, PW, 300, 0xff0000, 0).setOrigin(0).setDepth(62);
  const button = (x: number, y: number, w: number, label: string, cb: () => void) => {
    const b = sc.add.rectangle(x, y, w, 26, 0x5a4a35).setStrokeStyle(2, 0x1a150f).setDepth(60).setInteractive({ useHandCursor: true });
    const t = txt(x, y, label, "#ff981f", 13, 61).setOrigin(0.5);
    b.on("pointerover", () => b.setFillStyle(0x6e5b42));
    b.on("pointerout", () => b.setFillStyle(0x5a4a35));
    b.on("pointerdown", (_p: unknown, _x: number, _y: number, ev: { stopPropagation: () => void }) => {
      ev?.stopPropagation?.();
      if (!over() && !host.box.active) cb();
    });
    return { b, t };
  };
  button(PX + 58, 518, 108, "Drop all (D)", () => dropAll());
  const reupBtn = button(PX + 178, 518, 108, "Re-up (G)", () => callGary(true));

  // ---------------------------------------------------------------- chatbox
  const CHAT_N = 6;
  const chatRows: { name: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text }[] = [];
  for (let i = 0; i < CHAT_N; i++) {
    const y = CY + 6 + i * 15;
    const name = sc.add.text(CX + 8, y, "", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#000000" }).setDepth(60);
    const body = sc.add.text(CX + 8, y, "", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#0000ff" }).setDepth(60);
    chatRows.push({ name, body });
  }
  const chatLog: { who: string; text: string; game: boolean }[] = [];
  const renderChat = () => {
    const rows = chatLog.slice(-CHAT_N);
    chatRows.forEach((r, i) => {
      const m = rows[i - (CHAT_N - rows.length)];
      if (!m) return void (r.name.setText(""), r.body.setText(""));
      if (m.game) {
        r.name.setText("");
        r.body.setX(CX + 8).setText(m.text).setColor("#ffff00").setShadow(1, 1, "#000000", 0, false, true);
      } else {
        r.name.setText(`${m.who}: `);
        r.body.setX(CX + 8 + r.name.width).setText(m.text).setColor("#0000ff").setShadow(0, 0, "#000000", 0, false, false);
      }
    });
  };
  const game = (text: string) => {
    chatLog.push({ who: "", text, game: true });
    renderChat();
  };
  const chat = (who: string, text: string) => {
    chatLog.push({ who, text, game: false });
    renderChat();
  };
  sc.add.text(CX + 8, CY + CH - 44, "Kreblis: *", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#000000" }).setDepth(60);
  // chat tabs, with the log-out at the end
  const CHAT_TABS = ["All", "Game", "Public", "Private", "Channel", "Clan", "Trade"];
  CHAT_TABS.forEach((t, i) => {
    const x = CX + 2 + i * 80;
    sc.add.rectangle(x, CY + CH - 22, 78, 20, 0x3a3127).setOrigin(0).setStrokeStyle(1, 0x1a150f).setDepth(58);
    txt(x + 39, CY + CH - 12, t, i === 0 ? "#ffffff" : "#ff981f", 11, 59).setOrigin(0.5);
  });
  const logout = sc.add.rectangle(CX + CW - 52, CY + CH - 22, 52, 20, 0x6b1e14).setOrigin(0).setStrokeStyle(1, 0x1a150f).setDepth(58).setInteractive({ useHandCursor: true });
  txt(CX + CW - 26, CY + CH - 12, "Log out", "#ffffff", 11, 59).setOrigin(0.5);
  logout.on("pointerover", () => hover("Log out", "", "#ffffff", "Esc"));
  logout.on("pointerdown", () => quit());

  // ---------------------------------------------------------------- hover text, XP tracker, hud, hint
  const hoverA = txt(VX + 6, VY + 4, "", "#ffffff", 15, 80, PIXEL_BOLD);
  const hoverB = txt(VX + 6, VY + 4, "", "#00ffff", 15, 80, PIXEL_BOLD);
  const hoverC = txt(VX + 6, VY + 4, "", "#ffffff", 15, 80, PIXEL_BOLD);
  const hover = (action: string, target: string, color = "#00ffff", more = "") => {
    hoverA.setText(action ? `${action}${target ? " " : ""}` : "");
    hoverB.setX(hoverA.x + hoverA.width).setText(target).setColor(color);
    hoverC.setX(hoverB.x + hoverB.width).setText(action ? ` / ${more || "4 more options"}` : "");
  };
  hover("Walk here", "");

  sc.add.rectangle(VX + VW - 126, VY + 6, 120, 24, 0x000000, 0.55).setOrigin(0).setStrokeStyle(1, 0x6d5d45).setDepth(80);
  if (sc.textures.exists("rs_axe")) sc.add.image(VX + VW - 114, VY + 18, "rs_axe").setScale(0.65).setDepth(81);
  const xpTotal = txt(VX + VW - 12, VY + 18, "0", "#ffffff", 13, 81).setOrigin(1, 0.5);
  const lvlTxt = txt(VX + VW - 12, VY + 38, "Woodcutting: 1/99", "#ffff00", 12, 81).setOrigin(1, 0.5);
  const unlockTxt = txt(VX + VW - 12, VY + 54, "", "#c0c0c0", 11, 81).setOrigin(1, 0.5);
  host.hud.setPosition(VX + VW / 2 + 70, VY + 6).setOrigin(0.5, 0).setFontFamily(PIXEL_BOLD).setFontSize(15).setColor("#ffff00").setStroke("#000000", 3).setDepth(80);

  const hint = txt(VX + VW / 2, VY + VH - 24, "Click / tap a tree to chop it. When the ring closes, tap it (or SPACE) for bonus XP.", "#ffffff", 13, 82)
    .setOrigin(0.5)
    .setBackgroundColor("#000000aa")
    .setPadding(8, 4, 8, 4);

  // ---------------------------------------------------------------- world: trees, chest, Kreblis, Gary
  const world = sc.add.zone(VX, VY, VW, VH).setOrigin(0).setInteractive().setDepth(1);
  world.on("pointerover", () => hover("Walk here", ""));
  world.on("pointerdown", (p: Phaser.Input.Pointer) => {
    if (over() || host.box.active) return;
    if (chopping && ring && Phaser.Math.Distance.Between(p.x, p.y, ring.x, ring.y) < 50) return void tapRing();
    goTo({ kind: "ground", x: p.x, y: p.y });
  });
  const depthOf = (y: number) => 10 + y / 10;

  const trees: Tree[] = [];
  const pickTier = (allowLocked: boolean): Tier => {
    const open = TIERS.filter((t) => t.req <= level);
    const next = TIERS.find((t) => t.req > level);
    if (allowLocked && next && Math.random() < 0.12) return next;
    const r = Math.random();
    if (open.length === 1 || r < 0.5) return open[open.length - 1];
    if (open.length === 2 || r < 0.8) return open[open.length - 2];
    return open[Math.floor(Math.random() * (open.length - 2))];
  };
  const treeHover = (t: Tree) => (t.down ? hover("Walk here", "") : hover("Chop down", t.tier.name, "#00ffff", t.tier.req > level ? `level ${t.tier.req} needed` : ""));
  const setTier = (t: Tree, tier: Tier) => {
    t.tier = tier;
    t.left = Phaser.Math.Between(tier.logs[0], tier.logs[1]);
    if (sc.textures.exists(tier.key)) t.img.setTexture(tier.key);
    t.img.setScale(1.15).setAngle(0).setAlpha(1);
  };
  SPOTS.forEach(([x, y], i) => {
    const stump = sc.textures.exists("rs_stump")
      ? sc.add.image(x, y + 4, "rs_stump").setOrigin(0.5, 0.9).setScale(0.75)
      : sc.add.ellipse(x, y, 30, 14, 0x6b4a2a);
    stump.setDepth(depthOf(y) - 0.01).setVisible(false);
    const img = sc.add.image(x, y, sc.textures.exists("rs_tree") ? "rs_tree" : "p_tree").setOrigin(0.5, 0.94).setDepth(depthOf(y));
    img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 40 });
    const t: Tree = { i, x, y, tier: TIERS[0], img, stump, left: 1, down: false };
    setTier(t, i === 3 ? TIERS[1] : TIERS[0]);
    img.on("pointerover", () => treeHover(t));
    img.on("pointerout", () => hover("Walk here", ""));
    img.on("pointerdown", (_p: unknown, _x: number, _y: number, ev: { stopPropagation: () => void }) => {
      ev?.stopPropagation?.();
      if (over() || host.box.active) return;
      treeHover(t);
      if (chopping && goal?.kind === "tree" && goal.tree === t && ring) return void tapRing();
      if (t.down) return void goTo({ kind: "ground", x: t.x, y: t.y + 20 });
      goTo({ kind: "tree", tree: t });
    });
    trees.push(t);
  });

  const chest = sc.add.image(CHEST[0], CHEST[1], sc.textures.exists("rs_chest") ? "rs_chest" : "rs_px").setOrigin(0.5, 0.85).setScale(1.05).setDepth(depthOf(CHEST[1]));
  chest.setInteractive({ useHandCursor: true });
  chest.on("pointerover", () => hover("Use", "Bank chest", "#00ffff"));
  chest.on("pointerout", () => hover("Walk here", ""));
  chest.on("pointerdown", (_p: unknown, _x: number, _y: number, ev: { stopPropagation: () => void }) => {
    ev?.stopPropagation?.();
    if (over() || host.box.active) return;
    hover("Use", "Bank chest", "#00ffff");
    goTo({ kind: "chest" });
  });

  const meKey = sc.textures.exists("spr_KREBLIS") ? "spr_KREBLIS" : playerKey(sc);
  const me = sc.add.sprite(360, 300, meKey, 0).setOrigin(0.5, 0.92).setScale(2.2);
  const meta = charMeta(sc, meKey);
  const axe = sc.textures.exists("rs_axe") ? sc.add.image(0, 0, "rs_axe").setOrigin(0.15, 0.85).setScale(0.9).setVisible(false) : null;
  const shadow = sc.add.ellipse(me.x, me.y, 34, 10, 0x000000, 0.3);

  const garyKey = sc.textures.exists("spr_GARY") ? "spr_GARY" : "spr_FOLK2";
  const gary = sc.add.sprite(VX + VW + 40, 250, garyKey, 0).setOrigin(0.5, 0.92).setScale(2.2).setVisible(false);
  gary.setInteractive({ useHandCursor: true });
  gary.on("pointerover", () => hover("Talk-to", "Gary", "#ffff00", "level-2"));
  gary.on("pointerout", () => hover("Walk here", ""));
  gary.on("pointerdown", (_p: unknown, _x: number, _y: number, ev: { stopPropagation: () => void }) => {
    ev?.stopPropagation?.();
    if (over() || host.box.active) return;
    hover("Talk-to", "Gary", "#ffff00", "level-2");
    callGary(true);
  });
  let garyState: "away" | "coming" | "here" | "leaving" = "away";
  const GARY_SPOT = { x: 640, y: 262 };

  // overhead text (the classic yellow speech over a head)
  const overheads = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Text>();
  const say = (who: Phaser.GameObjects.Sprite, s: string, ms = 2200, color = "#ffff00") => {
    overheads.get(who)?.destroy();
    const t = sc.add.text(who.x, who.y - 78, s, { fontFamily: PIXEL_BOLD, fontSize: "14px", color, align: "center", wordWrap: { width: 260 } })
      .setOrigin(0.5, 1)
      .setShadow(1, 1, "#000000", 0, false, true)
      .setDepth(85);
    overheads.set(who, t);
    sc.time.delayedCall(ms, () => {
      if (overheads.get(who) === t) overheads.delete(who);
      t.destroy();
    });
  };

  // first-tree pulse
  const firstTree = trees[0];
  const pulse = sc.add.ellipse(firstTree.x, firstTree.y - 2, 70, 24).setStrokeStyle(3, 0xffff00).setDepth(depthOf(firstTree.y) - 0.02);
  const pulseArrow = txt(firstTree.x, firstTree.y - 112, "▼", "#ffff00", 22, 84, FONT).setOrigin(0.5);
  sc.tweens.add({ targets: pulse, scaleX: 1.25, scaleY: 1.25, alpha: 0.35, yoyo: true, repeat: -1, duration: 520, ease: "Sine.inOut" });
  sc.tweens.add({ targets: pulseArrow, y: firstTree.y - 100, yoyo: true, repeat: -1, duration: 420, ease: "Sine.inOut" });
  const clearTutorial = () => {
    if (firstChop) return;
    firstChop = true;
    sc.tweens.killTweensOf([pulse, pulseArrow]);
    pulse.destroy();
    pulseArrow.destroy();
    sc.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 600 });
  };

  // ---------------------------------------------------------------- movement + actions
  let goal: Goal | null = null;
  let walkTo: { x: number; y: number } | null = null;
  let chopping = false;
  let busyUntil = 0; // banking / trading
  let swingAt = 0;
  let swingN = 0;
  let logAt = 0;
  let cycleStart = 0;
  let ring: { x: number; y: number; t0: number; outer: Phaser.GameObjects.Arc; inner: Phaser.GameObjects.Arc } | null = null;
  let nextRingAt = 0;

  const facing = (): Facing => (me.getData("facing") as Facing) ?? "south";
  const stopChop = () => {
    chopping = false;
    killRing();
    axe?.setVisible(false);
  };
  const standFor = (g: Goal): { x: number; y: number } => {
    if (g.kind === "tree") {
      const side = me.x < g.tree.x ? -1 : 1;
      return { x: g.tree.x + side * 32, y: g.tree.y + 4 };
    }
    if (g.kind === "chest") return { x: CHEST[0] - 40, y: CHEST[1] - 2 };
    if (g.kind === "gary") return { x: gary.x - 36, y: gary.y };
    return { x: g.x, y: g.y };
  };
  const goTo = (g: Goal) => {
    if (clock < busyUntil) return;
    stopChop();
    goal = g;
    const p = standFor(g);
    walkTo = { x: Phaser.Math.Clamp(p.x, WALK.x0, WALK.x1), y: Phaser.Math.Clamp(p.y, WALK.y0, WALK.y1) };
    // the classic yellow-then-red click cross
    const cross = txt(g.kind === "ground" ? g.x : p.x, g.kind === "ground" ? g.y : p.y, "✕", g.kind === "ground" ? "#ffff00" : "#ff2020", 16, 84, FONT).setOrigin(0.5);
    sc.tweens.add({ targets: cross, alpha: 0, scale: 0.6, duration: 380, onComplete: () => cross.destroy() });
  };
  const nearestTree = () => {
    let best: Tree | null = null;
    let bd = Infinity;
    for (const t of trees) {
      if (t.down || t.tier.req > level) continue;
      // bigger trees are worth a longer walk
      const d = Phaser.Math.Distance.Between(me.x, me.y, t.x, t.y) - t.tier.req * 4;
      if (d < bd) (bd = d), (best = t);
    }
    return best;
  };

  const invCount = () => inv.filter(Boolean).length;
  const manic = () => gear > 0;
  const startChop = (t: Tree) => {
    if (t.down) return void game("The tree has already been chopped down.");
    if (t.tier.req > level) {
      game(`You need a Woodcutting level of ${t.tier.req} to chop down this tree.`);
      return void say(me, "Not yet. Not YET.");
    }
    if (invCount() >= 28) return void fullInv();
    clearTutorial();
    chopping = true;
    me.setData("facing", t.x > me.x ? "east" : "west");
    game("You swing your axe at the tree.");
    swingAt = clock;
    newCycle();
  };
  const newCycle = () => {
    const now = clock;
    cycleStart = now;
    logAt = now + (manic() ? Phaser.Math.Between(900, 1500) : Phaser.Math.Between(3000, 4000));
    killRing();
    nextRingAt = manic() ? now + 120 : Infinity;
  };

  // the timing ring: a shrinking circle closes on a fixed one; tap / SPACE as they meet for a quick log and bonus XP
  const RING_IN = 16, RING_OUT = 48, RING_MS = 520;
  const ringR = () => (ring ? RING_OUT - ((RING_OUT - RING_IN) * (clock - ring.t0)) / RING_MS : 0);
  const spawnRing = (t: Tree) => {
    const x = t.x, y = t.y - t.img.displayHeight * 0.55;
    const inner = sc.add.circle(x, y, RING_IN).setStrokeStyle(3, 0xffffff, 0.9).setDepth(86);
    const outer = sc.add.circle(x, y, RING_OUT).setStrokeStyle(3, 0x00ff66).setDepth(86);
    ring = { x, y, t0: clock, outer, inner };
  };
  function killRing() {
    if (!ring) return;
    ring.outer.destroy();
    ring.inner.destroy();
    ring = null;
  }
  const tapRing = () => {
    if (!ring || !chopping || goal?.kind !== "tree") return;
    const err = Math.abs(ringR() - RING_IN);
    const { x, y } = ring;
    killRing();
    let label = "Miss";
    let col = "#9ca3af";
    let mult = 0;
    if (err <= 5) (label = "Perfect!"), (col = "#ffd23f"), (mult = 1.6), perfects++;
    else if (err <= 11) (label = "Good"), (col = "#7dff7d"), (mult = 1.25);
    const t = txt(x, y - 30, label, col, mult >= 1.6 ? 18 : 14, 87, PIXEL_BOLD).setOrigin(0.5);
    sc.tweens.add({ targets: t, y: y - 54, alpha: 0, duration: 650, onComplete: () => t.destroy() });
    if (mult) {
      const burst = sc.add.circle(x, y, RING_IN, mult >= 1.6 ? 0xffd23f : 0x7dff7d, 0.5).setDepth(86);
      sc.tweens.add({ targets: burst, scale: 2.2, alpha: 0, duration: 260, onComplete: () => burst.destroy() });
      getLog(goal.tree, mult);
    }
  };

  const chips = (x: number, y: number) => {
    for (let k = 0; k < 4; k++) {
      const c = sc.add.rectangle(x, y, 3, 3, Phaser.Utils.Array.GetRandom([0xc8a070, 0x8a6038, 0xe8d0a0])).setDepth(depthOf(y) + 0.5);
      sc.tweens.add({ targets: c, x: x + Phaser.Math.Between(-22, 22), y: y + Phaser.Math.Between(-18, 10), alpha: 0, duration: 380, onComplete: () => c.destroy() });
    }
  };

  const slotPos = (i: number) => ({ x: INV.x + (i % 4) * INV.w + INV.w / 2, y: INV.y + Math.floor(i / 4) * INV.h + INV.h / 2 });
  const renderInv = () => inv.forEach((t, i) => slots[i].setVisible(!!t).setTint(t?.tint ?? 0xffffff));

  const xpDrop = (n: number, perfect: boolean) => {
    const c = sc.add.container(VX + VW - 50, VY + 200).setDepth(83);
    const ic = sc.textures.exists("rs_axe") ? sc.add.image(-6, 0, "rs_axe").setScale(0.55).setOrigin(1, 0.5) : null;
    const t = txt(0, 0, `+${fmt(n)}`, perfect ? "#ffd23f" : "#ffffff", 14, 83, PIXEL_BOLD).setOrigin(0, 0.5);
    if (ic) c.add(ic);
    c.add(t);
    sc.tweens.add({ targets: c, y: VY + 72, duration: 1150, ease: "Sine.in", onComplete: () => c.destroy() });
    sc.tweens.add({ targets: c, alpha: 0, delay: 850, duration: 300 });
  };

  const getLog = (t: Tree, mult = 1) => {
    if (t.down || over()) return;
    const slot = inv.indexOf(null);
    if (slot < 0) return void fullInv();
    inv[slot] = t.tier;
    logsTotal++;
    synth.play("rs_log", 0.7);
    game(t.tier.log === "Logs" ? "You get some logs." : `You get some ${t.tier.log.toLowerCase()}.`);
    // the log flies into the pack
    const s = slotPos(slot);
    const fly = sc.add.image(t.x, t.y - 30, sc.textures.exists("rs_log") ? "rs_log" : "rs_px").setTint(t.tier.tint).setScale(1.25).setDepth(90);
    sc.tweens.add({ targets: fly, x: s.x, y: s.y, duration: 420, ease: "Quad.in", onComplete: () => (fly.destroy(), renderInv()) });
    // XP
    const before = level;
    const xp0 = xpAt(L);
    L = Math.min(99, L + t.tier.dl * (mult || 1));
    const gain = Math.max(1, xpAt(L) - xp0);
    xpDrop(gain, mult >= 1.6);
    level = Math.floor(L);
    if (level > before) levelUp(before, level);
    t.left--;
    if (t.left <= 0) fell(t);
    else if (chopping) newCycle();
    if (invCount() >= 28 && level < 99) fullInv();
  };

  const fell = (t: Tree) => {
    t.down = true;
    stopChop();
    synth.play("rs_fall", 0.8);
    game("You get some logs. The tree falls.");
    const dirn = me.x < t.x ? 1 : -1;
    t.img.disableInteractive();
    sc.tweens.add({ targets: t.img, angle: 88 * dirn, alpha: 0, duration: 560, ease: "Quad.in", onComplete: () => t.img.setVisible(false) });
    t.stump.setVisible(true);
    for (let k = 0; k < 8; k++) chips(t.x + Phaser.Math.Between(-30, 30) * dirn, t.y - Phaser.Math.Between(0, 30));
    sc.time.delayedCall(Phaser.Math.Between(3200, 5200), () => respawn(t));
    // keep going: if another tree is close, say so in the hover
    if (level < 99 && invCount() < 28) {
      const n = nearestTree();
      if (n) treeHover(n);
    }
  };
  const respawn = (t: Tree) => {
    if (over()) return;
    setTier(t, pickTier(true));
    t.down = false;
    t.stump.setVisible(false);
    t.img.setVisible(true).setAlpha(0).setScale(0.4);
    t.img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 40 });
    sc.tweens.add({ targets: t.img, alpha: 1, scale: 1.15, duration: 380, ease: "Back.out" });
  };

  let fullWarned = 0;
  const fullInv = () => {
    stopChop();
    if (clock - fullWarned < 1500) return;
    fullWarned = clock;
    game("Your inventory is too full to hold any more logs.");
    say(me, "Bank it or drop it, son.");
    invFullFlash.setFillStyle(0xff0000, 0.25);
    sc.tweens.add({ targets: invFullFlash, fillAlpha: 0, duration: calm ? 900 : 500 });
    sc.tweens.add({ targets: chest, y: CHEST[1] - 8, yoyo: true, repeat: 3, duration: 180 });
  };

  const dropOne = (i: number) => {
    if (!inv[i]) return;
    inv[i] = null;
    dropped++;
    renderInv();
    synth.play("rs_log", 0.35);
  };
  const dropAll = () => {
    if (!invCount()) return void game("You have nothing to drop.");
    // the powerchopper's shuffle: down the columns, quick as you like
    const order: number[] = [];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 7; r++) order.push(r * 4 + c);
    let k = 0;
    for (const i of order) if (inv[i]) sc.time.delayedCall(25 * k++, () => dropOne(i));
    game("You drop your logs. Powerchopping, like a professional.");
  };
  const bank = () => {
    const n = invCount();
    busyUntil = clock + 500;
    synth.play("rs_bank", 0.8);
    if (!n) return void game("You have nothing to deposit.");
    banked += n;
    inv.fill(null);
    renderInv();
    game(`You deposit ${n} logs into the bank chest.`);
    say(me, ["Banked.", "Lumbridge thanks you.", "Logs secured."][banked % 3]);
  };

  // ---------------------------------------------------------------- gear + Gary
  let garyCalled = false;
  const garyAppear = () => {
    if (garyState !== "away" || over()) return;
    garyState = "coming";
    gary.setVisible(true).setPosition(VX + VW + 30, GARY_SPOT.y);
    game("Gary would like a word.");
    sc.tweens.add({
      targets: gary,
      x: GARY_SPOT.x,
      duration: 900,
      onUpdate: () => animateWalker(gary, -1, 0, true, clock),
      onComplete: () => {
        garyState = "here";
        animateWalker(gary, -1, 0, false, clock);
        say(gary, "Kreblis! Gary would like a word.", 2600);
        if (garyCalled) goTo({ kind: "gary" });
      },
    });
  };
  const callGary = (byPlayer: boolean) => {
    if (clock < busyUntil) return;
    if (byPlayer && gear >= 85 && garyState === "away") return void game("You've got plenty of gear. (For now.)");
    garyCalled = byPlayer || garyCalled;
    if (garyState === "here") goTo({ kind: "gary" });
    else garyAppear();
  };
  const trade = () => {
    garyCalled = false;
    reups++;
    busyUntil = clock + 900;
    stopChop();
    synth.play("door");
    say(gary, GARY_LINES[(reups - 1) % GARY_LINES.length], 1600);
    chat("Gary", GARY_LINES[(reups - 1) % GARY_LINES.length]);
    sc.time.delayedCall(700, () => {
      if (over()) return;
      gear = 100;
      say(me, "Hmmmm… gear… 😋", 1800);
      chat("Kreblis", "Hmmmm… gear… 😋");
      game("You feel manic. Your chopping speed is greatly increased.");
      garyState = "leaving";
      sc.tweens.add({
        targets: gary,
        x: VX + VW + 40,
        delay: 400,
        duration: 900,
        onUpdate: () => animateWalker(gary, 1, 0, true, clock),
        onComplete: () => {
          garyState = "away";
          gary.setVisible(false);
        },
      });
      // straight back to it
      const n = nearestTree();
      if (n) sc.time.delayedCall(250, () => !over() && !chopping && !walkTo && goTo({ kind: "tree", tree: n }));
    });
  };

  // ---------------------------------------------------------------- level-ups (the popup sits in the chatbox, like it should)
  const lvlBox = sc.add.container(CX, CY).setDepth(70).setVisible(false);
  lvlBox.add(sc.add.rectangle(0, 0, CW, CH - 26, 0xcfbf98).setOrigin(0).setStrokeStyle(2, 0x8a7550));
  if (sc.textures.exists("rs_axe")) lvlBox.add(sc.add.image(52, 60, "rs_axe").setScale(2));
  const lvl1 = sc.add.text(CW / 2 + 30, 26, "Congratulations, you just advanced a Woodcutting level.", { fontFamily: PIXEL_BOLD, fontSize: "15px", color: "#000080" }).setOrigin(0.5);
  const lvl2 = sc.add.text(CW / 2 + 30, 54, "", { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#000000" }).setOrigin(0.5);
  const lvl3 = sc.add.text(CW / 2 + 30, 88, "Click here to continue", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#0000ff" }).setOrigin(0.5);
  lvlBox.add([lvl1, lvl2, lvl3]);
  const lvlZone = sc.add.zone(CX, CY, CW, CH - 26).setOrigin(0).setDepth(71).setInteractive({ useHandCursor: true });
  lvlZone.on("pointerdown", () => lvlBox.setVisible(false));
  lvlZone.disableInteractive();
  let lvlHideAt = 0;

  const fireworks = (x: number, y: number, big: boolean) => {
    const n = calm ? 10 : big ? 34 : 18;
    const cols = [0xffd23f, 0xff4d4d, 0x4dd2ff, 0x7dff7d, 0xff7dff];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.3;
      const d = (big ? 70 : 46) + Math.random() * 24;
      const p = sc.add.image(x, y, "rs_px").setTint(cols[k % cols.length]).setDepth(88).setScale(calm ? 1 : 1.2);
      sc.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8 + 18, alpha: 0, duration: calm ? 1300 : 800 + Math.random() * 300, ease: "Quad.out", onComplete: () => p.destroy() });
    }
  };
  const levelUp = (from: number, to: number) => {
    const unlocked = TIERS.filter((t) => t.req > from && t.req <= to);
    const milestone = unlocked.length > 0 || Math.floor(to / 10) > Math.floor(from / 10) || to >= 99;
    synth.play(milestone ? "rs_levelup" : "gunget", milestone ? 0.9 : 0.6);
    fireworks(me.x, me.y - 50, milestone);
    game(`Congratulations, you just advanced a Woodcutting level. Your Woodcutting level is now ${to}.`);
    // the big popup for the milestones only: levels come thick and fast, and the chat needs to stay readable
    const lu = txt(me.x, me.y - 96, `Level ${to}!`, "#ffd23f", milestone ? 17 : 13, 87, PIXEL_BOLD).setOrigin(0.5);
    sc.tweens.add({ targets: lu, y: lu.y - 26, alpha: 0, delay: 350, duration: 700, onComplete: () => lu.destroy() });
    if (milestone) {
      lvl2.setText(`Your Woodcutting level is now ${to}.`);
      lvlBox.setVisible(true);
      lvlZone.setInteractive({ useHandCursor: true });
      lvlHideAt = clock + 2400;
    }
    for (const tier of unlocked) {
      game(`You can now chop ${tier.name === "Magic tree" ? "Magic trees" : `${tier.name} trees`}!`);
      say(me, `${tier.name.toUpperCase()}S. LET'S GO.`, 1600);
      // a couple of the standing trees grow up on the spot, so the new tier is there to chop right now
      const pool = trees.filter((t) => !t.down && !(chopping && goal?.kind === "tree" && goal.tree === t) && t.tier.req < tier.req);
      Phaser.Utils.Array.Shuffle(pool).slice(0, 2).forEach((t) => {
        setTier(t, tier);
        fireworks(t.x, t.y - 50, false);
      });
    }
  };

  // ---------------------------------------------------------------- the win, the fail, the log-out
  const win = () => {
    won = true;
    stopChop();
    walkTo = null;
    synth.play("rs_levelup", 1);
    sc.time.delayedCall(900, () => synth.play("cheer"));
    const dim = sc.add.rectangle(VX, VY, VW, VH, 0x000000, 0).setOrigin(0).setDepth(140);
    sc.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 600 });
    const cx = VX + VW / 2;
    if (sc.textures.exists("rs_cape")) {
      const cape = sc.add.image(cx + 40, VY + 200, "rs_cape").setScale(0.5).setAlpha(0).setDepth(142);
      sc.tweens.add({ targets: cape, scale: 2.4, alpha: 1, y: VY + 180, duration: 900, ease: "Back.out" });
      sc.tweens.add({ targets: cape, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 900, delay: 900, ease: "Sine.inOut" });
    }
    const t1 = sc.add.text(cx, VY + 52, "99 WOODCUTTING", { fontFamily: PIXEL_BOLD, fontSize: "40px", color: "#ffd23f", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(143).setAlpha(0);
    const t2 = sc.add.text(cx, VY + 318, "HISCORES: RANK 1 (OVERALL, OF ALL TIME)", { fontFamily: PIXEL_BOLD, fontSize: "20px", color: "#ffffff", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(143).setAlpha(0);
    sc.tweens.add({ targets: t1, alpha: 1, duration: 500 });
    sc.tweens.add({ targets: t2, alpha: 1, delay: 900, duration: 500 });
    for (let k = 0; k < (calm ? 3 : 6); k++) sc.time.delayedCall(300 + k * 380, () => fireworks(cx + Phaser.Math.Between(-220, 220), VY + Phaser.Math.Between(90, 260), true));
    me.setDepth(141).setFlipX(false);
    axe?.setVisible(false);
    shadow.setVisible(false);
    overheads.forEach((t) => t.destroy());
    overheads.clear();
    sc.tweens.add({ targets: [hoverA, hoverB, hoverC, host.hud, xpTotal, lvlTxt, unlockTxt], alpha: 0, duration: 300 });
    sc.tweens.add({ targets: me, x: cx - 150, y: VY + 290, duration: 500, ease: "Quad.out" });
    me.setScale(3.2);
    const vic = meta?.victory?.south;
    if (vic) {
      let f = 0;
      sc.time.addEvent({ delay: 130, repeat: 30, callback: () => me.setFrame(vic[Math.min(vic.length - 1, f++)]) });
    }
    sc.time.delayedCall(560, () => say(me, "Skillcape. Emote. Now.", 2600));
    game("Congratulations, you've reached the highest possible Woodcutting level of 99.");
    game(`Woodcutting cape unlocked. Gary is already outside asking about the cape.`);
    sc.time.delayedCall(3600, () =>
      host.finish(true, [dir(`Gear re-ups required: ${reups}. Gary has bought a boat.`), dir(`${logsTotal} logs cut (${banked} banked, ${dropped} dropped). Perfect swings: ${perfects}.`)]),
    );
  };
  const timeUp = () => {
    stopChop();
    game("Your mum is calling you.");
    host.finish(false, [dir(`Woodcutting level ${level}. ${fmt(xpAt(L))} XP.`), dir("Your mum calls you down for dinner. The session is over. Lumbridge weeps.")]);
  };
  const quit = () => {
    if (over() || host.box.active) return;
    stopChop();
    host.finish(false, [dir(`You log out at Woodcutting level ${level}. The tree is still there. It's always there.`)]);
  };

  // ---------------------------------------------------------------- keys
  const kb = sc.input.keyboard;
  const space = () => {
    if (over() || host.box.active) return;
    if (ring) return void tapRing();
    if (chopping) return;
    if (invCount() >= 28) return void fullInv();
    const n = nearestTree();
    if (n) {
      treeHover(n);
      goTo({ kind: "tree", tree: n });
    }
  };
  kb?.on("keydown-SPACE", space);
  kb?.on("keydown-E", space);
  kb?.on("keydown-G", () => !over() && !host.box.active && callGary(true));
  kb?.on("keydown-D", () => !over() && !host.box.active && dropAll());
  kb?.on("keydown-B", () => !over() && !host.box.active && goTo({ kind: "chest" }));
  kb?.on("keydown-ESC", () => quit());
  gearZone.on("pointerover", () => hover("Re-up", "Gear", "#ffff00", "Gary"));
  gearZone.on("pointerdown", () => !over() && !host.box.active && callGary(true));

  // ---------------------------------------------------------------- the loop
  let crawlLine = 0;
  let lastCrawlSay = 0;
  let gearWarned = false;
  const onUpdate = (_t: number, dtMs: number) => {
    if (over()) return;
    if (host.box.active) return;
    const dt = Math.min(dtMs, 100) / 1000;
    elapsed += dt;
    clock += dt * 1000;
    const now = clock;

    // walking
    if (walkTo) {
      const dx = walkTo.x - me.x, dy = walkTo.y - me.y;
      const d = Math.hypot(dx, dy);
      const sp = (manic() ? 290 : 170) * dt;
      if (d <= sp) {
        me.setPosition(walkTo.x, walkTo.y);
        walkTo = null;
        animateWalker(me, dx, dy, false, now);
        const g = goal;
        if (g?.kind === "tree") startChop(g.tree);
        else if (g?.kind === "chest") bank();
        else if (g?.kind === "gary") {
          if (garyState === "here") trade();
          else game("Gary has wandered off. He'll be back.");
        }
      } else {
        me.x += (dx / d) * sp;
        me.y += (dy / d) * sp;
        animateWalker(me, dx, dy, true, now);
      }
    }

    // chopping: the swing, the ring, the log
    if (chopping && goal?.kind === "tree") {
      const t = goal.tree;
      if (t.down) stopChop();
      else {
        const period = manic() ? 420 : 950;
        const f = facing() === "west" ? "west" : "east";
        const cyc = meta?.attack?.east;
        const ph = ((now - swingAt) % period) / period;
        if (cyc) me.setFrame(cyc[Math.min(cyc.length - 1, Math.floor(ph * cyc.length))]).setFlipX(f === "west");
        if (axe) {
          axe.setVisible(true).setFlipX(f === "west");
          const sgn = f === "west" ? -1 : 1;
          axe.setPosition(me.x + sgn * 14, me.y - 34).setAngle(sgn * (-70 + 110 * Math.sin(ph * Math.PI)));
          axe.setOrigin(f === "west" ? 0.85 : 0.15, 0.85);
        }
        const n = Math.floor((now - swingAt) / period);
        if (n !== swingN) {
          swingN = n;
          synth.play("rs_chop", manic() ? 0.55 : 0.4);
          sc.tweens.add({ targets: t.img, angle: { from: f === "west" ? 2.5 : -2.5, to: 0 }, duration: 140 });
          chips(t.x + (f === "west" ? 10 : -10), t.y - 18);
        }
        if (ring) {
          const r = ringR();
          ring.outer.setRadius(Math.max(4, r));
          ring.outer.setStrokeStyle(3, Math.abs(r - RING_IN) <= 5 ? 0xffd23f : Math.abs(r - RING_IN) <= 11 ? 0x7dff7d : 0x00ff66);
          if (r < RING_IN - 10) killRing();
        } else if (now >= nextRingAt && manic()) {
          nextRingAt = Infinity;
          spawnRing(t);
        }
        if (now >= logAt) getLog(t);
        if (!manic() && now - lastCrawlSay > 4200) {
          lastCrawlSay = now;
          const l = CRAWL_LINES[crawlLine++ % CRAWL_LINES.length];
          say(me, l, 2400);
          chat("Kreblis", l);
        }
      }
    } else if (!walkTo && !won) {
      me.setFlipX(false);
      animateWalker(me, 0, 0, false, now);
      axe?.setVisible(false);
    }
    me.setDepth(depthOf(me.y) + 0.005);
    axe?.setDepth(me.depth + 0.001);
    shadow.setPosition(me.x, me.y).setDepth(me.depth - 0.002);
    gary.setDepth(depthOf(gary.y));
    for (const [who, t] of overheads) t.setPosition(who.x, who.y - 78);

    // gear: drains faster while chopping
    gear = Math.max(0, gear - (chopping ? 4.6 : 2.2) * dt);
    const gf = gear / 100;
    gearOrb.fill.setScale(0.25 + 0.75 * gf).setFillStyle(gear > 30 ? 0x2fbf3f : gear > 0 ? 0xe0a020 : 0x6b1e14);
    gearOrb.num.setText(String(Math.ceil(gear))).setColor(gear > 30 ? "#00ff00" : gear > 0 ? "#ffff00" : "#ff2020");
    reupBtn.t.setColor(gear < 35 ? "#ffff00" : "#ff981f");
    if (gear < 35 && garyState === "away") garyAppear();
    if (gear <= 0 && !gearWarned) {
      gearWarned = true;
      say(me, CRAWL_LINES[0], 2600);
      chat("Kreblis", CRAWL_LINES[0]);
      game("You've run out of gear. Your chopping slows to a crawl.");
      if (ring) killRing();
      crawlLine = 1;
      lastCrawlSay = now;
    }
    if (gear > 0) gearWarned = false;

    // level-up popup
    if (lvlBox.visible && now > lvlHideAt) {
      lvlBox.setVisible(false);
      lvlZone.disableInteractive();
    }

    // minimap
    mmDots.clear();
    for (const t of trees) {
      if (t.down) mmDots.fillStyle(0x6b4a2a).fillRect(mmX(t.x) - 1.5, mmY(t.y) - 1.5, 3, 3);
      else mmDots.fillStyle(t.tier.dot).fillCircle(mmX(t.x), mmY(t.y) - 2, 4).lineStyle(1, 0x0d1a08).strokeCircle(mmX(t.x), mmY(t.y) - 2, 4);
    }
    mmDots.fillStyle(0xffcc00).fillCircle(mmX(CHEST[0]), mmY(CHEST[1]), 4).fillStyle(0x6b4a00).fillRect(mmX(CHEST[0]) - 1, mmY(CHEST[1]) - 2, 2, 4);
    if (gary.visible) mmDots.fillStyle(0xffff00).fillCircle(mmX(gary.x), mmY(gary.y), 2.5);
    mmDots.fillStyle(0xffffff).fillRect(mmX(me.x) - 2, mmY(me.y) - 2, 4, 4);
    if (walkTo) mmDots.fillStyle(0xff2020).fillRect(mmX(walkTo.x) - 1, mmY(walkTo.y) - 4, 2, 5);

    // trackers
    xpTotal.setText(fmt(xpAt(L)));
    lvlTxt.setText(`Woodcutting: ${level}/99`);
    const next = TIERS.find((t) => t.req > level);
    unlockTxt.setText(next ? `${next.name}: level ${next.req}` : "Everything unlocked");
    const left = Math.max(0, SESSION_S - elapsed);
    host.hud.setText(`TIME ${Math.ceil(left)}s    RE-UPS ${reups}`);

    if (level >= 99) return win();
    if (left <= 0) timeUp();
  };
  sc.events.on("update", onUpdate);
  sc.events.once("shutdown", () => sc.events.off("update", onUpdate));

  // test hook (the bot and DebugScene read this; nothing in the game does)
  (sc as unknown as { __rs: unknown }).__rs = {
    get level() { return level; },
    get gear() { return gear; },
    get chopping() { return chopping; },
    get walking() { return !!walkTo; },
    get inv() { return invCount(); },
    get won() { return won; },
    get ring() { return ring ? { x: ring.x, y: ring.y, r: ringR(), target: RING_IN } : null; },
    get gary() { return garyState === "here" ? { x: gary.x, y: gary.y - 30 } : null; },
    get busy() { return clock < busyUntil; },
    trees: () => trees.map((t) => ({ x: t.x, y: t.y - 40, down: t.down, req: t.tier.req, name: t.tier.name })),
    chest: { x: CHEST[0], y: CHEST[1] - 18 },
    stats: () => ({ reups, logsTotal, banked, dropped, perfects, xp: xpAt(L), t: elapsed }),
  };

  game("Welcome to RuneScape.");
  game("Click a tree to chop it. Tap the ring as it closes for bonus XP.");
  sc.time.delayedCall(600, () => !over() && say(me, "Servers playing up again… doesn't matter.", 2600));
  renderInv();
}
