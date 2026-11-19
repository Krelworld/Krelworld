// Shared data types. Nothing in here imports Phaser, so the logic layer can be unit-tested.

export const PLAYABLE_IDS = [
  "FLENKY",
  "KREZMAR",
  "KREBLIS",
  "KREZWONK",
  "SCROMBUS",
  "KREBON",
  "CRONGUS",
  "GRONNY",
  "MIKEY",
] as const;

export type PlayableId = (typeof PLAYABLE_IDS)[number];

export type CharacterId =
  | PlayableId
  | "DRONGUS"
  | "PROCTUS"
  | "POLSON"
  | "EDEN"
  | "TAP"
  | "ARCHIVE"
  | "NARRATOR";

/** Speakers can be a known character or any free-form name (TV shows, bosses, randoms). */
export type SpeakerId = CharacterId | (string & {});

export type ReactionChoice = "LIKE" | "LOVE" | "LAUGH" | "ANGRY" | "SEEN";

export const REACTION_EMOJI: Record<ReactionChoice, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  LAUGH: "😂",
  ANGRY: "😡",
  SEEN: "Seen",
};

export type FlagValue = boolean | number | string;

/** Every key that is present must hold (logical AND). */
export interface Cond {
  flag?: string;
  flagEq?: [string, FlagValue];
  notFlag?: string;
  chapter?: number;
  chapterAtLeast?: number;
  chapterAtMost?: number;
  player?: PlayableId | PlayableId[];
  notPlayer?: PlayableId | PlayableId[];
  revision?: string;
  notRevision?: string;
  intoxAtLeast?: number;
  intoxBelow?: number;
  resentmentAtLeast?: number;
  ngPlus?: boolean;
  /** Only in the ALT build (true) / only in the normal build (false): see src/game/variant.ts. */
  alt?: boolean;
  any?: Cond[];
  not?: Cond;
}

export interface ReactionPrompt {
  /** What the player is reacting to (shown as a Messenger bubble). */
  message: string;
  from?: SpeakerId;
  /** Context key so reactions can be tallied and remembered. */
  context: string;
  options?: ReactionChoice[];
  outcomes?: Partial<Record<ReactionChoice, Line[]>>;
}

export interface ChoiceOption {
  label: string;
  cond?: Cond;
  set?: Record<string, FlagValue>;
  lines?: Line[];
}

export interface Line {
  /** Speaker. */
  s: SpeakerId;
  /** Text. Can be empty when the beat is only a reaction prompt / choice / stage direction. */
  t: string;
  id?: string;
  /** Pull speaker + text from the canon quote registry. */
  canon?: string;
  /** canon = verbatim chat quote, adapted = lightly reshaped, new = written for the game. */
  tag?: "canon" | "adapted" | "new";
  cond?: Cond;
  /** Stage direction shown in italics instead of speech. */
  dir?: boolean;
  /**
   * This line is a ministerial function. If the speaker is the current player,
   * PROCTUS KRELMOR delivers `proctus` instead (his mangled version).
   */
  role?: boolean;
  proctus?: string;
  /** Per-player replacement text when the listed player is the speaker or present. */
  variants?: Partial<Record<PlayableId, string>>;
  /** ALT build only: replaces `t` (a player's `variants` entry still wins; `altVariants` replaces those). */
  alt?: string;
  /** ALT build only: per-player replacements, over `variants`. */
  altVariants?: Partial<Record<PlayableId, string>>;
  react?: ReactionPrompt;
  choice?: ChoiceOption[];
  set?: Record<string, FlagValue>;
  sfx?: string;
  /** Messenger-notification style instead of a dialogue box. */
  notify?: boolean;
  emo?: string;
  /**
   * How the recorded voice delivers the line: an ElevenLabs v3 audio tag such as "angry", "whispers", "laughs"
   * (comma-separated for several: "sad, crying"). Never shown on screen. Without one, the voice generator
   * picks a delivery from the text (see docs/VOICE_MOODS.md). Inline tags like "[sighs]" in `t` also work.
   */
  mood?: string;
  /** Play this KrelTV episode on the telly right here, then carry on. */
  tv?: string;
  /** Cut out to the town and raise Da Drongus Dungeon (HubScene), then carry on with the script. */
  rise?: boolean;
  /**
   * Offer a Kreltality on someone right here, no fight (KrelCueScene.ts: `target` is a KREL_CUES key, e.g. "robbo"),
   * then carry on: `yes` plays if it was done, `no` if they were spared.
   */
  krel?: { target: string; yes?: Line[]; no?: Line[] };
  /** A staged moment in the room as this line shows (e.g. "robbo_enter"): see TownMeetingScene.fx. */
  fx?: string;
  /**
   * An anime beat before this line shows (a drawn still, a face cut-in, a freeze-frame, a slam, a stinger…), and/or
   * once it's been read: see gfx/SideCine.ts for the cue format. Skippable like the line itself. A cue that names a
   * story beat in content/cine.ts (chapters 1-5: "ch3_unmask") plays that instead (gfx/Cine.ts).
   */
  cine?: string;
  cineAfter?: string;
}

