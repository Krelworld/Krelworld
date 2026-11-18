import { diffFor, scaleInt } from "../systems/difficulty";
import Phaser from "phaser";
import { playerKey } from "../gfx/sanmikForm";
import { vfx } from "../gfx/Vfx";
import { sloppyCutIn } from "../gfx/SideCine";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { DialogueBox } from "../ui/DialogueBox";
import { FONT, PIXEL_BOLD, title } from "../ui/theme";
import { runChain, switchTo, fadeThen } from "../Flow";
import { dir, gabor, say } from "../../content/dsl";
import { damageMult } from "../systems/stats";
import { TOUCH } from "../ui/TouchControls";
import { Drawbridge } from "./drive/Drawbridge";

type FoeKind = "cop" | "unmarked" | "swat" | "heli" | "spikes" | "tank" | "ramp";
type Foe = {
  kind: FoeKind;
  spr: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  nextShot: number;
  tx: number;
  ty: number;
  dead: boolean;
  hit?: boolean;
  /** knockback: pixels still to be shoved (decays) */
  push: number;
  /** the sprite's own tint (unmarked cars are dark): put back after the white hit flash */
  tint?: number;
  light?: Phaser.GameObjects.Triangle;
  siren?: Phaser.GameObjects.Arc;
  bar?: Phaser.GameObjects.Rectangle;
};
type Bullet = { spr: Phaser.GameObjects.Shape; vx: number; vy: number; mine: boolean; dmg: number; life: number; rocket?: boolean };
type Movable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & { alpha: number; setAlpha(v: number): unknown };
/** Anything flung about by an explosion: car bodies, wheels, panels, rotor blades, brass. Px per ms. */
type Junk = {
  o: Movable;
  vx: number;
  vy: number;
  /** spin, degrees per ms */
  va: number;
  g: number;
  bounce: number;
  ground: number;
  /** ms left; fades out over the last 300 */
  life: number;
  bounces: number;
  /** a lingering fire riding along with it */
  fire?: Phaser.GameObjects.Sprite | null;
  smokeEvery?: number;
  nextSmoke?: number;
  onLand?: (j: Junk) => void;
  /** once it's on the tarmac it goes past with the road */
  grounded?: boolean;
};
type Wreck = { o: Movable; fire?: Phaser.GameObjects.Sprite | null; dy: number };

const ROAD_Y = 450;
const TRUCK_X = 400;
const LENGTH = 85; // seconds of chase before the drawbridge
const ROAD_SPEED = 0.9; // px per ms

/** The chase builds in waves; the last one is a breather before the drawbridge. */
type Wave = { at: number; name: string; cap: number; gap: number; per: number; mix: Partial<Record<"cop" | "unmarked" | "swat" | "heli" | "tank", number>>; helis: number; spikes: number };
const WAVES: Wave[] = [
  { at: 0, name: "THE OLD BILL", cap: 3, gap: 1900, per: 1, mix: { cop: 1 }, helis: 0, spikes: 0.15 },
  { at: 10, name: "ARMED RESPONSE", cap: 4, gap: 1700, per: 1, mix: { cop: 0.45, unmarked: 0.2, swat: 0.35 }, helis: 0, spikes: 0.25 },
  { at: 20, name: "INCOMING CHOPPER", cap: 5, gap: 1550, per: 1, mix: { cop: 0.4, unmarked: 0.15, swat: 0.25, heli: 0.2 }, helis: 1, spikes: 0.25 },
  { at: 32, name: "FULL PURSUIT", cap: 6, gap: 1350, per: 2, mix: { cop: 0.4, unmarked: 0.2, swat: 0.25, heli: 0.15 }, helis: 1, spikes: 0.3 },
  { at: 44, name: "THEY BROUGHT A TANK", cap: 6, gap: 1400, per: 2, mix: { cop: 0.4, unmarked: 0.15, swat: 0.3, heli: 0.15, tank: 0.6 }, helis: 1, spikes: 0.25 },
  { at: 56, name: "TWO CHOPPERS", cap: 7, gap: 1250, per: 2, mix: { cop: 0.35, unmarked: 0.2, swat: 0.25, heli: 0.2, tank: 0.5 }, helis: 2, spikes: 0.3 },
  { at: 66, name: "EVERYTHING THEY'VE GOT", cap: 8, gap: 1050, per: 2, mix: { cop: 0.35, unmarked: 0.25, swat: 0.25, heli: 0.15, tank: 0.5 }, helis: 2, spikes: 0.35 },
  { at: 77, name: "…IT'S GONE QUIET", cap: 0, gap: 99999, per: 0, mix: {}, helis: 0, spikes: 0 },
];

/** Kill-chain callouts: the streak count they fire at. */
const CALLOUTS: [number, string, string][] = [
  [2, "DOUBLE KILL!", "#fde047"],
  [3, "TRIPLE KILL!", "#fde047"],
  [4, "QUAD DAMAGE (TO THE TAXPAYER)", "#fb923c"],
  [5, "ABSOLUTE CARNAGE!", "#f97316"],
  [6, "BRAP BRAP BRAP!", "#f43f5e"],
  [8, "SANMIK APPROVES", "#b0c4ff"],
  [10, "TURN ON YOUR FUCKING TV!", "#ff2bd6"],
  [12, "CHANNEL U EXCLUSIVE!", "#22d3ee"],
  [15, "FIFTEEN COP CARS? NOT ANY MORE", "#a3e635"],
  [20, "THE TAXPAYER WEEPS", "#f43f5e"],
  [25, "UNSTOPPABLE. UNINSURABLE.", "#ffd23f"],
];
const POINTS: Record<FoeKind, number> = { cop: 100, unmarked: 150, swat: 250, heli: 500, tank: 1500, spikes: 0, ramp: 0 };

/**
 * NIGHT OF FREEDOM. SanMik drives (and does the jumps), SanChz rides in the back, you're on the guns: an endless
 * machine gun (hold the mouse / your finger) and rockets (right-click, Space, F or the ROCKET button). Hordes of
 * cop cars, SWAT vans, helicopters and tanks, then a drawbridge going up.
 *
 * Game feel (after Vlambeer's "Art of Screenshake" and "Juice it or lose it"): hit flash + knockback on every round,
 * hit-stop on kills, slow-mo and a zoom punch on the big ones, trauma-based screen shake scaled to the event, camera
 * lean toward the aim and kick on each shot, cars that cartwheel off the road and stay there burning, chained
 * explosions, a kill-chain meter with callouts, and a score.
 */
export class DriveScene extends Phaser.Scene {
  private box!: DialogueBox;
  private chain: string[] = [];
  private resume: { dungeon: string; room: number } | null = null;
  private startData: any;
  private road!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private farRate = 0.08;
  private nearRate = 0.25;
  private lines!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private truck!: Phaser.GameObjects.Container;
  private me!: Phaser.GameObjects.Sprite;
  private gun!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpBack!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private streakBar!: Phaser.GameObjects.Rectangle;
  private callout!: Phaser.GameObjects.Text;
  private copGlowL!: Phaser.GameObjects.Rectangle;
  private copGlowR!: Phaser.GameObjects.Rectangle;
  private foes: Foe[] = [];
  private bullets: Bullet[] = [];
  private junk: Junk[] = [];
  private wrecks: Wreck[] = [];
  private scorches: Phaser.GameObjects.Ellipse[] = [];
  private lamps: Phaser.GameObjects.Container[] = [];
  private hp = 100;
  private t = 0;
  private running = false;
  private ended = false;
  private jumpV = 0;
  private jumpY = 0;
  private nextShot = 0;
  private nextRocket = 0;
  private nextSpawn = 0;
  private nextBark = 0;
  private nextChz = 0;
  private nextRamp = 0;
  private nextHitSfx = 0;
  private sloppy = 0;
  private wave = -1;
  private kills = 0;
  private score = 0;
  private shownScore = 0;
  private streak = 0;
  private streakUntil = 0;
  private maceUntil = 0;
  private mace!: Phaser.GameObjects.Rectangle;
  private hurtEdge!: Phaser.GameObjects.Rectangle;
  private bridgeStarted = false;
  /** the drawbridge set piece, while it's running: it drives the road speed, the clock and the camera */
  private db: Drawbridge | null = null;
  // camera juice (real-time ms from performance.now)
  private trauma = 0;
  private stopUntil = 0;
  private slowUntil = 0;
  private lean = { x: 0, y: 0 };
  private kick = { x: 0, y: 0 };
  private gunKick = 0;
  private shotN = 0;
  private calloutAt = -1e9;
  private calloutTilt = 0;
  private nextChainPop = 0;
  /** Playing as Mikey you're SanMik, on the guns: Gabor the Goat takes the wheel (and SanMik's lines). */
  private get gaborDrives() {
    return G.s.player === "MIKEY";
  }
  private get driver() {
    return this.gaborDrives ? "GABOR THE GOAT" : "SANMIK";
  }
  private scroll = 0;

  constructor() {
    super("Drive");
  }

