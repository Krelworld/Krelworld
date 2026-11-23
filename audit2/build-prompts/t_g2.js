// G2 checks (virtual time), each with G2 on and with my switches off (today).
const L = require('./lib.js'); const fs = require('fs');
const mode = process.argv[2] || 'on';
const off = mode === 'on' ? '' : L.MINE;
async function fresh(room, view = 'port') { const g = await L.boot({ port: 8852, view, room, off, virtual: true, seed: 7 }); await g.virtual(50); await g.run(1500); await g.calm(); await g.inst(); await g.page.addScriptTag({ path: L.OUT + 'inst2.js' }); return g; }
const log = g => g.ev(() => __log);
(async () => {
  const R = {};
  // (a) free play, 6 toys out, Daddy here, last tidy ask just now: the line + 🧹🏃 ring come within about 54 s; 🏃 chases; the chase ends in tidy
  { const g = await fresh('living');
    const t0 = await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); mommy.room = 'kitchen'; G.mess = []; addMess(G.room, 6); G.lastTidyAsk = E.t; return E.t; });
    let ring = null, line = null;
    for (let i = 0; i < 70 && !ring; i++) { await g.run(1000); const s = await g.ev(() => ({ t: E.t, acts: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(''), said: __log.filter(e => e.type === 'voice' && /_tidy$/.test(e.key)).map(e => e.t) }));
      if (!line && s.said.length) line = +(s.said[0] - t0).toFixed(1); if (s.acts === '🧹🏃') ring = +(s.t - t0).toFixed(1); }
    const asks = (await log(g)).filter(e => e.type === 'tidyask').map(e => +(e.at - t0).toFixed(1));
    // press 🏃 (real tap), then wait for the chase and the tidy
    let chase = null, tidy = null;
    if (ring) { await g.ev(() => AI.hold(daddy, false)); await g.tap('#fx .act:nth-of-type(2), #fx .act:last-of-type'); for (let i = 0; i < 40 && !tidy; i++) { await g.run(500); const s = await g.ev(() => ({ chase: !!G.chase, tidy: !!G.tidy })); if (s.chase && chase == null) chase = i * 0.5; if (s.tidy) tidy = i * 0.5; } }
    R.a_tidyFreePlay = { lineAfterS: line, ringAfterS: ring, lastTidyAskWrites: asks, chaseStartedS: chase, tidyAfterChaseS: tidy, errors: L.errs(g) }; await g.close(); }
  // (b) cooking with the mess out: no ask while cooking, G.lastTidyAsk untouched by held-back checks; first ask >= 10 s after closing
  { const g = await fresh('kitchen');
    const t0 = await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); G.mess = []; addMess(G.room, 6); G.lastTidyAsk = E.t - 100; UI.openCook('fridge'); return E.t; });
    await g.run(60000); const mid = await g.ev(() => ({ lta: G.lastTidyAsk, rings: document.querySelectorAll('#fx .act').length, tidyLines: __log.filter(e => e.type === 'voice' && /_tidy$/.test(e.key)).length }));
    const tc = await g.ev(() => { UI.closePanel(); return E.t; });
    let first = null; for (let i = 0; i < 40 && first == null; i++) { await g.run(500); const s = await g.ev(() => __log.filter(e => e.type === 'voice' && /_tidy$/.test(e.key)).map(e => e.t)); const after = s.filter(t => t > tc); if (after.length) first = +(after[0] - tc).toFixed(1); }
    R.b_cookingHold = { duringCooking60s: mid, lastTidyAskUnchanged: mid.lta === t0 - 100, firstAskAfterCloseS: first, errors: L.errs(g) }; await g.close(); }
  // (c) the tidy line starts, cooking opens 0.5 s later: no ring/backdrop behind or after; first tap after closing walks
  { const g = await fresh('kitchen');
    const t0 = await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); G.mess = []; addMess(G.room, 6); G.lastTidyAsk = E.t - 100; return E.t; });
    // wait (100 ms steps) for the game's own check to start the tidy line, then open cooking 0.5 s later
    let asked = false; for (let i = 0; i < 300 && !asked; i++) { await g.run(100); asked = await g.ev(a => G.lastTidyAsk !== a, t0 - 100); }
    const lineT = await g.ev(() => E.t); await g.run(500); await g.ev(() => UI.openCook('fridge'));
    await g.run(6000); const under = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
    await g.ev(() => UI.closePanel()); await g.run(400);
    const after = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length, x: marina.x }));
    const tx = await g.ev(() => clamp(marina.x + 70, 20, ROOMS[G.room].w - 20)); await g.tapWorld(tx, 168); await g.run(600);
    const walked = await g.ev(x0 => ({ moved: Math.abs(marina.x - x0) > 2 || !!marina.moving }), after.x);
    const tc = await g.ev(() => E.t); let next = null; for (let i = 0; i < 120 && next == null; i++) { await g.run(500); const s = await g.ev(c => __log.filter(e => e.type === 'tidyask' && e.at > c).map(e => e.at), tc); if (s.length) next = +(s[0] - tc).toFixed(1); }
    R.c_lineThenCook = { asked, lineAtS: +(lineT - t0).toFixed(1), underPanel: under, afterClose: after, firstTapWalks: walked.moved, nextAskAfterCloseS: next, errors: L.errs(g) }; await g.close(); }
  // (d) a ring opened while a screen is already up (the studio) is never closed; the studio's own give buttons stay
  { const g = await fresh('playroom');
    await g.ev(() => { Studio.open(); }); await g.run(800);
    await g.ev(() => UI.actions(marina, [A('🎁', () => 0), A('🖼️', () => 0)])); await g.run(3000);
    const s = await g.ev(() => ({ ring: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join(''), studio: !!Studio.active, give: document.querySelectorAll('#studio .s-give, .s-give').length }));
    await g.ev(() => { UI.closeActions(); Studio.close && Studio.close(); });
    R.d_ringUnderOpenScreen = { ...s, errors: L.errs(g) }; await g.close(); }
  // (e) the openPanel case: a ring she opened, then a screen opens from code (openPanel removes the buttons, not the backdrop)
  { const g = await fresh('kitchen');
    await g.ev(() => UI.actions(marina, selfActions())); await g.run(300);
    await g.ev(() => UI.openCook('fridge')); await g.run(300);
    const under = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
    await g.ev(() => UI.closePanel()); await g.run(300);
    const x0 = await g.ev(() => marina.x); const tx = await g.ev(() => clamp(marina.x + 70, 20, ROOMS[G.room].w - 20)); await g.tapWorld(tx, 168); await g.run(600);
    const moved = await g.ev(x0 => Math.abs(marina.x - x0) > 2 || !!marina.moving, x0);
    R.e_leftoverBackdrop = { underPanel: under, firstTapAfterCloseWalks: moved, errors: L.errs(g) }; await g.close(); }
  // (f) a ring she opened herself survives opening and closing the map (as today)
  { const g = await fresh('kitchen');
    const r = await g.ev(async () => { const p = PROPS.kitchen.find(q => q.id === 'fridge'); UI.actions({ x: p.x, y: p.y - 60, prop: p }, propActions(p)); return document.querySelectorAll('#fx .act').length; });
    await g.ev(() => openIsoMap()); await g.run(400); const a1 = await g.ev(() => document.querySelectorAll('#fx .act').length);
    await g.ev(() => document.querySelector('#panel .ptop button').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); await g.run(400);
    const a2 = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length, map: !document.getElementById('panel').classList.contains('hidden') }));
    R.f_ownRingSurvivesMap = { before: r, underMap: a1, afterClose: a2, errors: L.errs(g) }; await g.close(); }
  // (g) a 🧹🏃 tidy ring open when a screen opens (the map): closed with its backdrop under G2; today it survives
  { const g = await fresh('kitchen');
    await g.ev(() => UI.actions(marina, [A('🧹', () => startTidy()), A('🏃', () => startChase(daddy))])); await g.run(300);
    await g.ev(() => openIsoMap()); await g.run(400); const a1 = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
    await g.ev(() => document.querySelector('#panel .ptop button').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))); await g.run(400);
    const a2 = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
    // and the tidy ring is never opened while a screen is up
    await g.ev(() => UI.openCook('fridge')); await g.run(200); await g.ev(() => UI.actions(marina, [A('🧹', () => startTidy()), A('🏃', () => startChase(daddy))])); await g.run(300);
    const a3 = await g.ev(() => document.querySelectorAll('#fx .act').length); await g.ev(() => UI.closePanel()); await g.run(300);
    const a4 = await g.ev(() => ({ acts: document.querySelectorAll('#fx .act').length, back: document.querySelectorAll('.actback').length }));
    R.g_tidyRingAndScreens = { underMap: a1, afterMap: a2, tidyRingWhileCooking: a3, afterCooking: a4, errors: L.errs(g) }; await g.close(); }
  // (k) reactMess: first scold and then the 🧹🏃 ring in free play (make a mess twice with Daddy watching)
  { const g = await fresh('playroom');
    await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); G.mess = []; });
    const p = await g.ev(() => { const b = PROPS.playroom.find(q => /toy/.test(q.a || q.id)); return b ? b.id : null; });
    for (let k = 0; k < 3; k++) { await g.ev(id => { UI.closeActions(); makeMess(PROPS.playroom.find(q => q.id === id)); }, p); await g.run(k < 2 ? 6000 : 9000); }
    const s = await g.ev(() => ({ lines: __log.filter(e => e.type === 'voice' && /_mess[12]$/.test(e.key)).map(e => e.key), ring: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join('') }));
    R.k_reactMess = { prop: p, ...s, errors: L.errs(g) }; await g.close(); }
  // (k2) the same, but the TV goes on right after the third tip: the 🧹🏃 step waits under G2 (react.js edit); today it opens over the TV
  { const g = await fresh('living');
    await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; daddy.state = 'idle'; AI.hold(daddy, true); G.mess = []; });
    const p = await g.ev(() => { const b = PROPS.living.find(q => ['toy', 'toybox', 'books', 'basket'].includes(q.a)); return b ? b.id : null; });
    for (let k = 0; k < 3; k++) { await g.ev(id => { UI.closeActions(); makeMess(PROPS.living.find(q => q.id === id)); }, p); if (k < 2) await g.run(6000); }
    await g.run(1000); await g.ev(() => tvOn(showList()[0])); await g.run(9000);
    const s = await g.ev(() => ({ tv: !!G.tv, lines: __log.filter(e => e.type === 'voice' && /_mess[12]$/.test(e.key)).map(e => e.key), ring: [...document.querySelectorAll('#fx .act')].map(n => n.textContent).join('') }));
    await g.ev(() => tvOff());
    R.k2_reactMessDuringTV = { prop: p, ...s, errors: L.errs(g) }; await g.close(); }
  // (j) the 'tidy' wish and Daddy's 🧹 request still come and still start tidying
  { const g = await fresh('playroom');
    await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 60; G.mess = []; addMess(G.room, 4); showWish('tidy'); }); await g.run(500);
    const w = await g.ev(() => !!document.getElementById('wishBtn')); if (w) await g.tap('#wishBtn'); await g.run(800);
    const wt = await g.ev(() => !!G.tidy);
    await g.ev(() => { G.tidy = false; G.mess = []; addMess(G.room, 4); }); await g.run(300);
    const rq = await g.ev(() => { try { askRequest('tidy'); } catch (e) { return 'err ' + e.message; } return !!document.getElementById('reqBtn'); }); await g.run(1500);
    let rt = null; if (await g.ev(() => !!document.getElementById('reqBtn'))) { await g.tap('#reqBtn'); await g.run(3000); rt = await g.ev(() => !!G.tidy); }
    R.j_tidyWishAndRequest = { wishShown: w, wishStartsTidy: wt, requestShown: rq, requestStartsTidy: rt, errors: L.errs(g) }; await g.close(); }
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g2_' + mode + '.json', JSON.stringify(R, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
