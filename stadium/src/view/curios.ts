// Ideas: walk up to something with possibilities for the first time and Grozz has a thought about it,
// which goes in his notes (the Goose's "that's interesting", Hitman's opportunities). Looking around
// is rewarded with a plan, not a waypoint. Read-only: positions come from the sim, nothing changes.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { SPOTS, VENUE } from "../stadium/layout";
import { roofs } from "../stadium/roofs";

export interface Curio { id: string; r: number; text: string; short: string; at: (w: World) => { x: number; y: number } | null | undefined }

const X = (x: number) => (VENUE.id === "sf" ? -x : x);
const who = (w: World, f: (a: Actor) => boolean) => Object.values(w.state.actors).find((a) => !a.dead && f(a));
const hasDef = (w: World, def: string) => { const pc = w.state.actors[w.state.stadium!.pc]; return !!pc && [pc.hand, ...pc.pockets].some((id) => id && w.state.items[id]?.def === def); };

export const CURIOS: Curio[] = [
  { id: "dog", short: "Ronson. He'd go through anyone for a pie.", r: 5, at: () => SPOTS.dogPost, text: "Ronson, tied up and dying to have a go at someone. Untie him and point him at whoever you like." },
  { id: "cellar", short: "Cellar hatch. Needs a wrench…", r: 4, at: () => (SPOTS as any).cellar, text: "The pub's cellar hatch. Locked. A big wrench would have it open, and the drains run under the ground." },
  { id: "publadder", short: "Ladder. Up top, nobody looks.", r: 4, at: () => { const r = roofs().find((q) => q.id === "pub"); return r ? { x: r.ladders[0].bx, y: r.ladders[0].by } : null; }, text: "A ladder up onto the pub roof. Nobody looks up. Handy for lobbing things." },
  { id: "kegs", short: "Shame if one of them kegs rolled off…", r: 11, at: () => ({ x: X(-31.2), y: 68.7 }), text: "The drayman's kegs, stacked by his lorry. One's right on the edge. Give it a roll and see what he does." },
  { id: "pigeons_w", short: "Pigeons. Right over the queue…", r: 5, at: () => ({ x: X(-15), y: 55.5 }), text: "Pigeons by the queue. Boot them and they go up over everyone, and people duck into things." },
  { id: "barriers", short: "One shove and they'd all go over.", r: 4, at: () => ({ x: X(-9), y: 50.6 }), text: "The crowd barriers in front of the turnstiles, all in a line. Push the end one and the turnstile man has to come out and pick them up." },
  { id: "board", short: "Chalkboard. Shame if it said something upsetting.", r: 4, at: () => ({ x: X(-9.5), y: 58.4 }), text: "The newsboard. Chalk up a pay cut for the stewards and watch them come over to moan about it." },
  { id: "pigeons_e", short: "Pigeons, right over that copper…", r: 5, at: () => ({ x: X(34), y: 58.2 }), text: "Pigeons by the police van. Something's bound to land on that copper's hat." },
  { id: "hose", short: "That hose fills the kegs for the ground. And that's a drain.", r: 4.5, at: () => (VENUE.id === "qf" ? { x: -29.5, y: 70.7 } : null), text: "The drayman fills the ground's kegs from the standpipe in the pub yard, with the drain cover right beside it. He'd have to be looking the other way." },
  { id: "flask", short: "His flask. He'd miss that.", r: 3.5, at: (w) => { const f = Object.values(w.state.items).find((i) => i.def === "flask" && i.loc.k === "ground" && i.home); return f && f.loc.k === "ground" ? { x: f.loc.x, y: f.loc.y } : null; }, text: "A steward's flask of tea on the wall by his turnstile. People go after their own things." },
  { id: "policevan", short: "Copper on the van. Uniform in the back…", r: 4.5, at: () => ({ x: X(32), y: 55.6 }), text: "The police van. Confiscated gear in the back, and a spare uniform, if you could get in." },
  { id: "burgervan", short: "Gas bottle. Turn it up and stand back.", r: 4.5, at: () => ({ x: X(46), y: 53 }), text: "Burger van. Turn the gas right up: WHOOMPH, and everyone nearby comes to look. The smell carries to the staff door." },
  { id: "staffdoor", short: "Hi-vis and a bit of front…", r: 4, at: () => SPOTS.staffDoor, text: "Staff door. A pass, or just a hi-vis vest and a bit of front, and nobody asks." },
  { id: "scaffold", short: "That scaffold goes all the way up.", r: 4.5, at: () => (SPOTS as any).scaffold, text: "Scaffolding up the side of the stand. That goes all the way up." },
  { id: "bus", short: "Their coach. Tyres look… fragile.", r: 7, at: (w) => w.state.stadium!.vehicles.bus, text: "Their team coach. Be a shame if the tyres went. Or if somebody drove it off." },
  { id: "lenny", short: "Lenny. Head off. Who's in that suit?", r: 5, at: (w) => who(w, (a) => a.npc?.job === "mascot"), text: "Lenny the Lion, head off, having a fag. Nobody knows who's inside that costume." },
  { id: "del", short: "Del. Tickets. Or pockets.", r: 4, at: (w) => who(w, (a) => a.name === "Dodgy Del"), text: "Dodgy Del, touting tickets. Pricey. Or he's got pockets." },
  { id: "pawn", short: "Lionel. Nicked or not, he'll take it.", r: 5, at: (w) => who(w, (a) => a.npc?.shop === "pawn"), text: "Lionel's pawn shop. He'll take anything, no questions. Pawn something nicked off a steward and he'll see it in the window, and come for it." },
  { id: "bootbag", short: "Their No.10's boots. Unattended. Hmm.", r: 5, at: (w) => { const b = Object.values(w.state.items).find((i) => i.def === "boot_bag" && i.loc.k === "ground"); return b && b.loc.k === "ground" ? { x: b.loc.x, y: b.loc.y } : null; }, text: "Their star's boot bag, by their coach while the driver loads. Move it and see what he does when they board." },
  { id: "hotel", short: "Their water's in there…", r: 6, at: () => SPOTS.hotelLobby, text: "The team hotel. Their players are in there, and so is their water." },
];

/** The first idea you're standing near that you haven't had yet (some only while you can't act on them yet). */
export function curioHere(w: World, pc: Actor, had: Set<string>): Curio | null {
  for (const c of CURIOS) {
    if (had.has(c.id)) continue;
    if (c.id === "cellar" && hasDef(w, "wrench")) continue;
    const p = c.at(w);
    if (p && Math.hypot(p.x - pc.x, p.y - pc.y) < c.r) return c;
  }
  return null;
}
