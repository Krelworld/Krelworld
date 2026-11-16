import Phaser from "phaser";
import { G } from "../G";

/**
 * The Wonky Pole's room dressing: sweeping coloured spotlights from the rig, a disco ball throwing glints round the
 * walls, haze, speakers that thump on the beat, and money raining on the stage when you tip. "Reduce flashing"
 * (settings.calmFlash) keeps the lights slow and steady: no flicker, no strobe, no screen pulse.
 */

const calm = () => !!G.meta?.settings?.calmFlash;

/** Where the rig's lamps hang (in the backdrop) and which way they sweep. */
const RIG = [
  { x: 212, y: 44, color: 0xff2e88, base: -0.32, amp: 0.36, speed: 0.55, len: 420 },
  { x: 396, y: 50, color: 0x5ad1ff, base: 0.12, amp: 0.42, speed: 0.42, len: 400 },
  { x: 862, y: 40, color: 0xa855f7, base: 0.62, amp: 0.3, speed: 0.6, len: 470 },
];
const PALETTE = [0xff2e88, 0x5ad1ff, 0xa855f7, 0xffd23f, 0x4ade80];
const BPM = 124;

export interface ClubFx {
  update(time: number): void;
  /** Lights down (her break): beams and glints dim, the music keeps going. */
  dim(on: boolean): void;
  rainMoney(x: number, floorY: number, n?: number): void;
  /** Which beat of the music we're on (124 bpm). */
  beat: number;
}

function hazeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists("club_haze_soft")) return;
  const t = scene.textures.createCanvas("club_haze_soft", 128, 128);
  if (!t) return;
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  t.refresh();
}

/** A soft cone of light pointing down from (0,0): a wide faint skirt and a brighter core. */
function cone(scene: Phaser.Scene, color: number, len: number) {
  const g = scene.add.graphics();
  const layers: [number, number][] = [
    [0.5, 0.06],
    [0.34, 0.07],
    [0.2, 0.09],
    [0.09, 0.12],
  ];
  for (const [w, a] of layers) {
    g.fillStyle(color, a);
    g.fillTriangle(-4, 0, 4, 0, len * w, len);
    g.fillTriangle(-4, 0, -len * w, len, len * w, len);
  }
  return g.setBlendMode(Phaser.BlendModes.ADD);
}

