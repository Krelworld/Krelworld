import type { NewsCfg } from "../TVNews";
import type { AnchorDef } from "./Presenter";

/**
 * Gordon Ramsey's "Food History Moment" on Krunche News (KREWS_RAMSEY_TURKEY in src/content/television/extra/krews3.ts).
 * The documentary is fictional (no broadcaster's logo on the art): its cosy TV-kitchen set with the roast turkey on
 * the island, Ramsey (the game's GORDON RAMSAY art) and Dr Leigh Bramwell (fictional) in a field scene with the
 * documentary's own look (`rmDoc`), and PixelLab close-up inserts (public/art/tv/action/rm_*.png, tva_rm_* sheets):
 *
 * - a stage direction that matches `rmCues` cuts to its insert and holds it for a moment;
 * - an [INSERT <id> <n>] beat cuts to the insert and holds it over the next n lines (the newsreader talks over it).
 *
 * NewsDirector draws them (the "Food History Moment" block in TVNews.ts).
 */

export interface RmInsert {
  /** the action clip (tva_<clip>) */
  clip: string;
  fps: number;
  /** frames in order; the last one holds (or the list loops) */
  frames?: number[];
  loop?: boolean;
  /** what the documentary's caption says over it */
  caption: string;
  /** how the clip fills the picture: "wide" clips are 3:2 stills, "face" clips are medium shots (keep the head in) */
  frame: "wide" | "face";
  sfx?: { id: string; at: number }[];
}

export interface RmScene {
  /** the documentary's on-screen tag (a field scene drawn as the documentary's own footage) */
  rmDoc?: string;
  rmInserts?: Record<string, RmInsert>;
  /** stage directions that cut to an insert, and how long to hold it (ms) */
  rmCues?: { match: RegExp; insert: string; hold: number }[];
}

export const RAMSEY_ANCHORS: Record<string, AnchorDef> = {
  "DR LEIGH BRAMWELL": { key: "tvanchor_RM_BRAMWELL", poses: ["rest", "stunned"], talks: [true, false] },
};

export function ramseyGesture(name: string, text: string): string[] | null {
  if (name !== "DR LEIGH BRAMWELL") return null;
  return /sorry\?/i.test(text) ? ["stunned"] : ["rest"];
}

const STUDIO = { match: /NEWSDESK/, kind: "desk" as const, set: "tv_gbk_studio" };
const GORDON = { key: "tvanchor_K4_GORDON", frame: 0, crop: [24, 0, 80, 70] as [number, number, number, number] };
const TURKEY = { key: "tv_rm_kitchen", crop: [120, 100, 90, 60] as [number, number, number, number] };

export const RAMSEY_NEWS: Record<string, NewsCfg> = {
  krews_ramsey_turkey: {
    brand: "gbk",
    ticker: [
      "Ramsey: cooking 'very erotic'",
      "Turkey 'biologically inaccurate', experts confirm",
      "Viewers report 'unnervingly intense eye contact'",
      "Food History Moment Episode 3 'under review'",
      "Christmas turkey sales 'down sharply'",
    ],
    scenes: [
      STUDIO,
      {
        match: /FOOD HISTORY MOMENT KITCHEN/,
        kind: "field",
        set: "tv_rm_kitchen",
        cast: [["GORDON RAMSAY", 0.22], ["DR LEIGH BRAMWELL", 0.8]],
        rmDoc: "FOOD HISTORY MOMENT · EP. 2",
        rmCues: [{ match: /fingers along the skin/i, insert: "fingers", hold: 2600 }],
        rmInserts: {
          fingers: { clip: "rm_fingers", fps: 7, frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6], caption: "FOOD HISTORY MOMENT · CLIP", frame: "wide" },
          knife: {
            clip: "rm_knife",
            fps: 8,
            frames: [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            caption: "FOOD HISTORY MOMENT · CLIP",
            frame: "wide",
            sfx: [
              { id: "swing", at: 300 },
              { id: "sq_squelch", at: 480 },
            ],
          },
          slice: { clip: "rm_slice", fps: 6, frames: [0, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 7, 8, 1, 0], loop: true, caption: "FOOD HISTORY MOMENT · CLIP", frame: "face" },
          stunned: { clip: "rm_stunned", fps: 5, frames: [0, 1, 2, 1, 0, 1, 2, 2, 1], loop: true, caption: "FOOD HISTORY MOMENT · DR LEIGH BRAMWELL", frame: "face" },
        },
      },
      {
        match: /TRENDING/,
        kind: "graphic",
        set: "",
        gfx: {
          type: "trend",
          title: "VIEWER REACTION",
          tags: [
            { tag: "#FoodHistoryMoment", n: 2870000 },
            { tag: "#TurkeyGate", n: 1910000 },
            { tag: "#VaginaOfTheTurkey", n: 1240000 },
            { tag: "#JusticeForTheTurkey", n: 655000 },
          ],
          posts: [
            "'for no clear culinary reason' is going on my gravestone",
            "the eye contact. THE EYE CONTACT",
            "Dr Bramwell deserves a medal and a lie down",
            "cancelled my Christmas turkey order",
            "my nan was watching",
          ],
        },
      },
    ],
    ots: [
      { match: /Celebrity chef|scrutiny/i, pic: GORDON, caption: "Food History Moment" },
      { match: /historical dishes|series/i, pic: TURKEY, caption: "Food History Moment" },
      { match: /Episode 2|backlash/i, pic: GORDON, caption: "'Desire and Power'" },
      { match: /turkey|Channel 4/i, pic: TURKEY, caption: "The turkey" },
    ],
    straps: {
      "GORDON RAMSAY": ["Gordon Ramsey", "Food History Moment"],
      "DR LEIGH BRAMWELL": ["Dr. Leigh Bramwell", "Feminist food theorist"],
    },
  },
};
