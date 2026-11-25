// PHONE MODE: melee on a phone (stage 2 part 2, research M14).
//
//   - The finale's Super Saiyan brawl (finale/SsjBrawl.ts): its own little canvas pad (36 CSS px buttons) is replaced on
//     a phone by big layer controls: PUNCH in the prime corner (84 px), BLOCK, VANISH, KICK and KI around it, the
//     town's floating stick on the left. They feed the brawl's own pad (its `pad.edges` / `pad.held`), so the brawl's
//     hits, freeze frames, shakes and cheers are exactly the game's. Its finishing rush ("MASH PUNCH!") is a tap
//     anywhere on the screen.
//   - The Kreltality prompt (combat/Kreltality.ts): one big target where the thumb is (the prime corner, 84 px, the
//     words without keys) and a smaller SPARE beside it; the game's own buttons stay and work too.
//   - The Krezz Arms pub brawl ("BRAWL! Tap to swing") needs nothing: the scene takes a tap anywhere (mode none lets
//     every touch through) and the line already says Tap on a phone (wording.ts).

import type Phaser from "phaser";
import { addSceneRule, type SceneRule } from "./modes";
import { registerModeController, type TouchControl, type TouchLayer } from "./touchLayer";
import { haptic } from "./haptics";
import type { Placed } from "./layout";
import { UI_TEXTS, addWording } from "./wording";
import { BRAWL_TEXTS, BRAWL_WORDING } from "./combatWording";
import { MashQueue } from "./combatLogic";

interface BrawlLike {
  on: boolean;
  finishing: boolean;
  sc: Phaser.Scene;
  pad: { mx: number; my: number; held: Set<string>; edges: Set<string> };
}

/** The brawl's moves, in the brawl's own words (its touch legend says PUNCH / KICK / KI / VANISH / BLOCK). */
export const BRAWL_BUTTONS = [
  { id: "b-punch", key: "punch", slot: "prime", word: "PUNCH", hold: false, line: "Tap to punch; keep tapping for a flurry" },
  { id: "b-block", key: "block", slot: "left", word: "BLOCK", hold: true, line: "Hold to block (just in time = parry)" },
  { id: "b-vanish", key: "vanish", slot: "upLeft", word: "VANISH", hold: false, line: "Vanish behind him, or chase a launch" },
  { id: "b-kick", key: "kick", slot: "up", word: "KICK", hold: false, line: "Kick to launch him" },
  { id: "b-ki", key: "ki", slot: "ready", word: "KI", hold: true, line: "Hold for ki blasts" },
] as const;

/** The brawl rule: the Finale with the brawl running is ours; anything else in the Finale stays as stage 1 had it. */
export function brawlRule(active: () => boolean): SceneRule {
  return {
    name: "finale brawl (phone)",
    match: (k) => k === "Finale",
    // (pause: the brawl's own II, brawl.ts: the carry-on card with SKIP FIGHT, the laptop's Esc there; F9)
    decide: () => (active() ? { mode: "brawl", legacyPad: false, stick: "2d", live: true, pause: null, pauseButton: false } : null),
  };
}

/** Where the brawl's legend sits on a phone (game px): under the health bars and the KI bar, centred. */
const LEGEND_Y = 74;
const LEGEND_W = 820;

export class BrawlControls {
  brawl: BrawlLike | null = null;
  private started = false;
  readonly c: Record<string, TouchControl> = {};
  private mash: HTMLDivElement;
  private readonly mashQ = new MashQueue();
  /** Punches the brawl was actually handed. */
  get mashPresses() {
    return this.mashQ.delivered;
  }

  private feedMash() {
    const p = this.brawl?.pad;
    if (p && this.mashQ.next(p.edges.has("punch"))) p.edges.add("punch");
  }

