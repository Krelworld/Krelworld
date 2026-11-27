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
    { id: "shirt_opp", name: "Opposition shirt", props: ["wearable"], size: "large", slot: "outer", team: "OPP", role: "fan", price: 45, colour: 0x888888, colour2: 0x444444 },
    { id: "shirt_por", name: "Portugal shirt", props: ["wearable"], size: "large", slot: "outer", team: "POR", role: "fan", price: 45, colour: 0xb3122a, colour2: 0x0b6b3a },
    { id: "shirt_bra", name: "Brazil shirt", props: ["wearable"], size: "large", slot: "outer", team: "BRA", role: "fan", price: 45, colour: 0xf7d417, colour2: 0x1a7f3c },
    { id: "shirt_arg", name: "Argentina shirt", props: ["wearable"], size: "large", slot: "outer", team: "ARG", role: "fan", price: 45, colour: 0x7ec8f2, colour2: 0xffffff },
    { id: "police_uniform", name: "Police uniform", props: ["wearable"], size: "large", slot: "outer", role: "police", authority: 2, colour: 0x101830, colour2: 0xd9e021 },
    { id: "kit_eng", name: "England playing kit", props: ["wearable"], size: "large", slot: "outer", team: "ENG", role: "footballer", colour: 0xf4f4f4, colour2: 0x1b2a6b },
    { id: "kit_opp", name: "Opposition playing kit", props: ["wearable"], size: "large", slot: "outer", team: "OPP", role: "footballer", colour: 0x888888, colour2: 0x444444 },
    { id: "kit_hamper", name: "Kit hamper", props: ["container"], size: "huge", colour: 0x8a6a40 },
    { id: "bus_hold", name: "Luggage hold of the team bus", props: ["container"], size: "huge" },
    { id: "bus_cab", name: "Team bus", props: ["container"], size: "huge" },
    { id: "police_box", name: "Kit box in the police van", props: ["container"], size: "huge", colour: 0x22305a },
    { id: "bicycle", name: "Bicycle", props: ["rideable"], size: "huge", colour: 0xa02020 },
    { id: "radio", name: "Walkie-talkie", props: [], size: "small", colour: 0x222222 },
    { id: "brick", name: "Brick", props: ["throwable", "weapon"], size: "small", colour: 0xa0442c, range: 13 },
    { id: "fart_can", name: "Fart canister", props: ["throwable"], size: "small", price: 15, colour: 0x7a9a2a, range: 17 },
    { id: "rifle", name: "Sniper rifle", props: ["gun"], size: "large", colour: 0x2a2d22 },
    { id: "warrant_card", name: "Police warrant card", props: ["credential"], size: "small", colour: 0x1c2a4a },
    { id: "burner", name: "Burner phone", props: [], size: "small", price: 25, colour: 0x333a40 },
    { id: "staff_pass", name: "Staff pass on a lanyard", props: ["credential"], size: "small", colour: 0x3a7bd5 },
    { id: "hivis", name: "Hi-vis vest", props: ["wearable"], size: "large", slot: "outer", role: "steward", authority: 1, colour: 0xd9e021, colour2: 0x9aa31a },
    { id: "ref_kit", name: "Referee's kit", props: ["wearable"], size: "large", slot: "outer", role: "referee", authority: 3, colour: 0x15171a, colour2: 0xf2c94c },
    { id: "police_hat", name: "Police helmet", props: ["wearable"], size: "large", slot: "head", role: "police", authority: 2, colour: 0x101830 },
    { id: "mask", name: "Novelty mask", props: ["wearable"], size: "small", slot: "face", price: 8, colour: 0xf0a0c0, faceCover: 1 },
    // From the charity shop.
    { id: "flat_cap", name: "Flat cap", props: ["wearable"], size: "small", slot: "head", price: 6, colour: 0x6b5a45, faceCover: 0.15 },
    { id: "sunglasses", name: "Sunglasses", props: ["wearable"], size: "small", slot: "face", price: 5, colour: 0x111111, faceCover: 0.5 },
    { id: "wig", name: "Wig", props: ["wearable"], size: "small", slot: "head", price: 9, colour: 0x5a3a22, faceCover: 0.3 },
    { id: "long_wig", name: "Long blonde wig", props: ["wearable"], size: "small", slot: "head", price: 12, colour: 0xe8c86a, faceCover: 0.35 },
    { id: "dress", name: "Floral dress", props: ["wearable"], size: "large", slot: "outer", role: "fan", price: 15, colour: 0xe58fb8, colour2: 0xf6e3a1, faceCover: 0.2 },
    { id: "moustache", name: "Stick-on moustache", props: ["wearable"], size: "small", slot: "face", price: 3, colour: 0x3a2a1a, faceCover: 0.35 },
    { id: "tracksuit", name: "Grey tracksuit top", props: ["wearable"], size: "large", slot: "outer", price: 12, colour: 0x8a8f96, colour2: 0x5a5f66 },
    { id: "chef_whites", name: "Chef's whites", props: ["wearable"], size: "large", slot: "outer", role: "catering", authority: 1, price: 18, colour: 0xf3f1ea, colour2: 0xcfcac0 },
    { id: "overalls", name: "Cleaner's overalls", props: ["wearable"], size: "large", slot: "outer", role: "cleaner", authority: 1, price: 15, colour: 0x5f7a8f, colour2: 0x3f5a6f },
    // From the army surplus.
    { id: "balaclava", name: "Balaclava", props: ["wearable", "sinister"], size: "small", slot: "face", price: 10, colour: 0x1a1a1a, faceCover: 1 },
    { id: "hammer", name: "Claw hammer", props: ["weapon", "metal", "throwable"], size: "small", price: 14, colour: 0x8a6a40 },
    { id: "flare", name: "Smoke flare", props: ["throwable", "smoke", "illicit"], size: "small", price: 20, colour: 0xff5a36 },
    // Fixtures: too big to carry, but they can be used, spiked or hidden in.
    { id: "lorry_cargo", name: "Back of the beer lorry", props: ["container"], size: "huge" },
    { id: "cooler_home", name: "England's water", props: ["spikable"], size: "huge", colour: 0x3a6fd8 },
    { id: "cooler_away", name: "Opposition water", props: ["spikable"], size: "huge", colour: 0xd83a4a },
    { id: "tea_urn", name: "Referee's tea urn", props: ["spikable"], size: "huge", colour: 0xa0a0a0 },
    { id: "betslip", name: "Betting slip", props: ["valuable"], size: "small", colour: 0xf5e6a8 },
    // Taken from the dead.
    { id: "wrench", name: "Big wrench", props: ["weapon", "metal", "throwable"], size: "small", colour: 0x8a8f96 },
    { id: "bottle", name: "Empty bottle", props: ["weapon", "throwable", "breakable"], size: "small", colour: 0x5a3a1a },
    { id: "pint_glass", name: "Empty pint glass", props: ["weapon", "throwable", "breakable"], size: "small", colour: 0xd8d8c8 },
    { id: "chair", name: "Pub chair", props: ["weapon", "breakable"], size: "large", colour: 0x7a4a2a },
    { id: "corner_flag", name: "Corner flag", props: ["weapon", "throwable"], size: "large", colour: 0xc8102e },
    { id: "pool_cue", name: "Pool cue", props: ["weapon", "breakable"], size: "large", colour: 0xb08850 },
    { id: "parachute", name: "Parachute", props: [], size: "large", colour: 0x5a6a3a },
    { id: "kitbag", name: "Para Steve's kit bag", props: ["container"], size: "huge", colour: 0x4a5a32 },
    { id: "keg", name: "Beer keg", props: [], size: "huge", colour: 0x9aa3ab },
    { id: "laundry", name: "Laundry hamper", props: ["container"], size: "huge", colour: 0x8a6a40 },
    { id: "mascot_suit", name: "Lion mascot costume", props: ["wearable"], size: "large", slot: "outer", role: "mascot", authority: 1, faceCover: 1, colour: 0xd8a640, colour2: 0xf4f4f4 },
    { id: "press_pass", name: "TV press pass", props: [], size: "small", colour: 0xc8102e },
    { id: "kit_card", name: "Kit man's swipe card", props: [], size: "small", colour: 0x3a7bd5 },
    { id: "censored_bar", name: "Censored bar", props: ["throwable", "grisly"], size: "small", colour: 0x0a0a0a },
    { id: "face", name: "Somebody's face", props: ["wearable", "grisly"], size: "small", slot: "face", colour: 0xe0a890, faceCover: 0 },
    { id: "hands", name: "Somebody's hands", props: ["grisly"], size: "small", colour: 0xe0a890 },
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
