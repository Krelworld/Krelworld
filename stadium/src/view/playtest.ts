// The playtest recorder (?playtest): the report's step-6 gate, measured rather than guessed. It times a
// first-time player against the report's opening targets, counts the things that signal confusion
// (opening the Bag for nothing, standing stuck), and gives the person watching a button to log each
// laugh and what caused it. Each tester's session is kept on the device; the report shows them all and
// copies as plain text. Read-only: it watches the bus and the inputs, never changes the game.

export interface PtSession {
  at: string;
  secs: number;
  firstMove?: number;
  firstAction?: number;
  firstReaction?: number;
  firstChain?: number;
  firstRule?: number;
  ruleText?: string;
  bagOpens: number;
  stuck: number[];
  verbs: string[];
  failed: number;
  continuedAfterFail: boolean;
  kickoff?: number;
  laughs: { t: number; kind: string; ctx: string }[];
  chains: string[];
  notes: string;
}

const KEY = "kd-playtests";
const TARGETS: [keyof PtSession, string, number][] = [
  ["firstMove", "Understands moving", 20],
  ["firstAction", "First meaningful interaction", 45],
  ["firstReaction", "Causes a visible reaction", 90],
  ["firstChain", "First comic chain (2+ links)", 180],
  ["firstRule", "Learns a rule (card shown)", 300],
];
const MOVES = new Set(["move", "walk", "stop", "face"]);

