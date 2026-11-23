// PHONE MODE: first-time cues (research S10, "teach in the moment"). The first time a control matters it pulses (the
// idle stick until the player has walked with it, ACTION until it has been pressed once); once used it never pulses
// again on this phone. Remembered under its own key (storageKey: the ALT build keeps its own); storage that throws
// (private mode) just means the cue can come back next visit. Phones only (the phone chunk is the only caller).
import { storageKey } from "../variant";

export const CUES_KEY = "krelworld.phone.cues";

let seen: Record<string, true> | null = null;

function load(): Record<string, true> {
  if (seen) return seen;
  seen = {};
  try {
    const raw = window.localStorage.getItem(storageKey(CUES_KEY));
    const o = raw ? JSON.parse(raw) : null;
    if (o && typeof o === "object") for (const k of Object.keys(o)) if (o[k] === true) seen[k] = true;
  } catch {
    /* private mode: this visit only */
  }
  return seen;
}

/** Has the player already used this control (on this phone)? */
export function cueSeen(id: string): boolean {
  return !!load()[id];
}

/** The player used it: no more pulsing. Saved at once. */
export function markCue(id: string) {
  const s = load();
  if (s[id]) return;
  s[id] = true;
  try {
    window.localStorage.setItem(storageKey(CUES_KEY), JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

/** Tests: forget what was learned (in memory and storage). */
export function resetCues() {
  seen = {};
  try {
    window.localStorage.removeItem(storageKey(CUES_KEY));
  } catch {
    /* fine */
  }
}
