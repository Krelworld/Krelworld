// Chef Marina — clarity core: the shared plumbing for the audit's changes (G1–G39).
// Loaded after trees.js (the last game file) and before the clarity-<area>.js files that hold the changes themselves.
// On its own it changes nothing: every wrapped game function passes straight through until a change registers a hook,
// and every hook, tick, listener and stylesheet registered here only runs while its change's switch (Clarity.on.Gn) is on.
//
//   Clarity.hook(point, 'G7', { before(call), after(call), order })   instead of wrapping a game function yourself
//   Clarity.listen('room' | 'screenOpen' | 'screenClose' | 'activityStart' | 'activityEnd', 'G2', fn)
//   Clarity.every(ms, 'G15', fn)        one shared timer          Clarity.pointer('down' | 'up', 'G1', fn)   every touch, first
//   Clarity.appear(selector, 'G25', fn)  a node was just added     Clarity.css('G5', text)   a stylesheet that follows its switch
//   helpers: bodyBusy, screenOpen, busyNow, quietFor, endedAt, playing, landscape, hudRects, stageRect, toClient, fromClient,
//            onCanvas, overlap, nudgeX, floorLevel, floorDir, shake, inner, set, onToggle, item, warnOnce
(function () {
  'use strict';
  const C = window.Clarity; if (!C || C.core) return;
  C.core = 1;
  const now = () => performance.now();
  const warned = {};
  function warnOnce(key, e) { if (warned[key]) return; warned[key] = 1; try { console.warn('clarity: ' + key, e); } catch (x) { } }
  C.warnOnce = warnOnce;
  const live = id => id === 'core' || C.on[id] === true;          // may this change's code run right now?

  // ---------------------------------------------------------------- switches at run time (load-time choices come from clarity-flags.js)
  const toggles = {};
  C.onToggle = (id, fn) => { (toggles[id] = toggles[id] || []).push(fn); };      // fn(on): undo/redo inline state when a switch flips
  C.set = (id, v) => { if (!(id in C.on) || C.on[id] === !!v) return; C.on[id] = !!v; syncCss(); for (const f of toggles[id] || []) { try { f(!!v); } catch (e) { warnOnce('toggle ' + id, e); } } };
  C.item = (id, setup) => { if (!live(id)) return; try { setup(); } catch (e) { warnOnce('setup ' + id, e); } };   // one-time setup, only if on at load

  // ---------------------------------------------------------------- hook points: each shared game function is wrapped ONCE, here
  // A hook gets one object per call: { name, self, args, result, skip }.
  //  before(call): runs before the game's own function; set call.skip = true (and call.result if needed) to not run it.
  //  after(call):  runs after it (also after a skip; check call.skip); may replace call.result.
  // Hooks run in `order` (lower first, default 0), then in the order they were registered. A hook that throws is reported once
  // and its changes to skip/result are undone, so the game carries on exactly as if the hook were not there.
  const POINTS = {};
  function point(name, get, put) {
    let inner = null; try { inner = get(); } catch (e) { }
    if (typeof inner !== 'function') { warnOnce('missing hook point ' + name, name); return; }
    const p = { name, inner, before: [], after: [], n: 0 };
    const w = function () {
      if (!p.n) return inner.apply(this, arguments);                       // nothing registered: exactly the game's own call
      const call = { name, self: this, args: arguments, result: undefined, skip: false };
      for (const h of p.before) {
        if (!live(h.id)) continue; const s = call.skip, r = call.result;
        try { h.fn.call(this, call); } catch (e) { call.skip = s; call.result = r; warnOnce(h.id + ' before ' + name, e); }
        if (call.skip) break;
      }
      if (!call.skip) call.result = inner.apply(this, arguments);
      for (const h of p.after) {
        if (!live(h.id)) continue; const r = call.result;
        try { h.fn.call(this, call); } catch (e) { call.result = r; warnOnce(h.id + ' after ' + name, e); }
      }
      return call.result;
    };
    w.clarity = name; put(w); POINTS[name] = p;
  }
  for (const k of ['actions', 'closeActions', 'bigIcon', 'pulseMoods', 'bubble', 'update']) point('UI.' + k, () => UI[k], w => { UI[k] = w; });
  point('Audio2.blip', () => Audio2.blip, w => { Audio2.blip = w; });
  // global function declarations: the window property IS the binding every game file calls by name
  for (const g of ['onTap', 'hitTest', 'interact', 'currentActivity', 'onEnterRoomBy', 'checkMess', 'showWish', 'openIsoMap', 'drawProp', 'drawExitSigns', 'featTick']) point(g, () => window[g], w => { window[g] = w; });
  // (builder.js:234 re-wraps drawExitSigns once on the next frame to keep its late drawing last; that is expected — never re-wrap here.)
  // The lists are copied on write, so a hook registered while that same point is running (from inside a hook, or from a
  // listener that fires inside one) takes effect from the next call and never makes a hook of the running call run twice.
  C.hook = (name, id, h) => {
    const p = POINTS[name]; if (!p) throw new Error('clarity: no hook point ' + name);
    const order = h && typeof h.order === 'number' ? h.order : 0;
    const add = (key, fn) => { if (typeof fn !== 'function') return; const list = p[key].slice(); let i = list.length; while (i > 0 && list[i - 1].order > order) i--; list.splice(i, 0, { id, fn, order }); p[key] = list; p.n++; };
    add('before', h && h.before); add('after', h && h.after);
  };
  C.inner = name => (POINTS[name] ? POINTS[name].inner : null);     // the game's own function under the hooks (call it to skip all hooks)
  C.points = () => Object.keys(POINTS);

  // ---------------------------------------------------------------- events
  // 'room' (was, room): after every room change (from floors.js's changeRoom, the outermost one).
  // 'screenOpen' / 'screenClose': a full screen (title, panel, studio, story, sticker book) came up / went away.
  // 'activityStart' / 'activityEnd': inActivity() || bodyBusy() turned true / false. Sampled every 100 ms, and also at once
  //   whenever quietFor() or sample() is called, so a reader never sees a stale edge.
  const EV = {};
  C.listen = (evt, id, fn) => { (EV[evt] = EV[evt] || []).push({ id, fn }); };
  function fire(evt, a, b) { for (const h of EV[evt] || []) { if (!live(h.id)) continue; try { h.fn(a, b); } catch (e) { warnOnce(h.id + ' ' + evt, e); } } }
  try { if (typeof Floors !== 'undefined' && Floors.hooks) Floors.hooks.push((was, room) => fire('room', was, room)); } catch (e) { warnOnce('room hook', e); }

  // ---------------------------------------------------------------- what is going on right now
  // her body is tied up: swing, monkey bars, a ride, the wheelchair or a looping bounce (mirrors currentActivity's body states)
  C.bodyBusy = () => {
    if (typeof marina === 'undefined' || !marina) return false; const s = marina.state;
    return s === 'swing' || s === 'bars' || s === 'ride' || s === 'wheel' || (s === 'anim' && !!(marina.anim && marina.anim.loop));
  };
  // a full screen is up: the title, any #panel screen (cooking, dress-up, crafts, map, fort, Lego, shelf, pool, films, stuffies,
  // spa, tree climb, builder…), the drawing studio, the story or the sticker book. Same screens as inActivity(), without the
  // states (busy, scene, tidy, chase, TV, fort bar) that are not screens.
  C.screenOpen = () => {
    const up = id => { const n = document.getElementById(id); return !!n && !n.classList.contains('hidden'); };
    return up('title') || up('panel') || !!(window.Studio && Studio.active) || !!document.getElementById('storyBox') || !!document.getElementById('stkBox');
  };
  C.busyNow = () => (typeof inActivity === 'function' ? !!inActivity() : true) || C.bodyBusy();
  C.playing = () => typeof marina !== 'undefined' && !!marina && document.getElementById('title').classList.contains('hidden');
  C.landscape = () => innerWidth > innerHeight;
  C.endedAt = null;                                                 // game time (E.t) the last activity ended
  let S = null;
  function sample() {
    if (typeof E === 'undefined') return;
    const act = C.busyNow(), scr = C.screenOpen();
    if (!S) { S = { act, scr }; return; }                           // first look: just remember
    if (scr !== S.scr) { S.scr = scr; fire(scr ? 'screenOpen' : 'screenClose'); }
    if (act !== S.act) { S.act = act; if (!act) C.endedAt = E.t; fire(act ? 'activityStart' : 'activityEnd'); }
  }
  C.sample = sample;
  // seconds of game time since the last activity ended (0 while one is going on; Infinity before the first one ended)
  C.quietFor = () => { sample(); return !S || S.act ? 0 : C.endedAt == null ? Infinity : E.t - C.endedAt; };

  // ---------------------------------------------------------------- one shared timer
  const TICKS = []; let tickIv = 0;
  C.every = (ms, id, fn) => {
    TICKS.push({ ms: Math.max(50, ms | 0), id, fn, due: 0 });
    if (!tickIv) tickIv = setInterval(() => { const t = now(); for (const k of TICKS) { if (t < k.due) continue; k.due = t + k.ms; if (!live(k.id)) continue; try { k.fn(t); } catch (e) { warnOnce(k.id + ' tick', e); } } }, 50);
  };

  // ---------------------------------------------------------------- every touch, before anything in the game sees it
  // Window capture, passive: hooks only look. They must never call preventDefault or stopPropagation.
  const PTR = { down: [], up: [] }; let ptrOn = false;
  C.pointer = (type, id, fn) => {
    if (!PTR[type]) throw new Error('clarity: pointer type ' + type); PTR[type].push({ id, fn });
    if (ptrOn) return; ptrOn = true;
    for (const t of ['down', 'up']) addEventListener('pointer' + t, e => { for (const h of PTR[t]) { if (!live(h.id)) continue; try { h.fn(e); } catch (x) { warnOnce(h.id + ' pointer' + t, x); } } }, { capture: true, passive: true });
  };

  // ---------------------------------------------------------------- a node matching `selector` was just added anywhere in the page
  // Runs as a microtask after the change, before the browser paints. The node may already be gone again (check isConnected).
  const APP = []; let appMo = null;
  C.appear = (sel, id, fn) => {
    APP.push({ sel, id, fn }); if (appMo) return;
    appMo = new MutationObserver(recs => {
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        for (const a of APP) { if (!live(a.id)) continue; try { if (n.matches(a.sel)) a.fn(n); if (n.firstElementChild) for (const x of n.querySelectorAll(a.sel)) a.fn(x); } catch (e) { warnOnce(a.id + ' appear', e); } }
      }
    });
    appMo.observe(document.body, { childList: true, subtree: true });
  };

  // ---------------------------------------------------------------- stylesheets that follow their switch
  // One <style data-clarity="Gn"> per call, kept after every game stylesheet (some screens add theirs the first time they open),
  // and switched off (media="not all") while Clarity.on.Gn is false.
  const STY = []; let headMo = null;
  C.css = (id, text) => {
    const el = document.createElement('style'); el.setAttribute('data-clarity', id); el.textContent = text;
    if (!live(id)) el.setAttribute('media', 'not all');
    document.head.append(el); STY.push({ id, el });
    if (!headMo) {
      headMo = new MutationObserver(recs => {
        if (!recs.some(r => Array.from(r.addedNodes).some(n => n.nodeType === 1 && !n.hasAttribute('data-clarity')))) return;
        for (const s of STY) document.head.append(s.el);
      });
      headMo.observe(document.head, { childList: true });
    }
    return el;
  };
  function syncCss() {
    for (const s of STY) { const want = live(s.id) ? '' : 'not all', has = s.el.getAttribute('media') || ''; if (has !== want) { if (want) s.el.setAttribute('media', want); else s.el.removeAttribute('media'); } }
  }

  // ---------------------------------------------------------------- where the buttons over the picture are
  // hudRects(st?, opt?) -> [[x0,y0,x1,y1], weight, kind, element] for every visible HUD control. Coordinates are relative to
  // `st` (a DOMRect, e.g. placeActs' stage rect) or to #stage; with opt.client, viewport coordinates. Read at most every 250 ms
  // (opt.fresh measures now). Weight 4, or 6 for the mood faces and 😊 in landscape (widened 8 px to the left).
  // opt.kinds / opt.except filter by kind.
  const HUD = [
    ['#roombar .rb', 'strip'], ['#floorpill .fl:not(.off)', 'pill'], ['#mapBtn', 'map'], ['.navarrow:not(.off)', 'arrow'],
    ['#weatherBtn:not(.hidden)', 'weather'], ['#alerts .alertb', 'alert'], ['.facecard.show', 'face'], ['#stopBtn:not(.hidden)', 'stop'],
    ['#bookBtn:not(.off)', 'book'], ['#dressBtn:not(.off)', 'dress'], ['#wishBtn', 'wish'], ['#reqBtn', 'req'],
    ['#fx .pichint', 'give'], ['.cm-call', 'call'], ['#moodbar .mood', 'mood'], ['#moodToggle', 'moodToggle'],
  ];
  const seen = el => {
    if (getComputedStyle(el).visibility === 'hidden') return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) if (+getComputedStyle(n).opacity < 0.05) return false;
    return true;
  };
  let hud = null, stageC = null;
  function measure() {
    const st = document.getElementById('stage'), o = st.getBoundingClientRect(), land = C.landscape(), list = [];
    for (const [sel, kind] of HUD) for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !seen(el)) continue;
      const wide = land && (kind === 'mood' || kind === 'moodToggle');
      list.push({ c: [r.left - (wide ? 8 : 0), r.top, r.right, r.bottom], w: wide ? 6 : 4, kind, el });
    }
    hud = { t: now(), o, list }; stageC = { t: hud.t, r: o };
  }
  const forget = () => { hud = null; stageC = null; };
  addEventListener('resize', forget); addEventListener('orientationchange', forget);
  C.hudRects = (st, opt) => {
    opt = opt || {}; if (!hud || opt.fresh || now() - hud.t > 250) measure();
    const ox = opt.client ? 0 : st ? st.left : hud.o.left, oy = opt.client ? 0 : st ? st.top : hud.o.top, out = [];
    for (const h of hud.list) {
      if ((opt.kinds && !opt.kinds.includes(h.kind)) || (opt.except && opt.except.includes(h.kind))) continue;
      out.push([[h.c[0] - ox, h.c[1] - oy, h.c[2] - ox, h.c[3] - oy], h.w, h.kind, h.el]);
    }
    return out;
  };
  C.stageRect = () => { if (!stageC || now() - stageC.t > 250) stageC = { t: now(), r: document.getElementById('stage').getBoundingClientRect() }; return stageC.r; };
  C.toClient = (wx, wy) => { const r = C.stageRect(), s = toScreen(wx, wy); return [s[0] + r.left, s[1] + r.top]; };     // world -> viewport px
  C.fromClient = (cx, cy) => { const r = C.stageRect(); return toWorld(cx - r.left, cy - r.top); };                     // viewport px -> world
  C.onCanvas = (cx, cy) => { const el = document.elementFromPoint(cx, cy); return !!el && el.id === 'cv'; };           // nothing covers the picture there
  C.overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  // smallest sideways shift that moves `box` off every rect at its height (hudRects entries or plain rects); null if none within
  // opt.max px. opt.gap (default 4) keeps a margin; opt.bounds = [minX, maxX] keeps the box inside; opt.dir = +1 / -1 only
  // allows shifts to the right / left (0 = no shift is always allowed), e.g. toward the room's centre.
  C.nudgeX = (box, rects, opt) => {
    opt = opt || {}; const gap = opt.gap == null ? 4 : opt.gap, max = opt.max == null ? Infinity : opt.max, lo = opt.bounds ? opt.bounds[0] : -Infinity, hi = opt.bounds ? opt.bounds[1] : Infinity, dir = opt.dir > 0 ? 1 : opt.dir < 0 ? -1 : 0;
    const R = rects.map(r => (Array.isArray(r[0]) ? r[0] : r)).filter(r => Math.min(r[3], box[3]) > Math.max(r[1], box[1]));
    const ok = dx => box[0] + dx >= lo && box[2] + dx <= hi && R.every(r => box[2] + dx <= r[0] || box[0] + dx >= r[2]);
    const cands = [0]; for (const r of R) cands.push(r[2] + gap - box[0], r[0] - gap - box[2]);
    cands.sort((a, b) => Math.abs(a) - Math.abs(b));
    for (const dx of cands) if (Math.abs(dx) <= max && (!dir || dx === 0 || Math.sign(dx) === dir) && ok(dx)) return dx;
    return null;
  };

  // ---------------------------------------------------------------- floors: which way is up
  // main floor 0, upstairs +1, basement −1, outside (pool, backyard) 0, tree houses 0.5. Unknown rooms count as the main floor.
  C.floorLevel = room => {
    if (typeof ROOMS !== 'undefined' && ROOMS[room] && ROOMS[room].treehouse) return 0.5;
    if (typeof Floors === 'undefined') return 0; const f = Floors.of(room); return f && f.level != null ? f.level : 0;
  };
  C.floorDir = (from, to) => { const d = C.floorLevel(to) - C.floorLevel(from); return d > 0 ? 1 : d < 0 ? -1 : 0; };

  // ---------------------------------------------------------------- a little 'not now' shake that never fights other animations
  // Animates only the individual `translate` property, added on top of whatever the element already has (composite 'add'), so
  // transforms, CSS animations, :active scales and centring translates keep working. Returns the Animation, or null.
  const canTranslate = !!(window.CSS && CSS.supports && CSS.supports('translate', '1px 1px'));
  const canAdd = typeof KeyframeEffect !== 'undefined' && 'composite' in KeyframeEffect.prototype;
  C.shake = (el, opt) => {
    if (!el || !el.animate || !canTranslate) return null; opt = opt || {};
    const px = opt.px == null ? 4 : opt.px, ms = opt.ms || 150, times = opt.times || 2;
    let bx = '0px', by = '0px';
    if (!canAdd) { const t = getComputedStyle(el).translate; if (t && t !== 'none') { const p = t.split(/\s+/); bx = p[0]; by = p[1] || '0px'; } }
    const at = dx => ({ translate: canAdd ? dx + 'px 0px' : 'calc(' + bx + ' + ' + dx + 'px) ' + by });
    try { return el.animate([at(0), at(px), at(-px), at(0)], { duration: ms, iterations: times, composite: canAdd ? 'add' : 'replace' }); } catch (e) { return null; }
  };

  // ---------------------------------------------------------------- start
  C.every(100, 'core', sample);
  C.every(250, 'core', syncCss);                                     // also catches Clarity.on.Gn = false set by hand
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { C.ready = true; }); else C.ready = true;
})();
