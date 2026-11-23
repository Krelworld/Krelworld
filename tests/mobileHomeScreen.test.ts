import { describe, expect, it } from "vitest";
import { browserFrom, inAppFrom, platformFrom } from "../src/game/mobile/platform";
import { guideContent, guideVariant, md, shouldAutoShow, ICONS, type GuideVariant } from "../src/game/mobile/homeScreen";
import { diagWanted, mb, textureEstimate } from "../src/game/mobile/diag";
import { explainMobile } from "../src/game/mobile/flag";
import type Phaser from "phaser";

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iosEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.2903.68 Mobile/15E148 Safari/605.1.15",
  iosFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
  iosInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; en_GB; en-GB; scale=3.00; 1179x2556)",
  iosFacebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.38.109;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBLC/en_GB]",
  iosMessenger: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.48.109;FBBV/1;FBDV/iPhone15,2]",
  iosTikTok: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.2.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/GB",
  iosSnapchat: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.20.0.39 (like Safari/8618.2.12.10.9, panda)",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidEdge: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.2903.70",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0",
  androidInstagram: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 Instagram 357.0.0.25.101 Android",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
};

describe("which browser", () => {
  it("names the browser", () => {
    expect(browserFrom(UA.iosSafari, true)).toBe("safari");
    expect(browserFrom(UA.iosChrome, true)).toBe("chrome");
    expect(browserFrom(UA.iosEdge, true)).toBe("edge");
    expect(browserFrom(UA.iosFirefox, true)).toBe("firefox");
    expect(browserFrom(UA.androidChrome, false)).toBe("chrome");
    expect(browserFrom(UA.androidEdge, false)).toBe("edge");
    expect(browserFrom(UA.androidSamsung, false)).toBe("samsung");
    expect(browserFrom(UA.androidFirefox, false)).toBe("firefox");
  });

  it("spots the apps' own browsers", () => {
    expect(inAppFrom(UA.iosInstagram)).toBe("Instagram");
    expect(inAppFrom(UA.iosFacebook)).toBe("Facebook");
    expect(inAppFrom(UA.iosMessenger)).toBe("Messenger");
    expect(inAppFrom(UA.iosTikTok)).toBe("TikTok");
    expect(inAppFrom(UA.iosSnapchat)).toBe("Snapchat");
    expect(inAppFrom(UA.androidInstagram)).toBe("Instagram");
    expect(inAppFrom(UA.androidWebView)).toBe("this app");
    for (const k of ["iosSafari", "iosChrome", "iosEdge", "iosFirefox", "androidChrome", "androidEdge", "androidSamsung", "androidFirefox"] as const) expect(inAppFrom(UA[k]), k).toBe(null);
  });
});

