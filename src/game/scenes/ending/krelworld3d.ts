import type Phaser from "phaser";
import type * as T3 from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { G } from "../../G";
import { synth } from "../../audio/Synth";
import { voice } from "../../audio/Voice";
import { CHARACTERS } from "../../../data/characters";
import type { Line } from "../../../data/types";
import { K3_BENN, K3_CHANT, K3_KREZMAR, K3_LAND, K3_LUKE, K3_MIKEY, K3_POLSON, K3_REAL, K3_SANMIK, K3_SEQUEL } from "../../../content/krelworld3d";

/**
 * THE 3D EPILOGUE. Out of the wormhole and into Krelworld, rendered as a PS2-era 3D game: low-res, fogged,
 * chunky. The lads land in the plaza, the camera pulls back to show the whole town (the Krel Tower, the Great
 * Tap, traffic, crowds), and then everyone does their thing. Runs on a three.js canvas laid over the Phaser
 * one, with its own subtitles, then hands back for the credits.
 *
 * Models come from public/art/3d/index.json (made with Meshy). Anything missing is drawn with stand-in shapes,
 * so the scene always plays.
 */

let THREE: typeof T3;
/** Set per run: denser crowds and more street detail on capable devices. */
let HQ_WORLD = true;

// ------------------------------------------------------------------ assets

interface CharAsset {
  base: string;
  /** model height in metres (rigged models aren't measured: skinned bounds are unreliable) */
  h?: number;
  /** Extra yaw (radians) so the model faces +z. */
  yaw?: number;
  /** clip name -> "file.glb" (first animation in it) or "file.glb#Clip Name" */
  clips?: Record<string, string>;
}
interface WorldAsset {
  file: string;
  /** model size in metres [w, h, d] */
  size?: [number, number, number];
  /** the tap: the pool in model space */
  basin?: { centre_xz: [number, number]; floor_y: number; rim_top_y: number; inner_radius: number; outer_radius: number; spout_outlet: [number, number, number] };
  yaw?: number;
  clips?: Record<string, string>;
  /** Tap only: where the spout is and where the stream lands, as fractions of the model's box (0..1). */
  spout?: [number, number, number];
}
interface AssetIndex {
  chars?: Record<string, CharAsset>;
  world?: Record<string, WorldAsset>;
}

const LADS = ["FLENKY", "KREZMAR", "KREBLIS", "KREZWONK", "SCROMBUS", "KREBON", "CRONGUS", "GRONNY", "MIKEY", "POLSON", "DRONGUS"] as const;
const DANCERS = ["FLENKY", "KREBLIS", "KREZWONK", "SCROMBUS", "GRONNY", "POLSON", "DRONGUS"];

let preload: Promise<Loaded> | null = null;

interface Loaded {
  index: AssetIndex;
  gltf: Map<string, GLTF | null>;
  tex: Map<string, T3.Texture>;
}

/** Start fetching three.js and every model now (call this as the bedroom scene starts, so it's ready by the wormhole). */
export function preloadKrelworld3d(): Promise<Loaded> {
  if (!preload) preload = loadAll();
  return preload;
}

async function loadAll(): Promise<Loaded> {
  THREE = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  let index: AssetIndex = {};
  try {
    const r = await fetch("art/3d/index.json", { cache: "no-cache" });
    if (r.ok) index = (await r.json()) as AssetIndex;
  } catch {
    /* no models yet: stand-ins */
  }
  const loader = new GLTFLoader();
  const files = new Set<string>();
  for (const c of Object.values(index.chars ?? {})) {
    files.add(c.base);
    for (const f of Object.values(c.clips ?? {})) files.add(f.split("#")[0]);
  }
  for (const w of Object.values(index.world ?? {})) {
    files.add(w.file);
    for (const f of Object.values(w.clips ?? {})) files.add(f.split("#")[0]);
  }
  const gltf = new Map<string, GLTF | null>();
  await Promise.all(
    [...files].map((f) =>
      loader
        .loadAsync(f)
        .then((g) => void gltf.set(f, g))
        .catch(() => void gltf.set(f, null)),
    ),
  );
  const tl = new THREE.TextureLoader();
  const tex = new Map<string, T3.Texture>();
  const texFiles: Record<string, string> = { grass: "art/tiles/tile_grass.png", cobble: "art/tiles/tile_cobble.png" };
  for (const id of LADS) texFiles[`face_${id}`] = `portraits/${id.toLowerCase()}.png`;
  await Promise.all(
    Object.entries(texFiles).map(([k, f]) =>
      tl
        .loadAsync(f)
        .then((t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          tex.set(k, t);
        })
        .catch(() => undefined),
    ),
  );
  return { index, gltf, tex };
}

/**
 * The scene's own clock. Every animation, wait and timer in the scene runs off it. In the game it follows real
 * time; a recorder can set window.__k3capture = true and step it frame by frame with window.__k3step(ms), so the
 * scene can be rendered to video at a steady frame rate on any machine.
 */
const clk = {
  t: 0,
  raf: [] as (() => void)[],
  timers: [] as { at: number; fn: () => void; every?: number; id: number }[],
  nextId: 1,
  reset() {
    this.t = 0;
    this.raf = [];
    this.timers = [];
  },
  now() {
    return this.t;
  },
  frame(fn: () => void) {
    this.raf.push(fn);
  },
  after(fn: () => void, ms = 0) {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id });
    return id;
  },
  every(fn: () => void, ms: number) {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id, every: ms });
    return id;
  },
  clear(id: number) {
    this.timers = this.timers.filter((x) => x.id !== id);
  },
  advance(ms: number) {
    this.t += ms;
    for (let guard = 0; guard < 1000; guard++) {
      const due = this.timers.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      if (due.every) due.at += due.every;
      else this.timers = this.timers.filter((x) => x !== due);
      due.fn();
    }
    const r = this.raf;
    this.raf = [];
    for (const f of r) f();
  },
};

// ------------------------------------------------------------------ small helpers

const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): T3.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ actors

type Pose = "idle" | "lie" | "getup" | "shocked" | "cheer" | "dance" | "run" | "walk" | "jump" | "drink" | "talk" | "shoot";

/** A lad (or a pedestrian): a Meshy model with clips, or a blocky stand-in with procedural poses. */
class Actor {
  root = new THREE.Group();
  model!: T3.Object3D;
  mixer: T3.AnimationMixer | null = null;
  clips: Record<string, T3.AnimationClip> = {};
  action: T3.AnimationAction | null = null;
  pose: Pose = "idle";
  poseT = 0;
  /** stand-in rig parts */
  fb: { body: T3.Object3D; head: T3.Object3D; armL: T3.Object3D; armR: T3.Object3D; legL: T3.Object3D; legR: T3.Object3D } | null = null;
  lying = 0;
  phase = Math.random() * 10;
  height = 1.8;

  constructor(readonly id: string) {}

  play(p: Pose, fade = 0.25) {
    this.pose = p;
    this.poseT = 0;
    if (!this.mixer) return;
    const name = p === "talk" ? "idle" : p === "drink" ? (this.clips.drink ? "drink" : "idle") : p;
    const clip = this.clips[name] ?? (p === "lie" ? this.clips.fall : undefined) ?? (p === "walk" ? this.clips.run : undefined) ?? this.clips.idle;
    if (!clip) return;
    const a = this.mixer.clipAction(clip);
    const once = p === "getup" || p === "lie" || p === "jump";
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    if (p === "walk" && !this.clips.walk) a.timeScale = 0.55;
    else a.timeScale = 1;
    if (this.action && this.action !== a) a.crossFadeFrom(this.action, fade, false);
    a.play();
    this.action = a;
  }

  /** Has a real clip for this pose (else the stand-in pose / root tilt does it). */
  has(p: string) {
    return !!this.clips[p];
  }

  update(dt: number) {
    this.poseT += dt;
    this.mixer?.update(dt);
    // lying down without a clip: tip the whole model over (and back up again)
    if (this.pose === "lie" && !this.has("fall")) this.lying = Math.min(1, this.lying + dt * 6);
    else this.lying = Math.max(0, this.lying - dt / (this.pose === "getup" ? 0.9 : 0.3));
    this.model.rotation.x = -Math.PI / 2 * this.lying;
    this.model.position.y = this.lying * 0.25;
    if (this.fb) this.animateStandIn();
  }

  private animateStandIn() {
    const f = this.fb!;
    const t = this.poseT + this.phase;
    let aL = 0, aR = 0, lL = 0, lR = 0, bob = 0, armUp = 0, spin = 0, headTilt = 0;
    switch (this.pose) {
      case "walk":
      case "run": {
        const s = this.pose === "run" ? 11 : 6;
        const amp = this.pose === "run" ? 1 : 0.5;
        aL = Math.sin(t * s) * amp;
        aR = -aL;
        lL = -aL;
        lR = aL;
        bob = Math.abs(Math.sin(t * s)) * 0.08 * amp;
        break;
      }
      case "dance": {
        // the Krel dance: everyone in unison (no phase), arms pumping, a hop and a half-turn
        const u = this.poseT * 2 * Math.PI * 1.1;
        aL = -2.4 + Math.sin(u) * 0.6;
        aR = -2.4 - Math.sin(u) * 0.6;
        lL = Math.max(0, Math.sin(u)) * 0.5;
        lR = Math.max(0, -Math.sin(u)) * 0.5;
        bob = Math.abs(Math.sin(u)) * 0.15;
        spin = Math.sin(u * 0.25) * 0.6;
        break;
      }
      case "cheer":
        aL = aR = -2.8 + Math.sin(t * 9) * 0.3;
        bob = Math.abs(Math.sin(t * 9)) * 0.1;
        break;
      case "shocked":
        armUp = 1;
        aL = aR = -2.2;
        headTilt = Math.sin(t * 2) * 0.4;
        break;
      case "jump":
        aL = aR = -2.9;
        break;
      case "drink":
        headTilt = -0.9;
        aL = aR = -1.2;
        break;
      case "talk":
        aR = -0.6 + Math.sin(t * 5) * 0.4;
        bob = Math.sin(t * 2) * 0.01;
        break;
      default:
        aL = Math.sin(t * 1.5) * 0.05;
        aR = -aL;
        bob = Math.sin(t * 2) * 0.01;
    }
    void armUp;
    f.armL.rotation.x = aL;
    f.armR.rotation.x = aR;
    f.legL.rotation.x = lL;
    f.legR.rotation.x = lR;
    f.body.position.y = bob;
    f.body.rotation.y = spin;
    f.head.rotation.y = headTilt;
    if (this.pose === "drink") f.head.rotation.x = headTilt;
    else f.head.rotation.x = 0;
  }

  faceTo(x: number, z: number) {
    this.root.rotation.y = Math.atan2(x - this.root.position.x, z - this.root.position.z);
  }
  /** World position of the top of the head (for cameras). */
  headPos(out = new THREE.Vector3()) {
    return out.set(this.root.position.x, this.root.position.y + this.height * 0.93, this.root.position.z);
  }
}

