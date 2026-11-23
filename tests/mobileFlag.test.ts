import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPhone, isMobile, MOBILE_STORAGE_KEY, parseMobileParam, resolveMobile, setMobileForTests, tabletOrComputerUA, type MobileEnv } from "../src/game/mobile/flag";
import { platformFrom } from "../src/game/mobile/platform";

/** A media-query answerer for the given device traits. */
const media = (o: { coarse: boolean; hover: boolean }) => (q: string) => {
  if (q === "(pointer: coarse)") return o.coarse;
  if (q === "(hover: none)") return !o.hover;
  return false;
};

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE_UA = "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET_UA = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FIRE_UA = "Mozilla/5.0 (Linux; Android 9; KFMUWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/124.2.1 like Chrome/124.0.0.0 Safari/537.36";
const WIN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CROS_UA = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
/** Chrome on an Android phone with "Desktop site" ticked. */
const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const COARSE = media({ coarse: true, hover: false });

const IPHONE: MobileEnv = { media: COARSE, maxTouchPoints: 5, screen: { width: 390, height: 844 }, ua: IOS_UA };
const IPHONE_LANDSCAPE: MobileEnv = { ...IPHONE, screen: { width: 844, height: 390 } };
const ANDROID: MobileEnv = { media: COARSE, maxTouchPoints: 5, screen: { width: 360, height: 740 }, ua: ANDROID_PHONE_UA };
const IPAD: MobileEnv = { media: COARSE, maxTouchPoints: 5, screen: { width: 820, height: 1180 }, ua: MAC_UA };
const LAPTOP: MobileEnv = { media: media({ coarse: false, hover: true }), maxTouchPoints: 0, screen: { width: 1440, height: 900 }, ua: WIN_UA };
const TOUCH_LAPTOP: MobileEnv = { media: media({ coarse: false, hover: true }), maxTouchPoints: 10, screen: { width: 1366, height: 768 }, ua: WIN_UA };
/** A touchscreen laptop whose browser says the main pointer is coarse (some do), but it can hover and is big. */
const ODD_TOUCH_LAPTOP: MobileEnv = { media: media({ coarse: true, hover: true }), maxTouchPoints: 10, screen: { width: 1366, height: 768 }, ua: WIN_UA };

describe("phone mode: the device test", () => {
  it("is on for phones, either way round", () => {
    expect(detectPhone(IPHONE)).toBe(true);
    expect(detectPhone(IPHONE_LANDSCAPE)).toBe(true);
    expect(detectPhone(ANDROID)).toBe(true);
    // Firefox and Samsung Internet on a phone; Chrome with "Desktop site" ticked (no Android in the UA)
    expect(detectPhone({ ...ANDROID, ua: "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0" })).toBe(true);
    expect(detectPhone({ ...ANDROID, ua: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36" })).toBe(true);
    expect(detectPhone({ ...ANDROID, ua: LINUX_UA })).toBe(true);
    // an iPhone asking for the desktop site says Macintosh
    expect(detectPhone({ ...IPHONE, ua: MAC_UA })).toBe(true);
    // the biggest phones and a foldable's cover screen
    expect(detectPhone({ ...IPHONE, screen: { width: 430, height: 932 } })).toBe(true);
    expect(detectPhone({ ...ANDROID, screen: { width: 412, height: 915 } })).toBe(true);
  });

  it("is off for laptops, touchscreen laptops and tablets", () => {
    expect(detectPhone(LAPTOP)).toBe(false);
    expect(detectPhone(TOUCH_LAPTOP)).toBe(false);
    expect(detectPhone(ODD_TOUCH_LAPTOP)).toBe(false);
    expect(detectPhone(IPAD)).toBe(false);
  });

  it("600 CSS px and over is a tablet: the Fire 7, the Nexus 7, the 8-inch 1280x800 tablets (L1)", () => {
    // (screen sizes as those tablets report them, with a phone-like user agent so only the size decides)
    for (const [w, h] of [
      [600, 1024],
      [600, 960],
      [600, 1004],
      [600, 900],
      [601, 900],
      [690, 829],
      [744, 1133],
      [800, 1280],
    ]) {
      expect(detectPhone({ ...ANDROID, screen: { width: w, height: h } }), `${w}x${h}`).toBe(false);
    }
    // and with their own user agents
    expect(detectPhone({ media: COARSE, maxTouchPoints: 10, screen: { width: 600, height: 1024 }, ua: FIRE_UA })).toBe(false);
    expect(detectPhone({ media: COARSE, maxTouchPoints: 10, screen: { width: 600, height: 960 }, ua: ANDROID_TABLET_UA })).toBe(false);
  });

  it("Windows and ChromeOS are never phones, whatever the screen size (small tablets, handheld PCs at 150-200%)", () => {
    // an 8-inch Windows tablet at 150%, the Steam Deck on Windows at 150%, the GPD Pocket at 200%: no mouse
    expect(detectPhone({ media: COARSE, maxTouchPoints: 10, screen: { width: 853, height: 533 }, ua: WIN_UA })).toBe(false);
    expect(detectPhone({ media: COARSE, maxTouchPoints: 10, screen: { width: 960, height: 600 }, ua: WIN_UA })).toBe(false);
    expect(detectPhone({ media: COARSE, maxTouchPoints: 10, screen: { width: 533, height: 853 }, ua: CROS_UA })).toBe(false);
  });

  it("an Android tablet's user agent (no \"Mobile\") is a tablet even with a small screen", () => {
    expect(detectPhone({ ...ANDROID, ua: ANDROID_TABLET_UA })).toBe(false);
    expect(detectPhone({ ...ANDROID, ua: FIRE_UA })).toBe(false);
    expect(tabletOrComputerUA(ANDROID_PHONE_UA)).toBe(false);
    expect(tabletOrComputerUA(IOS_UA)).toBe(false);
  });

  it("needs every sign: touch points, a short side under 600, coarse, no hover", () => {
    expect(detectPhone({ ...IPHONE, maxTouchPoints: 0 })).toBe(false);
    expect(detectPhone({ ...IPHONE, media: media({ coarse: false, hover: false }) })).toBe(false);
    expect(detectPhone({ ...IPHONE, media: media({ coarse: true, hover: true }) })).toBe(false);
    expect(detectPhone({ ...IPHONE, screen: { width: 599, height: 900 } })).toBe(true);
    expect(detectPhone({ ...IPHONE, screen: { width: 600, height: 900 } })).toBe(false);
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

  it("a laptop with no touch screen asks no media query at all; a touchscreen laptop or a tablet stops at its size (L3)", () => {
    const asked: string[] = [];
    const spy = (q: string) => {
      asked.push(q);
      return false;
    };
    detectPhone({ ...LAPTOP, media: spy });
    detectPhone({ ...TOUCH_LAPTOP, media: spy });
    detectPhone({ ...IPAD, media: spy });
    detectPhone({ media: spy, maxTouchPoints: 10, screen: { width: 853, height: 533 }, ua: WIN_UA });
    expect(asked).toEqual([]);
  });
});

describe("phone mode: ?mobile= and the remembered opt-out", () => {
  it("reads the address; an empty or unknown value is ignored", () => {
    expect(parseMobileParam("")).toBe(null);
    expect(parseMobileParam("?x=1")).toBe(null);
    expect(parseMobileParam("?mobile=1")).toBe("on");
    expect(parseMobileParam("?a=2&mobile=on")).toBe("on");
    expect(parseMobileParam("?mobile=yes")).toBe("on");
    expect(parseMobileParam("?mobile=0")).toBe("off");
    expect(parseMobileParam("?mobile=off")).toBe("off");
    // a guess at "give me the laptop version" means off, never on (L2)
    expect(parseMobileParam("?mobile=desktop")).toBe("off");
    expect(parseMobileParam("?mobile=laptop")).toBe("off");
    expect(parseMobileParam("?mobile=auto")).toBe("auto");
    expect(parseMobileParam("?mobile")).toBe(null);
    expect(parseMobileParam("?mobile=")).toBe(null);
    expect(parseMobileParam("?mobile=banana")).toBe(null);
  });

  it("?mobile=1 is for this page load only (never stored), and only on a device with a touch screen (L2)", () => {
    expect(resolveMobile({ ...LAPTOP, search: "?mobile=1" })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...LAPTOP, maxTouchPoints: 1, search: "?mobile=1" })).toMatchObject({ mobile: true, remember: null, by: "address" });
    // it clears a phone's earlier opt-out
    expect(resolveMobile({ ...IPHONE, stored: "0", search: "?mobile=1" })).toMatchObject({ mobile: true, remember: "clear" });
  });

  it("?mobile=0 turns it off on a phone and is remembered (only once)", () => {
    expect(resolveMobile({ ...IPHONE, search: "?mobile=0" })).toMatchObject({ mobile: false, remember: "0" });
    expect(resolveMobile({ ...IPHONE, stored: "0", search: "?mobile=0" })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...IPHONE, stored: "0" })).toMatchObject({ mobile: false, remember: null, by: "remembered" });
  });

  it("a remembered \"1\" (left by an earlier build) is ignored: a laptop stays a laptop (L2)", () => {
    expect(resolveMobile({ ...LAPTOP, stored: "1" })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...TOUCH_LAPTOP, stored: "1" })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...IPHONE, stored: "1" })).toMatchObject({ mobile: true, remember: null });
  });

  it("?mobile=auto forgets and goes back to the device test", () => {
    expect(resolveMobile({ ...IPHONE, stored: "0", search: "?mobile=auto" })).toMatchObject({ mobile: true, remember: "clear" });
    expect(resolveMobile({ ...LAPTOP, stored: "1", search: "?mobile=auto" })).toMatchObject({ mobile: false, remember: "clear" });
    expect(resolveMobile({ ...LAPTOP, search: "?mobile=auto" })).toMatchObject({ mobile: false, remember: null });
  });

  it("no address: the device decides, nothing is written, and a laptop never reads storage (L3)", () => {
    let reads = 0;
    const stored = () => {
      reads++;
      return null;
    };
    expect(resolveMobile({ ...LAPTOP, stored })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...TOUCH_LAPTOP, stored })).toMatchObject({ mobile: false, remember: null });
    expect(resolveMobile({ ...IPAD, stored })).toMatchObject({ mobile: false, remember: null });
    expect(reads).toBe(0);
    // (a phone reads it once, to see whether the player opted out)
    expect(resolveMobile({ ...IPHONE, stored })).toMatchObject({ mobile: true, remember: null });
    expect(reads).toBe(1);
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
  async function boot(env: { coarse: boolean; hover: boolean; touch: number; w: number; h: number; search?: string; stored?: Record<string, string>; ua?: string }) {
    const store: Record<string, string> = { ...(env.stored ?? {}) };
    const writes: string[] = [];
    const reads: string[] = [];
    const asked: string[] = [];
    const ls = {
      getItem: (k: string) => {
        reads.push(k);
        return k in store ? store[k] : null;
      },
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
    vi.stubGlobal("window", {
      matchMedia: (q: string) => {
        asked.push(q);
        return { matches: mm(q) };
      },
      location: { search: env.search ?? "" },
      localStorage: ls,
    });
    vi.stubGlobal("document", {});
    vi.stubGlobal("navigator", { maxTouchPoints: env.touch, userAgent: env.ua ?? "" });
    vi.stubGlobal("screen", { width: env.w, height: env.h });
    vi.resetModules();
    const mod = await import("../src/game/mobile/flag");
    const loaded = { reads: reads.length, asked: asked.length };
    return { mobile: mod.isMobile(), writes, store, reads, asked, loaded };
  }

  it("deciding waits for the first question (importing the module reads nothing)", async () => {
    const r = await boot({ coarse: true, hover: false, touch: 5, w: 844, h: 390 });
    expect(r.loaded).toEqual({ reads: 0, asked: 0 });
    expect(r.mobile).toBe(true);
  });

  it("a laptop reads no storage and asks no media query at all; a touchscreen laptop neither (L3)", async () => {
    const plain = await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(plain).toMatchObject({ mobile: false, writes: [], reads: [], asked: [] });
    const touch = await boot({ coarse: false, hover: true, touch: 10, w: 1366, h: 768, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" });
    expect(touch).toMatchObject({ mobile: false, writes: [], reads: [], asked: [] });
  });

  it("a laptop that once opened a ?mobile=1 link (an earlier build stored \"1\") is a laptop (L2)", async () => {
    const r = await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720, stored: { [MOBILE_STORAGE_KEY]: "1" } });
    expect(r).toMatchObject({ mobile: false, writes: [] });
  });

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

  it("?mobile=1 with a touch screen (devtools emulation) turns it on for this load only; without one it is ignored", async () => {
    const r = await boot({ coarse: false, hover: true, touch: 1, w: 1280, h: 720, search: "?mobile=1" });
    expect(r).toMatchObject({ mobile: true, writes: [] });
    const next = await boot({ coarse: false, hover: true, touch: 1, w: 1280, h: 720, stored: r.store });
    expect(next.mobile).toBe(false);
    const mouse = await boot({ coarse: false, hover: true, touch: 0, w: 1280, h: 720, search: "?mobile=1" });
    expect(mouse).toMatchObject({ mobile: false, writes: [] });
  });

  it("?mobile=auto on a phone that opted out forgets it", async () => {
    const back = await boot({ coarse: true, hover: false, touch: 5, w: 844, h: 390, search: "?mobile=auto", stored: { [MOBILE_STORAGE_KEY]: "0" } });
    expect(back.mobile).toBe(true);
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
