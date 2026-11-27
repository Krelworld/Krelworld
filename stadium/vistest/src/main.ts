// Knockout Day: a visual feasibility test. One pub yard as an orthographic miniature, the game's
// own pixel sprites standing in it. No game here: a stick to walk, a dog that follows, kegs that roll.
import * as THREE from "three";
import { Actor, collide, dirOf, loadSheets, orangeShirt } from "./actors";
import { FWD, LIGHT, PITCH, PX_PER_M, RIGHT, STRETCH, UP, VIEW } from "./cfg";
import { Kegs } from "./kegs";
import { makeCanvas } from "./paint";
import { buildWorld, type Box } from "./world";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const DPR_CAP = Number(params.get("dpr")) || 2;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // soft in r18x: hardware PCF over a 5-tap disc
const HAZE = 0x9aa5ab;
renderer.setClearColor(HAZE);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(HAZE, 173, 250);
const camera = new THREE.OrthographicCamera(-6, 6, 10, -10, 1, 420);
scene.add(camera);

// Light: a grey sky doing most of the work, a weak sun giving the shadows a direction.
scene.add(new THREE.HemisphereLight(0xc4d2e2, 0x6e6258, 2.05));
const sun = new THREE.DirectionalLight(0xfff0dc, 1.95);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05; sun.shadow.radius = 2.2;
scene.add(sun, sun.target);

const world = buildWorld(renderer.capabilities.getMaxAnisotropy());
for (const m of world.meshes) scene.add(m);
const kegs = new Kegs(world.kegs, world.kegGeometry, world.lit, world.colliders);
scene.add(kegs.mesh);

// Rain: one full-screen quad, two layers of streaks, sliding.
const [rainCv, rc] = makeCanvas(256, 256);
{
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * 256), y = Math.floor(rnd() * 256), len = 10 + Math.floor(rnd() * 26), a = 0.25 + rnd() * 0.6; for (let k = 0; k < len; k++) { rc.fillStyle = `rgba(255,255,255,${a * Math.sin((k / len) * Math.PI)})`; rc.fillRect(x, (y + k) % 256, 1, 1); } }
}
const rainTex = new THREE.CanvasTexture(rainCv); rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping; rainTex.magFilter = THREE.NearestFilter; rainTex.minFilter = THREE.LinearFilter; rainTex.generateMipmaps = false;
const rainMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: rainTex }, time: { value: 0 }, scale: { value: 512 }, strength: { value: 0.5 } },
  vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
  fragmentShader: `uniform sampler2D map; uniform float time; uniform float scale; uniform float strength;
    void main(){ vec2 p = gl_FragCoord.xy / scale; p.x += p.y * 0.16;
      float a = texture2D(map, vec2(p.x, p.y + time * 2.6)).a * 0.55 + texture2D(map, vec2(p.x * 0.6 + 0.37, p.y * 0.5 + time * 1.7)).a * 0.4;
      gl_FragColor = vec4(0.84, 0.89, 0.94, a * strength); }`,
  transparent: true, depthTest: false, depthWrite: false,
});
const rain = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rainMat); rain.frustumCulled = false; rain.renderOrder = 999;
if (params.get("rain") !== "0") scene.add(rain);

// Soft blobs under feet (contact shadow; the proper shadow comes from the shadow map).
const blobMat = new THREE.MeshBasicMaterial({ map: world.glowTex, color: 0x05060a, transparent: true, opacity: 0.55, depthWrite: false });
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// HUD and stick.
const hud = document.getElementById("hud")!, stickBase = document.getElementById("stick")!, stickKnob = document.getElementById("knob")!;
let hudOn = params.get("hud") === "1"; hud.style.display = hudOn ? "block" : "none";

let viewW = 12, viewH = 20, dpr = 1, focusFrac = 0.06;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  const zoom = Math.max(1, Math.min(3, Math.round(Math.min(w, h) / 420))); // phones: 1 art px = 1 CSS px; bigger screens get whole multiples
  viewW = w / (PX_PER_M * zoom); viewH = h / (PX_PER_M * zoom);
  camera.left = -viewW / 2; camera.right = viewW / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2; camera.updateProjectionMatrix();
  focusFrac = w > h ? 0.08 : 0.06; // Grozz sits 56% down the screen (a touch lower in landscape, where there is less sky)
  rainMat.uniforms.scale.value = 256 * dpr * zoom;
  fitShadow();
}

