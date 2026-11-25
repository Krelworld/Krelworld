// PHONE MODE: the Phone settings page (research S12). A DOM page over the game (so it is laid out in real CSS px, in
// the safe area, and scrolls natively on a short screen), reached on a phone from SETTINGS (the title's and the pause
// menu's: its "📱 PHONE" tab) and from the pause menu's "📱 PHONE SETTINGS" row (screens.ts). It renders
// phoneSettingsList() (every row, live or not: whoever wires a setting flips its `live`), two columns of 48 px rows,
// each with its label and one line of help, then "Phone layout: Auto / On / Off" (flag.ts's rememberPhoneMode) and a
// line saying a Bluetooth controller works.
import { mobileWhy, rememberPhoneMode } from "./flag";
import { phoneSettingsList, resetPhoneSettings, type PhoneSettingEntry } from "./settings";
import { bindTap, keepTouches } from "./domTap";
import { haptic } from "./haptics";

export type SettingsFrom = "title" | "pause" | "settings" | "test";

/** The "Phone layout" row: what each choice stores (flag.ts reads it at the next load). */
export type LayoutChoice = "auto" | "on" | "off";

/**
 * What a "Phone layout" choice does to storage. On a phone, ON and AUTO store the same thing (nothing): the device test
 * already says phone, and flag.ts deliberately ignores a stored "1" so a tablet or a laptop never reads storage at
 * startup. OFF stores the opt-out "0" (the plain touch game from the next load).
 */
export function layoutStorage(c: LayoutChoice): "off" | "auto" {
  return c === "off" ? "off" : "auto";
}

