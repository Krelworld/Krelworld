// The opening: Krunch News on the telly (England are in the quarter-finals; the new manager talks
// nonsense; the country goes wild), a pint glass through the screen, and Grozz at home in his
// filthy little terrace: the kids fighting over the iPad, Shezleigh, her benefit money, a packet of
// crisps, and the front door. Its own little Phaser game laid over the page, 960 x 540, skippable.
import Phaser from "phaser";
import { BRANDS, NewsChrome } from "./newschrome";

const W = 960, H = 540;
/** Where the desk and the microphones start in the TV sets (picture rows, of 224), and where the
 *  presenters stand and how big. Set by looking at the pictures. */
const DESK = { studio: 129, presser: 158 };
const PRES = { studio: { feet: 0.63, scale: 2.5 }, presser: { feet: 0.76, scale: 2.8 } };
const ROOM_SCALE = 1.8, ROOM_X = (W - 400 * ROOM_SCALE) / 2;
const R = (x: number, y: number) => ({ x: ROOM_X + x * ROOM_SCALE, y: y * ROOM_SCALE });
const LINES = ["n1", "n2", "s1", "s2", "s3", "n3", "g1", "g2", "k1", "k2", "k3", "g3", "w1", "g4", "w2", "g5", "w3", "k4", "k5", "w5", "k6", "k7", "k8", "g10", "g6", "g7", "w4", "g8", "g9", "g11", "g12", "w6",
  ...["k1", "g1", "k2", "g2", "k3", "g3", "k4", "k5", "k6", "g4", "k7", "k8", "g5", "k9", "k10", "g6", "k11", "g7", "k12", "g8", "k13"].map((k) => `c_${k}`)];
const SFX = ["sting", "tvsmash", "snap", "wail", "door", "pubcheer", "crisps", "fart_wet", "fart_long", "fart_squeak"];
const CAST = ["fan", "shezleigh", "grozzyjr", "screnton"];
const ANIMS = ["walk", "idle", "punch", "cheer", "rage", "snap", "throw", "shout", "cry", "tug"];
// S, SE, E, NE, N, NW, W, SW
const DIR = { S: 0, E: 2, N: 4, W: 6, SE: 1, SW: 7, NE: 3, NW: 5 } as const;

class Person {
  sp: Phaser.GameObjects.Sprite;
  dir = 0;
  constructor(private sc: OpeningScene, public base: string, x: number, y: number, dir: number, private scale = ROOM_SCALE) {
    this.sp = sc.add.sprite(R(x, y).x, R(x, y).y, `${base}-rot`, dir).setOrigin(0.5, 0.82).setScale(scale).setDepth(100 + y);
    this.dir = dir;
  }
  has(anim: string) { return this.sc.textures.exists(`${this.base}-${anim}`); }
  /** Turn to a direction and stand there breathing (or just stand, if there's no idle). */
  face(d: number) { this.dir = d; if (this.has("idle")) { this.play("idle", true, 6); return; } this.sp.stop(); this.sp.setTexture(`${this.base}-rot`, d); }
  /** Play an animation in the current direction; falls back to standing still if there isn't one. */
  play(anim: string, loop = true, fps = 9) {
    if (!this.has(anim)) { this.face(this.dir); return; }
    const key = `${this.base}-${anim}-${this.dir}`;
    if (!this.sc.anims.exists(key)) {
      const n = Math.max(1, Math.floor(this.sc.textures.get(`${this.base}-${anim}`).getSourceImage().width / 88));
      this.sc.anims.create({ key, frames: this.sc.anims.generateFrameNumbers(`${this.base}-${anim}`, { start: this.dir * n, end: this.dir * n + n - 1 }), frameRate: fps, repeat: loop ? -1 : 0 });
    }
    this.sp.play(key, true);
  }
  /** Walk to a point in room pixels. */
  walk(x: number, y: number, speed = 70): Promise<void> {
    const to = R(x, y), dx = to.x - this.sp.x, dy = to.y - this.sp.y;
    // Sheets run S, SE, E, NE, N, NW, W, SW: anticlockwise on screen from straight down. (The old
    // sum ran the other way round, so anyone walking sideways moonwalked.)
    const a = Math.atan2(dy, dx), idx = ((Math.round((Math.PI / 2 - a) / (Math.PI / 4)) % 8) + 8) % 8;
    this.dir = idx; this.play("walk");
    const ms = (Math.hypot(dx, dy) / ROOM_SCALE / speed) * 1000;
    return new Promise((res) => this.sc.tweens.add({ targets: this.sp, x: to.x, y: to.y, duration: ms, onUpdate: () => this.sp.setDepth(100 + this.sp.y / ROOM_SCALE), onComplete: () => { this.face(this.dir); res(); } }));
  }
  get head() { return { x: this.sp.x, y: this.sp.y - 64 * this.scale * (this.base.startsWith("g") || this.base === "screnton" ? 0.62 : 0.78) }; }
}

class OpeningScene extends Phaser.Scene {
  done!: () => void;
  private finished = false;
  constructor() { super("opening"); }
  init(d: { done: () => void }) { this.done = d.done; }

  preload() {
    for (const k of ["room", "tv_studio_bg", "tv_presser_bg", "tv_pub_bg", "tv_studio_front", "tv_presser_front"]) this.load.image(k, `scenes/${k}.png`);
    // The newsreader and the manager: camera-facing talking sheets, 128 px cells, one row.
    for (const b of ["penelope", "scronson"]) for (const a of ["talk"]) this.load.spritesheet(`${b}-${a}`, `art/${b}-${a}.png`, { frameWidth: 128, frameHeight: 128 });
    for (const b of ["lad", "woman"]) for (const a of ["rot", "cheer"]) this.load.spritesheet(`${b}-${a}`, `art/${b}-${a}.png`, { frameWidth: 88, frameHeight: 88 });
    for (const k of LINES) this.load.audio(`op_${k}`, `audio/op_${k}.mp3`);
    for (const k of SFX) this.load.audio(`op_${k}`, `audio/op_${k}.mp3`);
    this.load.audio("kaching", "audio/kaching.mp3");
    for (const k of ["mus_news", "mus_home", "mus_title"]) this.load.audio(k, `audio/${k}.mp3`);
    for (const k of ["glass_smash", "chair_smash", "wall_crash", "punch", "bodyfall", "fart", "chant_eng", "bark", "gulp", "dog_bite"]) this.load.audio(k, `audio/${k}.mp3`);
    // The coach: the inside of it, and the two of them sat in the front seat, drawn bigger and finer than the room.
    for (const k of ["coach_bg", "grozz_seat", "kev_seat", "ipad", "crisps"]) this.load.image(k, `scenes/${k}.png`);
    // Ronson, Grozz's dog.
    for (const a of ["rot", "walk", "run", "lunge", "chew"]) this.load.spritesheet(`ronson-${a}`, `art/ronson-${a}.png`, { frameWidth: 88, frameHeight: 88 });
    this.load.image("pint", "icons/pint_glass.png");
    for (const b of CAST) {
      this.load.spritesheet(`${b}-rot`, `art/${b}-rot.png`, { frameWidth: 88, frameHeight: 88 });
      for (const a of ANIMS) this.load.spritesheet(`${b}-${a}`, `art/${b}-${a}.png`, { frameWidth: 88, frameHeight: 88 });
    }
    // Missing sheets (an animation that never got made) are fine: people just stand there.
    this.load.on("loaderror", () => {});
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");
    // Tap anywhere: on to the next line (ignored for a moment after each one starts, so a double tap doesn't eat two).
    this.input.on("pointerdown", () => this.next());
    void this.run();
  }
  next() {
    if (this.nextLine && performance.now() - this.lineAt > 180) this.nextLine();
    else if (!this.nextLine && this.skipWait) this.skipWait();
  }

