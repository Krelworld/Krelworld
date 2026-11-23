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
  handovers = 0;

  /** Start watching: polled once a frame (cheap: navigator.getGamepads is a snapshot), touches come back at once. */
  start(onFrame: (fn: () => void) => () => void) {
    if (this.stop) return;
    const off = onFrame(() => this.poll());
    const back = () => {
      if (currentInputSource() === "pad") setInputSource("touch");
    };
    document.addEventListener("touchstart", back, { capture: true, passive: true });
    this.stop = () => {
      off();
      document.removeEventListener("touchstart", back, { capture: true } as EventListenerOptions);
    };
  }

  poll() {
    if (currentInputSource() === "pad") return;
    if (padActive(firstPad())) {
      setInputSource("pad");
      this.handovers++;
    }
  }

  destroy() {
    this.stop?.();
    this.stop = null;
  }
}

export const PAD_CSS = `.kt.padin,.kt.padin *{visibility:hidden!important;pointer-events:none!important}`;
