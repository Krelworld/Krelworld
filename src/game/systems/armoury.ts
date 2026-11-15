import type { GameState } from "../../data/types";
import { GUNS, GUN_POWER, type GunDef } from "../../data/guns";
import { PRIZES } from "../../content/kreddle";

// The armoury's rules, kept free of Phaser so they can be tested: ammo prices, the
// player's weapon order (the gun rack), the 1-5 stat ratings and the gun upgrades.

/** Kreddle Exchange perks (the PERKS tab). */
export const BANK_PERKS = [
  { id: "pk_armor", name: "Krez-Proof Vest", desc: "Armour: take 10% less damage per level. Hi-vis. Smells of Lynx Africa.", cost: 170, max: 3 },
  { id: "pk_krezz", name: "Krezz Regeneration Serum", desc: "Krezz refills 30% faster per level (specials come back sooner).", cost: 190, max: 3 },
  { id: "pk_meter", name: "Pre-Workout (Bootleg)", desc: "Wonk and Fart meters fill 30% faster per level.", cost: 160, max: 2 },
  { id: "pk_ibs", name: "Prescription Beans", desc: "IBS Attack hits 25% harder per level, and the Fart meter fills 15% faster. Doctor's orders. Not a real doctor.", cost: 210, max: 3 },
  { id: "pk_jet", name: "STD KREZZ", desc: "Your Krezz jet stream (a perfect Wonk) is now riddled with little scowling bacteria. Hits 25% harder per level; Wonk meter fills 15% faster.", cost: 210, max: 3 },
  { id: "pk_autoaim", name: "Auto-Aim (Krezz-Assist)", desc: "Your attacks and guns lock onto the nearest enemy automatically.", cost: 300, max: 1 },
  { id: "pk_spd", name: "Fresh Trainers", desc: "+7% movement speed per level. Krunch-approved. Smell of new.", cost: 140, max: 3 },
  { id: "pk_dmg", name: "Krunch Gym Membership", desc: "+8% damage from everything per level. You don't go. You just have it.", cost: 160, max: 3 },
  { id: "pk_rof", name: "Itchy Trigger Finger", desc: "Guns fire 10% faster per level.", cost: 150, max: 3 },
  { id: "pk_ammo", name: "Bigger Pockets", desc: "+25% max ammo for every gun per level. Krez-ousers with cargo pockets.", cost: 180, max: 2 },
  { id: "pk_dodge", name: "Ninja Backflip Lessons", desc: "Dodge cooldown -15% per level. Taught by Flenky. Got out just in time.", cost: 170, max: 2 },
];

// ------------------------------------------------------------------ ammo (the Kreddle Exchange's prices)

/** Max ammo after the Bigger Pockets perk. */
export function gunMaxFor(g: GunDef, s: GameState): number {
  return Math.round(g.maxAmmo * (1 + 0.25 * (s.upgrades?.pk_ammo ?? 0)));
}

/** Price of one box of ammo (g.pickup rounds) for a gun at the Kreddle Exchange. */
export function ammoUnitCost(id: string): number {
  const g = GUNS[id];
  return g.shop ? Math.max(20, Math.round(g.shop * 0.08)) : Math.max(10, Math.round(g.pickup * 0.8));
}

/** What topping a gun up costs: boxes to fill it, the price of that, and one box's price. */
export function ammoQuote(s: GameState, id: string): { have: number; max: number; unit: number; boxes: number; fill: number; full: boolean } {
  const g = GUNS[id];
  const have = s.guns?.[id] ?? 0;
  const max = gunMaxFor(g, s);
  const unit = ammoUnitCost(id);
  const boxes = Math.max(0, Math.ceil((max - have) / g.pickup));
  return { have, max, unit, boxes, fill: boxes * unit, full: have >= max };
}

/**
 * Buy as many boxes as it takes to fill the gun (or as many as you can afford).
 * Returns how many boxes were bought (0 = nothing happened: full, broke, or not owned).
 */
export function buyAmmo(s: GameState, id: string): number {
  const g = GUNS[id];
  if (!g || !s.guns || !(id in s.guns)) return 0;
  const unit = ammoUnitCost(id);
  let bought = 0;
  while (s.guns[id] < gunMaxFor(g, s) && s.coins >= unit) {
    s.coins -= unit;
    s.guns[id] = Math.min(gunMaxFor(g, s), s.guns[id] + g.pickup);
    bought++;
  }
  if (bought && (!s.gun || (s.guns[s.gun] ?? 0) <= 0)) s.gun = id;
  return bought;
}

// ------------------------------------------------------------------ the weapon order (gun rack)

/**
 * Owned guns in the player's order: s.gunOrder first, then anything owned but not in it,
 * strongest first. With no order saved this is simply strongest first.
 */
export function orderedGuns(s: GameState): string[] {
  const out: string[] = [];
  const owned = (id: string) => !!s.guns && id in s.guns && id in GUNS && !out.includes(id);
  for (const id of s.gunOrder ?? []) if (owned(id)) out.push(id);
  for (const id of GUN_POWER) if (owned(id)) out.push(id);
  for (const id of Object.keys(s.guns ?? {})) if (owned(id)) out.push(id);
  return out;
}

