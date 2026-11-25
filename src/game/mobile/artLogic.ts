// PHONE MODE: the pure rules of the phone's texture budget (art.ts does the work). Unit-tested.
//
// The laptop game loads every picture at boot and keeps all of them (about 920 MB once decoded). A phone tab is killed
// well before that. On a phone the big pictures that only one scene or one moment ever shows are "parked": the game
// still has the texture (same key, same size, same frames, so every scene's code runs exactly as it does on a laptop),
// but its pixels are not held; they are fetched back (from the browser's cache) the moment something draws or asks for
// them, and parked again once nothing has used them for a while.

/**
 * The pictures a phone parks: the TV's faces, anchors and cast; the bosses' animation, death and down sheets; the
 * Kreltality and victory sheets, the finisher cinemas and the versus cards; every cutscene still, cut and eye close-up.
 * (Characters, tiles, props, backdrops, effects and the UI stay as they are: they are on screen nearly all the time.)
 */
export const PARKED_ART = /^(?:(?:tvface|tvanchor|tva|tvdrp|tvbody|tvc|bossanim|bossdie|bossdown|bossmove|krelact|krelvic|kc|kca|kcf|kcv|vs)_|[a-z0-9]+_(?:still|cut|eyes)_)/;

/** Can this texture be parked on a phone? */
export function parkable(key: string): boolean {
  return PARKED_ART.test(key);
}

/** A picture's state: parked (no pixels held), loading (fetching them back), live (drawable). */
export type ArtState = "parked" | "loading" | "live";

/** How long a live picture is kept after it was last drawn or asked for, before it may be parked again (ms). */
export const KEEP_MS = 30000;

/** Park this live picture now? Only when nothing has drawn or asked for it for KEEP_MS and no game object holds it. */
export function shouldPark(state: ArtState, lastUsed: number, now: number, held: boolean, keepMs = KEEP_MS): boolean {
  return state === "live" && !held && now - lastUsed >= keepMs;
}

