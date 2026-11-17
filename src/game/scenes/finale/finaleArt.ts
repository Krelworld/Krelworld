import Phaser from "phaser";

/**
 * Art for the Krelford finale (THE CONCEPT OF PAEDOPHILIA), until it's merged into public/art/manifest.json
 * (see the scratchpad's finaleB_manifest.json). Everything is loaded only if it isn't there already, and every
 * user of it has a drawn fallback, so the finale still plays without the files.
 */
export const FINALE_IMAGES: Record<string, string> = {
  fb_dragon_side: "finale/fb_dragon_side.png",
  fb_wizard: "finale/fb_wizard.png",
  fb_wreck: "finale/fb_wreck.png",
  fb_logs: "finale/fb_logs.png",
  fb_goku_charge: "finale/fb_goku_charge.png",
  // the morning after: skinny Drongus in his pants (from the roof's skinny Drongus)
  fb_drongus_undies: "finale/fb_drongus_undies.png",
  // from the roof (part A): the same logs, bottle and syringe, so they match where they landed
  fr_logs: "props/fr_logs.png",
  fr_bottle: "props/fr_bottle.png",
  fr_syringe: "props/fr_syringe.png",
  fr_drongus_skinny: "combat/fr_drongus_skinny.png",
  c7_bottle_0: "props/c7_bottle_0.png",
};

/** The chat logs, the golden bottle and the syringe: the roof's art if it's there, else ours. */
export const logsKey = (s: Phaser.Scene) => (s.textures.exists("fr_logs") ? "fr_logs" : "fb_logs");
export const bottleKey = (s: Phaser.Scene) => (s.textures.exists("fr_bottle") ? "fr_bottle" : s.textures.exists("c7_bottle_0") ? "c7_bottle_0" : "fb_logs");
export const syringeKey = (s: Phaser.Scene) => (s.textures.exists("fr_syringe") ? "fr_syringe" : null);
export const FINALE_SHEETS: Record<string, { file: string; frameWidth: number; frameHeight: number }> = {
  fb_dragon_top: { file: "finale/fb_dragon_top.png", frameWidth: 256, frameHeight: 256 },
  /** its roar: jaw half open, then gaping (glowing throat) */
  fb_dragon_roar: { file: "finale/fb_dragon_roar.png", frameWidth: 256, frameHeight: 256 },
  fb_aura: { file: "finale/fb_aura.png", frameWidth: 96, frameHeight: 112 },
  fb_lightning: { file: "finale/fb_lightning.png", frameWidth: 96, frameHeight: 128 },
  fb_horror: { file: "finale/fb_horror.png", frameWidth: 48, frameHeight: 48 },
  /** the real phase: the same sheets, cracked open with gold light (it's finally hurting) */
  fe_dragon_top_hurt: { file: "finale/fe_dragon_top_hurt.png", frameWidth: 256, frameHeight: 256 },
  fe_dragon_roar_hurt: { file: "finale/fe_dragon_roar_hurt.png", frameWidth: 256, frameHeight: 256 },
  /** its attack wind-ups (it rears and breathes in; its arms come up and slam down), and a flinch when it's hurt */
  fe_concept_rear: { file: "combat/fe_concept_rear.png", frameWidth: 256, frameHeight: 256 },
  fe_concept_slam: { file: "combat/fe_concept_slam.png", frameWidth: 256, frameHeight: 256 },
  fe_concept_rear_hurt: { file: "combat/fe_concept_rear_hurt.png", frameWidth: 256, frameHeight: 256 },
  fe_concept_slam_hurt: { file: "combat/fe_concept_slam_hurt.png", frameWidth: 256, frameHeight: 256 },
  fe_concept_flinch_hurt: { file: "combat/fe_concept_flinch_hurt.png", frameWidth: 256, frameHeight: 256 },
  /** its lightning wind-up, wounded (claws to the sky, the storm crackling between them): the low-HP storm */
  fe_concept_storm_hurt: { file: "combat/fe_concept_storm_hurt.png", frameWidth: 256, frameHeight: 256 },
};

/** Queue whatever finale art isn't loaded yet (call from a scene's preload). */
export function finalePreload(scene: Phaser.Scene) {
  for (const [k, f] of Object.entries(FINALE_IMAGES)) if (!scene.textures.exists(k)) scene.load.image(k, `art/${f}`);
  for (const [k, d] of Object.entries(FINALE_SHEETS)) if (!scene.textures.exists(k)) scene.load.spritesheet(k, `art/${d.file}`, { frameWidth: d.frameWidth, frameHeight: d.frameHeight });
  // a missing file is fine: the finale draws its own stand-ins
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => undefined);
}

