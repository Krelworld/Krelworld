import { describe, expect, it } from "vitest";
import { newGameState } from "../src/game/systems/state";
import { afterKreddle, moodTrack } from "../src/game/systems/moodMusic";
import { MUSIC_FILES } from "../src/game/audio/Synth";

describe("after Kreddle: the old themes stay gone", () => {
  it("leaves everything alone before the nuke", () => {
    const s = newGameState("FLENKY");
    s.chapter = 6;
    s.flags.krunch_started = true;
    expect(afterKreddle(s)).toBe(false);
    for (const id of ["hub", "pub", "home", "crazy", "kreddle", "boss", "crystal"]) expect(moodTrack(id, s)).toBe(id);
  });

  it("swaps the town, dungeon and boss themes for the sombre ones once it's gone off", () => {
    const s = newGameState("FLENKY");
    s.chapter = 7;
    s.flags.krelworld_bombed = true;
    expect(afterKreddle(s)).toBe(true);
    for (const id of ["hub", "hub_night", "home", "pub", "klerble", "crazy", "sanmik", "ggg13", "viral"]) expect(moodTrack(id, s)).toBe("town_mourning");
    for (const id of ["meeting", "archive", "kreddle", "crandle", "stockport", "wiki"]) expect(moodTrack(id, s)).toBe("ominous");
    for (const id of ["boss", "boss_arena", "fight_flirt", "kreddle_raid"]) expect(moodTrack(id, s)).toBe("c6e_krunch");
    expect(moodTrack("crystal", s)).toBeNull();
    // the scores and stings carry on
    for (const id of ["c7_dungeon", "c7_spirit", "fe_brawl", "fd_wake", "c6e_aftermath", "town_mourning", "ominous", "dungeon_rise", "anthem", "title", "news", "mot_theme"]) expect(moodTrack(id, s)).toBe(id);
  });

  it("the night of the nuke is silent in town; the morning after is the piano", () => {
    const s = newGameState("FLENKY");
    s.chapter = 6;
    s.flags.kreddle_nuked = true;
    expect(moodTrack("hub", s)).toBe("");
    s.chapter = 7;
    s.flags.krelworld_bombed = true;
    s.flags.finale_dawn = true;
    expect(moodTrack("hub", s)).toBe("fd_wake");
  });

  it("every stand-in is a real track", () => {
    const s = newGameState("FLENKY");
    s.chapter = 7;
    for (const id of Object.keys(MUSIC_FILES)) {
      const to = moodTrack(id, s);
      if (to) expect(MUSIC_FILES[to], `${id} -> ${to}`).toBeTruthy();
    }
  });
});
