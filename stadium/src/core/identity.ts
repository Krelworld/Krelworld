import { defOf, hasProp } from "./items";
import type { Access, Actor, Id, Role, WorldState, Zone } from "./types";

/** What an onlooker would take this actor to be. Clothing can lie; the face cannot. */
export interface Appearance {
  team: string | null;
  role: Role;
  authority: number;
  faceId: Id;
  faceHidden: boolean;
  /** Openly carrying a weapon. */
  alarming: boolean;
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
  return {
    team: shirt ? defOf(shirt).team ?? null : null,
    role,
    authority,
    faceId: a.faceId,
    faceHidden: !!a.worn.face,
    alarming: !!held && hasProp(held, "weapon"),
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
