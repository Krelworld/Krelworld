/**
 * THE JUKEBOX (your house): every piece of music you've heard goes on it. Tracks are named for where they play in
 * the game, not their file names, except SanMik & SanChz's songs, which go by their real titles.
 * `ids` are the music ids that play this track (synth.music); hearing any of them unlocks it.
 */
export interface JukeboxTrack {
  ids: string[];
  title: string;
  /** where you heard it (shown under the title) */
  where: string;
  /** SanMik & SanChz: listed under their own heading */
  sanmik?: boolean;
}

export const JUKEBOX: JukeboxTrack[] = [
  // ---------------------------------------------------------------- around Krelford
  { ids: ["title"], title: "Krelworld (Main Theme)", where: "The title screen" },
  { ids: ["hub"], title: "Krelford by Day", where: "Walking round town" },
  { ids: ["hub_night"], title: "Krelford After Dark", where: "Walking round town, at night" },
  { ids: ["home"], title: "Home Sweet Home", where: "Your house" },
  { ids: ["pub"], title: "Last Orders at the Krezz Arms", where: "The Krezz Arms" },
  { ids: ["meeting", "archive"], title: "Cabinet Business", where: "Town hall briefings and the Historical Archive" },
  { ids: ["klerble"], title: "The Klerble Express", where: "The Klerble train" },
  { ids: ["crazy"], title: "Crazy for Krelworld", where: "Town celebrations" },
  { ids: ["techno_dance"], title: "Town Square Rave", where: "Dancing in the town square" },
  { ids: ["anthem"], title: "The Krelworld National Anthem", where: "The Anthem Corridor" },
  { ids: ["airport"], title: "Krelford International", where: "The airport" },
  { ids: ["kreddle"], title: "Neon Kreddle", where: "Over the bridge in Kreddle" },
  { ids: ["kreddle_raid"], title: "The Kreddle Raid", where: "The raid on Kreddle" },
  { ids: ["raid_march"], title: "The March On Kreddle", where: "Chapter 6" },
  { ids: ["c6e_aftermath"], title: "Ground Zero", where: "The end of Kreddle" },
  { ids: ["c6e_krunch"], title: "The Krunch Protocol", where: "The end of Chapter 6" },
  { ids: ["town_mourning"], title: "Krelford Mourns", where: "After the Krel Tower fell" },
  { ids: ["ominous"], title: "Something's Not Right", where: "Ominous moments (and the Ministry)" },
  { ids: ["crobley"], title: "Nibble on a Crobley", where: "The Crobley advert" },
  { ids: ["news"], title: "KrelTV News at Ten", where: "KrelTV news" },
  { ids: ["doc"], title: "Exile", where: "Exile" },
  // ---------------------------------------------------------------- dungeons
  { ids: ["crandle"], title: "Wildern Academy", where: "Wildern Academy" },
  { ids: ["stockport", "boss_hoard"], title: "Polson Towers", where: "Polson Towers (and The Cyst)" },
  { ids: ["cronny"], title: "The Cuddle Tower", where: "The Cuddle Tower" },
  { ids: ["crobley_factory"], title: "The Crobley Factory", where: "The Crobley Factory" },
  { ids: ["krel_tower_rap"], title: "Flight KR-069", where: "Operation Plane Into Train" },
  { ids: ["mdmazing"], title: "MDMAzing", where: "The Nu Warehouse" },
  { ids: ["luke_mind"], title: "Kill the Pedo in Luke", where: "Inside Lulon's mind" },
  { ids: ["wiki"], title: "Da Drongus's Lair", where: "The top of Da Drongus Dungeon" },
  { ids: ["dungeon_rise"], title: "Da Drongus Dungeon Rises", where: "The night the tower came up" },
  { ids: ["c7_ascent"], title: "The Ascent", where: "Chapter 7" },
  { ids: ["c7_dungeon"], title: "Da Drongus Dungeon", where: "The Foyer and Da Drongus Corridor" },
  { ids: ["c7_stairs"], title: "The Final Stairs", where: "Chapter 7" },
  { ids: ["c7_roof"], title: "Dark Drongus", where: "Boss: Dark Drongus (the Roof)" },
  { ids: ["c7_concept"], title: "Krelford Burns", where: "The finale" },
  { ids: ["c7_spirit"], title: "Spirit of Krelworld", where: "The finale" },
  { ids: ["fe_clash"], title: "The Clash", where: "The finale: the SPIRIT CUM" },
  { ids: ["c7_transform"], title: "Transformation", where: "The finale" },
  { ids: ["crystal"], title: "The Crystal Is Yours", where: "Winning a crystal" },
  { ids: ["krelworld_orch"], title: "Krelworld (Full Orchestra)", where: "The epilogue" },
  { ids: ["ending"], title: "The End?", where: "The ending" },
  // ---------------------------------------------------------------- bosses
  { ids: ["boss", "boss_rival"], title: "Boss Fight", where: "Bosses (and Chad Deltoid)" },
  { ids: ["boss_troll"], title: "Alistair Swamp", where: "Boss: Alistair Swamp" },
  { ids: ["boss_flatmate", "boss_arena"], title: "Robbo / The Arena", where: "Boss: Robbo, and the arena fights" },
  { ids: ["boss_krandall"], title: "Kranky Krandall", where: "Boss: Kranky Krandall" },
  { ids: ["boss_salmon"], title: "The Salmon Sovereign", where: "Boss: The Salmon Sovereign" },
  { ids: ["boss_feedback"], title: "The Feedback Loop", where: "Boss: The Polson-Eden Feedback Loop" },
  { ids: ["boss_machine"], title: "The Over-Wonked Machine", where: "Boss: The Over-Wonked Machine" },
  { ids: ["boss_banhammer"], title: "The Supreme Banhammer", where: "Boss: The Supreme Banhammer Automaton" },
  { ids: ["boss_spectre"], title: "The Spectre of Krezmond", where: "Boss: The Spectre of Krezmond's Betrayal" },
  { ids: ["boss_krozno"], title: "Captain Stanley", where: "Boss: Captain Stanley" },
  { ids: ["boss_brand", "flenky"], title: "Russell Brand", where: "Boss: Russell Brand" },
  { ids: ["boss_cronster"], title: "The Cuddle Cronster", where: "Boss: The Cuddle Cronster" },
  { ids: ["fight_flirt"], title: "Flirt Crobley", where: "Boss: Flirt Crobley" },
  { ids: ["fight_tank"], title: "Tank Crobley", where: "Boss: Tank Crobley" },
  { ids: ["fight_fruity"], title: "He's So Fruity", where: "Boss: Fruity Crobley" },
  { ids: ["fd_wake"], title: "Hitori no Piano (Slightly Faster)", where: "The morning after" },
  { ids: ["fight_hoard"], title: "Defeat My Cyst (SanChz)", where: "Boss: The Cyst" },
  { ids: ["fight_reinhardt"], title: "Mental Problems", where: "Boss: Reinhardt Crobley" },
  { ids: ["fight_lantern"], title: "Chinese Crobley", where: "Boss: Chinese Crobley" },
  { ids: ["c7_krex"], title: "Metal Gear Krex", where: "Boss: Metal Gear Krex" },
  { ids: ["c7_elon"], title: "Elon Musk (AI-Generated)", where: "Boss: Elon Musk (AI-Generated)" },
  { ids: ["c7_drongus1"], title: "Drongus B. Drippin'", where: "Boss: Drongus B. Drippin'" },
  { ids: ["c7_deranged"], title: "Deranged Drongus", where: "Boss: Deranged Drongus" },
  { ids: ["final"], title: "The Final Wonking", where: "The last boss" },
  // ---------------------------------------------------------------- minigames
  { ids: ["crocodile"], title: "Crocodile", where: "The crocodile rhythm game" },
  { ids: ["twitcher"], title: "Twitcher Mutiny (Live)", where: "Benn's gig at the Krezz Arms" },
  { ids: ["bbp"], title: "The Abandoned Building", where: "Tailing Lil' Crongus" },
  // ---------------------------------------------------------------- SanMik & SanChz (real titles)
  { ids: ["ggg1", "boss_jam"], title: "BPD Menace", where: "SanMik & SanChz (also: JQ, the Jam Queen)", sanmik: true },
  { ids: ["ggg2"], title: "Ashurst", where: "SanMik & SanChz", sanmik: true },
  { ids: ["ggg3"], title: "I Don't Need Yhu", where: "SanMik & SanChz · OrChzMik", sanmik: true },
  { ids: ["ggg4", "drive"], title: "Viva Reggaeton", where: "SanMik & SanChz · GTA: SanMik", sanmik: true },
  { ids: ["ggg5"], title: "Deep in Ure Ass", where: "SanMik & SanChz · Jerk My Gherk", sanmik: true },
  { ids: ["ggg6", "sanmik"], title: "Peener Colarder", where: "SanMik & SanChz · Peener 4eva", sanmik: true },
  { ids: ["ggg7"], title: "Fuck U Bitch", where: "SanMik & SanChz · The Nu Warehouse", sanmik: true },
  { ids: ["lamp_rub"], title: "Rub The Lamp", where: "The Krezz Arms back room" },
  { ids: ["tower_crash"], title: "The Krel Tower Has Fallen (Again)", where: "Flight KR-069" },
  { ids: ["ggg9"], title: "Wank Til U Spunk", where: "SanMik & SanChz · Peener 4eva", sanmik: true },
  { ids: ["ggg10"], title: "Fragrant Bitch", where: "SanMik & SanChz · Jerk My Gherk", sanmik: true },
  { ids: ["ggg11"], title: "Happy Birthday You Cunt", where: "SanMik & SanChz · The Nu Warehouse", sanmik: true },
  { ids: ["ggg12"], title: "I Love Christmas", where: "SanMik & SanChz · GTA: SanMik", sanmik: true },
  { ids: ["ggg13", "boss_rik"], title: "In Tha Hot Tub", where: "SanMik & SanChz · Peener 4eva", sanmik: true },
  { ids: ["beepbeep"], title: "Beep Beep", where: "SanMik & SanChz", sanmik: true },
  { ids: ["night_of_freedom"], title: "Night of Freedom", where: "SanMik & SanChz", sanmik: true },
  { ids: ["sanmik_nation"], title: "SanMik Nation", where: "SanMik & SanChz", sanmik: true },
  { ids: ["majek_lampe"], title: "Majek Lampe", where: "SanMik & SanChz", sanmik: true },
  { ids: ["viral"], title: "Viral", where: "SanMik & SanChz", sanmik: true },
];

/** The jukebox entry a music id belongs to. */
export function trackFor(id: string): JukeboxTrack | undefined {
  return JUKEBOX.find((t) => t.ids.includes(id));
}