  // ---------- helpers ----------
  mark(m: string) { (window as unknown as { __op?: string }).__op = m; if (location.search.includes("trace")) console.warn("op", m, Math.round(performance.now())); }
  /** A pause between beats. Next cuts a long one short, as it does a line. */
  wait(ms: number) {
    return new Promise<void>((r) => {
      let done = false;
      const end = () => { if (done) return; done = true; if (this.skipWait === end) this.skipWait = null; r(); };
      if (ms >= 300) this.skipWait = end;
      this.time.delayedCall(ms, end);
    });
  }
  skipWait: (() => void) | null = null;
  /** Something gets smashed: bits everywhere (some stay on the floor), a jolt, a flash, a crash. */
  smash(at: { x: number; y: number }, cols: number[], sound: string, big = false) {
    this.sfx(sound, 0.9);
    if (this.cache.audio.exists("punch")) this.sound.play("punch", { volume: 0.6, rate: 0.7 });
    this.cameras.main.shake(big ? 260 : 160, big ? 0.016 : 0.01);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.25).setDepth(3000);
    this.tweens.add({ targets: flash, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    // Splintered: a few dark cracks left behind.
    const g = this.add.graphics().setDepth(60);
    g.lineStyle(2, 0x0d0907, 0.9);
    for (let i = 0; i < (big ? 7 : 4); i++) {
      let x = at.x, y = at.y, a = Math.random() * Math.PI * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { a += (Math.random() - 0.5) * 0.9; x += Math.cos(a) * (8 + Math.random() * 14); y += Math.sin(a) * (5 + Math.random() * 9); g.lineTo(x, y); }
      g.strokePath();
    }
    for (let i = 0; i < (big ? 46 : 30); i++) {
      const c = cols[i % cols.length], sz = 3 + Math.random() * (big ? 9 : 6);
      const bit = this.add.rectangle(at.x, at.y, sz, sz * (0.4 + Math.random() * 0.8), c).setDepth(400).setAngle(Math.random() * 360);
      const dx = (Math.random() - 0.5) * (big ? 300 : 200), land = at.y + 20 + Math.random() * 90;
      this.tweens.add({ targets: bit, x: at.x + dx, angle: bit.angle + (Math.random() - 0.5) * 900, duration: 520 + Math.random() * 300, ease: "Quad.out" });
      this.tweens.add({ targets: bit, y: { from: at.y, to: land }, duration: 520 + Math.random() * 300, ease: "Bounce.out" });
    }
  }
  /** A bit of the painted room comes apart for real: that part of the picture is cut out into four
   *  chunks that fly off and land as rubble, and the floor shows where it stood. */
  private broke = 0;
  breakOff(x0: number, y0: number, x1: number, y1: number, dir: { x: number; y: number }) {
    const src = this.textures.get("room").getSourceImage() as HTMLImageElement, w = x1 - x0, h = y1 - y0;
    // The floor colour just below it, and the hole painted in.
    // The floor: the median of a band of carpet a little way below it (clear of its own shadow).
    const probe = document.createElement("canvas"); probe.width = w; probe.height = 6;
    const pc = probe.getContext("2d", { willReadFrequently: true })!; pc.drawImage(src, x0, Math.min(src.height - 6, y1 + 12), w, 6, 0, 0, w, 6);
    const d = pc.getImageData(0, 0, w, 6).data, px: number[][] = [];
    for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    px.sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
    const md = px[Math.floor(px.length * 0.6)] ?? [110, 80, 50], col = (md[0] << 16) | (md[1] << 8) | md[2];
    const c0 = R(x0, y0);
    this.add.rectangle(c0.x, c0.y, w * ROOM_SCALE, h * ROOM_SCALE, col).setOrigin(0).setDepth(1);
    const dirt = this.add.graphics().setDepth(2); dirt.fillStyle(0x000000, 0.25);
    for (let i = 0; i < 14; i++) dirt.fillRect(c0.x + Math.random() * w * ROOM_SCALE, c0.y + Math.random() * h * ROOM_SCALE, 4 + Math.random() * 10, 3 + Math.random() * 5);
    const id = this.broke++;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const key = `chunk${id}_${i}${j}`, cw = Math.ceil(w / 2), ch = Math.ceil(h / 2);
      const tex = this.textures.createCanvas(key, cw, ch)!; tex.getContext().drawImage(src, x0 + i * cw, y0 + j * ch, cw, ch, 0, 0, cw, ch); tex.refresh();
      const cx = c0.x + (i + 0.5) * cw * ROOM_SCALE, cy = c0.y + (j + 0.5) * ch * ROOM_SCALE;
      const im = this.add.image(cx, cy, key).setScale(ROOM_SCALE).setDepth(100 + y1);
      const fx = (i - 0.5) * 2 + dir.x * 1.5 + (Math.random() - 0.5), fy = (j - 0.5) * 2 + dir.y * 1.5 + (Math.random() - 0.5);
      const lx = cx + fx * (60 + Math.random() * 70), ly = cy + fy * (40 + Math.random() * 50) + 20;
      this.tweens.add({ targets: im, x: lx, angle: (Math.random() - 0.5) * 300, duration: 520 + Math.random() * 200, ease: "Quad.out" });
      this.tweens.add({ targets: im, y: { from: cy - 30, to: ly }, duration: 520 + Math.random() * 200, ease: "Bounce.out", onComplete: () => { im.setTint(0xb0a090).setDepth(60 + ly / ROOM_SCALE); } });
    }
  }
  sfx(k: string, vol = 1) { if (this.cache.audio.exists(`op_${k}`) || this.cache.audio.exists(k)) this.sound.play(this.cache.audio.exists(`op_${k}`) ? `op_${k}` : k, { volume: vol }); }
  /** A voiced line, with a bubble over whoever says it (or a subtitle on the telly). Resolves when it's said. */
  /** Tap to cut the current line short (Krelworld's next-line), once it's been up a moment. */
  nextLine: (() => void) | null = null;
  lineAt = 0;
  /** A shade quicker than the voices were recorded. */
  static readonly RATE = 1.07;
  say(k: string, text: string, who: Person | null, opts: { gap?: number; sub?: boolean } = {}): Promise<void> {
    const snd = this.cache.audio.exists(`op_${k}`) ? this.sound.add(`op_${k}`, { rate: OpeningScene.RATE }) : null;
    const objs: Phaser.GameObjects.GameObject[] = [];
    if (who) objs.push(...this.bubble(who, text));
    else objs.push(...this.subtitle(text));
    return new Promise((res) => {
      let done = false;
      const end = () => { if (done) return; done = true; if (this.nextLine === skip) this.nextLine = null; objs.forEach((o) => o.destroy()); res(); };
      const skip = () => { if (snd?.isPlaying) snd.stop(); end(); };
      this.nextLine = skip; this.lineAt = performance.now();
      const gap = Math.round((opts.gap ?? 150) * 0.6);
      if (snd) { snd.once("complete", () => this.time.delayedCall(gap, end)); snd.play(); }
      else this.time.delayedCall(800 + text.length * 48, end);
    });
  }
  bubble(p: Person, text: string) {
    const t = this.add.text(0, 0, text, { fontFamily: '"Pixelify Sans", sans-serif', fontSize: "21px", color: "#111111", align: "center", wordWrap: { width: 380 } }).setOrigin(0.5, 1).setDepth(2000);
    const hd = p.head, x = Phaser.Math.Clamp(hd.x, t.width / 2 + 14, W - t.width / 2 - 14), y = Math.max(t.height + 22, hd.y - 14);
    t.setPosition(x, y);
    const g = this.add.graphics().setDepth(1999);
    const bx = x - t.width / 2 - 10, by = y - t.height - 8, bw = t.width + 20, bh = t.height + 14;
    g.fillStyle(0x000000, 1).fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    g.fillStyle(0xf6f3ea, 1).fillRect(bx, by, bw, bh);
    const tx = Phaser.Math.Clamp(hd.x, bx + 14, bx + bw - 14);
    g.fillStyle(0x000000, 1).fillTriangle(tx - 9, by + bh + 2, tx + 5, by + bh + 2, tx - 7, by + bh + 16);
    g.fillStyle(0xf6f3ea, 1).fillTriangle(tx - 6, by + bh - 1, tx + 2, by + bh - 1, tx - 5, by + bh + 10);
    return [t, g];
  }
  subtitle(text: string) {
    const t = this.add.text(W / 2, H - 92, text, { fontFamily: '"Pixelify Sans", sans-serif', fontSize: "22px", color: "#ffffff", align: "center", wordWrap: { width: 760 }, backgroundColor: "#000000cc", padding: { x: 10, y: 6 } }).setOrigin(0.5, 1).setDepth(3000);
    return [t];
  }
  popup(x: number, y: number, text: string, colour: string) {
    const t = this.add.text(x, y, text, { fontFamily: '"Silkscreen", monospace', fontSize: "34px", color: colour, stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5).setDepth(2500);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1600, delay: 500, onComplete: () => t.destroy() });
  }
  /** Someone on the telly: the camera-facing frames, scaled up, cut off at the desk. Talks while told to. */
  onTelly(base: string, x: number, y: number, scale: number, deskY: number) {
    if (!this.textures.exists(`${base}-talk`)) return null;
    const sp = this.add.sprite(x, y, `${base}-talk`, 0).setOrigin(0.5, 1).setScale(scale).setDepth(5);
    // Crop at the desk: only what's above deskY (screen) shows.
    const top = y - 128 * scale, keep = Math.max(1, (deskY - top) / scale);
    sp.setCrop(0, 0, 128, Math.min(128, keep));
    let k = 0;
    const talk = (on: boolean) => {
      if (!on) { sp.stop(); sp.setFrame(0); return; }
      const a = "talk"; k++;
      if (!this.textures.exists(`${base}-${a}`)) return;
      const key = `${base}-${a}-tv`;
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(`${base}-${a}`, {}), frameRate: 8, repeat: -1 });
      sp.play(key);
    };
    return { sp, talk };
  }
  /** A pub full of fans going mad: rows of cheering sprites, nearest biggest. */
  crowd(): Phaser.GameObjects.Sprite[] {
    const out: Phaser.GameObjects.Sprite[] = [], bases = ["fan", "lad", "woman", "fan", "lad"].filter((b) => this.textures.exists(`${b}-cheer`));
    if (!bases.length) return out;
    const rows = [{ y: 330, n: 9, s: 2.2 }, { y: 420, n: 8, s: 2.9 }, { y: 540, n: 6, s: 3.8 }];
    let i = 0;
    for (const r of rows) for (let k = 0; k < r.n; k++) {
      const b = bases[i++ % bases.length], key = `${b}-cheer-S`;
      if (!this.anims.exists(key)) {
        const n = Math.floor(this.textures.get(`${b}-cheer`).getSourceImage().width / 88);
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(`${b}-cheer`, { start: 0, end: n - 1 }), frameRate: 10, repeat: -1, yoyo: true });
      }
      const x = (k + 0.5) * (W / r.n) + (Math.random() - 0.5) * 50;
      const sp = this.add.sprite(x, r.y + (Math.random() - 0.5) * 14, `${b}-cheer`, 0).setOrigin(0.5, 0.82).setScale(r.s).setDepth(3 + r.y / 100);
      sp.play({ key, startFrame: Math.floor(Math.random() * 6) });
      sp.anims.timeScale = 0.8 + Math.random() * 0.6;
      out.push(sp);
    }
    return out;
  }
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.sound.stopAll();
    this.done();
  }

  // ---------- the film ----------
  async run() {
    if (location.search.includes("opcoach")) { await this.coach(); this.finish(); return; }
    if (!location.search.includes("oproom")) await this.telly();
    await this.room();
    await this.coach();
    this.finish();
  }

  /** One piece of music at a time, faded in and out. */
  private tune: Phaser.Sound.BaseSound | null = null;
  music(key: string | null, vol = 0.4, loop = true) {
    const old = this.tune;
    if (old) this.tweens.add({ targets: old, volume: 0, duration: 500, onComplete: () => old.destroy() });
    this.tune = null;
    if (!key || !this.cache.audio.exists(key)) return;
    const t = this.sound.add(key, { loop, volume: 0 });
    t.play();
    this.tweens.add({ targets: t, volume: vol, duration: 600 });
    this.tune = t;
  }

  async telly() {
    // ===== The telly =====
    this.music("mus_news", 0.45, false);
    const live = this.textures.exists("tv_studio_bg") && this.textures.exists("penelope-talk");
    const pic = this.add.image(W / 2, H / 2, live ? "tv_studio_bg" : "tv_studio").setScale(W / 400).setDepth(1);
    // The desk, in front of her: the bottom of the studio picture drawn again over the presenter.
    const desk = live ? this.add.image(W / 2, H / 2, "tv_studio_front").setScale(W / 400).setDepth(6) : null;
    const pen = live ? this.onTelly("penelope", W / 2, H * PRES.studio.feet, PRES.studio.scale, (DESK.studio * W) / 400) : null;
    const chrome = new NewsChrome(this, { SX: 0, SY: 0, SW: W, SH: H }, BRANDS.krunch, 10);
    const scan = this.add.graphics().setDepth(50);
    for (let y = 0; y < H; y += 3) scan.fillStyle(0x000000, 0.12).fillRect(0, y, W, 1);
    this.sfx("sting", 0.8);
    await this.wait(chrome.ident());
    chrome.bug(); chrome.live("London");
    chrome.headline("England reach the World Cup quarter-finals");
    chrome.ticker(["Nation celebrates", "Pubs run dry in Basildon", "Man arrested for kissing a police horse", "Weather: grey", "Scronson Flabbergast: 'football is a game of football'"]);
    chrome.strap("Penelope Gristle", "Krunch News", 4200);
    pen?.talk(true);
    await this.say("n1", "Good evening. Scenes of jubilation across the country tonight, as England have reached the quarter-finals of the World Cup.", null);
    pen?.talk(false); await this.wait(250); pen?.talk(true);
    await this.say("n2", "England's new manager, Scronson Flabbergast, spoke to Krunch News earlier.", null);
    pen?.talk(false); pen?.sp.setVisible(false); desk?.setVisible(false);

    this.mark("presser");
    const live2 = this.textures.exists("tv_presser_bg") && this.textures.exists("scronson-talk");
    pic.setTexture(live2 ? "tv_presser_bg" : "tv_presser").setScale(W / 400);
    const mics = live2 ? this.add.image(W / 2, H / 2, "tv_presser_front").setScale(W / 400).setDepth(6) : null;
    const scron = live2 ? this.onTelly("scronson", W / 2, H * PRES.presser.feet, PRES.presser.scale, (DESK.presser * W) / 400) : null;

    chrome.strap("Scronson Flabbergast", "England manager", 6000);
    const flash = this.time.addEvent({ delay: 900, loop: true, callback: () => { const f = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.35).setDepth(40); this.tweens.add({ targets: f, alpha: 0, duration: 140, onComplete: () => f.destroy() }); } });
    for (const [k, t] of [["s1", "Look. Erm. T'key... is to score goals. Like."], ["s2", "Obviously t'other lot'll be trying to score goals... an' all. So we'll need to... stop that."], ["s3", "Mentality we need is a footie mentality. We'll tek it one game at a time. Then... t'next game. Champion."]] as const) {
      scron?.talk(true);
      await this.say(k, t, null);
      scron?.talk(false);
      await this.wait(200);
    }
    flash.remove();
    scron?.sp.setVisible(false); mics?.setVisible(false);

    this.mark("fans0");
    const live3 = this.textures.exists("tv_pub_bg") && this.textures.exists("fan-cheer");
    pic.setTexture(live3 ? "tv_pub_bg" : "tv_fans").setScale(W / 400);
    const fans = live3 ? this.crowd() : [];
    // Beer going up in the air.
    const beer = live3 ? this.time.addEvent({ delay: 120, loop: true, callback: () => { const d = this.add.rectangle(Math.random() * W, 300 + Math.random() * 120, 5, 7, 0xf2c94c, 0.9).setDepth(8); this.tweens.add({ targets: d, y: d.y - 80 - Math.random() * 80, x: d.x + (Math.random() - 0.5) * 60, alpha: 0, duration: 700, ease: "Quad.out", onComplete: () => d.destroy() }); } }) : null;
    this.mark("fans1");
    this.sfx("pubcheer", 0.9);
    this.tweens.add({ targets: pic, x: { from: W / 2 - 6, to: W / 2 + 6 }, duration: 90, yoyo: true, repeat: 20 });
    this.mark("fans2");
    await this.say("n3", "Fans have been celebrating long into the night.", null);
    this.mark("glass");
    // A pint glass, from behind the camera, straight into the screen.
    const glass = this.add.image(W / 2 + 60, H + 80, "pint").setScale(1.5).setDepth(60);
    await new Promise<void>((r) => this.tweens.add({ targets: glass, x: W / 2 + 20, y: H / 2 - 20, scale: 9, angle: 220, duration: 520, ease: "Quad.in", onComplete: () => r() }));
    glass.destroy();
    this.music(null);
    this.sfx("tvsmash");
    this.sound.stopByKey("op_pubcheer");
    const crack = this.add.graphics().setDepth(70);
    crack.lineStyle(3, 0xffffff, 0.9);
    const cx = W / 2 + 20, cy = H / 2 - 20;
    for (let i = 0; i < 14; i++) {
      let x = cx, y = cy, a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      crack.beginPath(); crack.moveTo(x, y);
      for (let k = 0; k < 6; k++) { a += (Math.random() - 0.5) * 0.6; x += Math.cos(a) * (40 + Math.random() * 60); y += Math.sin(a) * (40 + Math.random() * 60); crack.lineTo(x, y); }
      crack.strokePath();
    }
    this.cameras.main.shake(400, 0.02);
    // Static: one small noise picture, jiggled about.
    if (!this.textures.exists("op-noise")) {
      const cv = this.textures.createCanvas("op-noise", 240, 136)!, cx2 = cv.getContext();
      const id = cx2.createImageData(240, 136);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() < 0.5 ? 235 : 20; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 150; }
      cx2.putImageData(id, 0, 0); cv.refresh();
    }
    const noise = this.add.image(W / 2, H / 2, "op-noise").setScale(4.2).setDepth(65);
    const fizz = this.time.addEvent({ delay: 50, loop: true, callback: () => noise.setPosition(W / 2 + (Math.random() - 0.5) * 60, H / 2 + (Math.random() - 0.5) * 40).setFlip(Math.random() < 0.5, Math.random() < 0.5) });
    await this.wait(700);
    fizz.remove();
    // Hide the telly rather than tearing it down mid-tween.
    this.tweens.killTweensOf(pic);
    beer?.remove();
    for (const f of fans) { f.stop(); f.setVisible(false); }
    for (const o of [pic, crack, noise, scan]) o.setVisible(false);
    chrome.setVisible(false);
    this.cameras.main.setBackgroundColor("#000000");

  }

  async room() {
    this.mark("room");
    // ===== The front room =====
    this.add.image(ROOM_X, 0, "room").setOrigin(0).setScale(ROOM_SCALE).setDepth(0);
    this.music("mus_home", 0.3);
    // The telly on the wall, smashed and sparking.
    const tv = R(205, 62), tvg = this.add.graphics().setDepth(90);
    tvg.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; tvg.lineBetween(tv.x, tv.y, tv.x + Math.cos(a) * 60, tv.y + Math.sin(a) * 34); }
    const sparks = this.time.addEvent({ delay: 300, loop: true, callback: () => { const s = this.add.rectangle(tv.x + (Math.random() - 0.5) * 70, tv.y + (Math.random() - 0.5) * 30, 4, 4, 0xfff3a0).setDepth(91); this.tweens.add({ targets: s, y: s.y + 40, alpha: 0, duration: 500, onComplete: () => s.destroy() }); } });
    this.mark("room-img");
    // The room breathes: a dodgy bulb, and fag smoke off the ashtray.
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.08).setDepth(1500);
    this.time.addEvent({ delay: 90, loop: true, callback: () => dim.setFillStyle(0x000000, Math.random() < 0.06 ? 0.3 : 0.06 + Math.random() * 0.05) });
    const ash = R(232, 186);
    this.time.addEvent({ delay: 420, loop: true, callback: () => { const p = this.add.circle(ash.x + (Math.random() - 0.5) * 6, ash.y, 4 + Math.random() * 3, 0xd8d8d8, 0.35).setDepth(1400); this.tweens.add({ targets: p, y: p.y - 70, x: p.x + (Math.random() - 0.5) * 30, scale: 2.2, alpha: 0, duration: 2200, onComplete: () => p.destroy() }); } });
    const grozz = new Person(this, "fan", 215, 150, DIR.N);
    this.mark("room-grozz");
    const jr = new Person(this, "grozzyjr", 126, 140, DIR.E);
    const scr = new Person(this, "screnton", 158, 140, DIR.W);
    const shez = new Person(this, "shezleigh", 372, 118, DIR.W);
    shez.sp.setVisible(false);
    // Ronson: eating the settee. Bits of stuffing everywhere.
    const ron = this.textures.exists("ronson-rot") ? new Person(this, "ronson", 92, 226, DIR.W) : null;
    let stuffing: Phaser.Time.TimerEvent | null = null;
    if (ron) {
      ron.play(ron.has("chew") ? "chew" : "walk", true, 11);
      stuffing = this.time.addEvent({ delay: 380, loop: true, callback: () => {
        const f = this.add.rectangle(ron.sp.x - 30, ron.sp.y - 30, 5, 4, Math.random() < 0.6 ? 0xeae4d2 : 0x6b4228).setDepth(400);
        this.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 90, y: f.y + 20 + Math.random() * 40, angle: Math.random() * 360, duration: 600 });
        if (Math.random() < 0.3) this.sfx("bark", 0.25);
      } });
    }
    this.mark("room-cast");
    // The iPad between the kids.
    const pad = this.add.image(R(142, 132).x, R(142, 132).y, "ipad").setScale(1.2).setDepth(300);
    const fight = this.time.addEvent({ delay: 650, loop: true, callback: () => { (Math.random() < 0.5 ? jr : scr).play("punch", false, 14); this.tweens.add({ targets: pad, x: pad.x + (Math.random() - 0.5) * 14, duration: 120 }); } });
    this.mark("room-throw");
    grozz.play("throw", false, 12);
    this.mark("room-throw2");
    await this.wait(700);
    this.mark("room-rage");
    grozz.face(DIR.S); grozz.play(grozz.has("rage") ? "rage" : "cheer");
    await this.say("g1", "Fucking FIFA! They're gonna fucking rig it again! They hate us! They hate the English lions!", grozz);
    await this.say("g2", "Well it's time someone fucking did something!", grozz);
    grozz.face(DIR.W);
    await this.say("k1", "Me want iPad!", jr, { gap: 60 });
    await this.say("k2", "No! Me want iPad!", scr, { gap: 60 });
    await this.say("k3", "Meeeee! Me want it!", jr, { gap: 60 });
    await grozz.walk(144, 168, 90);
    grozz.face(DIR.N); grozz.play(grozz.has("rage") ? "rage" : "cheer");
    await this.say("g3", "I'll fucking show you whose iPad it is!", grozz);
    this.mark("snap");
    fight.remove();
    pad.setPosition(grozz.sp.x - 10, grozz.sp.y - 60);
    grozz.play(grozz.has("snap") ? "snap" : "punch", false, 12);
    await this.wait(350);
    this.sfx("snap");
    // Snapped clean across: two halves of the actual iPad, and a spray of glass.
    const halfA = this.add.image(pad.x - 13, pad.y, "ipad").setScale(1.2).setCrop(0, 0, 24, 36).setDepth(300);
    const halfB = this.add.image(pad.x + 13, pad.y, "ipad").setScale(1.2).setCrop(24, 0, 24, 36).setDepth(300);
    halfA.setX(pad.x); halfB.setX(pad.x);
    for (let i = 0; i < 12; i++) { const gl = this.add.rectangle(pad.x, pad.y, 3, 3, Math.random() < 0.5 ? 0xcfe8ff : 0x7a9ab8).setDepth(301); this.tweens.add({ targets: gl, x: gl.x + (Math.random() - 0.5) * 120, y: gl.y + Math.random() * 80, alpha: 0.3, duration: 500 }); }
    pad.destroy();
    this.tweens.add({ targets: halfA, x: halfA.x - 120, y: halfA.y + 90, angle: -540, duration: 700, ease: "Quad.out" });
    this.tweens.add({ targets: halfB, x: halfB.x + 140, y: halfB.y + 60, angle: 600, duration: 700, ease: "Quad.out" });
    this.popup(grozz.sp.x, grozz.sp.y - 120, "SNAP", "#ffffff");
    this.sfx("wail", 0.8);
    jr.face(DIR.S); jr.play("cry"); scr.face(DIR.S); scr.play("cry");
    await this.wait(900);
    shez.sp.setVisible(true);
    await shez.walk(300, 135, 95);
    shez.face(DIR.W); shez.play("shout");
    grozz.face(DIR.E);
    await this.say("w1", "GROZZ! What the FUCK have you done?! That was off Cash Converters, you fat fucking CUNT!", shez);
    shez.face(DIR.W);
    grozz.play(grozz.has("rage") ? "rage" : "cheer");
    await this.say("g4", "Shut your fucking mouth, you dopey fucking bint, and get me a fucking drink! It's time for me to finally do something to fucking change history! I could be the chosen one! Watch how you fucking talk to me!", grozz);
    grozz.face(DIR.E);
    shez.play("shout");
    await this.say("w2", "Change history?! You can't even afford a fucking TICKET, you fat useless fucking cunt!", shez);
    shez.face(DIR.W);
    await grozz.walk(270, 138, 90);
    grozz.face(DIR.E);
    await this.say("g5", "Then I'll take your fucking benefit money, you fucking slag. Which I deserve anyway, for being a good dad.", grozz);
    grozz.play("punch", false, 12);
    this.sound.play("kaching");
    this.popup(grozz.sp.x, grozz.sp.y - 130, "+£40", "#f2c94c");
    await this.wait(500);
    shez.play("shout");
    await this.say("w3", "That's me NAILS money! I'm 'aving me nails done Thursday! You fat... fucking... CUNT!", shez);
    // That does it: he shoves her into the wall.
    this.mark("shove");
    await grozz.walk(shez.sp.x > R(300, 0).x ? 300 : 286, 137, 160);
    grozz.face(DIR.E); grozz.play("punch", false, 16);
    await this.wait(140);
    const wallX = R(346, 0).x;
    if (this.cache.audio.exists("punch")) this.sound.play("punch", { volume: 0.7, rate: 0.8 });
    shez.face(DIR.W);
    await new Promise<void>((r) => this.tweens.add({ targets: shez.sp, x: wallX, duration: 170, ease: "Quad.in", onComplete: () => r() }));
    this.sfx("wall_crash", 0.7); this.sfx("bodyfall", 0.9);
    this.cameras.main.shake(260, 0.014);
    for (let i = 0; i < 14; i++) {
      const d = this.add.rectangle(wallX + 6, shez.sp.y - 60 - Math.random() * 40, 3, 3, Math.random() < 0.5 ? 0xd8cbb0 : 0x7a6a55).setDepth(1300);
      this.tweens.add({ targets: d, x: d.x - 10 - Math.random() * 40, y: shez.sp.y + Math.random() * 6, alpha: 0.2, duration: 500 + Math.random() * 300, ease: "Quad.in" });
    }
    const crack = this.add.graphics().setDepth(5);
    crack.lineStyle(2, 0x120c07, 0.9);
    for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (Math.random() - 0.5) * 2.4; crack.lineBetween(wallX + 8, shez.sp.y - 70, wallX + 8 + Math.cos(a) * 18, shez.sp.y - 70 + Math.sin(a) * 26); }
    // She slides down the wall.
    this.tweens.add({ targets: shez.sp, y: shez.sp.y + 8, x: wallX - 6, duration: 600, ease: "Quad.out" });
    shez.play(shez.has("cry") ? "cry" : "shout");
    jr.face(DIR.E); scr.face(DIR.E);
    await this.say("w5", "OW! You fucking ANIMAL! I'm calling the Old Bill on you, Grozz!", shez);
    // The kids, and one packet of crisps between them.
    jr.face(DIR.E); scr.face(DIR.W);
    const crisps = this.add.image(R(142, 132).x, R(142, 132).y, "crisps").setScale(1.3).setDepth(300);
    jr.play("tug"); scr.play("tug");
    this.tweens.add({ targets: crisps, x: { from: crisps.x - 8, to: crisps.x + 8 }, duration: 160, yoyo: true, repeat: -1 });
    await this.say("k4", "I'm hungry!", jr, { gap: 40 });
    await this.say("k5", "I'm hungrier! Give me the crisps!", scr, { gap: 40 });
    this.sfx("crisps");
    await this.say("k6", "They're my fucking crisps, you cunt!", jr, { gap: 40 });
    await this.say("k7", "No they're MY fucking crisps, you fucking CUNT!", scr, { gap: 40 });
    this.tweens.killTweensOf(crisps);
    // The bag bursts: the two torn halves go each way and crisps go everywhere, up and down.
    const ripA = this.add.image(crisps.x, crisps.y, "crisps").setScale(1.3).setCrop(0, 0, 16, 40).setDepth(300), ripB = this.add.image(crisps.x, crisps.y, "crisps").setScale(1.3).setCrop(16, 0, 16, 40).setDepth(300);
    this.tweens.add({ targets: ripA, x: ripA.x - 50, y: ripA.y + 30, angle: -200, duration: 500, ease: "Quad.out" });
    this.tweens.add({ targets: ripB, x: ripB.x + 50, y: ripB.y + 30, angle: 220, duration: 500, ease: "Quad.out" });
    for (let i = 0; i < 40; i++) {
      const c = this.add.ellipse(crisps.x, crisps.y, 6 + Math.random() * 4, 4 + Math.random() * 3, Math.random() < 0.8 ? 0xf2d06a : 0xd9a63a).setDepth(301);
      const tx = c.x + (Math.random() - 0.5) * 220, ty = c.y + Math.random() * 110 - 10;
      this.tweens.add({ targets: c, x: tx, angle: Math.random() * 720, duration: 600 + Math.random() * 300, ease: "Quad.out" });
      this.tweens.add({ targets: c, y: { from: c.y - 40 - Math.random() * 40, to: ty }, duration: 600 + Math.random() * 300, ease: "Bounce.out" });
    }
    crisps.destroy();
    // Ronson's after the crisps, and the kids. A growl, and he goes for them.
    if (ron) {
      stuffing?.remove();
      this.sfx("bark", 0.6);
      ron.face(DIR.NE);
      await this.wait(300);
      const growl = this.cache.audio.exists("bark") ? this.sound.add("bark", { rate: 0.55, volume: 0.9 }) : null; growl?.play();
      await ron.walk(132, 166, 220);
      ron.dir = DIR.N; ron.play(ron.has("lunge") ? "lunge" : "walk", true, 12);
      this.sfx("dog_bite", 0.7);
      this.tweens.add({ targets: ron.sp, y: ron.sp.y - 22, duration: 120, yoyo: true, repeat: 3 });
      jr.face(DIR.S); jr.play("cry"); scr.face(DIR.S); scr.play("cry"); this.sfx("wail", 0.9);
      this.tweens.add({ targets: [jr.sp, scr.sp], y: "-=10", duration: 90, yoyo: true, repeat: 3 });
      grozz.play(grozz.has("rage") ? "rage" : "punch", false, 14);
      await this.say("g12", "SHUT IT, RONSON!", grozz, { gap: 40 });
      ron.face(DIR.S);
      shez.play("shout");
      await this.say("w6", "He's just telling them he loves them in dog language!", shez);
      await ron.walk(92, 226, 120);
      ron.face(DIR.W); ron.play(ron.has("chew") ? "chew" : "walk", true, 11);
    }
    // And now they're at it: fists.
    const brawl = this.time.addEvent({ delay: 260, loop: true, callback: () => {
      const hitter = Math.random() < 0.5 ? jr : scr;
      hitter.play("punch", false, 16);
      if (this.cache.audio.exists("punch")) this.sound.play("punch", { volume: 0.35, rate: 1.3 + Math.random() * 0.3 });
      this.tweens.add({ targets: (hitter === jr ? scr : jr).sp, x: { from: (hitter === jr ? scr : jr).sp.x, to: (hitter === jr ? scr : jr).sp.x + (hitter === jr ? 6 : -6) }, duration: 70, yoyo: true });
    } });
    await this.say("k8", "I'll fucking KILL you!", jr, { gap: 20 });
    // That's it. The telly comes off the wall and goes across the room.
    grozz.face(DIR.N);
    await grozz.walk(205, 96, 150);
    grozz.face(DIR.N); grozz.play(grozz.has("rage") ? "rage" : "punch", false, 14);
    const outburst = this.say("g10", "I've fucking HAD IT! I've fucking HAD IT!", grozz, { gap: 0 });
    await this.wait(500);
    // Paint over where it hung (the wall behind, a bare bracket), and give him the set.
    const wallAt = R(210.5, 59.5);
    this.add.rectangle(wallAt.x, wallAt.y, 94 * ROOM_SCALE, 43 * ROOM_SCALE, 0x2d2216).setDepth(1);
    const holes = this.add.graphics().setDepth(2);
    holes.fillStyle(0x120c07, 1);
    for (const [hx, hy] of [[-30, -12], [30, -12], [-30, 10], [30, 10]]) holes.fillRect(wallAt.x + hx, wallAt.y + hy, 6, 6);
    holes.lineStyle(2, 0x120c07, 0.9).lineBetween(wallAt.x - 20, wallAt.y - 14, wallAt.x - 4, wallAt.y + 2).lineBetween(wallAt.x + 22, wallAt.y + 8, wallAt.x + 8, wallAt.y - 6);
    tvg.setVisible(false); sparks.remove();
    const set = this.add.container(grozz.sp.x, grozz.sp.y - 120).setDepth(1200);
    set.add(this.add.rectangle(0, 0, 92, 54, 0x111111).setStrokeStyle(3, 0x2a2a2a));
    const glassG = this.add.graphics(); glassG.lineStyle(2, 0xffffff, 0.7);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; glassG.lineBetween(4, -4, 4 + Math.cos(a) * 40, -4 + Math.sin(a) * 22); }
    set.add(glassG);
    this.sfx("chair_smash", 0.5);
    this.cameras.main.shake(200, 0.008);
    await new Promise<void>((r) => this.tweens.add({ targets: set, y: set.y - 40, angle: -8, duration: 380, ease: "Quad.out", onComplete: () => r() }));
    grozz.face(DIR.E); grozz.play("punch", false, 14);
    const land = R(330, 210);
    await new Promise<void>((r) => this.tweens.add({ targets: set, x: land.x, y: land.y, angle: 540, duration: 650, ease: "Quad.in", onComplete: () => r() }));
    set.destroy();
    this.smash(land, [0x111111, 0x2a2a2a, 0xc0c8d0, 0x88a0c0, 0xffffff], "wall_crash", true);
    this.sfx("glass_smash", 1);
    brawl.remove();
    jr.face(DIR.S); jr.play("cry"); scr.face(DIR.S); scr.play("cry"); this.sfx("wail", 0.8);
    await outburst;
    grozz.face(DIR.S);
    await this.say("g6", "Right. I've fucking had enough.", grozz);
    // And on the way out, he does the front room.
    this.mark("smash");
    const rage = () => grozz.play(grozz.has("rage") ? "rage" : "punch", false, 14);
    rage();
    await this.say("g7", "RAAAARGH!", grozz, { gap: 0 });
    await grozz.walk(298, 172, 150);
    grozz.face(DIR.E); grozz.play("punch", false, 14);
    await this.wait(180);
    this.smash(R(318, 182), [0x2a3f8a, 0xb8c0cc, 0x8a1010, 0xd9d9d9], "glass_smash");
    this.breakOff(300, 150, 336, 192, { x: 1, y: 0.3 });
    await this.wait(350);
    await grozz.walk(218, 168, 150);
    grozz.face(DIR.S); grozz.play("punch", false, 14);
    await this.wait(180);
    this.smash(R(215, 205), [0x4a2a1a, 0x6b3e26, 0x2a1a12, 0x9a9a9a], "chair_smash", true);
    this.breakOff(158, 176, 268, 268, { x: 0, y: 1 });
    jr.face(DIR.S); jr.play("cry"); scr.face(DIR.S); scr.play("cry"); this.sfx("wail", 0.7);
    await this.wait(300);
    await grozz.walk(210, 138, 150);
    grozz.face(DIR.N); grozz.play("punch", false, 14);
    await this.wait(180);
    this.smash(R(210, 106), [0x3a2216, 0x5a3422, 0x111111, 0xc0c8d0], "wall_crash", true);
    this.breakOff(163, 96, 258, 122, { x: 0, y: -0.6 });
    shez.face(DIR.W); shez.play("shout");
    const scream = this.say("w4", "Not the fucking telly cabinet! You fat fucking CUNT! I'm ringing me mum! I'm ringing me MUM!", shez);
    await this.wait(900);
    grozz.play("punch", false, 14);
    this.smash(R(240, 112), [0x3a2216, 0x111111, 0xc0c8d0], "glass_smash");
    this.breakOff(106, 76, 152, 114, { x: -1, y: 0 });
    await scream;
    await grozz.walk(330, 112, 120);
    grozz.face(DIR.S);
    await this.wait(400);
    await this.say("g8", "You'll see...", grozz);
    rage();
    this.cameras.main.shake(300, 0.012);
    await this.say("g9", "They'll all fucking SEE!", grozz);
    if (ron) {
      grozz.face(DIR.W);
      await this.say("g11", "Get 'ere, Ronson, you cunt!", grozz, { gap: 40 });
      this.sfx("bark", 0.8);
      await ron.walk(320, 120, 260);
      void ron.walk(352, 100, 200).then(() => ron.sp.setVisible(false));
    }
    await grozz.walk(352, 96, 110);
    grozz.sp.setVisible(false); ron?.sp.setVisible(false);
    this.sfx("door");
    this.cameras.main.shake(250, 0.01);
    await this.wait(500);
    this.mark("title");
    // Title.
    const black = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(4000);
    await new Promise<void>((r) => this.tweens.add({ targets: black, fillAlpha: 1, duration: 700, onComplete: () => r() }));
    this.sound.stopAll();
    this.tune = null;
    this.music("mus_title", 0.6, false);
    const title = this.add.text(W / 2, H / 2 - 20, "KNOCKOUT DAY", { fontFamily: '"Silkscreen", monospace', fontSize: "64px", color: "#ffffff", stroke: "#c8102e", strokeThickness: 8 }).setOrigin(0.5).setDepth(4001).setAlpha(0);
    const sub = this.add.text(W / 2, H / 2 + 46, "Grozz is going to the match.", { fontFamily: '"Pixelify Sans", sans-serif', fontSize: "24px", color: "#f2c94c" }).setOrigin(0.5).setDepth(4001).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 600 });
    await this.wait(2600);
    this.tweens.add({ targets: [title, sub], alpha: 0, duration: 400 });
    await this.wait(450);
    title.destroy(); sub.destroy();
  }

  // ---------- the coach ----------
  /** On the coach to the ground: Grozz in the front seat with Kev, a fat cockney he's never met,
   *  both on the cans and farting, the rest of the coach singing. Kev, without meaning to, tells
   *  him how the day could go: their number 10, their keeper, the ref; that you can do all sorts;
   *  that forty quid won't get you a ticket; and that he'll tie Ronson up outside the Three Lions. */
  async coach() {
    this.mark("coach");
    // Clear the house away: its flickering bulb, the fag smoke, the crying.
    this.time.removeAllEvents(); this.tweens.killAll();
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor("#000000");
    const S = W / 400, bg = this.add.image(W / 2, H / 2, "coach_bg").setScale(S).setDepth(0);
    // Rolling along: the coach sways, street lights sweep across, the lads sing.
    this.tweens.add({ targets: bg, y: { from: H / 2 - 2, to: H / 2 + 2 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.time.addEvent({ delay: 2300, loop: true, callback: () => {
      const l = this.add.rectangle(-200, H / 2, 140, H, 0xfff0c0, 0.08).setDepth(5).setAngle(12);
      this.tweens.add({ targets: l, x: W + 200, duration: 900, onComplete: () => l.destroy() });
    } });
    const chant = this.cache.audio.exists("chant_eng") ? this.sound.add("chant_eng", { loop: true, volume: 0.22 }) : null;
    chant?.play();
    if (this.tune) this.tweens.add({ targets: this.tune, volume: 0.18, duration: 800 });
    const seat = (k: string, x: number) => this.add.image(x, H + 6, k).setOrigin(0.5, 1).setScale(S * 0.98).setDepth(100);
    const gz = seat("grozz_seat", W * 0.38), kv = seat("kev_seat", W * 0.62);
    for (const p of [gz, kv]) this.tweens.add({ targets: p, y: { from: H + 6, to: H + 9 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: Math.random() * 400 });
    const head = (p: Phaser.GameObjects.Image) => ({ head: { x: p.x, y: p.y - p.displayHeight * 0.82 } }) as unknown as Person;
    const G = head(gz), K = head(kv);
    // Ronson, in the aisle, eating the seat in front.
    const dogOk = this.textures.exists("ronson-rot");
    const ron = dogOk ? new Person(this, "ronson", 0, 0, DIR.E, 3.2) : null;
    if (ron) { ron.sp.setPosition(W * 0.13, H - 30).setDepth(120); ron.play(ron.has("chew") ? "chew" : "walk", true, 10); }
    const say = (k: string, who: Person, text: string) => this.say(`c_${k}`, text, who);
    // A fart: a green cloud out of the seat, a wobble, a noise, the other one's face.
    const fart = async (p: Phaser.GameObjects.Image, kind: "fart" | "fart_wet" | "fart_long" | "fart_squeak" = "fart") => {
      this.sfx(kind, 1);
      this.tweens.add({ targets: p, x: { from: p.x - 4, to: p.x + 4 }, duration: 60, yoyo: true, repeat: 5 });
      for (let i = 0; i < 9; i++) {
        const c = this.add.circle(p.x + (Math.random() - 0.5) * 120, H - 40, 16 + Math.random() * 22, 0x8fb33a, 0.32).setDepth(150);
        this.tweens.add({ targets: c, y: c.y - 120 - Math.random() * 120, x: c.x + (Math.random() - 0.5) * 120, scale: 2.4, alpha: 0, duration: 1600 + Math.random() * 900, onComplete: () => c.destroy() });
      }
      await this.wait(500);
    };
    const swig = (p: Phaser.GameObjects.Image) => { this.sfx("gulp", 0.8); this.tweens.add({ targets: p, angle: { from: 0, to: -5 }, duration: 260, yoyo: true }); };
    const fade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(4000);
    this.tweens.add({ targets: fade, alpha: 0, duration: 700 });
    await this.wait(900);
    await say("k1", K, "Alright, big man? Kev. Budge up. Christ, what've you been eating?");
    swig(gz);
    await say("g1", G, "Grozz. Fuckin' FIFA, Kev. They're gonna rig it again. Well not today. I'll stop at nothing. NOTHING. England are winning this if I have to do it meself.");
    await fart(kv, "fart");
    await say("k2", K, "Ohhh. Smell that! That's a scotch egg, that is. Vintage.");
    await fart(gz, "fart_long");
    await say("g2", G, "Fuckin' smell THAT, you cunt! Proper English, that!");
    if (ron) { this.sfx("bark", 0.7); this.tweens.add({ targets: ron.sp, y: ron.sp.y - 10, duration: 90, yoyo: true, repeat: 2 }); }
    await say("k3", K, "Here. Is that a dog? Dogs are banned on the coach, mate.");
    await say("g3", G, "He's me therapy dog. For me autism.");
    await say("k4", K, "Course he is. He's eating the seat.");
    swig(kv);
    await say("k5", K, "Listen. You wanna win it? Then think about who could stop us. Their number ten, for one. Bloke's a wizard. Him not playing, that's half the job done.");
    await say("k6", K, "Their keeper. Likes a flutter, so I hear. And the ref. Refs are always bent, mate. It's just who's doing the bending.");
    await say("g4", G, "So I sort out all three of 'em.");
    await say("k7", K, "I never said that. I'm just saying. Keep your ears open round the ground, people talk. How you do it's your business, innit.");
    await say("k8", K, "You could do all sorts. Change your clobber and nobody knows you. Get up on a roof. Get on the blower. A brick, a bung, a bit of chaos. Get yourself in the ground, fair means or foul.");
    swig(gz);
    await say("g5", G, "I've only got forty quid.");
    await say("k9", K, "Forty quid? That won't get you a ticket, son. Ticket office wants sixty. There's a fella called Del does 'em cheaper. Or get creative. Every daft thing you pull off today, the lads'll have a whip-round. Someone's always filming.");
    await say("k10", K, "And there's a pawn shop by the ground. Whatever you happen to... find... he'll give you cash for. No questions.");
    await fart(gz, "fart_wet");
    await say("g6", G, "Ohhh. That's a wet one.");
    await say("k11", K, "That seat's ruined. Here, your dog looks like he could do with a walk.");
    await say("g7", G, "Can't be fucking bothered, Kev. I'm knackered. It's me fibromyalgia.");
    await say("k12", K, "Go on, I'll walk him when we get off. I'll tie him up outside the Three Lions, the pub over the road from the ground. Get him when you want him.");
    await say("g8", G, "Cheers, Kev. You're a top cunt.");
    await fart(kv, "fart_long");
    await say("k13", K, "Smell that. That one's for England.");
    // The whole coach goes up.
    chant?.setVolume(0.6);
    swig(gz); swig(kv);
    this.cameras.main.shake(400, 0.006);
    await this.wait(1400);
    this.tweens.add({ targets: fade, alpha: 1, duration: 800 });
    if (chant) this.tweens.add({ targets: chant, volume: 0, duration: 800 });
    if (this.tune) this.tweens.add({ targets: this.tune, volume: 0, duration: 800 });
    await this.wait(850);
  }
}

/** Play the opening over the page. Calls back when it's over or skipped. */
function lowRateContext(): AudioContext | undefined {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || location.search.includes("mute")) return undefined;
  try { return new Ctx({ sampleRate: 24000 }); } catch { return undefined; }
}

export function playOpening(done: () => void): void {
  const host = document.createElement("div");
  host.id = "opening";
  Object.assign(host.style, { position: "fixed", inset: "0", zIndex: "50", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" });
  const holder = document.createElement("div");
  Object.assign(holder.style, { width: "100%", height: "100%" });
  host.appendChild(holder);
  const skip = document.createElement("button");
  skip.textContent = "Skip ▸";
  skip.className = "skip";
  const BTN = { position: "absolute", bottom: "max(12px, env(safe-area-inset-bottom, 0px))", zIndex: "2", font: '700 16px "Silkscreen", monospace', padding: "10px 12px", background: "#14213d", color: "#fff", border: "2px solid #000", boxShadow: "inset -3px -3px 0 rgba(0,0,0,.4), inset 3px 3px 0 rgba(255,255,255,.15)" };
  Object.assign(skip.style, BTN, { right: "max(12px, env(safe-area-inset-right, 0px))" });
  host.appendChild(skip);
  document.body.appendChild(host);
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    game?.destroy(true);
    host.remove();
    done();
  };
  skip.addEventListener("click", end);
  // Krelworld's film controls along the bottom: pause, next line, skip the lot (a tap on the film is next line too).
  const bar = document.createElement("div");
  Object.assign(bar.style, { position: "absolute", left: "0", right: "0", bottom: "max(12px, env(safe-area-inset-bottom, 0px))", display: "flex", justifyContent: "center", gap: "10px", zIndex: "2", pointerEvents: "none" });
  const mkBtn = (label: string, bg: string) => { const b = document.createElement("button"); b.textContent = label; Object.assign(b.style, BTN, { position: "static", background: bg, pointerEvents: "auto", minWidth: "84px" }); bar.appendChild(b); return b; };
  const scene = () => game?.scene.getScene("opening") as OpeningScene | undefined;
  const pause = mkBtn("❚❚ Pause", "#2a2a2a");
  let paused = false;
  pause.addEventListener("click", () => {
    const sc = scene(); if (!sc) return;
    paused = !paused;
    if (paused) { sc.scene.pause(); sc.sound.pauseAll(); pause.textContent = "▶ Play"; } else { sc.scene.resume(); sc.sound.resumeAll(); pause.textContent = "❚❚ Pause"; }
  });
  const nxt = mkBtn("Next ▸", "#2a2a2a");
  nxt.addEventListener("click", () => { if (!paused) scene()?.next(); });
  skip.remove(); Object.assign(skip.style, { position: "static", pointerEvents: "auto" }); bar.appendChild(skip);
  host.appendChild(bar);
  skip.textContent = "Skip ▸▸";
  // A title card with a Play button first: phones only allow sound after a tap.
  const card = document.createElement("div");
  Object.assign(card.style, { position: "absolute", inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", background: "radial-gradient(circle at 50% 40%, #2a0d10, #000 70%)", zIndex: "1" });
  card.innerHTML = `<div style="font:700 clamp(40px,9vw,84px)/1 'Silkscreen',monospace;color:#fff;text-shadow:0 0 0 #000,4px 4px 0 #c8102e">KNOCKOUT DAY</div>
    <div style="font:600 clamp(16px,2.6vw,22px) 'Pixelify Sans',sans-serif;color:#f2c94c">England are in the quarter-finals. Grozz has had enough.</div>`;
  const play = document.createElement("button");
  play.textContent = "Play ▸";
  Object.assign(play.style, { font: '700 22px "Silkscreen", monospace', padding: "14px 28px", background: "#c8102e", color: "#fff", border: "3px solid #000", boxShadow: "inset -4px -4px 0 rgba(0,0,0,.35), inset 4px 4px 0 rgba(255,255,255,.2)" });
  card.appendChild(play);
  host.appendChild(card);
  let game: Phaser.Game;
  play.addEventListener("click", () => { card.remove(); start(); });
  const start = () => { game = new Phaser.Game({
    type: location.search.includes("opcanvas") ? Phaser.CANVAS : Phaser.AUTO, parent: holder, backgroundColor: "#000000", pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    scene: [],
    // A 24 kHz sound context: half the memory for the film's voices, and nobody can tell.
    audio: { disableWebAudio: false, noAudio: location.search.includes("mute"), context: lowRateContext() },
  });
  game.scene.add("opening", OpeningScene, true, { done: end }); };
}
