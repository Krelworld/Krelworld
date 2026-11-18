import Phaser from "phaser";
import { vfx } from "../gfx/Vfx";
import type { Player } from "./Player";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { kd } from "../systems/kreddle";
import { playCine } from "../gfx/Cine";

/**
 * GOLDEN JUICE TRANSFORMATION (T). Once per dungeon, if you've had a fresh squeeze beforehand.
 * Golden hair, bulging muscles, a gold flame aura. ATTACK becomes a wide, heavy mega melee; C fires the CUMEHAMEHA.
 */
// (two-thirds of the old 20s)
export const SUPER_MS = 13333;
/** How long the transformation lasts (Kreddle OVERTIME SUPER adds 10s a level). */
export function superMs() {
  return SUPER_MS + 6667 * kd(G.s, "kd_super");
}

type SuperState = { aura: Phaser.GameObjects.GameObject[]; ev: Phaser.Time.TimerEvent; baseBig: number; baseKey: string; hasArt: boolean };
const states = new WeakMap<Player, SuperState>();

export function canTransform() {
  return !!G.s.flags.golden_charge;
}

/** The transformation cutscene: everything freezes, the camera pushes in, you power up, and you come out golden. */
const CUTSCENE_MS = 1800;
/** The first transformation's drawn shot (Cine ch3_golden) holds the freeze this much longer. */
const GOLDEN_CINE_MS = 2600;

