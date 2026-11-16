import type Phaser from "phaser";
import type { TVBeat, TVEpisode } from "../../systems/tv";
import type { Rect, ShowHost, ShowDirector } from "./ShowDirector";
import { SitcomDirector } from "./Sitcom";
import { SoapDirector } from "./Soap";
import { DocumentaryDirector } from "./Documentary";
import { ShoppingDirector } from "./Shopping";
import { EnsembleDirector, type EnsembleGenre } from "./Ensemble";
import { WeddingDirector } from "./Wedding";

/**
 * KrelTV's genre presentations. TVScene asks for a director when an episode starts; an episode gets one if it's
 * listed here (or names a genre as its `style`). Everything else plays on the plain stage.
 */
export type ShowGenre = "sitcom" | "soap" | "documentary" | "shopping" | "wedding" | EnsembleGenre;

export const SHOW_GENRES: Record<string, ShowGenre> = {
  tcc_ep7: "sitcom",
  eastenders_krezz: "soap",
  kronster_doc: "documentary",
  lore_hour: "documentary",
  creation_myth: "documentary",
  shopping: "shopping",
  cabinet_live: "parliament",
  sketch_funeral: "sketch",
  sketch_grocery: "sketch",
  sketch_juror: "sketch",
  sketch_heavy_truth: "sketch",
  sketch_ice_cream: "sketch",
  drama_chomworld: "drama",
  drama_president_han: "drama",
  drama_zero_years: "drama",
  drama_special_parts: "drama",
  drama_dickinson: "drama",
  best_man: "wedding",
};

export function showGenre(e: TVEpisode): ShowGenre | null {
  const s = (e as { style?: string }).style;
  if (s && s !== "pov") return s as ShowGenre;
  return SHOW_GENRES[e.id] ?? null;
}

export function makeShowDirector(sc: Phaser.Scene, r: Rect, e: TVEpisode, host: ShowHost): ShowDirector | null {
  const g = showGenre(e);
  const beats: TVBeat[] = e.beats;
  switch (g) {
    case "sitcom":
      return new SitcomDirector(sc, r, beats, host, e);
    case "soap":
      return new SoapDirector(sc, r, beats, host, e);
    case "documentary":
      return new DocumentaryDirector(sc, r, beats, host, e);
    case "shopping":
      return new ShoppingDirector(sc, r, beats, host, e);
    case "wedding":
      return new WeddingDirector(sc, r, beats, host, e);
    case "parliament":
    case "sketch":
    case "drama":
      return new EnsembleDirector(sc, r, beats, host, e, g);
    default:
      return null;
  }
}

export type { ShowDirector };
