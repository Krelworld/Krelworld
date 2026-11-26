// Grozz's phone. A cracked Nokia that's in his name, so anything dodgy rung in on it gets traced back
// to him. Find (or buy) a burner and nobody knows it was you, though a burner's only good for one
// hoax before the SIM gets snapped.
//
// Who you can ring:
//   999      tip off the police about anyone you can see (a footballer you've planted gear on, the
//            steward on a door you want left unguarded); or ring in a bomb threat, which holds the
//            kick-off or stops the match.
//   Shezleigh  the wife. She says hello. You say something unforgivable and hang up.
//   Spliff Ricky  a dealer who comes to you. Only once someone's given you his number.
//   Bare-Knuckle Brendan  pay him and he'll flatten anyone you point at. Same.
// (GTA IV's phonebook that fills as you meet people; Watch Dogs 2's police hoax; Hitman 3's burner.)
import type { World } from "../core/world";
import type { Actor, Item } from "../core/types";
import { pick } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { moveItem } from "../core/items";
import { haltPlay } from "../football/api";
import { findPath } from "./nav";
import { say, spawnStaff } from "./npc";
import { alert, crime, isSecurity } from "./security";
import { incapacitated, land } from "./combat";
import { overhear as overheard } from "./fixes";
import { raiseSecurity } from "./kickoff";
import { SPOTS, VENUE } from "./layout";

export interface PhoneState {
  calls: number;
  /** Your own phone was used for a hoax: the police know where you are from this tick. */
  traceAt?: number;
  trackUntil?: number;
  bombs?: number;
  dealer?: { id: string; until: number };
  boxer?: { id: string; target: string; until: number; stage: number; nextHit: number };
}

export const BOXER_FEE = 50;
export const CONTACTS = {
  police: "999",
  wife: "Shezleigh",
  dealer: "Spliff Ricky",
  boxer: "Bare-Knuckle Brendan",
} as const;
export type Contact = keyof typeof CONTACTS;

const ph = (w: World): PhoneState => (w.state.stadium!.phone ??= { calls: 0 });
export const burnerOn = (w: World, a: Actor): Item | undefined =>
  [a.hand, ...a.pockets].map((id) => (id ? w.state.items[id] : undefined)).find((it) => it?.def === "burner");
export const knows = (w: World, c: Contact) => c === "police" || c === "wife" || !!w.state.stadium!.flags[`contact_${c}`];

/** Somewhere a few dozen steps away along the walk to you: where a contact turns up from. */
function arrivalPoint(x: number, y: number, from: { x: number; y: number }): { x: number; y: number } {
  const p = findPath(x, y, from.x, from.y);
  let left = 16, cx = x, cy = y;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const d = Math.hypot(p[i] - cx, p[i + 1] - cy);
    if (d >= left) { const k = left / d; return { x: cx + (p[i] - cx) * k, y: cy + (p[i + 1] - cy) * k }; }
    left -= d; cx = p[i]; cy = p[i + 1];
  }
  return { x: cx, y: cy };
}

