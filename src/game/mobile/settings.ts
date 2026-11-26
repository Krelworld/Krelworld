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
/**
 * "stays" (the default): the stick appears where the thumb lands and its base stays there for that touch (pulling past
 * the rim is simply full speed that way); "follows": the base is dragged along behind the thumb past the rim (the old
 * default, "floating" in stored settings before the thumb-feel round); "fixed": always the same spot.
 */
export type StickMode = "stays" | "follows" | "fixed";
export type AimAssist = "off" | "normal" | "strong";
export type TextSize = "normal" | "large";
/**
 * How fights fire on a phone. "hold" (the default since the user played it: "both auto firing and auto aiming. It was
 * so easy") never shoots by itself: hold FIRE and the game aims at an enemy in front of you (within aim.ts CONE_DEG of
 * the way you face, on screen, not behind a wall); slide FIRE to aim by hand. "auto" is EASY in Settings: the old
 * stage 2 way, shooting by itself at any enemy in range and aiming all round you. "light" (auto at a slower pace) and
 * "still" (auto only while you stand still) came from the auto-fire audit (ga-02); the Settings row no longer offers
 * them (they only made fights harder and felt broken) but they still work if set. FIRE held works the same in all.
 */
export type FireStyle = "auto" | "light" | "still" | "hold";
export const FIRE_STYLES: readonly FireStyle[] = ["auto", "light", "still", "hold"];

export interface PhoneSettings {
  /** Mirror the thumb controls: stick on the right, buttons on the left. */
  leftHanded: boolean;
  /** S / M / L: 0.85 / 1 / 1.2 times the default sizes (never under the 52 px minimum). */
  buttonSize: ButtonSize;
  /** How strong the controls' outlines are when not pressed (0.2 to 0.8). Pressed is always 0.7 or more. */
  opacity: number;
  /** Where the stick's base goes: where the thumb lands and stays there, follows the thumb, or one fixed spot. */
  stick: StickMode;
  /** Combat: fire by itself when auto-aim has an enemy in range (FIRE still works by hand). Off by default: HOLD. */
  autoFire: boolean;
  /** Combat: the firing style when auto-fire is on (see FireStyle; `autoFire: false` is "hold" whatever this says). */
  firing: FireStyle;
  /** Combat: off / normal (sticky auto-aim: keeps its target until it dies or leaves range) / strong. */
  aimAssist: AimAssist;
  /** Phone assist: the forgiving touches on top of the difficulty (wider timing, bigger pickup radius, jump help). */
  phoneAssist: boolean;
  /** Cap the game at 30 frames a second (cooler phone, longer battery). */
  batterySaver: boolean;
  /** Bigger text on the canvas (readability.ts): labels at least 11 CSS px, reading text 16. On by default (stage 2). */
  readability: boolean;
  /** With readability on: normal (labels 11 CSS px, reading 16) or large (x1.25). */
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
  stick: "stays",
  // (HOLD FIRE is the default: auto-fire, EASY in Settings, is a choice; the user found auto-fire with all-round aim
  // too easy)
  autoFire: false,
  firing: "auto",
  aimAssist: "normal",
  phoneAssist: true,
  batterySaver: false,
  // (on since stage 2, when every menu and conversation was laid out for it; anyone who turned it off keeps it off)
  readability: true,
  textSize: "normal",
  haptics: true,
  syncOffsetMs: 0,
  playOverMyMusic: false,
});

export const PHONE_SETTING_KEYS = Object.keys(DEFAULT_PHONE_SETTINGS) as PhoneSettingKey[];

const oneOf = <T extends string>(v: unknown, opts: readonly T[]): T | undefined => (typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);

/** One setting's value, cleaned (clamped into range), or undefined if it isn't a valid value for that setting. */
export function cleanSetting<K extends PhoneSettingKey>(k: K, v: unknown): PhoneSettings[K] | undefined {
  const out = ((): unknown => {
    switch (k) {
      case "buttonSize":
        return oneOf(v, ["S", "M", "L"] as const);
      case "opacity":
        return num(v, 0.2, 0.8);
      case "stick":
        // ("floating" was the old default, a base that followed the thumb: it is read as the new default; F-STICK)
        return v === "floating" ? "stays" : oneOf(v, ["stays", "follows", "fixed"] as const);
      case "aimAssist":
        return oneOf(v, ["off", "normal", "strong"] as const);
      case "firing":
        return oneOf(v, FIRE_STYLES);
      case "textSize":
        return oneOf(v, ["normal", "large"] as const);
      case "syncOffsetMs": {
        const n = num(v, -300, 300);
        return n === undefined ? undefined : Math.round(n);
      }
      default:
        return bool(v);
    }
  })();
  return out as PhoneSettings[K] | undefined;
}

