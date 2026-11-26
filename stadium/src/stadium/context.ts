// What the player could do right now, given where he is and what he holds.
// The view shows the best one on the action button and the rest in a list.
import { alarmPointNear } from "./kickoff";
import { sharpInHand } from "./knife";
import { fromBehind, hidingPlaceNear, incapacitated, knockedOut } from "./combat";
import { hasRadio, reportable } from "./coverup";
import { isWoman } from "./lech";
import { edgeDrop, ladderNear } from "./roofs";
import { windowNear } from "./missiles";
import { snitchOf } from "./witness";
import { isSecurity } from "./security";
import { carsNear } from "./cars";
import { horseNear, mountedOfficer, riding } from "./horse";
import { atCellar, atGrate, atScaffold } from "./routes";
import { hasChute } from "./entries";
import { detectorGate, dogWithYou, hasBar } from "./detector";
const hasItem = (s: { items: Record<string, Item> }, a: Actor, def: string) => [a.hand, ...a.pockets].some((id) => id && s.items[id]?.def === def);
import { appearance } from "../core/identity";
import { defOf, hasProp } from "../core/items";
import type { Action, Actor, Item } from "../core/types";
import { possibleVerbs } from "../core/verbs";
import type { World } from "../core/world";
import { areaAt, SPOTS, VENUE } from "./layout";
import { climbPointNear, turnstileNear, SHOPS } from "./rules";

export interface Option {
  label: string;
  /** Higher goes on the main button. Zero or less never does. */
  priority: number;
  action?: Action;
  /** Opens a sheet instead of acting straight away. */
  sheet?: { kind: "shop" | "bribe" | "bet" | "report" | "loot" | "phone" | "scope"; who: string };
}

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export const itemName = (it: Item) => it.label ?? defOf(it).name;
export const personName = (a: Actor) => (a.fb ? `${a.name} (${a.fb.team === 0 ? "England" : "opposition"} ${a.fb.number})` : a.off ? (a.off.job === "referee" ? "the referee" : a.name.toLowerCase()) : a.name);

