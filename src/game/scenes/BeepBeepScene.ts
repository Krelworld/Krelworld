import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { vfx } from "../gfx/Vfx";
import { DialogueBox } from "../ui/DialogueBox";
import { FONT, title } from "../ui/theme";
import { runChain, switchTo, fadeThen } from "../Flow";
import { dir, say } from "../../content/dsl";

// Pseudo-3D road (OutRun style): the track is a list of segments, each with a curve and a height (hills);
// every frame we project the ones in front of you, front-to-back for hill occlusion, then draw back-to-front.
const SEG = 200; // world units per segment
const ROAD_W = 2000; // half-width of the road in world units
const CAM_H = 1000;
const DRAW = 150; // segments drawn
const FOV_D = 0.84; // camera depth (1 / tan(fov/2)); boosting widens the view
const W = 960;
const H = 540;
const HORIZON = 214;
const N_SEG = 3200;
const GOAL = 25;
const TIME = 80;
const MAX_SPEED = 14000;
const CRUISE = 10000;
const BOOST_SPEED = 19500;
const COMBO_WINDOW = 2.6; // seconds between hits to keep a combo going
/** the driver's-eye dashboard: where the art goes on screen (it's drawn big so the windscreen is wide) */
const DASH_S = 2.3;
const DASH_X = W / 2 - 256 * DASH_S;
const DASH_Y = 420 - 190 * DASH_S;
const ds = (ix: number, iy: number) => ({ x: DASH_X + ix * DASH_S, y: DASH_Y + iy * DASH_S });

type Kind = "ped" | "warden" | "thing" | "lamp" | "deco" | "car" | "van";
type Thing = {
  z: number;
  off: number;
  key: string;
  kind: Kind;
  img: Phaser.GameObjects.Image;
  hit: boolean;
  drift: number;
  /** height as a fraction of the road's half-width on screen */
  h: number;
  /** cars: world units per second along the road (vans come the other way) */
  vz: number;
  /** pedestrians: 0 strolling, 1 diving out of the way, 2 lying in the gutter feeling clever */
  dodge: 0 | 1 | 2;
  dodgeTo: number;
  dodgy: number;
  frozenUntil: number;
  angle: number;
};
type Proj = { y: number; sx: number; w: number; scale: number; clip: number; world: number };

const MIK = ["RUN HIM OVER!", "GET THAT ONE!", "BEEP BEEP!", "GET OUT THE WAY!", "LIKE PLAYING GTA!", "BUMP BUMP BUMP!", "YEEEE!", "KING MIK!", "THAT ONE'S GOT A MEAL DEAL. GET HIM.", "PAVEMENT'S A ROAD IF YOU BELIEVE", "MIRROR, SIGNAL, MANSLAUGHTER"];
const CHZ = ["YEGHHH!", "HIT THE BIN!", "THAT'S A TRAFFIC WARDEN. DOUBLE POINTS.", "Mork.", "GET THE BUS STOP!", "YEGH YEGH YEGH"];
/** combo callouts, by chain length */
const COMBO_CALL = ["", "", "DOUBLE BUMP!", "TRIPLE BUMP!", "BUMP BUMP BUMP BUMP!", "MULTI-BUMP!", "MONSTER BUMP!", "ULTRA BUMP!!", "KING MIK SHIT!!!"];
const CRASH_MIK = ["WATCH THE PAINTWORK!", "THAT'S A STOLEN CAR, BLUD!", "WE'RE NOT HERE TO HIT CARS!", "OI! WRONG KIND OF BUMP!"];
const DODGE_MIK = ["HE DODGED! THE AUDACITY!", "SHE'S DONE A FORWARD ROLL!", "PARKOUR PRICK!", "HE THINKS HE'S IN THE MATRIX"];

