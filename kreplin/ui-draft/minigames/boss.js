/* ===================== KRUNCHEM BOSS BATTLE (MGKit) =====================
   Drop-in replacement for startKrunchemBossBattle() in src/037-generate-violent-scenarios.js:748.

   Contract (same as the original):
   - returns a Promise; callers do startKrunchemBossBattle().then(...)
   - pauses general music, plays the boss track, resumes general music when done
   - WIN  -> "VICTORY!" card -> tap -> delmor-confront.mp4 -> line-by-line epilogue text with NEXT
             (NEXT plays playDowningStreetVideo()). Like the original, the promise resolves when the
             confront video ENDS (the epilogue text overlay stays on top until NEXT).
   - LOSS -> "DEFEATED!" card with Restart Fight / Continue. Restart now restarts IN PLACE (fixes the
             old double-resolve bug); Continue resolves. After 3 defeats the restart is an easier
             "hungover Krunchem" fight. MGKit Give-up also resolves as a loss.
   - resolves with 'win' | 'lose' (the original resolved undefined; every caller ignores the value).
   - no S fields are touched (same as the original).

   Options (all optional, for demo/tests): { cutscene:false, music:false, art:'path/to/art/raw/', debug:true }
   Gameplay: vertical shmup. Drag anywhere (relative drag) or arrows/WASD to move; bricks auto-fire up.
   Krunchem's force field (110 hits; 70 hungover) cracks in 4 visible stages; each stage unlocks nastier, telegraphed
   rocket patterns (aimed lines, fans, airstrike curtains with a gap, killable homing cigars).
   Falling pints heal 20. Typical fight 60–90 s.
*/
(function () {
  const W = 180, H = 320;
  const BOSS_MUSIC = 'https://www.dropbox.com/scl/fi/i11xhg5i8pxzmk4h3ujta/krunchem-boss-fight.mp3?rlkey=pgvmyz9g7yyrze7shskw1flyc&st=hlvhfdts&dl=1';
  const WIN_VIDEO = 'https://www.dropbox.com/scl/fi/sz3lhwrps0hychrh0p0hh/delmor-confront.mp4?rlkey=56cg3piey3i776zw8h75g1sy2&st=9f8r7g92&dl=1';
  const FONT = '"Pixelify Sans", ui-monospace, monospace';

  // ---- tiny WebAudio sfx ----
  let AC = null;
  function sfx(type, f0, f1, dur, vol = 0.25) {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume().catch(() => {});
      const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  // white-tinted copy of a sprite (hit flash)
  function tint(img, color) {
    if (!img) return null;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function pauseGeneralMusic() {
    let was = false;
    try {
      if (typeof window._stopGeneralMusic === 'function') {
        if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) was = true;
        window._stopGeneralMusic();
      } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) { was = true; generalMusicAudio.pause(); }
    } catch (e) {}
    return was;
  }
  function resumeGeneralMusic(was) {
    if (!was) return;
    try {
      if (typeof window._startGeneralMusic === 'function') window._startGeneralMusic();
      else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) generalMusicAudio.play().catch(() => {});
    } catch (e) {}
  }

  const TAUNTS = ['YOU FAT PRICK!', 'THE GEM IS MINE!', 'STOP THROWING BRICKS!', 'NOT THE SUIT!', 'BRADFORD BELONGS TO ME!', 'I KILLED BETTER MEN THAN YOU', 'IS THAT LAGER ON YOUR BREATH?'];
  const STAGE_BANNERS = ['CRACK!', "IT'S GOING!", 'ONE MORE GO!'];
  const STAGE_COL = ['#6ff', '#9f6', '#fc4', '#f64'];

  async function startKrunchemBossBattle(opts = {}) {
    const art = opts.art || window.KMG_ART || 'art/raw/';
    const wasMusic = pauseGeneralMusic();
    let music = null;
    if (opts.music !== false) { try { music = new Audio(BOSS_MUSIC); music.loop = true; music.volume = 0.7; music.play().catch(() => {}); } catch (e) {} }
    const stopMusic = () => { if (music) { music.pause(); music.currentTime = 0; } };

    const mg = MGKit.open({ title: 'KRUNCHEM — JETPACK DUEL', w: W, h: H, giveUpAfter: 150, giveUpAfterFails: 3, giveUpLabel: 'Continue', onGiveUp: () => 'lose' });
    await mg.load({ me: art + 'mg-boss-chairman.png', k: art + 'mg-boss-krunchem.png', rocket: art + 'mg-boss-rocket.png',
      brick: art + 'mg-boss-brick.png', beer: art + 'mg-boss-beer.png', roofs: art + 'mg-boss-roofs.png' });
    const S = mg.sprites, ctx = mg.ctx, inp = mg.input;
    const kWhite = tint(S.k, '#fff'), meRed = tint(S.me, '#f33');

    // ---------- state ----------
    let G;
    let losses = 0;
    const clouds = Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 18 + Math.random() * 30, v: 6 + Math.random() * 10 }));
    const rain = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 160 + Math.random() * 120 }));
    function makeCracks() {
      const out = [];
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, pts = [];
        let r = 30, aa = a;
        for (let j = 0; j < 4; j++) { pts.push([Math.cos(aa) * r, Math.sin(aa) * r]); r -= 5 + Math.random() * 4; aa += (Math.random() - 0.5) * 0.7; }
        out.push(pts);
      }
      return out;
    }
    function reset(easy) {
      G = {
        state: 'intro', t: 0, easy,
        P: { x: 90, y: 268, hp: 100, inv: 0, fire: 0, tilt: 0 },
        K: { x: 90, y: 62, t: 0, ffMax: easy ? 70 : 110, ff: easy ? 70 : 110, flash: 0, ring: 0, taunt: null, tauntT: 0, charge: 0, dead: 0, vy: 0, rot: 0 },
        bricks: [], rockets: [], beers: [], tele: [], sched: [], cracks: makeCracks(),
        nextPattern: 2.5, nextBeer: 10, nextTaunt: 6, stage: 0, drag: null, lightning: 0, shotDown: 0, hits: 0,
      };
    }
    reset(false);
    const stageOf = () => Math.min(3, Math.floor((1 - G.K.ff / G.K.ffMax) * 4));
    const spd = () => (G.easy ? 0.8 : 1) * (1 + G.stage * 0.12);
    const after = (d, fn) => G.sched.push({ t: d, fn });
    const say = (txt, d = 1.6) => { G.K.taunt = txt; G.K.tauntT = d; };

    // ---------- patterns ----------
    function rocket(x, y, vx, vy, kind = 'std') { G.rockets.push({ x, y, vx, vy, kind, hp: kind === 'homing' ? 3 : 1, life: kind === 'homing' ? 5.5 : 9 }); }
    function patAimed(n) {
      const K = G.K, tx = G.P.x, ty = G.P.y, sx = K.x + 14, sy = K.y + 14;
      const a = Math.atan2(ty - sy, tx - sx);
      G.tele.push({ type: 'line', x0: sx, y0: sy, a, t: 0, d: 0.75 });
      K.charge = 0.75; sfx('square', 300, 900, 0.6, 0.08);
      for (let i = 0; i < n; i++) after(0.75 + i * 0.16, () => { const v = 150 * spd(); rocket(sx, sy, Math.cos(a) * v, Math.sin(a) * v); sfx('sawtooth', 220, 90, 0.25, 0.18); });
    }
    function patFan(n) {
      const K = G.K; K.charge = 0.65;
      G.tele.push({ type: 'fan', x: K.x, y: K.y + 16, n, t: 0, d: 0.65 });
      sfx('triangle', 200, 700, 0.6, 0.12);
      after(0.65, () => {
        for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * (1.6 / (n - 1)); const v = 95 * spd(); rocket(K.x, K.y + 16, Math.cos(a) * v, Math.sin(a) * v); }
        sfx('sawtooth', 160, 60, 0.35, 0.2); mg.shake(2, 0.15);
      });
    }
    function patCurtain() {
      const cols = 9, cw = W / cols; let gap = Math.floor(Math.random() * (cols - 1));
      // gap tends to be away from the player so they must move, but always reachable
      const pc = Math.floor(G.P.x / cw); if (Math.abs(gap - pc) < 1) gap = (gap + 4) % (cols - 1);
      for (let c = 0; c < cols; c++) if (c !== gap && c !== gap + 1) G.tele.push({ type: 'col', x: c * cw, w: cw, t: 0, d: 1.0 });
      say('AIRSTRIKE!!', 1.2); sfx('square', 880, 880, 0.12, 0.08); after(0.3, () => sfx('square', 880, 880, 0.12, 0.08)); after(0.6, () => sfx('square', 880, 880, 0.12, 0.08));
      after(1.0, () => { for (let c = 0; c < cols; c++) if (c !== gap && c !== gap + 1) rocket(c * cw + cw / 2, -14 - Math.random() * 8, 0, 135 * spd()); mg.shake(2, 0.2); });
    }
    function patHoming() {
      const K = G.K; K.charge = 0.5; say('SMOKE THIS!', 1.2); sfx('sine', 500, 1200, 0.4, 0.1);
      after(0.5, () => rocket(K.x - 12, K.y + 12, -30, 40, 'homing'));
      if (G.stage >= 3) after(0.9, () => rocket(K.x + 12, K.y + 12, 30, 40, 'homing'));
    }
    const POOLS = [['aimed1', 'fan5'], ['aimed1', 'fan5', 'curtain'], ['aimed3', 'curtain', 'fan5', 'homing'], ['curtain', 'fan7', 'aimed3', 'homing', 'combo']];
    function runPattern() {
      const pool = POOLS[G.stage], p = pool[Math.floor(Math.random() * pool.length)];
      if (p === 'aimed1') patAimed(1); else if (p === 'aimed3') patAimed(3); else if (p === 'fan5') patFan(5); else if (p === 'fan7') patFan(7);
      else if (p === 'curtain') patCurtain(); else if (p === 'homing') patHoming();
      else { patFan(5); after(1.1, () => patAimed(2)); }
      const gap = [2.3, 2.0, 1.75, 1.5][G.stage] * (G.easy ? 1.3 : 1) + (p === 'combo' ? 1.2 : 0) + (p === 'curtain' ? 0.6 : 0);
      G.nextPattern = gap + 0.8;
    }

    function burst(x, y, n, colors, sp = 60, life = 0.6, g = 0) {
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random());
        mg.particles.spawn({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, life: life * (0.6 + Math.random() * 0.6), size: Math.random() < 0.3 ? 2 : 1, color: colors[i % colors.length] }); }
    }
    function hurt(dmg) {
      const P = G.P; P.hp = Math.max(0, P.hp - dmg); P.inv = 1.0;
      mg.shake(5, 0.3); mg.flash('#f00', 0.25); burst(P.x, P.y, 26, ['#f80', '#fd4', '#f33', '#fff'], 90);
      sfx('sawtooth', 90, 35, 0.45, 0.35); sfx('square', 420, 160, 0.2, 0.2);
      if (P.hp <= 0) {
        G.state = 'falling'; G.t = 0; losses++; mg.fail(); stopMusic();
        sfx('sawtooth', 400, 40, 1.4, 0.3);
      }
    }

    // ---------- update ----------
    function update(dt) {
      G.t += dt;
      const P = G.P, K = G.K;
      // ambient
      for (const c of clouds) { c.y += c.v * dt; if (c.y - c.r > H) { c.y = -c.r; c.x = Math.random() * W; } }
      for (const r of rain) { r.y += r.v * dt; r.x -= r.v * 0.15 * dt; if (r.y > H) { r.y = -5; r.x = Math.random() * (W + 30); } }
      if (G.lightning > 0) G.lightning -= dt; else if (Math.random() < dt * 0.06) { G.lightning = 0.18; sfx('sawtooth', 70, 30, 0.8, 0.12); }
      if (K.tauntT > 0) K.tauntT -= dt;

      if (G.state === 'intro') {
        K.x = 90 + Math.sin(G.t * 2) * 10;
        if (G.t > 0.2 && !G._said) { G._said = 1; say(G.easy ? 'UGH... MY HEAD...' : "YOU'LL NEVER TAKE THE GEM!", 2.2); }
        if (G.t > 2.6) { G.state = 'fight'; G.t = 0; mg.banner('BRICK HIM!', '#f2c14e', 1.0); sfx('square', 300, 600, 0.2, 0.15); }
        movePlayer(dt);
        return;
      }
      if (G.state === 'fight') {
        movePlayer(dt);
        // Krunchem movement: lazy figure-8, slows while charging
        const s = spd(), slow = K.charge > 0 ? 0.25 : 1;
        K.t += dt * slow * s;
        K.x = 90 + Math.sin(K.t * 0.75) * 56 + Math.sin(K.t * 2.1) * 10;
        K.y = 62 + Math.sin(K.t * 1.3) * 10;
        if (K.charge > 0) K.charge -= dt;
        if (K.flash > 0) K.flash -= dt; if (K.ring > 0) K.ring -= dt;
        // auto-fire
        P.fire -= dt;
        if (P.fire <= 0) { P.fire = 0.24; G.bricks.push({ x: P.x, y: P.y - 12, vy: -270, rot: 0 }); sfx('square', 170, 90, 0.08, 0.05); }
        // schedule
        for (let i = G.sched.length - 1; i >= 0; i--) { const s2 = G.sched[i]; s2.t -= dt; if (s2.t <= 0) { G.sched.splice(i, 1); if (G.state === 'fight') s2.fn(); } }
        G.nextPattern -= dt; if (G.nextPattern <= 0) runPattern();
        G.nextBeer -= dt; if (G.nextBeer <= 0) { G.nextBeer = 9 + Math.random() * 4; dropBeer(); }
        G.nextTaunt -= dt; if (G.nextTaunt <= 0) { G.nextTaunt = 7 + Math.random() * 5; if (K.tauntT <= 0) say(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]); }
      }
      for (let i = G.tele.length - 1; i >= 0; i--) { G.tele[i].t += dt; if (G.tele[i].t >= G.tele[i].d) G.tele.splice(i, 1); }

      // bricks
      for (let i = G.bricks.length - 1; i >= 0; i--) {
        const b = G.bricks[i]; b.y += b.vy * dt; b.rot += dt * 14;
        if (b.y < -10) { G.bricks.splice(i, 1); continue; }
        let gone = false;
        for (let j = G.rockets.length - 1; j >= 0; j--) {
          const r = G.rockets[j];
          if (Math.abs(r.x - b.x) < 6 && Math.abs(r.y - b.y) < 9) {
            gone = true; burst(b.x, b.y, 6, ['#b33', '#822'], 40, 0.3);
            if (r.kind === 'homing' && --r.hp <= 0) { G.rockets.splice(j, 1); burst(r.x, r.y, 18, ['#f80', '#fd4', '#fff'], 70); sfx('square', 300, 80, 0.2, 0.15); G.shotDown++; mg.banner('CIGAR DOWN!', '#9f6', 0.6); }
            break;
          }
        }
        if (gone) { G.bricks.splice(i, 1); continue; }
        if (G.state === 'fight') {
          const dx = b.x - K.x, dy = b.y - (K.y + 2);
          if (dx * dx + dy * dy < 30 * 30) {
            G.bricks.splice(i, 1); K.ff -= 1; K.flash = 0.08; K.ring = 0.25; G.hits++;
            const a = Math.atan2(dy, dx); const ex = K.x + Math.cos(a) * 30, ey = K.y + 2 + Math.sin(a) * 30;
            burst(ex, ey, 7, [STAGE_COL[G.stage], '#fff', '#c33'], 55, 0.35);
            mg.shake(1, 0.06); sfx('sine', 900 - G.stage * 120, 300, 0.09, 0.08);
            const st = stageOf();
            if (K.ff <= 0) { killBoss(); }
            else if (st !== G.stage) {
              G.stage = st; mg.shake(5, 0.4); mg.flash('#fff', 0.3); mg.banner(STAGE_BANNERS[st - 1] || 'CRACK!', STAGE_COL[st], 1.1);
              burst(K.x, K.y, 40, [STAGE_COL[st], '#fff'], 110, 0.8); sfx('sawtooth', 1200, 80, 0.5, 0.25); sfx('square', 60, 30, 0.6, 0.25);
              say(['ARGH! MY FIELD!', 'THAT WAS IMPORTED!', 'MUMMY!!'][st - 1], 1.6); dropBeer(K.x);
              G.nextPattern = Math.max(G.nextPattern, 1.4); // breather after a crack
            }
          }
        }
      }
      // rockets
      for (let i = G.rockets.length - 1; i >= 0; i--) {
        const r = G.rockets[i];
        if (r.kind === 'homing') {
          const want = Math.atan2(P.y - r.y, P.x - r.x), cur = Math.atan2(r.vy, r.vx);
          let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          const na = cur + Math.max(-1.7 * dt, Math.min(1.7 * dt, d)), v = 72 * (G.easy ? 0.85 : 1);
          r.vx = Math.cos(na) * v; r.vy = Math.sin(na) * v;
          if (Math.random() < 0.5) mg.particles.spawn({ x: r.x - r.vx * 0.06, y: r.y - r.vy * 0.06, vx: 0, vy: 0, life: 0.5, color: '#999', size: 2 });
        }
        r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt;
        if (r.life <= 0 || r.y > H + 20 || r.x < -20 || r.x > W + 20 || r.y < -40) {
          if (r.kind === 'homing' && r.life <= 0) burst(r.x, r.y, 10, ['#888', '#f80'], 40);
          G.rockets.splice(i, 1); continue;
        }
        if (G.state === 'fight' && P.inv <= 0) {
          const dx = r.x - P.x, dy = r.y - P.y;
          if (dx * dx + dy * dy < 9 * 9) { G.rockets.splice(i, 1); hurt(G.easy ? 10 : 15); }
        }
      }
      // beers
      for (let i = G.beers.length - 1; i >= 0; i--) {
        const b = G.beers[i]; b.t += dt; b.y += 42 * dt; b.x += Math.sin(b.t * 3) * 14 * dt;
        if (b.y > H + 16) { G.beers.splice(i, 1); continue; }
        if (G.state === 'fight' && Math.hypot(b.x - P.x, b.y - P.y) < 15) {
          G.beers.splice(i, 1); P.hp = Math.min(100, P.hp + 20);
          burst(b.x, b.y, 16, ['#fc3', '#fff', '#fa0'], 50, 0.6, -40); mg.flash('#fc3', 0.15);
          sfx('sine', 300, 120, 0.15, 0.2); setTimeout(() => sfx('sine', 260, 110, 0.15, 0.2), 120);
          G.popup = { txt: '+20 GLUG', x: P.x, y: P.y - 22, t: 0.9 };
        }
      }
      if (G.popup) { G.popup.t -= dt; G.popup.y -= 18 * dt; if (G.popup.t <= 0) G.popup = null; }
      if (P.inv > 0) P.inv -= dt;

      if (G.state === 'dying') {
        K.dead += dt;
        if (K.dead < 1.6) { if (Math.random() < dt * 14) { const x = K.x + (Math.random() - .5) * 50, y = K.y + (Math.random() - .5) * 50; burst(x, y, 14, ['#f80', '#fd4', '#fff', '#c33'], 80); mg.shake(4, 0.1); sfx('sawtooth', 120, 40, 0.3, 0.2); } }
        else { K.vy += 220 * dt; K.y += K.vy * dt; K.rot += dt * 5; }
        if (K.dead > 3.2) { G.state = 'won'; G.t = 0; }
      }
      if (G.state === 'falling') { P.y += 90 * dt; P.tilt += dt * 4; if (Math.random() < dt * 20) mg.particles.spawn({ x: P.x, y: P.y + 10, vx: (Math.random() - .5) * 20, vy: -20, life: 0.8, color: '#555', size: 2 }); if (P.y > H + 40) { G.state = 'lost'; G.t = 0; } }
      if (G.state === 'won' || G.state === 'lost') endScreens();
    }
    function dropBeer(x) { G.beers.push({ x: x != null ? x : 20 + Math.random() * (W - 40), y: -14, t: Math.random() * 6 }); }
    function killBoss() {
      G.state = 'dying'; G.K.ff = 0; G.rockets.length = 0; G.tele.length = 0; G.sched.length = 0;
      mg.flash('#fff', 0.6); mg.shake(7, 0.8); mg.banner('VICTORY!', '#3fbf6b', 2.2); say('NOOOOOO—', 1.4);
      burst(G.K.x, G.K.y, 80, ['#6ff', '#fff', '#f64', '#fd4'], 140, 1.1); sfx('sawtooth', 1400, 40, 1.2, 0.3); stopMusic();
    }
    function movePlayer(dt) {
      const P = G.P; let mx = 0, my = 0; const k = inp.keys;
      if (k.has('ArrowLeft') || k.has('a') || k.has('A')) mx--; if (k.has('ArrowRight') || k.has('d') || k.has('D')) mx++;
      if (k.has('ArrowUp') || k.has('w') || k.has('W')) my--; if (k.has('ArrowDown') || k.has('s') || k.has('S')) my++;
      const ox = P.x;
      if (mx || my) { const l = Math.hypot(mx, my); P.x += mx / l * 115 * dt; P.y += my / l * 115 * dt; }
      if (inp.pressed) G.drag = { ox: P.x - inp.x, oy: P.y - inp.y };
      if (inp.down && G.drag) { const tx = inp.x + G.drag.ox, ty = inp.y + G.drag.oy; const f = Math.min(1, dt * 22); P.x += (tx - P.x) * f; P.y += (ty - P.y) * f; }
      if (!inp.down) G.drag = null;
      P.x = Math.max(10, Math.min(W - 10, P.x)); P.y = Math.max(150, Math.min(H - 18, P.y));
      P.tilt += ((P.x - ox) / Math.max(dt, 1e-3) / 400 - P.tilt) * Math.min(1, dt * 10);
    }

    // ---------- end screens (buttons) ----------
    const btns = [];
    function button(id, x, y, w, h, label, col) { btns.push({ id, x, y, w, h, label, col }); }
    function endScreens() {
      btns.length = 0;
      if (G.state === 'won') {
        if (G.t > 0.8 && (inp.pressed || inp.keyPressed('Enter') || inp.keyPressed(' '))) mg.end('win');
      } else {
        button('restart', 30, 196, 120, 26, losses >= 3 ? 'Restart (hungover K)' : 'Restart Fight', '#d71920');
        button('cont', 30, 230, 120, 22, 'Continue', '#242a3a');
        if (G.t > 0.5) {
          if (inp.keyPressed('r') || inp.keyPressed('R')) restart();
          else if (inp.keyPressed('Enter') || inp.keyPressed('Escape')) mg.end('lose');
          else if (inp.pressed) for (const b of btns) if (inp.x >= b.x && inp.x <= b.x + b.w && inp.y >= b.y && inp.y <= b.y + b.h) { b.id === 'restart' ? restart() : mg.end('lose'); break; }
        }
      }
    }
    function restart() { reset(losses >= 3); if (music) { music.currentTime = 0; music.play().catch(() => {}); } }

    // ---------- draw ----------
    function bar(x, y, w, h, v, col, back = '#2a0f12') {
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, v)), h);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, Math.round(w * Math.max(0, v)), 1);
    }
    function draw() {
      const P = G.P, K = G.K;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#120a22'); g.addColorStop(0.6, '#2a2440'); g.addColorStop(1, '#3a3050');
      ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
      if (G.lightning > 0) { ctx.fillStyle = 'rgba(220,220,255,.35)'; ctx.fillRect(0, 0, W, H); }
      ctx.fillStyle = 'rgba(80,70,110,.35)';
      for (const c of clouds) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r, c.r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
      // Bradford rooftops far below, scrolling
      if (S.roofs) { const off = (mg.elapsed * 14) % 128; ctx.globalAlpha = 0.85; for (let x = -128; x < W + 128; x += 128) ctx.drawImage(S.roofs, Math.round(x + off - 64), H - 52); ctx.globalAlpha = 1; }
      ctx.fillStyle = 'rgba(170,180,220,.35)';
      for (const r of rain) ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 4);

      // telegraphs
      for (const t of G.tele) {
        const blink = Math.floor(t.t * 12) % 2 === 0;
        if (t.type === 'line') {
          ctx.save(); ctx.strokeStyle = blink ? 'rgba(255,60,60,.9)' : 'rgba(255,60,60,.35)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1 + (t.t / t.d) * 2;
          ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x0 + Math.cos(t.a) * 400, t.y0 + Math.sin(t.a) * 400); ctx.stroke(); ctx.restore();
        } else if (t.type === 'col') {
          ctx.fillStyle = blink ? 'rgba(255,40,40,.22)' : 'rgba(255,40,40,.1)'; ctx.fillRect(t.x + 1, 0, t.w - 2, H);
          mg.text('!', t.x + t.w / 2, 14 + Math.sin(t.t * 20) * 2, { size: 12, color: '#f44' });
        } else if (t.type === 'fan') {
          ctx.save(); ctx.strokeStyle = blink ? 'rgba(255,160,60,.6)' : 'rgba(255,160,60,.2)'; ctx.setLineDash([2, 4]);
          for (let i = 0; i < t.n; i++) { const a = Math.PI / 2 + (i - (t.n - 1) / 2) * (1.6 / (t.n - 1)); ctx.beginPath(); ctx.moveTo(G.K.x, G.K.y + 16); ctx.lineTo(G.K.x + Math.cos(a) * 60 * (t.t / t.d), G.K.y + 16 + Math.sin(a) * 60 * (t.t / t.d)); ctx.stroke(); }
          ctx.restore();
        }
      }

      // Krunchem + force field
      if (G.state !== 'won' || K.y < H + 40) {
        ctx.save(); ctx.translate(Math.round(K.x), Math.round(K.y)); ctx.rotate(K.rot);
        // jetpack flame
        const fl = 6 + Math.random() * 5; ctx.fillStyle = '#f80'; ctx.fillRect(-14, 18, 4, fl); ctx.fillStyle = '#fd4'; ctx.fillRect(-13, 18, 2, fl - 3);
        const img = K.flash > 0 ? kWhite : S.k;
        if (img) ctx.drawImage(img, -32, -32); else { ctx.fillStyle = '#334'; ctx.fillRect(-12, -20, 24, 40); }
        if (K.charge > 0) { ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 120)},0,.7)`; ctx.beginPath(); ctx.arc(14, 14, 3 + Math.random() * 3, 0, 7); ctx.fill(); }
        ctx.restore();
        if (K.ff > 0) {
          const col = STAGE_COL[G.stage], wob = Math.sin(mg.elapsed * 6) * 0.06;
          ctx.save(); ctx.translate(Math.round(K.x), Math.round(K.y + 2));
          ctx.globalAlpha = 0.16 + wob + (K.ring > 0 ? 0.25 : 0); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
          ctx.globalAlpha = 0.85; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 30 + (K.ring > 0 ? (0.25 - K.ring) * 20 : 0), 0, 7); ctx.stroke();
          ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, 0, 27, mg.elapsed * 2, mg.elapsed * 2 + 1.2); ctx.stroke();
          // cracks: 3 per stage
          ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
          for (let i = 0; i < G.stage * 3 + (K.ff / K.ffMax < 0.08 ? 3 : 0); i++) { const c = G.cracks[i]; ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (const p of c) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
          ctx.restore();
        }
        if (K.tauntT > 0 && K.taunt && G.state !== 'won') {
          ctx.font = `bold 8px ${FONT}`; const tw = Math.ceil(ctx.measureText(K.taunt).width) + 8;
          const bx = Math.max(2, Math.min(W - tw - 2, K.x - tw / 2)), by = K.y + 36;
          ctx.fillStyle = '#f4f1ea'; ctx.fillRect(bx, by, tw, 13); ctx.fillStyle = '#000'; ctx.fillRect(bx, by + 13, tw, 1);
          ctx.fillStyle = '#f4f1ea'; ctx.fillRect(Math.round(K.x) - 2, by - 3, 4, 3);
          mg.text(K.taunt, bx + tw / 2, by + 7, { size: 8, color: '#9e0f15', shadow: false });
        }
      }

      // beers, bricks, rockets
      for (const b of G.beers) if (S.beer) { ctx.drawImage(S.beer, Math.round(b.x - 10), Math.round(b.y - 10), 20, 20); }
      for (const b of G.bricks) { ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.round(b.rot * 2) / 2); if (S.brick) ctx.drawImage(S.brick, -6, -6, 12, 12); else { ctx.fillStyle = '#b33'; ctx.fillRect(-4, -3, 8, 6); } ctx.restore(); }
      for (const r of G.rockets) {
        ctx.save(); ctx.translate(Math.round(r.x), Math.round(r.y)); ctx.rotate(Math.atan2(r.vy, r.vx) + Math.PI / 2);
        if (S.rocket) ctx.drawImage(S.rocket, -8, -8, 16, 16); else { ctx.fillStyle = '#d33'; ctx.fillRect(-2, -6, 4, 12); }
        ctx.fillStyle = Math.random() < .5 ? '#fd4' : '#f80'; ctx.fillRect(-1, 7, 2, 2 + Math.random() * 3);
        if (r.kind === 'homing') { ctx.strokeStyle = '#f44'; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(mg.elapsed * 20), 0, 7); ctx.stroke(); }
        ctx.restore();
      }

      // player
      if (G.state !== 'lost' && !(P.inv > 0 && Math.floor(P.inv * 16) % 2 === 0)) {
        ctx.save(); ctx.translate(Math.round(P.x), Math.round(P.y)); ctx.rotate(Math.max(-0.35, Math.min(0.35, P.tilt)));
        const fl = 5 + Math.random() * 6; ctx.fillStyle = '#f80'; ctx.fillRect(-5, 8, 3, fl); ctx.fillRect(2, 8, 3, fl); ctx.fillStyle = '#fd4'; ctx.fillRect(-4, 8, 1, fl - 2); ctx.fillRect(3, 8, 1, fl - 2);
        const img = P.inv > 0.8 ? meRed : S.me;
        if (img) ctx.drawImage(img, -18, -20, 36, 36); else { ctx.fillStyle = '#235'; ctx.fillRect(-8, -12, 16, 24); }
        ctx.restore();
        if (G.state === 'fight' && inp.down) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(Math.round(P.x) - 1, Math.round(P.y) - 1, 2, 2); } // hitbox dot while dragging
      }
      if (G.popup) mg.text(G.popup.txt, G.popup.x, G.popup.y, { size: 9, color: '#f2c14e' });

      // HUD
      mg.text('FORCE FIELD', 4, 7, { size: 8, align: 'left', color: STAGE_COL[G.stage] });
      bar(60, 4, 116, 6, K.ff / K.ffMax, STAGE_COL[G.stage], '#102028');
      for (let i = 1; i < 4; i++) { ctx.fillStyle = '#000'; ctx.fillRect(60 + Math.round(116 * i / 4), 4, 1, 6); }
      mg.text('HEALTH', 4, H - 7, { size: 8, align: 'left', color: '#f4f1ea' });
      bar(40, H - 10, 70, 6, P.hp / 100, P.hp > 40 ? '#3fbf6b' : (Math.floor(mg.elapsed * 6) % 2 ? '#e5484d' : '#f29b2e'));
      mg.text(`HITS ${G.hits}`, W - 4, H - 7, { size: 8, align: 'right', color: '#f2c14e' });

      if (G.state === 'intro') {
        const n = 3 - Math.floor(G.t / 0.8);
        mg.text(n > 0 ? String(n) : 'GO!', W / 2, 170, { size: 26, color: '#f2c14e' });
        mg.text('DRAG / ARROWS to fly · bricks auto-fire', W / 2, 200, { size: 8, color: '#e9e6de' });
        mg.text('Pints = health. Red = incoming.', W / 2, 212, { size: 8, color: '#8c93a8' });
      }
      if (G.state === 'won' || G.state === 'lost') {
        ctx.fillStyle = 'rgba(7,9,13,.86)'; ctx.fillRect(0, 0, W, H);
        const won = G.state === 'won';
        mg.text(won ? 'VICTORY!' : 'DEFEATED!', W / 2, 120, { size: 24, color: won ? '#3fbf6b' : '#e5484d' });
        wrap(won ? "Krunchem's force field has been destroyed!" : 'You have been defeated...', W / 2, 150, 150, 10, '#f4f1ea');
        if (won) { mg.text(`${G.hits} bricks thrown in anger`, W / 2, 182, { size: 8, color: '#f2c14e' }); if (Math.floor(G.t * 2) % 2 === 0) mg.text('Click anywhere to continue...', W / 2, 214, { size: 9, color: '#8c93a8' }); }
        else {
          for (const b of btns) { ctx.fillStyle = '#000'; ctx.fillRect(b.x, b.y + 2, b.w, b.h); ctx.fillStyle = b.col; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(b.x, b.y, b.w, 1); mg.text(b.label, b.x + b.w / 2, b.y + b.h / 2, { size: 10, color: '#fff' }); }
          mg.text('Or click Continue to move on', W / 2, 266, { size: 8, color: '#8c93a8' });
          mg.text('[R] restart  [Enter] continue', W / 2, 278, { size: 7, color: '#5a6178' });
        }
      }
    }
    function wrap(str, x, y, maxW, size, color) {
      ctx.font = `bold ${size}px ${FONT}`; const words = str.split(' '); let line = '', yy = y;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { mg.text(line, x, yy, { size, color }); line = w; yy += size + 3; } else line = t; }
      if (line) mg.text(line, x, yy, { size, color });
    }

    if (opts.debug) window.__kmgBoss = { get G() { return G; }, mg };
    mg.loop(dt => { update(dt); draw(); });
    const result = await mg.done;
    stopMusic();
    if (result === 'win' && opts.cutscene !== false) await playKrunchemWinSequence();
    resumeGeneralMusic(wasMusic);
    return result;
  }

  // ---------- win cutscene: ported verbatim from the original (video -> epilogue text -> NEXT -> Downing St) ----------
  function playKrunchemWinSequence() {
    return new Promise(videoResolve => {
      const videoOverlay = document.createElement('div');
      videoOverlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:50000;display:flex;align-items:center;justify-content:center';
      const video = document.createElement('video');
      video.src = WIN_VIDEO; video.style.cssText = 'width:100%;height:100%;object-fit:contain';
      video.controls = false; video.loop = false; video.muted = false; video.playsInline = true;
      let errs = 0;
      video.addEventListener('error', () => {
        if (++errs < 3) { video.load(); return; }
        // video can't load: don't soft-lock — offer a skip
        if (!videoOverlay.querySelector('button')) { const b = document.createElement('button'); b.textContent = 'Skip ▶'; b.style.cssText = `position:absolute;right:16px;bottom:16px;font:600 16px ${FONT};padding:10px 16px;background:#d71920;color:#fff;border:2px solid #ff4a50;border-radius:4px`; b.onclick = () => onEnded(); videoOverlay.appendChild(b); }
      });
      videoOverlay.appendChild(video); document.body.appendChild(videoOverlay);
      video.play().catch(() => video.addEventListener('loadeddata', () => video.play().catch(() => {}), { once: true }));
      let ended = false;
      function onEnded() {
        if (ended) return; ended = true;
        videoOverlay.remove();
        const textLines = [
          'Delmor Krunchem is dead.',
          'There\'s a half-second where his eyes go wide, you let the brick fly, and then—FOOMP. Red mist. Grey matter. You hover there, dripping in brains.',
          'The Kreplin Gem is gone. Krunchem\'s last \'fuck you\'.',
          'You sigh, crack open a pint mid-hover, and adjust the jetpack.',
          '"There\'s no time to mourn…my country needs me…"',
          '________________________________________',
          'Moments later, you descend straight through the roof of 10 Downing Street. You land in the hallway, and drink some more of your lovely beer on landing.',
          'KEIR STARMER spins round. He is gob-smacked.',
          '"I c-can explain everything!" he pleads',
          '"FUCK OFF!!!! YOU SOLD OUR COUNTRY TO TERRORISTS!!! YOU WERE ABOUT TO LET MOHAMMED VAN ONSLAUGHT BECOME PRIME MINISTER!!! LUCKY FOR YOU I JUST HAD HIM BURNED TO DEATH BY A COMBAT ROBOT THAT WAS HIDDEN IN A BRIEFCASE I BOUGHT AFTER I INHERITED JUST ENOUGH LOBBY TOKENS FROM THE ESTATE OF PAUL GASCOIGNE, WHO WAS MYSTERIOUSLY MURDERED WITH A BRICK AFTER KILLING THE ENTIRE FAMILY OF DELMOR KRUNCHEM, WHO I JUST FOUGHT ON JETPACK OVER THE SKIES OF BRADFORD"',
          'Starmer blinks. Swallows. Slips straight into lawyer mode.',
          '"Well-look-these were complex situations. It\'s important to respect cultural norms. And please remember, ownership of football clubs is a human right. Sharia law is very important to marginalized communities…"',
          'You stare at him.',
          'He keeps going.',
          '"We all must examine unacknowledged white privilege, and the internalized assumptions of-"',
          'You\'ve had enough – you throw a brick at Starmer.',
          'The brick whistles past his head and smashes into a framed photo of Clement Attlee. Starmer screams in fear and ducks behind a chair with his hands up.',
          '"PLEASE! Stop! I\'ll do anything! I\'m so scared!"',
          'You finish your crisp yet juicy beer…',
          '"Well," you say, stepping closer.',
          '"there is one thing you could do…"'
        ];
        const textOverlay = document.createElement('div');
        textOverlay.style.cssText = 'position:fixed;inset:0;max-height:100vh;background:#000;z-index:50001;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;color:#fff;font-family:Arial,sans-serif;padding:30px 40px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden';
        const textContainer = document.createElement('div');
        textContainer.style.cssText = 'max-width:800px;width:100%;max-height:calc(100vh - 160px);text-align:left;font-size:18px;line-height:1.8;overflow-y:auto;flex:1 1 auto;min-height:0';
        let totalDelay = 0;
        textLines.forEach(line => {
          const d = document.createElement('div'); d.textContent = line;
          d.style.cssText = `opacity:0;margin-bottom:16px;animation:fadeInLine .6s ease-in forwards;animation-delay:${totalDelay}ms`;
          textContainer.appendChild(d); totalDelay += 800;
        });
        const style = document.createElement('style');
        style.textContent = '@keyframes fadeInLine{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
        const wrapEl = document.createElement('div');
        wrapEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;max-width:800px;max-height:calc(100vh - 60px);margin:0 auto';
        wrapEl.appendChild(textContainer);
        const next = document.createElement('button'); next.textContent = 'NEXT';
        next.style.cssText = 'margin:20px 0;padding:15px 40px;font-size:20px;font-weight:bold;background:#fff;color:#000;border:none;border-radius:5px;cursor:pointer;opacity:0;transition:opacity .5s ease-in;font-family:Arial,sans-serif;flex-shrink:0';
        setTimeout(() => { next.style.opacity = '1'; }, totalDelay + 500);
        next.addEventListener('click', async () => { textOverlay.remove(); style.remove(); if (typeof playDowningStreetVideo === 'function') await playDowningStreetVideo(); });
        wrapEl.appendChild(next); textOverlay.appendChild(wrapEl); document.body.appendChild(textOverlay);
        videoResolve();
      }
      video.addEventListener('ended', onEnded, { once: true });
    });
  }

  window.startKrunchemBossBattle = startKrunchemBossBattle;
  window.KMGBoss = { start: startKrunchemBossBattle, playKrunchemWinSequence };
})();
