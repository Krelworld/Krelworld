// Economy audit: what everything costs vs. what a playthrough pays out.
// Run: npx vite-node scripts/economy-audit.ts   (numbers feed docs/ECONOMY.md)
import { DUNGEONS } from "../src/data/dungeons";
import { ENEMIES } from "../src/data/enemies";
import { ENEMIES_CH7 } from "../src/data/enemiesCh7";
import { GUNS, GUN_ORDER } from "../src/data/guns";
import { GENERIC_UPGRADES, upgradeCost } from "../src/game/systems/stats";
import { ammoUnitCost, BANK_PERKS } from "../src/game/systems/armoury";
import { PRIZES } from "../src/content/kreddle";
import { krokenPrice } from "../src/game/systems/kreddle";
import { ARCS } from "../src/content/arcs";
import { PERSONAL_QUESTS, MINISTRY_QUESTS } from "../src/content/quests";
import { CHARACTERS } from "../src/data/characters";
import { DECOR } from "../src/content/home";
import type { GameState } from "../src/data/types";

const E: Record<string, { coins: number }> = { ...ENEMIES, ...ENEMIES_CH7 };
const s = { player: "FLENKY", upgrades: {} as Record<string, number>, guns: {} as Record<string, number>, flags: {} } as unknown as GameState;

console.log("== INCOME: enemy drops per dungeon (base coins, every enemy killed; KREZMAR x1.35) + 18/room clear");
const byCh: Record<number, number> = {};
for (const d of Object.values(DUNGEONS)) {
  let coins = 0;
  for (const r of d.rooms) {
    const groups: [string, number][][] = [...(r.waves ?? []), ...(r.triggers ?? []).map((t) => t[1])];
    for (const w of groups) for (const [id, n] of w) coins += (E[id]?.coins ?? 0) * n;
    coins += 18;
  }
  byCh[d.chapter] = (byCh[d.chapter] ?? 0) + coins;
  console.log(`  ch${d.chapter} ${d.id.padEnd(18)} ${coins}`);
}
console.log("  by chapter (0 = arenas/side):", byCh);

const arcAll = ARCS.filter((a) => a.player === "ALL").reduce((t, a) => t + a.reward.coins, 0);
const arcOwn = ARCS.filter((a) => a.player !== "ALL").reduce((t, a) => t + a.reward.coins, 0) / 9;
console.log(`  side quests (ALL) ${arcAll}, own side stories avg ${Math.round(arcOwn)}, personal avg ${Math.round(PERSONAL_QUESTS.reduce((t, q) => t + q.reward.coins, 0) / PERSONAL_QUESTS.length)}, ministry ${MINISTRY_QUESTS.reduce((t, q) => t + q.reward, 0)}`);

console.log("\n== SINKS (Krezzcoin)");
let gen = 0;
for (const u of GENERIC_UPGRADES) {
  const costs = Array.from({ length: u.max }, (_, l) => upgradeCost(s, l, (u as { base?: number }).base));
  gen += costs.reduce((a, b) => a + b, 0);
  console.log(`  ${u.id.padEnd(8)} ${costs.join(" / ")}`);
}
let perks = 0;
for (const p of BANK_PERKS) {
  const costs = Array.from({ length: p.max }, (_, l) => p.cost * (l + 1));
  perks += costs.reduce((a, b) => a + b, 0);
  console.log(`  ${p.id.padEnd(11)} ${costs.join(" / ")}`);
}
const br = (CHARACTERS.FLENKY.branch ?? []).reduce((t, b) => t + b.cost, 0);
const guns = GUN_ORDER.filter((id) => GUNS[id].shop).map((id) => `${id} ${GUNS[id].shop}`);
const gunTotal = GUN_ORDER.reduce((t, id) => t + (GUNS[id].shop ?? 0), 0);
console.log(`  shop guns: ${guns.join(", ")}`);
console.log(`  TOTAL generic ${gen}, perks ${perks}, branch ${br}, guns ${gunTotal}`);

console.log("\n== AMMO: price per box / per full gun");
for (const id of GUN_ORDER) {
  const g = GUNS[id];
  if (g.maxAmmo > 2000) continue;
  const u = ammoUnitCost(id);
  console.log(`  ${id.padEnd(12)} box ${String(g.pickup).padStart(3)} rds = ${String(u).padStart(3)}   full (${g.maxAmmo}) = ${Math.ceil(g.maxAmmo / g.pickup) * u}`);
}

console.log("\n== KROKENS: Prize Counter (every level)");
let kt = 0;
for (const p of PRIZES) {
  const st = { ...s, upgrades: {} as Record<string, number>, guns: {} } as GameState;
  const costs: number[] = [];
  for (let l = 0; l < (p.gun ? 1 : p.max ?? 1); l++) {
    costs.push(krokenPrice(st, p));
    if (p.key) st.upgrades[p.key] = l + 1;
  }
  kt += costs.reduce((a, b) => a + b, 0);
  console.log(`  ${p.id.padEnd(11)} ${costs.join(" / ")}`);
}
console.log(`  TOTAL prizes ${kt}, furnishings ${DECOR.reduce((t, d) => t + d.price, 0)}`);
