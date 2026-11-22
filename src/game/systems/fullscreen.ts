import type Phaser from "phaser";

/**
 * Fullscreen, from anywhere: Alt+Enter (the usual PC-game shortcut) or F11 (caught where the browser lets us, so it
 * fullscreens the game itself rather than the browser window). F does it on the title screen; the pause menu and the
 * title have a button. (F can't be global: it's the special attack, the headbutt, a squeeze key and more.)
 */
export function canFullscreen(game: Phaser.Game): boolean {
  return game.device.fullscreen.available;
}

export function toggleFullscreen(game: Phaser.Game): boolean {
  if (!canFullscreen(game)) return false;
  try {
    if (game.scale.isFullscreen) game.scale.stopFullscreen();
    else game.scale.startFullscreen();
    return true;
  } catch {
    return false;
  }
}

/** "⛶ FULLSCREEN" / "⛶ EXIT FULLSCREEN", with the shortcut. */
export function fullscreenLabel(game: Phaser.Game, extra = ""): string {
  return game.scale.isFullscreen ? `⛶ EXIT FULLSCREEN${extra}` : `⛶ FULLSCREEN${extra}`;
}

export function installFullscreenKeys(game: Phaser.Game) {
  window.addEventListener(
    "keydown",
    (e) => {
      const altEnter = e.altKey && (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter");
      if (!altEnter && e.key !== "F11") return;
      if (!canFullscreen(game)) return;
      e.preventDefault();
      e.stopPropagation();
      toggleFullscreen(game);
    },
    true,
  );
}
