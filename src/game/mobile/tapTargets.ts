// PHONE MODE: tap a thing to use it (stage 3). What can be tapped in each walking scene, read from the live scene
// (no scene file is edited for this): its things and people, what the scene's prompt says when each is in reach,
// where the player stands to use it, the floor the player may walk on, and the colliders in the way.
//
// Everything is defensive, like observe.ts: a field that has been renamed reads as "nothing to tap here", which leaves
// the stage 1/2 controls (the stick, ACTION, the prompt bubble) working as before.
import type Phaser from "phaser";
import type { Rect } from "./layout";
import type { Pt } from "./tapLogic";
import { CHARACTERS } from "../../data/characters";

type Bag = Record<string, unknown>;

/** Something in a walking scene a tap can mean. World coordinates of the scene's main camera. */
export interface WorldTarget {
  /** Stable for this visit (the same thing gives the same key on the next read). */
  key: string;
  /** Does the scene's prompt (as the scene wrote it, before touch wording) say this thing is in reach? */
  is: (raw: string) => boolean;
  /** The prompt's own words for it, without the key ("Watch KrelTV"), for the little tag while walking there. */
  tag: string;
  /** The thing itself, roughly (its picture). */
  core: Rect;
  /** Where the player walks to (in the scene's player coordinates: the point its "in reach" distances use). */
  goal: Pt;
  /** A person who walks about: read again each frame (core and goal follow them). */
  moving?: boolean;
  /** Only when nothing else is under the tap (a follower right next to you). */
  low?: boolean;
  /** The scene's own object for it (a spot, an interactable, a person): the same thing on the next read. */
  src?: unknown;
}

/** One walking scene, read now. */
export interface WalkRead {
  key: string;
  /** The scene can be walked about in right now (not busy, no panel). */
  free: boolean;
  /** The player, in the scene's player coordinates. */
  me: Pt;
  /** Plan space = player coordinates + this (the physics body's middle in the town; zero elsewhere). */
  off: Pt;
  /** Where the walker's plan-space point may go. */
  area: Rect;
  /** Colliders (plan space, not grown), and the walker's half size to grow them by. */
  blockers: Rect[];
  half: { w: number; h: number };
  /** The scene's prompt as it wrote it (null when none shows). */
  prompt: string | null;
  targets: WorldTarget[];
}

const KEY = /^\s*(?:\[\s*E\s*\]|E)(?:\s*\/\s*[A-Z][A-Z ]*)?\s*:\s*/;

/** A prompt's words for the tag: the key taken off, the first line only. */
export function tagOf(raw: string): string {
  return String(raw ?? "").replace(KEY, "").split("\n")[0].trim();
}

function rawPrompt(owner: Bag): string | null {
  const t = owner.prompt as (Phaser.GameObjects.Text & { __krelRaw?: string }) | undefined;
  if (!t || typeof t !== "object" || !t.active || !t.visible || typeof t.text !== "string") return null;
  return typeof t.__krelRaw === "string" ? t.__krelRaw : t.text;
}

type Spr = { x: number; y: number; active?: boolean; visible?: boolean; getBounds?: () => { x: number; y: number; width: number; height: number } };

