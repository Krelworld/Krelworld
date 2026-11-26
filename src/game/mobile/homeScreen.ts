// PHONE MODE: the "Add KRELWORLD to your Home Screen" guide (the user's requirement: friends opening a link from the
// group chat, most of whom have never added a web page to their home screen).
//
//  - the right steps for the browser the player is actually in, with drawings of the real buttons (SVG):
//    iPhone Safari; iPhone Chrome / Edge / Firefox / other; in-app browsers (Instagram, Facebook, Messenger, TikTok,
//    Snapchat...: open it in Safari / Chrome first, with a COPY LINK button); Android Chrome and Edge (a real INSTALL
//    button from `beforeinstallprompt`, written steps when the browser has not offered one); Samsung Internet;
//    Firefox on Android; any other Android browser;
//  - one line on why (bigger picture, no browser bars, opens like an app, stays sideways);
//  - saves: on iPhone a home-screen app has its own storage, separate from Safari (WebKit: home-screen web apps are
//    "isolated from Safari"), so it says "add it first" plainly, and tells a player who already has a save here what
//    happens to it. On Android the installed app uses the browser's own storage (web.dev, "WebAPKs on Android":
//    "it will not be segregated away"), so saves come with you;
//  - shown once, on the first phone run, over the title (before a game is started), dismissible; never when the game
//    already runs from the home screen; always reachable later from the title screen, the pause menu and the
//    turn-your-phone screen;
//  - landscape first (844x390, 740x360, 750x340), with an upright version for the turn-your-phone screen.
//
// UI text for phones only: no story, no dialogue. DOM inside #game (so it is visible in Android fullscreen too).
import { isMobile } from "./flag";
import { currentPlatform, type BrowserId, type PlatformInfo } from "./platform";
import { storageKey } from "../variant";
import type { GuideFrom } from "./boot";

// ------------------------------------------------------------------ the drawings (24x24, white strokes)

