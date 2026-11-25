import type { Actor, Id, Item, ItemDef, ItemLoc, Prop, WorldState } from "./types";

export const POCKET_SLOTS = 3;

/** Starter catalogue. Kept small on purpose: few items, many uses. */
export const ITEM_DEFS: Record<string, ItemDef> = Object.fromEntries(
  ([
    { id: "pint", name: "Pint of lager", props: ["liquid", "consumable", "alcohol", "throwable", "spikable"], size: "large", price: 6, colour: 0xe8b84a },
    { id: "pie", name: "Meat pie", props: ["food", "consumable", "throwable", "spikable"], size: "small", price: 4, colour: 0xc58a3e },
    { id: "knife", name: "Kitchen knife", props: ["sharp", "weapon", "metal", "throwable"], size: "small", colour: 0xc9d1d9 },
    { id: "whistle", name: "Referee's whistle", props: ["noisy", "metal"], size: "small", authority: 1, colour: 0x222222 },
    { id: "ticket", name: "Match ticket", props: ["credential"], size: "small", price: 60, colour: 0xf2f2f2 },
    { id: "wallet", name: "Wallet", props: ["valuable"], size: "small", colour: 0x5a3b26 },
    { id: "laxative", name: "Laxative", props: ["substance"], size: "small", effect: "laxative", colour: 0x7fd1c7 },
    { id: "powder", name: "Suspicious white powder", props: ["substance", "illicit"], size: "small", effect: "wired", colour: 0xffffff },
    { id: "shirt_eng", name: "England shirt", props: ["wearable"], size: "large", slot: "inner", team: "ENG", role: "fan", price: 45, colour: 0xf4f4f4, colour2: 0x1b2a6b },
    { id: "shirt_opp", name: "Opposition shirt", props: ["wearable"], size: "large", slot: "outer", team: "OPP", role: "fan", price: 45, colour: 0xb3122a, colour2: 0x0b6b3a },
    { id: "hivis", name: "Hi-vis vest", props: ["wearable"], size: "large", slot: "outer", role: "steward", authority: 1, colour: 0xd9e021, colour2: 0x9aa31a },
    { id: "ref_kit", name: "Referee's kit", props: ["wearable"], size: "large", slot: "outer", role: "referee", authority: 3, colour: 0x15171a, colour2: 0xf2c94c },
    { id: "police_hat", name: "Police helmet", props: ["wearable"], size: "large", slot: "head", role: "police", authority: 2, colour: 0x101830 },
    { id: "mask", name: "Novelty mask", props: ["wearable"], size: "small", slot: "face", price: 8, colour: 0xf0a0c0 },
    // Fixtures: too big to carry, but they can be used, spiked or hidden in.
    { id: "lorry_cargo", name: "Back of the beer lorry", props: ["container"], size: "huge" },
    { id: "cooler_home", name: "England's water", props: ["spikable"], size: "huge", colour: 0x3a6fd8 },
    { id: "cooler_away", name: "Opposition water", props: ["spikable"], size: "huge", colour: 0xd83a4a },
    { id: "tea_urn", name: "Referee's tea urn", props: ["spikable"], size: "huge", colour: 0xa0a0a0 },
    { id: "locker", name: "Confiscation locker", props: ["container"], size: "huge", colour: 0x555b66 },
  ] as ItemDef[]).map((d) => [d.id, d]),
);

export const defOf = (it: Item): ItemDef => ITEM_DEFS[it.def];
export const hasProp = (it: Item, p: Prop): boolean => defOf(it).props.includes(p);

export function spawnItem(s: WorldState, def: string, loc: ItemLoc): Item {
  if (!ITEM_DEFS[def]) throw new Error(`unknown item ${def}`);
  const it: Item = { id: `i${s.nextId++}`, def, loc: { k: "gone" } };
  s.items[it.id] = it;
  moveItem(s, it.id, loc);
  return it;
}

/** Detach an item from wherever it is. */
function detach(s: WorldState, it: Item): void {
  const l = it.loc;
  if (l.k === "hand") { const a = s.actors[l.a]; if (a && a.hand === it.id) a.hand = null; }
  else if (l.k === "pocket") { const a = s.actors[l.a]; if (a) a.pockets = a.pockets.filter((i) => i !== it.id); }
  else if (l.k === "worn") { const a = s.actors[l.a]; if (a && a.worn[l.slot] === it.id) delete a.worn[l.slot]; }
}

/** The single place an item's location changes, so actors and items never disagree. */
export function moveItem(s: WorldState, id: Id, loc: ItemLoc): void {
  const it = s.items[id];
  detach(s, it);
  if (loc.k === "hand") s.actors[loc.a].hand = id;
  else if (loc.k === "pocket") s.actors[loc.a].pockets.push(id);
  else if (loc.k === "worn") s.actors[loc.a].worn[loc.slot] = id;
  it.loc = loc;
}

export const canPocket = (a: Actor, it: Item) => defOf(it).size === "small" && a.pockets.length < POCKET_SLOTS;

/** Items an onlooker can see on this actor: whatever is in hand or worn. Pockets are hidden. */
export function visibleItems(s: WorldState, a: Actor): Item[] {
  const out: Item[] = [];
  if (a.hand) out.push(s.items[a.hand]);
  for (const id of Object.values(a.worn)) if (id) out.push(s.items[id]);
  return out;
}

export function carried(s: WorldState, a: Actor): Item[] {
  return [...visibleItems(s, a), ...a.pockets.map((i) => s.items[i])];
}
