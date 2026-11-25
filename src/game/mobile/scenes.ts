// PHONE MODE, stage 3 wave 2: the special scenes by touch (phones only; a laptop never loads this file).
//
//   Night of Freedom (DriveScene): the finger is the crosshair. Hold a finger on a car to shoot it (the aim is pulled
//     onto a car near the finger: "normal" aim assist; "strong" is the game's own auto-aim, "off" the bare finger);
//     ROCKET under the right thumb (with no finger aiming it goes at the biggest thing on screen); SLOPPY appears
//     above it when it is full. The drawbridge's mash is a tap anywhere (the game's own), its SKIP a pill left of II.
//   Beep Beep (BeepBeepScene): drag left / right on the left to steer (the phone's "x" stick, as in the side rooms);
//     your foot is down all the time (phone assist); BOOST (hold), BRAKE (hold) and HORN (tap) under the right thumb.
//   The finale between its fights: the PAUSED card offers SKIP SCENE (the laptop's Esc there).
//   The Crobley advert's "TAB: skip advert": a SKIP ADVERT pill. The 3D epilogue's tiny "skip ▶▶": a 44 px pill.
//   The telly's subtitles: a long line is paged two lines at a time at reading size, over the line's own time (P5).
//   The cannon's how-to line and the narrator's how-to-play lines here in touch words (narrator / UI lines only).
//
// It drives the game from outside: the layer's controls, the game's own keys (Phaser Key state, as a keyboard would
// set it), and two guarded hooks (boot.ts PhoneHooks.gunAim, .wheelTouch).
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { addSceneRule, SCENE_RULES, type ModeDecision, type SceneRule } from "./modes";
import { registerModeController, type TouchControl, type TouchLayer } from "./touchLayer";
import { phoneHooks, setPhoneHooks } from "./boot";
import { phoneSettings } from "./settings";
import { NARRATOR_TIPS, touchWording } from "./wording";
import { cueSeen, markCue } from "./cues";
import { setCardPause } from "./observe";
import type { Shell } from "./shell";
import {
  fingerAim,
  gunScheme,
  nearestByX,
  aimPointOf,
  pageLines,
  pageTimes,
  rocketTarget,
  SCENE_NARRATOR_TIPS,
  SCENE_UI_WORDING,
  steerFromStick,
  subtitleMs,
  type GunFoe,
  type Pt,
} from "./scenesLogic";

type Bag = Record<string, any>;

/** The two lines a TV subtitle page holds at reading size. */
export const SUB_LINES = 2;

const CSS = `
.ksc-cue{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:40;
 pointer-events:none;background:rgba(10,6,20,.82);color:#fff;font:700 15px/1.25 system-ui,sans-serif;padding:9px 16px;border-radius:22px;
 border:2px solid rgba(255,210,63,.75);white-space:nowrap;opacity:0;transition:opacity .35s}
.ksc-cue.on{opacity:1}
.kt-btn.ksc-wait .kt-face{opacity:.45}
.kt-btn.ksc-hot .kt-face{border-color:#a3e635;box-shadow:0 0 14px rgba(163,230,53,.75)}
.ksc-skip3d{font:700 16px/1 system-ui,sans-serif!important;color:#fff!important;background:rgba(0,0,0,.72)!important;padding:14px 18px!important;
 border-radius:24px!important;top:calc(env(safe-area-inset-top,0px) + 8px)!important;right:calc(env(safe-area-inset-right,0px) + 12px)!important;
 min-height:44px;box-sizing:border-box;touch-action:manipulation}
`;

// ------------------------------------------------------------------ helpers

/** A Phaser Key held / let go as the keyboard would (isDown, the JustDown edge). */
export function holdKey(k: Bag | undefined, on: boolean) {
  if (!k) return;
  if (on && !k.isDown) {
    k.isDown = true;
    k.isUp = false;
    k._justDown = true;
    k._justUp = false;
    k.timeDown = performance.now();
  } else if (!on && k.isDown) {
    k.isDown = false;
    k.isUp = true;
    k._justUp = true;
    k._justDown = false;
    k.timeUp = performance.now();
  }
}

/** One press of a key (its JustDown edge), as a key tap. */
function tapKey(k: Bag | undefined) {
  if (!k) return;
  k._justDown = true;
}

