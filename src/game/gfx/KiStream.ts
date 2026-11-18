import Phaser from "phaser";

/**
 * Flowing spirit-energy streams (anime ki / spirit-wave): wobbling, rippling ribbons with a glowing core, pulses
 * running along them, and glowing orbs and sparkles flicking off. Drawn into a Graphics each frame (cheap: a few
 * polygons and circles), so they can bend, merge and follow whatever they're aimed at. Not a laser, not a liquid.
 */

export interface Pt {
  x: number;
  y: number;
}

/** A curve through the scene: u in [0, 1]. */
export type Path = (u: number) => Pt;

/** A cubic bezier. */
export const bezier =
  (p0: Pt, c1: Pt, c2: Pt, p3: Pt): Path =>
  (u) => {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const d = u * u * u;
    return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, y: a * p0.y + b * c1.y + c * c2.y + d * p3.y };
  };

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const frac = (x: number) => x - Math.floor(x);

/** A colour mixed towards white by `f` (0: as is, 1: white). */
export function lighten(c: number, f: number) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const m = (v: number) => Math.round(v + (255 - v) * f);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

export interface FlowStyle {
  /** The body's half-width, px. */
  width: number;
  glow: number;
  mid: number;
  core?: number;
  /** Overall opacity. */
  alpha?: number;
  /** How many pulses run along it at once. */
  pulses?: number;
  /** Pulse speed (lengths per second). */
  speed?: number;
  /** Thin translucent ribbons twisting round it. */
  ribbons?: number;
  /** How much the centre line snakes about (x width). */
  wobble?: number;
  seed?: number;
  /** Narrow at the start (0) or full width (1). */
  startW?: number;
  /** Calm (photosensitivity): no fast flicker. */
  calm?: boolean;
}

/** The unit normal of `path` at u. */
function normal(path: Path, u: number) {
  const a = path(Math.max(0, u - 0.01));
  const b = path(Math.min(1, u + 0.01));
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { nx: -(b.y - a.y) / l, ny: (b.x - a.x) / l };
}

/**
 * The left and right edges of a flowing ribbon along `path` from u0 to u1 at time `t` (seconds), `scale` x the
 * style's width, its centre pushed sideways by `shift` (x width). Pure (for tests).
 */
export function flowEdges(path: Path, t: number, s: FlowStyle, u0: number, u1: number, n: number, scale: number, shift = 0, seedOff = 0) {
  const L: Pt[] = [];
  const R: Pt[] = [];
  const seed = (s.seed ?? 0) + seedOff;
  const pulses = s.pulses ?? 2;
  const speed = s.speed ?? 0.9;
  const wob = s.wobble ?? 0.3;
  const k = s.calm ? 0.5 : 1;
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const p = path(u);
    const { nx, ny } = normal(path, u);
    // the rippling width: two travelling waves plus the pulses surging along it
    let w = 1 + 0.22 * Math.sin(u * 13 - t * 11 * k + seed) + 0.13 * Math.sin(u * 31 + t * 7 * k + seed * 2);
    for (let j = 0; j < pulses; j++) {
      const at = frac(t * speed + j / pulses + seed * 0.13);
      const d = (u - at) / 0.06;
      w += 0.75 * Math.exp(-d * d);
    }
    // the tip and the start taper
    w *= (s.startW ?? 0.45) + (1 - (s.startW ?? 0.45)) * smooth(0, 0.12, u);
    w *= 0.35 + 0.65 * smooth(u1, u1 - 0.06, u);
    const half = s.width * scale * Math.max(0.15, w);
    // the centre line snakes about a little (more out at the edges of the glow)
    const off = (Math.sin(u * 9 - t * 7 * k + seed) * wob + shift) * s.width;
    const cx = p.x + nx * off;
    const cy = p.y + ny * off;
    L.push({ x: cx + nx * half, y: cy + ny * half });
    R.push({ x: cx - nx * half, y: cy - ny * half });
  }
  return { L, R };
}

function fillEdges(g: Phaser.GameObjects.Graphics, e: { L: Pt[]; R: Pt[] }, col: number, a: number) {
  if (a <= 0.01 || e.L.length < 2) return;
  g.fillStyle(col, a);
  g.fillPoints([...e.L, ...e.R.reverse()], true);
}

/** Draw one flowing stream from u0 to u1 of `path`: glow, body, ribbons, core. */
export function drawFlow(g: Phaser.GameObjects.Graphics, path: Path, t: number, s: FlowStyle, u0 = 0, u1 = 1, n = 20) {
  if (u1 - u0 < 0.01) return;
  const a = s.alpha ?? 1;
  fillEdges(g, flowEdges(path, t, s, u0, u1, n, 2.3, 0, 1.7), s.glow, 0.16 * a);
  fillEdges(g, flowEdges(path, t, s, u0, u1, n, 1.35, 0, 0.6), s.glow, 0.28 * a);
  fillEdges(g, flowEdges(path, t, s, u0, u1, n, 0.9), s.mid, 0.55 * a);
  const k = s.calm ? 0.5 : 1;
  for (let r = 0; r < (s.ribbons ?? 0); r++) {
    // a thin translucent ribbon twisting round the body
    const ph = (r * Math.PI * 2) / (s.ribbons ?? 1);
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const p = path(u);
      const { nx, ny } = normal(path, u);
      const tw = Math.sin(u * 14 - t * 10 * k + ph) * s.width * 1.05;
      const half = s.width * (0.1 + 0.08 * Math.cos(u * 14 - t * 10 * k + ph)) * smooth(u0, u0 + 0.08, u) * smooth(u1, u1 - 0.08, u);
      L.push({ x: p.x + nx * (tw + half), y: p.y + ny * (tw + half) });
      R.push({ x: p.x + nx * (tw - half), y: p.y + ny * (tw - half) });
    }
    fillEdges(g, { L, R }, 0xffffff, 0.32 * a);
  }
  fillEdges(g, flowEdges(path, t, s, u0, u1, n, 0.38, 0, 0.3), s.core ?? 0xffffff, 0.92 * a);
}