/** Animations, stand-ins for anything missing, and the monster's dialogue portrait. */
export function finaleReady(scene: Phaser.Scene) {
  const tex = scene.textures;
  const anims = scene.anims;
  if (tex.exists("fb_aura") && !anims.exists("fb_aura")) anims.create({ key: "fb_aura", frames: anims.generateFrameNumbers("fb_aura", { start: 0, end: 7 }), frameRate: 12, repeat: -1 });
  if (tex.exists("fb_lightning") && !anims.exists("fb_lightning")) anims.create({ key: "fb_lightning", frames: anims.generateFrameNumbers("fb_lightning", { start: 0, end: 7 }), frameRate: 16, repeat: 0 });
  if (tex.exists("fb_dragon_top") && !anims.exists("fb_dragon_top")) anims.create({ key: "fb_dragon_top", frames: anims.generateFrameNumbers("fb_dragon_top", { start: 0, end: tex.get("fb_dragon_top").frameTotal - 2 }), frameRate: 6, repeat: -1, yoyo: true });
  if (tex.exists("fe_dragon_top_hurt") && !anims.exists("fe_dragon_top_hurt")) anims.create({ key: "fe_dragon_top_hurt", frames: anims.generateFrameNumbers("fe_dragon_top_hurt", { start: 0, end: tex.get("fe_dragon_top_hurt").frameTotal - 2 }), frameRate: 6, repeat: -1, yoyo: true });
  if (tex.exists("fb_horror") && !anims.exists("fb_horror")) anims.create({ key: "fb_horror", frames: anims.generateFrameNumbers("fb_horror", { start: 0, end: tex.get("fb_horror").frameTotal - 2 }), frameRate: 8, repeat: -1 });
  const g = scene.make.graphics({}, false);
  if (!tex.exists("fb_logs")) {
    g.clear().fillStyle(0x0b0b0b).fillRoundedRect(8, 12, 32, 24, 4).fillStyle(0x22c55e).fillRect(12, 16, 24, 4).fillRect(12, 24, 16, 3);
    g.generateTexture("fb_logs", 48, 48);
  }
  if (!tex.exists("fb_wreck")) {
    g.clear();
    for (let i = 0; i < 60; i++) g.fillStyle(i % 3 ? 0x1f1a24 : 0x3a2f3f).fillRect(20 + Math.random() * 200, 40 + Math.random() * 130, 14 + Math.random() * 30, 10 + Math.random() * 20);
    g.generateTexture("fb_wreck", 256, 192);
  }
  if (!tex.exists("fb_horror") && !tex.exists("fb_horror_g")) {
    // two frames (enemies cycle their sheet's frames)
    g.clear();
    for (const ox of [0, 48]) g.fillStyle(0x2a1640).fillCircle(ox + 24, 26 + ox / 48, 15).fillStyle(0xa855f7).fillCircle(ox + 19, 22, 3).fillCircle(ox + 29, 22, 3).fillStyle(0x84cc16).fillRect(ox + 14, 32, 20, 2);
    g.generateTexture("fb_horror_g", 96, 48);
    const t = tex.get("fb_horror_g");
    t.add(0, 0, 0, 0, 48, 48);
    t.add(1, 0, 48, 0, 48, 48);
  }
  g.destroy();
  // THE CONCEPT OF PAEDOPHILIA's portrait in the dialogue box: its head, from the side-on art
  const pk = "ptx_spr_TV_THE_CONCEPT_OF_PAEDOPHILIA";
  if (!tex.exists(pk) && tex.exists("fb_dragon_side")) {
    const src = tex.get("fb_dragon_side").getSourceImage() as HTMLImageElement;
    const c = tex.createCanvas(pk, 112, 112);
    if (c) {
      const ctx = c.getContext();
      ctx.fillStyle = "#14051f";
      ctx.fillRect(0, 0, 112, 112);
      ctx.imageSmoothingEnabled = false;
      // the head sits in the top left of the 384x288 picture
      ctx.drawImage(src, 50, 2, 112, 112, 0, 0, 112, 112);
      c.refresh();
      // the dialogue box finds a portrait by this name (and then uses the ptx_ one above)
      if (!tex.exists("spr_TV_THE_CONCEPT_OF_PAEDOPHILIA")) tex.createCanvas("spr_TV_THE_CONCEPT_OF_PAEDOPHILIA", 4, 4);
    }
  }
}