/** The defaults now (tests may stand in a later stage's defaults). */
let defaults: Readonly<PhoneSettings> = DEFAULT_PHONE_SETTINGS;

/** Anything (a stored object, a half-filled one, an old version, junk) to valid settings: the defaults where missing. */
export function normalizePhoneSettings(raw: unknown): PhoneSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<PhoneSettingKey, unknown>>;
  const out = { ...defaults } as PhoneSettings;
  for (const k of PHONE_SETTING_KEYS) {
    const v = cleanSetting(k, r[k]);
    if (v !== undefined) (out as Record<PhoneSettingKey, unknown>)[k] = v;
  }
  return out;
}

/** The keys whose values differ. */
export function changedKeys(a: PhoneSettings, b: PhoneSettings): PhoneSettingKey[] {
  return PHONE_SETTING_KEYS.filter((k) => a[k] !== b[k]);
}

// ------------------------------------------------------------------ storage

/**
 * What is stored: ONLY the settings the player chose ({ v: 2, buttonSize: "L" }), never the defaults, so when a later
 * stage changes a default (stage 2 turns readability on) everyone who never chose that setting gets the new one,
 * whatever else they changed. Version 1 (part 2 of stage 1, never shipped) stored every field: reading one, only the
 * values that differ from version 1's defaults count as chosen.
 */
export const PHONE_SETTINGS_VERSION = 3;

/** The defaults version 1 was written with (a copy: DEFAULT_PHONE_SETTINGS may change later; this must not). */
const V1_DEFAULTS: Readonly<Record<PhoneSettingKey, unknown>> = Object.freeze({
  leftHanded: false,
  buttonSize: "M",
  opacity: 0.3,
  stick: "floating",
  autoFire: true,
  firing: "auto",
  aimAssist: "normal",
  phoneAssist: true,
  batterySaver: false,
  readability: false,
  textSize: "normal",
  haptics: true,
  syncOffsetMs: 0,
  playOverMyMusic: false,
});

/** A stored object → the settings the player chose (cleaned; anything invalid or unknown is left out). */
export function chosenFromStored(raw: unknown): Partial<PhoneSettings> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Record<PhoneSettingKey, unknown>> = {};
  for (const k of PHONE_SETTING_KEYS) {
    if (!(k in r)) continue;
    const v = cleanSetting(k, r[k]);
    if (v === undefined) continue;
    // (version 1 wrote every field: one still at version 1's default was never a choice)
    if (r.v === 1 && v === V1_DEFAULTS[k]) continue;
    // (the old default stick, "floating", stored by a version that kept it as a choice: it follows the new default)
    if (k === "stick" && r[k] === "floating") continue;
    // (before version 3 auto-fire was the default: "on", and the auto-fire flavours, follow the new default, HOLD;
    // a phone that had turned auto-fire off was on HOLD already and stays there)
    if (version(r) < 3 && ((k === "autoFire" && v === true) || (k === "firing" && v !== "hold"))) continue;
    out[k] = v;
  }
  return out as Partial<PhoneSettings>;
}

/** A stored object's version (an object without one is version 1, the first that was ever stored). */
function version(r: Record<string, unknown>): number {
  return typeof r.v === "number" && Number.isFinite(r.v) ? r.v : 1;
}

