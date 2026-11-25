// Engine test (Phaser side): pitch, 22 players, 300 crowd, controllable fat man,
// touch joystick, action button with a beep. Mirrors enginetest/godot/main.gd.
import Phaser from "phaser";

const W = 1600, H = 1000;
const PITCH = new Phaser.Geom.Rectangle(400, 250, 800, 500);

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Mover { s: Phaser.GameObjects.Image; tx: number; ty: number; }

class TestScene extends Phaser.Scene {
  rnd = mulberry32(12345);
  crowd: Mover[] = [];
  players: Mover[] = [];
  pies: { s: Phaser.GameObjects.Image; vx: number; vy: number; life: number }[] = [];
  me!: Phaser.GameObjects.Image;
  joyId = -1; joyOx = 0; joyOy = 0; jx = 0; jy = 0;
  joyRing!: Phaser.GameObjects.Arc; joyKnob!: Phaser.GameObjects.Arc;
  fps!: Phaser.GameObjects.Text;
  keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  audio?: AudioContext;

  create() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRect(0, 0, 14, 14).generateTexture("sq", 14, 14).clear();
    g.fillStyle(0xffffff).fillCircle(9, 9, 9).generateTexture("dot", 18, 18).clear();
    g.fillStyle(0xd91a1a).fillCircle(16, 16, 16).fillStyle(0xffffff).fillCircle(16, 16, 9)
      .generateTexture("me", 32, 32).clear();
    g.fillStyle(0x40454d).fillRect(0, 0, W, H);
    g.fillStyle(0x2e8038).fillRectShape(PITCH);
    g.lineStyle(3, 0xffffff).strokeRectShape(PITCH);
    g.lineBetween(800, 250, 800, 750).strokeCircle(800, 500, 70);

    for (let i = 0; i < 300; i++) {
      let x = 0, y = 0;
      do { x = this.rnd() * W; y = this.rnd() * H; }
      while (x > 380 && x < 1220 && y > 230 && y < 770);
      const s = this.add.image(x, y, "sq");
      s.setTint(Phaser.Display.Color.HSVToRGB(this.rnd(), 0.5, 0.9).color);
      this.crowd.push({ s, tx: x, ty: y });
    }
    for (let i = 0; i < 22; i++) {
      const x = PITCH.x + this.rnd() * PITCH.width, y = PITCH.y + this.rnd() * PITCH.height;
      const s = this.add.image(x, y, "dot").setTint(i < 11 ? 0xffffff : 0xe6cc1a);
      this.players.push({ s, tx: x, ty: y });
    }
    this.me = this.add.image(300, 500, "me");
    this.cameras.main.startFollow(this.me);

    this.joyRing = this.add.circle(0, 0, 50).setStrokeStyle(3, 0xffffff, 0.5).setScrollFactor(0).setVisible(false);
    this.joyKnob = this.add.circle(0, 0, 20, 0xffffff, 0.5).setScrollFactor(0).setVisible(false);
    this.fps = this.add.text(12, 8, "fps", { fontFamily: "sans-serif", fontSize: "16px", color: "#fff" }).setScrollFactor(0);
    this.keys = this.input.keyboard!.createCursorKeys();
    this.input.addPointer(2);
    const st = document.getElementById("status");
    if (st) st.textContent = "Phaser loaded in " + ((performance.now() - (window as any).__t0) / 1000).toFixed(1) + " s";

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.x < this.scale.width / 2 && this.joyId === -1) {
        this.joyId = p.id; this.joyOx = p.x; this.joyOy = p.y; this.jx = this.jy = 0;
        this.joyRing.setPosition(p.x, p.y).setVisible(true);
        this.joyKnob.setPosition(p.x, p.y).setVisible(true);
      } else if (p.x >= this.scale.width / 2) this.action();
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      let dx = (p.x - this.joyOx) / 50, dy = (p.y - this.joyOy) / 50;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      this.jx = dx; this.jy = dy;
      this.joyKnob.setPosition(this.joyOx + dx * 50, this.joyOy + dy * 50);
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      this.joyId = -1; this.jx = this.jy = 0;
      this.joyRing.setVisible(false); this.joyKnob.setVisible(false);
    };
    this.input.on("pointerup", up); this.input.on("pointerupoutside", up);
  }

  action() {
    this.audio ??= new AudioContext();
    const o = this.audio.createOscillator(), gain = this.audio.createGain();
    o.frequency.value = 880; gain.gain.setValueAtTime(0.2, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.15);
    o.connect(gain).connect(this.audio.destination); o.start(); o.stop(this.audio.currentTime + 0.15);
    const l = Math.hypot(this.jx, this.jy);
    const dx = l > 0.1 ? this.jx / l : 1, dy = l > 0.1 ? this.jy / l : 0;
    const s = this.add.image(this.me.x, this.me.y, "dot").setTint(0xcc8033).setScale(0.66);
    this.pies.push({ s, vx: dx * 500, vy: dy * 500, life: 1.2 });
  }

  wander(m: Mover, x0: number, y0: number, w: number, h: number, sp: number, dt: number) {
    const dx = m.tx - m.s.x, dy = m.ty - m.s.y, l = Math.hypot(dx, dy);
    if (l < 4) { m.tx = x0 + this.rnd() * w; m.ty = y0 + this.rnd() * h; }
    else { m.s.x += (dx / l) * sp * dt; m.s.y += (dy / l) * sp * dt; }
  }

  update(_t: number, dms: number) {
    const dt = Math.min(dms, 100) / 1000;
    let mx = this.jx, my = this.jy;
    if (Math.hypot(mx, my) < 0.05) {
      mx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
      my = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    }
    this.me.x = Phaser.Math.Clamp(this.me.x + mx * 160 * dt, 0, W);
    this.me.y = Phaser.Math.Clamp(this.me.y + my * 160 * dt, 0, H);
    for (const m of this.crowd) this.wander(m, 0, 0, W, H, 40, dt);
    for (const m of this.players) this.wander(m, PITCH.x, PITCH.y, PITCH.width, PITCH.height, 120, dt);
    for (const p of this.pies) { p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.life -= dt; if (p.life <= 0) p.s.destroy(); }
    this.pies = this.pies.filter((p) => p.life > 0);
    this.fps.setText(`Phaser  ${Math.round(this.game.loop.actualFps)} fps`);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#202428",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: TestScene,
});