/** The key for a horror (the drawn one if the sheet's missing). */
export function horrorKey(scene: Phaser.Scene) {
  return scene.textures.exists("fb_horror") ? "fb_horror" : "fb_horror_g";
}

// ---------------------------------------------------------------- SUPER SAIYAN (the lads after the golden juice)

/**
 * Each playable lad's super saiyan sheet (`ssj_<ID>`, 96px frames: 0 power stance, 1 powering up and screaming,
 * 2 facing east, 3 facing west) and his close-up (`ssj_por_<ID>`, 128px), from public/art/manifest.json.
 */
export const ssjKey = (s: Phaser.Scene, id: string) => (s.textures.exists(`ssj_${id}`) ? `ssj_${id}` : null);
/** The player's own super saiyan close-up cut-in and eye shot (fe_cut_ssj_<ID>, fe_eyes_ssj_<ID>), with fallbacks. */
export const youCutKey = (s: Phaser.Scene, id: string) => (s.textures.exists(`fe_cut_ssj_${id}`) ? `fe_cut_ssj_${id}` : s.textures.exists(`ssj_por_${id}`) ? `ssj_por_${id}` : null);
export const youEyesKey = (s: Phaser.Scene, id: string) => (s.textures.exists(`fe_eyes_ssj_${id}`) ? `fe_eyes_ssj_${id}` : "fe_eyes_ssj");
export const ssjPortraitKey = (s: Phaser.Scene, id: string) => (s.textures.exists(`ssj_por_${id}`) ? `ssj_por_${id}` : null);

/** How much taller than his normal self a lad stands once he's changed (his figure, feet to crown). */
export const SSJ_GROW = 1.5;
/** Feet-to-crown of a normal 64px sheet's idle figure, and of a 96px super saiyan one. */
const BASE_PX = 62;
const SSJ_PX = 95;

/**
 * Give each super saiyan sheet the art factor (`customData.hd`) that makes `setScale(n)` draw him SSJ_GROW times
 * as tall as `setScale(n)` draws his normal sheet (his own height, data/heights.ts, included). So anything that
 * resets his scale the usual way (setScale(2)) still gets the big version.
 */
function ssjPrep(scene: Phaser.Scene) {
  const tex = scene.textures;
  for (const key of tex.getTextureKeys()) {
    if (!key.startsWith("ssj_") || key.startsWith("ssj_por_")) continue;
    const t = tex.get(key);
    const cd = (t.customData ?? {}) as { hd?: number; ssj?: boolean };
    if (cd.ssj) continue;
    const baseKey = `spr_${key.slice(4)}`;
    const base = tex.exists(baseKey) ? (tex.get(baseKey).customData as { hd?: number }) : null;
    t.customData = { ...cd, hd: (base?.hd ?? 0.5) * ((BASE_PX * SSJ_GROW) / SSJ_PX), ssj: true };
  }
}

/**
 * Swap a lad's sprite for his super saiyan sheet: SSJ_GROW times taller, standing on the same spot (his feet stay
 * where they were, so his shadow, hitbox and depth sort don't move). False if there's no art for him.
 */
export function ssjSwap(spr: Phaser.GameObjects.Sprite, id: string, frame = 0): boolean {
  const key = ssjKey(spr.scene, id);
  if (!key) return false;
  ssjPrep(spr.scene);
  if (spr.texture.key === key) return true;
  // how far below his position the bottom of his frame is (world px), and the scale he was set to (before the art factor)
  const feet = (spr.height - spr.displayOriginY) * Math.abs(spr.scaleY);
  const hd = (spr.texture.customData as { hd?: number } | undefined)?.hd ?? 1;
  const setX = spr.scaleX / hd;
  const setY = spr.scaleY / hd;
  spr.setTexture(key, frame);
  spr.setScale(setX, setY);
  spr.setOrigin(0.5, Phaser.Math.Clamp(1 - feet / (spr.height * Math.abs(spr.scaleY)), 0, 1));
  return true;
}

/** Top of a sprite's figure above its position (world px): where to put a name tag. */
export function headroom(spr: Phaser.GameObjects.Sprite) {
  return spr.displayOriginY * Math.abs(spr.scaleY);
}
