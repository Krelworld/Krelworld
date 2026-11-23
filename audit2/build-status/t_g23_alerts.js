// G23: alerts pulse for 15 s then rest (same disc, size, picture, tap); a room change wakes them for 4 s; after a screen
// they are rebuilt and pulse again; 🧻🚽 is red with its 🚽 badge, the green shortcuts stay green; the tp flow still works;
// a settled, dimmed alert still shakes on a dead tap (G15); arrows: box constant, only the <i> glyph bobs on arrival;
// arrows still hide while busy / tidy / tantrum.      node t_g23_alerts.js <view> [off]
const L = require('./lib.js'), INSTR = require('./instr.js'), fs = require('fs');
const view = process.argv[2] || 'port', off = process.argv[3] === 'off' ? 'G23' : '';
(async () => {
  const R = {}; const g = await L.boot({ port: 8860, view, room: 'living', off }); await g.calm(); await g.page.evaluate(INSTR);
  const P = g.page, ev = (f, a) => P.evaluate(f, a), wait = ms => P.waitForTimeout(ms), tag = view + ' ' + (off || 'on');
  const al = id => ev(id => { const n = document.querySelector('#alerts .alertb[aria-label=' + id + ']'); if (!n) return null; const cs = getComputedStyle(n), b = n.getBoundingClientRect();
    return { born: n.dataset.born || null, settled: n.classList.contains('settled'), anim: cs.animationName + ':' + (n.getAnimations().map(a => a.playState).join('/') || '-'), w: Math.round(b.width), h: Math.round(b.height), html: n.innerHTML, bg: cs.backgroundColor, shadow: cs.boxShadow, node: n.__tid || (n.__tid = Math.random().toString(36).slice(2, 7)) }; }, id);
  const quietAlerts = () => ev(() => { miles.crying = false; miles.poopy = false; G.poop = false; G.needTP = false; G.holding = null; });
  // 1. nappy alert: pulses, settles after 15 s, same size/picture
  await quietAlerts(); await ev(() => { marina.x = 40; miles.room = 'living'; miles.x = ROOMS.living.w - 40; mommy.holdingMiles = false; miles.poopy = true; }); await wait(1200);
  R.nappy = { at1s: await al('nappy') }; await wait(15200); R.nappy.at16s = await al('nappy');
  R.nappy.sameLook = !!(R.nappy.at1s && R.nappy.at16s && R.nappy.at1s.w === R.nappy.at16s.w && R.nappy.at1s.h === R.nappy.at16s.h && R.nappy.at1s.html === R.nappy.at16s.html && R.nappy.at1s.bg === R.nappy.at16s.bg);
  console.log(tag, 'nappy', JSON.stringify(R.nappy));
  // 2. a room change wakes it for 4 s, then it rests again
  await ev(() => travelTo('kitchen')); await wait(700); R.room = { at07: await al('nappy') }; await wait(2500); R.room.at32 = await al('nappy'); await wait(2200); R.room.at54 = await al('nappy');
  console.log(tag, 'room', JSON.stringify(R.room));
  // 3. after a screen, the rebuilt alert pulses again for 15 s, then settles
  await ev(() => UI.openDress()); await wait(800); R.screen = { during: await al('nappy') }; await ev(() => UI.closePanel()); await wait(900);
  R.screen.after1 = await al('nappy'); await wait(15000); R.screen.after16 = await al('nappy');
  console.log(tag, 'screen', JSON.stringify(R.screen));
  // 4. a settled alert still works with one tap (zips her to Miles and opens his choices)
  const c = await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=nappy]'); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, n.classList.contains('settled')]; });
  if (c) { await P.touchscreen.tap(c[0], c[1]); await wait(1800); R.tapSettled = { wasSettled: c[2], ...(await ev(() => ({ room: G.room, nearMiles: Math.abs(marina.x - miles.x) < 60, ring: [...document.querySelectorAll('.act')].map(n => n.textContent).join('') }))) }; }
  console.log(tag, 'tapSettled', JSON.stringify(R.tapSettled));
  await ev(() => { UI.closeActions(); miles.poopy = false; }); await wait(600);
  // 5. colours: tp red with 🚽, green shortcuts green, pickeep white
  await g.calm(); await ev(() => { daddy.state = 'toilet'; daddy.room = 'bathroom'; daddy.hidden = true; G.bathLocked = true; G.bathWho = daddy; G.needTP = true; G.tpEmpty = true; }); await wait(900);
  R.tp = await al('tp'); R.tp.badge = await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=tp] i'); return n ? n.textContent : null; });
  await g.shot(L.OUT + 'shots/g23_tp_' + view + (off ? '_off' : '') + '.png');
  console.log(tag, 'tp', JSON.stringify(R.tp));
  // the tp flow: zips to the foyer, takes the paper, delivers it
  const tc = await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=tp]'); const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await P.touchscreen.tap(tc[0], tc[1]); let tpDone = null; const t0 = Date.now();
  for (let i = 0; i < 60; i++) { await wait(250); const s = await ev(() => ({ need: G.needTP, locked: G.bathLocked, room: G.room, hold: G.holding && G.holding.type })); if (!s.need && !s.locked) { tpDone = { ms: Date.now() - t0, ...s }; break; } }
  R.tpFlow = tpDone || 'not delivered'; console.log(tag, 'tpFlow', JSON.stringify(R.tpFlow));
  await wait(1500); await g.calm(); await ev(() => travelTo('living')); await wait(2500); await g.calm();
  await ev(() => { G.holding = { type: 'pic', url: 'x.png' }; }); await wait(700); R.green = { picgive: await al('picgive'), pickeep: await al('pickeep') };
  await ev(() => { G.holding = { type: 'poop', ico: '💩' }; }); await wait(700); R.green.pbin = await al('pbin'); R.green.pflush = await al('pflush');
  // 'down' needs a ride; check its colour on a stand-in disc with the same class and label (CSS only)
  R.green.down = await ev(() => { const n = document.createElement('button'); n.className = 'alertb'; n.setAttribute('aria-label', 'down'); document.getElementById('alerts').append(n); const cs = getComputedStyle(n), r = cs.backgroundColor + ' | ' + cs.boxShadow; n.remove(); return r; });
  for (const k of ['picgive', 'pickeep', 'pbin', 'pflush']) if (R.green[k]) R.green[k] = R.green[k].bg + ' | ' + R.green[k].shadow;
  console.log(tag, 'green', JSON.stringify(R.green));
  await ev(() => { G.holding = null; }); await wait(500);
  // 6. G15 x G23: a settled, dimmed alert still shakes on a dead tap
  await g.calm(); await ev(() => { for (const e of [daddy, mommy]) { e.room = G.room; e.hidden = false; e.state = 'idle'; e.x = clamp(marina.x + (e === daddy ? 44 : -44), 20, ROOMS[G.room].w - 20); e.y = marina.y; AI.hold(e, true); } G.holding = { type: 'pic', url: 'x.png' }; if (innerWidth > innerHeight) document.getElementById('moodbar').classList.remove('collapsed'); });
  await wait(700); const mc = await ev(() => { const b = document.querySelector('.mood[data-mood=love]').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await P.touchscreen.tap(mc[0], mc[1]); await wait(300);
  await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=picgive]'); if (n) n.dataset.born = String(performance.now() - 20000); }); await wait(700);
  const sc = await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=picgive]'); if (!n) return null; const b = n.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, n.classList.contains('settled'), getComputedStyle(n).opacity, !!G.sceneOn]; });
  if (sc && sc[4]) { await P.touchscreen.tap(sc[0], sc[1]); await wait(50); R.settledShake = { settled: sc[2], opacity: sc[3], mid: await ev(() => { const n = document.querySelector('#alerts .alertb[aria-label=picgive]'); const cs = getComputedStyle(n); return { anim: cs.animationName, translate: cs.translate, waapi: n.getAnimations().filter(a => !a.animationName).length }; }) }; }
  else R.settledShake = 'no scene / alert: ' + JSON.stringify(sc);
  console.log(tag, 'settledShake', JSON.stringify(R.settledShake));
  for (let i = 0; i < 120 && await ev(() => G.busy || G.sceneOn); i++) await wait(250);
  await ev(() => { G.holding = null; }); await wait(400);
  // 7. arrows: on arrival only the glyph bobs; the button box never moves
  await g.calm(); await ev(() => { window.__AR = []; }); await ev(() => travelTo('kitchen'));
  const t1 = Date.now(); let shot = false;
  while (Date.now() - t1 < 3000) { R.arrSample = await ev(() => { const a = [...document.querySelectorAll('.navarrow')].map(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b), i = b.querySelector('i'); return { side: b.classList.contains('l') ? 'l' : 'r', off: b.classList.contains('off'), arrive: b.classList.contains('cm-arrive'), rect: [r.left, r.top, r.width, r.height].map(Math.round).join(','), anim: cs.animationName, iT: getComputedStyle(i).transform }; }); __AR.push({ t: performance.now(), a, room: G.room }); return a; });
    if (!shot && Date.now() - t1 > 900) { await g.shot(L.OUT + 'shots/g23_arrive_' + view + (off ? '_off' : '') + '.png'); shot = true; } await wait(60); }
  R.arrows = await ev(() => { const by = s => __AR.filter(x => x.room === 'kitchen').map(x => x.a.find(a => a.side === s)).filter(Boolean);
    return ['l', 'r'].map(s => { const l = by(s); return { side: s, samples: l.length, rects: [...new Set(l.map(a => a.rect))], anims: [...new Set(l.map(a => a.anim))], arriveSeen: l.filter(a => a.arrive).length, iMoves: [...new Set(l.filter(a => a.arrive).map(a => a.iT))].length, iNoneAfter: l.length ? l[l.length - 1].iT : null, arriveAtEnd: l.length ? l[l.length - 1].arrive : null }; }); });
  console.log(tag, 'arrows', JSON.stringify(R.arrows));
  // arrows still hide while busy, tidy and tantrum
  const hideWhen = async (set, unset) => { await ev(set); await wait(450); const r = await ev(() => [...document.querySelectorAll('.navarrow')].map(b => b.classList.contains('off') + ':' + getComputedStyle(b).opacity).join(' ')); await ev(unset); await wait(450); return r; };
  R.hide = { busy: await hideWhen(() => { G.busy = true; }, () => { G.busy = false; }), tidy: await hideWhen(() => { G.tidy = true; }, () => { G.tidy = false; }), tantrum: await hideWhen(() => { marina.state = 'tantrum'; }, () => { marina.state = 'idle'; }), idle: await ev(() => [...document.querySelectorAll('.navarrow')].map(b => b.classList.contains('off') + ':' + getComputedStyle(b).opacity + ':' + getComputedStyle(b).animationName).join(' ')) };
  console.log(tag, 'hide', JSON.stringify(R.hide));
  R.errors = g.errors.filter(e => !/chip_love/.test(e)); console.log(tag, 'errors', JSON.stringify(R.errors));
  fs.writeFileSync(L.OUT + 'g23_alerts_' + view + (off ? '_off' : '') + '.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
