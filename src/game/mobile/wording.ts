// PHONE MODE: touch wording. On a phone a control hint must never name a keyboard key ("E: Talk to Gronny" becomes
// "Tap: Talk to Gronny"; "SPACE or SPIN" becomes "Tap SPIN"). One table (TOUCH_WORDING) that stage 2 extends, one
// helper (`hint()`, identity on a laptop), and the places it is applied.
//
// THE RULE: this is for control hints and UI labels only. Character dialogue and story text are never reworded,
// even when a line mentions a key: those lines are not routed through here at all (the helper is only applied to
// specific UI Text objects listed below, never to the dialogue box, speech bubbles, TV or narration).
//
// Applied in stage 1 (phones only, from outside the scenes, nothing in them edited):
//   - the interact prompt bubble in Home, Hub, Club, Kreddle and the Venue (the scene's `prompt` Text): every
//     setText on it goes through hint(); the untouched text stays readable as `__krelRaw` (ACTION's verb comes from it);
//   - texts created in Polson Towers (the pick-up prompt), the Krezz Arms (the key captions on its buttons and the
//     brawl's "Tap / SPACE to swing"), Kreddle
//     (the machine panels' "SPACE or SPIN" lines) and Home (the panels' "ESC or ✕ to close"), when they match that
//     scene's UI patterns in UI_TEXTS.
import type Phaser from "phaser";
import { isMobile } from "./flag";

export interface WordingRule {
  /** For the README and tests. */
  id: string;
  re: RegExp;
  to: string;
}

/**
 * Key wording → touch wording, applied in order. Stage 2 adds rows with `addWording()` (the touch-wording sweep of
 * toasts, the HUD, menus, minigame instructions), never by editing a scene's string.
 */
export const TOUCH_WORDING: WordingRule[] = [
  // interact prompts: "E: Talk to X", "[E] Open", "E / ATTACK: hit X" (one per line)
  { id: "prompt-e", re: /^([ \t]*)(?:\[\s*E\s*\](?:\s*\/\s*ATTACK)?\s*:?|E(?:\s*\/\s*ATTACK)?\s*:)\s*/gm, to: "$1Tap: " },
  // "Press E to ..." / "press E"
  { id: "press-e", re: /\b[Pp]ress E\b/g, to: "Tap" },
  // "E to talk" (toasts)
  { id: "e-to", re: /\bE to (?=[a-z])/g, to: "Tap to " },
  // "Tap / SPACE", "SPACE / tap", "Space / E / click": all just "Tap"
  { id: "tap-space", re: /\b(?:[Tt]ap|TAP)\s*\/\s*(?:SPACE|Space)\b/g, to: "Tap" },
  { id: "space-tap", re: /\b(?:SPACE|Space)\s*\/\s*(?:[Tt]ap|TAP)\b/g, to: "Tap" },
  // the telly's "D" (ON DEMAND) caption
  { id: "tv-d", re: /^D$/, to: "" },
  // the Kreddle machines: "SPACE or SPIN" → "Tap SPIN", "SPACE / DROP" → "Tap DROP"
  { id: "space-or-button", re: /\b(?:SPACE|Space) (?:or|\/) ([A-Z]{2,})\b/g, to: "Tap $1" },
  { id: "space-slash-button", re: /\b(?:SPACE|Space)\s*\/\s*([A-Z]{2,})\b/g, to: "Tap $1" },
  // panels: "ESC or ✕ to close" → "✕ to close"
  { id: "esc-or-x", re: /\b(?:ESC|Esc) or ✕/g, to: "✕" },
  // "(Esc)" after a menu name: the pause button is the two bars
  { id: "esc-paren", re: /\((?:ESC|Esc)\)/g, to: "(II)" },
  // the town's first toast: "Esc for menu (quests, upgrades, save)"
  { id: "esc-for-menu", re: /\b(?:ESC|Esc) for (?:the )?menu\b/g, to: "II for the menu" },
  // the Enter gate: "PRESS ANY KEY" / "OR CLICK / TAP"
  { id: "any-key", re: /^PRESS ANY KEY$/, to: "TAP TO START" },
  { id: "or-click-tap", re: /^OR CLICK \/ TAP$/, to: "" },
  // walking: "WASD to walk" / "WASD / arrows to walk"
  { id: "wasd-walk", re: /\bWASD(?:\s*\/\s*arrows)?(?:\s*\(or the stick\))? to walk\b/g, to: "Drag on the left to walk" },
  // key captions on their own (a button already says what it does): nothing at all
  { id: "caption-keys", re: /^(?:Space \/ E \/ click|Space \/ E|Space \/ click|Enter \/ E|Tab|Esc|ESC|Enter)$/, to: "" },
  // (stage 2) the dialogue box's footer "▼ E / Space · Tab skip": the arrow alone (the SKIP pill does the skipping)
  { id: "dialogue-footer", re: /^▼ E \/ Space\s*·\s*Tab skip$/, to: "▼" },
  // the Messenger reaction card's "REACT  (1-5 or click)"
  { id: "react-keys", re: /^REACT\s+\(1-5 or click\)$/, to: "REACT" },
  // the Difficulty / Banter screens: "↑/↓ or 1–5 to pick · ENTER / A to go on · tap twice on touch"
  // (the pixel font's own clean-up has already turned the en dash into " - " by the time a phone sees the text)
  { id: "pick-twice", re: /^↑\/↓ or 1\s*(?:–|-)\s*\d to pick · ENTER \/ A to (go on|start) · tap twice on touch$/, to: "Tap one, then tap it again to $1" },
  // the save slots: "↑↓ choose · Enter load · Del delete · Esc back   (tap a slot to load it)", "...   ↑↓ · Enter · Del · Esc"
  { id: "slots-load", re: /^↑↓ choose · Enter load · Del delete · Esc back\s+\(tap a slot to load it\)$/, to: "Tap a slot to load it" },
  { id: "slots-save", re: /\s+↑↓ · Enter · Del · Esc$/, to: "" },
  // the title's key line "WASD · Mouse · Click · Space · E · Q · B · R · Esc": nothing on a phone
  { id: "title-keys", re: /^WASD · Mouse · Click · Space · E · Q · B · R · Esc$/, to: "" },
];

