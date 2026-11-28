// The pictures and noises for pranks.ts: a small clear prop for each one that has nothing standing in the
// world already (fuse boxes, a valve, the tannoy, a wheelie bin that can lie down), what each looks like once
// it's been set off, and the one-off effects (sparks, spray, a second ball in the air). Read-only over the
// sim: what's standing or fallen comes from st.rigs, so a reload shows the same thing.
// Drawn through the same two routes as the rigs: Phaser Graphics in the flat picture, and the same calls
// re-targeted into the world (three/gfx.ts) in the 3D one, stood up at their own depth so walls and people hide them.
import Phaser from "phaser";
import type { Actor, WorldState } from "../core/types";
import type { World } from "../core/world";
import { areaAt, SPOTS, VENUE } from "../stadium/layout";
import { RIGS, rigReady } from "../stadium/rigs";
import { buntingLine, PRANK_IDS } from "../stadium/pranks";
import type { Audio } from "./audio";
import type { Projection } from "./projection";
import type { Paint3D } from "./three/gfx";
import type { Stage3D } from "./three/stage";

/** What this needs of the scene. */
export interface PrankHost {
  P: Projection; stage: Stage3D | null; add: Phaser.GameObjects.GameObjectFactory; cameras: Phaser.Cameras.Scene2D.CameraManager;
  audio: Audio; w: World; s: WorldState; pc: Actor; rules: Set<string>;
  pcLine: { text: string; until: number } | null; trauma: number;
}
type G = Phaser.GameObjects.Graphics;
interface Fx { kind: string; x: number; y: number; t0: number; to?: { x: number; y: number }; n?: number }
interface View {
  prop: G; top: G; dark: G; fx: Fx[]; texts: Map<string, Phaser.GameObjects.Text>; seen: Set<string>;
  /** When each was last set off or put right (wall clock), for the falling-over and the fading. */
  at: Map<string, number>; plop: { x: number; y: number } | null;
  /** Which stage the two pens were made for (the 3D one can be dropped for the flat picture mid-game). */
  stage: Stage3D | null;
}
const VIEWS = new WeakMap<object, View>();
const DPR = Math.max(1, Math.min(3, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
const GOLD = 0xffd75a, INK = 0x15171a;
const kindOf = (id: string) => id.replace(/_[we]$/, "");
const mxs = () => (VENUE.id === "sf" ? -1 : 1);

function view(h: PrankHost): View {
  let v = VIEWS.get(h);
  const pens = () => ({
    prop: h.stage ? (h.stage.paint({ mode: "up", order: 4.4 }) as unknown as G) : h.add.graphics().setDepth(0.63),
    top: h.stage ? (h.stage.paint({ mode: "up", order: 5.7 }) as unknown as G) : h.add.graphics().setDepth(9.7e6),
  });
  if (!v) { v = { ...pens(), dark: h.add.graphics().setDepth(9.65e6), fx: [], texts: new Map(), seen: new Set(), at: new Map(), plop: null, stage: h.stage }; VIEWS.set(h, v); }
  else if (v.stage !== h.stage) { v.prop.clear(); v.top.clear(); Object.assign(v, pens()); v.stage = h.stage; }
  return v;
}

/** One pen for one prop: its foot on the ground, and rectangles measured from there in art pixels (32 to the metre). */
class Pen {
  fx = 0; fy = 0; u = 1; hz = 1;
  constructor(public g: G, public p3: Paint3D | null, public P: Projection) { this.u = P.S / 32; this.hz = this.u * P.KZ; }
  /** Stand at (x, y): what follows is drawn upright there. */
  at(x: number, y: number, bias = 0.06): this { this.p3?.at(x, y, bias); this.fx = this.P.sx(x, y); this.fy = this.P.sy(x, y); return this; }
  /** Lie on the ground. */
  flat(lift = 0.045): this { this.p3?.flat(lift); return this; }
  /** A box `w` wide whose bottom is `up` pixels above the foot and which is `h` tall, `dx` from the middle. */
  box(dx: number, up: number, w: number, h: number, col: number, a = 1): this { this.g.fillStyle(col, a).fillRect(this.fx + (dx - w / 2) * this.u, this.fy - (up + h) * this.hz, w * this.u, h * this.hz); return this; }
  /** The same with a dark outline, which is what makes a small thing read at phone size. */
  slab(dx: number, up: number, w: number, h: number, col: number): this { return this.box(dx, up - 1, w + 2, h + 2, INK).box(dx, up, w, h, col); }
  dot(dx: number, up: number, r: number, col: number, a = 1): this { this.g.fillStyle(col, a).fillCircle(this.fx + dx * this.u, this.fy - up * this.hz, r * this.u); return this; }
  ring(dx: number, up: number, r: number, col: number, a: number, w = 2): this { this.g.lineStyle(w * this.u, col, a).strokeCircle(this.fx + dx * this.u, this.fy - up * this.hz, r * this.u); return this; }
  line(x0: number, u0: number, x1: number, u1: number, w: number, col: number, a = 1): this { this.g.lineStyle(w * this.u, col, a).lineBetween(this.fx + x0 * this.u, this.fy - u0 * this.hz, this.fx + x1 * this.u, this.fy - u1 * this.hz); return this; }
  tri(x0: number, u0: number, x1: number, u1: number, x2: number, u2: number, col: number, a = 1): this { this.g.fillStyle(col, a).fillTriangle(this.fx + x0 * this.u, this.fy - u0 * this.hz, this.fx + x1 * this.u, this.fy - u1 * this.hz, this.fx + x2 * this.u, this.fy - u2 * this.hz); return this; }
  /** A puddle or a shadow on the ground at (x, y), `w` by `d` metres. */
  pool(x: number, y: number, w: number, d: number, col: number, a: number): this { this.g.fillStyle(col, a).fillEllipse(this.P.sx(x, y), this.P.sy(x, y), w * this.P.S, d * this.P.S * this.P.K); return this; }
}

function text(h: PrankHost, v: View, key: string, str: string, x: number, y: number, z: number, metres: number, colour: string): void {
  let t = v.texts.get(key);
  if (!t) { t = h.add.text(0, 0, str, { fontFamily: "monospace", fontSize: "20px", fontStyle: "bold", color: colour, align: "center" }).setOrigin(0.5, 0.5).setResolution(2).setDepth(9.71e6); v.texts.set(key, t); }
  if (t.text !== str) t.setText(str);
  t.setColor(colour).setPosition(h.P.sx(x, y), h.P.sy(x, y, z)).setScale((metres * h.P.S * h.P.KZ) / 20).setVisible(true);
  v.seen.add(key);
}

/** A little burst of sparks. */
function sparks(pen: Pen, dx: number, up: number, t: number, n = 7): void {
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + 0.5, k = (t * 2.2 + i * 0.13) % 1, r = 4 + k * 22;
    pen.dot(dx + Math.cos(a) * r, up + Math.sin(a) * r * 0.7 - k * k * 14, 1.8 - k, i % 2 ? 0xfff2a0 : 0xffb02a, 1 - k);
  }
}

export function prankEvent(h: PrankHost, e: any): void {
  if (e.type !== "rig" || !PRANK_IDS.includes(e.rig)) return;
  const v = view(h), a = h.audio, now = performance.now(), id: string = e.rig;
  const line = (text: string, ms = 2000) => { h.pcLine = { text, until: now + ms }; };
  const fx = (kind: string, extra: Partial<Fx> = {}) => { v.fx.push({ kind, x: e.x, y: e.y, t0: now, ...extra }); if (v.fx.length > 24) v.fx.shift(); };
  if (e.reset) { v.at.set(id, -now); if (id === "lights") a.play("crowd_ooh", 0.5); if (id === "horse") v.plop = null; return; }
  if (e.step === 1) v.at.set(id, now);
  switch (kindOf(id)) {
    case "bin": a.play("barrier_clang", 0.9, { rate: 0.7 }); a.play("glass_smash", 0.35, { rate: 0.8 }); h.cameras.main.shake(110, 0.003); line("Have that."); break;
    case "sign": a.play("turnstile_clunk", 0.9, { rate: 0.7 }); fx("turn"); line("Entrance is that way, lads. Heh."); break;
    case "van": if (e.hiss) { a.play("fart", 0.45, { rate: 0.45 }); fx("hiss"); line("Psssss."); } else a.play("bodyfall", 0.7, { rate: 0.8 }); break;
    case "phone": for (let i = 0; i < 3; i++) setTimeout(() => a.play("desk_bell", 0.7, { rate: 1.5, minGap: 0.05 }), i * 420); fx("ring"); line("...Is that the Three Lions?", 2200); break;
    case "soldout": a.play("tap", 0.8); a.play("groan", 0.5); line("Sold out. Shame."); break;
    case "fuse": a.play("scan_bad", 0.9, { rate: 0.6 }); a.play("glass_smash", 0.25, { rate: 1.4 }); fx("sparks"); h.cameras.main.shake(90, 0.003); line("Lights out."); break;
    case "bunting": a.play("whoosh", 0.9, { rate: 0.7 }); line("Mind how you go."); break;
    case "cable": a.play("scan_bad", 0.9, { rate: 0.5 }); a.play("radio_squelch", 0.7); fx("sparks"); line("And we're off air."); break;
    case "horse":
      if (e.feed) { a.play("munch", 0.9); fx("kebab"); line("There you go, boy. Extra chilli."); }
      else if (e.plop) { a.play("fart", 0.9, { rate: 0.7 }); a.play("splat", 0.8); a.play("whinny", 0.6); v.plop = e.to; h.cameras.main.shake(120, 0.003); }
      break;
    case "skip": if (e.light) { a.play("flare", 0.6); line("Careless."); } else { a.play("gas_whoomph", 0.55, { rate: 1.2 }); h.cameras.main.shake(160, 0.004); } break;
    case "gas": a.play("fart", 0.5, { rate: 0.5 }); a.play("groan", 0.6); fx("hiss"); line("Dry as a bone."); break;
    case "tannoy": a.play("chime", 0.9); if (e.msg === 2) setTimeout(() => a.play("crowd_jeer", 0.6), 1500); else setTimeout(() => a.play("crowd_ooh", 0.5), 1500); fx("ring"); line(`"${e.text}."`, 2600); break;
    case "lights": a.play("scan_bad", 1, { rate: 0.5 }); setTimeout(() => a.play("boo", 0.6), 500); fx("sparks"); h.trauma = Math.min(1, h.trauma + 0.2); line("Who turned the lights out?"); break;
    case "sprinklers": a.play("sewer_gush", 0.6, { rate: 1.5 }); setTimeout(() => a.play("crowd_jeer", 0.5), 700); line("Bit dry, that pitch."); break;
    case "score": a.play("scan_beep", 0.9); setTimeout(() => a.play("groan", 0.8), 500); line("Seven. Go on."); break;
    case "ball": if (e.thrown) { a.play("kick", 0.9); fx("ball", { to: e.to }); line("Have another!"); } else a.play("whistle", 0.7, { minGap: 1 }); break;
    case "hoarding": a.play("barrier_clang", 1, { rate: 0.55 }); a.play("bodyfall", 0.7); h.cameras.main.shake(140, 0.004); line("Timber."); break;
    case "medics": if (e.shout) { a.play("crowd_ooh", 0.6); fx("ring"); line("MEDIC! MAN DOWN!", 2200); } break;
    case "sinks": a.play("drain", 0.8); a.play("sewer_gush", 0.35, { rate: 1.3 }); line("Wash your hands, lads."); break;
  }
}

export function drawPranks(h: PrankHost): void {
  const v = view(h), P = h.P, now = performance.now(), pc = h.pc, st = h.s.stadium!, m = mxs();
  const g = v.prop.clear(), tg = v.top.clear();
  const p3 = h.stage ? (g as unknown as Paint3D) : null, t3 = h.stage ? (tg as unknown as Paint3D) : null;
  const pen = new Pen(g, p3, P), fxp = new Pen(tg, t3, P);
  v.seen.clear();
  const known = [...h.rules].filter((q) => q.startsWith("rig_")).length >= 2;
  const view2 = h.cameras.main.worldView, pad = 6 * P.S;
  const onScreen = (x: number, y: number) => { const sx = P.sx(x, y), sy = P.sy(x, y); return sx > view2.x - pad && sx < view2.right + pad && sy > view2.y - pad && sy < view2.bottom + pad * 2; };
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);
  // The floodlights (seen from inside the ground) and the pub's lights (from inside the pub).
  const dark = v.dark.clear();
  const here = pc ? areaAt(pc.x, pc.y).id : "";
  const out = (st.rigs?.lights?.step && pc && VENUE.inside(pc.x, pc.y)) || (st.rigs?.fuse?.step && here.startsWith("pub") && here !== "pub_yard");
  if (out) { const k = Math.min(1, (now - Math.abs(v.at.get(st.rigs?.lights?.step ? "lights" : "fuse") ?? 0)) / 250); dark.fillStyle(0x05070c, 0.55 * k).fillRect(view2.x - 50, view2.y - 50, view2.width + 100, view2.height + 100); }

  // One ring at a time (the noise complaint stands): the nearest ready one of a kind he's not tried, till he's tried two kinds.
  let ringed = "", rd = 13;
  if (!known && pc && !pc.hiddenIn) for (const id of PRANK_IDS) {
    if (h.rules.has(`rig_${kindOf(id)}`) || !RIGS[id]) continue;
    const at = RIGS[id].at(), d = Math.hypot(at.x - pc.x, at.y - pc.y);
    if (d < rd && rigReady(h.w, id)) { rd = d; ringed = id; }
  }
  for (const id of PRANK_IDS) {
    const def = RIGS[id];
    if (!def || (def.on && !def.on(h.w) && !st.rigs?.[id]?.step)) continue;
    const at = def.at(), r = st.rigs?.[id], on = !!r?.step, ready = !on && rigReady(h.w, id);
    if (!onScreen(at.x, at.y)) continue;
    const since = (now - Math.abs(v.at.get(id) ?? -1e9)) / 1000, near = !!pc && !pc.hiddenIn && Math.hypot(at.x - pc.x, at.y - pc.y) < 13;
    // Where to hang the glint that says "this does something" (art pixels from the foot).
    let gx = 0, gup = 30;
    pen.at(at.x, at.y);
    switch (kindOf(id)) {
      case "bin": {
        // A council wheelie bin: upright, or on its side with its lid open and what was in it across the pavement.
        const sgn = (id === "bin_w" ? -1 : 1) * m;
        if (!on) { pen.box(0, 0, 26, 3, 0x000000, 0.25).slab(0, 4, 20, 34, 0x3f7a4a).box(-6, 4, 5, 34, 0x56975f).slab(0, 38, 24, 5, 0x2f5d39).dot(-7, 3, 4, INK).dot(7, 3, 4, INK).box(0, 22, 10, 2, 0x2f5d39); gup = 30; }
        else {
          const k = Math.min(1, since / 0.25);
          pen.flat(); pen.pool(at.x + sgn * 1.4, at.y + 0.8, 2.6 * k, 1.5 * k, 0x4a3a22, 0.45);
          pen.at(at.x, at.y);
          pen.slab(sgn * 14, 2, 36, 18, 0x3f7a4a).box(sgn * 14, 14, 36, 4, 0x56975f).slab(sgn * 35, 0, 5, 24, 0x2f5d39).dot(-sgn * 4, 5, 4, INK);
          // Rubbish: bags, a can, chip papers.
          pen.at(at.x + sgn * 1.4, at.y + 0.8, 0.02);
          for (let i = 0; i < 9; i++) { const a = i * 2.2, rr = (8 + (i * 7) % 20) * k; pen.dot(Math.cos(a) * rr * 1.5, 2 + Math.abs(Math.sin(a)) * 5, 2.5 + (i % 3), [0xe8e0c8, 0x8a8f96, 0xc8102e, 0x1d1f24][i % 4]); }
          pen.dot(-6 * k, 5, 6, 0x1d1f24).dot(8 * k, 4, 5, 0x24262b);
        }
        break;
      }
      case "sign": {
        // (The sign's its own picture.) Turned: an arrow board on it pointing at the wall, swinging a bit.
        if (on) {
          const to = id === "sign_w" ? -1 : 1, sw = Math.sin(now / 260) * 2, dir = to * m;
          pen.at(at.x, at.y, 0.12).slab(sw, 46, 46, 14, 0xf2c94c);
          pen.tri(dir * 22 + sw, 53, dir * 8 + sw, 59, dir * 8 + sw, 47, INK).box(-dir * 4 + sw, 51, 24, 4, INK);
        }
        gup = 40;
        break;
      }
      case "van": {
        // The wheel: hissing, then flat, with the jack he hasn't got.
        if (on) { pen.flat(); pen.pool(at.x, at.y - 0.1, 1.0, 0.34, 0x0a0a0a, 0.8); pen.at(at.x, at.y, 0.1).slab(0, 0, 22, 5, 0x1d1f24).box(0, 4, 12, 2, 0x8a8f96); }
        gup = 10;
        break;
      }
      case "phone": gup = 50; break;
      case "soldout": {
        // A board on a post by the window: TICKETS, or (flipped) SOLD OUT.
        pen.box(0, 0, 12, 3, 0x000000, 0.25).slab(0, 0, 3, 40, 0x5d6470).slab(0, 34, 60, 18, on ? 0xc8102e : 0xf4f1ea);
        if (near || on) text(h, v, id, on ? "SOLD OUT" : "TICKETS", at.x, at.y, 43 / 32, 0.26, on ? "#ffffff" : "#1b2a6b");
        gup = 58;
        break;
      }
      case "fuse": case "lights": {
        // A grey box on the wall with a yellow lightning plate; door hanging open once it's been pulled.
        pen.slab(0, 26, 20, 26, 0x8a9098).box(-7, 26, 3, 26, 0xb8bec6).slab(0, 34, 12, 10, 0xf2c94c);
        pen.tri(1, 43, -3, 38, 0, 38, INK).tri(0, 39, 3, 39, -1, 35, INK);
        pen.box(0, 0, 3, 26, 0x5d6470);
        if (on) { pen.slab(15, 26, 10, 26, 0x6a7078).dot(0, 39, 3, 0x1d1f24); if (since < 1.2) { fxp.at(at.x, at.y, 0.14); sparks(fxp, 0, 40, since); } }
        else pen.slab(8, 30, 4, 12, 0xd7263d);
        gup = 39;
        break;
      }
      case "bunting": break; // drawn below, end to end
      case "cable": {
        // A junction box on the tarmac with the truck's fat cable in it; pulled, the end lies loose and spits.
        pen.flat(0.05); g.lineStyle(4 * pen.u, INK, 1).lineBetween(P.sx(at.x + m * 0.9, at.y - 0.5), P.sy(at.x + m * 0.9, at.y - 0.5), P.sx(at.x + (on ? m * 0.5 : 0), at.y + (on ? 0.5 : 0)), P.sy(at.x + (on ? m * 0.5 : 0), at.y + (on ? 0.5 : 0)));
        pen.at(at.x, at.y).box(0, 0, 18, 3, 0x000000, 0.25).slab(0, 0, 14, 12, 0xf2c94c).box(0, 8, 14, 2, INK).dot(0, 5, 3, on ? 0x1d1f24 : 0xd7263d);
        if (on && since < 6) { fxp.at(at.x + m * 0.5, at.y + 0.5, 0.1); sparks(fxp, 0, 4, since, 5); }
        gup = 8;
        break;
      }
      case "horse": gup = 26; break;
      case "skip": {
        if (on && since > 1.8) { fxp.at(at.x, at.y - 0.6, 0.1); for (let i = 0; i < 6; i++) { const f = 0.5 + 0.5 * Math.sin(now / 80 + i * 2.1); fxp.tri((i - 2.5) * 12 - 7, 34, (i - 2.5) * 12 + 7, 34, (i - 2.5) * 12 + Math.sin(now / 130 + i) * 3, 46 + f * 22, i % 2 ? 0xff9a2a : 0xffd23a, 0.85); } }
        else if (on) { fxp.at(at.x, at.y - 0.6, 0.1).dot(4, 40 + since * 6, 3 + since * 2, 0xd9d9d4, 0.5); }
        gup = 34;
        break;
      }
      case "gas": {
        // A lager gas bottle chained to the end of the bar, with a red wheel on top.
        pen.box(0, 0, 16, 3, 0x000000, 0.25).slab(0, 0, 12, 34, 0x6f7a86).box(-3, 0, 3, 34, 0x9aa5b1).slab(0, 34, 6, 5, 0x3a3d42).box(0, 16, 12, 5, 0xf4f1ea);
        pen.dot(0, 42, 6, INK).dot(0, 42, 4.5, on ? 0x3fcf5c : 0xd7263d).dot(0, 42, 1.5, INK);
        if (on && since < 2) { fxp.at(at.x, at.y, 0.1); for (let i = 0; i < 4; i++) { const k = (since * 1.6 + i / 4) % 1; fxp.dot(Math.sin(i * 2 + since * 5) * 4, 46 + k * 22, 3 + k * 4, 0xffffff, 0.3 * (1 - k)); } }
        gup = 42;
        break;
      }
      case "tannoy": {
        // A microphone on a bendy stalk out of a wall box, under a grey horn speaker.
        pen.box(0, 0, 3, 30, 0x5d6470).slab(0, 28, 18, 12, 0x2a2f38).dot(-5, 34, 2, 0xd7263d).dot(1, 34, 2, 0x3fcf5c);
        pen.line(6, 40, 12, 50, 2.5, INK).dot(12, 52, 4.5, INK).dot(12, 52, 3.2, 0x9aa5b1);
        pen.tri(-12, 62, 8, 70, 8, 54, INK).tri(-10, 62, 6, 68, 6, 56, 0xb8bec6).box(9, 58, 4, 8, INK);
        gup = 50; gx = 12;
        break;
      }
      case "sprinklers": {
        // A standpipe with a red wheel at the foot of the stand.
        pen.box(0, 0, 14, 3, 0x000000, 0.25).slab(0, 0, 7, 22, 0x8a9098).box(-2, 0, 2, 22, 0xb8bec6).slab(0, 12, 14, 4, 0x6a7078);
        const a = on ? now / 90 : 0;
        pen.dot(0, 26, 8, INK).dot(0, 26, 6.5, 0xd7263d).dot(0, 26, 2, INK).line(Math.cos(a) * 6, 26 + Math.sin(a) * 6, -Math.cos(a) * 6, 26 - Math.sin(a) * 6, 1.6, INK).line(-Math.sin(a) * 6, 26 + Math.cos(a) * 6, Math.sin(a) * 6, 26 - Math.cos(a) * 6, 1.6, INK);
        gup = 26;
        break;
      }
      case "score": {
        // A control box on the wall with a little screen showing what the big board says.
        pen.box(0, 0, 3, 24, 0x5d6470).slab(0, 24, 30, 22, 0x2a2f38).slab(0, 34, 24, 9, on ? 0x3a0a0a : 0x0a1a0a);
        for (let i = 0; i < 4; i++) pen.dot(-9 + i * 6, 29, 1.8, [0xd7263d, 0xf2c94c, 0x3fcf5c, 0x9aa5b1][i]);
        if (near || on) { const mt = h.s.match; text(h, v, id, on ? "ENG 0-7" : `ENG ${mt?.score[0] ?? 0}-${mt?.score[1] ?? 0}`, at.x, at.y, 38.5 / 32, 0.2, on ? "#ff5a4a" : "#6fe07f"); }
        gup = 38;
        break;
      }
      case "ball": {
        // A net bag of spare balls.
        pen.box(0, 0, 26, 3, 0x000000, 0.25);
        for (const [dx, up] of [[-7, 5], [5, 5], [-1, 13], [9, 12]] as const) pen.dot(dx, up, 6.5, INK).dot(dx, up, 5.4, 0xf4f4f4).dot(dx - 1, up + 1, 1.8, INK);
        pen.line(-13, 0, 0, 22, 1.2, 0xc8a24a).line(14, 0, 0, 22, 1.2, 0xc8a24a).line(-13, 9, 14, 9, 1, 0xc8a24a);
        gup = 12;
        break;
      }
      case "hoarding": {
        // Four panels of advertising along the touchline; over they go, flat, towards the pitch.
        const k = on ? Math.min(1, since / 0.28) : 0, hx = at.x + m * 0.5;
        for (let i = 0; i < 4; i++) {
          const y = at.y - 2.25 + i * 1.5;
          if (k < 1) { pen.at(hx, y).slab(0, 0, 44, 26 * (1 - k * 0.8), i % 2 ? 0xc8102e : 0xf4f1ea).box(0, 9 * (1 - k * 0.8), 30, 6 * (1 - k * 0.8), i % 2 ? 0xf4f1ea : 0x1b2a6b); }
          else { pen.flat(0.06); const [rx, ry, rw, rh] = P.rect(hx + (m > 0 ? 0.1 : -1.1), y - 0.7, 1, 1.4); g.fillStyle(INK, 1).fillRect(rx - 1, ry - 1, rw + 2, rh + 2).fillStyle(i % 2 ? 0x9a1226 : 0xc9c6bf, 1).fillRect(rx, ry, rw, rh); }
        }
        pen.at(at.x, at.y);
        gup = 16; gx = m * 16;
        break;
      }
      case "medics": {
        // The first-aid point: a green box with a white cross, and a folded stretcher leaning on it.
        pen.box(0, 0, 3, 22, 0x5d6470).slab(0, 22, 22, 22, 0x1f8a4c).box(0, 30, 14, 5, 0xffffff).box(0, 25.5, 5, 14, 0xffffff);
        pen.slab(16, 0, 5, 40, 0xe86a2a).box(16, 0, 1.5, 44, 0x9aa5b1);
        gup = 33;
        break;
      }
      case "sinks": {
        // (The sinks are their own picture.) Flooded: water across the floor, and the taps still going.
        if (on) {
          const k = Math.min(1, since / 2.5);
          pen.flat(); pen.pool(at.x + m * 0.5, at.y + 1.3, 6.5 * k, 3.6 * k, 0x6fa8c8, 0.5); pen.pool(at.x + m * 1.2, at.y + 1.0, 3 * k, 1.6 * k, 0xa8d4ea, 0.45);
          fxp.at(at.x, at.y - 0.5, 0.1); for (let i = 0; i < 3; i++) { const dk = (now / 500 + i / 3) % 1; fxp.dot(-34 + i * 34, 26 - dk * 24, 2.4, 0xa8d4ea, 0.9); }
        }
        gup = 26;
        break;
      }
    }
    // "This does something": a glint on it, and, the first couple of times, a gold ring on the ground round the nearest one.
    if (ready && near) {
      const k = 5 + pulse * 4;
      fxp.at(at.x, at.y, 0.16).line(gx - k, gup, gx + k, gup, 2.6, INK, 0.5).line(gx, gup - k, gx, gup + k, 2.6, INK, 0.5)
        .line(gx - k, gup, gx + k, gup, 1.4, GOLD, 0.9).line(gx, gup - k, gx, gup + k, 1.4, GOLD, 0.9).dot(gx, gup, 2, 0xfff6d0, 0.95);
      if (id === ringed) {
        pen.flat(0.04);
        g.lineStyle(3, 0x000000, 0.35).strokeEllipse(P.sx(at.x, at.y), P.sy(at.x, at.y) + 2, 2.3 * P.S * 1.05, 2.3 * P.S * 0.42);
        g.lineStyle(2, GOLD, 0.45 + 0.4 * pulse).strokeEllipse(P.sx(at.x, at.y), P.sy(at.x, at.y), 2.3 * P.S * (1 + 0.06 * pulse), 2.3 * P.S * 0.4 * (1 + 0.06 * pulse));
      }
    }
  }

  // The bunting: flags on a line between two trees, or the same line lying across the pavement.
  if (RIGS.bunting?.on?.(h.w) || st.rigs?.bunting?.step) {
    const b = buntingLine(), on = !!st.rigs?.bunting?.step, since = (now - Math.abs(v.at.get("bunting") ?? -1e9)) / 1000, drop = on ? Math.min(1, since / 0.35) : 0;
    if (onScreen(b.x0, b.y) || onScreen(b.x1, b.y)) {
      const n = 13, cols = [0xc8102e, 0xf4f1ea, 0x1b2a6b];
      if (drop >= 1) pen.flat(0.05); else p3?.at(undefined, b.y + 0.05, 0.05);
      let px0 = 0, py0 = 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = b.x0 + (b.x1 - b.x0) * t, sag = Math.sin(t * Math.PI) * 0.35, z = drop >= 1 ? 0 : (2.7 - sag) * (1 - drop);
        const y = b.y + (drop >= 1 ? 0.3 + Math.sin(i * 1.9) * 0.18 : 0), sx = P.sx(x, y), sy = P.sy(x, y, z), u = P.S / 32;
        if (i) g.lineStyle(1.5 * u, INK, 1).lineBetween(px0, py0, sx, sy);
        if (i && i < n) g.fillStyle(cols[i % 3], 1).fillTriangle(sx - 6 * u, sy, sx + 6 * u, sy, sx + (drop >= 1 ? 3 * u : 0), sy + 11 * u * (drop >= 1 ? P.K : 1));
        px0 = sx; py0 = sy;
      }
    }
  }
  // The sprinklers: six heads on the pitch throwing arcs round.
  if (st.rigs?.sprinklers?.step) {
    for (const [hx, hy] of [[-24, -12], [0, -12], [24, -12], [-24, 12], [0, 12], [24, 12]] as const) {
      if (!onScreen(hx, hy)) continue;
      fxp.at(hx, hy, 0.05).dot(0, 2, 3, 0x8a9098);
      for (let j = 0; j < 2; j++) {
        const a = now / 700 + j * Math.PI + hx * 0.1, cx = Math.cos(a), cy = Math.sin(a);
        for (let i = 1; i <= 9; i++) { const t = i / 9, d = t * 7.5, z = Math.sin(t * Math.PI) * 1.9 + 0.1, x = hx + cx * d, y = hy + cy * d * 0.9; tg.fillStyle(0xcfe9f7, 0.75 - t * 0.35).fillCircle(P.sx(x, y), P.sy(x, y, z), (2 + t * 2.4) * (P.S / 32)); }
      }
      fxp.flat(0.04); fxp.pool(hx, hy, 9, 9, 0x6fa8c8, 0.12);
    }
  }
  // The second ball, sat on the pitch till somebody fetches it.
  if (st.rigs?.ball?.step && RIGS.ball) {
    const a0 = RIGS.ball.at(), to = { x: a0.x - m * 3, y: 13 };
    if (!v.fx.some((f) => f.kind === "ball") && onScreen(to.x, to.y)) { fxp.flat(); fxp.pool(to.x, to.y + 0.05, 0.5, 0.22, 0x000000, 0.3); fxp.at(to.x, to.y, 0.05).dot(0, 5, 5.6, INK).dot(0, 5, 4.6, 0xf4f4f4).dot(-1, 6, 1.6, INK); }
  }
  // What the horse left.
  if (v.plop && st.rigs?.horse?.step) { fxp.flat(); fxp.pool(v.plop.x, v.plop.y, 1.3, 0.7, 0x3a2a12, 0.6); fxp.at(v.plop.x, v.plop.y, 0.03).dot(-5, 3, 6, 0x5a4020).dot(4, 3, 5.5, 0x4a3418).dot(-1, 9, 5, 0x5a4020).dot(1, 14, 3.2, 0x6a4a26); }

  // One-off effects.
  v.fx = v.fx.filter((f) => now - f.t0 < 3200);
  for (const f of v.fx) {
    const t = (now - f.t0) / 1000;
    if (f.kind === "sparks" && t < 1.4) { fxp.at(f.x, f.y, 0.14); sparks(fxp, 0, 38, t, 9); }
    else if (f.kind === "ring" && t < 1.8) { fxp.at(f.x, f.y, 0.14); for (let i = 0; i < 3; i++) { const k = (t * 1.5 + i / 3) % 1; fxp.ring(0, 56, 6 + k * 20, 0xffffff, 0.7 * (1 - k), 1.6); } }
    else if (f.kind === "hiss" && t < 2.2) { fxp.at(f.x, f.y, 0.12); for (let i = 0; i < 5; i++) { const k = (t * 1.8 + i / 5) % 1; fxp.dot(-8 - k * 22, 6 + k * 10 + Math.sin(i * 2 + t * 6) * 3, 2.5 + k * 5, 0xffffff, 0.4 * (1 - k)); } }
    else if (f.kind === "turn" && t < 0.9) { fxp.at(f.x, f.y, 0.14); for (let i = 0; i < 2; i++) { const a = t * 9 + i * Math.PI; fxp.line(Math.cos(a) * 30, 58 + Math.sin(a) * 5, Math.cos(a + 0.6) * 30, 58 + Math.sin(a + 0.6) * 5, 2, 0xffffff, 0.8 * (1 - t / 0.9)); } }
    else if (f.kind === "kebab" && t < 0.7) { const k = t / 0.7, x = pc.x + (f.x - pc.x) * k, y = pc.y + (f.y - pc.y) * k; fxp.at(x, y, 0.2).slab(0, 34 + Math.sin(k * Math.PI) * 18, 12, 6, 0xc58a3e); }
    else if (f.kind === "ball" && f.to && t < 1.1) { const k = t / 1.1, x = f.x + (f.to.x - f.x) * k, y = f.y + (f.to.y - f.y) * k, z = Math.sin(k * Math.PI) * 4 + 0.3; fxp.flat(); fxp.pool(x, y, 0.5, 0.22, 0x000000, 0.25); t3?.at(x, y, 0.1); tg.fillStyle(INK, 1).fillCircle(P.sx(x, y), P.sy(x, y, z), 5.6 * (P.S / 32)).fillStyle(0xf4f4f4, 1).fillCircle(P.sx(x, y), P.sy(x, y, z), 4.6 * (P.S / 32)); }
  }
  for (const [k, t] of v.texts) if (!v.seen.has(k)) t.setVisible(false);
  void SPOTS;
}
