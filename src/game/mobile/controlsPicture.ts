// PHONE MODE: the Controls picture (research S10). The pause menu's CONTROLS (and the settings page's) shows this on a
// phone instead of the keyboard's list: a drawing of the phone's screen with every control where it really is (from
// the layer's own slots, so it follows the phone's size, left-handed play and button size), one plain line for each,
// for walking, top-down fights, side rooms and the brawl.

import type { TouchLayer } from "./touchLayer";
import type { Placed, Rect, SlotId } from "./layout";
import { BRAWL_BUTTONS } from "./brawl";
import { phoneSettings } from "./settings";

export type PictureTab = "walk" | "fight" | "side" | "brawl";

export interface PictureItem {
  /** Where it sits: a slot, a placed control's id, or the stick zone. */
  at: { slot: SlotId } | { control: string } | { zone: true };
  word: string;
  line: string;
}

export const PICTURE_TABS: { id: PictureTab; title: string }[] = [
  { id: "walk", title: "WALKING" },
  { id: "fight", title: "FIGHTS" },
  { id: "side", title: "SIDE ROOMS" },
  { id: "brawl", title: "BRAWL" },
];

/** FIRE's line, as the auto-fire setting has it (P10). */
export const FIRE_AUTO = "Shoots by itself at enemies in range. Hold to fire anyway, slide your thumb to aim";
export const FIRE_MANUAL = "Hold to shoot: it aims for you. Slide your thumb to aim by hand";

const PAUSE: PictureItem = { at: { control: "pause" }, word: "II", line: "Pause (and this menu)" };
/** The pocket (thumb-feel round): the fart, a fizzy bongo and the SanMik change, full size, only when they can be used. */
const POCKET: PictureItem = { at: { slot: "pocketFart" }, word: "💨 🍺", line: "Your fart and fizzy bongos pop up here when you can use them" };

/** What each kind of screen has, in plain words (one line per control). */
export const PICTURE: Record<PictureTab, PictureItem[]> = {
  walk: [
    { at: { zone: true }, word: "MOVE", line: "Put your thumb down anywhere here and drag to walk" },
    { at: { slot: "prime" }, word: "TALK", line: "Shows up when you're next to something you can use (TALK, OPEN, USE...). Tap it, or tap that thing itself" },
    { at: { slot: "walkBike" }, word: "RIDE", line: "Out in town: hop on your bike (much faster), tap again to walk" },
    PAUSE,
  ],
  fight: [
    { at: { zone: true }, word: "MOVE", line: "Drag to move" },
    { at: { slot: "prime" }, word: "FIRE", line: FIRE_AUTO },
    { at: { slot: "upLeft" }, word: "DODGE", line: "Dodge the way you're moving" },
    { at: { slot: "up" }, word: "SPECIAL", line: "Your lad's special move. Pops up once you've enough Krezz for it" },
    { at: { slot: "left" }, word: "SWAP", line: "Shows up with a second gun: tap for the next one, hold to pick one" },
    { at: { slot: "ready" }, word: "READY", line: "Pops up when WONK!, GOLD or IBS! is ready: tap it" },
    { at: { slot: "heal" }, word: "HEAL", line: "Pops up when you're hurt: drink some juice (red when you're low)" },
    POCKET,
    { at: { control: "c-chip" }, word: "GUN", line: "Your gun and its ammo. Tap: next gun" },
    PAUSE,
  ],
  side: [
    { at: { zone: true }, word: "RUN", line: "Drag left or right to run. Hold it down to drop through a platform" },
    { at: { slot: "prime" }, word: "JUMP", line: "Tap to jump, hold it for the highest jump, tap again in the air to double jump" },
    { at: { slot: "left" }, word: "FIRE", line: "Hold to shoot (with auto-fire on it shoots by itself)" },
    { at: { slot: "upLeft" }, word: "DODGE", line: "Dash out of trouble" },
    { at: { slot: "up" }, word: "SPECIAL", line: "Your lad's special move. Pops up once you've enough Krezz" },
    { at: { slot: "ready" }, word: "READY", line: "Pops up when a big move is ready" },
    POCKET,
    { at: { control: "c-chip" }, word: "GUN", line: "Tap for the next gun, hold to pick one" },
    PAUSE,
  ],
  brawl: [
    { at: { zone: true }, word: "MOVE", line: "Drag to move" },
    ...BRAWL_BUTTONS.map((b) => ({ at: { slot: b.slot as SlotId }, word: b.word, line: b.line })),
    { at: { zone: true }, word: "", line: "When it says MASH, tap anywhere as fast as you can" },
  ],
};

