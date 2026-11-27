// What stewards and police notice, how suspicious they get, and what they do about it.
import { maybeSnitch } from "./witness";
import { climb, ladderNear, roofOf, roofs } from "./roofs";
import { appearance, looksPermitted } from "../core/identity";
import { defOf, hasProp, moveItem } from "../core/items";
import { chance, pick } from "../core/rng";
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
  // Up on a roof (or looking down from one): walls don't get in the way, but people rarely look up,
  // so a man on a roof is only seen from nearer, and well in front of them (Dishonored's squashed cone).
  const above = !!t.roof !== !!v.roof || (t.roof && v.roof);
  if (t.roof && !v.roof) {
    range = Math.min(range, isSecurity(v) ? 20 : 12);
    // Nobody indoors sees through their own ceiling.
    const r = roofOf(t);
    if (r && v.x > r.x0 && v.x < r.x1 && v.y > r.y0 && v.y < r.y1) return false;
  }
  if (d > range) return false;
  if (d > (isSecurity(v) ? 4.5 : 2.5)) {
    const ang = Math.atan2(dy, dx) - v.facing;
    const c = Math.cos(ang);
    if (c < (t.roof && !v.roof ? 0.55 : 0.2)) return false; // roughly 160 degrees of vision; less looking up
  }
  if (!above && !lineOfSight(v.x, v.y, t.x, t.y)) return false;
  return !smokeBetween(w, v.x, v.y, t.x, t.y);
}

/** Does a smoke cloud lie between two points (or swallow either)? */
export function smokeBetween(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  for (const c of w.state.stadium!.smoke) {
    if (c.kind === "stench") continue; // you can see through a smell
    if (c.until < w.state.tick) continue;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / l2));
    if (Math.hypot(ax + dx * t - c.x, ay + dy * t - c.y) < c.r) return true;
  }
  return false;
}

/** The worst thing this person looks like they are doing just by being here. */
/** Rooms a hi-vis vest alone won't get you into: the dressing rooms, the officials', the tunnel, the
 *  kit room, the security office. (Concourses, stands, staff corridors: a vest is enough.) */
export const HIGH_SECURITY = new Set(["security", "dress_home", "dress_away", "ref_room", "tunnel", "kitroom"]);
export const inVest = (w: World, t: Actor) => !!t.worn.outer && w.state.items[t.worn.outer]?.def === "hivis";
/** Seen doing something in the vest: they know he's not one of theirs now. */
export const vestBlown = (w: World, t: Actor) => inVest(w, t) && (w.state.stadium!.flags.vestBlown ?? 0) > w.state.tick;

function trespass(w: World, t: Actor, area: Area): number {
  // Nobody can see whether you have a ticket in your pocket: only the turnstiles check.
  if (area.access === "ticket" || area.access === "public") return 0;
  if (inVest(w, t) && appearance(w.state, t).role === "steward") {
    if (vestBlown(w, t)) return area.pitch ? (area.id === "pitch" ? 3 : 1.2) : area.access === "restricted" ? 1 : 0.7;
    if (HIGH_SECURITY.has(area.id)) return 1;
  }
  if (looksPermitted(w.state, t, area as any)) return 0;
  if (area.pitch) return area.id === "pitch" ? 3 : 1.2;
  return area.access === "restricted" ? 1 : area.access === "staff" ? 0.7 : 0.4;
}

/** Does this person match a description going round? */
export function wantedMatch(w: World, v: Actor, t: Actor): number {
  const st = w.state.stadium!, ap = appearance(w.state, t), d = Math.hypot(t.x - v.x, t.y - v.y);
  const outer = t.worn.outer ? w.state.items[t.worn.outer].def : null;
  let m = 0;
  const seenFace = 1 - ap.faceCover;
  for (const wd of st.wanted) {
    if (wd.until < w.state.tick) continue;
    if (wd.face === ap.faceId && d < 5) m = Math.max(m, 0.9 * wd.severity * seenFace);
    // The same outfit is a strong match; the same shirt with a new hat or glasses, a weak one.
    if (wd.look === ap.look) m = Math.max(m, 0.45 * wd.severity);
    else if (wd.team === ap.team && wd.outer === outer && wd.role === ap.role) m = Math.max(m, 0.18 * wd.severity);
  }
  if (st.banned.includes(ap.faceId) && d < 4 && areaAt(t.x, t.y).access !== "public") m = Math.max(m, 0.8 * seenFace);
  // Up close, a borrowed face or a pair of hands is noticed.
  if (ap.grisly && d < 3) m = Math.max(m, 1.2);
  if (ap.sinister) m = Math.max(m, 0.5);
  return m;
}