export function goSuper(p: Player, now: number) {
  const w = p.world;
  const sc = w.sc;
  if (now < p.superUntil) return;
  if (!G.s.flags.golden_charge) {
    w.floatText(p.x, p.y - 50, "No golden juice in you. Find a squeeze before the next dungeon.", "#fde047", 12);
    return;
  }
  G.s.flags.golden_charge = false;
  // the first time ever: the drawn transformation shot plays in the middle of it (the world stays frozen for it)
  const first = !G.s.flags.c15_golden_cine;
  const CUT = CUTSCENE_MS + (first ? GOLDEN_CINE_MS : 0);
  p.superUntil = now + CUT + superMs();
  p.iframesUntil = now + CUT + 1200;
  // freeze the room while it happens
  w.hitStop(CUT);
  const cam = sc.cameras.main;
  const z0 = cam.zoom;
  sc.tweens.add({ targets: cam, zoom: z0 * 1.7, duration: 320, ease: "Quad.out" });
  const dark = sc.add.rectangle(480, 270, 960, 540, 0x000000, 0).setScrollFactor(0).setDepth(590);
  sc.tweens.add({ targets: dark, fillAlpha: 0.6, duration: 260 });
  w.floatText(p.x, p.y - 50, "Hnnnnnnngh…", "#fde047", 14);
  synth.play("select");
  const x0 = p.spr.x;
  sc.tweens.add({ targets: p.spr, x: x0 + 2, yoyo: true, repeat: 10, duration: 40, onComplete: () => p.spr.setX(x0) });
  // power gathering: sparks rushing in
  const gather = sc.time.addEvent({
    delay: 25,
    repeat: 34,
    callback: () => {
      const a = Math.random() * Math.PI * 2;
      const sp = sc.add.circle(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, 2.5, 0xfde047).setBlendMode(Phaser.BlendModes.ADD).setDepth(600);
      sc.tweens.add({ targets: sp, x: p.x, y: p.y, duration: 240, onComplete: () => sp.destroy() });
      if (Math.random() < 0.15) bolt(p);
    },
  });
  // the moment it happens
  sc.time.delayedCall(950, () => {
    gather.remove();
    synth.play("roar");
    w.shake(900, 0.025);
    cam.flash(450, 255, 240, 160);
    for (let i = 0; i < 10; i++) sc.time.delayedCall(i * 60, () => bolt(p));
    if (!vfx(sc, "vfx_shock", p.x, p.y + 16, { scale: 3, depth: 600, tint: 0xfde047 })) {
      const ring = sc.add.circle(p.x, p.y, 10, 0xffffff, 0).setStrokeStyle(6, 0xfde047).setDepth(600);
      sc.tweens.add({ targets: ring, radius: 160, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    }
    w.floatText(p.x, p.y - 80, "AAAAAAAAAAAHHHHH!!!", "#fde047", 26);
    becomeGolden(p);
    if (first) {
      G.s.flags.c15_golden_cine = true;
      void playCine(sc, "ch3_golden");
    }
  });
  sc.time.delayedCall(CUT - 300, () => {
    sc.tweens.add({ targets: cam, zoom: z0, duration: 300, ease: "Quad.in" });
    sc.tweens.add({ targets: dark, fillAlpha: 0, duration: 300, onComplete: () => dark.destroy() });
    w.toast("GOLDEN JUICE TRANSFORMATION", `${superMs() / 1000}s. ATTACK = mega melee. C = CUMEHAMEHA.`);
  });
}

/** Swap to the golden sprite, start the aura. */
function becomeGolden(p: Player) {
  const sc = p.world.sc;
  const baseKey = p.spr.texture.key;
  const superKey = `spr_SUPER_${p.id}`;
  const hasArt = sc.textures.exists(superKey);
  if (hasArt) p.spr.setTexture(superKey, p.spr.frame.name);
  const baseBig = (p.spr as any).big ?? 1;
  (p.spr as any).big = baseBig * 1.25;
  p.spr.setScale(2);
  const aura: Phaser.GameObjects.GameObject[] = [];
  // no golden art for this one? draw the spikes on
  const hair = hasArt ? null : sc.add.graphics().setDepth(503);
  const drawHair = () => {
    if (!hair) return;
    hair.clear();
    const hx = p.x;
    const hy = p.y - p.spr.displayHeight * 0.36;
    const spikes = [[-22, 6, -30, -26], [-12, 0, -14, -40], [0, -4, 4, -48], [12, 0, 20, -38], [22, 6, 32, -22]];
    hair.fillStyle(0xb45309, 1);
    for (const [xa, ya, tx, ty] of spikes) hair.fillTriangle(hx + xa - 9, hy + ya + 3, hx + xa + 9, hy + ya + 3, hx + tx, hy + ty - 3);
    hair.fillStyle(0xfde047, 1);
    for (const [xa, ya, tx, ty] of spikes) hair.fillTriangle(hx + xa - 7, hy + ya, hx + xa + 7, hy + ya, hx + tx, hy + ty);
  };
  if (hair) aura.push(hair);
  const glow = sc.add.circle(p.x, p.y, 54, 0xfde047, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(498);
  sc.tweens.add({ targets: glow, scale: 1.25, alpha: 0.12, yoyo: true, repeat: -1, duration: 160 });
  aura.push(glow);
  const ev = sc.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      // the player is y-sorted, so the aura has to follow him to stay behind him
      glow.setPosition(p.x, p.y).setDepth(p.spr.depth - 2);
      if (kd(G.s, "kd_aura")) glow.setFillStyle(Phaser.Display.Color.HSVToRGB((sc.time.now / 1500) % 1, 0.8, 1).color, glow.fillAlpha);
      drawHair();
      // a golden flame licking up all round you
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * Math.PI * 2;
        if (k === 1 && Math.random() < 0.5) continue;
        const rainbow = kd(G.s, "kd_aura") > 0;
        const RB = [0xff4d4d, 0xffa53a, 0xfacc15, 0x4ade80, 0x38bdf8, 0xa855f7, 0xff4fd8];
        const f = sc.add.ellipse(p.x + Math.cos(a) * 30, p.y + 18 + Math.sin(a) * 8, 10, 22, rainbow ? RB[Math.floor(Math.random() * RB.length)] : Math.random() < 0.5 ? 0xfacc15 : 0xfff7c2, 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.spr.depth - 1);
        sc.tweens.add({ targets: f, y: f.y - 70 - Math.random() * 40, x: f.x + (Math.random() - 0.5) * 20, alpha: 0, duration: 480, onComplete: () => f.destroy() });
      }
      if (Math.random() < 0.04) bolt(p);
    },
  });
  states.set(p, { aura, ev, baseBig, baseKey, hasArt });
}