/** SanMik's car. You drive. SanMik and SanChz shout. Run over 25 pedestrians before the song ends. */
export class BeepBeepScene extends Phaser.Scene {
  private mirrorBox: { x: number; y: number; w: number; h: number } | null = null;
  private box!: DialogueBox;
  private chain: string[] = [];
  private resume: { dungeon: string; room: number } | null = null;
  private startData: any;
  private g!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private curves: number[] = [];
  private hills: number[] = [];
  private things: Thing[] = [];
  private traffic: Thing[] = [];
  private pos = 0;
  private speed = 0;
  /** The engine: two detuned sawtooths through a low-pass, pitched and opened up by speed. */
  private engine: { oscs: OscillatorNode[]; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private px = 0;
  private hits = 0;
  private left = TIME;
  private elapsed = 0;
  private running = false;
  private ended = false;
  private hud!: Phaser.GameObjects.Text;
  private timerTx!: Phaser.GameObjects.Text;
  private comboTx!: Phaser.GameObjects.Text;
  private mphTx!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private nextBark = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private sky!: Phaser.GameObjects.TileSprite | null;
  private wheel!: Phaser.GameObjects.Container;
  private bump = 0;
  private steerS = 0;
  private fov = FOV_D;
  private boost = 100;
  private boosting = false;
  private combo = 0;
  private comboT = 0;
  private bestCombo = 0;
  private score = 0;
  private freezeUntil = 0;
  private invulnUntil = 0;
  private hornReady = 0;
  private nextCar = 0;
  private streaks: { a: number; r: number; l: number }[] = [];
  private proj: Proj[] = [];

  constructor() {
    super("BeepBeep");
  }

  create(data: { chain?: string[]; resume?: { dungeon: string; room: number }; retry?: boolean }) {
    // (the scene clock is stale until its first update: bring it up to date so start times taken now are right)
    this.time.now = this.game.loop.time;
    this.startData = data;
    this.chain = data.chain ?? [];
    this.resume = data.resume ?? null;
    this.things = [];
    this.traffic = [];
    this.curves = [];
    this.hills = [];
    this.pos = 0;
    this.speed = 0;
    this.px = -0.45;
    this.hits = 0;
    this.left = TIME;
    this.elapsed = 0;
    this.running = false;
    this.ended = false;
    this.steerS = 0;
    this.fov = FOV_D;
    this.boost = 100;
    this.boosting = false;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.score = 0;
    this.freezeUntil = 0;
    this.invulnUntil = 0;
    this.hornReady = 0;
    this.nextCar = 0;
    this.streaks = [];
    G.s.phase = "dungeon";
    this.cameras.main.fadeIn(300);
    // sky and skyline (a dusk panorama when we have it; the old high street otherwise)
    this.add.rectangle(W / 2, HORIZON / 2, W, HORIZON + 4, 0xf59e7b).setDepth(-30);
    this.sky = null;
    const skyKey = this.textures.exists("bb_skyline") ? "bb_skyline" : this.textures.exists("sm_street") ? "sm_street" : null;
    if (skyKey) {
      const src = this.textures.get(skyKey).getSourceImage();
      const sh = skyKey === "bb_skyline" ? 300 : 230;
      this.sky = this.add.tileSprite(0, HORIZON - sh + 2, W, sh, skyKey).setOrigin(0).setDepth(-20);
      this.sky.setTileScale(sh / src.height);
    }
    this.g = this.add.graphics().setDepth(0);
    this.fx = this.add.graphics().setDepth(450);
    this.buildTrack();
    this.populate();
    for (let i = 0; i < 34; i++) this.streaks.push({ a: Math.random() * Math.PI * 2, r: 60 + Math.random() * 600, l: 30 + Math.random() * 70 });
    this.buildCabin();
    this.buildHud();
    this.keys = this.input.keyboard!.addKeys("A,D,W,S,E,H,LEFT,RIGHT,UP,DOWN,SPACE,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.box = new DialogueBox(this, 1000, 0.3);
    // the song kicks in straight away, under the briefing
    // start where the drums come in (20.0s of 240.6s), not on the long intro
    synth.music("beepbeep", true, 19.95 / 240.64);
    const howTo = dir(`HOW TO PLAY: steer with A / D (or the arrows, or hold your finger left or right of the wheel). W to floor it, S to brake, SHIFT to boost. E (or H) honks the horn: everyone in front freezes in terror, so they can't dive out of the way. Run over ${GOAL} pedestrians before the song ends. Chain hits for combo time. Don't hit other cars.`);
    const brief = data.retry
      ? [say("SANMIK", "Again. They've all got back up. Bump 'em properly this time."), howTo]
      : [
          dir("A stolen Range Rover, idling on Catford High Street. SanChz nicked it. SanMik has made you drive it. The sat-nav has been set to THE BANK OF CATFORD, via THE PAVEMENT.", { variants: { MIKEY: "A stolen Range Rover, idling on Catford High Street. SanChz nicked it. You're driving it, because you're SanMik and you said so. The sat-nav has been set to THE BANK OF CATFORD, via THE PAVEMENT." } }),
          say("SANMIK", "Yee. We need to get to the bank. Shortest route's through all them people."),
          say("SANCHZ", "YEGHHH. Pedestrians are just speed bumps with opinions."),
          say("SANMIK", "Twenty-five of 'em before the song ends, or we're late for the robbery. Traffic wardens count double. Bins count for nothing but they're satisfying."),
          say("SANCHZ", "They've seen the news, though. Some of 'em do a little dive now."),
          howTo,
        ];
    this.box.play(brief).then(() => {
      this.running = true;
      this.startEngine();
      synth.play("car_screech");
    });
  }

  // ------------------------------------------------------------------ the world

  /** A long high street: eased curves (some proper bends) and rolling hills, looping back to where it started. */
  private buildTrack() {
    let i = 0;
    let y = 0;
    while (i < N_SEG) {
      const len = 50 + Math.floor(Math.random() * 90);
      const r = Math.random();
      const curve = i < 60 ? 0 : r < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 3.4);
      const hill = i < 60 ? 0 : Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 2 * (1400 + Math.random() * 2200);
      const y0 = y;
      for (let k = 0; k < len && i < N_SEG; k++, i++) {
        const t = k / len;
        // ease in and out of each bend
        const ease = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
        this.curves.push(curve * ease);
        y = y0 + (hill * (1 - Math.cos(Math.PI * t))) / 2;
        this.hills.push(y);
      }
    }
    // close the loop: remove the drift so the last segment meets the first
    const end = this.hills[N_SEG - 1];
    for (let k = 0; k < N_SEG; k++) this.hills[k] -= (end * k) / (N_SEG - 1);
  }

  /** Pedestrians, wardens and bins on the road; lamp posts, hedges and shops lining it. */
  private populate() {
    const peds = this.textures.getTextureKeys().filter((k) => /^spr_(FOLK\d|TV_)/.test(k) && !/KID|CHILD|BABY|BOY|GIRL|COOKIE/.test(k));
    const props = ["bb_wheelie", "d_busstop", "d_phonebooth", "p_bin", "d_newsstand", "d_scooter", "d_pot"].filter((k) => this.textures.exists(k));
    const shops = ["bb_shop0", "bb_shop1", "bb_shop2", "bb_shop3", "bb_house0", "bb_house1"].filter((k) => this.textures.exists(k));
    const hasLamp = this.textures.exists("bb_lamp");
    const hasHedge = this.textures.exists("bb_hedge");
    for (let s = 40; s < N_SEG - 10; s += 6 + Math.floor(Math.random() * 6)) {
      const r = Math.random();
      if (r < 0.64 && peds.length) this.addThing(s * SEG, (Math.random() - 0.5) * 2.5, peds[Math.floor(Math.random() * peds.length)], "ped");
      else if (r < 0.75 && this.textures.exists("spr_COP")) this.addThing(s * SEG, (Math.random() - 0.5) * 2.3, "spr_COP", "warden");
      else if (props.length) this.addThing(s * SEG, (Math.random() < 0.5 ? -1 : 1) * (0.95 + Math.random() * 0.5), props[Math.floor(Math.random() * props.length)], "thing");
    }
    // street furniture streaming past: lamp posts on the kerb, the shops and houses behind the pavement
    for (let s = 8; s < N_SEG; s += 10) {
      const side = (s / 10) % 2 === 0 ? -1 : 1;
      if (hasLamp) this.addThing(s * SEG, side * 1.72, "bb_lamp", "lamp");
    }
    for (let s = 4; s < N_SEG; s += 4) {
      for (const side of [-1, 1]) {
        if (shops.length && Math.random() < 0.8) this.addThing(s * SEG + Math.random() * 100, side * (2.55 + Math.random() * 0.3), shops[Math.floor(Math.random() * shops.length)], "deco");
        else if (hasHedge) this.addThing(s * SEG, side * 2.35, "bb_hedge", "deco");
      }
    }
  }

  private addThing(z: number, off: number, key: string, kind: Kind, vz = 0): Thing {
    const img = key.startsWith("spr_") ? this.add.image(0, 0, key, 0) : this.add.image(0, 0, key);
    img.setOrigin(0.5, 1).setVisible(false);
    if (kind === "deco" && Math.random() < 0.5 && !key.startsWith("bb_shop")) img.setFlipX(true);
    if ((kind === "ped" || kind === "warden") && Math.random() < 0.5) img.setFlipX(true);
    const h = kind === "ped" || kind === "warden" ? 0.78 : kind === "lamp" ? 1.9 : kind === "deco" ? (key === "bb_hedge" ? 0.55 : 2.1) : kind === "car" ? 0.62 : kind === "van" ? 0.95 : 0.6;
    const t: Thing = {
      z,
      off,
      key,
      kind,
      img,
      hit: false,
      drift: kind === "ped" || kind === "warden" ? (Math.random() - 0.5) * 0.004 : 0,
      h,
      vz,
      dodge: 0,
      dodgeTo: off,
      // how likely they are to dive out of the way (wardens are trained for this), and from how far
      dodgy: kind === "warden" ? 0.7 : kind === "ped" ? 0.38 : 0,
      frozenUntil: 0,
      angle: 0,
    };
    if (kind === "car" || kind === "van") this.traffic.push(t);
    else this.things.push(t);
    return t;
  }

  /** The inside of the car: dashboard, a steering wheel that actually turns, and the lads in the mirror. */
  private buildCabin() {
    const dashKey = this.textures.exists("bb_dash") ? "bb_dash" : this.textures.exists("p_dash") ? "p_dash" : null;
    if (dashKey) {
      const d = this.add.image(DASH_X, DASH_Y, dashKey).setOrigin(0).setDepth(500);
      d.setDisplaySize(512 * DASH_S, 288 * DASH_S);
      const c = ds(256, 262);
      this.wheel = this.add.container(c.x, c.y).setDepth(501);
      if (dashKey === "bb_dash" && this.textures.exists("bb_wheel")) {
        const wi = this.add.image(0, 0, "bb_wheel");
        wi.setDisplaySize(128 * 4.1, 128 * 4.1);
        this.wheel.add(wi);
      }
    } else {
      const dash = this.add.graphics().setDepth(500);
      dash.fillStyle(0x111827, 1).fillRect(0, 440, W, 100);
      dash.fillStyle(0x0b0b0f, 1).fillRect(0, 0, W, 34).fillTriangle(0, 0, 90, 0, 0, 440).fillTriangle(W, 0, W - 90, 0, W, 440);
      this.wheel = this.add.container(W / 2, 560).setDepth(501);
      this.wheel.add(this.add.circle(0, 0, 130, 0x000000, 0).setStrokeStyle(22, 0x1f2937));
      this.wheel.add(this.add.rectangle(0, 0, 240, 18, 0x1f2937));
      this.wheel.add(this.add.circle(0, 0, 26, 0x374151).setStrokeStyle(3, 0xf472b6));
    }
    // rear-view mirror: the lads, egging you on (inside the real mirror when we have the dashboard art)
    const m = dashKey ? ds(256, 72) : { x: W / 2, y: 46 };
    const mw = dashKey ? 84 * DASH_S : 220;
    const mh = dashKey ? 15 * DASH_S : 54;
    const mirror = this.add.container(m.x, m.y).setDepth(510);
    this.mirrorBox = { x: m.x, y: m.y, w: mw, h: mh };
    mirror.add(this.add.rectangle(0, 0, mw, mh, 0x1e293b, dashKey ? 0.9 : 1).setStrokeStyle(dashKey ? 0 : 4, 0x111827));
    // playing as Mikey you're SanMik, at the wheel: just SanChz in the back
    if (this.textures.exists("spr_SANMIK") && G.s.player !== "MIKEY") mirror.add(this.add.image(-50, 18, "spr_SANMIK", 0).setDisplaySize(84, 84));
    if (this.textures.exists("spr_SANCHZ")) mirror.add(this.add.image(50, 18, "spr_SANCHZ", 0).setDisplaySize(84, 84));
    const mm = this.make.graphics({}).fillRect(m.x - mw / 2, m.y - mh / 2, mw, mh);
    mirror.setMask(mm.createGeometryMask());
  }

  private buildHud() {
    const st = (size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#000", strokeThickness: 5 });
    this.hudG = this.add.graphics().setDepth(515);
    this.hud = this.add.text(24, 50, "", st(20, "#f472b6")).setOrigin(0, 0.5).setDepth(520);
    this.timerTx = this.add.text(W - 24, 22, "", st(26, "#ffffff")).setOrigin(1, 0.5).setDepth(520);
    this.comboTx = this.add.text(W - 24, 56, "", st(18, "#fde047")).setOrigin(1, 0.5).setDepth(520);
    this.mphTx = this.add.text(W - 92, 478, "", st(18, "#7dd3fc")).setOrigin(0.5).setDepth(520);
    this.banner = this.add.text(W / 2, 22, "", { ...st(15, "#fde047"), wordWrap: { width: 560 }, align: "center" }).setOrigin(0.5, 0.5).setDepth(520);
    this.hint = this.add.text(92, 508, "SHIFT BOOST · E HORN", st(12, "#e5e7eb")).setOrigin(0.5).setDepth(520);
    title(this, 92, 22, "BEEP BEEP", 22, "#f472b6").setDepth(520);
  }

  // ------------------------------------------------------------------ chatter

  private bark(who: "SANMIK" | "SANCHZ", t?: string) {
    const list = who === "SANMIK" ? MIK : CHZ;
    const text = t ?? list[Math.floor(Math.random() * list.length)];
    const tx = this.add.text(W / 2 + (who === "SANMIK" ? -200 : 200), 236, text, { fontFamily: FONT, fontSize: "16px", color: who === "SANMIK" ? "#b0c4ff" : "#ffe08a", fontStyle: "bold", stroke: "#000", strokeThickness: 5, wordWrap: { width: 300 }, align: "center" }).setOrigin(0.5).setDepth(530);
    this.tweens.add({ targets: tx, y: 200, alpha: 0, delay: 1000, duration: 500, onComplete: () => tx.destroy() });
    synth.shout(who === "SANMIK" ? "yee" : "yegh", 0.7);
    this.nextBark = Math.max(this.nextBark, this.time.now + 1800);
  }

  private shake(ms: number, k: number) {
    if (G.meta.settings.shake !== false) this.cameras.main.shake(ms, k);
  }

  private finish(win: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    synth.stopMusic();
    const best = Number(G.s.flags.sm_beepbeep_best ?? 0);
    if (win && this.score > best) G.s.flags.sm_beepbeep_best = this.score;
    const lines = win
      ? [
          dir(`${this.hits} pedestrians. Style points: ${this.score.toLocaleString()}. Best combo: x${this.bestCombo}.${this.score > best && best > 0 ? " A new Catford record." : ""}`),
          say("SANMIK", "YEEEEE! That's a Catford record! Better than GTA!"),
          say("SANCHZ", "YEGHHH. There's a bloke still on the bonnet."),
          dir("There is. He waves. He's fine. Everyone in the SanMikverse is somehow fine. They get up, dust themselves off, and leave one-star reviews of SanMik's driving.", { variants: { MIKEY: "There is. He waves. He's fine. Everyone in the SanMikverse is somehow fine. They get up, dust themselves off, and leave one-star reviews of your driving." } }),
          say("SANMIK", "And here's the bank. Balaclavas on, lads. Like Jason Statham in Crank."),
        ]
      : [say("SANMIK", `${this.hits}? That's not enough people, blud. That's barely a crowd.`), say("SANCHZ", "Go round again. They've all got back up."), dir("Everyone you hit has got back up. They are queuing to be hit again. It's the SanMikverse. Try again.")];
    this.box.play(lines).then(() => {
      fadeThen(this, 250, () => {
        if (!win) return this.scene.restart({ ...this.startData, retry: true });
        G.s.flags.sm_beepbeep_done = true;
        G.save();
        if (this.resume) runChain(this, this.chain, this.resume);
        else switchTo(this, "Hub", { at: "PUB" });
      });
    });
  }

  // ------------------------------------------------------------------ engine noise

  private startEngine() {
    const ctx = synth.ctx;
    if (!ctx || this.engine) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    filt.Q.value = 6;
    const oscs = [0, 7].map((det) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = 38;
      o.detune.value = det;
      o.connect(filt);
      o.start();
      return o;
    });
    // a bit of grit: a square an octave down
    const sub = ctx.createOscillator();
    sub.type = "square";
    sub.frequency.value = 19;
    sub.connect(filt);
    sub.start();
    oscs.push(sub);
    filt.connect(gain).connect(synth.sfxGain);
    this.engine = { oscs, filt, gain };
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.4);
    this.events.once("shutdown", () => this.stopEngine());
  }

