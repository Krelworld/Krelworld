// G26 checks: when the 📞 bubble shows and when it must not; tap = Daddy's 📞 choice; never over his .say, give bubbles, alerts,
// arrows or the pill; 📒/👗 unaffected. usage: node t_g26.js [off]
const L = require('./lib.js'); const fs = require('fs');
const OFF = process.argv[2] || ''; const tag = OFF ? '_off' : '';
(async () => {
  const R = {};
  for (const view of ['port', 'land']) {
    const g = await L.boot({ view, room: 'kitchen', off: OFF }); await g.calm(); const P = g.page; const V = R[view] = {};
    await P.evaluate(() => { window.__v = []; const _v = Audio2.voice; Audio2.voice = function (k) { __v.push(k); return _v.apply(this, arguments); }; window.__did = []; const _d = window.did; window.did = function (k) { __did.push(k); return _d.apply(this, arguments); }; });
    const settle = () => P.evaluate(async () => { let last = -1; for (let i = 0; i < 40; i++) { await new Promise(q => setTimeout(q, 100)); if (Math.abs(E.camX - last) < 0.05) break; last = E.camX; } });
    const call = () => P.evaluate(() => { const c = document.querySelector('.cm-call'); if (!c) return null; const r = c.getBoundingClientRect(); return { box: [r.left, r.top, r.right, r.bottom].map(Math.round), txt: c.textContent }; });
    const setup = (room, f, extra) => P.evaluate(async ([room, f, extra]) => {
      if (G.room !== room) { travelTo(room); await new Promise(q => setTimeout(q, 1500)); }
      G.busy = false; G.sceneOn = false; UI.closeActions(); G.holding = null; G.tv = null; G.tidy = false; G.chase = null; if (marina.mount) dismount(); marina.state = 'idle'; marina.offY = 0;
      for (const e of [mommy, rory]) { e.room = 'dining'; }
      AI.hold(daddy, true); daddy.stop(); daddy.room = room; daddy.hidden = false; daddy.state = 'idle'; daddy.y = 164; daddy.face = null; daddy.x = E.camX + f * E.viewW;
      G.septic = true; if (extra) eval(extra);
      await new Promise(q => setTimeout(q, 2600));          // past any speech bubble from the setup
    }, [room, f, extra || null]);
    // ---- 1. it shows: Daddy idle in her room, G.septic, nothing going on
    await P.evaluate(() => { marina.stop(); marina.x = 200; }); await settle();
    await setup('kitchen', 0.6); V.shows = await call();
    await g.shot(L.OUT + 'g26' + tag + '_' + view + '_shows.png');
    // not when G.septic is false / Daddy hidden / in the toilet / elsewhere
    await setup('kitchen', 0.6, 'G.septic = false'); V.noSeptic = await call();
    await setup('kitchen', 0.6, 'daddy.hidden = true'); V.hidden = await call();
    await setup('kitchen', 0.6, "daddy.state = 'toilet'"); V.toilet = await call();
    await setup('kitchen', 0.6, "daddy.room = 'dining'"); V.elsewhere = await call();
    // ---- 2. holding a dish / a picture: only the give bubble over Daddy
    await setup('kitchen', 0.6, "G.holding = { type: 'dish', dish: { name: 't', art: 'cake', score: 2, say: [] } }");
    V.dish = { call: await call(), give: await P.evaluate(() => [...document.querySelectorAll('.pichint')].map(n => n.textContent).join('')) };
    await setup('kitchen', 0.6, "(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 15; c.getContext('2d').fillRect(0, 0, 20, 15); G.holding = { type: 'pic', url: c.toDataURL(), ico: '🖼️' }; })()");
    V.pic = { call: await call(), give: await P.evaluate(() => [...document.querySelectorAll('.pichint')].map(n => n.textContent).join('')) };
    // tap the give bubble while G.septic: serves as today
    await setup('kitchen', 0.6, "G.holding = { type: 'dish', dish: { name: 't', art: 'cake', score: 2, say: [] } }");
    await P.evaluate(() => { __v.length = 0; });
    { const c = await P.evaluate(() => { const n = document.querySelector('.pichint.gift'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await P.touchscreen.tap(c[0], c[1]); }
    await P.waitForTimeout(6000); V.dishTap = { lines: await P.evaluate(() => __v.join(' ')), holding: await P.evaluate(() => !!G.holding), septic: await P.evaluate(() => !!G.septic) };
    await P.evaluate(async () => { for (let i = 0; i < 40; i++) { await new Promise(q => setTimeout(q, 250)); if (!G.busy) break; } });
    // ---- 3. a ring open / Daddy talking / a scene, tidy, chase, a shoulder ride, the swing: none
    await setup('kitchen', 0.6); await P.evaluate(() => UI.actions(daddy, entActions(daddy))); await P.waitForTimeout(300); V.ringOpen = await call(); V.ringFirst = await P.evaluate(() => entActions(daddy)[0].ico);
    await P.evaluate(() => UI.closeActions());
    await setup('kitchen', 0.6); await P.evaluate(() => UI.bubble(daddy, '👋', 2000)); await P.waitForTimeout(300); V.daddyTalking = await call(); await P.waitForTimeout(2100); V.afterTalking = await call();
    await setup('kitchen', 0.6, 'G.tidy = true'); V.tidy = await call(); V.tidyRingFirst = await P.evaluate(() => entActions(daddy)[0].ico); await P.evaluate(() => { G.tidy = false; });
    await setup('kitchen', 0.6, 'G.chase = { who: daddy, fleeing: false }'); V.chase = await call(); V.chaseRingFirst = await P.evaluate(() => entActions(daddy)[0].ico); await P.evaluate(() => { G.chase = null; });
    await setup('kitchen', 0.6, 'mount(daddy)'); await P.waitForTimeout(1500); V.ride = await call(); V.rideRingFirst = await P.evaluate(() => [marina.state, entActions(daddy).map(a => a.ico).join('')]); await P.evaluate(() => { if (marina.mount) dismount(); });
    await P.waitForTimeout(1500);
    await setup('yard', 0.5, "(() => { const p = PROPS.yard.find(q => /swing/.test(q.id) || q.a === 'swing'); marina.state = 'swing'; })()"); V.swing = await call(); await P.evaluate(() => { marina.state = 'idle'; });
    // TV in the living room, Daddy on the sofa
    await setup('living', 0.5, "tvOn(showList()[0]); daddy.state = 'sit'"); V.tv = await call(); await g.shot(L.OUT + 'g26' + tag + '_' + view + '_tv.png'); await P.evaluate(() => { try { tvOff(); } catch (e) { } });
    // ---- 4. tap the bubble with Daddy lying down, and on his phone: the same as his ring's 📞
    for (const state of ['lie', 'phone']) for (const how of ['bubble', 'ring']) {
      await setup('living', 0.62, "daddy.state = '" + state + "'"); await P.evaluate(() => { __v.length = 0; __did.length = 0; });
      const before = await call();
      if (how === 'bubble') { if (before) await P.touchscreen.tap((before.box[0] + before.box[2]) / 2, (before.box[1] + before.box[3]) / 2); }
      else { await P.evaluate(() => UI.actions(daddy, entActions(daddy))); await P.waitForTimeout(400); const c = await P.evaluate(() => { const n = [...document.querySelectorAll('.act')].find(b => b.textContent === '📞'); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await P.touchscreen.tap(c[0], c[1]); }
      await P.waitForTimeout(800); const during = await call();
      await P.evaluate(async () => { for (let i = 0; i < 60; i++) { await new Promise(q => setTimeout(q, 250)); if (!G.busy && !G.septic) break; } });
      await P.waitForTimeout(800);
      V['tap_' + state + '_' + how] = { shownBefore: !!before, shownDuring: !!during, lines: await P.evaluate(() => __v.filter(k => /septic|phone/.test(k)).join(' ')), did: await P.evaluate(() => __did.join(' ')), septic: await P.evaluate(() => !!G.septic), daddyState: await P.evaluate(() => daddy.state), after: await call() };
    }
    // ---- 5. never over a .say, an alert, an arrow or the pill: Daddy across the view, alerts on, Mommy talking beside him
    V.sweep = [];
    await P.evaluate(() => { if (G.room !== 'kitchen') travelTo('kitchen'); }); await P.waitForTimeout(1500); await P.evaluate(() => { marina.stop(); marina.x = 200; }); await settle();
    for (let f = 0.0; f <= 1.0001; f += 0.05) for (const talk of [false, true]) {
      const r = await P.evaluate(async ([f, talk]) => {
        G.busy = false; UI.closeActions(); G.holding = null; G.septic = true; miles.room = 'bathroom'; miles.crying = true; miles.cryT = 99; G.poop = true;
        AI.hold(daddy, true); daddy.stop(); daddy.room = G.room; daddy.state = 'idle'; daddy.hidden = false; daddy.y = 160; daddy.x = E.camX + f * E.viewW;
        AI.hold(mommy, true); mommy.stop(); mommy.room = G.room; mommy.state = 'idle'; mommy.hidden = false; mommy.y = 164; mommy.x = daddy.x + 22;
        if (talk) UI.bubble(mommy, '🍳', 3000);
        await new Promise(q => setTimeout(q, 700));
        const c = document.querySelector('.cm-call'); if (!c) return { shown: false };
        const a = c.getBoundingClientRect(), ov = (b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const hits = [...document.querySelectorAll('.say,.pichint,.alertb,.navarrow:not(.off),#floorpill .fl:not(.off),#moodbar .mood,#moodToggle,#mapBtn,#roombar .rb')].filter(n => getComputedStyle(n).display !== 'none' && ov(n.getBoundingClientRect()) > 0).map(n => (n.className + '').split(' ')[0] + (n.id ? '#' + n.id : '') + ':' + Math.round(ov(n.getBoundingClientRect())));
        const st = document.getElementById('stage').getBoundingClientRect();
        return { shown: true, hits, inStage: a.left >= st.left - 0.5 && a.right <= st.right + 0.5 };
      }, [+f.toFixed(2), talk]);
      V.sweep.push({ f: +f.toFixed(2), talk, ...r });
    }
    await P.evaluate(() => { miles.crying = false; G.poop = false; mommy.room = 'dining'; });
    // ---- 6. 📒/👗: the dress-up button still drifts in while the 📞 bubble shows (it ignores .cm-call)
    await setup('kitchen', 0.7); await P.evaluate(() => { marina.stop(); }); await P.waitForTimeout(2500);
    V.dressWithCall = await P.evaluate(() => ({ call: !!document.querySelector('.cm-call'), dressOn: !document.getElementById('dressBtn').classList.contains('off') }));
    // ---- 7. one tap = tellDaddy once; Nunu thanks at the next hello
    await setup('kitchen', 0.6); await P.evaluate(() => { __v.length = 0; __did.length = 0; });
    { const c = await call(); if (c) { await P.touchscreen.tap((c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2); await P.waitForTimeout(150); await P.touchscreen.tap((c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2); } }
    await P.evaluate(async () => { for (let i = 0; i < 60; i++) { await new Promise(q => setTimeout(q, 250)); if (!G.busy && !G.septic) break; } });
    await P.waitForTimeout(800);
    V.once = { lines: await P.evaluate(() => __v.filter(k => /septic/.test(k)).join(' ')), did: await P.evaluate(() => __did.join(' ')), septic: await P.evaluate(() => !!G.septic), told: await P.evaluate(() => !!G.septicTold), callAfter: await call() };
    await P.evaluate(() => { __v.length = 0; travelTo('den'); }); await P.waitForTimeout(6500);
    V.once.nunuHello = await P.evaluate(() => __v.filter(k => /^nu_|m_hi_nunu/.test(k)).join(' '));
    V.errors = L.real(g.errors); await g.close();
  }
  fs.writeFileSync(L.OUT + 't_g26' + tag + '.json', JSON.stringify(R, null, 1));
  for (const [v, V] of Object.entries(R)) {
    const sw = V.sweep; delete V.sweep;
    console.log(v, JSON.stringify(V, null, 0));
    console.log('  sweep: shown', sw.filter(s => s.shown).length, '/', sw.length, 'with hits', sw.filter(s => s.hits && s.hits.length).map(s => s.f + (s.talk ? 't' : '') + ':' + s.hits.join('|')).join(' ; '), 'out of stage', sw.filter(s => s.shown && !s.inStage).length);
  }
})().catch(e => { console.error(e); process.exit(1); });
