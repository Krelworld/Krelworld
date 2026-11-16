import Phaser from "phaser";
import { G } from "../G";
import type { GameState } from "../../data/types";
import { FART_BLASTER, GUNS, GUN_ORDER, GUN_POWER, type GunDef } from "../../data/guns";
import { firstLoaded, gunMaxFor, gunUsable, nextLoaded, orderedGuns } from "../systems/armoury";

export { FART_BLASTER, GUNS, GUN_ORDER, GUN_POWER, type GunDef };

/** The first gun in your weapon order (gun rack; strongest first by default) that still has ammo, or null (Fart Blaster). */
export function bestLoadedGun(s: GameState = G.s, except?: string): string | null {
  return firstLoaded(s, except);
}

/**
 * Never sit on the Fart Blaster while any gun has ammo, unless the player picked it on purpose this room.
 * Returns true if it armed something.
 */
export function ensureArmed(s: GameState = G.s): boolean {
  if (G.rt.fartByChoice) return false;
  if (s.gun && (s.guns?.[s.gun] ?? 0) > 0 && gunUsable(s.gun, s)) return false;
  const id = bestLoadedGun(s);
  if (!id) return false;
  s.gun = id;
  return true;
}

/** Arm the first gun in your order you have ammo for. Returns its id (or null for the Fart Blaster). */
export function equipBest(s: GameState = G.s): string | null {
  const id = bestLoadedGun(s);
  s.gun = id ?? undefined;
  return id;
}

/** Max ammo after the Bigger Pockets perk. */
export function gunMax(g: GunDef, s: GameState = G.s): number {
  return gunMaxFor(g, s);
}

export function ownedGuns(s: GameState = G.s): string[] {
  return GUN_ORDER.filter((id) => s.guns && id in s.guns && gunUsable(id, s));
}

export function currentGun(s: GameState = G.s): GunDef | null {
  return s.gun && s.guns && s.gun in s.guns && gunUsable(s.gun, s) ? GUNS[s.gun] : null;
}

/** Out of ammo in `from`: the next gun along in your weapon order that still has ammo, or null. */
export function nextLoadedGun(s: GameState = G.s, from?: string): string | null {
  return nextLoaded(s, from);
}

/** Cycle through loaded guns in your weapon order -> Fart Blaster -> first again. Returns the new label. */
export function cycleGun(s: GameState = G.s): string {
  const list: (string | null)[] = [...orderedGuns(s).filter((id) => (s.guns![id] ?? 0) > 0), null];
  const i = list.indexOf(s.gun ?? null);
  s.gun = list[(i + 1) % list.length] ?? undefined;
  // swapping to the Fart Blaster on purpose is respected (until you leave the room); otherwise it never sticks
  G.rt.fartByChoice = !s.gun;
  return s.gun ? GUNS[s.gun].name : FART_BLASTER.name;
}

/** Give a gun the player doesn't have yet (or ammo if they have them all). */
export function rollCrate(s: GameState = G.s): { gun?: GunDef; ammoFor?: GunDef; amount: number } {
  s.guns = s.guns ?? {};
  const missing = GUN_ORDER.filter((id) => !(id in s.guns!) && !GUNS[id].shop && !GUNS[id].kreddle && GUNS[id].minChapter <= s.chapter);
  if (missing.length) {
    // first ever crate is always the pistol
    const id = !ownedGuns(s).length ? "pistol" : missing[Math.floor(Math.random() * missing.length)];
    const g = GUNS[id];
    s.guns[id] = g.pickup * 2;
    s.gun = id;
    return { gun: g, amount: g.pickup * 2 };
  }
  const a = giveAmmo(s, 2);
  return { ammoFor: a?.gun, amount: a?.amount ?? 0 };
}

/** Ammo for a random owned gun (biased to the one in hand). `mult` scales the amount. */
export function giveAmmo(s: GameState = G.s, mult = 1): { gun: GunDef; amount: number } | null {
  const owned = ownedGuns(s).filter((id) => s.guns![id] < gunMax(GUNS[id], s));
  if (!owned.length) return null;
  // goes to whatever is emptiest (so a dry favourite gets fed), with a nudge towards the one in hand
  const frac = (id: string) => s.guns![id] / gunMax(GUNS[id], s) - (id === s.gun ? 0.15 : 0);
  const id = [...owned].sort((a, b) => frac(a) - frac(b))[0];
  const g = GUNS[id];
  const amount = Math.max(1, Math.round(g.pickup * mult));
  const wasEmpty = (s.guns![id] ?? 0) <= 0;
  s.guns![id] = Math.min(gunMax(g, s), s.guns![id] + amount);
  // picked up ammo for something higher up your weapon order than what's in hand: arm it
  if (wasEmpty || !s.gun) {
    const order = orderedGuns(s);
    const cur = s.gun ? order.indexOf(s.gun) : 99;
    if (order.indexOf(id) < cur) s.gun = id;
  }
  return { gun: g, amount };
}

/** Scale an image so its longest side is `px` world pixels. */
export function fitTo(img: Phaser.GameObjects.Image, px: number) {
  const f = img.frame;
  img.setDisplaySize((f.width / Math.max(f.width, f.height)) * px, (f.height / Math.max(f.width, f.height)) * px);
  return img;
}
