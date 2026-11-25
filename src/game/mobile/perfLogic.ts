// PHONE MODE: the pure rules of perf.ts. Unit-tested.

/** How far outside the camera's view a picture must be before it is skipped (world px; shakes and lag stay covered). */
export const CULL_MARGIN = 96;

/**
 * Is a picture at (x, y), no further than `r` from that point in any direction (its diagonal covers any origin and
 * rotation), wholly outside the view rectangle grown by `margin`?
 */
export function offView(x: number, y: number, r: number, vx: number, vy: number, vw: number, vh: number, margin = CULL_MARGIN): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || !(vw > 0) || !(vh > 0)) return false;
  return x + r < vx - margin || x - r > vx + vw + margin || y + r < vy - margin || y - r > vy + vh + margin;
}

/** Rooms where the player is hard to find on a phone: the concept boss's Krelford, a dark room, a crowded screen. */
export const MARKER_DUNGEONS = new Set(["krelford_finale"]);
export const MARKER_CROWD = 220;

/** Show the ring at the player's feet? */
export function wantsMarker(dungeonId: string, objects: number, dark: boolean): boolean {
  return MARKER_DUNGEONS.has(dungeonId) || dark || objects >= MARKER_CROWD;
}

/** Blood pools a fight keeps on the floor on a phone (the oldest beyond this are hidden; the audit's 40). */
export const MAX_POOLS = 40;
export const POOL_KEYS = new Set(["vfx_bloodpool"]);

/** Which of the pools (oldest first) to hide so that at most `max` show. */
export function poolsToHide<T>(oldestFirst: T[], max = MAX_POOLS): T[] {
  return oldestFirst.length > max ? oldestFirst.slice(0, oldestFirst.length - max) : [];
}
