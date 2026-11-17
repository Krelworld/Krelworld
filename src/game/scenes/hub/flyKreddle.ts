import Phaser from "phaser";

/**
 * Kreddle, for the flyover: the Strip over the bridge, snapshotted once into a ground texture and a billboard atlas
 * without running KreddleScene. The layout (where each building, machine and neon sign sits on the Strip, and how big)
 * is KreddleScene's own (its drawWorld / drawStrip / kreddleLife), composited here straight from the art manifest.
 *
 * Kreddle lies west of Krelford, over a river. The Strip runs west from the bridge, so the scene's x (east from its
 * bridge end) is mirrored into the world: world x = KE - kx. Its building line sits at world y KBASE, which puts
 * Kreddle's bridge (at Strip y 560) level with Krelford's (world y 825).
 */

/** World x of Kreddle's bridge end (the river is between here and the town's west edge, x = 0). */
export const KE = -520;
/** World y of the Strip's building line (Strip y 404). */
const KBASE = 669;
/** The bridge deck across the river: world y range. */
export const BRIDGE_Y0 = 780;
export const BRIDGE_Y1 = 870;
export const kwx = (kx: number) => KE - kx;
export const kwy = (ky: number) => KBASE + ky - 404;
/** The Strip's ground snapshot, in Strip coordinates. */
const KX1 = 2750;
const KTOP = -300;
const KBOT = 1080;
/** World rectangle the ground snapshot covers (x0 is the far west end). */
export const KGROUND = { x0: kwx(KX1), x1: kwx(0), y0: kwy(KTOP), y1: kwy(KBOT) };

const NEON = [0xff4fd8, 0x22d3ee, 0xfacc15, 0xa855f7, 0x4ade80];

/** A billboard in the flyover: its base line's centre and half-width, its height (world px), and its atlas rect. */
export interface FlyBoard {
  x: number;
  y: number;
  hw: number;
  h: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  vi: number;
  /** lies flat on the ground over this world rectangle [x0, y0, x1, y1] instead of standing up */
  flat?: [number, number, number, number];
}

/** A neon glow hanging off the Strip: at (x, y), `hz` up the billboard it belongs to, `size` world px across. */
export interface FlyGlow {
  x: number;
  y: number;
  hz: number;
  size: number;
  col: number;
  a: number;
  ph: number;
  bad: boolean;
}

/** A searchlight raking the Kreddle sky. */
export interface FlyBeam {
  x: number;
  y: number;
  col: number;
  ph: number;
}

export interface KreddleSnap {
  groundKey: string;
  atlasKey: string;
  boards: FlyBoard[];
  glows: FlyGlow[];
  beams: FlyBeam[];
}

interface Part {
  key: string;
  frame?: number;
  dx: number;
  dy: number;
  scale: number;
  tint?: number;
}
interface Sign {
  text: string;
  color: string;
  size: number;
  dy: number;
  bad?: boolean;
}
interface Spec {
  kx: number;
  ky: number;
  parts: Part[];
  sign?: Sign;
  /** a gantry: two posts this far apart and this tall */
  posts?: { w: number; h: number };
  /** a pool of light at the foot */
  foot?: number;
}

