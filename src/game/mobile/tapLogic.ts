// PHONE MODE: tap a thing to use it (stage 3). The pure part, unit-tested in node: which thing a tap means, and a
// small grid path-finder over a walking scene's colliders. No Phaser, no DOM.
import type { Rect } from "./layout";

export interface Pt {
  x: number;
  y: number;
}

/** Something a tap can mean, in the scene's world coordinates. */
export interface TapCandidate {
  /** The thing itself, roughly (its picture). */
  core: Rect;
  /** Taps on the floor behind it come second: a person or a thing always wins over walking. */
  low?: boolean;
}

/** Grow a rectangle about its middle so it is at least `min` wide and high, and then by `pad` on every side. */
export function grow(r: Rect, min: number, pad = 0): Rect {
  const w = Math.max(r.w, min);
  const h = Math.max(r.h, min);
  const x = r.x + r.w / 2 - w / 2 - pad;
  const y = r.y + r.h / 2 - h / 2 - pad;
  return { x, y, w: w + 2 * pad, h: h + 2 * pad };
}

/** How far a point is from a rectangle (0 inside it). */
export function distToRect(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Which thing a tap at (x, y) means, or -1. Every thing can be tapped within its picture grown to at least `min` (a
 * thumb: 44 CSS px, in world px) plus `pad`. When several can: one whose picture the tap is inside beats one it is only
 * near; among those inside, the smallest picture wins (the book lying on the bed, the laptop on the sofa); among those
 * near, the nearest picture wins. "Low" things only count when nothing else does.
 */
export function pickTarget(list: readonly TapCandidate[], x: number, y: number, min: number, pad = 0): number {
  let best = -1;
  let bestKey: [number, number, number] = [Infinity, Infinity, Infinity];
  list.forEach((c, i) => {
    if (!(c.core.w >= 0 && c.core.h >= 0)) return;
    const area = grow(c.core, min, pad);
    if (!(x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h)) return;
    const d = distToRect(c.core, x, y);
    // (lower is better, compared in order: low last, inside first, then the smaller picture or the nearer one)
    const key: [number, number, number] = [c.low ? 1 : 0, d > 0 ? 1 : 0, d > 0 ? d : c.core.w * c.core.h];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      best = i;
      bestKey = key;
    }
  });
  return best;
}

// ------------------------------------------------------------------ path-finding

/** A walkable grid over the scene (true = blocked), in cells of `cell` world px from (x0, y0). */
export interface Grid {
  x0: number;
  y0: number;
  cell: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

/**
 * The grid for a scene: `bounds` is where the walker's middle may go, `blockers` the colliders, each grown by the
 * walker's half size (`half`) so a free cell means the whole walker fits there.
 */
export function buildGrid(bounds: Rect, blockers: readonly Rect[], half: { w: number; h: number }, cell = 16): Grid {
  const cols = Math.max(1, Math.ceil(bounds.w / cell));
  const rows = Math.max(1, Math.ceil(bounds.h / cell));
  const blocked = new Uint8Array(cols * rows);
  for (const b of blockers) {
    const x1 = b.x - half.w;
    const y1 = b.y - half.h;
    const x2 = b.x + b.w + half.w;
    const y2 = b.y + b.h + half.h;
    // (a cell is blocked when its middle is inside the grown collider)
    const c1 = Math.max(0, Math.ceil((x1 - bounds.x) / cell - 0.5));
    const c2 = Math.min(cols - 1, Math.floor((x2 - bounds.x) / cell - 0.5));
    const r1 = Math.max(0, Math.ceil((y1 - bounds.y) / cell - 0.5));
    const r2 = Math.min(rows - 1, Math.floor((y2 - bounds.y) / cell - 0.5));
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) blocked[r * cols + c] = 1;
  }
  return { x0: bounds.x, y0: bounds.y, cell, cols, rows, blocked };
}

const cellOf = (g: Grid, p: Pt) => ({ c: Math.min(g.cols - 1, Math.max(0, Math.floor((p.x - g.x0) / g.cell))), r: Math.min(g.rows - 1, Math.max(0, Math.floor((p.y - g.y0) / g.cell))) });
const mid = (g: Grid, c: number, r: number): Pt => ({ x: g.x0 + (c + 0.5) * g.cell, y: g.y0 + (r + 0.5) * g.cell });
const free = (g: Grid, c: number, r: number) => c >= 0 && r >= 0 && c < g.cols && r < g.rows && !g.blocked[r * g.cols + c];

/** Is a point on a free cell? */
export function isFree(g: Grid, p: Pt): boolean {
  const { c, r } = cellOf(g, p);
  return free(g, c, r) && p.x >= g.x0 && p.y >= g.y0 && p.x < g.x0 + g.cols * g.cell && p.y < g.y0 + g.rows * g.cell;
}

/** Can the walker go straight from a to b (every cell along the line free)? */
export function lineFree(g: Grid, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d / (g.cell / 3)));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
    const { c, r } = cellOf(g, p);
    if (!free(g, c, r)) return false;
  }
  return true;
}

