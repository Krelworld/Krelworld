// Traffic on the ring road: cars driving on the left, both ways, stopping for anyone in the way
// (and honking if you stand there). They never hit anybody; they're there so the street is alive.
import { pick, rndRange } from "../core/rng";
import type { World } from "../core/world";

export interface Car { id: string; kind: string; x: number; y: number; dir: 1 | -1; speed: number; stoppedFor: number }

/** Lanes: eastbound keeps to the north side of the road, westbound the south. */
const LANES: { y: number; dir: 1 | -1 }[] = [{ y: 86.2, dir: 1 }, { y: 89.8, dir: -1 }];
const KINDS = ["taxi", "van", "hatch", "redcar", "hatch", "taxi", "policecar"];
const CRUISE = 8.5, X0 = -96, X1 = 96;

export function stepTraffic(w: World): void {
  const s = w.state, st = s.stadium!, r = s.rng.world, dt = 1 / 60;
  st.traffic ??= [];
  const cars = st.traffic;
  // New cars come in at the ends every so often.
  for (const [i, lane] of LANES.entries()) {
    const key = `nextCar${i}`;
    if ((st.flags[key] ?? 0) > s.tick) continue;
    st.flags[key] = s.tick + Math.round(rndRange(r, 4, 13) * 60);
    const x = lane.dir === 1 ? X0 : X1;
    if (cars.some((c) => c.dir === lane.dir && Math.abs(c.x - x) < 9)) continue;
    cars.push({ id: `car${s.tick}_${i}`, kind: pick(r, KINDS), x, y: lane.y, dir: lane.dir, speed: CRUISE, stoppedFor: 0 });
  }
  for (const c of cars) {
    // Anything in front: a person, another car, the lorry or the coach.
    let gap = 99;
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a.hiddenIn || a.seated || Math.abs(a.y - c.y) > 1.6) continue;
      const ahead = (a.x - c.x) * c.dir;
      if (ahead > 0 && ahead < gap) gap = ahead;
    }
    for (const o of cars) { if (o !== c && o.dir === c.dir) { const ahead = (o.x - c.x) * c.dir; if (ahead > 0 && ahead < gap) gap = ahead - 2.5; } }
    for (const v of Object.values(st.vehicles)) { if (Math.abs(v.y - c.y) < 3) { const ahead = (v.x - c.x) * c.dir; if (ahead > 0 && ahead < gap) gap = ahead - 5; } }
    const mc = st.myCar;
    if (mc && Math.abs(mc.y - c.y) < 2.4) { const ahead = (mc.x - c.x) * c.dir; if (ahead > 0 && ahead < gap) gap = ahead - 3; }
    const want = gap < 4 ? 0 : gap < 12 ? CRUISE * (gap - 4) / 8 : CRUISE;
    c.speed += Math.max(-14 * dt, Math.min(5 * dt, want - c.speed));
    c.x += c.speed * c.dir * dt;
    // Stopped for somebody standing in the road: a toot, then a long lean on the horn.
    if (c.speed < 0.3 && gap < 5) {
      c.stoppedFor++;
      if (c.stoppedFor === 90 || c.stoppedFor === 300) w.bus.emit({ type: "car_horn", t: s.tick, x: c.x, y: c.y, long: c.stoppedFor > 100 });
    } else c.stoppedFor = 0;
  }
  st.traffic = cars.filter((c) => c.x > X0 - 2 && c.x < X1 + 2);
}
