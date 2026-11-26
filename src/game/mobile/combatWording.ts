// PHONE MODE: touch wording for the fights (stage 2 part 1). Pure (no Phaser), so it is unit-tested. UI hints and
// control instructions only, never a character's line; combat.ts adds these rows to wording.ts's table on a phone.
import type { WordingRule } from "./wording";
import { fireStyle, phoneSettings, type FireStyle } from "./settings";

/** Is the phone on EASY firing (the old auto-fire) right now? The two FIRE how-tos below follow it. */
const easyFiring = () => fireStyle(phoneSettings()) === "auto";

/** The first dungeon's how-to-play texts that name a touch button (TutorialScene's touch column). */
export const TUTORIAL_TEXT = /^(?:ATTACK button \(hold|DODGE button$|GUN button$|E button$|SPECIAL button\. |WONK button\. |💨 button\. |PJ button\. |🍺 button\. |Later on: ⚡T, then CUME\.$|Esc pauses at any time; CONTROLS)/;

/**
 * Touch wording for the fights (phones only, through hint() / wordText(); UI hints and control instructions, never
 * a character's line). The tutorial rows named the old pad's buttons (ATTACK, GUN, E, PJ, WONK, 💨, 🍺, ⚡T).
 */
export const COMBAT_WORDING: WordingRule[] = [
  { id: "weapon-pick", re: /^\(the world's slowed right down\) · Tap one · .*$/, to: "(the world's slowed right down) · Tap one, or slide onto one and let go · ✕ to close" },
  {
    id: "tut-shoot",
    re: /^ATTACK button \(hold; aims at the nearest enemy\)$/,
    // (Settings > Firing: HOLD, the default, or EASY, the old auto-fire)
    get to() {
      return easyFiring() ? "FIRE (bottom right) shoots by itself at enemies in range. Hold it to fire anyway, slide it to aim" : "FIRE (bottom right): hold it to shoot. It aims at the nearest enemy you can see; slide it to aim by hand";
    },
  },
  { id: "tut-dodge", re: /^DODGE button$/, to: "DODGE button. Dodge right as you get hit for a PERFECT DODGE (slow-mo)" },
  // (SWAP only shows once there's a second gun to swap to: P12)
  { id: "tut-swap", re: /^GUN button$/, to: "SWAP (it appears once you have a second gun), or tap your gun up top. Hold either to choose. Empty guns swap automatically" },
  { id: "tut-use", re: /^E button$/, to: "ACTION pops up when there's something to use (or tap what it says over your head)" },
  { id: "tut-special", re: /^SPECIAL button\. /, to: "SPECIAL button (it says what yours is). " },
  { id: "tut-wonk", re: /^WONK button\. /, to: "WONK! pops up on the right when it's ready. " },
  { id: "tut-fart", re: /^💨 button\. /, to: "💨 pops up on the right once it's charged. " },
  { id: "tut-juice", re: /^PJ button\. /, to: "HEAL pops up on the right when you're hurt. " },
  { id: "tut-bongo", re: /^🍺 button\. /, to: "🍺 pops up on the right when you have one. " },
  { id: "tut-golden", re: /^Later on: ⚡T, then CUME\.$/, to: "Later on: GOLD, then CUME. They pop up on the right." },
  { id: "tut-pause", re: /^Esc pauses at any time; CONTROLS in the pause menu lets you rebind every key\.$/, to: "II (top right) pauses at any time." },
  // the first dungeon's narrated controls line (a pure control instruction in the game's own voice, research rule 3's
  // exception): only where the dialogue code passes such lines through hint(); this file never routes dialogue
  {
    id: "wildern-controls",
    re: /^CONTROLS: WASD move · Mouse aim · Left click attack · .* · Esc pause$/,
    get to() {
      return easyFiring()
        ? "CONTROLS: drag on the left to move · FIRE shoots by itself (hold it to fire, slide it to aim) · DODGE, SPECIAL and SWAP on the right · WONK!, HEAL and the rest pop up when they're ready · II pause"
        : "CONTROLS: drag on the left to move · hold FIRE to shoot (it aims at the nearest enemy you can see; slide it to aim) · DODGE, SPECIAL and SWAP on the right · WONK!, HEAL and the rest pop up when they're ready · II pause";
    },
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
  // the fights' own toasts (system hints, G "toast"; matched whole so no other "Press E" line is reached)
  { id: "crate-walk-over", re: /^Something glowing dropped in\. Walk over and press E\.$/, to: "Something glowing dropped in. Walk over and tap ACTION." },
  { id: "crate-open", re: /^A weapons crate appeared\. Press E to open it\.$/, to: "A weapons crate appeared. Tap ACTION to open it." },
  { id: "wonk-full", re: /^WONK FULL\. KREZZ FULL\. Press R\.$/, to: "WONK FULL. KREZZ FULL. Tap WONK!" },
  { id: "ibs-ready", re: /^Press G \(or the 💨 button\) to unleash it\.$/, to: "Tap IBS! (on the right) to unleash it." },
  { id: "krezz-shield", re: /\bhit him with a KREZZ BURST \(R\) to break the shield\./g, to: "hit him with a KREZZ BURST (WONK!) to break the shield." },
  { id: "hostage-press-e", re: /^(Get to .{1,40} first) and press E, (or he'll cuddle them for health\.)$/, to: "$1 and tap ACTION, $2" },
  { id: "headbutt-staggered", re: /\bHEADBUTT him \(F \/ right click\)!/g, to: "HEADBUTT him (tap HEADBUTT)!" },
  // the Cronster's hostage tags over each hostage (combat/Bosses.ts), so they agree with the toast (R3)
  { id: "hostage-tag", re: /\n\(tied up: E to free\)$/, to: "\n(tied up: tap ACTION to free)" },
];

/**
 * Fight captions made once with their whole text, inside the Dungeon (wording.ts STORY_UI_LINES.Dungeon: checked when
 * a text is added, never every setText of a fight): the Cronster's hostage tags and the Citadel's Kreddle Exchange
 * sign (its "(E)" goes by the stage 1 "(E)" rule).
 */
export const FIGHT_UI_LINES: RegExp[] = [/^[^\n]{1,40}\n\(tied up: E to free\)$/, /^🎁 KREDDLE\nEXCHANGE \(E\)$/];

/**
 * Narrated control tips in fights (research rule 3's exception: the game's own NARRATOR / stage-direction voice, never a
 * character). combat.ts adds them to wording.ts's NARRATOR_TIPS on a phone, which the dialogue box applies to narrator
 * lines only (dialogue.ts). Each row swaps the control words alone; the rest of the line stays as written.
 */
export const COMBAT_NARRATOR_TIPS: WordingRule[] = [
  // data/dungeons.ts (Wildern's arrival)
  COMBAT_WORDING.find((r) => r.id === "wildern-controls")!,
  // data/dungeons.ts (the first side-on room): the control sentences only, not "The exit is on the far right..."
  {
    id: "side-on-controls",
    re: /^SIDE-ON CONTROLS: A \/ D to run · W \(or up\) to jump, press again in the air to double jump · S to drop through platforms · aim and attack with the mouse as normal · Space to dash\./,
    to: "SIDE-ON CONTROLS: drag left / right to run · JUMP (bottom right) to jump, tap it again in the air to double jump · hold the stick down to drop through platforms · FIRE shoots · DODGE to dash.",
  },
  // content/citadel.ts (the run-and-gun and climb legends)
  {
    id: "run-and-gun",
    re: /^RUN AND GUN: A \/ D move · W or SPACE jump \(again in the air to double jump\) · S drop through · hold the mouse to shoot\./,
    to: "RUN AND GUN: drag left / right to move · JUMP (again in the air to double jump) · hold the stick down to drop through · FIRE shoots.",
  },
  {
    id: "climb",
    re: /^CLIMB: W \/ SPACE jump \(again in the air to double jump\) · A \/ D move · S drop through · shoot as normal\./,
    to: "CLIMB: JUMP (again in the air to double jump) · drag left / right to move · hold the stick down to drop through · FIRE shoots.",
  },
  // content/bosses.ts (Alistair) and ClubScene (before his fight)
  { id: "press-f-headbutt", re: /\bget close and press F to HEADBUTT\./g, to: "get close and tap HEADBUTT." },
  { id: "headbutt-f", re: /\bonly goes down to a headbutt \(F\)\./g, to: "only goes down to a headbutt (tap HEADBUTT)." },
  // content/bosses.ts (the Jam Queen)
  { id: "jump-w-up", re: /\bJUMP over her \(W \/ up\)\./g, to: "JUMP over her (the JUMP button)." },
  // content/bosses.ts (the Cronster)
  ...COMBAT_WORDING_FIRST.filter((r) => r.id === "walk-up-press-e" || r.id === "mash-attack-dodge"),
  // systems/squeeze.ts (the golden juice, said in town about the next dungeon)
  {
    id: "golden-how",
    re: /\bIn a dungeon: press T \(or ⚡T\) to transform\. ATTACK becomes a huge golden mega melee\. C \(or CUME\) fires the CUMEHAMEHA\./g,
    to: "In a dungeon: tap GOLD to transform. FIRE becomes a huge golden mega melee. CUME fires the CUMEHAMEHA.",
  },
  { id: "golden-ready", re: /\bPress T in your next dungeon\./g, to: "Tap GOLD in your next dungeon." },
];


/** FIRE's line in the Controls picture, as Settings > Firing has it (P10; the auto-fire audit). */
export const FIRE_AUTO = "Shoots by itself at enemies in range. Hold to fire anyway, slide your thumb to aim";
export const FIRE_MANUAL = "Hold to shoot: it aims at the nearest enemy you can see. Slide your thumb to aim by hand";
/** Settings > Firing: LIGHT and STILL (the auto-fire audit). */
export const FIRE_LIGHT = "Shoots by itself, slowly. Hold to fire at full speed, slide your thumb to aim";
export const FIRE_STILL = "Shoots by itself while you stand still. Hold to fire on the move, slide your thumb to aim";
/** FIRE's line for the firing style in force. */
export function fireLine(style: FireStyle): string {
  return style === "hold" ? FIRE_MANUAL : style === "light" ? FIRE_LIGHT : style === "still" ? FIRE_STILL : FIRE_AUTO;
}


/** The one-time tip in the first fight on HOLD firing (a system toast; UI text, phones only). */
export const FIRE_TIP = Object.freeze({
  title: "HOLD FIRE TO SHOOT",
  text: "It aims for you at the nearest enemy you can see. Settings > Firing > EASY shoots for you too.",
});
