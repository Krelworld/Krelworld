import Phaser from "phaser";
import { G } from "../G";
import { synth } from "../audio/Synth";
import { FONT } from "../ui/theme";
import { kreltality, type KrelTarget } from "../combat/Kreltality";
import { runOverlay } from "../gfx/Overlay";
import { playerKey } from "../gfx/sanmikForm";
import { bump } from "../systems/stats";
import { CHARACTERS } from "../../data/characters";

/**
 * A Kreltality offered in the middle of a script, with no fight (a Line's `krel` cue, see DialogueBox): the room
 * stays where it is underneath, the victim is brought in, and you get the usual "FUCKING KILL THEM!!" choice.
 * Runs as an overlay over the paused host (gfx/Overlay.ts), so the host's camera, keys and box are left alone.
 * Tab / Esc / Space fast-forward the finisher once it's started.
 */

export interface KrelCueVictim {
  /** the victim's sprite (a boss sheet), and the fallback if it isn't loaded */
  tex: string;
  fallback: string;
  /** the boss id (krelvic_ reactions, per-boss finisher art) */
  id?: string;
  name: string;
  /** the scale an image of `tex` gets (before its HD factor), as in the dungeon */
  scale: number;
  /** the caption while they're brought in; "{A}" and "{B}" are the two lads doing it */
  bringIn: string;
  /** the caption when you let them go */
  escape: string;
}

export const KREL_CUES: Record<string, KrelCueVictim> = {
  robbo: {
    tex: "boss_flatmate",
    fallback: "spr_FOLK0",
    id: "flatmate",
    name: "ROBBO",
    scale: 2.4,
    bringIn: "{A} and {B} drag Robbo back in by the ankles. He is still holding the wine.",
    escape: "Robbo wriggles free and is out of the door. He still has the wine.",
  },
};

/** Play the cue over `sc`. True if the Kreltality was done. */
export async function krelCue(sc: Phaser.Scene, target: string): Promise<boolean> {
  const v = KREL_CUES[target];
  if (!v) return false;
  const out = { did: false };
  await runOverlay(sc, "KrelCue", KrelCueScene, { victim: v, out });
  return out.did;
}

interface CueData {
  victim: KrelCueVictim;
  out: { did: boolean };
  done: () => void;
}

const W = 960;
const H = 540;
const FLOOR = 300;

export class KrelCueScene extends Phaser.Scene {
  private d!: CueData;
  private ff = false;

  constructor() {
    super("KrelCue");
  }

  init(d: CueData) {
    this.d = d;
    this.ff = false;
  }

