// The game as text, for a naive-player agent: what Grozz can see and hear, what he can do here, and a way
// to act. No coordinates of hidden things, no code, no scheme internals: only what a player on a phone would
// have in front of them. It is deterministic, so an agent plays by sending its whole list of commands each
// time; the game is replayed to the end of the list and the latest observation is printed.
//
//   npx tsx tools/qa/textplay.ts --seed qa-naive --cmds cmds.txt [--log transcript.txt]
//
// Commands, one per line:
//   look                     describe what's around (costs no time)
//   go <dir> <metres>        walk: n, ne, e, se, s, sw, w, nw (north is up the screen, towards the stadium)
//   goto <number>            walk to a person or thing numbered in the last description
//   do <number>              take one of the numbered actions on offer
//   wait <seconds>           let time pass
//   buy <name>               buy something from the shop you're stood at (its shelf is listed under the action)
//   plan <id>                pin one of the plan cards; follow: walk to where the pinned step points
import fs from "node:fs";
import { createGame, stepGame } from "../../src/stadium/game";
import { areaAt, setPace } from "../../src/stadium/layout";
import { dispatch } from "../../src/core/verbs";
import { options, personName, itemName } from "../../src/stadium/context";
import { whatItDoes, statusOf } from "../../src/stadium/outcomes";
import { cards, pinned } from "../../src/stadium/missions";
import { badges } from "../../src/stadium/fstates";
import { findPath } from "../../src/stadium/nav";
import { defOf, ITEM_DEFS } from "../../src/core/items";
import { SHOPS } from "../../src/stadium/rules";

