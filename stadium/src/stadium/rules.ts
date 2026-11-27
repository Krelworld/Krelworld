// Stadium-specific actions and how the world reacts to them. Nothing here knows
// about "tricks": a pie that hits the referee distracts him because thrown things
// that hit people distract them.
import { autoWeapon } from "./affordances";
import { sharpInHand, stab, staffHands } from "./knife";
import { knockOut, land } from "./combat";
import { appearance } from "../core/identity";
import { canPocket, defOf, hasProp, ITEM_DEFS, moveItem, spawnItem } from "../core/items";
import { chance, pick, rnd, rndRange } from "../core/rng";
import { inVest, vestBlown } from "./security";
import { lineOfSight } from "./nav";
import type { Action, Actor, Id, Item } from "../core/types";
import { registerVerb, VERBS } from "../core/verbs";
import type { World } from "../core/world";
import { bribePlayer, biasReferee, distractReferee, haltPlay, intruderKick, removePlayer, resumePlay, wirePlayer } from "../football/api";
import { sendOff } from "../football/authority";
import { endPeriod } from "../football/match";
import { beginRestart } from "../football/restarts";
import { areaAt, SPOTS, TURNSTILES, VENUE, WALLS } from "./layout";
import { FAN_POOL, say, STAFF_LINES } from "./npc";
import { alert, crime, isSecurity, struggle, wantedMatch, witnessesOf } from "./security";
import { inDrag, isCreep, selfDefence } from "./drag";
import { cargoOpen } from "./vehicles";
import { holdOpen } from "./bus";
import { hearLead } from "./entries";
import { bribeSnitch, snitchOf } from "./witness";
import { banter, fresh, talkTo } from "./chatter";
import { startDetector } from "./detector";

export const SHOPS: Record<string, { name: string; stock: Record<string, number> }> = {
  ticket: { name: "Ticket office", stock: { ticket: 60 } },
  merch: { name: "Merchandise stall", stock: { shirt_por: 45, shirt_eng: 45, mask: 8 } },
  pub: { name: "The Three Lions", stock: { pint: 5, pie: 4 } },
  bar: { name: "Concourse bar", stock: { pint: 7, pie: 5 } },
  bookies: { name: "Bookmaker", stock: {} },
  // Lucky Lionel's is a pawnbroker now: a few useful things to buy, and cash for whatever you've
  // lifted off people (betting made the money side a sum; this makes it a loop: rob, sell, spend).
  pawn: { name: "Cash Kings Pawnbrokers", stock: { radio: 30, burner: 30, bicycle: 25, sunglasses: 5 } },
  kiosk: { name: "Snack kiosk", stock: { pie: 4, pint: 7 } },
  charity: { name: "Second Hand Rose", stock: { flat_cap: 6, sunglasses: 5, moustache: 3, wig: 9, long_wig: 12, dress: 15, tracksuit: 12, chef_whites: 18, overalls: 15 } },
  tout: { name: "Dodgy Del", stock: { ticket: 45 } },
  surplus: { name: "Army & Navy Surplus", stock: { balaclava: 10, hammer: 14, flare: 20, knife: 25, fart_can: 15 } },
  dealer: { name: "Spliff Ricky", stock: { powder: 30, laxative: 12, burner: 25, fart_can: 15 } },
};

export const fruitNear = (a: Actor) => VENUE.furniture.some((f) => f.key === "fruitmachine" && f.room === "pub" && Math.hypot(f.x - a.x, f.y + 0.6 - a.y) < 1.8);

/** What each thing on the to-do list pays. Starting with £40 and a ticket at £45-60, two or three
 *  easy ones get you in; a bent referee (£150) takes a proper afternoon's work. Roughly: the
 *  easier and more repeatable, the less; the big set pieces (the bus, a parachute, a streak) most. */
export const REWARDS: Record<string, number> = {
  in: 20, ko_stw: 15, horse: 25, car: 20, pitch: 15, dog: 15, splat: 10, slap: 5, bus: 40, chute: 30, lenny: 20, evade: 15,
  streak: 30, bomb: 15, grass: 10, boxer: 10, secret: 25, roof: 10, window: 10, stench: 15, rifle: 30, creep: 15,
};

/** What the pawnbroker gives for a thing (0: he won't have it). Stolen goods go for about half. */
const PAWN: Record<string, number> = {
  wallet: 15, radio: 15, match_ball: 25, boot_bag: 20, burner: 12, ticket: 30, press_pass: 20, staff_pass: 15, warrant_card: 35, police_hat: 10, police_uniform: 25,
  kit_card: 10, whistle: 5, ref_kit: 20, kit_eng: 40, kit_opp: 25, mascot_suit: 30, rifle: 120, bicycle: 12, knife: 6, hammer: 6, wrench: 8,
  shirt_eng: 15, shirt_opp: 10, shirt_por: 10, shirt_bra: 10, shirt_arg: 10, hivis: 8, parachute: 30, sunglasses: 2, flare: 6, powder: 0,
};
export function pawnOffer(def: string): number {
  if (def in PAWN) return PAWN[def];
  const d = ITEM_DEFS[def];
  return d?.price && !d.props.includes("food") && !d.props.includes("liquid") ? Math.max(1, Math.floor(d.price * 0.35)) : 0;
}

