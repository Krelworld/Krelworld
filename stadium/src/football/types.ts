import type { Id } from "../core/types";

export type TeamIdx = 0 | 1;
export type PosRole = "GK" | "DEF" | "MID" | "FWD";
export type PlayerStatus = "playing" | "bench" | "gone";

/** Football component on an Actor. Attributes are 0..1. */
export interface Footballer {
  team: TeamIdx;
  number: number;
  role: PosRole;
  /** Formation slot (0 is the goalkeeper). -1 on the bench. */
  slot: number;
  star: boolean;
  pace: number; passing: number; shooting: number; tackling: number; control: number;
  keeping: number; aggression: number; composure: number; stamina: number;
  status: PlayerStatus;
  /** Why a player left: sent_off, injured, subbed, arrested, missing... */
  goneReason?: string;
  fatigue: number;
  yellows: number;
  goals: number;
  // --- moment-to-moment ---
  thinkAt: number;
  tx: number; ty: number;
  sprint: boolean;
  intent: "position" | "chase" | "receive" | "press" | "carry" | "keeper" | "setpiece" | "celebrate";
  /** Tick before which he cannot touch the ball. */
  kickLock: number;
  tackleLock: number;
  /** Tick until which he is beaten, fouled or on the floor. */
  stunUntil: number;
  /** Tick he gained the ball, for how long he has held it. */
  gotBallAt: number;
  // --- goalkeeper ---
  /** Tick the keeper will start his dive (0 = none planned). */
  diveAt: number;
  diveUntil: number;
  diveX: number; diveY: number;
  /** Tick at which a keeper holding the ball will release it. */
  releaseAt: number;
  // --- interference (set from outside the match) ---
  /** Paid to play badly. Keepers dive the wrong way; outfielders waste chances. */
  bribed: boolean;
  /** Tick until which he is reckless (drugged). */
  wiredUntil: number;
}

export interface Official {
  job: "referee" | "assistant" | "fourth";
  /** Assistants: which touchline (-1 or 1) and which half (-1 or 1) they patrol. */
  line: number; half: number;
  distractedUntil: number;
  incapacitated: boolean;
  /** How much this official favours each team, -1..1. Zero is honest. */
  bias: [number, number];
  /** 0 lenient .. 1 card-happy. */
  strictness: number;
}

export interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  owner: Id | null;
  /** A goalkeeper has it in his hands. */
  held: boolean;
  lastTouch: Id | null;
  lastTouchTeam: TeamIdx | -1;
  /** The most recent shot, kept after deflections so the right player is credited. */
  lastShot: { by: Id; team: TeamIdx | -1; at: number } | null;
  /** Tick before which nobody can control it (just kicked). */
  freeUntil: number;
  /** Set while a shot is in flight: who hit it, and whether the keeper has had his attempt. */
  shot: { by: Id; team: TeamIdx | -1; at: number; saveTried: boolean; onTarget: boolean; pen: boolean } | null;
}

export interface TeamState {
  name: string;
  short: string;
  colour: number;
  colour2: number;
  /** Whole squad, starters first. */
  squad: Id[];
  formation: string;
  /** -1 parked bus .. 1 all-out attack. Drifts with the score and the clock. */
  mentality: number;
  subsLeft: number;
  pendingSubs: { off: Id; on: Id }[];
}

export type Phase = "pre" | "live" | "restart" | "goal_pause" | "break" | "shootout" | "finished";
export type RestartType = "kickoff" | "throw_in" | "goal_kick" | "corner" | "free_kick" | "penalty";

export interface Restart {
  type: RestartType;
  team: TeamIdx;
  x: number; y: number;
  taker: Id | null;
  readyAt: number;
  /** Shootout kick: nobody else may play the ball. */
  shootout?: boolean;
}

/** Something that physically happened and now needs an official to rule on it. */
export interface Candidate {
  kind: "goal" | "foul" | "offside";
  t: number;
  x: number; y: number;
  /** goal: team that would be awarded it. foul/offside: offending team. */
  team: TeamIdx;
  actor: Id | null;
  victim?: Id | null;
  severity?: number;
  /** offside: metres beyond the line (negative means actually onside). */
  margin?: number;
  ownGoal?: boolean;
  /** foul: nothing actually happened; a biased referee or a dive. */
  phantom?: boolean;
}

export interface TeamStats {
  shots: number; onTarget: number; fouls: number; corners: number; offsides: number;
  passes: number; possession: number; yellows: number; reds: number; saves: number;
}

export interface ShootoutState {
  order: [Id[], Id[]];
  taken: [number, number];
  scored: [number, number];
  turn: TeamIdx;
  /** 1 or -1: which end the kicks are taken at. */
  end: number;
  kickAt: number;
  resolveAt: number;
  taker: Id | null;
  scoredFlag: boolean;
}

export interface MatchConfig {
  /** Real seconds for one 45-minute half. */
  halfSeconds: number;
  halfTimeSeconds: number;
  /** Knockout ties go to extra time and penalties. */
  knockout: boolean;
}

export interface MatchState {
  cfg: MatchConfig;
  teams: [TeamState, TeamState];
  ball: Ball;
  phase: Phase;
  phaseUntil: number;
  /** 1, 2 = halves. 3, 4 = extra time. 5 = shootout. */
  period: number;
  /** Seconds played in this period. */
  clock: number;
  /** Stoppage seconds earned this period, and the amount announced (0 until announced). */
  stoppage: number;
  addedAnnounced: number;
  /** Direction team 0 is attacking along x. */
  dir0: 1 | -1;
  restart: Restart | null;
  /** What follows the current pause, once the officials have ruled. */
  next: { type: RestartType; team: TeamIdx; x: number; y: number } | null;
  /** Team last in control of the ball. */
  possession: TeamIdx | -1;
  /** What the officials have recognised. Bets and the scoreboard read this. */
  score: [number, number];
  /** Times the ball actually crossed each team's opponents' line, recognised or not. */
  physicalGoals: [number, number];
  pending: Candidate[];
  officials: { referee: Id; assistants: [Id, Id]; fourth: Id };
  stats: [TeamStats, TeamStats];
  /** Receiver the current pass was meant for. */
  passTo: Id | null;
  /** Offside positions frozen at the moment of the last pass: actor id to margin in metres. */
  offside: { team: TeamIdx; margins: Record<Id, number> } | null;
  shootout: ShootoutState | null;
  winner: TeamIdx | -1;
  /** Which kickoff team started the match, to alternate halves. */
  firstKick: TeamIdx;
  mentalityAt: number;
}
