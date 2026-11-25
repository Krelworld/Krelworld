// PHONE MODE: the phone chunk. It is only ever loaded on a phone: main.ts calls boot.ts's installMobile(), which asks
// isMobile() and, on a phone, fetches this module (`import("./index")`, a separate chunk) and calls installMobile()
// below. A laptop never downloads, parses or runs anything in here; at startup it reads the touch points and the screen
// size and stops (no storage read, no media query, no class, no style, no element, no listener, no global). See
// README.md in this folder.
import Phaser from "phaser";
import { TOUCH } from "../ui/TouchControls";
import { G } from "../G";
import { isMobile } from "./flag";
import { readView } from "./observe";
import { Shell } from "./shell";
import { TouchLayer } from "./touchLayer";
import type { Insets } from "./layout";
import { localPhoneSettingsStore, onPhoneSettingsChange, phoneSettings, phoneSettingsList, updatePhoneSettings, usePhoneSettingsStore } from "./settings";
import { Readability } from "./readability";
import { PromptWording, WORDING_HOOKS } from "./wording";
import { setFrameCap } from "./battery";
import { HomeScreenGuide, homeScreenPlumbing, listenForInstallPrompt, rotateEntry } from "./homeScreen";
import { DiagOverlay, diagWanted } from "./diag";
import { setPhoneEntryPoints } from "./boot";
import { registerModeController, unregisterModeController } from "./touchLayer";
import { addSceneRule, SCENE_RULES, verbFromPrompt } from "./modes";
import { homeScreenEntryWanted, openHomeScreenGuide } from "./homeScreen";
import { rankFollowerLast, setCardPause } from "./observe";
import { hint } from "./wording";
import { whenRunning } from "./shell";
import { installCombat } from "./combat";
import { installBrawl, showFinisher } from "./brawl";
import { PAD_CSS, PadHandover } from "./pad";
import { ControlsPicture, tabFor } from "./controlsPicture";
import { phoneHooks, setPhoneHooks } from "./boot";
import { PhoneDialogue } from "./dialogue";
import { PhoneSettingsPage } from "./settingsPage";
import { onSceneCreate, PhoneScreens, skipHintPill } from "./screens";
import { PhoneLists, liveScene } from "./listScenes";
import { PhoneShops } from "./shops";
import { TapUse, TAP_USE_CSS } from "./tapUse";
import { PhoneArt } from "./art";
import { PhoneAudio } from "./audio";
import { PhonePerf } from "./perf";
import { askToKeepSaves, bootLoadHeld, holdBootLoad, storageState } from "./storage";
import { installScenes } from "./scenes";

export { isMobile, setMobileForTests, mobileWhy, rememberPhoneMode } from "./flag";
export { registerModeController, unregisterModeController, type ModeController, type ModeContext, type ControlSpec, TouchControl, TouchLayer } from "./touchLayer";
export { addSceneRule, resolveMode, type LayerMode, type ModeDecision, type SceneRule, type StickKind } from "./modes";
export {
  phoneSettings,
  updatePhoneSettings,
  onPhoneSettingsChange,
  usePhoneSettingsStore,
  phoneSettingsList,
  resetPhoneSettings,
  PHONE_SETTINGS,
  DEFAULT_PHONE_SETTINGS,
  chosenPhoneSettings,
  type PhoneSettings,
  type SettingSpec,
} from "./settings";
export { hint, touchWording, addWording, wordText, TOUCH_WORDING } from "./wording";
export { readability, MIN_TEXT_CSS, MIN_HIT_CSS } from "./readability";
export { haptic } from "./haptics";
export { openHomeScreenGuide, homeScreenGuide, homeScreenEntryWanted } from "./homeScreen";
export { type Hold } from "./shell";

interface Installed {
  shell: Shell;
  layer: TouchLayer;
  readability: Readability;
  wording: PromptWording;
  guide: HomeScreenGuide;
  diag: DiagOverlay | null;
  dialogue: PhoneDialogue;
  settingsPage: PhoneSettingsPage;
}

let installed: Installed | null = null;

/** The phone layer, when phone mode is on (null on a laptop). */
export function mobileLayer(): TouchLayer | null {
  return installed?.layer ?? null;
}

