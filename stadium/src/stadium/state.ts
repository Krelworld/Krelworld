// Saved state for the stadium layer. Plain data only.
import type { Id, Role } from "../core/types";

export type Job =
  | "fan" | "local" | "turnstile" | "doorguard" | "gateguard" | "pitchsteward" | "patrol" | "corridor" | "chief"
  | "police" | "barman" | "seller" | "cleaner" | "driver" | "worker" | "cook" | "player" | "official";

export type Task =
  | { k: "go"; x: number; y: number; run?: boolean }
  | { k: "wait"; s: number }
  | { k: "sit" }
  | { k: "say"; text: string }
  | { k: "despawn" };

export type Mode = "routine" | "watch" | "approach" | "chase" | "escort" | "search" | "inspect" | "flee";

export interface Npc {
  job: Job;
  role: Role;
  team?: 0 | 1;
  post?: { x: number; y: number };
  seat?: { x: number; y: number };
  plan: Task[];
  path: number[];
  pathI: number;
  goal: { x: number; y: number; run: boolean } | null;
  waitUntil: number;
  stage: number;
  sitting: boolean;
  bubble: { text: string; until: number } | null;
  nextBark: number;
  // Security.
  mode: Mode;
  /** How suspicious this person is of each suspect, 0..2. */
  sus: Record<Id, number>;
  target: Id | null;
  lastSeen: { x: number; y: number; t: number } | null;
  /** Worst thing they have seen the target do (0 nothing .. 3 serious). */
  crime: number;
  /** What happens when they get hold of the target. */
  intent: "warn" | "escort" | "eject" | "detain" | "arrest" | null;
  modeUntil: number;
  /** Paid to look the other way until this tick. */
  paidUntil: number;
  /** Will not take money from this person again. */
  refused: Id[];
  hasTicket: boolean;
  /** Which way they face when standing at their post. */
  face?: number;
  /** How tight a grip they have: each failed wriggle makes the next harder. */
  grip?: number;
  /** When the current escort started. */
  escortAt?: number;
  /** Where an escort is heading. */
  escortTo?: { x: number; y: number };
  /** Which shop this person serves at, if any. */
  shop?: string;
  /** Things this person might say when someone is near. */
  lines?: string[];
}

export interface Vehicle {
  id: Id;
  kind: "lorry";
  x: number; y: number; facing: number;
  route: number[];
  ri: number;
  speed: number;
  state: "loading" | "driving" | "gate" | "unloading" | "returning" | "parked";
  until: number;
  cargo: Id;
  driver: Id;
  cycle: number;
  /** The gate guard has been asked to look in the back. */
  inspected: boolean;
  /** Ticks spent stopped for someone in the road. */
  blocked?: number;
}

export interface Wanted {
  face: Id;
  team: string | null;
  role: Role;
  outer: string | null;
  /** The whole outfit as an onlooker would describe it. */
  look: string;
  severity: number;
  until: number;
  what: string;
}

export interface Smoke { x: number; y: number; r: number; until: number }

export interface Incident {
  t: number;
  what: string;
  by: Id;
  /** Which supporters got the blame, judging by the shirt. */
  blamed: string | null;
  severity: number;
  seenBy: number;
}

export interface Ending { kind: "arrested" | "eliminated" | "through" | "hospital"; title: string; text: string }

export interface StadiumState {
  pc: Id;
  arrivedAt: number;
  gates: Record<string, { until: number; for: Id | null }>;
  vehicles: Record<Id, Vehicle>;
  /** Faces the stewards will turn away at the gate. */
  banned: Id[];
  wanted: Wanted[];
  incidents: Incident[];
  /** Ever been inside the ground (for the admission checkpoint). */
  admitted: boolean;
  /** Warnings given to the player this match. */
  warnings: number;
  ending: Ending | null;
  /** Someone the door guard has just waved through. */
  doorPass: Id | null;
  /** One-off things that have happened. */
  flags: Record<string, number>;
  /** Detained in the security office until this tick (0 if not). */
  detainedUntil: number;
  /** The police have been sent for. */
  policeCalled: boolean;
  /** Item id of the locker where confiscated things go. */
  locker: Id;
  /** Tip-offs the police are following up. */
  tipoffs: { target: Id; by: Id; officer: Id; at: number; stage: "going" | "waiting" | "done" }[];
  /** Clouds of smoke from flares. */
  smoke: Smoke[];
  /** Who drank from which spiked supply at half-time. */
  dosed: Record<Id, { effect: string; at: number }>;
}
