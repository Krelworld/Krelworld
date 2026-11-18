import Phaser from "phaser";
import type { RoomDef } from "../../../data/dungeons";

/**
 * THE FOYER of Da Drongus Dungeon: the grand, deranged entrance hall of the Supreme Leader's tower. A baked PixelLab
 * floor (black and purple marble checker with gold inlay, the worn red runner with the DD crest), a panelled back wall
 * with columns and Drongus banners, a grand staircase up to the door, gold statues of the man himself, the reception
 * desk and its visitors' book, vases and palms, chandeliers throwing pools of light, and the AI's rigs and cables
 * creeping in from the corners.
 *
 * Art and dressing only: the room's size, colliders, spawns and door are DungeonScene's and are left exactly as they
 * are (the generic decor's colliders stay; its plain pillars just become statues). A handful of big images rather than
 * hundreds of sprites, for the frame rate on phones. Without the art it does nothing, and Citadel draws the old look.
 */

export interface FoyerHost extends Phaser.Scene {
  player?: { spr: Phaser.Physics.Arcade.Sprite };
  floatText(x: number, y: number, text: string, color?: string, size?: number): void;
  toast(title: string, text: string): void;
}

export interface FoyerKit {
  liveCables(x: number, y: number, scale: number, depth: number): unknown;
  drongusScreens(x: number, y: number, scale: number, depth: number): unknown;
  storm(depth: number, strength: number): void;
  interact(it: { x: number; y: number; r: number; label: string; use: () => void | Promise<void> }): void;
}

export const isFoyer = (r: RoomDef) => r.theme === "citadel" && r.name === "The Foyer";

/** True if the foyer's own art is loaded (so it's dressed here rather than by the old drawn version). */
export function foyerArt(sc: Phaser.Scene) {
  return sc.textures.exists("c7f_floor");
}

const NEON = 0xff2d95;
const WARM = 0xffc46b;

/** The visitors' book's previous entries (one at random each time you sign it). */
const GUESTBOOK = [
  "Previous entry: 'DRONGUS' (x400, all the same handwriting)",
  "Previous entry: 'the AI' - 'I cannot sign this book.'",
  "Previous entry: 'Mollor (under duress)'",
  "Previous entry: 'Visiting: my server. Reason: it lives here now.'",
  "Previous entry: 'Drongus's mum - lovely place, bit dark'",
];

