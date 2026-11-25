// Walkability grid and A* for people who are not the player.
import { BOUNDS, VENUE, WALLS } from "./layout";

const CELL = 1;
export const GW = Math.ceil(BOUNDS.w / CELL), GH = Math.ceil(BOUNDS.h / CELL);
let grid: Uint8Array | null = null;
let gridFor = "";

/** 1 = blocked. Gates count as open: the people using paths are allowed through, or they wait. */
export function navGrid(): Uint8Array {
  if (grid && gridFor === VENUE.id) return grid;
  gridFor = VENUE.id;
  grid = new Uint8Array(GW * GH);
  const pad = 0.45;
  for (const w of WALLS) {
    if (w.gate) continue;
    const x0 = Math.floor((w.x - pad - BOUNDS.x) / CELL), x1 = Math.ceil((w.x + w.w + pad - BOUNDS.x) / CELL);
    const y0 = Math.floor((w.y - pad - BOUNDS.y) / CELL), y1 = Math.ceil((w.y + w.h + pad - BOUNDS.y) / CELL);
    for (let gy = Math.max(0, y0); gy < Math.min(GH, y1); gy++) for (let gx = Math.max(0, x0); gx < Math.min(GW, x1); gx++) {
      // Only block a cell if its centre is really inside the padded wall.
      const cx = BOUNDS.x + (gx + 0.5) * CELL, cy = BOUNDS.y + (gy + 0.5) * CELL;
      if (cx > w.x - pad && cx < w.x + w.w + pad && cy > w.y - pad && cy < w.y + w.h + pad) grid[gy * GW + gx] = 1;
    }
  }
  return grid;
}

const toCell = (x: number, y: number) => {
  const gx = Math.max(0, Math.min(GW - 1, Math.floor((x - BOUNDS.x) / CELL)));
  const gy = Math.max(0, Math.min(GH - 1, Math.floor((y - BOUNDS.y) / CELL)));
  return gy * GW + gx;
};
const cx = (c: number) => BOUNDS.x + ((c % GW) + 0.5) * CELL;
const cy = (c: number) => BOUNDS.y + (Math.floor(c / GW) + 0.5) * CELL;

function nearestOpen(g: Uint8Array, c: number): number {
  if (!g[c]) return c;
  const x0 = c % GW, y0 = Math.floor(c / GW);
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (x >= 0 && y >= 0 && x < GW && y < GH && !g[y * GW + x]) return y * GW + x;
  }
  return c;
}

// Reused buffers.
const gScore = new Float32Array(GW * GH);
const came = new Int32Array(GW * GH);
const stamp = new Uint32Array(GW * GH);
const closed = new Uint32Array(GW * GH);
let gen = 0;
const heap: number[] = [], heapF: number[] = [];

function push(c: number, f: number) {
  heap.push(c); heapF.push(f);
  let i = heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] <= heapF[i]) break;
    [heap[p], heap[i]] = [heap[i], heap[p]]; [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
    i = p;
  }
}
function pop(): number {
  const top = heap[0], lastC = heap.pop()!, lastF = heapF.pop()!;
  if (heap.length) {
    heap[0] = lastC; heapF[0] = lastF;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < heap.length && heapF[l] < heapF[m]) m = l;
      if (r < heap.length && heapF[r] < heapF[m]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]]; [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
      i = m;
    }
  }
  return top;
}

/** A list of waypoints [x0, y0, x1, y1, ...] from a to b, smoothed. Empty if unreachable. */
export function findPath(ax: number, ay: number, bx: number, by: number): number[] {
  const g = navGrid();
  const start = nearestOpen(g, toCell(ax, ay)), goal = nearestOpen(g, toCell(bx, by));
  gen++;
  heap.length = 0; heapF.length = 0;
  const h = (c: number) => Math.hypot(cx(c) - cx(goal), cy(c) - cy(goal));
  stamp[start] = gen; gScore[start] = 0; came[start] = -1;
  push(start, h(start));
  let found = false, iter = 0;
  while (heap.length && iter++ < 120000) {
    const c = pop();
    if (closed[c] === gen) continue;
    closed[c] = gen;
    if (c === goal) { found = true; break; }
    const x = c % GW, y = Math.floor(c / GW), gc = gScore[c];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const n = ny * GW + nx;
      if (g[n] || closed[n] === gen) continue;
      if (dx && dy && (g[y * GW + nx] || g[ny * GW + x])) continue; // no corner cutting
      const ng = gc + (dx && dy ? 1.414 : 1);
      if (stamp[n] === gen && gScore[n] <= ng) continue;
      stamp[n] = gen; gScore[n] = ng; came[n] = c;
      push(n, ng + h(n));
    }
  }
  if (!found) return [];
  const cells: number[] = [];
  for (let c = goal; c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  // Keep only the corners that matter.
  const out: number[] = [];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!clearLine(g, cells[anchor], cells[i])) { anchor = i - 1; out.push(cx(cells[anchor]), cy(cells[anchor])); }
  }
  out.push(bx, by);
  return out;
}

function clearLine(g: Uint8Array, a: number, b: number): boolean {
  const x0 = cx(a), y0 = cy(a), x1 = cx(b), y1 = cy(b);
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const c = toCell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    if (g[c]) return false;
    // Check the width of a person too.
    const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    if (g[toCell(px + 0.4, py)] || g[toCell(px - 0.4, py)] || g[toCell(px, py + 0.4)] || g[toCell(px, py - 0.4)]) return false;
  }
  return true;
}

/** Can someone at a see b? Walls taller than a person's eyes block it. */
export function lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
  const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (const w of WALLS) {
      if (w.h3 < 1.7) continue;
      if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return false;
    }
  }
  return true;
}
