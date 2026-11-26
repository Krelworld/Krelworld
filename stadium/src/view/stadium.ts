// The playable match day. Draws the stadium, turns input into actions, shows what is going on.
import Phaser from "phaser";
import { appearance } from "../core/identity";
import { defOf, hasProp, ITEM_DEFS, spawnItem } from "../core/items";
import { Stepper } from "../core/stepper";
import type { Action, Actor, Item } from "../core/types";
import { dispatch } from "../core/verbs";
import { clamp } from "../core/vec";
import { bribePlayer, biasReferee, distractReferee, floorReferee } from "../football/api";
import { Commentator } from "../football/commentary";
import { HL, HW, PITCH } from "../football/config";
import { clockLabel } from "../football/match";
import type { TeamIdx } from "../football/types";
import { playing } from "../football/util";
import { Announcer } from "../stadium/announcer";
import { aimThrow, itemName, itemOptions, looksOutOfPlace, options, personName, primary, throwTarget, type Option } from "../stadium/context";
import { createGame, loadCheckpoint, stepGame, type Game } from "../stadium/game";
import { AREAS, areaAt, BOUNDS, KICKOFF_AT, setBreaches, SOLID, SPOTS, VENUE } from "../stadium/layout";
import { afterMatch, describeDef, FIXTURES, loadoutProblem, newCampaign, notorietyText, type Campaign } from "../stadium/campaign";
import { TEAMS } from "../football/setup";
import { canBetHere, prices } from "../stadium/betting";
import { newsReport } from "../stadium/news";
import { secs } from "../stadium/npc";
import { SHOPS } from "../stadium/rules";
import { LORRY_LEN, LORRY_WID } from "../stadium/vehicles";
import { BUS_LEN, BUS_WID, holdOpen } from "../stadium/bus";
import { drawFigure, headTop, type FigureStyle } from "./figures";
import { drawBall, drawGoalFrame, drawPitch } from "./pitchArt";
import { Projection } from "./projection";
import { Audio, VOICES, type Clip } from "./audio";
import { Drive3D, type DriveView } from "./drive3d";
import { CELL, cellOf, dirIndex, FEET, feetOf, HEAD, SpriteBank, type Base, type Recolour } from "./sprites";
import { buildings, placements, WorldArt, type Placement } from "./world";
import { Stall } from "./stall";
import { Fx } from "./fx";
import { FirstPerson, type FpSprite } from "./fp";
import { holeState, inCubicle, knifeOn } from "../stadium/gloryhole";
import { incapacitated, knockedOut, lootable } from "../stadium/combat";
import { CAP, ensureFloor, ensureMaterials, facade, floodlight, matOf, adBoard, banner, pixelText as pixelTextOn, PPM, roof, TILE_FILES, type BuildingSpec } from "./build";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** The canvas draws at the screen's real pixels (sharp text, and each art pixel a whole number of them). */
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
/** The game's faces: a pixel font for things in the world, the condensed face for captions. */
const FONT_POP = '"Silkscreen", "Pixelify Sans", monospace';
const FONT_TALK = '"Pixelify Sans", "Silkscreen", monospace';
/** Zoom levels, as camera zooms: whole screen pixels per art pixel (32 art pixels to the metre). The first
 *  shows about 22 screen points to the metre on a phone and 32 on anything bigger; then closer, then further. */
function zoomSteps(): number[] {
  const small = Math.min(window.innerWidth, window.innerHeight) < 520;
  const z = Math.max(1, Math.round(((small ? 22 : 32) * DPR) / 32));
  return [...new Set([z, z + 1, Math.max(1, z - 1)])];
}
const ZOOMS = [0, 1, 2];
const SKIN = [0xf1c7a5, 0xd9a47e, 0xb07a52, 0x8a5a3b, 0x5e3b26, 0xe8b896];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

interface TickerLine { text: string; src: string; big: boolean }

/** A PixelLab picture of an item, if there is one. */
const ICONS = new Set(["pint", "pie", "knife", "whistle", "ticket", "wallet", "laxative", "powder", "shirt_eng", "shirt_por", "shirt_bra", "shirt_arg", "police_uniform", "kit_eng", "kit_opp",
  "staff_pass", "hivis", "ref_kit", "police_hat", "mask", "flat_cap", "sunglasses", "moustache", "tracksuit", "chef_whites", "overalls", "balaclava", "hammer", "flare", "betslip", "face", "hands", "censored_bar"]);
const icon = (def: string) => (ICONS.has(def) ? `<img class="ico" src="icons/${def}.png" alt="" onerror="this.remove()">` : `<span class="ico none"></span>`);

