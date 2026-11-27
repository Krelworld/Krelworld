// The mischief director (Left 4 Dead's AI director, for comedy rather than zombies). The rhythm between
// looking around and something paying off should keep moving: no long dead stretches of aimless walking.
// It watches the time since the last payoff (a chain, someone leaving their post, someone going over, the
// ball, a theft) and, if Grozz has been drifting too long, starts a small beat near him, in frame, made of
// systems that already run. Never a marker: an opportunity, happening.
//   - A fan puts his pint down on a wall and goes for a slash. Gone when he gets back? He kicks off.
//   - A steward nips off his post for a fag: a gap, for twenty seconds.
//   - Two fans start a row; a steward comes to break it up (off his post).
// Game build only.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { moveItem, spawnItem } from "../core/items";
import { pick } from "../core/rng";
import { PACE } from "./layout";
import { isSecurity } from "./security";
import { say } from "./npc";
import { chainLink, knockOn } from "./kegs";
import { problem, stim } from "./machine";

/** How long Grozz can go without anything paying off before the world offers something. */
export const LULL_SECONDS = 45;
const PAYOFFS = new Set(["rigged", "chain", "post_left", "bowled", "keg_rolled", "ball_to_pc", "dog_lured", "stole", "knockout", "item_hit", "pawned", "line", "tipoff", "planted", "smashed", "fb_goal", "caught"]);

export interface PintBeat { fan: string; pint: string; back: number }

export function installLulls(w: World): void {
  w.bus.on((e: any) => {
    const st = w.state.stadium;
    if (!st || !PAYOFFS.has(e.type)) return;
    if (e.type === "chain" && e.by !== st.pc) return;
    st.flags.lastPayoff = w.state.tick;
  });
}

