// The bookmaker. Fixed odds from a simple view of the match, settled only on what the
// officials recognise. The bookie knows the score; he does not know who you have bribed.
import { canPocket, moveItem, spawnItem } from "../core/items";
import type { Actor, Item } from "../core/types";
import { registerVerb } from "../core/verbs";
import type { World } from "../core/world";
import { playing } from "../football/util";
import { areaAt } from "./layout";
import { say } from "./npc";

export const MAX_STAKE = 100, MAX_OPEN = 4;

export type Market = "winner" | "next" | "pen" | "red";
export interface Price { market: Market; pick: string; label: string; odds: number }

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const roundOdds = (p: number) => Math.min(26, Math.max(1.05, Math.round((0.9 / Math.max(0.02, p)) * 20) / 20));

/** Current prices, or null if the book is closed. */
export function prices(w: World): Price[] | null {
  const s = w.state, m = s.match!, st = s.stadium!;
  if (m.phase === "finished" || m.phase === "shootout" || st.ending) return null;
  if (st.flags.lastGoalAt && s.tick - st.flags.lastGoalAt < 60 * 15) return null; // suspended after a goal
  const opp = m.teams[1].name;
  const base = -0.15; // the opposition are slightly the better side on paper
  const f = Math.min(1, ((m.period - 1) * m.cfg.halfSeconds + m.clock) / (2 * m.cfg.halfSeconds));
  const d = m.score[0] - m.score[1];
  const men = playing(s, m, 0).length - playing(s, m, 1).length;
  const pEng = logistic(base + d * (1.1 + 3.5 * f) + men * 0.35);
  const pNone = m.period >= 3 ? 0.55 : Math.min(0.75, 0.08 + 0.55 * f * f);
  const share = Math.min(0.8, Math.max(0.2, 0.47 + men * 0.06));
  // Penalties and red cards get less likely as time runs out. The book does not offer
  // England to go out: a patriot is not allowed to back that.
  const left = Math.max(0.05, 1 - f);
  const pPen = 0.3 * left, pRed = 0.22 * left;
  const book: Price[] = [
    { market: "winner", pick: "ENG", label: "England to go through", odds: roundOdds(pEng) },
    { market: "next", pick: "ENG", label: "England to score next", odds: roundOdds((1 - pNone) * share) },
    { market: "next", pick: "OPP", label: `${opp} to score next`, odds: roundOdds((1 - pNone) * (1 - share)) },
    { market: "next", pick: "NONE", label: "No more goals", odds: roundOdds(pNone) },
  ];
  if (!st.flags.penGiven) book.push({ market: "pen", pick: "YES", label: "A penalty to be given", odds: roundOdds(pPen) });
  if (!st.flags.redGiven) book.push({ market: "red", pick: "YES", label: "A player to be sent off", odds: roundOdds(pRed) });
  void opp;
  return book;
}

/** Can this person place a bet where they are? At a counter, or on the phone while watching. */
export function canBetHere(w: World, a: Actor): "counter" | "phone" | null {
  const s = w.state;
  for (const id in s.actors) {
    const b = s.actors[id];
    if (b.npc?.shop === "bookies" && Math.hypot(b.x - a.x, b.y - a.y) < 3.8) return "counter";
  }
  if (a.seated || areaAt(a.x, a.y).id === "pub") return "phone";
  return null;
}

export const openSlips = (w: World, a: Actor): Item[] =>
  [a.hand, ...a.pockets].filter((id): id is string => !!id).map((id) => w.state.items[id]).filter((it) => it.bet && !it.bet.result);

export function installBetting(): void {
  registerVerb("bet", {
    check: (w, act, actor) => {
      if (!canBetHere(w, actor)) return "nowhere to bet";
      const book = prices(w);
      if (!book) return "betting is suspended";
      const pr = book.find((p) => `${p.market}:${p.pick}` === act.arg);
      if (!pr) return "no such bet";
      const stake = act.amount ?? 0;
      if (stake <= 0 || stake > MAX_STAKE) return `stakes up to £${MAX_STAKE}`;
      if (actor.money < stake) return "not enough money";
      if (openSlips(w, actor).length >= MAX_OPEN) return "too many bets open";
      if (actor.pockets.length >= 3 && actor.hand) return "no room for the slip";
      return null;
    },
    perform: (w, act, actor) => {
      const pr = prices(w)!.find((p) => `${p.market}:${p.pick}` === act.arg)!;
      actor.money -= act.amount!;
      const slip = spawnItem(w.state, "betslip", { k: "ground", x: actor.x, y: actor.y });
      slip.bet = { market: pr.market, pick: pr.pick, stake: act.amount!, odds: pr.odds, at: w.state.tick };
      slip.owner = actor.id;
      if (canPocket(actor, slip)) moveItem(w.state, slip.id, { k: "pocket", a: actor.id });
      else moveItem(w.state, slip.id, { k: "hand", a: actor.id });
      w.bus.emit({ type: "bet_placed", t: w.state.tick, by: actor.id, label: pr.label, stake: act.amount, odds: pr.odds });
      const bookie = Object.values(w.state.actors).find((b) => b.npc?.shop === "bookies" && Math.hypot(b.x - actor.x, b.y - actor.y) < 4);
      if (bookie) say(w, bookie, act.amount! >= 100 ? "Big spender. Good luck." : "Good luck.");
    },
  });
}

/** Settle bets on what the officials have recognised. Winnings go to whoever holds the slip. */
export function settle(w: World, market: Market, winner: string): void {
  const s = w.state;
  for (const id in s.items) {
    const it = s.items[id], b = it.bet;
    if (!b || b.result || b.market !== market) continue;
    b.result = b.pick === winner ? "won" : "lost";
    const holder = it.loc.k === "hand" || it.loc.k === "pocket" ? s.actors[it.loc.a] : undefined;
    const payout = b.result === "won" ? Math.round(b.stake * b.odds) : 0;
    if (holder && payout) holder.money += payout;
    if (holder) w.bus.emit({ type: "bet_settled", t: s.tick, who: holder.id, won: b.result === "won", payout, stake: b.stake, pick: b.pick, market });
    if (holder?.id === s.stadium!.pc && payout) s.stadium!.flags.betWinnings = (s.stadium!.flags.betWinnings ?? 0) + payout - b.stake;
    if (holder?.id === s.stadium!.pc && !payout) s.stadium!.flags.betLosses = (s.stadium!.flags.betLosses ?? 0) + b.stake;
  }
}

export function installSettlement(w: World): void {
  w.bus.on((e) => {
    const s = w.state, st = s.stadium!;
    if (e.type === "fb_goal") { st.flags.lastGoalAt = s.tick; settle(w, "next", e.team === 0 ? "ENG" : "OPP"); }
    if (e.type === "fb_match_end") { settle(w, "next", "NONE"); settle(w, "winner", e.winner === 0 ? "ENG" : "OPP"); settle(w, "pen", "NO"); settle(w, "red", "NO"); }
    const pen = (e.type === "fb_foul" && e.penalty) || (e.type === "impostor_ruling" && e.kind === "penalty");
    const red = (e.type === "fb_foul" && (e.card === "red" || e.card === "second_yellow")) || (e.type === "impostor_ruling" && e.kind === "sendoff");
    if (pen) { st.flags.penGiven = 1; settle(w, "pen", "YES"); }
    if (red) { st.flags.redGiven = 1; settle(w, "red", "YES"); }
  });
}
