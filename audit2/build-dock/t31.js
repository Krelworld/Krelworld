// G31 checks: fort wish 🏰, Niko's request 🐟, draw unchanged, chip unchanged, switch off at run time and at load, stickers unchanged.
const L = require('./lib.js'); const R = {};
const rec = () => { const C = Clarity; C.on.T31 = true; window.__bub = []; C.hook('UI.bubble', 'T31', { after(c) { const e = c.args[0]; __bub.push((e && (e.id || e.name || (e === marina ? 'marina' : e === niko ? 'niko' : '?'))) + ':' + c.args[1]); } }); };
const span = sel => document.querySelector(sel + ' span') && document.querySelector(sel + ' span').textContent;
(async () => {
  let g = await L.boot({ port: 8890, view: 'port', room: 'dining' }); await g.calm(); await g.ev(rec);
  // A. all 11 wishes: only fort changes picture
  R.wishSpans = await g.ev(async span => { const sp = eval(span); const o = {}; for (const k of Object.keys(WISHES)) { clearWish(); showWish(k); await new Promise(r => setTimeout(r, 60)); o[k] = sp('#wishBtn'); } clearWish(); return o; }, String(span));
  // B. fort wish: span, bubble, tap goes to the living room and opens the fort builder
  await g.ev(() => { __bub.length = 0; G.fort = null; showWish('fort'); }); await g.wait(300);
  R.fortWish = { span: await g.ev(eval(`() => (${span})('#wishBtn')`)), bubbles: await g.ev(() => __bub.slice()), sayIcon: await g.ev(() => SAY_ICON.m_want_fort) };
  await g.tap('#wishBtn'); await g.wait(4500);
  R.fortWish.after = await g.ev(() => ({ room: G.room, panel: !document.getElementById('panel').classList.contains('hidden'), ttl: (document.querySelector('#panel .ttl') || {}).textContent, mode: UI.panelMode }));
  await g.ev(() => { try { UI.closePanel(); } catch (e) { } }); await g.wait(400);
  // C. with G.fort set, makeWish never picks fort
  R.fortNeverWithFort = await g.ev(() => { G.fort = { complete: true, room: 'living' }; const picks = {}; for (let i = 0; i < 60; i++) { lastWishKey = null; G.mess = []; makeWish(); picks[lastWishKey] = (picks[lastWishKey] || 0) + 1; clearWish(); } G.fort = null; return { fortOk: (() => { G.fort = {}; const v = WISHES.fort.ok(); G.fort = null; return v; })(), picks }; });
  await g.close();
  // D. Niko's request: 🐟 on span and bubble, goes to the kitchen, Niko eats, request completes
  g = await L.boot({ port: 8890, view: 'port', room: 'dining' }); await g.calm(); await g.ev(rec);
  await g.ev(() => { localStorage.setItem('cm_helped', '0'); niko.room = G.room; niko.hidden = false; niko.x = marina.x + 60; niko.state = 'sit'; niko.here = true; __bub.length = 0; window.__said = []; const _s = say; window.say = function (k, e) { __said.push(k); return _s(k, e); }; askRequest('feedniko'); });
  await g.wait(400);
  R.niko = { span: await g.ev(eval(`() => (${span})('#reqBtn')`)), bubbles: await g.ev(() => __bub.slice()), badge: await g.ev(() => { const b = document.querySelector('#reqBtn b'); return b.querySelector('canvas') ? 'face-canvas' : b.textContent; }) };
  await g.tap('#reqBtn'); await g.wait(9000);
  R.niko.after = await g.ev(() => ({ room: G.room, nikoRoom: niko.room, said: __said.filter(k => /food|niko|thanks/.test(k)), helped: localStorage.getItem('cm_helped'), stickers: JSON.parse(localStorage.getItem('cm_stickers') || '[]').filter(s => /feedniko|helper/.test(s)), reqGone: !document.getElementById('reqBtn') }));
  // E. Mommy's draw request still 🖍️ and opens the studio
  await g.ev(() => { mommy.room = G.room; mommy.hidden = false; mommy.x = marina.x + 50; mommy.state = 'idle'; __bub.length = 0; askRequest('draw'); }); await g.wait(400);
  R.drawReq = { span: await g.ev(eval(`() => (${span})('#reqBtn')`)), bubbles: await g.ev(() => __bub.slice()) };
  await g.tap('#reqBtn'); await g.wait(1200); R.drawReq.studio = await g.ev(() => !!(window.Studio && Studio.active)); await g.ev(() => Studio.close()); await g.wait(500);
  // draw wish
  await g.calm(); await g.ev(() => { __bub.length = 0; showWish('draw'); }); await g.wait(300);
  R.drawWish = { span: await g.ev(eval(`() => (${span})('#wishBtn')`)), bubbles: await g.ev(() => __bub.slice()) };
  await g.tap('#wishBtn'); await g.wait(1200); R.drawWish.studio = await g.ev(() => !!(window.Studio && Studio.active)); await g.ev(() => Studio.close()); await g.wait(500);
  // F. pick up Niko: chip 🐱 with the 🐱🤗 bubble; ✋ drops him
  await g.calm(); await g.ev(() => { niko.room = G.room; niko.hidden = false; niko.x = marina.x + 20; niko.state = 'sit'; __bub.length = 0; pickupNiko(); }); await g.wait(500);
  R.pickup = { chip: await g.ev(() => document.querySelector('#stopBtn .si').textContent), stopShown: await g.ev(() => !document.getElementById('stopBtn').classList.contains('hidden')), bubbles: await g.ev(() => __bub.slice()) };
  await g.tap('#stopBtn'); await g.wait(400); R.pickup.dropped = await g.ev(() => !G.holding && niko.state !== 'held');
  // G. switch off at run time: Clarity.set and by hand
  await g.calm();
  await g.ev(() => Clarity.set('G31', false));
  await g.ev(() => { niko.room = G.room; niko.hidden = false; niko.x = marina.x + 60; niko.state = 'sit'; __bub.length = 0; askRequest('feedniko'); }); await g.wait(300);
  R.offRuntime = { reqSpan: await g.ev(eval(`() => (${span})('#reqBtn')`)), bubbles: await g.ev(() => __bub.slice()) };
  await g.ev(() => { document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); showWish('fort'); }); await g.wait(200);
  R.offRuntime.fortWish = await g.ev(eval(`() => (${span})('#wishBtn')`)); R.offRuntime.sayIcon = await g.ev(() => SAY_ICON.m_want_fort);
  await g.ev(() => { clearWish(); Clarity.set('G31', true); Clarity.on.G31 = false; niko.room = G.room; __bub.length = 0; askRequest('feedniko'); }); await g.wait(300);
  R.offByHand = { reqSpan: await g.ev(eval(`() => (${span})('#reqBtn')`)), bubbles: await g.ev(() => __bub.slice()) };
  await g.ev(() => { Clarity.on.G31 = true; document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); niko.room = G.room; __bub.length = 0; askRequest('feedniko'); }); await g.wait(300);
  R.backOn = { reqSpan: await g.ev(eval(`() => (${span})('#reqBtn')`)), bubbles: await g.ev(() => __bub.slice()) };
  // I. sticker book: earned stickers unchanged
  await g.ev(() => { document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); for (const k of ['fort', 'feedniko', 'draw', 'niko']) award(k); }); await g.wait(500);
  await g.ev(() => openStickers()); await g.wait(400);
  R.book = await g.ev(() => ({ got: [...document.querySelectorAll('#stkBox .stk.got')].map(n => n.textContent).join(''), ids: JSON.parse(localStorage.getItem('cm_stickers')).join(',') }));
  await g.shot(L.OUT + 'shots/g31_book.png');
  R.errs1 = g.errs(); await g.close();
  // H. reload with G31 off
  g = await L.boot({ port: 8890, view: 'port', room: 'dining', off: 'G31' }); await g.calm(); await g.ev(rec);
  await g.ev(() => { showWish('fort'); }); await g.wait(200);
  R.reloadOff = { fortWish: await g.ev(eval(`() => (${span})('#wishBtn')`)), sayIcon: await g.ev(() => SAY_ICON.m_want_fort), wishIco: await g.ev(() => WISHES.fort.ico) };
  await g.ev(() => { clearWish(); niko.room = G.room; niko.hidden = false; niko.x = marina.x + 60; __bub.length = 0; askRequest('feedniko'); }); await g.wait(300);
  R.reloadOff.reqSpan = await g.ev(eval(`() => (${span})('#reqBtn')`)); R.reloadOff.bubbles = await g.ev(() => __bub.slice());
  R.errs2 = g.errs(); await g.close();
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