/** Where the settings live between visits. */
export interface PhoneSettingsStore {
  load(): unknown;
  /** The settings the player chose (only those). */
  save(chosen: Partial<PhoneSettings>): void;
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
    save(chosen) {
      try {
        storage?.setItem(key, JSON.stringify({ v: PHONE_SETTINGS_VERSION, ...chosen }));
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

/** The settings the player chose (what is stored). */
let chosen: Partial<PhoneSettings> = {};
let current: PhoneSettings = { ...DEFAULT_PHONE_SETTINGS };
let store: PhoneSettingsStore | null = null;
const listeners = new Set<PhoneSettingsListener>();

export function phoneSettings(): Readonly<PhoneSettings> {
  return current;
}

/** The settings the player chose themselves (the rest follow the defaults). */
export function chosenPhoneSettings(): Readonly<Partial<PhoneSettings>> {
  return { ...chosen };
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

function save() {
  try {
    store?.save({ ...chosen });
  } catch {
    /* storage full or blocked: keep going with the new values */
  }
}

/** Change some settings (the player's choice): saved at once, and every listener hears about it. */
export function updatePhoneSettings(patch: Partial<PhoneSettings>) {
  const next: Partial<Record<PhoneSettingKey, unknown>> = { ...chosen };
  let chose = false;
  for (const k of Object.keys(patch ?? {}) as PhoneSettingKey[]) {
    if (!PHONE_SETTING_KEYS.includes(k)) continue;
    const v = cleanSetting(k, patch[k]);
    if (v === undefined) continue;
    if (next[k] !== v || !(k in chosen)) chose = true;
    next[k] = v;
  }
  if (!chose) return;
  chosen = next as Partial<PhoneSettings>;
  const was = current;
  current = normalizePhoneSettings(chosen);
  save();
  const changed = changedKeys(was, current);
  if (changed.length) notify(changed);
}

/** Back to the defaults: nothing chosen any more (saved, listeners told). */
export function resetPhoneSettings() {
  const was = current;
  chosen = {};
  current = normalizePhoneSettings(chosen);
  save();
  const changed = changedKeys(was, current);
  if (changed.length) notify(changed);
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
  chosen = chosenFromStored(loaded);
  const was = current;
  current = normalizePhoneSettings(chosen);
  const changed = changedKeys(was, current);
  if (changed.length) notify(changed);
}

/** Tests only. */
export function resetPhoneSettingsForTests() {
  defaults = DEFAULT_PHONE_SETTINGS;
  chosen = {};
  current = { ...DEFAULT_PHONE_SETTINGS };
  store = null;
  listeners.clear();
}

/** Tests only: stand in different defaults (as a later stage might ship), as if the game had just loaded. */
export function setPhoneDefaultsForTests(d: Partial<PhoneSettings>) {
  defaults = Object.freeze({ ...DEFAULT_PHONE_SETTINGS, ...d });
  current = normalizePhoneSettings(chosen);
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
  /** The value the row shows, when it is worked out from more than its own key (Firing: `autoFire` off reads HOLD). */
  read?: (s: Readonly<PhoneSettings>) => PhoneSettings[PhoneSettingKey];
  /** Other settings a choice on this row also sets (Firing keeps `autoFire` in step). */
  also?: (v: PhoneSettings[PhoneSettingKey]) => Partial<PhoneSettings>;
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
  { key: "stick", type: "choice", group: "controls", live: true, label: "Stick", help: "Stays where your thumb lands, follows your thumb, or one fixed spot.", options: [{ value: "stays", label: "STAYS" }, { value: "follows", label: "FOLLOWS" }, { value: "fixed", label: "FIXED" }] },
  { key: "haptics", type: "toggle", group: "controls", live: true, label: "Vibration", help: "A little buzz on presses (Android only)." },
  {
    key: "firing",
    type: "choice",
    group: "combat",
    live: true,
    label: "Firing",
    help: "HOLD: you hold FIRE. EASY: it shoots for you.",
    options: [{ value: "hold", label: "HOLD" }, { value: "auto", label: "EASY" }],
    read: (s) => fireStyle(s),
    also: (v) => ({ autoFire: v !== "hold" }),
  },
  { key: "aimAssist", type: "choice", group: "combat", live: true, label: "Aim assist", help: "How much the game aims for you.", options: [{ value: "off", label: "OFF" }, { value: "normal", label: "NORMAL" }, { value: "strong", label: "STRONG" }] },
  { key: "phoneAssist", type: "toggle", group: "combat", live: true, label: "Phone assist", help: "Picks things up for you; kinder dodges and jumps." },
  { key: "readability", type: "toggle", group: "display", live: true, label: "Bigger text", help: "Bigger words in menus and conversations." },
  { key: "textSize", type: "choice", group: "display", live: true, label: "Text size", help: "How big the bigger text is.", options: [{ value: "normal", label: "NORMAL" }, { value: "large", label: "LARGE" }] },
  { key: "batterySaver", type: "toggle", group: "display", live: true, label: "Battery saver", help: "30 frames a second: cooler phone, longer battery." },
  { key: "syncOffsetMs", type: "slider", group: "sound", live: true, label: "Rhythm sync", help: "Taps judged late? Move it up.", min: -300, max: 300, step: 5, unit: "ms" },
  { key: "playOverMyMusic", type: "toggle", group: "sound", live: false, label: "Play over my music", help: "Keep your own music playing under the game." },
];

export type PhoneSettingEntry = SettingSpec & { get(): PhoneSettings[PhoneSettingKey]; set(v: PhoneSettings[PhoneSettingKey]): void };

/** The list with live get / set, for a settings screen. */
export function phoneSettingsList(): PhoneSettingEntry[] {
  return PHONE_SETTINGS.map((spec) => ({
    ...spec,
    get: () => (spec.read ? spec.read(current) : current[spec.key]),
    set: (v: PhoneSettings[PhoneSettingKey]) => updatePhoneSettings({ [spec.key]: v, ...(spec.also?.(v) ?? {}) } as Partial<PhoneSettings>),
  }));
}

/** The firing style in force: `autoFire` off (the stage 2 toggle, still honoured) is HOLD whatever `firing` says. */
export function fireStyle(s: Pick<PhoneSettings, "autoFire" | "firing"> = current): FireStyle {
  return s.autoFire === false ? "hold" : s.firing;
}