/** A blocky PS2-ish man: boxes in his game colours, his photo portrait on the front of his head. */
function standInBody(id: string, faceTex: T3.Texture | undefined): { obj: T3.Group; parts: NonNullable<Actor["fb"]>; height: number } {
  const def = CHARACTERS[id];
  const L = def?.look;
  const skin = L?.skin ?? 0xf0c8a0;
  const top = L?.top ?? 0x3b82f6;
  const bottom = L?.bottom ?? 0x1f2937;
  const hair = L?.hair ?? 0x3a2a1a;
  const bulk = L?.bulk ?? 1;
  const w = 0.5 * (bulk >= 2 ? 1.45 : 1);
  const m = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const box = (sx: number, sy: number, sz: number, mat: T3.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    b.castShadow = true;
    return b;
  };
  const obj = new THREE.Group();
  const body = new THREE.Group();
  obj.add(body);
  // legs pivot at the hip
  const legGeo = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * w * 0.25, 0.85, 0);
    const leg = box(w * 0.42, 0.85, 0.3, m(bottom));
    leg.position.y = -0.42;
    g.add(leg);
    const shoe = box(w * 0.44, 0.1, 0.38, m(L?.shoes ?? 0x111111));
    shoe.position.set(0, -0.82, 0.04);
    g.add(shoe);
    body.add(g);
    return g;
  };
  const legL = legGeo(-1);
  const legR = legGeo(1);
  const torso = box(w, 0.62, 0.32 * (bulk >= 2 ? 1.5 : 1), m(top));
  torso.position.y = 1.16;
  body.add(torso);
  const armGeo = (side: number) => {
    const g = new THREE.Group();
    g.position.set(side * (w / 2 + 0.09), 1.42, 0);
    const arm = box(0.16, 0.6, 0.18, m(top));
    arm.position.y = -0.28;
    g.add(arm);
    const hand = box(0.13, 0.13, 0.13, m(skin));
    hand.position.y = -0.62;
    g.add(hand);
    body.add(g);
    return g;
  };
  const armL = armGeo(-1);
  const armR = armGeo(1);
  const head = new THREE.Group();
  head.position.y = 1.5;
  const faceMat = faceTex ? new THREE.MeshLambertMaterial({ map: faceTex }) : m(skin);
  const skinM = m(skin);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), [skinM, skinM, m(L?.hairStyle === "bald" ? skin : hair), skinM, faceMat, skinM]);
  hb.position.y = 0.21;
  hb.castShadow = true;
  head.add(hb);
  body.add(head);
  return { obj, parts: { body, head, armL, armR, legL, legR }, height: 1.92 };
}

// ------------------------------------------------------------------ the scene

