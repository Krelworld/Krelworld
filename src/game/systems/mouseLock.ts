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
 */

const enabled = () => G.meta?.settings?.mouseLock !== false;

export function installMouseLock(game: Phaser.Game) {
  const touchy = typeof window !== "undefined" && (("ontouchstart" in window && navigator.maxTouchPoints > 0) || matchMedia?.("(pointer: coarse)").matches);
  if (touchy || !document.body.requestPointerLock) return;
  const im = game.input;
  const v = { x: 480, y: 270, live: false };
  // the drawn cursor: a classic arrow, its tip exactly on the hotspot
  const cur = document.createElement("div");
  cur.style.cssText = "position:fixed;left:0;top:0;width:16px;height:24px;pointer-events:none;z-index:99999;display:none;";
  cur.innerHTML =
    '<svg width="16" height="24" viewBox="0 0 16 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 1 L1 19 L5.5 14.5 L8.5 21.5 L11 20.5 L8 13.5 L14 13.5 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.appendChild(cur);
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
    cur.style.left = `${px - window.scrollX - 1}px`;
    cur.style.top = `${py - window.scrollY - 1}px`;
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
  // turning the setting off lets go straight away
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (!enabled() && document.pointerLockElement === canvas) document.exitPointerLock();
  });
  window.addEventListener("resize", draw);
}
