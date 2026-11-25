// What stewards and police notice, how suspicious they get, and what they do about it.
import { appearance, looksPermitted } from "../core/identity";
import { defOf, hasProp, moveItem } from "../core/items";
import { chance } from "../core/rng";
import { DT, type Actor, type Id } from "../core/types";
import type { World } from "../core/world";
import { areaAt, BOUNDS, SPOTS, type Area } from "./layout";
import { findPath, GH, GW, lineOfSight, navGrid } from "./nav";
import { follow, goTo, say } from "./npc";
import type { Npc } from "./state";

export const SECURITY_JOBS = new Set(["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief", "police"]);
export const isSecurity = (a: Actor) => !!a.npc && SECURITY_JOBS.has(a.npc.job);

/** People the stadium keeps an eye on: the player, and later his echoes. */
export function suspects(w: World): Actor[] {
  const pc = w.state.actors[w.state.stadium!.pc];
  return pc ? [pc] : [];
}

/** Can `v` see `t` right now? */
export function canSee(w: World, v: Actor, t: Actor, range = 14): boolean {
  if (t.hiddenIn || v.downUntil > w.state.tick) return false;
  const ta = areaAt(t.x, t.y);
  if (ta.private && areaAt(v.x, v.y).id !== ta.id) return false;
  const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (d > (isSecurity(v) ? 4.5 : 2.5)) {
    const ang = Math.atan2(dy, dx) - v.facing;
    const c = Math.cos(ang);
    if (c < 0.2) return false; // roughly 160 degrees of vision
  }
  return lineOfSight(v.x, v.y, t.x, t.y);
}

/** The worst thing this person looks like they are doing just by being here. */
function trespass(w: World, t: Actor, area: Area): number {
  // Nobody can see whether you have a ticket in your pocket: only the turnstiles check.
  if (area.access === "ticket" || area.access === "public") return 0;
  if (looksPermitted(w.state, t, area as any)) return 0;
  if (area.pitch) return area.id === "pitch" ? 3 : 1.2;
  return area.access === "restricted" ? 1 : area.access === "staff" ? 0.7 : 0.4;
}

/** Does this person match a description going round? */
function wantedMatch(w: World, v: Actor, t: Actor): number {
  const st = w.state.stadium!, ap = appearance(w.state, t), d = Math.hypot(t.x - v.x, t.y - v.y);
  const outer = t.worn.outer ? w.state.items[t.worn.outer].def : null;
  let m = 0;
  for (const wd of st.wanted) {
    if (wd.until < w.state.tick) continue;
    if (wd.face === t.faceId && !ap.faceHidden && d < 5) m = Math.max(m, 0.9 * wd.severity);
    if (wd.team === ap.team && wd.outer === outer && wd.role === ap.role) m = Math.max(m, 0.45 * wd.severity);
  }
  if (st.banned.includes(t.faceId) && !ap.faceHidden && d < 4 && areaAt(t.x, t.y).access !== "public") m = Math.max(m, 0.8);
  return m;
}

// ---------- Crimes and witnesses ----------
/** Staff who would object to minor things that a passing fan would not care about. */
const STAFFISH = new Set(["worker", "driver", "barman", "cook", "cleaner", "seller"]);

/** Who could see a spot. `everyone` false means only staff and security care. */
export function witnessesOf(w: World, x: number, y: number, exclude: Id[], everyone = true): Actor[] {
  const out: Actor[] = [];
  const probe = { x, y, hiddenIn: undefined } as unknown as Actor;
  for (const id in w.state.actors) {
    const a = w.state.actors[id];
    if (!a.npc || exclude.includes(id) || a.downUntil > w.state.tick) continue;
    if (a.npc.job === "player" || a.npc.job === "official") continue;
    if (!everyone && !isSecurity(a) && !STAFFISH.has(a.npc.job)) continue;
    if (canSee(w, a, probe, 16)) out.push(a);
  }
  return out;
}

/**
 * Something bad happened. Whoever saw it reacts; a description goes round; the
 * incident is blamed on whichever supporters the culprit looked like.
 */
