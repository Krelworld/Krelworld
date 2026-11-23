import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPhone, isMobile, MOBILE_STORAGE_KEY, parseMobileParam, resolveMobile, setMobileForTests, type MobileEnv } from "../src/game/mobile/flag";
import { platformFrom } from "../src/game/mobile/platform";

/** A media-query answerer for the given device traits. */
const media = (o: { coarse: boolean; hover: boolean }) => (q: string) => {
  if (q === "(pointer: coarse)") return o.coarse;
  if (q === "(hover: none)") return !o.hover;
  return false;
};

const IPHONE: MobileEnv = { media: media({ coarse: true, hover: false }), maxTouchPoints: 5, screen: { width: 390, height: 844 } };
const IPHONE_LANDSCAPE: MobileEnv = { ...IPHONE, screen: { width: 844, height: 390 } };
const ANDROID: MobileEnv = { media: media({ coarse: true, hover: false }), maxTouchPoints: 5, screen: { width: 360, height: 740 } };
const IPAD: MobileEnv = { media: media({ coarse: true, hover: false }), maxTouchPoints: 5, screen: { width: 820, height: 1180 } };
const LAPTOP: MobileEnv = { media: media({ coarse: false, hover: true }), maxTouchPoints: 0, screen: { width: 1440, height: 900 } };
const TOUCH_LAPTOP: MobileEnv = { media: media({ coarse: false, hover: true }), maxTouchPoints: 10, screen: { width: 1366, height: 768 } };
/** A touchscreen laptop whose browser says the main pointer is coarse (some do), but it can hover and is big. */
const ODD_TOUCH_LAPTOP: MobileEnv = { media: media({ coarse: true, hover: true }), maxTouchPoints: 10, screen: { width: 1366, height: 768 } };

describe("phone mode: the device test", () => {
  it("is on for phones, either way round", () => {
    expect(detectPhone(IPHONE)).toBe(true);
    expect(detectPhone(IPHONE_LANDSCAPE)).toBe(true);
    expect(detectPhone(ANDROID)).toBe(true);
  });

  it("is off for laptops, touchscreen laptops and tablets", () => {
    expect(detectPhone(LAPTOP)).toBe(false);
    expect(detectPhone(TOUCH_LAPTOP)).toBe(false);
    expect(detectPhone(ODD_TOUCH_LAPTOP)).toBe(false);
    expect(detectPhone(IPAD)).toBe(false);
  });

  it("needs every sign: coarse, no hover, touch points, a short side of 600 or less", () => {
    expect(detectPhone({ ...IPHONE, maxTouchPoints: 0 })).toBe(false);
    expect(detectPhone({ ...IPHONE, media: media({ coarse: false, hover: false }) })).toBe(false);
    expect(detectPhone({ ...IPHONE, media: media({ coarse: true, hover: true }) })).toBe(false);
    expect(detectPhone({ ...IPHONE, screen: { width: 601, height: 900 } })).toBe(false);
    expect(detectPhone({ ...IPHONE, screen: { width: 600, height: 900 } })).toBe(true);
    expect(detectPhone({ ...IPHONE, screen: undefined })).toBe(false);
  });

  it("is off with no matchMedia, or one that throws", () => {
    expect(detectPhone({ ...IPHONE, media: undefined })).toBe(false);
    expect(
      detectPhone({
        ...IPHONE,
        media: () => {
          throw new Error("no");
        },
      }),
    ).toBe(false);
  });
});

describe("phone mode: ?mobile= and the remembered choice", () => {
  it("reads the address", () => {
    expect(parseMobileParam("")).toBe(null);
    expect(parseMobileParam("?x=1")).toBe(null);
    expect(parseMobileParam("?mobile=1")).toBe("on");
    expect(parseMobileParam("?mobile")).toBe("on");
    expect(parseMobileParam("?a=2&mobile=on")).toBe("on");
    expect(parseMobileParam("?mobile=0")).toBe("off");
    expect(parseMobileParam("?mobile=off")).toBe("off");
    expect(parseMobileParam("?mobile=auto")).toBe("auto");
  });

  it("?mobile=1 forces it on a laptop and remembers; ?mobile=0 forces it off on a phone and remembers", () => {
    expect(resolveMobile({ ...LAPTOP, search: "?mobile=1" })).toEqual({ mobile: true, remember: "1" });
    expect(resolveMobile({ ...IPHONE, search: "?mobile=0" })).toEqual({ mobile: false, remember: "0" });
  });

  it("a remembered choice wins over the device test; the address wins over both", () => {
    expect(resolveMobile({ ...IPHONE, stored: "0" })).toEqual({ mobile: false, remember: null });
    expect(resolveMobile({ ...LAPTOP, stored: "1" })).toEqual({ mobile: true, remember: null });
    expect(resolveMobile({ ...IPHONE, stored: "0", search: "?mobile=1" })).toEqual({ mobile: true, remember: "1" });
  });

  it("?mobile=auto forgets and goes back to the device test", () => {
    expect(resolveMobile({ ...IPHONE, stored: "0", search: "?mobile=auto" })).toEqual({ mobile: true, remember: "clear" });
    expect(resolveMobile({ ...LAPTOP, stored: "1", search: "?mobile=auto" })).toEqual({ mobile: false, remember: "clear" });
  });

  it("no address and nothing remembered: the device decides, and nothing is written", () => {
    expect(resolveMobile(LAPTOP)).toEqual({ mobile: false, remember: null });
    expect(resolveMobile(IPHONE)).toEqual({ mobile: true, remember: null });
  });
});

