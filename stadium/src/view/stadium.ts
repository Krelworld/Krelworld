// The playable match day. Draws the stadium, turns input into actions, shows what is going on.
import Phaser from "phaser";
import { appearance } from "../core/identity";
import { defOf, hasProp, ITEM_DEFS, spawnItem } from "../core/items";
import { Stepper } from "../core/stepper";
import type { Action, Actor, Item } from "../core/types";
import { dispatch, possibleVerbs } from "../core/verbs";
import { clamp } from "../core/vec";
import { bribePlayer, biasReferee, distractReferee, floorReferee } from "../football/api";
import { Commentator } from "../football/commentary";
import { HL, HW, PITCH } from "../football/config";
import { clockLabel } from "../football/match";
import type { TeamIdx } from "../football/types";
import { playing } from "../football/util";
import { Announcer } from "../stadium/announcer";
import { isNaked } from "../stadium/naked";
import { Drain } from "./drain";
import { Detain } from "./detain";
import { roofHeight, roofOf, roofs, roofSpan, type Roof } from "../stadium/roofs";
import { RIFLE_RANGE, rifleOf, windowBroken, windows } from "../stadium/missiles";
import { FIXES, fixesDone, isHint } from "../stadium/fixes";
import { BOXER_FEE, burnerOn, knows } from "../stadium/phone";
import { isSecurity } from "../stadium/security";
import { aimThrow, bribeWhy, itemName, itemOptions, looksOutOfPlace, options, personName, primary, throwTarget, type Option } from "../stadium/context";
import { createGame, loadCheckpoint, saveCheckpoint, stepGame, type Game } from "../stadium/game";
import { AREAS, areaAt, BOUNDS, KICKOFF_AT, rushAt, setBreaches, setPace, SOLID, SPOTS, VENUE } from "../stadium/layout";
import { afterMatch, describeDef, FIXTURES, loadoutProblem, newCampaign, notorietyText, type Campaign } from "../stadium/campaign";
import { TEAMS } from "../football/setup";
import { canBetHere, prices } from "../stadium/betting";
import { newsReport } from "../stadium/news";
import { mayPass, secs } from "../stadium/npc";
import { pawnOffer, REWARDS, SHOPS } from "../stadium/rules";
import { LORRY_LEN, LORRY_WID } from "../stadium/vehicles";
import { BUS_LEN, BUS_WID, DEPART_BEFORE_KICKOFF, holdOpen } from "../stadium/bus";
import { drawFigure, headTop, type FigureStyle } from "./figures";
import { drawBall, drawGoalFrame, drawPitch } from "./pitchArt";
import { Projection } from "./projection";
import { Audio, PC_LINES, VOICES, type Clip } from "./audio";
import { Doorway } from "./doorway";
import { playMini, type MiniKind } from "./minigame";
import { instinctMarks, itemAt, todoSpot, trackTarget, type Tracked } from "./guide";
import { ITEM_TIPS, itemTargets, type ItemTarget } from "./itemhelp";
import { curioHere, CURIOS } from "./curios";
import { PlayTest } from "./playtest";
import { matchJob, type Job } from "../stadium/director";
import { inDrag as inDragSim } from "../stadium/drag";
import STW_JSON from "../../assets/audio/stwlines.json";
const STW_VOICE = STW_JSON as Record<string, string>;
import { Drive3D, type DriveView } from "./drive3d";
import { CELL, cellOf, dirIndex, FEET, feetOf, HEAD, SpriteBank, type Base, type Recolour } from "./sprites";
import { BLD_ART, buildings, placements, WorldArt, type Placement } from "./world";
import { Stall } from "./stall";
import { Fx } from "./fx";
import { FirstPerson, type FpSprite } from "./fp";
import { holeState, inCubicle, knifeOn } from "../stadium/gloryhole";
import { incapacitated, knockedOut, lootable } from "../stadium/combat";
import { hasRadio } from "../stadium/coverup";
import { SECURITY_JOBS } from "../stadium/security";
const isSecurityJob = (j: string) => SECURITY_JOBS.has(j);
import { findPath } from "../stadium/nav";
import { LEADS } from "../stadium/entries";
import { playOpening } from "./opening";
import { assetURL, loadPacks } from "./packs";
import { ROOM_WALLS } from "./world";
import { CAP, ensureFloor, setQuietFloors, ensureMaterials, facade, floodlight, matOf, adBoard, banner, pixelText as pixelTextOn, PPM, roof, TILE_FILES, type BuildingSpec } from "./build";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** The canvas draws at the screen's real pixels (sharp text, and each art pixel a whole number of them). */
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
/** The game's faces: a pixel font for things in the world, the condensed face for captions. */
const FONT_POP = '"Silkscreen", "Pixelify Sans", monospace';
const FONT_TALK = '"Pixelify Sans", "Silkscreen", monospace';
/** Zoom levels, as camera zooms: whole screen pixels per art pixel (32 art pixels to the metre): the first,
 *  then closer, then further. Phones in landscape now match bigger screens: Grozz about 60 points tall (he was 40, too small to read his pose or
 *  tap people). ?gz=40|60|80 overrides it for a side-by-side test. */
const GZ = (() => { const m = location.search.match(/[?&]gz=(\d+)/); return m ? +m[1] : 0; })();
function zoomSteps(): number[] {
  const small = Math.min(window.innerWidth, window.innerHeight) < 520;
  // Portrait phones keep the wider view (60 points would leave only about 12 m across).
  const portrait = small && window.innerHeight > window.innerWidth;
  const z = Math.max(1, Math.round(((GZ ? (GZ * 32) / 60 : portrait ? 22 : 32) * DPR) / 32));
  return [...new Set([z, z + 1, Math.max(1, z - 1)])];
}
const ZOOMS = [0, 1, 2];
const SKIN = [0xf1c7a5, 0xd9a47e, 0xb07a52, 0x8a5a3b, 0x5e3b26, 0xe8b896];
const pick2 = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

interface TickerLine { text: string; src: string; big: boolean }

/** A PixelLab picture of an item, if there is one. */
const ICONS = new Set(["keg", "match_ball", "boot_bag", "brick", "fart_can", "rifle", "burner", "warrant_card", "pint", "pie", "knife", "whistle", "ticket", "wallet", "laxative", "powder", "shirt_eng", "shirt_por", "shirt_bra", "shirt_arg", "police_uniform", "kit_eng", "kit_opp",
  "staff_pass", "radio", "hivis", "ref_kit", "police_hat", "mask", "flat_cap", "sunglasses", "moustache", "tracksuit", "chef_whites", "overalls", "balaclava", "hammer", "flare", "betslip", "face", "hands", "censored_bar", "wrench", "kit_card", "parachute", "mascot_suit", "press_pass", "bottle", "pint_glass", "chair", "corner_flag", "wig", "long_wig", "dress", "pool_cue", "bicycle"]);
interface RingItem { label: string; icon: string; kind: string; item?: string; arg?: string; main?: boolean; glyph?: string; opt?: Option }
const icon = (def: string) => (ICONS.has(def) ? `<img class="ico" src="${assetURL(`icons/${def}.png`)}" alt="" onerror="this.remove()">` : `<span class="ico none"></span>`);

/** The main button's words: short enough for a thumb. The full sentence is still in More. */
function shortLabel(o: Option): string {
  const v = o.action?.verb, L = o.label;
  if (o.sheet?.kind === "shop") return "Buy";
  if (o.sheet?.kind === "bet") return "Bet";
  if (o.sheet?.kind === "bribe") return "Offer money";
  if (o.sheet?.kind === "report") return "Tip off";
  if (o.sheet?.kind === "loot") return "Search";
  const map: Record<string, string> = { talk: "Talk", show: "Show ticket", drive: "Drive the bus", getout: "Get out", hide: "Hide inside", unhide: "Climb out", sit: "Sit down", stand: "Stand up",
    untie: "Untie Ronson", release: "Let Ronson go", leash: "Grab Ronson", sic: "Set Ronson on him", servicedog: "\"Service dog\"", alarm: "Pull the fire alarm", vault: "Climb over",
    struggle: "Struggle", take: "Pick up", takeout: "Take it", horn: "Beep", arrest: "Arrest", pickpocket: "Pickpocket", tamper: "Tamper with it" };
  if (v && map[v]) return map[v];
  return L.split(" ").slice(0, 4).join(" ");
}

class StadiumScene extends Phaser.Scene {
  game2!: Game;
  P = new Projection();
  stepper = new Stepper();
  staticG!: Phaser.GameObjects.Graphics;
  crowdG!: Phaser.GameObjects.Graphics;
  pitchG!: Phaser.GameObjects.Graphics;
  detailG!: Phaser.GameObjects.Graphics;
  groundTiles: Phaser.GameObjects.TileSprite[] = [];
  crowdBlit: Phaser.GameObjects.Container | null = null;
  g!: Phaser.GameObjects.Graphics;
  ui!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  bubbles: Phaser.GameObjects.Text[] = [];
  camX = 0; camY = 0;
  started = false;
  // input
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  joyId = -1; joyOx = 0; joyOy = 0; jx = 0; jy = 0;
  picked: string | null = null;
  /** Tapped someone and picked something to do to them: walking over to do it. */
  pursue: { id: string; kind: string; item?: string; arg?: string; opt?: Option; until: number; path: number[]; pathAt: number } | null = null;
  flash: { x: number; y: number; until: number } | null = null;
  dogNoiseAt = -999;
  /** Beep Beep's hit-stop: the world holds still for a beat when something goes under the wheels. */
  hitStopUntil = 0;
  d3!: Drive3D;
  driveView: DriveView = (() => { try { return (localStorage.getItem("kd-drive") as DriveView) || "chase"; } catch { return "chase" as DriveView; } })();
  opts: Option[] = [];
  lines: TickerLine[] = [];
  sheetKind: string | null = null;
  lastScore = "";
  crowdJump = 0;
  speed = 1;
  endingShown = false;
  audio = new Audio("audio/");

  get w() { return this.game2.w; }
  get s() { return this.game2.w.state; }
  get pc(): Actor { return this.s.actors[this.s.stadium!.pc]; }

  bank!: SpriteBank;
  /** Graphics layers interleaved with sprites, so a wall still hides whoever is behind it. */
  layers: Phaser.GameObjects.Graphics[] = [];
  /** Ground-level marks under everyone: shadows, rings. */
  shadowG!: Phaser.GameObjects.Graphics;
  spritePool = new Map<string, Phaser.GameObjects.Sprite>();
  /** Off = the old drawn figures (debug, or if the art failed to load). */
  useSprites = true;

  preload() {
    SpriteBank.preload(this); WorldArt.preload(this);
    for (const k of TILE_FILES) this.load.image(`tile-${k}`, `tiles/${k}.png`);
    for (const k of ICONS) this.load.image(`ico-${k}`, `icons/${k}.png`);
    // Ronson, the same dog as in the films.
    for (const k of ["rot", "walk", "run", "lunge"]) this.load.spritesheet(`ronson-${k}`, `art/ronson-${k}.png`, { frameWidth: 88, frameHeight: 88 });
  }
  world!: WorldArt;
  worldSprites = new Map<string, Phaser.GameObjects.Image>();
  facade: Phaser.GameObjects.TileSprite | null = null;
  placed: { venue: string; list: Placement[] } = { venue: "", list: [] };

  create() {
    (window as any).__scene = this; // for automated checks
    (window as any).__dispatch = (a: any) => dispatch(this.w, a);
    (window as any).__fast = (secs: number) => { for (let i = 0; i < secs * 60 && !this.s.stadium!.ending; i++) stepGame(this.game2); };
    this.bank = new SpriteBank(this);
    this.world = new WorldArt(this);
    // One density everywhere: 32 art pixels to the metre, a square floor and upright faces.
    this.P.S = PPM; this.P.tiltK = 1; this.P.tiltKZ = 1;
    ensureMaterials(this);
    if (!this.textures.exists("floodlight")) this.textures.addCanvas("floodlight", floodlight());
    document.fonts?.ready.then(() => { this.drawStatic(); for (const b of this.bubbles) b.setFontFamily(FONT_TALK); });
    this.world.prepare();
    this.pitchG = this.add.graphics().setDepth(0.25);
    this.staticG = this.add.graphics().setDepth(0);
    this.detailG = this.add.graphics().setDepth(0.3);
    this.crowdG = this.add.graphics().setDepth(0.4);
    this.shadowG = this.add.graphics().setDepth(50);
    // Quiet ground (the report's background tier): the floor textures lose their speckle and some
    // contrast as they're built, keeping their colour. ?loud for the old look.
    this.quietG = this.add.graphics().setDepth(0.9);
    setQuietFloors(this.quiet);
    this.outlineIcons();
    this.decalG = this.add.graphics().setDepth(0.36);
    this.g = this.add.graphics();
    this.layers = [this.g];
    this.ui = this.add.graphics().setDepth(1e7);
    this.d3 = new Drive3D(this);
    this.fx = new Fx(this, this.P);
    this.fp = new FirstPerson($("game"));
    this.stall = new Stall({
      act: (arg) => { if (this.pc) dispatch(this.w, { verb: "hole", actor: this.pc.id, arg }); },
      play: (clip, vol = 1) => this.audio.play(clip as Clip, vol, { minGap: 0.05 }),
    });
    // One overcast grade over everything (it also pulls the different generated sprites together),
    // and a faint vignette.
    try {
      const fl = this.cameras.main.filters.external;
      const cm = fl.addColorMatrix();
      cm.colorMatrix.saturate(-0.14);
      cm.colorMatrix.contrast(0.06, true);
      fl.addVignette(0.5, 0.5, 1.1, 0.12);
    } catch { /* no filters on this renderer */ }
    for (let i = 0; i < 10; i++) {
      this.bubbles.push(this.add.text(0, 0, "", {
        fontFamily: FONT_TALK, fontSize: `${Math.round(15 * DPR)}px`, color: "#12151a",
        padding: { x: 7 * DPR, y: 4 * DPR }, wordWrap: { width: 170 * DPR }, align: "center", lineSpacing: 1 * DPR,
      }).setOrigin(0.5, 1).setDepth(1e7 + 1).setVisible(false));
    }
    this.newGame();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on("resize", () => this.setZoom());
    // The host frame can change size after load (phones especially): keep the canvas filling it.
    const refit = () => {
      const el = $("game"), w = Math.max(1, Math.round(el.clientWidth * DPR)), h = Math.max(1, Math.round(el.clientHeight * DPR));
      if (w !== this.scale.width || h !== this.scale.height) this.scale.resize(w, h);
      this.scale.refresh(); this.setZoom();
    };
    new ResizeObserver(refit).observe($("game"));
    window.visualViewport?.addEventListener("resize", refit);
    window.addEventListener("orientationchange", () => setTimeout(refit, 300));
    setTimeout(refit, 500); setTimeout(refit, 1500);
    this.wireInput();
    this.wireHud();
    this.setZoom();
  }

  newGame(campaign: Campaign = newCampaign()) {
    // Everything you've unlocked is in the stash to choose from.
    for (const d of StadiumScene.unlocked()) if (ITEM_DEFS[d] && !campaign.stash.includes(d)) campaign.stash.push(d);
    setPace({ kickoffAt: 540, calm: true });
    this.game2 = createGame(`day${Date.now() % 100000}`, FIXTURES[campaign.fixture] ?? "qf", campaign);
    this.introFor(campaign);
    this.d3?.buildCrowd(this.s.match!.teams[1]);
    const w = this.w;
    new Commentator(w, w.bus, (l) => this.matchLine(l.text, l.big));
    const TANNOY: Record<string, Clip> = { welcome: VENUE.id === "qf" ? "tannoy_welcome" : VENUE.id === "final" ? "tannoy_welcome_final" : "tannoy_welcome_sf", facerec: "tannoy_facerec", detector: "tannoy_detector", lorry: "tannoy_lorry", pitch: "tannoy_pitch", "2min": "tannoy_2min", teams: "tannoy_teams", cleaner: "tannoy_cleaner", flares: "tannoy_flares", cameras: "tannoy_cameras",
      delay_late: "tannoy_delay_late", delay_ref: "tannoy_delay_ref", delay_pitch: "tannoy_delay_pitch", delay_safety: "tannoy_delay_safety", delay_again: "tannoy_delay_again",
      alarm: "tannoy_alarm", breach: "tannoy_breach", forfeit: "tannoy_forfeit", incident: "tannoy_incident",
      display_off: "tannoy_display_off", lenny: "tannoy_lenny", lenny_off: "tannoy_lenny_off", card: "tannoy_card", press: "tannoy_press" };
    const ann = new Announcer(w, (a) => {
      // Voiced tannoy lines are heard, not read (it's all in the log); only the ones that change what
      // you should do get a caption: an alarm, a breach, the cameras, the detector.
      const voiced = !!a.key && !!TANNOY[a.key], matters = ["alarm", "breach", "facerec", "detector", "forfeit", "incident"].includes(a.key ?? "");
      this.say(a.text, a.src === "tannoy" ? "Tannoy" : "Commentary", a.big, !voiced || matters);
      const clip = a.key ? (TANNOY[a.key] ?? (a.key.startsWith("cam") ? "tannoy_supervisor" : undefined)) : undefined;
      if (clip && !(VENUE.id === "sf" && a.key === "lorry")) this.audio.tannoy(clip, this.hearsMatch() ? 0.9 : 0.5, this.hearsMatch() ? 0 : 0.6);
    });
    (this as any).announcer = ann;
    w.bus.on((e) => this.sounds(e));
    w.bus.on((e) => {
      this.reactTo(e);
      if (this.pt) { const sa = e.type === "say" ? this.s.actors[e.by] : null; this.pt.event(e, this.s.stadium!.pc, !sa || !this.pc || Math.hypot(sa.x - this.pc.x, sa.y - this.pc.y) < 8); }
      if (e.type === "say" && e.by !== this.s.stadium!.pc) {
        // Only what is said close by, and only once.
        const a = this.s.actors[e.by];
        if (a && Math.hypot(a.x - this.pc.x, a.y - this.pc.y) < 5.5 && e.text.length > 12 && !this.log.some((l) => l.text === e.text)) this.say(e.text, a.name, false, false);
      }
      if (e.type === "action_failed" && e.action.actor === this.s.stadium!.pc) this.hint(e.reason);
      if (e.type === "say" && this.detain?.open && this.s.actors[e.by]?.npc?.job === "chief") this.detain.line(e.text);
      if (e.type === "action" && e.action.actor === this.s.stadium!.pc && (e.action.verb === "talk" || e.action.verb === "threaten" || e.action.verb === "bribe") && e.action.target?.k === "actor") this.talkedTo = { id: e.action.target.id, at: performance.now() };
      if (e.type === "fb_goal" || e.type === "caught" || e.type === "fb_foul" && e.penalty) this.setSpeed(1);
      // Watching sped up: anything worth seeing brings it back to normal (a shot, the woodwork, a card,
      // a change, the ref going down), so you never miss the moment.
      if (this.speed > 1 && ["fb_shot", "fb_woodwork", "fb_sub", "fb_ref_down", "fb_removed", "fb_save", "ball_to_pc"].includes(e.type)) this.setSpeed(1);
      if (e.type === "ball_to_pc") { this.audio.play("pickup", 1); this.cameras.main.shake(120, 0.004); }
      // Sat watching when they score: that's your cue.
      if (e.type === "fb_goal" && e.team === 1 && this.pc?.seated && e.legit !== false) {
        const [eng, opp] = e.score as number[];
        setTimeout(() => this.hint(opp > eng ? `${opp}-${eng} down. You can't just sit there, Grozz. Up you get.` : opp === eng ? "They've equalised. Time to get off your arse?" : "They've pulled one back. Keep an eye on it."), 1800);
        this.buzz([80, 60, 80]);
      }
      if (e.type === "fb_goal") { this.crowdJump = 120 * (e.team === 0 ? 1 : -1); this.crowdUpUntil = performance.now() + 6000; this.crowdUpSide = e.team === 0 ? "home" : "away"; }
      if (e.type === "fb_miss" || e.type === "fb_woodwork") { this.crowdUpUntil = performance.now() + 1400; this.crowdUpSide = "all"; }
      this.newsEvents(e);
      this.callTriggers(e);
      if (e.type === "stole") this.hint(e.what === "ticket" ? "You lifted a ticket." : `You lifted £${e.amount}.`);
      if (e.type === "ejected" && e.who === this.s.stadium!.pc) this.hint(e.soft ? "Walked back to the coach. Nothing taken, nobody's remembered you. Try something else." : e.taken.length ? `Thrown out. They took your ${e.taken.join(", ")}.` : "Thrown out. They'll know your face now.");
      // Frogmarched: fade to black first; the move happens in the dark; the camera's already there when it lifts.
      if (e.type === "escort_fade" && e.who === this.s.stadium!.pc) $("fade").classList.add("on");
      if ((e.type === "escort_cut" || e.type === "ejected") && e.who === this.s.stadium!.pc && !this.cutDone) {
        this.cutDone = true;
        $("fade").classList.add("on");
        setTimeout(() => { const pc = this.pc; if (pc) { this.camX = this.P.sx(pc.x, pc.y); this.camY = this.P.sy(pc.x, pc.y) - this.P.S; } }, 0);
        setTimeout(() => { $("fade").classList.remove("on"); this.cutDone = false; }, 420);
      }
      if (e.type === "broke_free" && e.who === this.s.stadium!.pc) this.hint("You broke free. Run!");
      if (e.type === "action" && e.action.actor === this.s.stadium!.pc && e.action.verb === "take" && e.action.item) {
        const it = this.s.items[e.action.item];
        if (it) { this.audio.play("pickup", 0.9); this.toast(it.def, itemName(it), "Picked up"); }
      }
      if (e.type === "bus_stolen" && e.by === this.s.stadium!.pc) this.hint(this.driveView === "map" ? "Steer with the stick. The view button (top right) switches to Chase or Cab." : "Up to go, down to brake, left and right to steer. Beep (or H) freezes everyone in front so they can't dive clear. The view button switches Chase, Cab and Map.");
      if (e.type === "radio_call" && e.by === this.s.stadium!.pc) this.hint("Security are sending a couple of lads to tidy up. Wait there.");
      if (e.type === "covered_up") this.hint(`Gone, under a sheet. Nobody saw a thing.${areaAt(this.pc.x, this.pc.y).id === "security" ? " The office door's open for you." : ""}`);
      if (e.type === "killed" && e.by === this.s.stadium!.pc && !e.stamp) this.hint("He's dead. You're covered in his blood: change your top or everyone will see it.");
      if (e.type === "armed_called") this.hint("Someone's called the armed police. You've got about forty seconds.");
      if (e.type === "armed_challenge") this.hint("Drop the knife and stand still, or run for it.");
      if (e.type === "flayed") this.hint(e.part === "face" ? "In your pocket. Wear it and you'll pass for him, from a distance." : "In your pocket. Some doors have palm readers.");
      if (e.type === "service_dog") this.hint(e.ok ? "He bought it. The dog's coming in with you." : "He didn't buy it. Try another turnstile, or another approach.");
      if (e.type === "breach") this.hint("Through the wall. Your ears are ringing. Get moving before the police get here.");
      if (e.type === "kickoff_delayed" && (e.n === 1 || e.n === 4)) this.hint(e.n === 1 ? "Kick-off delayed. The stewards will be keener now." : "The referee won't wait much longer.");
      if (e.type === "planted" && e.by === this.s.stadium!.pc) this.hint("Planted. Nobody noticed.");
      if (e.type === "bet_settled" && e.who === this.s.stadium!.pc) this.hint(e.won ? `Your bet came in: £${e.payout}.` : `You lost £${e.stake}.`);
    });
    const m = this.s.match!;
    $("sc0").textContent = m.teams[0].short; $("sc1").textContent = m.teams[1].short;
    document.documentElement.style.setProperty("--opp", "#" + m.teams[1].colour.toString(16).padStart(6, "0"));
    this.lines = []; this.renderTicker();
    this.drawStatic();
    this.camX = this.P.sx(this.pc.x, this.pc.y); this.camY = this.P.sy(this.pc.x, this.pc.y);
    $("ending").hidden = true;
  }

  // ---------- Between matches ----------
  introFor(c: Campaign) {
    const opp = TEAMS[VENUE.opp].name;
    const kit = c.loadout.filter((d) => d !== "shirt_eng").map(describeDef);
    $("introTitle").textContent = `England v ${this.s.match!.teams[1].name}`;
    $("introRound").textContent = `World Cup ${VENUE.round} · ${VENUE.ground}`;
    $("introKo").textContent = `KO in ${Math.floor(KICKOFF_AT / 60)}:${String(KICKOFF_AT % 60).padStart(2, "0")}`;
    $("introText").textContent = c.fixture === 0
      ? `You are outside ${VENUE.ground} with £${c.money} and an England shirt. ${opp} are the opposition. Kick-off is in five and a half minutes. Help England win, any way you like.`
      : `${VENUE.ground}, against ${opp}. You have £${c.money}${kit.length ? ` and you've brought: ${kit.join(", ").toLowerCase()}` : ""}. ${notorietyText(c.notoriety)} This ground has metal detectors and face-recognition cameras at the turnstiles, and staff need a pass.${VENUE.features.penisDetector ? " And, following recent incidents, a penis detector." : ""}`;
    $("intro").hidden = false;
    this.started = false;
  }

  /** England are through: the news, then pack a bag for the next match. */
  continueTournament() {
    const next = afterMatch(this.game2.campaign, this.w, newsReport(this.w).headline);
    this.pendingCampaign = next;
    $("ending").hidden = true;
    const list = $("prepList");
    list.textContent = "";
    const chosen = new Set<number>();
    next.stash.forEach((d, i) => {
      if (d === "shirt_eng") return;
      const lab = document.createElement("label");
      const box = document.createElement("input"); box.type = "checkbox"; box.id = `prep${i}`;
      box.checked = next.loadout.includes(d) && !chosen.has(i);
      if (box.checked) chosen.add(i);
      lab.htmlFor = box.id;
      lab.appendChild(box); lab.appendChild(document.createTextNode(describeDef(d)));
      list.appendChild(lab);
    });
    if (!list.children.length) list.textContent = "You came home with nothing but the shirt on your back.";
    $("prepText").textContent = `England play ${TEAMS["BRA"].name} in the semi-final. You have £${next.money}. ${notorietyText(next.notoriety)} Choose what to bring. The England shirt comes anyway.`;
    const check = () => {
      const picked = ["shirt_eng", ...next.stash.filter((_, i) => ($(`prep${i}`) as HTMLInputElement | null)?.checked)];
      const problem = loadoutProblem(picked);
      $("prepProblem").textContent = problem ?? "";
      ($("prepGo") as HTMLButtonElement).disabled = !!problem;
      next.loadout = picked;
    };
    list.onchange = check;
    check();
    $("prep").hidden = false;
  }
  pendingCampaign: Campaign | null = null;

  // ---------- Sound ----------
  /** Inside the ground (or watching on the pub telly): the match is heard clearly. */
  hearsMatch(): boolean {
    const pc = this.pc;
    if (!pc) return false;
    const ar = areaAt(pc.x, pc.y);
    return !ar.outside || ar.id === "pub";
  }
  distTo(x: number, y: number): number { const pc = this.pc; return pc ? Math.hypot(pc.x - x, pc.y - y) : 99; }

  sounds(e: { type: string; [k: string]: any }) {
    const a = this.audio, s = this.s, pcId = s.stadium!.pc;
    const inside = this.hearsMatch(), muffle = inside ? 0 : 0.85, vol = inside ? 1 : 0.35;
    const near = (x: number, y: number, r = 25) => Math.max(0, 1 - this.distTo(x, y) / r);
    this.tickFrom(e, pcId);
    switch (e.type) {
      case "fb_goal":
        if (e.team === 0) a.play("goal_roar", vol, { muffle, minGap: 2 });
        else { a.play("groan", vol, { muffle, minGap: 2 }); a.play("goal_roar", vol * 0.25, { muffle: 0.5, minGap: 0.1 }); }
        break;
      case "fb_kickoff": case "fb_period_start": a.play("whistle", vol * 0.8, { muffle, minGap: 1 }); break;
      case "fb_foul": case "fb_offside": case "fb_halted":
        a.play("whistle", vol * 0.7, { muffle, minGap: 0.6 });
        if (e.type === "fb_foul" && (e.phantom || ((e.card === "red" || e.card === "yellow") && e.team === 0))) a.play("boo", vol * 0.8, { muffle, minGap: 3 });
        break;
      case "fb_period_end": case "fb_match_end": a.play("whistle_end", vol, { muffle, minGap: 3 }); break;
      case "fb_miss": case "fb_woodwork":
        a.play("crowd_ooh", vol * 0.8, { muffle, minGap: 3 });
        if (e.team === 0 || s.actors[e.by]?.fb?.team === 0) a.play("groan", vol * 0.6, { muffle, minGap: 4 });
        break;
      case "fb_save":
        if (s.actors[e.shooter]?.fb?.team === 0) a.play("groan", vol * 0.5, { muffle, minGap: 4 });
        a.play("crowd_ooh", vol * 0.7, { muffle, minGap: 3 });
        break;
      case "fb_shot": {
        this.flashesUntil = performance.now() + 900;
        const by = s.actors[e.by];
        if (by) { const v = near(by.x, by.y, 30); if (v > 0) a.play("kick", v * 0.8, { minGap: 0.3 }); }
        break;
      }
      case "fb_intruder_kick": a.play("kick", 0.9); break;
      case "item_hit": {
        const v = near(e.x, e.y, 30);
        if (v > 0) a.play(e.itemDef === "pie" || e.itemDef === "pint" ? "splat" : "punch", 0.4 + v * 0.6);
        break;
      }
      case "struck": {
        // Whoever you're trading blows with is who the hit button sticks to.
        if (e.by === pcId) this.fight = { id: e.who, until: performance.now() + 5000 };
        else if (e.who === pcId && s.actors[e.by]) this.fight = { id: e.by, until: performance.now() + 5000 };
        // A blow: the swing, the smack, the crowd's gasp; then the world holds still for a beat,
        // the camera jolts, the victim flashes white and flies back spraying blood.
        const by = s.actors[e.by], who = s.actors[e.who];
        if (!by || !who) break;
        if (e.by === pcId) { this.fp.punchAt = performance.now(); if (e.horse) this.bark("horse", 0.5); else this.bark("strike", 0.6); }
        if (e.horse) { a.play("trample", 0.4 + near(who.x, who.y, 35) * 0.6, { minGap: 0.1 }); this.impact(e.by, e.who, e.dx, e.dy, 1.2, near(who.x, who.y, 35)); break; }
        const v = near(who.x, who.y, 35);
        a.play("whoosh", 0.25 + v * 0.5, { minGap: 0.05, rate: 0.9 + Math.random() * 0.25 });
        a.play(e.weapon ? "weaponhit" : (["hit1", "hit2", "hit3"] as const)[Math.floor(Math.random() * 3)], 0.35 + v * 0.65, { minGap: 0.05, rate: 0.9 + Math.random() * 0.2 });
        if (e.heavy) { a.play("haymaker", 0.4 + v * 0.6); this.trauma = Math.min(1, this.trauma + 0.35); this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + 110); }
        if (v > 0.3) a.play("gasp", 0.3 + v * 0.4, { minGap: 5 });
        this.impact(e.by, e.who, e.dx, e.dy, e.weapon ? 1.4 : 1, v);
        break;
      }
      case "smoke": a.play("flare", 0.4 + near(e.x, e.y, 40) * 0.6); break;
      case "dog_bite": { const v = s.actors[e.who]; const k = near(v?.x ?? 0, v?.y ?? 0, 30); if (e.maul) a.play("dog_maul", 0.3 + k * 0.7, { minGap: 1.2 }); else { a.play("pit_gnash", 0.4 + k * 0.6, { minGap: 0.6 }); a.play("punch", 0.5); } break; }
      case "dog_loose": a.play("pit_bark", 1, { minGap: 0.3 }); break;
      case "bus_hit": { a.play("bodyfall", 0.9); { const who = s.actors[e.who], bv = s.stadium!.vehicles.bus; if (who && bv) { this.spray(who.x, who.y, 1, Math.cos(bv.facing), Math.sin(bv.facing), e.hard ? 40 : 18, 1.8); if (e.hard) this.pools.push({ x: who.x, y: who.y, r: 0.1, max: 1.1, grow: 0.5 }); this.trauma = Math.min(1, this.trauma + 0.5); } } a.play("horn", 0.6, { minGap: 1 }); const v = s.stadium!.vehicles.bus; if (v && v.drivenBy === pcId) { this.d3.hit(s, e.who, e.hard, v.facing, v.speed, !!e.dodger); this.hitStopUntil = performance.now() + (e.hard ? 120 : 70); } break; }
      case "dive": if (s.stadium!.vehicles.bus?.drivenBy === pcId) this.d3.dodge(s); break;
      case "bus_wall": a.play("punch", 1, { rate: 0.6 }); this.d3.wall(s, false); break;
      case "breach": a.play("wall_crash", 0.5 + near(e.x, e.y, 80) * 0.5); this.d3.wall(s, true); break;
      case "fire_alarm": a.play("fire_alarm", 0.4 + near(e.x, e.y, 50) * 0.6); break;
      case "gunshot": if (!(e.sniper && e.by === pcId)) a.play("gunshot", 0.5 + near(e.x, e.y, 60) * 0.5, { minGap: 0.15 }); this.flash = { x: e.x, y: e.y, until: s.tick + 5 }; if (e.sniper && e.by === pcId) this.tick("rifle"); break;
      case "killed": {
        if (e.fall) { this.bark("fall", 1, true); setTimeout(() => { a.play("splat", 1); a.play("bodyfall", 1); }, 1300); this.trauma = 1; }
        else a.play("stab", 0.9);
        const who = s.actors[e.who], by = e.by ? s.actors[e.by] : null;
        if (who) {
          const dx = by ? who.x - by.x : 0, dy = by ? who.y - by.y : 1, l = Math.hypot(dx, dy) || 1;
          this.impact(e.by ?? e.who, e.who, dx / l, dy / l, 2.2, near(e.x, e.y, 35));
          this.pools.push({ x: who.x, y: who.y + 0.1, r: 0.1, max: 1.3, grow: 0.5 });
        }
        break;
      }
      case "heat": {
        // Spotted: a sting. Shaken them off: a breath out.
        if (e.mode === 4 && (e.was ?? 0) < 3) { a.play("alert_sting", 1, { minGap: 4 }); }
        if (e.mode === 2 && e.was === 3) a.play("heat_clear", 0.8);
        break;
      }
      case "bike_on": if (e.who === pcId) { a.play("tap", 1); a.play("chime", 0.4, { rate: 1.6 }); this.hint("On your bike. Get off with the button, or you'll come off if anyone grabs you."); } break;
      case "bike_off": if (e.thrown) a.play("bodyfall", 0.8); a.play("weaponhit", 0.4, { rate: 0.8 }); break;
      case "evaded": this.hint("Lost them. Keep your head down for a bit: they've got your description."); break;
      case "evasion": this.hint("Out of sight. Stay hidden till the countdown runs out and they'll give up."); break;
      case "car_kicked": a.play("car_kick", 0.4 + near(e.x, e.y, 30) * 0.6); if (e.alarm) a.play("car_alarm", 0.3 + near(e.x, e.y, 40) * 0.6, { minGap: 3 }); else a.play("horn", 0.4 + near(e.x, e.y, 30) * 0.5, { minGap: 1 }); break;
      case "carjacked": a.play("car_door", 0.9); if (e.by === pcId) this.hint("Nicked it. Steer with the stick, push harder to go faster, pull back to brake. Get out when you're done."); break;
      case "car_in": case "car_out": a.play("car_door", 0.7); if (e.type === "car_out") this.audio.engineOn(false); break;
      case "car_crash": a.play("car_crash", e.hard ? 1 : 0.6, { minGap: 0.3 }); this.trauma = Math.min(1, this.trauma + (e.hard ? 0.6 : 0.3)); break;
      case "car_hit": { a.play("bodyfall", 0.9); a.play("punch", 0.7, { rate: 0.6 }); const who = s.actors[e.who]; if (who) { this.spray(who.x, who.y, 1, Math.random() - 0.5, Math.random() - 0.5, e.hard ? 30 : 14, 1.6); this.trauma = Math.min(1, this.trauma + 0.35); } break; }
      case "line": if (e.by === pcId) {
        a.play("sniff", 1); this.cameras.main.shake(220, 0.006);
        const fx = $("cokeFx"); fx.classList.remove("rush"); void fx.offsetWidth; fx.classList.add("rush"); setTimeout(() => fx.classList.remove("rush"), 750);
        this.pcLine = { text: pick2(["Ohhhh. YES.", "Right. Who's first?", "COME ON THEN!", "I can hear colours."]), until: performance.now() + 2600 };
        if (e.left <= 0) setTimeout(() => this.hint("That's the bag done."), 1400);
      } break;
      case "shrugged_off": a.play("haymaker", 0.9); this.cameras.main.shake(160, 0.006); break;
      case "comedown": if (e.by === pcId) this.pcLine = { text: pick2(["Oh no. Oh, I feel awful.", "Why is everyone so loud.", "Need another. Need another."]), until: performance.now() + 2800 }; break;
      case "beat": {
        // The mischief director's offer: whoever and whatever it's about gets the warm rim for a while.
        this.beatRel = { ids: [e.who, ...(e.item ? [`item-${e.item}`] : [])], until: performance.now() + 20000 };
        if (e.kind === "fag") setTimeout(() => { this.pcLine = { text: "He's left his post…", until: performance.now() + 2400 }; }, 1200);
        break;
      }
      case "keg_slip": a.play("keg_slip", 1); this.cameras.main.shake(160, 0.0025); break;
      case "keg_rolled": a.play("keg_roll", 0.9); break;
      case "spotted": {
        // "Oi! YOU!": a beat of slow motion to deal with him before he gets his radio out. Shorter each time.
        const now = performance.now(), g = s.actors[e.by];
        if (!g || now < this.reflexReadyAt) break;
        const dur = Math.max(450, 1300 - this.reflexUses * 220);
        this.reflexUses++; this.reflexReadyAt = now + 9000; this.reflexUntil = now + dur;
        this.fight = { id: g.id, until: now + 4000 };
        a.play("alert_sting", 1, { minGap: 3 });
        this.popup(g.x, g.y, "!", "#ff3b3b");
        if (this.reflexUses <= 2) this.hint(`${personName(g)} saw that. Flatten him before he gets on the radio, or leg it.`);
        break;
      }
      case "radio_stopped": if (s.actors[e.by]) this.popup(s.actors[e.by].x, s.actors[e.by].y, "NO BACKUP", "#7dffa8"); break;
      case "lunged": if (e.who === pcId) a.play("whoosh", 0.5, { rate: 1.2, minGap: 0.1 }); break;
      case "lech": if (e.by === pcId) this.bark("lech", 1, true); break;
      case "slapped": { a.play("punch", 0.6, { rate: 1.6 }); const who = s.actors[e.who]; if (who) { this.flashAt.set(e.who, performance.now()); this.trauma = Math.min(1, this.trauma + 0.2); } break; }
      case "radioed": a.play("radio_squelch", 0.3 + near(e.x, e.y, 40) * 0.5, { minGap: 2 }); break;
      case "headsplat": {
        // The head goes: a burst of blood every which way, bits, and a pool where it was.
        const who = s.actors[e.who];
        if (who && this.textures.exists("fx-headburst")) {
          if (!this.anims.exists("headburst")) this.anims.create({ key: "headburst", frames: this.anims.generateFrameNumbers("fx-headburst", { start: 0, end: 11 }), frameRate: 16 });
          const P = this.P, hx = who.x + Math.cos(who.facing) * 0.6, hy = who.y + Math.sin(who.facing) * 0.6;
          const fx = this.add.sprite(Math.round(P.sx(hx, hy)), Math.round(P.sy(hx, hy) - P.S * 0.3), "fx-headburst", 0).setDepth(1e6 - 1).setScale(1.8 * (P.S / PPM));
          fx.play("headburst"); fx.once("animationcomplete", () => fx.destroy());
        }
        a.play("head_splat", 0.5 + near(e.x, e.y, 30) * 0.5); a.play("punch", 0.8, { rate: 0.55 });
        if (who) {
          for (let i = 0; i < 4; i++) this.spray(who.x, who.y, 0.35, Math.random() * 2 - 1, Math.random() * 2 - 1, 30, 2.2);
          this.gibs(who.x, who.y, 26);
          this.pools.push({ x: who.x, y: who.y, r: 0.1, max: 1.9, grow: 1.1 });
          if (e.by === pcId) { this.trauma = Math.min(1, this.trauma + 0.8); this.hitStopUntil = performance.now() + 140; this.bark("stomp", 1, true); }
        }
        break;
      }
      case "radio_call": {
        a.play("radio_squelch", 0.9);
        if (e.by === pcId) setTimeout(() => this.bark(e.dead ? "radio_kill" : "radio_ko", 1, true), 250);
        setTimeout(() => { a.play("radio_squelch", 0.8); setTimeout(() => a.play("stw_copy", 0.9), 300); }, 5200);
        break;
      }
      case "mauled": case "flayed": {
        const who = s.actors[e.who];
        if (who) { this.spray(who.x, who.y, 1.3, Math.random() * 2 - 1, Math.random() * 2 - 1, 22, 1.4); this.pools.push({ x: who.x, y: who.y + 0.1, r: 0.1, max: 0.9, grow: 0.35 }); }
        break;
      }
      case "body_found": a.play("scream", 0.3 + near(e.x, e.y, 40) * 0.7, { minGap: 2 }); break;
      // Somebody saw something terrible: that's when you hear a scream (not when nobody's about).
      case "incident": if (e.seen > 0 && e.severity >= 3) { const by = s.actors[e.by]; if (by) a.play("scream", 0.3 + near(by.x, by.y, 30) * 0.7, { minGap: 1.5 }); } break;
      case "armed_challenge": { const o = s.actors[e.by]; if (o) a.play("armed_police", 0.4 + near(o.x, o.y, 35) * 0.6, { minGap: 3 }); break; }
      case "disarmed": a.play("stw_knife", 1); break;
      case "glory_hole": this.stall.event(e.what); break;
      case "knockout": {
        const who = s.actors[e.who];
        if (who) { this.popup(who.x, who.y, e.quiet ? "TAKEDOWN" : "KO!", e.quiet ? "#f2c94c" : "#ff4d5e"); if (e.quiet) a.play("bodyfall", 0.6, { minGap: 0.1 }); }
        if (e.quiet && e.by) this.choking.set(e.by, performance.now() + 750);
        if (e.by === pcId && e.who !== pcId) this.bark(e.quiet ? "takedown" : "ko", 1, true);
        if (e.who === pcId) this.say(`You're out cold. You come round${e.lost ? ` £${e.lost} lighter` : ""}.`, "", true);
        break;
      }
      case "looted": { const who = s.actors[e.who]; if (who && e.money) { this.popup(who.x, who.y, `+£${e.money}`, "#f2c94c"); a.play("kaching", 0.7); } if (e.by === pcId) this.bark("loot", 0.7); break; }
      case "unseated": a.play("whinny", 1); a.play("bodyfall", 0.9); this.popup(e.x, e.y, "UNSEATED!", "#ff4d5e"); break;
      case "mounted": a.play("whinny", 0.8); if (e.by === pcId) { this.startCine(1600, { zoomAdd: 0, caption: "Tally ho" }); setTimeout(() => this.bark("horse", 1, true), 500); } break;
      case "smashed": { a.play(e.what === "chair" ? "chair_smash" : "glass_smash", 1); this.popup(e.x, e.y, e.what === "chair" ? "CHAIRED!" : "GLASSED!", "#ff4d5e"); this.trauma = Math.min(1, this.trauma + 0.3); break; }
      case "countered": this.popup(e.x, e.y, "COUNTER!", "#f2c94c"); break;
      case "detector_wait": if (e.by === pcId) this.startCine(2200, { zoomAdd: 1, caption: "The penis detector" }); break;
      case "detector": {
        const p = s.actors[e.by];
        if (e.result === "caught") { a.play("detector_alarm", 1); if (p) this.popup(p.x, p.y, "MATCH FOUND", "#ff4d5e"); this.trauma = Math.min(1, this.trauma + 0.4); }
        else { a.play("detector_ok", 1); if (p) this.popup(p.x, p.y, e.result === "dog" ? "CLEARED (CANINE)" : "CLEARED", "#4ade80"); }
        if (p) setTimeout(() => this.popup(p.x, p.y + 0.4, "[CENSORED]", "#111111"), 250);
        break;
      }
      case "horse_jump": a.play("whinny", 0.4, { minGap: 2 }); break;
      case "roof":
        if (e.by === pcId && e.up) {
          a.play("ladder", 1); this.tick("roof");
          this.startCine(1800, { zoomAdd: 0, caption: e.name ?? "The roof" });
          if (!this.roofHinted) { this.roofHinted = true; this.hint("Up here nobody can make out your face unless they're close, and you throw further. They'll wait at the bottom of the ladder, then come up after you. Drop off any edge to get away (it hurts)."); }
        } else if (e.by === pcId) a.play("ladder", 0.7);
        else if (e.up && s.actors[e.by]?.npc) this.hint(`${personName(s.actors[e.by])} is coming up the ladder.`);
        break;
      case "dropped": if (e.by === pcId) { a.play("bodyfall", 1); this.trauma = Math.min(1, this.trauma + 0.4); if (e.inside) this.hint("Over the edge and into the ground."); } break;
      case "window_smashed": a.play("glass_smash", 0.5 + near(e.x, e.y, 40) * 0.5); this.tick("window"); if (e.by === pcId) this.hint("Smashed. Climb through before the stewards come and look."); break;
      case "climbed_window": if (e.by === pcId && e.inside) this.hint("In through the window."); break;
      case "stench": a.play("fart", 0.4 + near(e.x, e.y, 40) * 0.6, { minGap: 0.3 }); if (e.by === pcId) this.tick("stench"); break;
      case "chute_open": if (e.by === pcId) { a.play("chute", 1); this.bark("chute", 1, true); this.startCine(3000, { zoomAdd: 0, slow: 900, caption: "Geronimo" }); } break;
      case "chute_land": { a.play("goal_roar", 0.8); a.play("bodyfall", 0.7); this.popup(e.x, e.y, "TOUCHDOWN", "#f2c94c"); this.trauma = Math.min(1, this.trauma + 0.4); break; }
      case "lead": this.toast("lead", e.title, "New lead"); a.play("chime", 0.6); break;
      case "hamper_ride": if (e.by === pcId) { const f = $("fade"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 700); this.startCine(2000, { zoomAdd: 1, caption: "Wheeled into the kit room" }); } break;
      case "crawled": case "roof_run": case "stretchered": {
        if ((e.by ?? e.who) !== pcId) break;
        // The long way round: a fade to black, the sound of it, and a caption.
        const f = $("fade"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 700);
        if (e.type === "crawled") { a.play("drain", 1); this.startCine(2200, { zoomAdd: 1, caption: e.to === "grate" ? "Up through the shower drain" : "Back down the drain" }); }
        if (e.type === "crawled" && e.by === pcId) this.startDrain();
        else if (e.type === "roof_run") { a.play("ladder", 1); this.startCine(2200, { zoomAdd: 1, caption: "Over the roof and down the tunnel ladder" }); }
        else { a.play("groan", 1); this.startCine(2600, { zoomAdd: 1, caption: "Stretchered to the medical room" }); }
        break;
      }
      case "hid_body": a.play(e.where?.startsWith("bin") ? "zip_bin" : "bag", 1); this.say(e.where?.startsWith("bin") ? "Into the bin he goes." : "Out of sight.", "", false); break;
      case "car_horn": { const v = near(e.x, e.y, 40); if (v > 0) a.play("horn", (0.2 + v * 0.6) * (e.long ? 1 : 0.6), { minGap: 1.5, rate: e.long ? 0.9 : 1.15 }); break; }
      case "armed_called": case "armed_deployed": a.play("siren", 0.6, { minGap: 8 }); break;
      case "dog_sicced": a.play("pit_bark", 1, { minGap: 0.3 }); break;
      case "dog_noise": {
        this.dogNoiseAt = s.tick;
        const v = near(e.x, e.y, 30);
        if (v > 0) a.play(e.kind === "gnash" ? "pit_gnash" : e.kind === "bark" ? "pit_bark" : "pit_growl", 0.25 + v * 0.75, { minGap: 0.5 });
        break;
      }
      case "bus_crash": a.play("punch", 1, { rate: 0.5 }); a.play("horn", 0.7, { rate: 0.8 }); break;
      case "bus_sanction": a.play(e.reversed ? "boo" : "goal_roar", 0.8, { minGap: 2 }); break;
      case "say": {
        const by = s.actors[e.by];
        if (!by || e.by === pcId) break;
        const v = near(by.x, by.y, 14);
        if (v <= 0) break;
        const VOICE: Record<string, Clip> = {
          "Oi! You!": "stw_oi", "Right. Out you go.": "stw_out", "You can't be in here, pal. Come on.": "stw_pal",
          "Right. Penis detector, sir. Pop it in the slot, please.": "stw_slot", "That's him! That's the fat bald fella! It's a match!": "stw_knob",
          "Bit small. Bit hairy. Go on, then.": "stw_odd", "Jesus Christ. Go on through, sir. Go on.": "stw_bar",
          "Okay. We'll help cover this up for you. Off you go, mate.": "stw_cover", "Christ. Right. We never saw nothing. We'll help cover this up for you.": "stw_cover_dead",
          "You're coming with me.": "stw_coming", "Stop wriggling!": "stw_wriggle", "Staff only, mate.": "stw_staff",
        };
        // Stewards' lines come in two voices (which one depends on the steward), and only one person talks at once.
        if (STW_VOICE[e.text]) this.speak(`${STW_VOICE[e.text]}_${Math.abs(hash(e.by ?? "")) % 2 ? "a" : "b"}`, 0.35 + v * 0.65);
        else if (VOICE[e.text]) this.speak(VOICE[e.text], 0.35 + v * 0.65);
        else if (VOICES[e.text] && v > 0.05) {
          const who = s.actors[e.by], woman = who && this.spriteFor(who).base === "woman";
          this.speak(`${VOICES[e.text]}${woman ? "_f" : ""}`, 0.25 + v * 0.75, { rate: 0.95 + (Math.abs(hash(e.by ?? "")) % 10) / 100 });
        }
        if (e.text === "Get out the road!") a.play("horn", 0.3 + v * 0.7, { minGap: 2 });
        break;
      }
    }
  }

  nextChant = 8000;
  nextPub = 0;
  /** The crowd bed follows you: loud in the stands, a rumble outside, a murmur in the pub. */
  updateCrowd() {
    const pc = this.pc;
    if (!pc) return;
    const ar = areaAt(pc.x, pc.y), m = this.s.match!;
    let level: number, bright: number;
    if (ar.seats || ar.pitch) { level = 1; bright = 1; }
    else if (!ar.outside) { level = 0.6; bright = 0.3; }
    else if (ar.id === "pub") { level = 0.25; bright = 0.05; }
    else { level = pc.y < 62 ? 0.4 : 0.22; bright = pc.y < 62 ? 0.1 : 0.04; }
    if (m.phase === "pre") level *= 0.75;
    // Now and then the ground sings; the pub has its own din.
    const now = performance.now();
    if (now > this.nextChant && (m.phase === "live" || m.phase === "restart" || m.phase === "pre")) {
      this.nextChant = now + 22000 + Math.random() * 20000;
      this.audio.play(Math.random() < 0.6 ? "chant_eng" : "chant_clap", 0.15 + level * 0.55, { muffle: ar.seats || ar.pitch ? 0 : !ar.outside ? 0.4 : 0.75, minGap: 10 });
    }
    if (ar.id === "pub" && now > this.nextPub) { this.nextPub = now + 14500; this.audio.play("pub_bed", 0.55, { minGap: 10 }); }
    if (m.phase === "break" || m.phase === "finished") level *= 0.6;
    this.audio.setCrowd(level, bright);
  }

  // ---------- Static drawing ----------
  drawStatic() {
    const P = this.P;
    let g = this.staticG;
    g.clear();
    for (const a of AREAS) {
      if (a.id === "pitch") continue;
      g.fillStyle(a.floor, 1).fillRect(...P.rect(a.x, a.y, a.w, a.h));
    }
    // PixelLab floor tiles at 1:1: paving, tarmac, concrete, grass, pub carpet, lino, quarry tiles.
    for (const t of this.groundTiles) t.destroy();
    this.groundTiles = [];
    setQuietFloors(this.quiet);
    const FLOOR_OF: Record<string, string> = {
      street: "slabs", plaza: "slabs", road: "asphalt", eastroad: "asphalt", carpark: "tarmac", hotel_court: "slabs", ticket_office: "slabs", merch: "slabs",
      pub_yard: "herringbone", verge: "grass", concourse_s: "concourse", concourse_w: "concourse", concourse_e: "concourse", corner_sw: "concourse", corner_se: "concourse",
      corner_nw: "concourse", corner_ne: "concourse", loading: "gravel", staffway: "lino", players: "lino", tunnel: "lino", security: "office", ref_room: "lino",
      dress_home: "rubber", dress_away: "rubber", kitchen: "quarry", bar_s: "boards", toilet_s: "whitetile", cubicle_s: "whitetile", pub: "boards", pub_toilet: "whitetile",
      pub_cubicle: "whitetile", alley: "tarmac", kitroom: "rubber", medical: "whitetile", backcorr: "lino", cabin: "office", hotel: "office", charity: "boards", surplus: "lino", bookies: "office",
    };
    if (VENUE.features.fanZone) { FLOOR_OF.pub = "grass"; FLOOR_OF.pub_toilet = "slabs"; FLOOR_OF.pub_cubicle = "slabs"; }
    // Beyond the edge of the map: more pavement, and a palisade fence round it all.
    if (this.useSprites && P.standing) {
      const fk = ensureFloor(this, "asphalt");
      const [bx, by, bw, bh] = P.rect(BOUNDS.x - 40, BOUNDS.y - 30, BOUNDS.w + 80, BOUNDS.h + 60);
      if (fk) this.groundTiles.push(this.add.tileSprite(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh), fk).setOrigin(0).setDepth(0.1).setTilePosition(Math.round(bx), Math.round(by)).setTint(0xb0b0b0));
      const fence = (x: number, y: number, w: number, dep: number) => {
        const sx = Math.round(P.sx(x, 0)), sy = Math.round(P.sy(0, y)), fw = Math.round(w * P.S);
        this.groundTiles.push(this.add.tileSprite(sx, sy - 58, fw, 58, "mat-palisade").setOrigin(0).setDepth(dep).setTilePosition(0, 0));
      };
      // The railway embankment behind the alley fence: rough grass under the trees.
      const gk = ensureFloor(this, "grass");
      if (gk) {
        const ex = VENUE.id === "sf" ? 70.5 : BOUNDS.x - 40, [gx, gy, gw, gh] = P.rect(ex, BOUNDS.y - 30, 61.5, 84 - (BOUNDS.y - 30));
        this.groundTiles.push(this.add.tileSprite(Math.round(gx), Math.round(gy), Math.round(gw), Math.round(gh), gk).setOrigin(0).setDepth(0.3).setTilePosition(Math.round(gx), Math.round(gy)).setTint(0xa8b49c));
      }
      fence(BOUNDS.x, BOUNDS.y, BOUNDS.w, 0.5);
      fence(BOUNDS.x, BOUNDS.y + BOUNDS.h + 0.3, BOUNDS.w, 9e6);
      for (const x of [BOUNDS.x - 0.15, BOUNDS.x + BOUNDS.w]) {
        const g2 = this.add.graphics().setDepth(0.5);
        g2.fillStyle(0x25472e, 1).fillRect(Math.round(P.sx(x, 0)), Math.round(P.sy(0, BOUNDS.y)) - 58, 5, Math.round(BOUNDS.h * P.S) + 58);
        this.groundTiles.push(g2 as unknown as Phaser.GameObjects.TileSprite);
      }
    }
    if (this.useSprites) for (const a of AREAS) {
      const [rx, ry, rw, rh] = P.rect(a.x, a.y, a.w, a.h);
      let key: string | null = null;
      if (a.seats && P.standing) key = `mat-seats_${a.h > a.w ? "v" : "h"}${a.id === "stand_e" ? "_red" : ""}`;
      else if (FLOOR_OF[a.id]) key = ensureFloor(this, FLOOR_OF[a.id]);
      if (!key) continue;
      const ts = this.add.tileSprite(Math.round(rx), Math.round(ry), Math.round(rw), Math.round(rh), key).setOrigin(0).setDepth(0.2);
      // Line the pattern up with the world grid, so neighbouring areas of the same floor join seamlessly.
      ts.setTilePosition(Math.round(rx), Math.round(ry));
      if (a.seats) ts.setTilePosition(a.h > a.w ? Math.round(rx - P.sx(a.x + 0.6, 0)) : 0, a.h > a.w ? 0 : Math.round(ry - P.sy(0, a.y + 0.6) + 6));
      if (FLOOR_OF[a.id] === "concourse") ts.setTint(0xb4b8bc);
      this.groundTiles.push(ts);
    }
    // Light pools at the ways in: a soft radial glow, added on top of the ground.
    if (!this.textures.exists("glow")) {
      const cv = document.createElement("canvas"); cv.width = cv.height = 128;
      const cx = cv.getContext("2d")!, gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.45, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
      this.textures.addCanvas("glow", cv);
    }
    for (const l of this.doorGlows()) {
      const im = this.add.image(Math.round(P.sx(l.x, l.y)), Math.round(P.sy(l.x, l.y)), "glow").setDepth(0.6).setTint(l.col).setBlendMode(Phaser.BlendModes.ADD);
      im.setDisplaySize(l.r * 2 * P.S, l.r * 1.3 * P.S);
      this.groundTiles.push(im as unknown as Phaser.GameObjects.TileSprite);
    }
    // Road markings.
    const detail = this.detailG; detail.clear();
    g = detail;
    // Concourse concrete: expansion joints every four metres, a yellow line along the stand wall.
    {
      const cg = this.detailG;
      for (const a of AREAS) {
        if (FLOOR_OF[a.id] !== "concourse") continue;
        cg.fillStyle(0x7c8084, 0.5);
        for (let x = Math.ceil(a.x / 4) * 4; x < a.x + a.w; x += 4) cg.fillRect(...P.rect(x, a.y, 0.06, a.h));
        for (let y = Math.ceil(a.y / 4) * 4; y < a.y + a.h; y += 4) cg.fillRect(...P.rect(a.x, y, a.w, 0.06));
      }
      cg.fillStyle(0xd9b92a, 0.85).fillRect(...P.rect(-56, 38.5, 112, 0.14));
    }
    g.fillStyle(0xd8d2b8, 0.7);
    for (let x = -88; x < 90; x += 6) g.fillRect(...P.rect(x, 87.9, 3, 0.25));
    for (let y = -46; y < 90; y += 6) g.fillRect(...P.rect(66.9, y, 0.25, 3));
    // Kerbs along the roads, and marked bays in the car park.
    const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
    g.fillStyle(0xb9bdb6, 1);
    g.fillRect(...P.rect(-92, 83.8, 184, 0.25)).fillRect(...P.rect(-92, 92, 184, 0.25));
    g.fillRect(...P.rect(Math.min(mx(61.8), mx(62.05)), -50, 0.25, 134)).fillRect(...P.rect(Math.min(mx(71.8), mx(72.05)), -50, 0.25, 134));
    g.fillRect(...P.rect(-60, 59.9, 120, 0.2));
    this.streetDetail(g, mx);
    g.fillStyle(0xe8e4d4, 0.8);
    for (let x = 46; x <= 60; x += 2.6) { g.fillRect(...P.rect(Math.min(mx(x), mx(x + 0.15)), 73.5, 0.15, 4)); g.fillRect(...P.rect(Math.min(mx(x), mx(x + 0.15)), 78, 0.15, 4)); }
    // Seat rows.
    for (const a of AREAS.filter((x) => x.seats && !this.useSprites)) {
      const vertical = a.h > a.w;
      g.fillStyle(0x2c323e, 1);
      if (vertical) for (let x = a.x + 0.4; x < a.x + a.w; x += 1.1) g.fillRect(...P.rect(x, a.y, 0.35, a.h));
      else for (let y = a.y + 0.4; y < a.y + a.h; y += 1.1) g.fillRect(...P.rect(a.x, y, a.w, 0.35));
    }
    drawPitch(this.pitchG, P, false);
    // Area names, painted on the ground where useful.
    for (const t of this.labels) t.destroy();
    this.labels = [];
    this.drawWayfinding(g);
    const label = (text: string, x: number, y: number, size = 11) => {
      this.labels.push(this.add.text(P.sx(x, y), P.sy(x, y), text.toUpperCase(), { fontFamily: '"Silkscreen", "Pixelify Sans", monospace', fontSize: `${size + 2}px`, fontStyle: "800", color: "#ffffff", letterSpacing: 1.5 } as Phaser.Types.GameObjects.Text.TextStyle)
        .setOrigin(0.5).setAlpha(0.55).setResolution(Math.ceil(DPR * 2)).setDepth(1));
    };
    const SIGNED = new Set(["STAFF ENTRANCE", "THE THREE LIONS", "TICKETS", "MERCHANDISE", "TURNSTILES", "STEWARDS", "SECOND HAND ROSE", "ARMY & NAVY", "BOOKMAKER", "TEAM HOTEL", "FAN ZONE", "BIG SCREEN"]);
    for (const [t, x, y, size] of VENUE.labels) if (!this.useSprites || !SIGNED.has(t)) label(t, x, y, size ?? 11);
    // A fan zone has a big screen; a known face has posters at the turnstiles.
    if (VENUE.features.fanZone) {
      const pub = AREAS.find((a) => a.id === "pub")!;
      const sx = pub.x + pub.w / 2;
      g.fillStyle(0x111418, 1).fillRect(...P.rect(sx - 6, pub.y + 0.2, 12, 1.2));
      g.fillStyle(0x2f7d3b, 1).fillRect(...P.rect(sx - 5.6, pub.y + 0.35, 11.2, 0.9));
    }
    if (this.game2.campaign.notoriety >= 1) {
      for (const t of SPOTS.turnstiles) {
        g.fillStyle(0xf4f1ea, 1).fillRect(...P.rect(t.x - 2.6, 45.1, 1.2, 0.5));
        label("WANTED", t.x - 2, 46.9, 8);
      }
    }
    this.drawCrowd();
  }

  /** The street as a street: kerbs with a lit edge and a drop, double yellows, zebra crossings with
   *  Belisha beacons, drains, gum and fag ends on the slabs, shadow along every frontage, and a warm
   *  pool of light at every way in, so doors read from across the road. */
  streetDetail(g: Phaser.GameObjects.Graphics, mx: (x: number) => number) {
    const P = this.P;
    const R = (x: number, y: number, w: number, h: number) => { const x0 = Math.min(mx(x), mx(x + w)); return P.rect(x0, y, w, h); };
    // Kerbs: the pavement's lit edge, then the drop into the gutter.
    const kerbH = (x0: number, x1: number, y: number, down: 1 | -1) => {
      g.fillStyle(0xc9ccc4, 1).fillRect(...R(x0, down > 0 ? y - 0.16 : y, x1 - x0, 0.16));
      g.fillStyle(0x2a2c2e, 0.55).fillRect(...R(x0, down > 0 ? y : y - 0.12, x1 - x0, 0.12));
    };
    const kerbV = (x: number, y0: number, y1: number, down: 1 | -1) => {
      g.fillStyle(0xc9ccc4, 1).fillRect(...R(down > 0 ? x - 0.16 : x, y0, 0.16, y1 - y0));
      g.fillStyle(0x2a2c2e, 0.55).fillRect(...R(down > 0 ? x : x - 0.12, y0, 0.12, y1 - y0));
    };
    kerbH(-92, 92, 84, 1); kerbH(-92, 92, 92, -1);
    kerbV(62, -50, 84, 1); kerbV(72, -50, 84, -1);
    // Double yellow lines, broken at the crossings.
    const crossings = [-46, 2, 36];
    g.fillStyle(0xe0b52a, 0.85);
    for (const y of [84.3, 84.52, 91.38, 91.6]) {
      let x = -92;
      for (const cx of [...crossings, 200]) { const e = Math.min(92, cx - 2.6); if (e > x) g.fillRect(...R(x, y, e - x, 0.1)); x = cx + 2.6; }
    }
    for (const x of [62.3, 62.52, 71.38, 71.6]) g.fillStyle(0xe0b52a, 0.85).fillRect(...R(x, -48, 0.1, 130));
    // Zebra crossings, with a Belisha beacon each end.
    for (const cx of crossings) {
      for (let y = 84.75; y < 91.3; y += 0.9) g.fillStyle(0xeeeae0, 0.9).fillRect(...R(cx - 1.8, y, 3.6, 0.5));
      for (const y of [84.6, 91.4]) g.fillStyle(0xeeeae0, 0.7).fillRect(...R(cx - 2.2, y, 0.08, 0.05));
      for (const [bx, by] of [[cx - 2.4, 83.6], [cx + 2.4, 92.6]]) {
        g.fillStyle(0x000000, 0.25).fillEllipse(P.sx(mx(bx) + 0.15, by), P.sy(0, by), P.S * 0.5, P.S * 0.18);
        for (let k = 0; k < 6; k++) g.fillStyle(k % 2 ? 0x111111 : 0xeeeeee, 1).fillRect(P.sx(mx(bx), 0) - 1.5, P.sy(0, by) - (k + 1) * P.S * 0.32, 3, P.S * 0.32);
        g.fillStyle(0xf2a51a, 1).fillCircle(P.sx(mx(bx), 0), P.sy(0, by) - P.S * 2.05, P.S * 0.22);
        g.fillStyle(0xffe08a, 1).fillCircle(P.sx(mx(bx), 0) - 1, P.sy(0, by) - P.S * 2.1, P.S * 0.08);
      }
    }
    // Drains in the gutter every few metres.
    const drain = (x: number, y: number) => {
      g.fillStyle(0x1c1d1f, 1).fillRect(...R(x - 0.35, y, 0.7, 0.3));
      g.fillStyle(0x5a5d60, 1);
      for (let k = 0; k < 4; k++) g.fillRect(...R(x - 0.3 + k * 0.17, y + 0.04, 0.07, 0.22));
    };
    for (let x = -86; x < 90; x += 11) { if (crossings.every((c) => Math.abs(c - x) > 3)) { drain(x, 84.05); drain(x + 5, 91.6); } }
    // Gum, fag ends, cracks: deterministic, thick by the pub, the bookies and the turnstiles.
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spots: [number, number, number, number, number][] = [[-60, 46, 120, 14, 380], [-62, 80.6, 154, 3.3, 260], [-92, 92.3, 184, 3.6, 160], [-48, 80.6, 8, 3, 90], [28, 72.6, 16, 2, 60]];
    for (const [x0, y0, w, h, n] of spots) for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * w, y = y0 + rnd() * h, kind = rnd();
      if (kind < 0.55) g.fillStyle(rnd() < 0.5 ? 0xb8b8b2 : 0x9a9a94, 0.8).fillRect(Math.round(P.sx(mx(x), 0)), Math.round(P.sy(0, y)), 2, 2);
      else if (kind < 0.85) { g.fillStyle(0xe8e0cc, 0.9).fillRect(Math.round(P.sx(mx(x), 0)), Math.round(P.sy(0, y)), 3, 1); g.fillStyle(0xc87a3a, 0.9).fillRect(Math.round(P.sx(mx(x), 0)) + 3, Math.round(P.sy(0, y)), 1, 1); }
      else { g.lineStyle(1, 0x55585b, 0.6); const sx = P.sx(mx(x), 0), sy = P.sy(0, y); g.lineBetween(sx, sy, sx + 6 + rnd() * 10, sy + rnd() * 4 - 2); }
    }
    // Shadow along the foot of every building front.
    for (const b of buildings(VENUE)) {
      const { x0, x1, y1 } = b.rect;
      for (let k = 0; k < 4; k++) g.fillStyle(0x000000, 0.18 - k * 0.04).fillRect(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1)) + k * 3, Math.round((x1 - x0) * P.S), 3);
    }
  }

  /** The stadium's front, built from painted bays: cladding, a glazed stair tower, and the crest bay over
   *  the turnstiles in the middle. One picture, made once per ground. */
  stadiumFront(x0: number, x1: number): string | null {
    const key = `stadfront-${VENUE.id}`;
    if (this.textures.exists(key)) return key;
    if (!["a", "b", "c"].every((k) => this.textures.exists(`w-bay-${k}`))) return null;
    const S = PPM, W = Math.round((x1 - x0) * S), H = 9 * S;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d")!; cx.imageSmoothingEnabled = false;
    const bay = (k: string, wx: number, flip: boolean) => {
      const src = this.textures.get(`w-bay-${k}`).getSourceImage() as HTMLImageElement;
      const px = Math.round((wx - x0) * S);
      cx.save();
      if (flip) { cx.translate(px + 16 * S, 0); cx.scale(-1, 1); cx.drawImage(src, 0, 0, src.width, src.height, 0, 0, 16 * S, H); }
      else cx.drawImage(src, 0, 0, src.width, src.height, px, 0, 16 * S, H);
      cx.restore();
    };
    // Out from the crest: cladding, stairs, cladding, and a part bay to finish each end.
    const order = ["a", "b", "a", "b"];
    for (let k = 0; k < 4; k++) { bay(order[k], -24 - 16 * k, false); bay(order[k], 8 + 16 * k, true); }
    bay("c", -8, false);
    this.textures.addCanvas(key, cv);
    return key;
  }

  cutDone = false;
  /** The building you're inside, if any (rooms are shown on their own). */
  roomId: string | null = null;
  roomSnap = false;
  /** What's drawn as inside: changes while the screen is black, not before. */
  roomShown: string | null = null;
  roomMask: Phaser.GameObjects.Graphics | null = null;
  enterRoom(id: string | null) {
    const first = this.roomId === null && id === null;
    this.roomId = id;
    if (first || !this.started) { this.roomSnap = true; this.roomShown = id; return; }
    // Through the door: a quick dip to black, the camera already where it needs to be when it lifts.
    const f = $("fade");
    f.classList.add("door", "on");
    this.audio.play("op_door" as Clip, 0.35, { minGap: 0.5 });
    // What the place sounds like as the door goes: the bell on its spring over a shop door, the
    // bookie's electronic chime, the bell on the hotel desk, the pub's roar. And its name, in its
    // own colours off the sign, so you know where you've walked into (Stardew's shop entrances, the
    // location card in Yakuza).
    const b = id ? this.blds.find((x) => x.id === id) : undefined;
    if (b) {
      const snd: Record<string, Clip> = { charity: "shop_bell", surplus: "shop_bell", bookies: "door_chime", hotel: "desk_bell", pub: "pub_bed" };
      if (snd[b.id]) setTimeout(() => this.audio.play(snd[b.id], b.id === "pub" ? 0.5 : 0.7, { minGap: 2 }), 90);
      if (b.id === "pub") this.nextPub = performance.now() + 14500;
      // Walking in through the front (not back out, not dragged, not twice in quick succession):
      // the little doorway beat, with the lights coming up on the room behind it.
      const now = performance.now(), pc = this.pc;
      if (b.sign && !pc.heldBy && !pc.dragging && now - (this.lastDoorway[b.id] ?? -1e9) > 20000) {
        this.lastDoorway[b.id] = now;
        const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`, kind = b.doors[0]?.kind;
        const door = kind === "pub" ? "door_pub" : kind === "shop" ? "door_shop" : kind === "glass" ? "door_steel" : "door_shut";
        const { base, rc } = this.spriteFor(pc), key = this.bank.variant(base, rc);
        setTimeout(() => { this.roomSnap = true; this.roomShown = this.roomId; }, 120);
        void this.doorway.play({ door, sign: b.sign.text, bg: hex(b.sign.bg), fg: hex(b.sign.fg), wall: ({ pub: "#1f3b2a", charity: "#7da597", surplus: "#55603f", bookies: "#2e3a2e", hotel: "#cfc6b4", cabin: "#6f7a62" } as Record<string, string>)[b.id] ?? "#555",
          walk: (i) => {
            const tk = this.textures.exists(`${key}-walk`) ? `${key}-walk` : `${key}-rot`;
            if (!this.textures.exists(tk)) return null;
            const fr = this.textures.getFrame(tk, tk.endsWith("-walk") ? dirIndex(-Math.PI / 2) * 8 + i : dirIndex(-Math.PI / 2));
            return { img: fr.source.image as CanvasImageSource, sx: fr.cutX, sy: fr.cutY, sw: fr.cutWidth, sh: fr.cutHeight, foot: feetOf(base) };
          } }).then(() => { f.classList.remove("on"); setTimeout(() => f.classList.remove("door"), 250); this.roomCard(b); });
        return;
      }
      this.roomCard(b);
    }
    setTimeout(() => { this.roomSnap = true; this.roomShown = this.roomId; }, 120);
    setTimeout(() => { f.classList.remove("on"); setTimeout(() => f.classList.remove("door"), 250); }, 170);
  }
  /** The lead or fix you've chosen to follow (Hitman's tracked mission story). Optional, one at a time. */
  tracked: Tracked | null = null;
  trackT: ReturnType<typeof trackTarget> = null;
  todoAt = 0;
  todoKey = "";
  todoOpenUntil = 0;
  /** Holding Instinct: what you can use, who matters, where they're looking. */
  instinct = false;
  instLabels: Phaser.GameObjects.Text[] = [];
  /** The HUD bits that guide without nagging: the tracked line and the notepad of nearby jobs. */
  updateGuides() {
    const pc = this.pc, now = performance.now();
    const tEl = $("track");
    this.trackT = this.tracked ? trackTarget(this.w, this.tracked) : null;
    if (this.tracked && this.trackT?.done) { this.toastTick(`✓ ${this.trackT.label}`); this.tracked = null; this.trackT = null; }
    if (this.trackT) {
      const d = Math.round(Math.hypot(this.trackT.x - pc.x, this.trackT.y - pc.y)), short = this.trackT.text.length > 64 ? this.trackT.text.slice(0, 62).replace(/\s+\S*$/, "") + "…" : this.trackT.text;
      const html = `<b>★ ${esc(this.trackT.label)}</b> <i>${d} m</i><span>${esc(short)}</span>`;
      if (tEl.innerHTML !== html) tEl.innerHTML = html;
      tEl.hidden = false;
    } else if (!tEl.hidden) tEl.hidden = true;
    // The notepad: two jobs, nearest first (those with a place), with what they pay. Once a second.
    if (now - this.todoAt < 1000) return;
    this.todoAt = now;
    if (this.useMode && (now > this.useMode.until || !this.s.items[this.useMode.item] || this.s.items[this.useMode.item].loc.k === "gone")) this.endUse();
    // Something new in your hands or pockets: what it's for, once ever per kind of thing.
    if (this.itemsPrimedFor !== this.game2) { this.itemsPrimedFor = this.game2; for (const id of [pc.hand, ...pc.pockets]) if (id && this.s.items[id]) this.seenItems.add(this.s.items[id].def); }
    if (!this.callOn && !this.sheetKind && !pc.heldBy && now - this.itemCardAt > 8000) {
      const mine = [pc.hand, ...pc.pockets].filter((x): x is string => !!x).map((id) => this.s.items[id]).filter((it) => it && ITEM_TIPS[it.def] && !this.seenItems.has(it.def));
      if (mine[0]) this.itemCard(mine[0]);
    }
    // Ideas: the first time you're near something with possibilities, a thought for the notes.
    if (this.curiosFor !== this.game2) { this.curiosFor = this.game2; this.curios = new Set(); }
    if (!this.callOn && !this.sheetKind && !pc.heldBy && !pc.hiddenIn && now - this.itemCardAt > 6000 && this.s.tick > 60 * 8 && !(this.pcLine && this.pcLine.until > now)) {
      const c = curioHere(this.w, pc, this.curios);
      if (c) {
        this.curios.add(c.id); this.itemCardAt = now;
        this.say(c.text, "Idea", false, false);
        this.pcLine = { text: c.short, until: now + 3400 };
        this.audio.play("chime", 0.35, { rate: 1.25 });
      }
    }
    // Ricky rings, a couple of minutes in, if you haven't got his number.
    if (!this.incoming.ricky && !knows(this.w, "dealer") && this.s.tick > 60 * 140 && !pc.heldBy) void this.incomingCall("ricky", "Spliff Ricky", "ricky", [["r", "Alright, it's Ricky. Gaz gave me your number. Laxatives, burners, a bit of gear. Ring me. Don't say my name.", "v_in_ricky"], ["g", "What?", "v_ph_gwhat"]], "number");
    // Only what has to be done: get in, and sort out whatever could stop England (the fixes you've
    // heard about; before that, a nudge to listen). The optional paid stuff is in Side jobs.
    const st0 = this.s.stadium!, f0 = st0.flags, must: string[] = [];
    if (this.job) must.push(`NOW: ${this.job.short}`);
    if (!st0.admitted && !pc.fb) must.push("Get into the ground");
    const known = FIXES.filter((fx) => f0[`fix_${fx.id}`] && !f0[`fixdone_${fx.id}`]);
    // The match's job already names one of them: don't say it twice.
    const named = this.job?.target ? (this.job.id.includes("star") ? "star" : this.job.id.includes("gk") ? "keeper" : this.job.id.includes("ref") ? "ref" : "") : "";
    if (known.length) for (const fx of known) if (fx.id !== named) must.push(`Sort out ${fx.title(this.w).replace(/^Their/, "their").replace(/^The/, "the")}`);
    else if (fixesDone(this.w) < FIXES.length) must.push("Find out what could stop England winning. Listen to people.");
    const nEl = $("todo");
    // The day's timetable (a matchday programme's): the next thing that happens, with how long till it.
    const tNow = this.s.tick / 60 - (st0.arrivedAt ?? 0) / 60;
    const SCHED: [number, string][] = [[KICKOFF_AT - DEPART_BEFORE_KICKOFF, "Their coach leaves the hotel"], [rushAt(), "The gates rush: big queues"], [KICKOFF_AT - 100, "Lenny the mascot's fag break ends"], [KICKOFF_AT, "Kick-off"]];
    const next = SCHED.find(([at]) => at > tNow), left = next ? next[0] - tNow : 0, soon = !!next && left < 30;
    // It opens out when something on it changes, then folds away to a tab after a few seconds (tap the
    // tab to look again), so it isn't sat over the game the whole time.
    const key = must.join("|") + (soon ? `|${next![1]}` : "");
    if (key !== this.todoKey) { const first = !this.todoKey; this.todoKey = key; if (!first) this.todoOpenUntil = now + 6000; }
    const open = now < this.todoOpenUntil;
    nEl.classList.toggle("shut", !open);
    const nx = next && !st0.admitted ? `<p class="nx">NEXT <i>${fmtTime(left)}</i> ${esc(next[1])}</p>` : "";
    const html = open ? `<b>TO DO</b>${must.length ? must.slice(0, 3).map((t) => `<p>☐ ${esc(t)}</p>`).join("") : "<p>Watch England win.</p>"}${nx}<p class="side">Side jobs ▸</p>`
      : `<b>TO DO${must.length ? ` · ${Math.min(3, must.length)}` : " ✓"}</b>`;
    // Pointing you at the side jobs once you're into it (and a dot on the menu till you've looked).
    if (!this.flags.jobsHint && this.s.tick > 60 * 120 && !pc.heldBy) { this.flags.jobsHint = 1; this.hint("There's money in mayhem. Tap Side jobs on your notes (or the menu) to see what pays."); $("menuBtn").classList.add("dot"); }
    if (nEl.innerHTML !== html) nEl.innerHTML = html;
    nEl.hidden = !this.started || !!this.fp?.on || this.inCab() || this.callOn || !!this.ring || (!$("itemCard").hidden && window.innerHeight < 520);
  }
  /** One-off view hints. */
  flags: Record<string, number> = {};
  doorway = new Doorway();
  gateFlash: Record<string, number> = {};
  /** Showing your ticket: it goes into the reader, a beep and a green light, and the flaps clunk
   *  back (or a buzz and a red light). A beat you see and hear, not just a line of text. */
  scanCard(ok: boolean) {
    const el = $("scanCard");
    el.className = ok ? "ok" : "bad";
    el.innerHTML = `<div class="reader"><i class="lamp"></i><div class="slot"></div></div>${icon("ticket")}<b>${ok ? "ENJOY THE GAME" : "REJECTED"}</b>`;
    el.hidden = false; void el.offsetWidth; el.classList.add("go");
    setTimeout(() => this.audio.play(ok ? "scan_beep" : "scan_bad", 0.8), 380);
    if (ok) setTimeout(() => this.audio.play("turnstile_clunk", 0.9), 720);
    clearTimeout(this.scanTimer); this.scanTimer = window.setTimeout(() => { el.hidden = true; }, 2200);
  }
  scanTimer = 0;
  /** The fruit machine's window: three reels that spin and stop one by one on what the sim rolled. */
  fruitSpin(reels: string[], win: number) {
    const el = $("fruit");
    el.innerHTML = `<div class="fm"><div class="top">THREE LIONS · £1 A GO</div><div class="reels">${[0, 1, 2].map((i) => `<canvas width="36" height="36" data-r="${i}"></canvas>`).join("")}</div><b class="msg"></b></div>`;
    el.hidden = false;
    const cvs = [...el.querySelectorAll("canvas")] as HTMLCanvasElement[], SYM = ["lion", "cherry", "bell", "pint", "bar"];
    const draw = (cv: HTMLCanvasElement, sym: string, off = 0) => {
      const c = cv.getContext("2d")!; c.imageSmoothingEnabled = false;
      c.fillStyle = "#f4efe0"; c.fillRect(0, 0, 36, 36);
      c.save(); c.translate(0, off);
      if (sym === "cherry") { c.fillStyle = "#3a7a2a"; c.fillRect(17, 6, 2, 12); c.fillRect(12, 8, 2, 10); c.fillStyle = "#c8102e"; c.fillRect(8, 18, 9, 9); c.fillRect(18, 20, 9, 9); c.fillStyle = "#ff8a8a"; c.fillRect(10, 20, 2, 2); c.fillRect(20, 22, 2, 2); }
      else if (sym === "bell") { c.fillStyle = "#e0a820"; c.fillRect(12, 8, 12, 4); c.fillRect(10, 12, 16, 12); c.fillRect(7, 24, 22, 4); c.fillStyle = "#7a5a10"; c.fillRect(16, 28, 4, 3); }
      else if (sym === "pint") { c.fillStyle = "#d89a2a"; c.fillRect(11, 12, 14, 18); c.fillStyle = "#fff"; c.fillRect(10, 7, 16, 6); c.fillStyle = "#b8b8c0"; c.fillRect(25, 15, 4, 8); }
      else if (sym === "bar") { c.fillStyle = "#111"; c.fillRect(5, 13, 26, 10); c.fillStyle = "#f2c94c"; c.font = "bold 9px monospace"; c.textAlign = "center"; c.fillText("BAR", 18, 21); }
      else { c.fillStyle = "#1b2a6b"; c.fillRect(6, 6, 24, 24); c.fillStyle = "#f2c94c"; c.font = "bold 18px monospace"; c.textAlign = "center"; c.fillText("★", 18, 25); }
      c.restore();
    };
    const t0 = performance.now();
    this.audio.play("stw_slot" as Clip, 0.6, { minGap: 0.1 });
    const step = () => {
      const t = performance.now() - t0;
      cvs.forEach((cv, i) => {
        const stopAt = 600 + i * 380;
        if (t < stopAt) draw(cv, SYM[Math.floor(t / 70 + i * 2) % SYM.length], ((t / 7) % 36) - 18);
        else draw(cv, reels[i]);
        if (t >= stopAt && !cv.dataset.done) { cv.dataset.done = "1"; this.audio.play("tap", 0.8); }
      });
      if (t < 600 + 2 * 380 + 50) { requestAnimationFrame(step); return; }
      const msg = el.querySelector(".msg") as HTMLElement;
      msg.textContent = win ? `WINNER  +£${win}` : "NOTHING. AGAIN?";
      el.classList.toggle("won", win > 0);
      if (win) { this.audio.play("kaching", 1); const money = $("money"); money.classList.remove("earned"); void money.offsetWidth; money.classList.add("earned"); }
      clearTimeout(this.fruitTimer); this.fruitTimer = window.setTimeout(() => { el.hidden = true; }, 1600);
    };
    step();
  }
  fruitTimer = 0;
  lastDoorway: Record<string, number> = {};
  /** The place's name across the top as you walk in, in the colours of the sign over its door. */
  roomCard(b: BuildingSpec): void {
    if (!b.sign) return;
    const el = $("roomCard"), hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
    const sub: Record<string, string> = { charity: "Charity shop · open", surplus: "Army surplus · cash only", bookies: "Pawnbroker · cash for anything", hotel: "Team hotel · staff and players only", pub: "Free house", cabin: "Stewards only" };
    el.innerHTML = `<b>${esc(b.sign.text)}</b>${sub[b.id] ? `<small>${esc(sub[b.id])}</small>` : ""}`;
    el.style.background = hex(b.sign.bg); el.style.color = hex(b.sign.fg);
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    clearTimeout(this.cardTimer); this.cardTimer = window.setTimeout(() => { el.hidden = true; }, 2300);
  }
  cardTimer = 0;
  /** Black out everything but the room you're in (its floor and the painted back wall above it). */
  drawRoomMask(room: BuildingSpec | undefined) {
    if (!this.roomMask) this.roomMask = this.add.graphics().setDepth(9.9e6);
    const g = this.roomMask.clear();
    if (!room) return;
    const P = this.P, v = this.cameras.main.worldView, r = room.rect, pad = 40;
    const x0 = P.sx(r.x0, 0) - 2, x1 = P.sx(r.x1, 0) + 2, y0 = P.sy(0, r.y0) - 3.2 * P.S, y1 = P.sy(0, r.y1) + 4;
    const X0 = v.x - pad, X1 = v.right + pad, Y0 = v.y - pad, Y1 = v.bottom + pad;
    g.fillStyle(0x07080b, 1);
    g.fillRect(X0, Y0, X1 - X0, Math.max(0, y0 - Y0));
    g.fillRect(X0, y1, X1 - X0, Math.max(0, Y1 - y1));
    g.fillRect(X0, y0, Math.max(0, x0 - X0), y1 - y0);
    g.fillRect(x1, y0, Math.max(0, X1 - x1), y1 - y0);
    // A soft inner edge, like light falling off at the walls.
    for (let i = 1; i <= 4; i++) {
      const e = i * 3;
      g.lineStyle(3, 0x07080b, 0.22).strokeRect(x0 + e - 1.5, y0 + e - 1.5, x1 - x0 - 2 * e + 3, y1 - y0 - 2 * e + 3);
    }
  }
  /** One voice at a time: nobody talks over anybody (the bubbles still show). */
  voiceUntil = 0;
  speak(clip: string, vol: number, opts: { rate?: number } = {}): void {
    const now = performance.now();
    if (now < this.voiceUntil) return;
    const d = this.audio.play(clip as Clip, vol, { minGap: 0.3, ...opts });
    this.voiceUntil = now + (d > 0 ? d * 1000 + 150 : 1800);
  }

  lkGhost: Phaser.GameObjects.Image | null = null;
  eyeMeter = 1;
  reflexUntil = 0; reflexUses = 0; reflexReadyAt = 0;
  /** One order queued behind the one he's carrying out (the Desperados limit: never more than that). */
  nextPursue: typeof this.pursue = null;

  /** Pushing at a door you can't get through: how you might. */
  gateHintAt = new Map<string, number>();
  doorHints() {
    const pc = this.pc;
    if (!pc || pc.hiddenIn || pc.heldBy || Math.hypot(pc.moveX, pc.moveY) < 0.3) return;
    const ap = appearance(this.s, pc), vest = !!pc.worn.outer && this.s.items[pc.worn.outer]?.def === "hivis";
    const HINT: Record<string, string> = {
      turnstile: vest ? "Turnstile. In that vest, just flash it at the turnstile steward: you're working." : "Turnstile. Show a ticket (the ticket office, or the tout by the plaza), flash a press pass, wear a steward's hi-vis, or tell them the dog's a service dog.",
      staffdoor: ap.role === "steward" || ap.role === "catering" || ap.role === "cleaner" ? "Staff door. The doorman lets staff in: walk up to him looking like you belong." : "Staff door: staff only. Dress as a steward, a cleaner or catering (the charity shop, or someone's clothes), and the doorman waves you in.",
      playersdoor: "Players' entrance: it takes the kit man's swipe card. Wally's got it on him. Or hide in his laundry hamper by the door and get wheeled in.",
      officedoor: "Security office. A staff pass gets you in, or flatten the chief. Being caught gets you in too.",
      servicegate: "Service gate: it opens for deliveries. Hide in the back of the delivery lorry, or drive something big through it.",
    };
    for (const wl of SOLID) {
      if (!wl.gate) continue;
      const cx = Math.max(wl.x, Math.min(pc.x, wl.x + wl.w)), cy = Math.max(wl.y, Math.min(pc.y, wl.y + wl.h));
      if (Math.hypot(pc.x - cx, pc.y - cy) > pc.radius + 0.25) continue;
      if (mayPass(this.w, pc, wl.gate)) continue;
      const kind = wl.gate.startsWith("turnstile") ? "turnstile" : wl.gate;
      const now = performance.now();
      if (!HINT[kind] || now - (this.gateHintAt.get(kind) ?? -1e9) < 25000) return;
      this.gateHintAt.set(kind, now);
      this.audio.play("nope", 0.5);
      this.hint(HINT[kind]);
      return;
    }
  }

  /** Warm light spilling out of every public way in (and the bookies' neon), so you can see the doors from across the road. */
  doorGlows(): { x: number; y: number; col: number; r: number }[] {
    const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
    const out = [
      { x: -46, y: 81.4, col: 0xffb347, r: 2.6 }, { x: -12.6, y: 73.3, col: 0xffe0a0, r: 1.8 }, { x: 15, y: 73.3, col: 0xffe0a0, r: 1.8 },
      { x: 36, y: 73.3, col: 0xc070ff, r: 2.2 }, { x: 82, y: -13, col: 0xfff0c0, r: 2.4 }, { x: 21, y: 50.6, col: 0x9ad0ff, r: 1.8 }, { x: -21, y: 50.6, col: 0xffd080, r: 1.8 },
    ];
    for (const t of SPOTS.turnstiles) out.push({ x: t.x, y: 46.2, col: 0xfff3b0, r: 1.6 });
    return out.map((o) => ({ ...o, x: mx(o.x) }));
  }

  crowdImgs: { im: Phaser.GameObjects.Image; y: number; ph: number; sp: number; x: number; wy: number; fr: number; away: boolean }[] = [];
  /** The whole ground up on its feet (a goal, a near miss) until this time. */
  crowdUpUntil = 0;
  crowdUpSide: "home" | "away" | "all" = "all";
  /** The seated crowd fidgets, and rises the nearer the ball gets to a goal at their end. */
  stirCrowd(): void {
    if (!this.crowdImgs.length || (this.s.tick & 1)) return;
    const t = performance.now() / 1000, b = this.s.match!.ball, m = this.s.match!;
    const live = m.phase === "live" || m.phase === "restart";
    const heat = live ? Math.max(0, (Math.abs(b.x) - (HL - 22)) / 22) : 0;
    for (const c of this.crowdImgs) {
      const near = heat * Math.max(0, 1 - Math.abs(c.x - Math.sign(b.x) * HL) / 40);
      const bob = Math.sin(t * c.sp + c.ph);
      // Arms up: everyone for a goal (their side), the near end when it's tight, a few anyway.
      const up = (performance.now() < this.crowdUpUntil && (this.crowdUpSide === "all" || (this.crowdUpSide === "away") === c.away)) || near > 0.55 && bob > 0.2 || bob > 0.985;
      c.im.setFrame(c.fr + (up ? 4 : 0));
      c.im.y = c.y - (bob > 0.75 - near * 0.9 ? 1 + Math.round(near * 3) : 0);
    }
  }

  drawCrowd() {
    const P = this.P, g = this.crowdG;
    g.clear();
    this.crowdBlit?.destroy(); this.crowdBlit = null; this.crowdImgs = [];
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const opp = this.s.match!.teams[1];
    const sprites = this.useSprites && this.bank.ready();
    // Colour schemes for the seated crowd: three England shirts and two of theirs, each in three skins.
    const SK = [0xf1c7a5, 0xd9a47e, 0x8a5a3b];
    // Three bodies (fat bloke, lad, woman) x five shirts x three skins.
    const schemes: (Recolour & { base?: Base })[] = [];
    for (const base of ["fan", "lad", "woman"] as Base[])
      for (const sh of [{}, { shirt: 0xc8102e, trim: 0xf4f4f4 }, { shirt: 0x1b2a6b, trim: 0xf4f4f4 }, { shirt: opp.colour, trim: opp.colour2 }, { shirt: opp.colour2, trim: opp.colour }] as Recolour[])
        for (const sk of SK) schemes.push({ ...sh, skin: sk, base });
    if (sprites && !this.textures.exists(`crowd3-${opp.short}`)) this.bank.crowdAtlas(`crowd3-${opp.short}`, schemes);
    const scale = P.S === PPM ? 1 : (1.62 * P.KZ * P.S) / (FEET - HEAD);
    const blit = sprites ? this.add.container(0, 0).setDepth(0.4) : null;
    type Seat = { x: number; y: number; row: number; f: number; shirt: number };
    const seats: Seat[] = [];
    for (const a of AREAS.filter((x) => x.seats)) {
      const away = a.id === "stand_e";
      // Everyone faces the pitch.
      const f = a.id === "stand_s" ? 2 : a.id === "stand_n" ? 0 : a.id === "stand_w" ? 1 : 3;
      for (let y = a.y + 0.6; y < a.y + a.h - 0.3; y += 1.1) {
        for (let x = a.x + 0.6; x < a.x + a.w - 0.3; x += 0.9) {
          if (rnd() < 0.42 || areaAt(x, y).id !== a.id) continue;
          const pickShirt = away ? (rnd() < 0.7 ? 3 : 4) : rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2;
          const skin = Math.floor(rnd() * 3), b = rnd(), body = b < 0.55 ? 0 : b < 0.8 ? 1 : 2;
          seats.push({ x, y, row: body * 15 + pickShirt * 3 + skin, f, shirt: pickShirt });
        }
      }
    }
    seats.sort((p, q) => p.y - q.y);
    for (const st of seats) {
      const sx = P.sx(st.x, st.y), sy = P.sy(st.x, st.y);
      if (blit) {
        const im = this.add.image(Math.round(sx), Math.round(sy), `crowd3-${opp.short}`, st.row * 8 + st.f).setOrigin(0.5, 46 / 52).setScale(scale);
        // The filler crowd is background: darker and cooler, so the fans who are people (and you) stand out.
        if (this.quiet) im.setTint(0x9ea3ad);
        blit.add(im);
        this.crowdImgs.push({ im, y: Math.round(sy), ph: rnd() * Math.PI * 2, sp: 1.5 + rnd() * 2.5, x: st.x, wy: st.y, fr: st.row * 8 + st.f, away: st.shirt >= 3 });
        continue;
      }
      const shirt = [0xf4f4f4, 0xc8102e, 0x1b2a6b, opp.colour, opp.colour2][st.shirt];
      const h = (P.standing ? 0.9 * P.KZ : 0.3) * P.S;
      g.fillStyle(shirt, 1).fillRect(sx - P.S * 0.28, sy - h, P.S * 0.56, h);
      g.fillStyle(SKIN[st.row % SKIN.length], 1).fillCircle(sx, sy - h - P.S * 0.16, P.S * 0.17);
    }
    this.crowdBlit = blit;
  }


  /** Exploring: about 40 metres across. Sitting: the whole width of the pitch, like the telly. */
  targetZoom() {
    const w = this.scale.width, h = this.scale.height;
    // Sat watching: a TV camera on the ball, close enough to read the players (34 m across); the zoom
    // button steps in closer (26 m) or out to the whole pitch (60 m).
    if (this.pc?.seated) { const span = [34, 26, 60][Math.min(this.zoomLevel, 2)]; return Math.min(w / (span * this.P.S), h / (span * 0.72 * this.P.S * this.P.K)); }
    // Whole screen pixels per art pixel, so every pixel of the art is the same size; a bigger screen shows more.
    const steps = zoomSteps();
    if (this.cine && !this.pc?.seated) return steps[Math.min(this.zoomLevel, steps.length - 1)] + this.cine.zoomAdd;
    // Indoors: step in as far as the room still fits the screen (small shops fill it; the pub doesn't need to).
    if (this.roomShown && !this.cine) {
      const b = this.blds.find((x) => x.id === this.roomShown);
      if (b) {
        const base = steps[Math.min(this.zoomLevel, steps.length - 1)], rw = (b.rect.x1 - b.rect.x0) * this.P.S, rh = (b.rect.y1 - b.rect.y0 + 3) * this.P.S * this.P.K;
        let z = base;
        while (z + 1 <= base + 2 && rw * (z + 1) <= w * 0.96 && rh * (z + 1) <= h * 0.78) z += 1;
        return z;
      }
    }
    // On a phone, step in during a fight, then back out.
    if (this.zoomLevel === 0 && performance.now() < this.fightZoomUntil && Math.min(window.innerWidth, window.innerHeight) < 520) return steps[0] + 1;
    return steps[Math.min(this.zoomLevel, steps.length - 1)];
  }
  zoomLevel = 0;
  cycleZoom() {
    this.zoomLevel = (this.zoomLevel + 1) % zoomSteps().length;
    $("zoomBtn").textContent = this.zoomLabel();
    try { localStorage.setItem("kd-zoom2", String(this.zoomLevel)); } catch { /* ignore */ }
  }
  zoomLabel(): string { const st = zoomSteps(), z = st[Math.min(this.zoomLevel, st.length - 1)] / st[0]; return z === 1 ? "1×" : z > 1 ? `${+z.toFixed(1)}×` : "½×"; }
  setZoom() { this.cameras.main.setZoom(this.targetZoom()); }

  // ---------- Frame ----------
  update(_t: number, dms: number) {
    if (!this.started) { this.draw(dms); return; }
    if (this.pt) { this.pt.frame(this.speed === 0 || !!this.callOn); if (this.s.tick % 600 === 0) this.pt.save(); }
    if (this.s.tick % 20 === 0) this.progressiveUI();
    if (this.s.tick % 10 === 0) this.cokeFx();
    if (this.s.tick % 30 === 0) this.directJob();
    // In the gate-rush crush for the first time: Grozz clocks it.
    if (!this.flags.crushSaid && (this.s.stadium!.flags.crowdCover ?? 0) > this.s.tick) { this.flags.crushSaid = 1; this.pcLine = { text: "Packed in like this, they can't see a thing. Heh.", until: performance.now() + 3200 }; }
    const st = this.s.stadium!;
    if (!st.ending) {
      this.applyInput();
      const ann = (this as any).announcer as Announcer;
      const now = performance.now(), dt = dms / 1000;
      // The Gaffer's Eye: while the ring's open the world slows to a crawl, on a meter that drains
      // while you look and fills back up when you don't (so you can't live in it).
      const eye = !!this.ring && this.eyeMeter > 0;
      this.eyeMeter = eye ? Math.max(0, this.eyeMeter - dt / 5) : Math.min(1, this.eyeMeter + dt / 14);
      const slow = now < this.reflexUntil ? 0.22 : now < this.slowUntil ? 0.3 : eye ? 0.2 : 1;
      if (performance.now() >= this.hitStopUntil) this.stepper.advance((dms * slow) / 1000, () => { stepGame(this.game2); ann.tick(); this.applyInput(); }, 24);
    }
    this.updateDetain();
    if (st.ending && $("ending").hidden && !this.endingShown) { this.endingShown = true; this.showEnding(); }
    if (!st.ending) this.endingShown = false;
    this.draw(dms);
    const driving = st.vehicles.bus?.drivenBy === this.pc?.id;
    ($("viewBtn") as HTMLElement).hidden = !driving;
    ($("hornBtn") as HTMLElement).hidden = !driving;
    const inCar = !!st.myCar?.driving && this.pc?.hiddenIn === "car";
    this.audio.engineOn((driving || inCar) && !st.ending, inCar ? st.myCar!.speed * 0.8 : st.vehicles.bus?.speed ?? 0);
    if (st.horse?.rider === this.pc?.id && st.horse!.speed > 3) this.audio.play("hooves", 0.25 + st.horse!.speed / 20, { minGap: 2.6 });
    if (this.inCab()) this.d3.draw(this.s, this.driveView, this.scale.width / DPR, this.scale.height / DPR, (a) => this.styleOf(a), this.pc.drive?.steer ?? 0, this.cameras.main.zoom, DPR);
    else { this.d3.hide(); this.d3.hideSpeed(); }
    this.drawHud();
    if (this.scoped && (!this.pc || !rifleOf(this.w, this.pc) || this.pc.heldBy || this.pc.downUntil > this.s.tick + 30)) this.exitScope();
    if (this.fp.on && this.pc) this.drawFirstPerson();
    if (this.scoped) { const r = $("scope").querySelector<HTMLElement>(".reticle"); if (r) r.style.transform = `translate(-50%, calc(-50% + ${this.scopePitch.toFixed(1)}px))`; this.scopePitch *= 0.9; }
    this.stepCine();
    this.stepPopups();
    if ((this.s.tick & 15) === 0) this.updateCrowd();
    if (this.pc) this.stall.update(inCubicle(this.pc) && !this.pc.hiddenIn && !st.ending, holeState(this.w), !!knifeOn(this.w, this.pc));
  }

  toggleFirstPerson(): void {
    const on = !this.fp.on;
    this.fp.show(on);
    this.cameras.main.setVisible(!on);
    $("fpBtn").classList.toggle("on", on);
    // In first person the button's the way back out; otherwise it lives in the menu.
    $("fpBtn").hidden = !on || this.scoped;
  }

  // ---------- Held in the security office, side on ----------
  detain: Detain | null = null;
  chiefActor(): Actor | undefined { return Object.values(this.s.actors).find((a) => a.npc?.job === "chief"); }
  updateDetain() {
    const st = this.s.stadium!;
    if (!st.detainedUntil && !this.detain) return;
    if (!this.detain) this.detain = new Detain({
      figure: (who, right) => {
        const a = who === "pc" ? this.pc : this.chiefActor(); if (!a) return null;
        const { base, rc } = this.spriteFor(a), tk = `${this.bank.variant(base, rc)}-rot`;
        if (!this.textures.exists(tk)) return null;
        const fr = this.textures.getFrame(tk, dirIndex(right ? 0 : Math.PI));
        return { img: fr.source.image as CanvasImageSource, sx: fr.cutX, sy: fr.cutY, sw: fr.cutWidth, sh: fr.cutHeight, foot: feetOf(base) };
      },
      state: () => {
        const s = this.s, st2 = s.stadium!, ch = this.chiefActor();
        return { held: !!st2.detainedUntil && !st2.ending, left: Math.max(0, (st2.detainedUntil - s.tick) / 60), police: !!st2.policeCalled, chief: ch ? personName(ch) : "Security", chiefUp: !!ch && !ch.dead && ch.downUntil <= s.tick && !ch.hiddenIn, money: this.pc.money, frock: inDragSim(this.w, this.pc) };
      },
      bribe: () => {
        const ch = this.chiefActor(); if (!ch) return;
        const amount = Math.min(this.pc.money, 60);
        const r = dispatch(this.w, { verb: "bribe", actor: this.pc.id, target: { k: "actor", id: ch.id }, amount });
        if (!r.ok) this.detain?.line(r.reason === "too far" ? "Come here and say that." : r.reason ?? "No.");
      },
      talk: () => { const ch = this.chiefActor(); if (ch) { const r = dispatch(this.w, { verb: "talk", actor: this.pc.id, target: { k: "actor", id: ch.id } }); if (!r.ok) this.detain?.line("I'm not talking to you from there."); } },
      getUp: () => this.hint("Up you get. He's watching the door."),
    });
    this.detain.update();
  }

  // ---------- The drain, side on ----------
  drain: Drain | null = null;
  drainFrom: number | null = null;
  startDrain() {
    if (!this.drain) this.drain = new Drain({
      grozz: () => {
        const pc = this.pc; if (!pc) return null;
        const { base, rc } = this.spriteFor(pc), tk = `${this.bank.variant(base, rc)}-rot`;
        if (!this.textures.exists(tk)) return null;
        const fr = this.textures.getFrame(tk, dirIndex(0));
        return { img: fr.source.image as CanvasImageSource, sx: fr.cutX, sy: fr.cutY, sw: fr.cutWidth, sh: fr.cutHeight, foot: feetOf(base) };
      },
      play: (c, v) => this.audio.play(c as Clip, v ?? 1, { minGap: 0.05 }),
      bark: (t) => { const h = $("hint"); h.hidden = false; h.textContent = t; clearTimeout(this.hintTimer); this.hintTimer = window.setTimeout(() => { h.hidden = true; }, 1800); },
      wallet: () => { dispatch(this.w, { verb: "drainwallet", actor: this.pc.id }); },
      done: () => { if (this.drainFrom !== null) { this.setSpeed(this.drainFrom); this.drainFrom = null; } },
    });
    if (this.drain.open) return;
    this.closeSheet(); this.closeRing();
    this.drainFrom = this.speed || 1; this.setSpeed(0);
    this.drain.start();
  }

  // ---------- The rifle ----------
  roofHinted = false;
  talkedTo: { id: string; at: number } | null = null;
  fixHinted = false;
  scoped = false;
  scopeOwnFp = false;
  steadyFrom = 0;
  scopePitch = 0;
  enterScope() {
    const pc = this.pc;
    if (!pc || !rifleOf(this.w, pc)) return;
    this.closeSheet(); this.closeRing();
    this.scoped = true;
    this.scopeOwnFp = !this.fp.on;
    if (!this.fp.on) this.toggleFirstPerson();
    this.fp.fov = 0.3; this.fp.far = 85; this.fp.eye = 1.62 + roofHeight(pc);
    $("scope").hidden = false;
    this.scopeAmmo();
    this.audio.play("pickup", 0.7, { rate: 0.7 });
  }
  exitScope() {
    if (!this.scoped) return;
    this.scoped = false; this.steadyFrom = 0;
    this.fp.fov = Math.PI / 2.6; this.fp.far = 40; this.fp.eye = 1.62;
    if (this.scopeOwnFp && this.fp.on) this.toggleFirstPerson();
    $("scope").hidden = true;
  }
  scopeAmmo() { const g = this.pc && rifleOf(this.w, this.pc); $("scopeAmmo").textContent = g ? `${"▮".repeat(g.ammo ?? 3)}${"▯".repeat(3 - (g.ammo ?? 3))}` : ""; }
  /** Fire down the middle of the scope: whoever's under the crosshair (or nobody). */
  fire() {
    const s = this.s, pc = this.pc;
    if (!this.scoped || !pc) return;
    let best: Actor | null = null, bd = RIFLE_RANGE;
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a === pc || a.hiddenIn || a.dead || (a.fb && a.fb.status === "gone")) continue;
      const dx = a.x - pc.x, dy = a.y - pc.y, d = Math.hypot(dx, dy);
      if (d > bd || d < 1) continue;
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - pc.facing), Math.cos(Math.atan2(dy, dx) - pc.facing)));
      // Half a body's width either side of the crosshair, at that range.
      if (off < Math.atan(0.32 / d)) { best = a; bd = d; }
    }
    const r = dispatch(this.w, { verb: "shoot", actor: pc.id, target: best ? { k: "actor", id: best.id } : undefined });
    if (!r.ok) { this.hint(r.reason ?? ""); this.audio.play("nope", 0.6); return; }
    this.audio.play("gunshot", 1, { minGap: 0.05 });
    pc.facing += (Math.random() - 0.5) * 0.03; this.scopePitch = -18;
    const fl = $("scopeFlash"); fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on");
    this.scopeAmmo();
    if (best?.dead) this.hint(`${personName(best)}. Down.`);
    else this.hint("Missed.");
  }

  /** Everyone and everything near you, as billboards for the first-person view. */
  drawFirstPerson(): void {
    const s = this.s, pc = this.pc, out: FpSprite[] = [];
    const tex = (key: string) => (this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as HTMLCanvasElement) : null);
    for (const id in s.actors) {
      const a = s.actors[id];
      const far = this.fp.far;
      if (a === pc || a.hiddenIn || (a.fb && a.fb.status === "gone") || Math.abs(a.x - pc.x) > far || Math.abs(a.y - pc.y) > far) continue;
      if (a.npc?.job === "dog") continue;
      const { base, rc } = this.spriteFor(a);
      if (!this.bank.has(base)) continue;
      const key = this.bank.variant(base, rc), cell = cellOf(base);
      const toMe = Math.atan2(pc.y - a.y, pc.x - a.x), di = dirIndex(Math.PI / 2 + (a.facing - toMe));
      const down = a.dead || a.downUntil > s.tick;
      const fall = this.bank.sheetReady(key, "fall") ? tex(`${key}-fall`) : null, walk = tex(`${key}-walk`), moving = Math.hypot(a.vx, a.vy) > 0.4;
      let img = tex(`${key}-rot`)!, sx = di * cell, sy = 0;
      if (down && fall) { const n = Math.round(fall.width / cell); img = fall; sx = (n - 1) * cell; sy = di * cell; }
      else if (moving && walk) { const n = Math.round(walk.width / cell); img = walk; sx = (Math.floor(s.tick * 0.15) % n) * cell; sy = di * cell; }
      out.push({ x: a.x, y: a.y, img, sx, sy, sw: cell, sh: a.seated ? 52 : cell, mh: (a.seated ? 52 : cell) / 32, footFrac: a.seated ? 0.95 : feetOf(base) / cell });
    }
    for (const p of this.placed.list) {
      const meta = this.world.base[p.key], im = tex(`k-${p.key}`);
      if (!meta || !im || p.flat || Math.abs(p.x - pc.x) > 40 || Math.abs(p.y - pc.y) > 40) continue;
      out.push({ x: p.x, y: p.y, img: im, sx: 0, sy: 0, sw: im.width, sh: im.height, mh: im.height / 32, footFrac: meta.foot / im.height });
    }
    // The seated crowd, from the stand atlas (only the near ones: there are thousands).
    const opp = s.match!.teams[1], atlas = tex(`crowd3-${opp.short}`);
    if (atlas) for (const c of this.crowdImgs) {
      if (Math.abs(c.x - pc.x) > 26 || Math.abs(c.wy - pc.y) > 26) continue;
      const fr = Number(c.im.frame.name), col = fr % 8, row = Math.floor(fr / 8);
      out.push({ x: c.x, y: c.wy, img: atlas, sx: col * CELL, sy: row * 52, sw: CELL, sh: 52, mh: 52 / 32, footFrac: 46 / 52, cheap: true });
    }
    const here = areaAt(pc.x, pc.y), hand = pc.hand ? tex(`ico-${s.items[pc.hand].def}`) : null;
    this.fp.draw(s, pc, out, !!here.outside || !!here.pitch || !!here.seats, VENUE.id, hand);
  }

  /** Behind the wheel, in one of the 3D views? */
  inCab(): boolean { return this.s.stadium!.vehicles.bus?.drivenBy === this.pc?.id && this.driveView !== "map"; }

  // ---------- Floating words over people ("KO!", "+£20") ----------
  popups: { x: number; y: number; text: string; colour: string; at: number; obj: Phaser.GameObjects.Text }[] = [];
  popup(x: number, y: number, text: string, colour = "#ffffff"): void {
    const obj = this.add.text(0, 0, text, { fontFamily: FONT_POP, fontSize: `${Math.round(18 * DPR)}px`, color: colour, stroke: "#0b0d10", strokeThickness: Math.round(4 * DPR) })
      .setOrigin(0.5, 1).setDepth(1e7 + 2);
    this.popups.push({ x, y, text, colour, at: performance.now(), obj });
  }
  stepPopups(): void {
    const now = performance.now(), P = this.P, z = this.cameras.main.zoom;
    this.popups = this.popups.filter((p) => {
      const t = (now - p.at) / 1100;
      if (t >= 1) { p.obj.destroy(); return false; }
      const pop = t < 0.12 ? 0.6 + t * 4 : 1;
      p.obj.setPosition(P.sx(p.x, p.y), P.sy(p.x, p.y, 2.2) - t * 30).setScale(pop / z).setAlpha(t > 0.7 ? (1 - t) / 0.3 : 1);
      return true;
    });
  }

  // ---------- Violence: hit-stop, shake, flash, spray ----------
  /** Camera trauma (0-1): the shake is trauma squared, and it drains away. */
  trauma = 0;
  /** Blood in the air, metres; it lands as spots that stay. */
  drops: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; c?: number }[] = [];
  /** Pools spreading under the badly hurt. */
  pools: { x: number; y: number; r: number; max: number; grow: number }[] = [];
  /** White flash on a sprite (ms timestamp), and the attacker's lunge. */
  flashAt = new Map<string, number>();
  lunge = new Map<string, { dx: number; dy: number; at: number }>();
  burst: { x: number; y: number; at: number; k: number } | null = null;
  decalG!: Phaser.GameObjects.Graphics;
  kick = { x: 0, y: 0 };
  pcHidden = false;
  bubbleG: Phaser.GameObjects.Graphics | null = null;
  flashesUntil = 0;
  stall!: Stall;
  fp!: FirstPerson;
  fx!: Fx;
  pursuers: Actor[] = [];
  /** A cinematic moment: letterbox, a push-in on a point (or a long lead ahead), slow motion. */
  cine: { until: number; focus: { x: number; y: number } | null; lead: { x: number; y: number } | null; zoomAdd: number } | null = null;
  cineDone = new Set<string>();
  wasInDoor = false;
  keyHeldAt = 0;
  pcLine: { text: string; until: number } | null = null;
  lastBark = 0;
  /** The player mouths off: a voiced line from one pool, with a bubble over his head. */
  bark(kind: string, chance = 1, force = false): void {
    const now = performance.now(), pool = PC_LINES[kind];
    if (!pool?.length || (!force && (now - this.lastBark < 1400 || Math.random() > chance))) return;
    let pickI = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && this.pcLine && pool[pickI][0] === this.pcLine.text) pickI = (pickI + 1) % pool.length;
    const [text, clip] = pool[pickI];
    this.lastBark = now;
    this.pcLine = { text, until: now + 1700 };
    // In a dress (or a wig): the same lines, in his best strained lady's voice.
    this.audio.play((this.inDrag() ? `${clip}_drag` : clip) as Clip, kind === "takedown" ? 0.7 : 1, { minGap: 0.2 });
  }
  inDrag(): boolean {
    const pc = this.pc, s = this.s;
    return !!pc && Object.values(pc.worn).some((id) => id && ["dress", "wig", "long_wig"].includes(s.items[id]?.def));
  }
  canopy: Phaser.GameObjects.Image | null = null;
  /** How far above the ground someone is drawn, in metres. */
  liftOf(a: Actor): number {
    // Kept within a screen of the ground (the camera follows your feet): the shadow tells the height.
    if (a.roof) { const r = roofOf(a); return r ? this.roofLift(r, a.y) : roofHeight(a); }
    if (a.bike) return 0.3; // up on the saddle
    if (a.chute) { const c = a.chute, k = Math.min(1, (this.s.tick - c.t0) / (c.t1 - c.t0)); return 8 * (1 - k * k); }
    return 0;
  }
  /** How high to draw someone (or something) standing on this roof at depth y. A painted building's
   *  roof is a band partway down its picture (the fronts are drawn much taller than the footprint's
   *  height), so the back of the roof maps to the top of that band and the eaves to its bottom: you
   *  stand on the slates wherever you are, about 6 m up at the back of the pub and 10 at the front. */
  roofLift(r: Roof, y: number): number {
    const b = this.blds.find((x) => x.id === r.id);
    if (!b || !r.band || !this.textures.exists(`bldc-${VENUE.id}-${b.id}`)) return r.h;
    const T = b.rect.y1 - b.rect.y0 + b.height, t = Math.max(0, Math.min(1, (y - r.y0 - 0.3) / Math.max(0.1, r.y1 - r.y0 - 0.6)));
    const at = b.rect.y1 - T + (r.band[0] + 0.035 + t * (r.band[1] - r.band[0] - 0.055)) * T;
    return y - at;
  }
  /** Up on a roof: everything below it dimmed (it's a long way down), the roof you're on left clear,
   *  and its edge picked out, so you can see where the drop is. */
  roofView(g: Phaser.GameObjects.Graphics, r: Roof, k: number) {
    const P = this.P, v = this.cameras.main.worldView, pad = 40, V = (ps: { x: number; y: number }[]) => ps.map((q) => new Phaser.Math.Vector2(q.x, q.y));
    const at = (x: number, y: number) => ({ x: P.sx(x, y), y: P.sy(x, y) - this.roofLift(r, y) * P.S });
    const yb = r.y0 + 0.3, yf = r.y1 - 0.3, [bx0, bx1] = roofSpan(r, yb), [fx0, fx1] = roofSpan(r, yf);
    const TL = at(bx0 - 0.5, yb), TR = at(bx1 + 0.5, yb), BL = at(fx0 - 0.5, yf), BR = at(fx1 + 0.5, yf);
    const L = v.x - pad, R = v.right + pad, T = v.y - pad, B = v.bottom + pad, top = Math.min(TL.y, TR.y) - 6, bot = Math.max(BL.y, BR.y) + 4;
    g.fillStyle(0x05070c, 0.42 * k);
    g.fillRect(L, T, R - L, top - T); g.fillRect(L, bot, R - L, B - bot);
    g.fillPoints(V([{ x: L, y: top }, { x: TL.x, y: top }, { x: BL.x, y: bot }, { x: L, y: bot }]), true);
    g.fillPoints(V([{ x: TR.x, y: top }, { x: R, y: top }, { x: R, y: bot }, { x: BR.x, y: bot }]), true);
    g.lineStyle(2, 0xfff1c4, 0.35 * k).strokePoints(V([{ x: TL.x, y: top }, { x: TR.x, y: top }, { x: BR.x, y: bot }, { x: BL.x, y: bot }]), true);
  }
  roofDimK = 0;
  tele: { pts: { x: number; y: number }[]; until: number } | null = null;
  quietG!: Phaser.GameObjects.Graphics;
  /** Things lying in the world get a dark one-pixel outline (the report: outline characters and the props
   *  that matter, never the scenery), so a pie on the pavement reads as a thing, not a speck. */
  outlineIcons(): void {
    for (const k of ICONS) {
      const src = `ico-${k}`, key = `icoW-${k}`;
      if (!this.textures.exists(src) || this.textures.exists(key)) continue;
      const img = this.textures.get(src).getSourceImage() as HTMLImageElement, w = img.width + 4, h = img.height + 4;
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const cx = cv.getContext("2d")!;
      // The silhouette, dark, stamped round the edges two pixels out (one art pixel at half size)...
      const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
      const sx = sil.getContext("2d")!;
      sx.drawImage(img, 2, 2); sx.globalCompositeOperation = "source-in"; sx.fillStyle = "#16130f"; sx.fillRect(0, 0, w, h);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) cx.drawImage(sil, dx, dy);
      // ...then the picture on top.
      cx.drawImage(img, 2, 2);
      this.textures.addCanvas(key, cv);
    }
  }
  quiet = !location.search.includes("loud");
  whyIcons = new Map<string, Phaser.GameObjects.Image>();
  /** A chain Grozz set off, named like a TV graphic as it grows ("KEG → DRAYMAN GOES AFTER IT → …"). */
  chainTimer = 0;
  chainStrap(links: string[], label?: string) {
    if (links.length < 2) return;
    const el = $("chainStrap");
    el.innerHTML = `<b>${label ?? (links.length >= 3 ? "CHAIN REACTION" : "KNOCK-ON")}</b><span>${links.map((l) => `<i>${esc(l)}</i>`).join("<em>→</em>")}</span>`;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    this.audio.play("chime", 0.5, { rate: 0.7 + links.length * 0.08 });
    if (links.length >= 3) this.audio.play("crowd_ooh" as Clip, 0.55);
    clearTimeout(this.chainTimer); this.chainTimer = window.setTimeout(() => { el.hidden = true; }, 5200);
  }
  /** A rule of the world, said once when you first make it happen (then it's in the notes). */
  /** ?playtest: the recorder (and every tester starts knowing nothing). */
  pt: PlayTest | null = location.search.includes("playtest") ? new PlayTest() : null;
  rules: Set<string> = (() => { if (location.search.includes("playtest")) return new Set<string>(); try { return new Set<string>(JSON.parse(localStorage.getItem("kd-rules") ?? "[]")); } catch { return new Set<string>(); } })();
  ruleCard(id: string, rule: string, more: string) {
    if (this.rules.has(id)) { this.flags[`rule_${id}`] = 1; return; }
    this.rules.add(id); this.flags[`rule_${id}`] = 1;
    this.pt?.rule(rule);
    if (!this.pt) try { localStorage.setItem("kd-rules", JSON.stringify([...this.rules])); } catch { /* ignore */ }
    this.say(`${rule} ${more}`, "Rule", false, false);
    const el = $("itemCard");
    el.innerHTML = `<i class="bulb rule">✓</i><div><b>Learned</b><span>${esc(rule)}</span></div>`;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    this.itemCardAt = performance.now();
    this.audio.play("chime", 0.6, { rate: 1.1 });
    clearTimeout(this.itemCardTimer); this.itemCardTimer = window.setTimeout(() => { el.hidden = true; }, 4200);
  }
  /** A footballer's card (the old Football Manager match screen): who he is, how good, how he is today. */
  playerCard(a: Actor) {
    const fb = a.fb!, team = this.s.match!.teams[fb.team], gk = fb.role === "GK";
    const bar = (label: string, v: number) => `<span class="pb"><em>${label}</em><i style="width:${Math.round(Math.max(0.05, Math.min(1, v)) * 100)}%"></i></span>`;
    const stats = gk ? [["Keeping", fb.keeping], ["Composure", fb.composure], ["Pace", fb.pace]] : [["Pace", fb.pace], ["Shooting", fb.shooting], ["Passing", fb.passing], ["Tackling", fb.tackling]];
    const today = fb.status !== "playing" ? `Off: ${(fb.goneReason ?? fb.status).replace(/_/g, " ")}` : fb.bribed ? "Not himself today. Shifty." : (a.effects.frozen ?? 0) > this.s.tick ? "Sick as a dog." : fb.fatigue > 0.85 ? "Knackered." : fb.yellows ? "On a yellow." : "Looks up for it.";
    const el = $("itemCard");
    el.innerHTML = `<i class="bulb" style="background:#${(team.colour as number).toString(16).padStart(6, "0")};color:#fff">${fb.number}</i><div><b>${esc(a.name)}${fb.star ? " ★" : ""} · ${esc(team.name)}${gk ? " · keeper" : ""}</b><div class="pbs">${stats.map(([l, v]) => bar(l as string, v as number)).join("")}</div><small class="today">${esc(today)}${fb.goals ? ` · ${fb.goals} goal${fb.goals > 1 ? "s" : ""} today` : ""}</small></div>`;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    this.itemCardAt = performance.now();
    clearTimeout(this.itemCardTimer); this.itemCardTimer = window.setTimeout(() => { el.hidden = true; }, 5200);
  }
  seenItems: Set<string> = (() => { try { return new Set<string>(JSON.parse(localStorage.getItem("kd-items") ?? "[]")); } catch { return new Set<string>(); } })();
  itemCardTimer = 0;
  itemCardAt = 0;
  itemsPrimedFor: unknown = null;
  curios = new Set<string>();
  curiosFor: unknown = null;
  /** A card for a thing you've not had before: its picture, its name, what it's for, in his words. */
  itemCard(it: Item) {
    this.seenItems.add(it.def); this.itemCardAt = performance.now();
    try { localStorage.setItem("kd-items", JSON.stringify([...this.seenItems])); } catch { /* ignore */ }
    const el = $("itemCard"), lit = itemTargets(this.w, this.pc, it).length > 0;
    el.innerHTML = `${icon(it.def)}<div><b>${esc(itemName(it))}</b><span>${esc(ITEM_TIPS[it.def])}</span></div>`;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    clearTimeout(this.itemCardTimer); this.itemCardTimer = window.setTimeout(() => { el.hidden = true; }, 5200);
  }
  itemTgts: ItemTarget[] = [];
  itemTgtFor = "";
  itemLabel: Phaser.GameObjects.Text | null = null;
  /** The name over the nearest place the thing in your hand is for ("Brick → a window"). */
  itemLabelAt(t: ItemTarget, x: number, y: number, u: number) {
    if (!this.itemLabel) this.itemLabel = this.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "13px", color: "#f2c94c", backgroundColor: "#000000b0", padding: { x: 4, y: 2 } }).setOrigin(0.5, 1).setDepth(8e6);
    const h = this.pc.hand ? this.s.items[this.pc.hand] : undefined, txt = `${h ? itemName(h) : ""} → ${t.label}`;
    if (this.itemLabel.text !== txt) this.itemLabel.setText(txt);
    this.itemLabel.setPosition(Math.round(x), Math.round(y)).setScale(u).setVisible(true);
  }
  choking = new Map<string, number>();
  startCine(ms: number, opts: { focus?: { x: number; y: number }; lead?: { x: number; y: number }; zoomAdd?: number; slow?: number; caption?: string }): void {
    const now = performance.now();
    this.cine = { until: now + ms, focus: opts.focus ?? null, lead: opts.lead ?? null, zoomAdd: opts.zoomAdd ?? 1 };
    if (opts.slow) this.slowUntil = Math.max(this.slowUntil, now + opts.slow);
    document.body.classList.add("cine");
    $("cineCap").textContent = opts.caption ?? "";
  }
  stepCine(): void {
    const s = this.s, pc = this.pc;
    if (this.cine && performance.now() > this.cine.until) { this.cine = null; document.body.classList.remove("cine"); }
    // The players' entrance: a beep and a clunk as the card opens it.
    if (pc) {
      const inDoor = Math.abs(pc.x - (VENUE.id === "sf" ? 56.5 : -56.5)) < 0.9 && pc.y > -56.2 && pc.y < -52.8;
      if (inDoor && !this.wasInDoor) this.audio?.play("swipe", 1, { minGap: 2 });
      this.wasInDoor = inDoor;
    }
    if (!pc || this.cine) return;
    const ar = areaAt(pc.x, pc.y), m = s.match!, live = m.phase === "live" || m.phase === "restart";
    const key = `${VENUE.id}:${s.stadium!.arrivedAt}`;
    // Walking out of the tunnel: the camera pushes in behind you and looks up the pitch; the noise rises.
    if (ar.id === "tunnel" && pc.vy > 0.5 && !this.cineDone.has(key + "tunnel")) {
      this.cineDone.add(key + "tunnel");
      this.startCine(3800, { lead: { x: 0, y: 7 }, zoomAdd: 1, caption: "Out of the tunnel" });
      this.audio.play("goal_roar", 0.35, { minGap: 5 }); this.audio.play("chant_eng", 0.6, { minGap: 5 });
    }
    // Onto the pitch while the game's on: slow motion, a push-in, the whole ground reacting.
    if (ar.pitch && ar.id === "pitch" && live && !this.cineDone.has(key + "invade")) {
      this.cineDone.add(key + "invade");
      this.startCine(2600, { focus: { x: pc.x + pc.vx * 0.8, y: pc.y + pc.vy * 0.8 }, zoomAdd: 1, slow: 1400, caption: "Pitch invader" });
      this.audio.play("crowd_jeer", 0.9, { minGap: 5 }); this.audio.play("goal_roar", 0.5, { minGap: 5 });
    }
  }
  fightZoomUntil = 0;
  rainG: Phaser.GameObjects.Graphics | null = null;
  ghost: Phaser.GameObjects.Sprite | null = null;
  slowUntil = 0;
  decals = 0;

  impact(byId: string, whoId: string, dx: number, dy: number, k: number, closeness: number): void {
    const s = this.s, by = s.actors[byId], who = s.actors[whoId], now = performance.now();
    if (!who) return;
    const mine = byId === this.pc?.id || whoId === this.pc?.id;
    // Your own blows stop the world for a beat (longer for heavier ones) and jolt the camera along
    // the blow; other people's fights nearby just shake it a little.
    if (mine) {
      const ko = k >= 2 || (who.downUntil - this.s.tick > 300 && byId === this.pc?.id);
      this.hitStopUntil = Math.max(this.hitStopUntil, now + (ko ? 140 : k > 1 ? 90 : 55));
      this.trauma = Math.min(1, this.trauma + (ko ? 0.6 : k > 1 ? 0.45 : 0.32));
      this.kick = { x: dx * (ko ? 7 : k > 1 ? 5 : 3), y: dy * (ko ? 7 : k > 1 ? 5 : 3) };
      // A knockout or a killing: everything slows right down for a moment.
      if (k >= 2 || (who.downUntil - this.s.tick > 300 && byId === this.pc?.id)) {
        this.slowUntil = now + 450;
        // A big one: close in on it, in slow motion, letterboxed.
        if (!this.cine) this.startCine(1500, { focus: { x: who.x + dx * 0.8, y: who.y + dy * 0.8 }, zoomAdd: 2, slow: 1100, caption: k >= 2 ? "" : "Sparko" });
      }
    } else if (closeness > 0.4) this.trauma = Math.min(1, this.trauma + 0.15 * k);
    if (mine || (this.pc && Math.hypot(who.x - this.pc.x, who.y - this.pc.y) < 6)) this.fightZoomUntil = now + 2600;
    if (whoId === this.pc?.id) { const v = $("hurt"); v.classList.remove("on"); void v.offsetWidth; v.classList.add("on"); }
    this.flashAt.set(whoId, now);
    if (by && byId !== whoId) this.lunge.set(byId, { dx, dy, at: now });
    this.burst = { x: who.x - dx * 0.3, y: who.y - dy * 0.3, at: now, k };
    this.spray(who.x, who.y, 1.55, dx, dy, Math.round(16 * k), 1 + k * 0.5);
  }

  /** Throw drops of blood from a point at a height (metres), mostly along (dx, dy). */
  spray(x: number, y: number, z: number, dx: number, dy: number, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const sp = speed * (1.5 + Math.random() * 3), a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
      this.drops.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1 + Math.random() * 2.5, r: 0.05 + Math.random() * 0.09 });
    }
    if (this.drops.length > 400) this.drops.splice(0, this.drops.length - 400);
  }

  /** Bits of head: bigger, paler lumps among the blood. */
  gibs(x: number, y: number, n: number): void {
    const COL = [0xd98c8c, 0xe8dcc8, 0xb07a7a, 0x9c2020, 0xc9a0a0];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      this.drops.push({ x, y, z: 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 2 + Math.random() * 3, r: 0.09 + Math.random() * 0.12, c: COL[i % COL.length] });
    }
  }

  /** Move the blood in the air; what lands becomes a spot on the floor that stays. */
  stepGore(dms: number): void {
    const P = this.P, dt = Math.min(0.05, dms / 1000), S = P.S;
    const g = this.decalG;
    if (this.decals > 1500) { g.clear(); this.decals = 0; }
    this.drops = this.drops.filter((d) => {
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 14 * dt; d.vx *= 0.97; d.vy *= 0.97;
      if (d.z > 0) return true;
      const r = Math.max(1, Math.round(d.r * S * (0.8 + Math.random() * 0.6)));
      g.fillStyle(d.c ?? (Math.random() < 0.5 ? 0x6e0b0b : 0x8a1010), 0.9).fillRect(Math.round(P.sx(d.x, d.y)), Math.round(P.sy(d.x, d.y)), r, Math.max(1, Math.round(r * 0.7)));
      this.decals++;
      return false;
    });
    for (const p of this.pools) {
      if (p.r >= p.max) continue;
      p.r = Math.min(p.max, p.r + p.grow * dt);
      if (p.r >= p.max) {
        // Fully spread: paint it in for good (a dark centre, a ragged edge).
        g.fillStyle(0x5a0808, 0.85).fillEllipse(Math.round(P.sx(p.x, p.y)), Math.round(P.sy(p.x, p.y)), p.r * 2 * S, p.r * 1.5 * S);
        g.fillStyle(0x7a0c0c, 0.6).fillEllipse(Math.round(P.sx(p.x + p.r * 0.3, p.y)), Math.round(P.sy(p.x, p.y + p.r * 0.2)), p.r * 1.2 * S, p.r * 0.9 * S);
        this.decals += 2;
      }
    }
    this.pools = this.pools.filter((p) => p.r < p.max);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
  }

  honk() {
    const r = dispatch(this.w, { verb: "horn", actor: this.pc.id });
    if (r.ok) { this.audio.play("horn", 1, { minGap: 0.5 }); this.d3.shout("BEEP BEEP!", this.s.tick, "#fde047"); }
  }

  cycleDriveView() {
    const order: DriveView[] = ["chase", "cab", "map"];
    this.driveView = order[(order.indexOf(this.driveView) + 1) % order.length];
    try { localStorage.setItem("kd-drive", this.driveView); } catch { /* ignore */ }
    $("viewBtn").textContent = this.driveView === "chase" ? "Chase" : this.driveView === "cab" ? "Cab" : "Map";
  }

  applyInput() {
    const pc = this.pc;
    if (!pc) return;
    const k = this.keys;
    if (this.inCab()) {
      // Wheel and pedals: up to go, down to brake and reverse, left and right to steer.
      let steer = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      let throttle = (k.W.isDown || k.UP.isDown ? 1 : 0) - (k.S.isDown || k.DOWN.isDown ? 1 : 0);
      if (this.joyId !== -1) { steer = clamp(this.jx, -1, 1); throttle = clamp(-this.jy, -1, 1); if (Math.abs(throttle) < 0.2) throttle = 0; }
      pc.drive = { steer, throttle };
      pc.moveX = pc.moveY = 0;
      return;
    }
    if (pc.drive) pc.drive = undefined;
    let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    let run = k.SHIFT.isDown;
    if (this.joyId !== -1) { x = this.jx; y = this.jy; run = Math.hypot(x, y) > 0.85; }
    if (this.pt && (Math.hypot(x, y) > 0.3 || this.walkTo)) this.pt.active(true);
    if (this.scoped) {
      // Through the scope: the stick nudges the aim (slowly), you can't walk, and it sways unless you steady it.
      const now = performance.now(), steady = this.steadyFrom && now - this.steadyFrom < 3000;
      const shake = steady ? 0.15 : this.steadyFrom && now - this.steadyFrom >= 3000 ? 1.8 : 1, t = now / 1000;
      pc.facing += x * 0.009 + (Math.sin(t * 1.3) * 0.0022 + Math.sin(t * 3.1 + 1) * 0.0012) * shake;
      this.scopePitch = Math.sin(t * 1.7) * 6 * shake;
      pc.moveX = pc.moveY = 0;
      return;
    }
    if (this.fp?.on) {
      // First person: left and right turn you, up and down walk you forward and back.
      pc.facing += x * 0.055;
      const fwd = -y, mag = Math.abs(fwd) < 0.12 ? 0 : run ? 1 : 0.8;
      pc.moveX = Math.cos(pc.facing) * Math.sign(fwd) * mag; pc.moveY = Math.sin(pc.facing) * Math.sign(fwd) * mag;
      if (Math.abs(x) > 0.1 && !mag) { pc.moveX = Math.cos(pc.facing) * 0.001; pc.moveY = Math.sin(pc.facing) * 0.001; }
      return;
    }
    let l = Math.hypot(x, y);
    if (l > 0.12 && pc.seated && !pc.heldBy) { dispatch(this.w, { verb: "stand", actor: pc.id }); this.setZoom(); this.setSpeed(1); }
    if (pc.effects.drunk > this.s.tick && l > 0.1) {
      const wob = Math.sin(this.s.tick * 0.05) * 0.5;
      const c = Math.cos(wob), sn = Math.sin(wob);
      [x, y] = [x * c - y * sn, x * sn + y * c];
    }
    l = Math.hypot(x, y);
    // Steering yourself calls off a walk-over (and what was queued after it); otherwise the walk-over steers.
    // A thumb resting on the stick shouldn't call it off: it takes a proper push.
    if ((this.pursue || this.nextPursue) && l > 0.45) { this.pursue = null; this.nextPursue = null; }
    if (this.walkTo && l > 0.3) this.walkTo = null;
    if (!this.pursue && this.nextPursue) { this.pursue = this.nextPursue; this.nextPursue = null; }
    if (this.pursue && l <= 0.45) { this.walkTo = null; this.stepPursue(); return; }
    if (this.pendingUse && l > 0.3) this.pendingUse = null;
    if (this.pendingUse && this.stepUse()) return;
    if (this.walkTo && l <= 0.3) { this.stepWalk(); return; }
    const g = this.P.ground(x, y);
    const k2 = l > 1 ? 1 / l : 1;
    // A light push is a full walk; past the edge of the stick is a run.
    const mag = run ? 1 : Math.min(0.85, l * 1.6);
    pc.moveX = l > 0.12 ? (g.x / (l || 1)) * mag * (l > 1 ? 1 : 1) * k2 * (l > 1 ? l : 1) : 0;
    pc.moveY = l > 0.12 ? (g.y / (l || 1)) * mag * k2 * (l > 1 ? l : 1) : 0;
  }

  styleOf(a: Actor): FigureStyle {
    const s = this.s, tick = s.tick, m = s.match!;
    const skin = SKIN[Math.abs(hash(a.id)) % SKIN.length];
    const down = !!a.dead || a.downUntil > tick || (a.fb ? a.fb.stunUntil > tick + 20 : false);
    if (a.fb && a.fb.controlled) {
      // Him, in the kit: same belly, new colours.
      const team = m.teams[a.fb.team];
      return { shirt: team.colour, trim: team.colour2, shorts: a.fb.team === 0 ? 0x1b2a6b : team.colour2, skin, down, girth: 1.75, height: 1.75, ring: 0xffffff };
    }
    if (a.fb) {
      const team = m.teams[a.fb.team], gk = a.fb.role === "GK";
      return { shirt: gk ? (a.fb.team === 0 ? 0x2fbf71 : 0xf08a24) : team.colour, trim: gk ? 0x10202a : team.colour2, shorts: a.fb.team === 0 ? 0x1b2a6b : team.colour2, skin, down, ring: a.fb.star ? 0xf2c94c : null };
    }
    if (a.off) {
      const ref = a.off.job === "referee";
      return { shirt: ref ? 0x15171a : 0xd9e021, trim: ref ? 0xf2c94c : 0x15171a, shorts: 0x15171a, skin, down };
    }
    const outer = a.worn.outer ? defOf(s.items[a.worn.outer]) : undefined;
    const inner = a.worn.inner ? defOf(s.items[a.worn.inner]) : undefined;
    const shirtDef = outer && outer.slot === "outer" && outer.role !== "steward" ? outer : inner;
    let shirt = shirtDef?.colour ?? 0x3d4a5c, trim = shirtDef?.colour2 ?? 0x222222;
    const job = a.npc?.job;
    if (job === "police") { shirt = 0x101830; trim = 0xffffff; }
    if (job === "barman" || job === "seller" || job === "cook") { shirt = 0xf0ece2; trim = 0x333333; }
    if (job === "driver" || job === "worker") { shirt = 0x2d5a8a; trim = 0x1a3050; }
    if (job === "cleaner") { shirt = 0x6a7a8a; trim = 0x445566; }
    if (outer?.role === "referee") { shirt = outer.colour!; trim = outer.colour2!; }
    const vest = a.worn.outer && defOf(s.items[a.worn.outer]).id === "hivis" ? 0xd9e021 : null;
    const headDef = a.worn.head ? defOf(s.items[a.worn.head]) : undefined;
    const faceDef = a.worn.face ? defOf(s.items[a.worn.face]) : undefined;
    const hat = headDef ? headDef.colour ?? 0x101830 : null;
    const face = faceDef ? { colour: faceDef.colour ?? 0xf0a0c0, kind: (faceDef.faceCover ?? 0) >= 1 ? "full" as const : faceDef.id === "moustache" ? "tache" as const : "glasses" as const } : null;
    const isPc = a.id === s.stadium!.pc;
    if (job === "armed") { shirt = 0x1a1d22; trim = 0x0a0a0a; }
    // A borrowed face: their skin, not his, and nothing drawn over it.
    const borrowed = a.worn.face && s.items[a.worn.face].def === "face" ? s.items[a.worn.face].of : undefined;
    let skin2 = borrowed ? SKIN[Math.abs(hash(borrowed)) % SKIN.length] : skin;
    if (s.stadium!.flags[`face_${a.id}`]) skin2 = 0x8a1a1a;
    if ((a.effects.bloody ?? 0) > tick) trim = 0x9a0a0a;
    return {
      shirt, trim, shorts: 0x2b3b55, skin: skin2, down: down || !!a.dead, vest: job === "armed" ? 0x2a2d33 : vest, hat: job === "armed" ? 0x15171a : hat, face: borrowed ? null : face,
      girth: isPc ? 1.75 : a.npc?.job === "fan" || a.npc?.job === "local" ? 1.1 + (Math.abs(hash(a.id)) % 5) * 0.08 : 1,
      height: a.seated ? 1.2 : isPc ? 1.75 : 1.8,
      ring: isPc ? 0xffffff : null,
    };
  }

  draw(dms: number) {
    const P = this.P, s = this.s, tick = s.tick, pc = this.pc, st = s.stadium!, m = s.match!;
    let g = this.g;
    for (const l of this.layers) l.clear().setVisible(false);
    this.shadowG.clear();
    const sprites = this.useSprites && this.bank.ready();
    const seenSprites = new Set<string>();
    this.rimSeen.clear(); this.relevantNow();
    this.pcHidden = false;
    type Thing = { d: number; draw: () => void; spr?: (depth: number) => void };
    const things: Thing[] = [];
    const cam = this.cameras.main;
    const view = cam.worldView;
    const onScreen = (x: number, y: number, pad = 60) => {
      pad *= P.S / 16;
      const sx = P.sx(x, y), sy = P.sy(x, y);
      return sx > view.x - pad && sx < view.right + pad && sy > view.y - pad && sy < view.bottom + pad * 2;
    };

    // Walls: a textured face towards the camera and a cap on top, cut down low (the Escapists way) so
    // you can see over them; faded when you're behind one. Holes knocked in them are gaps.
    setBreaches(st.breaches);
    // The world's pictures: buildings with fronts and roofs (cut away when you're inside), props, the ground's shell.
    const world = sprites ? this.worldThings(things, onScreen) : { hides: (_w: unknown) => false, low: (_w: unknown) => null as BuildingSpec | null };
    this.wallSeen = new Set();
    for (const wl of SOLID) {
      if (!onScreen(wl.x + wl.w / 2, wl.y + wl.h / 2, 200 + Math.max(wl.w, wl.h) * P.S / 2)) continue;
      if (world.hides(wl) || (sprites && wl.prop)) continue;
      const open = wl.gate && st.gates[wl.gate] && st.gates[wl.gate].until > tick;
      // Doors that are doors: a steel staff door (standing open when it's open), the players' double doors.
      const doorKind = wl.gate === "playersdoor" ? "door_players" : wl.gate === "officedoor" || wl.gate === "staffdoor" ? (open ? "door_open" : "door_shut") : null;
      if (sprites && doorKind && this.textures.exists(`k-${doorKind}`)) {
        const dk = `k-${doorKind}`, dx = wl.x + wl.w / 2, dy = wl.y + wl.h, id = `door-${wl.gate}`;
        things.push({ d: dy + 0.02, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(id) as Phaser.GameObjects.Image | undefined;
          if (!im) { im = this.add.image(0, 0, dk).setOrigin(0.5, 1); this.worldSprites.set(id, im); }
          this.worldSeen.add(id);
          im.setTexture(dk).setPosition(Math.round(P.sx(dx, dy)), Math.round(P.sy(dx, dy))).setDepth(dep).setVisible(true).setAlpha(1).setScale(P.standing && P.S === PPM ? 1 : P.S / PPM);
        } });
        if (open) continue;
      }
      if (open) { things.push({ d: wl.y + wl.h, draw: () => g.fillStyle(0x88cc88, 0.35).fillRect(...P.rect(wl.x, wl.y, wl.w, wl.h)) }); continue; }
      if (!P.standing || !sprites) {
        things.push({ d: wl.y + wl.h, draw: () => {
          const [rx, ry, rw, rh] = P.rect(wl.x, wl.y, wl.w, wl.h);
          if (!P.standing) { g.fillStyle(wl.top, 1).fillRect(rx, ry, rw, rh); return; }
          const lift = Math.min(wl.h3, 1.6) * P.KZ * P.S;
          g.fillStyle(wl.colour, 1).fillRect(rx, ry + rh - lift, rw, lift).fillStyle(wl.top, 1).fillRect(rx, ry - lift, rw, rh);
        } });
        continue;
      }
      const inside = world.low(wl);
      const vh = inside ? 1.1 : wl.gate ? Math.min(wl.h3, 2) : wl.h3 <= 1.2 ? wl.h3 : Math.min(wl.h3, 1.6);
      const mat = inside && wl.h3 > 1.2 ? inside.mat : matOf(wl.colour, wl.h3, wl.gate);
      const lift = Math.round(vh * P.S), cap = CAP[mat] ?? wl.top;
      const behind = (y1: number) => !!pc && !pc.hiddenIn && pc.x > wl.x - 0.6 && pc.x < wl.x + wl.w + 0.6 && pc.y < y1 && pc.y > y1 - vh - 1.2 && vh > 1.15;
      // The face, a tiled texture standing on the wall's front edge.
      const fx = Math.round(P.sx(wl.x, 0)), fy = Math.round(P.sy(0, wl.y + wl.h)), fw = Math.max(1, Math.round(wl.w * P.S));
      const fa = behind(wl.y + wl.h) ? 0.35 : 1;
      if (fa < 1) this.pcHidden = true;
      things.push({ d: wl.y + wl.h, draw: () => {}, spr: (dep) => {
        const id = `${fx},${fy},${fw},${lift},${mat}`;
        let ts = this.wallSprites.get(id);
        if (!ts) {
          ts = this.add.tileSprite(fx, fy - lift, fw, lift, `mat-${mat}`).setOrigin(0);
          ts.setTilePosition(fx, (64 - (lift % 64)) % 64);
          this.wallSprites.set(id, ts);
        }
        this.wallSeen.add(id);
        ts.setVisible(true).setDepth(dep).setAlpha(fa);
      } });
      // The cap: in one-metre slices along a wall running up the screen, so people beside it sort properly.
      const n = wl.h > 1.3 ? Math.ceil(wl.h) : 1;
      for (let i = 0; i < n; i++) {
        const y0 = wl.y + (wl.h * i) / n, y1 = wl.y + (wl.h * (i + 1)) / n, a = behind(y1) ? 0.35 : 1;
        things.push({ d: y1 + 1e-4, draw: () => {
          const x = fx, y = Math.round(P.sy(0, y0)) - lift, h = Math.round(P.sy(0, y1)) - Math.round(P.sy(0, y0));
          g.fillStyle(cap, a).fillRect(x, y, fw, h);
          if (i === 0) g.fillStyle(0xffffff, 0.18 * a).fillRect(x, y, fw, 1);
          g.fillStyle(0x000000, 0.28 * a).fillRect(x, y, 1, h).fillRect(x + fw - 1, y, 1, h);
          if (i === n - 1) g.fillStyle(0x000000, 0.35 * a).fillRect(x, y + h - 1, fw, 1);
        } });
      }
    }

    // Rubble where a wall used to be.
    for (const b of st.breaches) {
      if (!onScreen(b.x, b.y, 120)) continue;
      things.push({ d: b.y - 1.5, draw: () => g.fillStyle(0x2a2622, 0.55).fillEllipse(P.sx(b.x, b.y), P.sy(b.x, b.y), b.r * 2.6 * P.S, b.r * 1.6 * P.S * (P.standing ? P.K : 1)) });
      for (let i = 0; i < 14; i++) {
        const a = i * 2.39996 + b.t, rr = b.r * (0.25 + ((i * 37) % 11) / 11 * 0.9);
        const x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr * 0.8, sz = 0.25 + ((i * 13) % 7) / 7 * 0.45;
        things.push({ d: y, draw: () => {
          const sx = P.sx(x, y), sy = P.sy(x, y, P.standing ? sz * 0.5 : 0);
          g.fillStyle(i % 3 ? 0x8a8f96 : 0xb4b9bf, 1).fillRect(sx - sz * P.S / 2, sy - sz * P.S / 2, sz * P.S, sz * P.S * 0.7);
        } });
      }
    }

    // Fire alarm call points: red boxes on the wall.
    SPOTS.alarmPoints.forEach((p, i) => {
      if (!onScreen(p.x, p.y)) return;
      const used = !!st.flags[`alarmUsed${i}`], ringing = (st.flags.alarmUntil ?? 0) > tick;
      const near = pc && Math.hypot(pc.x - p.x, pc.y - p.y) < 1.6;
      things.push({ d: p.y + 0.05, draw: () => {
        const sx = P.sx(p.x, p.y), sy = P.sy(p.x, p.y, P.standing ? 1.3 : 0), z = P.S * 0.42;
        g.fillStyle(0xd7263d, 1).fillRect(sx - z / 2, sy - z / 2, z, z);
        g.fillStyle(used ? 0x333333 : 0xf1f4f1, 1).fillRect(sx - z / 4, sy - z / 4, z / 2, z / 2);
        if (ringing && used && Math.floor(tick / 15) % 2) g.fillStyle(0xffd34c, 0.9).fillCircle(sx, sy - z, z / 3);
        if (near && !used) g.lineStyle(1.5, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(sx, sy, P.S * 0.55);
      } });
    });

    // The concourse windows in the outer wall: whole, or with a brick through them.
    if (sprites) windows().forEach((wp, i) => {
      if (!onScreen(wp.x, wp.y)) return;
      const key = windowBroken(this.w, i) ? "window_broken" : "window", tk = this.textures.exists(`k-${key}`) ? `k-${key}` : `k-${key}-src`;
      if (!this.textures.exists(tk)) return;
      things.push({ d: 45.7, draw: () => {}, spr: (dep) => {
        let im = this.worldSprites.get(`win-${i}`) as Phaser.GameObjects.Image | undefined;
        if (!im) { im = this.add.image(0, 0, tk).setOrigin(0.5, 1); this.worldSprites.set(`win-${i}`, im); }
        this.worldSeen.add(`win-${i}`);
        im.setTexture(tk).setPosition(Math.round(P.sx(wp.x, 45)), Math.round(P.sy(wp.x, 45, 0.75))).setDepth(dep).setVisible(true).setAlpha(1).setScale(P.standing && P.S === PPM ? 1 : P.S / PPM);
      } });
    });
    // Items lying around, and fixtures.
    for (const id in s.items) {
      const it = s.items[id], l = it.loc;
      if (l.k !== "ground" && l.k !== "air") continue;
      if (it.def === "lorry_cargo" || (sprites && (it.def === "police_box" || it.def === "kitbag"))) continue;
      const onR = it.onRoof ? roofs().find((r) => r.id === it.onRoof) : undefined, roofH = onR ? this.roofLift(onR, l.y) : 0;
      const def = defOf(it), x = l.x, y = l.y, z = l.k === "air" ? l.z : roofH;
      if (!onScreen(x, y)) continue;
      if (it.def === "bicycle") {
        // Ridden: drawn with its rider. Parked (or dropped on its side): its picture.
        if (Object.values(s.actors).some((a) => a.bike === id) || !this.textures.exists("w-bike8")) continue;
        const nearB = pc && Math.hypot(pc.x - x, pc.y - y) < 2.6;
        things.push({ d: y, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(`item-${id}`);
          if (!im) { im = this.add.image(0, 0, "w-bike8", 0).setOrigin(0.5, 0.72); this.worldSprites.set(`item-${id}`, im); }
          this.worldSeen.add(`item-${id}`);
          (im as Phaser.GameObjects.Image).setFrame(dirIndex(it.facing ?? 0)).setPosition(Math.round(P.sx(x, y)), Math.round(P.sy(x, y))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(it.fallen ? 75 : 0).setScale(P.standing && P.S === PPM ? 1 : (P.S / PPM) * (P.standing ? 1 : 0.85));
        } });
        if (nearB) things.push({ d: y + 1e-4, draw: () => g.lineStyle(3, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(P.sx(x, y), P.sy(x, y) - P.S * 0.3, P.S * 0.9) });
        continue;
      }
      const near = pc && Math.hypot(pc.x - x, pc.y - y) < 2.6;
      if (sprites && (def.size !== "huge" || it.def === "keg") && ICONS.has(it.def) && this.textures.exists(`ico-${it.def}`)) {
        // Its picture, half size (a 48 px icon is 0.75 m across), lying where it fell or flying.
        this.shadowG.fillStyle(0x000000, 0.3).fillEllipse(Math.round(P.sx(x, y)), Math.round(P.sy(x, y)), P.S * 0.6, P.S * 0.22);
        things.push({ d: onR ? 1e5 + y : y, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(`item-${id}`);
          const ik = this.textures.exists(`icoW-${it.def}`) ? `icoW-${it.def}` : `ico-${it.def}`;
          if (!im) { im = this.add.image(0, 0, ik); this.worldSprites.set(`item-${id}`, im); }
          this.worldSeen.add(`item-${id}`);
          const rolling = it.def === "keg" && s.stadium!.rolling?.some((r) => r.id === id);
          // The loose one teeters on the edge of the stack (a push-me, not a prompt) until a keg's been rolled.
          const teeter = it.def === "keg" && it.home && Math.abs(Math.abs(it.home.x) - 30.1) < 0.05 && !this.rules.has("post") && !s.stadium!.chain && Math.hypot(it.home.x - x, it.home.y - y) < 0.1;
          im.setTexture(ik).setOrigin(0.5, 0.9).setScale(it.def === "keg" ? 0.75 : 0.5).setPosition(Math.round(P.sx(x, y)), Math.round(P.sy(x, y, z))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(l.k === "air" ? (tick * 12) % 360 : rolling ? Math.sin(tick * 0.9) * 14 : teeter ? (tick % 120 < 50 ? Math.sin(tick * 0.5) * 9 : 0) : 0);
          if (this.relevant.has(`item-${id}`) || teeter) this.rim(`item-${id}`, im, dep);
        } });
        if (near && l.k === "ground") things.push({ d: y + 1e-4, draw: () => g.lineStyle(3, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(P.sx(x, y), P.sy(x, y) - P.S * 0.2, P.S * 0.55) });
        continue;
      }
      // Hampers get the hamper picture.
      const pic = sprites && (it.def === "kit_hamper" || it.def === "laundry") && this.textures.exists("k-hamper-src") ? "k-hamper-src" : null;
      if (pic) {
        things.push({ d: y, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(`item-${id}`);
          if (!im) { im = this.add.image(0, 0, pic).setOrigin(0.5, 0.92); this.worldSprites.set(`item-${id}`, im); }
          this.worldSeen.add(`item-${id}`);
          im.setPosition(Math.round(P.sx(x, y)), Math.round(P.sy(x, y))).setDepth(dep).setVisible(true).setAlpha(1);
        } });
        if (near) things.push({ d: y + 1e-4, draw: () => g.lineStyle(3, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(P.sx(x, y), P.sy(x, y) - P.S * 0.3, P.S * 0.9) });
        continue;
      }
      things.push({ d: y, draw: () => {
        const sx = P.sx(x, y), sy = P.sy(x, y, z);
        if (def.size === "huge") {
          const h = (it.def === "locker" ? 1.9 : 1) * P.KZ * P.S, wdt = P.S * (it.def === "locker" ? 1.4 : 0.8);
          g.fillStyle(def.colour ?? 0x777777, 1).fillRect(sx - wdt / 2, sy - h, wdt, h);
          g.lineStyle(1, 0x000000, 0.4).strokeRect(sx - wdt / 2, sy - h, wdt, h);
          if (it.spiked) g.fillStyle(0x9cff9c, 0.6).fillCircle(sx, sy - h - 3, 2.5);
        } else {
          g.fillStyle(0x000000, 0.3).fillEllipse(P.sx(x, y), P.sy(x, y), P.S * 0.6, P.S * 0.25);
          g.fillStyle(def.colour ?? 0xffffff, 1).fillRoundedRect(sx - P.S * 0.25, sy - P.S * 0.35, P.S * 0.5, P.S * 0.35, 2);
        }
        if (near && l.k === "ground") g.lineStyle(1.5, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(sx, sy - P.S * 0.2, P.S * 0.55);
      } });
    }

    // Vehicles: a box at any angle, with the faces towards the camera shaded.
    const box = (x: number, y: number, len: number, wid: number, h: number, facing: number, side: number, top: number, alpha = 1) => {
      const c = Math.cos(facing), sn = Math.sin(facing);
      const corner = (a: number, b: number) => ({ x: x + c * a - sn * b, y: y + sn * a + c * b });
      const pts = [corner(len / 2, wid / 2), corner(len / 2, -wid / 2), corner(-len / 2, -wid / 2), corner(-len / 2, wid / 2)];
      const scr = (p: { x: number; y: number }, z: number) => ({ x: P.sx(p.x, p.y), y: P.sy(p.x, p.y, z) });
      g.fillStyle(0x000000, 0.3 * alpha).fillPoints(pts.map((p) => scr({ x: p.x + 0.3, y: p.y + 0.3 }, 0)) as any, true);
      if (P.standing) {
        // Side faces back to front; the roof then covers the far ones.
        const faces = [0, 1, 2, 3].map((i) => [pts[i], pts[(i + 1) % 4]]).sort((p, q) => (p[0].y + p[1].y) - (q[0].y + q[1].y));
        for (const [a, b] of faces) g.fillStyle(side, alpha).fillPoints([scr(a, 0), scr(b, 0), scr(b, h), scr(a, h)] as any, true);
      }
      g.fillStyle(top, alpha).fillPoints(pts.map((p) => scr(p, P.standing ? h : 0)) as any, true);
      g.lineStyle(1, 0x000000, 0.35 * alpha).strokePoints(pts.map((p) => scr(p, P.standing ? h : 0)) as any, true);
    };
    for (const v of Object.values(st.vehicles)) {
      if (!onScreen(v.x, v.y, 220)) continue;
      const isBus = v.kind === "bus";
      const len = isBus ? BUS_LEN : LORRY_LEN, wid = isBus ? BUS_WID : LORRY_WID, h = isBus ? 3.2 : 3;
      const team = isBus ? m.teams[1] : null;
      const depth = v.y + Math.abs(Math.sin(v.facing)) * len / 2 + Math.abs(Math.cos(v.facing)) * wid / 2;
      const key8 = isBus ? "w-coach8" : "w-lorry8";
      if (sprites && this.textures.exists(key8)) {
        // An eight-way PixelLab picture: the coach painted in the team's colour.
        things.push({ d: depth, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(`veh-${v.id}`);
          if (!im) { im = this.add.image(0, 0, key8, 0); this.worldSprites.set(`veh-${v.id}`, im); }
          this.worldSeen.add(`veh-${v.id}`);
          const size = (this.textures.get(key8).getSourceImage() as HTMLCanvasElement).height;
          const scale = Math.max(1, Math.round((len * P.S * 1.05) / (size * 0.88)));
          im.setTexture(key8, dirIndex(v.facing)).setOrigin(0.5, 0.62).setScale(scale).setPosition(P.sx(v.x, v.y), P.sy(v.x, v.y)).setDepth(dep).setVisible(true);
          if (isBus) im.setTint(v.crashed ? 0x6a6a6a : team!.colour); else im.clearTint();
          im.setAngle(v.crashed ? 6 : 0);
        } });
        const open = isBus ? holdOpen(v) : v.state === "loading" || v.state === "unloading";
        if (open) things.push({ d: depth + 0.001, draw: () => {
          const rr = { x: v.x - Math.cos(v.facing) * (len / 2), y: v.y - Math.sin(v.facing) * (len / 2) };
          g.fillStyle(0x1a1208, 0.9).fillCircle(P.sx(rr.x, rr.y), P.sy(rr.x, rr.y, 0.8), P.S * 0.6);
        } });
        continue;
      }
      things.push({ d: depth, draw: () => {
        if (isBus) {
          box(v.x, v.y, len, wid, h, v.facing, v.crashed ? 0x444444 : team!.colour2, v.crashed ? 0x666666 : team!.colour);
          // Windscreen at the front, and the name along the roof.
          const fx = v.x + Math.cos(v.facing) * (len / 2 - 0.6), fy = v.y + Math.sin(v.facing) * (len / 2 - 0.6);
          box(fx, fy, 0.8, wid * 0.9, h + 0.05, v.facing, 0x223344, 0x2f4a66);
          const lx2 = P.sx(v.x, v.y), ly2 = P.sy(v.x, v.y, h);
          g.fillStyle(0xffffff, 0.92).fillRect(lx2 - P.S * 2.2, ly2 - P.S * 0.25, P.S * 4.4, P.S * 0.55);
        } else {
          box(v.x, v.y, len, wid, h, v.facing, 0xb8862f, 0xd9a441);
          const fx = v.x + Math.cos(v.facing) * (len / 2 - 0.9), fy = v.y + Math.sin(v.facing) * (len / 2 - 0.9);
          box(fx, fy, 1.8, wid, h * 0.85, v.facing, 0x1d3f66, 0x2d5a8a);
        }
        const open = isBus ? holdOpen(v) : v.state === "loading" || v.state === "unloading";
        if (open) {
          const rr = { x: v.x - Math.cos(v.facing) * (len / 2), y: v.y - Math.sin(v.facing) * (len / 2) };
          g.fillStyle(0x1a1208, 0.9).fillCircle(P.sx(rr.x, rr.y), P.sy(rr.x, rr.y, 0.8), P.S * 0.7);
        }
      } });
    }

    // Traffic on the ring road.
    for (const c of st.traffic ?? []) {
      if (!onScreen(c.x, c.y, 260)) continue;
      const key = `w-${c.kind}8`;
      if (!sprites || !this.textures.exists(key)) continue;
      this.shadowG.fillStyle(0x000000, 0.3).fillEllipse(Math.round(P.sx(c.x + 0.2, 0)), Math.round(P.sy(0, c.y + 0.3)), 4.4 * P.S, 1.6 * P.S);
      things.push({ d: c.y + 0.9, draw: () => {}, spr: (dep) => {
        let im = this.worldSprites.get(c.id);
        if (!im) { im = this.add.image(0, 0, key, 0); this.worldSprites.set(c.id, im); }
        this.worldSeen.add(c.id);
        im.setTexture(key, dirIndex(c.dir === 1 ? 0 : Math.PI)).setOrigin(0.5, 0.68).setScale(1).setPosition(Math.round(P.sx(c.x, c.y)), Math.round(P.sy(c.x, c.y))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(0).clearTint();
      } });
      if (c.kind === "policecar" && (st.flags.armedAt || st.policeCalled)) things.push({ d: c.y + 0.91, draw: () => {
        const on = Math.floor(tick / 8) % 2, x = P.sx(c.x, c.y), y = P.sy(c.x, c.y, 1.55);
        g.fillStyle(on ? 0x2a6cff : 0xff2a2a, 1).fillRect(Math.round(x - 8), Math.round(y), 6, 4).fillStyle(on ? 0xff2a2a : 0x2a6cff, 1).fillRect(Math.round(x + 2), Math.round(y), 6, 4);
        g.fillStyle(on ? 0x2a6cff : 0xff2a2a, 0.18).fillCircle(x, y, P.S * 1.6);
      } });
    }

    // The car you've nicked: driven or left where you got out (flashing its lights if it's a police car).
    const mc = st.myCar;
    if (mc && sprites && this.textures.exists(`w-${mc.kind}8`) && onScreen(mc.x, mc.y, 260)) {
      const key = `w-${mc.kind}8`;
      this.shadowG.fillStyle(0x000000, 0.3).fillEllipse(Math.round(P.sx(mc.x + 0.2, 0)), Math.round(P.sy(0, mc.y + 0.3)), 4.4 * P.S, 1.6 * P.S);
      things.push({ d: mc.y + 0.9, draw: () => {}, spr: (dep) => {
        let im = this.worldSprites.get("mycar");
        if (!im) { im = this.add.image(0, 0, key, 0); this.worldSprites.set("mycar", im); }
        this.worldSeen.add("mycar");
        im.setTexture(key, dirIndex(mc.facing)).setOrigin(0.5, 0.68).setScale(1).setPosition(Math.round(P.sx(mc.x, mc.y)), Math.round(P.sy(mc.x, mc.y))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(0)
          .setTint(mc.damage > 6 ? 0x9a8f86 : mc.damage > 2 ? 0xd0c8c0 : 0xffffff);
      } });
    }
    // A parked car going off: its indicators flashing.
    if ((st.flags.carAlarmUntil ?? 0) > tick && Math.floor(tick / 10) % 2 === 0) {
      const ax = st.flags.carAlarmX ?? 0, ay = st.flags.carAlarmY ?? 0;
      things.push({ d: ay + 1, draw: () => { g.fillStyle(0xffa21a, 0.9).fillCircle(P.sx(ax - 1.9, ay), P.sy(ax, ay, 0.7), 3).fillCircle(P.sx(ax + 1.9, ay), P.sy(ax, ay, 0.7), 3); g.fillStyle(0xffa21a, 0.15).fillCircle(P.sx(ax, ay), P.sy(ax, ay, 0.6), P.S * 2.2); } });
    }

    // The police horse on its own (riderless, or with you up top).
    const hs = st.horse;
    if (hs && sprites && onScreen(hs.x, hs.y, 200)) {
      const base: Base = hs.rider ? (this.bank.has("horsefan") ? "horsefan" : "horse") : this.bank.has("horsefree") ? "horsefree" : "horse";
      if (this.bank.has(base)) {
        this.shadowG.fillStyle(0x000000, 0.3).fillEllipse(Math.round(P.sx(hs.x, hs.y)), Math.round(P.sy(hs.x, hs.y)), 2.6 * P.S, 0.9 * P.S);
        things.push({ d: hs.y, draw: () => {}, spr: (dep) => {
          const key = this.bank.variant(base, {});
          let sp = this.spritePool.get("horse-entity");
          if (!sp) { sp = this.add.sprite(0, 0, `${key}-rot`, 0); this.spritePool.set("horse-entity", sp); }
          seenSprites.add("horse-entity");
          const di = dirIndex(hs.facing), anim = hs.speed > 6 && this.bank.sheetReady(key, "run") ? "run" : hs.speed > 0.4 && this.bank.sheetReady(key, "walk") ? "walk" : this.bank.sheetReady(key, "idle") ? "idle" : null;
          if (anim) { const n = this.frames(`${key}-${anim}`); sp.setTexture(`${key}-${anim}`, di * n + Math.floor(tick * (anim === "run" ? 0.25 : anim === "walk" ? 0.15 : 0.08)) % n); }
          else sp.setTexture(`${key}-rot`, di);
          sp.setOrigin(0.5, feetOf(base) / cellOf(base)).setPosition(Math.round(P.sx(hs.x, hs.y)), Math.round(P.sy(hs.x, hs.y))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(0).setScale(1).setCrop().clearTint();
        } });
      }
    }

    // People.
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a.hiddenIn || (a.fb && a.fb.status === "gone" && !a.dead)) continue;
      if (st.horse?.rider === a.id) continue; // drawn as the horse
      if (!onScreen(a.x, a.y)) continue;
      // In a room: only the people in it.
      if (this.roomShown && a !== pc) { const rr = this.blds.find((b) => b.id === this.roomShown)?.rect; if (rr && !(a.x > rr.x0 - 0.3 && a.x < rr.x1 + 0.3 && a.y > rr.y0 - 0.3 && a.y < rr.y1 + 0.3)) continue; }
      if (a.dead) things.push({ d: a.y - 0.4, draw: () => g.fillStyle(0x6a0a0a, 0.85).fillEllipse(P.sx(a.x, a.y), P.sy(a.x, a.y), P.S * 2.4, P.S * (P.standing ? 1.1 : 1.8)) });
      if (a.npc?.job === "dog") {
        // His sprite (walking, running, going for someone) when it's loaded; the drawn dog if not.
        if (this.textures.exists("ronson-walk")) {
          things.push({ d: a.y, draw: () => { g.fillStyle(0x000000, 0.3).fillEllipse(P.sx(a.x, a.y), P.sy(a.x, a.y), P.S * 1.1, P.S * 0.35); }, spr: (dep) => {
            const sp = Math.hypot(a.vx, a.vy), dg = this.s.stadium!.dog, di = dirIndex(a.facing);
            const attack = !!dg && dg.state === "sicced" && sp > 4.5, key = attack ? "ronson-lunge" : sp > 2.6 ? "ronson-run" : sp > 0.2 ? "ronson-walk" : "ronson-rot";
            const n = key === "ronson-rot" ? 1 : key === "ronson-lunge" ? 7 : 8, f = key === "ronson-rot" ? di : di * n + (Math.floor(performance.now() / (attack ? 60 : sp > 2.6 ? 70 : 110)) % n);
            let im = this.worldSprites.get("dog-sprite");
            if (!im) { im = this.add.image(0, 0, key, f); this.worldSprites.set("dog-sprite", im); }
            this.worldSeen.add("dog-sprite");
            im.setTexture(key, f).setOrigin(0.5, 74 / 88).setPosition(Math.round(P.sx(a.x, a.y)), Math.round(P.sy(a.x, a.y))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(a.dead ? 90 : 0)
              .setScale((P.standing && P.S === PPM ? 1 : P.S / PPM) * 0.95);
            // Tied up and itching for it, and you've not thought of him yet: he gets the warm rim too.
            if (!a.dead && st.dog?.state === "tied" && !this.curios.has("dog") && this.pc && Math.hypot(a.x - this.pc.x, a.y - this.pc.y) < 16) this.rim("dog-sprite", im, dep);
          } });
          continue;
        }
        things.push({ d: a.y, draw: () => this.drawDog(a, g) }); continue;
      }
      const st2 = this.styleOf(a), moving = Math.hypot(a.vx, a.vy) > 0.4;
      const shiver = (a.effects.frozen ?? 0) > tick ? Math.sin(tick * 1.7 + hash(a.id)) * 0.06 : 0;
      if (!sprites) { things.push({ d: a.y, draw: () => drawFigure(g, P, a.x + shiver, a.y, a.facing, st2, tick + hash(a.id), moving) }); continue; }
      // Shadow and ring on the ground, the sprite, then anything worn on the head.
      const sh = this.shadowG, Wd = 0.5 * (st2.girth ?? 1) * P.S, gx = P.sx(a.x, a.y), gy = P.sy(a.x, a.y);
      if (!a.seated) sh.fillStyle(0x000000, 0.28).fillEllipse(gx, gy, Wd * 2.2, Wd * 0.9 * (P.standing ? 1 : 2));
      if (st2.ring) sh.lineStyle(3, st2.ring, 1).strokeEllipse(gx, gy, Wd * 2.9, Wd * (P.standing ? 1.25 : 2.9));
      seenSprites.add(a.id);
      // Up on the stand roof, or floating down under a canopy: drawn above everything.
      things.push({ d: a.roof || this.liftOf(a) > 0 ? 1e5 + a.y : a.y, draw: () => {}, spr: (depth) => this.placeSprite(a, st2, shiver, moving, depth) });
      // Starkers: the telly's pixelated blur over the crotch (a little mosaic of skin tones that
      // shimmers as he moves), not drawn from behind.
      if (isNaked(a) && !st2.down && !a.seated && dirIndex(a.facing) !== 4) things.push({ d: a.y + 0.0004, draw: () => {
        const di = dirIndex(a.facing), side = di === 2 ? 1 : di === 6 ? -1 : di === 1 || di === 3 ? 0.5 : di === 7 || di === 5 ? -0.5 : 0;
        const cx = Math.round(P.sx(a.x + shiver, a.y) + side * P.S * 0.06), cy = Math.round(P.sy(a.x, a.y, this.liftOf(a) + 0.47));
        this.mosaic(g, cx, cy, Math.max(2, Math.round(P.S * 0.045)), Math.abs(side) === 1 ? 2 : 3, 3, Math.floor(tick / 6));
      } });
      // Out cold: little stars going round; the dead lie still in their own blood.
      if (knockedOut(this.w, a) && !a.dead) things.push({ d: a.y + 0.0003, draw: () => {
        const cx = P.sx(a.x, a.y), cy = P.sy(a.x, a.y, 0.7), t = tick * 0.08 + Math.abs(hash(a.id)) % 7;
        for (let i = 0; i < 3; i++) { const an = t + (i * Math.PI * 2) / 3; g.fillStyle(0xf2e94c, 1).fillRect(Math.round(cx + Math.cos(an) * 11) - 1, Math.round(cy + Math.sin(an) * 4) - 1, 3, 3); }
      } });
      // Phones held up to film a fight, with the odd flash.
      const gk = a.npc?.gawk;
      if (gk?.filming && gk.until > tick && !a.seated && a.downUntil <= tick) things.push({ d: a.y + 0.0002, draw: () => {
        const d = P.dir(gk.x - a.x, gk.y - a.y), px = Math.round(P.sx(a.x, a.y) + d.x * 9), py = Math.round(P.sy(a.x, a.y, 1.5) + Math.max(0, d.y) * 4);
        g.fillStyle(0x15171a, 1).fillRect(px - 3, py - 5, 6, 10);
        g.fillStyle(0xbfe3ff, 1).fillRect(px - 2, py - 4, 4, 7);
        if ((tick + Math.abs(hash(a.id))) % 150 < 3) g.fillStyle(0xffffff, 0.9).fillCircle(px, py - 4, 6);
      } });
      if (st2.hat || st2.face || (a.effects.bloody ?? 0) > tick || a.npc?.job === "police" || a.npc?.job === "armed")
        things.push({ d: a.y + 0.0001, draw: () => this.drawHeadwear(g, a, st2) });
    }
    // Photographers crouched behind each goal; their flashes go off when someone shoots.
    if (sprites && this.bank.has("lad")) {
      const key = this.bank.variant("lad", { shirt: 0x2a2d33, trim: 0x2a2d33, skin: 0xd9a47e });
      const flashing = performance.now() < this.flashesUntil;
      for (const sx of [-1, 1]) for (const [i, py] of [-9, -6, 5.5, 8.5].entries()) {
        const x = sx * 38.6, y = py, id = `photo${sx}${i}`;
        if (!onScreen(x, y, 120)) continue;
        things.push({ d: y, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(id);
          if (!im) { im = this.add.image(0, 0, `${key}-rot`, 0); this.worldSprites.set(id, im); }
          this.worldSeen.add(id);
          im.setTexture(`${key}-rot`, sx < 0 ? 2 : 6).setOrigin(0.5, FEET / CELL).setCrop(0, 0, CELL, 60).setPosition(Math.round(P.sx(x, y)), Math.round(P.sy(x, y)) + 14).setDepth(dep).setVisible(true).setAlpha(1).setAngle(0).clearTint();
        } });
        if (flashing && (i + Math.floor(performance.now() / 90)) % 3 === 0) things.push({ d: y + 0.01, draw: () => {
          const fx = P.sx(x + sx * 0.4, y), fy = P.sy(x, y, 1.1);
          g.fillStyle(0xffffff, 0.95).fillCircle(fx, fy, 5).fillStyle(0xffffff, 0.25).fillCircle(fx, fy, P.S * 0.9);
        } });
      }
    }

    // Ball and goals.
    const b = m.ball;
    things.push({ d: b.y + 0.01, draw: () => drawBall(g, P, b.x, b.y, b.z) });
    for (const sgn of [-1, 1]) things.push({ d: PITCH.goalW / 2, draw: () => drawGoalFrame(g, P, sgn) });

    this.quietG.clear();
    // (No grey veil over the ground any more: the floors themselves are quieter; see ensureFloor.)
    // Up on a roof: the drop below dimmed, fading in and out.
    { const r = pc?.roof ? roofOf(pc) : undefined; this.roofDimK = Math.max(0, Math.min(1, this.roofDimK + (r ? 0.08 : -0.12)));
      if (r && this.roofDimK > 0) { const k = this.roofDimK; things.push({ d: 9e4, draw: () => this.roofView(g, r, k) }); } }
    things.sort((p, q) => p.d - q.d);
    // Paint in order, starting a fresh graphics layer after each sprite.
    let order = 100, li = 0, open = false;
    const nextLayer = () => {
      let l = this.layers[li];
      if (!l) { l = this.add.graphics(); this.layers.push(l); }
      li++;
      l.setVisible(true).setDepth(order++);
      return l;
    };
    for (const t of things) {
      if (t.spr) { t.spr(order++); open = false; continue; }
      if (!open) { g = nextLayer(); this.lastLayer = g; open = true; }
      t.draw();
    }
    g = nextLayer();
    for (const [id, sp] of this.spritePool) if (!seenSprites.has(id)) sp.setVisible(false);
    for (const [id, r] of this.rimPool) if (!this.rimSeen.has(id)) r.setVisible(false);
    if (this.canopy && !this.pc?.chute) this.canopy.setVisible(false);
    // Behind a wall, roof or van: your outline drawn through it, so you never lose yourself.
    {
      const me = pc && this.spritePool.get(pc.id);
      if (!this.ghost) this.ghost = this.add.sprite(0, 0, "__DEFAULT").setDepth(9e6).setVisible(false);
      if (me && this.pcHidden && me.visible) {
        this.ghost.setTexture(me.texture.key, me.frame.name).setOrigin(me.originX, me.originY).setPosition(me.x, me.y).setScale(me.scaleX).setAngle(me.angle)
          .setTint(0xf2c94c).setTintMode(Phaser.TintModes.FILL).setAlpha(0.45).setVisible(true);
      } else this.ghost.setVisible(false);
    }
    for (const [id, sp] of this.worldSprites) if (!this.worldSeen.has(id)) sp.setVisible(false);
    for (const [id, ts] of this.wallSprites) if (!this.wallSeen.has(id)) ts.setVisible(false);
    for (const [id, ts] of this.shellSprites) if (!this.shellSeen.has(id)) ts.setVisible(false);
    for (const c of st.smoke) {
      if (c.until < tick) continue;
      const left = (c.until - tick) / (60 * (c.kind === "stench" ? 20 : 25));
      const stink = c.kind === "stench";
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + tick * (stink ? 0.008 : 0.004), rr = c.r * (0.45 + 0.35 * Math.sin(i * 1.7 + tick * 0.01));
        const x = c.x + Math.cos(a) * rr * 0.7, y = c.y + Math.sin(a) * rr * 0.5;
        const col = stink ? (i % 2 ? 0x9bbf3a : 0x6f8f2a) : i % 2 ? 0xd9d9d4 : 0xbfc0bb;
        g.fillStyle(col, (stink ? 0.28 : 0.55) * Math.min(1, left * 3)).fillEllipse(P.sx(x, y), P.sy(x, y, stink ? 0.6 : 1.2), c.r * P.S * 0.9, c.r * P.S * 0.6 * (P.standing ? P.K : 1));
      }
      // Stink lines wobbling up off it.
      if (stink) for (let i = 0; i < 5; i++) {
        const sx = c.x + Math.cos(i * 1.3) * c.r * 0.5, sy = c.y + Math.sin(i * 1.3) * c.r * 0.35, ph = (tick * 0.05 + i) % 2;
        g.lineStyle(2, 0x7a9a2a, 0.7 * Math.min(1, left * 3));
        g.beginPath(); g.moveTo(P.sx(sx, sy), P.sy(sx, sy, 0.6 + ph));
        for (let k = 1; k <= 4; k++) g.lineTo(P.sx(sx + Math.sin(k * 1.8 + tick * 0.1) * 0.25, sy), P.sy(sx, sy, 0.6 + ph + k * 0.25));
        g.strokePath();
      }
      else g.fillStyle(0xff5a36, 0.8).fillCircle(P.sx(c.x, c.y), P.sy(c.x, c.y), 3);
    }

    // Blood in the air and spreading pools; the white burst where a blow lands.
    this.stepGore(dms);
    for (const d of this.drops) {
      const r = Math.max(2, Math.round(d.r * P.S));
      g.fillStyle(0x9a1010, 1).fillRect(Math.round(P.sx(d.x, d.y)), Math.round(P.sy(d.x, d.y, d.z)), r, r);
    }
    for (const p of this.pools) this.shadowG.fillStyle(0x5a0808, 0.85).fillEllipse(P.sx(p.x, p.y), P.sy(p.x, p.y), p.r * 2 * P.S, p.r * 1.5 * P.S);
    if (this.burst) {
      const age = (performance.now() - this.burst.at) / 110;
      if (age >= 1) this.burst = null;
      else {
        const bx = P.sx(this.burst.x, this.burst.y), by2 = P.sy(this.burst.x, this.burst.y, 1.45), R = P.S * (0.35 + age * 0.5) * this.burst.k;
        g.fillStyle(0xffffff, 1 - age).fillCircle(bx, by2, R * 0.55);
        g.lineStyle(3, 0xfff3c4, 1 - age);
        for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + 0.3; g.lineBetween(bx + Math.cos(an) * R * 0.6, by2 + Math.sin(an) * R * 0.6, bx + Math.cos(an) * R * 1.3, by2 + Math.sin(an) * R * 1.3); }
      }
    }

    // Muzzle flash.
    if (this.flash && this.flash.until > tick) {
      const fx = P.sx(this.flash.x, this.flash.y), fy = P.sy(this.flash.x, this.flash.y, P.standing ? 1.3 : 0);
      g.fillStyle(0xfff2a0, 0.95).fillCircle(fx, fy, P.S * 0.35);
      if (pc) g.lineStyle(1.5, 0xfff2a0, 0.6).lineBetween(fx, fy, P.sx(pc.x, pc.y), P.sy(pc.x, pc.y, P.standing ? 1.1 : 0));
    }

    this.stirCrowd();
    if (sprites && P.standing) {
      const people: { x: number; y: number }[] = [];
      for (const id in s.actors) { const a = s.actors[id]; if (!a.hiddenIn && !a.seated && a.y > 45) people.push(a); }
      const van = this.placed.list.find((p) => p.key === "burgervan");
      const puddles = this.placed.list.filter((p) => p.key === "puddle");
      const heads: { x: number; y: number; h: number }[] = [];
      for (const a of people) if (heads.length < 14 && onScreen(a.x, a.y)) heads.push({ x: a.x, y: a.y, h: 1.6 });
      const here = pc ? areaAt(pc.x, pc.y) : null;
      this.fx.update(dms, VENUE.id, people, van ? { x: van.x, y: van.y } : null, cam.worldView, puddles, heads, !!here?.outside);
    }
    // Drizzle: a British November match day. Not indoors.
    {
      const here = pc ? areaAt(pc.x, pc.y) : null;
      if (!this.rainG) this.rainG = this.add.graphics().setDepth(9.9e6);
      this.rainG.clear();
      const inside = !!pc && !pc.roof && (!here?.outside && !here?.seats && !here?.pitch || this.blds.some((b) => pc.x > b.rect.x0 && pc.x < b.rect.x1 && pc.y > b.rect.y0 && pc.y < b.rect.y1));
      if (!inside && !this.inCab()) {
        const v = cam.worldView, t = performance.now() / 1000, rg = this.rainG;
        rg.lineStyle(1, 0xc8d2dc, 0.22);
        for (let i = 0; i < 90; i++) {
          const fx = ((i * 7919) % 1000) / 1000, fy = ((i * 104729) % 1000) / 1000, sp = 0.6 + ((i * 31) % 10) / 25;
          const x = v.x + ((fx * v.width - t * 60 * sp) % v.width + v.width) % v.width;
          const y = v.y + ((fy * v.height + t * 520 * sp) % v.height);
          rg.lineBetween(Math.round(x), Math.round(y), Math.round(x - 3), Math.round(y + 10));
        }
      }
    }
    // Crowd bounce after a goal.
    if (this.crowdJump) {
      const j = Math.abs(Math.sin(this.crowdJump * 0.35)) * 3;
      this.crowdG.y = this.crowdJump > 0 ? -j : 0;
      if (this.crowdBlit) this.crowdBlit.y = this.crowdG.y;
      this.crowdJump += this.crowdJump > 0 ? -1 : 1;
    } else { this.crowdG.y = 0; if (this.crowdBlit) this.crowdBlit.y = 0; }

    // Aim marker and the player's own marker.
    const ui = this.ui, u = P.S / 16;
    ui.clear();
    if (pc && !pc.hiddenIn) {
      const tgt = (pc.hand && hasProp(s.items[pc.hand], "throwable") || (pc.hand && defOf(s.items[pc.hand]).size === "small")) && (this.picked || this.fightOn()) ? throwTarget(this.w, pc, this.picked) : null;
      (this as any).throwAt = tgt;
      if (tgt) {
        const tx = P.sx(tgt.x, tgt.y), ty = P.sy(tgt.x, tgt.y) - (P.standing ? 0.9 * P.KZ * P.S : 0);
        ui.lineStyle(2 * u, 0xf2c94c, 0.9).strokeCircle(tx, ty, P.S * 0.9);
        ui.lineBetween(tx - P.S * 1.2, ty, tx - P.S * 0.6, ty).lineBetween(tx + P.S * 0.6, ty, tx + P.S * 1.2, ty);
        // The arc it'll fly: a dotted lob from his hand (higher the further it goes).
        const fx = P.sx(pc.x, pc.y), fy = P.sy(pc.x, pc.y) - 1.3 * P.KZ * P.S, dd = Math.hypot(tgt.x - pc.x, tgt.y - pc.y), hgt = Math.min(5, 0.8 + dd * 0.22) * P.S;
        for (let i = 1; i < 14; i++) {
          const t2 = i / 14, dx2 = fx + (tx - fx) * t2, dy2 = fy + (ty - fy) * t2 - Math.sin(Math.PI * t2) * hgt;
          ui.fillStyle(0xf2c94c, 0.35 + 0.5 * (1 - Math.abs(t2 - 0.5))).fillCircle(dx2, dy2, P.S * 0.09);
        }
      }
      const hx = P.sx(pc.x, pc.y), hy = headTop(P, pc.x, pc.y, 1.75) - 4 * u;
      ui.fillStyle(0xd7263d, 1).fillTriangle(hx - 5 * u, hy - 8 * u, hx + 5 * u, hy - 8 * u, hx, hy);
      // What the red button would act on.
      const at = this.primaryAt;
      if (at) {
        const pulse = 0.6 + 0.4 * Math.sin(tick * 0.18);
        ui.lineStyle(2.5 * u, 0xd7263d, pulse).strokeEllipse(P.sx(at.x, at.y), P.sy(at.x, at.y), P.S * 1.6, P.S * (P.standing ? 0.75 : 1.6));
      }
      // Gold coins over anyone selling something; red marks over anyone coming for you.
      for (const id in s.actors) {
        const a = s.actors[id], n = a.npc;
        if (!n || a.hiddenIn || a.dead || Math.hypot(a.x - pc.x, a.y - pc.y) > 22) continue;
        const tx = P.sx(a.x, a.y), ty = headTop(P, a.x, a.y) - 6 * u;
        // Winding up to hit you back: a big flashing "!" — hit him now and it's a counter.
        if (n.retaliateAt && n.retaliateOn === pc.id && n.retaliateAt > tick && n.retaliateAt - tick <= 30) {
          const on = Math.floor(tick / 4) % 2 === 0;
          ui.fillStyle(0x000000, 1).fillRect(tx - 4 * u, ty - 22 * u, 8 * u, 15 * u).fillRect(tx - 4 * u, ty - 5 * u, 8 * u, 6 * u);
          ui.fillStyle(on ? 0xff2a3a : 0xf2c94c, 1).fillRect(tx - 2.5 * u, ty - 20.5 * u, 5 * u, 12 * u).fillRect(tx - 2.5 * u, ty - 3.5 * u, 5 * u, 3 * u);
          continue;
        }
        // A grass on his way to a steward: an eye, and a ring running down until he gets there.
        const sn = st.snitches?.find((x) => x.by === a.id);
        if (sn) {
          const left = Math.max(0, Math.min(1, (sn.until - tick) / (sn.until - sn.at))), ey = ty - 9 * u, pulse = 0.75 + 0.25 * Math.sin(tick * 0.25);
          ui.fillStyle(0x000000, 0.8).fillCircle(tx, ey, 10 * u);
          ui.lineStyle(2.5 * u, 0xff3b3b, 1).beginPath().arc(tx, ey, 9 * u, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2).strokePath();
          ui.fillStyle(0xffffff, pulse).fillEllipse(tx, ey, 12 * u, 7 * u);
          ui.fillStyle(0xd7263d, 1).fillCircle(tx, ey, 2.6 * u);
          ui.fillStyle(0x000000, 1).fillCircle(tx, ey, 1.2 * u);
          continue;
        }
        if (n.shop || n.job === "barman") {
          ui.fillStyle(0xf2c94c, 1).fillCircle(tx, ty - 4 * u, 5 * u);
          ui.fillStyle(0x7a5a10, 1).fillRect(tx - u, ty - 7 * u, 2 * u, 6 * u);
        } else if (n.target === pc.id && (n.mode === "approach" || n.mode === "chase" || n.mode === "escort")) {
          ui.fillStyle(0xd7263d, 1).fillTriangle(tx - 6 * u, ty, tx + 6 * u, ty, tx, ty - 11 * u);
          ui.fillStyle(0xffffff, 1).fillRect(tx - u, ty - 8 * u, 2 * u, 4 * u).fillRect(tx - u, ty - 3 * u, 2 * u, 2 * u);
        } else if (n.target === pc.id && n.mode === "watch") {
          ui.lineStyle(2 * u, 0xf2c94c, 0.9).strokeCircle(tx, ty - 4 * u, 4 * u);
        } else if (n.target === pc.id && n.mode === "search") {
          // Looking for you: a "?" (they've lost you, for now).
          ui.fillStyle(0x000000, 1).fillRect(tx - 4 * u, ty - 14 * u, 8 * u, 15 * u);
          ui.fillStyle(0xf2c94c, 1).fillRect(tx - 2.5 * u, ty - 12.5 * u, 5 * u, 2 * u).fillRect(tx + 0.5 * u, ty - 10.5 * u, 2 * u, 3 * u).fillRect(tx - 1 * u, ty - 7.5 * u, 2 * u, 2 * u).fillRect(tx - 1 * u, ty - 3 * u, 2 * u, 2 * u);
        }
      }
    }

    // Where you tapped to walk to: a ring on the ground (red if there's no way there).
    if (this.walkTo && pc) {
      const wt = this.walkTo, k = 0.6 + 0.4 * Math.sin(tick * 0.2), u3 = DPR / cam.zoom;
      const col = wt.blocked ? 0xff3b3b : 0xffffff;
      ui.lineStyle(2.5 * u3, 0x000000, 0.6).strokeEllipse(P.sx(wt.x, wt.y), P.sy(wt.x, wt.y), P.S * 1.25, P.S * (P.standing ? 0.55 : 1.25));
      ui.lineStyle(1.8 * u3, col, k).strokeEllipse(P.sx(wt.x, wt.y), P.sy(wt.x, wt.y), P.S * 1.1, P.S * (P.standing ? 0.48 : 1.1));
    }

    // Who's after you, and arrows at the screen's edge for those you can't see (and the dog).
    this.pursuers = pc ? Object.values(s.actors).filter((a) => a.npc && !a.hiddenIn && !a.dead && a.npc.target === pc.id && ["approach", "chase", "escort"].includes(a.npc.mode)) : [];
    if (pc && !pc.seated) {
      // Kept clear of the score and buttons at the top and the controls at the bottom (CSS px -> world).
      const v = cam.worldView, u2 = DPR / cam.zoom, pad = 30 * u2, padT = 84 * u2, padB = 96 * u2;
      const dogA = st.dog ? s.actors[st.dog.id] : null;
      const marks: [Actor, number][] = this.pursuers.map((a) => [a, 0xd7263d]);
      if (dogA && st.dog && st.dog.state !== "tied" && st.dog.state !== "led") marks.push([dogA, 0xf2c94c]);
      for (const [a, col] of marks) {
        const ax = P.sx(a.x, a.y), ay = P.sy(a.x, a.y) - P.S;
        if (ax > v.x && ax < v.right && ay > v.y && ay < v.bottom) continue;
        const cx = v.centerX, cy = v.centerY, ang = Math.atan2(ay - cy, ax - cx);
        const ex = Phaser.Math.Clamp(ax, v.x + pad, v.right - pad), ey = Phaser.Math.Clamp(ay, v.y + padT, v.bottom - padB);
        const r = 15 * u2, pulse = 0.65 + 0.35 * Math.sin(tick * 0.2);
        const pts = [0, 2.5, -2.5].map((o, i) => ({ x: ex + Math.cos(ang + o) * (i ? r * 0.8 : r * 1.4), y: ey + Math.sin(ang + o) * (i ? r * 0.8 : r * 1.4) }));
        ui.fillStyle(0x000000, 0.5).fillCircle(ex, ey, r * 1.1);
        ui.fillStyle(col, pulse).fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      }
      // The tracked lead: a gold star over it on screen, or one at the edge pointing the way.
      const tt = this.trackT;
      if (tt) {
        const ax = P.sx(tt.x, tt.y), ay = P.sy(tt.x, tt.y) - P.S * 2.4, r = 9 * u2, bob = Math.sin(tick * 0.12) * 3 * u2;
        const on = ax > v.x + pad && ax < v.right - pad && ay > v.y + padT && ay < v.bottom - padB;
        const ex = on ? ax : Phaser.Math.Clamp(ax, v.x + pad, v.right - pad), ey = on ? ay + bob : Phaser.Math.Clamp(ay, v.y + padT, v.bottom - padB);
        const star = (x: number, y: number, rr: number) => { const pts: Phaser.Math.Vector2[] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? rr * 0.45 : rr; pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * q, y + Math.sin(a) * q)); } return pts; };
        ui.fillStyle(0x000000, 0.55).fillCircle(ex, ey, r * 1.35);
        ui.fillStyle(0xf2c94c, 1).fillPoints(star(ex, ey, r), true);
        if (!on) { const ang = Math.atan2(ay - ey, ax - ex); ui.fillStyle(0xf2c94c, 0.9).fillTriangle(ex + Math.cos(ang) * r * 2.1, ey + Math.sin(ang) * r * 2.1, ex + Math.cos(ang + 0.5) * r * 1.4, ey + Math.sin(ang + 0.5) * r * 1.4, ex + Math.cos(ang - 0.5) * r * 1.4, ey + Math.sin(ang - 0.5) * r * 1.4); }
      }
    }
    // Why someone's broken off what they were doing, because of you: a badge over their head while it
    // lasts (the Goose's readable reactions). A keg: off to fetch one back. A red burst: angry.
    const whySeen = new Set<string>();
    if (pc) for (const id in s.actors) {
      const a = s.actors[id], n = a.npc;
      // While he's doing the double-take, the body says it: the badge comes after.
      if (!n?.why || (n.whyUntil ?? 0) <= tick || a.hiddenIn || a.dead || !onScreen(a.x, a.y) || this.react.has(id)) continue;
      const u5 = DPR / cam.zoom, bx = P.sx(a.x, a.y), by = headTop(P, a.x, a.y) - 14 * u5 - Math.abs(Math.sin(tick * 0.12)) * 3 * u5, r5 = 9 * u5;
      ui.fillStyle(0x000000, 1).fillCircle(bx, by, r5 + 2 * u5).fillTriangle(bx - 4 * u5, by + r5 - u5, bx + 4 * u5, by + r5 - u5, bx, by + r5 + 6 * u5);
      ui.fillStyle(n.why === "angry" ? 0xd7263d : n.why === "search" ? 0xf2c94c : n.why === "report" ? 0x3d7fd9 : 0xfffdf3, 1).fillCircle(bx, by, r5);
      if (n.why === "fetch") {
        // The keg's own picture in the badge.
        let ic = this.whyIcons.get(id);
        if (!ic) { ic = this.add.image(0, 0, "ico-keg").setDepth(1e7 + 1); this.whyIcons.set(id, ic); }
        ic.setPosition(Math.round(bx), Math.round(by)).setScale((r5 * 1.7) / 48).setVisible(true);
        whySeen.add(id);
      } else if (n.why === "search") {
        // A question mark: looking for something.
        ui.lineStyle(2.4 * u5, 0x111111, 1).beginPath().arc(bx, by - 2.2 * u5, 3 * u5, Math.PI * 1.05, Math.PI * 2.45).strokePath();
        ui.fillStyle(0x111111, 1).fillRect(bx - 1.1 * u5, by + 0.4 * u5, 2.2 * u5, 2.4 * u5).fillRect(bx - 1.1 * u5, by + 3.8 * u5, 2.2 * u5, 2.2 * u5);
      } else if (n.why === "report") {
        // A radio: off to tell someone.
        ui.fillStyle(0xffffff, 1).fillRect(bx - 3 * u5, by - 3 * u5, 6 * u5, 8.5 * u5).fillRect(bx + 1.2 * u5, by - 7 * u5, 1.6 * u5, 4.5 * u5);
        ui.fillStyle(0x3d7fd9, 1).fillRect(bx - 1.8 * u5, by - 1.6 * u5, 3.6 * u5, 2.4 * u5);
      } else {
        ui.fillStyle(0xffffff, 1).fillRect(bx - 1.2 * u5, by - 5.5 * u5, 2.4 * u5, 7 * u5).fillRect(bx - 1.2 * u5, by + 3 * u5, 2.4 * u5, 2.4 * u5);
      }
    }
    for (const [id, ic] of this.whyIcons) if (!whySeen.has(id)) ic.setVisible(false);
    // The pundit's arrows: a chain of three or more, drawn on the world like Sky's telestrator,
    // one stroke after another from the first thing you did to what it led to.
    if (this.tele && performance.now() < this.tele.until) {
      const u4 = DPR / cam.zoom, age = 1 - (this.tele.until - performance.now()) / 4200, pts = this.tele.pts;
      const shown = Math.min(pts.length - 1, Math.floor(age * 6));
      for (let i = 0; i < pts.length; i++) {
        const x = P.sx(pts[i].x, pts[i].y), y = P.sy(pts[i].x, pts[i].y) - P.S * 0.4;
        if (i <= shown + 1) { ui.lineStyle(5 * u4, 0x000000, 0.6).strokeCircle(x, y, P.S * 0.75); ui.lineStyle(3 * u4, 0xf2e94c, 1).strokeCircle(x, y, P.S * 0.75); for (let k = 0; k <= i; k++) ui.fillStyle(0xf2e94c, 1).fillCircle(x - P.S * 0.3 + k * P.S * 0.22, y - P.S * 1.05, 3 * u4); }
        if (i < pts.length - 1 && i <= shown) {
          const x2 = P.sx(pts[i + 1].x, pts[i + 1].y), y2 = P.sy(pts[i + 1].x, pts[i + 1].y) - P.S * 0.4, a = Math.atan2(y2 - y, x2 - x), d = Math.hypot(x2 - x, y2 - y);
          if (d < P.S * 1.6) continue;
          const sx0 = x + Math.cos(a) * P.S * 0.8, sy0 = y + Math.sin(a) * P.S * 0.8, ex = x2 - Math.cos(a) * P.S * 0.85, ey = y2 - Math.sin(a) * P.S * 0.85;
          ui.lineStyle(7 * u4, 0x000000, 0.55).lineBetween(sx0, sy0, ex, ey);
          ui.lineStyle(4 * u4, 0xf2e94c, 1).lineBetween(sx0, sy0, ex, ey);
          const hl = 9 * u4;
          ui.fillStyle(0xf2e94c, 1).fillTriangle(ex + Math.cos(a) * hl * 0.6, ey + Math.sin(a) * hl * 0.6, ex + Math.cos(a + 2.5) * hl, ey + Math.sin(a + 2.5) * hl, ex + Math.cos(a - 2.5) * hl, ey + Math.sin(a - 2.5) * hl);
        }
      }
    } else if (this.tele) this.tele = null;
    // The match's job: whoever it names gets a warm ring at their feet (the rim alone is lost at the wide
    // spectating zoom).
    if (pc && this.job?.target && !this.instinct) {
      const ja = s.actors[this.job.target];
      if (ja && !ja.dead && ja.fb?.status !== "gone" && onScreen(ja.x, ja.y)) {
        const k = 0.5 + 0.5 * Math.sin(tick * 0.12), u6 = DPR / cam.zoom, jx = P.sx(ja.x, ja.y), jy = P.sy(ja.x, ja.y);
        ui.lineStyle(5 * u6, 0x000000, 0.45).strokeEllipse(jx, jy, P.S * (1.3 + 0.3 * k) + 12 * u6, (P.S * (1.3 + 0.3 * k) + 12 * u6) * 0.45);
        ui.lineStyle(3 * u6, 0xffd75a, 0.6 + 0.4 * k).strokeEllipse(jx, jy, P.S * (1.3 + 0.3 * k) + 12 * u6, (P.S * (1.3 + 0.3 * k) + 12 * u6) * 0.45);
      }
    }
    // Half-time: the referee's tea urn pulses for the break (that's where his cuppa comes from).
    if (pc && s.match?.phase === "break" && s.match.period === 1) {
      const urn = Object.values(s.items).find((i) => i.def === "tea_urn" && i.loc.k !== "gone");
      const at = urn ? itemAt(this.w, urn) : null;
      if (at) { const pulse = 0.5 + 0.5 * Math.sin(tick * 0.15); ui.lineStyle(3 * DPR / cam.zoom, 0xf2c94c, 0.4 + 0.5 * pulse).strokeCircle(P.sx(at.x, at.y), P.sy(at.x, at.y), P.S * (0.8 + 0.3 * pulse)); }
    }
    // What's in your hand is for: those places pulse (the nearest with its name), or an arrow at the
    // edge points the way to the nearest. Worked out a few times a second.
    if (pc && !pc.roof) {
      if (tick % 15 === 0 || this.itemTgtFor !== (pc.hand ?? "")) { this.itemTgtFor = pc.hand ?? ""; const h = pc.hand ? s.items[pc.hand] : undefined; this.itemTgts = h ? itemTargets(this.w, pc, h) : []; }
      const v = cam.worldView, u2 = DPR / cam.zoom, pad = 30 * u2, padT = 90 * u2, padB = 150 * u2;
      let labelled = false;
      this.itemTgts.forEach((t, i) => {
        const ax = P.sx(t.x, t.y), ay = P.sy(t.x, t.y) - P.S * 1.2, on = ax > v.x + pad && ax < v.right - pad && ay > v.y + padT && ay < v.bottom - padB;
        const pulse = 0.55 + 0.45 * Math.sin(tick * 0.18 + i), r = 8 * u2;
        if (on) {
          ui.lineStyle(3 * u2, 0xf2c94c, pulse).strokeCircle(P.sx(t.x, t.y), P.sy(t.x, t.y), P.S * (0.9 + 0.15 * pulse));
          ui.fillStyle(0x000000, 0.5).fillTriangle(ax, ay - r * 1.5, ax + r * 1.1, ay, ax, ay + r * 1.5).fillTriangle(ax, ay - r * 1.5, ax - r * 1.1, ay, ax, ay + r * 1.5);
          ui.fillStyle(0xf2c94c, 0.6 + 0.4 * pulse).fillTriangle(ax, ay - r, ax + r * 0.7, ay, ax, ay + r).fillTriangle(ax, ay - r, ax - r * 0.7, ay, ax, ay + r);
          if (!labelled) { labelled = true; this.itemLabelAt(t, ax, ay - r * 2.2, u2); }
        } else if (i === 0) {
          const ex = Phaser.Math.Clamp(ax, v.x + pad, v.right - pad), ey = Phaser.Math.Clamp(ay, v.y + padT, v.bottom - padB), ang = Math.atan2(ay - ey, ax - ex);
          ui.fillStyle(0x000000, 0.55).fillCircle(ex, ey, r * 1.5);
          ui.fillStyle(0xf2c94c, 0.95).fillTriangle(ex + Math.cos(ang) * r * 1.4, ey + Math.sin(ang) * r * 1.4, ex + Math.cos(ang + 2.4) * r, ey + Math.sin(ang + 2.4) * r, ex + Math.cos(ang - 2.4) * r, ey + Math.sin(ang - 2.4) * r);
          if (!labelled) { labelled = true; this.itemLabelAt(t, ex, ey - r * 2.6, u2); }
        }
      });
      if (!labelled) this.itemLabel?.setVisible(false);
    } else this.itemLabel?.setVisible(false);
    // Instinct (held): the world dims; useful things glow yellow, the fix targets red, the people
    // with a hook blue; every steward's eyeline is drawn on the ground.
    let instI = 0;
    if (this.instinct && pc) {
      const u3 = DPR / cam.zoom;
      const v = cam.worldView;
      ui.fillStyle(0x05070c, 0.55).fillRect(v.x - 20, v.y - 20, v.width + 40, v.height + 40);
      for (const id in s.actors) {
        const a = s.actors[id], n = a.npc;
        if (!n || a.dead || a.hiddenIn || a.downUntil > tick || !(isSecurityJob(n.job) || n.job === "armed" || n.job === "police")) continue;
        const ax = P.sx(a.x, a.y), ay = P.sy(a.x, a.y);
        if (ax < v.x - 400 || ax > v.right + 400 || ay < v.y - 400 || ay > v.bottom + 400) continue;
        const R2 = (n.job === "pitchsteward" || n.job === "police" ? 16 : 11) * P.S, hot = n.target === pc.id && n.mode !== "routine";
        ui.fillStyle(hot ? 0xff3b3b : 0xffe08a, hot ? 0.22 : 0.13);
        ui.beginPath(); ui.moveTo(ax, ay);
        for (let k2 = 0; k2 <= 12; k2++) { const an = a.facing - 0.95 + (1.9 * k2) / 12; ui.lineTo(ax + Math.cos(an) * R2, ay + Math.sin(an) * R2 * (P.standing ? P.K : 1)); }
        ui.closePath(); ui.fillPath();
      }
      const marks = instinctMarks(this.w);
      // Once you know people leave their post to fix a problem: who's stood at one (the nearest two named).
      if (this.rules.has("post")) {
        const posted = Object.values(s.actors).filter((a) => a.npc?.post && a.npc.mode === "routine" && !a.dead && !a.hiddenIn && Math.hypot(a.x - pc.x, a.y - pc.y) < 40)
          .sort((p1, p2) => Math.hypot(p1.x - pc.x, p1.y - pc.y) - Math.hypot(p2.x - pc.x, p2.y - pc.y));
        posted.forEach((a, i) => marks.push({ x: a.x, y: a.y, col: 0xf2994a, label: i < 2 ? "At a post" : "", z: 1.9 }));
      }
      for (const mk of marks) {
        const x = P.sx(mk.x, mk.y), y = P.sy(mk.x, mk.y) - (mk.z ?? 0.4) * P.S;
        if (x < v.x || x > v.right || y < v.y || y > v.bottom) continue;
        const pulse = 0.6 + 0.4 * Math.sin(tick * 0.15);
        ui.lineStyle(2.5 * u3, mk.col, pulse).strokeCircle(x, y, P.S * 0.55);
        ui.fillStyle(mk.col, 0.25 * pulse).fillCircle(x, y, P.S * 0.55);
        if (mk.label) {
          let t = this.instLabels[instI];
          if (!t) { t = this.add.text(0, 0, "", { fontFamily: '"Silkscreen", monospace', fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(9.5e6); this.instLabels.push(t); }
          t.setText(mk.label).setPosition(Math.round(x), Math.round(y - P.S * 0.7)).setScale(u3 * 1.4).setVisible(true).setColor(`#${mk.col.toString(16).padStart(6, "0")}`);
          instI++;
        }
      }
    }
    // Sat watching (or Instinct): who matters on the pitch, labelled, so you can read the game. Their
    // star, both keepers, anyone off their game. Tap a player for his card.
    if (pc && (pc.seated || this.instinct) && s.match) {
      const u3 = DPR / cam.zoom;
      for (const id in s.actors) {
        const a = s.actors[id], fb = a.fb;
        if (!fb || fb.status !== "playing") continue;
        const off = fb.bribed || (a.effects.frozen ?? 0) > tick || fb.fatigue > 0.85;
        const label = fb.star && fb.team === 1 ? `★ ${a.name.split(" ").pop()}` : fb.role === "GK" ? `GK${off ? " ?" : ""}` : off ? "off his game" : "";
        if (!label) continue;
        const x = P.sx(a.x, a.y), y = P.sy(a.x, a.y) - P.S * 2.1;
        let t = this.instLabels[instI];
        if (!t) { t = this.add.text(0, 0, "", { fontFamily: '"Silkscreen", monospace', fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(9.5e6); this.instLabels.push(t); }
        t.setText(label).setPosition(Math.round(x), Math.round(y)).setScale(u3 * 1.3).setVisible(true).setColor(fb.star && fb.team === 1 ? "#ff6b6b" : off ? "#f2c94c" : "#ffffff");
        instI++;
      }
    }
    for (let i = instI; i < this.instLabels.length; i++) this.instLabels[i].setVisible(false);

    // Speech bubbles near the player.
    const pcTalk = this.pcLine && this.pcLine.until > performance.now() && pc && !pc.hiddenIn ? this.pcLine.text : null;
    // Nearest first (you, then whoever's closest), at most six, and never on top of each other.
    const near0 = (a: Actor) => (pc ? Math.hypot(a.x - pc.x, a.y - pc.y) : 0);
    // What gets a full bubble (GTA and Hitman subtitle only what's aimed at you or matters; The Sims
    // and Animal Crossing show the rest as a little "..."): anyone talking to you or near you,
    // security, and anything useful (a lead, a fix). Of the background chatter, only the nearest
    // one line at a time; everyone else chatting gets a chat dot.
    const speaking = Object.values(s.actors).filter((a) => a.npc?.bubble && !a.hiddenIn && onScreen(a.x, a.y)).sort((p, q) => near0(p) - near0(q));
    const talkingTo = this.talkedTo && performance.now() - this.talkedTo.at < 12000 ? this.talkedTo.id : null;
    // A text budget: tips only count when said near you; the first ten seconds belong to the drayman
    // and his keg; and never more than two other people's lines on screen at once (one while Grozz talks).
    const opening = s.tick < 60 * 10;
    const beatIds = this.beatRel && performance.now() < this.beatRel.until ? this.beatRel.ids : [];
    const matters = (a: Actor) => opening ? (a.npc!.job === "worker" || beatIds.includes(a.id)) : a.id === talkingTo || (a.npc!.mode !== "routine" && a.npc!.mode !== "flee") || (isHint(a.npc!.bubble!.text) && near0(a) < 8) || !!st.snitches?.some((x) => x.by === a.id) || ((a.npc!.whyUntil ?? 0) > s.tick && !!a.npc!.why) || beatIds.includes(a.id);
    const key = speaking.filter(matters), chatter = speaking.filter((a) => !matters(a));
    const shownChat = opening ? [] : chatter.filter((a) => near0(a) < 4.5).slice(0, 1);
    const others = [...key, ...shownChat].slice(0, pcTalk ? 1 : 2);
    const talkers = [...(pcTalk ? [pc!] : []), ...others].slice(0, this.bubbles.length);
    const dots = chatter.filter((a) => !shownChat.includes(a));
    if (!this.bubbleG) this.bubbleG = this.add.graphics().setDepth(1e7 + 0.5);
    const bg = this.bubbleG.clear(), zz = this.cameras.main.zoom, px = DPR / zz;
    for (const a of dots) {
      // A chat dot: a small white pill with three dots, over their head.
      const tx = Math.round(P.sx(a.x, a.y)), ty = Math.round(headTop(P, a.x, a.y) - 8 * px - this.liftOf(a) * P.S);
      bg.fillStyle(0x000000, 0.85).fillRoundedRect(tx - 11 * px, ty - 9 * px, 22 * px, 11 * px, 4 * px);
      bg.fillStyle(0xf6f3ea, 0.95).fillRoundedRect(tx - 10 * px, ty - 8 * px, 20 * px, 9 * px, 3 * px);
      const ph = Math.floor(performance.now() / 300) % 3;
      for (let k = 0; k < 3; k++) bg.fillStyle(k === ph ? 0x12151a : 0x8a8a8a, 1).fillRect(tx + (k - 1) * 5 * px - px, ty - 4.5 * px, 2 * px, 2 * px);
    }
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const rb = $("radarBox"), radarR = rb.hidden ? null : rb.getBoundingClientRect();
    this.bubbles.forEach((bt, i) => {
      const a = talkers[i];
      if (!a) { bt.setVisible(false); return; }
      // A comic bubble: same size on screen whatever the zoom, a black pixel outline and a tail.
      const tx = Math.round(P.sx(a.x, a.y)), ty0 = Math.round(headTop(P, a.x, a.y) - 10 * px);
      const lift = this.liftOf(a) * P.S;
      const ambient = !!a.npc && shownChat.includes(a), hintLine = !!a.npc && isHint(a.npc.bubble!.text);
      bt.setVisible(true).setText(a.npc ? a.npc.bubble!.text : pcTalk!).setScale((ambient ? 0.85 : 1) / zz).setAlpha(ambient ? 0.92 : 1);
      const w2 = bt.displayWidth, h2 = bt.displayHeight;
      // Slide sideways off the screen edge, and up past any bubble it would cover.
      const v = this.cameras.main.worldView;
      let bx = Phaser.Math.Clamp(tx, v.x + w2 / 2 + 8 * px, v.right - w2 / 2 - 8 * px);
      let by = ty0 - lift;
      for (let k = 0; k < 6; k++) {
        const hit = placed.find((r) => bx - w2 / 2 < r.x1 + 4 * px && bx + w2 / 2 > r.x0 - 4 * px && by - h2 < r.y1 + 6 * px && by > r.y0 - 6 * px);
        if (!hit) break;
        by = hit.y0 - 8 * px;
      }
      by = Math.max(by, v.y + h2 + 60 * px);
      // Not under the radar: slide left of it.
      if (radarR) {
        const rx0 = v.x + (radarR.left * DPR) / zz, ry1 = v.y + (radarR.bottom * DPR) / zz, ry0 = v.y + (radarR.top * DPR) / zz;
        if (bx + w2 / 2 > rx0 - 4 * px && by - h2 < ry1 && by > ry0) bx = Math.max(v.x + w2 / 2 + 8 * px, rx0 - 6 * px - w2 / 2);
      }
      placed.push({ x0: bx - w2 / 2, y0: by - h2, x1: bx + w2 / 2, y1: by });
      bt.setPosition(bx, by);
      const sec = !!a.npc && a.npc.mode !== "routine" && a.npc.mode !== "escort";
      const x0 = bx - w2 / 2, y0 = by - h2, fill = a === pc ? 0xd8ecff : sec ? 0xffd166 : hintLine ? 0xfff0b8 : 0xf6f3ea;
      bg.fillStyle(0x000000, 1).fillRect(x0 - 2 * px, y0 - 2 * px, w2 + 4 * px, h2 + 4 * px).fillRect(x0, y0 - 4 * px, w2, h2 + 8 * px);
      bg.fillStyle(fill, 1).fillRect(x0, y0, w2, h2).fillRect(x0 + 2 * px, y0 - 2 * px, w2 - 4 * px, h2 + 4 * px);
      // The tail points at the speaker's head, wherever the bubble had to go; a long one if it was pushed up.
      const tailX = Phaser.Math.Clamp(tx, x0 + 8 * px, x0 + w2 - 8 * px), tipY = Math.min(ty0 - lift + 10 * px, by + 40 * px);
      bg.fillStyle(0x000000, 1).fillTriangle(tailX - 6 * px, by + 1 * px, tailX + 4 * px, by + 1 * px, tx - 2 * px, tipY);
      bg.fillStyle(fill, 1).fillTriangle(tailX - 4 * px, by, tailX + 2 * px, by, tx - 2 * px, tipY - 4 * px);
    });

    // Camera: follow the player; sitting down gives the TV view of the pitch.
    let tx: number, ty: number;
    if (pc?.seated) {
      const span = [34, 26, 60][Math.min(this.zoomLevel, 2)], edge = Math.max(0, HL + 4 - span / 2);
      tx = clamp(P.sx(b.x, b.y), P.sx(-edge, 0), P.sx(edge, 0)); ty = P.sy(0, clamp(b.y, -HW + 6, HW - 6) * (span > 50 ? 0.6 : 0.85));
    } else if (pc) {
      // Lead where you're going, and lean toward anyone chasing you, so they're on screen sooner.
      let lx = pc.vx * 0.55, ly = pc.vy * 0.55;
      const ch = this.pursuers.filter((a) => Math.hypot(a.x - pc.x, a.y - pc.y) < 28);
      if (ch.length) {
        const mx = ch.reduce((t, a) => t + a.x - pc.x, 0) / ch.length, my = ch.reduce((t, a) => t + a.y - pc.y, 0) / ch.length, ml = Math.hypot(mx, my) || 1;
        const k = Math.min(2.2, ml * 0.2);
        lx += (mx / ml) * k; ly += (my / ml) * k;
      }
      tx = P.sx(pc.x + lx, pc.y + ly); ty = P.sy(pc.x + lx, pc.y + ly) - P.S;
      if (this.cine?.focus) { tx = P.sx(this.cine.focus.x, this.cine.focus.y); ty = P.sy(this.cine.focus.x, this.cine.focus.y) - P.S; }
      else if (this.cine?.lead) { tx = P.sx(pc.x + this.cine.lead.x, pc.y + this.cine.lead.y); ty = P.sy(pc.x + this.cine.lead.x, pc.y + this.cine.lead.y) - P.S; }
    }
    else { tx = 0; ty = 0; }
    // On a phone held upright, frame him a little above centre, clear of the buttons at the bottom.
    if (pc && !pc.seated && !this.roomShown && cam.height > cam.width * 1.2) ty += (cam.height / cam.zoom) * 0.07;
    // Up high: frame both you and your shadow on the ground.
    if (pc) ty -= (this.liftOf(pc) * (pc.roof ? 1 : 0.75) + (pc.chute ? 3 * 0.75 : 0)) * P.S;
    // Indoors (Stardew's and Zelda's rooms): through the door is a fade, then the room on its own,
    // framed in the middle of the screen, with the street blacked out round it.
    const inNow = pc && !pc.roof && !pc.hiddenIn ? this.blds.find((b2) => pc.x > b2.rect.x0 - 0.3 && pc.x < b2.rect.x1 + 0.3 && pc.y > b2.rect.y0 - 0.3 && pc.y < b2.rect.y1 + 0.3) : undefined;
    if ((inNow?.id ?? null) !== this.roomId) this.enterRoom(inNow?.id ?? null);
    const room = this.blds.find((b2) => b2.id === this.roomShown);
    if (room && pc) {
      const r = room.rect, vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
      const rx0 = P.sx(r.x0, 0), rx1 = P.sx(r.x1, 0), ry0 = P.sy(0, r.y0) - 3 * P.S, ry1 = P.sy(0, r.y1);
      // The whole room in view if it fits; if not, follow him but keep the walls at the edges.
      tx = rx1 - rx0 <= vw * 0.92 ? (rx0 + rx1) / 2 : clamp(tx, rx0 + vw * 0.46, rx1 - vw * 0.46);
      ty = ry1 - ry0 <= vh * 0.8 ? (ry0 + ry1) / 2 : clamp(ty, ry0 + vh * 0.4, ry1 - vh * 0.4);
    }
    const k = 1 - Math.pow(0.004, Math.min(dms, 100) / 1000);
    if (this.roomSnap) { this.roomSnap = false; this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    const zt = this.targetZoom();
    if (Math.abs(cam.zoom - zt) > 0.001) cam.setZoom(cam.zoom + (zt - cam.zoom) * Math.min(1, k * 1.5));
    cam.centerOn(this.camX, this.camY);
    this.drawRoomMask(room);
    if (this.trauma > 0 || this.kick.x || this.kick.y) {
      // Shake: trauma squared through smooth noise (Eiserloh), plus a kick along the blow that springs back.
      const sh = this.trauma * this.trauma * 7 * (P.S / 16), t = performance.now() / 1000;
      const nx = Math.sin(t * 47.3) * 0.6 + Math.sin(t * 91.7 + 1.3) * 0.4, ny = Math.sin(t * 53.1 + 2.1) * 0.6 + Math.sin(t * 83.9 + 0.7) * 0.4;
      cam.scrollX += nx * sh + this.kick.x; cam.scrollY += ny * sh + this.kick.y;
      this.kick.x *= 0.8; this.kick.y *= 0.8;
      if (Math.abs(this.kick.x) + Math.abs(this.kick.y) < 0.3) this.kick = { x: 0, y: 0 };
      cam.scrollX = Math.round(cam.scrollX); cam.scrollY = Math.round(cam.scrollY);
    }
  }

  // ---------- The world ----------
  worldSeen = new Set<string>();
  wallSeen = new Set<string>();
  wallSprites = new Map<string, Phaser.GameObjects.TileSprite>();
  shellSprites = new Map<string, Phaser.GameObjects.TileSprite>();

  /** Queue the world's pictures for this frame; says which layout walls they stand in for. */
  worldThings(things: { d: number; draw: () => void; spr?: (depth: number) => void }[], onScreen: (x: number, y: number, pad?: number) => boolean) {
    const P = this.P, pc = this.pc, S = P.S;
    this.worldSeen = new Set();
    this.shellSeen = new Set();
    if (this.placed.venue !== VENUE.id) {
      this.placed = { venue: VENUE.id, list: placements(VENUE) };
      this.blds = buildings(VENUE);
      for (const b of this.blds) {
        // A painted building, if there is one: scaled to the footprint (and mirrored for the semi-final), its name on the board.
        const art = BLD_ART[b.id], bk = `bldc-${VENUE.id}-${b.id}`;
        if (art && this.textures.exists(`w-bld-${b.id}`) && !this.textures.exists(bk)) {
          const src = this.textures.get(`w-bld-${b.id}`).getSourceImage() as HTMLImageElement;
          const cw = Math.round((b.rect.x1 - b.rect.x0) * PPM), ch = Math.round((b.rect.y1 - b.rect.y0 + b.height) * PPM);
          const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
          const cx = cv.getContext("2d")!; cx.imageSmoothingEnabled = false;
          const mirror = VENUE.id === "sf";
          // Trimmed to what's painted (no see-through margins), stretched to the footprint's width,
          // bottom-aligned: the front wall sits on the footprint's front edge.
          const probe = document.createElement("canvas"); probe.width = src.width; probe.height = src.height;
          const pc2 = probe.getContext("2d", { willReadFrequently: true })!; pc2.drawImage(src, 0, 0);
          const px = pc2.getImageData(0, 0, src.width, src.height).data;
          let l = src.width, r = 0, t = src.height, bt = 0;
          for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (px[(y * src.width + x) * 4 + 3] > 40) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y); }
          probe.width = probe.height = 0;
          const bw = r - l + 1, bh = bt - t + 1, kx = cw / bw, dh = bh * kx;
          cx.save();
          if (mirror) { cx.translate(cw, 0); cx.scale(-1, 1); }
          cx.drawImage(src, l, t, bw, bh, 0, ch - dh, cw, dh);
          cx.restore();
          const sg = art.sign, name = b.sign?.text;
          if (sg && name) {
            const sx = (sg.x - l) * kx, sw = sg.w * kx, sy = ch - dh + (sg.y - t) * kx, sh = sg.h * kx;
            pixelTextOn(cx, name, mirror ? cw - sx - sw : sx, sy, sw, sh, sg.fg, 3, sg.shadow);
          }
          this.textures.addCanvas(bk, cv);
        }
        const fk = `fac-${VENUE.id}-${b.id}`, rk = `roof-${VENUE.id}-${b.id}`;
        if (this.textures.exists(bk)) continue; // painted: the boxy front and roof aren't needed
        if (!this.textures.exists(fk)) this.textures.addCanvas(fk, facade(b, (k) => this.world.img(k)));
        if (!this.textures.exists(rk)) this.textures.addCanvas(rk, roof(b));
      }
    }
    const inRect = (x: number, y: number, rc: { x0: number; y0: number; x1: number; y1: number }, pad = 0) => x > rc.x0 - pad && x < rc.x1 + pad && y > rc.y0 - pad && y < rc.y1 + pad;
    const free = !!pc && !pc.hiddenIn;
    const image = (id: string, key: string) => {
      let im = this.worldSprites.get(id);
      if (!im) { im = this.add.image(0, 0, key); this.worldSprites.set(id, im); }
      if (im.texture.key !== key) im.setTexture(key);
      this.worldSeen.add(id);
      return im.setVisible(true).setAlpha(1).setFlipX(false).setCrop();
    };

    // The rooms under the stands: a painted back wall along the north side (CCTV in the security
    // office, pans in the kitchen, shirts in the kit room), standing in front of the plain wall.
    for (const id of ROOM_WALLS) {
      const ar = AREAS.find((x) => x.id === id), wk = `w-wall-${id}`;
      if (!ar || !this.textures.exists(wk) || !onScreen(ar.x + ar.w / 2, ar.y, 400 + ar.w * 16)) continue;
      const wy = ar.y + 0.5;
      things.push({ d: wy + 1e-3, draw: () => {}, spr: (dep) => {
        let ts = this.shellSprites.get(`awall-${id}`);
        const wpx = Math.round(ar.w * S), hpx = 3 * S;
        if (!ts) { ts = this.add.tileSprite(0, 0, wpx, hpx, wk).setOrigin(0, 1); this.shellSprites.set(`awall-${id}`, ts); }
        this.shellSeen.add(`awall-${id}`);
        const src = this.textures.get(wk).getSourceImage() as HTMLImageElement;
        ts.setTileScale(wpx / src.width, hpx / src.height);
        ts.setPosition(Math.round(P.sx(ar.x, 0)), Math.round(P.sy(0, wy))).setDepth(dep).setVisible(true).setAlpha(1).setFlipX(VENUE.id === "sf");
      } });
    }

    // Buildings: a front and a roof from outside; just low walls once you're in.
    const cut = new Set<string>();
    for (const b of this.blds) {
      if (free && !pc.roof && this.roomShown === b.id) {
        cut.add(b.id);
        // Inside: the back wall, painted, standing along the north side of the room.
        const wk = `w-wall-${b.id}`;
        if (this.textures.exists(wk)) {
          const { x0, x1, y0 } = b.rect, wy = y0 + 0.5;
          things.push({ d: wy + 1e-3, draw: () => {}, spr: (dep) => {
            let ts = this.shellSprites.get(`bwall-${b.id}`);
            const wpx = Math.round((x1 - x0) * S), hpx = 3 * S;
            if (!ts) { ts = this.add.tileSprite(0, 0, wpx, hpx, wk).setOrigin(0, 1); this.shellSprites.set(`bwall-${b.id}`, ts); }
            this.shellSeen.add(`bwall-${b.id}`);
            ts.setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, wy))).setDepth(dep).setVisible(true).setAlpha(1).setFlipX(VENUE.id === "sf");
          } });
        }
        continue;
      }
      const { x0, y0, x1, y1 } = b.rect, H = b.height;
      if (!onScreen((x0 + x1) / 2, (y0 + y1) / 2, 500 + (x1 - x0) * 8)) continue;
      // See-through while you're round the back of it.
      const hid = free && !pc.roof && !this.roomShown && pc.x > x0 - 0.5 && pc.x < x1 + 0.5 && pc.y < y1 && pc.y > y0 - H - 1;
      const a = hid ? 0.4 : 1;
      if (hid) this.pcHidden = true;
      // Its shadow falls to the bottom right: light from the top left, like every other thing here.
      this.shadowG.fillStyle(0x000000, 0.26).fillRect(Math.round(P.sx(x1, 0)), Math.round(P.sy(0, y0 + 1)), Math.round(Math.min(2.2, H * 0.4) * S), Math.round((y1 - y0 - 0.5) * S));
      this.shadowG.fillStyle(0x000000, 0.2).fillRect(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1)), Math.round((x1 - x0) * S), 4);
      const painted = `bldc-${VENUE.id}-${b.id}`;
      if (this.textures.exists(painted)) {
        things.push({ d: y1, draw: () => {}, spr: (dep) => image(`bld-${b.id}`, painted).setOrigin(0, 1).setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1))).setDepth(dep).setAlpha(a) });
        continue;
      }
      things.push({ d: y1 - 1e-3, draw: () => {}, spr: (dep) => image(`roof-${b.id}`, `roof-${VENUE.id}-${b.id}`).setOrigin(0).setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y0) - H * S)).setDepth(dep).setAlpha(a) });
      things.push({ d: y1, draw: () => {}, spr: (dep) => image(`fac-${b.id}`, `fac-${VENUE.id}-${b.id}`).setOrigin(0, 1).setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1))).setDepth(dep).setAlpha(a) });
    }

    // Props and clutter, at 1:1.
    const roomR = this.roomShown ? this.blds.find((b) => b.id === this.roomShown)?.rect : undefined;
    for (const p of this.placed.list) {
      if (!onScreen(p.x, p.y, 300)) continue;
      if (p.key === "floodlight") continue;
      // In a room, the street's props aren't drawn (the tall ones would poke into the room's picture).
      if (roomR && !(p.x > roomR.x0 - 0.2 && p.x < roomR.x1 + 0.2 && p.y > roomR.y0 - 0.2 && p.y < roomR.y1 + 0.2)) continue;
      const meta = this.world.base[p.key];
      if (!meta) continue;
      const key = `k-${p.key}`, tex = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const wM = (meta.right - meta.left + 1) / S, hM = meta.foot / S;
      let ox = (meta.left + meta.right + 1) / 2 / tex.width;
      if (p.flip) ox = 1 - ox;
      const place = (im: Phaser.GameObjects.Image) => im.setOrigin(ox, meta.foot / tex.height).setFlipX(!!p.flip).setPosition(Math.round(P.sx(p.x, p.y)), Math.round(P.sy(p.x, p.y)));
      if (p.flat) { place(image(p.id, key)).setDepth(0.35); continue; }
      const sh = this.shadowG;
      if (wM > 3) sh.fillStyle(0x000000, 0.24).fillRect(Math.round(P.sx(p.x - wM / 2 + 0.3, 0)), Math.round(P.sy(0, p.y - 0.5)), Math.round(wM * S), Math.round(0.7 * S));
      else sh.fillStyle(0x000000, 0.28).fillEllipse(Math.round(P.sx(p.x + 0.15, 0)), Math.round(P.sy(0, p.y)) - 2, Math.round(wM * S * 1.1), Math.max(6, Math.round(wM * S * 0.35)));
      const fade = free && hM > 1.4 && pc.y < p.y && pc.y > p.y - hM * 1.1 && Math.abs(pc.x - p.x) < wM / 2 + 0.4;
      if (fade) this.pcHidden = true;
      things.push({ d: p.y, draw: () => {}, spr: (dep) => place(image(p.id, key)).setDepth(dep).setAlpha(fade ? 0.4 : 1) });
    }

    // The ground from outside: a roofed ring of stands behind a clad facade, the turnstiles let into it.
    const ins = !!pc && !pc.roof && (VENUE.inside(pc.x, pc.y) || !!pc.seated) && !pc.hiddenIn;
    const H = 9;
    const gx0 = VENUE.id !== "sf" ? -57 : -56.5, gx1 = VENUE.id !== "sf" ? 56.5 : 57;
    const blocks = [
      { x0: gx0, y0: 28, x1: gx1, y1: 45, front: true },
      { x0: gx0, y0: -61, x1: gx1, y1: -28, front: false },
      { x0: gx0, y0: -28, x1: -41, y1: 28, front: false },
      { x0: 41, y0: -28, x1: gx1, y1: 28, front: false },
    ];
    this.shellBlocks = ins ? [] : blocks;
    if (!ins) {
      const tile = (id: string, key: string, x: number, y: number, w: number, h: number, dep: number, a = 1) => {
        let ts = this.shellSprites.get(id);
        if (!ts) { ts = this.add.tileSprite(x, y, w, h, key).setOrigin(0); ts.setTilePosition(x, (64 - (h % 64)) % 64); this.shellSprites.set(id, ts); }
        this.shellSeen.add(id);
        return ts.setVisible(true).setDepth(dep).setAlpha(a);
      };
      for (const [i, b] of blocks.entries()) {
        if (!onScreen((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 1400)) continue;
        const x = Math.round(P.sx(b.x0, 0)), w = Math.round((b.x1 - b.x0) * S), lift = H * S;
        const top = Math.round(P.sy(0, b.y0)) - lift, bot = Math.round(P.sy(0, b.y1)) - lift;
        const near = free && pc.x > b.x0 && pc.x < b.x1 && pc.y < b.y1 + 0.3 && pc.y > b.y1 - H - 1 && b.front;
        if (near) this.pcHidden = true;
        things.push({ d: b.y1 - 0.06, draw: () => {}, spr: (dep) => {
          tile(`roof${i}`, "mat-roofsteel", x, top, w, bot - top, dep);
          const front = b.front ? this.stadiumFront(b.x0, b.x1) : null;
          if (front) {
            let im = this.shellSprites.get(`facepic${i}`) as unknown as Phaser.GameObjects.Image | undefined;
            if (!im) { im = this.add.image(0, 0, front).setOrigin(0, 0); this.shellSprites.set(`facepic${i}`, im as unknown as Phaser.GameObjects.TileSprite); }
            this.shellSeen.add(`facepic${i}`);
            im.setPosition(x, bot).setDisplaySize(w, lift).setDepth(dep + 0.1).setVisible(true).setAlpha(near ? 0.45 : 1);
          } else tile(`face${i}`, b.front ? "mat-clad" : "mat-seats_h", x, bot, w, lift, dep + 0.1, near ? 0.45 : 1).setTint(b.front ? 0xffffff : 0x8a8f99);
          // On the roof: skylights down the middle, air-con units, and the TV gantry on the main stand.
          const deco = (id: string, key: string, wx: number, wy: number) => {
            if (!this.textures.exists(`k-${key}-src`)) return;
            let im = this.shellSprites.get(id) as unknown as Phaser.GameObjects.Image | undefined;
            if (!im) { im = this.add.image(0, 0, `k-${key}-src`).setOrigin(0.5, 0.5); this.shellSprites.set(id, im as unknown as Phaser.GameObjects.TileSprite); }
            this.shellSeen.add(id);
            im.setPosition(Math.round(P.sx(wx, 0)), Math.round(P.sy(0, wy)) - lift).setDepth(dep + 0.05).setVisible(true).setAlpha(near ? 0.45 : 1);
          };
          const wide = b.x1 - b.x0 > b.y1 - b.y0;
          if (wide) {
            const my = (b.y0 + b.y1) / 2;
            for (let k = 0, wx = b.x0 + 8; wx < b.x1 - 4; wx += 15, k++) deco(`sky${i}-${k}`, "skylight", wx, my + (k % 2 ? 1.5 : -1.5));
            for (let k = 0, wx = b.x0 + 15; wx < b.x1 - 6; wx += 26, k++) deco(`vent${i}-${k}`, "roofvent", wx, b.y0 + (b.y1 - b.y0) * 0.25);
            if (!b.front) for (let k = 0, wx = -18; wx <= 18; wx += 6, k++) deco(`gantry${i}-${k}`, "gantry", wx, b.y1 - 1.6);
          } else {
            for (let k = 0, wy = b.y0 + 6; wy < b.y1 - 4; wy += 13, k++) deco(`vent${i}-${k}`, "roofvent", (b.x0 + b.x1) / 2 + (k % 2 ? 2.5 : -2.5), wy);
          }
        } });
        things.push({ d: b.y1 - 0.05, draw: () => {
          const gr = this.lastLayer!;
          // A club-blue fascia with a white stripe along the roof's front edge; a gutter shadow behind.
          gr.fillStyle(0x1b2a6b, near ? 0.45 : 1).fillRect(x, bot, w, 40).fillStyle(0xf4f4f4, near ? 0.45 : 1).fillRect(x, bot + 34, w, 3);
          gr.fillStyle(0x000000, 0.3).fillRect(x, top, w, 12).fillStyle(0x000000, 0.45).fillRect(x, bot + 40, w, 3);
          gr.lineStyle(2, 0x2e343b, 1).strokeRect(x, top, w, bot - top);
        } });
      }
      // The ground's name across the fascia, turnstiles in the facade.
      const nameKey = `gname-${VENUE.id}`;
      if (!this.textures.exists(nameKey)) {
        const cv = document.createElement("canvas"); cv.width = 520; cv.height = 34;
        const cx = cv.getContext("2d")!;
        pixelTextOn(cx, VENUE.ground, 0, 0, 520, 30, "#f4f4f4", 3, "rgba(0,0,0,0.55)");
        this.textures.addCanvas(nameKey, cv);
      }
      const faceTop = Math.round(P.sy(0, 45)) - H * S;
      const nearF = free && Math.abs(pc.x) < 30 && pc.y < 45.3;
      things.push({ d: 45.01, draw: () => {}, spr: (dep) => {
        image("gname", nameKey).setOrigin(0.5, 0).setPosition(Math.round(P.sx(0, 0)), faceTop + 3).setDepth(dep).setAlpha(nearF ? 0.45 : 1);
        const tx = this.world.base.turnstile;
        if (!tx) return;
        const xs = [-6, -1.45, 1.45, 6].map((x) => (VENUE.id === "sf" ? -x : x));
        // Banners hung down the cladding: the fixture, and a St George cross either side.
        const opp = this.s.match!.teams[1];
        const bk = `banner-${VENUE.id}`;
        if (!this.textures.exists(bk)) this.textures.addCanvas(bk, banner(`ENGLAND\nV\n${opp.name.toUpperCase()}`, 0xf4f4f4, 0x1b2a6b, opp.colour));
        if (!this.textures.exists("banner-eng")) this.textures.addCanvas("banner-eng", banner("", 0xf4f4f4, 0xc8102e, 0xc8102e, true));
        for (const [i, x] of [-30, -20, 20, 30].entries()) image(`ban${i}`, i === 1 || i === 2 ? bk : "banner-eng").setOrigin(0.5, 0).setPosition(Math.round(P.sx(x, 0)), faceTop + 48).setDepth(dep).setAlpha(nearF ? 0.45 : 1);
        // Booths with flaps: shut, or folded back while the gate's open for someone (or just after
        // someone's gone through, so you see it move).
        const gateOf = ["turnstile1", "turnstile2", "turnstile3"], tick2 = this.s.tick;
        const newArt = this.textures.exists("k-turnstile_shut");
        if (newArt) for (const i of [3]) this.worldSprites.get(`tst${i}`)?.setVisible(false);
        (newArt ? [-6, 0, 6].map((x) => (VENUE.id === "sf" ? -x : x)) : xs).forEach((x, i) => {
          const gt = newArt ? (VENUE.id === "sf" ? gateOf[2 - i] : gateOf[i]) : ["turnstile1", "turnstile2", "turnstile2", "turnstile3"][i], g = this.s.stadium!.gates[gt];
          const open = (!!g && g.until > tick2) || (this.gateFlash[gt] ?? 0) > performance.now();
          const k = this.textures.exists("k-turnstile_shut") ? (open ? "k-turnstile_open" : "k-turnstile_shut") : "k-turnstile";
          const ft = this.world.base[k.slice(2)] ?? tx;
          image(`tst${i}`, k).setOrigin(0.5, ft.foot / 160).setPosition(Math.round(P.sx(x, 0)), Math.round(P.sy(0, 45))).setDepth(dep + 0.01).setAlpha(nearF ? 0.45 : 1);
        });
      } });
    }
    // Advertising boards round the pitch: made-up sponsors facing the cameras on the far side
    // and the ends; on the near side you see their backs.
    {
      const ADS: [string, number, number][] = [["STELLAR LAGER", 0xc8102e, 0xf4f1ea], ["GREGGORS PIES", 0x1b3a8a, 0xf2c94c], ["KWIKLOAN 1999%", 0x2f9e5a, 0xffffff],
        ["CASH KINGS", 0x141416, 0xf2c94c], ["VAPE CITY", 0x111111, 0x6cf0ff], ["NO WIN NO FEE", 0xf2c94c, 0x111111], ["PIE & MASH", 0xf4f1ea, 0x1b2a6b], ["BET RESPONSIBLY", 0x222222, 0xd7263d]];
      ADS.forEach(([t, bg, fg], i) => { if (!this.textures.exists(`ad${i}`)) this.textures.addCanvas(`ad${i}`, adBoard(t, bg, fg)); });
      if (!this.textures.exists("adback")) this.textures.addCanvas("adback", adBoard("", 0, 0, true));
      let i = 0;
      for (let x = -36; x < 36; x += 6) {
        if (x > -6 && x < 3) continue; // the tunnel mouth
        const yN = -24.5, yS = 24.9, k = i++;
        if (onScreen(x + 3, yN, 300)) things.push({ d: yN, draw: () => {}, spr: (dep) => image(`adN${x}`, `ad${(k + Math.floor(this.s.tick / 900)) % ADS.length}`).setOrigin(0, 1).setPosition(Math.round(P.sx(x, 0)), Math.round(P.sy(0, yN))).setDepth(dep) });
        if (onScreen(x + 3, yS, 300)) things.push({ d: yS, draw: () => {}, spr: (dep) => image(`adS${x}`, "adback").setOrigin(0, 1).setPosition(Math.round(P.sx(x, 0)), Math.round(P.sy(0, yS))).setDepth(dep).setAlpha(free && pc.y < yS && pc.y > yS - 1.6 && pc.x > x && pc.x < x + 6 ? 0.4 : 1) });
      }
    }
    // Floodlights: on the corners of the roof from outside, on their masts from in the ground.
    for (const p of this.placed.list) {
      if (p.key !== "floodlight" || !onScreen(p.x, p.y, 900)) continue;
      const roofY = ins ? 0 : H * S;
      things.push({ d: ins ? p.y : 45.02, draw: () => {}, spr: (dep) => image(p.id, "floodlight").setOrigin(0.5, 1).setPosition(Math.round(P.sx(p.x, 0)), Math.round(P.sy(0, p.y)) - roofY).setDepth(dep) });
    }
    return {
      hides: (wl: { x: number; y: number; w: number; h: number }) => {
        for (const b of this.blds) if (!cut.has(b.id) && inRect(wl.x, wl.y, b.rect, 0.7) && inRect(wl.x + wl.w, wl.y + wl.h, b.rect, 0.7)) return true;
        if (!ins) for (const b of blocks) if (inRect(wl.x, wl.y, b, 0.6) && inRect(wl.x + wl.w, wl.y + wl.h, b, 0.6)) return true;
        // The booths' pictures are their walls.
        for (const p of this.placed.list) if ((p.key === "ticketbooth" || p.key === "merchstall") && inRect(wl.x, wl.y, { x0: p.x - 5.3, x1: p.x + 5.3, y0: p.y - 1.8, y1: p.y + 0.2 }) && inRect(wl.x + wl.w, wl.y + wl.h, { x0: p.x - 5.3, x1: p.x + 5.3, y0: p.y - 1.8, y1: p.y + 0.2 })) return true;
        return false;
      },
      low: (wl: { x: number; y: number; w: number; h: number }) => {
        for (const b of this.blds) if (cut.has(b.id) && inRect(wl.x, wl.y, b.rect, 0.7) && inRect(wl.x + wl.w, wl.y + wl.h, b.rect, 0.7)) return b;
        return null;
      },
    };
  }
  blds: BuildingSpec[] = [];
  shellSeen = new Set<string>();
  shellBlocks: { x0: number; y0: number; x1: number; y1: number }[] = [];
  lastLayer: Phaser.GameObjects.Graphics | null = null;

  // ---------- Sprites ----------
  /** Which base sheet, recoloured how, for this person as they look right now. */
  spriteFor(a: Actor): { base: Base; rc: Recolour; h: number } {
    const out = this.spriteFor0(a);
    if (!this.bank.has(out.base)) out.base = out.base === "police" ? "steward" : "fan";
    if (out.base === "steward" && a.npc?.job === "police" && !out.rc.vest) out.rc = { vest: 0x1c2a4a };
    // A stick-on moustache and a wig are painted into the frames themselves, so they sit on the head
    // whichever way he turns and however he moves.
    // Grozz himself is bald, whatever he's wearing.
    if (a.id === this.s.stadium!.pc && ["fan", "fanbare", "fandress", "fannaked", "england", "steward", "referee", "police"].includes(out.base)) out.rc = { ...out.rc, bald: 1 };
    if (!out.base.startsWith("horse") && out.base !== "mascot") {
      const head = a.worn.head ? this.s.items[a.worn.head]?.def : undefined, face = a.worn.face ? this.s.items[a.worn.face]?.def : undefined;
      if (face === "moustache") out.rc = { ...out.rc, tache: ITEM_DEFS.moustache.colour ?? 0x3a2a1a };
      if (head === "wig" || head === "long_wig") out.rc = { ...out.rc, wig: ITEM_DEFS[head].colour ?? 0x5a3a22, wigLong: head === "long_wig" ? 1 : undefined };
    }
    return out;
  }
  /** A censor mosaic: cols x rows blocks of skin tones, centred on (cx, cy), reshuffled each `seed`. */
  mosaic(g: { fillStyle: (c: number, a?: number) => any; fillRect: (x: number, y: number, w: number, h: number) => any }, cx: number, cy: number, q: number, cols: number, rows: number, seed: number) {
    const tones = [0xd99a7e, 0xc4876a, 0xe8b49a, 0xb07258, 0xf0c4aa, 0x9a5e48];
    const x0 = Math.round(cx - (cols * q) / 2), y0 = Math.round(cy - (rows * q) / 2);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) g.fillStyle(tones[Math.abs(hash(`${i}${j}${seed}`)) % tones.length], 1).fillRect(x0 + i * q, y0 + j * q, q, q);
  }
  /** Is this bit of headgear painted into his sprite (so the drawn-on version is skipped)? */
  baked(a: Actor, what: "tache" | "wig"): boolean {
    const b = this.spriteFor0(a).base;
    return this.bank.has(b) && !b.startsWith("horse") && b !== "mascot" && (what === "tache" ? a.worn.face && this.s.items[a.worn.face]?.def === "moustache" : a.worn.head && ["wig", "long_wig"].includes(this.s.items[a.worn.head]?.def)) === true;
  }
  spriteFor0(a: Actor): { base: Base; rc: Recolour; h: number } {
    const s = this.s, m = s.match!, isPc = a.id === s.stadium!.pc;
    const skin = SKIN[Math.abs(hash(a.id)) % SKIN.length];
    if (a.fb && !a.fb.controlled) {
      const team = m.teams[a.fb.team], gk = a.fb.role === "GK";
      if (a.fb.team === 0) return { base: "england", rc: gk ? { shirt: 0x2fbf71, trim: 0x10202a } : {}, h: 1.8 };
      if (team.short === "POR") return { base: "portugal", rc: gk ? { shirt: 0xf08a24 } : {}, h: 1.8 };
      if (team.short === "BRA") return { base: "portugal", rc: gk ? { shirt: 0x2a2a2a, legs: 0x2a2a2a } : { shirt: 0xf7d417, legs: 0x1a4fa0 }, h: 1.8 };
      return { base: "england", rc: { shirt: gk ? 0xf08a24 : team.colour, trim: team.colour2, legs: team.colour2 }, h: 1.8 };
    }
    if (a.off) return { base: "referee", rc: a.off.job === "referee" ? {} : { shirt: 0xd9e021 }, h: 1.8 };
    const job = a.npc?.job;
    if (job && ["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief", "cleanup"].includes(job)) return { base: "steward", rc: {}, h: 1.8 };
    if (job === "police" && a.npc?.mounted && this.bank.has("horse")) return { base: "horse", rc: {}, h: 2.6 };
    if (job === "police") return { base: "police", rc: {}, h: 1.85 };
    if (job === "armed") return { base: "steward", rc: { vest: 0x2a2d33, legs: 0x1a1a1a }, h: 1.85 };
    // Lenny the Lion, or whoever's in his costume now.
    if ((job === "mascot" || (a.worn.outer && s.items[a.worn.outer]?.def === "mascot_suit")) && this.bank.has("mascot")) return { base: "mascot", rc: {}, h: 1.95 };
    // Everyone else is built on the fat fan, in their own colours.
    const outer = a.worn.outer ? defOf(s.items[a.worn.outer]) : undefined;
    const inner = a.worn.inner ? defOf(s.items[a.worn.inner]) : undefined;
    const rc: Recolour = {};
    if (a.fb?.controlled) {
      const team = m.teams[a.fb.team];
      rc.shirt = team.colour; rc.trim = team.colour2; rc.legs = a.fb.team === 0 ? 0x1b2a6b : team.colour2;
    } else if (outer) {
      rc.shirt = outer.id === "hivis" ? 0xd9e021 : outer.colour; rc.trim = outer.colour2;
      if (outer.role === "police" || outer.role === "referee" || outer.role === "footballer") rc.legs = outer.role === "footballer" ? (outer.colour2 ?? 0x1b2a6b) : 0x15171a;
      if (outer.id === "chef_whites") rc.legs = 0x3a3a3a;
      if (outer.id === "dress") rc.legs = outer.colour;
    } else if (inner && inner.id !== "shirt_eng") { rc.shirt = inner.colour; rc.trim = inner.colour2; }
    // Starkers: the belly, and pink all the way down.
    // Starkers: his own naked sprite (a smooth doll's crotch, the telly's mosaic over it); the old
    // pink-trousered fallback only if that hasn't loaded.
    if (isPc && isNaked(a)) return this.bank.has("fannaked") ? { base: "fannaked", rc: {}, h: 1.75 } : { base: "fanbare", rc: { naked: 0xd99a7e }, h: 1.75 };
    // In the frock: a proper dress, hairy calves and trainers, not a pink tracksuit.
    if (isPc && outer?.id === "dress" && this.bank.has("fandress")) return { base: "fandress", rc: {}, h: 1.75 };
    // The hired help.
    if (a.name === "Bare-Knuckle Brendan" && this.bank.has("bigman")) return { base: "bigman", rc: { skin: SKIN[2] }, h: 1.95 };
    if (a.name === "Spliff Ricky" && this.bank.has("lad")) return { base: "lad", rc: { shirt: 0x2a2a2a, trim: 0xf4f4f4, legs: 0x2a2a2a, skin: SKIN[1] }, h: 1.75 };
    // Shopkeepers who look the part.
    const shop = a.npc?.shop;
    if (shop === "charity" && this.bank.has("woman")) return { base: "woman", rc: { shirt: 0xb07ab0, trim: 0x5a3a5a, skin: rc.skin }, h: 1.6 };
    if (shop === "surplus" && this.bank.has("bigman")) return { base: "bigman", rc: { skin: rc.skin }, h: 1.85 };
    if ((shop === "bookies" || shop === "pawn") && this.bank.has("suit")) return { base: "suit", rc: { skin: rc.skin }, h: 1.75 };
    if ((a.name === "Barmaid" || a.female) && a.npc?.job === "barman" && this.bank.has("woman")) return { base: "woman", rc: { shirt: 0x222222, trim: 0x222222, skin: rc.skin }, h: 1.6 };
    if (job === "barman" || job === "seller" || job === "cook") { rc.shirt = 0xf0ece2; rc.trim = 0x333333; rc.legs = 0x2a2a2a; }
    if (job === "driver" || job === "worker") { rc.shirt = 0x2d5a8a; rc.trim = 0x1a3050; rc.legs = 0x2a3340; }
    if (job === "cleaner") { rc.shirt = 0x6a7a8a; rc.trim = 0x445566; rc.legs = 0x445566; }
    if (job === "fan") {
      const n = Math.abs(hash(a.id + "s"));
      if (a.npc!.team === 1) { const opp = m.teams[1]; rc.shirt = n % 3 ? opp.colour : opp.colour2; rc.trim = n % 3 ? opp.colour2 : opp.colour; }
      else if (n % 5 === 1) { rc.shirt = 0xc8102e; rc.trim = 0xf4f4f4; }
      else if (n % 5 === 2) { rc.shirt = 0x1b2a6b; rc.trim = 0xf4f4f4; }
    }
    if (job === "local") { const n = Math.abs(hash(a.id + "l")) % 4; rc.shirt = [0x3d4a5c, 0x7a2a2a, 0x2a5a3a, 0xf4f4f4][n]; }
    if (!isPc) rc.skin = skin;
    // A borrowed face is somebody else's skin.
    const borrowed = a.worn.face && s.items[a.worn.face].def === "face" ? s.items[a.worn.face].of : undefined;
    if (borrowed) rc.skin = SKIN[Math.abs(hash(borrowed)) % SKIN.length];
    if ((a.effects.bloody ?? 0) > s.tick) rc.trim = 0x9a0a0a;
    const big = isPc ? 1.75 : job === "fan" || job === "local" ? 1.62 + (Math.abs(hash(a.id)) % 4) * 0.05 : 1.7;
    // Women: the woman's body, in their own colours.
    if (a.female && !isPc && this.bank.has("woman")) return { base: "woman", rc: { shirt: rc.shirt, trim: rc.trim, skin: rc.skin }, h: 1.6 };
    // Shirt off: the belly.
    if (!outer && !a.worn.inner && !a.fb && (isPc || job === "fan")) { delete rc.shirt; delete rc.trim; return { base: "fanbare", rc, h: big }; }
    // Not everyone is the same fat bloke: lads, old boys and big lads too.
    if (!isPc && (job === "fan" || job === "local") && !outer) {
      const n = Math.abs(hash(a.id + "b")) % 17;
      const body: Base = n < 8 ? "fan" : n < 12 ? "lad" : n < 14 ? "oldboy" : n < 16 ? "bigman" : "suit";
      if (body !== "fan" && this.bank.has(body)) return { base: body, rc: body === "lad" ? rc : { skin: rc.skin }, h: big };
    }
    return { base: "fan", rc, h: big };
  }

  placeSprite(a: Actor, st2: FigureStyle, shiver: number, moving: boolean, depth: number): void {
    const P = this.P, tick = this.s.tick;
    const { base, rc, h } = this.spriteFor(a);
    const key = this.bank.variant(base, rc);
    let sp = this.spritePool.get(a.id);
    if (!sp) { sp = this.add.sprite(0, 0, `${key}-rot`, 0); this.spritePool.set(a.id, sp); }
    const di = dirIndex(a.facing);
    // 1:1 in the standing view (the figures are drawn at about 32 px to the metre already).
    const scale = P.standing && P.S === PPM ? 1 : (h * P.KZ * P.S) / (FEET - HEAD) * (P.standing ? 1 : 0.7);
    const lift = this.liftOf(a);
    const x = Math.round(P.sx(a.x + shiver, a.y)), y = Math.round(P.sy(a.x, a.y, lift));
    // On a bike: the bike under him, pointing his way.
    if (a.bike && this.textures.exists("w-bike8")) {
      let bk = this.worldSprites.get(`bike-${a.id}`) as Phaser.GameObjects.Image | undefined;
      if (!bk) { bk = this.add.image(0, 0, "w-bike8", 0).setOrigin(0.5, 0.72); this.worldSprites.set(`bike-${a.id}`, bk); }
      this.worldSeen.add(`bike-${a.id}`);
      bk.setFrame(dirIndex(a.facing)).setPosition(Math.round(P.sx(a.x, a.y)), Math.round(P.sy(a.x, a.y))).setDepth(depth - 0.001).setVisible(true).setAlpha(1).setAngle(0).setScale(P.standing && P.S === PPM ? 1 : (P.S / PPM) * (P.standing ? 1 : 0.85));
    }
    // In the air, nothing in the world is in front of you (the crowd included).
    if (lift > 0) depth = 1e6;
    sp.setVisible(true).setDepth(depth).setScale(scale).setAlpha(st2.alpha ?? 1).setFlipX(false);
    // Head stamped flat: the headless body, in a pool of it.
    if (a.splat) {
      const hk = `k-headless_${base === "woman" ? "woman" : base === "steward" || base === "police" ? "steward" : "fan"}-src`;
      if (this.textures.exists(hk)) {
        sp.setTexture(hk).setOrigin(0.5, 0.6).setPosition(Math.round(P.sx(a.x, a.y)), Math.round(P.sy(a.x, a.y))).setAngle(0).setCrop().clearTint().setScale(P.standing && P.S === PPM ? 1 : P.S / PPM).setFlipX(Math.cos(a.facing) < 0).setDepth(depth);
        return;
      }
    }
    if (a.chute) {
      // The canopy above, swaying.
      if (!this.canopy && this.textures.exists("k-canopy-src")) this.canopy = this.add.image(0, 0, "k-canopy-src").setOrigin(0.5, 1);
      this.canopy?.setVisible(true).setDepth(depth + 1).setPosition(x, Math.round(y - 2.1 * P.S)).setAngle(Math.sin(this.s.tick * 0.05) * 6);
    }
    const now = performance.now(), has = (sheet: string) => this.bank.sheetReady(key, sheet, a.id === this.s.stadium!.pc);
    if (a.chute || a.roof) {
      // Hanging in the harness (or standing on the roof edge): upright, facing where he's headed.
      sp.setTexture(`${key}-rot`, a.chute ? 0 : 4).setAngle(a.chute ? Math.sin(tick * 0.05) * 6 : 0).setOrigin(0.5, feetOf(base) / cellOf(base)).setCrop().setPosition(x, y).clearTint();
      return;
    }
    const flashing = now - (this.flashAt.get(a.id) ?? -1e9) < 70;
    // Thrown back by a blow: the recoil pose (or a tilt), white for an instant, then the fall.
    if (a.knock && !a.dead) {
      const k = (tick - a.knock.from) / Math.max(1, a.knock.until - a.knock.from), back = Math.sign(a.knock.vx) || 1;
      const faceBlow = dirIndex(Math.atan2(-a.knock.vy, -a.knock.vx));
      if (has("hit")) sp.setTexture(`${key}-hit`, faceBlow * this.frames(`${key}-hit`) + Math.min(this.frames(`${key}-hit`) - 1, Math.floor(k * this.frames(`${key}-hit`)))).setAngle(0);
      else sp.setTexture(`${key}-rot`, faceBlow).setAngle(back * (8 + k * 30));
      sp.setOrigin(0.5, feetOf(base) / cellOf(base)).setCrop().setPosition(x, y);
      if (flashing) sp.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); else sp.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.knocked.add(a.id);
      return;
    }
    if (this.knocked.has(a.id)) {
      // The moment they hit the floor.
      this.knocked.delete(a.id);
      if (a.downUntil > tick) { this.fellAt.set(a.id, now); const v = this.pc ? Math.max(0, 1 - Math.hypot(a.x - this.pc.x, a.y - this.pc.y) / 30) : 0.5; if (v > 0) this.audio.play("bodyfall", 0.3 + v * 0.6, { minGap: 0.08 }); }
    }
    const fell = now - (this.fellAt.get(a.id) ?? -1e9);
    if (st2.down && fell < 380 && has("fall") && !a.seated) {
      const n = this.frames(`${key}-fall`);
      sp.setTexture(`${key}-fall`, dirIndex(a.facing) * n + Math.min(n - 1, Math.floor((fell / 380) * n))).setAngle(0).setOrigin(0.5, feetOf(base) / cellOf(base)).setCrop().setPosition(x, y).clearTint();
      return;
    }
    if (st2.down && has("fall") && !a.seated) {
      // Lying where they fell: the last frame of the fall.
      const n = this.frames(`${key}-fall`);
      sp.setTexture(`${key}-fall`, dirIndex(a.facing) * n + n - 1).setAngle(0).setOrigin(0.5, feetOf(base) / cellOf(base)).setCrop().setPosition(x, y);
      sp.setTint(a.dead ? 0xb89a9a : 0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
      return;
    }
    if (st2.down) {
      // Lying flat: the side-on frame, turned over.
      sp.setTexture(`${key}-rot`, 2).setOrigin(0.5, 0.5).setAngle(a.dead ? -90 : 90).setCrop();
      sp.setPosition(x, y - (FEET - HEAD) * scale * 0.12);
      sp.setTint(a.dead ? 0xc8b0b0 : 0xffffff).setTintMode(Phaser.TintModes.MULTIPLY);
      return;
    }
    sp.setAngle(0).setOrigin(0.5, feetOf(base) / cellOf(base)).clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    const dragged = a.dragging ? this.s.actors[a.dragging] : null, choke = this.choking.get(a.id) ?? 0;
    const re = this.react.get(a.id);
    if (re && now - re.at >= re.dur) this.react.delete(a.id);
    if (re && now - re.at < re.dur && has(re.sheet) && !a.seated && a.downUntil <= tick && !a.heldBy) {
      // A reaction (the double-take, the point, the shrug) plays through once, facing what caused it.
      const n = this.frames(`${key}-${re.sheet}`), k = (now - re.at) / re.dur;
      const d = re.face ? dirIndex(Math.atan2(re.face.y - a.y, re.face.x - a.x)) : di;
      sp.setTexture(`${key}-${re.sheet}`, d * n + Math.min(n - 1, Math.floor(k * n)));
    } else if (choke > performance.now() && has("choke")) {
      // The takedown: an arm round the neck from behind until he goes limp.
      const n = this.frames(`${key}-choke`), left = (choke - performance.now()) / 750;
      sp.setTexture(`${key}-choke`, di * n + Math.min(n - 1, Math.floor((1 - left) * n)));
    } else if (dragged && has("drag")) {
      // Hauling a body: bent over it, walking backwards.
      // Loop the bent-over half of the cycle; the first half is him straightening up.
      const n = this.frames(`${key}-drag`), h0 = Math.floor(n / 2), f = h0 + (moving ? Math.floor((tick + Math.abs(hash(a.id)) % 50) * 0.12) % (n - h0) : 0);
      sp.setTexture(`${key}-drag`, dirIndex(Math.atan2(dragged.y - a.y, dragged.x - a.x)) * n + f);
    } else if (a.id === this.s.stadium!.pc && this.sheetKind === "loot" && has("search")) {
      const n = this.frames(`${key}-search`);
      const h0 = Math.floor(n / 2);
      sp.setTexture(`${key}-search`, di * n + h0 + Math.floor(tick * 0.1) % (n - h0));
    } else if (moving && !a.seated && has("run") && Math.hypot(a.vx, a.vy) > 4.8) {
      const n = this.frames(`${key}-run`);
      sp.setTexture(`${key}-run`, di * n + Math.floor((tick + Math.abs(hash(a.id)) % 50) * 0.22) % n);
    } else if (moving && !a.seated) {
      // The walk cycle, paced to how fast they're going.
      const rate = Math.min(1.6, Math.hypot(a.vx, a.vy) / 2.2) * (base === "fan" || base === "fanbare" || base === "fandress" || base === "fannaked" || base === "bigman" ? 0.13 : 0.18);
      const f = Math.floor((tick + Math.abs(hash(a.id)) % 50) * rate) % 8;
      sp.setTexture(`${key}-walk`, di * 8 + f);
    } else if (!a.seated) {
      // Standing about: whatever they're up to (drinking, smoking, chatting, cheering), else breathing.
      const n0 = a.npc, off = Math.abs(hash(a.id)) % 997, sec = ["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief", "police"].includes(n0?.job ?? "");
      let act: string | null = n0?.gawk && n0.gawk.until > tick ? null : n0?.act ?? null;
      if (sec && Math.floor((tick + off * 7) / 480) % 4 === 0) act = "radio";
      const sheet = act && act !== "idle" && has(act) ? act : has("idle") ? "idle" : null;
      if (sheet) {
        const n = this.frames(`${key}-${sheet}`);
        let f: number;
        if (sheet === "drink" || sheet === "smoke" || sheet === "radio") { const period = n * 7 + 150 + (off % 120); f = Math.min(n - 1, Math.floor(((tick + off) % period) / 7)); }
        else f = Math.floor((tick + off) * (sheet === "idle" ? 0.09 : sheet === "cheer" ? 0.16 : 0.12)) % n;
        sp.setTexture(`${key}-${sheet}`, di * n + f);
        // Drinkers drop their empties.
        if (sheet === "drink" && f === n - 1 && (tick + off) % 2400 === 0) this.decalG.fillStyle(0xe8e8e0, 0.9).fillRect(Math.round(x + 10), Math.round(y - 2), 4, 5);
      } else sp.setTexture(`${key}-rot`, di);
    } else sp.setTexture(`${key}-rot`, Math.sin(a.facing) < 0 ? 4 : 0);
    // Throwing a punch: the punch frames (or a lunge) for a fifth of a second.
    const lg = this.lunge.get(a.id), la = lg ? (now - lg.at) / 220 : 1;
    let lx = 0, ly = 0;
    // The double-take starts with a little jump, cartoon-style: the body says "eh?!" before the head turns.
    if (re && re.sheet === "notice" && now - re.at < re.dur * 0.35 && !a.seated) ly -= Math.round(Math.sin(((now - re.at) / (re.dur * 0.35)) * Math.PI) * 6);
    if (lg && la < 1 && !a.seated) {
      const d = this.P.dir(lg.dx, lg.dy), push = Math.sin(Math.min(1, la * 1.6) * Math.PI) * 7;
      lx = Math.round(d.x * push); ly = Math.round(d.y * push);
      if (has("punch")) { const n = this.frames(`${key}-punch`); sp.setTexture(`${key}-punch`, dirIndex(Math.atan2(lg.dy, lg.dx)) * n + Math.min(n - 1, Math.floor(la * n))); }
      else sp.setTexture(`${key}-rot`, dirIndex(Math.atan2(lg.dy, lg.dx)));
    } else if (lg) this.lunge.delete(a.id);
    if (flashing) sp.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (this.recedes(a)) sp.setTint(a.seated ? 0x9ea3ad : 0xb4b8c0);
    if (a.seated) {
      // Only the top half shows over the seat in front.
      sp.setCrop(0, 0, CELL, 52);
      sp.setPosition(x, y + (FEET - 52) * scale * 0.8);
    } else { sp.setCrop(); sp.setPosition(x + lx, y + ly); }
    if (!a.seated && this.relevant.has(a.id)) this.rim(a.id, sp, depth);
  }
  /** Background crowd (the report: lower-detail silhouettes, compressed palette): an ordinary fan who's no
   *  part of anything right now is drawn a touch darker and cooler, so the people who matter (Grozz, staff,
   *  players, anyone near you, anyone up to something) carry the contrast. */
  recedes(a: Actor): boolean {
    if (!this.quiet || this.instinct || !a.npc || a.fb || a.off || a.dead || a.id === this.s.stadium!.pc) return false;
    const n = a.npc, tick = this.s.tick;
    if ((n.job !== "fan" && n.job !== "local") || n.shop || n.mode !== "routine") return false;
    if ((n.whyUntil ?? 0) > tick || (n.bubble && n.bubble.until > tick) || a.downUntil > tick || a.hand && this.s.items[a.hand]?.def !== "pint") return false;
    const pc = this.pc;
    return !pc || Math.hypot(a.x - pc.x, a.y - pc.y) > 6;
  }
  /** New UI when there's a reason for it (the report's first five minutes: "Phone and Bag become available
   *  because the player now has a reason to use them"). The Bag appears once you're carrying something you
   *  picked up; the Phone once it rings or someone gives you a number; both after four minutes regardless.
   *  Anyone who's played before (they know a rule) gets everything from the start. */
  bag0 = -1;
  uiShown = { bag: false, phone: false };
  progressiveUI(): void {
    const pc = this.pc;
    if (!pc) return;
    const held = [pc.hand, ...pc.pockets].filter(Boolean).length;
    if (this.bag0 < 0) this.bag0 = held;
    const veteran = this.rules.size > 0 && !this.pt, late = this.s.tick > 60 * 240 || !!this.s.match && this.s.match.phase !== "pre";
    const show = (id: "bag" | "phone", on: boolean) => {
      const el = $(id === "bag" ? "bagBtn" : "phoneBtn");
      if (on && !this.uiShown[id]) { this.uiShown[id] = true; el.hidden = false; if (!veteran && this.s.tick > 120) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } }
      else if (!on && !this.uiShown[id]) el.hidden = true;
    };
    show("bag", veteran || late || held > this.bag0 || this.sheetKind === "bag");
    show("phone", veteran || late || !!this.callOn || Object.keys(this.incoming).length > 0);
  }
  /** The match as director: one job at a time, read off the score and the clock (director.ts). When it
   *  changes it's said once on a strap, it heads the notes, and whoever it names gets the warm rim. */
  job: Job | null = null;
  jobAt = 0;
  directJob(): void {
    const job = matchJob(this.w), now = performance.now();
    const changed = (job?.id ?? "") !== (this.job?.id ?? "");
    this.job = job;
    if (!job || !changed) return;
    if (job.urgent && this.speed > 1) this.setSpeed(1);
    if (now - this.jobAt < 25000 && !job.urgent) return;
    if (!$("chainStrap").hidden) return;
    this.jobAt = now;
    const el = $("chainStrap");
    el.innerHTML = `<b>THE JOB</b><span><i>${esc(job.text)}</i></span>`;
    el.hidden = false; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in");
    this.audio.play("chime", 0.45, { rate: job.urgent ? 1.2 : 0.85 });
    clearTimeout(this.chainTimer); this.chainTimer = window.setTimeout(() => { el.hidden = true; }, 6000);
  }
  /** On the gear: the screen too bright and pulsing with a racing heart; grey on the comedown; and as it
   *  wears off, a button for another line while there's any left. */
  heartAt = 0;
  cokeFx(): void {
    const pc = this.pc, tick = this.s.tick;
    if (!pc) return;
    const left = (pc.effects.wired ?? 0) - tick, on = left > 0, down = !on && (pc.effects.comedown ?? 0) > tick;
    document.body.classList.toggle("coked", on);
    document.body.classList.toggle("comedown", down);
    if (on && performance.now() - this.heartAt > 3800) { this.heartAt = performance.now(); this.audio.play("heartbeat", left < 60 * 15 ? 0.75 : 0.45); }
    const gear = [pc.hand, ...pc.pockets].map((id) => (id ? this.s.items[id] : undefined)).find((i) => i?.def === "powder" && (i.uses ?? 4) > 0);
    const btn = $("lineBtn");
    const want = !!gear && ((on && left < 60 * 15) || down) && !pc.heldBy && !this.callOn && !this.sheetKind;
    if (want && btn.hidden) { btn.querySelector("i")!.textContent = String(gear!.uses ?? 4); }
    btn.hidden = !want;
  }
  /** The observer's strip (playtest only): one tap per laugh, and what caused it. */
  ptBar(): void {
    if (!this.pt || document.getElementById("ptBar")) return;
    const bar = document.createElement("div");
    bar.id = "ptBar";
    bar.innerHTML = `<button data-l="open" title="They laughed">😂</button><span hidden><button data-l="line">A line</button><button data-l="animation">Animation</button><button data-l="plan">Their plan</button><button data-l="accident">Accident</button></span>`;
    document.body.appendChild(bar);
    const opts = bar.querySelector("span") as HTMLElement;
    bar.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation(); ev.preventDefault();
      const b = (ev.target as HTMLElement).closest("button") as HTMLElement | null, k = b?.dataset.l;
      if (!k) return;
      if (k === "open") { opts.hidden = !opts.hidden; return; }
      this.pt!.laugh(k); opts.hidden = true;
      const n = document.createElement("i"); n.textContent = "+1"; bar.appendChild(n); setTimeout(() => n.remove(), 700);
    });
  }
  ptReport(): void {
    if (!this.pt) return;
    const all = this.pt.save(), prev = this.speed;
    this.setSpeed(0);
    const box = document.createElement("div");
    box.id = "ptReport";
    box.innerHTML = `<div><h3>Playtest report</h3><textarea placeholder="Notes on this tester (what they said, where they got stuck)">${this.pt.s.notes}</textarea><pre></pre>
      <p><button data-a="copy" class="primary">Copy all</button><button data-a="next">Next tester (fresh start)</button><button data-a="clear">Clear all</button><button data-a="close">Back to the game</button></p></div>`;
    document.body.appendChild(box);
    const pre = box.querySelector("pre")!, ta = box.querySelector("textarea")!;
    const render = () => { pre.textContent = PlayTest.text(PlayTest.all()); };
    render();
    ta.addEventListener("input", () => { this.pt!.s.notes = ta.value; this.pt!.save(); render(); });
    box.addEventListener("click", (ev) => {
      const a = ((ev.target as HTMLElement).closest("button") as HTMLElement | null)?.dataset.a;
      if (a === "copy") { const t = pre.textContent ?? ""; navigator.clipboard?.writeText(t).then(() => this.hint("Copied."), () => { const r = document.createRange(); r.selectNodeContents(pre); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); }); }
      if (a === "clear") { PlayTest.clear(); render(); }
      if (a === "next") { this.pt!.save(); location.reload(); }
      if (a === "close") { box.remove(); this.setSpeed(prev || 1); }
    });
  }
  /** The report's third tier, "currently relevant": a soft warm rim that breathes, on what matters right
   *  now and nothing else. The loose keg before you've learned what it does; whatever and whoever the
   *  thing in your hand is for; and the people you haven't had an idea about yet, once you're near. */
  relevant = new Set<string>();
  beatRel: { ids: string[]; until: number } | null = null;
  rimPool = new Map<string, Phaser.GameObjects.Image>();
  rimSeen = new Set<string>();
  relevantNow(): void {
    const s = this.s, pc = this.pc, R = this.relevant;
    if (!pc || (s.tick % 10 !== 0 && R.size)) return;
    R.clear();
    if (this.instinct) return;
    // What your hand is for: the people and things among its targets.
    for (const t of this.itemTgts) {
      for (const a of Object.values(s.actors)) if (a.npc && !a.dead && Math.hypot(a.x - t.x, a.y - t.y) < 0.5) R.add(a.id);
      for (const i of Object.values(s.items)) if (i.loc.k === "ground" && Math.hypot(i.loc.x - t.x, i.loc.y - t.y) < 0.5) R.add(`item-${i.id}`);
    }
    // Their star's boots, sat by the coach, until you've clocked them.
    if (!this.curios.has("bootbag")) for (const i of Object.values(s.items)) if (i.def === "boot_bag" && i.loc.k === "ground" && Math.hypot(i.loc.x - pc.x, i.loc.y - pc.y) < 14) R.add(`item-${i.id}`);
    // Whatever the mischief director has just set going near you.
    if (this.beatRel && performance.now() < this.beatRel.until) for (const id of this.beatRel.ids) R.add(id);
    // The match's job of the moment: whoever it names (their star, their keeper, the ref).
    if (this.job?.target) R.add(this.job.target);
    // People worth a thought, until you've had it (Lenny, Del), when you're within a stone's throw.
    for (const c of CURIOS) {
      if (this.curios.has(c.id) || (c.id !== "lenny" && c.id !== "del")) continue;
      const p = c.at(this.w) as { id?: string; x: number; y: number } | null | undefined;
      if (p?.id && Math.hypot(p.x - pc.x, p.y - pc.y) < 14) R.add(p.id);
    }
  }
  rim(id: string, src: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, dep: number): void {
    let r = this.rimPool.get(id);
    if (!r) { r = this.add.image(0, 0, src.texture.key, src.frame.name); this.rimPool.set(id, r); }
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 280);
    r.setTexture(src.texture.key, src.frame.name).setOrigin(src.originX, src.originY).setPosition(src.x, src.y)
      .setScale(src.scaleX * 1.12, src.scaleY * 1.07).setAngle(src.angle).setFlipX(src.flipX)
      .setTint(0xffd75a).setTintMode(Phaser.TintModes.FILL).setAlpha(0.28 + 0.3 * k).setDepth(dep - 0.5).setVisible(true);
    this.rimSeen.add(id);
  }
  /** Reaction animations (the report's highest-value art): who's mid-reaction, which sheet, facing what. */
  react = new Map<string, { sheet: string; at: number; dur: number; face?: { x: number; y: number } }>();
  reactTo(e: any): void {
    const s = this.s, pcA = s.actors[s.stadium!.pc];
    const play = (id: string, sheet: string, dur: number, face?: { x: number; y: number }) => {
      const a = s.actors[id];
      if (!a?.npc || a.dead || this.react.has(id)) return;
      this.react.set(id, { sheet, at: performance.now(), dur, face });
    };
    switch (e.type) {
      // Seen you at it: the double-take, at you.
      case "spotted": play(e.by, "notice", 800, pcA); break;
      // Given a problem: the double-take at it, then off he goes (the sim gives him the beat).
      case "post_left": play(e.by, "notice", 750, e.x !== undefined && s.stadium!.chain?.pts?.length ? s.stadium!.chain.pts[0] : undefined); break;
      // Lost you.
      case "evaded": for (const a of Object.values(s.actors)) if (a.npc && isSecurityJob(a.npc.job) && pcA && Math.hypot(a.x - pcA.x, a.y - pcA.y) < 30) play(a.id, "shrug", 1400); break;
      case "say": {
        const a = s.actors[e.by], n = a?.npc;
        if (!a || !n || !isSecurityJob(n.job)) break;
        if (/^(Where's he gone|Lost him|He was right here)/.test(e.text)) { play(a.id, "shrug", 1400); break; }
        // Telling someone off, or telling them where to go: the point.
        const near = pcA && Math.hypot(a.x - pcA.x, a.y - pcA.y) < 9;
        if (near && (n.mode === "approach" || n.mode === "chase" || n.why === "angry" || /^(Oi|Any more|Do that again|The ball|That's the match ball|Hand it)/.test(e.text))) play(a.id, "point", 1100, pcA);
        break;
      }
    }
  }
  knocked = new Set<string>();
  fellAt = new Map<string, number>();
  /** Frames per direction in an animation sheet. */
  frames(key: string): number { const src = this.textures.get(key).getSourceImage() as HTMLCanvasElement; return Math.max(1, Math.round(src.width / (src.height / 8 >= 120 ? 128 : CELL))); }

  /** Hats, masks, helmets and blood, over the sprite's head. */
  drawHeadwear(g: Phaser.GameObjects.Graphics, a: Actor, st2: FigureStyle): void {
    const P = this.P, s = this.s, tick = s.tick;
    if (st2.down || !this.bank.ready()) return;
    const { h, base } = this.spriteFor(a);
    // The police and mounted sprites already have their helmets on.
    if (base === "horse" || (base === "police" && !st2.face && !((a.effects.bloody ?? 0) > tick))) return;
    const scale = P.standing && P.S === PPM ? 1 : (h * P.KZ * P.S) / (FEET - HEAD) * (P.standing ? 1 : 0.7);
    const x = P.sx(a.x, a.y), feet = P.sy(a.x, a.y) + (a.seated ? (FEET - 52) * scale * 0.8 : 0);
    const top = feet - (FEET - HEAD) * scale, hw = 7 * scale;
    const job = a.npc?.job;
    if ((job === "police" && !this.bank.has("police")) || st2.hat === 0x101830) {
      // A custodian helmet.
      g.fillStyle(job === "armed" ? 0x15171a : 0x101830, 1).fillEllipse(x, top + hw * 0.2, hw * 2.1, hw * 1.9).fillRect(x - hw * 1.2, top + hw * 0.9, hw * 2.4, hw * 0.35);
      g.fillStyle(0xd9d9d9, 1).fillCircle(x, top + hw * 0.4, hw * 0.25);
    } else if (job === "armed") {
      g.fillStyle(0x15171a, 1).fillEllipse(x, top + hw * 0.5, hw * 2.2, hw * 1.4);
    } else if (a.worn.head && (s.items[a.worn.head]?.def === "wig" || s.items[a.worn.head]?.def === "long_wig")) {
      if (this.baked(a, "wig")) { /* painted into the sprite */ } else {
      // A wig: a mop of hair over the bald head; the long one hangs to the shoulders.
      const long = s.items[a.worn.head].def === "long_wig", c = st2.hat ?? 0x5a3a22;
      g.fillStyle(c, 1).fillEllipse(x, top + hw * 0.55, hw * 2.3, hw * 1.5);
      g.fillRect(x - hw * 1.15, top + hw * 0.5, hw * 0.45, hw * (long ? 3.6 : 1.4)).fillRect(x + hw * 0.7, top + hw * 0.5, hw * 0.45, hw * (long ? 3.6 : 1.4));
      g.fillStyle(0xffffff, 0.18).fillRect(x - hw * 0.5, top + hw * 0.1, hw * 0.9, hw * 0.25);
      }
    } else if (st2.hat) g.fillStyle(st2.hat, 1).fillEllipse(x, top + hw * 0.5, hw * 2.2, hw * 1.1).fillRect(x - hw * 1.4, top + hw * 0.8, hw * 2.8, hw * 0.3);
    if (st2.face) {
      const fy = top + hw * 1.6;
      if (st2.face.kind === "full") g.fillStyle(st2.face.colour, 1).fillEllipse(x, fy, hw * 2, hw * 2.3);
      else if (st2.face.kind === "tache") { if (!this.baked(a, "tache")) g.fillStyle(st2.face.colour, 1).fillRect(x - hw * 0.6, fy + hw * 0.45, hw * 1.2, hw * 0.3); }
      else g.fillStyle(st2.face.colour, 1).fillRect(x - hw * 0.8, fy - hw * 0.15, hw * 1.6, hw * 0.35);
    }
    if ((a.effects.bloody ?? 0) > tick) {
      g.fillStyle(0x8a0a0a, 0.85);
      for (let i = 0; i < 5; i++) g.fillCircle(x + Math.sin(i * 2.1 + hash(a.id)) * hw * 1.4, top + hw * (3 + (i % 3) * 1.2), hw * 0.35);
    }
  }

  /** A stocky brown dog, side-on, legs going when it runs. The lead, if somebody has it. */
  drawDog(a: Actor, g: Phaser.GameObjects.Graphics) {
    // Ronson: a pit bull. Low, wide, all chest and jaw; brindle with a white bib and a studded collar.
    const P = this.P, S = P.S * 1.35, tick = this.s.tick, dg = this.s.stadium!.dog, pc = this.pc;
    const x0 = P.sx(a.x, a.y), y = P.sy(a.x, a.y), speed = Math.hypot(a.vx, a.vy), run = speed > 0.5;
    const dir = Math.cos(a.facing) >= 0 ? 1 : -1;
    const angry = !!dg && (dg.state === "loose" || dg.state === "sicced" || speed > 5 || tick - this.dogNoiseAt < 50);
    // Lurching: the whole body throws forward and back when it lunges.
    const lurch = speed > 5 ? Math.sin(tick * 0.5) * S * 0.1 : 0;
    const x = x0 + dir * lurch;
    const sw = run ? Math.sin(tick * 0.7) * S * 0.1 : 0;
    const h = S * (P.standing ? 0.5 : 0.28);
    const BRINDLE = 0x6b4a32, DARK = 0x3a2618, BIB = 0xe8ddd0;
    g.fillStyle(0x000000, 0.3).fillEllipse(x0, y, S * 1.25, S * 0.4);
    // Short thick legs.
    g.fillStyle(DARK, 1)
      .fillRect(x - S * 0.42 + sw, y - h * 0.5, S * 0.14, h * 0.5).fillRect(x - S * 0.22 - sw, y - h * 0.5, S * 0.14, h * 0.5)
      .fillRect(x + S * 0.18 + sw, y - h * 0.5, S * 0.16, h * 0.5).fillRect(x + S * 0.34 - sw, y - h * 0.5, S * 0.16, h * 0.5);
    // Barrel body, deeper at the chest end; a whip of a tail.
    g.fillStyle(BRINDLE, 1).fillEllipse(x, y - h * 0.72, S * 1.05, h * 0.62);
    g.fillStyle(BRINDLE, 1).fillEllipse(x + dir * S * 0.25, y - h * 0.78, S * 0.6, h * 0.78);
    g.fillStyle(DARK, 0.5).fillRect(x - S * 0.3, y - h * 0.95, S * 0.06, h * 0.4).fillRect(x - S * 0.1, y - h * 0.98, S * 0.06, h * 0.45);
    g.fillStyle(BIB, 1).fillEllipse(x + dir * S * 0.38, y - h * 0.6, S * 0.22, h * 0.45);
    g.lineStyle(S * 0.06, BRINDLE, 1).lineBetween(x - dir * S * 0.5, y - h * 0.85, x - dir * S * 0.66, y - h * (1.05 + (run ? Math.sin(tick * 0.9) * 0.15 : 0)));
    // Studded collar.
    const hx = x + dir * S * 0.58, hy = y - h * 1.12;
    g.fillStyle(0x111111, 1).fillRect(hx - dir * S * 0.2 - S * 0.06, hy + S * 0.02, S * 0.12, S * 0.22);
    g.fillStyle(0xc0c8d0, 1).fillCircle(hx - dir * S * 0.2, hy + S * 0.08, S * 0.025).fillCircle(hx - dir * S * 0.2, hy + S * 0.18, S * 0.025);
    // The head: broad skull, wide cheeks, cropped ears.
    g.fillStyle(BRINDLE, 1).fillEllipse(hx, hy, S * 0.46, S * 0.38);
    g.fillStyle(DARK, 1).fillTriangle(hx - dir * S * 0.12, hy - S * 0.16, hx - dir * S * 0.02, hy - S * 0.3, hx + dir * S * 0.02, hy - S * 0.14);
    g.fillStyle(BIB, 1).fillEllipse(hx + dir * S * 0.16, hy + S * 0.04, S * 0.2, S * 0.18);
    // Jaws: snapping open and shut when it's worked up; teeth, gums, a string of drool.
    const gape = angry ? Math.abs(Math.sin(tick * 0.55)) * S * 0.14 : S * 0.02;
    const mx = hx + dir * S * 0.22, my = hy + S * 0.08;
    g.fillStyle(0x8a1a2a, 1).fillRect(mx - S * 0.1, my - S * 0.02, S * 0.2, gape + S * 0.02);
    if (angry) {
      g.fillStyle(0xf4f1e4, 1);
      for (let i = 0; i < 3; i++) {
        const tx = mx - S * 0.08 + i * S * 0.07;
        g.fillTriangle(tx, my - S * 0.02, tx + S * 0.03, my - S * 0.02, tx + S * 0.015, my + S * 0.03);
        g.fillTriangle(tx, my + gape, tx + S * 0.03, my + gape, tx + S * 0.015, my + gape - S * 0.04);
      }
      g.lineStyle(1, 0xdfe8ee, 0.8).lineBetween(mx, my + gape, mx + dir * S * 0.02, my + gape + S * (0.12 + Math.abs(Math.sin(tick * 0.13)) * 0.1));
    }
    g.fillStyle(0x15100c, 1).fillCircle(hx + dir * S * 0.3, hy - S * 0.02, S * 0.05);
    g.fillStyle(angry ? 0xff3020 : 0x1a1008, 1).fillCircle(hx + dir * S * 0.06, hy - S * 0.08, S * 0.035);
    // Hackles up.
    if (angry) {
      g.lineStyle(1.2, DARK, 1);
      for (let i = 0; i < 5; i++) { const bx = x - S * 0.2 + i * S * 0.12; g.lineBetween(bx, y - h * 1.02, bx - dir * S * 0.03, y - h * 1.18); }
    }
    if (dg && pc && (dg.state === "led" || dg.state === "tied")) {
      const to = dg.state === "led" ? { x: P.sx(pc.x, pc.y), y: P.sy(pc.x, pc.y) - S * 0.7 } : { x: P.sx(SPOTS.dogPost.x, SPOTS.dogPost.y - 0.6), y: P.sy(SPOTS.dogPost.x, SPOTS.dogPost.y - 0.6, 0.8) };
      // A lead pulled tight when it's lunging, slack when it isn't.
      const taut = speed > 5;
      const midx = (hx + to.x) / 2, midy = (hy + to.y) / 2 + (taut ? 0 : S * 0.25);
      g.lineStyle(taut ? 2 : 1.5, 0xd7263d, 0.95).lineBetween(hx - dir * S * 0.2, hy + S * 0.1, midx, midy).lineBetween(midx, midy, to.x, to.y);
      if (dg.state === "tied") g.fillStyle(0x6a6a6a, 1).fillRect(to.x - 2, to.y - 2, 4, S * 0.9);
    }
  }

  // ---------- HUD ----------
  lastArea = ""; areaShownAt = 0;
  /** Where the main button would act: a ring is drawn there. */
  primaryAt: { x: number; y: number } | null = null;

  /** One short line: what you're here to do right now. */
  objective(): string {
    const s = this.s, m = s.match!, st = s.stadium!, pc = this.pc;
    const opp = m.teams[1].name;
    if (st.ending) return "";
    if (m.phase === "pre") return st.admitted ? (pc.seated ? "Kick-off soon" : "Find a seat, or find some trouble") : "Get into the ground";
    if (m.phase === "break") return "Half-time: the teams are in the dressing rooms";
    if (m.phase === "shootout") return "Penalties";
    const d = m.score[0] - m.score[1];
    return d < 0 ? `England are losing to ${opp}. Do something` : d > 0 ? "England are winning. Keep it that way" : "Level. Tip it England's way";
  }

  /** Where an option would happen, for the ring. */
  optionSpot(o: Option): { x: number; y: number } | null {
    const s = this.s, a = o.action;
    if (o.sheet) { const who = s.actors[o.sheet.who]; return who ? { x: who.x, y: who.y } : null; }
    if (a?.target?.k === "actor") { const t = s.actors[a.target.id]; return t ? { x: t.x, y: t.y } : null; }
    if (a?.target?.k === "item") { const l = s.items[a.target.id]?.loc; return l && l.k === "ground" ? { x: l.x, y: l.y } : null; }
    if (a?.item && a.verb === "take") { const l = s.items[a.item]?.loc; return l && l.k === "ground" ? { x: l.x, y: l.y } : null; }
    return null;
  }

  drawHud() {
    const s = this.s, m = s.match!, pc = this.pc, st = s.stadium!;
    const t = secs(this.w);
    const label = m.phase === "pre" ? `KO ${fmtTime(Math.max(0, (m.phaseUntil - s.tick) / 60))}${st.flags.kickoffDelays ? " (late)" : ""}` : m.phase === "finished" ? "FT" : m.phase === "break" ? (m.period === 1 ? `HT ${fmtTime(Math.max(0, (m.phaseUntil - s.tick) / 60))}` : "…") : clockLabel(m);
    const pens = m.shootout ? ` (${m.shootout.scored[0]}–${m.shootout.scored[1]})` : "";
    const key = `${m.score[0]}–${m.score[1]}|${label}${pens}`;
    if (key !== this.lastScore) { this.lastScore = key; $("sc").textContent = `${m.score[0]}–${m.score[1]}`; $("clock").textContent = label + pens; }
    if (!pc) return;
    $("money").textContent = `£${pc.money}`;
    const area = areaAt(pc.x, pc.y);
    const bad = looksOutOfPlace(this.w, pc);
    const busV = st.vehicles.bus;
    // The place name shows for a moment when you walk somewhere new; otherwise, what you're here to do.
    if (area.name !== this.lastArea) { this.lastArea = area.name; this.areaShownAt = performance.now(); }
    const fresh = performance.now() - this.areaShownAt < 2200;
    const where = busV?.drivenBy === pc.id ? `Driving the ${m.teams[1].name} team bus` : pc.hiddenIn === "car" ? `Driving a nicked ${st.myCar?.kind === "policecar" ? "police car" : st.myCar?.kind === "taxi" ? "black cab" : "motor"}` : pc.hiddenIn ? (pc.hiddenIn === busV?.cargo ? "Hiding in the bus's luggage hold" : `Hiding in the back of the ${VENUE.delivery.name}`) : pc.heldBy ? "Being frogmarched"
      : bad ? `${area.name} · you shouldn't be here` : fresh && this.s.tick > 60 * 4 ? area.name : "";
    const wEl = $("where");
    if (wEl.textContent !== where) wEl.textContent = where;
    // Like Hitman's and MGS's area names: up when it changes, then out of the way (a warning stays).
    wEl.hidden = !where;
    wEl.classList.toggle("bad", bad && !pc.hiddenIn);
    this.updateGuides();
    // One indicator for all of security: the worst attention you are getting.
    let worst = 0;
    for (const id in s.actors) {
      const n = s.actors[id].npc;
      if (!n || n.target !== pc.id) continue;
      worst = Math.max(worst, n.mode === "watch" ? 1 : n.mode === "approach" ? 2 : n.mode === "chase" ? 3 : n.mode === "search" ? 1.5 : n.mode === "escort" ? 4 : 0);
    }
    const eye = $("eye");
    eye.hidden = worst === 0;
    eye.textContent = worst >= 4 ? "Caught" : worst >= 3 ? "Being chased" : worst >= 2 ? "A steward is coming for you" : worst >= 1.5 ? "They are looking for you" : "Being watched";
    eye.classList.toggle("hot", worst >= 2);
    if (st.detainedUntil) { eye.hidden = false; eye.textContent = `Detained · ${Math.ceil((st.detainedUntil - s.tick) / 60)}s`; eye.classList.add("hot"); }
    if (st.flags.heatMode === 3 && !pc.heldBy) { eye.hidden = false; eye.textContent = "Out of sight: stay hidden"; eye.classList.remove("hot"); }
    if (s.tick % 2 === 0) this.drawRadar();
    // Where they last saw you: a ghost of you there (Splinter Cell's last known position). They'll go
    // and look; you can use that.
    {
      const lk = st.flags.heatMode === 3 ? Object.values(s.actors).filter((a) => a.npc?.target === pc.id && a.npc.lastSeen && ["approach", "chase", "search"].includes(a.npc.mode)).map((a) => a.npc!.lastSeen!).sort((p, q) => q.t - p.t)[0] : undefined;
      const src = this.spritePool.get(pc.id);
      if (lk && src && this.useSprites) {
        if (!this.lkGhost) { this.lkGhost = this.add.image(0, 0, src.texture.key, src.frame.name); this.lkGhost.setTint(0xe8f0ff).setTintMode(Phaser.TintModes.FILL); }
        this.lkGhost.setTexture(src.texture.key, src.frame.name).setOrigin(src.originX, src.originY).setScale(src.scaleX).setPosition(Math.round(this.P.sx(lk.x, lk.y)), Math.round(this.P.sy(lk.x, lk.y))).setDepth(1e5).setVisible(true)
          .setAlpha(0.25 + 0.12 * Math.sin(performance.now() / 180));
      } else this.lkGhost?.setVisible(false);
    }
    if (this.buffered) {
      if (performance.now() - this.buffered.at > 450) this.buffered = null;
      else if (pc.downUntil <= s.tick) { const o = this.buffered.opt; this.buffered = null; this.run(o); }
    }
    if (s.tick % 10 === 0) this.doorHints();
    if (s.tick % 30 === 0 && !pc.hiddenIn) {
      if (VENUE.inside(pc.x, pc.y)) this.tick("in");
      if (areaAt(pc.x, pc.y).id === "pitch") this.tick("pitch");
      if (pc.worn.outer && s.items[pc.worn.outer]?.def === "mascot_suit") this.tick("lenny");
    }
    this.placeRing();
    // The music follows how hot it is.
    if (s.tick % 20 === 0 && this.started && !st.ending) {
      const hm = st.flags.heatMode ?? 0;
      void this.audio.music(hm === 4 ? "mus_alert" : hm === 3 ? "mus_evasion" : hm === 2 ? "mus_caution" : "mus_matchday");
    }

    // Buttons.
    if (s.tick % 6 === 0 || !this.opts.length) {
      this.opts = options(this.w, pc, this.picked);
      // The hit button has the blows: the main button never repeats one of them (that's what doubled up "Take down Shaz").
      const fighting = this.fightOn();
      const hitFirst = this.fightOpt() ?? (fighting ? this.opts.find((o) => o.action?.verb === "strike") : undefined);
      // Blows never go on the main button: a fight is started on purpose (tap the person) or comes to you.
      const blow = (o: Option) => o.action?.verb === "strike" || (o.action?.verb === "finish" && !!hitFirst);
      const p = !pc.heldBy && !pc.hiddenIn ? this.opts.find((o) => o.priority > 0 && !blow(o)) ?? null : primary(this.opts);
      this.mainOpt = p;
      const act = $<HTMLButtonElement>("act");
      act.disabled = !p;
      act.hidden = !p;
      act.style.visibility = this.ring ? "hidden" : "";
      $("fightRow").style.visibility = this.ring ? "hidden" : "";
      $("moreBtn").style.visibility = this.ring ? "hidden" : "";
      act.textContent = p ? shortLabel(p) : "";
      this.primaryAt = p ? this.optionSpot(p) : null;
      const thr = $("throw");
      const ta = (this as any).throwAt as Actor | null;
      const MISSILE = new Set(["brick", "fart_can", "flare", "bottle", "pint_glass"]);
      const canThrow = !!pc.hand && !pc.heldBy && !pc.hiddenIn && (fighting || MISSILE.has(this.s.items[pc.hand]?.def ?? ""));
      thr.hidden = !canThrow;
      // Short labels: the verb and the last word of their name ("Big Kev" is Kev, "Steward Pauline" is Pauline).
      const short = (n: string) => n.replace(/ \(.*\)$/, "").split(" ").pop() ?? n;
      if (canThrow) thr.textContent = ta ? `Throw at ${short(personName(ta))}` : "Throw";
      // The quick slot: what's in your hand, tap to use it somewhere.
      const ub = $("useBtn"), h = pc.hand ? this.s.items[pc.hand] : undefined;
      const usable = !!h && !!ITEM_TIPS[h.def] && !defOf(h).slot && !fighting && !pc.heldBy && !pc.hiddenIn && !pc.seated;
      ub.hidden = !usable;
      if (usable && ub.dataset.item !== h!.id) { ub.dataset.item = h!.id; ub.innerHTML = `${icon(h!.def)}<span>Use</span>`; }
      // In a fight, the hit button sticks to the one you're fighting (and goes to Stamp once he's down).
      const hit = $("hit"), hitOpt = hitFirst;
      hit.hidden = !hitOpt || !!pc.heldBy || !!pc.hiddenIn;
      if (hitOpt) {
        const lab = hitOpt.label.replace(/ \(.*\)$/, ""), m2 = lab.match(/^(Take down|Counter|Stamp on|Punch|Stab|Glass|Chair|Hit) (.+?)(!| with .*)?$/);
        hit.textContent = m2 ? `${m2[1]} ${short(m2[2])}` : lab.split(" ").slice(0, 3).join(" ");
        (this as any).hitOpt = hitOpt;
      }
      // Betting by phone is the phone's betting app now (one fewer button).
      $("betBtn").hidden = true;
      // Fast-forward only while you're sat watching, bottom left, out of the way.
      const canFast = !!pc.seated;
      $("speed").hidden = !canFast; $("speed").classList.toggle("seated", canFast);
      if (!canFast && this.speed > 1) this.setSpeed(1); // (fast-forward only; a pause for the bag or a call stays a pause)
      if (this.sheetKind === "more") this.openMore();
    }
  }

  /** The objective strap: shown for a few seconds when it changes, then gone. */
  objShown = ""; objAt = 0;
  objectiveNow(): string {
    const o = this.objective(), now = performance.now();
    if (o !== this.objShown) { this.objShown = o; this.objAt = now; }
    return now - this.objAt < 5000 ? o : "";
  }

  /** Who you're fighting: the last one you hit, for a few seconds, while he's close. */
  fight: { id: string; until: number } | null = null;
  mainOpt: Option | null = null;
  /** Is there a fight on? You've hit someone or been hit in the last few seconds, someone on duty is
   *  coming for you up close, or a creep has his hands on you. Only then do the punch and throw buttons
   *  (and the crosshair on a person) come up; otherwise you start one on purpose, by tapping someone. */
  fightOn(): boolean {
    const pc = this.pc, s = this.s, now = performance.now();
    if (!pc) return false;
    if (this.fight && now < this.fight.until) return true;
    if (s.stadium!.creep?.id && s.stadium!.creep.phase !== "leer") return true;
    return Object.values(s.actors).some((a) => a.npc && a.npc.target === pc.id && ["approach", "chase"].includes(a.npc.mode) && a.npc.crime >= 1 && Math.hypot(a.x - pc.x, a.y - pc.y) < 5);
  }
  fightOpt(): Option | null {
    const f = this.fight, pc = this.pc;
    if (!f || !pc || performance.now() > f.until) return null;
    const t = this.s.actors[f.id];
    if (!t || t.hiddenIn || Math.hypot(t.x - pc.x, t.y - pc.y) > 3.4) return null;
    const base = { actor: pc.id, target: { k: "actor" as const, id: t.id } };
    if (incapacitated(this.w, t)) return t.splat ? null : { label: `Stamp on ${personName(t)}`, priority: 1, action: { verb: "finish", ...base } };
    const held = pc.hand ? this.s.items[pc.hand] : undefined;
    const w = held && hasProp(held, "weapon");
    return { label: `${w ? (hasProp(held!, "sharp") ? "Stab" : "Hit") : "Punch"} ${personName(t)}`, priority: 1, action: { verb: "strike", ...base } };
  }
  /** A tap while you're still recovering isn't lost: it goes as soon as you can. */
  buffered: { opt: Option; at: number } | null = null;

  /** Everything said, for the menu's log. Only the newest line is ever on screen. */
  log: { text: string; src: string }[] = [];
  lineTimer = 0;
  say(text: string, src: string, big: boolean, show = true) {
    this.log.push({ text, src });
    if (this.log.length > 30) this.log.shift();
    if (!show) return;
    // A minor line never pushes a big one off the screen early.
    const cur = this.lines[0];
    if (cur?.big && !big && performance.now() < (this as any).lineShownAt + 2500) return;
    this.lines = [{ text, src, big }];
    (this as any).lineShownAt = performance.now();
    this.renderTicker();
    clearTimeout(this.lineTimer);
    this.lineTimer = window.setTimeout(() => { this.lines = []; this.renderTicker(); }, big ? 6000 : 4000);
  }
  /** Match commentary is only heard where there is a telly, a radio or a crowd. */
  matchLine(text: string, big: boolean) {
    const pc = this.pc, area = pc ? areaAt(pc.x, pc.y) : null;
    const inGround = pc && VENUE.inside(pc.x, pc.y);
    if (inGround || area?.id === "pub") this.say(text, area?.id === "pub" ? "Pub telly" : "Commentary", big);
    else if (/scores|own net|given/.test(text)) this.say("A roar from inside the ground.", "Outside", true);
  }
  renderTicker() {
    const el = $("ticker");
    el.textContent = "";
    this.lines.forEach((l, i) => {
      const d = document.createElement("div");
      d.className = "line" + (l.big ? " big" : "");
      const sp = document.createElement("span"); sp.className = "src"; sp.textContent = l.src;
      const tx = document.createElement("span"); tx.className = "txt"; tx.textContent = l.text;
      d.appendChild(sp); d.appendChild(tx);
      el.appendChild(d);
    });
  }
  hintTimer = 0;
  /** A tip that waits its turn: not before `minSecs` into the day, and not while anything else is on screen. */
  quietHint(text: string, minSecs: number): void {
    const tryIt = () => {
      const busy = !$("hint").hidden || !$("itemCard").hidden || !$("chainStrap").hidden || !!this.callOn || !!this.sheetKind || (this.pcLine && this.pcLine.until > performance.now());
      if (this.s.tick < 60 * minSecs || busy) { setTimeout(tryIt, 1500); return; }
      this.hint(text);
    };
    setTimeout(tryIt, 2600);
  }
  hint(text: string) {
    const h = $("hint");
    h.hidden = false; h.textContent = text.charAt(0).toUpperCase() + text.slice(1) + (/[.!?]$/.test(text) ? "" : ".");
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => { h.hidden = true; }, 2600);
  }

  setSpeed(n: number) {
    this.speed = n; this.stepper.timeScale = n;
    for (const o of [1, 2, 4]) $("sp" + o).setAttribute("aria-pressed", String(o === n));
  }

  // ---------- Actions ----------
  /** A buzz in the hand (Android phones; iPhones' browsers don't do it), for hits, buys, knockouts. */
  buzzOn = (() => { try { return localStorage.getItem("kd-buzz") !== "0"; } catch { return true; } })();
  buzz(ms: number | number[]) { if (!this.buzzOn) return; try { navigator.vibrate?.(ms); } catch { /* not supported */ } }
  /** Mini-games on (a menu switch; remembered). */
  miniOn = (() => { try { return localStorage.getItem("kd-mini") !== "0"; } catch { return true; } })();
  miniBusy = false;
  miniFor(a: Action): MiniKind | null {
    if (a.verb === "pickpocket") return "pocket";
    if (a.verb === "carjack") return "hotwire";
    if (a.verb === "drain" && !this.s.stadium!.flags.hatchOpen) return "jimmy";
    if (a.verb === "use" && a.target?.k === "item" && ["cooler_home", "cooler_away", "tea_urn"].includes(this.s.items[a.target.id]?.def)) return "pour";
    return null;
  }
  run(opt: Option | null) {
    if (!opt || !this.started) return;
    // The fiddly jobs are a quick touch beat first (if it would work at all).
    if (opt.action && this.miniOn && !(opt as { mini?: boolean }).mini && !this.miniBusy) {
      const kind = this.miniFor(opt.action);
      const { verb, ...rest } = opt.action;
      if (kind && possibleVerbs(this.w, rest).includes(verb)) {
        this.miniBusy = true;
        const was = this.speed || 1; this.setSpeed(0); this.closeRing();
        void playMini(kind, (c, v) => this.audio.play(c as Clip, v ?? 1)).then((res) => {
          this.miniBusy = false; this.setSpeed(was);
          if (res === "fail") {
            this.buzz(80);
            if (kind === "pocket") { this.run({ ...opt, action: { ...opt.action!, arg: "botch" }, mini: true } as Option); return; }
            if (kind === "hotwire") { this.audio.play("car_alarm" as Clip, 0.7); this.hint("Wrong wires. The alarm's going off. Have another go."); return; }
            this.hint(kind === "pour" ? "You've poured half of it down your front. Steady hands. Again." : "The bolt won't shift. Have another go.");
            return;
          }
          this.run({ ...opt, action: res === "win" && kind === "pocket" ? { ...opt.action!, arg: "clean" } : opt.action, mini: true } as Option);
        });
        return;
      }
    }
    if (opt.sheet?.kind === "scope") { this.enterScope(); return; }
    if (opt.sheet?.kind === "phone") { this.openPhone(); return; }
    if (opt.sheet) { const k = opt.sheet.kind; k === "shop" ? this.openShop(opt.sheet.who, true) : k === "bet" ? (this.greet(opt.sheet.who), this.openBet()) : k === "report" ? this.openReport() : k === "loot" ? this.openLoot(opt.sheet.who) : this.openBribe(opt.sheet.who); return; }
    if (opt.action) {
      const before = this.pc.seated;
      const r = dispatch(this.w, opt.action);
      if (!r.ok && r.reason === "out of action" && (opt.action.verb === "strike" || opt.action.verb === "finish")) { this.buffered = { opt, at: performance.now() }; return; }
      if (!r.ok && r.reason) this.hint(r.reason);
      if (this.pc.seated !== before) { this.setZoom(); }
      if (this.sheetKind && this.sheetKind !== "more") this.closeSheet();
    }
  }
  throwNow() {
    const pc = this.pc;
    if (!pc.hand || !this.started) return;
    const ta = (this as any).throwAt as Actor | null;
    const act: Action = { verb: "throw", actor: pc.id, item: pc.hand };
    if (ta) Object.assign(act, aimThrow(pc, ta));
    else { act.dirX = Math.cos(pc.facing); act.dirY = Math.sin(pc.facing); act.dist = 8; }
    const r = dispatch(this.w, act);
    if (!r.ok && r.reason) this.hint(r.reason);
  }

  // ---------- Sheets ----------
  /** Rummaging in the bag, changing, on the phone: the world waits (the speed it was going at comes back after). */
  static readonly PAUSING = new Set(["menu", "bag", "wardrobe", "phone", "jobs"]);
  pausedFrom: number | null = null;
  sheet(kind: string, html: string) {
    this.closeRing();
    if (StadiumScene.PAUSING.has(kind)) { if (this.pausedFrom === null && this.speed !== 0) { this.pausedFrom = this.speed; this.setSpeed(0); } }
    else this.unpauseSheet();
    const el = $("sheet");
    this.sheetKind = kind;
    el.innerHTML = html + `<button class="close" data-close="1">Close</button>`;
    el.hidden = false;
  }
  closeSheet() { $("sheet").hidden = true; this.sheetKind = null; this.unpauseSheet(); }
  unpauseSheet() { if (this.callOn) return; if (this.pausedFrom !== null) { const sp = this.pausedFrom; this.pausedFrom = null; this.setSpeed(sp); } }

  /** How you get into the stands, made obvious (real grounds: big block letters at every vomitory,
   *  a colour per stand, light from the pitch at the end of the tunnel). Each gangway gets a pool of
   *  floodlight spilling onto the concourse, a painted block panel and arrow, and an aisle of steps
   *  running up through the seats. */
  drawWayfinding(g: Phaser.GameObjects.Graphics) {
    const P = this.P, away = this.s.match!.teams[1];
    const awayCol = away.colour === 0xf4f4f4 || away.colour === 0xffffff ? away.colour2 ?? 0x888888 : away.colour;
    const ways: { x: number; y: number; code: string; col: number; dir: "n" | "w" | "e"; aisle: [number, number, number, number] }[] = [
      { x: -22, y: 38.3, code: "S1", col: 0xc8102e, dir: "n", aisle: [-22.8, 28, 1.6, 10] },
      { x: 0, y: 38.3, code: "S2", col: 0xc8102e, dir: "n", aisle: [-0.8, 28, 1.6, 10] },
      { x: 22, y: 38.3, code: "S3", col: 0xc8102e, dir: "n", aisle: [21.2, 28, 1.6, 10] },
      { x: -50.3, y: 0, code: "W", col: 0x1b4fd0, dir: "w", aisle: [-50, -0.8, 9, 1.6] },
      { x: 50.3, y: 0, code: "E", col: awayCol, dir: "e", aisle: [41, -0.8, 9, 1.6] },
    ];
    // Outside: yellow queue lanes painted up to each turnstile and big chevrons pointing in, so the
    // way in reads from across the plaza.
    for (const t of SPOTS.turnstiles) {
      g.fillStyle(0xf2c94c, 0.85);
      g.fillRect(...P.rect(t.x - 1.3, 45.2, 0.12, 4.6)); g.fillRect(...P.rect(t.x + 1.18, 45.2, 0.12, 4.6));
      for (let k = 0; k < 3; k++) {
        const cy = 46.2 + k * 1.25;
        g.fillTriangle(P.sx(t.x, cy), P.sy(t.x, cy), P.sx(t.x - 0.7, cy + 0.7), P.sy(t.x - 0.7, cy + 0.7), P.sx(t.x + 0.7, cy + 0.7), P.sy(t.x + 0.7, cy + 0.7));
        g.fillStyle(0x3a3d42, 1).fillTriangle(P.sx(t.x, cy + 0.35), P.sy(t.x, cy + 0.35), P.sx(t.x - 0.45, cy + 0.8), P.sy(t.x - 0.45, cy + 0.8), P.sx(t.x + 0.45, cy + 0.8), P.sy(t.x + 0.45, cy + 0.8));
        g.fillStyle(0xf2c94c, 0.85);
      }
    }
    for (const wy of ways) {
      // The aisle: bare concrete steps up through the seats.
      const [ax, ay, aw, ah] = wy.aisle;
      g.fillStyle(0x8d9096, 1).fillRect(...P.rect(ax, ay, aw, ah));
      g.fillStyle(0x5d6066, 1);
      if (aw < ah) for (let y = ay + 0.55; y < ay + ah; y += 1.1) g.fillRect(...P.rect(ax, y, aw, 0.12));
      else for (let x = ax + 0.55; x < ax + aw; x += 1.1) g.fillRect(...P.rect(x, ay, 0.12, ah));
      g.fillStyle(0xf2c94c, 0.9);
      if (aw < ah) { g.fillRect(...P.rect(ax, ay, 0.1, ah)); g.fillRect(...P.rect(ax + aw - 0.1, ay, 0.1, ah)); }
      else { g.fillRect(...P.rect(ax, ay, aw, 0.1)); g.fillRect(...P.rect(ax, ay + ah - 0.1, aw, 0.1)); }
      // Floodlight from the pitch, spilling out of the gangway.
      const lx = wy.dir === "n" ? wy.x : wy.x + (wy.dir === "w" ? -1.6 : 1.6), ly = wy.dir === "n" ? wy.y + 1.4 : wy.y;
      const im = this.add.image(Math.round(P.sx(lx, ly)), Math.round(P.sy(lx, ly)), "glow").setDepth(0.62).setTint(0xeaffd8).setBlendMode(Phaser.BlendModes.ADD);
      im.setDisplaySize((wy.dir === "n" ? 7 : 5) * P.S, (wy.dir === "n" ? 4 : 8) * P.S).setAlpha(1);
      const im2 = this.add.image(im.x, im.y, "glow").setDepth(0.62).setTint(0xfff6d0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(im.displayWidth * 0.6, im.displayHeight * 0.6);
      this.groundTiles.push(im2 as unknown as Phaser.GameObjects.TileSprite);
      this.groundTiles.push(im as unknown as Phaser.GameObjects.TileSprite);
      // A painted block panel on the concourse floor, and chevrons pointing the way in.
      const px = wy.dir === "n" ? wy.x : wy.x + (wy.dir === "w" ? -2.6 : 2.6), py = wy.dir === "n" ? wy.y + 2.9 : wy.y;
      g.fillStyle(0x000000, 0.5).fillRect(...P.rect(px - 1.85, py - 0.85, 3.7, 1.7));
      g.fillStyle(wy.col, 0.95).fillRect(...P.rect(px - 1.75, py - 0.75, 3.5, 1.5));
      this.labels.push(this.add.text(P.sx(px, py), P.sy(px, py), wy.code, { fontFamily: '"Silkscreen", "Pixelify Sans", monospace', fontSize: "22px", fontStyle: "800", color: "#ffffff" } as Phaser.Types.GameObjects.Text.TextStyle)
        .setOrigin(0.5).setResolution(Math.ceil(DPR * 2)).setDepth(1).setShadow(2, 2, "#000000", 0, false, true).setScale(1.3));
      g.fillStyle(0xffffff, 0.75);
      for (let k = 0; k < 2; k++) {
        if (wy.dir === "n") { const cy = py + 1.3 + k * 0.9; g.fillTriangle(P.sx(px - 0.7, cy), P.sy(px, cy + 0.45), P.sx(px + 0.7, cy), P.sy(px, cy + 0.45), P.sx(px, cy), P.sy(px, cy - 0.2)); }
        else { const s2 = wy.dir === "w" ? 1 : -1, cx = px + s2 * (1.9 + k * 0.9); g.fillTriangle(P.sx(cx + s2 * 0.45, py - 0.7), P.sy(0, py - 0.7), P.sx(cx + s2 * 0.45, py + 0.7), P.sy(0, py + 0.7), P.sx(cx - s2 * 0.2, py), P.sy(0, py)); }
      }
    }
    // What's where, along the concourse.
    const big = (t: string, x: number, y: number) => this.labels.push(this.add.text(P.sx(x, y), P.sy(x, y), t, { fontFamily: '"Silkscreen", "Pixelify Sans", monospace', fontSize: "13px", fontStyle: "800", color: "#ffffff", letterSpacing: 1.5 } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5).setAlpha(0.8).setResolution(Math.ceil(DPR * 2)).setDepth(1));
    big("SOUTH STAND  ▲  BLOCKS S1 · S2 · S3", -11, 43.4);
    big(`AWAY · ${away.name.toUpperCase()}`, 53, 5.2);
    big("WEST END", -53, 5.2);
  }

  /** The radar: walls and stewards within 26 m, their eyelines, you in the middle. Under it, the heat. */
  radarUntil = 0;
  drawRadar() {
    const box = $("radarBox"), pc = this.pc, s = this.s, st = s.stadium!;
    // Only while somebody's after you (and a few seconds after): otherwise it's one more thing on screen.
    const hot = (st.flags.heatMode ?? 0) > 0 || !!st.detainedUntil || this.instinct;
    if (hot) this.radarUntil = performance.now() + 4000;
    const hide = !this.started || this.inCab() || !!this.fp?.on || !$("stall").hidden || performance.now() > this.radarUntil;
    if (box.hidden !== hide) box.hidden = hide;
    if (hide || !pc) return;
    // Sit just under the top bar, whatever shape it has wrapped to.
    const topB = $("top").getBoundingClientRect().bottom;
    if (Math.abs(topB + 8 - (this.radarTop ?? 0)) > 1) { this.radarTop = topB + 8; box.style.top = `${this.radarTop}px`; }
    const cv = $("radar") as HTMLCanvasElement, px = Math.round(96 * DPR);
    if (cv.width !== px) { cv.width = cv.height = px; }
    const c = cv.getContext("2d")!, R = px / 2, RANGE = 26, k = R / RANGE;
    const mode = st.flags.heatMode ?? 0;
    const sx = (x: number) => R + (x - pc.x) * k, sy = (y: number) => R + (y - pc.y) * k;
    c.save();
    c.clearRect(0, 0, px, px);
    c.beginPath(); c.arc(R, R, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = mode === 4 ? "#3a0d10" : mode === 3 ? "#3a3008" : "#0d2418"; c.fillRect(0, 0, px, px);
    // Rings.
    c.strokeStyle = "rgba(160,255,190,0.12)"; c.lineWidth = DPR;
    for (const r of [R / 3, (2 * R) / 3]) { c.beginPath(); c.arc(R, R, r, 0, Math.PI * 2); c.stroke(); }
    // Walls.
    c.fillStyle = "rgba(190,230,200,0.55)";
    for (const wl of SOLID) {
      if (wl.prop || wl.x > pc.x + RANGE || wl.x + wl.w < pc.x - RANGE || wl.y > pc.y + RANGE || wl.y + wl.h < pc.y - RANGE) continue;
      c.fillRect(sx(wl.x), sy(wl.y), Math.max(DPR, wl.w * k), Math.max(DPR, wl.h * k));
    }
    // Stewards and police: a dot and a cone where they're looking, coloured by what they're up to.
    for (const id in s.actors) {
      const a = s.actors[id], n = a.npc;
      if (!n || a.hiddenIn || a.dead || !(isSecurityJob(n.job) || n.job === "armed") || Math.abs(a.x - pc.x) > RANGE + 4 || Math.abs(a.y - pc.y) > RANGE + 4) continue;
      const down = a.downUntil > s.tick;
      const hot = n.target === pc.id && (n.mode === "chase" || n.mode === "approach" || n.mode === "escort");
      const col = down ? "#777" : hot ? "#ff3b3b" : n.target === pc.id && n.mode !== "routine" ? "#ffd23f" : n.job === "police" || n.job === "armed" ? "#59a8ff" : "#7dffa8";
      const x = sx(a.x), y = sy(a.y);
      if (!down) {
        const range = (n.job === "pitchsteward" || n.job === "police" ? 22 : 14) * k * 0.55;
        c.fillStyle = col === "#ff3b3b" ? "rgba(255,59,59,0.28)" : col === "#ffd23f" ? "rgba(255,210,63,0.25)" : "rgba(125,255,168,0.16)";
        c.beginPath(); c.moveTo(x, y); c.arc(x, y, range, a.facing - 0.6, a.facing + 0.6); c.closePath(); c.fill();
      }
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 3.2 * DPR, 0, Math.PI * 2); c.fill();
    }
    // Out of sight and they're searching: the zone they're combing, a pulsing ring round where they
    // last saw you (GTA's search area). Get outside it and stay out.
    if (mode === 3) {
      const seen = Object.values(s.actors).map((a) => a.npc?.target === pc.id ? a.npc.lastSeen : undefined).filter((q): q is { x: number; y: number; t: number } => !!q);
      if (seen.length) {
        const lx = seen.reduce((t, q) => t + q.x, 0) / seen.length, ly = seen.reduce((t, q) => t + q.y, 0) / seen.length, pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
        c.strokeStyle = `rgba(255,210,63,${0.5 + 0.4 * pulse})`; c.lineWidth = 2 * DPR; c.setLineDash([4 * DPR, 3 * DPR]);
        c.beginPath(); c.arc(sx(lx), sy(ly), 9 * k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        c.fillStyle = `rgba(255,210,63,${0.08 + 0.06 * pulse})`; c.fill();
      }
    }
    // You.
    c.translate(R, R); c.rotate(pc.facing);
    c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(6 * DPR, 0); c.lineTo(-4 * DPR, 4 * DPR); c.lineTo(-4 * DPR, -4 * DPR); c.closePath(); c.fill();
    c.restore();
    // The heat: a label (with the countdown while you're out of sight) and five stars.
    const lbl = $("heatLbl"), heat = st.flags.heat ?? 0;
    const evade = st.flags.evadeUntil ? Math.max(0, (st.flags.evadeUntil - s.tick) / 60) : 0, caution = Math.max(0, ((st.flags.cautionUntil ?? 0) - s.tick) / 60);
    const text = mode === 4 ? "Alert" : mode === 3 ? `Evasion ${evade.toFixed(1)}` : mode === 2 ? `Caution ${Math.ceil(caution)}` : mode === 1 ? "Noticed" : "";
    if (lbl.textContent !== text) lbl.textContent = text;
    const cls = mode === 4 ? "alert" : mode === 3 ? "evasion" : mode === 2 ? "caution" : "";
    if (lbl.className !== cls) lbl.className = cls;
    // How much trouble, in words, not five stars: what they saw you do sets it (the stars' rule).
    const stars = heat ? `<b class="lv${Math.min(4, heat)}">${heat >= 5 ? "Armed police" : heat === 4 ? "Major incident" : heat === 3 ? "Incident" : heat === 2 ? "Trouble" : "Mischief"}</b>` : "";
    if (this.starsHtml !== stars) { this.starsHtml = stars; $("stars").innerHTML = stars; }
    // Like GTA's: no stars on screen until you're wanted.
    const hb = $("heat"); if (hb.hidden !== (!heat && !text)) hb.hidden = !heat && !text;
  }
  radarTop?: number;
  starsHtml = "";

  /** The person under a point on the ground (in metres), standing or down. */
  personAt(gx: number, gy: number): Actor | null {
    let best: Actor | null = null, bd = 1.9;
    for (const id in this.s.actors) {
      const a = this.s.actors[id];
      if (a.id === this.pc.id || a.hiddenIn || a.npc?.job === "dog") continue;
      const d = Math.hypot(a.x - gx, a.y - gy);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  personItems: { label: string; kind: string; item?: string; arg?: string; id: string }[] = [];

  /** Tapped someone: everything you could do to them, whatever's in your pockets. Pick one and he walks over and does it. */
  /** Tapped someone: a ring of icon buttons round them. Attack does the sensible thing (what's in your
   *  hand; a choke if he's turned away; else a punch); hold it for the variations: punch, haymaker,
   *  takedown, any weapon in your pockets. Down people get pockets, drag, stamp, radio, knife work. */
  ring: { id: string; items: RingItem[]; sub: boolean } | null = null;
  openPerson(id: string, sub = false, all = false) {
    const s = this.s, pc = this.pc, a = s.actors[id];
    if (!a || !pc || !this.started) return;
    // Watching from the stands: a footballer's card, not a menu.
    if (a.fb && pc.seated) { this.playerCard(a); return; }
    const down = incapacitated(this.w, a), out: RingItem[] = [];
    const n = a.npc, mine = [pc.hand, ...pc.pockets].filter((x): x is string => !!x).map((x) => s.items[x]).filter(Boolean);
    const ico = (def: string) => (ICONS.has(def) ? assetURL(`icons/${def}.png`) : "");
    const act = (k: string) => assetURL(`icons/act_${k}.png`);
    if (sub) {
      out.push({ label: "Punch", icon: act("attack"), kind: "punch" }, { label: "Haymaker", icon: act("haymaker"), kind: "haymaker" });
      if (!a.fb) out.push({ label: "Choke", icon: act("takedown"), kind: "takedown" });
      for (const it of mine) if (hasProp(it, "weapon")) out.push({ label: hasProp(it, "sharp") ? "Stab" : it.def === "bottle" || it.def === "pint_glass" ? "Glass" : it.def === "chair" ? "Chair" : itemName(it).split(" ").slice(-1)[0], icon: ico(it.def), kind: "weapon", item: it.id });
      out.push({ label: "Back", icon: "", glyph: "‹", kind: "back" });
    } else if (!down) {
      // A shopkeeper's first thing is the shop (whatever they've got to tell you, they tell you over
      // the counter), so Buy is the big button and there's no separate Talk.
      out.push({ label: "Attack", icon: act("attack"), kind: "attack", main: !n?.shop });
      if (n && n.job !== "player" && n.job !== "official" && !n.shop) out.push({ label: "Talk", icon: act("talk"), kind: "talk" });
      if (n && n.job !== "player" && n.job !== "official" && !n.shop) out.push({ label: "Pickpocket", icon: act("pickpocket"), kind: "pickpocket" });
      const why = bribeWhy(this.w, pc, a);
      if (pc.money > 0 && why) out.push({ label: why === "snitch" ? "Pay off" : why === "ticket" ? "Buy ticket" : "Bribe", icon: act("money"), kind: "bribe" });
      if (pc.hand && (hasProp(s.items[pc.hand], "throwable") || defOf(s.items[pc.hand]).size === "small")) out.push({ label: "Throw", icon: act("throw"), kind: "throw" });
    } else {
      if (!a.splat) out.push({ label: "Stamp", icon: act("stamp"), kind: "stamp", main: true });
      out.push({ label: "Search", icon: act("search"), kind: "loot" }, { label: "Drag", icon: act("drag"), kind: "drag" });
      if (hasRadio(this.w, pc)) out.push({ label: "Radio", icon: ico("radio"), kind: "radio" });
      if (a.dead && mine.some((it) => hasProp(it, "sharp"))) out.push({ label: "Face", icon: ico("face"), kind: "flay", arg: "face" }, { label: "Hands", icon: ico("hands"), kind: "flay", arg: "hands" });
    }
    // Everything else you could do to them (the dog, a ticket to show, something to give or plant,
    // a shop, a bet, an arrest): worked out as if you were stood next to them.
    if (!sub) for (const o of this.optionsFor(a)) {
      if (n?.shop && !down && (o.label === "Buy" || o.label === "Bet")) { out.unshift({ ...o, main: !out.some((x) => x.main && x.kind === "opt") }); continue; }
      out.push(o);
    }
    if (n?.shop && !down && !out.some((x) => x.main)) out[0].main = true;
    // The best few, not everything (touch the world first, choose verbs second): the most relevant
    // thing is the big one (Buy at a shop, a ticket at the gate, otherwise Talk; Attack only when
    // there's a fight on), three more round it, and "…" for the rest.
    if (!sub && !down && !all && out.length > 4) {
      const fight = this.fightOn();
      const score = (x: RingItem) => x.kind === "opt" ? (n?.shop && (x.label === "Buy" || x.label === "Bet") ? 95 : 48 + (x.opt?.priority ?? 0) / 10)
        : x.kind === "attack" ? (fight ? 100 : 30) : x.kind === "talk" ? 60 : x.kind === "bribe" ? 46 : x.kind === "pickpocket" ? 26 : x.kind === "throw" ? (fight ? 40 : 18) : 20;
      const ranked = out.map((x) => ({ x, sc: score(x) })).sort((p1, p2) => p2.sc - p1.sc).map((r) => r.x);
      for (const x of ranked) x.main = false;
      ranked[0].main = true;
      out.length = 0;
      out.push(...ranked.slice(0, 4), { label: "More", icon: "", glyph: "…", kind: "more" });
    } else if (!sub && !down && !all && !this.fightOn()) {
      // Few enough to show them all; still, Talk leads unless it's a fight.
      const t = out.find((x) => x.kind === "talk"), att = out.find((x) => x.kind === "attack");
      if (t && att?.main) { att.main = false; t.main = true; }
    }
    this.closeRing();
    this.ring = { id, items: out, sub };
    const el = document.createElement("div"); el.id = "ring";
    const who = document.createElement("div"); who.className = "who";
    who.textContent = `${personName(a)}${a.dead ? " · dead" : down ? " · out cold" : ""}${this.pursue && !sub ? " · then…" : ""}`;
    const meter = document.createElement("i"); meter.className = "eye"; who.appendChild(meter);
    el.appendChild(who);
    out.forEach((it, i) => {
      const b = document.createElement("button");
      b.className = `rb${it.main ? " main" : ""}${it.kind === "attack" ? " atk" : ""}`;
      b.innerHTML = `${it.icon ? `<img src="${it.icon}" alt="">` : `<b style="font:800 26px/1 var(--display);color:#fff">${it.glyph ?? "?"}</b>`}<span>${esc(it.label)}</span>`;
      b.style.animationDelay = `${i * 18}ms`;
      // A tap does it; holding the main Attack fans out the variations.
      let held = 0, timer = 0;
      b.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        held = performance.now();
        if (it.kind === "attack") timer = window.setTimeout(() => { b.classList.add("charging"); this.audio.play("tap", 0.6); this.openPerson(id, true); }, 320);
      });
      b.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        clearTimeout(timer);
        if (!held || !this.ring || this.ring.id !== id || this.ring.items !== out) return;
        held = 0;
        this.audio.play("tap", 0.6);
        if (it.kind === "back") { this.openPerson(id); return; }
        if (it.kind === "more") { this.openPerson(id, false, true); return; }
        this.closeRing();
        if (it.kind === "opt") { this.setPursue({ id, kind: "opt", opt: it.opt, until: performance.now() + 15000, path: [], pathAt: 0 }); this.picked = id; return; }
        this.choosePerson({ id, kind: it.kind === "attack" ? this.smartAttack(a).kind : it.kind, item: it.kind === "attack" ? this.smartAttack(a).item : it.item, arg: it.arg });
      });
      b.addEventListener("pointercancel", () => clearTimeout(timer));
      el.appendChild(b);
    });
    $("app").appendChild(el);
    this.placeRing();
  }

  /** The context actions aimed at this person that the ring doesn't already have. */
  optionsFor(a: Actor): RingItem[] {
    const pc = this.pc, save = { x: pc.x, y: pc.y, f: pc.facing };
    pc.x = a.x + Math.cos(a.facing) * 1.1; pc.y = a.y + Math.sin(a.facing) * 1.1; pc.facing = a.facing + Math.PI;
    let opts: Option[] = [];
    try { opts = options(this.w, pc, a.id); } finally { pc.x = save.x; pc.y = save.y; pc.facing = save.f; }
    const DONE = new Set(["strike", "talk", "pickpocket", "finish", "drag", "radio", "flay"]);
    const act = (k: string) => assetURL(`icons/act_${k}.png`), ico = (def: string) => (ICONS.has(def) ? assetURL(`icons/${def}.png`) : "");
    const out: RingItem[] = [];
    for (const o of opts) {
      const tgt = o.action?.target?.k === "actor" ? o.action.target.id : o.sheet?.who;
      if (tgt !== a.id) continue;
      if (o.action && DONE.has(o.action.verb)) continue;
      if (o.sheet && (o.sheet.kind === "bribe" || o.sheet.kind === "loot")) continue;
      const v = o.action?.verb ?? o.sheet!.kind, it = o.action?.item ? this.s.items[o.action.item] : undefined;
      const [label, icon] =
        v === "sic" ? ["Set dog", act("dog")] : v === "give" ? ["Give", it ? ico(it.def) || act("give") : act("give")] : v === "plant" ? ["Plant", it ? ico(it.def) || act("pickpocket") : act("pickpocket")]
        : v === "show" ? ["Ticket", ico("ticket")] : v === "servicedog" ? ["Service dog", act("dog")] : v === "colleague" ? ["Vest", ico("hivis")] : v === "arrest" ? ["Arrest", act("cuffs")]
        : v === "lech" ? ["Leer", act("lech")] : v === "shop" ? ["Buy", act("coin")] : v === "bet" ? ["Bet", ico("betslip")] : v === "report" ? ["Tip off", ico("police_hat")]
        : v === "rule" ? ["Ruling", ico("whistle")] : v === "threaten" ? ["Lean on", act("haymaker")] : [o.label.split(" ").slice(0, 2).join(" "), ""];
      out.push({ label, icon, kind: "opt", opt: o, glyph: label.slice(0, 1) });
    }
    return out;
  }

  /** The sensible blow: whatever's in your hand; a choke if he's turned away from you; else a punch. */
  smartAttack(a: Actor): { kind: string; item?: string } {
    const pc = this.pc, held = pc.hand ? this.s.items[pc.hand] : undefined;
    if (held && hasProp(held, "weapon")) return { kind: "weapon", item: held.id };
    const away = Math.cos(Math.atan2(pc.y - a.y, pc.x - a.x) - a.facing) < 0.25;
    return { kind: !a.fb && away ? "takedown" : "punch" };
  }

  closeRing() { document.getElementById("ring")?.remove(); this.ring = null; }

  /** Keep the ring round them as they move (and on screen). */
  placeRing() {
    const r = this.ring, el = document.getElementById("ring");
    if (!r || !el) return;
    const a = this.s.actors[r.id];
    if (!a || a.hiddenIn) { this.closeRing(); return; }
    const cam = this.cameras.main, P = this.P, rect = this.game.canvas.getBoundingClientRect();
    let x = rect.left + ((P.sx(a.x, a.y) - cam.worldView.x) * cam.zoom) / DPR;
    let y = rect.top + ((P.sy(a.x, a.y) - P.S * 0.9 - cam.worldView.y) * cam.zoom) / DPR;
    // All the actions live in one place, the thumb's corner, whatever you picked: the main one exactly
    // where the big button sits, the rest fanned out up and to the left of it. Only the name stays over
    // the person, so you can see who you've picked.
    const lefty = document.body.classList.contains("lefty");
    const ab = $("act").getBoundingClientRect();
    const ax = ab.width ? ab.left + ab.width / 2 : lefty ? 96 : window.innerWidth - 96;
    const ay = ab.height ? ab.top + ab.height / 2 : window.innerHeight - 150;
    const kids = [...el.querySelectorAll<HTMLElement>(".rb")];
    const mainB = kids.find((b) => b.classList.contains("main")) ?? kids[0], rest = kids.filter((b) => b !== mainB);
    if (mainB) { mainB.style.left = `${Math.round(ax)}px`; mainB.style.top = `${Math.round(ay)}px`; }
    rest.forEach((b, i) => {
      // A quarter circle from beside the main button round to above it; a second, wider arc if there are lots.
      const ring2 = i >= 3, k = ring2 ? i - 3 : i, m = ring2 ? rest.length - 3 : Math.min(3, rest.length);
      const rad = ring2 ? 215 : 128, t = m <= 1 ? 0.5 : k / (m - 1);
      const ang = Math.PI + t * (Math.PI / 2);
      const dx = Math.cos(ang) * rad * (lefty ? -1 : 1), dy = Math.sin(ang) * rad;
      b.style.left = `${Math.round(ax + dx)}px`; b.style.top = `${Math.round(ay + dy)}px`;
    });
    const who = el.querySelector<HTMLElement>(".who")!;
    const meter = who.querySelector<HTMLElement>(".eye");
    if (meter) meter.style.width = `${Math.round(this.eyeMeter * 100)}%`;
    x = Math.max(70, Math.min(window.innerWidth - 70, x));
    y = Math.max(110, Math.min(window.innerHeight - 220, y));
    who.style.left = `${Math.round(x)}px`; who.style.top = `${Math.round(y - 34)}px`;
  }

  /** Already on his way to do something: this one's next (and only this one). */
  setPursue(p: NonNullable<typeof this.pursue>) {
    if (this.pursue && this.pursue.id !== p.id && performance.now() < this.pursue.until) {
      this.nextPursue = { ...p, until: p.until + 15000 };
      this.hint(`Then: ${p.kind === "opt" ? p.opt?.label ?? "that" : p.kind} ${personName(this.s.actors[p.id])}.`);
    } else { this.pursue = p; this.nextPursue = null; }
  }

  choosePerson(m: { kind: string; item?: string; arg?: string; id: string }) {
    if (m.kind === "throw") { this.picked = m.id; (this as any).throwAt = this.s.actors[m.id]; this.throwNow(); return; }
    if (m.kind === "bribe" && Math.hypot(this.s.actors[m.id].x - this.pc.x, this.s.actors[m.id].y - this.pc.y) < 2.2) { this.openBribe(m.id); return; }
    this.setPursue({ id: m.id, kind: m.kind, item: m.item, arg: m.arg, until: performance.now() + 15000, path: [], pathAt: 0 });
    this.picked = m.id;
  }

  // ---------- Using things: tap the thing (quick slot, or Use… in the bag), then tap where ----------
  useMode: { item: string; until: number } | null = null;
  pendingUse: { item: string; x: number; y: number; until: number } | null = null;
  startUse(id: string) {
    const s = this.s, pc = this.pc, it = s.items[id];
    if (!it || !pc) return;
    if (pc.hand !== id) dispatch(this.w, { verb: "hold", actor: pc.id, item: id });
    this.closeRing();
    this.useMode = { item: id, until: performance.now() + 15000 };
    const el = $("useBanner");
    el.innerHTML = `${icon(it.def)}<span>Tap where to use the ${esc(itemName(it).toLowerCase())}</span><button data-nouse="1" aria-label="Cancel">✕</button>`;
    el.hidden = false;
    this.audio.play("tap", 0.5);
  }
  endUse() { this.useMode = null; $("useBanner").hidden = true; }
  /** Where they tapped, with the thing in hand: a person gets what that thing does to them (given,
   *  planted, shown, spiked); a place, he walks there and uses it; a missile flies there. */
  useAt(gx: number, gy: number, who: Actor | null) {
    const u = this.useMode!, s = this.s, it = s.items[u.item], now = performance.now();
    this.endUse();
    if (!it || it.loc.k === "gone") return;
    if (who && who.id !== this.pc.id) {
      const o = this.optionsFor(who).find((x) => x.kind === "opt" && x.opt?.action?.item === it.id);
      if (o?.opt) { this.setPursue({ id: who.id, kind: "opt", opt: o.opt, until: now + 15000, path: [], pathAt: 0 }); this.picked = who.id; return; }
      if (hasProp(it, "food") && s.stadium!.dog) { this.pendingUse = { item: it.id, x: who.x, y: who.y, until: now + 20000 }; this.setWalk(who.x, who.y); return; }
      if (hasProp(it, "throwable") || defOf(it).size === "small") { this.picked = who.id; (this as any).throwAt = who; this.throwNow(); return; }
      this.hint(`Nothing to do to them with the ${itemName(it).toLowerCase()}.`); return;
    }
    this.pendingUse = { item: it.id, x: gx, y: gy, until: now + 20000 };
    this.setWalk(gx, gy);
  }
  /** On the way to use something: once there (or within throwing distance of it), do it. */
  stepUse(): boolean {
    const u = this.pendingUse!, pc = this.pc, s = this.s, it = s.items[u.item], now = performance.now();
    if (!it || it.loc.k === "gone" || now > u.until || pc.heldBy) { this.pendingUse = null; return false; }
    const d = Math.hypot(u.x - pc.x, u.y - pc.y);
    const MISSILE = new Set(["brick", "fart_can", "flare", "bottle", "pint_glass"]);
    if (MISSILE.has(it.def) && d < 11 && d > 2.2) {
      this.walkTo = null; this.pendingUse = null; pc.moveX = pc.moveY = 0;
      if (pc.hand !== it.id) dispatch(this.w, { verb: "hold", actor: pc.id, item: it.id });
      const r = dispatch(this.w, { verb: "throw", actor: pc.id, item: it.id, dirX: (u.x - pc.x) / d, dirY: (u.y - pc.y) / d, dist: d });
      if (!r.ok && r.reason) this.hint(r.reason);
      return true;
    }
    if (this.walkTo && d > 1.6) { this.stepWalk(); return true; }
    this.walkTo = null; this.pendingUse = null; pc.moveX = pc.moveY = 0;
    const opts = options(this.w, pc, null);
    const fits = (o: Option) => !!o.action && (o.action.item === it.id || (o.action.verb === "smashwindow" && MISSILE.has(it.def)) || (o.action.verb === "drain" && it.def === "wrench"));
    const o = opts.find((x) => x.priority > 0 && fits(x)) ?? opts.find(fits);
    if (o) { this.run(o); return true; }
    if (hasProp(it, "food")) { dispatch(this.w, { verb: "drop", actor: pc.id, item: it.id }); return true; }
    if (MISSILE.has(it.def)) { dispatch(this.w, { verb: "throw", actor: pc.id, item: it.id, dirX: Math.cos(pc.facing), dirY: Math.sin(pc.facing), dist: 6 }); return true; }
    this.hint(`Nothing to use the ${itemName(it).toLowerCase()} on here.`);
    return true;
  }

  /** Tapped the ground: walk there, round whatever's in the way. */
  walkTo: { x: number; y: number; path: number[]; pathAt: number; until: number; blocked?: boolean } | null = null;
  setWalk(gx: number, gy: number) {
    if (!this.pc || this.inCab() || this.pc.heldBy) return;
    this.pursue = null; this.nextPursue = null;
    this.walkTo = { x: gx, y: gy, path: [], pathAt: 0, until: performance.now() + 20000 };
    this.audio.play("tap", 0.35);
  }
  stepWalk() {
    const wt = this.walkTo!, pc = this.pc, now = performance.now();
    if (pc.seated) { dispatch(this.w, { verb: "stand", actor: pc.id }); this.setZoom(); }
    const d = Math.hypot(wt.x - pc.x, wt.y - pc.y);
    if (pc.heldBy || pc.hiddenIn || now > wt.until || d < 0.45 || (wt.blocked && now - wt.pathAt > 700)) { this.walkTo = null; pc.moveX = pc.moveY = 0; return; }
    if (now - wt.pathAt > 600 || !wt.path.length) {
      wt.path = findPath(pc.x, pc.y, wt.x, wt.y); wt.pathAt = now;
      // No way through (a wall, a locked door): show it in red and stop.
      const end = wt.path.length >= 2 ? Math.hypot(wt.path[wt.path.length - 2] - wt.x, wt.path[wt.path.length - 1] - wt.y) : d;
      if ((!wt.path.length && d > 2) || end > 2.5) { wt.blocked = true; pc.moveX = pc.moveY = 0; return; }
    }
    while (wt.path.length > 2 && Math.hypot(wt.path[0] - pc.x, wt.path[1] - pc.y) < 0.5) wt.path.splice(0, 2);
    const tx = wt.path.length >= 2 && d > 1.2 ? wt.path[0] : wt.x, ty = wt.path.length >= 2 && d > 1.2 ? wt.path[1] : wt.y;
    const dx = tx - pc.x, dy = ty - pc.y, l = Math.hypot(dx, dy) || 1, mag = d > 8 ? 1 : 0.85;
    pc.moveX = (dx / l) * mag; pc.moveY = (dy / l) * mag;
  }
  /** A tap on the screen (CSS px) as a point on the ground. */
  groundAt(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.game.canvas.getBoundingClientRect(), cam = this.cameras.main, P = this.P;
    const wx = cam.worldView.x + ((clientX - rect.left) * DPR) / cam.zoom, wy = cam.worldView.y + ((clientY - rect.top) * DPR) / cam.zoom;
    return { x: wx / P.S, y: wy / (P.K * P.S) };
  }

  /** Walk to them (round the back, for a takedown) and, once close enough, do it. */
  stepPursue() {
    const p = this.pursue!, pc = this.pc, s = this.s, t = s.actors[p.id];
    if (pc.seated) { dispatch(this.w, { verb: "stand", actor: pc.id }); this.setZoom(); }
    const stop = (why?: string) => { this.pursue = null; pc.moveX = pc.moveY = 0; if (why) this.hint(why); };
    if (!t || t.hiddenIn || performance.now() > p.until || pc.heldBy || pc.hiddenIn) return stop(t && !t.hiddenIn && performance.now() > p.until ? "Couldn't get to them." : undefined);
    const down = incapacitated(this.w, t);
    if (["takedown", "punch", "haymaker", "weapon", "talk", "pickpocket", "bribe"].includes(p.kind) && down) return stop();
    // An action from the ring's extras: do it as soon as it's possible from where you stand.
    if (p.kind === "opt" && p.opt) {
      const o = p.opt;
      let can = !!o.sheet && Math.hypot(t.x - pc.x, t.y - pc.y) < (t.npc?.shop ? 3.6 : 2.4);
      if (o.action) { const { verb, ...rest } = o.action; can = possibleVerbs(this.w, rest).includes(verb); }
      if (can) { pc.moveX = pc.moveY = 0; this.pursue = null; this.run(o); return; }
    }
    const reach = p.kind === "opt" ? 1.3 : p.kind === "talk" ? 2.6 : p.kind === "radio" ? 11 : p.kind === "bribe" ? 2 : ["loot", "drag", "stamp", "flay"].includes(p.kind) ? 1.4 : 1.25;
    const d = Math.hypot(t.x - pc.x, t.y - pc.y);
    const sneak = p.kind === "takedown";
    // Behind him, near enough (the strike forgives a half turn, so this does too).
    const behind = Math.cos(Math.atan2(pc.y - t.y, pc.x - t.x) - t.facing) < 0.1;
    const ready = d <= reach && (!sneak || behind);
    if (ready) {
      pc.moveX = pc.moveY = 0;
      if (p.item && pc.hand !== p.item) {
        if (!s.items[p.item] || s.items[p.item].loc.k === "gone") return stop("You haven't got it any more.");
        dispatch(this.w, { verb: "hold", actor: pc.id, item: p.item });
      }
      const target = { k: "actor" as const, id: t.id }, base = { actor: pc.id, target };
      const act: Action | null =
        p.kind === "takedown" ? { verb: "strike", ...base, arg: "takedown" } :
        p.kind === "punch" || p.kind === "weapon" ? { verb: "strike", ...base } :
        p.kind === "haymaker" ? { verb: "strike", ...base, arg: "haymaker" } :
        p.kind === "talk" ? { verb: "talk", ...base } :
        p.kind === "pickpocket" ? { verb: "pickpocket", ...base } :
        p.kind === "drag" ? { verb: "drag", ...base } :
        p.kind === "stamp" ? { verb: "finish", ...base } :
        p.kind === "radio" ? { verb: "radio", ...base } :
        p.kind === "flay" ? { verb: "flay", ...base, arg: p.arg, item: pc.hand ?? undefined } : null;
      this.pursue = null;
      if (p.kind === "loot") { this.openLoot(t.id); return; }
      if (p.kind === "bribe") { this.openBribe(t.id); return; }
      if (act) this.run({ label: "", priority: 1, action: act });
      return;
    }
    // Where to stand: next to them, or right behind them for a takedown. Close in but in front:
    // circle round him rather than walking into his face.
    let gx = sneak ? t.x - Math.cos(t.facing) * 0.75 : t.x, gy = sneak ? t.y - Math.sin(t.facing) * 0.75 : t.y;
    // Someone behind a counter: you're served from the customer's side, not round the back.
    if (t.npc?.shop && t.npc.post && !sneak) { const fc = t.npc.face ?? t.facing; gx = t.npc.post.x + Math.cos(fc) * 2.9; gy = t.npc.post.y + Math.sin(fc) * 2.9; }
    if (sneak && d < 2.4 && !behind) {
      const at = Math.atan2(pc.y - t.y, pc.x - t.x), want = t.facing + Math.PI;
      const turn = Math.atan2(Math.sin(want - at), Math.cos(want - at));
      const a2 = at + Math.sign(turn || 1) * Math.min(Math.abs(turn), 0.9);
      gx = t.x + Math.cos(a2) * 1.15; gy = t.y + Math.sin(a2) * 1.15;
    }
    const now = performance.now();
    if (now - p.pathAt > 400 || !p.path.length) { p.path = findPath(pc.x, pc.y, gx, gy); p.pathAt = now; }
    while (p.path.length > 2 && Math.hypot(p.path[0] - pc.x, p.path[1] - pc.y) < 0.5) p.path.splice(0, 2);
    const tx = p.path.length >= 2 && Math.hypot(gx - pc.x, gy - pc.y) > 1.5 ? p.path[0] : gx, ty = p.path.length >= 2 && Math.hypot(gx - pc.x, gy - pc.y) > 1.5 ? p.path[1] : gy;
    const dx = tx - pc.x, dy = ty - pc.y, l = Math.hypot(dx, dy) || 1;
    // A run when far off, a walk for the last few metres.
    const mag = d > 5 ? 1 : 0.85;
    pc.moveX = (dx / l) * mag; pc.moveY = (dy / l) * mag;
  }

  openMore() {
    const opts = this.opts.filter((o) => o.action || o.sheet);
    const html = `<h2>What do you want to do?</h2><div class="list">${opts.length ? opts.map((o, i) => `<button data-opt="${i}">${esc(o.label)}</button>`).join("") : "<p>Nothing nearby. Walk up to people and things.</p>"}</div>`;
    const prev = $("sheet").innerHTML;
    if (this.sheetKind === "more" && prev.startsWith(html.slice(0, 200)) && prev.includes(html.slice(-60))) return;
    (this as any).moreOpts = opts;
    this.sheet("more", html);
  }

  /** Served: the shopkeeper says their piece as you come to the counter (gossip, a tip, the patter),
   *  the line that a Talk button used to be for. It goes in the shop window as well as over their head. */
  keeperLine: { who: string; text: string } | null = null;
  greet(who?: string): void {
    const a = who ? this.s.actors[who] : undefined;
    if (!a?.npc?.lines?.length || !this.pc) { this.keeperLine = null; return; }
    const r = dispatch(this.w, { verb: "talk", actor: this.pc.id, target: { k: "actor", id: a.id } });
    const text = r.ok ? a.npc.bubble?.text : undefined;
    this.keeperLine = text ? { who: a.id, text } : null;
  }
  keeperHtml(who?: string): string {
    const k = this.keeperLine, a = k ? this.s.actors[k.who] : undefined;
    if (!k || !a || (who && k.who !== who)) return "";
    return `<p class="keeper${isHint(k.text) ? " tip" : ""}"><b>${esc(personName(a))}</b>“${esc(k.text)}”</p>`;
  }
  openShop(who: string, greet = false) {
    if (greet) this.greet(who);
    const seller = this.s.actors[who], shop = SHOPS[seller.npc!.shop!];
    const rows = Object.entries(shop.stock).map(([def, price]) => {
      const poor = this.pc.money < price;
      return `<button class="ware${poor ? " poor" : ""}" data-buy="${def}" data-who="${who}" data-price="${price}">${icon(def)}<span class="nm">${esc(ITEM_DEFS[def].name)}</span><span class="pr">£${price}</span></button>`;
    }).join("");
    // The pawnbroker buys as well as sells: everything you're carrying, with what he'll give for it.
    let sell = "";
    if (seller.npc!.shop === "pawn") {
      const pc = this.pc, mine = [pc.hand, ...pc.pockets, ...Object.values(pc.worn)].filter((x): x is string => !!x).map((id) => this.s.items[id]).filter(Boolean);
      sell = `<h2>Sell</h2><div class="wares">${mine.map((it) => {
        const offer = pawnOffer(it.def);
        return `<button class="ware sell${offer ? "" : " poor"}" data-pawn="${it.id}" data-who="${who}">${icon(it.def)}<span class="nm">${esc(itemName(it))}</span><span class="pr">${offer ? `£${offer}` : "No"}</span></button>`;
      }).join("") || "<p class='dim'>You've nothing he wants. Wallets, passes, phones, shirts: lift some off people.</p>"}</div>`;
    }
    this.sheet("shop", `<h2>${esc(shop.name)}</h2>${this.keeperHtml(who)}<p class="purse">You have <b>£${this.pc.money}</b> · tap something to buy it</p><div class="wares">${rows}</div>${sell}`);
  }

  /** A purchase: the till, the money going down, the thing flying into your bag. */
  bought(btn: HTMLElement, def: string, price: number): void {
    this.audio.play("kaching", 1); this.buzz(25);
    setTimeout(() => this.audio.play("bag", 0.8), 260);
    const money = $("money");
    money.classList.remove("spent"); void money.offsetWidth; money.classList.add("spent");
    const mr = money.getBoundingClientRect(), app = $("app").getBoundingClientRect();
    const minus = document.createElement("div");
    minus.className = "minus"; minus.textContent = `−£${price}`;
    minus.style.left = `${mr.left - app.left + mr.width / 2}px`; minus.style.top = `${mr.bottom - app.top + 4}px`;
    $("app").appendChild(minus); setTimeout(() => minus.remove(), 1100);
    // The icon flies from the shelf to the Bag button.
    const from = (btn.querySelector(".ico") as HTMLElement | null)?.getBoundingClientRect() ?? btn.getBoundingClientRect();
    const to = $("bagBtn").getBoundingClientRect();
    const fly = document.createElement("div");
    fly.className = "fly"; fly.innerHTML = icon(def);
    fly.style.left = `${from.left - app.left}px`; fly.style.top = `${from.top - app.top}px`;
    $("app").appendChild(fly);
    requestAnimationFrame(() => { fly.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(0.5)`; fly.style.opacity = "0.2"; });
    setTimeout(() => { fly.remove(); const bag = $("bagBtn"); bag.classList.remove("bump"); void bag.offsetWidth; bag.classList.add("bump"); }, 520);
    this.toast(def, ITEM_DEFS[def].name);
  }

  /** A short strap: "Bought" with the thing's picture. */
  toast(def: string, name: string, verb = "Bought"): void {
    const t = $("toast");
    t.innerHTML = `${icon(def)}<span><small>${esc(verb)}</small>${esc(name)}</span>`;
    t.hidden = false; t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => { t.hidden = true; }, 1800);
  }
  toastTimer = 0;

  openBet() {
    const book = prices(this.w), pc = this.pc, where = canBetHere(this.w, pc);
    const slips = [pc.hand, ...pc.pockets].filter((x): x is string => !!x).map((id) => this.s.items[id]).filter((it) => it.bet);
    const slipHtml = slips.length ? `<h2>Your slips</h2>${slips.map((it) => {
      const b = it.bet!, label = b.market === "winner" ? "England to go through" : b.market === "pen" ? "a penalty" : b.market === "red" ? "a red card" : b.pick === "NONE" ? "No more goals" : b.pick === "ENG" ? "England next goal" : "Them next goal";
      return `<div class="slip">£${b.stake} on ${esc(label)} at ${b.odds.toFixed(2)}${b.result ? ` · ${b.result === "won" ? `won £${Math.round(b.stake * b.odds)}` : "lost"}` : ""}</div>`;
    }).join("")}` : "";
    if (!book) { this.sheet("bet", `<h2>Betting</h2><p>Betting is suspended.</p>${slipHtml}`); return; }
    const stakes = [10, 20, 50, 100].filter((x) => x <= pc.money);
    const rows = book.map((p) => `<div class="item"><b>${esc(p.label)} <span class="odds">${p.odds.toFixed(2)}</span></b><div class="row">${stakes.map((st) => `<button data-bet="${p.market}:${p.pick}" data-amt="${st}">£${st}</button>`).join("") || "<span class='slip'>No money.</span>"}</div></div>`).join("");
    this.sheet("bet", `<h2>${where === "phone" ? "Betting app" : "Bookmaker"}</h2>${where === "phone" ? "" : this.keeperHtml()}<p>You have £${pc.money}. Settled on the official result only.</p><div class="list">${rows}</div>${slipHtml}`);
  }

  /** Who would you like the police to search? Their players by name, and anyone you can see. */
  openReport() {
    const s = this.s, m = s.match!, pc = this.pc;
    const players = m.teams[1].squad.map((id) => s.actors[id]).filter((a) => a.fb!.status !== "gone");
    const nearby = Object.values(s.actors).filter((a) => a.npc && !a.fb && !a.off && a.npc.job !== "police" && !a.hiddenIn && Math.hypot(a.x - pc.x, a.y - pc.y) < 20).slice(0, 6);
    const btn = (a: Actor, label: string) => `<button data-report="${a.id}">${esc(label)}</button>`;
    this.sheet("report", `<h2>Tip off the police</h2><p>Say someone is carrying something they shouldn't be. If they're clean, the police will remember you.</p>
      <div class="list">${players.map((a) => btn(a, `${a.name}, ${m.teams[1].name} number ${a.fb!.number}${a.fb!.star ? " ★" : ""}`)).join("")}${nearby.map((a) => btn(a, a.name)).join("")}</div>`);
  }

  /** Going through someone's pockets as they lie there: money, what they carry, what they're wearing. */
  openLoot(who: string) {
    const t = this.s.actors[who];
    if (!t) return;
    const items = lootable(this.w, t);
    const rows = items.map((it) => {
      const worn = it.loc.k === "worn";
      return `<button class="ware" data-loot="${it.id}" data-who="${who}">${icon(it.def)}<span class="nm">${esc(itemName(it))}</span><span class="pr">${worn ? "Strip" : "Take"}</span></button>`;
    }).join("");
    this.sheet("loot", `<h2>${esc(personName(t))}${t.dead ? " · dead" : " · out cold"}</h2>
      <div class="wares">${t.money > 0 ? `<button class="ware" data-loot="money" data-who="${who}"><span class="ico none">£</span><span class="nm">Cash</span><span class="pr">£${t.money}</span></button>` : ""}${rows || (t.money ? "" : "<p>Nothing worth having.</p>")}</div>
      ${items.length || t.money ? `<button class="red" data-loot="all" data-who="${who}">Take everything</button>` : ""}`);
  }

  openBribe(who: string) {
    const t = this.s.actors[who];
    const amounts = [10, 20, 50, 100, 200, 400].filter((a) => a <= this.pc.money);
    this.sheet("bribe", `<h2>Offer ${esc(personName(t))} money</h2><p>You have £${this.pc.money}. They might take it. They might not.</p><div class="list">${amounts.map((a) => `<button data-bribe="${a}" data-who="${who}">£${a}</button>`).join("") || "<p>You can't afford anything.</p>"}</div>`);
  }

  // ---------- The look ----------
  /** What the outfit says about you: what it gets you into, who sees through it, how much you stand out. */
  outfitInfo(): { look: string; opens: string[]; watched: string[]; sus: number; perk: string } {
    const s = this.s, pc = this.pc, ap = appearance(s, pc);
    const worn = Object.values(pc.worn).filter((x): x is string => !!x).map((id) => s.items[id]);
    const has = (d: string) => worn.some((it) => it.def === d);
    if (isNaked(pc)) return { look: "Nothing. Not a stitch.", opens: ["The pitch, if you're quick"], watched: ["Everybody", "Every steward", "Every phone camera"], sus: 5, perk: "A very small black bar. Indecent exposure if a steward sees it. Run on the pitch and they stop the match." };
    const look = worn.length ? worn.map((it) => itemName(it)).join(" · ") : "Jeans and the belly";
    const R: Record<string, [string[], string[], number, string]> = {
      steward: [["The stands", "The concourse", "Turnstiles: flash the vest"], ["Stewards who know every face", "Anyone, if you kick off in it"], 2, "Not the pitch, not the changing rooms. Misbehave in it and it's blown."],
      police: [["Most doors", "Arresting people"], ["Real coppers"], 3, "Arrest anyone you like. A real officer will ask which station you're from."],
      referee: [["The pitch", "The tunnel", "The officials' room"], ["The real referee", "The fourth official"], 3, "Blow the whistle and they listen. For a while."],
      footballer: [["The pitch", "The dressing rooms"], ["The manager", "His teammates"], 3, "From a distance, you're one of the lads. Up close, you're very fat."],
      catering: [["The kitchens", "The staff door"], ["The head chef"], 2, "Nobody looks twice at a chef. Nobody looks once."],
      cleaner: [["Service corridors", "The staff door"], ["The other cleaners"], 1, "The best disguise in the building: nobody sees cleaners."],
      mascot: [["Pitchside", "The tunnel"], ["Anyone who saw Lenny go for a fag"], 2, "Nobody can see your face. Kids want a hug."],
      fan: [[ap.team === s.match!.teams[0].short ? "The home end" : ap.team ? "The away end" : "The street", "The concourse, with a ticket"], [ap.team && ap.team !== s.match!.teams[0].short ? "Every England fan you walk past" : "Stewards who've seen your face before"], 1, ""],
      none: [["The street", "The pub"], ["Stewards who've seen your face before"], 1, "Just Grozz. God help us."],
    };
    const [opens, watched, sus0, perk0] = R[ap.role] ?? R.none;
    let sus = sus0, perk = perk0;
    if (has("dress")) { perk = "Nobody looks at your face in a dress. They look at everything else."; }
    if (ap.faceHidden) { sus += 1; watched.push("Turnstile stewards (masks off, please)"); perk = (perk ? perk + " " : "") + "Face hidden: the cameras can't see you."; }
    else if (ap.faceCover >= 0.5) perk = (perk ? perk + " " : "") + "Half your face covered: enough to fool a camera.";
    if (ap.sinister) { sus += 1; perk = "A balaclava. Subtle."; }
    if (ap.grisly) { sus = 5; perk = "Somebody else's face. Up close, people notice."; }
    return { look, opens, watched, sus: Math.max(1, Math.min(5, sus)), perk };
  }

  /** The dressing room: him big in the middle, slowly turning, and everything you've got that goes
   *  on a body laid out under him. Tap to put it on or take it off; the panel stays open, so you can
   *  try things on one after another (the fitting rooms in Hitman and Sims, not a menu per item). */
  mirrorDir = 0;
  mirrorTimer = 0;
  openWardrobe() {
    const pc = this.pc, inf = this.outfitInfo(), s = this.s;
    const mine = [pc.hand, ...pc.pockets, ...Object.values(pc.worn)].filter((x): x is string => !!x).map((id) => s.items[id]).filter((it) => it && defOf(it).slot);
    const tiles = mine.map((it) => {
      const on = it.loc.k === "worn";
      return `<button class="try${on ? " on" : ""}" data-try="${it.id}">${icon(it.def)}<span>${esc(itemName(it))}</span><i>${on ? "Wearing" : "Try on"}</i></button>`;
    }).join("");
    this.sheet("wardrobe", `<h2>The look</h2>
      <div class="mirror"><div class="glass"><canvas id="mirror" width="240" height="300"></canvas><button class="turn l" data-turn="-1">◀</button><button class="turn r" data-turn="1">▶</button></div><div class="spec">
        <b class="lk">${esc(inf.look)}</b>
        <div class="tags">${inf.opens.map((t) => `<span class="op">${esc(t)}</span>`).join("")}</div>
        <small>Watched by</small><div class="tags">${inf.watched.map((t) => `<span class="wt">${esc(t)}</span>`).join("")}</div>
        <div class="sus">Stands out <b>${"●".repeat(inf.sus)}</b>${"○".repeat(5 - inf.sus)}</div>
        ${inf.perk ? `<p>${esc(inf.perk)}</p>` : ""}
      </div></div>
      <div class="tries">${tiles || `<p class="dim">Nothing to put on. The charity shop's got frocks and wigs; the army surplus has the rest.</p>`}</div>
      <div class="row">${pc.naked ? `<button data-wd="dress">Pull your trousers up</button>` : `<button data-wd="strip" class="red">Strip naked</button>`}<button data-wd="bag">Bag</button></div>`);
    this.drawMirror();
    // He turns round slowly, so you see the back of the wig too.
    clearInterval(this.mirrorTimer);
    this.mirrorTimer = window.setInterval(() => {
      if (this.sheetKind !== "wardrobe") { clearInterval(this.mirrorTimer); return; }
      this.mirrorDir = (this.mirrorDir + 1) % 8; this.drawMirror();
    }, 1100);
  }
  tryOn(id: string) {
    const it = this.s.items[id]; if (!it) return;
    const verb = it.loc.k === "worn" ? "remove" : "wear";
    const r = dispatch(this.w, { verb, actor: this.pc.id, item: id });
    if (!r.ok) this.hint(r.reason ?? "Can't."); else this.audio.play("wear", 0.9);
    this.mirrorDir = 0;
    this.openWardrobe();
  }

  /** Grozz, big, as he looks now: the body sprite scaled up, with whatever's on his head drawn over it. */
  drawMirror(tries = 0) {
    const cv = document.getElementById("mirror") as HTMLCanvasElement | null;
    if (!cv) return;
    const pc = this.pc, P = this.P, { base, rc, h } = this.spriteFor(pc), key = this.bank.variant(base, rc), tk = `${key}-rot`;
    if (!this.textures.exists(tk)) { if (tries < 20) setTimeout(() => this.drawMirror(tries + 1), 150); return; }
    const fr = this.textures.getFrame(tk, this.mirrorDir % 8), src = fr.source.image as CanvasImageSource;
    const c = cv.getContext("2d")!, cw = cv.width, ch = cv.height;
    c.clearRect(0, 0, cw, ch);
    // The floor and a spotlight.
    const grd = c.createRadialGradient(cw / 2, ch * 0.9, 10, cw / 2, ch * 0.9, cw * 0.6);
    grd.addColorStop(0, "rgba(255,240,200,0.35)"); grd.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = grd; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(cw / 2, ch * 0.9, cw * 0.22, ch * 0.035, 0, 0, Math.PI * 2); c.fill();
    const scale = P.standing && P.S === PPM ? 1 : (h * P.KZ * P.S) / (FEET - HEAD) * (P.standing ? 1 : 0.7);
    const K = (ch * 0.82) / ((FEET - HEAD) * scale), fx = cw / 2, fy = ch * 0.9;
    c.imageSmoothingEnabled = false;
    const dw = fr.cutWidth * scale * K, dh = fr.cutHeight * scale * K;
    c.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, fx - dw / 2, fy - dh * (feetOf(base) / cellOf(base)), dw, dh);
    // The headwear, through a little stand-in for Phaser's Graphics.
    const ox = P.sx(pc.x, pc.y), oy = P.sy(pc.x, pc.y), X = (x: number) => fx + (x - ox) * K, Y = (y: number) => fy + (y - oy) * K;
    const col = (v: number, a = 1) => `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
    const g: any = {
      fillStyle(v: number, a = 1) { c.fillStyle = col(v, a); return g; },
      lineStyle(wd: number, v: number, a = 1) { c.lineWidth = wd * K; c.strokeStyle = col(v, a); return g; },
      fillRect(x: number, y: number, w: number, hh: number) { c.fillRect(X(x), Y(y), w * K, hh * K); return g; },
      fillEllipse(x: number, y: number, w: number, hh: number) { c.beginPath(); c.ellipse(X(x), Y(y), (w * K) / 2, (hh * K) / 2, 0, 0, Math.PI * 2); c.fill(); return g; },
      fillCircle(x: number, y: number, r: number) { c.beginPath(); c.arc(X(x), Y(y), r * K, 0, Math.PI * 2); c.fill(); return g; },
      fillTriangle(a1: number, b1: number, a2: number, b2: number, a3: number, b3: number) { c.beginPath(); c.moveTo(X(a1), Y(b1)); c.lineTo(X(a2), Y(b2)); c.lineTo(X(a3), Y(b3)); c.closePath(); c.fill(); return g; },
      lineBetween(a1: number, b1: number, a2: number, b2: number) { c.beginPath(); c.moveTo(X(a1), Y(b1)); c.lineTo(X(a2), Y(b2)); c.stroke(); return g; },
    };
    const sitting = pc.seated; pc.seated = false;
    if (this.mirrorDir === 0) try { this.drawHeadwear(g, pc, { ...this.styleOf(pc), down: false }); } finally { pc.seated = sitting; }
    pc.seated = sitting;
    if (isNaked(pc) && this.mirrorDir % 8 !== 4) { const by = Y(P.sy(pc.x, pc.y, 0.47)), q = Math.max(3, Math.round(P.S * 0.045 * K)), sd = this.mirrorDir % 8, side = sd === 2 ? 1 : sd === 6 ? -1 : sd === 1 || sd === 3 ? 0.5 : sd === 7 || sd === 5 ? -0.5 : 0;
      const gg = { fillStyle: (v: number) => { c.fillStyle = col(v); return gg; }, fillRect: (x: number, y: number, w: number, h2: number) => { c.fillRect(x, y, w, h2); return gg; } };
      this.mosaic(gg, fx + side * P.S * 0.06 * K, by, q, Math.abs(side) === 1 ? 2 : 3, 3, Math.floor(performance.now() / 100)); }
  }

  // ---------- The phone ----------
  phoneUse: "own" | "burner" = "own";
  openPhone(use?: "own" | "burner") {
    const pc = this.pc, burner = burnerOn(this.w, pc);
    let u = use ?? (burner ? "burner" : this.phoneUse);
    if (u === "burner" && !burner) u = "own";
    this.phoneUse = u;
    const c = (k: string, name: string, sub: string, cls = "") => `<button class="ct ${cls}" data-ph="${k}"><b>${esc(name)}</b><small>${esc(sub)}</small></button>`;
    const unknown = (["dealer", "boxer"] as const).filter((k) => !knows(this.w, k)).length;
    this.sheet("phone", `<div class="phone">
      <div class="hs">
        <button data-hs="own" class="${u === "own" ? "on" : ""}"><b>Your phone</b><small>In your name. Hoaxes get traced.</small></button>
        <button data-hs="burner" class="${u === "burner" ? "on" : ""}" ${burner ? "" : "disabled"}><b>Burner</b><small>${burner ? "Untraceable. A hoax snaps the SIM." : "You haven't got one."}</small></button>
      </div>
      <div class="cts">
        ${c("police", "999 · Police", "Tip them off about someone")}
        ${c("bomb", "999 · Bomb threat", this.s.match!.phase === "pre" ? "Holds the kick-off" : "Stops the match", "red")}
        ${c("wife", "Shezleigh", "The wife")}
        ${knows(this.w, "dealer") ? c("dealer", "Spliff Ricky", "He comes to you") : ""}
        ${knows(this.w, "boxer") ? c("boxer", "Bare-Knuckle Brendan", `£${BOXER_FEE} and he flattens anyone`) : ""}
        ${unknown ? `<p class="dim">${unknown === 2 ? "Two numbers" : "One number"} you haven't got yet. People give you theirs if you talk to them.</p>` : ""}
      </div></div>`);
  }
  /** Who to grass up (or have flattened): their players by name, and anyone you can see. */
  openPhoneTargets(kind: "police" | "boxer") {
    const s = this.s, m = s.match!, pc = this.pc;
    const players = kind === "police" ? m.teams[1].squad.map((id) => s.actors[id]).filter((a) => a.fb!.status !== "gone") : [];
    const nearby = Object.values(s.actors).filter((a) => a !== pc && (a.npc || a.off) && !a.fb && a.npc?.job !== "dog" && a.npc?.job !== "cleanup" && !a.hiddenIn && !incapacitated(this.w, a) && (kind === "boxer" || a.npc?.job !== "police") && Math.hypot(a.x - pc.x, a.y - pc.y) < 22)
      .sort((p, q) => Math.hypot(p.x - pc.x, p.y - pc.y) - Math.hypot(q.x - pc.x, q.y - pc.y)).slice(0, 8);
    const b = (a: Actor, label: string) => `<button data-pt="${kind}:${a.id}">${esc(label)}</button>`;
    this.sheet("phone", `<h2>${kind === "police" ? "999: who are you reporting?" : "Brendan: who's the lucky boy?"}</h2>
      <p>${kind === "police" ? "They'll search them. Plant something first and they'll find it. Clean, and somebody's wasting police time." : `£${BOXER_FEE}, up front. He'll find them.`}</p>
      <div class="list">${players.map((a) => b(a, `${a.name}, ${m.teams[1].name} number ${a.fb!.number}${a.fb!.star ? " ★" : ""}`)).join("")}${nearby.map((a) => b(a, `${personName(a)}${isSecurity(a) ? " (on duty)" : ""}`)).join("")}</div>
      <button data-ph="back">Back</button>`);
  }
  /** Make the call, and show it: ringing, what's said, the line going dead. */
  async placeCall(arg: string) {
    const pc = this.pc, burner = this.phoneUse === "burner" ? burnerOn(this.w, pc) : undefined;
    const [who, tid] = arg.split(":");
    const r = dispatch(this.w, { verb: "call", actor: pc.id, arg, item: burner?.id });
    if (!r.ok) { this.audio.play("nope", 0.8); this.hint(r.reason ?? ""); return; }
    const t = tid ? this.s.actors[tid] : undefined;
    const name = who === "police" || who === "bomb" ? "999" : who === "wife" ? "Shezleigh" : who === "dealer" ? "Spliff Ricky" : "Bare-Knuckle Brendan";
    const lines: [string, string, string][] = who === "bomb" ? [["g", "There's a bomb in your stadium. Big one. Under the seats. Bye.", "v_ph_gbomb"]]
      : who === "police" ? [["g", `Yeah, hello, officer. There's a bloke here. ${t ? personName(t) + "." : ""} Carrying. Loads of it.`, "v_ph_gpolice"], ["t", "Thank you, caller. We'll send someone.", ""]]
      : who === "dealer" ? [["g", "Ricky? Gaz's mate. I need some... stuff.", "v_ph_gdealer"]]
      : who === "boxer" ? [["g", "Brendan? Got a job for you.", "v_ph_gboxer"]] : [];
    this.closeSheet();
    if (who === "wife") return this.wifeCall();
    await this.callCard(name, lines, burner ? "Burner" : "Your phone");
  }
  callOn = false;
  /** A phone call on Grozz's own phone: the game holds still and dims, his cracked handset tips up
   *  with the contact as he's saved them, a call timer and 3% battery; what's said comes up in comic
   *  speech bubbles, theirs from the phone and his from his own big face. */
  static readonly CONTACT: Record<string, string> = { Shezleigh: "The Wife", Kev: "Kev Coach", "Spliff Ricky": "Ricky (DONT SAVE)", "Bare-Knuckle Brendan": "Brendan Fights", "999": "999" };
  codec(name: string, face: string, via = ""): HTMLDivElement {
    const el = document.createElement("div"); el.className = "call mob";
    const img = (k: string) => `<img src="${assetURL(`scenes/codec_${k}.png`)}" alt="">`, d = new Date();
    const crack = `<svg class="crack" viewBox="0 0 90 170" preserveAspectRatio="none"><g fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".7"><polyline points="74,0 66,21 73,37 61,60 67,81 63,104"/><polyline points="66,21 51,29 39,26 21,41 0,44"/><polyline points="73,37 90,45"/><polyline points="61,60 45,69 41,92"/><polyline points="67,81 82,97 90,95"/><polyline points="51,29 49,12"/></g></svg>`;
    el.innerHTML = `<div class="hand"><div class="scr"><div class="sb"><span>${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}</span><span class="bat">▂▄ 3%</span></div><div class="pic">${img(face)}</div><b class="who">${esc(StadiumScene.CONTACT[name] ?? name)}</b><div class="st">Calling… <small>${esc(via)}</small></div><div class="wave">${"<span></span>".repeat(9)}</div><i class="hang"><svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.4 2.4-3.3-1.6v-2.4c-2.1-.7-4.5-.7-6.6 0v2.4L5.4 17.4z" fill="#fff"/></svg></i>${crack}</div></div><div class="talk"><div class="ln"></div><div class="me">${img("grozz")}</div></div>`;
    $("app").appendChild(el); this.callOn = true;
    // The world holds still while he's on the phone (as it does in the bag), and starts again after.
    if (this.pausedFrom === null && this.speed !== 0) { this.pausedFrom = this.speed; this.setSpeed(0); }
    const tm = window.setInterval(() => {
      if (!el.isConnected) { clearInterval(tm); return; }
      const t0 = Number(el.dataset.t0 || 0);
      if (t0 && !el.classList.contains("off")) { const sec = Math.floor((performance.now() - t0) / 1000); el.querySelector(".st")!.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`; }
    }, 250);
    return el;
  }
  /** Picked up: the clock starts. */
  connected(el: HTMLElement) { el.dataset.t0 = String(performance.now()); el.querySelector(".st")!.textContent = "00:00"; }
  /** Hung up: the phone goes away and the world carries on (unless the bag's still open). */
  endCall(el: HTMLElement) {
    el.remove(); this.callOn = false;
    if (!(this.sheetKind && StadiumScene.PAUSING.has(this.sheetKind))) this.unpauseSheet();
  }
  /** Who's talking: their photo pulses and the bubble points at the phone, or his face pops up. */
  codecTalk(el: HTMLElement, who: "l" | "r" | null) {
    el.classList.toggle("them", who === "r"); el.classList.toggle("me", who === "l");
  }
  faceFor(name: string): string { return /ricky/i.test(name) ? "ricky" : /brendan/i.test(name) ? "brendan" : /shez/i.test(name) ? "shez" : "police"; }
  async callCard(name: string, lines: [string, string, string][], via: string) {
    const el = this.codec(name, this.faceFor(name), via);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ring = await this.audio.playCut("v_ph_ring", 0.5);
    await wait(1300); ring.stop();
    this.connected(el);
    for (const [who, text, clip] of lines) {
      const ln = el.querySelector(".ln")!; ln.innerHTML = `<b>${who === "g" ? "Grozz" : esc(name)}</b> ${esc(text)}`;
      this.codecTalk(el, who === "g" ? "l" : "r");
      const p = clip ? await this.audio.playCut(clip as Clip, 1) : { dur: 0 };
      await wait(Math.max(1400, p.dur * 1000 + 250));
    }
    if (this.pendingCallText) { this.codecTalk(el, "r"); el.querySelector(".ln")!.innerHTML = `<b>${esc(name)}</b> ${esc(this.pendingCallText.replace(/^"|"$/g, ""))}`; this.pendingCallText = ""; await wait(2200); }
    this.codecTalk(el, null);
    this.audio.play("v_ph_hangup" as Clip, 0.5);
    el.querySelector(".st")!.textContent = "Call ended";
    el.classList.add("off");
    await wait(700); this.endCall(el);
  }
  pendingCallText = "";
  /** Somebody rings him: the phone buzzes up, you answer or let it ring off. */
  incoming: Record<string, number> = {};
  async incomingCall(key: string, name: string, face: string, lines: [string, string, string][], tip = "") {
    if (this.incoming[key] || this.callOn || !this.started || this.s.stadium!.ending || this.s.stadium!.detainedUntil) return;
    this.incoming[key] = performance.now();
    const el = this.codec(name, face, "incoming");
    el.querySelector(".st")!.textContent = "is calling…";
    const btns = document.createElement("div"); btns.className = "ans";
    btns.innerHTML = `<button class="no" aria-label="Ignore">Ignore</button><button class="yes" aria-label="Answer">Answer</button>`;
    el.querySelector(".scr")!.appendChild(btns); el.classList.add("ringing");
    this.buzz([60, 80, 60]);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ring = await this.audio.playCut("v_ph_ring", 0.45);
    const answered = await new Promise<boolean>((res) => {
      const t = setTimeout(() => res(false), 7000);
      btns.querySelector(".yes")!.addEventListener("click", () => { clearTimeout(t); res(true); });
      btns.querySelector(".no")!.addEventListener("click", () => { clearTimeout(t); res(false); });
    });
    ring.stop(); btns.remove(); el.classList.remove("ringing");
    if (!answered) { el.querySelector(".st")!.textContent = "Missed call"; el.classList.add("off"); await wait(600); this.endCall(el); return; }
    this.connected(el);
    if (tip) dispatch(this.w, { verb: "callin", actor: this.pc.id, arg: `${key.startsWith("ricky") ? "ricky" : key}|${tip}` });
    for (const [who, text, clip] of lines) {
      el.querySelector(".ln")!.innerHTML = `<b>${who === "g" ? "Grozz" : esc(name)}</b> ${esc(text)}`;
      this.codecTalk(el, who === "g" ? "l" : "r");
      const p = clip ? await this.audio.playCut(clip as Clip, 1) : { dur: 0 };
      await wait(Math.max(1200, p.dur * 1000 + 250));
    }
    this.codecTalk(el, null); this.audio.play("v_ph_hangup" as Clip, 0.5);
    el.querySelector(".st")!.textContent = "Call ended"; el.classList.add("off");
    await wait(600); this.endCall(el);
  }
  /** Who rings when: Shezleigh once you've been seen doing something big, Kev at half-time with a
   *  whisper about a fix you haven't heard of, Ricky early on with his number. */
  callTriggers(e: any) {
    const s = this.s, st = s.stadium!, pcId = st.pc, m = s.match!;
    const later = (ms: number, f: () => void) => setTimeout(f, ms);
    if (e.type === "incident" && e.by === pcId && e.severity >= 2 && e.seen >= 3 && !this.incoming.shez) {
      const frock = inDragSim(this.w, this.pc);
      later(9000, () => void this.incomingCall("shez", "Shezleigh", "shez", [
        ["r", frock ? "Why's our Tracey just sent me a photo of you in a fucking DRESS?! Is that MY dress?! You fat—" : "Grozz! You're all over fucking Facebook! Me mum's seen it! The whole street's seen it! You fat embarrassing—", frock ? "v_in_shez_dress" : "v_in_shez_tv"],
        ["g", "Can't talk. Busy saving England.", "v_ph_gbusy"],
      ]));
    }
    if (e.type === "fb_period_end" && e.period === 1) {
      if (this.incoming.kev) return;
      const f = st.flags, pickFix = !f.fix_keeper ? "keeper" : !f.fix_ref ? "ref" : !f.fix_star ? "star" : null;
      const L: Record<string, [string, string]> = {
        keeper: ["Kev here. Half-time. Word is their keeper likes a bet. Bung him a ton and he might let one in. Just saying.", "v_in_kev_keeper"],
        ref: ["Kev. The ref has his tea at half-time from the urn in the corridor. Two sugars. I'm not saying nothing.", "v_in_kev_ref"],
        star: ["Kev. Their number ten. Take him out and they've got nothing. That's all I'm saying.", "v_in_kev_star"],
        cheer: ["Kev! I've just seen you on the big screen! You absolute nutter! Keep going, son!", "v_in_kev_cheer"],
      };
      const [text, clip] = L[pickFix ?? "cheer"];
      later(2500, () => void this.incomingCall("kev", "Kev", "kev", [["g", "What?", "v_ph_gwhat"], ["r", text, clip], ["g", "Nice one, Kev.", "v_ph_gnice"]], pickFix ? text : ""));
    }
  }
  rickyChecked = false;
  /** Shezleigh picks up. He says something unforgivable. She starts. He hangs up. */
  async wifeCall() {
    const el = this.codec("Shezleigh", "shez");
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms)), n = (this.s.stadium!.flags.wifeCalls ?? 1) - 1;
    const ln = el.querySelector(".ln")!, st = el.querySelector(".st")!;
    const ring = await this.audio.playCut("v_ph_ring", 0.5); await wait(1700); ring.stop();
    this.connected(el);
    const hello = n % 2 ? "v_ph_shez_hello2" : "v_ph_shez_hello1";
    ln.innerHTML = `<b>Shezleigh</b> ${n % 2 ? "Yeah, hello? Who's this?" : "Hello?"}`;
    this.codecTalk(el, "r");
    const h = await this.audio.playCut(hello as Clip, 1); await wait(h.dur * 1000 + 200);
    const ins = [["Fucking slag.", "v_ph_g1"], ["You stupid fucking cow.", "v_ph_g2"], ["Dopey fucking bint.", "v_ph_g3"], ["Shut it, you old boiler.", "v_ph_g4"], ["Go and boil your head, you ugly cow.", "v_ph_g5"]][n % 5];
    ln.innerHTML = `<b>Grozz</b> ${esc(ins[0])}`; this.codecTalk(el, "l");
    const g = await this.audio.playCut(ins[1] as Clip, 1); await wait(g.dur * 1000 + 150);
    const rep = [["Don't you dare talk to me like that, you fat piece of—", "v_ph_shez_cut1"], ["Where's my forty quid, you thieving little—", "v_ph_shez_cut2"], ["The kids are asking where their dad's gone, you useless—", "v_ph_shez_cut3"], ["Oh, it's YOU. Listen here, you fat waste of—", "v_ph_shez_cut4"]][n % 4];
    ln.innerHTML = `<b>Shezleigh</b> ${esc(rep[0])}`; this.codecTalk(el, "r");
    const sh = await this.audio.playCut(rep[1] as Clip, 1);
    // Click. Mid-sentence.
    await wait(Math.min(1500, sh.dur * 1000 * 0.45 + 300)); sh.stop();
    this.audio.play("v_ph_hangup" as Clip, 0.5);
    st.textContent = "You hung up"; ln.innerHTML = ""; this.codecTalk(el, null); el.classList.add("off");
    await wait(900); this.endCall(el);
  }

  openBag() {
    this.pt?.bag();
    const s = this.s, pc = this.pc;
    const where = (it: Item) => (it.loc.k === "hand" ? "In your hand" : it.loc.k === "pocket" ? "In a pocket" : it.loc.k === "worn" ? "Wearing" : "");
    const items = [pc.hand, ...pc.pockets, ...Object.values(pc.worn)].filter((x): x is string => !!x).map((id) => s.items[id]);
    const rows = items.map((it) => {
      const opts = itemOptions(this.w, pc, it);
      (this as any)[`bag_${it.id}`] = opts;
      const extra = it.def === "ticket" ? (it.void ? " (cancelled)" : it.used ? " (scanned)" : "") : it.spiked ? " (spiked)" : "";
      const useIt = ITEM_TIPS[it.def] && !defOf(it).slot ? `<button class="primary" data-useit="${it.id}">Use…</button>` : "";
      return `<div class="item bagged">${icon(it.def)}<div class="col"><span class="where">${where(it)}</span><b>${esc(itemName(it))}${extra}</b></div><div class="row">${useIt}${opts.map((o, i) => `<button data-bag="${it.id}" data-i="${i}">${esc(o.label)}</button>`).join("")}</div></div>`;
    }).join("");
    this.sheet("bag", `<h2>Bag</h2><p>£${pc.money} in cash. Pockets: ${pc.pockets.length} of 3.</p><div class="row"><button data-wd="look">The look</button>${pc.naked ? `<button data-wd="dress">Pull your trousers up</button>` : `<button data-wd="strip">Strip naked</button>`}</div><div class="list">${rows || "<p>Nothing.</p>"}</div>`);
  }

  /** What the newer systems have to say: grasses, the phone, the hidden stories, the streak. */
  newsEvents(e: any) {
    const s = this.s, st = s.stadium!, pcId = st.pc, nm = (id: string) => (s.actors[id] ? personName(s.actors[id]) : "Someone");
    switch (e.type) {

      case "groped": if (e.who === pcId) { this.bark("groped", 1, true); if (!this.flags.gropeHint) { this.flags.gropeHint = 1; this.hint("He's got his hands on you. Flatten him: nobody's going to call that assault."); } } break;
      case "leered": if (e.who === pcId && e.advance && !this.flags.leerHint) { this.flags.leerHint = 1; this.hint("That one's coming over. If he lays a finger on you, he's fair game."); } break;
      case "self_defence": if (e.by === pcId) { this.hint("Self-defence. Nobody's arguing with that."); this.tick("creep"); } break;
      case "struck": if (e.by === pcId) this.buzz(e.heavy || e.weapon ? 35 : 18); else if (e.who === pcId) this.buzz([30, 40, 30]); break;
      case "knockout": if (e.by === pcId) this.buzz(70); break;
      case "payout": if (this.started) this.buzz([20, 30, 20]); break;
      case "fruit": if (e.by === pcId) this.fruitSpin(e.reels, e.win); break;
      case "ticket_scanned": if (e.who === pcId) this.scanCard(e.ok); if (e.ok) this.gateFlash[e.gate] = performance.now() + 4500;
        // Through you go: he walks himself through the turnstile (inside is up the screen).
        if (e.ok && e.who === pcId && e.x !== undefined) setTimeout(() => { if (!this.s.stadium!.admitted) this.walkTo = { x: e.x, y: e.y - 3, path: [], pathAt: 0, until: performance.now() + 8000 }; }, 700);
        break;
      case "pc_say": this.pcLine = { text: e.text, until: performance.now() + 2600 }; break;
      case "snitch": if (e.who === pcId) { this.hint(`${nm(e.by)} saw that, and he's off to find a steward. Tap him: pay him off, lean on him, or flatten him first.`); this.audio.play("heat_alert", 0.35, { minGap: 2 }); } break;
      case "snitch_stopped": if (e.how !== "down") this.hint(e.how === "paid" ? `${nm(e.by)} never saw a thing.` : `${nm(e.by)} has seen sense.`); this.tick("grass"); break;
      case "crime_reported": if (e.who === pcId) this.hint(`${nm(e.by)} grassed you up. Here they come.`); break;
      case "phone_result": if (this.callOn) this.pendingCallText = e.text; else this.hint(e.text); break;
      case "traced": this.hint("They've traced the call to your phone. Every copper in the area knows where you're stood. Move."); this.audio.play("siren", 0.6); break;
      case "burner_snapped": setTimeout(() => this.toast("burner", "You snap the SIM in half", "Gone"), 2600); break;
      case "bomb_threat": this.tick("bomb"); setTimeout(() => this.hint(e.pre ? "Kick-off's on hold while they sweep the ground." : "They've stopped the match. Stewards are checking under the seats."), 3200); break;
      case "gift": if (e.def) this.toast(e.def, ITEM_DEFS[e.def]?.name ?? e.def, "Given"); else if (e.money) this.hint(`+£${e.money}.`); this.audio.play("pickup", 0.8); break;
      case "scammed": this.hint(e.amount ? `−£${e.amount}. He's not coming back.` : "He's not coming back."); break;
      case "contact": this.toastTick(`☎ Number saved: ${e.id === "dealer" ? "Spliff Ricky" : "Bare-Knuckle Brendan"}`); this.audio.play("chime", 0.5); break;
      case "chain": this.chainStrap(e.links); if (e.links.length === 3 && e.pts?.length >= 3) { this.tele = { pts: e.pts, until: performance.now() + 4200 }; this.slowUntil = Math.max(this.slowUntil, performance.now() + 1600); } break;
      // Half-time: one beat that says what's changed and where the openings are (the second
      // preparation phase), then the world shows it: the urn pulses, the players troop off.
      case "fb_period_end": if (e.period === 1) {
        this.chainStrap(["PLAYERS IN THE DRESSING ROOMS", "REF'S TEA AT THE URN", "BARS RAMMED"], "HALF-TIME");
        if (this.s.stadium!.flags.fix_ref && !this.s.stadium!.flags.fixdone_ref) setTimeout(() => { this.pcLine = { text: "Ref'll be wanting his tea…", until: performance.now() + 3200 }; }, 2500);
      } break;
      // A goal that isn't a player's: the physical thing happened; what counts is what the officials decide.
      case "fb_goal": if (e.legit === false && e.by !== this.s.stadium!.pc) this.chainStrap(["BALL IN THE NET", "THE REF NEVER SAW: IT STANDS"], "OFFICIAL DECISION"); break;
      case "fb_no_goal": if (!this.s.stadium!.chain || e.by !== this.s.stadium!.pc) this.chainStrap(["BALL IN THE NET", "NO GOAL"], "OFFICIAL DECISION"); this.audio.play("crowd_jeer" as Clip, 0.7); break;
      case "dog_lured": setTimeout(() => this.ruleCard("food", "Ronson goes for food.", "Drop a pie by someone and he'll go through them to get it. Stewards leave their post to catch him; on the pitch, play stops."), 1500); break;
      case "post_left": if (this.s.stadium!.chain?.by === this.s.stadium!.pc) setTimeout(() => this.ruleCard("post", "People leave their post to fix a problem.", "Stewards, staff, Steve, Lenny, Wally: give them a problem and they go. Instinct now shows who's stood at a post."), 1800); break;
      case "secret": this.toastTick(`★ Found: ${e.title}`); this.audio.play("chime", 0.7, { rate: 0.9 }); this.tick("secret"); break;
      case "stripped": if (e.by === pcId) this.hint("Starkers. Every steward who sees you will have you for indecent exposure. The pitch is right there."); break;
      case "streak": this.tick("streak"); this.hint("A streaker! They've stopped the match."); this.audio.play("goal_roar", 0.7, { minGap: 3 }); this.crowdUpUntil = performance.now() + 5000; this.crowdUpSide = "all"; break;
      case "streak_over": if (e.caught) this.hint("Caught. With everything out."); break;
      case "guard_aside": this.hint(`The police have taken ${nm(e.who)} aside for a word. His post's empty.`); break;
      case "radio_decoy": this.audio.play("radio_squelch", 0.8); this.hint(e.rumbled ? "\"Who is this? Identify yourself.\" They're on to you." : e.sent ? `"All units to ${e.to}." ${e.sent} steward${e.sent > 1 ? "s" : ""} on their way.` : "\"Received.\" Nobody near enough to go."); break;
      case "boxer_done": this.hint("Brendan's done him. Fifty quid well spent."); this.tick("boxer"); break;
      case "fix_found": this.toastTick(`★ A fix: ${e.title}`); this.audio.play("chime", 0.6, { rate: 0.8 }); if (!this.fixHinted) { this.fixHinted = true; this.quietHint("Something to fix. It's in your notes (☰). Any way you manage it counts.", 45); } break;
      case "fix_way": this.toastTick("✎ Noted"); break;
      case "fix_done": this.toastTick(e.ownWay ? `✓ FIXED, YOUR WAY: ${e.title}` : `✓ FIXED: ${e.title}`); this.audio.play("chime", 0.9, { rate: 1.2 }); this.audio.play("crowd_ooh", 0.4, { minGap: 2 }); break;
      case "tipoff": if (e.phone && e.by === pcId) setTimeout(() => this.hint("Control's sending an officer."), 3500); break;
    }
  }

  /** The match-day to-do list (Untitled Goose Game's, for a hooligan): it names the mischief, not how. */
  static readonly MAYHEM: { id: string; text: string }[] = [
    { id: "in", text: "Get into the ground" }, { id: "ko_stw", text: "Flatten a steward" }, { id: "horse", text: "Ride the police horse" },
    { id: "car", text: "Nick a car" }, { id: "pitch", text: "Get on the pitch" }, { id: "dog", text: "Set a dog on someone" },
    { id: "splat", text: "Stamp on someone's head" }, { id: "slap", text: "Get slapped" }, { id: "bus", text: "Nick the team bus" },
    { id: "chute", text: "Parachute into the stadium" }, { id: "lenny", text: "Wear Lenny the Lion" }, { id: "evade", text: "Lose the stewards after a chase" },
    { id: "streak", text: "Streak across the pitch" }, { id: "bomb", text: "Call in a bomb threat" }, { id: "grass", text: "Shut a grass up" },
    { id: "boxer", text: "Have somebody sorted out" }, { id: "secret", text: "Find a hidden story" },
    { id: "roof", text: "Get up on a roof" }, { id: "window", text: "Put a brick through a window" }, { id: "stench", text: "Clear a crowd with a stink bomb" },
    { id: "rifle", text: "Take a shot from a long way off" }, { id: "creep", text: "Flatten a bloke who gets handsy" },
  ];
  mayhemDone = new Set<string>();
  /** Feats that unlock a starting item for the next match day. */
  static readonly UNLOCKS: Record<string, string> = {
    streak: "long_wig", roof: "brick", stench: "fart_can", bomb: "burner", ko_stw: "hivis", evade: "sunglasses", horse: "flat_cap",
    lenny: "mask", car: "wrench", creep: "dress", bus: "radio", secret: "moustache", window: "hammer", dog: "balaclava",
  };
  static unlocked(): string[] { try { return JSON.parse(localStorage.getItem("kd-unlocks") ?? "[]"); } catch { return []; } }
  /** The to-do list ticks itself, from what happens. */
  tickFrom(e: any, pcId: string) {
    const s = this.s, SEC = ["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief"];
    if (e.type === "knockout" && e.by === pcId && SEC.includes(s.actors[e.who]?.npc?.job ?? "")) this.tick("ko_stw");
    else if (e.type === "mounted" && (e.who === pcId || e.by === pcId)) this.tick("horse");
    else if (e.type === "carjacked" && e.by === pcId) this.tick("car");
    else if (e.type === "dog_sicced") this.tick("dog");
    else if (e.type === "slapped" && e.who === pcId) this.tick("slap");
    else if (e.type === "bus_stolen" && e.by === pcId) this.tick("bus");
    else if (e.type === "chute_land") this.tick("chute");
    else if (e.type === "evaded") this.tick("evade");
    else if (e.type === "headsplat" && e.by === pcId) this.tick("splat");
  }
  tick(id: string) {
    if (this.mayhemDone.has(id)) return;
    const m = StadiumScene.MAYHEM.find((x) => x.id === id);
    if (!m) return;
    this.mayhemDone.add(id);
    this.audio.play("chime", 0.6, { rate: 1.3 });
    // Some feats unlock kit to bring next time (Hitman's mastery: doing it once earns a head start).
    const un = StadiumScene.UNLOCKS[id];
    if (un) {
      const got = StadiumScene.unlocked();
      if (!got.includes(un)) { got.push(un); try { localStorage.setItem("kd-unlocks", JSON.stringify(got)); } catch { /* */ } setTimeout(() => this.toastTick(`🔓 Next match you can bring: ${ITEM_DEFS[un]?.name ?? un}`), 1400); }
    }
    // It pays: cash on the nail, through the sim so it's saved and replayed like everything else.
    const r = dispatch(this.w, { verb: "payout", actor: this.pc.id, arg: id });
    this.toastTick(`✓ ${m.text}${r.ok ? `  +£${REWARDS[id]}` : ""}`);
    if (r.ok) setTimeout(() => { this.audio.play("kaching", 0.7); const money = $("money"); money.classList.remove("earned"); void money.offsetWidth; money.classList.add("earned"); }, 350);
  }
  toastTick(text: string) {
    const el = document.createElement("div");
    el.className = "ticked"; el.textContent = text;
    $("app").appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /** The optional stuff: every daft thing the lads will pay you for, what it pays, and what it
   *  unlocks for next time. */
  openJobs() {
    $("menuBtn").classList.remove("dot");
    const pc = this.pc;
    const side = StadiumScene.MAYHEM.filter((m) => m.id !== "in"), doneN = side.filter((m) => this.mayhemDone.has(m.id)).length;
    const rows = side.map((m, i) => { const sp = todoSpot(this.w, m.id); return { m, d: sp ? Math.hypot(sp.x - pc.x, sp.y - pc.y) : 999 + i }; })
      .sort((a, b) => Number(this.mayhemDone.has(a.m.id)) - Number(this.mayhemDone.has(b.m.id)) || a.d - b.d);
    // Found by playing, not handed over as a list: what you've done, and the three nearest you haven't.
    const undone = rows.filter((r) => !this.mayhemDone.has(r.m.id)), shown = [...undone.slice(0, 3), ...rows.filter((r) => this.mayhemDone.has(r.m.id))], hidden = undone.length - Math.min(3, undone.length);
    this.sheet("jobs", `<h2>Side jobs (${doneN}/${side.length})</h2><p>None of this is needed. All of it pays: the lads have a whip-round for every daft thing you pull off. The nearest three:</p>
      <div class="log">${hidden > 0 ? "" : ""}${shown.map(({ m }) => { const done = this.mayhemDone.has(m.id), un = StadiumScene.UNLOCKS[m.id];
        return `<p>${done ? "<b>✓</b> <s>" + esc(m.text) + "</s>" : "☐ " + esc(m.text)} <span class="pay">£${REWARDS[m.id] ?? 0}</span>${un && !done ? `<br><small class="dim">Unlocks: ${esc(ITEM_DEFS[un]?.name ?? un)}</small>` : ""}</p>`; }).join("")}${hidden > 0 ? `<p class="dim">…and ${hidden} more daft things nobody's told you about. Go and find them.</p>` : ""}</div>`);
  }
  openMenu() {
    const cps = this.game2.checkpoints;
    this.sheet("menu", `<h2>Paused</h2><p>Go back to a checkpoint. Everything since then is undone, and the match will not play out the same way.</p>
      <div class="list">${cps.map((c) => `<button data-cp="${c.id}">${esc(c.label)}</button>`).join("")}${this.s.match!.phase === "break" && this.s.match!.period === 1 && !cps.some((c) => c.id === "halftime") ? `<button data-keepht="1" class="primary">Keep a save here (half-time)</button>` : ""}${this.pt ? `<button data-pt="1" class="primary">Playtest report</button>` : ""}<button data-new="1">Start a new match day</button><button data-mute="1">${this.audio.muted ? "Sound: off" : "Sound: on"}</button><button data-mini="1">Mini-games: ${this.miniOn ? "on" : "off"}</button><button data-buzz="1">Vibration: ${this.buzzOn ? "on" : "off"}</button><button data-lefty="1">Buttons: ${document.body.classList.contains("lefty") ? "left hand" : "right hand"}</button><button data-zoom="1">Zoom: ${esc(this.zoomLabel())}</button><button data-fp="1">${this.fp.on ? "Back to the overhead view" : "First-person view"}</button></div>
      <h2>Your notes</h2><div class="log">${[...this.rules].map((r) => `<p><b>Rule</b> ${esc(r === "post" ? "People leave their post to fix a problem." : r === "food" ? "Ronson goes for food." : r)}</p>`).join("")}${CURIOS.filter((c) => this.curios.has(c.id)).map((c) => `<p><b>Idea</b> ${esc(c.text)}</p>`).join("") || (this.rules.size ? "" : "<p>Nothing yet. Have a look round.</p>")}</div>
      <h2>Fixes (${fixesDone(this.w)}/${FIXES.length})</h2><div class="log">${this.fixesHtml()}</div>
      <h2>Side jobs (${this.mayhemDone.size}/${StadiumScene.MAYHEM.length})</h2><div class="list"><button data-jobs="1" class="primary">Side jobs: what pays ▸</button></div>
      <h2>Ways in you've heard about</h2><div class="log">${LEADS.filter((l) => this.s.stadium!.flags[`lead_${l.id}`]).map((l) => `<p><b>${esc(l.title)}</b> ${esc(l.how)} ${this.s.stadium!.admitted ? "" : `<button class="trk${this.tracked?.kind === "lead" && this.tracked.id === l.id ? " on" : ""}" data-track="lead:${l.id}">${this.tracked?.kind === "lead" && this.tracked.id === l.id ? "Tracking" : "Track"}</button>`}</p>`).join("") || "<p>Nothing yet. Talk to people: locals, staff, the man at the shed.</p>"}</div>
      <h2>What you've heard</h2><div class="log">${this.log.slice(-12).reverse().map((l) => `<p><b>${esc(l.src)}</b> ${esc(l.text)}</p>`).join("") || "<p>Nothing yet.</p>"}</div>`);
  }

  /** The fixes you've heard about, the ways in you know, and what's done. Nothing you haven't heard. */
  fixesHtml(): string {
    const f = this.s.stadium!.flags;
    const known = FIXES.filter((fx) => f[`fix_${fx.id}`] || f[`fixdone_${fx.id}`]);
    if (!known.length) return "<p>Nothing yet. Their best player, their keeper, the referee: someone round here will know something. Listen.</p>";
    return known.map((fx) => {
      const done = !!f[`fixdone_${fx.id}`], ways = fx.ways.filter((wy) => f[`fixw_${fx.id}_${wy.id}`]);
      const trk = (way: string) => (done ? "" : ` <button class="trk${this.tracked?.kind === "fix" && this.tracked.id === fx.id && (this.tracked.way ?? "") === way ? " on" : ""}" data-track="fix:${fx.id}:${way}">${this.tracked?.kind === "fix" && this.tracked.id === fx.id && (this.tracked.way ?? "") === way ? "Tracking" : "Track"}</button>`);
      return `<p>${done ? "<b>✓</b> <s>" : "☐ <b>"}${esc(fx.title(this.w))}${done ? "</s>" : "</b>"}${ways.length ? "" : trk("")}</p>${ways.map((wy) => `<p class="way">· ${esc(wy.text)}${trk(wy.id)}</p>`).join("") || (done ? "" : `<p class="way">· Nobody's said how. Keep listening, or find your own way.</p>`)}`;
    }).join("");
  }

  showEnding() {
    const st = this.s.stadium!, e = st.ending!;
    $("endTitle").textContent = e.title;
    { const m = this.s.match!; $("endScore").textContent = `${m.teams[0].short} ${m.score[0]}–${m.score[1]} ${m.teams[1].short}`; }
    $("endText").textContent = e.text;
    const news = newsReport(this.w);
    $("newsHead").textContent = news.headline;
    const nl = $("newsList"); nl.textContent = "";
    for (const line of news.lines) { const li = document.createElement("li"); li.textContent = line; nl.appendChild(li); }
    const inc = st.incidents.filter((i) => i.by === st.pc);
    const list = $("endList");
    list.textContent = "";
    const items = inc.length ? inc.map((i) => `${i.what}${i.seenBy ? `, seen by ${i.seenBy}` : ", unseen"}${i.blamed && i.blamed !== "ENG" ? ` (blamed on ${i.blamed} fans)` : ""}`) : ["You didn't do anything anyone noticed."];
    for (const t of items.slice(-8)) { const li = document.createElement("li"); li.textContent = t; list.appendChild(li); }
    void this.frontPage(this.spinHeadline() ?? news.headline, e.title);
    const cps = $("endCps");
    cps.textContent = "";
    if (e.kind === "through" && this.game2.campaign.fixture < FIXTURES.length - 1) {
      const go = document.createElement("button"); go.textContent = this.game2.campaign.fixture === 0 ? "Continue to the semi-final" : "Continue to the final"; go.className = "primary"; go.dataset.next = "1"; cps.appendChild(go);
    } else if (e.kind === "through") {
      const p = document.createElement("p"); p.textContent = "England have won the World Cup. You were there. In a manner of speaking."; cps.appendChild(p);
    }
    for (const c of this.game2.checkpoints) { const b = document.createElement("button"); b.textContent = `Back to: ${c.label}`; b.dataset.cp = c.id; cps.appendChild(b); }
    const nb = document.createElement("button"); nb.textContent = "Restart the tournament"; nb.dataset.new = "1"; cps.appendChild(nb);
    $("ending").hidden = false;
    void this.audio.music(e.kind === "through" ? "mus_win" : "mus_lose", false);
  }

  /** The day on one front page: Krunch News, your worst moment as the headline, a photo of the
   *  scene, the day's tally and a star rating. Something to share (or at least to look at). */
  /** The paper leads on the day's biggest chain, if there was one worth the name, and spins it. */
  spinHeadline(): string | null {
    const b = this.s.stadium!.chainBest;
    if (!b || b.links.length < 3) return null;
    const f = b.links[0];
    return f === "KEG" ? "Beer keg carnage at the Three Lions: drayman blames 'fat bloke'"
      : /ON THE FLOOR/.test(f) ? "Pie-crazed XL bully runs riot at England match"
      : f === "STEVE'S CHUTE GONE" ? "Half-time parachute display axed after chute 'theft'"
      : f === "LENNY MISSING" ? "Mascot mystery: where was Lenny the Lion?"
      : f === "WALLY'S CARD GONE" ? "Kit man's card nicked, players' door left wide open"
      : f === "PRESS PASS GONE" ? "TV reporter robbed in broad daylight at the ground"
      : f === "GROZZ PUTS IT IN" ? "Fan 'scores' for England. Officials baffled."
      : `Chaos at the ground: ${f.toLowerCase()}`;
  }
  async frontPage(headline: string, title: string) {
    const host = $("frontPage");
    host.innerHTML = "";
    const shot = await new Promise<HTMLImageElement | null>((r) => { try { this.game.renderer.snapshot((im) => r(im instanceof HTMLImageElement ? im : null)); } catch { r(null); } });
    if (shot && !shot.complete) await new Promise((r) => (shot.onload = r));
    const W2 = 540, H2 = 720, cv = document.createElement("canvas"); cv.width = W2; cv.height = H2;
    const c = cv.getContext("2d")!, m = this.s.match!, st = this.s.stadium!;
    c.fillStyle = "#f3efe4"; c.fillRect(0, 0, W2, H2);
    c.fillStyle = "#c8102e"; c.fillRect(0, 0, W2, 86);
    c.fillStyle = "#fff"; c.font = "900 54px Impact, 'Arial Black', sans-serif"; c.textAlign = "center"; c.fillText("KRUNCH NEWS", W2 / 2, 62);
    c.fillStyle = "#111"; c.font = "700 14px Georgia, serif"; c.fillText(`${VENUE.ground.toUpperCase()} · ${m.teams[0].short} ${m.score[0]}–${m.score[1]} ${m.teams[1].short}`, W2 / 2, 108);
    // The headline, wrapped, as big as it'll go.
    c.font = "900 38px Impact, 'Arial Black', sans-serif"; c.textAlign = "left";
    const words = headline.toUpperCase().split(" "), linesOut: string[] = []; let line = "";
    for (const wd of words) { const t2 = line ? line + " " + wd : wd; if (c.measureText(t2).width > W2 - 40) { linesOut.push(line); line = wd; } else line = t2; }
    if (line) linesOut.push(line);
    linesOut.slice(0, 4).forEach((l, i) => c.fillText(l, 20, 152 + i * 40));
    const py = 152 + Math.min(4, linesOut.length) * 40 - 14;
    if (shot) { const ph = 250, sw = shot.width, sh2 = Math.min(shot.height, sw * (ph / (W2 - 40))); c.drawImage(shot, 0, (shot.height - sh2) / 2, sw, sh2, 20, py, W2 - 40, ph); c.strokeStyle = "#111"; c.lineWidth = 3; c.strokeRect(20, py, W2 - 40, 250); }
    // The day's best chain, as the paper tells it, and Grozz taking the credit.
    const best = st.chainBest;
    if (best && best.links.length >= 3) {
      const yb = py + 250 - 46;
      c.fillStyle = "rgba(243,239,228,0.93)"; c.fillRect(22, yb, W2 - 44, 44);
      c.fillStyle = "#111"; c.font = "italic 700 15px Georgia, serif"; c.textAlign = "left";
      c.fillText("\u201cIt was all part of the plan,\u201d says local man, 48.", 30, yb + 18, W2 - 60);
      c.font = "11px Georgia, serif"; c.fillStyle = "#8e1626"; c.fillText(best.links.join(" \u2192 "), 30, yb + 36, W2 - 60);
    }
    // The tally and the rating.
    const fx = fixesDone(this.w), jobs = this.mayhemDone.size, cash = Object.keys(REWARDS).filter((k) => st.flags[`paid_${k}`]).reduce((t, k) => t + REWARDS[k], 0);
    const stars = Math.max(1, Math.min(5, Math.round(fx * 1.2 + jobs * 0.35 + (title.toLowerCase().includes("through") || st.ending?.kind === "through" ? 1 : 0))));
    let ty = py + 280;
    c.fillStyle = "#111"; c.font = "800 18px Georgia, serif";
    for (const t2 of [`Fixes sorted: ${fx} of ${FIXES.length}`, `Things done: ${jobs} of ${StadiumScene.MAYHEM.length}`, `Earned on the day: £${cash}`, `Incidents: ${st.incidents.filter((i) => i.by === st.pc).length}`]) { c.fillText(t2, 24, ty); ty += 28; }
    c.font = "900 30px Impact, sans-serif"; c.fillStyle = "#c8102e"; c.fillText("GROZZ RATING", 24, ty + 18);
    // Stars drawn, not typed (fonts disagree about the hollow one).
    for (let i = 0; i < 5; i++) {
      const cx2 = 250 + i * 36, cy2 = ty + 7; c.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? 6.5 : 15; c.lineTo(cx2 + Math.cos(a) * q, cy2 + Math.sin(a) * q); }
      c.closePath(); c.fillStyle = i < stars ? "#c8102e" : "#d8d2c2"; c.fill(); c.strokeStyle = "#111"; c.lineWidth = 1.5; c.stroke();
    }
    c.fillStyle = "#555"; c.font = "italic 13px Georgia, serif"; c.fillText("Knockout Day", W2 - 110, H2 - 14);
    cv.className = "fp"; host.appendChild(cv);
    const row = document.createElement("div"); row.className = "row";
    const share = document.createElement("button"); share.textContent = "Share the front page"; share.className = "primary";
    share.addEventListener("click", () => cv.toBlob(async (b) => {
      if (!b) return;
      const file = new File([b], "krunch-news.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      try { if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: "Krunch News" }); return; } } catch { /* cancelled */ }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "krunch-news.png"; a.click();
    }));
    row.appendChild(share); host.appendChild(row);
  }

  // ---------- Wiring ----------
  wireHud() {
    $("start").addEventListener("click", () => { $("intro").hidden = true; void this.audio.unlock(); this.started = true; if (this.pt && !this.pt.running) { this.pt.begin(); this.ptBar(); } });
    $("prepGo").addEventListener("click", () => {
      if (!this.pendingCampaign) return;
      $("prep").hidden = true;
      this.newGame(this.pendingCampaign);
      this.pendingCampaign = null;
      this.setSpeed(1);
    });
    // Phones may suspend audio; any tap brings it back.
    window.addEventListener("pointerdown", () => { if (this.started) void this.audio.unlock(); this.pt?.active(false); });
    // iOS Safari: no pinch-zoom and no double-tap zoom of the page (quick taps to walk were zooming it in,
    // leaving the HUD off-screen and the stick dead). And if it ever does get zoomed, snap it back.
    for (const ev of ["gesturestart", "gesturechange", "gestureend", "dblclick"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => { const n = Date.now(); const onUi = !!(e.target as HTMLElement)?.closest?.("button,textarea,input,a,label,[data-who],[data-cp]"); if (n - lastTouchEnd < 350 && !onUi) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
    document.addEventListener("touchmove", (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", () => {
      if (vv.scale <= 1.01) return;
      const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (meta) { const c = meta.content; meta.content = c.replace(/maximum-scale=[^,]*/, "maximum-scale=1.0001"); setTimeout(() => { meta.content = c; }, 60); }
      window.scrollTo(0, 0);
    });
    // Hold the button to wind up a haymaker (on a punch); a tap is an ordinary swing.
    const holdable = (el: HTMLElement, get: () => Option | null) => {
      let t0 = 0, timer = 0;
      el.addEventListener("pointerdown", () => { t0 = performance.now(); clearTimeout(timer); timer = window.setTimeout(() => { const o = get(); if (o?.action?.verb === "strike") el.classList.add("charged"); }, 380); });
      el.addEventListener("click", () => {
        clearTimeout(timer); el.classList.remove("charged");
        const o = get(), held = t0 ? performance.now() - t0 : 0; t0 = 0;
        // Held on anything but a punch: everything else you could do here (the More list).
        if (el.id === "act" && held > 600 && o?.action?.verb !== "strike") { this.buzz(20); this.openMore(); return; }
        this.run(o && held > 380 && o.action?.verb === "strike" && o.action.arg !== "takedown" ? { ...o, action: { ...o.action, arg: "haymaker" } } : o);
      });
    };
    holdable($("act"), () => this.mainOpt);
    $("throw").addEventListener("click", () => this.throwNow());
    $("useBtn").addEventListener("click", () => { if (this.pc.hand) (this.useMode ? this.endUse() : this.startUse(this.pc.hand)); });
    $("useBanner").addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("[data-nouse]")) this.endUse(); });
    $("betBtn").addEventListener("click", () => (this.sheetKind === "bet" ? this.closeSheet() : this.openBet()));
    holdable($("hit"), () => (this as any).hitOpt ?? null);
    $("moreBtn").addEventListener("click", () => (this.sheetKind === "more" ? this.closeSheet() : this.openMore()));
    // Instinct: hold it (or I on a keyboard) to see what you can use and where they're looking.
    const instOn = (e?: Event) => { e?.preventDefault(); this.instinct = true; $("instBtn").classList.add("on"); };
    const instOff = () => { this.instinct = false; $("instBtn").classList.remove("on"); };
    $("instBtn").addEventListener("pointerdown", instOn);
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("instBtn").addEventListener(ev, instOff);
    window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "i" && this.started) instOn(); });
    window.addEventListener("keyup", (e) => { if (e.key.toLowerCase() === "i") instOff(); });
    // Folded: open it out. Open: Side jobs opens the jobs sheet, anywhere else folds it again.
    $("todo").addEventListener("click", (e) => {
      const now = performance.now();
      if (now >= this.todoOpenUntil) this.todoOpenUntil = now + 9000;
      else if ((e.target as HTMLElement).closest(".side")) this.openJobs();
      else this.todoOpenUntil = 0;
      this.todoAt = 0; this.updateGuides();
    });
    try { if (localStorage.getItem("kd-lefty") === "1") document.body.classList.add("lefty"); } catch { /* */ }
    $("lineBtn").addEventListener("click", (ev) => { ev.stopPropagation(); const r = dispatch(this.w, { verb: "line", actor: this.pc.id }); if (!r.ok) this.hint(r.reason ?? ""); $("lineBtn").hidden = true; });
    $("bagBtn").addEventListener("click", () => (this.sheetKind === "bag" ? this.closeSheet() : this.openBag()));
    $("phoneBtn").addEventListener("click", () => (this.sheetKind === "phone" ? this.closeSheet() : this.openPhone()));
    $("scopeFire").addEventListener("pointerdown", (e) => { e.stopPropagation(); this.fire(); });
    $("scopeExit").addEventListener("click", () => this.exitScope());
    const steadyOn = (e: Event) => { e.stopPropagation(); this.steadyFrom = performance.now(); $("scopeSteady").classList.add("on"); };
    const steadyOff = () => { this.steadyFrom = 0; $("scopeSteady").classList.remove("on"); };
    $("scopeSteady").addEventListener("pointerdown", steadyOn);
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("scopeSteady").addEventListener(ev, steadyOff);
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (touch) document.body.classList.add("touch");
    try { const saved = localStorage.getItem("kd-zoom2"); const z = saved ? +saved : 0; if (ZOOMS.includes(z)) this.zoomLevel = z; } catch { /* ignore */ }
    $("zoomBtn").textContent = this.zoomLabel();
    $("zoomBtn").addEventListener("click", () => this.cycleZoom());
    $("fpBtn").addEventListener("click", () => this.toggleFirstPerson());
    $("viewBtn").textContent = this.driveView === "chase" ? "Chase" : this.driveView === "cab" ? "Cab" : "Map";
    $("viewBtn").addEventListener("click", () => this.cycleDriveView());
    $("hornBtn").addEventListener("click", () => this.honk());
    $("menuBtn").addEventListener("click", () => (this.sheetKind === "menu" ? (this.closeSheet(), this.setSpeed(1)) : this.openMenu()));
    for (const n of [1, 2, 4]) $("sp" + n).addEventListener("click", () => this.setSpeed(n));
    const onSheetClick = (ev: Event) => {
      const b = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
      if (!b) return;
      const d = b.dataset;
      if (!d.buy && !d.bag) this.audio.play("tap", 0.5);
      if (d.close) { if (this.sheetKind === "menu") this.setSpeed(1); this.closeSheet(); return; }
      if (d.opt) { this.run(((this as any).moreOpts as Option[])[+d.opt]); this.closeSheet(); return; }
      if (d.pm) { const m = this.personItems[+d.pm]; this.closeSheet(); if (m) this.choosePerson(m); return; }
      if (d.buy) {
        const r = dispatch(this.w, { verb: "buy", actor: this.pc.id, target: { k: "actor", id: d.who! }, arg: d.buy });
        if (r.ok) this.bought(b, d.buy, +(d.price ?? 0));
        else { this.audio.play("nope", 0.8); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); this.hint(r.reason === "not enough money" ? "You can't afford that." : r.reason ?? ""); }
        setTimeout(() => this.sheetKind === "shop" && this.openShop(d.who!), 420);
        return;
      }
      if (d.pawn) {
        const nicked = !!this.w.state.items[d.pawn]?.stolenFrom && !!this.w.state.actors[this.w.state.items[d.pawn].stolenFrom!]?.npc;
        const r = dispatch(this.w, { verb: "pawn", actor: this.pc.id, target: { k: "actor", id: d.who! }, item: d.pawn });
        if (r.ok && nicked) setTimeout(() => { this.pcLine = { text: "In the window. He'll see that. Heh.", until: performance.now() + 2800 }; }, 600);
        if (r.ok) { this.audio.play("kaching", 1); const money = $("money"); money.classList.remove("spent"); void money.offsetWidth; money.classList.add("spent"); }
        else { this.audio.play("nope", 0.8); this.hint(r.reason === "he won't take that" ? "\"I'm not touching that.\"" : r.reason ?? ""); }
        setTimeout(() => this.sheetKind === "shop" && this.openShop(d.who!), 300);
        return;
      }
      if (d.bet) { const r = dispatch(this.w, { verb: "bet", actor: this.pc.id, arg: d.bet, amount: +d.amt! }); if (!r.ok) this.hint(r.reason ?? ""); this.openBet(); return; }
      if (d.report) { const r = dispatch(this.w, { verb: "report", actor: this.pc.id, target: { k: "actor", id: d.report } }); if (!r.ok) this.hint(r.reason ?? ""); this.closeSheet(); return; }
      if (d.loot) {
        const r = dispatch(this.w, { verb: "loot", actor: this.pc.id, target: { k: "actor", id: d.who! }, arg: d.loot });
        if (!r.ok) { this.hint(r.reason ?? ""); this.closeSheet(); return; }
        this.audio.play("pickup", 0.9);
        if (d.loot === "all") this.closeSheet(); else this.openLoot(d.who!);
        return;
      }
      if (d.bribe) { const r = dispatch(this.w, { verb: "bribe", actor: this.pc.id, target: { k: "actor", id: d.who! }, amount: +d.bribe }); if (!r.ok) this.hint(r.reason ?? ""); this.closeSheet(); return; }
      if (d.bag) {
        const o = ((this as any)[`bag_${d.bag}`] as Option[])[+d.i!];
        if (o?.sheet?.kind === "phone") { this.openPhone("burner"); return; }
        if (o?.action) {
          const def = this.s.items[o.action.item ?? ""]?.def;
          const r = dispatch(this.w, o.action);
          if (!r.ok) { this.audio.play("nope", 0.8); this.hint(r.reason ?? ""); }
          else {
            const v = o.action.verb;
            const food = def && ITEM_DEFS[def]?.props.includes("food"), drink = def && ITEM_DEFS[def]?.props.includes("liquid");
            this.audio.play(v === "wear" || v === "remove" ? "wear" : v === "consume" ? (drink ? "gulp" : food ? "munch" : "pickup") : "tap", 0.9);
            // Changed: show him off in it.
            if ((v === "wear" || v === "remove") && def && ITEM_DEFS[def]?.slot) { this.openWardrobe(); return; }
            if (v === "radio") { this.closeSheet(); return; }
          }
        }
        this.openBag(); return;
      }
      if (d.try) { this.tryOn(d.try); return; }
      if (d.turn) { this.mirrorDir = (this.mirrorDir + 8 + +d.turn) % 8; clearInterval(this.mirrorTimer); this.drawMirror(); return; }
      if (d.wd) {
        if (d.wd === "look") { this.openWardrobe(); return; }
        if (d.wd === "bag") { this.openBag(); return; }
        const r = dispatch(this.w, { verb: d.wd, actor: this.pc.id });
        if (!r.ok) { this.hint(r.reason ?? ""); return; }
        this.audio.play("wear", 0.9);
        this.openWardrobe(); return;
      }
      if (d.hs) { this.openPhone(d.hs as "own" | "burner"); return; }
      if (d.pt) { void this.placeCall(d.pt); return; }
      if (d.ph) {
        if (d.ph === "back") { this.openPhone(); return; }
        if (d.ph === "bets") { this.openBet(); return; }
        if (d.ph === "police" || d.ph === "boxer") { this.openPhoneTargets(d.ph); return; }
        void this.placeCall(d.ph); return;
      }
      if (d.cp) { loadCheckpoint(this.game2, d.cp as any); this.closeSheet(); $("ending").hidden = true; this.setSpeed(1); this.hint("Back to the checkpoint."); this.setZoom(); return; }
      if (d.useit) { this.closeSheet(); this.startUse(d.useit); return; }
      if (d.pt) { this.closeSheet(); this.ptReport(); return; }
      if (d.keepht) { saveCheckpoint(this.game2, "halftime", "Half-time"); this.hint("Saved. Half-time's in the menu now if it all goes wrong."); this.openMenu(); return; }
      if (d.new) { this.newGame(); this.closeSheet(); this.setSpeed(1); $("ending").hidden = true; return; }
      if (d.next) { this.continueTournament(); return; }
      if (d.mute) { this.audio.toggleMute(); this.openMenu(); return; }
      if (d.jobs) { this.openJobs(); return; }
      if (d.mini) { this.miniOn = !this.miniOn; try { localStorage.setItem("kd-mini", this.miniOn ? "1" : "0"); } catch { /* */ } this.openMenu(); return; }
      if (d.buzz) { this.buzzOn = !this.buzzOn; try { localStorage.setItem("kd-buzz", this.buzzOn ? "1" : "0"); } catch { /* */ } this.buzz(40); this.openMenu(); return; }
      if (d.lefty) { const on = document.body.classList.toggle("lefty"); try { localStorage.setItem("kd-lefty", on ? "1" : "0"); } catch { /* */ } this.openMenu(); return; }
      if (d.track) {
        const [kind, id, way] = d.track.split(":");
        const same = this.tracked && this.tracked.kind === kind && this.tracked.id === id && (this.tracked.way ?? "") === (way ?? "");
        this.tracked = same ? null : { kind: kind as Tracked["kind"], id, way: way || undefined };
        this.closeSheet(); this.setSpeed(1);
        if (this.tracked) { const t = trackTarget(this.w, this.tracked); if (t) this.hint(`Tracking: ${t.label}. Follow the star.`); }
        return;
      }
      if (d.zoom) { this.cycleZoom(); this.openMenu(); return; }
      if (d.fp) { this.toggleFirstPerson(); this.closeSheet(); this.setSpeed(1); return; }
    };
    $("sheet").addEventListener("click", onSheetClick);
    $("ending").addEventListener("click", onSheetClick);

    // E or space: on release, a swing (a haymaker if held), or whatever the main button does.
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      if ((k !== "e" && k !== " ") || !this.started || !this.keyHeldAt) return;
      if (this.s.stadium!.vehicles.bus?.drivenBy === this.pc.id) { this.keyHeldAt = 0; return; }
      const o = this.mainOpt, held = performance.now() - this.keyHeldAt;
      this.keyHeldAt = 0;
      this.run(o && held > 380 && o.action?.verb === "strike" && o.action.arg !== "takedown" ? { ...o, action: { ...o.action, arg: "haymaker" } } : o);
    });
    window.addEventListener("keydown", (e) => {
      if (!this.started) { if (e.key === "Enter") { $("intro").hidden = true; this.started = true; void this.audio.unlock(); } return; }
      const k = e.key.toLowerCase();
      if ((k === "h" || k === "e") && this.s.stadium!.vehicles.bus?.drivenBy === this.pc.id) { this.honk(); return; }
      if (k === "e" || k === " ") { e.preventDefault(); if (!e.repeat) this.keyHeldAt = performance.now(); }
      else if (k === "q") this.throwNow();
      else if (k === "f") this.run(this.opts.find((o) => o.action?.verb === "strike") ?? null);
      else if (k === "r") (this.sheetKind === "more" ? this.closeSheet() : this.openMore());
      else if (k === "tab" || k === "i") { e.preventDefault(); this.sheetKind === "bag" ? this.closeSheet() : this.openBag(); }
      else if (k === "escape") { this.sheetKind ? (this.sheetKind === "menu" && this.setSpeed(1), this.closeSheet()) : this.openMenu(); }
      else if (k === "`") this.toggleDebug();
      else if (k === "z") this.cycleZoom();
      else if (k === "v") this.toggleFirstPerson();
      else if (/^[1-9]$/.test(k) && this.sheetKind === "more") this.run(((this as any).moreOpts as Option[])[+k - 1]);
    });
    // Debug: three taps on the score.
    let taps: number[] = [];
    $("score").addEventListener("pointerdown", () => { const now = performance.now(); taps = taps.filter((t) => now - t < 700); taps.push(now); if (taps.length >= 3) { taps = []; this.toggleDebug(); } });
  }

  wireInput() {
    const joy = $("joy"), knob = $("knob");
    const canvas = this.game.canvas;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.started) return;
      // Any other tap puts the ring away (a tap on someone opens theirs instead); that tap doesn't walk you anywhere.
      const hadRing = !!this.ring || !!this.sheetKind;
      this.closeRing();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < rect.width * 0.45 && this.joyId === -1) {
        // Keep the ring clear of the screen edges, so the bottom swipe area never swallows the release.
        const ox = Math.max(70, Math.min(window.innerWidth - 70, e.clientX)), oy = Math.max(70, Math.min(window.innerHeight - 80, e.clientY));
        this.joyId = e.pointerId; this.joyOx = ox; this.joyOy = oy; this.jx = this.jy = 0;
        this.tapStart = { x: e.clientX, y: e.clientY, at: performance.now(), far: false, hadRing };
        joy.hidden = false; joy.style.left = `${ox}px`; joy.style.top = `${oy}px`; knob.style.transform = "";
        try { canvas.setPointerCapture(e.pointerId); } catch { /* not all browsers allow it */ }
        move(e);
      } else {
        // Tap someone to aim at them.
        const cam = this.cameras.main, P = this.P;
        const wx = cam.worldView.x + (x * DPR) / cam.zoom, wy = cam.worldView.y + (y * DPR) / cam.zoom;
        const gx = wx / P.S, gy = (wy + 0.9 * P.KZ * P.S) / (P.K * P.S);
        const best = this.personAt(gx, gy);
        if (this.useMode) { const g = this.groundAt(e.clientX, e.clientY); this.useAt(g.x, g.y, best); return; }
        this.picked = best ? best.id : null;
        if (best) this.openPerson(best.id);
        else if (!hadRing) { const g = this.groundAt(e.clientX, e.clientY); this.setWalk(g.x, g.y); }
      }
    });
    function move(this: void, e: PointerEvent): void { scene.joyMove(e, knob); }
    const scene = this;
    const release = () => { this.joyId = -1; this.jx = this.jy = 0; joy.hidden = true; };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      const t = this.tapStart;
      this.tapStart = null;
      release();
      // A tap, not a push of the stick: if there's someone under it, their menu.
      if (t && !t.far && performance.now() - t.at < 350 && e.type === "pointerup") {
        const rect = canvas.getBoundingClientRect(), cam = this.cameras.main, P = this.P;
        const wx = cam.worldView.x + ((t.x - rect.left) * DPR) / cam.zoom, wy = cam.worldView.y + ((t.y - rect.top) * DPR) / cam.zoom;
        const who = this.personAt(wx / P.S, (wy + 0.9 * P.KZ * P.S) / (P.K * P.S));
        if (this.useMode) { const g = this.groundAt(t.x, t.y); this.useAt(g.x, g.y, who); }
        else if (who) { this.picked = who.id; this.openPerson(who.id); }
        else if (!t.hadRing) { const g = this.groundAt(t.x, t.y); this.setWalk(g.x, g.y); }
      }
    };
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointermove", move);
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      canvas.addEventListener(ev, up as EventListener);
      window.addEventListener(ev, up as EventListener);
    }
    // Belt and braces for phones: if no finger is on the left half any more, let go.
    const checkTouches = (e: TouchEvent) => {
      if (this.joyId === -1) return;
      const anyLeft = Array.from(e.touches).some((t) => t.clientX < window.innerWidth * 0.5);
      if (!anyLeft) release();
    };
    window.addEventListener("touchend", checkTouches, { passive: true });
    window.addEventListener("touchcancel", checkTouches, { passive: true });
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", () => { if (document.hidden) release(); });
  }

  tapStart: { x: number; y: number; at: number; far: boolean; hadRing?: boolean } | null = null;
  joyMove(e: PointerEvent, knob: HTMLElement) {
    if (e.pointerId !== this.joyId) return;
    if (this.tapStart && Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) > 14) this.tapStart.far = true;
    let dx = (e.clientX - this.joyOx) / 50, dy = (e.clientY - this.joyOy) / 50;
    const l = Math.hypot(dx, dy);
    if (l > 1.25) { dx *= 1.25 / l; dy *= 1.25 / l; }
    this.jx = dx; this.jy = dy;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  }

  toggleDebug() {
    const el = $("debug");
    if (!el.hidden) { el.hidden = true; return; }
    const tp = (x: number, y: number) => () => { const pc = this.pc; pc.x = x; pc.y = y; pc.hiddenIn = undefined; pc.heldBy = undefined; pc.seated = false; };
    const acts: [string, () => void][] = [
      ["Give £500", () => { this.pc.money += 500; }],
      ["Jump to the final", () => { const c = newCampaign(); c.fixture = 2; c.notoriety = 2; c.stash = ["shirt_eng", "wig", "moustache", "censored_bar"]; c.loadout = c.stash.slice(); c.money = 120; this.newGame(c); $("debug").hidden = true; }],
      ["Jump to the semi-final", () => { const c = newCampaign(); c.fixture = 1; c.notoriety = 1; c.stash = ["shirt_eng", "sunglasses", "flat_cap", "knife"]; c.loadout = c.stash.slice(); this.newGame(c); $("debug").hidden = true; }],
      ["Give a ticket", () => { spawnItem(this.s, "ticket", { k: "pocket", a: this.pc.id }); }],
      ["Skip to kick-off", () => { const m = this.s.match!; if (m.phase === "pre") { const n = Math.max(0, m.phaseUntil - this.s.tick - 600); for (let i = 0; i < n; i++) stepGame(this.game2); } }],
      ["Skip 60 seconds", () => { for (let i = 0; i < 3600; i++) stepGame(this.game2); }],
      ["Play to the end", () => { let n = 0; while (!this.s.stadium!.ending && n++ < 60 * 60 * 45) stepGame(this.game2); }],
      ["Wear England kit", () => { spawnItem(this.s, "kit_eng", { k: "worn", a: this.pc.id, slot: "outer" }); }],
      ["Wear police uniform", () => { spawnItem(this.s, "police_uniform", { k: "worn", a: this.pc.id, slot: "outer" }); }],
      ["Go to the hotel", tp(SPOTS.busPark.x - 3, SPOTS.busPark.y + 4)],
      ["Go to the dog", tp(SPOTS.dogPost.x + 1.5, SPOTS.dogPost.y)],
      ["Wear referee's kit", () => { spawnItem(this.s, "ref_kit", { k: "worn", a: this.pc.id, slot: "outer" }); spawnItem(this.s, "whistle", { k: "pocket", a: this.pc.id }); }],
      ["Go to concourse", tp(0, 41)],
      ["Go to the stands", tp(-10, 32)],
      ["Go to dressing rooms", tp(0, -45)],
      ["Go to the pub", tp(-44, 70)],
      ["Go to the lorry", tp(-26, 69)],
      ["Go to staff door", tp(59.5, 53)],
      ["Bribe their keeper", () => { const gk = playing(this.s, this.s.match!, 1).find((a) => a.fb!.role === "GK"); if (gk) bribePlayer(this.w, gk.id); }],
      ["Bribe the referee", () => biasReferee(this.w, 0, 0.8)],
      ["Distract the referee", () => distractReferee(this.w, 30)],
      ["Floor the referee", () => floorReferee(this.w, 20)],
      ["Clear suspicion", () => { for (const id in this.s.actors) { const n = this.s.actors[id].npc; if (n) { n.sus = {}; if (n.mode !== "routine") { n.mode = "routine"; n.target = null; n.crime = 0; } } } this.s.stadium!.wanted = []; this.s.stadium!.banned = []; }],
      ["Flat / tilted view", () => { this.P.mode = this.P.mode === "tilted" ? "flat" : "tilted"; this.drawStatic(); this.setZoom(); }],
    ];
    el.innerHTML = `<b>Debug</b><div class="grid">${acts.map(([l], i) => `<button data-dbg="${i}">${l}</button>`).join("")}</div>`;
    el.onclick = (ev) => { const b = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null; if (b?.dataset.dbg) acts[+b.dataset.dbg][1](); };
    el.hidden = false;
  }
}

// The canvas is the screen's real pixel size, shown at its CSS size: Phaser's NONE mode with zoom 1/DPR.
const host = $("game");
// The assets come in packs: fetch them (with a progress bar), then start the game.
{
  const bar = document.createElement("div");
  bar.id = "packload";
  Object.assign(bar.style, { position: "fixed", inset: "0", zIndex: "60", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", background: "#000", color: "#f2c94c", font: "700 18px 'Silkscreen', monospace" });
  bar.innerHTML = `<div>KNOCKOUT DAY</div><div style="width:min(70vw,360px);height:14px;border:3px solid #f2c94c"><div id="packfill" style="height:100%;width:0;background:#c8102e"></div></div><div id="packtxt" style="font:600 15px 'Pixelify Sans',sans-serif;color:#ddd">Loading…</div>`;
  document.body.appendChild(bar);
  void loadPacks((d, t) => {
    const f = document.getElementById("packfill"), tx = document.getElementById("packtxt");
    if (f) f.style.width = `${Math.round((d / t) * 100)}%`;
    if (tx) tx.textContent = `Loading… ${(d / 1e6).toFixed(1)} of ${(t / 1e6).toFixed(1)} MB`;
  }).catch(() => {}).finally(() => {
    bar.remove();
    // The film first (skippable; ?noopening for tools), and only then the ground: building both at
    // once, two pictures' worth of memory at the same time, was more than a phone would stand.
    if (location.search.includes("noopening")) startGame();
    else playOpening(startGame);
  });
}

function startGame(): void {
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101412",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, width: Math.max(1, host.clientWidth * DPR), height: Math.max(1, host.clientHeight * DPR), zoom: 1 / DPR },
  scene: StadiumScene,
});
// If the phone takes the graphics away (it does that when memory runs short), say so and offer a
// restart, rather than leaving a black screen behind the buttons.
game.events.once(Phaser.Core.Events.READY, () => game.canvas.addEventListener("webglcontextlost", () => {
  const d = document.createElement("div");
  Object.assign(d.style, { position: "fixed", inset: "0", zIndex: "80", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", background: "rgba(0,0,0,.88)", color: "#fff", font: "600 17px 'Pixelify Sans', sans-serif", textAlign: "center", padding: "0 max(16px, env(safe-area-inset-left, 0px))" });
  d.innerHTML = `<div>Your phone ran out of graphics memory.</div>`;
  const b = document.createElement("button");
  b.textContent = "Reload ▸";
  Object.assign(b.style, { font: '700 20px "Silkscreen", monospace', padding: "12px 24px", background: "#c8102e", color: "#fff", border: "3px solid #000" });
  b.addEventListener("click", () => location.replace(location.pathname + "?noopening"));
  d.appendChild(b);
  document.body.appendChild(d);
}));
}

// Keep the type checker honest about things only referenced in strings.
void appearance; void SPOTS; void ([0, 1] as TeamIdx[]);
