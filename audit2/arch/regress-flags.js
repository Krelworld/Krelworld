// Run the audit's regress.js with some clarity switches off (or all), without touching the game or regress.js.
//   CLARITY_OFF=all   NODE_PATH=$(npm root -g) node regress-flags.js <basePort> <out.json> [gameDir] [only=choices|flows]
//   CLARITY_OFF=G3,G9 NODE_PATH=$(npm root -g) node regress-flags.js 8852 /abs/out.json /abs/worktree/public/chef-marina
// Every browser context regress.js (and harness.js) creates gets window.CLARITY_OFF set before any page script runs;
// clarity-flags.js reads it. The same trick works in your own harness scripts: await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, 'G3').
const pw = require('playwright');
const off = process.env.CLARITY_OFF || '';
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a), nc = b.newContext.bind(b);
  b.newContext = async (...c) => { const ctx = await nc(...c); if (off) await ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off); return ctx; };
  return b;
};
require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/regress.js');
