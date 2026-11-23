// PHONE MODE: is this a phone? Decided once, when the page loads.
//
// A phone is: the main pointer is a finger (coarse), nothing can hover, the screen has touch points, and the short
// side of the screen is at most 600 CSS px. Tablets (short side over 600) and touchscreen laptops (a fine pointer that
// hovers) keep exactly today's game. In node (vitest) there is no window, so it is always false.
//
// Overrides, for development and as an escape hatch: "?mobile=1" turns phone mode on (a laptop with the browser's
// device emulation), "?mobile=0" turns it off on a phone, "?mobile=auto" forgets the choice. The choice is remembered
// (localStorage, through storageKey so the two builds keep their own), and only ever written when the address asks
// for it: a normal laptop visit never writes anything.
import { storageKey } from "../variant";

/** Where a "?mobile=" choice is remembered (through storageKey). */
export const MOBILE_STORAGE_KEY = "krelworld.mobile";
/** Phones only: the short side of the screen, in CSS px, at most this. */
export const PHONE_MAX_SHORT_SIDE = 600;

/** What the detection looks at. Every field is optional so tests can leave out what they don't need. */
export interface MobileEnv {
  /** `matchMedia(q).matches`; missing when there is no matchMedia (then it is never a phone). */
  media?: (query: string) => boolean;
  maxTouchPoints?: number;
  /** `screen.width` / `screen.height` in CSS px. */
  screen?: { width: number; height: number };
  /** `location.search`, e.g. "?mobile=1". */
  search?: string;
  /** What is remembered under MOBILE_STORAGE_KEY ("1", "0" or null). */
  stored?: string | null;
}

/** The device test on its own (no overrides). */
export function detectPhone(env: MobileEnv): boolean {
  if (typeof env.media !== "function") return false;
  let coarse = false;
  let noHover = false;
  try {
    coarse = env.media("(pointer: coarse)");
    noHover = env.media("(hover: none)");
  } catch {
    return false;
  }
  const touch = (env.maxTouchPoints ?? 0) > 0;
  const w = env.screen?.width ?? 0;
  const h = env.screen?.height ?? 0;
  const short = Math.min(w, h);
  return coarse && noHover && touch && short > 0 && short <= PHONE_MAX_SHORT_SIDE;
}

/** "?mobile=1" (also "on", "true", empty) → "on"; "0" / "off" / "false" → "off"; "auto" → "auto"; absent → null. */
export function parseMobileParam(search: string | undefined): "on" | "off" | "auto" | null {
  if (!search) return null;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (!q.has("mobile")) return null;
  const v = (q.get("mobile") ?? "").trim().toLowerCase();
  if (v === "auto" || v === "reset") return "auto";
  if (v === "0" || v === "off" || v === "false" || v === "no") return "off";
  return "on";
}

/**
 * The whole decision: the address first, then a remembered choice, then the device test.
 * `remember` says what to store: "1" / "0", "clear" to forget, or null to leave storage alone.
 */
export function resolveMobile(env: MobileEnv): { mobile: boolean; remember: "1" | "0" | "clear" | null } {
  const p = parseMobileParam(env.search);
  if (p === "on") return { mobile: true, remember: "1" };
  if (p === "off") return { mobile: false, remember: "0" };
  if (p === "auto") return { mobile: detectPhone(env), remember: "clear" };
  if (env.stored === "1") return { mobile: true, remember: null };
  if (env.stored === "0") return { mobile: false, remember: null };
  return { mobile: detectPhone(env), remember: null };
}

/** Why phone mode is on or off: which rule decided, and how each device test came out (for ?mobilediag). */
export interface MobileWhy {
  mobile: boolean;
  /** "address" (?mobile=), "remembered" (an earlier ?mobile= choice), "device" (the tests below), "no browser" (node). */
  by: "address" | "remembered" | "device" | "no browser";
  coarse: boolean;
  noHover: boolean;
  touchPoints: number;
  shortSide: number;
  /** The device tests alone say phone. */
  device: boolean;
  param: "on" | "off" | "auto" | null;
  stored: string | null;
}

/** The decision with its reasons (pure). */
export function explainMobile(env: MobileEnv): MobileWhy {
  const q = (s: string) => {
    try {
      return typeof env.media === "function" && env.media(s);
    } catch {
      return false;
    }
  };
  const param = parseMobileParam(env.search);
  const stored = env.stored ?? null;
  const by: MobileWhy["by"] = param === "on" || param === "off" ? "address" : param !== "auto" && (stored === "1" || stored === "0") ? "remembered" : "device";
  return {
    mobile: resolveMobile(env).mobile,
    by,
    coarse: q("(pointer: coarse)"),
    noHover: q("(hover: none)"),
    touchPoints: env.maxTouchPoints ?? 0,
    shortSide: Math.min(env.screen?.width ?? 0, env.screen?.height ?? 0),
    device: detectPhone(env),
    param,
    stored,
  };
}

let why: MobileWhy = { mobile: false, by: "no browser", coarse: false, noHover: false, touchPoints: 0, shortSide: 0, device: false, param: null, stored: null };

/** Why phone mode is what it is (decided once at load). */
export function mobileWhy(): Readonly<MobileWhy> {
  return why;
}

/** Read the real browser, decide, and remember an address choice. Never throws. */
function decideAtStartup(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const key = storageKey(MOBILE_STORAGE_KEY);
  let stored: string | null = null;
  try {
    stored = window.localStorage?.getItem(key) ?? null;
  } catch {
    stored = null;
  }
  const env: MobileEnv = {
    media: typeof window.matchMedia === "function" ? (q) => window.matchMedia(q).matches : undefined,
    maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0,
    screen: typeof screen !== "undefined" ? { width: screen.width, height: screen.height } : undefined,
    search: window.location?.search ?? "",
    stored,
  };
  const r = resolveMobile(env);
  try {
    why = explainMobile(env);
  } catch {
    /* only for the diagnostics */
  }
  try {
    if (r.remember === "1" || r.remember === "0") window.localStorage?.setItem(key, r.remember);
    else if (r.remember === "clear" && stored !== null) window.localStorage?.removeItem(key);
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
  return r.mobile;
}

let mobile = decideAtStartup();

/** Phone mode? False on laptops (touchscreen ones too), tablets, and in node. */
export function isMobile(): boolean {
  return mobile;
}

/** Tests only: pretend to be (or not be) a phone. */
export function setMobileForTests(v: boolean) {
  mobile = v;
}
