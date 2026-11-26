// PHONE MODE: the top-down fights (stage 2, part 1). Phones only; nothing here runs on a laptop.
//
// The old twelve-button canvas pad is replaced, in the top-down rooms and boss fights, by the layer's floating stick
// (the town's zone, gutter included) and a right-hand cluster laid out as research "layout v2":
//
//   FIRE (prime corner)  hold = fire, slide = aim by hand (snaps onto an enemy). By default (HOLD) the game aims only at
//                        an enemy in front of you (aim.ts CONE_DEG), on screen and not behind a wall: you aim by turning
//                        with the stick. EASY (Settings > Firing) is the old auto-fire: it shoots by itself at any enemy
//                        in range with a clear line, aiming all round you.
//   DODGE (up-left)      SWAP (left: tap = next gun, hold = the weapon picker)      SPECIAL (up: the lad's special,
//   only while it would go)      READY (pops in when WONK, the golden transformation, the Cumehameha or IBS is ready)
//   HEAL (pops in when a drink would heal; red and pulsing under 40%)      ACTION (pops in with a prompt, like walking)
//   the pocket, at the cluster's upper left: 💨 (the fart, levels 1 to 3), 🍺 (a fizzy bongo), SANMIK (as Mikey),
//   each a full-size button in its own place, only while it can be used (thumb-feel round: they were small chips)
//   up top: the weapon chip (tap = next, hold = picker) beside pause.
//
// The game is driven the way the old pad drove it (TOUCH.attack, TOUCH.edges, TOUCH.held), plus two hooks the game's
// files call behind isMobile(): Controls.aim / aimPoint (phone aim) and the Dungeon's step (auto-fire, phone assist).
// Side-scrolling rooms keep the old pad until part 2 replaces it (their rule says legacyPad).
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { G } from "../G";
import { GUNS } from "../combat/Guns";
import { gunUsable, moddedFart, moddedGun } from "../systems/armoury";
import { fartLevel } from "../combat/Farts";
import { maxHp } from "../systems/stats";
import { weaponList } from "../ui/weapons";
import { isMikey, sanmikForced } from "../systems/sanmik";
import { storageKey } from "../variant";
import { setPhoneHooks } from "./boot";
import { fireStyle, phoneSettings, type FireStyle } from "./settings";
import { SCENE_RULES, addSceneRule, currentInputSource } from "./modes";
import { rightStick } from "./pad";
import { registerModeController, type ModeContext, type TouchControl, type TouchLayer } from "./touchLayer";
import { ACQUIRE, AIM_TUNE, CONE_DEG, CONE_KEEP_DEG, MELEE_REACH, SLIDE_PX, aimPointFor, autoFireOk, inView, lineOfSight, pickTarget, snapAim, type AimTarget, type Pt, type WallRect } from "./aim";
import { cueSeen, markCue } from "./cues";
import { AutoPace, StillGate, DUNGEON_RULE, FIRE_GRACE_MS, HoldTracker, MashQueue, PICKER_RULE, READY, RELABEL_MS, TEACH_ROOMS, healShown, healWanted, readyAbility, spamGap, specialCost, specialWanted, specialWord, type ReadyId } from "./combatLogic";
import { controlScale, MIN_CONTROL, safeRect, type Placed, type Rect } from "./layout";
import { COMBAT_CSS, COMBAT_STYLE_ID } from "./combatCss";
import { haptic } from "./haptics";
import { SideMove } from "./side";
import { fitRoomName } from "./roomName";
import { JUMP_TUNE } from "./jump";
import { NARRATOR_TIPS, STORY_UI_LINES, UI_TEXTS, addWording, wordText } from "./wording";
import { COMBAT_NARRATOR_TIPS, COMBAT_WORDING, COMBAT_WORDING_FIRST, FIGHT_UI_LINES, FIRE_TIP, TUTORIAL_TEXT } from "./combatWording";

// ------------------------------------------------------------------ what we read off the Dungeon (from outside)

interface Body {
  velocity: { x: number; y: number };
}
interface EnemyLike {
  uid: number;
  x: number;
  y: number;
  dead: boolean;
  active: boolean;
  visible: boolean;
  alpha: number;
  depth: number;
  radius: number;
  body?: Body | null;
}
interface PlayerLike {
  x: number;
  y: number;
  spr: Phaser.GameObjects.Sprite;
  aim: number;
  wonk: number;
  superUntil: number;
  cumeCd: number;
  specialCd: number;
  noSpecialUntil: number;
  noHealUntil: number;
  headbuttMode: boolean;
  attackAnimUntil: number;
  attackCd: number;
  dodgeUntil: number;
  iframesUntil: number;
  dead: boolean;
  def: { signature?: { id: string; cost: number } };
}
interface Breakable {
  kind: string;
  x: number;
  y: number;
  r: number;
  dead: boolean;
}
interface DungeonLike extends Phaser.Scene {
  player?: PlayerLike;
  enemies?: EnemyLike[];
  spice?: { breakables?: Breakable[] } | null;
  /** The room's walls, pillars and furniture (a static physics group; private in the Dungeon, read from outside). */
  obstacles?: { getChildren?(): unknown[] } | null;
  room?: { w: number; h: number } | null;
  side?: boolean;
  busy?: boolean;
  picking?: boolean;
  prompt?: Phaser.GameObjects.Text;
  pickups?: { spr: Phaser.GameObjects.Image; kind: string }[];
  shots?: { spr: Phaser.GameObjects.Image & { __mBig?: boolean }; o: { owner: string } }[];
  rule?: { kind?: string } | null;
  hitStopUntil?: number;
  now(): number;
  openWeaponPicker?(): void;
  swapSlow?(on: boolean): void;
  __mG?: { ring: Phaser.GameObjects.Graphics; line: Phaser.GameObjects.Graphics };
}
interface WeaponPickLike extends Phaser.Scene {
  tiles?: { box: Phaser.GameObjects.Rectangle; w: { empty: boolean } }[];
  cur?: number;
  done?: boolean;
  focus?(i: number): void;
  pick?(i: number): void;
  close?(): void;
}

const realNow = () => performance.now();

function dungeonOf(game: Phaser.Game): DungeonLike | null {
  try {
    if (!game.scene.isActive("Dungeon") && !game.scene.isPaused("Dungeon")) return null;
    return game.scene.getScene("Dungeon") as unknown as DungeonLike;
  } catch {
    return null;
  }
}

/** The room's solid blocks (walls, pillars, furniture) as rectangles, from their static physics bodies. */
function wallsOf(dun: DungeonLike): WallRect[] {
  const out: WallRect[] = [];
  let kids: unknown[] = [];
  try {
    kids = dun.obstacles?.getChildren?.() ?? [];
  } catch {
    return out;
  }
  for (const k of kids) {
    const o = k as { active?: boolean; body?: { x: number; y: number; width: number; height: number; enable?: boolean } | null };
    const b = o?.body;
    if (!b || o.active === false || b.enable === false || !(b.width > 0) || !(b.height > 0)) continue;
    out.push({ x: b.x, y: b.y, w: b.width, h: b.height });
  }
  return out;
}

// ------------------------------------------------------------------ icons (drawn, so no font or emoji differences)

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  jump: svg(`<path d="M12 3l7.5 8H15v6H9v-6H4.5z" fill="#fff" stroke="#0b1220" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 21h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`),
  fire: svg(`<circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="12" cy="12" r="2.2" fill="#ff6e6e"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="#fff" stroke-width="2.4"/>`),
  dodge: svg(`<path d="M4 6l6 6-6 6M12 6l6 6-6 6" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  swap: svg(`<path d="M5 9h12l-3.5-3.5M19 15H7l3.5 3.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  heal: svg(`<path d="M9.5 2h5v3.2l1.6 2.3c.6.9.9 1.9.9 3V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9.5c0-1.1.3-2.1.9-3L9.5 5.2z" fill="#ff9ecf" stroke="#fff" stroke-width="1.4"/><path d="M12 11.5v5M9.5 14h5" stroke="#7a1144" stroke-width="2"/>`),
};

