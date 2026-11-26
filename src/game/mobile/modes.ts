// PHONE MODE: which controls the touch layer shows, worked out from OUTSIDE the scenes.
//
// The layer looks at the game every frame (phones only): which scenes are running, and a few things it can read off
// them (busy, the interact prompt, side-scrolling). This file is the pure part: the table from that view to a mode.
// Scenes never have to switch the layer themselves, so a mode can't get stuck when an overlay forgets to switch back
// (research M11): the mode is re-derived every frame from what is on screen.
//
// Modes:
//   none    no controls (menus, title, dialogue, TV, cutscenes, anything not listed). Every tap reaches the game.
//   walk    floating stick (left 45% of the window, gutter included), ACTION with the verb while a prompt is up,
//           pause, and SANMIK when playing as Mikey.
//   tap     the whole screen is the game's tap area (overlay minigames); pause where pausing is allowed.
//   combat  top-down fighting rooms   } stage 1: the game's own canvas pad (TouchControls in the UI scene) does these,
//   side    side-scrolling rooms      } exactly as today ("legacy pad"); the layer stays out of the way.
//   brawl   the finale's SSJ brawl    } Stage 2 registers real layouts for them (see README).

export type LayerMode = "none" | "walk" | "combat" | "side" | "brawl" | "tap";
export const LAYER_MODES: readonly LayerMode[] = ["none", "walk", "combat", "side", "brawl", "tap"];

/**
 * How the pause button pauses:
 *   "edge"  the scene's own Esc path (the touch "pause" edge that Controls.pause() reads): Home, Hub, the dungeon, the
 *           Kreddle raid and rout. Exactly what Esc does on a laptop.
 *   "menu"  open the pause menu over the scene and pause it (Club, Kreddle, the Venue: on a laptop Esc walks you out
 *           of these, and each has its own exit to walk to, so on a phone the button is a real pause).
 */
export type PauseRoute = "edge" | "menu";

/** What the layer can read off one running scene. */
export interface SceneState {
  key: string;
  /** Busy: a panel, a conversation, a scripted moment. No walking, no pause, no ACTION. */
  busy?: boolean;
  /** The interact prompt's text while it is showing ("E: Watch KrelTV"), else null. */
  prompt?: string | null;
  /** Dungeon only: a side-scrolling room. */
  side?: boolean;
  /**
   * Something running inside a walking scene: Kreddle's chapter 6 raid or chapter 3 rout (fights), or the Hub's
   * shoving match on the bridge (E shoves a Kruncher; there is no prompt). In a fight (stage 2): "mash", a
   * tap-anywhere mash overlay is up (the WONK YOUR THANG gauge, the roof's group wonk).
   */
  sub?: "raid" | "rout" | "shove" | "mash" | null;
}

/** The stick a mode uses: "2d" walks / aims anywhere; "x" only left and right (side-scrolling rooms). */
export type StickKind = "2d" | "x";

export interface GameView {
  /** The RUNNING scenes (not paused or asleep), in draw order. */
  scenes: SceneState[];
  /** Playing as Mikey (the SANMIK toggle exists), and not in the SanMikverse where it's forced. */
  sanmikToggle?: boolean;
  /** What the player is using: the screen, or a controller connected to the phone (research S6, DEFERRED R11). */
  input?: InputSource;
}

export type InputSource = "touch" | "pad";

let inputSource: InputSource = "touch";

/** A controller took over ("pad": the touch controls hide), or a finger came back ("touch"). */
export function setInputSource(s: InputSource) {
  inputSource = s;
}

export function currentInputSource(): InputSource {
  return inputSource;
}