/** Glowing orbs and sparkles flicking off the energy; they drift, slow and fade (never stick to anything). */
export class Motes {
  private ps: { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: number; star: boolean }[] = [];
  constructor(private cap = 140) {}

  add(x: number, y: number, vx: number, vy: number, o: { r?: number; col?: number; life?: number; star?: boolean } = {}) {
    if (this.ps.length >= this.cap) this.ps.shift();
    const life = o.life ?? 0.6;
    this.ps.push({ x, y, vx, vy, life, max: life, r: o.r ?? 2.5, col: o.col ?? 0xfff3c4, star: !!o.star });
  }

  /** A burst of them out of a point, spread round `dir` (radians) by `spread`. */
  burst(x: number, y: number, n: number, o: { dir?: number; spread?: number; speed?: number; col?: number[]; life?: number; r?: number } = {}) {
    const cols = o.col ?? [0xffffff, 0xfff3c4, 0xffe39a];
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? 0) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const v = (o.speed ?? 160) * (0.4 + Math.random() * 0.8);
      this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, { col: cols[i % cols.length], life: (o.life ?? 0.55) * (0.6 + Math.random() * 0.7), r: (o.r ?? 2.6) * (0.6 + Math.random() * 0.9), star: Math.random() < 0.35 });
    }
  }

  get count() {
    return this.ps.length;
  }

  update(dt: number) {
    for (const p of this.ps) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // they float (energy, not liquid): slow down and drift up a touch
      p.vx *= 1 - 2.4 * dt;
      p.vy = p.vy * (1 - 2.4 * dt) - 12 * dt;
    }
    this.ps = this.ps.filter((p) => p.life > 0);
  }

  draw(g: Phaser.GameObjects.Graphics) {
    for (const p of this.ps) {
      const a = Math.min(1, (p.life / p.max) * 1.6);
      const r = p.r * (0.5 + 0.5 * (p.life / p.max));
      if (p.star) {
        const s = r * 2.6;
        g.fillStyle(p.col, a).fillRect(p.x - s, p.y - 0.75, s * 2, 1.5).fillRect(p.x - 0.75, p.y - s, 1.5, s * 2);
        g.fillStyle(0xffffff, a).fillCircle(p.x, p.y, Math.max(1, r * 0.5));
      } else {
        g.fillStyle(p.col, 0.22 * a).fillCircle(p.x, p.y, r * 2.4);
        g.fillStyle(0xffffff, a).fillCircle(p.x, p.y, r);
      }
    }
  }
}

/** A splashy energy burst where it hits: soft glow, flickering petals of light thrown back round `dir`. */
export function drawSplash(g: Phaser.GameObjects.Graphics, x: number, y: number, dir: number, t: number, power: number, calm = false) {
  const k = calm ? 0.4 : 1;
  const R = 26 * power;
  g.fillStyle(0xffe39a, 0.18).fillCircle(x, y, R * 2.2);
  g.fillStyle(0xfff3c4, 0.35).fillCircle(x, y, R * (1.25 + 0.12 * Math.sin(t * 17 * k)));
  g.fillStyle(0xffffff, 0.9).fillCircle(x, y, R * 0.6);
  const n = 9;
  for (let i = 0; i < n; i++) {
    // petals sprayed back and out (round the way it came in), each one flickering its own length
    const a = dir + Math.PI + (i / (n - 1) - 0.5) * 3.4 + 0.12 * Math.sin(t * 5 + i);
    const len = R * (1.4 + 0.9 * (0.5 + 0.5 * Math.sin(t * 19 * k + i * 2.3)));
    const wa = 0.22;
    const bx = x + Math.cos(a) * R * 0.4;
    const by = y + Math.sin(a) * R * 0.4;
    const tip = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len };
    const l = { x: bx + Math.cos(a + Math.PI / 2) * R * wa, y: by + Math.sin(a + Math.PI / 2) * R * wa };
    const r = { x: bx - Math.cos(a + Math.PI / 2) * R * wa, y: by - Math.sin(a + Math.PI / 2) * R * wa };
    g.fillStyle(i % 2 ? 0xfff3c4 : 0xffffff, 0.55).fillTriangle(l.x, l.y, r.x, r.y, tip.x, tip.y);
    g.fillStyle(0xffffff, 0.8).fillCircle(tip.x, tip.y, 2 + power);
  }
}