function live(game: Phaser.Game, key: string): Bag | null {
  try {
    const sc = game.scene.getScene(key) as unknown as Bag | null;
    return sc && sc.sys?.settings?.status === Phaser.Scenes.RUNNING ? sc : null;
  } catch {
    return null;
  }
}

/** The left edge of the layer's II in game px (or the game's right edge when it isn't up). */
function pauseLeftGame(game: Phaser.Game, layer: TouchLayer): number {
  const p = layer.control("pause");
  const cb = game.scale.canvasBounds;
  if (!p || !p.shown || !cb.width) return 960;
  const r = p.el.getBoundingClientRect();
  return Math.min(960, ((r.left - cb.x) * 960) / cb.width);
}

/** Game px for `css` CSS px at the canvas's scale now. */
function gpx(game: Phaser.Game, css: number): number {
  const cb = game.scale.canvasBounds;
  return cb.width ? (css * 960) / cb.width : css / 0.72;
}

/** A right-aligned HUD Text at the top right moved clear of the II (it sat under it). */
function clearOfPause(game: Phaser.Game, layer: TouchLayer, texts: (Bag | undefined)[], home: number) {
  const left = pauseLeftGame(game, layer);
  const x = left < 960 ? Math.min(home, left - gpx(game, 8)) : home;
  for (const t of texts) if (t?.active && t.x !== x) t.setX(x);
}

/** A canvas text made into a phone pill: 16 CSS px words, 44 CSS px tall. */
function pill(game: Phaser.Game, t: Bag, text: string) {
  const fs = gpx(game, 16);
  const pad = Math.max(4, Math.ceil((gpx(game, 44) - fs * 1.25) / 2));
  t.setText(text).setFontSize(fs).setColor("#ffffff").setBackgroundColor("#000000cc").setPadding(Math.round(pad * 1.4), pad, Math.round(pad * 1.4), pad);
  // (the font's own line height varies: make sure the drawn pill is at least 44 CSS px tall)
  const short = gpx(game, 45) - (t.height ?? 0);
  if (short > 0) t.setPadding(Math.round(pad * 1.4), pad + Math.ceil(short / 2), Math.round(pad * 1.4), pad + Math.ceil(short / 2));
}

// ------------------------------------------------------------------ Night of Freedom

interface DriveLike extends Bag {
  running: boolean;
  ended: boolean;
  box: { active: boolean };
  foes: { kind: string; dead: boolean; spr: { x: number; y: number } }[];
  truck: { x: number; y: number };
  gun: { x: number; y: number };
  sloppy: number;
  fireRocket(): void;
  sloppySurprise(): void;
  db: Bag | null;
}

const foeIds = new WeakMap<object, number>();
let nextFoeId = 1;
function foeId(o: object): number {
  let id = foeIds.get(o);
  if (!id) {
    id = nextFoeId++;
    foeIds.set(o, id);
  }
  return id;
}

/** The foes the gun can shoot now (as the game picks them: alive, not a spike strip or a ramp), on screen. */
function gunFoes(sc: DriveLike): GunFoe[] {
  const out: GunFoe[] = [];
  for (const f of sc.foes ?? []) if (!f.dead && f.kind !== "spikes" && f.kind !== "ramp" && f.spr) out.push({ id: foeId(f), x: f.spr.x, y: f.spr.y, kind: f.kind });
  return out;
}

class Gunner {
  lock: number | null = null;
  last: Pt | null = null;
  /** ROCKET with no finger aiming: the gun swings onto this one, and the rocket goes the frame after. */
  rocket: { id: number; frame: number } | null = null;
  fingerDown = false;
  locked = false;
  shots = 0;
  private g: Phaser.GameObjects.Graphics | null = null;
  private cueEl: HTMLDivElement | null = null;
  private cueUntil = 0;
  rocketC: TouchControl | null = null;
  sloppyC: TouchControl | null = null;

  constructor(private game: Phaser.Game, private layer: TouchLayer) {}

