// Stadium-specific actions and how the world reacts to them. Nothing here knows
// about "tricks": a pie that hits the referee distracts him because thrown things
// that hit people distract them.
import { appearance } from "../core/identity";
import { canPocket, defOf, hasProp, ITEM_DEFS, moveItem, spawnItem } from "../core/items";
import { chance, pick, rndRange } from "../core/rng";
import type { Action, Actor, Id, Item } from "../core/types";
import { registerVerb, VERBS } from "../core/verbs";
import type { World } from "../core/world";
import { bribePlayer, biasReferee, distractReferee, haltPlay, intruderKick, removePlayer, resumePlay, wirePlayer } from "../football/api";
import { areaAt, SPOTS, TURNSTILES, WALLS } from "./layout";
import { say } from "./npc";
import { alert, crime, isSecurity, struggle, witnessesOf } from "./security";
import { cargoOpen } from "./vehicles";

export const SHOPS: Record<string, { name: string; stock: Record<string, number> }> = {
  ticket: { name: "Ticket office", stock: { ticket: 60 } },
  merch: { name: "Merchandise stall", stock: { shirt_opp: 45, shirt_eng: 45, mask: 8 } },
  pub: { name: "The Three Lions", stock: { pint: 5, pie: 4 } },
  bar: { name: "Concourse bar", stock: { pint: 7, pie: 5 } },
};

const near = (a: Actor, b: { x: number; y: number }, r: number) => Math.hypot(a.x - b.x, a.y - b.y) <= r;
const targetActor = (w: World, act: Action) => (act.target?.k === "actor" ? w.state.actors[act.target.id] : undefined);
const targetItem = (w: World, act: Action) => (act.target?.k === "item" ? w.state.items[act.target.id] : undefined);

function give(w: World, a: Actor, def: string): Item {
  const it = spawnItem(w.state, def, { k: "ground", x: a.x, y: a.y });
  if (!a.hand) moveItem(w.state, it.id, { k: "hand", a: a.id });
  else if (canPocket(a, it)) moveItem(w.state, it.id, { k: "pocket", a: a.id });
  else {
    const old = w.state.items[a.hand];
    if (canPocket(a, old)) moveItem(w.state, old.id, { k: "pocket", a: a.id });
    else moveItem(w.state, old.id, { k: "ground", x: a.x, y: a.y });
    moveItem(w.state, it.id, { k: "hand", a: a.id });
  }
  return it;
}

const isStaffCrowd = (a: Actor) => !!a.npc && a.npc.job !== "player" && a.npc.job !== "official";

