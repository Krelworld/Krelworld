import type { RngState } from "./rng";
import type { Footballer, Official, MatchState } from "../football/types";
import type { Npc, StadiumState } from "../stadium/state";

export type Id = string;
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

// ---------- Items ----------
/** Properties drive interactions. Targets respond to properties, never to item names. */
export type Prop =
  | "sharp" | "throwable" | "liquid" | "consumable" | "food" | "alcohol" | "spikable"
  | "substance" | "wearable" | "weapon" | "metal" | "illicit" | "credential" | "container"
  | "valuable" | "noisy" | "sinister" | "smoke" | "grisly";
export type WearSlot = "head" | "face" | "outer" | "inner" | "body";
export type Role =
  | "fan" | "steward" | "police" | "cleaner" | "catering" | "medic" | "broadcaster"
  | "footballer" | "referee" | "vip" | "none";

export interface ItemDef {
  id: string;
  name: string;
  props: Prop[];
  /** small fits a pocket; large must be held or worn; huge cannot pass a gate. */
  size: "small" | "large" | "huge";
  slot?: WearSlot;
  /** Team this item makes the wearer appear to support or play for. */
  team?: string;
  /** Role this item makes the wearer appear to hold. */
  role?: Role;
  /** How much apparent authority it lends (0 none, 1 staff, 2 security, 3 official). */
  authority?: number;
  /** For substances: what it does when consumed. */
  effect?: string;
  /** Main colour when drawn or worn. */
  colour?: number;
  colour2?: number;
  /** How much of the face it hides, 0..1. One means unrecognisable. */
  faceCover?: number;
  /** Price in pounds where it is sold. */
  price?: number;
}

export type ItemLoc =
  | { k: "ground"; x: number; y: number }
  | { k: "air"; x: number; y: number; z: number; vx: number; vy: number; vz: number; by: Id }
  | { k: "hand"; a: Id }
  | { k: "pocket"; a: Id }
  | { k: "worn"; a: Id; slot: WearSlot }
  | { k: "in"; c: Id }
  | { k: "gone" };

export interface Item {
  id: Id;
  def: string;
  loc: ItemLoc;
  /** Substance def id this food or drink has been spiked with. */
  spiked?: string;
  /** A ticket that has been cancelled. */
  void?: boolean;
  /** Who it belongs to, for credentials and stolen goods. */
  owner?: Id;
  /** Money held in a wallet. */
  cash?: number;
  /** A ticket that has already been through a turnstile. */
  used?: boolean;
  /** Who slipped this into someone else's pocket. */
  plantedBy?: Id;
  /** Whose it was (a face, a pair of hands). */
  of?: Id;
  /** A name of its own, e.g. "Steward Alan's face". */
  label?: string;
  /** A betting slip's terms and, once settled, its result. */
  bet?: { market: "winner" | "next" | "pen" | "red"; pick: string; stake: number; odds: number; at: number; result?: "won" | "lost" };
}

// ---------- Actors ----------
export type ActorKind = "protagonist" | "echo" | "npc" | "footballer" | "official";

export interface Actor {
  id: Id;
  kind: ActorKind;
  name: string;
  /** Faces are separate from clothing: a disguise never changes this. */
  faceId: Id;
  x: number; y: number; vx: number; vy: number;
  facing: number;
  radius: number;
  /** Top walking speed in m/s. */
  speed: number;
  /** Desired movement, each axis -1..1. Set by the player's input or by a brain. */
  moveX: number; moveY: number;
  hand: Id | null;
  pockets: Id[];
  worn: Partial<Record<WearSlot, Id>>;
  money: number;
  /** Tick until which the actor is on the floor or otherwise out of action. */
  downUntil: number;
  /** Thrown back by a blow: metres per second along the ground, until a tick (slows as it goes). */
  knock?: { vx: number; vy: number; from: number; until: number };
  /** Active effects with the tick they wear off, e.g. { drunk: 5400 }. */
  effects: Record<string, number>;
  /** Present on footballers. */
  fb?: Footballer;
  /** Present on match officials. */
  off?: Official;
  /** Present on people with a routine of their own. */
  npc?: Npc;
  /** Inside a container (a lorry, a cubicle). Unseen and carried with it. */
  hiddenIn?: Id;
  /** Sitting in the stands. */
  seated?: boolean;
  /** Being frogmarched by this person. */
  heldBy?: Id;
  /** Driving from the cab: steer -1..1 (right is positive), throttle -1..1. When set, replaces moveX/moveY for vehicles. */
  drive?: { steer: number; throttle: number };
  /** Dead. Stays where it fell. */
  dead?: boolean;
}

// ---------- Actions ----------
export type VerbId = string;
export type Target =
  | { k: "actor"; id: Id }
  | { k: "item"; id: Id }
  | { k: "point"; x: number; y: number };

/** Every deliberate thing an actor does goes through one of these. Recordable. */
export interface Action {
  verb: VerbId;
  actor: Id;
  item?: Id;
  target?: Target;
  /** Unit direction for throws and strikes. */
  dirX?: number; dirY?: number;
  power?: number;
  /** For throws: how far away the target is, in metres. */
  dist?: number;
  /** Free-form extra (what to buy, how much money to offer). */
  arg?: string;
  amount?: number;
}

export interface RecordedStep {
  t: number;
  x: number; y: number;
  /** Absent for plain movement waypoints. */
  action?: Action;
}

// ---------- Level (static) ----------
export type Access = "public" | "ticket" | "staff" | "restricted" | "pitch";
export interface Zone {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number;
  access: Access;
  /** Roles that may be here. Empty means the access level alone decides. */
  roles?: Role[];
}
export interface Level { zones: Zone[] }

// ---------- World ----------
export interface WorldState {
  tick: number;
  nextId: number;
  rng: { world: RngState; match: RngState };
  actors: Record<Id, Actor>;
  items: Record<Id, Item>;
  match: MatchState | null;
  /** Actors currently being recorded, and what they have done so far. */
  recordings: Record<Id, RecordedStep[]>;
  stadium?: StadiumState;
}
