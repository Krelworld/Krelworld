// PHONE MODE: touch wording for the fights (stage 2 part 1). Pure (no Phaser), so it is unit-tested. UI hints and
// control instructions only, never a character's line; combat.ts adds these rows to wording.ts's table on a phone.
import type { WordingRule } from "./wording";

/** The first dungeon's how-to-play texts that name a touch button (TutorialScene's touch column). */
export const TUTORIAL_TEXT = /^(?:ATTACK button \(hold|DODGE button$|GUN button$|E button$|SPECIAL button\. |WONK button\. |💨 button\. |PJ button\. |🍺 button\. |Later on: ⚡T, then CUME\.$|Esc pauses at any time; CONTROLS)/;

/**
 * Touch wording for the fights (phones only, through hint() / wordText(); UI hints and control instructions, never
 * a character's line). The tutorial rows named the old pad's buttons (ATTACK, GUN, E, PJ, WONK, 💨, 🍺, ⚡T).
 */
export const COMBAT_WORDING: WordingRule[] = [
  { id: "weapon-pick", re: /^\(the world's slowed right down\) · Tap one · .*$/, to: "(the world's slowed right down) · Tap one, or slide onto one and let go · ✕ to close" },
  { id: "tut-shoot", re: /^ATTACK button \(hold; aims at the nearest enemy\)$/, to: "FIRE (bottom right) shoots by itself at enemies in range. Hold it to fire anyway, slide it to aim" },
  { id: "tut-dodge", re: /^DODGE button$/, to: "DODGE button. Dodge right as you get hit for a PERFECT DODGE (slow-mo)" },
  { id: "tut-swap", re: /^GUN button$/, to: "SWAP button, or tap your gun up top. Hold either to choose. Empty guns swap automatically" },
  { id: "tut-use", re: /^E button$/, to: "ACTION pops up when there's something to use (or tap what it says over your head)" },
  { id: "tut-special", re: /^SPECIAL button\. /, to: "SPECIAL button (it says what yours is). " },
  { id: "tut-wonk", re: /^WONK button\. /, to: "WONK! pops up on the right when it's ready. " },
  { id: "tut-fart", re: /^💨 button\. /, to: "💨 at the top left. " },
  { id: "tut-juice", re: /^PJ button\. /, to: "🍼 at the top left, and HEAL pops up when you're hurt. " },
  { id: "tut-bongo", re: /^🍺 button\. /, to: "🍺 at the top left. " },
  { id: "tut-golden", re: /^Later on: ⚡T, then CUME\.$/, to: "Later on: GOLD, then CUME. They pop up on the right." },
  { id: "tut-pause", re: /^Esc pauses at any time; CONTROLS in the pause menu lets you rebind every key\.$/, to: "II (top right) pauses at any time." },
  // the first dungeon's narrated controls line (a pure control instruction in the game's own voice, research rule 3's
  // exception): only where the dialogue code passes such lines through hint(); this file never routes dialogue
  {
    id: "wildern-controls",
    re: /^CONTROLS: WASD move · Mouse aim · Left click attack · .* · Esc pause$/,
    to: "CONTROLS: drag on the left to move · FIRE shoots by itself (hold it to fire, slide it to aim) · DODGE, SPECIAL and SWAP on the right · WONK!, HEAL and the rest pop up when they're ready · II pause",
  },
];

/**
 * The finale brawl's own UI on a phone (brawl.ts adds them; UI_TEXTS.Finale): the boss card's how-to line named the
 * R key, the corner's "Esc: skip fight" has no key to press on a phone (it hides), and the finishing rush's
 * "MASH PUNCH!" is a tap anywhere on a phone (the buttons hide for it).
 */
export const BRAWL_WORDING: WordingRule[] = [
  { id: "ssj-card", re: /^MASH FOR A FLURRY\. HOLD R TO BLAST KI\. VANISH BEHIND IT\.$/, to: "MASH PUNCH FOR A FLURRY. HOLD KI TO BLAST. VANISH BEHIND IT." },
  { id: "finale-esc-skip", re: /^Esc: skip (?:fight|scene)$/, to: "" },
  { id: "ssj-rush", re: /^MASH PUNCH!$/, to: "TAP TAP TAP!" },
];
export const BRAWL_TEXTS: RegExp[] = [/^MASH FOR A FLURRY\. HOLD R TO BLAST KI/, /^Esc: skip (?:fight|scene)$/, /^MASH PUNCH!$/];

/**
 * Fight hints that name a key in the middle of a sentence (checked before stage 1's rules): the finale's "INJECT THE
 * LADS" toast, and the Cronster's narrated TIP (only where the dialogue code passes narrator control tips through
 * hint(); this file never routes dialogue).
 */
export const COMBAT_WORDING_FIRST: WordingRule[] = [
  { id: "walk-up-press-e", re: /\(walk up, press E\)/g, to: "(walk up, tap ACTION)" },
  { id: "mash-attack-dodge", re: /\bMash ATTACK \/ DODGE if he gets you\b/g, to: "Mash FIRE / DODGE if he gets you" },
];