export function installRules(): void {
  registerVerb("buy", {
    check: (w, act, actor) => {
      const seller = targetActor(w, act), shop = seller?.npc?.shop;
      if (!seller || !shop) return "nobody selling";
      if (!near(actor, seller, 3.6)) return "too far";
      const price = SHOPS[shop].stock[act.arg ?? ""];
      if (price === undefined) return "not sold here";
      if (actor.money < price) return "not enough money";
      if (act.arg === "ticket" && (w.state.match?.period ?? 1) >= 2) return "sold out";
      return null;
    },
    perform: (w, act, actor) => {
      const seller = targetActor(w, act)!, price = SHOPS[seller.npc!.shop!].stock[act.arg!];
      actor.money -= price;
      const it = give(w, actor, act.arg!);
      if (act.arg === "ticket") it.owner = actor.id;
      say(w, seller, act.arg === "ticket" ? "There you go. Enjoy the game." : "Cheers.");
    },
  });

  registerVerb("talk", {
    check: (w, act, actor) => { const t = targetActor(w, act); return t?.npc && near(actor, t, 3.6) ? null : "nobody to talk to"; },
    perform: (w, act) => {
      const t = targetActor(w, act)!, n = t.npc!;
      if (n.lines?.length) { say(w, t, n.lines[n.stage % n.lines.length] ?? n.lines[0], 5); n.stage = n.job === "fan" || n.job === "local" ? n.stage : n.stage + 1; }
      else say(w, t, "What?");
      if (n.job === "fan" || n.job === "local") n.nextBark = w.state.tick + 120;
    },
  });

  registerVerb("bribe", {
    check: (w, act, actor) => {
      const t = targetActor(w, act);
      if (!t || (!t.npc && !t.fb && !t.off)) return "nobody to bribe";
      if (!near(actor, t, 2.2)) return "too far";
      if ((act.amount ?? 0) <= 0 || actor.money < (act.amount ?? 0)) return "not enough money";
      return null;
    },
    perform: (w, act, actor) => bribe(w, actor, targetActor(w, act)!, act.amount!),
  });

  registerVerb("pickpocket", {
    check: (w, act, actor) => {
      const t = targetActor(w, act);
      if (!t?.npc || !isStaffCrowd(t)) return "nobody to rob";
      if (!near(actor, t, 1.4)) return "too far";
      if (!t.pockets.length && !t.money) return "empty pockets";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, t = targetActor(w, act)!, r = s.rng.world;
      // Behind him and he is busy: much easier.
      const toMe = Math.atan2(actor.y - t.y, actor.x - t.x);
      const behind = Math.cos(toMe - t.facing) < -0.2;
      const p = (behind ? 0.75 : 0.35) + (t.seated ? 0.1 : 0) + (t.effects.drunk > s.tick ? 0.1 : 0) - (isSecurity(t) ? 0.4 : 0);
      if (!chance(r, p)) {
        say(w, t, "Oi! Get your hands out of my pocket!");
        crime(w, actor, "pickpocketing", 1, t);
        return;
      }
      const tickets = t.pockets.filter((id) => s.items[id].def === "ticket");
      if (tickets.length && (!t.money || chance(r, 0.6))) {
        const it = s.items[tickets[0]];
        if (canPocket(actor, it)) moveItem(s, it.id, { k: "pocket", a: actor.id }); else moveItem(s, it.id, { k: "hand", a: actor.id });
        if (t.npc) t.npc.hasTicket = false;
        w.bus.emit({ type: "stole", t: s.tick, by: actor.id, from: t.id, what: "ticket" });
      } else {
        const cash = Math.max(5, Math.round(t.money * rndRange(r, 0.5, 1)));
        t.money = Math.max(0, t.money - cash); actor.money += cash;
        w.bus.emit({ type: "stole", t: s.tick, by: actor.id, from: t.id, what: "cash", amount: cash });
      }
      // Somebody else might still have seen it.
      const seen = crimeSeenQuietly(w, actor);
      if (seen) crime(w, actor, "pickpocketing", 1);
    },
  });

  registerVerb("hide", {
    check: (w, act, actor) => {
      const it = targetItem(w, act);
      if (!it || !hasProp(it, "container") || it.def === "locker") return "nowhere to hide";
      const l = it.loc;
      if (l.k !== "ground" || !near(actor, l, 2.6)) return "too far";
      const v = Object.values(w.state.stadium!.vehicles).find((vv) => vv.cargo === it.id);
      if (v && !cargoOpen(v)) return "the back is shut";
      return null;
    },
    perform: (w, act, actor) => {
      const it = targetItem(w, act)!;
      if (crimeSeenQuietly(w, actor, false)) crime(w, actor, "climbing into a lorry", 1, undefined, false);
      actor.hiddenIn = it.id; actor.seated = false;
    },
  });

  registerVerb("unhide", {
    check: (w, act, actor) => (actor.hiddenIn ? null : "not hiding"),
    perform: (w, act, actor) => {
      const s = w.state, v = Object.values(s.stadium!.vehicles).find((vv) => vv.cargo === actor.hiddenIn);
      const it = s.items[actor.hiddenIn!];
      actor.hiddenIn = undefined;
      if (it.loc.k === "ground") { actor.x = it.loc.x; actor.y = it.loc.y; }
      if (v && v.state === "driving" && v.speed > 2) {
        actor.downUntil = s.tick + 100;
        w.bus.emit({ type: "fell_out", t: s.tick, who: actor.id });
      }
      if (crimeSeenQuietly(w, actor, false)) crime(w, actor, "climbing out of a lorry", 1, undefined, false);
    },
  });

  registerVerb("sit", {
    check: (w, act, actor) => (areaAt(actor.x, actor.y).seats && !actor.seated ? null : "nowhere to sit"),
    perform: (w, act, actor) => { actor.seated = true; actor.moveX = actor.moveY = 0; },
  });
  registerVerb("stand", {
    check: (w, act, actor) => (actor.seated ? null : "already standing"),
    perform: (w, act, actor) => { actor.seated = false; },
  });

  registerVerb("kick", {
    check: (w, act, actor) => {
      const m = w.state.match, b = m?.ball;
      if (!b || b.held || b.z > 1.2) return "no ball";
      return near(actor, b, 1.5) ? null : "too far";
    },
    perform: (w, act, actor) => {
      const dx = act.dirX ?? Math.cos(actor.facing), dy = act.dirY ?? Math.sin(actor.facing);
      const run = Math.hypot(actor.vx, actor.vy);
      intruderKick(w, actor.id, dx, dy, 11 + run * 1.2, 1.2);
    },
  });

  registerVerb("vault", {
    check: (w, act, actor) => (turnstileNear(actor) ? null : "nothing to climb"),
    perform: (w, act, actor) => {
      const g = turnstileNear(actor)!;
      const inside = actor.y < g.y;
      actor.y = inside ? g.y + g.h + 0.9 : g.y - 0.9;
      actor.downUntil = w.state.tick + 40;
      crime(w, actor, "jumping the turnstile", 1);
    },
  });

  registerVerb("hold", {
    check: (w, act, actor, item) => (item && actor.pockets.includes(item.id) ? null : "not in a pocket"),
    perform: (w, act, actor, item) => {
      const s = w.state;
      if (actor.hand) {
        const old = s.items[actor.hand];
        if (canPocket(actor, old) || (actor.pockets.length <= 3 && defOf(old).size === "small")) moveItem(s, old.id, { k: "pocket", a: actor.id });
        else moveItem(s, old.id, { k: "ground", x: actor.x, y: actor.y });
      }
      moveItem(s, item!.id, { k: "hand", a: actor.id });
    },
  });
  registerVerb("pocket", {
    check: (w, act, actor, item) => (item && actor.hand === item.id && defOf(item).size === "small" && actor.pockets.length < 3 ? null : "won't fit in a pocket"),
    perform: (w, act, actor, item) => moveItem(w.state, item!.id, { k: "pocket", a: actor.id }),
  });

  registerVerb("struggle", {
    check: (w, act, actor) => (actor.heldBy ? null : "nobody holding you"),
    perform: (w, act, actor) => { struggle(w, actor); },
  });

  // Showing a ticket works across a turnstile; the core verb assumes arm's length.
  const show = VERBS.show;
  VERBS.show = {
    check: (w, act, actor, item) => {
      const t = targetActor(w, act);
      if (!item || (actor.hand !== item.id && !actor.pockets.includes(item.id))) return "not carrying it";
      return t && near(actor, t, t.npc?.job === "turnstile" ? 3.8 : 1.6) ? null : "nobody close enough to show";
    },
    perform: show.perform,
  };

  // Hitting people is a crime, and how bad depends on who.
  const strike = VERBS.strike;
  VERBS.strike = {
    check: strike.check,
    perform: (w, act, actor, item) => {
      const t = targetActor(w, act)!;
      const weapon = !!item && hasProp(item, "weapon") && actor.hand === item.id;
      strike.perform(w, act, actor, item);
      const official = !!t.off, player = !!t.fb && t.fb.status === "playing";
      if (player) t.fb!.stunUntil = w.state.tick + (weapon ? 900 : 160);
      if (official) t.downUntil = w.state.tick + (weapon ? 1800 : 360);
      if (weapon && player) removePlayer(w, t.id, "injured");
      const sev = weapon ? 3 : official || player ? 3 : 2;
      crime(w, actor, weapon ? "an attack with a weapon" : official ? "assaulting the referee" : player ? "assaulting a player" : "assault", sev, t);
      if (t.npc && !weapon) say(w, t, "Ow! What was that for?");
    },
  };

  // Spiking: seen or not, the drink now carries whatever was put in it.
  const use = VERBS.use;
  VERBS.use = {
    check: use.check,
    perform: (w, act, actor, item) => {
      use.perform(w, act, actor, item);
      if (crimeSeenQuietly(w, actor)) crime(w, actor, "tampering with drinks", 2);
      w.bus.emit({ type: "spiked", t: w.state.tick, by: actor.id, item: (act.target as { id: Id }).id });
    },
  };
}

