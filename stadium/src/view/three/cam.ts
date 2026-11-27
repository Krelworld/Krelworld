// The fixed camera of the miniature: an orthographic view pitched down and turned a little, shared by
// the Three world and (through Projection) by everything Phaser still draws over it.
import * as THREE from "three";

export const PX_PER_M = 32;
const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const num = (k: string, d: number) => (q.has(k) && isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
/** Degrees below the horizontal. */
export const PITCH = (num("pitch", 38) * Math.PI) / 180;
/** The camera sits a little east of south, so south and east faces show. ?yaw=0 for square on. */
export const YAW = (num("yaw", 17) * Math.PI) / 180;
export const SP = Math.sin(PITCH), CP = Math.cos(PITCH), SY = Math.sin(YAW), CY = Math.cos(YAW);
/** Heights are modelled stretched by this, so a metre of wall covers the same 32 px as a metre of sprite. */
export const STRETCH = 1 / CP;

/** Three space: X east, Z south (the game's y), Y up (the game's z, stretched). */
export const VIEW = new THREE.Vector3(-SY * CP, -SP, -CY * CP).normalize();
export const RIGHT = new THREE.Vector3(CY, 0, -SY);
export const UP = new THREE.Vector3().crossVectors(RIGHT, VIEW).normalize();
/** "Up the screen" along the ground. */
export const FWD = new THREE.Vector3(-SY, 0, -CY);
/** Travelling direction of the light: a weak sun low-ish in the south-west behind cloud. */
export const LIGHT = new THREE.Vector3(0.42, -1.0, -0.6).normalize();

/** Is the 3D world asked for? (?3d=1, or the kd-3d switch; ?3d=0 forces it off.) */
export function want3D(): boolean {
  if (q.get("3d") === "0") return false;
  if (q.get("3d") === "1") return true;
  try { return localStorage.getItem("kd-3d") === "1"; } catch { return false; }
}
