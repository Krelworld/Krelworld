// PHONE MODE: "?mobilediag" on the end of the link shows a small read-out over the game, for checking a real phone
// (DEVICE_CHECKLIST.md tells the player what to look at and screenshot). Phones only (or ?mobile=1 on a computer),
// and only when the address asks: without the parameter nothing here is created or run at all.
//
// It shows: frame rate (game.loop.actualFps) and the cap; texture memory, estimated as width x height x 4 over every
// texture the game holds (a phone exposes no real memory reading), and how many; decoded sound, estimated the same
// way from the sound buffers, and the audio context's state; the window and visualViewport sizes, devicePixelRatio;
// the canvas box and its scale; the safe-area insets; the touch mode; whether phone mode is on and which tests made
// it so; readability; the Home Screen state; and the last uncaught error. Tap it to move it to another corner.
import type Phaser from "phaser";
import { synth } from "../audio/Synth";
import { storageKey } from "../variant";
import { mobileWhy } from "./flag";
import type { TouchLayer } from "./touchLayer";
import { phoneSettings } from "./settings";
import { homeScreenPlumbing } from "./homeScreen";
import type { PlatformInfo } from "./platform";

/** "?mobilediag" (any value but 0 / off) in the address. */
export function diagWanted(search: string | undefined): boolean {
  if (!search) return false;
  try {
    const q = new URLSearchParams(search);
    if (!q.has("mobilediag")) return false;
    const v = (q.get("mobilediag") ?? "").toLowerCase();
    return v !== "0" && v !== "off" && v !== "false";
  } catch {
    return false;
  }
}

