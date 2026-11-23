// PHONE MODE: which phone and browser this is, for the few things that differ (fullscreen and the landscape lock
// exist on Android only; iPhone gets the rotation-lock hint and the Add to Home Screen route). Pure functions of
// what they are given, plus `currentPlatform()` that reads the real browser (phones only).

export interface PlatformInfo {
  ios: boolean;
  android: boolean;
  /** Running from the home screen (no browser bars). */
  standalone: boolean;
  /** Inside an app's own browser (Messenger, Instagram, TikTok...), where Add to Home Screen is impossible. */
  inApp: boolean;
}

export interface PlatformEnv {
  ua: string;
  maxTouchPoints?: number;
  /** matchMedia(...).matches */
  media?: (q: string) => boolean;
  /** navigator.standalone (iOS) */
  navStandalone?: boolean;
}

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Snapchat|TikTok|musical_ly|Bytedance|Line\/|MicroMessenger|Twitter|LinkedInApp|Pinterest|GSA\//i;

export function platformFrom(env: PlatformEnv): PlatformInfo {
  const ua = env.ua || "";
  // (iPadOS asks for desktop pages with a Mac user agent; a Mac with touch points is an iPad)
  const ios = /iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && (env.maxTouchPoints ?? 0) > 1);
  const android = !ios && /Android/i.test(ua);
  let standalone = env.navStandalone === true;
  try {
    if (env.media && (env.media("(display-mode: standalone)") || env.media("(display-mode: fullscreen)"))) standalone = true;
  } catch {
    /* no media queries */
  }
  return { ios, android, standalone, inApp: IN_APP.test(ua) };
}

export function currentPlatform(): PlatformInfo {
  if (typeof navigator === "undefined") return { ios: false, android: false, standalone: false, inApp: false };
  return platformFrom({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    media: typeof matchMedia === "function" ? (q) => matchMedia(q).matches : undefined,
    navStandalone: (navigator as unknown as { standalone?: boolean }).standalone,
  });
}
