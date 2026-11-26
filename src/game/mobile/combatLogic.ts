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
export const READY: Readonly<Record<ReadyId, { word: string; edge: string }>> = Object.freeze({
  cume: { word: "CUME", edge: "cume" },
  wonk: { word: "WONK!", edge: "burst" },
  golden: { word: "GOLD", edge: "transform" },
  // (one name for one ability: the HUD's pop-up says "TAP IBS!" too; P11)
  ibs: { word: "IBS!", edge: "fart" },
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

// ------------------------------------------------------------------ firing styles (the auto-fire audit, ga-02)

/** LIGHT firing: auto-fire shoots at this share of the gun's own pace (holding FIRE gives the full pace). */
export const LIGHT_PACE = 0.6;
/** STILL firing: auto-fire starts once the stick has rested this long (ms)... */
export const STILL_MS = 120;
/** ...under this much push (a thumb resting on the glass wobbles a little). */
export const STILL_STICK = 0.2;

/**
 * LIGHT firing's pace: after each shot auto-fire waits out the gun's cooldown and then a bit more, so it fires at
 * LIGHT_PACE of the gun's rate. Shots fired by a held FIRE don't count (they go at the full pace).
 */
export class AutoPace {
  private nextAt = 0;
  /** A shot went at `now`; the gun is ready again at `readyAt` (the player's attack cooldown). */
  shot(now: number, readyAt: number) {
    const cd = Math.max(0, readyAt - now);
    this.nextAt = Math.max(now, readyAt) + cd * (1 / LIGHT_PACE - 1);
  }
  /** May auto-fire shoot now? */
  ok(now: number): boolean {
    return now >= this.nextAt;
  }
  reset() {
    this.nextAt = 0;
  }
}

/** STILL firing: has the player stood still long enough for auto-fire? (`mag`: the stick's push, 0..1.) */
export class StillGate {
  private since = -1;
  update(now: number, mag: number, dodging: boolean): boolean {
    if (mag >= STILL_STICK || dodging) {
      this.since = -1;
      return false;
    }
    if (this.since < 0) this.since = now;
    return now - this.since >= STILL_MS;
  }
  reset() {
    this.since = -1;
  }
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

/** First fights: the one-word names inside the combat icons go after this many rooms fought on a phone (S10). */
export const TEACH_ROOMS = 3;

// ------------------------------------------------------------------ a calm fight screen (stage 2 polish)
//
// The user, on the live phone build: "a bunch of bubbles for every potential special even when they're not active".
// The rule: a fight shows what a thumb needs all the time (the stick, FIRE, or JUMP and FIRE, DODGE, the weapon chip,
// pause) and anything else only while it can be used right now. Nothing is drawn dim "for later": an ability that
// can't go takes no space, and pops in (pulsing the first times) the moment it can.

/** What the special really costs this lad (the game takes the same discounts off: Player.trySpecial). */
export function specialCost(base: number, who: string, flags: Record<string, unknown>, headbutt = false): number {
  if (headbutt) return 0;
  let c = base;
  if (who === "KREBLIS" && flags.pq_done_pq_kreblis) c -= 10;
  if (who === "MIKEY" && flags.pq_done_pq_mikey) c -= 15;
  return Math.max(0, c);
}

/** SPECIAL is on screen only while it would go: enough Krezz, and no decree against it right now. */
export function specialWanted(krezz: number, cost: number, banned: boolean): boolean {
  return !banned && specialFill(krezz, cost) >= 1;
}

/**
 * HEAL is on screen while a drink would do something (hurt, with juice, healing allowed): one button for the one
 * ability, full size on the right (thumb-feel round: the small 🍼 chip top left is gone). Under HEAL_BELOW it is the
 * urgent one (healWanted: it pulses the first times and turns red).
 */
export function healShown(hp: number, max: number, bottles: number, blocked = false): boolean {
  return !blocked && bottles > 0 && max > 0 && hp < max;
}

// ------------------------------------------------------------------ the rules (replacing stage 1's dungeon row)

/** The Dungeon: top-down rooms ("combat") and side-scrolling rooms ("side": an x-only stick, JUMP in the corner). */
export const DUNGEON_RULE: SceneRule = {
  name: "dungeon",
  match: (k) => k === "Dungeon",
  decide: (s) => {
    // (a scripted moment, dying, moving rooms: no buttons; coming back to it shows "tap to carry on")
    if (s.busy) return { mode: "none", live: true };
    const mash = s.sub === "mash";
    return { mode: s.side ? "side" : "combat", legacyPad: false, pause: "edge", pauseButton: true, live: true, stick: s.side ? "x" : "2d", action: mash ? null : verbFromPrompt(s.prompt), mash };
  },
};

/** The weapon picker over a top-down fight: still "combat" (the thumb that opened it slides onto a gun). */
export const PICKER_RULE: SceneRule = {
  name: "combat picker",
  match: (k) => k === "WeaponPick",
  decide: (_s, view) => {
    const dun = view.scenes.find((x) => x.key === "Dungeon");
    if (!dun) return null;
    return { mode: dun.side ? "side" : "combat", scene: "Dungeon", legacyPad: false, pause: null, pauseButton: false, live: true, stick: dun.side ? "x" : "2d", action: null, picker: true };
  },
};


/**
 * Mash presses for a game that reads one press a frame (an edge in a Set): two thumbs landing in the same frame would
 * count once. Every finger is queued and handed over one a frame (a few at most, so nothing trails on after the
 * drumming stops; F10). Pure.
 */
export class MashQueue {
  pending = 0;
  delivered = 0;
  constructor(readonly cap = 4) {}

  /** Fingers that just landed. */
  press(n = 1) {
    this.pending = Math.min(this.cap, this.pending + Math.max(0, n));
  }

  /** May one press go to the game now? (`waiting`: the game hasn't read the last one yet.) */
  next(waiting: boolean): boolean {
    if (waiting || this.pending <= 0) return false;
    this.pending--;
    this.delivered++;
    return true;
  }

  clear() {
    this.pending = 0;
  }
}