/** An icon with its name inside the button, under it (shown the first fights only: the `taught` class). */
const withWord = (icon: string, word: string) => `${icon}<span class="kt-in">${word}</span>`;

// ------------------------------------------------------------------ the first fights: names and pulses (S10)

interface Taught {
  rooms: number;
  ready: number;
  heal: number;
  swap: number;
  special: number;
}
const TAUGHT_KEY = () => storageKey("krelworld.phone.combatTaught");
/** The one-time HOLD firing tip (cues.ts: once per phone, per build). */
const FIRE_TIP_CUE = "fire-hold";

function loadTaught(): Taught {
  try {
    const raw = JSON.parse(localStorage.getItem(TAUGHT_KEY()) ?? "null") as Partial<Taught> | null;
    return { rooms: raw?.rooms ?? 0, ready: raw?.ready ?? 0, heal: raw?.heal ?? 0, swap: raw?.swap ?? 0, special: raw?.special ?? 0 };
  } catch {
    return { rooms: 0, ready: 0, heal: 0, swap: 0, special: 0 };
  }
}
function saveTaught(t: Taught) {
  try {
    localStorage.setItem(TAUGHT_KEY(), JSON.stringify(t));
  } catch {
    /* private mode: it's taught again next visit */
  }
}

// ------------------------------------------------------------------ the controller

type CtlId = "fire" | "sfire" | "jump" | "dodge" | "swap" | "special" | "ready" | "heal" | "action" | "chip" | "bongo" | "fart" | "sanmik" | "close";

/** Everything the combat controls know right now (for the smoke test and ?mobilediag). */
export interface CombatSnapshot {
  target: { id: AimTarget["id"]; kind: AimTarget["kind"]; x: number; y: number } | null;
  aim: number | null;
  manual: boolean;
  snapped: boolean;
  autoFiring: boolean;
  /** Auto-fire shooting this frame (LIGHT's pace and STILL's standing still applied). */
  autoShooting: boolean;
  /** The firing style in force (Settings > Firing). */
  firing: FireStyle;
  /** The way you face (radians): HOLD aims only within CONE_DEG of it. */
  facing: number;
  fireHeld: boolean;
  ready: ReadyId | null;
  heal: boolean;
  /** SPECIAL would go now (so it is on screen in a fight). */
  specialReady: boolean;
  picker: boolean;
  mash: boolean;
  mashPresses: number;
  taught: Taught;
}

export class CombatControls {
  readonly c: Record<CtlId, TouchControl>;
  private mash: HTMLDivElement;
  private tune = AIM_TUNE.normal;
  // aiming
  private target: AimTarget | null = null;
  private manual: { raw: number; angle: number; snapped: AimTarget | null } | null = null;
  private aimAngle: number | null = null;
  private aimPt: Pt | null = null;
  private lastMove = 0;
  // firing
  private fireHeld = false;
  private graceUntil = 0;
  private burstSince = 0;
  private autoFiring = false;
  /** Auto-fire is shooting this frame (LIGHT's pace and STILL's standing still applied; `autoFiring` is the wish). */
  private autoShooting = false;
  /** Firing styles (Settings > Firing): LIGHT's pace, STILL's gate, and the last shot seen. */
  private readonly pace = new AutoPace();
  private readonly still = new StillGate();
  private lastShotMark = 0;
  // swap / picker
  private swapHold = new HoldTracker();
  private swapBy: TouchControl | null = null;
  private pickerOpen = false;
  private pickTile = -1;
  /** SWAP's slow motion is ours to undo (a press that became neither a tap nor the picker). */
  private swapSlowOn = false;
  // READY
  private readyId: ReadyId | null = null;
  // feedback
  private seen = { attack: 0, dodge: 0, special: 0 };
  private lastGun: string | null | undefined = undefined;
  private lastAmmo = -1;
  private gunIcons = new Map<string, string>();
  private teach: Taught = loadTaught();
  /** The room counted last (its Player: the Dungeon scene object itself is reused from room to room). */
  private teachRoomCounted: unknown = null;
  private pulseUntil: Partial<Record<CtlId, number>> = {};
  private readonly mashQ = new MashQueue();
  /** Presses the game was actually handed (not fingers: the queue hands them over one a frame). */
  private get mashPresses() {
    return this.mashQ.delivered;
  }

  private feedMash() {
    if (this.mashQ.next(TOUCH.edges.has("burst"))) TOUCH.edges.add("burst");
  }
  private wasMash = false;
  private fsWas = false;
  /** HEAL is in its urgent state (under 40%). */
  private healLow = false;
  private dodgeSeen = 0;
  private pocketKey = "";
  private active = false;
  /** Side-scrolling rooms: the jump feel, the drop rule and the camera's look-ahead (side.ts). */
  readonly side = new SideMove();
  /** Facing in a side room (1 right, -1 left): what FIRE and auto-fire shoot at without a target. */
  private facing = 1;