// The shadow map covers exactly what the camera can see (ground to rooftops), and moves in whole texels so it doesn't crawl.
const lx = new THREE.Vector3(), ly = new THREE.Vector3(), lz = LIGHT.clone().negate();
lx.crossVectors(FWD, lz).normalize(); ly.crossVectors(lz, lx).normalize();
const sb = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
function fitShadow() {
  sb.minX = sb.minY = Infinity; sb.maxX = sb.maxY = -Infinity;
  const p = new THREE.Vector3();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const hgt of [0, 10.5 * STRETCH]) {
    // the point at height hgt seen at this corner of the screen, relative to the focus (which is ~1 m up)
    p.copy(RIGHT).multiplyScalar((sx * viewW) / 2).addScaledVector(UP, (sy * viewH) / 2);
    const t = (p.y + 1 - hgt) / -VIEW.y; p.addScaledVector(VIEW, t);
    sb.minX = Math.min(sb.minX, p.dot(lx)); sb.maxX = Math.max(sb.maxX, p.dot(lx)); sb.minY = Math.min(sb.minY, p.dot(ly)); sb.maxY = Math.max(sb.maxY, p.dot(ly));
  }
  const c = sun.shadow.camera; c.left = sb.minX - 1; c.right = sb.maxX + 1; c.bottom = sb.minY - 1; c.top = sb.maxY + 1; c.near = 1; c.far = 220; c.up.copy(FWD); c.updateProjectionMatrix();
}
const focus = new THREE.Vector3(), snapped = new THREE.Vector3();
function aimShadow() {
  const c = sun.shadow.camera, tx = (c.right - c.left) / 1024, ty = (c.top - c.bottom) / 1024;
  const fx = focus.dot(lx), fy = focus.dot(ly);
  snapped.copy(focus).addScaledVector(lx, Math.round(fx / tx) * tx - fx).addScaledVector(ly, Math.round(fy / ty) * ty - fy);
  sun.target.position.copy(snapped); sun.position.copy(snapped).addScaledVector(LIGHT, -110);
  sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
}

// Input.
const keys = new Set<string>();
addEventListener("keydown", (e) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault(); });
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
const stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
const taps = new Map<number, { x: number; y: number; t: number; moved: boolean }>();
const inStickZone = (x: number, y: number) => y > innerHeight * 0.55 && x < innerWidth * (innerWidth > innerHeight ? 0.45 : 0.62);
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture?.(e.pointerId);
  taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false });
  if (stick.id < 0 && e.pointerType !== "mouse" && inStickZone(e.clientX, e.clientY)) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; showStick(); }
  else if (stick.id < 0 && e.pointerType === "mouse" && inStickZone(e.clientX, e.clientY)) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; showStick(); }
});
canvas.addEventListener("pointermove", (e) => {
  const t = taps.get(e.pointerId); if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 9) t.moved = true;
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), M = 46;
  if (d > M) { dx *= M / d; dy *= M / d; }
  stick.x = d < 7 ? 0 : dx / M; stick.y = d < 7 ? 0 : dy / M;
  stickKnob.style.transform = `translate(${dx}px,${dy}px)`;
});
const up = (e: PointerEvent) => {
  const t = taps.get(e.pointerId); taps.delete(e.pointerId);
  if (e.pointerId === stick.id) { stick.id = -1; stick.x = stick.y = 0; hideStick(); }
  if (t && !t.moved && performance.now() - t.t < 350) tap(e.clientX, e.clientY);
};
canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
function showStick() { stickBase.style.left = `${stick.ox - 56}px`; stickBase.style.top = `${stick.oy - 56}px`; stickBase.style.bottom = "auto"; stickBase.style.opacity = "0.9"; stickKnob.style.transform = "translate(0,0)"; }
function hideStick() { stickBase.style.left = "26px"; stickBase.style.top = "auto"; stickBase.style.bottom = "34px"; stickBase.style.opacity = "0.4"; stickKnob.style.transform = "translate(0,0)"; }
function tap(cx: number, cy: number) {
  if (cx > innerWidth - 72 && cy < 72) { hudOn = !hudOn; hud.style.display = hudOn ? "block" : "none"; showHud(); return; }
  // a point on the ray through this pixel
  const o = camera.position.clone().addScaledVector(RIGHT, (cx / innerWidth - 0.5) * viewW).addScaledVector(UP, (0.5 - cy / innerHeight) * viewH);
  const i = kegs.pick(o);
  if (i >= 0) kegs.knock(i, grozz.x, grozz.z);
}

