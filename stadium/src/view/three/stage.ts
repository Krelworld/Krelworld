// The stage: a Three canvas under Phaser's (which goes see-through), one camera for both, one light.
// Three draws the ground, the buildings and, through the sprite bridge, everyone and everything that
// stands in the world; Phaser keeps what floats above it (speech, rings, boards, markers).
import * as THREE from "three";
import { SpriteBridge, handleOf, subImage, type Pic, type PicOpts } from "./bridge";
import { CY, FWD, LIGHT, PITCH, PX_PER_M, RIGHT, SP, STRETCH, SY, UP, VIEW, YAW } from "./cam";
import { Paint3D, type PaintOpts } from "./gfx";
import { makeCanvas } from "./paint";
import { Vehicles } from "./vehicles";
import { CHUNK_M, CHUNK_PX, paintChunk, type GroundSpec } from "./ground";
import { World3D, type WorldHost } from "./world3d";

const HAZE = 0x9aa5ab, S = PX_PER_M;

export interface Frame {
  /** Phaser's camera: the middle of the view in its world pixels, the canvas size and zoom. */
  midX: number; midY: number; width: number; height: number; zoom: number;
  room: string | null; inside: boolean; outdoors: boolean; time: number;
  gateOpen: (id: string) => boolean;
}

export class Stage3D {
  canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.OrthographicCamera;
  bridge = new SpriteBridge(); world: World3D | null = null; vehicles: Vehicles;
  /** The scene's flat-colour marks (rings, pools, hats, smoke), drawn in the world instead of over it. */
  private paints: { p: Paint3D; auto: boolean }[] = [];
  /** Frames a second, smoothed; and how many frames have been timed (the first few seconds decide whether this device can afford 3D). */
  fps = 60; frames = 0; private lastT = 0; private slowMs = 0; private timedMs = 0;
  private hud: HTMLDivElement | null = null; private hudAt = 0;
  /** The ground from a long way up (sat watching the match, or the whole-pitch view): its tiles at a half or a quarter of
   *  the size on one sheet, one draw call, instead of forty to a hundred full-size tiles. */
  private far: { tex: THREE.FramebufferTexture; handle: WebGLTexture; mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; slot: Map<string, { i: number; t: number }>; scratch: HTMLCanvasElement; sctx: CanvasRenderingContext2D; used: number; cell: number; tick: number } | null = null;
  private farOn = false;
  /** Off while something else has the whole screen (first person, the cab, the drain): nothing is drawn. */
  active = true;
  private sun: THREE.DirectionalLight; private rain: THREE.Mesh; private rainMat: THREE.ShaderMaterial;
  private blobs: THREE.InstancedMesh; private blobN = 0; private m4 = new THREE.Matrix4();
  private vig: HTMLDivElement; private haze: HTMLDivElement;
  private viewW = 12; private viewH = 20; private dpr = 1;
  private lx = new THREE.Vector3(); private ly = new THREE.Vector3();
  private focus = new THREE.Vector3(); private tmp = new THREE.Vector3();
  private ballTex: HTMLCanvasElement;
  pitch = PITCH; yaw = YAW;

  constructor(private host: HTMLElement) {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance", stencil: false });
    if (!gl) throw new Error("no webgl2");
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false, stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.setClearColor(0x15171c);
    Object.assign(canvas.style, { position: "absolute", inset: "0", zIndex: "0", imageRendering: "auto" });
    canvas.id = "world3d";
    host.insertBefore(canvas, host.firstChild);
    // Vignette, and a breath of haze along the top (outdoors only): both just CSS over the canvases.
    const mk = (css: string) => { const d = document.createElement("div"); Object.assign(d.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "2", background: css, transition: "opacity .4s" }); host.appendChild(d); return d; };
    this.vig = mk("radial-gradient(ellipse 85% 75% at 50% 50%, rgba(8,10,16,0) 52%, rgba(8,10,16,0.3) 86%, rgba(8,10,16,0.5) 100%), linear-gradient(to top, rgba(8,10,16,0.3) 0%, rgba(8,10,16,0) 16%)");
    this.haze = mk("linear-gradient(to bottom, rgba(154,165,171,0.24) 0%, rgba(154,165,171,0) 13%)");

