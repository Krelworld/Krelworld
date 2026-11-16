import type { GameState } from "../../data/types";
import { FART_BLASTER, GUNS, GUN_ORDER, GUN_POWER, type GunDef } from "../../data/guns";
import { PRIZES } from "../../content/kreddle";

// The armoury's rules, kept free of Phaser so they can be tested: ammo prices, the
// player's weapon order (the gun rack), the 1-5 stat ratings and the gun upgrades.

/**
 * Kreddle Exchange perks (the PERKS tab). Level n costs `cost * n`. The ones that really change a fight
 * (auto-aim, damage, armour, fire rate) are priced to need saving for; see docs/ECONOMY.md.
 * `icon` is a texture key (p_*) or an emoji; `desc` is one short line for the shop.
 */
export const BANK_PERKS = [
  { id: "pk_armor", name: "Krez-Proof Vest", icon: "🦺", desc: "Take 10% less damage per level. Smells of Lynx Africa.", cost: 260, max: 3 },
  { id: "pk_krezz", name: "Krezz Serum", icon: "p_krezz", desc: "Krezz refills 30% faster per level: specials come back sooner.", cost: 160, max: 3 },
  { id: "pk_meter", name: "Pre-Workout", icon: "🥤", desc: "Wonk and Fart meters fill 30% faster per level. Bootleg.", cost: 150, max: 2 },
  { id: "pk_ibs", name: "Prescription Beans", icon: "🫘", desc: "IBS Attack +25% damage per level, Fart meter +15%. Not a real doctor.", cost: 180, max: 3 },
  { id: "pk_jet", name: "STD KREZZ", icon: "🦠", desc: "Krezz jet stream +25% damage per level, Wonk meter +15%. Scowling bacteria.", cost: 180, max: 3 },
  { id: "pk_autoaim", name: "Auto-Aim", icon: "🎯", desc: "Attacks and guns lock onto the nearest enemy by themselves.", cost: 1500, max: 1 },
  { id: "pk_spd", name: "Fresh Trainers", icon: "👟", desc: "+7% movement speed per level. Smell of new.", cost: 120, max: 3 },
  { id: "pk_dmg", name: "Krunch Gym", icon: "🏋️", desc: "+8% damage from everything per level. You don't go. You just have it.", cost: 300, max: 3 },
  { id: "pk_rof", name: "Itchy Trigger Finger", icon: "☝️", desc: "Guns fire 10% faster per level.", cost: 220, max: 3 },
  { id: "pk_ammo", name: "Bigger Pockets", icon: "🎒", desc: "+25% max ammo for every gun per level. Cargo Krez-ousers.", cost: 150, max: 2 },
  { id: "pk_dodge", name: "Backflip Lessons", icon: "🤸", desc: "Dodge cooldown -15% per level. Taught by Flenky.", cost: 160, max: 2 },
];

// ------------------------------------------------------------------ ammo (the Kreddle Exchange's prices)

/** Max ammo after the Bigger Pockets perk and the gun's own Extended Mag mod. */
export function gunMaxFor(g: GunDef, s: GameState): number {
  return Math.round(g.maxAmmo * (1 + 0.25 * (s.upgrades?.pk_ammo ?? 0) + MOD_EFFECT.mag * modLevel(s, g.id, "mag")));
}

/**
 * Price of one box of ammo (g.pickup rounds) for a gun at the Kreddle Exchange: the gun's own `ammoPrice`
 * (set by what a box can actually do: damage, pierce, blast), else a fallback from its damage.
 */