export async function krelworld3d(scene: Phaser.Scene): Promise<void> {
  clk.reset();
  // the overlay: a white flash covers the hand-over from the wormhole while things load
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { position: "fixed", zIndex: "50", overflow: "hidden", background: "#fff", fontFamily: "Inter, system-ui, sans-serif" });
  const place = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    Object.assign(wrap.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  place();
  window.addEventListener("resize", place);
  document.body.appendChild(wrap);
  const loading = document.createElement("div");
  Object.assign(loading.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "14px" });
  wrap.appendChild(loading);
  const slow = window.setTimeout(() => (loading.textContent = "Entering Krelworld…"), 1200);

  let L: Loaded;
  try {
    L = await preloadKrelworld3d();
  } catch {
    window.clearTimeout(slow);
    wrap.remove();
    window.removeEventListener("resize", place);
    return;
  }
  window.clearTimeout(slow);
  loading.remove();

  // ---- how much this device can take: full effects on a decent computer, a lighter mode on phones and
  // small machines (and if frames start to drag, it drops down mid-scene)
  const capture = !!(window as unknown as { __k3capture?: boolean }).__k3capture;
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const smallScreen = Math.min(screen.width, screen.height) < 700;
  let HQ = capture || !(coarse || smallScreen || (navigator.hardwareConcurrency || 4) <= 4);
  // ---- renderer: full resolution, anti-aliased, filmic tone mapping, soft shadows
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HQ ? 2 : 1.25));
  const size = () => {
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    renderer.setSize(w, h, false);
    return w / h;
  };
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  wrap.appendChild(renderer.domElement);

  // letterbox, subtitles, captions, fades
  const mk = (css: Partial<CSSStyleDeclaration>) => {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", pointerEvents: "none" }, css);
    wrap.appendChild(d);
    return d;
  };
  const barT = mk({ left: "0", right: "0", top: "0", height: "9%", background: "#000" });
  const barB = mk({ left: "0", right: "0", bottom: "0", height: "9%", background: "#000" });
  const sub = mk({ left: "8%", right: "8%", bottom: "11%", textAlign: "center", color: "#fff", fontSize: "clamp(12px, 2.6vw, 22px)", fontWeight: "700", textShadow: "0 0 4px #000, 2px 2px 0 #000", lineHeight: "1.3" });
  const place3 = mk({ right: "5%", bottom: "13%", color: "#fff", fontSize: "clamp(16px, 4vw, 40px)", fontWeight: "900", fontStyle: "italic", letterSpacing: "1px", textShadow: "3px 3px 0 #000, -1px -1px 0 #000", opacity: "0", transition: "opacity 0.6s", fontFamily: "Impact, 'Arial Black', sans-serif" });
  const fade = mk({ inset: "0", background: "#fff", opacity: "1", transition: "opacity 1.2s" });
  const card = mk({ inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", opacity: "0", transition: "opacity 1s" });
  const skip = mk({ right: "2%", top: "1.5%", color: "#ffffff88", fontSize: "11px", pointerEvents: "auto", cursor: "pointer" });
  skip.textContent = "skip ▶▶";
  let skipped = false;
  skip.onclick = () => (skipped = true);
  void barT;
  void barB;

  const caption = (t: string, ms = 2600) => {
    place3.textContent = t;
    place3.style.opacity = "1";
    clk.after(() => (place3.style.opacity = "0"), ms);
  };

  // ---- the world
  const s3 = new THREE.Scene();
  const SKY = 0x9fd3ff;
  s3.background = skyTexture();
  s3.fog = new THREE.Fog(0xd8e9fb, 140, 760);
  const cam = new THREE.PerspectiveCamera(55, size(), 0.15, 2400);
  s3.userData.cam = cam;
  const onResize = () => {
    cam.aspect = size();
    cam.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);
  // ---- post-processing: ambient occlusion (things sit in the world), a soft glow on bright bits, depth of field
  // on close-ups, a light colour grade and vignette
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { BokehPass }, { ShaderPass }, { GTAOPass }] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("three/examples/jsm/postprocessing/BokehPass.js"),
    import("three/examples/jsm/postprocessing/ShaderPass.js"),
    import("three/examples/jsm/postprocessing/GTAOPass.js"),
  ]);
  const cw = () => Math.max(1, wrap.clientWidth);
  const ch = () => Math.max(1, wrap.clientHeight);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(s3, cam));
  const gtao = new GTAOPass(s3, cam, cw(), ch());
  gtao.enabled = HQ;
  composer.addPass(gtao);
  // one invalid pixel anywhere (NaN/inf from a shader) would be blurred across the whole screen by the glow
  // and black it out: clean those up and cap extreme highlights first
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv);
          if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 65000.0 || c.g > 65000.0 || c.b > 65000.0) c = vec4(0.0, 0.0, 0.0, 1.0);
          gl_FragColor = vec4(min(c.rgb, vec3(16.0)), c.a); }`,
    }),
  );
  const bloom = new UnrealBloomPass(new THREE.Vector2(cw(), ch()), 0.32, 0.55, 0.88);
  // the glow needs floating-point render targets; without them it blacks the screen out, so only where supported
  const ext = renderer.extensions;
  bloom.enabled = ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float");
  composer.addPass(bloom);
  const bokeh = new BokehPass(s3, cam, { focus: 3, aperture: 0.0035, maxblur: 0.009 });
  bokeh.enabled = false;
  composer.addPass(bokeh);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, sat: { value: 1.12 }, vig: { value: 0.32 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform float vig; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat); float d = distance(vUv, vec2(0.5)); c.rgb *= 1.0 - vig * smoothstep(0.35, 0.85, d);
      gl_FragColor = c; }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  const sizeComposer = () => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(cw(), ch());
  };
  sizeComposer();
  window.addEventListener("resize", sizeComposer);
  (window as unknown as { __k3fx?: unknown }).__k3fx = { gtao, bloom, bokeh, grade, composer };
  /** Depth of field on a close-up (focus distance in metres), or off. */
  const dof = (dist: number | null) => {
    bokeh.enabled = HQ && dist !== null;
    if (dist !== null) (bokeh.uniforms as Record<string, { value: number }>).focus.value = dist;
  };
  /** Drop to the light mode (a device that can't keep up). */
  const lighten = () => {
    if (!HQ) return;
    HQ = false;
    gtao.enabled = false;
    bokeh.enabled = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    sizeComposer();
  };
  // image-based light so the models' materials pick up proper highlights and soft fill
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const pmrem = new THREE.PMREMGenerator(renderer);
  s3.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  s3.environmentIntensity = 0.55;
  s3.add(new THREE.HemisphereLight(0xdff0ff, 0x6a7a3a, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(-80, 140, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(HQ ? 4096 : 2048, HQ ? 4096 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 420 });
  s3.add(sun);
  s3.add(sun.target);
  // the shadow box follows whatever the camera is looking at, so shadows stay crisp wherever we are
  const sunOffset = new THREE.Vector3(-80, 140, 60);
  void SKY;

  const updaters: ((dt: number, t: number) => void)[] = [];
  const actors: Actor[] = [];
  HQ_WORLD = HQ;
  buildGround(s3, L);
  const tapInfo = buildLandmarks(s3, L, updaters);
  const { carPaths, sidewalkPaths } = buildRoads(s3);
  buildDressing(s3, L, updaters);

  // traffic & crowds
  const traffic = spawnTraffic(s3, L, carPaths, updaters);
  const peds = spawnPeds(s3, L, sidewalkPaths, actors, updaters);
  // the car SanMik takes, already pulled up at the kerb on the plaza's south side
  const parkedCar = traffic.stopNext(new THREE.Vector3(-6, 0, 33.5));

  // ---- the lads
  const lad: Record<string, Actor> = {};
  for (const id of LADS) {
    const a = makeActor(id, L);
    s3.add(a.root);
    actors.push(a);
    lad[id] = a;
  }
  // SanMik waits off-stage until Mikey turns
  const sanmik = makeActor(L.index.chars?.SANMIK ? "SANMIK" : "MIKEY", L);
  sanmik.root.visible = false;
  s3.add(sanmik.root);
  actors.push(sanmik);

  // ---- particles
  const parts: { m: T3.Mesh; v: T3.Vector3; life: number; max: number; grav: number; grow: number }[] = [];
  // soft round particles, not squares
  const softDot = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  });
  const sprite = (col: number, size: number, opacity = 1, additive = false) =>
    new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: col, map: softDot, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }));
  const burst = (p: T3.Vector3, n: number, col: number | (() => number), opts: { speed?: number; up?: number; size?: number; life?: number; grav?: number; grow?: number; additive?: boolean } = {}) => {
    for (let i = 0; i < n; i++) {
      const m = sprite(typeof col === "function" ? col() : col, opts.size ?? 0.3, 1, opts.additive);
      m.position.copy(p);
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const v = new THREE.Vector3(Math.cos(a) * sp, (opts.up ?? 3) * (0.5 + Math.random()), Math.sin(a) * sp);
      s3.add(m);
      const life = (opts.life ?? 1) * (0.7 + Math.random() * 0.5);
      parts.push({ m, v, life, max: life, grav: opts.grav ?? 9, grow: opts.grow ?? 0 });
    }
  };
  updaters.push((dt) => {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt;
      q.v.y -= q.grav * dt;
      q.m.position.addScaledVector(q.v, dt);
      q.m.quaternion.copy(cam.quaternion);
      if (q.grow) q.m.scale.multiplyScalar(1 + q.grow * dt);
      (q.m.material as T3.MeshBasicMaterial).opacity = Math.max(0, q.life / q.max);
      if (q.life <= 0) {
        s3.remove(q.m);
        q.m.geometry.dispose();
        (q.m.material as T3.Material).dispose();
        parts.splice(i, 1);
      }
    }
  });

  // ---- camera control
  const camState = { pos: new THREE.Vector3(0, 60, 40), look: new THREE.Vector3(0, 40, 0), shake: 0, follow: null as null | (() => [T3.Vector3, T3.Vector3]) };
  let shotTok = 0;
  const camTo = (pos: [number, number, number], look: [number, number, number], ms: number, e = ease.inOut) => {
    const my = ++shotTok;
    dof(null);
    camState.follow = null;
    const p0 = camState.pos.clone();
    const l0 = camState.look.clone();
    const p1 = new THREE.Vector3(...pos);
    const l1 = new THREE.Vector3(...look);
    if (ms <= 0) {
      camState.pos.copy(p1);
      camState.look.copy(l1);
      return Promise.resolve();
    }
    return new Promise<void>((res) => {
      const t0 = clk.now();
      const step = () => {
        if (my !== shotTok) return res();
        const k = Math.min(1, (clk.now() - t0) / ms);
        const q = e(k);
        camState.pos.lerpVectors(p0, p1, q);
        camState.look.lerpVectors(l0, l1, q);
        if (k < 1) clk.frame(step);
        else res();
      };
      step();
    });
  };
  const cut = (pos: [number, number, number], look: [number, number, number]) => void camTo(pos, look, 0);
  const shake = (amt: number) => (camState.shake = Math.max(camState.shake, amt));

  // ---- the loop
  let running = true;
  let last = clk.now();
  const t00 = last;
  const frame = () => {
    if (!running) return;
    const now = clk.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t00) / 1000;
    for (const u of updaters) u(dt, t);
    for (const a of actors) a.update(dt);
    if (camState.follow) {
      const [p, l] = camState.follow();
      camState.pos.lerp(p, Math.min(1, dt * 4));
      camState.look.lerp(l, Math.min(1, dt * 6));
    }
    cam.position.copy(camState.pos);
    if (camState.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * camState.shake;
      cam.position.y += (Math.random() - 0.5) * camState.shake;
      camState.shake *= Math.pow(0.02, dt);
    }
    cam.lookAt(camState.look);
    sun.target.position.set(camState.look.x, 0, camState.look.z);
    sun.position.copy(sun.target.position).add(sunOffset);
    // a recorder resuming a render fast-forwards without drawing
    if (!(window as unknown as { __k3noRender?: boolean }).__k3noRender) composer.render(dt);
    clk.frame(frame);
  };
  clk.frame(frame);
  // drive the clock: real time in the game, or one step at a time for a recorder
  let alive = true;
  const W2 = window as unknown as { __k3capture?: boolean; __k3step?: (ms: number) => void; __k3now?: () => number };
  W2.__k3now = () => clk.now();
  if (W2.__k3capture) W2.__k3step = (ms: number) => clk.advance(ms);
  else {
    let prev = performance.now();
    let slowMs = 0;
    const drive = (now: number) => {
      if (!alive) return;
      const step = Math.max(0, now - prev);
      // two seconds of under ~22 fps: lighten up
      slowMs = step > 45 ? slowMs + step : Math.max(0, slowMs - step * 0.5);
      if (slowMs > 2000) lighten();
      clk.advance(Math.min(100, step));
      prev = now;
      requestAnimationFrame(drive);
    };
    requestAnimationFrame(drive);
  }

  const wait = (ms: number) => new Promise<void>((r) => clk.after(r, skipped ? 0 : ms));

  // ---- speech: subtitles timed to the voice
  const speak = async (l: Line, minMs = 0) => {
    if (skipped) return;
    const id = String(l.s);
    const who = CHARACTERS[id];
    const col = who ? hex(who.color) : "#ffd23f";
    const name = id === "SANMIK" ? "SANMIK" : who?.name ?? id;
    sub.innerHTML = `<span style="color:${col}">${name}:</span> ${escapeHtml(l.t ?? "")}`;
    voice.say(id, l.t ?? "");
    const t0 = clk.now();
    const floor = Math.max(minMs, voice.enabled() ? 700 : 900 + (l.t ?? "").length * 55);
    await new Promise<void>((res) => {
      const check = () => {
        const el = clk.now() - t0;
        if (skipped || (el > floor && !voice.busy()) || el > 9000) return res();
        clk.after(check, 60);
      };
      clk.after(check, 250);
    });
    sub.innerHTML = "";
  };

  // =================================================================== THE SHOTS
  synth.stopMusic();
  synth.ambience("amb_city");
  const PLAZA = new THREE.Vector3(0, 0, 16);
  // landing spots: an arc in front of the tap
  const spots: Record<string, [number, number]> = {};
  LADS.forEach((id, i) => {
    const a = -1.1 + (i / (LADS.length - 1)) * 2.2;
    spots[id] = [Math.sin(a) * 9, PLAZA.z + Math.cos(a) * 4 - 2];
  });

  // ---- 1. a portal tears open in the sky; the lads drop out of it
  const portal = makePortal();
  portal.position.set(0, 38, 14);
  portal.rotation.x = Math.PI / 2;
  s3.add(portal);
  updaters.push((dt) => {
    portal.rotation.z += dt * 2.2;
    const mat = (portal.children[0] as T3.Mesh).material as T3.MeshBasicMaterial;
    mat.color.setHSL((clk.now() / 1500) % 1, 1, 0.6);
  });
  cut([0, 22, 46], [0, 30, 14]);
  fade.style.opacity = "0";
  synth.play("portal_open");
  await wait(900);
  const falls: Promise<void>[] = [];
  LADS.forEach((id, i) => {
    const a = lad[id];
    const [tx, tz] = spots[id];
    a.root.position.set((Math.random() - 0.5) * 3, 38, 14 + (Math.random() - 0.5) * 3);
    a.play("lie");
    falls.push(
      new Promise<void>((res) => {
        const delay = i * 140;
        const T = 1300;
        const sx = a.root.position.x;
        const sz = a.root.position.z;
        const spin = (Math.random() - 0.5) * 14;
        clk.after(() => {
          const t0 = clk.now();
          const step = () => {
            const k = Math.min(1, (clk.now() - t0) / T);
            a.root.position.set(lerp(sx, tx, k), lerp(38, 0, k * k), lerp(sz, tz, k));
            a.root.rotation.y = spin * (1 - k) + Math.PI;
            if (k < 1) clk.frame(step);
            else {
              a.root.rotation.y = Math.random() * Math.PI * 2;
              burst(new THREE.Vector3(tx, 0.2, tz), 6, 0xcab89a, { speed: 3, up: 1, size: 0.45, life: 0.6, grav: 1, grow: 1 });
              shake(0.5);
              res();
            }
          };
          step();
        }, skipped ? 0 : delay);
      }),
    );
  });
  camTo([0, 6, 30], [0, 2, 12], 2200, ease.out);
  clk.after(() => synth.play("bodies_land"), 1150);
  await Promise.all(falls);
  // the portal shrinks away
  void tweenScale(portal, 0.01, 1200).then(() => s3.remove(portal));

  // ---- 2. dazed on the cobbles
  await wait(600);
  cut([7, 0.6, PLAZA.z + 4], [-3, 0.3, PLAZA.z - 2]);
  caption("KRELFORD", 2600);
  await wait(700);
  await speak(K3_LAND[0]);
  await speak(K3_LAND[1]);
  for (const id of LADS) {
    clk.after(() => {
      lad[id].play("getup");
      lad[id].faceTo(0, -40);
    }, Math.random() * 600);
  }
  await camTo([0, 1.6, PLAZA.z + 9], [0, 2, PLAZA.z - 4], 1600);
  await wait(500);
  for (const id of LADS) lad[id].play("shocked");

  // ---- 3. THE REVEAL: up and back, the whole town
  synth.music("krelworld_orch", true);
  synth.play("reveal_boom");
  synth.play("crowd_gasp");
  void camTo([0, 30, PLAZA.z + 46], [0, 22, -40], 5200, ease.inOut);
  await wait(3400);
  caption("THE GREAT TAP", 2200);
  await wait(2000);
  // round to the Krel Tower, all the way up it
  await camTo([10, 45, 110], [45, 80, 40], 5000, ease.inOut);
  caption("THE KREL TOWER", 2400);
  await camTo([26, 3, 62], [45, 190, 40], 3400, ease.inOut);
  // over the town hall, with the traffic underneath
  await camTo([-60, 40, -5], [0, 6, -45], 4200, ease.inOut);
  caption("KRELFORD TOWN HALL", 2200);
  await camTo([-25, 10, 28], [20, 3, 32], 3600, ease.inOut);

  // ---- 4. it was real
  const close = (a: Actor, dist = 2.6, side = 0.6, h = 0) => {
    const hp = a.headPos();
    const ang = a.root.rotation.y + side;
    cut([hp.x + Math.sin(ang) * dist, hp.y + h, hp.z + Math.cos(ang) * dist], [hp.x, hp.y - 0.05, hp.z]);
    dof(dist);
  };
  for (const id of LADS) lad[id].faceTo(0, PLAZA.z + 12);
  lad.FLENKY.play("cheer");
  close(lad.FLENKY);
  await speak(K3_REAL[0]);
  lad.SCROMBUS.play("talk");
  close(lad.SCROMBUS, 2.8, -0.5);
  await speak(K3_REAL[1]);
  lad.SCROMBUS.play("cheer");
  lad.DRONGUS.play("talk");
  close(lad.DRONGUS, 2.6, 0.4);
  await speak(K3_REAL[2]);
  lad.POLSON.play("cheer");
  close(lad.POLSON, 3, -0.3);
  await speak(K3_REAL[3]);
  lad.GRONNY.play("talk");
  close(lad.GRONNY, 2.4, 0.5);
  await speak(K3_REAL[4]);
  for (const id of LADS) lad[id].play("cheer");
  synth.play("cheer");
  cut([0, 3, PLAZA.z + 14], [0, 1.8, PLAZA.z]);
  await wait(1600);

  // ---- 5. Benn and the Great Tap
  const benn = lad.KREBON;
  benn.faceTo(tapInfo.pool.x, tapInfo.pool.z);
  close(benn, 3, 0.8);
  await speak(K3_BENN[0]);
  benn.play("run");
  void camTo([tapInfo.pool.x + 12, 5, tapInfo.pool.z + 14], [tapInfo.pool.x, 2, tapInfo.pool.z], 2200);
  await moveTo(benn, tapInfo.rim.x, tapInfo.rim.z, 6.5);
  // the jump
  benn.play("jump");
  synth.play("swing");
  await hop(benn, tapInfo.under.x, tapInfo.under.z, tapInfo.poolY, 2.2, 700);
  synth.play("splash");
  burst(new THREE.Vector3(benn.root.position.x, tapInfo.poolY + 0.4, benn.root.position.z), 30, 0xff6bb0, { speed: 4, up: 6, size: 0.25, life: 1.1, grav: 12 });
  synth.play("tap_gush");
  benn.faceTo(tapInfo.under.x, tapInfo.under.z + 5);
  benn.play("drink");
  const drip = clk.every(() => burst(benn.headPos().add(new THREE.Vector3(0, 0.2, 0)), 4, 0xff8cc6, { speed: 1.6, up: 1, size: 0.18, life: 0.6, grav: 10 }), 120);
  cut([tapInfo.under.x + 2.5, tapInfo.poolY + 2.2, tapInfo.under.z + 3.2], [tapInfo.under.x, tapInfo.poolY + 1.7, tapInfo.under.z]);
  await wait(700);
  await speak(K3_BENN[1], 2200);
  synth.play("tap_gush");
  await camTo([tapInfo.under.x + 9, tapInfo.poolY + 6, tapInfo.under.z + 12], [tapInfo.under.x, tapInfo.poolY + 3, tapInfo.under.z], 1600);
  clk.clear(drip);

  // ---- 6. SanMik
  const mikey = lad.MIKEY;
  mikey.play("shocked");
  close(mikey, 2.6, 0.5);
  await speak(K3_MIKEY[0]);
  synth.play("transform_sparkle");
  const rainbow = () => new THREE.Color().setHSL(Math.random(), 1, 0.6).getHex();
  burst(mikey.headPos().add(new THREE.Vector3(0, -0.6, 0)), 60, rainbow, { speed: 4, up: 4, size: 0.25, life: 1.2, grav: 2, additive: true });
  shake(0.35);
  await wait(450);
  sanmik.root.position.copy(mikey.root.position);
  sanmik.root.rotation.y = mikey.root.rotation.y;
  mikey.root.visible = false;
  sanmik.root.visible = true;
  sanmik.play("cheer");
  await speak(K3_SANMIK[0]);
  // the car he's having: it's been waiting at the kerb all along, driver at the wheel
  const jacked = parkedCar;
  const car = jacked.pos.clone();
  const door = new THREE.Vector3(car.x - 0.2, 0, car.z - 1.6);
  sanmik.play("run");
  void camTo([car.x - 7, 2.6, car.z - 9], [car.x, 1, car.z - 0.6], 1700);
  clk.after(() => synth.play("car_horn"), 700);
  await moveTo(sanmik, door.x - 0.9, door.z - 0.4, 7);
  sanmik.faceTo(car.x, car.z);
  sanmik.play("idle");
  // door open, driver dragged out onto the road
  cut([car.x - 4.8, 1.55, car.z - 6.2], [car.x - 0.4, 1.0, car.z - 1.4]);
  synth.play("door");
  await wait(250);
  const driver = peds.spare();
  driver.root.visible = true;
  driver.play("shocked");
  const from = new THREE.Vector3(car.x, 0.35, car.z - 0.4);
  const to = new THREE.Vector3(door.x - 0.2, 0, door.z - 1.6);
  sanmik.play("cheer");
  synth.play("punch_big");
  await new Promise<void>((res) => {
    const t0 = clk.now();
    const step = () => {
      const k = Math.min(1, (clk.now() - t0) / 520);
      driver.root.position.set(lerp(from.x, to.x, k), lerp(from.y, 0, k) + Math.sin(k * Math.PI) * 0.6, lerp(from.z, to.z, k));
      driver.root.rotation.z = Math.sin(k * Math.PI) * 0.9;
      driver.faceTo(sanmik.root.position.x, sanmik.root.position.z);
      if (k < 1) clk.frame(step);
      else {
        driver.root.rotation.z = 0;
        res();
      }
    };
    step();
  });
  synth.play("hurt");
  shake(0.15);
  sanmik.faceTo(driver.root.position.x, driver.root.position.z);
  sanmik.play("idle");
  await wait(450);
  // the gun comes out
  let gunHand: T3.Object3D | null = null;
  sanmik.model.traverse((o) => {
    if (!gunHand && /righthand$/i.test(o.name)) gunHand = o;
  });
  const pistol = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), steel);
  barrel.position.z = 0.08;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), steel);
  grip.position.set(0, -0.06, 0);
  pistol.add(barrel, grip);
  if (gunHand) {
    const ws = new THREE.Vector3();
    (gunHand as T3.Object3D).getWorldScale(ws);
    // a chunky cartoon pistol you can actually see
    pistol.scale.setScalar(1.8 / Math.max(ws.x, 0.0001));
    (gunHand as T3.Object3D).add(pistol);
  } else {
    pistol.position.copy(sanmik.headPos()).add(new THREE.Vector3(0.3, -0.5, 0.3));
    s3.add(pistol);
  }
  const sp = sanmik.root.position;
  const dp = driver.root.position;
  // close on the draw
  synth.play("swing");
  sanmik.play("shoot");
  {
    const f = sanmik.root.rotation.y;
    const hand = new THREE.Vector3(sp.x + Math.sin(f + 0.6) * 0.35, 1.25, sp.z + Math.cos(f + 0.6) * 0.35);
    cut([hand.x + Math.sin(f + 1.4) * 1.3, 1.45, hand.z + Math.cos(f + 1.4) * 1.3], [hand.x, 1.3, hand.z]);
    dof(1.3);
  }
  await wait(700);
  // over SanMik's shoulder: the driver, hands up
  cut([sp.x - (dp.x - sp.x) * 0.6 + 0.5, 1.75, sp.z - (dp.z - sp.z) * 0.6 + 0.5], [dp.x, 1.2, dp.z]);
  driver.play("shocked");
  await wait(500);
  // BANG
  synth.play("gun_pistol");
  const muzzle = new THREE.Vector3();
  pistol.getWorldPosition(muzzle);
  muzzle.add(new THREE.Vector3(Math.sin(sanmik.root.rotation.y) * 0.25, 0, Math.cos(sanmik.root.rotation.y) * 0.25));
  burst(muzzle, 8, 0xffd23f, { speed: 1.2, up: 0.4, size: 0.4, life: 0.15, grav: 0, additive: true });
  burst(muzzle, 5, 0x9ca3af, { speed: 0.6, up: 0.5, size: 0.3, life: 0.8, grav: -0.3, grow: 1.2 });
  shake(0.3);
  if (G.meta.settings.gore !== false) burst(driver.headPos().add(new THREE.Vector3(0, -0.3, 0)), 28, 0xb3001b, { speed: 3, up: 2.5, size: 0.16, life: 0.9, grav: 12 });
  else burst(driver.headPos(), 10, 0xffd23f, { speed: 2, up: 2, size: 0.3, life: 0.8, grav: 2, additive: true });
  driver.play("lie");
  synth.play("shriek");
  cut([car.x - 5.5, 1.3, car.z - 7], [dp.x, 0.6, dp.z]);
  await wait(1100);
  // in he gets
  sanmik.play("walk");
  await moveTo(sanmik, door.x, door.z, 2.2);
  sanmik.root.visible = false;
  synth.play("door");
  await wait(350);
  synth.play("car_screech");
  // the getaway: round the plaza, through two pedestrians
  const victims = peds.onRoad(jacked, 2);
  camState.follow = () => {
    const p = jacked.pos;
    const d = jacked.dir;
    return [new THREE.Vector3(p.x - d.x * 13, 9, p.z - d.z * 13), new THREE.Vector3(p.x + d.x * 8, 0.8, p.z + d.z * 8)];
  };
  await jacked.getaway(victims, (v) => {
    synth.play("car_hit");
    synth.play("shriek");
    shake(0.3);
    if (G.meta.settings.gore !== false) burst(v.headPos(), 22, 0xb3001b, { speed: 4, up: 4, size: 0.16, life: 0.9, grav: 12 });
  });
  camState.follow = null;

  // ---- 7. Luke and the bread and butter house
  const luke = lad.CRONGUS;
  luke.faceTo(tapInfo.abandoned.x, tapInfo.abandoned.z);
  close(luke, 2.6, 0.7);
  luke.play("cheer");
  await speak(K3_LUKE[0]);
  await speak(K3_LUKE[1]);
  luke.play("run");
  void moveTo(luke, tapInfo.abandoned.x + 2, tapInfo.abandoned.z - 12, 7);
  await camTo([luke.root.position.x + 4, 2, luke.root.position.z + 6], [tapInfo.abandoned.x, 6, tapInfo.abandoned.z], 2600);
  caption("THE BREAD AND BUTTER PUDDING HOUSE", 2400);
  await wait(1800);

  // ---- 7b. Polson and a Krelburger (Krezwonk regrets standing next to him)
  const pol = lad.POLSON;
  const kw = lad.KREZWONK;
  pol.root.position.set(12, 0, PLAZA.z + 6);
  pol.root.rotation.y = 0;
  kw.root.position.set(13.7, 0, PLAZA.z + 6.6);
  kw.faceTo(12, PLAZA.z + 6);
  pol.play("idle");
  kw.play("idle");
  // the burger: held up at his mouth, shrinking with every bite
  const burger = new THREE.Group();
  const bunMat = new THREE.MeshStandardMaterial({ color: 0xd08a3c, roughness: 0.6 });
  const layer = (r: number, h: number, col: number, y: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    m.position.y = y;
    burger.add(m);
  };
  const bunBot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.03, 20), bunMat);
  burger.add(bunBot);
  layer(0.08, 0.025, 0x4a2a18, 0.028);
  layer(0.083, 0.006, 0xf2c230, 0.044);
  layer(0.085, 0.01, 0x4caf50, 0.052);
  const bunTop = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), bunMat);
  bunTop.position.y = 0.058;
  burger.add(bunTop);
  burger.scale.setScalar(1.6);
  s3.add(burger);
  let burgerOn = true;
  updaters.push(() => {
    if (!burgerOn) return;
    const hp = pol.headPos();
    const f = pol.root.rotation.y;
    burger.position.set(hp.x + Math.sin(f) * 0.32, hp.y - 0.2, hp.z + Math.cos(f) * 0.32);
    burger.rotation.set(0.35, f, 0);
  });
  synth.play("pop");
  burst(burger.position.clone(), 12, 0xffd23f, { speed: 1.2, up: 1, size: 0.12, life: 0.6, grav: 0, additive: true });
  close(pol, 2.2, 0.35);
  await speak(K3_POLSON[0]);
  // three big bites
  for (let i = 0; i < 3; i++) {
    synth.play("gulp");
    burger.scale.multiplyScalar(0.78);
    burst(burger.position.clone(), 5, 0xd08a3c, { speed: 0.8, up: 0.6, size: 0.06, life: 0.5, grav: 6 });
    await wait(520);
  }
  // …and out the other end
  const gas = () => {
    const f = pol.root.rotation.y;
    const p = pol.root.position.clone().add(new THREE.Vector3(-Math.sin(f) * 0.35, pol.height * 0.48, -Math.cos(f) * 0.35));
    burst(p, 7, () => (Math.random() < 0.5 ? 0x9acd32 : 0x6b8e23), { speed: 0.7, up: 0.5, size: 0.5, life: 2.2, grav: -0.25, grow: 0.9 });
  };
  const farting = clk.every(gas, 140);
  synth.play("fart");
  shake(0.12);
  clk.after(() => synth.play("fart"), 650);
  clk.after(() => synth.play("fart"), 1350);
  await speak(K3_POLSON[1], 1700);
  clk.clear(farting);
  // Krezwonk gets the lot
  kw.play("shocked");
  close(kw, 2.1, -0.3);
  await speak(K3_POLSON[2]);
  // the two-shot for the comeback
  pol.play("talk");
  const mid = new THREE.Vector3().addVectors(pol.root.position, kw.root.position).multiplyScalar(0.5);
  cut([mid.x - 0.6, 1.6, mid.z + 4.2], [mid.x, 1.45, mid.z]);
  await speak(K3_POLSON[3]);
  burgerOn = false;
  s3.remove(burger);
  await wait(500);

  // ---- 8. the Krel dance
  const line = DANCERS.filter((id) => lad[id]);
  line.forEach((id, i) => {
    const a = lad[id];
    a.root.position.set((i - (line.length - 1) / 2) * 2.1, 0, PLAZA.z + 2);
    a.faceTo(a.root.position.x, PLAZA.z + 20);
    a.play("dance");
    a.poseT = 0;
  });
  cut([0, 1.8, PLAZA.z + 13], [0, 1.4, PLAZA.z + 2]);
  void camTo([9, 3.5, PLAZA.z + 11], [0, 1.2, PLAZA.z + 2], 7000, ease.linear);
  for (let i = 0; i < 2; i++) {
    for (const l of K3_CHANT) void voice.layer(String(l.s), l.t ?? "", 0.8);
    sub.innerHTML = `<span style="color:#ffd23f">THE LADS:</span> ${escapeHtml(K3_CHANT[0].t ?? "")}`;
    await wait(2600);
  }
  sub.innerHTML = "";
  await wait(500);

  // ---- 9. Krezmar
  const kz = lad.KREZMAR;
  kz.root.position.set(-6, 0, PLAZA.z + 6);
  kz.faceTo(-6, PLAZA.z + 20);
  kz.play(kz.has("talk") ? "talk" : "idle");
  synth.stopMusic();
  synth.ambience(null);
  const kh = kz.headPos();
  cut([kh.x, kh.y, kh.z + 1.1], [kh.x, kh.y - 0.02, kh.z]);
  await camTo([kh.x, kh.y - 0.02, kh.z + 0.62], [kh.x, kh.y - 0.04, kh.z], 1100);
  await speak(K3_KREZMAR[0]);
  // down to the jeans
  const hip = kz.height * 0.5;
  await camTo([kh.x, hip + 0.05, kh.z + 0.95], [kh.x, hip, kh.z], 1100);
  synth.play("zip_down");
  const bar = mk({ left: "41%", width: "18%", top: "46%", height: "9%", background: "#000", opacity: "0", transition: "opacity 0.3s" });
  clk.after(() => (bar.style.opacity = "1"), 600);
  await wait(1300);
  bar.remove();
  await camTo([kh.x, kh.y - 0.02, kh.z + 0.58], [kh.x, kh.y - 0.04, kh.z], 700);
  await speak(K3_KREZMAR[1], 1400);

  // ---- cut to black, the card
  fade.style.transition = "none";
  fade.style.background = "#000";
  fade.style.opacity = "1";
  running = false;
  synth.play("reveal_boom");
  const [l1, l2] = K3_SEQUEL.split("\n");
  card.innerHTML = `<div style="font-size:clamp(14px,3vw,26px);letter-spacing:3px;color:#ddd;margin-bottom:2%">${escapeHtml(l1)}</div>
    <div style="font-size:clamp(12px,2.2vw,18px);color:#aaa;letter-spacing:2px">${escapeHtml(l2.replace(/'KRELWORLD 64'/, ""))}</div>
    <div style="font-family:Impact,'Arial Black',sans-serif;font-size:clamp(34px,9vw,96px);font-style:italic;margin-top:1%;letter-spacing:2px">${logo64()}</div>`;
  card.style.zIndex = "5";
  await wait(300);
  card.style.opacity = "1";
  await wait(4600);
  card.style.opacity = "0";
  await wait(1000);

  // ---- tidy up, back to Phaser for the credits
  running = false;
  alive = false;
  window.removeEventListener("resize", place);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("resize", sizeComposer);
  composer.dispose();
  renderer.dispose();
  s3.traverse((o) => {
    const m = o as T3.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  wrap.remove();
  synth.ambience(null);
}

// ------------------------------------------------------------------ building the town

function skyTexture() {
  const t = canvasTex(4, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#3d7fd6");
    g.addColorStop(0.55, "#9fd3ff");
    g.addColorStop(1, "#ffe7c2");
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
  });
  return t;
}

function buildGround(s3: T3.Scene, L: Loaded) {
  void L;
  // smooth, detailed ground drawn here (the 2D game's tiles are pixel art and look blocky up close)
  const grass = canvasTex(512, 512, (x) => {
    x.fillStyle = "#4f8a34";
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const g = 90 + Math.random() * 70;
      x.fillStyle = `rgba(${40 + Math.random() * 40},${g},${30 + Math.random() * 25},${0.25 + Math.random() * 0.35})`;
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      x.fillRect(px, py, 1.5, 3 + Math.random() * 4);
    }
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? "70,110,40" : "100,150,60"},0.18)`;
      x.beginPath();
      x.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 0, Math.PI * 2);
      x.fill();
    }
  });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(120, 120);
  grass.anisotropy = 8;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, depthWrite: false }));
  g.renderOrder = -10;
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  s3.add(g);
  // the plaza: smooth stone paving round the tap
  const cob = canvasTex(512, 512, (x) => {
    x.fillStyle = "#8f8473";
    x.fillRect(0, 0, 512, 512);
    const s = 64;
    for (let yy = 0; yy < 512; yy += s / 2)
      for (let xx = (yy / (s / 2)) % 2 ? -s / 2 : 0; xx < 512; xx += s) {
        const v = 140 + Math.random() * 30;
        x.fillStyle = `rgb(${v},${v - 12},${v - 30})`;
        x.fillRect(xx + 2, yy + 2, s - 4, s / 2 - 4);
        x.fillStyle = "rgba(0,0,0,0.06)";
        x.fillRect(xx + 2, yy + s / 2 - 6, s - 4, 4);
      }
  });
  cob.wrapS = cob.wrapT = THREE.RepeatWrapping;
  cob.repeat.set(9, 9);
  cob.anisotropy = 8;
  const p = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: cob, roughness: 0.8, depthWrite: false }));
  p.renderOrder = -8;
  p.rotation.x = -Math.PI / 2;
  p.position.y = 0.02;
  p.receiveShadow = true;
  s3.add(p);
}

