// PHONE MODE: the phone's own settings. One typed object with defaults that are right for almost everyone, kept in
// its OWN storage key (through storageKey, so the two builds keep their own). The game's Settings / MetaState are
// never touched: a laptop's save data stays byte for byte what it was, and a laptop never reads or writes this key
// (only installMobile() attaches the storage, and it returns at once on anything that is not a phone).
//
// Every setting later stages need is here already, so they never have to change the schema. Some are wired now
// (`live: true` in PHONE_SETTINGS), the rest are read by the stage that builds the feature (see README.md).
//
// A settings SCREEN is not built here (stage 2 builds the touch menus); `phoneSettingsList()` is the tiny typed API
// such a screen renders: label, help, type, options, get, set.
import { storageKey } from "../variant";

export type ButtonSize = "S" | "M" | "L";
export type StickMode = "floating" | "fixed";
export type AimAssist = "off" | "normal" | "strong";
export type TextSize = "normal" | "large";

export interface PhoneSettings {
  /** Mirror the thumb controls: stick on the right, buttons on the left. */
  leftHanded: boolean;
  /** S / M / L: 0.85 / 1 / 1.2 times the default sizes (never under the 52 px minimum). */
  buttonSize: ButtonSize;
  /** How strong the controls' outlines are when not pressed (0.2 to 0.8). Pressed is always 0.7 or more. */
  opacity: number;
  /** The stick appears where the thumb lands (floating) or stays in one place (fixed). */
  stick: StickMode;
  /** Combat: fire by itself when auto-aim has an enemy in range (FIRE still works by hand). */
  autoFire: boolean;
  /** Combat: off / normal (sticky auto-aim: keeps its target until it dies or leaves range) / strong. */
  aimAssist: AimAssist;
  /** Phone assist: the forgiving touches on top of the difficulty (wider timing, bigger pickup radius, jump help). */
  phoneAssist: boolean;
  /** Cap the game at 30 frames a second (cooler phone, longer battery). */
  batterySaver: boolean;
  /** Bigger text and bigger tap areas on the canvas (readability.ts). Off until stage 2 has fixed the layouts. */
  readability: boolean;
  /** With readability on: normal (no text under 10 CSS px) or large (12.5). */
  textSize: TextSize;
  /** A short buzz on presses where the phone supports it (Android; iPhone browsers cannot vibrate). */
  haptics: boolean;
  /** Rhythm games: how much later than the music the taps are judged (ms, -300 to 300; Bluetooth needs more). */
  syncOffsetMs: number;
  /** Let the player's own music keep playing under the game (iPhone audio session "ambient" instead of "playback"). */
  playOverMyMusic: boolean;
}

export type PhoneSettingKey = keyof PhoneSettings;

export const DEFAULT_PHONE_SETTINGS: Readonly<PhoneSettings> = Object.freeze({
  leftHanded: false,
  buttonSize: "M",
  opacity: 0.3,
  stick: "floating",
  autoFire: true,
  aimAssist: "normal",
  phoneAssist: true,
  batterySaver: false,
  readability: false,
  textSize: "normal",
  haptics: true,
  syncOffsetMs: 0,
  playOverMyMusic: false,
});

export const PHONE_SETTING_KEYS = Object.keys(DEFAULT_PHONE_SETTINGS) as PhoneSettingKey[];

