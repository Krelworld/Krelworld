import type { AnchorDef } from "./Presenter";

/**
 * The cast of the Krelmon GB Krews shows (src/content/television/extra/krews4.ts): PixelLab medium shots in the same
 * 128x128 four-frame rows as the other presenters (rest first, then the gestures; 0 mouth closed, 1 part-open, 2 wide,
 * 3 blink). Speakers who borrow someone else's art (the vox pops, the advocacy spokesperson, two of the industry
 * experts) are mapped per scene with `anchors` in krews4Shows.ts.
 */
export const KREWS4_ANCHORS: Record<string, AnchorDef> = {
  "GORDON RAMSAY": { key: "tvanchor_K4_GORDON", poses: ["rest", "point", "retch"], talks: [true, true, false] },
  "CHEF MICK": { key: "tvanchor_K4_MICK", poses: ["rest", "plead"], talks: [true, true] },
  "CHEF LUCY": { key: "tvanchor_K4_LUCY", poses: ["rest"], talks: [true] },
  "CHEF DAVE": { key: "tvanchor_K4_DAVE", poses: ["rest"], talks: [true] },
  "MILITARY SPOKESPERSON": { key: "tvanchor_K4_MILITARY", poses: ["rest"], talks: [true] },
  "NINTENDO SPOKESPERSON": { key: "tvanchor_K4_NINTENDO", poses: ["rest", "wide"], talks: [true, true] },
  "JUICE BUNNY": { key: "tvanchor_K4_BUNNY", poses: ["rest", "swoon"], talks: [true, false] },
  "CABINET MINISTER 1": { key: "tvanchor_K4_MINISTER_M", poses: ["rest"], talks: [true] },
  "CABINET MINISTER 2": { key: "tvanchor_K4_MINISTER_F", poses: ["rest"], talks: [true] },
  "CABINET MINISTER 3": { key: "tvanchor_K4_MINISTER_Y", poses: ["rest"], talks: [true] },
  "INDUSTRY EXPERT 1": { key: "tvanchor_K4_EXPERT", poses: ["rest"], talks: [true] },
  "KEIR STARMER@THRONE": { key: "tvanchor_K4_STARMER_THRONE", poses: ["rest"], talks: [true] },
};

/** Which gesture suits a line, for this cast (null: not one of ours). */
export function krews4Gesture(name: string, text: string, n: number): string[] | null {
  const t = text.toLowerCase();
  switch (name) {
    case "GORDON RAMSAY":
      if (/actual fuck is this/.test(t)) return ["retch", "rest"];
      if (/^you!|you're telling me|are you mad|step the fuck up|end your|piss and shit|you donkey|back to your seat/.test(t)) return ["point", "rest"];
      if (/what the fuck is this mess|garbage|corpses/.test(t)) return ["rest", "point"];
      return [["rest"], ["point", "rest"], ["rest"]][n % 3];
    case "CHEF MICK":
      if (/try it|one inhale|change your life/.test(t)) return ["plead"];
      return ["rest"];
    case "NINTENDO SPOKESPERSON":
      if (/joining|andrew tate!|pre-order|bugatti|bowser/.test(t)) return ["wide", "rest"];
      return [["rest", "wide"], ["wide", "rest"]][n % 2];
    case "JUICE BUNNY":
      return /affections/.test(t) ? ["rest", "swoon"] : ["rest"];
    case "CHEF LUCY":
    case "CHEF DAVE":
    case "MILITARY SPOKESPERSON":
    case "CABINET MINISTER 1":
    case "CABINET MINISTER 2":
    case "CABINET MINISTER 3":
    case "INDUSTRY EXPERT 1":
      return ["rest"];
  }
  return null;
}