const near = (a: Actor, b: { x: number; y: number }, r: number) => Math.hypot(a.x - b.x, a.y - b.y) <= r;
/** Held in the security office, the chief's always within earshot. */
const heldBy = (w: World, a: Actor, t: Actor) => !!w.state.stadium!.detainedUntil && a.id === w.state.stadium!.pc && t.npc?.job === "chief" && Math.hypot(a.x - t.x, a.y - t.y) < 12;
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
  registerVerb("colleague", {
    check: (w, act, actor) => {
      const t = targetActor(w, act);
      if (t?.npc?.job !== "turnstile" || !near(actor, t, 2.6)) return "nobody to show";
      return inVest(w, actor) && !vestBlown(w, actor) ? null : "not in a vest";
    },
    perform: (w, act, actor) => colleague(w, actor, targetActor(w, act)!),
  });
  // The pub fruit machine: a quid a go. Three lions pays twenty, three of anything else six, two
  // cherries two. It takes more than it gives, like they do (about 80p back in the pound).
  registerVerb("fruit", {
    check: (w, _act, actor) => (!fruitNear(actor) ? "no fruit machine here" : actor.money < 1 ? "not enough money" : null),
    perform: (w, _act, actor) => {
      const r = w.state.rng.world, reel = () => { const x = rnd(r); return x < 0.12 ? "lion" : x < 0.38 ? "cherry" : x < 0.6 ? "bell" : x < 0.82 ? "pint" : "bar"; };
      const reels = [reel(), reel(), reel()];
      const same = reels[0] === reels[1] && reels[1] === reels[2], cherries = reels.filter((x) => x === "cherry").length;
      const win = same ? (reels[0] === "lion" ? 20 : 6) : cherries >= 2 ? 2 : 0;
      actor.money += win - 1;
      w.bus.emit({ type: "fruit", t: w.state.tick, by: actor.id, reels, win });
    },
  });

  // The to-do list pays: each thing done once, cash in hand (somebody's always filming, and the
  // lads' group chat is generous). Paid once per item per match.
  registerVerb("payout", {
    check: (w, act) => (act.arg && act.arg in REWARDS && !w.state.stadium!.flags[`paid_${act.arg}`] ? null : "nothing owed"),
    perform: (w, act, actor) => {
      const st = w.state.stadium!, amount = REWARDS[act.arg!];
      st.flags[`paid_${act.arg}`] = w.state.tick || 1;
      actor.money += amount;
      w.bus.emit({ type: "payout", t: w.state.tick, id: act.arg, amount });
    },
  });

  // Selling to the pawnbroker: what he'll give you, and what he won't touch.
  registerVerb("pawn", {
    check: (w, act, actor) => {
      const seller = targetActor(w, act), it = act.item ? w.state.items[act.item] : undefined;
      if (!seller || seller.npc?.shop !== "pawn") return "nobody buying";
      if (!near(actor, seller, 3.6)) return "too far";
      if (!it || ![actor.hand, ...actor.pockets, ...Object.values(actor.worn)].includes(it.id)) return "not carrying it";
      return pawnOffer(it.def) > 0 ? null : "he won't take that";
    },
    perform: (w, act, actor) => {
      const seller = targetActor(w, act)!, it = w.state.items[act.item!], price = pawnOffer(it.def);
      moveItem(w.state, it.id, { k: "gone" });
      actor.money += price;
      // Something nicked, in the pawn shop window: whoever it was nicked from will hear, and come for it.
      if (it.stolenFrom && w.state.actors[it.stolenFrom]?.npc) (w.state.stadium!.pawnSeek ??= []).push({ who: it.stolenFrom, def: it.def, at: w.state.tick + 60 * 8 });
      say(w, seller, pick(w.state.rng.world, ["Pleasure doing business.", "I'll not ask where it's from.", "Lovely. Next.", "Cash. Don't spend it all at once."]));
      w.bus.emit({ type: "pawned", t: w.state.tick, by: actor.id, def: it.def, price });
    },
  });

  registerVerb("buy", {
    check: (w, act, actor) => {
      const seller = targetActor(w, act), shop = seller?.npc?.shop;
      if (!seller || !shop) return "nobody selling";
      if (!near(actor, seller, 3.6)) return "too far";
      const price = SHOPS[shop].stock[act.arg ?? ""];
      if (price === undefined) return "not sold here";
      if (actor.money < price) return "not enough money";
      if (shop === "tout") return seller.pockets.some((id) => w.state.items[id]?.def === "ticket") ? null : "Del's sold out";
      if (act.arg === "ticket" && (w.state.match?.period ?? 1) >= 2) return "sold out";
      return null;
    },
    perform: (w, act, actor) => {
      const seller = targetActor(w, act)!, price = SHOPS[seller.npc!.shop!].stock[act.arg!];
      actor.money -= price;
      if (seller.npc!.shop === "tout") {
        // Del's tickets are real ones, out of his own pocket, and the cash goes in it.
        seller.money += price;
        const tk = seller.pockets.find((id) => w.state.items[id]?.def === "ticket")!;
        moveItem(w.state, tk, actor.hand ? { k: "pocket", a: actor.id } : { k: "hand", a: actor.id });
        w.state.items[tk].owner = actor.id;
        say(w, seller, "Pleasure. You never saw me.");
        return;
      }
      const it = give(w, actor, act.arg!);
      if (act.arg === "ticket") it.owner = actor.id;
      say(w, seller, act.arg === "ticket" ? "There you go. Enjoy the game." : "Cheers.");
    },
  });

  registerVerb("talk", {
    check: (w, act, actor) => { const t = targetActor(w, act); return t?.npc && (near(actor, t, 3.6) || heldBy(w, actor, t)) ? null : "nobody to talk to"; },
    perform: (w, act, actor) => {
      const t = targetActor(w, act)!, n = t.npc!;
      // Held in his office: a sob story. Once. He might just be sick of the sight of you.
      const st0 = w.state.stadium!;
      if (n.job === "chief" && st0.detainedUntil && actor.id === st0.pc) {
        // In a frock, he's a patronising arse about it.
        const frock = inDrag(w, actor);
        if (st0.flags.sobStory) { say(w, t, pick(w.state.rng.world, frock ? ["Oh, don't cry, love, your mascara'll run.", "Calm down, sweetheart. Deep breaths.", "Is it that time of the month, darling?"] : ["Heard it.", "Save it for the magistrate.", "No."]), 3); return; }
        st0.flags.sobStory = 1;
        if (!st0.policeCalled && chance(w.state.rng.world, 0.3)) {
          say(w, t, frock ? "...Oh, go on then, love. Off you pop. And leave the football to the men, eh?" : "...Oh, for God's sake. Go on. Get out of my sight before I change my mind.", 4);
          st0.detainedUntil = 0; st0.gates.officedoor = { until: w.state.tick + 600, for: actor.id };
          w.bus.emit({ type: "released", t: w.state.tick, who: actor.id });
        } else say(w, t, pick(w.state.rng.world, frock ? ["Aww. Did the big scary football get too much for you, love?", "Don't you worry your pretty little head. The police'll sort it.", "Does your husband know you're out, sweetheart?"] : ["Your nan's not ill. Sit down.", "Crying won't help. It's making it worse, if anything.", "That's the third dead grandad today."]), 4);
        return;
      }
      // Fans and locals: a proper exchange. Anyone with their own story (the dog's owner, say) tells it first.
      const own = n.lines?.length && n.lines !== STAFF_LINES.local && n.lines !== FAN_POOL && (n.said ?? 0) < n.lines.length;
      if ((n.job === "fan" || n.job === "local") && !n.shop && !own) { talkTo(w, actor, t); n.nextBark = w.state.tick + 300; return; }
      if (own && (n.job === "fan" || n.job === "local")) { const line = n.lines![(n.said = (n.said ?? 0) + 1) - 1]; say(w, t, line, 5); hearLead(w, line); return; }
      if (n.lines?.length) {
        // Each local has their own bit of gossip; staff go through theirs in turn.
        const k = n.job === "fan" || n.job === "local" ? [...t.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0 : (n.said = (n.said ?? 0) + 1) - 1;
        const line = n.lines[k % n.lines.length] ?? n.lines[0];
        say(w, t, line, 5);
        hearLead(w, line);
      } else say(w, t, "What?");
      if (n.job === "fan" || n.job === "local") n.nextBark = w.state.tick + 120;
    },
  });

  registerVerb("bribe", {
    check: (w, act, actor) => {
      const t = targetActor(w, act);
      if (!t || (!t.npc && !t.fb && !t.off)) return "nobody to bribe";
      if (!near(actor, t, 2.2) && !heldBy(w, actor, t)) return "too far";
      if ((act.amount ?? 0) <= 0 || actor.money < (act.amount ?? 0)) return "not enough money";
      return null;
    },
    perform: (w, act, actor) => bribe(w, actor, targetActor(w, act)!, act.amount!),
  });

  registerVerb("pickpocket", {
    check: (w, act, actor) => {
      const t = targetActor(w, act);
      if (!t?.npc || !isStaffCrowd(t)) return "nobody to rob";
      if (t.npc.mode !== "routine") return "he's watching you";
      if (!near(actor, t, 1.4)) return "too far";
      if (!t.pockets.length && !t.money) return "empty pockets";
      return null;
    },
    perform: (w, act, actor) => {
      const s = w.state, t = targetActor(w, act)!, r = s.rng.world;
      // Behind him and he is busy: much easier.
      const toMe = Math.atan2(actor.y - t.y, actor.x - t.x);
      const behind = Math.cos(toMe - t.facing) < -0.2;
      // A clean dip (the touch mini-game won) nearly always works; a fumbled one never does.
      const p = act.arg === "clean" ? 0.95 : act.arg === "botch" ? 0 : (behind ? 0.75 : 0.35) + (t.seated ? 0.1 : 0) + (t.effects.drunk > s.tick ? 0.1 : 0) - (isSecurity(t) ? 0.4 : 0);
      if (!chance(r, p)) {
        say(w, t, "Oi! Get your hands out of my pocket!");
        crime(w, actor, "pickpocketing", 1, t);
        return;
      }
      const tickets = t.pockets.filter((id) => s.items[id].def === "ticket" || s.items[id].def === "staff_pass" || s.items[id].def === "warrant_card" || s.items[id].def === "radio");
      if (tickets.length && (!t.money || chance(r, 0.6))) {
        const it = s.items[tickets[0]];
        if (canPocket(actor, it)) moveItem(s, it.id, { k: "pocket", a: actor.id }); else moveItem(s, it.id, { k: "hand", a: actor.id });
        it.stolenFrom = t.id;
        if (t.npc && it.def === "ticket") t.npc.hasTicket = false;
        w.bus.emit({ type: "stole", t: s.tick, by: actor.id, from: t.id, what: it.def === "staff_pass" ? "staff pass" : it.def === "warrant_card" ? "warrant card" : it.def === "radio" ? "radio" : "ticket" });
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
      if (v && !(v.kind === "bus" ? holdOpen(v) : cargoOpen(v))) return "the back is shut";
      return null;
    },
    perform: (w, act, actor) => {
      const it = targetItem(w, act)!;
      if (crimeSeenQuietly(w, actor, false)) crime(w, actor, "climbing into a lorry", 1, undefined, false);
      actor.hiddenIn = it.id; actor.seated = false;
    },
  });

  registerVerb("unhide", {
    check: (w, act, actor) => (w.state.stadium!.custody && actor.id === w.state.stadium!.pc ? "you're being held" : actor.hiddenIn ? null : "not hiding"),
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
    check: (w, act, actor) => (turnstileNear(actor) || climbPointNear(actor) ? null : "nothing to climb"),
    perform: (w, act, actor) => {
      const g = turnstileNear(actor);
      if (g) {
        const inside = actor.y < g.y;
        actor.y = inside ? g.y + g.h + 0.9 : g.y - 0.9;
        actor.downUntil = w.state.tick + 40;
        crime(w, actor, "jumping the turnstile", 1);
        return;
      }
      // Squeeze through the loose panel: slow and undignified.
      const c = climbPointNear(actor)!;
      actor.y = actor.y > c.y ? c.y - 1.4 : c.y + 1.4;
      actor.downUntil = w.state.tick + 90;
      w.bus.emit({ type: "climbed", t: w.state.tick, who: actor.id });
      if (crimeSeenQuietly(w, actor, false)) crime(w, actor, "climbing through the fence", 1, undefined, false);
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

  // Making rulings while dressed as the referee. Whether anyone accepts them is another matter.
  registerVerb("rule", {
    check: (w, act, actor) => {
      const m = w.state.match;
      if (!m || (m.phase !== "live" && m.phase !== "restart" && m.phase !== "goal_pause")) return "no match to referee";
      if (appearance(w.state, actor).role !== "referee") return "you don't look like a referee";
      if (!areaAt(actor.x, actor.y).pitch) return "get on the pitch first";
      const kind = act.arg;
      if (kind === "sendoff") { const t = targetActor(w, act); if (!t?.fb || t.fb.status !== "playing" || !near(actor, t, 7)) return "nobody close enough to send off"; }
      if (kind === "disallow" && !(w.state.stadium!.flags.lastOppGoal && w.state.tick - w.state.stadium!.flags.lastOppGoal < 60 * 40)) return "no goal to disallow";
      if (kind === "fulltime" && !((m.period === 2 || m.period === 4) && m.score[0] > m.score[1])) return "England aren't winning";
      return null;
    },
    perform: (w, act, actor) => impostorRuling(w, actor, act.arg!, targetActor(w, act)),
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
      // Auto-target: you swing at who you meant, whichever way you were facing.
      actor.facing = Math.atan2(t.y - actor.y, t.x - actor.x);
      // And if they're a stride or two off, you're on them in one lunge (unless there's a wall in the way).
      const gap = Math.hypot(t.x - actor.x, t.y - actor.y);
      if (gap > 1.15 && lineOfSight(actor.x, actor.y, t.x, t.y)) {
        const k = (gap - 0.95) / gap;
        actor.x += (t.x - actor.x) * k; actor.y += (t.y - actor.y) * k;
        w.bus.emit({ type: "lunged", t: w.state.tick, who: actor.id, dist: gap - 0.95 });
      }
      if (sharpInHand(w, actor) && !t.dead) return stab(w, actor, t);
      // Whatever's in your hand counts, if it's any use in a fight. Grozz reaches for whatever he's got
      // on him that'll do (a bottle, a brick), without being told; a blade only if he's got it out.
      if (!actor.npc && !(actor.hand && hasProp(w.state.items[actor.hand], "weapon"))) {
        const grab = actor.pockets.map((id) => w.state.items[id]).find((i) => autoWeapon(i));
        if (grab) { if (actor.hand) { const old = w.state.items[actor.hand]; if (canPocket(actor, old)) moveItem(w.state, old.id, { k: "pocket", a: actor.id }); else moveItem(w.state, old.id, { k: "ground", x: actor.x, y: actor.y }); } moveItem(w.state, grab.id, { k: "hand", a: actor.id }); }
      }
      const held = actor.hand ? w.state.items[actor.hand] : item;
      const weapon = !!held && hasProp(held, "weapon");
      const heavy = act.arg === "haymaker" && !weapon;
      const before = t.downUntil;
      strike.perform(w, act, actor, item);
      t.downUntil = before;
      // A counter: catch him as he winds up to hit you back, and he goes down.
      const n = t.npc, tick = w.state.tick;
      const counter = !!n?.retaliateAt && n.retaliateOn === actor.id && n.retaliateAt > tick && n.retaliateAt - tick <= 30;
      let result: "takedown" | "ko" | "hurt";
      if (counter) { n!.retaliateAt = 0; knockOut(w, t, actor, false); result = "ko"; w.bus.emit({ type: "countered", t: tick, by: actor.id, who: t.id, x: t.x, y: t.y }); }
      else result = land(w, actor, t, weapon, heavy, act.arg === "takedown");
      // Bottles, glasses and chairs go to pieces on the first hit.
      if (held && hasProp(held, "breakable") && actor.hand === held.id) {
        moveItem(w.state, held.id, { k: "gone" });
        if (held.def !== "chair" && held.def !== "pool_cue") t.effects.bloody = Math.max(t.effects.bloody ?? 0, tick + 60 * 120);
        w.bus.emit({ type: "smashed", t: tick, by: actor.id, who: t.id, what: held.def, x: t.x, y: t.y });
      }
      // The blow sends them back: a fist about a metre and a half, anything heavy further.
      const dx = t.x - actor.x, dy = t.y - actor.y, dl = Math.hypot(dx, dy) || 1, sp = (weapon ? 17 : heavy || counter ? 19 : 14) * ((actor.effects.wired ?? 0) > w.state.tick ? 1.45 : 1);
      // A choke from behind doesn't throw anyone; a knockout sends them less far than a stagger.
      if (result !== "takedown") { const k = result === "ko" ? 0.55 : 1; t.knock = { vx: (dx / dl) * sp * k, vy: (dy / dl) * sp * k, from: w.state.tick, until: w.state.tick + 26 }; }
      w.bus.emit({ type: "struck", t: w.state.tick, by: actor.id, who: t.id, weapon, heavy: heavy || counter, dx: dx / dl, dy: dy / dl });
      const official = !!t.off, player = !!t.fb && t.fb.status === "playing";
      if (player) t.fb!.stunUntil = w.state.tick + (weapon ? 900 : 160);
      if (player && result !== "hurt") removePlayer(w, t.id, "injured");
      if (official) t.downUntil = w.state.tick + (weapon ? 1800 : 360);
      if (weapon && player) removePlayer(w, t.id, "injured");
      const sev = weapon ? 3 : official || player ? 3 : 2;
      // A man with his hands on Grozz-in-a-frock had it coming (short of a knife in him).
      if (actor.id === w.state.stadium!.pc && isCreep(w, t) && !(held && hasProp(held, "sharp"))) selfDefence(w, actor, t);
      else crime(w, actor, weapon ? "an attack with a weapon" : official ? "assaulting the referee" : player ? "assaulting a player" : "assault", sev, t);
      if (t.npc && result === "hurt") {
        const OUCH = weapon ? ["Aaargh!", "My head! My fucking head!", "Help! Somebody help!"]
          : ["My nose! My fucking nose!", "Ow! You mad bastard!", "What the fuck was that for?", "Jesus Christ!", "Ugh... my teeth...", "You're dead, mate. Dead!"];
        say(w, t, pick(w.state.rng.world, OUCH));
      }
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

export function climbPointNear(a: Actor) {
  return VENUE.climbPoints.find((c) => Math.abs(a.x - c.x) < 1.8 && Math.abs(a.y - c.y) < 2);
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
  // A grass on his way to a steward: cheap to shut up.
  if (snitchOf(w, t.id)) {
    const res = bribeSnitch(w, t, amount);
    if (res.ok) accept(res.line); else say(w, t, res.line, 3);
    return;
  }
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
    if (e.type === "struck" || e.type === "killed") {
      // A fight draws a crowd: fans nearby form a ring, shout, film it; the timid back off.
      const v = s.actors[e.who], r = s.rng.world;
      if (!v) return;
      let n = 0;
      for (const id in s.actors) {
        const a = s.actors[id], np = a.npc;
        if (!np || id === e.who || id === e.by || a.seated || a.heldBy || a.downUntil > s.tick || np.mode !== "routine") continue;
        if (np.job !== "fan" && np.job !== "local") continue;
        const d = Math.hypot(a.x - v.x, a.y - v.y);
        if (d > 10 || n >= 8) continue;
        n++;
        const ang = Math.atan2(a.y - v.y, a.x - v.x);
        if (e.type === "killed" || chance(r, 0.25)) {
          // Back off, sharpish.
          np.plan = [{ k: "say", text: pick(r, ["Fucking hell!", "Jesus! Leave it!", "I'm not getting involved."]) }, { k: "go", x: v.x + Math.cos(ang) * 14, y: v.y + Math.sin(ang) * 14, run: true }];
          np.gawk = undefined;
        } else {
          const rad = rndRange(r, 2.6, 3.8), filming = chance(r, 0.45);
          np.plan = [{ k: "go", x: v.x + Math.cos(ang) * rad, y: v.y + Math.sin(ang) * rad },
            { k: "say", text: pick(r, filming ? ["This is going on TikTok.", "Get it, get it!", "Are you filming this?"] : ["FIGHT! FIGHT!", "Go on, son!", "Leave it, he's not worth it!", "Ooooh!", "He's sparko!"]) },
            { k: "wait", s: rndRange(r, 6, 14) }];
          np.gawk = { until: s.tick + 60 * 16, x: v.x, y: v.y, filming };
        }
      }
    }
    if ((e.type === "item_landed" || e.type === "item_hit") && e.itemDef === "flare") {
      st.smoke.push({ x: e.x, y: e.y, r: 7, until: s.tick + 60 * 25 });
      moveItem(s, e.item, { k: "gone" });
      w.bus.emit({ type: "smoke", t: s.tick, x: e.x, y: e.y, onPitch: areaAt(e.x, e.y).pitch === true });
      const by = s.actors[e.by];
      if (by) crime(w, by, "throwing a smoke flare", 2);
      if (areaAt(e.x, e.y).pitch && s.match && (s.match.phase === "live" || s.match.phase === "restart")) { haltPlay(w, "smoke"); st.flags.smokeHalt = 1; }
    }
    if (e.type === "item_hit") {
      const t = s.actors[e.target], by = s.actors[e.by], it = s.items[e.item];
      if (!t || !by) return;
      const weapon = hasProp(it, "weapon");
      if (t.off && s.match && t.id === s.match.officials.referee) distractReferee(w, weapon ? 30 : 9);
      if (t.off && weapon) t.downUntil = s.tick + 1200;
      if (t.fb) t.fb.stunUntil = s.tick + (weapon ? 600 : 50);
      if (t.npc) { say(w, t, weapon ? "Aargh!" : "Oi!"); if (weapon) t.downUntil = s.tick + 900; }
      const what = hasProp(it, "sharp") ? "throwing a knife" : `throwing a ${defOf(it).name.toLowerCase()}`;
      crime(w, by, what, weapon ? 3 : t.off || t.fb ? 2 : 1, t.npc ? t : undefined);
    }
    if (e.type === "action" && e.action.verb === "show") turnstileCheck(w, e.action);
    if (e.type === "fb_goal" && e.team === 1) st.flags.lastOppGoal = s.tick;
    if (e.type === "fb_goal" && e.by === st.pc) { st.flags.pcGoalAt = s.tick; st.flags.pcGoals = (st.flags.pcGoals ?? 0) + 1; if (e.og) st.flags.pcOwnGoals = (st.flags.pcOwnGoals ?? 0) + 1; }
    // Keep a tally for the evening news.
    const f = st.flags, pc = st.pc;
    const bump = (k: string) => { f[k] = (f[k] ?? 0) + 1; };
    if (e.type === "ejected" && e.who === pc) bump("ejections");
    if (e.type === "detained" && e.who === pc) bump("detentions");
    if (e.type === "tipoff_arrest" && s.actors[e.who]?.fb) { bump("tipArrests"); if (e.planted) bump("plantedArrests"); }
    if (e.type === "false_arrest") { bump("falseArrests"); if (s.actors[e.who]?.fb) st.flags.fakeCopFootballer = 1; }
    if (e.type === "pitch_invasion") bump("pitchInvasions");
    if (e.type === "unmasked") { bump("unmasked"); if (!e.football) st.flags.unmaskedDisguise = 1; }
    if (e.type === "incident" && e.what === "stowaway") bump("stowaway");
    if (e.type === "run_over" && e.who === pc) bump("runOver");
    if (e.type === "accident") bump("accident");
    if (e.type === "smoke") bump("flares");
    if (e.type === "dog_bite") { bump("dogBites"); if (e.footballer) bump("dogBitPlayers"); if (e.referee) bump("dogBitRef"); }
    if (e.type === "item_hit" && s.match && e.target === s.match.officials.referee) bump("refHit");
    if (e.type === "dose_kicks_in" && s.actors[e.id]?.off && e.effect === "laxative") bump("refLax");
    if (e.type === "action" && e.action.verb === "consume" && e.action.actor === st.pc) {
      const pc = s.actors[st.pc];
      if (pc.effects.laxative > s.tick && !st.flags.pcLax) st.flags.pcLax = s.tick + 60 * 45;
    }
  });
}

/** In a hi-vis vest, the turnstile staff take you for one of theirs. */
function colleague(w: World, by: Actor, t: Actor): void {
  const s = w.state, st = s.stadium!, ap = appearance(s, by);
  const g = turnstileNear(t) ?? turnstileNear(by);
  if (!g?.gate) return;
  if (ap.faceHidden || ap.alarming) return void say(w, t, "Whoa. Who are you with, mate?");
  if (st.banned.includes(ap.faceId) && ap.faceCover < 0.5) return void say(w, t, "Nice try. You're on the list, vest or no vest.");
  st.gates[g.gate] = { until: s.tick + 60 * 4, for: by.id };
  say(w, t, pick(s.rng.world, ["Alright, mate. Busy one today.", "Go on through, pal. They've got you on the north side?", "Morning. Radio's playing up again."]));
}

function turnstileCheck(w: World, act: Action): void {
  const s = w.state, st = s.stadium!, by = s.actors[act.actor], t = targetActor(w, act), it = act.item ? s.items[act.item] : undefined;
  if (!t?.npc || t.npc.job !== "turnstile" || !it) return;
  const n = t.npc, ap = appearance(s, by), r = s.rng.world;
  // On the alert: if it's you he's after, no. Anyone else (a new face, a new frock) still gets
  // served, though he looks harder: matching the description going round gets you stopped.
  if (n.target === by.id && ["approach", "chase", "escort"].includes(n.mode)) return void say(w, t, "Don't you move.");
  if (n.mode !== "routine" && n.mode !== "watch" && n.target && n.target !== by.id) return void say(w, t, "Hang on, mate. We've got a situation. Wait there.");
  const g = turnstileNear(t) ?? turnstileNear(by);
  if (!g?.gate) return;
  if (it.def === "warrant_card") {
    // Flash it, don't let them read it.
    if (ap.faceHidden) return void say(w, t, "Even the Old Bill take their masks off, mate.");
    st.gates[g.gate] = { until: s.tick + 60 * 4, for: by.id };
    return void say(w, t, "Oh. Sorry, officer. Go on through.");
  }
  if (it.def === "press_pass") {
    // The press: no ticket, no pat-down, no questions. Unless you're in a mask.
    if (ap.faceHidden) return void say(w, t, "Press or not, mask off.");
    st.gates[g.gate] = { until: s.tick + 60 * 4, for: by.id };
    return void say(w, t, "Press? Go on through, mate.");
  }
  if (it.def !== "ticket") return void say(w, t, "That's not a ticket, is it?");
  if (st.dog?.state === "led" && !st.flags.serviceDog && !VENUE.features.penisDetector) return void say(w, t, "No dogs. Not even that one. Especially not that one.");
  if (it.void) { n.sus[by.id] = Math.max(n.sus[by.id] ?? 0, 0.6); w.bus.emit({ type: "ticket_scanned", t: s.tick, who: by.id, gate: g.gate, ok: false }); return void say(w, t, "This ticket's been cancelled. Hop it."); }
  // Scanned already, by you, and you never went through: he just lets you through again.
  if (it.used && it.usedBy === by.id && !st.admitted) {
    st.gates[g.gate] = { until: s.tick + 60 * 30, for: by.id };
    w.bus.emit({ type: "ticket_scanned", t: s.tick, who: by.id, gate: g.gate, ok: true, x: g.x + g.w / 2, y: g.y + g.h / 2 });
    return void say(w, t, "You've been scanned, mate. Go on, through you go.");
  }
  if (it.used) { w.bus.emit({ type: "ticket_scanned", t: s.tick, who: by.id, gate: g.gate, ok: false }); return void say(w, t, "This one's already been scanned."); }
  if (ap.faceHidden) return void say(w, t, ap.sinister ? "You're not coming in dressed like that." : "Mask off, please.");
  // The cameras: a barred face is flagged unless at least half of it is covered.
  if (VENUE.features.faceCameras && st.banned.includes(ap.faceId) && ap.faceCover < 0.5) {
    n.sus[by.id] = Math.max(n.sus[by.id] ?? 0, 0.8);
    w.bus.emit({ type: "camera_flag", t: s.tick, who: by.id });
    return void say(w, t, "Camera's flagged you, sunshine. You're on the list.", 4);
  }
  if (st.banned.includes(ap.faceId) && chance(r, 1 - ap.faceCover)) { n.sus[by.id] = 0.7; return void say(w, t, "Hang on. You're the one we threw out. Go on, hop it."); }
  // On the lookout for someone matching the description going round (an outfit, a face up close).
  if (st.wanted.some((wd) => wd.until > s.tick) && wantedMatch(w, t, by) >= 0.5) { n.sus[by.id] = Math.max(n.sus[by.id] ?? 0, 0.7); return void say(w, t, "Hold on. You look like the one on the radio. Step aside."); }
  if (by.hand && s.items[by.hand].def === "pint") { moveItem(s, by.hand, { k: "gone" }); say(w, t, "No drinks inside. I'll have that."); }
  if (ap.alarming) { crime(w, by, "carrying a weapon at the gate", 2); return; }
  // A pat-down misses some of what is in pockets; a metal detector misses nothing metal.
  const hidden = by.pockets.map((id) => s.items[id]).find((i) => hasProp(i, "weapon") || (hasProp(i, "smoke")));
  const detected = hidden && (VENUE.features.metalDetectors && hasProp(hidden, "metal") ? true : chance(r, VENUE.features.patDown));
  if (VENUE.features.metalDetectors && by.pockets.some((id) => hasProp(s.items[id], "metal") && !hasProp(s.items[id], "weapon"))) say(w, t, "Beep. Empty your pockets. ...Fine, go on.");
  if (hidden && detected) {
    moveItem(s, hidden.id, { k: "in", c: st.locker });
    n.sus[by.id] = 1;
    say(w, t, "What's this, then? You're not coming in with that.", 4);
    crime(w, by, "carrying a weapon at the gate", 1);
    return;
  }
  it.used = true; it.usedBy = by.id;
  if (startDetector(w, by, g.gate, t)) return;
  // Open until he's through (the view walks him through it).
  st.gates[g.gate] = { until: s.tick + 60 * 30, for: by.id };
  w.bus.emit({ type: "ticket_scanned", t: s.tick, who: by.id, gate: g.gate, ok: true, x: g.x + g.w / 2, y: g.y + g.h / 2 });
  say(w, t, "Enjoy the game.");
}

// ---------- Ticking rules ----------
/** Things that happen over time: the pitch, the half-time drinks, the call of nature. */
export function stepRules(w: World): void {
  const s = w.state, st = s.stadium!, m = s.match!, tick = s.tick, r = s.rng.world;
  const pc = s.actors[st.pc];
  if (!pc) return;

  const ref = s.actors[m.officials.referee];
  if (st.flags.impostorHaltUntil && tick >= st.flags.impostorHaltUntil) { st.flags.impostorHaltUntil = 0; if (m.halted === "impostor") resumePlay(w); }

  // A second referee on the pitch does not go unnoticed for long, if the first one is about.
  const lookalike = appearance(s, pc).role === "referee" && areaAt(pc.x, pc.y).pitch;
  if (lookalike && ref.downUntil <= tick && !ref.off!.incapacitated && ref.off!.distractedUntil <= tick && Math.hypot(ref.x - pc.x, ref.y - pc.y) < 18) {
    st.flags.refStare = (st.flags.refStare ?? 0) + 1;
    if (st.flags.refStare === 60 * 4) {
      st.flags.twoRefs = (st.flags.twoRefs ?? 0) + 1;
      w.bus.emit({ type: "two_refs", t: tick, by: pc.id });
      for (const id in s.actors) { const g = s.actors[id]; if (g.npc?.job === "pitchsteward") alert(w, g, pc, 2, 2); }
    }
  } else if (!lookalike) st.flags.refStare = 0;

  st.smoke = st.smoke.filter((c) => c.until > tick);
  if (st.flags.smokeHalt && !st.smoke.some((c) => areaAt(c.x, c.y).pitch)) { st.flags.smokeHalt = 0; if (m.halted === "smoke") resumePlay(w); }

  // Somebody on the pitch who should not be: the referee stops play if he notices.
  const area = areaAt(pc.x, pc.y);
  const role = appearance(s, pc).role;
  const intruding = area.id === "pitch" && role !== "referee" && role !== "footballer" && !pc.hiddenIn;
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
    const wanted = (dg.npc!.sus[pc.id] ?? 0) > 0.4 || (st.banned.includes(ap.faceId) && ap.faceCover < 0.5) || ap.sinister || ap.grisly;
    const pass = [pc.hand, ...pc.pockets].some((id) => id && (s.items[id].def === "staff_pass" || (s.items[id].def === "hands" && staffHands(w, s.items[id]))));
    if (VENUE.features.staffPass && !pass && ["steward", "police", "catering", "cleaner"].includes(ap.role) && !wanted) {
      if (!dg.npc!.bubble) say(w, dg, "Pass, please. ...No pass, no entry. Rules.");
    } else if (["steward", "police", "catering", "cleaner"].includes(ap.role) && !wanted) {
      if (st.doorPass !== pc.id) { st.doorPass = pc.id; st.gates.staffdoor = { until: tick + 200, for: pc.id }; say(w, dg, ap.role === "catering" ? "Morning, chef." : ap.role === "cleaner" ? "In you go, love." : "All right, mate."); }
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
      if ((n.job === "fan" || n.job === "local") && !n.shop) banter(w, a);
      else say(w, a, fresh(w, n.lines, a), 5);
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


// ---------- Impersonating the referee ----------
function impostorRuling(w: World, by: Actor, kind: string, target?: Actor): void {
  const s = w.state, st = s.stadium!, m = s.match!, r = s.rng.world, tick = s.tick;
  const ref = s.actors[m.officials.referee];
  const refAround = ref.downUntil <= tick && !ref.off!.incapacitated;
  const refWatching = refAround && ref.off!.distractedUntil <= tick && Math.hypot(ref.x - by.x, ref.y - by.y) < 40;
  const whistle = [by.hand, ...by.pockets].some((id) => id && s.items[id].def === "whistle");
  let p = refWatching ? 0.25 : refAround ? 0.55 : 0.85;
  if (whistle) p = Math.min(0.95, p + 0.2);
  if (kind === "fulltime") p *= 0.6;
  w.bus.emit({ type: "impostor_whistle", t: tick, by: by.id, kind });
  if (!chance(r, p)) {
    // The real referee objects; there are now two referees, and neither accepts the other.
    st.flags.twoRefs = (st.flags.twoRefs ?? 0) + 1;
    w.bus.emit({ type: "two_refs", t: tick, by: by.id });
    if (refAround) {
      for (const id in s.actors) {
        const g = s.actors[id];
        if (g.npc?.job === "pitchsteward" || (g.npc?.job === "police" && areaAt(g.x, g.y).pitch)) alert(w, g, by, 2, 2);
      }
    }
    return;
  }
  st.flags.impostorRulings = (st.flags.impostorRulings ?? 0) + 1;
  // Every decision draws more looks. By the third, someone works it out.
  for (const id in s.actors) {
    const g = s.actors[id];
    if (g.npc?.job !== "pitchsteward") continue;
    if (st.flags.impostorRulings >= 3) alert(w, g, by, 2, 2);
    else g.npc.sus[by.id] = Math.min(2, (g.npc.sus[by.id] ?? 0) + 0.35);
  }
  switch (kind) {
    case "penalty": {
      const dir = m.dir0; // England attack this way
      beginRestart(w, m, "penalty", 0, dir * 30, 0, 5);
      break;
    }
    case "sendoff":
      if (target?.fb) { m.stats[target.fb.team].reds++; sendOff(w, m, target, "sent_off"); }
      break;
    case "stop":
      haltPlay(w, "impostor");
      st.flags.impostorHaltUntil = tick + 60 * 6;
      break;
    case "disallow":
      if (m.score[1] > 0) m.score[1]--;
      st.flags.lastOppGoal = 0;
      if (m.phase === "goal_pause") m.next = { type: "goal_kick", team: 1, x: -m.dir0 * 36, y: 0 };
      break;
    case "fulltime":
      endPeriod(w, m);
      break;
  }
  w.bus.emit({ type: "impostor_ruling", t: tick, by: by.id, kind, target: target?.id });
}