export function installPhone(): void {
  // Somebody rings you. Kev's half-time whisper counts as overheard; Ricky leaves you his number.
  registerVerb("callin", {
    check: (_w, act) => (act.arg ? null : "nobody"),
    perform: (w, act) => {
      const st = w.state.stadium!, [who, ...rest] = (act.arg ?? "").split("|"), text = rest.join("|");
      if (who === "ricky" && !st.flags.contact_dealer) { st.flags.contact_dealer = w.state.tick || 1; w.bus.emit({ type: "contact", t: w.state.tick, id: "dealer" }); }
      if (text) overheard(w, text);
    },
  });
  registerVerb("call", {
    check: (w, act, actor) => {
      const st = w.state.stadium!, [who, arg] = (act.arg ?? "").split(":") as [Contact | "bomb", string?];
      if (actor.heldBy || st.detainedUntil > w.state.tick) return "not while they've got hold of you";
      if (act.item && w.state.items[act.item]?.def !== "burner") return "that's not a phone";
      if (act.item && !burnerOn(w, actor)) return "you haven't got the burner";
      if (who === "bomb") {
        if ((ph(w).bombs ?? 0) >= 3) return "they've stopped taking you seriously";
        return w.state.match!.phase === "finished" ? "the match is over" : null;
      }
      if (!(who in CONTACTS) || !knows(w, who as Contact)) return "you haven't got that number";
      if (who === "police") {
        const t = arg ? w.state.actors[arg] : undefined;
        if (!t || t === actor) return "report who?";
        if (st.tipoffs.some((x) => x.target === t.id && x.stage !== "done")) return "they're already looking into it";
      }
      if (who === "boxer") {
        if (ph(w).boxer) return "Brendan's already on a job";
        const t = arg ? w.state.actors[arg] : undefined;
        if (!t || t === actor || incapacitated(w, t)) return "sort who out?";
        if (actor.money < BOXER_FEE) return `Brendan wants £${BOXER_FEE} up front`;
      }
      if (who === "dealer" && ph(w).dealer) return "Ricky's already on his way";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, m = s.match!, P = ph(w), tick = s.tick;
      const [who, arg] = (act.arg ?? "").split(":") as [Contact | "bomb", string?];
      const burner = act.item ? s.items[act.item] : undefined;
      P.calls++;
      w.bus.emit({ type: "phone_call", t: tick, by: actor.id, to: who, burner: !!burner });

      if (who === "bomb") {
        P.bombs = (P.bombs ?? 0) + 1;
        st.flags.bombUntil = tick + 60 * 45;
        raiseSecurity(w);
        // Before kick-off it holds the start; during the match it stops play (kickoff.ts).
        if (m.phase !== "pre") haltPlay(w, "bomb");
        w.bus.emit({ type: "bomb_threat", t: tick, pre: m.phase === "pre" });
        if (burner) { moveItem(s, burner.id, { k: "gone" }); w.bus.emit({ type: "burner_snapped", t: tick }); }
        else { P.traceAt = tick + 60 * 30; }
        return;
      }
      if (who === "police") {
        const t = s.actors[arg!];
        // The nearest officer who isn't busy gets it from control.
        let cop: Actor | null = null, bd = 1e9;
        for (const id in s.actors) {
          const a = s.actors[id];
          if (a.npc?.job !== "police" || a.npc.mode !== "routine" || a.dead || a.downUntil > tick || a.hiddenIn) continue;
          const d = Math.hypot(a.x - t.x, a.y - t.y);
          if (d < bd) { bd = d; cop = a; }
        }
        if (!cop) { w.bus.emit({ type: "phone_result", t: tick, text: "\"All units are busy. Try again later, caller.\"" }); return; }
        // From your own phone the tip has your name on it; from a burner, it's anonymous.
        st.tipoffs.push({ target: t.id, by: burner ? "" : actor.id, officer: cop.id, at: tick, stage: "going" });
        say(w, cop, "Control, received. On my way.", 3);
        w.bus.emit({ type: "tipoff", t: tick, by: actor.id, on: t.id, phone: true });
        return;
      }
      if (who === "wife") { st.flags.wifeCalls = (st.flags.wifeCalls ?? 0) + 1; return; }
      if (who === "dealer") {
        const inside = VENUE.inside(actor.x, actor.y);
        const meet = inside ? SPOTS.tout : { x: actor.x, y: actor.y };
        const from = arrivalPoint(meet.x, meet.y, SPOTS.arrival);
        const d = spawnStaff(w, "seller", "none", "Spliff Ricky", from.x, from.y, { shop: "dealer", lines: ["Quick, quick. I'm parked on a double yellow.", "Cash only. Don't say my name.", "You never saw me."] });
        d.npc!.post = undefined;
        d.npc!.plan = [{ k: "go", x: meet.x + 0.9, y: meet.y + 0.4, run: true }, { k: "wait", s: 75 }];
        P.dealer = { id: d.id, until: tick + 60 * 110 };
        w.bus.emit({ type: "phone_result", t: tick, text: inside ? "\"Inside? I'm not paying to get in. Meet you outside the turnstiles.\"" : "\"Two minutes. Don't move.\"" });
        return;
      }
      if (who === "boxer") {
        const t = s.actors[arg!];
        actor.money -= BOXER_FEE;
        const from = arrivalPoint(t.x, t.y, SPOTS.arrival);
        const b = spawnStaff(w, "local", "fan", "Bare-Knuckle Brendan", from.x, from.y, { hasTicket: true, lines: ["Who's the lucky boy?", "Fifty quid's fifty quid."] });
        b.npc!.post = undefined;
        b.npc!.plan = [{ k: "go", x: t.x, y: t.y, run: true }];
        P.boxer = { id: b.id, target: t.id, until: tick + 60 * 90, stage: 0, nextHit: 0 };
        w.bus.emit({ type: "phone_result", t: tick, text: `"${t.name}? Consider it done. I'll be ten minutes. Five if he's fat."` });
      }
    },
  });
}

