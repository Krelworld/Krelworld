const L = require('./lib.js');
const mon = () => { const M = window.__tm = { seen: new Map(), log: [], viol: [], offShown: 0, offRun: 0, offRunMax: 0, frames: 0, sticker: [] };
  const t0 = performance.now(); M.t0 = t0;
  const _set = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k === 'cm_stickers') M.sticker.push([Math.round(performance.now() - t0), JSON.parse(v).slice(-1)[0]]); return _set(k, v); };
  const tick = () => { M.frames++; const now = performance.now() - t0, scr = Clarity.screenOpen();
    for (const n of document.querySelectorAll('.stk-toast')) { const vis = n.isConnected && getComputedStyle(n).display !== 'none' && n.getClientRects().length > 0;
      let e = M.seen.get(n); if (!e) { e = { g: n.textContent, first: null, last: null, frames: 0, layer: !!n.closest('.cm-g27-layer') }; M.seen.set(n, e); }
      if (vis) { if (e.first == null) e.first = Math.round(now); e.last = Math.round(now); e.frames++; e.layer = e.layer || !!n.closest('.cm-g27-layer'); } }
    // after this frame has been painted: a toast that is still shown while a screen is up was painted over it
    setTimeout(() => { if (!Clarity.screenOpen()) return; for (const n of document.querySelectorAll('.stk-toast')) if (n.isConnected && getComputedStyle(n).display !== 'none' && n.getClientRects().length) M.viol.push([Math.round(performance.now() - t0), n.textContent]); }, 0);
    const b = document.getElementById('bookBtn'); if (b.classList.contains('off') && +getComputedStyle(b).opacity > 0.05) { M.offRun++; M.offRunMax = Math.max(M.offRunMax, M.offRun); } else M.offRun = 0;
    requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
const report = () => { const M = __tm; const plays = []; for (const [n, e] of M.seen) if (e.first != null) plays.push({ g: e.g, from: e.first, to: e.last, dur: e.last - e.first, layer: e.layer }); plays.sort((a, b) => a.from - b.from);
  return { plays, viol: M.viol.length, violSample: M.viol.slice(0, 3), offRunMaxFrames: M.offRunMax, stickerSaves: M.sticker }; };
const SEED = s => { let a = s >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
(async () => {
  const which = process.argv[2];
  if (which === 'mid') {
    const g = await L.boot({ port: 8898, view: 'port', room: 'kitchen' }); await g.calm(); await g.ev(mon);
    await g.ev(() => { UI.openCook('fridge'); for (const k of ['meal', 'tea', 'bath']) did(k); }); await g.wait(800); await g.ev(() => UI.closePanel());
    await g.page.waitForFunction(() => [...document.querySelectorAll('.stk-toast')].some(n => n.textContent === '🫖' && getComputedStyle(n).display !== 'none'), null, { timeout: 15000 }); await g.wait(900);
    await g.ev(() => UI.openDress()); await g.wait(1500); await g.ev(() => UI.closePanel()); await g.wait(9000);
    const r = await g.ev(report); console.log('mid', JSON.stringify({ viol: r.viol, plays: r.plays.filter(p => /🍝|🫖|🛁/.test(p.g)) }), g.errs()); await g.close();
  }
  if (which === 'titlefade') {
    for (const off of [undefined, 'G27']) { const t = await L.boot({ port: 8898, view: 'port', room: 'kitchen', start: false, off }); await t.ev(mon); await t.ev(() => startGame('kitchen')); await t.wait(5000); const r = await t.ev(report); console.log('titlefade', off || 'on', 'offRunMaxFrames', r.offRunMaxFrames, t.errs()); await t.close(); }
  }
  if (which === 'secret') {
    for (const off of [undefined, 'G27']) {
      const g = await L.H.boot({ port: 8898, view: 'port', room: 'kitchen', start: false, dir: L.DIR }); if (off) await g.ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
      await g.ctx.addInitScript(SEED, 7); await g.page.reload(); await g.page.waitForTimeout(2500); await g.page.evaluate(() => startGame('kitchen')); await g.page.waitForTimeout(4000);
      const r = await g.page.evaluate(async () => { G.busy = false; G.holding = null; marina.state = 'idle'; const T = []; const t0 = performance.now(); const at = s => T.push([s, Math.round(performance.now() - t0)]);
        const _say = window.say; window.say = function (k) { if (k === 'm_found') at('m_found'); return _say.apply(this, arguments); };
        const _set = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k === 'cm_stickers' && /secret/.test(v)) at('saved:secret'); return _set(k, v); };
        const _j = Audio2.jingle; Audio2.jingle = function () { at('jingle'); return _j.apply(this, arguments); };
        new MutationObserver(r => { for (const x of r) for (const n of x.addedNodes) if (n.nodeType === 1 && /✨$/.test(n.textContent || '') && n.style.fontSize === '90px') at('icon'); }).observe(document.getElementById('fx'), { childList: true });
        const p = PROPS.kitchen.find(q => q.id === 'stool3'); marina.x = p.x; at('ring'); UI.actions(p, propActions(p)); await new Promise(r => setTimeout(r, 2200)); return T; });
      console.log('secret', off || 'on', JSON.stringify(r), g.errors.filter(e => !/chip_love/.test(e))); await g.close();
    }
  }
  if (which === 'story') {
    const g = await L.boot({ port: 8898, view: 'port', room: 'living' }); await g.calm(); await g.ev(mon);
    await g.ev(() => { const o = JSON.parse(localStorage.getItem('cm_stickers') || '[]').filter(s => s !== 'story'); localStorage.setItem('cm_stickers', JSON.stringify(o)); });
    await g.ev(() => openStory()); await g.wait(700); await g.tap('.st-book'); await g.wait(500); await g.page.locator('.st-reader').nth(1).click().catch(async () => { await g.tap('.st-reader'); }); 
    await g.page.waitForSelector('.st-end', { timeout: 180000 });
    const atEnd = await g.ev(() => ({ t: Math.round(performance.now() - __tm.t0), saved: __tm.sticker.filter(s => s[1] === 'story'), toastsVisible: [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length }));
    await g.wait(1500); await g.shot(L.OUT + 'shots/g27_story_end.png'); await g.tap('.st-again.go'); await g.wait(4000); const r = await g.ev(report);
    console.log('story', JSON.stringify({ atEnd, plays: r.plays.filter(p => p.g === '📖'), viol: r.viol }), g.errs()); await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
