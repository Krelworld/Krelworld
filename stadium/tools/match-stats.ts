// Runs many full matches with no rendering and prints what happened.
// Usage: npm run stats -- [matches] [home] [away] [--sabotage=star|keeper|ref]
import { createWorld, stepWorld } from "../src/core/world";
import { bribePlayer, biasReferee, removePlayer } from "../src/football/api";
import { createMatch, TEAMS } from "../src/football/setup";
import { playing } from "../src/football/util";

const args = process.argv.slice(2);
const N = +(args[0] ?? 40), home = args[1] ?? "ENG", away = args[2] ?? "POR";
const sabotage = args.find((a) => a.startsWith("--sabotage="))?.split("=")[1];
const knockout = !args.includes("--league");

const tot = { g0: 0, g1: 0, w0: 0, w1: 0, d: 0, et: 0, pens: 0, ticks: 0, stuck: 0 };
const st = [0, 1].map(() => ({ shots: 0, onTarget: 0, fouls: 0, corners: 0, offsides: 0, passes: 0, possession: 0, yellows: 0, reds: 0, saves: 0 }));
const ev: Record<string, number> = {};
const scores: Record<string, number> = {};
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const w = createWorld(`stats-${i}`);
  const m = createMatch(w, TEAMS[home], TEAMS[away], { halfTimeSeconds: 2, knockout });
  w.bus.on((e) => { ev[e.type] = (ev[e.type] ?? 0) + 1; });
  if (sabotage === "star") { const star = playing(w.state, m, 1).find((a) => a.fb!.star); if (star) removePlayer(w, star.id, "arrested"); }
  if (sabotage === "keeper") { const gk = playing(w.state, m, 1).find((a) => a.fb!.role === "GK"); if (gk) bribePlayer(w, gk.id); }
  if (sabotage === "ref") biasReferee(w, 0, 0.8);
  let lastBall = "", still = 0, lastPhaseChange = 0, lastPhase = "";
  let maxPeriod = 1;
  while (m.phase !== "finished" && w.state.tick < 60 * 60 * 40) {
    stepWorld(w);
    maxPeriod = Math.max(maxPeriod, m.period);
    if (m.phase !== lastPhase) { lastPhase = m.phase; lastPhaseChange = w.state.tick; }
    const key = `${m.ball.x.toFixed(1)},${m.ball.y.toFixed(1)}`;
    if (m.phase === "live" && key === lastBall) { if (++still === 60 * 20) { tot.stuck++; console.log(`  stuck ball: match ${i} tick ${w.state.tick} at ${key} owner ${m.ball.owner} held ${m.ball.held}`); } }
    else { still = 0; lastBall = key; }
    if (m.phase === "restart" && w.state.tick - lastPhaseChange === 60 * 15) { tot.stuck++; console.log(`  stuck restart: match ${i} ${m.restart?.type} taker ${m.restart?.taker}`); }
  }
  if (m.phase !== "finished") { tot.stuck++; console.log(`  match ${i} never finished (phase ${m.phase}, period ${m.period})`); }
  tot.g0 += m.score[0]; tot.g1 += m.score[1]; tot.ticks += w.state.tick;
  if (m.winner === 0) tot.w0++; else if (m.winner === 1) tot.w1++; else tot.d++;
  if (maxPeriod >= 3) tot.et++;
  if (m.shootout) tot.pens++;
  const k = `${m.score[0]}-${m.score[1]}`; scores[k] = (scores[k] ?? 0) + 1;
  for (const t of [0, 1]) for (const f in st[t]) (st[t] as any)[f] += (m.stats[t] as any)[f];
}

const per = (v: number) => (v / N).toFixed(2);
console.log(`${N} matches ${home} v ${away}${sabotage ? ` (sabotage: ${sabotage})` : ""} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`goals/match: ${per(tot.g0 + tot.g1)}  (${home} ${per(tot.g0)}, ${away} ${per(tot.g1)})`);
console.log(`results: ${home} ${tot.w0}, ${away} ${tot.w1}, drawn ${tot.d} | extra time ${tot.et}, penalties ${tot.pens} | stuck ${tot.stuck}`);
console.log(`avg real length: ${(tot.ticks / N / 3600).toFixed(1)} min`);
const poss = st[0].possession + st[1].possession;
for (const t of [0, 1]) {
  const x = st[t];
  console.log(`${t === 0 ? home : away}: shots ${per(x.shots)} on target ${per(x.onTarget)} saves ${per(x.saves)} fouls ${per(x.fouls)} yellows ${per(x.yellows)} reds ${per(x.reds)} corners ${per(x.corners)} offsides ${per(x.offsides)} passes ${per(x.passes)} poss ${((x.possession / poss) * 100).toFixed(0)}%`);
}
console.log("scores:", Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}×${v}`).join(" "));
console.log("events/match:", Object.entries(ev).sort().map(([k, v]) => `${k.replace("fb_", "")} ${per(v)}`).join(", "));
