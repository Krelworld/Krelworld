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
export interface Flappy { gauge: number; vel: number }
export function flap(g: Flappy) {
  g.vel = FLAP;
}
export function fall(g: Flappy, dtMs: number) {
  const dt = dtMs / 1000;
  g.vel -= GRAV * dt;
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
export function wonkForm(sweetMs: number, sinceEntryMs: number, sweetHeight: number): number {
  if (sinceEntryMs <= 0) return 0;
  const best = Math.min(1, Math.sqrt(sweetHeight / ARC));
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