/** Would anybody nearby have noticed? The same eyes as a crime, without reporting it. */
function crimeSeenQuietly(w: World, actor: Actor, everyone = true): boolean {
  return witnessesOf(w, actor.x, actor.y, [actor.id], everyone).length > 0;
}

export function turnstileNear(a: Actor) {
  return WALLS.find((wl) => wl.gate && TURNSTILES.includes(wl.gate) && Math.abs(a.x - (wl.x + wl.w / 2)) < 1.6 && Math.abs(a.y - (wl.y + wl.h / 2)) < 1.6);
}

// ---------- Bribery ----------
function bribe(w: World, by: Actor, t: Actor, amount: number): void {
  const s = w.state, r = s.rng.world, st = s.stadium!, m = s.match!;
  const refuse = (line: string, severity: number) => {
    say(w, t, line, 4);
    if (t.npc) t.npc.refused.push(by.id);
    if (severity) crime(w, by, "attempted bribery", severity, t);
  };
  const accept = (line: string) => { by.money -= amount; t.money += amount; say(w, t, line, 4); w.bus.emit({ type: "bribed", t: s.tick, by: by.id, who: t.id, amount }); };
  if (t.npc?.refused.includes(by.id)) return refuse("I've told you once.", 0);

  if (t.fb) {
    const theirs = t.fb.team === 1;
    if (!theirs) return refuse("Are you mad? I play for England.", 0);
    if (amount < 100) return refuse("Is that a joke?", 1);
    const p = (t.fb.role === "GK" ? 0.5 : 0.35) + (amount >= 300 ? 0.2 : 0);
    if (chance(r, p)) { accept(t.fb.role === "GK" ? "...I didn't see you. Go." : "Fine. Now go."); bribePlayer(w, t.id); return; }
    return refuse("I'm reporting this.", 2);
  }
  if (t.off) {
    if (t.off.job !== "referee") return refuse("Not my department.", 1);
    if (amount < 150) return refuse("You must be joking.", 2);
    if (chance(r, amount >= 400 ? 0.55 : 0.35)) { accept("We never spoke."); biasReferee(w, 0, 0.75); return; }
    return refuse("This will be reported to the governing body.", 3);
  }
  const n = t.npc;
  if (!n) return;
  if (isSecurity(t)) {
    if (n.job === "police") return refuse("Bribing a police officer. That's a new one.", 3);
    const need = n.job === "chief" ? 50 : 20;
    if (amount < need) return refuse("That won't even buy me a pint.", 0);
    if (chance(r, n.job === "chief" ? 0.4 : 0.55)) {
      accept("I didn't see anything.");
      n.paidUntil = s.tick + 60 * 300; n.sus[by.id] = 0; if (n.target === by.id) { n.mode = "routine"; n.target = null; n.crime = 0; }
      // A paid gate steward opens up; a paid chief lets a detainee walk.
      if (n.job === "turnstile") { const g = turnstileNear(t) ?? turnstileNear(by); if (g?.gate) st.gates[g.gate] = { until: s.tick + 240, for: by.id }; }
      if (n.job === "doorguard") { st.doorPass = by.id; st.gates.staffdoor = { until: s.tick + 240, for: by.id }; }
      if (n.job === "chief" && st.detainedUntil) { st.detainedUntil = 0; st.policeCalled = false; st.gates.officedoor = { until: s.tick + 600, for: by.id }; }
      return;
    }
    return refuse("Are you trying to bribe me?", 1);
  }
  // A supporter with a ticket will sell it for the right money.
  if (n.job === "fan" && n.hasTicket && amount >= 80) {
    const tk = t.pockets.find((id) => s.items[id].def === "ticket");
    if (tk && chance(r, amount >= 120 ? 0.8 : 0.45)) {
      accept("Go on then. Don't tell the wife.");
      moveItem(s, tk, canPocket(by, s.items[tk]) ? { k: "pocket", a: by.id } : { k: "hand", a: by.id });
      n.hasTicket = false;
      n.plan = [{ k: "go", ...SPOTS.pubBar }, { k: "wait", s: 600 }];
      n.stage = 1;
      return;
    }
    return refuse("Not for all the tea in China.", 0);
  }
  if (amount >= 10) accept(pick(r, ["Cheers, mate!", "What's this for?", "Lovely."]));
}

