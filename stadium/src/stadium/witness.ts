// Grasses. A fan who sees you do something, with no steward close enough to shout to, doesn't just
// stand there: he says so, and sets off to find one (Hitman's witnesses; RDR2's "crime reported").
// Until he gets there you can stop him: pay him off, threaten him, or flatten him. Some won't grass
// at all: a home fan watching you batter an away fan is more likely to cheer.
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { chance, pick } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { hasProp } from "../core/items";
import { say } from "./npc";
import { alert, isSecurity } from "./security";
import { appearance } from "../core/identity";
import { incapacitated } from "./combat";

export interface Snitch { by: string; target: string; severity: number; what: string; at: number; until: number; to?: string }

/** How long a witness has to find a steward before he gives up (or rings it in). */
const GIVE = 60 * 16;

export const snitchOf = (w: World, id: string) => w.state.stadium!.snitches?.find((x) => x.by === id);

/** A witness with no steward in earshot: becomes a grass, or (tribal loyalty) cheers. Returns true if he dealt with it. */
export function maybeSnitch(w: World, wtn: Actor, by: Actor, what: string, severity: number, victim?: Actor): boolean {
  const s = w.state, st = s.stadium!, r = s.rng.world, n = wtn.npc!;
  if (n.job !== "fan" && n.job !== "local" && n.job !== "barman" && n.job !== "seller" && n.job !== "worker" && n.job !== "cleaner") return false;
  if (st.snitches?.some((x) => x.by === wtn.id)) return true;
  // One of ours, doing one of theirs: have it.
  const ours = appearance(s, by).team === s.match!.teams[0].short;
  if (ours && victim?.npc?.team === 1 && wtn.npc!.team !== 1 && severity <= 2 && wtn !== victim) {
    say(w, wtn, pick(r, ["Have that, you mug!", "Go on, my son!", "Get in! Do him again!", "That's for '66!"]), 2.5);
    return true;
  }
  if (wtn !== victim && chance(r, 0.25)) { say(w, wtn, pick(r, ["I didn't see nothing.", "Not my business.", "Christ. I need a pint."]), 2.5); return true; }
  (st.snitches ??= []).push({ by: wtn.id, target: by.id, severity, what, at: s.tick, until: s.tick + GIVE });
  say(w, wtn, pick(r, ["Right. I'm telling the stewards.", "I saw that! I'm getting security!", "You're getting grassed up, mate.", "STEWARD! Where's a steward?"]), 3);
  w.bus.emit({ type: "snitch", t: s.tick, by: wtn.id, who: by.id, what });
  return true;
}

function nearestSecurity(w: World, a: Actor): Actor | null {
  const s = w.state;
  let best: Actor | null = null, bd = 70;
  for (const id in s.actors) {
    const g = s.actors[id];
    if (!g.npc || !isSecurity(g) || g.hiddenIn || g.dead || g.downUntil > s.tick || g.npc.job === "cleanup") continue;
    const d = Math.hypot(g.x - a.x, g.y - a.y);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}

export function stepSnitches(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!st.snitches?.length) return;
  for (const sn of st.snitches) {
    const a = s.actors[sn.by], by = s.actors[sn.target];
    if (!a?.npc || !by || a.hiddenIn || incapacitated(w, a) || a.downUntil > tick) { sn.until = -1; w.bus.emit({ type: "snitch_stopped", t: tick, by: sn.by, how: "down" }); continue; }
    if (a.npc.paidUntil > tick) { sn.until = -1; continue; }
    const g = nearestSecurity(w, a);
    if (g && Math.hypot(g.x - a.x, g.y - a.y) < 2.4) {
      // Got there.
      a.facing = Math.atan2(g.y - a.y, g.x - a.x);
      say(w, a, pick(s.rng.world, [`That's him! The fat one! He's been ${sn.what}!`, `Oi, mate! Bloke over there, ${sn.what}! Do something!`, `Him! I saw him ${sn.what}!`]), 3.5);
      alert(w, g, by, sn.severity, 1.6);
      g.npc!.lastSeen = { x: by.x, y: by.y, t: tick };
      w.bus.emit({ type: "crime_reported", t: tick, by: a.id, who: by.id, to: g.id });
      a.npc.plan = [{ k: "wait", s: 4 }];
      sn.until = -1;
      continue;
    }
    if (tick >= sn.until) {
      say(w, a, "Ah, sod it. Where are they when you need them.", 2.5);
      sn.until = -1;
      continue;
    }
    // Head for the nearest steward, at a jog; replanned now and then as everyone moves.
    if (g && (tick - sn.at) % 40 === 0) { sn.to = g.id; a.npc.plan = [{ k: "go", x: g.x, y: g.y, run: tick - sn.at > 120 }]; a.npc.mode = "routine"; }
  }
  st.snitches = st.snitches.filter((x) => x.until >= 0);
}

export function installWitness(): void {
  // Lean on him: works better with something nasty in your hand, worse if a steward's watching.
  registerVerb("threaten", {
    check: (w, act, actor) => {
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t?.npc || !snitchOf(w, t.id)) return "nobody to lean on";
      return Math.hypot(t.x - actor.x, t.y - actor.y) < 2.4 ? null : "too far";
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, t = s.actors[(act.target as { id: string }).id], r = s.rng.world;
      const held = actor.hand ? s.items[actor.hand] : undefined;
      const p = 0.5 + (held && hasProp(held, "weapon") ? 0.35 : 0) + ((actor.hurt ?? 0) === 0 ? 0.05 : 0) - (t.female ? 0.1 : 0);
      w.bus.emit({ type: "threatened", t: s.tick, by: actor.id, who: t.id });
      if (chance(r, p)) {
        st.snitches = st.snitches!.filter((x) => x.by !== t.id);
        say(w, t, pick(r, ["Alright! Alright! I saw nothing!", "Okay, okay. Never seen you before in my life.", "Please don't. I've got kids. Somewhere."]), 3);
        t.npc!.plan = [{ k: "go", x: t.x + (t.x - actor.x) * 4, y: t.y + (t.y - actor.y) * 4, run: true }];
        w.bus.emit({ type: "snitch_stopped", t: s.tick, by: t.id, how: "threat" });
      } else {
        say(w, t, pick(r, ["You don't scare me, fatso! STEWARD!", "Do one! I'm still telling!"]), 3);
        const sn = snitchOf(w, t.id); if (sn) sn.until = Math.max(sn.until, s.tick + 60 * 10);
        t.npc!.plan = [];
      }
    },
  });
}

/** Paying off a grass: cheap, and it nearly always works. */
export function bribeSnitch(w: World, t: Actor, amount: number): { ok: boolean; line: string } {
  const s = w.state, st = s.stadium!, r = s.rng.world;
  if (amount < 10) return { ok: false, line: "A fiver? I'm grassing you up for that alone." };
  if (amount < 20 && !chance(r, 0.6)) return { ok: false, line: "Is that it? STEWARD!" };
  st.snitches = st.snitches!.filter((x) => x.by !== t.id);
  t.npc!.paidUntil = s.tick + 60 * 600;
  w.bus.emit({ type: "snitch_stopped", t: s.tick, by: t.id, how: "paid" });
  return { ok: true, line: pick(r, ["Didn't see nothing, mate.", "What fight? Cheers.", "Pleasure doing business. Never met you."]) };
}
