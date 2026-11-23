// Shared helpers for the wayfinding builder's checks (G35-G39).
// boot({ view, room, off, storage, start, head }) : off = CLARITY_OFF value ('G35' | 'all' | ...), head = serve arch/head on 8847.
const pw = require('playwright');
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const WT = '/home/user/Krelworld/.wt/wayfinding/public/chef-marina';
const HEAD = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/arch/head/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-wayfinding/';
const TH = JSON.stringify({ v: 1, seen: { treehouse: 1 }, builds: [{ kind: 'treehouse', spot: 'oak', colour: 'red', style: 'gable', addons: ['lights', 'flag', 'tube'], toys: ['🧸'] }, { kind: 'treehouse', spot: 'pine', colour: 'blue', style: 'round', addons: [], toys: ['🧸'] }] });
let OFF = '';
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a), nc = b.newContext.bind(b);
  b.newContext = async (...c) => { const ctx = await nc(...c); const v = OFF; if (v) await ctx.addInitScript(x => { window.CLARITY_OFF = x; }, v); return ctx; };
  return b;
};
async function boot(o = {}) {
  OFF = o.off || '';
  const port = o.head ? 8847 : (o.port || 8920), dir = o.head ? HEAD : WT;
  const g = await H.boot({ port, view: o.view || 'port', room: o.room || 'living', start: o.start !== false, dir, storage: o.storage, settle: o.settle });
  OFF = '';
  g.ev = (fn, arg) => g.page.evaluate(fn, arg);
  g.wait = ms => g.page.waitForTimeout(ms);
  g.go = async (room, ms = 1400) => { await g.page.evaluate(r => { if (G.room !== r) travelTo(r); }, room); await g.page.waitForTimeout(ms); await g.calm(); };
  g.realErrors = () => g.errors.filter(e => !/chip_love/.test(e));
  return g;
}
const VIEWS = ['port', 'land', 'portSmall', 'landSmall'];
module.exports = { boot, H, WT, HEAD, OUT, TH, VIEWS };
