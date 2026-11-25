// The beer lorry: pub yard, round the ring road, up the service road, through the
// service gate into the loading bay, and back again. Every match day, on a loop.
import { moveItem } from "../core/items";
import { chance } from "../core/rng";
import { DT, type Actor } from "../core/types";
import type { World } from "../core/world";
import { SPOTS } from "./layout";
import { say } from "./npc";
import { crime, isSecurity } from "./security";
import type { Vehicle } from "./state";

/** There: pub yard to loading bay. The way back is the same in reverse. */
export const LORRY_ROUTE = [-28, 74, -28, 88, 67, 88, 67, -43, 56, -43, 50, -44];
export const LORRY_LEN = 7, LORRY_WID = 2.6;

const reverse = (r: number[]) => { const o: number[] = []; for (let i = r.length - 2; i >= 0; i -= 2) o.push(r[i], r[i + 1]); return o; };

export function stepVehicle(w: World, v: Vehicle): void {
  const s = w.state, st = s.stadium!, tick = s.tick, r = s.rng.world;
  const driver = s.actors[v.driver];
  const worker = Object.values(s.actors).find((a) => a.npc?.job === "worker");
  const guard = Object.values(s.actors).find((a) => a.npc?.job === "gateguard");
  const atPub = Math.hypot(v.x - LORRY_ROUTE[0], v.y - LORRY_ROUTE[1]) < 3;

  switch (v.state) {
    case "loading":
    case "unloading": {
      // The back is open; the mate carries crates between the lorry and the door.
      if (worker && worker.npc && !worker.npc.plan.length && worker.npc.mode === "routine") {
        const rear = rearOf(v);
        const door = v.state === "loading" ? { x: -34.8, y: 68 } : { x: 46, y: -48.6 };
        worker.npc.plan.push({ k: "go", x: rear.x, y: rear.y }, { k: "wait", s: 2 }, { k: "go", ...door }, { k: "wait", s: 3 });
      }
      if (tick >= v.until) {
        v.state = "driving";
        if (atPub) v.route = LORRY_ROUTE.slice(); else v.route = reverse(LORRY_ROUTE);
        v.ri = 2;
        v.inspected = false;
        if (worker?.npc) { worker.npc.plan = [{ k: "go", ...rearOf(v) }]; }
        if (driver) say(w, driver, atPub ? "Right, off we go." : "That's the lot.");
      }
      break;
    }
    case "driving": {
      // Pick up the mate before leaving; he rides in the cab (hidden).
      if (worker && !worker.hiddenIn && v.ri <= 2) {
        const rr = rearOf(v);
        if (Math.hypot(worker.x - rr.x, worker.y - rr.y) < 1.6) { worker.hiddenIn = v.cargo; worker.npc!.plan = []; }
        else if (worker.npc && !worker.npc.plan.length) worker.npc.plan = [{ k: "go", x: rr.x, y: rr.y }];
        else break;
      }
      const tx = v.route[v.ri], ty = v.route[v.ri + 1];
      const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
      // The service gate: stop, let the guard look, then the gate opens.
      const atGate = Math.abs(v.x - 67) < 0.5 && Math.abs(v.y - (-43)) < 0.5 && v.route[v.route.length - 2] === 50;
      if (atGate && !v.inspected) {
        v.state = "gate"; v.until = tick + 60 * 7; v.inspected = true; v.speed = 0;
        if (guard?.npc && guard.npc.mode === "routine") guard.npc.plan = [{ k: "go", ...SPOTS.gateInspect }, { k: "wait", s: 3 }, { k: "go", ...guard.npc.post! }];
        break;
      }
      let want = d < 6 ? 3 : 7.5;
      // Brake for anyone in the road ahead. After a few seconds of that, creep on regardless.
      const c = Math.cos(v.facing), sn = Math.sin(v.facing);
      for (const id in s.actors) {
        const a = s.actors[id];
        if (a.hiddenIn || a.fb || a.off) continue;
        const ax = a.x - v.x, ay = a.y - v.y, along = ax * c + ay * sn, across = Math.abs(-ax * sn + ay * c);
        if (along > LORRY_LEN / 2 && along < LORRY_LEN / 2 + 7 && across < LORRY_WID / 2 + 0.6) {
          want = (v.blocked ?? 0) > 240 ? 1.2 : 0;
          if (driver && tick % 90 === 0) say(w, driver, "Get out the road!");
        }
      }
      v.blocked = want === 0 ? (v.blocked ?? 0) + 1 : want < 2 ? v.blocked : 0;
      if (want > 0 && want < 2) {
        // Creeping: nudge people out of the way rather than flattening them.
        for (const id in s.actors) {
          const a = s.actors[id];
          if (a.hiddenIn || a.fb || a.off) continue;
          const ax = a.x - v.x, ay = a.y - v.y, along = ax * c + ay * sn, across = -ax * sn + ay * c;
          if (along > 0 && along < LORRY_LEN / 2 + 1 && Math.abs(across) < LORRY_WID / 2 + 0.5) { a.x += -sn * Math.sign(across || 1) * 0.08; a.y += c * Math.sign(across || 1) * 0.08; }
        }
      }
      v.speed += Math.sign(want - v.speed) * Math.min(Math.abs(want - v.speed), 6 * DT);
      if (d < 0.3) {
        v.ri += 2;
        if (v.ri >= v.route.length) {
          v.ri = 0; v.route = [v.x, v.y];
          const toBay = Math.hypot(v.x - SPOTS.loadingBay.x, v.y - SPOTS.loadingBay.y) < 3;
          v.state = toBay ? "unloading" : "loading";
          v.until = tick + 60 * (toBay ? 40 : 55);
          if (!toBay) v.cycle++;
          if (worker) { worker.hiddenIn = undefined; worker.x = rearOf(v).x; worker.y = rearOf(v).y; }
          if (driver && toBay) say(w, driver, "Delivery for the bars.");
        }
        break;
      }
      const st2 = Math.min(d, v.speed * DT);
      v.x += (dx / d) * st2; v.y += (dy / d) * st2;
      v.facing = Math.atan2(dy, dx);
      // Open the service gate as it passes, and leave it open a moment.
      if (Math.abs(v.x - 62.5) < 9 && Math.abs(v.y + 43) < 3) st.gates.servicegate = { until: tick + 60 * 6, for: null };
      break;
    }
    case "gate": {
      if (tick === v.until - 60 * 4 && guard) {
        // Has he looked in the back? More likely once trouble has started.
        const p = 0.25 + Math.min(0.5, st.incidents.length * 0.1) + (v.cycle > 1 ? 0.15 : 0);
        const cargo = s.items[v.cargo];
        const hidden = Object.values(s.actors).filter((a) => a.hiddenIn === cargo.id && !a.npc);
        if (chance(r, p)) {
          if (hidden.length) {
            const stow = hidden[0];
            stow.hiddenIn = undefined;
            stow.x = rearOf(v).x; stow.y = rearOf(v).y;
            say(w, guard, "Well, well. What have we got here?");
            crime(w, stow, "stowaway", 1, undefined, false);
            if (isSecurity(guard)) { guard.npc!.sus[stow.id] = 2; guard.npc!.crime = Math.max(guard.npc!.crime, 1); guard.npc!.target = stow.id; guard.npc!.mode = "approach"; }
          } else say(w, guard, "All right, in you go.");
        } else say(w, guard, "Go on through.");
      }
      if (tick >= v.until) { v.state = "driving"; st.gates.servicegate = { until: tick + 60 * 8, for: null }; }
      break;
    }
  }

  // The cargo travels with the lorry; anyone hidden inside travels with the cargo.
  const rear = rearOf(v);
  moveItem(s, v.cargo, { k: "ground", x: rear.x, y: rear.y });
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn === v.cargo) { a.x = v.x; a.y = v.y; a.vx = a.vy = 0; a.moveX = a.moveY = 0; }
  }
  if (driver) { driver.hiddenIn = v.cargo; driver.x = v.x; driver.y = v.y; }
}

export const rearOf = (v: Vehicle) => ({ x: v.x - Math.cos(v.facing) * (LORRY_LEN / 2 + 0.6), y: v.y - Math.sin(v.facing) * (LORRY_LEN / 2 + 0.6) });
export const cargoOpen = (v: Vehicle) => v.state === "loading" || v.state === "unloading";

/** People in the road get knocked over. */
export function lorryHits(w: World, v: Vehicle): Actor[] {
  if (v.state !== "driving" || v.speed < 2) return [];
  const s = w.state, out: Actor[] = [];
  const c = Math.cos(v.facing), sn = Math.sin(v.facing);
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.hiddenIn || a.fb || a.off) continue;
    const dx = a.x - v.x, dy = a.y - v.y;
    const along = dx * c + dy * sn, across = -dx * sn + dy * c;
    if (Math.abs(along) < LORRY_LEN / 2 + 0.3 && Math.abs(across) < LORRY_WID / 2 + 0.3 && a.downUntil < s.tick) {
      a.downUntil = s.tick + 150; a.x += -sn * 1.6 * Math.sign(across || 1); a.y += c * 1.6 * Math.sign(across || 1);
      out.push(a);
    }
  }
  return out;
}
