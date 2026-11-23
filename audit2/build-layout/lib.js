// layout worker test helpers: boot the worktree game with some clarity switches off and optional safe-area insets (CDP)
const pw = require('playwright');
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const DIR = '/home/user/Krelworld/.wt/layout/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-layout/';
const MINE = 'G4,G13,G14,G19';
let OFF = '';
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a), nc = b.newContext.bind(b), off = OFF;
  b.newContext = async (...c) => { const ctx = await nc(...c); if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off); return ctx; };
  return b;
};
// opts: H.boot options + off ('' | 'G4,...' | 'all') + inset {left,right,top,bottom} (applied before the game starts)
async function boot(opts) {
  OFF = opts.off || '';
  const start = opts.start !== false, room = opts.room || 'living';
  const g = await H.boot({ port: 8901, dir: DIR, ...opts, start: false });
  if (opts.inset) {
    const c = await g.ctx.newCDPSession(g.page);
    await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0, ...opts.inset } });
    await g.page.waitForTimeout(200);
    await g.page.evaluate(() => { if (typeof resize === 'function' && E.cv) resize(); });
  }
  if (start) { await g.page.evaluate(r => startGame(r), room); await g.page.waitForTimeout(opts.settle || 4000); }
  return g;
}
const R = (page, sels) => page.evaluate(sels => { const o = {}; for (const s of sels) { const n = document.querySelector(s); if (!n) { o[s] = null; continue; } const r = n.getBoundingClientRect(); o[s] = [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.right * 10) / 10, Math.round(r.bottom * 10) / 10]; } return o; }, sels);
module.exports = { boot, H, DIR, OUT, MINE, R };
