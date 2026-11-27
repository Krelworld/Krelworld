// Guidance that stays optional (Hitman's tracked mission stories, the Goose's to-do list): where a
// tracked lead or fix points, which jobs on the list are close at hand, and what Instinct lights up.
// All read-only views of the sim; nothing here changes the world.
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { AREAS, SPOTS, VENUE } from "../stadium/layout";
import { FIXES, theirKeeper, theirStar } from "../stadium/fixes";
import { LEADS } from "../stadium/entries";

export interface Tracked { kind: "fix" | "lead"; id: string; way?: string }
export interface Target { x: number; y: number; label: string; text: string; done: boolean }

const byName = (w: World, name: string) => Object.values(w.state.actors).find((a) => a.name === name && !a.dead);
const byJob = (w: World, job: string) => Object.values(w.state.actors).find((a) => a.npc?.job === job && !a.dead);
const furn = (key: string) => VENUE.furniture.find((f) => f.key === key);
/** Where an item is: on the ground, in a container, or on whoever has it. */
export function itemAt(w: World, it: Item | undefined): { x: number; y: number } | null {
  if (!it) return null;
  const l = it.loc, s = w.state;
  if (l.k === "ground" || l.k === "air") return { x: l.x, y: l.y };
  if (l.k === "in") return itemAt(w, s.items[l.c]) ?? (s.actors[l.c] ? { x: s.actors[l.c].x, y: s.actors[l.c].y } : null);
  if (l.k === "hand" || l.k === "pocket" || l.k === "worn") { const a = s.actors[l.a]; return a ? { x: a.x, y: a.y } : null; }
  return null;
}
const itemDef = (w: World, def: string) => itemAt(w, Object.values(w.state.items).find((i) => i.def === def && i.loc.k !== "gone"));
const pos = (a?: Actor | null) => (a ? { x: a.x, y: a.y } : null);
const area = (id: string) => { const a = AREAS.find((x) => x.id === id); return a ? { x: a.x + a.w / 2, y: a.y + a.h / 2 } : null; };

/** Where a tracked lead or fix points now, what to show, and whether it's finished. */
export function trackTarget(w: World, t: Tracked): Target | null {
  const st = w.state.stadium!, f = st.flags, m = w.state.match!;
  if (t.kind === "lead") {
    const lead = LEADS.find((l) => l.id === t.id);
    if (!lead) return null;
    const at =
      t.id === "drain" ? (furn("hatch") ?? null) : t.id === "card" ? pos(byName(w, "Wally the kit man")) : t.id === "hamper" ? itemDef(w, "laundry")
      : t.id === "scaffold" ? (furn("scaffold") ?? null) : t.id === "ladder" ? (furn("ladder_stand") ?? null) : t.id === "chute" ? itemDef(w, "kitbag")
      : t.id === "mascot" ? pos(byJob(w, "mascot")) : t.id === "press" ? pos(byName(w, "Reporter")) : t.id === "lorry" ? (st.vehicles.lorry ? { x: st.vehicles.lorry.x, y: st.vehicles.lorry.y } : null)
      : t.id === "smoker" ? SPOTS.staffDoor : t.id === "tout" ? pos(byName(w, "Dodgy Del")) : null;
    if (!at) return null;
    return { x: at.x, y: at.y, label: lead.title, text: lead.how, done: !!st.admitted };
  }
  const fx = FIXES.find((x) => x.id === t.id);
  if (!fx) return null;
  const way = fx.ways.find((wy) => wy.id === t.way);
  const ref = w.state.actors[m.officials.referee];
  const at =
    t.id === "star" ? (t.way === "plant" ? pos(byJob(w, "police")) : t.way === "cooler" ? itemDef(w, "cooler_away") : t.way === "hotel" ? SPOTS.hotelLobby : t.way === "high" ? (furn("ladder_stand") ?? null) : pos(theirStar(w)))
    : t.id === "keeper" ? (t.way === "cooler" ? itemDef(w, "cooler_away") : pos(theirKeeper(w)))
    : t.way === "tea" ? itemDef(w, "tea_urn") : t.way === "kit" ? area("ref_room") : t.way === "deck" ? pos(byName(w, "Mad Mick")) : pos(ref);
  if (!at) return null;
  return { x: at.x, y: at.y, label: fx.title(w), text: way?.text ?? "Nobody's said how. Find a way.", done: !!f[`fixdone_${fx.id}`] };
}

/** Where each to-do job happens, roughly: the nearest open ones are worth showing on the notepad. */
export function todoSpot(w: World, id: string): { x: number; y: number } | null {
  const st = w.state.stadium!, dog = st.dog ? w.state.actors[st.dog.id] : null;
  switch (id) {
    case "in": return SPOTS.turnstiles[1];
    case "horse": return pos(Object.values(w.state.actors).find((a) => a.npc?.mounted));
    case "car": return furn("parkedcar") ?? null;
    case "pitch": case "streak": return { x: 0, y: 0 };
    case "dog": return pos(dog);
    case "bus": return SPOTS.busPark;
    case "chute": return itemDef(w, "kitbag");
    case "lenny": return pos(byJob(w, "mascot"));
    case "roof": return furn("ladder_pub") ?? furn("ladder_shop") ?? null;
    case "window": return itemDef(w, "brick");
    case "stench": return SPOTS.pubBar;
    case "rifle": return itemDef(w, "rifle");
    default: return null;
  }
}

/** What Instinct lights up: things you can use (yellow), people a fix is about (red), with a label. */
export function instinctMarks(w: World): { x: number; y: number; col: number; label: string; z?: number }[] {
  const s = w.state, st = s.stadium!, m = s.match!, out: { x: number; y: number; col: number; label: string; z?: number }[] = [];
  const USEFUL = new Set(["keg", "brick", "fart_can", "rifle", "wrench", "kitbag", "laundry", "cooler_away", "cooler_home", "tea_urn", "hivis", "staff_pass", "press_pass", "kit_card", "radio", "ticket", "pool_cue", "knife", "hammer", "bottle", "chair"]);
  for (const it of Object.values(s.items)) {
    if (it.loc.k !== "ground" || !USEFUL.has(it.def)) continue;
    out.push({ x: it.loc.x, y: it.loc.y, col: 0xf2c94c, label: "" });
  }
  for (const f of VENUE.furniture) if (/^ladder/.test(f.key) || f.key === "hatch" || f.key === "scaffold" || f.key === "fruitmachine") out.push({ x: f.x, y: f.y, col: 0x7dffa8, label: "" });
  const fixT: [Actor | undefined, string][] = [[theirStar(w), "Their number " + (theirStar(w)?.fb?.number ?? 10)], [theirKeeper(w), "Their keeper"], [s.actors[m.officials.referee], "The referee"]];
  for (const [a, label] of fixT) if (a && !a.dead) out.push({ x: a.x, y: a.y, col: 0xd7263d, label, z: 1.9 });
  for (const n of ["Dodgy Del", "Wally the kit man", "Mad Mick", "Reporter"]) { const a = byName(w, n); if (a) out.push({ x: a.x, y: a.y, col: 0x6cb4ff, label: n.replace("the kit man", "").trim(), z: 1.9 }); }
  if (st.dog && s.actors[st.dog.id]) out.push({ x: s.actors[st.dog.id].x, y: s.actors[st.dog.id].y, col: 0xf2c94c, label: "Ronson", z: 0.9 });
  return out;
}