export function crime(w: World, by: Actor, what: string, severity: number, victim?: Actor, everyone = true): number {
  const s = w.state, st = s.stadium!;
  const seen = witnessesOf(w, by.x, by.y, [by.id, ...(victim ? [victim.id] : [])], everyone);
  if (victim?.npc && victim.npc.job !== "player" && victim.npc.job !== "official" && victim.downUntil <= s.tick) seen.push(victim);
  const ap = appearance(s, by);
  st.incidents.push({ t: s.tick, what, by: by.id, blamed: ap.team, severity, seenBy: seen.length });
  w.bus.emit({ type: "incident", t: s.tick, what, by: by.id, blamed: ap.team, severity, seen: seen.length, victim: victim?.id });
  if (!seen.length) return 0;
  st.wanted.push({
    face: by.faceId, team: ap.team, role: ap.role, outer: by.worn.outer ? s.items[by.worn.outer].def : null,
    severity: Math.min(1, 0.35 + severity * 0.25), until: s.tick + 60 * 300, what,
  });
  let shouted = false;
  for (const wtn of seen) {
    const n = wtn.npc!;
    if (isSecurity(wtn)) alert(w, wtn, by, severity, 1.8);
    else if (!shouted) {
      shouted = true;
      say(w, wtn, severity >= 2 ? "Oi! Somebody stop him!" : "Oi! Did you see that?");
      // Nearby security come running.
      for (const id in s.actors) {
        const g = s.actors[id];
        if (isSecurity(g) && Math.hypot(g.x - wtn.x, g.y - wtn.y) < 24) alert(w, g, by, severity, 1.1);
      }
    }
    n.nextBark = s.tick + 300;
  }
  return seen.length;
}

export function alert(w: World, g: Actor, by: Actor, severity: number, sus: number): void {
  const n = g.npc!;
  n.sus[by.id] = Math.max(n.sus[by.id] ?? 0, sus);
  n.crime = Math.max(n.target === by.id ? n.crime : 0, severity);
  n.target = by.id;
  n.lastSeen = { x: by.x, y: by.y, t: w.state.tick };
  if (n.mode === "routine" || n.mode === "watch" || n.mode === "search") setMode(w, g, "approach");
}

function setMode(w: World, g: Actor, mode: Npc["mode"]): void {
  const n = g.npc!;
  if (n.mode === mode) return;
  if (n.mode === "routine") { n.plan = []; n.goal = null; }
  n.mode = mode;
  n.modeUntil = w.state.tick + 60 * (mode === "search" ? 12 : 6);
  n.goal = null; n.path = [];
  if (mode === "routine") { n.target = null; n.crime = 0; n.intent = null; }
}

/** What happens to someone once a steward gets hold of them. */
function decideIntent(w: World, g: Actor, t: Actor): Npc["intent"] {
  const n = g.npc!, st = w.state.stadium!, area = areaAt(t.x, t.y);
  if (n.crime >= 3) return n.job === "police" ? "arrest" : "detain";
  if (n.crime >= 2) return "detain";
  if (area.pitch && !looksPermitted(w.state, t, area as any)) return "detain";
  if (n.crime >= 1) return "eject";
  if (st.banned.includes(t.faceId) && area.access !== "public") return "eject";
  if (st.warnings >= 2) return "eject";
  return "warn";
}

/** Where a warned trespasser is walked to: the nearest open spot where he is allowed to be. */
function warnDestination(w: World, t: Actor): { x: number; y: number } {
  const g = navGrid();
  for (let r = 2; r <= 40; r += 1.5) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2, x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
      const cx = Math.floor(x - BOUNDS.x), cy = Math.floor(y - BOUNDS.y);
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH || g[cy * GW + cx]) continue;
      const ar = areaAt(x, y);
      if (ar.private || ar.pitch) continue;
      if (ar.access === "public" || (ar.access === "ticket" && !areaAt(t.x, t.y).outside) || looksPermitted(w.state, t, ar as any)) {
        if (findPath(t.x, t.y, x, y).length) return { x, y };
      }
    }
  }
  return { x: SPOTS.ejectPoint.x, y: SPOTS.ejectPoint.y };
}