export function options(w: World, pc: Actor, picked?: string | null): Option[] {
  const s = w.state, out: Option[] = [];
  const base = { actor: pc.id };
  const ok = (a: Action) => possibleVerbs(w, a as Omit<Action, "verb">).includes(a.verb);
  const push = (label: string, priority: number, action: Action) => { if (ok(action)) out.push({ label, priority, action }); };

  if (pc.heldBy) {
    const held: Option[] = [{ label: "Struggle", priority: 100, action: { verb: "struggle", ...base } }];
    const holder = s.actors[pc.heldBy];
    if (s.stadium!.dog?.state === "led" && holder) held.push({ label: `Set the dog on ${personName(holder)}`, priority: 101, action: { verb: "sic", ...base, target: { k: "actor", id: holder.id } } });
    return held;
  }
  const bus = s.stadium!.vehicles.bus;
  if (bus?.drivenBy === pc.id) return [{ label: "Get out of the bus", priority: 100, action: { verb: "getout", ...base } }];
  if (pc.hiddenIn) return [{ label: "Climb out", priority: 100, action: { verb: "unhide", ...base } }];
  if (pc.chute) return [];
  // At the penis detector.
  {
    const gi = detectorGate(w);
    if (gi && Math.hypot(pc.x - SPOTS.turnstiles[gi - 1].x, pc.y - SPOTS.turnstiles[gi - 1].y) < 3.5) {
      const det: Option[] = [{ label: "Insert your penis", priority: 40, action: { verb: "detector", ...base, arg: "own" } }];
      if (hasBar(w, pc)) det.push({ label: "Insert the censored bar", priority: 90, action: { verb: "detector", ...base, arg: "bar" } });
      if (dogWithYou(w, pc)) det.push({ label: "Hold the dog up to the slot", priority: 95, action: { verb: "detector", ...base, arg: "dog" } });
      out.push(...det);
    }
  }
  const hand0 = pc.hand ? s.items[pc.hand] : undefined;
  if (pc.roof) {
    // Up top: the way down (the ladder, or over the edge), and the parachute off the stand.
    const roof: Option[] = [];
    if (ladderNear(pc)) roof.push({ label: "Climb back down the ladder", priority: 80, action: { verb: "ladder", ...base } });
    const e = edgeDrop(pc);
    if (e && e.d < 1.6) roof.push({ label: VENUE.inside(e.x, e.y) ? "Drop down into the ground" : "Drop off the edge", priority: 60, action: { verb: "dropdown", ...base } });
    if (hand0 && hasProp(hand0, "gun")) roof.push({ label: "Look through the scope", priority: 90, sheet: { kind: "scope", who: pc.id } });
    if (pc.roofId === "stand") roof.push(hasChute(w, pc) ? { label: "Jump, and pull the cord", priority: 100, action: { verb: "jump", ...base } } : { label: "Jump (no parachute)", priority: 20, action: { verb: "jump", ...base } });
    return roof;
  }
  // A window in the concourse wall: a brick through it, then climb in.
  if (!pc.seated && windowNear(pc) >= 0) {
    push(`Put the ${hand0 ? lc(itemName(hand0)) : "brick"} through the window`, 72, { verb: "smashwindow", ...base });
    push(VENUE.inside(pc.x, pc.y) ? "Climb out through the window" : "Climb in through the window", 75, { verb: "climbwindow", ...base });
  }
  if (hand0 && hasProp(hand0, "gun")) out.push({ label: "Look through the scope", priority: 66, sheet: { kind: "scope", who: pc.id } });
  if (!pc.seated && ladderNear(pc)) push(`Climb the ladder: ${ladderNear(pc)!.roof.name.replace(/^The /, "the ")}`, 70, { verb: "ladder", ...base });
  if (pc.seated) out.push({ label: "Stand up", priority: 90, action: { verb: "stand", ...base } });

  const hand = pc.hand ? s.items[pc.hand] : undefined;

  // The ball. In a kit, it's a shot; otherwise, a kick from someone who shouldn't.
  const m = s.match;
  if (m && !pc.seated) push(pc.fb ? (m.ball.owner === pc.id ? "Shoot" : "Kick it") : "Kick the ball", 85, { verb: "kick", ...base });

  // Things on the ground and fixtures.
  for (const id in s.items) {
    const it = s.items[id], l = it.loc;
    if (l.k !== "ground") continue;
    const d = Math.hypot(l.x - pc.x, l.y - pc.y);
    if (d > 2.6) continue;
    const def = defOf(it);
    if (def.size !== "huge") push(`Pick up ${lc(def.name)}`, 70 - d, { verb: "take", ...base, item: it.id });
    if (hasProp(it, "container") && it.def !== "locker" && it.def !== "police_box" && it.def !== "bus_cab" && it.def !== "kitbag") {
      const v = Object.values(s.stadium!.vehicles).find((vv) => vv.cargo === it.id);
      const label = it.def === "bus_hold" ? "Hide in the bus's luggage hold" : it.def === "laundry" || it.def === "kit_hamper" ? "Climb into the laundry hamper" : `Hide in the back of the ${VENUE.delivery.name}`;
      push(label, 72 - d, { verb: "hide", ...base, target: { k: "item", id: it.id } });
      void v;
    }
    // Containers with things inside: the police van, the confiscation locker.
    if (hasProp(it, "container") && d < 2.6) {
      for (const id2 in s.items) {
        const inner = s.items[id2];
        if (inner.loc.k === "in" && inner.loc.c === it.id) push(`Take ${lc(defOf(inner).name)} from the ${it.def === "locker" ? "locker" : it.def === "police_box" ? "police van" : it.def === "kitbag" ? "kit bag" : it.def === "kit_hamper" || it.def === "laundry" ? "hamper" : "box"}`, 55 - d, { verb: "takeout", ...base, item: inner.id });
      }
    }
    if (hasProp(it, "spikable")) {
      for (const sub of [pc.hand, ...pc.pockets]) {
        if (!sub || !hasProp(s.items[sub], "substance")) continue;
        push(`Put ${lc(defOf(s.items[sub]).name)} in ${lc(def.name)}`, 75 - d, { verb: "use", ...base, item: sub, target: { k: "item", id: it.id } });
      }
    }
  }

  // Cars: drive, get out, get in, drag a driver out of one that's stopped, or give one a kick.
  if (pc.hiddenIn === "car") return [{ label: "Get out of the car", priority: 50, action: { verb: "getoutcar", ...base } }];
  {
    const cars = carsNear(w, pc.x, pc.y, 2.8);
    const stopped = cars.find((c) => c.traffic && !c.moving);
    if (stopped) push((s.stadium!.traffic ?? []).find((t) => t.id === stopped.id)?.kind === "policecar" ? "Drag the copper out and take his car" : "Drag the driver out and take the car", 62, { verb: "carjack", ...base, arg: stopped.id });
    if (cars.some((c) => c.id === "mine")) push("Get in the car", 58, { verb: "getincar", ...base });
    if (cars[0]) push(cars[0].traffic ? "Kick the car" : "Kick the car (it's alarmed)", 4, { verb: "kickcar", ...base, arg: cars[0].id });
  }

  // Bikes: on one, or one to get on.
  if (pc.bike) push("Get off the bike", 3, { verb: "getoff", ...base });
  else for (const it of Object.values(s.items)) {
    if (it.def !== "bicycle" || it.loc.k !== "ground" || Math.hypot(it.loc.x - pc.x, it.loc.y - pc.y) > 1.9) continue;
    push("Get on the bike", 46, { verb: "ride", ...base, item: it.id });
    break;
  }

  // People.
  const people = Object.values(s.actors)
    .filter((a) => a.id !== pc.id && !a.hiddenIn && !a.dead && !knockedOut(w, a) && a.npc?.job !== "dog" && (a.npc || a.fb || a.off) && (!a.fb || a.fb.status !== "gone"))
    .map((a) => ({ a, d: Math.hypot(a.x - pc.x, a.y - pc.y) }))
    .filter((p) => p.d < 3.6)
    .sort((p, q) => p.d - q.d)
    .slice(0, 3);
  for (const { a, d } of people) {
    const name = personName(a), n = a.npc;
    if (n?.shop === "bookies") out.push({ label: "Place a bet", priority: 80 - d, sheet: { kind: "bet", who: a.id } });
    else if (n?.shop) out.push({ label: `Buy from ${n.shop === "ticket" ? "the ticket office" : SHOPS[n.shop].name.toLowerCase().replace(/^the /, "the ")}`, priority: 80 - d, sheet: { kind: "shop", who: a.id } });
    if (n?.job === "turnstile") {
      const ticket = [pc.hand, ...pc.pockets].find((id) => id && s.items[id].def === "ticket");
      if (ticket) push(`Show your ticket to ${name}`, 82 - d, { verb: "show", ...base, item: ticket, target: { k: "actor", id: a.id } });
      for (const [def, label] of [["press_pass", "Show your press pass"], ["warrant_card", "Flash the warrant card"]] as const) {
        const c = [pc.hand, ...pc.pockets].find((id) => id && s.items[id].def === def);
        if (c) push(`${label} to ${name}`, 83 - d, { verb: "show", ...base, item: c, target: { k: "actor", id: a.id } });
      }
      push(`"He's a service dog. For my autism."`, 84 - d, { verb: "servicedog", ...base, target: { k: "actor", id: a.id } });
      push(`Flash the vest: "I'm working"`, 86 - d, { verb: "colleague", ...base, target: { k: "actor", id: a.id } });
    }
    if (n && isWoman(a)) push(`Leer at ${name}`, 2, { verb: "lech", ...base, target: { k: "actor", id: a.id } });
    if (n && n.job !== "player" && n.job !== "official") push(`Talk to ${name}`, (n.job === "fan" ? 12 : n.job === "local" ? 25 : 40) - d, { verb: "talk", ...base, target: { k: "actor", id: a.id } });
    const why = bribeWhy(w, pc, a);
    if (pc.money > 0 && d < 2.2 && why) out.push({ label: why === "snitch" ? `Pay ${name} to keep quiet` : why === "ticket" ? `Buy ${name}'s ticket` : `Offer ${name} money`, priority: why === "snitch" ? 60 : 5, sheet: { kind: "bribe", who: a.id } });
    if (snitchOf(w, a.id)) push(`Lean on ${name}: "You saw nothing"`, 58 - d, { verb: "threaten", ...base, target: { k: "actor", id: a.id } });
    if (n && n.job !== "player" && n.job !== "official" && !n.shop) push(`Pickpocket ${name}`, 6, { verb: "pickpocket", ...base, target: { k: "actor", id: a.id } });
    if (hand && d < 1.7) push(`Give ${lc(itemName(hand))} to ${name}`, 3, { verb: "give", ...base, item: hand.id, target: { k: "actor", id: a.id } });
    for (const sid of [pc.hand, ...pc.pockets]) {
      const it = sid ? s.items[sid] : undefined;
      if (it && defOf(it).size === "small" && it.def !== "betslip" && d < 1.5) push(`Slip the ${lc(itemName(it))} into ${name}'s pocket`, 4, { verb: "plant", ...base, item: it.id, target: { k: "actor", id: a.id } });
    }
    if (n?.job === "police") out.push({ label: `Tip off ${name} about someone`, priority: 15, sheet: { kind: "report", who: a.id } });
    if (appearance(s, pc).role === "police" && n?.job !== "police") push(`Arrest ${name}`, 22 - d, { verb: "arrest", ...base, target: { k: "actor", id: a.id } });
    const weapon = hand && hasProp(hand, "weapon");
    const sneak = !weapon && !a.fb && fromBehind(pc, a);
    const sharp = weapon && hasProp(hand!, "sharp");
    const glassIt = hand && (hand.def === "bottle" || hand.def === "pint_glass"), chairIt = hand?.def === "chair";
    // Someone winding up to hit you back: catch him first.
    const windup = !!n?.retaliateAt && n.retaliateOn === pc.id && n.retaliateAt > s.tick && n.retaliateAt - s.tick <= 30;
    const label = windup ? `Counter ${name}!` : sharp ? `Stab ${name}` : glassIt ? `Glass ${name}` : chairIt ? `Chair ${name}` : weapon ? `Hit ${name} with the ${lc(itemName(hand!))}` : sneak ? `Take down ${name}` : `Punch ${name}`;
    push(label, windup ? 60 : sneak ? 30 : -1, { verb: "strike", ...base, ...(sneak && !windup ? { arg: "takedown" } : {}), target: { k: "actor", id: a.id } });
  }

  // Dressed as the referee, on the pitch: make some decisions.
  if (appearance(s, pc).role === "referee" && areaAt(pc.x, pc.y).pitch) {
    const opp = Object.values(s.actors).filter((a) => a.fb?.team === 1 && a.fb.status === "playing" && Math.hypot(a.x - pc.x, a.y - pc.y) < 7)
      .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y))[0];
    push("Award England a penalty", 60, { verb: "rule", ...base, arg: "penalty" });
    if (opp) push(`Send off ${opp.name}`, 58, { verb: "rule", ...base, arg: "sendoff", target: { k: "actor", id: opp.id } });
    push("Disallow their goal", 62, { verb: "rule", ...base, arg: "disallow" });
    push("Blow for full time", 20, { verb: "rule", ...base, arg: "fulltime" });
    push("Stop play", 15, { verb: "rule", ...base, arg: "stop" });
  }

  // The naughty ways in.
  if (atCellar(pc)) push(hasItem(s, pc, "wrench") || s.stadium!.flags.hatchOpen ? "Down the cellar and into the drain" : "Prise open the cellar hatch (needs a wrench)", 66, { verb: "drain", ...base });
  if (atGrate(pc)) push("Back down the drain", 40, { verb: "drain", ...base });
  if (atScaffold(pc)) push("Climb the scaffold onto the roof", 64, { verb: "scaffold", ...base });

  // The police horse.
  if (riding(w, pc)) push("Get off the horse", 60, { verb: "dismount", ...base });
  else if (horseNear(w, pc)) push("Get on the horse", 75, { verb: "mount", ...base });
  else { const o = mountedOfficer(w); if (o && o.downUntil <= s.tick && Math.hypot(o.x - pc.x, o.y - pc.y) < 2.4) push(`Pull ${personName(o)} off his horse`, 72, { verb: "unseat", ...base }); }

  // The knocked out and the dead: pockets, dragging, a stamp; somewhere to put them.
  if (pc.dragging) {
    const b = s.actors[pc.dragging];
    const spot = hidingPlaceNear(w, pc);
    if (spot) push(spot.startsWith("bin") ? `Stuff ${personName(b)} in the bin` : `Leave ${personName(b)} in here`, 70, { verb: "hidebody", ...base });
    push(`Let go of ${personName(b)}`, 20, { verb: "drag", ...base });
  } else for (const a of Object.values(s.actors)) {
    if (a.id === pc.id || a.hiddenIn || !incapacitated(w, a) || a.npc?.job === "dog" || Math.hypot(a.x - pc.x, a.y - pc.y) > 2.4) continue;
    const name = personName(a);
    out.push({ label: `Go through ${name}'s pockets`, priority: 55, sheet: { kind: "loot", who: a.id } });
    push(`Drag ${name}`, 50, { verb: "drag", ...base, target: { k: "actor", id: a.id } });
    if (!a.splat) push(`Stamp on ${name}'s head`, 8, { verb: "finish", ...base, target: { k: "actor", id: a.id } });
  }

  // Got a steward's walkie-talkie? Call it in, and they'll tidy up for you.
  if (hasRadio(w, pc)) for (const b of reportable(w, pc).slice(0, 2)) {
    push(`Radio it in: "I've had to ${b.dead ? "kill" : "knock out"} a fan"`, 48, { verb: "radio", ...base, target: { k: "actor", id: b.id } });
  }

  // The dead, if you've a blade.
  if (sharpInHand(w, pc)) {
    for (const a of Object.values(s.actors)) {
      if (!a.dead || Math.hypot(a.x - pc.x, a.y - pc.y) > 1.8) continue;
      const name = personName(a);
      push(`Cut off ${name}'s face`, 46, { verb: "flay", ...base, arg: "face", target: { k: "actor", id: a.id } });
      push(`Cut off ${name}'s hands`, 44, { verb: "flay", ...base, arg: "hands", target: { k: "actor", id: a.id } });
    }
  }

  // The dog.
  const dg = s.stadium!.dog, dogA = dg ? s.actors[dg.id] : undefined;
  if (dg && dogA) {
    const dd = Math.hypot(dogA.x - pc.x, dogA.y - pc.y);
    if (dg.state === "tied" && dd < 1.8) push("Untie the dog", 50, { verb: "untie", ...base });
    if (dg.state === "led" || dg.state === "returning") {
      // Whoever's after you first; otherwise whoever you've picked or are facing.
      const chaser = Object.values(s.actors).find((a) => a.npc && !a.dead && a.npc.target === pc.id && (a.npc.mode === "chase" || a.npc.mode === "approach") && Math.hypot(a.x - pc.x, a.y - pc.y) < 20);
      const t = chaser ?? throwTarget(w, pc, picked ?? null);
      if (t && t.id !== dg.id) push(`Set the dog on ${personName(t)}`, chaser ? 66 : 34, { verb: "sic", ...base, target: { k: "actor", id: t.id } });
    }
    if (dg.state === "led") push("Let the dog go", 33, { verb: "release", ...base });
    if ((dg.state === "loose" || dg.state === "sicced") && dd < 1.5) push("Grab the dog's lead", 60, { verb: "leash", ...base });
  }

  // The team bus.
  if (bus && !bus.crashed && !bus.drivenBy) {
    push(`Get in the driver's seat of the ${s.match!.teams[1].name} bus`, 45, { verb: "drive", ...base });
    if (pc.hand) push("Tamper with the bus", 20, { verb: "tamper", ...base, item: pc.hand });
  }

  // Places.
  if (turnstileNear(pc) && !pc.seated) out.push({ label: "Climb over the turnstile", priority: 4, action: { verb: "vault", ...base } });
  if (alarmPointNear(pc) >= 0 && !pc.seated) push("Break the glass on the fire alarm", 48, { verb: "alarm", ...base });
  if (climbPointNear(pc) && !pc.seated) out.push({ label: "Squeeze through the loose panel", priority: 50, action: { verb: "vault", ...base } });
  if (areaAt(pc.x, pc.y).seats && !pc.seated) push("Sit down and watch", 45, { verb: "sit", ...base });

  out.sort((p, q) => q.priority - p.priority);
  return out;
}

