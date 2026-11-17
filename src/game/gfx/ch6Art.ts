import Phaser from "phaser";

/**
 * Chapter 6 cutscene art (PixelLab). Listed in public/art/manifest.json too; this map lets a scene
 * fetch any that are missing (e.g. an older manifest) before it needs them. Everything is optional:
 * scenes check textures.exists and draw a fallback.
 */
export const CH6_ART: Record<string, string> = {
  bg_kd_station: "backdrops/bg_kd_station.png",
  bg_kd_palace: "backdrops/bg_kd_palace.png",
  bg_kd_ruins: "backdrops/bg_kd_ruins.png",
  // the palace flattened (after the nuke)
  bg_kd_ruins_flat: "backdrops/bg_kd_ruins_flat.png",
  // the end of Chapter 6: Kreddle seen from Krelford across the river, the silos firing, the Krunch Protocol's screen
  bg_c6e_bridge_view: "backdrops/bg_c6e_bridge_view.png",
  bg_c6e_launch: "backdrops/bg_c6e_launch.png",
  bg_c6e_krunch_screen: "backdrops/bg_c6e_krunch_screen.png",
  c6_launcher: "props/c6_launcher.png",
  c6_launcher4: "props/c6_launcher4.png",
  c6_missile: "props/c6_missile.png",
  c6_nuke: "props/c6_nuke.png",
  c6_krelneva: "props/c6_krelneva.png",
  c6_mustard: "props/c6_mustard.png",
  c6_napalm: "props/c6_napalm.png",
  c6_nailbomb: "props/c6_nailbomb.png",
  c6_chemflamer: "props/c6_chemflamer.png",
  c6_kd_terminal: "props/c6_kd_terminal.png",
  c6_ashpile: "props/c6_ashpile.png",
  c6_ceiling: "props/c6_ceiling.png",
  c6_discoball: "props/c6_discoball.png",
  c6_klerble_statue: "props/c6_klerble_statue.png",
  c6_skeleton: "props/c6_skeleton.png",
  c6_burnheap: "props/c6_burnheap.png",
  c6_klerble_crawl: "props/c6_klerble_crawl.png",
};

/** Load whichever Chapter 6 images aren't in the texture cache yet. Resolves when done (or at once). */
export function ensureCh6Art(scene: Phaser.Scene): Promise<void> {
  const missing = Object.entries(CH6_ART).filter(([k]) => !scene.textures.exists(k));
  if (!missing.length) return Promise.resolve();
  return new Promise((res) => {
    for (const [k, f] of missing) scene.load.image(k, `art/${f}`);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => res());
    // a broken file shouldn't hang the cutscene
    scene.time.delayedCall(8000, () => res());
    scene.load.start();
  });
}
