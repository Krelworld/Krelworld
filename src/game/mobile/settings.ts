// PHONE MODE: the touch-control settings the layout reads (left-handed mirror, button size, opacity).
//
// Stage 1 keeps them in memory with defaults that are right for almost everyone. Part 2 adds the Phone settings page
// and backs this object with storage by calling `usePhoneSettingsStore()`; nothing else has to change, because the
// touch layer re-lays itself out whenever `onPhoneSettingsChange` fires.

export type ButtonSize = "S" | "M" | "L";

export interface PhoneSettings {
  /** Mirror the thumb controls: stick on the right, buttons on the left. */
  leftHanded: boolean;
  /** S / M / L: 0.85 / 1 / 1.2 times the default sizes (never under the 52 px minimum). */
  buttonSize: ButtonSize;
  /** How strong the controls' outlines are when not pressed (0.2 to 0.8). Pressed is always 0.7 or more. */
  opacity: number;
}

export const DEFAULT_PHONE_SETTINGS: Readonly<PhoneSettings> = Object.freeze({ leftHanded: false, buttonSize: "M", opacity: 0.3 });

/** Anything (a stored object, a half-filled one, junk) to valid settings. */
export function normalizePhoneSettings(raw: unknown): PhoneSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PhoneSettings, unknown>>;
  const size = r.buttonSize === "S" || r.buttonSize === "L" || r.buttonSize === "M" ? r.buttonSize : DEFAULT_PHONE_SETTINGS.buttonSize;
  const op = typeof r.opacity === "number" && Number.isFinite(r.opacity) ? Math.min(0.8, Math.max(0.2, r.opacity)) : DEFAULT_PHONE_SETTINGS.opacity;
  return { leftHanded: r.leftHanded === true, buttonSize: size, opacity: op };
}

/** Where the settings live between visits (part 2 provides one; until then they reset each visit). */
export interface PhoneSettingsStore {
  load(): unknown;
  save(s: PhoneSettings): void;
}

let current: PhoneSettings = { ...DEFAULT_PHONE_SETTINGS };
let store: PhoneSettingsStore | null = null;
const listeners = new Set<(s: Readonly<PhoneSettings>) => void>();

export function phoneSettings(): Readonly<PhoneSettings> {
  return current;
}

export function updatePhoneSettings(patch: Partial<PhoneSettings>) {
  const next = normalizePhoneSettings({ ...current, ...patch });
  if (next.leftHanded === current.leftHanded && next.buttonSize === current.buttonSize && next.opacity === current.opacity) return;
  current = next;
  try {
    store?.save(current);
  } catch {
    /* storage full or blocked: keep going with the new values */
  }
  for (const fn of [...listeners]) fn(current);
}

/** Called whenever the settings change. Returns an unsubscribe function. */
export function onPhoneSettingsChange(fn: (s: Readonly<PhoneSettings>) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Part 2: back the settings with storage. Loads at once (and tells the listeners), then saves every change. */
export function usePhoneSettingsStore(s: PhoneSettingsStore | null) {
  store = s;
  if (!s) return;
  let loaded: unknown = null;
  try {
    loaded = s.load();
  } catch {
    loaded = null;
  }
  if (loaded) {
    current = normalizePhoneSettings(loaded);
    for (const fn of [...listeners]) fn(current);
  }
}

/** Tests only. */
export function resetPhoneSettingsForTests() {
  current = { ...DEFAULT_PHONE_SETTINGS };
  store = null;
  listeners.clear();
}
