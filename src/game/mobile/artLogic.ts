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


/**
 * Pictures that go together (fix round R3): a boss's sheets are one family. While its fighting sheet is drawn or held,
 * its death, down and move sheets and its finisher close-up (kcv_) stay loaded too, so the kneel at the kill and a
 * stagger mid-fight never show a blank frame while their sheet is fetched. They are parked again with the room.
 */
const BOSS_SHEETS = ["bossanim", "bossdie", "bossdown", "bossmove"] as const;

export function family(key: string): string[] {
  const m = /^(bossanim|bossdie|bossdown|bossmove)_(.+)$/.exec(key);
  if (!m) return [];
  const id = m[2];
  const out: string[] = BOSS_SHEETS.filter((p) => p !== m[1]).map((p) => `${p}_${id}`);
  out.push(`kcv_${id}`);
  return out;
}

/**
 * After a failed fetch, when to try again (fix round R2): 2 s, 4 s, 8 s ... up to 30 s, never on every frame (a picture
 * on screen used to ask again on every draw, one failed request per frame, for as long as the signal was gone).
 */
export function retryDelay(fails: number): number {
  if (fails <= 0) return 0;
  return Math.min(30000, 2000 * 2 ** (fails - 1));
}

/** The overlay scenes that wait (up to HOLD_MAX_MS) for their parked pictures before they start (R4). */
export const HOLD_SCENES: readonly string[] = ["VsSplash", "KrelCine"];
export const HOLD_MAX_MS = 1200;

/**
 * The phone's offline copy of the parked pictures (R2): one CacheStorage cache per set of art. The name carries a hash
 * of the art manifest, so new art never comes from an old copy; older copies are deleted.
 */
export function offlineCacheName(manifestText: string): string {
  let h = 2166136261;
  for (let i = 0; i < manifestText.length; i++) {
    h ^= manifestText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `krel-art-${(h >>> 0).toString(36)}`;
}
