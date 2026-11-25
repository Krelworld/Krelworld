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

const S = 16; // scene pixels per metre
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

class MatchScene extends Phaser.Scene {
  world!: World;
  m!: MatchState;
  stepper = new Stepper();
  commentator?: Commentator;
  pitchG!: Phaser.GameObjects.Graphics;
  g!: Phaser.GameObjects.Graphics;
  labels = new Map<string, Phaser.GameObjects.Text>();
  nameTag!: Phaser.GameObjects.Text;
  rot = false;
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
    this.wireHud();
    this.newMatch("POR");
    this.layout();
  }

  /** World metres to scene pixels. On a tall screen the pitch is turned on its side. */
  mx(x: number, y: number) { return this.rot ? y * S : x * S; }
  my(x: number, y: number) { return this.rot ? -x * S : y * S; }

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
    this.renderTicker();
  }

  say(l: Line) {
    this.lines.push(l);
    if (this.lines.length > 2) this.lines.shift();
    this.renderTicker();
  }
  renderTicker() {
    const el = $("ticker");
    el.textContent = "";
    this.lines.forEach((l, i) => {
      const d = document.createElement("div");
      d.className = "line panel" + (i < this.lines.length - 1 ? " old" : "") + (l.big ? " big" : "");
      d.textContent = l.text;
      el.appendChild(d);
    });
  }

  layout() {
    const w = this.scale.width, h = this.scale.height;
    this.rot = h > w * 1.1;
    this.drawPitch();
    this.setZoom();
  }
  setZoom() {
    const w = this.scale.width, h = this.scale.height;
    const long = Math.max(w, h), short = Math.min(w, h);
    const z = this.wide ? Math.min(long / ((PITCH.L + 8) * S), short / ((PITCH.W + 8) * S)) : Math.max(long / (46 * S), short / ((PITCH.W + 10) * S));
    this.cameras.main.setZoom(z);
  }

  drawPitch() {
    const g = this.pitchG, r = this.rot;
    g.clear();
    const rect = (x: number, y: number, w: number, h: number) => (r ? [y * S, -(x + w) * S, h * S, w * S] : [x * S, y * S, w * S, h * S]) as [number, number, number, number];
    g.fillStyle(0x16241d).fillRect(...rect(-HL - 30, -HW - 30, PITCH.L + 60, PITCH.W + 60));
    g.fillStyle(0x24332b).fillRect(...rect(-HL - 6, -HW - 6, PITCH.L + 12, PITCH.W + 12));
    // Mown stripes.
    const stripes = 12, sw = PITCH.L / stripes;
    for (let i = 0; i < stripes; i++) g.fillStyle(i % 2 ? 0x2f7d3b : 0x2a7436).fillRect(...rect(-HL + i * sw, -HW, sw, PITCH.W));
    g.lineStyle(2, 0xf2f6f2, 0.9);
    g.strokeRect(...rect(-HL, -HW, PITCH.L, PITCH.W));
    g.lineBetween(this.mx(0, -HW), this.my(0, -HW), this.mx(0, HW), this.my(0, HW));
    g.strokeCircle(0, 0, PITCH.circleR * S);
    g.fillStyle(0xf2f6f2).fillCircle(0, 0, 3);
    for (const sgn of [-1, 1]) {
      const bx = sgn > 0 ? HL - PITCH.boxL : -HL, sx = sgn > 0 ? HL - PITCH.sixL : -HL;
      g.strokeRect(...rect(bx, -PITCH.boxW / 2, PITCH.boxL, PITCH.boxW));
      g.strokeRect(...rect(sx, -PITCH.sixW / 2, PITCH.sixL, PITCH.sixW));
      g.fillCircle(this.mx(sgn * (HL - PITCH.penSpot), 0), this.my(sgn * (HL - PITCH.penSpot), 0), 3);
      // Goal and net.
      const gx = sgn > 0 ? HL : -HL - 1.6;
      g.fillStyle(0xdfe7e1, 0.35).fillRect(...rect(gx, -PITCH.goalW / 2, 1.6, PITCH.goalW));
      g.lineStyle(3, 0xffffff, 1).strokeRect(...rect(gx, -PITCH.goalW / 2, 1.6, PITCH.goalW));
      g.lineStyle(2, 0xf2f6f2, 0.9).fillStyle(0xf2f6f2);
    }
    // Dugouts and the tunnel, so the touchline has some life.
    g.fillStyle(0x3a4a42).fillRect(...rect(-13, -HW - 5.6, 9, 1.6)).fillRect(...rect(4, -HW - 5.6, 9, 1.6));
    g.fillStyle(0x10160f).fillRect(...rect(-2, -HW - 10, 4, 3));
  }

  label(a: Actor): Phaser.GameObjects.Text {
    let t = this.labels.get(a.id);
    if (!t) {
      const fb = a.fb;
      const dark = fb ? this.luma(fb.role === "GK" ? 0x2fbf71 : this.m.teams[fb.team].colour) > 150 : false;
      t = this.add.text(0, 0, fb ? String(fb.number) : "", { fontFamily: "system-ui, sans-serif", fontSize: "10px", fontStyle: "bold", color: dark ? "#10202a" : "#ffffff" })
        .setOrigin(0.5).setDepth(4).setResolution(2);
      this.labels.set(a.id, t);
    }
    return t;
  }
  luma(c: number) { return ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; }

  update(_t: number, dms: number) {
    const w = this.world, s = w.state, m = this.m;
    this.stepper.advance(dms / 1000, () => {
      this.driveIntruder();
      stepWorld(w);
    }, 12);

    const g = this.g, tick = s.tick, b = m.ball;
    g.clear();
    const R = 0.62 * S;
    let carrier: Actor | null = null;
    for (const id in s.actors) {
      const a = s.actors[id];
      const fb = a.fb;
      const lab = this.label(a);
      if (fb && fb.status === "gone") { lab.setVisible(false); continue; }
      const x = this.mx(a.x, a.y), y = this.my(a.x, a.y);
      const down = (fb ? fb.stunUntil > tick + 20 : false) || a.downUntil > tick;
      g.fillStyle(0x000000, 0.25).fillEllipse(x + 2, y + 3, R * 2.1, R * 1.5);
      let col = 0x1c1c1c, edge = 0xffffff;
      if (fb) { const team = m.teams[fb.team]; col = fb.role === "GK" ? (fb.team === 0 ? 0x2fbf71 : 0xf08a24) : team.colour; edge = fb.role === "GK" ? 0x10202a : team.colour2; }
      else if (a.off) { col = a.off.job === "referee" ? 0x15171a : 0xd9e021; edge = a.off.job === "referee" ? 0xf2c94c : 0x15171a; }
      else { col = 0xffffff; edge = 0xe5484d; }
      if (b.owner === a.id) g.lineStyle(2, 0xffffff, 0.9).strokeCircle(x, y, R + 4);
      if (fb?.star) g.lineStyle(2.5, 0xf2c94c, 1).strokeCircle(x, y, R + 2);
      const bench = fb?.status === "bench";
      const rr = (bench ? 0.75 : !fb && !a.off ? 1.35 : 1) * R;
      if (down) g.fillStyle(col, 0.9).fillEllipse(x, y, rr * 2.6, rr * 1.4).lineStyle(1.5, edge, 1).strokeEllipse(x, y, rr * 2.6, rr * 1.4);
      else {
        g.fillStyle(col, 1).fillCircle(x, y, rr).lineStyle(2, edge, 1).strokeCircle(x, y, rr);
        // A dot for the head, pushed towards where he is facing.
        const fx = Math.cos(a.facing), fy = Math.sin(a.facing);
        g.fillStyle(edge, 1).fillCircle(x + (this.rot ? fy : fx) * rr * 0.75, y + (this.rot ? -fx : fy) * rr * 0.75, rr * 0.28);
      }
      lab.setVisible(!!fb && !bench && !down).setPosition(x, y);
      if (b.owner === a.id) carrier = a;
    }

    // Ball: shadow on the grass, ball lifted by its height.
    const bx = this.mx(b.x, b.y), by = this.my(b.x, b.y);
    g.fillStyle(0x000000, 0.35).fillEllipse(bx + b.z * 3, by + 2 + b.z * 3, 8, 5);
    const br = (0.3 + b.z * 0.06) * S;
    g.fillStyle(0xffffff, 1).fillCircle(bx, by - b.z * S * 0.55, br).lineStyle(1.5, 0x111111, 1).strokeCircle(bx, by - b.z * S * 0.55, br);

    if (carrier) {
      this.nameTag.setVisible(true).setText((carrier.fb?.star ? "★ " : "") + carrier.name)
        .setPosition(this.mx(carrier.x, carrier.y), this.my(carrier.x, carrier.y) - R - 6)
        .setColor(carrier.fb?.star ? "#f2c94c" : "#ffffff");
    } else this.nameTag.setVisible(false);

    // Camera.
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    let tx = this.mx(b.x + b.vx * 0.35, b.y + b.vy * 0.35), ty = this.my(b.x + b.vx * 0.35, b.y + b.vy * 0.35);
    const ext = (half: number, view: number) => Math.max(0, (half + 5) * S - view / 2);
    const ex = ext(this.rot ? HW : HL, vw), ey = ext(this.rot ? HL : HW, vh);
    tx = clamp(tx, -ex, ex); ty = clamp(ty, -ey, ey);
    if (this.wide) { tx = 0; ty = 0; }
    const k = 1 - Math.pow(0.02, Math.min(dms, 100) / 1000);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    cam.centerOn(this.camX, this.camY);

    this.drawHud();
  }

  // ---------- HUD ----------
  lastHud = "";
  drawHud() {
    const m = this.m;
    const phys = m.physicalGoals[0] !== m.score[0] || m.physicalGoals[1] !== m.score[1];
    const label = m.phase === "finished" ? "FT" : m.phase === "break" ? (m.period === 1 ? "HT" : "…") : m.phase === "pre" ? "0:00" : clockLabel(m);
    const pens = m.shootout ? ` (${m.shootout.scored[0]}–${m.shootout.scored[1]})` : "";
    const key = `${m.score[0]}|${m.score[1]}|${label}|${pens}|${phys}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      $("g0").textContent = String(m.score[0]); $("g1").textContent = String(m.score[1]);
      $("clock").textContent = label + pens;
    }
    // Radar.
    const c = $<HTMLCanvasElement>("radarc"), ctx = c.getContext("2d")!;
    const W = c.width, H = c.height, sx = W / (PITCH.L + 4), sy = H / (PITCH.W + 4);
    ctx.fillStyle = "#1f5c2c"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.5;
    ctx.strokeRect(2 * sx, 2 * sy, PITCH.L * sx, PITCH.W * sy);
    ctx.beginPath(); ctx.moveTo(W / 2, 2 * sy); ctx.lineTo(W / 2, H - 2 * sy); ctx.stroke();
    const s = this.world.state;
    for (const t of [0, 1] as TeamIdx[]) {
      for (const a of playing(s, m, t)) {
        const px = (a.x + HL + 2) * sx, py = (a.y + HW + 2) * sy;
        ctx.beginPath(); ctx.arc(px, py, a.fb!.star ? 5 : 4, 0, 6.3);
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

  wireHud() {
    const speeds = [0, 1, 2, 4, 8];
    for (const sp of speeds) {
      $("sp" + sp).addEventListener("click", () => {
        this.stepper.timeScale = sp;
        for (const o of speeds) $("sp" + o).setAttribute("aria-pressed", String(o === sp));
      });
    }
    const toggle = (btn: string, sheet: string, other: [string, string]) => $(btn).addEventListener("click", () => {
      const el = $(sheet); el.hidden = !el.hidden;
      $(btn).setAttribute("aria-pressed", String(!el.hidden));
      $(other[1]).hidden = true; $(other[0]).setAttribute("aria-pressed", "false");
      if (!el.hidden && sheet === "stats") this.renderStats();
    });
    toggle("b-meddle", "meddle", ["b-stats", "stats"]);
    toggle("b-stats", "stats", ["b-meddle", "meddle"]);
    $("b-cam").addEventListener("click", () => {
      this.wide = !this.wide; $("b-cam").setAttribute("aria-pressed", String(this.wide)); this.setZoom();
    });
    $("new").addEventListener("click", () => { this.newMatch($<HTMLSelectElement>("opp").value); $("meddle").hidden = true; $("b-meddle").setAttribute("aria-pressed", "false"); });

    const act = (id: string, fn: () => string | null) => $(id).addEventListener("click", () => {
      if (this.m.phase === "finished") return;
      const note = fn();
      if (note) this.say({ t: this.world.state.tick, text: note, big: false });
    });
    const starOf = (t: TeamIdx) => playing(this.world.state, this.m, t).find((a) => a.fb!.star);
    act("m-star", () => { const a = starOf(1); if (!a) return "They have no star left to arrest."; removePlayer(this.world, a.id, "arrested"); return null; });
    act("m-ourstar", () => { const a = starOf(0); if (!a) return "England have no star left to arrest."; removePlayer(this.world, a.id, "arrested"); return null; });
    act("m-keeper", () => { const gk = playing(this.world.state, this.m, 1).find((a) => a.fb!.role === "GK"); if (gk) bribePlayer(this.world, gk.id); return "(Their goalkeeper has accepted an envelope.)"; });
    act("m-wire", () => { for (const a of playing(this.world.state, this.m, 1)) if (a.fb!.role === "DEF") wirePlayer(this.world, a.id, 150); return "(Their back four have had something in their half-time oranges.)"; });
    act("m-refbribe", () => { biasReferee(this.world, 0, 0.85); return "(The referee has developed a soft spot for England.)"; });
    act("m-distract", () => { distractReferee(this.world, 30); return null; });
    act("m-floor", () => { floorReferee(this.world, 20); return null; });
    act("m-invade", () => { this.sendIntruder(); return null; });
  }

  // A stand-in for the player: a fat man who runs on, reaches the ball and shoots.
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
        // Job done; he is escorted away.
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
