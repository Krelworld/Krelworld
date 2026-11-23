const L = require('./lib.js');
(async () => {
  for (const name of (process.argv[2] || 'port,portSmall,390x664,land,landSmall,375x553').split(',')) {
    const g = await L.boot({ port: 8890, view: L.viewOf(name), room: 'kitchen' });
    await g.calm();
    await g.ev(() => { marina.stop && marina.stop(); marina.state = 'idle'; daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 70; daddy.state = 'idle'; });
    await g.wait(2300);
    const a = { dress: await g.rect('#dressBtn'), book: await g.rect('#bookBtn'), hitD: await g.hit('#dressBtn'), hitB: await g.hit('#bookBtn'), glides: await g.ev(() => Clarity.G16.glides) };
    await g.shot(L.OUT + 'shots/smoke_' + name + '_dock.png');
    await g.ev(() => { askRequest('cook'); UI.face('marina', 'happy', 5000); });
    await g.wait(700);
    const b = { req: await g.rect('#reqBtn'), hitR: await g.hit('#reqBtn'), badge: await g.ev(() => { const b = document.querySelector('#reqBtn b'); return b && (b.querySelector('canvas') ? 'canvas' : b.textContent); }), mode: await g.ev(() => Clarity.G25.mode + ' ' + Clarity.G25.size), cards: await g.ev(() => [...document.querySelectorAll('.facecard.show')].map(n => { const r = n.getBoundingClientRect(); return [n.dataset.who, Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; })) };
    await g.shot(L.OUT + 'shots/smoke_' + name + '_req.png');
    console.log(name, JSON.stringify(a), '\n  ', JSON.stringify(b), '\n   errs', g.errs());
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