const svg = (body: string, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="kah-svg"><g fill="${fill ? "#fff" : "none"}" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

export const ICONS = {
  /** iPhone Share: a box open at the top with an arrow up out of it. */
  share: svg(`<path d="M8.5 9.5H6.5v11h11v-11h-2"/><path d="M12 14.5V3"/><path d="M8.5 6.5 12 3l3.5 3.5"/>`),
  /** Newer iPhone Safari's page button at the left of the address bar: a jigsaw piece over two lines (the user's own
   *  iPhone: page button, then Share, then View More, then Add to Home Screen). */
  pageMenu: svg(`<rect x="3" y="2.5" width="10" height="8" rx="1.4" fill="#fff" stroke="none"/><circle cx="14" cy="6.5" r="2.3" fill="#fff" stroke="none"/><circle cx="8" cy="11.2" r="2.1" fill="#fff" stroke="none"/><path d="M3.5 16.5h16M3.5 21h10"/>`),
  /** iPhone "Add to Home Screen": a rounded square with a plus. */
  addHome: svg(`<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>`),
  /** Three dots in a row (•••). */
  dotsH: svg(`<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>`, true),
  /** Three dots in a column (⋮). */
  dotsV: svg(`<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>`, true),
  /** Three lines (☰). */
  lines: svg(`<path d="M4 6.5h16M4 12h16M4 17.5h16"/>`),
  /** A phone with an arrow down into it (install). */
  install: svg(`<rect x="6.5" y="2.5" width="11" height="19" rx="2.2"/><path d="M12 7v7.5M9 11.5l3 3 3-3"/><path d="M10.5 18.5h3"/>`),
  /** A box with an arrow out of it (open in the browser). */
  openOut: svg(`<path d="M13.5 4.5h6v6"/><path d="M19.5 4.5 11 13"/><path d="M17.5 13.5v6h-13v-13h6"/>`),
  /** Safari's compass. */
  compass: svg(`<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>`),
  /** A home screen (a grid of app squares). */
  home: svg(`<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>`),
  /** Two overlapping pages (copy). */
  copy: svg(`<rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>`),
} as const;

export type IconId = keyof typeof ICONS | "addWord" | "installWord" | "app";

// ------------------------------------------------------------------ which guide (pure, unit-tested)

export type GuideVariant =
  | "ios-safari"
  | "ios-chrome"
  | "ios-edge"
  | "ios-firefox"
  | "ios-other"
  | "in-app"
  | "android-chrome"
  | "android-edge"
  | "android-samsung"
  | "android-firefox"
  | "android-other"
  | "standalone"
  | "other";

/** The guide for this phone and browser. */
export function guideVariant(p: Pick<PlatformInfo, "ios" | "android" | "standalone" | "inApp" | "browser">): GuideVariant {
  if (p.standalone) return "standalone";
  if (p.inApp) return "in-app";
  if (p.ios) {
    const m: Partial<Record<BrowserId, GuideVariant>> = { safari: "ios-safari", chrome: "ios-chrome", edge: "ios-edge", firefox: "ios-firefox" };
    return m[p.browser] ?? "ios-other";
  }
  if (p.android) {
    const m: Partial<Record<BrowserId, GuideVariant>> = { chrome: "android-chrome", edge: "android-edge", samsung: "android-samsung", firefox: "android-firefox" };
    return m[p.browser] ?? "android-other";
  }
  return "other";
}

export interface GuideStep {
  icon: IconId;
  /** What to tap (short; the word on the real button in bold via **...**). */
  title: string;
  /** Where it is / what to expect (one short line or two). */
  sub: string;
}

export interface GuideContent {
  variant: GuideVariant;
  title: string;
  why: string;
  steps: GuideStep[];
  /** The saves line (null when there is nothing to say). */
  note: string | null;
  /** The main button: "install" (calls the browser's install prompt), "copy" (copies the link), "ok". */
  primary: "install" | "copy" | "ok";
  /** A smaller line under the steps (a fallback). */
  fallback: string | null;
}

export interface GuideContext {
  /** The browser has offered its install prompt (Android Chrome / Edge / Samsung). */
  canPrompt: boolean;
  /** There is a save in this browser already. */
  hasSave: boolean;
  inAppName: string | null;
  ios: boolean;
}

const OPEN: GuideStep = { icon: "app", title: "Open **KRELWORLD** from your Home Screen", sub: "It opens full screen, like an app." };
const WHY_IOS = "Bigger picture with no browser bars. Opens like an app. Stays sideways.";
const WHY_ANDROID = "Full screen with no browser bars. Opens like an app. Stays sideways.";
const IOS_SAVES = "Add it FIRST: saves made in the browser stay in the browser. The Home Screen app keeps its own saves.";
const IOS_SAVES_HAVE = "You already have a save in this browser. It stays here: the Home Screen app starts fresh, with its own saves.";
const ANDROID_SAVES = "Your saves come with you: the Home Screen app uses this browser's saves.";

/** Everything the guide says, for one variant. */
export function guideContent(v: GuideVariant, c: GuideContext): GuideContent {
  const iosNote = c.hasSave ? IOS_SAVES_HAVE : IOS_SAVES;
  const base = { variant: v, title: "Add KRELWORLD to your Home Screen", fallback: null as string | null };
  const add: GuideStep = { icon: "addWord", title: "Tap **Add**", sub: "Top right. (Leave \"Open as Web App\" on.)" };
  const addHome: GuideStep = { icon: "addHome", title: "Tap **Add to Home Screen**", sub: "Scroll down the list to find it." };
  switch (v) {
    case "ios-safari":
      return {
        ...base,
        why: WHY_IOS,
        steps: [
          { icon: "pageMenu", title: "Tap the **page button**, then **Share**", sub: "Left of the address bar, in the {top|bottom} bar. No bar? Tap the {top|bottom} edge. Or tap **Share** if it's in the bar." },
          { ...addHome, title: "Tap **View More**, then **Add to Home Screen**", sub: "View More is the last round button. Add to Home Screen is at the bottom." },
          add,
          OPEN,
        ],
        note: iosNote,
        primary: "ok",
        // (an app's Safari preview sheet looks like Safari but has no Add to Home Screen)
        fallback: "No **Add to Home Screen** in the list? Tap the compass (or \"Open in Safari\") first.",
      };
    case "ios-chrome":
      return {
        ...base,
        why: WHY_IOS,
        steps: [{ icon: "share", title: "Tap **Share**", sub: "At the right of the address bar (top, or bottom if you moved it)." }, addHome, { ...add, sub: "Top right." }, OPEN],
        note: iosNote,
        primary: "ok",
        fallback: "Not in the list? Open this page in Safari and add it from there.",
      };
    case "ios-edge":
      return {
        ...base,
        why: WHY_IOS,
        steps: [{ icon: "lines", title: "Tap the **menu**, then **Share**", sub: "The menu is at the bottom of the screen." }, addHome, { ...add, sub: "Top right." }, OPEN],
        note: iosNote,
        primary: "ok",
        fallback: "Not in the list? Open this page in Safari and add it from there.",
      };
    case "ios-firefox":
      return {
        ...base,
        why: WHY_IOS,
        steps: [{ icon: "share", title: "Tap **Share**", sub: "In the address bar (or the ☰ menu, then Share)." }, addHome, { ...add, sub: "Top right." }, OPEN],
        note: iosNote,
        primary: "ok",
        fallback: "Not in the list? Open this page in Safari and add it from there.",
      };
    case "ios-other":
      return {
        ...base,
        title: "Open KRELWORLD in Safari to add it",
        why: WHY_IOS,
        steps: [{ icon: "copy", title: "Tap **COPY LINK** below", sub: "Then open Safari." }, { icon: "compass", title: "Paste it into **Safari**", sub: "Tap the address bar, then Paste and Go." }, { icon: "share", title: "Tap **Share**, then **Add to Home Screen**", sub: "Scroll down the list to find it." }, OPEN],
        note: iosNote,
        primary: "copy",
      };
    case "in-app": {
      const app = c.inAppName && c.inAppName !== "this app" ? c.inAppName : "This app";
      const browser = c.ios ? "Safari" : "Chrome";
      return {
        ...base,
        title: `Open KRELWORLD in ${browser} first`,
        why: `${app}'s own browser can't add games to your Home Screen (and keeps its own saves). ${browser} can.`,
        steps: [
          { icon: c.ios ? "dotsH" : "dotsV", title: `Tap **${c.ios ? "•••" : "⋮"}**`, sub: "Usually top right (sometimes bottom right)." },
          { icon: "openOut", title: `Tap **Open in ${browser}**`, sub: "Or \"Open in browser\" / \"Open in external browser\"." },
          { icon: c.ios ? "share" : "dotsV", title: "Then add it to your Home Screen", sub: "This guide shows you how, over there." },
        ],
        note: c.ios ? "Do it before you start: saves made in here stay in here." : null,
        primary: "copy",
        fallback: `No such button? Tap COPY LINK and paste it into ${browser}.`,
      };
    }
    case "android-chrome":
    case "android-edge":
    case "android-samsung":
    case "android-other":
    case "android-firefox": {
      if (c.canPrompt) {
        return {
          ...base,
          why: WHY_ANDROID,
          steps: [{ icon: "install", title: "Tap **INSTALL** below", sub: "Then **Install** in the box that opens." }, OPEN],
          note: ANDROID_SAVES,
          primary: "install",
        };
      }
      const install: GuideStep = { icon: "install", title: "Tap **Add to Home screen**", sub: "Or \"Install app\"." };
      const confirm: GuideStep = { icon: "installWord", title: "Tap **Install** (or **Add**)", sub: "In the box that opens." };
      const steps: Record<string, GuideStep[]> = {
        "android-chrome": [{ icon: "dotsV", title: "Tap **⋮**", sub: "Top right of the screen." }, install, confirm, OPEN],
        "android-edge": [{ icon: "dotsH", title: "Tap **•••**", sub: "Bottom middle of the screen." }, { icon: "install", title: "Tap **Add to phone**", sub: "Or \"Add to Home screen\"." }, confirm, OPEN],
        "android-samsung": [{ icon: "lines", title: "Tap **☰**", sub: "Bottom right of the screen." }, { icon: "addHome", title: "Tap **Add page to**", sub: "Then **Home screen**." }, { ...confirm, icon: "addWord", title: "Tap **Add**" }, OPEN],
        "android-firefox": [{ icon: "dotsV", title: "Tap **⋮**", sub: "Top or bottom right." }, { icon: "install", title: "Tap **Add to Home screen**", sub: "Or \"Add app to Home screen\"." }, { ...confirm, icon: "addWord", title: "Tap **Add**" }, OPEN],
        "android-other": [{ icon: "dotsV", title: "Open the browser's **menu**", sub: "⋮, ••• or ☰, usually top or bottom right." }, install, confirm, OPEN],
      };
      return { ...base, why: WHY_ANDROID, steps: steps[v], note: ANDROID_SAVES, primary: "ok", fallback: v === "android-other" ? "Not there? Open this page in Chrome and add it from there." : null };
    }
    default:
      return { ...base, why: "Opens like an app, with no browser bars.", steps: [{ icon: "lines", title: "Open the browser's **menu**", sub: "Then \"Add to Home Screen\" or \"Install\"." }, OPEN], note: null, primary: "ok" };
  }
}

/** Show it by itself? Once, on a phone, never from the home screen. */
export function shouldAutoShow(o: { phone: boolean; standalone: boolean; seen: boolean }): boolean {
  return o.phone && !o.standalone && !o.seen;
}

/** Is there anything to add (a phone not already running from the home screen)? The title / pause / rotate entries. */
export function homeScreenEntryWanted(): boolean {
  return isMobile() && !currentPlatform().standalone;
}

// ------------------------------------------------------------------ "seen" (its own storage key; phones only)

export const GUIDE_SEEN_KEY = "krelworld.phone.homeScreenGuide";

function readSeen(): boolean {
  try {
    return localStorage.getItem(storageKey(GUIDE_SEEN_KEY)) === "seen";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    localStorage.setItem(storageKey(GUIDE_SEEN_KEY), "seen");
  } catch {
    /* private mode: it may show once more next visit */
  }
}

// ------------------------------------------------------------------ the install prompt (Android)

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
let listening = false;

/** Phones only, as early as possible: keep the browser's install prompt for our INSTALL button. */
export function listenForInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // (our own button instead of the browser's mini bar)
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    guide?.refresh();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    guide?.refresh();
  });
}

