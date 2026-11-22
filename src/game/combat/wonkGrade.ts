/**
 * The pure side of WONK YOUR THANG: the flappy gauge physics, the KREZZ ZONE, and how a finished wonk is graded.
 * (No Phaser in here, so it can be unit tested.)
 */

export const OVER = 0.97;
export const TIME = 8000;

// Flappy physics: each press kicks the gauge upward, gravity drags it back down. Easy to overshoot.
export const FLAP = 0.7; // upward speed (gauge units/sec) set by a press
export const GRAV = 2.1; // gauge units/sec^2
/** How high one flap carries the gauge from where you pressed (v^2 / 2g). */
export const ARC = (FLAP * FLAP) / (2 * GRAV);

export interface WonkZone { lo: number; hi: number; need: number }
/** A new KREZZ ZONE every time: random height, random width. Narrow zones need less time in them. */
export function randomZone(rnd: () => number = Math.random): WonkZone {
  const width = 0.07 + rnd() * 0.17;
  const lo = 0.22 + rnd() * (OVER - 0.05 - width - 0.22);
  return { lo, hi: lo + width, need: Math.round(1300 + width * 5000) };
}
/** The gauge. `flap`/`grav` override the default physics for this one gauge (a WonkStyle sets them). */
export interface Flappy { gauge: number; vel: number; flap?: number; grav?: number }
export function flap(g: Flappy) {
  g.vel = g.flap ?? FLAP;
}
export function fall(g: Flappy, dtMs: number) {
  const dt = dtMs / 1000;
  g.vel -= (g.grav ?? GRAV) * dt;
  g.gauge += g.vel * dt;
  if (g.gauge <= 0) {
    g.gauge = 0;
    g.vel = 0;
  }
  if (g.gauge > 1) g.gauge = 1;
}

/** Half-height of the SWEET SPOT, the bright band in the middle of the zone (the whole zone when it's narrow). */
export const SWEET_HALF = 0.05;
export function sweetSpot(z: { lo: number; hi: number }) {
  const mid = (z.lo + z.hi) / 2;
  const half = Math.min((z.hi - z.lo) / 2, SWEET_HALF);
  return { lo: mid - half, hi: mid + half };
}

/**
 * Form, 0..1: the share of the time since you first hit the zone that the gauge sat in the sweet spot,
 * against the best a flap arc can physically manage there (a bounce can only hover so long in a band
 * thinner than its own arc). Waffling about below the zone, bouncing off the top of it, and slow
 * rhythm all drag it down.
 */
export function wonkForm(sweetMs: number, sinceEntryMs: number, sweetHeight: number, arc = ARC): number {
  if (sinceEntryMs <= 0) return 0;
  const best = Math.min(1, Math.sqrt(sweetHeight / arc));
  return Math.max(0, Math.min(1, sweetMs / sinceEntryMs / best));
}

export type WonkGrade = "PERFECT" | "GREAT" | "GOOD";
/**
 * Tuned against a simulated player: a casual masher averages about 0.6
 * (GOOD/GREAT, PERFECT ~1 in 13), a decent player who times flaps for the sweet spot gets PERFECT
 * roughly 1 in 4, a really tidy one about 2 in 3.
 */
export const GRADE_AT = { PERFECT: 0.82, GREAT: 0.62 } as const;
export function gradeWonk(form: number): WonkGrade {
  return form >= GRADE_AT.PERFECT ? "PERFECT" : form >= GRADE_AT.GREAT ? "GREAT" : "GOOD";
}

/** What the jet stream gets multiplied by (damage, beam width, knockback, burst radius). The old flat "perfect" was 1. */
export const WONK_POWER: Record<WonkGrade, number> = { GOOD: 0.7, GREAT: 0.9, PERFECT: 1.2 };
export const WONK_LABEL: Record<WonkGrade, string> = { GOOD: "GOOD WONK", GREAT: "GREAT WONK!!", PERFECT: "PERFECT WONK!!!" };

// ---------------------------------------------------------------- variety: a different wonk each time

