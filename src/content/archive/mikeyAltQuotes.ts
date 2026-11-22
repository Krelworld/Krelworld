import type { ArchiveEntry, Line } from "../../data/types";
import { say } from "../dsl";

// The ALT build only (src/game/variant.ts): Mikey is one of the lads, so the Historical Archive has him in the chat in
// the Krelworld era too, reacting, heckling and joining in. Every line is his own words, copied (verbatim, or with the
// unrelated half of the message cut) from his chat logs; none is written for the game. They carry no timestamps, and
// in the ALT build the Archive shows no dates or clock times at all (ArchiveScene, ARCHIVE_UNDATED below).
// The normal build never weaves any of this in: historicalScenes.ts only calls weaveMikeyAlt() when ALT is set, and
// every line is gated with cond.alt as well.

/** Where his lines go: after the entry's line quoting this canon id ("^" = at the very start), in this order. */
export interface MikeyDrop {
  after: string;
  lines: string[];
}

export const MIKEY_ARCHIVE_ALT: Record<string, MikeyDrop[]> = {
  arch_motto: [
    { after: "drongus_name", lines: ["ITS DAT BOI"] },
    { after: "motto", lines: ["WONKEY DONKEEEEYYY", "YEEEEEEEEEE"] },
    { after: "wonk_til_krez_request", lines: ["Sanmik ai song?"] },
  ],
  arch_scrombus_arrival: [
    { after: "lore_origin", lines: ["Luv the lore!"] },
    { after: "lore_prophecy", lines: ["Wtf wen diss bacom lore?"] },
    { after: "whatever", lines: ["I LOVE IT"] },
    { after: "prophecy_true", lines: ["Here we go. This will be interesting"] },
    { after: "where_am_i", lines: ["Who the fuck are they?"] },
  ],
  arch_national_drink: [
    { after: "national_drink", lines: ["PUSSI BEERE", "That’s fucking discusting"] },
    { after: "vapin_pj", lines: ["SQUIRT IS MA FAVRIT DRINK"] },
  ],
  arch_vending: [
    { after: "pot_noodle", lines: ["ME R HUNGRY Lmao"] },
    { after: "vending", lines: ["lmfao that's crazy. the markup on that stuff is RIDICULOUS"] },
    { after: "umami_punani", lines: ["Lmfao this shit is so fucking funny"] },
  ],
  arch_krazy_fact: [
    { after: "krazy_fact_decree", lines: ["Don’t want to get kicked out of the group yet"] },
    { after: "drongi", lines: ["Becausee I’m KRAZY!!"] },
    { after: "strike", lines: ["GET ME BACK IN THE GROUP"] },
  ],
  arch_krezmond: [
    { after: "who_is_krebon", lines: ["Hahaha what’s his name going to be?"] },
    { after: "krezmond_saga2", lines: ["Lmfao. Love how Act 1 is about 20 seconds long lmao"] },
    { after: "krez_sigil", lines: ["Fucking brilliant"] },
  ],
  arch_krebon_menu: [{ after: "krebon_menu", lines: ["Lads!! Salmon on special!!"] }],
  arch_founding_cabinet: [
    { after: "elect_cabinet", lines: ["Vote for me"] },
    { after: "all_cabinet_roles", lines: ["POWERRRRRR"] },
    { after: "drongus_voted_no", lines: ["shall i delete my name and re-add it and then vote for myself so it only has 1 vote? hahahaha"] },
    { after: "need_cabinet", lines: ["He’s ignoring us about the cabinet!!"] },
    { after: "fuck_sake", lines: ["He is the minister of spoons after all"] },
    { after: "minister_ai", lines: ["I would love to be considered for the Chief Arse-Licking Officer role you have recently advertised."] },
  ],
  arch_defence: [
    { after: "evk_ransom", lines: ["HOLY FUCKING SHIT"] },
    { after: "huge_oversight", lines: ["Fucking unbelievable"] },
    { after: "no_defence", lines: ["Absolutely fucking mental lmao"] },
    { after: "invade_kreddle", lines: ["We should invade"] },
    { after: "krezbians", lines: ["Team Rocket have invaded pokemon go!!!!!!! 😩😩"] },
  ],
  arch_wonking_machine: [
    { after: "wiki_updated", lines: ["I fucking love this absurd conspiracy theory has its own Wikipedia page"] },
    { after: "nobody_wonking", lines: ["Sorry I’m working atm not following too closely", "HOUSE OF FUN HAHAHHAHA"] },
  ],
  arch_appreciation: [
    { after: "here_4_u", lines: ["THE LOVE I HAVE YOUR YOU IS ENDLESS"] },
    { after: "lack_appreciation", lines: ["WE BOTH HAVE FLAWS THAT NEED TO BE WORKED ON"] },
    { after: "more_hostile", lines: ["YOURE ACTING LIKE A BUNCH OF LITTLE BABIES"] },
  ],
  arch_drongus_craft: [
    { after: "chatgpt_not_funny", lines: ["The ai made that up and I couldn’t believe it"] },
    { after: "write_lyrics_myself", lines: ["This is AI generated isn’t it? 😂"] },
    { after: "finessed_20_times", lines: ["Fuck anyone who argues against AI"] },
    { after: "deranged", lines: ["AI is just like", "Some sort of natural progression"] },
    { after: "that_spirit", lines: ["Genuinely the best Sanchz album by a country fucking mile"] },
    { after: "give_my_all", lines: ["I’ll look out for vouchers"] },
    { after: "krelfund", lines: ["You should post your bank details 😂😂😂 £25 is £25"] },
    { after: "whip_around", lines: ["Monopoly vouchers. Free food"] },
  ],
  arch_kreltower: [
    { after: "ninja_backflip", lines: ["Omg what a fucking moment that was"] },
    { after: "smells_horse_krez", lines: ["GRAND THEFT HORSEO"] },
    { after: "kreltower_breached", lines: ["It’s not looking great is it"] },
    { after: "only_just_rebuilt", lines: ["USED CRANE HAHAHAHAHAA"] },
  ],
  arch_purple: [
    { after: "purple_high_low", lines: ["A frog is different from a fucking toad"] },
    { after: "only_talking_to_you", lines: ["I’m so lost. What is going on? Lol."] },
  ],
  arch_godric: [
    { after: "godric", lines: ["Yh the ministry of magic should probably get involved"] },
    { after: "tearing_shreds", lines: ["This is fucking unhinged lmao"] },
  ],
  arch_squeeze: [
    { after: "squeeze_scrom", lines: ["FEELING COOL FEELING COOL", "Fuckin got cymbals stuck in me head"] },
    { after: "wallace_grom", lines: ["Boner’s yeee"] },
  ],
  arch_crobley: [
    { after: "crobley_jingle", lines: ["HUMGREY EXSIZE LATER NUM NUM NUM", "7 bags of crisps before lunch though lol"] },
    { after: "headmaster", lines: ["Lmfao keep this coming"] },
    { after: "crobley_arc", lines: ["Can’t fucking wait for this"] },
  ],
  arch_big_bertha: [{ after: "big_bertha", lines: ["Is that just like a bag of potatoes thrown on the carpet? Lmao"] }],
};