export function installPromptReady(): boolean {
  return !!deferred;
}

// ------------------------------------------------------------------ the guide (DOM)

export type { GuideFrom };

export interface GuideOptions {
  hasSave: () => boolean;
  /**
   * Android fullscreen: `can` go full screen now (a small extra button), `go` (inside a tap), whether the game is
   * `inside` it now, and `leave` it (the written steps need the browser's own menu, which fullscreen hides).
   */
  fullscreen?: { can: () => boolean; go: () => void; inside?: () => boolean; leave?: () => void };
  /** The guide opened or closed (the shell sleeps the game under it). */
  onOpenChange?: (open: boolean) => void;
}

/** A guide whose steps go through the browser's own menu (Android written steps, in-app "Open in Chrome"). */
export function needsBrowserBar(c: Pick<GuideContent, "variant" | "primary">): boolean {
  return c.primary !== "install" && (c.variant.startsWith("android-") || c.variant === "in-app");
}

let guide: HomeScreenGuide | null = null;

/** The guide (phones only), or null. */
export function homeScreenGuide(): HomeScreenGuide | null {
  return guide;
}

/** Open the guide (the title and pause-menu entries call this). Does nothing on a laptop. */
export function openHomeScreenGuide(from: GuideFrom = "title") {
  guide?.open(from);
}

