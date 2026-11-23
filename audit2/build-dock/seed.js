// does a seeded Math.random (init script) make the treasure hiding places repeatable? discover them by the 150 ms timer the find schedules
const L = require('./lib.js');
const SEED = s => { let a = s >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
async function discover(seed) {
  const g = await L.H.boot({ port: 8898, view: 'port', room: 'kitchen', start: false, dir: L.DIR });
  await g.ctx.addInitScript(SEED, seed); await g.page.reload(); await g.page.waitForTimeout(2500); await g.page.evaluate(() => startGame('kitchen')); await g.page.waitForTimeout(3000);
  const r = await g.page.evaluate(async () => { const out = []; for (const room of Object.keys(PROPS)) { G.room = room; for (const p of PROPS[room]) { const st = window.setTimeout; let f = false; window.setTimeout = function (fn, ms) { if (ms === 150) f = true; return st.apply(this, arguments); }; try { G.busy = false; propActions(p); } catch (e) { } window.setTimeout = st; if (f) out.push(room + '/' + p.id); } } return out; });
  await g.close(); return r;
}
(async () => { const a = await discover(7), b = await discover(7), c = await discover(8); console.log(JSON.stringify({ a, b, c, same: JSON.stringify(a) === JSON.stringify(b) })); })().catch(e => { console.error(e); process.exit(1); });
