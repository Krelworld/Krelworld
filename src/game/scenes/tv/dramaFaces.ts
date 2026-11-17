import { FACE_META } from "./faceMeta";

/**
 * Close-up sheets for the BBK One dramas (Gumption and Gravy, Mole of Thrones, The Sopranos): public/art/tv/face_GG_*,
 * face_MT_* and face_SOP_*, built the same way as the others (see faceMeta.ts). Kept here so the shared table needn't change.
 * Frames: 0 neutral, 1 talk, 2 alarm, 3 blink, 4 gesture, 5 laugh, 6 special; 8-14 mouth shapes; 16+ gestures.
 */
export const DRAMA_FACES: Record<string, { base: number; lip: boolean; gest: [number, number][] }> = {
  GG_SALLY: { base: 7, lip: true, gest: [[16, 8]] },
  GG_SALLY_GUN: { base: 1, lip: false, gest: [] },
  GG_EDEN: { base: 7, lip: true, gest: [[16, 8]] },
  GG_OFFICER_1: { base: 7, lip: false, gest: [[16, 8]] },
  GG_OFFICER_2: { base: 7, lip: false, gest: [[16, 8]] },
  MT_FLENKY: { base: 7, lip: true, gest: [[16, 8]] },
  MT_FLENKY_MOLE: { base: 7, lip: true, gest: [[16, 8]] },
  MT_FLENKY_BANDAGE: { base: 7, lip: true, gest: [[16, 8]] },
  MT_RUTH: { base: 7, lip: true, gest: [[16, 8]] },
  MT_MARTIN: { base: 7, lip: true, gest: [[16, 8]] },
  MT_DOCTOR: { base: 7, lip: false, gest: [] },
  MT_NURSE: { base: 7, lip: false, gest: [] },
  MT_DIRECTOR: { base: 7, lip: true, gest: [[16, 8]] },
  MT_MUM: { base: 7, lip: false, gest: [[16, 8]] },
  // The Sopranos: no gesture animations; Carmela's frame 7 is her face after the chicken piccata
  SOP_TONY: { base: 7, lip: true, gest: [] },
  SOP_CARMELA: { base: 7, lip: true, gest: [] },
};

let done = false;
/** Register the drama sheets with the shared table (once). */
export function registerDramaFaces() {
  if (done) return;
  done = true;
  for (const [k, v] of Object.entries(DRAMA_FACES)) if (!FACE_META[k]) FACE_META[k] = v;
}
