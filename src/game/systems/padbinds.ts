import { G } from "../G";

/**
 * Gamepad bindings, by W3C "standard" button index (Xbox names; PlayStation pads report the same layout):
 * 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Start · 10 L3 · 11 R3 · 12-15 d-pad.
 * Left stick moves, right stick aims and Start pauses: those are fixed. Everything else is rebindable.
 */
export const PAD_START = 9;
export const PAD_DEFAULTS: Record<string, number[]> = {
  attack: [7, 0],
  special: [6, 3],
  dodge: [1, 5],
  interact: [2],
  bottle: [14],
  bongo: [15],
  burst: [4],
  fart: [13],
  swap: [12],
  transform: [10],
  cume: [11],
  sanmik: [8],
};
/** Movement lives on the left stick; these rows show that instead of a button. */
export const PAD_FIXED: Record<string, string> = { up: "L-Stick ↑", down: "L-Stick ↓", left: "L-Stick ←", right: "L-Stick →" };

const NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "VIEW", "START", "L3", "R3", "D↑", "D↓", "D←", "D→", "HOME"];
export const padLabel = (i: number) => NAMES[i] ?? `B${i}`;

type PadMap = Record<string, number[]> | undefined;

/** The buttons bound to an action, given the saved custom map. */
export function padButtons(custom: PadMap, action: string): number[] {
  const c = custom && typeof custom === "object" ? custom[action] : undefined;
  return Array.isArray(c) && c.every((b) => Number.isInteger(b)) ? c : PAD_DEFAULTS[action] ?? [];
}

/**
 * Rebind an action to a button (pure: returns the new custom map). The button becomes the action's main one,
 * its other defaults stay as backups, and any other action that used that button is handed this action's old
 * main button instead, so nothing ends up with two jobs or no button at all.
 */
export function withPadBinding(custom: PadMap, action: string, btn: number): Record<string, number[]> {
  const next: Record<string, number[]> = { ...(custom ?? {}) };
  const old = padButtons(custom, action);
  const others = Object.keys(PAD_DEFAULTS).filter((id) => id !== action);
  // keep the action's default backups, unless another action has since taken that button
  const backup = (PAD_DEFAULTS[action] ?? []).slice(1).filter((b) => b !== btn && !others.some((id) => padButtons(custom, id).includes(b)));
  next[action] = [btn, ...backup];
  for (const id of others) {
    const cur = padButtons(next, id);
    if (!cur.includes(btn)) continue;
    let rest = cur.filter((b) => b !== btn);
    if (!rest.length && old[0] !== undefined && old[0] !== btn) rest = [old[0]];
    next[id] = rest;
  }
  return next;
}

/** Live: the buttons for an action from the saved settings. */
export function padFor(action: string): number[] {
  return padButtons(G.meta?.settings?.pad, action);
}

export function bindPad(action: string, btn: number) {
  if (btn === PAD_START || !(action in PAD_DEFAULTS)) return;
  G.meta.settings.pad = withPadBinding(G.meta.settings.pad, action, btn);
  G.saveMeta();
}

export function resetPad() {
  G.meta.settings.pad = {};
  G.saveMeta();
}

/** Minimal shape of a Phaser gamepad we need (keeps this testable). */
export interface PadLike { buttons: { value: number; pressed?: boolean }[] }
/** A button counts when it's pressed, or a trigger's past a third of the way down. */
export function btnDown(pad: PadLike | null | undefined, i: number): boolean {
  const b = pad?.buttons?.[i];
  return !!b && (b.pressed || b.value > 0.3);
}
export function padHeld(pad: PadLike | null | undefined, action: string): boolean {
  if (!pad) return false;
  return padFor(action).some((i) => btnDown(pad, i));
}
/** The first button currently down (for "press a button to bind"), or -1. */
export function firstDown(pad: PadLike | null | undefined): number {
  if (!pad?.buttons) return -1;
  for (let i = 0; i < pad.buttons.length; i++) if (btnDown(pad, i)) return i;
  return -1;
}
