// PHONE MODE: a controller connected to the phone (research S6, DEFERRED R11).
//
// The game already reads pads (Phaser's gamepad plugin, src/game/combat/Controls.ts and friends). On a phone the touch
// controls would sit over the picture doing nothing, so: the first button press or stick push on a pad hides the touch
// layer (the decision carries `input: "pad"`), and the next finger on the screen brings it back. A pad's right stick
// aims in the top-down fights (combat.ts's aim hook steps aside while it is pushed).

import { currentInputSource, setInputSource } from "./modes";

/** A stick pushed this far, or a button this far down, counts as the player picking the pad up. */
export const PAD_WAKE = Object.freeze({ axis: 0.35, button: 0.5 });

interface PadLike {
  connected?: boolean;
  buttons: readonly { pressed?: boolean; value?: number }[];
  axes: readonly number[];
}

/** Is anyone using this pad right now (a button down, a stick pushed)? Pure, for tests. */
export function padActive(p: PadLike | null | undefined): boolean {
  if (!p || p.connected === false) return false;
  for (const b of p.buttons) if (b && (b.pressed || (b.value ?? 0) > PAD_WAKE.button)) return true;
  for (const a of p.axes) if (Math.abs(a) > PAD_WAKE.axis) return true;
  return false;
}

/** A pad's state at rest: which buttons are down and where every axis sits (some pads rest a trigger at -1, a worn
 *  stick drifts, a button can rest pressed). Taken when the pad is first seen and whenever a finger takes over. */
export interface PadRest {
  id: string;
  buttons: boolean[];
  axes: number[];
}

const down = (b: { pressed?: boolean; value?: number } | undefined) => !!b && (!!b.pressed || (b.value ?? 0) > PAD_WAKE.button);

export function padRest(p: PadLike & { id?: string }): PadRest {
  return { id: p.id ?? "", buttons: p.buttons.map(down), axes: [...p.axes] };
}

/** Has the player picked this pad up since `rest`: a button that was up is now down, or an axis has moved more than
 *  PAD_WAKE.axis away from where it rested? Change, not state: a pad resting off-centre never takes over. Pure. */
export function padWoke(p: PadLike | null | undefined, rest: PadRest | null): boolean {
  if (!p || p.connected === false || !rest) return false;
  for (let i = 0; i < p.buttons.length; i++) if (down(p.buttons[i]) && !rest.buttons[i]) return true;
  for (let i = 0; i < p.axes.length; i++) if (Math.abs(p.axes[i] - (rest.axes[i] ?? 0)) > PAD_WAKE.axis) return true;
  return false;
}

/** The first connected pad's right stick (x, y), or null. */
export function rightStick(): { x: number; y: number } | null {
  const p = firstPad();
  if (!p || p.axes.length < 4) return null;
  return { x: p.axes[2], y: p.axes[3] };
}

function firstPad(): PadLike | null {
  try {
    const list = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected !== false) return p as unknown as PadLike;
  } catch {
    /* not allowed here */
  }
  return null;
}

export class PadHandover {
  private stop: (() => void) | null = null;
  private rest: PadRest | null = null;
  /** A finger took over since the rest was taken: a button down now is resting there, not a press. */
  private touched = false;
  handovers = 0;

  /** Start watching: polled once a frame (cheap: navigator.getGamepads is a snapshot), touches come back at once. */
  start(onFrame: (fn: () => void) => () => void) {
    if (this.stop) return;
    const off = onFrame(() => this.poll());
    const back = () => {
      if (currentInputSource() === "pad") setInputSource("touch");
      // (the pad as it is now is the pad at rest: only a new press or push hands over again)
      this.rest = null;
      // (only a pad that is there now rests as it is; one that shows up later starts from all buttons up)
      this.touched = !!firstPad();
    };
    document.addEventListener("touchstart", back, { capture: true, passive: true });
    this.stop = () => {
      off();
      document.removeEventListener("touchstart", back, { capture: true } as EventListenerOptions);
    };
  }

  poll() {
    const p = firstPad() as (PadLike & { id?: string }) | null;
    if (currentInputSource() === "pad") {
      this.rest = null;
      return;
    }
    if (!p) {
      this.rest = null;
      this.touched = false;
      return;
    }
    // (a pad just connected, a different pad, or the first frame after a finger took over: this is its rest)
    if (!this.rest || this.rest.id !== (p.id ?? "") || this.rest.buttons.length !== p.buttons.length || this.rest.axes.length !== p.axes.length) {
      this.rest = padRest(p);
      // (a pad seen for the first time: browsers only show one after a press on it, and that press counts; after a
      // finger took over, whatever is down now is resting there)
      if (!this.touched) this.rest.buttons = this.rest.buttons.map(() => false);
      this.touched = false;
      if (!padWoke(p, this.rest)) return;
      setInputSource("pad");
      this.handovers++;
      return;
    }
    if (padWoke(p, this.rest)) {
      setInputSource("pad");
      this.handovers++;
      return;
    }
    // (a button let go counts as up from now on, so pressing it again wakes the pad)
    for (let i = 0; i < p.buttons.length; i++) if (!down(p.buttons[i])) this.rest.buttons[i] = false;
  }

  destroy() {
    this.stop?.();
    this.stop = null;
  }
}

export const PAD_CSS = `.kt.padin,.kt.padin *{visibility:hidden!important;pointer-events:none!important}`;