export interface ModeDecision {
  mode: LayerMode;
  /** The scene the decision is about (the one that will get pause / interact), or null. */
  scene: string | null;
  /** How pausing works here, or null where there is no pause. */
  pause: PauseRoute | null;
  /** Show the layer's own pause button (false when the canvas pad already has one). */
  pauseButton: boolean;
  /** ACTION's verb ("TALK"), or null when there's nothing to do. */
  action: string | null;
  /** Show SANMIK. */
  sanmik: boolean;
  /** The canvas pad does this mode (stage 1 combat / side / brawl): the layer must not take any touches. */
  legacyPad: boolean;
  /**
   * Live action: leaving the game running here can cost health or a run (fights, the raid, minigames). Coming back to
   * the game after the page was hidden, the phone upright or the guide open never drops straight into it (shell.ts).
   */
  live: boolean;
  /** The layer's floating stick, and which kind (null: none; the stick zone then takes no touches). */
  stick: StickKind | null;
  /** Stage 2+ rules may add their own fields (compared by sameDecision like the rest). */
  [extra: string]: unknown;
}

export const NONE: Readonly<ModeDecision> = Object.freeze({ mode: "none", scene: null, pause: null, pauseButton: false, action: null, sanmik: false, legacyPad: false, live: false, stick: null });

/** A row of the table: which scene keys it is about, and what it decides when one of them is running. */
export interface SceneRule {
  /** For the README and debugging. */
  name: string;
  match: (key: string) => boolean;
  decide: (scene: SceneState, view: GameView) => Partial<ModeDecision> | null;
}

const keys = (...k: string[]) => {
  const set = new Set(k);
  return (key: string) => set.has(key);
};

/** Scenes where you walk about: the stick, ACTION and pause. */
export const WALK_SCENES = ["Home", "Hub", "Club", "Kreddle", "Venue"] as const;
/** The walking scenes that bind the Mikey ⇄ SanMik toggle. */
const SANMIK_SCENES = new Set<string>(["Home", "Hub", "Club", "Kreddle", "Venue"]);

/**
 * The table, in priority order: the first rule with a running scene wins. Overlays come first (they sit over a
 * walking scene, which is often still running underneath, e.g. a conversation in town).
 */
export const SCENE_RULES: SceneRule[] = [
  {
    // screens and overlays with their own buttons: menus, conversations, cutscenes, TV, the 3D shots
    name: "screens and overlays",
    match: (k) =>
      /^__p3d/.test(k) ||
      keys("Boot", "Enter", "Title", "CharSelect", "Difficulty", "Banter", "ChapterSelect", "DebugSkip", "Menu", "Slots", "WeaponPick", "Dialogue", "Meeting", "Cutscene", "Vignette", "TV", "Archive", "KrazyFact", "Exile", "Ending", "Tutorial", "Lair", "RoofCutscene", "KrelCue", "DonutToilet")(k),
    decide: () => ({ mode: "none" }),
  },
  {
    // full-screen minigames: the whole screen is theirs (stage 3 adds their pause and controls)
    name: "minigames",
    match: keys("Minigame", "Whack", "Drive", "BeepBeep"),
    decide: () => ({ mode: "tap", live: true }),
  },
  {
    // card menus and boards you tap
    name: "tap-through places",
    match: keys("Pub", "Pit", "PitLoan", "PolsonHome"),
    decide: () => ({ mode: "none" }),
  },
  {
    name: "finale brawl",
    match: keys("Finale"),
    decide: () => ({ mode: "brawl", legacyPad: true, live: true }),
  },
  {
    // the dungeon: the canvas pad (with its own II) for now; the back gesture still pauses through the edge
    name: "dungeon",
    match: keys("Dungeon"),
    decide: (s) => (s.busy ? { mode: "none", legacyPad: true, scene: s.key } : { mode: s.side ? "side" : "combat", legacyPad: true, pause: "edge", pauseButton: false, live: true }),
  },
  {
    name: "walking",
    match: (k) => (WALK_SCENES as readonly string[]).includes(k),
    decide: (s, view) => {
      if (s.busy) return { mode: "none" };
      // Kreddle's raid and rout have their own Esc → pause menu; plain Kreddle, the Club and the Venue walk you out
      const pause: PauseRoute = s.key === "Home" || s.key === "Hub" || s.sub ? "edge" : "menu";
      // (the shoving match on the bridge: E shoves, and nothing shows a prompt)
      const action = s.sub === "shove" ? "SHOVE" : verbFromPrompt(s.prompt);
      const fight = s.sub === "raid" || s.sub === "rout";
      return { mode: "walk", pause, pauseButton: true, action, sanmik: !!view.sanmikToggle && SANMIK_SCENES.has(s.key) && !s.sub, live: fight, stick: "2d" };
    },
  },
];

