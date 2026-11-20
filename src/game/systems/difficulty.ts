/**
 * Difficulty: one table, five levels. No Phaser in here (it's unit-tested).
 *
 * Level 2 is the game exactly as it was first balanced (every multiplier 1, every number the old one). New games
 * default to 3. Old saves (made before difficulty existed) come back as 2, so nobody's game changes under them.
 *
 * Harder levels lean on behaviour (aggression, telegraphs, enemy counts, the economy) rather than HP sponges; easier
 * levels mostly soften what happens to YOU (damage taken, longer warnings, more heals, roomier timing windows).
 * Everything reads it live: switch in the pause menu and it takes effect from the next room / fight / minigame.
 */

export interface DifficultyDef {
  level: number;
  name: string;
  /** One plain line: what it does. */
  blurb: string;
  color: number;
  /** Regular enemies' HP. */
  enemyHp: number;
  /** Bosses' (and the hero passengers') HP. */
  bossHp: number;
  /** Every hit the player takes, from anything (enemies, bosses, hazards, the SSJ brawl, the car). */
  damageTaken: number;
  /** Wind-ups, AoE fuses, charge lines. >1 = longer warnings (easier). */
  telegraph: number;
  /** How often enemies attack and bosses start a pattern. >1 = cooldowns shorter. */
  aggression: number;
  /** Enemy movement speed. */
  enemySpeed: number;
  /** Enemy bullet speed. */
  projectileSpeed: number;
  /** Enemies per wave (fractions roll the dice; never below one of each). */
  enemyCount: number;
  /** Heal drop chance from kills. */
  healDrops: number;
  /** Ammo drop chance from kills. */
  ammoDrops: number;
  /** Kills in a row without ammo before one is guaranteed (bad-luck protection). */
  ammoDryKills: number;
  /** Coins from kills (harder pays more). */
  coins: number;
  /** Story payouts: chapter-complete, side-quest and personal-quest Krezzcoin (harder pays more). */
  rewards: number;
  /** Bonus Krokens for every chapter you complete on this level (0 = none). */
  krokenBonus: number;
  /** Krezz meter gain (pickups and the trickle). */
  krezzGain: number;
  /** Mercy invincibility after a hit. */
  iframes: number;
  /** Timing windows: the wonk zone and its clock, the group wonk's beat window, the SSJ parry, the flight lock-on. >1 = roomier. */
  timing: number;
  /** How long a boss shield holds out before it starts cracking itself. */
  shieldStall: number;
  /** Extra (or fewer) minions per boss shield. */
  shieldMinions: number;
}

export const DIFFICULTY_LEVELS: readonly DifficultyDef[] = [
  {
    level: 1,
    name: "VERY EASY",
    blurb: "For the story. Enemies hit softly and warn you early, and healing is plentiful.",
    color: 0x86efac,
    enemyHp: 0.7, bossHp: 0.7, damageTaken: 0.55, telegraph: 1.35, aggression: 0.75, enemySpeed: 0.88, projectileSpeed: 0.82,
    enemyCount: 0.75, healDrops: 2, ammoDrops: 1.4, ammoDryKills: 4, coins: 1, rewards: 1, krokenBonus: 0, krezzGain: 1.3, iframes: 1.4, timing: 1.35, shieldStall: 0.6, shieldMinions: -1,
  },
  {
    level: 2,
    name: "EASY",
    blurb: "The game as it was originally balanced.",
    color: 0x67e8f9,
    enemyHp: 1, bossHp: 1, damageTaken: 1, telegraph: 1, aggression: 1, enemySpeed: 1, projectileSpeed: 1,
    enemyCount: 1, healDrops: 1, ammoDrops: 1, ammoDryKills: 6, coins: 1, rewards: 1, krokenBonus: 0, krezzGain: 1, iframes: 1, timing: 1, shieldStall: 1, shieldMinions: 0,
  },
  {
    level: 3,
    name: "NORMAL",
    blurb: "Recommended. Enemies are a bit tougher and quicker, and healing is a bit scarcer.",
    color: 0xffd23f,
    enemyHp: 1.08, bossHp: 1.08, damageTaken: 1.2, telegraph: 0.92, aggression: 1.12, enemySpeed: 1.04, projectileSpeed: 1.05,
    enemyCount: 1.1, healDrops: 0.85, ammoDrops: 0.95, ammoDryKills: 6, coins: 1.1, rewards: 1, krokenBonus: 0, krezzGain: 1, iframes: 1, timing: 0.92, shieldStall: 1, shieldMinions: 0,
  },
  {
    level: 4,
    name: "HARD",
    blurb: "More enemies, faster attacks, less healing and ammo. Pays more: 1.5x coin from kills, 1.4x quest and chapter rewards, +10 Krokens a chapter.",
    color: 0xfb923c,
    enemyHp: 1.15, bossHp: 1.15, damageTaken: 1.4, telegraph: 0.85, aggression: 1.25, enemySpeed: 1.08, projectileSpeed: 1.1,
    enemyCount: 1.25, healDrops: 0.7, ammoDrops: 0.85, ammoDryKills: 7, coins: 1.5, rewards: 1.4, krokenBonus: 10, krezzGain: 0.92, iframes: 0.92, timing: 0.85, shieldStall: 1.15, shieldMinions: 1,
  },
  {
    level: 5,
    name: "VERY HARD",
    blurb: "Short warnings, heavy hits, big waves, few drops. Pays the most: 1.9x coin from kills, 1.8x quest and chapter rewards, +25 Krokens a chapter.",
    color: 0xff4d6d,
    enemyHp: 1.25, bossHp: 1.25, damageTaken: 1.7, telegraph: 0.78, aggression: 1.4, enemySpeed: 1.12, projectileSpeed: 1.18,
    enemyCount: 1.4, healDrops: 0.55, ammoDrops: 0.75, ammoDryKills: 8, coins: 1.9, rewards: 1.8, krokenBonus: 25, krezzGain: 0.85, iframes: 0.85, timing: 0.78, shieldStall: 1.3, shieldMinions: 1,
  },
];

