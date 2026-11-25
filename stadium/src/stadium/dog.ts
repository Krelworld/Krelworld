// A dog of uncertain temper, tied up outside the pub while its owner has a drink.
import { appearance } from "../core/identity";
import { chance, pick, rndRange } from "../core/rng";
import { DT, type Actor } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { haltPlay, intruderKick, removePlayer, resumePlay } from "../football/api";
import { areaAt, SPOTS, VENUE } from "./layout";
import { follow, goTo, newNpc, say } from "./npc";
import { lineOfSight } from "./nav";
import { canSee, crime, isSecurity } from "./security";

export function createDog(w: World): void {
  const s = w.state, st = s.stadium!;
  const id = "dog";
  const p = SPOTS.dogPost;
  const dog: Actor = {
    id, kind: "npc", name: "Tyson", faceId: id, x: p.x, y: p.y, vx: 0, vy: 0, facing: Math.PI / 2, radius: 0.35, speed: 2,
    moveX: 0, moveY: 0, hand: null, pockets: [], worn: {}, money: 0, downUntil: 0, effects: {},
    npc: newNpc("dog", "none", { lines: ["Grrrr.", "WOOF.", "*growls*"] }),
  };
  s.actors[id] = dog;
  // The owner is the biggest of the locals.
  const owner = Object.values(s.actors).find((a) => a.npc?.job === "local");
  st.dog = { id, state: "tied", target: null, owner: owner?.id ?? "", bitten: 0, nextBite: 0 };
  if (owner?.npc) owner.npc.lines = ["Don't go near Tyson. He's not right since the vet.", "Tyson's outside. He doesn't like referees. Or anyone."];
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }, r: number) => Math.hypot(a.x - b.x, a.y - b.y) <= r;

export function installDog(): void {
  registerVerb("untie", {
    check: (w, act, actor) => {
      const d = w.state.stadium!.dog, dog = d && w.state.actors[d.id];
      return d && dog && d.state === "tied" && near(actor, dog, 1.8) ? null : "no dog to untie";
    },
    perform: (w, act, actor) => {
      const s = w.state, d = s.stadium!.dog!;
      d.state = "led";
      const owner = s.actors[d.owner];
      if (owner && canSee(w, owner, actor, 14)) { say(w, owner, "Oi! That's my dog!"); crime(w, actor, "stealing a dog", 1, owner); }
      w.bus.emit({ type: "dog_untied", t: s.tick, by: actor.id });
    },
  });
  registerVerb("release", {
    check: (w, act, actor) => (w.state.stadium!.dog?.state === "led" ? null : "you haven't got the dog"),
    perform: (w, act, actor) => {
      const s = w.state, d = s.stadium!.dog!;
      d.state = "loose"; d.target = null;
      const dog = s.actors[d.id];
      say(w, dog, "WOOF!", 2);
      w.bus.emit({ type: "dog_loose", t: s.tick, by: actor.id, x: dog.x, y: dog.y });
      if (Object.values(s.actors).some((a) => a.npc && a.id !== d.id && a.npc.job !== "player" && canSee(w, a, actor, 14))) crime(w, actor, "setting a dog on people", 2);
    },
  });
  // "Get him." The dog goes for one person, mauls them, and comes back.
  registerVerb("sic", {
    check: (w, act, actor) => {
      const s = w.state, d = s.stadium!.dog, dog = d && s.actors[d.id];
      if (!d || !dog || (d.state !== "led" && d.state !== "returning")) return "you haven't got the dog";
      const t = act.target?.k === "actor" ? s.actors[act.target.id] : undefined;
      if (!t || t === actor || t === dog || t.hiddenIn || t.dead) return "nobody to set it on";
      return Math.hypot(t.x - actor.x, t.y - actor.y) < 20 ? null : "too far away";
    },
    perform: (w, act, actor) => {
      const s = w.state, d = s.stadium!.dog!, dog = s.actors[d.id];
      const t = s.actors[(act.target as { id: string }).id];
      d.state = "sicced"; d.target = t.id; d.maul = 0;
      say(w, actor, pick(s.rng.world, ["Get him, Tyson!", "TYSON. KILL.", "Go on, son!"]), 1.5);
      say(w, dog, "GRRRRRAAAH!", 1.5);
      w.bus.emit({ type: "dog_sicced", t: s.tick, by: actor.id, on: t.id, x: dog.x, y: dog.y });
      const big = isSecurity(t) || !!t.off;
      if (Object.values(s.actors).some((a) => a.npc && a.id !== d.id && a.id !== t.id && a.npc.job !== "player" && canSee(w, a, actor, 16)) || (t.npc && canSee(w, t, actor, 16)))
        crime(w, actor, big ? "setting a dog on an official" : "setting a dog on someone", big ? 3 : 2, t);
    },
  });
  // At the turnstile, with a dog: there is a form of words.
  registerVerb("servicedog", {
    check: (w, act, actor) => {
      const s = w.state, d = s.stadium!.dog;
      if (d?.state !== "led") return "you haven't got the dog";
      if (s.stadium!.flags.serviceDog) return "already sorted";
      const t = act.target?.k === "actor" ? s.actors[act.target.id] : undefined;
      if (!t?.npc || t.npc.job !== "turnstile") return "nobody to explain it to";
      if (t.npc.refused.includes(actor.id)) return "he's heard it";
      return Math.hypot(t.x - actor.x, t.y - actor.y) < 3.8 ? null : "too far";
    },
    perform: (w, act, actor) => {
      const s = w.state, st = s.stadium!, t = s.actors[(act.target as { id: string }).id], n = t.npc!;
      say(w, actor, "He's a service dog. For my autism.", 2.5);
      // Nobody wants to be the one who got it wrong. Fewer here than at the semi-final, and fewer once they're on edge.
      const p = (VENUE.features.faceCameras ? 0.5 : 0.75) - (st.flags.securityLevel ?? 0) * 0.06 - (appearance(s, actor).sinister ? 0.3 : 0);
      if (chance(s.rng.world, p)) {
        st.flags.serviceDog = 1;
        say(w, t, pick(s.rng.world, ["Oh. Right. Sorry. Does he need some water?", "Course. Sorry, mate. Go on, both of you.", "...Fair enough. Sorry. Has he got a vest or anything? Never mind."]), 3);
        w.bus.emit({ type: "service_dog", t: s.tick, ok: true, by: actor.id });
      } else {
        n.refused.push(actor.id);
        n.sus[actor.id] = Math.max(n.sus[actor.id] ?? 0, 0.6);
        say(w, t, pick(s.rng.world, ["Service dog. It's got a Stone Island collar.", "He's just bitten the bloke behind you, pal.", "My cousin's got autism. He hasn't got a pit bull."]), 3);
        w.bus.emit({ type: "service_dog", t: s.tick, ok: false, by: actor.id });
      }
    },
  });
  registerVerb("leash", {
    check: (w, act, actor) => {
      const d = w.state.stadium!.dog, dog = d && w.state.actors[d.id];
      return d && dog && (d.state === "loose" || d.state === "sicced") && near(actor, dog, 1.5) ? null : "no loose dog in reach";
    },
    perform: (w, act, actor) => { const d = w.state.stadium!.dog!; d.state = "led"; d.target = null; },
  });
}

