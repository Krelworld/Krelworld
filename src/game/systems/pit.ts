/**
 * THE KRUNCH PIT: fighting outside the story (Krelford's hub, next to the Constabulary). No Phaser in here: it's
 * unit-tested (tests/pit.test.ts).
 *
 *  - ENDLESS GAUNTLET: waves in one room until you drop. Everything about the enemies ramps per wave (gauntletScale),
 *    every 5th wave is a boss you've already beaten, and each wave pays (wavePay, milestoneBonus).
 *  - REMATCHES: re-run a dungeon or arena you've cleared, at a Heat (HEAT_TIERS) that toughens it and the payout.
 *  - TEST RANGE: dummies, a spawn-a-wave bell, infinite ammo and loaners. No rewards, no death.
 *
 * All three are PRACTICE: the run is snapshotted going in (beginPractice) and settled coming out (settlePractice).
 * Whatever the dungeon code did to the story while you were in there (flags, chapter, quests, archive, cutscene
 * flags, crystals, unlocks...) is thrown away; only the money, the ammo and consumables you spent or picked up, and
 * the Pit's own records come back out. The same settle is what G.save() writes while a practice run is on, so a save
 * made mid-run (or a closed tab) can never carry a story change either.
 */
import type { FlagValue, GameState, PitRecord } from "../../data/types";
import { GUNS } from "../../data/guns";
import { BANK_PERKS } from "./armoury";
import { PRIZES } from "../../content/kreddle";

export type PitMode = "gauntlet" | "rematch" | "range";

/** The building's id in the Hub (and the `at` the Pit returns you to). */
export const PIT_ID = "PIT";
export const PIT_NAME = "THE KRUNCH PIT";
/** The Pit opens once Chapter 1 is done (you've had a proper fight by then, and there's a boss to rematch). */
export const PIT_UNLOCK_FLAG = "ch1_clear";
export function pitOpen(s: Pick<GameState, "flags">): boolean {
  return !!s.flags[PIT_UNLOCK_FLAG];
}

// ------------------------------------------------------------------ records on the save

export function emptyPit(): PitRecord {
  return { bestWave: 0, runs: 0, earned: 0, rematch: {} };
}

/** Sanitise a save's `pit` (old saves don't have one). */
export function cleanPit(raw: unknown): PitRecord {
  const p = emptyPit();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  p.bestWave = num(r.bestWave);
  p.runs = num(r.runs);
  p.earned = num(r.earned);
  if (r.met === true) p.met = true;
  if (r.rematch && typeof r.rematch === "object")
    for (const [k, v] of Object.entries(r.rematch as Record<string, unknown>)) if (typeof v === "number" && isFinite(v) && v > 0) p.rematch[k] = v;
  return p;
}

export function pitRecord(s: GameState): PitRecord {
  if (!s.pit) s.pit = emptyPit();
  return s.pit;
}

// ------------------------------------------------------------------ the gauntlet: scaling

export interface WaveScale {
  /** Enemy HP, on top of the chapter and difficulty multipliers. */
  hp: number;
  /** Enemy damage. */
  dmg: number;
  /** Enemy movement speed. */
  speed: number;
  /** How often they attack (cooldowns /= this). */
  aggression: number;
  /** Chance each enemy spawns as an elite. */
  elite: number;
  /** Enemies in the wave. */
  count: number;
}

/**
 * How hard wave `n` (1, 2, 3...) is. Wave 1 is a touch softer than a chapter room; by wave 10 it's past VERY HARD
 * (which is 1.25x HP, 1.7x damage taken, 1.4x aggression), and it keeps going: HP and damage grow quadratically, so
 * wave 20 is about 5x HP and 3x damage on top of whatever difficulty you're on. Speed and aggression are capped
 * (past a point that's just unfair, not hard).
 */