// ---------- Per-tick behaviour ----------
export function stepSecurity(w: World, g: Actor): void {
  const s = w.state, n = g.npc!, tick = s.tick, st = s.stadium!;
  if (g.downUntil > tick) { g.moveX = g.moveY = 0; return; }

  // Perception, staggered so not everybody looks on the same tick.
  if ((tick + g.id.length * 7 + g.id.charCodeAt(g.id.length - 1)) % 6 === 0) {
    for (const t of suspects(w)) {
      if (t.heldBy || st.ending) continue;
      const range = n.job === "pitchsteward" || n.job === "police" ? 22 : 14;
      const sees = canSee(w, g, t, range);
      let sus = n.sus[t.id] ?? 0;
      if (sees) {
        const area = areaAt(t.x, t.y);
        let rate = 0;
        // The police are not interested in who is allowed where; only in crimes.
        const tr = n.job === "police" ? 0 : trespass(w, t, area);
        if (tr) rate += tr * (Math.hypot(t.vx, t.vy) > 3 ? 1.6 : 1);
        if (appearance(s, t).alarming) rate += 1.4;
        rate += wantedMatch(w, g, t);
        // Gate staff only worry about people near their post.
        if ((n.job === "turnstile" || n.job === "doorguard" || n.job === "gateguard") && Math.hypot(t.x - g.x, t.y - g.y) > 9) rate *= 0.3;
        // A steward who has been paid looks the other way, unless it is serious.
        if (n.paidUntil > tick && n.crime < 2) rate = 0;
        if (tr >= 3 && n.job === "pitchsteward") { sus = 2; n.crime = Math.max(n.crime, 1); }
        sus = Math.min(2, sus + rate * DT * 6);
        if (rate === 0) sus = Math.max(0, sus - 0.12 * DT * 6);
        n.lastSeen = { x: t.x, y: t.y, t: tick };
        if (rate > 0 && (n.mode === "routine" || n.mode === "watch")) n.target = t.id;
      } else sus = Math.max(0, sus - 0.06 * DT * 6);
      n.sus[t.id] = sus;
    }
  }

  const t = n.target ? s.actors[n.target] : undefined;
  const sus = t ? n.sus[t.id] ?? 0 : 0;

  switch (n.mode) {
    case "routine":
      if (t && sus >= 0.45) { setMode(w, g, "watch"); say(w, g, "?", 1.5); }
      return;
    case "watch":
      g.moveX = g.moveY = 0;
      if (!t) return setMode(w, g, "routine");
      g.facing = Math.atan2(t.y - g.y, t.x - g.x);
      if (sus >= 0.9) { setMode(w, g, "approach"); say(w, g, n.crime >= 1 ? "Oi! You!" : "Excuse me, sir."); }
      else if (sus < 0.25) setMode(w, g, "routine");
      return;
    case "approach":
    case "chase": {
      if (!t || t.heldBy) return setMode(w, g, "routine");
      const visible = canSee(w, g, t, 26);
      if (visible) n.lastSeen = { x: t.x, y: t.y, t: tick };
      // Left the area and did nothing wrong: job done.
      if (n.crime === 0 && !trespass(w, t, areaAt(t.x, t.y)) && wantedMatch(w, g, t) < 0.3) {
        say(w, g, "And stay out.");
        n.sus[t.id] = 0.3;
        return setMode(w, g, "routine");
      }
      const tx = visible ? t.x : n.lastSeen!.x, ty = visible ? t.y : n.lastSeen!.y;
      const d = Math.hypot(tx - g.x, ty - g.y);
      const run = n.crime >= 1 || Math.hypot(t.vx, t.vy) > 2.6 || areaAt(t.x, t.y).pitch === true;
      // Re-plan towards the target every half second.
      if (!n.goal || (tick % 30 === 0)) goTo(g, tx, ty, run);
      if (n.goal) n.goal.run = run;
      if (d > 2.2 || !visible) follow(w, g);
      else { const k = 1 / (d || 1); g.speed = run ? 4.4 : 1.8; g.moveX = (tx - g.x) * k; g.moveY = (ty - g.y) * k; }
      if (visible && Math.hypot(t.x - g.x, t.y - g.y) < 1.15 && !t.hiddenIn) return apprehend(w, g, t);
      if (!visible && Math.hypot(n.lastSeen!.x - g.x, n.lastSeen!.y - g.y) < 1.5) { setMode(w, g, "search"); say(w, g, "Where's he gone?"); }
      return;
    }
    case "search": {
      if (t && canSee(w, g, t, 18) && sus > 0.6) return setMode(w, g, "chase");
      if (!n.goal) { const r = s.rng.world; goTo(g, n.lastSeen!.x + (r.a % 7) - 3, n.lastSeen!.y + (r.b % 7) - 3); }
      follow(w, g);
      if (tick > n.modeUntil) { if (t) n.sus[t.id] = 0.4; say(w, g, "Lost him."); setMode(w, g, "routine"); }
      return;
    }
    case "escort":
      return escort(w, g);
  }
}