export function primary(opts: Option[]): Option | null {
  return opts.find((o) => o.priority > 0) ?? null;
}

/** What the bag sheet offers for one item. */
/** Whether money means anything to this person, and why: a grass to shut up, a fan's spare ticket, a steward, a player or the referee. */
export function bribeWhy(w: World, pc: Actor, a: Actor): "snitch" | "ticket" | "staff" | "player" | "referee" | null {
  const s = w.state, n = a.npc;
  if (a.dead || a.downUntil > s.tick) return null;
  if (snitchOf(w, a.id)) return "snitch";
  if (a.fb) return a.fb.team === 1 ? "player" : null;
  if (a.off) return a.off.job === "referee" ? "referee" : null;
  if (!n) return null;
  if (isSecurity(a) && n.job !== "police") return "staff";
  if (n.job === "fan" && n.hasTicket && !n.shop && ![pc.hand, ...pc.pockets].some((id) => id && s.items[id]?.def === "ticket")) return "ticket";
  return null;
}

export function itemOptions(w: World, pc: Actor, it: Item): Option[] {
  const base = { actor: pc.id, item: it.id };
  const out: Option[] = [];
  const add = (label: string, verb: string) => { if (possibleVerbs(w, base).includes(verb)) out.push({ label, priority: 1, action: { verb, ...base } }); };
  const def = defOf(it);
  add("Hold", "hold");
  add("Put in pocket", "pocket");
  add(def.slot ? `Put on` : "Wear", "wear");
  if (it.loc.k === "worn") add("Take off", "remove");
  add(def.props.includes("food") ? "Eat" : def.props.includes("liquid") ? "Drink" : "Take", "consume");
  add("Drop", "drop");
  // The walkie, from the bag: call in a body near you, or send the stewards somewhere else.
  if (it.def === "radio" && it.loc.k !== "ground") {
    const cover = { verb: "radio", actor: pc.id, arg: "cover" }, decoy = { verb: "radio", actor: pc.id, arg: "decoy" };
    if (possibleVerbs(w, { actor: pc.id, arg: "cover" }).includes("radio")) out.unshift({ label: "Radio: \"I've had to deal with one\"", priority: 1, action: cover });
    if (possibleVerbs(w, { actor: pc.id, arg: "decoy" }).includes("radio")) out.unshift({ label: "Radio: \"Trouble, all units\"", priority: 1, action: decoy });
  }
  if (it.def === "burner") out.unshift({ label: "Make a call", priority: 1, sheet: { kind: "phone", who: "burner" } });
  return out;
}

