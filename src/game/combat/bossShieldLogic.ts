/**
 * Boss shield phases, the rules (no Phaser here, so it's unit-tested): which bosses get them, where, with which
 * minions, and the little state machine (idle -> pending -> shielded -> vulnerable -> idle ...).
 *
 * At each HP threshold the boss's health is clamped (one big hit can't skip a shield), the shield goes up, minions
 * come out, and every minion that dies cracks it. The last crack shatters it and the boss is stunned and takes
 * bonus damage for a few seconds. If a shield phase drags on (25s), it starts cracking by itself.
 * The visuals and the wiring live in BossShield.ts.
 */

export interface ShieldConfig {
  /** HP fractions where a shield goes up, highest first. */
  thresholds: number[];
  /** Enemy types (src/data/enemies*.ts) it calls in, cycled. Weak versions (see minionHp). */
  minions: string[];
  /** How many minions each shield calls in (by shield number; the last entry repeats). */
  count: number[];
  /** Minion HP multiplier (they're meant to die quickly). */
  minionHp: number;
  /** The boss's attack rate while shielded (0.55 = its gaps between attacks are ~1.8x as long). */
  rate: number;
}

export const SHIELD_TUNING = {
  /** A shield phase that has lasted this long starts cracking on its own (the player can't get stuck). */
  stallMs: 25000,
  /** ...one crack this often after that. */
  stallCrackEvery: 3500,
  /** Stunned and open after the shatter. */
  vulnerableMs: 3200,
  /** Damage multiplier while it's open. */
  bonus: 1.5,
};

const TWO = [0.66, 0.33];
/** Short or minor fights: one shield (above half, so it doesn't land on the bosses' own half-health beats). */
const ONE = [0.55];

export const DEFAULT_SHIELD: ShieldConfig = { thresholds: TWO, minions: ["cultist"], count: [3, 4], minionHp: 0.55, rate: 0.55 };

/**
 * Per boss. Missing: the defaults. null: no shields (it has its own scripted invulnerability, or it's a set piece).
 * Minions are the boss's own themed adds wherever it has them.
 */
export const BOSS_SHIELDS: Record<string, Partial<ShieldConfig> | null> = {
  // the story's top-down dungeon bosses
  krandall: { minions: ["dinner_lady", "supply_teacher"] },
  hoard: { minions: ["plushie", "mould", "mould_pizza"] },
  cronster: { minions: ["plushie", "leaping_plushie"] },
  krozno: { minions: ["bandit", "bandit_gunner"] },
  jam: { minions: ["jam_donut"], count: [4, 5] },
  rik: { minions: ["biofilm", "hottub_bubble"] },
  // the arenas
  brand: { minions: ["pe_teacher", "supply_teacher"] },
  troll: { minions: ["roadie"] },
  rival: { minions: ["gym_bro"] },
  flatmate: { thresholds: ONE, minions: ["invoice"], count: [5] },
  pudding_demon: { thresholds: ONE, minions: ["mind_imp", "custard_demon"], count: [4] },
  // the Crobley factory (run'n'gun): the boss rush gets one shield each, Reinhardt at the end gets two
  flirt: { thresholds: ONE, minions: ["crobley_minion"], count: [4] },
  lantern: { thresholds: ONE, minions: ["crobley_minion", "candy_drone"], count: [3] },
  fruity: { thresholds: ONE, minions: ["crobley_minion", "crobage"], count: [3] },
  tank: { thresholds: ONE, minions: ["crobage", "crobley_minion"], count: [3] },
  reinhardt: { minions: ["crobley_guard", "crobage", "crobley_minion"], count: [3, 4] },
  // Da Drongus Dungeon: the two mini-bosses get one, Drongus himself (both phases) gets two
  krex: { thresholds: ONE, minions: ["news_drone", "nonce"], count: [3] },
  elon: { thresholds: ONE, minions: ["x_logo"], count: [5] },
  drongus1: { minions: ["ai_pitbull", "news_drone", "nonce"], count: [3, 4] },
  drongus2: { minions: ["news_drone", "ai_pitbull", "kamikaze"], count: [3, 4] },
  // older bosses
  salmon: { minions: ["smolt"], count: [5, 6] },
  machine: { minions: ["pipe_gremlin", "vending_mimic"] },
  banhammer: { minions: ["cultist", "decree_drone"] },
  spectre: { minions: ["betrayer"] },
  // their own shield/invulnerability scripts: shields here would fight them
  feedback: null, // the approval-terminal shield
  drongus: null, // the Lorelord's Krezz shield (broken with a Krezz Burst)
  concept: null, // wounded / real phase / the clash: scripted
  dark_drongus: null, // invulnerable by design (free the lads, then the group wonk)
  // the hero passengers on the plane: three mini-bosses at once is enough to be going on with
  heropax_rugby: null,
  heropax_gapgirl: null,
  heropax_major: null,
};