/**
 * Hard rule 3's one exception: control instructions said by the game's own NARRATOR (stage directions, "TIP:" lines),
 * never a character's line. Shown in touch wording on a phone only (the dialogue box's shownText, dialogue.ts); the
 * laptop line is unchanged, and so is every other word of the line. Each rule names the exact phrase it swaps; the
 * stage 2 report lists every line they reach. Combat and side-room tips (F to headbutt, W to jump, the dungeon's
 * CONTROLS line, the run-and-gun legends) are left for the combat controls, whose button names they would need.
 */
export const NARRATOR_TIPS: WordingRule[] = [
  // Home's welcome: "TIP: WASD / arrows (or the stick) to walk. E to use things. Have a look round: ..."
  { id: "home-walk", re: /^TIP: WASD \/ arrows \(or the stick\) to walk\. E to use things\./, to: "TIP: Drag on the left to walk. Tap things to use them." },
  // Home: "(The telly's on the left: walk up and press E.)", "Walk up to it and press E." (the telly, the gun rack)
  { id: "walk-up-press-e", re: /\b([Ww]alk up(?: to it)?) and press E\b/g, to: "$1 and tap it" },
  // the playground side quest: "...walk up to the playground fence and press E to throw a sweetie", "... and press E to take the photo"
  { id: "and-press-e-to", re: /\band press E to\b/g, to: "and tap to" },
  // Kreddle: "TIP: talk to the locals (E). Play the machines..."
  { id: "locals-e", re: /\btalk to the locals \(E\)/g, to: "talk to the locals (tap them)" },
  // Krebon's stage: "Tap / SPACE to prance."
  { id: "tap-space", re: /\bTap \/ SPACE\b/g, to: "Tap" },
  // Home, playing as Mikey: "TIP: You can become SANMIK whenever you like. Press V (or the SANMIK button) and you're
  // SanMik: ... Press it again to go back to being you."
  { id: "sanmik-key", re: /\bPress [A-Za-z0-9]{1,8} \(or the SANMIK button\)/g, to: "Tap the SANMIK button" },
  { id: "sanmik-again", re: /\bPress it again to go back to being you\b/g, to: "Tap it again to go back to being you" },
  // the Kreddle raid: "HOLD the attack button (mouse / J / the fire button) to spray CHEMICAL FIRE."
  { id: "raid-fire", re: /\(mouse \/ J \/ the fire button\)/g, to: "(the fire button)" },
];

/** A narrator line as a phone shows it (pure: the table walk). Only ever called for NARRATOR / stage-direction lines. */
export function narratorTip(text: string, rules: readonly WordingRule[] = NARRATOR_TIPS): string {
  return touchWording(text, rules);
}

/** Add a rule (at the end by default, so the stage 1 rows run first). */
export function addWording(rule: WordingRule, at: "front" | "back" = "back") {
  if (at === "front") TOUCH_WORDING.unshift(rule);
  else TOUCH_WORDING.push(rule);
}

/** The touch wording of a hint, always (pure; for tests and for phones). */
export function touchWording(text: string, rules: readonly WordingRule[] = TOUCH_WORDING): string {
  let out = String(text ?? "");
  for (const r of rules) {
    r.re.lastIndex = 0;
    out = out.replace(r.re, r.to);
  }
  return out;
}

/** A control hint or UI label as this device should show it: touch wording on a phone, unchanged on a laptop. */
export function hint(text: string): string {
  return isMobile() ? touchWording(text) : text;
}

// ------------------------------------------------------------------ where stage 1 applies it

type WordedText = Phaser.GameObjects.Text & { __krelRaw?: string; __krelWorded?: boolean };
type Bag = Record<string, unknown>;

/** A Phaser Text (by its type, so this file needs no Phaser at runtime and is unit-tested in node). */
function isText(o: unknown): o is Phaser.GameObjects.Text {
  const t = o as { type?: string; setText?: unknown; text?: unknown } | null;
  return !!t && t.type === "Text" && typeof t.setText === "function" && typeof t.text === "string";
}