  create() {
    this.cameras.main.setScroll(0, 0).setZoom(1);
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    void this.run();
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, () => r()));
  }

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  private async run() {
    const v = this.d.victim;
    const me = G.s.player;
    // the two who fetch him: anyone but you
    const lads = Object.values(CHARACTERS)
      .filter((c) => c.playable && c.id !== me)
      .map((c) => c.id as string);
    const pref = ["SCROMBUS", "CRONGUS", "KREZMAR", "GRONNY", "KREBON"].filter((x) => lads.includes(x));
    const [a, b] = [...pref, ...lads];
    const ladKey = (id: string) => (this.textures.exists(`spr_${id}`) ? `spr_${id}` : "spr_FOLK1");

    // the room dims; a caption
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x120404, 0).setDepth(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 300 });
    const name = (id: string) => CHARACTERS[id as keyof typeof CHARACTERS]?.name ?? id;
    const cap = this.add
      .text(W / 2, 70, v.bringIn.replace("{A}", name(a)).replace("{B}", name(b)), { fontFamily: FONT, fontSize: "16px", color: "#f5e6c8", backgroundColor: "#000000aa", padding: { x: 8, y: 5 }, wordWrap: { width: 720 }, align: "center" })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);
    this.tweens.add({ targets: cap, alpha: 1, duration: 250 });

    // he comes back in on his belly, a lad on each ankle
    const tex = this.textures.exists(v.tex) ? v.tex : v.fallback;
    const vic = this.add.image(W + 140, FLOOR, tex, 0).setScale(v.scale).setAngle(84).setDepth(5);
    const la = this.add.sprite(W + 60, FLOOR - 26, ladKey(a), 0).setScale(2).setFlipX(true).setDepth(6);
    const lb = this.add.sprite(W + 70, FLOOR + 22, ladKey(b), 0).setScale(2).setFlipX(true).setDepth(6);
    synth.play("door");
    const tx = 560;
    this.tweens.add({ targets: [la, lb], x: `-=${W + 60 - (tx - 70)}`, duration: 1400, ease: "Sine.out" });
    this.tweens.add({ targets: [la, lb], y: "-=3", yoyo: true, repeat: 6, duration: 100 });
    await this.tw({ targets: vic, x: tx, duration: 1400, ease: "Sine.out" });
    // they drop him and step back out of it
    this.tweens.add({ targets: la, x: tx + 150, y: FLOOR - 70, duration: 400 });
    this.tweens.add({ targets: lb, x: tx + 190, y: FLOOR + 40, duration: 400 });
    la.setFlipX(false);
    lb.setFlipX(false);
    // he gets up, dazed
    synth.play("hit");
    await this.tw({ targets: vic, angle: 0, duration: 260, ease: "Back.out" });
    this.tweens.add({ targets: vic, angle: { from: -5, to: 5 }, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
    await this.wait(500);
    this.tweens.add({ targets: cap, alpha: 0, duration: 200 });

    // the offer (Kreltality.ts's own prompt and finisher)
    const hd = (this.textures.get(tex).customData as { hd?: number } | undefined)?.hd ?? 1;
    const tg: KrelTarget = { key: tex, frame: 0, x: vic.x, y: vic.y, scale: vic.scaleX / hd, flip: false, name: v.name, id: v.id };
    const pk = playerKey(this);
    // the finisher draws its own victim: the moment it does (an image of his sheet), the stand-ins go and Tab can skip
    let armed = false;
    const onAdd = (o: Phaser.GameObjects.GameObject) => {
      if (armed || o === vic || !(o instanceof Phaser.GameObjects.Image) || o.texture.key !== tex) return;
      armed = true;
      vic.setVisible(false);
      la.setVisible(false);
      lb.setVisible(false);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    const offSkip = this.fastForward(() => armed);
    const did = await kreltality(this, tg, { key: pk, frame: 0, scale: 2 });
    this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdd);
    offSkip();
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    if (did) {
      bump(G.s, "kreltalities");
      this.d.out.did = true;
      this.cameras.main.setScroll(0, 0).setZoom(1);
    } else {
      // let off: he scrambles out, wine first
      this.tweens.killTweensOf(vic);
      vic.setAngle(0).setFlipX(true);
      cap.setText(v.escape).setAlpha(1);
      this.tweens.add({ targets: [la, lb], angle: 90, duration: 200 });
      synth.play("swing");
      await this.tw({ targets: vic, x: W + 160, duration: 700, ease: "Quad.in" });
      synth.play("door");
      await this.wait(900);
    }
    await this.tw({ targets: [dim, cap, la, lb], alpha: 0, duration: 250 });
    this.d.done();
  }

  /** Tab / Esc / Space during the finisher: run it at eight times speed. Returns an off(). */
  private fastForward(armed: () => boolean): () => void {
    const kb = this.input.keyboard;
    const go = (e: KeyboardEvent) => {
      // (not while the prompt is up: Esc there means "spare them")
      if (!armed() || !["Tab", "Escape", " "].includes(e.key)) return;
      e.preventDefault?.();
      this.ff = true;
    };
    kb?.on("keydown", go);
    return () => {
      kb?.off("keydown", go);
      this.ff = false;
    };
  }

  /** (the finisher sets its own clock for its slow motion, so the fast-forward is held every frame) */
  update() {
    if (!this.ff) return;
    this.time.timeScale = 8;
    this.tweens.timeScale = 8;
  }
}
