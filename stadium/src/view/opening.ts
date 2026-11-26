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
const LINES = ["n1", "n2", "s1", "s2", "s3", "n3", "g1", "g2", "k1", "k2", "k3", "g3", "w1", "g4", "w2", "g5", "w3", "k4", "k5", "k6", "g6"];
const SFX = ["sting", "tvsmash", "snap", "wail", "door", "pubcheer", "crisps"];
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
    const a = Math.atan2(dy, dx), idx = (Math.round(((a - Math.PI / 2) / (Math.PI / 4)) + 8) % 8);
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
    for (const k of ["tv_studio", "tv_presser", "tv_fans", "room", "tv_studio_bg", "tv_presser_bg", "tv_pub_bg", "tv_studio_front", "tv_presser_front"]) this.load.image(k, `scenes/${k}.png`);
    // The newsreader and the manager: camera-facing talking sheets, 128 px cells, one row.
    for (const b of ["penelope", "scronson"]) for (const a of ["rot", "talk", "talk2"]) this.load.spritesheet(`${b}-${a}`, `art/${b}-${a}.png`, { frameWidth: 128, frameHeight: 128 });
    for (const b of ["lad", "woman"]) for (const a of ["rot", "cheer"]) this.load.spritesheet(`${b}-${a}`, `art/${b}-${a}.png`, { frameWidth: 88, frameHeight: 88 });
    for (const k of LINES) this.load.audio(`op_${k}`, `audio/op_${k}.mp3`);
    for (const k of SFX) this.load.audio(`op_${k}`, `audio/op_${k}.mp3`);
    this.load.audio("kaching", "audio/kaching.mp3");
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
    void this.run();
  }

  // ---------- helpers ----------
  mark(m: string) { (window as unknown as { __op?: string }).__op = m; if (location.search.includes("trace")) console.warn("op", m, Math.round(performance.now())); }
  wait(ms: number) { return new Promise<void>((r) => this.time.delayedCall(ms, r)); }
  sfx(k: string, vol = 1) { if (this.cache.audio.exists(`op_${k}`) || this.cache.audio.exists(k)) this.sound.play(this.cache.audio.exists(`op_${k}`) ? `op_${k}` : k, { volume: vol }); }
  /** A voiced line, with a bubble over whoever says it (or a subtitle on the telly). Resolves when it's said. */
  say(k: string, text: string, who: Person | null, opts: { gap?: number; sub?: boolean } = {}): Promise<void> {
    const snd = this.cache.audio.exists(`op_${k}`) ? this.sound.add(`op_${k}`) : null;
    const objs: Phaser.GameObjects.GameObject[] = [];
    if (who) objs.push(...this.bubble(who, text));
    else objs.push(...this.subtitle(text));
    return new Promise((res) => {
      const end = () => { objs.forEach((o) => o.destroy()); res(); };
      if (snd) { snd.once("complete", () => this.time.delayedCall(opts.gap ?? 150, end)); snd.play(); }
      else this.time.delayedCall(900 + text.length * 55, end);
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
    if (!this.textures.exists(`${base}-rot`)) return null;
    const sp = this.add.sprite(x, y, `${base}-rot`, 0).setOrigin(0.5, 1).setScale(scale).setDepth(5);
    // Crop at the desk: only what's above deskY (screen) shows.
    const top = y - 128 * scale, keep = Math.max(1, (deskY - top) / scale);
    sp.setCrop(0, 0, 128, Math.min(128, keep));
    let k = 0;
    const talk = (on: boolean) => {
      if (!on) { sp.stop(); sp.setFrame(0); return; }
      const a = ["talk", "talk2"][k++ % 2];
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
    if (!location.search.includes("oproom")) await this.telly();
    await this.room();
  }

  async telly() {
    // ===== The telly =====
    const live = this.textures.exists("tv_studio_bg") && this.textures.exists("penelope-rot");
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
    const live2 = this.textures.exists("tv_presser_bg") && this.textures.exists("scronson-rot");
    pic.setTexture(live2 ? "tv_presser_bg" : "tv_presser").setScale(W / 400);
    const mics = live2 ? this.add.image(W / 2, H / 2, "tv_presser_front").setScale(W / 400).setDepth(6) : null;
    const scron = live2 ? this.onTelly("scronson", W / 2, H * PRES.presser.feet, PRES.presser.scale, (DESK.presser * W) / 400) : null;

    chrome.strap("Scronson Flabbergast", "England manager", 6000);
    const flash = this.time.addEvent({ delay: 900, loop: true, callback: () => { const f = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.35).setDepth(40); this.tweens.add({ targets: f, alpha: 0, duration: 140, onComplete: () => f.destroy() }); } });
    for (const [k, t] of [["s1", "Look. The key is to score goals."], ["s2", "Obviously the other lot will be trying to score goals as well. So we'll need to stop that."], ["s3", "The mentality we need is a footie mentality. We'll take it one game at a time. Then the next game."]] as const) {
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
    // The telly on the wall, smashed and sparking.
    const tv = R(205, 62), tvg = this.add.graphics().setDepth(90);
    tvg.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; tvg.lineBetween(tv.x, tv.y, tv.x + Math.cos(a) * 60, tv.y + Math.sin(a) * 34); }
    this.time.addEvent({ delay: 300, loop: true, callback: () => { const s = this.add.rectangle(tv.x + (Math.random() - 0.5) * 70, tv.y + (Math.random() - 0.5) * 30, 4, 4, 0xfff3a0).setDepth(91); this.tweens.add({ targets: s, y: s.y + 40, alpha: 0, duration: 500, onComplete: () => s.destroy() }); } });
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
    this.mark("room-cast");
    // The iPad between the kids.
    const pad = this.add.rectangle(R(142, 132).x, R(142, 132).y, 22, 16, 0x1a1a1a).setStrokeStyle(2, 0x9aa0a6).setDepth(300);
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
    const halfA = this.add.rectangle(pad.x - 6, pad.y, 11, 16, 0x1a1a1a).setStrokeStyle(2, 0x9aa0a6).setDepth(300), halfB = this.add.rectangle(pad.x + 6, pad.y, 11, 16, 0x1a1a1a).setStrokeStyle(2, 0x9aa0a6).setDepth(300);
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
    await this.say("w1", "Grozz! What the fuck have you done?! That was off Cash Converters!", shez);
    shez.face(DIR.W);
    grozz.play(grozz.has("rage") ? "rage" : "cheer");
    await this.say("g4", "Shut your fucking mouth and get me a fucking drink! It's time for me to finally do something to fucking change history! I could be the chosen one! Watch how you fucking talk to me!", grozz);
    grozz.face(DIR.E);
    shez.play("shout");
    await this.say("w2", "Change history? You can't even afford a fucking ticket, you fat useless lump!", shez);
    shez.face(DIR.W);
    await grozz.walk(270, 138, 90);
    grozz.face(DIR.E);
    await this.say("g5", "Then I'll take your fucking benefit money. Which I deserve anyway, for being a good dad.", grozz);
    grozz.play("punch", false, 12);
    this.sound.play("kaching");
    this.popup(grozz.sp.x, grozz.sp.y - 130, "+£40", "#f2c94c");
    await this.wait(500);
    shez.play("shout");
    await this.say("w3", "That's me nails money! I'm getting me nails done Thursday! Grozz!", shez);
    // The kids, and one packet of crisps between them.
    jr.face(DIR.E); scr.face(DIR.W);
    const crisps = this.add.rectangle(R(142, 132).x, R(142, 132).y, 16, 20, 0xc8102e).setStrokeStyle(2, 0xf2c94c).setDepth(300);
    jr.play("tug"); scr.play("tug");
    this.tweens.add({ targets: crisps, x: { from: crisps.x - 8, to: crisps.x + 8 }, duration: 160, yoyo: true, repeat: -1 });
    await this.say("k4", "I'm hungry!", jr, { gap: 40 });
    await this.say("k5", "I'm hungrier! Give me the crisps!", scr, { gap: 40 });
    this.sfx("crisps");
    await this.say("k6", "They're my crisps!", jr, { gap: 40 });
    this.tweens.killTweensOf(crisps);
    for (let i = 0; i < 24; i++) { const c = this.add.rectangle(crisps.x, crisps.y, 5, 4, 0xf2d06a).setDepth(301); this.tweens.add({ targets: c, x: c.x + (Math.random() - 0.5) * 160, y: c.y + Math.random() * 90 - 20, angle: Math.random() * 360, duration: 500 + Math.random() * 300, ease: "Quad.out" }); }
    crisps.destroy();
    grozz.face(DIR.S);
    await this.say("g6", "Right. I've fucking had enough.", grozz);
    await grozz.walk(352, 96, 110);
    grozz.sp.setVisible(false);
    this.sfx("door");
    this.cameras.main.shake(250, 0.01);
    await this.wait(500);
    this.mark("title");
    // Title.
    const black = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(4000);
    await new Promise<void>((r) => this.tweens.add({ targets: black, fillAlpha: 1, duration: 700, onComplete: () => r() }));
    this.sound.stopAll();
    const title = this.add.text(W / 2, H / 2 - 20, "KNOCKOUT DAY", { fontFamily: '"Silkscreen", monospace', fontSize: "64px", color: "#ffffff", stroke: "#c8102e", strokeThickness: 8 }).setOrigin(0.5).setDepth(4001).setAlpha(0);
    const sub = this.add.text(W / 2, H / 2 + 46, "Grozz is going to the match.", { fontFamily: '"Pixelify Sans", sans-serif', fontSize: "24px", color: "#f2c94c" }).setOrigin(0.5).setDepth(4001).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 600 });
    await this.wait(2600);
    this.finish();
  }
}

/** Play the opening over the page. Calls back when it's over or skipped. */
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
  Object.assign(skip.style, { position: "absolute", right: "max(12px, env(safe-area-inset-right, 0px))", bottom: "max(12px, env(safe-area-inset-bottom, 0px))", zIndex: "2", font: '700 16px "Silkscreen", monospace', padding: "10px 16px", background: "#14213d", color: "#fff", border: "2px solid #000", boxShadow: "inset -3px -3px 0 rgba(0,0,0,.4), inset 3px 3px 0 rgba(255,255,255,.15)" });
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
    audio: { disableWebAudio: false, noAudio: location.search.includes("mute") },
  });
  game.scene.add("opening", OpeningScene, true, { done: end }); };
}
