// One gentle interruption at a time. Crying, poops, wishes and requests all share a single
// budget, and none of them start while Marina is busy with a book, cooking, drawing, dress-up, TV or a fort.
let lastPing = 0;
function inActivity() {
  const gone = id => { const n = document.getElementById(id); return !n || n.classList.contains('hidden'); };
  return typeof marina === 'undefined' || !gone('title') || !gone('panel') || !!(window.Studio && Studio.active) || !!document.querySelector('#storyBox,#stkBox,.fortbar,.fortin')
    || !!G.busy || !!G.sceneOn || !!G.tidy || !!G.chase || !!G.tv || !!(G.fort && G.fort.inside);
}
function pingOk(gap) { return !inActivity() && E.t - lastPing > (gap || 75); }
function ping() { lastPing = E.t; }
(function () {
  let wasCry = false, wasPoop = false, wasNappy = false, quietFor = 0;
  setInterval(() => {
    if (typeof marina === 'undefined' || typeof miles === 'undefined') return;
    if (!document.getElementById('title').classList.contains('hidden')) { lastPing = E.t - 30; return; }   // nothing for the first 45 seconds of a game
    const act = inActivity();
    if (!pingOk(75)) { if (!miles.crying) miles.cryT = Math.max(miles.cryT, 20); G.poopOkAt = Math.max(G.poopOkAt || 0, E.t + 20); }
    // deep in a screen (book, cooking, drawing, dress-up): a crying baby settles himself rather than nagging
    const screen = !document.getElementById('panel').classList.contains('hidden') || !!(window.Studio && Studio.active) || !!document.getElementById('storyBox');
    quietFor = screen ? quietFor + 0.5 : 0;
    if (screen && miles.crying && quietFor > 1) { miles.crying = false; miles.cryT = 150 + Math.random() * 100; }
    if (miles.crying && !wasCry) ping(); if (G.poop && !wasPoop) { ping(); G.poopOkAt = E.t + 360; } if (miles.poopy && !wasNappy) ping();
    wasCry = !!miles.crying; wasPoop = !!G.poop; wasNappy = !!miles.poopy;
  }, 500);
})();

// ------------------------------------------------------------ scrolling a list must never count as choosing something
(function () {
  let d = null;
  const scrolled = n => { let s = 0; for (; n && n !== document.body; n = n.parentElement) s += n.scrollTop + n.scrollLeft; return s; };
  const zone = '#panel,.s-drawer,#stkBox,#storyBox,.acttray,.tpick,.s-colors,.s-tools';
  document.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, s: scrolled(e.target), id: e.pointerId }; }, true);
  document.addEventListener('pointerup', e => {
    const m = d; d = null; if (!m || m.id !== e.pointerId) return;
    const t = e.target.closest && e.target.closest('button,.tile,.slot'); if (!t || !t.closest(zone)) return;
    if (Math.hypot(e.clientX - m.x, e.clientY - m.y) > 12 || scrolled(e.target) !== m.s) { e.stopImmediatePropagation(); e.preventDefault(); }   // the finger was scrolling, not tapping
  }, true);
  document.addEventListener('pointercancel', () => { d = null; }, true);
})();

// ------------------------------------------------------------ every new game starts in her own clothes
(function () {
  const _ss = startScenario;
  startScenario = function (room) { G.outfit = 'default'; G.hair = 'ginger'; G.glasses = true; G.dye = 0; G.look = { head: null, face: null, back: null, hand: null }; return _ss(room); };
})();