describe("phone mode: at startup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("is false in node (no window), as on a laptop", () => {
    expect(typeof window).toBe("undefined");
    expect(isMobile()).toBe(false);
  });

  it("setMobileForTests flips it", () => {
    setMobileForTests(true);
    expect(isMobile()).toBe(true);
    setMobileForTests(false);
    expect(isMobile()).toBe(false);
  });

  /** Load the module fresh against a pretend browser. */
  async function boot(env: { coarse: boolean; hover: boolean; touch: number; w: number; h: number; search?: string; stored?: Record<string, string> }) {
    const store: Record<string, string> = { ...(env.stored ?? {}) };
    const writes: string[] = [];
    const ls = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        writes.push(`set ${k}=${v}`);
        store[k] = v;
      },
      removeItem: (k: string) => {
        writes.push(`remove ${k}`);
        delete store[k];
      },
    };
    const mm = media({ coarse: env.coarse, hover: env.hover });
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: mm(q) }), location: { search: env.search ?? "" }, localStorage: ls });
    vi.stubGlobal("document", {});
    vi.stubGlobal("navigator", { maxTouchPoints: env.touch, userAgent: "" });
    vi.stubGlobal("screen", { width: env.w, height: env.h });
    vi.resetModules();
    const mod = await import("../src/game/mobile/flag");
    return { mobile: mod.isMobile(), writes, store };
  }

  it("a phone comes up in phone mode and writes nothing", async () => {
    const r = await boot({ coarse: true, hover: false, touch: 5, w: 844, h: 390 });
    expect(r.mobile).toBe(true);
    expect(r.writes).toEqual([]);
  });

  it("a laptop (touchscreen or not) comes up as today and writes nothing", async () => {
    expect(await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720 })).toMatchObject({ mobile: false, writes: [] });
    expect(await boot({ coarse: false, hover: true, touch: 10, w: 1366, h: 768 })).toMatchObject({ mobile: false, writes: [] });
  });

  it("?mobile=0 on a phone is remembered (normal build key), and the next visit stays off", async () => {
    const r = await boot({ coarse: true, hover: false, touch: 5, w: 844, h: 390, search: "?mobile=0" });
    expect(r.mobile).toBe(false);
    expect(r.writes).toEqual([`set ${MOBILE_STORAGE_KEY}=0`]);
    const again = await boot({ coarse: true, hover: false, touch: 5, w: 844, h: 390, stored: r.store });
    expect(again.mobile).toBe(false);
    expect(again.writes).toEqual([]);
  });

  it("?mobile=1 on a laptop turns it on; ?mobile=auto forgets", async () => {
    const r = await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720, search: "?mobile=1" });
    expect(r.mobile).toBe(true);
    const back = await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720, search: "?mobile=auto", stored: r.store });
    expect(back.mobile).toBe(false);
    expect(back.writes).toEqual([`remove ${MOBILE_STORAGE_KEY}`]);
  });

  it("storage that throws: still decides, never throws", async () => {
    vi.stubGlobal("window", {
      matchMedia: (q: string) => ({ matches: media({ coarse: true, hover: false })(q) }),
      location: { search: "?mobile=1" },
      get localStorage() {
        throw new Error("blocked");
      },
    });
    vi.stubGlobal("document", {});
    vi.stubGlobal("navigator", { maxTouchPoints: 5 });
    vi.stubGlobal("screen", { width: 844, height: 390 });
    vi.resetModules();
    const mod = await import("../src/game/mobile/flag");
    expect(mod.isMobile()).toBe(true);
  });
});

describe("phone mode: which phone", () => {
  const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  const ANDROID_UA = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
  it("tells iPhone from Android, and spots a home-screen app and an in-app browser", () => {
    expect(platformFrom({ ua: IOS_UA })).toEqual({ ios: true, android: false, standalone: false, inApp: false, inAppName: null, browser: "safari" });
    expect(platformFrom({ ua: ANDROID_UA })).toEqual({ ios: false, android: true, standalone: false, inApp: false, inAppName: null, browser: "chrome" });
    expect(platformFrom({ ua: IOS_UA, navStandalone: true }).standalone).toBe(true);
    expect(platformFrom({ ua: ANDROID_UA, media: (q) => q === "(display-mode: fullscreen)" }).standalone).toBe(true);
    // the game's own fullscreen in a browser tab also matches display-mode: fullscreen: that is not the home screen
    expect(platformFrom({ ua: ANDROID_UA, media: (q) => q === "(display-mode: fullscreen)", inElementFullscreen: true }).standalone).toBe(false);
    expect(platformFrom({ ua: ANDROID_UA, media: (q) => q === "(display-mode: standalone)", inElementFullscreen: true }).standalone).toBe(true);
    expect(platformFrom({ ua: IOS_UA + " Instagram 300.0" }).inApp).toBe(true);
    expect(platformFrom({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 }).ios).toBe(true);
  });
});
