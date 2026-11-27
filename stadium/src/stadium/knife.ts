// Knives. A sharp weapon kills; the dead can be relieved of their face and hands;
// a killing that is seen, or a body that is found, brings armed police, who shoot.
import { appearance } from "../core/identity";
import { hasProp, moveItem, spawnItem } from "../core/items";
import { chance, pick, rndRange } from "../core/rng";
import type { Action, Actor, Item } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { removePlayer } from "../football/api";
import { raiseSecurity } from "./kickoff";
import { PACE, SPOTS, VENUE } from "./layout";
import { follow, goTo, say, spawnStaff } from "./npc";
import { alert, canSee, crime, finishArrest, isSecurity } from "./security";

/** Seconds from the call to armed officers arriving. */
const ARMED_DELAY = 40;
/** Seconds they give you to drop it and get down. */
const COMPLY_SECONDS = 2.2;

export const sharpInHand = (w: World, a: Actor): Item | undefined => {
  const it = a.hand ? w.state.items[a.hand] : undefined;
  return it && hasProp(it, "sharp") && hasProp(it, "weapon") ? it : undefined;
};

/** Stabbed. Security may get the knife off you first if they saw it coming. */
export function stab(w: World, by: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world;
  const facing = Math.cos(Math.atan2(by.y - t.y, by.x - t.x) - t.facing) > 0.3;
  if (isSecurity(t) && t.downUntil <= tick && facing && t.npc!.target === by.id && chance(r, 0.4)) {
    const knife = by.hand!;
    moveItem(s, knife, { k: "ground", x: t.x + 1.5, y: t.y + 0.8 });
    by.downUntil = tick + 90;
    say(w, t, "KNIFE! He's got a KNIFE!", 2.5);
    crime(w, by, "attacking a steward with a knife", 3, t);
    w.bus.emit({ type: "disarmed", t: tick, who: by.id, by: t.id });
    return;
  }
  kill(w, t, by);
  by.effects.bloody = tick + 60 * 240;
  st.flags.bloodyOuter = by.worn.outer ? Number(by.worn.outer.slice(1)) : -1;
  const seen = crime(w, by, t.fb ? "stabbing a footballer" : t.off ? "stabbing the referee" : "murder", 4, t);
  if (seen) callArmed(w, by.x, by.y);
}

export function kill(w: World, t: Actor, by?: Actor): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  t.dead = true;
  t.downUntil = Number.MAX_SAFE_INTEGER;
  t.heldBy = undefined; t.seated = false; t.moveX = t.moveY = 0; t.vx = t.vy = 0;
  if (t.npc) { t.npc.plan = []; t.npc.goal = null; t.npc.path = []; t.npc.mode = "routine"; t.npc.bubble = null; }
  // Taken off the team sheet, but the body stays where it fell.
  if (t.fb && t.fb.status === "playing") { const x = t.x, y = t.y; removePlayer(w, t.id, "killed"); t.x = x; t.y = y; }
  if (t.off) t.off.incapacitated = true;
  // Anyone he was holding is free.
  for (const id in s.actors) if (s.actors[id].heldBy === t.id) s.actors[id].heldBy = undefined;
  st.flags.killings = (st.flags.killings ?? 0) + 1;
  w.bus.emit({ type: "killed", t: tick, who: t.id, by: by?.id, x: t.x, y: t.y, footballer: !!t.fb, referee: t.off?.job === "referee" });
}

/** The armed response is on its way. */
export function callArmed(w: World, x: number, y: number): void {
  const st = w.state.stadium!, tick = w.state.tick;
  st.flags.lastSeenX = x; st.flags.lastSeenY = y; st.flags.lastSeenAt = tick;
  if (st.flags.armedAt) return;
  st.flags.armedAt = tick + 60 * ARMED_DELAY;
  raiseSecurity(w, 2);
  w.bus.emit({ type: "armed_called", t: tick });
}

const NAMES = ["Officer Pike", "Officer Hale", "Officer Crane", "Officer Rook", "Officer Stannard", "Officer Doyle"];

