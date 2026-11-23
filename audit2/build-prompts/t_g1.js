// G1: the touch listener only looks. Same taps with G1 on and off: same propagation, same defaultPrevented, same outcomes;
// only lastInput differs (it now moves on taps inside screens). Real time.
const L = require('./lib.js'); const fs = require('fs');
const mode = process.argv[2] || 'on'; const off = mode === 'on' ? '' : L.MINE;
(async () => {
  const g = await L.boot({ port: 8858, room: 'living', off }); await g.calm();
  await g.ev(() => { window.__rec = []; for (const t of ['pointerdown', 'pointerup']) window.addEventListener(t, e => __rec.push(t.slice(7) + ':' + ((e.target.id || (e.target.className + '').split(' ')[0] || e.target.tagName) + '').slice(0, 14) + (e.defaultPrevented ? ':PD' : '')), false); });
  const R = {}; const w = ms => g.page.waitForTimeout(ms);
  const rec = async () => { const r = await g.ev(() => { const r = __rec.slice(); __rec.length = 0; return r; }); return r.join(' '); };
  // 1 floor tap: she walks; lastInput moves (both modes)
  { const li0 = await g.ev(() => lastInput); const x0 = await g.ev(() => marina.x); await g.tapWorld(await g.ev(() => E.camX + E.viewW * (marina.x - E.camX > E.viewW / 2 ? 0.25 : 0.75)), 168); await w(800);
    R.floorTap = { walked: await g.ev(x0 => Math.abs(marina.x - x0) > 2, x0), lastInputMoved: await g.ev(l => lastInput > l, li0), events: await rec() }; }
  // 2 cooking: tap an ingredient tile; lastInput moves only with G1
  { await g.ev(() => UI.openCook('fridge')); await w(700); const li0 = await g.ev(() => lastInput); const n0 = await g.ev(() => document.querySelectorAll('#panel .slot.full, #panel .bowl *').length);
    await g.tap('#panel .tile'); await w(700);
    R.cookTile = { lastInputMoved: await g.ev(l => lastInput > l, li0), bowlChanged: (await g.ev(() => document.querySelectorAll('#panel .slot.full, #panel .bowl *').length)) !== n0, events: await rec() };
    await g.ev(() => UI.closePanel()); await w(500); await rec(); }
  // 3 studio: draw a stroke with pointer events on the drawing layer; count changed pixels of the painted layer
  { await g.ev(() => Studio.open()); await w(900);
    await g.ev(() => { const p = document.querySelector('#studio .l-paint'); window.__px0 = p.getContext('2d').getImageData(0, 0, p.width, p.height).data.slice(); });
    await g.ev(() => { const c = document.querySelector('#studio .l-fx'), r = c.getBoundingClientRect();
      const pt = k => ({ clientX: r.left + r.width * (0.3 + 0.4 * k), clientY: r.top + r.height * (0.4 + 0.2 * k), pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true });
      c.dispatchEvent(new PointerEvent('pointerdown', pt(0))); for (let k = 1; k <= 10; k++) c.dispatchEvent(new PointerEvent('pointermove', pt(k / 10))); c.dispatchEvent(new PointerEvent('pointerup', pt(1))); });
    await w(500);
    R.studioStroke = { changedPixels: await g.ev(() => { const p = document.querySelector('#studio .l-paint'), d = p.getContext('2d').getImageData(0, 0, p.width, p.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== __px0[i] || d[i + 3] !== __px0[i + 3]) n++; return n; }), events: await rec() };
    await g.ev(() => Studio.close && Studio.close()); await w(500); await rec(); }
  // 4 story: open, pick the first book (a real tap), go back with ◀; and a 'scroll' gesture (down on a book, up 40 px away) that the guard cancels
  { await g.ev(() => openStory()); await w(800); await g.tap('#storyBox .st-book'); await w(700); const s1 = await g.ev(() => !!document.querySelector('#storyBox .st-reader'));
    await g.tap('#storyBox .st-back'); await w(600); const s2 = await g.ev(() => !!document.querySelector('#storyBox .st-book'));
    const b = await g.page.locator('#storyBox .st-book').first().boundingBox();
    const cdp = await g.ctx.newCDPSession(g.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2 + 40, y: b.y + b.height / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await w(700);
    const s3 = await g.ev(() => ({ shelf: !!document.querySelector('#storyBox .st-book'), readers: !!document.querySelector('#storyBox .st-reader') }));
    R.story = { bookOpensReaders: s1, backToShelf: s2, scrollGestureIgnored: s3.shelf && !s3.readers, events: await rec() };
    await g.tap('#storyBox .st-x'); await w(600); await rec(); }
  // 5 sticker book: tap the first sticker cell; record the animations it starts
  { await g.ev(() => { try { for (const k of ['cook', 'draw', 'tidy', 'minka', 'story', 'tv']) did(k); } catch (e) { } openStickers(); }); await w(900); const sel = await g.ev(() => document.querySelector('#stkBox .stk.got') ? '#stkBox .stk.got' : null);
    let anims = null; if (sel) { await g.tap(sel); await w(150); anims = await g.ev(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#stkBox')).length); }
    R.stickers = { tapped: sel, animationsInBook: anims, events: await rec() };
    await g.ev(() => { const x = document.querySelector('#stkBox .stk-x, #stkBox .st-x, #stkBox button'); }); }
  R.errors = L.errs(g);
  console.log(JSON.stringify(R, null, 1)); fs.writeFileSync(L.OUT + 't_g1_' + mode + '.json', JSON.stringify(R, null, 1)); await g.close();
})().catch(e => { console.error(e); process.exit(1); });