function apprehend(w: World, g: Actor, t: Actor): void {
  const n = g.npc!, st = w.state.stadium!;
  n.intent = decideIntent(w, g, t);
  t.heldBy = g.id; t.seated = false;
  t.moveX = t.moveY = 0;
  const lines: Record<string, string> = {
    warn: "You can't be in here, pal. Come on.",
    eject: "Right. Out you go.",
    detain: "You're coming with me.",
    arrest: "You're nicked, sunshine.",
  };
  say(w, g, lines[n.intent!]);
  w.bus.emit({ type: "caught", t: w.state.tick, by: g.id, who: t.id, intent: n.intent });
  if (n.intent === "arrest") { finishArrest(w, t, "Arrested at the ground."); return; }
  if (n.intent === "warn") st.warnings++;
  setMode(w, g, "escort");
  const dest = n.intent === "warn" ? warnDestination(w, t) : n.intent === "detain" ? SPOTS.holding : SPOTS.ejectPoint;
  n.escortTo = { x: dest.x, y: dest.y };
  n.escortAt = w.state.tick; n.grip = 0;
  goTo(g, dest.x, dest.y);
  // Pull off an outer layer and see what is underneath, if it was a shirt that did the talking.
  if (n.intent !== "warn" && t.worn.outer && n.crime >= 1) revealShirt(w, g, t);
}

/** Security pull the outer shirt off. If the blame was going to the other lot, it comes back. */
function revealShirt(w: World, g: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!;
  const outerId = t.worn.outer!, before = appearance(s, t).team;
  moveItem(s, outerId, { k: "in", c: st.locker });
  const after = appearance(s, t).team;
  if (before !== after) {
    say(w, g, after === "ENG" ? "Hang on. He's English!" : "Hang on a minute.");
    for (const inc of st.incidents) if (inc.by === t.id && inc.blamed === before) inc.blamed = after;
    w.bus.emit({ type: "unmasked", t: s.tick, who: t.id, was: before, now: after });
  }
}

function escort(w: World, g: Actor): void {
  const s = w.state, n = g.npc!, st = s.stadium!;
  const t = n.target ? s.actors[n.target] : undefined;
  if (!t || t.heldBy !== g.id) { setMode(w, g, "routine"); return; }
  n.goal && (n.goal.run = false);
  const to = n.escortTo ?? { x: g.x, y: g.y };
  // Nobody wants to watch a long walk: after a few seconds, cut to the destination.
  if (n.intent !== "warn" && s.tick - (n.escortAt ?? s.tick) > 60 * 5) {
    g.x = to.x; g.y = to.y + 0.9; t.x = to.x; t.y = to.y; n.goal = null; n.path = [];
    w.bus.emit({ type: "escort_cut", t: s.tick, who: t.id, intent: n.intent });
  }
  if (!n.goal && Math.hypot(g.x - to.x, g.y - to.y) > 1.5) goTo(g, to.x, to.y);
  follow(w, g);
  g.speed = 2.6;
  if (!n.goal && Math.hypot(g.x - to.x, g.y - to.y) > 1.5) {
    // No way through on foot: walk him straight there (stewards have keys).
    const dx = to.x - g.x, dy = to.y - g.y, d = Math.hypot(dx, dy);
    g.moveX = dx / d; g.moveY = dy / d;
    if (w.state.tick % 120 === 0) { g.x += (dx / d) * 1.5; g.y += (dy / d) * 1.5; }
  }
  const arrived = Math.hypot(g.x - to.x, g.y - to.y) < 1.5;
  // Drag him along just behind.
  const bx = g.x - Math.cos(g.facing) * 0.85, by = g.y - Math.sin(g.facing) * 0.85;
  t.x += (bx - t.x) * 0.3; t.y += (by - t.y) * 0.3; t.vx = g.vx; t.vy = g.vy; t.facing = g.facing;
  if (!arrived) return;
  t.heldBy = undefined;
  const intent = n.intent;
  if (intent === "warn") { say(w, g, "Don't let me see you back in there."); n.sus[t.id] = 0.35; }
  else if (intent === "eject") eject(w, g, t);
  else if (intent === "detain") {
    st.detainedUntil = s.tick + 60 * 45;
    say(w, g, "Sit there and don't move. The police are on their way.");
    if (n.crime >= 3 || st.incidents.some((i) => i.by === t.id && i.severity >= 3)) st.policeCalled = true;
    w.bus.emit({ type: "detained", t: s.tick, who: t.id });
  }
  setMode(w, g, "routine");
  // The steward goes back to his post.
  if (g.npc!.post) g.npc!.plan.push({ k: "go", ...g.npc!.post });
}

