// shared helpers for the rings worker's checks. OFF: set lib.off = 'G6,G7' (or 'all') before boot to switch items off.
const pw = require('playwright');
const L = { off: process.env.CLARITY_OFF || '' };
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a), nc = b.newContext.bind(b);
  b.newContext = async (...c) => { const ctx = await nc(...c); const v = L.off; if (v) await ctx.addInitScript(x => { window.CLARITY_OFF = x; }, v); return ctx; };
  return b;
};
const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
L.H = H;
L.DIR = '/home/user/Krelworld/.wt/rings/public/chef-marina';
L.OUT = '/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit2/build-rings/';
L.boot = (o) => H.boot(Object.assign({ port: 8870, dir: L.DIR }, o));
L.quiet = (page, room) => page.evaluate((room) => { G.busy = false; G.sceneOn = false; UI.closeActions(); if (window.clearWish) clearWish(); try { lastPing = E.t + 9999; } catch (e) { }
  for (const e of [daddy, mommy, rory, nunu, jeff]) { if (e && e.room === room) { e.room = room === 'yard' ? 'kitchen' : 'yard'; } AI.hold && e && AI.hold(e, true); }
  if (niko.room === room) niko.room = room === 'yard' ? 'kitchen' : 'yard';
  miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.mess = []; G.needTP = false; G.holding = null; G.pendingDish = null;
  if (marina.mount) dismount(); marina.state = 'idle'; marina.offY = 0; marina.anim = null; }, room);
module.exports = L;
