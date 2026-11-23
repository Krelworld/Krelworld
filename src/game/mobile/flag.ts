// PHONE MODE: is this a phone? Decided once, the first time anything asks (main.ts asks straight after the game is
// created).
//
// A phone is: the screen has touch points, its short side is UNDER 600 CSS px (Android's own line between a phone and
// a tablet is 600 dp, and 600 itself is a tablet: the Fire 7, the Nexus 7 and the 8-inch 1280x800 tablets all report
// exactly 600), it is not a Windows or ChromeOS machine (small Windows tablets and handheld PCs at high scaling report
// phone-sized screens), it is not an Android tablet (Android browsers put "Mobile" in a phone's user agent and leave it
// out on a tablet), the main pointer is a finger (coarse) and nothing can hover. Tablets, touchscreen laptops and
// everything else keep exactly today's game. In node (vitest) there is no window, so it is always false.
//
// The tests run cheapest first and stop at the first "no", so a laptop without a touch screen reads two numbers
// (touch points, screen size) and nothing else: no storage, no media query. A touchscreen laptop or a tablet stops at
// the screen size or the user agent.
//
// Overrides, for development and as an escape hatch:
//   ?mobile=1 (on / true / yes / phone)  phone mode on, for this page load only, on a device with a touch screen
//                                        (a computer with the browser's device emulation). Never remembered, and
//                                        ignored on a computer with no touch screen, so a shared test link can't put
//                                        a friend's laptop into phone mode.
//   ?mobile=0 (off / false / no / desktop / laptop / pc)
//                                        today's game, and remembered (the phone's escape hatch: the only thing ever
//                                        stored, under storageKey so the two builds keep their own).
//   ?mobile=auto (reset)                 forget a remembered choice; the device decides.
//   anything else (or no value)          ignored, as if it weren't there.
// A remembered "1" left by an earlier build is ignored. Storage is read only when it can matter: when the address has a
// ?mobile= choice, or when the device tests say phone (to see whether the player opted out).
import { storageKey } from "../variant";

/** Where the phone's "?mobile=0" opt-out is remembered (through storageKey). */
export const MOBILE_STORAGE_KEY = "krelworld.mobile";
/** Phones only: the short side of the screen, in CSS px, is UNDER this (600 and over is a tablet). */
export const TABLET_MIN_SHORT_SIDE = 600;

/** What the detection looks at. Every field is optional so tests can leave out what they don't need. */
export interface MobileEnv {
  /** `matchMedia(q).matches`; missing when there is no matchMedia (then it is never a phone). */
  media?: (query: string) => boolean;
  maxTouchPoints?: number;
  /** `screen.width` / `screen.height` in CSS px. */
  screen?: { width: number; height: number };
  /** `navigator.userAgent`. */
  ua?: string;
  /** `location.search`, e.g. "?mobile=0". */
  search?: string;
  /** What is remembered under MOBILE_STORAGE_KEY ("0" or null), or how to read it (read only if it can matter). */
  stored?: string | null | (() => string | null);
}

/** Machines that are never phones, whatever the screen says: Windows (tablets, 2-in-1s, handheld PCs), ChromeOS. */
const NOT_A_PHONE_SYSTEM = /Windows NT|CrOS/i;

/** The user agent says tablet or computer: Windows / ChromeOS, or Android without "Mobi" (an Android tablet). */
export function tabletOrComputerUA(ua: string | undefined): boolean {
  const s = ua ?? "";
  return NOT_A_PHONE_SYSTEM.test(s) || (/Android/i.test(s) && !/Mobi/i.test(s));
}

function shortSide(env: MobileEnv): number {
  return Math.min(env.screen?.width ?? 0, env.screen?.height ?? 0);
}

function ask(env: MobileEnv, q: string): boolean {
  try {
    return typeof env.media === "function" && env.media(q) === true;
  } catch {
    return false;
  }
}

/** The device test on its own (no overrides). Cheapest tests first; it stops at the first "no". */
export function detectPhone(env: MobileEnv): boolean {
  if (!((env.maxTouchPoints ?? 0) > 0)) return false;
  const short = shortSide(env);
  if (!(short > 0 && short < TABLET_MIN_SHORT_SIDE)) return false;
  if (tabletOrComputerUA(env.ua)) return false;
  if (typeof env.media !== "function") return false;
  return ask(env, "(pointer: coarse)") && ask(env, "(hover: none)");
}

export type MobileParam = "on" | "off" | "auto" | null;

const PARAM_ON = new Set(["1", "on", "true", "yes", "phone"]);
const PARAM_OFF = new Set(["0", "off", "false", "no", "desktop", "laptop", "pc", "computer"]);
const PARAM_AUTO = new Set(["auto", "reset"]);

/** "?mobile=1" → "on"; "?mobile=0" (or desktop...) → "off"; "?mobile=auto" → "auto"; absent, empty or unknown → null. */
export function parseMobileParam(search: string | undefined): MobileParam {
  if (!search) return null;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (!q.has("mobile")) return null;
  const v = (q.get("mobile") ?? "").trim().toLowerCase();
  if (PARAM_ON.has(v)) return "on";
  if (PARAM_OFF.has(v)) return "off";
  if (PARAM_AUTO.has(v)) return "auto";
  return null;
}

/** What to do to storage: write the opt-out "0", forget it, or nothing. */
export type Remember = "0" | "clear" | null;