/** Contacts on their way, and the police tracing your phone. */
export function stepPhone(w: World): void {
  const s = w.state, st = s.stadium!, P = st.phone, tick = s.tick;
  if (!P) return;
  const pc = s.actors[st.pc];
  // Traced: every copper in the area knows where you're stood, for a while.
  if (P.traceAt && tick >= P.traceAt) {
    P.traceAt = undefined; P.trackUntil = tick + 60 * 40;
    w.bus.emit({ type: "traced", t: tick });
    if (pc) crime(w, pc, "making a hoax call", 3, undefined, false);
  }
  if (P.trackUntil && pc) {
    if (tick > P.trackUntil) P.trackUntil = undefined;
    else if (tick % 30 === 0) for (const id in s.actors) {
      const g = s.actors[id];
      if (g.npc?.job === "police" && !g.dead && g.downUntil <= tick && Math.hypot(g.x - pc.x, g.y - pc.y) < 120) { alert(w, g, pc, 3, 1.6); g.npc.lastSeen = { x: pc.x, y: pc.y, t: tick }; }
    }
  }
  if (P.dealer) {
    const d = s.actors[P.dealer.id];
    if (!d || tick > P.dealer.until || incapacitated(w, d)) {
      if (d && !incapacitated(w, d)) { d.npc!.plan = [{ k: "go", x: SPOTS.arrival.x, y: SPOTS.arrival.y + 10 }, { k: "despawn" }]; d.npc!.shop = undefined; }
      P.dealer = undefined;
    }
  }
  if (P.boxer) stepBoxer(w, P);
}

function stepBoxer(w: World, P: PhoneState): void {
  const s = w.state, tick = s.tick, B = P.boxer!, b = s.actors[B.id], t = s.actors[B.target], r = s.rng.world;
  const leave = () => { if (b?.npc && !incapacitated(w, b)) b.npc.plan = [{ k: "go", x: SPOTS.arrival.x, y: SPOTS.arrival.y + 10, run: true }, { k: "despawn" }]; P.boxer = undefined; };
  if (!b || incapacitated(w, b) || b.heldBy) { P.boxer = undefined; return; }
  if (!t || t.hiddenIn || tick > B.until) { if (b) say(w, b, "Can't find him. No refunds.", 3); leave(); return; }
  if (incapacitated(w, t)) { say(w, b, pick(r, ["Pleasure doing business.", "He'll not be getting up. Ta-ra.", "Sorted. Tell your mates."]), 3); w.bus.emit({ type: "boxer_done", t: tick, who: t.id }); leave(); return; }
  const d = Math.hypot(t.x - b.x, t.y - b.y);
  if (d > 1.7) {
    if (tick % 30 === 0) b.npc!.plan = [{ k: "go", x: t.x, y: t.y, run: true }];
    return;
  }
  b.npc!.plan = [{ k: "wait", s: 1 }];
  b.facing = Math.atan2(t.y - b.y, t.x - b.x);
  if (tick < B.nextHit) return;
  if (B.stage === 0) say(w, b, pick(r, [`${t.name}? Someone wants a word.`, "Nothing personal, pal.", "Fifty quid says you're going to sleep."]), 2);
  B.stage++;
  B.nextHit = tick + 26;
  // He does this for a living: every one's a haymaker. The stewards only get involved once it's done.
  if (land(w, b, t, false, true) !== "hurt") crime(w, b, "assault", 2, t);
  w.bus.emit({ type: "struck", t: tick, by: b.id, who: t.id, weapon: false, dx: Math.cos(b.facing), dy: Math.sin(b.facing) });
  // A steward he's beating up still radios for help; that's Brendan's problem, not yours.
  if (isSecurity(t) && B.stage === 1) say(w, t, "Oi! Get off me!", 2);
}
