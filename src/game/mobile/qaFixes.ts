// PHONE MODE, stage 4: small things the full phone QA found (s4-01, s4-02, s4-03), each done from outside the game on
// a phone only (a laptop never loads this chunk). One poststep look per frame, a few property reads each.
import type Phaser from "phaser";
import { watchText } from "./wording";
import { liveScene } from "./listScenes";
import { HUD_CHIP_TEXTS, READY_ARM_MS, splitWhackRules } from "./qaLogic";
import { SCENE_RULES, addSceneRule, type SceneRule } from "./modes";
import { playerRect, toPage } from "./observe";
import type { TouchLayer } from "./touchLayer";
import type { Rect } from "./layout";
import { phoneSettings } from "./settings";
import { TOAST_MAX, TOWN_CAM_PAD, overlaps } from "./qaLogic";

type Bag = Record<string, any>;


export interface QaFixStats {
  hudChip: boolean;
  tvBack: number;
  /** The Wonk-Off's "tap to start" card: shown, and started from it. */
  wonkCards: number;
  wonkStarts: number;
  /** Toasts made see-through because the player was under them, and toasts sent off early to keep the column short. */
  toastFades: number;
  toastsTrimmed: number;
  /** The town's camera may run past the map's edge on the buttons' side (the player never stands under them). */
  townPad: boolean;
  /** Times the conversation's SKIP pill stepped aside for the book's own SKIP. */
  bookSkip: number;
  whackSplit: number;
}

/**
 * A "ready" card over a scene that starts the instant a conversation ends (the Club's Wonk-Off, s4-03 F2 / P9: the
 * last line's taps fell straight into it and it was lost in 3 s). The scene is paused under it; it takes a fresh tap
 * only, landing READY_ARM_MS or more after it showed (a finger already down, or a tap in that time, does nothing).
 */
function readyCard(title: string, sub: string, go: () => void): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "kres show kt-gocard";
  el.setAttribute("role", "button");
  el.innerHTML = `<div class="kres-in"><div class="kres-t"></div><div class="kres-s"></div></div>`;
  (el.querySelector(".kres-t") as HTMLElement).textContent = title;
  (el.querySelector(".kres-s") as HTMLElement).textContent = sub;
  const t0 = performance.now();
  const fresh = new Set<number>();
  const stop = (e: Event) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  el.addEventListener("touchstart", (e) => {
    stop(e);
    if (performance.now() - t0 < READY_ARM_MS) return;
    for (const t of Array.from(e.changedTouches)) fresh.add(t.identifier);
  }, { passive: false });
  el.addEventListener("touchmove", stop, { passive: false });
  el.addEventListener("touchend", (e) => {
    stop(e);
    if (!Array.from(e.changedTouches).some((t) => fresh.has(t.identifier))) return;
    el.remove();
    go();
  }, { passive: false });
  el.addEventListener("touchcancel", stop, { passive: false });
  // (a mouse, in a desktop browser's phone emulation)
  el.addEventListener("click", (e) => {
    stop(e);
    if (performance.now() - t0 < READY_ARM_MS || !el.isConnected) return;
    el.remove();
    go();
  });
  return el;
}

