// Match viewer: draws the simulation and wires up the on-screen controls.
// The view only reads state and calls the interference hooks; it never decides anything.
import Phaser from "phaser";
import { Stepper } from "../core/stepper";
import type { Actor } from "../core/types";
import { clamp } from "../core/vec";
import { createWorld, spawnActor, stepWorld, type World } from "../core/world";
import { biasReferee, bribePlayer, distractReferee, floorReferee, intruderKick, removePlayer, wirePlayer } from "../football/api";
import { Commentator, type Line } from "../football/commentary";
import { HL, HW, PITCH } from "../football/config";
import { clockLabel } from "../football/match";
import { createMatch, TEAMS } from "../football/setup";
import type { MatchState, TeamIdx } from "../football/types";
import { dirOf, playing } from "../football/util";
import { drawFigure, headTop, type FigureStyle } from "./figures";
import { drawBall, drawGoalFrame, drawPitch } from "./pitchArt";
import { Projection } from "./projection";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
const SKIN = [0xf1c7a5, 0xd9a47e, 0xb07a52, 0x8a5a3b, 0x5e3b26];
const luma = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

class MatchScene extends Phaser.Scene {
  world!: World;
  m!: MatchState;
  P = new Projection();
  stepper = new Stepper();
  commentator?: Commentator;
  pitchG!: Phaser.GameObjects.Graphics;
  g!: Phaser.GameObjects.Graphics;
  labels = new Map<string, Phaser.GameObjects.Text>();
  nameTag!: Phaser.GameObjects.Text;
  wide = false;
  camX = 0; camY = 0;
  intruder: string | null = null;
  lines: Line[] = [];
  seed = "";