/** Landmarks, laid out like the overworld (north is -z): the Tap in the middle, the Town Hall behind it. */
const LANDMARKS: { key: string; name: string; x: number; z: number; w: number; d: number; h: number; wall: number; roof: number; face?: number }[] = [
  { key: "townhall", name: "KRELFORD TOWN HALL", x: 0, z: -48, w: 42, d: 22, h: 18, wall: 0x9a7a5a, roof: 0x6b2737 },
  { key: "citadel", name: "DA DRONGUS DUNGEON", x: 0, z: -125, w: 46, d: 26, h: 30, wall: 0xf8f9fa, roof: 0x3366cc },
  { key: "archive", name: "HISTORICAL ARCHIVE", x: 62, z: -46, w: 28, d: 20, h: 14, wall: 0x8a7a5a, roof: 0x3a2f1f },
  { key: "pub", name: "THE KREZZ ARMS", x: -72, z: 8, w: 28, d: 20, h: 11, wall: 0x7a5230, roof: 0x3b2a1a, face: Math.PI / 2 },
  { key: "home", name: "YOUR HOUSE", x: -78, z: 72, w: 22, d: 16, h: 10, wall: 0xb08d57, roof: 0x7a1f2b },
  { key: "wildern", name: "WILDERN ACADEMY", x: 0, z: 78, w: 42, d: 22, h: 14, wall: 0xa0522d, roof: 0x5a5a6a, face: Math.PI },
  { key: "ministry", name: "MINISTRY OF BONER CONTROL", x: 75, z: 76, w: 32, d: 22, h: 22, wall: 0x4b5563, roof: 0xd97706, face: Math.PI },
  { key: "gym", name: "KRUNCH GYM", x: 122, z: -24, w: 24, d: 17, h: 10, wall: 0x3f3f46, roof: 0xf97316, face: -Math.PI / 2 },
  { key: "abandoned", name: "ABANDONED BUILDING", x: -42, z: 128, w: 22, d: 14, h: 10, wall: 0x2a2a2a, roof: 0x111111, face: Math.PI },
  { key: "police", name: "KRELFORD CONSTABULARY", x: 56, z: 126, w: 24, d: 13, h: 10, wall: 0x1e3a8a, roof: 0x111827, face: Math.PI },
  { key: "polson_towers", name: "POLSON TOWERS", x: 175, z: 14, w: 34, d: 26, h: 24, wall: 0xf2e6a0, roof: 0x7a5230, face: -Math.PI / 2 },
];

