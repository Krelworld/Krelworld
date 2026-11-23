// bubbles builder: shared test helpers. boot({ view, room, off, port }) serves the bubbles worktree; off = CLARITY_OFF value.
const pw = require('playwright');
let OFF = '';
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a), nc = b.newContext.bind(b);
  b.newContext = async (...c) => { const ctx = await nc(...c); if (OFF) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, OFF); return ctx; };
  return b;
};
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const DIR = '/home/user/Krelworld/.wt/bubbles/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-bubbles/';
async function boot(opt) { OFF = opt.off || ''; const g = await H.boot({ port: 8880, dir: DIR, ...opt }); OFF = ''; return g; }
const VIEWS = { ...H.VIEWS, s844x340: { width: 844, height: 340 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const real = errs => errs.filter(e => !/chip_love/.test(e));
module.exports = { boot, DIR, OUT, VIEWS, sleep, real, H };