/** Thrown out: tickets cancelled, anything nasty confiscated, face remembered. */
export function eject(w: World, g: Actor | null, t: Actor): void {
  const s = w.state, st = s.stadium!;
  const taken: string[] = [];
  for (const id of [t.hand, ...t.pockets]) {
    if (!id) continue;
    const it = s.items[id];
    if (it.def === "ticket") { it.void = true; moveItem(s, id, { k: "in", c: st.locker }); taken.push("ticket"); }
    else if (hasProp(it, "weapon") || hasProp(it, "illicit") || hasProp(it, "substance")) { moveItem(s, id, { k: "in", c: st.locker }); taken.push(defOf(it).name.toLowerCase()); }
  }
  t.x = SPOTS.ejectPoint.x; t.y = SPOTS.ejectPoint.y + 1; t.heldBy = undefined; t.seated = false;
  if (!st.banned.includes(t.faceId)) st.banned.push(t.faceId);
  st.warnings = 0;
  st.detainedUntil = 0;
  if (g) say(w, g, "You're barred. Don't come back.");
  w.bus.emit({ type: "ejected", t: s.tick, who: t.id, taken });
}

export function finishArrest(w: World, t: Actor, text: string): void {
  const st = w.state.stadium!;
  if (st.ending) return;
  st.ending = { kind: "arrested", title: "Arrested", text };
  w.bus.emit({ type: "arrested", t: w.state.tick, who: t.id });
}

/** The player tries to wriggle free. */
export function struggle(w: World, t: Actor): boolean {
  const g = t.heldBy ? w.state.actors[t.heldBy] : undefined;
  if (!g) return false;
  const s = w.state, st = s.stadium!, n0 = g.npc!;
  // One proper heave a second; frantic tapping does nothing extra.
  if (s.tick - (st.flags.lastStruggle ?? -999) < 50) return false;
  st.flags.lastStruggle = s.tick;
  let p = 0.1 + (t.effects.wired > s.tick ? 0.1 : 0) - (t.effects.drunk > s.tick ? 0.04 : 0);
  p *= Math.pow(0.55, n0.grip ?? 0);
  // A second steward close by makes it harder still.
  for (const id in s.actors) { const o = s.actors[id]; if (o !== g && isSecurity(o) && Math.hypot(o.x - t.x, o.y - t.y) < 4) { p *= 0.4; break; } }
  if (!chance(s.rng.world, p)) {
    n0.grip = (n0.grip ?? 0) + 1;
    say(w, g, ["Stop wriggling!", "Don't you dare.", "Keep still!", "I've got you, sunshine."][Math.min(3, n0.grip - 1)], 1.2);
    w.bus.emit({ type: "struggle_failed", t: s.tick, who: t.id });
    return false;
  }
  t.heldBy = undefined;
  g.downUntil = w.state.tick + 50;
  const n = g.npc!;
  n.crime = Math.max(n.crime, 1); n.sus[t.id] = 2;
  setMode(w, g, "chase");
  say(w, g, "Oi! Come back!");
  w.bus.emit({ type: "broke_free", t: w.state.tick, who: t.id, from: g.id });
  return true;
}

/** Detention: the police turn up, unless he has slipped away first. */
export function stepDetention(w: World): void {
  const s = w.state, st = s.stadium!, pc = s.actors[st.pc];
  if (!st.detainedUntil || !pc || st.ending) return;
  const inOffice = areaAt(pc.x, pc.y).id === "security";
  if (!inOffice) { st.detainedUntil = 0; st.policeCalled = false; return; } // escaped
  if (s.tick < st.detainedUntil) return;
  if (st.policeCalled) return finishArrest(w, pc, "The police collected him from the security office.");
  const chief = Object.values(s.actors).find((a) => a.npc?.job === "chief");
  eject(w, chief ?? null, pc);
}

