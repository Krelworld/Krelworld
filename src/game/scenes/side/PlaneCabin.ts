import Phaser from "phaser";
import { PLANE_HOLE_X, PLANE_SECTIONS, type RoomDef } from "../../../data/dungeons";
import { synth } from "../../audio/Synth";
import { G } from "../../G";
import type { SideHost } from "./SideLevel";

/**
 * FLIGHT KR-069, side-on: the cabin seen in cross-section, and everything that goes wrong in it.
 * The aisle (room 0): economy → galley → business (with a hole in the hull) → first class → the cockpit door.
 * Seats full of screaming passengers, overhead bins spilling luggage, windows with the sky rushing past, seat-back
 * gunners, goons at the windows, crawling stewards, loose trolleys, turbulence and decompression.
 * The cockpit (room 1): the door comes off, the sky in the windscreen, and Captain Stanley (the boss is the scene's).
 * Lives alongside a DungeonScene, like SideLevel; all the art is PixelLab (pl_*, en_hijacker etc.).
 */
export interface PlaneHost extends SideHost {
  burst(x: number, y: number, color: number, n?: number): void;
  shake(ms: number, intensity: number): void;
}

export interface PlaneHooks {
  /** The exit door (its texture says whether it's open). */
  door: () => Phaser.GameObjects.Image | undefined;
  /** The room's been cleared (the exit's open). */
  cleared: () => boolean;
}

const WALL_K = 3; // the 320x180 PixelLab walls are drawn three times size (960x540)
const HOLES_X = [32, 96, 160, 224, 288];
const HOLE_Y = 95;
const SECTION_NAMES: [number, string, string][] = [
  [PLANE_SECTIONS.galley, "THE GALLEY", "The trolleys are loose."],
  [PLANE_SECTIONS.business, "BUSINESS CLASS", "Extra legroom. Extra hole."],
  [PLANE_SECTIONS.first, "FIRST CLASS", "Complimentary champagne. Complimentary gunfire."],
  [PLANE_SECTIONS.bulkhead - 400, "THE COCKPIT", "Breach the door. Captain Stanley's waiting."],
];
const PASSENGER_LINES = [
  "MIND THE DRINKS!", "I paid for extra legroom!", "Is this the Kreddle flight?", "AAAAAAAH!", "Not the face!", "Can I still get the chicken?",
  "I'm only going to Krezteua!", "My connecting flight!", "Is there a doctor on board?!", "Excuse me, that's MY armrest!", "Mummy!", "I want to speak to the captain!",
  "This is worse than Ryanair.", "Are you cabin crew?", "Brace! BRACE!", "I'm writing a review about this.",
];
const PASSENGERS = ["pl_pass_scream", "pl_pass_cower", "pl_pass_lady", "pl_pass_tourist", "pl_pass_child", "pl_pass_paper"];

type Pop = { x: number; seat: Phaser.GameObjects.Image; duck: Phaser.GameObjects.Image; goon: boolean; e: any; hp: number; pops: number; next: number; done: boolean; downAt: number };
type WinGoon = { x: number; y: number; fired: boolean; e: any; leaveAt: number };
type Crawler = { spr: Phaser.GameObjects.Sprite; hitAt: number; squashUntil: number };
type Cart = { spr: Phaser.GameObjects.Sprite; vx: number; hitAt: number; warn?: Phaser.GameObjects.Text };
type Talker = { x: number; y: number; said: number };

export class PlaneCabin {
  private cockpit: boolean;
  private sky: Phaser.GameObjects.TileSprite | null = null;
  private pops: Pop[] = [];
  private windows: { x: number; y: number }[] = [];
  private winGoons: WinGoon[] = [];
  private crawlers: Crawler[] = [];
  private crawlSpots: { x: number; fired: boolean }[] = [];
  private carts: Cart[] = [];
  private nextCart = 0;
  private nextBag = 0;
  private talkers: Talker[] = [];
  private nextTalk = 0;
  private signs: Phaser.GameObjects.Image[] = [];
  private lights: Phaser.GameObjects.Rectangle[] = [];
  private nextTurb = 0;
  private tilt = 0;
  private tiltUntil = 0;
  private sectionSeen = new Set<number>();
  private hole: { open: boolean; spr?: Phaser.GameObjects.Sprite; patch?: Phaser.GameObjects.TileSprite; nextTick: number; nextDebris: number; masks: Phaser.GameObjects.GameObject[] } = { open: false, nextTick: 0, nextDebris: 0, masks: [] };
  private doorArt: Phaser.GameObjects.Image | null = null;
  private doorTag: Phaser.GameObjects.Text | null = null;
  private t = 0;

  constructor(private sc: PlaneHost, private room: RoomDef, private hooks: PlaneHooks) {
    this.cockpit = !!room.boss;
  }

  private get calm() {
    return !!G.meta?.settings?.calmFlash;
  }

  private has(key: string) {
    return this.sc.textures.exists(key);
  }

  /** Looping animation for a PixelLab strip. */
  private anim(key: string, fps: number) {
    const ak = `${key}:loop`;
    if (!this.sc.anims.exists(ak) && this.has(key)) this.sc.anims.create({ key: ak, frames: this.sc.anims.generateFrameNumbers(key, {}), frameRate: fps, repeat: -1 });
    return ak;
  }

  // ------------------------------------------------------------------ building

