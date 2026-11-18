import Phaser from "phaser";
import { G } from "../../G";
import { dir, say } from "../../../content/dsl";
import type { Line } from "../../../data/types";
import type { PlayableId } from "../../../data/types";

/**
 * The poster on the back wall, right of the window: a cheesy 80s underwear advert starring whoever you're playing,
 * in nothing but a pair of enormous white Y-fronts. It's hung over the strongman poster baked into the backdrop.
 * Art (PixelLab, one per lad): public/art/props/home/poster_yfront_<id>.png, keys `poster_yfront_<ID>`.
 */

interface PosterCopy {
  /** The brand across the top. */
  brand: string;
  /** The slogan along the bottom (short: it's tiny on the wall). */
  slogan: string;
  /** What you see when you look at it, and what you say about it. */
  look: string;
  quip: string;
}

export const PANTS_POSTERS: Record<PlayableId, PosterCopy> = {
  FLENKY: {
    brand: "KREL KLEIN",
    slogan: "BANNED. NEVER BEATEN.",
    look: "KREL KLEIN. For the man who has never once been asked to model anything. Removed from the group chat eleven times; readmitted twelve. The pants stayed on throughout.",
    quip: "That's going in my appeal. Exhibit A.",
  },
  KREZMAR: {
    brand: "KREZ KLEIN",
    slogan: "0% APR. 100% PANTS.",
    look: "KREZ KLEIN. 'Support you can borrow against.' The small print says the pants are on finance at 0% for six months, then 94%. The glasses are not part of the offer.",
    quip: "I'm still paying them off, to be fair.",
  },
  KREBLIS: {
    brand: "KREBLIS FOR HIM",
    slogan: "BREAKING: LOCAL MAN IN PANTS",
    look: "KREBLIS FOR HIM. A strange occurrence: a grown man, oiled, in a studio, in his pants, on purpose. Nobody has been able to explain it. The investigation continues.",
    quip: "Threat level: purple. Pants level: white.",
  },
  KREZWONK: {
    brand: "WONK KLEIN",
    slogan: "HE FORESAW THIS.",
    look: "WONK KLEIN. He saw this photoshoot coming three years ago and turned up anyway. The idea of the pants is more important than the pants.",
    quip: "The prophecy said 'briefs'. I thought it meant a meeting.",
  },
  SCROMBUS: {
    brand: "SCROMBUS & CO",
    slogan: "100% HUMAN-MADE (ISH)",
    look: "SCROMBUS & CO. 'Lore-washed at 40 degrees.' The small print says no AI was used in this poster. Further small print says some AI was used in this poster.",
    quip: "Severe lack of appreciation for this, frankly.",
  },
  KREBON: {
    brand: "KREBON KLEIN",
    slogan: "KREBON IS COMING. DRESSED FOR IT.",
    look: "KREBON KLEIN. A man on a crate, looking into the middle distance like he's just remembered a Twitcher Mutiny lyric. It is the most serious pair of pants ever photographed.",
    quip: "Real butter. Real cotton. Real Krebon.",
  },
  CRONGUS: {
    brand: "LULON KLEIN",
    slogan: "LURK IN COMFORT.",
    look: "LULON KLEIN. Lil' Crongus, hands on hips, head polished to a mirror finish. The photographer reportedly asked him to stop lurking behind the lights.",
    quip: "I've got this in a frame at my mum's as well.",
  },
  GRONNY: {
    brand: "GRONNY G",
    slogan: "LOST THE TROUSERS. FOUND HIMSELF.",
    look: "GRONNY G FOR MEN. 'He never found his trousers. He found something better.' Even in a poster, there is a faint smell coming off it.",
    quip: "Spec bar's full in these. Always hits a 99.",
  },
  MIKEY: {
    brand: "MIKEY KLEIN",
    slogan: "HISTORICALLY ACCURATE.",
    look: "MIKEY KLEIN. Top knot, beard, and the largest pair of Y-fronts in recorded history. Sourced from an actual museum. Hand-washed, probably.",
    quip: "Period-accurate, these. Ask anyone.",
  },
};

