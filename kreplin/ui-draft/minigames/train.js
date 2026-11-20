/* ===================== KREPLIN — Train-tracks escape =====================
   Drop-in for window.startTrainTracksSequence (src/023 ~1248). Same contract:
     - stops general music, plays the train-approach audio
     - escape item used (brick / hgh / cocaine) -> playTrainVideo(<same URL>) then the same
       consequence log lines, clears #actions, resumes music, resolves
     - death -> resolves, then handleTrainDeath() (splat video + GAME OVER + restart buttons)
   New (owner decision): with NO escape items, after freeing your arm a LAST-CHANCE roll appears:
   one hard timing tap; hit the tiny gap and you roll off the rails ('rolled' -> survive, new log lines).
   Brick check accepts S.inventory.items (name 'Brick'/'brick') OR S.inventory.brick (truthy/number).
   Resolved value (ignored by caller): 'brick' | 'hgh' | 'cocaine' | 'rolled' | 'dead'.

   Controls: MASH (tap / click / Space) to snap the 3 ropes on your arm before the train arrives.
   Then DRAG your free arm to an item in your pocket (or tap it; keys 1-3).
   No items: TAP / Space exactly when the marker is in the gap. One go. 10 seconds total.
*/
(function () {
  const ART = (window.KREPLIN_ART_BASE || '../../art/raw/');
  const TRAIN_AUDIO = 'https://www.dropbox.com/scl/fi/ziktyumzsjdl3lj4x2h3m/train-approach.mp3?rlkey=542x1c4hfm6afvamrzhz7eloa&st=md1yiavn&dl=1';
  const VIDEOS = {
    brick: 'https://www.dropbox.com/scl/fi/ocrti8q88tlvhrf8j1dly/brick-train.mp4?rlkey=t1dsgc72zsqbjoltkjb7axevp&st=9iuj9yi2&dl=1',
    hgh: 'https://www.dropbox.com/scl/fi/js9ro21itgzyufejmezps/hgh-train.mp4?rlkey=gmx3zs72nrp5phn6vkw3a3esw&st=7nuckk68&dl=1',
    cocaine: 'https://www.dropbox.com/scl/fi/xt4aysadhw6sxwksl674w/coke-train.mp4?rlkey=dm9pzg7aguaexdhazyvp38ka6&st=bqz3tby8&dl=1',
  };
  const C = { red: '#d71920', redL: '#ff4a50', ink: '#0d1016', gold: '#f2c14e', good: '#3fbf6b', text: '#e9e6de', muted: '#8c93a8' };

  // ---- sfx ----
  let AC = null;
  function ac() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
  function tone(f0, f1, dur, type = 'square', vol = 0.08) { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur); }
  function noise(dur, freq, vol = 0.15) { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(); }
  const sfx = {
    strain() { tone(180 + Math.random() * 60, 120, 0.08, 'sawtooth', 0.04); },
    snap() { noise(0.12, 3000, 0.3); tone(900, 200, 0.1, 'square', 0.06); },
    horn() { tone(311, 311, 0.7, 'sawtooth', 0.05); tone(370, 370, 0.7, 'sawtooth', 0.04); },
    grab() { tone(500, 800, 0.08, 'triangle', 0.08); },
    boom() { noise(0.8, 400, 0.45); tone(90, 30, 0.6, 'square', 0.1); },
    roll() { noise(0.3, 900, 0.2); tone(300, 600, 0.2, 'triangle', 0.08); },
    splat() { noise(0.6, 300, 0.5); tone(120, 30, 0.5, 'sawtooth', 0.12); },
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tintCache = new Map();
  function tinted(img, color) { const k = img.src + color; if (tintCache.has(k)) return tintCache.get(k);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); tintCache.set(k, c); return c; }

  function detectItems(S) {
    S = S || {};
    const inv = S.inventory || {};
    const hasBrick = (Array.isArray(inv.items) && inv.items.some(it => it && typeof it.name === 'string' && it.name.toLowerCase() === 'brick')) ||
      (typeof inv.brick === 'number' ? inv.brick > 0 : !!inv.brick);
    const hasHGH = !!(S.doctor && S.doctor.hgh_stock > 0);
    let hasCocaine = (inv.drugs > 0) || (S.cocaine_purchase_matches_ago !== undefined && S.cocaine_purchase_matches_ago < 999);
    try { if (!hasCocaine && typeof window.hasCocaineAvailable === 'function') hasCocaine = !!window.hasCocaineAvailable(); } catch (e) {}
    const out = []; if (hasBrick) out.push('brick'); if (hasHGH) out.push('hgh'); if (hasCocaine) out.push('cocaine'); return out;
  }

  const HZ = 78, VPX = 90; // horizon y, vanishing x
  const railX = (y, side) => VPX + side * 50 * (y - HZ) / 172;

  async function run(items) {
    const mg = MGKit.open({ title: 'TIED TO THE TRACKS', w: 180, h: 320 });
    await mg.load({ train: ART + 'mg-train-front.png', man: ART + 'mg-train-chairman.png', brick: ART + 'mg-train-brick.png', hgh: ART + 'mg-train-hgh.png', cocaine: ART + 'mg-train-coke.png' });
    const { ctx, W, H, input, text, particles: P } = mg;
    const LIMIT = 10;
    const g = { phase: 'struggle', t: 0, ropes: [0, 0, 0], rope: 0, armFree: false, hand: null, drag: false, horns: [0, 4.5, 8], used: null, useT: 0,
      roll: null, outcome: null, endT: 0, pops: [], items, shake: 0, rollX: 0 };
    run._debug = g;
    const MAN = { x: 42, y: 214 }, SHOULDER = { x: 72, y: 236 };
    const ROPE_X = [62, 84, 106], TAPS = 4;
    const slots = items.length ? items.map((k, i) => ({ k, x: 90 - items.length * 26 + 4 + i * 52, y: 284, w: 44, h: 32 })) : [];
    const LABEL = { brick: 'Throw Brick at Train', hgh: 'Use HGH', cocaine: 'Use Cocaine' }, SHORT = { brick: 'BRICK', hgh: 'HGH', cocaine: 'COKE' };
    const inSlot = (p, s) => p && p.x >= s.x - 4 && p.x <= s.x + s.w + 4 && p.y >= s.y - 8 && p.y <= s.y + s.h + 4;
    const pop = (s, x, y, c, size = 11) => g.pops.push({ s, x, y, c, size, t: 0 });
    const Z = () => { const q = Math.max(0, 1 - g.t / LIMIT); return 1.2 + 22 * q * q; };

    function startRoll() {
      g.phase = 'roll'; g.roll = { m: 0, dir: 1, speed: 1.6, zc: 0.3 + Math.random() * 0.4, zw: 0.07, done: false, t: 0 };
      mg.banner('POCKETS EMPTY!', C.redL, 1.0);
    }
    function useItem(k) {
      if (g.phase !== 'pocket') return; g.phase = 'use'; g.used = k; g.useT = 0; sfx.grab(); mg.flash('#fff', 0.15);
      pop(LABEL[k].toUpperCase() + '!', W / 2, 150, C.gold, 10);
    }
    function die() { g.phase = 'dead'; g.endT = 0; g.outcome = 'dead'; sfx.splat(); mg.flash('#ffffff', 0.25); mg.shake(8, 0.6); mg.banner('SPLAT', C.redL, 1.4);
      for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160; P.spawn({ x: 90, y: 240, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 200, color: i % 3 ? '#c4121a' : '#ff3b3b', size: 2 + (i % 3), life: 1.2 }); } }

    function drawWorld(T) {
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#0b0e1c'); sky.addColorStop(1, '#3a2a4a'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HZ);
      ctx.fillStyle = '#e9e6de'; for (let i = 0; i < 18; i++) ctx.fillRect((i * 53) % W, (i * 29) % (HZ - 20) + 22, 1, 1);
      ctx.fillStyle = '#141826'; for (let x = 0; x < W; x += 12) { const h = 6 + ((x * 7) % 13); ctx.fillRect(x, HZ - h, 12, h); } // hedgerow
      // ground
      const gr = ctx.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, '#2a2620'); gr.addColorStop(1, '#4a3f30'); ctx.fillStyle = gr; ctx.fillRect(0, HZ, W, H - HZ);
      // ballast bed
      ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.moveTo(VPX - 2, HZ); ctx.lineTo(VPX + 2, HZ); ctx.lineTo(railX(H, 1) + 30, H); ctx.lineTo(railX(H, -1) - 30, H); ctx.fill();
      // sleepers (perspective: evenly spaced in z)
      ctx.fillStyle = '#3b2a1c';
      for (let z = 1; z < 40; z += 1.1) { const y = HZ + 172 * 1.5 / z * 0.67; if (y > H) continue; const hw = 50 * (y - HZ) / 172 * 1.35, th = Math.max(1, Math.round((y - HZ) / 30)); ctx.fillRect(Math.round(VPX - hw), Math.round(y), Math.round(hw * 2), th); }
      // rails (vibrate as train nears)
      const vib = g.t > 6 && g.phase !== 'dead' ? (Math.random() - .5) * (g.t - 6) * 0.4 : 0;
      ctx.strokeStyle = '#b8c0cc'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(VPX + s, HZ); ctx.lineTo(railX(H, s) + vib, H); ctx.stroke(); }
      ctx.lineWidth = 1;
    }
    function drawTrain(T) {
      const z = Z(), img = mg.sprites.train; const w = 200 / z, bottom = HZ + 260 / z, h = w; // square sprite
      // headlight glow
      const lit = 0.25 + 0.5 * Math.min(1, 6 / z);
      const rg = ctx.createRadialGradient(VPX, bottom - h * 0.3, 1, VPX, bottom - h * 0.3, Math.max(10, w * 1.4));
      rg.addColorStop(0, `rgba(255,240,180,${lit})`); rg.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      if (img) { const jx = g.t > 7 ? Math.round((Math.random() - .5) * 2) : 0; ctx.drawImage(img, Math.round(VPX - w / 2 + jx), Math.round(bottom - h), Math.round(w), Math.round(h)); }
      if (z < 4 && Math.floor(T * 14) % 2) { ctx.fillStyle = 'rgba(255,255,220,.25)'; ctx.fillRect(0, 0, W, H); }
    }
    function drawMan(T) {
      const img = mg.sprites.man; if (!img) return;
      const struggling = g.phase === 'struggle' && (input.down || input.keys.has(' '));
      const jx = struggling ? Math.round((Math.random() - .5) * 3) : 0;
      ctx.save(); ctx.translate(MAN.x + 48 + jx + g.rollX, MAN.y + 32);
      if (g.phase === 'rolled') ctx.rotate(Math.min(1, g.endT * 3) * Math.PI * 1.5);
      ctx.drawImage(img, -48, -32);
      if (g.phase === 'use' && g.used === 'hgh') { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(T * 30); ctx.drawImage(tinted(img, '#39ff6a'), -48, -32); ctx.globalAlpha = 1; }
      if (g.phase === 'use' && g.used === 'cocaine') { ctx.globalAlpha = 0.4; ctx.drawImage(tinted(img, Math.floor(T * 20) % 2 ? '#ff2bd6' : '#2bf5ff'), -48, -32); ctx.globalAlpha = 1; }
      ctx.restore();
      if (g.phase === 'rolled' || g.phase === 'dead') return;
      // ropes on the arm
      ROPE_X.forEach((x, i) => {
        const v = g.ropes[i]; if (v >= 1) return;
        const shake = i === g.rope && v > 0 ? Math.round(Math.sin(T * 60) * v * 2) : 0;
        const col = v > 0.66 ? '#e6c48a' : v > 0.33 ? '#c99a52' : '#9b6a2c';
        ctx.fillStyle = '#000'; ctx.fillRect(MAN.x + x - 1 + shake, MAN.y + 8, 6, 46); ctx.fillStyle = col; ctx.fillRect(MAN.x + x + shake, MAN.y + 8, 4, 46);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 46; k += 4) ctx.fillRect(MAN.x + x + shake, MAN.y + 8 + k, 4, 1);
        if (v > 0.5) { ctx.fillStyle = '#f4e2b8'; ctx.fillRect(MAN.x + x + 4 + shake, MAN.y + 28, 2, 1); ctx.fillRect(MAN.x + x - 2 + shake, MAN.y + 32, 2, 1); }
      });
      // free arm
      if (g.armFree) {
        const hp = g.hand || { x: SHOULDER.x + 4, y: SHOULDER.y + 36 };
        ctx.strokeStyle = '#000'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(SHOULDER.x, SHOULDER.y); ctx.lineTo(hp.x, hp.y); ctx.stroke();
        ctx.strokeStyle = '#1f2a4a'; ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#000'; ctx.fillRect(hp.x - 4, hp.y - 4, 9, 9); ctx.fillStyle = '#f0a888'; ctx.fillRect(hp.x - 3, hp.y - 3, 7, 7);
      }
    }
    function drawPockets(T) {
      ctx.fillStyle = 'rgba(13,16,22,.88)'; ctx.fillRect(0, 272, W, 48);
      text('POCKETS', 4, 278, { size: 7, align: 'left', color: C.muted });
      if (!slots.length) { text('lint · betting slip · nothing useful', W / 2, 296, { size: 8, color: C.muted, bold: false }); return; }
      for (const s of slots) {
        const hot = g.armFree && g.hand && inSlot(g.hand, s);
        ctx.fillStyle = hot ? C.gold : g.armFree ? '#3a4258' : '#242a3a'; ctx.fillRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
        ctx.fillStyle = '#1d2230'; ctx.fillRect(s.x, s.y, s.w, s.h);
        const img = mg.sprites[s.k]; if (img) ctx.drawImage(img, s.x + 6, s.y - 2, 24, 24);
        text(SHORT[s.k], s.x + s.w / 2, s.y + s.h - 5, { size: 7, color: g.armFree ? C.text : C.muted });
        if (g.armFree && g.phase === 'pocket' && Math.floor(T * 4) % 2) { ctx.strokeStyle = C.gold; ctx.strokeRect(s.x - 3.5, s.y - 3.5, s.w + 7, s.h + 7); }
      }
    }
    function drawHud(T) {
      const left = Math.max(0, LIMIT - g.t);
      text('TRAIN APPROACHING!', W / 2, 10, { size: 10, color: Math.floor(T * 4) % 2 ? C.redL : '#fff' });
      text('Time until impact:', W / 2, 22, { size: 7, color: C.text, bold: false });
      const s = 22 + (left % 1 > 0.85 ? 4 : 0); text(Math.ceil(left).toString(), W / 2, 42, { size: s, color: C.redL });
      if (g.phase === 'struggle') {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(16, 182, 148, 26);
        text('MASH TO STRUGGLE!', W / 2, 190, { size: 10, color: C.gold });
        text('rope ' + (g.rope + 1) + '/3  ·  tap / click / SPACE', W / 2, 201, { size: 7, bold: false });
        // rope progress pips
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#000'; ctx.fillRect(56 + i * 24, 166, 20, 6); ctx.fillStyle = g.ropes[i] >= 1 ? C.good : C.gold; ctx.fillRect(56 + i * 24, 166, Math.round(20 * Math.min(1, g.ropes[i])), 6); }
      }
      if (g.phase === 'pocket') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(10, 182, 160, 26);
        text("YOU'VE FREED AN ARM!", W / 2, 190, { size: 10, color: C.good }); text('DRAG your hand to a pocket item (1-' + slots.length + ')', W / 2, 201, { size: 7, bold: false }); }
      if (g.phase === 'roll' && g.roll) drawRoll(T);
    }
    function drawRoll(T) {
      const r = g.roll, x0 = 14, w = 152, y0 = 150;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(4, y0 - 34, W - 8, 62);
      text('LAST CHANCE!', W / 2, y0 - 24, { size: 12, color: C.redL }); text('TAP when the marker hits the gap - ROLL!', W / 2, y0 - 11, { size: 7, bold: false });
      ctx.fillStyle = '#000'; ctx.fillRect(x0 - 2, y0 - 2, w + 4, 16); ctx.fillStyle = '#5a1012'; ctx.fillRect(x0, y0, w, 12);
      ctx.fillStyle = C.good; ctx.fillRect(Math.round(x0 + (r.zc - r.zw / 2) * w), y0, Math.max(2, Math.round(r.zw * w)), 12);
      const mx = Math.round(x0 + r.m * w); ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1, y0 - 4, 3, 20);
      if (r.done) text(r.hit ? 'ROLL!' : 'MISSED...', W / 2, y0 + 22, { size: 10, color: r.hit ? C.good : C.redL });
    }

    mg.loop((dt, T) => {
      if (g.phase !== 'dead' && g.phase !== 'rolled' && g.phase !== 'escaped') g.t += dt;
      // horn + rumble
      while (g.horns.length && g.t >= g.horns[0]) { g.horns.shift(); sfx.horn(); }
      if (g.t > 5 && g.phase !== 'dead') mg.shake(Math.round((g.t - 5) / 2), 0.05);

      if (g.phase === 'struggle') {
        let taps = 0; if (input.pressed) taps++; if (input.keyPressed(' ') || input.keyPressed('Enter')) taps++;
        if (taps) { g.idle = 0; ac(); sfx.strain(); g.ropes[g.rope] += taps / TAPS; P.spawn({ x: MAN.x + ROPE_X[g.rope] + 2, y: MAN.y + 30, vx: (Math.random() - .5) * 40, vy: -30, color: '#c99a52', size: 1, life: 0.4 }); }
        else if ((g.idle = (g.idle || 0) + dt) > 0.4) g.ropes[g.rope] = Math.max(0, g.ropes[g.rope] - dt * 0.3);
        if (g.ropes[g.rope] >= 1) {
          g.ropes[g.rope] = 1; sfx.snap(); mg.shake(2, 0.1); pop('SNAP!', MAN.x + ROPE_X[g.rope], MAN.y - 4, C.gold);
          for (let i = 0; i < 12; i++) P.spawn({ x: MAN.x + ROPE_X[g.rope] + 2, y: MAN.y + 10 + i * 4, vx: (Math.random() - .5) * 90, vy: -20 - Math.random() * 60, g: 200, color: i % 2 ? '#9b6a2c' : '#e6c48a', size: 2, life: 0.7 });
          g.rope++;
          if (g.rope >= 3) { g.armFree = true; if (typeof window.log === 'function') { try { window.log(`<strong>You've freed an arm!</strong>`); } catch (e) {} }
            if (slots.length) { g.phase = 'pocket'; mg.banner('ARM FREE!', C.good, 0.8); } else startRoll(); }
        }
      } else if (g.phase === 'pocket') {
        if (input.down) { const reach = 90, dx = input.x - SHOULDER.x, dy = input.y - SHOULDER.y, d = Math.hypot(dx, dy), k = d > reach ? reach / d : 1; g.hand = { x: SHOULDER.x + dx * k, y: SHOULDER.y + dy * k }; g.drag = true; }
        if (input.released) { const p = { x: input.x, y: input.y }; const s = slots.find(s => inSlot(p, s) || (g.hand && inSlot(g.hand, s))); if (s) useItem(s.k); g.drag = false; }
        slots.forEach((s, i) => { if (input.keyPressed(String(i + 1))) { g.hand = { x: s.x + s.w / 2, y: s.y + 8 }; useItem(s.k); } });
      } else if (g.phase === 'use') {
        g.useT += dt;
        if (g.used === 'brick') { // brick flies at the train
          const z = Z(), tx = VPX, ty = HZ + 260 / z - 100 / z, k = Math.min(1, g.useT / 0.6);
          g.brickPos = { x: SHOULDER.x + (tx - SHOULDER.x) * k, y: SHOULDER.y + (ty - SHOULDER.y) * k - Math.sin(k * Math.PI) * 50, r: g.useT * 20 };
          if (g.useT >= 0.6 && !g.boomed) { g.boomed = true; sfx.boom(); mg.flash('#ffb020', 0.5); mg.shake(7, 0.5); for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2; P.spawn({ x: tx, y: ty, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, color: ['#ffb020', '#ff4a20', '#fff2a0', '#6a6a6a'][i % 4], size: 3, life: 0.9 }); } mg.banner('DERAILED!', C.gold, 1.2); }
        } else if (g.useT < 0.05) { mg.banner(g.used === 'hgh' ? 'HULK MODE!' : 'ABSOLUTELY WIRED!', g.used === 'hgh' ? '#39ff6a' : '#ff2bd6', 1.2); sfx.boom(); }
        if (g.used !== 'brick' && g.useT > 0.4 && !g.burst) { g.burst = true; mg.shake(5, 0.4); for (let i = 0; i < 30; i++) P.spawn({ x: MAN.x + 48, y: MAN.y + 30, vx: (Math.random() - .5) * 200, vy: -40 - Math.random() * 120, g: 200, color: i % 2 ? '#9b6a2c' : '#e6c48a', size: 2, life: 0.9 }); }
        if (g.useT > 1.6) { g.outcome = g.used; mg.end(g.used); return; }
      } else if (g.phase === 'roll') {
        const r = g.roll; r.t += dt;
        if (!r.done) {
          const sp = r.speed * (1 + 0.45 * Math.sin(r.t * 5.3) + 0.25 * Math.sin(r.t * 11.1));
          r.m += r.dir * sp * dt; if (r.m > 1) { r.m = 1; r.dir = -1; } if (r.m < 0) { r.m = 0; r.dir = 1; }
          if (r.t > 0.6 && (input.pressed || input.keyPressed(' ') || input.keyPressed('Enter'))) {
            r.done = true; r.hit = Math.abs(r.m - r.zc) <= r.zw / 2;
            if (r.hit) { g.phase = 'rolled'; g.endT = 0; g.outcome = 'rolled'; sfx.roll(); mg.banner('YOU ROLLED CLEAR!', C.good, 1.6); }
            else { mg.shake(3, 0.2); pop('NOOOO', W / 2, 120, C.redL, 14); }
          }
        }
      } else if (g.phase === 'rolled') {
        g.endT += dt; g.rollX = Math.min(70, g.endT * 200);
        g.t = Math.min(LIMIT + 0.6, g.t + dt * 4); // train thunders past
        if (g.endT > 2.2) { mg.end('rolled'); return; }
      } else if (g.phase === 'dead') {
        g.endT += dt; if (g.endT > 1.6) { mg.end('dead'); return; }
      }
      if ((g.phase === 'struggle' || g.phase === 'pocket' || g.phase === 'roll') && g.t >= LIMIT) die();

      // ---- draw ----
      drawWorld(T);
      if (g.phase === 'rolled') { if (g.t < LIMIT) drawTrain(T); else { ctx.fillStyle = 'rgba(255,255,220,.15)'; ctx.fillRect(0, 0, W, H); } drawMan(T); }
      else if (g.phase === 'dead') { ctx.fillStyle = '#7a0a10'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#c4121a' : '#a00d14'; ctx.beginPath(); ctx.arc((i * 47) % W, 120 + (i * 61) % 180, 10 + (i % 4) * 7, 0, Math.PI * 2); ctx.fill(); } text('SPLAT', W / 2, 100, { size: 28, color: '#fff' }); }
      else { drawMan(T); if (!(g.phase === 'use' && g.used === 'brick' && g.boomed)) drawTrain(T); }
      if (g.phase === 'use' && g.used === 'brick' && g.brickPos && !g.boomed && mg.sprites.brick) { ctx.save(); ctx.translate(g.brickPos.x, g.brickPos.y); ctx.rotate(g.brickPos.r); ctx.drawImage(mg.sprites.brick, -10, -10, 20, 20); ctx.restore(); }
      if (g.phase !== 'dead') { drawPockets(T); if (g.phase !== 'rolled') drawHud(T); else text('SAFE!', W / 2, 40, { size: 22, color: C.good }); }
      for (let i = g.pops.length - 1; i >= 0; i--) { const p = g.pops[i]; p.t += dt; if (p.t > 0.8) { g.pops.splice(i, 1); continue; } ctx.globalAlpha = 1 - p.t / 0.8; text(p.s, p.x, p.y - p.t * 24, { size: p.size, color: p.c }); ctx.globalAlpha = 1; }
    });
    return mg.done;
  }

  async function startTrainTracksSequence(opts = {}) {
    const S = opts.S || window.S;
    let was = false;
    try {
      if (typeof window._stopGeneralMusic === 'function') { if (window._debugGeneralMusic && window._debugGeneralMusic.playing && window._debugGeneralMusic.playing()) was = true; window._stopGeneralMusic(); }
      else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) { was = true; generalMusicAudio.pause(); } // eslint-disable-line no-undef
    } catch (e) {}
    let audio = null;
    if (opts.music !== null) { try { audio = new Audio(opts.music || TRAIN_AUDIO); audio.volume = 0.7; audio.play().catch(() => {}); } catch (e) {} }
    const resume = () => { if (!was) return; try { if (typeof window._startGeneralMusic === 'function') window._startGeneralMusic(); else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) generalMusicAudio.play().catch(() => {}); } catch (e) {} }; // eslint-disable-line no-undef
    const L = (m) => { if (typeof window.log === 'function') try { window.log(m); } catch (e) {} };

    const outcome = await run(detectItems(S));
    if (audio) { try { audio.pause(); audio.currentTime = 0; } catch (e) {} }

    if (VIDEOS[outcome]) {
      if (typeof window.playTrainVideo === 'function') await window.playTrainVideo(VIDEOS[outcome]);
      L(`<strong>The train careens into a row of detached houses.</strong>`);
      L(`Hundreds of people on board are killed.`);
      L(`78 people in the houses are killed.`);
      L(`You survive, but at what cost?`);
      L(``);
      const actions = document.getElementById('actions'); if (actions) actions.innerHTML = '';
      resume();
      return outcome;
    }
    if (outcome === 'rolled') {
      L(`<strong>You roll off the rails a split second before impact.</strong>`);
      L(`The train thunders past close enough to take one of your shoes with it.`);
      L(`You lie in the gravel, shoeless and soiled, but alive.`);
      L(``);
      resume();
      return outcome;
    }
    // death: original resolves first, then handleTrainDeath plays the splat video + GAME OVER
    resume();
    if (typeof window.handleTrainDeath === 'function') setTimeout(() => window.handleTrainDeath(), 0);
    return 'dead';
  }

  window.KreplinTrain = { startTrainTracksSequence, detectItems, get debug() { return run._debug; } };
})();
