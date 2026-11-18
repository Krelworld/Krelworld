import Phaser from "phaser";
import { G } from "../G";

/**
 * Mouse lock: keeps the cursor inside the game window (desktop browsers, setting "Lock mouse to game", default on).
 *
 * Browsers can't trap the real cursor, only hide it (the Pointer Lock API). So once you click into the game, the real
 * cursor is locked and hidden, and we keep our own virtual one inside the canvas: every mouse event that Phaser
 * handles gets the virtual position instead of the frozen page position, so aiming, clicks and buttons all work as
 * before. A drawn cursor shows where it is. Esc (or alt-tab) lets the mouse go, as browsers insist; click to grab again.
 * The click that grabs the mouse isn't passed on to the game (so it never fires a shot or presses a button).
 *
 * The cursor itself: a normal arrow in menus, talk and town; a big high-contrast CROSSHAIR wherever you aim (dungeons,
 * run'n'gun, boss fights, the drive). Locked or not (unlocked, it's a CSS cursor on the canvas). It kicks when you fire.
 */

/** Scenes where the mouse aims a gun (unless something's open over them). */
const AIM_SCENES = ["Dungeon", "Drive"];
const OVER_SCENES = ["DungeonIntro", "WeaponPick", "Menu", "Dialogue", "TV", "Meeting", "Cutscene", "Vignette", "Minigame"];

const ARROW =
  '<svg width="16" height="24" viewBox="0 0 16 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 1 L1 19 L5.5 14.5 L8.5 21.5 L11 20.5 L8 13.5 L14 13.5 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
/** 32x32, hotspot in the middle: a gold ring, four ticks, a white dot, all outlined in black so it shows on anything. */
const CROSS = (() => {
  const tick = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="4.5" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ff3fa4" stroke-width="2" stroke-linecap="round"/>`;
  return (
    '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="16" cy="16" r="9.5" fill="none" stroke="#000" stroke-width="4.5"/>' +
    '<circle cx="16" cy="16" r="9.5" fill="none" stroke="#ffd23f" stroke-width="2"/>' +
    tick(16, 2, 16, 9) + tick(16, 23, 16, 30) + tick(2, 16, 9, 16) + tick(23, 16, 30, 16) +
    '<circle cx="16" cy="16" r="2.4" fill="#fff" stroke="#000" stroke-width="1.5"/></svg>'
  );
})();
const CSS_CROSS = `url("data:image/svg+xml;utf8,${encodeURIComponent(CROSS)}") 16 16, crosshair`;

const enabled = () => G.meta?.settings?.mouseLock !== false;

export function installMouseLock(game: Phaser.Game) {
  const touchy = typeof window !== "undefined" && (("ontouchstart" in window && navigator.maxTouchPoints > 0) || matchMedia?.("(pointer: coarse)").matches);
  if (touchy || !document.body.requestPointerLock) return;
  const im = game.input;
  const v = { x: 480, y: 270, live: false };
  // the drawn cursor: a classic arrow, its tip exactly on the hotspot
  const cur = document.createElement("div");
  cur.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:99999;display:none;line-height:0;transition:transform 70ms ease-out;";
  cur.innerHTML = ARROW;
  document.body.appendChild(cur);
  let aimMode = false;
  /** where the hotspot sits inside the drawn cursor */
  const hot = () => (aimMode ? 16 : 1);
  const locked = () => !!im.mouse?.locked;
  const draw = () => {
    if (!locked()) {
      cur.style.display = "none";
      return;
    }
    const sm = game.scale;
    const b = sm.canvasBounds;
    const px = b.left + v.x / sm.displayScale.x;
    const py = b.top + v.y / sm.displayScale.y;
    cur.style.display = "block";
    cur.style.left = `${px - window.scrollX - hot()}px`;
    cur.style.top = `${py - window.scrollY - hot()}px`;
  };

  // every pointer transform: while locked, the mouse pointer goes where the virtual cursor is
  const orig = im.transformPointer.bind(im);
  im.transformPointer = (pointer: Phaser.Input.Pointer, pageX: number, pageY: number, wasMove: boolean) => {
    if (!locked() || pointer !== im.mousePointer) return orig(pointer, pageX, pageY, wasMove);
    if (!v.live) {
      v.live = true;
      v.x = pointer.position.x;
      v.y = pointer.position.y;
    }
    const ev = pointer.event as MouseEvent | undefined;
    if (wasMove && ev) {
      v.x = Phaser.Math.Clamp(v.x + (ev.movementX || 0) * game.scale.displayScale.x, 0, game.scale.width - 1);
      v.y = Phaser.Math.Clamp(v.y + (ev.movementY || 0) * game.scale.displayScale.y, 0, game.scale.height - 1);
    }
    pointer.prevPosition.x = pointer.position.x;
    pointer.prevPosition.y = pointer.position.y;
    pointer.position.x = v.x;
    pointer.position.y = v.y;
    draw();
  };

  // click into the game: grab the mouse (and swallow that click)
  const canvas = game.canvas;
  const grab = (e: MouseEvent) => {
    if (!enabled() || locked() || e.target !== canvas) return;
    // start the virtual cursor where you clicked
    const sm = game.scale;
    v.x = Phaser.Math.Clamp(sm.transformX(e.pageX), 0, sm.width - 1);
    v.y = Phaser.Math.Clamp(sm.transformY(e.pageY), 0, sm.height - 1);
    v.live = true;
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {});
    } catch {
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  window.addEventListener("mousedown", grab, true);
  document.addEventListener("pointerlockchange", () => {
    if (!locked() && document.pointerLockElement !== canvas) {
      // let go: put Phaser's pointer back where the real (now visible) cursor will be next time it moves
      v.live = false;
    }
    draw();
  });
  // which cursor: the crosshair while you're aiming, the arrow otherwise
  const sm = game.scene;
  const aiming = () => AIM_SCENES.some((k) => sm.isActive(k) && !sm.isPaused(k)) && !OVER_SCENES.some((k) => sm.isActive(k));
  const setMode = (aim: boolean) => {
    if (aim === aimMode) return;
    aimMode = aim;
    cur.innerHTML = aim ? CROSS : ARROW;
    canvas.style.cursor = aim ? CSS_CROSS : "";
    draw();
  };
  // a little kick on every click while aiming (only the drawn one: CSS cursors can't animate)
  window.addEventListener("mousedown", () => {
    if (!aimMode || !locked()) return;
    cur.style.transition = "none";
    cur.style.transform = "scale(1.35) rotate(12deg)";
    requestAnimationFrame(() => {
      cur.style.transition = "transform 110ms ease-out";
      cur.style.transform = "";
    });
  });
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    // turning the setting off lets go straight away
    if (!enabled() && document.pointerLockElement === canvas) document.exitPointerLock();
    setMode(aiming());
  });
  window.addEventListener("resize", draw);
}
