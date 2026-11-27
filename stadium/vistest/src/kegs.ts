// Kegs: one instanced drum. Tap a loose one and it goes over on its rim and rolls a couple of metres.
import * as THREE from "three";
import { STRETCH, VIEW } from "./cfg";
import type { Box, KegSpec } from "./world";

const R = 0.215, HALF = 0.29 * STRETCH;
interface Keg { x: number; y: number; z: number; loose: boolean; on: number[]; mode: "still" | "tip" | "roll" | "hop"; dx: number; dz: number; v: number; vy: number; tip: number; roll: number; lying: boolean; yaw: number; wait: number }

export class Kegs {
  mesh: THREE.InstancedMesh; list: Keg[];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion(); private p = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private ax = new THREE.Vector3();
  constructor(specs: KegSpec[], geo: THREE.BufferGeometry, mat: THREE.Material, private colliders: Box[]) {
    this.list = specs.map((s, i) => ({ x: s.x, y: s.y * STRETCH, z: s.z, loose: s.loose, on: s.on ?? [], mode: "still", dx: 1, dz: 0, v: 0, vy: 0, tip: 0, roll: 0, lying: false, yaw: (i * 2.399) % 6.283, wait: 0 }));
    this.mesh = new THREE.InstancedMesh(geo, mat, this.list.length);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false; this.mesh.name = "kegs";
    const c = new THREE.Color();
    this.list.forEach((k, i) => { const g = 0.86 + ((i * 7919) % 13) / 90; this.mesh.setColorAt(i, c.setRGB(g, g, g * 1.02)); this.write(i); });
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** The keg under a ray from the camera, nearest first. `o` is any point on the ray. */
  pick(o: THREE.Vector3): number {
    let best = -1, bestD = Infinity;
    this.list.forEach((k, i) => {
      const cx = k.x - o.x, cy = k.y + (k.lying ? R : HALF) - o.y, cz = k.z - o.z, along = cx * VIEW.x + cy * VIEW.y + cz * VIEW.z;
      const px = cx - VIEW.x * along, py = cy - VIEW.y * along, pz = cz - VIEW.z * along, d = Math.hypot(px, py, pz);
      if (d < 0.42 && along < bestD) { bestD = along; best = i; }
    });
    return best;
  }

  /** Knock keg i away from (fromX, fromZ). */
  knock(i: number, fromX: number, fromZ: number) {
    const k = this.list[i]; if (!k || k.mode !== "still") return;
    if (!k.loose) { k.mode = "hop"; k.vy = 1.6; k.tip = 0; return; }
    let dx = k.x - fromX, dz = k.z - fromZ; const d = Math.hypot(dx, dz);
    if (d > 7 || d < 0.01) { const a = 0.4 + Math.random() * 1.2; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= d; dz /= d; }
    if (k.lying) { // already on its side: it can only go along the way it lies
      const s = dx * k.dx + dz * k.dz >= 0 ? 1 : -1; k.v = 3.0 * s; k.mode = "roll";
    } else { k.dx = dx; k.dz = dz; k.v = 3.1; k.tip = 0; k.mode = "tip"; k.vy = 0; }
    // anything standing on it comes down too
    this.list.forEach((o, j) => { if (o.on.includes(i) && o.mode === "still" && !o.lying && o.y > 0.1) { o.wait = 0.12; const a = Math.atan2(dz, dx) + 1.9; o.dx = Math.cos(a); o.dz = Math.sin(a); o.v = 2.2; o.tip = 0; o.mode = "tip"; o.vy = 0; o.on = []; void j; } });
    k.on = [];
  }

  /** Circles for the walker to bump into. */
  blockers(out: Box[]): void {
    for (const k of this.list) if (k.loose && k.y < 0.3) out.push({ x0: k.x - 0.12, z0: k.z - 0.12, x1: k.x + 0.12, z1: k.z + 0.12, h: 0.5 });
  }

  private blocked(x: number, z: number): boolean {
    for (const b of this.colliders) if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) return true;
    return false;
  }

  update(dt: number) {
    this.list.forEach((k, i) => {
      if (k.mode === "still") return;
      if (k.wait > 0) { k.wait -= dt; return; }
      if (k.mode === "hop") { k.vy -= 14 * dt; k.tip += k.vy * dt; if (k.tip <= 0) { k.tip = 0; k.mode = "still"; } this.write(i); return; }
      const step = (dist: number) => {
        const nx = k.x + k.dx * dist, nz = k.z + k.dz * dist;
        if (this.blocked(nx, nz)) { k.v *= -0.35; return 0; }
        k.x = nx; k.z = nz; return dist;
      };
      if (k.y > 0) { k.vy -= 12 * dt; k.y = Math.max(0, k.y + k.vy * dt); }
      if (k.mode === "tip") {
        k.tip = Math.min(1, k.tip + dt / 0.24); step(k.v * dt * 0.6);
        if (k.tip >= 1 && k.y <= 0) { k.mode = "roll"; k.lying = true; }
      } else {
        const moved = step(k.v * dt); k.roll += moved / R;
        const s = Math.sign(k.v); k.v -= s * 1.9 * dt;
        if (Math.sign(k.v) !== s || Math.abs(k.v) < 0.05) { k.v = 0; k.mode = "still"; }
      }
      this.write(i);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private write(i: number) {
    const k = this.list[i];
    const th = k.lying ? Math.PI / 2 : k.mode === "tip" ? (k.tip * k.tip * (3 - 2 * k.tip) * Math.PI) / 2 : 0;
    const cy = HALF * Math.cos(th) + R * Math.sin(th) + (k.mode === "hop" ? k.tip : 0);
    this.q.setFromAxisAngle(this.ax.set(0, 1, 0), k.yaw);
    if (th > 0) {
      this.q2.setFromAxisAngle(this.ax.set(k.dx, 0, k.dz), th); this.q.premultiply(this.q2);
      this.q2.setFromAxisAngle(this.ax.set(-k.dz, 0, k.dx), -k.roll); this.q.premultiply(this.q2);
    } else if (k.mode === "hop") { this.q2.setFromAxisAngle(this.ax.set(1, 0, 0), k.tip * 0.5); this.q.premultiply(this.q2); }
    // rotate about the middle of the drum, not its base
    this.p.set(0, -HALF, 0).applyQuaternion(this.q).add(this.ax.set(k.x, k.y + cy, k.z));
    this.m.compose(this.p, this.q, this.one);
    this.mesh.setMatrixAt(i, this.m);
  }
}