function buildLandmarks(s3: T3.Scene, L: Loaded, updaters: ((dt: number, t: number) => void)[]) {
  const W = L.index.world ?? {};
  const placeModel = (key: string, x: number, z: number, w: number, d: number, h: number, face = 0): T3.Object3D | null => {
    const a = W[key];
    const g = a ? L.gltf.get(a.file) : null;
    if (!a || !g) return null;
    const obj = g.scene.clone(true);
    obj.rotation.y = (a.yaw ?? 0) + face;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    // fit the footprint, then let height follow (or force the height for towers)
    if (h > 60) obj.scale.set(w / size.x, h / size.y, d / size.z);
    else obj.scale.setScalar(Math.min(w / Math.max(size.x, 0.01), d / Math.max(size.z, 0.01)) * 1.05);
    const b2 = new THREE.Box3().setFromObject(obj);
    obj.position.set(x - (b2.min.x + b2.max.x) / 2, -b2.min.y, z - (b2.min.z + b2.max.z) / 2);
    obj.traverse((o) => {
      const m = o as T3.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    s3.add(obj);
    return obj;
  };
  for (const b of LANDMARKS) {
    if (!placeModel(b.key, b.x, b.z, b.w, b.d, b.h, b.face)) s3.add(boxBuilding(b.name, b.w, b.d, b.h, b.wall, b.roof, b.x, b.z, b.face ?? 0));
  }
  // THE KREL TOWER: enormous
  const TX = 45;
  const TZ = 40;
  if (!placeModel("kreltower", TX, TZ, 30, 30, 190)) s3.add(krelTowerStandIn(TX, TZ));
  // a beacon on top
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
  beacon.position.set(TX, 196, TZ);
  s3.add(beacon);
  updaters.push((_dt, t) => (beacon.visible = Math.sin(t * 4) > 0));

  // THE GREAT TAP, its pool and the pink stream
  const tapH = 15;
  const tapObj = placeModel("tap", 0, -2, 16, 16, tapH);
  let spout = new THREE.Vector3(0, 11.5, 1.8);
  let poolY = 1.1;
  let poolC = new THREE.Vector3(0, poolY, -2);
  let poolR = 7.6;
  let rimR = 8.4;
  const bs = W.tap?.basin;
  if (tapObj && bs) {
    // the basin is measured in model space: take it through the placed model
    tapObj.updateMatrixWorld(true);
    const k = tapObj.scale.x;
    spout = tapObj.localToWorld(new THREE.Vector3(...bs.spout_outlet));
    poolC = tapObj.localToWorld(new THREE.Vector3(bs.centre_xz[0], bs.floor_y + 0.35, bs.centre_xz[1]));
    poolY = poolC.y;
    poolR = bs.inner_radius * k;
    rimR = bs.outer_radius * k;
    // make the tap gleam
    tapObj.traverse((o) => {
      const m = o as T3.Mesh;
      if (m.isMesh && (m.material as T3.MeshStandardMaterial).isMeshStandardMaterial) {
        const mat = m.material as T3.MeshStandardMaterial;
        mat.metalness = 0.55;
        mat.roughness = 0.35;
      }
    });
  } else if (!tapObj) s3.add(tapStandIn());
  const under = new THREE.Vector3(spout.x, poolY, spout.z);
  // the pool surface: pink, glistening
  const poolTex = canvasTex(64, 64, (x) => {
    x.fillStyle = "#ff6bb0";
    x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 90; i++) {
      x.fillStyle = Math.random() < 0.5 ? "#ffa3d1" : "#e8448f";
      x.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 6, 1);
    }
  });
  poolTex.wrapS = poolTex.wrapT = THREE.RepeatWrapping;
  poolTex.repeat.set(3, 3);
  // ripples: a scrolling normal map so the surface catches the light like liquid
  const ripple = canvasTex(128, 128, (x) => {
    const img = x.createImageData(128, 128);
    for (let yy = 0; yy < 128; yy++)
      for (let xx = 0; xx < 128; xx++) {
        const a = Math.sin((xx / 128) * Math.PI * 6 + Math.sin((yy / 128) * Math.PI * 4) * 1.5);
        const b = Math.cos((yy / 128) * Math.PI * 6 + Math.sin((xx / 128) * Math.PI * 4) * 1.5);
        const i = (yy * 128 + xx) * 4;
        img.data[i] = 128 + a * 50;
        img.data[i + 1] = 128 + b * 50;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
    x.putImageData(img, 0, 0);
  });
  ripple.colorSpace = THREE.NoColorSpace;
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(2, 2);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(poolR, 48),
    new THREE.MeshPhysicalMaterial({ map: poolTex, color: 0xffd0e6, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, normalMap: ripple, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.6, transparent: true, opacity: 0.94 }),
  );
  updaters.push((dt) => {
    ripple.offset.x += dt * 0.05;
    ripple.offset.y += dt * 0.035;
  });
  pool.rotation.x = -Math.PI / 2;
  pool.position.copy(poolC);
  s3.add(pool);
  // the stream: a scrolling pink column from the spout to the pool
  const streamTex = canvasTex(64, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, "rgba(232,68,143,0.75)");
    g.addColorStop(0.35, "rgba(255,140,198,0.95)");
    g.addColorStop(0.5, "rgba(255,226,240,1)");
    g.addColorStop(0.65, "rgba(255,140,198,0.95)");
    g.addColorStop(1, "rgba(232,68,143,0.75)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.3})`;
      x.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 3, 10 + Math.random() * 30);
    }
  });
  streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping;
  const len = spout.y - poolY;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, len, 24, 1, true), new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.9 }));
  stream.position.set(spout.x, poolY + len / 2, spout.z);
  s3.add(stream);
  updaters.push((dt, t) => {
    streamTex.offset.y -= dt * 3;
    poolTex.offset.x = Math.sin(t * 0.7) * 0.2;
    poolTex.offset.y += dt * 0.05;
  });
  // splash ring at the bottom of the stream
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.6, 16), new THREE.MeshBasicMaterial({ color: 0xffc4e1, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(under.x, poolY + 0.05, under.z);
  s3.add(ring);
  updaters.push((_dt, t) => {
    const k = (t * 1.6) % 1;
    ring.scale.setScalar(0.6 + k * 1.4);
    (ring.material as T3.MeshBasicMaterial).opacity = 0.8 * (1 - k);
  });

  const ab = LANDMARKS.find((b) => b.key === "abandoned")!;
  return {
    pool: poolC.clone(),
    rim: new THREE.Vector3(poolC.x, 0, poolC.z + rimR + 1.2),
    under,
    poolY,
    abandoned: new THREE.Vector3(ab.x, 0, ab.z),
  };
}

function boxBuilding(name: string, w: number, d: number, h: number, wall: number, roof: number, x: number, z: number, face: number) {
  const g = new THREE.Group();
  const winTex = canvasTex(64, 64, (c) => {
    c.fillStyle = hex(wall);
    c.fillRect(0, 0, 64, 64);
    for (let yy = 6; yy < 64; yy += 16)
      for (let xx = 6; xx < 64; xx += 16) {
        c.fillStyle = Math.random() < 0.3 ? "#ffe9a8" : "#2b3a4a";
        c.fillRect(xx, yy, 9, 9);
        c.fillStyle = "#00000044";
        c.fillRect(xx, yy + 9, 9, 2);
      }
  });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  winTex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 5)));
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ map: winTex }));
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.35, 4), new THREE.MeshLambertMaterial({ color: roof }));
  r.rotation.y = Math.PI / 4;
  r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  r.position.y = h + h * 0.175;
  r.castShadow = true;
  g.add(r);
  // the sign over the door
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(w * 0.8, 24), 2.2),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 24, (c) => {
        c.fillStyle = "#111";
        c.fillRect(0, 0, 256, 24);
        c.fillStyle = "#ffd23f";
        c.font = "bold 16px sans-serif";
        c.textAlign = "center";
        c.fillText(name, 128, 18);
      }),
    }),
  );
  sign.position.set(0, Math.min(h - 1, 6), d / 2 + 0.05);
  g.add(sign);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshLambertMaterial({ color: 0x3b2a1a }));
  door.position.set(0, 1.7, d / 2 + 0.04);
  g.add(door);
  g.position.set(x, 0, z);
  g.rotation.y = face;
  return g;
}

