import { G } from "../G";
import type { GameState } from "../../data/types";
import { PRIZES, PRIZE, type Prize } from "../../content/kreddle";
import { GUNS, gunMax } from "../combat/Guns";

/** Upgrade level for a Kreddle prize key (0 if you've not won it). */
export function kd(s: GameState, key: string): number {
  return s.upgrades?.[key] ?? 0;
}

/** Gore mode (blood, dismemberment): on by default, switched off in Settings. */
export function extraViolence(_s?: GameState): boolean {
  return G.meta.settings.gore !== false;
}

/** Can this prize still do something for you? (Guns can always be won again: it's a refill.) */
export function prizeOpen(s: GameState, p: Prize): boolean {
  if (p.gun) return true;
  return kd(s, p.key!) < (p.max ?? 1);
}

/** A random prize, leaning towards things you don't have yet. */
export function rollPrize(s: GameState, rnd: () => number = Math.random): Prize {
  const pool = PRIZES.filter((p) => prizeOpen(s, p));
  const weight = (p: Prize) => (p.gun ? (s.guns && p.gun in s.guns ? 0.4 : 1.4) : 1);
  const total = pool.reduce((a, p) => a + weight(p), 0);
  let r = rnd() * total;
  for (const p of pool) {
    r -= weight(p);
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

/** Hand over a prize. Returns the line to show. */
export function awardPrize(s: GameState, id: string): string {
  const p = PRIZE[id];
  if (!p) return "";
  if (p.gun) {
    s.guns = s.guns ?? {};
    const had = p.gun in s.guns;
    s.guns[p.gun] = gunMax(GUNS[p.gun], s);
    s.gun = p.gun;
    return had ? `${p.name}: already yours, so it's a full refill.` : `${p.name}: ${p.desc}`;
  }
  const key = p.key!;
  if (!prizeOpen(s, p)) {
    s.coins += 150;
    return `${p.name}: you've maxed it, so the House gives you 150 Krezzcoin instead. Grudgingly.`;
  }
  s.upgrades[key] = kd(s, key) + 1;
  const lvl = s.upgrades[key];
  return `${p.name}${(p.max ?? 1) > 1 ? ` (level ${lvl}/${p.max})` : ""}: ${p.desc}`;
}

// ---- KROKENS: Kreddle's prize tickets, won at the machines, spent at the Prize Counter

export function krokens(s: GameState): number {
  return (s.flags.krokens as number) ?? 0;
}

export function addKrokens(s: GameState, n: number) {
  s.flags.krokens = Math.max(0, krokens(s) + n);
}

/**
 * Prize Counter prices in Krokens: [first level, extra per level you already have]. Looks are cheap; the
 * things that keep you alive or win fights (armour, max HP, fairies, the big guns) cost a proper pile.
 */
export const KROKEN_PRICES: Record<string, [number, number]> = {
  violence: [10, 0], tracer: [10, 0],
  gas: [25, 10], krezzlong: [30, 10], krezz: [30, 10], super_time: [35, 10], slotfart: [35, 0], lucky: [35, 15],
  jackpot: [40, 0], dice: [40, 0], hp: [40, 15], super_aura: [45, 0], gold: [50, 0], armor: [50, 20], sperm: [60, 0], fairy: [60, 20],
  g_chainsaw: [60, 0], g_flush: [80, 0], g_kreddler: [100, 0], g_disco: [120, 0],
};
/** A gun you already own is just a refill. */
export const KROKEN_REFILL = 15;

/** What a prize costs at the Prize Counter. */
export function krokenPrice(s: GameState, p: Prize): number {
  if (p.gun && s.guns && p.gun in s.guns) return KROKEN_REFILL;
  const [base, step] = KROKEN_PRICES[p.id] ?? [40, 10];
  return base + (p.key ? step * kd(s, p.key) : 0);
}