/** A one-line note for the phone settings page (the other builder renders it). */
export const PAD_NOTE = "A Bluetooth controller works: press any button on it and the touch buttons hide. Touch the screen to bring them back.";

const CSS = `
.kcp{position:fixed;inset:0;z-index:2147483000;background:rgba(6,4,14,.94);color:#fff;font:600 13px/1.25 system-ui,-apple-system,sans-serif;
  display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));
  touch-action:none;user-select:none;-webkit-user-select:none}
.kcp-top{display:flex;gap:6px;align-items:center;flex:0 0 auto}
.kcp-tab{min-height:44px;padding:0 12px;border-radius:10px;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;font-weight:800;letter-spacing:.5px}
.kcp-tab.on{background:#ffd23f;color:#111;border-color:#ffd23f}
.kcp-x{margin-left:auto;min-width:88px;min-height:44px;border-radius:10px;background:#1f2937;border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-weight:800}
.kcp-body{flex:1 1 auto;display:flex;gap:12px;min-height:0;margin-top:6px}
.kcp-pic{position:relative;flex:0 0 auto;border:2px solid rgba(255,255,255,.35);border-radius:14px;background:linear-gradient(#1b1630,#0d0a1a);overflow:hidden}
.kcp-zone{position:absolute;border:2px dashed rgba(255,255,255,.3);border-radius:10px;background:rgba(255,255,255,.04)}
.kcp-dot{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.8);background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:900;letter-spacing:.2px;text-align:center;line-height:1;white-space:nowrap}
.kcp-zone .w{position:absolute;left:8px;bottom:6px;font-size:12px;font-weight:900}
.kcp-dot.sq{border-radius:6px}
.kcp-dot .n,.kcp-zone .n{position:absolute;top:-7px;right:-7px;width:18px;height:18px;border-radius:50%;background:#ffd23f;color:#111;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center}
.kcp-zone .n{left:6px;top:6px;right:auto}
.kcp-lw{position:relative;flex:1 1 auto;min-height:0;display:flex}
.kcp-list{flex:1 1 auto;overflow-y:auto;touch-action:pan-y;padding-right:4px;line-height:1.2}
.kcp-row{display:flex;gap:8px;align-items:flex-start;margin:0 0 5px}
.kcp-more{position:absolute;left:0;right:0;bottom:0;height:30px;display:none;align-items:flex-end;justify-content:center;pointer-events:none;
  background:linear-gradient(rgba(6,4,14,0),rgba(6,4,14,.95));color:#ffd23f;font-size:12px;font-weight:900}
.kcp-more.on{display:flex}
.kcp-row .n{flex:0 0 18px;height:18px;border-radius:50%;background:#ffd23f;color:#111;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:900}
.kcp-row b{color:#ffd23f}
.kcp-foot{flex:0 0 auto;color:#a5b4fc;font-size:12px;margin-top:4px}
`;

function rectOf(layer: TouchLayer, it: PictureItem): Rect | null {
  const at = it.at;
  if ("zone" in at) return layer.zoneRect.w > 0 ? layer.zoneRect : null;
  let p: Placed | null | undefined;
  if ("slot" in at) p = layer.slots?.[at.slot];
  else p = layer.control(at.control)?.placed;
  if (!p) return null;
  const w = p.w ?? p.size;
  const h = p.h ?? p.size;
  return { x: p.cx - w / 2, y: p.cy - h / 2, w, h };
}

export class ControlsPicture {
  private el: HTMLDivElement | null = null;
  private tab: PictureTab = "fight";
  /** Called when it closes (the pause menu is still there underneath). */
  onClose: (() => void) | null = null;

  constructor(private readonly layer: TouchLayer) {}

  get open(): boolean {
    return !!this.el;
  }

