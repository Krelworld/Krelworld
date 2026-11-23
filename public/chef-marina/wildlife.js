// Chef Marina — backyard life. Now and then a family of deer (a doe, a young buck and two spotted fawns) comes out of
// the woods for a little visit; now and then (never at the same time) a flock of wild turkeys pecks its way across the
// lawn, the tom fanning his tail. In between there is small life: squirrels (one up a tree, or two chasing round a trunk),
// robins, a cardinal and a blue jay at the bird feeder (more birds when she has just filled it), a crow, a chipmunk at the
// workbench or popping out of a hole in the lawn, a rabbit, butterflies or fireflies, drifting leaves. Nothing here needs
// reading and nothing blocks Marina: you look, you tap, something small and nice happens.
// Art: assets/wild/wild.png + wild.json  (f = frames [sx,sy,w,h,dx,dy] drawn from the animal's feet, a = animations).
// Every animal is an entry in ENTS (so it is depth-sorted with everybody by its y = where its feet touch the grass; a
// climbing or perched one keeps that y and goes up by z) and our own tap test (wildAt) finds it before the game's.
// Sounds: Audio2 blips and noise, plus assets/sfx/turkey_gobble.mp3 and turkey_cluck.mp3.
// Wildlife.onEvent (set by another file) hears 'turkeys', 'turkey_display' and 'squirrel' as they happen.
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
    c.save(); c.translate(Math.round(x - E.camX), Math.round(y)); if (o.rot) c.rotate(o.rot); c.scale((o.flip ? -s : s) * (o.sx == null ? 1 : o.sx), s * (o.sy || 1));   // sx / sy: a turkey turning round, puffing up
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
    // turkeys: a recorded gobble and clucks, the rest made here
    gobble(b, big) { if (!onScreen(b.x, 90)) return; try { Audio2.sfx('turkey_gobble', { vol: big ? 0.95 : 0.5, rate: big ? 0.96 : 1.02 + Math.random() * 0.08 }); } catch (e) { } },
    cluck(b) { if (!onScreen(b.x, 60)) return; if (chance(0.4)) { try { Audio2.sfx('turkey_cluck', { vol: 0.3 }); } catch (e) { } } else { Audio2.blip(pick([5, 7, 9]), 'square', 0.035, 0.035); setTimeout(() => Audio2.noise(0.04, 0.03, 1600), 60); } },
    putt(b) { if (!b || !onScreen(b.x, 60)) return; Audio2.blip(10, 'square', 0.04, 0.06); Audio2.noise(0.03, 0.05, 2000); },          // the alarm call: "putt!"
    peep(b) { if (!onScreen(b.x, 40)) return; const n = pick([31, 33, 34]); Audio2.blip(n, 'sine', 0.05, 0.04); setTimeout(() => Audio2.blip(n + 2, 'sine', 0.06, 0.035), 70); },
    puff(b) { if (!onScreen(b.x, 60)) return; Audio2.noise(0.09, 0.09, 1200); Audio2.noise(0.35, 0.06, 140); setTimeout(() => Audio2.blip(-22, 'triangle', 0.55, 0.07), 60); },   // the tom's "pfft... vmmm"
    flap(b) { if (!onScreen(b.x, 60)) return; for (let i = 0; i < 3; i++) setTimeout(() => Audio2.noise(0.06, 0.07, 700), i * 90); },
    tick(b) { if (onScreen(b.x, 10) && chance(0.4)) Audio2.noise(0.02, 0.025, 3200); },
    seeds() { for (let i = 0; i < 6; i++) setTimeout(() => Audio2.noise(0.03, 0.04, 4200), 380 + i * 45); },
    caw(c) { if (!onScreen(c.x, 40)) return; [0, 230].forEach(d => setTimeout(() => { Audio2.blip(-4, 'sawtooth', 0.12, 0.035); Audio2.noise(0.09, 0.035, 1800); }, d)); },
    song(c) { if (!onScreen(c.x, 30)) return; if (c.art === 'cardinal') [24, 22, 19].forEach((n, i) => setTimeout(() => Audio2.blip(n, 'sine', 0.09, 0.045), i * 110)); else if (c.art === 'bluejay') [0, 260].forEach(d => setTimeout(() => Audio2.blip(15, 'square', 0.07, 0.03), d)); else snd.chirp(); },
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
  const Q = (d, ...cmds) => { d.q.push(...cmds.flat(3)); return d; };
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
  let T = null, tnext = -1, tAway = 0, tBusyT = 0, tGot = false;   // the turkey flock (see "wild turkeys" below)
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
    if (V || T || !ART.ok || typeof marina === 'undefined' || G.room !== ROOM || !hid('title') || !hid('panel')) return false;   // (never while the turkeys are out)
    const gate = pickGate(), cx = beside();
    V = { t: 0, len: rnd(26, 35), gate, cx, deer: ['doe', 'buck', 'fawna', 'fawnb'].map(mkDeer), timers: [], done: [], first: kind || null, phase: 'enter', wait: 0, lock: false, wary: 0, flipS: chance(0.5), wish: null, fed: [], over: false, friendT: rnd(9, 15), said: false, fx: {} };
    for (const d of V.deer) { d.hidden = true; ENTS.push(d); }
    for (const c of small.slice()) if (c.type === 'bird' || c.type === 'crow') c.flee(); else if (c.type === 'rabbit' || c.type === 'hole') c.hide && c.hide();
    enter(); return true;
  }
  function endVisit() {
    if (!V) return; for (const d of V.deer) { const i = ENTS.indexOf(d); if (i >= 0) ENTS.splice(i, 1); }
    if (myBusy) busy(false); hand.on = false; next = V.scared ? rnd(60, 100) : rnd(120, 240); V.over = true; V = null;
    tnext = Math.max(tnext, rnd(40, 70));                      // and the turkeys keep a good while away from the deer
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

  // ---------------------------------------------------------------- wild turkeys
  // Now and then (never while the deer are out) a flock walks out of the woods in a line: a hen leading her fuzzy poults,
  // another hen (sometimes two), the big tom at the back. They peck their way slowly across the lawn, clucking, and now and
  // then the tom puffs himself up, fans his tail, drums and turns slowly round to show it off. Tap one: 🌽 scatter corn
  // (they all rush over; the poults bump into each other), 👋 wave, 🦃 gobble back (Marina's "Gobble gobble gobble!" and
  // the tom answers with a big gobble and fans out). Running at them sends them hurrying back into the woods with flapping
  // hops. The birds work like the deer: each is in ENTS, has a queue of little commands (go / do / fn) and our own tap test
  // finds it. The flock itself is a point (fx, fy) drifting slowly across the lawn; every bird keeps to its place in the
  // line behind it (a poult keeps close behind its mother).
  try { if (typeof SAY_ICON !== 'undefined' && !SAY_ICON.m_turkey) SAY_ICON.m_turkey = '🦃'; } catch (e) { }
  const TK = { tom: { art: 'tom', s: 0.9, hw: 20, h: 52 }, hen: { art: 'hen', s: 1, hw: 14, h: 40 }, hen2: { art: 'hen2', s: 0.96, hw: 13, h: 38 }, hen3: { art: 'hen', s: 0.92, hw: 13, h: 37 }, poult: { art: 'poult', s: 0.62, hw: 7, h: 18, poult: true } };
  const TGAIT = { walk: ['walk', 8, 15], strut: ['walk', 6, 10], hurry: ['walk', 12, 32], trot: ['run', 13, 46], run: ['run', 16, 74], scurry: ['walk', 16, 30], dash: ['walk', 22, 58], hop: ['flap', 12, 84] };
  const ev = k => { try { const W = window.Wildlife; if (W && typeof W.onEvent === 'function') W.onEvent(k); } catch (e) { } };   // tell the rest of the game ('turkeys', 'turkey_display', 'squirrel')
  const tcount = (b, an) => ((ART.a[b.art] || {})[an] || [0]).length;
  const tAfter = (sec, f) => T.timers.push({ t: T.t + sec, f });
  const tLive = () => (T ? T.birds.filter(b => !b.hidden && !b.behind) : []);
  const tomOf = () => T && T.birds.find(b => b.kind === 'tom');
  const gotT = () => { if (!tGot) { tGot = true; try { window.did && did('turkey'); } catch (e) { } } };
  function clearZone() {                                       // the part of the picture with no buttons over it (the same margins the camera keeps)
    const cs = E.cssScale || 1, land = E.cv && E.cv.width > E.cv.height; return [E.camX + 62 / cs + 8, E.camX + E.viewW - (land ? 82 : 78) / cs - 8];
  }
  function mkTurkey(kind, i) {
    const b = { ...ENTLIKE, wild: 'turkey', kind, id: 'wild_turkey' + i, room: ROOM, x: 0, y: 160, dir: 1, an: 'stand', at: 0, fps: 8, mode: 'loop', rev: false, q: [], cur: null, behind: false, sink: 0, sinkTo: 0, z: 0, rot: 0, alpha: 1, hidden: true, glow: 0, sx: 1, puff: 0, turn: 0, update: NOP, ...TK[kind] };
    Object.defineProperty(b, 'here', { get() { return this.room === G.room && !this.hidden && !this.behind && !hideBase; } }); return b;
  }
  function stepTurkey(b, dt) {
    b.at += dt; b.sink += clamp(b.sinkTo - b.sink, -60 * dt, 60 * dt);
    if (b.turn > 0) { b.turn = Math.min(1, b.turn + dt / 1.3); const c = Math.cos(b.turn * Math.PI); b.sx = sgn(c) * Math.max(0.3, Math.abs(c)); if (b.turn >= 1) { b.turn = 0; b.sx = 1; b.dir = -b.dir; } }   // a slow turn on the spot
    if (b.motion) { if (b.motion(b, dt) === false) { b.motion = null; play(b, 'stand'); } return; }
    let c = b.cur;
    if (!c) {
      c = b.cur = b.q.shift() || null; if (!c) { if (b.an !== 'stand' && !(b.mode === 'hold' && b.keep)) play(b, 'stand'); return; }
      b.keep = false;
      if (c.fn) { b.cur = null; c.fn(b); return; }
      if (c.go) { const g = TGAIT[c.gait] || TGAIT.walk, an = tcount(b, g[0]) > 1 ? g[0] : 'walk'; c.v = c.v || g[2] * (b.poult && !/scurry|dash/.test(c.gait) ? 1.6 : 1); c.x0 = b.x; c.y0 = b.y; if (b.an !== an || b.mode !== 'loop') play(b, an, { fps: g[1] }); else b.fps = g[1]; }
      else { if (c.face != null) face(b, typeof c.face === 'function' ? c.face() : c.face); if (c.do) play(b, c.do, c); b.keep = c.mode === 'hold'; }
    }
    if (c.go) {
      const dx = c.go[0] - b.x, dy = c.go[1] - b.y, dist = Math.hypot(dx, dy), s = c.v * dt;
      if (Math.abs(dx) > 0.6 && !b.turn) b.dir = sgn(dx);
      if (c.arc) { const tot = Math.hypot(c.go[0] - c.x0, c.go[1] - c.y0) || 1; b.z = Math.sin(clamp(1 - dist / tot, 0, 1) * Math.PI) * c.arc; }
      if (dist <= s) { b.x = c.go[0]; b.y = c.go[1]; b.z = 0; b.cur = null; } else { b.x += dx / dist * s; b.y += dy / dist * s; }
    } else if ((c.t -= dt) <= 0) b.cur = null;
  }
  function drawTurkey(b, back) {
    const y = b.y + b.sink - b.z, near = T && !T.over && !back && T.phase !== 'exit' && !G.busy && Math.abs(b.x - marina.x) < 40; b.glow = clamp(b.glow + (near ? 0.08 : -0.06), 0, 1);
    const pf = b.puff > 0 ? 1 + Math.sin(E.t * 7) * 0.025 * b.puff : 1;
    lit(b.glow, () => put(frame(b.art, b.an, b.at, b.fps, b.mode, b.rev), b.x, y, { s: b.s, flip: b.dir < 0, rot: b.rot, alpha: b.alpha, depth: back ? 0.9 : 0, sx: b.sx * pf, sy: pf }));
  }
  // the bush they come out of: never one right behind Marina; best one at the clear (left) side of the picture or just off it,
  // so that they walk out and across in front of her rather than out from under the buttons
  function pickTGate() {
    const all = freeGates().length ? freeGates() : GATES, ok = all.filter(g => Math.abs(g.x - marina.x) > 44), list = ok.length ? ok : all, z0 = clearZone()[0];
    const near = list.filter(g => g.x > E.camX - 80 && g.x < E.camX + E.viewW + 80), sc = g => (onScreen(g.x, -12) ? 0 : 30) + (g.x < marina.x ? 0 : 50) + Math.abs(g.x - z0) * 0.3;
    return (near.length ? near : list).reduce((a, g) => (sc(g) < sc(a) ? g : a));
  }
  function target(b) {                                         // where this bird wants to be right now
    let x, y;
    if (b.poult && b.mom && !b.mom.hidden && !b.mom.behind) { x = b.mom.x - T.fdir * (8 + b.k * 7); y = b.mom.y + 2 + b.k * 3; }
    else { const k = T.bunch == null ? 1 : T.bunch; x = T.fx - T.fdir * b.ox * k; y = T.fy + b.oy * (2.5 - 1.5 * k); }     // bunched up (k < 1) when they cannot go on
    const gap = b.poult ? 18 : b.kind === 'tom' ? 34 : 26;      // a little room round Marina: never on her toes, never hidden behind her
    if (Math.abs(x - marina.x) < gap) { if (T.pass) y = Math.max(151, Math.min(y, marina.y - 10)); else x = marina.x + sgn(x - marina.x || b.x - marina.x || -T.fdir) * gap; }   // (passing by: behind her)
    return [clamp(x, LX + 4, RX - 4), clamp(y, 151, 173)];
  }
  const passing = () => { const a = T.fx + T.fdir * 20, b = T.fx - T.fdir * (T.span + 20); return marina.x > Math.min(a, b) && marina.x < Math.max(a, b); };   // the line is going by her: they hurry a little
  const blocked = () => !T.pass && sgn(marina.x - T.fx) === T.fdir && Math.abs(marina.x - T.fx) < 46;   // she is standing just ahead of the flock: they wait (and peck) where they are
  function showSpot(t) {                                       // where the tom can show off in full view: not under the buttons, not on top of her
    const L = E.camX + (narrow() ? 40 : 56), R = clearZone()[1] - 30, G0 = narrow() ? 30 : 36; if (R <= L) return null;
    let x = clamp(t.x, L, R); if (Math.abs(x - marina.x) < G0) { const a = marina.x - G0, b = marina.x + G0; x = a >= L && (b > R || Math.abs(a - t.x) < Math.abs(b - t.x)) ? a : b <= R ? b : null; }
    return x;
  }
  function toShow(t, then) {                                   // stroll to the show spot first (a little behind her if he is close), then show off
    const sx = onScreen(t.x, 30) ? showSpot(t) : t.x; if (sx == null) return false;
    const y = Math.abs(sx - marina.x) < 50 ? clamp(marina.y - 6, 151, 168) : clamp(t.y, 152, 168);
    clear(t); if (Math.abs(sx - t.x) > 3 || Math.abs(y - t.y) > 3) Q(t, go(sx, y, 'strut')); Q(t, then); return true;
  }
  function startTurkeys() {
    if (T || V || !ART.ok || !ART.a.tom || typeof marina === 'undefined' || G.room !== ROOM || !hid('title') || !hid('panel')) return false;
    const n = narrow(), sp = n ? 0.7 : 1, line = n ? ['hen', 'poult', 'poult', 'hen2', 'tom'] : ['hen', 'poult', 'poult', 'hen2'].concat(chance(0.5) ? ['poult'] : [], ['tom'], chance(0.4) ? ['hen3'] : []);   // (an upright phone has room for fewer)
    const g = pickTGate(), mid = E.camX + E.viewW / 2, fdir = sgn(mid - g.x || marina.x - g.x || 1);
    T = { t: 0, birds: [], timers: [], gate: g, fdir, fx: g.x + fdir * 30, fy: 160, speed: narrow() ? rnd(2.2, 3) : rnd(3.5, 5), left: rnd(42, 58), phase: 'enter', lock: false, wary: 0, wait: 0, disp: false, corn: null, kern: [], gobT: rnd(5, 9), dispT: rnd(8, 13), over: false, arrived: false, said: false, exitT: 0 };   // (slowly: an upright phone shows very little lawn)
    T.pass = n && fdir < 0 && g.x > marina.x;                  // upright phone, coming from under the buttons: they walk on past behind her into the clear part
    let ox = 0, mom = null, k = 0, na = 0;
    line.forEach((kind, i) => {
      const b = mkTurkey(kind, i);
      if (b.poult) { b.mom = mom; b.k = k++; b.ox = ox + 10 * k * sp; b.oy = 3; }
      else { if (mom) ox += (26 + 9 * k) * sp; mom = b; k = 0; b.ox = ox; b.oy = [0, 6, -3, 4, 1][na++ % 5]; }
      T.birds.push(b); ENTS.push(b);
    });
    T.span = Math.max(...T.birds.map(b => b.ox || 0));
    let d = 0.4; for (const b of T.birds) { d += b.poult ? rnd(0.3, 0.5) : rnd(0.9, 1.3); tAfter(d, () => emerge(b)); }
    tAfter(d + 3, () => { if (T.phase === 'enter') T.phase = 'forage'; });
    for (const c of small.slice()) if (c.type === 'bird' || c.type === 'crow') c.flee(); else if (c.type === 'rabbit' || c.type === 'hole') c.hide && c.hide();
    return true;
  }
  function emerge(b) {                                         // out from behind the bushes, a look round, and down onto the lawn
    const g = T.gate, s = T.fdir; b.hidden = false; b.behind = true; b.g = g; b.x = g.x + rnd(-6, 6) - s * 4; b.y = g.y - 1; b.dir = s; b.sink = b.sinkTo = b.h + 2; play(b, 'stand');
    b.sinkTo = 0; g.shake = Math.max(g.shake, b.poult ? 0.5 : 0.9); if (onScreen(g.x, 20)) snd.rustle();
    if (!T.arrived) { T.arrived = true; ev('turkeys'); }
    Q(b, act(b.poult ? 'peep' : 'alert', b.poult ? 0.45 : 1, { fps: 8, mode: 'hold' }), fn(x => { if (x.poult) snd.peep(x); else if (chance(0.5)) snd.cluck(x); }), go(g.x + s * (g.hw + 10), g.y - 1, b.poult ? 'scurry' : 'walk'), fn(x => { x.behind = false; }),
      fn(x => { const t = target(x); Q(x, go(t[0], t[1], x.poult ? 'dash' : 'walk')); }));
  }
  function think(b) {                                          // an idle bird: catch up with its place in the line, or peck, look up, take a step
    const tg = target(b), d = Math.hypot(tg[0] - b.x, tg[1] - b.y);
    if (b.poult) {
      if (d > 7) return void Q(b, go(tg[0], tg[1], d > 26 ? 'dash' : 'scurry'), d > 26 && chance(0.5) ? fn(x => snd.peep(x)) : []);
      const r = Math.random();
      if (r < 0.5) Q(b, act('peck', rnd(0.45, 0.8), { fps: 12, mode: 'hold' }), fn(x => snd.tick(x)));
      else if (r < 0.68) Q(b, fn(x => snd.peep(x)), act('peep', 0.55, { fps: 11, mode: 'hold' }));
      else Q(b, act('stand', rnd(0.3, 0.9)));
      return;
    }
    if (d > 10) return void Q(b, go(tg[0], tg[1], d > 70 ? 'hurry' : b.kind === 'tom' ? 'strut' : 'walk'));
    const r = Math.random();
    if (r < 0.6) Q(b, act('peck', 0.9, { fps: 9.5, mode: 'hold' }), fn(x => snd.tick(x)), r < 0.3 ? [act('peck', 0.9, { fps: 9.5, mode: 'hold' }), fn(x => snd.tick(x))] : [], act('stand', rnd(0.1, 0.5)));
    else if (r < 0.78) Q(b, act('alert', rnd(1.2, 1.8), { fps: 5, mode: 'hold' }), chance(0.3) ? fn(x => snd.cluck(x)) : []);
    else Q(b, go(b.x + T.fdir * rnd(6, 16), clamp(b.y + rnd(-4, 4), 152, 172), b.kind === 'tom' ? 'strut' : 'walk'));
  }
  // the tom shows off: chest out, wings down, tail fanned, a "pfft... vmmm", a slow turn one way and back again
  const displaySeq = long => [
    fn(b => { if (T) T.disp = true; snd.puff(b); b.puff = 1; if (onScreen(b.x, -10)) ev('turkey_display'); emit('sparkle', b.x - b.dir * 14, b.y - b.h * 0.9, 3, { col: '#ffe9a0', life: 0.6 }); }),
    act('fanup', 0.85, { fps: 8.5, mode: 'hold' }), act('display', long ? 1.6 : 1.1, { fps: 5 }),
    fn(b => { b.turn = 0.001; snd.puff(b); }), act('display', 1.4, { fps: 5 }), act('display', long ? 1.4 : 0.9, { fps: 5 }),
    fn(b => { b.turn = 0.001; }), act('display', 1.4, { fps: 5 }), act('display', 0.6, { fps: 5 }),
    fn(b => { b.puff = 0; snd.puff(b); }), act('fanup', 0.85, { fps: 8.5, mode: 'hold', rev: true }), fn(() => { if (T) T.disp = false; }),
  ];
  function display(t, long) { if (!T || !t || t.hidden || t.behind) return; clear(t); t.turn = 0; t.sx = 1; Q(t, act('alert', 0.5, { fps: 10, mode: 'hold' }), displaySeq(long)); }
  function henAnswer() { const h = tLive().filter(b => !b.poult && b.kind !== 'tom'); if (h.length && chance(0.7)) setTimeout(() => { if (T) snd.cluck(pick(h)); }, 600); }
  // --- 🌽 a handful of corn: everybody comes running
  const pecks = (b, n) => { const o = []; for (let i = 0; i < n; i++) o.push(b.poult ? act('peck', rnd(0.4, 0.55), { fps: 12, mode: 'hold' }) : act('peck', 0.85, { fps: 10, mode: 'hold' }), fn(eat)); return o; };
  function eat(b) {
    snd.tick(b); if (!T || !T.corn) return; const bx = b.x + b.dir * b.hw * 0.7 * b.s; let best = null, bd = 15;
    for (const k of T.kern) if (k.down) { const d = Math.abs(k.x - bx) + Math.abs(k.y - b.y) * 1.5; if (d < bd) { bd = d; best = k; } }
    if (best) T.kern.splice(T.kern.indexOf(best), 1);
    if (!T.kern.length && !T.cornEnd) { T.cornEnd = true; tAfter(1.5, cornDone); }
  }
  function scatterCorn() {
    if (!T || T.lock || T.phase === 'exit' || T.corn) return; UI.closeActions();
    const live = tLive(); if (!live.length) return;
    const near = live.reduce((a, b) => (Math.abs(b.x - marina.x) < Math.abs(a.x - marina.x) ? b : a)), s = sgn(near.x - marina.x || 1), [z0, z1] = clearZone();
    const d0 = narrow() ? 34 : 40; let cx = marina.x + s * d0; if (cx < z0 || cx > z1) { const o = marina.x - s * d0; if (o > z0 && o < z1) cx = o; }   // not under the buttons
    cx = clamp(cx, LX + 12, RX - 12); const cy = clamp(marina.y - 2, 153, 170), side = sgn(cx - marina.x || 1);
    const m = mover(); m.stop && m.stop(); marina.dir = side; T.lock = true; busy(true);
    if (typeof playAnim === 'function' && frameCount('marina_reach')) playAnim('marina_reach', { fps: 12, dur: 0.55 }); else marina.state = 'cheer';
    const hx = marina.x + side * 9, hy = marina.y - 34;
    T.kern = []; for (let i = 0; i < 20; i++) T.kern.push({ x0: hx, y0: hy, x: hx, y: hy, tx: cx + side * (narrow() ? rnd(-5, 9) : rnd(-6, 16)), ty: cy + rnd(-5, 6), k: -i * 0.022, dur: rnd(0.45, 0.65), down: false, col: pick(['#f6c844', '#f2b631', '#ffd95a']) });
    snd.seeds(); T.corn = { x: cx, y: cy, side }; T.cornEnd = false; T.disp = false;
    setTimeout(() => { if (!T) { busy(false); return; } T.lock = false; busy(false); if (marina.state === 'cheer' || marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; } rush(); }, 650);
  }
  function rush() {
    if (!T || !T.corn) return; const c = T.corn, live = tLive(), adults = live.filter(b => !b.poult), kids = live.filter(b => b.poult);
    // round the corn, on its far side from her (an upright phone: close round it, deeper, so they stay in the picture)
    const n = narrow(), SL = n ? [[7, -9], [-1, 10], [15, 3]] : [[18, -8], [4, 10], [32, 3], [16, -13]], TO = n ? [12, -15] : [44, -4], ad = adults.filter(b => b.kind !== 'tom').concat(adults.filter(b => b.kind === 'tom'));
    ad.forEach((b, i) => {
      const o = b.kind === 'tom' ? TO : SL[i % SL.length], x = clamp(c.x + c.side * o[0], LX, RX), y = clamp(c.y + o[1], 151, 173);
      clear(b); b.turn = 0; b.sx = 1; b.puff = 0;
      Q(b, act('alert', 0.2 + i * 0.1, { fps: 14, mode: 'hold', face: c.x }), fn(q => { if (chance(0.6)) snd.cluck(q); }), go(x, y, Math.abs(b.x - x) > 70 ? 'trot' : 'hurry'), fn(q => face(q, c.x)), pecks(b, 6));
    });
    kids.forEach((b, i) => { const x = c.x + c.side * (2 + i * 6), y = clamp(c.y + 3 + (i % 2) * 3, 152, 174); clear(b); Q(b, act('peep', 0.25, { fps: 14, mode: 'hold', face: c.x }), fn(q => snd.peep(q)), go(x, y, 'dash'), fn(q => face(q, c.x + (i % 2 ? 4 : -4))), pecks(b, 7)); });
    if (kids.length > 1) { tAfter(2.6, () => bump(kids[0], kids[1])); tAfter(4.6, () => bump(kids[kids.length - 1], kids[0])); }
    tAfter(1.4, () => { gotT(); try { say(pick(['m_yay', 'm_giggle'])); } catch (e) { } if (['idle', 'cheer'].includes(marina.state)) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1300); } });
    tAfter(10, cornDone);
  }
  function cornDone() { if (!T || !T.corn) return; T.fx = T.corn.x + T.fdir * 10; T.corn = null; T.kern = []; T.left = Math.max(T.left, 14); for (const b of tLive()) if (!b.motion) clear(b); }
  const knock = (s, amt) => { let k = 0; return (d, dt) => { k += dt / 0.5; const e = Math.min(1, k); d.x += s * 22 * amt * dt * (1 - e); d.z = Math.sin(e * Math.PI) * 4 * amt; d.rot = Math.sin(e * Math.PI) * 0.5 * s * amt; if (d.an !== 'peep') play(d, 'peep', { fps: 12, mode: 'hold' }); if (k >= 1) { d.z = 0; d.rot = 0; return false; } }; };
  function bump(a, b) {                                        // one poult barges into the other: boing, peep, both sit back on their tails
    if (!T || !T.corn || !a || !b || a === b || a.hidden || b.hidden || a.motion || b.motion) return; const s = sgn(b.x - a.x || 1);
    clear(a); Q(a, go(b.x - s * 4, b.y, 'dash', { v: 70 }), fn(q => { if (!T) return; snd.peep(q); emit('star', (q.x + b.x) / 2, q.y - 12, 1, { size: 7, vy: -30 }); Audio2.blip(18, 'triangle', 0.04, 0.05); clear(b); b.motion = knock(s, 1); q.motion = knock(-s, 0.5); setTimeout(() => b.hidden || snd.peep(b), 120); }));
  }
  // --- 🦃 gobble back: Marina's "Gobble gobble gobble!", then the tom's big answer and his fan
  function gobbleBack() {
    if (!T || T.phase === 'exit') return; UI.closeActions(); const tom = tomOf(), live = tLive();
    const look = tom && !tom.hidden && !tom.behind ? tom : live[0]; if (look && !mover().moving) marina.dir = sgn(look.x - marina.x || 1);
    if (['idle', 'cheer'].includes(marina.state)) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1500); }
    let pr = null; try { pr = say('m_turkey'); } catch (e) { }
    T.wait = Math.max(T.wait, 10);
    for (const b of live) if (!b.motion && b !== tom) { b.cur = null; b.q.unshift(act(b.poult ? 'peep' : 'alert', 1.4, { fps: 9, mode: 'hold', face: marina.x })); }
    let done = false;
    const answer = () => { if (done) return; done = true; if (!T || T.phase === 'exit' || !tom || tom.hidden || tom.behind) return; gotT();
      if (T.disp && tom.puff > 0) { snd.gobble(tom, true); emit('note', tom.x + tom.dir * 10, tom.y - tom.h - 4, 2); henAnswer(); return; }   // already all fanned out: he just gobbles back
      clear(tom); tom.turn = 0; tom.sx = 1; tom.puff = 0; T.dispT = Math.max(T.dispT, 14);
      Q(tom, act('alert', 0.35, { fps: 12, mode: 'hold', face: marina.x }), fn(b => { snd.gobble(b, true); emit('note', b.x + b.dir * 10, b.y - b.h - 4, 2); }), act('gobble', 1.2, { fps: 5.5, mode: 'hold' }), fn(b => { if (!toShow(b, [act('alert', 0.3, { fps: 10, mode: 'hold', face: marina.x }), displaySeq(true)])) Q(b, fn(q => face(q, marina.x)), displaySeq(true)); })); henAnswer(); };
    Promise.resolve(pr).then(() => setTimeout(answer, 200), () => setTimeout(answer, 200)); setTimeout(answer, 2600);
  }
  function waveT() {
    if (!T) return; UI.closeActions(); try { UI.bubble(marina, '👋', 1500); } catch (e) { } Audio2.jingle([7, 12, 16], 0.07, 'triangle');
    const live = tLive(), near = live.slice().sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x))[0]; if (near && !mover().moving) marina.dir = sgn(near.x - marina.x || 1);
    if (['idle', 'cheer'].includes(marina.state)) { marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1200); }
    T.wait = Math.max(T.wait, 3);
    live.filter(b => !b.motion && !(b.kind === 'tom' && T.disp)).forEach((b, i) => { b.cur = null; b.q.unshift(...(b.poult ? [act('peep', 0.3 + i * 0.1, { fps: 14, mode: 'hold', face: marina.x }), fn(q => snd.peep(q)), act('peep', 0.6, { fps: 10, mode: 'hold' })]
      : b.kind === 'tom' ? [act('alert', 0.6, { fps: 10, mode: 'hold', face: marina.x }), fn(q => snd.gobble(q)), act('gobble', 1, { fps: 6.5, mode: 'hold' })] : [act('alert', 1.8, { fps: 8, mode: 'hold', face: marina.x }), fn(q => { if (i < 3) snd.cluck(q); })])); });
  }
  function tapTurkey(b) {
    if (!T || T.phase === 'exit' || T.lock) return; T.wait = Math.max(T.wait, 3);
    if (!b.motion && !(T.disp && b.kind === 'tom') && !(b.cur && b.cur.go && /run|trot|dash|hop/.test(b.cur.gait))) { b.cur = null; b.q.unshift(act(b.poult ? 'peep' : 'alert', 1.6, { fps: 10, mode: 'hold', face: marina.x })); }
    if (b.poult) snd.peep(b); else snd.cluck(b);
    UI.actions({ get x() { return b.x; }, get y() { return b.y - b.h * (E.depth || 1) - 2; }, get here() { return !!T && !T.over && T.phase !== 'exit' && !b.hidden; } }, [A('🌽', scatterCorn), A('👋', waveT), A('🦃', gobbleBack)]);
  }
  // --- back into the woods: in a line, or (scared) at a run with flapping hops
  function leaveT(scared) {
    if (!T || T.phase === 'exit') return; T.phase = 'exit'; T.timers.length = 0; T.scared = !!scared; T.exitT = 0; T.corn = null; T.kern = []; T.disp = false;
    const live = T.birds.filter(b => !b.hidden), mx = marina.x, hx = live.length ? live.reduce((a, b) => a + b.x, 0) / live.length : T.fx;
    let list = freeGates(); if (!list.length) list = GATES;
    // a bush on their own side of her (they do not walk past her to go home), the next one along if there is one
    const side = sgn(hx - mx || -T.fdir), mine = list.filter(g => sgn(g.x - mx) === side && Math.abs(g.x - mx) > (scared ? 60 : 34)), pool = mine.length ? mine : list;
    const way = scared ? side : T.fdir, ahead = pool.filter(g => sgn(g.x - hx) === way);
    const g = T.gate = nearGate(hx + way * 30, ahead.length ? ahead : pool);
    live.sort((a, b) => Math.abs(a.x - g.x) - Math.abs(b.x - g.x));
    let delay = 0;
    live.forEach((b, i) => {
      clear(b); b.turn = 0; b.sx = 1; b.puff = 0; b.g = g;
      if (b.behind) { b.sinkTo = b.h + 2; Q(b, act('stand', 0.2 + b.h / 60), fn(x => { x.hidden = true; })); return; }
      const sd = sgn(b.x - g.x || 1), edge = g.x + sd * (g.hw + 10);
      if (scared) {
        Q(b, act(b.poult ? 'peep' : 'alert', 0.15 + i * 0.06, { fps: 14, mode: 'hold', face: mx }));
        if (!b.poult && Math.abs(b.x - edge) > 60) Q(b, go(lerp(b.x, edge, 0.25), b.y, 'run'), fn(x => snd.flap(x)), go(lerp(b.x, edge, 0.6), lerp(b.y, g.y + 6, 0.5), 'hop', { arc: 5 }));
        Q(b, go(edge, g.y - 1, b.poult ? 'dash' : 'run'));
      } else { delay += b.poult ? 0.25 : 0.55; Q(b, act(b.poult ? 'peck' : 'stand', delay, { fps: 6, mode: 'hold' }), go(edge, g.y - 1, b.poult ? 'scurry' : b.kind === 'tom' ? 'strut' : 'walk')); }
      Q(b, fn(x => { x.behind = true; g.shake = 1; if (onScreen(g.x, 20)) snd.rustle(); }), go(g.x + sd * 4, g.y - 1, scared ? 'trot' : 'walk'), fn(x => { x.sinkTo = x.h + 2; }), act('stand', 0.25 + b.h / 60), fn(x => { x.hidden = true; }));
    });
    if (scared) { const t = tomOf(); if (t && !t.hidden) snd.putt(t); for (const b of live) if (!b.poult && onScreen(b.x)) emit('dust', b.x, b.y - 3, 2, { life: 0.5 }); }
    else { const t = tomOf(); if (t && !t.hidden && chance(0.6)) setTimeout(() => T && snd.gobble(t), 900); }
  }
  function endTurkeys() {
    if (!T) return; for (const b of T.birds) { const i = ENTS.indexOf(b); if (i >= 0) ENTS.splice(i, 1); }
    if (T.lock && myBusy) busy(false); tnext = T.scared ? rnd(150, 240) : rnd(200, 330); T.over = true; T = null;
    next = Math.max(next, rnd(25, 45));                        // the deer keep a little while away from the turkeys
  }
  function turkeyTick(dt) {
    const m = mover(), live = tLive();
    if (!V) for (const g of GATES) g.shake = Math.max(0, g.shake - dt * 1.6);
    // Marina charging at them: heads up and a "putt!" first, then off they go
    if (!m.moving) { T.invited = false; T.runT = 0; }
    if (T.phase !== 'exit' && live.length && !T.lock && !T.invited && m.moving && (m.curSpeed || 78) >= 55 && Math.abs(m.tx - marina.x) > 6) {
      const way = sgn(m.tx - marina.x), reach = Math.abs(m.tx - marina.x), ahead = live.filter(b => sgn(b.x - marina.x) === way && reach > Math.abs(b.x - marina.x) - 30);
      const dist = ahead.reduce((a, b) => Math.min(a, Math.abs(b.x - marina.x)), 1e9);
      if (dist < 90) T.runT = (T.runT || 0) + dt;
      if (dist < 36 && T.runT > 0.35) return leaveT(true);
      if (dist < 90 && T.wary <= 0) { for (const b of live) { if (b.motion || (b.kind === 'tom' && T.disp)) continue; b.q.unshift(act(b.poult ? 'peep' : 'alert', 1, { fps: 12, mode: 'hold', face: marina.x })); b.cur = null; } T.wary = 1.2; snd.putt(ahead[0] || live[0]); }
    }
    T.wary = Math.max(0, T.wary - dt); T.wait = Math.max(0, T.wait - dt);
    if (!T.lock) { T.t += dt; for (let i = 0; i < T.timers.length; i++) { const tm = T.timers[i]; if (tm.t <= T.t) { T.timers.splice(i--, 1); tm.f(); if (!T) return; } } }
    // the flock drifts on across the lawn (not while the tom shows off, or there is corn, or she has just said hello)
    T.bunch = clamp((T.bunch == null ? 1 : T.bunch) + (blocked() && T.phase !== 'exit' ? -dt : dt) * 0.25, narrow() ? 0.45 : 0.7, 1);
    if (T.phase === 'enter') { if (!blocked()) T.fx += T.fdir * (narrow() ? 4 : 7) * dt; }
    else if (T.phase === 'forage' && !T.corn) { T.left -= dt; if (!T.disp && T.wait <= 0 && T.wary <= 0) { if (!blocked()) T.fx += T.fdir * T.speed * (T.pass && passing() ? 2.6 : 1) * dt; T.fy = 160 + Math.sin(T.t * 0.21) * 6; } }
    if (T.phase === 'forage' && !T.corn && !T.disp && (T.left <= 0 || T.fx < LX + 24 || T.fx > RX - 24)) return leaveT(false);
    // the tom: a gobble now and then, and now and then the full show (where she can see it, not under the buttons)
    const tom = tomOf();
    if (T.phase === 'forage' && !T.corn && tom && !tom.hidden && !tom.behind && !tom.motion) {
      if ((T.gobT -= dt) <= 0 && !T.disp) { T.gobT = rnd(13, 24); clear(tom); Q(tom, act('alert', 0.35, { fps: 12, mode: 'hold' }), fn(b => snd.gobble(b)), act('gobble', 1.0, { fps: 6.5, mode: 'hold' }), fn(henAnswer)); }
      if ((T.dispT -= dt) <= 0 && !T.disp) {
        if (toShow(tom, fn(b => display(b, false)))) T.dispT = rnd(22, 34); else T.dispT = 2;     // (out of sight he shows off just the same, for nobody)
      }
    }
    // corn in the air and on the grass
    for (const k of T.kern) if (!k.down) { k.k += dt / k.dur; if (k.k >= 1) { k.down = true; k.x = k.tx; k.y = k.ty; } else if (k.k > 0) { k.x = lerp(k.x0, k.tx, k.k); k.y = lerp(k.y0, k.ty, k.k) - Math.sin(k.k * Math.PI) * 16; } }
    for (const b of T.birds) {
      if (b.hidden) continue; stepTurkey(b, dt); if (!T) return;
      if (T.phase !== 'exit' && !b.behind && !b.cur && !b.q.length && !b.motion) {
        const c = T.corn; if (!c) think(b);
        else if (Math.abs(c.x - b.x) > 40) { const s = sgn(b.x - c.x || 1); Q(b, go(c.x + s * rnd(12, 24), clamp(c.y + rnd(-4, 4), 152, 172), b.poult ? 'dash' : 'hurry'), fn(q => face(q, c.x))); }   // late for the corn
        else Q(b, pecks(b, 2));
      }
    }
    // Marina spots them
    if (!T.said && T.phase !== 'exit' && !G.busy && live.some(b => onScreen(b.x, -8))) { T.said = true; setTimeout(() => { if (!T || G.room !== ROOM || G.busy) return; const l = tLive(); if (l[0] && !mover().moving) marina.dir = sgn(l[0].x - marina.x || 1);
      try { if ((typeof jeff !== 'undefined' && jeff.here) || !chance(0.6)) UI.bubble(marina, '🦃', 1800); else say(pick(['m_look', 'm_wow'])); } catch (e) { } }, 900); }
    if (T.phase === 'exit') { T.exitT += dt; if (T.birds.every(b => b.hidden) || T.exitT > (T.scared ? 9 : 24)) endTurkeys(); }
  }
  function turkeyLife(dt, here) {                              // called every frame: the flock's comings and goings
    if (T) {
      if (!here) { if ((tAway += dt) > 15) endTurkeys(); return; } tAway = 0;
      if (screenUp()) return;                                  // a big screen is open: everything waits
      tBusyT = G.busy && !myBusy ? tBusyT + dt : 0; if (tBusyT > 2.5) return;
      turkeyTick(dt);
    } else if (here && seenYard && !V && quiet()) { tnext -= dt; if (tnext <= 0) startTurkeys(); }
  }
  function ttab() {                                            // the flock is out but off the picture: a little tab at the edge shows which way
    if (!T || T.phase !== 'forage' || V) return null; const l = tLive(); if (!l.length || l.some(b => onScreen(b.x, -6))) return null;
    const hx = l.reduce((a, b) => a + b.x, 0) / l.length, side = hx < E.camX ? -1 : 1; return { side, hx, x: side < 0 ? Math.max(E.camX, 0) + 14 : Math.min(E.camX + E.viewW, ROOMS[ROOM].w) - 14, y: 86 };
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
      ev('squirrel');
      c.tap = () => { Audio2.blip(26, 'square', 0.03, 0.04); setTimeout(() => Audio2.blip(26, 'square', 0.03, 0.04), 90); if (c.st === 'run') { c.st = 'sit'; c.t = 1.3; c.an = 'sit'; c.fps = 7; c.fast = true; } else if (c.st === 'climb') { c.t = 0.5; c.fast = true; } };
      c.tick = dt => {
        if (c.st === 'run') { c.x += c.dir * (c.fast ? 100 : 68) * dt; if (c.sat && Math.abs(c.x - (E.camX + E.viewW * c.sat)) < 3 && !mNear(c, 24)) { c.st = 'sit'; c.t = rnd(1.6, 2.6); c.an = 'sit'; c.fps = 6; c.sat = 0; }
          if (sgn(c.tx - c.x) !== c.dir) { if (c.tree) { c.st = 'climb'; c.x = c.tx; c.rot = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; c.t = 0; } else gone(c); } }
        else if (c.st === 'sit') { c.t -= dt; if (c.t <= 0 || mNear(c, 20)) { c.st = 'run'; c.an = 'run'; c.fps = 15; } }
        else { c.t -= dt; if (c.t <= 0) c.z += (c.fast ? 95 : 60) * dt; c.fps = c.t > 0 ? 0.01 : 14; if (c.y - c.z < canopy() - 4) gone(c); }   // (climbing = height: it stays sorted at the foot of the tree, in front of it)
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
    // a cardinal and/or a blue jay come to the bird feeder for a while
    feeder() {
      const f = FEED(); if (!ART.a.cardinal || !onScreen(f.x, -14) || small.some(c => c.type === 'fbird')) return false;
      const spots = perches().sort(() => Math.random() - 0.5), kinds = chance(0.55) ? ['cardinal', 'bluejay'] : [pick(['cardinal', 'bluejay'])];
      kinds.forEach((k, i) => fbird(k, spots[i], i * rnd(1.2, 3), rnd(10, 17)));
    },
    // a chipmunk pops up out of a hole in the lawn, looks round, sits up and stuffs its cheeks, and pops back down again
    hole() {
      const x = spotNear(34, 70), y = rnd(157, 171); if (x == null || !ART.a.chip || !ART.a.chip.stuff || builtXs().some(b => Math.abs(b - x) < 44)) return false;
      const s = chance(0.5) ? 1 : -1;
      const c = critter('hole', { art: 'chip', s: 0.7, x, y, hx: x, hy: y, clipY: y + 0.5, dir: s, st: 'open', an: 'stand', fps: 8, sink: 15, open: 0, t: 0, hw: 7, h: 12, nx: clamp(x + s * rnd(10, 16), LX, RX), seeds: 0, peeks: 0 });
      c.hide = () => { if (!['down', 'close', 'peek'].includes(c.st)) { c.st = 'back'; c.dir = sgn(c.hx - c.x || c.dir); c.an = 'run'; c.fps = 18; c.fast = true; } };
      c.tap = () => { snd.squeak(); emit('sparkle', c.x, c.y - 10, 3); if (c.sink > 2 && c.st !== 'close' && c.st !== 'open') { c.st = 'peek'; c.t = 1.7; c.peeks++; } else c.hide(); };
      c.tick = dt => {
        c.t -= dt;
        if (c.st === 'open') { c.open = Math.min(1, c.open + dt * 2.2); if (c.open >= 1) { c.st = 'up'; emit('dust', c.hx, c.hy - 1, 3, { col: 'rgba(120,86,52,.9)', life: 0.5, size: 2 }); snd.scratch(); } }
        else if (c.st === 'up') { c.sink = Math.max(0, c.sink - 26 * dt); if (c.sink <= 0) { c.st = 'look'; c.t = rnd(1, 1.5); c.turned = false; snd.squeak(); } }
        else if (c.st === 'look') { if (c.t <= 0.55 && !c.turned) { c.turned = true; c.dir = -c.dir; } if (c.t <= 0) { c.dir = sgn(c.nx - c.x || 1); c.st = 'out'; c.an = 'run'; c.fps = 16; } }
        else if (c.st === 'out') { c.x += c.dir * 34 * dt; if (sgn(c.nx - c.x) !== c.dir) { c.x = c.nx; c.st = 'stuff'; c.an = 'stuff'; c.at = 0; c.fps = 5; c.t = 3; c.seeds = 5; } }
        else if (c.st === 'stuff') { c.seeds = Math.max(0, Math.ceil(5 * (1 - c.at * c.fps / 7))); if (c.seeds !== c.ls) { c.ls = c.seeds; if (onScreen(c.x)) Audio2.noise(0.02, 0.02, 3800); } if (c.t <= 0) { c.st = 'back'; c.dir = sgn(c.hx - c.x || 1); c.an = 'run'; c.fps = 16; } }
        else if (c.st === 'back') { c.an = 'run'; c.x += c.dir * (c.fast ? 60 : 40) * dt; if (sgn(c.hx - c.x) !== c.dir) { c.x = c.hx; c.st = 'down'; c.an = 'stand'; } }
        else if (c.st === 'down') { c.sink = Math.min(c.h + 3, c.sink + 45 * dt); if (c.sink >= c.h + 3) { c.st = 'close'; c.t = 1.6; } }
        else if (c.st === 'peek') {                            // tapped while in its hole: down it goes... and up peeps its head again
          c.sink = c.t > 0.8 ? Math.min(c.h + 3, c.sink + 45 * dt) : Math.max(6, c.sink - 20 * dt);
          if (c.t <= 0) { if (!mNear(c, 40) && c.peeks < 3) { c.st = 'up'; } else { c.st = 'down'; } }
        }
        else if (c.st === 'close') { c.open = Math.max(0, c.t / 1.6); if (c.t <= 0) gone(c); }
        if (['look', 'out', 'stuff'].includes(c.st) && mNear(c, mover().moving ? 34 : 18)) { snd.squeak(); c.hide(); }
      };
    },
    // two squirrels chase each other round and round a big tree trunk, all the way up into the leaves
    chase() {
      const tree = BY().trees.filter(t => onScreen(t.x, -16) && Math.abs(t.x - marina.x) > 20).sort((a, b) => Math.abs(a.x - marina.x) - Math.abs(b.x - marina.x))[0]; if (!tree) return false;
      const from = sgn(tree.x - marina.x || 1), x0 = tree.x + from * rnd(70, 90), R = trunkR(tree);
      const mk = (lag, lead) => {
        const c = critter('squirrel', { kind: 'chase', s: 0.62, x: x0 + from * lag * 22, y: 152 + lag * 1.5, dir: -from, st: 'run', an: 'run', fps: 15, tree, R, lag, lead, th: 0, spin: 1, alpha: 1, hw: 9, h: 13, scr: 0 });
        c.tap = () => { for (const q of small.filter(q => q.kind === 'chase')) { q.paused = 0.7; q.fast = true; } snd.squeak(); setTimeout(() => snd.squeak(), 140); emit('sparkle', c.x, c.y - c.z - 8, 3); };
        c.tick = dt => {
          if (c.paused > 0) { c.paused -= dt; c.fps = 0.01; return; }
          const sp = c.fast ? 1.35 : 1;
          if (c.st === 'run') { c.fps = 15; c.x += c.dir * (lead ? 112 : 100) * sp * dt; const ax = c.tree.x - c.dir * c.R; if (sgn(ax - c.x) !== c.dir) { c.st = 'spiral'; c.x = ax; c.th = -c.dir * Math.PI / 2; c.spin = c.dir; } }
          else {
            c.th += c.spin * 3.3 * sp * dt; c.z += 17 * sp * dt; const cs = Math.cos(c.th); c.x = c.tree.x + Math.sin(c.th) * c.R;
            c.alpha = clamp(cs * 3 + 0.4, 0, 1); c.dir = sgn(cs * c.spin || 1); c.rot = c.dir > 0 ? -1.05 : 1.05; c.fps = 16;    // round the back of the trunk it disappears
            if ((c.scr -= dt) <= 0 && cs > 0) { c.scr = 0.45; if (onScreen(c.x)) Audio2.noise(0.05, 0.03, 1500); }
            const top = c.y - canopy(); if (c.z > top - 8) c.alpha = Math.min(c.alpha, clamp((top - c.z) / 8, 0, 1));         // into the leaves
            if (c.z > top) { if (onScreen(c.x)) emit('leaf', c.x, c.y - c.z, 2, { vx: rnd(-20, 20), vy: rnd(-20, 0), life: 2 }); gone(c); }
          }
        };
        return c;
      };
      const a = mk(0, null); mk(1.2, a); ev('squirrel'); snd.squeak(); setTimeout(() => snd.squeak(), 160);
    },
    // a crow drops in, struts about with a nod of the head, pecks, says "caw" and flaps off again
    crow() {
      const x = spotNear(44, 90), y = rnd(152, 170); if (x == null || !ART.a.crow) return false;
      const from = chance(0.5) ? 1 : -1, c = critter('crow', { art: 'crow', s: 0.5, x: x + from * 120, y, z: 90, lx: x, dir: -from, st: 'in', an: 'fly', fps: 10, life: rnd(14, 24), wait: 0.6, hw: 9, h: 19 });
      crowAct(c); return c;
    },
  };
  function spotNear(lo, hi) {                                  // a place on the lawn lo..hi from Marina, in the picture and not under the buttons
    const [z0, z1] = clearZone(); for (const s of chance(0.5) ? [-1, 1] : [1, -1]) { const x = clamp(marina.x + s * rnd(lo, hi), Math.max(z0 - 20, LX + 10), Math.min(z1, RX - 10)); if (Math.abs(x - marina.x) >= lo) return x; }
    return null;
  }
  // the big trees: how far round the trunk is, and where the leaves start (trees.js paints them much bigger than the old placeholders)
  const trunkR = t => (window.Trees ? (t.id === 'oak' ? 26 : 13) : (t.trunk || 30) / 2 + 1);
  const canopy = () => (window.Trees ? 98 : 30);
  function crowAct(c) {
    c.flee = () => { if (c.st !== 'out') { c.st = 'out'; c.dir = sgn(c.x - marina.x || c.dir); c.an = 'fly'; c.fps = 10; snd.caw(c); } };
    c.tap = () => { snd.caw(c); emit('note', c.x, c.y - c.z - 20, 1, { size: 8 }); if (c.st === 'ground' && !c.tapped) { c.tapped = true; c.hopT = 0.35; c.dir = sgn(c.x - marina.x || 1); } else c.flee(); };
    c.tick = dt => {
      if (c.st === 'in') { c.an = 'fly'; c.x += clamp(c.lx - c.x, -60 * dt, 60 * dt); c.z = Math.max(0, c.z - 55 * dt); if (c.z <= 0 && Math.abs(c.lx - c.x) < 3) { c.st = 'ground'; c.an = 'stand'; c.wait = 0.8; } }
      else if (c.st === 'ground') {
        c.life -= dt; c.wait -= dt;
        if (c.hopT > 0) { c.hopT -= dt; c.z = Math.sin(clamp(c.hopT / 0.35, 0, 1) * Math.PI) * 6; c.x += c.dir * 46 * dt; c.an = 'fly'; c.fps = 12; if (c.hopT <= 0) { c.z = 0; c.an = 'stand'; } }
        else if (c.walkT > 0) { c.walkT -= dt; c.x += c.dir * 15 * dt; if (c.walkT <= 0 || c.x < LX || c.x > RX) { c.walkT = 0; c.an = 'stand'; } }
        else if (c.wait <= 0) {
          c.wait = rnd(1, 2.2); const r = Math.random();
          if (r < 0.4) { if (chance(0.4) || c.x < LX + 20 || c.x > RX - 20) c.dir = c.x < LX + 20 ? 1 : c.x > RX - 20 ? -1 : -c.dir; c.an = 'walk'; c.fps = 9; c.walkT = rnd(0.8, 2); }
          else if (r < 0.78) { c.an = 'peck'; c.at = 0; c.fps = 9; c.pk = 0.95; if (chance(0.35)) c.cawT = 0.6; } else c.an = 'stand';
        }
        if (c.pk > 0 && (c.pk -= dt) <= 0) c.an = 'stand';
        if (c.cawT > 0 && (c.cawT -= dt) <= 0) snd.caw(c);
        if (c.life <= 0 || mNear(c, mover().moving ? 34 : 18)) c.flee();
      } else { c.an = 'fly'; c.z += 50 * dt; c.x += c.dir * 60 * dt; if (c.z > 170) gone(c); }
    };
  }
  // the bird feeder: where little birds sit on it (its tray, its roof), and spilled seed on the grass below
  const FEED = () => { const p = (PROPS[ROOM] || []).find(q => q.id === 'feeder'); return p ? { x: p.x, y: p.y } : { x: 164, y: 147 }; };
  function perches() { const f = FEED(), top = f.y - 84; return [{ id: 'trayL', x: f.x - 8, ty: top + 26, dir: 1 }, { id: 'trayR', x: f.x + 8, ty: top + 26, dir: -1 }, { id: 'roof', x: f.x + 1, ty: top + 8, dir: chance(0.5) ? 1 : -1 }]; }
  const groundSpot = (i, side) => { const f = FEED(), s = side || (i % 2 ? 1 : -1); return { id: 'g' + i, x: f.x + s * rnd(8, 24), ty: rnd(150, 157), dir: -s, ground: true }; };
  const FBA = { cardinal: { s: 0.4, hw: 6, h: 15 }, bluejay: { s: 0.4, hw: 7, h: 14 }, bird: { s: 0.42, hw: 6, h: 11 } };
  function fbird(art, spot, delay, stay) {
    const f = FEED(), from = chance(0.5) ? -1 : 1, gy = spot.ground ? spot.ty : f.y + 0.5, gz = gy - spot.ty;   // sorted just in front of the feeder, drawn up on it
    const c = critter('fbird', { art, ...FBA[art], x: spot.x + from * rnd(80, 120), y: gy, z: gz + rnd(40, 70), gz, dir: -from, st: 'wait', t: delay, life: stay, spot, an: 'fly', fps: 13, hidden: true, wait: rnd(0.4, 1) });
    c.leave = () => { if (c.st !== 'out') { c.st = 'out'; c.an = 'fly'; c.fps = 13; c.dir = sgn(c.x - marina.x || c.dir); } };
    c.tap = () => { snd.song(c); emit('note', c.x, c.y - c.z - 14, 1, { size: 8 }); if (c.st === 'sit') { if (E.t - (c.tapT || -9) < 2.5) c.leave(); else { c.tapT = E.t; c.hopT = 0.25; c.dir = -c.dir; } } };
    c.tick = dt => {
      if (c.st === 'wait') { if ((c.t -= dt) <= 0) { c.st = 'in'; c.hidden = false; } return; }
      if (c.st === 'in') { c.an = 'fly'; c.fps = 13; const dx = c.spot.x - c.x, dz = c.gz - c.z; c.x += clamp(dx, -75 * dt, 75 * dt); c.z += clamp(dz, -60 * dt, 60 * dt); if (Math.abs(dx) > 0.5) c.dir = sgn(dx);
        if (Math.abs(dx) < 1 && Math.abs(dz) < 1) { c.x = c.spot.x; c.z = c.gz; c.st = 'sit'; c.an = 'stand'; c.dir = c.spot.dir; c.wait = rnd(0.3, 0.9); snd.song(c); } return; }
      if (c.st === 'sit') {
        c.life -= dt; c.wait -= dt;
        if (c.hopT > 0) { c.hopT -= dt; c.z = c.gz + Math.sin(Math.max(0, c.hopT) / 0.25 * Math.PI) * 2.5; if (c.hopT <= 0) c.z = c.gz; }
        else if (c.wait <= 0) {
          c.wait = rnd(0.6, 1.6); const r = Math.random();
          if (r < 0.55) { c.an = 'peck'; c.at = 0; c.fps = 11; c.pk = count(c.art, 'peck') / 11; } else if (r < 0.72) { c.hopT = 0.25; c.dir = -c.dir; } else c.an = 'stand';
          if (chance(0.12)) snd.song(c);
          if (!c.spot.ground && chance(0.1)) { const taken = small.filter(q => q.type === 'fbird' && q !== c && q.st !== 'out').map(q => q.spot.id), free = perches().filter(p => !taken.includes(p.id)); if (free.length) { c.spot = pick(free); c.gz = c.y - c.spot.ty; c.st = 'in'; } }   // flits to another perch
        }
        if (c.pk > 0 && (c.pk -= dt) <= 0) c.an = 'stand';
        if (c.life <= 0 || (c.spot.ground && mNear(c, mover().moving ? 30 : 15))) c.leave();
      } else { c.an = 'fly'; c.z += 70 * dt; c.x += c.dir * 70 * dt; if (c.z > c.gz + 170 || !onScreen(c.x, 80)) gone(c); }
    };
    return c;
  }
  // she has just filled the feeder: a cardinal, a blue jay, robins on the grass underneath, sometimes a crow after the spilled seed
  function fedFlock() {
    if (!ART.ok || !ART.a.cardinal || G.room !== ROOM) return false;
    const taken = small.filter(q => q.type === 'fbird' && q.st !== 'out').map(q => q.spot.id), free = perches().filter(p => !taken.includes(p.id)), side = sgn(FEED().x - marina.x || 1);
    const order = ['cardinal', 'bluejay', 'cardinal'];
    free.slice(0, 3).forEach((p, i) => fbird(order[i] || 'bluejay', p, 0.3 + i * rnd(0.6, 1.1), rnd(13, 20)));
    const nr = 1 + (chance(0.6) ? 1 : 0); for (let i = 0; i < nr; i++) fbird('bird', groundSpot(i, side), 1.4 + i * 0.8, rnd(9, 15));     // on her far side
    if (ART.a.crow && chance(0.5) && !small.some(q => q.type === 'crow')) { const f = FEED(), x = clamp(f.x + side * 34, LX - 30, RX), c = critter('crow', { art: 'crow', s: 0.5, x: x + side * 120, y: rnd(152, 158), z: 90, lx: x, dir: -side, st: 'in', an: 'fly', fps: 10, life: rnd(10, 16), wait: 0.6, hw: 9, h: 19 }); crowAct(c); }
    return true;
  }
  function drawCritter(c, back) {
    const y = c.y - c.z + c.sink, fr = frame(c.art || c.type, c.an, c.at, c.fps, c.an === 'peck' || c.an === 'stuff' ? 'hold' : 'loop');
    const k = E.ctx, clip = c.clipY != null && c.sink > 0.2;
    if (clip) { k.save(); k.beginPath(); k.rect(-20, -60, E.viewW + 40, c.clipY + 60); k.clip(); }        // half way down its hole
    put(fr, c.x, y, { s: c.s, flip: c.dir < 0, rot: c.rot, alpha: c.alpha, depth: back ? 0.9 : 0 });
    if (clip) k.restore();
    if (c.type === 'chip' && c.nut) emoji('🌰', c.x + c.dir * 5, c.y - 7, 4);
    if (c.type === 'hole' && c.seeds > 0) for (let i = 0; i < c.seeds; i++) rect(c.x + c.dir * (5 + (i % 3) * 1.6), c.y - 1 - (i > 2 ? 1 : 0), 1, 1, i % 2 ? '#e8d9a8' : '#3b3226');   // the seeds it is stuffing
  }
  function drawHole(c) {                                       // a little dark hole in the grass with a crumb of earth round it
    const o = c.open; if (o <= 0.02) return; const ctx = E.ctx, x = Math.round(c.hx - E.camX), y = Math.round(c.hy), w = Math.max(1, Math.round(5 * o));
    ctx.fillStyle = 'rgba(122,88,54,' + (0.85 * o).toFixed(2) + ')'; ctx.fillRect(x - w - 2, y - 1, 2 * w + 4, 3); ctx.fillRect(x + w + 2, y, 2, 1); ctx.fillRect(x - w - 4, y + 1, 2, 1);
    ctx.fillStyle = 'rgba(40,28,18,' + o.toFixed(2) + ')'; ctx.fillRect(x - w, y - 1, 2 * w, 2); ctx.fillRect(x - w + 1, y - 2, 2 * w - 2, 1);
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
  let fedReq = null;                                           // she chose 🌾 at the bird feeder: birds come once she has filled it
  function smallTick(dt) {
    for (const c of small.slice()) { c.at += dt; c.tick(dt); }
    airTick(dt);
    if (fedReq) { if (E.t - fedReq.t > 15) fedReq = null; else if (!fedReq.at && E.t - fedReq.t > 0.3 && !mover().moving && Math.abs(marina.x - fedReq.x) <= 26) fedReq.at = E.t + 1.1; else if (fedReq.at && E.t >= fedReq.at) { fedReq = null; fedFlock(); } }
    if (V || T || !quiet()) return;
    if ((smallT -= dt) > 0 || small.length) return; smallT = rnd(11, 24);
    const kinds = ['bird', 'feeder', 'squirrel', 'chase', 'rabbit', 'chip', 'hole', 'crow', 'bird', 'feeder', 'hole', 'chase']; let k = pick(kinds); if (k === SMALL.last) k = pick(kinds); SMALL.last = k;
    if (SMALL[k]() === false) smallT = 4;
  }

  // ---------------------------------------------------------------- when things happen
  const quiet = () => typeof marina !== 'undefined' && G.room === ROOM && !(typeof inActivity === 'function' && inActivity()) && !G.busy && hid('panel') && hid('title');
  const screenUp = () => !hid('title') || !hid('panel') || !!(window.Studio && Studio.active) || !!document.querySelector('#storyBox,#stkBox') || !!G.sceneOn;
  function tick(dt) {
    if (!ART.ok || typeof marina === 'undefined') return;
    const here = G.room === ROOM;
    if (G.room !== lastRoom) { lastRoom = G.room; if (here) { if (!seenYard) { seenYard = true; next = rnd(20, 40); tnext = rnd(150, 230); } else { if (!V) next = Math.max(next, rnd(12, 20)); if (!T) tnext = Math.max(tnext, rnd(30, 60)); } } else { for (const c of small.slice()) gone(c); air.length = 0; leaves.length = 0; fedReq = null; } }
    if (myBusy && E.t - myBusy > 12) busy(false);            // never leave the game locked
    safe(() => turkeyLife(dt, here), 'turkeys');               // the turkeys come and go on their own (never with the deer)
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
    for (const h of small) if (h.type === 'hole' && onScreen(h.hx, 10)) drawHole(h);
    if (T) for (const k of T.kern) if (k.down && onScreen(k.x, 4)) { rect(k.x, k.y - 1, 2, 1, k.col); rect(k.x, k.y, 2, 1, '#b8862a'); }   // corn on the grass
    for (const g of GATES) {
      if (!onScreen(g.x, 110)) continue;
      const hiders = (V ? V.deer : []).concat(T ? T.birds : [], small).filter(d => d.behind && !d.hidden && (d.wild === 'deer' ? V.gate : d.g) === g);
      if (hiders.length) { c.save(); c.beginPath(); c.rect(-20, -60, E.viewW + 40, g.y + 60); c.clip(); for (const d of hiders) d.wild === 'deer' ? drawDeer(d, true) : d.wild === 'turkey' ? drawTurkey(d, true) : drawCritter(d, true); c.restore(); }
      drawGate(g);
    }
  }
  { const _dps = drawProps; drawProps = function (z) { if (z === 0) safe(drawBack, 'back'); return _dps(z); }; }
  { const _de = drawEnt; drawEnt = function (e) { if (!e.wild) return _de(e); if (ART.ok) safe(() => (e.wild === 'deer' ? drawDeer(e, false) : e.wild === 'turkey' ? drawTurkey(e, false) : drawCritter(e, false)), 'draw'); }; }
  // the feeder's own little emoji birds (outdoor.js) make way for the real ones drawn here
  { const _dpf = drawProp; drawProp = function (p) {
      if (!p || p.id !== 'feeder' || G.room !== ROOM || !ART.ok || !ART.a.cardinal) return _dpf(p);
      const e0 = emoji; emoji = function (ch) { if (ch === '🐦' || ch === '🐤') return; return e0.apply(this, arguments); };
      try { return _dpf(p); } finally { emoji = e0; }
    }; }
  { const _pa = propActions; propActions = function (p) {                // listen for her 🌾 at the feeder
      const a = _pa(p); if (!p || p.a !== 'feeder' || G.room !== ROOM || !Array.isArray(a)) return a;
      return a.map(x => (x && x.ico === '🌾' && typeof x.fn === 'function' ? Object.assign({}, x, { fn: function () { fedReq = { t: E.t, x: p.x }; return x.fn.apply(this, arguments); } }) : x));
    }; }
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
    if (T) {
      for (const k of T.kern) if (!k.down && k.k > 0) rect(k.x, k.y, 2, 2, k.col);              // corn flying from her hand
      const t = ttab(); if (t) { const bob = Math.sin(E.t * 4) * 1.5 * t.side; rect(t.x - 9 + bob, t.y - 10, 18, 20, 'rgba(43,35,64,.7)'); emoji('🦃', t.x + bob, t.y - 3, 8); emoji(t.side < 0 ? '◀' : '▶', t.x + bob, t.y + 6, 6); }
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
    if (T && T.phase !== 'exit') {                             // turkeys (the poults get a bigger spot than their size, they are tiny)
      const bs = T.birds.filter(b => !b.hidden && !b.behind).sort((a, b) => b.y - a.y);
      for (const b of bs) { const k = depthScale(b.y), y = b.y - b.z, hw = Math.max(b.hw, 10) * k + 5, h = Math.max(b.h, 24) * k + 6; if (Math.abs(wx - b.x) < hw && wy > y - h && wy < y + 5) return { turkey: b }; }
    }
    for (const c of small) { if (c.hidden || c.alpha < 0.3) continue; const y = c.y - c.z, top = y + Math.min(c.sink || 0, c.h - 3); if (c.rot ? Math.abs(wx - c.x) < 14 && Math.abs(wy - y) < 14 : Math.abs(wx - c.x) < c.hw + 6 && wy > top - c.h - 7 && wy < y + 6) return { crit: c }; }
    for (const b of air) if (Math.abs(wx - b.x) < 9 && Math.abs(wy - b.y) < 9) return { fly: b };
    for (const l of leaves) if (l.y < l.gy && Math.abs(wx - l.x) < 9 && Math.abs(wy - l.y) < 9) return { leaf: l };
    return null;
  }
  { const _ht = hitTest; hitTest = function (wx, wy) {
      let h; hideBase = true; try { h = _ht(wx, wy); } finally { hideBase = false; }
      if (typeof marina === 'undefined' || G.room !== ROOM || (h && (h.kind === 'mess' || h.kind === 'toy'))) return h;
      const w = wildAt(wx, wy); if (!w) return h;
      if (h && (h.kind === 'ent' || h.kind === 'self')) { const o = h.kind === 'self' ? marina : h.e, me = w.deer || w.turkey || w.crit; if (!me || me.y < o.y - 0.5) return h; }   // whoever stands in front gets the tap
      return { kind: 'wild', w };
    }; }
  { const _in = interact; interact = function (hit, wx, wy) {
      if (hit.kind !== 'wild') return _in(hit, wx, wy); const w = hit.w;
      if (w.deer) return tapDeer(w.deer);
      if (w.turkey) return tapTurkey(w.turkey);
      UI.closeActions();
      if (w.crit) return w.crit.tap && w.crit.tap();
      if (w.fly) { const b = w.fly; Audio2.blip(28, 'sine', 0.06, 0.05); emit('sparkle', b.x, b.y, 4); if (b.fire) { b.hx = b.x + rnd(-40, 40); b.hy = b.y - 30; b.t = 0; } else { b.sit = 2.6; emit('heart', marina.x, marina.y - 84, 1, { size: 8 }); } return; }
      if (w.leaf) { const l = w.leaf; l.vy = -46; l.ph += 2; Audio2.blip(pick([19, 21, 24]), 'sine', 0.05, 0.05); emit('sparkle', l.x, l.y, 3); }
    }; }
  { const _ot = onTap; onTap = function (px, py) {
      if (typeof marina !== 'undefined' && G.room === ROOM && !G.busy && V) { const t = tab(), [wx, wy] = toWorld(px, py);
        if (t && Math.abs(wx - t.x) < 12 && wy > t.y - 13 && wy < t.y + 13) { UI.closeActions(); Audio2.blip(9, 'triangle', 0.05, 0.1); const near = V.deer.filter(d => !d.hidden).reduce((a, d) => (t.side > 0 ? Math.min(a, d.x) : Math.max(a, d.x)), t.side > 0 ? 1e9 : -1e9) - t.side * 52; V.invited = true; if (['sit', 'cheer', 'sad'].includes(marina.state)) marina.state = 'idle'; mover().walkTo(near, null, null, FLOOR); return; } }
      if (typeof marina !== 'undefined' && G.room === ROOM && !G.busy && T && !V) { const t = ttab(), [wx, wy] = toWorld(px, py);       // the turkeys' tab
        if (t && Math.abs(wx - t.x) < 12 && wy > t.y - 13 && wy < t.y + 13) { UI.closeActions(); Audio2.blip(9, 'triangle', 0.05, 0.1); const l = tLive(), near = l.reduce((a, b) => (t.side > 0 ? Math.min(a, b.x) : Math.max(a, b.x)), t.side > 0 ? 1e9 : -1e9) - t.side * 56; T.invited = true; if (['sit', 'cheer', 'sad'].includes(marina.state)) marina.state = 'idle'; mover().walkTo(near, null, null, FLOOR); return; } }
      return _ot(px, py);
    }; }

  // ---------------------------------------------------------------- for the rest of the game (and for testing)
  window.Wildlife = {
    visit(kind) { return startVisit(kind); },                  // start a deer visit now; kind (optional) = the first thing they do: graze, headsup, cross, chase, sniff, lick, rub, butterfly
    active() { return !!V && V.phase !== 'exit'; },            // true while the deer are out
    soon(sec) { next = sec == null ? 1 : sec; },             // have the next visit come in `sec` seconds of quiet backyard time
    calm() {                                                   // make them leave at once (bounding off if she can see them, simply gone if a screen is up)
      if (T) { UI.closeActions(); if (G.room !== ROOM || screenUp() || !tLive().some(b => onScreen(b.x, 20))) endTurkeys(); else { if (T.lock) { T.lock = false; busy(false); } leaveT(true); T.scared = false; const t = T; setTimeout(() => { if (T === t) endTurkeys(); }, 3000); } }
      if (!V) return; UI.closeActions(); if (G.room !== ROOM || screenUp() || !V.deer.some(d => !d.hidden && onScreen(d.x, 20))) return endVisit();
      if (V.lock) { V.lock = false; hand.on = false; armDown(); busy(false); } leave(true); V.scared = false; const v = V; setTimeout(() => { if (V === v) endVisit(); }, 2600);
    },
    small(kind) { return SMALL[kind] ? SMALL[kind]() !== false : false; },   // bird, squirrel, rabbit, chip, feeder, hole, chase, crow (testing)
    fed() { return fedFlock(); },                             // the birds that come when she has just filled the feeder (testing)
    // the turkeys
    turkeys() { return startTurkeys(); },                      // a flock walks out of the woods now (false if the deer are out, or she is not in the backyard)
    turkeysActive() { return !!T && T.phase !== 'exit'; },     // true while the turkeys are out
    turkeySoon(sec) { tnext = sec == null ? 1 : sec; },       // have the next flock come in `sec` seconds of quiet backyard time
    turkeyDo(what) {                                           // testing: 'display', 'gobble' (the tom's own), 'corn', 'wave', 'gobbleBack', 'scare', 'leave'
      if (!T) return false; const tom = tomOf();
      if (what === 'display') display(tom, true); else if (what === 'gobble') { if (tom) { clear(tom); Q(tom, fn(b => snd.gobble(b)), act('gobble', 1, { fps: 6.5, mode: 'hold' })); } }
      else if (what === 'corn') scatterCorn(); else if (what === 'wave') waveT(); else if (what === 'gobbleBack') gobbleBack(); else if (what === 'scare') leaveT(true); else if (what === 'leave') leaveT(false); else return false;
      return true;
    },
    get turkeyState() { return T ? { t: +T.t.toFixed(2), phase: T.phase, fx: Math.round(T.fx), fdir: T.fdir, gate: T.gate.x, corn: !!T.corn, kern: T.kern.length, disp: T.disp, lock: T.lock, scared: !!T.scared, birds: T.birds.map(b => ({ kind: b.kind, x: Math.round(b.x), y: Math.round(b.y), z: Math.round(b.z), an: b.an, dir: b.dir, sx: +b.sx.toFixed(2), hidden: b.hidden, behind: b.behind })) } : { next: Math.round(tnext), got: tGot }; },
    gates: GATES, beats: Object.keys(BEATS),
    get state() { return V ? { t: +V.t.toFixed(2), phase: V.phase, beat: V.beat || null, cx: Math.round(V.cx), lock: V.lock, wary: V.wary > 0, wish: V.wish ? V.wish.d.kind : null, deer: V.deer.map(d => ({ kind: d.kind, x: Math.round(d.x), y: Math.round(d.y), an: d.an, dir: d.dir, hidden: d.hidden, behind: d.behind })) } : { next: Math.round(next), small: small.map(c => ({ type: c.type, x: Math.round(c.x), y: Math.round(c.y - c.z), st: c.st })), air: air.map(b => [Math.round(b.x), Math.round(b.y), b.sit > 0 ? 1 : 0]), leaves: leaves.map(l => [Math.round(l.x), Math.round(l.y), l.y < l.gy ? 1 : 0]) }; },
  };
})();