  constructor(
    readonly game: Phaser.Game,
    readonly layer: TouchLayer,
  ) {
    const L = layer;
    for (const b of BRAWL_BUTTONS) {
      this.c[b.key] = L.addControl({
        id: b.id,
        slot: b.slot,
        group: "brawl",
        toCorner: b.slot === "prime",
        className: `kt-c kt-brawl kt-b-${b.key}`,
        label: b.word,
        caption: b.word,
        haptic: b.key === "punch" ? "tap" : "press",
        onDown: () => {
          const p = this.brawl?.pad;
          if (!p) return;
          // (BLOCK and KI are read as held; the rest as presses)
          if (!b.hold) p.edges.add(b.key);
          p.held.add(b.key);
        },
        onUp: () => this.brawl?.pad.held.delete(b.key),
      });
    }
    // II: the finale has no pause menu; on a laptop Esc skips the fight. On a phone II pauses (the carry-on card) and
    // the card offers SKIP FIGHT (research M11: a pause button in every mode; F9)
    this.c.pause = L.addControl({ id: "b-pause", slot: "pause", className: "kt-pause", html: `<span class="kt-bars"><i></i><i></i></span>`, fade: false, onDown: () => this.pause() });
    // the finishing rush: every finger anywhere is a punch
    const m = document.createElement("div");
    m.className = "kt-mash";
    m.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        const p = this.brawl?.pad;
        if (!p) return;
        // (every finger counts, even two in one frame: queued, one a frame; F10)
        this.mashQ.press(e.changedTouches.length);
        this.feedMash();
        haptic("tap");
      },
      { passive: false },
    );
    for (const ev of ["touchmove", "touchend", "touchcancel"]) m.addEventListener(ev, (e) => e.cancelable && e.preventDefault(), { passive: false });
    L.root.appendChild(m);
    this.mash = m;
  }

  /** Set by index.ts: the shell's carry-on card with one extra button. */
  pauseCard: ((extra: { label: string; fn: () => void }) => void) | null = null;
  pauses = 0;

  private pause() {
    const sc = this.brawl?.sc as unknown as { finish?: (skipped: boolean) => void } | undefined;
    if (!sc || !this.pauseCard) return;
    this.pauses++;
    this.release();
    this.pauseCard({ label: "SKIP FIGHT ▸▸", fn: () => sc.finish?.(true) });
  }

  /** The brawl starts (SsjBrawl's guarded hook). True: the phone has the controls (its canvas pad isn't drawn). */
  attach(b: unknown): boolean {
    this.brawl = b as BrawlLike;
    this.started = false;
    this.legendDone = false;
    return true;
  }

  active(): boolean {
    const b = this.brawl;
    if (!b) return false;
    // (before the fight: its intro is still talking; after it: done, forgotten)
    if (!b.sc?.sys?.isActive?.()) {
      if (this.started || !b.sc?.sys) this.forget();
      return false;
    }
    if (b.on) this.started = true;
    else if (this.started) this.forget();
    return b.on;
  }

  private forget() {
    this.brawl = null;
    this.started = false;
    this.legendDone = false;
  }

  private legendDone = false;

  /**
   * The brawl's own how-to legend (its first 9 seconds, bottom centre) grows with the bigger text and wraps onto two
   * lines under PUNCH and BLOCK. On a phone it moves up under the two health bars, where no thumb or button is.
   */
  private fitLegend(b: BrawlLike) {
    let found: Phaser.GameObjects.Text | null = null;
    const walk = (o: Phaser.GameObjects.GameObject) => {
      if (found) return;
      const list = (o as unknown as { list?: Phaser.GameObjects.GameObject[] }).list;
      if (Array.isArray(list)) for (const c of list) walk(c);
      if (o.type === "Text" && /^PUNCH: mash for a flurry/.test((o as Phaser.GameObjects.Text).text)) found = o as Phaser.GameObjects.Text;
    };
    try {
      for (const o of b.sc.sys.displayList.list) walk(o);
    } catch {
      return;
    }
    const t = found as Phaser.GameObjects.Text | null;
    if (!t) return;
    this.legendDone = true;
    t.setOrigin(0.5, 0).setPosition(480, LEGEND_Y).setWordWrapWidth(LEGEND_W);
  }

  frame() {
    const b = this.brawl;
    const rush = !!b?.finishing;
    if (b && !this.legendDone) this.fitLegend(b);
    for (const k of Object.keys(this.c)) {
      const c = this.c[k];
      const on = !!b && !rush;
      if (!on && c.pressed) continue;
      if (c.shown !== on) c.show(on);
    }
    this.mash.classList.toggle("show", rush);
    if (rush) this.feedMash();
    else this.mashQ.clear();
  }

  leave() {
    for (const c of Object.values(this.c)) if (!c.pressed) c.show(false);
    this.mash.classList.remove("show");
    this.release();
  }

  release() {
    const p = this.brawl?.pad;
    if (!p) return;
    p.held.clear();
    p.edges.clear();
  }

  snapshot() {
    const b = this.brawl;
    return { active: this.active(), finishing: !!b?.finishing, held: b ? [...b.pad.held] : [], edges: b ? [...b.pad.edges] : [], mash: this.mash.classList.contains("show"), mashPresses: this.mashPresses };
  }
}

// ------------------------------------------------------------------ the Kreltality prompt (any fight)

export interface FinisherPrompt {
  yes(): void;
  no(): void;
  /** The prompt's countdown (default FINISHER_MS). */
  ms?: number;
  /** Several at once (Flight KR-069's hero passengers): the button says ALL OF THEM. */
  all?: boolean;
}

/** The prompt's buttons ignore touches this long after they appear: a FIRE tap meant for the fight's last moment
 *  must not pick (and it can't be undone) before the question can be read (R4). */
export const FINISHER_ARM_MS = 400;
/** The prompt's own countdown (Kreltality.ts: 7 s, then it spares them). */
export const FINISHER_MS = 7000;

/**
 * The Kreltality prompt on a phone: the one big ☠ KRELTALITY where the right thumb is (the prime corner), with the
 * 7 s countdown as a ring round it, and SPARE beside it; the game's own pair is hidden on a phone (Kreltality.ts), so
 * there are two targets for two choices (P7). A button acts on a touch that starts on it at least FINISHER_ARM_MS
 * after the prompt opened (R4). Placed again whenever the layer lays out (Safari's bars). Returns the function that
 * takes them away again (the prompt's own close calls it).
 */