/** Snapshot Kreddle into `${prefix}_ground` and `${prefix}_atlas`. Call once; remove both textures when done. */
export function snapKreddle(sc: Phaser.Scene, prefix: string, S: number): KreddleSnap {
  const has = (k: string) => sc.textures.exists(k);
  const groundKey = `${prefix}_ground`;
  const atlasKey = `${prefix}_atlas`;
  for (const k of [groundKey, atlasKey]) if (has(k)) sc.textures.remove(k);
  const rnd = new Phaser.Math.RandomDataGenerator(["kreddle"]);
  const tmp: Phaser.GameObjects.GameObject[] = [];
  const t = <T extends Phaser.GameObjects.GameObject>(g: T) => (tmp.push(g), g);

  // ---- the ground: back lots, the pavement, the wet neon tarmac, puddles of light ----
  const GW = Math.ceil(KX1 * S);
  const GH = Math.ceil((KBOT - KTOP) * S);
  const ground = sc.textures.addDynamicTexture(groundKey, GW, GH)!;
  ground.camera.setOrigin(0, 0);
  ground.camera.setZoom(S);
  ground.camera.setScroll(0, KTOP);
  ground.fill(0x0d0619);
  const g = t(new Phaser.GameObjects.Graphics(sc));
  // the blocks behind the Strip and across the road: dark roofs, lit windows
  const blocks = (y0: number, y1: number) => {
    for (let x = 0; x < KX1; x += 150 + rnd.between(0, 60)) {
      for (let y = y0; y < y1 - 60; y += 130 + rnd.between(0, 40)) {
        const w = rnd.between(90, 140);
        const h = rnd.between(70, 110);
        g.fillStyle(rnd.pick([0x1b0e33, 0x221040, 0x170b2b]), 1).fillRect(x, y, w, h);
        g.lineStyle(2, rnd.pick(NEON), 0.35).strokeRect(x, y, w, h);
        for (let i = 0; i < 6; i++) g.fillStyle(rnd.pick(NEON), 0.55).fillRect(x + rnd.between(6, w - 12), y + rnd.between(6, h - 10), 6, 4);
      }
    }
  };
  blocks(KTOP + 20, 380);
  blocks(770, KBOT);
  // the pavements and the street (KreddleScene.drawWorld)
  g.fillStyle(0x140a24, 1).fillRect(0, 400, KX1, 300);
  g.fillStyle(0x23123d, 1).fillRect(0, 400, KX1, 46);
  for (let x = 0; x < KX1; x += 46) g.lineStyle(1, 0x3b1d63, 1).strokeRect(x, 400, 46, 46);
  g.fillStyle(0x23123d, 1).fillRect(0, 700, KX1, 60);
  for (let x = 0; x < KX1; x += 46) g.lineStyle(1, 0x3b1d63, 1).strokeRect(x, 700, 46, 60);
  ground.draw(g);
  if (has("kd_tarmac")) ground.draw(t(new Phaser.GameObjects.TileSprite(sc, 0, 446, KX1, 254, "kd_tarmac").setOrigin(0).setAlpha(0.9)));
  const g2 = t(new Phaser.GameObjects.Graphics(sc));
  g2.lineStyle(3, 0xff4fd8, 0.55).lineBetween(0, 446, KX1, 446);
  g2.lineStyle(3, 0x22d3ee, 0.5).lineBetween(0, 700, KX1, 700);
  for (let x = 40; x < KX1; x += 160) g2.fillStyle(0xfacc15, 0.6).fillRect(x, 590, 70, 6);
  ground.draw(g2);
  const pools: Phaser.GameObjects.Ellipse[] = [];
  for (let i = 0; i < 30; i++) pools.push(t(new Phaser.GameObjects.Ellipse(sc, 80 + rnd.frac() * (KX1 - 160), 470 + rnd.frac() * 200, 50 + rnd.frac() * 70, 10 + rnd.frac() * 8, NEON[i % NEON.length], 0.16)));
  // the crowd's glow (kreddleLife), frozen
  for (let i = 0; i < 9; i++) pools.push(t(new Phaser.GameObjects.Ellipse(sc, 200 + (i * (KX1 - 400)) / 8, 520 + (i % 3) * 50, 300, 80, NEON[i % NEON.length], 0.12)));
  for (const p of pools) p.setBlendMode(Phaser.BlendModes.ADD);
  ground.draw(pools);
  ground.setFilter(Phaser.Textures.FilterMode.LINEAR);

  // ---- the tall things (KreddleScene.drawStrip / spawnPeople), each composited with its neon sign ----
  const specs: Spec[] = [];
  const img = (key: string, scale: number, extra: Partial<Part> = {}): Part => ({ key, dx: 0, dy: 0, scale, ...extra });
  const bld = (key: string, kx: number, sign: string, color: string, tint?: number, bad = false) => {
    const h = has(key) ? sc.textures.getFrame(key).height * 1.6 : 240;
    specs.push({ kx, ky: 404, parts: [img(key, 1.6, { tint })], sign: { text: sign, color, size: 26, dy: -h - 18, bad }, foot: 0.8 });
  };
  const machine = (key: string, kx: number, ky: number, scale: number, sign?: Omit<Sign, "dy"> & { at?: number }) => {
    const h = has(key) ? sc.textures.getFrame(key).height * scale : 100;
    specs.push({ kx, ky, parts: [img(key, scale)], sign: sign && { ...sign, dy: sign.at !== undefined ? sign.at - ky : -h - 14 }, foot: 1.2 });
  };
  // the way in: a gantry over the bridge end
  specs.push({ kx: -12, ky: 560, parts: [], posts: { w: 360, h: 150 }, sign: { text: "★ WELCOME TO KREDDLE ★", color: "#ff4fd8", size: 34, dy: -170 } });
  machine("kd_exchange", 352, 505, 1.3, { text: "THE KREDDLE EXCHANGE", color: "#facc15", size: 16 });
  bld("kd_bld_arcade", 622, "KRAZY KREDDLE ARCADE", "#facc15");
  for (let i = 0; i < 4; i++) machine("kd_m_slots", 495 + i * 85, 500, 1.15);
  bld("kd_bld_casino", 980, "THE GOLDEN KLAW CASINO", "#22d3ee");
  for (let i = 0; i < 3; i++) machine("kd_m_claw", 890 + i * 90, 505, 1.05);
  machine("kd_m_wheel", 1300, 540, 1.7, { text: "WHEEL OF KREDDLE", color: "#a855f7", size: 22, at: 335 });
  machine(has("kd_m_whack") ? "kd_m_whack" : "kd_m_slots", 1462, 522, 1.25, { text: "WHACK-A-DRONGUS", color: "#4ade80", size: 17 });
  bld("kd_bld_hotel", 1620, "THE KLERBLE GRAND", "#facc15", undefined, true);
  machine("kd_m_cards", 1950, 600, 1.5, { text: "KREDDLE KARDS", color: "#4ade80", size: 20, at: 470 });
  bld("kd_bld_arcade", 2300, "KREDDLE KRUNCHERS HQ", "#ff4fd8", 0x9be7ff);
  if (has("kd_fountain_anim")) specs.push({ kx: 1795, ky: 662, parts: [img("kd_fountain_anim", 1.35, { frame: 0 })], foot: 1.3 });
  // the people: President Klerble outside his hotel, the Pit Boss on the bridge, some Kreddlers
  const person = (key: string, kx: number, ky: number, tint?: number) => {
    if (has(key)) specs.push({ kx, ky: ky + 64, parts: [img(key, 2, { frame: 0, tint })] });
  };
  person("spr_TV_PRESIDENT_KLERBLE", 1620, 470);
  person("spr_KD_PITBOSS", 240, 520);
  [
    [720, 560],
    [1120, 630],
    [1420, 600],
    [1760, 545],
    [2080, 640],
    [2460, 580],
    [860, 655],
  ].forEach(([x, y], i) => person(["spr_KD_MAN", "spr_KD_WOMAN"][i % 2], x, y, i % 3 === 2 ? NEON[i % NEON.length] | 0x808080 : undefined));

  // build each one as a container (art + sign), measure it, and pack them
  const built = specs.map((s) => {
    const c = t(new Phaser.GameObjects.Container(sc, 0, 0));
    let x0 = 0;
    let x1 = 0;
    let y0 = 0;
    for (const p of s.parts) {
      if (!has(p.key)) continue;
      const im = new Phaser.GameObjects.Image(sc, p.dx, p.dy, p.key, p.frame).setOrigin(0.5, 1).setScale(p.scale);
      if (p.tint) im.setTint(p.tint);
      c.add(im);
      x0 = Math.min(x0, p.dx - im.displayWidth / 2);
      x1 = Math.max(x1, p.dx + im.displayWidth / 2);
      y0 = Math.min(y0, p.dy - im.displayHeight);
    }
    if (s.posts) {
      const pg = new Phaser.GameObjects.Graphics(sc);
      for (const sx of [-1, 1]) {
        pg.fillStyle(0x1a1028, 1).fillRect((sx * s.posts.w) / 2 - 7, -s.posts.h, 14, s.posts.h);
        pg.lineStyle(2, 0x22d3ee, 0.9).strokeRect((sx * s.posts.w) / 2 - 7, -s.posts.h, 14, s.posts.h);
      }
      pg.fillStyle(0x12001f, 0.95).fillRect(-s.posts.w / 2 - 30, -s.posts.h - 44, s.posts.w + 60, 52);
      pg.lineStyle(3, 0xff4fd8, 1).strokeRect(-s.posts.w / 2 - 30, -s.posts.h - 44, s.posts.w + 60, 52);
      c.add(pg);
      x0 = Math.min(x0, -s.posts.w / 2 - 32);
      x1 = Math.max(x1, s.posts.w / 2 + 32);
      y0 = Math.min(y0, -s.posts.h - 46);
    }
    let signAt: { hz: number; w: number } | null = null;
    if (s.sign) {
      const tx = new Phaser.GameObjects.Text(sc, 0, s.sign.dy, s.sign.text, { fontFamily: "Impact, sans-serif", fontSize: `${s.sign.size}px`, color: s.sign.color, stroke: "#12001f", strokeThickness: 6 }).setOrigin(0.5);
      tx.setShadow(0, 0, s.sign.color, 16, true, true);
      c.add(tx);
      x0 = Math.min(x0, -tx.width / 2);
      x1 = Math.max(x1, tx.width / 2);
      y0 = Math.min(y0, s.sign.dy - tx.height / 2);
      signAt = { hz: -s.sign.dy, w: tx.width };
    }
    const hw = Math.ceil(Math.max(-x0, x1)) + 2;
    const h = Math.ceil(-y0) + 2;
    return { s, c, hw, h, signAt };
  });
  // the bridge deck over the river, seen from above (it lies flat)
  const DECK_W = -KE;
  const DECK_H = BRIDGE_Y1 - BRIDGE_Y0;
  const deck = t(new Phaser.GameObjects.Graphics(sc));
  deck.fillStyle(0x3f3f46, 1).fillRect(0, 0, DECK_W, DECK_H);
  for (let x = 0; x < DECK_W; x += 16) deck.fillStyle(0x52525b, 1).fillRect(x, 4, 12, DECK_H - 8);
  deck.fillStyle(0xff4fd8, 1).fillRect(0, 0, DECK_W, 4).fillRect(0, DECK_H - 4, DECK_W, 4);
  for (let x = 30; x < DECK_W; x += 80) deck.fillStyle(0x22d3ee, 1).fillRect(x, 0, 6, 6).fillRect(x, DECK_H - 6, 6, 6);

  const AW = 2048;
  let x = 0;
  let y = 0;
  let row = 0;
  const slot = (w: number, h: number) => {
    if (x + w + 2 > AW) {
      x = 0;
      y += row;
      row = 0;
    }
    const at = { x: x + 1, y: y + 1 };
    x += w + 2;
    row = Math.max(row, h + 2);
    return at;
  };
  const deckAt = slot(DECK_W, DECK_H);
  const slots = built.map((b) => slot(b.hw * 2, b.h));
  const AH = Math.min(2048, y + row);
  const atlas = sc.textures.addDynamicTexture(atlasKey, AW, AH)!;
  deck.setPosition(deckAt.x, deckAt.y);
  atlas.draw(deck);
  const boards: FlyBoard[] = [];
  const glows: FlyGlow[] = [];
  boards.push({ x: 0, y: 0, hw: 0, h: 0, u0: deckAt.x / AW, u1: (deckAt.x + DECK_W) / AW, v0: deckAt.y / AH, v1: (deckAt.y + DECK_H) / AH, vi: 0, flat: [KE, BRIDGE_Y0, 0, BRIDGE_Y1] });
  built.forEach((b, i) => {
    const a = slots[i];
    if (a.y + b.h > AH) return;
    b.c.setPosition(a.x + b.hw, a.y + b.h);
    atlas.draw(b.c);
    const wx = kwx(b.s.kx);
    const wy = kwy(b.s.ky);
    boards.push({ x: wx, y: wy, hw: b.hw, h: b.h, u0: a.x / AW, u1: (a.x + b.hw * 2) / AW, v0: a.y / AH, v1: (a.y + b.h) / AH, vi: 0 });
    if (b.signAt && b.s.sign) glows.push({ x: wx, y: wy, hz: b.signAt.hz, size: b.signAt.w * 1.5, col: Phaser.Display.Color.HexStringToColor(b.s.sign.color).color, a: 0.55, ph: rnd.frac() * 6, bad: !!b.s.sign.bad });
    if (b.s.foot) glows.push({ x: wx, y: wy + 6, hz: 8, size: b.hw * 2 * b.s.foot, col: NEON[i % NEON.length], a: 0.4, ph: rnd.frac() * 6, bad: false });
  });
  atlas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  for (const o of tmp) o.destroy();

  // the big washes of light over the Strip, and the searchlights behind it
  for (let i = 0; i < 6; i++) glows.push({ x: kwx(250 + i * 420), y: kwy(540), hz: 120, size: 900, col: NEON[i % NEON.length], a: 0.22, ph: rnd.frac() * 6, bad: false });
  const beams: FlyBeam[] = [300, 820, 1350, 1880, 2420].map((kx, i) => ({ x: kwx(kx), y: kwy(200), col: NEON[i % NEON.length], ph: i * 1.7 }));
  return { groundKey, atlasKey, boards, glows, beams };
}

/** A soft round glow (white, to be tinted), made once. */
export function glowTexture(sc: Phaser.Scene, key: string) {
  if (sc.textures.exists(key)) return;
  const c = sc.textures.createCanvas(key, 64, 64);
  if (!c) return;
  const ctx = c.getContext();
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 64, 64);
  c.refresh();
}
