// Planting things on people, tipping off the police, and playing at being the police.
import { knockOn } from "./kegs";
import { appearance } from "../core/identity";
import { canPocket, defOf, hasProp, moveItem } from "../core/items";
import { chance, pick } from "../core/rng";
import type { Action, Actor, Id, Item } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { removePlayer } from "../football/api";
import { areaAt, SPOTS } from "./layout";
import { say } from "./npc";
import { canSee, crime, isSecurity } from "./security";

const near = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => Math.hypot(a.x - b.x, a.y - b.y) <= r;
const targetActor = (w: World, act: Action) => (act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined);
const illicitOn = (w: World, a: Actor): Item | undefined =>
  [a.hand, ...a.pockets].filter((x): x is string => !!x).map((id) => w.state.items[id]).find((it) => hasProp(it, "illicit") || hasProp(it, "weapon"));

/** Silly things to arrest people for. The more official it sounds, the better. */
const CHARGES = [
  "possession of a controlled pastry", "conspiracy to dive", "loitering with intent to score", "being offside in a public place",
  "an offensive haircut", "impersonating a footballer", "handling stolen goals", "aggravated time-wasting",
];

export function installPolice(): void {
  registerVerb("plant", {
    check: (w, act, actor, item) => {
      const t = targetActor(w, act);
      if (!item || (actor.hand !== item.id && !actor.pockets.includes(item.id))) return "not carrying it";
      if (defOf(item).size !== "small") return "too big to slip into a pocket";
      if (!t || t === actor || t.hiddenIn) return "nobody to plant it on";
      if (!near(actor, t, 1.5)) return "too far";
      if (t.pockets.length >= 3) return "his pockets are full";
      return null;
    },
    perform: (w, act, actor, item) => {
      const s = w.state, t = targetActor(w, act)!;
      const behind = Math.cos(Math.atan2(actor.y - t.y, actor.x - t.x) - t.facing) < -0.2;
      const moving = Math.hypot(t.vx, t.vy) > 2;
      const p = (behind ? 0.8 : 0.4) - (moving ? 0.25 : 0) - (isSecurity(t) ? 0.3 : 0);
      if (!chance(s.rng.world, p)) {
        if (t.npc) say(w, t, "Oi! What are you putting in my pocket?");
        crime(w, actor, "planting something on someone", 1, t);
        return;
      }
      moveItem(s, item!.id, { k: "pocket", a: t.id });
      item!.plantedBy = actor.id;
      w.bus.emit({ type: "planted", t: s.tick, by: actor.id, on: t.id, item: item!.def });
    },
  });

  // Tell a police officer that someone is carrying something they shouldn't.
  registerVerb("report", {
    check: (w, act, actor) => {
      const officer = Object.values(w.state.actors).find((a) => a.npc?.job === "police" && near(a, actor, 3.6) && a.npc.mode === "routine");
      if (!officer) return "no police officer to talk to";
      const t = targetActor(w, act);
      if (!t || t === actor) return "report who?";
      if (w.state.stadium!.tipoffs.some((x) => x.target === t.id && x.stage !== "done")) return "they're already looking into it";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, t = targetActor(w, act)!;
      const officer = Object.values(s.actors).find((a) => a.npc?.job === "police" && near(a, actor, 3.6) && a.npc.mode === "routine")!;
      say(w, officer, t.fb ? `${t.name}? The footballer? ...Right. Leave it with me.` : "Right. I'll have a word.", 4);
      st.tipoffs.push({ target: t.id, by: actor.id, officer: officer.id, at: s.tick, stage: "going" });
      w.bus.emit({ type: "tipoff", t: s.tick, by: actor.id, on: t.id });
    },
  });

  // Wearing the uniform, you can arrest anyone you like. Whether they come quietly is another matter.
  registerVerb("arrest", {
    check: (w, act, actor) => {
      if (appearance(w.state, actor).role !== "police") return "you're not the police";
      const t = targetActor(w, act);
      if (!t || t === actor || (!t.npc && !t.fb)) return "arrest who?";
      if (!near(actor, t, 1.8)) return "too far";
      if (t.npc?.job === "police") return "he IS the police";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, t = targetActor(w, act)!, r = s.rng.world, m = s.match!;
      const ap = appearance(s, actor);
      const charge = pick(r, CHARGES);
      say(w, actor, `I'm arresting you for ${charge}.`, 4);
      // A real officer who sees it knows a fake when he sees one.
      const realCop = Object.values(s.actors).find((a) => a.npc?.job === "police" && canSee(w, a, actor, 18));
      if (realCop) {
        say(w, realCop, "Oi! Which station are you from?");
        crime(w, actor, "impersonating a police officer", 2);
        return;
      }
      const uniform = actor.worn.outer && s.items[actor.worn.outer].def === "police_uniform";
      let p = uniform ? 0.75 : 0.35;
      if (ap.faceCover >= 1) p -= 0.3;
      if (isSecurity(t)) p -= 0.25;
      if (t.fb && areaAt(t.x, t.y).id === "pitch" && m.phase === "live") p -= 0.2;
      if (!chance(r, p)) {
        say(w, t, pick(r, ["You're not a real copper.", "Show me your badge.", "Is that hat from a fancy dress shop?"]));
        crime(w, actor, "impersonating a police officer", 2, t);
        return;
      }
      w.bus.emit({ type: "false_arrest", t: s.tick, by: actor.id, who: t.id, charge });
      if (t.fb) { removePlayer(w, t.id, "arrested"); return; }
      // Anyone else is marched off and spends the rest of the day explaining himself.
      say(w, t, "This is a miscarriage of justice.");
      t.npc!.plan = [{ k: "go", x: SPOTS.ejectPoint.x, y: SPOTS.ejectPoint.y + 6 }, { k: "despawn" }];
      t.npc!.mode = "routine"; t.npc!.post = undefined; t.npc!.job = "local";
    },
  });

  // Take something out of a container: the police van, or your own things from the security office.
  registerVerb("takeout", {
    check: (w, act, actor, item) => {
      if (!item || item.loc.k !== "in") return "nothing to take";
      const box = w.state.items[item.loc.c];
      if (!box || box.loc.k !== "ground" || !near(actor, box.loc, 2.6)) return "too far";
      return null;
    },
    perform: (w, act, actor, item) => {
      const s = w.state, box = s.items[(item!.loc as { c: Id }).c];
      if (canPocket(actor, item!)) moveItem(s, item!.id, { k: "pocket", a: actor.id });
      else { if (actor.hand) moveItem(s, actor.hand, { k: "ground", x: actor.x, y: actor.y }); moveItem(s, item!.id, { k: "hand", a: actor.id }); }
      const anyone = Object.values(s.actors).some((a) => a.npc && a.npc.job !== "player" && a.npc.job !== "official" && canSee(w, a, actor, 12));
      if (anyone) crime(w, actor, box.def === "locker" ? "helping himself to the confiscation locker" : "stealing from a police van", box.def === "locker" ? 1 : 2, undefined, false);
    },
  });
}