/** Stage 2 / 3: add a rule (at the front by default, so it wins over the stage 1 rows). */
export function addSceneRule(rule: SceneRule, at: "front" | "back" = "front") {
  if (at === "front") SCENE_RULES.unshift(rule);
  else SCENE_RULES.push(rule);
}

/** The view → what the layer shows. */
export function resolveMode(view: GameView, rules: readonly SceneRule[] = SCENE_RULES): ModeDecision {
  for (const rule of rules) {
    // (the topmost running scene the rule is about)
    for (let i = view.scenes.length - 1; i >= 0; i--) {
      const sc = view.scenes[i];
      if (!rule.match(sc.key)) continue;
      const d = rule.decide(sc, view);
      if (!d) continue;
      return withInput({ ...NONE, scene: sc.key, ...d }, view);
    }
  }
  return withInput({ ...NONE }, view);
}

/** A controller in use: the decision says so (`input: "pad"`, the layer hides its controls); touch adds nothing. */
function withInput(d: ModeDecision, view: GameView): ModeDecision {
  if (view.input === "pad") d.input = "pad";
  return d;
}

/** Two decisions show the same thing: every field, including any a stage 2 rule added (shallow). */
export function sameDecision(a: ModeDecision, b: ModeDecision): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k]) || !(k in b)) return false;
  return true;
}

// ---------------------------------------------------------------- ACTION's word

/** Verbs that read well on the button. Anything else that can be used says USE. */
const VERBS = new Set(
  (
    "accept admire answer ask bank begin board browse buy call chat check cheer climb close collect confront cross dance deliver " +
    "drink drive eat empty enter examine exit feed file fill fix flip flush follow free get give go grab greet hand help hide hit " +
    "hug inspect join kick knock krezz leave light listen look make open order pay pet photograph pick place plant play pour " +
    "pray press pull punch push put read repair rest return ride ring rob rub rummage save search sell serve shoot shop shove sign " +
    "sing sit sleep slap smash spin squeeze start stay steal study swap switch take talk taste throw tip touch trade try turn " +
    "unlock upgrade use view visit vote wake wash watch wave wonk"
  ).split(" "),
);

/** "E: Talk to Gronny" → "TALK". Only prompts that start with the interact key mean ACTION can do something. */
const KEY_PREFIX = /^\s*(?:\[\s*E\s*\]|E)(?:\s*\/\s*[A-Z][A-Z ]*)?\s*:\s*/;

/**
 * Prompts whose first word isn't the right verb (places named by their name, machines, long verbs that crowd the
 * button), checked before the first-word rule. Phones only: the scene's own prompt text is never changed.
 */
export const VERB_OVERRIDES: readonly [RegExp, string][] = [
  [/^(?:Cross the bridge|(?:The )?Kreddle Bridge)\b/i, "GO"],
  [/^Polson Towers\b/i, "VISIT"],
  [/\bKREDDLE EXCHANGE\b/i, "ENTER"],
  [/^(?:THE KLAW|KRAZY REELS|KREDDLE KARDS|WHACK-A-DRONGUS)\b/i, "PLAY"],
  [/^WHEEL OF KREDDLE\b/i, "SPIN"],
  [/\bVending\b/i, "BUY"],
  [/^Rummage\b/i, "SEARCH"],
  [/^(?:Inspect|Examine)\b/i, "LOOK"],
];

export function verbFromPrompt(text: string | null | undefined): string | null {
  if (!text) return null;
  const first = String(text).split("\n")[0];
  const m = KEY_PREFIX.exec(first);
  if (!m) return null;
  const rest = first.slice(m[0].length).replace(/^[^A-Za-z]+/, "");
  for (const [re, verb] of VERB_OVERRIDES) if (re.test(rest)) return verb;
  const word = /^[A-Za-z][A-Za-z'-]*/.exec(rest)?.[0] ?? "";
  const lw = word.toLowerCase();
  return VERBS.has(lw) ? lw.toUpperCase() : "USE";
}
