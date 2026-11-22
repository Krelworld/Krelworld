import Phaser from "phaser";
import { synth } from "../audio/Synth";
import { PIXEL_BOLD, PIXEL_FONT } from "../ui/theme";

/**
 * The very first screen: key art of Krelford at night, the logo, and "press any key".
 * (The press is also what lets the browser start the music.)
 */
export class EnterScene extends Phaser.Scene {
  private gone = false;
  private logo?: Phaser.GameObjects.Container;
  private prompt?: Phaser.GameObjects.Container;

  constructor() {
    super("Enter");
  }

  create() {
    this.gone = false;
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x07040d);

    // the key art, drifting very slowly in
    if (this.textures.exists("bg_enter")) {
      const bg = this.add.image(480, 270, "bg_enter").setScale(2.02);
      this.tweens.add({ targets: bg, scale: 2.1, y: 262, duration: 22000, ease: "Sine.inOut", yoyo: true, repeat: -1 });
    }

    // the Tap glows on the horizon
    const tapGlow = this.add.ellipse(496, 196, 190, 230, 0xffc94a, 0.14).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: tapGlow, alpha: 0.28, scaleX: 1.12, scaleY: 1.08, yoyo: true, repeat: -1, duration: 1800, ease: "Sine.inOut" });

    // twinkles in the sky and embers drifting up off the town
    for (let i = 0; i < 40; i++) {
      const s = this.add.rectangle(Math.random() * 960, Math.random() * 200, 2, 2, 0xffffff, 0.2 + Math.random() * 0.6);
      this.tweens.add({ targets: s, alpha: 0.05, yoyo: true, repeat: -1, duration: 700 + Math.random() * 2200, delay: Math.random() * 2000 });
    }
    for (let i = 0; i < 18; i++) this.ember(Math.random() * 6000);

    // top and bottom shade so the words sit on something
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x07040d, 0x07040d, 0x07040d, 0x07040d, 0.85, 0.85, 0, 0);
    shade.fillRect(0, 0, 960, 150);
    shade.fillGradientStyle(0x07040d, 0x07040d, 0x07040d, 0x07040d, 0, 0, 0.9, 0.9);
    shade.fillRect(0, 380, 960, 160);

    // the logo: a deep drop shade, then gold over a dark outline
    const logo = this.add.container(480, 86);
    const word = "KRELWORLD";
    const under = this.add.text(5, 7, word, { fontFamily: PIXEL_BOLD, fontSize: "96px", color: "#2a0c3a", stroke: "#2a0c3a", strokeThickness: 12 }).setOrigin(0.5);
    const top = this.add.text(0, 0, word, { fontFamily: PIXEL_BOLD, fontSize: "96px", color: "#ffd23f", stroke: "#3b1500", strokeThickness: 10 }).setOrigin(0.5);
    const grad = top.context.createLinearGradient(0, 0, 0, top.height);
    grad.addColorStop(0.2, "#fff3a8");
    grad.addColorStop(0.55, "#ffd23f");
    grad.addColorStop(0.9, "#ff8c1a");
    top.setFill(grad);
    const sub = this.add.text(0, 72, "WONK 'TIL YOU KREZ", { fontFamily: PIXEL_BOLD, fontSize: "32px", color: "#ff6fa8", stroke: "#2a0c3a", strokeThickness: 8 }).setOrigin(0.5);
    logo.add([under, top, sub]);
    this.logo = logo;
    logo.setAlpha(0).setScale(1.25);
    this.tweens.add({ targets: logo, alpha: 1, scale: 1, duration: 650, ease: "Back.out", delay: 250 });
    this.tweens.add({ targets: logo, y: 92, yoyo: true, repeat: -1, duration: 2400, ease: "Sine.inOut", delay: 900 });
    // the prompt: a pill that breathes
    const prompt = this.add.container(480, 452);
    const pill = this.add.graphics();
    pill.fillStyle(0x07040d, 0.72).fillRoundedRect(-170, -26, 340, 52, 26);
    pill.lineStyle(2, 0xffd23f, 0.9).strokeRoundedRect(-170, -26, 340, 52, 26);
    const press = this.add.text(0, 1, "PRESS ANY KEY", { fontFamily: PIXEL_BOLD, fontSize: "32px", color: "#ffd23f" }).setOrigin(0.5);
    prompt.add([pill, press]);
    prompt.setSize(340, 52).setInteractive({ useHandCursor: true });
    this.prompt = prompt;
    prompt.setAlpha(0);
    this.tweens.add({ targets: prompt, alpha: 1, duration: 500, delay: 900, onComplete: () => {
      this.tweens.add({ targets: press, alpha: 0.35, yoyo: true, repeat: -1, duration: 800, ease: "Sine.inOut" });
    } });
    prompt.on("pointerover", () => press.setColor("#ffffff"));
    prompt.on("pointerout", () => press.setColor("#ffd23f"));

    this.add.text(480, 496, "OR CLICK / TAP", { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#b9a8e0" }).setOrigin(0.5);
    this.add.text(16, 520, "A WORK OF FICTION", { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#6d5f8f" }).setOrigin(0, 0.5);
    this.add.text(944, 520, "SOUND ON  ♪", { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#6d5f8f" }).setOrigin(1, 0.5);

    cam.fadeIn(700, 7, 4, 13);
    this.input.on("pointerdown", () => this.enter());
    this.input.keyboard?.on("keydown", () => this.enter());
    this.input.gamepad?.once("down", () => this.enter());
  }

  /** One glowing mote floating up out of the town, forever. */
  private ember(delay: number) {
    const e = this.add.rectangle(0, 0, 3, 3, Math.random() < 0.5 ? 0xffc94a : 0xff6fa8, 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const go = () => {
      e.setPosition(80 + Math.random() * 800, 380 + Math.random() * 120);
      e.setAlpha(0);
      this.tweens.add({
        targets: e,
        y: e.y - 160 - Math.random() * 160,
        x: e.x + (Math.random() - 0.5) * 80,
        alpha: { from: 0.9, to: 0 },
        duration: 4000 + Math.random() * 3000,
        ease: "Sine.out",
        onComplete: go,
      });
    };
    this.time.delayedCall(delay, go);
  }

  private enter() {
    if (this.gone) return;
    this.gone = true;
    synth.unlock();
    synth.play("perfect");
    const cam = this.cameras.main;
    cam.flash(260, 255, 210, 63);
    if (this.logo) this.tweens.add({ targets: this.logo, scale: 1.15, duration: 600, ease: "Cubic.in" });
    if (this.prompt) this.tweens.add({ targets: this.prompt, alpha: 0, duration: 200 });
    cam.zoomTo(1.08, 650, "Cubic.easeIn");
    cam.fadeOut(650, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Title"));
  }
}