  private stopEngine() {
    const e = this.engine;
    const ctx = synth.ctx;
    if (!e || !ctx) return;
    this.engine = null;
    e.gain.gain.cancelScheduledValues(ctx.currentTime);
    e.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    e.oscs.forEach((o) => o.stop(ctx.currentTime + 0.6));
  }

  /** Revs follow speed (and a little wobble, like a real engine). */
  private engineTick(time: number) {
    const e = this.engine;
    const ctx = synth.ctx;
    if (!e || !ctx) return;
    const k = Math.min(1.3, this.speed / MAX_SPEED);
    const wob = Math.sin(time / 60) * 1.5;
    const base = 38 + k * 92 + wob;
    e.oscs.forEach((o, i) => o.frequency.setTargetAtTime(i === 2 ? base / 2 : base, ctx.currentTime, 0.08));
    e.filt.frequency.setTargetAtTime(350 + k * 1600, ctx.currentTime, 0.1);
    e.gain.gain.setTargetAtTime(this.running ? 0.12 + k * 0.08 : 0.05, ctx.currentTime, 0.2);
  }

  // ------------------------------------------------------------------ the loop

  private get trackLen() {
    return N_SEG * SEG;
  }

  /** How far ahead of the camera something at world position z is (wrapping round the loop). */
  private ahead(z: number) {
    const L = this.trackLen;
    let d = z - this.pos;
    if (d < -L / 2) d += L;
    if (d > L / 2) d -= L;
    return d;
  }