  /** Platforms: stacked trolleys in the galley, piled luggage in economy, the bar in first class, a ledge in the cockpit. */
  platform(x: number, y: number, w: number) {
    const sc = this.sc;
    if (this.cockpit) {
      const g = sc.add.graphics().setDepth(4);
      g.fillStyle(0x1f2937, 1).fillRect(x - w / 2, y - 7, w, 14);
      g.fillStyle(0x4b5563, 1).fillRect(x - w / 2, y - 7, w, 4);
      g.fillStyle(0xef4444, 1).fillRect(x - w / 2, y - 9, w, 2);
      for (let dx = -w / 2 + 10; dx < w / 2; dx += 22) g.fillStyle(0x22c55e, 0.9).fillRect(x + dx, y - 1, 6, 3);
      return;
    }
    const gy = sc.groundY;
    if (x >= PLANE_SECTIONS.galley && x < PLANE_SECTIONS.business && this.has("pl_cart")) {
      // trolleys stacked to the height of the platform
      const h = gy - y;
      const n = Math.max(1, Math.round(h / 92));
      for (let i = 0; i < n; i++) sc.add.image(x, gy - i * (h / n), "pl_cart", 0).setOrigin(0.5, 1).setScale((w / 50) * 1.05, (h / n) / 58).setDepth(3.5);
    } else if (x >= PLANE_SECTIONS.first) {
      // the first-class bar: walnut and brass
      const g = sc.add.graphics().setDepth(3.5);
      g.fillStyle(0x3b1d0e, 1).fillRect(x - w / 2, y - 6, w, gy - y + 6);
      g.fillStyle(0x6b3a1f, 1).fillRect(x - w / 2 + 6, y + 10, w - 12, gy - y - 16);
      g.fillStyle(0xd4a017, 1).fillRect(x - w / 2, y - 8, w, 4);
      for (let dx = -w / 2 + 18; dx < w / 2 - 10; dx += 34) {
        g.fillStyle(0x16a34a, 1).fillRect(x + dx, y - 24, 6, 16);
        g.fillStyle(0xfef3c7, 1).fillRect(x + dx + 1, y - 28, 4, 4);
      }
    } else {
      // a pile of luggage
      const keys = ["pl_suitcase", "pl_duffel"].filter((k) => this.has(k));
      if (keys.length) {
        for (let dx = -w / 2 + 22; dx < w / 2; dx += 40) sc.add.image(x + dx, gy + 4, keys[Math.floor(Math.abs(dx)) % keys.length]).setOrigin(0.5, 1).setScale(1.5, (gy - y + 10) / 50).setDepth(3.5);
      } else sc.add.rectangle(x, y + (gy - y) / 2, w, gy - y, 0x374151).setDepth(3.5);
    }
    sc.add.rectangle(x, y - 6, w, 2, 0xfff1c1, 0.45).setDepth(4);
  }

