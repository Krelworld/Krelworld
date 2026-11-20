/* ===================== KREPLIN — Rhythm brawler (Cronster + Portsmouth captain) =====================
   One engine, two opponents. Move cues fly along a lane into the HIT ZONE; act on the beat.
     PUNCH  = tap            (J / Space)
     KICK   = swipe up       (K / ↑)
     BLOCK  = swipe down     (L / ↓)      — red-outlined cues are the opponent attacking
     DODGE  = swipe sideways (; / ← / →)  — perfect dodge counters
   Timing grades PERFECT / GREAT / GOOD / MISS; combos multiply damage; HP race; 75s cap
   (on time-out the higher HP wins, as in the original). Wrong move or spam = combo break.

   API (all need MGKit):
     KreplinFight.brawl('cronster'|'captain', opts) -> Promise<{won, playerHealth, oppHealth}>
     KreplinFight.cronsterBrawl()      -> Promise<{playerHealth, cronsterHealth}>   (drop-in for the
                                          modal + while-loop inside cronsterFightingMinigame)
     KreplinFight.playFightMinigame()  -> Promise<'win'|'lose'>  (drop-in for src/081 playFightMinigame,
                                          including its log lines)
   Give-up (after 30s) resolves as a loss (player HP 0).
*/
(function () {
  const ART = (window.KREPLIN_ART_BASE || '../../art/raw/');
  const C = { red: '#d71920', redL: '#ff4a50', ink: '#0d1016', gold: '#f2c14e', good: '#3fbf6b', bad: '#e5484d', text: '#e9e6de', muted: '#8c93a8', blue: '#3d7bd9' };

  // ---- sfx ----
  let AC = null;
  function ac() { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
  function tone(f0, f1, dur, type = 'square', vol = 0.08) { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur); }
  function noise(dur, freq, vol = 0.15) { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(); }
  const sfx = {
    hit(big) { noise(big ? 0.22 : 0.12, big ? 900 : 1600, big ? 0.35 : 0.25); tone(big ? 160 : 220, 60, 0.12, 'square', 0.1); },
    hurt() { noise(0.25, 500, 0.3); tone(120, 50, 0.25, 'sawtooth', 0.08); },
    block() { tone(900, 700, 0.06, 'square', 0.06); noise(0.06, 4000, 0.1); },
    whoosh() { noise(0.15, 2500, 0.08); },
    tick() { tone(1200, 1200, 0.02, 'square', 0.02); },
    ko() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, f * 0.98, 0.2, 'square', 0.08), i * 140)); },
    bell() { [0, 220].forEach(d => setTimeout(() => tone(1800, 1750, 0.5, 'sine', 0.12), d)); },
    combo() { tone(660, 1320, 0.12, 'triangle', 0.08); },
  };

  const tintCache = new Map();
  function tinted(img, color) { const k = img.src + color; if (tintCache.has(k)) return tintCache.get(k);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); tintCache.set(k, c); return c; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const VARIANTS = {
    cronster: { name: 'THE CRONSTER', title: 'CRONSTER FIGHT', bpm: 96, lead: 1.55, bg: 'bg-locker.png', sprite: 'cronster', hitDmg: [11, 14], hitName: 'SQUEEZE!',
      taunts: ['LOVELY JUBBLY!', "I LIKES TO SQUEEZE 'EM!", "I'M GONNA SQUEEZE THE JUICE OUT OF YOU!", 'COME HERE, CHAIRMAN!'],
      patterns: ['P.P.', 'PPK.', 'B.P.', 'P.B.', 'D.K.', 'PP.B', 'K.D.', 'B.B.', 'P.PK', 'D.PP'] },
    captain: { name: 'POMPEY CAPTAIN', title: 'STREET FIGHT', bpm: 106, lead: 1.35, bg: 'mg-fight-bg-street.png', sprite: 'captain', hitDmg: [12, 15], hitName: 'HAYMAKER!',
      taunts: ['PLAY UP!', "YOU'RE GOING IN THE HARBOUR!", 'SCUMMER!', 'IS THAT IT, FAT LAD?'],
      patterns: ['P.P.', 'PKP.', 'B.P.', 'D.D.', 'P.BK', 'PP.D', 'K.B.', 'B.DP', 'PPK.', 'D.PB'] },
  };
  const TYPES = {
    P: { label: 'PUNCH', hint: 'TAP', col: '#f2c14e', atk: true, base: 3 },
    K: { label: 'KICK', hint: 'SWIPE UP', col: '#ff6a3a', atk: true, base: 4.5 },
    B: { label: 'BLOCK', hint: 'SWIPE DOWN', col: '#3d7bd9', atk: false },
    D: { label: 'DODGE', hint: 'SWIPE SIDE', col: '#3fbf6b', atk: false },
  };
  const GRADES = [{ n: 'PERFECT', w: 0.065, m: 1.5, c: '#f2c14e' }, { n: 'GREAT', w: 0.12, m: 1.2, c: '#5fe08f' }, { n: 'GOOD', w: 0.2, m: 1.0, c: '#e9e6de' }];
  const WIN = 0.2;

  async function brawl(which = 'cronster', opts = {}) {
    const V = VARIANTS[which] || VARIANTS.cronster;
    const mg = MGKit.open({ title: V.title, w: 180, h: 320, giveUpAfter: 30, onGiveUp: () => 'giveup' });
    await mg.load({
      bg: ART + V.bg, pIdle: ART + 'mg-fight-chairman-idle.png', pPunch: ART + 'mg-fight-chairman-punch.png', pKick: ART + 'mg-fight-chairman-kick.png', pBlock: ART + 'mg-fight-chairman-block.png',
      oIdle: ART + `mg-fight-${V.sprite}-idle.png`, oAtk: ART + `mg-fight-${V.sprite}-attack.png`, oHurt: ART + `mg-fight-${V.sprite}-hurt.png`,
    });
    const { ctx, W, H, input, text, particles: P } = mg;
    const g = { phase: 'intro', t: 0, song: 0, php: 100, ohp: 100, combo: 0, best: 0, cues: [], nextBar: 0, bpm: V.bpm, angry: false, lock: 0,
      pPose: 'idle', pT: 0, oPose: 'idle', oT: 0, pFlash: 0, oFlash: 0, popups: [], grade: null, gradeT: 0, taunt: '', tauntT: 0, ko: null, endT: 0, limit: 75, lastBeat: -1, stats: { perfect: 0, miss: 0 } };
    brawl._debug = g;
    const beatLen = () => 60 / g.bpm;
    const PX = 28, OX = 90, FLOOR = 192, ZONE = 30, LANE_Y = 236;

    function scheduleBars() { // keep ~2 bars of cues ahead
      while (g.nextBar < g.song + V.lead + 3) {
        const pat = g.nextBar < 1 ? 'P.P.' : V.patterns[Math.floor(Math.random() * V.patterns.length)];
        const bl = beatLen();
        for (let i = 0; i < 4; i++) if (pat[i] !== '.') g.cues.push({ type: pat[i], t: g.nextBar + i * bl, done: false });
        g.nextBar += bl * 4;
      }
    }
    function popup(str, x, y, col, size = 10) { g.popups.push({ str, x, y, col, size, t: 0 }); }
    function sparks(x, y, n, cols, spd = 90) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random()); P.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: cols[i % cols.length], size: 2, life: 0.35 + Math.random() * 0.3 }); } }
    function blood(x, y, n) { for (let i = 0; i < n; i++) P.spawn({ x, y, vx: 20 + Math.random() * 80, vy: -40 - Math.random() * 60, g: 260, color: i % 3 ? '#c4121a' : '#ff3b3b', size: i % 4 ? 2 : 3, life: 0.7 }); }
    function setGrade(gr) { g.grade = gr; g.gradeT = 0.6; }
    function hurtPlayer(d, label) {
      g.php = Math.max(0, g.php - d); g.combo = 0; g.pPose = 'hurt'; g.pT = 0.3; g.pFlash = 0.12; g.oPose = 'atk'; g.oT = 0.25;
      mg.shake(4, 0.25); mg.flash('#ff0000', 0.15); sfx.hurt(); popup('-' + d, PX + 30, 120, C.redL, 11); if (label) popup(label, PX + 32, 104, '#fff', 9); blood(PX + 40, 130, 6);
    }
    function hurtOpp(d, big, grade) {
      g.ohp = Math.max(0, g.ohp - d); g.oPose = 'hurt'; g.oT = 0.3; g.oFlash = 0.1; sfx.hit(big); mg.shake(big ? 4 : 2, big ? 0.2 : 0.1);
      popup('-' + d, OX + 34, 110, grade.c, big ? 13 : 11); sparks(OX + 18, big ? 150 : 128, big ? 14 : 8, ['#fff', C.gold, '#ffe9a0']);
      if (big || grade.n === 'PERFECT') blood(OX + 24, 130, big ? 8 : 4);
    }
    function resolveCue(cue, action, dt) {
      cue.done = true; const T = TYPES[cue.type];
      if (action !== cue.type) { miss(cue, 'WRONG MOVE'); return; }
      const ad = Math.abs(dt), gr = GRADES.find(x => ad <= x.w) || GRADES[2];
      g.combo++; g.best = Math.max(g.best, g.combo); if (gr.n === 'PERFECT') g.stats.perfect++;
      if (g.combo % 10 === 0) { sfx.combo(); mg.banner(g.combo + ' COMBO!', C.gold, 0.8); }
      setGrade(gr);
      const cm = 1 + Math.min(g.combo, 20) * 0.03;
      if (T.atk) {
        g.pPose = cue.type === 'K' ? 'kick' : 'punch'; g.pT = 0.22;
        hurtOpp(Math.round(T.base * gr.m * cm), cue.type === 'K', gr);
      } else if (cue.type === 'B') {
        g.pPose = 'block'; g.pT = 0.3; g.oPose = 'atk'; g.oT = 0.25; sfx.block(); sparks(PX + 46, 138, 8, ['#9fd0ff', '#fff'], 70);
        const chip = gr.n === 'PERFECT' ? 0 : gr.n === 'GREAT' ? 1 : 3; if (chip) { g.php = Math.max(0, g.php - chip); popup('-' + chip, PX + 30, 120, '#9fd0ff', 9); }
        popup('BLOCKED', PX + 32, 104, '#9fd0ff', 9);
      } else {
        g.pPose = 'dodge'; g.pT = 0.35; g.oPose = 'atk'; g.oT = 0.3; sfx.whoosh(); popup('DODGED', PX + 32, 104, '#7dffa8', 9);
        if (gr.n === 'PERFECT') { setTimeout(() => { if (g.phase === 'fight') { g.pPose = 'punch'; g.pT = 0.2; hurtOpp(4, false, gr); popup('COUNTER!', OX + 30, 96, C.gold, 9); } }, 180); }
      }
    }
    function miss(cue, why) {
      g.stats.miss++; setGrade({ n: 'MISS', c: C.redL });
      if (TYPES[cue.type].atk) hurtPlayer(4, why || 'TOO SLOW');
      else hurtPlayer(V.hitDmg[0] + Math.floor(Math.random() * (V.hitDmg[1] - V.hitDmg[0] + 1)), V.hitName);
    }
    function act(action, when) {
      if (g.phase !== 'fight' || g.lock > 0) return;
      ac();
      let best = null, bd = 1e9;
      for (const c of g.cues) if (!c.done) { const d = when - c.t; if (Math.abs(d) <= WIN && Math.abs(d) < Math.abs(bd)) { best = c; bd = d; } }
      if (best) resolveCue(best, action, bd);
      else { // whiff: swing at air, break combo, short lockout
        g.combo = 0; g.lock = 0.22; setGrade({ n: 'WHIFF', c: C.muted });
        g.pPose = action === 'K' ? 'kick' : action === 'P' ? 'punch' : action === 'B' ? 'block' : 'dodge'; g.pT = 0.2; sfx.whoosh();
      }
    }
    function readInput() {
      const now = g.song;
      if (input.tap) act('P', now);
      if (input.swipe) { const s = input.swipe, adj = now - Math.min(s.ms, 200) / 2000;
        if (Math.abs(s.dy) > Math.abs(s.dx) * 1.1) act(s.dy < 0 ? 'K' : 'B', adj); else act('D', adj); }
      const k = (...ks) => ks.some(x => input.keyPressed(x));
      if (k('j', 'J', ' ')) act('P', now); if (k('k', 'K', 'ArrowUp')) act('K', now);
      if (k('l', 'L', 'ArrowDown')) act('B', now); if (k(';', 'ArrowLeft', 'ArrowRight')) act('D', now);
    }

    // ---------- draw ----------
    function drawBg() {
      const img = mg.sprites.bg; const ah = 168, top = 26;
      if (img) { const s = ah / img.height, w = img.width * s; ctx.drawImage(img, Math.round((W - w) / 2), top, Math.round(w), ah); }
      else { ctx.fillStyle = '#242a3a'; ctx.fillRect(0, top, W, ah); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, top, W, ah);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(PX + 32, FLOOR, 22, 4, 0, 0, Math.PI * 2); ctx.ellipse(OX + 32, FLOOR, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    function drawFighters(T) {
      const S = mg.sprites;
      // player
      let img = S.pIdle, dx = 0, dy = 0;
      if (g.pPose === 'punch') { img = S.pPunch; dx = 8; } else if (g.pPose === 'kick') { img = S.pKick; dx = 10; } else if (g.pPose === 'block') { img = S.pBlock; dx = -2; }
      else if (g.pPose === 'dodge') { dx = -16; dy = 2; } else if (g.pPose === 'hurt') { dx = -8; }
      else dy = Math.round(Math.sin(T * g.bpm / 60 * Math.PI * 2) * 1);
      let ko = g.ko === 'player';
      if (img) {
        if (g.pPose === 'dodge') { ctx.globalAlpha = 0.35; ctx.drawImage(tinted(img, '#7dffa8'), PX, FLOOR - 62); ctx.globalAlpha = 1; }
        ctx.save(); ctx.translate(PX + dx + 32, FLOOR + dy); if (ko) ctx.rotate(-Math.min(1, g.endT * 2) * Math.PI / 2);
        ctx.drawImage(img, -32, -62); if (g.pFlash > 0) ctx.drawImage(tinted(img, '#ff2020'), -32, -62); ctx.restore();
      }
      // opponent (tell: leans back before attacking)
      let oimg = S.oIdle, ox = 0, oy = 0; const soon = g.cues.find(c => !c.done && !TYPES[c.type].atk && c.t - g.song < 0.45 && c.t - g.song > 0);
      if (g.oPose === 'hurt') { oimg = S.oHurt || S.oIdle; ox = 10; }
      else if (g.oPose === 'atk') { oimg = S.oAtk || S.oIdle; ox = -14; }
      else if (soon && g.phase === 'fight') { oimg = S.oAtk || S.oIdle; ox = 6 + Math.round((Math.random() - .5) * 2); }
      else oy = Math.round(Math.sin(T * g.bpm / 60 * Math.PI * 2 + 1) * 1);
      ko = g.ko === 'opp';
      if (oimg) { ctx.save(); ctx.translate(OX + ox + 32, FLOOR + oy); if (ko) ctx.rotate(Math.min(1, g.endT * 2) * Math.PI / 2);
        ctx.drawImage(oimg, -32, -62); if (g.oFlash > 0) ctx.drawImage(tinted(oimg, '#ffffff'), -32, -62);
        if (soon && g.oPose === 'idle' && Math.floor(T * 12) % 2) { ctx.globalAlpha = 0.35; ctx.drawImage(tinted(oimg, '#ff0000'), -32, -62); ctx.globalAlpha = 1; }
        ctx.restore(); }
    }
    function bar(x, y, w, v, col, rtl) {
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 8); ctx.fillStyle = '#3a1013'; ctx.fillRect(x, y, w, 6);
      const fw = Math.round(w * v / 100); ctx.fillStyle = v > 50 ? col : v > 25 ? '#f29b2e' : C.bad; ctx.fillRect(rtl ? x + w - fw : x, y, fw, 6);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(rtl ? x + w - fw : x, y, fw, 1);
    }
    function drawHud() {
      ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, 26);
      text('CHAIRMAN', 4, 7, { size: 8, align: 'left', color: C.text }); text(V.name, W - 4, 7, { size: 8, align: 'right', color: C.text });
      bar(4, 14, 72, g.php, C.good, false); bar(W - 76, 14, 72, g.ohp, C.good, true);
      const left = Math.max(0, g.limit - g.song); text(String(Math.ceil(left)), W / 2, 13, { size: 12, color: left < 10 ? C.redL : C.gold });
      if (g.combo >= 3) text('x' + g.combo, W / 2, 36, { size: 10 + Math.min(6, g.combo / 5), color: C.gold });
    }
    function drawLane(T) {
      const y0 = 214, h = 44;
      ctx.fillStyle = '#0a0c11'; ctx.fillRect(0, y0, W, h); ctx.fillStyle = '#161a24'; ctx.fillRect(0, LANE_Y - 12, W, 24);
      // beat ticks scrolling
      const bl = beatLen(), pxs = (W - ZONE) / V.lead;
      const first = Math.floor(g.song / bl);
      for (let b = first; b < first + 12; b++) { const x = ZONE + (b * bl - g.song) * pxs; if (x > W) break; if (x > 0) { ctx.fillStyle = b % 4 ? '#232838' : '#343b52'; ctx.fillRect(Math.round(x), LANE_Y - 12, 1, 24); } }
      // hit zone
      const ph = (g.song / bl) % 1, pulse = ph < 0.15 ? 1 : 0;
      ctx.strokeStyle = pulse ? '#fff' : '#8c93a8'; ctx.lineWidth = 2; ctx.strokeRect(ZONE - 13 - pulse, LANE_Y - 13 - pulse, 26 + pulse * 2, 26 + pulse * 2);
      // cues
      let next = null;
      for (const c of g.cues) {
        if (c.done) continue; const x = ZONE + (c.t - g.song) * pxs; if (x > W + 12) continue;
        if (!next) next = c; drawCue(c, x, LANE_Y, T);
      }
      // grade
      if (g.gradeT > 0 && g.grade) text(g.grade.n, ZONE + 52, y0 + 6, { size: 9, color: g.grade.c });
      if (next) { const T2 = TYPES[next.type]; text((T2.atk ? '' : 'INCOMING! ') + T2.label + ' · ' + T2.hint, W / 2 + 12, y0 + h - 4, { size: 7, color: T2.atk ? C.text : C.redL, bold: false }); }
    }
    function drawCue(c, x, y, T) {
      const Tt = TYPES[c.type], X = Math.round(x), s = 10;
      if (!Tt.atk) { ctx.fillStyle = Math.floor(T * 10) % 2 ? C.red : '#fff'; ctx.fillRect(X - s - 2, y - s - 2, s * 2 + 4, s * 2 + 4); }
      ctx.fillStyle = '#000'; ctx.fillRect(X - s, y - s + 1, s * 2, s * 2); ctx.fillStyle = Tt.col; ctx.fillRect(X - s, y - s, s * 2, s * 2 - 1);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(X - s, y - s, s * 2, 2);
      ctx.fillStyle = '#0d1016';
      if (c.type === 'P') { ctx.fillRect(X - 4, y - 4, 8, 8); ctx.fillStyle = Tt.col; ctx.fillRect(X - 2, y - 2, 4, 4); }
      else if (c.type === 'K') { for (let i = 0; i < 6; i++) ctx.fillRect(X - i, y - 5 + i, i * 2 + 1, 1); ctx.fillRect(X - 1, y + 1, 3, 5); }
      else if (c.type === 'B') { for (let i = 0; i < 6; i++) ctx.fillRect(X - i, y + 5 - i, i * 2 + 1, 1); ctx.fillRect(X - 1, y - 6, 3, 5); }
      else { ctx.fillRect(X - 6, y - 1, 13, 3); for (let i = 0; i < 4; i++) { ctx.fillRect(X - 6 + i, y - i, 1, i * 2 + 1); ctx.fillRect(X + 6 - i, y - i, 1, i * 2 + 1); } }
    }
    function drawLegend() {
      const y = 262, items = [['P', 'TAP', 'J'], ['K', 'SWIPE ↑', 'K'], ['B', 'SWIPE ↓', 'L'], ['D', 'SWIPE ↔', ';']];
      ctx.fillStyle = C.ink; ctx.fillRect(0, y, W, H - y);
      items.forEach(([t, h, k], i) => { const x = 4 + i * 44; ctx.fillStyle = '#1d2230'; ctx.fillRect(x, y + 4, 40, 50); ctx.fillStyle = TYPES[t].col; ctx.fillRect(x, y + 4, 40, 3);
        text(TYPES[t].label, x + 20, y + 16, { size: 8, color: TYPES[t].col }); text(h, x + 20, y + 30, { size: 7, bold: false }); text('key ' + k, x + 20, y + 44, { size: 7, color: C.muted, bold: false }); });
    }

    mg.loop((dt, T) => {
      g.t += dt;
      if (g.phase === 'intro') {
        if (g.t > 0.01 && g.lastBeat < 0) { g.lastBeat = 0; sfx.bell(); }
        if (g.t > 1.8) { g.phase = 'fight'; g.song = 0; g.nextBar = V.lead + 0.2; scheduleBars(); g.taunt = V.taunts[0]; g.tauntT = 1.6; }
      } else if (g.phase === 'fight') {
        g.song += dt; g.lock = Math.max(0, g.lock - dt);
        scheduleBars(); readInput();
        for (const c of g.cues) if (!c.done && g.song - c.t > WIN) { c.done = true; miss(c); }
        g.cues = g.cues.filter(c => !c.done || g.song - c.t < 1);
        const b = Math.floor(g.song / beatLen()); if (b !== g.lastBeat) { g.lastBeat = b; sfx.tick(); }
        if (!g.angry && g.ohp < 50) { g.angry = true; g.bpm = Math.round(V.bpm * 1.12); mg.banner("HE'S FUMING!", C.redL, 1); g.taunt = V.taunts[2]; g.tauntT = 1.8; }
        if (Math.random() < dt / 7 && g.tauntT <= 0) { g.taunt = V.taunts[Math.floor(Math.random() * V.taunts.length)]; g.tauntT = 1.6; }
        if (g.php <= 0 || g.ohp <= 0 || g.song >= g.limit) {
          g.phase = 'end'; g.endT = 0;
          if (g.php <= 0) { g.ko = 'player'; mg.banner('K.O.!', C.redL, 1.8); sfx.ko(); }
          else if (g.ohp <= 0) { g.ko = 'opp'; mg.banner('K.O.!', C.gold, 1.8); sfx.ko(); blood(OX + 30, 130, 20); mg.flash('#fff', 0.3); }
          else { mg.banner('TIME!', C.gold, 1.8); sfx.bell(); }
        }
      } else if (g.phase === 'end') {
        g.endT += dt; if (g.endT > 2.2) { mg.end(g.php > g.ohp ? 'win' : 'lose'); return; }
      }
      g.pT -= dt; if (g.pT <= 0 && g.pPose !== 'idle') g.pPose = 'idle'; g.oT -= dt; if (g.oT <= 0 && g.oPose !== 'idle') g.oPose = 'idle';
      g.pFlash -= dt; g.oFlash -= dt; g.gradeT -= dt; g.tauntT -= dt;

      drawBg(); drawFighters(T); drawHud(); drawLane(T); drawLegend();
      if (g.tauntT > 0 && g.taunt) { ctx.font = 'bold 8px "Pixelify Sans", monospace'; const w = Math.min(170, ctx.measureText(g.taunt).width + 10), x = clamp(OX + 36 - w / 2, 4, W - w - 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, 46, w, 14); ctx.fillRect(OX + 30, 60, 4, 4); text(g.taunt, x + w / 2, 53, { size: 8, color: '#000', shadow: false }); }
      for (let i = g.popups.length - 1; i >= 0; i--) { const p = g.popups[i]; p.t += dt; if (p.t > 0.8) { g.popups.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - p.t / 0.8; text(p.str, p.x, p.y - p.t * 30, { size: p.size, color: p.col }); ctx.globalAlpha = 1; }
      if (g.phase === 'intro') { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 90, W, 50); text(g.t < 1 ? 'ROUND 1' : 'FIGHT!', W / 2, 108, { size: 20, color: g.t < 1 ? C.gold : C.redL }); text('Hit the moves as they reach the box', W / 2, 128, { size: 7, bold: false }); }
    });

    const r = await mg.done;
    if (r === 'giveup') g.php = 0;
    const res = { won: g.php > g.ohp, playerHealth: Math.round(g.php), oppHealth: Math.round(g.ohp), bestCombo: g.best };
    return res;
  }

  // Drop-in for the fight core inside cronsterFightingMinigame (src/019). Same variable names.
  async function cronsterBrawl() { const r = await brawl('cronster'); return { playerHealth: r.playerHealth, cronsterHealth: r.oppHealth }; }

  // Drop-in for src/081 playFightMinigame(): same log lines, returns 'win' | 'lose'.
  async function playFightMinigame() {
    const L = typeof window.log === 'function' ? window.log : () => {};
    L(''); L('⚔️ FIGHT MINIGAME: Press the buttons as they appear!');
    const r = await brawl('captain');
    L('');
    if (r.playerHealth <= 0) L('💀 You are knocked out!'); else if (r.oppHealth <= 0) L('💀 The captain is knocked out!'); else L('⏱️ Time runs out!');
    return r.playerHealth > r.oppHealth ? 'win' : 'lose';
  }

  window.KreplinFight = { brawl, cronsterBrawl, playFightMinigame, get debug() { return brawl._debug; } };
})();