export function installQaFixes(game: Phaser.Game, shell: { addBackHandler(fn: () => boolean): void }, layer: TouchLayer) {
  const stats: QaFixStats = { hudChip: false, tvBack: 0, wonkCards: 0, wonkStarts: 0, toastFades: 0, toastsTrimmed: 0, townPad: false, bookSkip: 0, whackSplit: 0 };
  // Android Back on the telly does what Esc does there on a laptop (s4-03 F10): a show on → switch off (a story
  // broadcast: leave it), the On Demand list → whatever's on. It had done nothing, with SWITCH OFF on screen.
  shell.addBackHandler(() => {
    const tv = liveScene(game, "TV");
    if (!tv || game.scene.isActive("Menu")) return false;
    try {
      if (tv.mode === "playing") tv.back();
      else if (tv.mode === "episodes") tv.surf();
      else return false;
    } catch {
      return false;
    }
    stats.tvBack++;
    return true;
  });
  const each = () => {
    // the HUD's chip line (UIScene.statT): watched, so only a value with a key in it is reworded
    const ui = liveScene(game, "UI");
    const st = ui?.statT as Phaser.GameObjects.Text | undefined;
    if (st?.scene && !(st as Bag).__krelWatch) {
      watchText(st, HUD_CHIP_TEXTS);
      stats.hudChip = true;
    }
    if (ui) toasts(ui);
    townCamera();
    bookSkip();
    whackRules();
  };

  // ---- Whack-a-Drongus's rules line (s4-03 F4 / P6): at the phone's text size it wrapped with "KREZZCOIN" alone on
  // the second line; it is split into two even lines instead (the same words)
  const whackRules = () => {
    const wk = liveScene(game, "Whack");
    if (!wk) return;
    const look = (list: Bag[] | undefined, depth: number) => {
      for (const o of list ?? []) {
        if (o?.type === "Container" && depth < 2) look(o.list as Bag[], depth + 1);
        else if (o?.type === "Text" && !o.__mfSplit && typeof o.text === "string") {
          const t = splitWhackRules(o.text);
          if (t) {
            o.__mfSplit = true;
            o.setText(t);
            stats.whackSplit++;
          }
        }
      }
    };
    look(wk.sys?.displayList?.list as Bag[] | undefined, 0);
  };

  // ---- Home's book (s4-01 m4): its own red SKIP ▶▶ (which also stops the author mid-sentence) is the one skip; the
  // conversation's SKIP ▸▸ pill steps aside while it shows, so there aren't two
  let homeSkip: Bag | null = null;
  let pillHidden = false;
  const hookHome = () => {
    let sc: Phaser.Scene | null = null;
    try {
      sc = game.scene.getScene("Home");
    } catch {
      sc = null;
    }
    if (!sc?.sys?.events || (sc as Bag).__mfBook) return;
    (sc as Bag).__mfBook = true;
    sc.sys.events.on("addedtoscene", (go: Bag) => {
      if (go?.type === "Text" && typeof go.text === "string" && /^SKIP ▶▶/.test(go.text)) homeSkip = go;
    });
  };
  const bookSkip = () => {
    hookHome();
    const on = !!homeSkip && !!homeSkip.active && homeSkip.visible !== false && !!homeSkip.scene && game.scene.isActive("Home");
    if (!on) homeSkip = null;
    if (on === pillHidden) return;
    const pill = document.querySelector(".kd-pill.kd-skip") as HTMLElement | null;
    if (!pill) return;
    pillHidden = on;
    pill.style.visibility = on ? "hidden" : "";
    stats.bookSkip += on ? 1 : 0;
  };

  // ---- toasts (s4-01 M2, m1): never more than TOAST_MAX at once on a phone (the column reached 165 of 390 px), and
  // see-through while the player stands under one (a dungeon's exit is often right under them)
  const toasts = (ui: Bag) => {
    const list = ui.toasts as { c: Bag; until: number }[] | undefined;
    if (!Array.isArray(list) || !list.length) return;
    const now = (ui.time as Bag | undefined)?.now as number;
    const live = list.filter((t) => t.until > now);
    for (let i = 0; i < live.length - TOAST_MAX; i++) {
      live[i].until = now;
      stats.toastsTrimmed++;
    }
    let me: Rect | null = null;
    try {
      me = playerRect(game, layer.decision);
    } catch {
      me = null;
    }
    for (const t of list) {
      const c = t.c;
      if (!c?.active) continue;
      const bg = (c.list as Bag[] | undefined)?.[0];
      const w = (bg?.width as number | undefined) ?? 300;
      const h = (c.getData?.("h") as number | undefined) ?? 48;
      let over = false;
      if (me) {
        const a = toPage(game, ui as unknown as Phaser.Scene, c.x, c.y, 0);
        const z = toPage(game, ui as unknown as Phaser.Scene, c.x + w, c.y + h, 0);
        over = !!a && !!z && overlaps({ x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y }, me, 10);
      }
      if (over && !c.__mfFaded && t.until > now) {
        c.__mfFaded = true;
        c.setAlpha(0.22);
        stats.toastFades++;
      } else if (over && c.__mfFaded && c.alpha > 0.22 && t.until > now) c.setAlpha(0.22);
      else if (!over && c.__mfFaded) {
        c.__mfFaded = false;
        if (t.until > now) c.setAlpha(1);
      }
    }
  };

  // ---- the town's camera (s4-01 M2): at the map's right and bottom edges the camera stopped and the player walked out
  // under ACTION / RIDE. On a phone it may run on past the edge on the buttons' side by about the cluster's size.
  const townCamera = () => {
    const hub = liveScene(game, "Hub");
    const cam = hub?.cameras?.main as Phaser.Cameras.Scene2D.Camera | undefined;
    if (!cam) return;
    const b = cam.getBounds();
    const pad = TOWN_CAM_PAD;
    const left = phoneSettings().leftHanded;
    const want = { x: left ? -pad.x : 0, w: 2560 + pad.x, h: 1792 + 380 + pad.y };
    const plain = Math.abs(b.width - 2560) < 1 && Math.abs(b.height - (1792 + 380)) < 1 && Math.abs(b.x) < 1;
    const padded = Math.abs(b.width - want.w) < 1 && Math.abs(b.height - want.h) < 1;
    if (plain || (padded && Math.abs(b.x - want.x) > 1)) {
      cam.setBounds(want.x, b.y, want.w, want.h);
      stats.townPad = true;
    }
  };
  game.events.on("poststep", each);

  // ---- the Club's Wonk-Off (P9): a "tap to start" beat, and the II while it runs (it had neither)
  let wonkHead: Bag | null = null;
  let wonkPending = false;
  let card: HTMLDivElement | null = null;
  const wonkAt = { shown: 0, started: 0, pausedUnder: false };
  const wonkLive = () => !!wonkHead && !!wonkHead.active && !!wonkHead.scene;
  const hookClub = () => {
    let sc: Phaser.Scene | null = null;
    try {
      sc = game.scene.getScene("Club");
    } catch {
      sc = null;
    }
    if (!sc?.sys?.events || (sc as Bag).__mfWonk) return;
    (sc as Bag).__mfWonk = true;
    sc.sys.events.on("addedtoscene", (go: Bag) => {
      if (go?.type === "Text" && go.text === "WONK-OFF") {
        wonkHead = go;
        wonkPending = true;
      }
    });
  };
  game.events.on("prestep", () => {
    // (hooked as soon as the scene exists: the phone chunk can arrive before the scenes are built)
    hookClub();
    if (!wonkPending) return;
    wonkPending = false;
    const sc = game.scene.getScene("Club") as Phaser.Scene | null;
    if (!sc || !game.scene.isActive("Club") || !wonkLive()) return;
    // (the manager's own pause: at once, before this frame's update, so the Wonk-Off's clock never ticks under the card)
    game.scene.pause("Club");
    stats.wonkCards++;
    wonkAt.shown = performance.now();
    wonkAt.pausedUnder = game.scene.isPaused("Club");
    card?.remove();
    const host = document.querySelector(".kres")?.parentElement ?? document.body;
    card = readyCard("WONK-OFF", "Tap to start", () => {
      card = null;
      stats.wonkStarts++;
      wonkAt.started = performance.now();
      if (game.scene.isPaused("Club") && !game.scene.isActive("Menu")) game.scene.resume("Club");
    });
    host.appendChild(card);
  });
  const wonkRule: SceneRule = {
    name: "wonk-off",
    match: (k) => k === "Club",
    decide: () => (wonkLive() && !card ? { mode: "tap", live: true, pause: "menu", pauseButton: true, wonk: true } : null),
  };
  const at = SCENE_RULES.findIndex((r) => r.name === "walking");
  if (at >= 0) SCENE_RULES.splice(at, 0, wonkRule);
  else addSceneRule(wonkRule);

  return { stats, wonk: () => ({ live: wonkLive(), card: !!card, ...wonkAt }) };
}