export function ammoUnitCost(id: string): number {
  const g = GUNS[id];
  if (g.ammoPrice) return g.ammoPrice;
  return Math.max(10, Math.round((g.pickup * g.dmg * g.pellets) / 25));
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
  if (g.blast) bits.push(`Blast ${Math.round(g.blast)}`);
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

// ------------------------------------------------------------------ per-gun mods (the Kreddle Exchange's GUN MODS tab)

/** What a gun mod can change. Each gun only offers the ones that suit it (GUN_MODS). */
export type ModStat = "dmg" | "rof" | "mag" | "spread" | "pierce" | "blast" | "pellets" | "range" | "homing" | "luck";

/** Per level: dmg/range/blast/mag are +fractions, rof/spread are -fractions, pierce/pellets +1, homing is turn rate, luck is per gun. */
export const MOD_EFFECT: Record<ModStat, number> = { dmg: 0.12, rof: 0.08, mag: 0.25, spread: 0.2, pierce: 1, blast: 0.15, pellets: 1, range: 0.15, homing: 0.8, luck: 1 };

export const MOD_INFO: Record<ModStat, { name: string; short: string; icon: string; desc: string; weight: number }> = {
  dmg: { name: "Hollow Points", short: "DAMAGE", icon: "💥", desc: "+12% damage per level.", weight: 1 },
  rof: { name: "Hair Trigger", short: "FIRE RATE", icon: "⚡", desc: "Fires 8% faster per level.", weight: 1.1 },
  mag: { name: "Extended Mag", short: "AMMO", icon: "🧰", desc: "+25% max ammo per level.", weight: 0.6 },
  spread: { name: "Steady Grip", short: "ACCURACY", icon: "🎯", desc: "20% tighter spread per level.", weight: 0.5 },
  pierce: { name: "Tungsten Tips", short: "PIERCE", icon: "🔩", desc: "Each shot goes through one more enemy per level.", weight: 0.8 },
  blast: { name: "Bigger Bang", short: "BLAST", icon: "🧨", desc: "+15% explosion radius per level.", weight: 0.9 },
  pellets: { name: "Extra Pellets", short: "PELLETS", icon: "➕", desc: "One more projectile per shot per level.", weight: 1.2 },
  range: { name: "Long Barrel", short: "RANGE", icon: "📏", desc: "+15% range per level.", weight: 0.5 },
  homing: { name: "Heat-Seeking Chips", short: "HOMING", icon: "🧲", desc: "Shots turn harder towards enemies per level.", weight: 0.8 },
  luck: { name: "Rigged Odds", short: "LUCK", icon: "🍀", desc: "Its gamble pays out more often per level.", weight: 0.9 },
};

/** What each luck level does, per gun (shown in the shop). */
export const LUCK_TEXT: Record<string, string> = {
  slots: "Jackpots (777) +5% likelier per level.",
  roulette: "The green zero +4% likelier per level.",
  loan: "Collects interest 10% more often per level.",
  dice: "Every die rolls +1 higher per level (still max 6).",
};

/** The Fart Blaster's id in the mod tables. */
export const FART_ID = "fart";

/** Every gun's mods: a price base (roughly what the gun's worth) and the max level of each stat it offers. */
export const GUN_MODS: Record<string, { base: number; mods: Partial<Record<ModStat, number>> }> = {
  fart: { base: 40, mods: { dmg: 5, rof: 3, range: 2, pierce: 2 } },
  pistol: { base: 40, mods: { dmg: 5, rof: 3, mag: 2, range: 2 } },
  smg: { base: 45, mods: { dmg: 5, rof: 3, mag: 3, spread: 3 } },
  shotgun: { base: 50, mods: { dmg: 5, rof: 3, pellets: 3, spread: 2, mag: 2 } },
  rail: { base: 60, mods: { dmg: 5, rof: 3, mag: 2 } },
  rocket: { base: 70, mods: { dmg: 5, rof: 3, blast: 4, mag: 2 } },
  gatling: { base: 70, mods: { dmg: 5, rof: 3, mag: 3, spread: 3 } },
  sniper: { base: 70, mods: { dmg: 5, rof: 3, pierce: 3, mag: 2 } },
  boggor_lens: { base: 70, mods: { dmg: 5, rof: 3, blast: 3, pellets: 2 } },
  flamer: { base: 75, mods: { dmg: 5, rof: 3, range: 3, mag: 3 } },
  chem_flamer: { base: 90, mods: { dmg: 3, range: 2 } },
  bfk: { base: 110, mods: { dmg: 5, rof: 3, blast: 4, mag: 3 } },
  chainsaw: { base: 70, mods: { dmg: 5, rof: 3, range: 2, pierce: 3 } },
  kreddler: { base: 85, mods: { dmg: 5, rof: 3, mag: 3, spread: 3 } },
  disco: { base: 85, mods: { dmg: 5, rof: 3, blast: 4, mag: 2 } },
  flush: { base: 75, mods: { dmg: 5, rof: 3, pellets: 3, pierce: 3 } },
  slots: { base: 80, mods: { dmg: 5, rof: 3, mag: 3, luck: 4 } },
  roulette: { base: 85, mods: { dmg: 5, rof: 3, pellets: 3, luck: 3 } },
  chips: { base: 80, mods: { dmg: 5, rof: 3, pellets: 2, homing: 3 } },
  loan: { base: 85, mods: { dmg: 5, rof: 3, pierce: 3, luck: 3 } },
  dice: { base: 95, mods: { dmg: 5, rof: 3, blast: 4, luck: 3 } },
};

const MOD_ORDER: ModStat[] = ["dmg", "rof", "mag", "spread", "range", "pierce", "pellets", "blast", "homing", "luck"];

/** The s.upgrades key for one gun mod (old saves just don't have it: level 0). */
export function modKey(gun: string, stat: ModStat): string {
  return `gm_${gun}_${stat}`;
}

export function modLevel(s: GameState, gun: string, stat: ModStat): number {
  return s.upgrades?.[modKey(gun, stat)] ?? 0;
}

export function modMax(gun: string, stat: ModStat): number {
  return GUN_MODS[gun]?.mods[stat] ?? 0;
}

/** Price of the NEXT level (`lvl` = the level you have now): rounded to 5, climbing faster each level. */
export function modPrice(gun: string, stat: ModStat, lvl: number): number {
  const base = (GUN_MODS[gun]?.base ?? 60) * MOD_INFO[stat].weight;
  return Math.round((base * (1 + 0.6 * lvl + 0.15 * lvl * lvl)) / 5) * 5;
}

/** The mods a gun offers, in a fixed order, with your level and the next level's price. */
export function gunModList(s: GameState, gun: string): { stat: ModStat; lvl: number; max: number; price: number }[] {
  const m = GUN_MODS[gun]?.mods ?? {};
  return MOD_ORDER.filter((k) => m[k]).map((stat) => {
    const lvl = modLevel(s, gun, stat);
    return { stat, lvl, max: m[stat]!, price: modPrice(gun, stat, lvl) };
  });
}

/** Buy the next level of a mod (you must own the gun; the Fart Blaster is always yours). True if it went through. */
export function buyMod(s: GameState, gun: string, stat: ModStat): boolean {
  const lvl = modLevel(s, gun, stat);
  if (lvl >= modMax(gun, stat)) return false;
  if (gun !== FART_ID && !(s.guns && gun in s.guns)) return false;
  const price = modPrice(gun, stat, lvl);
  if (s.coins < price) return false;
  s.coins -= price;
  s.upgrades[modKey(gun, stat)] = lvl + 1;
  return true;
}

/** The guns you can mod right now: the Fart Blaster, then everything you own (in the game's gun order). */
export function moddableGuns(s: GameState): string[] {
  return [FART_ID, ...GUN_ORDER.filter((id) => !!s.guns && id in s.guns && !!GUN_MODS[id])];
}

/** "DAMAGE 2/5 · FIRE RATE 1/3" for the rack ("" if nothing bought). */
export function modSummary(s: GameState, gun: string): string {
  return gunModList(s, gun)
    .filter((m) => m.lvl > 0)
    .map((m) => `${MOD_INFO[m.stat].short} ${m.lvl}/${m.max}`)
    .join(" · ");
}

/** A gun's stats with its mods applied (what's actually fired). Max ammo is in gunMaxFor; luck is read where it's fired. */
export function moddedGun(g: GunDef, s: GameState): GunDef {
  const l = (k: ModStat) => modLevel(s, g.id, k);
  const out: GunDef = { ...g };
  out.dmg = g.dmg * (1 + MOD_EFFECT.dmg * l("dmg"));
  out.cd = g.cd * Math.max(0.4, 1 - MOD_EFFECT.rof * l("rof"));
  out.spread = g.spread * Math.max(0, 1 - MOD_EFFECT.spread * l("spread"));
  out.range = g.range * (1 + MOD_EFFECT.range * l("range"));
  if (l("pierce")) out.pierce = (g.pierce ?? 0) + l("pierce");
  if (g.blast) out.blast = g.blast * (1 + MOD_EFFECT.blast * l("blast"));
  out.pellets = g.pellets + l("pellets");
  if (g.homing || l("homing")) out.homing = (g.homing ?? 0) + MOD_EFFECT.homing * l("homing");
  return out;
}

/** The Fart Blaster with its mods applied. */
export function moddedFart(s: GameState): { dmg: number; cd: number; speed: number; range: number; pierce: number } {
  const l = (k: ModStat) => modLevel(s, FART_ID, k);
  return {
    dmg: FART_BLASTER.dmg * (1 + MOD_EFFECT.dmg * l("dmg")),
    cd: FART_BLASTER.cd * (1 - MOD_EFFECT.rof * l("rof")),
    speed: FART_BLASTER.speed,
    range: FART_BLASTER.range * (1 + MOD_EFFECT.range * l("range")),
    pierce: l("pierce"),
  };
}