/** Who the dog goes for: the nearest thing that moves, footballers and referees first. */
function pickTarget(w: World, dog: Actor): Actor | null {
  const s = w.state;
  let best: Actor | null = null, bestScore = 1e9;
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a === dog || a.hiddenIn || a.downUntil > s.tick || (a.fb && a.fb.status !== "playing")) continue;
    const d = Math.hypot(a.x - dog.x, a.y - dog.y);
    if (d > 28) continue;
    const moving = Math.hypot(a.vx, a.vy);
    const score = d - moving * 1.5 - (a.fb ? 6 : 0) - (a.off?.job === "referee" ? 10 : 0) + (a.id === s.stadium!.pc ? 4 : 0);
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export function stepDog(w: World): void {
  const s = w.state, st = s.stadium!, d = st.dog, tick = s.tick, r = s.rng.world, m = s.match!;
  if (!d) return;
  const dog = s.actors[d.id];
  if (!dog) return;
  const pc = s.actors[st.pc];
  const move = (tx: number, ty: number, speed: number, stopAt = 0.3) => {
    const dx = tx - dog.x, dy = ty - dog.y, dist = Math.hypot(dx, dy);
    if (dist < stopAt) { dog.vx = dog.vy = 0; return; }
    const st2 = Math.min(dist - stopAt, speed * DT);
    dog.vx = (dx / dist) * speed; dog.vy = (dy / dist) * speed;
    dog.x += (dx / dist) * st2; dog.y += (dy / dist) * st2; dog.facing = Math.atan2(dy, dx);
  };
  dog.moveX = dog.moveY = 0;
  /** Straight at them if there's a clear run; round the walls if not. */
  const chase = (tx: number, ty: number, speed: number, stopAt: number) => {
    if (lineOfSight(dog.x, dog.y, tx, ty) || near(dog, { x: tx, y: ty }, 2)) { dog.npc!.goal = null; return move(tx, ty, speed, stopAt); }
    const n = dog.npc!;
    if (!n.goal || Math.hypot(n.goal.x - tx, n.goal.y - ty) > 3) goTo(dog, tx, ty, true);
    follow(w, dog);
    const l = Math.hypot(dog.moveX, dog.moveY);
    if (l > 0.01) { dog.x += (dog.moveX / l) * speed * DT; dog.y += (dog.moveY / l) * speed * DT; dog.facing = Math.atan2(dog.moveY, dog.moveX); dog.vx = (dog.moveX / l) * speed; dog.vy = (dog.moveY / l) * speed; }
    dog.moveX = dog.moveY = 0;
  };
  switch (d.state) {
    case "tied":
      move(SPOTS.dogPost.x + Math.sin(tick * 0.02) * 0.6, SPOTS.dogPost.y, 1);
      if (pc && near(pc, dog, 3) && tick % 200 === 0) say(w, dog, "Grrrr.", 1.5);
      break;
    case "led":
      if (!pc) break;
      if (pc.hiddenIn) { dog.x = pc.x; dog.y = pc.y; break; }
      // On a lead it stays on a lead: through gates, over turnstiles, wherever.
      if (!near(pc, dog, 3.5)) { dog.x = pc.x - Math.cos(pc.facing) * 1.2; dog.y = pc.y - Math.sin(pc.facing) * 1.2; }
      move(pc.x - Math.cos(pc.facing) * 1.2, pc.y - Math.sin(pc.facing) * 1.2, Math.max(3, Math.hypot(pc.vx, pc.vy) * 1.1), 0.5);
      break;
    case "sicced": {
      const t = d.target ? s.actors[d.target] : null;
      if (!t || t.hiddenIn || t.dead || (t.fb && t.fb.status === "gone")) { d.state = "returning"; d.target = null; break; }
      chase(t.x, t.y, 8, 0.5);
      // Holding someone back, a steward lets go of them to deal with this.
      if (near(dog, t, 0.9) && tick >= d.nextBite) maul(w, dog, t);
      stewardsGrab(w, dog);
      if (t.fb && areaAt(dog.x, dog.y).pitch && (m.phase === "live") && Math.hypot(m.ball.x - dog.x, m.ball.y - dog.y) < 30) haltPlay(w, "dog");
      break;
    }
    case "returning":
      if (!pc || pc.hiddenIn) { d.state = "loose"; break; }
      chase(pc.x, pc.y, 6.5, 1);
      if (near(pc, dog, 1.6)) d.state = "led";
      if (!near(pc, dog, 45)) d.state = "loose";
      break;
    case "loose": {
      // On the pitch it plays with the ball; anywhere else it goes for people.
      const onPitch = areaAt(dog.x, dog.y).pitch === true;
      const b = m.ball;
      if (onPitch && !b.held && chance(r, 0.4) && Math.hypot(b.x - dog.x, b.y - dog.y) < 12) {
        move(b.x, b.y, 7.5, 0.6);
        if (Math.hypot(b.x - dog.x, b.y - dog.y) < 1.3 && tick % 20 === 0) intruderKick(w, dog.id, Math.cos(rndRange(r, 0, 6.28)), Math.sin(rndRange(r, 0, 6.28)), rndRange(r, 4, 9), 0.5);
      } else {
        let t = d.target ? s.actors[d.target] : null;
        if (!t || t.downUntil > tick || tick % 90 === 0) { t = pickTarget(w, dog); d.target = t?.id ?? null; }
        if (t) {
          move(t.x, t.y, 7.2, 0.5);
          if (near(dog, t, 0.9) && tick >= d.nextBite) bite(w, dog, t);
        } else move(dog.x + Math.cos(tick * 0.03) * 3, dog.y + Math.sin(tick * 0.03) * 3, 2);
      }
      // Panic: people near a loose dog get out of the way.
      if (tick % 15 === 0) for (const id in s.actors) {
        const a = s.actors[id];
        if (!a.npc || a === dog || a.fb || a.off || isSecurity(a) || a.seated || !near(a, dog, 5)) continue;
        const ax = a.x - dog.x, ay = a.y - dog.y, l = Math.hypot(ax, ay) || 1;
        a.npc.plan = [{ k: "go", x: a.x + (ax / l) * 8, y: a.y + (ay / l) * 8, run: true }];
        if (chance(r, 0.2)) say(w, a, pick(r, ["Aaargh!", "Get it off me!", "Whose dog is that?!"]), 1.5);
      }
      // The referee stops play for a dog near the action.
      if (onPitch && m.phase === "live" && Math.hypot(b.x - dog.x, b.y - dog.y) < 30) haltPlay(w, "dog");
      stewardsGrab(w, dog);
      break;
    }
    case "caught":
      // Led away and handed to the police.
      move(SPOTS.ejectPoint.x, SPOTS.ejectPoint.y + 4, 2);
      if (near(dog, { x: SPOTS.ejectPoint.x, y: SPOTS.ejectPoint.y + 4 }, 1)) { delete s.actors[dog.id]; st.dog = null; }
      break;
  }
  if (m.halted === "dog" && (!st.dog || (st.dog.state !== "loose" && st.dog.state !== "sicced") || !areaAt(dog.x, dog.y).pitch)) resumePlay(w);
}