function krelTowerStandIn(x: number, z: number) {
  const g = new THREE.Group();
  const glass = canvasTex(32, 64, (c) => {
    c.fillStyle = "#3b5d7a";
    c.fillRect(0, 0, 32, 64);
    for (let yy = 0; yy < 64; yy += 4) {
      c.fillStyle = yy % 8 ? "#6fa3c8" : "#a9d4f0";
      c.fillRect(0, yy, 32, 2);
    }
    for (let xx = 0; xx < 32; xx += 8) {
      c.fillStyle = "#1e2f3d";
      c.fillRect(xx, 0, 1, 64);
    }
  });
  glass.wrapS = glass.wrapT = THREE.RepeatWrapping;
  let y = 0;
  const tiers: [number, number][] = [
    [20, 60],
    [16, 55],
    [12, 45],
    [8, 22],
  ];
  for (const [w, h] of tiers) {
    const t2 = glass.clone();
    t2.repeat.set(w / 6, h / 6);
    t2.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshPhongMaterial({ map: t2, shininess: 60 }));
    m.position.y = y + h / 2;
    m.castShadow = true;
    g.add(m);
    y += h;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 12, 6), new THREE.MeshLambertMaterial({ color: 0xc0c0c0 }));
  spire.position.y = y + 6;
  g.add(spire);
  g.position.set(x, 0, z);
  return g;
}

function tapStandIn() {
  const g = new THREE.Group();
  const gold = new THREE.MeshPhongMaterial({ color: 0xd4a017, shininess: 100, specular: 0xfff2b0 });
  const stone = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.6, 1.4, 32, 1, true), stone);
  basin.position.set(0, 0.7, -2);
  g.add(basin);
  const rimM = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.5, 6, 32), stone);
  rimM.rotation.x = Math.PI / 2;
  rimM.position.set(0, 1.4, -2);
  g.add(rimM);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 7, 8), stone);
  plinth.position.set(0, 3.5, -3.5);
  g.add(plinth);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 12), gold);
  pipe.position.set(0, 9.5, -3.5);
  g.add(pipe);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 5.6, 12), gold);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 12, -1.1);
  g.add(arm);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 1.2, 12), gold);
  nozzle.position.set(0, 11.5, 1.8);
  g.add(nozzle);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.25, 6, 16), gold);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 13.2, -3.5);
  g.add(handle);
  g.traverse((o) => ((o as T3.Mesh).castShadow = true));
  return g;
}

function makePortal() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.2, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff66ff }));
  g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6.6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  g.add(disc);
  return g;
}

function tweenScale(o: T3.Object3D, to: number, ms: number) {
  const from = o.scale.x;
  return new Promise<void>((res) => {
    const t0 = clk.now();
    const step = () => {
      const k = Math.min(1, (clk.now() - t0) / ms);
      o.scale.setScalar(lerp(from, to, ease.in(k)));
      if (k < 1) clk.frame(step);
      else res();
    };
    step();
  });
}

// ------------------------------------------------------------------ roads, traffic, people

type Path = T3.Vector3[];

function buildRoads(s3: T3.Scene) {
  // the flat ground is painted bottom-up (grass, paving, plaza, road, markings) without depth, so layers never flicker
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42, depthWrite: false });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, depthWrite: false });
  const paveMat = new THREE.MeshLambertMaterial({ color: 0xa8a29a, depthWrite: false });
  const strip = (x1: number, z1: number, x2: number, z2: number, w: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(w + 6, len + 6), paveMat);
    pave.rotation.set(-Math.PI / 2, 0, ang);
    pave.position.set((x1 + x2) / 2, 0.025, (z1 + z2) / 2);
    pave.receiveShadow = true;
    pave.renderOrder = -9;
    s3.add(pave);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, len + w), roadMat);
    r.rotation.set(-Math.PI / 2, 0, ang);
    r.position.set((x1 + x2) / 2, 0.04, (z1 + z2) / 2);
    r.receiveShadow = true;
    r.renderOrder = -7;
    s3.add(r);
    for (let k = 0; k < len; k += 6) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.6), lineMat);
      d.rotation.set(-Math.PI / 2, 0, ang);
      d.position.set(x1 + ((x2 - x1) * k) / len, 0.05, z1 + ((z2 - z1) * k) / len);
      d.renderOrder = -6;
      s3.add(d);
    }
  };
  // the ring road round the plaza, and a big loop round town
  const loops: [number, number, number, number][] = [
    [-36, -36, 36, 36],
    [-100, -78, 100, 102],
  ];
  for (const [x1, z1, x2, z2] of loops) {
    strip(x1, z1, x2, z1, 9);
    strip(x2, z1, x2, z2, 9);
    strip(x2, z2, x1, z2, 9);
    strip(x1, z2, x1, z1, 9);
  }
  // avenues out to the edges
  strip(-36, 0, -165, 0, 9);
  strip(36, 0, 160, 0, 9);
  strip(0, 36, 0, 64, 9);
  strip(0, 102, 0, 220, 9);
  const rect = (x1: number, z1: number, x2: number, z2: number, off: number, cw: boolean): Path => {
    const p = [new THREE.Vector3(x1 + off, 0, z1 + off), new THREE.Vector3(x2 - off, 0, z1 + off), new THREE.Vector3(x2 - off, 0, z2 - off), new THREE.Vector3(x1 + off, 0, z2 - off)];
    return cw ? p : p.reverse();
  };
  const carPaths: Path[] = [];
  const sidewalkPaths: Path[] = [];
  for (const [x1, z1, x2, z2] of loops) {
    carPaths.push(rect(x1, z1, x2, z2, -2.2, true), rect(x1, z1, x2, z2, 2.2, false));
    sidewalkPaths.push(rect(x1, z1, x2, z2, -6.5, true), rect(x1, z1, x2, z2, 6.5, false));
  }
  // people round the plaza too
  const circ: Path = [];
  for (let i = 0; i < 24; i++) circ.push(new THREE.Vector3(Math.cos((i / 24) * Math.PI * 2) * 24, 0, Math.sin((i / 24) * Math.PI * 2) * 24));
  sidewalkPaths.push(circ);
  return { carPaths, sidewalkPaths };
}

function pathLen(p: Path) {
  let l = 0;
  for (let i = 0; i < p.length; i++) l += p[i].distanceTo(p[(i + 1) % p.length]);
  return l;
}
function pathAt(p: Path, s: number, out = new THREE.Vector3(), dir?: T3.Vector3) {
  const total = pathLen(p);
  s = ((s % total) + total) % total;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const l = a.distanceTo(b);
    if (s <= l) {
      out.lerpVectors(a, b, s / l);
      if (dir) dir.subVectors(b, a).normalize();
      return out;
    }
    s -= l;
  }
  return out.copy(p[0]);
}