/** Who the throw button would aim at: the nearest person roughly in front, or the referee if seated. */
export function throwTarget(w: World, pc: Actor, pickedId: string | null): Actor | null {
  const s = w.state;
  if (pickedId && s.actors[pickedId]) {
    const a = s.actors[pickedId];
    if (Math.hypot(a.x - pc.x, a.y - pc.y) < 22 && !a.hiddenIn) return a;
  }
  let best: Actor | null = null, bestScore = 1e9;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.id === pc.id || a.hiddenIn || (a.fb && a.fb.status !== "playing")) continue;
    if (a.seated && !a.fb) continue;
    const dx = a.x - pc.x, dy = a.y - pc.y, d = Math.hypot(dx, dy);
    if (d < 1.5 || d > 20) continue;
    const ang = Math.cos(Math.atan2(dy, dx) - pc.facing);
    if (!pc.seated && ang < 0.75) continue;
    const score = d * (pc.seated ? 1 : 2 - ang) - (a.off?.job === "referee" ? 6 : 0) - (a.fb && s.match?.ball.owner === a.id ? 4 : 0);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function looksOutOfPlace(w: World, pc: Actor): boolean {
  const ar = areaAt(pc.x, pc.y);
  if (ar.access === "public") return false;
  const role = appearance(w.state, pc).role;
  if (ar.roles?.length) return !ar.roles.includes(role);
  return ar.access !== "ticket" && role !== "steward" && role !== "police";
}

/** Where to throw so it arrives where a moving target will be. */
export function aimThrow(pc: Actor, t: Actor): { dirX: number; dirY: number; dist: number } {
  let x = t.x, y = t.y;
  for (let i = 0; i < 3; i++) {
    const d = Math.hypot(x - pc.x, y - pc.y), flight = Math.min(1, d / Math.max(4, d / 0.95) + 0.05);
    x = t.x + t.vx * flight * 0.9; y = t.y + t.vy * flight * 0.9;
  }
  return { dirX: x - pc.x, dirY: y - pc.y, dist: Math.hypot(x - pc.x, y - pc.y) };
}
