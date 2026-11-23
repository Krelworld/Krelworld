// LAPTOP SAFETY NET: the devices that must keep today's game. Part of the same net as tests/desktopInvariants.test.ts
// and scripts/desktop-fingerprint.cjs: a phone change must never make one of these fail. If one does, the phone
// detection now catches a laptop, tablet or handheld: fix the detection (src/game/mobile/flag.ts), not this file.
//
// Each device is described the way its browser reports itself (touch points, screen size in CSS px, user agent, and
// the answers to the two media queries). Pure: no browser, no storage.
import { describe, expect, it } from "vitest";
import { detectPhone, resolveMobile, type MobileEnv } from "../src/game/mobile/flag";

const answers = (pointer: "fine" | "coarse" | "none", hover: boolean) => (q: string) => (q === "(pointer: coarse)" ? pointer === "coarse" : q === "(hover: none)" ? !hover : false);

const UA = {
  win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  cros: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  androidTab: "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  fire: "Mozilla/5.0 (Linux; Android 9; KFMUWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/124.2.1 like Chrome/124.0.0.0 Safari/537.36",
  tv: "Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

const dev = (touch: number, w: number, h: number, ua: string, pointer: "fine" | "coarse" | "none", hover: boolean): MobileEnv => ({
  maxTouchPoints: touch,
  screen: { width: w, height: h },
  ua,
  media: answers(pointer, hover),
});

/** Devices that are NOT phones: today's game, exactly. */
const NOT_PHONES: [string, MobileEnv][] = [
  ["laptop (the fingerprint's 1280x720)", dev(0, 1280, 720, UA.win, "fine", true)],
  ["MacBook", dev(0, 1440, 900, UA.mac, "fine", true)],
  ["touchscreen laptop", dev(10, 1280, 720, UA.win, "fine", true)],
  ["touchscreen laptop whose browser says coarse", dev(10, 1366, 768, UA.win, "coarse", true)],
  ["2-in-1 folded into a tablet, no mouse", dev(10, 1280, 800, UA.win, "coarse", false)],
  ["8-inch Windows tablet at 150%, no mouse", dev(10, 853, 533, UA.win, "coarse", false)],
  ["GPD Pocket at 200%", dev(10, 960, 600, UA.win, "coarse", false)],
  ["Steam Deck, desktop mode", dev(10, 1280, 800, UA.linux, "fine", true)],
  ["Steam Deck, Windows at 150%", dev(10, 853, 533, UA.win, "coarse", false)],
  ["Chromebook, tablet mode", dev(10, 1280, 800, UA.cros, "coarse", false)],
  ["iPad (desktop user agent)", dev(5, 820, 1180, UA.mac, "coarse", false)],
  ["iPad mini", dev(5, 744, 1133, UA.mac, "coarse", false)],
  ["Android tablet 800x1280", dev(10, 800, 1280, UA.androidTab, "coarse", false)],
  ["Amazon Fire 7 (600x1024)", dev(10, 600, 1024, UA.fire, "coarse", false)],
  ["Nexus 7 (600x960)", dev(10, 600, 960, UA.androidTab, "coarse", false)],
  ["8-inch 1280x800 tablet at 1.33 (600x1004)", dev(10, 600, 1004, UA.androidTab, "coarse", false)],
  ["Galaxy Z Fold unfolded", dev(10, 690, 829, UA.androidTab, "coarse", false)],
  ["TV browser, no touch", dev(0, 960, 540, UA.tv, "none", false)],
];

describe("laptop safety net: these devices are never phones", () => {
  for (const [name, env] of NOT_PHONES) {
    it(name, () => {
      expect(detectPhone(env)).toBe(false);
      expect(resolveMobile(env)).toMatchObject({ mobile: false, remember: null });
    });
  }

  it("nor after an old ?mobile=1 link left \"1\" in storage, nor with ?mobile=1 on a computer with no touch screen", () => {
    for (const [, env] of NOT_PHONES) expect(resolveMobile({ ...env, stored: "1" })).toMatchObject({ mobile: false, remember: null });
    const laptop = NOT_PHONES[0][1];
    for (const v of ["1", "on", "yes", "", "desktop", "laptop", "banana"]) {
      expect(resolveMobile({ ...laptop, search: `?mobile=${v}` }).mobile, `?mobile=${v}`).toBe(false);
    }
    expect(resolveMobile({ ...laptop, search: "?mobile" }).mobile).toBe(false);
  });

  it("a laptop's decision reads no storage at all", () => {
    let reads = 0;
    const stored = () => {
      reads++;
      return "1";
    };
    for (const [, env] of NOT_PHONES) resolveMobile({ ...env, stored });
    expect(reads).toBe(0);
  });
});