function deployArmed(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  const n = 4 + Math.min(2, (st.flags.killings ?? 1) - 1);
  const from = SPOTS.policeVan;
  for (let i = 0; i < n; i++) {
    const a = spawnStaff(w, "armed", "police", NAMES[i % NAMES.length], from.x + (i % 3) - 1, from.y + Math.floor(i / 3), {}, { speed: 3.2 });
    a.npc!.lines = [];
    a.npc!.stage = 0;
  }
  st.flags.armedDeployed = 1;
  w.bus.emit({ type: "armed_deployed", t: tick, n });
}

/** Has this officer good reason to think this is the man? */
function identifies(w: World, o: Actor, pc: Actor): boolean {
  const s = w.state, st = s.stadium!, ap = appearance(s, pc), d = Math.hypot(pc.x - o.x, pc.y - o.y);
  if (ap.alarming || (ap.grisly && d < 8)) return true;
  const recent = st.wanted.filter((wd) => wd.severity >= 1 && wd.until > s.tick);
  if (recent.some((wd) => wd.look === ap.look || (wd.face === ap.faceId && d < 10 && ap.faceCover < 0.5))) return true;
  // Next to a body, holding nothing to explain it.
  return Object.values(s.actors).some((b) => b.dead && Math.hypot(b.x - pc.x, b.y - pc.y) < 2.5);
}

export function stepArmed(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, f = st.flags, r = s.rng.world;
  const pc = s.actors[st.pc];
  if (!pc) return;
  if (f.bloodyOuter !== undefined && (pc.effects.bloody ?? 0) > tick) {
    // A change of clothes gets rid of the blood.
    const now = pc.worn.outer ? Number(pc.worn.outer.slice(1)) : -1;
    if (now !== f.bloodyOuter) { pc.effects.bloody = 0; w.bus.emit({ type: "cleaned_up", t: tick }); }
  }
  discoverBodies(w);
  if (f.armedAt && !f.armedDeployed && tick >= f.armedAt) deployArmed(w);
  if (!f.armedDeployed || st.ending) return;
  for (const id in s.actors) {
    const o = s.actors[id], n = o.npc;
    if (n?.job !== "armed" || o.dead || o.downUntil > tick) continue;
    const sees = !pc.hiddenIn && canSee(w, o, pc, 32) && identifies(w, o, pc);
    if (sees) {
      f.lastSeenX = pc.x; f.lastSeenY = pc.y; f.lastSeenAt = tick;
      o.facing = Math.atan2(pc.y - o.y, pc.x - o.x);
      n.goal = null; n.path = []; o.moveX = o.moveY = 0;
      if (!f.challengedAt || tick - f.challengedAt > 60 * 8) {
        f.challengedAt = tick;
        say(w, o, pick(r, ["ARMED POLICE! DROP THE WEAPON!", "ARMED POLICE! GET ON THE GROUND! NOW!", "ARMED POLICE! HANDS WHERE I CAN SEE THEM!"]), 2.5);
        w.bus.emit({ type: "armed_challenge", t: tick, by: o.id });
        continue;
      }
      if (tick - f.challengedAt < COMPLY_SECONDS * 60) continue;
      // Complied: empty hands, standing still. Otherwise, they fire.
      const armed = !!pc.hand && hasProp(s.items[pc.hand], "weapon");
      const still = Math.hypot(pc.vx, pc.vy) < 0.6 && !st.vehicles.bus?.drivenBy;
      if (!armed && still) {
        say(w, o, "Stay down! Stay DOWN!", 2);
        finishArrest(w, pc, "Armed police. You lay on the concourse floor while a man knelt on your back and read you your rights, slowly, twice.");
        return;
      }
      if (tick % 30 === 0) {
        const d = Math.hypot(pc.x - o.x, pc.y - o.y);
        const p = Math.max(0.12, 0.6 - d * 0.012 - (Math.hypot(pc.vx, pc.vy) > 4 ? 0.2 : 0));
        w.bus.emit({ type: "gunshot", t: tick, by: o.id, x: o.x, y: o.y });
        if (chance(r, p)) {
          st.ending = { kind: "shot", title: "Shot dead", text: pick(r, [
            "Armed police. You were holding a kitchen knife and running, which in the training video is the bit where they shoot.",
            "The inquest heard that you had been asked to drop the weapon \"several times\", and that you had replied \"several things\".",
          ]) };
          w.bus.emit({ type: "ending", t: tick, kind: "shot" });
          return;
        }
        // A miss hits whatever's behind.
        const behind = Object.values(s.actors).find((a) => !a.dead && a !== pc && a !== o && !a.hiddenIn && Math.hypot(a.x - pc.x, a.y - pc.y) < 3 && chance(r, 0.25));
        if (behind) kill(w, behind);
      }
      continue;
    }
    // Searching: the last place he was seen, then round the ground.
    if (!n.goal) {
      const fresh = f.lastSeenAt && tick - f.lastSeenAt < 60 * 40;
      const spot = fresh ? { x: f.lastSeenX + rndRange(r, -4, 4), y: f.lastSeenY + rndRange(r, -4, 4) } : pick(r, [...VENUE.patrolLoop, ...VENUE.policeSpots]);
      goTo(o, spot.x, spot.y, true);
    }
    if (follow(w, o)) n.goal = null;
  }
}

