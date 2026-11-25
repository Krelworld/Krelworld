// PHONE MODE, stage 3: the minigames by touch. The pure part (no Phaser, no DOM): the touch wording of the minigames'
// instruction lines, which buttons a game shows, the rhythm lag, the crocodile's three columns, the corner under pause.
//
// The wording rows are control instructions shown by the game's own UI (a minigame's how-to line, a button's key
// caption, RuneScape's system messages), never a character's line: each is anchored to the whole caption it swaps,
// and only reaches the scenes listed in GAME_UI_TEXTS / GAME_STORY_LINES. tests/mobileGames.test.ts checks each still
// exists in the game as written, and tests/mobileWordingScan.test.ts that none matches a character line.
import type { WordingRule } from "./wording";

/** Key wording → touch wording for the minigames (phones only; the laptop lines are unchanged). */
export const GAME_WORDING: WordingRule[] = [
  // DEADLIFT: "Mash Tap / SPACE. Don't stop. The HGH is doing most of the work."
  { id: "mg-deadlift", re: /^Mash Tap \/ SPACE\. /, to: "Mash the screen (two thumbs!). " },
  // FLIP IT: "Click problems before they ROT (or arrows/WASD to pick, SPACE/E to fix). Fix them quickly in a row for a multiplier."
  { id: "mg-flip", re: /^Click problems before they ROT \(or arrows\/WASD to pick, SPACE\/E to fix\)\. /, to: "Tap problems before they ROT. " },
  // BURPEES: "Ring closes → ▼ DOWN to drop · ▲ UP at the bottom to explode   (↓ ↑ / S W / Space / tap ▼ ▲)"
  { id: "mg-burpees", re: /^Ring closes → ▼ DOWN to drop · ▲ UP at the bottom to explode\s+\(↓ ↑ \/ S W \/ Space \/ tap ▼ ▲\)$/, to: "Ring closes → tap to drop · tap again at the bottom to explode (or ▼ / ▲)" },
  // THE GIG (Krebon): "A/D or ← → (or hold left/right of the screen) to move · SPACE / tap Benn to prance"
  { id: "mg-gig", re: /^A\/D or ← → \(or hold left\/right of the screen\) to move · SPACE \/ tap Benn to prance$/, to: "Hold left or right of Benn to move · tap Benn to prance" },
  // THE GIG (watching): "Move A/D or drag low · SPACE / tap high to throw underwear at Krebon · F / tap a mosher to PUNCH · ..."
  { id: "mg-gig-watch", re: /^Move A\/D or drag low · SPACE \/ tap high to throw underwear at Krebon · F \/ tap a mosher to PUNCH · /, to: "Drag low to move · tap high to throw underwear at Krebon · tap a mosher to PUNCH · " },
  // THE CROCODILE: "SanMik ft. the entire cabinet · ← / A = LEFT HAND · → / D = RIGHT HAND · ↑ / W / SPACE = CHOMP"
  { id: "mg-croc", re: /^SanMik ft\. the entire cabinet · ← \/ A = LEFT HAND · → \/ D = RIGHT HAND · ↑ \/ W \/ SPACE = CHOMP$/, to: "SanMik ft. the entire cabinet · tap ◀ LEFT · ▲ CHOMP · RIGHT ▶ on the beat" },
  // GIRLFRIENDS: the "[1]" / "[2]" / "[3]" under the phones (you tap the phone itself)
  { id: "mg-gf-keys", re: /^\[[123]\]$/, to: "" },
  // FACEBROOK / THE MODULATOR: the "[1] " in front of each reply (you tap the row)
  { id: "mg-fb-keys", re: /^\[[123]\] (?=\S)/, to: "" },
  // RUNESCAPE: the hint over the game view, its chatbox's first system message, the level-up box, the buttons' keys, the
  // hover line's key notes
  { id: "rs-hint", re: /^Click \/ tap a tree to chop it\. When the ring closes, tap it \(or SPACE\) for bonus XP\.$/, to: "Tap a tree (or CHOP) to chop it. When the ring closes, tap CHOP for bonus XP." },
  { id: "rs-welcome", re: /^Click a tree to chop it\. Tap the ring as it closes for bonus XP\.$/, to: "Tap a tree to chop it. Tap CHOP as the ring closes for bonus XP." },
  { id: "rs-continue", re: /^Click here to continue$/, to: "Tap here to continue" },
  { id: "rs-button-keys", re: /^(Drop all|Re-up|Roll|Pud) \([A-Z]\)$/, to: "$1" },
  { id: "rs-hover-keys", re: /^ \/ (?:Shift-click: drop all|Esc)$/, to: "" },
  // the Wonky Pole's close-up: "ESC / CLICK: skip" (a tap anywhere skips it)
  { id: "club-closeup-skip", re: /^ESC \/ CLICK: skip$/, to: "tap: skip" },
  // the Kreddle raid's anime cut-in: "Tab / tap: skip"
  { id: "krunch-skip", re: /^Tab \/ tap: skip$/, to: "tap: skip" },
  // the Krunch Pit's card: "▶ any key · A · tap"
  { id: "pit-any-key", re: /^▶ any key · A · tap$/, to: "▶ tap" },
  // story scenes' little games (VignetteScene): the plane's steering line and the parachute button
  { id: "vg-steer", re: /^WASD \/ ARROWS \(or drag\) to steer$/, to: "Drag to steer" },
  { id: "vg-parachute", re: /^PARACHUTE TO FREEDOM\s+\[ E \/ SPACE \/ TAP \]$/, to: "PARACHUTE TO FREEDOM" },
];

