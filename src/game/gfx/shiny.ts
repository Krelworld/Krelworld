import Phaser from "phaser";
import { FONT } from "../ui/theme";

export interface ShinyOpts {
  /** The prop's scale. */
  scale: number;
  /** Depth of the prop (the glow sits just under it). Defaults to y. */
  depth?: number;
  /** Halo / inner glow / rays / twinkle colours. */
  halo?: number;
  glow?: number;
  rays?: number;
  twinkle?: number;
  /** Size of the glow (1 = the cuddle token's). */
  size?: number;
  /** A bobbing tag over it ("✦ RECEIPT"), so it reads at a glance even in a busy room. */
  tag?: string;
}

/**
 * A pickup that's impossible to miss: a pulsing halo, slow-turning rays, twinkles drifting up, a glint every couple
 * of seconds, and the prop bobbing in the middle. (First made for the Cronster's cuddle token in the Wonky Pole;
 * the explore-before-the-dungeon trails use it everywhere.) destroy() takes the lot away.
 */
export function shinyPickup(scene: Phaser.Scene, x: number, y: number, tex: string, o: ShinyOpts) {
  const ADD = Phaser.BlendModes.ADD;
  const d = o.depth ?? y;
  const k = o.size ?? 1;
  const halo = scene.add.circle(x, y, 60 * k, o.halo ?? 0xff6bb0, 0.22).setDepth(d - 2).setBlendMode(ADD);
  const glow = scene.add.circle(x, y, 34 * k, o.glow ?? 0xffb3d6, 0.45).setDepth(d - 1).setBlendMode(ADD);
  scene.tweens.add({ targets: halo, scale: 1.35, alpha: 0.1, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
  scene.tweens.add({ targets: glow, scale: 1.25, alpha: 0.25, yoyo: true, repeat: -1, duration: 600, ease: "Sine.inOut" });
  const rays = scene.add.graphics({ x, y }).setDepth(d - 1).setBlendMode(ADD);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const len = (i % 2 ? 54 : 78) * k;
    rays.fillStyle(o.rays ?? 0xffd1e8, i % 2 ? 0.22 : 0.32);
    rays.fillTriangle(Math.cos(a - 0.09) * 14 * k, Math.sin(a - 0.09) * 14 * k, Math.cos(a + 0.09) * 14 * k, Math.sin(a + 0.09) * 14 * k, Math.cos(a) * len, Math.sin(a) * len);
  }
  scene.tweens.add({ targets: rays, angle: 360, repeat: -1, duration: 9000 });
  const img = scene.add.image(x, y, tex).setScale(o.scale).setDepth(d);
  const tag = o.tag
    ? scene.add.text(x, y - 46 * k - img.displayHeight / 2, o.tag, { fontFamily: FONT, fontSize: "13px", color: "#ffffff", fontStyle: "bold", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(d + 2)
    : null;
  scene.tweens.add({ targets: [img, glow, halo, rays, ...(tag ? [tag] : [])], y: `-=8`, yoyo: true, repeat: -1, duration: 700, ease: "Sine.inOut" });
  // the glint: a white flash across the prop and a star burst off its edge
  const glint = scene.time.addEvent({
    delay: 1800,
    loop: true,
    callback: () => {
      if (!img.active) return;
      img.setTintFill(0xffffff);
      scene.time.delayedCall(70, () => img.active && img.clearTint());
      const st = scene.add.star(img.x + 16 * k, img.y - 16 * k, 4, 3, 14, 0xffffff).setDepth(d + 1).setBlendMode(ADD).setScale(0.2);
      scene.tweens.add({ targets: st, scale: 1.3, angle: 90, alpha: 0, duration: 520, ease: "Quad.out", onComplete: () => st.destroy() });
    },
  });
  // twinkles drifting up round it
  const twinkle = scene.time.addEvent({
    delay: 220,
    loop: true,
    callback: () => {
      if (!img.active) return;
      const a = Math.random() * Math.PI * 2;
      const r = (26 + Math.random() * 30) * k;
      const p = scene.add.star(img.x + Math.cos(a) * r, img.y + Math.sin(a) * r * 0.7, 4, 1, 5, Math.random() < 0.5 ? 0xffffff : (o.twinkle ?? 0xffc2e2)).setDepth(d + 1).setBlendMode(ADD).setScale(0.3);
      scene.tweens.add({ targets: p, scale: 1, y: p.y - 22, alpha: 0, duration: 800, ease: "Sine.out", onComplete: () => p.destroy() });
    },
  });
  return {
    img,
    x,
    y,
    destroy: () => {
      for (const b of [halo, glow, rays, img, tag]) b?.destroy();
      glint.remove();
      twinkle.remove();
    },
  };
}

export type Shiny = ReturnType<typeof shinyPickup>;

/** Warm glow colours from one tint (halo, glow, rays, twinkles). */
export function shinyColours(tint: number) {
  const c = Phaser.Display.Color.IntegerToColor(tint);
  const lighten = (f: number) => Phaser.Display.Color.GetColor(Math.round(c.red + (255 - c.red) * f), Math.round(c.green + (255 - c.green) * f), Math.round(c.blue + (255 - c.blue) * f));
  return { halo: tint, glow: lighten(0.45), rays: lighten(0.7), twinkle: lighten(0.6) };
}

/** The scale that draws texture `tex` about `px` pixels across (its longer side). */
export function trailPropScale(scene: Phaser.Scene, tex: string, px: number) {
  const f = scene.textures.getFrame(tex);
  return f ? px / Math.max(f.width, f.height, 1) : 1;
}
