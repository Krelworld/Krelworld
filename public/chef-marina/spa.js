// Chef Marina — the spa bath upstairs: choose a swimsuit, climb in through the little door, fill the tub, bubble bath,
// three jets (whirlpool / floor bubbles / colour lights), bath toys, the hand shower and lots of splashing.
// Everything is drawn on one small pixel canvas inside #panel; every touch is a pointer event on that canvas (no words anywhere).
//   Spa.open({ onDone(result) })   result = { suit, toys, jets, bubbles, toyList, jetList, overflow, splashes }
//                                  suit: 'rainbow' | 'dots' | 'mermaid' | 'shark' | 'sunflower' | 'hero'
//                                  toys / jets / bubbles are counts (different toys played with, different jets tried, squirts of bubble bath);
//                                  toyList / jetList name them. onDone is only called when she finishes with ✅, not after ❌.
//   Spa.close()                    leave at once (the ❌ button does the same): stops every sound and timer
// Pictures live in assets/spa/: scene_p.png + scene_l.png (the room, upright and sideways), tub.png, props.png (toys, basket, bottle, shower),
// marina.png, suit_<name>.png, towel.png (her 64x64 sprites; the face is in the same place on every one so the blinks line up).
(function () {
  'use strict';
  const DIR = 'assets/spa/';
  const SUITS = [['rainbow', '#fff1b8'], ['dots', '#ffd3e6'], ['mermaid', '#c8f1ea'], ['shark', '#d3e2f3'], ['sunflower', '#dcf3c6'], ['hero', '#ffd9cf']];
  // props.png: where each little sprite sits on the sheet [x, y, w, h]
  const PR = { duck: [0, 0, 19, 22], duck_cool: [20, 0, 18, 22], duck_pink: [39, 0, 19, 22], boat: [59, 0, 22, 17], whale: [82, 0, 21, 18], shark: [104, 0, 22, 15],
    mermaid: [127, 0, 22, 14], octopus: [150, 0, 22, 19], basket: [173, 0, 44, 32], bottle: [218, 0, 16, 22], shower: [235, 0, 22, 26] };
  const TOYS = ['duck', 'boat', 'duck_pink', 'whale', 'shark', 'duck_cool', 'mermaid', 'octopus'];
  const DRAUGHT = { duck: 5, duck_cool: 5, duck_pink: 5, boat: 5, whale: 7, shark: 6, mermaid: 6, octopus: 7 };   // how deep each toy sits in the water

  // ---- the tub picture (tub.png, 144x96). Everything below is measured in "tub space": pixels from the top-left of that picture.
  const RIM = 20, FRONT = 56, IX0 = 3, IX1 = 135, FLOOR = 88;   // back rim, top of the front rim, inside left/right, where the tub meets the room floor
  const FULL = 33;                                              // water surface when the tub is full (her chest)
  const SEAT = 26;                                              // her middle when she sits on the moulded seat
  const DOOR = { x: 83, y: 55, w: 31, h: 34, cx: 98 };
  const SPOUT = [111, 15], DRAIN = 118;
  const JET = [[16, 75], [41, 75], [66, 75]], JNAME = ['whirl', 'fizz', 'lights'];
  const NF = 66;                                                // foam columns, 2px each, across the inside of the tub

  // ---- two paintings of the room, one for a phone held upright and one for sideways. tx/ty = where the tub stands in the painting.
  const MODES = {
    p: { bg: 'scene_p', w: 152, h: 300, minW: 148, minH: 228, tx: 6, ty: 148, ay: 0.75, stand: [58, 126], doorY: 104, go: [98, 109], basket: [1, 98], bottle: [73, -32], hook: [132, -32] },
    l: { bg: 'scene_l', w: 304, h: 152, minW: 290, minH: 136, tx: 102, ty: 38, ay: 0.62, stand: [-20, 102], doorY: 100, go: [98, 93], basket: [-68, 68], bottle: [173, 36], hook: [160, -12] },
  };

  // ---- pictures
  const IMG = {};
  function img(k) { if (!IMG[k]) { const i = new Image(); i.src = DIR + k + '.png'; IMG[k] = i; } return IMG[k]; }
  const ok = i => !!i && i.complete && i.naturalWidth > 0;
  function preload() { ['scene_p', 'scene_l', 'tub', 'props', 'marina', 'towel'].concat(SUITS.map(s => 'suit_' + s[0])).forEach(img); }

  // ---- sound: only the game's own sounds, and nothing breaks if a piece is missing
  const AU = () => (typeof Audio2 !== 'undefined' ? Audio2 : null);
  const snd = (fn, ...a) => { try { const A = AU(); if (A && typeof A[fn] === 'function') return A[fn](...a); } catch (e) { } };
  const sfx = (k, o) => snd('sfx', k, o), blip = (n, type, len, vol) => snd('blip', n, type, len, vol), noise = (len, vol, hp) => snd('noise', len, vol, hp);
  const jingle = (notes, step, type) => snd('jingle', notes, step, type), whoosh = up => snd('whoosh', up);
  function speak(key) { try { if (typeof say === 'function') say(key); else snd('voice', key, 'm'); } catch (e) { } }
  // long sounds (running water, the drain) are played here so they can be stopped the moment the screen closes
  const live = new Set();
  function play(key, { vol = 0.6, rate = 1, loop = false } = {}) {
    const h = { dead: false, stop() { this.dead = true; try { if (this.src) this.src.stop(); } catch (e) { } live.delete(this); } };
    try {
      const A = AU(), ac = A && A.ctx; if (!ac || typeof A.load !== 'function') return h;
      live.add(h);
      A.load('assets/sfx/' + key + '.mp3').then(buf => {
        if (h.dead || !buf) { live.delete(h); return; }
        const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate; g.gain.value = vol;
        s.connect(g); g.connect(ac.destination); s.onended = () => live.delete(h); s.start(); h.src = s;
      }).catch(() => live.delete(h));
    } catch (e) { }
    return h;
  }
  function hushAll(keepVoice) { for (const h of [...live]) h.stop(); if (!keepVoice) snd('hush', 'm'); }

  // ---- little helpers
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, u) => a + (b - a) * u, ease = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const R = Math.round;
  function mk(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }

  // crisp pixel drawing: rectangles, cached discs and tiny bitmaps (never anti-aliased)
  function box(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(R(x), R(y), w, h); }
  const DISC = {};
  function disc(c, x, y, r, col) {
    r = Math.max(1, R(r)); const k = r + col; let s = DISC[k];
    if (!s) {
      s = DISC[k] = document.createElement('canvas'); s.width = s.height = r * 2 + 1; const g = s.getContext('2d'); g.fillStyle = col;
      for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r + r * 0.8 - yy * yy)); g.fillRect(r - w, yy + r, w * 2 + 1, 1); }
    }
    c.drawImage(s, R(x) - r, R(y) - r);
  }
  function ring(c, x, y, r, col) { c.fillStyle = col; const n = Math.ceil(r * 5); for (let i = 0; i < n; i++) { const a = i / n * 6.2832; c.fillRect(R(x + Math.cos(a) * r), R(y + Math.sin(a) * r), 1, 1); } }
  function bmp(c, rows, x, y, pal) { x = R(x); y = R(y); for (let j = 0; j < rows.length; j++) { const row = rows[j]; for (let i = 0; i < row.length; i++) { const col = pal[row[i]]; if (col) { c.fillStyle = col; c.fillRect(x + i, y + j, 1, 1); } } } }
  function rbox(c, x, y, w, h, col) { x = R(x); y = R(y); c.fillStyle = col; c.fillRect(x + 2, y, w - 4, h); c.fillRect(x, y + 2, w, h - 4); c.fillRect(x + 1, y + 1, w - 2, h - 2); }
  const ICON = {
    whirl: ['...#####...', '..#.....#..', '.#..###..#.', '.#.#...#.#.', '.#.#.#.#.#.', '.#.#.##..#.', '.#.#....#..', '.#..####...', '..#........', '...#####...'],
    fizz: ['......##...', '.....#..#..', '.....#..#..', '..##..##...', '.#..#......', '.#..#..###.', '..##..#...#', '......#...#', '.##...#...#', '.##....###.'],
    lights: ['...rrrrr...', '..ryyyyyr..', '.rygggggyr.', '.rygbbbgyr.', 'rygb...bgyr', 'rygb...bgyr', 'rygb...bgyr'],
    check: ['.........##', '........###', '.......###.', '##....###..', '###..###...', '.######....', '..####.....', '...##......'],
    up: ['.....#.....', '....###....', '...#####...', '..#######..', '.#########.', '....###....', '....###....', '....###....', '....###....'],
    hint: ['...#######...', '...#ooooo#...', '...#owooo#...', '...#owooo#...', '...#ooooo#...', '...#ooooo#...', '####ooooo####', '#ooooooooooo#', '.#ooooooooo#.', '..#ooooooo#..', '...#ooooo#...', '....#ooo#....', '.....#o#.....', '......#......'],
    drop: ['..#..', '..#..', '.###.', '.###.', '#####', '#####', '#####', '.###.'],
    star: ['..#..', '..#..', '#####', '..#..', '..#..'],
    bigstar: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
    heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
    note: ['..##.', '..#.#', '..#..', '.##..', '.##..'],
  };

  // ---- one bath at a time
  let S = null;

  function css() {
    if (document.getElementById('spa-css')) return;
    const s = mk('style'); s.id = 'spa-css';
    s.textContent = '.spa-body{flex:1 1 auto;min-height:0;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}' +
      '.spa-cv{display:block;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;border-radius:14px;background:#6aa99a;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;box-shadow:0 5px 0 rgba(0,0,0,.3)}' +
      '.spa-top .pbtn{flex:0 0 auto}' +
      '@media (orientation:landscape){.ptop.spa-top{position:absolute;left:calc(8px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));z-index:3;min-height:0;pointer-events:none}' +
      '.ptop.spa-top .pbtn{pointer-events:auto;min-width:60px;height:60px;border:2px solid #fff}.ptop.spa-top .ttl{display:none}}';
    document.head.append(s);
  }

  function open(opts) {
    const p = document.getElementById('panel'); if (!p) return;
    if (S) teardown();
    css(); preload();
    try { if (typeof UI !== 'undefined' && UI.closeActions) UI.closeActions(); } catch (e) { }
    p.innerHTML = ''; p.classList.remove('hidden');
    const top = mk('div', 'ptop spa-top');
    const x = typeof btn === 'function' ? btn('❌', () => close()) : (() => { const b = mk('button', 'pbtn', '❌'); b.addEventListener('pointerup', e => { e.stopPropagation(); close(); }); return b; })();
    x.setAttribute('aria-label', 'close');
    top.append(x, mk('div', 'ttl', '🛁'));
    const body = mk('div', 'spa-body'), cv = mk('canvas', 'spa-cv'); cv.setAttribute('aria-label', 'spa bath'); body.append(cv); p.append(top, body);
    const me = S = {
      p, cv, body, c: cv.getContext('2d'), opts: opts || {}, t: 0, pt: 0, last: performance.now(), raf: 0, phase: 'suit', q: [], ev: {},
      mode: 'p', M: MODES.p, LW: 148, LH: 300, vx: 0, vy: 0, sizeKey: '',
      suit: null, cardT: 0, cardShake: 0,
      m: { x: 0, y: 0, oy: 0, layer: 'out', pose: 'stand', sprite: 'marina', next: null, twirl: 0, flip: false, walk: false, look: [0, 0], lookT: 0, blink: 0, nextBlink: 2, face: null, faceT: 0, shake: 0, jump: 0, hat: 0, beard: 0, shrug: 0, rinse: 0 },
      L: 0, tap: false, tapSnd: null, soap: 0, foam: new Float32Array(NF), energy: 0, ripples: [], jets: [false, false, false], jetOn: [0, 0, 0], sput: [0, 0, 0], hue: 190, over: 0, settle: 0,
      toys: [], left: TOYS.slice(), basketBump: 0, parts: [], puddles: [], ffoam: [], drags: new Map(), door: 0, doorTo: 0,
      shower: { held: false, x: 0, y: 0, back: 0 }, bottle: { t: -1 }, donePress: 0, idle: 0, lastTalk: -9, lastLine: '', sndT: {},
      stats: { toys: new Set(), jets: new Set(), bubbles: 0, overflow: false, splashes: 0, tap: false, wow: false },
    };
    layout(); S.m.x = S.M.stand[0]; S.m.y = S.M.stand[1];
    const down = e => { if (S === me) onDown(e); }, move = e => { if (S === me) onMove(e); }, up = e => { if (S === me) onUp(e); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const rs = () => { if (S === me) layout(); };
    window.addEventListener('resize', rs); window.addEventListener('orientationchange', rs);
    me.off = () => { window.removeEventListener('resize', rs); window.removeEventListener('orientationchange', rs); };
    const frame = now => {
      if (S !== me) return;
      if (!cv.isConnected || p.classList.contains('hidden')) { teardown(); return; }      // something else closed or replaced the screen
      const dt = clamp((now - me.last) / 1000, 0, 0.05); me.last = now;
      try { update(dt); if (S === me) draw(); } catch (err) { console.error('spa', err); }
      if (S === me) me.raf = requestAnimationFrame(frame);
    };
    me.raf = requestAnimationFrame(frame);
    try { const A = AU(); if (A && A.Music && A.Music.set) A.Music.set('bath'); } catch (e) { }
    jingle([0, 4, 7, 12], 0.07, 'triangle');
  }

  function teardown(keepVoice) {
    const me = S; if (!me) return; S = null;
    cancelAnimationFrame(me.raf); if (me.off) me.off(); me.q.length = 0; hushAll(keepVoice);
  }
  function close(keepVoice) {
    const was = S; teardown(keepVoice === true);
    const p = document.getElementById('panel');
    if (p && (was ? was.cv.isConnected : !!p.querySelector('.spa-cv'))) { p.classList.add('hidden'); p.innerHTML = ''; }
    try { if (typeof setMusic === 'function') setMusic(); } catch (e) { }
  }
  function finish() {
    const st = S.stats, cb = S.opts.onDone;
    const res = { suit: S.suit, toys: st.toys.size, jets: st.jets.size, bubbles: st.bubbles, toyList: [...st.toys], jetList: [...st.jets], overflow: st.overflow, splashes: st.splashes };
    close(true);                 // let her finish her happy shout
    if (typeof cb === 'function') { try { cb(res); } catch (e) { console.error('spa onDone', e); } }
  }

  // ---- fit the picture to the screen: pick the painting that can be shown biggest, then show as much of it as there is room for
  function layout() {
    const r = S.body.getBoundingClientRect(), aw = r.width, ah = r.height; if (aw < 20 || ah < 20) return;
    let k = 'p', s = 0;
    for (const n of ['p', 'l']) { const m = MODES[n], q = Math.min(aw / m.minW, ah / m.minH); if (q > s) { s = q; k = n; } }
    const M = MODES[k], LW = Math.min(M.w, Math.floor(aw / s)), LH = Math.min(M.h, Math.floor(ah / s));
    const cv = S.cv; if (cv.width !== LW) cv.width = LW; if (cv.height !== LH) cv.height = LH;
    cv.style.width = Math.floor(LW * s) + 'px'; cv.style.height = Math.floor(LH * s) + 'px';
    const swap = S.mode !== k;
    S.mode = k; S.M = M; S.LW = LW; S.LH = LH; S.scale = s; S.vx = R((M.w - LW) / 2); S.vy = R((M.h - LH) * M.ay); S.sizeKey = R(aw) + 'x' + R(ah);
    if (swap && S.phase === 'suit') { S.m.x = M.stand[0]; S.m.y = M.stand[1]; }
  }

  const later = (sec, fn) => S.q.push({ at: S.t + sec, fn });
  function talk(key, gap) { if (S.t - S.lastTalk < (gap || 3) || (key === S.lastLine && S.t - S.lastTalk < 14)) return false; S.lastTalk = S.t; S.lastLine = key; speak(key); return true; }
  function every(name, gap) { if (S.t - (S.sndT[name] || -9) < gap) return false; S.sndT[name] = S.t; return true; }

  // ---- little bits that fly about: drops, bubbles, sparkles, foam
  function part(o) { if (S.parts.length < 420) S.parts.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, age: 0, in: false }, o)); }
  function sparkle(x, y, n, spread) { for (let i = 0; i < n; i++) part({ k: 'star', x: x + rnd(-spread, spread), y: y + rnd(-spread, spread), vx: rnd(-14, 14), vy: rnd(-26, -4), life: rnd(0.5, 1.1), big: i % 3 === 0, col: pick(['#fff', '#ffe36b', '#ffb6dc', '#9be7ff']) }); }
  function airBubble(x, y) { part({ k: 'air', x, y, vx: rnd(-6, 6), vy: rnd(-22, -9), life: rnd(1.6, 3.2), r: pick([1, 2, 2, 3]), ph: rnd(0, 6) }); }
  function wyAt(x) {
    const t = S.t, e = S.energy; let y = Math.sin(x * 0.19 + t * 3.1) * (0.45 + e * 1.3) + Math.sin(x * 0.07 - t * 2.2) * (0.3 + e * 0.9);
    for (const r of S.ripples) { const a = t - r.t, d = Math.abs(x - r.x); y += r.p * 3.2 * Math.exp(-a * 2.3) * Math.exp(-d / 26) * Math.sin(d * 0.45 - a * 11); }
    return FRONT - S.L * (FRONT - FULL) + y;
  }
  const wet = () => S.L > 0.03;
  const col = x => clamp(((x - IX0) / 2) | 0, 0, NF - 1);
  function splash(x, pow, quiet) {
    if (!wet()) return;
    x = clamp(x, IX0 + 3, IX1 - 3); const y = wyAt(x);
    S.energy = Math.min(1.6, S.energy + 0.35 * pow); S.ripples.push({ x, t: S.t, p: pow }); if (S.ripples.length > 6) S.ripples.shift();
    for (let i = 0; i < 5 + pow * 7; i++) part({ k: 'drop', x: x + rnd(-3, 3), y: y - 1, vx: rnd(-46, 46) * pow, vy: rnd(-120, -50) * (0.6 + pow * 0.5), g: 330, life: 1.2, in: true });
    if (S.soap > 0.05) { const i0 = col(x); for (let i = -3; i <= 3; i++) if (S.foam[i0 + i] !== undefined) S.foam[i0 + i] = Math.min(9, S.foam[i0 + i] + 1.4 * pow); }
    if (!quiet) { noise(0.16, 0.1 * pow + 0.04, 1700); blip(-9 + rnd(-2, 2), 'sine', 0.09, 0.1); }
  }
  // water that jumps right out of the tub and lands on the floor
  function spill(x, n) { for (let i = 0; i < n; i++) part({ k: 'drop', x: clamp(x + rnd(-10, 10), 4, 138), y: wyAt(x) - 2, vx: rnd(-34, 34), vy: rnd(-150, -110), g: 330, life: 3, floor: FLOOR + rnd(3, 12), col: '#8fd4f7' }); }
  function puddle(x, y, grow) {
    let best = null; for (const p of S.puddles) if (Math.abs(p.x - x) < 15) best = p;
    if (best) best.r = Math.min(11, best.r + grow); else if (S.puddles.length < 8) S.puddles.push({ x: clamp(x, -30, 170), y, r: 2 + grow });
    const wetness = S.puddles.reduce((a, p) => a + p.r, 0);
    if (wetness > 22 && !S.ev.uhoh) { S.ev.uhoh = 1; talk('m_uhoh', 1); face('wow', 1); }
  }

  // ---- Marina's little reactions
  function look(x, y) { const m = S.m, hx = m.x, hy = m.y - 44; S.m.look = [Math.abs(x - hx) < 10 ? 0 : Math.sign(x - hx), Math.abs(y - hy) < 12 ? 0 : Math.sign(y - hy)]; m.lookT = 1.6; }
  function face(f, sec) { S.m.face = f; S.m.faceT = sec || 0.8; }
  function giggle(voice) {
    const m = S.m; face('happy', 0.9); m.shake = 0.7;
    for (let i = 0; i < 3; i++) part({ k: 'note', x: m.x + rnd(4, 14), y: m.y - 50 + rnd(-6, 2), vx: rnd(4, 14), vy: rnd(-24, -12), life: 0.9, col: pick(['#fff', '#ffe36b', '#ffb6dc']) });
    if (voice !== false && every('gig', 6)) speak('m_giggle');
    if (every('gigblip', 0.5)) jingle([12, 16, 12, 17, 19], 0.06, 'triangle');
  }
  function wow() { const m = S.m; face('wow', 1.3); m.jump = 0.5; sparkle(m.x, m.y - 50, 8, 12); }
  function shrug() { const m = S.m; m.shrug = 1.6; face('wow', 1.2); talk('m_hmm', 2); }

  // ---- choosing a swimsuit
  function cards() {
    const out = [], land = S.mode === 'l', cols = land ? 6 : 3, cw = land ? 38 : 44, ch = land ? 44 : 50, gap = 3, tw = cols * cw + (cols - 1) * gap;
    const x0 = land ? Math.max(30, R((S.LW - tw) / 2)) : R((S.LW - tw) / 2), rows = Math.ceil(SUITS.length / cols);
    const y0 = land ? 4 : Math.max(4, S.M.ty + 13 - S.vy - 10 - rows * ch - (rows - 1) * gap);
    SUITS.forEach((s, i) => out.push({ i, name: s[0], bg: s[1], x: x0 + (i % cols) * (cw + gap), y: y0 + ((i / cols) | 0) * (ch + gap), w: cw, h: ch }));
    return out;
  }
  function pickSuit(name) {
    const m = S.m; if (S.suit === name && m.twirl <= 0) { m.jump = 0.4; blip(12, 'triangle', 0.08); return; }
    S.suit = name; m.next = 'suit_' + name; m.twirl = 0.75; m.jump = 0.75;
    sfx('chip_sparkle'); jingle([0, 4, 7, 12, 16], 0.06, 'triangle'); whoosh(true);
    sparkle(m.x, m.y - 34, 16, 16);
    later(0.8, () => { if (S.phase === 'suit') { face('happy', 1); talk(name === 'shark' || name === 'hero' ? 'm_cool' : 'm_pretty', 2.5); } });
  }
  function goIn() {
    if (S.phase !== 'suit' || !S.suit) return;
    S.phase = 'enter'; S.pt = 0; S.ev = {}; S.from = [S.m.x, S.m.y]; if (S.m.next) { S.m.sprite = S.m.next; S.m.next = null; S.m.twirl = 0; }
    blip(7, 'triangle', 0.1); S.doorTo = 1; sfx('door_open', { vol: 0.7 });
  }
  const once = (k, at) => { if (S.pt >= at && !S.ev[k]) { S.ev[k] = 1; return true; } return false; };
  function stepEnter() {
    const t = S.pt, m = S.m, M = S.M, T1 = 0.95, T2 = 1.45, T3 = 2.3;
    if (t < T1) { const u = ease(t / T1); m.layer = 'out'; m.pose = 'stand'; m.walk = true; m.flip = S.from[0] > DOOR.cx; m.x = lerp(S.from[0], DOOR.cx, u); m.y = lerp(S.from[1], M.doorY, u); }
    else if (t < T2) { const u = (t - T1) / (T2 - T1); m.walk = false; m.flip = false; m.x = DOOR.cx; m.y = lerp(M.doorY, FRONT, u) - Math.sin(u * Math.PI) * 30; m.layer = u > 0.55 ? 'in' : 'out'; }
    else if (t < T3) { const u = ease((t - T2) / (T3 - T2)); m.layer = 'in'; m.walk = true; m.flip = true; m.x = lerp(DOOR.cx, SEAT, u); m.y = FRONT; }
    else { m.walk = false; m.flip = false; m.pose = 'sit'; m.x = SEAT; m.y = FRONT + 2; m.layer = 'in'; }
    if (once('jump', T1)) sfx('chip_jump');
    if (once('land', T2)) { sfx('chip_land'); S.doorTo = 0; }
    if (once('clunk', T2 + 0.4)) { sfx('thud', { vol: 0.7 }); blip(-17, 'square', 0.08, 0.12); }
    if (once('sit', T3)) { m.jump = 0.4; sfx('boing', { vol: 0.5 }); face('happy', 1.2); speak('m_bath'); S.lastTalk = S.t; S.phase = 'play'; S.pt = 0; S.idle = 2; }
  }

  // ---- the tap, the bubble bath, the jets
  function tapToggle(on) {
    if (on === S.tap) return;
    if (on && S.L >= 0.995) { blip(19, 'triangle', 0.08); sparkle(SPOUT[0], SPOUT[1], 4, 5); return; }
    S.tap = on; S.stats.tap = true; blip(on ? 5 : -2, 'square', 0.06, 0.12);
    if (S.tapSnd) { S.tapSnd.stop(); S.tapSnd = null; }
    if (on) S.tapSnd = play('sink', { vol: 0.32, loop: true });
  }
  function squirt() {
    const b = S.bottle; if (b.t >= 0) return;
    b.t = 0; b.done = false; whoosh(true); look(S.M.bottle[0], S.M.bottle[1]);
  }
  function stepBottle(dt) {
    const b = S.bottle; if (b.t < 0) return; b.t += dt;
    if (b.t > 0.45 && b.t < 1.05) {
      if (every('glug', 0.12)) blip(pick([-7, -5, -3]), 'sine', 0.08, 0.13);
      for (let i = 0; i < 2; i++) part({ k: 'goo', x: 84 + rnd(-2, 2), y: 2, vx: rnd(-8, 8), vy: rnd(30, 60), g: 260, life: 1.5, col: pick(['#ff7fc0', '#ff9fd2', '#ffd0ea']) });
    }
    if (b.t > 0.8 && !b.done) { b.done = true; S.soap = Math.min(3, S.soap + 1); S.settle = 0; S.stats.bubbles++; if (wet()) { const i0 = col(84); for (let i = -5; i <= 5; i++) S.foam[i0 + i] = Math.min(8, S.foam[i0 + i] + 3.5 - Math.abs(i) * 0.4); } if (S.stats.bubbles === 1) talk('m_wash', 2); }
    if (b.t > 1.5) b.t = -1;
  }
  function jetToggle(i) {
    const on = !S.jets[i];
    if (on && S.L < 0.2) {            // no water: a sad sputter, and she shrugs
      S.sput[i] = 0.9; for (let k = 0; k < 4; k++) later(k * 0.13, () => { noise(0.09, 0.09, 500); blip(-22 + rnd(-2, 2), 'sawtooth', 0.07, 0.08); });
      for (const [x, y] of nozzles(i)) for (let k = 0; k < 4; k++) part({ k: 'puff', x, y, vx: rnd(-16, 16), vy: rnd(-22, -4), life: rnd(0.4, 0.8), in: true });
      shrug(); S.hintTap = 3.5; return;
    }
    S.jets[i] = on; blip(on ? 9 + i * 3 : -3, 'square', 0.07, 0.14);
    if (on) {
      S.jetOn[i] = S.t; S.stats.jets.add(JNAME[i]); whoosh(true); look(JET[i][0], JET[i][1]);
      if (!S.stats.wow) { S.stats.wow = true; wow(); speak('m_wow'); S.lastTalk = S.t; } else { face('happy', 0.8); S.m.jump = 0.35; }
      if (i === 2) jingle([0, 4, 7, 11, 14], 0.07, 'sine');
    }
  }
  const nozzles = i => (i === 0 ? [[50, 46], [50, 52], [130, 34], [130, 47]] : i === 1 ? [[20, 53], [34, 53], [58, 53], [68, 53], [78, 53], [88, 53], [98, 53], [108, 53]] : [[58, 50], [88, 50], [118, 50]]);

  // ---- toys
  const toySize = k => [PR[k][2], PR[k][3]];
  function tossToy() {
    S.basketBump = 0.3;
    if (!S.left.length) { sfx('chip_no', { vol: 0.5 }); for (const o of S.toys) if (o.st === 'free') o.vy = -70; return; }
    const k = S.left.shift(), M = S.M, o = { k, x: M.basket[0] + 22, y: M.basket[1] + 2, vx: 0, vy: 0, st: 'fly', dest: 'tub', u: 0, dur: 0.75, from: [M.basket[0] + 22, M.basket[1] + 2], to: [rnd(58, 122), 6], dir: 1, rock: 0, seed: rnd(0, 9), act: 0, deep: false };
    S.toys.push(o); S.stats.toys.add(k); sfx('chip_pickup', { vol: 0.6 }); whoosh(true); look(o.to[0], 0);
    if (S.stats.toys.size === 1) talk('m_toy_play', 2);
  }
  function sendHome(o, delay) { o.st = 'fly'; o.dest = 'home'; o.u = -(delay || 0) / 0.6; o.dur = 0.6; o.from = [o.x, o.y]; o.to = null; o.rock = 0; }
  function squeak(o) {
    const k = o.k; look(o.x, o.y); o.sq = 0.25;
    if (k.startsWith('duck')) { const n = k === 'duck_cool' ? -4 : k === 'duck_pink' ? 6 : 1; blip(n + 3, 'sawtooth', 0.07, 0.15); later(0.09, () => blip(n, 'sawtooth', 0.11, 0.15)); if (o.st === 'free') o.vy = -60; if (k === 'duck_pink') part({ k: 'heart', x: o.x, y: o.y - 12, vy: -18, life: 1, col: '#ff6fae' }); if (k === 'duck_cool') o.spin = 0.5; }
    else if (k === 'boat') { blip(-12, 'square', 0.16, 0.14); later(0.2, () => blip(-12, 'square', 0.28, 0.14)); o.vx += o.dir * 60; for (let i = 0; i < 4; i++) part({ k: 'puff', x: o.x, y: o.y - 9, vx: rnd(-5, 5), vy: rnd(-22, -10), life: rnd(0.5, 1), in: false }); }
    else if (k === 'whale') { whoosh(true); for (let i = 0; i < 16; i++) part({ k: 'drop', x: o.x - o.dir * 2, y: o.y - 8, vx: rnd(-22, 22), vy: rnd(-150, -90), g: 300, life: 1.4, in: o.st === 'free' }); if (wet()) later(0.5, () => S && splash(o.x, 0.5, true)); }
    else if (k === 'shark') { o.act = 2.2; for (let i = 0; i < 5; i++) later(i * 0.07, () => blip(-10 + i * 2, 'square', 0.04, 0.1)); }
    else if (k === 'mermaid') { jingle([12, 16, 19, 24], 0.07, 'sine'); sparkle(o.x, o.y - 4, 8, 9); o.spin = 0.6; }
    else { blip(-14, 'sine', 0.12, 0.16); later(0.1, () => blip(-9, 'sine', 0.1, 0.14)); for (let i = 0; i < 6; i++) part({ k: 'bub', x: o.x + rnd(-6, 6), y: o.y + 4, vy: rnd(-30, -14), life: 1.2, in: true }); if (o.st === 'free') o.vy = -80; }
    if (every('sqg', 5) && Math.random() < 0.6) giggle();
  }
  function headTop() { const m = S.m; return m.y + m.oy - 62 + 6 - (m.hat >= 3 ? 14 : m.hat ? 5 : 0); }
  function stepToys(dt) {
    const m = S.m, t = S.t, seated = m.pose === 'sit' && m.layer === 'in';
    for (let n = S.toys.length - 1; n >= 0; n--) {
      const o = S.toys[n], [w, h] = toySize(o.k), hw = w / 2, hh = h / 2;
      if (o.sq > 0) o.sq -= dt; if (o.spin > 0) o.spin -= dt;
      if (o.st === 'fly') {
        o.u += dt / o.dur; const u = clamp(o.u, 0, 1), to = o.to || [S.M.basket[0] + 22, S.M.basket[1] + 4];
        o.x = lerp(o.from[0], to[0], u); o.y = lerp(o.from[1], to[1], u) - Math.sin(u * Math.PI) * 34; o.rock = u * 6.28 * (o.dest === 'tub' ? 1 : -1);
        if (o.u >= 1) { o.rock = 0; if (o.dest === 'tub') { o.st = 'free'; o.vy = 70; o.vx = rnd(-10, 10); } else { S.toys.splice(n, 1); S.left.push(o.k); S.basketBump = 0.25; blip(2, 'triangle', 0.06, 0.1); } }
        continue;
      }
      if (o.st === 'held') continue;
      if (o.st === 'head') {
        if (!seated) { sendHome(o); continue; }
        o.x = m.x - 1 + Math.sin(t * 2.3 + o.seed) * 1.2; o.y = headTop() - hh + 3; o.rock = Math.sin(t * 2.3 + o.seed) * 0.12; o.vx = o.vy = 0;
        if (S.jets[1] && wet() && t - S.jetOn[1] > 2.5 && t - (o.t0 || 0) > 2.5) { o.st = 'free'; o.vx = 46; o.vy = -110; o.rock = 0; sfx('boing', { vol: 0.5 }); giggle(); }
        continue;
      }
      // floating (or lying in an empty tub)
      const w8 = wet(), sy = w8 ? wyAt(o.x) - S.foam[col(o.x)] * 0.7 : 999, floorY = 55 - hh, floatY = Math.min(floorY, sy + DRAUGHT[o.k] - hh), inWater = w8 && o.y + hh > sy;
      if (!inWater) {
        o.vy += 430 * dt; o.y += o.vy * dt;
        if (w8 && o.y + hh > sy && o.vy > 60) { splash(o.x, clamp(o.vy / 190, 0.4, 1)); if (o.vy > 150) spill(o.x, 1); o.vy *= 0.3; }
        if (o.y >= floorY) { if (o.vy > 60) { blip(-14, 'square', 0.05, 0.1); } o.y = floorY; o.vy = 0; }
      } else {
        if (o.y > floatY + 6) o.deep = true;
        o.vy += ((floatY - o.y) * 62 - o.vy * 5.5) * dt; o.y += o.vy * dt;
        if (o.deep && o.y <= floatY + 0.5) { o.deep = false; if (o.vy < -45) { splash(o.x, 0.7); sfx('chip_pop', { vol: 0.5 }); o.vy *= 0.6; if (every('popg', 4)) giggle(false); } }
        if (o.y > floorY) { o.y = floorY; o.vy = 0; }
        if (S.jets[0]) { o.vx += (Math.sin(t * 0.9) * 52 + Math.sin(t * 3.1 + o.seed) * 22) * dt; }
        if (S.jets[1]) { o.vy += rnd(-1, 1) * 300 * dt; o.vx += rnd(-1, 1) * 40 * dt; }
        o.vx += Math.sin(t * 0.5 + o.seed) * 2 * dt;
        o.rock = (S.jets[0] || S.jets[1] ? 0.16 : 0.05) * Math.sin(t * (S.jets[1] ? 7 : 2.4) + o.seed * 3);
      }
      if (o.act > 0) {              // the wind-up shark zooms up and down the tub, chomping
        o.act -= dt; o.vx = o.dir * 78; if (every('chomp' + n, 0.22)) blip(-19, 'square', 0.03, 0.07);
        for (const q of S.toys) if (q !== o && q.st === 'free' && Math.abs(q.x - o.x) < 12) q.vy = Math.min(q.vy, -50);
      }
      o.vx *= Math.exp(-dt * 1.4); o.x += o.vx * dt;
      const minX = (seated ? SEAT + 15 : IX0) + hw, maxX = IX1 - hw - 1;
      if (o.x < minX) { o.x += Math.min(minX - o.x, 60 * dt + (minX - o.x) * 0.2); if (o.vx < 0) o.vx *= -0.5; if (o.act > 0) o.dir = 1; }
      if (o.x > maxX) { o.x = maxX; if (o.vx > 0) o.vx *= -0.5; if (o.act > 0) o.dir = -1; }
      if (Math.abs(o.vx) > 9 && !(o.act > 0)) o.dir = o.vx > 0 ? 1 : -1;
      for (let j = 0; j < n; j++) {     // toys nudge each other apart instead of stacking in one spot
        const q = S.toys[j]; if (q.st !== 'free') continue; const d = o.x - q.x, need = (w + toySize(q.k)[0]) * 0.36;
        if (Math.abs(d) < need && Math.abs(o.y - q.y) < 12) { const f = (need - Math.abs(d)) * 7 * dt * (d >= 0 ? 1 : -1); o.vx += f * 4; q.vx -= f * 4; }
      }
    }
  }
  function dropToy(o) {
    const m = S.m, [, h] = toySize(o.k), seated = m.pose === 'sit' && m.layer === 'in' && S.phase === 'play';
    if (seated && Math.abs(o.x - m.x) < 15 && o.y + h / 2 > headTop() - 14 && o.y + h / 2 < headTop() + 12 && !S.toys.some(q => q.st === 'head')) {
      o.st = 'head'; o.t0 = S.t; sfx('boing', { vol: 0.5 }); face('happy', 1); look(m.x, m.y - 80); if (every('headg', 4)) giggle(); return;
    }
    if (S.phase === 'play' && o.x > IX0 && o.x < IX1 && o.y < FRONT + 6) { o.st = 'free'; o.vx = 0; o.vy = 0; o.x = clamp(o.x, IX0 + 8, IX1 - 8); o.y = Math.min(o.y, 55 - h / 2); return; }
    sendHome(o); whoosh(false);
  }

  // ---- touches
  function at(e) { const r = S.cv.getBoundingClientRect(), vx = (e.clientX - r.left) * S.LW / r.width, vy = (e.clientY - r.top) * S.LH / r.height; return { vx, vy, x: vx + S.vx - S.M.tx, y: vy + S.vy - S.M.ty }; }
  const inR = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  const doneAt = () => [S.LW - 18, S.LH - 18];
  function onDown(e) {
    if (e.button > 0) return; e.preventDefault(); try { S.cv.setPointerCapture(e.pointerId); } catch (err) { }
    try { snd('init'); } catch (err) { }
    const p = at(e), M = S.M; S.idle = 0; S.hintTap = 0;
    if (S.phase === 'suit') {
      for (const cd of cards()) if (p.vx >= cd.x - 1 && p.vx <= cd.x + cd.w + 1 && p.vy >= cd.y - 1 && p.vy <= cd.y + cd.h + 1) return pickSuit(cd.name);
      const onTub = inR(p, -2, 8, 146, 84), onGo = Math.hypot(p.x - M.go[0], p.y - M.go[1]) < 17;
      if (S.suit && (onGo || onTub)) return goIn();
      if (onTub) { S.cardShake = 0.5; sfx('chip_no', { vol: 0.5 }); return; }
      if (Math.abs(p.x - S.m.x) < 16 && p.y > S.m.y - 60 && p.y < S.m.y + 4) { S.m.jump = 0.4; giggle(); }
      return;
    }
    if (S.phase !== 'play') return;
    const d = doneAt(); if (Math.hypot(p.vx - d[0], p.vy - d[1]) < 18) { S.drags.set(e.pointerId, { k: 'done' }); S.donePress = 1; blip(4, 'square', 0.05, 0.1); return; }
    const sh = S.shower;
    if (!sh.held && inR(p, M.hook[0] - 16, M.hook[1] - 14, 32, 36)) { sh.held = true; sh.x = p.x; sh.y = p.y; S.drags.set(e.pointerId, { k: 'shower' }); blip(10, 'triangle', 0.06, 0.1); S.stats.shower = true; return; }
    for (let n = S.toys.length - 1; n >= 0; n--) {
      const o = S.toys[n]; if (o.st === 'fly' || o.st === 'held') continue; const [w, h] = toySize(o.k);
      if (Math.abs(p.x - o.x) <= Math.max(13, w / 2 + 2) && Math.abs(p.y - o.y) <= Math.max(13, h / 2 + 3)) { S.drags.set(e.pointerId, { k: 'toy', o, sx: p.x, sy: p.y, moved: false, t0: S.t, dx: o.x - p.x, dy: o.y - p.y }); S.toys.splice(n, 1); S.toys.push(o); return; }
    }
    for (let i = 0; i < 3; i++) if (Math.abs(p.x - JET[i][0]) <= 12.5 && p.y >= 59 && p.y <= 91) return jetToggle(i);
    if (inR(p, 100, -8, 46, 36)) return tapToggle(!S.tap);
    if (S.bottle.t < 0 && inR(p, M.bottle[0] - 7, M.bottle[1] - 6, 30, 32)) return squirt();
    if (inR(p, M.basket[0] - 2, M.basket[1] - 8, 48, 42)) return tossToy();
    const m = S.m;
    if (m.pose === 'sit' && Math.abs(p.x - m.x) < 15 && p.y > headTop() - 4 && p.y < 44) return pokeMarina();
    if (p.x > IX0 && p.x < IX1 && p.y > RIM - 16 && p.y < FRONT) {
      const i = col(p.x), f = S.foam[i], sy = wyAt(p.x);
      if (wet() && f > 1.5 && p.y < sy + 2 && p.y > sy - f - 5) return popFoam(p.x);
      if (wet()) { splash(p.x, 1); S.stats.splashes++; look(p.x, 40); if (S.stats.splashes % 2 === 0) spill(p.x, 2); if (S.stats.splashes % 4 === 0) giggle(); return; }
      S.hintTap = 3; blip(-12, 'square', 0.05, 0.08); return;
    }
  }
  function onMove(e) {
    const g = S.drags.get(e.pointerId); if (!g) return; const p = at(e);
    if (g.k === 'shower') { S.shower.x = p.x; S.shower.y = p.y; }
    else if (g.k === 'toy') {
      const o = g.o;
      if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 3.5) { g.moved = true; o.st = 'held'; o.rock = 0; o.act = 0; sfx('chip_tap1', { vol: 0.5 }); }
      if (g.moved) { const [, h] = toySize(o.k), tx = p.x + g.dx * 0.5, ty = p.y + g.dy * 0.5 - 5; o.dir = tx > o.x + 0.5 ? 1 : tx < o.x - 0.5 ? -1 : o.dir; o.x = tx; o.y = ty;
        const sub = wet() && tx > IX0 && tx < IX1 && ty < FRONT + 4 && ty + h / 2 > wyAt(tx) + 3;
        if (sub && !o.sub) { blip(-16, 'sine', 0.1, 0.14); S.energy = Math.min(1.4, S.energy + 0.2); }
        o.sub = sub; look(tx, ty); }
    } else if (g.k === 'done') { const d = doneAt(); S.donePress = Math.hypot(p.vx - d[0], p.vy - d[1]) < 22 ? 1 : 0; }
  }
  function onUp(e) {
    const g = S.drags.get(e.pointerId); if (!g) return; S.drags.delete(e.pointerId); const p = at(e);
    if (g.k === 'shower') { S.shower.held = false; S.shower.back = 1; S.shower.fx = S.shower.x; S.shower.fy = S.shower.y; blip(3, 'triangle', 0.06, 0.1); }
    else if (g.k === 'toy') { const o = g.o; if (!g.moved) squeak(o); else { o.sub = false; dropToy(o); } }
    else if (g.k === 'done') { const d = doneAt(), hit = e.type === 'pointerup' && Math.hypot(p.vx - d[0], p.vy - d[1]) < 22; S.donePress = 0; if (hit) startDrain(); }
  }
  function pokeMarina() {
    const m = S.m, foamy = wet() && S.foam.some(f => f > 2);
    if (foamy && m.hat < 3) {          // scoop foam onto her head: a hat, then a beard, then a great big tower
      m.hat++; m.beard = m.hat >= 2 ? 1 : 0; const i0 = col(m.x + 16); for (let i = -6; i <= 6; i++) if (S.foam[i0 + i] !== undefined) S.foam[i0 + i] *= 0.6;
      sfx('chip_pop', { vol: 0.6 }); blip(7 + m.hat * 3, 'triangle', 0.09, 0.14); m.jump = 0.3; face('happy', 1);
      for (let i = 0; i < 5; i++) airBubble(m.x + rnd(-10, 10), headTop() + rnd(-2, 6));
      if (m.hat === 3) talk('m_look', 2); else if (every('hatg', 3)) giggle();
    } else if (m.hat > 0) { popHat(); giggle(); }
    else { giggle(); if (wet()) { splash(m.x + 18, 0.8); S.stats.splashes++; } m.jump = 0.3; }
  }
  function popHat() { const m = S.m; for (let i = 0; i < 10; i++) airBubble(m.x + rnd(-11, 11), headTop() + rnd(-4, 22)); m.hat = 0; m.beard = 0; sfx('chip_pop'); blip(16, 'sine', 0.05, 0.12); later(0.07, () => blip(21, 'sine', 0.05, 0.12)); }
  function popFoam(x) {
    const i0 = col(x), y = wyAt(x);
    for (let i = -5; i <= 5; i++) if (S.foam[i0 + i] !== undefined) { const f = S.foam[i0 + i]; S.foam[i0 + i] = f * (0.25 + Math.abs(i) * 0.12); }
    for (let i = 0; i < 7; i++) airBubble(x + rnd(-8, 8), y - rnd(1, 8));
    sfx('chip_pop', { vol: 0.5 }); blip(pick([14, 17, 19, 21]), 'sine', 0.05, 0.12); look(x, y); if (every('popf', 3) && Math.random() < 0.5) giggle(false);
  }

  // ---- all done: pull the plug, climb out, fluffy towel
  function startDrain() {
    if (S.phase !== 'play') return;
    S.phase = 'drain'; S.pt = 0; S.ev = {}; tapToggle(false); S.jets = [false, false, false]; S.over = 0; S.soap = 0; S.settle = 3;
    if (S.shower.held) { S.shower.held = false; S.shower.back = 1; S.shower.fx = S.shower.x; S.shower.fy = S.shower.y; } S.drags.clear();
    jingle([7, 4, 0], 0.08, 'triangle');
    if (wet()) { S.drainSnd = play('flush', { vol: 0.3, rate: 1.15 }); look(DRAIN, 50); }
  }
  function stepDrain(dt) {
    if (S.L > 0) {
      S.L = Math.max(0, S.L - dt * 0.36); S.energy = Math.min(1, S.energy + dt * 0.5);
      if (every('glug', 0.13)) { blip(-22 + rnd(-3, 4), 'sine', 0.1, 0.13); if (Math.random() < 0.5) noise(0.1, 0.03, 500); }
      for (const o of S.toys) if (o.st === 'free') o.vx += (DRAIN - o.x) * 0.9 * dt;
      if (S.L <= 0) { jingle([-12, -15, -19, -24], 0.11, 'sine'); S.pt = 0; }
      return;
    }
    if (once('home', 0.15)) { const m = S.m; if (m.hat) popHat(); S.toys.forEach((o, i) => { if (o.st !== 'fly' || o.dest !== 'home') sendHome(o, i * 0.1); }); }
    if (S.ev.home) for (const o of S.toys) if (o.st !== 'fly') sendHome(o);          // one that was still in the air when the plug was pulled
    if (S.pt > 0.5 && !S.toys.length || S.pt > 2.5) { S.phase = 'exit'; S.pt = 0; S.ev = {}; S.doorTo = 1; sfx('door_open', { vol: 0.7 }); }
  }
  function stepExit() {
    const t = S.pt, m = S.m, M = S.M, T1 = 0.2, T2 = 0.95, T3 = 1.45, T4 = 1.9;
    if (t < T1) { m.pose = 'stand'; m.x = SEAT; m.y = FRONT; m.flip = false; m.walk = false; }
    else if (t < T2) { const u = ease((t - T1) / (T2 - T1)); m.walk = true; m.x = lerp(SEAT, DOOR.cx, u); m.y = FRONT; }
    else if (t < T3) { const u = (t - T2) / (T3 - T2); m.walk = false; m.x = DOOR.cx; m.y = lerp(FRONT, M.doorY, u) - Math.sin(u * Math.PI) * 26; m.layer = u > 0.45 ? 'out' : 'in'; }
    else { m.layer = 'out'; m.x = DOOR.cx; m.y = M.doorY; m.walk = false; }
    if (once('jump', T2)) sfx('chip_jump');
    if (once('land', T3)) { sfx('chip_land'); S.doorTo = 0; }
    if (once('towel', T4)) { m.next = 'towel'; m.twirl = 0.75; m.jump = 0.75; whoosh(true); sfx('thud', { vol: 0.5 }); sfx('chip_sparkle'); sparkle(m.x, m.y - 34, 18, 18); }
    if (once('clean', T4 + 0.75)) { face('happy', 2); jingle([0, 4, 7, 12, 16, 19], 0.08, 'triangle'); sfx('magic', { vol: 0.6 }); speak(typeof S.opts.onDone === 'function' ? 'm_yay' : 'm_clean'); sparkle(m.x, m.y - 30, 14, 20); }
    if (t > T4 + 0.2 && every('endsp', 0.12)) { sparkle(m.x + rnd(-22, 22), m.y - rnd(6, 62), 3, 5); if (t > T4 + 0.9) m.jump = m.jump > 0 ? m.jump : 0.4; }
    if (t > T4 + 2.5) finish();
  }

  // ---- one tick of the world
  function update(dt) {
    S.t += dt; S.pt += dt; const t = S.t, m = S.m;
    if (every('size', 0.4)) { const r = S.body.getBoundingClientRect(); if (R(r.width) + 'x' + R(r.height) !== S.sizeKey) layout(); }
    for (let i = S.q.length - 1; i >= 0; i--) if (S.q[i].at <= t) { const f = S.q.splice(i, 1)[0].fn; f(); if (!S) return; }
    S.door += clamp(S.doorTo - S.door, -dt * 3, dt * 3);
    if (S.cardShake > 0) S.cardShake -= dt; if (S.basketBump > 0) S.basketBump -= dt; S.cardT += dt;
    if (S.phase === 'enter') stepEnter(); else if (S.phase === 'drain') stepDrain(dt); else if (S.phase === 'exit') stepExit();
    if (!S) return;
    // her face and wiggles
    if (m.twirl > 0) { const before = m.twirl; m.twirl -= dt; if (m.next && before > 0.56 && m.twirl <= 0.56) { m.sprite = m.next; m.next = null; } if (m.twirl <= 0 && m.next) { m.sprite = m.next; m.next = null; } }
    if (m.jump > 0) m.jump -= dt; if (m.shake > 0) m.shake -= dt; if (m.shrug > 0) m.shrug -= dt; if (m.faceT > 0) { m.faceT -= dt; if (m.faceT <= 0) m.face = null; }
    if (m.lookT > 0) { m.lookT -= dt; if (m.lookT <= 0) m.look = [0, 0]; }
    if (m.blink > 0) m.blink -= dt; else if ((m.nextBlink -= dt) <= 0) { m.blink = 0.13; m.nextBlink = rnd(2, 4.5); }
    const bobbing = S.jets[1] && wet() && m.pose === 'sit';
    m.oy = (m.jump > 0 ? -Math.sin(clamp(m.jump / 0.5, 0, 1) * Math.PI) * 5 : 0) + (m.shake > 0 ? Math.sin(t * 42) * 0.9 : 0) + (m.walk ? -Math.abs(Math.sin(t * 11)) * 1.6 : 0)
      + (bobbing ? Math.sin(t * 8.5) * 1.5 - 1 : 0) + (m.shrug > 0 ? -Math.sin(clamp((1.6 - m.shrug) / 0.5, 0, 1) * Math.PI) * 3 : 0);
    if (bobbing && every('bobg', 7)) { giggle(); if (Math.random() < 0.5) talk('m_bounce', 6); }
    if (S.phase === 'play' && m.pose === 'sit' && !bobbing && S.idle > 6 && every('idlew', 9)) { m.jump = 0.3; look(rnd(40, 130), rnd(-20, 60)); }

    // water in, water level
    if (S.tap) {
      S.L = Math.min(1, S.L + dt / 7.5); S.energy = Math.max(S.energy, 0.3);
      const hit = wet() ? wyAt(SPOUT[0]) : 55;
      if (Math.random() < 0.7) part({ k: 'drop', x: SPOUT[0] + rnd(-3, 3), y: hit - 1, vx: rnd(-26, 26), vy: rnd(-60, -20), g: 300, life: 0.7, in: true });
      if (wet() && Math.random() < 0.5) part({ k: 'bub', x: SPOUT[0] + rnd(-5, 5), y: Math.min(54, hit + rnd(3, 12)), vy: rnd(-26, -10), life: 1, in: true });
      if (S.soap > 0 && wet()) { const i0 = col(SPOUT[0]), s = Math.min(S.soap, 1.6); for (let i = 0; i < NF; i++) { const near = Math.abs(i - i0) < 5; S.foam[i] = Math.min(Math.max(S.foam[i], near ? 9 : 5), S.foam[i] + (near ? 7 : 0.9) * s * dt); } }
      if (S.L >= 1) { tapToggle(false); jingle([12, 19], 0.09, 'triangle'); sparkle(SPOUT[0], SPOUT[1] + 6, 6, 8); if (!S.ev.full) { S.ev.full = 1; face('happy', 1); S.m.jump = 0.4; } }
    }
    S.energy += ((S.jets[0] ? 0.85 : 0) + (S.jets[1] ? 0.55 : 0) - S.energy) * Math.min(1, dt * 1.6);
    S.ripples = S.ripples.filter(r => t - r.t < 2.2);
    if (S.L < 0.18) for (let i = 0; i < 3; i++) if (S.jets[i]) S.jets[i] = false;
    for (let i = 0; i < 3; i++) if (S.sput[i] > 0) S.sput[i] -= dt;
    if (S.hintTap > 0) S.hintTap -= dt;

    // jets
    if (S.jets[0]) {
      const ph = Math.sin(t * 0.9);
      for (const [x, y] of nozzles(0)) if (y > wyAt(x) + 1) { const dir = x < 70 ? 1 : -1, pw = 0.55 + 0.45 * (dir > 0 ? ph : -ph); for (let k = 0; k < 3; k++) part({ k: 'bub', x, y: y + rnd(-1, 1), vx: dir * rnd(55, 110) * (0.6 + pw * 0.5), vy: rnd(-14, 3), life: rnd(0.5, 1.1), in: true, jet: true, r: Math.random() < 0.4 ? 2 : 1 }); }
      if (every('jw', 0.24)) { noise(0.3, 0.035, 240); blip(-31, 'sine', 0.22, 0.09); }
    }
    if (S.jets[1]) {
      for (const [x, y] of nozzles(1)) for (let k = 0; k < 2; k++) if (Math.random() < 0.75) part({ k: 'bub', x: x + rnd(-4, 4), y: y + rnd(-1, 2), vx: rnd(-6, 6), vy: rnd(-74, -34), life: 1.2, in: true, r: Math.random() < 0.45 ? 2 : 1 });
      if (every('jf', 0.11)) blip(pick([17, 19, 21, 24, 26]) + rnd(-1, 1), 'sine', 0.045, 0.045);
      if (every('jfn', 0.3)) noise(0.3, 0.025, 1400);
    }
    if (S.jets[2]) { S.hue = (S.hue + dt * 62) % 360; if (every('jl', 0.9)) blip(pick([0, 4, 7, 11, 12, 16]), 'sine', 0.5, 0.035); }

    // foam: bubble bath + stirring makes it grow; with the jets on it keeps growing until it pours over the side
    const F = S.foam, w8 = wet();
    if (!w8) { for (let i = 0; i < NF; i++) F[i] = Math.max(0, F[i] - 12 * dt); }
    else {
      const s = Math.min(S.soap, 1.6), jf = (S.jets[0] ? 1 : 0) + (S.jets[1] ? 1.3 : 0);
      let sum = 0;
      for (let i = 0; i < NF; i++) {
        const xx = IX0 + i * 2, cap = S.over > 0 ? 27 : 24, capHere = xx < SEAT + 17 && m.pose === 'sit' ? Math.min(cap, 5.5) : cap;
        const low = s > 0 ? Math.min(capHere, 2.6 + Math.sin(i * 0.9) * 0.9) : 0;         // bubble bath in still water: a thin layer of suds
        if (jf > 0 && s > 0) F[i] = Math.min(capHere, F[i] + (2.1 + (S.over > 0 ? 3 : 0)) * s * (0.6 + jf * 0.5) * (0.75 + 0.5 * Math.sin(i * 1.7 + t * 2)) * dt);
        else if (F[i] < low) F[i] = Math.min(low, F[i] + 1.6 * dt);
        else F[i] = Math.max(low, F[i] - (S.settle > 0 ? 3.2 : S.tap && S.soap > 0 ? 0 : 0.22) * dt);
        if (F[i] > capHere) F[i] = Math.max(capHere, F[i] - 20 * dt);
        sum += F[i];
      }
      for (let i = 1; i < NF - 1; i++) F[i] += (F[i - 1] + F[i + 1] - 2 * F[i]) * Math.min(0.45, 7 * dt);
      if (jf > 0) S.soap = Math.max(0, S.soap - 0.02 * dt);
      const mean = sum / NF;
      if (S.over <= 0 && jf > 0 && s > 0 && mean > 15.5) {       // WHOOSH — over it goes
        S.over = 5.2; S.stats.overflow = true; sfx('boing'); whoosh(true); wow(); m.hat = 3; m.beard = 1; later(0.3, () => { speak('m_yay'); S.lastTalk = S.t; }); later(1.4, () => giggle());
      }
      if (S.over > 0) {
        S.over -= dt;
        for (let k = 0; k < 3; k++) if (Math.random() < 0.8) part({ k: 'spill', x: rnd(3, 138), y: FRONT + rnd(0, 3), vy: rnd(12, 30), r: pick([2, 3, 3, 4]), floor: FLOOR + rnd(1, 11), life: 6 });
        if (Math.random() < 0.5) airBubble(rnd(0, 140), rnd(0, 30));
        if (every('ovb', 0.16)) blip(pick([12, 14, 16, 19, 21, 24]), 'sine', 0.05, 0.07);
        if (S.over <= 0) { S.soap = 0; S.settle = 6; later(1.2, () => talk('m_again', 1)); }
      }
      if (mean > 3 && Math.random() < dt * 1.2) { const i = (Math.random() * NF) | 0; if (F[i] > 2) airBubble(IX0 + i * 2, wyAt(IX0 + i * 2) - F[i]); }
    }
    if (S.settle > 0) S.settle -= dt;
    for (let i = S.ffoam.length - 1; i >= 0; i--) { const f = S.ffoam[i]; f.life -= dt; if (f.life < 3) f.r -= dt * 1.2; if (f.life <= 0 || f.r < 0.6) S.ffoam.splice(i, 1); }

    stepBottle(dt); stepToys(dt);

    // hand shower
    const sh = S.shower;
    if (sh.held) {
      const ox = sh.x - 6, oy = sh.y - 13;
      for (let k = 0; k < 3; k++) part({ k: 'spray', x: ox + rnd(-2, 2), y: oy + rnd(0, 2), vx: rnd(-26, -4), vy: rnd(95, 130), g: 240, life: 2 });
      if (every('shs', 0.14)) noise(0.2, 0.035, 2600);
      look(ox, oy);
    } else if (sh.back > 0) sh.back = Math.max(0, sh.back - dt * 4);
    if (m.rinse > 0) m.rinse -= dt;

    // particles
    const P = S.parts, seated = m.pose === 'sit' && m.layer === 'in';
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.age += dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; let dead = q.age > q.life;
      if (q.k === 'bub') { if (q.jet) q.vx *= Math.exp(-dt * 1.8); if (!w8 || q.y < wyAt(q.x) + 1) dead = true; q.x = clamp(q.x, IX0 + 1, IX1 - 1); }
      else if (q.k === 'air') { q.x += Math.sin(S.t * 3 + q.ph) * 8 * dt; }
      else if (q.k === 'drop' && q.floor) { if (q.vy > 0 && q.y >= q.floor) { puddle(q.x, q.floor, 0.9); dead = true; } }
      else if (q.k === 'drop' && q.in) { if (q.vy > 0 && q.y > (w8 ? wyAt(q.x) : 55)) dead = true; }
      else if (q.k === 'goo') { if (q.y > (w8 ? wyAt(q.x) : 55)) { dead = true; if (w8 && Math.random() < 0.3) part({ k: 'bub', x: q.x, y: q.y + 2, vy: -12, life: 0.6, in: true }); } }
      else if (q.k === 'spill') { q.vy = Math.min(q.vy, 34); if (q.y >= q.floor) { dead = true; if (S.ffoam.length < 70) S.ffoam.push({ x: q.x + rnd(-2, 2), y: q.floor, r: q.r + 1, life: rnd(9, 15) }); } }
      else if (q.k === 'spray') {
        const inTub = q.x > IX0 && q.x < IX1;
        if (seated && Math.abs(q.x - m.x) < 12 && q.y > headTop() && q.y < headTop() + 30) {
          dead = true; m.rinse = 0.3; if (Math.random() < 0.25) part({ k: 'drop', x: q.x, y: q.y, vx: rnd(-30, 30), vy: rnd(-40, -10), g: 300, life: 0.5 });
          if ((m.hat || m.beard) && (S.rinseAcc = (S.rinseAcc || 0) + 1) > 34) { S.rinseAcc = 0; if (m.hat > 1) m.hat--; else if (m.beard) m.beard = 0; else m.hat = 0; sfx('chip_pop', { vol: 0.4 }); for (let k = 0; k < 4; k++) airBubble(m.x + rnd(-9, 9), headTop() + rnd(0, 16)); if (!m.hat && !m.beard) { sparkle(m.x, headTop() + 8, 8, 10); talk('m_wash', 2); } }
          if (every('rg', 5)) giggle();
        } else if (inTub && q.y > Math.min(55, w8 ? wyAt(q.x) : 55)) {
          dead = true; const ci = col(q.x); F[ci] = Math.max(0, F[ci] - 0.5); if (F[ci + 1] !== undefined) F[ci + 1] = Math.max(0, F[ci + 1] - 0.3);
          S.L = Math.min(1, S.L + 0.0006); if (Math.random() < 0.2) part({ k: 'drop', x: q.x, y: q.y - 1, vx: rnd(-20, 20), vy: rnd(-40, -15), g: 300, life: 0.5, in: true });
          for (const o of S.toys) if (o.st === 'free' && Math.abs(o.x - q.x) < 9) o.vy += 14;
        } else if (!inTub && q.y > FLOOR + 5 + ((q.x * 7) % 9)) { dead = true; if (Math.random() < 0.12) puddle(q.x, FLOOR + 4 + ((q.x * 7) % 9), 0.5); }
      }
      if (dead) P.splice(i, 1);
    }

    // a held toy pushed under the water blows bubbles
    for (const o of S.toys) if (o.st === 'held' && o.sub && Math.random() < 0.5) part({ k: 'bub', x: o.x + rnd(-6, 6), y: o.y, vy: rnd(-40, -20), life: 1, in: true });

    if (S.phase === 'play') S.idle += dt;
  }

  // ====================================================================== drawing
  function draw() {
    const c = S.c, M = S.M, m = S.m, t = S.t; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.globalAlpha = 1;
    const bg = img(M.bg); if (ok(bg)) c.drawImage(bg, -S.vx, -S.vy); else { c.fillStyle = '#6aa99a'; c.fillRect(0, 0, S.LW, S.LH); }
    c.translate(M.tx - S.vx, M.ty - S.vy);                        // tub space from here on
    const tub = img('tub'), pr = img('props');
    // shadow under the tub
    c.fillStyle = 'rgba(40,30,20,.16)'; c.fillRect(3, FLOOR + 2, 136, 2); c.fillRect(6, FLOOR + 4, 130, 1);
    for (const p of S.puddles) drawPuddle(c, p);
    drawBasket(c, pr); drawBottle(c, pr, false); if (!S.shower.held) drawShower(c, pr);
    if (ok(tub)) c.drawImage(tub, 0, 0);
    // --- everything inside the tub hides behind the front rim
    c.save(); c.beginPath(); c.rect(-60, -120, 320, 120 + FRONT); c.clip();
    drawLights(c);
    if (S.tap) drawStream(c);
    if (m.layer === 'in') drawMarina(c);
    for (const o of S.toys) if (o.st === 'head') drawToy(c, pr, o);
    for (const o of S.toys) if (o.st === 'free' || (o.st === 'held' && o.sub)) drawToy(c, pr, o);
    drawWater(c); drawJetStreams(c); drawParts(c, q => q.in && q.k === 'bub'); drawFoam(c);
    for (const o of S.toys) if (o.st === 'free') { c.save(); c.beginPath(); c.rect(o.x - 20, -120, 40, 120 + Math.min(FRONT, wyAt(o.x) + 1)); c.clip(); drawToy(c, pr, o); c.restore(); }   // toys bob in front of the suds, not behind them
    drawParts(c, q => q.in && q.k !== 'bub');
    c.restore();
    drawDoor(c, tub); drawJets(c);
    for (const f of S.ffoam) { disc(c, f.x, f.y, f.r + 1, '#b9d6ec'); }
    for (const f of S.ffoam) { disc(c, f.x, f.y - 1, f.r, '#ffffff'); }
    drawParts(c, q => !q.in && q.k === 'spill');
    if (S.phase === 'suit' && S.suit) drawGo(c);
    if (m.layer === 'out') drawMarina(c);
    for (const o of S.toys) if (o.st === 'fly' || (o.st === 'held' && !o.sub)) drawToy(c, pr, o);
    if (S.bottle.t >= 0) drawBottle(c, pr, true);
    if (S.shower.held) drawShower(c, pr);
    drawParts(c, q => !q.in && q.k !== 'spill');
    if (S.jets[2] && wet()) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `hsla(${hue()},90%,55%,.07)`; c.fillRect(-140, -200, 480, 420); c.globalCompositeOperation = 'source-over'; }
    drawHints(c);
    // --- screen space: swimsuit cards and the all-done button
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (S.phase === 'suit' || (S.phase === 'enter' && S.pt < 0.35)) drawCards(c);
    if (S.phase === 'play') drawDone(c);
  }

  function drawPuddle(c, p) {
    const r = R(p.r), x = R(p.x), y = R(p.y); if (r < 2) return;
    box(c, x - r, y, r * 2, 1, 'rgba(120,200,245,.8)'); box(c, x - r + 1, y - 1, r * 2 - 2, 1, 'rgba(150,215,250,.8)'); box(c, x - r + 1, y + 1, r * 2 - 2, 1, 'rgba(80,160,220,.75)');
    if (r > 3) { box(c, x - r + 3, y + 2, r * 2 - 6, 1, 'rgba(80,160,220,.65)'); box(c, x - r + 2, y - 1, Math.max(1, r - 2), 1, 'rgba(255,255,255,.9)'); }
  }
  function sprite(c, pr, k, x, y) { const r = PR[k]; if (ok(pr)) c.drawImage(pr, r[0], r[1], r[2], r[3], R(x), R(y), r[2], r[3]); }
  function drawBasket(c, pr) {
    const [bx, by] = S.M.basket, bump = S.basketBump > 0 ? -R(Math.sin(S.basketBump / 0.3 * Math.PI) * 2) : 0;
    c.fillStyle = 'rgba(40,30,20,.18)'; c.fillRect(bx + 6, by + 30, 32, 2);
    sprite(c, pr, 'basket', bx, by + bump);
    // the toys still waiting stick out of the top (the next one to come out is in front, wiggling)
    c.save(); c.beginPath(); c.rect(bx + 5, by - 30, 34, 30 + 11 + bump); c.clip();
    const show = S.left.slice(0, 3);
    for (let i = show.length - 1; i >= 0; i--) { const r = PR[show[i]]; if (ok(pr)) c.drawImage(pr, r[0], r[1], r[2], r[3], bx + 22 - (r[2] >> 1) + [0, -10, 9][i], by - 9 + [0, 4, 5][i] + bump + (i === 0 ? R(Math.sin(S.t * 3)) : 0), r[2], r[3]); }
    c.restore();
  }
  function drawBottle(c, pr, flying) {
    const b = S.bottle, [bx, by] = S.M.bottle;
    if (!flying) { if (b.t < 0) { sprite(c, pr, 'bottle', bx, by); } return; }
    const u = b.t < 0.4 ? ease(b.t / 0.4) : b.t < 1.05 ? 1 : 1 - ease((b.t - 1.05) / 0.45);
    const x = lerp(bx + 8, 92, u), y = lerp(by + 11, -8, u) - Math.sin(u * Math.PI) * 6, a = -2.25 * u + (b.t > 0.4 && b.t < 1.05 ? Math.sin(b.t * 30) * 0.08 : 0);
    c.save(); c.translate(R(x), R(y)); c.rotate(a); const r = PR.bottle; if (ok(pr)) c.drawImage(pr, r[0], r[1], r[2], r[3], -8, -11, r[2], r[3]); c.restore();
  }
  function hose(c, x0, y0, x1, y1, sag) {
    const n = Math.max(8, (Math.hypot(x1 - x0, y1 - y0) / 1.5) | 0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
    for (let i = 0; i <= n; i++) { const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u, x = a * x0 + b * mx + d * x1, y = a * y0 + b * my + d * y1; box(c, x, y, 2, 2, i % 3 ? '#8f98a8' : '#c9d0da'); }
  }
  function drawShower(c, pr) {
    const sh = S.shower, [hx, hy] = S.M.hook; let x = hx - 11, y = hy - 9;
    if (sh.held) { x = sh.x - 10; y = sh.y - 24; } else if (sh.back > 0) { const u = ease(sh.back); x = lerp(x, sh.fx - 10, u); y = lerp(y, sh.fy - 24, u); }
    const ex = x + 19, ey = y + 24, d = Math.hypot(ex - 134, ey - 22);
    hose(c, 134, 22, ex, ey, clamp(40 - d * 0.35, 4, 34));
    sprite(c, pr, 'shower', x, y);
  }
  function drawStream(c) {
    const x = SPOUT[0] - 2, y0 = SPOUT[1], y1 = Math.min(55, wet() ? wyAt(SPOUT[0]) : 55), t = S.t;
    box(c, x, y0, 4, Math.max(1, R(y1 - y0)), '#9fdcff'); box(c, x + 1, y0, 1, Math.max(1, R(y1 - y0)), '#d6f2ff');
    for (let y = y0 + ((t * 60) % 6); y < y1 - 1; y += 6) box(c, x + 2, y, 1, 3, '#ffffff');
    box(c, x - 1, y1 - 2, 6, 2, '#d6f2ff');
  }
  function drawLights(c) {
    if (!S.jets[2] || !wet()) return;
    nozzles(2).forEach(([x, y], i) => { if (y < wyAt(x)) return; const h = hue(i * 40); disc(c, x, y, 7, `hsla(${h},95%,65%,.35)`); disc(c, x, y, 4, `hsla(${h},95%,75%,.6)`); disc(c, x, y, 2, '#ffffff'); });
  }
  function drawJetStreams(c) {      // whirlpool jets: white streaks shooting out of the side nozzles
    if (!S.jets[0] || !wet()) return;
    for (const [x, y] of nozzles(0)) {
      if (y < wyAt(x) + 1) continue; const dir = x < 70 ? 1 : -1;
      for (let k = 0; k < 4; k++) { const d = 2 + ((S.t * 80 + k * 10 + y * 3) % 40), far = d > 24; box(c, x + dir * d - (dir < 0 ? 5 : 0), y + (k % 3) - 1, far ? 3 : 6, 1, far ? 'rgba(255,255,255,.5)' : '#ffffff'); }
    }
  }
  const hue = d => ((((S.hue + (d || 0)) % 360) / 6) | 0) * 6;
  function waterCol(a, light) { return S.jets[2] ? `hsla(${hue()},88%,${light || 60}%,${a})` : `rgba(${light ? '150,215,250' : '74,170,235'},${a})`; }
  function drawWater(c) {
    if (S.L <= 0.004) return;
    const t = S.t, lit = S.jets[2];
    c.fillStyle = waterCol(lit ? 0.5 : 0.46);
    const ys = [];
    for (let x = IX0; x < IX1; x++) { const y = Math.min(FRONT, wyAt(x)); ys.push(y); const yy = R(y); if (yy < FRONT) c.fillRect(x, yy, 1, FRONT - yy); }
    c.fillStyle = waterCol(0.22); for (let x = IX0; x < IX1; x++) { const yy = R(ys[x - IX0]) + 5; if (yy < FRONT) c.fillRect(x, yy, 1, FRONT - yy); }     // deeper = bluer
    c.fillStyle = 'rgba(255,255,255,.85)'; for (let x = IX0; x < IX1; x++) { const yy = R(ys[x - IX0]); if (yy < FRONT) c.fillRect(x, yy, 1, 1); }
    c.fillStyle = waterCol(0.55, 82); for (let x = IX0; x < IX1; x++) { const yy = R(ys[x - IX0]) + 1; if (yy < FRONT) c.fillRect(x, yy, 1, 1); }
    c.fillStyle = 'rgba(255,255,255,.35)';                                  // little glints sliding along under the surface
    for (let i = 0; i < 5; i++) { const x = IX0 + ((i * 29 + t * (7 + i * 2)) % (IX1 - IX0 - 8)), y = ys[x | 0] + 5 + (i * 5) % 12; if (y < FRONT - 1) c.fillRect(R(x), R(y), 5 - (i % 2) * 2, 1); }
    if (S.phase === 'drain' && S.L > 0.02) {                                // the whirl over the plug hole
      const y = wyAt(DRAIN);
      for (let k = 0; k < 18; k++) { const a = t * 11 - k * 0.55, rr = 1 + k * 0.62; box(c, DRAIN + Math.cos(a) * rr * 1.7, y + 2 + Math.sin(a) * rr * 0.42, k > 9 ? 2 : 1, 1, k % 3 ? '#ffffff' : 'rgba(255,255,255,.6)'); }
      for (let yy = y + 3; yy < FRONT; yy += 2) box(c, DRAIN + Math.sin(yy * 0.9 + t * 14) * 1.5, yy, 1, 2, 'rgba(255,255,255,.75)');       // the twisting funnel going down the plug hole
    }
  }
  function drawFoam(c) {
    const F = S.foam; let any = false; for (let i = 0; i < NF; i++) if (F[i] > 0.7) { any = true; break; } if (!any) return;
    c.save(); c.beginPath(); c.rect(IX0, -140, IX1 - IX0, 140 + FRONT); c.clip();
    const tint = S.jets[2] ? `hsl(${hue()},70%,82%)` : '#b9d6ec', L = [];
    for (let i = 0; i < NF; i++) {
      const h = F[i]; if (h < 0.7) continue; const x = IX0 + 1 + i * 2, base = wyAt(x), n = Math.max(1, Math.ceil(h / 3.4));
      for (let j = 0; j < n; j++) { const r = 2 + ((i * 7 + j * 3) % 3 === 0 ? 1 : 0) + (h > 9 && j < n - 1 ? 1 : 0); L.push(x + ((i * 13 + j * 7) % 3) - 1, base - Math.min(h, j * 3.4 + 0.6) + 1, r); }
    }
    for (let k = 0; k < L.length; k += 3) disc(c, L[k], L[k + 1], L[k + 2] + 1, tint);
    for (let k = 0; k < L.length; k += 3) disc(c, L[k], L[k + 1] - 1, L[k + 2], '#ffffff');
    for (let k = 0; k < L.length; k += 15) { box(c, L[k] + 1, L[k + 1] - 1, 1, 1, k % 2 ? '#ffc9e6' : '#a9e4ff'); }
    c.restore();
  }
  function drawParts(c, want) {
    for (const q of S.parts) {
      if (!want(q)) continue; const x = q.x, y = q.y, f = 1 - q.age / q.life;
      if (q.k === 'drop') box(c, x, y, 1, q.vy > 60 ? 2 : 1, q.col || '#c9ecff');
      else if (q.k === 'spray') box(c, x, y, 1, 2, (q.x * 3 | 0) % 2 ? '#c9ecff' : '#8fd0f5');
      else if (q.k === 'goo') box(c, x, y, 2, 2, q.col);
      else if (q.k === 'bub') { if (q.r === 2) { box(c, x, y, 2, 2, 'rgba(255,255,255,.8)'); } else box(c, x, y, 1, 1, 'rgba(255,255,255,.9)'); }
      else if (q.k === 'air') { const r = q.r; if (r <= 1) { box(c, x, y, 2, 2, 'rgba(255,255,255,.85)'); } else { disc(c, x, y, r, 'rgba(190,230,255,.45)'); box(c, x - 1, y - r + 1, 1, 1, '#ffffff'); box(c, x - r, y, 1, 1, 'rgba(255,255,255,.9)'); box(c, x + r, y, 1, 1, 'rgba(255,255,255,.6)'); box(c, x, y + r, 1, 1, 'rgba(255,170,220,.8)'); } }
      else if (q.k === 'star') { if (q.big && f > 0.45) bmp(c, ICON.bigstar, x - 3, y - 3, { '#': q.col }); else if (f > 0.3) bmp(c, ICON.star, x - 2, y - 2, { '#': q.col }); else box(c, x, y, 1, 1, q.col); }
      else if (q.k === 'heart') bmp(c, ICON.heart, x - 2, y - 2, { '#': q.col });
      else if (q.k === 'note') bmp(c, ICON.note, x - 2, y - 2, { '#': q.col });
      else if (q.k === 'puff') disc(c, x, y, f > 0.5 ? 2 : 1, 'rgba(255,255,255,.75)');
      else if (q.k === 'spill') { disc(c, x, y, q.r + 1, '#b9d6ec'); disc(c, x, y - 1, q.r, '#ffffff'); }
    }
  }
  function drawToy(c, pr, o) {
    const r = PR[o.k]; if (!ok(pr)) return;
    const sq = o.sq > 0 ? Math.sin(o.sq / 0.25 * Math.PI) : 0;
    c.save(); c.translate(R(o.x), R(o.y + sq * 2)); if (Math.abs(o.rock) > 0.03) c.rotate(o.rock);
    let sx = o.dir < 0 ? -1 : 1; if (o.spin > 0) sx *= Math.cos(o.spin * 12.6) >= 0 ? 1 : -1;
    c.scale(sx, 1); c.drawImage(pr, r[0], r[1], r[2], r[3], -(r[2] >> 1), -(r[3] >> 1), r[2], r[3]); c.restore();
  }
  function drawDoor(c, tub) {
    const o = S.door; if (o <= 0.02) return; const d = DOOR;
    box(c, d.x + 1, d.y + 2, d.w - 2, d.h - 2, '#8f9db3'); box(c, d.x + 3, d.y + 3, d.w - 5, d.h - 5, '#c3cfdf'); box(c, d.x + 3, d.y + d.h - 9, d.w - 5, 6, '#dfe7f1'); box(c, d.x + 3, d.y + 3, d.w - 5, 3, '#a9b7ca');
    const w = Math.max(6, R(d.w * (1 - o * 0.76))), x = d.x + d.w - w + R(o * 9), y = d.y + R(o * 3);
    if (ok(tub)) c.drawImage(tub, d.x, d.y, d.w, d.h, x, y, w, d.h);
    box(c, x - 1, y + 1, 1, d.h - 1, '#2a2d3f'); box(c, x + w, y + 1, 1, d.h - 1, '#2a2d3f'); box(c, x, y + d.h, w, 1, '#2a2d3f');
  }
  const JCOL = [['#2fb6e8', '#bdeeff'], ['#ffb22e', '#ffe9a6'], ['#f35fb5', '#ffd0ee']];
  function drawJets(c) {
    for (let i = 0; i < 3; i++) {
      const [x, y] = JET[i], on = S.jets[i], sp = S.sput[i] > 0, t = S.t, press = on ? 1 : 0;
      if (on) { const pulse = 12 + (Math.sin(t * 6 + i) > 0 ? 1 : 0); disc(c, x, y, pulse, i === 2 ? `hsla(${hue()},95%,70%,.55)` : JCOL[i][1]); }
      disc(c, x, y + 1, 10, '#7f8aa3'); disc(c, x, y + press - 1, 10, '#2a2d3f'); disc(c, x, y + press - 1, 9, on ? JCOL[i][0] : sp && Math.sin(t * 40) > 0 ? '#ffd9d9' : '#ffffff');
      if (!on) disc(c, x, y + press, 7, '#e8edf4'); else disc(c, x - 3, y + press - 5, 2, 'rgba(255,255,255,.6)');
      const ic = ICON[JNAME[i]], ix = x - 5, iy = y + press - (i === 2 ? 4 : 6);
      if (i === 2) bmp(c, ic, ix, iy, on ? { r: '#fff', y: '#ffe36b', g: '#fff', b: '#ffe36b' } : { r: '#ee4b5a', y: '#f6b529', g: '#3cba6a', b: '#3d8fe6' });
      else bmp(c, ic, ix, iy, { '#': on ? '#ffffff' : JCOL[i][0] });
    }
  }
  function drawGo(c) {
    const [x, y0] = S.M.go, t = S.t, y = y0 - Math.abs(Math.sin(t * 4)) * 4;
    disc(c, x, y0 + 2, 12 + (Math.sin(t * 4) > 0.3 ? 2 : 0), 'rgba(255,255,255,.35)');
    disc(c, x, y + 2, 12, '#2c7a3d'); disc(c, x, y, 12, '#1f5a2c'); disc(c, x, y, 11, '#5fd06f'); disc(c, x - 3, y - 4, 3, '#9cea9f');
    bmp(c, ICON.up, x - 5, y - 5, { '#': '#ffffff' });
  }
  function drawHints(c) {
    if (S.phase !== 'play') return; const st = S.stats, t = S.t, M = S.M; let at = null;
    if (S.hintTap > 0) at = [119, -4, 119, 10];
    else if (S.idle > 2.5) {
      if (!st.tap && S.L < 0.2) at = [119, -4, 119, 10];
      else if (S.L > 0.25 && !st.bubbles) at = [M.bottle[0] + 8, M.bottle[1] - 2, M.bottle[0] + 8, M.bottle[1] + 11];
      else if (S.L > 0.25 && !st.jets.size) at = [JET[1][0], 62, JET[1][0], 75];
      else if (!st.toys.size) at = [M.basket[0] + 22, M.basket[1] - 10, M.basket[0] + 22, M.basket[1] + 12];
      else if (S.m.hat && !st.shower && S.over <= 0 && S.idle > 5) at = [M.hook[0] - 2, M.hook[1] - 12, M.hook[0] - 1, M.hook[1] + 3];
    }
    if (!at) return; const y = at[1] - 17 - Math.abs(Math.sin(t * 5)) * 5, rr = 13 + ((t * 9) % 6);
    ring(c, at[2], at[3], rr, 'rgba(255,255,255,' + (0.9 - (rr - 13) / 7).toFixed(2) + ')'); ring(c, at[2], at[3], rr + 1, 'rgba(255,214,62,' + (0.9 - (rr - 13) / 7).toFixed(2) + ')');
    bmp(c, ICON.hint, at[0] - 6, y, { '#': '#5a3b00', o: '#ffd23e', w: '#fff3b0' });
  }
  function drawCards(c) {
    const t = S.cardT, out = S.phase === 'enter' ? S.pt / 0.35 : 0, sp = img('marina'); if (!ok(sp)) return;
    for (const cd of cards()) {
      const u = clamp((t - cd.i * 0.07) / 0.35, 0, 1), drop = (1 - ease(u)) * -(cd.y + cd.h + 6) - out * (cd.y + cd.h + 10), sel = S.suit === cd.name;
      const x = cd.x + (S.cardShake > 0 ? R(Math.sin(S.t * 50 + cd.i) * 2) : 0), y = R(cd.y + drop + (sel ? -1 : Math.sin(S.t * 2 + cd.i * 1.3) * 0.8));
      rbox(c, x + 1, y + 3, cd.w, cd.h, 'rgba(30,22,50,.35)');
      if (sel) { rbox(c, x - 2, y - 2, cd.w + 4, cd.h + 4, '#ffffff'); rbox(c, x - 1, y - 1, cd.w + 2, cd.h + 2, '#ffb400'); } else rbox(c, x, y, cd.w, cd.h, '#3a2f57');
      rbox(c, x + 1, y + 1, cd.w - 2, cd.h - 2, '#ffffff'); rbox(c, x + 2, y + 2, cd.w - 4, cd.h - 4, cd.bg);
      const im = img('suit_' + cd.name), sh = cd.h - 4, sy = cd.h < 48 ? 11 : 7;
      c.save(); c.beginPath(); c.rect(x + 2, y + 2, cd.w - 4, cd.h - 4); c.clip(); c.drawImage(ok(im) ? im : sp, 14, sy, 36, sh, x + R((cd.w - 36) / 2), y + 2, 36, sh); c.restore();
      if (sel) { disc(c, x + cd.w - 6, y + 6, 6, '#ffffff'); disc(c, x + cd.w - 6, y + 6, 5, '#3cba6a'); bmp(c, ['....#', '#..#.', '.##..'], x + cd.w - 9, y + 5, { '#': '#ffffff' }); if (Math.sin(S.t * 7) > 0.6) bmp(c, ICON.star, x + 3, y + 3, { '#': '#ffffff' }); }
    }
  }
  function drawDone(c) {
    const [x, y0] = doneAt(), p = S.donePress ? 2 : 0, y = y0 + p, t = S.t;
    if (S.idle > 14 && Math.sin(t * 4) > 0) disc(c, x, y0, 16, 'rgba(255,255,255,.4)');
    disc(c, x, y0 + 3, 14, 'rgba(30,22,50,.35)'); disc(c, x, y, 14, '#ffffff'); disc(c, x, y, 13, '#1f5a2c'); disc(c, x, y, 12, S.donePress ? '#48b95a' : '#5fd06f'); disc(c, x - 4, y - 5, 3, '#9cea9f');
    bmp(c, ICON.check, x - 6, y - 4, { '#': '#ffffff' });
  }

  // ---- Marina. Sprite space: her 64x64 picture, feet on row 62, middle at column 32.
  const SKIN = '#fce2ce', SHADE = '#e6ba8f', INK = '#6b4030', LASH = '#54302a';
  function drawMarina(c) {
    const m = S.m, im = img(m.sprite), base = img('marina'); if (!ok(im) && !ok(base)) return; const src = ok(im) ? im : base;
    let sx = m.flip ? -1 : 1; if (m.twirl > 0) { const k = Math.cos((1 - m.twirl / 0.75) * Math.PI * 4); sx = Math.abs(k) < 0.18 ? 0.18 * (k < 0 ? -1 : 1) : k; }
    const lift = m.twirl > 0 ? -Math.sin((1 - m.twirl / 0.75) * Math.PI) * 6 : 0;
    c.save(); c.translate(R(m.x), R(m.y + m.oy + lift) - 62); c.scale(sx, 1); c.translate(-32, 0);
    if (m.layer === 'out') { c.fillStyle = 'rgba(40,30,20,.2)'; c.fillRect(22, 62 - R(m.oy + lift), 20, 2); }
    if (m.pose === 'sit') {
      // her legs, bent over the edge of the seat (the rest of her is the picture, cut off at the hips)
      box(c, 35, 41, 13, 5, INK); box(c, 36, 42, 11, 3, SHADE); box(c, 44, 44, 6, 11, INK); box(c, 45, 45, 4, 9, SHADE); box(c, 44, 53, 9, 4, INK); box(c, 45, 54, 7, 2, SHADE);
      box(c, 31, 43, 13, 6, INK); box(c, 32, 44, 11, 4, SKIN); box(c, 40, 46, 6, 11, INK); box(c, 41, 47, 4, 9, SKIN); box(c, 40, 55, 9, 4, INK); box(c, 41, 56, 7, 2, SKIN); box(c, 41, 47, 1, 8, SHADE);
      c.drawImage(src, 0, 0, 64, 47, 0, 0, 64, 47);
    } else c.drawImage(src, 0, 0);
    // eyes: blink, squint under the shower, look towards what was touched, happy ^ ^
    const f = m.face, shut = m.blink > 0 || m.rinse > 0;
    if (f === 'happy' || shut) {
      box(c, 31, 20, 5, 4, SKIN); box(c, 40, 20, 4, 4, SKIN);
      if (f === 'happy') { box(c, 31, 22, 1, 1, LASH); box(c, 32, 21, 3, 1, LASH); box(c, 35, 22, 1, 1, LASH); box(c, 40, 22, 1, 1, LASH); box(c, 41, 21, 2, 1, LASH); box(c, 43, 22, 1, 1, LASH); }
      else { box(c, 31, 22, 5, 1, LASH); box(c, 40, 22, 4, 1, LASH); }
    } else if (m.look[0] || m.look[1]) {
      const dx = m.look[0], dy = m.look[1];
      box(c, 31, 20, 5, 4, '#f4f2f6'); box(c, 40, 20, 4, 4, '#f4f2f6');
      const ex = clamp(32 + dx * 2, 31, 34), ey = clamp(20 + dy, 20, 21); box(c, ex, ey, 2, 2, '#1a1414'); box(c, ex, ey + 2, 2, 1, '#84b6f1');
      const fx = clamp(41 + dx, 40, 42); box(c, fx, ey, 2, 2, '#1a1414'); box(c, fx, ey + 2, 2, 1, '#84b6f1');
    }
    if (f === 'happy') { box(c, 35, 27, 4, 2, '#7a1e2c'); box(c, 36, 28, 2, 1, '#f07a86'); }
    else if (f === 'wow') { box(c, 36, 27, 2, 3, '#7a1e2c'); }
    // foam hat / beard
    if (m.beard) { for (const [x, y, r] of [[33, 30, 2], [36, 32, 3], [40, 31, 2], [30, 28, 2]]) disc(c, x, y, r + 1, '#b9d6ec'); for (const [x, y, r] of [[33, 30, 2], [36, 32, 3], [40, 31, 2], [30, 28, 2]]) disc(c, x, y - 1, r, '#ffffff'); }
    if (m.hat) {
      const blobs = [[22, 9, 3], [27, 6, 4], [33, 5, 4], [38, 6, 4], [42, 9, 3]];
      if (m.hat >= 2) blobs.push([30, 2, 4], [36, 2, 3]);
      if (m.hat >= 3) blobs.push([32, -2, 4], [34, -6, 3], [32, -10, 3], [34, -13, 2]);
      for (const [x, y, r] of blobs) disc(c, x, y, r + 1, '#b9d6ec'); for (const [x, y, r] of blobs) disc(c, x, y - 1, r, '#ffffff');
      box(c, 28, 4, 1, 1, '#ffc9e6'); box(c, 37, 5, 1, 1, '#a9e4ff');
    }
    c.restore();
    // a thought when she has no water: a little water drop
    if (m.shrug > 0) { const x = R(m.x) + 10, y = R(m.y + m.oy) - 74; disc(c, x, y, 8, '#3a2f57'); disc(c, x, y, 7, '#ffffff'); disc(c, x - 7, y + 9, 2, '#ffffff'); bmp(c, ICON.drop, x - 2, y - 4, { '#': '#49b4f2' }); box(c, x - 6, y - 1, 12, 2, '#ee4b5a'); }
  }

  window.Spa = { open, close: () => close(), _state: () => S };   // _state is only for tests
})();
