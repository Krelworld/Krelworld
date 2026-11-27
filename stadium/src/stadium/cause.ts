// Who caused what. Every state change Grozz causes gets a root; whatever follows from it (a keg knocks a
// man over, the man rows with the drayman, a steward comes to break it up) is a child that knows its
// ancestry. Nothing is inferred afterwards from timing: the steward's event still knows about the keg.
// That one graph gives the chain count on screen, the off-screen "that was you" cue, the replay, the
// tabloid's attribution and the playtest measure of what players combine for themselves.
//
// The older calls (chainStart / chainLink, a running chain with a time window) are kept as a thin layer
// over it, so the bespoke knock-ons written before the graph still read as chains.
import type { World } from "../core/world";
import type { Actor, Id } from "../core/types";

/** Which family of rule made the link (for telling an authored set piece from a combination). */
export type RuleFamily = "act" | "custody" | "obligation" | "attraction" | "attention" | "belief" | "process" | "access" | "physics" | "authored" | "grievance" | "need" | "capacity" | "authority" | "recognition";

export interface Cause {
  id: number; parent: number; root: number;
  label: string; t: number; x: number; y: number;
  who?: Id; rule: RuleFamily;
  /** How sure the world can be that this was Grozz's doing: 1 at the root, less with every remove. */
  conf: number;
}
export interface Chain { t0: number; links: string[]; by: string; pts?: { x: number; y: number }[]; root?: number; cur?: number; rules?: RuleFamily[] }
type At = { x: number; y: number };

const CAP = 400;
const WINDOW = 60 * 14;

function nodes(w: World): Cause[] { return (w.state.stadium!.causes ??= []); }
export const causeById = (w: World, id: number | undefined): Cause | undefined => (id ? nodes(w).find((c) => c.id === id) : undefined);
export const treeOf = (w: World, root: number): Cause[] => nodes(w).filter((c) => c.root === root);

function view(w: World, root: number, cur: number): void {
  const st = w.state.stadium!, tree = treeOf(w, root);
  if (!tree.length) return;
  const rules = [...new Set(tree.map((c) => c.rule))];
  st.chain = { t0: w.state.tick, links: tree.map((c) => c.label), by: st.pc, pts: tree.map((c) => ({ x: c.x, y: c.y })), root, cur, rules };
  if (tree.length >= 2) {
    if (!st.chainBest || tree.length > st.chainBest.links.length) st.chainBest = { ...st.chain, links: st.chain.links.slice(), pts: st.chain.pts!.slice() };
    const last = tree[tree.length - 1];
    w.bus.emit({ type: "chain", t: w.state.tick, links: st.chain.links.slice(), pts: st.chain.pts!.slice(), by: st.pc, root, rules, rule: last.rule, x: last.x, y: last.y, who: last.who });
  }
}

/** Something Grozz did. Returns its id, to hand to whatever follows from it. */
export function rootCause(w: World, label: string, at?: At, rule: RuleFamily = "act"): number {
  const st = w.state.stadium!, pc = w.state.actors[st.pc], list = nodes(w);
  const id = (st.causeSeq = (st.causeSeq ?? 0) + 1);
  list.push({ id, parent: 0, root: id, label, t: w.state.tick, x: at?.x ?? pc?.x ?? 0, y: at?.y ?? pc?.y ?? 0, rule, conf: 1 });
  if (list.length > CAP) list.splice(0, list.length - CAP);
  view(w, id, id);
  return id;
}

/** Something that followed from it. The same label twice in one tree is the same event (returns the first). */
export function linkCause(w: World, parent: number | undefined, label: string, at?: At | Actor, rule: RuleFamily = "authored"): number {
  const p = causeById(w, parent);
  if (!p) return 0;
  const st = w.state.stadium!, list = nodes(w);
  const dup = list.find((c) => c.root === p.root && c.label === label);
  if (dup) return dup.id;
  const id = (st.causeSeq = (st.causeSeq ?? 0) + 1);
  list.push({ id, parent: p.id, root: p.root, label, t: w.state.tick, x: at?.x ?? p.x, y: at?.y ?? p.y, who: at && "id" in at ? at.id : undefined, rule, conf: p.conf * 0.85 });
  if (list.length > CAP) list.splice(0, list.length - CAP);
  view(w, p.root, id);
  return id;
}

/** Someone acting because of it carries it for a while: what he then sets off is its child. */
export function carry(a: Actor, id: number, tick: number, secs = 40): void {
  if (!a.npc || !id) return;
  a.npc.cause = id; a.npc.causeUntil = tick + 60 * secs;
}
export const carried = (w: World, a: Actor | undefined): number => (a?.npc?.cause && (a.npc.causeUntil ?? 0) > w.state.tick ? a.npc.cause : 0);

/** The running chain, if there's one still warm (the older, time-window way of joining things up). */
export function running(w: World): number {
  const c = w.state.stadium!.chain;
  return c?.cur && w.state.tick - c.t0 <= WINDOW ? c.cur : 0;
}

// ---- The older calls, kept. ----
export function chainStart(w: World, _by: string, first: string, at?: At): void { rootCause(w, first, at); }
export function chainLink(w: World, link: string, at?: At | Actor): void { linkCause(w, running(w), link, at); }