/** The choice to show as selected now (this visit's choice, else how this visit was decided). */
export function layoutNow(chosen: LayoutChoice | null, by: string): LayoutChoice {
  if (chosen) return chosen;
  return by === "address" ? "on" : "auto";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** How a slider's value reads. */
export function sliderText(v: number, unit: "%" | "ms"): string {
  return unit === "%" ? `${Math.round(v * 100)}%` : `${v > 0 ? "+" : ""}${Math.round(v)} ms`;
}

/** One step of a slider, kept in range and on the step grid. */
export function stepSlider(v: number, dir: -1 | 1, min: number, max: number, step: number): number {
  const n = Math.round((v + dir * step - min) / step) * step + min;
  return Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
}

export class PhoneSettingsPage {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private layoutChoice: LayoutChoice | null = null;
  private from: SettingsFrom = "settings";
  private onClose: (() => void) | null = null;
  /** For tests: rows drawn, and changes made. */
  stats = { opens: 0, changes: 0 };

  constructor(parent: HTMLElement) {
    const el = document.createElement("div");
    el.className = "kps";
    el.innerHTML = `<div class="kps-card" role="dialog" aria-label="Phone settings">
      <div class="kps-head"><span class="kps-title">📱 PHONE SETTINGS</span><button type="button" class="kps-b kps-reset">RESET</button><button type="button" class="kps-b kps-done">DONE</button></div>
      <div class="kps-body"></div></div>`;
    keepTouches(el);
    parent.appendChild(el);
    this.el = el;
    this.body = el.querySelector(".kps-body") as HTMLDivElement;
    bindTap(el.querySelector(".kps-done") as HTMLElement, () => this.close());
    bindTap(el.querySelector(".kps-reset") as HTMLElement, () => {
      resetPhoneSettings();
      this.stats.changes++;
      this.render();
    });
  }

  get isOpen(): boolean {
    return this.el.classList.contains("show");
  }

  open(from: SettingsFrom = "settings", onClose?: () => void) {
    this.from = from;
    this.onClose = onClose ?? null;
    this.stats.opens++;
    this.render();
    this.el.classList.add("show");
    this.body.scrollTop = 0;
  }

  close() {
    if (!this.isOpen) return;
    this.el.classList.remove("show");
    const fn = this.onClose;
    this.onClose = null;
    fn?.();
  }

  /** Android Back: closes the page. */
  onBack(): boolean {
    if (!this.isOpen) return false;
    this.close();
    return true;
  }

  /** Every row, as a test reads it. */
  rows(): { key: string; label: string; value: string }[] {
    return Array.from(this.body.querySelectorAll<HTMLElement>(".kps-row")).map((r) => ({ key: r.dataset.key ?? "", label: r.querySelector(".kps-l")?.textContent ?? "", value: r.dataset.value ?? "" }));
  }

  private render() {
    // (Vibration only where the browser can vibrate: never on an iPhone, where the row could do nothing; P16)
    const canBuzz = typeof navigator !== "undefined" && typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === "function";
    const list = phoneSettingsList().filter((e) => e.key !== "haptics" || canBuzz);
    const now = layoutNow(this.layoutChoice, mobileWhy().by);
    let html = `<div class="kps-grid">`;
    for (const e of list) html += this.rowHtml(e);
    html += `<div class="kps-row" data-key="phoneLayout" data-value="${now}"><div class="kps-t"><div class="kps-l">Phone layout</div><div class="kps-h">${this.layoutChoice === "off" ? "Off from the next time you open the game." : "Off: the plain touch controls (next visit)."}</div></div><div class="kps-c kps-seg">${(["auto", "on", "off"] as LayoutChoice[])
      .map((c) => `<button type="button" class="kps-o${c === now ? " sel" : ""}" data-layout="${c}">${c.toUpperCase()}</button>`)
      .join("")}</div></div>`;
    html += `</div>`;
    if (this.layoutChoice === "off") html += `<div class="kps-note">The phone layout goes off the next time you open the game. <button type="button" class="kps-b kps-reload">RELOAD NOW</button></div>`;
    // (the same words as the Controls picture's PAD_NOTE, controlsPicture.ts: what pad.ts's handover does)
    html += `<div class="kps-pad">🎮 A Bluetooth controller works: pair it, press any button on it and the touch buttons hide. Touch the screen to bring them back.</div>`;
    this.body.innerHTML = html;
    for (const e of list) this.bindRow(e);
    for (const b of Array.from(this.body.querySelectorAll<HTMLElement>("[data-layout]"))) {
      bindTap(b, () => {
        const c = b.dataset.layout as LayoutChoice;
        this.layoutChoice = c;
        rememberPhoneMode(layoutStorage(c));
        this.stats.changes++;
        haptic("tap");
        this.render();
      });
    }
    const reload = this.body.querySelector<HTMLElement>(".kps-reload");
    if (reload) bindTap(reload, () => location.reload());
  }

  private rowHtml(e: PhoneSettingEntry): string {
    const v = e.get();
    const head = `<div class="kps-t"><div class="kps-l">${esc(e.label)}</div><div class="kps-h">${esc(e.help)}</div></div>`;
    if (e.type === "toggle") return `<div class="kps-row kps-tog${v ? " sel" : ""}" data-key="${e.key}" data-value="${v ? "on" : "off"}">${head}<div class="kps-c"><span class="kps-sw"><i></i></span></div></div>`;
    if (e.type === "choice")
      return `<div class="kps-row" data-key="${e.key}" data-value="${esc(String(v))}">${head}<div class="kps-c kps-seg">${e.options
        .map((o) => `<button type="button" class="kps-o${o.value === v ? " sel" : ""}" data-v="${esc(o.value)}">${esc(o.label)}</button>`)
        .join("")}</div></div>`;
    return `<div class="kps-row" data-key="${e.key}" data-value="${esc(String(v))}">${head}<div class="kps-c kps-sl"><button type="button" class="kps-o" data-d="-1">−</button><span class="kps-v">${sliderText(v as number, e.unit)}</span><button type="button" class="kps-o" data-d="1">+</button></div></div>`;
  }

  private bindRow(e: PhoneSettingEntry) {
    const row = this.body.querySelector<HTMLElement>(`.kps-row[data-key="${e.key}"]`);
    if (!row) return;
    const changed = () => {
      this.stats.changes++;
      haptic("tap");
      this.render();
    };
    if (e.type === "toggle") {
      // (the whole row is the switch)
      bindTap(row, () => {
        e.set(!e.get());
        changed();
      });
      return;
    }
    if (e.type === "choice") {
      for (const b of Array.from(row.querySelectorAll<HTMLElement>("[data-v]")))
        bindTap(b, () => {
          const opt = e.options.find((o) => o.value === b.dataset.v);
          if (!opt) return;
          e.set(opt.value as never);
          changed();
        });
      return;
    }
    for (const b of Array.from(row.querySelectorAll<HTMLElement>("[data-d]")))
      bindTap(b, () => {
        e.set(stepSlider(e.get() as number, Number(b.dataset.d) as -1 | 1, e.min, e.max, e.step) as never);
        changed();
      });
  }
}