export function endSuper(p: Player) {
  const st = states.get(p);
  if (!st) return;
  states.delete(p);
  st.ev.remove();
  for (const o of st.aura) o.destroy();
  if (st.hasArt && p.spr.scene?.textures.exists(st.baseKey)) p.spr.setTexture(st.baseKey, p.spr.frame.name);
  (p.spr as any).big = st.baseBig;
  p.spr.setScale(2);
  p.world.floatText(p.x, p.y - 50, "...the golden juice wears off", "#fde047", 12);
}

/** Called every frame from the player. */
export function superTick(p: Player, now: number) {
  if (now >= p.superUntil && states.has(p)) endSuper(p);
  // a golden shimmer (strong where there's no golden art)
  const st = states.get(p);
  if (st) p.spr.setTint(st.hasArt ? (Math.floor(now / 120) % 2 ? 0xffffff : 0xfff3c4) : Math.floor(now / 90) % 2 ? 0xffd23f : 0xffe680);
}

function bolt(p: Player) {
  const sc = p.world.sc;
  const g = sc.add.graphics().setDepth(600).setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(3, 0xfff7c2, 1);
  let x = p.x + (Math.random() - 0.5) * 60;
  let y = p.y - 60;
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i < 5; i++) g.lineTo((x += (Math.random() - 0.5) * 26), (y += 18));
  g.strokePath();
  sc.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
}

/** The three strikes of the golden combo: jab, hook, then the launcher. */
const COMBO = [
  { anim: "punch", skip: 0, R: 150, arc: 1.0, dmg: 55, bossDmg: 0.008, knock: 150, lunge: 360, cd: 190, stop: 55, shake: 0.008, dur: 230 },
  { anim: "punch", skip: 2, R: 160, arc: 1.25, dmg: 70, bossDmg: 0.01, knock: 220, lunge: 400, cd: 210, stop: 70, shake: 0.011, dur: 260 },
  { anim: "upper", skip: 0, R: 205, arc: 1.6, dmg: 140, bossDmg: 0.02, knock: 980, lunge: 520, cd: 520, stop: 150, shake: 0.024, dur: 420 },
] as const;
/** Press again within this long to carry the combo on. */
const CHAIN_MS = 750;

