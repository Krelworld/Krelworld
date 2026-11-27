// The first contraption: the drayman's kegs at the pub yard. Roll one off the stack and he goes after
// it, leaving the back of the lorry open (a way in) and his post empty; anyone in its path goes over,
// and has words with him about it. One rule, shown once: people leave their post to fix a problem.
// The same rule already runs elsewhere (Para Steve and his chute, Lenny, Wally's card, the press pass).
//
// It also keeps the chain: something Grozz does starts one; reactions within a few seconds add links;
// the view names it on screen ("KEG → DRAYMAN GOES AFTER IT → LORRY LEFT OPEN").
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { ITEM_DEFS, spawnItem, moveItem } from "../core/items";
import { registerVerb } from "../core/verbs";
import { PACE, SOLID, VENUE } from "./layout";
import { say } from "./npc";
import { pick } from "../core/rng";
import { chainLink, chainStart } from "./cause";

const HOMES = [{ x: -31.6, y: 68.6 }, { x: -30.9, y: 68.9 }, { x: -31.25, y: 68.2 }];
const LOOSE = { x: -30.1, y: 69.5 };
const mx = (x: number) => (VENUE.id === "sf" ? -x : x);

export interface Roll { id: string; vx: number; vy: number; by: string }
export type { Chain } from "./cause";
export { chainStart, chainLink } from "./cause";
type At = { x: number; y: number };

/** A stack of three and one loose at the edge, by the pub's back door where the lorry loads. */
export function spawnKegs(w: World): void {
  const s = w.state;
  for (const h of [...HOMES, LOOSE]) {
    const it = spawnItem(s, "keg", { k: "ground", x: mx(h.x), y: h.y });
    it.home = { x: mx(h.x), y: h.y };
  }
}

/** The football's own knock-ons: Grozz puts it in, and whether it stands is up to the officials. */
export function installChainHooks(w: World): void {
  w.bus.on((e: any) => {
    const st = w.state.stadium;
    if (!st || (e.type !== "fb_goal" && e.type !== "fb_no_goal") || e.by !== st.pc) return;
    knockOn(w, undefined, "search", 0, "GROZZ PUTS IT IN", e.type === "fb_no_goal" ? "THE REF SAW HIM: NO GOAL" : "THE REF NEVER SAW: IT STANDS");
  });
}

/** A knock-on somewhere else (Steve's chute, Lenny, Wally's card, the press pass): name it as a chain
 *  (joining one already running), badge whoever's broken off, and count it as someone leaving their post. */
export function knockOn(w: World, who: Actor | At | undefined, why: "search" | "report" | "angry", secs: number, first: string, ...links: string[]): void {
  const s = w.state, st = s.stadium!, tick = s.tick, c = st.chain;
  if (!c || tick - c.t0 > 60 * 14) chainStart(w, st.pc, first, who); else chainLink(w, first, who);
  for (const l of links) chainLink(w, l, who);
  if (who && "npc" in who && who.npc) {
    who.npc.why = why; who.npc.whyUntil = tick + 60 * secs;
    // In the game, a beat to react before he goes (the double-take the view plays), so you see the cause land.
    if (PACE.calm && who.npc.plan.length && who.npc.plan[0].k !== "wait") who.npc.plan.unshift({ k: "wait", s: 0.75 });
    w.bus.emit({ type: "post_left", t: tick, by: who.id, why, x: who.x, y: who.y });
  }
}

