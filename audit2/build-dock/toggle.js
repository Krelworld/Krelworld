const L = require('./lib.js');
const snap = () => { const r = s => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width)].join(','); };
  const q = document.getElementById('reqBtn'); return { dress: r('#dressBtn'), book: r('#bookBtn'), req: r('#reqBtn'), badge: q ? (q.querySelector('b canvas') ? 'face' : q.querySelector('b').textContent) : null, span: q ? q.querySelector('span').textContent : null, fortIco: WISHES.fort.ico, sayFort: SAY_ICON.m_want_fort, styles: [...document.querySelectorAll('style[data-clarity]')].filter(s => /G16|G25|G27|G31/.test(s.dataset.clarity)).map(s => s.dataset.clarity + ':' + (s.media || 'on')).join(' ') }; };
(async () => {
  const g = await L.boot({ port: 8895, view: 'port', room: 'kitchen', off: 'G16,G25,G27,G31' }); await g.calm();
  const setup = () => { G.holding = null; marina.state = 'idle'; miles.crying = false; miles.cryT = 999; for (const e of [mommy, rory, daddy]) if (e.room === G.room) e.room = 'yard'; niko.room = G.room; niko.hidden = false; niko.x = marina.x + 90; niko.state = 'sit'; document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); askRequest('feedniko'); };
  await g.ev(setup); await g.wait(2500); const off = await g.ev(snap);
  // a toast while a panel is up: shown today (switch off)
  await g.ev(() => { UI.openCook('fridge'); award('swim'); }); await g.wait(300); const toastOff = await g.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length); await g.ev(() => UI.closePanel()); await g.wait(2500);
  await g.ev(() => { for (const id of ['G16', 'G25', 'G27', 'G31']) Clarity.set(id, true); }); await g.ev(setup); await g.wait(2500); const on = await g.ev(snap);
  await g.ev(() => { UI.openCook('fridge'); award('deer'); }); await g.wait(300); const toastOn = await g.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length); await g.ev(() => UI.closePanel()); await g.wait(1200); const replayed = await g.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').map(n => n.textContent).join(''));
  await g.wait(2000);
  await g.ev(() => { for (const id of ['G16', 'G25', 'G27', 'G31']) Clarity.set(id, false); }); await g.ev(setup); await g.wait(2500); const back = await g.ev(snap);
  console.log(JSON.stringify({ off, toastOff, on, toastOn, replayed, back, sameAsOff: JSON.stringify({ ...off, styles: 0 }) === JSON.stringify({ ...back, styles: 0 }) }, null, 1), g.errs()); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
