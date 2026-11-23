// G25 must-still-work: face cards still zip her to the person; requests still go away under screens and busy moments;
// 📒/👗 stay visible and tappable while a request shows; ✋ still stops while a prompt shows.
const L = require('./lib.js');
(async () => {
  for (const name of ['port', 'land']) {
    const g = await L.boot({ port: 8892, view: L.viewOf(name), room: 'kitchen' }); await g.calm();
    const quiet = () => { G.busy = false; G.holding = null; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.needTP = false; G.mess = []; };
    await g.ev(quiet); const r = {};
    // face card zip: Daddy in the dining room talks; tap his card
    await g.ev(() => { daddy.room = 'dining'; daddy.hidden = false; daddy.state = 'idle'; daddy.x = 200; UI.face('daddy', 'happy', 6000); }); await g.wait(400);
    await g.tap('.facecard.show[data-who=daddy]'); await g.wait(2500); r.zip = await g.ev(() => G.room + ' dx=' + Math.round(Math.abs(marina.x - daddy.x)));
    // a request with 📒/👗: they come back and are tappable
    await g.ev(() => { travelTo('kitchen'); }); await g.wait(1200); await g.ev(quiet);
    await g.ev(() => { for (const e of [mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 120; daddy.state = 'idle'; askRequest('cook'); }); await g.wait(500);
    const t0 = Date.now(); let back = false; while (Date.now() - t0 < 6000) { if (await g.ev(() => !document.getElementById('dressBtn').classList.contains('off'))) { back = true; break; } await g.wait(150); }
    await g.wait(800); r.dockWithReq = { back, hits: await g.ev(() => ['dressBtn', 'bookBtn', 'reqBtn'].map(id => { const n = document.getElementById(id); const b = n.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return id + ':' + (t === n || n.contains(t)); }).join(' ')), why: await g.ev(() => ({ acts: !!document.querySelector('.act'), alert: !!document.querySelector('.alertb'), pichint: !!document.querySelector('.pichint'), moving: !!marina.moving, st: marina.state })) };
    if (back) { await g.tap('#bookBtn'); await g.wait(500); r.dockWithReq.bookTap = await g.ev(() => !!document.getElementById('stkBox')); await g.ev(() => { const b = document.getElementById('stkBox'); b && b.remove(); }); }
    await g.shot(L.OUT + 'shots/g25_reqdock_' + name + '.png');
    // a screen removes the request (featTick, every 2 s), as today
    await g.ev(() => { document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); askRequest('cook'); UI.openCook('fridge'); }); await g.wait(2600); r.removedUnderPanel = await g.ev(() => !document.getElementById('reqBtn')); await g.ev(() => UI.closePanel()); await g.wait(300);
    await g.ev(() => { askRequest('cook'); G.busy = true; }); await g.wait(2600); r.removedWhenBusy = await g.ev(() => !document.getElementById('reqBtn')); await g.ev(() => { G.busy = false; });
    // ✋ still stops while a wish shows (holding a dish): the dish is put down, the wish stays
    await g.ev(() => { G.holding = { type: 'dish', dish: { art: 'cake', score: 2, say: [], name: 'x', ings: ['eggs'], method: 'bake' } }; showWish('cook'); }); await g.wait(500);
    await g.tap('#stopBtn'); await g.wait(300); r.stopWithWish = await g.ev(() => ({ holding: G.holding, wish: !!document.getElementById('wishBtn') }));
    // the wish's own tap still runs go()
    await g.tap('#wishBtn'); await g.wait(3500); r.wishGo = await g.ev(() => G.room + ' panel=' + !document.getElementById('panel').classList.contains('hidden'));
    console.log(name, JSON.stringify(r), g.errs()); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
