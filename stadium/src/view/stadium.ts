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
import { AREAS, areaAt, KICKOFF_AT, SPOTS, VENUE, WALLS } from "../stadium/layout";
import { afterMatch, describeDef, FIXTURES, loadoutProblem, newCampaign, notorietyText, type Campaign } from "../stadium/campaign";
import { TEAMS } from "../football/setup";
import { canBetHere, prices } from "../stadium/betting";
import { newsReport } from "../stadium/news";
import { secs } from "../stadium/npc";
import { SHOPS } from "../stadium/rules";
import { LORRY_LEN, LORRY_WID } from "../stadium/vehicles";
import { drawFigure, headTop, type FigureStyle } from "./figures";
import { drawBall, drawGoalFrame, drawPitch } from "./pitchArt";
import { Projection } from "./projection";
import { Audio, type Clip } from "./audio";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Screen pixels per metre at zoom 1: matches 48px character art drawn at 1:1. */
const PX_PER_METRE = 23;
const SKIN = [0xf1c7a5, 0xd9a47e, 0xb07a52, 0x8a5a3b, 0x5e3b26, 0xe8b896];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

interface TickerLine { text: string; src: string; big: boolean }

class StadiumScene extends Phaser.Scene {
  game2!: Game;
  P = new Projection();
  stepper = new Stepper();
  staticG!: Phaser.GameObjects.Graphics;
  crowdG!: Phaser.GameObjects.Graphics;
  pitchG!: Phaser.GameObjects.Graphics;
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

