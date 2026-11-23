// G25 checks.
const L = require('./lib.js'); const out = {};
const quiet = () => { G.busy = false; G.holding = null; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; miles.poopy = false; G.poop = false; G.needTP = false; G.mess = []; for (const e of [daddy, mommy, rory, niko]) if (e.room === G.room) e.room = 'yard'; };
const IN = { p47: { top: 47, bottom: 34, left: 0, right: 0 }, p59: { top: 59, bottom: 34, left: 0, right: 0 }, l47: { top: 0, bottom: 21, left: 47, right: 47 }, l59: { top: 0, bottom: 21, left: 59, right: 59 } };
// in-page: rect logger (layout box via offsets, and the painted box) for every member, every 100 ms
const startLog = () => { window.__rl = []; const ids = ['stopBtn', 'bookBtn', 'dressBtn', 'wishBtn', 'reqBtn'];
  const home = el => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y, el.offsetWidth, el.offsetHeight]; };
  window.__rlIv = setInterval(() => { const f = {}; for (const id of ids) { const el = document.getElementById(id); if (!el) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.classList.contains('hidden')) continue; const r = el.getBoundingClientRect(); f[id] = { lay: home(el).join(','), bcr: [Math.round(r.left), Math.round(r.top), Math.round(r.width)].join(',') }; } __rl.push(f); }, 100); };
const stopLog = () => { clearInterval(__rlIv); const moved = {}; const seen = {}; let frames = 0;
  for (const f of __rl) { frames++; for (const id in f) { if (!seen[id]) seen[id] = { lay: new Set(), bcr: new Set(), n: 0 }; seen[id].lay.add(f[id].lay); seen[id].bcr.add(f[id].bcr); seen[id].n++; } }
  for (const id in seen) moved[id] = { frames: seen[id].n, layouts: [...seen[id].lay], bcrs: seen[id].bcr.size }; return { frames, moved }; };
