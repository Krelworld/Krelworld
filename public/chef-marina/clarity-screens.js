// Chef Marina — clarity: full screens: ways out, layouts, glyphs and hints (G3 G9 G10 G12 G32 G33 G34).
// Built by the 'screens' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
// The small game-file edits that belong to these items are marked /* G33 */ (story.js, fun.js, legoshelf.js, builder.js)
// and /* G34 */ (legoshelf.js, spa.js); each is guarded at call time by Clarity.is(id) and keeps today's code when its switch is off.
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const $ = id => document.getElementById(id);

  // ======================================================================================== G3
  // Sideways, while the floating ❌ (#xFloat, calm.js) shows over a classic screen (cooking, dress-up, crafts, map, fort, Grandpa
  // Jeff's builder…), the screen's content starts one button-width further right, so the bottom-left corner holds nothing but the
  // floating button and a tap on the first food, outfit or toy can no longer close the screen by accident. The floating button also
  // shows the picture of the button it presses (🚪 in the fort interior, ◀️ on the Lego shelf's hero view, ❌ elsewhere).
  // calm.js is not edited: it still decides when the button shows (.on, from its 250 ms timer) and what it presses (its target()).
  // Everything here is recomputed synchronously, from MutationObservers and resize, never from a timer, so the lane is in place
  // before a screen sizes itself (the crafts canvases size 30 ms after opening) and is gone before a canvas screen runs layout().
  const G3 = C.G3 = { lane: false, xon: false, glyph: null, runs: 0 };
  const CANVAS_TOPS = '.bk-top,.ls-top,.mv-top,.pl-top,.spa-top,.stf-top,.tc-top';      // Bricks, Lego shelf, films, pool, spa, stuffies, tree climb
  const vis = n => !!n && n.getClientRects().length > 0;
  // calm.js's own target() (private there), re-implemented: the button the floating ❌ presses, in calm.js's order
  function target() {
    const stk = document.querySelector('#stkBox .st-x'); if (vis(stk)) return stk;
    const st = document.querySelector('#studio .s-top button[aria-label=close]'); if (vis(st)) return st;
    const sb = document.querySelector('#storyBox .st-x'); if (vis(sb)) return sb;
    const p = $('panel'); if (p && !p.classList.contains('hidden')) return p.querySelector('.ptop button');
    return null;
  }
  // exactly one emoji (with its variation selector, skin tone or ZWJ parts), e.g. ❌ 🚪 ◀️ ✖️
  const ONE_EMOJI = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u;
  function glyphOf(btn) {          // the button's first text, when it is a single emoji; otherwise ❌
    for (const n of btn.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) { const s = n.nodeValue.trim(); return ONE_EMOJI.test(s) ? s : '❌'; }
    return '❌';
  }
  let marked = null, watched = null, wasStudio = false;
  const panelMo = new MutationObserver(g3Recompute), boxMo = new MutationObserver(g3Recompute), textMo = new MutationObserver(g3Recompute);
  function g3Recompute() {
    if (!C.on.G3) return;
    const panel = $('panel'), xb = $('xFloat'); if (!panel || !xb) return;
    G3.runs++;
    const studio = wasStudio = !!(window.Studio && Studio.active), t = target();
    const on = innerWidth > innerHeight && !!t && !studio;      // what calm.js makes of #xFloat.on (never read from it: it lags up to 250 ms)
    let top = null, lane = false;
    if (on && !panel.classList.contains('hidden')) {
      top = panel.querySelector(':scope>.ptop');
      if (top && !top.matches(CANVAS_TOPS)) { const cs = getComputedStyle(top); lane = cs.flexDirection === 'row' && cs.position === 'static'; }
    }
    // the lane lives on #panel (cm-lane) AND on the screen's own top row (cm-g3-lane). The CSS needs both, so the moment a canvas
    // screen replaces #panel's children, the marked row is gone and the padding with it, before that screen's layout() can run.
    const mk = lane ? top : null;
    if (marked && marked !== mk) marked.classList.remove('cm-g3-lane');
    if (mk && !mk.classList.contains('cm-g3-lane')) mk.classList.add('cm-g3-lane');
    marked = mk;
    panel.classList.toggle('cm-lane', lane);
    document.body.classList.toggle('cm-xon', on);
    G3.lane = lane; G3.xon = on;
    // the picture of the button it presses (nothing to copy: leave it, so it never flickers while calm.js hides it)
    if (t) { const gl = glyphOf(t); if (xb.textContent !== gl) xb.textContent = gl; G3.glyph = gl; }
    if (t !== watched) { textMo.disconnect(); watched = t; if (t) textMo.observe(t, { childList: true, characterData: true, subtree: true }); }   // e.g. the Lego shelf's ❌ ↔ ◀️
    panelMo.takeRecords(); boxMo.takeRecords(); textMo.takeRecords();      // our own class changes are not news
  }
  function g3Undo() {
    textMo.disconnect(); watched = null;
    if (marked) marked.classList.remove('cm-g3-lane'); marked = null;
    const p = $('panel'); if (p && p.classList.contains('cm-lane')) p.classList.remove('cm-lane');
    if (document.body.classList.contains('cm-xon')) document.body.classList.remove('cm-xon');
    const xb = $('xFloat'); if (xb && xb.textContent !== '❌') xb.textContent = '❌';      // calm.js never resets it
    G3.lane = G3.xon = false; G3.glyph = null; panelMo.takeRecords();
  }
  (function g3Watch() {
    const p = $('panel'); if (p) panelMo.observe(p, { attributes: true, attributeFilter: ['class'], childList: true });      // screens open, close, swap
    for (const id of ['stage', 'title']) { const n = $(id); if (n) boxMo.observe(n, { childList: true }); }             // #storyBox, #stkBox
    addEventListener('resize', g3Recompute); addEventListener('orientationchange', g3Recompute);
  })();
  C.appear('#studio', 'G3', g3Recompute);                                                   // the drawing studio is added to <body>
  C.every(250, 'G3', () => { if (!!(window.Studio && Studio.active) !== wasStudio) g3Recompute(); });   // ...and removed from it (edge only)
  C.onToggle('G3', on => { if (on) g3Recompute(); else g3Undo(); });
  C.css('G3', '@media (orientation:landscape){' +
    '#panel.cm-lane{padding-left:calc(80px + env(safe-area-inset-left))}' +
    '#panel.cm-lane:not(:has(>.ptop.cm-g3-lane)){padding-left:calc(8px + env(safe-area-inset-left))}' +      // a stale class never pads a canvas screen
    '#panel.cm-lane>.ptop.cm-g3-lane{margin-left:-72px}' +                                                     // the top row (and its ❌) stays where it was
    'body.cm-xon #stkBox{padding-left:calc(env(safe-area-inset-left) + 84px)}' +
    // the story: at 844x340 with the notch inset a book's corner sat under the button. #storyBox lives in #stage, which #app already
    // offsets by the inset, so its padding has no env(); the books narrow a little instead of wrapping to a second row.
    'body.cm-xon #storyBox{padding-left:84px}' +
    'body.cm-xon #storyBox .st-book{width:min(27vw,220px,calc((100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 118px) / 3))}}');
  g3Recompute();

  // ======================================================================================== G9
  // Sideways cooking: the food, all six ways to cook and a timing bar she can see. Same buttons, same order, same rules.
  // Ingredient step (only it has a .grid.ing): two columns — the slots with ↩️🗑️✅ on the left; the shelf tabs over a food grid that
  // fills the height on the right, and only the food scrolls. Without :has() support the ingredient step keeps today's layout.
  // Row 1 is the shelf tabs' own 60 px (an 'auto' row would also take a share of the slot tray, which spans rows 1-2); the
  // min-width keeps the four tabs on one line (narrower phones keep today's single column).
  const ING = '#panel .pbody:has(>.grid.ing)';
  C.css('G9', '@media (orientation:landscape) and (min-width:620px){' +
    ING + '{display:grid;grid-template-columns:minmax(200px,36%) 1fr;grid-template-rows:60px auto 1fr;column-gap:10px}' +
    ING + '>.tray{grid-column:1;grid-row:1/3;align-self:start;flex-wrap:wrap}' +
    ING + '>.tray .slot{width:56px;height:56px}' +                                   // the size the slots already have on the next step
    ING + '>.row:not(.shelves){grid-column:1;grid-row:3;align-self:start}' +
    ING + '>.row.shelves{grid-column:2;grid-row:1}' +
    // tiles a touch smaller only on short screens (Safari's bars showing), so a third row always peeks out as a scroll cue
    ING + '>.grid.ing{grid-column:2;grid-row:2/4;min-height:0;overflow:auto;align-content:start;grid-template-columns:repeat(auto-fill,minmax(min(64px,17vh),1fr))}}' +
  // all six ways to cook in one row with ⬅️ under them, and a fry/bake bar that keeps its 40 px
  '@media (orientation:landscape){' +
    '#panel .methods{grid-template-columns:repeat(6,1fr);align-content:center}' +
    '#panel .method{aspect-ratio:auto;height:min(120px,26vh);font-size:min(60px,14vh)}' +
    '#panel .meter{flex:0 0 40px;min-height:36px}}');
  // When the fry/bake bar appears sideways, scroll the cooking body once so the bar and the 🛑 after it are both in view.
  // Measured with getBoundingClientRect (offsetTop counts from #panel); runs once per bar, never while the knob runs.
  function g9ShowMeter(m) {
    const pb = m.parentElement; if (!m.isConnected || !pb || !pb.classList.contains('pbody')) return;
    const stop = m.nextElementSibling, box = pb.getBoundingClientRect(), a = m.getBoundingClientRect(), b = stop ? stop.getBoundingClientRect() : a;
    const top = Math.min(a.top - 8, b.top), bottom = Math.max(a.bottom + 8, b.bottom + 4);      // the knob sticks out 8 px; 🛑 has a 4 px shadow
    const viewTop = box.top + pb.clientTop, viewBottom = viewTop + pb.clientHeight;
    const d = Math.min(bottom - viewBottom, top - viewTop);
    if (d > 0) pb.scrollTop += Math.ceil(d);
    C.G9.scrolled = (C.G9.scrolled || 0) + 1;
  }
  C.G9 = { scrolled: 0 };
  const meterMo = new MutationObserver(recs => {
    if (!C.on.G9 || !C.landscape()) return;
    for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('meter')) g9ShowMeter(n);
  });
  { const p = $('panel'); if (p) meterMo.observe(p, { childList: true, subtree: true }); }

  // ======================================================================================== G10
  // Dress-up: the tab row is never squashed; upright it wraps so all 8 tabs show (🪄 and 💾 too); sideways the small buttons
  // beside the preview sit in short rows and the preview is a little smaller, so a full row of outfits shows.
  C.css('G10', '#panel .tabs{flex:0 0 auto}' +
    '@media (orientation:portrait){#panel .tabs{flex-wrap:wrap;justify-content:center;overflow-x:visible}}' +
    '@media (orientation:landscape){#panel .dtop .dcol{flex-direction:row}#panel .dprev{height:min(30vh,140px)}}');

  // ======================================================================================== G12
  // The 'done' ✅ is never off-screen. Lego on a small sideways phone: the group holding ✅ sticks to the bottom of the scrolling side
  // column, on the panel's own colour as measured on screen (the column itself is transparent). Sticker book: ✅ stays bottom-centre where it is today,
  // but sticks to the bottom while she scrolls, and rests in its usual place after the grid at the end.
  // (the column's own 4 px bottom padding moves into the band, so no sliver of piece shows under it and ✅ never jumps at the end)
  C.css('G12', '.bk-side.bk-narrow{padding-bottom:0}.bk-side.bk-narrow>.bk-tools{position:sticky;bottom:0;z-index:2;padding-top:4px;padding-bottom:4px;background:#261c35;box-shadow:0 -8px 8px -6px rgba(0,0,0,.6)}' +
    '#stkBox .stk-ok{position:sticky;bottom:calc(env(safe-area-inset-bottom) + 8px);z-index:3}');

  // ======================================================================================== G32
  // The drawing studio sideways: the floating ❌ comes back in its own slot under the tools (a 52 px tile inside the 60 px tool
  // column, never on the paper). calm.js already marks it .art while the studio is open and presses the studio's own ❌ (save + close).
  // body:has(>#studio) makes it vanish the moment the studio is removed. The top ❌ stays. Without :has() only the top ❌ shows.
  C.css('G32', '@media (orientation:landscape){' +
    '#studio .s-tools{align-self:start;max-height:calc(100% - 72px)}' +
    'body:has(>#studio) #xFloat.art{display:block;left:calc(env(safe-area-inset-left) + 4px);bottom:calc(env(safe-area-inset-bottom) + 10px);width:52px;height:52px;font-size:26px;opacity:1}' +
    '#studio .s-drawer{left:calc(env(safe-area-inset-left) + 80px)}}');

  // ======================================================================================== G33
  // One way-out look: the story and the sticker book close with the same red ❌ on a white tile as every other screen (glyphs:
  // story.js and fun.js). The sticker book's tile is already 60x60 and takes the panels' 18 px corners. The story's tile stays 52x52
  // (glyph change only): grown to 60 it covered the first book's badge on a 375x667 phone (measured), so ◀ also stays where it is.
  // Lego shelf ◀️/❌ (legoshelf.js) and Grandpa Jeff's take-down 🗑️ (builder.js) are local edits.
  C.css('G33', '#stkBox .st-x{width:60px;height:60px;border-radius:18px;background:#fff;font-size:30px;box-shadow:0 4px 0 rgba(0,0,0,.3)}');
  // flipping the switch at run time: put the glyphs already on screen back (or forward); new ones follow the switch by themselves
  C.onToggle('G33', on => {
    for (const b of document.querySelectorAll('#storyBox .st-x,#stkBox .st-x')) b.textContent = on ? '❌' : '✖️';
    const ls = document.querySelector('#panel>.ls-top>button'); if (ls && !on && ls.textContent !== '❌') ls.textContent = '❌';     // on: frame() sets it
    const from = on ? '🧹' : '🗑️', to = on ? '🗑️' : '🧹';
    for (const n of document.querySelectorAll('.bd-broom,#panel .ptop .pbtn[aria-label="take something down"],#fx .act.bd-sec')) if (n.textContent === from) n.textContent = to;
  });
})();
