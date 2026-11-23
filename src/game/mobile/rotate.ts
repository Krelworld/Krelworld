// PHONE MODE: "turn your phone sideways". A plain DOM screen (so it also covers the boot load), shown whenever the
// phone is upright. While it is up the shell sleeps the game loop and holds the sound (see shell.ts).
import type { PlatformInfo } from "./platform";

const PHONE_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <rect x="38" y="14" width="44" height="92" rx="8" fill="none" stroke="#ffd23f" stroke-width="5"/>
  <rect x="52" y="20" width="16" height="4" rx="2" fill="#ffd23f"/>
  <circle cx="60" cy="96" r="3.5" fill="#ffd23f"/>
</svg>`;

/** Is the screen taller than it is wide? */
export function isPortrait(w: number, h: number): boolean {
  return h > w;
}

/** The words, by phone. (UI text for the phone only: no story, no dialogue.) */
export function rotateWords(p: Pick<PlatformInfo, "ios" | "android">): { title: string; sub: string; hint: string } {
  const title = "TURN YOUR PHONE SIDEWAYS";
  const sub = "KRELWORLD is played with the phone on its side.";
  if (p.ios) return { title, sub, hint: "Still upright? Rotation Lock is probably on: swipe down from the top-right corner and tap the padlock to turn it off." };
  if (p.android) return { title, sub, hint: "Still upright? Turn on Auto-rotate: swipe down from the top of the screen and tap it." };
  return { title, sub, hint: "" };
}

export class RotateOverlay {
  readonly el: HTMLDivElement;
  /** An empty slot under the words for later stages (the Add to Home Screen guide's button goes here). */
  readonly extra: HTMLDivElement;
  private shown = false;

  constructor(parent: HTMLElement, platform: Pick<PlatformInfo, "ios" | "android">) {
    const w = rotateWords(platform);
    const el = document.createElement("div");
    el.className = "krot";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", w.title);
    el.innerHTML = `<div class="krot-in"><div class="krot-phone">${PHONE_SVG}</div><div class="krot-title"></div><div class="krot-sub"></div><div class="krot-hint"></div><div class="krot-extra"></div></div>`;
    (el.querySelector(".krot-title") as HTMLElement).textContent = w.title;
    (el.querySelector(".krot-sub") as HTMLElement).textContent = w.sub;
    (el.querySelector(".krot-hint") as HTMLElement).textContent = w.hint;
    this.extra = el.querySelector(".krot-extra") as HTMLDivElement;
    // nothing under it may be touched (and no page zoom or scroll from it)
    const stop = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(".krot-extra")) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("touchmove", stop, { passive: false });
    el.addEventListener("touchend", stop, { passive: false });
    parent.appendChild(el);
    this.el = el;
  }

  get visible() {
    return this.shown;
  }

  set(show: boolean) {
    if (show === this.shown) return;
    this.shown = show;
    this.el.classList.toggle("show", show);
  }
}