  private groundAt(z: number) {
    const L = this.trackLen;
    const zz = ((z % L) + L) % L;
    const i = Math.floor(zz / SEG);
    const f = (zz % SEG) / SEG;
    return Phaser.Math.Linear(this.hills[i % N_SEG], this.hills[(i + 1) % N_SEG], f);
  }

  update(_t: number, delta: number) {
    this.engineTick(_t);
    const dt = Math.min(delta, 50);
    const sec = dt / 1000;
    const k = this.keys;
    const now = this.time.now;
    // hit-stop: the world holds its breath for a few frames on a big impact
    const frozen = now < this.freezeUntil;
    let steer = 0;
    if (this.running && !this.box.active && !frozen) {
      // controls
      const ptr = this.input.activePointer;
      steer = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      if (ptr.isDown && ptr.y > 200) steer = ptr.x < W / 2 - 40 ? -1 : ptr.x > W / 2 + 40 ? 1 : 0;
      const gas = k.W.isDown || k.UP.isDown || k.SPACE.isDown;
      const brake = k.S.isDown || k.DOWN.isDown;
      // the tank has to refill a bit before you can light it again
      const wantBoost = k.SHIFT.isDown && !brake && (this.boosting ? this.boost > 0 : this.boost >= 25);
      if (wantBoost && !this.boosting) {
        synth.play("jet");
        this.pop(W / 2, 300, "BOOOOST", "#fb923c", 24);
      }
      this.boosting = wantBoost;
      this.boost = Phaser.Math.Clamp(this.boost + (this.boosting ? -34 : 7) * sec, 0, 100);
      const max = this.boosting ? BOOST_SPEED : gas ? MAX_SPEED : CRUISE;
      const accel = this.boosting ? 9000 : 4000;
      if (brake) this.speed -= 9000 * sec;
      else if (this.speed < max) this.speed = Math.min(max, this.speed + accel * sec);
      else this.speed = Math.max(max, this.speed - 5000 * sec);
      this.speed = Math.max(0, this.speed);
      // the pavement's bumpy (but that's where the people are)
      const offRoad = Math.abs(this.px) > 1.12;
      if (offRoad && this.speed > 11000) this.speed -= 6000 * sec;
      if (Math.abs(this.px) > 1.6) this.speed = Math.min(this.speed, 7000);
      const seg = Math.floor(this.pos / SEG);
      const curve = this.curves[seg % N_SEG];
      const sp = Math.min(1.3, this.speed / MAX_SPEED);
      this.px += steer * sec * 2.5 * (0.45 + sp * 0.75);
      // the bends throw you outwards; faster = further
      this.px -= curve * sp * sp * sec * 0.42;
      this.px = Phaser.Math.Clamp(this.px, -1.85, 1.85);
      this.pos += this.speed * sec;
      if (this.pos >= this.trackLen) {
        this.pos -= this.trackLen;
        // a lap: everyone you hit has got back up (it's the SanMikverse)
        for (const t of this.things) if (t.hit && (t.kind === "ped" || t.kind === "warden" || t.kind === "thing")) this.revive(t);
      }
      // horn: everyone in front freezes like a rabbit in the headlights
      if ((Phaser.Input.Keyboard.JustDown(k.E) || Phaser.Input.Keyboard.JustDown(k.H)) && now > this.hornReady) this.honk();
      // timer
      this.elapsed += sec;
      this.left -= sec;
      if (this.comboT > 0) {
        this.comboT -= sec;
        if (this.comboT <= 0) this.combo = 0;
      }
      if (this.left <= 0) {
        this.left = 0;
        this.finish(this.hits >= GOAL);
      }
      if (now > this.nextBark) {
        this.bark(Math.random() < 0.65 ? "SANMIK" : "SANCHZ");
        this.nextBark = now + 2800 + Math.random() * 2800;
      }
      this.tickTraffic(sec);
      if (this.hits >= GOAL && !this.ended) this.finish(true);
    }
    if (!this.running) this.boosting = false;
    this.steerS = Phaser.Math.Linear(this.steerS, steer, Math.min(1, sec * 10));
    this.wheel.setAngle(this.steerS * 38);
    this.fov = Phaser.Math.Linear(this.fov, this.boosting ? 0.66 : FOV_D - Math.min(0.08, this.speed / MAX_SPEED * 0.06), Math.min(1, sec * 4));
    this.render(frozen ? 0 : dt);
    this.drawFx(frozen ? 0 : dt);
    this.drawHud();
  }

  /** Same-way traffic (you catch it up) and oncoming vans (they catch you), more of them as the song goes on. */
  private tickTraffic(sec: number) {
    const cars = ["bb_car1", "bb_car2"].filter((k) => this.textures.exists(k));
    const van = this.textures.exists("bb_van") ? "bb_van" : this.textures.exists("p_swatvan") ? "p_swatvan" : null;
    const maxCars = Math.min(6, 2 + Math.floor(this.elapsed / 13));
    if (this.elapsed > 3 && this.time.now > this.nextCar && this.traffic.length < maxCars && (cars.length || van)) {
      const oncoming = van && (!cars.length || Math.random() < 0.42);
      const z = (this.pos + (DRAW - 6) * SEG) % this.trackLen;
      // UK: we keep left, they come at you down the right
      const t = oncoming ? this.addThing(z, 0.42 + Math.random() * 0.2, van, "van", -(5500 + Math.random() * 3000)) : this.addThing(z, -0.42 - Math.random() * 0.2, cars[Math.floor(Math.random() * cars.length)], "car", 4500 + Math.random() * 2500);
      if (t.kind === "car" && Math.random() < 0.5) t.img.setTint([0xff8080, 0x80b0ff, 0xfff080, 0xffffff][Math.floor(Math.random() * 4)]);
      this.nextCar = this.time.now + Math.max(900, 3200 - this.elapsed * 30) + Math.random() * 1500;
    }
    for (const t of [...this.traffic]) {
      t.z = (t.z + t.vz * sec + this.trackLen) % this.trackLen;
      // cars amble about their lane a bit
      t.off += Math.sin(this.time.now / 700 + t.vz) * 0.08 * sec;
      const d = this.ahead(t.z);
      if (d < -600 || d > (DRAW + 10) * SEG) {
        t.img.destroy();
        this.traffic.splice(this.traffic.indexOf(t), 1);
        continue;
      }
      // they honk when you're bearing down on them
      if (!t.hit && d > 0 && d < 1600 && Math.abs(t.off - this.px) < 0.6 && Math.random() < sec * 0.8) synth.play("car_horn");
      if (!t.hit && d > -60 && d < 330 && Math.abs(t.off - this.px) < 0.56 && this.time.now > this.invulnUntil) this.crash(t);
    }
  }

  private honk() {
    this.hornReady = this.time.now + 2500;
    synth.play("car_horn");
    this.bark("SANMIK", "BEEP BEEP!!");
    this.pop(W / 2, 290, "BEEP BEEP!", "#fde047", 30);
    for (const t of this.things) {
      if (t.hit || (t.kind !== "ped" && t.kind !== "warden")) continue;
      const d = this.ahead(t.z);
      if (d > 0 && d < 5200) {
        t.frozenUntil = this.time.now + 1700;
        if (t.dodge === 1) t.dodge = 0;
      }
    }
  }

  private revive(t: Thing) {
    t.hit = false;
    t.dodge = 0;
    t.angle = 0;
    t.img.setAlpha(1).setAngle(0);
  }

