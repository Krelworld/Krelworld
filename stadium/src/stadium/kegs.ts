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

const HOMES = [{ x: -31.6, y: 68.6 }, { x: -30.9, y: 68.9 }, { x: -31.25, y: 68.2 }];
const LOOSE = { x: -30.1, y: 69.5 };
const mx = (x: number) => (VENUE.id === "sf" ? -x : x);

export interface Roll { id: string; vx: number; vy: number; by: string }
export interface Chain { t0: number; links: string[]; by: string; pts?: { x: number; y: number }[] }
type At = { x: number; y: number };

/** A stack of three and one loose at the edge, by the pub's back door where the lorry loads. */
export function spawnKegs(w: World): void {
  const s = w.state;
  for (const h of [...HOMES, LOOSE]) {
    const it = spawnItem(s, "keg", { k: "ground", x: mx(h.x), y: h.y });
    it.home = { x: mx(h.x), y: h.y };
  }
}

/** Start a chain (something Grozz did), or add a link to the one running. */
export function chainStart(w: World, by: string, first: string, at?: At): void {
  const st = w.state.stadium!, pc = w.state.actors[st.pc];
  st.chain = { t0: w.state.tick, links: [first], by, pts: [at ? { x: at.x, y: at.y } : { x: pc?.x ?? 0, y: pc?.y ?? 0 }] };
}
/** A link: where it happened is kept too, for the pundit's arrows and the front page. */
export function chainLink(w: World, link: string, at?: At): void {
  const st = w.state.stadium!, c = st.chain, pc = w.state.actors[st.pc];
  if (!c || w.state.tick - c.t0 > 60 * 14 || c.links.includes(link)) return;
  c.links.push(link);
  (c.pts ??= []).push(at ? { x: at.x, y: at.y } : { x: pc?.x ?? 0, y: pc?.y ?? 0 });
  c.t0 = Math.max(c.t0, w.state.tick - 60 * 6); // each link buys a few more seconds for the next
  // The day's best chain (the longest), for the front page.
  if (!st.chainBest || c.links.length > st.chainBest.links.length) st.chainBest = { t0: c.t0, by: c.by, links: c.links.slice(), pts: c.pts.slice() };
  w.bus.emit({ type: "chain", t: w.state.tick, links: c.links.slice(), pts: c.pts.slice(), by: c.by });
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
      if (actor.id === st.pc) chainStart(w, actor.id, "KEG", l);
      w.bus.emit({ type: "keg_rolled", t: s.tick, by: actor.id, item: it.id, x: l.x, y: l.y });
    },
  });
}

export function stepKegs(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
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
  // Carried back: it goes where he goes.
  if (st.kegCarry) for (const kid in st.kegCarry) {
    const a = s.actors[st.kegCarry[kid]], it = s.items[kid];
    if (!a || !it || a.dead || a.downUntil > tick || a.hiddenIn) { delete st.kegCarry[kid]; continue; }
    if (it.loc.k === "ground") { it.loc.x = a.x + Math.cos(a.facing) * 0.45; it.loc.y = a.y + Math.sin(a.facing) * 0.45; }
  }
  if (tick % 10 !== 0) return;
  const dray = Object.values(s.actors).find((a) => a.npc?.job === "worker" && !a.dead);
  // A fella who's been bowled over has words with the drayman, if he's about.
  for (const key in st.flags) {
    if (!key.startsWith("kegVictim_") || st.flags[key] > tick) continue;
    const v = s.actors[key.slice(10)]; delete st.flags[key];
    if (!v?.npc || v.dead || !dray || Math.hypot(dray.x - v.x, dray.y - v.y) > 18) continue;
    v.npc.plan = [{ k: "go", x: dray.x + 0.9, y: dray.y }, { k: "say", text: pick(s.rng.world, ["Oi! Watch your bloody kegs!", "You nearly broke my leg, you prick!", "Who taught you to stack kegs?!"]) }, { k: "wait", s: 3 }];
    if (dray.npc) { dray.npc.plan.unshift({ k: "wait", s: 3 }); say(w, dray, pick(s.rng.world, ["Not my fault, mate!", "It rolled on its own!", "Some fat bloke did it!"]), 3); }
    chainLink(w, "A ROW WITH THE DRAYMAN", v);
  }
  if (!dray?.npc || dray.hiddenIn || dray.downUntil > tick) return;
  const n = dray.npc;
  const fetching = n.fetch ? s.items[n.fetch] : undefined;
  if (fetching) {
    const l = fetching.loc as { x: number; y: number }, home = fetching.home!;
    const carried = st.kegCarry?.[fetching.id] === dray.id;
    if (!carried && fetching.loc.k === "ground" && Math.hypot(l.x - dray.x, l.y - dray.y) < 1.1 && !st.rolling?.some((r) => r.id === fetching.id)) {
      (st.kegCarry ??= {})[fetching.id] = dray.id;
      n.plan = [{ k: "go", x: home.x, y: home.y + 0.6 }];
      say(w, dray, pick(s.rng.world, ["Bloody kids.", "Every bloody week.", "Who's touching my kegs?"]), 2.5);
    } else if (carried && !n.plan.length) {
      delete st.kegCarry![fetching.id];
      moveItem(s, fetching.id, { k: "ground", x: home.x, y: home.y });
      n.fetch = undefined; n.why = undefined;
    } else if (!carried && !n.plan.length) n.plan = [{ k: "go", x: l.x, y: l.y }];
    return;
  }
  // He notices one that's not where it should be (once it's stopped), and goes after it.
  if (n.mode !== "routine" || n.plan.some((p) => p.k === "go" && Math.hypot(p.x - dray.x, p.y - dray.y) > 40)) return;
  const stray = Object.values(s.items).find((i) => i.def === "keg" && i.home && i.loc.k === "ground" && !st.rolling?.some((r) => r.id === i.id)
    && Math.hypot(i.loc.x - i.home.x, i.loc.y - i.home.y) > 1.4 && Math.hypot(i.loc.x - dray.x, i.loc.y - dray.y) < 30);
  if (!stray) return;
  const l = stray.loc as { x: number; y: number };
  n.fetch = stray.id; n.why = "fetch"; n.whyUntil = tick + 60 * 30;
  n.plan = [{ k: "go", x: l.x, y: l.y }];
  say(w, dray, pick(s.rng.world, ["Oi! Where's that going?", "Bloody hell, my keg!", "Who's rolled that?!"]), 2.5);
  w.bus.emit({ type: "post_left", t: tick, by: dray.id, why: "keg", x: dray.x, y: dray.y });
  chainLink(w, "DRAYMAN GOES AFTER IT", dray);
  const lorry = Object.values(st.vehicles).find((v) => v.kind === "lorry");
  if (lorry && (lorry.state === "loading" || lorry.state === "unloading") && Math.hypot(lorry.x - dray.x, lorry.y - dray.y) < 15) chainLink(w, "LORRY LEFT OPEN", lorry);
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
  }
  st.pawnSeek = st.pawnSeek.filter((q) => !done.has(q));
}

/** While he's off after a keg the lorry doesn't go without him: the back stays open. */
export function drayAway(w: World): boolean {
  const dray = Object.values(w.state.actors).find((a) => a.npc?.job === "worker" && !a.dead);
  return !!dray?.npc?.fetch;
}
