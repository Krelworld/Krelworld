// PHONE MODE: reading the running game from outside (no scene file is edited for this), and doing things to it the
// way the game's own inputs do (the TOUCH edges Controls already reads, or the pause menu the way scenes open it).
//
// Everything here is defensive: a field that has been renamed reads as "not busy / no prompt", which shows the plain
// walking controls rather than breaking anything.
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { G } from "../G";
import { isMikey, sanmikForced } from "../systems/sanmik";
import type { GameView, ModeDecision, SceneState } from "./modes";
import type { Rect } from "./layout";

type Bag = Record<string, unknown>;

const RUNNING = Phaser.Scenes.RUNNING;

/** A Text that is on screen (visible, in a live scene), or null. */
function liveText(o: unknown): Phaser.GameObjects.Text | null {
  const t = o as Phaser.GameObjects.Text | null | undefined;
  if (!t || typeof t !== "object" || !t.scene || !t.active || !t.visible || typeof t.text !== "string") return null;
  return t;
}

/** Scene-specific reads. Each returns the busy flag and where its interact prompt lives. */
const ADAPTERS: Record<string, (sc: Bag) => { busy: boolean; promptOwner: Bag; side?: boolean; sub?: SceneState["sub"] }> = {
  Home: (sc) => ({ busy: sc.busy === true, promptOwner: sc }),
  Hub: (sc) => ({ busy: sc.busy === true || sc.cutscene === true || !!sc.riseCut || !!sc.curtain || sc.leaving === true || !sc.av, promptOwner: sc }),
  Club: (sc) => ({ busy: sc.busy === true, promptOwner: sc }),
  Venue: (sc) => ({ busy: sc.busy === true, promptOwner: sc }),
  Kreddle: (sc) => {
    const raid = sc.raid as Bag | null | undefined;
    const rout = sc.rout as Bag | null | undefined;
    const sub = raid ? raid : rout ? rout : null;
    if (sub) return { busy: sub.busy === true, promptOwner: sub, sub: raid ? "raid" : "rout" };
    return { busy: sc.busy === true || !!sc.panelRoot, promptOwner: sc };
  },
  Dungeon: (sc) => ({ busy: false, promptOwner: sc, side: sc.side === true }),
};

/** What the layer needs to know about the game right now. Cheap: a handful of property reads. */
export function readView(game: Phaser.Game): GameView {
  const scenes: SceneState[] = [];
  const mgr = game.scene;
  for (const sc of mgr.scenes as Phaser.Scene[]) {
    if (sc.sys.settings.status !== RUNNING) continue;
    const key = sc.sys.settings.key;
    const ad = ADAPTERS[key];
    if (!ad) {
      scenes.push({ key });
      continue;
    }
    let st: SceneState = { key };
    try {
      const r = ad(sc as unknown as Bag);
      const pt = liveText(r.promptOwner.prompt);
      st = { key, busy: r.busy, prompt: pt ? pt.text : null, side: r.side, sub: r.sub ?? null };
    } catch {
      /* a scene mid-restart: read it as plain */
    }
    scenes.push(st);
  }
  let sanmikToggle = false;
  try {
    sanmikToggle = G.hasRun() && isMikey(G.s) && !sanmikForced(G.s);
  } catch {
    sanmikToggle = false;
  }
  return { scenes, sanmikToggle };
}

/**
 * Where the scene's prompt bubble is on the page (CSS px), so a tap on it can do the ACTION. Null when it isn't
 * showing.
 */
export function promptRect(game: Phaser.Game, d: ModeDecision): Rect | null {
  if (!d.scene || !d.action) return null;
  const sc = game.scene.getScene(d.scene) as unknown as Bag | null;
  if (!sc) return null;
  const owner = (d.scene === "Kreddle" ? ((sc.raid as Bag) ?? (sc.rout as Bag) ?? sc) : sc) as Bag;
  const t = liveText(owner.prompt);
  if (!t) return null;
  const cam = (t.scene as Phaser.Scene).cameras?.main;
  if (!cam) return null;
  const b = t.getBounds();
  const sfx = t.scrollFactorX ?? 1;
  const sfy = t.scrollFactorY ?? 1;
  const zoom = cam.zoom || 1;
  // world → camera → game screen (960x540), the same way Phaser draws it (zoom about the camera's middle)
  const gx = (b.x - cam.scrollX * sfx - cam.width / 2) * zoom + cam.x + cam.width / 2;
  const gy = (b.y - cam.scrollY * sfy - cam.height / 2) * zoom + cam.y + cam.height / 2;
  const cb = game.scale.canvasBounds;
  const k = cb.width / game.scale.width;
  const ky = cb.height / game.scale.height;
  if (!k || !ky) return null;
  return { x: cb.x + gx * k, y: cb.y + gy * ky, w: b.width * zoom * k, h: b.height * zoom * ky };
}

/** ACTION: the same edge the canvas pad's E button sends (Controls.interact() reads it on the scene's next frame). */
export function pressInteract() {
  TOUCH.edges.add("interact");
}

/** SANMIK: the same edge the canvas pad's SANMIK button sends (bindSanmikToggle reads it). */
export function pressSanmik() {
  TOUCH.edges.add("sanmik");
}

/**
 * Pause, the way this scene pauses. "edge": the scene's own Esc path (exactly what Esc does on a laptop).
 * "menu": the pause menu over the scene, opened the way Home and the town open it.
 */
export function pressPause(game: Phaser.Game, d: Pick<ModeDecision, "pause" | "scene">): boolean {
  if (!d.pause || !d.scene) return false;
  const mgr = game.scene;
  if (mgr.isActive("Menu") || mgr.isPaused("Menu")) return false;
  if (d.pause === "edge") {
    TOUCH.edges.add("pause");
    return true;
  }
  const sc = mgr.getScene(d.scene);
  if (!sc || !mgr.isActive(d.scene)) return false;
  sc.scene.launch("Menu", { mode: "pause", caller: d.scene });
  sc.scene.bringToTop("Menu");
  sc.scene.pause();
  return true;
}

/** An edge the layer set that no scene will read any more (the mode moved on): drop it so it can't fire later. */
export function dropEdges(...names: string[]) {
  for (const n of names) TOUCH.edges.delete(n);
}