  private render(dt: number) {
    const g = this.g;
    g.clear();
    const L = N_SEG;
    const start = Math.floor(this.pos / SEG);
    const frac = (this.pos % SEG) / SEG;
    if (this.sky) this.sky.tilePositionX += this.curves[start % L] * this.speed * 0.00004 * dt;
    // ground beyond the pavements
    g.fillStyle(0x3b2f4a, 1).fillRect(0, HORIZON, W, H - HORIZON);
    this.bump += dt * (this.speed / 8000);
    const offRoad = Math.abs(this.px) > 1.12;
    const shake = Math.sin(this.bump / 30) * (this.speed > 100 ? (offRoad ? 3.5 : 1.2) : 0);
    const camY = CAM_H + this.groundAt(this.pos);
    let x = 0;
    let dx = -this.curves[start % L] * frac;
    const proj = this.proj;
    proj.length = 0;
    let maxY = H;
    for (let n = 0; n < DRAW; n++) {
      const i = (start + n) % L;
      const z = (n + 1 - frac) * SEG;
      const scale = this.fov / (z / 1000);
      const sy = HORIZON + scale * (camY - this.hills[(i + 1) % L]) * 0.12 + shake;
      const sx = W / 2 + scale * (x - this.px * ROAD_W) * 0.24;
      const w = scale * ROAD_W * 0.24;
      proj.push({ y: sy, sx, w, scale, clip: maxY, world: z });
      if (sy < maxY) maxY = sy;
      x += dx;
      dx += this.curves[i];
    }
    for (let n = DRAW - 1; n > 0; n--) {
      const a = proj[n];
      const b = proj[n - 1];
      // hidden behind a crest, or facing away
      if (a.y >= a.clip || b.y <= a.y) continue;
      const i = (start + n) % L;
      const alt = Math.floor(i / 3) % 2 === 0;
      const fog = Math.min(1, Math.pow(n / DRAW, 1.6) * 1.1);
      const c = (col: number) => this.fog(col, fog);
      // buildings' ground, pavement, kerb, road, double yellows, lane dashes
      g.fillStyle(c(alt ? 0x4a3b5c : 0x433553), 1);
      this.quad(a.sx, a.y, a.w * 3.4, b.sx, b.y, b.w * 3.4);
      g.fillStyle(c(alt ? 0xa8a29e : 0x9a948f), 1);
      this.quad(a.sx, a.y, a.w * 2.05, b.sx, b.y, b.w * 2.05);
      g.fillStyle(c(alt ? 0xe5e7eb : 0x6b7280), 1);
      this.quad(a.sx, a.y, a.w * 1.13, b.sx, b.y, b.w * 1.13);
      g.fillStyle(c(alt ? 0x3f3f46 : 0x46464e), 1);
      this.quad(a.sx, a.y, a.w, b.sx, b.y, b.w);
      g.fillStyle(c(0xfacc15), 1);
      for (const s of [-1, 1]) {
        this.quad(a.sx + s * a.w * 0.93, a.y, a.w * 0.012, b.sx + s * b.w * 0.93, b.y, b.w * 0.012);
        this.quad(a.sx + s * a.w * 0.965, a.y, a.w * 0.012, b.sx + s * b.w * 0.965, b.y, b.w * 0.012);
      }
      if (alt) {
        g.fillStyle(c(0xfafafa), 1);
        this.quad(a.sx, a.y, a.w * 0.025, b.sx, b.y, b.w * 0.025);
      }
    }
    // people, cars and things, far to near
    for (const t of this.things) this.place(t, dt);
    for (const t of this.traffic) this.place(t, dt);
  }

  /** Mix a colour toward the dusk haze. */
  private fog(col: number, f: number) {
    if (f <= 0.01) return col;
    const fc = 0xc77b8a;
    const r = ((col >> 16) & 255) * (1 - f) + ((fc >> 16) & 255) * f;
    const gg = ((col >> 8) & 255) * (1 - f) + ((fc >> 8) & 255) * f;
    const b = (col & 255) * (1 - f) + (fc & 255) * f;
    return (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b);
  }

  /** Project one thing onto the road, hide what's behind a hill, and see if we've run it over. */
  private place(t: Thing, dt: number) {
    const img = t.img;
    if (t.hit) return;
    const d = this.ahead(t.z);
    const proj = this.proj;
    // where between two projected segment edges it sits
    const kf = d / SEG - 1 + (this.pos % SEG) / SEG;
    if (kf < -1.2 || kf >= DRAW - 2) {
      img.setVisible(false);
      if (t.kind === "ped" || t.kind === "warden") this.collide(t, d);
      return;
    }
    const k0 = Math.max(0, Math.floor(kf));
    const f = Phaser.Math.Clamp(kf - k0, 0, 1);
    const a = proj[k0];
    const b = proj[k0 + 1];
    const y = Phaser.Math.Linear(a.y, b.y, f);
    const sx = Phaser.Math.Linear(a.sx, b.sx, f);
    const w = d > 40 ? Phaser.Math.Linear(a.w, b.w, f) * (kf < 0 ? 1 - kf * 0.5 : 1) : a.w * 1.6;
    const clip = kf < 0 ? H : a.clip;
    if (t.kind === "ped" || t.kind === "warden") this.pedBrain(t, d, dt);
    const hgt = Math.min(w * t.h, t.kind === "ped" || t.kind === "warden" ? 380 : 900);
    const frameH = img.frame.height;
    const frameW = img.frame.width;
    const sc = hgt / frameH;
    if (y - hgt >= clip || hgt < 2) {
      img.setVisible(false);
    } else {
      img.setVisible(true).setPosition(sx + w * t.off, y).setDisplaySize(frameW * sc, hgt).setDepth(400 - kf);
      img.setAngle(t.angle);
      // cropped where the crest of a hill hides its feet
      if (y > clip) img.setCrop(0, 0, frameW, Math.max(1, (clip - (y - hgt)) / sc));
      else img.setCrop();
    }
    this.collide(t, d);
  }

  /** Strolling, jaywalking, and the last-second dive. */
  private pedBrain(t: Thing, d: number, dt: number) {
    const now = this.time.now;
    const frozen = now < t.frozenUntil;
    if (frozen) {
      // frozen in terror: a little tremble
      t.angle = Math.sin(now / 25) * 4;
      return;
    }
    if (t.dodge === 0) {
      t.off = Phaser.Math.Clamp(t.off + t.drift * dt, -1.35, 1.35);
      t.angle = 0;
      const reach = (t.kind === "warden" ? 1700 : 1200) + this.speed * 0.05;
      if (this.running && d > 0 && d < reach && Math.abs(t.off - this.px) < 0.55) {
        if (Math.random() < t.dodgy) {
          let side = t.off >= this.px ? 1 : -1;
          if (Math.abs(t.off + side * 0.95) > 1.45) side = -side;
          t.dodge = 1;
          t.dodgeTo = t.off + side * (0.7 + Math.random() * 0.25);
          this.pop(t.img.x, t.img.y - t.img.displayHeight - 10, "!", "#ffffff", 22);
          if (Math.random() < 0.3) this.bark("SANMIK", DODGE_MIK[Math.floor(Math.random() * DODGE_MIK.length)]);
        } else t.dodgy = 0; // brave (or on their phone): they'll take it
      }
    } else if (t.dodge === 1) {
      const dir = Math.sign(t.dodgeTo - t.off);
      t.off += dir * 3.4 * (dt / 1000);
      t.angle = dir * 75;
      if (Math.sign(t.dodgeTo - t.off) !== dir) {
        t.off = t.dodgeTo;
        t.dodge = 2;
        synth.play("dodge");
      }
    } else t.angle = Math.sign(t.dodgeTo) * 88;
  }