  create() {
    this.pitchG = this.add.graphics();
    this.g = this.add.graphics();
    this.nameTag = this.add.text(0, 0, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#ffffff", stroke: "#000000", strokeThickness: 3 })
      .setOrigin(0.5, 1).setDepth(5).setResolution(2);
    this.scale.on("resize", () => this.layout());
    const refit = () => { this.scale.refresh(); this.layout(); };
    new ResizeObserver(refit).observe($("game"));
    window.visualViewport?.addEventListener("resize", refit);
    setTimeout(refit, 500); setTimeout(refit, 1500);
    this.wireHud();
    this.newMatch("POR");
    this.layout();
  }

  newMatch(opp: string) {
    this.commentator?.stop();
    for (const t of this.labels.values()) t.destroy();
    this.labels.clear();
    this.seed = `m${Date.now() % 1000000}`;
    this.world = createWorld(this.seed);
    this.m = createMatch(this.world, TEAMS.ENG, TEAMS[opp], { halfTimeSeconds: 12 });
    this.intruder = null;
    this.lines = [];
    this.commentator = new Commentator(this.world, this.world.bus, (l) => this.say(l));
    for (const t of [0, 1] as TeamIdx[]) {
      const team = this.m.teams[t];
      $("name" + t).textContent = team.short;
      $("chip" + t).style.background = hex(team.colour);
      $("chip" + t).style.borderColor = hex(team.colour2);
    }
    $("seed").textContent = `Match reference ${this.seed}`;
    this.say({ t: 0, text: `${this.m.teams[0].name} against ${this.m.teams[1].name}. The teams are out.`, big: false });
  }

  say(l: Line) {
    this.lines.push(l);
    if (this.lines.length > 2) this.lines.shift();
    const el = $("ticker");
    el.textContent = "";
    this.lines.forEach((ln, i) => {
      const d = document.createElement("div");
      d.className = "line panel" + (i < this.lines.length - 1 ? " old" : "") + (ln.big ? " big" : "");
      d.textContent = ln.text;
      el.appendChild(d);
    });
  }

  layout() {
    const w = this.scale.width, h = this.scale.height;
    this.P.rot = h > w * 1.1;
    drawPitch(this.pitchG, this.P);
    this.setZoom();
  }
  setZoom() {
    const P = this.P, w = this.scale.width, h = this.scale.height;
    const spanU = (P.rot ? PITCH.W : PITCH.L) + 8, spanV = ((P.rot ? PITCH.L : PITCH.W) + 8) * P.K + 3;
    const z = this.wide ? Math.min(w / (spanU * P.S), h / (spanV * P.S))
      : Math.max(Math.max(w, h) / (46 * P.S), Math.min(w, h) / ((PITCH.W + 10) * P.S * (P.rot ? 1 : P.K)));
    this.cameras.main.setZoom(z);
  }

  label(a: Actor): Phaser.GameObjects.Text {
    let t = this.labels.get(a.id);
    if (!t) {
      t = this.add.text(0, 0, a.fb ? String(a.fb.number) : "", { fontFamily: "system-ui, sans-serif", fontSize: "10px", fontStyle: "bold", color: "#ffffff" })
        .setOrigin(0.5).setDepth(4).setResolution(2);
      this.labels.set(a.id, t);
    }
    return t;
  }

  style(a: Actor): FigureStyle {
    const m = this.m, tick = this.world.state.tick, fb = a.fb;
    const skin = SKIN[[...a.id].reduce((h, c) => h + c.charCodeAt(0), 0) % SKIN.length];
    if (fb) {
      const team = m.teams[fb.team];
      const gk = fb.role === "GK";
      return {
        shirt: gk ? (fb.team === 0 ? 0x2fbf71 : 0xf08a24) : team.colour,
        trim: gk ? 0x10202a : team.colour2,
        shorts: fb.team === 0 ? 0x1b2a6b : team.colour2,
        skin, ring: m.ball.owner === a.id ? 0xffffff : fb.star ? 0xf2c94c : null,
        down: fb.stunUntil > tick + 20 || a.downUntil > tick,
        height: fb.status === "bench" ? 1.6 : 1.8,
      };
    }
    if (a.off) {
      const ref = a.off.job === "referee";
      return { shirt: ref ? 0x15171a : 0xd9e021, trim: ref ? 0xf2c94c : 0x15171a, shorts: 0x15171a, skin, down: a.downUntil > tick };
    }
    return { shirt: 0xffffff, trim: 0xe5484d, shorts: 0x2b3b55, skin: 0xf1c7a5, girth: 1.6, height: 1.75 };
  }

  update(_t: number, dms: number) {
    const w = this.world, s = w.state, m = this.m, P = this.P;
    this.stepper.advance(dms / 1000, () => { this.driveIntruder(); stepWorld(w); }, 12);

    const g = this.g, tick = s.tick, b = m.ball;
    g.clear();
    // Everything that stands up is drawn back to front.
    type Thing = { d: number; draw: () => void };
    const things: Thing[] = [];
    let carrier: Actor | null = null;
    for (const id in s.actors) {
      const a = s.actors[id], fb = a.fb, lab = this.label(a);
      lab.setVisible(false);
      if (fb && fb.status === "gone") continue;
      if (b.owner === a.id) carrier = a;
      const st = this.style(a);
      const moving = Math.hypot(a.vx, a.vy) > 0.5;
      things.push({ d: P.depth(a.x, a.y), draw: () => {
        drawFigure(g, P, a.x, a.y, a.facing, st, tick, moving);
        if (fb && fb.status === "playing" && !st.down) {
          const light = luma(st.shirt) > 150;
          lab.setVisible(true).setColor(light ? "#10202a" : "#ffffff")
            .setPosition(P.sx(a.x, a.y), P.standing ? P.sy(a.x, a.y) - 1.8 * P.KZ * P.S * 0.62 : P.sy(a.x, a.y));
          lab.setDepth(4 + P.depth(a.x, a.y) / 1000);
        }
      } });
    }
    things.push({ d: P.depth(b.x, b.y) + 0.01, draw: () => drawBall(g, P, b.x, b.y, b.z) });
    for (const sgn of [-1, 1]) {
      // The near post decides whether players are in front of or behind the frame.
      const d = P.rot ? P.depth(sgn * HL, 0) : PITCH.goalW / 2;
      things.push({ d, draw: () => drawGoalFrame(g, P, sgn) });
    }
    things.sort((p, q) => p.d - q.d);
    for (const t of things) t.draw();

    if (carrier) {
      this.nameTag.setVisible(true).setText((carrier.fb?.star ? "★ " : "") + carrier.name)
        .setPosition(P.sx(carrier.x, carrier.y), headTop(P, carrier.x, carrier.y) - 4)
        .setColor(carrier.fb?.star ? "#f2c94c" : "#ffffff");
    } else this.nameTag.setVisible(false);

    // Camera follows a point just ahead of the ball.
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const fx = b.x + b.vx * 0.35, fy = b.y + b.vy * 0.35;
    let tx = P.sx(fx, fy), ty = P.sy(fx, fy, b.z * 0.3);
    const ext = (half: number, view: number) => Math.max(0, half - view / 2);
    const hu = ((P.rot ? HW : HL) + 5) * P.S, hv = ((P.rot ? HL : HW) + 5) * P.S * P.K;
    tx = clamp(tx, -ext(hu, vw), ext(hu, vw)); ty = clamp(ty, -ext(hv, vh), ext(hv, vh));
    if (this.wide) { tx = 0; ty = -P.S * 0.6; }
    const k = 1 - Math.pow(0.02, Math.min(dms, 100) / 1000);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    cam.centerOn(this.camX, this.camY);

    this.drawHud();
  }

  // ---------- HUD ----------
  lastHud = "";
  drawHud() {
    const m = this.m;
    const label = m.phase === "finished" ? "FT" : m.phase === "break" ? (m.period === 1 ? "HT" : "…") : m.phase === "pre" ? "0:00" : clockLabel(m);
    const pens = m.shootout ? ` (${m.shootout.scored[0]}–${m.shootout.scored[1]})` : "";
    const key = `${m.score[0]}|${m.score[1]}|${label}|${pens}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      $("g0").textContent = String(m.score[0]); $("g1").textContent = String(m.score[1]);
      $("clock").textContent = label + pens;
    }
    const c = $<HTMLCanvasElement>("radarc"), ctx = c.getContext("2d")!;
    const W = c.width, H = c.height, sx = W / (PITCH.L + 4), sy = H / (PITCH.W + 4);
    ctx.fillStyle = "#1f5c2c"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(2 * sx, 2 * sy, PITCH.L * sx, PITCH.W * sy);
    ctx.beginPath(); ctx.moveTo(W / 2, 2 * sy); ctx.lineTo(W / 2, H - 2 * sy); ctx.stroke();
    const s = this.world.state;
    for (const t of [0, 1] as TeamIdx[]) {
      for (const a of playing(s, m, t)) {
        ctx.beginPath(); ctx.arc((a.x + HL + 2) * sx, (a.y + HW + 2) * sy, a.fb!.star ? 5 : 4, 0, 6.3);
        ctx.fillStyle = hex(m.teams[t].colour); ctx.fill();
        ctx.strokeStyle = a.fb!.star ? "#f2c94c" : hex(m.teams[t].colour2); ctx.lineWidth = a.fb!.star ? 2 : 1; ctx.stroke();
      }
    }
    ctx.beginPath(); ctx.arc((m.ball.x + HL + 2) * sx, (m.ball.y + HW + 2) * sy, 3.5, 0, 6.3);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
    if (!$("stats").hidden && (s.tick & 31) === 0) this.renderStats();
  }

  renderStats() {
    const m = this.m, a = m.stats[0], b = m.stats[1];
    const poss = a.possession + b.possession || 1;
    const rows: [string | number, string, string | number][] = [
      [`${Math.round((a.possession / poss) * 100)}%`, "Possession", `${Math.round((b.possession / poss) * 100)}%`],
      [a.shots, "Shots", b.shots], [a.onTarget, "On target", b.onTarget], [a.saves, "Saves", b.saves],
      [a.corners, "Corners", b.corners], [a.fouls, "Fouls", b.fouls], [a.offsides, "Offsides", b.offsides],
      [a.yellows, "Yellow cards", b.yellows], [a.reds, "Red cards", b.reds],
      [playing(this.world.state, m, 0).length, "Players on pitch", playing(this.world.state, m, 1).length],
    ];
    const t = $("statst");
    t.textContent = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      for (const v of r) { const td = document.createElement("td"); td.textContent = String(v); tr.appendChild(td); }
      t.appendChild(tr);
    }
  }

  toggleDebug() {
    const el = $("meddle");
    el.hidden = !el.hidden;
    if (!el.hidden) { $("stats").hidden = true; $("b-stats").setAttribute("aria-pressed", "false"); }
  }

  wireHud() {
    const speeds = [0, 1, 2, 4, 8];
    for (const sp of speeds) {
      $("sp" + sp).addEventListener("click", () => {
        this.stepper.timeScale = sp;
        for (const o of speeds) $("sp" + o).setAttribute("aria-pressed", String(o === sp));
      });
    }
    $("b-stats").addEventListener("click", () => {
      const el = $("stats"); el.hidden = !el.hidden;
      $("b-stats").setAttribute("aria-pressed", String(!el.hidden));
      if (!el.hidden) { $("meddle").hidden = true; this.renderStats(); }
    });
    $("b-cam").addEventListener("click", () => {
      this.wide = !this.wide; $("b-cam").setAttribute("aria-pressed", String(this.wide)); this.setZoom();
    });
    $("b-view").addEventListener("click", () => {
      this.P.mode = this.P.mode === "tilted" ? "flat" : "tilted";
      const tilted = this.P.mode === "tilted";
      $("b-view").textContent = tilted ? "Tilted view" : "Flat view";
      $("b-view").setAttribute("aria-pressed", String(tilted));
      this.layout();
    });
    // Hidden debug panel: the ` key, or three quick taps on the clock.
    window.addEventListener("keydown", (e) => { if (e.key === "`") this.toggleDebug(); });
    let taps: number[] = [];
    $("score").addEventListener("pointerdown", () => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 700); taps.push(now);
      if (taps.length >= 3) { taps = []; this.toggleDebug(); }
    });
    $("new").addEventListener("click", () => { this.newMatch($<HTMLSelectElement>("opp").value); $("meddle").hidden = true; });

