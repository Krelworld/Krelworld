// Chef Marina — clarity: Marina's own buttons, wishes, requests and stickers (G16 G25 G27 G31).
// Built by the 'dock' worker. Shared API: clarity-core.js (Clarity.hook / listen / every / pointer / appear / css and helpers).
// Load guard: needs clarity-flags.js (loaded first) and clarity-core.js (loaded after trees.js).
//   G16  tall portrait: 📒 and 👗 sit side by side in the band under the picture (✋'s row), never over the scene.
//   G25  wishes and requests get one fixed slot per screen size, a glow instead of growing, and the asker's face as badge.
//   G27  a sticker earned under a full screen waits for the room, and every sticker flies into 📒's home; a found
//        treasure's 💎✨ waits for the choices to close.
//   G31  the fort wish shows 🏰 (the sofa's fort choice) and Niko's feeding request shows 🐟 (the bowls' choice).
// Every piece follows its own switch (Clarity.on.Gn); with a switch off, that part of the game is exactly today's.
(function () {
  'use strict';
  const C = window.Clarity; if (!C || !C.core) return;
  const TALL = '(orientation:portrait) and (min-height:150vw)';      // the existing 'tall portrait' rule (faces and ✋ under the picture)
  const tallMQ = matchMedia(TALL);
  const $ = id => document.getElementById(id);
  // where an element is laid out, in viewport px, ignoring transforms and translate animations (offset* skip both)
  function home(el) { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
  const canTranslate = !!(window.CSS && CSS.supports && CSS.supports('translate', '1px 1px') && CSS.supports('scale', '1'));

  // ================================================================ G31  the fort wish shows 🏰, like the sofa's fort choice
  // WISHES (react.js) and SAY_ICON (world.js) are top-level consts, read lazily by showWish and say. Set at load, behind the
  // switch, and restored or re-applied when the switch flips. Niko's 🥫 → 🐟 request is a call-time local edit in fun.js askReq.
  (function G31() {
    let orig = null;
    try { orig = { wish: WISHES.fort.ico, say: SAY_ICON.m_want_fort }; } catch (e) { C.warnOnce('G31 setup', e); return; }
    const apply = on => { WISHES.fort.ico = on ? '🏰' : orig.wish; SAY_ICON.m_want_fort = on ? '🏰' : orig.say; };
    if (C.on.G31) apply(true);
    C.onToggle('G31', apply);
  })();

  // ================================================================ G16  📒 and 👗 move off the picture into Marina's row under it
  // Tall portrait only (min-height:150vw: the screens that already put the face cards and ✋ under the picture). Short portrait
  // (e.g. 375x553) and landscape keep today's spots (landscape right offsets belong to layout, G19).
  // Same pictures, colours, 64 px, idle rule (nav.js:92-93, fun.js:41-42 untouched) and single tap. ✋ and 📒/👗 never show
  // together: the guard hides 📒/👗 while #stopBtn (an earlier sibling in #stage) is visible, closing the 200/250 ms race
  // between the stop tick and the dress tick.
  C.css('G16', '@media ' + TALL + '{' +
    '#bookBtn,#dressBtn{position:fixed;top:calc(env(safe-area-inset-top) + var(--stageH) + 16px);bottom:auto;right:auto;width:64px;height:64px}' +
    '#bookBtn{left:calc(50% - 70px)}#dressBtn{left:calc(50% + 6px)}' +
    '#stopBtn:not(.hidden) ~ #dressBtn,#stopBtn:not(.hidden) ~ #bookBtn{visibility:hidden}}');
  // Glide: the first 3 appearances per session (per button), each button glides in from today's right-hand spot over 500 ms,
  // on the individual translate property, and ignores taps until it has arrived (so it never catches a scene tap on the way).
  // Nothing is saved. Today's portrait spots inside #stage: right 10 px, bottom 10 px (👗, nav.js:132) / 82 px (📒, fun.js:193).
  C.G16 = { glides: { dressBtn: 0, bookBtn: 0 }, anims: new Set() };
  const OLD16 = { dressBtn: 10, bookBtn: 82 };
  function glide16(el) {
    const S = C.G16;
    if (C.on.G16 !== true || !canTranslate || !el.animate || !tallMQ.matches || S.glides[el.id] >= 3) return;
    if (!C.playing() || C.screenOpen()) return;                                 // under the title or a screen (📒 loses .off on the title before the game exists)
    if (document.querySelector('#stopBtn:not(.hidden)')) return;               // hidden by the ✋ guard: nothing to show her
    const st = $('stage'), hs = home(st), h = home(el);
    const dx = Math.round(hs.x + st.offsetWidth - 10 - h.w - h.x), dy = Math.round(hs.y + st.offsetHeight - OLD16[el.id] - h.h - h.y);
    if (!dx && !dy) return;
    S.glides[el.id]++;
    el.style.pointerEvents = 'none';                                            // set in the same task that removed .off: never tappable mid-flight
    let a = null;
    try { a = el.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }], { duration: 500, easing: 'cubic-bezier(.3,.55,.45,1)' }); } catch (e) { }
    const done = () => { if (a) S.anims.delete(a); if (el.style.pointerEvents === 'none') el.style.pointerEvents = ''; };
    if (!a) return done();
    S.anims.add(a); a.onfinish = done; a.oncancel = done;
  }
  for (const id of ['dressBtn', 'bookBtn']) {                                   // each watched separately: 📒 follows 👗 up to 250 ms later
    const el = $(id); if (!el) { C.warnOnce('G16 no #' + id, id); continue; }
    let wasOff = el.classList.contains('off');
    new MutationObserver(() => { const off = el.classList.contains('off'), came = wasOff && !off; wasOff = off; if (came) glide16(el); })
      .observe(el, { attributes: true, attributeFilter: ['class'] });
  }
  C.onToggle('G16', on => { if (!on) for (const a of [...C.G16.anims]) a.cancel(); });

  // ================================================================ G25  wishes and requests: one fixed slot, a glow, and who is asking
  // The slot is chosen once per screen size (load, resize, orientation change), never per prompt: nothing moves for a prompt,
  // and a prompt never moves for anything else. ✋ is never moved, translated or rescaled; 📒/👗 keep their own spots.
  //  - tall portrait (a): a second line centred under the ✋ / 📒👗 row, top = safe-top + stageH + 88 px, as big as fits
  //    (84, 72, then 64 px) ending at least 6 px above the mood faces (e.g. 390x844 → 84, 375x667 → 64);
  //  - tall portrait (b), when even 64 px does not fit (e.g. 390x664): today's right-corner spot. There it can still cover
  //    the asker's face card while it talks; the face badge below says who is asking all the same;
  //  - landscape and short portrait: left 122 px inside #stage (✋ 10 + 104 wide + 8), whether or not ✋ shows. #stage already
  //    starts at the safe-area inset, so no env() here.
  // Tall portrait prompts glow (box-shadow only) instead of growing. Colours, ➡️, handlers, go(), lifetimes: unchanged.
  C.G25 = { mode: null, size: 84, key: '', ghosts: 0, badges: new WeakMap() };
  const sheet25 = C.css('G25', '');                                            // the slot rules, rewritten per screen size
  C.css('G25', '@keyframes cm-g25-glow-w{from{box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 6px rgba(123,224,123,.35),0 0 0 0 rgba(123,224,123,0)}' +
      'to{box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 12px rgba(123,224,123,.6),0 0 24px 10px rgba(123,224,123,.55)}}' +
    '@keyframes cm-g25-glow-r{from{box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 6px rgba(110,195,255,.35),0 0 0 0 rgba(110,195,255,0)}' +
      'to{box-shadow:0 5px 0 rgba(0,0,0,.3),0 0 0 12px rgba(110,195,255,.6),0 0 24px 10px rgba(110,195,255,.55)}}' +
    '#reqBtn b .cm-g25-face{display:block;width:40px;height:40px;border-radius:12px;border:3px solid #fff;background:#2b2340;box-shadow:0 2px 0 rgba(0,0,0,.3);image-rendering:auto}' +
    '.cm-g25-ghost{position:fixed;z-index:29;width:84px;height:84px;border-radius:50%;border:5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:44px;pointer-events:none;box-shadow:0 5px 0 rgba(0,0,0,.3)}' +
    '.cm-g25-ghost-w{background:#7be07b}.cm-g25-ghost-r{background:#6ec3ff}');
  function rules25(mode, size) {
    // landscape and short portrait; the face badge tucks in from today's -10 px so even at the pulse's peak it stays off ✋
    let t = '#wishBtn,#reqBtn{left:122px}#reqBtn b{left:-4px}';
    t += '@media ' + TALL + '{#reqBtn b{left:-10px}';                                 // tall portrait: today's badge corner (fun.js:207)
    if (mode === 'a') t += '#wishBtn,#reqBtn{left:calc(50% - ' + size / 2 + 'px);right:auto;top:calc(env(safe-area-inset-top) + var(--stageH) + 88px);bottom:auto;' +
      'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 44 / 84) + 'px}';
    else t += '#wishBtn,#reqBtn{left:auto}';                                     // (b): today's right-corner spot (react.js:143, fun.js:210)
    t += '#wishBtn{animation:cm-g25-glow-w .7s ease-in-out infinite alternate}#reqBtn{animation:cm-g25-glow-r .7s ease-in-out infinite alternate}}';
    // while a full screen is up (a #panel screen, the story, the sticker book), a prompt that is still showing sits exactly at
    // today's spot, so the screen content under it is the same as today until the game clears it (0.5-2 s). Separate rules: a
    // browser without :has() drops only these. The studio (z-index 40) covers the prompts anyway; the title never has one.
    const up = sel => ['body:has(#panel:not(.hidden))', 'body:has(#storyBox)', 'body:has(#stkBox)'].map(u => sel.split(',').map(x => u + ' ' + x).join(',')).join(',');
    t += up('#wishBtn,#reqBtn') + '{left:104px}' + up('#reqBtn b') + '{left:-10px}';             // today's (react.js:140, fun.js:206-207)
    t += '@media ' + TALL + '{' + up('#wishBtn,#reqBtn') + '{left:auto;right:16px;top:calc(env(safe-area-inset-top) + var(--stageH) + 10px);bottom:auto;width:84px;height:84px;font-size:44px;' +
      'animation:pulse .6s ease-in-out infinite alternate}}';                                    // react.js:143, fun.js:210
    return t;
  }
  function slot25() {
    const S = C.G25, tall = tallMQ.matches, key = innerWidth + 'x' + innerHeight + (tall ? 't' : '');
    if (key === S.key) return;
    let mode = 'side', size = 84;
    if (tall) {
      const st = $('stage'); if (!st || C.on.G25 !== true) return;
      // where the CSS will put the slot's top: for a fixed element, var(--stageH)'s 100% is the viewport, not #app, so with
      // safe-area insets it can differ from the picture's real bottom. Measure it with a throwaway probe (G25 on only).
      const pr = document.createElement('div');
      pr.style.cssText = 'position:fixed;left:0;width:1px;height:1px;visibility:hidden;pointer-events:none;top:calc(env(safe-area-inset-top) + var(--stageH) + 88px)';
      st.append(pr); const top = pr.getBoundingClientRect().top; pr.remove();
      // the moods' resting top. While the game pulses them (#moodbar.pulse, a transform animation) their offsetParent becomes
      // #moodbar, whose 4 px top border offsetTop leaves out: add each offsetParent's clientTop so both read the same
      let moodTop = Infinity;
      for (const m of document.querySelectorAll('#moodbar .mood')) if (m.offsetHeight) { let y = 0; for (let n = m; n; n = n.offsetParent) y += n.offsetTop + (n.offsetParent ? n.offsetParent.clientTop : 0); moodTop = Math.min(moodTop, y); }
      if (moodTop === Infinity) { sheet25.textContent = rules25('b', 84); S.mode = 'b'; return; }   // moods not built yet: today's spot, measure again later
      size = [84, 72, 64].find(s => top + s + 6 <= moodTop) || 0; mode = size ? 'a' : 'b'; size = size || 84;
    }
    S.key = key; S.mode = mode; S.size = size;
    sheet25.textContent = rules25(mode, size);
  }
  // measure at once, then again once the new size has settled (during a rotation the moods and --stageH can lag a frame or
  // more; a stale reading would otherwise be cached for the whole session)
  let settle25 = [];
  const resize25 = () => {
    C.G25.key = ''; slot25();
    for (const h of settle25) clearTimeout(h);
    settle25 = [150, 500, 1200].map(ms => setTimeout(() => { C.G25.key = ''; slot25(); }, ms));
  };
  addEventListener('resize', resize25); addEventListener('orientationchange', resize25);
  try { tallMQ.addEventListener('change', resize25); } catch (e) { }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resize25); else resize25();
  addEventListener('load', resize25);
  // the asker's face (the same portrait as their face card) replaces the request's emoji badge, for all four askers
  function badge25(btn) {
    const S = C.G25; if (!btn || !btn.isConnected || S.badges.has(btn)) return;
    const b = btn.querySelector('b'); if (!b) return;
    const who = (btn.getAttribute('aria-label') || '').replace(/^help /, '');
    let r = null; try { r = FACES.img && FACES.A && FACES.A['face_' + who + '_happy_rest']; } catch (e) { }   // FACES is a const: bare name
    if (!r) return;                                                              // no portrait yet: keep the emoji
    const cv = document.createElement('canvas'); cv.width = 80; cv.height = 80; cv.className = 'cm-g25-face';
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';   // as pool.js faceIcon draws it
    const k = Math.min(80 / r[2], 80 / r[3]);
    try { g.drawImage(FACES.img, r[0], r[1], r[2], r[3], (80 - r[2] * k) / 2, (80 - r[3] * k) / 2, r[2] * k, r[3] * k); } catch (e) { return; }
    S.badges.set(btn, b.innerHTML); b.textContent = ''; b.append(cv);
  }
  function unbadge25() { const btn = $('reqBtn'), S = C.G25; if (btn && S.badges.has(btn)) { const b = btn.querySelector('b'); if (b) b.innerHTML = S.badges.get(btn); S.badges.delete(btn); } }
  // the first 3 prompts per session in slot (a): a look-only copy glides from today's corner into the new slot. The real
  // button is in its slot and tappable from its first frame; the ghost has no id and ignores taps.
  function ghost25(btn) {
    const S = C.G25;
    if (S.mode !== 'a' || !tallMQ.matches || S.ghosts >= 3 || !btn.isConnected || !canTranslate || !document.body.animate || !C.playing() || C.screenOpen()) return;
    if (getComputedStyle(btn).display === 'none') return;
    S.ghosts++;
    const to = home(btn);                                                        // the real button, in slot (a): top = safe-top + stageH + 88
    const fx = document.documentElement.clientWidth - 16 - 84, fy = to.y - 78;   // today's corner: right 16, top safe-top + stageH + 10
    const n = document.createElement('div'); n.className = 'cm-g25-ghost ' + (btn.id === 'wishBtn' ? 'cm-g25-ghost-w' : 'cm-g25-ghost-r');
    const sp = btn.querySelector('span'); n.textContent = sp ? sp.textContent : '';
    n.style.left = fx + 'px'; n.style.top = fy + 'px'; document.body.append(n);
    const dx = Math.round(to.x + to.w / 2 - fx - 42), dy = Math.round(to.y + to.h / 2 - fy - 42), k = to.w / 84;
    let a = null;
    try { a = n.animate([{ translate: '0px 0px', scale: 1, opacity: 0.9 }, { offset: 0.75, opacity: 0.9 }, { translate: dx + 'px ' + dy + 'px', scale: k, opacity: 0 }], { duration: 500, easing: 'ease-in-out', fill: 'forwards' }); } catch (e) { }
    if (a) { a.onfinish = () => n.remove(); a.oncancel = () => n.remove(); }
    setTimeout(() => n.remove(), 900);
  }
  C.appear('#wishBtn', 'G25', btn => { slot25(); ghost25(btn); });
  C.appear('#reqBtn', 'G25', btn => { slot25(); badge25(btn); ghost25(btn); });
  C.onToggle('G25', on => { if (on) { resize25(); badge25($('reqBtn')); } else unbadge25(); });

  // ================================================================ G27  stickers wait for the room and fly into 📒; treasures wait for the choices
  // Unchanged and at the same moments: award(), the save, the jingle, the stars, m_sticker, m_found, did('secret').
  //  - a toast that appears while a full screen is up (Clarity.screenOpen()) is hidden and its picture queued; when the screen
  //    closes, the queue replays over the room one after another, each exactly once (a toast that arrives while another is
  //    flying waits its turn too). If a screen opens during a flight, that toast is hidden and goes back to the front of the queue;
  //  - every toast flies to 📒's home rect (its box exists even with .off). When that lies outside #stage (the tall-portrait
  //    dock), the toast flies in a fixed, pointer-events:none layer on body, so #stage's overflow does not clip it;
  //  - no look-only peek: 📒 is never shown while it has .off. If 📒 is visible and tappable when the toast lands, it wiggles
  //    once (Clarity.shake); otherwise a short ✨ (pointer-events:none) marks its home spot;
  //  - a big icon ending in ✨ (the found treasure, fun.js) that arrives while choices are open waits until they close
  //    (UI.closeActions) or 1.5 s; if a screen is up by then, until it closes. Replayed exactly once, never dropped.
  C.G27 = { queue: [], flying: null, icons: [], layer: null, raf: 0 };
  const seen27 = new WeakSet();                                                  // toasts already handled (ours, or moved into the layer)
  C.css('G27', '@keyframes cmStkFly{0%{transform:scale(0) rotate(-40deg);opacity:0}15%{transform:scale(1.25) rotate(8deg);opacity:1}28%{transform:scale(1) rotate(0)}' +
      '70%{transform:scale(1) rotate(0);opacity:1}92%{transform:translate(var(--tx),var(--ty)) scale(.15);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(.15);opacity:0}}' +   // arrives at 92%, then fades on the spot
    '.stk-toast.cm-g27-fly{animation-name:cmStkFly}' +
    '.cm-g27-layer{position:fixed;z-index:40;pointer-events:none;overflow:visible}.cm-g27-layer *{pointer-events:none}' +
    '.cm-g27-spark{position:absolute;margin:-24px 0 0 -24px;width:48px;height:48px;line-height:48px;text-align:center;font-size:40px;animation:cm-g27-spark .8s ease-out forwards}' +
    '@keyframes cm-g27-spark{0%{transform:scale(.2) rotate(-30deg);opacity:0}35%{transform:scale(1.3) rotate(10deg);opacity:1}100%{transform:scale(.8) rotate(0);opacity:0}}');
  function layer27() {                                                           // fixed, over #stage's rect, overflowing freely
    let L = C.G27.layer; if (!L || !L.isConnected) { L = C.G27.layer = document.createElement('div'); L.className = 'cm-g27-layer'; document.body.append(L); }
    const st = $('stage'), hs = home(st);
    L.style.left = hs.x + 'px'; L.style.top = hs.y + 'px'; L.style.width = st.offsetWidth + 'px'; L.style.height = st.offsetHeight + 'px';
    return L;
  }
  // aim the toast's last keyframe at 📒's home: the disc's centre is the toast box's top-left corner (span margin -60/-60), and
  // the transform turns about the box's centre, so translate t = target − anchor − (1 − 0.15) · box/2
  function aim27(t) {
    const book = $('bookBtn'); if (!book) return;
    const hb = home(book), st = $('stage'), hs = home(st);
    const out = hb.x < hs.x - 1 || hb.y < hs.y - 1 || hb.x + hb.w > hs.x + st.offsetWidth + 1 || hb.y + hb.h > hs.y + st.offsetHeight + 1;
    if (out && t.parentNode !== C.G27.layer) layer27().append(t);
    else if (out) layer27();
    const a = home(t), s = 0.15;
    t.style.setProperty('--tx', Math.round(hb.x + hb.w / 2 - a.x - (1 - s) * t.offsetWidth / 2) + 'px');
    t.style.setProperty('--ty', Math.round(hb.y + hb.h / 2 - a.y - (1 - s) * t.offsetHeight / 2) + 'px');
    t.classList.add('cm-g27-fly');
  }
  function fly27(t, glyph, mine) {
    const S = C.G27, e = { t, glyph, mine };
    S.flying = e; aim27(t);
    e.land = setTimeout(() => land27(e), 2150);
    e.end = setTimeout(() => { if (mine) t.remove(); if (S.flying === e) { S.flying = null; pump27(); } }, 2300);
    if (!S.raf) S.raf = requestAnimationFrame(guard27);
  }
  function hide27(e) {                                                           // a screen came up mid-flight: hide it, replay it later
    const S = C.G27; clearTimeout(e.land); clearTimeout(e.end);
    e.t.style.display = 'none'; if (e.mine) e.t.remove();
    S.queue.unshift(e.glyph); if (S.flying === e) S.flying = null;
  }
  function guard27() {                                                           // every frame while a toast flies: never over a screen
    const S = C.G27; S.raf = 0; const e = S.flying;
    if (!e || C.on.G27 !== true) return;
    if (C.screenOpen()) { hide27(e); C.sample(); return; }                      // sample: the core records the edge, so 'screenClose' follows even for a very short screen
    S.raf = requestAnimationFrame(guard27);
  }
  function land27(e) {
    const S = C.G27; if (S.flying !== e || !e.t.isConnected || e.t.style.display === 'none' || C.on.G27 !== true) return;
    const book = $('bookBtn'); if (!book) return;
    const cs = getComputedStyle(book), r = book.getBoundingClientRect();
    let tappable = !book.classList.contains('off') && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none';
    if (tappable) { const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); tappable = !!x && (x === book || book.contains(x)); }
    if (tappable) { C.shake(book, { px: 5, ms: 160, times: 2 }); return; }
    const L = layer27(), hb = home(book), hl = home(L), sp = document.createElement('div');
    sp.className = 'cm-g27-spark'; sp.textContent = '✨'; sp.style.left = (hb.x + hb.w / 2 - hl.x) + 'px'; sp.style.top = (hb.y + hb.h / 2 - hl.y) + 'px';
    L.append(sp); setTimeout(() => sp.remove(), 850);
  }
  // replay the next queued sticker over the room. Replays carry data-cm="g27": a .stk-toast with it is a replay, not a new award
  function pump27() {
    const S = C.G27; if (S.flying || !S.queue.length || C.on.G27 !== true) return;
    if (C.screenOpen()) { C.sample(); return; }                                 // waits for 'screenClose' (or the backstop below)
    const st = $('stage'); if (!st) return;
    const glyph = S.queue.shift(), t = document.createElement('div');
    t.className = 'stk-toast'; t.dataset.cm = 'g27'; t.innerHTML = '<span></span>'; t.firstChild.textContent = glyph;
    seen27.add(t); st.append(t); fly27(t, glyph, true);
  }
  C.appear('.stk-toast', 'G27', t => {
    if (!t.isConnected || seen27.has(t)) return;
    seen27.add(t);
    const S = C.G27, sp = t.querySelector('span'), glyph = sp ? sp.textContent : t.textContent;
    if (C.screenOpen() || S.flying || S.queue.length) { t.style.display = 'none'; S.queue.push(glyph); if (C.screenOpen()) C.sample(); pump27(); return; }
    fly27(t, glyph, false);                                                      // in the room right now: fly it to 📒
  });
  C.listen('screenOpen', 'G27', () => { const e = C.G27.flying; if (e) hide27(e); });
  C.listen('screenClose', 'G27', () => { setTimeout(() => { for (const d of [...C.G27.icons]) try27(d); pump27(); }, 400); });
  // treasures
  function try27(d) {
    const S = C.G27; if (d.done || C.on.G27 !== true) return;
    if (C.screenOpen()) { d.wait = true; C.sample(); return; }                  // waits for screenClose (or the backstop below)
    d.done = true; clearTimeout(d.timer); const i = S.icons.indexOf(d); if (i >= 0) S.icons.splice(i, 1);
    const f = C.inner('UI.bigIcon'); if (f) f.apply(UI, d.args);
  }
  // backstop: whatever waits for a screen to close is released once no screen has been up for 400 ms, even if the screen was
  // too short for the core to see its edge
  C.G27.scrAt = 0;
  C.every(250, 'G27', t => {
    const S = C.G27; if (C.screenOpen()) { S.scrAt = t; return; }
    if (t - S.scrAt < 400) return;
    for (const d of [...S.icons]) if (d.wait) try27(d);
    if (!S.flying && S.queue.length) pump27();
  });
  C.hook('UI.bigIcon', 'G27', { order: 10, before(c) {
    const ch = c.args[0]; if (typeof ch !== 'string' || !/✨$/.test(ch) || !document.querySelector('.act')) return;
    c.skip = true; const d = { args: Array.from(c.args), done: false }; C.G27.icons.push(d);
    d.timer = setTimeout(() => try27(d), 1500);
  } });
  // never replay inside this hook: ui.js:52 runs UI.closeActions() just before the choice's fn, which may open a screen
  C.hook('UI.closeActions', 'G27', { order: 20, after(c) { if (!c.skip && C.G27.icons.length) setTimeout(() => { for (const d of [...C.G27.icons]) try27(d); }, 0); } });
  C.onToggle('G27', on => {
    const S = C.G27; if (on) return;
    if (S.flying) { clearTimeout(S.flying.land); clearTimeout(S.flying.end); if (S.flying.mine) S.flying.t.remove(); S.flying = null; }
    S.queue.length = 0; if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0;
    for (const d of S.icons.splice(0)) { clearTimeout(d.timer); if (!d.done) { d.done = true; try { Clarity.inner('UI.bigIcon').apply(UI, d.args); } catch (e) { } } }   // never dropped
    if (S.layer) { S.layer.remove(); S.layer = null; }
  });
})();