  private collide(t: Thing, d: number) {
    if (!this.running || t.hit || d < -80 || d > 340) return;
    const reach = t.kind === "lamp" ? 0.24 : t.kind === "deco" ? 0 : 0.42;
    if (reach === 0 || Math.abs(t.off - this.px) >= reach) return;
    if (t.kind === "lamp") {
      // one bonk per lamp post (they don't move, so don't make you hit them twice)
      if (this.time.now > this.invulnUntil && this.time.now > t.frozenUntil) {
        t.frozenUntil = this.time.now + 5000;
        this.crash(t);
      }
      return;
    }
    if (this.speed > 1500) this.splat(t);
  }

  private quad(x1: number, y1: number, w1: number, x2: number, y2: number, w2: number) {
    this.g.fillPoints([{ x: x1 - w1, y: y1 }, { x: x1 + w1, y: y1 }, { x: x2 + w2, y: y2 }, { x: x2 - w2, y: y2 }], true);
  }

  // ------------------------------------------------------------------ impacts

  private crash(t: Thing) {
    this.invulnUntil = this.time.now + 1200;
    this.freezeUntil = this.time.now + 120;
    const lose = t.kind === "van" ? 4 : t.kind === "lamp" ? 2 : 3;
    this.left = Math.max(0.5, this.left - lose);
    this.speed *= t.kind === "van" ? 0.1 : 0.3;
    this.combo = 0;
    this.comboT = 0;
    // bounced off it, back toward the middle of the road
    this.px = Phaser.Math.Clamp(this.px + (this.px >= t.off ? 1 : -1) * 0.3, -1.85, 1.85);
    this.shake(420, 0.03);
    synth.play("car_hit");
    synth.play("car_screech");
    synth.play(t.kind === "van" ? "explode" : "smash");
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.3).setDepth(545);
    this.tweens.add({ targets: flash, alpha: 0, duration: 160, onComplete: () => flash.destroy() });
    const img = t.img;
    vfx(this, "vfx_sparks", img.x, img.y - img.displayHeight * 0.5, { scale: 3, depth: 515 });
    vfx(this, "vfx_smoke", img.x, img.y - img.displayHeight * 0.3, { scale: 3, depth: 514 });
    this.pop(W / 2, 260, t.kind === "lamp" ? "LAMP POST!" : "CRASH!", "#ef4444", 40);
    this.pop(W / 2, 310, `-${lose}s`, "#ef4444", 28);
    // windscreen crack
    const cx = W * 0.3 + Math.random() * W * 0.4;
    const cy = 150 + Math.random() * 120;
    const crack = this.add.graphics().setDepth(540);
    crack.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const r = 40 + Math.random() * 70;
      crack.lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    this.tweens.add({ targets: crack, alpha: 0, delay: 1300, duration: 700, onComplete: () => crack.destroy() });
    this.bark("SANMIK", CRASH_MIK[Math.floor(Math.random() * CRASH_MIK.length)]);
    if (t.kind === "car" || t.kind === "van") {
      // knocked aside, spinning, and out of the game
      t.hit = true;
      const fromX = img.x;
      this.tweens.add({ targets: img, x: fromX + (t.off > this.px ? 1 : -1) * 500, y: img.y - 80, angle: (Math.random() < 0.5 ? -1 : 1) * 200, alpha: 0, duration: 650, ease: "Quad.out", onComplete: () => img.setVisible(false) });
    }
  }

  private splat(t: Thing) {
    t.hit = true;
    const img = t.img;
    img.setCrop();
    const fromX = img.x;
    const fromY = img.y;
    if (t.kind === "thing") {
      this.shake(140, 0.01);
      synth.play("smash");
      this.speed *= 0.78;
      this.tweens.add({ targets: img, x: fromX + (Math.random() - 0.5) * 400, y: fromY - 300, angle: 540, alpha: 0, scale: img.scale * 1.5, duration: 600, onComplete: () => img.setVisible(false) });
      this.pop(fromX, fromY - 100, "SMASH", "#fde047");
      vfx(this, "vfx_dust", fromX, fromY - 30, { scale: 3, depth: 515 });
      if (Math.random() < 0.5) this.bark("SANCHZ", "YEGHHH! BIN!");
      return;
    }
    const pts = t.kind === "warden" ? 2 : 1;
    this.hits += pts;
    // combo: chain hits quickly for more style and more time
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = Math.min(this.combo, 8);
    // a dive-dodger you got anyway is worth a bonus
    const dodger = t.dodge === 2;
    this.score += pts * 100 * mult * (dodger ? 2 : 1) + Math.round(this.speed / 100);
    let bonus = 0;
    if (this.combo >= 4) bonus += 1;
    if (dodger) bonus += 1;
    if (bonus) {
      this.left += bonus;
      this.pop(W / 2 + 160, 372, `+${bonus}s`, "#4ade80", 26);
    }
    this.boost = Math.min(100, this.boost + 14);
    // hit-stop, then the thud: a heavy body hit, then a second softer one as they bounce off the roof
    this.freezeUntil = this.time.now + (this.combo >= 3 ? 80 : 55);
    this.shake(160, 0.012 + Math.min(this.combo, 6) * 0.002);
    synth.play("punch_big");
    synth.play("hit");
    synth.play(Math.random() < 0.5 ? "bonecrack" : "car_hit");
    this.time.delayedCall(260, () => synth.play("punch"));
    // how they go: red mist, under the wheels, over the roof, or launched (wardens never go quietly)
    if (img.displayHeight > 240) img.setDisplaySize((img.displayWidth * 240) / img.displayHeight, 240);
    const r = Math.random();
    const fate = t.kind === "warden" ? (r < 0.6 ? "mist" : "launch") : r < 0.3 ? "mist" : r < 0.55 ? "under" : r < 0.8 ? "over" : "launch";
    if (fate === "mist") this.fateMist(img, fromX, fromY);
    else if (fate === "under") this.fateUnder(img, fromX, fromY);
    else if (fate === "over") this.fateOver(img, fromX, fromY);
    else {
      this.bloodHit(fromX, fromY - img.displayHeight * 0.4);
      // over the bonnet, over the roof, gone (spinning like a ragdoll)
      const s = img.scale;
      img.setDepth(505);
      this.tweens.add({ targets: img, x: W / 2 + (Math.random() - 0.5) * 360, duration: 700, ease: "Sine.out" });
      this.tweens.add({ targets: img, y: { from: fromY, to: 140 }, duration: 260, ease: "Quad.out", yoyo: false, onComplete: () => this.tweens.add({ targets: img, y: -200, duration: 420, ease: "Quad.in" }) });
      this.tweens.add({ targets: img, angle: (Math.random() < 0.5 ? -1 : 1) * (720 + Math.random() * 540), scale: s * 1.5, duration: 700, onComplete: () => img.setVisible(false) });
    }
    const word = t.kind === "warden" ? "TRAFFIC WARDEN x2!" : dodger ? "NOWHERE TO HIDE!" : fate === "mist" ? "RED MIST!" : fate === "under" ? "BUMP BUMP!" : fate === "over" ? "OVER THE TOP!" : ["BUMP!", "BEEP BEEP!", "GET OUT THE WAY!", "SPLAT"][Math.floor(Math.random() * 4)];
    this.pop(fromX, fromY - 120, word, t.kind === "warden" ? "#22d3ee" : "#f472b6", 28);
    if (this.combo >= 2) {
      const call = COMBO_CALL[Math.min(this.combo, COMBO_CALL.length - 1)];
      this.pop(W / 2, 330, `${call}  x${mult}`, "#fde047", 26 + Math.min(this.combo, 8) * 2);
      if (this.combo >= 3) synth.play(this.combo >= 5 ? "crit" : "coin");
    }
    if (Math.random() < 0.5) this.bark(Math.random() < 0.7 ? "SANMIK" : "SANCHZ", t.kind === "warden" ? "DOUBLE POINTS!! YEEE!" : undefined);
  }

  private gore() {
    return G.meta.settings.gore !== false;
  }

  /** A blob that lands on the glass and slowly slides down it. */
  private glassSplat(x: number, y: number, w: number, h: number, col = 0xa50f0f, stay = 900) {
    const sp = this.add.ellipse(x, y, w, h, col, 0.88).setDepth(540).setScale(0.3).setAngle(Math.random() * 180);
    this.tweens.add({ targets: sp, scale: 1, duration: 90, ease: "Back.out" });
    this.tweens.add({ targets: sp, y: y + 50 + Math.random() * 60, scaleY: 1.6, alpha: 0, delay: stay, duration: 2600, ease: "Sine.in", onComplete: () => sp.destroy() });
  }

  /** Bits flying out from a point, tumbling (guts with gore on, confetti and stars with it off). */
  private chunks(x: number, y: number, n: number, spread: number) {
    const gore = this.gore();
    const cols = gore ? [0xb91c1c, 0x7f1d1d, 0xf9a8a8, 0x991b1b, 0xe8b4a0] : [0xfde047, 0xf472b6, 0x7dd3fc, 0xffffff];
    for (let i = 0; i < n; i++) {
      const w = 6 + Math.random() * (gore ? 16 : 8);
      const c = this.add.rectangle(x, y, w, w * (0.5 + Math.random() * 0.8), cols[i % cols.length]).setDepth(517).setAngle(Math.random() * 360);
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.8);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 60, angle: c.angle + 400 * (Math.random() < 0.5 ? -1 : 1), alpha: 0, duration: 600 + Math.random() * 500, ease: "Quad.out", onComplete: () => c.destroy() });
    }
  }

  /** RED MIST: they just burst. A pink cloud, guts everywhere, the windscreen painted. */
  private fateMist(img: Phaser.GameObjects.Image, x0: number, y0: number) {
    const x = Phaser.Math.Clamp(x0, 160, W - 160);
    const y = Phaser.Math.Clamp(y0 - img.displayHeight * 0.45, 140, 360);
    img.setVisible(false);
    this.freezeUntil = this.time.now + 110;
    this.shake(260, 0.02);
    synth.play("splat");
    synth.play("squelch");
    if (!this.gore()) {
      synth.play("pop");
      vfx(this, "vfx_confetti", x, y, { scale: 2.6, depth: 516 });
      vfx(this, "vfx_stars", x, y, { scale: 2.6, depth: 516 });
      this.chunks(x, y, 18, 260);
      return;
    }
    vfx(this, "vfx_gore", x, y, { scale: 3, depth: 516 });
    vfx(this, "vfx_bloodspray", x, y, { scale: 3.2, depth: 515 });
    vfx(this, "vfx_bloodspray", x + 60, y - 20, { scale: 2.4, depth: 515, flipX: true });
    this.chunks(x, y, 26, 320);
    // the mist: the whole windscreen goes red, then clears
    // (behind the dashboard, so it's the glass that goes red, not the dials)
    const mist = this.add.rectangle(W / 2, 225, W, 400, 0x8b0000, 0.5).setDepth(499);
    this.tweens.add({ targets: mist, alpha: 0, delay: 140, duration: 900, onComplete: () => mist.destroy() });
    for (let i = 0; i < 6 + Math.floor(Math.random() * 4); i++) this.glassSplat(W * 0.15 + Math.random() * W * 0.7, 100 + Math.random() * 240, 40 + Math.random() * 70, 30 + Math.random() * 50, Math.random() < 0.8 ? 0xa50f0f : 0x5c0606, 1400);
    this.time.delayedCall(300, () => this.bark("SANCHZ", "YEGHHH! IT'S IN MY MOUTH!"));
  }

  /** UNDER THE WHEELS: down they go, and the whole car goes bump, bump. */
  private fateUnder(img: Phaser.GameObjects.Image, x0: number, y0: number) {
    img.setDepth(499);
    this.tweens.add({ targets: img, y: y0 + 260, scaleY: img.scaleY * 0.3, angle: (Math.random() - 0.5) * 60, duration: 180, ease: "Quad.in", onComplete: () => img.setVisible(false) });
    const cam = this.cameras.main;
    const bump = (delay: number, k: number) =>
      this.time.delayedCall(delay, () => {
        synth.play(k > 1 ? "bonecrack" : "thud");
        this.tweens.add({ targets: cam, scrollY: -14 * k, duration: 70, yoyo: true, ease: "Quad.out" });
        this.pop(W / 2 + (Math.random() - 0.5) * 160, 330, "BUMP", "#f472b6", 24);
        // something comes up from under the bonnet
        const bx = Phaser.Math.Clamp(x0, 200, W - 200);
        if (this.gore()) {
          vfx(this, "vfx_bloodspray", bx, 410, { scale: 2.4, depth: 515, angle: -90 });
          this.chunks(bx, 420, 8, 160);
          if (k > 1) this.glassSplat(bx + (Math.random() - 0.5) * 120, 360, 60, 26, 0x7f1d1d, 600);
        } else vfx(this, "vfx_dust", bx, 420, { scale: 3, depth: 515 });
      });
    bump(120, 1);
    bump(300, 1.6);
    this.speed *= 0.93;
  }

  /** OVER THE TOP: up the bonnet, across the glass, thump on the roof, and away behind you (look in the mirror). */
  private fateOver(img: Phaser.GameObjects.Image, x0: number, y0: number) {
    img.setDepth(538);
    const s = img.scale;
    const spin = (Math.random() < 0.5 ? -1 : 1) * 200;
    // up the bonnet and onto the glass, getting closer
    this.tweens.add({ targets: img, x: W / 2 + (x0 - W / 2) * 0.4, y: 330, scale: s * 2.2, angle: spin * 0.4, duration: 160, ease: "Quad.out", onComplete: () => {
      synth.play("punch_big");
      this.shake(120, 0.01);
      if (this.gore()) {
        this.glassSplat(img.x, img.y - 40, 90, 60, 0xa50f0f, 1600);
        vfx(this, "vfx_blood", img.x, img.y - 40, { scale: 2.4, depth: 539 });
      }
      // roll up and over the top of the windscreen, smearing as it goes
      const smear = this.time.addEvent({ delay: 40, repeat: 6, callback: () => this.gore() && this.glassSplat(img.x + (Math.random() - 0.5) * 30, img.y - 30, 26, 46, 0x8b0a0a, 700) });
      this.tweens.add({ targets: img, y: -160, angle: spin * 2, scale: s * 2.8, duration: 380, ease: "Quad.in", onComplete: () => {
        smear.remove();
        img.setVisible(false);
        // THUMP on the roof
        synth.play("thud");
        synth.play("bonecrack");
        this.shake(180, 0.014);
        this.tweens.add({ targets: this.cameras.main, scrollY: 10, duration: 60, yoyo: true });
        this.pop(W / 2, 140, "THUMP", "#fde047", 26);
        this.tumbleInMirror(img.texture.key);
      } });
    } });
  }

  /** A little body bouncing down the road behind you, in the rear-view mirror. */
  private tumbleInMirror(key: string) {
    if (!this.mirrorBox) return;
    const { x, y, w, h } = this.mirrorBox;
    const b = this.add.image(x + (Math.random() - 0.5) * w * 0.3, y - h * 0.6, key).setDisplaySize(26, 26).setDepth(511);
    const m = this.make.graphics({}).fillRect(x - w / 2, y - h / 2, w, h);
    b.setMask(m.createGeometryMask());
    this.tweens.add({ targets: b, y: y + h * 0.2, angle: 540, duration: 420, ease: "Bounce.out" });
    this.tweens.add({ targets: b, scale: b.scale * 0.4, alpha: 0, delay: 500, duration: 900, onComplete: () => { b.destroy(); m.destroy(); } });
  }

  /** Blood at the point of impact and across the windscreen (comedy dust and stars with gore off). */
  private bloodHit(x0: number, y0: number) {
    const gore = G.meta.settings.gore !== false;
    // keep it on the windscreen, where you can see it
    const x = Phaser.Math.Clamp(x0, 140, W - 140);
    const y = Phaser.Math.Clamp(y0, 130, 380);
    vfx(this, "vfx_hit", x, y, { scale: 3, depth: 515 });
    if (!gore) {
      const stars = vfx(this, "vfx_stars", x, y - 30, { scale: 2.5, depth: 516 });
      if (stars) this.tweens.add({ targets: stars, alpha: 0, delay: 600, duration: 300, onComplete: () => stars.destroy() });
      else
        for (let i = 0; i < 6; i++) {
          const t = this.add.text(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 40, Math.random() < 0.5 ? "⭐" : "💫", { fontSize: "18px" }).setOrigin(0.5).setDepth(530);
          this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 700, onComplete: () => t.destroy() });
        }
      vfx(this, "vfx_dust", x, y + 20, { scale: 3, depth: 514 });
      return;
    }
    if (!vfx(this, "vfx_bloodspray", x, y, { scale: 2.2, depth: 515 })) vfx(this, "vfx_blood", x, y, { scale: 2, depth: 515 });
    for (let i = 0; i < 14; i++) {
      const d = this.add.circle(x, y, 3 + Math.random() * 5, Math.random() < 0.6 ? 0xb91c1c : 0x7f1d1d).setDepth(516);
      this.tweens.add({ targets: d, x: x + (Math.random() - 0.5) * 260, y: y + (Math.random() - 0.4) * 180, alpha: 0, duration: 500 + Math.random() * 400, ease: "Quad.out", onComplete: () => d.destroy() });
    }
    // splats on the windscreen that slide down and fade
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const sx = W * 0.2 + Math.random() * W * 0.6;
      const sy = 110 + Math.random() * 180;
      const splat = this.add.ellipse(sx, sy, 30 + Math.random() * 40, 22 + Math.random() * 30, 0xa50f0f, 0.85).setDepth(540).setScale(0.3);
      this.tweens.add({ targets: splat, scale: 1, duration: 90, ease: "Back.out" });
      this.tweens.add({ targets: splat, y: sy + 60, alpha: 0, delay: 900, duration: 2200, ease: "Sine.in", onComplete: () => splat.destroy() });
    }
  }

  private pop(x0: number, y0: number, t: string, color: string, size = 26) {
    const x = Phaser.Math.Clamp(x0, 150, W - 150);
    const y = Phaser.Math.Clamp(y0, 110, 420);
    const tx = this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(535).setScale(0.4);
    this.tweens.add({ targets: tx, scale: 1, duration: 140, ease: "Back.out" });
    this.tweens.add({ targets: tx, y: y - 50, alpha: 0, delay: 350, duration: 650, onComplete: () => tx.destroy() });
  }

  // ------------------------------------------------------------------ speed lines and HUD

  /** Streaks rushing out from the vanishing point when you're really going (and a lot more when boosting). */
  private drawFx(dt: number) {
    const fx = this.fx;
    fx.clear();
    const k = Phaser.Math.Clamp((this.speed - 10500) / 7000, 0, 1);
    if (k <= 0) return;
    const p = this.proj[Math.min(this.proj.length - 1, 60)];
    const vx = p ? p.sx : W / 2;
    const vy = HORIZON;
    for (const s of this.streaks) {
      s.r += dt * (0.6 + k * 1.6) * (s.r / 120);
      if (s.r > 760) {
        s.r = 50 + Math.random() * 60;
        s.a = Math.random() * Math.PI * 2;
      }
      const x1 = vx + Math.cos(s.a) * s.r;
      const y1 = vy + Math.sin(s.a) * s.r * 0.75;
      const x2 = vx + Math.cos(s.a) * (s.r + s.l * (1 + k * 2));
      const y2 = vy + Math.sin(s.a) * (s.r + s.l * (1 + k * 2)) * 0.75;
      fx.lineStyle(this.boosting ? 3 : 2, this.boosting ? 0xffd7a0 : 0xffffff, Math.min(0.75, (s.r / 500) * k * (this.boosting ? 1 : 0.55)));
      fx.lineBetween(x1, y1, x2, y2);
    }
  }

  private drawHud() {
    const g = this.hudG;
    g.clear();
    this.hud.setText(`PEDESTRIANS ${this.hits}/${GOAL}`);
    const secs = Math.ceil(this.left);
    this.timerTx.setText(`${secs}s`).setColor(this.left < 15 && Math.floor(this.left * 4) % 2 === 0 ? "#ef4444" : "#ffffff");
    this.comboTx.setText(this.combo >= 2 ? `COMBO x${Math.min(this.combo, 8)}` : `STYLE ${this.score.toLocaleString()}`);
    const mph = Math.round(this.speed / 140);
    this.mphTx.setText(`${mph} MPH`);
    // progress bar under the counter
    const pw = 210;
    g.fillStyle(0x000000, 0.6).fillRect(22, 66, pw + 4, 10);
    g.fillStyle(0xf472b6, 1).fillRect(24, 68, (pw * Math.min(this.hits, GOAL)) / GOAL, 6);
    // combo timer
    if (this.combo >= 2) {
      g.fillStyle(0x000000, 0.6).fillRect(W - 180, 72, 158, 8);
      g.fillStyle(0xfde047, 1).fillRect(W - 178, 74, (154 * Math.max(0, this.comboT)) / COMBO_WINDOW, 4);
    }
    // speedometer: a dial on the dash
    const cx = W - 92;
    const cy = 440;
    const r = 46;
    g.fillStyle(0x0b1020, 0.92).fillCircle(cx, cy, r + 6);
    g.lineStyle(3, 0x22d3ee, 1).strokeCircle(cx, cy, r + 4);
    const a0 = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (span * i) / 10;
      g.lineStyle(2, i >= 7 ? 0xef4444 : 0x94a3b8, 1).lineBetween(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8), cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    const na = a0 + span * Math.min(1, mph / 140);
    g.lineStyle(4, 0xf43f5e, 1).lineBetween(cx, cy, cx + Math.cos(na) * (r - 6), cy + Math.sin(na) * (r - 6));
    g.fillStyle(0xf472b6, 1).fillCircle(cx, cy, 5);
    // boost tank
    const bx = 22;
    const by = 470;
    g.fillStyle(0x0b1020, 0.92).fillRect(bx, by, 140, 22);
    g.lineStyle(2, this.boosting ? 0xfb923c : 0x64748b, 1).strokeRect(bx, by, 140, 22);
    g.fillStyle(this.boosting ? 0xfde047 : 0xfb923c, 1).fillRect(bx + 3, by + 3, (134 * this.boost) / 100, 16);
    // horn ready light
    const ready = this.time.now > this.hornReady;
    g.fillStyle(ready ? 0x4ade80 : 0x475569, 1).fillCircle(bx + 156, by + 11, 7);
  }
}