const hits = () => { const o = {}; for (const id of ['stopBtn', 'bookBtn', 'dressBtn', 'wishBtn', 'reqBtn']) { const el = document.getElementById(id); if (!el) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || el.classList.contains('hidden')) continue; const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); o[id] = !!t && (t === el || el.contains(t)) ? 'ok' : 'COVERED by ' + (t && (t.id || t.className)); } return o; };
(async () => {
  const which = process.argv[2];
  if (which === 'stable') {
    for (const name of ['port', 'portSmall', '390x664', 'land', 'landSmall', '375x548']) {
      const g = await L.boot({ port: 8894, view: L.viewOf(name), room: 'kitchen' }); await g.calm(); await g.ev(quiet);
      // use up G16's three glides first, so only slot changes would show as movement
      for (let i = 0; i < 3; i++) { await g.ev(quiet); await g.page.waitForFunction(() => !document.getElementById('bookBtn').classList.contains('off'), null, { timeout: 8000 }).catch(() => { }); await g.wait(700); await g.ev(() => { marina.moving = true; }); await g.wait(400); await g.ev(() => { marina.moving = false; }); }
      // (i) request + stand 2 s, walk, stand 2 s
      await g.ev(quiet); await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 90; daddy.state = 'idle'; askRequest('cook'); }); await g.wait(300);
      await g.ev(startLog); await g.wait(2200); await g.ev(() => { marina.walkTo ? marina.walkTo(marina.x + 80) : (marina.moving = true); }); await g.wait(1500); await g.ev(() => { marina.moving = false; marina.state = 'idle'; }); await g.wait(2200);
      const a = await g.ev(stopLog);
      // (ii) dish + wish + hug: ✋ hides during the hug (busy) and comes back
      await g.ev(() => { document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); G.busy = false; marina.state = 'idle'; marina.moving = false; miles.crying = false; miles.cryT = 999; G.holding = { type: 'dish', dish: { art: 'cake', score: 2, say: [], name: 'x', ings: ['eggs'], method: 'bake' } }; }); await g.wait(400);
      await g.ev(() => showWish('cook')); await g.wait(300); await g.ev(startLog); await g.wait(800);
      await g.ev(() => { mommy.room = G.room; mommy.hidden = false; mommy.x = marina.x + 30; mommy.state = 'idle'; const a = entActions(mommy).find(x => x.ico === '🤗'); if (a) { G.__hug = 1; a.fn(); } else { G.busy = true; setTimeout(() => { G.busy = false; }, 1500); } }); await g.wait(3500);
      const b = await g.ev(stopLog); const hugged = await g.ev(() => !!G.__hug);
      out['stable_' + name] = { reqStandWalk: a, dishWishHug: b, hugged, errs: g.errs() }; console.log('stable', name, JSON.stringify(out['stable_' + name]));
      await g.close();
    }
  }
  if (which === 'hits') {
    const views = [['port'], ['port', 'p47'], ['port', 'p59'], ['390x664'], ['390x664', 'p47'], ['390x664', 'p59'], ['portSmall'], ['portSmall', 'p47'], ['portSmall', 'p59'], ['375x548'], ['375x548', 'p47'], ['land'], ['land', 'l47'], ['land', 'l59'], ['landSmall'], ['landSmall', 'l47'], ['landSmall', 'l59'], ['844x340'], ['844x340', 'l59']];
    for (const [name, ins] of views) {
      const g = await L.boot({ port: 8895, view: L.viewOf(name), room: 'kitchen', insets: ins && IN[ins] }); await g.calm(); await g.ev(quiet);
      const r = {};
      // S1: holding TP; ✋'s centre before the wish, then a wish appears
      await g.ev(() => { G.holding = { type: 'tp' }; }); await g.wait(500);
      const c0 = await g.ev(() => { const r = document.getElementById('stopBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await g.ev(() => showWish('cook')); await g.wait(700);
      r.tpWish = await g.ev(hits); r.oldStopCentre = await g.hitAt(c0[0], c0[1]);
      // S3: + a request at the same time
      await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 90; daddy.state = 'idle'; askRequest('story'); }); await g.wait(700);
      r.tpWishReq = await g.ev(hits); r.oldStopCentre2 = await g.hitAt(c0[0], c0[1]);
      await g.shot(L.OUT + 'shots/g25_hits_' + name + (ins || '') + '_tp.png');
      // S2: idle, request + 📒👗
      await g.ev(() => { clearWish(); G.holding = null; marina.state = 'idle'; miles.crying = false; miles.cryT = 999; }); await g.page.waitForFunction(() => !document.getElementById('bookBtn').classList.contains('off'), null, { timeout: 6000 }).catch(() => { }); await g.wait(700);
      r.reqDock = await g.ev(hits); await g.shot(L.OUT + 'shots/g25_hits_' + name + (ins || '') + '_dock.png');
      r.slot = await g.ev(() => { const st = document.getElementById('stage').getBoundingClientRect(), q = document.getElementById('reqBtn'); if (!q) return null; return { mode: Clarity.G25.mode, size: Clarity.G25.size, leftInStage: q.offsetParent === document.getElementById('stage') ? q.offsetLeft : null, w: q.offsetWidth }; });
      out['hits_' + name + (ins || '')] = { ...r, errs: g.errs() }; console.log('hits', name, ins || '', JSON.stringify(out['hits_' + name + (ins || '')]));
      await g.close();
    }
  }
  if (which === 'faces') {
    // layout (a)/(b): face cards, moods, sizes, on many tall-portrait sizes
    for (const [name, ins] of [['port'], ['port', 'p47'], ['port', 'p59'], ['portSmall'], ['portSmall', 'p47'], ['portSmall', 'p59'], ['390x664'], ['390x585'], [{ width: 414, height: 896 }], [{ width: 428, height: 926 }], [{ width: 360, height: 740 }], [{ width: 320, height: 568 }], [{ width: 393, height: 852 }, 'p59']]) {
      const g = await L.boot({ port: 8896, view: L.viewOf(name), room: 'kitchen', insets: ins && IN[ins] }); await g.calm(); await g.ev(quiet);
      const res = [];
      for (const who of ['daddy', 'mommy', 'rory', 'niko']) {
        const k = { daddy: 'story', mommy: 'song', rory: 'joke', niko: 'feedniko' }[who];
        await g.ev(([who, k]) => { const e = { daddy, mommy, rory, niko }[who]; document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); e.room = G.room; e.hidden = false; e.x = marina.x + 90; e.state = who === 'niko' ? 'sit' : 'idle'; askRequest(k); UI.face('marina', 'happy', 4000); UI.face(who, 'happy', 4000); }, [who, k]); await g.wait(500);
        const m = await g.ev(who => { const R = n => { const r = n.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }; const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
          const q = document.getElementById('reqBtn'), qr = R(q), moods = [...document.querySelectorAll('#moodbar .mood')].map(n => { let y = 0; for (let m = n; m; m = m.offsetParent) y += m.offsetTop; return y; }), cards = [...document.querySelectorAll('.facecard.show')];
          const b = q.querySelector('b'); return { who, mode: Clarity.G25.mode, size: Clarity.G25.size, req: qr.map(Math.round), clearOfMoods: Math.round(Math.min(...moods) - qr[3]), ovCards: cards.map(c => c.dataset.who + ':' + Math.round(ov(R(c), qr))).join(' '), badge: b.querySelector('canvas') ? 'face' : b.textContent }; }, who);
        res.push(m); if (who === 'niko' || who === 'daddy') await g.shot(L.OUT + 'shots/g25_face_' + (typeof name === 'string' ? name : name.width + 'x' + name.height) + (ins || '') + '_' + who + '.png');
      }
      // emoji fallback when FACES is missing
      await g.wait(4200);   // let the face cards finish, so nulling the atlas below cannot touch their drawing loop
      const fb = await g.ev(async () => { const img = FACES.img; FACES.img = null; document.getElementById('reqBtn') && document.getElementById('reqBtn').remove(); askRequest('feedniko'); await Promise.resolve(); await Promise.resolve(); const b = document.querySelector('#reqBtn b'); const t = b.querySelector('canvas') ? 'face' : b.textContent; FACES.img = img; return t; });
      const tag = (typeof name === 'string' ? name : name.width + 'x' + name.height) + (ins || '');
      out['faces_' + tag] = { res, fallback: fb, errs: g.errs() }; console.log('faces', tag, JSON.stringify(out['faces_' + tag]));
      await g.close();
    }
  }
  if (which === 'ghost') {
    // the ghost never blocks ✋; the real button is tappable from its first frame; lifetimes 14 s / 25 s
    const g = await L.boot({ port: 8897, view: 'port', room: 'kitchen' }); await g.calm(); await g.ev(quiet);
    await g.ev(() => { G.holding = { type: 'tp' }; }); await g.wait(500);
    const c0 = await g.ev(() => { const r = document.getElementById('stopBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await g.ev(() => { window.__gh = []; const mo = new MutationObserver(() => { const n = document.querySelector('.cm-g25-ghost'); if (n) __gh.push(n.id || '(no id)', n.className); }); mo.observe(document.body, { childList: true }); showWish('cook'); });
    await g.wait(120);
    const mid = await g.ev(c0 => { const n = document.querySelector('.cm-g25-ghost'); const t = document.elementFromPoint(c0[0], c0[1]); const w = document.getElementById('wishBtn').getBoundingClientRect(); const tw = document.elementFromPoint(w.left + w.width / 2, w.top + w.height / 2);
      return { ghost: !!n, ghostId: n ? n.id : null, ghostCls: n ? n.className : null, ghostPE: n ? getComputedStyle(n).pointerEvents : null, atStop: t && (t.id || t.className), atWish: tw && (tw.id || (tw.closest('#wishBtn') ? 'wishBtn' : tw.className)), ids: document.querySelectorAll('#wishBtn').length }; }, c0);
    await g.page.touchscreen.tap(c0[0], c0[1]); await g.wait(300);
    const after = await g.ev(() => ({ holding: G.holding && G.holding.type, ghostLeft: !!document.querySelector('.cm-g25-ghost'), wish: !!document.getElementById('wishBtn') }));
    out.ghost = { mid, after, count: await g.ev(() => Clarity.G25.ghosts) }; console.log('ghost', JSON.stringify(out.ghost));
    // tap the real wish 50 ms after it appears (a ghost is flying): it works at once
    await g.ev(() => { clearWish(); Clarity.G25.ghosts = 0; G.holding = null; }); await g.wait(300);
    await g.ev(() => showWish('dress')); await g.wait(50); const w = await g.ev(() => { const r = document.getElementById('wishBtn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, !!document.querySelector('.cm-g25-ghost')]; });
    await g.page.touchscreen.tap(w[0], w[1]); await g.wait(800); out.wishTapDuringGhost = { ghostFlying: w[2], dressOpen: await g.ev(() => !document.getElementById('panel').classList.contains('hidden')) }; console.log('wishTapDuringGhost', JSON.stringify(out.wishTapDuringGhost));
    await g.ev(() => UI.closePanel()); await g.wait(500); await g.ev(quiet);
    // lifetimes
    await g.ev(() => { window.__t0 = performance.now(); showWish('cook'); const iv = setInterval(() => { if (!document.getElementById('wishBtn')) { window.__wishLife = performance.now() - __t0; clearInterval(iv); } }, 50); });
    await g.ev(() => { daddy.room = G.room; daddy.hidden = false; daddy.x = marina.x + 90; daddy.state = 'idle'; G.busy = false; window.__r0 = performance.now(); askRequest('story'); const iv = setInterval(() => { if (!document.getElementById('reqBtn')) { window.__reqLife = performance.now() - __r0; clearInterval(iv); } }, 50); });
    await g.wait(26500); out.lifetimes = await g.ev(() => ({ wish: Math.round(window.__wishLife), req: Math.round(window.__reqLife) })); console.log('lifetimes', JSON.stringify(out.lifetimes), g.errs());
    await g.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