/** The free cell nearest a point (by rings), as its middle, or null if the grid is all blocked. */
export function nearestFree(g: Grid, p: Pt): Pt | null {
  const { c, r } = cellOf(g, p);
  if (free(g, c, r)) return p;
  const maxR = Math.max(g.cols, g.rows);
  for (let k = 1; k <= maxR; k++) {
    let best: Pt | null = null;
    let bd = Infinity;
    for (let dr = -k; dr <= k; dr++)
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k || !free(g, c + dc, r + dr)) continue;
        const m = mid(g, c + dc, r + dr);
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
    if (best) return best;
  }
  return null;
}

export interface PathResult {
  /** Waypoints after the start, ending at the goal (or as near it as the walker can get). */
  points: Pt[];
  /** The goal itself can be reached (false: the path ends as close as it gets). */
  reached: boolean;
}

/**
 * A route from `from` to `to` around the blocked cells (A*, 8 directions, no corner cutting), pulled straight where
 * the walker can see ahead. A blocked goal is swapped for the nearest free cell; a goal it cannot get to at all gives
 * the route to the reachable cell nearest it (reached = false). A start on a blocked cell (squeezed against a wall)
 * starts from the nearest free one.
 */
export function findPath(g: Grid, from: Pt, to: Pt, maxNodes = 40000): PathResult {
  let goal = to;
  let reached = true;
  if (!isFree(g, goal)) {
    const nf = nearestFree(g, goal);
    if (!nf) return { points: [], reached: false };
    goal = nf;
  }
  const start = isFree(g, from) ? from : nearestFree(g, from) ?? from;
  if (lineFree(g, start, goal)) return { points: start === from ? [goal] : [start, goal], reached };
  const s = cellOf(g, start);
  const t = cellOf(g, goal);
  const N = g.cols * g.rows;
  const gScore = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const fOf = new Float64Array(N);
  const h = (i: number) => {
    const dc = Math.abs((i % g.cols) - t.c);
    const dr = Math.abs(Math.floor(i / g.cols) - t.r);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  };
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fOf[heap[p]] <= fOf[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && fOf[heap[l]] < fOf[heap[m]]) m = l;
        if (r < heap.length && fOf[heap[r]] < fOf[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const si = s.r * g.cols + s.c;
  const ti = t.r * g.cols + t.c;
  gScore[si] = 0;
  fOf[si] = h(si);
  push(si);
  let nearest = si;
  let nearestH = h(si);
  let seen = 0;
  while (heap.length && seen < maxNodes) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    seen++;
    if (cur === ti) {
      nearest = ti;
      break;
    }
    const hc = h(cur);
    if (hc < nearestH) {
      nearestH = hc;
      nearest = cur;
    }
    const cc = cur % g.cols;
    const cr = Math.floor(cur / g.cols);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (!free(g, nc, nr)) continue;
        // (no cutting a corner: both side cells must be free for a diagonal step)
        if (dr && dc && (!free(g, cc + dc, cr) || !free(g, cc, cr + dr))) continue;
        const ni = nr * g.cols + nc;
        if (closed[ni]) continue;
        const ng = gScore[cur] + (dr && dc ? Math.SQRT2 : 1);
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur;
          fOf[ni] = ng + h(ni);
          push(ni);
        }
      }
  }
  if (nearest !== ti) reached = false;
  // the cells back to the start, then pulled straight (skip any waypoint the walker can see past)
  const cells: Pt[] = [];
  for (let i = nearest; i !== -1 && i !== si; i = came[i]) cells.push(mid(g, i % g.cols, Math.floor(i / g.cols)));
  cells.reverse();
  if (reached) cells[cells.length - 1] = goal;
  else if (!cells.length) return { points: [], reached: false };
  const out: Pt[] = [];
  let at = start;
  let k = 0;
  while (k < cells.length) {
    let j = cells.length - 1;
    while (j > k && !lineFree(g, at, cells[j])) j--;
    out.push(cells[j]);
    at = cells[j];
    k = j + 1;
  }
  if (start !== from) out.unshift(start);
  return { points: out, reached };
}

// ------------------------------------------------------------------ walking the route

/**
 * The stick direction that walks from `at` towards the next waypoint, at full speed (the scene's own walking speed;
 * easing off just before the end),
 * and how many waypoints are done. A waypoint counts as passed within `near` px (the last one: within `arrive`).
 */
export function steer(at: Pt, points: readonly Pt[], idx: number, near = 10, arrive = 5): { x: number; y: number; idx: number; done: boolean } {
  let i = idx;
  while (i < points.length) {
    const p = points[i];
    const last = i === points.length - 1;
    if (Math.hypot(p.x - at.x, p.y - at.y) <= (last ? arrive : near)) i++;
    else break;
  }
  if (i >= points.length) return { x: 0, y: 0, idx: i, done: true };
  const p = points[i];
  const dx = p.x - at.x;
  const dy = p.y - at.y;
  const d = Math.hypot(dx, dy) || 1;
  // (easing off over the last few steps, so a slow frame can't carry the walker past the end and back)
  const k = i === points.length - 1 ? Math.min(1, Math.max(0.35, d / 30)) : 1;
  return { x: (dx / d) * k, y: (dy / d) * k, idx: i, done: false };
}