export function dressFoyer(sc: FoyerHost, r: RoomDef, kit: FoyerKit) {
  const W = r.w;
  const H = r.h;
  const cx = W / 2;
  const img = (key: string, x: number, y: number, scale: number, depth: number, oy = 1) =>
    sc.textures.exists(key) ? sc.add.image(x, y, key).setOrigin(0.5, oy).setScale(scale).setDepth(depth) : null;

  // ---- the floor: one baked image (drawn at 2x) over the theme tile, which no longer needs drawing at all
  for (const o of sc.children.list) {
    if (o instanceof Phaser.GameObjects.TileSprite && o.depth === 0 && o.texture.key.startsWith("tile_")) o.setVisible(false);
  }
  sc.add.image(0, 0, "c7f_floor").setOrigin(0).setScale(W / sc.textures.get("c7f_floor").getSourceImage().width).setDepth(0.01);

  // ---- the back wall: panelled, gold-railed, neon-lit (over the plain wall band), with a shadow where it meets the floor
  if (sc.textures.exists("c7f_wall")) {
    const wh = 74;
    sc.add.tileSprite(0, 0, W, wh, "c7f_wall").setOrigin(0).setDepth(1.05).setTileScale(wh / 64);
    sc.add.rectangle(0, wh, W, 10, 0x05010a, 0.45).setOrigin(0).setDepth(1.05);
  }
  // gold trim along the side and front walls
  const trim = sc.add.graphics().setDepth(1.06);
  trim.fillStyle(0xb8860b, 1).fillRect(22, 70, 3, H - 92).fillRect(W - 25, 70, 3, H - 92).fillRect(22, H - 25, W - 44, 3);
  trim.fillStyle(0xfde68a, 0.6).fillRect(23, 70, 1, H - 92).fillRect(W - 24, 70, 1, H - 92);

  // columns set into the back wall, flanking the door and spaced along it
  for (const x of [cx - 112, cx + 112, cx - 430, cx + 430, 40, W - 40]) img("c7f_pillar", x, 78, 0.6, 1.2);
  // banners of the Supreme Leader, stirring in the draught
  [cx - 270, cx + 270, cx - 560, cx + 560].forEach((x, i) => {
    const b = img(i % 2 ? "c7f_banner_1" : "c7f_banner_0", x, 2, 0.56, 1.3, 0);
    if (b) sc.tweens.add({ targets: b, angle: { from: -1.6, to: 1.6 }, yoyo: true, repeat: -1, duration: 1800 + i * 260, ease: "Sine.inOut", delay: i * 300 });
  });
  // official portraits either side of the door (his own boss art in the gilded frames)
  for (const x of [cx - 180, cx + 180]) portrait(sc, x, 34, 44, 52);
  img("c7d_tannoy", cx + 345, 62, 0.75, 1.4);

  // ---- the grand staircase up to the door (it's on the floor: you walk up it to the exit)
  const st = img("c7f_stairs", cx, 52, 1.65, 0.6, 0);
  if (st) sc.add.ellipse(cx, 52 + st.displayHeight - 2, st.displayWidth * 0.9, 14, 0x000000, 0.3).setDepth(0.55);

  // ---- the generic decor's plain pillars (with their colliders) become gold statues of the Supreme Leader
  for (const o of [...sc.children.list]) {
    if (!(o instanceof Phaser.GameObjects.Image) || o.texture.key !== "pillar_citadel" || !sc.textures.exists("c7f_statue")) continue;
    o.setTexture("c7f_statue").setScale(0.78);
    sc.add.ellipse(o.x, o.y - 4, 48, 14, 0x000000, 0.35).setDepth(o.depth - 0.5);
    statueGleam(sc, o);
  }
  // and two flanking the foot of the stairs
  for (const x of [cx - 150, cx + 150]) {
    const s = img("c7f_statue", x, 196, 0.78, 196);
    if (s) {
      sc.add.ellipse(x, 192, 48, 14, 0x000000, 0.35).setDepth(0.9);
      statueGleam(sc, s);
    }
  }

  // ---- reception: the desk, its sign-in book, and a queue barrier of palms and vases
  const dx = 250;
  const dy = 236;
  const desk = img("c7f_desk", dx, dy, 1.5, dy);
  if (desk) {
    sc.add.ellipse(dx, dy - 4, desk.displayWidth * 0.95, 16, 0x000000, 0.35).setDepth(0.9);
    sc.add.text(dx, dy - desk.displayHeight - 14, "RECEPTION", { fontFamily: "Georgia, serif", fontSize: "11px", color: "#fde68a", fontStyle: "bold", stroke: "#1a0a12", strokeThickness: 3 }).setOrigin(0.5).setDepth(dy + 1);
    sc.add.text(dx, dy + 12, "ALL VISITORS MUST SIGN IN\n(AND KNEEL)", { fontFamily: "Georgia, serif", fontSize: "8px", color: "#fde68a", align: "center", stroke: "#1a0a12", strokeThickness: 2 }).setOrigin(0.5, 0).setDepth(1).setAlpha(0.8);
    let signed = 0;
    kit.interact({
      x: dx,
      y: dy - 10,
      r: 70,
      label: "sign the visitors' book",
      use: () => {
        sc.floatText(dx, dy - desk.displayHeight - 30, signed++ ? "(you sign it again)" : "*signs it 'NOT DRONGUS'*", "#fde68a", 13);
        sc.toast("VISITORS' BOOK", GUESTBOOK[Math.floor(Math.random() * GUESTBOOK.length)]);
      },
    });
  }
  // a CRT stack by the right-hand wall, cutting to the Supreme Leader
  kit.drongusScreens(W - 230, 200, 1.1, 200);

  // palms and vases down both sides of the runner (where the candelabras stood)
  [300, 520, 740].forEach((y, i) => {
    for (const side of [-1, 1]) {
      const key = (i + (side > 0 ? 1 : 0)) % 2 ? "c7f_vase" : "c7f_palm";
      const p = img(key, cx + side * 128, y, key === "c7f_palm" ? 1.35 : 1.15, y);
      if (p) sc.add.ellipse(cx + side * 128, y - 3, p.displayWidth * 0.8, 10, 0x000000, 0.35).setDepth(0.9);
    }
  });
  // more by the reception desk and in the far corners
  for (const [k, x, y] of [["c7f_palm", 120, 250], ["c7f_vase", 380, 236], ["c7f_palm", W - 120, 820], ["c7f_vase", 120, 820]] as [string, number, number][]) img(k, x, y, 1.25, y);

  // ---- chandeliers overhead, each throwing a warm pool of light on the marble
  const chands: Phaser.GameObjects.Image[] = [];
  for (const [x, y] of [[cx - 300, 420], [cx + 300, 420], [cx, 610]]) {
    const pool = sc.add.ellipse(x, y + 40, 330, 230, WARM, 0.1).setDepth(0.95).setBlendMode(Phaser.BlendModes.ADD);
    const core = sc.add.ellipse(x, y + 40, 170, 120, WARM, 0.08).setDepth(0.95).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: [pool, core], alpha: { from: 0.75, to: 1 }, yoyo: true, repeat: -1, duration: 160 + Math.floor(Math.random() * 120) });
    const c = img("c7f_chandelier", x, y, 1.15, 900, 0.5);
    if (c) {
      c.setAlpha(0.92);
      chands.push(c);
      sc.tweens.add({ targets: c, angle: { from: -1.5, to: 1.5 }, yoyo: true, repeat: -1, duration: 2600, ease: "Sine.inOut" });
    }
  }

  // ---- the AI moving in: rigs humming in the corners, cables snaking across the marble, sparking ones from the ceiling
  for (const [x, y] of [[96, 196], [W - 96, 196], [W - 110, H - 34], [110 + 60, H - 34]]) {
    const rig = img("c7_ai_rig", x, y, 0.62, y);
    if (!rig) continue;
    const led = sc.add.rectangle(x, y - rig.displayHeight * 0.45, 26, 2, NEON, 0.9).setDepth(y + 1);
    sc.tweens.add({ targets: led, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 + Math.random() * 400 });
  }
  const g = sc.add.graphics().setDepth(0.8);
  const cables: [number, number, number, number, number][] = [
    [110, 200, dx + 30, dy - 20, 60],
    [W - 110, 200, W - 230, 200, 70],
    [W - 110, 200, cx + 90, 120, 140],
    [W - 120, H - 50, cx + 200, H - 150, -90],
    [170, H - 50, cx - 210, H - 220, -120],
    [96, 196, 40, H - 80, 120],
  ];
  const glows: [Phaser.Curves.QuadraticBezier, number][] = [];
  cables.forEach(([ax, ay, bx, by, sag], i) => {
    const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(ax, ay), new Phaser.Math.Vector2((ax + bx) / 2, Math.max(ay, by) + sag), new Phaser.Math.Vector2(bx, by));
    g.lineStyle(7, 0x050308, 0.9);
    c.draw(g, 28);
    g.lineStyle(3, 0x1c1526, 1);
    c.draw(g, 28);
    g.lineStyle(1, NEON, 0.45);
    c.draw(g, 28);
    glows.push([c, i]);
  });
  // a pulse of light running down each cable
  const pulse = sc.add.graphics().setDepth(0.85).setBlendMode(Phaser.BlendModes.ADD);
  kit.liveCables(cx - 230, 0, 1.3, 1.7);
  kit.liveCables(cx + 230, 0, 1.3, 1.7);

  // ---- mood: a cold purple wash, a soft vignette, the storm in the windows
  sc.add.rectangle(0, 0, W, H, 0x16052a, 0.16).setOrigin(0).setDepth(1.9);
  const v = sc.add.graphics().setDepth(2).setScrollFactor(0);
  v.fillStyle(0x0a0412, 0.35).fillRect(0, 0, 960, 34).fillRect(0, 506, 960, 34).fillRect(0, 0, 34, 540).fillRect(926, 0, 34, 540);
  kit.storm(1.95, 0.14);

  // per frame: the cable pulses, and chandeliers fade when you're under them (so they never hide the fight)
  const tick = (now: number) => {
    pulse.clear();
    for (const [c, i] of glows) {
      const t = ((now / 1400 + i * 0.37) % 1 + 1) % 1;
      const p = c.getPoint(t);
      pulse.fillStyle(NEON, 0.55).fillCircle(p.x, p.y, 3);
      pulse.fillStyle(NEON, 0.18).fillCircle(p.x, p.y, 8);
    }
    const ps = sc.player?.spr;
    if (!ps?.active) return;
    for (const c of chands) {
      const near = Math.abs(ps.x - c.x) < 90 && Math.abs(ps.y - c.y) < 110;
      const a = near ? 0.3 : 0.92;
      if (Math.abs(c.alpha - a) > 0.01) c.setAlpha(c.alpha + (a - c.alpha) * 0.15);
    }
  };
  const onUpdate = (t: number) => tick(t);
  sc.events.on("update", onUpdate);
  sc.events.once("shutdown", () => sc.events.off("update", onUpdate));
}