// Cast.
let grozz!: Actor, ronson!: Actor;
const cast: Actor[] = [];
let oldboy: Actor | null = null;
let blobs: THREE.InstancedMesh | null = null;
const START = { x: -2.2, z: 2.9 };

async function loadCast() {
  const [g, r, dray, big, lad, woman, old] = await Promise.all([
    loadSheets("grozzhd", ["rot", "walk", "idle"]), loadSheets("ronson", ["rot", "walk", "run"]), loadSheets("fan", ["rot", "idle"], orangeShirt),
    loadSheets("bigman", ["rot", "drink"]), loadSheets("lad", ["rot", "chat"]), loadSheets("woman", ["rot", "chat"]), loadSheets("oldboy", ["rot", "walk"]),
  ]);
  grozz = new Actor(g).place(START.x, START.z, 0); grozz.anim = "idle"; grozz.fps = 5;
  if (params.get("xray") !== "0") grozz.seeThrough();
  ronson = new Actor(r).place(START.x + 1.45, START.z - 0.3, 0);
  const drayman = new Actor(dray).place(2.3, 1.35, 6); drayman.anim = "idle"; drayman.fps = 5;
  const drinker = new Actor(big).place(-4.7, 3.35, 1); drinker.anim = "drink"; drinker.fps = 4;
  const l = new Actor(lad).place(2.45, 5.0, 2); l.anim = "chat"; l.fps = 6;
  const w = new Actor(woman).place(3.2, 5.35, 6); w.anim = "chat"; w.fps = 5;
  oldboy = new Actor(old).place(-3, -11.6, 2); oldboy.anim = "walk"; oldboy.fps = 7;
  cast.push(grozz, ronson, drayman, drinker, l, w, oldboy);
  for (const a of cast) { a.y = world.groundY(a.x, a.z); scene.add(a.mesh); }
  blobs = new THREE.InstancedMesh(blobGeo, blobMat, cast.length); blobs.frustumCulled = false; blobs.renderOrder = 2; scene.add(blobs);
}