export class PlayTest {
  s: PtSession;
  t0 = 0;
  lastActive = 0;
  stuckFrom = 0;
  lastFailAt = -1;
  lastContext = "";
  constructor() { this.s = PlayTest.fresh(); }
  static fresh(): PtSession { return { at: new Date().toISOString().slice(0, 19).replace("T", " "), secs: 0, bagOpens: 0, stuck: [], verbs: [], failed: 0, continuedAfterFail: false, laughs: [], chains: [], notes: "" }; }
  get running(): boolean { return this.t0 > 0; }
  now(): number { return this.t0 ? Math.round((performance.now() - this.t0) / 100) / 10 : 0; }
  begin(): void { this.t0 = performance.now(); this.lastActive = this.t0; }
  private first(k: "firstMove" | "firstAction" | "firstReaction" | "firstChain" | "firstRule", v?: string): void {
    if (!this.running || this.s[k] !== undefined) return;
    this.s[k] = this.now();
    if (k === "firstRule" && v) this.s.ruleText = v;
  }
  /** The player touched the controls (stick, tap, a button). */
  active(moving = false): void {
    if (!this.running) return;
    const n = performance.now();
    if (this.stuckFrom && n - this.stuckFrom > 30000) this.s.stuck.push(Math.round((n - this.stuckFrom) / 1000));
    this.stuckFrom = 0; this.lastActive = n;
    if (moving) this.first("firstMove");
  }
  /** Every frame: notice a long stretch of nothing. */
  frame(paused: boolean): void {
    if (!this.running) return;
    const n = performance.now();
    if (paused) { this.lastActive = n; return; }
    if (!this.stuckFrom && n - this.lastActive > 30000) this.stuckFrom = this.lastActive;
    this.s.secs = this.now();
  }
  bag(): void { if (this.running) this.s.bagOpens++; }
  rule(text: string): void { this.first("firstRule", text); }
  event(e: any, pcId: string, near = true): void {
    if (!this.running) return;
    if (e.type === "action" && e.action?.actor === pcId && !MOVES.has(e.action.verb)) {
      this.first("firstAction");
      if (!this.s.verbs.includes(e.action.verb)) this.s.verbs.push(e.action.verb);
      if (this.lastFailAt >= 0 && this.now() - this.lastFailAt < 120) this.s.continuedAfterFail = true;
      this.lastContext = e.action.verb;
    }
    if (e.type === "action_failed" && e.action?.actor === pcId) { this.s.failed++; this.lastFailAt = this.now(); }
    if (e.type === "chain" && e.by === pcId) {
      this.first("firstReaction");
      if (e.links.length >= 2) this.first("firstChain");
      const line = e.links.join(" → ");
      const last = this.s.chains[this.s.chains.length - 1];
      if (last && line.startsWith(last)) this.s.chains[this.s.chains.length - 1] = line; else this.s.chains.push(line);
      this.lastContext = line;
    }
    if (["post_left", "bowled", "dog_lured", "ball_to_pc", "keg_rolled", "stole", "spotted"].includes(e.type)) this.first("firstReaction");
    if (e.type === "say" && e.by !== pcId && near) this.lastContext = `"${e.text}"`;
    if (e.type === "fb_kickoff" && e.period === 1 && this.s.kickoff === undefined) this.s.kickoff = this.now();
  }
  laugh(kind: string): void { if (this.running) this.s.laughs.push({ t: this.now(), kind, ctx: this.lastContext.slice(0, 90) }); }
  /** This tester's session, kept with the others on the device. */
  save(): PtSession[] {
    const all = PlayTest.all();
    if (this.running && this.s.secs > 5) {
      const i = all.findIndex((x) => x.at === this.s.at);
      if (i >= 0) all[i] = this.s; else all.push(this.s);
      try { localStorage.setItem(KEY, JSON.stringify(all.slice(-30))); } catch { /* ignore */ }
    }
    return all;
  }
  next(): void { this.save(); this.s = PlayTest.fresh(); this.begin(); }
  static all(): PtSession[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } }
  static clear(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

  static text(all: PtSession[]): string {
    const out: string[] = [`Knockout Day playtests: ${all.length} tester(s)`, ""];
    all.forEach((s, i) => {
      out.push(`Tester ${i + 1} (${s.at}), ${Math.round(s.secs)} s played`);
      for (const [k, label, target] of TARGETS) { const v = s[k] as number | undefined; out.push(`  ${label}: ${v === undefined ? "never" : v + " s"} (target < ${target} s) ${v !== undefined && v <= target ? "PASS" : "MISS"}`); }
      if (s.ruleText) out.push(`  Rule: ${s.ruleText}`);
      out.push(`  Bag opened: ${s.bagOpens} (target ≤ 1)  Stuck over 30 s: ${s.stuck.length ? s.stuck.map((x) => x + " s").join(", ") : "never"}`);
      out.push(`  Things tried: ${s.verbs.length} (${s.verbs.join(", ")})  Failed attempts: ${s.failed}${s.failed ? (s.continuedAfterFail ? ", carried on after" : ", stopped trying") : ""}`);
      if (s.kickoff !== undefined) out.push(`  Kick-off at ${s.kickoff} s`);
      out.push(`  Laughs: ${s.laughs.length}${s.laughs.length ? " — " + s.laughs.map((l) => `${l.kind} at ${l.t} s [${l.ctx}]`).join("; ") : ""}`);
      if (s.chains.length) out.push(`  Chains: ${s.chains.join(" | ")}`);
      if (s.notes) out.push(`  Notes: ${s.notes}`);
      out.push("");
    });
    if (all.length) {
      const laughs = all.flatMap((s) => s.laughs), by = (k: string) => laughs.filter((l) => l.kind === k).length;
      out.push(`All laughs: ${laughs.length}. From a line: ${by("line")}, an animation: ${by("animation")}, their own plan: ${by("plan")}, an accident: ${by("accident")}.`);
      out.push(laughs.length && by("line") / laughs.length > 0.7 ? "Warning (the report): nearly all laughs came from dialogue, not from things players caused." : "");
      for (const [k, label, target] of TARGETS) { const hit = all.filter((s) => (s[k] as number | undefined) !== undefined && (s[k] as number) <= target).length; out.push(`${label}: ${hit}/${all.length} within ${target} s`); }
      const caus = all.filter((s) => s.firstChain !== undefined).length;
      out.push(caus < Math.ceil(all.length / 2) ? "Gate: fewer than half made a chain. The report says stop expanding until the first chain is understood." : "Gate: most testers made a chain. Ask each one why the person walked off.");
    }
    return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  }
}