  constructor(
    readonly game: Phaser.Game,
    readonly layer: TouchLayer,
  ) {
    const L = layer;
    const grp = "rc";
    const fire = L.addControl({
      id: "c-fire",
      slot: "prime",
      group: grp,
      toCorner: true,
      className: "kt-c kt-fire",
      html: withWord(ICON.fire, "FIRE"),
      haptic: "tap",
      onDown: () => this.fireDown(),
      onSlide: (_c, dx, dy) => {
        if (Math.hypot(dx, dy) >= SLIDE_PX) {
          const raw = Math.atan2(dy, dx);
          this.manual = { raw, angle: raw, snapped: this.manual?.snapped ?? null };
        } else this.manual = null;
      },
      onUp: (_c, i) => this.fireUp(i.cancelled),
    });
    // side-scrolling rooms (layout v2): JUMP is the big corner button, FIRE sits left of it (no slide-aim: facing +
    // auto-aim), DODGE and SPECIAL stay where they are in top-down rooms
    const sfire = L.addControl({ id: "c-sfire", slot: "left", group: grp, className: "kt-c kt-fire", html: withWord(ICON.fire, "FIRE"), haptic: "tap", onDown: () => this.fireDown(), onUp: (_c, i) => this.fireUp(i.cancelled) });
    const jump = L.addControl({
      id: "c-jump",
      slot: "prime",
      group: grp,
      toCorner: true,
      className: "kt-c kt-jump",
      html: withWord(ICON.jump, "JUMP"),
      haptic: "press",
      // (on touch-down: the jump goes on the Dungeon's next frame; held = the full jump, a tap = a hop)
      onDown: () => this.side.press(dungeonOf(this.game) as never),
      onUp: () => this.side.release(dungeonOf(this.game) as never),
    });
    const dodge = L.addControl({ id: "c-dodge", slot: "upLeft", group: grp, className: "kt-c kt-dodge", html: withWord(ICON.dodge, "DODGE"), haptic: "press", onDown: () => TOUCH.edges.add("dodge") });
    const swapSpec = (id: string, slot: "left" | "prime", extra: object) => ({
      id,
      slot,
      haptic: "tap" as const,
      onDown: (c: TouchControl) => this.swapDown(c),
      onSlide: (c: TouchControl, dx: number, dy: number, x: number, y: number) => this.swapSlide(c, dx, dy, x, y),
      onUp: (c: TouchControl, i: { cancelled: boolean }) => this.swapUp(c, i.cancelled),
      ...extra,
    });
    const swap = L.addControl(swapSpec("c-swap", "left", { group: grp, className: "kt-c kt-swap", html: withWord(ICON.swap, "SWAP") }));
    const special = L.addControl({
      id: "c-special",
      slot: "up",
      group: grp,
      className: "kt-c kt-special",
      html: `<span class="kt-w">SPECIAL</span>`,
      haptic: "press",
      onDown: () => {
        TOUCH.edges.add("special");
        TOUCH.held.add("special");
      },
      onUp: () => TOUCH.held.delete("special"),
    });
    const ready = L.addControl({
      id: "c-ready",
      slot: "ready",
      place: (l) => this.placeReady(l),
      group: grp,
      className: "kt-c kt-ready",
      label: "WONK!",
      haptic: "big",
      onDown: () => {
        const id = this.readyId;
        if (id) TOUCH.edges.add(READY[id].edge);
      },
    });
    const heal = L.addControl({ id: "c-heal", slot: "heal", group: grp, className: "kt-c kt-heal", html: withWord(ICON.heal, "HEAL"), haptic: "press", onDown: () => TOUCH.edges.add("bottle") });
    const action = L.addControl({ id: "c-action", slot: "combatAction", group: grp, className: "kt-c kt-caction", label: "USE", haptic: "press", onDown: () => TOUCH.edges.add("interact") });
    const chip = L.addControl(
      swapSpec("c-chip", "left", { className: "kt-c kt-chip kt-wchip", html: "", place: (l: TouchLayer) => this.placeWeaponChip(l) }),
    );
    // the pocket: full-size buttons in fixed places at the cluster's upper left, each only while it can be used
    const pocket = (id: string, kind: "bongo" | "fart" | "sanmik", slot: "pocketBongo" | "pocketFart" | "pocketSanmik", onDown: () => void) =>
      L.addControl({ id, slot, group: grp, className: `kt-c kt-pocket kt-p-${kind}`, html: "", haptic: "press", onDown });
    const bongo = pocket("c-bongo", "bongo", "pocketBongo", () => TOUCH.edges.add("bongo"));
    const fart = pocket("c-fart", "fart", "pocketFart", () => TOUCH.edges.add("fart"));
    const sanmik = pocket("c-sanmik", "sanmik", "pocketSanmik", () => TOUCH.edges.add("sanmik"));
    const close = L.addControl({ id: "c-close", slot: "prime", className: "kt-c kt-close", html: `<span class="kt-x">✕</span><span class="kt-in kt-keep">CLOSE</span>`, haptic: "tap", onDown: () => this.closePicker() });
    this.c = { fire, sfire, jump, dodge, swap, special, ready, heal, action, chip, bongo, fart, sanmik, close };
    // the mash overlay: every finger anywhere on the screen is a press (research M14)
    const m = document.createElement("div");
    m.className = "kt-mash";
    m.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        if (this.layer.held) return;
        // (every finger counts, even two in one frame: queued, one a frame)
        this.mashQ.press(e.changedTouches.length);
        this.feedMash();
        haptic("tap");
      },
      { passive: false },
    );
    for (const ev of ["touchmove", "touchend", "touchcancel"]) m.addEventListener(ev, (e) => e.cancelable && e.preventDefault(), { passive: false });
    L.root.appendChild(m);
    this.mash = m;
  }

  private fireDown() {
    this.fireHeld = true;
    this.manual = null;
    this.graceUntil = 0;
    // (on touch-down, no wait: the Dungeon reads it on its next frame)
    TOUCH.attack = true;
  }

  private fireUp(cancelled: boolean) {
    this.fireHeld = false;
    this.manual = null;
    // (a FIRE still under a thumb when the fight ended lifts outside it: it must not start a stream there, where
    // nothing would ever stop it: the town would read a held attack and punch Mikey)
    if (!this.active) {
      this.graceUntil = 0;
      return;
    }
    // auto-fire off: the stream carries on a moment, so hopping to DODGE and back doesn't break it (M1)
    this.graceUntil = !cancelled && fireStyle(phoneSettings()) !== "auto" ? realNow() + FIRE_GRACE_MS : 0;
    TOUCH.attack = this.graceUntil > realNow() || this.autoShooting;
  }

  // ------------------------------------------------------------------ placement of the chips

  /** The weapon chip: top, 24 px left of pause (research M16 / layout v2), hit area up to the top edge. */
  private placeWeaponChip(l: TouchLayer): Placed | null {
    const vp = l.viewport;
    const pause = l.slots?.pause;
    if (!pause) return null;
    const s = controlScale(vp.h, phoneSettings().buttonSize);
    const w = Math.round(Math.max(120, 140 * s));
    const h = Math.round(Math.max(44, 44 * s));
    const right = pause.cx - pause.size / 2 - Math.max(16, 24 * s);
    const top = Math.max(safeRect(vp).y, 0) + 6 * s;
    const cx = right - w / 2;
    const cy = top + h / 2;
    return { cx, cy, size: h, w, h, hit: { x: cx - w / 2 - 10, y: 0, w: w + 20, h: cy + h / 2 + 10 } };
  }

  /**
   * READY: its layout v2 slot, kept clear of what sits above it (pause; left-handed, the drink chips) and of SPECIAL
   * below it. Only bites with big buttons (L) on short screens: it moves down and, if it must, shrinks (never under
   * 52 px).
   */
  private placeReady(l: TouchLayer): Placed | null {
    const base = l.slots?.ready;
    const sp = l.slots?.up;
    const pause = l.slots?.pause;
    if (!base || !sp || !pause) return base ?? null;
    const st = phoneSettings();
    let top = pause.cy + pause.size / 2;
    // (Android: the offer to go back into fullscreen sits under pause in a fight; READY starts below it: F8)
    const fs = l.control("fullscreen");
    if (fs?.shown && l.slots?.fullscreenFight && !st.leftHanded) top = Math.max(top, l.slots.fullscreenFight.cy + l.slots.fullscreenFight.size / 2);
    if (st.leftHanded) {
      const cb = this.game.scale.canvasBounds;
      const k = cb.width / 960;
      top = cb.y + 61 * k + Math.max(30, 32 * controlScale(l.viewport.h, st.buttonSize));
    }
    const minTop = top + 10;
    const maxBottom = sp.cy - sp.size / 2 - 12;
    let size = base.size;
    let cy = base.cy;
    if (cy - size / 2 < minTop) cy = minTop + size / 2;
    if (cy + size / 2 > maxBottom) {
      size = Math.max(MIN_CONTROL, Math.min(size, maxBottom - minTop));
      cy = Math.max(minTop + size / 2, Math.min(cy, maxBottom - size / 2));
    }
    return { cx: base.cx, cy, size, hit: base.hit };
  }

  // ------------------------------------------------------------------ SWAP (and the weapon chip): tap = next, hold = picker

  private swapDown(c: TouchControl) {
    const dun = dungeonOf(this.game);
    if (!dun || this.pickerOpen) return;
    this.swapBy = c;
    this.swapHold.down(0, 0, realNow());
    // (the action slows the moment you reach for another gun, as on a laptop)
    dun.swapSlow?.(true);
    this.swapSlowOn = true;
  }

  /** Undo SWAP's slow motion (only if it is still ours: a tap hands it to the game, the picker has its own). */
  private swapSlowOff() {
    if (!this.swapSlowOn) return;
    this.swapSlowOn = false;
    dungeonOf(this.game)?.swapSlow?.(false);
  }

  private swapSlide(c: TouchControl, dx: number, dy: number, x: number, y: number) {
    if (c !== this.swapBy) return;
    if (this.pickerOpen) {
      this.hoverTile(x, y);
      return;
    }
    // (a thumb that slides off before the hold is recognised: neither a tap nor a hold)
    if (this.swapHold.move(dx, dy) === "cancel") this.swapSlowOff();
  }

  private swapUp(c: TouchControl, cancelled: boolean) {
    if (c !== this.swapBy) return;
    this.swapBy = null;
    const ev = this.swapHold.up(realNow());
    if (this.pickerOpen) {
      // let go on a gun: that one; anywhere else: the picker stays up for a tap (CLOSE where FIRE was)
      if (!cancelled && this.pickTile >= 0) this.pickAt(this.pickTile);
      this.pickTile = -1;
      return;
    }
    if (!cancelled && ev === "tap") {
      // (the game's own tap: the next gun, its card, and the slow motion eased back)
      this.swapSlowOn = false;
      TOUCH.edges.add("swap");
    } else this.swapSlowOff();
  }

  /** Every frame while SWAP is down: at HOLD_MS the picker opens. */
  private swapTick() {
    if (!this.swapBy || this.pickerOpen) return;
    // (the swap control's own touch keeps its offset: a moving thumb was already checked in swapSlide)
    if (this.swapHold.tick(realNow()) === "hold") {
      const dun = dungeonOf(this.game);
      if (!dun?.openWeaponPicker || dun.picking) return;
      dun.openWeaponPicker();
      this.pickerOpen = true;
      // (the picker runs its own slow motion and puts the speed back when it closes)
      this.swapSlowOn = false;
      this.pickTile = -1;
      haptic("press");
      dun.events.once("weapon-picked", () => {
        this.pickerOpen = false;
        this.pickTile = -1;
      });
    }
  }

  private picker(): WeaponPickLike | null {
    try {
      if (!this.game.scene.isActive("WeaponPick")) return null;
      return this.game.scene.getScene("WeaponPick") as unknown as WeaponPickLike;
    } catch {
      return null;
    }
  }

  /** The finger is over this point: highlight the gun under it. */
  private hoverTile(x: number, y: number) {
    const wp = this.picker();
    if (!wp?.tiles) return;
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / 960;
    const ky = cb.height / 540;
    const gx = (x - cb.x) / k;
    const gy = (y - cb.y) / ky;
    let hit = -1;
    wp.tiles.forEach((t, i) => {
      if (t.w.empty || !t.box.active) return;
      const b = t.box.getBounds();
      if (gx >= b.x - 6 && gx <= b.right + 6 && gy >= b.y - 6 && gy <= b.bottom + 6) hit = i;
    });
    if (hit !== this.pickTile) {
      this.pickTile = hit;
      if (hit >= 0) {
        try {
          wp.focus?.(hit);
        } catch {
          /* picker closing */
        }
        haptic("tap");
      }
    }
  }

  private pickAt(i: number) {
    const wp = this.picker();
    try {
      if (wp && !wp.done) wp.pick?.(i);
    } catch {
      /* already closed */
    }
  }

  private closePicker() {
    const wp = this.picker();
    try {
      if (wp && !wp.done) wp.close?.();
    } catch {
      /* already closed */
    }
  }

  // ------------------------------------------------------------------ the game's hooks (boot.ts PhoneHooks)

  /** Is this a fight the phone controls run (a top-down Dungeon room)? */
  private ours(scene: Phaser.Scene): scene is DungeonLike {
    return scene.sys?.settings?.key === "Dungeon";
  }

  /**
   * The Dungeon, every frame, just before the player moves: pick the target, work out the aim, decide auto-fire,
   * and the phone assist. Runs inside the Dungeon's update, so what it sets is used this very frame.
   */
  combatStep(scene: Phaser.Scene, controls: unknown, dt: number) {
    if (!this.ours(scene)) return;
    const dun = scene;
    const p = dun.player;
    const ctl = controls as { autoAim: number | null; autoAimPoint: Pt | null };
    // (the Krezz-Assist perk's lock-on would bypass Controls.aim: on a phone, aiming is ours)
    ctl.autoAim = null;
    ctl.autoAimPoint = null;
    if (!p || !p.spr?.active) return;
    const st = phoneSettings();
    const style = fireStyle(st);
    this.tune = AIM_TUNE[st.aimAssist] ?? AIM_TUNE.normal;
    const me: Pt = { x: p.x, y: p.y };
    const sideView = dun.side === true;
    let sx = TOUCH.mx;
    let sy = TOUCH.my;
    if (sideView) {
      // side-on: you face the way you last ran; targets ahead count for more; no slide-aim (research M6)
      if (Math.abs(sx) > 0.2) this.facing = sx > 0 ? 1 : -1;
      sx = this.facing;
      sy = 0;
      this.manual = null;
      this.side.raw = this.layer.stickRaw;
      if (!dun.busy) this.side.camera(dun as never, dt, TOUCH.mx);
    }
    if (Math.hypot(sx, sy) > 0.2) this.lastMove = Math.atan2(sy, sx);
    const view = dun.cameras.main.worldView;
    const vr = { x: view.x, y: view.y, w: view.width, h: view.height };
    const enemies: AimTarget[] = [];
    for (const e of dun.enemies ?? []) {
      if (!e || e.dead || !e.active || e.visible === false || e.alpha < 0.3) continue;
      const v = e.body?.velocity;
      enemies.push({ id: e.uid, x: e.x, y: e.y, r: e.radius || 12, kind: "enemy", vx: v?.x ?? 0, vy: v?.y ?? 0 });
    }
    const objects: AimTarget[] = [];
    const barrels: AimTarget[] = [];
    (dun.spice?.breakables ?? []).forEach((b, i) => {
      if (b.dead || b.kind === "hostage") return;
      const t: AimTarget = { id: `b${i}`, x: b.x, y: b.y, r: b.r || 14, kind: "object" };
      objects.push(t);
      if (b.kind === "barrel") barrels.push(t);
    });
    // the weapon's reach and shot speed
    const s = G.s;
    const golden = dun.now() < p.superUntil;
    let range: number;
    let speed: number;
    const gid = s.gun && s.guns && s.gun in s.guns && gunUsable(s.gun, s) ? s.gun : null;
    if (golden) {
      // (golden: the attack is a lunging melee combo; auto-fire never moves you, so it waits for FIRE)
      range = MELEE_REACH;
      speed = 0;
    } else if (gid && (s.guns![gid] ?? 0) > 0) {
      const g = moddedGun(GUNS[gid], s);
      range = g.range;
      speed = g.speed;
    } else {
      const f = moddedFart(s);
      range = f.range;
      speed = f.speed;
    }
    // HOLD (the default): only what is in front of you (the way you last moved), that you can see: its body on screen
    // and no wall or pillar in between. EASY: the old aim, all round you.
    const ahead = style !== "auto";
    let visible: ((t: AimTarget) => boolean) | undefined;
    if (ahead) {
      const walls = wallsOf(dun);
      const room = !sideView && dun.room ? { x: 24, y: 24, w: dun.room.w - 48, h: dun.room.h - 48 } : null;
      visible = (t) => inView(t, vr) && lineOfSight(me, t, walls, room);
    }
    // the target: an enemy inside the gun's reach first, so auto-fire never waits on one it can't hit (F3)
    const prev = this.target?.id ?? null;
    this.target = pickTarget({ me, stick: { x: sx, y: sy }, enemies, objects, prev, tune: this.tune, view: vr, reach: ACQUIRE, fireRange: range, facing: ahead ? this.lastMove : null, coneDeg: CONE_DEG, keepDeg: CONE_KEEP_DEG, visible });
    // aim: a slide by hand (snapped), else the target, else straight ahead
    const d = this.layer.decision;
    const fighting = (d.mode === "combat" || d.mode === "side") && !d.mash && !d.picker;
    if (this.manual) {
      const sn = snapAim(me, this.manual.raw, enemies, this.tune, ACQUIRE, vr, visible);
      this.manual.angle = sn.angle;
      this.manual.snapped = sn.snapped;
      this.aimAngle = sn.angle;
      this.aimPt = sn.snapped ? { x: sn.snapped.x, y: sn.snapped.y } : { x: me.x + Math.cos(sn.angle) * 180, y: me.y + Math.sin(sn.angle) * 180 };
    } else {
      const autoAims = this.target && (st.aimAssist !== "off" || (style !== "hold" && this.target.kind === "enemy"));
      if (autoAims && this.target) {
        const pt = aimPointFor(me, this.target, speed, this.tune.lead);
        this.aimAngle = Math.atan2(pt.y - me.y, pt.x - me.x);
        this.aimPt = pt;
      } else {
        this.aimAngle = this.lastMove;
        this.aimPt = { x: me.x + Math.cos(this.lastMove) * 180, y: me.y + Math.sin(this.lastMove) * 180 };
      }
    }
    // auto-fire: an enemy in range, on screen, no barrel by your feet in the way; never a special, never in an overlay
    const now = realNow();
    let auto = style !== "hold" && fighting && !golden && !dun.busy && !dun.picking && autoFireOk({ me, target: this.target, range, view: vr, barrels });
    // (a "don't hold the trigger" room: let go for a moment every two seconds, the way a laptop player taps)
    if (auto && dun.rule?.kind === "NO_ATTACK_SPAM") {
      if (!this.burstSince) this.burstSince = now;
      if (spamGap(now, this.burstSince)) auto = false;
    } else if (!auto) this.burstSince = 0;
    this.autoFiring = auto;
    // firing styles: LIGHT shoots at a slower pace (shots from a held FIRE go at the gun's own); STILL only while you
    // stand still (a dodge is moving)
    const tn = dun.now();
    if (p.attackAnimUntil !== this.lastShotMark) {
      this.lastShotMark = p.attackAnimUntil;
      if (!this.fireHeld && now >= this.graceUntil) this.pace.shot(tn, p.attackCd);
    }
    const stood = this.still.update(tn, Math.hypot(TOUCH.mx, TOUCH.my), tn < p.dodgeUntil);
    if (style === "light" && !this.pace.ok(tn)) auto = false;
    if (style === "still" && !stood) auto = false;
    this.autoShooting = auto;
    TOUCH.attack = (fighting && (this.fireHeld || now < this.graceUntil)) || auto;
    if (st.phoneAssist) this.assist(dun, p, dt);
  }

  /**
   * Phone assist (research S9; never slows the game): pick-ups come to you from further away and faster, a dodge's
   * safe window is a little longer (touch and frame delay), and enemy bullets are drawn a bit bigger (they are hard
   * to see at a phone's scale; their hit size is unchanged).
   */
  private assist(dun: DungeonLike, p: PlayerLike, dt: number) {
    for (const pk of dun.pickups ?? []) {
      if (pk.kind === "quest" || !pk.spr?.active) continue;
      const d = Math.hypot(pk.spr.x - p.x, pk.spr.y - p.y);
      if (d >= ASSIST.magnet || d < 1) continue;
      // (inside the game's own 90 px its pull still runs as well; this adds to it)
      const step = Math.min(d, dt * (d < ASSIST.reach ? 2 : ASSIST.pull));
      pk.spr.x += ((p.x - pk.spr.x) / d) * step;
      pk.spr.y += ((p.y - pk.spr.y) / d) * step;
    }
    if (p.dodgeUntil > this.dodgeSeen) {
      this.dodgeSeen = p.dodgeUntil;
      p.iframesUntil = Math.max(p.iframesUntil, p.dodgeUntil + 90 + ASSIST.dodgeMs);
    }
    for (const sh of dun.shots ?? []) {
      if (sh.o.owner !== "enemy" || sh.spr.__mBig || !sh.spr.active) continue;
      sh.spr.__mBig = true;
      sh.spr.setScale(sh.spr.scaleX * ASSIST.bullet, sh.spr.scaleY * ASSIST.bullet);
    }
  }

  aim(scene: Phaser.Scene, _px: number, _py: number): number | null {
    if (!this.ours(scene) || this.aimAngle === null) return null;
    // a controller's right stick, pushed: the game's own pad aim (Controls.aim) does it
    if (currentInputSource() === "pad") {
      const r = rightStick();
      if (r && Math.hypot(r.x, r.y) > 0.5) return null;
    }
    return this.aimAngle;
  }

  aimPoint(scene: Phaser.Scene): Pt | null {
    if (!this.ours(scene)) return null;
    if (currentInputSource() === "pad") {
      const r = rightStick();
      if (r && Math.hypot(r.x, r.y) > 0.5) return null;
    }
    return this.aimPt;
  }

  /** The HUD's toast column ends left of the top-right controls (pause, the fullscreen offer, the weapon chip). */
  toastRight(_mode: "hub" | "dungeon"): number | null {
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / 960;
    if (!k) return null;
    let left = Infinity;
    // (in a top-down fight the weapon chip's place is kept even before it shows: a room's first toasts come early)
    const dun = dungeonOf(this.game);
    const fight = _mode === "dungeon" && !!dun;
    for (const id of ["pause", "fullscreen", "c-chip"]) {
      const ctl = this.layer.control(id);
      if (!ctl || ctl.faceRect.w <= 0 || ctl.faceRect.y >= cb.y + 60) continue;
      // (in town pause's place is always kept: a toast made while a cutscene had it hidden stays up after it comes
      // back, and ran under it: P14)
      if (ctl.shown || (id === "c-chip" && fight) || (id === "pause" && (this.layer.decision.mode !== "none" || _mode === "hub"))) left = Math.min(left, ctl.faceRect.x);
    }
    if (!Number.isFinite(left)) return null;
    return Math.min(950, Math.floor((left - 8 - cb.x) / k));
  }

  readyWord(which: "burst" | "fart"): string | null {
    if (!this.active) return null;
    return which === "burst" ? READY.wonk.word : READY.ibs.word;
  }

  // ------------------------------------------------------------------ the mode controller

  enter(ctx: ModeContext) {
    this.active = true;
    this.frame(ctx);
  }

  leave() {
    this.active = false;
    // (a control under a thumb stays until the thumb lifts: research M3 / S1)
    for (const c of Object.values(this.c)) if (!c.pressed) c.show(false);
    this.mash.classList.remove("show");
    this.autoFiring = false;
    this.autoShooting = false;
    this.pace.reset();
    this.still.reset();
    this.target = null;
    this.layer.occluders = [];
    // (FIRE belongs to the fight: outside it nothing reads it as held, even with the thumb still down)
    TOUCH.attack = false;
    this.graceUntil = 0;
    this.drawAim(null);
    // (a jump held or waiting when the room or the mode changes must not go off later)
    this.side.reset();
    // (a press meant for the fight that no frame has read yet must not go off later, somewhere else)
    dropFightEdges();
  }

  release() {
    // (page hidden, upright, blur: everything lets go)
    this.fireHeld = false;
    this.manual = null;
    this.graceUntil = 0;
    this.autoFiring = false;
    this.autoShooting = false;
    TOUCH.attack = false;
    TOUCH.held.delete("special");
    TOUCH.held.delete("swap");
    this.side.reset();
    if (this.swapBy) {
      this.swapBy = null;
      this.swapHold.reset();
      this.swapSlowOff();
    }
    dropFightEdges();
  }

  layout() {
    // (the weapon chip follows pause: re-placed whenever the layer lays out)
    if (!this.c.chip.pressed) this.c.chip.place();
  }

  frame(ctx: ModeContext) {
    const d = ctx.decision;
    const dun = dungeonOf(this.game);
    const p = dun?.player;
    const s = G.s;
    const picker = !!d.picker;
    const mash = !!d.mash;
    // (a long freeze, like the golden transformation's cut-in, is not a moment anything can be pressed: the buttons
    // wait it out instead of queueing presses for afterwards; the short hit-stops of a fight don't count)
    const frozen = !!dun && (dun.hitStopUntil ?? 0) - dun.now() > FROZEN_MS;
    const fight = !picker && !mash && !frozen && !!p && !p.dead;
    const show = (id: CtlId, on: boolean, pop = false) => {
      const c = this.c[id];
      if (!on && c.pressed) return;
      if (on !== c.shown) c.show(on, pop);
    };
    // the mash overlay: the whole screen
    this.mash.classList.toggle("show", mash);
    if (mash) this.feedMash();
    else this.mashQ.clear();
    if (mash) TOUCH.attack = false;
    // (a tap in its last moment must not reach the fight as a WONK press: "WONK 0%")
    else if (this.wasMash) TOUCH.edges.delete("burst");
    this.wasMash = mash;
    // (the fullscreen offer came or went: READY is placed again round it)
    const fsOn = !!this.layer.control("fullscreen")?.shown;
    if (fsOn !== this.fsWas) {
      this.fsWas = fsOn;
      this.c.ready?.place();
    }
    // the room counts toward the first-fights captions once it's really a fight
    if (fight && dun && p && this.teachRoomCounted !== p && (dun.enemies?.length ?? 0) > 0) {
      this.teachRoomCounted = p;
      this.teach.rooms++;
      saveTaught(this.teach);
    }
    const teaching = this.teach.rooms <= TEACH_ROOMS;
    // HOLD firing (the default since auto-fire was found too easy): the first fight on this phone says so, once, and
    // FIRE pulses, so a player used to auto-fire isn't left wondering why nothing shoots
    if (fight && dun && !cueSeen(FIRE_TIP_CUE) && fireStyle(phoneSettings()) !== "auto" && (dun.enemies ?? []).some((e) => e && !e.dead && e.active)) {
      markCue(FIRE_TIP_CUE);
      this.pulseUntil.fire = this.pulseUntil.sfire = realNow() + 4000;
      G.emit("toast", { title: FIRE_TIP.title, text: FIRE_TIP.text });
    }
    // ---- the cluster
    const side = d.mode === "side";
    show("fire", fight && !side);
    show("sfire", fight && side);
    show("jump", fight && side);
    if (!side && !this.c.jump.pressed && this.side.touchHeld) this.side.reset();
    show("dodge", fight);
    const sig = p?.def?.signature;
    const choices = weaponList(s).filter((w) => !w.empty).length;
    // (side rooms: the weapon chip swaps; layout v2 gives SWAP's place to FIRE)
    show("swap", fight && !side && choices >= 2, true);
    show("action", fight && !!d.action, true);
    if (d.action) this.c.action.setLabel(String(d.action));
    show("close", picker);
    // READY: the meter ability that's ready (never relabelled under a thumb; a fresh word ignores presses briefly)
    let rid: ReadyId | null = null;
    if (fight && p && dun) {
      const now = dun.now();
      rid = readyAbility({ golden: now < p.superUntil, cumeReady: now >= p.cumeCd, canTransform: !!s.flags.golden_charge, wonk: p.wonk ?? 0, fartLevel: fartLevel() });
    }
    const rc = this.c.ready;
    if (!rc.pressed && rid !== this.readyId) {
      const was = this.readyId;
      this.readyId = rid;
      if (rid) {
        rc.setLabel(READY[rid].word);
        if (was && rc.shown) rc.disarmFor(RELABEL_MS);
        if (this.teach.ready < 3) {
          this.teach.ready++;
          saveTaught(this.teach);
          this.pulseUntil.ready = realNow() + 3000;
        }
      }
    }
    show("ready", !!this.readyId, true);
    // HEAL while a drink would heal (one button for the juice, full size); under 40% it is red and pulses the first times
    const noHeal = !!p && !!dun && dun.now() < p.noHealUntil;
    const hs = fight && !!p && !!dun && healShown(s.hp, maxHp(s), s.bottles, noHeal);
    const hw = hs && healWanted(s.hp, maxHp(s), s.bottles, noHeal);
    if (hw && !this.healLow && this.teach.heal < 2) {
      this.teach.heal++;
      saveTaught(this.teach);
      this.pulseUntil.heal = realNow() + 3000;
    }
    this.healLow = hw;
    show("heal", hs, true);
    if (this.c.heal.el.classList.contains("low") !== hw) this.c.heal.el.classList.toggle("low", hw);
    if (this.c.heal.shown) this.c.heal.setHtml(`${withWord(ICON.heal, "HEAL")}<span class="kt-n">${s.bottles}</span>`);
    // SPECIAL: the lad's word, only while it would go (no dim "charging" bubble: the KREZZ bar up top shows the
    // charge); it pops in when it can, pulsing the first two times
    const spOk = this.specialOk(p, dun);
    if (spOk && !this.c.special.shown && this.teach.special < 2) {
      this.teach.special++;
      saveTaught(this.teach);
      this.pulseUntil.special = realNow() + 3000;
    }
    show("special", fight && spOk, true);
    if (fight && p) this.c.special.setHtml(`<span class="kt-w">${specialWord(sig?.id, p.headbuttMode)}</span>`);
    // ---- the chips
    show("chip", fight);
    if (fight) this.weaponChip();
    show("bongo", fight && s.bongos > 0, true);
    const lv = fartLevel();
    // (at IBS READY says it, big, on the right: the 💨 chip steps aside so one ability has one button; P11)
    show("fart", fight && lv >= 1 && this.readyId !== "ibs", true);
    // (Mikey ⇄ SanMik can't happen while golden: the game says no, so the chip isn't there)
    show("sanmik", fight && isMikey(s) && !sanmikForced(s) && !!dun && !!p && dun.now() >= p.superUntil, true);
    if (fight) this.pocketFaces(lv);
    // ---- the first fights: each icon's name inside it (never a caption outside the button, so nothing can land on a
    // neighbour, the HUD or the home-indicator strip: N1); pulses the first time each matters
    for (const id of ["fire", "sfire", "jump", "dodge", "swap", "heal"] as const) if (this.c[id].el.classList.contains("taught") !== teaching) this.c[id].el.classList.toggle("taught", teaching);
    const t = realNow();
    for (const id of ["ready", "heal", "swap", "special", "fire", "sfire"] as const) this.c[id].el.classList.toggle("pulse", (this.pulseUntil[id] ?? 0) > t && this.c[id].shown);
    // ---- feedback: a flash on the button that just did something (FIRE flashes with auto-fire's shots too)
    if (p) this.flashes(p);
    this.c.fire.el.classList.toggle("auto", this.autoFiring);
    this.c.sfire.el.classList.toggle("auto", this.autoFiring);
    this.swapTick();
    // ---- the target ring, the aim line, and what controls must not hide
    this.drawAim(fight && dun ? dun : null);
    this.layer.occluders = fight && dun && p ? this.occluders(dun, p) : [];
    // the prompt over the player's head speaks touch ("Tap: Untie Mollor": tapping it, or ACTION, does it)
    const pr = dun?.prompt as (Phaser.GameObjects.Text & { __krelWorded?: boolean }) | undefined;
    if (pr && !pr.__krelWorded && pr.scene) wordText(pr);
  }

  /** The weapon chip: icon, name, ammo. Only touches the DOM when something changed. */
  private weaponChip() {
    const s = G.s;
    const gid = s.gun && s.guns && s.gun in s.guns && gunUsable(s.gun, s) ? s.gun : null;
    const ammo = gid ? s.guns![gid] ?? 0 : -1;
    // the gun went dry and the game moved on: the first times, SWAP says "I'm here"
    if (this.lastGun !== undefined && this.lastGun && gid !== this.lastGun && (s.guns?.[this.lastGun] ?? 0) <= 0 && this.teach.swap < 2) {
      this.teach.swap++;
      saveTaught(this.teach);
      this.pulseUntil.swap = realNow() + 2500;
    }
    if (gid === this.lastGun && ammo === this.lastAmmo) return;
    this.lastGun = gid;
    this.lastAmmo = ammo;
    let icon = "💨";
    let name = "Fart Blaster";
    let am = "∞";
    let cls = "";
    if (gid) {
      const g = GUNS[gid];
      name = g.name.replace(/^The /, "").replace(/\s*\(.*\)\s*$/, "");
      const img = this.gunIcon(gid, g.tex);
      if (img) icon = `<img src="${img}" alt="">`;
      am = ammo > 0 ? `${ammo}` : "EMPTY";
      cls = ammo <= 0 ? "out" : ammo < (g.maxAmmo ?? 1) * 0.2 ? "low" : "";
    }
    this.c.chip.setHtml(`<span class="kt-ic">${icon}</span><span class="kt-tx"><span class="kt-nm">${esc(name)}</span><span class="kt-am ${cls}">${am}</span></span>`);
  }

  private gunIcon(id: string, tex: string): string | null {
    if (this.gunIcons.has(id)) return this.gunIcons.get(id) || null;
    let url = "";
    try {
      const tm = this.game.textures;
      if (tm.exists(tex)) url = (tm as unknown as { getBase64(k: string): string }).getBase64(tex) || "";
    } catch {
      url = "";
    }
    this.gunIcons.set(id, url);
    return url || null;
  }

  /** The pocket buttons' faces: icon, the word inside, the bongo count. Only touches the DOM when something changed. */
  private pocketFaces(lv: number) {
    const s = G.s;
    const names = ["", "FAIRY", "BEANS", "CABBAGE", "IBS!"];
    const key = `${s.bongos}|${lv}`;
    if (key === this.pocketKey) return;
    this.pocketKey = key;
    this.c.bongo.setHtml(`<span class="kt-pi">🍺</span><span class="kt-in kt-keep">BONGO</span><span class="kt-n">${s.bongos}</span>`);
    this.c.fart.setHtml(`<span class="kt-pi">💨</span><span class="kt-in kt-keep${(names[lv] ?? "").length > 5 ? " kt-long" : ""}">${names[lv] ?? ""}</span>`);
    this.c.sanmik.setHtml(`<span class="kt-w">SANMIK</span>`);
  }

  /** A short flash on the button whose action just happened (research M15). */
  private flashes(p: PlayerLike) {
    const fl = (c: TouchControl) => {
      if (!c.shown) return;
      try {
        c.face.animate([{ filter: "brightness(1.9)", transform: "scale(1.06)" }, { filter: "brightness(1)", transform: "scale(1)" }], { duration: 140, easing: "ease-out" });
      } catch {
        /* no WAAPI */
      }
    };
    if (p.attackAnimUntil > this.seen.attack) {
      this.seen.attack = p.attackAnimUntil;
      fl(this.c.fire);
    }
    if (p.dodgeUntil > this.seen.dodge) {
      this.seen.dodge = p.dodgeUntil;
      fl(this.c.dodge);
    }
    if (p.specialCd > this.seen.special) {
      this.seen.special = p.specialCd;
      fl(this.c.special);
    }
  }

  /** The ring at the target's feet, and the aim line while FIRE is slid. Drawn in the Dungeon (moves with it). */
  private drawAim(dun: DungeonLike | null) {
    const last = this.lastDrawn;
    if (last && (!dun || last !== dun)) {
      if (last.__mG?.ring.scene) last.__mG.ring.clear();
      if (last.__mG?.line.scene) last.__mG.line.clear();
    }
    this.lastDrawn = dun;
    if (!dun) return;
    let gs = dun.__mG;
    if (!gs || !gs.ring.scene || !gs.line.scene) {
      gs = { ring: dun.add.graphics(), line: dun.add.graphics().setDepth(640) };
      dun.__mG = gs;
    }
    gs.ring.clear();
    gs.line.clear();
    const p = dun.player;
    if (!p) return;
    const st = phoneSettings();
    const t = this.manual?.snapped ?? this.target;
    const showRing = !!t && (st.aimAssist !== "off" || this.autoFiring || !!this.manual?.snapped);
    if (t && showRing) {
      const r = t.r + 8;
      const col = t.kind === "enemy" ? 0xff4d4d : 0xffa94d;
      gs.ring.setDepth(t.y - 1);
      gs.ring.lineStyle(this.autoFiring || this.fireHeld ? 3 : 2, col, this.autoFiring || this.fireHeld ? 0.95 : 0.7);
      gs.ring.strokeEllipse(t.x, t.y + t.r * 0.55, r * 2, r * 0.9);
      gs.ring.lineStyle(1, 0x000000, 0.5);
      gs.ring.strokeEllipse(t.x, t.y + t.r * 0.55, r * 2 + 4, r * 0.9 + 3);
    }
    if (this.manual) {
      const a = this.manual.angle;
      const len = 240;
      const snapped = !!this.manual.snapped;
      gs.line.lineStyle(4, 0x000000, 0.35);
      gs.line.lineBetween(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
      gs.line.lineStyle(2, snapped ? 0xffd23f : 0xffffff, snapped ? 0.95 : 0.7);
      gs.line.lineBetween(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
    }
  }
  private lastDrawn: DungeonLike | null = null;

  /** The player and the target, on the page: a control over either goes see-through. */
  private occluders(dun: DungeonLike, p: PlayerLike): Rect[] {
    const out: Rect[] = [];
    const cam = dun.cameras.main;
    const cb = this.game.scale.canvasBounds;
    const k = cb.width / 960;
    const page = (x: number, y: number) => ({ x: cb.x + ((x - cam.scrollX - cam.width / 2) * cam.zoom + cam.x + cam.width / 2) * k, y: cb.y + ((y - cam.scrollY - cam.height / 2) * cam.zoom + cam.y + cam.height / 2) * k });
    try {
      const b = p.spr.getBounds();
      const a = page(b.x, b.y);
      const z = page(b.right, b.bottom);
      out.push({ x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y });
    } catch {
      /* no sprite */
    }
    const t = this.target;
    if (t) {
      const a = page(t.x - t.r - 6, t.y - t.r * 2);
      const z = page(t.x + t.r + 6, t.y + t.r + 6);
      out.push({ x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y });
    }
    // side rooms: the pits (and their name over them), moving platforms and crushers. They come into view from the
    // right, under JUMP and FIRE: those go see-through over them, so the next gap is never hidden by the buttons (P3)
    if (dun.side) for (const r of hazardRects(dun)) {
      const a = page(r.x, r.y);
      const z = page(r.x + r.w, r.y + r.h);
      out.push({ x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y });
    }
    return out;
  }

  /** Would the lad's special go right now (enough Krezz, no decree against it)? */
  private specialOk(p: PlayerLike | undefined | null, dun: DungeonLike | null): boolean {
    if (!p || !dun) return false;
    const sig = p.def?.signature;
    if (!sig && !p.headbuttMode) return false;
    const s = G.s;
    const cost = specialCost(sig?.cost ?? 0, s.player, s.flags, !!p.headbuttMode);
    return specialWanted(s.krezz, cost, !p.headbuttMode && dun.now() < p.noSpecialUntil);
  }

  /** For tests and ?mobilediag. */
  snapshot(): CombatSnapshot {
    const t = this.target;
    return {
      target: t ? { id: t.id, kind: t.kind, x: Math.round(t.x), y: Math.round(t.y) } : null,
      aim: this.aimAngle,
      manual: !!this.manual,
      snapped: !!this.manual?.snapped,
      autoFiring: this.autoFiring,
      autoShooting: this.autoShooting,
      firing: fireStyle(phoneSettings()),
      facing: this.lastMove,
      fireHeld: this.fireHeld,
      ready: this.readyId,
      heal: this.c.heal.shown,
      specialReady: this.specialOk(dungeonOf(this.game)?.player, dungeonOf(this.game)),
      picker: this.pickerOpen,
      mash: this.mash.classList.contains("show"),
      mashPresses: this.mashPresses,
      taught: { ...this.teach },
    };
  }

  /** Tests: forget the first-fights teaching (captions and pulses come back). */
  resetTeaching() {
    this.teach = { rooms: 0, ready: 0, heal: 0, swap: 0, special: 0 };
    saveTaught(this.teach);
  }
}

/** A freeze longer than this (ms left) hides the fight buttons: a cut-in, not a hit-stop (those are 35 to 200 ms). */
const FROZEN_MS = 400;

/** Phone assist's numbers (S9; *mine*, starting values for the device test). */
export const ASSIST = Object.freeze({
  /** Side rooms: crushers' and steam vents' reach (research: 10-15% smaller under phone assist). */
  hazard: 0.88,
  /** Pick-ups start coming to you from this far (world px; the game's own pull starts at 90). */
  magnet: 140,
  /** How fast they come (px per ms; the game's own pull is 0.4)... */
  pull: 0.5,
  /** ...and inside this distance they come quickly enough to be collected at once. */
  reach: 60,
  /** A dodge's safe window lasts this much longer (ms; about 1.25x the 260 ms window, the audit's timing lever). */
  dodgeMs: 60,
  /** Enemy bullets are drawn this much bigger (their hit size is unchanged). */
  bullet: 1.25,
});

/** The actions the fight's buttons send (TOUCH edges the Dungeon reads on its next frame). */
const FIGHT_EDGES = ["dodge", "special", "bottle", "bongo", "fart", "burst", "transform", "cume", "interact", "swap", "sanmik"];

/** Drop fight presses no frame has read (the fight just went behind a conversation, the pause menu, the page hiding). */
function dropFightEdges() {
  for (const e of FIGHT_EDGES) TOUCH.edges.delete(e);
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

let installed: CombatControls | null = null;

/** The combat controls, once installed (phones only). */
export function combatControls(): CombatControls | null {
  return installed;
}

/**
 * Phones: install the top-down fight controls. Replaces stage 1's dungeon row in the mode table (in place, so the
 * overlays above it still win), adds the weapon-picker row in front, registers the controller and lends the game its
 * hooks.
 */
/** A side room's hazards in world px: pits (with the label drawn over them), moving platforms, crushers' paths. */
export function hazardRects(dun: unknown): Rect[] {
  const out: Rect[] = [];
  const d = dun as { groundY?: number; sideLevel?: { gaps?: [number, number][]; movers?: { rect: { x: number; y: number; width: number; height: number } }[]; crushers?: { x: number; w: number }[] } | null };
  const lv = d.sideLevel;
  if (!lv) return out;
  const gy = d.groundY ?? 470;
  for (const [a, b] of lv.gaps ?? []) out.push({ x: a - 8, y: gy - 70, w: b - a + 16, h: 140 });
  for (const m of lv.movers ?? []) {
    const r = m.rect;
    if (r) out.push({ x: r.x - r.width / 2 - 6, y: r.y - r.height / 2 - 30, w: r.width + 12, h: r.height + 40 });
  }
  for (const c of lv.crushers ?? []) out.push({ x: c.x - c.w / 2, y: gy - 260, w: c.w, h: 260 });
  return out;
}

export function installCombat(game: Phaser.Game, layer: TouchLayer): CombatControls {
  if (installed) return installed;
  if (typeof document !== "undefined" && !document.getElementById(COMBAT_STYLE_ID)) {
    const st = document.createElement("style");
    st.id = COMBAT_STYLE_ID;
    st.textContent = COMBAT_CSS;
    document.head.appendChild(st);
  }
  const i = SCENE_RULES.findIndex((r) => r.name === "dungeon");
  if (i >= 0) SCENE_RULES.splice(i, 1, DUNGEON_RULE);
  else addSceneRule(DUNGEON_RULE, "back");
  addSceneRule(PICKER_RULE, "front");
  const cc = new CombatControls(game, layer);
  for (const [id, mode] of [
    ["combat-topdown", "combat"],
    ["combat-side", "side"],
  ] as const)
    registerModeController({
      id,
      mode,
      enter: (ctx) => cc.enter(ctx),
      frame: (ctx) => cc.frame(ctx),
      layout: () => cc.layout(),
      release: () => cc.release(),
      leave: () => cc.leave(),
    });
  setPhoneHooks({
    combatStep: (sc, ctl, dt) => cc.combatStep(sc, ctl, dt),
    aim: (sc, px, py) => cc.aim(sc, px, py),
    aimPoint: (sc) => cc.aimPoint(sc),
    toastRight: (m) => cc.toastRight(m),
    readyWord: (w) => cc.readyWord(w),
    sideMove: (pl, body, ctl, mv, speed, dt, now) => cc.side.sideMove(pl as never, body as never, ctl as never, mv, speed, dt, now),
    ledgeTol: () => (phoneSettings().phoneAssist ? JUMP_TUNE.ledgeTol : JUMP_TUNE.gameLedgeTol),
    hazardScale: () => (phoneSettings().phoneAssist ? ASSIST.hazard : 1),
    pitRespawn: (level, fellX, safeX, roomW, now) => cc.side.pitRespawn(level as never, fellX, safeX, roomW, now),
  });
  // touch wording for the fight's own UI hints (never dialogue): the weapon picker's how-to line, and the first
  // dungeon's how-to-play pages, which named the old pad's buttons
  UI_TEXTS.WeaponPick = [/^\(the world's slowed right down\) · Tap one/];
  UI_TEXTS.Tutorial = [TUTORIAL_TEXT];
  STORY_UI_LINES.Dungeon = [...(STORY_UI_LINES.Dungeon ?? []), ...FIGHT_UI_LINES];
  for (const r of COMBAT_WORDING) addWording(r);
  // (in front of stage 1's "Press E" → "Tap", which would leave "walk up, Tap")
  for (const r of COMBAT_WORDING_FIRST) addWording(r, "front");
  // the fights' narrated control tips, through the dialogue box's narrator-only path (dialogue.ts, NARRATOR_TIPS)
  for (const r of COMBAT_NARRATOR_TIPS) if (!NARRATOR_TIPS.includes(r)) NARRATOR_TIPS.push(r);
  // Kreddle's money counter sits under pause on a phone: it moves left of it (P10)
  registerModeController({ id: "phone-hud-walk", mode: "walk", frame: () => kreddleCounter(game, cc) });
  // the room's name up top keeps clear of the name, coins and meters, whatever the mode (a room's opening
  // conversation shows it too; N2)
  game.events.on("poststep", () => fitRoomName(game, cc.toastRight("dungeon")));
  installed = cc;
  return cc;
}

/** Walking, Kreddle: its money counter (top right) moves left of pause and the fullscreen offer. */
function kreddleCounter(game: Phaser.Game, cc: CombatControls) {
  let kr: { coinText?: Phaser.GameObjects.Text } | null = null;
  try {
    if (!game.scene.isActive("Kreddle")) return;
    kr = game.scene.getScene("Kreddle") as unknown as { coinText?: Phaser.GameObjects.Text };
  } catch {
    return;
  }
  const t = kr?.coinText;
  if (!t?.scene) return;
  const x = Math.min(950, cc.toastRight("hub") ?? 950);
  if (Math.abs(t.x - x) > 0.5) t.setX(x);
}