/** The phone shell (rotate screen, lifecycle, fullscreen), when phone mode is on. */
export function mobileShell(): Shell | null {
  return installed?.shell ?? null;
}

/** How long the title has to be up before the Add to Home Screen guide shows itself (first phone run only). */
const GUIDE_DELAY_MS = 600;

export function installMobile(game: Phaser.Game) {
  if (!isMobile() || installed || typeof document === "undefined") return;
  const parent = document.getElementById("game") ?? document.body;
  // the texture budget first, before the art arrives (art.ts: the big one-scene pictures are parked until drawn)
  const art = new PhoneArt(game);
  // off-screen pictures skipped, the player's ring in the rooms where he is hard to find (perf.ts)
  const perf = new PhonePerf(game);
  // the phone's own settings, from its own storage key (before anything lays itself out)
  usePhoneSettingsStore(localPhoneSettingsStore());
  // the browser's install prompt fires early: keep it for the guide's INSTALL button
  listenForInstallPrompt();
  // the game's touch paths (touch wording, auto-aim by touch, the raid's FIRE button) are on from the start
  TOUCH.enabled = true;
  const shell = new Shell(game, parent, null);
  const layer = new TouchLayer(game, parent);
  shell.setLayer(layer);
  // sound for a phone (audio.ts): songs and slowed voices from elements the first tap unlocked, through gain nodes
  const audio = new PhoneAudio(game, () => shell.holdingAudio());
  // the "card" pause route (the finale; modes.ts): the shell's PAUSED card
  setCardPause(() => {
    shell.pauseCard(null);
    return true;
  });
  // stage 2: the top-down fights (FIRE, auto-fire and aim, DODGE, SWAP, SPECIAL, READY, HEAL, the chips, the phone HUD)
  const combat = installCombat(game, layer);
  // stage 3: tap a thing (or a person, or the floor) in a walking scene to walk there and use it
  const tapUse = new TapUse(game, layer);
  if (!document.getElementById("ktu-css")) {
    const st = document.createElement("style");
    st.id = "ktu-css";
    st.textContent = TAP_USE_CSS;
    document.head.appendChild(st);
  }
  // stage 2 part 2: the finale's brawl, the Kreltality prompt, a controller handed over (brawl.ts, pad.ts)
  WORDING_HOOKS.skipHint = skipHintPill;
  const brawl = installBrawl(game, layer);
  brawl.pauseCard = (extra) => shell.pauseCard(extra);
  const picture = new ControlsPicture(layer);
  const pad = new PadHandover();
  pad.start((fn) => {
    game.events.on("prestep", fn);
    return () => game.events.off("prestep", fn);
  });
  if (!document.getElementById("kt-pad-css")) {
    const st = document.createElement("style");
    st.id = "kt-pad-css";
    st.textContent = PAD_CSS;
    document.head.appendChild(st);
  }
  setPhoneHooks({
    ...(phoneHooks() ?? {}),
    brawl: (b) => brawl.attach(b),
    finisher: (p) => showFinisher(layer, p),
    controlsPicture: () => {
      picture.show(tabFor(fightUnder(game)));
      return true;
    },
  });
  // stage 3 wave 2: the special scenes (Night of Freedom's gun, Beep Beep's pedals, skip pills, the telly's subtitles)
  const scenes = installScenes(game, layer, shell);
  layer.onFullscreen = () => shell.goFullscreen();
  let releaseLoad: (() => void) | null = null;
  const guide = new HomeScreenGuide(parent, {
    hasSave: () => !!G.saves.latest(),
    fullscreen: { can: () => shell.canGoFullscreen(), go: () => shell.goFullscreen(), inside: () => shell.inFullscreen(), leave: () => shell.leaveFullscreen() },
    // (the game sleeps under the guide: nothing can hurt you while you read it, wherever it was opened)
    onOpenChange: (open) => {
      shell.setHold("guide", open);
      // (closed: PLAY HERE ANYWAY in an app's own browser lets the held download go)
      if (!open) releaseLoad?.();
    },
  });
  if (!shell.platform.standalone) shell.rotate.extra.appendChild(rotateEntry(() => guide.open("rotate")));
  // (fullscreen arriving while the guide shows steps through the browser's menu: it re-checks, and leaves it again)
  game.scale.on("enterfullscreen", () => guide.refresh());
  // the title and the pause menu reach the guide through boot.ts (the only phone code a laptop loads)
  setPhoneEntryPoints({ homeScreenEntryWanted, openHomeScreenGuide });
  // an app's own browser (Messenger, Instagram...): say "open it in Safari / Chrome first" straight away, over the
  // loading (or the turn-your-phone screen), not after the whole game has loaded
  // (and the art waits until the player chooses to play here: it would be downloaded again in Safari / Chrome; P7)
  if (shell.platform.inApp && !shell.platform.standalone) {
    releaseLoad = holdBootLoad(game);
    if (!guide.maybeAutoShow()) releaseLoad();
  }
  // the browser is asked, quietly, to keep the saves (storage.ts)
  askToKeepSaves(shell.platform);
  // the town's first how-to-play toasts are control hints: touch wording on a phone ("WASD to walk" → "Drag on the
  // left to walk", "(Esc)" → "(II)"). Only "toast" (system hints), never "ping" (characters' messages). This listener
  // is added before the UI scene's, so the toast is drawn reworded.
  const reword = (ev: string, d: unknown) => {
    if (ev !== "toast" || !d || typeof d !== "object") return;
    const t = d as { title?: unknown; text?: unknown };
    if (typeof t.text === "string") t.text = hint(t.text);
    if (typeof t.title === "string") t.title = hint(t.title);
  };
  G.on(reword);
  // (first in line, whenever the phone chunk arrived)
  const ls = (G as unknown as { listeners?: unknown[] }).listeners;
  if (Array.isArray(ls) && ls.indexOf(reword) > 0) ls.unshift(...ls.splice(ls.indexOf(reword), 1));
  const read = new Readability(game);
  const wording = new PromptWording(game);
  const diag = diagWanted(location.search) ? new DiagOverlay(game, parent, layer, shell.platform, () => ({ on: read.on, param: read.param }), {
        art: () => ({ resident: art.resident(), stats: art.report() }),
        audio: () => audio.diag(),
        perf: () => ({ culled: perf.lastCulled, drawn: perf.lastDrawn, poolsHidden: perf.poolsHidden }),
        storage: () => storageState,
      }) : null;
  // stage 2: the Phone settings page, the menus laid out for thumbs, and the conversation pills (SKIP / LOG / AUTO)
  const settingsPage = new PhoneSettingsPage(parent);
  new PhoneScreens(game, read, (from) => settingsPage.open(from));
  const dialogue = new PhoneDialogue(game, parent, () => layer.viewport, () => guide.isOpen || settingsPage.isOpen);
  // Android Back: the topmost phone overlay first, then a conversation (dialogue.ts), then the shell's own rules
  shell.addBackHandler(() => settingsPage.onBack());
  shell.addBackHandler(() => {
    if (!guide.isOpen) return false;
    guide.close(true);
    return true;
  });
  shell.addBackHandler(() => dialogue.onBack());
  // stage 2 part 2: the long lists (M10) and the shops (S13) as phone lists
  const lists = new PhoneLists(game, parent);
  const shops = new PhoneShops(game, parent);
  // Android Back on a Home panel or the loaner rack closes it (what Esc does there on a laptop)
  shell.addBackHandler(() => {
    const open = lists.openList();
    if (!open) return false;
    if (["rack", "jukebox", "trophies"].includes(open.name)) {
      const h = liveScene(game, "Home");
      h?.__mfPanel?.close?.();
      return !!h;
    }
    if (open.name === "pitloan") {
      liveScene(game, "PitLoan")?.close?.();
      return true;
    }
    if (open.name === "archive") {
      // (Esc on a laptop: leave the archive, unless a record is being re-enacted)
      const a = liveScene(game, "Archive");
      if (a && !a.playing) a.leave();
      return !!a;
    }
    return false;
  });
  installed = { shell, layer, readability: read, wording, guide, diag, dialogue, settingsPage };
  // (now, if the phone chunk arrived after the game had already booted)
  whenRunning(game, () => {
    // spare touch pointers: a tap handed over from the stick zone while another finger is on the canvas
    try {
      game.input.addPointer(2);
    } catch {
      /* fine with one */
    }
    wording.hookScenes();
    setFrameCap(game, phoneSettings().batterySaver);
    // scenes laid out for a phone when they are built (screens.ts)
    for (const sc of game.scene.scenes as Phaser.Scene[]) sc.sys.events.on("create", () => onSceneCreate(sc));
  });
  onPhoneSettingsChange((s, changed) => {
    if (changed.includes("batterySaver")) setFrameCap(game, s.batterySaver);
  });
  let titleSince = 0;
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    shell.frame();
    wording.frame();
    rankFollowerLast(game);
    layer.frame();
    read.frame();
    dialogue.frame();
    lists.frame();
    shops.frame();
    // the first phone run: the Add to Home Screen guide once, over the title, before a game is started
    if (!guide.isOpen && !shell.rotate.visible && game.scene.isActive("Title") && !game.scene.isActive("Menu") && !game.scene.isActive("Slots")) {
      const t = performance.now();
      if (!titleSince) titleSince = t;
      else if (t - titleSince > GUIDE_DELAY_MS && titleSince > 0) {
        guide.maybeAutoShow();
        titleSince = -1;
      }
    } else if (titleSince > 0) titleSince = 0;
  });
  // for the phone smoke test and for poking at it on a real phone (phones only)
  (window as unknown as { __krelMobile?: unknown }).__krelMobile = {
    art,
    perf,
    storage: { state: storageState, held: () => bootLoadHeld(game) },
    audio,
    layer,
    shell,
    readability: read,
    guide,
    diag,
    combat,
    tapUse,
    scenes,
    brawl,
    pad,
    picture,
    dialogue,
    settingsPage,
    lists: {
      host: lists,
      shops,
      /** The phone list showing now (its name, rows, and its scroller), or null. */
      open: () => {
        const l = lists.openList() ?? (shops.list.isOpen ? shops.list : null);
        if (!l) return null;
        const sp = l.current;
        const sc = l.scroller;
        return { name: l.name, title: sp?.title ?? "", rows: sp?.rows.map((r) => ({ id: r.id, label: r.label, selected: !!r.selected })) ?? [], scrollTop: sc?.scrollTop ?? 0, scrollHeight: sc?.scrollHeight ?? 0, clientHeight: sc?.clientHeight ?? 0, stats: { ...l.stats } };
      },
    },
    snapshot: () => layer.snapshot(),
    shellState: () => shell.snapshot(),
    // (the same module instances the game uses, for tests that add a rule or a controller)
    api: { registerModeController, unregisterModeController, addSceneRule, SCENE_RULES, verbFromPrompt },
    view: () => readView(game),
    setInsets: (i: Insets | null) => layer.setInsetsOverride(i),
    settings: { get: () => ({ ...phoneSettings() }), set: (p: Record<string, unknown>) => updatePhoneSettings(p), list: () => phoneSettingsList().map((e) => ({ key: e.key, type: e.type, label: e.label, live: e.live, value: e.get() })) },
    plumbing: () => homeScreenPlumbing(),
    fakeInstallPrompt: (outcome: "accepted" | "dismissed" = "accepted") => {
      const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      let asked = 0;
      e.prompt = () => {
        asked++;
        return Promise.resolve();
      };
      e.userChoice = Promise.resolve({ outcome });
      // (through the real listener, as Chrome would send it)
      window.dispatchEvent(e);
      return { asked: () => asked };
    },
  };
}

/** The fight under the pause menu, for the Controls picture's first tab ("side", "combat", "brawl", else walking). */
function fightUnder(game: Phaser.Game): string {
  try {
    const live = (k: string) => game.scene.isActive(k) || game.scene.isPaused(k);
    if (live("Finale")) return "brawl";
    if (live("Dungeon")) return (game.scene.getScene("Dungeon") as unknown as { side?: boolean }).side ? "side" : "combat";
  } catch {
    /* mid-change */
  }
  return "walk";
}
