// PHONE MODE: the one entry point. main.ts calls installMobile(game) right after creating the game. On anything that
// is not a phone it returns at once and does nothing at all: no class, no style, no element, no listener, no global.
// See README.md in this folder.
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { isMobile } from "./flag";
import { readView } from "./observe";
import { Shell } from "./shell";
import { TouchLayer } from "./touchLayer";
import type { Insets } from "./layout";

export { isMobile, setMobileForTests } from "./flag";
export { registerModeController, type ModeController, type ModeContext, TouchLayer } from "./touchLayer";
export { addSceneRule, resolveMode, type LayerMode, type ModeDecision, type SceneRule } from "./modes";
export { phoneSettings, updatePhoneSettings, onPhoneSettingsChange, usePhoneSettingsStore, type PhoneSettings } from "./settings";

let installed: { shell: Shell; layer: TouchLayer } | null = null;

/** The phone layer, when phone mode is on (null on a laptop). */
export function mobileLayer(): TouchLayer | null {
  return installed?.layer ?? null;
}

/** The phone shell (rotate screen, lifecycle, fullscreen), when phone mode is on. */
export function mobileShell(): Shell | null {
  return installed?.shell ?? null;
}

export function installMobile(game: Phaser.Game) {
  if (!isMobile() || installed || typeof document === "undefined") return;
  const parent = document.getElementById("game") ?? document.body;
  // the game's touch paths (touch wording, auto-aim by touch, the raid's FIRE button) are on from the start
  TOUCH.enabled = true;
  const shell = new Shell(game, parent, null);
  const layer = new TouchLayer(game, parent);
  shell.setLayer(layer);
  layer.onFullscreen = () => shell.goFullscreen();
  installed = { shell, layer };
  game.events.once(Phaser.Core.Events.READY, () => {
    // spare touch pointers: a tap handed over from the stick zone while another finger is on the canvas
    try {
      game.input.addPointer(2);
    } catch {
      /* fine with one */
    }
  });
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    shell.frame();
    layer.frame();
  });
  // for the phone smoke test and for poking at it on a real phone (phones only)
  (window as unknown as { __krelMobile?: unknown }).__krelMobile = {
    layer,
    shell,
    snapshot: () => layer.snapshot(),
    view: () => readView(game),
    setInsets: (i: Insets | null) => layer.setInsetsOverride(i),
  };
}