/** Why phone mode is on or off: which rule decided, and how each device test came out (for ?mobilediag). */
export interface MobileWhy {
  mobile: boolean;
  /** "address" (?mobile=), "remembered" (an earlier ?mobile=0), "device" (the tests below), "no browser" (node). */
  by: "address" | "remembered" | "device" | "no browser";
  coarse: boolean;
  noHover: boolean;
  touchPoints: number;
  shortSide: number;
  /** The user agent says Windows / ChromeOS, or an Android tablet. */
  tabletUA: boolean;
  /** The device tests alone say phone. */
  device: boolean;
  param: MobileParam;
  stored: string | null;
  /** Anything worth knowing (e.g. "?mobile=1 ignored: no touch screen"). */
  note: string | null;
}

/**
 * The whole decision: the address first, then a remembered opt-out, then the device test. Storage is read only when
 * it can matter. `remember` says what to write: "0", "clear", or null to leave storage alone.
 */
export function resolveMobile(env: MobileEnv): { mobile: boolean; remember: Remember; by: MobileWhy["by"]; note: string | null } {
  let read = false;
  let value: string | null = null;
  const stored = () => {
    if (!read) {
      read = true;
      try {
        value = typeof env.stored === "function" ? env.stored() : env.stored ?? null;
      } catch {
        value = null;
      }
    }
    return value;
  };
  const p = parseMobileParam(env.search);
  const touch = (env.maxTouchPoints ?? 0) > 0;
  if (p === "on") {
    if (touch) return { mobile: true, remember: stored() === "0" ? "clear" : null, by: "address", note: null };
    // (a computer with no touch screen: the address is ignored, it stays the laptop game)
    return { mobile: false, remember: null, by: "device", note: "?mobile=1 ignored: no touch screen" };
  }
  if (p === "off") return { mobile: false, remember: stored() === "0" ? null : "0", by: "address", note: null };
  if (p === "auto") return { mobile: detectPhone(env), remember: stored() !== null ? "clear" : null, by: "device", note: null };
  if (!detectPhone(env)) return { mobile: false, remember: null, by: "device", note: null };
  if (stored() === "0") return { mobile: false, remember: null, by: "remembered", note: null };
  return { mobile: true, remember: null, by: "device", note: null };
}

/** The decision with every device test's answer (pure; asks every test, so only the diagnostics call it). */
export function explainMobile(env: MobileEnv): MobileWhy {
  const r = resolveMobile(env);
  let stored: string | null = null;
  try {
    stored = (typeof env.stored === "function" ? env.stored() : env.stored) ?? null;
  } catch {
    stored = null;
  }
  return {
    mobile: r.mobile,
    by: r.by,
    coarse: ask(env, "(pointer: coarse)"),
    noHover: ask(env, "(hover: none)"),
    touchPoints: env.maxTouchPoints ?? 0,
    shortSide: shortSide(env),
    tabletUA: tabletOrComputerUA(env.ua),
    device: detectPhone(env),
    param: parseMobileParam(env.search),
    stored,
    note: r.note,
  };
}

// ------------------------------------------------------------------ the real browser

function storageNow(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage ?? null : null;
  } catch {
    return null;
  }
}

/** The real browser, read lazily (each field only when a test needs it). */
function browserEnv(): MobileEnv {
  const key = storageKey(MOBILE_STORAGE_KEY);
  return {
    media: typeof window.matchMedia === "function" ? (q) => window.matchMedia(q).matches : undefined,
    maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0,
    screen: typeof screen !== "undefined" ? { width: screen.width, height: screen.height } : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent ?? "" : "",
    search: window.location?.search ?? "",
    stored: () => storageNow()?.getItem(key) ?? null,
  };
}

function hasBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Read the real browser, decide, and write what the address asked for. Never throws. */
function decideAtStartup(): boolean {
  if (!hasBrowser()) return false;
  let r: ReturnType<typeof resolveMobile>;
  try {
    r = resolveMobile(browserEnv());
  } catch {
    return false;
  }
  try {
    const key = storageKey(MOBILE_STORAGE_KEY);
    if (r.remember === "0") storageNow()?.setItem(key, "0");
    else if (r.remember === "clear") storageNow()?.removeItem(key);
  } catch {
    /* private mode or blocked storage: the choice just isn't remembered */
  }
  return r.mobile;
}

let mobile: boolean | null = null;

/** Phone mode? False on laptops (touchscreen ones too), tablets, and in node. Decided on the first call. */
export function isMobile(): boolean {
  if (mobile === null) mobile = decideAtStartup();
  return mobile;
}

/** Why phone mode is what it is (phones' ?mobilediag; worked out when asked, from the same browser). */
export function mobileWhy(): Readonly<MobileWhy> {
  const on = isMobile();
  if (!hasBrowser()) return { mobile: on, by: "no browser", coarse: false, noHover: false, touchPoints: 0, shortSide: 0, tabletUA: false, device: false, param: null, stored: null, note: null };
  try {
    return { ...explainMobile(browserEnv()), mobile: on };
  } catch {
    return { mobile: on, by: "device", coarse: false, noHover: false, touchPoints: 0, shortSide: 0, tabletUA: false, device: false, param: null, stored: null, note: "could not read the browser" };
  }
}

/**
 * Phones (a future "Phone controls: off" row): remember the player's choice for the next visit. "off" = today's game
 * from the next load on; "auto" = forget it (the device decides). Takes effect on the next page load.
 */
export function rememberPhoneMode(choice: "off" | "auto") {
  try {
    const key = storageKey(MOBILE_STORAGE_KEY);
    if (choice === "off") storageNow()?.setItem(key, "0");
    else storageNow()?.removeItem(key);
  } catch {
    /* private mode: for this visit only */
  }
}

/** The phone code could not be loaded (boot.ts): run today's game instead of a phone with no controls. */
export function phoneModeUnavailable() {
  mobile = false;
}

/** Tests only: pretend to be (or not be) a phone. */
export function setMobileForTests(v: boolean) {
  mobile = v;
}
