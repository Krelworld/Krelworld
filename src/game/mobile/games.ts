// PHONE MODE, stage 3 wave 2: every minigame playable, and fun, by touch (phones only; a laptop never loads this).
//
// The minigames already took taps (MinigameScene's mashers take a tap anywhere, the phones / rows / problems take a
// tap on themselves). What a phone needed, per game (README "Minigames by touch"):
//   - BULLY / DEADLIFT / the vignettes' mashes: every finger anywhere is a hit (spare touch pointers, index.ts), so two
//     thumbs drum; the how-to line in touch words.
//   - FLIP IT: each problem's tap area is the ring drawn round it (about 58 CSS px), not its 40 px picture.
//   - RUNESCAPE: CHOP under the right thumb (the laptop's SPACE: walk to the nearest tree and chop; when the ring
//     closes, CHOP is the timed hit, glowing gold), DROP ALL and the re-up pop in beside it only when they'd do
//     something; the Log out button lifted out of the home-indicator strip.
//   - THE CROCODILE: its three pads lifted out of the home-indicator strip, each one's touch area the whole column under
//     the note lane (left third LEFT, middle CHOMP, right third RIGHT: one per thumb, either thumb for CHOMP), the
//     score line moved up under the lane; taps judged with the phone's sound delay taken off (rhythmLag).
//   - BURPEES: a tap anywhere is the right move (the game's own SPACE), ▼ / ▲ stay under the thumbs; the same lag.
//   - Every minigame's own top-right button ([ LEAVE ], [ END GIG ]) moved out from under the II.
//   - WHACK: its PLAY / BACK buttons lifted out of the home-indicator strip.
//   - The squeeze (systems/squeeze.ts, a guarded hook): a tap anywhere squeezes, the circle says TAP.
//   - The Wonky Pole's UP CLOSE button bigger; its close-up's and the raid's cut-in's skip lines in touch words.
import Phaser from "phaser";
import { addSceneRule } from "./modes";
import { registerModeController, type TouchControl, type TouchLayer } from "./touchLayer";
import { STORY_UI_LINES, UI_TEXTS, addWording } from "./wording";
import { liveScene } from "./listScenes";
import { phoneSettings } from "./settings";
import { phoneHooks, setPhoneHooks } from "./boot";
import { GAME_STORY_LINES, GAME_UI_TEXTS, GAME_WORDING, clearOfPause, crocColumn, liftOutOfStrip, rhythmLag, rsButtons, rsWord, type RsState } from "./gamesLogic";
import { synth } from "../audio/Synth";

type Bag = Record<string, any>;

interface PhoneRs {
  chop(): void;
  dropAll(): void;
  reup(): void;
  quit(): void;
  word?: string;
  state(): RsState;
}

export const GAMES_CSS = `
.kt-g .kt-face{font:900 13px/1.05 Impact,system-ui,sans-serif;letter-spacing:.6px;color:#fff;text-shadow:0 1px 2px #000;
  border-color:rgba(255,224,102,calc(var(--kt-a) + .35))}
.kt-g-chop .kt-face{font-size:17px;border-width:3px}
.kt-g-chop.hot .kt-face{background:rgba(202,138,4,.55);border-color:#fde047;box-shadow:0 0 0 3px rgba(0,0,0,.45),0 0 18px rgba(253,224,71,.8);
  animation:ktGHot .28s ease-in-out infinite alternate}
.kt-g-drop .kt-face{border-color:rgba(251,146,60,calc(var(--kt-a) + .35))}
.kt-g-reup .kt-face{border-color:rgba(134,239,172,calc(var(--kt-a) + .35))}
@keyframes ktGHot{from{transform:scale(1)}to{transform:scale(1.07)}}
`;

/** What the phone did to a minigame (for the smoke test and ?mobilediag). */
export interface GamesState {
  game: string | null;
  fixed: string[];
  buttons: string[];
  lag: number;
  presses: Record<string, number>;
}

export class PhoneGames {
  private c: Record<string, TouchControl> = {};
  readonly state: GamesState = { game: null, fixed: [], buttons: [], lag: 0, presses: {} };

  constructor(
    readonly game: Phaser.Game,
    readonly layer: TouchLayer,
  ) {}

  /** The minigame scene running now, with its mode, or null. */
  minigame(): Bag | null {
    return liveScene(this.game, "Minigame");
  }

  /** The seconds a rhythm tap's judged time is moved by (rhythmLag; read at each tap). */
  lag(): number {
    const ctx = (synth as unknown as { ctx?: AudioContext | null }).ctx ?? null;
    const v = rhythmLag(ctx as { baseLatency?: number; outputLatency?: number } | null, phoneSettings().syncOffsetMs);
    this.state.lag = v;
    return v;
  }

  // ------------------------------------------------------------------ the thumb buttons (RuneScape)

  private press(id: string) {
    this.state.presses[id] = (this.state.presses[id] ?? 0) + 1;
  }