const near = (a: Actor, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function stepLulls(w: World): void {
  if (!PACE.calm) return;
  const s = w.state, st = s.stadium!, tick = s.tick, pc = s.actors[st.pc];
  if (!pc || tick % 30 !== 0) return;
  stepPint(w);
  const m = s.match;
  // Busy, or legitimately watching: no lull.
  const watching = pc.seated && m && (m.phase === "live" || m.phase === "restart");
  if (pc.heldBy || pc.hiddenIn || pc.chute || watching || st.detainedUntil > tick || st.ending) { st.flags.lastPayoff = Math.max(st.flags.lastPayoff ?? 0, tick - 60 * 20); return; }
  // Ignored the last offer or two? Maybe he's busy looking round: give him longer before the next.
  const ignored = (st.flags.lastBeat ?? 0) > (st.flags.lastPayoff ?? 0) ? (st.flags.beatsIgnored ?? 0) : 0;
  const since = (tick - Math.max(st.flags.lastPayoff ?? 0, st.flags.lastBeat ?? 0, 60 * 20)) / 60;
  if (since < Math.min(90, LULL_SECONDS + 15 * ignored)) return;
  // Least recently used first, so it's never the same thing twice running.
  const all = [pintBeat, fagBeat, rowBeat], start = ((st.flags.beatKind ?? -1) + 1) % all.length;
  for (let k = 0; k < all.length; k++) {
    const i = (start + k) % all.length;
    if (all[i](w, pc)) { st.flags.lastBeat = tick; st.flags.beatKind = i; st.flags.beatsIgnored = ignored + 1; return; }
  }
}

/** People nearby who could carry a beat: on screen-ish, not busy. */
function locals(w: World, pc: Actor, f: (a: Actor) => boolean): Actor[] {
  const s = w.state, tick = s.tick;
  return Object.values(s.actors).filter((a) => a.npc && !a.dead && !a.hiddenIn && a.downUntil <= tick && a.npc.mode === "routine" && !a.npc.bubble && near(a, pc) > 3 && near(a, pc) < 13 && f(a))
    .sort((p, q) => near(p, pc) - near(q, pc));
}

function pintBeat(w: World, pc: Actor): boolean {
  const s = w.state, st = s.stadium!;
  if (st.pintBeat) return false;
  const fan = locals(w, pc, (a) => (a.npc!.job === "fan" || a.npc!.job === "local") && !a.npc!.group)[0] ?? locals(w, pc, (a) => a.npc!.job === "fan")[0];
  if (!fan) return false;
  const at = { x: fan.x + Math.cos(fan.facing) * 0.7, y: fan.y + Math.sin(fan.facing) * 0.7 };
  const pint = fan.hand && s.items[fan.hand]?.def === "pint" ? s.items[fan.hand] : spawnItem(s, "pint", { k: "ground", ...at });
  moveItem(s, pint.id, { k: "ground", ...at });
  say(w, fan, pick(s.rng.world, ["Mind my pint, I'm bursting.", "Back in a sec. Nobody touch that.", "Watch that for me, I need a slash."]), 4);
  const away = { x: fan.x + (fan.x > pc.x ? 9 : -9), y: fan.y + 2 };
  fan.npc!.plan = [{ k: "wait", s: 1 }, { k: "go", ...away }, { k: "wait", s: 18 }, { k: "go", x: at.x, y: at.y - 0.6 }, { k: "wait", s: 2 }];
  st.pintBeat = { fan: fan.id, pint: pint.id, back: s.tick + 60 * 30 };
  w.bus.emit({ type: "beat", t: s.tick, kind: "pint", x: at.x, y: at.y, who: fan.id, item: pint.id });
  return true;
}

/** He's back: is his pint where he left it? */
function stepPint(w: World): void {
  const s = w.state, st = s.stadium!, b = st.pintBeat;
  if (!b || s.tick < b.back) return;
  const fan = s.actors[b.fan], pint = s.items[b.pint];
  st.pintBeat = undefined;
  if (!fan?.npc || fan.dead || fan.downUntil > s.tick) return;
  if (pint && pint.loc.k === "ground" && !pint.spiked) { moveItem(s, pint.id, { k: "hand", a: fan.id }); say(w, fan, "Cheers, lads.", 2); return; }
  // Gone, or something in it.
  const pc = s.actors[st.pc];
  const holder = pint && (pint.loc.k === "hand" || pint.loc.k === "pocket") ? s.actors[(pint.loc as { a: string }).a] : undefined;
  if (pint?.spiked && pint.loc.k === "ground") { moveItem(s, pint.id, { k: "hand", a: fan.id }); say(w, fan, "Tastes funny, that.", 2); return; }
  const blame = holder ?? Object.values(s.actors).filter((a) => a.npc && a !== fan && !a.dead && (a.npc.job === "fan" || a.npc.job === "local") && near(a, fan) < 6).sort((p, q) => near(p, fan) - near(q, fan))[0];
  if (!blame) { say(w, fan, "Who's had my pint?!", 3); return; }
  say(w, fan, blame.id === pc?.id ? "You've had my pint, you fat thief!" : pick(s.rng.world, ["Did YOU have my pint?!", "That was MY pint!"]), 3);
  if (blame.id === pc?.id) { fan.npc.retaliateAt = s.tick + 30; fan.npc.retaliateOn = pc.id; return; }
  // Somebody else gets the blame: a row, and a steward on his way.
  fan.npc.plan = [{ k: "go", x: blame.x + 0.8, y: blame.y }, { k: "wait", s: 6 }];
  if (blame.npc) { blame.npc.plan = [{ k: "wait", s: 2 }]; say(w, blame, "I never touched your pint!", 3); }
  knockOn(w, fan, "angry", 12, "HIS PINT GOES MISSING", "HE BLAMES THE WRONG BLOKE");
  breakItUp(w, fan, blame);
}

/** A steward's radio packs up and he puts it down by him to fiddle with later: a thing of his, unattended.
 *  (The director sets something up; it never opens a way for you. What you do with a radio is yours.) */
function fagBeat(w: World, pc: Actor): boolean {
  const s = w.state;
  const g = locals(w, pc, (a) => !!a.npc!.post && ["doorguard", "gateguard", "pitchsteward", "corridor", "patrol"].includes(a.npc!.job) && near(a, a.npc!.post!) < 2 && a.pockets.some((id) => s.items[id]?.def === "radio"))[0];
  if (!g) return false;
  const rid = g.pockets.find((id) => s.items[id]?.def === "radio")!, it = s.items[rid];
  const at = { x: g.x + Math.cos(g.facing + 1.2) * 1.1, y: g.y + Math.sin(g.facing + 1.2) * 1.1 };
  moveItem(s, rid, { k: "ground", ...at });
  it.owner = g.id; it.home = at; it.label = `${g.name.split(" ").pop()}'s radio`;
  say(w, g, pick(s.rng.world, ["Battery's flat again. Useless thing.", "Nothing but static. I'll sort it at half-time.", "Radio's packed up. Again."]), 4);
  w.bus.emit({ type: "beat", t: s.tick, kind: "radio", x: at.x, y: at.y, who: g.id, item: rid });
  return true;
}

function rowBeat(w: World, pc: Actor): boolean {
  const s = w.state;
  const fans = locals(w, pc, (a) => a.npc!.job === "fan" && !isSecurity(a));
  if (fans.length < 2) return false;
  const [a, b] = fans;
  if (near(a, b) > 6) return false;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  a.npc!.plan = [{ k: "go", x: mid.x - 0.5, y: mid.y }, { k: "say", text: pick(s.rng.world, ["You spilled my pint, you muppet!", "Say that again. Go on.", "Your lot are a disgrace."]) }, { k: "wait", s: 10 }];
  b.npc!.plan = [{ k: "go", x: mid.x + 0.5, y: mid.y }, { k: "wait", s: 1.5 }, { k: "say", text: pick(s.rng.world, ["Come on then!", "Who are you calling a muppet?!", "Outside. Now."]) }, { k: "wait", s: 9 }];
  w.bus.emit({ type: "beat", t: s.tick, kind: "row", x: mid.x, y: mid.y, who: a.id });
  stim(w, "spectacle", mid, { r: 12, secs: 10, cap: 1 });
  problem(w, "row", mid, { fixSecs: 8, line: "Oi! Pack it in, you two." });
  return true;
}

/** The nearest steward comes over to break it up: off his post for a bit. */
function breakItUp(w: World, a: Actor, b: Actor): void {
  const s = w.state, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const g = Object.values(s.actors).filter((x) => x.npc && isSecurity(x) && x.npc.job !== "police" && x.npc.mode === "routine" && !x.dead && near(x, mid) < 30)
    .sort((p, q) => near(p, mid) - near(q, mid))[0];
  if (!g?.npc) return;
  const back = g.npc.post ?? { x: g.x, y: g.y };
  g.npc.plan = [{ k: "wait", s: 2 }, { k: "go", x: mid.x, y: mid.y + 1 }, { k: "say", text: "Oi! Pack it in, you two." }, { k: "wait", s: 8 }, { k: "go", ...back }];
  g.npc.why = "angry"; g.npc.whyUntil = s.tick + 60 * 18;
  if (s.stadium!.chain && s.tick - s.stadium!.chain.t0 < 60 * 10) chainLink(w, "A STEWARD COMES TO BREAK IT UP", g);
}
