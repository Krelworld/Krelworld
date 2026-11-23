// G16 checks: dock spots, taps, guard, glide, coverage, rotation, landscape/title unchanged.
const L = require('./lib.js'); const out = {};
const NOTCH = { top: 59, bottom: 34, left: 0, right: 0 };
async function idle(g, ms = 4000, settle = 650) { await g.calm(); await g.ev(() => { G.holding = null; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.needTP = false; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; }); 
  const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await g.ev(() => !document.getElementById('dressBtn').classList.contains('off') && !document.getElementById('bookBtn').classList.contains('off'))) { await g.wait(settle); return true; } await g.wait(100); } return false; }
const geo = () => { const R = s => { const n = typeof s === 'string' ? document.querySelector(s) : s; if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const ov = (a, b) => a && b ? Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])) : 0;
  const moods = [...document.querySelectorAll('#moodbar .mood')].map(R), cards = [...document.querySelectorAll('.facecard.show')].map(R), d = R('#dressBtn'), b = R('#bookBtn');
  const hit = s => { const n = document.querySelector(s), r = n.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t ? (t.id || t.className) : null; };
  return { dress: d, book: b, stop: R('#stopBtn'), req: R('#reqBtn'), wish: R('#wishBtn'), moodTop: Math.min(...moods.map(m => m[1])), gapAboveMoods: Math.min(...moods.map(m => m[1])) - Math.max(d[3], b[3]),
    ovCards: cards.reduce((s, c) => s + ov(c, d) + ov(c, b), 0), nCards: cards.length, ovMoods: moods.reduce((s, m) => s + ov(m, d) + ov(m, b), 0), ovReqDress: ov(R('#reqBtn'), d) + ov(R('#reqBtn'), b), ovWish: ov(R('#wishBtn'), d) + ov(R('#wishBtn'), b),
    hitD: hit('#dressBtn'), hitB: hit('#bookBtn'), tall: matchMedia('(orientation:portrait) and (min-height:150vw)').matches }; };
(async () => {
  // 1-3, 9, 10, 12: positions, coverage, taps in tall-portrait sizes (with and without G25)
  const SETS = { a: [['port'], ['portSmall'], ['390x664'], ['390x585'], ['port', NOTCH]], b: [['port', null, 'G25'], ['portSmall', null, 'G25'], ['390x664', null, 'G25'], ['port', NOTCH, 'G25'], ['390x585', null, 'G25']] };
  for (const [name, ins, off] of SETS[process.argv[2] || 'a']) {
    const tag = name + (ins ? '_notch' : '') + (off ? '_noG25' : '');
    const g = await L.boot({ port: 8890, view: L.viewOf(name), room: 'kitchen', insets: ins, off });
    const shown = await idle(g);
    await g.ev(() => { UI.face('marina', 'happy', 9000); daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 90; daddy.state = 'idle'; UI.face('daddy', 'happy', 9000); }); await g.wait(500);
    const a = await g.ev(geo);
    await g.ev(() => askRequest('cook')); await g.wait(800);   // request does not hide 👗 (nav.js:92)
    const withReq = await g.ev(geo); await g.shot(L.OUT + 'shots/g16_' + tag + '_req.png');
    // 3 frames while the request pulses: worst overlap
    let pulseOv = 0; for (let i = 0; i < 6; i++) { pulseOv = Math.max(pulseOv, (await g.ev(geo)).ovReqDress); await g.wait(110); }
    // one touchscreen tap on 👗 opens dress-up; on 📒 opens the sticker book
    await g.ev(() => { document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); }); await idle(g);
    await g.tap('#dressBtn'); await g.wait(700); const dressOpened = await g.ev(() => !document.getElementById('panel').classList.contains('hidden') && !!document.querySelector('#panel .dgrid, #panel .dprev'));
    await g.ev(() => UI.closePanel()); await g.wait(400); await idle(g);
    await g.tap('#bookBtn'); await g.wait(500); const bookOpened = await g.ev(() => !!document.getElementById('stkBox'));
    await g.ev(() => document.getElementById('stkBox') && document.getElementById('stkBox').remove()); await g.wait(300);
    // they still hide while a wish shows
    await idle(g); await g.ev(() => showWish('cook')); await g.wait(600); const hideOnWish = await g.ev(() => document.getElementById('dressBtn').classList.contains('off') && document.getElementById('bookBtn').classList.contains('off'));
    await g.shot(L.OUT + 'shots/g16_' + tag + '_wish.png'); await g.ev(() => clearWish());
    // ✋ still shows in its slot while an activity runs (sit)
    await g.calm(); await g.ev(() => { marina.state = 'sit'; }); await g.wait(500); const stop = await g.ev(() => { const s = document.getElementById('stopBtn'); const r = s.getBoundingClientRect(); return { shown: !s.classList.contains('hidden'), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width)], dressVis: getComputedStyle(document.getElementById('dressBtn')).visibility }; });
    out[tag] = { glides: await g.ev(() => JSON.stringify(Clarity.G16 && Clarity.G16.glides)), shown, a, withReq: { req: withReq.req, ovReqDress: withReq.ovReqDress, pulseOv, dressOff: await g.ev(() => document.getElementById('dressBtn').classList.contains('off')) }, dressOpened, bookOpened, hideOnWish, stop, errs: g.errs() };
    console.log(tag, JSON.stringify(out[tag]));
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
