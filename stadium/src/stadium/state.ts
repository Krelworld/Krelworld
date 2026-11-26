// Saved state for the stadium layer. Plain data only.
import type { Id, Role } from "../core/types";

export type Job =
  | "dog" | "fan" | "local" | "turnstile" | "doorguard" | "gateguard" | "pitchsteward" | "patrol" | "corridor" | "chief"
  | "police" | "barman" | "seller" | "cleaner" | "driver" | "worker" | "cook" | "player" | "official" | "armed" | "kitman" | "groundsman" | "press" | "mascot" | "para" | "cleanup";

export type Task =
  | { k: "go"; x: number; y: number; run?: boolean }
  | { k: "wait"; s: number }
  | { k: "sit" }
  | { k: "say"; text: string }
  | { k: "despawn" };

export type Mode = "routine" | "watch" | "approach" | "chase" | "escort" | "search" | "inspect" | "flee";

export interface Npc {
  job: Job;
  /** How many times you've talked to them (which of their lines comes next). */
  said?: number;
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
  /** The last thing this steward said from a pool of lines (so he doesn't repeat himself). */
  lastLine?: string;
  /** About to hit back at someone. */
  retaliateAt?: number;
  retaliateOn?: Id;
  /** A mounted officer (drawn on the horse). */
  mounted?: boolean;
  /** Standing about with others: the middle of the group, and what they're doing (chat, drink, smoke, cheer, idle). */
  group?: { x: number; y: number };
  act?: "chat" | "drink" | "smoke" | "cheer" | "idle";
  /** Rubbernecking a fight until this tick; `filming` if they've got their phone out. */
  gawk?: { until: number; x: number; y: number; filming: boolean };
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
  /** When a supporter stops milling about outside and heads for the turnstiles (seconds). */
  goInAt?: number;
  /** Things this person might say when someone is near. */
  lines?: string[];
}

export interface Vehicle {
  id: Id;
  kind: "lorry" | "bus";
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
  // --- the team bus ---
  /** Somebody has been at it with a knife or a hammer. */
  tampered?: boolean;
  crashed?: boolean;
  /** Who is at the wheel, if it isn't the driver. */
  drivenBy?: Id;
  /** The team whose bus it is. */
  team?: string;
  /** Passengers' seat: footballers ride here. */
  cab?: Id;
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

/** A hole knocked in a wall: anything within r of the centre is no longer solid. */
export interface Breach { x: number; y: number; r: number; t: number }

export interface Incident {
  t: number;
  what: string;
  by: Id;
  /** Which supporters got the blame, judging by the shirt. */
  blamed: string | null;
  severity: number;
  seenBy: number;
}

export interface Ending { kind: "arrested" | "eliminated" | "through" | "hospital" | "shot" | "fell"; title: string; text: string }

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
  /** A steward getting his radio out: backup is called at `at`, unless he's flattened first. */
  pendingRadio?: { by: string; target: string; x: number; y: number; severity: number; at: number }[];
  /** Bodies called in on the radio, and the crew sent to take them away. */
  coverups?: { body: string; crew: string[]; at: number; stage: number; by: string; from?: { x: number; y: number } }[];
  /** The police horse, once its officer is off it. */
  horse?: import("./horse").Horse;
  /** Cars going by on the ring road. */
  traffic?: import("./traffic").Car[];
  /** The car you've nicked (driving it, or left where you got out). */
  myCar?: import("./cars").MyCar;
  /** Detained in the security office until this tick (0 if not). */
  detainedUntil: number;
  /** The police have been sent for. */
  policeCalled: boolean;
  /** Item id of the locker where confiscated things go. */
  locker: Id;
  /** The dog: tied up, on a lead, loose or caught. */
  dog: {
    id: Id; state: "tied" | "led" | "loose" | "caught" | "sicced" | "returning"; target: Id | null; owner: Id; bitten: number; nextBite: number;
    /** Bites into the current mauling. */
    maul?: number;
  } | null;
  /** Tip-offs the police are following up. */
  tipoffs: { target: Id; by: Id; officer: Id; at: number; stage: "going" | "waiting" | "done" }[];
  /** Clouds of smoke from flares. */
  smoke: Smoke[];
  /** Holes in walls. */
  breaches: Breach[];
  /** People diving out of the way of the bus: where to, and by when. */
  dives?: Record<Id, { x: number; y: number; until: number }>;
  /** Who drank from which spiked supply at half-time. */
  dosed: Record<Id, { effect: string; at: number }>;
}
