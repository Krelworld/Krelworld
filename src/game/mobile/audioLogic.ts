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