describe("Add to Home Screen guide: which steps", () => {
  const v = (ua: string, standalone = false) => guideVariant(platformFrom({ ua, navStandalone: standalone }));
  it("picks the guide for the browser the player is in", () => {
    const want: [keyof typeof UA, GuideVariant][] = [
      ["iosSafari", "ios-safari"],
      ["iosChrome", "ios-chrome"],
      ["iosEdge", "ios-edge"],
      ["iosFirefox", "ios-firefox"],
      ["iosInstagram", "in-app"],
      ["iosFacebook", "in-app"],
      ["iosMessenger", "in-app"],
      ["iosTikTok", "in-app"],
      ["iosSnapchat", "in-app"],
      ["androidChrome", "android-chrome"],
      ["androidEdge", "android-edge"],
      ["androidSamsung", "android-samsung"],
      ["androidFirefox", "android-firefox"],
      ["androidInstagram", "in-app"],
    ];
    for (const [ua, g] of want) expect(v(UA[ua]), ua).toBe(g);
    expect(v(UA.iosSafari, true)).toBe("standalone");
  });

  const ctx = { canPrompt: false, hasSave: false, inAppName: null, ios: true };
  const ALL: GuideVariant[] = ["ios-safari", "ios-chrome", "ios-edge", "ios-firefox", "ios-other", "in-app", "android-chrome", "android-edge", "android-samsung", "android-firefox", "android-other"];

  it("every guide has a title, a reason, steps with drawn icons, and never names a keyboard key", () => {
    for (const g of ALL) {
      const c = guideContent(g, { ...ctx, ios: g.startsWith("ios") || g === "in-app" });
      expect(c.title.length, g).toBeGreaterThan(10);
      expect(c.why.length, g).toBeGreaterThan(10);
      expect(c.steps.length, g).toBeGreaterThanOrEqual(2);
      expect(c.steps.length, g).toBeLessThanOrEqual(4);
      for (const s of c.steps) {
        expect(s.icon in ICONS || ["addWord", "installWord", "app"].includes(s.icon), `${g} ${s.icon}`).toBe(true);
        expect(`${s.title} ${s.sub}`).not.toMatch(/\b(Esc|Enter key|SPACE|WASD|Alt\+)\b/);
      }
    }
  });

  it("iPhone Safari: Share (in the top bar; the bars may need a tap), Add to Home Screen, Add, open it from the Home Screen", () => {
    const c = guideContent("ios-safari", ctx);
    expect(c.steps.map((s) => s.icon)).toEqual(["share", "addHome", "addWord", "app"]);
    // top bar when sideways, bottom bar when upright (Safari moves it)
    expect(c.steps[0].sub).toMatch(/\{top\|bottom\} bar/);
    expect(c.steps[0].sub).toMatch(/Tap the \{top\|bottom\} edge/);
    expect(md(c.steps[0].sub)).toContain(`<span class="kah-l">top</span><span class="kah-p">bottom</span> bar`);
    expect(c.why).toMatch(/no browser bars/);
    expect(c.why).toMatch(/sideways/);
  });

  it("iPhone saves: add it first; a player with a save here is told what happens to it", () => {
    expect(guideContent("ios-safari", ctx).note).toMatch(/Add it FIRST: saves made in the browser stay in the browser/);
    expect(guideContent("ios-safari", { ...ctx, hasSave: true }).note).toMatch(/already have a save.*starts fresh/);
    expect(guideContent("ios-chrome", ctx).note).toMatch(/stay in the browser/);
  });

  it("the other iPhone browsers fall back to Safari", () => {
    for (const g of ["ios-chrome", "ios-edge", "ios-firefox"] as GuideVariant[]) expect(guideContent(g, ctx).fallback).toMatch(/Safari/);
    expect(guideContent("ios-other", ctx).primary).toBe("copy");
  });

  it("in-app browsers: open it in Safari / Chrome first, with a copy-link button", () => {
    const ios = guideContent("in-app", { ...ctx, inAppName: "Instagram" });
    expect(ios.title).toMatch(/Safari first/);
    expect(ios.why).toMatch(/Instagram/);
    expect(ios.primary).toBe("copy");
    expect(ios.steps[1].title).toMatch(/Open in Safari/);
    const android = guideContent("in-app", { ...ctx, ios: false, inAppName: "Facebook" });
    expect(android.title).toMatch(/Chrome first/);
    expect(android.steps[0].icon).toBe("dotsV");
  });

  it("Android: a real INSTALL button when the browser offered one, written steps when not; saves come with you", () => {
    const withPrompt = guideContent("android-chrome", { ...ctx, ios: false, canPrompt: true });
    expect(withPrompt.primary).toBe("install");
    expect(withPrompt.steps[0].icon).toBe("install");
    expect(withPrompt.note).toMatch(/saves come with you/);
    const without = guideContent("android-chrome", { ...ctx, ios: false });
    expect(without.primary).toBe("ok");
    expect(without.steps.map((s) => s.icon)).toEqual(["dotsV", "install", "installWord", "app"]);
    expect(guideContent("android-samsung", { ...ctx, ios: false }).steps[1].title).toMatch(/Add page to/);
    expect(guideContent("android-firefox", { ...ctx, ios: false }).steps[0].icon).toBe("dotsV");
    expect(guideContent("android-edge", { ...ctx, ios: false }).steps[1].title).toMatch(/Add to phone/);
  });

  it("shows itself once, on a phone, never from the home screen", () => {
    expect(shouldAutoShow({ phone: true, standalone: false, seen: false })).toBe(true);
    expect(shouldAutoShow({ phone: true, standalone: false, seen: true })).toBe(false);
    expect(shouldAutoShow({ phone: true, standalone: true, seen: false })).toBe(false);
    expect(shouldAutoShow({ phone: false, standalone: false, seen: false })).toBe(false);
  });
});

describe("?mobilediag", () => {
  it("only when the address asks", () => {
    expect(diagWanted("")).toBe(false);
    expect(diagWanted("?mobile=1")).toBe(false);
    expect(diagWanted("?mobilediag")).toBe(true);
    expect(diagWanted("?mobile=1&mobilediag=1")).toBe(true);
    expect(diagWanted("?mobilediag=0")).toBe(false);
  });

  it("estimates texture memory as width x height x 4 over every texture", () => {
    const game = {
      textures: {
        list: {
          __DEFAULT: { source: [{ width: 32, height: 32 }] },
          __MISSING: { source: [{ width: 32, height: 32 }] },
          bg: { source: [{ width: 960, height: 540 }] },
          sheet: { source: [{ width: 1024, height: 1024 }, { width: 512, height: 512 }] },
        },
      },
    } as unknown as Phaser.Game;
    expect(textureEstimate(game)).toEqual({ count: 2, bytes: 960 * 540 * 4 + 1024 * 1024 * 4 + 512 * 512 * 4 });
    expect(mb(917 * 1048576)).toBe("917 MB");
    expect(mb(1.5 * 1048576)).toBe("1.5 MB");
  });

  it("says why phone mode is on or off", () => {
    const phone = { media: (q: string) => q === "(pointer: coarse)" || q === "(hover: none)", maxTouchPoints: 5, screen: { width: 844, height: 390 } };
    expect(explainMobile(phone)).toMatchObject({ mobile: true, by: "device", coarse: true, noHover: true, touchPoints: 5, shortSide: 390, device: true });
    const laptop = { media: (q: string) => q === "(pointer: fine)", maxTouchPoints: 0, screen: { width: 1440, height: 900 } };
    expect(explainMobile({ ...laptop, search: "?mobile=1" })).toMatchObject({ mobile: true, by: "address", device: false, param: "on" });
    expect(explainMobile({ ...laptop, stored: "1" })).toMatchObject({ mobile: true, by: "remembered" });
    expect(explainMobile(laptop)).toMatchObject({ mobile: false, by: "device", coarse: false });
  });
});