/**
 * Where the rows apply: UI texts made in these scenes (whole-text patterns, checked when a text is made and on every
 * setText: RuneScape's chat rows and hover line change as you play). The stage 1 row "Tap / SPACE" → "Tap" does the
 * bully's, the cannon's and the vignettes' mash lines once their scene is listed.
 */
export const GAME_UI_TEXTS: Record<string, RegExp[]> = {
  Minigame: [
    /^Tap \/ SPACE to vent\. /,
    /^Mash Tap \/ SPACE\. /,
    /^Click problems before they ROT \(or arrows\/WASD to pick, SPACE\/E to fix\)\./,
    /^Ring closes → ▼ DOWN to drop · ▲ UP at the bottom to explode/,
    /^A\/D or ← → \(or hold left\/right of the screen\) to move/,
    /^Move A\/D or drag low · SPACE \/ tap high to throw underwear/,
    /^SanMik ft\. the entire cabinet · ← \/ A = LEFT HAND/,
    /^SPACE \/ TAP: ANGLE, then POWER\./,
    /^\[[123]\](?: \S|$)/,
    /^Click \/ tap a tree to chop it\./,
    /^Click a tree to chop it\. Tap the ring as it closes for bonus XP\.$/,
    /^Click here to continue$/,
    /^(?:Drop all|Re-up|Roll|Pud) \([A-Z]\)$/,
    /^ \/ (?:Shift-click: drop all|Esc)$/,
  ],
  Club: [/^ESC \/ CLICK: skip$/],
  Kreddle: [/^Tab \/ tap: skip$/],
  Pit: [/^▶ any key · A · tap$/],
};

/** Story scenes: whole captions only, matched exactly when the text is made (wording.ts STORY_UI_LINES). */
export const GAME_STORY_LINES: Record<string, RegExp[]> = {
  Vignette: [
    /^Tap \/ SPACE to flap it up\. Keep it in the zone\. Mm fuck yes\.$/,
    /^TAP \/ SPACE to shove Polson through the turnstile$/,
    /^TAP \/ SPACE: (?:help SanMik )?rub the lamp \(sorry\)$/,
    /^TAP \/ SPACE: unblock the jets \(3 of them, 6 good jabs each\)$/,
    /^Tap \/ SPACE when the food reaches his mouth\. NOT the salad\.$/,
    /^WASD \/ ARROWS \(or drag\) to steer$/,
    /^PARACHUTE TO FREEDOM\s+\[ E \/ SPACE \/ TAP \]$/,
  ],
};