/** Anyone who sees a body raises the alarm; the crowd near it scatters. */
function discoverBodies(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (tick % 20 !== 0) return;
  for (const id in s.actors) {
    const b = s.actors[id];
    const ko = !b.dead && (b.effects.ko ?? 0) > tick && b.npc?.job !== "dog";
    if ((!b.dead && !ko) || b.hiddenIn || st.flags[`found_${id}`]) continue;
    for (const oid in s.actors) {
      const o = s.actors[oid];
      if (!o.npc || o.dead || o === b || o.npc.job === "dog" || o.npc.job === "player" || o.npc.job === "armed" || o.downUntil > tick) continue;
      if (!canSee(w, o, b, 12)) continue;
      st.flags[`found_${id}`] = 1;
      if (ko) {
        // Somebody out cold: "Man down!" Security come over, and anyone standing over him is the suspect.
        say(w, o, pick(s.rng.world, ["Man down! Man down!", "Oi, he's spark out here!", "Someone's been battered!", "Is he alright? MATE?"]), 3);
        w.bus.emit({ type: "ko_found", t: tick, who: id, by: o.id, x: b.x, y: b.y });
        const pc = s.actors[st.pc];
        for (const gid in s.actors) {
          const g = s.actors[gid];
          if (!isSecurity(g) || g.downUntil > tick || Math.hypot(g.x - b.x, g.y - b.y) > 25) continue;
          if (pc && Math.hypot(pc.x - b.x, pc.y - b.y) < 4 && !pc.hiddenIn) alert(w, g, pc, 2, 1.3);
          else if (g.npc!.mode === "routine") g.npc!.plan = [{ k: "go", x: b.x + 1, y: b.y, run: true }, { k: "wait", s: 6 }];
        }
        break;
      }
      say(w, o, pick(s.rng.world, ["Oh my God. OH MY GOD.", "Is he... is he breathing?", "SOMEBODY CALL AN AMBULANCE!", "Jesus Christ, there's a body!"]), 3);
      w.bus.emit({ type: "body_found", t: tick, who: id, by: o.id, x: b.x, y: b.y, footballer: !!b.fb });
      callArmed(w, b.x, b.y);
      for (const pid in s.actors) {
        const a = s.actors[pid];
        if (!a.npc || a.dead || isSecurity(a) || a.fb || a.off || a.npc.job === "armed" || Math.hypot(a.x - b.x, a.y - b.y) > 10) continue;
        const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
        a.npc.plan = [{ k: "go", x: a.x + (dx / l) * 10, y: a.y + (dy / l) * 10, run: true }];
        a.seated = false; a.npc.sitting = false;
      }
      break;
    }
  }
}

