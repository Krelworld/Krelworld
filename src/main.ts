import { installFullscreenKeys } from "./game/systems/fullscreen";
import { installMouseLock } from "./game/systems/mouseLock";
import { TutorialScene } from "./game/scenes/TutorialScene";
import { PolsonHomeScene } from "./game/scenes/PolsonHomeScene";
import Phaser from "phaser";
import { installPixelFonts } from "./game/ui/fontPatch";
import { installCalmFlash } from "./game/ui/calmFlash";
import { installJukebox } from "./game/systems/jukebox";
import { installMoodMusic } from "./game/systems/moodMusic";
import { synth } from "./game/audio/Synth";
import { G } from "./game/G";
import { BootScene } from "./game/scenes/BootScene";
import { TitleScene } from "./game/scenes/TitleScene";
import { CharSelectScene } from "./game/scenes/CharSelectScene";
import { DifficultyScene } from "./game/scenes/DifficultyScene";
import { BanterScene } from "./game/scenes/BanterScene";
import { CutsceneScene } from "./game/scenes/CutsceneScene";
import { DialogueScene } from "./game/scenes/DialogueScene";
import { TownMeetingScene } from "./game/scenes/TownMeetingScene";
import { ChapterSelectScene, DebugScene } from "./game/scenes/DebugScene";
import { HubScene } from "./game/scenes/HubScene";
import { DungeonScene } from "./game/scenes/DungeonScene";
import { UIScene } from "./game/scenes/UIScene";
import { TVScene } from "./game/scenes/TVScene";
import { ArchiveScene } from "./game/scenes/ArchiveScene";
import { PubScene } from "./game/scenes/PubScene";
import { KrazyFactScene } from "./game/scenes/KrazyFactScene";
import { ExileScene } from "./game/scenes/ExileScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { EndingScene } from "./game/scenes/EndingScene";
import { VignetteScene } from "./game/scenes/VignetteScene";
import { MinigameScene } from "./game/scenes/MinigameScene";
import { VenueScene } from "./game/scenes/VenueScene";
import { ClubScene } from "./game/scenes/ClubScene";
import { KreddleScene } from "./game/scenes/KreddleScene";
import { WhackScene } from "./game/scenes/kreddle/WhackScene";
import { WeaponPickScene } from "./game/scenes/WeaponPickScene";
import { EnterScene } from "./game/scenes/EnterScene";
import { HomeScene } from "./game/scenes/HomeScene";
import { DriveScene } from "./game/scenes/DriveScene";
import { BeepBeepScene } from "./game/scenes/BeepBeepScene";
import { PitScene } from "./game/scenes/PitScene";
import { PitLoanScene } from "./game/scenes/PitLoanScene";
import { LairScene } from "./game/scenes/LairScene";
import { FinaleScene } from "./game/scenes/FinaleScene";
import { RoofCutscene } from "./game/scenes/citadel/RoofCutscene";
import { installDebug } from "./game/debug";
import { installCrashGuard } from "./game/crashGuard";
import { SaveSlotsScene } from "./game/scenes/SaveSlotsScene";
import { installSaveWhere } from "./game/saveWhere";
import { installMobile } from "./game/mobile";

installPixelFonts();
installCalmFlash();
installJukebox();
// after Kreddle is nuked, the old upbeat themes stay gone
installMoodMusic(synth, () => (G.hasRun() ? G.s : null));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 540,
  backgroundColor: "#0b0710",
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  physics: { default: "arcade", arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  scene: [
    BootScene,
    TitleScene,
    CharSelectScene,
    DifficultyScene,
    BanterScene,
    CutsceneScene,
    TownMeetingScene,
    DebugScene,
    ChapterSelectScene,
    HubScene,
    DungeonScene,
    UIScene,
    DialogueScene,
    TVScene,
    ArchiveScene,
    PubScene,
    KrazyFactScene,
    ExileScene,
    VignetteScene,
    MinigameScene,
    VenueScene,
    PitScene,
    PitLoanScene,
    ClubScene,
    KreddleScene,
    WhackScene,
    WeaponPickScene,
    EnterScene,
    HomeScene,
    DriveScene,
    BeepBeepScene,
    LairScene,
    FinaleScene,
    RoofCutscene,
    MenuScene,
    SaveSlotsScene,
    TutorialScene,
    EndingScene,
    PolsonHomeScene,
  ],
});
// phones only (src/game/mobile): on anything else this returns at once and does nothing
installMobile(game);
installMouseLock(game);
installFullscreenKeys(game);
// playtime: every frame of a run counts (town, dungeons, meetings, home, TV, cutscenes, minigames), not the
// title/character-select screens or the pause menu
const NOT_PLAYING = ["Boot", "Title", "CharSelect", "Difficulty", "Banter", "Menu", "Slots", "ChapterSelect", "DebugSkip"];
game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, delta: number) => {
  if (!G.hasRun()) return;
  const sm = game.scene;
  if (NOT_PLAYING.some((k) => sm.isActive(k))) return;
  G.s.playtimeMs += Math.min(delta, 100);
});

installDebug(game);
installSaveWhere(game);
installCrashGuard(game);