function bounds(o: Spr | null | undefined): Rect | null {
  if (!o || typeof o.getBounds !== "function" || o.active === false || o.visible === false) return null;
  const b = o.getBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** A thing standing on its spot (x, y) with reach r: a box above the spot, about its size. */
export function spotBox(x: number, y: number, r: number): Rect {
  const w = Math.min(140, Math.max(44, r * 1.2));
  const h = Math.min(180, Math.max(56, r * 1.6));
  return { x: x - w / 2, y: y - h * 0.85, w, h };
}

/** The first image or sprite in the scene showing this texture (top level), on screen. */
function imageOf(sc: Bag, tex: string): Rect | null {
  const list = ((sc.children as Bag | undefined)?.list as unknown[] | undefined) ?? [];
  for (const o of list) {
    const im = o as Spr & { texture?: { key?: string }; type?: string };
    if ((im.type === "Image" || im.type === "Sprite") && im.texture?.key === tex) {
      const b = bounds(im);
      if (b) return b;
    }
  }
  return null;
}

/** Every image or sprite whose texture starts with `prefix` (a row of slot machines), as one rectangle. */
function imagesOf(sc: Bag, prefix: string): Rect | null {
  const list = ((sc.children as Bag | undefined)?.list as unknown[] | undefined) ?? [];
  let u: Rect | null = null;
  for (const o of list) {
    const im = o as Spr & { texture?: { key?: string }; type?: string };
    if ((im.type !== "Image" && im.type !== "Sprite") || !im.texture?.key?.startsWith(prefix)) continue;
    const b = bounds(im);
    if (b) u = u ? union(u, b) : b;
  }
  return u;
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/**
 * The town's things: a building is used at its door, but the whole building can be tapped (its collider, the one
 * whose bottom edge is just above the door's spot), and the same for a vending machine, the Tap, a plaque.
 */
export function standsOn(x: number, y: number, colliders: readonly Rect[], gap = 60): Rect | null {
  let best: Rect | null = null;
  let bd = Infinity;
  for (const c of colliders) {
    if (x < c.x || x > c.x + c.w) continue;
    const d = y - (c.y + c.h);
    if (d >= -4 && d <= gap && d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

const clampTo = (p: Pt, a: Rect): Pt => ({ x: Math.min(a.x + a.w, Math.max(a.x, p.x)), y: Math.min(a.y + a.h, Math.max(a.y, p.y)) });

// ------------------------------------------------------------------ Home

/** Home's things: the picture each spot is about (by the spot's words), else a box drawn from the room's art. */
const HOME_PICTURES: readonly [RegExp, string | Rect][] = [
  [/KrelTV/, "p_tv"],
  [/games console/, "p_console"],
  [/trophy shelf/, "p_trophyshelf"],
  [/laptop/, "p_laptop"],
  [/^E: Sleep\b/, "p_bed"],
  [/Gun rack/, "p_gunrack"],
  [/Jukebox/, "p_jukebox"],
  [/Dark Autism/, "p_dark_autism"],
  [/the fish$/, "d_fish"],
  [/Crobley statue/, "d_statue"],
  [/slot machine/, "d_slot"],
  [/gold toilet/, "d_toilet"],
  // (drawn in the backdrop, or as shapes: the window, the door out, the poster over the backdrop's own)
  [/out of (?:the|where the) window/, { x: 308, y: 79, w: 225, h: 217 }],
  [/^E: (?:Go outside|Climb back out)/, { x: 718, y: 60, w: 74, h: 395 }],
  [/^E: Look at the poster$/, { x: 581, y: 106, w: 104, h: 154 }],
];

/** Home's walkable floor (HomeScene: x 40..920, y TOP 455..BOTTOM 536). */
const HOME_AREA: Rect = { x: 40, y: 455, w: 880, h: 81 };

function readHome(sc: Bag): WalkRead | null {
  const me = sc.me as Spr | undefined;
  const spots = sc.spots as { x: number; y: number; r: number; label: string }[] | undefined;
  if (!me || !Array.isArray(spots)) return null;
  const targets: WorldTarget[] = [];
  spots.forEach((sp, i) => {
    if (typeof sp.label !== "string") return;
    let core: Rect | null = null;
    for (const [re, pic] of HOME_PICTURES) {
      if (!re.test(sp.label)) continue;
      core = typeof pic === "string" ? imageOf(sc, pic) : pic;
      break;
    }
    const label = sp.label;
    targets.push({ src: sp, key: `spot:${i}:${label}`, is: (raw) => raw === label, tag: tagOf(label), core: core ?? spotBox(sp.x, sp.y, sp.r), goal: clampTo({ x: sp.x, y: sp.y }, HOME_AREA) });
  });
  return { key: "Home", free: sc.busy !== true, me: { x: me.x, y: me.y }, off: { x: 0, y: 0 }, area: HOME_AREA, blockers: [], half: { w: 0, h: 0 }, prompt: rawPrompt(sc), targets };
}

// ------------------------------------------------------------------ the town

interface HubIt {
  x: number;
  y: number;
  r: number;
  label: () => string;
  enabled?: () => boolean;
  __npc?: { follower?: unknown; spr?: Spr };
  __throw?: unknown;
}

function readHub(sc: Bag): WalkRead | null {
  const av = sc.av as (Spr & { body?: { center: Pt; width: number; height: number } }) | undefined;
  const list = sc.interactables as HubIt[] | undefined;
  if (!av || !av.body || !Array.isArray(list)) return null;
  const busy = sc.busy === true || sc.cutscene === true || !!sc.riseCut || !!sc.curtain || sc.leaving === true || (sc.brawl as Bag | null | undefined)?.running === true;
  const body = av.body;
  const off = { x: body.center.x - av.x, y: body.center.y - av.y };
  const half = { w: body.width / 2 + 2, h: body.height / 2 + 2 };
  const wb = ((sc.physics as Bag | undefined)?.world as Bag | undefined)?.bounds as { x: number; y: number; width: number; height: number } | undefined;
  const W = wb ? { x: wb.x, y: wb.y, w: wb.width, h: wb.height } : { x: 0, y: 0, w: 2560, h: 1792 };
  const area = { x: W.x + half.w, y: W.y + half.h, w: W.w - 2 * half.w, h: W.h - 2 * half.h };
  const blockers: Rect[] = [];
  const group = sc.colliders as { getChildren?: () => unknown[] } | undefined;
  const kids = (group?.getChildren?.() ?? []) as { body?: { x: number; y: number; width: number; height: number; enable?: boolean } }[];
  for (const k of kids) {
    const b = k.body;
    if (b && b.enable !== false) blockers.push({ x: b.x, y: b.y, w: b.width, h: b.height });
  }
  const targets: WorldTarget[] = [];
  const me = { x: av.x, y: av.y };
  list.forEach((it, i) => {
    if (it.__throw) return void throwTarget(it, me, targets);
    if (it.x < -1000) return;
    try {
      if (typeof it.enabled === "function" && !it.enabled()) return;
      const label = `E: ${it.label()}`;
      const npc = it.__npc;
      const box = spotBox(it.x, it.y, Math.min(it.r, 80));
      const on = npc ? null : standsOn(it.x, it.y, blockers);
      const pic = npc?.spr ? bounds(npc.spr) : on ? union(box, on) : null;
      targets.push({
        src: it,
        key: npc ? `npc:${i}` : `it:${i}:${Math.round(it.x)},${Math.round(it.y)}`,
        // (a person's or a door's words can change as you walk there: "Talk to X" stays "Talk to X"; match the start)
        is: (raw) => raw === label || raw === `E: ${it.label()}`,
        tag: tagOf(label),
        core: pic ?? box,
        goal: { x: it.x, y: it.y },
        moving: !!npc,
        low: !!npc?.follower,
      });
    } catch {
      /* a label that can't be read right now: not tappable this frame */
    }
  });
  return { key: "Hub", free: !busy, me: { x: av.x, y: av.y }, off, area, blockers, half, prompt: rawPrompt(sc), targets };
}

/** The playground (HubScene's PLAYGROUND) and how near you must stand to throw over its fence (150; 40 is too near). */
const PLAYGROUND: Rect = { x: 120, y: 480, w: 360, h: 190 };
const THROW_FROM = 100;

/**
 * The side quest's "throw a sweetie over the fence": the scene's prompt for it follows the player around the
 * playground. Tap the playground: walk to the fence (outside it, where the kids don't see you) and throw.
 */
function throwTarget(it: HubIt, me: Pt, out: WorldTarget[]) {
  try {
    if (typeof it.enabled === "function" && !it.enabled()) return;
    const P = PLAYGROUND;
    const ring = { x: P.x - THROW_FROM, y: P.y - THROW_FROM, w: P.w + 2 * THROW_FROM, h: P.h + 2 * THROW_FROM };
    // (where you are if you're already near enough, else the nearest point of that ring)
    const goal = clampTo(me, ring);
    out.push({ src: it, key: "throw", is: (raw) => raw.startsWith("E: 🍬 Throw a sweetie"), tag: tagOf(`E: ${it.label()}`), core: { ...P }, goal });
  } catch {
    /* skip */
  }
}

// ------------------------------------------------------------------ Kreddle

/** Kreddle's machines and counters: the pictures each spot is about (by its words). */
const KREDDLE_PICTURES: readonly [RegExp, string][] = [
  [/KREDDLE EXCHANGE/, "kd_exchange"],
  [/KRAZY REELS/, "kd_m_slots"],
  [/THE KLAW/, "kd_m_claw"],
  [/WHEEL OF KREDDLE/, "kd_m_wheel"],
  [/WHACK-A-DRONGUS/, "kd_m_whack"],
  [/KREDDLE KARDS/, "kd_m_cards"],
];

/** Kreddle's floor (KreddleScene: x 30..W-30, y TOP 430..BOTTOM 680; W 2600). */
const KREDDLE_AREA: Rect = { x: 30, y: 430, w: 2540, h: 250 };

function readKreddle(sc: Bag): WalkRead | null {
  if (sc.raid || sc.rout) return null;
  const me = sc.me as Spr | undefined;
  const spots = sc.spots as { x: number; y: number; r: number; label: () => string }[] | undefined;
  const npcs = sc.npcs as { spr: Spr; name: string; kind: string }[] | undefined;
  if (!me || !Array.isArray(spots)) return null;
  const targets: WorldTarget[] = [];
  spots.forEach((sp, i) => {
    try {
      const label = sp.label();
      const pic = KREDDLE_PICTURES.find(([re]) => re.test(label));
      const core = (pic && imagesOf(sc, pic[1])) || spotBox(sp.x, sp.y, Math.min(sp.r, 90));
      targets.push({ src: sp, key: `spot:${i}`, is: (raw) => raw === sp.label(), tag: tagOf(label), core, goal: clampTo({ x: sp.x, y: sp.y }, KREDDLE_AREA) });
    } catch {
      /* skip */
    }
  });
  (npcs ?? []).forEach((n, i) => {
    // (the Kards dealer just deals: standing at his table means the game, as the scene has it)
    if (n.kind === "dealer" || !n.spr) return;
    const pic = bounds(n.spr);
    if (!pic) return;
    const label = `E: Talk to ${n.name}`;
    // (a machine in reach always wins over a chat, as the scene has it: stand beside them, clear of every machine)
    const goal = besideClear({ x: n.spr.x, y: n.spr.y }, { x: me.x, y: me.y }, spots, KREDDLE_AREA);
    targets.push({ src: n, key: `npc:${i}`, is: (raw) => raw === label, tag: tagOf(label), core: pic, goal, moving: true });
  });
  return { key: "Kreddle", free: sc.busy !== true && !sc.panelRoot, me: { x: me.x, y: me.y }, off: { x: 0, y: 0 }, area: KREDDLE_AREA, blockers: [], half: { w: 0, h: 0 }, prompt: rawPrompt(sc), targets };
}

/**
 * Where to stand to talk to someone (within `near` of them, the scene's 60) outside every spot's reach, nearest the
 * player; their own place if nowhere is clear.
 */
export function besideClear(who: Pt, me: Pt, spots: readonly { x: number; y: number; r: number }[], area: Rect, near = 44): Pt {
  const clear = (p: Pt) => spots.every((sp) => Math.hypot(sp.x - p.x, sp.y - p.y) >= sp.r + 2);
  const at = clampTo(who, area);
  if (clear(at)) return at;
  let best: Pt | null = null;
  let bd = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const p = clampTo({ x: who.x + Math.cos(a) * near, y: who.y + Math.sin(a) * near }, area);
    if (Math.hypot(p.x - who.x, p.y - who.y) > 58 || !clear(p)) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best ?? at;
}

// ------------------------------------------------------------------ the Club (the Wonky Pole)

/** The Club's floor (ClubScene: x 40..920, y 380..520). */
const CLUB_AREA: Rect = { x: 40, y: 380, w: 880, h: 140 };
const POLE_X = 470;

const call = <T>(sc: Bag, name: string, fallback: T): T => {
  const f = sc[name];
  try {
    return typeof f === "function" ? (f.call(sc) as T) : fallback;
  } catch {
    return fallback;
  }
};

function readClub(sc: Bag): WalkRead | null {
  const me = sc.me as Spr | undefined;
  if (!me) return null;
  const targets: WorldTarget[] = [];
  const onBreak = sc.onBreak === true;
  const dancerDown = sc.dancerDown === true;
  const dancer = call(sc, "dancerName", "the dancer");
  const zone = (key: string, re: RegExp, words: string, core: Rect, goal: Pt) => targets.push({ key, is: (raw) => re.test(raw), tag: words, core, goal: clampTo(goal, CLUB_AREA) });
  // the places, as the scene's own zones have them (the stage, the bar, the wonk-off table, the exit, the booth)
  if (!onBreak && !dancerDown) zone("stage", /^E: Tip /, `Tip ${dancer} (5 Krezzcoin)`, bounds(sc.dancer as Spr) ?? { x: 380, y: 240, w: 180, h: 140 }, { x: POLE_X, y: 405 });
  zone("bar", /^E: Order a Pussy Juice/, "Order a Pussy Juice (10 Krezzcoin)", { x: 780, y: 150, w: 180, h: 260 }, { x: 860, y: 412 });
  zone("table", /^(?:E: Call a WONK-OFF|Nobody will wonk-off|Big Derek is right there)/, "Call a WONK-OFF", { x: 0, y: 220, w: 150, h: 200 }, { x: 85, y: 440 });
  zone("exit", /^E: Leave$/, "Leave", { x: 410, y: 492, w: 140, h: 48 }, { x: 480, y: 515 });
  if (!onBreak && !dancerDown && call(sc, "goldenOpen", false)) zone("booth", /^E: Private dance/, `Private dance with ${dancer} (25 Krezzcoin)`, { x: 800, y: 420, w: 160, h: 110 }, { x: 870, y: 495 });
  // a pickup lying about (a token, a clue)
  const tok = sc.token as { img?: Spr; x: number; y: number } | null | undefined;
  if (tok?.img?.active) {
    const label = call(sc, "tokenLabel", "");
    targets.push({ key: "token", is: (raw) => !!label && raw === label, tag: tagOf(label), core: bounds(tok.img) ?? spotBox(tok.x, tok.y, 30), goal: clampTo({ x: tok.x, y: tok.y + 20 }, CLUB_AREA) });
  }
  // Alistair Swamp, pestering the dancer
  const ally = sc.ally as Spr | null | undefined;
  if (ally?.visible && ally.active !== false) {
    const pic = bounds(ally);
    if (pic) targets.push({ key: "ally", is: (raw) => raw === "E: Confront Alistair Swamp", tag: "Confront Alistair Swamp", core: pic, goal: clampTo({ x: ally.x, y: ally.y }, CLUB_AREA), moving: true });
  }
  // the people you can swing at (as the scene's nearestTarget() lists them: the lads, the band, Big Derek; the dancer
  // is the stage)
  const ko = sc.ko as Set<unknown> | undefined;
  const people: { name: string; spr: Spr }[] = [];
  for (const p of (sc.patrons as { id: string; spr: Spr }[] | undefined) ?? []) people.push({ name: CHARACTERS[p.id]?.name ?? p.id, spr: p.spr });
  for (const b of (sc.band as { name: string; spr: Spr }[] | undefined) ?? []) people.push({ name: b.name, spr: b.spr });
  const dk = sc.derek as { spr: Spr; down?: boolean } | null | undefined;
  if (dk && !dk.down) people.push({ name: "BIG DEREK", spr: dk.spr });
  people.forEach((p, i) => {
    if (!p.spr || ko?.has(p.spr)) return;
    const pic = bounds(p.spr);
    if (!pic) return;
    const label = `E / ATTACK: hit ${p.name}`;
    targets.push({ src: p.spr, key: `who:${i}`, is: (raw) => raw === label, tag: tagOf(label), core: pic, goal: clampTo({ x: p.spr.x, y: p.spr.y }, CLUB_AREA), moving: true });
  });
  return { key: "Club", free: sc.busy !== true, me: { x: me.x, y: me.y }, off: { x: 0, y: 0 }, area: CLUB_AREA, blockers: [], half: { w: 0, h: 0 }, prompt: rawPrompt(sc), targets };
}

// ------------------------------------------------------------------ the Venue (the back room)

/** The Venue's floor (VenueScene: x 40..920, y 250..520). */
const VENUE_AREA: Rect = { x: 40, y: 250, w: 880, h: 270 };

function readVenue(sc: Bag): WalkRead | null {
  const me = sc.me as Spr | undefined;
  if (!me) return null;
  const targets: WorldTarget[] = [];
  ((sc.performers as { spr: Spr; name: string; hits: number }[] | undefined) ?? []).forEach((p, i) => {
    if (!p.spr || p.hits >= 4) return;
    const pic = bounds(p.spr);
    if (!pic) return;
    const label = `E / ATTACK: hit ${p.name}`;
    targets.push({ src: p, key: `who:${i}`, is: (raw) => raw === label, tag: tagOf(label), core: pic, goal: clampTo({ x: p.spr.x, y: p.spr.y }, VENUE_AREA), moving: true });
  });
  targets.push({ key: "exit", is: (raw) => raw === "E: Leave the back room", tag: "Leave the back room", core: { x: 410, y: 492, w: 140, h: 48 }, goal: { x: 480, y: 515 } });
  return { key: "Venue", free: sc.busy !== true, me: { x: me.x, y: me.y }, off: { x: 0, y: 0 }, area: VENUE_AREA, blockers: [], half: { w: 0, h: 0 }, prompt: rawPrompt(sc), targets };
}

// ------------------------------------------------------------------

export const TAP_SCENES: Readonly<Record<string, (sc: Bag) => WalkRead | null>> = { Home: readHome, Hub: readHub, Kreddle: readKreddle, Club: readClub, Venue: readVenue };

/** The walking scene `key`, read now (null: not one, not running, or nothing to read). */
export function readWalk(game: Phaser.Game, key: string | null | undefined): WalkRead | null {
  if (!key) return null;
  const f = TAP_SCENES[key];
  if (!f) return null;
  try {
    if (!game.scene.isActive(key)) return null;
    return f(game.scene.getScene(key) as unknown as Bag);
  } catch {
    return null;
  }
}

/** Cheap, every frame: is `key` a scene where taps walk and use (not Kreddle's raid or rout, which are fights)? */
export function tapScene(game: Phaser.Game, key: string | null | undefined): boolean {
  if (!key || !TAP_SCENES[key]) return false;
  try {
    if (!game.scene.isActive(key)) return false;
    const sc = game.scene.getScene(key) as unknown as Bag;
    return !(key === "Kreddle" && (sc.raid || sc.rout));
  } catch {
    return false;
  }
}

/**
 * What the prompt is about, for the layer (stage 1's P5: the thing it is about is see-through under the controls):
 * the target the prompt names that is nearest the player. Covers the Club, the Venue and Kreddle's people too.
 */
export function promptThing(game: Phaser.Game, key: string | null | undefined): { x: number; y: number; r: number } | null {
  const w = readWalk(game, key);
  if (!w || !w.prompt) return null;
  let best: WorldTarget | null = null;
  let bd = Infinity;
  for (const t of w.targets) {
    if (!t.is(w.prompt)) continue;
    const d = Math.hypot(t.goal.x - w.me.x, t.goal.y - w.me.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  if (!best) return null;
  const c = best.core;
  return { x: c.x + c.w / 2, y: c.y + c.h, r: Math.max(c.w, c.h) / 2 };
}
