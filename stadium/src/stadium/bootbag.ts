// The hotel's contraption (the report's zone table: "Team hotel: staff routine or luggage error"). Their
// star's boot bag sits by the coach while the driver loads. Move it (hide it, bin it, pawn it) and when
// they board he finds it gone and goes looking: off the queue, the coach waiting for him. Find it and he's
// fine. Don't, and he plays in borrowed boots, and the match engine's numbers say so. The same rule as
// the kegs (people leave their post to fix a problem), on a footballer.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { moveItem, spawnItem } from "../core/items";
import { pick } from "../core/rng";
import { busRear } from "./bus";
import { theirStar } from "./fixes";
import { chainLink, knockOn } from "./kegs";
import { say } from "./npc";

export interface BootHunt { who: string; bag: string; until: number; pts: { x: number; y: number }[]; i: number; waited?: boolean }

export function spawnBootBag(w: World): void {
  const s = w.state, st = s.stadium!, v = st.vehicles.bus, star = s.match ? theirStar(w) : undefined;
  if (!v || !star) return;
  const r = busRear(v), at = { x: r.x + 1.4, y: r.y + 0.9 };
  const bag = spawnItem(s, "boot_bag", { k: "ground", ...at });
  bag.home = at; bag.owner = star.id;
  bag.label = `Their number ${star.fb?.number ?? 10}'s boot bag`;
}

/** Called from the team walk while they board: true if this player is off looking for his boots. */
export function bootHuntGoal(w: World, a: Actor): { x: number; y: number } | null {
  const h = w.state.stadium!.bootHunt;
  if (!h || h.who !== a.id || w.state.tick >= h.until) return null;
  return h.pts[h.i % h.pts.length];
}

export function stepBootBag(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (tick % 15 !== 0) return;
  const bag = Object.values(s.items).find((i) => i.def === "boot_bag");
  if (!bag) return;
  // Boarding starts: is the bag where he left it?
  if (st.flags.boarding && !st.flags.bootChecked) {
    st.flags.bootChecked = tick;
    const star = bag.owner ? s.actors[bag.owner] : undefined;
    const home = bag.home!, l = bag.loc;
    const there = l.k === "ground" && Math.hypot(l.x - home.x, l.y - home.y) < 2.5;
    if (there) { moveItem(s, bag.id, { k: "gone" }); return; } // packed, off they go
    if (!star || star.fb?.status === "gone" || star.hiddenIn || star.dead) return;
    st.bootHunt = { who: star.id, bag: bag.id, until: tick + 60 * 18, i: 0, pts: [home, { x: home.x + 3.5, y: home.y + 2 }, { x: home.x - 3, y: home.y + 1.5 }, { x: home.x + 1, y: home.y - 3 }] };
    say(w, star, pick(s.rng.world, ["Where's my boots?! Who's had my bloody boots?!", "My boots! They were RIGHT HERE!", "Nobody gets on this bus till I find my boots!"]), 4);
    const no = (star.fb?.number ?? 10);
    knockOn(w, star, "search", 18, `NUMBER ${no}'S BOOTS GO MISSING`, `HE GOES LOOKING`);
    return;
  }
  const h = st.bootHunt;
  if (!h) return;
  const star = s.actors[h.who], v = st.vehicles.bus;
  if (!star || star.hiddenIn || star.fb?.status === "gone") { st.bootHunt = undefined; return; }
  // The coach doesn't go without him.
  if (v && v.state === "loading") { v.until = Math.max(v.until, tick + 120); if (!h.waited && tick > h.until - 60 * 16) { h.waited = true; chainLink(w, "THE COACH WAITS FOR HIM", v); } }
  const l = bag.loc;
  // Spotted them on the floor nearby: he goes and gets them.
  if (l.k === "ground" && Math.hypot(l.x - star.x, l.y - star.y) < 10) {
    if (Math.hypot(l.x - star.x, l.y - star.y) < 1.3) {
      moveItem(s, bag.id, { k: "gone" });
      say(w, star, pick(s.rng.world, ["Got 'em. Some joker.", "Who put my boots over there?!", "Found 'em. Unbelievable."]), 3);
      st.bootHunt = undefined;
      return;
    }
    h.pts = [{ x: l.x, y: l.y }]; h.i = 0;
  } else if (Math.hypot(h.pts[h.i % h.pts.length].x - star.x, h.pts[h.i % h.pts.length].y - star.y) < 1) h.i++;
  // Grozz walking about with them under his arm, right in front of him.
  const pc = s.actors[st.pc];
  if (pc && (l.k === "hand" || l.k === "pocket") && l.a === pc.id && Math.hypot(pc.x - star.x, pc.y - star.y) < 4 && !st.flags.bootSeen) {
    st.flags.bootSeen = tick;
    say(w, star, "OI! Them's MY boots, you fat thief!", 3.5);
  }
  if (tick >= h.until) {
    // Sod it: borrowed boots, a size too small. It shows.
    if (star.fb) { star.fb.shooting = Math.max(0.05, star.fb.shooting * 0.72); star.fb.composure = Math.max(0, star.fb.composure - 0.2); star.fb.control = Math.max(0.05, star.fb.control * 0.85); }
    say(w, star, pick(s.rng.world, ["Sod it. I'll borrow some. They're two sizes too small.", "Fine. FINE. Somebody lend us some boots."]), 4);
    st.flags.borrowedBoots = 1;
    knockOn(w, undefined, "search", 0, `NUMBER ${star.fb?.number ?? 10} IN BORROWED BOOTS`, "TWO SIZES TOO SMALL");
    w.bus.emit({ type: "borrowed_boots", t: tick, who: star.id });
    st.bootHunt = undefined;
  }
}
