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

/**
 * Stage 2: what the phone chunk lends the game's combat and HUD code. The game's files only ever reach these behind
 * `if (isMobile())`, and `phoneHooks()` is null on a laptop (and on a phone until the chunk is in), so a laptop never
 * runs any of it. Every hook may answer null / undefined: "do what the game always did".
 */
export interface PhoneHooks {
  /** The Dungeon, every frame, just before the player moves (aiming, auto-fire, phone assist). */
  combatStep?(scene: Phaser.Scene, controls: unknown, dt: number): void;
  /** Controls.aim(): the aim angle the phone controls want (null: the game's own). */
  aim?(scene: Phaser.Scene, px: number, py: number): number | null;
  /** Controls.aimPoint(): where the phone's aim is, in world coordinates (null: the game's own). */
  aimPoint?(scene: Phaser.Scene): { x: number; y: number } | null;
  /** The HUD (UIScene): where its top-right toast column must end (game px) so pause and the weapon chip stay clear. */
  toastRight?(mode: "hub" | "dungeon"): number | null;
  /** The HUD's "special ready" prompt: the word on the touch button to press instead of a key (null: none). */
  readyWord?(which: "burst" | "fart"): string | null;
  /** Player.update's side-scrolling branch (run, jump, drop): true = the phone did it (jump feel, research M6). */
  sideMove?(player: unknown, body: unknown, controls: unknown, mv: { x: number; y: number }, speed: number, dt: number, now: number): boolean;
  /** One-way platforms accept a landing this far below their top (the game's is 14). */
  ledgeTol?(): number;
  /** The menu's CONTROLS on a phone: show the picture of the touch controls (true: shown, skip the keyboard list). */
  controlsPicture?(): boolean;
  /** The finale's brawl starts (SsjBrawl): true = the phone draws its controls (the brawl's canvas pad is skipped). */
  brawl?(brawl: unknown): boolean;
  /** The Kreltality prompt opens: big touch targets for it; returns what takes them away again. */
  finisher?(p: { yes(): void; no(): void; ms?: number; all?: boolean }): (() => void) | null;
  /** Crushers' and steam vents' reach, as a share of the game's (phone assist: a little smaller). */
  hazardScale?(): number;
  /** A side room's pit: where to put the player back (phone assist: further from the edge, the stick waits). */
  pitRespawn?(level: unknown, fellX: number, safeX: number, roomW: number, now: number): number;
  /** Rhythm minigames (stage 3): seconds to take off a tap's judged time (the phone's sound output delay + the setting). */
  rhythmLag?(): number;
  /** Night of Freedom (DriveScene): where the gun aims this frame on a phone (null: the game's own aim). */
  gunAim?(scene: unknown, pointer: { worldX: number; worldY: number; isDown: boolean; wasTouch: boolean }): { x: number; y: number } | null;
  /** Beep Beep: the game's own "hold left / right of the wheel" steering by touch (false on a phone: the stick steers). */
  wheelTouch?(): boolean;
}

let hooks: PhoneHooks | null = null;

/** index.ts (phones only): the phone chunk's hooks for the game's own files. */
export function setPhoneHooks(h: PhoneHooks | null) {
  hooks = h;
}

/** The phone chunk's hooks, or null (always null on a laptop: the game's files ask only behind isMobile()). */
export function phoneHooks(): PhoneHooks | null {
  return isMobile() ? hooks : null;
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