    const act = (id: string, fn: () => string | null) => $(id).addEventListener("click", () => {
      if (this.m.phase === "finished") return;
      const note = fn();
      if (note) this.say({ t: this.world.state.tick, text: note, big: false });
    });
    const starOf = (t: TeamIdx) => playing(this.world.state, this.m, t).find((a) => a.fb!.star);
    act("m-star", () => { const a = starOf(1); if (!a) return "They have no star left to arrest."; removePlayer(this.world, a.id, "arrested"); return null; });
    act("m-ourstar", () => { const a = starOf(0); if (!a) return "England have no star left to arrest."; removePlayer(this.world, a.id, "arrested"); return null; });
    act("m-keeper", () => { const gk = playing(this.world.state, this.m, 1).find((a) => a.fb!.role === "GK"); if (gk) bribePlayer(this.world, gk.id); return "(Debug: their goalkeeper is bribed.)"; });
    act("m-wire", () => { for (const a of playing(this.world.state, this.m, 1)) if (a.fb!.role === "DEF") wirePlayer(this.world, a.id, 150); return "(Debug: their defenders are wired.)"; });
    act("m-refbribe", () => { biasReferee(this.world, 0, 0.85); return "(Debug: the referee favours England.)"; });
    act("m-distract", () => { distractReferee(this.world, 30); return null; });
    act("m-floor", () => { floorReferee(this.world, 20); return null; });
    act("m-invade", () => { this.sendIntruder(); return null; });
  }

  sendIntruder() {
    const s = this.world.state;
    if (this.intruder && s.actors[this.intruder]) return;
    const a = spawnActor(s, "protagonist", "A supporter", this.m.ball.x, -HW - 3, { radius: 0.6, speed: 4.2 });
    this.intruder = a.id;
    this.say({ t: s.tick, text: "There is a spectator on the pitch.", big: true });
  }
  driveIntruder() {
    if (!this.intruder) return;
    const s = this.world.state, a = s.actors[this.intruder], b = this.m.ball;
    if (!a) { this.intruder = null; return; }
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    a.moveX = dx / (d || 1); a.moveY = dy / (d || 1);
    if (d < 1.2 && this.m.phase === "live") {
      const dir = dirOf(this.m, 0);
      if (intruderKick(this.world, a.id, dir * HL - b.x, -b.y, 15, 2)) {
        delete s.actors[a.id];
        this.labels.get(a.id)?.destroy(); this.labels.delete(a.id);
        this.intruder = null;
      }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0c1411",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: MatchScene,
});
