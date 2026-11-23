// Chef Marina — backyard life. Now and then a family of deer (a doe, a young buck and two spotted fawns) comes out of
// the woods for a little visit; in between there is small life: a squirrel, robins, butterflies or fireflies, drifting
// leaves, a rabbit and a chipmunk at the workbench. Nothing here needs reading and nothing blocks Marina: you look, you
// tap, something small and nice happens.
// Art: assets/wild/wild.png + wild.json  (f = frames [sx,sy,w,h,dx,dy] drawn from the animal's feet, a = animations).
(function () {
  const ROOM = 'backyard', NOP = () => { };
  const warned = {}, safe = (f, tag) => { try { return f(); } catch (e) { if (!warned[tag]) { warned[tag] = 1; console.warn('wildlife ' + tag, e); } } };   // a slip here must never stop the game's own loop
  const hid = id => { const n = document.getElementById(id); return !n || n.classList.contains('hidden'); };
  const sgn = v => (v < 0 ? -1 : 1), lerp = (a, b, k) => a + (b - a) * k;
  const BY = () => window.Backyard || { bench: 232, plots: [], trees: [{ x: 772, trunk: 34 }, { x: 978, trunk: 26 }] };
  const LX = 176, RX = 1012;                                   // the deer keep to the lawn between the house and the far end

  // ---------------------------------------------------------------- art
  const ART = { img: new Image(), f: null, a: null, ok: false };
  fetch('assets/wild/wild.json').then(r => r.json()).then(j => { ART.f = j.f; ART.a = j.a; ART.img.onload = () => { ART.ok = true; }; ART.img.src = 'assets/wild/wild.png'; }).catch(e => console.warn('wildlife art', e));
  function put(n, x, y, o) {
    const f = ART.f[n]; if (!f) return; o = o || {};
    const c = E.ctx, s = (o.s || 1) * (o.depth || E.depth || 1);
    c.save(); c.translate(Math.round(x - E.camX), Math.round(y)); if (o.rot) c.rotate(o.rot); c.scale(o.flip ? -s : s, s);
    if (o.alpha != null && o.alpha < 1) c.globalAlpha = Math.max(0, o.alpha);
    c.drawImage(ART.img, f[0], f[1], f[2], f[3], f[4], f[5], f[2], f[3]); c.restore();
  }
  // which picture of an animation to show: looping, or played once and held on its last picture ('hold'), optionally backwards
  function frame(kind, an, t, fps, mode, rev) {
    const A = ART.a[kind], fr = (A && (A[an] || A.stand || A.sit || A.still)) || [0], n = fr.length;
    let i = Math.floor(Math.max(0, t) * (fps || 8)); i = mode === 'hold' ? Math.min(n - 1, i) : i % n; return fr[rev ? n - 1 - i : i];
  }
  const count = (kind, an) => ((ART.a[kind] || {})[an] || [0]).length;
  const onScreen = (x, m) => x > E.camX - (m || 0) && x < E.camX + E.viewW + (m || 0);
  function lit(g, draw) {                                      // the same soft glow the game puts on things she can use
    if (g <= 0.02) return draw(); const c = E.ctx; c.save();
    c.shadowColor = 'rgba(255,236,150,' + (g * (0.8 + Math.sin(E.t * 4) * 0.2)).toFixed(3) + ')'; c.shadowBlur = E.scale * 4.5; c.shadowOffsetX = c.shadowOffsetY = 0; draw(); c.restore();
  }

  // ---------------------------------------------------------------- sounds: all tiny and soft
  const snd = {
    hoof(d) { if (!onScreen(d.x, 30)) return; Audio2.noise(0.03, d.fawn ? 0.03 : 0.045, 1700); Audio2.blip(d.fawn ? -19 : -25, 'sine', 0.05, 0.045); },
    bleat(d) { if (!onScreen(d.x, 60)) return; const n = d.fawn ? 13 + (d.kind === 'fawnb' ? 2 : 0) : d.kind === 'doe' ? 6 : 1; Audio2.blip(n, 'triangle', 0.09, 0.06); setTimeout(() => Audio2.blip(n - 2, 'triangle', 0.17, 0.05), 85); },
    rustle() { Audio2.noise(0.22, 0.05, 2600); setTimeout(() => Audio2.noise(0.15, 0.04, 3000), 140); },
    snap() { Audio2.noise(0.05, 0.16, 900); Audio2.blip(-10, 'square', 0.03, 0.05); },
    sniff() { Audio2.noise(0.05, 0.03, 3500); setTimeout(() => Audio2.noise(0.05, 0.03, 3500), 130); },
    crunch() { try { Audio2.sfx('eat_chomp', { vol: 0.5 }); } catch (e) { } Audio2.noise(0.06, 0.07, 1200); },
    chirp() { [28, 31, 28, 33].forEach((n, i) => setTimeout(() => Audio2.blip(n, 'sine', 0.06, 0.05), i * 55)); },
    squeak() { Audio2.blip(30, 'sine', 0.05, 0.05); setTimeout(() => Audio2.blip(34, 'sine', 0.05, 0.05), 70); },
    thump() { Audio2.blip(-22, 'sine', 0.07, 0.09); },
    scratch() { Audio2.noise(0.09, 0.045, 1400); },
  };

  // ---------------------------------------------------------------- the thickets at the edge of the woods (the animals' doorways)
  const GATES = [296, 404, 512, 622, 744, 806, 946].map((x, i) => ({ x, y: 142, hw: 34, bh: i % 2 ? 36 : 31, shake: 0, alt: i % 2 }));
  const peek = (d, g, show) => d.h * 0.9 - (g.bh - 1) - show;   // how far to duck so that `show` pixels of the animal stick out above the bush
  function builtXs() {                                         // things Grandpa Jeff has built (if the builder is there): where they stand
    const out = []; try { const l = window.Builder && Builder.list && Builder.list(); for (const it of l || []) { const p = BY().plots.find(q => q.id === (it.plot || it.spot || it.id)); const x = typeof it.x === 'number' ? it.x : p ? p.x : null; if (x != null) out.push(x); } } catch (e) { }
    return out;
  }
  const freeGates = () => { const b = builtXs(); return GATES.filter(g => !b.some(x => Math.abs(x - g.x) < 58)); };
  const nearGate = (x, list) => (list || freeGates().concat(GATES)).reduce((a, g) => (!a || Math.abs(g.x - x) < Math.abs(a.x - x) - 1 ? g : a), null);
  function drawGate(g) {
    const r = g.shake > 0 ? Math.sin(E.t * 34) * 0.05 * g.shake : 0;
    put(ART.a[g.alt ? 'thicket1' : 'thicket2'].still[0], g.x + (g.alt ? 20 : -18), g.y - 1, { s: g.alt ? 0.95 : 1.2, depth: 1, flip: !g.alt, rot: -r });
    put(ART.a[g.alt ? 'thicket2' : 'thicket1'].still[0], g.x, g.y, { s: g.alt ? 1.4 : 1.15, depth: 1, rot: r });
  }

  // ---------------------------------------------------------------- deer
  const KIND = { doe: { s: 1, hw: 21, h: 64 }, buck: { s: 1, hw: 24, h: 74 }, fawna: { s: 0.72, hw: 13, h: 34, fawn: true }, fawnb: { s: 0.68, hw: 12, h: 32, fawn: true } };
  const GAIT = { walk: ['walk', 9, 30], creep: ['walk', 5, 12], trot: ['walk', 15, 52], lope: ['run', 12, 104], run: ['run', 13, 128], bolt: ['run', 15, 165], pronk: ['pronk', 12, 92], sprint: ['run', 17, 178] };
  let hideBase = false;                                        // true while the game's own tap test runs (ours handles the animals)
  const ENTLIKE = { state: 'idle', moving: false, animT: 0, scale: 1, offY: 0, speed: 0, busy: true, stop: NOP, walkTo: NOP };   // enough like the game's own characters for code that walks the list of everybody
  function mkDeer(kind) {
    const d = { ...ENTLIKE, wild: 'deer', kind, id: 'wild_' + kind, room: ROOM, x: 0, y: 150, dir: 1, an: 'stand', at: 0, fps: 8, mode: 'loop', rev: false, q: [], cur: null, behind: false, sink: 0, sinkTo: 0, z: 0, rot: 0, alpha: 1, hidden: false, glow: 0, lastF: 0, update: NOP, ...KIND[kind] };
    Object.defineProperty(d, 'here', { get() { return this.room === G.room && !this.hidden && !this.behind && !hideBase; } }); return d;
  }
  const play = (d, an, o) => { o = o || {}; d.an = an; d.at = 0; d.fps = o.fps || 8; d.mode = o.mode || 'loop'; d.rev = !!o.rev; };
  const Q = (d, ...cmds) => { d.q.push(...cmds.flat()); return d; };
  const clear = d => { d.q.length = 0; d.cur = null; d.motion = null; d.z = 0; d.rot = 0; };
  const go = (x, y, gait, o) => ({ go: [clamp(x, 120, 1036), y], gait: gait || 'walk', ...(o || {}) });
  const act = (an, t, o) => ({ do: an, t, ...(o || {}) });
  const fn = f => ({ fn: f });
  const graze = t => [act('down', 0.34, { fps: 9, mode: 'hold' }), act('graze', t, { fps: 5 }), act('down', 0.3, { fps: 10, mode: 'hold', rev: true })];
  const face = (d, x) => { if (Math.abs(x - d.x) > 1) d.dir = sgn(x - d.x); };
  function stepDeer(d, dt) {
    d.at += dt; d.sink += clamp(d.sinkTo - d.sink, -70 * dt, 70 * dt);
    if (d.motion) { if (d.motion(d, dt) === false) { d.motion = null; play(d, 'stand'); } return; }
    let c = d.cur;
    if (!c) {
      c = d.cur = d.q.shift() || null; if (!c) { if (d.an !== 'stand' && !(d.mode === 'hold' && d.keep)) play(d, 'stand'); return; }
      d.keep = false;
      if (c.fn) { d.cur = null; c.fn(d); return; }
      if (c.go) { const g = GAIT[c.gait] || GAIT.walk, an = count(d.kind, g[0]) > 1 ? g[0] : 'run'; c.v = c.v || g[2] * (d.fawn && an === 'walk' ? 0.85 : 1); c.x0 = d.x; c.y0 = d.y; if (d.an !== an || d.mode !== 'loop') play(d, an, { fps: g[1] }); else d.fps = g[1]; d.lastF = 0; }
      else { if (c.face != null) face(d, typeof c.face === 'function' ? c.face() : c.face); if (c.do) play(d, c.do, c); d.keep = c.mode === 'hold'; }
    }
    if (c.go) {
      const dx = c.go[0] - d.x, dy = c.go[1] - d.y, dist = Math.hypot(dx, dy), s = c.v * dt;
      if (Math.abs(dx) > 0.6) d.dir = sgn(dx);
      if (c.arc) { const tot = Math.hypot(c.go[0] - c.x0, c.go[1] - c.y0) || 1; d.z = Math.sin(clamp(1 - dist / tot, 0, 1) * Math.PI) * c.arc; }
      if (dist <= s) { d.x = c.go[0]; d.y = c.go[1]; d.z = 0; d.cur = null; if (!d.fawn && !d.behind && narrow() && !(d.q[0] && (d.q[0].go || d.q[0].fn)) && Math.abs(d.x - marina.x) < 90) face(d, marina.x); }
      else { d.x += dx / dist * s; d.y += dy / dist * s; }
      if (d.an !== 'walk') { const f = Math.floor(d.at * d.fps / count(d.kind, d.an)); if (f !== d.lastF) { d.lastF = f; snd.hoof(d); } }   // one soft thud per bound
    } else if ((c.t -= dt) <= 0) d.cur = null;
  }
  const curFrame = d => frame(d.kind, d.an, d.at, d.fps, d.mode, d.rev);
  function drawDeer(d, back) {
    const y = d.y + d.sink - d.z;
    const near = V && !V.over && !back && typeof marina !== 'undefined' && !G.busy && Math.abs(d.x - marina.x) < 48; d.glow = clamp(d.glow + (near ? 0.08 : -0.06), 0, 1);
    lit(d.glow, () => put(curFrame(d), d.x, y, { s: d.s, flip: d.dir < 0, rot: d.rot, alpha: d.alpha, depth: back ? 0.9 : 0 }));
  }

  // ---------------------------------------------------------------- a visit: a little scene made of beats, different every time
  let V = null, next = -1, seenYard = false, lastRoom = null, awayT = 0, busyT = 0, stillT = 0, myBusy = 0;
  const narrow = () => E.viewW < 230;
  const fawns = () => V.deer.filter(d => d.fawn);
  const after = (sec, f) => V.timers.push({ t: V.t + sec, f });
  const mover = () => marina.mount || marina;
  function slots(cx) {                                         // where each one stands when the family settles around cx
    // upright phone: the picture is narrow, so they stand close together in depth, fawns nearest to Marina; sideways: spread out
    const n = narrow(), f = n ? sgn(cx - marina.x || 1) : V.flipS ? -1 : 1, o = n ? { fawna: [-20, 161], doe: [-2, 151], fawnb: [9, 166], buck: [8, 148] } : { doe: [-20, 151], buck: [30, 149], fawna: [-42, 160], fawnb: [6, 163] }, out = {};
    const tight = !n && E.viewW < 300 ? 0.8 : 1;                 // a small phone held sideways: a little closer together
    for (const k in o) { let x = clamp(cx + o[k][0] * f * tight, LX, RX); if (Math.abs(x - marina.x) < 15) x += 17 * sgn(x - marina.x || f); out[k] = [x, o[k][1]]; }
    return out;
  }
  function beside() {                                          // a spot for the family next to Marina, inside the lawn
    // her left is the clear side of the picture (the buttons live on the right), so that is where they settle when there is room
    const off = narrow() ? 46 : E.viewW < 300 ? 60 : 74; let s = -1, cx = marina.x + s * off;
    if (cx < LX + 34 || cx > RX - 30) { s = -s; cx = marina.x + s * off; } return clamp(cx, LX + 26, RX - 26);
  }
  // the bushes they come out of: near enough to see, but not right behind Marina
  const pickGate = () => { const list = freeGates(), half = E.viewW / 2 - 30; return (list.length ? list : GATES).reduce((a, g) => { const d = Math.abs(g.x - marina.x), sc = d < 34 ? 60 + (34 - d) : Math.abs(d - Math.min(60, half)); return !a || sc < a[1] ? [g, sc] : a; }, null)[0]; };
  function startVisit(kind) {
    if (V || !ART.ok || typeof marina === 'undefined' || G.room !== ROOM || !hid('title') || !hid('panel')) return false;
    const gate = pickGate(), cx = beside();
    V = { t: 0, len: rnd(26, 35), gate, cx, deer: ['doe', 'buck', 'fawna', 'fawnb'].map(mkDeer), timers: [], done: [], first: kind || null, phase: 'enter', wait: 0, lock: false, wary: 0, flipS: chance(0.5), wish: null, fed: [], over: false, friendT: rnd(9, 15), said: false, fx: {} };
    for (const d of V.deer) { d.hidden = true; ENTS.push(d); }
    for (const c of small.slice()) if (c.type === 'bird') c.flee(); else if (c.type === 'rabbit') c.hide && c.hide();
    enter(); return true;
  }
  function endVisit() {
    if (!V) return; for (const d of V.deer) { const i = ENTS.indexOf(d); if (i >= 0) ENTS.splice(i, 1); }
    if (myBusy) busy(false); hand.on = false; next = V.scared ? rnd(60, 100) : rnd(120, 240); V.over = true; V = null;
  }
  // --- coming out of the woods: ears and eyes first, then the doe steps out and looks, the fawns tumble out, the buck follows
  function enter() {
    const g = V.gate, s = sgn(V.cx - g.x || 1), sl = slots(V.cx), [doe, buck, fa, fb] = V.deer, out = g.hw + 24;
    const hide = (d, x) => { d.hidden = false; d.behind = true; d.x = g.x + x; d.y = g.y - 1; d.sink = d.sinkTo = peek(d, g, -8); d.dir = s; play(d, 'stand'); };
    const to = (d, gait) => { const p = sl[d.kind]; return go(p[0], p[1], Math.abs(p[0] - (g.x + s * out)) > 64 ? (gait === 'walk' ? 'trot' : gait) : gait); };
    const m = Math.abs(g.x - marina.x) < 40 ? sgn(g.x - marina.x || 1) : 0;   // she is standing right in front of these bushes: peep out beside her
    hide(doe, m ? m * 15 : -5 * s); doe.sinkTo = peek(doe, g, 15); play(doe, 'alert', { fps: 5, mode: 'hold' }); g.shake = 1; snd.rustle(); emit('leaf', g.x, g.y - 22, 4, { vx: rnd(-25, 25), vy: rnd(-45, -20), life: 1.4 });
    after(0.9, () => { hide(fa, m ? m * 31 : -25 * s); fa.sinkTo = peek(fa, g, 12); g.shake = 0.7; });                      // two pairs of big ears pop up... and down... and up
    after(1.3, () => { hide(fb, m ? -m * 3 : 19 * s); fb.sinkTo = peek(fb, g, 11); snd.rustle(); });
    after(1.9, () => { fa.sinkTo = peek(fa, g, -6); }); after(2.2, () => { fb.sinkTo = peek(fb, g, -6); fa.sinkTo = peek(fa, g, 13); });
    after(2.4, () => { doe.sinkTo = 0; g.shake = 1; snd.rustle(); Q(doe, act('stand', 0.55), go(g.x + s * out, g.y - 1, 'walk'), fn(d => { d.behind = false; }), to(doe, 'walk'), act('alert', 1.5, { fps: 7, mode: 'hold', face: () => marina.x }), fn(() => snd.bleat(doe)), act('look', 1.6, { fps: 5, mode: 'hold' })); });
    after(2.9, () => { fb.sinkTo = peek(fb, g, 12); }); after(3.5, () => { fa.sinkTo = fb.sinkTo = 0; });
    after(4.3, () => { g.shake = 1; Q(fa, go(g.x + s * out, g.y - 1, 'run'), fn(d => { d.behind = false; snd.bleat(d); }), to(fa, 'pronk'), act('alert', 1, { fps: 9, mode: 'hold', face: () => marina.x })); });
    after(4.9, () => { Q(fb, go(g.x + s * out, g.y - 1, 'run'), fn(d => { d.behind = false; }), go(lerp(g.x + s * out, sl.fawnb[0], 0.5), lerp(g.y, sl.fawnb[1], 0.5), 'run'),
      fn(d => { d.motion = tumble(d); emit('dust', d.x, d.y - 2, 5); Audio2.blip(20, 'triangle', 0.06, 0.05); }), to(fb, 'pronk'), act('wag', 1, { fps: 9 })); });
    after(5.6, () => { hide(buck, 4 * s); buck.sinkTo = 0; g.shake = 0.8; Q(buck, act('stand', 0.7), go(g.x + s * out, g.y - 1, 'walk'), fn(d => { d.behind = false; }), to(buck, 'walk'), act('alert', 1.4, { fps: 8, mode: 'hold' })); });
    after(3.6, notice);
    const settle = () => { if (V.t > 14 || V.deer.every(d => !d.hidden && !d.behind && !d.cur && !d.q.length && !d.motion)) { V.phase = 'beats'; nextBeat(); } else after(0.3, settle); };
    after(7.5, settle);
  }
  const tumble = () => { let k = 0; return (d, dt) => { k += dt / 0.55; d.rot = Math.sin(k * Math.PI) * 0.9 * d.dir; d.z = Math.sin(k * Math.PI) * 5; d.x += d.dir * 26 * dt; if (k >= 1) { d.rot = 0; d.z = 0; return false; } }; };   // a little head-over-heels
  function notice() {                                          // Marina spots them
    if (!V || V.said || G.busy || !V.deer.some(d => !d.hidden && onScreen(d.x))) return; V.said = true;
    if (!mover().moving) marina.dir = sgn(V.deer[0].x - marina.x);
    try { if (typeof jeff === 'undefined' && chance(0.7)) say(pick(['m_look', 'm_wow'])); else UI.bubble(marina, '🦌', 1800); } catch (e) { }   // (with Grandpa Jeff about, the family code has her call out "deer!")
  }
  // --- going home again
  function leave(scared) {
    if (!V || V.phase === 'exit') return; V.phase = 'exit'; V.timers.length = 0; V.wish = null; V.scared = !!scared; V.exitT = V.t;
    const herd = V.deer.filter(d => !d.hidden), mx = marina.x, hx = herd.length ? herd.reduce((a, d) => a + d.x, 0) / herd.length : V.cx;
    let list = freeGates(); if (!list.length) list = GATES;
    if (scared) { const awayG = list.filter(g => sgn(g.x - mx) === sgn(hx - mx || 1) && Math.abs(g.x - mx) > 60); if (awayG.length) list = awayG; }
    const g = V.gate = nearGate(hx + (scared ? sgn(hx - mx || 1) * 40 : 0), list);
    herd.sort((a, b) => Math.abs(a.x - g.x) - Math.abs(b.x - g.x));
    herd.forEach((d, i) => {
      const s = sgn(d.x - g.x || 1), gait = scared ? 'bolt' : d.fawn ? 'pronk' : 'lope', last = !scared && d.fawn && i >= herd.length - 1;
      if (d.behind) { clear(d); d.sinkTo = d.h; Q(d, act('stand', 0.2 + d.h / 70), fn(x => { x.hidden = true; })); return; }
      clear(d); if (scared) { emit('sparkle', d.x - d.dir * d.hw * 0.8, d.y - d.h * 0.62, 4, { col: '#ffffff', life: 0.5 }); Q(d, act('alert', 0.3 + i * 0.08, { fps: 14, mode: 'hold', face: mx })); }
      else Q(d, act('alert', 0.5 + i * 0.45, { fps: 8, mode: 'hold' }));
      Q(d, go(g.x + s * (g.hw + 22), g.y - 1, gait));
      if (last) Q(d, act('alert', 0.9, { fps: 9, mode: 'hold', face: () => marina.x }), fn(x => { snd.bleat(x); if (onScreen(x.x)) emit('heart', x.x, x.y - x.h - 4, 1, { size: 8 }); }), act('wag', 0.9, { fps: 10 }));
      Q(d, fn(x => { x.behind = true; g.shake = 1; if (onScreen(g.x, 20)) snd.rustle(); }), go(g.x + s * 6, g.y - 1, scared ? 'run' : 'trot'), fn(x => { x.sinkTo = x.h; }), act('stand', 0.2 + d.h / 70), fn(x => { x.hidden = true; }));
    });
    if (!scared && herd[0]) snd.bleat(herd[0]);
  }
  // --- the beats. Each sets everybody going and says how long it lasts.
  const BEATS = {
    graze() { const sl = slots(V.cx); for (const d of V.deer) Q(d, go(sl[d.kind][0] + rnd(-5, 5), sl[d.kind][1], 'walk'), graze(rnd(2.2, 3.6)), act('alert', rnd(0.7, 1.3), { fps: 8, mode: 'hold' }), graze(rnd(2, 4)), act('stand', 9)); return rnd(7, 9); },
    // all heads snap up together at a sound
    headsup() {
      const sl = slots(V.cx), nx = V.cx + (chance(0.5) ? 90 : -90); for (const d of V.deer) Q(d, go(sl[d.kind][0], sl[d.kind][1], 'walk'), graze(9));
      after(2.6, () => { snd.snap(); if (onScreen(nx, 10)) emit('leaf', nx, 120, 3); for (const d of V.deer) { clear(d); Q(d, act('alert', 2.1, { fps: 16, mode: 'hold', face: nx }), d.fawn ? [fn(x => snd.bleat(x)), act(d.kind === 'fawna' ? 'bleat' : 'wag', 0.7, { fps: 9 })] : [act('stand', 0.5)], graze(5)); } });
      return 7;
    },
    // bounding off across the yard in a line and back again; one fawn dawdles and has to sprint to catch up
    cross() {
      let away = sgn(V.cx - marina.x || 1), far = clamp(V.cx + away * rnd(170, 240), LX + 20, RX - 20); if (Math.abs(far - V.cx) < 110) { away = -away; far = clamp(V.cx + away * rnd(170, 240), LX + 20, RX - 20); }   // not much lawn that way: go the other way, round behind her
      const back = beside(), sl0 = slots(far), [doe, buck, fa, fb] = V.deer;
      V.flipS = !V.flipS; const sl1 = slots(back); V.cx = back;
      const line = [[doe, 'lope'], [fa, 'pronk'], [buck, 'lope']];
      line.forEach(([d, g], i) => Q(d, act('alert', 0.25 + i * 0.32, { fps: 12, mode: 'hold', face: far }), go(sl0[d.kind][0], 150 + i * 2, g), act(i ? 'stand' : 'look', 0.9 + (2 - i) * 0.3, { fps: 7, mode: 'hold' }), go(sl1[d.kind][0], sl1[d.kind][1], g), act('stand', 9)));
      Q(fb, act('sniff', 1.7, { fps: 7 }), act('alert', 0.5, { fps: 14, mode: 'hold', face: far }), fn(d => { snd.bleat(d); emit('anger', d.x, d.y - d.h - 5, 1, { ch: '❗', size: 8, vx: 0, vy: -12, life: 0.7 }); }),
        go(sl0.fawnb[0], 156, 'sprint'), act('wag', 0.5, { fps: 12 }), go(sl1.fawnb[0], sl1.fawnb[1], 'sprint'), act('stand', 9));
      return 2.2 + (Math.abs(far - doe.x) + Math.abs(far - back)) / 100;
    },
    // the fawns play chase in a circle, then one jumps right over the other
    chase() {
      const sl = slots(V.cx), [doe, buck, fa, fb] = V.deer, f = V.flipS ? -1 : 1, R = narrow() ? 18 : 30, T = 4.2, t0 = V.t, cy = narrow() ? 167 : 163; let th = 0, cx = narrow() ? V.cx + 6 * sgn(marina.x - V.cx || 1) : V.cx - 62 * f;
      if (!narrow() && Math.abs(cx - marina.x) < 48) cx = V.cx + 70 * f; cx = clamp(cx, LX + 34, RX - 34);
      Q(doe, go(sl.doe[0], 149, 'walk'), act('look', 2.2, { fps: 5, mode: 'hold' }), graze(6)); Q(buck, go(sl.buck[0], 148, 'walk'), graze(3), act('alert', 6, { fps: 6, mode: 'hold' }));
      const ring = lag => (d, dt) => { if (d === fa) th += dt * (V.t - t0 < T / 2 ? 3.3 : -3.3); const a = th - lag * (V.t - t0 < T / 2 ? 1 : -1), px = d.x, k = Math.min(1, dt * 9); d.x = lerp(d.x, cx + Math.cos(a) * R, k); d.y = lerp(d.y, cy + Math.sin(a) * 6, k); if (Math.abs(d.x - px) > 0.05) d.dir = sgn(d.x - px); if (d.an !== 'run') play(d, 'run', { fps: 15 }); const f = Math.floor(d.at * 2.2); if (f !== d.lastF) { d.lastF = f; snd.hoof(d); } return V.t - t0 < T; };
      for (const [d, lag] of [[fa, 0], [fb, 2.5]]) { clear(d); Q(d, go(cx + Math.cos(-lag) * R, cy + Math.sin(-lag) * 6, 'run'), fn(x => { x.motion = ring(lag); })); }
      after(T + 0.9, () => { clear(fa); clear(fb); const j = narrow() ? 30 : 44; Q(fb, go(cx, cy, 'walk'), act('alert', 3, { fps: 6, mode: 'hold', face: cx - 60 })); Q(fa, go(cx - j, cy, 'run'), act('wag', 0.5, { fps: 12 }), go(cx + j, cy, 'run', { arc: 30, v: 120 }), fn(d => { emit('star', cx, cy - 24, 2); snd.bleat(d); }), act('pronk', 0.67, { fps: 12 }), act('stand', 4)); });
      return T + 4.6;
    },
    // a fawn creeps up to sniff something: a thing Grandpa Jeff built, his workbench, a flower... or Marina herself
    sniff() {
      const [doe, buck, fa, fb] = V.deer, f = chance(0.5) ? fa : fb, o = f === fa ? fb : fa, sl = slots(V.cx);
      Q(doe, go(sl.doe[0], sl.doe[1], 'walk'), graze(3), act('look', 5, { fps: 4, mode: 'hold' })); Q(buck, go(sl.buck[0], sl.buck[1], 'walk'), graze(8)); Q(o, go(sl[o.kind][0], sl[o.kind][1], 'walk'), graze(2.5), act('alert', 6, { fps: 5, mode: 'hold', face: () => f.x }));
      if (V.friendT < 1e8 && chance(0.6) && !mover().moving && Math.abs(marina.x - V.cx) < 130 && !G.busy) { befriend(f); return 9; }
      const things = builtXs().concat([BY().bench]).filter(x => Math.abs(x - V.cx) < 170 && Math.abs(x - marina.x) > 30).map(x => [x, 147]), tgt = things.length ? pick(things) : [clamp(V.cx + rnd(-40, 40), LX, RX), 168];
      if (!things.length) V.fx.flower = { x: tgt[0], y: tgt[1], t0: V.t };
      const s = sgn(tgt[0] - f.x || 1), stop = things.length ? 34 : 13;
      Q(f, go(lerp(f.x, tgt[0] - s * stop, 0.5), lerp(f.y, tgt[1] + 2, 0.5), 'creep', { v: 16 }), act('alert', 0.7, { fps: 8, mode: 'hold', face: tgt[0] }), go(tgt[0] - s * stop, tgt[1] + 2, 'creep', { v: 14 }), fn(() => snd.sniff()), act('sniff', 1.9, { fps: 7, face: tgt[0] }),
        fn(d => { Audio2.blip(24, 'triangle', 0.05, 0.05); emit('dust', d.x + d.dir * 9, d.y - 14, 2, { life: 0.4 }); }), go(tgt[0] - s * (stop + 16), tgt[1] + 2, 'run', { arc: 9, v: 80 }), fn(d => face(d, tgt[0])), act('wag', 0.8, { fps: 11 }), go(sl[f.kind][0], sl[f.kind][1], 'pronk'), act('stand', 5));
      return 9.5;
    },
    // the doe gives a fawn's head a good lick
    lick() {
      const [doe, buck, fa, fb] = V.deer, f = chance(0.5) ? fa : fb, o = f === fa ? fb : fa, sl = slots(V.cx), s = narrow() ? sgn(V.cx - marina.x || 1) : V.flipS ? -1 : 1, x = clamp(narrow() ? V.cx - s * 10 : sl.doe[0], LX + 30, RX - 40);
      Q(buck, go(sl.buck[0], sl.buck[1], 'walk'), graze(8)); Q(doe, go(x, 156, 'walk'), fn(d => { d.dir = s; snd.bleat(d); }), act('look', 1, { fps: 6, mode: 'hold' }), act('stand', 0.7), fn(d => { d.dir = s; }), act('lick', 3.6, { fps: 3.4 }), act('stand', 4));
      Q(f, act('alert', 1.2, { fps: 9, mode: 'hold', face: x }), go(x + s * 29, 157, 'trot'), fn(d => { d.dir = -s; }), act('stand', 0.6), fn(d => { V.fx.hearts = { d, until: E.t + 3.2, n: 0 }; }), act(f.kind === 'fawnb' ? 'shy' : 'wag', 3.4, { fps: 5, mode: f.kind === 'fawnb' ? 'hold' : 'loop' }), act('wag', 1, { fps: 10 }), act('stand', 4));
      Q(o, go(sl[o.kind][0], sl[o.kind][1], 'walk'), graze(3), act('alert', 0.8, { fps: 8, mode: 'hold', face: x }), go(x - s * 15, 164, 'pronk'), fn(d => { d.dir = s; }), act('wag', 2, { fps: 9 }));
      return 8.6;
    },
    // the buck scratches his antlers on a big tree (or on the bushes)
    rub() {
      const [doe, buck, fa, fb] = V.deer, sl = slots(V.cx), tree = BY().trees.filter(t => Math.abs(t.x - V.cx) < 230 && Math.abs(t.x - marina.x) > 26).sort((a, b) => Math.abs(a.x - V.cx) - Math.abs(b.x - V.cx))[0], g = nearGate(V.cx);
      const tx = tree ? tree.x : g.x, s = sgn(tx - buck.x || 1), off = tree ? tree.trunk / 2 + 21 : g.hw + 14, y = tree ? 150 : 146;
      Q(doe, go(sl.doe[0], sl.doe[1], 'walk'), graze(8)); Q(fb, go(sl.fawnb[0], sl.fawnb[1], 'walk'), graze(8));
      const far = Math.abs(tx - s * off - buck.x) > 80; Q(buck, go(tx - s * off, y, far ? 'trot' : 'walk'), fn(d => { d.dir = s; V.fx.rub = { until: E.t + 4.2, x: tx, tree: !!tree, g, n: 0 }; }), act('rub', 4.2, { fps: 8 }), act('alert', 1, { fps: 8, mode: 'hold' }), act('stand', 4));
      Q(fa, graze(2), act('alert', 0.8, { fps: 8, mode: 'hold', face: tx }), go(tx - s * (off + 30), y + 8, 'pronk'), fn(d => { d.dir = s; }), act('wag', 2.6, { fps: 8 }), act('stand', 3));
      return 5.8 + Math.abs(tx - s * off - buck.x) / (far ? 52 : 30);
    },
    // a butterfly lands on a fawn's nose
    butterfly() {
      const [doe, buck, fa, fb] = V.deer, f = chance(0.5) ? fa : fb, o = f === fa ? fb : fa, sl = slots(V.cx), nose = () => [f.x + f.dir * 15 * f.s, f.y - 29 * f.s];
      Q(doe, go(sl.doe[0], sl.doe[1], 'walk'), graze(4), act('look', 5, { fps: 4, mode: 'hold' })); Q(buck, go(sl.buck[0], sl.buck[1], 'walk'), graze(9));
      Q(f, go(sl[f.kind][0], sl[f.kind][1], 'walk'), act('stand', 9)); Q(o, go(sl[o.kind][0], sl[o.kind][1], 'walk'), graze(3.4), act('alert', 1, { fps: 8, mode: 'hold', face: () => f.x }), go(sl[f.kind][0] - f.dir * 20, sl[f.kind][1] + 2, 'creep', { v: 15 }), fn(d => face(d, f.x)), act('alert', 4, { fps: 5, mode: 'hold' }));
      const b = V.fx.bfly = { x: f.x - 60, y: 70, col: f.kind === 'fawna' ? ['#2b6cf0', '#7fb6ff'] : ['#11b5b5', '#7fe8e0'], on: false, gone: false };
      after(1.6, () => { b.x = clamp(sl[f.kind][0] + rnd(-50, 50), E.camX + 8, E.camX + E.viewW - 8); b.y = 60; b.to = nose; b.fly = true; });
      after(4.3, () => { b.fly = false; b.on = true; clear(f); play(f, 'nose', { fps: 2.2, mode: 'hold' }); Q(f, act('nose', 2.7, { fps: 2.2, mode: 'hold' })); Audio2.blip(31, 'sine', 0.05, 0.04); });
      after(7.1, () => { b.on = false; b.fly = true; const p = nose(); b.x = p[0]; b.y = p[1]; b.to = () => [f.x + f.dir * 60, 20]; Q(f, fn(d => { Audio2.blip(22, 'triangle', 0.05, 0.06); emit('dust', d.x + d.dir * 10, d.y - 18, 2, { life: 0.35 }); }), act('pronk', 0.67, { fps: 12 }), go(clamp(f.x + f.dir * 26, LX, RX), f.y, 'pronk'), act('alert', 1.2, { fps: 8, mode: 'hold' }), act('stand', 3)); });
      after(9.4, () => { b.gone = true; });
      return 10;
    },
  };
  function befriend(f) {                                       // a fawn tiptoes right up to Marina, sniffs her and stays a moment
    const s = sgn(f.x - marina.x || 1), x = marina.x + s * 21, y = marina.y + 1; V.friendT = 1e9;
    clear(f); Q(f, act('alert', 0.8, { fps: 8, mode: 'hold', face: marina.x }), go(lerp(f.x, x, 0.55), lerp(f.y, y, 0.55), 'creep', { v: 17 }), act('alert', 0.6, { fps: 9, mode: 'hold' }), go(x, y, 'creep', { v: 14 }), fn(d => { face(d, marina.x); snd.sniff(); V.friend = d; d.tame = E.t + 16; if (!G.busy && !mover().moving) marina.dir = s; }),
      act('sniff', 1.5, { fps: 7 }), fn(d => { emit('heart', d.x, d.y - d.h - 3, 1, { size: 8 }); snd.bleat(d); }), act('wag', 4.5, { fps: 8 }), fn(() => { V.friend = null; }));
  }
  function nextBeat() {
    if (!V || V.phase !== 'beats') return; for (const d of V.deer) clear(d); V.fx = {};
    if (V.t >= V.len - 6) return leave(false);
    let pool = Object.keys(BEATS).filter(k => !V.done.includes(k)); if (!pool.length) pool = ['graze'];
    const k = V.first && BEATS[V.first] ? V.first : !V.done.length && chance(0.45) ? 'graze' : pick(pool); V.first = null; V.done.push(k); V.beat = k;
    after(BEATS[k](), nextBeat);
  }
  // --- every frame of a visit
  function visitTick(dt) {
    const m = mover(), herd = V.deer.filter(d => !d.hidden && !d.behind);
    for (const g of GATES) g.shake = Math.max(0, g.shake - dt * 1.6);
    // Marina charging straight at them: heads up first, then white tails and away
    if (!m.moving) { V.invited = false; V.runT = 0; }
    if (V.phase !== 'exit' && herd.length && !V.lock && !V.invited && m.moving && (m.curSpeed || 78) >= 55 && Math.abs(m.tx - marina.x) > 6) {
      const way = sgn(m.tx - marina.x), reach = Math.abs(m.tx - marina.x), ahead = herd.filter(d => !(d.tame > E.t) && sgn(d.x - marina.x) === way && reach > Math.abs(d.x - marina.x) - 36);
      const dist = ahead.reduce((a, d) => Math.min(a, Math.abs(d.x - marina.x)), 1e9);
      if (dist < 104) V.runT = (V.runT || 0) + dt;
      if (dist < 44 && V.runT > 0.3) { for (const d of herd) snd.hoof(d); return leave(true); }
      if (dist < 104) { if (V.wary <= 0) for (const d of herd) { if (d.motion || d.tame > E.t) continue; d.q.unshift(act('alert', 1.1, { fps: 16, mode: 'hold', face: marina.x })); d.cur = null; } V.wary = 1.1; }
    }
    V.wary = Math.max(0, V.wary - dt); V.wait = Math.max(0, V.wait - dt);
    stillT = m.moving || marina.state !== 'idle' ? 0 : stillT + dt;
    if (!V.lock && V.wary <= 0 && V.wait <= 0) {
      V.t += dt; for (let i = 0; i < V.timers.length; i++) { const tm = V.timers[i]; if (tm.t <= V.t) { V.timers.splice(i--, 1); tm.f(); if (!V) return; } }
      // she has been standing quietly nearby for a while: a fawn comes right up to her
      if (V.phase === 'beats' && stillT > 3.5 && V.t > V.friendT && !G.busy && V.beat !== 'cross' && V.beat !== 'chase') { const f = fawns().filter(d => !d.motion && Math.abs(d.x - marina.x) < 150).sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x))[0]; if (f) { befriend(f); V.wait = 2; } }
    }
    for (const d of V.deer) if (!d.hidden) stepDeer(d, dt);
    // little extras that belong to a beat
    const fx = V.fx; if (fx.hearts && E.t < fx.hearts.until) { const h = fx.hearts; if (Math.floor(E.t * 2.4) !== h.n) { h.n = Math.floor(E.t * 2.4); emit('heart', h.d.x + rnd(-4, 4), h.d.y - h.d.h - 2, 1, { size: 7 }); } }
    if (fx.rub && E.t < fx.rub.until) { const r = fx.rub; if (Math.floor(E.t * 3) !== r.n) { r.n = Math.floor(E.t * 3); if (onScreen(r.x, 20)) snd.scratch(); if (r.tree) emit('leaf', r.x + rnd(-30, 30), rnd(20, 60), 1, { vx: rnd(-10, 10), vy: rnd(5, 20), g: 30, life: 3 }); else r.g.shake = 0.8; } }
    const b = fx.bfly; if (b && b.fly && b.to) { const p = b.to(); b.x += clamp(p[0] - b.x, -34 * dt, 34 * dt) + Math.sin(E.t * 9) * 0.4; b.y += clamp(p[1] - b.y, -30 * dt, 30 * dt) + Math.cos(E.t * 13) * 0.35; }
    if (V.wish && E.t > V.wish.until) V.wish = null;
    if (V.phase === 'exit') { V.exitT2 = (V.exitT2 || 0) + dt; if (V.deer.every(d => d.hidden) || V.exitT2 > (V.scared ? 6 : 14)) endVisit(); }
  }

  // ---------------------------------------------------------------- Marina and the deer: an apple, a gentle pet, a wave
  const hand = { on: false };
  function busy(on) { if (on) { G.busy = true; myBusy = E.t; } else { if (myBusy) G.busy = false; myBusy = 0; } }
  function reachOut() {
    if (typeof playAnim !== 'function' || !frameCount('marina_reach')) return;
    playAnim('marina_reach', { fps: 12, dur: 0.6, onEnd: () => { if (!hand.on) return; marina.state = 'anim'; marina.anim = { base: 'marina_reach', n: frameCount('marina_reach'), fps: 1, t0: E.t - 0.97 * 240, dur: 240, x0: marina.x, loop: false, move: 0, lift: 0, proc: null, onEnd: null }; } });
  }
  const armDown = () => { if (marina.state === 'anim' && marina.anim && marina.anim.base === 'marina_reach') { marina.state = 'idle'; marina.anim = null; } };
  const got = () => { try { if (!got.done) { got.done = true; window.did && did('deer'); } } catch (e) { } };
  function feed(d) {
    if (!V || V.lock || V.phase === 'exit' || d.hidden) return; V.lock = true; busy(true); UI.closeActions();
    const s = sgn(d.x - marina.x || 1), far = Math.abs(d.x - marina.x), x = clamp(marina.x + s * (d.fawn ? 27 : 43), 130, 1030), y = marina.y + (d.fawn ? 1 : -1);
    const m = mover(); m.stop && m.stop(); marina.dir = s; hand.on = true; reachOut(); try { chip('pop'); } catch (e) { }
    const done = () => { if (!V) return; V.lock = false; hand.on = false; armDown(); busy(false); V.wait = Math.max(V.wait, 7); };
    const safety = setTimeout(() => { if (V && V.lock && hand.on) { clear(d); done(); } }, 9000);
    clear(d); if (V.friend === d) V.friend = null; if (V.wish && V.wish.d === d) V.wish = null; d.tame = E.t + 20;
    for (const o of V.deer) if (o !== d && !o.hidden && !o.behind && Math.abs(o.x - x) < 15 && Math.abs(o.y - y) < 8) { clear(o); o.tame = E.t + 20; Q(o, go(clamp(x + s * 24, 130, 1030), y + 2, 'walk'), fn(q => face(q, marina.x)), act('wag', 2, { fps: 8 })); }   // make room
    Q(d, act('alert', 0.5, { fps: 9, mode: 'hold', face: marina.x }), go(x, y, far > 110 ? 'trot' : 'walk'), fn(q => { face(q, marina.x); snd.sniff(); }), act(d.fawn ? 'sniff' : d.kind === 'doe' ? 'lick' : 'down', d.fawn ? 1 : 0.8, { fps: d.fawn ? 8 : 4, mode: d.fawn ? 'loop' : 'hold' }),
      fn(q => { clearTimeout(safety); hand.on = false; snd.crunch(); emit('heart', q.x, q.y - q.h - 2, 5); armDown(); marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1300); got(); V.fed.push(q.kind);
        try { say(pick(['m_yay', 'm_giggle', 'm_wow'])); } catch (e) { } }),
      act(d.fawn ? 'sniff' : 'chew', 1.5, { fps: 9 }), fn(q => { snd.crunch(); if (q.fawn) Q(q, act('pronk', 0.67, { fps: 12 }), act('wag', 2.5, { fps: 9 })); else Q(q, act('chew', 1.2, { fps: 8 }), act('alert', 2, { fps: 6, mode: 'hold' })); done(); wantToo(q, s); }));
  }
  function wantToo(first, s) {                                 // "me too!": another fawn trots up wanting an apple as well
    const o = fawns().find(f => f !== first && !V.fed.includes(f.kind) && !f.hidden && !f.behind); if (!o || V.phase !== 'beats') return;
    clear(o); Q(o, act('alert', 0.4, { fps: 12, mode: 'hold', face: marina.x }), go(clamp(marina.x + s * (first.fawn ? 50 : 25), 130, 1030), marina.y + 3, 'pronk'), fn(q => { face(q, marina.x); snd.bleat(q); q.tame = E.t + 20; V.wish = { d: q, until: E.t + 11 }; }), act('wag', 2, { fps: 9 }), act('alert', 6, { fps: 5, mode: 'hold' }));
  }
  function pet(f) {
    if (!V || V.lock || V.phase === 'exit' || f.hidden) return; V.lock = true; busy(true); UI.closeActions();
    const s = sgn(f.x - marina.x || 1), m = mover(); m.stop && m.stop(); marina.dir = s; clear(f); if (V.friend === f) V.friend = null; f.tame = E.t + 20;
    const done = () => { if (!V) return; V.lock = false; busy(false); V.wait = Math.max(V.wait, 4); };
    const safety = setTimeout(done, 8000);
    Q(f, go(marina.x + s * 20, marina.y + 1, 'walk'), fn(q => {
      face(q, marina.x); if (typeof playAnim === 'function' && frameCount('marina_pet')) playAnim('marina_pet', { dur: 2.6 }); else marina.state = 'cheer';
      V.fx.hearts = { d: q, until: E.t + 2.8, n: 0 }; V.petT = E.t; got(); try { Audio2.sfx('purr', { vol: 0.25 }); } catch (e) { } setTimeout(() => { try { say(pick(['m_wow', 'm_giggle'])); } catch (e) { } }, 500);
    }), act(f.kind === 'fawnb' ? 'shy' : 'wag', 0.9, { fps: 6, mode: f.kind === 'fawnb' ? 'hold' : 'loop' }), act('wag', 1.9, { fps: 11 }), fn(q => { clearTimeout(safety); if (marina.state === 'cheer' || marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; } V.fx.hearts = null; snd.bleat(q); done(); }), act('pronk', 0.67, { fps: 12 }), act('wag', 2, { fps: 8 }));
  }
  function wave() {
    if (!V) return; UI.closeActions(); try { UI.bubble(marina, '👋', 1500); } catch (e) { } Audio2.jingle([7, 12, 16], 0.07, 'triangle');
    const near = V.deer.filter(d => !d.hidden && !d.behind).sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x))[0]; if (near && !mover().moving) marina.dir = sgn(near.x - marina.x || 1);
    if (['idle', 'cheer'].includes(marina.state)) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1200); }
    V.wait = Math.max(V.wait, 2.6);
    V.deer.filter(d => !d.hidden && !d.behind && !d.motion).forEach((d, i) => { d.cur = null; d.q.unshift(...(d.fawn ? [act('alert', 0.35 + i * 0.12, { fps: 14, mode: 'hold', face: marina.x }), fn(q => { if (i < 3) snd.bleat(q); }), act('pronk', 0.67, { fps: 12 }), act('wag', 1, { fps: 10 })] : [act('alert', 2.2, { fps: 10, mode: 'hold', face: marina.x })])); });
  }
  function deerActions(d) {
    const a = [A('🍎', () => feed(d))], f = [d].concat(fawns()).find(q => q.fawn && !q.hidden && !q.behind && Math.abs(q.x - marina.x) < 46 && Math.abs(q.y - marina.y) < 16);
    if (f) a.push(A('🤚', () => pet(f))); a.push(A('👋', wave)); return a;
  }
  function tapDeer(d) {
    if (!V || V.phase === 'exit' || V.lock) return; V.wait = Math.max(V.wait, 3.5);
    if (!d.motion && !(d.cur && d.cur.go && d.cur.gait !== 'walk' && d.cur.gait !== 'creep')) { d.cur = null; d.q.unshift(act('alert', 2.4, { fps: 10, mode: 'hold', face: marina.x })); }
    Audio2.blip(pick([12, 16, 19]), 'triangle', 0.06, 0.08);
    UI.actions({ get x() { return d.x; }, get y() { return d.y - d.h * (E.depth || 1); }, get here() { return !!V && !V.over && V.phase !== 'exit' && !d.hidden; } }, deerActions(d));
  }

  // ---------------------------------------------------------------- small life, the rest of the time (sparse)
  const small = [], air = [], leaves = [];
  let smallT = 8, leafT = 3, airT = 14;
  function critter(type, o) {
    const c = { ...ENTLIKE, wild: type, type, id: 'wild_' + type, room: ROOM, x: 0, y: 150, z: 0, dir: 1, t: 0, at: 0, an: 'stand', fps: 8, hidden: false, behind: false, sink: 0, rot: 0, update: NOP, hw: 8, h: 14, ...o };
    Object.defineProperty(c, 'here', { get() { return this.room === G.room && !this.hidden && !this.behind && !hideBase; } });
    small.push(c); if (!c.behind) ENTS.push(c); return c;
  }
  function gone(c) { let i = small.indexOf(c); if (i >= 0) small.splice(i, 1); i = ENTS.indexOf(c); if (i >= 0) ENTS.splice(i, 1); }
  const mNear = (c, r) => Math.abs(marina.x - c.x) < r;
  const viewX = (m) => rnd(E.camX + (m || 14), E.camX + E.viewW - (m || 14));
  const SMALL = {
    // robins land on the lawn, hop and peck, and fly off when she comes near
    bird() {
      const n = 1 + (chance(0.6) ? 1 : 0) + (chance(0.25) ? 1 : 0), bx = clamp(viewX(26), LX - 20, RX), by = rnd(150, 170), from = chance(0.5) ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const c = critter('bird', { s: 0.42, x: bx + i * rnd(9, 16) - from * 110, y: clamp(by + rnd(-6, 6), 148, 174), z: 100 + i * 14, dir: from, st: 'in', lx: bx + i * rnd(9, 16), life: rnd(9, 16), wait: rnd(0.3, 1.2), hw: 6, h: 11 });
        c.flee = () => { if (c.st !== 'out') { c.st = 'out'; c.dir = sgn(c.x - marina.x || c.dir); c.an = 'fly'; c.fps = 14; } };
        c.tap = () => { snd.chirp(); emit('note', c.x, c.y - 14, 1, { size: 8 }); c.st === 'ground' ? (c.hopT = 0.2, c.life = Math.min(c.life, 1.2)) : c.flee(); };
        c.tick = dt => {
          if (c.st === 'in') { const k = Math.min(1, dt * 1.6); c.x += (c.lx - c.x) * k * 1.4; c.z = Math.max(0, c.z - 62 * dt); c.an = 'fly'; c.fps = 13; if (c.z <= 0 && Math.abs(c.lx - c.x) < 14) { c.st = 'ground'; c.an = 'stand'; } }
          else if (c.st === 'ground') {
            c.life -= dt; c.wait -= dt; if (c.hopT > 0) { c.hopT -= dt; c.z = Math.sin(Math.max(0, c.hopT) / 0.2 * Math.PI) * 3; c.x += c.dir * 24 * dt; }
            else if (c.wait <= 0) { c.wait = rnd(0.7, 1.7); if (chance(0.5)) { c.an = 'peck'; c.at = 0; c.fps = 9; c.pk = 0.66; } else { if (chance(0.3)) c.dir = -c.dir; c.hopT = 0.2; c.an = 'stand'; } }
            if (c.pk > 0 && (c.pk -= dt) <= 0) c.an = 'stand';
            if (c.life <= 0 || mNear(c, mover().moving ? 34 : 17)) { if (mNear(c, 40)) snd.chirp(); c.flee(); }
          } else { c.z += 74 * dt; c.x += c.dir * 66 * dt; if (c.z > 170) gone(c); }
        };
      }
    },
    // a squirrel runs along the ground and up a big tree (or sits up for a nibble if there is no tree near)
    squirrel() {
      const tree = BY().trees.filter(t => Math.abs(t.x - (E.camX + E.viewW / 2)) < E.viewW / 2 + 60).sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x))[0];
      const eL = E.camX - 16, eR = E.camX + E.viewW + 16, from = tree ? (Math.abs(tree.x - eL) > Math.abs(tree.x - eR) ? -1 : 1) : chance(0.5) ? 1 : -1, x0 = from > 0 ? eR : eL;
      const c = critter('squirrel', { s: 0.64, x: x0, y: tree ? 151 : rnd(148, 156), dir: -from, st: 'run', an: 'run', fps: 14, tx: tree ? tree.x + from * (tree.trunk / 2 - 1) : x0 - from * (E.viewW + 40), tree, sat: !tree && chance(0.8) ? rnd(0.3, 0.6) : 0, hw: 9, h: 13 });
      c.tap = () => { Audio2.blip(26, 'square', 0.03, 0.04); setTimeout(() => Audio2.blip(26, 'square', 0.03, 0.04), 90); if (c.st === 'run') { c.st = 'sit'; c.t = 1.3; c.an = 'sit'; c.fps = 7; c.fast = true; } else if (c.st === 'climb') { c.t = 0.5; c.fast = true; } };
      c.tick = dt => {
        if (c.st === 'run') { c.x += c.dir * (c.fast ? 100 : 68) * dt; if (c.sat && Math.abs(c.x - (E.camX + E.viewW * c.sat)) < 3 && !mNear(c, 24)) { c.st = 'sit'; c.t = rnd(1.6, 2.6); c.an = 'sit'; c.fps = 6; c.sat = 0; }
          if (sgn(c.tx - c.x) !== c.dir) { if (c.tree) { c.st = 'climb'; c.x = c.tx; c.rot = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; c.t = 0; } else gone(c); } }
        else if (c.st === 'sit') { c.t -= dt; if (c.t <= 0 || mNear(c, 20)) { c.st = 'run'; c.an = 'run'; c.fps = 15; } }
        else { c.t -= dt; if (c.t <= 0) c.y -= (c.fast ? 95 : 60) * dt; c.fps = c.t > 0 ? 0.01 : 14; if (c.y < 26) gone(c); }
      };
    },
    // a rabbit pops out from behind the bushes, freezes, and hops away if she comes close
    rabbit() {
      const gs = freeGates().filter(g => onScreen(g.x + sgn(g.x - marina.x || 1) * (g.hw + 10), -12) && Math.abs(g.x - marina.x) > 24); if (!gs.length) return false;
      const g = pick(gs), s = sgn(g.x - marina.x || 1), c = critter('rabbit', { s: 0.64, behind: true, x: g.x + s * 8, y: g.y - 1, dir: s, st: 'out', an: 'hop', fps: 12, t: rnd(8, 13), g, hw: 7, h: 20, tx: g.x + s * (g.hw + 10) });
      g.shake = 0.7;
      c.hide = () => { if (c.st !== 'home') { c.st = 'home'; c.an = 'hop'; c.at = 0; c.fps = 13; c.dir = sgn(c.g.x - c.x || 1); c.tx = c.g.x; } };
      c.tap = () => { snd.thump(); emit('dust', c.x, c.y - 2, 3, { life: 0.4 }); const o = freeGates().filter(q => q !== c.g && Math.abs(q.x - c.x) < 260).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0]; if (o) c.g = o; c.hide(); };
      c.tick = dt => {
        if (c.st === 'out') { c.x += c.dir * 30 * dt; if (sgn(c.tx - c.x) !== c.dir) { c.st = 'sit'; c.an = 'sit'; c.fps = 2.5; c.dir = sgn(marina.x - c.x || 1); } }
        else if (c.st === 'sit') { c.t -= dt; if (mNear(c, 40)) { snd.thump(); c.hide(); } else if (c.t <= 0 || V) c.hide(); }
        else { c.x += c.dir * 58 * dt; if (sgn(c.tx - c.x) !== c.dir) { c.g.shake = 0.6; gone(c); } }
      };
    },
    // a chipmunk nips over to the workbench and makes off with a nut
    chip() {
      const bx = BY().bench, g = nearGate(bx + 60), s = sgn(bx - g.x || 1), home = g.x + s * 12; if (!onScreen(bx, -10) || mNear({ x: bx }, 46) || mNear({ x: home }, 44)) return false;
      const c = critter('chip', { s: 0.56, x: home, y: 146, dir: s, st: 'to', an: 'run', fps: 16, tx: bx + s * rnd(16, 34), home, alpha: 0, hw: 7, h: 10, nut: false, t: 0 });
      g.shake = 0.5;
      c.tap = () => { snd.squeak(); emit('sparkle', c.x, c.y - 8, 3); c.st = 'back'; c.dir = sgn(c.home - c.x || 1); c.an = 'run'; c.fast = true; };
      c.tick = dt => {
        const far = Math.abs(c.x - c.home); c.alpha = clamp(far / 8, c.st === 'to' ? 0.3 : 0, 1); c.y = lerp(146, 156, clamp(far / 18, 0, 1));   // out from under the bushes, along the front of the bench
        if (c.st === 'to') { c.x += c.dir * 46 * dt; if (sgn(c.tx - c.x) !== c.dir) { c.st = 'look'; c.t = 1.6; c.an = 'stand'; } if (mNear(c, 26)) c.tap(); }
        else if (c.st === 'look') { c.t -= dt; if (c.t < 0.8 && !c.nut) { c.nut = true; emit('sparkle', c.x, c.y - 9, 3); Audio2.blip(33, 'sine', 0.04, 0.04); } if (c.t <= 0 || mNear(c, 26)) { c.st = 'back'; c.dir = sgn(c.home - c.x || 1); c.an = 'run'; } }
        else { c.x += c.dir * (c.fast ? 92 : 62) * dt; if (sgn(c.home - c.x) !== c.dir) { g.shake = 0.5; gone(c); } }
      };
    },
  };
  function drawCritter(c, back) {
    const y = c.y - c.z + c.sink, fr = frame(c.type, c.an, c.at, c.fps, c.an === 'peck' ? 'hold' : 'loop');
    put(fr, c.x, y, { s: c.s, flip: c.dir < 0, rot: c.rot, alpha: c.alpha, depth: back ? 0.9 : 0 });
    if (c.type === 'chip' && c.nut) emoji('🌰', c.x + c.dir * 5, c.y - 7, 4);
  }
  // butterflies by day, fireflies when it is dark; leaves drifting down
  function airTick(dt) {
    const dark = G.night > 0.3;
    if ((airT -= dt) <= 0) { airT = rnd(16, 30); if (air.length < (dark ? 5 : 2)) for (let i = 0; i < (dark ? 3 : 1); i++) air.push({ fire: dark, x: viewX(20), y: dark ? rnd(90, 150) : -6, hx: viewX(30), hy: rnd(96, 150), t: rnd(0, 9), life: rnd(18, 28), col: pick([['#f2a53a', '#ffe08a'], ['#e86aa8', '#ffc2e0'], ['#f0e04a', '#fff7b0'], ['#ffffff', '#dfe8ff']]) }); }
    for (let i = air.length - 1; i >= 0; i--) {
      const b = air[i]; b.t += dt; b.life -= dt;
      if (b.sit > 0) { b.sit -= dt; b.x = marina.x + marina.dir * 2; b.y = marina.y + marina.offY - 70 * marina.scale; if (b.sit <= 0) { b.life = 3; b.hy = -30; b.hx = b.x + rnd(-60, 60); } continue; }
      if (b.life < 0) { b.hy = -30; } if (chance(dt / 3)) { b.hx = clamp(b.hx + rnd(-50, 50), E.camX - 10, E.camX + E.viewW + 10); if (b.life > 0) b.hy = rnd(92, 152); }
      const sp = b.fire ? 9 : 22; b.x += clamp(b.hx - b.x, -sp * dt, sp * dt) + Math.sin(b.t * 5) * (b.fire ? 0.1 : 0.45); b.y += clamp(b.hy - b.y, -sp * dt, sp * dt) + Math.cos(b.t * 7) * (b.fire ? 0.1 : 0.4);
      if (b.y < -20 || (b.fire && !dark && b.life > 2)) air.splice(i, 1);
    }
    if (WEATHER !== 'snow' && (leafT -= dt) <= 0) { leafT = rnd(2.5, 6); if (leaves.length < 4) leaves.push({ x: viewX(6), y: -4, gy: rnd(146, 176), vy: rnd(13, 19), ph: rnd(0, 6), rot: 0, age: 0, s: rnd(1.4, 2.2), c: pick(['#c8642a', '#e09030', '#b5482f', '#d8a040', '#8fae4a']) }); }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]; if (l.y < l.gy) { l.y += l.vy * dt; l.vy += (16 - l.vy) * dt * 1.5; l.x += Math.sin(E.t * 1.7 + l.ph) * 13 * dt; l.rot += dt * 2.4; if (l.y < -30) l.vy = 16; } else { l.age += dt; if (l.age > 5) leaves.splice(i, 1); }
    }
  }
  function drawBfly(x, y, col, t, fire) {
    const c = E.ctx, px = Math.round(x - E.camX), py = Math.round(y);
    if (fire) { const a = 0.5 + Math.sin(t * 3) * 0.5; c.fillStyle = 'rgba(255,240,130,' + (0.25 * a).toFixed(3) + ')'; c.fillRect(px - 2, py - 2, 5, 5); c.fillStyle = 'rgba(255,250,170,' + (0.5 + 0.5 * a).toFixed(3) + ')'; c.fillRect(px, py, 1, 1); return; }
    const open = Math.sin(t * 20) > 0, w = open ? 3 : 1;         // wings open / closed
    c.fillStyle = col[0]; c.fillRect(px - w, py - 3, w, 3); c.fillRect(px + 1, py - 3, w, 3); c.fillRect(px - Math.min(2, w), py, Math.min(2, w), 2); c.fillRect(px + 1, py, Math.min(2, w), 2);
    if (open) { c.fillStyle = col[1]; c.fillRect(px - 2, py - 2, 1, 1); c.fillRect(px + 2, py - 2, 1, 1); }
    c.fillStyle = '#2a2233'; c.fillRect(px, py - 3, 1, 5);
  }
  function smallTick(dt) {
    for (const c of small.slice()) { c.at += dt; c.tick(dt); }
    airTick(dt);
    if (V || !quiet()) return;
    if ((smallT -= dt) > 0 || small.length) return; smallT = rnd(11, 24);
    const kinds = ['bird', 'bird', 'squirrel', 'rabbit', 'chip']; let k = pick(kinds); if (k === SMALL.last) k = pick(kinds); SMALL.last = k;
    if (SMALL[k]() === false) smallT = 4;
  }

  // ---------------------------------------------------------------- when things happen
  const quiet = () => typeof marina !== 'undefined' && G.room === ROOM && !(typeof inActivity === 'function' && inActivity()) && !G.busy && hid('panel') && hid('title');
  const screenUp = () => !hid('title') || !hid('panel') || !!(window.Studio && Studio.active) || !!document.querySelector('#storyBox,#stkBox') || !!G.sceneOn;
  function tick(dt) {
    if (!ART.ok || typeof marina === 'undefined') return;
    const here = G.room === ROOM;
    if (G.room !== lastRoom) { lastRoom = G.room; if (here) { if (!seenYard) { seenYard = true; next = rnd(20, 40); } else if (!V) next = Math.max(next, rnd(12, 20)); } else { for (const c of small.slice()) gone(c); air.length = 0; leaves.length = 0; } }
    if (myBusy && E.t - myBusy > 12) busy(false);            // never leave the game locked
    if (V) {
      if (!here) { if ((awayT += dt) > 15) endVisit(); return; } awayT = 0;
      if (screenUp()) return;                                  // a big screen is open: everything waits
      busyT = G.busy && !myBusy ? busyT + dt : 0; if (busyT > 2.5) return;
      visitTick(dt);
    } else if (here && seenYard && quiet()) { next -= dt; if (next <= 0) startVisit(); }
    if (here && !screenUp()) smallTick(dt);
  }
  { const _ft = featTick; featTick = function (dt) { _ft(dt); safe(() => tick(dt), 'tick'); }; }

  // ---------------------------------------------------------------- drawing: behind the bushes, among everybody else, and in the air
  function drawBack() {                                        // called before the furniture along the back
    if (!ART.ok || G.room !== ROOM) return; const c = E.ctx;
    if (V && V.fx.flower) emoji('🌼', V.fx.flower.x, V.fx.flower.y - 3, 6);
    for (const g of GATES) {
      if (!onScreen(g.x, 110)) continue;
      const hiders = (V ? V.deer : []).concat(small).filter(d => d.behind && !d.hidden && (d.wild === 'deer' ? V.gate : d.g) === g);
      if (hiders.length) { c.save(); c.beginPath(); c.rect(-20, -60, E.viewW + 40, g.y + 60); c.clip(); for (const d of hiders) d.wild === 'deer' ? drawDeer(d, true) : drawCritter(d, true); c.restore(); }
      drawGate(g);
    }
  }
  { const _dps = drawProps; drawProps = function (z) { if (z === 0) safe(drawBack, 'back'); return _dps(z); }; }
  { const _de = drawEnt; drawEnt = function (e) { if (!e.wild) return _de(e); if (ART.ok) safe(() => (e.wild === 'deer' ? drawDeer(e, false) : drawCritter(e, false)), 'draw'); }; }
  function drawLate() {
    if (!ART.ok || G.room !== ROOM) return; const c = E.ctx;
    for (const l of leaves) { const x = l.x - E.camX; c.save(); c.globalAlpha = l.age > 3 ? Math.max(0, 1 - (l.age - 3) / 2) : 1; c.translate(Math.round(x), Math.round(l.y)); if (l.y < l.gy) c.rotate(Math.sin(l.rot) * 0.9); c.fillStyle = l.c; c.fillRect(-l.s, -l.s / 2, l.s * 2, l.s); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-l.s, -0.3, l.s * 2, 0.6); c.restore(); }
    for (const b of air) drawBfly(b.x, b.y, b.col, b.t, b.fire);
    if (V) {
      const b = V.fx.bfly; if (b && b.fly && !b.gone) drawBfly(b.x, b.y, b.col, E.t);
      if (hand.on) { const x = marina.x + marina.dir * 17 * marina.scale / 1.18, y = marina.y + marina.offY - 31; if (has('ing_apple')) drawSprite('ing_apple', x, y + 5, { scale: 0.3 }); else emoji('🍎', x, y, 8); }
      if (V.wish && !V.wish.d.hidden) { const d = V.wish.d, y = d.y - d.h - 9 + Math.sin(E.t * 5) * 1.5; c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(d.x - E.camX, y, 6.5, 0, 7); c.fill(); c.beginPath(); c.arc(d.x - E.camX - d.dir * 3, y + 7, 1.6, 0, 7); c.fill(); emoji('🍎', d.x, y + 0.5, 7); }
      // the family is out but off the picture: a little tab at the edge shows which way
      const t = tab(); if (t) { const bob = Math.sin(E.t * 4) * 1.5 * t.side; rect(t.x - 9 + bob, t.y - 10, 18, 20, 'rgba(43,35,64,.7)'); emoji('🦌', t.x + bob, t.y - 3, 8); emoji(t.side < 0 ? '◀' : '▶', t.x + bob, t.y + 6, 6); }
    }
  }
  { const _dx = drawExitSigns; drawExitSigns = function () { _dx(); safe(drawLate, 'late'); }; }
  function tab() {
    if (!V || V.phase === 'enter' && V.t < 2.4 || V.phase === 'exit') return null; const herd = V.deer.filter(d => !d.hidden); if (!herd.length || herd.some(d => onScreen(d.x, -6))) return null;
    const hx = herd.reduce((a, d) => a + d.x, 0) / herd.length, side = hx < E.camX ? -1 : 1; return { side, hx, x: side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(E.camX + E.viewW, ROOMS[ROOM].w) - 14, y: 86 };
  }

  // ---------------------------------------------------------------- taps
  function wildAt(wx, wy) {
    if (!ART.ok || G.room !== ROOM) return null;
    if (V && V.phase !== 'exit') { const ds = V.deer.filter(d => !d.hidden && !d.behind).sort((a, b) => b.y - a.y); for (const d of ds) { const k = depthScale(d.y), y = d.y - d.z; if (Math.abs(wx - d.x) < d.hw * k + 5 && wy > y - d.h * k - 6 && wy < y + 5) return { deer: d }; } }
    for (const c of small) { const y = c.y - c.z; if (c.rot ? Math.abs(wx - c.x) < 14 && Math.abs(wy - c.y) < 14 : Math.abs(wx - c.x) < c.hw + 6 && wy > y - c.h - 7 && wy < y + 6) return { crit: c }; }
    for (const b of air) if (Math.abs(wx - b.x) < 9 && Math.abs(wy - b.y) < 9) return { fly: b };
    for (const l of leaves) if (l.y < l.gy && Math.abs(wx - l.x) < 9 && Math.abs(wy - l.y) < 9) return { leaf: l };
    return null;
  }
  { const _ht = hitTest; hitTest = function (wx, wy) {
      let h; hideBase = true; try { h = _ht(wx, wy); } finally { hideBase = false; }
      if (typeof marina === 'undefined' || G.room !== ROOM || (h && (h.kind === 'mess' || h.kind === 'toy'))) return h;
      const w = wildAt(wx, wy); if (!w) return h;
      if (h && (h.kind === 'ent' || h.kind === 'self')) { const o = h.kind === 'self' ? marina : h.e, me = w.deer || w.crit; if (!me || me.y < o.y - 0.5) return h; }   // whoever stands in front gets the tap
      return { kind: 'wild', w };
    }; }
  { const _in = interact; interact = function (hit, wx, wy) {
      if (hit.kind !== 'wild') return _in(hit, wx, wy); const w = hit.w;
      if (w.deer) return tapDeer(w.deer);
      UI.closeActions();
      if (w.crit) return w.crit.tap && w.crit.tap();
      if (w.fly) { const b = w.fly; Audio2.blip(28, 'sine', 0.06, 0.05); emit('sparkle', b.x, b.y, 4); if (b.fire) { b.hx = b.x + rnd(-40, 40); b.hy = b.y - 30; b.t = 0; } else { b.sit = 2.6; emit('heart', marina.x, marina.y - 84, 1, { size: 8 }); } return; }
      if (w.leaf) { const l = w.leaf; l.vy = -46; l.ph += 2; Audio2.blip(pick([19, 21, 24]), 'sine', 0.05, 0.05); emit('sparkle', l.x, l.y, 3); }
    }; }
  { const _ot = onTap; onTap = function (px, py) {
      if (typeof marina !== 'undefined' && G.room === ROOM && !G.busy && V) { const t = tab(), [wx, wy] = toWorld(px, py);
        if (t && Math.abs(wx - t.x) < 12 && wy > t.y - 13 && wy < t.y + 13) { UI.closeActions(); Audio2.blip(9, 'triangle', 0.05, 0.1); const near = V.deer.filter(d => !d.hidden).reduce((a, d) => (t.side > 0 ? Math.min(a, d.x) : Math.max(a, d.x)), t.side > 0 ? 1e9 : -1e9) - t.side * 52; V.invited = true; if (['sit', 'cheer', 'sad'].includes(marina.state)) marina.state = 'idle'; mover().walkTo(near, null, null, FLOOR); return; } }
      return _ot(px, py);
    }; }

  // ---------------------------------------------------------------- for the rest of the game (and for testing)
  window.Wildlife = {
    visit(kind) { return startVisit(kind); },                  // start a deer visit now; kind (optional) = the first thing they do: graze, headsup, cross, chase, sniff, lick, rub, butterfly
    active() { return !!V && V.phase !== 'exit'; },            // true while the deer are out
    soon(sec) { next = sec == null ? 1 : sec; },             // have the next visit come in `sec` seconds of quiet backyard time
    calm() {                                                   // make them leave at once (bounding off if she can see them, simply gone if a screen is up)
      if (!V) return; UI.closeActions(); if (G.room !== ROOM || screenUp() || !V.deer.some(d => !d.hidden && onScreen(d.x, 20))) return endVisit();
      if (V.lock) { V.lock = false; hand.on = false; armDown(); busy(false); } leave(true); V.scared = false; const v = V; setTimeout(() => { if (V === v) endVisit(); }, 2600);
    },
    small(kind) { return SMALL[kind] ? SMALL[kind]() !== false : false; },   // bird, squirrel, rabbit, chip (testing)
    gates: GATES, beats: Object.keys(BEATS),
    get state() { return V ? { t: +V.t.toFixed(2), phase: V.phase, beat: V.beat || null, cx: Math.round(V.cx), lock: V.lock, wary: V.wary > 0, wish: V.wish ? V.wish.d.kind : null, deer: V.deer.map(d => ({ kind: d.kind, x: Math.round(d.x), y: Math.round(d.y), an: d.an, dir: d.dir, hidden: d.hidden, behind: d.behind })) } : { next: Math.round(next), small: small.map(c => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y - c.z), st: c.st })), air: air.map(b => [Math.round(b.x), Math.round(b.y), b.sit > 0 ? 1 : 0]), leaves: leaves.map(l => [Math.round(l.x), Math.round(l.y), l.y < l.gy ? 1 : 0]) }; },
  };
})();
