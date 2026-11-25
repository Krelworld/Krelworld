// Chef Marina — clarity: pictures and bubbles over people (G5 G17 G22 G26).
// Built by the 'bubbles' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
//   G5  pictures and bubbles land where they belong: the big room picture, speech bubbles (kept clear of the strip, the
//       pill, the map button and the alert row), the give bubbles and the map's 'here' outline keep their centring.
//       (+ local edit ui.js bigIcon)
//   G17 carrying something: the stop chip shows 🖼️✋ for a picture; give bubbles over Grandpa Jeff (dish and picture) and
//       Nunu (picture); every give bubble slides sideways off the buttons and off its neighbours. (+ local edits nav.js picHints)
//   G22 every speech bubble shows a picture of what it is about: fills only SAY_ICON keys that have no entry yet.
//   G26 Nunu's 'go tell Daddy' job: a still 📞 bubble over Daddy until she tells him. (+ local edit family2.js smell gate)
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const canTranslate = !!(window.CSS && CSS.supports && CSS.supports('translate', '1px'));
  const hit = (a, b) => C.overlap(a, b) > 0;
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  // the middle of the part of the room that is on screen, in stage px (rooms wider than the view: the middle of the view)
  function roomMidX() {
    const R = ROOMS[G.room], a = Math.max(0, E.camX), b = Math.min(R.w, E.camX + E.viewW);
    return toScreen(b > a ? (a + b) / 2 : R.w / 2, 0)[0];
  }
  const sizes = new WeakMap();      // node -> [offsetWidth, offsetHeight]: layout size, measured once (translate never changes it)
  function sizeOf(n) {
    let s = sizes.get(n); if (s) return s;
    const w = n.offsetWidth, h = n.offsetHeight; if (!w || !h) return null;
    s = [w, h]; sizes.set(n, s); return s;
  }

  // ================================================================ G5 — things stay centred where they belong
  // The pop / pulse keyframes animate `transform`, which wiped out the centring translate(-50%, …): bubbles sat with their
  // corner on the speaker's head and give bubbles swung 25 px about. The centring moves to the separate `translate`
  // property, which the keyframes never touch. Browsers without `translate` (iOS before 14.1) ignore all of this.
  C.css('G5', '@supports (translate: 1px) { .say{transform:none;translate:-50% -100%} .pichint{transform:none;translate:-50% -50%} }' +
    '@supports (transform-box: fill-box) { .isoroom.here{transform-box:fill-box;transform-origin:center} }');
  // Speech bubbles now sit one bubble higher, above the head. Near the top of the picture that could slide one under the
  // room strip, the floor pill, the map button or the alert row, so every frame (after UI.update has placed them) each
  // bubble's box is worked out from its left/top and its size, never by measuring the moved bubble (so it cannot wobble).
  // If that box would touch one of those, the bubble drops to 4 px below the lowest one it touches: it then overlaps
  // the speaker's head as it does today, but it is centred and fully visible.
  const G5 = C.G5 = { last: new WeakMap() };
  let g5r = null;
  function g5rects() {
    const t = performance.now(); if (g5r && t - g5r.t < 250) return g5r.list;
    const list = [];
    for (const h of C.hudRects(null, { kinds: ['strip', 'pill', 'map', 'alert'] })) {
      let r = h[0];
      // alerts pulse (scale 1.1, a 4° tilt) about their centre: use the centre and the largest box the pulse reaches,
      // so the measured phase of the pulse can never make a bubble hop up and down
      if (h[2] === 'alert' && h[3]) { const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, half = 0.6 * Math.max(h[3].offsetWidth, h[3].offsetHeight) || (r[2] - r[0]) / 2; r = [cx - half, cy - half, cx + half, cy + half]; }
      list.push(r);
    }
    // the dark backing of the room strip, between and around its buttons
    const rb = document.getElementById('roombar');
    if (rb) { const b = rb.getBoundingClientRect(), st = C.stageRect(), cs = getComputedStyle(rb); if (b.width > 2 && b.height > 2 && cs.visibility !== 'hidden' && +cs.opacity >= 0.05) list.push([b.left - st.left, b.top - st.top, b.right - st.left, b.bottom - st.top]); }
    g5r = { t, list }; return list;
  }
  // where a speech bubble is drawn, in stage px (tail included), worked out without measuring its position
  G5.box = n => {
    const l = num(n.style.left), t = num(n.style.top), s = sizeOf(n); if (l == null || t == null || !s) return null;
    const [w, h] = s;
    if (!(C.on.G5 && canTranslate)) return [l, t, l + w, t + h + 8];       // today: the pop animation leaves its corner on the anchor
    const v = G5.last.get(n), dy = v ? num(v.split(' ')[1]) : null;
    return dy == null ? [l - w / 2, t - h - 8, l + w / 2, t] : [l - w / 2, t + dy, l + w / 2, t + dy + h + 8];
  };
  C.hook('UI.update', 'G5', { order: 10, after(c) {
    if (c.skip || !canTranslate) return;
    const nodes = document.querySelectorAll('#fx .say'); if (!nodes.length) return;
    const R = g5rects();
    for (const n of nodes) {
      if (n.style.display === 'none') continue;
      const l = num(n.style.left), t = num(n.style.top), s = sizeOf(n); if (l == null || t == null || !s) continue;
      const [w, h] = s, y00 = t - h - 8;
      let y0 = y00;
      for (let k = 0; k < 6; k++) {             // drop below what it touches; then check again at the new height
        let low = -Infinity; const box = [l - w / 2, y0, l + w / 2, y0 + h + 8];
        for (const r of R) if (hit(box, r)) low = Math.max(low, r[3]);
        if (low === -Infinity) break; y0 = low + 4;
      }
      const v = y0 === y00 ? '' : '-50% ' + Math.round(y0 - t) + 'px';
      if ((G5.last.get(n) || '') !== v) { n.style.translate = v; G5.last.set(n, v); }
    }
  } });
  C.onToggle('G5', on => { if (on) return; for (const n of document.querySelectorAll('#fx .say')) n.style.translate = ''; G5.last = new WeakMap(); });

  // ================================================================ G17 — carrying something
  // (1) the stop chip: ✋✋ while she holds a picture becomes 🖼️✋ (like 🍽️✋ for a dish)
  C.hook('currentActivity', 'G17', { order: 10, after(c) {
    if (c.skip) return;
    if (c.result === '✋' && G.holding && G.holding.type === 'pic') c.result = '🖼️';
  } });
  // (2) who gets a give bubble (nav.js picHints asks, while G17 is on): a dish to Daddy, Mommy, Uncle Rory and Grandpa Jeff
  // (Nunu doesn't take food), a picture to all of them and Nunu. picHints keeps its own filter (here, not hidden, not in the toilet).
  const G17 = C.G17 = { last: new WeakMap() };
  G17.people = dish => {
    const a = [daddy, mommy, rory];
    if (typeof jeff !== 'undefined' && jeff) a.push(jeff);
    if (!dish && typeof nunu !== 'undefined' && nunu) a.push(nunu);
    return a;
  };
  // Nunu's and Grandpa's bubbles sit over their own sprite tops, the same 14 units above the head as Daddy's (his top is y−90, his bubble y−104)
  G17.top = e => { let b = null; try { b = visBox(e.id); } catch (x) { } const top = b && b[1] < -40 ? b[1] : -90; return e.y + top - 14; };
  // Grandpa's dish bubble: walk over and do what his ring's first 🍽️ does (serve; pressureEat is only ever the second 🍽️)
  G17.serveJeff = () => approach(jeff.x, () => { const a = entActions(jeff).find(x => x.ico === '🍽️'); a && a.fn(); }, 26);
  // (3) placement (nav.js picHints calls this after it has put every bubble at today's spot): sideways only, never down onto
  // a person or onto Marina. Each bubble takes the smallest shift toward the room's middle that clears every button on the
  // picture (at most one bubble width). When no such spot exists, it is nearly always because the room strip or the alert
  // row runs across the top middle, which no sideways shift can clear: then it takes the smallest shift that clears all
  // the other buttons (arrows, pill, moods…); if even that is more than one bubble width, it keeps today's spot.
  // Then bubbles that would overlap each other are spread apart around their shared middle, each keeping its own person's side.
  const clearAt = (box, dx, R) => R.every(r => !hit([box[0] + dx, box[1], box[2] + dx, box[3]], Array.isArray(r[0]) ? r[0] : r));
  const keeps = (box, dx, R, W) => box[0] + dx >= 0 && box[2] + dx <= W && clearAt(box, dx, R);    // the spot it had: still on the picture and clear
  // what a bubble over a person must keep clear of: every button on the picture (not the give bubbles and the 📞 bubble
  // themselves), plus, in the backyard, the little 'the deer / turkeys went that way' tabs drawn at the picture's edges
  let wt = null;
  function wildTabs() {
    const t = performance.now(); if (wt && t - wt.t < 250) return wt.list;
    const list = [];
    try {
      const W = window.Wildlife;
      if (W && G.room === 'backyard') {
        const box = (x, y) => { const a = toScreen(x - 11, y - 10), b = toScreen(x + 11, y + 10); return [a[0], a[1], b[0], b[1]]; };   // the 18×20 tab and its bob
        if (W.active && W.active()) list.push(box(Math.max(E.camX, 0) + 14, 86), box(Math.min(E.camX + E.viewW, ROOMS.backyard.w) - 14, 86));   // either edge, whenever the deer are out
        const ts = W.turkeysActive && W.turkeysActive() ? W.turkeyState : null; if (ts && ts.tab) list.push(box(ts.tab.x, ts.tab.y));
      }
    } catch (e) { C.warnOnce('G17 wild tabs', e); }
    wt = { t, list }; return list;
  }
  const avoidRects = except => C.hudRects(null, { except: ['give', 'call'].concat(except || []) }).map(h => h[0]).concat(wildTabs());
  function nudge(B, R, mid, W) {     // B: [{ box, dx, n }] moved together as one block
    const u = [Math.min(...B.map(b => b.box[0] + b.dx)), Math.min(...B.map(b => b.box[1])), Math.max(...B.map(b => b.box[2] + b.dx)), Math.max(...B.map(b => b.box[3]))];
    const w = Math.max(...B.map(b => b.box[2] - b.box[0]));
    return C.nudgeX(u, R, { dir: Math.sign(mid - (u[0] + u[2]) / 2) || 0, max: w, bounds: [0, W] });
  }
  G17.place = hints => {
    if (!hints || !hints.length) return;
    const W = C.stageRect().width, mid = roomMidX(), R = avoidRects(), R2 = avoidRects(['strip', 'alert']), gap = 4;
    const B = [];
    for (const x of hints) {
      const n = x.n, l = num(n.style.left), t = num(n.style.top), s = sizeOf(n); if (l == null || t == null || !s) continue;
      const box = [l - s[0] / 2, t - s[1] / 2, l + s[0] / 2, t + s[1] / 2];
      const opt = { dir: Math.sign(mid - l) || 0, max: s[0], bounds: [0, W] };
      let dx = C.nudgeX(box, R, opt);
      if (dx == null) dx = C.nudgeX(box, R2, opt);                     // the strip / alert row is in the way anyway: clear the rest
      if (dx == null) dx = 0;                                           // no clear spot within one bubble width: today's spot
      const prev = G17.last.get(n);                                     // buttons that bob (the side arrows) must not make it twitch
      if (prev != null && prev !== dx && Math.abs(prev - dx) <= 6 && keeps(box, prev, R, W)) dx = prev;
      B.push({ n, l, box, dx, w: s[0] });
    }
    // spread bubbles that overlap each other (any two, at any height), in the order of their people, around their middle
    const S = B.slice().sort((a, b) => a.l - b.l);
    const touch = (a, b) => hit([a.box[0] + a.dx - gap / 2, a.box[1], a.box[2] + a.dx + gap / 2, a.box[3]], [b.box[0] + b.dx - gap / 2, b.box[1], b.box[2] + b.dx + gap / 2, b.box[3]]);
    for (let pass = 0; pass < 4; pass++) {
      const grp = S.map((b, i) => i);
      const find = i => (grp[i] === i ? i : (grp[i] = find(grp[i])));
      for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (touch(S[i], S[j])) grp[find(j)] = find(i);
      const sets = {}; S.forEach((b, i) => { (sets[find(i)] = sets[find(i)] || []).push(b); });
      let moved = false;
      for (const k in sets) {
        const cl = sets[k]; if (cl.length < 2) continue;
        const m = cl.reduce((s, b) => s + (b.l + b.dx), 0) / cl.length, total = cl.reduce((s, b) => s + b.w, 0) + gap * (cl.length - 1);
        let x = m - total / 2;
        for (const b of cl) { const dx = x + b.w / 2 - b.l; if (Math.abs(dx - b.dx) > 0.5) moved = true; b.dx = dx; x += b.w + gap; }
        // the spread row as a whole: off the buttons too, if a shift of one bubble width does it
        if (!cl.every(b => clearAt(b.box, b.dx, R))) { const d = nudge(cl, R, mid, W); if (d) for (const b of cl) b.dx += d; }
      }
      if (!moved) break;
    }
    for (const b of B) {
      G17.last.set(b.n, b.dx);
      if (b.dx) b.n.style.left = (b.l + b.dx) + 'px';
    }
  };

  // ================================================================ G22 — every speech bubble shows what it is about
  // say() shows SAY_ICON[key] or a blank 💬. Most of the new lines (and every line Nunu and Grandpa say in their own words
  // through family2's remap) had no picture. One static table, filled in at load ONLY for keys that have no entry yet, so no
  // existing picture changes and anything another file sets first wins. say() itself is not touched.
  //   (a) their versions of a generic line copy that line's picture: hello 👋, comfort 🤗, giggle 🤣, wow 🤩, jokes, food…
  //   (b) love 💖, hugs 🤗;  (c) hello back: 👋👵 / 👋👴;  (d) topic lines use the sticker or choice picture for that topic:
  //       Lego 🧱, films 🎬 (💍 for 'my precious'), the Lego shelf 🗄️, Grandpa's building and work 🔨, the smell 👃,
  //       'tell Daddy' 📞👨 (as the big picture when the job starts), Daddy's phone 📱, deer 🦌, turkeys 🦃, squirrel 🐿️,
  //       sweeping 🧹, laundry 🧺, dusting 🪶, clutter 🧸.  (Minka's lines already have theirs and are left alone.)
  const G22_ICONS = {
    // Nunu
    nu_hi1: '👋', nu_hi2: '👋', nu_hi3: '👋', nu_hi4: '👋', nu_bye: '👋',
    nu_love1: '💖', nu_love2: '💖', nu_love3: '💖', nu_love4: '💖', nu_hug: '🤗', nu_kiss: '😘', nu_proud: '🥹💖', nu_comfort: '🤗',
    nu_giggle: '🤣', nu_wow: '🤩', nu_dance: '💃', nu_play_yes: '🏰🙌', nu_fort: '🏰', nu_tidy: '🧹❗', nu_cat: '🐱🫳',
    nu_joke_laugh: '😂', nu_joke_groan: '😂', nu_whos_there: '❓', nu_europe_who: '❓', nu_why_house: '🤷',
    nu_smell1: '👃', nu_smell2: '👃', nu_smell3: '👃', nu_septic1: '📞👨', nu_septic2: '📞👨', nu_septic3: '📞👨', nu_septic_thanks: '📞👨',
    nu_lego_start: '🧱', nu_lego_idea: '🧱', nu_lego_nice1: '🧱', nu_lego_nice2: '🧱', nu_lego_done: '🧱', nu_lego_oops: '🧱',
    nu_movie_start: '🎬', nu_movie_funny: '🎬', nu_movie_scary: '🎬', nu_movie_sweet: '🎬', nu_movie_end: '🎬', nu_popcorn: '🎬', nu_tv_on: '📺',
    nu_lotr1: '🎬', nu_lotr2: '🎬', nu_lotr3: '🎬', nu_lotr4: '🎬', nu_lotr5: '🎬', nu_lotr6: '🎬', nu_lotr7: '🎬', nu_lotr8: '🎬', nu_lotr9: '🎬', nu_lotr10: '🎬', nu_lotr11: '🎬', nu_lotr_movie: '🎬', nu_precious_laugh: '💍',
    nu_shelf1: '🗄️', nu_shelf2: '🗄️', nu_shelf_full: '🗄️',
    nu_sweep1: '🧹', nu_sweep2: '🧹', nu_laundry1: '🧺', nu_laundry2: '🧺', nu_laundry3: '🧺', nu_clean1: '🪶', nu_clean2: '🪶', nu_clutter: '🧸',
    nu_help: '🧹', nu_help_thanks: '⭐', nu_story: '📖', nu_draw: '🖍️', nu_draw_nice: '🖍️', nu_pic: '🖼️', nu_nofood: '🍽️❌', nu_nofood2: '🍽️❌',
    nu_deer: '🦌', nu_peekaboo: '🙈', nu_hoop: '🏀', nu_wash: '🧼', nu_night: '🌙',
    // Grandpa Jeff
    j_hi1: '👋', j_hi2: '👋', j_hi3: '👋', j_hi4: '👋',
    j_love: '💖', j_hug: '🤗', j_comfort: '🤗', j_tantrum: '🫁💙', j_giggle: '🤣', j_wow: '🤩', j_play_yes: '🏰🙌', j_thanks: '🙏', j_helper: '👍',
    j_highfive: '🙌', j_juggle: '🤹', j_strong: '💪', j_magic: '🪄', j_pic: '🖼️',
    j_joke_laugh: '😂', j_joke_groan: '😂', j_whos_there: '❓', j_europe_who: '❓', j_why_house: '🤷',
    j_food_great: '😋⭐', j_food_good: '😋', j_food_meh: '😬👍', j_nervous: '😅⏰', j_ok: '😰🍽️', j_burp: '💨', j_stomach: '🤢', j_vomit: '🤮', j_diarrhea: '🚽😱', j_notp: '🧻❌', j_tp_thanks: '🧻🙏',
    j_build_hello1: '🔨', j_build_hello2: '🔨', j_build_hello3: '🔨', j_build_start1: '🔨', j_build_start2: '🔨', j_build_start3: '🔨', j_build_start4: '🔨',
    j_build_done1: '🔨', j_build_done2: '🔨', j_build_done3: '🔨', j_build_done4: '🔨', j_build_full1: '🔨', j_build_full2: '🔨', j_build_down: '🔨', j_build_down2: '🔨', j_recolor: '🔨', j_treehouse: '🏡',
    j_work1: '🔨', j_work2: '🔨', j_work3: '🔨',
    j_deer: '🦌', j_turkey: '🦃', j_squirrel: '🐿️', j_tree: '🌲', j_treetop: '🌲', j_oak: '🌳', j_pool: '🏊',
    // Marina and Daddy
    m_hi_nunu: '👋👵', m_hi_jeff: '👋👴', m_wuv_nunu: '💖', m_wuv_jeff: '💖', m_help_nunu: '🧹', m_shelf: '🗄️', m_precious: '💍',
    m_deer: '🦌', m_phone: '📱', m_phone2: '📱', m_septic: '📞👨',
    d_phone1: '📱', d_phone2: '📱', d_phone3: '📱', d_phone4: '📱', d_phone5: '📱', d_phone6: '📱', d_phone7: '📱', d_phone8: '📱', d_phone_off: '📱', d_phone_off2: '📱',
    d_septic: '📞👨', d_septic2: '📞👨', d_tree_wave: '👋',
  };
  const G22 = C.G22 = { added: [] };
  function g22(on) {
    if (typeof SAY_ICON === 'undefined') return;
    if (on) { for (const k in G22_ICONS) if (!(k in SAY_ICON)) { SAY_ICON[k] = G22_ICONS[k]; G22.added.push(k); } }
    else { for (const k of G22.added) if (SAY_ICON[k] === G22_ICONS[k]) delete SAY_ICON[k]; G22.added = []; }
  }
  G22.table = G22_ICONS;
  if (C.on.G22) g22(true);
  C.onToggle('G22', g22);

  // ================================================================ G26 — Nunu's 'go tell Daddy' job
  // (family2.js: no new smell starts while the first one is still untold.) Until she tells him, a still green 📞 bubble sits
  // over Daddy's head whenever he is in her room and nothing else is going on. Tapping it walks her over and does exactly
  // what the 📞 in his ring does. It is not a .pichint, so the dress-up/book buttons and requests ignore it. It lives in #app
  // beside #stage (same layer as the give bubbles), so the stage's own tap-to-walk never sees its taps.
  C.css('G26', '.cm-call{position:absolute;z-index:6;width:62px;height:62px;padding:0;font-size:32px;border-radius:50%;border:4px solid #fff;background:#7be07b;box-shadow:0 4px 0 rgba(0,0,0,.3);touch-action:manipulation;translate:-50% -50%}' +
    '@supports not (translate: 1px) { .cm-call{transform:translate(-50%,-50%)} }');
  const G26 = C.G26 = { btn: null, daddyUntil: 0, dx: null };
  // Daddy's own speech bubble: UI.bubble(ent, icon, ms) shows it until now + ms
  C.hook('UI.bubble', 'G26', { order: 10, after(c) { if (typeof daddy !== 'undefined' && c.args[0] === daddy) G26.daddyUntil = performance.now() + (+c.args[2] || 0); } });
  G26.wanted = () => {
    if (!G.septic || typeof daddy === 'undefined' || !daddy || !daddy.here || daddy.hidden || daddy.state === 'toilet') return false;
    if ((typeof inActivity === 'function' && inActivity()) || C.bodyBusy()) return false;     // busy, scene, TV, tidy, chase, fort, screens; rides, swings, bars
    if (document.querySelector('.act,.pichint')) return false;                                  // a ring is open, or a give bubble owns his head
    if (performance.now() < G26.daddyUntil) return false;                                       // he is talking: his own bubble is there
    return true;
  };
  function callBtn() {
    if (G26.btn) return G26.btn;
    const b = document.createElement('button'); b.className = 'cm-call'; b.setAttribute('aria-label', 'tell Daddy'); b.textContent = '📞';
    b.addEventListener('pointerup', () => {
      if (!C.on.G26) return;
      approach(daddy.x, () => { const a = entActions(daddy).find(x => x.ico === '📞'); a && a.fn(); }, 26);
    });
    return (G26.btn = b);
  }
  const hideCall = () => { if (G26.btn && G26.btn.isConnected) G26.btn.remove(); G26.dx = null; };
  let inApp = null;                     // where #stage sits inside #app (safe-area padding, landscape row), re-read every 250 ms
  addEventListener('resize', () => { inApp = null; }); addEventListener('orientationchange', () => { inApp = null; });
  function stageInApp(app) {
    const t = performance.now(); if (inApp && t - inApp.t < 250) return inApp;
    const ar = app.getBoundingClientRect(), sr = C.stageRect(); return (inApp = { t, x: sr.left - ar.left, y: sr.top - ar.top });
  }
  C.hook('featTick', 'G26', { order: 10, after(c) {
    if (c.skip) return;
    if (!G26.wanted()) return hideCall();
    const st = document.getElementById('stage'), app = document.getElementById('app'); if (!st || !app) return hideCall();
    const b = callBtn(); if (!b.isConnected) st.after(b);
    const s = sizeOf(b) || [62, 62], W = C.stageRect().width, [sx, sy] = toScreen(daddy.x, daddy.y - 104);   // G17's height over Daddy
    const box = [sx - s[0] / 2, sy - s[1] / 2, sx + s[0] / 2, sy + s[1] / 2];
    // clear of the buttons (as G17) and of anyone else's speech bubble. In landscape its row grazes the bottom of the room
    // strip, which runs across the whole top middle: if nothing clears everything, it may touch the strip (as the give
    // bubbles do), but never an alert, a speech bubble, an arrow or the pill.
    const says = [];
    for (const n of document.querySelectorAll('#fx .say')) { if (n.style.display === 'none') continue; const q = G5.box(n); if (q) says.push(q); }
    const R = avoidRects().concat(says), R2 = avoidRects(['strip']).concat(says), opt = { dir: Math.sign(roomMidX() - sx) || 0, max: s[0], bounds: [0, W] };
    let dx = C.nudgeX(box, R, opt), Rk = R;
    if (dx == null) { dx = C.nudgeX(box, R2, opt); Rk = R2; }
    // keep the spot it already has while that is still clear (the side arrows bob 4 px: no twitching, no flicker)
    if (G26.dx != null && G26.dx !== dx && (dx == null || Math.abs(G26.dx - dx) <= 6) && keeps(box, G26.dx, Rk, W)) dx = G26.dx;
    if (dx == null) return hideCall();       // no spot clear of everything within one bubble width: today there is no 📞 bubble, so none just now
    G26.dx = dx;
    // #app-relative: the stage's offset inside #app (safe-area padding, landscape row) plus the stage px
    const o = stageInApp(app);
    b.style.left = (o.x + sx + dx) + 'px'; b.style.top = (o.y + sy) + 'px';
  } });
  C.onToggle('G26', on => { if (!on) { hideCall(); G26.btn = null; } });
})();