/** The untouched text of a UI Text (what the scene set), whether or not it has been reworded. */
export function rawText(t: { text: string; __krelRaw?: string } | null | undefined): string {
  if (!t) return "";
  return typeof t.__krelRaw === "string" ? t.__krelRaw : t.text;
}

/**
 * From now on, everything the game writes into this Text is shown in touch wording (phones only). Its untouched
 * text stays in `__krelRaw`.
 */
export function wordText(t: Phaser.GameObjects.Text) {
  const w = t as WordedText;
  if (w.__krelWorded || !isMobile()) return;
  w.__krelWorded = true;
  // (the class's own setText, with the game's pixel-font clean-up in it)
  const proto = (Object.getPrototypeOf(t) as Phaser.GameObjects.Text).setText;
  w.setText = function (this: WordedText, value: string | string[]) {
    const raw = Array.isArray(value) ? value.join("\n") : value === undefined || value === null ? "" : String(value);
    this.__krelRaw = raw;
    return proto.call(this, touchWording(raw));
  };
  const cur = t.text;
  if (cur) w.setText(cur);
  else w.__krelRaw = "";
}

/** The scenes whose interact prompt lives in a `prompt` Text (read every frame; wrapped the first time it's seen). */
export const PROMPT_SCENES = ["Home", "Hub", "Club", "Kreddle", "Venue"] as const;

/**
 * UI texts made in a scene that get touch wording when they are created (scene → patterns on the whole text).
 * Only control hints: never a line anyone says.
 */
export const UI_TEXTS: Record<string, RegExp[]> = {
  // the clue pick-up prompt
  PolsonHome: [/^E: Pick up: /],
  // the key captions on the conversation buttons and the Leave card ("Space / E / click", "Tab", "Esc", "Enter"), and
  // the brawl's "BRAWL! Tap / SPACE to swing"
  Pub: [/^(?:Space \/ E \/ click|Tab|Esc|Enter)$/, /^BRAWL! Tap \/ SPACE to swing/],
  // the machine panels: "150 Krezzcoin a spin. SPACE or SPIN.", "... SPACE / DROP to drop the claw", "SPACE / tap to collect"
  Kreddle: [/\bSPACE (?:or|\/) [A-Za-z]/],
  // the panels' close hint
  Home: [/^ESC or ✕ to close$/],
  // the Enter gate's "PRESS ANY KEY" / "OR CLICK / TAP"
  Enter: [/^PRESS ANY KEY$/, /^OR CLICK \/ TAP$/],
  // (stage 2) the title's key line, and the Difficulty / Banter screens' "↑/↓ or 1–5 to pick · ENTER / A ..."
  Title: [/^WASD · Mouse · Click · Space/],
  Difficulty: [/^↑\/↓ or 1\s*(?:–|-)\s*\d to pick/],
  Banter: [/^↑\/↓ or 1\s*(?:–|-)\s*\d to pick/],
  Slots: [/^↑↓ choose · Enter load/, /↑↓ · Enter · Del · Esc$/],
};

/** Phones only: watches the scenes above and applies the wording. */
export class PromptWording {
  private hooked = new Set<string>();

  constructor(readonly game: Phaser.Game) {}

  /** Once the scenes exist: listen for UI texts being made in the scenes that have them. */
  hookScenes() {
    for (const key of Object.keys(UI_TEXTS)) {
      if (this.hooked.has(key)) continue;
      let sc: Phaser.Scene | null = null;
      try {
        sc = this.game.scene.getScene(key);
      } catch {
        sc = null;
      }
      if (!sc) continue;
      this.hooked.add(key);
      const pats = UI_TEXTS[key];
      const look = (go: unknown) => {
        if (!isText(go)) return;
        const t = go.text;
        if (t && pats.some((p) => p.test(t))) wordText(go);
      };
      // (Phaser.Scenes.Events.ADDED_TO_SCENE: every object added to the scene's display list)
      sc.sys.events.on("addedtoscene", look);
      // (and what is already there: the phone chunk can arrive after a scene has been built, e.g. the Enter gate)
      const walk = (o: unknown) => {
        look(o);
        const list = (o as { list?: unknown[]; type?: string })?.type === "Container" ? (o as { list: unknown[] }).list : null;
        if (list) for (const c of list) walk(c);
      };
      try {
        for (const o of sc.sys.displayList?.list ?? []) walk(o);
      } catch {
        /* not built yet */
      }
    }
  }

  /** Every frame: the prompt bubbles of the running walking scenes. A few property reads. */
  frame() {
    const mgr = this.game.scene;
    for (const key of PROMPT_SCENES) {
      let sc: Bag | null = null;
      try {
        if (!mgr.isActive(key)) continue;
        sc = mgr.getScene(key) as unknown as Bag;
      } catch {
        continue;
      }
      const p = sc?.prompt as WordedText | undefined;
      if (p && !p.__krelWorded && isText(p) && p.scene) wordText(p);
    }
  }
}