/** Bytes as "12.3 MB". */
export function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1)} MB`;
}

type Bag = Record<string, any>;

/** Texture count and estimated memory (width x height x 4 over every source of every texture). */
export function textureEstimate(game: Phaser.Game): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  const list = (game.textures as unknown as { list: Record<string, Bag> }).list ?? {};
  for (const key of Object.keys(list)) {
    if (key === "__DEFAULT" || key === "__MISSING" || key === "__WHITE" || key === "__NORMAL") continue;
    count++;
    for (const src of (list[key].source as Bag[]) ?? []) bytes += Math.max(0, src.width || 0) * Math.max(0, src.height || 0) * 4;
  }
  return { count, bytes };
}

/** Decoded sound held by the game's sound engine (samples x channels x 4 bytes), and how many sounds. */
export function soundEstimate(): { count: number; bytes: number; ctx: string } {
  let count = 0;
  let bytes = 0;
  const s = synth as unknown as Bag;
  const files = (s.files ?? {}) as Record<string, AudioBuffer | undefined>;
  for (const b of Object.values(files)) {
    if (!b) continue;
    count++;
    bytes += (b.length || 0) * (b.numberOfChannels || 1) * 4;
  }
  const ctx = s.ctx as AudioContext | undefined;
  return { count, bytes, ctx: ctx ? ctx.state : "none yet" };
}

export class DiagOverlay {
  readonly el: HTMLDivElement;
  private pos = 0;
  private timer = 0;
  private slowTimer = 0;
  private tex = { count: 0, bytes: 0 };
  private lastError = "";

  constructor(
    readonly game: Phaser.Game,
    readonly parent: HTMLElement,
    private layer: TouchLayer,
    private platform: PlatformInfo,
    /** Readability now (from readability.ts; passed in so this file stays free of Phaser for the unit tests). */
    private readState: () => { on: boolean; param: boolean | null } = () => ({ on: false, param: null }),
  ) {
    const el = document.createElement("div");
    el.className = "kdiag";
    el.setAttribute("aria-hidden", "true");
    // a tap moves it to the next corner; its touches never reach the game
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("touchstart", (e) => {
      stop(e);
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    el.addEventListener("touchend", (e) => {
      stop(e);
      if (e.cancelable) e.preventDefault();
      this.move();
    }, { passive: false });
    for (const t of ["touchmove", "touchcancel", "mousedown", "mouseup"]) el.addEventListener(t, stop);
    el.addEventListener("click", (e) => {
      stop(e);
      this.move();
    });
    parent.appendChild(el);
    this.el = el;
    window.addEventListener("error", (e) => (this.lastError = String((e as ErrorEvent).message || (e as ErrorEvent).error || "error").slice(0, 160)));
    window.addEventListener("unhandledrejection", (e) => (this.lastError = `promise: ${String((e as PromiseRejectionEvent).reason).slice(0, 150)}`));
    this.measureSlow();
    this.update();
    this.timer = window.setInterval(() => this.update(), 250);
    this.slowTimer = window.setInterval(() => this.measureSlow(), 2000);
  }

  private move() {
    this.el.classList.remove(`pos${this.pos}`);
    this.pos = (this.pos + 1) % 4;
    if (this.pos) this.el.classList.add(`pos${this.pos}`);
  }

  private measureSlow() {
    try {
      this.tex = textureEstimate(this.game);
    } catch {
      /* mid-boot */
    }
  }

  /** The last error the game caught (its crash guard keeps a breadcrumb), or one this page saw. */
  private errorText(): string {
    try {
      const c = JSON.parse(localStorage.getItem(storageKey("krel_crumb")) ?? "null") as { err?: string } | null;
      if (c?.err) return c.err.slice(0, 160);
    } catch {
      /* none */
    }
    return this.lastError || "none";
  }

  /** The read-out as plain lines (also for the smoke test). */
  lines(): string[] {
    const g = this.game;
    const loop = g.loop as Phaser.Core.TimeStep & { hasFpsLimit?: boolean; fpsLimit?: number };
    const snd = soundEstimate();
    const vv = window.visualViewport;
    const cb = g.scale?.canvasBounds;
    const k = cb && g.scale.width ? cb.width / g.scale.width : 0;
    const ins = this.layer.viewport.insets;
    const d = this.layer.decision;
    const w = mobileWhy();
    const yes = (b: boolean) => (b ? "yes" : "NO");
    const st = phoneSettings();
    const rd = this.readState();
    const hs = homeScreenPlumbing();
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const p = this.platform;
    return [
      `KRELWORLD phone diag (tap: move)`,
      `fps ${loop.actualFps.toFixed(1)}${loop.hasFpsLimit ? ` (cap ${loop.fpsLimit})` : ""} · loop ${loop.running ? "on" : "asleep"}`,
      `textures ${this.tex.count} · ~${mb(this.tex.bytes)}`,
      `sound ${snd.count} decoded · ~${mb(snd.bytes)} · audio ${snd.ctx}`,
      `window ${window.innerWidth}x${window.innerHeight} · visual ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} @${vv.scale.toFixed(2)}` : "n/a"} · dpr ${window.devicePixelRatio}`,
      `canvas ${cb ? `${Math.round(cb.width)}x${Math.round(cb.height)} at ${Math.round(cb.x)},${Math.round(cb.y)}` : "?"} · scale ${k.toFixed(3)}`,
      `safe area L${ins.left} R${ins.right} T${ins.top} B${ins.bottom}`,
      `touch mode ${d.mode}${d.scene ? `:${d.scene}` : ""}${d.legacyPad ? " (old pad)" : ""}${d.action ? ` · ACTION ${d.action}` : ""}`,
      `phone mode ${w.mobile ? "ON" : "off"} by ${w.by}: coarse ${yes(w.coarse)} · no hover ${yes(w.noHover)} · touch ${w.touchPoints} · short side ${w.shortSide}${w.param ? ` · ?mobile=${w.param}` : ""}${w.stored ? ` · remembered ${w.stored}` : ""}`,
      `${p.ios ? "iPhone" : p.android ? "Android" : "?"} ${p.browser}${p.inApp ? ` in ${p.inAppName}` : ""} · home screen app ${p.standalone ? "yes" : "no"} · install prompt ${hs.installPrompt ? "yes" : "no"}`,
      `readability ${rd?.on ? "ON" : "off"}${rd?.param !== null && rd?.param !== undefined ? ` (?mobileread=${rd.param ? 1 : 0})` : ""} · text ${st.textSize} · battery saver ${st.batterySaver ? "on" : "off"}`,
      ...(mem ? [`js heap ${mb(mem.usedJSHeapSize)}`] : []),
      `last error: ${this.errorText()}`,
    ];
  }

  private update() {
    try {
      this.el.textContent = this.lines().join("\n");
    } catch (e) {
      this.el.textContent = `diag: ${String(e).slice(0, 120)}`;
    }
  }

  destroy() {
    window.clearInterval(this.timer);
    window.clearInterval(this.slowTimer);
    this.el.remove();
  }
}