// the strongman poster in the backdrop: 584..683 x 113..244 on screen. Ours is a touch bigger and covers it.
const CX = 633;
const TOP = 106;
const W = 104;
const H = 154;
const FRAME = 0x684738;
const INNER_BG = 0x141a2e;

/** The poster's texture key for this lad (null if the art isn't there). */
function artKey(scene: Phaser.Scene, id: string): string | null {
  const k = `poster_yfront_${id}`;
  return scene.textures.exists(k) ? k : null;
}

/** Draw the poster as a container, its top-centre at (0, 0) in local space, then placed at (x, y) and scaled. */
function makePoster(scene: Phaser.Scene, id: PlayableId, key: string, x: number, y: number, scale: number, depth: number) {
  const c = scene.add.container(x, y).setDepth(depth).setScale(scale);
  const copy = PANTS_POSTERS[id];
  const res = Math.max(2, Math.ceil(scale * 2));
  c.add(scene.add.rectangle(3, 3, W, H, 0x000000, 0.35).setOrigin(0.5, 0)); // shadow on the wall
  c.add(scene.add.rectangle(0, 0, W, H, 0x0d0706).setOrigin(0.5, 0));
  c.add(scene.add.rectangle(0, 1, W - 2, H - 2, FRAME).setOrigin(0.5, 0));
  c.add(scene.add.rectangle(0, 6, W - 12, H - 12, INNER_BG).setOrigin(0.5, 0));
  const art = scene.add.image(0, 21, key).setOrigin(0.5, 0);
  art.setScale(Math.min((W - 12) / art.width, (H - 12 - 15 - 10) / art.height));
  c.add(art);
  const brand = scene.add
    .text(0, 13, copy.brand, { fontFamily: "Impact, sans-serif", fontSize: "12px", color: "#fdf2f8", stroke: "#be185d", strokeThickness: 2 })
    .setOrigin(0.5)
    .setResolution(res);
  if (brand.width > W - 14) brand.setScale((W - 14) / brand.width);
  c.add(brand);
  const slogan = scene.add
    .text(0, H - 11, copy.slogan, { fontFamily: "Georgia, serif", fontSize: "7px", color: "#fde68a", fontStyle: "italic" })
    .setOrigin(0.5)
    .setResolution(res);
  if (slogan.width > W - 14) slogan.setScale((W - 14) / slogan.width);
  c.add(slogan);
  return c;
}

/**
 * Hang the poster and add its look-at spot. HomeScene calls this once in create(); `addSpot` pushes onto its spot list
 * and `talk` plays lines through its dialogue box.
 */
export function addPantsPoster(
  scene: Phaser.Scene,
  addSpot: (s: { x: number; y: number; r: number; label: string; use: () => void | Promise<void> }) => void,
  talk: (lines: Line[]) => Promise<void>,
) {
  const id = G.s.player as PlayableId;
  const key = artKey(scene, id);
  if (!key || !PANTS_POSTERS[id]) return;
  makePoster(scene, id, key, CX, TOP, 1, 4);
  addSpot({
    x: CX,
    y: 458,
    r: 36,
    label: "E: Look at the poster",
    use: async () => {
      // a close-up while you read it
      const dim = scene.add.rectangle(480, 270, 960, 540, 0x000000, 0.6).setDepth(1900).setAlpha(0);
      const big = makePoster(scene, id, key, 480, 250, 2.3, 1901).setAlpha(0);
      big.y = 270 - (H * 2.3) / 2 + 40;
      scene.tweens.add({ targets: [dim, big], alpha: 1, duration: 250 });
      const copy = PANTS_POSTERS[id];
      try {
        await talk([dir(copy.look), say(id, copy.quip)]);
      } finally {
        scene.tweens.add({ targets: [dim, big], alpha: 0, duration: 200, onComplete: () => (dim.destroy(), big.destroy()) });
      }
    },
  });
}