// ------------------------------------------------------------ sideways: a second, easy-to-reach way out of every screen
// (the top edge of a phone held sideways is awkward: the browser's own bar and the notch live there)
(function () {
  const b = document.createElement('button'); b.id = 'xFloat'; b.textContent = '❌'; b.setAttribute('aria-label', 'close'); document.body.append(b);
  const target = () => {
    const vis = n => !!n && n.getClientRects().length > 0;
    const stk = document.querySelector('#stkBox .st-x'); if (vis(stk)) return stk;
    const st = document.querySelector('#studio .s-top button[aria-label=close]'); if (vis(st)) return st;
    const sb = document.querySelector('#storyBox .st-x'); if (vis(sb)) return sb;
    const p = document.getElementById('panel'); if (p && !p.classList.contains('hidden')) return p.querySelector('.ptop button');
    return null;
  };
  setInterval(() => { b.classList.toggle('on', innerWidth > innerHeight && !!target()); b.classList.toggle('art', !!(window.Studio && Studio.active)); }, 250);
  const fire = e => { e.stopPropagation(); e.preventDefault(); const t = target(); if (!t) return; for (const type of ['pointerdown', 'pointerup']) t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 99, clientX: 0, clientY: 0 })); };
  b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('pointerup', fire);
  const s = document.createElement('style'); s.textContent = '#xFloat{display:none;position:fixed;z-index:60;left:calc(env(safe-area-inset-left) + 10px);bottom:calc(env(safe-area-inset-bottom) + 10px);width:64px;height:64px;border-radius:20px;border:3px solid #fff;background:#fff;font-size:30px;padding:0;box-shadow:0 4px 0 rgba(0,0,0,.35);touch-action:manipulation}#xFloat.on{display:block}#xFloat.art{left:calc(env(safe-area-inset-left) + 72px);width:52px;height:52px;font-size:24px;opacity:.9}';
  document.head.append(s);
})();

// ------------------------------------------------------------ giggles are a treat, not a tic: at most one laugh per person every 40 seconds, and not the same laugh twice running
(function () {
  const LAUGH = /^(m|r|d|mo)_(giggle|laugh2?|joke_laugh)$/, last = {}, lastKey = {}, GAP = 40;
  const MINE = ['m_giggle', 'm_laugh', 'm_laugh2', 'm_joke_laugh'];
  function gate(key) {          // -> the clip to play, or null to stay quiet
    if (!LAUGH.test(key)) return key;
    const sp = key.split('_')[0], now = performance.now() / 1000;
    if (now - (last[sp] || -99) < GAP) return null;
    last[sp] = now;
    if (sp === 'm') { const opts = MINE.filter(k => k !== lastKey.m); key = opts[(Math.random() * opts.length) | 0]; }
    lastKey[sp] = key; return key;
  }
  const _say = say;
  say = function (key, ent) { const k = gate(key); return k ? _say(k, ent) : Promise.resolve(); };
  const _voice = Audio2.voice;
  Audio2.voice = function (key, speaker, opt) { if (!LAUGH.test(key)) return _voice(key, speaker, opt); const k = gate(key); return k ? _voice(k, speaker, opt) : Promise.resolve(); };
})();

// ------------------------------------------------------------ riding on shoulders / horsey: she always gets down before anything else starts,
// and there can never be two Marinas (one riding, one walking about)
(function () {
  document.addEventListener('DOMContentLoaded', () => {     // once every script has loaded, so the later ones are covered too
    for (const name of ['tellJoke', 'wakeUp', 'horseplay', 'cuddle', 'soothe', 'petNiko', 'feedNiko', 'gymMenu', 'startTidy', 'startFort', 'openStory', 'changeDiaper']) {
      const f = window[name]; if (typeof f !== 'function') continue;
      window[name] = function () { if (marina.mount) dismount(); return f.apply(this, arguments); };
    }
  });
  setInterval(() => {
    if (typeof marina === 'undefined') return; const e = marina.mount;
    if (e && marina.state !== 'ride') {            // something else took over while she was up there: put the grown-up back to normal
      marina.mount = null; if (['horse', 'shoulders'].includes(e.state)) e.state = 'idle'; e.speed = e.speed0 || 52; if (!G.busy) AI.hold(e, false);
    } else if (!e && marina.state === 'ride') marina.state = 'idle';
    for (const g of [daddy, rory]) if (['horse', 'shoulders'].includes(g.state) && marina.mount !== g) { g.state = 'idle'; g.speed = g.speed0 || 52; if (!G.busy) AI.hold(g, false); }   // nobody left crouching with no rider
  }, 200);
})();