// ---------- Reactions to things happening ----------
export function installReactions(w: World): void {
  w.bus.on((e) => {
    const s = w.state, st = s.stadium!;
    if (e.type === "item_hit") {
      const t = s.actors[e.target], by = s.actors[e.by], it = s.items[e.item];
      if (!t || !by) return;
      const weapon = hasProp(it, "weapon");
      if (t.off && s.match && t.id === s.match.officials.referee) distractReferee(w, weapon ? 30 : 9);
      if (t.off && weapon) t.downUntil = s.tick + 1200;
      if (t.fb) t.fb.stunUntil = s.tick + (weapon ? 600 : 50);
      if (t.npc) { say(w, t, weapon ? "Aargh!" : "Oi!"); if (weapon) t.downUntil = s.tick + 900; }
      const what = weapon ? "throwing a knife" : `throwing a ${defOf(it).name.toLowerCase()}`;
      crime(w, by, what, weapon ? 3 : t.off || t.fb ? 2 : 1, t.npc ? t : undefined);
    }
    if (e.type === "action" && e.action.verb === "show") turnstileCheck(w, e.action);
    if (e.type === "action" && e.action.verb === "consume" && e.action.actor === st.pc) {
      const pc = s.actors[st.pc];
      if (pc.effects.laxative > s.tick && !st.flags.pcLax) st.flags.pcLax = s.tick + 60 * 45;
    }
  });
}

