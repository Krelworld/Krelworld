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
    decide: () => (active() ? { mode: "brawl", legacyPad: false, stick: "2d", live: true, pause: null, pauseButton: false } : null),
  };
}

export class BrawlControls {
  brawl: BrawlLike | null = null;
  private started = false;
  readonly c: Record<string, TouchControl> = {};
  private mash: HTMLDivElement;
  mashPresses = 0;

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
    // the finishing rush: every finger anywhere is a punch
    const m = document.createElement("div");
    m.className = "kt-mash";
    m.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        const p = this.brawl?.pad;
        if (!p) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          p.edges.add("punch");
          this.mashPresses++;
        }
        haptic("tap");
      },
      { passive: false },
    );
    for (const ev of ["touchmove", "touchend", "touchcancel"]) m.addEventListener(ev, (e) => e.cancelable && e.preventDefault(), { passive: false });
    L.root.appendChild(m);
    this.mash = m;
  }

  /** The brawl starts (SsjBrawl's guarded hook). True: the phone has the controls (its canvas pad isn't drawn). */
  attach(b: unknown): boolean {
    this.brawl = b as BrawlLike;
    this.started = false;
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
  }

  frame() {
    const b = this.brawl;
    const rush = !!b?.finishing;
    for (const k of Object.keys(this.c)) {
      const c = this.c[k];
      const on = !!b && !rush;
      if (!on && c.pressed) continue;
      if (c.shown !== on) c.show(on);
    }
    this.mash.classList.toggle("show", rush);
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
}

/**
 * The Kreltality prompt on a phone: a big ☠ KRELTALITY where the right thumb is (the prime corner) and SPARE beside
 * it. Returns the function that takes them away again (the prompt's own close calls it).
 */
export function showFinisher(layer: TouchLayer, p: FinisherPrompt): () => void {
  const root = document.createElement("div");
  root.className = "kt-fin";
  const mk = (cls: string, html: string, place: Placed | undefined, fn: () => void) => {
    const b = document.createElement("div");
    b.className = `kt-fin-b ${cls}`;
    b.innerHTML = html;
    if (place) {
      const w = Math.max(place.size, 84);
      const h = Math.max(place.size, 60);
      b.style.left = `${place.cx - w / 2}px`;
      b.style.top = `${place.cy - h / 2}px`;
      b.style.width = `${w}px`;
      b.style.height = `${h}px`;
    }
    b.addEventListener(
      "touchstart",
      (e) => {
        if (e.cancelable) e.preventDefault();
        haptic("big");
        fn();
      },
      { passive: false },
    );
    root.appendChild(b);
    return b;
  };
  const s = layer.slots;
  const yes = mk("yes", `<span class="i">☠</span><span>KRELTALITY</span>`, s?.prime, () => p.yes());
  const spare = mk("no", `<span>SPARE</span>`, s?.combatAction, () => p.no());
  // (the drawn size: the yes button grows to 1.25x the prime slot so it reads as THE button)
  if (s?.prime) {
    const sz = Math.round(s.prime.size * 1.25);
    yes.style.width = yes.style.height = `${sz}px`;
    yes.style.left = `${s.prime.cx - sz / 2}px`;
    yes.style.top = `${s.prime.cy - sz / 2}px`;
    void spare;
  }
  layer.root.appendChild(root);
  return () => root.remove();
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