    this.scene.fog = new THREE.Fog(HAZE, 173, 250);
    this.camera = new THREE.OrthographicCamera(-6, 6, 10, -10, 1, 420);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xc4d2e2, 0x6e6258, 2.05));
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.95);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 2.2;
    this.scene.add(this.sun, this.sun.target);
    const lz = LIGHT.clone().negate(); this.lx.crossVectors(FWD, lz).normalize(); this.ly.crossVectors(lz, this.lx).normalize();
    this.scene.add(this.bridge.group);
    this.bridge.renderer = r;
    this.vehicles = new Vehicles(r.capabilities.getMaxAnisotropy());
    this.scene.add(this.vehicles.group);
    if (new URLSearchParams(location.search).get("hud3d") === "1") {
      this.hud = document.createElement("div");
      Object.assign(this.hud.style, { position: "absolute", left: "6px", bottom: "6px", zIndex: "50", font: "10px/1.35 ui-monospace, Menlo, monospace", color: "#d8f0d0", background: "rgba(8,10,14,0.72)", padding: "4px 6px", borderRadius: "4px", pointerEvents: "none", whiteSpace: "pre" });
      host.appendChild(this.hud);
    }

    // Rain: one full-screen quad, two layers of streaks, sliding.
    const [rainCv, rc] = makeCanvas(256, 256);
    { let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * 256), y = Math.floor(rnd() * 256), len = 10 + Math.floor(rnd() * 26), a = 0.25 + rnd() * 0.6; for (let k = 0; k < len; k++) { rc.fillStyle = `rgba(255,255,255,${a * Math.sin((k / len) * Math.PI)})`; rc.fillRect(x, (y + k) % 256, 1, 1); } } }
    const rainTex = new THREE.CanvasTexture(rainCv); rainTex.wrapS = rainTex.wrapT = THREE.RepeatWrapping; rainTex.magFilter = THREE.NearestFilter; rainTex.minFilter = THREE.LinearFilter; rainTex.generateMipmaps = false;
    this.rainMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: rainTex }, time: { value: 0 }, scale: { value: 512 }, strength: { value: 0.5 } },
      vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: `uniform sampler2D map; uniform float time; uniform float scale; uniform float strength;
        void main(){ vec2 p = gl_FragCoord.xy / scale; p.x += p.y * 0.16;
          float a = texture2D(map, vec2(p.x, p.y + time * 2.6)).a * 0.55 + texture2D(map, vec2(p.x * 0.6 + 0.37, p.y * 0.5 + time * 1.7)).a * 0.4;
          gl_FragColor = vec4(0.84, 0.89, 0.94, a * strength); }`,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.rain = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.rainMat); this.rain.frustumCulled = false; this.rain.renderOrder = 999;
    this.scene.add(this.rain);

    // Soft blobs under feet (the contact shadow; the cast shadow comes from the shadow map).
    const [bc, bx] = makeCanvas(64, 64);
    { const gr = bx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.42)"); gr.addColorStop(1, "rgba(255,255,255,0)"); bx.fillStyle = gr; bx.fillRect(0, 0, 64, 64); }
    const blobTex = new THREE.CanvasTexture(bc);
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x05060a, transparent: true, opacity: 0.55, depthWrite: false }), 400);
    this.blobs.frustumCulled = false; this.blobs.renderOrder = 2; this.blobs.count = 0; this.scene.add(this.blobs);

    // The ball: a little painted disc that stands up like everyone else.
    const [ballCv, bb] = makeCanvas(12, 12);
    bb.fillStyle = "#15171a"; bb.beginPath(); bb.arc(6, 6, 5.6, 0, 7); bb.fill(); bb.fillStyle = "#f4f4f0"; bb.beginPath(); bb.arc(6, 6, 4.6, 0, 7); bb.fill();
    bb.fillStyle = "#22252a"; bb.fillRect(5, 5, 3, 3); bb.fillRect(2, 3, 2, 2); bb.fillRect(9, 4, 1, 2); bb.fillRect(4, 9, 2, 1); bb.fillStyle = "#ffffff"; bb.fillRect(4, 2, 2, 1);
    this.ballTex = ballCv;
    r.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
    r.domElement.addEventListener("webglcontextrestored", () => { this.bridge.reset(); this.farDrop(); this.first = true; });
  }

  /** A layer of flat-colour marks in the world. `auto`: wiped at the start of every frame (else its owner clears it). */
  paint(o: PaintOpts & { auto?: boolean } = {}): Paint3D { const p = new Paint3D(o); this.paints.push({ p, auto: !!o.auto }); this.scene.add(p.mesh); return p; }
  /** The top of a frame, before the scene draws anything. */
  startFrame() { this.vehicles.begin(); for (const q of this.paints) if (q.auto) q.p.clear(); }
  /** Show or hide the whole 3D picture (hidden: nothing is drawn, the card rests). */
  setActive(on: boolean) { if (on === this.active) return; this.active = on; this.canvas.style.visibility = on ? "visible" : "hidden"; this.vig.style.visibility = this.haze.style.visibility = on ? "visible" : "hidden"; }

  /** (Re)build the district: at the start, and whenever the venue changes. */
  build(host: Omit<WorldHost, "maxAniso">) {
    this.world?.dispose(); this.farDrop();
    this.world = new World3D({ ...host, maxAniso: this.renderer.capabilities.getMaxAnisotropy() });
    this.scene.add(this.world.root);
  }

  begin() { this.bridge.begin(); this.blobN = 0; }
  sprite(o: Pic, opt?: PicOpts) { this.bridge.sprite(o, opt); }
  /** A soft dark blob on the ground under something. */
  blob(x: number, y: number, w: number, d: number) {
    if (this.blobN >= 400) return;
    this.m4.makeRotationY(this.yaw).scale(this.tmp.set(w, 1, d)).setPosition(x + 0.03, 0.025, y + 0.02);
    this.blobs.setMatrixAt(this.blobN++, this.m4);
  }
  ball(x: number, y: number, z: number) { this.bridge.upright(this.ballTex, x, y, z, 0.3, 0.3 * STRETCH / STRETCH); this.blob(x, y, 0.45 + z * 0.05, 0.3); }

  /** In shade? A ray toward the sun against the big boxes. */
  shaded(x: number, y: number): boolean {
    const w = this.world; if (!w) return false;
    const dx = -LIGHT.x, dy = -LIGHT.y / STRETCH, dz = -LIGHT.z;
    for (const [x0, z0, x1, z1, h] of w.shaders) {
      let t0 = 0, t1 = 60;
      const slab = (o: number, d: number, lo: number, hi: number) => { if (Math.abs(d) < 1e-6) return o >= lo && o <= hi; let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, c); return t0 <= t1; };
      if (slab(x, dx, x0, x1) && slab(1.2, dy, 0, h) && slab(y, dz, z0, z1) && t1 > 0.05) return true;
    }
    return false;
  }

  private fit(f: Frame) {
    const w = f.width, h = f.height, r = this.renderer;
    const cssW = this.host.clientWidth || 1, cssH = this.host.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.getPixelRatio() !== dpr || this.canvas.width !== Math.round(cssW * dpr) || this.canvas.height !== Math.round(cssH * dpr)) { r.setPixelRatio(dpr); r.setSize(cssW, cssH, false); }
    this.dpr = dpr;
    const vw = w / (f.zoom * S), vh = h / (f.zoom * S);
    if (vw !== this.viewW || vh !== this.viewH || this.camera.right !== vw / 2) {
      this.viewW = vw; this.viewH = vh;
      const c = this.camera; c.left = -vw / 2; c.right = vw / 2; c.top = vh / 2; c.bottom = -vh / 2; c.updateProjectionMatrix();
      // The shadow map covers what the camera can see (ground to rooftops), no more.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; const p = this.tmp;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const hgt of [0, 11.5 * STRETCH]) {
        p.copy(RIGHT).multiplyScalar((sx * vw) / 2).addScaledVector(UP, (sy * vh) / 2);
        const t = (p.y - hgt) / -VIEW.y; p.addScaledVector(VIEW, t);
        minX = Math.min(minX, p.dot(this.lx)); maxX = Math.max(maxX, p.dot(this.lx)); minY = Math.min(minY, p.dot(this.ly)); maxY = Math.max(maxY, p.dot(this.ly));
      }
      const sc = this.sun.shadow.camera; sc.left = minX - 1; sc.right = maxX + 1; sc.bottom = minY - 1; sc.top = maxY + 1; sc.near = 1; sc.far = 260; sc.up.copy(FWD); sc.updateProjectionMatrix();
    }
    this.rainMat.uniforms.scale.value = 256 * dpr * Math.max(1, f.zoom / (window.devicePixelRatio || 1));
  }

  /** Draw the frame: the camera goes where Phaser's is. */
  render(f: Frame) {
    const now = performance.now();
    if (this.lastT) { const dt = Math.min(250, now - this.lastT); this.fps += (1000 / Math.max(1, dt) - this.fps) * 0.08; if (this.active && document.visibilityState === "visible") { this.frames++; this.timedMs += dt; if (dt > 50) this.slowMs += dt; } }
    this.lastT = now;
    if (!this.active) { this.bridge.end(); this.vehicles.end(); return; }
    this.fit(f);
    this.bridge.end(); this.vehicles.end();
    for (const q of this.paints) q.p.flush();
    this.blobs.count = this.blobN; this.blobs.instanceMatrix.needsUpdate = true;
    // The ground point in the middle of the screen.
    const u = f.midX / S, w = f.midY / (S * SP), gx = CY * u + SY * w, gz = -SY * u + CY * w;
    this.focus.set(gx, 0, gz);
    const cam = this.camera;
    cam.position.copy(this.focus).addScaledVector(VIEW, -170);
    cam.lookAt(this.tmp.copy(cam.position).add(VIEW)); cam.updateMatrixWorld();
    // The light follows, in whole texels so shadow edges don't crawl.
    const sc = this.sun.shadow.camera, tx = (sc.right - sc.left) / 1024, ty = (sc.top - sc.bottom) / 1024, fx = this.focus.dot(this.lx), fy = this.focus.dot(this.ly);
    this.tmp.copy(this.focus).addScaledVector(this.lx, Math.round(fx / tx) * tx - fx).addScaledVector(this.ly, Math.round(fy / ty) * ty - fy);
    this.sun.target.position.copy(this.tmp); this.sun.position.copy(this.tmp).addScaledVector(LIGHT, -120);
    this.sun.target.updateMatrixWorld(); this.sun.updateMatrixWorld();
    if (this.world) {
      this.world.setCut(f.room, f.inside, f.gateOpen);
      // What the camera sees of the ground: the screen's corners dropped on to it (and a margin).
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const uu = u + (sx * this.viewW) / 2, ww = w + (sy * this.viewH) / 2 / SP, x = CY * uu + SY * ww, z = -SY * uu + CY * ww; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      // Far enough out that a tile's pixels are smaller than the screen's: the small copies will do.
      // (Sat watching the match, a tile is drawn at about two thirds of its size: half-size copies. The whole-pitch view: quarter-size.)
      const pxm = (this.canvas.width || 1) / this.viewW, lod = pxm < 15.5 ? 128 : pxm < 26 ? 256 : 0;
      this.farOn = lod > 0 && this.farGround(x0 - 3, z0 - 3, x1 + 3, z1 + 3, this.first ? 99 : 3, lod);
      if (this.farOn) this.world.ground(this.focus.x, this.focus.z, this.focus.x, this.focus.z, 0); // (nothing new; lets the big tiles nobody is looking at go)
      else { this.world.ground(x0 - 4, z0 - 4, x1 + 4, z1 + 4, this.first ? 99 : 2); this.farShow(false); }
      this.first = false;
    }
    this.rain.visible = f.outdoors; this.rainMat.uniforms.time.value = f.time;
    this.haze.style.opacity = f.outdoors ? "1" : "0"; this.vig.style.opacity = f.room ? "0.6" : "1";
    this.renderer.render(this.scene, cam);
    if (this.hud && now - this.hudAt > 500) {
      this.hudAt = now; const i = this.info();
      this.hud.textContent = `${this.fps.toFixed(0)} fps  dpr ${i.dpr}\ncalls ${i.calls}  tris ${i.triangles}\ntex ${i.textures}  ${i.texMB.toFixed(0)} MB\nsprites ${i.sprites}/${i.spriteBatches}  cells ${i.cells}`;
    }
  }
  private first = true;

  private static FAR_SIZE = 2048;
  /** Make sure the small ground covers the rectangle, each tile `C` pixels across; says whether it can be used at all. */
  private farGround(x0: number, z0: number, x1: number, z1: number, budget: number, C: number): boolean {
    const w = this.world!, spec = (w as unknown as { spec?: GroundSpec }).spec, SZ = Stage3D.FAR_SIZE, per = Math.floor(SZ / (C + 2));
    if (!spec || !spec.areas) return false;
    let f = this.far;
    if (f && f.cell !== C) { this.farDrop(); f = null; }
    if (!f) {
      const tex = new THREE.FramebufferTexture(SZ, SZ); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.flipY = false;
      const handle = handleOf(this.renderer, tex); if (!handle) return false;
      const mat = new THREE.MeshLambertMaterial({ map: tex }), mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.name = "ground-far"; this.scene.add(mesh);
      const scratch = document.createElement("canvas"); scratch.width = scratch.height = C + 2;
      const sctx = scratch.getContext("2d")!; sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = "high";
      f = this.far = { tex, handle, mesh, mat, slot: new Map(), scratch, sctx, used: 0, cell: C, tick: 0 };
    }
    f.used = performance.now(); f.tick++;
    const c0x = Math.floor(x0 / CHUNK_M), c1x = Math.floor(x1 / CHUNK_M), c0z = Math.floor(z0 / CHUNK_M), c1z = Math.floor(z1 / CHUNK_M);
    let changed = false;
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      const key = `${cx},${cz}`, had = f.slot.get(key);
      if (had) { had.t = f.tick; continue; }
      if (budget <= 0) continue;
      let i = f.slot.size;
      if (i >= per * per) {
        // The sheet is full: the tile looked at longest ago gives up its place.
        let old: string | null = null, ot = f.tick - 30;
        for (const [k, q] of f.slot) if (q.t < ot) { ot = q.t; old = k; }
        if (!old) continue;
        i = f.slot.get(old)!.i; f.slot.delete(old);
      }
      budget--;
      const sx = (i % per) * (C + 2), sy = Math.floor(i / per) * (C + 2), cv = paintChunk(spec, cx, cz), g = f.sctx;
      // Scaled down, with its edge smeared a pixel outward so neighbours on the sheet don't bleed in.
      g.drawImage(cv, 0, 0, CHUNK_PX, CHUNK_PX, 0, 0, C + 2, C + 2); g.drawImage(cv, 0, 0, CHUNK_PX, CHUNK_PX, 1, 1, C, C);
      subImage(this.renderer, f.handle, sx, sy, f.scratch);
      cv.width = cv.height = 0;
      f.slot.set(key, { i, t: f.tick }); changed = true;
    }
    if (changed) {
      const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
      for (const [key, q] of f.slot) {
        const [cx, cz] = key.split(",").map(Number), X0 = cx * CHUNK_M, Z0 = cz * CHUNK_M, X1 = X0 + CHUNK_M, Z1 = Z0 + CHUNK_M, i = q.i;
        const u0 = ((i % per) * (C + 2) + 1) / SZ, v0 = (Math.floor(i / per) * (C + 2) + 1) / SZ, u1 = u0 + C / SZ, v1 = v0 + C / SZ, k = pos.length / 3;
        pos.push(X0, 0, Z1, X1, 0, Z1, X1, 0, Z0, X0, 0, Z0); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); uv.push(u0, v1, u1, v1, u1, v0, u0, v0); idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      f.mesh.geometry.dispose(); f.mesh.geometry = geo;
    }
    this.farShow(true);
    return true;
  }
  /** Swap between the small ground and the full-size tiles (a full-size tile stays up until its small copy exists). */
  private farShow(on: boolean): void {
    const f = this.far, w = this.world;
    if (f) f.mesh.visible = on;
    if (w) for (const m of w.root.children) {
      if (m.name !== "ground") continue;
      const p = (m as THREE.Mesh).geometry?.getAttribute("position");
      m.visible = !on || !f || !p || !f.slot.has(`${Math.round(p.getX(0) / CHUNK_M)},${Math.round(p.getZ(3) / CHUNK_M)}`);
    }
    // Not looked at for a while: give the sheet back.
    if (f && !on && performance.now() - f.used > 30000) this.farDrop();
  }
  private farDrop(): void { const f = this.far; if (!f) return; this.scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mat.dispose(); f.tex.dispose(); this.far = null; }
  /** Average frames a second over everything timed so far, and the share of that time spent in frames slower than 20 a second. */
  measured(): { fps: number; slow: number; ms: number } { return { fps: this.timedMs ? (this.frames * 1000) / this.timedMs : 60, slow: this.timedMs ? this.slowMs / this.timedMs : 0, ms: this.timedMs }; }
  /** Megabytes of texture on the card: the sprite sheets, the painted ground, the town's and the vehicles' sheets, the shadow map. */
  texMB(): number { const MIP = 4 / 3, ch = this.world?.stats.chunks ?? 0; return (this.bridge.memory() + (this.far ? Stage3D.FAR_SIZE * Stage3D.FAR_SIZE * 4 : 0) + ch * CHUNK_PX * CHUNK_PX * 4 * MIP + 2048 * 2048 * 4 * MIP + 1024 * 1024 * 4 * MIP + 1024 * 1024 * 4 + 256 * 256 * 4) / 1048576; }

  info() { const i = this.renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries, sprites: this.bridge.quads, spriteBatches: this.bridge.draws, staticTris: this.world?.stats.tris ?? 0, cells: this.bridge.cellCount, texMB: this.texMB(), paintTris: this.paints.reduce((n, q) => n + q.p.tris, 0), fps: this.fps, chunks: this.world?.stats.chunks ?? 0, chunkMs: this.world?.stats.paintMs ?? 0, dpr: this.dpr, viewW: this.viewW, viewH: this.viewH }; }

  dispose() { this.farDrop(); this.world?.dispose(); this.vehicles.dispose(); for (const q of this.paints) q.p.dispose(); this.bridge.reset(); this.renderer.dispose(); this.canvas.remove(); this.vig.remove(); this.haze.remove(); this.hud?.remove(); }
}
