// The fixes: Hitman's mission stories, for a man who wants England to win and has no idea how.
// Three per match: their star, their keeper, the referee. None of them is handed to you. You find
// out about each one by overhearing it (fans gossiping, the barman, a cleaner), and each thing you
// hear adds a way of doing it to your list. The game never checks the steps, only the result: their
// number 10 off the pitch counts whether you framed him, drugged the cooler, put a brick through his
// head from the hotel roof, or something nobody thought of. Do it a way you were never told about
// and it says so.
import type { World } from "../core/world";
import type { Actor } from "../core/types";

export interface FixDef { id: "star" | "keeper" | "ref"; title: (w: World) => string; done: (w: World) => boolean; ways: { id: string; text: string }[] }

/** Their best player: the star if they have one, else their number 10. */
export function theirStar(w: World): Actor | undefined {
  const s = w.state, m = s.match!, squad = m.teams[1].squad.map((id) => s.actors[id]).filter((a) => a?.fb);
  return squad.find((a) => a.fb!.star) ?? squad.find((a) => a.fb!.number === 10) ?? squad[0];
}
export const theirKeeper = (w: World) => w.state.match!.teams[1].squad.map((id) => w.state.actors[id]).find((a) => a?.fb?.role === "GK");
const out = (a?: Actor) => !a || !!a.dead || a.fb?.status === "gone";

export const FIXES: FixDef[] = [
  {
    id: "star", title: (w) => `Their number ${theirStar(w)?.fb?.number ?? 10}`,
    done: (w) => out(theirStar(w)),
    ways: [
      { id: "plant", text: "Slip some gear in his pocket and tip off the police: an officer, or 999 from a burner. They'll have him at the next stoppage." },
      { id: "cooler", text: "Their lot drink from their own cooler by the tunnel before kick-off. Something in that and he's on the toilet all night." },
      { id: "hotel", text: "Their lot walk out of the team hotel to their coach before kick-off. He's always last on, on his own." },
      { id: "high", text: "He's on the pitch for ninety minutes. Anyone up high with something heavy would have a clear go at him." },
    ],
  },
  {
    id: "keeper", title: () => "Their goalkeeper",
    done: (w) => { const k = theirKeeper(w); return out(k) || !!k?.fb?.bribed; },
    ways: [
      { id: "bribe", text: "He likes a bet. Wave a hundred quid at him (more is better) and he might just let one in." },
      { id: "cooler", text: "Keepers drink from the cooler like everyone else." },
      { id: "warmup", text: "He warms up in the goalmouth on his own before kick-off. Nobody's near him." },
    ],
  },
  {
    id: "ref", title: () => "The referee",
    done: (w) => {
      const s = w.state, st = s.stadium!, m = s.match!, ref = s.actors[m.officials.referee];
      return !!ref?.dead || !!ref?.off?.incapacitated || (ref?.off?.bias?.[0] ?? 0) > 0 || (!!st.flags.firstRefNum && st.flags.firstRefNum !== refNum(m.officials.referee));
    },
    ways: [
      { id: "bribe", text: "A hundred and fifty quid and he'll see things England's way. He'll report you if he won't." },
      { id: "tea", text: "He has his tea at half-time from the urn in the corridor. Two sugars." },
      { id: "kit", text: "His spare kit hangs in the officials' room down the tunnel. Nobody looks twice at a man in black." },
      { id: "deck", text: "Mad Mick on the concourse will give fifty quid to whoever puts him on his backside." },
    ],
  },
];
const refNum = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;

/** What, overheard, tells you about which fix (and which way of doing it). */
const HINTS: { re: RegExp; fix: FixDef["id"]; way?: string }[] = [
  { re: /number 10|their star|take him out and they've got nothing/i, fix: "star" },
  { re: /plant|tip(ped)? off|grass on someone/i, fix: "star", way: "plant" },
  { re: /cooler/i, fix: "star", way: "cooler" },
  { re: /last on (the|their) coach|out of the team hotel/i, fix: "star", way: "hotel" },
  { re: /stand roof|up there with a brick/i, fix: "star", way: "high" },
  { re: /their keeper|their goalkeeper|goalie/i, fix: "keeper" },
  { re: /likes a bet|on himself to concede/i, fix: "keeper", way: "bribe" },
  { re: /goalmouth|warms up/i, fix: "keeper", way: "warmup" },
  { re: /\bref\b|referee/i, fix: "ref" },
  { re: /tea at half-time|two sugars|\burn\b/i, fix: "ref", way: "tea" },
  { re: /fifty quid'd do it|bent.*penalty|hundred and fifty/i, fix: "ref", way: "bribe" },
  { re: /spare (ref's )?kit|officials' room/i, fix: "ref", way: "kit" },
  { re: /decks that referee|put him on his arse/i, fix: "ref", way: "deck" },
];

/** Something was said near you. Does it tell you anything? */
export function overhear(w: World, text: string): void {
  const st = w.state.stadium!, f = st.flags;
  for (const h of HINTS) {
    if (!h.re.test(text)) continue;
    if (!f[`fix_${h.fix}`]) {
      f[`fix_${h.fix}`] = w.state.tick || 1;
      w.bus.emit({ type: "fix_found", t: w.state.tick, id: h.fix, title: FIXES.find((x) => x.id === h.fix)!.title(w) });
    }
    if (h.way && !f[`fixw_${h.fix}_${h.way}`]) {
      f[`fixw_${h.fix}_${h.way}`] = w.state.tick || 1;
      w.bus.emit({ type: "fix_way", t: w.state.tick, id: h.fix, way: h.way });
    }
  }
}

export function installFixes(w: World): void {
  const s = w.state, st = s.stadium!;
  st.flags.firstRefNum = refNum(s.match!.officials.referee);
  w.bus.on((e) => {
    if (e.type !== "say") return;
    const a = s.actors[e.by], pc = s.actors[st.pc];
    if (!a || !pc || a === pc || Math.hypot(a.x - pc.x, a.y - pc.y) > 9) return;
    overhear(w, e.text);
  });
}

export function stepFixes(w: World): void {
  const s = w.state, st = s.stadium!, f = st.flags;
  if (s.tick % 30 !== 0 || !s.match || s.match.phase === "finished") return;
  for (const fx of FIXES) {
    if (f[`fixdone_${fx.id}`] || !fx.done(w)) continue;
    f[`fixdone_${fx.id}`] = s.tick || 1;
    const known = fx.ways.some((wy) => f[`fixw_${fx.id}_${wy.id}`]);
    w.bus.emit({ type: "fix_done", t: s.tick, id: fx.id, title: fx.title(w), heard: !!f[`fix_${fx.id}`], ownWay: !known });
  }
}

export const fixesDone = (w: World) => FIXES.filter((fx) => w.state.stadium!.flags[`fixdone_${fx.id}`]).length;