  build() {
    if (this.cockpit) return this.buildCockpit();
    const sc = this.sc;
    const r = this.room;
    const gy = sc.groundY;
    // the sky, rushing past the windows
    if (this.has("pl_sky")) {
      this.sky = sc.add.tileSprite(0, 0, 960, 540, "pl_sky").setOrigin(0).setScrollFactor(0).setDepth(-15);
      this.sky.setTileScale(WALL_K);
    }
    // the cabin wall, section by section (holes punched for the windows)
    const S = PLANE_SECTIONS;
    const spans: [number, number, string, number?][] = [
      [0, S.galley, "pl_wall_econ"],
      [S.galley, S.business, "pl_wall_galley"],
      [S.business, S.first, "pl_wall_econ", 0xc7d2fe],
      [S.first, r.w, "pl_wall_first"],
    ];
    for (const [a, b, key, tint] of spans) {
      if (!this.has(key)) {
        sc.add.rectangle(a, 0, b - a, 540, 0xe7e2d3).setOrigin(0).setDepth(-10);
        continue;
      }
      const wall = sc.add.tileSprite(a, 0, b - a, 540, key).setOrigin(0).setDepth(-10).setTileScale(WALL_K);
      if (tint) wall.setTint(tint);
      if (key !== "pl_wall_galley") {
        const period = 640 * WALL_K;
        for (let off = 0; off < b - a; off += period) {
          for (const hx of HOLES_X) for (const cx of [hx, 639 - hx]) {
            const x = a + off + cx * WALL_K;
            if (x < a + 30 || x > b - 30) continue;
            this.windows.push({ x, y: HOLE_Y * WALL_K });
          }
        }
      }
    }
    for (const w of this.windows) {
      if (this.has("pl_window")) sc.add.image(w.x, w.y, "pl_window").setScale(2.6).setDepth(-9);
      // a little glare on the glass
      sc.add.rectangle(w.x - 10, w.y - 18, 4, 22, 0xffffff, 0.25).setAngle(20).setDepth(-8.9);
    }
    // curtains and bulkheads between the classes
    for (const x of [S.galley, S.business, S.first]) this.curtain(x);
    this.bulkhead(S.bulkhead);
    // the aisle carpet, with the floor path lights
    const carpetCol = (x: number) => (x >= S.first ? 0x7f1d1d : x >= S.galley && x < S.business ? 0x52525b : 0x1e3a8a);
    for (const [a, b] of [[0, S.galley], [S.galley, S.business], [S.business, S.first], [S.first, r.w]]) {
      sc.add.rectangle(a, gy, b - a, r.h - gy, carpetCol(a)).setOrigin(0).setDepth(2.1);
      const g = sc.add.graphics().setDepth(2.2);
      for (let x = a + 8; x < b; x += 24) g.fillStyle(0x000000, 0.18).fillRect(x, gy + 14, 12, 4).fillRect(x + 12, gy + 30, 12, 4);
      sc.add.rectangle(a, gy, b - a, 4, 0x000000, 0.55).setOrigin(0).setDepth(2.3);
    }
    for (let x = 30; x < r.w - 40; x += 44) this.lights.push(sc.add.rectangle(x, gy + 6, 14, 3, 0xfde68a, 0.4).setDepth(2.4));
    this.seats();
    this.ceiling();
    // section signs as you go through
    this.crawlSpots = [1650, 2550, 5350, 6600, 7100].map((x) => ({ x, fired: false }));
    // the cockpit door at the far end
    const door = this.hooks.door();
    if (door && this.has("pl_door")) {
      this.doorArt = sc.add.image(door.x, gy + 2, "pl_door").setOrigin(0.5, 1).setScale(2.4).setDepth(6.5);
      this.doorTag = sc.add.text(door.x, gy - 170, "CREW ONLY", { fontFamily: "Impact, sans-serif", fontSize: "14px", color: "#fca5a5", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(6.6);
    }
    this.nextTurb = sc.now() + 9000;
    this.nextCart = sc.now() + 4000;
    this.nextBag = sc.now() + 3000;
  }

  private curtain(x: number) {
    const sc = this.sc;
    const gy = this.sc.groundY;
    const g = sc.add.graphics().setDepth(-8);
    g.fillStyle(0x1f2937, 1).fillRect(x - 26, 0, 52, gy);
    g.fillStyle(0x374151, 1).fillRect(x - 20, 0, 8, gy);
    // the class curtain: heavy blue, pleated
    for (let i = 0; i < 5; i++) g.fillStyle(i % 2 ? 0x1e3a8a : 0x1d4ed8, 1).fillRect(x - 24 + i * 10, 140, 10, gy - 150);
    g.fillStyle(0xd4a017, 1).fillRect(x - 26, 134, 52, 6);
  }

  private bulkhead(x: number) {
    const sc = this.sc;
    const gy = this.sc.groundY;
    const g = sc.add.graphics().setDepth(-8);
    g.fillStyle(0x334155, 1).fillRect(x, 0, this.room.w - x, gy);
    g.fillStyle(0x1e293b, 1).fillRect(x, 0, 18, gy);
    for (let y = 30; y < gy; y += 60) g.fillStyle(0x475569, 1).fillRect(x + 30, y, this.room.w - x - 40, 4);
    sc.add.text(x + 160, 120, "⚠ FLIGHT DECK ⚠\nAUTHORISED CREW ONLY", { fontFamily: "Impact, sans-serif", fontSize: "16px", color: "#facc15", align: "center", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(-7.9);
  }

  /** Seat rows down the cabin (passengers in most of them), and the seat-back gunners hiding among them. */
  private seats() {
    const sc = this.sc;
    const gy = sc.groundY;
    const S = PLANE_SECTIONS;
    const popAt = [820, 1480, 2280, 3880, 4760, 5650, 6300, 7000];
    const isPop = (x: number, pitch: number) => popAt.some((p) => Math.abs(p - x) < pitch / 2);
    const row = (a: number, b: number, pitch: number, seatKey: string, scale: number, full: number) => {
      for (let x = a + pitch / 2; x < b - pitch / 3; x += pitch) {
        if (Math.abs(x - PLANE_HOLE_X) < 90) continue;
        const pop = isPop(x, pitch) && !this.pops.some((p) => Math.abs(p.x - x) < pitch);
        if (pop) {
          this.addPop(x, seatKey, scale);
          continue;
        }
        const seed = Math.abs(Math.sin(x * 12.9898) * 43758.5453) % 1;
        if (seatKey === "pl_seat_econ" && seed < full) {
          // a passenger in an economy seat (the sheet is the seat and the person in it)
          const key = PASSENGERS[Math.floor(seed * 97) % PASSENGERS.length];
          if (this.has(key)) {
            const p = sc.add.sprite(x, gy + 2, key, 0).setOrigin(0.5, 1).setScale(scale).setDepth(1.5);
            if (sc.textures.get(key).frameTotal > 2) p.play({ key: this.anim(key, 5 + Math.floor(seed * 4)), startFrame: Math.floor(seed * 4) });
            this.talkers.push({ x, y: gy - 120, said: 0 });
            continue;
          }
        }
        if (this.has(seatKey)) {
          // a big seat, with someone peeking over the back of it now and then
          if (seatKey !== "pl_seat_econ" && seed < full) {
            const key = PASSENGERS[Math.floor(seed * 97) % PASSENGERS.length];
            if (this.has(key)) {
              const p = sc.add.sprite(x + 6, gy + 2, key, 0).setOrigin(0.5, 1).setScale(scale * 0.9).setDepth(1.4);
              if (sc.textures.get(key).frameTotal > 2) p.play({ key: this.anim(key, 4), startFrame: Math.floor(seed * 4) });
              sc.tweens.add({ targets: p, y: gy + 26, yoyo: true, repeat: -1, hold: 1400 + seed * 1500, repeatDelay: 1200 + seed * 2000, duration: 260, ease: "Quad.inOut" });
              this.talkers.push({ x, y: gy - 120, said: 0 });
            }
          }
          sc.add.image(x, gy + 2, seatKey).setOrigin(0.5, 1).setScale(scale).setDepth(1.5);
        }
      }
    };
    row(0, S.galley, 118, "pl_seat_econ", 2, 0.78);
    row(S.business, S.first, 170, "pl_seat_biz", 2.2, 0.55);
    row(S.first, S.bulkhead - 40, 230, "pl_seat_first", 2.4, 0.45);
    // the galley: no seats, but its floor is all trays and spilled food
    if (this.has("pl_trays")) for (let x = S.galley + 160; x < S.business - 100; x += 260) sc.add.image(x, gy + 4, "pl_trays").setOrigin(0.5, 1).setScale(1.6).setDepth(2.5);
  }

  private addPop(x: number, seatKey: string, scale: number) {
    const sc = this.sc;
    const gy = sc.groundY;
    const goon = this.pops.length % 3 === 1;
    // the seat they're hiding behind is drawn in front of them (but behind you)
    const seat = sc.add.image(x, gy + 2, this.has(seatKey) ? seatKey : "pl_seat_econ").setOrigin(0.5, 1).setScale(scale).setDepth(360);
    const duckKey = goon ? "pl_goon_duck" : "pl_hijacker_duck";
    const duck = sc.add.image(x - 22, gy - 70, this.has(duckKey) ? duckKey : "pl_seat_econ").setScale(2).setDepth(350);
    // the top of a balaclava, bobbing behind the seat
    sc.tweens.add({ targets: duck, y: gy - 64, yoyo: true, repeat: -1, duration: 700 + Math.random() * 300, ease: "Sine.inOut" });
    this.pops.push({ x, seat, duck, goon, e: null, hp: 0, pops: 0, next: 0, done: false, downAt: 0 });
  }

  /** Overhead: the signs (they ping), and the dark fuselage ribs over the top of the picture. */
  private ceiling() {
    const sc = this.sc;
    const r = this.room;
    for (let x = 300; x < PLANE_SECTIONS.bulkhead - 100; x += 640) {
      const key = (x / 640) % 2 < 1 ? "pl_sign_belt" : "pl_sign_smoke";
      if (!this.has(key)) continue;
      this.signs.push(sc.add.image(x, 150, key).setScale(1.6).setDepth(-7).setAlpha(0.85));
    }
    // fuselage ribs in the foreground (a slow parallax over the top edge)
    const g = sc.add.graphics().setDepth(930).setScrollFactor(1.12, 1);
    for (let x = 0; x < r.w * 1.15; x += 520) {
      g.fillStyle(0x0f172a, 0.92).fillRect(x, 0, 30, 34);
      g.fillStyle(0x0f172a, 0.92).fillTriangle(x, 34, x + 30, 34, x + 15, 52);
      g.fillStyle(0x334155, 1).fillRect(x + 4, 0, 4, 30);
    }
    g.fillStyle(0x0f172a, 0.9).fillRect(0, 0, r.w * 1.15, 10);
  }

  private buildCockpit() {
    const sc = this.sc;
    // the sky behind the windscreen (the backdrop has it keyed out)
    if (this.has("pl_sky")) {
      this.sky = sc.add.tileSprite(0, 0, 960, 540, "pl_sky").setOrigin(0).setScrollFactor(0).setDepth(-15);
      this.sky.setTileScale(WALL_K * 1.3);
    }
    // the floor: dark plating
    const gy = sc.groundY;
    sc.add.rectangle(0, gy, this.room.w, this.room.h - gy, 0x1f2328).setOrigin(0).setDepth(2.1);
    sc.add.rectangle(0, gy, this.room.w, 4, 0x000000, 0.6).setOrigin(0).setDepth(2.3);
    // BREACH: the door comes in off its hinges
    const key = this.has("pl_door") ? "pl_door" : null;
    sc.cameras.main.flash(this.calm ? 0 : 220, 255, 240, 200);
    synth.play("explode");
    sc.shake(420, 0.018);
    if (key) {
      const d = sc.add.image(60, gy - 70, key).setScale(2.4).setDepth(700);
      sc.tweens.add({ targets: d, x: 420, y: gy - 20, angle: 200, duration: 650, ease: "Quad.out", onComplete: () => sc.tweens.add({ targets: d, alpha: 0, delay: 1800, duration: 500, onComplete: () => d.destroy() }) });
    }
    sc.burst(40, gy - 80, 0xfacc15, 18);
    const t = sc.add.text(480, 170, "BREACH!", { fontFamily: "Impact, sans-serif", fontSize: "56px", color: "#facc15", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setScrollFactor(0).setDepth(960);
    sc.tweens.add({ targets: t, scale: { from: 1.6, to: 1 }, duration: 260, ease: "Back.out" });
    sc.tweens.add({ targets: t, alpha: 0, delay: 1000, duration: 500, onComplete: () => t.destroy() });
    // red warning lights over the panel
    const lamp = sc.add.circle(350, 52, 26, 0xef4444, 0.25).setDepth(-9).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: lamp, alpha: 0.05, yoyo: true, repeat: -1, duration: this.calm ? 1400 : 600 });
  }

  // ------------------------------------------------------------------ every frame

  update(dt: number, busy: boolean) {
    const sc = this.sc;
    this.t += dt;
    const cam = sc.cameras.main;
    if (this.sky) this.sky.tilePositionX = (this.t * (this.cockpit ? 0.12 : 0.05) + cam.scrollX * 0.08) / this.sky.tileScaleX;
    this.reskin();
    if (this.cockpit) return;
    const now = sc.now();
    const p = sc.player;
    if (!p?.spr?.body) return;
    // the path lights chase towards the cockpit
    const v = cam.worldView;
    for (const l of this.lights) {
      if (l.x < v.x - 20 || l.x > v.right + 20) continue;
      l.setFillStyle(0xfde68a, Math.sin((l.x - this.t * 0.35) / 70) > 0.7 ? 0.95 : 0.3);
    }
    this.updateDoor();
    if (busy) return;
    this.sections(p.x);
    this.turbulence(now, dt);
    this.updatePops(now);
    this.updateWindows(now);
    this.updateCrawlers(now, dt);
    this.updateCarts(now, dt);
    this.updateBags(now);
    this.updateHole(now, dt);
    this.chatter(now);
  }

  private updateDoor() {
    const d = this.hooks.door();
    if (!this.doorArt || !d) return;
    if (this.hooks.cleared() && this.doorTag && this.doorTag.text !== "BREACH →") {
      this.doorTag.setText("BREACH →").setColor("#facc15");
      this.sc.tweens.add({ targets: this.doorTag, scale: 1.25, yoyo: true, repeat: -1, duration: 380 });
    }
  }

  private sections(x: number) {
    for (const [at, name, sub] of SECTION_NAMES) {
      if (x < at || this.sectionSeen.has(at)) continue;
      this.sectionSeen.add(at);
      const sc = this.sc;
      const t = sc.add.text(480, 150, name, { fontFamily: "Impact, sans-serif", fontSize: "34px", color: "#ffffff", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(955);
      const s = sc.add.text(480, 186, sub, { fontFamily: "sans-serif", fontSize: "14px", color: "#fde68a", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setScrollFactor(0).setDepth(955);
      sc.tweens.add({ targets: [t, s], alpha: 0, delay: 1700, duration: 600, onComplete: () => (t.destroy(), s.destroy()) });
      synth.play("ding");
    }
  }

  /** TURBULENCE: the signs ping, the cabin tilts, everything slides downhill (and a trolley usually comes with it). */
  private turbulence(now: number, dt: number) {
    const sc = this.sc;
    const cam = sc.cameras.main;
    if (now > this.nextTurb && !this.hooks.cleared()) {
      this.nextTurb = now + 15000 + Math.random() * 6000;
      this.tilt = Math.random() < 0.5 ? -1 : 1;
      this.tiltUntil = now + 2600;
      sc.toast("TURBULENCE", "The seatbelt sign is ON. Everything's sliding.");
      synth.play("ding");
      synth.play("thunder", 0.5);
      sc.shake(900, 0.008);
      for (const s of this.signs) sc.tweens.add({ targets: s, alpha: 1, scale: 1.9, yoyo: true, repeat: this.calm ? 0 : 2, duration: this.calm ? 600 : 180 });
      sc.tweens.add({ targets: cam, rotation: this.tilt * 0.045, duration: 500, ease: "Sine.out" });
      // a trolley breaks loose and comes down the slope
      this.nextCart = Math.min(this.nextCart, now + 400);
    }
    if (this.tilt && now > this.tiltUntil) {
      this.tilt = 0;
      sc.tweens.add({ targets: cam, rotation: 0, duration: 600, ease: "Sine.inOut" });
    }
    if (this.tilt) {
      // downhill is the way the floor's tipped (rotation +: the right-hand end is lower)
      const p = sc.player;
      const pb = p.spr.body as Phaser.Physics.Arcade.Body;
      if (pb.blocked.down || pb.touching.down) p.spr.x += this.tilt * dt * 0.09;
      for (const e of sc.enemies) if (!e.dead && e.walker) e.x += this.tilt * dt * 0.07;
    }
  }

  // ---- seat-back gunners: up, shoot, down again (shoot them while they're up; the seat takes the rest)

  private updatePops(now: number) {
    const sc = this.sc;
    const p = sc.player;
    const gy = sc.groundY;
    const done = this.hooks.cleared();
    for (const pp of this.pops) {
      if (pp.done) continue;
      if (pp.e) {
        if (pp.e.dead) {
          // got him
          pp.done = true;
          pp.e = null;
          continue;
        }
        if (now > pp.downAt) {
          // back down behind the seat, for now
          const e = pp.e;
          pp.hp = e.hp;
          pp.e = null;
          pp.next = now + 1500 + Math.random() * 900;
          this.vanish(e, gy - 70);
          pp.duck.setVisible(true);
          if (pp.pops >= 3) {
            pp.done = true;
            sc.tweens.add({ targets: pp.duck, alpha: 0, duration: 600 });
          }
        }
        continue;
      }
      const ahead = pp.x - p.x;
      if (done || ahead < -60 || ahead > 640 || now < pp.next) continue;
      // UP
      pp.pops++;
      pp.duck.setVisible(false);
      const e = sc.spawnEnemy(pp.goon ? "klerble_goon" : "hijacker_pop", pp.x - 18, gy - 150);
      if (!e) continue;
      if (pp.goon && sc.textures.exists("en_hijacker_pop")) {
        // a goon pops up the same way (no walking: he's wedged in)
        e.walker = false;
        (e.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true).setVelocity(0, 0);
        e.def = { ...e.def, behavior: "turret", projectile: { speed: 230, damage: 9, color: 0xf97316, rate: 1500 } };
      }
      if (pp.hp > 0) e.hp = pp.hp;
      e.setFlipX(true);
      e.y = gy - 100;
      sc.tweens.add({ targets: e, y: gy - 150, duration: 220, ease: "Back.out" });
      pp.e = e;
      pp.downAt = now + 2300 + Math.random() * 700;
      synth.play("telegraph", 0.6);
    }
  }

  /** Off the board without a death (ducked, or gone back out of the window). */
  private vanish(e: any, toY: number) {
    e.dead = true;
    e.hpBar?.destroy();
    e.disableBody?.(true, false);
    this.sc.tweens.add({ targets: e, y: toY, alpha: 0, duration: 200, onComplete: () => e.destroy() });
  }

  // ---- window goons: SMASH, a few shots in through the window, then back up the rope

  private updateWindows(now: number) {
    const sc = this.sc;
    const p = sc.player;
    // the first time you get near certain windows, someone's outside
    if (!this.winGoons.length) {
      const want = [1150, 2150, 4000, 5900, 6700];
      for (const x of want) {
        const w = this.windows.reduce((best, cur) => (Math.abs(cur.x - x) < Math.abs(best.x - x) ? cur : best), this.windows[0]);
        if (w) this.winGoons.push({ x: w.x, y: w.y, fired: false, e: null, leaveAt: 0 });
      }
    }
    for (const wg of this.winGoons) {
      if (!wg.fired && !this.hooks.cleared() && wg.x - p.x < 420 && wg.x - p.x > 120) {
        wg.fired = true;
        const e = sc.spawnEnemy("window_goon", wg.x, wg.y + 10);
        if (!e) continue;
        e.setFlipX(true);
        e.y = wg.y - 160;
        sc.tweens.add({ targets: e, y: wg.y + 10, duration: 320, ease: "Quad.out" });
        wg.e = e;
        wg.leaveAt = now + 4200;
        // the glass goes
        synth.play("smash");
        for (let i = 0; i < 12; i++) {
          const sh = sc.add.rectangle(wg.x + (Math.random() - 0.5) * 30, wg.y + (Math.random() - 0.5) * 40, 4 + Math.random() * 5, 3 + Math.random() * 4, 0xbae6fd, 0.9).setDepth(500);
          sc.tweens.add({ targets: sh, x: sh.x + (Math.random() - 0.5) * 120, y: sc.groundY - 4, angle: Math.random() * 360, duration: 500 + Math.random() * 300, ease: "Quad.in", onComplete: () => sc.tweens.add({ targets: sh, alpha: 0, delay: 1500, duration: 400, onComplete: () => sh.destroy() }) });
        }
        sc.floatText(wg.x, wg.y - 70, "SMASH!", "#bae6fd", 16);
      }
      if (wg.e && !wg.e.dead && now > wg.leaveAt) {
        this.vanish(wg.e, wg.y - 200);
        wg.e = null;
      }
    }
  }

  // ---- crawling stewards: under the line of fire, after your ankles. Jump them (or on them).

  private updateCrawlers(now: number, dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const gy = sc.groundY;
    const cam = sc.cameras.main;
    for (const cs of this.crawlSpots) {
      if (cs.fired || this.hooks.cleared() || p.x < cs.x - 700) continue;
      cs.fired = true;
      for (let i = 0; i < 2; i++) {
        const x = Math.min(cam.worldView.right + 60 + i * 150, this.room.w - 100);
        const spr = this.has("pl_steward") ? sc.add.sprite(x, gy + 2, "pl_steward", 0).setOrigin(0.5, 1).setScale(1.8).setFlipX(true).setDepth(455) : (sc.add.sprite(x, gy - 10, "en_hijacker", 0).setScale(1.5) as Phaser.GameObjects.Sprite);
        if (this.has("pl_steward")) spr.play(this.anim("pl_steward", 9));
        this.crawlers.push({ spr, hitAt: 0, squashUntil: 0 });
      }
      sc.toast("CABIN CREW, ON THE FLOOR", "They're under the gunfire, going for your ankles. Jump them. Or on them.");
    }
    const pb = p.spr.body as Phaser.Physics.Arcade.Body;
    for (const c of [...this.crawlers]) {
      const s = c.spr;
      if (now > c.squashUntil) {
        s.x += (s.x > p.x ? -1 : 1) * dt * 0.06;
        s.setFlipX(s.x > p.x);
        s.setScale(1.8);
      }
      const dx = Math.abs(s.x - p.x);
      const feet = pb.bottom;
      // landing on one: a stomp, and a bounce
      if (dx < 46 && pb.velocity.y > 60 && feet > gy - 70 && feet < gy - 18 && now > c.squashUntil) {
        c.squashUntil = now + 1600;
        s.setScale(2.1, 1.1);
        pb.setVelocityY(-560);
        sc.floatText(s.x, gy - 60, "STEPPED ON", "#fde68a", 14);
        synth.play("punch");
        continue;
      }
      if (dx < 34 && feet > gy - 22 && now > c.hitAt && now > c.squashUntil && !p.invulnerable?.(now)) {
        c.hitAt = now + 1100;
        sc.damagePlayer(7, { x: s.x, y: gy }, { label: "-7 (ANKLE GRAB)" });
        pb.setVelocity((p.x < s.x ? -1 : 1) * 320, -360);
        sc.floatText(s.x, gy - 60, ["SIR. YOUR SEAT.", "Please remain seated!", "Gotcha!", "Tickets, please!"][Math.floor(Math.random() * 4)], "#e5e7eb", 13);
      }
      // left well behind: gone
      if (s.x < cam.worldView.x - 300 || s.x > this.room.w - 60) {
        s.destroy();
        this.crawlers.splice(this.crawlers.indexOf(c), 1);
      }
    }
  }

  // ---- loose trolleys: a warning at the edge of the screen, then one comes down the aisle

  private updateCarts(now: number, dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const gy = sc.groundY;
    const cam = sc.cameras.main;
    const S = PLANE_SECTIONS;
    const inCartZone = (p.x > S.galley - 500 && p.x < S.business + 200) || (p.x > S.first - 200 && p.x < S.bulkhead - 300) || !!this.tilt;
    if (now > this.nextCart && inCartZone && !this.hooks.cleared() && this.carts.length < 2) {
      this.nextCart = now + 5200 + Math.random() * 2600;
      const fromLeft = this.tilt > 0;
      const x0 = fromLeft ? cam.worldView.x - 80 : cam.worldView.right + 80;
      const vx = (fromLeft ? 1 : -1) * (280 + Math.random() * 60);
      const warn = sc.add.text(fromLeft ? 100 : 860, 300, fromLeft ? "TROLLEY! ⟶" : "⟵ TROLLEY!", { fontFamily: "Impact, sans-serif", fontSize: "26px", color: "#f87171", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setScrollFactor(0).setDepth(958);
      sc.tweens.add({ targets: warn, alpha: 0.3, yoyo: true, repeat: -1, duration: this.calm ? 500 : 160 });
      synth.play("telegraph");
      sc.time.delayedCall(950, () => {
        warn.destroy();
        if (!sc.sys.isActive() && !sc.sys.isPaused()) return;
        const spr = sc.add.sprite(x0, gy + 2, this.has("pl_cart") ? "pl_cart" : "en_trolley", 0).setOrigin(0.5, 1).setScale(1.7).setDepth(458).setFlipX(vx > 0);
        if (this.has("pl_cart")) spr.play(this.anim("pl_cart", 14));
        this.carts.push({ spr, vx, hitAt: 0 });
      });
    }
    const pb = p.spr.body as Phaser.Physics.Arcade.Body;
    for (const c of [...this.carts]) {
      c.spr.x += (c.vx * dt) / 1000;
      c.spr.y = gy + 2 - Math.abs(Math.sin(this.t / 60)) * 2;
      if (Math.abs(c.spr.x - p.x) < 44 && pb.bottom > gy - 70 && now > c.hitAt && !p.invulnerable?.(now)) {
        c.hitAt = now + 900;
        sc.damagePlayer(12, { x: c.spr.x, y: gy }, { unblockable: true, label: "-12 (TROLLEY)" });
        pb.setVelocity(Math.sign(c.vx) * 380, -420);
        synth.play("hit");
      }
      for (const e of sc.enemies) if (!e.dead && !e.isBoss && e.walker && Math.abs(e.x - c.spr.x) < 40 && e.y > gy - 90) sc.damageEnemy(e, 80, { label: "TROLLEYED", knock: 300, angle: c.vx > 0 ? 0 : Math.PI });
      if (c.spr.x < cam.worldView.x - 200 || c.spr.x > cam.worldView.right + 200) {
        c.spr.destroy();
        this.carts.splice(this.carts.indexOf(c), 1);
      }
    }
  }

  // ---- overhead bins: a rattle and a shadow, then a suitcase

  private updateBags(now: number) {
    const sc = this.sc;
    const p = sc.player;
    const gy = sc.groundY;
    const S = PLANE_SECTIONS;
    if (now < this.nextBag || this.hooks.cleared()) return;
    const inBins = (p.x < S.galley - 100) || (p.x > S.business && p.x < S.bulkhead - 200);
    if (!inBins) return;
    this.nextBag = now + 2600 + Math.random() * 1800;
    const x = Phaser.Math.Clamp(p.x + 70 + Math.random() * 300, 60, this.room.w - 200);
    // the bin springs open (PixelLab: the lid flaps, the bag shifts) and rattles
    const binKey = this.has("pl_bin") ? "pl_bin" : this.has("pl_bin_open") ? "pl_bin_open" : "pl_suitcase";
    const bin = sc.add.sprite(x, 100, binKey, 0).setScale(2, 0.4).setDepth(-6);
    if (binKey === "pl_bin") {
      if (!sc.anims.exists("pl_bin:open")) sc.anims.create({ key: "pl_bin:open", frames: sc.anims.generateFrameNumbers("pl_bin", {}), frameRate: 10, repeat: 0 });
      bin.play("pl_bin:open");
    }
    sc.tweens.add({ targets: bin, scaleY: 2, duration: 160, ease: "Back.out" });
    sc.tweens.add({ targets: bin, angle: { from: -3, to: 3 }, yoyo: true, repeat: 3, duration: 70 });
    const shadow = sc.add.ellipse(x, gy - 2, 70, 10, 0x000000, 0.15).setDepth(2.6);
    sc.tweens.add({ targets: shadow, scaleX: 1.2, alpha: 0.5, duration: 700 });
    synth.play("door", 0.5);
    sc.time.delayedCall(720, () => {
      if (!bin.active) return;
      const key = Math.random() < 0.5 ? "pl_suitcase" : "pl_duffel";
      const bag = sc.add.image(x, 120, this.has(key) ? key : "pl_bin_open").setScale(1.7).setDepth(457);
      sc.tweens.add({ targets: bag, y: gy - 30, angle: (Math.random() - 0.5) * 120, duration: 340, ease: "Quad.in", onComplete: () => {
        shadow.destroy();
        const pp = sc.player;
        const pb = pp.spr.body as Phaser.Physics.Arcade.Body;
        if (Math.abs(pp.x - x) < 46 && pb.bottom > gy - 160 && !pp.invulnerable?.(sc.now())) sc.damagePlayer(10, { x, y: gy - 120 }, { unblockable: true, label: "-10 (CARRY-ON)" });
        for (const e of sc.enemies) if (!e.dead && !e.isBoss && Math.abs(e.x - x) < 50 && e.y > gy - 160) sc.damageEnemy(e, 45, { label: "BAGGAGE", knock: 80 });
        synth.play("punch_big", 0.6);
        sc.tweens.add({ targets: bag, y: gy - 22, angle: 0, duration: 260, ease: "Bounce.out" });
        sc.tweens.add({ targets: bag, alpha: 0, delay: 2200, duration: 500, onComplete: () => bag.destroy() });
      } });
      sc.tweens.add({ targets: bin, alpha: 0, delay: 900, duration: 400, onComplete: () => bin.destroy() });
    });
  }

  // ---- the hole in the hull: it opens the first time you reach business class, then pulls at everything near it

  private updateHole(now: number, dt: number) {
    const sc = this.sc;
    const p = sc.player;
    const gy = sc.groundY;
    const hy = HOLE_Y * WALL_K;
    const h = this.hole;
    if (!h.open) {
      if (p.x < PLANE_SECTIONS.business + 120) return;
      h.open = true;
      // BANG
      synth.play("explode");
      synth.play("alarm");
      sc.shake(700, 0.02);
      sc.cameras.main.flash(this.calm ? 0 : 160, 255, 255, 255);
      if (this.has("pl_sky")) {
        // the real sky through the hole
        h.patch = sc.add.tileSprite(PLANE_HOLE_X, hy, 150, 170, "pl_sky").setDepth(-8.5).setTileScale(2);
        const m = sc.make.graphics({}, false).fillStyle(0xffffff).fillEllipse(PLANE_HOLE_X, hy, 120, 150);
        h.patch.setMask(m.createGeometryMask());
      }
      if (this.has("pl_hole")) {
        h.spr = sc.add.sprite(PLANE_HOLE_X, hy, "pl_hole", 0).setScale(3).setDepth(-8);
        h.spr.play(this.anim("pl_hole", 8));
        // punch the black out of the middle so the sky shows
        h.spr.setAlpha(0.95);
      }
      sc.toast("DECOMPRESSION", "There's a hole in the plane. It's pulling. Keep moving.");
      // the masks come down
      for (let x = PLANE_SECTIONS.business + 60; x < PLANE_SECTIONS.first - 40; x += 110) {
        if (!this.has("pl_mask")) break;
        const m = sc.add.sprite(x, 60, "pl_mask", 0).setOrigin(0.5, 0).setScale(1.7).setDepth(-5);
        sc.tweens.add({ targets: m, y: 140, duration: 500, delay: Math.random() * 300, ease: "Bounce.out" });
        m.play({ key: this.anim("pl_mask", 7), startFrame: Math.floor(Math.random() * 6) });
        // they all lean towards the hole
        m.setAngle(x < PLANE_HOLE_X ? -14 : 14);
        h.masks.push(m);
      }
      return;
    }
    if (h.patch) h.patch.tilePositionX += dt * 0.4;
    const dx = PLANE_HOLE_X - p.x;
    const range = 620;
    if (Math.abs(dx) < range && !this.hooks.cleared()) {
      // pulled towards it: harder the closer you get, never faster than you can run
      const k = 1 - Math.abs(dx) / range;
      p.spr.x += Math.sign(dx) * dt * (0.04 + 0.11 * k);
      const pb = p.spr.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(dx) < 140 && pb.velocity.y > -200) pb.velocity.y -= dt * 0.9 * k;
      if (Math.abs(dx) < 46 && now > h.nextTick) {
        h.nextTick = now + 450;
        sc.damagePlayer(6, { x: PLANE_HOLE_X, y: hy }, { unblockable: true, label: "-6 (HULL BREACH)" });
      }
      // debris streams in
      if (now > h.nextDebris) {
        h.nextDebris = now + 120;
        const side = Math.random() < 0.5 ? -1 : 1;
        const d = sc.add.rectangle(PLANE_HOLE_X + side * (200 + Math.random() * 300), gy - Math.random() * 300, 6 + Math.random() * 8, 4 + Math.random() * 6, [0xf8fafc, 0xfde68a, 0x93c5fd, 0xfca5a5][Math.floor(Math.random() * 4)]).setDepth(-7);
        sc.tweens.add({ targets: d, x: PLANE_HOLE_X, y: hy, angle: 400, scale: 0.2, duration: 500 + Math.random() * 300, ease: "Quad.in", onComplete: () => d.destroy() });
      }
    }
    // and anyone else near it goes out of it
    for (const e of sc.enemies) {
      if (e.dead || e.isBoss) continue;
      const ex = PLANE_HOLE_X - e.x;
      if (Math.abs(ex) > range) continue;
      const k = 1 - Math.abs(ex) / range;
      if (e.walker) e.x += Math.sign(ex) * dt * (0.06 + 0.16 * k);
      if (Math.abs(ex) < 50) {
        const vic = e;
        sc.damageEnemy(vic, 99999, { noWonk: true, label: "SUCKED OUT!" });
        const ghost = sc.add.image(vic.x, vic.y, vic.texture.key, vic.frame.name).setScale(2).setDepth(-7.5);
        sc.tweens.add({ targets: ghost, x: PLANE_HOLE_X, y: hy, scale: 0.1, angle: 720, duration: 500, ease: "Quad.in", onComplete: () => ghost.destroy() });
      }
    }
  }

  /** Captain Stanley's bandits (his minions, and any old-style bandit) are drawn as the side-on cabin crew and goons here. */
  private reskin() {
    for (const e of this.sc.enemies) {
      if (e.dead || e.plSkinned || (e.def.id !== "bandit" && e.def.id !== "bandit_gunner")) continue;
      e.plSkinned = true;
      const key = e.def.id === "bandit" ? "en_klerble_goon" : "en_hijacker";
      if (!this.has(key)) continue;
      const sx = e.scaleX / ((e.texture.customData?.hd as number | undefined) ?? 1);
      e.setTexture(key, 0);
      e.setScale(sx);
      const fw = e.frame.width;
      const r = e.def.size * 0.4 * (fw / e.def.size);
      (e.body as Phaser.Physics.Arcade.Body).setCircle(r, fw / 2 - r, e.frame.height / 2 - r);
    }
  }

  // ---- the passengers have opinions

  private chatter(now: number) {
    if (now < this.nextTalk) return;
    this.nextTalk = now + 1800 + Math.random() * 1600;
    const sc = this.sc;
    const p = sc.player;
    const near = this.talkers.filter((t) => Math.abs(t.x - p.x) < 260 && now - t.said > 9000);
    if (!near.length) return;
    const t = near[Math.floor(Math.random() * near.length)];
    t.said = now;
    sc.floatText(t.x, t.y, PASSENGER_LINES[Math.floor(Math.random() * PASSENGER_LINES.length)], "#ffffff", 12);
  }

  destroy() {
    const cam = this.sc.cameras.main;
    cam.setRotation(0);
    for (const c of this.crawlers) c.spr.destroy();
    for (const c of this.carts) c.spr.destroy();
    this.crawlers = [];
    this.carts = [];
  }
}
