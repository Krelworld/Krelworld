// The tournament: what carries from one match to the next.
import { defOf, ITEM_DEFS } from "../core/items";
import type { Item } from "../core/types";
import type { World } from "../core/world";
import type { Venue } from "./layout";

export interface Campaign {
  /** 0 quarter-final, 1 semi-final, 2 final. */
  fixture: number;
  money: number;
  /** Item defs you own and keep at home between matches. */
  stash: string[];
  /** What you chose to bring to the next match. */
  loadout: string[];
  /** 0 nobody knows you .. 3 your face is on every poster. */
  notoriety: number;
  history: { venue: Venue["id"]; result: string; headline: string }[];
}

export const FIXTURES: Venue["id"][] = ["qf", "sf"];

export function newCampaign(): Campaign {
  return { fixture: 0, money: 150, stash: ["shirt_eng"], loadout: ["shirt_eng"], notoriety: 0, history: [] };
}

/** Things that never come home: they belong to one match, or they're eaten. */
const PERISHABLE = new Set(["ticket", "betslip", "wallet", "pint", "pie", "lorry_cargo", "locker"]);

/** After a win: count up what you have and how famous you've become. */
export function afterMatch(c: Campaign, w: World, headline: string): Campaign {
  const s = w.state, st = s.stadium!, pc = s.actors[st.pc], f = st.flags;
  const carried = [pc.hand, ...pc.pockets, ...Object.values(pc.worn)].filter((x): x is string => !!x).map((id) => s.items[id]);
  const kept = carried.map((it: Item) => it.def).filter((d) => !PERISHABLE.has(d) && ITEM_DEFS[d]);
  const seenSerious = st.incidents.some((i) => i.by === pc.id && i.severity >= 2 && i.seenBy > 0);
  let fame = c.notoriety;
  if (f.ejections || st.banned.includes(pc.faceId)) fame++;
  if (f.unmasked || seenSerious) fame++;
  if (f.detentions) fame++;
  if (st.incidents.some((i) => i.by === pc.id && i.severity >= 4 && i.seenBy > 0)) fame += 2;
  const stash = [...c.stash, ...kept];
  return {
    fixture: c.fixture + 1,
    money: pc.money,
    stash,
    loadout: kept.length ? kept : ["shirt_eng"],
    notoriety: Math.min(3, fame),
    history: [...c.history, { venue: c.fixture === 0 ? "qf" : "sf", result: `${m(s).score[0]}–${m(s).score[1]}`, headline }],
  };
}
const m = (s: World["state"]) => s.match!;

/** Can this set of items all be carried at once? Returns a reason if not. */
export function loadoutProblem(defs: string[]): string | null {
  const slots = new Set<string>();
  let pockets = 0, hands = 0;
  for (const d of defs) {
    const def = ITEM_DEFS[d];
    if (!def) continue;
    if (def.slot) {
      if (slots.has(def.slot)) return `You can only wear one thing on your ${def.slot === "outer" ? "top" : def.slot}.`;
      slots.add(def.slot);
    } else if (def.size === "small") pockets++;
    else hands++;
  }
  if (pockets > 3 + (hands ? 0 : 1)) return "That won't all fit in your pockets.";
  if (hands > 1) return "You've only got one free hand.";
  return null;
}

export const notorietyText = (n: number): string =>
  n <= 0 ? "Nobody knows who you are." :
  n === 1 ? "You're on the tournament watchlist. Turnstile cameras and stewards may know your face." :
  n === 2 ? "Your face is on posters at every turnstile. The police have been told to look out for you." :
  "You are the most wanted football supporter in Europe.";

export const describeDef = (d: string) => (ITEM_DEFS[d] ? defOf({ def: d } as Item).name : d);