const showHud = () => { if (hudOn) hud.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000).toFixed(1)}k tris`; };

// The loop.
const dynBoxes: Box[] = [];
const trail: { x: number; z: number }[] = [];
let last = performance.now(), fpsT = performance.now(), fpsN = 0, fps = 0, time = 0, oldDir = 1;
const m4 = new THREE.Matrix4(), look = new THREE.Vector3();
let faceX = 0, faceZ = 1;

function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  // walk
  let ix = stick.x, iy = stick.y;
  if (keys.has("a") || keys.has("arrowleft")) ix -= 1; if (keys.has("d") || keys.has("arrowright")) ix += 1;
  if (keys.has("w") || keys.has("arrowup")) iy -= 1; if (keys.has("s") || keys.has("arrowdown")) iy += 1;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  if (grozz) {
    const SPEED = 5.2, vx = (RIGHT.x * ix - FWD.x * iy) * SPEED, vz = (RIGHT.z * ix - FWD.z * iy) * SPEED;
    dynBoxes.length = 0; kegs.blockers(dynBoxes);
    if (il > 0.05) {
      let [nx, nz] = collide(grozz.x + vx * dt, grozz.z + vz * dt, 0.32, world.colliders);
      [nx, nz] = collide(nx, nz, 0.32, dynBoxes);
      grozz.x = nx; grozz.z = nz; grozz.dir = dirOf(vx, vz); faceX = vx / SPEED; faceZ = vz / SPEED;
      grozz.anim = "walk"; grozz.fps = 6 + 9 * Math.min(1, il);
    } else { grozz.anim = "idle"; grozz.fps = 5; }
    grozz.y += (world.groundY(grozz.x, grozz.z) - grozz.y) * Math.min(1, dt * 18);
    // Ronson follows in Grozz's footsteps, a pace and a half behind (the trail is known to be walkable)
    const tl = trail[trail.length - 1];
    if (!tl || Math.hypot(grozz.x - tl.x, grozz.z - tl.z) > 0.2) { trail.push({ x: grozz.x, z: grozz.z }); if (trail.length > 60) trail.shift(); }
    let tx = ronson.x, tz = ronson.z, acc = 0;
    for (let i = trail.length - 1; i > 0; i--) { acc += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z); if (acc >= 1.9) { const sx = trail[i].x - trail[i - 1].x, sz = trail[i].z - trail[i - 1].z, sl = Math.hypot(sx, sz) || 1; tx = trail[i - 1].x - (sz / sl) * 0.6; tz = trail[i - 1].z + (sx / sl) * 0.6; break; } }
    const ddx = tx - ronson.x, ddz = tz - ronson.z, dd = Math.hypot(ddx, ddz);
    if (dd > 0.3) {
      const sp = Math.min(6.4, 1.2 + dd * 3.2), st = Math.min(dd, sp * dt);
      const [rx, rz] = collide(ronson.x + (ddx / dd) * st, ronson.z + (ddz / dd) * st, 0.28, world.colliders);
      ronson.x = rx; ronson.z = rz; ronson.dir = dirOf(ddx, ddz); ronson.anim = sp > 3.4 ? "run" : "walk"; ronson.fps = sp > 3.4 ? 14 : 9;
    } else if (ronson.anim !== "rot") { ronson.anim = "rot"; ronson.dir = dirOf(grozz.x - ronson.x, grozz.z - ronson.z + 0.01); }
    ronson.y = world.groundY(ronson.x, ronson.z);
    // the old boy walks the far pavement, there and back, all afternoon
    if (oldboy) { oldboy.x += oldDir * 1.05 * dt; if (oldboy.x > 0.6) oldDir = -1; if (oldboy.x < -9.4) oldDir = 1; oldboy.dir = dirOf(oldDir, 0); }
    for (const a of cast) a.update(dt, world.shaders);
    if (blobs) { cast.forEach((a, i) => { const dog = a === ronson; m4.makeScale(dog ? 1.05 : 0.95, 1, dog ? 0.6 : 0.5).setPosition(a.x + 0.03, a.y + 0.025, a.z + 0.02); blobs!.setMatrixAt(i, m4); }); blobs.instanceMatrix.needsUpdate = true; }
    // camera
    look.set(grozz.x, grozz.y + 1.15, grozz.z).addScaledVector(UP, focusFrac * viewH);
    if (focus.lengthSq() === 0) focus.copy(look); else focus.lerp(look, Math.min(1, dt * 9));
  }
  kegs.update(dt);
  // snap the camera to whole device pixels so nearest-filtered texels don't shimmer
  const px = viewW / (innerWidth * dpr), fr = focus.dot(RIGHT), fu = focus.dot(UP);
  camera.position.copy(focus).addScaledVector(RIGHT, Math.round(fr / px) * px - fr).addScaledVector(UP, Math.round(fu / px) * px - fu).addScaledVector(VIEW, -170);
  camera.lookAt(look.copy(camera.position).add(VIEW)); camera.updateMatrixWorld();
  aimShadow();
  rainMat.uniforms.time.value = time;
  renderer.render(scene, camera);
  fpsN++;
  if (now - fpsT >= 500) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; showHud(); }
  requestAnimationFrame(tick);
}

addEventListener("resize", resize);
resize(); hideStick();
focus.set(START.x, 1.15, START.z).addScaledVector(UP, focusFrac * viewH);
loadCast().catch((e) => console.error("sprites failed to load", e)).finally(() => { (window as any).__vis.ready = true; });
requestAnimationFrame(tick);

// For screenshots and automated checks.
(window as any).__vis = {
  ready: false,
  info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, fps, staticTris: world.stats.tris, atlasUsed: world.stats.atlas, dpr, viewW, viewH }),
  pos: () => (grozz ? { x: grozz.x, z: grozz.z } : null),
  teleport: (x: number, z: number, dir = 0) => { grozz.x = x; grozz.z = z; grozz.dir = dir; faceX = 0; faceZ = 1; ronson.x = x + 1.1; ronson.z = z + 0.4; trail.length = 0; focus.set(0, 0, 0); },
  knock: (i: number) => kegs.knock(i, grozz.x, grozz.z),
  kegs: () => kegs.list.map((k, i) => ({ i, x: k.x, z: k.z, y: k.y, loose: k.loose, mode: k.mode })).filter((k) => k.loose),
  screenOf: (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; },
  pitch: PITCH,
};