/** Stewards go after a dog that is running about. */
function stewardsGrab(w: World, dog: Actor): void {
  const s = w.state, d = s.stadium!.dog!, tick = s.tick, r = s.rng.world;
  if (tick % 30 !== 0) return;
  for (const id in s.actors) {
    const g = s.actors[id];
    if (!isSecurity(g) || g.downUntil > tick || g.npc!.mode !== "routine" || !near(g, dog, 25) || !VENUE.inside(dog.x, dog.y) && g.npc!.job !== "police") continue;
    g.npc!.plan = [{ k: "go", x: dog.x, y: dog.y, run: true }];
    if (near(g, dog, 1.4) && (dog.vx === 0 || chance(r, 0.35))) {
      d.state = "caught"; d.target = null; say(w, g, "Got him! Good boy. GOOD boy.");
      w.bus.emit({ type: "dog_caught", t: tick, by: g.id });
      return;
    }
  }
}

/** What a proper mauling does to a footballer. Some play on; most don't. */
const INJURIES: { what: string; off: boolean; w: number; gk?: boolean }[] = [
  { what: "a bite on the calf", off: false, w: 3 },
  { what: "a bitten backside", off: false, w: 2 },
  { what: "a torn hamstring from running away", off: true, w: 2 },
  { what: "a mauled hand", off: false, w: 2, gk: true },
  { what: "a bite to the face", off: true, w: 1 },
  { what: "a dislocated knee", off: true, w: 1 },
  { what: "concussion from the fall", off: true, w: 1 },
  { what: "what the club doctor would only call \"a groin injury\"", off: true, w: 1 },
];