function turnstileCheck(w: World, act: Action): void {
  const s = w.state, st = s.stadium!, by = s.actors[act.actor], t = targetActor(w, act), it = act.item ? s.items[act.item] : undefined;
  if (!t?.npc || t.npc.job !== "turnstile" || !it) return;
  const n = t.npc, ap = appearance(s, by), r = s.rng.world;
  if (n.mode !== "routine" && n.mode !== "watch") return;
  const g = turnstileNear(t) ?? turnstileNear(by);
  if (!g?.gate) return;
  if (it.def !== "ticket") return void say(w, t, "That's not a ticket, is it?");
  if (it.void) { n.sus[by.id] = Math.max(n.sus[by.id] ?? 0, 0.6); return void say(w, t, "This ticket's been cancelled. Hop it."); }
  if (it.used) return void say(w, t, "This one's already been scanned.");
  if (ap.faceHidden) return void say(w, t, "Mask off, please.");
  if (st.banned.includes(by.faceId)) { n.sus[by.id] = 0.7; return void say(w, t, "Hang on. You're the one we threw out. Go on, hop it."); }
  if (by.hand && s.items[by.hand].def === "pint") { moveItem(s, by.hand, { k: "gone" }); say(w, t, "No drinks inside. I'll have that."); }
  if (ap.alarming) { crime(w, by, "carrying a weapon at the gate", 2); return; }
  // A quick pat-down misses half of what is in pockets.
  const hidden = by.pockets.map((id) => s.items[id]).find((i) => hasProp(i, "weapon"));
  if (hidden && chance(r, 0.5)) {
    moveItem(s, hidden.id, { k: "in", c: st.locker });
    n.sus[by.id] = 1;
    say(w, t, "What's this, then? You're not coming in with that.", 4);
    crime(w, by, "carrying a weapon at the gate", 1);
    return;
  }
  it.used = true;
  st.gates[g.gate] = { until: s.tick + 60 * 4, for: by.id };
  say(w, t, "Enjoy the game.");
}