/**
 * The guide's little markup: **bold** (the word on the real button), and {sideways|upright} for words that depend on
 * how the phone is held (Safari's bar is at the top when sideways and at the bottom when upright).
 */
export const md = (s: string) =>
  s
    .replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] as string)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\{([^|{}]*)\|([^|{}]*)\}/g, `<span class="kah-l">$1</span><span class="kah-p">$2</span>`);

function iconHtml(id: IconId): string {
  if (id === "addWord") return `<span class="kah-word">Add</span>`;
  if (id === "installWord") return `<span class="kah-word">Install</span>`;
  if (id === "app") return `<span class="kah-app"></span>`;
  return ICONS[id];
}

export class HomeScreenGuide {
  readonly el: HTMLDivElement;
  private card: HTMLDivElement;
  private shown = false;
  private from: GuideFrom = "title";
  private platform: PlatformInfo;
  private toast: HTMLDivElement;
  /** It left fullscreen so the browser's menu shows: back into fullscreen when the player closes it with a tap. */
  private leftFullscreen = false;
  /** What it showed last (tests). */
  last: GuideContent | null = null;

  constructor(
    readonly parent: HTMLElement,
    private opts: GuideOptions,
    platform: PlatformInfo = currentPlatform(),
  ) {
    this.platform = platform;
    const el = document.createElement("div");
    el.className = "kah";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    this.card = document.createElement("div");
    this.card.className = "kah-card";
    el.appendChild(this.card);
    this.toast = document.createElement("div");
    this.toast.className = "kah-toast";
    el.appendChild(this.toast);
    // none of its touches or clicks may reach the game underneath (Phaser listens on the window for touches that
    // land outside the canvas); the card itself still scrolls natively on a very short screen
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel", "mousedown", "mouseup", "click", "pointerdown", "pointerup", "wheel"]) {
      el.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    }
    // a tap on the dark around the card does nothing (no accidental close)
    parent.appendChild(el);
    this.el = el;
    guide = this;
  }

  get isOpen() {
    return this.shown;
  }

  /** The platform it is drawn for (tests swap it). */
  setPlatform(p: PlatformInfo) {
    this.platform = p;
    if (this.shown) this.render();
  }

  open(from: GuideFrom = "title") {
    const was = this.shown;
    this.from = from;
    this.shown = true;
    this.render();
    this.el.classList.add("show");
    writeSeen();
    if (!was) safe(() => this.opts.onOpenChange?.(true), undefined);
  }

  /** Close. `byTap`: inside the player's tap (fullscreen may be asked for again). */
  close(byTap = false) {
    if (!this.shown) return;
    this.shown = false;
    this.el.classList.remove("show");
    if (this.leftFullscreen) {
      this.leftFullscreen = false;
      if (byTap && this.opts.fullscreen?.can()) safe(() => this.opts.fullscreen?.go(), undefined);
    }
    safe(() => this.opts.onOpenChange?.(false), undefined);
  }

  /** The install prompt arrived or went: redraw if open. */
  refresh() {
    if (this.shown) this.render();
  }

  /**
   * Android in fullscreen: steps that go through the browser's menu can't be followed (fullscreen hides it), so leave
   * fullscreen while they show. Closing the guide with a tap goes back in.
   */
  private showBrowserBar(c: GuideContent) {
    const fs = this.opts.fullscreen;
    if (!fs?.inside || !fs.leave || !needsBrowserBar(c)) return;
    if (!safe(() => fs.inside!(), false)) return;
    this.leftFullscreen = true;
    safe(() => fs.leave!(), undefined);
  }

  /** Show by itself once (the first phone run, on the title). */
  maybeAutoShow(): boolean {
    if (this.shown || !shouldAutoShow({ phone: isMobile(), standalone: this.platform.standalone, seen: readSeen() })) return false;
    this.open("first");
    return true;
  }

  private content(): GuideContent {
    return guideContent(guideVariant(this.platform), {
      canPrompt: !!deferred && !installed,
      hasSave: safe(() => this.opts.hasSave(), false),
      inAppName: this.platform.inAppName,
      ios: this.platform.ios,
    });
  }

  private render() {
    const c = this.content();
    this.last = c;
    this.showBrowserBar(c);
    const steps = c.steps
      .map((s, i) => `<li class="kah-step"><span class="kah-n">${i + 1}</span><span class="kah-ico">${iconHtml(s.icon)}</span><span class="kah-txt"><span class="kah-st">${md(s.title)}</span><span class="kah-ss">${md(s.sub)}</span></span></li>`)
      .join("");
    const main = c.primary === "install" ? "INSTALL" : c.primary === "copy" ? "COPY LINK" : "GOT IT";
    const fs = this.platform.android && this.opts.fullscreen?.can() ? `<button type="button" class="kah-b kah-fs" data-act="fs">⛶ FULL SCREEN NOW</button>` : "";
    this.card.className = `kah-card kah-${c.variant} kah-n${c.steps.length}`;
    this.card.innerHTML =
      `<button type="button" class="kah-x" data-act="close" aria-label="Close">✕</button>` +
      `<div class="kah-head"><span class="kah-app kah-head-icon"></span><div class="kah-hd"><div class="kah-title">${md(c.title)}</div><div class="kah-why">${md(c.why)}</div></div></div>` +
      `<ol class="kah-steps">${steps}</ol>` +
      (c.fallback ? `<div class="kah-fb">${md(c.fallback)}</div>` : "") +
      (c.note ? `<div class="kah-note">${md(c.note)}</div>` : "") +
      `<div class="kah-btns"><button type="button" class="kah-b kah-later" data-act="close">${this.from === "first" ? (c.variant === "in-app" ? "PLAY HERE ANYWAY" : "NOT NOW") : "CLOSE"}</button>${fs}<button type="button" class="kah-b kah-main" data-act="${c.primary}">${main}</button></div>`;
    this.el.setAttribute("aria-label", c.title);
    for (const b of Array.from(this.card.querySelectorAll<HTMLElement>("[data-act]"))) this.bindTap(b, () => this.act(b.dataset.act ?? ""));
  }

  /** A tap on a button: acts on touchend (so the browser counts it as the player's gesture), no ghost click after. */
  private bindTap(b: HTMLElement, fn: () => void) {
    let t0: { x: number; y: number; id: number } | null = null;
    b.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      if (t) t0 = { x: t.clientX, y: t.clientY, id: t.identifier };
      b.classList.add("on");
    }, { passive: true });
    b.addEventListener("touchmove", (e) => {
      const t = Array.from(e.changedTouches).find((x) => x.identifier === t0?.id);
      if (t && t0 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 12) {
        t0 = null;
        b.classList.remove("on");
      }
    }, { passive: true });
    b.addEventListener("touchend", (e) => {
      b.classList.remove("on");
      if (!t0) return;
      t0 = null;
      if (e.cancelable) e.preventDefault();
      fn();
    }, { passive: false });
    b.addEventListener("touchcancel", () => {
      t0 = null;
      b.classList.remove("on");
    });
    // (a mouse, for testing with ?mobile=1 on a computer)
    b.addEventListener("click", () => fn());
  }

  private act(a: string) {
    if (a === "close" || a === "ok") return this.close(true);
    if (a === "fs") {
      this.leftFullscreen = false;
      this.opts.fullscreen?.go();
      return this.close(true);
    }
    if (a === "copy") return void this.copyLink();
    if (a === "install") return void this.install();
  }

  private async install() {
    const d = deferred;
    if (!d) return this.render();
    try {
      await d.prompt();
      const r = await d.userChoice;
      deferred = null;
      if (r?.outcome === "accepted") {
        installed = true;
        this.say("Added! Open KRELWORLD from your Home Screen.");
        window.setTimeout(() => this.close(false), 2200);
      } else this.render();
    } catch {
      deferred = null;
      this.render();
    }
  }

  private async copyLink() {
    const url = typeof location !== "undefined" ? location.origin + location.pathname : "";
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        this.el.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, url.length);
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    this.say(ok ? "Link copied. Now paste it into your browser." : `Copy this link: ${url}`);
  }

  private say(text: string) {
    this.toast.textContent = text;
    this.toast.classList.remove("show");
    void this.toast.offsetWidth;
    this.toast.classList.add("show");
  }

  destroy() {
    this.el.remove();
    if (guide === this) guide = null;
  }
}

