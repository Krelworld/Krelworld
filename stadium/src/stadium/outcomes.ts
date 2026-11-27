// What a thing does, said before you do it; and what's happening to you, said while it happens.
// The creator's rule: nothing you can press or sit in should leave you guessing what it does, where it
// goes or how long it takes. One short line per action (shown over the big button and in the "..." list),
// and one line per state you can be in (shown as a strip). Read-only: it reports the sim, it changes nothing.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { hasProp } from "../core/items";
import type { Option } from "./context";
import { PACE, VENUE } from "./layout";
import { draymanWatching } from "./beer";
import { isSecurity } from "./security";

const mmss = (ticks: number) => { const s = Math.max(0, Math.ceil(ticks / 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const lorryOf = (w: World, cargo: string | undefined) => Object.values(w.state.stadium!.vehicles).find((v) => v.cargo === cargo);

/** One line on what pressing it will do. Empty when the label already says it all. */
export function whatItDoes(w: World, pc: Actor, o: Option): string {
  const s = w.state, st = s.stadium!, tick = s.tick, a = o.action, L = o.label;
  if (o.sheet) return o.sheet.kind === "rumour" ? "It needn't be true. It'll get round." : o.sheet.kind === "report" ? "The copper goes and searches whoever you name." : o.sheet.kind === "bribe" ? "Money for a favour. Some won't take it." : o.sheet.kind === "loot" ? "His money, and anything he's carrying." : "";
  if (!a) return "";
  const t = a.target?.k === "actor" ? s.actors[a.target.id] : undefined;
  const it = a.item ? s.items[a.item] : undefined;
  const tItem = a.target?.k === "item" ? s.items[a.target.id] : undefined;
  switch (a.verb) {
    case "hide": {
      const v = lorryOf(w, tItem?.id);
      if (v?.kind === "lorry" && PACE.calm && pc.id === st.pc && draymanWatching(w, pc)) return `Goes into the ground in ${mmss(v.until - tick)}. Not while the drayman's looking.`;
      if (v?.kind === "lorry") return v.state === "loading" ? `It goes round into the ground. Leaves in ${mmss(v.until - tick)}.` : v.state === "unloading" ? `It goes back to the pub. Leaves in ${mmss(v.until - tick)}.` : "It's about to move.";
      if (v?.kind === "bus") return v.state === "parked" && v.until - tick < 60 * 3600 ? `Their coach. It drives into the ground. Leaves in ${mmss(v.until - tick)}.` : v.state === "loading" ? "Their coach. It drives into the ground any second." : "It's not going anywhere now.";
      if (tItem?.def === "laundry" || tItem?.def === "kit_hamper") return "Wally wheels it into the kit room on his next run.";
      return "Out of sight till you climb out.";
    }
    case "unhide": { const v = lorryOf(w, pc.hiddenIn); return v && (v.state === "loading" || v.state === "parked") ? "It hasn't gone anywhere yet." : v && (v.state === "driving" || v.state === "gate") ? "It's still moving. You'll be seen." : ""; }
    case "shove": return "The drayman will leave everything and go after it.";
    case "hose": return "The ground's kegs fill from the drain. It shows up inside, later.";
    case "rig": return ({ pigeons_w: "They go up over the queue. People duck into things.", pigeons_e: "They go up over the copper by the van.", barriers: "They all go over. A steward has to come out to them.", burger: "A bang. Everybody comes to look, and to eat.", board: "Any steward who reads it will stop work to moan." } as Record<string, string>)[a.arg ?? ""] ?? "";
    case "queue": return "Stand still. Somebody will join. Then somebody else.";
    case "loosign": return /down/i.test(L) ? "It opens again." : "Nobody gets in. They'll queue till they can't.";
    case "show": return it?.def === "ticket" ? "Scanned once, and you're in." : "Waved through, no ticket.";
    case "vault": return /panel/i.test(L) ? "In, without a ticket." : "In, without a ticket. They'll come for you if it's seen.";
    case "colleague": return "He takes you for staff and lets you by.";
    case "ladder": return /down/i.test(L) ? "" : "Up on the roof. Nobody looks up.";
    case "scaffold": return "Over the stand roof. You come down in the players' corridor.";
    case "drain": return /needs/i.test(L) ? "" : /Back/.test(L) ? "Back under the ground to the pub cellar." : "Under the pitch. It comes up in England's dressing room.";
    case "smashwindow": return "It breaks, and the noise brings stewards.";
    case "climbwindow": return /out/i.test(L) ? "" : "Into the concourse, no ticket.";
    case "sit": return "Watch the match. You can run the clock fast.";
    case "alarm": return "Staff run to find the fire. Half a minute, less each time.";
    case "untie": return "He's yours. He comes with you on the lead.";
    case "release": return "Off the lead. He does what he likes. People run.";
    case "sic": return "He mauls him, then comes back to you.";
    case "servicedog": return "He might believe it.";
    case "give": {
      if (!t?.npc || !it) return "";
      if (it.def === "pint") return t.npc.job === "police" ? "He'll pour it away." : it.spiked ? "He'll drink it, and need the gents at once." : "He'll drink it, then have to go to the gents.";
      if (it.def === "pie") return it.spiked ? "He'll eat it, and need the gents at once." : "He'll eat it. It settles a grudge.";
      return it.def === "ticket" ? "It's his. You'd need another." : "";
    }
    case "plant": return "It's in his pocket. Tip off a copper and he's searched.";
    case "pickpocket": return "What's in his pocket. He may feel it.";
    case "order": return t && isSecurity(t) ? "He leaves his post to go and see. He'll work it out." : "They clear off for a bit.";
    case "handin": return "On the record, you found it. Its owner walks to the cabin for it.";
    case "form": return "Twelve seconds off your stay.";
    case "takeout": return /locker/.test(L) ? "Yours again. Not while he's looking." : /van/.test(L) ? "A crime, if anyone sees." : "";
    case "use": return tItem && hasProp(tItem, "spikable") ? (tItem.def === "tea_urn" ? "The ref drinks from this at half-time." : tItem.def.startsWith("cooler") ? "Their players drink from this at half-time." : "Whoever drinks it gets it.") : "";
    case "line": return "Wired for a while, and it stops hurting. Not in front of a steward.";
    case "mount": return "Fast, and everybody notices.";
    case "ride": return "Faster than walking.";
    case "hidebody": return "Out of sight, nobody raises the alarm.";
    case "radio": return a.arg === "decoy" ? "Every steward in earshot runs to a fight that isn't there." : "It's official. Nobody raises the alarm over him.";
    case "tamper": return "A minute under there. It comes off the road on the way.";
    case "detector": return a.arg === "own" ? "It checks against the file. Yours is in it." : "The gate opens for four seconds.";
    case "kickcar": return /alarmed/.test(L) ? "The alarm goes off. Heads turn to it, not to you." : "";
    case "flay": return a.arg === "face" ? "A face you can wear." : "";
    case "unseat": return "The horse is yours. He isn't pleased.";
    case "threaten": return "He keeps quiet. Or he doesn't.";
    case "arrest": return "He's walked off to the van.";
    case "jump": return /no parachute/i.test(L) ? "That's the end of you." : "Down onto the pitch.";
    case "dropdown": return "";
    case "strike": case "finish": return pc.fb || pc.heldBy ? "" : "It only counts if somebody sees it.";
    case "struggle": return "Hammer it. Enough and you're loose.";
    case "kick": return pc.fb ? "" : "They'll come for you.";
    case "take": return it?.owner && it.home && s.actors[it.owner]?.npc && !s.actors[it.owner].dead ? `It's ${s.actors[it.owner].name.split(" ").pop()}'s. Wherever you leave it, he'll go and get it.` : "";
    default: return "";
  }
}

export interface Status { title: string; text: string; wait: boolean }

/** What's happening to you right now, if you're in or doing something that isn't obvious. */
export function statusOf(w: World, pc: Actor): Status | null {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (st.custody || st.recover) return null; // those have their own strip
  if (pc.heldBy) {
    const i = s.actors[pc.heldBy]?.npc?.intent;
    return { title: "GOT YOU", text: i === "warn" ? "A warning. He's walking you back out." : i === "detain" ? "He's taking you to the security cabin." : i === "eject" ? "He's putting you out of the ground." : i === "arrest" ? "You're nicked." : "He's got hold of you.", wait: false };
  }
  if (pc.hiddenIn && pc.hiddenIn !== "car") {
    const v = lorryOf(w, pc.hiddenIn), it = s.items[pc.hiddenIn];
    const inGround = VENUE.inside(pc.x, pc.y);
    if (v?.kind === "lorry") {
      const text = v.state === "loading" ? `Leaves for the ground in ${mmss(v.until - tick)}` : v.state === "gate" ? "Service gate. He may look in the back." : v.state === "unloading" ? (inGround || v.x > 40 || v.x < -40 ? "In the loading bay. Out you get." : "Unloading.") : v.state === "returning" ? "Heading back to the pub" : "On its way round to the ground";
      return { title: "IN THE LORRY", text, wait: v.state !== "unloading" };
    }
    if (v?.kind === "bus") {
      const stuck = v.state === "parked" && v.until - tick > 60 * 3600;
      const text = stuck ? "It's not going anywhere now." : v.state === "parked" ? `Leaves for the ground in ${mmss(v.until - tick)}` : v.state === "loading" ? "They're getting on. Any second." : v.state === "unloading" ? "It's stopped. Out you get." : "On its way to the ground";
      return { title: "IN THE COACH HOLD", text, wait: !stuck && v.state !== "unloading" };
    }
    if (it && (it.def === "laundry" || it.def === "kit_hamper")) return { title: "IN THE HAMPER", text: st.flags.wheeling ? "Wally's wheeling you in. Keep still." : "Wally takes it into the kit room on his next run.", wait: !st.flags.wheeling };
    return { title: "HIDDEN", text: "Nobody can see you in here. Climb out when it's clear.", wait: false };
  }
  // Queuing for nothing.
  const q = (st.stims ?? []).find((e) => e.tag === "queue");
  if (q && Math.hypot(q.x - pc.x, q.y - pc.y) < 1.4) return { title: "QUEUING", text: q.n >= 4 ? "It's got a life of its own. You can walk away." : q.n ? `${q.n} behind you. Stay put.` : "Stand still. Somebody will join.", wait: false };
  return null;
}

/** Doors and gates that are open for now, and for how long. */
export function openFor(w: World): { gate: string; secs: number }[] {
  const st = w.state.stadium!, tick = w.state.tick, pc = st.pc;
  return Object.entries(st.gates).filter(([, g]) => g.until > tick && g.until - tick < 60 * 90 && (g.for === null || g.for === pc)).map(([gate, g]) => ({ gate, secs: Math.ceil((g.until - tick) / 60) }));
}
