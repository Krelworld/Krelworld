import type { AnchorDef } from "./Presenter";

/**
 * The cast of the "news stories" GB Krews shows (src/content/television/extra/krews3.ts): PixelLab medium shots in the
 * same 128x128 four-frame rows as the other presenters (rest first, then the gestures). Keys with an "@" are the same
 * speaker in another place (Starmer on his battle bus rather than at a lectern); a scene picks them with `anchors`.
 */
export const KREWS3_ANCHORS: Record<string, AnchorDef> = {
  "JURGEN KLOPP": { key: "tvanchor_KLOPP", poses: ["rest", "note", "wide", "plead"], talks: [true, true, true, true] },
  "MARK HUGHES": { key: "tvanchor_HUGHES", poses: ["rest", "cash", "point", "stop"], talks: [true, true, true, true] },
  "RISHI SUNAK": { key: "tvanchor_SUNAK", poses: ["rest", "palms", "point"], talks: [true, true, true] },
  "RISHI SUNAK@HOME": { key: "tvanchor_SUNAK_HOME", poses: ["rest"], talks: [true] },
  "KEIR STARMER": { key: "tvanchor_STARMER", poses: ["rest", "chest", "point", "waft"], talks: [true, true, true, false] },
  "KEIR STARMER@BUS": { key: "tvanchor_STARMER_BUS", poses: ["rest"], talks: [true] },
  "ANGELA RAYNER": { key: "tvanchor_RAYNER", poses: ["rest", "laugh", "palm"], talks: [true, true, true] },
  "BREAKFAST HOST": { key: "tvanchor_BREAKFAST_HOST", poses: ["rest", "laugh"], talks: [true, false] },
  EXECUTIVE: { key: "tvanchor_EXECUTIVE", poses: ["rest", "wide", "ear", "point"], talks: [true, true, true, true] },
  WOMAN: { key: "tvanchor_VOX_WOMAN", poses: ["rest", "fan"], talks: [true, true] },
  "VOTER 1": { key: "tvanchor_VOX_MAN", poses: ["rest", "point"], talks: [true, true] },
  "MARGARET THOMPSON": { key: "tvanchor_MARGARET", poses: ["rest", "clutch"], talks: [true, true] },
  "DR ELAINE ROBERTS": { key: "tvanchor_ELAINE", poses: ["rest", "palm"], talks: [true, true] },
  // #ArsebrushGate: Starmer at the lectern with the giant toothbrush, the people flanking him, the opposition
  "KEIR STARMER@BRUSH": { key: "tvanchor_STARMER_BRUSH", poses: ["rest", "brush"], talks: [true, true] },
  "CHRIS WHITTY": { key: "tvanchor_WHITTY", poses: ["rest", "palm"], talks: [true, true] },
  "DR ALANA MERRICK": { key: "tvanchor_MERRICK", poses: ["rest", "palm"], talks: [true, true] },
  "KEMI BADENOCH": { key: "tvanchor_BADENOCH", poses: ["rest", "palm"], talks: [true, true] },
  "DAISY COOPER": { key: "tvanchor_COOPER", poses: ["rest", "palm"], talks: [true, true] },
  // Burnham's first act: the face rows (gravy, smear) and "chew" (a mouth-full line chews instead of lip-syncing) talk;
  // the gross-out poses are stills the show sets itself (tvnews/burnhamShow.ts)
  "ANDY BURNHAM": {
    key: "tvanchor_BURNHAM",
    poses: ["rest", "raised", "fist", "gravy", "smear", "chew", "shovel", "burp", "throat", "retch", "bowl", "wince", "strain", "wave"],
    talks: [true, true, true, true, true, true, false, false, false, false, false, false, false, false],
  },
};

/** Which gesture suits a line, for this cast (null: not one of ours). */
export function krews3Gesture(name: string, text: string, n: number): string[] | null {
  const t = text.toLowerCase();
  switch (name) {
    case "JURGEN KLOPP":
      if (/twenty|for you|special note/.test(t)) return ["note"];
      if (/penalty\?|for what|nobody|shoelace/.test(t)) return ["wide", "rest"];
      if (/^no|mistake|integrity|put it away/.test(t)) return ["plead", "rest"];
      return [["rest", "wide"], ["plead"]][n % 2];
    case "MARK HUGHES":
      if (/^penalty/.test(t)) return ["point"];
      if (/get that away|insult|referee/.test(t)) return ["stop", "rest"];
      if (/grand|crumpled|keeping your twenty|here\./.test(t)) return ["cash"];
      if (/fifty/.test(t)) return ["point", "rest"];
      return ["rest"];
    case "RISHI SUNAK":
      if (/bomb|all of|every single/.test(t)) return ["palms", "point"];
      if (/safety|imperative|necessary/.test(t)) return ["point", "rest"];
      if (/thank you|lovely/.test(t)) return ["palms"];
      return [["rest", "palms"], ["point", "rest"], ["rest"]][n % 3];
    case "KEIR STARMER":
      if (/smell|phwoar/.test(t)) return ["waft"];
      if (/brush|breakthrough/.test(t)) return ["brush"];
      if (/sorry|hurt|trust|ill-judged/.test(t)) return ["chest", "rest"];
      if (/change is coming|prime minister|one thing/.test(t)) return ["point", "rest"];
      return ["rest"];
    case "ANGELA RAYNER":
      if (/passionate|worse|crazy/.test(t)) return ["laugh", "palm"];
      return [["palm", "rest"], ["rest", "palm"]][n % 2];
    case "BREAKFAST HOST":
      if (/angela!|quote/.test(t)) return ["laugh", "rest"];
      return ["rest"];
    case "EXECUTIVE":
      if (/can't hear/.test(t)) return ["ear"];
      if (/thank you|ladies|introducing|crash mode/.test(t)) return ["wide", "rest"];
      if (/great question|if anyone/.test(t)) return ["point", "rest"];
      return [["point", "rest"], ["wide", "rest"], ["rest", "point"]][n % 3];
    case "WOMAN":
      return ["fan", "rest"];
    case "VOTER 1":
      return ["point", "rest"];
    case "MARGARET THOMPSON":
      return ["clutch", "rest"];
    case "DR ELAINE ROBERTS":
      return [["palm", "rest"], ["rest", "palm"]][n % 2];
    case "CHRIS WHITTY":
      return ["rest"];
    case "DR ALANA MERRICK":
    case "DAISY COOPER":
      return ["palm", "rest"];
    case "KEMI BADENOCH":
      return /apology/.test(t) ? ["rest", "palm"] : ["palm", "rest"];
    case "ANDY BURNHAM":
      if (/ladies and gentlemen/.test(t)) return ["raised", "rest", "raised"];
      if (/law states|constitution/.test(t)) return ["fist", "rest", "fist"];
      if (/prove that the north/.test(t)) return ["rest", "raised"];
      return ["rest"];
  }
  return null;
}