  /** The hook in DriveScene's update: where the gun aims this frame. */
  aim(sc: DriveLike, ptr: { worldX: number; worldY: number; isDown: boolean; wasTouch: boolean }): Pt {
    const foes = gunFoes(sc);
    const gun = { x: sc.truck.x + sc.gun.x, y: sc.truck.y + sc.gun.y };
    if (this.rocket) {
      const f = foes.find((x) => x.id === this.rocket!.id);
      if (f) return (this.last = aimPointOf(f));
      this.rocket = null;
    }
    const scheme = gunScheme(phoneSettings().aimAssist);
    this.fingerDown = ptr.isDown && ptr.wasTouch;
    this.locked = false;
    if (scheme.auto) {
      const t = nearestByX(foes, gun.x);
      if (t) this.last = aimPointOf(t);
      this.locked = !!t;
    } else if (this.fingerDown) {
      const r = fingerAim({ x: ptr.worldX, y: ptr.worldY }, foes, scheme.radius, this.lock);
      this.lock = r.lock;
      this.locked = r.lock !== null;
      this.last = r.at;
    } else this.lock = null;
    return this.last ?? { x: gun.x + 300, y: gun.y };
  }

  onRocket() {
    const sc = live(this.game, "Drive") as DriveLike | null;
    if (!sc || !sc.running || sc.ended || sc.box?.active) return;
    // a finger aiming: the rocket goes where it aims; else at the biggest thing on screen (one frame to swing round)
    const ptr = sc.input?.activePointer;
    if (ptr?.isDown && ptr.wasTouch) return void sc.fireRocket();
    const gun = { x: sc.truck.x + sc.gun.x, y: sc.truck.y + sc.gun.y };
    const t = rocketTarget(gunFoes(sc), gun);
    if (!t) return void sc.fireRocket();
    this.rocket = { id: t.id, frame: this.game.loop.frame };
  }

  frame(sc: DriveLike | null, d: ModeDecision) {
    const on = !!sc && !!d.gunner;
    this.rocketC?.show(on, true);
    this.sloppyC?.show(on && (sc?.sloppy ?? 0) >= 100, true);
    if (!sc) return;
    // the rocket the frame after the gun swung onto its target
    if (this.rocket && this.game.loop.frame > this.rocket.frame + 1) {
      this.rocket = null;
      sc.fireRocket();
    }
    // the crosshair where the finger aims (red and boxed when it has pulled onto a car)
    if (!this.g || !this.g.active || this.g.scene !== (sc as unknown as Phaser.Scene)) this.g = (sc as unknown as Phaser.Scene).add.graphics().setDepth(46);
    const g = this.g;
    g.clear();
    if (on && this.fingerDown && this.last && !gunScheme(phoneSettings().aimAssist).auto) {
      const { x, y } = this.last;
      const col = this.locked ? 0xff4d4d : 0xffffff;
      g.lineStyle(3, col, 0.9).strokeCircle(x, y, 20).lineBetween(x - 30, y, x - 11, y).lineBetween(x + 11, y, x + 30, y).lineBetween(x, y - 30, x, y - 11).lineBetween(x, y + 11, x, y + 30);
      if (this.locked) g.lineStyle(2, col, 0.7).strokeRect(x - 34, y - 34, 68, 68);
    }
    // the first time on this phone: one line, until the gun has been fired with a finger
    if (on && !cueSeen("gunner")) {
      if (this.fingerDown) {
        markCue("gunner");
        this.cue(false);
      } else if (!this.cueUntil) {
        this.cueUntil = performance.now() + 7000;
        this.cue(true, gunScheme(phoneSettings().aimAssist).auto ? "Hold a finger anywhere to shoot · ROCKET for the big stuff" : "Hold a finger on a car to shoot it · ROCKET for the big stuff");
      }
    }
    if (this.cueUntil && performance.now() > this.cueUntil) {
      this.cueUntil = -1;
      this.cue(false);
    }
  }

  cue(on: boolean, text = "") {
    if (!this.cueEl) {
      this.cueEl = document.createElement("div");
      this.cueEl.className = "ksc-cue";
      this.layer.root.appendChild(this.cueEl);
    }
    if (text) this.cueEl.textContent = text;
    this.cueEl.classList.toggle("on", on);
  }

  leave() {
    this.rocket = null;
    this.lock = null;
    this.fingerDown = false;
    this.cue(false);
    if (this.cueUntil > 0) this.cueUntil = 0;
    try {
      this.g?.clear();
    } catch {
      /* scene gone */
    }
  }
}

