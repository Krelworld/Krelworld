// Seeded random streams. State is plain data so it is saved with checkpoints.
export interface RngState { a: number; b: number; c: number; d: number }

export function seedRng(seed: number | string): RngState {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const s = { a: next(), b: next(), c: next(), d: next() };
  for (let i = 0; i < 12; i++) rnd(s);
  return s;
}

/** Uniform in [0, 1). sfc32. */
export function rnd(s: RngState): number {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  s.d = (s.d + 1) | 0;
  s.a = s.b ^ (s.b >>> 9);
  s.b = (s.c + (s.c << 3)) | 0;
  s.c = (s.c << 21) | (s.c >>> 11);
  s.c = (s.c + t) | 0;
  return (t >>> 0) / 4294967296;
}

export const rndRange = (s: RngState, lo: number, hi: number) => lo + rnd(s) * (hi - lo);
export const rndInt = (s: RngState, n: number) => Math.floor(rnd(s) * n);
export const chance = (s: RngState, p: number) => rnd(s) < p;
export const pick = <T>(s: RngState, arr: readonly T[]): T => arr[rndInt(s, arr.length)];

/** Normal distribution, mean 0, standard deviation 1. */
export function gauss(s: RngState): number {
  const u = Math.max(rnd(s), 1e-12), v = rnd(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
