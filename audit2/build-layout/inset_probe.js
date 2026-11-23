const H = require('/tmp/claude-0/-home-user-Krelworld/be5a56b8-2f71-5309-b8d4-9cbd99e75323/scratchpad/audit/harness.js');
const DIR = '/home/user/Krelworld/.wt/layout/public/chef-marina';
(async () => {
  const g = await H.boot({ port: 8900, view: 'land', room: 'kitchen', dir: DIR, settle: 1500 });
  const c = await g.ctx.newCDPSession(g.page);
  try { await c.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, bottom: 21, right: 47 } }); console.log('ok'); } catch (e) { console.log('no inset api', e.message); }
  await g.page.waitForTimeout(300);
  console.log(await g.page.evaluate(() => { const cs = getComputedStyle(document.getElementById('app')); return [cs.paddingLeft, cs.paddingRight, cs.paddingBottom, document.getElementById('stage').getBoundingClientRect().toJSON()]; }));
  console.log(await g.page.evaluate(() => navigator.userAgent));
  await g.close();
})();
