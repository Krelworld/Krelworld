// Chef Marina — Minka, the small black-and-white cat who lives in the basement.
// She is shy and private. Running at her sends her off to hide; tiptoeing up to her (tap her), standing still or
// sitting down nearby, a tossed treat (🐟), the feather toy (🪶) and a gentle hand (✋) slowly win her trust, which
// is remembered between games (localStorage 'cm_minka') and never goes down. Now and then she hides somewhere in the
// basement and can be found again (🔍), slips upstairs for a careful look round, or has a silly, harmless run-in
// with big Niko, who loves to stalk her. Marina can step in (🙅) and comfort her afterwards (🫶).
// Everything is added on top of the game: the old ornament cat on the ottoman goes, Niko's own life is only paused
// while the two of them are busy with each other and is handed straight back to his AI afterwards.
(function () {
  if (window.Minka) return;              // already loaded (a test may add the file twice)
  if (window.Minka && window.Minka._v) return;
  const MS = 0.52, NS = 0.72, NSIT = 0.62;              // draw scales: Minka; Niko's new poses (made on his walking canvas); his sitting ones
  const DOWN = ['nunuroom', 'den', 'storage', 'laundry'], UP = ['foyer', 'living', 'playroom', 'kitchen', 'dining'];
  const DOOR_X = 100, STAIR_X = 96, WALL = 151;
  const isDown = r => DOWN.includes(r), canGo = r => isDown(r) || UP.includes(r);
  let mk = null, warned = 0;
  const warn = e => { if (warned++ < 3) console.warn('minka', e); };
  const ok = fn => { try { return fn(); } catch (e) { warn(e); } };

  // ================================================================ state
  const M = { mode: 'home', scene: false, tok: null, lastStartle: -99, creepAt: -99, closeAt: -99, comfortUntil: 0, visitAt: 0, upUntil: 0, loveAt: -99, whereAt: -99, presentAt: 60, sofaAt: -99, gainAt: {}, followAt: 0, stillT: 0, downT: 0, didFind: false };
  const H = { on: false, in: false, spot: null, round: 0, t0: 0, cl: {}, busy: false, lastEnd: 0, wrong: 0, leftAt: 0, said: false, checked: {} };
  const NK = { on: false, hold: false, p: null, kind: null, last: null, fight: false, tok: null, lastEnd: -20, lastFight: -999, tripAt: 0 };
  const FX = { treat: null, feather: null, cloud: null, cush: null, sun: null, silly: null, sock: 0, emo: [] };
  const FIGHTS = ['cushion', 'bap', 'scuffle', 'standoff', 'chase', 'boing'], CALM = ['stare', 'highspot', 'sunspot'];

  // ================================================================ art: one sheet, cut into canvases anchored at the feet (bottom centre)
  const ART = { ok: false, n: {} };
  (function load() {
    const img = new Image(); let J = null, n = 0;
    const fin = () => { if (++n < 2 || !J || !img.naturalWidth) return; ok(() => build(J, img)); };
    img.onload = fin; img.onerror = () => { }; img.src = 'assets/minka/minka.png';
    fetch('assets/minka/minka.json').then(r => r.json()).then(j => { J = j; fin(); }).catch(() => { });
  })();
  function build(J, img) {
    for (const k in J) {
      const [sx, sy, w, h, dx, dy] = J[k], W = 2 * Math.max(-dx, dx + w, 1), Hh = Math.max(-dy, 1), c = document.createElement('canvas');
      c.width = W; c.height = Hh; c.getContext('2d').drawImage(img, sx, sy, w, h, W / 2 + dx, Hh + dy, w, h); E.cache['mk:' + k] = c;
      const m = k.match(/^(.*)_(\d+)$/); if (m) ART.n[m[1]] = Math.max(ART.n[m[1]] || 0, +m[2]);
    }
    for (const k of ['minka', 'minka_sit', 'minka_sitdown', 'minka_wary_1']) blinkOf(k);
    ART.ok = true;
  }
  function blinkOf(k) {      // the slow blink: the yellow eyes closed to a soft line
    const s = E.cache['mk:' + k]; if (!s) return; const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; const x = c.getContext('2d'); x.drawImage(s, 0, 0);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data, low = {};
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] > 140 && d[i + 1] > 140 && d[i + 2] < 120) { const p = i / 4, px = p % c.width, py = (p / c.width) | 0; d[i] = 34; d[i + 1] = 31; d[i + 2] = 44; low[px] = Math.max(low[px] || 0, py); }
    for (const px in low) { const i = (low[px] * c.width + +px) * 4; d[i] = 128; d[i + 1] = 124; d[i + 2] = 138; }
    x.putImageData(im, 0, 0); E.cache['mk:' + k + '_blink'] = c;
  }
  const fk = (b, t, fps) => { const n = ART.n[b]; return 'mk:' + (n ? b + '_' + (1 + Math.floor(Math.max(0, t) * fps) % n) : b); };          // looping frames
  const fo = (b, u) => { const n = ART.n[b]; return 'mk:' + (n ? b + '_' + clamp(1 + Math.floor(u * n), 1, n) : b); };                   // once through, u = 0..1

  // ================================================================ trust (remembered, only ever grows)
  const T = (() => { const d = { t: 0, finds: 0, gifts: 0, pets: 0 }; try { const s = JSON.parse(localStorage.getItem('cm_minka') || '{}'); return Object.assign(d, s && typeof s === 'object' ? s : {}); } catch (e) { return d; } })();
  T.t = clamp(+T.t || 0, 0, 100);
  const save = () => { try { localStorage.setItem('cm_minka', JSON.stringify(T)); } catch (e) { } };
  const lvl = () => (T.t >= 65 ? 2 : T.t >= 30 ? 1 : 0);
  function gain(n, tag, gap) { if (tag && E.t - (M.gainAt[tag] == null ? -999 : M.gainAt[tag]) < (gap || 20)) return; if (tag) M.gainAt[tag] = E.t; T.t = Math.min(100, Math.round((T.t + n) * 10) / 10); save(); }

  // ================================================================ little helpers
  const vis = () => !!mk && mk.room === G.room && !mk.hidden;
  const feetY = () => (mk.perchY != null ? mk.perchY : mk.y);
  const dirTo = (a, b) => Math.sign(b.x - a.x) || a.dir || 1;
  const RW = r => (ROOMS[r] ? ROOMS[r].w : 300);
  const panelUp = () => { const p = document.getElementById('panel'); return !!p && !p.classList.contains('hidden'); };
  const quiet = () => typeof marina !== 'undefined' && !(typeof inActivity === 'function' && inActivity()) && !G.busy && !G.sceneOn && !panelUp() && !['tantrum', 'anim', 'flip', 'ride', 'bars', 'swing', 'perch'].includes(marina.state) && !marina.mount;
  const say1 = k => { try { return say(k) || Promise.resolve(); } catch (e) { return Promise.resolve(); } };
  const snd = (k, o) => { if (mk && mk.room === G.room) Audio2.sfx(k, o || {}); };
  const sndN = (k, o) => { if (niko.room === G.room) Audio2.sfx(k, o || {}); };
  const ev = (k, d) => { try { const f = window.Minka && window.Minka.onEvent; if (typeof f === 'function') f(k, d); } catch (e) { } };
  function emo(e, ch, ms, o) { FX.emo = FX.emo.filter(x => x.e !== e); if (ch) FX.emo.push(Object.assign({ e, ch, until: E.t + (ms || 1200) / 1000, t0: E.t }, o || {})); }
  const job = () => { if (mk.watch) { mk.watch = null; mk.y = 158; } return (mk.job = (mk.job || 0) + 1); };
  function setAn(b, o) { mk.an = Object.assign({ b, t0: E.t }, o || {}); mk.anUntil = o && o.ms ? E.t + o.ms / 1000 : 0; }
  // sequences: every wait checks whether the sequence was called off
  const STOP = { stop: 1 };
  const W = (tok, ms) => new Promise((res, rej) => setTimeout(() => (tok.dead ? rej(STOP) : res()), ms));
  function go(tok, e, x, sp, y) {
    return new Promise((res, rej) => { x = clamp(x, 10, RW(e.room) - 10); let fin = false, to = 0; const end = () => { if (fin) return; fin = true; clearTimeout(to); tok && tok.dead ? rej(STOP) : res(); };
      const d = Math.abs(x - e.x) + Math.abs((y == null ? e.y : y) - e.y); to = setTimeout(() => { if (!fin) { e.stop(); end(); } }, d / (sp || e.speed) * 1000 + 1500); e.walkTo(x, end, sp, y); });
  }
  function run(fn, onEnd) { const tok = { dead: false }; (async () => { try { await fn(tok); } catch (e) { if (e !== STOP) warn(e); } finally { try { onEnd && onEnd(tok); } catch (e) { warn(e); } } })(); return tok; }
  // tweens and jumps, driven by the game clock
  const TW = [], ARCS = [];
  function tw(o, to, dur) { return new Promise(res => { const from = {}; for (const k in to) from[k] = o[k] == null ? (k === 'alpha' ? 1 : 0) : o[k]; TW.push({ o, from, to, dur, t0: E.t, res }); }); }
  function twKill(o) { for (let i = TW.length - 1; i >= 0; i--) if (TW[i].o === o) { const w = TW[i]; for (const k in w.to) w.o[k] = w.to[k]; TW.splice(i, 1); w.res(); } }
  function finishArcs(e) { for (let i = ARCS.length - 1; i >= 0; i--) if (ARCS[i].e === e) { const a = ARCS[i]; ARCS.splice(i, 1); a.set(a.x1, a.y1, 1); a.res(); } }
  function motionTick() {
    for (let i = TW.length - 1; i >= 0; i--) { const w = TW[i], u = clamp((E.t - w.t0) / w.dur, 0, 1); for (const k in w.to) w.o[k] = w.from[k] + (w.to[k] - w.from[k]) * u; if (u >= 1) { TW.splice(i, 1); w.res(); } }
    for (let i = ARCS.length - 1; i >= 0; i--) { const a = ARCS[i], u = clamp((E.t - a.t0) / a.dur, 0, 1); a.set(a.x0 + (a.x1 - a.x0) * u, a.y0 + (a.y1 - a.y0) * u - Math.sin(u * Math.PI) * a.h, u); if (u >= 1) { ARCS.splice(i, 1); a.res(); } }
  }
  function mJump(x1, feet1, dur, h) {         // Minka leaps to x1, landing on a perch at feet height feet1 (null = the floor)
    finishArcs(mk); x1 = clamp(x1, 10, RW(mk.room) - 10); const y0 = feetY(), y1 = feet1 == null ? mk.y : feet1;
    return new Promise(res => ARCS.push({ e: mk, x0: mk.x, y0, x1, y1, dur, h, t0: E.t, res, set: (x, y, u) => { mk.x = x; mk.perchY = y; if (u >= 1 && feet1 == null) mk.perchY = null; } }));
  }
  function nJump(x1, oy1, dur, h) {           // Niko's pounce (oy = how far above his feet line he is)
    finishArcs(niko); x1 = clamp(x1, 10, RW(niko.room) - 10); const y0 = (NK.p && NK.p.oy) || 0;
    return new Promise(res => ARCS.push({ e: niko, x0: niko.x, y0, x1, y1: oy1, dur, h, t0: E.t, res, set: (x, y) => { niko.x = x; if (NK.p) NK.p.oy = y; } }));
  }

  // ================================================================ where she lives
  // nap spots: x, the depth line y (in front of the thing she lies on), perch = her feet when up on it
  const NAPS = [
    { id: 'armchair', room: 'den', x: 262, y: 151, perch: 131, pose: 'nap' },
    { id: 'ottoman', room: 'den', x: 304, y: 156, perch: 133, pose: 'loaf' },
    { id: 'sofa', room: 'den', x: 422, y: 152, perch: 136, pose: 'nap' },
    { id: 'hearth', room: 'den', x: 548, y: 158, perch: null, pose: 'nap' },
    { id: 'dryer', room: 'laundry', x: 148, y: 151, perch: 95, pose: 'loaf' },
    { id: 'pile', room: 'laundry', x: 192, y: 171, perch: 161, pose: 'nap' },
    { id: 'bed', room: 'nunuroom', x: 104, y: 152, perch: 123, pose: 'nap' },
    { id: 'tiles', room: 'storage', x: 294, y: 152, perch: 127, pose: 'loaf' },
  ];
  // high places to leap up to, out of Niko's way
  const HIGH = { den: [{ x: 150, y: 96 }, { x: 262, y: 104 }], storage: [{ x: 118, y: 86 }, { x: 204, y: 109 }], laundry: [{ x: 148, y: 95 }], nunuroom: [{ x: 172, y: 90 }, { x: 296, y: 89 }] };
  function highSpot(room, x) {
    let c = (HIGH[room] || []).slice();
    if (!c.length) c = (PROPS[room] || []).filter(p => p.climb && p.climb < 140).map(p => ({ x: p.x, y: p.climb + 2 }));
    c = c.filter(s => Math.abs(s.x - x) < 200); if (!c.length) return null; c.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)); return c[0];
  }
  const naps = room => NAPS.filter(n => n.room === room);

  // ---- hiding places: local coordinates on the furniture's own picture (0,0 = its top-left corner)
  // kinds: over (head peeks over the top edge), under (eyes in the dark gap underneath), high (up on the picture ledge),
  // box (inside, ears over the rim), side (round the side, tail tip out the other side), window (behind the oven door),
  // drum (in the dryer), pile (in the laundry), tub (in the washer), rack (sitting behind the hanging clothes, paws showing)
  const SPOTS = [
    { id: 'armchair', room: 'den', prop: 'barm', kind: 'over', hx: 39, edge: 10 },
    { id: 'sofa', room: 'den', prop: 'bsofa', kind: 'under', ex: 64, ey: 50, gap: [12, 47, 100, 52] },
    { id: 'shelf', room: 'den', prop: 'ledge', kind: 'high', dx: 8 },
    { id: 'boxes', room: 'storage', prop: 'boxes', kind: 'box', hx: 27, edge: 12, front: [8, 11, 49, 29], wob: 1 },
    { id: 'bigbox', room: 'storage', prop: 'bigbox', kind: 'box', hx: 26, edge: 24, front: [9, 24, 42, 44], wob: 1 },
    { id: 'totes', room: 'storage', prop: 'totes', kind: 'side', hx: 46, hy: 67, side: 1, tx: 7, ty: 66 },
    { id: 'oven', room: 'storage', prop: 'toykitchen', kind: 'window', win: [13, 41, 25, 55], hx: 19, hy: 58 },
    { id: 'dryer', room: 'laundry', prop: 'dryer', kind: 'drum', cx: 21.5, cy: 22.5, r: 8.6, hx: 21.5, hy: 32 },
    { id: 'pile', room: 'laundry', prop: 'pile', kind: 'pile', hx: 14, edge: 9, tx: 35, ty: 21, wob: 1 },
    { id: 'washer', room: 'laundry', prop: 'washer', kind: 'tub', hx: 24, edge: 23, front: [0, 23, 48, 60], wob: 1 },
    { id: 'bed', room: 'nunuroom', prop: 'nbed', kind: 'under', ex: 60, ey: 53, gap: [13, 50, 97, 56] },
    { id: 'rack', room: 'nunuroom', prop: 'rack', kind: 'rack', tx: 33, ty: 57, ex: 30, ey: 40, wob: 1 },
    { id: 'ntotes', room: 'nunuroom', prop: 'ntotes', kind: 'over', hx: 22, edge: 10, tx: 44, ty: 14 },
  ];
  const propOf = s => s && (PROPS[s.room] || []).find(p => p.id === s.prop);
  function LW(p, lx, ly) { const [w, h] = spriteSize(p.k), sc = p.scale || 1; return [p.x + (lx - w / 2) * sc, p.y + (ly - h) * sc]; }
  function spotIcon(s) {
    const p = propOf(s); if (!p) return null;
    if (s.kind === 'high') return [p.x + (s.dx || 0), p.y - 36];
    const b = visBox(p.k), sc = p.scale || 1; return [p.x + (b[0] + b[2]) / 2 * sc, Math.max(40, p.y + b[1] * sc - (['over', 'box', 'tub', 'pile'].includes(s.kind) ? 19 : 10))];
  }
  function spotHead(s) {        // where her head is (for popping out)
    const p = propOf(s); if (!p) return [mk.x, mk.y];
    if (s.kind === 'high') return [p.x + (s.dx || 0), p.y];
    if (s.kind === 'under') return LW(p, s.ex, s.gap[3]);
    if (s.kind === 'rack') return LW(p, s.ex, s.ey + 6);
    if (s.kind === 'drum') return LW(p, s.hx, s.hy);
    if (s.hy != null) return LW(p, s.hx, s.hy);
    return LW(p, s.hx, s.edge + 4);
  }
  const WATCH = SPOTS.filter(s => s.kind === 'under');

  // ================================================================ the entity
  function init() {
    if (mk || typeof Ent === 'undefined') return;
    if (PROPS.den) { const i = PROPS.den.findIndex(p => p.id === 'tuxcat'); if (i >= 0) PROPS.den.splice(i, 1); }        // the ornament cat makes way for the real one
    mk = new Ent({ id: 'minka', room: 'den', x: 262, y: 151, speed: 36, dir: -1, state: 'nap', perchY: 131 });
    mk.restSpot = NAPS[0]; mk.wait = rnd(14, 26); window.minka = mk;
  }
  if (typeof marina !== 'undefined' && marina) init();
  else if (typeof makeEnts === 'function') { const _me = makeEnts; makeEnts = function () { const r = _me.apply(this, arguments); ok(init); return r; }; }

  // ================================================================ drawing Minka
  const POSE = { nap: 'minka_sleep', loaf: 'minka_loaf', sit: 'minka_sit', stand: 'minka', wary: 'minka_wary_1', low: 'minka_low', flop: 'minka_flop' };
  function mKey(e) {
    const a = e.an;
    if (a && (!e.moving || a.move)) { const u = E.t - a.t0; if (a.k) return a.k; if (a.once) return fo(a.b, u / a.dur); return a.fps ? fk(a.b, u, a.fps) : 'mk:' + a.b; }
    if (e.moving) return e.curSpeed >= 75 ? fk('minka_bolt', e.animT, 15) : fk('minka_walk', e.animT, e.creep ? 6 : e.curSpeed > 45 ? 13 : 10);
    return 'mk:' + (POSE[e.state] || 'minka_sit');
  }
  function glow(e, on, draw) {
    e.glow = clamp((e.glow || 0) + (on ? 0.08 : -0.06), 0, 1); const g = e.glow; if (g <= 0.02) return draw();
    const c = E.ctx; c.save(); c.shadowColor = 'rgba(255,236,150,' + (g * (0.8 + Math.sin(E.t * 4) * 0.2)).toFixed(3) + ')'; c.shadowBlur = E.scale * 4.5; c.shadowOffsetX = c.shadowOffsetY = 0; draw(); c.restore();
  }
  function drawMinka(e) {
    if (!ART.ok || e.hideDraw || e.watch) return;              // under the furniture she is drawn with it
    let k = mKey(e); if (E.t < (e.blinkT || 0) && E.cache[k + '_blink']) k += '_blink';
    const y = feetY() + (e.oy || 0), low = e.creep && e.moving ? 0.86 : 1, breathe = e.state === 'nap' && !e.moving && !e.an ? 1 + Math.sin(E.t * 2.2) * 0.025 : 1;
    const tremble = (e.puff || 1) > 1.02 ? Math.sin(E.t * 47) * 0.6 : 0;
    const near = !G.busy && !G.sceneOn && marina.state !== 'anim' && Math.abs(e.x - marina.x) < 60 && !NK.on && !M.scene;
    glow(e, near, () => drawSprite(k, e.x + tremble, y, { flip: e.dir < 0, scale: MS, sx: e.puff || 1, sy: low * breathe, rot: e.rot || 0, alpha: e.alpha == null ? 1 : e.alpha }));
    if (e.state === 'nap' && !e.moving && !e.an && chance(0.008)) emit('zzz', e.x + e.dir * 4, y - 14);
    if (e.carry) emoji(e.carry, e.x + e.dir * 12 * (E.depth || 1), y - 6, 8);
  }
  // Niko during a run-in with her
  const scFor = k => (/nk_(smug|wash)/.test(k) ? NSIT : /^mk:/.test(k) ? NS : k === 'niko_sit' ? 0.62 : k === 'niko_lie' ? 0.6 : 0.72);
  function nKey(e) {
    const p = NK.p || {};
    if (e.moving && !p.move) { if (p.walk === 'creep') return ['mk:nk_creep_' + (1 + Math.floor(e.animT * 6) % 4), NS]; return [frameKey('niko_walk', e.animT, e.curSpeed > 60 ? 18 : 10) || 'niko', 0.72]; }
    if (p.k) return [p.k, p.sc || scFor(p.k)];
    if (p.b) { const u = E.t - p.t0, k = p.once ? fo(p.b, u / p.dur) : fk(p.b, u, p.fps || 0); return [k, p.sc || scFor(k)]; }
    return ['niko_sit', 0.62];
  }
  function drawNiko(e) {
    const p = NK.p || {}; if (p.hide) return; const [k, sc] = nKey(e), y = e.y + (p.oy || 0);
    let rot = p.rot || 0, sx = p.sx || 1; const sy = p.sy || 1;
    if (p.shake) sx *= 1 + Math.sin(E.t * 40) * 0.04;
    if (p.flail) rot += Math.sin(E.t * 22) * 0.07;
    drawSprite(k, e.x + (p.ox || 0) + (p.tremble ? Math.sin(E.t * 43) * 0.7 : 0), y, { flip: e.dir < 0, scale: sc, rot, sx, sy });
    if (p.cush) cushion(e.x + e.dir * 21, y - 2, 1.15, 1, Math.sin(E.t * 18) * 0.08);       // his face buried in it
  }
  function cushion(x, y, sq, alpha, rot) {          // a plump pink cushion with yellow tassels
    const c = E.ctx; c.save(); c.globalAlpha = alpha; c.translate(Math.round(x - E.camX), Math.round(y)); if (rot) c.rotate(rot); c.scale(1, sq || 1);
    const rows = [[14, '#a8435b'], [20, '#d9607a'], [22, '#ee8aa0'], [24, '#f4a3b5'], [24, '#ee8aa0'], [24, '#e8738c'], [22, '#d9607a'], [20, '#c4506a'], [14, '#a8435b']];
    rows.forEach(([w, col], i) => { c.fillStyle = col; c.fillRect(-w / 2, -9 + i, w, 1); });
    c.fillStyle = '#9c3a51'; c.fillRect(-1, -5, 2, 2); c.fillStyle = '#ffd86b'; for (const [tx, ty] of [[-13, -10], [11, -10], [-13, -1], [11, -1]]) c.fillRect(tx, ty, 2, 2);
    c.restore();
  }
  const nb = (b, o) => Object.assign({ b, t0: E.t }, o || {});          // a Niko pose that plays frames of base b

  // ================================================================ the hiding places, drawn with the furniture
  function spotFor(p) {
    if (!mk || !ART.ok) return null;
    if (H.on && H.in && H.spot && H.spot.room === G.room && H.spot.prop === p.id) return H.spot;
    if (mk.watch && mk.room === G.room && mk.watch.prop === p.id) return mk.watch;
    return null;
  }
  function tailTip(x, y, sx, sy, fast) {      // a black tail with its white tip, curling out from behind something (sx, sy: each step along it)
    const c = E.ctx;
    for (let i = 0; i < 8; i++) { const k = i / 7, sw = Math.sin(E.t * (fast ? 11 : 2.4) + k * 2.4) * k * (fast ? 3.2 : 1.6);
      c.fillStyle = i >= 6 ? '#f1ede4' : '#1d1b26'; c.fillRect(Math.round(x + sx * i + (sy ? sw : 0) - E.camX), Math.round(y + sy * i + (sy ? 0 : -Math.abs(sw))), 2, 2); }
  }
  function eyes(x, y) {
    const c = E.ctx, X = Math.round(x - E.camX), Y = Math.round(y), g = c.createRadialGradient(X, Y, 0, X, Y, 8);
    g.addColorStop(0, 'rgba(210,235,90,.38)'); g.addColorStop(1, 'rgba(210,235,90,0)'); c.fillStyle = g; c.fillRect(X - 9, Y - 7, 18, 14);
    c.fillStyle = '#dcec6c'; c.fillRect(X - 4, Y - 1, 3, 2); c.fillRect(X + 2, Y - 1, 3, 2); c.fillStyle = '#16140c'; c.fillRect(X - 3, Y - 1, 1, 2); c.fillRect(X + 3, Y - 1, 1, 2);
  }
  function redraw(p, r, wob) {     // draw part of the furniture again, over her (the front of a box, the washer's front)
    const [x0, y0] = LW(p, r[0], r[1]), [x1, y1] = LW(p, r[2], r[3]), c = E.ctx;
    c.save(); c.beginPath(); c.rect(Math.round(x0 - E.camX + wob), y0, x1 - x0, y1 - y0); c.clip(); drawSprite(p.k, p.x + wob, p.y, { flip: !!p.flip, scale: p.scale || 1 }); c.restore();
  }
  function cueNow(s) {
    const watch = mk.watch === s, cl = watch ? {} : H.cl, t = E.t;
    const rise = watch ? 0.6 : clamp(cl.rise || 0, 0, 1), blink = (t % 3.3) < 0.15 || t < (cl.blinkT || 0) && (t % 0.5) < 0.2;
    return { watch, rise, blink, eyes: watch || t < (cl.eyesT || 0) || (s.kind === 'under' && t % 5.2 < 2.6), tw: t < (cl.twT || 0), ear: t < (cl.earT || 0), wob: t < (cl.wobT || 0) ? Math.sin(t * 46) * 1.3 : 0 };
  }
  function headK(q) { return 'mk:minka_head' + (q.blink ? '_blink' : ''); }
  function spotLayer(s, p, layer, q) {
    const d0 = E.depth; E.depth = 1; const c = E.ctx, wob = q.wob, earRot = q.ear ? Math.sin(E.t * 34) * 0.12 : 0;
    try {
      switch (s.kind) {
        case 'over': {
          const [x, y] = LW(p, s.hx, s.edge); const chin = y + 10 - q.rise * 5;
          if (layer === 'back') drawSprite(headK(q), x, chin, { scale: MS, rot: earRot });
          if (layer === 'front' && q.rise > 0.55) drawSprite('mk:minka_paws', x, y + 2, { scale: MS });
          if (layer === 'front' && s.tx != null) { const [tx, ty] = LW(p, s.tx, s.ty); tailTip(tx, ty, 0.3, 1.4, q.tw); }
          break; }
        case 'box': case 'tub': {
          const [x, y] = LW(p, s.hx, s.edge); const chin = y + 10 - q.rise * 5;
          if (layer === 'mid') { drawSprite(headK(q), x + wob, chin, { scale: MS, rot: earRot }); redraw(p, s.front, wob); if (q.rise > 0.55) drawSprite('mk:minka_paws', x + wob, y + 2, { scale: MS }); }
          break; }
        case 'pile': {
          const [x, y] = LW(p, s.hx, s.edge); const chin = y + 10 - q.rise * 5;
          if (layer === 'back') drawSprite(headK(q), x + wob, chin, { scale: MS, rot: earRot });
          if (layer === 'front') { const [tx, ty] = LW(p, s.tx, s.ty); tailTip(tx + wob, ty, 0.9, -1.1, q.tw); }
          break; }
        case 'side': {
          const [x, y] = LW(p, s.hx, s.hy); const [tx, ty] = LW(p, s.tx, s.ty);
          if (layer === 'back') { if (q.rise > 0.05) drawSprite(headK(q), x + s.side * (q.rise * 6 - 4), y, { scale: MS, rot: earRot }); s.tup ? tailTip(tx, ty, 0.3, -1.4, q.tw) : tailTip(tx, ty, -s.side * 1.3, -0.35, q.tw); }
          break; }
        case 'under': {
          if (layer !== 'front') break; const [gx0, gy0] = LW(p, s.gap[0], s.gap[1]), [gx1, gy1] = LW(p, s.gap[2], s.gap[3]);
          c.fillStyle = 'rgba(18,12,24,.42)'; c.fillRect(Math.round(gx0 - E.camX), Math.round(gy0), Math.round(gx1 - gx0), Math.round(gy1 - gy0));
          const [ex, ey] = LW(p, s.ex, s.ey); if (q.eyes && !q.blink) eyes(ex, ey);
          if (q.watch || q.rise > 0.55) drawSprite('mk:minka_paws', ex, gy1 + 1, { scale: MS });
          break; }
        case 'window': case 'drum': {
          if (layer !== 'front') break; c.save(); c.beginPath();
          if (s.kind === 'window') { const [x0, y0] = LW(p, s.win[0], s.win[1]), [x1, y1] = LW(p, s.win[2], s.win[3]); c.rect(Math.round(x0 - E.camX), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)); }
          else { const [cx, cy] = LW(p, s.cx, s.cy); c.arc(cx - E.camX, cy, s.r, 0, 7); }
          c.clip(); c.fillStyle = '#25222c'; c.fillRect(-10, 0, E.viewW + 20, SH);
          const [x, y] = LW(p, s.hx, s.hy); drawSprite(headK(q), x, y + 4 - q.rise * 4, { scale: MS, rot: earRot, alpha: 0.75 + q.rise * 0.25 });
          c.fillStyle = 'rgba(255,255,255,.16)'; const [ax, ay] = LW(p, s.kind === 'drum' ? s.cx - 8 : s.win[0], s.kind === 'drum' ? s.cy - 8 : s.win[1]);
          c.beginPath(); c.moveTo(ax - E.camX, ay + 6); c.lineTo(ax + 6 - E.camX, ay); c.lineTo(ax + 9 - E.camX, ay); c.lineTo(ax - E.camX, ay + 9); c.fill(); c.restore();
          break; }
        case 'rack': {
          if (layer === 'back') { const [tx, ty] = LW(p, s.tx, s.ty); tailTip(tx + wob, ty, 0.2, 1.5, q.tw); }
          if (layer === 'front' && (q.eyes || q.rise > 0.3) && !q.blink) { const [ex, ey] = LW(p, s.ex, s.ey); eyes(ex + wob, ey); }
          break; }
        case 'high': {
          if (layer !== 'front') break; const x = p.x + (s.dx || 0), y = p.y;
          drawSprite('mk:minka_loaf', x, y + 1, { scale: MS * 0.92, flip: true }); tailTip(x + 9, y + 2, 0.25, 1.4, q.tw);
          break; }
      }
    } finally { E.depth = d0; }
  }

  // ================================================================ hooks into the game's drawing
  { const _de = drawEnt; drawEnt = function (e) {
      if (mk && e === mk) return ok(() => drawMinka(e));
      if (typeof niko !== 'undefined' && e === niko && NK.hold && NK.p && niko.state === 'minka') return ok(() => drawNiko(e));
      return _de(e);
    }; }
  { const _np = nikoPose; nikoPose = function (e) { if (typeof niko !== 'undefined' && e === niko && NK.hold && NK.p && niko.state === 'minka') { const [k, sc] = nKey(e); return [k, sc, e.y + (NK.p.oy || 0)]; } return _np(e); }; }
  { const _dp = drawProp; drawProp = function (p) {
      const s = spotFor(p); if (!s) return _dp(p);
      const q = cueNow(s); ok(() => spotLayer(s, p, 'back', q));
      if (q.wob && s.wob) { const c = E.ctx; c.save(); c.translate(q.wob, 0); _dp(p); c.restore(); } else _dp(p);
      ok(() => spotLayer(s, p, 'mid', q)); ok(() => spotLayer(s, p, 'front', q));
    }; }
  { const _dps = drawProps; drawProps = function (z) { const r = _dps(z); if (z === 0) ok(drawFloorFX); return r; }; }
  { const _dx = drawExitSigns; drawExitSigns = function () { _dx(); ok(drawOver); }; }
  function drawFloorFX() {            // under the cats: a patch of sunshine, a floor cushion
    const c = E.ctx;
    if (FX.sun && FX.sun.room === G.room) { const S = FX.sun, a = clamp(Math.min((E.t - S.t0) / 0.8, (S.until - E.t) / 0.8), 0, 1) * 0.55;
      if (a > 0) { c.save(); c.globalAlpha = a; const g = c.createLinearGradient(0, 40, 0, S.y + 10); g.addColorStop(0, 'rgba(255,236,150,0)'); g.addColorStop(1, 'rgba(255,226,120,.55)');
        c.fillStyle = g; c.beginPath(); c.moveTo(S.x - 24 - E.camX + 40, 40); c.lineTo(S.x + 8 - E.camX + 40, 40); c.lineTo(S.x + 34 - E.camX, S.y + 8); c.lineTo(S.x - 34 - E.camX, S.y + 8); c.fill();
        c.fillStyle = 'rgba(255,232,140,.6)'; c.beginPath(); c.ellipse(S.x - E.camX, S.y + 3, 34, 6, 0, 0, 7); c.fill(); c.restore(); } }
    if (FX.cush && FX.cush.room === G.room) { const C = FX.cush, a = clamp(Math.min((E.t - C.t0) / 0.3, (C.until - E.t) / 0.5), 0, 1); if (a > 0) cushion(C.x, C.y + 2, C.squash && E.t < C.squash ? 0.7 : 1, a, 0); }
  }
  function drawOver() {
    if (!mk || !ART.ok) return; const c = E.ctx;
    // a tossed treat
    const tr = FX.treat; if (tr && tr.room === G.room) { const u = clamp((E.t - tr.t0) / tr.dur, 0, 1); if (u < 1) emoji('🐟', tr.x0 + (tr.x - tr.x0) * u, tr.y0 + (tr.y - tr.y0) * u - Math.sin(u * Math.PI) * 26, 8, 1, u * 9); else if (!tr.eaten) emoji('🐟', tr.x, tr.y - 2, 7, 1, 0.2); }
    // the feather on its stick
    const F = FX.feather; if (F && G.room === mk.room) { const hx = marina.x + marina.dir * 9, hy = marina.y + marina.offY - 40, fy = F.y - 5 + Math.sin(E.t * 9) * 2.5;
      c.strokeStyle = '#8a5a2b'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - E.camX, hy); c.lineTo(hx + marina.dir * 14 - E.camX, hy - 8); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(hx + marina.dir * 14 - E.camX, hy - 8); c.quadraticCurveTo((hx + F.x) / 2 - E.camX, fy - 10, F.x - E.camX, fy); c.stroke();
      emoji('🪶', F.x, fy, 10, 1, Math.sin(E.t * 7) * 0.5); }
    // the scuffle
    if (FX.cloud && FX.cloud.room === G.room) drawCloud(FX.cloud);
    // a silly thing found in the wrong hiding place
    if (FX.silly) drawSilly(FX.silly);
    if (E.t < FX.sock && G.room === FX.sockRoom) emoji('🧦', marina.x + marina.dir * 2, marina.y + marina.offY - 76 * marina.scale + 4, 11, 1, 0.5 + Math.sin(E.t * 3) * 0.1);
    // little feelings over their heads
    FX.emo = FX.emo.filter(m => E.t < m.until);
    for (const m of FX.emo) { const e = m.e; if (!e || e.room !== G.room || (e.hidden && e !== mk)) continue; const top = e === niko ? e.y + ((NK.p && NK.p.oy) || 0) - 50 : feetY() + (mk.oy || 0) - 30, pop = Math.min(1, (E.t - m.t0) / 0.15);
      emoji(m.ch, e.x + (m.dx || 0), top - 4 + Math.sin(E.t * 5) * 1.2, 10 * pop); }
    // hide and seek: a magnifying glass over every place she could be
    if (H.on && H.in && isDown(G.room) && !G.busy && !panelUp()) for (const s of SPOTS) { if (s.room !== G.room || H.checked[s.id]) continue; const ic = spotIcon(s); if (!ic) continue;
      const [x, y] = ic, b = Math.sin(E.t * 3 + x * 0.05) * 1.5; c.fillStyle = 'rgba(255,255,255,.78)'; c.beginPath(); c.arc(x - E.camX, y + b, 7.5, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,207,74,.95)'; c.lineWidth = 1; c.stroke(); emoji('🔍', x, y + b + 0.5, 9); }
  }
  function drawCloud(C) {
    const t = E.t - C.t0, ctx = E.ctx, x = C.x + Math.sin(t * 2.4) * 24, y = C.y - 15; C.cx = x;
    // things sticking out of it: Niko's striped tail, Minka's tail with its white tip, paws
    const ph = Math.floor(t * 5) % 4, X = x - E.camX;
    ctx.save(); ctx.translate(X, y);
    if (ph === 0 || ph === 2) { ctx.save(); ctx.rotate(ph ? -0.7 : 2.4); for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#5d6679' : '#97a2b6'; ctx.fillRect(14 + i * 2.2, -3, 2.4, 6); } ctx.restore(); }
    if (ph === 1 || ph === 3) { ctx.save(); ctx.rotate(ph === 1 ? 0.5 : -2.6); for (let i = 0; i < 8; i++) { ctx.fillStyle = i >= 6 ? '#f1ede4' : '#1d1b26'; ctx.fillRect(15 + i * 2, -1.5, 2.2, 3); } ctx.restore(); }
    ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.arc(Math.cos(t * 13) * 19, 7 + Math.sin(t * 11) * 3, 2.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(Math.cos(t * 9 + 2) * 18, -6 + Math.sin(t * 7) * 3, 2.4, 0, 7); ctx.fill();
    const puffs = [];
    for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28 + t * 6; puffs.push([Math.cos(a) * 16, Math.sin(a) * 9 - 1, 9 + Math.sin(t * 9 + i * 1.7) * 2.6]); }
    ctx.fillStyle = 'rgba(120,108,96,.55)'; for (const [px, py, r] of puffs) { ctx.beginPath(); ctx.arc(px, py + 1.2, r + 1.2, 0, 7); ctx.fill(); }      // rim
    puffs.forEach(([px, py, r], i) => { ctx.fillStyle = i % 3 ? '#fbf8f2' : '#e9e2d6'; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, -1, 21, 13, 0, 0, 7); ctx.fill();
    ctx.restore();
    if (Math.floor(t * 3) % 2) emoji(Math.floor(t * 3) % 4 === 1 ? '😾' : '🙀', x + Math.sin(t * 7) * 8, y - 2, 10);
  }
  function drawSilly(S) {
    const u = (E.t - S.t0) / 1.9; if (u > 1 || S.room !== G.room) { if (u > 1) FX.silly = null; return; }
    const c = E.ctx, x = S.x, y = S.y;
    if (S.k === 'spider') { const dy = Math.min(1, u * 4) * 22 + Math.sin(E.t * 6) * 2, sx = x + Math.sin(E.t * 3) * 3; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - E.camX, y - 14); c.lineTo(sx - E.camX, y - 14 + dy); c.stroke(); emoji('🕷️', sx, y - 12 + dy, 10, 1, Math.sin(E.t * 10) * 0.35); if (u > 0.3) emoji('👋', sx + 8, y - 18 + dy, 7, 1, Math.sin(E.t * 14) * 0.6); }
    else if (S.k === 'bunny') { const hx = x + S.dir * u * 46, hy = y + 8 - Math.abs(Math.sin(u * Math.PI * 3)) * 10; c.fillStyle = '#b9b4ae'; c.beginPath(); c.arc(hx - E.camX, hy, 5, 0, 7); c.fill(); c.fillStyle = '#d8d4cf'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + E.t * 3; c.fillRect(Math.round(hx + Math.cos(a) * 5 - E.camX), Math.round(hy + Math.sin(a) * 5), 2, 2); } c.fillStyle = '#222'; c.fillRect(Math.round(hx - 2 + S.dir - E.camX), Math.round(hy - 1), 1, 2); c.fillRect(Math.round(hx + 1 + S.dir - E.camX), Math.round(hy - 1), 1, 2); }
    else if (S.k === 'duck') { const hy = y - Math.abs(Math.sin(u * Math.PI * 2)) * 18; emoji('🦆', x, hy, 11, 1, Math.sin(E.t * 9) * 0.2); }
    else if (S.k === 'yarn') { emoji('🧶', x + S.dir * u * 60, Math.min(y + 8, y - 14 + u * 70), 10, 1, u * 12 * S.dir); }
    else if (S.k === 'sock') { if (u < 0.45) { const k = u / 0.45, tx = marina.x, ty = marina.y + marina.offY - 76 * marina.scale + 4; emoji('🧦', x + (tx - x) * k, y + (ty - y) * k - Math.sin(k * Math.PI) * 26, 11, 1, k * 8); } }
  }

  // ================================================================ taps
  const anchor = { get x() { return mk.x; }, get y() { return feetY(); }, get here() { return !!mk && (vis() || !!(mk.watch && mk.room === G.room)); }, get prop() { return { k: 'p:minka', x: mk.x, y: feetY() + (mk.watch ? 4 : 0), w: 26, h: mk.watch ? 14 : 28 }; } };
  const bubAt = { get x() { return mk.x; }, get y() { return feetY() - 26; }, prop: true, get here() { return vis(); } };
  function mkAt(wx, wy) {
    if (!mk || !ART.ok || mk.room !== G.room) return false;
    if (mk.watch) { const p = propOf(mk.watch); if (!p) return false; const [ex, ey] = LW(p, mk.watch.ex, mk.watch.ey); return Math.abs(wx - ex) < 16 && wy > ey - 14 && wy < ey + 12; }
    if (mk.hidden) return false;
    const b = visBox(mKey(mk)), s = MS * depthScale(mk.y), half = Math.max(Math.abs(b[0]), Math.abs(b[2])) * s, fy = feetY() + (mk.oy || 0), pad = 7;
    return wx > mk.x - half - pad && wx < mk.x + half + pad && wy > fy + b[1] * s - pad && wy < fy + b[3] * s + pad;
  }
  function iconAt(wx, wy) { for (const s of SPOTS) { if (s.room !== G.room || H.checked[s.id]) continue; const ic = spotIcon(s); if (ic && Math.abs(wx - ic[0]) < 12 && Math.abs(wy - ic[1]) < 12) return s; } return null; }
  { const _ht = hitTest; hitTest = function (wx, wy) {
      const h = _ht(wx, wy); if (!mk || !ART.ok) return h;
      try {
        if (h && (h.kind === 'mess' || h.kind === 'wild')) return h;
        const front = h && h.kind === 'ent' && h.e !== mk ? h.e : null;
        if (H.on && H.in && isDown(G.room) && !H.busy) { const s = iconAt(wx, wy); if (s) return { kind: 'mkspot', s }; }
        if (mkAt(wx, wy) && (!front || front.y <= mk.y + 0.5 || (NK.on && front === niko))) return { kind: 'ent', e: mk };
        if (h && h.kind === 'ent' && h.e === mk) return null;
      } catch (e) { warn(e); }
      return h;
    }; }
  { const _in = interact; interact = function (hit, wx, wy) {
      if (hit && hit.kind === 'mkspot') return search(hit.s);
      if (hit && hit.kind === 'ent' && mk && hit.e === mk) return ok(tapMinka);
      return _in(hit, wx, wy);
    }; }
  { const _ea = entActions; entActions = function (e) { if (typeof niko !== 'undefined' && e === niko && NK.on) return [A('🙅', stepIn)]; return _ea(e); }; }
  { const _pa = propActions; propActions = function (p) { const a = _pa(p); try { if (H.on && H.in && isDown(G.room)) { const s = SPOTS.find(x => x.room === G.room && x.prop === p.id); if (s) a.unshift(A('🔍', () => search(s))); } } catch (e) { } return a; }; }
  // Niko's own games with Marina call off a run-in at once
  for (const name of ['petNiko', 'pickupNiko', 'chaseNiko', 'feedNiko']) { const f = window[name]; if (typeof f !== 'function') continue; window[name] = function () { if (NK.hold) ok(() => abortNK('niko')); return f.apply(this, arguments); }; }

  // ================================================================ Marina and Minka
  function choices() { const a = []; if (E.t < M.comfortUntil) a.push(A('🫶', comfort)); a.push(A('✋', hand), A('🐟', treat), A('🪶', feather)); return a; }
  function tapMinka() {
    UI.closeActions();
    if (NK.on) return UI.actions(anchor, [A('🙅', stepIn)]);
    if (M.scene || H.on || !(vis() || mk.watch)) return;
    const L = lvl(), d = Math.abs(marina.x - mk.x), want = [44, 32, 24][L];
    UI.actions(anchor, choices());
    if (d > want + 8 && !marina.mount && !['sit', 'perch', 'anim', 'wheel'].includes(marina.state)) {      // she tiptoes over, quiet as a mouse
      const side = marina.x < mk.x ? -1 : 1; marina.stop(); UI.bubble(marina, '🤫', 1100);
      marina.walkTo(clamp(mk.x + side * want, 12, RW(G.room) - 12), () => { marina.dir = -side; }, 36);
    }
    if (mk.watch) { emo(mk, '👀', 900, { dx: 0 }); }
    else if (mk.state === 'nap') { mk.state = L ? 'loaf' : 'sit'; mk.blinkT = E.t + 0.5; }
    else if (L === 0) { mk.dir = dirTo(mk, marina); mk.state = 'wary'; emo(mk, '👀', 900); setTimeout(() => { if (mk.state === 'wary' && !M.scene) mk.state = 'sit'; }, 900); }
    else if (L === 1) { mk.dir = dirTo(mk, marina); slowBlink(); }
    else { mk.dir = dirTo(mk, marina); snd('minka_mrrp', { vol: 0.7 }); emo(mk, '💕', 900); }
    gain(1.5, 'tap', 15);
    if (L === 0 && E.t - M.loveAt > 100 && chance(0.6)) { M.loveAt = E.t; setTimeout(() => { if (!G.busy) say1('m_minka_love'); }, 800); }
  }
  function slowBlink() { mk.blinkT = E.t + 0.9; setTimeout(() => { if (mk) mk.blinkT = E.t + 0.7; }, 1500); if (lvl() >= 1) setTimeout(() => { if (vis()) emit('heart', mk.x, feetY() - 22, 1, { size: 8 }); }, 700); }
  function scene(fn) {
    if (H.on && !H.in) endHide('scene', true);
    if (M.tok) M.tok.dead = true; job(); mk.stop(); mk.trip = null; M.scene = true;
    const tok = run(fn, t => { if (M.tok !== t) return; M.tok = null; M.scene = false; mk.creep = false; mk.rot = 0; if (mk.an && !mk.anUntil) mk.an = null; if (FX.treat && FX.treat.tok === t) FX.treat = null; if (FX.feather && FX.feather.tok === t) FX.feather = null; });
    M.tok = tok; return tok;
  }
  function endScene() { if (!M.tok && !M.scene) return; if (M.tok) M.tok.dead = true; M.tok = null; M.scene = false; FX.treat = null; FX.feather = null; if (mk) { mk.creep = false; mk.an = null; mk.rot = 0; finishArcs(mk); } }
  async function tiptoe(tok, dist) {
    if (marina.mount || ['sit', 'perch', 'wheel'].includes(marina.state)) return;
    const side = marina.x < mk.x ? -1 : 1, tx = clamp(mk.x + side * dist, 12, RW(G.room) - 12);
    if (Math.abs(marina.x - tx) > 4) { if (marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; } await go(tok, marina, tx, 36); }
    marina.dir = -side;
  }
  async function hopDown(tok, always) {
    if (mk.watch) { mk.watch = null; mk.y = 158; mk.state = 'low'; mk.creep = true; if (tok) await W(tok, 250); mk.creep = false; mk.state = 'stand'; return true; }
    if (mk.perchY == null) return true;
    if (!always && mk.perchY < 112 && lvl() === 0) return false;     // up high and shy: she stays up there
    setAn('minka_leap', { once: true, dur: 0.45, move: true }); await mJump(mk.x + mk.dir * 12, null, 0.45, 8); mk.an = null; mk.state = 'stand'; mk.y = clamp(mk.y, 150, 176);
    if (tok && tok.dead) throw STOP; return true;
  }
  function sniff() { for (let i = 0; i < 3; i++) setTimeout(() => { if (vis()) emit('sparkle', mk.x + mk.dir * 12, feetY() - 10, 1, { vx: -mk.dir * 8, vy: -6, col: '#ffffff' }); }, i * 220); }
  function hand() {
    UI.closeActions(); if (!vis() && !mk.watch) return; const L = lvl(), close = E.t - M.closeAt < 25 || Math.abs(mk.x - marina.x) < 32 || E.t < M.comfortUntil;
    scene(async tok => {
      const down = await hopDown(tok);
      if (!down) { mk.dir = dirTo(mk, marina); snd('minka_mew', { vol: 0.6 }); emo(mk, '❔', 1200); UI.bubble(bubAt, '🐟❔', 1800); return; }     // too high to reach: a little mew from up there
      const kind = L >= 1 || close;
      await tiptoe(tok, kind ? 24 : 38);
      marina.dir = dirTo(marina, mk); playAnim('marina_reach', { fps: 8, proc: 'hug', dur: 1.1 });
      if (kind) {
        mk.state = 'stand'; mk.creep = true; await go(tok, mk, marina.x + (mk.x < marina.x ? -16 : 16), 18, clamp(marina.y - 1, 150, 176)); mk.creep = false; mk.dir = dirTo(mk, marina); sniff(); await W(tok, 700);
        playAnim('marina_pet', { fps: 6, proc: 'hug', dur: 1.8 }); snd('purr'); emit('heart', mk.x, feetY() - 18, 5); mk.state = 'sit'; mk.blinkT = E.t + 0.7; ev('pet'); gain(6, 'pet', 8); T.pets = (T.pets || 0) + 1; save(); M.closeAt = E.t;
        if (L === 2) { await W(tok, 900); setAn('minka_roll', { once: true, dur: 0.9 }); await W(tok, 900); mk.an = null; mk.state = 'flop'; snd('trill2', { vol: 0.6 }); emit('heart', mk.x, feetY() - 14, 6); playAnim('marina_pet', { fps: 6, proc: 'hug', dur: 1.6 }); await W(tok, 1800); mk.state = 'sit'; }
        else await W(tok, 1200);
      } else {
        // a polite sniff from further off, then a few steps back — no scolding, just not yet
        mk.dir = dirTo(mk, marina); mk.state = 'stand'; mk.rot = mk.dir * 0.05; sniff(); await W(tok, 900); mk.rot = 0;
        snd('minka_mew', { vol: 0.55, rate: 1.1 });
        await go(tok, mk, mk.x + (mk.x < marina.x ? -13 : 13), 40); mk.dir = dirTo(mk, marina); mk.state = 'sit'; UI.bubble(bubAt, '🐟❔', 2000); slowBlink(); gain(2, 'hand0', 10);
        await W(tok, 600);
      }
    });
  }
  function treat() {
    UI.closeActions(); if (!vis() && !mk.watch) return; const L = lvl();
    scene(async tok => {
      if (marina.state === 'anim') { marina.state = 'idle'; marina.anim = null; }
      marina.dir = dirTo(marina, mk); if (marina.state !== 'sit') playAnim('marina_reach', { fps: 10, proc: 'hug', dur: 0.6 });
      const side = Math.sign(marina.x - mk.x) || 1, gap = Math.abs(marina.x - mk.x), lx = clamp(mk.x + side * Math.max(14, Math.min(gap - 12, gap * [0.3, 0.5, 0.7][L])), 14, RW(G.room) - 14);
      const ly = clamp((mk.watch ? 158 : mk.perchY != null ? mk.y : mk.y) + 2, 152, 178);
      FX.treat = { room: G.room, x0: marina.x + marina.dir * 10, y0: marina.y + marina.offY - 44, x: lx, y: ly, t0: E.t, dur: 0.6, tok }; Audio2.whoosh(true);
      await W(tok, 620); Audio2.blip(19, 'triangle', 0.05, 0.06); emo(mk, '❗', 700); await W(tok, 450);
      await hopDown(tok, true);
      mk.creep = L < 2; mk.state = 'stand'; await go(tok, mk, lx - side * 9, L < 2 ? 22 : 45, ly - 2); mk.creep = false; mk.dir = side;
      setAn('minka_low'); for (let i = 0; i < 3; i++) { await W(tok, 360); Audio2.blip(pick([2, 4, 5]), 'square', 0.03, 0.05); mk.oy = 0.8; await W(tok, 120); mk.oy = 0; }
      FX.treat = null; setAn('minka_groom', { fps: 6 }); await W(tok, 900); mk.an = null; mk.state = 'sit'; slowBlink(); emit('heart', mk.x, feetY() - 18, L ? 3 : 1); gain(8, 'treat', 6); M.closeAt = E.t;
      await W(tok, 500);
    });
  }
  function feather() {
    UI.closeActions(); if (!vis() && !mk.watch) return;
    scene(async tok => {
      await hopDown(tok, true);
      if (marina.state === 'sit' || marina.state === 'anim') { marina.state = 'idle'; marina.offY = 0; marina.anim = null; }
      const side = Math.sign(mk.x - marina.x) || 1, R = RW(G.room); marina.dir = side;
      const F = FX.feather = { x: marina.x + side * 30, tx: marina.x + side * 30, y: mk.y, tok }; Audio2.jingle([12, 16, 19], 0.05);
      for (let i = 0; i < 4; i++) {
        F.tx = clamp(marina.x + side * (i % 2 ? 66 : 30) + rnd(-4, 4), 14, R - 14); F.y = clamp(marina.y, 150, 176); await W(tok, 420);
        mk.dir = Math.sign(F.x - mk.x) || mk.dir; mk.state = 'stand'; setAn('minka_wiggle', { fps: 10 }); await W(tok, 700 - i * 90);
        setAn('minka_leap', { once: true, dur: 0.45, move: true }); snd(i % 2 ? 'trill1' : 'minka_mrrp', { vol: 0.6 }); await mJump(F.x - mk.dir * 7, null, 0.45, 13); if (tok.dead) throw STOP;
        mk.an = null; mk.state = 'stand'; emit('star', F.x, mk.y - 8, 3); F.tx = clamp(F.x + mk.dir * -40, 14, R - 14);
      }
      // a happy flop on her back — shyness quite forgotten
      setAn('minka_roll', { once: true, dur: 0.8 }); await W(tok, 800); mk.an = null; mk.state = 'flop'; emit('heart', mk.x, mk.y - 14, 4); say1('m_giggle'); gain(6, 'feather', 6); M.closeAt = E.t;
      await W(tok, 1600); FX.feather = null; mk.state = 'sit';
    });
  }
  function comfort() {
    UI.closeActions(); M.comfortUntil = 0; if (!vis()) return;
    scene(async tok => {
      await hopDown(tok, true); await tiptoe(tok, 22); marina.dir = dirTo(marina, mk); mk.dir = dirTo(mk, marina); mk.state = 'sit'; emo(mk, null);
      playAnim('marina_pet', { fps: 6, proc: 'hug', dur: 1.8 }); snd('purr'); emit('heart', mk.x, feetY() - 18, 6); slowBlink(); ev('pet'); gain(5, 'comfort', 5); M.closeAt = E.t;
      await W(tok, 1900);
    });
  }

  // ================================================================ hide and seek
  function pickSpot(room, not) { const c = SPOTS.filter(s => s !== not && propOf(s) && (!room || s.room === room)); return c.length ? pick(c) : null; }
  function hideNow(id) {
    if (!mk) return null; let s = id ? SPOTS.find(x => x.id === id && propOf(x)) : null;
    if (!s) { const here = isDown(G.room) ? pickSpot(G.room) : null; s = (here && chance(0.75) ? here : pickSpot()) || here; }
    if (!s) return null;
    if (NK.hold) abortNK('hide'); endScene(); if (H.on) endHide('again', true);
    startHide(s, { round: 1 }); return s.id;
  }
  function startHide(s, o) {
    note('hide', s.id, o.round, o.quiet ? 'quiet' : '');
    const j = job(); mk.stop(); mk.trip = null; mk.watch = null; M.mode = 'hide';
    H.on = true; H.in = false; H.spot = s; H.round = o.round || 1; H.t0 = E.t; H.cl = { rise: 0, riseTo: 0, next: E.t + 2.2 }; H.wrong = 0; H.busy = false; H.checked = {}; H.leftAt = 0;
    const p = propOf(s);
    const tuck = () => { if (mk.job !== j || !H.on) return; mk.stop(); mk.an = null; mk.perchY = null; mk.room = s.room; mk.x = p.x; mk.y = WALL; mk.hidden = true; mk.alpha = 1; H.in = true; H.t0 = E.t;
      if (G.room === s.room) { H.cl.wobT = E.t + 0.5; const [hx, hy] = spotHead(s); emit('dust', hx, hy - 4, 4); } };
    if (vis()) {           // she makes a dash for it
      mk.state = 'stand'; mk.creep = false;
      const hopIn = () => { if (mk.job !== j) return; const [hx, hy] = spotHead(s); if (!['high', 'box', 'tub', 'drum', 'window', 'pile'].includes(s.kind) || hy > mk.y - 4) return tuck();
        setAn('minka_leap', { once: true, dur: 0.4, move: true }); mJump(hx, hy, 0.4, s.kind === 'high' ? 16 : 10).then(() => { mk.an = null; tuck(); }); };
      const dash = () => { if (mk.job !== j) return; if (s.room === mk.room) { const [hx] = spotHead(s); mk.walkTo(hx - (['high', 'box', 'tub', 'drum', 'window'].includes(s.kind) ? (Math.sign(hx - mk.x) || 1) * 14 : 0), hopIn, 115, s.kind === 'under' || s.kind === 'pile' ? 160 : WALL); } else { const h = nextHop(mk.room, s.room); const x = h && h[1] === -1 ? 4 : RW(mk.room) - 4; mk.walkTo(x, () => { if (mk.job !== j) return; mk.hidden = true; setTimeout(tuck, 900); }, 115, WALL); } };
      if (mk.perchY != null) { finishArcs(mk); setAn('minka_leap', { once: true, dur: 0.4, move: true }); mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(() => { mk.an = null; dash(); }); } else dash();
    } else tuck();
    if (!o.quiet) { ev('hiding'); H.said = false; announce(); }
  }
  function announce() {
    if (!H.on || H.said || !isDown(G.room) || E.t - M.whereAt < 35) return; H.said = true; M.whereAt = E.t;
    const nu = typeof nunu !== 'undefined' && nunu.here;
    setTimeout(() => { if (H.on && !G.busy && isDown(G.room)) say1('m_minka_where'); }, nu ? 2800 : 1000);
  }
  function endHide(why, silent) {
    if (!H.on) return; const s = H.spot, was = H.in; H.on = false; H.in = false; H.spot = null; H.busy = false; H.lastEnd = E.t; M.mode = 'home'; FX.silly = null;
    if (!mk) return; mk.hidden = false; mk.alpha = 1;
    if (silent) return;
    if (why === 'timeout' && was && s) {
      if (G.room === s.room) { const [hx, hy] = spotHead(s); mk.room = s.room; mk.x = hx; mk.perchY = hy < WALL - 2 ? hy : null; mk.y = s.kind === 'under' ? 158 : WALL; mk.state = 'stand'; mk.wait = 0.5; const n = naps(mk.room); if (n.length) setTimeout(() => restAt(pick(n)), 600); }
      else restAt(pick(NAPS));
    }
  }
  function search(s) {
    if (!H.on || !H.in || H.busy) return; const p = propOf(s); if (!p) return; UI.closeActions(); H.busy = true;
    const gx = s.kind === 'high' ? p.x + (s.dx || 0) : spotIcon(s)[0], tok = H.btok = {};
    const safety = setTimeout(() => { if (H.btok === tok) H.busy = false; }, 7000);
    approach(gx, () => {
      if (H.btok !== tok) return; marina.dir = Math.sign(gx - marina.x) || marina.dir;
      playAnim('marina_reach', { fps: 9, proc: 'hug', dur: 0.8 }); Audio2.blip(pick([9, 12]), 'triangle', 0.05, 0.08); const ic = spotIcon(s); emit('dust', ic[0], ic[1] + 12, 3);
      setTimeout(() => { clearTimeout(safety); H.busy = false; if (!H.on || !H.in) return; if (s === H.spot) found(); else nothing(s); }, 700);
    }, 18);
  }
  const SILLY = ['sock', 'spider', 'bunny', 'duck', 'yarn'];
  function nothing(s) {
    H.wrong++; H.checked[s.id] = true; const ic = spotIcon(s), k = pick(SILLY.filter(x => x !== H.lastSilly)); H.lastSilly = k;
    FX.silly = { k, x: ic[0], y: ic[1] + 12, t0: E.t, room: G.room, dir: Math.sign(ic[0] - marina.x) || 1 };
    if (k === 'sock') { FX.sock = E.t + 3.2; FX.sockRoom = G.room; Audio2.whoosh(true); }
    else if (k === 'spider') { Audio2.blip(26, 'sine', 0.06, 0.06); setTimeout(() => Audio2.blip(28, 'sine', 0.06, 0.06), 160); }
    else if (k === 'bunny') { Audio2.noise(0.25, 0.12, 2200); }
    else if (k === 'duck') { Audio2.blip(17, 'square', 0.08, 0.08); setTimeout(() => Audio2.blip(19, 'square', 0.08, 0.08), 180); }
    else Audio2.blip(7, 'triangle', 0.15, 0.08);
    setTimeout(() => say1(pick(k === 'spider' || k === 'bunny' ? ['m_uhoh', 'm_giggle'] : ['m_hmm', 'm_giggle', 'm_uhoh'])), 450);
    setTimeout(() => ok(hintFrom), 1900);
  }
  function hintFrom() {                 // a mew from where she really is
    if (!H.on || !H.in) return; const s = H.spot, p = propOf(s);
    if (s.room === G.room) { mew(p, s, Math.abs(marina.x - p.x)); const cl = H.cl; cl.riseTo = 1; cl.twT = E.t + 1.3; cl.eyesT = E.t + 2; cl.earT = E.t + 0.5; if (s.wob) cl.wobT = E.t + 0.6; setTimeout(() => { if (H.cl === cl) cl.riseTo = 0; }, 1500); }
    else { Audio2.sfx('minka_mew', { vol: 0.35 }); pawHint(s.room); }
  }
  function mew(p, s, d) {
    Audio2.sfx('minka_mew', { vol: clamp(1.05 - d / 240, 0.22, 1), rate: rnd(1, 1.15) });
    if (d < 140) { const ic = spotIcon(s); emit('heart', ic[0] + rnd(-6, 6), ic[1] + 8, 1, { ch: '🎵', size: 7, vx: rnd(-6, 6), vy: -16, life: 1.1 }); }
  }
  function pawHint(room) {
    const side = DOWN.indexOf(room) < DOWN.indexOf(G.room) ? -1 : 1, R = RW(G.room), x = side < 0 ? Math.max(0, E.camX) + 22 : Math.min(R, E.camX + E.viewW) - 22;
    for (let i = 0; i < 3; i++) setTimeout(() => emit('heart', x - side * i * 7, 158 - i * 2, 1, { ch: '🐾', size: 9, vx: side * 4, vy: -3, life: 1.6 }), i * 260);
  }
  function found() {
    const s = H.spot, p = propOf(s), round = H.round; H.in = false; T.finds = (T.finds || 0) + 1; gain(5);
    if (!M.didFind) { M.didFind = true; try { window.did && did('minka'); } catch (e) { } }
    ev('found');
    const [hx, hy] = spotHead(s), ic = spotIcon(s);
    Audio2.sfx('minka_mrrp'); emit('sparkle', ic[0], ic[1] + 10, 14); emit('heart', ic[0], ic[1] + 6, 4); emit('star', ic[0], ic[1] + 6, 4);
    mk.hidden = false; mk.room = s.room; mk.x = hx; mk.y = s.kind === 'pile' || s.kind === 'under' ? 160 : WALL + 2; mk.perchY = hy < mk.y - 2 ? hy : null; mk.dir = Math.sign(marina.x - hx) || 1; mk.alpha = 1; mk.watch = null;
    scene(async tok => {
      const R = RW(mk.room); let out = -(Math.sign(marina.x - hx) || 1); if (hx + out * 30 < 14 || hx + out * 30 > R - 14) out = -out;      // out on the far side, where Marina isn't standing in the way
      const ex = clamp(hx + out * 30, 14, R - 14); mk.dir = out;
      setAn('minka_leap', { once: true, dur: 0.55, move: true }); await mJump(ex, null, 0.55, 20); mk.an = null; mk.state = 'sit'; mk.dir = dirTo(mk, marina);
      emit('confetti', mk.x, mk.y - 20, 10);
      if (round >= 2 || lvl() >= 1) { await W(tok, 1500); endHide('found'); await strokeHer(tok); }
      else {        // she isn't quite done playing: one more go
        await W(tok, 1700); snd('minka_mrrp', { rate: 1.25 }); emo(mk, '😸', 900); await W(tok, 500);
        const n = pickSpot(s.room, s) || pickSpot(null, s); if (!n) { endHide('found'); return; }
        M.scene = false; M.tok = null; startHide(n, { round: round + 1, quiet: true });
      }
    });
  }
  async function strokeHer(tok) {
    await tiptoe(tok, 20); marina.dir = dirTo(marina, mk); mk.dir = dirTo(mk, marina);
    playAnim('marina_pet', { fps: 6, proc: 'hug', dur: 1.8 }); snd('purr'); emit('heart', mk.x, feetY() - 18, 6); slowBlink(); gain(3, 'stroke', 10); M.closeAt = E.t;
    await W(tok, 1900);
  }
  function hideTick(dt) {
    const s = H.spot; if (!s) { H.on = false; return; } if (!H.in) { if (!M.scene && E.t - H.t0 > 10) endHide('stuck', true); return; }
    const p = propOf(s); if (!p) return endHide('gone');
    if (!isDown(G.room)) { if (!H.leftAt) H.leftAt = E.t; if (E.t - H.leftAt > 40) return endHide('timeout'); } else { H.leftAt = 0; if (!H.said) announce(); }
    if (E.t - H.t0 > 100) return endHide('timeout');                 // nobody came looking: she comes out by herself
    const cl = H.cl, here = G.room === s.room, d = here ? Math.abs(marina.x - p.x) : 999;
    cl.rise += ((cl.riseTo || 0) - cl.rise) * Math.min(1, dt * 7);
    if (here && d < 30 && !H.busy) cl.riseTo = 0;            // she ducks when Marina is right beside her
    if (E.t < cl.next || H.busy || panelUp() || (window.Clarity && Clarity.is('G2') && inActivity())) return; /* G2 */
    cl.next = E.t + rnd(2.6, 4.8) - Math.min(1.4, H.wrong * 0.45);
    if (here) {
      const opts = (s.kind === 'rack' ? ['tail', 'mew'] : ['peek', 'peek', 'mew', 'tail', 'ear']).concat(s.wob ? ['wob', 'wob'] : [], s.kind === 'under' || s.kind === 'rack' ? ['eyes', 'eyes'] : []);
      const c = pick(opts);
      if (c === 'peek') { cl.riseTo = 1; cl.blinkT = E.t + 1.4; setTimeout(() => { if (H.cl === cl) cl.riseTo = 0; }, 1500 + rnd(0, 600)); }
      else if (c === 'eyes') cl.eyesT = E.t + 2.2;
      else if (c === 'tail') cl.twT = E.t + 1.4;
      else if (c === 'ear') cl.earT = E.t + 0.5;
      else if (c === 'wob') { cl.wobT = E.t + 0.6; Audio2.noise(0.12, 0.04, 600); }
      if (c === 'mew' || chance(0.3)) mew(p, s, d);
    } else if (isDown(G.room) && chance(0.35)) { Audio2.sfx('minka_mew', { vol: 0.2 }); if (chance(0.6) || (window.Clarity && Clarity.is('G29'))) pawHint(s.room); } /* G29: every far-room mew comes with its 🐾 direction */
  }

  // ================================================================ getting about: room to room, and up and down the stairs
  function nbr(r) { const R = ROOMS[r] || {}, n = []; if (R.left && canGo(R.left)) n.push([R.left, -1]); if (R.right && canGo(R.right)) n.push([R.right, 1]); if (r === 'foyer') n.push(['den', 'down']); if (r === 'den') n.push(['foyer', 'up']); return n; }
  function nextHop(a, b) {
    if (a === b || !canGo(b)) return null; const prev = { [a]: null }, q = [a];
    while (q.length) { const r = q.shift(); if (r === b) break; for (const [n, how] of nbr(r)) if (!(n in prev)) { prev[n] = [r, how]; q.push(n); } }
    if (!(b in prev)) return null; let cur = b; while (prev[cur] && prev[cur][0] !== a) cur = prev[cur][0]; return [cur, prev[cur][1]];
  }
  function travel(to, cb, sp) {
    const j = job(); mk.stop(); mk.watch = null; mk.trip = j; mk.tripT = E.t; sp = sp || 46;
    const step = () => {
      if (mk.job !== j) return;
      if (mk.room === to) { mk.trip = null; mk.hidden = false; cb && cb(); return; }
      if (!canGo(mk.room)) { mk.room = 'den'; mk.x = STAIR_X; }
      const h = nextHop(mk.room, to); if (!h) { mk.trip = null; return; }
      const [nx, how] = h, v = vis();
      const arrive = () => {
        if (mk.job !== j) return; mk.room = nx; mk.hidden = false; mk.perchY = null; mk.alpha = 1; mk.oy = 0; mk.an = null;
        if (how === 'down') { mk.x = 40; mk.y = WALL; } else if (how === 'up') { mk.x = DOOR_X; mk.y = 150; } else { mk.x = how < 0 ? RW(nx) - 6 : 6; mk.y = WALL; }
        if (!vis()) { mk.hidden = true; return setTimeout(() => { if (mk.job === j) { mk.hidden = false; step(); } }, rnd(1200, 2600)); }
        if (how === 'down') { mk.alpha = 0; mk.oy = -34; tw(mk, { alpha: 1, oy: 0, x: STAIR_X }, 1.1).then(step); }
        else if (how === 'up') { mk.alpha = 0; tw(mk, { alpha: 1 }, 0.6).then(step); }
        else mk.walkTo(how < 0 ? RW(nx) - 30 : 30, step, sp, WALL);
      };
      if (!v) { mk.hidden = true; return setTimeout(arrive, rnd(900, 2000)); }
      const ex = how === 'down' ? DOOR_X : how === 'up' ? STAIR_X : how < 0 ? 4 : RW(mk.room) - 4;
      const out = () => { if (mk.job !== j) return; if (how === 'down') tw(mk, { alpha: 0 }, 0.5).then(() => { mk.hidden = true; setTimeout(arrive, 600); });
        else if (how === 'up') { mk.dir = -1; tw(mk, { alpha: 0, oy: -34, x: 44 }, 1.1).then(() => { mk.hidden = true; mk.oy = 0; setTimeout(arrive, 600); }); }
        else { mk.hidden = true; setTimeout(arrive, 500); } };
      const walk = () => mk.walkTo(ex, out, sp, how === 'down' ? 150 : WALL);
      if (mk.perchY != null) { setAn('minka_leap', { once: true, dur: 0.4, move: true }); mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(() => { mk.an = null; if (mk.job === j) walk(); }); } else walk();
    };
    step();
  }
  function restAt(n) {
    if (!n) return; const j = job(); mk.stop(); mk.watch = null; mk.trip = null;
    const settle = () => { if (mk.job !== j) return; mk.state = n.pose; mk.dir = n.dir || pick([-1, 1]); mk.restSpot = n; mk.y = n.y; };
    if (!vis() || n.room !== mk.room) {
      if (vis() && n.room !== mk.room) return travel(n.room, () => restAt(n));
      mk.room = n.room; mk.x = n.x; mk.y = n.y; mk.perchY = n.perch; mk.hidden = false; settle(); return;
    }
    const up = () => { if (mk.job !== j) return; if (n.perch != null) { mk.dir = Math.sign(n.x - mk.x) || mk.dir; setAn('minka_leap', { once: true, dur: 0.45, move: true }); mJump(n.x, n.perch, 0.45, n.perch < 110 ? 16 : 9).then(() => { if (mk.job !== j) return; mk.an = null; settle(); }); } else settle(); };
    const walk = () => { if (mk.job !== j) return; const side = mk.x < n.x ? -1 : 1; mk.walkTo(n.x + (n.perch != null ? side * 14 : 0), up, 34, n.perch == null || n.y > 160 ? n.y : WALL); };
    if (mk.perchY != null) { setAn('minka_leap', { once: true, dur: 0.4, move: true }); mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(() => { mk.an = null; walk(); }); } else walk();
  }
  function watchAt(s) {
    const p = propOf(s); if (!p) return; const j = job(); mk.stop(); mk.trip = null; const [ex] = LW(p, s.ex, s.ey);
    const tuck = () => { if (mk.job !== j) return; mk.watch = s; mk.room = s.room; mk.x = ex; mk.y = 158; mk.perchY = null; mk.state = 'sit'; };
    if (vis() && mk.room === s.room) { const walk = () => mk.walkTo(ex, tuck, 40, 160); if (mk.perchY != null) { mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(walk); } else walk(); }
    else tuck();
  }
  function comeUp() {
    if (!mk) return false; if (H.on) endHide('up', true); endScene(); if (NK.hold) abortNK('up');
    M.mode = 'up'; M.visitAt = E.t; M.upUntil = E.t + rnd(55, 95); const tgt = UP.includes(G.room) ? G.room : 'foyer';
    travel('foyer', () => { ev('upstairs'); if (tgt !== 'foyer') travel(tgt, edgeSpot, 44); else edgeSpot(); }, 50);
    return true;
  }
  function edgeSpot() {      // upstairs she keeps to the edges of a room, along the wall
    const R = RW(mk.room), j = job(), [va, vb] = viewB(mk.room), seen = mk.room === G.room && chance(0.6);       // the ends of the room, or the edges of what Marina can see
    const x = seen ? (chance(0.5) ? va + rnd(0, 14) : vb - rnd(0, 14)) : chance(0.5) ? rnd(18, 64) : rnd(R - 64, R - 18);
    mk.walkTo(x, () => { if (mk.job !== j) return; mk.state = pick(['sit', 'sit', 'loaf', 'stand']); mk.dir = x < R / 2 ? 1 : -1; }, 34, 150);
  }
  function goHome(fast) {
    if (!mk) return false; if (NK.hold) abortNK('home'); endScene(); if (H.on) endHide('home', true); M.mode = 'home';
    if (isDown(mk.room) && !mk.hidden) { restAt(pick(naps(mk.room).length ? naps(mk.room) : NAPS)); return true; }
    travel('den', () => restAt(pick(naps('den'))), fast ? 115 : 46); return true;
  }

  // ================================================================ her own life
  function think(dt) {
    if (mk.trip && E.t - (mk.tripT || 0) > 50 && !M.scene && !NK.hold) { mk.trip = null; mk.hidden = false; mk.alpha = 1; mk.oy = 0; if (isDown(mk.room) || M.mode !== 'up') { M.mode = 'home'; const n = naps(mk.room); restAt(n.length ? pick(n) : NAPS[0]); } else goHome(); return; }
    if (mk.trip || M.scene || H.on || NK.hold) return;
    if (mk.resume) { if (E.t < mk.freezeT) return; const r = mk.resume; mk.resume = null; mk.state = 'stand'; mk.walkTo(r.tx, r.cb, r.sp, r.ty); return; }
    if (mk.an && mk.anUntil && E.t > mk.anUntil) { mk.an = null; mk.anUntil = 0; }
    mk.wait = (mk.wait == null ? 3 : mk.wait) - dt; if (mk.moving || mk.wait > 0) return;
    if (M.mode === 'up') return thinkUp();
    thinkHome();
  }
  function thinkHome() {
    if (!isDown(mk.room)) { goHome(); return; }
    const v = vis(), r = Math.random();
    if (!v) { mk.wait = rnd(25, 60); mk.hidden = false; if (r < 0.65) restAt(pick(NAPS)); else if (r < 0.85) watchAt(pick(WATCH)); return; }
    mk.wait = rnd(9, 18);
    if (mk.watch) { if (r < 0.5) { mk.watch = null; mk.y = 158; mk.state = 'stand'; const n = naps(mk.room); if (n.length) restAt(pick(n)); else mk.walkTo(rnd(30, RW(mk.room) - 30), null, 34, WALL); } return; }
    const here = naps(mk.room);
    if (r < 0.3 && here.length) { restAt(pick(here)); mk.wait = rnd(18, 34); return; }
    if (r < 0.5) { const go2 = () => mk.walkTo(rnd(28, RW(mk.room) - 28), () => { mk.state = pick(['sit', 'sit', 'loaf']); }, 32, rnd(150, 152)); if (mk.perchY != null) mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(go2); else go2(); return; }
    if (r < 0.64) { if (mk.perchY == null || mk.state !== 'nap') { mk.state = 'sit'; setAn('minka_groom', { fps: 5, ms: 3200 }); } return; }
    if (r < 0.76) { const w = WATCH.find(s => s.room === mk.room); if (w) { watchAt(w); return; } }
    if (r < 0.88) { mk.state = mk.perchY != null ? 'loaf' : pick(['loaf', 'sit']); return; }
    const nbs = [ROOMS[mk.room].left, ROOMS[mk.room].right].filter(x => x && isDown(x)); if (nbs.length) { const to = pick(nbs); travel(to, () => { const n = naps(to); if (n.length) restAt(pick(n)); else mk.state = 'sit'; }, 40); }
  }
  function thinkUp() {
    mk.wait = rnd(6, 12);
    if (E.t > M.upUntil || !UP.includes(mk.room)) return goHome();
    if (chance(0.3)) { const to = chance(0.55) && UP.includes(G.room) ? G.room : pick(UP); if (to !== mk.room) return travel(to, edgeSpot, 44); }
    edgeSpot();
  }
  const LOG = [];
  const note = (...a) => { LOG.push([+E.t.toFixed(1), ...a]); if (LOG.length > 60) LOG.shift(); };
  function startle(why) {
    note('startle', why || '', Math.round(marina.x), Math.round(mk.x), marina.moving ? Math.round(marina.curSpeed) : 0);
    M.lastStartle = E.t; const j = job(); mk.stop(); mk.trip = null; mk.creep = false;
    mk.dir = dirTo(mk, marina); mk.state = 'wary'; mk.an = null; emo(mk, '❗', 700); snd('minka_mew', { vol: 0.7, rate: 1.45 }); emit('dust', mk.x, mk.y, 3);
    setTimeout(() => { if (mk.job !== j || M.scene || NK.hold) return;
      if (M.mode === 'up' || !isDown(mk.room)) { goHome(true); return; }
      const c = SPOTS.filter(s => s.room === mk.room && propOf(s)).sort((a, b) => Math.abs(spotHead(b)[0] - marina.x) - Math.abs(spotHead(a)[0] - marina.x));
      const s = c.length ? (chance(0.7) ? c[0] : pick(c)) : pickSpot(); if (s) startHide(s, { round: 1 }); }, 380);
  }
  function startleCheck() {
    if (!vis() || mk.trip && M.mode !== 'up' || M.scene || NK.hold || H.on || mk.watch) return;
    if (mk.perchY != null && mk.perchY < 112) return;                   // safe up high
    const mv = marina.mount || marina, d = Math.abs(mv.x - mk.x), L = lvl();
    if (E.t - M.lastStartle < 4) return;
    const toward = mv.moving && Math.sign((mv.tx == null ? mv.x : mv.tx) - mv.x) === Math.sign(mk.x - mv.x) && Math.abs((mv.tx == null ? mv.x : mv.tx) - mk.x) < d + 30;
    const sp = mv.moving ? mv.curSpeed : 0, loud = ['tantrum', 'stomp', 'flip'].includes(marina.state) && d < 110;
    const R = L === 0 ? 95 : L === 1 ? 50 : 46, thr = L === 2 ? 88 : 58;
    if (loud || (toward && sp >= thr && d < R)) startle(loud ? 'loud' : 'run');
  }
  function freezeCheck() {
    if (!vis() || M.mode !== 'up' || mk.perchY != null || M.scene || NK.hold || E.t < (mk.freezeT || 0) + 0.8) return;
    const movers = [marina, daddy, mommy, rory, nunu, jeff, niko].filter(e => e && e.room === mk.room && !e.hidden && e.moving && Math.abs(e.x - mk.x) < 80 && (e !== marina || e.curSpeed > 40));
    if (!movers.length) return;
    mk.freezeT = E.t + rnd(1.2, 2.1); if (mk.moving) { mk.resume = { tx: mk.tx, ty: mk.ty, sp: mk.curSpeed, cb: mk.onArrive }; mk.moving = false; mk.onArrive = null; } mk.state = 'wary';
  }
  function creepCloser(dt) {
    if (!vis() || M.mode === 'hide' || mk.trip || mk.moving || M.scene || NK.hold || mk.resume) { M.stillT = 0; return; }
    const mv = marina.mount || marina; if (mv.moving || ['anim', 'tantrum', 'stomp'].includes(marina.state) || mv !== marina) { M.stillT = 0; return; }
    M.stillT += dt; const L = lvl(), sit = marina.state === 'sit', want = Math.max(16, [60, 36, 22][L] - (sit ? 14 : 0)), d = Math.abs(mk.x - marina.x);
    if (M.stillT < (sit ? 2 : 3.5) || d > 170 || d < want + 10 || E.t - M.creepAt < 10) return;
    if (mk.perchY != null && mk.perchY < 112) return;
    M.creepAt = E.t; if (mk.state === 'nap' && chance(0.5)) return;
    const j = job(); mk.watch && (mk.watch = null, mk.y = 158);
    const doIt = () => { if (mk.job !== j) return; mk.state = 'stand'; mk.creep = true; mk.walkTo(marina.x + (mk.x < marina.x ? -want : want), () => { if (mk.job !== j) return; mk.creep = false; mk.state = 'sit'; mk.dir = dirTo(mk, marina); slowBlink(); M.closeAt = E.t; gain(1, 'creep', 20); }, 18, clamp(marina.y - 1, 150, 176)); };
    if (mk.perchY != null) { mJump(mk.x + (marina.x > mk.x ? 12 : -12), null, 0.4, 8).then(doIt); } else doIt();
  }
  function follow() {
    const L = lvl(); if (L < 1 || !vis() || !isDown(G.room) || M.mode !== 'home' || mk.trip || M.scene || NK.hold || mk.state === 'nap' || mk.watch) return;
    const mv = marina.mount || marina; if (!mv.moving || mv.curSpeed > 85 || E.t - M.followAt < 2.5) return;
    const fd = L === 2 ? 34 : 70, tx = mv.tx == null ? mv.x : mv.tx, d = Math.abs(tx - mk.x); if (d < fd + 30) return;
    if (mk.perchY != null && mk.perchY < 112 && L < 2) return;
    M.followAt = E.t; const j = job();
    const walk = () => { if (mk.job !== j) return; mk.walkTo(tx + (mk.x < tx ? -fd : fd), () => { if (mk.job !== j) return; mk.state = 'sit'; mk.dir = dirTo(mk, marina); }, 50, WALL + 1); };
    if (mk.perchY != null) { mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(walk); } else walk();
  }
  function sofaHop() {
    if (lvl() < 2 || G.room !== 'den' || marina.state !== 'sit' || !vis() || mk.trip || M.scene || NK.hold || H.on || mk.watch || E.t - M.sofaAt < 45) return;
    const s = (PROPS.den || []).find(p => p.id === 'bsofa'); if (!s || Math.abs(marina.x - s.x) > 62) return;
    M.sofaAt = E.t; const j = job(), side = mk.x < marina.x ? -1 : 1, tx = clamp(marina.x + side * 20, s.x - 48, s.x + 48);
    const up = () => { if (mk.job !== j) return; mk.dir = -side; setAn('minka_leap', { once: true, dur: 0.45, move: true }); mJump(tx, 136, 0.45, 10).then(() => { if (mk.job !== j) return; mk.an = null; mk.y = 152; mk.state = 'loaf'; mk.dir = -side; snd('purr', { vol: 0.6 }); emit('heart', mk.x, 120, 4); gain(2, 'sofa', 30); }); };
    const walk = () => mk.walkTo(tx + side * 14, up, 44, 153);
    if (mk.perchY != null) mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(walk); else walk();
  }
  function present(dt, force) {
    if (!force && (lvl() < 2 || !vis() || M.mode !== 'home' || mk.trip || M.scene || NK.hold || !quiet() || marina.moving || E.t - M.presentAt < 200 || !chance(dt / 50))) return;
    const R = ROOMS[G.room]; const sides = [R.left ? -1 : 0, R.right ? 1 : 0].filter(Boolean); if (!sides.length) return;
    M.presentAt = E.t; const j = job(), side = sides.length > 1 ? (mk.x < R.w / 2 ? -1 : 1) : sides[0], ex = side < 0 ? 4 : R.w - 4;
    const back = () => { if (mk.job !== j) { mk.hidden = false; return; } mk.hidden = false; mk.carry = '🐭'; mk.state = 'stand';
      mk.x = side < 0 ? 6 : R.w - 6; mk.walkTo(marina.x + (ex < marina.x ? -18 : 18), () => { if (mk.job !== j) { mk.carry = null; return; } mk.carry = null; const mx = marina.x + (ex < marina.x ? -9 : 9);
        G.mess.push({ room: G.room, x: mx, y: FLOOR + 6, ico: '🐭', rot: 0 }); snd('minka_mrrp'); mk.state = 'sit'; mk.dir = dirTo(mk, marina); emit('heart', mk.x, feetY() - 20, 4); emit('sparkle', mx, FLOOR, 6);
        T.gifts = (T.gifts || 0) + 1; save(); ev('present'); setTimeout(() => say1('m_wow'), 600); }, 72, clamp(marina.y, 150, 176)); };
    const walk = () => mk.walkTo(ex, () => { if (mk.job !== j) return; mk.hidden = true; setTimeout(back, 1600); }, 62, WALL);
    if (mk.perchY != null) mJump(mk.x + mk.dir * 12, null, 0.4, 8).then(walk); else walk();
  }
  function maybeHideSeek(dt) {
    if (!isDown(G.room) || H.on || M.mode !== 'home' || NK.hold || M.scene || !quiet() || M.downT < 20 || E.t - H.lastEnd < 150 || E.t - M.lastStartle < 60 || !chance(dt / 90)) return;
    hideNow();
  }
  function maybeVisit(dt) {
    if (M.mode !== 'home' || H.on || NK.hold || M.scene || !Floors.MAIN.includes(G.room) || !isDown(mk.room) || !quiet() || E.t - M.visitAt < 220 || E.t < 90 || !chance(dt / 100)) return;
    comeUp();
  }

  // ================================================================ Niko and Minka
  function nikoFree() { return typeof niko !== 'undefined' && ['wander', 'sleep', 'sit'].includes(niko.state) && !(niko.perchY && niko.perchY < 118) && !(G.holding && G.holding.type === 'niko') && !(G.fort && G.fort.guests && G.fort.guests.includes(niko)); }
  function canMeet() { return vis() && niko.room === mk.room && niko.here && nikoFree() && !M.scene && !H.on && !mk.trip && !mk.watch && !mk.resume && !(mk.perchY != null && mk.perchY < 112); }
  function maybeEncounter(dt) {
    if (NK.hold || !canMeet() || !quiet() || E.t - NK.lastEnd < 40 || !chance(dt / 12)) return;
    const fightOk = E.t - NK.lastFight > 200, pool = (fightOk && chance(0.65) ? FIGHTS : CALM).filter(k => k !== NK.last && valid(k));
    if (pool.length) encounter(pick(pool));
  }
  function maybeNikoTrip(dt) {            // Niko goes down to the basement on purpose, to find her
    if (!isDown(G.room) || NK.hold || isDown(niko.room) || !nikoFree() || niko.moving || !quiet() || E.t - NK.tripAt < 150 || M.downT < 15 || !chance(dt / 45)) return;
    NK.tripAt = E.t; niko.stop(); niko.state = 'wander'; niko.perchY = null; niko.t = 30;
    const room = G.room, R = RW(room);
    if (room === 'den') { niko.room = 'den'; niko.x = STAIR_X; niko.y = 154; niko.walkTo(clamp(mk.room === 'den' ? mk.x + (mk.x > 200 ? -110 : 110) : 200, 30, R - 30), null, 46, 160); }
    else { const fromL = DOWN.indexOf(room) > DOWN.indexOf('den'); niko.room = room; niko.x = fromL ? 6 : R - 6; niko.y = 160; niko.walkTo(fromL ? 70 : R - 70, null, 46, 160); }
    sndN(pick(['trill1', 'trill2', 'trill3']), { vol: 0.7 }); NK.lastEnd = Math.min(NK.lastEnd, E.t - 32);
  }
  function valid(k) {
    const R = RW(mk.room);
    if (k === 'highspot') return !!highSpot(mk.room, mk.x);
    if (k === 'chase') return R >= 240;
    return true;
  }
  function holdNiko() { niko.stop(); niko.state = 'minka'; NK.hold = true; NK.p = { k: 'niko' }; if (niko.perchY) { NK.p.oy = niko.perchY - niko.y; niko.perchY = null; tw(NK.p, { oy: 0 }, 0.35); } }
  function releaseNiko() {
    finishArcs(niko); if (NK.p) twKill(NK.p); twKill(niko); NK.hold = false; NK.p = null;
    if (typeof niko === 'undefined') return;
    if (niko.state === 'minka') { niko.stop(); niko.state = 'wander'; niko.perchY = null; niko.t = rnd(4, 9); }
    niko.y = clamp(niko.y || FLOOR, 152, 176);
  }
  function encounter(kind, forced) {
    if (NK.hold) abortNK('restart', true); endScene(); finishArcs(mk); const j = job(); mk.stop(); mk.trip = null; mk.watch = null; mk.resume = null; mk.an = null;
    holdNiko(); NK.on = true; NK.kind = kind; NK.fight = FIGHTS.includes(kind); NK.last = kind; if (NK.fight || forced) NK.lastFight = E.t;
    NK.tok = run(async tok => { if (mk.perchY != null) { mk.dir = Math.sign(niko.x - mk.x) || 1; setAn('minka_leap', { once: true, dur: 0.4, move: true }); await mJump(mk.x - mk.dir * 10, null, 0.4, 8); mk.an = null; mk.state = 'sit'; mk.y = clamp(mk.y, 152, 176); if (tok.dead) throw STOP; } await SEQ[kind](tok); }, tok => { if (NK.tok === tok) endNK(kind); });
  }
  function endNK(kind, aborted) {
    const was = NK.on; NK.on = false; NK.tok = null; NK.lastEnd = E.t; FX.cloud = null; mk.hideDraw = false; mk.puff = 1; mk.alpha = 1; mk.rot = 0; mk.oy = 0; if (mk.an && !mk.anUntil) mk.an = null; mk.creep = false;
    if (FX.cush) FX.cush.until = Math.min(FX.cush.until, E.t + 1.5); if (FX.sun) FX.sun.until = Math.min(FX.sun.until, E.t + (aborted ? 0.8 : 6));
    releaseNiko(); emo(mk, null); emo(niko, null);
    if (mk.state === 'wary' || mk.state === 'stand') mk.state = 'sit';
    if (was) { ev('fight_end', kind); if (NK.fight) M.comfortUntil = E.t + 30; }
    mk.wait = rnd(6, 12);
  }
  function abortNK(why, quietly) {
    if (!NK.hold) return; const kind = NK.kind; if (NK.tok) NK.tok.dead = true; NK.tok = null; finishArcs(mk); twKill(mk);
    if (mk.hidden && NK.on) mk.hidden = false;
    if (why === 'left' && NK.on) {        // she left the room mid-squabble: it settles down by itself
      const R = RW(mk.room); if (Math.abs(mk.x - niko.x) < 90) { mk.x = clamp(niko.x + (mk.x >= niko.x ? 120 : -120), 20, R - 20); }
      mk.stop(); mk.state = 'sit'; mk.perchY = mk.perchY != null && mk.perchY < 112 ? mk.perchY : null;
    }
    endNK(kind, true);
  }

  // ---- the run-ins. Each starts with Niko's stalk: ears up and a stare, the low creep, a freeze, the bottom wiggle.
  async function stalk(tok, dist, keepUnaware) {
    const side = Math.sign(mk.x - niko.x) || 1; niko.dir = side; if (!keepUnaware) { mk.dir = side; mk.state = 'sit'; }
    NK.p = { k: 'niko' }; emo(niko, '👀', 900); await W(tok, 900);
    const ny = clamp(mk.y - 2, 150, 176); if (Math.abs(mk.x - niko.x) > dist + 110) { NK.p = { k: 'niko' }; await go(tok, niko, mk.x - side * (dist + 80), 46, ny); niko.dir = side; }
    NK.p = { walk: 'creep', k: 'mk:nk_stalk_1' }; await go(tok, niko, mk.x - side * dist, 17, ny); niko.dir = side;
    NK.p = { k: 'mk:nk_creep_2' }; await W(tok, 650);                                 // freeze
    NK.p = nb('nk_stalk', { fps: 11, shake: true }); Audio2.blip(-8, 'triangle', 0.04, 0.05); await W(tok, 1150);      // bottom wiggle
  }
  function viewB(room) { const R = RW(room); if (room !== G.room) return [24, R - 24]; const RR = ROOMS[room], land = E.cv.width > E.cv.height, cs = E.cssScale || 1;      // what Marina can see, clear of the side buttons (sideways, the picture-book and dress-up buttons sit low on the right)
    let a = Math.max(24, E.camX + ((RR.left ? 62 : 6) + 16) / cs), b = Math.min(R - 24, E.camX + E.viewW - ((land ? (RR.right ? 62 : 6) + 76 + 70 : 78) + 16) / cs); if (b - a < 130) { const m = (a + b) / 2; a = Math.max(24, m - 65); b = Math.min(R - 24, a + 130); } return [a, b]; }
  const far = (x, d) => { const R = RW(mk.room); return x + d < 24 || x + d > R - 24 ? clamp(x - d, 24, R - 24) : x + d; };
  const SEQ = {
    // he pounces — and she isn't there any more: face first into a cushion
    async cushion(tok) {
      FX.cush = { room: mk.room, x: mk.x, y: mk.y, t0: E.t, until: E.t + 60 }; mk.state = 'stand'; setAn('minka_groom', { fps: 6 }); await W(tok, 700); mk.an = null; mk.perchY = mk.y - 5; mk.state = 'loaf';
      mk.dir = -(Math.sign(mk.x - niko.x) || 1); await stalk(tok, 56, true);
      ev('fight', 'cushion'); const cx = FX.cush.x, side = Math.sign(cx - niko.x) || 1;
      NK.p = nb('nk_pounce', { once: true, dur: 0.5, oy: 0 }); nJump(cx - side * 14, 0, 0.5, 20); sndN('meow2', { vol: 0.6, rate: 1.3 }); await W(tok, 230);
      emit('dust', mk.x, mk.y - 6, 10); const hs = highSpot(mk.room, mk.x), R = RW(mk.room);
      if (hs && Math.abs(hs.x - mk.x) < 160) { mk.x = hs.x; mk.perchY = hs.y; mk.state = 'sit'; } else { mk.perchY = null; mk.x = clamp(cx + side * 110, 20, R - 20); mk.state = 'sit'; }
      mk.dir = -side; emit('dust', mk.x, feetY() - 6, 5); await W(tok, 300);
      NK.p = { k: 'mk:nk_down_2', rot: side * 0.5, oy: 2, cush: true, flail: true }; FX.cush.until = E.t; Audio2.noise(0.18, 0.3, 260); emit('star', niko.x + side * 18, niko.y - 18, 5);
      for (let i = 0; i < 8; i++) emit('heart', niko.x + side * 18, niko.y - 14, 1, { ch: '🪶', size: 6, vx: rnd(-40, 40), vy: rnd(-60, -20), g: 70, life: 1.4 });
      emo(niko, '💫', 1800); emo(mk, '😼', 1800); await W(tok, 1800);
      NK.p = nb('nk_startle', { once: true, dur: 0.5, shake: true }); FX.cush = { room: mk.room, x: niko.x + side * 26, y: niko.y, t0: E.t - 1, until: E.t + 4, squash: E.t + 0.4 }; await W(tok, 700);
      NK.p = nb('nk_wash', { fps: 5 }); niko.dir = -side; await W(tok, 2300);
      setAn('minka_groom', { fps: 5, ms: 2500 }); await W(tok, 600);
    },
    // she whirls round, hisses, and bops him on the nose, bap-bap-bap: the giant backs off
    async bap(tok) {
      mk.state = 'sit'; await stalk(tok, 50, false);
      setAn('minka_groom', { fps: 5 }); await W(tok, 300);
      ev('fight', 'bap'); const side = Math.sign(niko.x - mk.x) || 1; mk.dir = side; mk.an = null;
      setAn('minka_hiss', { fps: 9 }); snd('cat_hiss'); emo(mk, '💢', 1500); mk.oy = -3; setTimeout(() => { mk.oy = 0; }, 120);
      NK.p = { k: 'mk:nk_startle_1' }; emo(niko, '😳', 1400); await W(tok, 650);
      for (let i = 0; i < 3; i++) {
        setAn('minka_swat', { once: true, dur: 0.3 }); await W(tok, 150);
        emit('star', niko.x - side * 30, niko.y - 30, 3); emit('heart', niko.x - side * 30, niko.y - 32, 1, { ch: '💥', size: 9, life: 0.4, vx: 0, vy: -10 }); Audio2.blip(19 - i * 3, 'square', 0.05, 0.09);
        niko.x = clamp(niko.x + side * 3, 10, RW(niko.room) - 10); NK.p = { k: 'mk:nk_startle_1', sx: 0.94 }; await W(tok, 90); NK.p = { k: 'mk:nk_startle_1' }; await W(tok, 160);
      }
      mk.an = null; mk.state = 'stand';
      NK.p = nb('nk_hiss', { fps: 6 }); niko.dir = -side; sndN('meow1', { rate: 0.8, vol: 0.6 }); await tw(niko, { x: clamp(niko.x + side * 40, 20, RW(niko.room) - 20) }, 1.0); if (tok.dead) throw STOP;
      niko.dir = side; NK.p = { k: 'niko' }; await go(tok, niko, far(niko.x, side * 90), 52);
      NK.p = { k: 'niko_sit' }; mk.state = 'sit'; setAn('minka_groom', { fps: 5, ms: 2400 }); emo(mk, '😼', 1600); await W(tok, 1800);
    },
    // a proper cartoon scuffle: a rolling cloud of dust, stars, paws and tails — then far apart, washing as if nothing happened
    async scuffle(tok) {
      await stalk(tok, 52, false); ev('fight', 'scuffle');
      const side = Math.sign(mk.x - niko.x) || 1; NK.p = nb('nk_pounce', { once: true, dur: 0.4, oy: 0 }); nJump(mk.x - side * 10, 0, 0.4, 16); await W(tok, 380);
      const cx = (niko.x + mk.x) / 2; FX.cloud = { room: mk.room, x: clamp(cx, 40, RW(mk.room) - 40), y: mk.y, t0: E.t }; NK.p = { hide: true }; mk.hideDraw = true;
      sndN('cat_fight'); setTimeout(() => !tok.dead && sndN('cat_yowl', { vol: 0.8 }), 900); setTimeout(() => !tok.dead && sndN('cat_hiss'), 1800); setTimeout(() => !tok.dead && sndN('cat_fight', { vol: 0.7 }), 2300);
      const iv = setInterval(() => { if (tok.dead || !FX.cloud) return clearInterval(iv); const C = FX.cloud, x = C.cx || C.x; if (G.room !== C.room) return;
        emit('heart', x + rnd(-14, 14), C.y - 18, 1, { ch: pick(['⭐', '💥', '🐾', '💢', '✨']), size: rnd(7, 10), vx: rnd(-60, 60), vy: rnd(-70, -30), g: 90, life: 0.9 });
        emit('leaf', x + rnd(-10, 10), C.y - 16, 2, { col: pick(['#9aa4b8', '#6c7588', '#1d1b26', '#2b2834', '#f1ede4']), vx: rnd(-80, 80), vy: rnd(-90, -30), g: 60, life: 2.2, size: 2 }); }, 140);
      await W(tok, 3300); clearInterval(iv);
      const x = FX.cloud.cx || FX.cloud.x, R = RW(mk.room); FX.cloud = null; emit('dust', x, mk.y - 8, 18);
      const [va, vb] = viewB(mk.room), lft = chance(0.5); let a = clamp(x - 80, va, vb), b = clamp(x + 80, va, vb); if (b - a < 110) { a = va; b = vb; } niko.x = lft ? a : b; mk.x = lft ? b : a; mk.perchY = null; niko.dir = lft ? -1 : 1; mk.dir = -niko.dir;
      NK.p = nb('nk_wash', { fps: 5 }); mk.hideDraw = false; mk.state = 'sit'; setAn('minka_groom', { fps: 5 });
      for (let i = 0; i < 6; i++) emit('leaf', x + rnd(-20, 20), mk.y - 40, 1, { col: pick(['#9aa4b8', '#1d1b26']), vx: rnd(-20, 20), vy: rnd(-20, 0), g: 30, life: 3, size: 2 });
      await W(tok, 2800); mk.an = null;
    },
    // puffed up sideways, low growls... until one of them yawns
    async standoff(tok) {
      await stalk(tok, 70, false); ev('fight', 'standoff');
      const side = Math.sign(mk.x - niko.x) || 1; mk.dir = -side; niko.dir = side; mk.an = { k: 'mk:minka_hiss_2', t0: E.t }; mk.puff = 1.14; NK.p = { k: 'mk:nk_hiss_2', sx: 1.08, tremble: true };
      snd('cat_hiss', { vol: 0.8 });
      for (let i = 0; i < 3; i++) {
        await W(tok, 450); sndN('cat_growl', { vol: 0.7 }); emo(i % 2 ? mk : niko, '💢', 900);
        const s = i % 2 ? 1 : -1; tw(mk, { x: clamp(mk.x + s * 4, 12, RW(mk.room) - 12) }, 0.6); tw(niko, { x: clamp(niko.x + s * 4, 12, RW(niko.room) - 12) }, 0.6); await W(tok, 700);
      }
      const yawn = chance(0.5) ? niko : mk;
      if (yawn === niko) { NK.p = { k: 'mk:nk_smug_2' }; emo(niko, '🥱', 1700); await W(tok, 900); mk.puff = 1; mk.an = null; mk.state = 'sit'; await W(tok, 700); mk.state = 'stand'; await go(tok, mk, far(mk.x, side * 80), 34); mk.dir = -side; mk.state = 'sit'; NK.p = nb('nk_wash', { fps: 5 }); }
      else { mk.puff = 1; mk.an = null; mk.state = 'sit'; emo(mk, '🥱', 1700); await W(tok, 900); NK.p = { k: 'niko' }; await W(tok, 500); await go(tok, niko, far(niko.x, -side * 80), 40); niko.dir = side; NK.p = nb('nk_wash', { fps: 5 }); }
      await W(tok, 1800);
    },
    // up she goes, out of reach, looking down at him; he pretends not to care
    async highspot(tok) {
      await stalk(tok, 60, false); ev('fight', 'highspot');
      const h = highSpot(mk.room, mk.x); if (!h) return; const side = Math.sign(mk.x - niko.x) || 1;
      mk.dir = Math.sign(h.x - mk.x) || 1; setAn('minka_leap', { once: true, dur: 0.55, move: true }); emit('dust', mk.x, mk.y, 4); const ox = mk.x;
      NK.p = nb('nk_pounce', { once: true, dur: 0.45, oy: 0 }); nJump(ox - side * 6, 0, 0.45, 12);
      await mJump(h.x, h.y, 0.55, 22); if (tok.dead) throw STOP; mk.an = null; mk.state = 'sit'; mk.dir = Math.sign(niko.x - mk.x) || 1; mk.y = clamp(mk.y, 150, 176); emo(mk, '😼', 1800);
      await W(tok, 450); NK.p = { k: 'mk:nk_startle_1' }; niko.dir = Math.sign(mk.x - niko.x) || 1; emo(niko, '❗', 800); await W(tok, 900);
      niko.dir = -niko.dir; NK.p = { k: 'mk:nk_smug_1' }; emo(niko, '😤', 1500); await W(tok, 1400);
      NK.p = nb('nk_wash', { fps: 5 }); await W(tok, 2300);
      mk.wait = rnd(14, 24);
    },
    // round the room she goes with him after her — then she turns, and it's the other way round
    async chase(tok) {
      await stalk(tok, 70, false); ev('fight', 'chase');
      const [lo, hi] = viewB(mk.room); let side = Math.sign(mk.x - niko.x) || 1;
      for (let lap = 0; lap < 2; lap++) {
        const end = side > 0 ? hi : lo; snd(lap ? 'cat_hiss' : 'cat_yowl', { vol: 0.7 }); emit('dust', mk.x, mk.y, 5);
        const chaser = lap ? mk : niko, runner = lap ? niko : mk;
        NK.p = { k: 'niko', move: false }; emo(chaser, lap ? '💢' : '😼', 1000); emo(runner, '🙀', 1000);
        const p1 = go(tok, runner, end, 112, runner === mk ? clamp(mk.y, 152, 160) : 160); await W(tok, 260); const p2 = go(tok, chaser, end - side * 30, 104, chaser === mk ? 156 : 160);
        const dust = setInterval(() => { if (tok.dead) return clearInterval(dust); if (G.room === mk.room) { emit('dust', mk.x, mk.y, 1); emit('dust', niko.x, niko.y, 1); } }, 160);
        await p1; await p2; clearInterval(dust);
        // skid and turn
        Audio2.noise(0.2, 0.12, 700); emit('dust', runner.x, runner.y, 6);
        if (lap === 0) { mk.dir = -side; setAn('minka_hiss', { fps: 9 }); NK.p = { k: 'mk:nk_startle_2' }; emo(niko, '❗', 800); await W(tok, 700); mk.an = null; }
        side = -side;
      }
      niko.dir = 1; mk.dir = -1; NK.p = { k: 'niko_sit' }; mk.state = 'sit'; emo(niko, '💦', 1500); emo(mk, '💦', 1500); await W(tok, 1200);
      NK.p = nb('nk_wash', { fps: 5 }); setAn('minka_groom', { fps: 5, ms: 2000 }); await W(tok, 1800);
    },
    // she turns and simply looks at him. He freezes mid-step... and suddenly needs a wash
    async stare(tok) {
      const side = Math.sign(mk.x - niko.x) || 1; mk.dir = side; mk.state = 'sit'; niko.dir = side;
      NK.p = { k: 'niko' }; emo(niko, '👀', 900); await W(tok, 900);
      NK.p = { walk: 'creep', k: 'mk:nk_creep_3' }; const target = mk.x - side * 70; go(tok, niko, target, 17).catch(() => { }); await W(tok, 1300);
      ev('fight', 'stare'); niko.stop(); mk.dir = -side; emo(mk, '👁️', 1600); NK.p = { k: 'mk:nk_creep_3' }; await W(tok, 400); emo(niko, '😳', 1500); await W(tok, 1300);
      NK.p = nb('nk_wash', { fps: 5 }); niko.dir = -side; await W(tok, 2400);
      setAn('minka_groom', { fps: 5, ms: 2000 }); await W(tok, 600);
    },
    // the moment he gets up from his sunny spot, she has it
    async sunspot(tok) {
      const [va, vb] = viewB(mk.room), sx = clamp(niko.x, va + 34, vb - 34), gap = Math.min(92, (vb - va) * 0.45); FX.sun = { room: mk.room, x: sx, y: 160, t0: E.t, until: E.t + 60 };
      NK.p = { k: 'niko' }; await go(tok, niko, sx, 40, 160); NK.p = { k: 'niko_lie' }; niko.dir = 1;
      const side = mk.x < sx ? -1 : 1; mk.state = 'stand'; await go(tok, mk, clamp(sx + side * gap, va, vb), 36, 156); mk.dir = -side; mk.state = 'sit'; await W(tok, 1800);
      ev('fight', 'sunspot'); NK.p = { k: 'niko' }; emo(niko, '❗', 900); await W(tok, 500);
      niko.dir = side === 1 ? -1 : 1; const sniffAt = clamp(sx - side * 60, va, vb); go(tok, niko, sniffAt, 40).catch(() => { }); await W(tok, 300);
      mk.state = 'stand'; await go(tok, mk, sx, 72, 160); mk.state = 'nap'; mk.dir = 1; snd('purr', { vol: 0.6 }); emo(mk, '😌', 2200);
      await W(tok, 1600); niko.dir = Math.sign(mk.x - niko.x) || 1; NK.p = { k: 'niko' }; emo(niko, '😾', 1600); sndN('meow1', { rate: 0.85, vol: 0.6 }); await W(tok, 1700);
      await go(tok, niko, clamp(sniffAt - side * 30, va, vb), 30); NK.p = { k: 'niko_lie' }; niko.dir = -niko.dir; emo(niko, '💢', 1200); await W(tok, 1800);
    },
    // he gets right behind her, she turns: nose to nose, both leap straight up — and dash off opposite ways
    async boing(tok) {
      mk.state = 'sit'; await stalk(tok, 46, false); await W(tok, 250);
      ev('fight', 'boing'); const side = Math.sign(niko.x - mk.x) || 1; mk.dir = side; await W(tok, 250);
      emo(mk, '❗', 900); emo(niko, '❗', 900); snd('cat_yowl', { vol: 0.75 });
      mk.an = { k: 'mk:minka_hiss_2', t0: E.t }; NK.p = { k: 'mk:nk_startle_3', oy: 0 }; mJump(mk.x, null, 0.6, 24); nJump(niko.x, 0, 0.6, 22); await W(tok, 650); mk.an = null;
      Audio2.noise(0.1, 0.2, 300); emit('dust', mk.x, mk.y, 4); emit('dust', niko.x, niko.y, 4);
      NK.p = { k: 'niko' }; const R = RW(mk.room);
      const [va, vb] = viewB(mk.room), ml = mk.x < niko.x, a = go(tok, mk, ml ? va : vb, 112, 154), b = go(tok, niko, ml ? vb : va, 100, 162); await a; await b;
      mk.dir = mk.x < R / 2 ? 1 : -1; mk.state = 'sit'; setAn('minka_groom', { fps: 5, ms: 2400 }); niko.dir = niko.x < R / 2 ? 1 : -1; NK.p = nb('nk_wash', { fps: 5 }); await W(tok, 2400);
    },
  };
  // Marina steps in: 🙅 — both freeze and look guilty, then go their own ways. Afterwards she can comfort Minka (🫶).
  function stepIn() {
    if (!NK.on) return; const kind = NK.kind; UI.closeActions();
    if (NK.tok) NK.tok.dead = true; NK.tok = null; FX.cloud = null; finishArcs(mk); finishArcs(niko); twKill(mk); mk.hideDraw = false; mk.puff = 1; mk.oy = 0; mk.alpha = 1; NK.on = false; NK.lastEnd = E.t;
    if (FX.cush) FX.cush.until = E.t + 1; if (FX.sun) FX.sun.until = E.t + 2;
    ev('fight_end', 'stopped');
    if (mk.perchY != null && mk.perchY >= 112) mJump(mk.x, null, 0.3, 4);
    say1('m_nofight'); emit('heart', marina.x, marina.y - 86, 1, { ch: '🙅', size: 14, vx: 0, vy: -8, life: 1.4 });
    NK.tok = run(async tok => {
      mk.stop(); niko.stop(); mk.an = null; mk.state = mk.perchY != null ? 'sit' : 'wary'; NK.p = { k: 'mk:nk_down_1' }; emo(niko, '😳', 1700); emo(mk, '😳', 1700, { dx: 0 });
      const mid = (mk.x + niko.x) / 2; if (Math.abs(marina.x - mid) > 30) marina.walkTo(mid + (marina.x < mid ? -14 : 14), null, 70);
      await W(tok, 1700);
      const s = Math.sign(mk.x - niko.x) || 1; if (mk.perchY == null) { mk.state = 'stand'; go(tok, mk, mk.x + s * 50, 26).catch(() => { }); } NK.p = { k: 'niko' }; go(tok, niko, niko.x - s * 70, 28).catch(() => { });
      await W(tok, 2000); mk.state = 'sit'; mk.dir = dirTo(mk, marina); emo(mk, '🥺', 3000); NK.p = { k: 'niko_sit' };
      await W(tok, 300);
    }, tok => { if (NK.tok === tok || NK.tok == null) { NK.tok = null; releaseNiko(); M.comfortUntil = E.t + 30; if (vis() && !G.busy) UI.actions(anchor, choices()); } });
  }
  function fightNow(kind) {
    if (!mk) return null; const all = FIGHTS.concat(CALM);
    if (!all.includes(kind)) { const c = all.filter(k => k !== NK.last); kind = pick(c); }
    if (H.on) endHide('fight', true); endScene(); if (NK.hold) abortNK('restart', true);
    const R = RW(G.room); if (!canGo(G.room)) return null;
    // bring them both to where Marina is
    mk.trip = null; job(); mk.stop(); finishArcs(mk); twKill(mk); finishArcs(niko); twKill(niko); mk.watch = null; mk.hidden = false; mk.alpha = 1; mk.oy = 0; mk.an = null;
    const [va, vb] = viewB(G.room), wide = vb - va > 190, s = marina.x - va > vb - marina.x ? -1 : 1;     // both of them on screen, in front of Marina
    mk.room = G.room; mk.perchY = null; mk.x = wide ? clamp(marina.x + s * 30, va, vb) : (s > 0 ? va + (vb - va) * 0.25 : vb - (vb - va) * 0.25); mk.y = 168;

    if (niko.state === 'held') { G.holding = null; }
    niko.room = G.room; niko.x = wide ? clamp(marina.x + s * 170, va + 28, vb - 28) : (s > 0 ? vb - 40 : va + 40);      // his whole big body on the screen niko.state = 'wander'; niko.perchY = null; niko.y = 172;
    if (!valid(kind)) kind = 'stare';
    encounter(kind, true); return kind;
  }

  // ================================================================ every frame
  { const _up = AI.update; AI.update = function (dt) { _up.call(this, dt); ok(() => tick(dt)); }; }
  { const _cat = AI.cat; AI.cat = function (dt) { if (NK.hold) return; return _cat.call(this, dt); }; }
  let lastRoom = null;
  function tick(dt) {
    if (!mk) { if (typeof marina !== 'undefined' && marina) init(); return; }
    motionTick(); const F = FX.feather; if (F) F.x += (F.tx - F.x) * Math.min(1, dt * 7);
    if (G.room !== lastRoom) { const was = lastRoom; lastRoom = G.room; if (was) roomChanged(was, G.room); }
    M.downT = isDown(G.room) ? M.downT + dt : 0;
    if (!ART.ok) return;
    if (NK.hold && niko.state !== 'minka') abortNK('niko');            // somebody else picked Niko up, fed him, chased him...
    if (NK.hold && (panelUp() || G.sceneOn) && NK.on) abortNK('left');
    if (H.on) { hideTick(dt); if (!M.scene) maybeNikoTrip(dt); return; }
    if (NK.hold || M.scene) return;
    startleCheck(); freezeCheck();
    think(dt);
    creepCloser(dt); follow(); sofaHop(); present(dt);
    maybeEncounter(dt); maybeNikoTrip(dt); maybeHideSeek(dt); maybeVisit(dt);
  }
  function roomChanged(was, now) {
    if (NK.hold && (mk.room === was || niko.room === was)) abortNK('left');
    if (M.scene && mk.room === was) endScene();
    // trusting enough, she follows Marina from room to room downstairs
    if (lvl() === 2 && M.mode === 'home' && mk.room === was && isDown(was) && isDown(now) && !H.on && !mk.hidden && Math.abs(DOWN.indexOf(was) - DOWN.indexOf(now)) === 1) {
      setTimeout(() => { if (G.room === now && mk.room === was && !mk.trip && !M.scene && !NK.hold && !H.on) travel(now, () => { mk.state = 'sit'; mk.dir = dirTo(mk, marina); }, 60); }, 1500);
    }
    if (H.on && isDown(now)) announce();
  }
  Object.assign(SAY_ICON, Object.fromEntries(Object.entries({ m_minka_where: '🐈‍⬛❓', m_minka_found: '🐈‍⬛🎉', m_minka_love: '🐈‍⬛💕', m_nofight: '🙅🐈', nu_minka_where: '🐈‍⬛❓', nu_minka_found: '🐈‍⬛💕', nu_minka_shy: '🐈‍⬛🙈', nu_minka_trust: '🐈‍⬛💕', nu_catfight1: '🙅🐈', nu_catfight2: '🙅🐈', d_catfight: '🙅🐈', mo_catfight: '🙅🐈', r_catfight: '🙅🐈' }).filter(([k]) => !SAY_ICON[k])));

  // ================================================================ for the rest of the game (and for testing)
  window.Minka = {
    _v: 1,
    onEvent() { },                                   // replaced by the family (family2.js): 'hiding', 'found', 'fight' (detail = kind), 'fight_end', 'pet', 'upstairs', 'present'
    hideNow: id => ok(() => hideNow(id)),            // hide now (in the given place, or one of her own choosing); returns the place's id
    fightNow: kind => ok(() => fightNow(kind)),      // a run-in with Niko right where Marina is: one of Minka.kinds, or any
    comeUp: () => ok(comeUp), goHome: () => ok(() => goHome()),
    trust(n) { if (n != null && isFinite(n)) { T.t = clamp(+n, 0, 100); save(); } return T.t; },
    state() { if (!mk) return null; return { room: mk.room, x: Math.round(mk.x), y: Math.round(feetY()), mode: M.mode, state: mk.state, moving: !!mk.moving, hidden: !!mk.hidden, watch: mk.watch ? mk.watch.id : null, perch: mk.perchY != null ? Math.round(mk.perchY) : null, scene: M.scene,
      hiding: H.on ? { spot: H.spot && H.spot.id, room: H.spot && H.spot.room, in: H.in, round: H.round, checked: Object.keys(H.checked) } : null, trust: T.t, level: lvl(), finds: T.finds, fight: NK.on ? NK.kind : null, nikoHeld: NK.hold, last: NK.last, art: ART.ok,
      niko: typeof niko !== 'undefined' ? { room: niko.room, x: Math.round(niko.x), state: niko.state } : null }; },
    spots: SPOTS.map(s => s.id), spotRooms: Object.fromEntries(SPOTS.map(s => [s.id, s.room])), kinds: FIGHTS.concat(CALM), fights: FIGHTS.slice(), calm: CALM.slice(),
    _debug: { M, H, NK, FX, LOG, spotIcon: id => spotIcon(SPOTS.find(s => s.id === id)), spotHead: id => spotHead(SPOTS.find(s => s.id === id)), NAPS, HIGH, restAt: id => restAt(NAPS.find(n => n.id === id)), present: () => present(0, true), nikoTrip: () => { NK.tripAt = -999; M.downT = 99; maybeNikoTrip(999); },
      place(room, x, state, y) { if (NK.hold) abortNK('test', true); endScene(); if (H.on) endHide('test', true); job(); mk.stop(); mk.trip = null; mk.watch = null; mk.resume = null; mk.an = null; finishArcs(mk); mk.hidden = false; mk.alpha = 1; mk.oy = 0; mk.perchY = null; mk.room = room; mk.x = x; mk.y = y || 156; mk.state = state || 'sit'; M.mode = 'home'; mk.wait = 40; M.lastStartle = -99; M.creepAt = E.t; M.stillT = 0; }, watchAt: id => watchAt(SPOTS.find(s => s.id === id)), startle, cue: c => { const cl = H.cl; if (!cl) return; if (c === 'peek') cl.riseTo = 1; if (c === 'eyes') cl.eyesT = E.t + 3; if (c === 'wob') cl.wobT = E.t + 0.6; if (c === 'tail') cl.twT = E.t + 2; if (c === 'down') cl.riseTo = 0; }, search: id => search(SPOTS.find(s => s.id === id)) },
  };
})();