/** The main button's words: short enough for a thumb. The full sentence is still in More. */
function shortLabel(o: Option): string {
  const v = o.action?.verb, L = o.label;
  if (o.sheet?.kind === "shop") return "Buy";
  if (o.sheet?.kind === "bet") return "Bet";
  if (o.sheet?.kind === "bribe") return "Offer money";
  if (o.sheet?.kind === "report") return "Tip off";
  if (o.sheet?.kind === "loot") return "Search";
  const map: Record<string, string> = { talk: "Talk", show: "Show ticket", drive: "Drive the bus", getout: "Get out", hide: "Hide inside", unhide: "Climb out", sit: "Sit down", stand: "Stand up",
    untie: "Untie the dog", release: "Let the dog go", leash: "Grab the dog", sic: "Set the dog on him", servicedog: "\"Service dog\"", alarm: "Pull the fire alarm", vault: "Climb over",
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
  }
  world!: WorldArt;
  worldSprites = new Map<string, Phaser.GameObjects.Image>();
  facade: Phaser.GameObjects.TileSprite | null = null;
  placed: { venue: string; list: Placement[] } = { venue: "", list: [] };

  create() {
    (window as any).__scene = this; // for automated checks
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
    this.game2 = createGame(`day${Date.now() % 100000}`, FIXTURES[campaign.fixture] ?? "qf", campaign);
    this.introFor(campaign);
    this.d3?.buildCrowd(this.s.match!.teams[1]);
    const w = this.w;
    new Commentator(w, w.bus, (l) => this.matchLine(l.text, l.big));
    const TANNOY: Record<string, Clip> = { welcome: VENUE.id === "qf" ? "tannoy_welcome" : "tannoy_welcome_sf", lorry: "tannoy_lorry", pitch: "tannoy_pitch", "2min": "tannoy_2min", teams: "tannoy_teams", cleaner: "tannoy_cleaner", flares: "tannoy_flares", cameras: "tannoy_cameras",
      delay_late: "tannoy_delay_late", delay_ref: "tannoy_delay_ref", delay_pitch: "tannoy_delay_pitch", delay_safety: "tannoy_delay_safety", delay_again: "tannoy_delay_again",
      alarm: "tannoy_alarm", breach: "tannoy_breach", forfeit: "tannoy_forfeit", incident: "tannoy_incident" };
    const ann = new Announcer(w, (a) => {
      this.say(a.text, a.src === "tannoy" ? "Tannoy" : "Commentary", a.big);
      const clip = a.key ? (TANNOY[a.key] ?? (a.key.startsWith("cam") ? "tannoy_supervisor" : undefined)) : undefined;
      if (clip && !(VENUE.id !== "qf" && a.key === "lorry")) this.audio.tannoy(clip, this.hearsMatch() ? 0.9 : 0.5, this.hearsMatch() ? 0 : 0.6);
    });
    (this as any).announcer = ann;
    w.bus.on((e) => this.sounds(e));
    w.bus.on((e) => {
      if (e.type === "say" && e.by !== this.s.stadium!.pc) {
        // Only what is said close by, and only once.
        const a = this.s.actors[e.by];
        if (a && Math.hypot(a.x - this.pc.x, a.y - this.pc.y) < 5.5 && e.text.length > 12 && !this.log.some((l) => l.text === e.text)) this.say(e.text, a.name, false, false);
      }
      if (e.type === "action_failed" && e.action.actor === this.s.stadium!.pc) this.hint(e.reason);
      if (e.type === "fb_goal" || e.type === "caught" || e.type === "fb_foul" && e.penalty) this.setSpeed(1);
      if (e.type === "fb_goal") { this.crowdJump = 120 * (e.team === 0 ? 1 : -1); this.crowdUpUntil = performance.now() + 6000; this.crowdUpSide = e.team === 0 ? "home" : "away"; }
      if (e.type === "fb_miss" || e.type === "fb_woodwork") { this.crowdUpUntil = performance.now() + 1400; this.crowdUpSide = "all"; }
      if (e.type === "stole") this.hint(e.what === "ticket" ? "You lifted a ticket." : `You lifted £${e.amount}.`);
      if (e.type === "ejected" && e.who === this.s.stadium!.pc) this.hint(e.taken.length ? `Thrown out. They took your ${e.taken.join(", ")}.` : "Thrown out. They'll know your face now.");
      if (e.type === "escort_cut" && e.who === this.s.stadium!.pc) { const f = $("fade"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 450); }
      if (e.type === "broke_free" && e.who === this.s.stadium!.pc) this.hint("You broke free. Run!");
      if (e.type === "action" && e.action.actor === this.s.stadium!.pc && e.action.verb === "take" && e.action.item) {
        const it = this.s.items[e.action.item];
        if (it) { this.audio.play("pickup", 0.9); this.toast(it.def, itemName(it), "Picked up"); }
      }
      if (e.type === "bus_stolen" && e.by === this.s.stadium!.pc) this.hint(this.driveView === "map" ? "Steer with the stick. The view button (top right) switches to Chase or Cab." : "Up to go, down to brake, left and right to steer. Beep (or H) freezes everyone in front so they can't dive clear. The view button switches Chase, Cab and Map.");
      if (e.type === "killed" && e.by === this.s.stadium!.pc) this.hint("He's dead. You're covered in his blood: change your top or everyone will see it.");
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
      : `${VENUE.ground}, against ${opp}. You have £${c.money}${kit.length ? ` and you've brought: ${kit.join(", ").toLowerCase()}` : ""}. ${notorietyText(c.notoriety)} This ground has metal detectors and face-recognition cameras at the turnstiles, and staff need a pass.`;
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
        // A blow: the swing, the smack, the crowd's gasp; then the world holds still for a beat,
        // the camera jolts, the victim flashes white and flies back spraying blood.
        const by = s.actors[e.by], who = s.actors[e.who];
        if (!by || !who) break;
        if (e.by === pcId) this.fp.punchAt = performance.now();
        if (e.horse) { a.play("trample", 0.4 + near(who.x, who.y, 35) * 0.6, { minGap: 0.1 }); this.impact(e.by, e.who, e.dx, e.dy, 1.2, near(who.x, who.y, 35)); break; }
        const v = near(who.x, who.y, 35);
        a.play("whoosh", 0.25 + v * 0.5, { minGap: 0.05, rate: 0.9 + Math.random() * 0.25 });
        a.play(e.weapon ? "weaponhit" : (["hit1", "hit2", "hit3"] as const)[Math.floor(Math.random() * 3)], 0.35 + v * 0.65, { minGap: 0.05, rate: 0.9 + Math.random() * 0.2 });
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
      case "gunshot": a.play("gunshot", 0.5 + near(e.x, e.y, 60) * 0.5, { minGap: 0.15 }); this.flash = { x: e.x, y: e.y, until: s.tick + 5 }; break;
      case "killed": {
        a.play("scream", 0.3 + near(e.x, e.y, 30) * 0.7, { minGap: 1 }); a.play("stab", 0.9);
        const who = s.actors[e.who], by = e.by ? s.actors[e.by] : null;
        if (who) {
          const dx = by ? who.x - by.x : 0, dy = by ? who.y - by.y : 1, l = Math.hypot(dx, dy) || 1;
          this.impact(e.by ?? e.who, e.who, dx / l, dy / l, 2.2, near(e.x, e.y, 35));
          this.pools.push({ x: who.x, y: who.y + 0.1, r: 0.1, max: 1.3, grow: 0.5 });
        }
        break;
      }
      case "mauled": case "flayed": {
        const who = s.actors[e.who];
        if (who) { this.spray(who.x, who.y, 1.3, Math.random() * 2 - 1, Math.random() * 2 - 1, 22, 1.4); this.pools.push({ x: who.x, y: who.y + 0.1, r: 0.1, max: 0.9, grow: 0.35 }); }
        break;
      }
      case "body_found": a.play("scream", 0.3 + near(e.x, e.y, 40) * 0.7, { minGap: 2 }); break;
      case "armed_challenge": { const o = s.actors[e.by]; if (o) a.play("armed_police", 0.4 + near(o.x, o.y, 35) * 0.6, { minGap: 3 }); break; }
      case "disarmed": a.play("stw_knife", 1); break;
      case "glory_hole": this.stall.event(e.what); break;
      case "knockout": {
        const who = s.actors[e.who];
        if (who) { this.popup(who.x, who.y, e.quiet ? "TAKEDOWN" : "KO!", e.quiet ? "#f2c94c" : "#ff4d5e"); if (e.quiet) a.play("bodyfall", 0.6, { minGap: 0.1 }); }
        if (e.who === pcId) this.say(`You're out cold. You come round${e.lost ? ` £${e.lost} lighter` : ""}.`, "", true);
        break;
      }
      case "looted": { const who = s.actors[e.who]; if (who && e.money) { this.popup(who.x, who.y, `+£${e.money}`, "#f2c94c"); a.play("kaching", 0.7); } break; }
      case "unseated": a.play("whinny", 1); a.play("bodyfall", 0.9); this.popup(e.x, e.y, "UNSEATED!", "#ff4d5e"); break;
      case "mounted": a.play("whinny", 0.8); if (e.by === pcId) this.startCine(1600, { zoomAdd: 0, caption: "Tally ho" }); break;
      case "horse_jump": a.play("whinny", 0.4, { minGap: 2 }); break;
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
          "You're coming with me.": "stw_coming", "Stop wriggling!": "stw_wriggle", "Staff only, mate.": "stw_staff",
        };
        if (VOICE[e.text]) a.play(VOICE[e.text], 0.35 + v * 0.65, { minGap: 1.5 });
        else if (VOICES[e.text] && v > 0.05) {
          const who = s.actors[e.by], woman = who && this.spriteFor(who).base === "woman";
          a.play(`${VOICES[e.text]}${woman ? "_f" : ""}` as Clip, 0.25 + v * 0.75, { minGap: 0.3, rate: 0.95 + (Math.abs(hash(e.by ?? "")) % 10) / 100 });
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
    const FLOOR_OF: Record<string, string> = {
      street: "slabs", plaza: "slabs", road: "asphalt", eastroad: "asphalt", carpark: "tarmac", hotel_court: "slabs", ticket_office: "slabs", merch: "slabs",
      pub_yard: "herringbone", verge: "grass", concourse_s: "concourse", concourse_w: "concourse", concourse_e: "concourse", corner_sw: "concourse", corner_se: "concourse",
      corner_nw: "concourse", corner_ne: "concourse", loading: "gravel", staffway: "lino", players: "lino", tunnel: "lino", security: "office", ref_room: "lino",
      dress_home: "rubber", dress_away: "rubber", kitchen: "quarry", bar_s: "boards", toilet_s: "whitetile", cubicle_s: "whitetile", pub: "pubcarpet", pub_toilet: "whitetile",
      pub_cubicle: "whitetile", cabin: "office", hotel: "office", charity: "boards", surplus: "lino", bookies: "office",
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
      this.groundTiles.push(ts);
    }
    // Road markings.
    const detail = this.detailG; detail.clear();
    g = detail;
    g.fillStyle(0xd8d2b8, 0.7);
    for (let x = -88; x < 90; x += 6) g.fillRect(...P.rect(x, 87.9, 3, 0.25));
    for (let y = -46; y < 90; y += 6) g.fillRect(...P.rect(66.9, y, 0.25, 3));
    // Kerbs along the roads, and marked bays in the car park.
    const mx = (x: number) => (VENUE.id === "sf" ? -x : x);
    g.fillStyle(0xb9bdb6, 1);
    g.fillRect(...P.rect(-92, 83.8, 184, 0.25)).fillRect(...P.rect(-92, 92, 184, 0.25));
    g.fillRect(...P.rect(Math.min(mx(61.8), mx(62.05)), -50, 0.25, 134)).fillRect(...P.rect(Math.min(mx(71.8), mx(72.05)), -50, 0.25, 134));
    g.fillRect(...P.rect(-60, 59.9, 120, 0.2));
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
    if (this.pc?.seated) return Math.min(w / (60 * this.P.S), h / (44 * this.P.S * this.P.K));
    // Whole screen pixels per art pixel, so every pixel of the art is the same size; a bigger screen shows more.
    const steps = zoomSteps();
    if (this.cine && !this.pc?.seated) return steps[Math.min(this.zoomLevel, steps.length - 1)] + this.cine.zoomAdd;
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
    const st = this.s.stadium!;
    if (!st.ending) {
      this.applyInput();
      const ann = (this as any).announcer as Announcer;
      const slow = performance.now() < this.slowUntil ? 0.3 : 1;
      if (performance.now() >= this.hitStopUntil) this.stepper.advance((dms * slow) / 1000, () => { stepGame(this.game2); ann.tick(); this.applyInput(); }, 24);
    }
    if (st.ending && $("ending").hidden && !this.endingShown) { this.endingShown = true; this.showEnding(); }
    if (!st.ending) this.endingShown = false;
    this.draw(dms);
    const driving = st.vehicles.bus?.drivenBy === this.pc?.id;
    ($("viewBtn") as HTMLElement).hidden = !driving;
    ($("hornBtn") as HTMLElement).hidden = !driving;
    this.audio.engineOn(driving && !st.ending, st.vehicles.bus?.speed ?? 0);
    if (st.horse?.rider === this.pc?.id && st.horse!.speed > 3) this.audio.play("hooves", 0.25 + st.horse!.speed / 20, { minGap: 2.6 });
    if (this.inCab()) this.d3.draw(this.s, this.driveView, this.scale.width / DPR, this.scale.height / DPR, (a) => this.styleOf(a), this.pc.drive?.steer ?? 0, this.cameras.main.zoom, DPR);
    else { this.d3.hide(); this.d3.hideSpeed(); }
    this.drawHud();
    if (this.fp.on && this.pc) this.drawFirstPerson();
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
  }

  /** Everyone and everything near you, as billboards for the first-person view. */
  drawFirstPerson(): void {
    const s = this.s, pc = this.pc, out: FpSprite[] = [];
    const tex = (key: string) => (this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as HTMLCanvasElement) : null);
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a === pc || a.hiddenIn || (a.fb && a.fb.status === "gone") || Math.abs(a.x - pc.x) > 40 || Math.abs(a.y - pc.y) > 40) continue;
      if (a.npc?.job === "dog") continue;
      const { base, rc } = this.spriteFor(a);
      if (!this.bank.has(base)) continue;
      const key = this.bank.variant(base, rc), cell = cellOf(base);
      const toMe = Math.atan2(pc.y - a.y, pc.x - a.x), di = dirIndex(Math.PI / 2 + (a.facing - toMe));
      const down = a.dead || a.downUntil > s.tick;
      const fall = tex(`${key}-fall`), walk = tex(`${key}-walk`), moving = Math.hypot(a.vx, a.vy) > 0.4;
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
  drops: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number }[] = [];
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

  /** Move the blood in the air; what lands becomes a spot on the floor that stays. */
  stepGore(dms: number): void {
    const P = this.P, dt = Math.min(0.05, dms / 1000), S = P.S;
    const g = this.decalG;
    if (this.decals > 1500) { g.clear(); this.decals = 0; }
    this.drops = this.drops.filter((d) => {
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 14 * dt; d.vx *= 0.97; d.vy *= 0.97;
      if (d.z > 0) return true;
      const r = Math.max(1, Math.round(d.r * S * (0.8 + Math.random() * 0.6)));
      g.fillStyle(Math.random() < 0.5 ? 0x6e0b0b : 0x8a1010, 0.9).fillRect(Math.round(P.sx(d.x, d.y)), Math.round(P.sy(d.x, d.y)), r, Math.max(1, Math.round(r * 0.7)));
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

    // Items lying around, and fixtures.
    for (const id in s.items) {
      const it = s.items[id], l = it.loc;
      if (l.k !== "ground" && l.k !== "air") continue;
      if (it.def === "lorry_cargo" || (sprites && it.def === "police_box")) continue;
      const def = defOf(it), x = l.x, y = l.y, z = l.k === "air" ? l.z : 0;
      if (!onScreen(x, y)) continue;
      const near = pc && Math.hypot(pc.x - x, pc.y - y) < 2.6;
      if (sprites && def.size !== "huge" && ICONS.has(it.def) && this.textures.exists(`ico-${it.def}`)) {
        // Its picture, half size (a 48 px icon is 0.75 m across), lying where it fell or flying.
        this.shadowG.fillStyle(0x000000, 0.3).fillEllipse(Math.round(P.sx(x, y)), Math.round(P.sy(x, y)), P.S * 0.6, P.S * 0.22);
        things.push({ d: y, draw: () => {}, spr: (dep) => {
          let im = this.worldSprites.get(`item-${id}`);
          if (!im) { im = this.add.image(0, 0, `ico-${it.def}`); this.worldSprites.set(`item-${id}`, im); }
          this.worldSeen.add(`item-${id}`);
          im.setTexture(`ico-${it.def}`).setOrigin(0.5, 0.9).setScale(0.5).setPosition(Math.round(P.sx(x, y)), Math.round(P.sy(x, y, z))).setDepth(dep).setVisible(true).setAlpha(1).setAngle(l.k === "air" ? (tick * 12) % 360 : 0);
        } });
        if (near && l.k === "ground") things.push({ d: y + 1e-4, draw: () => g.lineStyle(3, 0xf2c94c, 0.5 + 0.4 * Math.sin(tick * 0.15)).strokeCircle(P.sx(x, y), P.sy(x, y) - P.S * 0.2, P.S * 0.55) });
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
          const di = dirIndex(hs.facing), anim = hs.speed > 6 && this.textures.exists(`${key}-run`) ? "run" : hs.speed > 0.4 && this.textures.exists(`${key}-walk`) ? "walk" : this.textures.exists(`${key}-idle`) ? "idle" : null;
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
      if (a.dead) things.push({ d: a.y - 0.4, draw: () => g.fillStyle(0x6a0a0a, 0.85).fillEllipse(P.sx(a.x, a.y), P.sy(a.x, a.y), P.S * 2.4, P.S * (P.standing ? 1.1 : 1.8)) });
      if (a.npc?.job === "dog") { things.push({ d: a.y, draw: () => this.drawDog(a, g) }); continue; }
      const st2 = this.styleOf(a), moving = Math.hypot(a.vx, a.vy) > 0.4;
      const shiver = (a.effects.frozen ?? 0) > tick ? Math.sin(tick * 1.7 + hash(a.id)) * 0.06 : 0;
      if (!sprites) { things.push({ d: a.y, draw: () => drawFigure(g, P, a.x + shiver, a.y, a.facing, st2, tick + hash(a.id), moving) }); continue; }
      // Shadow and ring on the ground, the sprite, then anything worn on the head.
      const sh = this.shadowG, Wd = 0.5 * (st2.girth ?? 1) * P.S, gx = P.sx(a.x, a.y), gy = P.sy(a.x, a.y);
      if (!a.seated) sh.fillStyle(0x000000, 0.28).fillEllipse(gx, gy, Wd * 2.2, Wd * 0.9 * (P.standing ? 1 : 2));
      if (st2.ring) sh.lineStyle(3, st2.ring, 1).strokeEllipse(gx, gy, Wd * 2.9, Wd * (P.standing ? 1.25 : 2.9));
      seenSprites.add(a.id);
      things.push({ d: a.y, draw: () => {}, spr: (depth) => this.placeSprite(a, st2, shiver, moving, depth) });
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
      const left = (c.until - tick) / (60 * 25);
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + tick * 0.004, rr = c.r * (0.45 + 0.35 * Math.sin(i * 1.7 + tick * 0.01));
        const x = c.x + Math.cos(a) * rr * 0.7, y = c.y + Math.sin(a) * rr * 0.5;
        g.fillStyle(i % 2 ? 0xd9d9d4 : 0xbfc0bb, 0.55 * Math.min(1, left * 3)).fillEllipse(P.sx(x, y), P.sy(x, y, 1.2), c.r * P.S * 0.9, c.r * P.S * 0.6 * (P.standing ? P.K : 1));
      }
      g.fillStyle(0xff5a36, 0.8).fillCircle(P.sx(c.x, c.y), P.sy(c.x, c.y), 3);
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
      const inside = !!pc && (!here?.outside && !here?.seats && !here?.pitch || this.blds.some((b) => pc.x > b.rect.x0 && pc.x < b.rect.x1 && pc.y > b.rect.y0 && pc.y < b.rect.y1));
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
      const tgt = pc.hand && hasProp(s.items[pc.hand], "throwable") || (pc.hand && defOf(s.items[pc.hand]).size === "small") ? throwTarget(this.w, pc, this.picked) : null;
      (this as any).throwAt = tgt;
      if (tgt) {
        const tx = P.sx(tgt.x, tgt.y), ty = P.sy(tgt.x, tgt.y) - (P.standing ? 0.9 * P.KZ * P.S : 0);
        ui.lineStyle(2 * u, 0xf2c94c, 0.9).strokeCircle(tx, ty, P.S * 0.9);
        ui.lineBetween(tx - P.S * 1.2, ty, tx - P.S * 0.6, ty).lineBetween(tx + P.S * 0.6, ty, tx + P.S * 1.2, ty);
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
        if (n.shop || n.job === "barman") {
          ui.fillStyle(0xf2c94c, 1).fillCircle(tx, ty - 4 * u, 5 * u);
          ui.fillStyle(0x7a5a10, 1).fillRect(tx - u, ty - 7 * u, 2 * u, 6 * u);
        } else if (n.target === pc.id && (n.mode === "approach" || n.mode === "chase" || n.mode === "escort")) {
          ui.fillStyle(0xd7263d, 1).fillTriangle(tx - 6 * u, ty, tx + 6 * u, ty, tx, ty - 11 * u);
          ui.fillStyle(0xffffff, 1).fillRect(tx - u, ty - 8 * u, 2 * u, 4 * u).fillRect(tx - u, ty - 3 * u, 2 * u, 2 * u);
        } else if (n.target === pc.id && n.mode === "watch") {
          ui.lineStyle(2 * u, 0xf2c94c, 0.9).strokeCircle(tx, ty - 4 * u, 4 * u);
        }
      }
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
    }

    // Speech bubbles near the player.
    const talkers = Object.values(s.actors).filter((a) => a.npc?.bubble && !a.hiddenIn && onScreen(a.x, a.y)).slice(0, this.bubbles.length);
    if (!this.bubbleG) this.bubbleG = this.add.graphics().setDepth(1e7 + 0.5);
    const bg = this.bubbleG.clear(), zz = this.cameras.main.zoom, px = DPR / zz;
    this.bubbles.forEach((bt, i) => {
      const a = talkers[i];
      if (!a) { bt.setVisible(false); return; }
      // A comic bubble: same size on screen whatever the zoom, a black pixel outline and a tail.
      const tx = Math.round(P.sx(a.x, a.y)), ty = Math.round(headTop(P, a.x, a.y) - 10 * px);
      bt.setVisible(true).setText(a.npc!.bubble!.text).setPosition(tx, ty).setScale(1 / zz);
      const sec = a.npc!.mode !== "routine" && a.npc!.mode !== "escort";
      const w2 = bt.displayWidth, h2 = bt.displayHeight, x0 = tx - w2 / 2, y0 = ty - h2;
      bg.fillStyle(0x000000, 1).fillRect(x0 - 2 * px, y0 - 2 * px, w2 + 4 * px, h2 + 4 * px).fillRect(x0, y0 - 4 * px, w2, h2 + 8 * px);
      bg.fillStyle(sec ? 0xffd166 : 0xf6f3ea, 1).fillRect(x0, y0, w2, h2).fillRect(x0 + 2 * px, y0 - 2 * px, w2 - 4 * px, h2 + 4 * px);
      bg.fillStyle(0x000000, 1).fillTriangle(tx - 7 * px, ty + 1 * px, tx + 3 * px, ty + 1 * px, tx - 6 * px, ty + 10 * px);
      bg.fillStyle(sec ? 0xffd166 : 0xf6f3ea, 1).fillTriangle(tx - 5 * px, ty, tx + 1 * px, ty, tx - 5 * px, ty + 6 * px);
    });

    // Camera: follow the player; sitting down gives the TV view of the pitch.
    let tx: number, ty: number;
    if (pc?.seated) {
      tx = clamp(P.sx(b.x, b.y), P.sx(-HL + 18, 0), P.sx(HL - 18, 0)); ty = P.sy(0, clamp(b.y, -HW + 8, HW - 8) * 0.6);
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
    const k = 1 - Math.pow(0.004, Math.min(dms, 100) / 1000);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    const zt = this.targetZoom();
    if (Math.abs(cam.zoom - zt) > 0.001) cam.setZoom(cam.zoom + (zt - cam.zoom) * Math.min(1, k * 1.5));
    cam.centerOn(this.camX, this.camY);
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
        const fk = `fac-${VENUE.id}-${b.id}`, rk = `roof-${VENUE.id}-${b.id}`;
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

    // Buildings: a front and a roof from outside; just low walls once you're in.
    const cut = new Set<string>();
    for (const b of this.blds) {
      if (free && inRect(pc.x, pc.y, b.rect, 0.3)) { cut.add(b.id); continue; }
      const { x0, y0, x1, y1 } = b.rect, H = b.height;
      if (!onScreen((x0 + x1) / 2, (y0 + y1) / 2, 500 + (x1 - x0) * 8)) continue;
      // See-through while you're round the back of it.
      const hid = free && pc.x > x0 - 0.5 && pc.x < x1 + 0.5 && pc.y < y1 && pc.y > y0 - H - 1;
      const a = hid ? 0.4 : 1;
      if (hid) this.pcHidden = true;
      // Its shadow falls to the bottom right: light from the top left, like every other thing here.
      this.shadowG.fillStyle(0x000000, 0.26).fillRect(Math.round(P.sx(x1, 0)), Math.round(P.sy(0, y0 + 1)), Math.round(Math.min(2.2, H * 0.4) * S), Math.round((y1 - y0 - 0.5) * S));
      this.shadowG.fillStyle(0x000000, 0.2).fillRect(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1)), Math.round((x1 - x0) * S), 4);
      things.push({ d: y1 - 1e-3, draw: () => {}, spr: (dep) => image(`roof-${b.id}`, `roof-${VENUE.id}-${b.id}`).setOrigin(0).setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y0) - H * S)).setDepth(dep).setAlpha(a) });
      things.push({ d: y1, draw: () => {}, spr: (dep) => image(`fac-${b.id}`, `fac-${VENUE.id}-${b.id}`).setOrigin(0, 1).setPosition(Math.round(P.sx(x0, 0)), Math.round(P.sy(0, y1))).setDepth(dep).setAlpha(a) });
    }

    // Props and clutter, at 1:1.
    for (const p of this.placed.list) {
      if (!onScreen(p.x, p.y, 300)) continue;
      if (p.key === "floodlight") continue;
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
    const ins = !!pc && (VENUE.inside(pc.x, pc.y) || !!pc.seated) && !pc.hiddenIn;
    const H = 9;
    const gx0 = VENUE.id === "qf" ? -57 : -56.5, gx1 = VENUE.id === "qf" ? 56.5 : 57;
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
          tile(`face${i}`, b.front ? "mat-clad" : "mat-seats_h", x, bot, w, lift, dep + 0.1, near ? 0.45 : 1).setTint(b.front ? 0xffffff : 0x8a8f99);
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
        xs.forEach((x, i) => image(`tst${i}`, "k-turnstile").setOrigin(0.5, tx.foot / 160).setPosition(Math.round(P.sx(x, 0)), Math.round(P.sy(0, 45))).setDepth(dep + 0.01).setAlpha(nearF ? 0.45 : 1));
      } });
    }
    // Advertising boards round the pitch: made-up sponsors facing the cameras on the far side
    // and the ends; on the near side you see their backs.
    {
      const ADS: [string, number, number][] = [["STELLAR LAGER", 0xc8102e, 0xf4f1ea], ["GREGGORS PIES", 0x1b3a8a, 0xf2c94c], ["KWIKLOAN 1999%", 0x2f9e5a, 0xffffff],
        ["LUCKY LIONEL'S", 0x3d2a6b, 0xf2c94c], ["VAPE CITY", 0x111111, 0x6cf0ff], ["NO WIN NO FEE", 0xf2c94c, 0x111111], ["PIE & MASH", 0xf4f1ea, 0x1b2a6b], ["BET RESPONSIBLY", 0x222222, 0xd7263d]];
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
    return out;
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
    if (job && ["turnstile", "doorguard", "gateguard", "pitchsteward", "patrol", "corridor", "chief"].includes(job)) return { base: "steward", rc: {}, h: 1.8 };
    if (job === "police" && a.npc?.mounted && this.bank.has("horse")) return { base: "horse", rc: {}, h: 2.6 };
    if (job === "police") return { base: "police", rc: {}, h: 1.85 };
    if (job === "armed") return { base: "steward", rc: { vest: 0x2a2d33, legs: 0x1a1a1a }, h: 1.85 };
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
    } else if (inner && inner.id !== "shirt_eng") { rc.shirt = inner.colour; rc.trim = inner.colour2; }
    // Shopkeepers who look the part.
    const shop = a.npc?.shop;
    if (shop === "charity" && this.bank.has("woman")) return { base: "woman", rc: { shirt: 0xb07ab0, trim: 0x5a3a5a, skin: rc.skin }, h: 1.6 };
    if (shop === "surplus" && this.bank.has("bigman")) return { base: "bigman", rc: { skin: rc.skin }, h: 1.85 };
    if (shop === "bookies" && this.bank.has("suit")) return { base: "suit", rc: { skin: rc.skin }, h: 1.75 };
    if (a.name === "Barmaid" && this.bank.has("woman")) return { base: "woman", rc: { shirt: 0x222222, trim: 0x222222, skin: rc.skin }, h: 1.6 };
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
    // Shirt off: the belly.
    if (!outer && !a.worn.inner && !a.fb && (isPc || job === "fan")) { delete rc.shirt; delete rc.trim; return { base: "fanbare", rc, h: big }; }
    // Not everyone is the same fat bloke: lads, women, old boys and big lads too.
    if (!isPc && (job === "fan" || job === "local") && !outer) {
      const n = Math.abs(hash(a.id + "b")) % 20;
      const body: Base = n < 8 ? "fan" : n < 12 ? "lad" : n < 15 ? "woman" : n < 17 ? "oldboy" : n < 19 ? "bigman" : "suit";
      if (body !== "fan" && this.bank.has(body)) return { base: body, rc: body === "lad" || body === "woman" ? rc : { skin: rc.skin }, h: big };
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
    const x = Math.round(P.sx(a.x + shiver, a.y)), y = Math.round(P.sy(a.x, a.y));
    sp.setVisible(true).setDepth(depth).setScale(scale).setAlpha(st2.alpha ?? 1);
    const now = performance.now(), has = (sheet: string) => this.textures.exists(`${key}-${sheet}`);
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
    const dragged = a.dragging ? this.s.actors[a.dragging] : null;
    if (dragged && has("drag")) {
      // Hauling a body: bent over it, walking backwards.
      const n = this.frames(`${key}-drag`), f = moving ? Math.floor((tick + Math.abs(hash(a.id)) % 50) * 0.12) % n : 0;
      sp.setTexture(`${key}-drag`, dirIndex(Math.atan2(dragged.y - a.y, dragged.x - a.x)) * n + f);
    } else if (a.id === this.s.stadium!.pc && this.sheetKind === "loot" && has("search")) {
      const n = this.frames(`${key}-search`);
      sp.setTexture(`${key}-search`, di * n + Math.floor(tick * 0.12) % n);
    } else if (moving && !a.seated && has("run") && Math.hypot(a.vx, a.vy) > 4.8) {
      const n = this.frames(`${key}-run`);
      sp.setTexture(`${key}-run`, di * n + Math.floor((tick + Math.abs(hash(a.id)) % 50) * 0.22) % n);
    } else if (moving && !a.seated) {
      // The walk cycle, paced to how fast they're going.
      const rate = Math.min(1.6, Math.hypot(a.vx, a.vy) / 2.2) * (base === "fan" || base === "fanbare" || base === "bigman" ? 0.13 : 0.18);
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
    if (lg && la < 1 && !a.seated) {
      const d = this.P.dir(lg.dx, lg.dy), push = Math.sin(Math.min(1, la * 1.6) * Math.PI) * 7;
      lx = Math.round(d.x * push); ly = Math.round(d.y * push);
      if (has("punch")) { const n = this.frames(`${key}-punch`); sp.setTexture(`${key}-punch`, dirIndex(Math.atan2(lg.dy, lg.dx)) * n + Math.min(n - 1, Math.floor(la * n))); }
      else sp.setTexture(`${key}-rot`, dirIndex(Math.atan2(lg.dy, lg.dx)));
    } else if (lg) this.lunge.delete(a.id);
    if (flashing) sp.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    if (a.seated) {
      // Only the top half shows over the seat in front.
      sp.setCrop(0, 0, CELL, 52);
      sp.setPosition(x, y + (FEET - 52) * scale * 0.8);
    } else { sp.setCrop(); sp.setPosition(x + lx, y + ly); }
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
    } else if (st2.hat) g.fillStyle(st2.hat, 1).fillEllipse(x, top + hw * 0.5, hw * 2.2, hw * 1.1).fillRect(x - hw * 1.4, top + hw * 0.8, hw * 2.8, hw * 0.3);
    if (st2.face) {
      const fy = top + hw * 1.6;
      if (st2.face.kind === "full") g.fillStyle(st2.face.colour, 1).fillEllipse(x, fy, hw * 2, hw * 2.3);
      else if (st2.face.kind === "tache") g.fillStyle(st2.face.colour, 1).fillRect(x - hw * 0.6, fy + hw * 0.45, hw * 1.2, hw * 0.3);
      else g.fillStyle(st2.face.colour, 1).fillRect(x - hw * 0.8, fy - hw * 0.15, hw * 1.6, hw * 0.35);
    }
    if ((a.effects.bloody ?? 0) > tick) {
      g.fillStyle(0x8a0a0a, 0.85);
      for (let i = 0; i < 5; i++) g.fillCircle(x + Math.sin(i * 2.1 + hash(a.id)) * hw * 1.4, top + hw * (3 + (i % 3) * 1.2), hw * 0.35);
    }
  }

  /** A stocky brown dog, side-on, legs going when it runs. The lead, if somebody has it. */
  drawDog(a: Actor, g: Phaser.GameObjects.Graphics) {
    // Tyson: a pit bull. Low, wide, all chest and jaw; brindle with a white bib and a studded collar.
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
    const where = busV?.drivenBy === pc.id ? `Driving the ${m.teams[1].name} team bus` : pc.hiddenIn ? (pc.hiddenIn === busV?.cargo ? "Hiding in the bus's luggage hold" : `Hiding in the back of the ${VENUE.delivery.name}`) : pc.heldBy ? "Being frogmarched"
      : bad ? `${area.name} · you shouldn't be here` : fresh ? area.name : this.objective();
    const wEl = $("where");
    if (wEl.textContent !== where) wEl.textContent = where;
    wEl.classList.toggle("bad", bad && !pc.hiddenIn);
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

    // Buttons.
    if (s.tick % 6 === 0 || !this.opts.length) {
      this.opts = options(this.w, pc, this.picked);
      const p = primary(this.opts);
      const act = $<HTMLButtonElement>("act");
      act.disabled = !p;
      act.hidden = !p;
      act.textContent = p ? shortLabel(p) : "";
      this.primaryAt = p ? this.optionSpot(p) : null;
      const thr = $("throw");
      const ta = (this as any).throwAt as Actor | null;
      const canThrow = !!pc.hand && !pc.heldBy && !pc.hiddenIn;
      thr.hidden = !canThrow;
      if (canThrow) thr.textContent = ta ? `Throw at ${personName(ta).replace(/ \(.*\)$/, "")}` : `Throw ${itemName(s.items[pc.hand!]).toLowerCase()}`;
      const hit = $("hit"), hitOpt = this.opts.find((o) => o.action?.verb === "strike");
      hit.hidden = !hitOpt || !!pc.heldBy || !!pc.hiddenIn;
      if (hitOpt) { hit.textContent = hitOpt.label.replace(/ \(.*\)$/, "").replace(/^(Punch|Stab) the /, "$1 the ").split(" ").slice(0, 3).join(" "); (this as any).hitOpt = hitOpt; }
      const betEl = $("betBtn");
      betEl.hidden = canBetHere(this.w, pc) !== "phone" || !!pc.heldBy;
      const canFast = pc.seated || area.id === "pub";
      $("speed").hidden = !canFast;
      if (!canFast && this.speed !== 1) this.setSpeed(1);
      if (this.sheetKind === "more") this.openMore();
    }
  }

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
  run(opt: Option | null) {
    if (!opt || !this.started) return;
    if (opt.sheet) { const k = opt.sheet.kind; k === "shop" ? this.openShop(opt.sheet.who) : k === "bet" ? this.openBet() : k === "report" ? this.openReport() : k === "loot" ? this.openLoot(opt.sheet.who) : this.openBribe(opt.sheet.who); return; }
    if (opt.action) {
      const before = this.pc.seated;
      const r = dispatch(this.w, opt.action);
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
  sheet(kind: string, html: string) {
    const el = $("sheet");
    this.sheetKind = kind;
    el.innerHTML = html + `<button class="close" data-close="1">Close</button>`;
    el.hidden = false;
  }
  closeSheet() { $("sheet").hidden = true; this.sheetKind = null; }

  openMore() {
    const opts = this.opts.filter((o) => o.action || o.sheet);
    const html = `<h2>What do you want to do?</h2><div class="list">${opts.length ? opts.map((o, i) => `<button data-opt="${i}">${esc(o.label)}</button>`).join("") : "<p>Nothing nearby. Walk up to people and things.</p>"}</div>`;
    const prev = $("sheet").innerHTML;
    if (this.sheetKind === "more" && prev.startsWith(html.slice(0, 200)) && prev.includes(html.slice(-60))) return;
    (this as any).moreOpts = opts;
    this.sheet("more", html);
  }

  openShop(who: string) {
    const seller = this.s.actors[who], shop = SHOPS[seller.npc!.shop!];
    const rows = Object.entries(shop.stock).map(([def, price]) => {
      const poor = this.pc.money < price;
      return `<button class="ware${poor ? " poor" : ""}" data-buy="${def}" data-who="${who}" data-price="${price}">${icon(def)}<span class="nm">${esc(ITEM_DEFS[def].name)}</span><span class="pr">£${price}</span></button>`;
    }).join("");
    this.sheet("shop", `<h2>${esc(shop.name)}</h2><p class="purse">You have <b>£${this.pc.money}</b></p><div class="wares">${rows}</div>`);
  }

  /** A purchase: the till, the money going down, the thing flying into your bag. */
  bought(btn: HTMLElement, def: string, price: number): void {
    this.audio.play("kaching", 1);
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
    this.sheet("bet", `<h2>${where === "phone" ? "Betting app" : "Bookmaker"}</h2><p>You have £${pc.money}. Settled on the official result only.</p><div class="list">${rows}</div>${slipHtml}`);
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

  openBag() {
    const s = this.s, pc = this.pc;
    const where = (it: Item) => (it.loc.k === "hand" ? "In your hand" : it.loc.k === "pocket" ? "In a pocket" : it.loc.k === "worn" ? "Wearing" : "");
    const items = [pc.hand, ...pc.pockets, ...Object.values(pc.worn)].filter((x): x is string => !!x).map((id) => s.items[id]);
    const rows = items.map((it) => {
      const opts = itemOptions(this.w, pc, it);
      (this as any)[`bag_${it.id}`] = opts;
      const extra = it.def === "ticket" ? (it.void ? " (cancelled)" : it.used ? " (scanned)" : "") : it.spiked ? " (spiked)" : "";
      return `<div class="item bagged">${icon(it.def)}<div class="col"><span class="where">${where(it)}</span><b>${esc(itemName(it))}${extra}</b></div><div class="row">${opts.map((o, i) => `<button data-bag="${it.id}" data-i="${i}">${esc(o.label)}</button>`).join("")}</div></div>`;
    }).join("");
    this.sheet("bag", `<h2>Bag</h2><p>£${pc.money} in cash. Pockets: ${pc.pockets.length} of 3.</p><div class="list">${rows || "<p>Nothing.</p>"}</div>`);
  }

  openMenu() {
    const cps = this.game2.checkpoints;
    this.sheet("menu", `<h2>Paused</h2><p>Go back to a checkpoint. Everything since then is undone, and the match will not play out the same way.</p>
      <div class="list">${cps.map((c) => `<button data-cp="${c.id}">${esc(c.label)}</button>`).join("")}<button data-new="1">Start a new match day</button><button data-mute="1">${this.audio.muted ? "Sound: off" : "Sound: on"}</button></div>
      <h2>What you've heard</h2><div class="log">${this.log.slice(-12).reverse().map((l) => `<p><b>${esc(l.src)}</b> ${esc(l.text)}</p>`).join("") || "<p>Nothing yet.</p>"}</div>`);
    this.setSpeed(0);
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
    const cps = $("endCps");
    cps.textContent = "";
    if (e.kind === "through" && this.game2.campaign.fixture < FIXTURES.length - 1) {
      const go = document.createElement("button"); go.textContent = "Continue to the semi-final"; go.className = "primary"; go.dataset.next = "1"; cps.appendChild(go);
    } else if (e.kind === "through") {
      const p = document.createElement("p"); p.textContent = "England are in the final. The final hasn't been built yet."; cps.appendChild(p);
    }
    for (const c of this.game2.checkpoints) { const b = document.createElement("button"); b.textContent = `Back to: ${c.label}`; b.dataset.cp = c.id; cps.appendChild(b); }
    const nb = document.createElement("button"); nb.textContent = "Restart the tournament"; nb.dataset.new = "1"; cps.appendChild(nb);
    $("ending").hidden = false;
  }

  // ---------- Wiring ----------
  wireHud() {
    $("start").addEventListener("click", () => { $("intro").hidden = true; this.started = true; void this.audio.unlock(); });
    $("prepGo").addEventListener("click", () => {
      if (!this.pendingCampaign) return;
      $("prep").hidden = true;
      this.newGame(this.pendingCampaign);
      this.pendingCampaign = null;
      this.setSpeed(1);
    });
    // Phones may suspend audio; any tap brings it back.
    window.addEventListener("pointerdown", () => { if (this.started) void this.audio.unlock(); });
    $("act").addEventListener("click", () => this.run(primary(this.opts)));
    $("throw").addEventListener("click", () => this.throwNow());
    $("betBtn").addEventListener("click", () => (this.sheetKind === "bet" ? this.closeSheet() : this.openBet()));
    $("hit").addEventListener("click", () => this.run((this as any).hitOpt ?? null));
    $("moreBtn").addEventListener("click", () => (this.sheetKind === "more" ? this.closeSheet() : this.openMore()));
    $("bagBtn").addEventListener("click", () => (this.sheetKind === "bag" ? this.closeSheet() : this.openBag()));
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
      if (d.buy) {
        const r = dispatch(this.w, { verb: "buy", actor: this.pc.id, target: { k: "actor", id: d.who! }, arg: d.buy });
        if (r.ok) this.bought(b, d.buy, +(d.price ?? 0));
        else { this.audio.play("nope", 0.8); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); this.hint(r.reason === "not enough money" ? "You can't afford that." : r.reason ?? ""); }
        setTimeout(() => this.sheetKind === "shop" && this.openShop(d.who!), 420);
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
        if (o?.action) {
          const def = this.s.items[o.action.item ?? ""]?.def;
          const r = dispatch(this.w, o.action);
          if (!r.ok) { this.audio.play("nope", 0.8); this.hint(r.reason ?? ""); }
          else {
            const v = o.action.verb;
            const food = def && ITEM_DEFS[def]?.props.includes("food"), drink = def && ITEM_DEFS[def]?.props.includes("liquid");
            this.audio.play(v === "wear" || v === "remove" ? "wear" : v === "consume" ? (drink ? "gulp" : food ? "munch" : "pickup") : "tap", 0.9);
          }
        }
        this.openBag(); return;
      }
      if (d.cp) { loadCheckpoint(this.game2, d.cp as any); this.closeSheet(); $("ending").hidden = true; this.setSpeed(1); this.hint("Back to the checkpoint."); this.setZoom(); return; }
      if (d.new) { this.newGame(); this.closeSheet(); this.setSpeed(1); $("ending").hidden = true; return; }
      if (d.next) { this.continueTournament(); return; }
      if (d.mute) { this.audio.toggleMute(); this.openMenu(); return; }
    };
    $("sheet").addEventListener("click", onSheetClick);
    $("ending").addEventListener("click", onSheetClick);

    window.addEventListener("keydown", (e) => {
      if (!this.started) { if (e.key === "Enter") { $("intro").hidden = true; this.started = true; void this.audio.unlock(); } return; }
      const k = e.key.toLowerCase();
      if ((k === "h" || k === "e") && this.s.stadium!.vehicles.bus?.drivenBy === this.pc.id) { this.honk(); return; }
      if (k === "e" || k === " ") { e.preventDefault(); this.run(primary(this.opts)); }
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
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < rect.width * 0.45 && this.joyId === -1) {
        // Keep the ring clear of the screen edges, so the bottom swipe area never swallows the release.
        const ox = Math.max(70, Math.min(window.innerWidth - 70, e.clientX)), oy = Math.max(70, Math.min(window.innerHeight - 80, e.clientY));
        this.joyId = e.pointerId; this.joyOx = ox; this.joyOy = oy; this.jx = this.jy = 0;
        joy.hidden = false; joy.style.left = `${ox}px`; joy.style.top = `${oy}px`; knob.style.transform = "";
        try { canvas.setPointerCapture(e.pointerId); } catch { /* not all browsers allow it */ }
        move(e);
      } else {
        // Tap someone to aim at them.
        const cam = this.cameras.main, P = this.P;
        const wx = cam.worldView.x + x / cam.zoom, wy = cam.worldView.y + y / cam.zoom;
        const gx = wx / P.S, gy = (wy + 0.9 * P.KZ * P.S) / (P.K * P.S);
        let best: Actor | null = null, bd = 1.8;
        for (const id in this.s.actors) {
          const a = this.s.actors[id];
          if (a.id === this.pc.id || a.hiddenIn) continue;
          const d = Math.hypot(a.x - gx, a.y - gy);
          if (d < bd) { bd = d; best = a; }
        }
        this.picked = best ? best.id : null;
      }
    });
    function move(this: void, e: PointerEvent): void { scene.joyMove(e, knob); }
    const scene = this;
    const release = () => { this.joyId = -1; this.jx = this.jy = 0; joy.hidden = true; };
    const up = (e: PointerEvent) => { if (e.pointerId === this.joyId) release(); };
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

  joyMove(e: PointerEvent, knob: HTMLElement) {
    if (e.pointerId !== this.joyId) return;
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
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101412",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, width: Math.max(1, host.clientWidth * DPR), height: Math.max(1, host.clientHeight * DPR), zoom: 1 / DPR },
  scene: StadiumScene,
});

// Keep the type checker honest about things only referenced in strings.
void appearance; void SPOTS; void ([0, 1] as TeamIdx[]);