const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Anything (a stored object, a half-filled one, an old version, junk) to valid settings. */
export function normalizePhoneSettings(raw: unknown): PhoneSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<PhoneSettingKey, unknown>>;
  const D = DEFAULT_PHONE_SETTINGS;
  return {
    leftHanded: bool(r.leftHanded, D.leftHanded),
    buttonSize: oneOf(r.buttonSize, ["S", "M", "L"] as const, D.buttonSize),
    opacity: num(r.opacity, 0.2, 0.8, D.opacity),
    stick: oneOf(r.stick, ["floating", "fixed"] as const, D.stick),
    autoFire: bool(r.autoFire, D.autoFire),
    aimAssist: oneOf(r.aimAssist, ["off", "normal", "strong"] as const, D.aimAssist),
    phoneAssist: bool(r.phoneAssist, D.phoneAssist),
    batterySaver: bool(r.batterySaver, D.batterySaver),
    readability: bool(r.readability, D.readability),
    textSize: oneOf(r.textSize, ["normal", "large"] as const, D.textSize),
    haptics: bool(r.haptics, D.haptics),
    syncOffsetMs: Math.round(num(r.syncOffsetMs, -300, 300, D.syncOffsetMs)),
    playOverMyMusic: bool(r.playOverMyMusic, D.playOverMyMusic),
  };
}

/** The keys whose values differ. */
export function changedKeys(a: PhoneSettings, b: PhoneSettings): PhoneSettingKey[] {
  return PHONE_SETTING_KEYS.filter((k) => a[k] !== b[k]);
}

// ------------------------------------------------------------------ storage

/** Where the settings live between visits. */
export interface PhoneSettingsStore {
  load(): unknown;
  save(s: PhoneSettings): void;
}

/** The storage key (through storageKey: the ALT build keeps its own). */
export const PHONE_SETTINGS_KEY = "krelworld.phone.settings";

/**
 * The real store: one JSON object in localStorage under storageKey(PHONE_SETTINGS_KEY). Written only when a setting
 * changes (never just for loading). Private mode / blocked / full storage never throws: the settings then just last
 * for this visit.
 */
