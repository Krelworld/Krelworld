import type { GameState } from "../../data/types";

/**
 * AFTER KREDDLE: once the nuke has gone off, the old upbeat themes don't come back. Every synth.music() call goes
 * through moodTrack(), which swaps an earlier theme (the town, home, the pub, Kreddle's neon, the old dungeons,
 * the old bosses, SanMik's songs, the minigame jingles...) for the sombre equivalent that's already in the game.
 *
 * Not touched: the Chapter 6 aftermath and Chapter 7 / finale scores (c6e_*, c7_*, fe_*, fd_wake, ominous,
 * town_mourning, dungeon_rise, final, anthem, ending, krelworld_orch), the title screen, and the telly's own music.
 * Places where the player picks the music (the jukebox) or the story deliberately plays an old song call
 * synth.musicRaw() and skip this altogether.
 */

/** Has Kreddle been nuked (in this run)? */
export function afterKreddle(s: GameState | null | undefined): boolean {
  if (!s?.flags) return false;
  const f = s.flags;
  return !!(f.kreddle_nuked || f.vig_krunch_protocol || f.krelworld_bombed || f.finale_dawn) || s.chapter >= 7;
}

/** Walking about: the town, indoors, the bars, the songs. Becomes Krelford in mourning (the morning-after piano once the sun's up). */
const TOWN = new Set([
  "hub", "hub_night", "home", "pub", "klerble", "crazy", "techno_dance", "airport", "krel_tower_rap", "raid_march",
  "sanmik", "sanmik_nation", "beepbeep", "drive", "night_of_freedom", "lamp_rub", "majek_lampe", "mdmazing", "norwich",
  "crobley", "flenky", "whack", "bbp", "viral", "twitcher", "crocodile",
  ...Array.from({ length: 13 }, (_, i) => `ggg${i + 1}`),
]);

/** The old dungeons, briefings and Kreddle's Strip: something's not right. */
const DUNGEON = new Set(["meeting", "archive", "school", "mansion", "industrial", "temple", "prison", "wiki", "crandle", "stockport", "crobley_factory", "cronny", "luke_mind", "kreddle"]);

/** The old boss and fight themes: the Krunch Protocol's (dark, driving) instead. */
const FIGHT = new Set([
  "boss", "boss_salmon", "boss_krandall", "boss_feedback", "boss_machine", "boss_banhammer", "boss_spectre", "boss_krozno", "boss_brand",
  "boss_troll", "boss_flatmate", "boss_rival", "boss_cronster", "boss_arena", "boss_rik", "boss_jam", "boss_hoard", "kreddle_raid",
  "fight_flirt", "fight_tank", "fight_fruity", "fight_hoard", "fight_reinhardt", "fight_lantern",
]);

/** Little celebratory stings: after Kreddle, nothing plays (whatever's on carries on). */
// (the crystal jingle always plays: every cum crystal gets its sting, the last one included)
const STING = new Set<string>();

/**
 * What actually plays when the game asks for `id`:
 *  - the same id (unchanged),
 *  - another id (the sombre stand-in),
 *  - "" (silence: just the ambience),
 *  - null (don't touch the music at all).
 */
export function moodTrack(id: string, s: GameState | null | undefined): string | null {
  if (!afterKreddle(s)) return id;
  const f = s!.flags;
  if (TOWN.has(id)) {
    // the night Kreddle goes up, between the blast and the bombing of Krelford: no town theme at all
    if (s!.chapter === 6 && !f.krelworld_bombed) return "";
    return f.finale_dawn ? "fd_wake" : "town_mourning";
  }
  if (DUNGEON.has(id)) return "ominous";
  if (FIGHT.has(id)) return "c6e_krunch";
  if (STING.has(id)) return null;
  return id;
}

/** Hook the gate into the synth (once, at boot). */
export function installMoodMusic(synth: { moodGate: ((id: string) => string | null) | null }, state: () => GameState | null | undefined) {
  synth.moodGate = (id) => moodTrack(id, state());
}
