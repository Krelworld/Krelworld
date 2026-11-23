// PHONE MODE: the only phone code a laptop loads. main.ts and the title / pause menu import from here (and UIScene from
// flag.ts); everything else in this folder is a separate chunk that is fetched only on a phone
// (`import("./index")`), so a laptop never downloads, parses or runs it.
//
// On a laptop installMobile() asks isMobile() (a touch-points and screen-size check, nothing else on a computer without
// a touch screen) and returns. The two title / pause helpers below answer "no" until the phone chunk has registered
// itself, which on a laptop is never.
import type Phaser from "phaser";
import { isMobile, phoneModeUnavailable } from "./flag";

export type GuideFrom = "first" | "title" | "pause" | "rotate" | "test";

/** What the phone chunk lends the game's own files (set by index.ts's installMobile). */
export interface PhoneEntryPoints {
  /** A phone not already running from the home screen: offer the Add to Home Screen guide. */
  homeScreenEntryWanted(): boolean;
  openHomeScreenGuide(from: GuideFrom): void;
}

let entry: PhoneEntryPoints | null = null;

/** index.ts: the phone chunk is installed; these are its entry points. */
export function setPhoneEntryPoints(e: PhoneEntryPoints | null) {
  entry = e;
}

/** Title / pause menu (phones only): offer the Add to Home Screen guide here? False on a laptop. */
export function homeScreenEntryWanted(): boolean {
  if (!isMobile() || !entry) return false;
  try {
    return entry.homeScreenEntryWanted();
  } catch {
    return false;
  }
}

/** Title / pause menu (phones only): open the Add to Home Screen guide. Does nothing on a laptop. */
export function openHomeScreenGuide(from: GuideFrom = "title") {
  entry?.openHomeScreenGuide(from);
}

/** How many times to try fetching the phone chunk before giving up (a flaky connection on the first load). */
const LOAD_TRIES = 3;

/**
 * main.ts, right after the game is created. Phones: fetch the phone code and install it. Anything else: nothing at
 * all (no import, no listener, no element, no storage).
 */
export function installMobile(game: Phaser.Game) {
  if (!isMobile()) return;
  load(game, 1);
}

function load(game: Phaser.Game, attempt: number) {
  import("./index")
    .then((m) => m.installMobile(game))
    .catch((e) => {
      if (attempt < LOAD_TRIES) {
        window.setTimeout(() => load(game, attempt + 1), 1500 * attempt);
        return;
      }
      // no phone controls could be loaded: today's game (the old touch pad) rather than a phone with no controls
      console.warn("phone controls could not be loaded; using the plain touch controls", e);
      phoneModeUnavailable();
    });
}
