// Runs a match day with nobody playing, to check the world carries on by itself.
import { createGame, stepGame } from "../src/stadium/game";
import { areaAt } from "../src/stadium/layout";

const g = createGame(process.argv[2] ?? "sim", (process.argv[3] as any) ?? "qf");
const w = g.w, s = () => w.state;
const counts: Record<string, number> = {};
w.bus.on((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; if (["fb_goal", "fb_period_start", "ending", "say"].includes(e.type) && e.type !== "say") console.log(`${(e.t / 60).toFixed(0)}s`, e.type, e.kind ?? "", e.score ?? ""); });
const t0 = Date.now();
let lastLog = 0;
while (!s().stadium!.ending && s().tick < 60 * 60 * 40) {
  stepGame(g);
  if (s().tick - lastLog >= 60 * 60) {
    lastLog = s().tick;
    const st = s(), v = st.stadium!.vehicles.lorry, m = st.match!;
    const fans = Object.values(st.actors).filter((a) => a.npc?.job === "fan");
    const inside = fans.filter((a) => a.y < 44 && a.y > -40).length; const offp = m.teams.flatMap((t) => t.squad).map((id) => st.actors[id]).filter((a) => a.fb!.status === "playing" && !areaAt(a.x, a.y).pitch).map((a) => `${a.id}@${a.x.toFixed(0)},${a.y.toFixed(0)}`).join(" ");
    const seated = fans.filter((a) => a.seated).length;
    const players = m.teams[0].squad.map((id) => st.actors[id]).filter((a) => a.fb!.status === "playing");
    const onPitch = players.filter((a) => areaAt(a.x, a.y).pitch).length;
    console.log(`t=${(st.tick / 60).toFixed(0)}s phase=${m.phase} p${m.period} clock=${m.clock.toFixed(0)} score=${m.score} | fans ${fans.length} inside ${inside} seated ${seated} | ENG on pitch ${onPitch}/11 | lorry ${v.state} (${v.x.toFixed(0)},${v.y.toFixed(0)}) cycle ${v.cycle} ${offp}`);
  }
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${s().tick} ticks; ending:`, s().stadium!.ending);
console.log(Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join(", "));
