// PHONE MODE: a short buzz on a press, where the phone can (Chrome on Android; no iPhone browser can vibrate), behind
// the `haptics` setting (on by default). Never the only feedback: every control also shows a pressed ring.
import { phoneSettings } from "./settings";

/** How long each kind of press buzzes (ms). Research M15: 15 to 25 ms. */
export const HAPTIC_MS = { tap: 12, press: 18, big: 25 } as const;
export type HapticKind = keyof typeof HAPTIC_MS;

/** Buzz now (if the setting is on and the browser can). Must run inside a touch handler. */
export function haptic(kind: HapticKind = "press"): boolean {
  if (!phoneSettings().haptics) return false;
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { vibrate?: (p: number) => boolean }) : null;
    if (!nav || typeof nav.vibrate !== "function") return false;
    return nav.vibrate(HAPTIC_MS[kind]) === true;
  } catch {
    return false;
  }
}