  show(tab?: PictureTab) {
    if (tab) this.tab = tab;
    if (!document.getElementById("kcp-css")) {
      const st = document.createElement("style");
      st.id = "kcp-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.el?.remove();
    const el = document.createElement("div");
    el.className = "kcp";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Phone controls");
    this.el = el;
    this.draw();
    document.body.appendChild(el);
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.onClose?.();
  }

  private draw() {
    const el = this.el;
    if (!el) return;
    el.innerHTML = "";
    const top = document.createElement("div");
    top.className = "kcp-top";
    for (const t of PICTURE_TABS) {
      const b = document.createElement("div");
      b.className = `kcp-tab${t.id === this.tab ? " on" : ""}`;
      b.textContent = t.title;
      b.dataset.tab = t.id;
      tapOn(b, () => {
        this.tab = t.id;
        this.draw();
      });
      top.appendChild(b);
    }
    const x = document.createElement("div");
    x.className = "kcp-x";
    x.textContent = "✕ CLOSE";
    tapOn(x, () => this.close());
    top.appendChild(x);
    el.appendChild(top);
    const body = document.createElement("div");
    body.className = "kcp-body";
    // the phone's screen, scaled to fit the left part
    const vp = this.layer.viewport;
    const availH = Math.max(120, (window.innerHeight || vp.h) - 44 - 40 - 24);
    const availW = Math.max(200, (window.innerWidth || vp.w) * 0.56);
    const k = Math.min(availW / vp.w, availH / vp.h);
    const pic = document.createElement("div");
    pic.className = "kcp-pic";
    pic.style.width = `${Math.round(vp.w * k)}px`;
    pic.style.height = `${Math.round(vp.h * k)}px`;
    const list = document.createElement("div");
    list.className = "kcp-list";
    let n = 0;
    for (const it of PICTURE[this.tab]) {
      const r = rectOf(this.layer, it);
      n++;
      if (r) {
        const d = document.createElement("div");
        const zone = "zone" in it.at;
        d.className = zone ? "kcp-zone" : `kcp-dot${"control" in it.at && it.at.control === "c-chip" ? " sq" : ""}`;
        d.style.left = `${r.x * k}px`;
        d.style.top = `${r.y * k}px`;
        d.style.width = `${r.w * k}px`;
        d.style.height = `${r.h * k}px`;
        if (!zone || it.word) {
          // (the word in the drawing only where it fits at 11 px; the list beside it always has it)
          const fits = it.word.length * 7.2 <= r.w * k - 6;
          d.innerHTML = `${zone ? `<span class="w">${it.word}</span>` : fits ? it.word : ""}<span class="n">${n}</span>`;
        }
        pic.appendChild(d);
      }
      const row = document.createElement("div");
      row.className = "kcp-row";
      const line = it.line === FIRE_AUTO && !phoneSettings().autoFire ? FIRE_MANUAL : it.line;
      row.innerHTML = `<span class="n">${n}</span><span>${it.word ? `<b>${it.word}</b>: ` : ""}${line}</span>`;
      list.appendChild(row);
    }
    body.appendChild(pic);
    // (a list longer than the space scrolls, and says so: "▼ more" until its end is in view; P10)
    const lw = document.createElement("div");
    lw.className = "kcp-lw";
    const more = document.createElement("div");
    more.className = "kcp-more";
    more.textContent = "▼ more";
    lw.appendChild(list);
    lw.appendChild(more);
    const cue = () => more.classList.toggle("on", list.scrollHeight - list.clientHeight - list.scrollTop > 4);
    list.addEventListener("scroll", cue, { passive: true });
    requestAnimationFrame(cue);
    body.appendChild(lw);
    el.appendChild(body);
    const foot = document.createElement("div");
    foot.className = "kcp-foot";
    foot.textContent = PAD_NOTE;
    el.appendChild(foot);
  }

  snapshot() {
    const list = this.el?.querySelector(".kcp-list") as HTMLElement | null;
    return {
      open: this.open,
      tab: this.tab,
      rows: this.el ? this.el.querySelectorAll(".kcp-row").length : 0,
      dots: this.el ? this.el.querySelectorAll(".kcp-dot").length : 0,
      scrolls: !!list && list.scrollHeight > list.clientHeight + 1,
      more: !!this.el?.querySelector(".kcp-more.on"),
    };
  }
}

/** A tap on a DOM button (touch-down feels instant; a click works too, for a mouse in a test). */
function tapOn(b: HTMLElement, fn: () => void) {
  b.addEventListener(
    "touchend",
    (e) => {
      if (e.cancelable) e.preventDefault();
      fn();
    },
    { passive: false },
  );
  b.addEventListener("click", fn);
}

/** Which tab fits what is on screen now (the fight you're in, else walking). */
export function tabFor(mode: string): PictureTab {
  return mode === "side" ? "side" : mode === "brawl" ? "brawl" : mode === "combat" ? "fight" : "walk";
}