/** The Drive scene as it is built: its canvas ROCKET / SLOPPY hidden (the phone's are bigger and multi-touch). */
function onDriveCreate(sc: Bag) {
  for (const o of sc.children.list as Bag[]) {
    if (o.depth === 450 && o.type === "Arc" && Math.round(o.y) === 470) o.setVisible(false).disableInteractive();
    if (o.depth === 451 && o.type === "Text" && /^(?:ROCKET|SLOPPY)$/.test(o.text)) o.setVisible(false);
  }
}

// ------------------------------------------------------------------ Beep Beep

interface BeepLike extends Bag {
  running: boolean;
  ended: boolean;
  box: { active: boolean };
  keys: Record<string, Bag>;
  boost: number;
  boosting: boolean;
  hornReady: number;
}

class Pedals {
  boost: TouchControl | null = null;
  brake: TouchControl | null = null;
  horn: TouchControl | null = null;
  boostHeld = false;
  brakeHeld = false;
  private steer = 0;

  driving(sc: BeepLike | null): boolean {
    return !!sc && sc.running && !sc.ended && !sc.box?.active;
  }

  frame(sc: BeepLike | null, d: ModeDecision) {
    const on = !!sc && !!d.pedals;
    for (const c of [this.boost, this.brake, this.horn]) c?.show(on, true);
    if (!sc?.keys) return;
    const k = sc.keys;
    if (!on) return this.letGo(sc);
    this.steer = steerFromStick(TOUCH.mx);
    holdKey(k.A, this.steer < 0);
    holdKey(k.D, this.steer > 0);
    // the foot's down all the time on a phone (BRAKE beats it, as S beats W on a laptop)
    holdKey(k.W, true);
    holdKey(k.S, this.brakeHeld);
    holdKey(k.SHIFT, this.boostHeld);
    // BOOST can't be lit until the tank has refilled a bit (the game's rule): shown dimmed
    this.boost?.el.classList.toggle("ksc-wait", !sc.boosting && sc.boost < 25);
    this.horn?.el.classList.toggle("ksc-wait", sc.time?.now <= sc.hornReady);
  }

  honk(sc: BeepLike | null) {
    if (this.driving(sc)) tapKey(sc!.keys?.H);
  }

  letGo(sc: BeepLike | null) {
    this.steer = 0;
    const k = sc?.keys;
    if (!k) return;
    for (const n of ["A", "D", "W", "S", "SHIFT"]) holdKey(k[n], false);
  }
}

// ------------------------------------------------------------------ Kreddle's raid and rout

/** The raid or the rout running in Kreddle (not mid-script), or null. */
function fightIn(game: Phaser.Game): Bag | null {
  const k = live(game, "Kreddle");
  const f = (k?.raid ?? k?.rout) as Bag | null | undefined;
  return f && !f.busy ? f : null;
}

/**
 * The raid's / rout's FIRE: the game draws a canvas button on touch screens (its own touchFire, let go when the thumb
 * slides off it). On a phone it is a layer control (held by touch id, under the right thumb, the stick free to move at
 * the same time) that holds the game's own TOUCH.attack; the canvas one is hidden.
 */
class RaidFire {
  c: TouchControl | null = null;
  held = false;

  frame(game: Phaser.Game, layer: TouchLayer, d: ModeDecision) {
    const f = d.mode === "walk" ? fightIn(game) : null;
    if (!f) {
      if (this.c) this.leave(layer);
      return;
    }
    if (!this.c)
      this.c = layer.addControl({
        id: "sc-raidfire",
        slot: "prime",
        className: "kt-fire",
        label: "FIRE",
        haptic: "press",
        onDown: () => {
          this.held = true;
          TOUCH.attack = true;
        },
        onUp: () => {
          this.held = false;
          TOUCH.attack = false;
        },
      });
    // (ACTION has the corner when something can be used: FIRE steps left of it)
    this.c.setSlot(layer.control("action")?.shown ? "left" : "prime");
    this.c.show(true, true);
    const btn = f.fireBtn as Bag | undefined;
    if (btn?.visible) {
      btn.setVisible(false).disableInteractive();
      const sc = btn.scene as Bag;
      for (const o of (sc?.children?.list ?? []) as Bag[]) if (o.type === "Text" && o.text === "🔥\nFIRE" && Math.round(o.x) === Math.round(btn.x)) o.setVisible(false);
    }
  }

  leave(layer: TouchLayer) {
    if (this.held) TOUCH.attack = false;
    this.held = false;
    layer.removeControl("sc-raidfire");
    this.c = null;
  }
}

