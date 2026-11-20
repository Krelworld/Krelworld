/* ===================== DRIVING: pick up daughter -> St Mary's (MGKit) =====================
   Drop-in replacement for startDrivingMinigame() in src/024-ultima-cup-epilogue-saints-win-refused-t.js:1584.

   Contract (same as the original):
   - returns a Promise; callers do startDrivingMinigame().then(...) / .catch(...)
   - pauses general music, plays drive.mp3 (woodland.mp3 during a burial)
   - WIN  -> "YOU MADE IT!" card -> tap -> stop minigame music, resume general music,
             await showKreplinProtocolUI() -> resolve
   - LOSS -> "NUCLEAR ARMAGEDDON!" card with RESTART MINI GAME (restarts in place, no recursion).
             After 3 losses the restart gives +10 s ("Sat-nav says shortcut").
   - GIVE UP (MGKit button, appears after 2 losses): the original had no lose outcome (restart forever),
             so give-up falls through to the same story path as a win: showKreplinProtocolUI() -> resolve.
             (Override with opts.onGiveUp = 'resolve' to just resolve without the Protocol.)
   - no S fields touched (same as the original); writes the same log() lines when log() exists.
   - resolves with 'win' | 'giveup' (original resolved undefined; callers ignore the value).

   Options: { music:false, art:'…/art/raw/', debug:true, onGiveUp:'protocol'|'resolve' }
   Gameplay: portrait scrolling road, auto-accelerates. Drag/swipe or ←/→ (A/D) to change lane.
   HORN (Space/H) scares critters off the road (hedgehogs curl up and roll away). BEER (B/↑) = 5 s boost,
   10 s cooldown. Roadkill = 2 s pixel-grave vignette + 4 s penalty. Stop at Strip University for your
   daughter, then reach St Mary's before the 45 s nuclear clock (ticks at 1.2x, like the original) hits zero.
*/
(function () {
  const W = 180, H = 320;
  const DRIVE_MUSIC = 'https://www.dropbox.com/scl/fi/oopdvy9ds0jn8ggvinajg/drive.mp3?rlkey=dhwb05jlasu8lbydyeo2q1i1b&st=4vn3xtsa&dl=1';
  const WOOD_MUSIC = 'https://www.dropbox.com/scl/fi/orbq7amtkghp0oz63ojou/woodland.mp3?rlkey=liynvhguurwrwooskhtlw3pg4&st=lnnjai4c&dl=1';
  const ROAD_L = 40, ROAD_R = 140, LANES = [56, 90, 124], CAR_Y = 236;
  const D_UNI = 1400, D_END = 3000, CRUISE = 95, BOOST = 150;
  const CRITTERS = { squirrel: { r: 7, spd: 46 }, rabbit: { r: 7, spd: 40 }, hedgehog: { r: 7, spd: 14 }, badger: { r: 10, spd: 20 } };
  const _log = m => { try { if (typeof log === 'function') log(m); } catch (e) {} };

  const sfx = MGKit.sfx;
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

  async function startDrivingMinigame(opts = {}) {
    const art = opts.art || window.KMG_ART || 'art/raw/';
    const wasMusic = pauseGeneralMusic();
    let drive = null, wood = null;
    if (opts.music !== false) {
      try { drive = new Audio(DRIVE_MUSIC); drive.loop = true; drive.volume = 0.7; drive.play().catch(() => {});
        wood = new Audio(WOOD_MUSIC); wood.loop = false; wood.volume = 0.7; } catch (e) {}
    }
    const stopMusic = () => { for (const a of [drive, wood]) if (a) { a.pause(); a.currentTime = 0; } };

    const mg = MGKit.open({ title: 'GET TO ST MARY\'S', w: W, h: H, giveUpAfterFails: 2, giveUpLabel: 'Run for it', onGiveUp: () => 'giveup', auto: () => (Math.random() < .8 ? 'win' : 'giveup') });
    await mg.load({ car: art + 'mg-drive-car.png', squirrel: art + 'mg-drive-squirrel.png', rabbit: art + 'mg-drive-rabbit.png',
      hedgehog: art + 'mg-drive-hedgehog.png', badger: art + 'mg-drive-badger.png', grave: art + 'mg-drive-grave.png',
      tree: art + 'mg-drive-tree.png', daughter: art + 'daughter.png', stadium: art + 'stadium.png' });
    const SP = mg.sprites, ctx = mg.ctx, inp = mg.input;

    let G, losses = 0;
    function reset() {
      G = {
        state: 'intro', t: 0, d: 0, v: 0, x: LANES[1], lane: 1, tilt: 0, timer: 45 + (losses >= 3 ? 10 : 0),
        boost: 0, cool: 0, horn: 0, hornFx: 0, critters: [], nextCritter: 260, hit: 0, picked: false, stop: 0,
        grave: null, popup: null, nuke: 0, drag: false, finish: false, pickupSaid: false,
        trees: Array.from({ length: 30 }, (_, i) => ({ wy: i * 34 + Math.random() * 20, x: Math.random() < 0.5 ? 6 + Math.random() * 18 : 156 + Math.random() * 18, s: 0.7 + Math.random() * 0.4 })),
      };
    }
    reset();
    const scrY = wy => CAR_Y - (wy - G.d);

    function spawnCritter() {
      const types = Object.keys(CRITTERS); const type = types[Math.floor(Math.random() * types.length)];
      const fromLeft = Math.random() < 0.5;
      // most cross the road; badgers and some hedgehogs just sit in a lane
      const sitter = type === 'badger' || (type === 'hedgehog' && Math.random() < 0.4);
      const x = sitter ? LANES[Math.floor(Math.random() * 3)] + (Math.random() - .5) * 8 : (fromLeft ? ROAD_L - 6 : ROAD_R + 6);
      G.critters.push({ type, x, wy: G.d + 340, dir: fromLeft ? 1 : -1, sitter, state: 'walk', t: Math.random(), flee: 0, curled: false });
    }
    function honk() {
      if (G.horn > 0) return; G.horn = 0.9; G.hornFx = 0.5;
      sfx('square', 392, 380, 0.22, 0.15); sfx('square', 494, 480, 0.22, 0.12);
      let scared = 0;
      for (const c of G.critters) {
        const sy = scrY(c.wy);
        if (c.flee || sy < -30 || sy > CAR_Y + 10) continue;
        c.flee = c.x < (ROAD_L + ROAD_R) / 2 ? -1 : 1; scared++;
        if (c.type === 'hedgehog') c.curled = true;
        c.alert = 0.5;
      }
      G.popup = { txt: scared ? 'HONK! SCARPER!' : 'HONK!', y: CAR_Y - 40, t: 0.7, col: '#f2c14e' };
    }
    function beer() {
      if (G.cool > 0 || G.state !== 'drive') return;
      G.boost = 5; G.cool = 10; mg.banner('BEER! (FOR CONFIDENCE)', '#f2c14e', 0.9); sfx('sine', 300, 120, 0.15, 0.2); setTimeout(() => sfx('sine', 260, 100, 0.2, 0.2), 140);
      _log('You chug a beer for confidence! Speed boost activated!');
    }
    function roadkill(c) {
      G.hit++; G.v = 0; G.state = 'grave'; G.grave = { type: c.type, t: 0 };
      mg.shake(6, 0.3); mg.flash('#f00', 0.3); sfx('sawtooth', 160, 40, 0.3, 0.3);
      for (let i = 0; i < 20; i++) mg.particles.spawn({ x: c.x, y: scrY(c.wy), vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, life: .5, color: i % 2 ? '#8a5a3a' : '#c33', size: 2 });
      if (drive) drive.pause(); if (wood) { wood.currentTime = 0; wood.play().catch(() => {}); }
    }
    function endGrave() {
      const type = G.grave.type; G.grave = null; G.state = 'drive';
      G.timer = Math.max(0, G.timer - 4);
      G.popup = { txt: '-4s  (RIP ' + type + ')', y: 70, t: 1.3, col: '#e5484d' };
      _log(`You took the time to properly bury the ${type}. It's the right thing to do. (-4 seconds)`);
      if (wood) wood.pause(); if (drive) drive.play().catch(() => {});
    }

    // ---------------- update ----------------
    function update(dt) {
      G.t += dt;
      if (G.popup) { G.popup.t -= dt; G.popup.y -= 12 * dt; if (G.popup.t <= 0) G.popup = null; }
      if (G.hornFx > 0) G.hornFx -= dt; if (G.horn > 0) G.horn -= dt;
      if (G.state === 'intro') { if (G.t > 2.2) { G.state = 'drive'; mg.banner('FLOOR IT!', '#f2c14e', 0.8); sfx('square', 200, 500, 0.3, 0.12); } return; }
      if (G.state === 'grave') { G.grave.t += dt; if (G.grave.t >= 2) endGrave(); return; }
      if (G.state === 'won' || G.state === 'lost') { endInput(); if (G.state === 'lost') G.nuke += dt; return; }

      // nuclear clock (1.2x like the original); paused during the burial vignette
      if (G.state === 'drive' || G.state === 'pickup') {
        G.timer -= dt * 1.2;
        if (G.timer <= 0) { G.timer = 0; G.state = 'lost'; G.t = 0; losses++; mg.fail(); mg.flash('#fff', 1.2); mg.shake(8, 1.2); sfx('sawtooth', 80, 20, 2, 0.4); stopMusic(); return; }
      }
      // input: buttons
      const inBtn = y => y >= 288;
      if (inp.pressed && inBtn(inp.y)) { if (inp.x < 90) honk(); else beer(); }
      if (inp.keyPressed(' ') || inp.keyPressed('h') || inp.keyPressed('H')) honk();
      if (inp.keyPressed('b') || inp.keyPressed('B') || inp.keyPressed('ArrowUp') || inp.keyPressed('w') || inp.keyPressed('W')) beer();
      // steering
      if (inp.pressed && !inBtn(inp.y)) G.drag = { off: G.x - inp.x, lane: nearestLane(G.x) };
      if (!inp.down && G.drag) {
        const sw = inp.swipe;
        if (sw && Math.abs(sw.dx) > Math.abs(sw.dy) && sw.ms < 260 && Math.abs(sw.dx) < 50) { const d = G.drag; G.lane = Math.max(0, Math.min(2, d.lane + Math.sign(sw.dx))); }
        else G.lane = nearestLane(G.x);
        G.drag = false;
      }
      if (inp.keyPressed('ArrowLeft') || inp.keyPressed('a') || inp.keyPressed('A')) G.lane = Math.max(0, G.lane - 1);
      if (inp.keyPressed('ArrowRight') || inp.keyPressed('d') || inp.keyPressed('D')) G.lane = Math.min(2, G.lane + 1);
      const tx = G.drag && inp.down ? Math.max(ROAD_L + 10, Math.min(ROAD_R - 10, inp.x + G.drag.off)) : LANES[G.lane];
      const ox = G.x; G.x += (tx - G.x) * Math.min(1, dt * 9);
      G.tilt += (((G.x - ox) / dt) / 300 - G.tilt) * Math.min(1, dt * 8);

      // speed
      if (G.boost > 0) G.boost -= dt; if (G.cool > 0) G.cool -= dt;
      let target = G.boost > 0 ? BOOST : CRUISE;
      if (G.state === 'pickup') target = 0;
      if (!G.picked && G.d > D_UNI - 140 && G.state === 'drive') { G.state = 'pickup'; G.stop = 0; mg.banner('STRIP UNIVERSITY', '#ff6bd6', 1.0); }
      const acc = target > G.v ? 70 : 160;
      G.v += Math.sign(target - G.v) * Math.min(Math.abs(target - G.v), acc * dt);
      G.d += G.v * dt;
      if (G.state === 'pickup') {
        if (G.v < 2) { G.stop += dt; if (G.stop > 0.2 && G.stop < 0.25) { sfx('sine', 660, 990, .15, .15); } }
        if (G.stop > 1.3) {
          G.picked = true; G.state = 'drive'; mg.banner('DAUGHTER ACQUIRED!', '#3fbf6b', 1.2); mg.shake(2, .2);
          _log("You've picked up your daughter from Strip University! Now get to St Mary's Stadium!");
          G.popup = { txt: '"Dad, why is the sky orange?"', y: CAR_Y - 50, t: 2, col: '#f4f1ea' };
        }
      }
      if (G.d >= D_END) {
        G.d = D_END; G.state = 'won'; G.t = 0; mg.flash('#fff', .3); sfx('square', 523, 1046, 0.4, 0.15);
        for (let i = 0; i < 50; i++) mg.particles.spawn({ x: 90, y: 120, vx: (Math.random() - .5) * 160, vy: -Math.random() * 120, g: 140, life: 1.4, color: ['#d71920', '#fff', '#f2c14e'][i % 3], size: 2 });
        _log("You've reached St Mary's Stadium! You made it in time!"); stopMusic(); return;
      }

      // critters
      if (G.d + 340 > G.nextCritter && G.nextCritter < D_END - 200 && Math.abs(G.nextCritter - D_UNI) > 120) { spawnCritter(); G.nextCritter += 150 + Math.random() * 130; }
      else if (G.d + 340 > G.nextCritter) G.nextCritter += 100;
      for (let i = G.critters.length - 1; i >= 0; i--) {
        const c = G.critters[i]; c.t += dt; if (c.alert > 0) c.alert -= dt;
        const def = CRITTERS[c.type];
        if (c.flee) c.x += c.flee * (c.type === 'hedgehog' ? 75 : c.type === 'badger' ? 55 : 110) * dt;
        else if (!c.sitter) {
          if (c.type === 'squirrel') { const ph = c.t % 1.4; if (ph < 0.9) c.x += c.dir * def.spd * dt; }          // dart … freeze
          else if (c.type === 'rabbit') { const ph = c.t % 0.6; if (ph < 0.25) c.x += c.dir * def.spd * 2.4 * dt; } // hop hop
          else c.x += c.dir * def.spd * dt;
        }
        const sy = scrY(c.wy);
        if (sy > H + 30 || c.x < -20 || c.x > W + 20) { G.critters.splice(i, 1); continue; }
        // collision (only on tarmac, only when moving)
        if (G.v > 25 && c.x > ROAD_L - 2 && c.x < ROAD_R + 2 && Math.abs(c.x - G.x) < 9 + def.r && Math.abs(sy - CAR_Y) < 18 + def.r * 0.5) { G.critters.splice(i, 1); roadkill(c); return; }
      }
    }
    const nearestLane = x => { let b = 0; LANES.forEach((l, i) => { if (Math.abs(l - x) < Math.abs(LANES[b] - x)) b = i; }); return b; };

    function endInput() {
      if (G.t < 0.8) return;
      const go = inp.pressed || inp.keyPressed('Enter') || inp.keyPressed(' ');
      if (G.state === 'won' && go) mg.end('win');
      if (G.state === 'lost') {
        const b = { x: 30, y: 230, w: 120, h: 26 };
        if (inp.keyPressed('r') || inp.keyPressed('R') || inp.keyPressed('Enter') || (inp.pressed && inp.x >= b.x && inp.x <= b.x + b.w && inp.y >= b.y && inp.y <= b.y + b.h)) {
          reset(); if (drive) { drive.currentTime = 0; drive.play().catch(() => {}); }
        }
      }
    }

    // ---------------- draw ----------------
    function draw() {
      const sway = G.boost > 0 ? Math.sin(G.t * 5) * 2 : 0; // beer wobble
      ctx.save(); ctx.translate(Math.round(sway), 0);
      // grass
      ctx.fillStyle = '#2f6b33'; ctx.fillRect(-4, 0, W + 8, H);
      ctx.fillStyle = '#285c2c'; for (let y = -((G.d * 1) % 16); y < H; y += 16) { ctx.fillRect(0, Math.round(y), 36, 8); ctx.fillRect(144, Math.round(y + 8), 36, 8); }
      // road
      ctx.fillStyle = '#3a3d46'; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(ROAD_L, 0, 2, H); ctx.fillRect(ROAD_R - 2, 0, 2, H);
      ctx.fillStyle = '#d9d2b8';
      for (let y = -((G.d) % 28); y < H; y += 28) { ctx.fillRect(72, Math.round(y), 2, 14); ctx.fillRect(106, Math.round(y), 2, 14); }
      // start: Houses of Parliament gate
      const sy0 = scrY(0) + 30; if (sy0 < H + 40) { ctx.fillStyle = '#8a7f66'; ctx.fillRect(0, sy0, W, 24); for (let x = 4; x < W; x += 12) ctx.fillRect(x, sy0 - 10, 6, 10); mg.text('HOUSES OF PARLIAMENT', 90, sy0 + 12, { size: 8, color: '#f4f1ea' }); }
      // trees (loop)
      for (const tr of G.trees) { let y = scrY(tr.wy); const span = 30 * 34; while (y > H + 20) { tr.wy += span; y = scrY(tr.wy); }
        if (SP.tree && y > -30) ctx.drawImage(SP.tree, Math.round(tr.x - 16 * tr.s), Math.round(y - 16 * tr.s), Math.round(32 * tr.s), Math.round(32 * tr.s)); }
      // Strip University
      const uy = scrY(D_UNI);
      if (uy > -80 && uy < H + 60) {
        ctx.fillStyle = '#4a1d3f'; ctx.fillRect(144, uy - 60, 36, 56); ctx.fillStyle = '#ff6bd6';
        for (let i = 0; i < 4; i++) ctx.fillRect(148 + (i % 2) * 16, uy - 54 + Math.floor(i / 2) * 18, 10, 10);
        ctx.fillStyle = Math.floor(G.t * 4) % 2 ? '#ff6bd6' : '#ffd1f4'; ctx.fillRect(140, uy - 70, 40, 10);
        mg.text('STRIP UNI', 160, uy - 65, { size: 7, color: '#2a0a20', shadow: false });
        ctx.fillStyle = '#ccc'; ctx.fillRect(ROAD_R, uy - 4, 4, 4); // kerb
        if (!G.picked && SP.daughter) { const bob = Math.abs(Math.sin(G.t * 6)) * 3; ctx.fillStyle = '#000'; ctx.fillRect(145, uy - 22 - bob, 22, 22); ctx.drawImage(SP.daughter, 146, uy - 21 - bob, 20, 20); if (Math.floor(G.t * 3) % 2) mg.text('DAD!', 156, uy - 30 - bob, { size: 7, color: '#ff6bd6' }); }
      }
      // St Mary's at the end
      const ey = scrY(D_END);
      if (ey > -10 && SP.stadium) { ctx.drawImage(SP.stadium, 0, 0, 384, 216, -20, Math.round(ey - 120), 220, 124); ctx.fillStyle = '#f4f1ea'; for (let x = ROAD_L; x < ROAD_R; x += 8) { ctx.fillRect(x, Math.round(ey), 4, 3); } mg.text("ST MARY'S", 90, ey - 6, { size: 10, color: '#d71920' }); }

      // critters
      for (const c of G.critters) {
        const sy = scrY(c.wy), img = SP[c.type], s = c.type === 'badger' ? 24 : 18;
        if (sy < -30 || sy > H + 30) continue;
        ctx.save(); ctx.translate(Math.round(c.x), Math.round(sy));
        if (c.curled) ctx.rotate(G.t * 12 * (c.flee || 1));
        else if ((c.flee || c.dir) < 0) ctx.scale(-1, 1);
        const hop = c.type === 'rabbit' && !c.flee && (c.t % 0.6) < 0.25 ? -3 : 0;
        if (img) ctx.drawImage(img, -s / 2, -s / 2 + hop, s, s);
        ctx.restore();
        if (c.alert > 0) mg.text('!', c.x, sy - 14, { size: 10, color: '#f2c14e' });
      }
      // incoming warnings for critters about to enter the screen
      for (const c of G.critters) { const sy = scrY(c.wy); if (sy < 0 && sy > -70 && !c.flee) { mg.text('!', Math.max(ROAD_L, Math.min(ROAD_R, c.x)), 30, { size: 10, color: Math.floor(G.t * 8) % 2 ? '#f2c14e' : '#e5484d' }); } }

      // car
      ctx.save(); ctx.translate(Math.round(G.x), CAR_Y); ctx.rotate(Math.max(-0.3, Math.min(0.3, G.tilt)));
      if (G.boost > 0) { ctx.fillStyle = Math.random() < .5 ? '#fd4' : '#f80'; ctx.fillRect(-6, 22, 3, 4 + Math.random() * 6); ctx.fillRect(3, 22, 3, 4 + Math.random() * 6); }
      if (SP.car) ctx.drawImage(SP.car, -16, -24); else { ctx.fillStyle = '#d71920'; ctx.fillRect(-10, -20, 20, 40); }
      if (G.picked && SP.daughter) ctx.drawImage(SP.daughter, 20, 20, 56, 40, 1, -6, 8, 6); // little passenger head
      ctx.restore();
      if (G.boost > 0) { ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 6; i++) ctx.fillRect(ROAD_L + Math.random() * 100, Math.random() * H, 1, 12); }
      if (G.hornFx > 0) { ctx.strokeStyle = `rgba(242,193,78,${G.hornFx * 2})`; for (let k = 0; k < 3; k++) { const r = 20 + (0.5 - G.hornFx) * 200 + k * 12; ctx.beginPath(); ctx.arc(G.x, CAR_Y - 20, r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); } }
      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(13,16,22,.85)'; ctx.fillRect(0, 0, W, 26);
      const urgent = G.timer < 10, secs = Math.ceil(G.timer);
      mg.text(`00:${String(secs).padStart(2, '0')}`, 6, 9, { size: 13, align: 'left', color: urgent && Math.floor(G.t * 4) % 2 ? '#e5484d' : '#f2c14e' });
      mg.text('NUCLEAR ARMAGEDDON', 48, 9, { size: 7, align: 'left', color: urgent ? '#e5484d' : '#8c93a8' });
      mg.text(`${Math.round(G.v * 0.8)} MPH`, W - 4, 9, { size: 8, align: 'right', color: '#e9e6de' });
      // route bar
      ctx.fillStyle = '#242a3a'; ctx.fillRect(6, 19, 168, 3);
      ctx.fillStyle = '#d71920'; ctx.fillRect(6, 19, Math.round(168 * G.d / D_END), 3);
      const ux = 6 + 168 * D_UNI / D_END; ctx.fillStyle = G.picked ? '#3fbf6b' : '#ff6bd6'; ctx.fillRect(Math.round(ux) - 1, 17, 3, 7);
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(6 + 168 * G.d / D_END) - 1, 17, 3, 7); ctx.fillStyle = '#d71920'; ctx.fillRect(172, 16, 4, 9);
      if (G.hit) mg.text(`Critters harmed: ${G.hit}`, W - 4, 32, { size: 7, align: 'right', color: '#f29b2e' });
      if (G.picked && SP.daughter) { ctx.fillStyle = '#000'; ctx.fillRect(3, 29, 18, 18); ctx.drawImage(SP.daughter, 4, 30, 16, 16); }
      // buttons
      const hornReady = G.horn <= 0, beerReady = G.cool <= 0;
      btn(4, 290, 82, 26, 'HORN', hornReady ? '#f2c14e' : '#6b5a2a', '#0d1016', 'SPACE');
      btn(94, 290, 82, 26, G.boost > 0 ? `BOOST ${Math.ceil(G.boost)}s` : beerReady ? 'DRINK BEER' : `COOLDOWN ${Math.ceil(G.cool)}s`, beerReady ? '#8b4513' : '#3a2a1e', '#f2c14e', 'B');

      if (G.popup) mg.text(G.popup.txt, 90, G.popup.y, { size: 8, color: G.popup.col });
      if (G.state === 'intro') {
        ctx.fillStyle = 'rgba(7,9,13,.7)'; ctx.fillRect(0, 90, W, 120);
        mg.text('Pick up your daughter', 90, 108, { size: 10, color: '#ff6bd6' });
        mg.text("then St Mary's before the nukes", 90, 122, { size: 9, color: '#f4f1ea' });
        mg.text('DRAG / SWIPE or ← → to steer', 90, 146, { size: 8, color: '#e9e6de' });
        mg.text('HORN scares critters · BEER = speed', 90, 160, { size: 8, color: '#e9e6de' });
        ctx.font = 'bold 8px "Pixelify Sans", monospace';
        mg.text("Don't go too fast - you might harm", 90, 180, { size: 7, color: '#f29b2e' });
        mg.text('a squirrel or other woodland critter!', 90, 190, { size: 7, color: '#f29b2e' });
      }
      if (G.state === 'grave') drawGrave();
      if (G.state === 'won' || G.state === 'lost') drawEnd();
    }
    function btn(x, y, w, h, label, bg, fg, key) {
      ctx.fillStyle = '#000'; ctx.fillRect(x, y + 2, w, h); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, w, 1);
      mg.text(label, x + w / 2, y + h / 2 - 2, { size: 9, color: fg }); mg.text(key, x + w / 2, y + h - 4, { size: 6, color: fg === '#0d1016' ? '#3a2a10' : '#a07c50', shadow: false });
    }
    function drawGrave() {
      const g = G.grave, t = g.t, a = Math.min(1, t * 4) * Math.min(1, (2 - t) * 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0b1a10'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1d3a22'; ctx.fillRect(0, 190, W, 130);
      for (let i = 0; i < 18; i++) { ctx.fillStyle = '#f4f1ea'; ctx.fillRect((i * 37) % W, (i * 23) % 120, 1, 1); }
      ctx.fillStyle = '#f2e6b0'; ctx.beginPath(); ctx.arc(140, 40, 10, 0, 7); ctx.fill();
      if (SP.grave) ctx.drawImage(SP.grave, 42, 112, 96, 96);
      const img = SP[g.type]; if (img) { ctx.globalAlpha = a * 0.55 * (0.6 + 0.4 * Math.sin(t * 8)); ctx.drawImage(img, 78, 100 - t * 22, 24, 24); ctx.globalAlpha = a; }
      mg.text(`You carefully place the ${g.type}`, 90, 224, { size: 8, color: '#e9e6de' });
      mg.text('in the grave...', 90, 236, { size: 8, color: '#e9e6de' });
      mg.text('"its the right thing to do"', 90, 258, { size: 10, color: '#f2c14e' });
      mg.text('-4 SECONDS', 90, 280, { size: 9, color: '#e5484d' });
      ctx.globalAlpha = 1;
    }
    function drawEnd() {
      const won = G.state === 'won';
      if (!won) { // nuke
        const n = Math.min(1, G.nuke / 1.2);
        ctx.fillStyle = `rgba(255,140,40,${0.5 * n})`; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f80'; ctx.beginPath(); ctx.arc(90, 60, 20 + n * 26, 0, 7); ctx.fill();
        ctx.fillStyle = '#fd4'; ctx.beginPath(); ctx.arc(90, 60, 10 + n * 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#a65'; ctx.fillRect(84, 60, 12, 40 + n * 20);
      }
      ctx.fillStyle = 'rgba(7,9,13,.92)'; ctx.fillRect(0, 120, W, 170); // opaque enough that the world (stadium sign, car) can't read through the card text
      mg.text(won ? 'YOU MADE IT!' : 'NUCLEAR ARMAGEDDON!', 90, 138, { size: won ? 18 : 14, color: won ? '#3fbf6b' : '#e5484d' });
      const l1 = won ? ['You successfully delivered your', "daughter to St Mary's Stadium!"] : ['You ran out of time.', 'The nukes have landed.'];
      mg.text(l1[0], 90, 162, { size: 8, color: '#f4f1ea' }); mg.text(l1[1], 90, 173, { size: 8, color: '#f4f1ea' });
      if (G.hit > 0) { mg.text(`You harmed ${G.hit} woodland critter${G.hit > 1 ? 's' : ''}.`, 90, 192, { size: 8, color: '#f29b2e' }); mg.text('The forest remembers...', 90, 203, { size: 8, color: '#f29b2e' }); }
      if (won) { if (Math.floor(G.t * 2) % 2 === 0) mg.text('Click anywhere to continue...', 90, 240, { size: 8, color: '#8c93a8' }); }
      else {
        ctx.fillStyle = '#000'; ctx.fillRect(30, 232, 120, 26); ctx.fillStyle = '#d71920'; ctx.fillRect(30, 230, 120, 26);
        mg.text(losses >= 3 ? 'RESTART (+10s shortcut)' : 'RESTART MINI GAME', 90, 243, { size: 9, color: '#fff' });
        mg.text('Click RESTART button to try again', 90, 272, { size: 7, color: '#8c93a8' });
      }
    }

    if (opts.debug || window.__KREPLIN_TEST__) window.__kmgDrive = { get G() { return G; }, mg, D_UNI, D_END, LANES, CAR_Y };
    mg.loop(dt => { update(dt); draw(); });
    const result = await mg.done;
    stopMusic();
    resumeGeneralMusic(wasMusic);
    if (result === 'giveup' && opts.onGiveUp === 'resolve') return result;
    if (typeof showKreplinProtocolUI === 'function') await showKreplinProtocolUI();
    return result;
  }

  window.startDrivingMinigame = startDrivingMinigame;
  window.KMGDrive = { start: startDrivingMinigame };
})();
