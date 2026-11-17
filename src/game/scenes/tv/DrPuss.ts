import Phaser from "phaser";
import { ShowDirector } from "./ShowDirector";
import { G } from "../../G";

/**
 * DR. PUSS: a studio sitcom in one damp set (src/content/television/drPuss). Shot multi-camera style: the whole
 * set is always staged (exam table on the left, the desk on the right, the door), and the "cameras" are framings of
 * it (wide, two-shot, singles), so whatever covers something in the wide covers it in every close-up too.
 *
 * Staging rules (see the episode file): nothing explicit is ever drawn. Her lower half is behind a black CENSORED
 * bar from the moment her trousers come down until she's out of the door; his climax is a CENSORED bar splatted
 * across her face (no fluid drawn); the desk hides what he does under it; the monitor faces away (the cutaway shows
 * only a pink glow and BLOCKED).
 *
 * Director cues come in as prop beats "drp:<cue>". Cutaways are insert beats "drp_<what>".
 *
 * Art: tv_drp_office (the set), tv_drp_desk, tv_drp_table, and the animated sheets tvdrp_octo (160x160) and
 * tvdrp_woman (96x160); the frame ranges are below.
 */

const OFFICE = "tv_drp_office";
const DESK = "tv_drp_desk";
const TABLE = "tv_drp_table";
const OCTO_KEY = "tvdrp_octo";
const WOMAN_KEY = "tvdrp_woman";

type Anim = { a: number; n: number; fps: number; loop?: boolean; ping?: boolean };
const OCTO: Record<string, Anim> = {
  idle: { a: 0, n: 9, fps: 6, loop: true, ping: true },
  talk: { a: 9, n: 9, fps: 10, loop: true },
  surge: { a: 18, n: 9, fps: 12 },
  arms: { a: 22, n: 5, fps: 7, loop: true, ping: true },
  unfurl: { a: 27, n: 9, fps: 12 },
  writhe: { a: 27, n: 9, fps: 14, loop: true, ping: true },
  sweep: { a: 36, n: 9, fps: 14 },
  slump: { a: 45, n: 6, fps: 8 },
  mouse: { a: 54, n: 9, fps: 9 },
};
const WOMAN: Record<string, Anim> = {
  idle: { a: 0, n: 5, fps: 5, loop: true, ping: true },
  freeze: { a: 9, n: 7, fps: 12 },
  talk: { a: 16, n: 9, fps: 10, loop: true },
  sit: { a: 25, n: 1, fps: 1 },
  gasp: { a: 26, n: 7, fps: 12 },
  dazed: { a: 33, n: 9, fps: 6, loop: true, ping: true },
  sittalk: { a: 42, n: 9, fps: 10, loop: true },
  out: { a: 51, n: 1, fps: 1 },
  walk: { a: 52, n: 8, fps: 10, loop: true },
};

type WomanPose = "off" | "stand" | "table" | "out";
type OctoPose = "desk" | "up" | "table";

export class DrPussDirector extends ShowDirector {
  private octoPose: OctoPose = "desk";
  private womanPose: WomanPose = "off";
  private octoAnim = "idle";
  private womanAnim = "idle";
  /** her lower half behind a bar (from the trousers coming down until she's gone) */
  private barLower = false;
  /** the big bar over the whole business on the table */
  private barAct = false;
  private barFace = false;
  private shaking = false;
  private underDesk = false;
  private glow = false;
  private papers = true;
  private womanX = 0;
  private octoX = 0;
  private octoLift = 0;
  private shot: "wide" | "two" | "octo" | "woman" | "card" | "insert" = "wide";
  private octo: Phaser.GameObjects.Sprite | null = null;
  private woman: Phaser.GameObjects.Sprite | null = null;
  private table: Phaser.GameObjects.Image | null = null;
  private titleDone = false;

  private get L() {
    const { SX, SY } = this.r;
    return {
      floor: SY + 410,
      tableX: SX + 128,
      tableBottom: SY + 402,
      deskX: SX + 340,
      deskBottom: SY + 412,
      octoDesk: SX + 300,
      octoTable: SX + 222,
      door: SX + 505,
      womanStand: SX + 468,
      womanTable: SX + 112,
      womanDoor: SX + 470,
    };
  }

  // ------------------------------------------------------------------ the set

