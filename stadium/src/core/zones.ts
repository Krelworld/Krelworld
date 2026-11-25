import type { Level, Zone } from "./types";

/** The most specific zone at a point: later zones in the list sit on top of earlier ones. */
export function zoneAt(level: Level, x: number, y: number): Zone | null {
  for (let i = level.zones.length - 1; i >= 0; i--) {
    const z = level.zones[i];
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z;
  }
  return null;
}