/** ATTACK while golden: a three-hit combo that steps you into whoever you're aiming at. */
export function megaMelee(p: Player, now: number) {
  const w = p.world;
  const sc = w.sc;
  const step = now - p.meleeLastAt < CHAIN_MS ? (p.meleeStep + 1) % COMBO.length : 0;
  p.meleeStep = step;
  p.meleeLastAt = now;
  const m = COMBO[step];
  const finisher = step === COMBO.length - 1;
  p.attackCd = now + m.cd;
  p.attackAnimUntil = now + m.dur;
  // magnet: snap to the nearest enemy roughly where you're aiming, so swings connect
  let a = p.aim;
  let best: any = null;
  let bestD = m.R + 120;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
    const off = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(e.y - p.y, e.x - p.x) - p.aim));
    if (d < bestD && off < 1.1) {
      bestD = d;
      best = e;
    }
  }
  if (best) a = Math.atan2(best.y - p.y, best.x - p.x);
  p.meleeAnim = { key: m.anim, skip: m.skip, start: now, dur: m.dur, dir: Math.cos(a) < 0 ? -1 : 1 };
  // the lunge (shorter if they're already in your face)
  const lunge = best ? Math.min(m.lunge, Math.max(120, (bestD - 40) * 4)) : m.lunge * 0.6;
  const body = p.spr.body as Phaser.Physics.Arcade.Body;
  if (!w.side) body.setVelocity(Math.cos(a) * lunge, Math.sin(a) * lunge);
  else body.setVelocityX(Math.cos(a) * lunge);
  afterimage(p, 3, finisher ? 0xffe680 : 0xfde047);
  synth.play(finisher ? "punch_big" : "swing");
  // the strike lands a beat into the animation, like a real wind-up
  const delay = finisher ? 120 : 60;
  sc.time.delayedCall(delay, () => {
    if (p.dead) return;
    swoosh(p, a, m.R, m.arc * Math.PI, step);
    let hits = 0;
    for (const e of [...w.enemies]) {
      if (e.dead) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
      if (d > m.R + e.radius) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (Math.abs(Phaser.Math.Angle.Wrap(ang - a)) > (m.arc * Math.PI) / 2 + 0.2 && d > 50) continue;
      hits++;
      const dmg = (e.isBoss ? p.dmg(m.dmg * 0.45, now) + e.maxHp * m.bossDmg : p.dmg(m.dmg, now)) * (kd(G.s, "kd_aura") ? 1.3 : 1);
      w.damageEnemy(e, dmg, { knock: e.isBoss ? m.knock * 0.25 : m.knock, angle: ang, crit: finisher || Math.random() < 0.2, noWonk: true, stun: finisher ? 700 : 220 });
      impact(p, e.x, e.y, ang, finisher);
    }
    if (hits) {
      w.hitStop(m.stop + (hits > 2 ? 30 : 0));
      w.shake(finisher ? 260 : 120, m.shake);
      synth.play(finisher ? "bonecrack" : "punch");
      if (finisher) {
        synth.play("boom");
        const cam = sc.cameras.main;
        const z = cam.zoom;
        sc.tweens.add({ targets: cam, zoom: z * 1.06, duration: 70, yoyo: true, ease: "Quad.out" });
        w.floatText(p.x, p.y - 70, ["KRELL-SMASH!", "GOLDEN FIST!", "HRAAAAH!", "SIT DOWN!", "WONK THIS!"][Math.floor(Math.random() * 5)], "#fde047", 22);
      }
    } else if (finisher) w.shake(90, 0.006);
    // the finisher also slams the floor: a ring that shoves everyone near away
    if (finisher) {
      if (!vfx(sc, "vfx_shock", p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60 + 10, { scale: 2, depth: 600, tint: 0xfde047 })) {
        const ring = sc.add.circle(p.x, p.y, 10, 0xffffff, 0).setStrokeStyle(6, 0xfde047).setDepth(600);
        sc.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
      }
      vfx(sc, "vfx_dust", p.x, p.y + 20, { scale: 1.6, depth: 499 });
      for (const e of [...w.enemies]) {
        if (e.dead || e.isBoss) continue;
        const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
        if (d < 130 && d > 0) w.damageEnemy(e, p.dmg(20, now), { knock: 520, angle: Math.atan2(e.y - p.y, e.x - p.x), noWonk: true, label: "" });
      }
    }
  });
}