/** What the game played like before difficulty existed (old saves come back as this). */
export const LEGACY_DIFFICULTY = 2;
/** New games. */
export const DEFAULT_DIFFICULTY = 3;
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = DIFFICULTY_LEVELS.length;

/** A valid level (anything else: `dflt`). */
export function clampDifficulty(v: unknown, dflt = LEGACY_DIFFICULTY): number {
  return typeof v === "number" && Number.isInteger(v) && v >= MIN_DIFFICULTY && v <= MAX_DIFFICULTY ? v : dflt;
}

export function difficultyDef(level: number): DifficultyDef {
  return DIFFICULTY_LEVELS[clampDifficulty(level) - 1];
}

/** The table row for a run (a state without one: the old balance). */
export function diffFor(s: { difficulty?: number } | null | undefined): DifficultyDef {
  return difficultyDef(clampDifficulty(s?.difficulty));
}

/** "3/5 · NORMAL" */
export function difficultyLabel(level: number): string {
  const d = difficultyDef(level);
  return `${d.level}/${MAX_DIFFICULTY} · ${d.name}`;
}

/**
 * Enemies in a wave entry of `count` at multiplier `mult`: the whole part always, the fraction on a dice roll,
 * never fewer than one when there was at least one. mult 1 gives exactly `count`.
 */
export function scaleCount(count: number, mult: number, rnd: () => number = Math.random): number {
  if (mult === 1 || count <= 0) return count;
  const x = count * mult;
  const whole = Math.floor(x);
  const n = whole + (rnd() < x - whole ? 1 : 0);
  return Math.max(1, n);
}

/** A cooldown that just started (now -> next) shortened by `aggression` (>1 = sooner). */
export function scaleCooldown(now: number, next: number, aggression: number): number {
  if (next <= now || aggression === 1 || aggression <= 0) return next;
  return now + (next - now) / aggression;
}

/** An integer amount scaled (left exactly as it is at 1; otherwise rounded, at least 1 if it was positive). */
export function scaleInt(n: number, mult: number): number {
  if (mult === 1) return n;
  return n > 0 ? Math.max(1, Math.round(n * mult)) : n;
}

/** The headline numbers for a level, in plain words (shown on the picker), relative to the original balance. */
export function difficultyStats(d: DifficultyDef): string {
  const x = (v: number) => `×${Number(v.toFixed(2))}`;
  return [`Damage taken ${x(d.damageTaken)}`, `Enemy aggression ${x(d.aggression)}`, `Warnings ${x(d.telegraph)}`, `Mobs ${x(d.enemyCount)}`, `Heal drops ${x(d.healDrops)}`, `Enemy HP ${x(d.enemyHp)}`, `Timing windows ${x(d.timing)}`].join("  ·  ");
}

export const DIFFICULTY_NOTE = "You can change this any time from the pause menu (not inside a dungeon).";
