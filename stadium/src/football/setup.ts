import { gauss, rnd, type RngState } from "../core/rng";
import type { Actor, Id } from "../core/types";
import { clamp } from "../core/vec";
import { spawnActor, type World } from "../core/world";
import { FORMATIONS, HL, HW } from "./config";
import type { Footballer, MatchConfig, MatchState, Official, PosRole, TeamIdx, TeamState, TeamStats } from "./types";

export interface TeamDef {
  name: string;
  short: string;
  colour: number;
  colour2: number;
  /** 0 pub team .. 1 world champions. */
  strength: number;
  formation: string;
  /** Surnames: 11 starters in formation order, then 5 on the bench (GK, DEF, MID, MID, FWD). */
  names: string[];
  /** Formation slots of the stand-out players. */
  stars: number[];
}

// Fictional squads. Nations are real; every player is invented.
export const TEAMS: Record<string, TeamDef> = {
  ENG: {
    name: "England", short: "ENG", colour: 0xf4f4f4, colour2: 0x1b2a6b, strength: 0.66, formation: "4-4-2",
    names: ["Pickles", "Trippett", "Stonehouse", "Maguffin", "Shawcross", "Sackville", "Ricketts", "Bellingham-Smythe", "Fodder", "Kaneham", "Rashbrook",
      "Ramsbottom", "Gomersall", "Hendo", "Gallacher", "Watkiss"],
    stars: [9],
  },
  POR: {
    name: "Portugal", short: "POR", colour: 0xb3122a, colour2: 0x0b6b3a, strength: 0.7, formation: "4-3-3",
    names: ["Costinha", "Canelas", "Diaspora", "Pepino", "Mendonca", "Vitinho", "Nevoeiro", "Bernardim", "Leandro", "Ronaldinho Jr", "Felisberto",
      "Patricio", "Dalote", "Palhaco", "Otavio", "Ramosa"],
    stars: [9],
  },
  ARG: {
    name: "Argentina", short: "ARG", colour: 0x7ec8f2, colour2: 0xffffff, strength: 0.78, formation: "4-4-2",
    names: ["Martillo", "Molinero", "Romerito", "Otamendez", "Tagliatelle", "Di Marzipan", "De Paulo", "Fernandino", "MacAllistair", "Messias", "Alvarito",
      "Armani", "Lisandro", "Paredon", "Lo Celsius", "Lautarez"],
    stars: [9, 10],
  },
  BRA: {
    name: "Brazil", short: "BRA", colour: 0xf7d417, colour2: 0x1a7f3c, strength: 0.84, formation: "4-3-3",
    names: ["Alissandro", "Danilinho", "Marquinhas", "Militao", "Sandrinho", "Casemirinho", "Paquetao", "Guimaraes", "Raphinho", "Vinicio", "Rodriguinho",
      "Edersinho", "Bremerio", "Fredinho", "Douglas", "Richarlisinho"],
    stars: [9, 8],
  },
};

const BENCH_ROLES: PosRole[] = ["GK", "DEF", "MID", "MID", "FWD"];

function makeFootballer(rng: RngState, team: TeamIdx, def: TeamDef, i: number): Footballer {
  const starter = i < 11;
  const slot = starter ? i : -1;
  const role: PosRole = starter ? FORMATIONS[def.formation][i].role : BENCH_ROLES[i - 11];
  const base = () => clamp(0.4 + 0.42 * def.strength + gauss(rng) * 0.06 - (starter ? 0 : 0.05), 0.2, 0.93);
  const star = starter && def.stars.includes(slot);
  const f: Footballer = {
    team, number: i === 0 ? 1 : i + 1, role, slot, star,
    pace: clamp(base() + (role === "FWD" ? 0.06 : role === "GK" ? -0.2 : 0), 0.2, 0.95),
    passing: clamp(base() + (role === "MID" ? 0.08 : role === "GK" ? -0.15 : 0), 0.2, 0.95),
    shooting: clamp(base() + (role === "FWD" ? 0.12 : role === "MID" ? 0 : -0.2), 0.1, 0.95),
    tackling: clamp(base() + (role === "DEF" ? 0.12 : role === "FWD" ? -0.2 : 0), 0.1, 0.95),
    control: clamp(base() + (role === "DEF" ? -0.05 : 0.03), 0.2, 0.95),
    keeping: role === "GK" ? clamp(base() + 0.12, 0.3, 0.95) : 0.08,
    aggression: clamp(0.4 + gauss(rng) * 0.18 + (role === "DEF" ? 0.08 : 0), 0.05, 0.95),
    composure: base(),
    stamina: base(),
    status: starter ? "playing" : "bench",
    fatigue: 0, yellows: 0, goals: 0,
    thinkAt: Math.floor(rnd(rng) * 9), tx: 0, ty: 0, sprint: false, intent: "position",
    kickLock: 0, tackleLock: 0, stunUntil: 0, gotBallAt: 0,
    diveAt: 0, diveUntil: 0, diveX: 0, diveY: 0, releaseAt: 0,
    bribed: false, wiredUntil: 0,
  };
  if (star) {
    f.pace = Math.max(f.pace, 0.93); f.shooting = Math.max(f.shooting, 0.95);
    f.control = Math.max(f.control, 0.93); f.composure = Math.max(f.composure, 0.9);
    f.passing = Math.max(f.passing, 0.85);
  }
  return f;
}

