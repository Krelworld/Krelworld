// shared helpers for the status worker's checks
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const { chromium } = require('playwright');
const DIR = '/home/user/Krelworld/.wt/status/public/chef-marina';
const OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-status/';
// boot with optional CLARITY_OFF (set before any page script); same shape as H.boot's result
async function boot({ port = 8860, view = 'port', room = 'living', start = true, off = '', settle = 5000, dir = DIR } = {}) {
  if (!off) return H.boot({ port, view, room, start, dir, settle });
  await H.serve(port, dir);
  const launch = chromium.launch.bind(chromium);
  const orig = chromium.launch; chromium.launch = async (...a) => { const b = await launch(...a), nc = b.newContext.bind(b); b.newContext = async (...c) => { const ctx = await nc(...c); await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off); return ctx; }; return b; };
  try { return await H.boot({ port, view, room, start, dir, settle }); } finally { chromium.launch = orig; }
}
// log every Audio2.blip call (outermost, before any hook) and which ones reached the game's own blip
const blipLog = `(() => { if (window.__bl) return; window.__bl = []; const C = Clarity;
  C.hook('Audio2.blip', 'G15', { order: -1000, before(c) { window.__bl.push({ a: Array.from(c.args), t: performance.now(), ran: false }); } });
  C.hook('Audio2.blip', 'G15', { order: 1000, before(c) { const l = window.__bl[window.__bl.length - 1]; if (l) l.ran = true; } }); })()`;
module.exports = { H, boot, DIR, OUT, blipLog, sleep: ms => new Promise(r => setTimeout(r, ms)) };
