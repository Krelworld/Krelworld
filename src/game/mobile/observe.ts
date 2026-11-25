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
import { currentInputSource } from "./modes";
import type { Rect } from "./layout";
import { rawText } from "./wording";
import { promptThing } from "./tapTargets";

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
  Hub: (sc) => ({
    busy: sc.busy === true || sc.cutscene === true || !!sc.riseCut || !!sc.curtain || sc.leaving === true || !sc.av,
    promptOwner: sc,
    // the shoving match on the bridge: only E (ACTION) shoves, and no prompt says so
    sub: (sc.brawl as Bag | null | undefined)?.running === true ? "shove" : null,
  }),
  Club: (sc) => ({ busy: sc.busy === true, promptOwner: sc }),
  Venue: (sc) => ({ busy: sc.busy === true, promptOwner: sc }),
  Kreddle: (sc) => {
    const raid = sc.raid as Bag | null | undefined;
    const rout = sc.rout as Bag | null | undefined;
    const sub = raid ? raid : rout ? rout : null;
    if (sub) return { busy: sub.busy === true, promptOwner: sub, sub: raid ? "raid" : "rout" };
    return { busy: sc.busy === true || !!sc.panelRoot, promptOwner: sc };
  },
  // (stage 2: busy covers the room's scripted moments, dying and moving rooms; "mash" a tap-anywhere mash overlay)
  Dungeon: (sc) => ({
    busy: sc.busy === true || sc.dying === true || sc.transitioning === true || !sc.player,
    promptOwner: sc,
    side: sc.side === true,
    sub: mashOverlay(sc) ? "mash" : null,
  }),
};

/**
 * A fight's tap-anywhere mash overlay is up (the WONK YOUR THANG gauge, the roof's group wonk): an interactive
 * rectangle over the whole screen in the Dungeon (nothing else in a fight is one). A few objects to look at: only the
 * scene's interactive ones.
 */
export function mashOverlay(sc: Bag): boolean {
  const list = ((sc.input as Bag | undefined)?._list as unknown[] | undefined) ?? [];
  for (const o of list) {
    const r = o as { active?: boolean; visible?: boolean; width?: number; height?: number; parentContainer?: { visible?: boolean; active?: boolean } | null; input?: { enabled?: boolean } };
    if (!r || !r.active || r.visible === false || !r.input?.enabled) continue;
    if ((r.width ?? 0) >= 940 && (r.height ?? 0) >= 520 && r.parentContainer?.visible !== false && r.parentContainer?.active !== false) return true;
  }
  return false;
}

