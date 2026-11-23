const { boot, realErrors } = require('./boot.js'); const { TLIB } = require('./tlib.js');
(async () => { for (const [name, view, inset] of [['land', 'land', null], ['landSmall', 'landSmall', null], ['844x340i47', { width: 844, height: 340 }, { left: 47, right: 47, bottom: 21 }], ['844x340', { width: 844, height: 340 }, null]]) {
  const g = await boot({ port: 8910, view, inset, room: 'living' }); await g.calm(); await g.ev(TLIB); const o = {};
  for (let rep = 0; rep < 3; rep++) { o['shelf' + rep] = await g.ev(async () => { await T.reset(); G.busy = false; openStory(); await T.sleep(500); const u = T.underX(); const books = [...document.querySelectorAll('#storyBox .st-book')].map(b => b.getBoundingClientRect()); return { hits: Object.values(u.pts).flatMap(p => p.hits), rows: new Set(books.map(r => Math.round(r.top))).size, bookW: Math.round(books[0].width), right: Math.round(Math.max(...books.map(r => r.right))), vw: innerWidth }; }); }
  o.readers = await g.ev(async () => { T.press('#storyBox .st-book'); await T.sleep(400); return Object.values(T.underX().pts).flatMap(p => p.hits); });
  o.reading = await g.ev(async () => { T.press('#storyBox .st-reader'); await T.sleep(800); return Object.values(T.underX().pts).flatMap(p => p.hits); });
  await g.shot('g3_story_' + name); await g.ev(() => T.reset());
  console.log(name, JSON.stringify(o), realErrors(g.errors)); await g.close(); } })();
