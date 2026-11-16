import type { AnchorDef } from "./Presenter";

/**
 * Guests on the first GB Krews shows (src/content/television/extra/krews.ts and krews2.ts, and the Krelford News at
 * Six in channels.ts), redrawn from their old 64px stage sprites as PixelLab medium shots in the same 128x128
 * four-frame rows as the other presenters (rest first, then the gesture; 0 mouth closed, 1 part-open, 2 wide,
 * 3 blink). The shows themselves are in krews1Shows.ts.
 */
export const KREWS1_ANCHORS: Record<string, AnchorDef> = {
  "ESTATE SPOKESPERSON": { key: "tvanchor_K1_ESTATE", poses: ["rest", "palm"], talks: [true, true] },
  CHANCELLOR: { key: "tvanchor_K1_CHANCELLOR", poses: ["rest", "point"], talks: [true, true] },
  "DR. JAMESON": { key: "tvanchor_K1_JAMESON", poses: ["rest", "fists"], talks: [true, true] },
  "JEREMY CORBYN": { key: "tvanchor_K1_CORBYN", poses: ["rest", "palm"], talks: [true, true] },
  "COOKIE MONSTER": { key: "tvanchor_K1_COOKIE", poses: ["rest", "cookie"], talks: [true, true] },
  "JUDGE KRELMOR": { key: "tvanchor_K1_KRELMOR", poses: ["rest", "bag"], talks: [true, true] },
  "BARRY SNODGRASS": { key: "tvanchor_K1_SNODGRASS", poses: ["rest", "palm"], talks: [true, true] },
};

/** Which gesture suits a line, for this cast (null: not one of ours). */
export function krews1Gesture(name: string, text: string, n: number): string[] | null {
  const t = text.toLowerCase();
  switch (name) {
    case "ESTATE SPOKESPERSON":
      if (/legal action|carried out|bitcoin alone/.test(t)) return ["palm", "rest"];
      return ["rest"];
    case "CHANCELLOR":
      if (/you stop|shut up|again and again|go ahead/.test(t)) return ["rest", "point"];
      return ["rest"];
    case "DR. JAMESON":
      return /fantastic|excited|explosion/.test(t) ? ["fists", "rest"] : ["rest"];
    case "JEREMY CORBYN":
      return [["rest", "palm"], ["palm", "rest"]][n % 2];
    case "COOKIE MONSTER":
      if (/cookie|sorry|tough times/.test(t)) return ["cookie", "rest"];
      return ["rest"];
    case "JUDGE KRELMOR":
      return /no comment/.test(t) ? ["bag"] : ["rest"];
    case "BARRY SNODGRASS":
      return /hallucination|didn't actually exist/.test(t) ? ["rest", "palm"] : ["rest"];
  }
  return null;
}