  /** Stage the whole set as it stands, then frame it. */
  private stageSet(framing: DrPussDirector["shot"] = this.shot, instant = true) {
    this.clear();
    this.shot = framing;
    const L = this.L;
    const { SX, SY, SW, SH } = this.r;
    const bg = this.backdrop(this.tex(OFFICE));
    void bg;
    // the walls sweat
    this.every(260, () => {
      const d = this.add(this.sc.add.rectangle(SX + 20 + Math.random() * (SW - 40), SY + 70 + Math.random() * 120, 2, 4, 0x9fd8c8, 0.7));
      this.sc.tweens.add({ targets: d, y: d.y + 60 + Math.random() * 60, alpha: 0, duration: 1600, onComplete: () => d.destroy() });
    });
    // the exam table
    if (this.tex(TABLE)) {
      const t = this.add(this.sc.add.image(L.tableX, L.tableBottom, TABLE).setOrigin(0.5, 1));
      this.realScale(t, 1.35);
      this.table = t;
      if (this.papers) {
        const g = this.add(this.sc.add.graphics());
        g.fillStyle(0xf4f1e6, 1).fillRect(L.tableX - 50, L.tableBottom - 98, 26, 6).fillRect(L.tableX - 18, L.tableBottom - 101, 22, 7).fillRect(L.tableX + 12, L.tableBottom - 97, 28, 5);
        g.fillStyle(0x6a6a6a, 1).fillRect(L.tableX - 46, L.tableBottom - 96, 16, 1).fillRect(L.tableX - 14, L.tableBottom - 98, 14, 1);
        g.setName("papers");
      }
    }
    // the woman, if she's on the table she's drawn before Octo (he's beside her)
    const drawWoman = () => {
      this.woman = null;
      if (this.womanPose === "off" || !this.tex(WOMAN_KEY)) return;
      const onTable = this.womanPose === "table";
      const x = this.womanX || L.womanStand;
      const s = this.add(this.sc.add.sprite(x, onTable ? L.tableBottom - 4 : L.floor, WOMAN_KEY, 0).setOrigin(0.5, 1));
      this.realScale(s, 1.45);
      this.woman = s;
      this.play(s, WOMAN, this.womanAnim);
    };
    const drawOcto = () => {
      this.octo = null;
      if (!this.tex(OCTO_KEY)) return;
      const x = this.octoX || L.octoDesk;
      // sat behind the desk he sits low: the desk hides everything from the belly down
      const sat = this.octoPose === "desk" ? 58 : 0;
      const s = this.add(this.sc.add.sprite(x, L.floor - this.octoLift + sat, OCTO_KEY, 0).setOrigin(0.5, 1));
      this.realScale(s, 1.5);
      this.octo = s;
      this.play(s, OCTO, this.octoAnim);
    };
    const behind = this.octoPose === "desk";
    if (this.womanPose === "table") drawWoman();
    if (behind) drawOcto();
    // the desk, over him when he's sat behind it, with the monitor's back to us
    if (this.tex(DESK)) {
      const d = this.add(this.sc.add.image(L.deskX, L.deskBottom, DESK).setOrigin(0.5, 1));
      this.realScale(d, 1.3);
      if (this.glow) this.monitorGlow(L.deskX + 72, L.deskBottom - 150);
      if (this.underDesk && this.octoPose === "desk") {
        // the desk jiggles. That's all you get.
        this.sc.tweens.add({ targets: d, y: d.y - 2, duration: 140, yoyo: true, repeat: -1 });
        this.every(900, () => this.sfx("fap"));
      }
    }
    if (!behind) drawOcto();
    if (this.womanPose !== "table") drawWoman();
    if (this.shaking) this.shake();
    this.bars();
    this.frame(framing, instant);
    void SY;
    void SH;
  }

  /** A pink light spilling over the top of the monitor (which faces away). */
  private monitorGlow(x: number, y: number) {
    const g = this.add(this.sc.add.ellipse(x, y, 120, 70, 0xff5fc8, 0.28));
    g.setBlendMode(Phaser.BlendModes.ADD);
    this.sc.tweens.add({ targets: g, alpha: 0.12, duration: 300 + Math.random() * 300, yoyo: true, repeat: -1 });
  }

  /** The cameras: framings of the one stage. */
  private frame(f: DrPussDirector["shot"], instant: boolean) {
    const L = this.L;
    const ms = instant ? 1 : 900;
    const { SY } = this.r;
    if (f === "wide") {
      this.push(1, ms);
      this.later(ms + 20, () => this.push(1.04, 4000, this.cx, SY + 300));
    } else if (f === "two") {
      const a = this.woman?.x ?? L.tableX;
      const b = this.octo?.x ?? L.octoDesk;
      this.push(1.45, ms, (a + b) / 2, SY + 290);
      this.later(ms + 20, () => this.push(1.5, 4000, (a + b) / 2, SY + 290));
    } else if (f === "octo" && this.octo) {
      const fy = this.octo.y - this.octo.displayHeight * 0.68;
      this.push(2.1, ms, this.octo.x, fy);
      this.later(ms + 20, () => this.octo && this.push(2.2, 3000, this.octo.x, fy));
    } else if (f === "woman" && this.woman) {
      const fy = this.woman.y - this.woman.displayHeight * (this.womanPose === "table" ? 0.62 : 0.7);
      this.push(2.1, ms, this.woman.x, fy);
      this.later(ms + 20, () => this.woman && this.push(2.2, 3000, this.woman.x, fy));
    }
  }

  /** Play one of a sheet's animations on a sprite (loops run until replaced). */
  private play(s: Phaser.GameObjects.Sprite, set: Record<string, Anim>, name: string, done?: () => void) {
    const a = set[name] ?? set.idle;
    if (s.getData("anim")) (s.getData("anim") as Phaser.Time.TimerEvent).remove();
    const total = this.sc.textures.get(s.texture.key).frameTotal - 1;
    const fr = (i: number) => Math.min(total - 1, a.a + i);
    s.setFrame(fr(0));
    if (a.n <= 1) {
      done?.();
      return;
    }
    let k = 0;
    const seq = a.ping ? [...Array(a.n).keys(), ...[...Array(a.n).keys()].reverse().slice(1, -1)] : [...Array(a.n).keys()];
    const t = this.every(1000 / a.fps, () => {
      if (!s.active) return;
      k++;
      if (!a.loop && k >= seq.length) {
        t.remove();
        done?.();
        return;
      }
      s.setFrame(fr(seq[k % seq.length]));
    });
    s.setData("anim", t);
  }