/** The game's own captions these rows were written against (tests check each still exists in the source, as written). */
export const GAME_LINES_AS_WRITTEN: readonly { file: string; text: string }[] = [
  { file: "src/game/scenes/MinigameScene.ts", text: "Tap / SPACE to vent. The group chat has been a lot this week." },
  { file: "src/game/scenes/MinigameScene.ts", text: "Mash Tap / SPACE. Don't stop. The HGH is doing most of the work." },
  { file: "src/game/scenes/MinigameScene.ts", text: "Click problems before they ROT (or arrows/WASD to pick, SPACE/E to fix). Fix them quickly in a row for a multiplier." },
  { file: "src/game/scenes/MinigameScene.ts", text: "Ring closes → ▼ DOWN to drop · ▲ UP at the bottom to explode   (↓ ↑ / S W / Space / tap ▼ ▲)" },
  { file: "src/game/scenes/MinigameScene.ts", text: "A/D or ← → (or hold left/right of the screen) to move · SPACE / tap Benn to prance" },
  { file: "src/game/scenes/MinigameScene.ts", text: "Move A/D or drag low · SPACE / tap high to throw underwear at Krebon · F / tap a mosher to PUNCH · knock stage invaders off with a throw" },
  { file: "src/game/scenes/MinigameScene.ts", text: "SanMik ft. the entire cabinet · ← / A = LEFT HAND · → / D = RIGHT HAND · ↑ / W / SPACE = CHOMP" },
  { file: "src/game/scenes/MinigameScene.ts", text: "SPACE / TAP: ANGLE, then POWER. Grab coins mid-air: every miss, the seagulls nick more of them." },
  { file: "src/game/scenes/minigame/runescape.ts", text: "Click / tap a tree to chop it. When the ring closes, tap it (or SPACE) for bonus XP." },
  { file: "src/game/scenes/minigame/runescape.ts", text: "Click a tree to chop it. Tap the ring as it closes for bonus XP." },
  { file: "src/game/scenes/minigame/runescape.ts", text: "Click here to continue" },
  { file: "src/game/scenes/club/ClubCloseup.ts", text: "ESC / CLICK: skip" },
  { file: "src/game/scenes/kreddle/KrunchBurn.ts", text: "Tab / tap: skip" },
  { file: "src/game/scenes/PitScene.ts", text: "▶ any key · A · tap" },
  { file: "src/game/scenes/VignetteScene.ts", text: "Tap / SPACE to flap it up. Keep it in the zone. Mm fuck yes." },
  { file: "src/game/scenes/VignetteScene.ts", text: "TAP / SPACE to shove Polson through the turnstile" },
  { file: "src/game/scenes/VignetteScene.ts", text: "TAP / SPACE: rub the lamp (sorry)" },
  { file: "src/game/scenes/VignetteScene.ts", text: "TAP / SPACE: help SanMik rub the lamp (sorry)" },
  { file: "src/game/scenes/VignetteScene.ts", text: "TAP / SPACE: unblock the jets (3 of them, 6 good jabs each)" },
  { file: "src/game/scenes/VignetteScene.ts", text: "Tap / SPACE when the food reaches his mouth. NOT the salad." },
  { file: "src/game/scenes/VignetteScene.ts", text: "WASD / ARROWS (or drag) to steer" },
  { file: "src/game/scenes/VignetteScene.ts", text: "PARACHUTE TO FREEDOM  [ E / SPACE / TAP ]" },
];

// ------------------------------------------------------------------ rhythm

/** The most a phone's sound output is allowed to move the judging by itself (a Bluetooth headset reports ~0.15-0.25 s). */
export const MAX_AUDIO_LAG = 0.25;

/**
 * Seconds to take off a tap's judged time in the rhythm minigames (the crocodile, the burpees): what the phone's sound
 * output says it adds (Web Audio's baseLatency + outputLatency: the songs go through it on a phone, and a Bluetooth
 * headset reports its own delay there) plus the player's "Rhythm sync" setting (ms; + = "my taps are judged late").
 * Never negative from the output alone; the setting may pull it below zero (-0.3 s at most).
 */
export function rhythmLag(audio: { baseLatency?: number; outputLatency?: number } | null | undefined, settingMs: number): number {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
  const out = Math.min(MAX_AUDIO_LAG, num(audio?.baseLatency) + num(audio?.outputLatency));
  const set = Number.isFinite(settingMs) ? Math.max(-300, Math.min(300, settingMs)) / 1000 : 0;
  return Math.round((out + set) * 1000) / 1000;
}

// ------------------------------------------------------------------ the crocodile's pads

/** The crocodile's three moves, by where the thumb lands (game px): left third LEFT, middle CHOMP, right third RIGHT. */
export const CROC_COLUMNS = { left: 340, right: 620, top: 160 } as const;

export function crocLane(gx: number): "L" | "C" | "R" {
  return gx < CROC_COLUMNS.left ? "L" : gx >= CROC_COLUMNS.right ? "R" : "C";
}

/** Where a pad's touch area goes (game px, the whole column under the note lane, down to the canvas's bottom). */
export function crocColumn(k: "L" | "C" | "R"): { x: number; y: number; w: number; h: number } {
  const { left, right, top } = CROC_COLUMNS;
  const x0 = k === "L" ? 0 : k === "C" ? left : right;
  const x1 = k === "L" ? left : k === "C" ? right : 960;
  return { x: x0, y: top, w: x1 - x0, h: 540 - top };
}

// ------------------------------------------------------------------ RuneScape's buttons