/** Golden ghosts of you left behind on the lunge. */
function afterimage(p: Player, n: number, tint: number) {
  const sc = p.world.sc;
  for (let i = 0; i < n; i++) {
    sc.time.delayedCall(i * 28, () => {
      if (!p.spr.active) return;
      const g = sc.add.image(p.spr.x, p.spr.y, p.spr.texture.key, p.spr.frame.name).setScale(p.spr.scaleX, p.spr.scaleY).setFlipX(p.spr.flipX).setOrigin(p.spr.originX, p.spr.originY);
      g.setTint(tint).setTintFill(tint).setAlpha(0.5).setDepth(p.spr.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    });
  }
}

/** The crescent of the strike: thick at the leading edge, tapering behind, gone in a blink. */
function swoosh(p: Player, a: number, R: number, arc: number, step: number) {
  const sc = p.world.sc;
  const g = sc.add.graphics().setDepth(601).setBlendMode(Phaser.BlendModes.ADD);
  const side = step === 1 ? -1 : 1;
  const st = { t: 0 };
  const finisher = step === 2;
  sc.tweens.add({
    targets: st,
    t: 1,
    duration: finisher ? 150 : 100,
    ease: "Cubic.out",
    onUpdate: () => {
      g.clear();
      // a crescent hugging the front of the swing, drawn point by point (no arc() wrap-around surprises)
      const from = a - (arc / 2) * side;
      const sweep = arc * st.t * side;
      const segs = 16;
      const rIn = R * 0.42;
      const rOut = R * (finisher ? 0.95 : 0.8);
      const ring = (k: number) => {
        const pts: Phaser.Math.Vector2[] = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const ang = from + sweep * u;
          // thickest at the leading edge, tapering to nothing at the tail
          const r = rIn + (rOut - rIn) * (0.55 + 0.45 * u) * k;
          pts.push(new Phaser.Math.Vector2(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r));
        }
        return pts;
      };
      const inner: Phaser.Math.Vector2[] = [];
      for (let i = segs; i >= 0; i--) {
        const u = i / segs;
        const ang = from + sweep * u;
        const r = rIn + (rOut - rIn) * 0.55 * (1 - u * 0.6);
        inner.push(new Phaser.Math.Vector2(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r));
      }
      g.fillStyle(0xf59e0b, 0.45).fillPoints([...ring(1.08), ...inner], true);
      g.fillStyle(0xfde047, 0.9).fillPoints([...ring(1), ...inner], true);
      g.lineStyle(3, 0xffffff, 1).strokePoints(ring(1), false);
    },
    onComplete: () => sc.tweens.add({ targets: g, alpha: 0, duration: 90, onComplete: () => g.destroy() }),
  });
  // speed lines streaking out along the strike
  for (let i = 0; i < (finisher ? 7 : 4); i++) {
    const la = a + (Math.random() - 0.5) * arc * 0.6;
    const r0 = 30 + Math.random() * 30;
    const line = sc.add.line(0, 0, p.x + Math.cos(la) * r0, p.y + Math.sin(la) * r0, p.x + Math.cos(la) * (r0 + 40), p.y + Math.sin(la) * (r0 + 40), 0xfff7c2, 0.9).setOrigin(0, 0).setLineWidth(2).setDepth(601).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: line, x: Math.cos(la) * R * 0.8, y: Math.sin(la) * R * 0.8, alpha: 0, duration: 160, onComplete: () => line.destroy() });
  }
}

/** Where a golden fist lands: a white flash, a burst of gold, sparks flying on through. */
function impact(p: Player, x: number, y: number, ang: number, big: boolean) {
  const w = p.world;
  const sc = w.sc;
  const flash = sc.add.circle(x, y, big ? 30 : 18, 0xffffff, 1).setDepth(603).setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: big ? 160 : 100, onComplete: () => flash.destroy() });
  if (!vfx(sc, big ? "vfx_crit" : "vfx_hit", x, y, { scale: big ? 1.5 : 1.1, depth: 602, tint: 0xfde047 })) w.burst(x, y, 0xfde047, big ? 16 : 10);
  if (big) vfx(sc, "vfx_sparks", x + Math.cos(ang) * 20, y + Math.sin(ang) * 20, { scale: 1.2, depth: 602 });
  for (let i = 0; i < (big ? 8 : 4); i++) {
    const sa = ang + (Math.random() - 0.5) * 1.2;
    const sp = sc.add.rectangle(x, y, 4, 4, Math.random() < 0.5 ? 0xfde047 : 0xffffff).setDepth(603).setBlendMode(Phaser.BlendModes.ADD);
    const dist = (big ? 70 : 40) + Math.random() * 40;
    sc.tweens.add({ targets: sp, x: x + Math.cos(sa) * dist, y: y + Math.sin(sa) * dist, alpha: 0, scale: 0.3, duration: 220, ease: "Quad.out", onComplete: () => sp.destroy() });
  }
}

