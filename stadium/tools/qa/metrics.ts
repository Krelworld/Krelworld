// The numbers from a QA session (tools/qa/session.cjs): how soon the player got a reaction, how much was
// going on and whether it happened on screen, how much text there was, how the schemes went, whether any
// NPC got stuck or jumped, and whether the session replays exactly. Writes metrics.json and metrics.md.
//
//   npx tsx tools/qa/metrics.ts qa-out/NAME [--no-replay]
import fs from "node:fs";
import path from "node:path";
import { createGame, stepGame } from "../../src/stadium/game";
import { fingerprint, replay, type Recording } from "../../src/stadium/replay";

const dir = process.argv[2];
if (!dir) { console.error("usage: metrics.ts qa-out/NAME"); process.exit(1); }
const read = (f: string, d: any = null) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return d; } };
const session = read("session.json", {}), rec: Recording | null = read("recording.json"), samples: any[] = read("samples.json", []), npcs: any[] = read("npcs.json", []);
const { causes = [] } = read("causes.json", {}) as { causes: any[] };
const schemes = read("schemes.json", {}) as Record<string, any>;
const events: any[] = fs.existsSync(path.join(dir, "events.jsonl")) ? fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const sec = (t?: number | null) => (t == null ? null : Math.round(t / 6) / 10);
const fmt = (v: number | null) => (v == null ? "never" : `${v}s`);
const pct = (a: number[], q: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// When the player started doing things, and when the world first answered.
const firstMove = rec?.moves.find((m) => m[1] || m[2])?.[0] ?? null;
const firstAct = rec?.acts[0]?.[0] ?? null;
const links = causes.filter((c) => c.parent);
const firstReaction = links[0]?.t ?? null;
const firstChain = events.find((e) => e.type === "chain")?.t ?? null;

// What happened, and whether a player watching would have seen it.
const roots = causes.filter((c) => !c.parent);
const trees = roots.map((r) => causes.filter((c) => c.root === r.id));
const families: Record<string, number> = {};
for (const c of causes) families[c.rule] = (families[c.rule] ?? 0) + 1;
const seenLinks = links.filter((c) => c.onscreen === 1).length, knownLinks = links.filter((c) => c.onscreen != null).length;

// Dead time: the longest stretch after the player's first input with no visible consequence.
const BEATS = new Set(["chain", "scheme_play", "scheme_news", "spew", "fb_goal", "fb_removed", "caught", "custody_start", "drawn", "fixed", "tipoff_arrest"]);
const beatTimes = [...links.map((c) => c.t), ...events.filter((e) => BEATS.has(e.type)).map((e) => e.t)].sort((a, b) => a - b);
let maxGap = 0, gapAt = 0;
const start = Math.min(firstMove ?? Infinity, firstAct ?? Infinity);
if (Number.isFinite(start)) {
  let prev = start;
  for (const t of [...beatTimes.filter((t) => t >= start), session.endTick ?? prev]) { if (t - prev > maxGap) { maxGap = t - prev; gapAt = prev; } prev = Math.max(prev, t); }
}

// Text on screen (the owner's most repeated complaint): how many separate pieces, how many words.
const live = samples.filter((s) => !s.dom?.includes("sheet"));
const texts = live.map((s) => s.text), words = live.map((s) => s.words);
const over2 = texts.filter((n) => n > 2).length;

// The schemes: what was learnt, what was arranged, what played.
const schemeOut = Object.fromEntries(Object.entries(schemes).map(([id, sc]) => [id, { clues: Object.fromEntries(Object.entries(sc.clues ?? {}).map(([k, t]) => [k, sec(t as number)])), met: Object.fromEntries(Object.entries(sc.met ?? {}).filter(([, v]) => v)), variant: sc.variant ?? null, done: !!sc.done }]));

// NPCs that stood still with somewhere to go, or jumped across the map.
const stalls: Record<string, { job: string; secs: number; at: [number, number] }> = {}, jumps: { id: string; job: string; d: number; t: number }[] = [];
const last: Record<string, { x: number; y: number; t: number; since: number; hid: number }> = {};
// (plan here is 1 when he's trying to get somewhere: a "go" task or a path.)
for (const frame of npcs) for (const [id, job, x, y, mode, plan, hid, down] of frame.a) {
  const l = last[id];
  if (l && !hid && !l.hid && frame.t - l.t <= 150) { const d = Math.hypot(x - l.x, y - l.y); if (d > 18) jumps.push({ id, job, d: Math.round(d), t: sec(frame.t)! }); }
  const still = l && Math.hypot(x - l.x, y - l.y) < 0.3;
  const since = still ? l.since : frame.t;
  if (still && job !== "player" && job !== "official" && mode === "routine" && plan > 0 && !hid && !down && frame.t - since >= 60 * 20) { const s0 = stalls[id]; stalls[id] = { job, secs: Math.max(s0?.secs ?? 0, sec(frame.t - since)!), at: [x, y] }; }
  last[id] = { x, y, t: frame.t, since, hid };
}

// Does the session replay exactly? (Headless, to the tick the browser stopped at.)
let replayOk: boolean | string = "skipped";
if (rec && !process.argv.includes("--no-replay") && session.fingerprint) {
  if (rec.broken !== undefined) replayOk = `not replayable after ${sec(rec.broken)}s (state changed from outside)`;
  else { const g = replay(rec, createGame, stepGame, session.endTick); replayOk = fingerprint(g.w) === session.fingerprint; }
}

const m = {
  scenario: session.scenario, device: session.device, threeD: session.threeD, seconds: sec(session.endTick), pageErrors: session.errors?.length ?? 0,
  firstMove: sec(firstMove), firstAction: sec(firstAct), firstReaction: sec(firstReaction), firstChain: sec(firstChain),
  playerActions: rec?.acts.length ?? 0,
  consequences: { roots: roots.length, links: links.length, longestChain: Math.max(0, ...trees.map((t) => t.length)), families, onScreenShare: knownLinks ? Math.round((100 * seenLinks) / knownLinks) : null },
  deadTime: { longestSecs: sec(maxGap), from: sec(gapAt) },
  text: { samples: live.length, median: pct(texts, 0.5), p95: pct(texts, 0.95), max: Math.max(0, ...texts), shareOver2: live.length ? Math.round((100 * over2) / live.length) : 0, wordsMedian: pct(words, 0.5), wordsP95: pct(words, 0.95) },
  schemes: schemeOut,
  npcs: { stalled: Object.entries(stalls).map(([id, v]) => ({ id, ...v })), jumps },
  replay: replayOk,
  render: session.renderInfo,
};
fs.writeFileSync(path.join(dir, "metrics.json"), JSON.stringify(m, null, 1));
const md = [
  `# ${m.scenario} (${m.device}${m.threeD ? ", 3D" : ""})`, "",
  `- Session: ${m.seconds}s of game time; ${m.playerActions} player actions; ${m.pageErrors} page errors; replays exactly: ${m.replay}`,
  `- First move ${fmt(m.firstMove)}, first action ${fmt(m.firstAction)}, first reaction ${fmt(m.firstReaction)}, first chain ${fmt(m.firstChain)}`,
  `- Consequences: ${m.consequences.roots} started, ${m.consequences.links} knock-ons, longest chain ${m.consequences.longestChain}, ${m.consequences.onScreenShare ?? "?"}% of knock-ons on screen; rule families ${JSON.stringify(m.consequences.families)}`,
  `- Longest dead stretch: ${m.deadTime.longestSecs}s (from ${m.deadTime.from}s)`,
  `- Text on screen: median ${m.text.median} pieces, 95th percentile ${m.text.p95}, max ${m.text.max}; more than two pieces ${m.text.shareOver2}% of the time; words median ${m.text.wordsMedian}, 95th percentile ${m.text.wordsP95}`,
  `- Schemes: ${Object.entries(m.schemes).map(([id, v]: any) => `${id}: ${Object.keys(v.clues).length} clues, met [${Object.keys(v.met).join(", ")}], ${v.variant ?? "no payoff"}`).join("; ")}`,
  `- NPCs stalled 20s+ with somewhere to go: ${m.npcs.stalled.length}${m.npcs.stalled.length ? " (" + m.npcs.stalled.slice(0, 6).map((s) => `${s.job} ${s.secs}s`).join(", ") + ")" : ""}; jumps over 18 m: ${m.npcs.jumps.length}`,
].join("\n");
fs.writeFileSync(path.join(dir, "metrics.md"), md + "\n");
console.log(md);