export function gauntletScale(n: number): WaveScale {
  const w = Math.max(1, Math.floor(n)) - 1;
  return {
    hp: round2(0.8 + 0.12 * w + 0.006 * w * w),
    dmg: round2(0.85 + 0.06 * w + 0.0025 * w * w),
    speed: round2(Math.min(1.5, 1 + 0.02 * w)),
    aggression: round2(Math.min(2.2, 1 + 0.045 * w)),
    elite: round2(Math.min(0.6, 0.04 + 0.025 * w)),
    count: Math.min(24, 4 + Math.round(w * 0.9)),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Every 5th wave is a boss. */
export function isBossWave(n: number): boolean {
  return n > 0 && n % 5 === 0;
}

/** A boss wave's boss HP multiplier (before the usual chapter and difficulty ones). */
export function bossWaveHp(n: number): number {
  return round2(0.55 + 0.09 * n);
}

/** Escorts on a boss wave: none on the first one, then a few more each time round. */
export function bossEscorts(n: number): number {
  return n < 10 ? 0 : Math.min(8, Math.floor((n - 5) / 5) * 2);
}

/** Seconds of breather between waves (a bit longer after a boss). */
export function breatherSec(n: number): number {
  return isBossWave(n) ? 6 : 4;
}

/**
 * Who you fight in the gauntlet: what you've already met (no spoilers), by the flag that says you have. Top-down
 * enemies only (the gauntlet room is top-down). The gym lot (roadies, gym bros) are always on the card.
 */
export const GAUNTLET_POOLS: { flag?: string; enemies: string[] }[] = [
  { enemies: ["roadie", "gym_bro"] },
  { flag: "ch1_clear", enemies: ["smolt", "supply_teacher", "dinner_lady", "pe_teacher", "head_of_year", "wisp", "tray_turret", "gravy_lobber"] },
  { flag: "ch2_clear", enemies: ["plushie", "trinket", "mould", "mould_pizza", "cheese_mite", "leaping_plushie"] },
  { flag: "ch3_clear", enemies: ["pipe_gremlin", "krezbian", "vending_mimic", "pipe_mortar"] },
  { flag: "ch4_clear", enemies: ["crobley_minion", "crobage", "crobley_guard", "candy_drone", "leaping_crobage", "gobstopper", "pepsi_normal"] },
  { flag: "ch5_clear", enemies: ["catford_fox", "imaginary_mandem", "jobcentre", "wet_pizza", "corn_turd", "bone_lobber", "loved_up", "comedown", "rave_bouncer", "big_dave"] },
  { flag: "ch6_clear", enemies: ["klerble_goon", "jet_hijacker", "bandit", "bandit_gunner"] },
  { flag: "lukemind_cleansed", enemies: ["mind_imp", "custard_demon", "pudding_fiend"] },
];

export function gauntletPool(s: Pick<GameState, "flags">): string[] {
  const out: string[] = [];
  for (const p of GAUNTLET_POOLS) if (!p.flag || s.flags[p.flag]) for (const e of p.enemies) if (!out.includes(e)) out.push(e);
  return out;
}

/** Big lads: no more than a few of these at once (they'd fill the room). */
const HEAVY = new Set(["gym_bro", "rave_bouncer", "big_dave", "crobage", "pudding_fiend", "mould_pizza", "dinner_lady"]);
/** Swarmers come in packs. */
const SWARM = new Set(["smolt", "trinket", "cheese_mite", "crobley_minion", "catford_fox", "loved_up", "mind_imp"]);

/**
 * Wave `n`'s line-up: `count` enemies drawn from the pool, newest arrivals weighted up as the waves go on (so late
 * waves aren't all smolts), swarmers in pairs, at most a third of it heavies. Returns [type, count][] like a room.
 */
export function gauntletWave(n: number, pool: string[], rnd: () => number = Math.random): [string, number][] {
  const list = pool.length ? pool : ["roadie"];
  const total = gauntletScale(n).count;
  const counts = new Map<string, number>();
  let heavies = 0;
  let left = total;
  for (let guard = 0; left > 0 && guard < 400; guard++) {
    // bias towards the end of the list (later chapters) the deeper you go
    const bias = Math.min(0.85, n / 25);
    const r = rnd();
    const idx = Math.min(list.length - 1, Math.floor((bias > 0 ? 1 - Math.pow(1 - r, 1 + bias * 2) : r) * list.length));
    const t = list[idx];
    if (HEAVY.has(t) && heavies >= Math.max(1, Math.floor(total / 3))) continue;
    const k = SWARM.has(t) ? Math.min(left, 2) : 1;
    counts.set(t, (counts.get(t) ?? 0) + k);
    if (HEAVY.has(t)) heavies += k;
    left -= k;
  }
  return [...counts.entries()];
}

/**
 * Bosses for boss waves: ones you've beaten, top-down ones only (the side-on bosses need their own stages).
 * Troll is left out (that fight is head-butts only, a rule the gauntlet can't explain mid-wave).
 */
export const GAUNTLET_BOSSES: { id: string; flag: string; name: string }[] = [
  { id: "krandall", flag: "ch1_clear", name: "KRANKY KRANDALL" },
  { id: "hoard", flag: "ch2_clear", name: "THE HOARD" },
  { id: "cronster", flag: "ch3_clear", name: "THE CUDDLE CRONSTER" },
  { id: "brand", flag: "arc_fl_brand", name: "R. BRAND" },
  { id: "flatmate", flag: "arc_gr_flatmate", name: "THE FLATMATE" },
  { id: "rival", flag: "arc_kw_rival", name: "CHAD DELTOID" },
];

export function beatenBosses(s: Pick<GameState, "flags">): string[] {
  return GAUNTLET_BOSSES.filter((b) => s.flags[b.flag]).map((b) => b.id);
}

/** The boss for boss wave `n`: round the bosses you've beaten in order (wave 5 the first, 10 the next...). */
export function gauntletBossFor(n: number, beaten: string[]): string | null {
  if (!isBossWave(n) || !beaten.length) return null;
  return beaten[(n / 5 - 1) % beaten.length];
}

// ------------------------------------------------------------------ the gauntlet: payout

/**
 * Tuned against docs/ECONOMY.md: a whole playthrough earns ~10,600 Krezzcoin, about 1,000-1,500 an hour. A good
 * gauntlet run (to wave 10-12, 12-15 minutes) pays roughly 350-500 with kill drops, so farming makes about 1.5-2x the
 * story's hourly rate: worth it for the gun you're saving for, nowhere near the ~25,000 shelf in an evening.
 * Kill drops in the Pit are cut to KILL_COIN_MULT (wave pay is the main income), and difficulty's `rewards` scales
 * the wave and milestone pay like it scales chapter rewards.
 */
export const GAUNTLET_KILL_COIN_MULT = 0.35;

/** Krezzcoin for clearing wave `n` (before difficulty). */
export function waveBasePay(n: number): number {
  return Math.round(2 + 1.5 * n);
}

/** Milestone bonuses: [coins, krokens] on clearing wave `n` (0s if it isn't one). */
export function milestoneBonus(n: number): { coins: number; krokens: number } {
  const table: Record<number, [number, number]> = { 5: [25, 1], 10: [75, 3], 15: [150, 4], 20: [250, 6] };
  if (table[n]) return { coins: table[n][0], krokens: table[n][1] };
  if (n > 20 && n % 5 === 0) return { coins: 250, krokens: 6 };
  return { coins: 0, krokens: 0 };
}

/** Everything clearing wave `n` pays, with difficulty's `rewards` multiplier. */
export function wavePay(n: number, rewards = 1): { coins: number; krokens: number; milestone: boolean } {
  const m = milestoneBonus(n);
  return { coins: Math.round((waveBasePay(n) + m.coins) * rewards), krokens: m.krokens, milestone: m.coins > 0 };
}

/** What a run that cleared `waves` waves paid out (wave pay + milestones, no kill drops). */
export function runPay(waves: number, rewards = 1): { coins: number; krokens: number } {
  let coins = 0;
  let krokens = 0;
  for (let n = 1; n <= waves; n++) {
    const p = wavePay(n, rewards);
    coins += p.coins;
    krokens += p.krokens;
  }
  return { coins, krokens };
}

// ------------------------------------------------------------------ rematches

/** Heat: how much hotter than the original fight. Enemies scale with it, so does the clear payout. */
export const HEAT_TIERS: { heat: number; name: string; color: number }[] = [
  { heat: 1, name: "MILD", color: 0x86efac },
  { heat: 1.5, name: "SPICY", color: 0xfacc15 },
  { heat: 2, name: "KREZZ HOT", color: 0xfb923c },
  { heat: 3, name: "RING OF FIRE", color: 0xef4444 },
];

export function heatScale(heat: number): { hp: number; dmg: number; aggression: number; speed: number } {
  const h = Math.max(1, heat) - 1;
  return { hp: round2(1 + h * 0.8), dmg: round2(1 + h * 0.5), aggression: round2(1 + h * 0.25), speed: round2(Math.min(1.25, 1 + h * 0.08)) };
}

export interface RematchDef {
  id: string;
  name: string;
  sub: string;
  dungeon: string;
  /** First and last room of the run (inclusive). */
  from: number;
  to: number;
  /** Unlocked once this flag is set (you've cleared it in the story). */
  flag: string;
  /** What the original clear paid (before difficulty). */
  basePay: number;
}

const chapterPay = (ch: number) => Math.round(200 * (1 + (ch - 1) * 0.25));

/**
 * What can be re-run. Chapter dungeons end at their boss (Mollor's cell, the shrink ray, the colon, the crash: all
 * story, left out). Da Drongus Dungeon is the finale and isn't on the card. "Boss only" ones pay 60% of the dungeon.
 */
export const REMATCHES: RematchDef[] = [
  { id: "wildern", name: "WILDERN ACADEMY", sub: "Chapter 1 · the whole school", dungeon: "wildern", from: 0, to: 3, flag: "ch1_clear", basePay: chapterPay(1) },
  { id: "krandall", name: "KRANKY KRANDALL", sub: "Chapter 1 · boss only", dungeon: "wildern", from: 3, to: 3, flag: "ch1_clear", basePay: Math.round(chapterPay(1) * 0.6) },
  { id: "polson_towers", name: "POLSON TOWERS", sub: "Chapter 2 · the whole flat", dungeon: "polson_towers", from: 0, to: 3, flag: "ch2_clear", basePay: chapterPay(2) },
  { id: "hoard", name: "THE HOARD", sub: "Chapter 2 · boss only", dungeon: "polson_towers", from: 3, to: 3, flag: "ch2_clear", basePay: Math.round(chapterPay(2) * 0.6) },
  { id: "ministry", name: "THE MINISTRY OF BONER CONTROL", sub: "Chapter 3 · the climb and the Cronster", dungeon: "ministry", from: 0, to: 1, flag: "ch3_clear", basePay: chapterPay(3) },
  { id: "cronster", name: "THE CUDDLE CRONSTER", sub: "Chapter 3 · boss only", dungeon: "ministry", from: 1, to: 1, flag: "ch3_clear", basePay: Math.round(chapterPay(3) * 0.6) },
  { id: "crobley_factory", name: "THE CROBLEY FACTORY", sub: "Chapter 4 · floor to core", dungeon: "crobley_factory", from: 0, to: 4, flag: "ch4_clear", basePay: chapterPay(4) },
  { id: "crobleys", name: "THE CROBLEY BOSS RUSH", sub: "Chapter 4 · showcase and core", dungeon: "crobley_factory", from: 3, to: 4, flag: "ch4_clear", basePay: Math.round(chapterPay(4) * 0.6) },
  { id: "jam", name: "JQ, THE JAM QUEEN", sub: "Chapter 5 · the Job Centre car park", dungeon: "arena_sanmik", from: 3, to: 3, flag: "ch5_clear", basePay: Math.round(chapterPay(5) * 0.6) },
  { id: "rik", name: "UNCLE RIK", sub: "Chapter 5 · the giant hot tub", dungeon: "arena_sanmik", from: 5, to: 5, flag: "ch5_clear", basePay: Math.round(chapterPay(5) * 0.6) },
  { id: "airport", name: "FLIGHT KR-069", sub: "Chapter 6 · aisle and cockpit (timer on)", dungeon: "airport", from: 0, to: 1, flag: "ch6_clear", basePay: chapterPay(6) },
  { id: "krozno", name: "CAPTAIN STANLEY'S COCKPIT", sub: "Chapter 6 · boss only", dungeon: "airport", from: 1, to: 1, flag: "ch6_clear", basePay: Math.round(chapterPay(6) * 0.6) },
  { id: "arena_brand", name: "THE BJJ OPEN", sub: "Side arena · Krelford University", dungeon: "arena_brand", from: 0, to: 0, flag: "arc_fl_brand", basePay: 150 },
  { id: "arena_troll", name: "BLUES NIGHT", sub: "Side arena · the Krezz Arms back room", dungeon: "arena_troll", from: 0, to: 0, flag: "arc_kz_troll", basePay: 150 },
  { id: "arena_flatmate", name: "THE OLD FLAT", sub: "Side arena · the deposit is owed", dungeon: "arena_flatmate", from: 0, to: 0, flag: "arc_gr_flatmate", basePay: 150 },
  { id: "arena_rival", name: "THE SQUAT RACK OF DESTINY", sub: "Side arena · Krunch Gym", dungeon: "arena_rival", from: 0, to: 0, flag: "arc_kw_rival", basePay: 150 },
  { id: "arena_lukemind", name: "INSIDE LULON'S MIND", sub: "Side arena · mind the gap", dungeon: "arena_lukemind", from: 0, to: 2, flag: "lukemind_cleansed", basePay: 150 },
];

export const REMATCH_BY_ID: Record<string, RematchDef> = Object.fromEntries(REMATCHES.map((r) => [r.id, r]));

export function rematchesOpen(s: Pick<GameState, "flags">): RematchDef[] {
  return REMATCHES.filter((r) => !!s.flags[r.flag]);
}

/** Replays pay half what the original clear did, times the Heat (and difficulty's `rewards`). */
export const REMATCH_PAY_RATE = 0.5;
/** Kill drops in a rematch are cut to this too. */
export const REMATCH_KILL_COIN_MULT = 0.5;

export function rematchPay(r: Pick<RematchDef, "basePay">, heat: number, rewards = 1): { coins: number; krokens: number } {
  return { coins: Math.round(r.basePay * REMATCH_PAY_RATE * heat * rewards), krokens: heat >= 3 ? 4 : heat >= 2 ? 2 : heat >= 1.5 ? 1 : 0 };
}

// ------------------------------------------------------------------ the test range: loaners

/** Guns you can borrow at the range: every gun in the game (bar the raid-only flamethrower). */
export function loanableGuns(): string[] {
  return Object.keys(GUNS).filter((id) => id !== "chem_flamer");
}

/** Perks you can borrow: the Exchange's perks and the Prize Counter's fighting prizes, at their top level. */
export function loanablePerks(): { key: string; name: string; desc: string; max: number; icon: string }[] {
  const out = BANK_PERKS.map((p) => ({ key: p.id, name: p.name, desc: p.desc, max: p.max, icon: p.icon }));
  for (const p of PRIZES) if (p.key && !p.gun && p.cat !== "style" && p.key !== "fairies" && p.key !== "kd_lucky") out.push({ key: p.key, name: p.name, desc: p.desc, max: p.max ?? 1, icon: p.icon });
  return out;
}

// ------------------------------------------------------------------ practice: snapshot and settle

/** A deep copy (saves are plain JSON). */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}

export interface PracticeEarnings {
  coins: number;
  krokens: number;
}

const krokensOf = (s: GameState) => (typeof s.flags.krokens === "number" ? (s.flags.krokens as number) : 0);

/**
 * The run you get back out of a practice run: exactly the one you went in with, plus
 *  - gauntlet / rematch: the Krezzcoin and Krokens you made in there (never less than you went in with: practice
 *    can't cost you money), the ammo of the guns you already owned (spent is spent, picked up is yours), your
 *    juice bottles and Fizzy Bongos as they are now, and the Pit's records (best wave, best Heat, totals).
 *  - range: nothing at all. Every loaner, every free bullet, every borrowed perk goes back on the rack.
 * Flags come back exactly as they were, apart from `krokens`. HP is full.
 */
export function settlePractice(snap: GameState, live: GameState, mode: PitMode): GameState {
  const out = cloneState(snap);
  out.playtimeMs = Math.max(snap.playtimeMs, live.playtimeMs);
  out.pit = cleanPit(live.pit ?? snap.pit);
  if (mode !== "range") {
    out.coins = Math.max(snap.coins, live.coins);
    const k = Math.max(krokensOf(snap), krokensOf(live));
    if (k !== krokensOf(snap)) out.flags.krokens = k;
    out.guns = { ...(snap.guns ?? {}) };
    for (const id of Object.keys(out.guns)) {
      const v = live.guns?.[id];
      if (typeof v === "number" && isFinite(v)) out.guns[id] = Math.max(0, v);
    }
    out.bottles = live.bottles;
    out.bongos = live.bongos;
  } else out.pit = cleanPit(snap.pit);
  out.phase = "hub";
  return out;
}

/** What a practice run earned (for the results card). */
export function practiceEarnings(snap: GameState, settled: GameState): PracticeEarnings {
  return { coins: settled.coins - snap.coins, krokens: krokensOf(settled) - krokensOf(snap) };
}

/** Flags that differ between two runs (for the tests and the debug check): keys added, removed or changed. */
export function flagDiff(a: Record<string, FlagValue>, b: Record<string, FlagValue>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]).sort();
}

/** Record a finished gauntlet on the Pit's record. Returns true if it's a new best. */
export function recordGauntlet(p: PitRecord, wavesCleared: number, earned: number): boolean {
  p.runs++;
  p.earned += Math.max(0, earned);
  if (wavesCleared > p.bestWave) {
    p.bestWave = wavesCleared;
    return true;
  }
  return false;
}

/** Record a rematch win at `heat`. Returns true if it's the hottest you've beaten it at. */
export function recordRematch(p: PitRecord, id: string, heat: number, earned: number): boolean {
  p.runs++;
  p.earned += Math.max(0, earned);
  if (heat > (p.rematch[id] ?? 0)) {
    p.rematch[id] = heat;
    return true;
  }
  return false;
}