/** A set-on dog doesn't nip; it hangs on. Three bites and the job's done. */
function maul(w: World, dog: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!, d = st.dog!, r = s.rng.world, tick = s.tick;
  d.nextBite = tick + 40;
  d.maul = (d.maul ?? 0) + 1;
  d.bitten++;
  t.downUntil = Math.max(t.downUntil, tick + 90);
  if (t.fb) t.fb.stunUntil = tick + 120;
  // Whoever had hold of the player lets go.
  for (const id in s.actors) { const held = s.actors[id]; if (held.heldBy === t.id) { held.heldBy = undefined; w.bus.emit({ type: "broke_free", t: tick, who: held.id, from: t.id }); } }
  if (t.npc) say(w, t, pick(r, ["AAARGH!", "GET IT OFF! GET IT OFF!", "MY LEG!", "Not the face! NOT THE FACE!"]), 1.5);
  w.bus.emit({ type: "dog_bite", t: tick, who: t.id, footballer: !!t.fb, referee: t.off?.job === "referee", maul: true });
  if (d.maul < 3) return;
  // Done: the damage, and back to heel.
  let injury = "bites to the legs and arms";
  if (t.fb) {
    const pool = INJURIES.filter((i) => !i.gk || t.fb!.role === "GK");
    let roll = rndRange(r, 0, pool.reduce((a, i) => a + i.w, 0));
    const inj = pool.find((i) => (roll -= i.w) < 0) ?? pool[0];
    injury = inj.what;
    const off = inj.off || (inj.gk && t.fb.role === "GK");
    if (off && t.fb.status === "playing") removePlayer(w, t.id, "injured");
    else { t.fb.fatigue = Math.min(1, t.fb.fatigue + 0.4); t.fb.stunUntil = tick + 300; }
  } else if (t.off) {
    injury = chance(r, 0.5) ? "a savaged ankle" : "bites to both arms";
    if (chance(r, 0.6)) t.off.incapacitated = true;
    t.downUntil = tick + 60 * 25;
  } else {
    t.downUntil = tick + 60 * (isSecurity(t) ? 30 : 20);
  }
  w.bus.emit({ type: "mauled", t: tick, who: t.id, injury, footballer: !!t.fb });
  st.flags.maulings = (st.flags.maulings ?? 0) + 1;
  d.maul = 0; d.target = null; d.state = "returning";
}

function bite(w: World, dog: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!, d = st.dog!, r = s.rng.world;
  d.nextBite = s.tick + 90;
  d.bitten++;
  t.downUntil = s.tick + 120;
  if (t.fb) {
    t.fb.stunUntil = s.tick + 150;
    if (chance(r, 0.25) && t.fb.status === "playing") removePlayer(w, t.id, "injured");
  }
  if (t.npc) say(w, t, pick(r, ["Aaargh! My leg!", "It's got me!", "GET IT OFF!"]), 2);
  w.bus.emit({ type: "dog_bite", t: s.tick, who: t.id, footballer: !!t.fb, referee: t.off?.job === "referee" });
  d.target = null;
  void appearance;
}
