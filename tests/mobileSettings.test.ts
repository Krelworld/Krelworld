import { afterEach, describe, expect, it } from "vitest";
import {
  changedKeys,
  DEFAULT_PHONE_SETTINGS,
  localPhoneSettingsStore,
  normalizePhoneSettings,
  onPhoneSettingsChange,
  PHONE_SETTING_KEYS,
  PHONE_SETTINGS,
  PHONE_SETTINGS_KEY,
  phoneSettings,
  phoneSettingsList,
  resetPhoneSettings,
  resetPhoneSettingsForTests,
  updatePhoneSettings,
  usePhoneSettingsStore,
} from "../src/game/mobile/settings";
import { storageKey } from "../src/game/variant";

/** A localStorage stand-in that records every write. */
function memStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const writes: string[] = [];
  return {
    data,
    writes,
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

/** Private mode: every call throws. */
const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("phone settings: defaults and cleaning", () => {
  afterEach(() => resetPhoneSettingsForTests());

  it("has the defaults later stages rely on", () => {
    expect(phoneSettings()).toEqual({
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
  });

  it("cleans up whatever it is given (junk, out of range, an older version with fewer fields)", () => {
    expect(normalizePhoneSettings(null)).toEqual(DEFAULT_PHONE_SETTINGS);
    expect(normalizePhoneSettings("junk")).toEqual(DEFAULT_PHONE_SETTINGS);
    const n = normalizePhoneSettings({ leftHanded: "yes", buttonSize: "XL", opacity: 5, aimAssist: "max", syncOffsetMs: 999.4, stick: "fixed", textSize: "huge" });
    expect(n).toEqual({ ...DEFAULT_PHONE_SETTINGS, opacity: 0.8, syncOffsetMs: 300, stick: "fixed" });
    expect(normalizePhoneSettings({ leftHanded: true, buttonSize: "S", opacity: 0 })).toEqual({ ...DEFAULT_PHONE_SETTINGS, leftHanded: true, buttonSize: "S", opacity: 0.2 });
    expect(normalizePhoneSettings({ syncOffsetMs: -42.6 }).syncOffsetMs).toBe(-43);
  });

  it("knows which keys changed", () => {
    expect(changedKeys(DEFAULT_PHONE_SETTINGS, { ...DEFAULT_PHONE_SETTINGS, haptics: false, buttonSize: "L" }).sort()).toEqual(["buttonSize", "haptics"]);
  });

  it("every setting has exactly one row in the list a settings screen renders", () => {
    expect(PHONE_SETTINGS.map((s) => s.key).sort()).toEqual([...PHONE_SETTING_KEYS].sort());
    for (const s of PHONE_SETTINGS) {
      expect(s.label.length).toBeGreaterThan(2);
      expect(s.help.length).toBeGreaterThan(5);
      if (s.type === "choice") for (const o of s.options) expect(normalizePhoneSettings({ [s.key]: o.value })[s.key]).toBe(o.value);
    }
  });
});

describe("phone settings: live changes", () => {
  afterEach(() => resetPhoneSettingsForTests());

  it("tells listeners what changed, once per real change", () => {
    const seen: [string, string[]][] = [];
    onPhoneSettingsChange((s, changed) => seen.push([s.buttonSize, changed]));
    updatePhoneSettings({ buttonSize: "L" });
    updatePhoneSettings({ buttonSize: "L" });
    updatePhoneSettings({ leftHanded: true, opacity: 0.5 });
    expect(seen).toEqual([
      ["L", ["buttonSize"]],
      ["L", ["leftHanded", "opacity"]],
    ]);
  });

  it("a broken listener does not stop the others", () => {
    let heard = 0;
    onPhoneSettingsChange(() => {
      throw new Error("boom");
    });
    onPhoneSettingsChange(() => heard++);
    updatePhoneSettings({ haptics: false });
    expect(heard).toBe(1);
  });

  it("unsubscribes", () => {
    let heard = 0;
    const off = onPhoneSettingsChange(() => heard++);
    off();
    updatePhoneSettings({ haptics: false });
    expect(heard).toBe(0);
  });

  it("the typed list gets and sets live values", () => {
    const list = phoneSettingsList();
    const size = list.find((e) => e.key === "buttonSize")!;
    expect(size.get()).toBe("M");
    size.set("S");
    expect(phoneSettings().buttonSize).toBe("S");
    const read = list.find((e) => e.key === "readability")!;
    read.set(true);
    expect(read.get()).toBe(true);
    resetPhoneSettings();
    expect(phoneSettings()).toEqual(DEFAULT_PHONE_SETTINGS);
  });
});

describe("phone settings: storage", () => {
  afterEach(() => resetPhoneSettingsForTests());
  const KEY = storageKey(PHONE_SETTINGS_KEY);

  it("uses its own key (through storageKey), never the game's settings", () => {
    expect(KEY).toBe("krelworld.phone.settings");
    expect(KEY).not.toMatch(/krelworld\.(save|settings|meta)$/);
  });

  it("loading writes nothing; a change is saved; the next visit loads it", () => {
    const st = memStorage();
    usePhoneSettingsStore(localPhoneSettingsStore(st));
    expect(st.writes).toEqual([]);
    updatePhoneSettings({ leftHanded: true, buttonSize: "L", readability: true });
    expect(st.writes).toEqual([KEY]);
    const stored = JSON.parse(st.data.get(KEY)!);
    expect(stored).toMatchObject({ v: 1, leftHanded: true, buttonSize: "L", readability: true });
    // next visit
    resetPhoneSettingsForTests();
    const heard: string[][] = [];
    onPhoneSettingsChange((_s, changed) => heard.push(changed));
    usePhoneSettingsStore(localPhoneSettingsStore(st));
    expect(phoneSettings()).toMatchObject({ leftHanded: true, buttonSize: "L", readability: true, opacity: 0.3 });
    expect(heard).toEqual([["leftHanded", "buttonSize", "readability"]]);
  });

  it("a stored object from an older or newer version is cleaned, not trusted", () => {
    const st = memStorage({ [KEY]: JSON.stringify({ v: 9, buttonSize: "XXL", opacity: 0.6, somethingNew: 1 }) });
    usePhoneSettingsStore(localPhoneSettingsStore(st));
    expect(phoneSettings()).toEqual({ ...DEFAULT_PHONE_SETTINGS, opacity: 0.6 });
    const bad = memStorage({ [KEY]: "{not json" });
    resetPhoneSettingsForTests();
    usePhoneSettingsStore(localPhoneSettingsStore(bad));
    expect(phoneSettings()).toEqual(DEFAULT_PHONE_SETTINGS);
  });

  it("private mode (storage throws): nothing throws, the settings still work for this visit", () => {
    expect(() => usePhoneSettingsStore(localPhoneSettingsStore(brokenStorage))).not.toThrow();
    expect(() => updatePhoneSettings({ leftHanded: true })).not.toThrow();
    expect(phoneSettings().leftHanded).toBe(true);
    expect(() => usePhoneSettingsStore(localPhoneSettingsStore(null))).not.toThrow();
  });

  it("a store whose own methods throw is survived too", () => {
    usePhoneSettingsStore({
      load: () => {
        throw new Error("nope");
      },
      save: () => {
        throw new Error("nope");
      },
    });
    expect(() => updatePhoneSettings({ haptics: false })).not.toThrow();
    expect(phoneSettings().haptics).toBe(false);
  });
});
