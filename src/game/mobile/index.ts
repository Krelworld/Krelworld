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
import { PromptWording } from "./wording";
import { setFrameCap } from "./battery";
import { HomeScreenGuide, homeScreenPlumbing, listenForInstallPrompt, rotateEntry } from "./homeScreen";
import { DiagOverlay, diagWanted } from "./diag";
import { setPhoneEntryPoints } from "./boot";
import { registerModeController, unregisterModeController } from "./touchLayer";
import { addSceneRule, SCENE_RULES, verbFromPrompt } from "./modes";
import { homeScreenEntryWanted, openHomeScreenGuide } from "./homeScreen";
import { rankFollowerLast } from "./observe";
import { hint } from "./wording";
import { whenRunning } from "./shell";
import { installCombat } from "./combat";

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
  // the phone's own settings, from its own storage key (before anything lays itself out)
  usePhoneSettingsStore(localPhoneSettingsStore());
  // the browser's install prompt fires early: keep it for the guide's INSTALL button
  listenForInstallPrompt();
  // the game's touch paths (touch wording, auto-aim by touch, the raid's FIRE button) are on from the start
  TOUCH.enabled = true;
  const shell = new Shell(game, parent, null);
  const layer = new TouchLayer(game, parent);
  shell.setLayer(layer);
  // stage 2: the top-down fights (FIRE, auto-fire and aim, DODGE, SWAP, SPECIAL, READY, HEAL, the chips, the phone HUD)
  const combat = installCombat(game, layer);
  layer.onFullscreen = () => shell.goFullscreen();
  const guide = new HomeScreenGuide(parent, {
    hasSave: () => !!G.saves.latest(),
    fullscreen: { can: () => shell.canGoFullscreen(), go: () => shell.goFullscreen(), inside: () => shell.inFullscreen(), leave: () => shell.leaveFullscreen() },
    // (the game sleeps under the guide: nothing can hurt you while you read it, wherever it was opened)
    onOpenChange: (open) => shell.setHold("guide", open),
  });
  if (!shell.platform.standalone) shell.rotate.extra.appendChild(rotateEntry(() => guide.open("rotate")));
  // (fullscreen arriving while the guide shows steps through the browser's menu: it re-checks, and leaves it again)
  game.scale.on("enterfullscreen", () => guide.refresh());
  // the title and the pause menu reach the guide through boot.ts (the only phone code a laptop loads)
  setPhoneEntryPoints({ homeScreenEntryWanted, openHomeScreenGuide });
  // an app's own browser (Messenger, Instagram...): say "open it in Safari / Chrome first" straight away, over the
  // loading (or the turn-your-phone screen), not after the whole game has loaded
  if (shell.platform.inApp && !shell.platform.standalone) guide.maybeAutoShow();
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
  const diag = diagWanted(location.search) ? new DiagOverlay(game, parent, layer, shell.platform, () => ({ on: read.on, param: read.param })) : null;
  installed = { shell, layer, readability: read, wording, guide, diag };
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
    layer,
    shell,
    readability: read,
    guide,
    diag,
    combat,
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
