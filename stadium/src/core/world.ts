import { Bus } from "./bus";
import { moveItem } from "./items";
import { seedRng } from "./rng";
import { DT, type Actor, type ActorKind, type Id, type Level, type WorldState } from "./types";
import { stepMatch } from "../football/match";

/** State is plain data (saveable). Level and bus are not part of a checkpoint. */
export interface World {
  state: WorldState;
  level: Level;
  bus: Bus;
}

export function createWorld(seed: number | string, level: Level = { zones: [] }): World {
  return {
    state: {
      tick: 0,
      nextId: 1,
      rng: { world: seedRng(`${seed}:world`), match: seedRng(`${seed}:match`) },
      actors: {},
      items: {},
      match: null,
      recordings: {},
    },
    level,
    bus: new Bus(),
  };
}

export function spawnActor(s: WorldState, kind: ActorKind, name: string, x: number, y: number, init: Partial<Actor> = {}): Actor {
  const id = init.id ?? `a${s.nextId++}`;
  const a: Actor = {
    id, kind, name, faceId: id, x, y, vx: 0, vy: 0, facing: 0, radius: 0.4, speed: 3,
    moveX: 0, moveY: 0, hand: null, pockets: [], worn: {}, money: 0, downUntil: 0, effects: {},
    ...init,
  };
  s.actors[id] = a;
  return a;
}

const WAYPOINT_EVERY = 30;
const GRAVITY = 9.8;

/** Advance everything by one fixed step. */
export function stepWorld(w: World): void {
  const s = w.state;
  s.tick++;

  // Actors driven by movement intent (the protagonist, bystanders). Footballers
  // and officials are moved by the match.
  for (const id in s.actors) {
    const a = s.actors[id];
    if (a.fb || a.off) continue;
    if (a.downUntil > s.tick) { a.vx = a.vy = 0; continue; }
    const l = Math.hypot(a.moveX, a.moveY);
    const k = l > 1 ? 1 / l : 1;
    a.vx = a.moveX * k * a.speed;
    a.vy = a.moveY * k * a.speed;
    a.x += a.vx * DT;
    a.y += a.vy * DT;
    if (l > 0.05) a.facing = Math.atan2(a.moveY, a.moveX);
  }

  // Thrown items.
  for (const id in s.items) {
    const it = s.items[id];
    const l = it.loc;
    if (l.k !== "air") continue;
    l.x += l.vx * DT; l.y += l.vy * DT; l.z += l.vz * DT; l.vz -= GRAVITY * DT;
    let hit: Actor | null = null;
    for (const aid in s.actors) {
      const a = s.actors[aid];
      if (aid === l.by || l.z > 2.2) continue;
      if (Math.hypot(a.x - l.x, a.y - l.y) < a.radius + 0.25) { hit = a; break; }
    }
    if (hit || l.z <= 0) {
      const { x, y, by } = l;
      moveItem(s, id, { k: "ground", x, y });
      w.bus.emit({ type: hit ? "item_hit" : "item_landed", t: s.tick, item: id, itemDef: it.def, by, target: hit?.id, x, y });
    }
  }

  // Movement waypoints for anyone being recorded.
  if (s.tick % WAYPOINT_EVERY === 0) {
    for (const id in s.recordings) {
      const a = s.actors[id];
      if (a) s.recordings[id].push({ t: s.tick, x: a.x, y: a.y });
    }
  }

  if (s.match) stepMatch(w);
}

export const startRecording = (s: WorldState, actor: Id) => { s.recordings[actor] = []; };

/** A checkpoint is a deep copy of the state. */
export const snapshot = (w: World): WorldState => structuredClone(w.state);
export const restore = (w: World, snap: WorldState): void => { w.state = structuredClone(snap); };