// ---------- Ticking rules ----------
/** Things that happen over time: the pitch, the half-time drinks, the call of nature. */
export function stepRules(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick, r = s.rng.world;
  const pc = s.actors[st.pc];
  if (!pc) return;

  // Somebody on the pitch who should not be: the referee stops play if he notices.
  const area = areaAt(pc.x, pc.y);
  const role = appearance(s, pc).role;
  const intruding = area.id === "pitch" && role !== "referee" && role !== "footballer" && !pc.hiddenIn;
  const ref = s.actors[m.officials.referee];
  if (intruding) {
    st.flags.offPitchSince = 0;
    st.flags.onPitchSince ||= tick;
    // The crowd notices before anyone: the noise turns every pitchside steward round.
    if (tick - st.flags.onPitchSince === 30) {
      w.bus.emit({ type: "pitch_invasion", t: tick, who: pc.id });
      for (const id in s.actors) {
        const g = s.actors[id];
        if (g.npc && (g.npc.job === "pitchsteward" || (g.npc.job === "police" && areaAt(g.x, g.y).pitch))) alert(w, g, pc, 2, 2);
      }
    }
    const refOk = ref.downUntil <= tick && !ref.off!.incapacitated && ref.off!.distractedUntil <= tick;
    if ((m.phase === "live") && refOk && tick - st.flags.onPitchSince > 50) haltPlay(w, "intruder");
  } else {
    st.flags.onPitchSince = 0;
    if (m.halted === "intruder") {
      st.flags.offPitchSince ||= tick;
      if (tick - st.flags.offPitchSince > 150) { resumePlay(w); st.flags.offPitchSince = 0; }
    }
  }

  // Players drink from their team's water before kick-off and at half-time.
  const drinkAt = (m.phase === "pre" && Math.round((m.phaseUntil - tick) / 60) === 100) || (m.phase === "break" && m.period === 1 && Math.round((m.phaseUntil - tick) / 60) === 70);
  if (drinkAt && (tick % 60) === 0) dose(w);

  // Doses take effect some time after the next kick-off.
  for (const id in st.dosed) {
    const d = st.dosed[id], a = s.actors[id];
    if (!a || tick < d.at) continue;
    delete st.dosed[id];
    if (d.effect === "wired") {
      if (a.fb) wirePlayer(w, a.id, 420);
      if (a.off) a.off.strictness = 1;
      w.bus.emit({ type: "dose_kicks_in", t: tick, id: a.id, effect: d.effect });
    } else if (d.effect === "laxative") {
      if (a.fb && a.fb.status === "playing") removePlayer(w, a.id, "toilet");
      if (a.off) { a.off.incapacitated = true; st.flags.refBackAt = tick + 60 * 75; }
      w.bus.emit({ type: "dose_kicks_in", t: tick, id: a.id, effect: d.effect });
    }
  }
  if (st.flags.refBackAt && tick >= st.flags.refBackAt) {
    ref.off!.incapacitated = false; st.flags.refBackAt = 0;
    w.bus.emit({ type: "ref_back", t: tick });
  }

  // The player's own dose of laxative.
  if (st.flags.pcLax && tick >= st.flags.pcLax) {
    st.flags.pcLax = 0;
    if (!areaAt(pc.x, pc.y).id.includes("toilet") && !areaAt(pc.x, pc.y).private) {
      w.bus.emit({ type: "accident", t: tick, who: pc.id });
      for (const id in s.actors) { const a = s.actors[id]; if (a.npc && near(a, pc, 6) && chance(r, 0.6)) say(w, a, pick(r, ["Oh, for God's sake.", "What is that smell?", "Mate. MATE."])); }
    }
  }

  // The staff door guard waves through anyone who looks like staff.
  const dg = Object.values(s.actors).find((a) => a.npc?.job === "doorguard");
  if (dg && dg.npc!.mode === "routine" && near(dg, SPOTS.doorPost, 2) && near(pc, SPOTS.staffDoor, 3.2) && tick % 20 === 0) {
    const ap = appearance(s, pc);
    const wanted = (dg.npc!.sus[pc.id] ?? 0) > 0.4 || (st.banned.includes(pc.faceId) && !ap.faceHidden);
    if (["steward", "police"].includes(ap.role) && !wanted) {
      if (st.doorPass !== pc.id) { st.doorPass = pc.id; st.gates.staffdoor = { until: tick + 200, for: pc.id }; say(w, dg, "All right, mate."); }
    } else if (!st.gates.staffdoor || st.gates.staffdoor.until < tick) {
      if (!dg.npc!.bubble) say(w, dg, wanted ? "Not you again." : "Staff only, mate.");
    }
  }
  if (st.doorPass && (!st.gates.staffdoor || st.gates.staffdoor.until < tick)) st.doorPass = null;

  // People chat when the player is nearby: that is how rumours spread.
  if (tick % 30 === 0 && tick > (st.flags.nextBark ?? 0)) {
    for (const id in s.actors) {
      const a = s.actors[id], n = a.npc;
      if (!n?.lines?.length || n.mode !== "routine" || n.bubble || tick < n.nextBark || a.hiddenIn) continue;
      if (!near(a, pc, 7) || !chance(r, 0.25)) continue;
      say(w, a, pick(r, n.lines), 5);
      n.nextBark = tick + 60 * 40;
      st.flags.nextBark = tick + 60 * 9;
      break;
    }
  }
}

function dose(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, r = s.rng.world;
  const find = (def: string) => Object.values(s.items).find((i) => i.def === def);
  const home = find("cooler_home"), away = find("cooler_away"), tea = find("tea_urn");
  const nextKick = m.phaseUntil + 60 * rndRange(r, 40, 220);
  for (const [cooler, team] of [[home, 0], [away, 1]] as [Item | undefined, number][]) {
    if (!cooler?.spiked) continue;
    const eff = ITEM_DEFS[cooler.spiked].effect ?? "laxative";
    for (const id of m.teams[team].squad) {
      const a = s.actors[id];
      if (a.fb!.status !== "gone" && chance(r, 0.55)) st.dosed[id] = { effect: eff, at: nextKick + Math.round(rndRange(r, 0, 60 * 150)) };
    }
    cooler.spiked = undefined;
  }
  if (tea?.spiked) {
    st.dosed[m.officials.referee] = { effect: ITEM_DEFS[tea.spiked].effect ?? "laxative", at: nextKick + Math.round(rndRange(r, 0, 60 * 120)) };
    tea.spiked = undefined;
  }
}