const wallAt = (x: number, y: number) => SOLID.some((q) => q.h3 >= 0.5 && x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
const kegNear = (w: World, a: Actor, r = 1.8): Item | undefined =>
  Object.values(w.state.items).find((i) => i.def === "keg" && i.loc.k === "ground" && Math.hypot(i.loc.x - a.x, i.loc.y - a.y) < r && !w.state.stadium!.kegCarry?.[i.id]);

export function installKegs(): void {
  registerVerb("shove", {
    check: (w, act, actor) => {
      const it = act.item ? w.state.items[act.item] : kegNear(w, actor);
      if (!it || it.def !== "keg" || it.loc.k !== "ground") return "nothing to roll";
      if (Math.hypot(it.loc.x - actor.x, it.loc.y - actor.y) > 1.9) return "too far";
      if (w.state.stadium!.kegCarry?.[it.id]) return "he's got it";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, it = (act.item ? s.items[act.item] : kegNear(w, actor))!;
      const l = it.loc as { x: number; y: number };
      // Away from you, the way you're facing; a good shove sends it six or seven metres.
      let dx = l.x - actor.x, dy = l.y - actor.y; const d = Math.hypot(dx, dy) || 1;
      dx = dx / d * 0.5 + Math.cos(actor.facing) * 0.5; dy = dy / d * 0.5 + Math.sin(actor.facing) * 0.5;
      const k = Math.hypot(dx, dy) || 1, sp = 5.2;
      st.rolling = (st.rolling ?? []).filter((r) => r.id !== it.id);
      st.rolling.push({ id: it.id, vx: dx / k * sp, vy: dy / k * sp, by: actor.id });
      if (actor.id === st.pc) { chainStart(w, actor.id, "KEG", l); it.cause = st.chain?.cur; it.causeAt = s.tick; it.movedBy = actor.id; }
      w.bus.emit({ type: "keg_rolled", t: s.tick, by: actor.id, item: it.id, x: l.x, y: l.y });
    },
  });
}

export function stepKegs(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  // The first thing you see (the report's first-five-minutes staging): three seconds in, the loose keg
  // slips off the top of the drayman's stack, clangs down and rolls to the edge, and he shouts at it.
  // Something moving and a noise, in frame, before anyone has told you anything.
  if (PACE.calm && !st.flags.kegIntro && tick === 60 * 3) {
    st.flags.kegIntro = 1;
    const it = Object.values(s.items).find((i) => i.def === "keg" && i.home && Math.abs(Math.abs(i.home.x) - Math.abs(mx(LOOSE.x))) < 0.05 && i.loc.k === "ground");
    if (it && it.loc.k === "ground") {
      const from = { x: mx(-31.25), y: 68.75 }, v = 1.33, d = Math.hypot(it.home!.x - from.x, it.home!.y - from.y) || 1;
      it.loc.x = from.x; it.loc.y = from.y;
      (st.rolling ??= []).push({ id: it.id, vx: ((it.home!.x - from.x) / d) * v, vy: ((it.home!.y - from.y) / d) * v, by: "intro" });
      w.bus.emit({ type: "keg_slip", t: tick, item: it.id, x: from.x, y: from.y });
      const dray = Object.values(s.actors).find((a) => a.npc?.job === "worker" && !a.dead && !a.hiddenIn);
      if (dray) say(w, dray, pick(s.rng.world, ["Oi! Stay there, you bastard!", "Bloody thing. STAY.", "Not again. Every week."]), 3);
    }
  }
  // Rolling: friction, walls stop it, people in the way go over.
  if (st.rolling?.length) {
    for (const r of st.rolling) {
      const it = s.items[r.id];
      if (!it || it.loc.k !== "ground") { r.vx = r.vy = 0; continue; }
      const l = it.loc, nx = l.x + r.vx / 60, ny = l.y + r.vy / 60;
      if (wallAt(nx, ny)) { r.vx *= -0.25; r.vy *= -0.25; }
      else { l.x = nx; l.y = ny; }
      r.vx *= 0.988; r.vy *= 0.988;
      const sp = Math.hypot(r.vx, r.vy);
      if (sp > 1.8) for (const id in s.actors) {
        const a = s.actors[id];
        if (a.id === r.by || a.dead || a.hiddenIn || a.downUntil > tick || a.fb || a.off || a.npc?.job === "dog") continue;
        if (Math.hypot(a.x - l.x, a.y - l.y) > 0.65) continue;
        a.downUntil = tick + 100; a.vx = a.vy = 0;
        r.vx *= 0.6; r.vy *= 0.6;
        w.bus.emit({ type: "bowled", t: tick, who: a.id, by: r.by, x: a.x, y: a.y });
        chainLink(w, `BOWLED OVER ${(a.name.split(" ").pop() ?? "").toUpperCase()}`, a);
        if (a.npc) { a.npc.why = "angry"; a.npc.whyUntil = tick + 60 * 8; st.flags[`kegVictim_${a.id}`] = tick + 100; }
      }
    }
    st.rolling = st.rolling.filter((r) => Math.hypot(r.vx, r.vy) > 0.35);
  }
  if (tick % 10 !== 0) return;
  const dray = Object.values(s.actors).find((a) => a.npc?.job === "worker" && !a.dead);
  // He says where this lot's going, so you know what the lorry is before you know what to do about it.
  if (PACE.calm && dray?.npc && !dray.hiddenIn && dray.npc.mode === "routine" && !dray.npc.duty && !dray.npc.bubble && (tick === 60 * 8 || (tick > 60 * 8 && tick % (60 * 24) === 0))) {
    const lorry = Object.values(st.vehicles).find((v) => v.kind === "lorry");
    if (lorry && lorry.state === "loading") say(w, dray, pick(s.rng.world, ["Six more for the ground, then I'm round the back with this lot.", "Service gate, straight in. No queueing for me.", "Last run to the ground before kick-off, this.", "Straight into the loading bay, me. Nobody checks a beer lorry."]), 4);
  }
  // A fella who's been bowled over has words with the drayman, if he's about.
  for (const key in st.flags) {
    if (!key.startsWith("kegVictim_") || st.flags[key] > tick) continue;
    const v = s.actors[key.slice(10)]; delete st.flags[key];
    if (!v?.npc || v.dead || !dray || Math.hypot(dray.x - v.x, dray.y - v.y) > 18) continue;
    v.npc.plan = [{ k: "go", x: dray.x + 0.9, y: dray.y }, { k: "say", text: pick(s.rng.world, ["Oi! Watch your bloody kegs!", "You nearly broke my leg, you prick!", "Who taught you to stack kegs?!"]) }, { k: "wait", s: 3 }];
    if (dray.npc) { dray.npc.plan.unshift({ k: "wait", s: 3 }); say(w, dray, pick(s.rng.world, ["Not my fault, mate!", "It rolled on its own!", "Some fat bloke did it!"]), 3); }
    chainLink(w, "A ROW WITH THE DRAYMAN", v);
  }
  // Going after a keg that's out of place is custody (machine.ts): the same rule as anybody's anything.
}

/** The pawn shop: whoever's stolen thing turned up in the window storms over to get it back, leaving
 *  his post (the same rule as the keg: give people a problem and they go). */
export function stepPawnSeek(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.pawnSeek?.length || tick % 15 !== 0) return;
  const shop = Object.values(s.actors).find((a) => a.npc?.shop === "pawn" && !a.dead);
  const done = new Set<typeof st.pawnSeek[number]>();
  for (const p of st.pawnSeek.filter((q) => q.at <= tick)) {
    const a = s.actors[p.who], n = a?.npc;
    // Gone, or it's been ages: he's given up on it. Busy (after you, down, hiding): later.
    if (!a || !n || a.dead || !shop || tick - p.at > 60 * 120) { done.add(p); continue; }
    if (a.downUntil > tick || a.hiddenIn || n.mode !== "routine") continue;
    done.add(p);
    const thing = ITEM_DEFS[p.def]?.name.toLowerCase().replace(/^the /, "") ?? "stuff";
    n.plan = [{ k: "go", x: shop.x + 1.6, y: shop.y + 1.6 }, { k: "say", text: `Oi! That's MY ${thing} in your window!` }, { k: "wait", s: 15 }, ...(n.post ? [{ k: "go" as const, ...n.post }] : [])];
    say(w, a, pick(s.rng.world, [`Someone's pawned my ${thing}!`, `My ${thing}'s in the pawn shop?!`, `Right. Where's that pawn shop.`]), 3);
    knockOn(w, a, "angry", 30, `${thing.toUpperCase()} IN THE PAWN SHOP WINDOW`, `${a.name.split(" ").pop()!.toUpperCase()} GOES TO GET IT BACK`, ...(n.post ? ["POST LEFT EMPTY"] : []));
    if (p.item) (st.pawnBack ??= []).push({ who: a.id, item: p.item });
  }
  st.pawnSeek = st.pawnSeek.filter((q) => !done.has(q));
}

