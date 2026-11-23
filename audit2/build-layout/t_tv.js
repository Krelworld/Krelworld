const { boot, MINE } = require('./lib.js');
(async () => { for (const [mode, off] of [['TODAY', MINE], ['ON', ''], ['TODAY', MINE], ['ON', '']]) { const g = await boot({ view: 'landSmall', room: 'living', off }); const p = g.page; await g.calm();
  const look = () => p.evaluate(() => { const st = document.getElementById('stage'); return [st.classList.contains('tvon'), getComputedStyle(document.getElementById('roombar')).opacity, getComputedStyle(document.getElementById('floorpill')).opacity, getComputedStyle(document.getElementById('alerts')).opacity, G.tv ? 'tv' : '-'].join(' '); });
  await p.evaluate(() => tvOn(showList()[0])); const a = []; for (const t of [300, 900, 2000]) { await p.waitForTimeout(t); a.push(await look()); }
  await p.evaluate(() => tvOff()); await p.waitForTimeout(1200); a.push(await look());
  console.log(mode, a.join(' | ')); await g.close(); } })();