export function buildClubFx(scene: Phaser.Scene, o: { discoX: number; discoY: number; speakers: [number, number][] }): ClubFx {
  hazeTexture(scene);
  // haze: big soft blobs drifting through the beams
  const haze: { img: Phaser.GameObjects.Image; x: number; y: number; ph: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const x = 80 + i * 140 + Math.random() * 40;
    const y = 150 + (i % 3) * 70;
    const img = scene.add.image(x, y, "club_haze_soft").setScale(3.2 + Math.random() * 1.6, 1.6 + Math.random()).setTint([0xd8b4fe, 0xf9a8d4, 0xa5f3fc][i % 3]).setAlpha(0.07).setDepth(6);
    haze.push({ img, x, y, ph: Math.random() * 6 });
  }
  // the beams, and the pools of light where they hit the floor
  const beams = RIG.map((r, i) => {
    const g = cone(scene, r.color, r.len).setPosition(r.x, r.y).setDepth(7);
    const pool = scene.add.ellipse(r.x, r.y + r.len, 150, 40, r.color, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    return { ...r, g, pool, i, color0: r.color };
  });
  // the disco ball, spinning
  let ball: Phaser.GameObjects.Sprite | null = null;
  if (scene.textures.exists("club_disco")) {
    if (!scene.anims.exists("club_disco_spin")) scene.anims.create({ key: "club_disco_spin", frames: scene.anims.generateFrameNumbers("club_disco", { start: 1, end: 8 }), frameRate: 8, repeat: -1 });
    ball = scene.add.sprite(o.discoX, o.discoY, "club_disco", 0).setScale(2).setDepth(8);
    ball.play("club_disco_spin");
    scene.tweens.add({ targets: ball, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 2200, ease: "Sine.inOut" });
  }
  // glints off the ball, crawling round the walls
  const glints = Array.from({ length: 30 }, (_, i) => {
    const d = scene.add.rectangle(Math.random() * 960, 70 + Math.random() * 300, 3, 3, i % 4 === 0 ? 0xffd1e8 : i % 4 === 1 ? 0xa5f3fc : 0xffffff, 0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    return { d, sp: 18 + Math.random() * 22, ph: Math.random() * 6 };
  });
  // speakers either side of the stage, thumping
  const spk = o.speakers.map(([x, y]) => (scene.textures.exists("club_speaker") ? scene.add.image(x, y, "club_speaker").setScale(2.2).setDepth(y) : scene.add.rectangle(x, y, 44, 64, 0x111111).setDepth(y)));
  // a faint wash the whole room gets on the kick drum (not with reduced flashing)
  const wash = scene.add.rectangle(480, 270, 960, 540, 0xff2e88, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(10);
  let dimmed = false;
  let lastBeat = -1;
  let last = 0;
  const fx: ClubFx = {
    beat: 0,
    update(time) {
      const dt = Math.min(50, time - (last || time)) / 1000;
      last = time;
      const t = time / 1000;
      const c = calm();
      const k = dimmed ? 0.25 : 1;
      // the beat
      const beat = Math.floor((time * BPM) / 60000);
      const phase = ((time * BPM) / 60000) % 1;
      fx.beat = beat;
      if (beat !== lastBeat) {
        lastBeat = beat;
        for (const s of spk) {
          scene.tweens.killTweensOf(s);
          s.setScale(s instanceof Phaser.GameObjects.Image ? 2.2 : 1);
          scene.tweens.add({ targets: s, scaleX: s.scaleX * 1.07, scaleY: s.scaleY * 1.07, duration: 70, yoyo: true });
        }
        // every 8 bars the rig changes colour (not with reduced flashing: then they keep their colours)
        if (!c && beat % 32 === 0) beams.forEach((b, i) => (b.color = PALETTE[(Math.floor(beat / 32) + i * 2) % PALETTE.length]));
        if (c) beams.forEach((b) => (b.color = b.color0));
      }
      const kick = Math.max(0, 1 - phase * 3);
      wash.setAlpha(c || dimmed ? 0 : kick * 0.035);
      for (const b of beams) {
        const speed = c ? b.speed * 0.4 : b.speed;
        const a = b.base + Math.sin(t * speed + b.i * 1.7) * b.amp;
        b.g.setRotation(a);
        b.g.setAlpha(k * (c ? 0.8 : 0.75 + kick * 0.35));
        // redraw the colour when it changed
        if (b.g.getData("c") !== b.color) {
          b.g.setData("c", b.color);
          b.g.destroy();
          const g = cone(scene, b.color, b.len).setPosition(b.x, b.y).setDepth(7).setRotation(a).setData("c", b.color);
          b.g = g;
          b.pool.setFillStyle(b.color, 0.16);
        }
        const ex = b.x - Math.sin(a) * b.len * 0.92;
        const ey = b.y + Math.cos(a) * b.len * 0.92;
        b.pool.setPosition(ex, Math.min(ey, 520)).setAlpha(k * (c ? 0.9 : 0.8 + kick * 0.4));
      }
      for (const h of haze) {
        h.img.x = h.x + Math.sin(t * 0.13 + h.ph) * 60;
        h.img.y = h.y + Math.sin(t * 0.09 + h.ph * 2) * 18;
        h.img.setAlpha(0.06 + Math.sin(t * 0.3 + h.ph) * 0.02);
      }
      for (const g of glints) {
        g.d.x += g.sp * dt * (c ? 0.5 : 1);
        if (g.d.x > 970) {
          g.d.x = -10;
          g.d.y = 70 + Math.random() * 300;
        }
        const tw = c ? 0.35 : 0.25 + Math.abs(Math.sin(t * 3 + g.ph)) * 0.6;
        g.d.setAlpha(k * tw);
      }
    },
    dim(on) {
      dimmed = on;
    },
    rainMoney(x, floorY, n = 14) {
      const has = scene.textures.exists("club_cash");
      if (has && !scene.anims.exists("club_cash_flutter")) scene.anims.create({ key: "club_cash_flutter", frames: scene.anims.generateFrameNumbers("club_cash", { start: 0, end: 8 }), frameRate: 12, repeat: -1 });
      for (let i = 0; i < n; i++) {
        scene.time.delayedCall(i * 55, () => {
          const sx = x + (Math.random() - 0.5) * 160;
          const sy = -20 - Math.random() * 60;
          const note: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle = has
            ? scene.add.sprite(sx, sy, "club_cash", Math.floor(Math.random() * 9)).setScale(1.3).play({ key: "club_cash_flutter", startFrame: Math.floor(Math.random() * 9) })
            : scene.add.rectangle(sx, sy, 16, 9, 0x4ade80).setStrokeStyle(1, 0x14532d);
          note.setDepth(900);
          const land = floorY + (Math.random() - 0.5) * 40;
          const drift = (Math.random() - 0.5) * 80;
          scene.tweens.add({
            targets: note,
            y: land,
            x: sx + drift,
            duration: 1300 + Math.random() * 700,
            ease: "Sine.in",
            onUpdate: (tw) => note.setAngle(Math.sin(tw.progress * 12 + i) * 25),
            onComplete: () => {
              if (note instanceof Phaser.GameObjects.Sprite) note.stop().setFrame(0);
              note.setAngle((Math.random() - 0.5) * 40).setDepth(land - 60);
              scene.tweens.add({ targets: note, alpha: 0, delay: 2600, duration: 800, onComplete: () => note.destroy() });
            },
          });
        });
      }
    },
  };
  return fx;
}