/** The raid's / rout's aim on a phone: the game's own touch aim (the nearest target, else where you walk). */
function raidAim(scene: Bag): number | null {
  if (scene?.sys?.settings?.key !== "Kreddle") return null;
  const f = (scene.raid ?? scene.rout) as Bag | null;
  const c = f?.controls as Bag | undefined;
  if (!c) return null;
  const auto = phoneSettings().aimAssist !== "off" ? (c.autoAim as number | null) : null;
  return auto ?? (c.lastMoveAngle as number) ?? 0;
}

// ------------------------------------------------------------------ the telly's subtitles (P5)

type PagedText = Phaser.GameObjects.Text & { __mfPaged?: boolean; __mfPages?: { timer: Phaser.Time.TimerEvent | null } };

/**
 * The telly's subtitle Text pages itself on a phone: a line that wraps to more than SUB_LINES lines at reading size
 * shows SUB_LINES at a time (the same words, in order), each page for its share of the line's own time; the last one
 * stays until the show moves on (as the whole line did).
 */
export function pageSubtitles(scene: Bag) {
  const t = scene.subs as PagedText | undefined;
  if (!t || t.__mfPaged) return;
  t.__mfPaged = true;
  const proto = (Object.getPrototypeOf(t) as Phaser.GameObjects.Text).setText;
  const st = (t.__mfPages = { timer: null as Phaser.Time.TimerEvent | null });
  t.setText = function (this: PagedText, value: string | string[]) {
    st.timer?.remove();
    st.timer = null;
    const raw = Array.isArray(value) ? value.join("\n") : value === undefined || value === null ? "" : String(value);
    if (!raw) return proto.call(this, raw);
    let lines: string[];
    try {
      lines = this.getWrappedText(raw);
    } catch {
      lines = [raw];
    }
    if (lines.length <= SUB_LINES) return proto.call(this, raw);
    const pages = pageLines(lines, SUB_LINES);
    const times = pageTimes(pages, subtitleMs(raw));
    let i = 0;
    const show = () => {
      proto.call(this, pages[i]);
      if (i >= pages.length - 1) return;
      const wait = () => {
        st.timer = null;
        if (!this.active) return;
        // (the telly paused: the page waits with it)
        if (scene.pausedPlay) return void (st.timer = scene.time.delayedCall(250, wait));
        i++;
        show();
      };
      st.timer = scene.time.delayedCall(times[i], wait);
    };
    show();
    return this;
  };
}

// ------------------------------------------------------------------ install

export interface PhoneScenes {
  gunner: Gunner;
  pedals: Pedals;
  raid: RaidFire;
  /** For tests: what the scenes part has done. */
  stats: { advertPills: number; skip3d: number; tvPaged: number; drawbridgePills: number; finaleSkips: number; tutorialSkips: number };
}