const arg = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const seed = arg("--seed") ?? "qa-naive";
const cmds = fs.existsSync(arg("--cmds") ?? "") ? fs.readFileSync(arg("--cmds")!, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
setPace({ kickoffAt: 540, calm: true, soft: true });
const g = createGame(seed), w = g.w, s = w.state, st = s.stadium!, pc = () => s.actors[st.pc];
const heard: string[] = [];
w.bus.on((e: any) => {
  const p = pc();
  if (!p) return;
  if (e.type === "say") { const a = s.actors[e.by]; if (a && Math.hypot(a.x - p.x, a.y - p.y) < 11 && a.id !== p.id) heard.push(`${a.npc?.job === "player" ? personName(a) : a.name} says: "${e.text}"`); }
  if (e.type === "scheme_line" || (e.type === "say" && e.by === p.id)) heard.push(`Grozz mutters: "${e.text}"`);
  if (e.type === "scheme_news") heard.push(`(Tannoy/news) ${e.text}`);
  if (e.type === "chain" && e.by === st.pc) heard.push(`(Something you started is still going: ${e.links.at(-1)})`);
  if (heard.length > 30) heard.splice(0, heard.length - 30);
});
const step = (n: number) => { for (let i = 0; i < n && !st.ending; i++) stepGame(g); };
const DIRS: Record<string, [number, number]> = { n: [0, -1], ne: [0.71, -0.71], e: [1, 0], se: [0.71, 0.71], s: [0, 1], sw: [-0.71, 0.71], w: [-1, 0], nw: [-0.71, -0.71] };
const compass = (dx: number, dy: number) => { const a = Math.atan2(dx, -dy) * 180 / Math.PI; return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((a + 360) % 360) / 45) % 8]; };
// Whatever's within a phone screen of him (about 12 m by 20 m, so ~10 m around), nearest first, numbered.
let things: { label: string; x: number; y: number }[] = [];
function doing(a: any): string {
  const n = a.npc; if (!n) return "";
  if (a.dead) return "dead"; if (a.downUntil > s.tick) return "on the floor"; if (a.seated) return "sitting";
  if (n.mode === "chase") return "chasing someone"; if (n.mode === "approach") return "coming over"; if (n.mode === "escort") return "marching someone off";
  if (n.fetch) return "fetching something back"; if (n.plan?.[0]?.k === "go") return "walking somewhere"; if (Math.hypot(a.vx ?? 0, a.vy ?? 0) > 0.3) return "walking";
  return "standing";
}
function look(): string {
  const p = pc(), out: string[] = [];
  const area = areaAt(p.x, p.y);
  out.push(`Game time ${Math.round(s.tick / 60)}s. You are in: ${area.name}. Money: £${p.money}.${p.hand ? ` In your hand: ${itemName(s.items[p.hand])}.` : ""}${p.pockets.length ? ` Pockets: ${p.pockets.map((i) => itemName(s.items[i])).join(", ")}.` : ""}`);
  const m = s.match!; out.push(`Score: England ${m.score[0]}-${m.score[1]} ${m.teams[1].name}; match: ${m.phase}.`);
  const sv = statusOf(w, p); if (sv) out.push(`Status: ${sv.title} — ${sv.text}`);
  // The plan pinned at the top of the screen, and what's been done to the match.
  const pl = pinned(w);
  out.push(pl ? `Plan (top of screen): ${pl.title}, step ${pl.n + 1} of ${pl.of}: ${pl.text}${pl.where ? ` (${Math.round(Math.hypot(pl.where.x - p.x, pl.where.y - p.y))} m ${compass(pl.where.x - p.x, pl.where.y - p.y)})` : ""}` : `Plan (top of screen): none pinned. On offer: ${cards(w).map((c) => c.title).join(", ") || "nothing"}`);
  const bs = badges(w); if (bs.length) out.push(`In the match: ${bs.map((b) => b.text).join(" ")}`);
  things = [];
  const near = Object.values(s.actors).filter((a) => a.id !== p.id && !a.hiddenIn && Math.abs(a.x - p.x) < 7 && Math.abs(a.y - p.y) < 11).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 12);
  const items = Object.values(s.items).filter((i) => i.loc.k === "ground" && Math.abs((i.loc as any).x - p.x) < 7 && Math.abs((i.loc as any).y - p.y) < 11 && defOf(i).size !== "huge" || (i.loc.k === "ground" && ["keg", "lorry_cargo", "laundry", "kit_hamper"].includes(i.def) && Math.hypot((i.loc as any).x - p.x, (i.loc as any).y - p.y) < 11)).slice(0, 10);
  out.push("You can see:");
  for (const a of near) { const d = Math.hypot(a.x - p.x, a.y - p.y); things.push({ label: personName(a), x: a.x, y: a.y }); out.push(`  [${things.length}] ${a.npc?.job === "player" ? personName(a) : a.name}${a.npc?.job && a.npc.job !== "fan" && a.npc.job !== "local" ? ` (${a.npc.job})` : ""}, ${doing(a)}, ${d.toFixed(0)} m ${compass(a.x - p.x, a.y - p.y)}${a.npc?.bubble ? `, saying "${a.npc.bubble.text}"` : ""}`); }
  for (const i of items) { const l = i.loc as any, d = Math.hypot(l.x - p.x, l.y - p.y); things.push({ label: itemName(i), x: l.x, y: l.y }); out.push(`  [${things.length}] ${itemName(i)}, ${d.toFixed(0)} m ${compass(l.x - p.x, l.y - p.y)}`); }
  if (heard.length) { out.push("Lately you heard:"); for (const h of heard.slice(-8)) out.push(`  ${h}`); heard.length = 0; }
  const opts = options(w, p, null).filter((o) => o.action || o.sheet);
  out.push("You can:");
  opts.slice(0, 12).forEach((o, i) => {
    const h = whatItDoes(w, p, o); out.push(`  (${i + 1}) ${o.label}${h ? ` — ${h}` : ""}`);
    // A shop's shelf, as the shop sheet would show it.
    if (o.sheet?.kind === "shop") { const who = s.actors[o.sheet.who], stock = who?.npc?.shop ? SHOPS[who.npc.shop]?.stock ?? {} : {}; out.push(`      On sale (use: buy <name>): ${Object.entries(stock).map(([d, pr]) => `${ITEM_DEFS[d]?.name ?? d} £${pr}`).join(", ")}`); (globalThis as any).__shop = who?.id; }
  });
  (globalThis as any).__opts = opts;
  return out.join("\n");
}
function walkTo(x: number, y: number, maxSecs = 40): void {
  const p = pc();
  let path = findPath(p.x, p.y, x, y), i = 0;
  for (let t = 0; t < maxSecs * 60 && !st.ending; t++) {
    while (i < path.length && Math.hypot(path[i] - p.x, path[i + 1] - p.y) < 0.6) i += 2;
    const tx = i < path.length ? path[i] : x, ty = i < path.length ? path[i + 1] : y, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (Math.hypot(x - p.x, y - p.y) < 1.3 || (i >= path.length && d < 0.5)) break;
    p.moveX = dx / (d || 1); p.moveY = dy / (d || 1);
    stepGame(g);
    if (t % 120 === 119 && Math.hypot(p.vx ?? 0, p.vy ?? 0) < 0.2) { path = findPath(p.x, p.y, x, y); i = 0; }
  }
  p.moveX = p.moveY = 0;
}
const log: string[] = [];
step(60 * 3);
log.push(look());
for (const c of cmds) {
  const [v, a1, a2] = c.split(/\s+/);
  log.push(`\n> ${c}`);
  const p = pc();
  if (v === "go" && DIRS[a1]) { const [dx, dy] = DIRS[a1], m = Math.min(40, Number(a2) || 5); walkTo(p.x + dx * m, p.y + dy * m, m / 3 + 4); }
  else if (v === "goto") { const t = things[Number(a1) - 1]; if (t) walkTo(t.x, t.y); else log.push("(nothing with that number)"); }
  else if (v === "do") { const o = ((globalThis as any).__opts ?? [])[Number(a1) - 1]; if (!o) log.push("(no such action)"); else if (o.sheet) log.push(`(That opens a menu: ${o.sheet.kind}. Not available in text play; try another action.)`); else { const r = dispatch(w, o.action); log.push(r.ok ? `You: ${o.label}.` : `Couldn't: ${r.reason}`); step(60); } }
  else if (v === "wait") step(Math.min(120, Number(a1) || 5) * 60);
  // The plan at the top of the screen: pick one of the cards ("plan getin"), or walk to where the pinned step points ("follow").
  else if (v === "plan") { const r = dispatch(w, { verb: "mission", actor: p.id, arg: a1 }); log.push(r.ok ? `Pinned: ${a1}.` : `Couldn't: ${r.reason}`); step(30); }
  else if (v === "follow") { const pl = pinned(w); if (pl?.where) { walkTo(pl.where.x, pl.where.y, 90); step(30); } else log.push("(the pinned step doesn't point anywhere)"); }
  else if (v === "buy") {
    const who = s.actors[(globalThis as any).__shop ?? ""], name = c.slice(4).trim().toLowerCase(), stock = who?.npc?.shop ? SHOPS[who.npc.shop]?.stock ?? {} : {};
    const def = Object.keys(stock).find((d) => (ITEM_DEFS[d]?.name ?? d).toLowerCase().includes(name));
    if (!who || !def) log.push("(nobody here sells that)"); else { const r = dispatch(w, { verb: "buy", actor: p.id, target: { k: "actor", id: who.id }, arg: def }); log.push(r.ok ? `You buy ${ITEM_DEFS[def].name}.` : `Couldn't: ${r.reason}`); step(30); }
  }
  else if (v !== "look") log.push("(unknown command)");
  log.push(look());
}
const text = log.join("\n");
if (arg("--log")) fs.writeFileSync(arg("--log")!, text);
console.log(process.argv.includes("--all") ? text : log.slice(-2).join("\n"));
