import Phaser from "phaser";
import { synth } from "../../audio/Synth";
import { type BoardSpec, type Sprite3D, can3d, clamp, lerp, lookAt, playShot, span } from "../../gfx/Pseudo3D";
import { FONT } from "../../ui/theme";

/**
 * The Kreddle Express crosses into Krelworld (VignetteScene.kreddleExpress, Chapter 6): a pseudo-3D shot from low
 * beside the rails, just over the border: the train comes out of Kreddle's dark at three hundred miles an hour,
 * thunders past the WELCOME TO KRELWORLD sign, and the camera whips round after it as it heads off towards a
 * Krelburger. About four seconds, skippable. Resolves true if it was shown (false without WebGL).
 */

const LENGTH = 4.2;
const TRAIN_W = 1250;
const SLICES = 8;
/** the train's nose along the line (x) at time t */
const nose = (t: number) => -3600 + 1850 * t;
const CAM = { x: 320, y: 250 };

export async function kreddleExpressShot(sc: Phaser.Scene): Promise<boolean> {
  if (!can3d(sc)) return false;
  // from create(): wait until the scene is running
  for (let i = 0; i < 60 && sc.sys && !sc.sys.isActive() && !sc.sys.isPaused(); i++) await new Promise((r) => window.setTimeout(r, 20));
  if (!sc.sys || (!sc.sys.isActive() && !sc.sys.isPaused())) return false;
  await playShot(sc, {
    length: LENGTH,
    fromBlack: true,
    fadeIn: 350,
    fadeOut: 450,
    build: (c) => {
      const { st, calm } = c;
      const s3 = c.sc;
      const has = (k: string) => s3.textures.exists(k);
      st.maxLean = 90;
      // the evening light of the street scene it cuts into
      st.light = 0xffe6d0;
      st.fog = { color: 0xd8a080, start: 1500, span: 6000, max: 0.65 };
      st.setSky({ top: 0x4a4a7a, horizon: 0xf2a66a });
      // Krelworld's fields this side of the border, Kreddle's purple murk the other
      st.addGround({ x0: 0, y0: -7000, x1: 8000, y1: 7000, cols: 30, rows: 40, color: 0x4f8a3c, depth: 1 });
      st.addGround({ x0: -8000, y0: -7000, x1: 0, y1: 7000, cols: 30, rows: 40, color: 0x2a1446, depth: 1 });
      // the line: ballast, sleepers, two rails (a strip of ground texture along y = 0)
      const LX0 = -7000;
      const LX1 = 7000;
      const rk = st.groundTexture("rails", 2048, 32, (dt) => {
        const g = s3.make.graphics({}, false);
        g.fillStyle(0x6b5b4b, 1).fillRect(0, 0, 2048, 32);
        for (let x = 0; x < 2048; x += 4) g.fillStyle(0x4a3a2a, 1).fillRect(x, 5, 2, 22);
        g.fillStyle(0xb8bec8, 1).fillRect(0, 9, 2048, 2).fillRect(0, 21, 2048, 2);
        dt.draw(g);
        g.destroy();
      });
      st.addGround({ key: rk, x0: LX0, y0: -40, x1: LX1, y1: 40, cols: 60, rows: 1, depth: 1.4 });
      // the border: a painted line over the ground
      st.addGround({ x0: -6, y0: -3000, x1: 6, y1: 3000, cols: 1, rows: 30, color: 0xfacc15, depth: 1.3 });
      // the sign, the telegraph poles, a few trees, the Krelburger up the line (one atlas: they sort together)
      const signKey = st.key("sign");
      const dt = s3.textures.addDynamicTexture(signKey, 300, 260)!;
      const tmp: Phaser.GameObjects.GameObject[] = [];
      const t = <T extends Phaser.GameObjects.GameObject>(o: T) => (tmp.push(o), o);
      dt.draw(t(new Phaser.GameObjects.Rectangle(s3, 150, 260, 12, 120, 0x555555).setOrigin(0.5, 1)));
      dt.draw(t(new Phaser.GameObjects.Rectangle(s3, 150, 80, 280, 150, 0x1d4ed8).setStrokeStyle(6, 0xffffff)));
      dt.draw(t(new Phaser.GameObjects.Text(s3, 150, 80, "WELCOME TO\nKRELWORLD", { fontFamily: FONT, fontSize: "34px", color: "#ffffff", align: "center", fontStyle: "bold" }).setOrigin(0.5)));
      const poleKey = st.key("pole");
      const pg = s3.make.graphics({}, false);
      pg.fillStyle(0x5a4030, 1).fillRect(14, 0, 6, 160).fillRect(0, 14, 34, 5);
      pg.generateTexture(poleKey, 34, 160);
      pg.destroy();
      for (const o of tmp) o.destroy();
      const specs: BoardSpec[] = [{ key: signKey, x: -620, y: -150, w: 200, h: 173 }];
      for (let x = -4000; x <= 6000; x += 420) specs.push({ key: poleKey, x, y: -170, w: 40, h: 190 });
      const rnd = new Phaser.Math.RandomDataGenerator(["kexpress"]);
      if (has("hd_tree"))
        for (let i = 0; i < 60; i++) {
          const x = rnd.between(-3000, 6000);
          const y = rnd.pick([-1, 1]) * rnd.between(320, 2600);
          if (Math.abs(x - CAM.x) < 300 && y > 0 && y < 700) continue;
          specs.push({ key: x < 0 ? "hd_tree" : rnd.pick(["hd_tree", has("hd_tree2") ? "hd_tree2" : "hd_tree"]), x, y, w: 90, h: 100, tint: x < 0 ? 0x9a70d0 : 0xffffff });
        }
      if (has("p_krelburger")) specs.push({ key: "p_krelburger", x: 4200, y: -360, w: 330, h: 350 });
      if (has("p_train")) {
        const src = s3.textures.get("p_train").getSourceImage();
        // side-on along the track (a real 3D quad, not a cut-out turning to the camera)
        // in slices, so the end that's gone past the camera doesn't take the rest of the train with it
        const n = SLICES;
        for (let i = 0; i < n; i++) {
          const x0 = Math.round((src.width * i) / n);
          const x1 = Math.round((src.width * (i + 1)) / n);
          const cw = Math.min(src.width - x0, x1 - x0 + 1);
          specs.push({ key: "p_train", crop: [x0, 0, cw, src.height], x: 0, y: 4, w: (TRAIN_W * cw) / src.width, h: (TRAIN_W * src.height) / src.width, z: 4, face: 0 });
        }
      }
      if (has("spr_TV_PRESIDENT_KLERBLE")) specs.push({ key: "spr_TV_PRESIDENT_KLERBLE", frame: 4, x: 0, y: 0, w: 56, h: 74 });
      const boards = st.addBoards(specs);
      const klerble = has("spr_TV_PRESIDENT_KLERBLE") ? boards[boards.length - 1] : null;
      const train = has("p_train") ? boards.slice(boards.length - (klerble ? 1 : 0) - SLICES, boards.length - (klerble ? 1 : 0)) : [];
      const th = train.length ? train[0].h : 160;
      // the Krelburger sign, glowing; the wake of dust and sparks behind the train
      const glow = st.softDot("glow", 0.3);
      const dot = st.softDot("dust", 0.55);
      st.addSprite(glow, 4200, -340, 380, 260, { add: true, tint: 0xffd23f, alpha: 0.5 });
      const dust: { s: Sprite3D; t0: number; dx: number; dy: number }[] = Array.from({ length: 26 }, (_, i) => ({ s: st.addSprite(dot, 0, 0, 10, 120, { tint: 0xb8a088, alpha: 0 }), t0: i * 0.12, dx: rnd.between(-60, 60), dy: rnd.between(-90, 90) }));
      const sparks: Sprite3D[] = Array.from({ length: calm ? 6 : 14 }, () => st.addSprite(glow, 0, 0, 6, 26, { add: true, tint: 0xffd23f, alpha: 0 }));
      s3.time.delayedCall(250, () => c.caption("MEANWHILE… THE KREDDLE EXPRESS", { hold: 2.0 }));
      synth.play("fly_wind", 0.45);
      s3.time.delayedCall(900, () => synth.play("jet", 0.9));
      s3.time.delayedCall(1850, () => synth.play("fly_whoosh", 0.9));
      s3.time.delayedCall(1950, () => synth.play("boom", 0.35));
      return (tt) => {
        const fx = nose(tt);
        const cx = fx - TRAIN_W / 2;
        train.forEach((b, i) => {
          b.x = fx - TRAIN_W + ((i + 0.5) * TRAIN_W) / SLICES;
          b.dz = Math.sin(tt * 40) * 1.5;
        });
        if (klerble) {
          // at the cab window
          klerble.x = fx - 165;
          klerble.y = 10;
          klerble.z = th * 0.2;
          klerble.dz = Math.sin(tt * 40) * 1.5;
        }
        // the wake: dust thrown up off the back of the train, and sparks off the wheels
        const tail = fx - TRAIN_W;
        for (const d of dust) {
          const age = (tt - d.t0) % 1.4;
          d.s.x = tail - age * 260 + d.dx;
          d.s.y = d.dy * (0.4 + age);
          d.s.z = 20 + age * 60;
          d.s.size = 120 + age * 220;
          d.s.alpha = tt > d.t0 ? 0.55 * (1 - age / 1.4) : 0;
        }
        sparks.forEach((s, i) => {
          const k = (tt * 7 + i * 0.37) % 1;
          s.x = cx + (i / sparks.length - 0.5) * TRAIN_W * 0.9 - k * 60;
          s.y = 30 + k * 10;
          s.z = 8 + Math.sin(k * Math.PI) * 30;
          s.alpha = 0.9 * (1 - k);
        });
        // the camera: low by the line; it whips round after the nose as it goes by, and the ground shakes
        const pass = Math.exp(-Math.pow((fx - TRAIN_W * 0.5 - CAM.x) / 900, 2));
        const amp = (calm ? 2.5 : 9) * pass;
        const jx = (Math.sin(tt * 53) + Math.sin(tt * 31)) * amp * 0.5;
        const jz = (Math.sin(tt * 47 + 1) + Math.sin(tt * 29)) * amp * 0.4;
        const lookX = clamp(fx - 260, -3200, 4300);
        const ez = lerp(30, 70, span(tt, 2.6, LENGTH));
        const eye = { x: CAM.x + 120 * span(tt, 2.4, LENGTH), y: CAM.y + jx * 0.2, z: ez + jz };
        const look = { x: lookX + jx, y: lerp(0, -200, span(tt, 2.8, LENGTH)), z: lerp(th * 0.5, th * 0.9, span(tt, 2.4, LENGTH)) + jz };
        return lookAt(eye, look, Math.sin(tt * 1.3) * 2 + (calm ? 0 : Math.sin(tt * 61) * amp * 0.25));
      };
    },
  });
  return true;
}