  create() {
    (window as any).__scene = this; // for automated checks
    this.pitchG = this.add.graphics();
    this.staticG = this.add.graphics();
    this.crowdG = this.add.graphics();
    this.g = this.add.graphics();
    this.ui = this.add.graphics().setDepth(10);
    for (let i = 0; i < 10; i++) {
      this.bubbles.push(this.add.text(0, 0, "", {
        fontFamily: "system-ui, sans-serif", fontSize: "12px", color: "#10140f", backgroundColor: "#f4f1ea",
        padding: { x: 5, y: 3 }, wordWrap: { width: 170 }, align: "center",
      }).setOrigin(0.5, 1).setDepth(20).setResolution(2).setVisible(false));
    }
    this.newGame();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.scale.on("resize", () => this.setZoom());
    // The host frame can change size after load (phones especially): keep the canvas filling it.
    const refit = () => { this.scale.refresh(); this.setZoom(); };
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
    const w = this.w;
    new Commentator(w, w.bus, (l) => this.matchLine(l.text, l.big));
    const TANNOY: Record<string, Clip> = { welcome: VENUE.id === "qf" ? "tannoy_welcome" : "tannoy_welcome_sf", lorry: "tannoy_lorry", pitch: "tannoy_pitch", "2min": "tannoy_2min", teams: "tannoy_teams", cleaner: "tannoy_cleaner", flares: "tannoy_flares", cameras: "tannoy_cameras" };
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
        if (a && Math.hypot(a.x - this.pc.x, a.y - this.pc.y) < 5.5 && e.text.length > 12 && !this.lines.some((l) => l.text === e.text)) this.say(e.text, a.name, false);
      }
      if (e.type === "action_failed" && e.action.actor === this.s.stadium!.pc) this.hint(e.reason);
      if (e.type === "fb_goal" || e.type === "caught" || e.type === "fb_foul" && e.penalty) this.setSpeed(1);
      if (e.type === "fb_goal") { this.crowdJump = 120 * (e.team === 0 ? 1 : -1); }
      if (e.type === "stole") this.hint(e.what === "ticket" ? "You lifted a ticket." : `You lifted £${e.amount}.`);
      if (e.type === "ejected" && e.who === this.s.stadium!.pc) this.hint(e.taken.length ? `Thrown out. They took your ${e.taken.join(", ")}.` : "Thrown out. They'll know your face now.");
      if (e.type === "escort_cut" && e.who === this.s.stadium!.pc) { const f = $("fade"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 450); }
      if (e.type === "broke_free" && e.who === this.s.stadium!.pc) this.hint("You broke free. Run!");
      if (e.type === "winded") this.hint("You're out of breath.");
      if (e.type === "bet_settled" && e.who === this.s.stadium!.pc) this.hint(e.won ? `Your bet came in: £${e.payout}.` : `You lost £${e.stake}.`);
    });
    const m = this.s.match!;
    $("sc0").textContent = m.teams[0].short; $("sc1").textContent = m.teams[1].short;
    this.lines = []; this.renderTicker();
    this.drawStatic();
    this.camX = this.P.sx(this.pc.x, this.pc.y); this.camY = this.P.sy(this.pc.x, this.pc.y);
    $("ending").hidden = true;
  }

  // ---------- Between matches ----------
  introFor(c: Campaign) {
    const opp = TEAMS[VENUE.opp].name;
    const kit = c.loadout.filter((d) => d !== "shirt_eng").map(describeDef);
    $("introTitle").textContent = `England are in the ${VENUE.round}.`;
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
        if (e.team === 0 || s.actors[e.by]?.fb?.team === 0) a.play("groan", vol * 0.6, { muffle, minGap: 4 });
        break;
      case "fb_save":
        if (s.actors[e.shooter]?.fb?.team === 0) a.play("groan", vol * 0.5, { muffle, minGap: 4 });
        break;
      case "fb_shot": {
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
      case "action":
        if (e.action.verb === "strike") { const by = s.actors[e.action.actor]; if (by) a.play("punch", 0.3 + near(by.x, by.y) * 0.7); }
        break;
      case "smoke": a.play("flare", 0.4 + near(e.x, e.y, 40) * 0.6); break;
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
        if (e.text === "Get out the road!") a.play("horn", 0.3 + v * 0.7, { minGap: 2 });
        break;
      }
    }
  }

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
    if (m.phase === "break" || m.phase === "finished") level *= 0.6;
    this.audio.setCrowd(level, bright);
  }

  // ---------- Static drawing ----------
  drawStatic() {
    const P = this.P, g = this.staticG;
    g.clear();
    for (const a of AREAS) {
      if (a.id === "pitch") continue;
      g.fillStyle(a.floor, 1).fillRect(...P.rect(a.x, a.y, a.w, a.h));
    }
    // Road markings.
    g.fillStyle(0xd8d2b8, 0.7);
    for (let x = -88; x < 90; x += 6) g.fillRect(...P.rect(x, 87.9, 3, 0.25));
    for (let y = -46; y < 90; y += 6) g.fillRect(...P.rect(66.9, y, 0.25, 3));
    // Seat rows.
    for (const a of AREAS.filter((x) => x.seats)) {
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
      this.labels.push(this.add.text(P.sx(x, y), P.sy(x, y), text, { fontFamily: "system-ui, sans-serif", fontSize: `${size}px`, color: "#ffffff" })
        .setOrigin(0.5).setAlpha(0.55).setResolution(2).setDepth(1));
    };
    for (const [t, x, y, size] of VENUE.labels) label(t, x, y, size ?? 11);
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

  drawCrowd() {
    const P = this.P, g = this.crowdG;
    g.clear();
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const a of AREAS.filter((x) => x.seats)) {
      const away = a.id === "stand_e";
      for (let y = a.y + 0.6; y < a.y + a.h - 0.3; y += 1.1) {
        for (let x = a.x + 0.6; x < a.x + a.w - 0.3; x += 0.9) {
          if (rnd() < 0.42) continue;
          const shirt = away ? (rnd() < 0.7 ? 0xb3122a : 0x0b6b3a) : rnd() < 0.55 ? 0xf4f4f4 : rnd() < 0.5 ? 0xc8102e : 0x1b2a6b;
          const sx = P.sx(x, y), sy = P.sy(x, y);
          const h = (P.standing ? 0.9 * P.KZ : 0.3) * P.S;
          g.fillStyle(shirt, 1).fillRect(sx - P.S * 0.28, sy - h, P.S * 0.56, h);
          g.fillStyle(SKIN[Math.floor(rnd() * SKIN.length)], 1).fillCircle(sx, sy - h - P.S * 0.16, P.S * 0.17);
        }
      }
    }
  }

  /** Exploring: about 40 metres across. Sitting: the whole width of the pitch, like the telly. */
  targetZoom() {
    const w = this.scale.width, h = this.scale.height;
    if (this.pc?.seated) return Math.min(w / (60 * this.P.S), h / (44 * this.P.S * this.P.K));
    // A fixed number of screen pixels per metre, so a bigger screen simply shows more.
    return (PX_PER_METRE * this.zoomLevel) / this.P.S;
  }
  zoomLevel = 1;
  cycleZoom() {
    const levels = [1, 1.5, 2];
    this.zoomLevel = levels[(levels.indexOf(this.zoomLevel) + 1) % levels.length];
    $("zoomBtn").textContent = `${this.zoomLevel}×`;
    try { localStorage.setItem("kd-zoom", String(this.zoomLevel)); } catch { /* ignore */ }
  }
  setZoom() { this.cameras.main.setZoom(this.targetZoom()); }

  // ---------- Frame ----------
  update(_t: number, dms: number) {
    if (!this.started) { this.draw(dms); return; }
    const st = this.s.stadium!;
    if (!st.ending) {
      this.applyInput();
      const ann = (this as any).announcer as Announcer;
      this.stepper.advance(dms / 1000, () => { stepGame(this.game2); ann.tick(); this.applyInput(); }, 24);
    }
    if (st.ending && $("ending").hidden && !this.endingShown) { this.endingShown = true; this.showEnding(); }
    if (!st.ending) this.endingShown = false;
    this.draw(dms);
    this.drawHud();
    if ((this.s.tick & 15) === 0) this.updateCrowd();
  }

  applyInput() {
    const pc = this.pc;
    if (!pc) return;
    const k = this.keys;
    let x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    let run = k.SHIFT.isDown;
    if (this.joyId !== -1) { x = this.jx; y = this.jy; run = Math.hypot(x, y) > 0.85; }
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
    const mag = run ? 1 : Math.min(l, 0.8);
    pc.moveX = l > 0.12 ? (g.x / (l || 1)) * mag * (l > 1 ? 1 : 1) * k2 * (l > 1 ? l : 1) : 0;
    pc.moveY = l > 0.12 ? (g.y / (l || 1)) * mag * k2 * (l > 1 ? l : 1) : 0;
  }

  styleOf(a: Actor): FigureStyle {
    const s = this.s, tick = s.tick, m = s.match!;
    const skin = SKIN[Math.abs(hash(a.id)) % SKIN.length];
    const down = a.downUntil > tick || (a.fb ? a.fb.stunUntil > tick + 20 : false);
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
    return {
      shirt, trim, shorts: 0x2b3b55, skin, down, vest, hat, face,
      girth: isPc ? 1.75 : a.npc?.job === "fan" || a.npc?.job === "local" ? 1.1 + (Math.abs(hash(a.id)) % 5) * 0.08 : 1,
      height: a.seated ? 1.2 : isPc ? 1.75 : 1.8,
      ring: isPc ? 0xffffff : null,
    };
  }

  draw(dms: number) {
    const P = this.P, g = this.g, s = this.s, tick = s.tick, pc = this.pc, st = s.stadium!, m = s.match!;
    g.clear();
    type Thing = { d: number; draw: () => void };
    const things: Thing[] = [];
    const cam = this.cameras.main;
    const view = cam.worldView;
    const onScreen = (x: number, y: number, pad = 60) => {
      const sx = P.sx(x, y), sy = P.sy(x, y);
      return sx > view.x - pad && sx < view.right + pad && sy > view.y - pad && sy < view.bottom + pad * 2;
    };

    // Walls: fade the ones the player is standing behind.
    for (const wl of WALLS) {
      if (!onScreen(wl.x + wl.w / 2, wl.y + wl.h / 2, 200)) continue;
      const open = wl.gate && st.gates[wl.gate] && st.gates[wl.gate].until > tick;
      const behind = pc && pc.y < wl.y + wl.h && pc.y > wl.y - wl.h3 * 1.6 - 0.5 && pc.x > wl.x - 0.5 && pc.x < wl.x + wl.w + 0.5 && wl.h3 > 1.6;
      const alpha = behind ? 0.35 : 1;
      things.push({ d: wl.y + wl.h, draw: () => {
        if (open) { g.fillStyle(0x88cc88, 0.35).fillRect(...P.rect(wl.x, wl.y, wl.w, wl.h)); return; }
        const [rx, ry, rw, rh] = P.rect(wl.x, wl.y, wl.w, wl.h);
        if (!P.standing) { g.fillStyle(wl.top, alpha).fillRect(rx, ry, rw, rh); return; }
        const lift = wl.h3 * P.KZ * P.S;
        g.fillStyle(wl.colour, alpha).fillRect(rx, ry + rh - lift, rw, lift);
        g.fillStyle(wl.top, alpha).fillRect(rx, ry - lift, rw, rh);
      } });
    }

    // Items lying around, and fixtures.
    for (const id in s.items) {
      const it = s.items[id], l = it.loc;
      if (l.k !== "ground" && l.k !== "air") continue;
      if (it.def === "lorry_cargo") continue;
      const def = defOf(it), x = l.x, y = l.y, z = l.k === "air" ? l.z : 0;
      if (!onScreen(x, y)) continue;
      const near = pc && Math.hypot(pc.x - x, pc.y - y) < 2.6;
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

    // The lorry.
    for (const v of Object.values(st.vehicles)) {
      if (!onScreen(v.x, v.y, 150)) continue;
      const along = Math.abs(Math.cos(v.facing)) > 0.5;
      const lx = along ? LORRY_LEN : LORRY_WID, ly = along ? LORRY_WID : LORRY_LEN;
      const x0 = v.x - lx / 2, y0 = v.y - ly / 2;
      const cabX = v.x + Math.cos(v.facing) * (LORRY_LEN / 2 - 0.9), cabY = v.y + Math.sin(v.facing) * (LORRY_LEN / 2 - 0.9);
      const open = v.state === "loading" || v.state === "unloading";
      things.push({ d: y0 + ly, draw: () => {
        const [rx, ry, rw, rh] = P.rect(x0, y0, lx, ly);
        const lift = 3 * P.KZ * P.S;
        g.fillStyle(0x000000, 0.3).fillRect(rx + 4, ry + 4, rw, rh);
        if (P.standing) {
          g.fillStyle(0xb8862f, 1).fillRect(rx, ry + rh - lift, rw, lift);
          g.fillStyle(0xd9a441, 1).fillRect(rx, ry - lift, rw, rh);
          const [cx, cy, cw, ch] = P.rect(cabX - (along ? 0.9 : 1.3), cabY - (along ? 1.3 : 0.9), along ? 1.8 : 2.6, along ? 2.6 : 1.8);
          g.fillStyle(0x2d5a8a, 1).fillRect(cx, cy - lift * 0.85, cw, ch + lift * 0.85 * 0.2);
          if (open) { const rr = { x: v.x - Math.cos(v.facing) * (LORRY_LEN / 2), y: v.y - Math.sin(v.facing) * (LORRY_LEN / 2) }; g.fillStyle(0x1a1208, 1).fillRect(P.sx(rr.x, rr.y) - P.S * 0.9, P.sy(rr.x, rr.y) - lift * 0.9, P.S * 1.8, lift * 0.8); }
        } else g.fillStyle(0xd9a441, 1).fillRect(rx, ry, rw, rh);
        const lx2 = P.sx(v.x, v.y), ly2 = P.sy(v.x, v.y, 3);
        g.fillStyle(0xffffff, 0.9).fillRect(lx2 - P.S * 1.6, ly2 - P.S * 0.1, P.S * 3.2, P.S * 0.55);
      } });
    }

    // People.
    for (const id in s.actors) {
      const a = s.actors[id];
      if (a.hiddenIn || (a.fb && a.fb.status === "gone")) continue;
      if (!onScreen(a.x, a.y)) continue;
      const st2 = this.styleOf(a), moving = Math.hypot(a.vx, a.vy) > 0.4;
      things.push({ d: a.y, draw: () => drawFigure(g, P, a.x, a.y, a.facing, st2, tick + hash(a.id), moving) });
    }
    // Ball and goals.
    const b = m.ball;
    things.push({ d: b.y + 0.01, draw: () => drawBall(g, P, b.x, b.y, b.z) });
    for (const sgn of [-1, 1]) things.push({ d: PITCH.goalW / 2, draw: () => drawGoalFrame(g, P, sgn) });

    things.sort((p, q) => p.d - q.d);
    for (const t of things) t.draw();
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

    // Crowd bounce after a goal.
    if (this.crowdJump) {
      const j = Math.abs(Math.sin(this.crowdJump * 0.35)) * 3;
      this.crowdG.y = this.crowdJump > 0 ? -j : 0;
      this.crowdJump += this.crowdJump > 0 ? -1 : 1;
    } else this.crowdG.y = 0;

    // Aim marker and the player's own marker.
    const ui = this.ui;
    ui.clear();
    if (pc && !pc.hiddenIn) {
      const tgt = pc.hand && hasProp(s.items[pc.hand], "throwable") || (pc.hand && defOf(s.items[pc.hand]).size === "small") ? throwTarget(this.w, pc, this.picked) : null;
      (this as any).throwAt = tgt;
      if (tgt) {
        const tx = P.sx(tgt.x, tgt.y), ty = P.sy(tgt.x, tgt.y) - (P.standing ? 0.9 * P.KZ * P.S : 0);
        ui.lineStyle(2, 0xf2c94c, 0.9).strokeCircle(tx, ty, P.S * 0.9);
        ui.lineBetween(tx - P.S * 1.2, ty, tx - P.S * 0.6, ty).lineBetween(tx + P.S * 0.6, ty, tx + P.S * 1.2, ty);
      }
      const hx = P.sx(pc.x, pc.y), hy = headTop(P, pc.x, pc.y, 1.75) - 6;
      ui.fillStyle(0xd7263d, 1).fillTriangle(hx - 5, hy - 8, hx + 5, hy - 8, hx, hy);
    }

    // Speech bubbles near the player.
    const talkers = Object.values(s.actors).filter((a) => a.npc?.bubble && !a.hiddenIn && onScreen(a.x, a.y)).slice(0, this.bubbles.length);
    this.bubbles.forEach((bt, i) => {
      const a = talkers[i];
      if (!a) { bt.setVisible(false); return; }
      bt.setVisible(true).setText(a.npc!.bubble!.text).setPosition(P.sx(a.x, a.y), headTop(P, a.x, a.y) - 4);
      const sec = a.npc!.mode !== "routine" && a.npc!.mode !== "escort";
      bt.setBackgroundColor(sec ? "#ffd166" : "#f4f1ea");
    });

    // Camera: follow the player; sitting down gives the TV view of the pitch.
    let tx: number, ty: number;
    if (pc?.seated) {
      tx = clamp(P.sx(b.x, b.y), P.sx(-HL + 18, 0), P.sx(HL - 18, 0)); ty = P.sy(0, clamp(b.y, -HW + 8, HW - 8) * 0.6);
    } else if (pc) { tx = P.sx(pc.x + pc.vx * 0.4, pc.y + pc.vy * 0.4); ty = P.sy(pc.x + pc.vx * 0.4, pc.y + pc.vy * 0.4) - P.S; }
    else { tx = 0; ty = 0; }
    const k = 1 - Math.pow(0.004, Math.min(dms, 100) / 1000);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    const zt = this.targetZoom();
    if (Math.abs(cam.zoom - zt) > 0.001) cam.setZoom(cam.zoom + (zt - cam.zoom) * Math.min(1, k * 1.5));
    cam.centerOn(this.camX, this.camY);
  }

  // ---------- HUD ----------
  drawHud() {
    const s = this.s, m = s.match!, pc = this.pc, st = s.stadium!;
    const t = secs(this.w);
    const label = m.phase === "pre" ? `KO ${fmtTime(Math.max(0, KICKOFF_AT - t))}` : m.phase === "finished" ? "FT" : m.phase === "break" ? (m.period === 1 ? `HT ${fmtTime(Math.max(0, (m.phaseUntil - s.tick) / 60))}` : "…") : clockLabel(m);
    const pens = m.shootout ? ` (${m.shootout.scored[0]}–${m.shootout.scored[1]})` : "";
    const key = `${m.score[0]}–${m.score[1]}|${label}${pens}`;
    if (key !== this.lastScore) { this.lastScore = key; $("sc").textContent = `${m.score[0]}–${m.score[1]}`; $("clock").textContent = label + pens; }
    if (!pc) return;
    $("money").textContent = `£${pc.money}`;
    const area = areaAt(pc.x, pc.y);
    const bad = looksOutOfPlace(this.w, pc);
    const where = pc.hiddenIn ? "Hiding in the back of the lorry" : pc.heldBy ? "Being frogmarched" : area.name + (bad ? " · you shouldn't be here" : "");
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
      this.opts = options(this.w, pc);
      const p = primary(this.opts);
      const act = $<HTMLButtonElement>("act");
      act.disabled = !p;
      act.textContent = p ? p.label : "Nothing to do here";
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

  say(text: string, src: string, big: boolean) {
    this.lines.push({ text, src, big });
    if (this.lines.length > 3) this.lines.shift();
    this.renderTicker();
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
      d.className = "line panel" + (i < this.lines.length - 1 ? " old" : "") + (l.big ? " big" : "");
      const sp = document.createElement("span"); sp.className = "src"; sp.textContent = l.src;
      d.appendChild(sp); d.appendChild(document.createTextNode(l.text));
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
    if (opt.sheet) { opt.sheet.kind === "shop" ? this.openShop(opt.sheet.who) : opt.sheet.kind === "bet" ? this.openBet() : this.openBribe(opt.sheet.who); return; }
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
    const rows = Object.entries(shop.stock).map(([def, price]) =>
      `<div class="item"><b>${esc(ITEM_DEFS[def].name)}</b><div class="row"><button data-buy="${def}" data-who="${who}" ${this.pc.money < price ? "disabled" : ""}>Buy for £${price}</button></div></div>`).join("");
    this.sheet("shop", `<h2>${esc(shop.name)}</h2><p>You have £${this.pc.money}.</p><div class="list">${rows}</div>`);
  }

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
      return `<div class="item"><span class="where">${where(it)}</span><b>${esc(itemName(it))}${extra}</b><div class="row">${opts.map((o, i) => `<button data-bag="${it.id}" data-i="${i}">${esc(o.label)}</button>`).join("")}</div></div>`;
    }).join("");
    this.sheet("bag", `<h2>Bag</h2><p>£${pc.money} in cash. Pockets: ${pc.pockets.length} of 3.</p><div class="list">${rows || "<p>Nothing.</p>"}</div>`);
  }

  openMenu() {
    const cps = this.game2.checkpoints;
    this.sheet("menu", `<h2>Paused</h2><p>Go back to a checkpoint. Everything since then is undone, and the match will not play out the same way.</p>
      <div class="list">${cps.map((c) => `<button data-cp="${c.id}">${esc(c.label)}</button>`).join("")}<button data-new="1">Start a new match day</button><button data-mute="1">${this.audio.muted ? "Sound: off" : "Sound: on"}</button></div>`);
    this.setSpeed(0);
  }

  showEnding() {
    const st = this.s.stadium!, e = st.ending!;
    $("endTitle").textContent = e.title;
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
    try { const z = +(localStorage.getItem("kd-zoom") ?? 1); if ([1, 1.5, 2].includes(z)) this.zoomLevel = z; } catch { /* ignore */ }
    $("zoomBtn").textContent = `${this.zoomLevel}×`;
    $("zoomBtn").addEventListener("click", () => this.cycleZoom());
    $("menuBtn").addEventListener("click", () => (this.sheetKind === "menu" ? (this.closeSheet(), this.setSpeed(1)) : this.openMenu()));
    for (const n of [1, 2, 4]) $("sp" + n).addEventListener("click", () => this.setSpeed(n));
    const onSheetClick = (ev: Event) => {
      const b = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
      if (!b) return;
      const d = b.dataset;
      if (d.close) { if (this.sheetKind === "menu") this.setSpeed(1); this.closeSheet(); return; }
      if (d.opt) { this.run(((this as any).moreOpts as Option[])[+d.opt]); this.closeSheet(); return; }
      if (d.buy) { const r = dispatch(this.w, { verb: "buy", actor: this.pc.id, target: { k: "actor", id: d.who! }, arg: d.buy }); if (!r.ok) this.hint(r.reason ?? ""); this.openShop(d.who!); return; }
      if (d.bet) { const r = dispatch(this.w, { verb: "bet", actor: this.pc.id, arg: d.bet, amount: +d.amt! }); if (!r.ok) this.hint(r.reason ?? ""); this.openBet(); return; }
      if (d.bribe) { const r = dispatch(this.w, { verb: "bribe", actor: this.pc.id, target: { k: "actor", id: d.who! }, amount: +d.bribe }); if (!r.ok) this.hint(r.reason ?? ""); this.closeSheet(); return; }
      if (d.bag) { const o = ((this as any)[`bag_${d.bag}`] as Option[])[+d.i!]; if (o?.action) { const r = dispatch(this.w, o.action); if (!r.ok) this.hint(r.reason ?? ""); } this.openBag(); return; }
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
      if (k === "e" || k === " ") { e.preventDefault(); this.run(primary(this.opts)); }
      else if (k === "q") this.throwNow();
      else if (k === "f") this.run(this.opts.find((o) => o.action?.verb === "strike") ?? null);
      else if (k === "r") (this.sheetKind === "more" ? this.closeSheet() : this.openMore());
      else if (k === "tab" || k === "i") { e.preventDefault(); this.sheetKind === "bag" ? this.closeSheet() : this.openBag(); }
      else if (k === "escape") { this.sheetKind ? (this.sheetKind === "menu" && this.setSpeed(1), this.closeSheet()) : this.openMenu(); }
      else if (k === "`") this.toggleDebug();
      else if (k === "z") this.cycleZoom();
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

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#101412",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: StadiumScene,
});

// Keep the type checker honest about things only referenced in strings.
void appearance; void SPOTS; void ([0, 1] as TeamIdx[]);