  private build() {
    if (this.c.chop) return;
    const L = this.layer;
    const rs = () => (this.minigame()?.phoneRs as PhoneRs | undefined) ?? null;
    this.c.chop = L.addControl({
      id: "g-chop",
      slot: "prime",
      toCorner: true,
      group: "games",
      className: "kt-c kt-g kt-g-chop",
      label: "CHOP",
      haptic: "tap",
      onDown: () => {
        this.press("chop");
        rs()?.chop();
      },
    });
    this.c.drop = L.addControl({
      id: "g-drop",
      slot: "left",
      group: "games",
      className: "kt-c kt-g kt-g-drop",
      label: "DROP ALL",
      haptic: "press",
      onDown: () => {
        this.press("drop");
        rs()?.dropAll();
      },
    });
    this.c.reup = L.addControl({
      id: "g-reup",
      slot: "upLeft",
      group: "games",
      className: "kt-c kt-g kt-g-reup",
      label: "RE-UP",
      haptic: "press",
      onDown: () => {
        this.press("reup");
        rs()?.reup();
      },
    });
  }

  private hideAll() {
    for (const c of Object.values(this.c)) c.show(false);
    this.state.buttons = [];
  }

  /** Every frame in "tap" mode. */
  frame(decision: Bag) {
    const sc = this.minigame();
    const mode = (sc?.mode as string | undefined) ?? null;
    this.state.game = decision.scene === "Minigame" ? mode : (decision.scene as string | null);
    if (sc) this.fixMinigame(sc, mode);
    const wk = liveScene(this.game, "Whack");
    if (wk) this.fixWhack(wk);
    if (mode !== "runescape" || decision.scene !== "Minigame") return this.hideAll();
    this.build();
    const api = (sc?.phoneRs as PhoneRs | undefined) ?? null;
    const talking = !!sc?.box?.active || !!sc?.ended;
    const want = rsButtons(api ? api.state() : null, talking);
    this.c.chop.show(want.chop);
    this.c.chop.el.classList.toggle("hot", want.hot);
    this.c.drop.show(want.drop, true);
    this.c.reup.setLabel(rsWord(api?.word));
    this.c.reup.show(want.reup, true);
    this.state.buttons = Object.entries({ chop: want.chop, drop: want.drop, reup: want.reup })
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  release() {
    /* the buttons act on touch-down only: nothing is ever held */
  }

  leave() {
    this.hideAll();
  }

  // ------------------------------------------------------------------ fixes to the scenes, from outside

  private note(what: string) {
    if (!this.state.fixed.includes(what)) this.state.fixed.push(what);
  }

  /** The scene's own corner buttons (out from under the II) and the per-game touch areas. Cheap: a few flags a frame. */
  private fixMinigame(sc: Bag, mode: string | null) {
    const sys = sc.sys as Phaser.Scenes.Systems;
    const list = (sys?.displayList?.list ?? []) as Bag[];
    for (const o of list) {
      if (!o.input || o.__mgSeen) continue;
      // (interactive objects are rare: buttons, pads, problems; each is looked at once)
      o.__mgSeen = true;
      if (o.type === "Text" && /^\[ (?:LEAVE|END GIG|LEAVE GIG) \]$/.test(o.text)) this.cornerButton(o);
      if (mode === "crocodile" && o.type === "Rectangle" && o.width === 250 && Math.abs(o.y - 506) < 2) this.crocPad(sc, o, list);
      if (mode === "runescape" && o.type === "Rectangle" && o.width === 52 && o.height === 20) this.rsLogout(o, list);
    }
    // FLIP IT: problems are made all game long; each one's tap area is its ring
    if (mode === "renovate")
      for (const o of list) {
        if (o.__mgRing || !o.input || o.depth !== 10 || (o.type !== "Image" && o.type !== "Rectangle")) continue;
        o.__mgRing = true;
        this.ringHit(o, 40);
      }
    if (mode === "crocodile" && !sc.__mgHud && sc.hud) {
      sc.__mgHud = true;
      // the score line: from between the pads up to just under the note lane
      sc.hud.setY(154);
    }
  }

  /** A minigame's own LEAVE / END GIG: out from under the II, and a thumb-sized box. */
  private cornerButton(t: Bag) {
    t.setPadding(12, 10, 12, 10);
    const b = t.getBounds() as Phaser.Geom.Rectangle;
    const dx = clearOfPause({ x: b.x, y: b.y, w: b.width, h: b.height });
    if (dx) t.setX(t.x + dx);
    this.note(`corner:${t.text}`);
  }

  /** The crocodile's pad: lifted out of the home-indicator strip, its touch area the whole column. */
  private crocPad(_sc: Bag, pad: Bag, list: Bag[]) {
    const lift = liftOutOfStrip(pad.y + pad.height / 2);
    const label = list.find((t) => t.type === "Text" && Math.abs(t.x - pad.x) < 2 && Math.abs(t.y - pad.y) < 2);
    pad.setY(pad.y + lift);
    label?.setY(label.y + lift);
    const k = pad.x < 340 ? "L" : pad.x >= 620 ? "R" : "C";
    const col = crocColumn(k);
    const left = pad.x - pad.width / 2;
    const top = pad.y - pad.height / 2;
    pad.input.hitArea = new Phaser.Geom.Rectangle(col.x - left, col.y - top, col.w, col.h);
    pad.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
    this.note(`croc-pad:${k}`);
  }

  /** RuneScape's Log out (the laptop's Esc): out of the home-indicator strip, with its words. */
  private rsLogout(r: Bag, list: Bag[]) {
    const lift = liftOutOfStrip(r.y + r.height);
    if (!lift) return;
    const label = list.find((t) => t.type === "Text" && t.text === "Log out");
    r.setY(r.y + lift);
    label?.setY(label.y + lift);
    this.note("rs-logout");
  }

  /** A round tap area of `radius` game px about the picture's middle (whatever its scale). */
  private ringHit(o: Bag, radius: number) {
    const w = o.width ?? o.frame?.width ?? 0;
    const h = o.height ?? o.frame?.height ?? 0;
    const s = Math.max(0.2, Math.abs(o.scaleX || 1));
    // (the problem pops in from scale 0: the radius is for its full size, 1)
    o.input.hitArea = new Phaser.Geom.Circle(w / 2, h / 2, radius / Math.max(1, s));
    o.input.hitAreaCallback = Phaser.Geom.Circle.Contains;
    this.note("flip-rings");
  }

  /** Whack-a-Drongus: PLAY / BACK TO THE STRIP sit in the home-indicator strip: lifted (each button once). */
  private fixWhack(sc: Bag) {
    for (const o of (sc.sys?.displayList?.list ?? []) as Bag[]) {
      if (o.type !== "Container" || o.__mgLift || !o.bg || !o.label) continue;
      const lift = liftOutOfStrip(o.y + (o.height ?? 36) / 2);
      o.__mgLift = true;
      if (lift) {
        o.setY(o.y + lift);
        this.note("whack-buttons");
      }
    }
  }

  /** The minigame scene was (re)built: a fresh record, and RuneScape's buttons go with the scene. */
  onCreate(sc: Bag) {
    this.state.fixed = [];
    this.state.presses = {};
    sc.events?.once?.("shutdown", () => {
      if (sc.phoneRs) delete sc.phoneRs;
    });
  }

  /** Once the scenes exist (index.ts): know when the minigame scene is built. */
  hookScenes() {
    try {
      const mg = this.game.scene.getScene("Minigame") as unknown as Bag | null;
      if (mg && !mg.__mgHooked) {
        mg.__mgHooked = true;
        mg.sys.events.on("create", () => this.onCreate(mg));
      }
    } catch {
      /* not booted */
    }
  }

  /** The Wonky Pole's UP CLOSE: a thumb-sized button (audit: 36 x 29 CSS px). */
  fixClub(sc: Bag) {
    const b = sc.closeBtn as Bag | undefined;
    if (!b || b.__mgBig) return;
    b.__mgBig = true;
    b.setPadding(16, 12, 16, 12);
  }
}

let installed: PhoneGames | null = null;

export function phoneGames(): PhoneGames | null {
  return installed;
}

/** index.ts (phones only), before the scenes are hooked for wording. */
export function installGames(game: Phaser.Game, layer: TouchLayer): PhoneGames {
  if (installed) return installed;
  if (typeof document !== "undefined" && !document.getElementById("kt-games-css")) {
    const st = document.createElement("style");
    st.id = "kt-games-css";
    st.textContent = GAMES_CSS;
    document.head.appendChild(st);
  }
  const g = new PhoneGames(game, layer);
  // touch wording: the minigames' rows run first (before stage 1's "Tap / SPACE" → "Tap", which would half-word them)
  for (const r of [...GAME_WORDING].reverse()) addWording(r, "front");
  for (const [k, pats] of Object.entries(GAME_UI_TEXTS)) {
    if (UI_TEXTS[k]) UI_TEXTS[k].push(...pats);
    else UI_TEXTS[k] = [...pats];
  }
  for (const [k, pats] of Object.entries(GAME_STORY_LINES)) STORY_UI_LINES[k] = [...(STORY_UI_LINES[k] ?? []), ...pats];
  // the minigame decision carries which game it is (the controller shows that game's buttons)
  addSceneRule(
    {
      name: "minigames by touch",
      match: (k) => k === "Minigame",
      decide: (sc) => {
        const m = liveScene(game, "Minigame");
        return { mode: "tap", live: true, pause: "menu", pauseButton: true, scene: sc.key, game: (m?.mode as string | undefined) ?? null };
      },
    },
    "front",
  );
  registerModeController({
    id: "games",
    mode: "tap",
    enter: ({ decision }) => g.frame(decision as Bag),
    frame: ({ decision }) => g.frame(decision as Bag),
    release: () => g.release(),
    leave: () => g.leave(),
  });
  // the Club's UP CLOSE (a walking scene: not "tap" mode), checked each frame while the Club runs
  game.events.on("poststep", () => {
    const club = liveScene(game, "Club");
    if (club) g.fixClub(club);
  });
  setPhoneHooks({ ...(phoneHooks() ?? {}), rhythmLag: () => g.lag() });
  installed = g;
  return g;
}
