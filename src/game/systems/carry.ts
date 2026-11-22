import type { CarriedLoadout, GameState, PlayableId } from "../../data/types";
import { CHARACTERS } from "../../data/characters";
import { GUNS } from "../../data/guns";
import { gunMaxFor } from "./armoury";

// "Finish the game and keep your kit": the loadout you finished with is saved on the meta (survives new runs)
// and every new game starts with it. Kept free of Phaser so it can be tested.
//
// Carried: guns (topped up to full), the gun in hand, the gun-rack order, everything in s.upgrades
// (stat upgrades, bank perks and moves, Kreddle prizes, gun mods, home decor, fairies…), coins, bottles, bongos.
// Not carried: story flags, chapter, quests, relationships, kills, Krezz/HP (they refill), the ban sheet,
// intoxication, and the Chemical Flamethrower (it belongs to the Kreddle raid). Another lad's skill-tree
// branch doesn't come with you if you finish as one lad and start as another.

/** Guns that never carry over (story items). */
export const NO_CARRY_GUNS = new Set(["chem_flamer"]);

const num = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

/** Snapshot the finishing kit. Null for debug-mode runs (their god kit isn't earned). */
export function snapshotLoadout(s: GameState, now = Date.now()): CarriedLoadout | null {
  if (s.flags?.debug_mode) return null;
  const guns: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.guns ?? {})) if (id in GUNS && !NO_CARRY_GUNS.has(id)) guns[id] = Math.max(0, num(n));
  const upgrades: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.upgrades ?? {})) if (typeof v === "number" && isFinite(v) && v > 0) upgrades[k] = v;
  return {
    from: s.player,
    guns,
    gun: s.gun && s.gun in guns ? s.gun : undefined,
    gunOrder: (s.gunOrder ?? []).filter((g) => g in guns),
    upgrades,
    coins: Math.max(0, Math.floor(num(s.coins))),
    bottles: Math.max(0, Math.floor(num(s.bottles))),
    bongos: Math.max(0, Math.floor(num(s.bongos))),
    at: now,
  };
}

/** Repair a loadout read from storage (old or hand-edited saves): null if it's unusable. */
export function sanitizeLoadout(raw: any): CarriedLoadout | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const from = CHARACTERS[raw.from]?.playable ? (raw.from as PlayableId) : "FLENKY";
  const guns: Record<string, number> = {};
  if (raw.guns && typeof raw.guns === "object")
    for (const [id, n] of Object.entries(raw.guns)) if (id in GUNS && !NO_CARRY_GUNS.has(id) && typeof n === "number" && isFinite(n)) guns[id] = Math.max(0, n);
  const upgrades: Record<string, number> = {};
  if (raw.upgrades && typeof raw.upgrades === "object")
    for (const [k, v] of Object.entries(raw.upgrades)) if (typeof v === "number" && isFinite(v) && v > 0) upgrades[k] = v;
  return {
    from,
    guns,
    gun: typeof raw.gun === "string" && raw.gun in guns ? raw.gun : undefined,
    gunOrder: Array.isArray(raw.gunOrder) ? [...new Set<string>(raw.gunOrder.filter((g: unknown) => typeof g === "string" && g in guns))] : [],
    upgrades,
    coins: Math.max(0, Math.floor(num(raw.coins))),
    bottles: Math.max(0, Math.floor(num(raw.bottles))),
    bongos: Math.max(0, Math.floor(num(raw.bongos))),
    at: num(raw.at),
  };
}

/** Skill-tree upgrade ids that belong to some other lad than `player`. */
function otherBranchIds(player: PlayableId): Set<string> {
  const out = new Set<string>();
  const mine = new Set((CHARACTERS[player]?.branch ?? []).map((b) => b.id));
  for (const c of Object.values(CHARACTERS)) for (const b of c.branch ?? []) if (!mine.has(b.id)) out.add(b.id);
  return out;
}

/** Give a fresh run the carried kit (guns filled to the brim). Story state is untouched. */
export function applyLoadout(s: GameState, lo: CarriedLoadout | null | undefined): boolean {
  if (!lo) return false;
  const skip = lo.from === s.player ? new Set<string>() : otherBranchIds(s.player);
  for (const [k, v] of Object.entries(lo.upgrades)) if (!skip.has(k)) s.upgrades[k] = Math.max(s.upgrades[k] ?? 0, v);
  s.guns = s.guns ?? {};
  for (const [id, n] of Object.entries(lo.guns)) {
    const g = GUNS[id];
    if (!g || NO_CARRY_GUNS.has(id)) continue;
    s.guns[id] = Math.max(s.guns[id] ?? 0, n, gunMaxFor(g, s));
  }
  s.gunOrder = [...lo.gunOrder.filter((g) => g in s.guns!), ...(s.gunOrder ?? []).filter((g) => !lo.gunOrder.includes(g))];
  if (lo.gun && lo.gun in s.guns) s.gun = lo.gun;
  s.coins = Math.max(s.coins, lo.coins);
  s.bottles = Math.max(s.bottles, lo.bottles);
  s.bongos = Math.max(s.bongos, lo.bongos);
  return true;
}

/** One line for the menus: what came with you. */
export function loadoutSummary(lo: CarriedLoadout): string {
  const guns = Object.keys(lo.guns).length;
  const ups = Object.keys(lo.upgrades).length;
  return `${guns} gun${guns === 1 ? "" : "s"} · ${ups} upgrade${ups === 1 ? "" : "s"} · ${lo.coins} coins`;
}
