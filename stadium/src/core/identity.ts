import { defOf, hasProp } from "./items";
import type { Access, Actor, Id, Role, WorldState, Zone } from "./types";

/** What an onlooker would take this actor to be. Clothing can lie; the face cannot. */
/** The game's joke about a worn face: it looks like a butcher's window and nobody says a word. When this is
 *  on, a borrowed face doesn't make anyone suspicious (carrying a pair of hands about still does). */
export const DEADPAN = { on: false };

export interface Appearance {
  team: string | null;
  role: Role;
  authority: number;
  faceId: Id;
  /** How much of the face is covered, 0..1. */
  faceCover: number;
  faceHidden: boolean;
  /** Everything an onlooker would remember about the outfit. */
  look: string;
  /** Dressed like trouble (a balaclava). */
  sinister: boolean;
  /** Openly carrying a weapon, or covered in blood. */
  alarming: boolean;
  /** Something badly wrong close up: a face that isn't yours, a pair of hands. */
  grisly: boolean;
}

export function appearance(s: WorldState, a: Actor): Appearance {
  const item = (id?: Id | null) => (id ? s.items[id] : undefined);
  const outer = item(a.worn.outer), inner = item(a.worn.inner);
  const shirt = outer ?? inner;
  let role: Role = shirt ? defOf(shirt).role ?? "none" : "none";
  let authority = 0;
  for (const it of [outer, item(a.worn.head), item(a.worn.body), item(a.hand)]) {
    if (!it) continue;
    const d = defOf(it);
    if ((d.authority ?? 0) > authority) authority = d.authority!;
    // A hat or a body item can set the role when the shirt does not claim more authority.
    if (d.role && it !== shirt && (d.authority ?? 0) >= authority) role = d.role;
  }
  if (a.fb && !shirt) role = "footballer";
  const held = item(a.hand);
  let faceCover = 0, sinister = false, pieces = 0;
  const worn: string[] = [];
  for (const slot of ["outer", "head", "face", "body"] as const) {
    const it = item(a.worn[slot]);
    if (!it) continue;
    const d = defOf(it);
    worn.push(d.id);
    faceCover = Math.max(faceCover, d.faceCover ?? 0);
    if ((d.faceCover ?? 0) > 0) pieces++;
    if (d.props.includes("sinister")) sinister = true;
  }
  // A disguise is more than its best piece: a wig and a tache, a dress and a wig. Each extra piece
  // adds a quarter, but nothing short of a mask hides your face completely.
  if (faceCover < 1 && pieces > 1) faceCover = Math.min(0.95, faceCover + 0.25 * (pieces - 1));
  if (!a.worn.outer && inner) worn.push(defOf(inner).id);
  // Someone else's face: to anyone who doesn't look closely, you are them.
  const face = item(a.worn.face);
  const borrowed = face?.def === "face" && face.of ? face.of : null;
  const bloody = (a.effects.bloody ?? 0) > s.tick;
  return {
    faceCover, sinister, look: worn.sort().join("+"),
    team: shirt ? defOf(shirt).team ?? null : null,
    role,
    authority,
    faceId: borrowed ?? a.faceId,
    faceHidden: faceCover >= 1,
    alarming: (!!held && hasProp(held, "weapon")) || bloody,
    grisly: (!!borrowed && !DEADPAN.on) || (!!held && held.def === "hands"),
  };
}

const NEEDS: Record<Access, number> = { public: 0, ticket: 0, staff: 1, restricted: 2, pitch: 3 };

/** Would this actor look like they belong in this zone? */
export function looksPermitted(s: WorldState, a: Actor, z: Zone): boolean {
  const ap = appearance(s, a);
  if (z.roles && z.roles.length) return z.roles.includes(ap.role);
  if (z.access === "public") return true;
  if (z.access === "ticket") {
    return ap.authority >= 1 || [a.hand, ...a.pockets].some((i) => i && hasProp(s.items[i], "credential"));
  }
  return ap.authority >= NEEDS[z.access];
}
