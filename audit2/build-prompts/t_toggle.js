// switches flipped at run time: G1 and G2 start off (CLARITY_OFF), are turned on with Clarity.set, then off again.
const L = require('./lib.js'); const fs = require('fs');
(async () => {
  const g = await L.boot({ port: 8850, room: 'kitchen', off: L.MINE }); await g.calm(); const R = {};
  const probe = async () => { await g.ev(() => UI.openCook('fridge')); await g.page.waitForTimeout(600); const li0 = await g.ev(() => lastInput); await g.tap('#panel .tile'); await g.page.waitForTimeout(300);
    const moved = await g.ev(l => lastInput > l, li0); await g.ev(() => UI.actions(marina, [A('🧹', () => 0), A('🏃', () => 0)])); const ring = await g.ev(() => document.querySelectorAll('#fx .act').length);
    await g.ev(() => { UI.closeActions(); UI.closePanel(); }); await g.page.waitForTimeout(400); return { lastInputMovedOnPanelTap: moved, tidyRingUnderScreen: ring }; };
  R.offAtLoad = await probe();
  await g.ev(() => { for (const id of ['G1', 'G2', 'G20', 'G21', 'G28', 'G29']) Clarity.set(id, true); }); R.setOn = await probe();
  await g.ev(() => { for (const id of ['G1', 'G2', 'G20', 'G21', 'G28', 'G29']) Clarity.set(id, false); }); R.setOffAgain = await probe();
  R.errors = L.errs(g); console.log(JSON.stringify(R)); fs.writeFileSync(L.OUT + 't_toggle.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