export interface RsState {
  over: boolean;
  logs: number;
  gear: number;
  ring: boolean;
  chopping: boolean;
  gary: string;
  /** The closing ring's radius now (16 is the hit), 0 with no ring. */
  ringR?: number;
  level?: number;
}

/**
 * Which of RuneScape's thumb buttons show (the calm-screen rule: only what would do something now). CHOP always (SPACE:
 * walk to the nearest tree and chop, or hit the closing ring); DROP ALL with logs in the bag; the re-up when the game
 * would take one (gear under 85, or the dealer already here). None once the session is over or a conversation is up.
 */
export function rsButtons(s: RsState | null, talking: boolean): { chop: boolean; drop: boolean; reup: boolean; hot: boolean } {
  if (!s || s.over || talking) return { chop: false, drop: false, reup: false, hot: false };
  return { chop: true, drop: s.logs > 0, reup: s.gear < 85 || s.gary === "here", hot: s.ring };
}

/** "Re-up (G)" → "RE-UP": the game's own word for the button, without its key. */
export function rsWord(button: string | undefined): string {
  return String(button ?? "Re-up").replace(/\s*\([A-Z]\)\s*$/, "").toUpperCase();
}

// ------------------------------------------------------------------ the corner under pause

/**
 * The phone's II sits in the top-right corner, over the canvas's own top-right corner (game px, roughly x > 900,
 * y < 100 on every phone). A minigame's own button there ("[ LEAVE ]", "[ END GIG ]") would be under it: on a phone it
 * moves left, to end at `PAUSE_CLEAR_X`.
 */
export const PAUSE_CORNER = { x: 890, y: 100 } as const;
export const PAUSE_CLEAR_X = 872;

export function underPause(b: { x: number; y: number; w: number; h: number }): boolean {
  return b.x + b.w > PAUSE_CORNER.x && b.y < PAUSE_CORNER.y && b.w < 400 && b.h < 120;
}

/** A button (its bounds, game px) moved out from under pause: the x offset to add (0 when it is clear already). */
export function clearOfPause(b: { x: number; y: number; w: number; h: number }): number {
  return underPause(b) ? Math.min(0, PAUSE_CLEAR_X - (b.x + b.w)) : 0;
}

/** Rows lifted out of the home-indicator strip: a game-px bottom edge kept at least this far above the canvas bottom. */
export const STRIP_CLEAR_GAME = 32;

/** The y offset that lifts something whose bottom edge is at `bottom` (game px) out of the strip (0 when clear). */
export function liftOutOfStrip(bottom: number, clear = STRIP_CLEAR_GAME): number {
  return Math.min(0, 540 - clear - bottom);
}

// ------------------------------------------------------------------ the first-time cue

/**
 * The first time each minigame is played on this phone (research S5, "one verb and an icon"): a short line in the
 * middle of the screen for a few seconds, in touch words, over the real game (it takes no touches). UI, never dialogue.
 */
export const GAME_CUES: Readonly<Record<string, string>> = {
  bully: "👆 TAP ANYWHERE TO VENT",
  deadlift: "👆👆 MASH WITH BOTH THUMBS",
  girlfriends: "👆 TAP THE PHONE THAT'S RINGING",
  renovate: "👆 TAP THE PROBLEMS",
  runescape: "👆 TAP CHOP",
  burpees: "👆 TAP AS THE RING CLOSES",
  facebook: "👆 TAP A REPLY",
  modulator: "👆 TAP A REPLY",
  crocodile: "👆 TAP ◀ LEFT · ▲ CHOMP · RIGHT ▶ ON THE BEAT",
  cannon: "👆 TAP: ANGLE, THEN POWER",
  gig: "👆 HOLD TO MOVE · TAP TO PLAY",
  whack: "👆 TAP THE PIPES TO WHACK",
};

export const GAME_CUE_KEY = "krelworld.phone.gameCues";
/** How long a cue shows (ms). */
export const GAME_CUE_MS = 3200;

/** The cue for this game, or null (none for it, or already shown on this phone). */
export function cueFor(mode: string | null | undefined, seen: readonly string[]): string | null {
  if (!mode || seen.includes(mode)) return null;
  return GAME_CUES[mode] ?? null;
}

/** The narrator's control tip in the golden juice squeeze (hard rule 3's exception: a narrator line, phones only). */
export const GAME_NARRATOR_TIPS: WordingRule[] = [
  // systems/squeeze.ts: "You hug her. Now: SQUEEZE. Hit the buttons as they come up, fast, before she gets bored."
  { id: "squeeze-buttons", re: /\bHit the buttons as they come up, fast, before she gets bored\./g, to: "Tap the screen, fast, before she gets bored." },
];