/** A slow glint sliding over a gold statue now and then. */
function statueGleam(sc: Phaser.Scene, s: Phaser.GameObjects.Image) {
  const glint = sc.add.rectangle(s.x - s.displayWidth / 2, s.y - s.displayHeight * 0.7, 5, s.displayHeight * 0.5, 0xfffbe0, 0).setDepth(s.depth + 0.1).setAngle(20).setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: glint, x: s.x + s.displayWidth / 2, fillAlpha: { from: 0.35, to: 0 }, duration: 700, repeat: -1, repeatDelay: 3500 + Math.random() * 3000, delay: Math.random() * 2000 });
}

/** An official portrait of the Supreme Leader in a gilded frame, hung on the back wall. */
function portrait(sc: Phaser.Scene, x: number, y: number, w: number, h: number) {
  const iw = w * 0.56;
  const ih = h * 0.7;
  sc.add.rectangle(x, y, iw, ih, 0x2a0a16).setDepth(1.3);
  if (sc.textures.exists("boss_drongus")) {
    // head and shoulders: the top of his frame, cropped to the opening
    const p = sc.add.image(x, y, "boss_drongus", 0).setDepth(1.31);
    const fw = p.frame.width;
    const fh = p.frame.height;
    const cw = fw * 0.62;
    const ch = (cw * ih) / iw;
    const k = iw / cw;
    p.setScale(k).setCrop((fw - cw) / 2, fh * 0.02, cw, ch);
    p.y = y + (fh / 2 - (fh * 0.02 + ch / 2)) * k;
  }
  if (sc.textures.exists("c7d_frame")) sc.add.image(x, y, "c7d_frame").setDepth(1.32).setDisplaySize(w, h);
}