  create(data: { chain?: string[]; resume?: { dungeon: string; room: number } }) {
    // (the scene clock is stale until its first update: bring it up to date so start times taken now are right)
    this.time.now = this.game.loop.time;
    this.startData = data;
    this.chain = data.chain ?? [];
    this.resume = data.resume ?? null;
    this.foes = [];
    this.bullets = [];
    this.junk = [];
    this.wrecks = [];
    this.scorches = [];
    this.lamps = [];
    this.hp = 100;
    this.t = 0;
    this.running = false;
    this.ended = false;
    this.jumpV = 0;
    this.jumpY = 0;
    this.sloppy = 0;
    this.wave = -1;
    this.kills = 0;
    this.score = 0;
    this.shownScore = 0;
    this.streak = 0;
    this.bridgeStarted = false;
    this.db = null;
    this.scroll = 0;
    this.nextRamp = 0;
    this.trauma = 0;
    this.stopUntil = 0;
    this.slowUntil = 0;
    this.lean = { x: 0, y: 0 };
    this.kick = { x: 0, y: 0 };
    this.gunKick = 0;
    this.cameras.main.fadeIn(300);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // slow-mo touches the game-wide animation clock: always hand it back
      this.anims.globalTimeScale = 1;
    });
    G.s.phase = "dungeon";
    this.makeSkyline();
    // sky, stars, moon, then the city in two layers (drawn a little wider than the screen: the camera leans)
    const sky = this.add.graphics().setDepth(-40);
    sky.fillGradientStyle(0x050816, 0x050816, 0x2a0f45, 0x2a0f45, 1).fillRect(-80, -60, 1120, 660);
    for (let i = 0; i < 70; i++) sky.fillStyle(0xffffff, Math.random() * 0.8).fillRect(-60 + Math.random() * 1080, Math.random() * 260, 2, 2);
    this.add.circle(800, 80, 34, 0xfef3c7).setDepth(-39);
    this.add.circle(788, 72, 34, 0x0b1026, 0.18).setDepth(-39);
    if (this.textures.exists("bg_nf_far")) {
      // the PixelLab skyline: tower blocks and cranes, drawn at 2x
      const h = this.textures.get("bg_nf_far").getSourceImage().height * 2;
      this.far = this.add.tileSprite(-80, ROAD_Y - 60 - h, 1120, h, "bg_nf_far").setOrigin(0).setDepth(-30).setTileScale(2);
      this.far.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.farRate = 0.04;
    } else this.far = this.add.tileSprite(-80, 150, 1120, 300, "nf_far").setOrigin(0).setDepth(-30);
    if (this.textures.exists("bg_nf_near")) {
      // the PixelLab high street (terraces, the kebab shop, two chicken shops), drawn at 1.5x
      const h = this.textures.get("bg_nf_near").getSourceImage().height * 1.5;
      this.near = this.add.tileSprite(-80, ROAD_Y + 26 - h, 1120, h, "bg_nf_near").setOrigin(0).setDepth(-25).setTileScale(1.5);
      this.near.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.nearRate = 0.18;
    } else this.near = this.add.tileSprite(-80, 210, 1120, 260, "nf_near").setOrigin(0).setDepth(-25);
    // the road
    this.add.rectangle(-80, ROAD_Y + 20, 1120, 200, 0x1f2937).setOrigin(0).setDepth(-8);
    this.road = this.add.tileSprite(-80, ROAD_Y + 28, 1120, 90, "tile_industrial").setOrigin(0).setDepth(-5).setTint(0x3a3a48);
    this.lines = this.add.graphics().setDepth(-4);
    this.fx = this.add.graphics().setDepth(55);
    this.add.rectangle(-80, ROAD_Y + 26, 1120, 4, 0xfacc15, 0.7).setOrigin(0).setDepth(-4);
    // street lamps whizzing past
    for (let i = 0; i < 4; i++) {
      const c = this.add.container(i * 300, 0).setDepth(-3);
      c.add(this.add.rectangle(0, ROAD_Y + 24, 8, 300, 0x111827).setOrigin(0.5, 1));
      c.add(this.add.rectangle(14, ROAD_Y - 270, 36, 8, 0x111827));
      c.add(this.add.circle(30, ROAD_Y - 264, 9, 0xfde68a));
      c.add(this.add.triangle(30, ROAD_Y - 264, 0, 0, -60, 290, 60, 290, 0xfde68a, 0.08).setOrigin(0.5, 0));
      this.lamps.push(c);
    }
    // the truck: SanMik at the wheel, SanChz and you in the back, Gabor somewhere
    this.truck = this.add.container(TRUCK_X, ROAD_Y).setDepth(20);
    const truckImg = this.textures.exists("p_truck") ? this.add.image(0, 0, "p_truck").setScale(2.2).setOrigin(0.5, 0.75) : this.add.rectangle(0, 0, 240, 70, 0xe5e7eb);
    // playing as Mikey you're SanMik (on the guns): Gabor the Goat is at the wheel instead
    const mik = this.gaborDrives
      ? this.textures.exists("p_gabor")
        ? this.add.image(70, -60, "p_gabor").setScale(0.62)
        : this.add.circle(70, -60, 14, 0xffffff)
      : this.add.sprite(70, -62, this.textures.exists("spr_SANMIK") ? "spr_SANMIK" : "spr_MIKEY", 0).setScale(1.6);
    if (this.gaborDrives) this.tweens.add({ targets: mik, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 260 });
    const chz = this.add.sprite(-80, -66, this.textures.exists("spr_SANCHZ") ? "spr_SANCHZ" : "spr_POLSON", 0).setScale(1.9);
    this.me = this.add.sprite(-30, -70, playerKey(this), 0).setScale(1.9);
    this.gun = this.add.rectangle(-30, -84, 44, 9, 0x374151).setOrigin(0.1, 0.5).setStrokeStyle(2, 0x111827);
    const goat = this.gaborDrives ? this.add.container(0, 0) : this.textures.exists("p_gabor") ? this.add.image(-118, -46, "p_gabor").setScale(0.55) : this.add.circle(-118, -46, 12, 0xffffff);
    const head = this.add.triangle(130, -8, 0, 0, 280, -50, 280, 50, 0xfef9c3, 0.14).setOrigin(0, 0.5);
    this.truck.add([head, chz, this.me, goat, mik, truckImg, this.gun]);
    this.tweens.add({ targets: truckImg, y: -2, yoyo: true, repeat: -1, duration: 90 });
    // police lights glowing in from behind
    this.copGlowL = this.add.rectangle(0, 0, 260, 540, 0xef4444, 0).setOrigin(0).setDepth(80).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0);
    this.copGlowR = this.add.rectangle(0, 0, 260, 540, 0x3b82f6, 0).setOrigin(0).setDepth(80).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0);
    this.mace = this.add.rectangle(480, 270, 960, 540, 0x9acd32, 0).setDepth(300).setScrollFactor(0);
    this.hurtEdge = this.add.rectangle(480, 270, 940, 520).setStrokeStyle(20, 0xef4444, 0.75).setDepth(301).setScrollFactor(0).setAlpha(0);
    title(this, 480, 22, "NIGHT OF FREEDOM", 22, "#ffd23f").setDepth(400).setScrollFactor(0);
    this.hud = this.add.text(480, 50, "", { fontFamily: FONT, fontSize: "14px", color: "#ffffff", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(400).setScrollFactor(0);
    this.banner = this.add.text(480, 80, "", { fontFamily: PIXEL_BOLD, fontSize: "20px", color: "#ff6bb0", stroke: "#000", strokeThickness: 5 }).setOrigin(0.5).setDepth(400).setScrollFactor(0);
    // score, top right; truck health, top left
    this.scoreText = this.add.text(944, 14, "", { fontFamily: PIXEL_BOLD, fontSize: "24px", color: "#ffffff", stroke: "#000", strokeThickness: 5, align: "right" }).setOrigin(1, 0).setDepth(400).setScrollFactor(0);
    this.add.text(16, 12, "TRUCK", { fontFamily: PIXEL_BOLD, fontSize: "16px", color: "#ffffff", stroke: "#000", strokeThickness: 4 }).setDepth(400).setScrollFactor(0);
    this.hpBack = this.add.rectangle(16, 36, 164, 12, 0x000000, 0.7).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.8).setDepth(400).setScrollFactor(0);
    this.hpBar = this.add.rectangle(18, 38, 160, 8, 0x22c55e).setOrigin(0).setDepth(401).setScrollFactor(0);
    this.streakText = this.add.text(944, 104, "", { fontFamily: PIXEL_BOLD, fontSize: "24px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(1, 0.5).setDepth(400).setScrollFactor(0).setAlpha(0);
    this.streakBar = this.add.rectangle(944, 122, 120, 5, 0xfde047).setOrigin(1, 0.5).setDepth(400).setScrollFactor(0).setAlpha(0);
    this.callout = this.add.text(480, 150, "", { fontFamily: PIXEL_BOLD, fontSize: "32px", color: "#fde047", stroke: "#000", strokeThickness: 7, align: "center" }).setOrigin(0.5).setDepth(410).setScrollFactor(0).setAlpha(0);
    // touch buttons
    const mkBtn = (x: number, label: string, fn: () => void) => {
      const b = this.add.circle(x, 470, 38, 0x000000, 0.45).setStrokeStyle(3, 0xffffff, 0.8).setDepth(450).setInteractive().setScrollFactor(0);
      this.add.text(x, 470, label, { fontFamily: FONT, fontSize: "13px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5).setDepth(451).setScrollFactor(0);
      b.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        fn();
      });
    };
    if (TOUCH.enabled || this.sys.game.device.input.touch) {
      mkBtn(60, "ROCKET", () => this.fireRocket());
      mkBtn(900, "SLOPPY", () => this.sloppySurprise());
    }
    this.input.mouse?.disableContextMenu();
    this.input.keyboard!.addCapture("SPACE");
    this.input.keyboard!.on("keydown-SPACE", () => this.fireRocket());
    this.input.keyboard!.on("keydown-F", () => this.fireRocket());
    this.input.keyboard!.on("keydown-R", () => this.sloppySurprise());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.fireRocket();
    });
    this.box = new DialogueBox(this, 1000, 0.3);
    // the song starts straight away, under the getaway
    synth.music("night_of_freedom", true);
    this.box
      .play([
        dir("The Bank of Catford, 2am. Alarms. Smoke. A pickup truck mounts the pavement outside with its hazards on."),
        say(this.driver, "YEEE! We went and robbed a bank like Jason Statham in Crank!"),
        say("SANCHZ", "A million pounds in stashed-up notes. YEGHHH."),
        say(this.driver, "And a goat."),
        gabor("It was me. I asked them to lock me in the vault overnight. It was the best night of my life. Thank you for ruining it."),
        dir("Sirens. Lots of sirens. Fifteen sets of blue lights swing round the corner. Then a helicopter. Then another one. Then, somehow, a tank."),
        say(this.driver, "I'm driving. You're on the guns. Hold on to your bollocks. Let's have this night of freedom."),
        dir("HOW TO PLAY: SanMik drives and does the jumps. Hold the mouse (or your finger) to fire the machine gun: it never runs out. Right-click, Space or F (or ROCKET) fires a rocket. Kills fill SanMik's SLOPPY SURPRISE: press R / SLOPPY. Survive to the drawbridge.", { variants: { MIKEY: "HOW TO PLAY: Gabor drives and does the jumps (somehow). Hold the mouse (or your finger) to fire the machine gun: it never runs out. Right-click, Space or F (or ROCKET) fires a rocket. Kills fill your SLOPPY SURPRISE: press R / SLOPPY. Survive to the drawbridge." } }),
      ])
      .then(() => {
        this.running = true;
        this.nextSpawn = 0;
        this.nextRamp = this.time.now + 9000;
      });
  }

  /** Two seamless skyline layers, drawn once (the fallback when the PixelLab skylines aren't there). */
  private makeSkyline() {
    const build = (key: string, w: number, h: number, base: number, lit: number, minH: number, maxH: number, signs: boolean) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      let x = 0;
      const rects: [number, number, number][] = [];
      while (x < w) {
        const bw = 50 + Math.floor(Math.random() * 90);
        const bh = minH + Math.floor(Math.random() * (maxH - minH));
        rects.push([x, bw, bh]);
        x += bw + Math.floor(Math.random() * 10);
      }
      // draw each building twice (once shifted a tile left) so the last one wraps without a seam
      for (const [bx, bw, bh] of rects) {
        const lights: [number, number, number][] = [];
        for (let wy = h - bh + 10; wy < h - 12; wy += 16) for (let wx = 8; wx < bw - 10; wx += 14) if (Math.random() < 0.38) lights.push([wx, wy, Math.random() < 0.8 ? lit : 0x67e8f9]);
        const sign = signs && Math.random() < 0.35 ? [0xff2bd6, 0x22d3ee, 0xfde047, 0xef4444][Math.floor(Math.random() * 4)] : 0;
        for (const off of [0, -w]) {
          const X = bx + off;
          g.fillStyle(base, 1).fillRect(X, h - bh, bw, bh);
          for (const [wx, wy, c] of lights) g.fillStyle(c, 0.85).fillRect(X + wx, wy, 7, 9);
          if (sign) g.fillStyle(sign, 0.9).fillRect(X + 6, h - 34, Math.min(bw - 12, 70), 16);
        }
      }
      g.generateTexture(key, w, h);
      g.destroy();
    };
    if (!this.textures.exists("bg_nf_far")) build("nf_far", 1024, 300, 0x1e1b4b, 0xfde68a, 120, 290, false);
    if (!this.textures.exists("bg_nf_near")) build("nf_near", 1024, 260, 0x0b0b1a, 0xfbbf24, 90, 230, true);
  }

  // ---------------------------------------------------------------- juice helpers

  /** Trauma-based shake (Eiserloh): events add trauma, the shake is trauma², it bleeds off fast. */
  private shake(amount: number) {
    if (G.meta.settings.shake === false) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Freeze the action for a beat: kills land harder. */
  private hitStop(ms: number) {
    this.stopUntil = Math.max(this.stopUntil, performance.now() + ms);
  }

  /** Slow-mo plus a zoom punch, for the big kills. */
  private bigMoment(ms = 520) {
    if (this.box.active || this.ended) return;
    this.slowUntil = Math.max(this.slowUntil, performance.now() + ms);
    const cam = this.cameras.main;
    this.tweens.killTweensOf(cam);
    cam.setZoom(1.05);
    this.tweens.add({ targets: cam, zoom: 1, duration: 600, ease: "Cubic.out" });
  }

  /** Too much on screen already: skip the optional garnish. */
  private get lite() {
    return this.children.length > 340;
  }

  private fling(o: Movable, j: Partial<Junk> & { vx: number; vy: number }) {
    const jk: Junk = { o, va: 0, g: 0.0026, bounce: 0.35, ground: ROAD_Y + 22, life: 2600, bounces: 0, ...j };
    this.junk.push(jk);
    return jk;
  }

  private scorch(x: number, w = 90) {
    if (this.scorches.length >= 10) this.scorches.shift()?.destroy();
    const s = this.add.ellipse(x, ROAD_Y + 46 + Math.random() * 16, w, w * 0.22, 0x050505, 0.55).setDepth(-3.5);
    this.scorches.push(s);
  }

  /** A burning car body comes to rest and stays there, sliding off down the road behind you. */
  private makeWreck(o: Movable, kind: FoeKind) {
    const img = o as unknown as Phaser.GameObjects.Image;
    const upside = Math.abs(Phaser.Math.Angle.WrapDegrees(img.angle)) > 100;
    const wreckKey = kind === "swat" ? "p_wreck_van" : kind === "cop" || kind === "unmarked" ? "p_wreck_cop" : "";
    if (img.setTexture && wreckKey && this.textures.exists(wreckKey)) {
      const h = img.displayHeight;
      img.setTexture(wreckKey).clearTint();
      img.setScale(h / img.height);
      img.setFlipY(upside);
    } else if (img.setTint) img.setTint(0x2b2622);
    img.setAngle(0).setDepth(14);
    const fire = this.lite ? null : vfx(this, "vfx_fire", img.x, img.y - 10, { scale: kind === "tank" || kind === "heli" ? 1.5 : 1.1, depth: 15, add: true });
    if (this.wrecks.length >= 6) {
      const w = this.wrecks.shift()!;
      w.fire?.destroy();
      this.tweens.add({ targets: w.o, alpha: 0, duration: 300, onComplete: () => w.o.destroy() });
    }
    this.wrecks.push({ o, fire, dy: -10 });
  }

  // ---------------------------------------------------------------- core

  private gunTip() {
    const a = this.gun.rotation;
    const gx = this.truck.x + this.gun.x;
    const gy = this.truck.y + this.gun.y;
    return { x: gx + Math.cos(a) * 40, y: gy + Math.sin(a) * 40, a };
  }

  private spawn(kind: FoeKind) {
    let spr: Phaser.GameObjects.Image;
    let hp = 6;
    let tx = 0;
    let ty = ROAD_Y + 6;
    let tint: number | undefined;
    if (kind === "cop" || kind === "unmarked") {
      spr = this.add.image(-120, ROAD_Y + 10, this.textures.exists("p_copcar") ? "p_copcar" : "p_tank").setScale(2.1).setOrigin(0.5, 0.8);
      tx = Phaser.Math.Between(70, 280);
      hp = 7;
      if (kind === "unmarked") {
        // the unmarked BMW: quicker, angrier, rams more
        tint = 0x50506a;
        spr.setTint(tint).setScale(1.95);
        hp = 5;
        tx = Phaser.Math.Between(160, 300);
      }
    } else if (kind === "swat") {
      spr = this.add.image(-140, ROAD_Y + 8, this.textures.exists("p_swatvan") ? "p_swatvan" : "p_tank").setScale(2.3).setOrigin(0.5, 0.8);
      tx = Phaser.Math.Between(60, 240);
      hp = 14;
    } else if (kind === "heli") {
      const fromRight = Math.random() < 0.4;
      spr = this.add.image(fromRight ? 1080 : -120, Phaser.Math.Between(90, 170), this.textures.exists("p_heli") ? "p_heli" : "p_plane").setScale(2.2).setFlipX(!fromRight);
      tx = Phaser.Math.Between(180, 820);
      ty = spr.y;
      hp = 15;
    } else if (kind === "tank") {
      spr = this.add.image(-220, ROAD_Y + 8, "p_tank").setScale(2.6).setOrigin(0.5, 0.8);
      tx = Phaser.Math.Between(90, 180);
      hp = 55;
    } else if (kind === "ramp") {
      // a wrecked cop car on its roof with a plank against it: SanMik goes for it
      const c = this.add.container(1040, ROAD_Y + 20);
      c.add(this.add.triangle(0, 0, -70, 10, 40, -46, 40, 10, 0x8b5a2b).setStrokeStyle(3, 0x3f2a14));
      if (this.textures.exists("p_wreck_cop")) c.add(this.add.image(70, -10, "p_wreck_cop").setScale(1.5).setFlipY(true));
      else if (this.textures.exists("p_copcar")) c.add(this.add.image(70, -6, "p_copcar").setScale(1.6).setFlipY(true).setTint(0x777777));
      spr = c as unknown as Phaser.GameObjects.Image;
      tx = -300;
      hp = 999;
    } else {
      // a police stinger across the road
      spr = this.add.rectangle(1020, ROAD_Y + 22, 110, 10, 0x111827).setStrokeStyle(3, 0xe5e7eb) as unknown as Phaser.GameObjects.Image;
      tx = -200;
      hp = 999;
    }
    spr.setDepth(kind === "heli" ? 30 : kind === "spikes" || kind === "ramp" ? 15 : 18);
    const f: Foe = { kind, spr, hp, maxHp: hp, nextShot: this.time.now + 1200 + Math.random() * 800, tx, ty, dead: false, push: 0, tint };
    if (kind === "heli") f.light = this.add.triangle(spr.x, spr.y, 0, 0, -70, 330, 70, 330, 0xffffff, 0.12).setOrigin(0.5, 0).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
    if (kind === "cop" || kind === "swat" || kind === "unmarked") f.siren = this.add.circle(spr.x, spr.y - 40, 6, 0xef4444).setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
    if (kind === "tank" || kind === "heli" || kind === "swat") f.bar = this.add.rectangle(spr.x, spr.y - 60, 60, 5, 0xef4444).setDepth(31);
    this.foes.push(f);
  }

  private hurtTruck(n: number, why?: string) {
    if (this.ended) return;
    n = scaleInt(n, diffFor(G.s).damageTaken);
    this.hp = Math.max(0, this.hp - n);
    this.shake(0.25 + n * 0.02);
    // a red edge, not a full-screen flash (that strobes)
    this.hurtEdge.setAlpha(Math.min(1, 0.5 + n * 0.04));
    this.tweens.add({ targets: this.hurtEdge, alpha: 0, duration: 260 });
    synth.play("hurt");
    if (why) this.pop(this.truck.x, this.truck.y - 130, why, "#ef4444", 16);
    if (this.hp <= 0) this.crash();
  }

  private pop(x: number, y: number, t: string, color = "#ffffff", size = 16) {
    const tx = this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(350);
    this.tweens.add({ targets: tx, y: y - 36, alpha: 0, duration: 1000, onComplete: () => tx.destroy() });
  }

  /** A big punchy word in the middle of the screen (kill-chain callouts, wave names). */
  private shout(text: string, color = "#fde047", size = 32) {
    // animated on the real clock in update(), so it still punches in during hit-stop and slow-mo
    this.callout.setText(text).setColor(color).setFontSize(Math.min(size, text.length > 20 ? 26 : 32)).setAlpha(1);
    this.calloutAt = performance.now();
    this.calloutTilt = Phaser.Math.Between(-5, 5);
  }

  /** Explosions in three sizes: 0 a rocket pop, 1 a car, 2 a tank / chopper / finale. */
  private explode(x: number, y: number, big: boolean | 0 | 1 | 2 = false) {
    const size = big === true ? 2 : big === false ? 0 : big;
    synth.play("explode");
    if (size >= 1) synth.play(size === 2 ? "boom" : "car_hit");
    this.shake(size === 2 ? 0.75 : size === 1 ? 0.42 : 0.24);
    // a white-hot flash disc first, then the drawn fireball
    const flash = this.add.circle(x, y, size === 2 ? 64 : size === 1 ? 40 : 24, 0xfff7d6, 0.6).setDepth(62).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: size === 2 ? 160 : 110, onComplete: () => flash.destroy() });
    if (vfx(this, size === 2 ? "vfx_bigboom" : "vfx_boom", x, y, { scale: size === 2 ? 2 : size === 1 ? 1.45 : 1.05, depth: 60 })) {
      if (size >= 1) vfx(this, "vfx_shock", x, y + 20, { scale: size === 2 ? 2.4 : 1.5, depth: 59, add: true });
      if (size === 2) {
        vfx(this, "vfx_boom", x - 50, y + 10, { scale: 1.3, depth: 61, delay: 90 });
        vfx(this, "vfx_boom", x + 45, y - 25, { scale: 1.1, depth: 61, delay: 170 });
        if (!this.lite) vfx(this, "vfx_blastsmoke", x - 20, y - 10, { scale: 1, depth: 57, delay: 250, alpha: 0.85 });
      } else if (!this.lite) vfx(this, "vfx_smoke", x - 30, y - 20, { scale: size === 1 ? 1.4 : 1, depth: 58, delay: 260 });
      if (size >= 1 && !this.lite) vfx(this, "vfx_sparks", x, y, { scale: 1.3, depth: 61, add: true });
    } else {
      for (let i = 0; i < (size === 2 ? 4 : 2); i++) {
        const c = this.add.circle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 30, 10, i % 2 ? 0xfde047 : 0xf97316, 0.95).setDepth(60).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: c, radius: size === 2 ? 100 : 60, alpha: 0, duration: 450 + i * 120, onComplete: () => c.destroy() });
      }
      for (let i = 0; i < (size === 2 ? 8 : 4); i++) {
        const sm = this.add.circle(x, y, 8 + Math.random() * 10, 0x374151, 0.7).setDepth(58);
        this.tweens.add({ targets: sm, x: x - 80 - Math.random() * 120, y: y - 40 - Math.random() * 80, radius: 30, alpha: 0, duration: 900 + Math.random() * 600, onComplete: () => sm.destroy() });
      }
    }
    // hot debris: chunky, spinning, bouncing (a few, not a blizzard)
    const n = this.lite || this.junk.length > 80 ? 2 : size === 2 ? 9 : size === 1 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const hot = Math.random() < 0.4;
      const d = this.add.rectangle(x, y, 4 + Math.random() * 6, 3 + Math.random() * 4, hot ? 0xfb923c : Math.random() < 0.5 ? 0x9ca3af : 0x1f2937).setDepth(61);
      if (hot) d.setBlendMode(Phaser.BlendModes.ADD);
      this.fling(d, { vx: (Math.random() - 0.6) * 0.7 * (size + 1) * 0.6, vy: -0.4 - Math.random() * 0.5 * (size + 1) * 0.6, va: (Math.random() - 0.5) * 2, life: 1000 + Math.random() * 600, bounce: 0.3 });
    }
    if (y > ROAD_Y - 60) this.scorch(x, size === 2 ? 160 : size === 1 ? 110 : 70);
  }

  private killFoe(f: Foe, chained = false) {
    if (f.dead) return;
    f.dead = true;
    f.light?.destroy();
    f.siren?.destroy();
    f.bar?.destroy();
    const spr = f.spr;
    spr.clearTint?.();
    if (f.tint !== undefined) spr.setTint(f.tint);
    const x = spr.x;
    const y = spr.y - 20;
    const big = f.kind === "tank" || f.kind === "heli";
    this.hitStop(big ? 110 : f.kind === "swat" ? 70 : 50);
    const real = performance.now();
    const chainPop = chained && real >= this.nextChainPop;
    if (chainPop) this.nextChainPop = real + 600;
    if (f.kind === "cop" || f.kind === "unmarked") {
      this.explode(x, y, 1);
      // up, over, cartwheeling backwards off the road, on fire
      const fire = vfx(this, "vfx_fire", x, y, { scale: 1, depth: 19, add: true });
      this.fling(spr, {
        vx: -0.28 - Math.random() * 0.2,
        vy: -0.85 - Math.random() * 0.3,
        va: -(0.55 + Math.random() * 0.35),
        g: 0.0027,
        ground: ROAD_Y + 10,
        bounce: 0.38,
        life: 99999,
        fire,
        smokeEvery: 110,
        onLand: (j) => {
          if (j.bounces === 1 && !j.grounded) {
            synth.play("car_hit");
            this.shake(0.2);
            if (!this.lite) vfx(this, "vfx_dust", j.o.x, ROAD_Y + 18, { scale: 1.4, depth: 21 });
          } else this.settle(j, f.kind);
        },
      });
    } else if (f.kind === "swat") {
      this.explode(x, y, 1);
      this.time.delayedCall(140, () => this.explode(x + 30, y - 20, 0));
      // the van hops and splits; wheels and panels go everywhere
      const fire = vfx(this, "vfx_fire", x, y, { scale: 1.3, depth: 19, add: true });
      this.fling(spr, { vx: -0.22, vy: -0.45, va: -0.18, g: 0.0026, ground: ROAD_Y + 8, bounce: 0.2, life: 99999, fire, smokeEvery: 130, onLand: (j) => j.bounces >= 1 && this.settle(j, f.kind) });
      for (let i = 0; i < 2; i++) {
        const w = this.add.container(x + (i ? 50 : -50), ROAD_Y + 4).setDepth(22);
        w.add(this.add.circle(0, 0, 13, 0x111111).setStrokeStyle(2, 0x333333));
        w.add(this.add.rectangle(0, 0, 10, 3, 0x9ca3af));
        w.add(this.add.circle(0, 0, 4, 0x9ca3af));
        this.fling(w as unknown as Movable, { vx: (i ? 0.35 : -0.45) + (Math.random() - 0.5) * 0.2, vy: -0.7 - Math.random() * 0.4, va: i ? 1.2 : -1.2, ground: ROAD_Y + 30, bounce: 0.55, life: 2400 });
      }
      for (const c of [0xfacc15, 0x2563eb, 0xf3f4f6, 0xfacc15]) {
        const p = this.add.rectangle(x, y - 10, 14 + Math.random() * 10, 8 + Math.random() * 8, c).setStrokeStyle(1, 0x111827).setDepth(22);
        this.fling(p, { vx: (Math.random() - 0.55) * 0.9, vy: -0.6 - Math.random() * 0.6, va: (Math.random() - 0.5) * 1.6, life: 1600, bounce: 0.3 });
      }
    } else if (f.kind === "heli") {
      this.explode(x, y, 1);
      this.bigMoment(420);
      this.shout("CHOPPER DOWN!", "#22d3ee", 32);
      // the rotor comes off; the rest spins down trailing smoke and crashes in a fireball
      const rotor = this.add.rectangle(x, y - 30, 120, 4, 0x1f2937).setDepth(31);
      this.fling(rotor, { vx: 0.2 - Math.random() * 0.4, vy: -0.6, va: 2.4, g: 0.0012, life: 1600, bounce: 0.1 });
      const fire = vfx(this, "vfx_fire", x, y, { scale: 1.1, depth: 31, add: true });
      this.fling(spr, {
        vx: -0.18 - Math.random() * 0.1,
        vy: -0.05,
        va: 0.75,
        g: 0.0011,
        ground: ROAD_Y + 6,
        bounce: 0,
        life: 99999,
        fire,
        smokeEvery: 60,
        onLand: (j) => {
          this.explode(j.o.x, ROAD_Y - 10, 2);
          this.hitStop(80);
          this.bigMoment(500);
          // whatever it lands on goes too
          this.splash(j.o.x, ROAD_Y - 10, 150, 20);
          this.settle(j, "heli");
        },
      });
    } else if (f.kind === "tank") {
      this.explode(x, y, 2);
      this.time.delayedCall(180, () => this.explode(x - 60, y + 10, 1));
      this.time.delayedCall(380, () => {
        this.explode(x + 50, y - 30, 2);
        if (!this.lite) vfx(this, "vfx_blastsmoke", x, y - 20, { scale: 1.2, depth: 56, alpha: 0.85 });
      });
      synth.play("reveal_boom");
      this.bigMoment(700);
      this.shout("TANK BUSTER!!", "#a3e635", 36);
      // the turret goes up like a champagne cork
      const tur = this.add.container(x + 10, y - 30).setDepth(32);
      tur.add(this.add.rectangle(0, 0, 70, 26, 0x3f4a2a).setStrokeStyle(2, 0x1a1f10));
      tur.add(this.add.rectangle(56, -2, 60, 8, 0x2f3a1f).setStrokeStyle(2, 0x1a1f10));
      const tfire = vfx(this, "vfx_fire", tur.x, tur.y, { scale: 1, depth: 31, add: true });
      this.fling(tur as unknown as Movable, { vx: -0.12, vy: -1.25, va: 0.7, g: 0.0024, ground: ROAD_Y + 8, bounce: 0.25, life: 3200, fire: tfire, smokeEvery: 80, onLand: (j) => j.bounces === 1 && this.explode(j.o.x, ROAD_Y - 6, 0) });
      spr.setTint(0x3a3028);
      this.tweens.add({ targets: spr, y: spr.y + 6, duration: 120, yoyo: true });
      this.fling(spr, { vx: -0.12, vy: 0, va: 0, g: 0, ground: spr.y + 1, life: 99999, grounded: true });
      this.time.delayedCall(450, () => {
        const j = this.junk.find((jj) => jj.o === spr);
        if (j) this.settle(j, "tank");
      });
    }
    // chain reaction: the blast catches whatever's next to it
    const r = f.kind === "tank" ? 170 : f.kind === "swat" ? 120 : f.kind === "heli" ? 0 : 95;
    if (r) this.time.delayedCall(110, () => this.splash(x, y, r, f.kind === "tank" ? 30 : 8));
    // scoring and the kill chain
    this.kills++;
    const now = this.time.now;
    this.streak = now < this.streakUntil ? this.streak + 1 : 1;
    this.streakUntil = now + 2600;
    const mult = 1 + Math.floor(this.streak / 3);
    this.score += POINTS[f.kind] * mult;
    if (chainPop) this.pop(x, y - 50, `CHAIN REACTION! +${POINTS[f.kind] * mult}`, "#fb923c", 16);
    else if (!chained) this.pop(x, y - 40, `+${POINTS[f.kind] * mult}`, "#fde047", 16);
    if (this.streak >= 2) {
      this.streakText.setText(`${this.streak} KILL CHAIN  x${mult}`).setScale(1.5).setAlpha(1);
      this.tweens.add({ targets: this.streakText, scale: 1, duration: 200, ease: "Back.out" });
      const c = CALLOUTS.find((cc) => cc[0] === this.streak);
      if (c && !big) this.shout(c[1] === "SANMIK APPROVES" && this.gaborDrives ? "GABOR APPROVES" : c[1], c[2], c[1].length > 18 ? 26 : 32);
      else if (!c && this.streak > 25 && this.streak % 5 === 0) this.shout(`${this.streak}?! STILL GOING?!`, "#ffd23f", 30);
      if (c && this.streak >= 5) synth.play("crit");
    }
    if (this.kills % 8 === 0) {
      this.hp = Math.min(100, this.hp + 12);
      this.pop(this.truck.x, this.truck.y - 150, "+12 TRUCK (gaffer tape)", "#86efac", 14);
    }
    this.sloppy = Math.min(100, this.sloppy + (f.kind === "cop" || f.kind === "unmarked" ? 12 : 22));
    G.s.coins += f.kind === "cop" || f.kind === "unmarked" ? 3 : 7;
    if (Math.random() < 0.4) this.bark(f.kind === "heli" ? "SANMIK" : undefined);
  }

  /** Damage everything on the road within r of a blast. */
  private splash(x: number, y: number, r: number, dmg: number) {
    for (const g of this.foes) {
      if (g.dead || g.kind === "spikes" || g.kind === "ramp") continue;
      if (Phaser.Math.Distance.Between(g.spr.x, g.spr.y - 30, x, y) < r) {
        g.push += Math.sign(g.spr.x - x || -1) * 30;
        this.damageFoe(g, dmg, true);
      }
    }
  }

  /** A flung body has stopped bouncing: leave a burning wreck. */
  private settle(j: Junk, kind: FoeKind) {
    j.fire?.destroy();
    this.junk = this.junk.filter((jj) => jj !== j);
    this.makeWreck(j.o, kind);
  }

  private bark(who?: "SANMIK" | "SANCHZ", text?: string) {
    const w = who ?? (Math.random() < 0.6 ? "SANMIK" : "SANCHZ");
    // playing as Mikey, "SANMIK" here is the driver's seat: Gabor's. (His SLOPPY SURPRISE is yours.)
    if (this.gaborDrives && w === "SANMIK" && text === "SLOPPY SURPRISE!!") {
      this.pop(this.truck.x - 30, this.truck.y - 130, text, "#b0c4ff", 15);
      synth.shout("yee", 0.85);
      return;
    }
    const mik = ["YEEEE!", "SanMik is here, I don't give a fuck!", "Away from the feds, away from the scum!", "Fifteen cop cars on my tail!", "Yee yee! Brap brap!", "Turn on your fucking TV!", "Channel U, baby!", "HOLD ON!", "Shoot the chopper, blud!"];
    const chz = ["YEGHHHH!", "Mork.", "Big up the getaway!", "That's great for the core", "YEGH YEGH", "MORE ROCKETS!"];
    const list = w === "SANMIK" ? mik : chz;
    const t = text ?? list[Math.floor(Math.random() * list.length)];
    this.pop(this.truck.x + (w === "SANMIK" ? 70 : -80), this.truck.y - 120, t, w === "SANMIK" ? (this.gaborDrives ? "#f5f5f4" : "#b0c4ff") : "#ffe08a", 15);
    if (!(this.gaborDrives && w === "SANMIK")) synth.shout(w === "SANMIK" ? "yee" : "yegh", 0.85);
  }

  private fireRocket() {
    if (!this.running || this.ended || this.box.active || this.time.now < this.nextRocket) return;
    this.nextRocket = this.time.now + 650;
    const tip = this.gunTip();
    const r = this.add.rectangle(tip.x, tip.y, 24, 8, 0xef4444).setStrokeStyle(2, 0xfde047).setDepth(42).setRotation(tip.a);
    this.bullets.push({ spr: r, vx: Math.cos(tip.a) * 0.8, vy: Math.sin(tip.a) * 0.8, mine: true, dmg: 14 * damageMult(G.s), life: 1600, rocket: true });
    synth.play("rocket");
    vfx(this, "vfx_muzzle", tip.x, tip.y, { angle: Phaser.Math.RadToDeg(tip.a), scale: 1.8, depth: 41, add: true });
    // back-blast out the rear of the launcher
    if (!this.lite) vfx(this, "vfx_smoke", tip.x - Math.cos(tip.a) * 60, tip.y - Math.sin(tip.a) * 60, { scale: 0.8, depth: 39, alpha: 0.8 });
    this.gunKick = 12;
    this.kick.x -= Math.cos(tip.a) * 10;
    this.kick.y -= Math.sin(tip.a) * 10;
    this.shake(0.18);
  }

  private rocketBoom(x: number, y: number, dmg: number) {
    this.explode(x, y, 1);
    vfx(this, "vfx_shock", x, y, { scale: 1.8, depth: 59, add: true });
    this.splash(x, y, 130, dmg);
  }

  private damageFoe(f: Foe, n: number, chained = false) {
    if (f.dead) return;
    f.hp -= n;
    f.spr.setTintFill?.(0xffffff);
    this.time.delayedCall(45, () => {
      if (!f.spr.active || f.dead) return;
      f.spr.clearTint();
      if (f.tint !== undefined) f.spr.setTint(f.tint);
    });
    if (f.hp <= 0) this.killFoe(f, chained);
  }

  private sloppySurprise() {
    if (!this.running || this.ended || this.box.active) return;
    if (this.sloppy < 100) {
      this.pop(this.truck.x, this.truck.y - 150, `SLOPPY SURPRISE ${Math.floor(this.sloppy)}%`, "#a3e635", 14);
      return;
    }
    this.sloppy = 0;
    this.bark("SANMIK", "SLOPPY SURPRISE!!");
    this.time.delayedCall(200, () => synth.shout("yee", 1));
    this.time.delayedCall(400, () => synth.shout("yee", 1));
    const slop = this.add.rectangle(480, 270, 960, 540, 0xa3e635, 0.55).setDepth(250).setScrollFactor(0);
    this.tweens.add({ targets: slop, alpha: 0, duration: 900, onComplete: () => slop.destroy() });
    this.shout("SLOPPY SURPRISE!!", "#a3e635", 36);
    sloppyCutIn(this);
    this.bigMoment(600);
    for (const f of this.foes) if (!f.dead && f.kind !== "spikes" && f.kind !== "ramp" && f.kind !== "tank") this.killFoe(f);
    for (const f of this.foes) if (!f.dead && f.kind === "tank") this.damageFoe(f, 25);
    for (const b of this.bullets) if (!b.mine) b.life = 0;
  }

  private crash() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    this.explode(this.truck.x, this.truck.y - 30, true);
    this.box.play([dir("The truck spins out and stops against a bollard. The feds pile out. SanMik winds down his window.", { variants: { MIKEY: "The truck spins out and stops against a bollard. The feds pile out. Gabor winds down his window with his teeth." } }), say(this.driver, "Officer. I'll be honest with you. That's illegal. I wrote the law."), dir("…Somehow, it works. Try that again.")]).then(() => {
      this.cameras.main.fadeOut(300);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart(this.startData));
    });
  }

  /** The drawbridge: it's lifting, the tank fires, shift into the highest gear. The set piece itself is drive/Drawbridge.ts. */
  private async drawbridge() {
    this.bridgeStarted = true;
    this.running = false;
    for (const f of this.foes)
      if (!f.dead && f.kind !== "tank") {
        f.dead = true;
        f.light?.destroy();
        f.siren?.destroy();
        f.bar?.destroy();
        this.tweens.add({ targets: f.spr, x: f.spr.x - 500, alpha: 0, duration: 900, onComplete: () => f.spr.destroy() });
      }
    if (!this.foes.some((f) => f.kind === "tank" && !f.dead)) this.spawn("tank");
    // the tank belongs to the set piece now
    const tank = this.foes.find((f) => f.kind === "tank" && !f.dead);
    if (tank) {
      tank.dead = true;
      tank.bar?.destroy();
    }
    for (const b of this.bullets) b.spr.destroy();
    this.bullets = [];
    await this.box.play([say(this.driver, "There's a drawbridge about to lift."), say(this.driver, "Into the highest gear I shift."), dir("MASH (tap / Space) to shift into the highest gear!")]);
    const db = new Drawbridge({
      scene: this,
      truck: this.truck,
      gun: this.gun,
      me: this.me,
      roadY: ROAD_Y,
      truckX: TRUCK_X,
      gaborDrives: this.gaborDrives,
      tank: tank?.spr ?? null,
      lamps: this.lamps,
      explode: (x, y, size) => this.explode(x, y, size),
      shake: (n) => this.shake(n),
      pop: (x, y, t, c, sz) => this.pop(x, y, t, c, sz),
      bark: (who, text) => this.bark(who, text),
      kill: (pts) => {
        this.kills++;
        this.score += pts;
      },
      fling: (o, vx, vy, va) => this.fling(o, { vx, vy, va, ground: 900, life: 2400, bounce: 0 }),
      lite: () => this.lite,
    });
    this.db = db;
    db.start();
    this.scoreText.setVisible(false);
    let gear = 0;
    const g = this.add.text(480, 180, "GEAR 1", { fontFamily: PIXEL_BOLD, fontSize: "40px", color: "#fde047", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(400).setScrollFactor(0);
    await new Promise<void>((resolve) => {
      const tap = () => {
        gear++;
        g.setText(gear >= 12 ? "HIGHEST GEAR!!" : `GEAR ${1 + Math.floor(gear / 2)}`).setScale(1.25);
        this.tweens.add({ targets: g, scale: 1, duration: 120 });
        synth.play(gear % 2 ? "select" : "hit");
        db.gear(gear);
        this.shake(0.08);
      };
      this.input.on("pointerdown", tap);
      this.input.keyboard!.on("keydown-SPACE", tap);
      this.time.delayedCall(2600, () => {
        this.input.off("pointerdown", tap);
        this.input.keyboard!.off("keydown-SPACE", tap);
        resolve();
      });
    });
    g.destroy();
    // the run-up, the tank's rocket, the jump, the far leaf going in the river
    await db.go();
    this.db = null;
    db.destroy();
    this.scoreText.setVisible(true);
    this.cameras.main.setZoom(1);
    this.truck.setY(ROAD_Y).setAngle(0);
    await this.box.play([
      say(this.driver, "We jumped the drawbridge! We lost the fucking damn police! YEEEEEE!"),
      say("SANCHZ", "YEGHHHHHHH."),
      gabor("I fell out twice. Can we do it again? Please no. Please yes."),
      say(this.driver, "Let's have this night of freedom. Let's have this night of love."),
      say(this.driver, "And all you pricks who doubted me, turn on your fucking TV. Put it onto Channel U. You'll see me say FUCK YOU."),
      dir(`${this.kills} police vehicles destroyed. ${this.score.toLocaleString("en-GB")} points of damage to the public purse. The truck screeches into a warehouse car park on the edge of the estate. The ground is shaking. Not from the police. From the bass.`),
      say(this.driver, "Yee. The Nu Warehouse. Where it all began. We can't fix the hot tub sober, blud. Nobody's ever fixed a hot tub sober."),
    ]);
    this.finish();
  }

  private finish() {
    this.ended = true;
    G.s.flags.sm_drive_done = true;
    G.save();
    fadeThen(this, 250, () => {
      if (this.resume) runChain(this, this.chain, this.resume);
      else switchTo(this, "Hub", { at: "PUB" });
    });
  }

  /** SanMik's driving: hop the stingers, launch off the ramps. */
  private autoJump(big: boolean) {
    if (this.jumpY < 0) return;
    this.jumpV = big ? -1.45 : -0.95;
    synth.play("dodge");
    if (big) {
      this.bark("SANMIK", Math.random() < 0.5 ? "HOLD ON TO YOUR BOLLOCKS!" : "YEEEEEEE!");
      this.pop(this.truck.x, this.truck.y - 180, "AIRTIME!", "#fde047", 22);
    }
  }

  /** Flung junk and wrecks: gravity, bounces, smoke trails, then off down the road. */
  private updateJunk(dt: number, spd: number) {
    const roadDx = dt * ROAD_SPEED * spd;
    const now = this.time.now;
    for (const j of this.junk) {
      const o = j.o;
      if (!o.active) {
        j.life = 0;
        continue;
      }
      j.life -= dt;
      if (j.grounded) {
        o.x -= roadDx;
        j.vx *= 0.98;
        o.x += j.vx * dt;
      } else {
        j.vy += j.g * dt;
        o.x += j.vx * dt;
        o.y += j.vy * dt;
        o.angle += j.va * dt;
        if (o.y >= j.ground && j.vy > 0) {
          o.y = j.ground;
          j.bounces++;
          if (Math.abs(j.vy) * j.bounce < 0.12) {
            j.grounded = true;
            j.vy = 0;
            j.va = 0;
          } else {
            j.vy = -j.vy * j.bounce;
            j.va *= 0.55;
            j.vx = j.vx * 0.6 - ROAD_SPEED * 0.25;
          }
          j.onLand?.(j);
          if (!this.junk.includes(j)) continue;
        }
      }
      if (j.fire?.active) j.fire.setPosition(o.x, o.y - 10);
      if (j.smokeEvery && now >= (j.nextSmoke ?? 0) && !this.lite) {
        j.nextSmoke = now + j.smokeEvery;
        const s = this.add.circle(o.x, o.y - 10, 7 + Math.random() * 5, 0x2b2b33, 0.65).setDepth(17);
        this.tweens.add({ targets: s, x: s.x - 70 - Math.random() * 40, y: s.y - 30 - Math.random() * 30, scale: 2.6, alpha: 0, duration: 800, onComplete: () => s.destroy() });
      }
      if (j.life < 300) o.setAlpha(Math.max(0, j.life / 300));
      if (j.life <= 0 || o.x < -260 || o.y > 700) {
        j.life = 0;
        j.fire?.destroy();
        o.destroy();
      }
    }
    this.junk = this.junk.filter((j) => j.life > 0 && j.o.active);
    for (const w of this.wrecks) {
      w.o.x -= roadDx;
      if (w.fire?.active) w.fire.setPosition(w.o.x, w.o.y + w.dy);
      if (w.o.x < -240) {
        w.fire?.destroy();
        w.o.destroy();
      }
    }
    this.wrecks = this.wrecks.filter((w) => w.o.active);
    for (const s of this.scorches) s.x -= roadDx;
    while (this.scorches.length && this.scorches[0].x < -200) this.scorches.shift()!.destroy();
  }

  /** Camera: lean toward the aim, kick back on each shot, trauma shake on top. */
  private updateCamera(realDt: number, aimX: number, aimY: number) {
    const cam = this.cameras.main;
    const live = this.running && !this.box.active && !this.ended;
    const tx = live ? Phaser.Math.Clamp((aimX - 480) * 0.035, -18, 18) : 0;
    const ty = live ? Phaser.Math.Clamp((aimY - 300) * 0.025, -10, 10) : 0;
    const k = Math.min(1, realDt / 120);
    this.lean.x += (tx - this.lean.x) * k;
    this.lean.y += (ty - this.lean.y) * k;
    const kd = Math.pow(0.5, realDt / 40);
    this.kick.x *= kd;
    this.kick.y *= kd;
    this.trauma = Math.max(0, this.trauma - realDt * 0.0016);
    const s = this.trauma * this.trauma * 16;
    const shx = s ? (Math.random() * 2 - 1) * s : 0;
    const shy = s ? (Math.random() * 2 - 1) * s : 0;
    const db = this.db;
    if (db) cam.setZoom(db.zoom);
    cam.setScroll(this.lean.x + this.kick.x + shx + (db?.camX ?? 0), this.lean.y + this.kick.y + shy + (db?.camY ?? 0));
  }

  update(_time: number, delta: number) {
    const realDt = Math.min(delta, 50);
    // hit-stop and slow-mo: a scaled clock for the action (the song and its timer stay on real time)
    const real = performance.now();
    const live = !this.box.active && !this.ended;
    const ts = this.db?.ts ?? (!live ? 1 : real < this.stopUntil ? 0.04 : real < this.slowUntil ? 0.3 : 1);
    this.tweens.timeScale = ts;
    this.time.timeScale = ts;
    this.anims.globalTimeScale = ts;
    const dt = realDt * ts;
    const now = this.time.now;
    const spd = this.db ? this.db.v / ROAD_SPEED : this.bridgeStarted ? 0.6 : 1;
    this.scroll += dt * ROAD_SPEED * spd;
    this.far.tilePositionX = (this.scroll * this.farRate) / this.far.tileScaleX;
    this.near.tilePositionX = (this.scroll * this.nearRate) / this.near.tileScaleX;
    this.road.tilePositionX = this.scroll;
    this.lines.clear();
    this.lines.fillStyle(0xffffff, 0.8);
    for (let x = -80 - (this.scroll % 120); x < 1040; x += 120) this.lines.fillRect(x, ROAD_Y + 70, 60, 5);
    for (let i = 0; i < this.lamps.length; i++) this.lamps[i].setX(((((i * 300 - this.scroll * 0.9) % 1200) + 1200) % 1200) - 120);
    this.updateJunk(dt, spd);
    this.db?.update(dt, realDt);
    // speed lines
    this.fx.clear();
    if (this.running) {
      this.fx.lineStyle(2, 0xffffff, 0.15);
      for (let i = 0; i < 8; i++) {
        const y = 200 + ((i * 53 + now * 0.07) % 300);
        const x = 960 - ((now * 1.4 + i * 211) % 1100);
        this.fx.lineBetween(x, y, x + 90, y);
      }
    }
    // jump physics
    if (this.jumpV !== 0 || this.jumpY < 0) {
      this.jumpY += this.jumpV * dt;
      this.jumpV += dt * 0.0042;
      if (this.jumpY >= 0) {
        const hard = this.jumpV > 1.2;
        this.jumpY = 0;
        this.jumpV = 0;
        // landing: sparks
        for (let i = 0; i < (hard ? 14 : 6); i++) {
          const sp = this.add.rectangle(this.truck.x + (Math.random() - 0.5) * 160, ROAD_Y + 20, 3, 3, 0xfde047).setDepth(25);
          this.tweens.add({ targets: sp, x: sp.x - 80 - Math.random() * 100, y: sp.y - 20 - Math.random() * 30, alpha: 0, duration: 400, onComplete: () => sp.destroy() });
        }
        if (hard) {
          this.shake(0.35);
          if (!this.lite) vfx(this, "vfx_dust", this.truck.x - 60, ROAD_Y + 20, { scale: 1.6, depth: 21 });
        }
      }
    }
    if (!this.bridgeStarted) {
      this.truck.y = ROAD_Y + this.jumpY;
      this.truck.setAngle(this.jumpY < -5 ? Phaser.Math.Clamp(this.jumpV * 8, -10, 10) : 0);
    }
    this.mace.setAlpha(now < this.maceUntil ? 0.45 : 0);
    // police lights: brighter the more of them there are
    const cops = this.foes.filter((f) => !f.dead && (f.kind === "cop" || f.kind === "swat" || f.kind === "unmarked")).length;
    const flash = Math.floor(now / 160) % 2;
    const lvl = Math.min(0.28, cops * 0.05);
    this.copGlowL.setAlpha(flash ? lvl : 0);
    this.copGlowR.setAlpha(flash ? 0 : lvl);
    // the kill chain drains
    const chainLeft = Math.max(0, this.streakUntil - now) / 2600;
    if (this.streak >= 2 && chainLeft > 0) this.streakBar.setAlpha(1).setSize(120 * chainLeft, 5);
    else this.streakBar.setAlpha(0);
    if (now > this.streakUntil) this.streakText.setAlpha(Math.max(0, this.streakText.alpha - realDt / 400));
    // the callout: punch in, hold, fade (real time)
    const age = real - this.calloutAt;
    if (age < 1400) {
      const k = Math.min(1, age / 200);
      this.callout.setScale(1 + 0.6 * (1 - k) * (1 - k)).setAngle(this.calloutTilt * (1 - k)).setAlpha(age > 1000 ? 1 - (age - 1000) / 400 : 1);
    } else if (this.callout.alpha) this.callout.setAlpha(0);
    // the score ticks up rather than jumping
    this.shownScore += Math.ceil((this.score - this.shownScore) * Math.min(1, realDt / 120));
    this.scoreText.setText(`${String(this.shownScore).padStart(6, "0")}\nKILLS ${this.kills}`);
    this.hpBar.setSize(160 * Phaser.Math.Clamp(this.hp / 100, 0, 1), 8).setFillStyle(this.hp > 50 ? 0x22c55e : this.hp > 25 ? 0xfacc15 : 0xef4444);
    const ptr = this.input.activePointer;
    this.updateCamera(realDt, ptr.x, ptr.y);
    // the gun settles back after recoil
    this.gunKick *= Math.pow(0.5, realDt / 30);
    this.gun.setPosition(-30 - Math.cos(this.gun.rotation) * this.gunKick, -84 - Math.sin(this.gun.rotation) * this.gunKick);
    if (!this.running || this.ended || this.box.active) {
      this.hud.setText("");
      return;
    }
    this.t += realDt / 1000;
    if (this.t >= LENGTH) {
      void this.drawbridge();
      return;
    }
    // waves: building up, then a breather before the drawbridge
    let wi = 0;
    while (wi + 1 < WAVES.length && this.t >= WAVES[wi + 1].at) wi++;
    if (wi !== this.wave) {
      this.wave = wi;
      const w = WAVES[wi];
      if (wi > 0) this.shout(w.name, w.cap ? "#ff6bb0" : "#86efac", 28);
      if (w.mix.tank && !this.foes.some((f) => f.kind === "tank" && !f.dead)) {
        this.spawn("tank");
        this.bark("SANMIK", "Look at that tank! It's pointing its turret at us!");
      }
      if (!w.cap) {
        this.hp = Math.min(100, this.hp + 15);
        this.pop(this.truck.x, this.truck.y - 150, "+15 TRUCK (more gaffer tape)", "#86efac", 14);
        this.bark("SANMIK", "It's gone quiet. Too quiet. Yee.");
      }
    }
    const wave = WAVES[this.wave];
    if (now >= this.nextSpawn && wave.cap) {
      const live = this.foes.filter((f) => !f.dead && f.kind !== "spikes" && f.kind !== "ramp").length;
      const helis = this.foes.filter((f) => f.kind === "heli" && !f.dead).length;
      const mix = wave.mix;
      const total = (mix.cop ?? 0) + (mix.unmarked ?? 0) + (mix.swat ?? 0) + (mix.heli ?? 0);
      let h = helis;
      for (let k = 0; k < wave.per && live + k < wave.cap; k++) {
        let r = Math.random() * total;
        let pick: FoeKind = "cop";
        for (const kind of ["cop", "unmarked", "swat", "heli"] as const) {
          r -= mix[kind] ?? 0;
          if (r <= 0) {
            pick = kind;
            break;
          }
        }
        if (pick === "heli" && h >= wave.helis) pick = "swat";
        if (pick === "heli") h++;
        this.spawn(pick);
      }
      if (Math.random() < wave.spikes) this.spawn("spikes");
      this.nextSpawn = now + wave.gap;
    }
    if (now >= this.nextRamp && wave.cap) {
      this.spawn("ramp");
      this.nextRamp = now + 11000 + Math.random() * 5000;
    }
    // aiming the gun
    const gx = this.truck.x + this.gun.x;
    const gy = this.truck.y + this.gun.y;
    let aimX = ptr.worldX;
    let aimY = ptr.worldY;
    if (ptr.wasTouch) {
      const target = this.foes.filter((f) => !f.dead && f.kind !== "spikes" && f.kind !== "ramp").sort((a, b) => Math.abs(a.spr.x - gx) - Math.abs(b.spr.x - gx))[0];
      if (target) {
        aimX = target.spr.x;
        aimY = target.spr.y - 30;
      }
    }
    const aim = Math.atan2(aimY - gy, aimX - gx) - this.truck.rotation;
    this.gun.setRotation(aim).setScale(1, Math.cos(aim) < 0 ? -1 : 1);
    this.me.setFlipX(Math.cos(aim) < 0);
    // the machine gun: never runs out
    if (ptr.isDown && !ptr.rightButtonDown() && now >= this.nextShot && !(ptr.y > 420 && (ptr.x < 110 || ptr.x > 850))) {
      this.nextShot = now + 70;
      this.shotN++;
      const tip = this.gunTip();
      const a = aim + (Math.random() - 0.5) * 0.08;
      // tracer: a long hot streak, every round
      const b = this.add.rectangle(tip.x, tip.y, 28, 4, 0xfff3a0).setDepth(40).setRotation(a).setBlendMode(Phaser.BlendModes.ADD);
      this.bullets.push({ spr: b, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, mine: true, dmg: 1.05 * damageMult(G.s), life: 900 });
      if (!vfx(this, "vfx_muzzle", tip.x, tip.y, { angle: Phaser.Math.RadToDeg(a), scale: 1.1 + Math.random() * 0.4, depth: 41, add: true })) {
        const mf = this.add.circle(tip.x, tip.y, 7, 0xfff7ae, 0.9).setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: mf, alpha: 0, scale: 1.8, duration: 60, onComplete: () => mf.destroy() });
      }
      // a light flash on the truck and the gunner every other round
      if (this.shotN % 2 === 0) {
        const lf = this.add.circle(tip.x, tip.y, 26, 0xffd27a, 0.35).setDepth(39).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: lf, alpha: 0, duration: 70, onComplete: () => lf.destroy() });
      }
      // brass: out, up, bounces off the road
      if (this.junk.length < 60 && (!this.lite || this.shotN % 3 === 0)) {
        const shell = this.add.rectangle(gx, gy, 5, 2, 0xfbbf24).setDepth(39);
        this.fling(shell, { vx: -Math.cos(a) * 0.05 + (Math.random() - 0.5) * 0.12, vy: -0.45 - Math.random() * 0.2, va: (Math.random() - 0.5) * 3, g: 0.0026, ground: ROAD_Y + 26 + Math.random() * 14, bounce: 0.45, life: 900 });
      }
      this.gunKick = 5;
      this.kick.x -= Math.cos(a) * 1.6;
      this.kick.y -= Math.sin(a) * 1.6;
      this.shake(0.02);
      if (this.shotN % 2 === 0) synth.play("gun_gatling");
    }
    // SanChz lobs food at whatever's closest
    if (now >= this.nextChz) {
      const target = this.foes.filter((f) => !f.dead && f.kind !== "spikes" && f.kind !== "ramp").sort((a, b) => Math.abs(a.spr.x - TRUCK_X) - Math.abs(b.spr.x - TRUCK_X))[0];
      if (target) {
        const food = this.add.text(this.truck.x - 80, this.truck.y - 70, ["🍔", "🍩", "🍕"][Math.floor(Math.random() * 3)], { fontSize: "20px" }).setOrigin(0.5).setDepth(45);
        const sy = food.y;
        this.tweens.add({
          targets: food,
          x: target.spr.x,
          duration: 500,
          onUpdate: (tw) => food.setY(sy + (target.spr.y - 30 - sy) * tw.progress - Math.sin(tw.progress * Math.PI) * 90),
          onComplete: () => {
            food.destroy();
            if (!target.dead) {
              this.pop(target.spr.x, target.spr.y - 50, "FUDGED", "#ffe08a", 12);
              this.damageFoe(target, 2);
            }
          },
        });
      }
      this.nextChz = now + 1500;
    }
    if (now >= this.nextBark) {
      this.bark();
      this.nextBark = now + 3500 + Math.random() * 4000;
    }
    // foes
    for (const f of this.foes) {
      if (f.dead) continue;
      if (f.kind === "spikes" || f.kind === "ramp") {
        f.spr.x -= dt * ROAD_SPEED * spd;
        const ahead = f.spr.x - this.truck.x;
        if (f.kind === "spikes" && ahead > 60 && ahead < 190 && this.jumpY === 0) this.autoJump(false);
        if (f.kind === "ramp" && ahead > 40 && ahead < 120 && this.jumpY === 0) this.autoJump(true);
        if (f.kind === "spikes" && Math.abs(ahead) < 90 && this.jumpY > -30 && !f.hit) {
          f.hit = true;
          this.hurtTruck(14, "STINGER!");
        }
        if (f.spr.x < -200) {
          f.dead = true;
          f.spr.destroy();
        }
        continue;
      }
      // drive up into position and weave; some ram you. Knockback shoves them about.
      const weave = f.kind === "unmarked" ? 60 : 40;
      f.spr.x += (f.tx + Math.sin(now / (f.kind === "unmarked" ? 450 : 700) + f.maxHp) * weave - f.spr.x) * Math.min(1, dt / (f.kind === "unmarked" ? 380 : 600));
      if (f.push) {
        const step = f.push * Math.min(1, dt / 60);
        f.spr.x += step;
        f.push -= step;
        if (Math.abs(f.push) < 0.3) f.push = 0;
      }
      if (f.kind !== "heli") f.spr.setAngle(Phaser.Math.Clamp(-f.push * 0.25, -8, 8));
      if (f.kind === "heli") {
        f.spr.y = f.ty + Math.sin(now / 400 + f.tx) * 18;
        f.spr.setAngle(Phaser.Math.Clamp(f.push * 0.3, -12, 12));
        f.light?.setPosition(f.spr.x, f.spr.y + 10).setAngle(Math.sin(now / 900 + f.tx) * 25);
      }
      f.siren?.setPosition(f.spr.x - 4, f.spr.y - f.spr.displayHeight * 0.75).setFillStyle(Math.floor(now / 150 + f.tx) % 2 ? 0xef4444 : 0x3b82f6);
      f.bar?.setPosition(f.spr.x, f.spr.y - f.spr.displayHeight * (f.kind === "heli" ? 0.6 : 0.95)).setSize(Math.max(1, 60 * (f.hp / f.maxHp)), 5);
      if ((f.kind === "cop" || f.kind === "unmarked") && f.spr.x > this.truck.x - 170 && !f.hit) {
        f.hit = true;
        this.hurtTruck(f.kind === "unmarked" ? 6 : 4, "RAMMED!");
        synth.play("car_hit");
        f.push -= 60;
        f.tx = Math.max(60, f.tx - 120);
      }
      if (now >= f.nextShot) {
        if (f.kind === "cop" && Math.random() < 0.2) {
          // spray me with mace
          this.maceUntil = now + 1100;
          this.pop(f.spr.x + 40, f.spr.y - 70, "MACE!", "#a3e635", 15);
          f.nextShot = now + 2800;
        } else if ((f.kind === "cop" && Math.random() < 0.3) || (f.kind === "unmarked" && Math.random() < 0.6)) {
          // ram!
          f.tx = this.truck.x - 150;
          f.hit = false;
          f.nextShot = now + (f.kind === "unmarked" ? 2200 : 3000);
          if (f.kind === "unmarked") synth.play("car_screech");
        } else {
          const n = f.kind === "swat" ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const sx = f.spr.x + (f.kind === "heli" ? 0 : 30);
            const sy = f.spr.y - (f.kind === "heli" ? -10 : 40);
            const a = Math.atan2(this.truck.y - 60 - sy, this.truck.x - sx) + (i - (n - 1) / 2) * 0.12;
            const big = f.kind === "tank";
            const b = this.add.circle(sx, sy, big ? 9 : 4, big ? 0xef4444 : 0x93c5fd).setDepth(40);
            if (!big) b.setStrokeStyle(2, 0x1e3a8a);
            this.bullets.push({ spr: b, vx: Math.cos(a) * (big ? 0.35 : 0.5), vy: Math.sin(a) * (big ? 0.35 : 0.5), mine: false, dmg: big ? 12 : f.kind === "heli" ? 3 : 2, life: 2600 });
            if (big) this.explode(sx + 20, sy - 10, false);
          }
          f.nextShot = now + (f.kind === "tank" ? 3600 : f.kind === "heli" ? 2200 : 3000) + Math.random() * 1000;
        }
      }
    }
    // bullets
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      b.spr.x += b.vx * dt;
      b.spr.y += b.vy * dt;
      b.life -= dt;
      // rockets that run out of fuel go off anyway
      if (b.rocket && b.life <= 0) {
        this.rocketBoom(b.spr.x, b.spr.y, b.dmg);
        b.spr.destroy();
        continue;
      }
      if (b.rocket && !this.lite) {
        // exhaust: a hot core and a grey trail
        const fl = this.add.circle(b.spr.x - b.vx * 18, b.spr.y - b.vy * 18, 5, 0xfb923c, 0.9).setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: fl, scale: 0.2, alpha: 0, duration: 120, onComplete: () => fl.destroy() });
        if (Math.random() < 0.7) {
          const puff = this.add.circle(b.spr.x - b.vx * 24, b.spr.y - b.vy * 24, 5, 0xd1d5db, 0.55).setDepth(40);
          this.tweens.add({ targets: puff, radius: 14, alpha: 0, x: puff.x - 30, y: puff.y - 6, duration: 500, onComplete: () => puff.destroy() });
        }
      }
      if (b.mine) {
        for (const f of this.foes) {
          if (f.dead || f.kind === "spikes" || f.kind === "ramp") continue;
          const hw = f.spr.displayWidth / 2;
          const top = f.spr.y - f.spr.displayHeight * (f.kind === "heli" ? 0.5 : 0.8);
          const bottom = f.spr.y + (f.kind === "heli" ? f.spr.displayHeight * 0.5 : f.spr.displayHeight * 0.2);
          if (b.spr.x > f.spr.x - hw && b.spr.x < f.spr.x + hw && b.spr.y > top && b.spr.y < bottom) {
            b.life = 0;
            if (b.rocket) {
              f.push += Math.sign(b.vx) * 40;
              this.rocketBoom(b.spr.x, b.spr.y, b.dmg);
            } else {
              // every round shoves it and flashes it
              f.push += Math.sign(b.vx) * (f.kind === "tank" ? 1 : 4);
              this.damageFoe(f, b.dmg);
              if (now >= this.nextHitSfx) {
                this.nextHitSfx = now + 90;
                synth.play("hit");
              }
              if (this.shotN % 2 === 0 && !this.lite) vfx(this, "vfx_hit", b.spr.x, b.spr.y, { scale: 0.7, depth: 42, add: true, angle: Math.random() * 360 });
              else {
                const sp = this.add.circle(b.spr.x, b.spr.y, 3, 0xfff7ae).setDepth(42);
                this.tweens.add({ targets: sp, radius: 9, alpha: 0, duration: 90, onComplete: () => sp.destroy() });
              }
            }
            break;
          }
        }
      } else if (Math.abs(b.spr.x - this.truck.x) < 110 && b.spr.y > this.truck.y - 110 && b.spr.y < this.truck.y + 10) {
        b.life = 0;
        this.hurtTruck(Math.max(1, Math.round(b.dmg * 0.6)));
      }
      if (b.spr.x < -100 || b.spr.x > 1060 || b.spr.y < -80 || b.spr.y > 620) b.life = 0;
      if (b.life <= 0) b.spr.destroy();
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.foes = this.foes.filter((f) => !f.dead);
    const left = Math.max(0, Math.ceil(LENGTH - this.t));
    const rocketReady = now >= this.nextRocket;
    this.hud.setText(`ROCKET ${rocketReady ? "READY" : "…"}   DRAWBRIDGE IN ${left}s   SLOPPY ${Math.floor(this.sloppy)}%${this.sloppy >= 100 ? " — R!" : ""}`);
  }
}
