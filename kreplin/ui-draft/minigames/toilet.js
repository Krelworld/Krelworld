/* ===================== KREPLIN — Toilet strain (4th Kreplin gem) =====================
   Drop-in for startToiletStrainingMinigame() (src/023 ~3653, entered from showLaxativeUI).
   Contract kept: returns a Promise that resolves (after playGemShitVideo() on success).
   There is no lose outcome in the story: failures retry inside the same session; after 3
   fails "MORE LAXATIVES" (easy mode) is offered; after 6 fails the kit Give-up button
   ("Call a plumber") extracts the gem and continues down the success path — no soft-lock.
   Resolved value (ignored by the caller): { won:true, how:'strain'|'plumber', fails, easy }.

   Mechanic: fishing-reel tension. HOLD (touch/mouse/Space/↑/W) to push; release to relax.
   Keep the needle in the drifting GREEN zone — gut CRAMPS wobble and shrink it. In the zone
   the gem slides down a cutaway intestine; outside it slips back. Red zone fills the
   heart-attack gauge. 13s of good pushing within 30s (easy: 9s within 40s).
   Requires MGKit (mgkit.js). Optional globals used if present: playGemShitVideo,
   _stopGeneralMusic/_startGeneralMusic/_debugGeneralMusic, generalMusicAudio.
*/
(function () {
  const ART = (window.KREPLIN_ART_BASE || '../../art/raw/');
  const MUSIC = 'https://www.dropbox.com/scl/fi/nzz7c60eullrz8m7kvsaa/shitkrepl.mp3?rlkey=e419hpmxv6beknnw332pbt3h9&st=j3j16ctp&dl=1';
  const C = { red: '#d71920', redL: '#ff4a50', ink: '#0d1016', gold: '#f2c14e', good: '#3fbf6b', bad: '#e5484d', text: '#e9e6de', muted: '#8c93a8', panel: '#1d2230', line: '#3a4258' };

  // ---- tiny WebAudio sfx (no assets) ----
  let AC = null;
  function ac() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
  function tone(f0, f1, dur, type = 'square', vol = 0.08) {
    const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  function noise(dur, freq, vol = 0.12) {
    const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const sfx = {
    fart() { noise(0.35 + Math.random() * 0.3, 180 + Math.random() * 200, 0.2); tone(70 + Math.random() * 30, 40, 0.4, 'sawtooth', 0.05); },
    grunt() { tone(140, 90, 0.25, 'sawtooth', 0.05); },
    beat() { tone(70, 40, 0.09, 'sine', 0.25); },
    cramp() { tone(300, 80, 0.4, 'square', 0.05); },
    plop() { tone(500, 120, 0.15, 'sine', 0.2); setTimeout(() => tone(900, 1400, 0.3, 'triangle', 0.08), 150); },
    flat() { tone(880, 860, 1.2, 'sine', 0.1); },
    click() { tone(600, 500, 0.05, 'square', 0.05); },
  };

  // ---- helpers ----
  const tintCache = new Map();
  function tinted(img, color) {
    const k = img.src + color; if (tintCache.has(k)) return tintCache.get(k);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(k, c); return c;
  }
  function wrap(ctx, str, maxW) { const out = []; let line = ''; for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Intestine path inside the GUT CAM panel (x 98..176, y 26..198)
  const PATH = [[150, 40], [118, 44], [160, 62], [116, 82], [160, 100], [118, 120], [158, 140], [124, 160], [138, 180], [138, 200]];
  const SEG = []; let PLEN = 0;
  for (let i = 1; i < PATH.length; i++) { const l = Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]); SEG.push(l); PLEN += l; }
  function along(p) { let d = clamp(p, 0, 1) * PLEN; for (let i = 0; i < SEG.length; i++) { if (d <= SEG[i]) { const t = d / SEG[i]; return [lerp(PATH[i][0], PATH[i + 1][0], t), lerp(PATH[i][1], PATH[i + 1][1], t)]; } d -= SEG[i]; } return PATH[PATH.length - 1]; }

  function musicStart() {
    let was = false, m = null;
    try {
      if (typeof window._stopGeneralMusic === 'function') { if (window._debugGeneralMusic && window._debugGeneralMusic.playing && window._debugGeneralMusic.playing()) was = true; window._stopGeneralMusic(); }
      else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) { was = true; generalMusicAudio.pause(); } // eslint-disable-line no-undef
    } catch (e) {}
    return { was, m };
  }
  function musicStop(st) {
    if (st.m) { try { st.m.pause(); } catch (e) {} st.m = null; }
    if (st.was) { try { if (typeof window._startGeneralMusic === 'function') window._startGeneralMusic(); else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) generalMusicAudio.play().catch(() => {}); } catch (e) {} } // eslint-disable-line no-undef
  }

  async function play(opts = {}) {
    const music = musicStart();
    if (opts.music !== null) { try { music.m = new Audio(opts.music || MUSIC); music.m.loop = true; music.m.volume = 0.7; music.m.play().catch(() => {}); } catch (e) {} }

    const mg = MGKit.open({ title: 'THE 4TH GEM', w: 180, h: 320, giveUpAfterFails: 6, giveUpLabel: 'Call a plumber', onGiveUp: () => 'plumber' });
    await mg.load({ man: ART + 'mg-toilet-chairman.png', heart: ART + 'mg-toilet-heart.png', lax: ART + 'mg-toilet-laxative.png', gem: ART + 'ico-gem.png' });
    const { ctx, W, H, input, text, particles: P } = mg;

    const g = { phase: 'intro', t: 0, s: 8, v: 0, p: 0, heart: 0, center: 50, half: 9, time: 0, easy: false, cramp: 0, nextCramp: 4, nextFart: 1.5, beatT: 0, failReason: '', inZone: false, endT: 0, plopY: 0, lastFails: 0 };
    const cfg = () => g.easy ? { need: 9, limit: 40, half: 14, amp: 0.5, cramps: false, over: 94 } : { need: 13, limit: 30, half: 9, amp: 1, cramps: true, over: 92 };
    function reset() { Object.assign(g, { phase: 'intro', t: 0, s: 8, v: 0, p: 0, heart: 0, time: 0, cramp: 0, nextCramp: 3 + Math.random() * 3, inZone: false }); }
    play._debug = g; // read-only test hook

    const holding = () => input.down || input.keys.has(' ') || input.keys.has('ArrowUp') || input.keys.has('w') || input.keys.has('W');
    const BTN1 = { x: 20, y: 236, w: 140, h: 26 }, BTN2 = { x: 20, y: 270, w: 140, h: 26 };
    const hit = (b, p) => p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

    function fail(reason) {
      g.phase = 'fail'; g.failReason = reason; g.t = 0; mg.fail(); g.lastFails = mg.fails;
      mg.shake(5, 0.5); mg.flash(reason === 'heart attack' ? '#ff0000' : '#ffffff', 0.6);
      if (reason === 'heart attack') { sfx.flat(); for (let i = 0; i < 30; i++) P.spawn({ x: 30, y: 60, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, color: C.red, size: 2, life: 0.8 }); }
      else { for (let i = 0; i < 40; i++) P.spawn({ x: Math.random() * W, y: Math.random() * 120, vx: (Math.random() - .5) * 60, vy: 40 + Math.random() * 80, color: Math.random() < .5 ? '#ff7a1a' : '#ffd23a', size: 3, life: 1.2, g: 60 }); }
    }

    function drawBg(t) {
      // grimy tiles
      ctx.fillStyle = '#2a3140'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#323a4c'; for (let y = 0; y < 210; y += 12) for (let x = (y / 12) % 2 ? 0 : 6; x < 96; x += 12) ctx.fillRect(x, y, 11, 11);
      ctx.fillStyle = '#4b3a22'; ctx.fillRect(10, 30, 3, 6); ctx.fillRect(60, 18, 2, 4); ctx.fillRect(80, 70, 3, 3); // stains
      ctx.fillStyle = '#1a1f2a'; ctx.fillRect(0, 186, 96, 26); ctx.fillStyle = '#232a38'; for (let x = 0; x < 96; x += 8) ctx.fillRect(x, 186, 7, 2);
      // toilet roll on wall
      ctx.fillStyle = '#ddd'; ctx.fillRect(4, 140, 10, 8); ctx.fillStyle = '#999'; ctx.fillRect(8, 142, 2, 4);
    }

    function drawGut(t) {
      const x0 = 98, y0 = 22, w = 78, h = 182;
      ctx.fillStyle = '#000'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
      ctx.fillStyle = '#5a1e2c'; ctx.fillRect(x0, y0, w, h);
      // flesh speckle
      ctx.fillStyle = '#6b2636'; for (let i = 0; i < 40; i++) ctx.fillRect(x0 + ((i * 37) % w), y0 + ((i * 53) % h), 2, 2);
      const cr = g.cramp > 0 ? Math.sin(t * 40) * 1.5 : 0;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const strokePath = (lw, col, off = 0) => { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); PATH.forEach(([x, y], i) => { const xx = x + cr * (i % 2 ? 1 : -1), yy = y + off; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }); ctx.stroke(); };
      strokePath(15, '#2a0c14'); strokePath(12, g.cramp > 0 ? '#c2405a' : '#d9738a'); strokePath(6, '#3d1a10');
      // peristalsis bands
      for (let k = 0; k < 8; k++) { const q = ((k / 8) + t * 0.12 * (g.inZone ? 2 : 0.6)) % 1; const [px, py] = along(q); ctx.fillStyle = 'rgba(255,190,200,.35)'; ctx.fillRect(Math.round(px) - 5, Math.round(py) - 1, 10, 2); }
      // gem
      const [gx, gy] = along(g.p * 0.94);
      if (g.inZone && g.phase === 'play' && Math.random() < 0.5) P.spawn({ x: gx, y: gy - 4, vx: (Math.random() - .5) * 10, vy: -10, color: '#6a4a1a', size: 2, life: 0.5 });
      const pulse = 1 + Math.sin(t * 8) * 0.08;
      ctx.save(); ctx.translate(Math.round(gx), Math.round(gy)); ctx.scale(pulse, pulse);
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#c88cff'; ctx.fillRect(-9, -9, 18, 18); ctx.globalAlpha = 1;
      if (mg.sprites.gem) ctx.drawImage(mg.sprites.gem, -8, -8, 16, 16); ctx.restore();
      // label + exit
      ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, 44, 10); text('GUT CAM', x0 + 22, y0 + 5, { size: 8, color: C.redL });
      if (Math.floor(t * 2) % 2) { ctx.fillStyle = C.red; ctx.fillRect(x0 + 48, y0 + 3, 3, 3); }
      text(Math.round(g.p * 100) + '%', x0 + w - 12, y0 + h - 8, { size: 9, color: C.gold });
    }

    function drawMan(t) {
      const img = mg.sprites.man; if (!img) return;
      const k = g.s / 100, sq = 1 - k * 0.07 + (g.cramp > 0 ? Math.sin(t * 30) * 0.02 : 0);
      const jx = holding() && g.phase === 'play' ? (Math.random() - .5) * k * 2 : 0;
      const dw = 96, dh = 96 * sq, x = jx, y = 186 - dh + 4;
      ctx.drawImage(img, Math.round(x), Math.round(y), dw, Math.round(dh));
      const red = Math.min(0.55, k * 0.6) + (g.heart * 0.3);
      if (red > 0.02) { ctx.globalAlpha = red; ctx.drawImage(tinted(img, g.heart > 0.3 && Math.floor(t * 10) % 2 ? '#7a2cff' : '#ff1010'), Math.round(x), Math.round(y), dw, Math.round(dh)); ctx.globalAlpha = 1; }
      if (g.phase === 'play' && k > 0.4 && Math.random() < k * 0.12) P.spawn({ x: 45 + Math.random() * 20, y: y + 18, vx: (Math.random() - .5) * 50, vy: -30 - Math.random() * 20, g: 160, color: '#9fd8ff', size: 2, life: 0.6 });
    }

    function drawHeart(t) {
      const bpm = 60 + g.s * 1.4 + g.heart * 80;
      g.beatT += (1 / 60) * bpm / 60; let beat = 0;
      if (g.beatT >= 1) { g.beatT -= 1; if (g.phase === 'play' && g.s > 50) sfx.beat(); }
      beat = g.beatT < 0.15 ? 1 - g.beatT / 0.15 : 0;
      const sc = 1 + beat * 0.3, img = mg.sprites.heart;
      ctx.save(); ctx.translate(16, 36); ctx.scale(sc, sc);
      if (img) ctx.drawImage(g.heart > 0.5 && Math.floor(t * 12) % 2 ? tinted(img, '#ffffff') : img, -12, -12, 24, 24); ctx.restore();
      text(Math.round(bpm) + ' BPM', 32, 36, { size: 8, align: 'left', color: bpm > 170 ? C.redL : C.text });
    }

    function drawMeter(t) {
      const c = cfg(), x0 = 8, w = 164, y0 = 214, h = 20;
      ctx.fillStyle = '#000'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, h + 4); ctx.fillStyle = '#1a1f2a'; ctx.fillRect(x0, y0, w, h);
      const X = v => x0 + v / 100 * w;
      ctx.fillStyle = '#5a1012'; ctx.fillRect(X(c.over), y0, X(100) - X(c.over), h);
      if (Math.floor(t * 6) % 2 && g.s > c.over - 8) { ctx.fillStyle = C.red; ctx.fillRect(X(c.over), y0, X(100) - X(c.over), h); }
      const lo = g.center - g.half, hi = g.center + g.half;
      ctx.fillStyle = g.inZone ? '#4fe07f' : C.good; ctx.fillRect(Math.round(X(lo)), y0 + 2, Math.round(X(hi) - X(lo)), h - 4);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(Math.round(X(lo)), y0 + 2, Math.round(X(hi) - X(lo)), 2);
      // needle
      const nx = Math.round(X(g.s)); ctx.fillStyle = '#fff'; ctx.fillRect(nx - 1, y0 - 4, 3, h + 8); ctx.fillStyle = C.gold; ctx.fillRect(nx - 3, y0 - 6, 7, 3);
      text('STRAIN', x0, y0 - 9, { size: 8, align: 'left', color: C.muted });
      text(g.cramp > 0 ? 'CRAMP!' : g.inZone ? 'PUSHING!' : (g.s < g.center ? 'PUSH HARDER' : 'EASY, LAD'), x0 + w, y0 - 9, { size: 8, align: 'right', color: g.cramp > 0 ? C.redL : g.inZone ? C.good : C.gold });
      // heart attack gauge
      ctx.fillStyle = '#000'; ctx.fillRect(x0, y0 + h + 4, w, 5); ctx.fillStyle = g.heart > 0.6 ? C.redL : '#b0303a'; ctx.fillRect(x0, y0 + h + 4, Math.round(w * g.heart), 5);
      text('HEART', x0 + w / 2, y0 + h + 13, { size: 7, color: g.heart > 0 ? C.redL : '#5a6070' });
    }

    function drawHud() {
      const c = cfg(), left = Math.max(0, c.limit - g.time);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, 96, 22);
      text('WORLD ENDS IN', 4, 6, { size: 7, align: 'left', color: C.muted });
      text(left.toFixed(1) + 's', 4, 16, { size: 11, align: 'left', color: left < 8 ? C.redL : C.text });
      if (g.easy) text('LAXATIVE MODE', 92, 16, { size: 7, align: 'right', color: C.good });
    }

    function drawButton() {
      const hold = holding() && g.phase === 'play'; const y = 258 + (hold ? 2 : 0);
      ctx.fillStyle = '#000'; ctx.fillRect(14, 260, 152, 46); ctx.fillStyle = hold ? C.red : '#9e0f15'; ctx.fillRect(14, y - 2, 152, 44);
      ctx.fillStyle = hold ? C.redL : C.red; ctx.fillRect(14, y - 2, 152, 3);
      text(hold ? 'NNNNGGGHHH!' : 'HOLD TO STRAIN', 90, y + 16, { size: 13 });
      text('touch / click / SPACE', 90, y + 31, { size: 7, color: '#ffb0b0', bold: false });
    }

    function button(b, label, col, sub) {
      ctx.fillStyle = '#000'; ctx.fillRect(b.x, b.y + 2, b.w, b.h); ctx.fillStyle = col; ctx.fillRect(b.x, b.y, b.w, b.h);
      text(label, b.x + b.w / 2, b.y + b.h / 2 - (sub ? 3 : 0), { size: 11 }); if (sub) text(sub, b.x + b.w / 2, b.y + b.h - 5, { size: 6, bold: false, color: '#fff' });
    }

    mg.loop((dt, T) => {
      g.t += dt; const c = cfg();
      // ---------- update ----------
      if (g.phase === 'intro') {
        g.s = lerp(g.s, 8, dt * 4); g.center = 50; g.half = c.half;
        if (g.t > 1.8) { g.phase = 'play'; g.t = 0; sfx.fart(); }
      } else if (g.phase === 'play') {
        g.time += dt;
        const hold = holding();
        if (input.pressed) { ac(); sfx.grunt(); }
        g.v += (hold ? 150 : -120) * dt; g.v *= Math.exp(-3.2 * dt);
        // target drift + cramps
        let cen = 50 + c.amp * (16 * Math.sin(g.time * 0.55) + 9 * Math.sin(g.time * 1.6 + 1.3));
        g.half = c.half;
        if (c.cramps) {
          g.nextCramp -= dt;
          if (g.nextCramp <= 0 && g.cramp <= 0) { g.cramp = 1.4; g.nextCramp = 4 + Math.random() * 3; g.v += (Math.random() < .5 ? -1 : 1) * 40; sfx.cramp(); mg.shake(3, 0.3); }
          if (g.cramp > 0) { g.cramp -= dt; cen += Math.sin(g.time * 9) * 11; g.half = c.half - 3; }
        }
        g.center = clamp(cen, g.half + 4, c.over - g.half - 2);
        g.s += g.v * dt; if (g.s < 0) { g.s = 0; g.v = Math.max(0, g.v); } if (g.s > 100) { g.s = 100; g.v = Math.min(0, g.v); }
        g.inZone = Math.abs(g.s - g.center) <= g.half;
        g.p = clamp(g.p + (g.inZone ? dt / c.need : -dt / c.need * 0.35), 0, 1);
        if (g.s >= c.over) g.heart = Math.min(1, g.heart + dt * 1.7); else g.heart = Math.max(0, g.heart - dt * 0.5);
        if (hold) { g.nextFart -= dt; if (g.nextFart <= 0) { g.nextFart = 1.2 + Math.random() * 2; sfx.fart(); for (let i = 0; i < 8; i++) P.spawn({ x: 80, y: 176, vx: 20 + Math.random() * 30, vy: -10 - Math.random() * 20, color: Math.random() < .5 ? '#8a9a3a' : '#6a5a2a', size: 3, life: 0.9 }); } }
        if (g.s > 70) mg.shake(Math.round((g.s - 70) / 15), 0.05);
        if (g.heart >= 1) fail('heart attack');
        else if (g.p >= 1) { g.phase = 'win'; g.t = 0; sfx.plop(); mg.flash(C.gold, 0.5); mg.banner('PLOP!', C.gold, 1.4);
          for (let i = 0; i < 40; i++) P.spawn({ x: 138, y: 196, vx: (Math.random() - .5) * 140, vy: -40 - Math.random() * 100, g: 160, color: ['#c88cff', C.gold, '#fff', '#9fd8ff'][i % 4], size: 2, life: 1.2 }); }
        else if (g.time >= c.limit) fail('timeout');
      } else if (g.phase === 'win') {
        g.s = lerp(g.s, 0, dt * 3); g.p = 1;
        if (g.t > 2.2) { mg.end('win'); return; }
      } else if (g.phase === 'fail') {
        g.s = lerp(g.s, 0, dt * 2); g.heart = Math.max(0, g.heart - dt);
        if (g.t > 0.8) {
          const tp = input.tap || (input.released ? { x: input.x, y: input.y } : null);
          const offer = mg.fails >= 3 && !g.easy;
          if (hit(BTN1, tp) || input.keyPressed('Enter') || input.keyPressed('r') || input.keyPressed('R')) { sfx.click(); reset(); }
          else if (offer && (hit(BTN2, tp) || input.keyPressed('l') || input.keyPressed('L'))) { sfx.click(); g.easy = true; reset(); mg.banner('MORE LAXATIVES!', C.good, 1.5); sfx.fart(); setTimeout(sfx.fart, 300); }
        }
      }

      // ---------- draw ----------
      drawBg(T); drawMan(T); drawGut(T); drawHeart(T); drawHud(); drawMeter(T);
      if (g.phase === 'intro') { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, 96, W, 72);
        text(g.t < 1 ? 'READY...' : 'PUSH!', W / 2, 114, { size: 18, color: g.t < 1 ? C.gold : C.redL });
        text('Hold to push. Keep the needle', W / 2, 136, { size: 8, bold: false }); text('in the GREEN. Red = heart attack.', W / 2, 148, { size: 8, bold: false }); }
      if (g.phase === 'fail') {
        ctx.fillStyle = 'rgba(8,0,0,.82)'; ctx.fillRect(0, 60, W, 250);
        ctx.font = 'bold 14px "Pixelify Sans", monospace';
        const msg = g.failReason === 'heart attack' ? 'YOU DIED OF A HEART ATTACK!' : 'YOU RAN OUT OF TIME AND THE WORLD IS DESTROYED!';
        wrap(ctx, msg, 164).forEach((l, i) => text(l, W / 2, 96 + i * 18, { size: 14, color: C.redL }));
        text('Attempt ' + mg.fails + ' failed', W / 2, 168, { size: 8, color: C.muted });
        if (g.t > 0.8) {
          button(BTN1, 'TRY AGAIN', C.red, 'Enter');
          if (mg.fails >= 3 && !g.easy) { button(BTN2, 'MORE LAXATIVES', '#2f7a46', 'easier - L'); if (mg.sprites.lax) ctx.drawImage(mg.sprites.lax, 140, 214, 24, 24); }
        }
      } else drawButton();
      if (g.phase === 'win') { text("IT'S OUT!", W / 2, 70, { size: 16, color: C.gold }); }
    });

    const r = await mg.done;
    musicStop(music);
    const res = { won: true, how: r === 'plumber' ? 'plumber' : 'strain', fails: mg.fails, easy: g.easy };
    if (r === 'plumber' && typeof window.log === 'function') { try { window.log('A plumber arrives with a plunger the size of a fire extinguisher. The gem is retrieved. You will never be the same.'); } catch (e) {} }
    if (typeof window.playGemShitVideo === 'function') await window.playGemShitVideo();
    else if (typeof playGemShitVideo === 'function') await playGemShitVideo(); // eslint-disable-line no-undef
    return res;
  }

  window.KreplinToilet = { startToiletStrainingMinigame: play, get debug() { return play._debug; } };
})();