const emptyStats = (): TeamStats => ({
  shots: 0, onTarget: 0, fouls: 0, corners: 0, offsides: 0, passes: 0, possession: 0, yellows: 0, reds: 0, saves: 0,
});

export const DEFAULT_CFG: MatchConfig = { halfSeconds: 450, halfTimeSeconds: 150, knockout: true };

/** Create both squads and the officials as actors, and a match waiting to kick off. */
export function createMatch(w: World, home: TeamDef, away: TeamDef, cfg: Partial<MatchConfig> = {}): MatchState {
  const s = w.state;
  const rng = s.rng.match;
  const teams = [home, away].map((def, ti) => {
    const squad: Id[] = [];
    def.names.forEach((name, i) => {
      const fb = makeFootballer(rng, ti as TeamIdx, def, i);
      const a = spawnActor(s, "footballer", name, 0, 0, { id: `${def.short}${fb.number}`, fb, radius: 0.38 });
      squad.push(a.id);
    });
    const t: TeamState = {
      name: def.name, short: def.short, colour: def.colour, colour2: def.colour2,
      squad, formation: def.formation, mentality: 0, subsLeft: 5, pendingSubs: [],
    };
    return t;
  }) as [TeamState, TeamState];

  const official = (job: Official["job"], name: string, x: number, y: number, line = 0, half = 0): Actor =>
    spawnActor(s, "official", name, x, y, {
      id: `off_${job}${line ? (half > 0 ? "A" : "B") : ""}`, radius: 0.38,
      off: { job, line, half, distractedUntil: 0, incapacitated: false, bias: [0, 0], strictness: 0.5 },
    });
  const referee = official("referee", "Mr Collymore-Webb", 3, 4);
  const a1 = official("assistant", "Assistant referee", -10, HW + 1, 1, -1);
  const a2 = official("assistant", "Assistant referee", 10, -HW - 1, -1, 1);
  const fourth = official("fourth", "Fourth official", 0, -HW - 3);

  const m: MatchState = {
    cfg: { ...DEFAULT_CFG, ...cfg },
    teams,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, lastTouch: null, lastTouchTeam: -1, freeUntil: 0, shot: null, lastShot: null },
    phase: "pre", phaseUntil: s.tick + Math.round((cfg.preSeconds ?? 3) * 60),
    period: 1, clock: 0, stoppage: 0, addedAnnounced: 0,
    dir0: 1, restart: null, next: null, possession: -1,
    score: [0, 0], physicalGoals: [0, 0], pending: [],
    officials: { referee: referee.id, assistants: [a1.id, a2.id], fourth: fourth.id },
    stats: [emptyStats(), emptyStats()],
    passTo: null, offside: null, shootout: null, winner: -1, firstKick: 0, mentalityAt: 0, halted: null,
  };
  s.match = m;
  // Stand everyone somewhere sensible before kick-off.
  for (const ti of [0, 1] as TeamIdx[]) {
    const dir = ti === 0 ? m.dir0 : -m.dir0;
    let bench = 0;
    for (const id of teams[ti].squad) {
      const a = s.actors[id], fb = a.fb!;
      if (fb.status === "bench") { a.x = -dir * (5 + bench++ * 1.2); a.y = -HW - 4.5; continue; }
      const slot = FORMATIONS[teams[ti].formation][fb.slot];
      a.x = dir * (slot.x * HL * 0.5 - HL * 0.45); a.y = dir * slot.y * HW * 0.8;
      a.x = dir > 0 ? Math.min(a.x, -0.5) : Math.max(a.x, 0.5);
      fb.tx = a.x; fb.ty = a.y;
    }
  }
  return m;
}
