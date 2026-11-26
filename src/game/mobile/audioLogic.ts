// PHONE MODE: the pure rules of the phone's sound (audio.ts does the work). Unit-tested.

/** What a `new Audio(url)` from the game is for: the voices' slowed / sped-up lines are blob: URLs; the rest is music. */
export function audioKind(url: string | undefined): "voice" | "music" {
  return typeof url === "string" && url.startsWith("blob:") ? "voice" : "music";
}

/** iPhone's audio session type: "playback" (the game's sound plays with the ringer switch off, and stops the player's
 *  own music) unless the player chose "Play over my music" ("ambient": mixes with it, follows the ringer switch). */
export function sessionType(playOverMyMusic: boolean): "playback" | "ambient" {
  return playOverMyMusic ? "ambient" : "playback";
}

/** How a pooled element's volume is applied: through its gain node (iPhone ignores an element's own volume), or, if
 *  the route through Web Audio turned out silent, on the element itself with "muted" at zero (the only thing an iPhone
 *  obeys there). */
export function volumePlan(v: number, routed: boolean): { gain: number; elementVolume: number; muted: boolean } {
  const x = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  return routed ? { gain: x, elementVolume: 1, muted: false } : { gain: 1, elementVolume: x, muted: x <= 0.001 };
}

/** The route self-test: a music element has played this long (s) at an audible volume and every reading was silent. */
export const SILENT_AFTER_S = 5;

/** Is the route through Web Audio silent? (readings: peak sample levels while the element played audibly) */
export function routeSilent(readings: number[], playedS: number): boolean {
  return playedS >= SILENT_AFTER_S && readings.length >= 3 && readings.every((r) => r < 1e-4);
}

/** The song elements the first tap unlocks (fix round R5: 4, so four songs asked for inside one 350 ms fade-out still
 *  all get an unlocked element), and the voice elements. */
export const MUSIC_POOL = 4;
export const VOICE_POOL = 2;
/** Most elements of one kind kept for reuse (the pool plus spares that have played, so are unlocked too). */
export const KEEP_PER_KIND = 6;

/** What the pool knows about one element, for the choice below. */
export interface PoolSlot {
  kind: "music" | "voice";
  busy: boolean;
  /** Started by the first tap. */
  pooled: boolean;
  /** Has played (a spare that played is unlocked on an iPhone, like a pooled one). */
  played: boolean;
  /** Goes through a Web Audio gain node. */
  routed: boolean;
}

/**
 * Which element a `new Audio()` gets: a free one of its kind that can play without a tap (pooled, or a spare that has
 * played), pooled first; once the route proved silent (routeOk false), only one that is not routed (songs and voices
 * alike: R7). -1: make a new one.
 */
export function pickSlot(items: readonly PoolSlot[], kind: "music" | "voice", routeOk: boolean): number {
  let best = -1;
  for (let i = 0; i < items.length; i++) {
    const x = items[i];
    if (x.kind !== kind || x.busy || !(x.pooled || x.played) || (!routeOk && x.routed)) continue;
    if (best < 0 || (x.pooled && !items[best].pooled)) best = i;
  }
  return best;
}

/**
 * Which spares to let go (indexes): free spares that never played (a tap never unlocked them), and free spares beyond
 * KEEP_PER_KIND of their kind. Never a pooled one, never a busy one.
 */
export function sparesToDrop(items: readonly PoolSlot[]): number[] {
  const out: number[] = [];
  const count: Record<string, number> = { music: 0, voice: 0 };
  items.forEach((x, i) => {
    if (x.pooled || x.busy) {
      count[x.kind]++;
      return;
    }
    if (!x.played || count[x.kind] >= KEEP_PER_KIND) out.push(i);
    else count[x.kind]++;
  });
  return out;
}

/** After an element stops being the current song (Synth fades it out over 350 ms), it is not a stray for this long. */
export const RETIRE_MS = 1200;

/**
 * Is a playing song element a stray second song (to stop)? Not the current song, not fading, not emptied (Synth's
 * stop sets src ""), and neither the current song in the last RETIRE_MS (its fade-out can outlive the fading set when a
 * fade-in on the same element ends first: R8) nor handed out in the last RETIRE_MS (a song asked for and replaced
 * between two checks).
 */
export function isStray(o: { current: boolean; fading: boolean; src: string; now: number; lastCurrentAt: number; takenAt: number }): boolean {
  if (o.current || o.fading || !o.src || o.src.startsWith("data:")) return false;
  return o.now - o.lastCurrentAt >= RETIRE_MS && o.now - o.takenAt >= RETIRE_MS;
}
