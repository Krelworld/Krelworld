// What each thing is for (the report: "inventory categories should become behavioural, not
// encyclopaedic"). One table: every item does the handful of things it's for and nothing else, so the
// game never offers to plant a brick, give someone a wig or take a laxative yourself. Categories:
//   credentials work by themselves (walk up and they're shown);
//   wearables are worn;
//   food and drink are eaten, drunk, thrown or slipped something;
//   weapons are hit with (used automatically in a fight) and some thrown;
//   tools do their one job;
//   anything can be dropped, and Lionel decides what he'll pay for.
import type { Item } from "../core/types";
import { defOf, hasProp } from "../core/items";

export type ItemVerb = "consume" | "line" | "throw" | "give" | "plant" | "spike" | "wear" | "show" | "strike" | "smash" | "tool";

const T: Record<string, ItemVerb[]> = {
  pint: ["consume", "throw", "give"],
  pie: ["consume", "throw", "give"],
  laxative: ["spike"],
  powder: ["line", "spike", "plant"],
  knife: ["strike", "plant", "tool"],
  brick: ["throw", "strike", "smash"],
  bottle: ["throw", "strike", "smash"],
  pint_glass: ["throw", "strike", "smash"],
  hammer: ["strike", "throw", "tool"],
  wrench: ["strike", "tool"],
  chair: ["strike"],
  pool_cue: ["strike"],
  corner_flag: ["strike", "throw"],
  fart_can: ["throw"],
  flask: ["throw"],
  flare: ["throw", "plant"],
  boot_bag: ["throw"],
  match_ball: ["throw"],
  ticket: ["show", "give"],
  press_pass: ["show"],
  warrant_card: ["show"],
  staff_pass: ["show"],
  kit_card: ["show"],
  radio: ["tool"],
  burner: ["tool"],
  rifle: ["tool"],
  parachute: ["tool"],
  whistle: ["tool"],
};

export function itemVerbs(it: Item): ItemVerb[] {
  if (T[it.def]) return T[it.def];
  if (defOf(it).slot) return ["wear"];
  return [];
}
export const can = (it: Item | undefined, v: ItemVerb): boolean => !!it && itemVerbs(it).includes(v);
/** Fight with it without being told to (everything but the knife, which you have to mean). */
export const autoWeapon = (it: Item | undefined): boolean => !!it && can(it, "strike") && it.def !== "knife" && hasProp(it, "weapon");