/** What the layer needs to know about the game right now. Cheap: a handful of property reads. */
export function readView(game: Phaser.Game): GameView {
  const scenes: SceneState[] = [];
  const input = currentInputSource();
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
      // (the prompt as the scene wrote it: on a phone it is shown in touch wording, "Tap: ..." instead of "E: ...")
      st = { key, busy: r.busy, prompt: pt ? rawText(pt as Phaser.GameObjects.Text & { __krelRaw?: string }) : null, side: r.side, sub: r.sub ?? null };
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
  return input === "pad" ? { scenes, sanmikToggle, input } : { scenes, sanmikToggle };
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

/** Something the player can use, in world coordinates, with how near they must be. */
interface Usable {
  x: number;
  y: number;
  r: number;
  enabled?: () => boolean;
  __npc?: { follower?: unknown; spr?: { x: number; y: number } };
  /** (phones: a follower's "Shove" ranked last, see rankFollowerLast) */
  __krelLast?: boolean;
}

/** The nearest usable thing in range of (px, py), the way the scene picks it (null if none). */
function nearest(list: Usable[] | undefined, px: number, py: number, skip?: (u: Usable) => boolean): Usable | null {
  let best: Usable | null = null;
  let bd = Infinity;
  for (const u of list ?? []) {
    if (skip?.(u)) continue;
    if (typeof u.enabled === "function" && !u.enabled()) continue;
    const d = Math.hypot(u.x - px, u.y - py);
    if (d < u.r && d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

/** What the prompt is about, in the scene's world (Home's spots, the town's interactables, Kreddle's spots), or null. */
function promptTarget(game: Phaser.Game, key: string, sc: Bag): { x: number; y: number; r: number } | null {
  if (key === "Home") {
    const me = sc.me as { x: number; y: number } | undefined;
    return me ? nearest(sc.spots as Usable[], me.x, me.y) : null;
  }
  if (key === "Hub") {
    const av = sc.av as { x: number; y: number } | undefined;
    return av ? nearest(sc.interactables as Usable[], av.x, av.y) : null;
  }
  if (key === "Kreddle" && !sc.raid && !sc.rout) {
    const me = sc.me as { x: number; y: number } | undefined;
    const spot = me ? nearest(sc.spots as Usable[], me.x, me.y) : null;
    if (spot) return spot;
  }
  // (stage 3: the Club's places and people, the Venue's, Kreddle's locals: the thing the prompt names, from tap to use)
  if ((key === "Club" || key === "Venue" || key === "Kreddle") && !sc.raid && !sc.rout) return promptThing(game, key);
  return null;
}

/** World → page (CSS px) through a scene's main camera, the way Phaser draws it (zoom about the camera's middle). */
function toPage(game: Phaser.Game, sc: Phaser.Scene, x: number, y: number, sf = 1): { x: number; y: number; k: number } | null {
  const cam = sc.cameras?.main;
  if (!cam) return null;
  const zoom = cam.zoom || 1;
  const gx = (x - cam.scrollX * sf - cam.width / 2) * zoom + cam.x + cam.width / 2;
  const gy = (y - cam.scrollY * sf - cam.height / 2) * zoom + cam.y + cam.height / 2;
  const cb = game.scale.canvasBounds;
  const k = cb.width / game.scale.width;
  if (!k) return null;
  return { x: cb.x + gx * k, y: cb.y + gy * k, k: k * zoom };
}

/**
 * The thing the prompt is about, on the page (CSS px). `tap`: where tapping it uses it: around its spot, reaching
 * further up than down (things stand on their spot: the TV, the console, a door, a person). `core`: the thing itself,
 * roughly (controls over it go see-through). Null when the scene has no prompt target the layer can read.
 */
export function targetRect(game: Phaser.Game, d: ModeDecision): { tap: Rect; core: Rect } | null {
  if (d.mode !== "walk" || !d.scene || !d.action || d.action === "SHOVE") return null;
  const sc = game.scene.getScene(d.scene) as unknown as Bag | null;
  if (!sc) return null;
  const t = promptTarget(game, d.scene, sc);
  if (!t) return null;
  const p = toPage(game, sc as unknown as Phaser.Scene, t.x, t.y);
  if (!p) return null;
  const R = Math.min(90, Math.max(40, t.r)) * p.k;
  return { tap: { x: p.x - R, y: p.y - 2.2 * R, w: 2 * R, h: 3.2 * R }, core: { x: p.x - R / 2, y: p.y - R, w: R, h: R * 1.2 } };
}

/** The player's figure on the page (CSS px), for keeping ACTION off it. Null when the scene has no player to read. */
export function playerRect(game: Phaser.Game, d: Pick<ModeDecision, "scene" | "mode">): Rect | null {
  if (d.mode !== "walk" || !d.scene) return null;
  const sc = game.scene.getScene(d.scene) as unknown as Bag | null;
  if (!sc) return null;
  const owner = (d.scene === "Kreddle" ? ((sc.raid as Bag) ?? (sc.rout as Bag) ?? sc) : sc) as Bag;
  const who = (owner.me ?? owner.av ?? sc.me ?? sc.av) as (Phaser.GameObjects.Components.GetBounds & { active?: boolean; visible?: boolean }) | undefined;
  if (!who || typeof who.getBounds !== "function" || who.visible === false) return null;
  const b = who.getBounds();
  const a = toPage(game, sc as unknown as Phaser.Scene, b.x, b.y);
  const z = toPage(game, sc as unknown as Phaser.Scene, b.right, b.bottom);
  if (!a || !z) return null;
  return { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
}

/**
 * Hub, phones: with Mikey (or Polson) following, "Shove Mikey" never outranks a door, a person or a thing in range
 * (he catches up whenever you stop, and the phone has one ACTION button). It is still there when nothing else is.
 * Wraps the follower's own `enabled` once; the scene's list and everything else in it are left as they are.
 */
export function rankFollowerLast(game: Phaser.Game) {
  let sc: Bag | null = null;
  try {
    if (!game.scene.isActive("Hub")) return;
    sc = game.scene.getScene("Hub") as unknown as Bag;
  } catch {
    return;
  }
  const list = sc?.interactables as Usable[] | undefined;
  if (!Array.isArray(list)) return;
  for (const it of list) {
    if (it.__krelLast || !it.__npc?.follower) continue;
    it.__krelLast = true;
    const own = it.enabled;
    const hub = sc as Bag;
    it.enabled = () => {
      if (typeof own === "function" && !own.call(it)) return false;
      const av = hub.av as { x: number; y: number } | undefined;
      if (!av) return true;
      return !nearest(hub.interactables as Usable[], av.x, av.y, (u) => u === it || !!u.__krelLast);
    };
  }
}

/**
 * The old canvas pad (the dungeon, stage 1) lets go: its stick, ATTACK and held buttons, as if every finger had
 * lifted. For the page hiding, rotating or losing focus without a touchcancel.
 */
export function releaseLegacyPad(game: Phaser.Game) {
  TOUCH.mx = 0;
  TOUCH.my = 0;
  TOUCH.attack = false;
  TOUCH.held.clear();
  try {
    const pad = (game.scene.getScene("UI") as unknown as Bag | null)?.touch as Bag | null | undefined;
    if (!pad) return;
    pad.stickId = null;
    const base = pad.base as { x: number; y: number } | undefined;
    const knob = pad.knob as { setPosition?: (x: number, y: number) => void } | undefined;
    if (base && knob?.setPosition) knob.setPosition(base.x, base.y);
  } catch {
    /* no pad */
  }
}

/** ACTION: the same edge the canvas pad's E button sends (Controls.interact() reads it on the scene's next frame). */
export function pressInteract() {
  TOUCH.edges.add("interact");
}

/** SANMIK: the same edge the canvas pad's SANMIK button sends (bindSanmikToggle reads it). */
export function pressSanmik() {
  TOUCH.edges.add("sanmik");
}

/** The shell's PAUSED card (index.ts sets it; "card" pauses go through it). True when it opened. */
let cardPause: (() => boolean) | null = null;
export function setCardPause(fn: (() => boolean) | null) {
  cardPause = fn;
}

/**
 * Pause, the way this scene pauses. "edge": the scene's own Esc path (exactly what Esc does on a laptop).
 * "menu": the pause menu over the scene, opened the way Home and the town open it. "card": the shell's PAUSED card.
 */
export function pressPause(game: Phaser.Game, d: Pick<ModeDecision, "pause" | "scene">): boolean {
  if (!d.pause || !d.scene) return false;
  const mgr = game.scene;
  if (mgr.isActive("Menu") || mgr.isPaused("Menu")) return false;
  if (d.pause === "card") return cardPause?.() ?? false;
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