/**
 * How this particular wonk feels. The first one ever is gentle (a big zone that sits still, floatier physics,
 * more time); after that the zone can drift, the physics can go heavy or floaty, and the zone can be narrow.
 * (Stardew's fishing bar is the cautionary tale: a gauge game that starts too hard puts people off it for good.)
 */
export interface WonkStyle {
  id: "gentle" | "classic" | "drift" | "heavy" | "floaty" | "disco";
  /** shown under the title, so the change reads as deliberate ("" = say nothing) */
  name: string;
  flap: number;
  grav: number;
  /** zone width multiplier */
  width: number;
  /** how far the zone slides up and down (gauge units, either way) and how fast (cycles a second) */
  drift: number;
  driftHz: number;
  /** ms you get */
  time: number;
  /** first-timer help: a free bounce off the over-wonk line, and a pulse showing the tapping rhythm */
  freebies?: number;
  coach?: boolean;
}
export const WONK_STYLES: Record<WonkStyle["id"], WonkStyle> = {
  gentle: { id: "gentle", name: "BEGINNER'S WONK · big zone, take your time", flap: 0.62, grav: 1.6, width: 1.7, drift: 0, driftHz: 0, time: 11000, freebies: 1, coach: true },
  classic: { id: "classic", name: "", flap: FLAP, grav: GRAV, width: 1, drift: 0, driftHz: 0, time: TIME },
  drift: { id: "drift", name: "SLIPPERY ZONE · it won't keep still", flap: FLAP, grav: GRAV, width: 1.35, drift: 0.12, driftHz: 0.22, time: 9500 },
  heavy: { id: "heavy", name: "HEAVY WONK · big strokes, drops like a stone", flap: 0.85, grav: 2.8, width: 1.45, drift: 0, driftHz: 0, time: TIME },
  floaty: { id: "floaty", name: "FLOATY WONK · easy does it", flap: 0.5, grav: 1.15, width: 1, drift: 0, driftHz: 0, time: 9500 },
  disco: { id: "disco", name: "DISCO ZONE · it moves to the beat", flap: FLAP, grav: GRAV, width: 1.3, drift: 0.09, driftHz: 0.35, time: TIME },
};

/** Which style the n-th wonk (0 = your first ever) gets: gentle first, a roomy plain one or two, then a mix. */
export function wonkStyleFor(n: number, rnd: () => number = Math.random): WonkStyle {
  if (n <= 0) return WONK_STYLES.gentle;
  if (n < 3) return { ...WONK_STYLES.classic, width: n === 1 ? 1.35 : 1.15 };
  const mix: WonkStyle["id"][] = ["classic", "classic", "drift", "heavy", "floaty"];
  return WONK_STYLES[mix[Math.floor(rnd() * mix.length)]];
}

/** A zone for a style: wider or narrower, and kept clear of the floor and the over-wonk line even at the ends of its drift. */
export function styledZone(style: WonkStyle, rnd: () => number = Math.random): WonkZone {
  const z = randomZone(rnd);
  const width = Math.min(0.36, (z.hi - z.lo) * style.width);
  const loMin = 0.22 + style.drift;
  const loMax = OVER - 0.05 - width - style.drift;
  // the gentle one sits round the middle, where a first-timer's flapping naturally ends up
  const lo = style.id === "gentle" ? 0.34 + rnd() * 0.08 : loMin + rnd() * Math.max(0, loMax - loMin);
  return { lo, hi: lo + width, need: Math.round(1300 + (z.hi - z.lo) * 5000) };
}

/** Where a drifting zone is at `ms` (a still zone just comes back as it is). */
export function zoneAt(z: WonkZone, style: Pick<WonkStyle, "drift" | "driftHz">, ms: number, phase = 0): WonkZone {
  if (!style.drift) return z;
  const off = Math.sin((ms / 1000) * style.driftHz * Math.PI * 2 + phase) * style.drift;
  return { lo: z.lo + off, hi: z.hi + off, need: z.need };
}

/** Give a gauge a style's physics. */
export function styleGauge<T extends Flappy>(g: T, style: WonkStyle): T {
  g.flap = style.flap;
  g.grav = style.grav;
  return g;
}
