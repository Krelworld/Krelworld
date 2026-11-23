// PHONE MODE: the rules of the combat controls, as pure functions (unit-tested). The DOM and the game live in
// combat.ts; this file only decides.
import { verbFromPrompt, type SceneRule } from "./modes";

/** A meter-gated ability the READY slot can offer (research S1: it pops in when one is ready). */
export type ReadyId = "cume" | "wonk" | "golden" | "ibs";

export interface ReadyState {
  /** Golden (transformed) right now. */
  golden: boolean;
  /** The Cumehameha's cooldown is over (only matters while golden). */
  cumeReady: boolean;
  /** Golden juice drunk: the transformation can be used. */
  canTransform: boolean;
  /** The WONK meter, 0..100. */
  wonk: number;
  /** The fart meter's level, 0..4 (4 = IBS ATTACK). */
  fartLevel: number;
}

/** What READY shows (null: nothing ready, hidden). While golden the beam; else WONK, then the transformation, then IBS. */
export function readyAbility(s: ReadyState): ReadyId | null {
  if (s.golden) return s.cumeReady ? "cume" : null;
  if (s.wonk >= 100) return "wonk";
  if (s.canTransform) return "golden";
  if (s.fartLevel >= 4) return "ibs";
  return null;
}

/** The word on READY, and the game action (TOUCH edge) it sends. */
export const READY: Readonly<Record<ReadyId, { word: string; edge: string; caption: string }>> = Object.freeze({
  cume: { word: "CUME", edge: "cume", caption: "BEAM" },
  wonk: { word: "WONK!", edge: "burst", caption: "WONK" },
  golden: { word: "GOLD", edge: "transform", caption: "GOLDEN" },
  ibs: { word: "IBS!", edge: "fart", caption: "FART" },
});

/** HEAL pops in when health is under this fraction and there is pussy juice to drink (research S3). */
export const HEAL_BELOW = 0.4;

export function healWanted(hp: number, max: number, bottles: number, blocked = false): boolean {
  return !blocked && bottles > 0 && max > 0 && hp / max < HEAL_BELOW;
}

/** Holds are recognised at this many ms (research S11: 300 for a picker or radial)... */
export const HOLD_MS = 300;
/** ...and cancelled when the finger moves more than this (CSS px) before that. */
export const HOLD_SLOP = 12;

export type HoldEvent = "hold" | "tap" | "cancel" | null;

/**
 * Tap or hold on one control. `down` at touch-down; `move` with each move (may return "cancel"); `tick` each frame
 * (returns "hold" once, at HOLD_MS); `up` at touch-end (returns "tap" for a quick still press, else null).
 */
export class HoldTracker {
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  /** idle → down → held / cancelled → idle. */
  state: "idle" | "down" | "held" | "cancelled" = "idle";

  down(x: number, y: number, t: number) {
    this.x0 = x;
    this.y0 = y;
    this.t0 = t;
    this.state = "down";
  }

  move(x: number, y: number): HoldEvent {
    if (this.state === "down" && Math.hypot(x - this.x0, y - this.y0) > HOLD_SLOP) {
      this.state = "cancelled";
      return "cancel";
    }
    return null;
  }

  tick(t: number): HoldEvent {
    if (this.state === "down" && t - this.t0 >= HOLD_MS) {
      this.state = "held";
      return "hold";
    }
    return null;
  }

  up(t: number): HoldEvent {
    const was = this.state;
    this.state = "idle";
    if (was === "down") return t - this.t0 < HOLD_MS ? "tap" : "hold";
    return null;
  }

  reset() {
    this.state = "idle";
  }
}

/** After an icon change, a control ignores presses this long (research S1: never change what a press does under a thumb). */
export const RELABEL_MS = 300;
/** With auto-fire off, firing goes on this long after the thumb lifts from FIRE (research M1). */
export const FIRE_GRACE_MS = 200;
/** In a room where holding the trigger is banned (NO_ATTACK_SPAM, 2.5 s held), auto-fire lets go this often... */
export const SPAM_BURST_MS = 2000;
/** ...for this long (a laptop player taps the trigger the same way). */
export const SPAM_GAP_MS = 160;

/**
 * Auto-fire on a "don't hold the trigger" room: true while auto-fire should let go (a short gap every 2 s of firing).
 * `since` is when the current burst began (0 = not firing).
 */
export function spamGap(now: number, since: number): boolean {
  if (!since) return false;
  const phase = (now - since) % (SPAM_BURST_MS + SPAM_GAP_MS);
  return phase >= SPAM_BURST_MS;
}

/** The short name of each character's special on SPECIAL (one word: research "a single verb or an icon"). */
export const SPECIAL_WORD: Readonly<Record<string, string>> = Object.freeze({
  banishment_dash: "DASH",
  krez_loan: "LOAN",
  breaking_news: "NEWS",
  terrible_prophecy: "OMEN",
  experimental_wonker: "TURRET",
  vengeful_krunch: "KRUNCH",
  lulon_lurk: "LURK",
  runescape_slam: "SLAM",
  nuclear_option: "NUKE",
});

export function specialWord(sigId: string | undefined, headbutt = false): string {
  if (headbutt) return "HEADBUTT";
  return (sigId && SPECIAL_WORD[sigId]) || "SPECIAL";
}

/** How full SPECIAL's cost fill is (0..1): Krezz over the special's cost (a free special is always full). */
export function specialFill(krezz: number, cost: number): number {
  if (cost <= 0) return 1;
  return Math.max(0, Math.min(1, krezz / cost));
}

/** First fights: the one-word captions under the combat icons go after this many rooms fought on a phone (S10). */
export const TEACH_ROOMS = 3;

// ------------------------------------------------------------------ the rules (replacing stage 1's dungeon row)

/** The Dungeon: top-down rooms are ours ("combat"); side-scrolling rooms stay on the old pad until part 2. */
export const DUNGEON_RULE: SceneRule = {
  name: "dungeon",
  match: (k) => k === "Dungeon",
  decide: (s) => {
    if (s.side) return s.busy ? { mode: "none", legacyPad: true } : { mode: "side", legacyPad: true, pause: "edge", pauseButton: false, live: true };
    // (a scripted moment, dying, moving rooms: no buttons; coming back to it shows "tap to carry on")
    if (s.busy) return { mode: "none", live: true };
    const mash = s.sub === "mash";
    return { mode: "combat", legacyPad: false, pause: "edge", pauseButton: true, live: true, stick: "2d", action: mash ? null : verbFromPrompt(s.prompt), mash };
  },
};

/** The weapon picker over a top-down fight: still "combat" (the thumb that opened it slides onto a gun). */
export const PICKER_RULE: SceneRule = {
  name: "combat picker",
  match: (k) => k === "WeaponPick",
  decide: (_s, view) => {
    const dun = view.scenes.find((x) => x.key === "Dungeon");
    if (!dun || dun.side) return null;
    return { mode: "combat", scene: "Dungeon", legacyPad: false, pause: null, pauseButton: false, live: true, stick: "2d", action: null, picker: true };
  },
};