/** Police follow up tip-offs: walk to the person, search them, and arrest them if there's anything to find. */
export function stepTipoffs(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick;
  for (const tip of st.tipoffs) {
    if (tip.stage === "done") continue;
    const cop = s.actors[tip.officer], t = s.actors[tip.target], by = s.actors[tip.by];
    if (!cop || !t) { tip.stage = "done"; continue; }
    if (cop.npc!.mode !== "routine") continue; // busy with something else
    if (t.fb && t.fb.status !== "playing" && t.fb.status !== "bench") { tip.stage = "done"; continue; }
    // A footballer on the pitch is dealt with at the tunnel at the next stoppage; anyone else, where they stand.
    const onPitch = !!t.fb && areaAt(t.x, t.y).pitch;
    const dest = onPitch ? SPOTS.tunnelTop : t;
    const n = cop.npc!;
    if (tip.stage === "going") {
      // Take over his plan: walk to the person (re-planning if they have moved on).
      const cur = n.plan[0];
      if (!cur || cur.k !== "go" || Math.hypot(cur.x - dest.x, cur.y - dest.y) > 3) n.plan = [{ k: "go", x: dest.x, y: dest.y }];
      if (near(cop, dest, onPitch ? 3 : 1.8)) tip.stage = "waiting";
      continue;
    }
    if (onPitch && (m.phase === "live" || m.phase === "goal_pause")) { n.plan = [{ k: "wait", s: 1 }]; continue; } // wait for a stoppage
    if (tick - tip.at > 60 * 240) { tip.stage = "done"; continue; }
    // The search.
    tip.stage = "done";
    const found = illicitOn(w, t);
    // A copper turning out someone's pockets draws a crowd: the stewards and coppers nearby leave what
    // they're doing to come and watch (people leave their post for a problem; a show counts).
    if (!t.fb && t.npc && t.id !== st.pc) {
      const watchers = Object.values(s.actors).filter((a) => a !== cop && a !== t && a.npc && isSecurity(a) && a.npc.mode === "routine" && !a.dead && a.downUntil <= tick && Math.hypot(a.x - t.x, a.y - t.y) < 16)
        .sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y)).slice(0, 3);
      watchers.forEach((a, i) => {
        const ang = (i / 3) * Math.PI * 2, back = a.npc!.post ?? { x: a.x, y: a.y };
        a.npc!.plan = [{ k: "go", x: t.x + Math.cos(ang) * 2.4, y: t.y + Math.sin(ang) * 2.4 }, { k: "wait", s: 14 }, { k: "go", x: back.x, y: back.y }];
        a.npc!.gawk = { x: t.x, y: t.y, until: tick + 60 * 20, filming: false };
      });
      if (by?.id === st.pc) knockOn(w, watchers[0] ?? cop, "search", 20, "GRASSED UP TO THE OLD BILL", "COPPER TURNS HIS POCKETS OUT", ...(watchers.length ? [watchers.length > 1 ? "THE STEWARDS COME TO WATCH" : "A STEWARD COMES TO WATCH"] : []), ...(found?.plantedBy ? ["NICKED FOR SOMETHING HE NEVER HAD"] : []));
      for (const a of watchers.slice(1)) { a.npc!.why = "search"; a.npc!.whyUntil = tick + 60 * 20; w.bus.emit({ type: "post_left", t: tick, by: a.id, why: "search", x: a.x, y: a.y }); }
    }
    if (found) {
      say(w, cop, `And what's this, then? You're coming with me.`, 4);
      moveItem(s, found.id, { k: "gone" });
      w.bus.emit({ type: "tipoff_arrest", t: tick, who: t.id, item: found.def, planted: !!found.plantedBy });
      if (t.fb) removePlayer(w, t.id, "arrested");
      else if (t.id === st.pc) { st.ending = { kind: "arrested", title: "Arrested", text: `The police found ${defOf(found).name.toLowerCase()} on you.` }; }
      else if (t.npc) { t.npc.plan = [{ k: "go", x: SPOTS.ejectPoint.x, y: SPOTS.ejectPoint.y + 6 }, { k: "despawn" }]; t.npc.post = undefined; t.npc.job = "local"; t.npc.mode = "routine"; }
    } else {
      say(w, cop, isSecurity(t) && t.npc?.job !== "police" ? "We've had a report about you, sir. Come with me a minute." : "Nothing on him. Somebody's wasting police time.", 4);
      w.bus.emit({ type: "tipoff_clean", t: tick, who: t.id });
      // A steward who's been grassed up gets taken aside: his door's unguarded while they have their chat.
      if (isSecurity(t) && t.npc && t.npc.job !== "police" && !t.npc.target) {
        const back = t.npc.post ?? { x: t.x, y: t.y };
        const aside = { x: SPOTS.policeVan.x, y: SPOTS.policeVan.y - 1.5 };
        t.npc.plan = [{ k: "go", x: aside.x, y: aside.y }, { k: "wait", s: 40 }, { k: "go", x: back.x, y: back.y }];
        cop.npc!.plan = [{ k: "go", x: aside.x + 0.9, y: aside.y }, { k: "wait", s: 40 }];
        w.bus.emit({ type: "guard_aside", t: tick, who: t.id });
        continue;
      }
      if (by) { cop.npc!.sus[by.id] = Math.max(cop.npc!.sus[by.id] ?? 0, 0.7); st.flags.falseTips = (st.flags.falseTips ?? 0) + 1; if (st.flags.falseTips >= 2) crime(w, by, "wasting police time", 1); }
    }
    cop.npc!.plan = [{ k: "go", ...(cop.npc!.post ?? SPOTS.ejectPoint) }];
  }
}
