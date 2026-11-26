// Getting it all out. Grozz strips off (his clothes go in a heap where he stands) and walks about
// starkers, with a very small black bar where it matters. Everybody has something to say about it;
// every steward is an enforcer; and the pitch is right there.
// Streaking stops the match (Saints Row's streaking is a timed shock-the-public activity; here the
// payoff is the stoppage, and the crowd).
import type { World } from "../core/world";
import type { Actor } from "../core/types";
import { chance, pick, rnd } from "../core/rng";
import { registerVerb } from "../core/verbs";
import { moveItem, spawnItem } from "../core/items";
import { haltPlay, resumePlay } from "../football/api";
import { say } from "./npc";
import { canSee, crime, isSecurity, alert } from "./security";
import { areaAt } from "./layout";
import { fresh } from "./chatter";
import { isWoman } from "./lech";
import { found } from "./scenarios";

export const isNaked = (a: Actor) => !!a.naked && !a.worn.outer && !a.worn.inner;

export const NAKED_SHOUTS = [
  "He's got his willy out!", "He's a pervert!", "Put it away, you dirty bastard!", "Is that it?!", "Oh my God, there's a naked man!",
  "Someone get a steward! Or a magnifying glass!", "That's not a willy, that's a rumour.", "Mate! MATE! Your knob's out!",
  "My kids are here, you animal!", "Honestly? I've seen bigger on a hamster.", "Get him a bigger censor bar. No, wait. Smaller.",
  "Is it cold out or is he just like that?", "I'm filming this. For the police. Mainly.", "Legend! Absolute legend!",
];
const WOMEN_SHOUTS = ["Eurgh! Put it away!", "Is that a chipolata?", "My husband's is bigger, and he's got nothing.", "Pervert! PERVERT!", "Oh, bless him. Bless."];

export function installNaked(): void {
  registerVerb("strip", {
    check: (w, _act, actor) => (actor.naked ? "you've nothing left to take off" : actor.heldBy ? "not now" : null),
    perform: (w, _act, actor) => {
      const s = w.state, r = s.rng.world;
      // Everything off, in a heap at your feet.
      for (const slot of ["outer", "inner", "head", "face", "body"] as const) {
        const id = actor.worn[slot];
        if (id) moveItem(s, id, { k: "ground", x: actor.x + (rnd(r) - 0.5) * 0.4, y: actor.y + 0.3 });
      }
      actor.naked = true;
      w.bus.emit({ type: "stripped", t: s.tick, by: actor.id });
    },
  });
  registerVerb("dress", {
    check: (_w, _act, actor) => (actor.naked ? null : "you're dressed"),
    perform: (w, _act, actor) => { actor.naked = false; w.bus.emit({ type: "dressed", t: w.state.tick, by: actor.id }); },
  });
}

/** The public reaction, the stewards' reaction, and the pitch. */
export function stepNaked(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, pc = s.actors[st.pc], m = s.match!, r = s.rng.world, f = st.flags;
  if (!pc) return;
  const bare = isNaked(pc) && !pc.hiddenIn;
  const onPitch = bare && areaAt(pc.x, pc.y).pitch;
  // The match stops for a streaker, and starts when he's off (or caught).
  if (onPitch && (m.phase === "live" || m.phase === "restart") && !m.halted) {
    haltPlay(w, "streaker");
    f.streaks = (f.streaks ?? 0) + 1;
    w.bus.emit({ type: "streak", t: tick, n: f.streaks });
    for (const id in s.actors) { const g = s.actors[id]; if (isSecurity(g) && g.npc!.job === "pitchsteward" && g.downUntil <= tick) alert(w, g, pc, 2, 1.8); }
  }
  if (m.halted === "streaker" && (!onPitch || pc.heldBy)) { resumePlay(w); w.bus.emit({ type: "streak_over", t: tick, caught: !!pc.heldBy }); }
  if (!bare || tick % 40 !== 0) return;
  // Onlookers: someone always has something to say.
  let shouted = false;
  for (const id in s.actors) {
    const a = s.actors[id], n = a.npc;
    if (!n || a.hiddenIn || a.dead || a.downUntil > tick || a === pc) continue;
    const d = Math.hypot(a.x - pc.x, a.y - pc.y);
    if (d > 9 || !canSee(w, a, pc, 9)) continue;
    if (isSecurity(a)) {
      // Indecent exposure: they'll have you for it.
      if (tick > (f.nakedSeenUntil ?? 0)) { f.nakedSeenUntil = tick + 60 * 8; crime(w, pc, "indecent exposure", 2, undefined, false); }
      continue;
    }
    if (n.job !== "fan" && n.job !== "local" && n.job !== "seller" && n.job !== "barman") continue;
    if (!shouted && !n.bubble && tick > (f.nakedShoutAt ?? 0) && chance(r, 0.6)) {
      shouted = true; f.nakedShoutAt = tick + 60 * 2.2;
      say(w, a, fresh(w, isWoman(a) && chance(r, 0.6) ? WOMEN_SHOUTS : NAKED_SHOUTS, a), 2.6);
      w.bus.emit({ type: "naked_seen", t: tick, by: a.id, female: isWoman(a) });
    }
    // Phones out.
    if (!n.gawk && n.mode === "routine" && chance(r, 0.3)) n.gawk = { until: tick + 60 * 5, x: pc.x, y: pc.y, filming: chance(r, 0.6) };
  }
  // The odd kindly soul lends you something.
  if (!f.coatLent && chance(r, 0.03)) {
    const kind = Object.values(s.actors).find((a) => a.npc && (a.npc.job === "fan" || a.npc.job === "local") && !a.female && !a.dead && a.downUntil <= tick && Math.hypot(a.x - pc.x, a.y - pc.y) < 3);
    if (kind && !pc.hand) { f.coatLent = 1; say(w, kind, pick(r, ["Here, mate. Put this on. You're scaring the kids.", "Christ. Take my top. Please. I'm begging you."]), 3); spawnItem(s, "tracksuit", { k: "hand", a: pc.id }); w.bus.emit({ type: "gift", t: tick, by: kind.id, def: "tracksuit" }); found(w, "coat"); }
  }
}
