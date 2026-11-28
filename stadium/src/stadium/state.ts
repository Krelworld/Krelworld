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
  /** The cause (cause.ts) he's acting under, and until when: what he sets off meanwhile is its child. */
  cause?: number; causeUntil?: number;
  /** The problem he's seeing to (machine.ts), and what's pulled him over (a stim), and when he can be pulled again. */
  duty?: number; drawn?: number; drawnUntil?: number;
  /** What he holds against whom (social.ts), when he last had it out, what his body's telling him, and who sent him on an errand. */
  grudge?: Record<Id, number>; rowAt?: number;
  need?: { at: number; stage: number; since: number; loo?: string };
  ordered?: { by: Id; at: number };
  /** Rumours he's heard (belief.ts). */
  heardR?: number[];
  /** Stays at his post rather than walking a round (the copper on the van). */
  stay?: boolean;
  /** Stood in place for a scheme's scene until this tick. */
  staged?: number;
  /** What he's just said is part of a scheme: it gets a proper bubble until this tick. */
  told?: number;
  /** Standing about with others: the middle of the group, and what they're doing (chat, drink, smoke, cheer, idle). */
  group?: { x: number; y: number };
  act?: "chat" | "drink" | "smoke" | "cheer" | "idle";
  /** Why they've broken off what they were doing (shown over their head while it lasts). */
  why?: "fetch" | "angry" | "search" | "report";
  whyUntil?: number;
  /** The item they're off to fetch back. */
  fetch?: Id;
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
  /** Times you've talked to them, and what they've said (so they don't repeat it). */
  talked?: number;
  /** Waiting at the foot of a ladder before going up after someone (a tick). */
  roofWait?: number;
  /** Getting away from a stench until this tick. */
  stenchUntil?: number;
  heard?: string[];
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

export interface Smoke { x: number; y: number; r: number; until: number; /** A stink bomb: clears people out, doesn't hide anything. */ kind?: "stench" }

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
  /** A bloke who has taken a fancy to Grozz in his frock (drag.ts). */
  creep?: import("./drag").Creep;
  /** Kegs rolling, kegs being carried back (keg → who), and the chain Grozz has going. */
  rolling?: import("./kegs").Roll[];
  kegCarry?: Record<Id, Id>;
  chain?: import("./kegs").Chain;
  /** The cause graph (cause.ts), and the machine's open stimuli and problems (machine.ts). */
  causes?: import("./cause").Cause[]; causeSeq?: number;
  rumours?: import("./belief").Rumour[];
  beer?: import("./beer").Beer;
  /** Authored schemes: what's been learnt, what's arranged, what's playing. */
  schemes?: Record<string, import("./schemes").SchemeState>;
  loos?: import("./social").Loo[];
  stims?: import("./machine").Stim[]; problems?: import("./machine").Problem[]; machineSeq?: number;
  /** Held by security (the game's detention): time passes, then he's let out. */
  custody?: { until: number; taken: string[]; away?: number; mate?: Id; said?: number; goals?: number; eng?: number; nicked?: boolean; signed?: boolean };
  /** Out cold in the medical room until this tick. */
  recover?: { until: number; calmed?: boolean };
  /** A fan's pint left on the wall while he's away (lulls.ts). */
  pintBeat?: import("./lulls").PintBeat;
  /** The forecourt contraptions: where each one's got to, and when it's ready again. */
  rigs?: Record<string, import("./rigs").RigState>;
  /** The other things that go off when touched (pranks.ts): who they've pulled out of their seats. */
  pranks?: import("./pranks").PrankState;
  /** Their star, off looking for his boots instead of boarding (bootbag.ts). */
  bootHunt?: import("./bootbag").BootHunt;
  /** The ball's come to Grozz (out of play, into the stand). */
  ballOut?: import("./ballout").BallOut;
  ballOutCool?: number;
  /** Where the ball was last tick while in play (where it went out). */
  lastBall?: { x: number; y: number };
  /** People coming to the pawn shop for something of theirs that's turned up in the window. */
  pawnSeek?: { who: Id; def: string; at: number; item?: Id }[];
  /** Owners on their way to the pawn shop for their things (who, which item). */
  pawnBack?: { who: Id; item: Id }[];
  /** The longest chain of the day (for the front page). */
  chainBest?: import("./kegs").Chain;
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
  /** Lines said lately, anywhere (nobody repeats them for a while). */
  recent?: string[];
  /** The second half of an exchange, waiting its turn. */
  chatQ?: { by: string; text: string; at: number }[];
  /** Witnesses on their way to grass you up. */
  snitches?: import("./witness").Snitch[];
  /** The people in the hidden stories. */
  scenarioIds?: { len: string; stag: string[]; mick?: string; dave: string };
  /** Somebody with something to tell you, the next time you talk to them (hidden scenarios). */
  scenarioTalk?: Record<string, [string, string][]>;
  /** The phone: who you can ring, who's on the way, and whether a call's being traced. */
  phone?: import("./phone").PhoneState;
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
    /** Food he's after (any food on the floor nearby: the second rule), and when he's done eating. */
    food?: Id;
    eatUntil?: number;
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