  private octoDo(name: string, then?: string) {
    this.octoAnim = then ?? name;
    if (this.octo) this.play(this.octo, OCTO, name, then ? () => this.octo?.active && this.play(this.octo, OCTO, then) : undefined);
  }

  private womanDo(name: string, then?: string) {
    this.womanAnim = then ?? name;
    if (this.woman) this.play(this.woman, WOMAN, name, then ? () => this.woman?.active && this.play(this.woman, WOMAN, then) : undefined);
  }

  // ------------------------------------------------------------------ censorship

  /** A black CENSORED bar, kept over a region of a sprite every frame (it moves, shakes and zooms with them). */
  private bar(target: () => Phaser.GameObjects.Sprite | null, region: () => { x0: number; y0: number; x1: number; y1: number }, label = "CENSORED", size = 22) {
    const c = this.add(this.sc.add.container(0, 0));
    const r = this.sc.add.rectangle(0, 0, 10, 10, 0x000000, 1).setOrigin(0.5);
    const t = this.text(0, 0, label, size, "#ffffff", { fontStyle: "bold" }).setOrigin(0.5);
    c.add([r, t]);
    const place = () => {
      const s = target();
      if (!s || !s.active || !s.visible) {
        c.setVisible(false);
        return;
      }
      const g = region();
      c.setVisible(true).setPosition((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2).setAngle(s.angle);
      r.setSize(g.x1 - g.x0, g.y1 - g.y0);
      r.setDisplaySize(g.x1 - g.x0, g.y1 - g.y0);
      t.setScale(Math.min(1, (g.x1 - g.x0) / (t.width + 12)));
    };
    place();
    this.every(16, place);
    return c;
  }

  /** Bounds of a sprite in picture coordinates, by fractions of its frame (0 = top/left, 1 = bottom/right). */
  private part(s: Phaser.GameObjects.Sprite, fx0: number, fy0: number, fx1: number, fy1: number) {
    const w = s.displayWidth;
    const h = s.displayHeight;
    const left = s.x - w * s.originX;
    const top = s.y - h * s.originY;
    return { x0: left + w * fx0, y0: top + h * fy0, x1: left + w * fx1, y1: top + h * fy1 };
  }

  /** Whatever bars are up, over whoever's on stage. Added last, so they're on top of everything. */
  private bars() {
    if (this.barAct && this.womanPose === "table") {
      // the whole business: from her waist down, across to his tentacles
      this.bar(
        () => this.woman,
        () => {
          const w = this.part(this.woman!, 0.02, 0.46, 0.98, 1.0);
          const o = this.octo ? this.part(this.octo, 0.1, 0.55, 0.65, 0.98) : w;
          return { x0: Math.min(w.x0, o.x0) - 8, y0: Math.min(w.y0, o.y0) - 4, x1: Math.max(w.x1, o.x1) + 8, y1: Math.max(w.y1, o.y1) + 6 };
        },
        "CENSORED",
        34,
      );
    } else if (this.barLower && this.womanPose !== "off") {
      this.bar(
        () => this.woman,
        () => (this.womanPose === "table" ? this.part(this.woman!, -0.04, 0.46, 1.04, 1.02) : this.part(this.woman!, 0.0, 0.44, 1.0, 1.02)),
      );
    }
    if (this.barFace) this.faceBar();
  }

  /** The climax, as a sitcom does it: a CENSORED bar right across her face. */
  private faceBar() {
    if (this.womanPose === "off") return null;
    return this.bar(() => this.woman, () => this.part(this.woman!, -0.06, 0.02, 1.06, 0.34), "CENSORED", 20);
  }

  /** The exam table shakes (and so does everything on it). */
  private shake() {
    const targets = [this.table, this.woman, this.octo].filter(Boolean) as Phaser.GameObjects.Components.Transform[];
    for (const t of targets) this.sc.tweens.add({ targets: t, x: t.x + 3, duration: 55, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (this.table) this.sc.tweens.add({ targets: this.table, angle: { from: -0.8, to: 0.8 }, duration: 110, yoyo: true, repeat: -1 });
    this.sfx("drp_rattle");
    this.every(2400, () => this.sfx("drp_rattle"));
    this.every(620, () => this.sfx(Math.random() < 0.5 ? "squelch" : "drp_suction"));
  }

  // ------------------------------------------------------------------ beats

  protected onShot(_set: string, framing: string): number {
    const f = framing.toUpperCase();
    this.clearGfx();
    this.stageSet(f.includes("TWO") ? "two" : "wide");
    return 0;
  }

  protected onDirection(a: string): number {
    if (/^INT\./.test(a)) {
      this.stageSet("wide");
      this.push(1.12, 1, this.cx, this.r.SY + 260);
      this.later(30, () => this.push(1.0, 2600, this.cx, this.r.SY + 260));
      return 1200;
    }
    if (/door creaks open/i.test(a)) return this.entrance();
    return 0;
  }

  protected onBlocking(name: string, to: string): number {
    if (name === "THE WOMAN" && to === "enter") {
      this.womanPose = "stand";
      this.womanX = this.L.door;
    }
    return 0;
  }

  /** She comes in through the door, nervously, to applause. */
  private entrance(): number {
    this.womanAnim = "idle";
    this.stageSet("wide");
    const s = this.woman;
    if (!s) return 0;
    s.setAlpha(0);
    this.sc.tweens.add({ targets: s, alpha: 1, duration: 300 });
    this.sc.tweens.add({ targets: s, x: this.L.womanStand, duration: 1100, ease: "Sine.easeOut" });
    this.sc.tweens.add({ targets: s, y: s.y - 4, duration: 140, yoyo: true, repeat: 3 });
    this.womanX = this.L.womanStand;
    return 1300;
  }

  protected onProp(id: string, on: boolean): number {
    if (!id.startsWith("drp:") || !on) return 0;
    const c = id.slice(4);
    const L = this.L;
    switch (c) {
      case "monitor":
        this.glow = true;
        this.stageSet("wide");
        this.push(1.5, 1600, L.deskX + 20, this.r.SY + 250);
        return 600;
      case "underdesk":
        this.underDesk = true;
        this.stageSet("wide");
        this.push(1.6, 2200, L.deskX - 20, this.r.SY + 300);
        return 1600;
      case "surge": {
        this.underDesk = false;
        this.octoPose = "up";
        this.stageSet("wide");
        this.sfx("drp_suction");
        this.sc.tweens.add({ targets: this.octo, y: this.octo!.y - 46, duration: 500, ease: "Back.out" });
        this.octoLift = 46;
        this.octoDo("surge", "unfurl");
        this.later(1400, () => this.octoDo("writhe"));
        this.womanDo("freeze");
        this.crashTo(1.25, this.octo!.x, this.r.SY + 230);
        return 1700;
      }
      case "sweep": {
        // round the desk to the table, and the papers go flying
        this.octoPose = "table";
        this.octoLift = 0;
        this.stageSet("wide");
        const o = this.octo!;
        this.sc.tweens.add({ targets: o, x: L.octoTable, duration: 700, ease: "Sine.easeInOut" });
        this.sc.tweens.add({ targets: o, y: o.y - 6, duration: 120, yoyo: true, repeat: 2 });
        this.octoX = L.octoTable;
        this.later(700, () => {
          this.octoDo("sweep", "idle");
          this.sfx("swing");
          const p = this.cam.getByName("papers") as Phaser.GameObjects.Graphics | null;
          if (p) this.sc.tweens.add({ targets: p, x: -260, y: -40, angle: -40, alpha: 0, duration: 600, ease: "Quad.out" });
          for (let i = 0; i < 8; i++) {
            const sh = this.add(this.sc.add.rectangle(L.tableX + (Math.random() - 0.5) * 80, L.tableBottom - 98, 16, 11, 0xf4f1e6).setStrokeStyle(1, 0x888888));
            this.sc.tweens.add({ targets: sh, x: this.r.SX - 40 - Math.random() * 60, y: sh.y - 60 + Math.random() * 160, angle: Math.random() * 720 - 360, duration: 700 + Math.random() * 400, ease: "Quad.out" });
          }
          this.papers = false;
        });
        this.push(1.15, 1400, L.tableX + 80, this.r.SY + 300);
        return 1500;
      }
      case "lift": {
        // a tentacle round her waist, and up she goes onto the table
        this.stageSet("wide");
        const w = this.woman;
        const o = this.octo;
        if (!w || !o) return 0;
        const g = this.add(this.sc.add.graphics());
        const tip = { x: o.x, y: o.y - 120 };
        const draw = () => {
          g.clear();
          g.lineStyle(10, 0x7a2f63, 1);
          const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(o.x - 20, o.y - 100), new Phaser.Math.Vector2((o.x + tip.x) / 2, Math.min(o.y, tip.y) - 70), new Phaser.Math.Vector2(tip.x, tip.y));
          path.draw(g, 24);
          g.lineStyle(6, 0xd06aa8, 1);
          path.draw(g, 24);
        };
        this.sfx("drp_suction");
        this.sc.tweens.add({ targets: tip, x: w.x, y: w.y - w.displayHeight * 0.52, duration: 450, ease: "Quad.out", onUpdate: draw });
        this.later(500, () => {
          this.womanDo("freeze");
          this.sc.tweens.add({ targets: w, x: L.womanTable, y: L.tableBottom - 50, duration: 900, ease: "Sine.easeInOut" });
          this.sc.tweens.add({ targets: tip, x: L.womanTable, y: L.tableBottom - 50 - w.displayHeight * 0.52, duration: 900, ease: "Sine.easeInOut", onUpdate: draw });
        });
        this.later(1450, () => {
          this.womanPose = "table";
          this.womanX = L.womanTable;
          this.womanAnim = "dazed";
          this.stageSet("two");
          this.womanDo("gasp", "sit");
          this.sfx("gasp");
          this.blush();
        });
        this.push(1.1, 1400, L.tableX + 120, this.r.SY + 280);
        return 2300;
      }
      case "pants": {
        // the trousers come down: from here to the door, her lower half is behind a bar
        this.barLower = true;
        this.octoAnim = "writhe";
        this.stageSet("two");
        this.sfx("zip_down");
        this.bang("ZWIP!", (this.woman?.x ?? L.tableX) + 30, this.r.SY + 300, 28);
        return 700;
      }
      case "work":
        this.barAct = true;
        this.shaking = true;
        this.octoAnim = "writhe";
        this.womanAnim = "dazed";
        this.stageSet("two");
        this.blush();
        return 1400;
      case "shake":
        this.barAct = true;
        this.shaking = true;
        this.stageSet("wide");
        this.push(1.2, 1, L.tableX + 70, this.r.SY + 320);
        this.handheld(2);
        return 1800;
      case "climax": {
        // the comic splat: a big CENSORED bar slammed across her face. Nothing else is drawn.
        this.shaking = false;
        this.barAct = false;
        this.stageSet("woman");
        this.sfx("drp_splat");
        this.barFace = true;
        const fb = this.faceBar();
        if (fb) this.sc.tweens.add({ targets: fb, scale: { from: 3, to: 1 }, duration: 160, ease: "Quad.in" });
        this.bang("SPLAT!", (this.woman?.x ?? this.cx) + 60, (this.woman?.y ?? this.cy) - 200, 30);
        this.sc.cameras.main.shake(260, 0.012);
        if (!G.meta?.settings?.calmFlash) this.sc.cameras.main.flash(90, 255, 255, 255);
        return 1500;
      }
      case "after":
        this.shaking = false;
        this.barAct = false;
        this.barFace = false;
        this.octoAnim = "idle";
        this.womanAnim = "dazed";
        this.stageSet("two");
        this.blush();
        return 0;
      case "usher": {
        // clothes into her arms, a slap on the backside, towards the door
        this.womanPose = "out";
        this.womanX = L.womanTable + 40;
        this.womanAnim = "out";
        this.octoAnim = "idle";
        this.stageSet("wide");
        const w = this.woman;
        if (!w) return 0;
        this.later(350, () => {
          this.sfx("drp_slap");
          this.bang("SLAP!", w.x - 10, w.y - w.displayHeight * 0.45, 30);
          this.sc.tweens.add({ targets: w, y: w.y - 14, duration: 110, yoyo: true, ease: "Quad.out" });
          this.octoDo("sweep", "idle");
        });
        this.later(700, () => {
          this.womanDo("walk");
          this.sc.tweens.add({ targets: w, x: L.womanDoor, duration: 1600, ease: "Sine.easeInOut", onComplete: () => this.womanDo("out") });
          this.womanX = L.womanDoor;
          this.sc.tweens.add({ targets: this.octo, x: L.womanDoor - 150, duration: 1700, ease: "Sine.easeInOut" });
          this.octoX = L.womanDoor - 150;
        });
        return 2500;
      }
      case "slam": {
        this.stageSet("wide");
        const w = this.woman;
        if (w) this.sc.tweens.add({ targets: w, x: L.door + 60, alpha: 0, duration: 450, ease: "Quad.in" });
        this.later(500, () => {
          this.womanPose = "off";
          this.barLower = false;
          this.woman?.destroy();
          this.woman = null;
          this.sfx("drp_lock");
          this.sc.cameras.main.shake(180, 0.008);
          this.bang("SLAM!", L.door, this.r.SY + 200, 34);
        });
        return 1000;
      }
      case "settle": {
        // back to the desk, a slump, a tentacle for the mouse; the glow brightens (the volume goes up)
        this.octoPose = "desk";
        this.octoX = L.octoDesk;
        this.octoLift = 0;
        this.octoAnim = "slump";
        this.stageSet("wide");
        this.octoDo("slump", "mouse");
        this.later(1700, () => {
          this.sfx("select");
          this.monitorGlow(L.deskX + 72, L.deskBottom - 150);
          const vol = this.add(this.sc.add.container(L.deskX + 72, L.deskBottom - 200));
          vol.add(this.text(0, 0, "VOL", 12, "#ff9ad8", { fontStyle: "bold" }).setOrigin(1, 0.5));
          for (let i = 0; i < 8; i++) {
            const b = this.sc.add.rectangle(6 + i * 7, 0, 5, 6 + i * 2, 0xff5fc8).setOrigin(0, 0.5).setAlpha(0);
            vol.add(b);
            this.sc.tweens.add({ targets: b, alpha: 1, delay: i * 90, duration: 60 });
          }
        });
        this.push(1.5, 2400, L.deskX, this.r.SY + 250);
        return 2000;
      }
    }
    return 0;
  }

  /**
   * The camera: zoom to `to` and put (fx, fy) in the middle of the frame (not just hold it still, as the base push
   * does), clamped so the frame never runs off the edge of the set.
   */
  private camTween: Phaser.Tweens.Tween | null = null;

  protected clear() {
    this.camTween?.remove();
    this.camTween = null;
    super.clear();
  }

  protected push(to: number, ms: number, fx = this.cx, fy = this.cy, ease = "Sine.easeInOut") {
    const { SX, SY, SW, SH } = this.r;
    const p = this.camProxy;
    const start = { s: p.s, x: this.cam.x, y: this.cam.y };
    const clampX = (x: number, s: number) => Math.min(SX - SX * s, Math.max(SX + SW - (SX + SW) * s, x));
    const clampY = (y: number, s: number) => Math.min(SY - SY * s, Math.max(SY + SH - (SY + SH) * s, y));
    const end = { s: to, x: clampX(this.cx - fx * to, to), y: clampY(this.cy - fy * to, to) };
    if (to <= 1) Object.assign(end, { x: this.cx * (1 - to), y: this.cy * (1 - to) });
    const k = { t: 0 };
    p.fx = fx;
    p.fy = fy;
    this.camTween?.remove();
    this.camTween = this.sc.tweens.add({
      targets: k,
      t: 1,
      duration: Math.max(1, ms),
      ease,
      onUpdate: () => {
        p.s = start.s + (end.s - start.s) * k.t;
        this.cam.setScale(p.s).setPosition(start.x + (end.x - start.x) * k.t, start.y + (end.y - start.y) * k.t);
      },
      onComplete: () => {
        p.s = end.s;
        this.cam.setScale(end.s).setPosition(end.x, end.y);
      },
    });
  }

  private crashTo(to: number, fx: number, fy: number) {
    this.push(to, 160, fx, fy, "Quad.out");
  }

  /** Flushed cheeks: a soft pink over her face. */
  private blush() {
    const w = this.woman;
    if (!w) return;
    const g = this.add(this.sc.add.ellipse(w.x, w.y - w.displayHeight * 0.83, w.displayWidth * 0.32, 10, 0xff6b8a, 0.35));
    this.every(16, () => w.active && g.setPosition(w.x, w.y - w.displayHeight * 0.83));
    this.sc.tweens.add({ targets: g, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
  }

  // ------------------------------------------------------------------ dialogue

  protected onSpeak(name: string, text: string, emotion: string): number {
    const o = name.startsWith("OCTO");
    const close = o ? "octo" : "woman";
    // cut to the speaker's single (every third line or so plays in the two-shot instead)
    const keep = this.shot === "two" && !this.shaking && this.hash(text) % 3 === 0;
    if (this.shot !== close && !keep) this.stageSet(close);
    const ms = Math.min(7000, 600 + text.length * 70);
    if (o) {
      const back = this.octoAnim;
      this.octoDo("talk");
      this.octoAnim = back;
      this.later(ms, () => this.octo?.active && this.play(this.octo, OCTO, back));
      if (/ecstatic|deranged/.test(emotion)) this.handheld(2);
    } else {
      const seated = this.womanPose === "table";
      const back = this.womanAnim;
      if (this.womanPose === "stand" || seated) {
        this.womanDo(seated ? "sittalk" : "talk");
        this.womanAnim = back;
        this.later(ms, () => this.woman?.active && this.play(this.woman, WOMAN, back));
      }
      if (seated) this.blush();
    }
    return 0;
  }

  protected onAudience(cue: string): number {
    if (this.shot === "card") return 0;
    if (cue === "laugh" || cue === "biglaugh") {
      // hold on the reaction: whoever didn't just speak
      const other = this.lastSpeaker.startsWith("OCTO") ? "woman" : "octo";
      if ((other === "woman" && this.womanPose !== "off") || other === "octo") {
        if (this.shot !== "wide" || cue === "biglaugh") this.stageSet(other);
        if (other === "woman" && this.woman && this.womanPose === "stand") this.womanDo("freeze");
      }
      return 0;
    }
    if (cue === "gasp" && this.woman && this.womanPose === "table") this.womanDo("gasp", "dazed");
    return 0;
  }

  // ------------------------------------------------------------------ cutaways

  /** Crop into the set on a point of the backdrop (source pixels). */
  private crop(px: number, py: number, zoom: number) {
    const k = this.tex(OFFICE);
    const src = k ? (this.sc.textures.get(k).getSourceImage() as HTMLImageElement) : null;
    const W = src?.width ?? 320;
    const H = src?.height ?? 240;
    const base = Math.max(this.r.SW / W, this.r.SH / H);
    const mx = ((W * base * zoom) - this.r.SW) / 2;
    const my = ((H * base * zoom) - this.r.SH) / 2;
    const ox = Phaser.Math.Clamp(-(px - W / 2) * base * zoom, -mx, mx);
    const oy = Phaser.Math.Clamp(-(py - H / 2) * base * zoom, -my, my);
    return this.backdrop(k, { zoom, ox, oy });
  }

  protected onInsert(id: string): number {
    this.insertHold = 0;
    this.clear();
    this.shot = "insert";
    const { SX, SY, SW, SH } = this.r;
    const cx = this.cx;
    const cy = this.cy;
    // whatever's going on off-screen is still going on: the rattle and the squelch carry over the cutaway
    if (this.shaking || this.barAct) {
      this.sfx("drp_rattle");
      this.every(520, () => this.sfx(Math.random() < 0.6 ? "squelch" : "drp_suction"));
    }
    switch (id) {
      case "drp_clock": {
        this.crop(160, 78, 4.2);
        // the hands whizz round: time passes
        const g = this.add(this.sc.add.graphics({ x: cx, y: cy }));
        let a = 0;
        this.every(30, () => {
          a += 0.25;
          g.clear();
          g.lineStyle(6, 0x1a1a1a).lineBetween(0, 0, Math.cos(a / 12 - Math.PI / 2) * 46, Math.sin(a / 12 - Math.PI / 2) * 46);
          g.lineStyle(4, 0x1a1a1a).lineBetween(0, 0, Math.cos(a - Math.PI / 2) * 74, Math.sin(a - Math.PI / 2) * 74);
        });
        this.sfx("tap");
        this.every(400, () => this.sfx("tap"));
        return 2200;
      }
      case "drp_diploma": {
        const img = this.crop(28, 92, 3.4);
        // the diploma rattles on its nail, and slips further crooked
        this.sc.tweens.add({ targets: img, x: img.x + 3, duration: 60, yoyo: true, repeat: -1 });
        this.sc.tweens.add({ targets: this.cam, angle: -4, duration: 1800, ease: "Sine.easeIn" });
        return 2200;
      }
      case "drp_fishtank": {
        this.crop(222, 100, 3.6);
        // the fish watch. The water sloshes.
        const water = this.add(this.sc.add.rectangle(cx, cy - 20, SW * 0.9, 18, 0x7fd8ff, 0.35));
        this.sc.tweens.add({ targets: water, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1 });
        this.every(140, () => {
          const b = this.add(this.sc.add.circle(cx - 140 + Math.random() * 280, cy + 120, 3 + Math.random() * 5, 0xdff6ff, 0.8));
          this.sc.tweens.add({ targets: b, y: cy - 60, alpha: 0, duration: 900 + Math.random() * 500, onComplete: () => b.destroy() });
        });
        this.sfx("splash");
        const q = this.add(this.text(cx + 40, cy - 70, "?!", 40, "#ffffff", { fontStyle: "bold", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setScale(0));
        this.sc.tweens.add({ targets: q, scale: 1, delay: 700, duration: 200, ease: "Back.out" });
        return 2400;
      }
      case "drp_sushi": {
        const k = this.tex(DESK);
        if (k) {
          const src = this.sc.textures.get(k).getSourceImage() as HTMLImageElement;
          const img = this.add(this.sc.add.image(cx, cy, k));
          const z = 6.5 * (src.width / 192);
          img.setScale(z / (src.width / 192));
          img.setPosition(cx - (src.width * 0.55 - src.width / 2) * img.scale, cy - (src.height * 0.42 - src.height / 2) * img.scale);
          this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x000000, 0).setOrigin(0));
          this.sc.tweens.add({ targets: img, y: img.y - 5, duration: 70, yoyo: true, repeat: 12 });
        } else this.black(0x3a2a1a);
        // a roll wobbles off the plate
        const roll = this.add(this.sc.add.container(cx + 30, cy - 10));
        roll.add(this.sc.add.circle(0, 0, 20, 0x1d2b1d));
        roll.add(this.sc.add.circle(0, 0, 14, 0xf6f2e8));
        roll.add(this.sc.add.circle(0, 0, 6, 0xff7a5a));
        this.sc.tweens.add({ targets: roll, x: cx + 300, angle: 540, y: cy + 200, delay: 500, duration: 1100, ease: "Quad.in" });
        this.sfx("drp_splat");
        this.sc.cameras.main.shake(200, 0.006);
        return 2000;
      }
      case "drp_monitor": {
        // the screen (seen from his side): a pink glow, and BLOCKED. Nothing else.
        this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x1a1016).setOrigin(0));
        this.add(this.sc.add.rectangle(cx, cy - 10, SW * 0.78, SH * 0.66, 0xcbbfa6).setStrokeStyle(8, 0x8a8170));
        const scr = this.add(this.sc.add.rectangle(cx, cy - 10, SW * 0.68, SH * 0.54, 0xff5fc8));
        this.sc.tweens.add({ targets: scr, alpha: 0.75, duration: 240, yoyo: true, repeat: -1 });
        const glow = this.add(this.sc.add.rectangle(cx, cy - 10, SW, SH, 0xff5fc8, 0.12));
        glow.setBlendMode(Phaser.BlendModes.ADD);
        const stamp = this.add(this.sc.add.container(cx, cy - 10).setAngle(-12).setScale(2.4));
        stamp.add(this.sc.add.rectangle(0, 0, 230, 70, 0x000000, 0.9).setStrokeStyle(6, 0xff2a2a));
        stamp.add(this.text(0, 0, "BLOCKED", 44, "#ff2a2a", { fontStyle: "bold" }).setOrigin(0.5));
        this.sc.tweens.add({ targets: stamp, scale: 1, duration: 220, ease: "Back.out" });
        this.later(60, () => this.sfx("ai_deny"));
        return 2000;
      }
    }
    return 0;
  }

  // ------------------------------------------------------------------ cards

  protected onTitle(t: string): number {
    const up = t.toUpperCase();
    this.clearGfx();
    if (!this.titleDone && up === "DR. PUSS") return this.logo();
    if (!this.titleDone && /^EPISODE/i.test(t)) return this.epCard(t);
    if (/WRITTEN BY/.test(up)) return this.credits(t);
    this.black();
    this.shot = "card";
    const end = /END OF EPISODE/.test(up);
    this.add(this.text(this.cx, this.cy, t, end ? 30 : 15, end ? "#ff9ad8" : "#ffffff", { align: "center", fontStyle: end ? "bold" : "normal", wordWrap: { width: this.r.SW - 80 } }).setOrigin(0.5));
    return 0;
  }

  /** The title: murky water, bubbles, the logo dripping in, Octo bobbing up. */
  private logo(): number {
    this.clear();
    this.shot = "card";
    const { SX, SY, SW, SH } = this.r;
    const g = this.add(this.sc.add.graphics());
    for (let i = 0; i < 14; i++) {
      g.fillStyle(Phaser.Display.Color.GetColor(14 + i * 3, 40 + i * 6, 46 + i * 5), 1).fillRect(SX, SY + (i * SH) / 14, SW, SH / 14 + 1);
    }
    this.every(90, () => {
      const b = this.add(this.sc.add.circle(SX + Math.random() * SW, SY + SH + 10, 2 + Math.random() * 7, 0xbff3ff, 0.5));
      this.sc.tweens.add({ targets: b, y: SY - 20, x: b.x + (Math.random() - 0.5) * 60, duration: 2200 + Math.random() * 1600, onComplete: () => b.destroy() });
    });
    if (this.tex(OCTO_KEY)) {
      const o = this.add(this.sc.add.sprite(SX + SW * 0.5, SY + SH + 200, OCTO_KEY, 0).setOrigin(0.5, 1));
      this.realScale(o, 1.9);
      this.play(o, OCTO, "arms");
      this.sc.tweens.add({ targets: o, y: SY + SH + 30, duration: 1400, delay: 900, ease: "Back.out" });
    }
    const words = ["DR.", "PUSS"];
    words.forEach((w, i) => {
      const t = this.add(this.text(this.cx, SY + 70 + i * 82, w, i ? 86 : 50, i ? "#ff7ad0" : "#ffffff", { fontStyle: "bold", stroke: "#2a0a2a", strokeThickness: 10 }).setOrigin(0.5).setScale(0).setAngle(i ? -4 : 3));
      this.sc.tweens.add({ targets: t, scale: 1, duration: 420, delay: 200 + i * 450, ease: "Back.out" });
      this.later(200 + i * 450, () => this.sfx(i ? "drp_splat" : "drp_suction"));
      this.sc.tweens.add({ targets: t, y: t.y + 5, duration: 700, yoyo: true, repeat: -1, delay: 1500 + i * 200, ease: "Sine.easeInOut" });
      // drips off the logo
      if (i)
        this.every(300, () => {
          const d = this.add(this.sc.add.rectangle(this.cx - 120 + Math.random() * 240, t.y + 34, 4, 8, 0xff7ad0, 0.9));
          this.sc.tweens.add({ targets: d, y: d.y + 80, alpha: 0, duration: 900, onComplete: () => d.destroy() });
        });
    });
    const tag = this.add(this.text(this.cx, SY + 236, "general practitioner · secret gynaecologist", 15, "#cfe8e8", { fontStyle: "italic", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: tag, alpha: 1, delay: 1600, duration: 500 });
    return 1200;
  }

  private epCard(t: string): number {
    this.clear();
    this.shot = "card";
    const { SY, SH } = this.r;
    this.backdrop(this.tex(OFFICE), { blur: 1, tint: 0x8aa0a0 });
    if (this.tex(OCTO_KEY)) {
      const o = this.add(this.sc.add.sprite(this.cx + 130, SY + SH + 4, OCTO_KEY, 0).setOrigin(0.5, 1));
      this.realScale(o, 1.8);
      this.play(o, OCTO, "idle");
    }
    if (this.tex(WOMAN_KEY)) {
      const w = this.add(this.sc.add.sprite(this.cx - 140, SY + SH + 4, WOMAN_KEY, 0).setOrigin(0.5, 1));
      this.realScale(w, 1.7);
      this.play(w, WOMAN, "idle");
    }
    const title = this.add(this.text(this.cx, SY + 70, t, 24, "#ffffff", { fontStyle: "bold", stroke: "#000", strokeThickness: 6, align: "center", wordWrap: { width: this.r.SW - 60 } }).setOrigin(0.5).setAlpha(0));
    this.sc.tweens.add({ targets: title, alpha: 1, duration: 400 });
    this.later(2200, () => this.sfx("tv_sting"));
    this.titleDone = true;
    return 2600;
  }

  private credits(t: string): number {
    this.clear();
    this.shot = "card";
    const { SX, SY, SW, SH } = this.r;
    this.add(this.sc.add.rectangle(SX, SY, SW, SH, 0x0e2a2e).setOrigin(0));
    if (this.tex(OCTO_KEY)) {
      const o = this.add(this.sc.add.sprite(SX + SW * 0.8, SY + SH + 4, OCTO_KEY, 0).setOrigin(0.5, 1).setAlpha(0.5));
      this.realScale(o, 1.6);
      this.play(o, OCTO, "idle");
    }
    const roll = this.add(this.sc.add.container(this.cx, SY + SH + 20));
    const lines = ["DR. PUSS", "", ...t.split("\n").slice(1), "", "STARRING", "Octo Puss", "The Woman", "", "Filmed in front of a live studio audience", "(they have been offered counselling)"];
    lines.forEach((l, i) => roll.add(this.text(0, i * 26, l, i === 0 ? 26 : 15, i === 0 ? "#ff7ad0" : "#ffffff", { fontStyle: i === 0 || l === "STARRING" ? "bold" : "normal", align: "center", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5, 0)));
    this.sc.tweens.add({ targets: roll, y: SY - lines.length * 26 + 140, duration: 6000, ease: "Linear" });
    return 3000;
  }
}
