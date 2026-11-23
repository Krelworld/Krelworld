// in-page test helpers for the screens worker (installed with page.evaluate(TLIB))
module.exports.TLIB = () => {
  const T = window.T = {};
  T.sleep = ms => new Promise(r => setTimeout(r, ms));
  T.press = (el, x, y) => { if (typeof el === 'string') el = document.querySelector(el); if (!el) return false; const r = el.getBoundingClientRect(); const cx = x == null ? r.left + r.width / 2 : x, cy = y == null ? r.top + r.height / 2 : y;
    for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, clientX: cx, clientY: cy, isPrimary: true })); return true; };
  T.nm = n => n ? (n.id ? '#' + n.id : n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).join('.') : '')) : null;
  T.ACT = 'button,[role=button],.tile,.slot,canvas,.stk.got,.st-book,.st-reader,.isoroom,.fmaproom,.bd-card,.tr,a[href],input,select,.ls-pend,.bk-partner';
  // what lies under #xFloat: at its centre and its four corners (2 px in), every interactive thing in the stack other than #xFloat
  T.underX = () => {
    const x = document.getElementById('xFloat'), cs = getComputedStyle(x); if (cs.display === 'none') return { shown: false };
    const r = x.getBoundingClientRect(), pts = { c: [r.left + r.width / 2, r.top + r.height / 2], tl: [r.left + 2, r.top + 2], tr: [r.right - 2, r.top + 2], bl: [r.left + 2, r.bottom - 2], br: [r.right - 2, r.bottom - 2] }, out = {};
    // only what is on top of the screen's own (opaque) root counts: #cv etc. further down the stack are covered by the screen
    const ROOT = n => ['panel', 'stkBox', 'storyBox', 'studio', 'title'].includes(n.id);
    for (const k in pts) { const all = document.elementsFromPoint(pts[k][0], pts[k][1]); const top = all[0]; const ri = all.findIndex(ROOT); const st = ri < 0 ? all : all.slice(0, ri + 1);
      const hits = st.filter(n => n !== x && !n.contains(x)).map(n => n.closest && n.closest(T.ACT)).filter(Boolean);
      out[k] = { top: T.nm(top), hits: [...new Set(hits)].map(T.nm) }; }
    return { shown: true, text: x.textContent, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], pts: out };
  };
  T.reset = async () => {
    document.querySelectorAll('#stkBox').forEach(n => n.remove());
    const sx = document.querySelector('#storyBox .st-x'); if (sx) T.press(sx);
    try { if (window.Studio && Studio.active) Studio.close(); } catch (e) { }
    try { if (G.fort && G.fort.inside) closeFortInside(true); } catch (e) { }
    for (const k of ['Bricks', 'LegoShelf', 'Pool', 'Movies', 'Stuffies', 'TreeClimb']) try { if (window[k] && window[k].active) window[k].close(); } catch (e) { }
    try { if (window.Spa && Spa._state && Spa._state()) Spa.close(); } catch (e) { }
    const p = document.getElementById('panel'); if (!p.classList.contains('hidden')) { const b = p.querySelector('.ptop button'); if (b && b.textContent === '❌') T.press(b); }
    p.classList.add('hidden'); p.innerHTML = ''; G.busy = false; G.sceneOn = false;
    await T.sleep(350);
  };
  T.fort = () => { if (!G.fort) { const ks = fortPieceKeys(); placeFort([{ key: ks[0], x: 100, y: 128, s: 1, flip: false }, { key: ks[1], x: 140, y: 128, s: 1, flip: false }]); } return !!G.fort; };
  T.tab = (sel, i) => T.press(document.querySelectorAll(sel)[i]);
  T.SCREENS = {
    cook_fridge: async () => { UI.openCook('fridge'); },
    cook_freezer: async () => { UI.openCook('freezer'); },
    cook_cabinet: async () => { UI.openCook('cabinet'); },
    cook_bowl: async () => { UI.openCook('bowl'); },
    cook_methods: async () => { UI.openCook('fridge'); await T.sleep(100); T.press('#panel .grid.ing .tile'); await T.sleep(50); T.press('#panel .pbtn.go'); },
    cook_meter: async () => { UI.openCook('fridge'); await T.sleep(100); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(80); T.press('#panel .method[data-m=fry]'); },
    cook_result: async () => { UI.openCook('fridge'); await T.sleep(100); T.press('#panel .grid.ing .tile'); T.press('#panel .pbtn.go'); await T.sleep(80); T.press('#panel .method[data-m=stack]'); await T.sleep(1600); },
    dress_outfit: async () => { UI.openDress(); },
    dress_looks: async () => { UI.openDress(); await T.sleep(60); T.tab('#panel .tabs .pbtn', 7); },
    dress_face: async () => { UI.openDress(); await T.sleep(60); T.tab('#panel .tabs .pbtn', 4); },
    crafts_draw: async () => { UI.openCrafts('math'); await T.sleep(60); T.tab('#panel .pbody > .row .pbtn', 0); },
    crafts_cut: async () => { UI.openCrafts('cut'); },
    crafts_dio: async () => { UI.openCrafts('dio'); },
    crafts_gal: async () => { UI.openCrafts('gal'); },
    crafts_math: async () => { UI.openCrafts('math'); },
    crafts_spell: async () => { UI.openCrafts('spell'); },
    isomap: async () => { openIsoMap(); },
    uimap: async () => { UI.openMap(); },
    fort_builder: async () => { openFortBuilder(); },
    fort_inside: async () => { T.fort(); openFortInside(); },
    builder_cat: async () => { Builder.open({}); },
    builder_down: async () => { Builder.open({}); await T.sleep(60); const s = document.querySelector('#panel .ptop .pbtn:nth-child(2)'); T.press(s); },
    stickers: async () => { openStickers(); },
    story_shelf: async () => { openStory(); },
    story_readers: async () => { openStory(); await T.sleep(100); T.press('#storyBox .st-book'); },
  };
  T.CANVAS = {
    lego: async () => { Bricks.open({ kind: 'lego' }); }, tiles: async () => { Bricks.open({ kind: 'tiles' }); }, shelf: async () => { LegoShelf.open({}); },
    pool: async () => { Pool.open({}); }, movies: async () => { Movies.open({}); }, stuffies: async () => { Stuffies.open({}); }, spa: async () => { Spa.open({}); },
    tree: async () => { TreeClimb.open({ tree: 'oak' }); },
  };
  // positions of everything interactive on screen (to compare layouts with a switch on and off)
  T.layout = () => { const out = []; for (const n of document.querySelectorAll('#panel button, #panel canvas, #panel .tile, #stkBox .stk, #storyBox button')) { const r = n.getBoundingClientRect(); if (r.width < 2) continue; out.push(T.nm(n) + '@' + [r.left, r.top, r.width, r.height].map(v => Math.round(v)).join(',')); } return out; };
  return Object.keys(T.SCREENS).length;
};
