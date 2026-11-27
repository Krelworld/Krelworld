// What a thing is for, said once when you first pick it up (Hitman's item card, in Grozz's words), and
// where it would work round here: while it's in your hand, those places light up. Read-only views of the
// sim; nothing here changes the world.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { hasProp } from "../core/items";
import { SPOTS, VENUE } from "../stadium/layout";
import { windows } from "../stadium/missiles";
import { roofs } from "../stadium/roofs";
import { itemAt } from "./guide";

const WEAR = "Wear it (Bag). They won't know your face.";
export const ITEM_TIPS: Record<string, string> = {
  pint: "Drink it, chuck it, or slip something in it first.",
  pie: "Eat it. Lace it. Or drop it by a steward and let Ronson go and get it.",
  knife: "Serious. Their bus tyres, or worse. Everyone remembers a knife.",
  whistle: "Blow it on the pitch and see who listens.",
  ticket: "Show it at the turnstiles. The honest way in.",
  wallet: "Somebody's. There's cash in it.",
  laxative: "In a drink, a pie, or the ref's tea. Then wait.",
  powder: "Slip it in someone's pocket, then grass them up to a copper.",
  radio: "Talk like a steward. Send them all the wrong way.",
  brick: "Through a window. Or someone's head.",
  fart_can: "Set it off in a crowd and watch them scatter.",
  rifle: "Get up high, then look through the scope.",
  burner: "Untraceable calls: Ricky, Brendan, 999, the wife.",
  staff_pass: "Flash it at the staff door.",
  kit_card: "Swipes you through the staff door.",
  press_pass: "Flash it: the press get in anywhere.",
  hivis: "Wear it. Nobody stops a man in hi-vis.",
  hammer: "Hit things. Or do their bus.",
  flare: "Smoke. Cover to slip through, or just chaos.",
  wrench: "Prises open the pub's cellar hatch. There's a drain down there.",
  bottle: "Hit someone with it, or throw it.", pint_glass: "Hit someone with it, or throw it.", chair: "Hit someone with it.",
  pool_cue: "Hit someone with it. Long reach.", corner_flag: "Hit someone with it.",
  parachute: "Off the top of the stand, onto the pitch.",
  censored_bar: "For the detector at the final. Don't ask.",
  police_uniform: "Wear it. You're the law now.", police_hat: "Wear it with the uniform.",
  ref_kit: "Wear it, then walk onto the pitch like you own it.",
  kit_eng: "Wear it and walk out with the team.", kit_opp: "Wear it and walk out with the team.",
  mascot_suit: "Wear it. Nobody checks inside the lion.",
  dress: "Wear it. A different kind of attention.", long_wig: "Wear it. A different kind of attention.",
  mask: WEAR, balaclava: WEAR, sunglasses: WEAR, flat_cap: WEAR, wig: WEAR, moustache: WEAR, tracksuit: WEAR, chef_whites: WEAR, overalls: WEAR,
  shirt_eng: "Wear it. One of the lads.", shirt_opp: "Wear it. Blend in with their lot.", shirt_por: "Wear it. Blend in with their lot.",
  face: "Grim. Somebody's face, for the scanners.", hands: "Grim. Somebody's hands.",
};

export interface ItemTarget { x: number; y: number; label: string }

/** Where the thing in your hand would be some use near here, nearest first (a few at most). */
export function itemTargets(w: World, pc: Actor, it: Item): ItemTarget[] {
  const s = w.state, st = s.stadium!, out: ItemTarget[] = [], def = it.def;
  const add = (p: { x: number; y: number } | null | undefined, label: string) => { if (p) out.push({ x: p.x, y: p.y, label }); };
  const ofDef = (d: string) => Object.values(s.items).filter((i) => i.def === d && i.loc.k !== "gone" && i.id !== it.id);
  if (hasProp(it, "substance")) {
    for (const d of ["tea_urn", "cooler_away", "cooler_home"]) for (const i of ofDef(d)) add(itemAt(w, i), d === "tea_urn" ? "The ref's tea" : d === "cooler_away" ? "Their water" : "Our water");
    for (const i of ofDef("pint")) if (i.loc.k === "ground" && !i.spiked) add({ x: i.loc.x, y: i.loc.y }, "A pint");
    if (def === "powder") for (const a of Object.values(s.actors)) if (a.npc?.job === "police" && !a.dead) add(a, "A copper to tip off");
  }
  if (def === "brick" || def === "bottle" || def === "pint_glass") for (const p of windows()) add(p, "A window");
  if (def === "wrench") add((SPOTS as any).cellar, "The cellar hatch");
  if (def === "ticket" && !st.admitted) for (const p of SPOTS.turnstiles) add(p, "Turnstiles");
  if (def === "staff_pass" || def === "kit_card" || def === "hivis" || def === "press_pass") add(SPOTS.staffDoor, "The staff door");
  if ((def === "knife" || def === "hammer") && st.vehicles.bus) add(st.vehicles.bus, "Their bus");
  if (def === "rifle") for (const r of roofs()) for (const l of r.ladders) add({ x: l.bx, y: l.by }, "Up high");
  if (def === "fart_can" || def === "flare") { add(SPOTS.pubBar, "A packed pub"); for (const p of SPOTS.turnstiles.slice(0, 1)) add(p, "The queue"); }
  // Food and a dog: by a steward at his post, Ronson does the rest.
  if (hasProp(it, "food") && st.dog && st.dog.state !== "caught") for (const a of Object.values(s.actors)) if (a.npc?.post && (a.npc.job === "turnstile" || a.npc.job === "doorguard" || a.npc.job === "pitchsteward") && !a.dead) add(a, "A steward, for Ronson");
  if (def === "parachute") for (const r of roofs()) if (r.id === "stand") for (const l of r.ladders) add({ x: l.bx, y: l.by }, "The stand roof");
  void VENUE;
  return out.map((t) => ({ t, d: Math.hypot(t.x - pc.x, t.y - pc.y) })).filter((o) => o.d < 70).sort((a, b) => a.d - b.d).slice(0, 4).map((o) => o.t);
}