export function showFinisher(layer: TouchLayer, p: FinisherPrompt, armMs = FINISHER_ARM_MS): () => void {
  const root = document.createElement("div");
  root.className = "kt-fin";
  const t0 = performance.now();
  const mk = (cls: string, html: string, fn: () => void) => {
    const b = document.createElement("div");
    b.className = `kt-fin-b ${cls}`;
    b.innerHTML = html;
    b.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        if (performance.now() - t0 < armMs) return;
        haptic("big");
        fn();
      },
      { passive: false },
    );
    root.appendChild(b);
    return b;
  };
  const yes = mk("yes", `<svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg><span class="i">☠</span><span>${p.all ? "ALL OF THEM" : "KRELTALITY"}</span>`, () => p.yes());
  const spare = mk("no", `<span>SPARE</span>`, () => p.no());
  const ring = yes.querySelector("circle") as SVGCircleElement | null;
  if (ring) ring.style.animationDuration = `${p.ms ?? FINISHER_MS}ms`;
  const place = () => {
    const s = layer.slots;
    if (s?.prime) {
      // (the yes button is 1.25x the prime slot so it reads as THE button)
      const sz = Math.round(s.prime.size * 1.25);
      Object.assign(yes.style, { width: `${sz}px`, height: `${sz}px`, left: `${s.prime.cx - sz / 2}px`, top: `${s.prime.cy - sz / 2}px` });
    }
    const a = s?.combatAction;
    if (a) {
      const w = Math.max(a.size, 84);
      const h = Math.max(a.size, 60);
      Object.assign(spare.style, { width: `${w}px`, height: `${h}px`, left: `${a.cx - w / 2}px`, top: `${a.cy - h / 2}px` });
    }
  };
  place();
  layer.onLayout.add(place);
  layer.root.appendChild(root);
  return () => {
    layer.onLayout.delete(place);
    root.remove();
  };
}

export const BRAWL_CSS = `
.kt-brawl .kt-face{border-color:rgba(255,224,102,calc(var(--kt-a) + .35));font-weight:900}
.kt-b-punch .kt-face{border-width:3px}
.kt-b-block .kt-face{border-color:rgba(134,239,172,calc(var(--kt-a) + .35))}
.kt-b-vanish .kt-face{border-color:rgba(147,197,253,calc(var(--kt-a) + .35))}
.kt-b-ki .kt-face{border-color:rgba(255,244,194,calc(var(--kt-a) + .35))}
.kt-fin{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5}
.kt-fin-b{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;
  touch-action:none;border-radius:50%;color:#fff;font:900 12px/1.1 Impact,system-ui,sans-serif;letter-spacing:.5px;
  text-shadow:0 1px 2px #000;user-select:none;-webkit-user-select:none}
.kt-fin-b.yes{background:rgba(153,27,27,.88);border:3px solid #fca5a5;box-shadow:0 0 0 3px rgba(0,0,0,.5),0 0 18px rgba(239,68,68,.7);
  animation:ktFin .6s ease-in-out infinite alternate}
.kt-fin-b.yes .i{font-size:30px;line-height:1}
.kt-fin-b .ring{position:absolute;left:-6px;top:-6px;width:calc(100% + 12px);height:calc(100% + 12px);transform:rotate(-90deg);pointer-events:none;overflow:visible}
.kt-fin-b .ring circle{fill:none;stroke:#fde68a;stroke-width:5;stroke-linecap:round;stroke-dasharray:289;stroke-dashoffset:0;
  animation:ktFinRing linear forwards}
@keyframes ktFinRing{to{stroke-dashoffset:289}}
.kt-fin-b.no{background:rgba(31,41,55,.85);border:2px solid rgba(255,255,255,.5);border-radius:14px;font-size:13px}
@keyframes ktFin{from{transform:scale(1)}to{transform:scale(1.06)}}
`;

let installed: BrawlControls | null = null;

export function brawlControls(): BrawlControls | null {
  return installed;
}

export function installBrawl(game: Phaser.Game, layer: TouchLayer): BrawlControls {
  if (installed) return installed;
  if (typeof document !== "undefined" && !document.getElementById("kt-brawl-css")) {
    const st = document.createElement("style");
    st.id = "kt-brawl-css";
    st.textContent = BRAWL_CSS;
    document.head.appendChild(st);
  }
  const bc = new BrawlControls(game, layer);
  UI_TEXTS.Finale = [...(UI_TEXTS.Finale ?? []), ...BRAWL_TEXTS];
  for (const r of BRAWL_WORDING) addWording(r);
  addSceneRule(brawlRule(() => bc.active()), "front");
  registerModeController({
    id: "brawl",
    mode: "brawl",
    enter: () => bc.frame(),
    frame: () => bc.frame(),
    release: () => bc.release(),
    leave: () => bc.leave(),
  });
  installed = bc;
  return bc;
}
