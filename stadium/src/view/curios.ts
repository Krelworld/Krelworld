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
  { id: "policevan", short: "Spare uniform in the back of that…", r: 4.5, at: () => ({ x: X(32), y: 55.6 }), text: "The police van. Confiscated gear in the back, and a spare uniform, if you could get in." },
  { id: "burgervan", short: "Pie for the ref? Heh.", r: 4.5, at: () => ({ x: X(46), y: 53 }), text: "Burger van. A pie for the ref? He'd never know what was in it." },
  { id: "staffdoor", short: "Hi-vis and a bit of front…", r: 4, at: () => SPOTS.staffDoor, text: "Staff door. A pass, or just a hi-vis vest and a bit of front, and nobody asks." },
  { id: "scaffold", short: "That scaffold goes all the way up.", r: 4.5, at: () => (SPOTS as any).scaffold, text: "Scaffolding up the side of the stand. That goes all the way up." },
  { id: "bus", short: "Their coach. Tyres look… fragile.", r: 7, at: (w) => w.state.stadium!.vehicles.bus, text: "Their team coach. Be a shame if the tyres went. Or if somebody drove it off." },
  { id: "lenny", short: "Lenny. Head off. Who's in that suit?", r: 5, at: (w) => who(w, (a) => a.npc?.job === "mascot"), text: "Lenny the Lion, head off, having a fag. Nobody knows who's inside that costume." },
  { id: "del", short: "Del. Tickets. Or pockets.", r: 4, at: (w) => who(w, (a) => a.name === "Dodgy Del"), text: "Dodgy Del, touting tickets. Pricey. Or he's got pockets." },
  { id: "pawn", short: "Lionel. Nicked or not, he'll take it.", r: 5, at: (w) => who(w, (a) => a.npc?.shop === "pawn"), text: "Lionel's pawn shop. He'll take anything, no questions. Pawn something nicked off a steward and he'll see it in the window, and come for it." },
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