export function shieldConfig(bossId: string): ShieldConfig | null {
  if (bossId in BOSS_SHIELDS && BOSS_SHIELDS[bossId] === null) return null;
  const c = { ...DEFAULT_SHIELD, ...(BOSS_SHIELDS[bossId] ?? {}) };
  c.thresholds = [...c.thresholds].filter((t) => t > 0 && t < 1).sort((a, b) => b - a);
  if (!c.thresholds.length || !c.minions.length) return null;
  return c;
}

/** Minions for shield number `n` (0-based). */
export function minionsFor(c: ShieldConfig, n: number): string[] {
  const k = Math.max(1, c.count[Math.min(n, c.count.length - 1)] ?? 3);
  return Array.from({ length: k }, (_, i) => c.minions[i % c.minions.length]);
}

/** While shielded, an attack's cooldown that just started (now -> next) is stretched by 1/rate. */
export function stretchCooldown(now: number, next: number, rate: number): number {
  if (next <= now || rate >= 1 || rate <= 0) return next;
  return now + (next - now) / rate;
}

export type ShieldState = "idle" | "pending" | "shielded" | "vulnerable";
export type ShieldEvent = "autocrack" | "weaken" | "recovered" | null;

export class ShieldPhase {
  state: ShieldState = "idle";
  /** Index of the next threshold still to come. */
  next = 0;
  /** Shields raised so far. */
  raised = 0;
  need = 0;
  cracks = 0;
  startedAt = 0;
  vulnUntil = 0;
  private lastAuto = 0;
  private weakened = false;

  constructor(
    readonly cfg: ShieldConfig,
    hpFrac = 1,
    readonly tune = SHIELD_TUNING,
  ) {
    // a boss that starts part-way down (a checkpoint) skips the shields it's already past
    while (this.next < cfg.thresholds.length && cfg.thresholds[this.next] >= hpFrac) this.next++;
  }

  /** It's up (or about to be): nothing gets through. */
  get blocking() {
    return this.state === "pending" || this.state === "shielded";
  }

  get thresholdHp() {
    return this.cfg.thresholds[this.next];
  }

  /**
   * Damage about to land on the boss: what actually gets through. Bonus while it's open; clamped at the next
   * threshold (the hit that reaches it raises the shield, the rest of it is lost).
   */
  filter(hp: number, maxHp: number, amount: number): { amount: number; raised: boolean } {
    if (this.blocking) return { amount: 0, raised: false };
    let a = Math.max(0, amount);
    if (this.state === "vulnerable") a *= this.tune.bonus;
    if (this.next < this.cfg.thresholds.length) {
      const floor = this.cfg.thresholds[this.next] * maxHp;
      if (hp - a <= floor) {
        a = Math.max(0, hp - floor);
        this.next++;
        this.state = "pending";
        return { amount: a, raised: true };
      }
    }
    return { amount: a, raised: false };
  }

  /** The shield's up, with `need` minions to kill. */
  begin(now: number, need: number) {
    this.state = "shielded";
    this.need = Math.max(1, need);
    this.cracks = 0;
    this.startedAt = now;
    this.lastAuto = now;
    this.weakened = false;
    this.raised++;
  }

  /** A minion died (or it cracked by itself). True when that was the last crack: it shatters. */
  crack(now: number): boolean {
    if (this.state !== "shielded") return false;
    this.cracks++;
    if (this.cracks < this.need) return false;
    this.state = "vulnerable";
    this.vulnUntil = now + this.tune.vulnerableMs;
    return true;
  }

  /** Per frame. */
  tick(now: number): ShieldEvent {
    if (this.state === "shielded") {
      const t = now - this.startedAt;
      if (t >= this.tune.stallMs) {
        if (!this.weakened) {
          this.weakened = true;
          this.lastAuto = now;
          return "weaken";
        }
        if (now - this.lastAuto >= this.tune.stallCrackEvery) {
          this.lastAuto = now;
          return "autocrack";
        }
      }
    } else if (this.state === "vulnerable" && now >= this.vulnUntil) {
      this.state = "idle";
      return "recovered";
    }
    return null;
  }

  /** Shields left after this one (for the HUD). */
  get remaining() {
    return this.cfg.thresholds.length - this.next;
  }
}
