import Phaser from "phaser";
import { G } from "../G";
import { DialogueBox } from "../ui/DialogueBox";
import { switchTo } from "../Flow";
import { synth } from "../audio/Synth";
import { backdrop } from "../gfx/HD";
import { playerKey } from "../gfx/sanmikForm";
import { polsonVisit } from "../../content/polsonChats";
import { takeIndoorToken, tokenTrail } from "../systems/arcs";
import { dir, say } from "../../content/dsl";
import { clueAt, clueTex, takeClue } from "../systems/trails";
import { shinyColours, shinyPickup, trailPropScale } from "../gfx/shiny";
import { Controls } from "../combat/Controls";
import { FONT } from "../ui/theme";

/**
 * Popping round Polson Towers (after Chapter 3): his front room, the sofa bed out, the curtains drawn.
 * Plays one of the real Messenger conversations with him, then you're back outside on his road.
 */
export class PolsonHomeScene extends Phaser.Scene {
  constructor() {
    super("PolsonHome");
  }

  create() {
    this.cameras.main.fadeIn(300);
    if (!backdrop(this, "bg_polson_home", { depth: -10, dim: 0.05 })) this.add.rectangle(480, 270, 960, 540, 0x3b1f22).setDepth(-10);
    synth.music("hub");
    // you by the door, Polson by the sofa bed
    const me = this.add.sprite(320, 352, playerKey(this), 0).setOrigin(0.5, 1).setScale(4.4).setDepth(300);
    const pol = this.add.sprite(590, 352, this.textures.exists("spr_POLSON") ? "spr_POLSON" : "spr_FOLK0", 0).setOrigin(0.5, 1).setScale(4.4).setDepth(400);
    pol.setFlipX(true);
    this.tweens.add({ targets: pol, y: pol.y - 3, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
    me.setData("facing", "east");
    const box = new DialogueBox(this, 1000, 0.15);
    // the Cronster's cuddle token, glowing pink on the sofa bed (chapter 3)
    const tokenHere = !!tokenTrail(G.s)?.indoorLeft.some(({ sp }) => sp.inside === "POLSON") && !tokenTrail(G.s)?.outdoorLeft.length;
    const tok = tokenHere && this.textures.exists("p_token") ? this.add.image(470, 300, "p_token").setScale(2.6).setDepth(350) : null;
    if (tok) this.tweens.add({ targets: tok, y: tok.y - 6, yoyo: true, repeat: -1, duration: 600 });
    // a clue on this chapter's explore-before-the-dungeon trail (chapter 4: a golden wrapper down the sofa bed)
    const clue = clueAt(G.s, "POLSON");
    const ctex = clue && clueTex(clue.trail, clue.i);
    const shiny = clue && ctex && this.textures.exists(ctex) ? shinyPickup(this, clue.clue.x, clue.clue.y, ctex, { scale: trailPropScale(this, ctex, 48), depth: 350, size: 0.85, tag: `✦ ${clue.trail.label.replace(/S$/, "")}`, ...shinyColours(clue.trail.tint) }) : null;
    const controls = new Controls(this);
    let lines = polsonVisit(G.s);
    // (you don't leave yet: there's something glowing on the sofa bed)
    if (shiny) lines = lines.filter((l) => !l.t.startsWith("You leave Polson Towers"));
    G.save();
    const takeToken = async () => {
      const t = takeIndoorToken(G.s, "POLSON");
      if (!t) return;
      tok?.destroy();
      synth.play("pickup");
      await box.play([dir("Wedged down the side of the sofa bed, between a Papa Gino's menu and a protein bar wrapper: a chocolate cuddle token."), say("POLSON", "That's not mine!! I'd have eaten it 😅"), ...t.lines]);
      G.emit("toast", { title: "THE CUDDLE CRONSTER", text: t.toast });
      G.save();
    };
    const pickClue = async () => {
      if (!shiny || !clue) return;
      // walk up to it, then it's yours on E (or a tap)
      this.tweens.add({ targets: me, x: shiny.x - 70, duration: 500 });
      const prompt = this.add.text(shiny.x, shiny.y + 64, `E: Pick up: ${clue.trail.item}`, { fontFamily: FONT, fontSize: "15px", color: "#ffffff", backgroundColor: "#000000cc", padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(1500);
      this.tweens.add({ targets: prompt, y: prompt.y - 5, yoyo: true, repeat: -1, duration: 500 });
      controls.swallow();
      await new Promise<void>((res) => {
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          ev.remove();
          res();
        };
        const ev = this.time.addEvent({ delay: 16, loop: true, callback: () => controls.interact() && go() });
        this.input.once("pointerdown", go);
      });
      prompt.destroy();
      shiny.destroy();
      const r = takeClue(G.s, "POLSON");
      if (!r) return;
      synth.play("pickup");
      G.emit("toast", { title: r.title, text: r.toast });
      G.save();
      await box.play([...r.lines], { onSpeaker: (sp) => this.tweens.add({ targets: sp === "POLSON" ? pol : me, y: 352 - 10, yoyo: true, duration: 110 }) });
    };
    this.time.delayedCall(400, () =>
      box.play(lines, { onSpeaker: (sp) => this.tweens.add({ targets: sp === "POLSON" ? pol : me, y: 352 - 10, yoyo: true, duration: 110 }) }).then(takeToken).then(pickClue).then(() => box.play([dir("You leave Polson Towers. Polson waves from the window, chewing.")])).then(() => {
        this.cameras.main.fadeOut(300);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => switchTo(this, "Hub", { at: "POLSON_ROAD" }));
      }),
    );
  }
}
