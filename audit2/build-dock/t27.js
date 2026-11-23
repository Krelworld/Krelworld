// G27 checks: toasts wait for screens, replay one after another once each, fly to 📒, never over a screen; treasures wait.
const L = require('./lib.js'); const out = {};
const SEED = s => { let a = s >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const quiet = () => { G.busy = false; G.holding = null; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.needTP = false; G.mess = []; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; };
// in-page monitor: every frame, every toast's visibility; violations = a toast visible while a screen is up; 📒 shown while .off
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
(async () => {
  const which = process.argv[2];
  if (which === 'queue') {
    const g = await L.boot({ port: 8898, view: 'port', room: 'kitchen' }); await g.calm(); await g.ev(quiet); await g.ev(mon);
    // A. cook + gross + serve in one cooking session
    await g.ev(() => { UI.openCook('fridge'); }); await g.wait(500);
    const saved = await g.ev(async () => { const o = []; for (const k of ['cook', 'gross', 'serve']) { did(k); o.push(k + ':' + JSON.parse(localStorage.getItem('cm_stickers')).includes(k) + '@' + Math.round(performance.now() - __tm.t0)); await new Promise(r => setTimeout(r, 400)); } return o; });
    await g.wait(1200); const during = await g.ev(report); await g.shot(L.OUT + 'shots/g27_inpanel.png');
    await g.ev(() => UI.closePanel()); await g.wait(1300); await g.shot(L.OUT + 'shots/g27_replay1.png'); await g.wait(8000);
    out.A = { saved, duringPanel: during.plays.length, ...await g.ev(report) }; console.log('A', JSON.stringify(out.A));
    // B. a screen opens during a replay: hidden, then replayed once
    await g.ev(() => { UI.openCook('fridge'); for (const k of ['meal', 'tea', 'bath']) did(k); }); await g.wait(800); await g.ev(() => UI.closePanel());
    await g.wait(400 + 2300 + 900); await g.ev(() => UI.openDress()); await g.wait(1500); const midDress = await g.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length);
    await g.ev(() => UI.closePanel()); await g.wait(8500);
    const rB = await g.ev(report); out.B = { visibleWhileDress: midDress, viol: rB.viol, plays: rB.plays.filter(p => /🍝|🫖|🛁/.test(p.g)) }; console.log('B', JSON.stringify(out.B));
    // C. every screen type: studio, story, sticker book, Lego shelf, films; nothing over them, each replayed after
    const screens = [['studio', () => Studio.open(), () => Studio.close(), 'hang'], ['story', () => openStory(), () => { const b = document.getElementById('storyBox'); b && b.remove(); }, 'story'], ['stkBox', () => openStickers(), () => { const b = document.getElementById('stkBox'); b && b.remove(); }, 'gift'],
      ['legoshelf', () => LegoShelf.open(), () => LegoShelf.close(), 'legoshelf'], ['movies', () => Movies.open({}), () => Movies.close(), 'movie'], ['map', () => openIsoMap(), () => UI.closePanel(), 'dress']];
    out.C = {};
    for (const [name, open, close, id] of screens) {
      await g.ev(quiet); await g.ev(new Function('return (' + open.toString() + ')()')); await g.wait(800);
      const r1 = await g.ev(id => { const t = performance.now(); did(id); return { saved: JSON.parse(localStorage.getItem('cm_stickers')).includes(id), screen: Clarity.screenOpen() }; }, id);
      await g.wait(1500); const vis = await g.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length);
      await g.ev(new Function('return (' + close.toString() + ')()')); await g.wait(400); const closed = await g.ev(() => !Clarity.screenOpen()); await g.wait(3000);
      const rr = await g.ev(report); out.C[name] = { ...r1, visibleOverScreen: vis, closed, replayed: rr.plays.filter(p => p.g === { hang: '🖼️', story: '📖', gift: '🎁', legoshelf: '🗄️', movie: '🎬', dress: '👗' }[id]).length, viol: rr.viol }; console.log('C', name, JSON.stringify(out.C[name]));
    }
    out.errs = g.errs(); console.log('errs', out.errs); await g.close();
    // D. the title: a sticker earned on the title waits for the game to start
    const t = await L.boot({ port: 8898, view: 'port', room: 'kitchen', start: false }); await t.ev(mon);
    await t.ev(() => award('swim')); await t.wait(1200); const onTitle = await t.ev(() => [...document.querySelectorAll('.stk-toast')].filter(n => getComputedStyle(n).display !== 'none').length);
    await t.ev(() => startGame('kitchen')); await t.wait(5000); out.D = { onTitle, ...await t.ev(report), errs: t.errs() }; console.log('D', JSON.stringify(out.D)); await t.close();
  }
  if (which === 'flight') {
    for (const [name, off] of [['port'], ['portSmall'], ['land'], ['landSmall'], ['375x553'], ['390x664'], ['port', 'G16']]) {
      const g = await L.boot({ port: 8899, view: L.viewOf(name), room: 'kitchen', off }); await g.calm(); await g.ev(quiet); await g.ev(mon);
      const res = {};
      for (const state of ['shown', 'off']) {
        if (state === 'shown') { await g.page.waitForFunction(() => !document.getElementById('bookBtn').classList.contains('off'), null, { timeout: 8000 }).catch(() => { }); await g.wait(900); }
        else { await g.ev(() => { marina.moving = true; }); await g.wait(500); }
        const id = state === 'shown' ? 'swim' : 'deer';
        await g.ev(id => { window.__ani = []; const b = document.getElementById('bookBtn'); const mo = new MutationObserver(() => { }); window.__spark = 0; new MutationObserver(r => { for (const x of r) for (const n of x.addedNodes) if (n.classList && n.classList.contains('cm-g27-spark')) __spark++; }).observe(document.body, { childList: true, subtree: true }); award(id); }, id);
        await g.wait(1700); await g.shot(L.OUT + 'shots/g27_flight_' + name + (off ? '_noG16' : '') + '_' + state + '_a.png');
        await g.wait(420); await g.shot(L.OUT + 'shots/g27_flight_' + name + (off ? '_noG16' : '') + '_' + state + '_b.png');
        const m = await g.ev(() => { const t = [...document.querySelectorAll('.stk-toast')].pop(), b = document.getElementById('bookBtn'); if (!t) return null; const s = t.querySelector('span').getBoundingClientRect(), r = b.getBoundingClientRect();
          return { dist: Math.round(Math.hypot(s.left + s.width / 2 - (r.left + r.width / 2), s.top + s.height / 2 - (r.top + r.height / 2))), toastSize: Math.round(s.width), inLayer: !!t.closest('.cm-g27-layer'), op: getComputedStyle(t).opacity }; });
        await g.wait(300);
        const after = await g.ev(() => ({ bookAnims: document.getElementById('bookBtn').getAnimations().map(a => a.effect && a.effect.getKeyframes().map(k => k.translate || k.opacity).join('/')).join(' ; '), spark: window.__spark, bookOff: document.getElementById('bookBtn').classList.contains('off') }));
        res[state] = { at2120ms: m, after };
        if (state === 'shown') { await g.wait(400); const r = await g.ev(() => { const b = document.getElementById('bookBtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); await g.page.touchscreen.tap(r[0], r[1]); await g.wait(500); res.tapAfterWiggle = await g.ev(() => !!document.getElementById('stkBox')); await g.ev(() => { const b = document.getElementById('stkBox'); b && b.remove(); }); await g.wait(300); await g.ev(quiet); }
      }
      out['flight_' + name + (off || '')] = { ...res, viol: (await g.ev(report)).viol, offRunMaxFrames: (await g.ev(report)).offRunMaxFrames, errs: g.errs() }; console.log('flight', name, off || '', JSON.stringify(out['flight_' + name + (off || '')]));
      await g.close();
    }
  }
  if (which === 'offtap') {
    // a tap at 📒's home while .off behaves as today (G27 on vs off)
    for (const name of ['port', 'land']) for (const off of [undefined, 'G27']) {
      const g = await L.boot({ port: 8899, view: L.viewOf(name), room: 'kitchen', off }); await g.calm(); await g.ev(quiet); await g.ev(() => { G.holding = { type: 'tp' }; marina.x = 80; }); await g.wait(600);
      await g.ev(() => award('cook')); await g.wait(2100);
      const r = await g.ev(() => { const b = document.getElementById('bookBtn').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, document.getElementById('bookBtn').classList.contains('off')]; });
      await g.page.touchscreen.tap(r[0], r[1]); await g.wait(900);
      const s = await g.ev(() => ({ stk: !!document.getElementById('stkBox'), panel: !document.getElementById('panel').classList.contains('hidden'), moving: !!marina.moving, tx: marina.tx != null ? Math.round(marina.tx) : null, x: Math.round(marina.x), acts: document.querySelectorAll('.act').length }));
      console.log('offtap', name, off || 'on', JSON.stringify({ bookOff: r[2], ...s })); await g.close();
    }
  }
  if (which === 'treasure') {
    // real treasures (seed 7: kitchen/stool3, living/armchair, dining/cattower)
    for (const [mode, off] of [['ringOpen'], ['ringOpen', 'G27'], ['closeAt600'], ['studio']]) {
      const g = await L.H.boot({ port: 8899, view: 'port', room: 'kitchen', start: false, dir: L.DIR });
      if (off) await g.ctx.addInitScript(v => { window.CLARITY_OFF = v; }, off);
      await g.ctx.addInitScript(SEED, 7); await g.page.reload(); await g.page.waitForTimeout(2500);
      const room = mode === 'studio' ? 'dining' : 'kitchen', pid = mode === 'studio' ? 'table' : 'stool3';
      await g.page.evaluate(r => startGame(r), room); await g.page.waitForTimeout(4000); await g.page.evaluate(quiet);
      const tr = await g.page.evaluate(async ([mode, room, pid]) => {
        const T = []; const t0 = performance.now(); const at = s => T.push([s, Math.round(performance.now() - t0)]);
        const _say = window.say; window.say = function (k, e) { if (k === 'm_found') at('m_found'); return _say.apply(this, arguments); };
        const _did = window.did; window.did = function (k) { if (k === 'secret') at('did:secret'); return _did.apply(this, arguments); };
        new MutationObserver(r => { for (const x of r) for (const n of x.addedNodes) if (n.nodeType === 1 && /✨$/.test(n.textContent || '') && n.style && n.style.fontSize === '90px') at('icon:' + n.textContent + ':acts=' + document.querySelectorAll('.act').length + ':screen=' + Clarity.screenOpen()); }).observe(document.getElementById('fx'), { childList: true });
        const p = PROPS[room].find(q => q.id === pid); marina.x = p.x; G.busy = false;
        at('ring'); UI.actions(p, propActions(p));
        if (mode === 'studio') {
          // the dining table has no treasure with this seed: emulate the treasure's own call 150 ms after its ring opened
          await new Promise(r => setTimeout(r, 150)); at('bigIcon called'); UI.bigIcon('💎✨', 1300);
          await new Promise(r => setTimeout(r, 300)); const b = [...document.querySelectorAll('#fx .act')].find(n => n.textContent === '🎨'); at('tap 🎨'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          await new Promise(r => setTimeout(r, 2500)); at('studio=' + !!(window.Studio && Studio.active)); Studio.close(); at('closed');
          await new Promise(r => setTimeout(r, 1500));
        } else if (mode === 'closeAt600') { await new Promise(r => setTimeout(r, 600)); at('close'); UI.closeActions(); await new Promise(r => setTimeout(r, 1800)); }
        else await new Promise(r => setTimeout(r, 2400));
        return T;
      }, [mode, room, pid]);
      out['treasure_' + mode + (off || '')] = { log: tr, errs: g.errors.filter(e => !/chip_love/.test(e)) }; console.log('treasure', mode, off || 'on', JSON.stringify(out['treasure_' + mode + (off || '')]));
      await g.close();
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