// ---------- Crimes and witnesses ----------
/** Staff who would object to minor things that a passing fan would not care about. */
const STAFFISH = new Set(["worker", "driver", "barman", "cook", "cleaner", "seller"]);

/** Who could see a spot. `everyone` false means only staff and security care. */
export function witnessesOf(w: World, x: number, y: number, exclude: Id[], everyone = true, of?: Actor): Actor[] {
  const out: Actor[] = [];
  const probe = { x, y, hiddenIn: undefined, roof: of?.roof, roofId: of?.roofId } as unknown as Actor;
  for (const id in w.state.actors) {
    const a = w.state.actors[id];
    if (!a.npc || exclude.includes(id) || a.downUntil > w.state.tick) continue;
    if (a.npc.job === "player" || a.npc.job === "official" || a.npc.job === "cleanup") continue; // the clean-up crew saw nothing
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
  const seen = witnessesOf(w, by.x, by.y, [by.id, ...(victim ? [victim.id] : [])], everyone, by);
  if (victim?.npc && victim.npc.job !== "player" && victim.npc.job !== "official" && victim.downUntil <= s.tick) seen.push(victim);
  const ap = appearance(s, by);
  st.incidents.push({ t: s.tick, what, by: by.id, blamed: ap.team, severity, seenBy: seen.length });
  w.bus.emit({ type: "incident", t: s.tick, what, by: by.id, blamed: ap.team, severity, seen: seen.length, victim: victim?.id });
  if (!seen.length) return 0;
  if (inVest(w, by)) st.flags.vestBlown = s.tick + 60 * 240;
  // From a roof, unless somebody was close, all they saw was a fat bloke up there: no face to go on.
  const faceless = !!by.roof && !seen.some((a) => Math.hypot(a.x - by.x, a.y - by.y) < 9);
  st.wanted.push({
    face: faceless ? "" : ap.faceId, team: ap.team, role: ap.role, outer: by.worn.outer ? s.items[by.worn.outer].def : null, look: ap.look,
    severity: Math.min(1, 0.35 + severity * 0.25) * (faceless ? 0.5 : 1), until: s.tick + 60 * (faceless ? 120 : 300), what,
  });
  let shouted = false;
  let radioed = false;
  for (const wtn of seen) {
    const n = wtn.npc!;
    if (isSecurity(wtn)) {
      alert(w, wtn, by, severity, 1.8);
      // A steward who saw it himself gets on the radio: his mates nearby come to where it happened.
      // He reaches for his radio: a second and a half to flatten him before backup's on its way.
      if (!radioed && severity >= 2 && wtn.npc!.job !== "turnstile") {
        radioed = true;
        (st.pendingRadio ??= []).push({ by: wtn.id, target: by.id, x: by.x, y: by.y, severity, at: s.tick + 90 });
      }
    } else if (!shouted) {
      // Only security within earshot come running: close, and not through a wall.
      const heard = Object.values(s.actors).filter((g) => { const d = Math.hypot(g.x - wtn.x, g.y - wtn.y); return isSecurity(g) && g.downUntil <= s.tick && (d < 7 || (d < EARSHOT && lineOfSight(g.x, g.y, wtn.x, wtn.y))); });
      if (!heard.length) {
        // Nobody to shout to: he might go and find one (or cheer, or look away).
        if (by.id === st.pc && maybeSnitch(w, wtn, by, what, severity, victim)) { shouted = true; n.nextBark = s.tick + 300; continue; }
      }
      shouted = true;
      say(w, wtn, severity >= 2 ? "Oi! Somebody stop him!" : "Oi! Did you see that?");
      for (const g of heard) alert(w, g, by, severity, 1.1);
    }
    n.nextBark = s.tick + 300;
  }
  return seen.length;
}

/** What stewards say at each step: a few ways of saying it, so it isn't the same line every time. */
export const STW_LINES = {
  detain: ["You're coming with me.", "Right, you. Office. Now.", "Got you, you little sod.", "That's enough of that. You're coming with me."],
  eject: ["Right. Out you go.", "You're done, pal. Out.", "Come on. Out. Now."],
  warn: ["You can't be in here, pal. Come on.", "Wrong way, mate. Back you go.", "Staff only, sunshine. Out."],
  arrest: ["You're nicked, sunshine."],
  struggle: ["Stop wriggling!", "Pack it in!", "Don't make this worse, son."],
  seat: ["Sit there and don't move. The police are on their way.", "Sit down. Don't touch anything.", "Wait there. Old Bill'll be along."],
  seatSoft: ["Sit there and have a think about what you've done.", "You can sit there till you've calmed down."],
  barred: ["You're barred. Don't come back.", "And stay out.", "Go on. Hop it."],
  spot: ["Oi! You!", "Oi! Stop right there!", "Hoy! Come here!"],
};
/** A line from the pool, not the one this steward said last. */
function line(w: World, g: Actor, kind: keyof typeof STW_LINES): string {
  const pool = STW_LINES[kind], n = g.npc!;
  let i = Math.floor(w.state.rng.world.a % pool.length + (w.state.tick % 7)) % pool.length;
  if (pool.length > 1 && pool[i] === n.lastLine) i = (i + 1) % pool.length;
  n.lastLine = pool[i];
  return pool[i];
}

/** How far a shout carries, and a radio call. */
const EARSHOT = 16, RADIO_RANGE = 38;

/** Backup calls that were waiting on a steward getting his radio out: sent, unless he's been stopped. */
export function stepRadio(w: World): void {
  const s = w.state, st = s.stadium!;
  if (!st.pendingRadio?.length) return;
  for (const r of st.pendingRadio) {
    if (s.tick < r.at) continue;
    const wtn = s.actors[r.by], by = s.actors[r.target];
    r.at = -1;
    if (!wtn || !by || wtn.dead || wtn.downUntil > s.tick || wtn.hiddenIn) { w.bus.emit({ type: "radio_stopped", t: s.tick, by: r.by }); continue; }
    let told = 0;
    for (const id in s.actors) {
      const g = s.actors[id];
      if (g === wtn || !isSecurity(g) || g.downUntil > s.tick || Math.hypot(g.x - r.x, g.y - r.y) > RADIO_RANGE) continue;
      alert(w, g, by, r.severity, 1.0); told++;
    }
    if (told) { say(w, wtn, "Control, I need backup!", 2.5); w.bus.emit({ type: "radioed", t: s.tick, by: wtn.id, x: r.x, y: r.y, n: told }); }
  }
  st.pendingRadio = st.pendingRadio.filter((r) => r.at >= 0);
}

export function alert(w: World, g: Actor, by: Actor, severity: number, sus: number): void {
  const n = g.npc!;
  // Spotted doing something: the moment to react (the view slows time for it).
  if (severity >= 1 && (n.mode === "routine" || n.mode === "watch" || n.mode === "search") && by.id === w.state.stadium!.pc && canSee(w, g, by, 26))
    w.bus.emit({ type: "spotted", t: w.state.tick, by: g.id, who: by.id });
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
  if (st.banned.includes(appearance(w.state, t).faceId) && area.access !== "public") return "eject";
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
  // Left up a roof with nobody to chase: back down.
  if (g.roof && n.mode !== "chase" && n.mode !== "escort") { const t0 = n.target ? s.actors[n.target] : undefined; roofChase(w, g, t0 ?? g, false); return; }

  // Perception, staggered so not everybody looks on the same tick.
  if ((tick + g.id.length * 7 + g.id.charCodeAt(g.id.length - 1)) % 6 === 0) {
    for (const t of suspects(w)) {
      if (t.heldBy || st.ending || (st.flags.graceUntil ?? 0) > tick) continue;
      const range = (n.job === "pitchsteward" || n.job === "police" ? 22 : 14) + Math.min(5, st.flags.securityLevel ?? 0) * 0.8;
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
        // Every delay and every outrage puts them more on edge; a fire alarm has them looking elsewhere.
        rate *= 1 + 0.18 * Math.min(5, st.flags.securityLevel ?? 0);
        if ((st.flags.alarmUntil ?? 0) > tick && n.job !== "police") rate *= 0.45;
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
      if (sus >= 0.9) { setMode(w, g, "approach"); say(w, g, n.crime >= 1 ? line(w, g, "spot") : "Excuse me, sir."); }
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
      // Up a roof: get to the foot of his ladder, wait a moment, then go up after him. Up there,
      // straight at him; if he's dropped off, back down the way you came.
      if (roofChase(w, g, t, visible)) return;
      const tx = visible ? t.x : n.lastSeen!.x, ty = visible ? t.y : n.lastSeen!.y;
      const d = Math.hypot(tx - g.x, ty - g.y);
      const run = n.crime >= 1 || Math.hypot(t.vx, t.vy) > 2.6 || areaAt(t.x, t.y).pitch === true;
      // Re-plan towards the target every half second.
      if (!n.goal || (tick % 30 === 0)) goTo(g, tx, ty, run);
      if (n.goal) n.goal.run = run;
      if (d > 2.2 || !visible) follow(w, g);
      else { const k = 1 / (d || 1); g.speed = run ? 5.6 : 2.2; g.moveX = (tx - g.x) * k; g.moveY = (ty - g.y) * k; }
      if (visible && Math.hypot(t.x - g.x, t.y - g.y) < 1.15 && !t.hiddenIn) return apprehend(w, g, t);
      if (!visible && Math.hypot(n.lastSeen!.x - g.x, n.lastSeen!.y - g.y) < 1.5) { setMode(w, g, "search"); say(w, g, "Where's he gone?"); }
      return;
    }
    case "search": {
      if (t && canSee(w, g, t, 18) && sus > 0.6) return setMode(w, g, "chase");
      if (!n.goal) { const r = s.rng.world; goTo(g, n.lastSeen!.x + (r.a % 7) - 3, n.lastSeen!.y + (r.b % 7) - 3); }
      follow(w, g);
      // While they're hunting for him (the evasion countdown), they keep looking; stepHeat calls it off.
      if (tick > Math.max(n.modeUntil, st.flags.evadeUntil ?? 0)) { if (t) n.sus[t.id] = 0.4; say(w, g, "Lost him."); setMode(w, g, "routine"); }
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
  say(w, g, line(w, g, n.intent as "warn" | "eject" | "detain" | "arrest"));
  w.bus.emit({ type: "caught", t: w.state.tick, by: g.id, who: t.id, intent: n.intent });
  if (n.intent === "arrest") { finishArrest(w, t, "Arrested at the ground."); return; }
  if (n.intent === "warn") st.warnings++;
  setMode(w, g, "escort");
  const dest = n.intent === "warn" ? warnDestination(w, t) : n.intent === "detain" ? SPOTS.holding : SPOTS.ejectPoint;
  n.escortTo = { x: dest.x, y: dest.y };
  n.escortAt = w.state.tick; n.grip = 0;
  goTo(g, dest.x, dest.y);
  // Caught soon after climbing out of a bus that has been mowing people down: it was him.
  if (st.flags.leftBusAt && w.state.tick - st.flags.leftBusAt < 60 * 120 && t.id === st.pc) {
    let changed = false;
    for (const inc of st.incidents) if (inc.by === t.id && inc.what.includes("bus") && inc.blamed !== appearance(w.state, t).team) { inc.blamed = appearance(w.state, t).team ?? "ENG"; changed = true; }
    if (changed) w.bus.emit({ type: "unmasked", t: w.state.tick, who: t.id, was: w.state.stadium!.vehicles.bus?.team, now: "ENG", outer: "a bus", football: false });
  }
  // Pull off an outer layer and see what is underneath, if it was a shirt that did the talking.
  if (n.intent !== "warn" && t.worn.outer && n.crime >= 1) revealShirt(w, g, t);
}

/** Security pull the outer shirt off. If the blame was going to the other lot, it comes back. */
function revealShirt(w: World, g: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!;
  const outerId = t.worn.outer!, before = appearance(s, t).team, outerName = defOf(s.items[outerId]).name;
  moveItem(s, outerId, { k: "in", c: st.locker });
  const after = appearance(s, t).team;
  if (before !== after) {
    say(w, g, after === "ENG" ? "Hang on. He's English!" : "Hang on a minute.");
    for (const inc of st.incidents) if (inc.by === t.id && inc.blamed === before) inc.blamed = after;
    w.bus.emit({ type: "unmasked", t: s.tick, who: t.id, was: before, now: after, outer: outerName, football: !!before });
  }
}

function escort(w: World, g: Actor): void {
  const s = w.state, n = g.npc!, st = s.stadium!;
  const t = n.target ? s.actors[n.target] : undefined;
  if (!t || t.heldBy !== g.id) { setMode(w, g, "routine"); return; }
  n.goal && (n.goal.run = false);
  const to = n.escortTo ?? { x: g.x, y: g.y };
  // Nobody wants to watch a long walk: a moment to struggle, a fade to black, and the cut happens
  // while the screen is dark (the view snaps the camera there and fades back in).
  const held = s.tick - (n.escortAt ?? s.tick);
  if (held === Math.round(60 * 1.2)) w.bus.emit({ type: "escort_fade", t: s.tick, who: t.id, intent: n.intent });
  if (held > 60 * 1.6 && Math.hypot(g.x - to.x, g.y - to.y - 0.9) > 0.5) {
    g.x = to.x; g.y = to.y + 0.9; t.x = to.x; t.y = to.y; n.goal = null; n.path = [];
    w.bus.emit({ type: "escort_cut", t: s.tick, who: t.id, intent: n.intent });
  }
  if (!n.goal && Math.hypot(g.x - to.x, g.y - to.y) > 1.5) goTo(g, to.x, to.y);
  follow(w, g);
  g.speed = 2.6;
  if (!n.goal && Math.hypot(g.x - to.x, g.y - to.y) > 1.5) { g.moveX = g.moveY = 0; }
  const arrived = Math.hypot(g.x - to.x, g.y - to.y) < 1.5;
  // Drag him along just behind.
  const bx = g.x - Math.cos(g.facing) * 0.85, by = g.y - Math.sin(g.facing) * 0.85;
  t.x += (bx - t.x) * 0.3; t.y += (by - t.y) * 0.3; t.vx = g.vx; t.vy = g.vy; t.facing = g.facing;
  if (!arrived) return;
  t.heldBy = undefined;
  const intent = n.intent;
  if (intent === "warn") { say(w, g, "Don't let me see you back in there."); n.sus[t.id] = 0.35; calmDown(w, t, 8); }
  else if (intent === "eject") eject(w, g, t);
  else if (intent === "detain") {
    st.detainedUntil = s.tick + 60 * 45;
    if (n.crime >= 3 || st.incidents.some((i) => i.by === t.id && i.severity >= 3)) st.policeCalled = true;
    say(w, g, line(w, g, st.policeCalled ? "seat" : "seatSoft"), 4);
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
  const seenFace = appearance(s, t).faceId;
  if (!st.banned.includes(seenFace)) st.banned.push(seenFace);
  st.warnings = 0;
  st.detainedUntil = 0;
  if (g) say(w, g, line(w, g, "barred"));
  calmDown(w, t, 25);
  w.bus.emit({ type: "ejected", t: s.tick, who: t.id, taken });
}

/** Everyone stops being after him for a while: thrown out is thrown out, not thrown out again. */
export function calmDown(w: World, t: Actor, seconds: number): void {
  const s = w.state, st = s.stadium!;
  st.flags.graceUntil = s.tick + 60 * seconds;
  for (const id in s.actors) {
    const n = s.actors[id].npc;
    if (!n) continue;
    n.sus[t.id] = 0;
    if (n.target === t.id && n.mode !== "escort") { n.target = null; n.mode = "routine"; n.intent = null; n.crime = 0; n.plan = []; }
  }
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
    say(w, g, line(w, g, "struggle"), 1.2);
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



/** He's changed his clothes. Anyone after him who couldn't see him do it has lost him: they're
 *  looking for the old outfit now (Hitman's rule: a disguise change out of sight breaks the chase;
 *  one done in front of them doesn't). Seen doing it, the new look goes round too. */
export function changedClothes(w: World, pc: Actor): void {
  const s = w.state, st = s.stadium!, tick = s.tick;
  const after = Object.values(s.actors).filter((a) => isSecurity(a) && a.npc!.target === pc.id && a.downUntil <= tick && a.npc!.mode !== "escort");
  if (!after.length || pc.heldBy) return;
  const saw = after.filter((a) => canSee(w, a, pc, 20));
  if (saw.length) {
    const ap = appearance(s, pc);
    for (const wd of st.wanted) if (wd.until > tick) wd.look = ap.look;
    say(w, saw[0], "Getting changed won't help you, sunshine.");
    return;
  }
  for (const a of after) { const n = a.npc!; n.sus[pc.id] = 0.3; n.crime = 0; n.mode = "routine"; n.target = null; n.intent = null; n.goal = null; n.path = []; n.plan = []; say(w, a, pick(s.rng.world, ["Where's he gone?", "Lost him.", "He was right here."])); }
  st.flags.evadeUntil = 0;
  st.flags.cautionUntil = tick + 60 * 20;
  w.bus.emit({ type: "evaded", t: tick, disguise: true });
}

// ---------- Heat ----------
/** How hot it is for him, MGS/GTA style. flags.heatMode: 0 clear, 1 noticed, 2 caution, 3 evasion,
 *  4 alert. flags.heat: 0 to 5 stars. While they're after him and none of them can see him, a countdown
 *  (flags.evadeUntil) runs; stay out of sight until it's done and they give up. */
export function stepHeat(w: World): void {
  const s = w.state, st = s.stadium!, tick = s.tick, pc = s.actors[st.pc];
  if (!pc) return;
  const after = Object.values(s.actors).filter((a) => isSecurity(a) && a.npc!.target === pc.id && a.downUntil <= tick);
  const hunting = after.filter((a) => ["approach", "chase", "search"].includes(a.npc!.mode) && a.npc!.crime >= 1);
  const holding = after.some((a) => a.npc!.mode === "escort") || !!pc.heldBy || !!st.detainedUntil;
  // Hysteresis: getting spotted is instant, but once they've got eyes on him it takes a second and a
  // half fully out of sight to drop to evasion. Without it, cover that blinks the line of sight on and
  // off (the hotel lobby's sofas and luggage) flickers alert/evasion and keeps restarting the countdown.
  const grace = st.flags.heatMode === 4 ? 90 : 20;
  const seen = hunting.some((a) => a.npc!.mode !== "search" && a.npc!.lastSeen && tick - a.npc!.lastSeen.t < grace);
  const worst = Math.max(0, ...after.map((a) => a.npc!.crime));
  const police = after.some((a) => a.npc!.job === "police" && a.npc!.mode !== "routine") || worst >= 3;
  let mode = 0;
  if (holding) { mode = 4; st.flags.evadeUntil = 0; st.flags.evadeLeft = 0; }
  else if (hunting.length && seen) {
    // Glimpsed again mid-evasion: remember what was left on the clock. A glimpse shouldn't hand them
    // the full countdown again; a proper sighting (five seconds and more) does.
    if (st.flags.heatMode !== 4) { st.flags.alertSince = tick; if ((st.flags.evadeUntil ?? 0) > tick) st.flags.evadeLeft = st.flags.evadeUntil! - tick; }
    if (tick - (st.flags.alertSince ?? tick) > 60 * 5) st.flags.evadeLeft = 0;
    mode = 4; st.flags.evadeUntil = 0;
  }
  else if (hunting.length) {
    // Out of sight: they've got this long to find him.
    if (!st.flags.evadeUntil) {
      const full = 60 * (10 + 3 * Math.min(4, worst)), left = st.flags.evadeLeft ?? 0;
      st.flags.evadeUntil = tick + (left ? Math.min(full, Math.max(60 * 6, left + 60 * 3)) : full);
      st.flags.evadeLeft = 0;
      w.bus.emit({ type: "evasion", t: tick });
    }
    mode = 3;
    for (const a of hunting) {
      const n = a.npc!;
      // The ones still running to where they last saw him carry on; then they comb the area.
      if (n.mode === "search") n.modeUntil = Math.max(n.modeUntil, st.flags.evadeUntil);
    }
    if (tick >= st.flags.evadeUntil) {
      for (const a of hunting) { const n = a.npc!; n.sus[pc.id] = 0.3; n.crime = 0; say(w, a, "Lost him."); n.mode = "routine"; n.target = null; n.intent = null; n.goal = null; n.path = []; n.plan = []; }
      // His description fades, too: they're not sure it was him any more.
      for (const wd of st.wanted) { wd.severity *= 0.5; wd.until = Math.min(wd.until, tick + 60 * 45); }
      st.flags.evadeUntil = 0;
      st.flags.cautionUntil = tick + 60 * 30;
      w.bus.emit({ type: "evaded", t: tick });
      mode = 2;
    }
  } else {
    st.flags.evadeUntil = 0; st.flags.evadeLeft = 0;
    if ((st.flags.cautionUntil ?? 0) > tick) mode = 2;
    else if (after.some((a) => a.npc!.mode !== "routine")) mode = 1;
  }
  // Stars go with what they've seen you do (GTA's rule): a pickpocket is one star however hard they
  // chase you; a punch is two; something serious is three; a killing four; armed police five. The
  // police joining in, or a spree (four crimes seen in two minutes), adds one, never past four.
  const spree = st.incidents.filter((i) => i.by === pc.id && i.seenBy > 0 && tick - i.t < 60 * 120).length >= 4;
  const sev = Math.max(1, Math.min(4, worst));
  let heat = mode >= 3 ? sev + ((police && sev >= 2) || spree ? 1 : 0) : mode === 2 ? 1 : mode;
  heat = Math.min(4, heat);
  if (st.flags.armedAt && (mode >= 3 || s.tick - st.flags.armedAt < 60 * 120)) heat = 5;
  if (mode !== st.flags.heatMode) w.bus.emit({ type: "heat", t: tick, mode, was: st.flags.heatMode ?? 0 });
  st.flags.heatMode = mode;
  st.flags.heat = Math.min(5, heat);
}

/** Chasing someone onto (or off) a roof. True if it took over this step. */
function roofChase(w: World, g: Actor, t: Actor, visible: boolean): boolean {
  const n = g.npc!, tick = w.state.tick;
  if (g.roof) {
    if (t.roof && t.roofId === g.roofId) {
      const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy) || 1;
      g.speed = 4.2; g.moveX = dx / d; g.moveY = dy / d;
      if (d < 1.15 && visible) {
        // Collared on the roof: both of you back down the ladder, then he walks you off.
        const r = roofOf(g)!, l = r.ladders[0];
        g.roof = t.roof = false; g.roofId = t.roofId = undefined;
        t.x = l.bx; t.y = l.by; g.x = l.bx + 0.6; g.y = l.by + 0.3;
        apprehend(w, g, t);
      }
      return true;
    }
    // He's gone: back down the ladder.
    const r = roofOf(g);
    const l = r?.ladders[0];
    if (!r || !l) { g.roof = false; g.roofId = undefined; return false; }
    if (t === g) { /* nobody to chase: just go down */ }
    if (Math.hypot(g.x - l.tx, g.y - l.ty) < 1.2) { climb(w, g, false, r, l); return true; }
    const dx = l.tx - g.x, dy = l.ty - g.y, d = Math.hypot(dx, dy) || 1;
    g.speed = 4.2; g.moveX = dx / d; g.moveY = dy / d;
    return true;
  }
  if (!t.roof) return false;
  const r = roofs().find((x) => x.id === t.roofId);
  if (!r) return false;
  const l = r.ladders.reduce((b, x) => (Math.hypot(x.bx - g.x, x.by - g.y) < Math.hypot(b.bx - g.x, b.by - g.y) ? x : b));
  const d = Math.hypot(l.bx - g.x, l.by - g.y);
  if (d > 1.5) {
    if (!n.goal || tick % 30 === 0) goTo(g, l.bx, l.by, true);
    follow(w, g);
    n.roofWait = 0;
    return true;
  }
  g.moveX = g.moveY = 0;
  g.facing = Math.atan2(t.y - g.y, t.x - g.x);
  // A few seconds at the bottom ("Come down, you idiot!"), then up he comes.
  if (!n.roofWait) { n.roofWait = tick + 60 * 4; say(w, g, "Come down from there, you idiot!", 2.5); }
  if (tick >= n.roofWait && ladderNear(g)) { n.roofWait = 0; climb(w, g, true, r, l); }
  return true;
}