function buildDressing(s3: T3.Scene, L: Loaded, updaters: ((dt: number, t: number) => void)[]) {
  const W = L.index.world ?? {};
  const prop = (key: string, x: number, z: number, yaw = 0, scale = 1): boolean => {
    const g = W[key] ? L.gltf.get(W[key].file) : null;
    if (!g) return false;
    const o = g.scene.clone(true);
    o.scale.setScalar(scale);
    o.position.set(x, 0, z);
    o.rotation.y = yaw;
    o.traverse((m) => ((m as T3.Mesh).castShadow = true));
    s3.add(o);
    return true;
  };
  // benches and market stalls round the plaza, a welcome arch on the south avenue, the Kreddle bridge out west
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    if (i % 2) prop("bench", Math.cos(a) * 27, Math.sin(a) * 27, -a - Math.PI / 2);
    else prop("stall", Math.cos(a) * 27.5, Math.sin(a) * 27.5, -a - Math.PI / 2, 1.2);
  }
  if (prop("arch", 0, 52, 0, 1.1)) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.8),
      new THREE.MeshBasicMaterial({
        map: canvasTex(256, 52, (c) => {
          c.fillStyle = "#12001f";
          c.fillRect(0, 0, 256, 52);
          c.fillStyle = "#ffd23f";
          c.font = "bold 34px Impact, sans-serif";
          c.textAlign = "center";
          c.fillText("WELCOME TO KRELWORLD", 128, 40);
        }),
      }),
    );
    sign.position.set(0, 9.6, 52 + 3.3);
    s3.add(sign);
  }
  prop("bridge", -175, 0, Math.PI / 2, 1.4);
  // ---- street clutter
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.5, metalness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.3, metalness: 0.9 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb9ae9a, roughness: 0.9 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3e2a1c, roughness: 1 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x1f5130, roughness: 0.6, metalness: 0.3 });
  const shadowed = (m: T3.Mesh) => ((m.castShadow = true), (m.receiveShadow = true), m);
  // bollards ringing the plaza, with gold bands
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) > 0.97) continue; // gaps for the paths
    const b = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 10), blackMat));
    b.position.set(Math.cos(a) * 30.6, 0.45, Math.sin(a) * 30.6);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.07, 10), goldMat);
    band.position.set(b.position.x, 0.72, b.position.z);
    s3.add(b, band);
  }
  // stone planters full of flowers
  const petal = [0xff5ca8, 0xffd23f, 0xff7a3d, 0xb46cff, 0xffffff, 0xe11d48];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const x = Math.cos(a) * 25;
    const z = Math.sin(a) * 25;
    const box = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.1), stoneMat));
    box.position.set(x, 0.35, z);
    box.rotation.y = -a;
    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.9), soilMat);
    soil.position.set(x, 0.71, z);
    soil.rotation.y = -a;
    s3.add(box, soil);
    for (let f = 0; f < 14; f++) {
      const u = (f / 13 - 0.5) * 2.2;
      const v = (Math.random() - 0.5) * 0.7;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.05, 8, 6), new THREE.MeshStandardMaterial({ color: petal[(f + i) % petal.length], roughness: 0.6 }));
      fl.position.set(x + Math.cos(-a) * u - Math.sin(-a) * v, 0.82 + Math.random() * 0.12, z + Math.sin(-a) * u + Math.cos(-a) * v);
      s3.add(fl);
    }
  }
  // bins along the pavements
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.12;
    const r = 43.5;
    const bin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 12), binMat));
    bin.position.set(Math.cos(a) * r, 0.48, Math.sin(a) * r);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 12), blackMat);
    lid.position.set(bin.position.x, 0.98, bin.position.z);
    s3.add(bin, lid);
  }
  // street-name signs at the plaza corners
  const signNames = ["KRELFORD HIGH ST", "TAP SQUARE", "LORE LANE", "KREZZ ROAD"];
  [[33, -33], [-33, -33], [33, 33], [-33, 33]].forEach(([x, z], i) => {
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), blackMat));
    pole.position.set(x, 1.5, z);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.45),
      new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        map: canvasTex(256, 52, (c) => {
          c.fillStyle = "#ffffff";
          c.fillRect(0, 0, 256, 52);
          c.strokeStyle = "#111";
          c.lineWidth = 4;
          c.strokeRect(4, 4, 248, 44);
          c.fillStyle = "#111";
          c.font = "bold 24px Arial, sans-serif";
          c.textAlign = "center";
          c.fillText(signNames[i], 128, 35);
        }),
      }),
    );
    plate.position.set(x, 2.8, z);
    plate.rotation.y = Math.atan2(-x, -z);
    s3.add(pole, plate);
  });
  // bunting strung from the top of the tap out to the plaza edge, like a maypole
  const flagCols = [0xe11d48, 0xffd23f, 0x2563eb, 0x16a34a, 0xff5ca8, 0xffffff];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const from = new THREE.Vector3(0, 14.5, -2);
    const to = new THREE.Vector3(Math.cos(a) * 27, 4.5, Math.sin(a) * 27);
    const n = 22;
    for (let j = 1; j < n; j++) {
      const t = j / n;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      p.y -= Math.sin(t * Math.PI) * 2.2; // sag
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), new THREE.MeshStandardMaterial({ color: flagCols[(j + k) % flagCols.length], roughness: 0.7, side: THREE.DoubleSide }));
      flag.position.copy(p).add(new THREE.Vector3(0, -0.3, 0));
      flag.rotation.x = Math.PI;
      flag.lookAt(flag.position.x + Math.cos(a), flag.position.y, flag.position.z + Math.sin(a));
      flag.rotation.z = Math.PI;
      s3.add(flag);
    }
  }
  // a flock of pigeons wheeling over the plaza
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.8, side: THREE.DoubleSide });
  const birds: { g: T3.Group; wl: T3.Mesh; wr: T3.Mesh; r: number; h: number; ph: number; sp: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), birdMat);
    body.scale.set(1, 0.8, 1.8);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), birdMat);
    wl.position.x = -0.35;
    const wr = wl.clone();
    wr.position.x = 0.35;
    g.add(body, wl, wr);
    s3.add(g);
    birds.push({ g, wl, wr, r: 18 + Math.random() * 16, h: 22 + Math.random() * 14, ph: Math.random() * Math.PI * 2, sp: 0.25 + Math.random() * 0.12 });
  }
  updaters.push((_dt, t) => {
    for (const b of birds) {
      const a = b.ph + t * b.sp;
      b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.ph) * 1.5, Math.sin(a) * b.r + 5);
      b.g.rotation.y = -a;
      const flap = Math.sin(t * 9 + b.ph) * 0.6;
      b.wl.rotation.z = flap;
      b.wr.rotation.z = -flap;
    }
  });
  // trees and lamps along the big loop
  const trunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leaves = new THREE.MeshLambertMaterial({ color: 0x3f8a2e });
  const lamp = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = 44 + (i % 2) * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (i % 3 === 0 && prop("tree", x, z, a, 0.8)) continue;
    if (i % 3 === 1 && prop("lamppost", x, z, -a)) continue;
    if (i % 3 === 0) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 5), trunk);
      t.position.set(x, 1.5, z);
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), leaves);
      l.position.set(x, 4.2, z);
      t.castShadow = l.castShadow = true;
      s3.add(t, l);
    } else if (i % 3 === 1) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 5), lamp);
      p.position.set(x, 2.5, z);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
      h.position.set(x, 5.1, z);
      s3.add(p, h);
    }
  }
  // a ring of real houses and shops just outside the big loop road (the Meshy models, reused)…
  const streetKinds = ["home", "pub", "archive", "home", "gym", "home", "police", "polson_towers"].filter((k) => W[k] && L.gltf.get(W[k].file));
  if (streetKinds.length) {
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      const r = 128 + (i % 3) * 7;
      const x = Math.cos(a) * r * 1.15;
      const z = Math.sin(a) * r + 12;
      // keep clear of the landmarks
      if (LANDMARKS.some((b) => Math.hypot(b.x - x, b.z - z) < 30) || Math.hypot(x - 45, z - 40) < 30) continue;
      prop(streetKinds[i % streetKinds.length], x, z, Math.atan2(-x, -z), 0.9 + (i % 4) * 0.08);
    }
  }
  // …and a skyline of modern towers further out, for the sense of a big city
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + Math.random() * 0.05;
    const r = 240 + Math.random() * 120;
    const h = 30 + Math.random() * 90;
    const w = 16 + Math.random() * 18;
    s3.add(cityTower(w, h, w * (0.7 + Math.random() * 0.5), i, Math.cos(a) * r, Math.sin(a) * r, -a));
  }
  // a blimp circling the Krel Tower
  const blimp = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
  hull.scale.set(14, 4.5, 4.5);
  blimp.add(hull);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 3),
    new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      map: canvasTex(256, 48, (c) => {
        c.fillStyle = "#ff3ea5";
        c.fillRect(0, 0, 256, 48);
        c.fillStyle = "#fff";
        c.font = "bold 30px Impact, sans-serif";
        c.textAlign = "center";
        c.fillText("KRELWORLD", 128, 36);
      }),
    }),
  );
  banner.position.set(0, -5.5, 0);
  blimp.add(banner);
  s3.add(blimp);
  updaters.push((_dt, t) => {
    const a = t * 0.08;
    blimp.position.set(45 + Math.cos(a) * 90, 120, 40 + Math.sin(a) * 90);
    blimp.rotation.y = -a;
  });
  // soft billboard clouds
  const cloudTex = canvasTex(256, 128, (x) => {
    for (let i = 0; i < 26; i++) {
      const cx = 40 + Math.random() * 176;
      const cy = 60 + Math.random() * 30;
      const r = 18 + Math.random() * 30;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
  });
  // flat panels turned to face the camera every frame (sprites produced invalid pixels that broke the glow pass)
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85, toneMapped: false });
  const clouds: T3.Mesh[] = [];
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cloudMat);
    c.scale.set(90 + Math.random() * 80, 40 + Math.random() * 25, 1);
    c.position.set((Math.random() - 0.5) * 1100, 190 + Math.random() * 90, (Math.random() - 0.5) * 1100);
    s3.add(c);
    clouds.push(c);
  }
  updaters.push(() => {
    const camQ = (s3.userData.cam as T3.Camera | undefined)?.quaternion;
    if (camQ) for (const c of clouds) c.quaternion.copy(camQ);
  });
}

/** A modern city tower for the skyline: glass and concrete bands, lit windows, a flat roof with plant on top. */
function cityTower(w: number, h: number, d: number, seed: number, x: number, z: number, face: number) {
  const palettes: [string, string][] = [
    ["#8fa7bd", "#2d4a63"],
    ["#c9b79c", "#4a5560"],
    ["#a3b6c4", "#1f3446"],
    ["#d6d2c8", "#3b4f61"],
    ["#9a8f86", "#26343f"],
  ];
  const [wall, glass] = palettes[seed % palettes.length];
  const tex = canvasTex(128, 256, (c) => {
    c.fillStyle = wall;
    c.fillRect(0, 0, 128, 256);
    for (let yy = 4; yy < 256; yy += 12)
      for (let xx = 4; xx < 128; xx += 12) {
        c.fillStyle = Math.random() < 0.12 ? "#ffe3a3" : glass;
        c.fillRect(xx, yy, 8, 8);
        c.fillStyle = "rgba(255,255,255,0.18)";
        c.fillRect(xx, yy, 8, 2);
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, w / 14), Math.max(1, h / 28));
  tex.anisotropy = 4;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6), new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 }));
  roof.position.y = h + 0.6;
  g.add(roof);
  const plant = new THREE.Mesh(new THREE.BoxGeometry(w * 0.35, 3, d * 0.3), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 }));
  plant.position.set(w * 0.15, h + 2.7, -d * 0.1);
  g.add(plant);
  if (seed % 3 === 0) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 6), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    mast.position.set(-w * 0.2, h + 8, d * 0.15);
    g.add(mast);
  }
  g.position.set(x, 0, z);
  g.rotation.y = face;
  return g;
}

interface Car {
  bus?: boolean;
  obj: T3.Object3D;
  path: Path;
  s: number;
  speed: number;
}

function carStandIn(col: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 4), new THREE.MeshPhongMaterial({ color: col, shininess: 70 }));
  body.position.y = 0.7;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.2), new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 90 }));
  cab.position.set(0, 1.4, -0.3);
  g.add(body, cab);
  for (const [x, z] of [
    [-0.9, 1.3],
    [0.9, 1.3],
    [-0.9, -1.3],
    [0.9, -1.3],
  ]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
  }
  g.traverse((o) => ((o as T3.Mesh).castShadow = true));
  return g;
}