/** C while golden: CUME... HAME... HAAAAAA! */
export function cumehameha(p: Player, now: number) {
  const w = p.world;
  const sc = w.sc;
  if (now < p.cumeCd) {
    w.floatText(p.x, p.y - 50, `CUMEHAMEHA in ${Math.ceil((p.cumeCd - now) / 1000)}s`, "#fde047", 11);
    return;
  }
  p.cumeCd = now + 5000;
  const CHARGE = 750;
  p.chargingUntil = now + CHARGE + 900;
  const orb = sc.add.circle(p.x, p.y, 4, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(603);
  const halo = sc.add.circle(p.x, p.y, 8, 0x93c5fd, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(602);
  sc.tweens.add({ targets: orb, radius: 18, duration: CHARGE });
  sc.tweens.add({ targets: halo, radius: 34, alpha: 0.8, duration: CHARGE });
  w.floatText(p.x, p.y - 70, "CUME…", "#93c5fd", 20);
  sc.time.delayedCall(CHARGE / 2, () => w.floatText(p.x, p.y - 90, "HAME…", "#93c5fd", 22));
  const suck = sc.time.addEvent({
    delay: 30,
    repeat: Math.floor(CHARGE / 30),
    callback: () => {
      orb.setPosition(p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24);
      halo.setPosition(orb.x, orb.y);
      const a = Math.random() * Math.PI * 2;
      const s = sc.add.circle(orb.x + Math.cos(a) * 70, orb.y + Math.sin(a) * 70, 3, 0xbfdbfe).setBlendMode(Phaser.BlendModes.ADD).setDepth(603);
      sc.tweens.add({ targets: s, x: orb.x, y: orb.y, alpha: 0.2, duration: 220, onComplete: () => s.destroy() });
    },
  });
  sc.time.delayedCall(CHARGE, () => {
    suck.remove();
    sc.tweens.killTweensOf([orb, halo]);
    orb.destroy();
    halo.destroy();
    if (p.dead) return;
    w.floatText(p.x, p.y - 100, "HAAAAAAAAAAA!!!", "#ffffff", 30);
    synth.laser(1.4);
    w.shake(900, 0.022);
    sc.cameras.main.flash(160, 220, 235, 255);
    const ang = p.aim;
    const LEN = 1300;
    const WID = 58;
    const g = sc.add.graphics().setDepth(604).setBlendMode(Phaser.BlendModes.ADD);
    const st = { len: 0, life: 1 };
    sc.tweens.add({ targets: st, len: LEN, duration: 160, ease: "Quad.out" });
    sc.tweens.add({ targets: st, life: 0, delay: 800, duration: 260 });
    const hit = new Map<unknown, number>();
    let ticks = 0;
    const ev = sc.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const x1 = p.x + Math.cos(ang) * 20;
        const y1 = p.y + Math.sin(ang) * 20;
        const x2 = x1 + Math.cos(ang) * st.len;
        const y2 = y1 + Math.sin(ang) * st.len;
        const wob = 1 + Math.sin(sc.time.now / 30) * 0.08;
        g.clear();
        g.lineStyle(WID * 2.4 * st.life * wob, 0x60a5fa, 0.25);
        g.lineBetween(x1, y1, x2, y2);
        g.lineStyle(WID * st.life * wob, 0xbfdbfe, 0.85);
        g.lineBetween(x1, y1, x2, y2);
        g.lineStyle(WID * 0.45 * st.life, 0xffffff, 1);
        g.lineBetween(x1, y1, x2, y2);
        g.fillStyle(0xffffff, st.life).fillCircle(x1, y1, WID * 0.7 * st.life * wob);
        if (++ticks % 6 === 0 && st.life > 0.2) {
          for (const e of [...w.enemies]) {
            if (e.dead) continue;
            const ex = e.x - x1;
            const ey = e.y - y1;
            const along = ex * Math.cos(ang) + ey * Math.sin(ang);
            const across = Math.abs(-ex * Math.sin(ang) + ey * Math.cos(ang));
            if (along < 0 || along > st.len || across > WID + e.radius) continue;
            const n = (hit.get(e) ?? 0) + 1;
            hit.set(e, n);
            if (e.isBoss && n > 8) continue;
            const dmg = e.isBoss ? p.dmg(18, now) + e.maxHp * 0.011 : p.dmg(70, now);
            w.damageEnemy(e, dmg, { knock: 320, angle: ang, crit: n === 1, noWonk: true });
            if (n === 1) w.burst(e.x, e.y, 0xbfdbfe, 14);
          }
        }
        if (st.life <= 0.01) {
          ev.remove();
          g.destroy();
        }
      },
    });
  });
}
