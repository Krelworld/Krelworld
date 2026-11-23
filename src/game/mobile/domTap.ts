// PHONE MODE: taps on the phone's own DOM pieces (the dialogue pills, the conversation log, the Phone settings page).
// A tap acts on touchend, if the finger is still close to where it went down (so a scroll in a list never presses a
// row, and the browser counts it as the player's gesture); no ghost click follows. None of their touches reach the
// game underneath (Phaser listens on the window for touches that land outside the canvas).

/** Keep every touch, mouse and pointer event on `el` away from the game. */
export function keepTouches(el: HTMLElement) {
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel", "mousedown", "mouseup", "click", "pointerdown", "pointerup", "wheel"]) {
    el.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }
}

/** A finger that moves further than this is scrolling, not tapping. */
export const TAP_SLOP = 12;

/**
 * `fn` on a tap of `el` (a finger down and up within TAP_SLOP px), or a mouse click (testing with ?mobile=1 on a
 * computer). The element gets the class "on" while pressed.
 */
export function bindTap(el: HTMLElement, fn: (e: Event) => void) {
  let t0: { x: number; y: number; id: number } | null = null;
  let touched = 0;
  el.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    if (t) t0 = { x: t.clientX, y: t.clientY, id: t.identifier };
    el.classList.add("on");
  }, { passive: true });
  el.addEventListener("touchmove", (e) => {
    const t = Array.from(e.changedTouches).find((x) => x.identifier === t0?.id);
    if (t && t0 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > TAP_SLOP) {
      t0 = null;
      el.classList.remove("on");
    }
  }, { passive: true });
  el.addEventListener("touchend", (e) => {
    el.classList.remove("on");
    if (!t0) return;
    t0 = null;
    touched = performance.now();
    if (e.cancelable) e.preventDefault();
    fn(e);
  }, { passive: false });
  el.addEventListener("touchcancel", () => {
    t0 = null;
    el.classList.remove("on");
  });
  el.addEventListener("click", (e) => {
    // (the click a browser may still send after a touch we already acted on)
    if (performance.now() - touched < 700) return;
    fn(e);
  });
}