function spawnTraffic(s3: T3.Scene, L: Loaded, paths: Path[], updaters: ((dt: number, t: number) => void)[]) {
  const W = L.index.world ?? {};
  const kinds = ["car", "car_b", "bus", "car"].filter((k) => W[k] && L.gltf.get(W[k].file));
  const models = kinds.map((k) => L.gltf.get(W[k].file)!);
  const cols = [0xd62828, 0x1d4ed8, 0xf2f2f2, 0x16a34a, 0xfacc15, 0x111111, 0x9333ea];
  const cars: Car[] = [];
  const mkCar = (i: number) => {
    let obj: T3.Object3D;
    const g = models.length ? models[i % models.length] : null;
    if (g) {
      obj = g.scene.clone(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const isBus = kinds[i % kinds.length] === "bus";
      const k = (isBus ? 10 : 4.1) / Math.max(size.x, size.z);
      obj.scale.setScalar(k);
      const wrap = new THREE.Group();
      obj.position.y = -box.min.y * k;
      // long side along z
      if (size.x > size.z) obj.rotation.y = Math.PI / 2;
      obj.rotation.y += W[isBus ? "bus" : "car"]?.yaw ?? 0;
      if (isBus) obj.scale.x *= 0.65;
      obj.traverse((o) => ((o as T3.Mesh).castShadow = true));
      wrap.add(obj);
      obj = wrap;
    } else obj = carStandIn(cols[i % cols.length]);
    s3.add(obj);
    return obj;
  };
  let n = 0;
  for (const p of paths) {
    const len = pathLen(p);
    const count = Math.max(2, Math.round(len / (HQ_WORLD ? 48 : 70)));
    for (let i = 0; i < count; i++) {
      const bus = kinds[n % Math.max(1, kinds.length)] === "bus";
      cars.push({ obj: mkCar(n++), bus, path: p, s: (len / count) * i + Math.random() * 8, speed: 9 + Math.random() * 4 });
    }
  }
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let held: Car | null = null;
  updaters.push((dt) => {
    for (const c of cars) {
      if (c === held) continue;
      c.s += c.speed * dt;
      pathAt(c.path, c.s, tmp, dir);
      c.obj.position.copy(tmp);
      c.obj.rotation.y = Math.atan2(dir.x, dir.z);
    }
  });
  return {
    /** Pull the car nearest a point over and hold it there: the one SanMik takes. */
    stopNext(at: T3.Vector3) {
      let best = cars[0];
      let bd = Infinity;
      for (const c of cars) {
        const d = c.obj.position.distanceTo(at);
        if (d < bd && c.path === paths[0] && !c.bus) {
          bd = d;
          best = c;
        }
      }
      held = best;
      best.obj.position.copy(at);
      best.obj.rotation.y = Math.PI / 2;
      const self = {
        pos: best.obj.position,
        dir: new THREE.Vector3(1, 0, 0),
        /** Floor it round the ring road, flattening whoever's in the way, then off down the avenue. */
        async getaway(victims: Actor[], onHit: (v: Actor) => void) {
          const route: T3.Vector3[] = [at.clone(), new THREE.Vector3(33.8, 0, 33.5), new THREE.Vector3(33.8, 0, -33.5), new THREE.Vector3(36, 0, -2), new THREE.Vector3(150, 0, -2)];
          const hit = new Set<Actor>();
          let speed = 0;
          for (let i = 0; i < route.length - 1; i++) {
            const a = route[i];
            const b = route[i + 1];
            const L2 = a.distanceTo(b);
            let s = 0;
            await new Promise<void>((res) => {
              let last = clk.now();
              const step = () => {
                const now = clk.now();
                const dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                speed = Math.min(26, speed + dt * 18);
                s += speed * dt;
                const k = Math.min(1, s / L2);
                best.obj.position.lerpVectors(a, b, k);
                self.dir.subVectors(b, a).normalize();
                best.obj.rotation.y = Math.atan2(self.dir.x, self.dir.z);
                for (const v of victims) {
                  if (!hit.has(v) && v.root.position.distanceTo(best.obj.position) < 2.4) {
                    hit.add(v);
                    onHit(v);
                    v.play("lie");
                    const fly = self.dir.clone().multiplyScalar(9).add(new THREE.Vector3(0, 7, 0));
                    const t0 = clk.now();
                    const p0 = v.root.position.clone();
                    const flyStep = () => {
                      const tt = (clk.now() - t0) / 1000;
                      v.root.position.set(p0.x + fly.x * tt, Math.max(0, p0.y + fly.y * tt - 9 * tt * tt), p0.z + fly.z * tt);
                      v.root.rotation.z += 0.3;
                      if (tt < 1.2) clk.frame(flyStep);
                      else v.root.rotation.z = 0;
                    };
                    flyStep();
                  }
                }
                if (k < 1) clk.frame(step);
                else res();
              };
              step();
            });
          }
          held = null;
          best.s = 0;
        },
      };
      return self;
    },
  };
}

interface Walker {
  a: Actor;
  path: Path;
  s: number;
  speed: number;
}

function spawnPeds(s3: T3.Scene, L: Loaded, paths: Path[], actors: Actor[], updaters: ((dt: number, t: number) => void)[]) {
  const walkers: Walker[] = [];
  const pool: Actor[] = [];
  const kinds = ["ped0", "ped1", "ped2", "ped3", "ped4", "ped5", "ped6", "ped7", "ped8", "ped9"].filter((k, i) => i < 4 || (L.index.world ?? {})[k]);
  const mk = (i: number) => {
    const a = makeActor(kinds[i % kinds.length], L);
    s3.add(a.root);
    actors.push(a);
    return a;
  };
  let n = 0;
  for (const p of paths) {
    const len = pathLen(p);
    const count = Math.max(3, Math.round(len / (HQ_WORLD ? 24 : 40)));
    for (let i = 0; i < count; i++) {
      const a = mk(n++);
      a.play("walk");
      walkers.push({ a, path: p, s: (len / count) * i + Math.random() * 5, speed: 1.2 + Math.random() * 0.6 });
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = mk(n++);
    a.root.visible = false;
    pool.push(a);
  }
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const frozen = new Set<Actor>();
  const tick = (dt: number) => {
    for (const w of walkers) {
      if (frozen.has(w.a)) continue;
      w.s += w.speed * dt;
      pathAt(w.path, w.s, tmp, dir);
      w.a.root.position.copy(tmp);
      w.a.root.rotation.y = Math.atan2(dir.x, dir.z);
    }
  };
  updaters.push(tick);
  return {
    spare() {
      return pool.pop() ?? mk(n++);
    },
    /** Put n pedestrians on the getaway route, crossing the road. */
    onRoad(_car: unknown, count: number) {
      const out: Actor[] = [];
      const spotsOnRoute = [new THREE.Vector3(33.8, 0, 12), new THREE.Vector3(33.8, 0, -16), new THREE.Vector3(60, 0, -2)];
      for (let i = 0; i < Math.min(count + 1, spotsOnRoute.length); i++) {
        const a = pool.pop() ?? mk(n++);
        a.root.visible = true;
        a.root.position.copy(spotsOnRoute[i]);
        a.root.rotation.y = Math.PI / 2;
        a.play("walk");
        frozen.add(a);
        out.push(a);
      }
      return out;
    },
  };
}

// ------------------------------------------------------------------ actor construction & movement

function makeActor(id: string, L: Loaded): Actor {
  const a = new Actor(id);
  const C = L.index.chars ?? {};
  const W = L.index.world ?? {};
  const asset: CharAsset | WorldAsset | undefined = C[id] ?? W[id];
  const baseFile = asset ? ("base" in asset ? asset.base : (asset as WorldAsset).file) : undefined;
  const g = baseFile ? L.gltf.get(baseFile) : null;
  const def = CHARACTERS[id];
  const bulk = def?.look?.bulk ?? 1;
  const isPed = id.startsWith("ped");
  const targetH = isPed ? 1.7 + Math.random() * 0.15 : id === "GRONNY" ? 1.95 : bulk >= 2 ? 1.8 : 1.8;
  if (g) {
    // SkeletonUtils-free clone: the pedestrians share models, so clone with skeletons rebound
    const obj = cloneSkinned(g.scene);
    const holder = new THREE.Group();
    holder.add(obj);
    obj.rotation.y = asset?.yaw ?? 0;
    // made with feet at the origin, facing +z, at a known height
    const known = asset && "base" in asset ? (asset.h ?? 1.8) : ((asset as WorldAsset | undefined)?.size?.[1] ?? 1.75);
    obj.scale.setScalar(targetH / known);
    obj.traverse((o) => {
      const m = o as T3.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    a.model = holder;
    a.height = targetH;
    a.mixer = new THREE.AnimationMixer(obj);
    const clips = asset?.clips ?? {};
    for (const [name, ref] of Object.entries(clips)) {
      const [file, clipName] = ref.split("#");
      const src = L.gltf.get(file);
      const clip = src ? (clipName ? src.animations.find((c) => c.name === clipName) : src.animations[0]) : undefined;
      if (clip) a.clips[name] = inPlace(clip);
    }
    if (!a.clips.idle && g.animations[0]) a.clips.idle = g.animations[0];
  } else {
    const face = L.tex.get(`face_${id}`);
    const { obj, parts, height } = standInBody(isPed ? `FOLK${id.slice(3)}` : id, face);
    if (isPed) {
      // tint the stand-in pedestrians so the crowd isn't all one man
      const tints = [0x2563eb, 0xdc2626, 0x16a34a, 0x9333ea, 0xf59e0b, 0x0ea5e9];
      obj.traverse((o) => {
        const m = o as T3.Mesh;
        if (m.isMesh && Math.random() < 0.5) m.material = new THREE.MeshLambertMaterial({ color: tints[Math.floor(Math.random() * tints.length)] });
      });
    }
    a.model = obj;
    a.fb = parts;
    a.height = height;
  }
  a.root.add(a.model);
  a.play("idle");
  return a;
}

/** Keep a clip on the spot: the hips may bob and drop, but not wander off across the plaza. */
const inPlaceCache = new WeakMap<T3.AnimationClip, T3.AnimationClip>();
function inPlace(clip: T3.AnimationClip): T3.AnimationClip {
  const hit = inPlaceCache.get(clip);
  if (hit) return hit;
  const c = clip.clone();
  for (const t of c.tracks) {
    if (!/hips\.position$/i.test(t.name)) continue;
    const v = t.values;
    const x0 = v[0];
    const z0 = v[2];
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x0;
      v[i + 2] = z0;
    }
  }
  inPlaceCache.set(clip, c);
  return c;
}

/** Clone a (possibly skinned) model so each copy animates on its own skeleton. */
function cloneSkinned(src: T3.Object3D): T3.Object3D {
  const clone = src.clone(true);
  const srcBones: T3.Bone[] = [];
  const dstBones: T3.Bone[] = [];
  src.traverse((o) => {
    if ((o as T3.Bone).isBone) srcBones.push(o as T3.Bone);
  });
  clone.traverse((o) => {
    if ((o as T3.Bone).isBone) dstBones.push(o as T3.Bone);
  });
  const map = new Map<T3.Bone, T3.Bone>();
  srcBones.forEach((b, i) => map.set(b, dstBones[i]));
  const srcMeshes: T3.SkinnedMesh[] = [];
  src.traverse((o) => {
    if ((o as T3.SkinnedMesh).isSkinnedMesh) srcMeshes.push(o as T3.SkinnedMesh);
  });
  let i = 0;
  clone.traverse((o) => {
    const sm = o as T3.SkinnedMesh;
    if (sm.isSkinnedMesh) {
      const orig = srcMeshes[i++];
      const bones = orig.skeleton.bones.map((b) => map.get(b) ?? b);
      sm.bind(new THREE.Skeleton(bones, orig.skeleton.boneInverses), orig.bindMatrix);
    }
  });
  return clone;
}

function moveTo(a: Actor, x: number, z: number, speed: number) {
  a.faceTo(x, z);
  return new Promise<void>((res) => {
    let last = clk.now();
    const step = () => {
      const now = clk.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dx = x - a.root.position.x;
      const dz = z - a.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) return res();
      const s = Math.min(d, speed * dt);
      a.root.position.x += (dx / d) * s;
      a.root.position.z += (dz / d) * s;
      clk.frame(step);
    };
    step();
  });
}

function hop(a: Actor, x: number, z: number, y: number, height: number, ms: number) {
  const p0 = a.root.position.clone();
  return new Promise<void>((res) => {
    const t0 = clk.now();
    const step = () => {
      const k = Math.min(1, (clk.now() - t0) / ms);
      a.root.position.set(lerp(p0.x, x, k), lerp(p0.y, y, k) + Math.sin(k * Math.PI) * height, lerp(p0.z, z, k));
      if (k < 1) clk.frame(step);
      else res();
    };
    step();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** "KRELWORLD 64", in the colours of a certain console's logo. */
function logo64() {
  const cols = ["#e60012", "#00a0e9", "#009944", "#f8b500"];
  const word = "KRELWORLD"
    .split("")
    .map((ch, i) => `<span style="color:${cols[i % 4]};text-shadow:3px 3px 0 #000">${ch}</span>`)
    .join("");
  return `${word} <span style="color:#fff;text-shadow:4px 4px 0 #e60012, 8px 8px 0 #000">64</span>`;
}