export function installScenes(game: Phaser.Game, layer: TouchLayer, shell: Shell): PhoneScenes {
  if (!document.getElementById("ksc-css")) {
    const st = document.createElement("style");
    st.id = "ksc-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  for (const r of SCENE_NARRATOR_TIPS) if (!NARRATOR_TIPS.includes(r)) NARRATOR_TIPS.push(r);
  const gunner = new Gunner(game, layer);
  const pedals = new Pedals();
  const stats = { advertPills: 0, skip3d: 0, tvPaged: 0, drawbridgePills: 0, finaleSkips: 0, tutorialSkips: 0 };

  // the mode rows, in front of the minigames' (after the screens and overlays, so the pause menu still wins)
  const rules: SceneRule[] = [
    {
      name: "night of freedom",
      match: (k) => k === "Drive",
      decide: () => {
        const sc = live(game, "Drive") as DriveLike | null;
        const gunning = !!sc && sc.running && !sc.ended && !sc.box?.active && !sc.db;
        return { mode: "tap", live: true, pause: "menu", pauseButton: true, gunner: gunning };
      },
    },
    {
      name: "beep beep",
      match: (k) => k === "BeepBeep",
      decide: () => {
        const sc = live(game, "BeepBeep") as BeepLike | null;
        const driving = pedals.driving(sc);
        return { mode: "tap", live: true, pause: "menu", pauseButton: true, pedals: driving, stick: driving ? "x" : null };
      },
    },
  ];
  const at = SCENE_RULES.findIndex((r) => r.name === "minigames");
  if (at >= 0) SCENE_RULES.splice(at, 0, ...rules);
  else for (const r of rules.reverse()) addSceneRule(r);

  registerModeController({
    id: "scenes-tap",
    mode: "tap",
    enter: ({ layer: l, decision }) => {
      if (decision.scene === "Drive") {
        gunner.rocketC = l.addControl({ id: "sc-rocket", slot: "prime", className: "kt-fire", label: "ROCKET", haptic: "press", onDown: () => gunner.onRocket() });
        gunner.sloppyC = l.addControl({ id: "sc-sloppy", slot: "up", className: "ksc-hot", label: "SLOPPY", haptic: "press", onDown: () => (live(game, "Drive") as DriveLike | null)?.sloppySurprise() });
      }
      if (decision.scene === "BeepBeep") {
        pedals.boost = l.addControl({ id: "sc-boost", slot: "prime", className: "kt-fire", label: "BOOST", haptic: "press", onDown: () => (pedals.boostHeld = true), onUp: () => (pedals.boostHeld = false) });
        pedals.brake = l.addControl({ id: "sc-brake", slot: "left", label: "BRAKE", haptic: "tap", onDown: () => (pedals.brakeHeld = true), onUp: () => (pedals.brakeHeld = false) });
        pedals.horn = l.addControl({ id: "sc-horn", slot: "up", label: "HORN", haptic: "tap", onDown: () => pedals.honk(live(game, "BeepBeep") as BeepLike | null) });
        // (the stick's caption says what it does here)
        const cap = l.root.querySelector(".kt-cap");
        if (cap) cap.textContent = "STEER";
      }
    },
    frame: ({ game: g, decision }) => {
      if (decision.scene === "Drive") {
        const sc = live(g, "Drive") as DriveLike | null;
        gunner.frame(sc, decision);
        if (sc) {
          clearOfPause(g, layer, [sc.scoreText], 944);
          // the drawbridge's SKIP (Tab): a pill left of II
          const sk = sc.db?.skipBtn as Bag | undefined;
          if (sk?.active && !sk.__mfPill) {
            sk.__mfPill = true;
            pill(g, sk, "SKIP ▸▸");
            stats.drawbridgePills++;
          }
          if (sk?.active) {
            const x = Math.min(944, pauseLeftGame(g, layer) - gpx(g, 8));
            if (sk.x !== x) sk.setX(x);
          }
        }
      } else if (decision.scene === "BeepBeep") {
        const sc = live(g, "BeepBeep") as BeepLike | null;
        pedals.frame(sc, decision);
        if (sc) {
          clearOfPause(g, layer, [sc.timerTx, sc.comboTx], 960 - 24);
          // "SHIFT BOOST · E HORN": the buttons say it on a phone
          if (sc.hint?.visible) sc.hint.setVisible(false);
        }
      }
    },
    release: () => {
      pedals.boostHeld = pedals.brakeHeld = false;
      pedals.letGo(live(game, "BeepBeep") as BeepLike | null);
    },
    leave: ({ layer: l, decision }) => {
      if (decision.scene === "Drive") {
        gunner.leave();
        l.removeControl("sc-rocket");
        l.removeControl("sc-sloppy");
        gunner.rocketC = gunner.sloppyC = null;
      }
      if (decision.scene === "BeepBeep") {
        pedals.boostHeld = pedals.brakeHeld = false;
        pedals.letGo(live(game, "BeepBeep") as BeepLike | null);
        for (const id of ["sc-boost", "sc-brake", "sc-horn"]) l.removeControl(id);
        const cap = l.root.querySelector(".kt-cap");
        if (cap) cap.textContent = "MOVE";
        pedals.boost = pedals.brake = pedals.horn = null;
      }
    },
  });

  // Kreddle's raid and rout: FIRE as a layer control, the game's own touch aim
  const raid = new RaidFire();
  registerModeController({
    id: "scenes-raid",
    mode: "walk",
    frame: ({ game: g, layer: l, decision }) => raid.frame(g, l, decision),
    release: () => {
      if (raid.held) TOUCH.attack = false;
      raid.held = false;
    },
    leave: ({ layer: l }) => raid.leave(l),
  });
  const prevAim = phoneHooks()?.aim;
  setPhoneHooks({
    ...(phoneHooks() ?? {}),
    aim: (scene, px, py) => prevAim?.(scene, px, py) ?? raidAim(scene as unknown as Bag),
    gunAim: (scene, ptr) => gunner.aim(scene as DriveLike, ptr),
    wheelTouch: () => false,
  });

  // the finale between its fights: the PAUSED card offers what Esc does there on a laptop (skip the scene)
  setCardPause(() => {
    const fin = live(game, "Finale") ?? (game.scene.isPaused("Finale") ? (game.scene.getScene("Finale") as unknown as Bag) : null);
    if (fin && typeof fin.finish === "function") {
      stats.finaleSkips++;
      shell.pauseCard({ label: "SKIP SCENE ▸▸", fn: () => fin.finish(true) });
    } else shell.pauseCard(null);
    return true;
  });

  // scenes as they are built
  const onCreate = (sc: Phaser.Scene) => {
    const key = sc.sys.settings.key;
    try {
      if (key === "Drive") onDriveCreate(sc as unknown as Bag);
      if (key === "TV") {
        pageSubtitles(sc as unknown as Bag);
        stats.tvPaged++;
      }
      if (key === "Tutorial") {
        // Esc closes the how-to-play pages on a laptop: a SKIP pill up top does it on a phone (NEXT still pages)
        const sc2 = sc as unknown as Bag;
        const t = sc.add.text(960 - gpx(game, 12), gpx(game, 8), "", { fontFamily: "sans-serif", fontStyle: "bold" }).setOrigin(1, 0).setDepth(10000);
        pill(game, t as unknown as Bag, "SKIP ▸▸");
        t.setInteractive({ useHandCursor: true });
        let down = false;
        t.on("pointerdown", () => (down = true));
        t.on("pointerup", () => {
          if (!down) return;
          down = false;
          sc2.close?.();
        });
        stats.tutorialSkips++;
      }
      if (key === "Minigame") {
        // the cannon's how-to line (a UI line) in touch words; its dark pill fitted to it again
        const fix = () => {
          for (const o of sc.children.list as unknown as Bag[]) {
            if (o.type !== "Text" || !/^SPACE \/ TAP: ANGLE/.test(o.text)) continue;
            o.setText(touchWording(o.text, SCENE_UI_WORDING));
            const bg = (sc.children.list as unknown as Bag[]).find((r) => r.type === "Rectangle" && Math.round(r.x) === Math.round(o.x) && Math.round(r.y) === Math.round(o.y));
            bg?.setSize(o.width + 28, 26);
          }
        };
        fix();
        sc.time.delayedCall(100, fix);
      }
    } catch {
      /* a scene mid-build */
    }
  };
  const hookScenes = () => {
    for (const sc of game.scene.scenes as Phaser.Scene[]) sc.sys.events.on("create", () => onCreate(sc));
  };
  if (game.isBooted) hookScenes();
  else game.events.once(Phaser.Core.Events.READY, hookScenes);

  // things a scene makes part-way through (checked a few times a second, phones only)
  let tick = 0;
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (++tick % 15) return;
    // the Crobley advert's "TAB: skip advert" (a vignette): a pill up top that does what Tab does
    const vig = live(game, "Vignette");
    if (vig) {
      for (const o of vig.children.list as Bag[]) {
        if (o.type !== "Text" || o.__mfPill || o.text !== "TAB: skip advert") continue;
        o.__mfPill = true;
        pill(game, o, "SKIP ADVERT ▸▸");
        o.setOrigin(1, 0).setPosition(960 - gpx(game, 12), gpx(game, 8)).setInteractive({ useHandCursor: true });
        let down = false;
        o.on("pointerdown", () => (down = true));
        o.on("pointerup", () => {
          if (!down) return;
          down = false;
          vig.input?.keyboard?.emit("keydown-TAB", { key: "Tab", preventDefault() {} });
        });
        stats.advertPills++;
      }
    }
    // the 3D epilogue's "skip ▶▶" (a DOM link, 11 px): a 44 px pill
    if (live(game, "Ending")) {
      for (const el of document.querySelectorAll("div")) {
        if (el.textContent !== "skip ▶▶" || el.classList.contains("ksc-skip3d") || el.children.length) continue;
        el.classList.add("ksc-skip3d");
        stats.skip3d++;
      }
    }
  });

  return { gunner, pedals, raid, stats };
}