/** Move a gun to position `to` in the order (clamped). Saves the whole order on the state. */
export function moveGun(s: GameState, id: string, to: number): string[] {
  const list = orderedGuns(s).filter((g) => g !== id);
  if (!s.guns || !(id in s.guns)) return orderedGuns(s);
  list.splice(Math.max(0, Math.min(list.length, Math.round(to))), 0, id);
  s.gunOrder = list;
  return list;
}

/** The first gun in your order that has ammo (skipping `except`), or null for the Fart Blaster. */
export function firstLoaded(s: GameState, except?: string): string | null {
  for (const id of orderedGuns(s)) if (id !== except && (s.guns![id] ?? 0) > 0) return id;
  return null;
}

/** After `from` runs dry: the next gun along in your order that has ammo (wrapping round), or null. */
export function nextLoaded(s: GameState, from?: string): string | null {
  const list = orderedGuns(s);
  const i = from ? list.indexOf(from) : -1;
  for (let k = 1; k <= list.length; k++) {
    const id = list[(i + k + list.length) % list.length];
    if (id !== from && (s.guns![id] ?? 0) > 0) return id;
  }
  return null;
}

// ------------------------------------------------------------------ stat ratings (1-5)

export type StatKey = "damage" | "rate" | "range" | "accuracy" | "special";
export const STAT_LABELS: Record<StatKey, string> = { damage: "DAMAGE", rate: "FIRE RATE", range: "RANGE", accuracy: "ACCURACY", special: "SPECIAL" };
export const STAT_KEYS: StatKey[] = ["damage", "rate", "range", "accuracy", "special"];

/** The raw number each rating is based on (bigger = better). */
export function rawStats(g: GunDef): Record<StatKey, number> {
  return {
    damage: g.dmg * g.pellets,
    rate: 1000 / g.cd,
    range: g.range,
    accuracy: -g.spread,
    // going through people, blowing up, and shoving them about
    special: Math.min(g.pierce ?? 0, 10) * 8 + (g.blast ?? 0) + (g.knock ?? 0) / 4,
  };
}

// damage and fire rate span two orders of magnitude, so they're compared on a log scale
const LOG: Record<StatKey, boolean> = { damage: true, rate: true, range: false, accuracy: false, special: false };

/** Map v from [min, max] onto whole pips 1..5 (min -> 1, max -> 5). */
export function toPips(v: number, min: number, max: number): number {
  if (!(max > min)) return 3;
  const t = (v - min) / (max - min);
  return Math.max(1, Math.min(5, Math.round(1 + 4 * t)));
}

/** Every stat for one gun as 1-5 pips, normalised across all the guns in `all` (default: every gun in the game). */
export function gunRatings(g: GunDef, all: GunDef[] = Object.values(GUNS)): Record<StatKey, number> {
  const raw = rawStats(g);
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    const f = (x: number) => (LOG[k] ? Math.log(x) : x);
    const vals = all.map((o) => f(rawStats(o)[k]));
    out[k] = toPips(f(raw[k]), Math.min(...vals), Math.max(...vals));
  }
  return out;
}

/** "Pierce 3 · Blast 85 · Knockback 220" (or "None"). */
export function specialText(g: GunDef): string {
  const bits: string[] = [];
  if (g.pellets > 1) bits.push(`${g.pellets} pellets`);
  if (g.pierce) bits.push(g.pierce >= 99 ? "Pierces everything" : `Pierce ${g.pierce}`);
  if (g.blast) bits.push(`Blast ${g.blast}`);
  if (g.knock) bits.push(`Knockback ${g.knock}`);
  return bits.length ? bits.join(" · ") : "Nothing fancy";
}

// ------------------------------------------------------------------ gun upgrades

export interface GunUpgrade {
  key: string;
  name: string;
  max: number;
  /** Where it's bought. */
  shop: "Kreddle Exchange" | "Kreddle Prize Counter";
}

/** Everything you can buy that changes your guns (they apply to every gun you own). */
export const GUN_UPGRADES: GunUpgrade[] = [
  ...["pk_rof", "pk_ammo", "pk_dmg", "pk_autoaim"].map((id) => {
    const p = BANK_PERKS.find((b) => b.id === id)!;
    return { key: p.id, name: p.name, max: p.max, shop: "Kreddle Exchange" as const };
  }),
  ...["gold", "tracer", "jackpot"].map((id) => {
    const p = PRIZES.find((x) => x.id === id)!;
    return { key: p.key!, name: p.name, max: p.max ?? 1, shop: "Kreddle Prize Counter" as const };
  }),
];

/** Which gun upgrades you have (with levels), and which you could still buy. */
export function gunUpgrades(s: GameState): { applied: { u: GunUpgrade; lvl: number }[]; available: GunUpgrade[] } {
  const applied: { u: GunUpgrade; lvl: number }[] = [];
  const available: GunUpgrade[] = [];
  for (const u of GUN_UPGRADES) {
    const lvl = s.upgrades?.[u.key] ?? 0;
    if (lvl > 0) applied.push({ u, lvl });
    if (lvl < u.max) available.push(u);
  }
  return { applied, available };
}