/** He's got there, and it's his: he walks out with it. Lionel's out of pocket, and remembers who sold it him. */
export function stepPawnBack(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.pawnBack?.length || tick % 20 !== 0) return;
  const shop = Object.values(s.actors).find((a) => a.npc?.shop === "pawn" && !a.dead);
  st.pawnBack = st.pawnBack.filter((p) => {
    const a = s.actors[p.who], it = s.items[p.item];
    if (!a?.npc || a.dead || !it || !shop) return false;
    if (it.owner !== shop.id || it.loc.k !== "ground") return false; // sold on, or somebody's had it since
    if (Math.hypot(a.x - shop.x, a.y - shop.y) > 3.2 || a.npc.plan[0]?.k !== "wait") return a.npc.plan.length > 0;
    moveItem(s, it.id, { k: "pocket", a: a.id });
    it.owner = undefined; it.home = undefined; it.stolenFrom = undefined;
    say(w, a, "That's stolen, that. I'm having it back.", 3);
    shop.npc!.plan.unshift({ k: "say", text: pick(s.rng.world, ["Oi! I paid good money for that!", "That's twenty quid walking out my door!", "Who sold me that? ...The fat one."]) });
    st.flags.lionelBurned = (st.flags.lionelBurned ?? 0) + 1;
    a.npc.plan = a.npc.post ? [{ k: "wait", s: 2 }, { k: "go", ...a.npc.post }] : [{ k: "wait", s: 2 }];
    chainLink(w, "HE WALKS OUT WITH IT", a);
    chainLink(w, "LIONEL'S OUT OF POCKET, AND KNOWS WHO TO BLAME", shop);
    w.bus.emit({ type: "pawn_back", t: tick, who: a.id, item: it.id });
    return false;
  });
}

/** While he's off after a keg the lorry doesn't go without him: the back stays open. */
export function drayAway(w: World): boolean {
  const dray = Object.values(w.state.actors).find((a) => a.npc?.job === "worker" && !a.dead);
  return !!dray?.npc?.fetch;
}