function safe<T>(fn: () => T, d: T): T {
  try {
    return fn();
  } catch {
    return d;
  }
}

/** For the rotate screen's empty slot: a button that opens the guide. */
export function rotateEntry(onOpen: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "kah-rot";
  b.innerHTML = `${ICONS.addHome}<span>Add to Home Screen</span>`;
  // (the turn-your-phone screen lets its slot's touches through: they must not reach the game from here)
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel", "mousedown", "mouseup", "click"]) b.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  let down = false;
  b.addEventListener("touchstart", () => (down = true), { passive: true });
  b.addEventListener("touchend", (e) => {
    if (!down) return;
    down = false;
    if (e.cancelable) e.preventDefault();
    onOpen();
  }, { passive: false });
  b.addEventListener("click", () => onOpen());
  return b;
}

/**
 * What the page tells a phone about installing (index.html is never edited; these are read only), for ?mobilediag
 * and the smoke test.
 */
export function homeScreenPlumbing(doc: Document = document) {
  const meta = (n: string) => doc.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? null;
  const link = (r: string) => (doc.querySelector(`link[rel="${r}"]`) as HTMLLinkElement | null)?.href ?? null;
  return {
    manifest: link("manifest"),
    appleTouchIcon: link("apple-touch-icon"),
    appleCapable: meta("apple-mobile-web-app-capable"),
    mobileCapable: meta("mobile-web-app-capable"),
    statusBar: meta("apple-mobile-web-app-status-bar-style"),
    appleTitle: meta("apple-mobile-web-app-title"),
    themeColor: meta("theme-color"),
    viewportFitCover: /viewport-fit=cover/.test(meta("viewport") ?? ""),
    installPrompt: !!deferred,
    installed,
  };
}

/** Tests only: pretend the browser offered (or withdrew) its install prompt. */
export function setInstallPromptForTests(e: unknown) {
  deferred = e as InstallPromptEvent | null;
  guide?.refresh();
}