/** Whose hands these are, and would a palm reader take them? */
export function staffHands(w: World, it: Item): boolean {
  const who = it.of ? w.state.actors[it.of] : undefined;
  return !!who?.npc && ["steward", "police", "catering", "cleaner"].includes(who.npc.role);
}

export function installKnife(): void {
  registerVerb("flay", {
    check: (w, act, actor) => {
      if (!sharpInHand(w, actor)) return "you need a blade";
      const t = act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined;
      if (!t?.dead) return "they're not dead";
      if (Math.hypot(t.x - actor.x, t.y - actor.y) > 1.8) return "too far";
      if (w.state.stadium!.flags[`${act.arg}_${t.id}`]) return "already done";
      return act.arg === "face" || act.arg === "hands" ? null : "what?";
    },
    perform: (w, act: Action, actor) => {
      const s = w.state, st = s.stadium!, t = s.actors[(act.target as { id: string }).id];
      st.flags[`${act.arg}_${t.id}`] = 1;
      const it = spawnItem(s, act.arg === "face" ? "face" : "hands", { k: "ground", x: actor.x, y: actor.y });
      it.of = t.faceId === t.id ? t.id : t.faceId;
      it.label = `${t.name}'s ${act.arg}`;
      // Straight into a pocket if there's room, otherwise the other hand's full.
      if (actor.pockets.length < 3) moveItem(s, it.id, { k: "pocket", a: actor.id });
      // In the game it takes as long as it would: five seconds of hard, wet work with the wrong sort of knife.
      const secs = PACE.calm ? (act.arg === "face" ? 5.4 : 3.6) : 2;
      actor.downUntil = s.tick + Math.round(60 * secs);
      // (Busy, not flat on his back: the view shows him bent over it, working.)
      if (PACE.calm) actor.effects.carving = s.tick + Math.round(60 * secs);
      actor.effects.bloody = s.tick + 60 * 240;
      st.flags.bloodyOuter = actor.worn.outer ? Number(actor.worn.outer.slice(1)) : -1;
      st.flags.trophies = (st.flags.trophies ?? 0) + 1;
      w.bus.emit({ type: "flayed", t: s.tick, by: actor.id, who: t.id, part: act.arg, secs, name: t.name });
      const seen = crime(w, actor, "mutilating a body", 4, undefined);
      if (seen) callArmed(w, actor.x, actor.y);
    },
  });
}

/** Wearing a man's face: it's on crooked, it's the wrong colour and it's stitched on with a bootlace, and
 *  everybody he meets is perfectly nice about it. Now and then whoever's nearest says so. */
const NICE = ["Morning, {n}. You look well.", "Alright, {n}? New moisturiser?", "You've caught the sun, {n}.", "Have you lost weight, {n}?", "Lovely to see you, {n}. You look tired.", "Had your hair done, {n}?", "{n}! Didn't recognise you. No, I did.", "You want to get some sleep, {n}."];
export function stepDeadpan(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  if (!PACE.calm || tick % 60 !== 0 || tick < (st.flags.niceAt ?? 0)) return;
  const pc = s.actors[st.pc], f = pc?.worn.face ? s.items[pc.worn.face] : undefined;
  if (!pc || !f || f.def !== "face" || pc.hiddenIn || pc.heldBy) return;
  const owner = f.of ? s.actors[f.of] : undefined, n = (owner?.name ?? "mate").split(" ").pop()!;
  const near = Object.values(s.actors).filter((a) => a.npc && !a.dead && !a.hiddenIn && a.downUntil <= tick && a.npc.mode === "routine" && a.npc.job !== "player" && !a.npc.bubble && Math.hypot(a.x - pc.x, a.y - pc.y) < 3.6)
    .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y))[0];
  if (!near) return;
  const k = (st.flags.niceN = (st.flags.niceN ?? 0) + 1);
  say(w, near, NICE[(k * 3) % NICE.length].replace("{n}", n), 3.2);
  near.npc!.told = tick + 190; near.facing = Math.atan2(pc.y - near.y, pc.x - near.x);
  st.flags.niceAt = tick + 60 * 11;
}