export interface MeetingScript {
  id: string;
  title: string;
  subtitle?: string;
  agenda: string[];
  /** Archive reconstructions show the original speakers and never substitute Proctus. */
  historical?: boolean;
  location: "TOWN_HALL" | "FGM_ARCHIVE" | "WAR_ROOM";
  attendees?: SpeakerId[];
  beats: Line[];
  onComplete?: Record<string, FlagValue>;
  unlocksArchive?: string[];
}

export interface CanonLine {
  id: string;
  speaker: CharacterId;
  text: string;
  sourceEra: "FGM_ULTRA" | "KRELWORLD";
  sourceTimestamp?: number;
  tags: string[];
}

export interface ArchiveEntry {
  id: string;
  title: string;
  era: "FGM_ULTRA" | "KRELWORLD" | "PRESENT";
  date: string;
  official: string;
  original: Line[];
  footnote?: string;
  drongusAnnotation?: string;
}

export type Upgrades = Record<string, number>;

export interface GameState {
  version: number;
  player: PlayableId;
  chapter: number;
  /** "hub" while exploring Krelford, "dungeon" inside a chapter dungeon. */
  phase: "hub" | "dungeon" | "ended";
  flags: Record<string, FlagValue>;
  revisions: string[];
  upgrades: Upgrades;
  hp: number;
  coins: number;
  krezz: number;
  bottles: number;
  bongos: number;
  /** Owned ranged weapons -> ammo left. */
  guns?: Record<string, number>;
  /** Gun in hand (undefined = fists). */
  gun?: string;
  /** Weapon order set at the gun rack: swap/auto-switch order, first = what you start a dungeon holding. Owned guns not listed go after. */
  gunOrder?: string[];
  intoxication: number;
  banRisk: number;
  banCount: number;
  drongusResentment: number;
  relationships: Record<string, number>;
  reactionsGiven: Record<ReactionChoice, number>;
  quests: Record<string, number>;
  kills: Record<string, number>;
  tvWatched: string[];
  archiveUnlocked: string[];
  discovered: string[];
  ngPlus: number;
  playtimeMs: number;
  ending?: ReactionChoice;
  /** 1-5 (src/game/systems/difficulty.ts). 2 = the original balance (old saves), 3 = the default for new games. */
  difficulty: number;
  /** When this save was written (ms since epoch). Old saves don't have it. */
  savedAt?: number;
  /** Where it was saved, for the LOAD list ("Krelford · Krezz Arms", "Da Drongus Dungeon · room 3"). */
  where?: string;
  /** The objective at the time, for the LOAD list. */
  objective?: string;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: boolean;
  crt: boolean;
  textSpeed: number;
  /** Text-to-speech for dialogue and TV (browser voices). */
  voices?: boolean;
  voiceVolume?: number;
  /** Multiplies every character's speaking rate (the browser caps the result at 2x). */
  voiceSpeed?: number;
  /** Which speech-speed default the save has been moved onto (2 = the 1.25 default). */
  voiceSpeedV?: number;
  /** Gore mode: blood and dismemberment (default on). */
  gore?: boolean;
  /** Custom key bindings (action id -> Phaser key names). Missing actions use the defaults. */
  keys?: Record<string, string[]>;
  /** Custom gamepad bindings (action id -> standard-layout button indices). Missing actions use the defaults. */
  pad?: Record<string, number[]>;
  /** Auto-aim (the Krezz-Assist upgrade, and touch aim assist). Default on; only false turns it off. */
  autoAim?: boolean;
  /** Dialogue moves on by itself once the line has been read out. */
  autoAdvance?: boolean;
  /** Tone down full-screen flashes (photosensitivity). */
  calmFlash?: boolean;
  /** Keep the mouse inside the game window (pointer lock; desktop). Default on; only false turns it off. */
  mouseLock?: boolean;
}

/**
 * The kit you finished your last game with (src/game/systems/carry.ts): every new game starts with it.
 * Gear only: guns, upgrades and perks, money and consumables. Never story progress.
 */
export interface CarriedLoadout {
  /** Who finished the game with it. */
  from: PlayableId;
  /** Owned guns -> ammo. */
  guns: Record<string, number>;
  /** Gun in hand. */
  gun?: string;
  /** The gun-rack order. */
  gunOrder: string[];
  /** s.upgrades: stat upgrades, bank perks and moves, Kreddle prizes, gun mods, home decor, fairies… */
  upgrades: Upgrades;
  coins: number;
  bottles: number;
  bongos: number;
  /** When it was saved (ms since epoch). */
  at: number;
}

export interface MetaState {
  version: number;
  /** The loadout from your last finished game: new games and Chapter Select start with it. */
  carry?: CarriedLoadout;
  /** The first-dungeon controls pop-up has been shown. */
  tutDungeon?: boolean;
  archiveUnlocked: string[];
  tvWatched: string[];
  completedWith: PlayableId[];
  ngPlusUnlocked: boolean;
  settings: Settings;
  /** Music you've heard (jukebox ids, across all runs), in the order you first heard it. */
  heardMusic?: string[];
  /** Kreltalities seen in the current cycle (no repeats until you've seen them all). */
  krelSeen?: string[];
  /** The last Kreltality played, so a new cycle never opens with it. */
  krelLast?: string;
}