/** A Mikey line for the ALT Archive: a real chat quote (shown as one), ALT build only. */
export const mikeyAlt = (t: string): Line => say("MIKEY", t, { tag: "canon", cond: { alt: true } });

/** All of them as Lines, so the voice extractor (scripts/voice-extract.ts) records them in Mikey's own voice. */
export const MIKEY_ARCHIVE_ALT_LINES: Line[] = Object.values(MIKEY_ARCHIVE_ALT).flatMap((ds) => ds.flatMap((d) => d.lines.map(mikeyAlt)));

/**
 * The ALT Archive has no dates or clock times: footnotes that quote one get a version without it (only that part
 * changes), and the reenactments' "N days later" stage directions just say later.
 */
export const ARCHIVE_UNDATED: Record<string, { footnote?: string; drongusAnnotation?: string }> = {
  arch_scrombus_arrival: { footnote: "Scrombus was added shortly before the new year. The prophecy said 2025. He was a couple of hours early." },
  arch_national_drink: { footnote: "Time immemorial began one evening, not long ago." },
};
const UNDATED_DIRS: Record<string, string> = {
  "Nine days later:": "Later:",
  "Ninety-eight minutes later.": "Some time later.",
  "Six weeks later.": "Some time later.",
  "Six weeks later:": "Later:",
};

/** The ALT build's Archive: Mikey woven into the Krelworld-era chat, and every date and time taken out. */
export function weaveMikeyAlt<T extends ArchiveEntry>(list: T[]): T[] {
  return list.map((e) => {
    const drops = MIKEY_ARCHIVE_ALT[e.id] ?? [];
    let original = e.original.map((l) => (l.dir && UNDATED_DIRS[l.t] !== undefined ? { ...l, t: UNDATED_DIRS[l.t] } : l));
    for (const d of drops) {
      const at = d.after === "^" ? 0 : original.findIndex((l) => l.canon === d.after) + 1;
      if (at <= 0 && d.after !== "^") continue; // anchor missing (the test catches this)
      original = [...original.slice(0, at), ...d.lines.map(mikeyAlt), ...original.slice(at)];
    }
    return { ...e, ...ARCHIVE_UNDATED[e.id], original };
  });
}
