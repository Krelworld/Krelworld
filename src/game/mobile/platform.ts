// PHONE MODE: which phone and browser this is, for the few things that differ (fullscreen and the landscape lock
// exist on Android only; iPhone gets the rotation-lock hint; the Add to Home Screen guide has steps per browser).
// Pure functions of what they are given, plus `currentPlatform()` that reads the real browser (phones only).

/** The browser, as far as the Add to Home Screen steps care. */
export type BrowserId = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "opera" | "other";

export interface PlatformInfo {
  ios: boolean;
  android: boolean;
  /** Running from the home screen (no browser bars). */
  standalone: boolean;
  /** Inside an app's own browser (Messenger, Instagram, TikTok...), where Add to Home Screen is impossible. */
  inApp: boolean;
  /** Which app's browser, when inApp ("Instagram", "Facebook", ...), else null. */
  inAppName: string | null;
  browser: BrowserId;
}

export interface PlatformEnv {
  ua: string;
  maxTouchPoints?: number;
  /** matchMedia(...).matches */
  media?: (q: string) => boolean;
  /** navigator.standalone (iOS) */
  navStandalone?: boolean;
  /** The page has put an element into fullscreen (Android's fullscreen game): "display-mode: fullscreen" then matches
   *  in an ordinary browser tab too, so it does not mean "running from the home screen". */
  inElementFullscreen?: boolean;
}

/** In-app browsers, most specific first (Messenger's user agent also says FBAN). */
const IN_APP: [RegExp, string][] = [
  [/Messenger|FBAN\/MessengerForiOS|FB_IAB\/Orca/i, "Messenger"],
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/musical_ly|Bytedance|TikTok|trill_/i, "TikTok"],
  [/Snapchat/i, "Snapchat"],
  [/WhatsApp/i, "WhatsApp"],
  [/Twitter/i, "X"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Pinterest/i, "Pinterest"],
  [/Line\//i, "LINE"],
  [/MicroMessenger/i, "WeChat"],
  [/GSA\//i, "the Google app"],
];

/** Which app's browser this is (null for a real browser). */
export function inAppFrom(ua: string): string | null {
  for (const [re, name] of IN_APP) if (re.test(ua)) return name;
  // an Android WebView inside some other app
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return "this app";
  return null;
}

/** The browser from the user agent (iPhone browsers all use Safari's engine but say who they are). */
export function browserFrom(ua: string, ios: boolean): BrowserId {
  if (ios) {
    if (/CriOS\//.test(ua)) return "chrome";
    if (/EdgiOS\//.test(ua)) return "edge";
    if (/FxiOS\//.test(ua)) return "firefox";
    if (/OPiOS\/|OPT\//.test(ua)) return "opera";
    if (/Version\/[\d.]+.*Safari\//.test(ua)) return "safari";
    return "other";
  }
  if (/SamsungBrowser\//.test(ua)) return "samsung";
  if (/EdgA\/|Edg\//.test(ua)) return "edge";
  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  return "other";
}

export function platformFrom(env: PlatformEnv): PlatformInfo {
  const ua = env.ua || "";
  // (iPadOS asks for desktop pages with a Mac user agent; a Mac with touch points is an iPad)
  const ios = /iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && (env.maxTouchPoints ?? 0) > 1);
  const android = !ios && /Android/i.test(ua);
  let standalone = env.navStandalone === true;
  try {
    if (env.media && (env.media("(display-mode: standalone)") || (env.media("(display-mode: fullscreen)") && !env.inElementFullscreen))) standalone = true;
  } catch {
    /* no media queries */
  }
  const inAppName = inAppFrom(ua);
  return { ios, android, standalone, inApp: inAppName !== null, inAppName, browser: browserFrom(ua, ios) };
}

export function currentPlatform(): PlatformInfo {
  if (typeof navigator === "undefined") return { ios: false, android: false, standalone: false, inApp: false, inAppName: null, browser: "other" };
  return platformFrom({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    media: typeof matchMedia === "function" ? (q) => matchMedia(q).matches : undefined,
    navStandalone: (navigator as unknown as { standalone?: boolean }).standalone,
    inElementFullscreen: typeof document !== "undefined" && !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement),
  });
}