export function localPhoneSettingsStore(storage: Pick<Storage, "getItem" | "setItem"> | null = safeLocalStorage()): PhoneSettingsStore {
  const key = storageKey(PHONE_SETTINGS_KEY);
  return {
    load() {
      try {
        const raw = storage?.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        storage?.setItem(key, JSON.stringify({ v: 1, ...s }));
      } catch {
        /* private mode or full: keep going with the new values in memory */
      }
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage ?? null : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ the live settings

export type PhoneSettingsListener = (s: Readonly<PhoneSettings>, changed: PhoneSettingKey[]) => void;

let current: PhoneSettings = { ...DEFAULT_PHONE_SETTINGS };
let store: PhoneSettingsStore | null = null;
const listeners = new Set<PhoneSettingsListener>();

export function phoneSettings(): Readonly<PhoneSettings> {
  return current;
}

function notify(changed: PhoneSettingKey[]) {
  for (const fn of [...listeners]) {
    try {
      fn(current, changed);
    } catch {
      /* one broken listener must not stop the others */
    }
  }
}

/** Change some settings: saved at once, and every listener hears about it (the touch layer re-lays itself out). */
export function updatePhoneSettings(patch: Partial<PhoneSettings>) {
  const next = normalizePhoneSettings({ ...current, ...patch });
  const changed = changedKeys(current, next);
  if (!changed.length) return;
  current = next;
  try {
    store?.save(current);
  } catch {
    /* storage full or blocked: keep going with the new values */
  }
  notify(changed);
}

/** Back to the defaults (saved, listeners told). */
export function resetPhoneSettings() {
  updatePhoneSettings({ ...DEFAULT_PHONE_SETTINGS });
}

/** Called whenever settings change, with the keys that changed. Returns an unsubscribe function. */
export function onPhoneSettingsChange(fn: PhoneSettingsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Back the settings with a store. Loads at once (and tells the listeners what changed), then saves every change. */
export function usePhoneSettingsStore(s: PhoneSettingsStore | null) {
  store = s;
  if (!s) return;
  let loaded: unknown = null;
  try {
    loaded = s.load();
  } catch {
    loaded = null;
  }
  if (!loaded) return;
  const next = normalizePhoneSettings(loaded);
  const changed = changedKeys(current, next);
  current = next;
  if (changed.length) notify(changed);
}

/** Tests only. */
export function resetPhoneSettingsForTests() {
  current = { ...DEFAULT_PHONE_SETTINGS };
  store = null;
  listeners.clear();
}

// ------------------------------------------------------------------ the list a settings screen renders

export type SettingGroup = "controls" | "combat" | "display" | "sound";

interface SpecBase<K extends PhoneSettingKey> {
  key: K;
  /** UI label (phones only). */
  label: string;
  /** One short line under the label. */
  help: string;
  group: SettingGroup;
  /** Does changing it do something yet? (Stage 2/3 flip this when they wire the feature; a screen may hide the rest.) */
  live: boolean;
}

export type SettingSpec =
  | (SpecBase<PhoneSettingKey> & { type: "toggle" })
  | (SpecBase<PhoneSettingKey> & { type: "choice"; options: readonly { value: string; label: string }[] })
  | (SpecBase<PhoneSettingKey> & { type: "slider"; min: number; max: number; step: number; unit: "%" | "ms" });

/** Every phone setting, in the order a screen shows them. */
export const PHONE_SETTINGS: SettingSpec[] = [
  { key: "leftHanded", type: "toggle", group: "controls", live: true, label: "Left-handed", help: "Stick on the right, buttons on the left." },
  { key: "buttonSize", type: "choice", group: "controls", live: true, label: "Button size", help: "How big the touch buttons are.", options: [{ value: "S", label: "S" }, { value: "M", label: "M" }, { value: "L", label: "L" }] },
  { key: "opacity", type: "slider", group: "controls", live: true, label: "Button visibility", help: "How see-through the buttons are.", min: 0.2, max: 0.8, step: 0.1, unit: "%" },
  { key: "stick", type: "choice", group: "controls", live: true, label: "Stick", help: "Follows your thumb, or stays in one place.", options: [{ value: "floating", label: "FOLLOWS THUMB" }, { value: "fixed", label: "STAYS PUT" }] },
  { key: "haptics", type: "toggle", group: "controls", live: true, label: "Vibration", help: "A little buzz on presses (Android only)." },
  { key: "autoFire", type: "toggle", group: "combat", live: false, label: "Auto-fire", help: "Shoots by itself when an enemy is in range." },
  { key: "aimAssist", type: "choice", group: "combat", live: false, label: "Aim assist", help: "How much the game aims for you.", options: [{ value: "off", label: "OFF" }, { value: "normal", label: "NORMAL" }, { value: "strong", label: "STRONG" }] },
  { key: "phoneAssist", type: "toggle", group: "combat", live: false, label: "Phone assist", help: "Kinder timing and jumping for thumbs." },
  { key: "readability", type: "toggle", group: "display", live: true, label: "Bigger text", help: "Bigger words and easier taps." },
  { key: "textSize", type: "choice", group: "display", live: true, label: "Text size", help: "How big the bigger text is.", options: [{ value: "normal", label: "NORMAL" }, { value: "large", label: "LARGE" }] },
  { key: "batterySaver", type: "toggle", group: "display", live: true, label: "Battery saver", help: "30 frames a second: cooler phone, longer battery." },
  { key: "syncOffsetMs", type: "slider", group: "sound", live: false, label: "Rhythm sync", help: "Taps judged late? Move it up.", min: -300, max: 300, step: 5, unit: "ms" },
  { key: "playOverMyMusic", type: "toggle", group: "sound", live: false, label: "Play over my music", help: "Keep your own music playing under the game." },
];

export type PhoneSettingEntry = SettingSpec & { get(): PhoneSettings[PhoneSettingKey]; set(v: PhoneSettings[PhoneSettingKey]): void };

/** The list with live get / set, for a settings screen. */
export function phoneSettingsList(): PhoneSettingEntry[] {
  return PHONE_SETTINGS.map((spec) => ({
    ...spec,
    get: () => current[spec.key],
    set: (v: PhoneSettings[PhoneSettingKey]) => updatePhoneSettings({ [spec.key]: v } as Partial<PhoneSettings>),
  }));
}
