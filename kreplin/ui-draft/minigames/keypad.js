/* ===================== KREPLIN — Kreplin Protocol keypad =====================
   Drop-in for src/023 showKreplinProtocolUI(): Promise<void>.
     success -> same fullscreen video as before -> showKreplinEpilogue() -> resolve
     timeout -> S.game_over = true, S.game_over_reason = '...failed to initiate Kreplin Protocol in time' -> resolve
   Core: KreplinKeypad.play() -> 'initiated' | 'incinerated'
   Controls: tap keypad / type digits (Backspace deletes). Three 4-digit launch codes are on the post-it.
   Codes auto-submit at 4 digits; wrong code = buzz, -2s. After 3 wrong codes the next digit glows (easy mode).
   Then smash INITIATE THE KREPLIN PROTOCOL (tap / Enter / Space).
*/
(function () {
  const ART = () => (window.MG_ART_BASE || '../../art/raw/');
  const RED = '#d71920', GOLD = '#f2c14e', INK = '#0d1016', WHITE = '#f4f1ea', GOOD = '#3fbf6b', BAD = '#e5484d';
  const VIDEO = 'https://www.dropbox.com/scl/fi/tkhja9j9z60idn2kor9yo/Video-1-13-26-9-38-27-am.mp4?rlkey=1k7yokbjoxgu1zyybu5rm0wzk&st=6i1spn4p&dl=1&d=1';
  const CODES = [{ c: '1885', l: 'SAINTS FOUNDED' }, { c: '6969', l: "CHAIRMAN'S PIN" }, { c: '0000', l: 'NEVER CHANGED IT' }];
  const TIME = 20;
  const rnd = (a, b) => a + Math.random() * (b - a);

  async function play(opts = {}) {
    const mg = MGKit.open({ title: 'THE KREPLIN PROTOCOL', w: 180, h: 320, giveUpAfter: 10, giveUpLabel: 'Accept fate', onGiveUp: () => 'incinerated' });
    const sp = mg.sprites, { ctx, input } = mg;
    await mg.load({ bg: ART() + 'mg-key-bg.png', nuke: ART() + 'mg-key-nuke.png', ch: ART() + 'mg-key-chairman.png' });
    const time = opts.time || TIME;
    let left = time, stage = 0, entry = '', wrong = 0, phase = 'codes', pt = 0, tt = 0, press = null, lampFx = 0, lastSec = Math.ceil(time);
    const keys = [];
    const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'DEL'];
    labels.forEach((l, i) => keys.push({ l, x: 12 + (i % 3) * 54, y: 204 + Math.floor(i / 3) * 28, w: 48, h: 24 }));
    const BIG = { x: 12, y: 204, w: 156, h: 108 };
    window.__keyDebug = { get phase() { return phase; }, get stage() { return stage; }, get left() { return left; }, codes: CODES.map(c => c.c), keys, BIG };

    function hit(k, x, y) { return x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h; }
    function pressKey(l) {
      if (phase !== 'codes') return;
      const k = keys.find(q => q.l === l); if (k) press = { k, t: .12 };
      if (l === 'CLR') entry = ''; else if (l === 'DEL') entry = entry.slice(0, -1);
      else if (entry.length < 4) entry += l;
      if (entry.length === 4) {
        if (entry === CODES[stage].c) {
          stage++; entry = ''; lampFx = .5; mg.flash(GOOD, .15);
          mg.banner(stage < 3 ? `CODE ${stage} ACCEPTED` : 'ARMED. PRESS IT.', stage < 3 ? GOOD : GOLD, .8);
          for (let i = 0; i < 16; i++) mg.particles.spawn({ x: 90, y: 188, vx: rnd(-60, 60), vy: rnd(-50, 10), g: 80, life: .6, size: 2, color: GOOD });
          if (stage === 3) { phase = 'button'; pt = 0; }
        } else {
          wrong++; entry = ''; left = Math.max(0.01, left - 2); mg.shake(4, .3); mg.flash(BAD, .25);
          mg.banner(wrong >= 3 ? 'WRONG! (THE GLOWING ONE, KREPLIN)' : 'WRONG CODE  -2s', BAD, .9);
        }
      }
    }

    mg.loop(dt => {
      tt += dt; pt += dt;
      if (phase === 'codes' || phase === 'button') {
        left -= dt;
        if (Math.ceil(left) < lastSec) { lastSec = Math.ceil(left); if (left <= 5) mg.shake(1, .1); }
        if (left <= 0) { left = 0; phase = 'boom'; pt = 0; mg.flash('#fff', 1); mg.shake(8, 1.5); }
      }
      if (phase === 'codes') {
        if (input.tap) for (const k of keys) if (hit(k, input.tap.x, input.tap.y)) pressKey(k.l);
        if (input.pressed) for (const k of keys) if (hit(k, input.x, input.y)) press = { k, t: .12 };
        for (const d of '0123456789') if (input.keyPressed(d)) pressKey(d);
        if (input.keyPressed('Backspace')) pressKey('DEL');
        if (input.keyPressed('Escape')) pressKey('CLR');
      } else if (phase === 'button') {
        if ((input.tap && hit(BIG, input.tap.x, input.tap.y)) || input.keyPressed('Enter') || input.keyPressed(' ')) {
          phase = 'win'; pt = 0; mg.flash(GOLD, .6); mg.shake(5, .6); mg.banner('PROTOCOL INITIATED', GOLD, 2);
          for (let i = 0; i < 90; i++) mg.particles.spawn({ x: 90, y: 258, vx: rnd(-90, 90), vy: rnd(-120, 20), g: 60, life: rnd(1, 2), size: 2, color: [GOLD, WHITE, RED][i % 3] });
        }
      } else if (phase === 'win' && pt > 2) { mg.end('initiated'); return; }
      else if (phase === 'boom' && pt > 4.2) { mg.end('incinerated'); return; }

      // ---------- draw ----------
      const danger = Math.max(0, 1 - left / time);
      ctx.fillStyle = '#07040c'; ctx.fillRect(0, 0, 180, 320);
      if (sp.bg) ctx.drawImage(sp.bg, 0, 0, 180, 128);
      // incoming missiles: get closer as time runs out
      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 44 + Math.sin(i * 3) * 8, y = -10 + danger * (90 + i * 6) + Math.sin(tt * 2 + i) * 1;
        ctx.fillStyle = 'rgba(255,170,60,.5)'; ctx.fillRect(x, y - 18, 2, 18); ctx.fillStyle = '#ddd'; ctx.fillRect(x - 1, y, 4, 7); ctx.fillStyle = RED; ctx.fillRect(x - 1, y + 7, 4, 2);
      }
      // siren wash
      if (left < 6 && phase !== 'win') { ctx.fillStyle = `rgba(255,0,0,${(Math.sin(tt * 10) + 1) * .08})`; ctx.fillRect(0, 0, 180, 320); }
      // message
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, 180, 26);
      mg.text("Yes! You got to St Mary's!! Quick, fulfill", 90, 7, { size: 6, color: GOLD });
      mg.text('your destiny, o great chosen one!', 90, 17, { size: 6, color: GOLD });
      // countdown
      const sec = Math.ceil(left), pulse = left <= 3 ? 1 + Math.abs(Math.sin(tt * 6)) * .2 : 1;
      ctx.save(); ctx.translate(90, 66); ctx.scale(pulse, pulse);
      mg.text(String(sec), 0, 0, { size: 40, color: left <= 3 ? '#ff2020' : '#ffaa00' }); ctx.restore();
      mg.text(left.toFixed(1) + 's', 90, 96, { size: 7, color: WHITE });
      // console panel
      ctx.fillStyle = '#1d2230'; ctx.fillRect(0, 128, 180, 192); ctx.fillStyle = RED; ctx.fillRect(0, 128, 180, 2);
      // post-it with codes
      ctx.save(); ctx.translate(8, 136); ctx.rotate(-.03);
      ctx.fillStyle = '#f7e36b'; ctx.fillRect(0, 0, 100, 46); ctx.fillStyle = '#d9c14c'; ctx.fillRect(0, 44, 100, 2);
      mg.text('LAUNCH CODES - DO NOT LOSE', 50, 6, { size: 5, color: '#5a4a10', shadow: false });
      CODES.forEach((c, i) => { const done = i < stage, cur = i === stage && phase === 'codes';
        mg.text(`${i + 1}. ${c.c}`, 6, 17 + i * 11, { size: 8, align: 'left', color: done ? '#7a8a4a' : cur ? '#b0101a' : '#3a2a00', shadow: false });
        mg.text(c.l, 50, 17 + i * 11, { size: 5, align: 'left', color: '#6a5a20', shadow: false, bold: false });
        if (done) { ctx.fillStyle = '#3a2a00'; ctx.fillRect(4, 17 + i * 11, 40, 1); } });
      ctx.restore();
      if (sp.ch) ctx.drawImage(sp.ch, 114, 132 + Math.round(Math.sin(tt * 20) * (left < 6 ? 1 : 0)), 62, 62);
      if (Math.random() < .2) mg.particles.spawn({ x: 140 + rnd(-6, 6), y: 146, vx: rnd(-10, 10), vy: 10, g: 100, life: .5, size: 1, color: '#9cd3ff' });
      // LCD + lamps
      ctx.fillStyle = '#0a1a0f'; ctx.fillRect(12, 184, 120, 16); ctx.strokeStyle = '#3a4258'; ctx.strokeRect(11.5, 183.5, 121, 17);
      const shown = phase === 'codes' ? (entry + '____').slice(0, 4).split('').join(' ') : phase === 'boom' ? 'E R R' : 'A R M D';
      mg.text(shown, 72, 192, { size: 11, color: '#5dff8a', shadow: false });
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < stage ? GOOD : '#2e3547'; if (i === stage - 1 && lampFx > 0) ctx.fillStyle = '#fff'; ctx.fillRect(138 + i * 13, 186, 10, 12); }
      lampFx = Math.max(0, lampFx - dt);
      if (phase === 'codes') {
        const nextD = wrong >= 3 ? CODES[stage].c[entry.length] : null;
        keys.forEach(k => {
          const dn = press && press.k === k; const glow = nextD && k.l === nextD && Math.sin(tt * 10) > -.2;
          ctx.fillStyle = '#000'; ctx.fillRect(k.x, k.y + 2, k.w, k.h);
          ctx.fillStyle = glow ? GOLD : (k.l === 'CLR' || k.l === 'DEL') ? '#5a1418' : '#3a4258'; ctx.fillRect(k.x, k.y + (dn ? 2 : 0), k.w, k.h);
          ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(k.x, k.y + (dn ? 2 : 0), k.w, 2);
          mg.text(k.l, k.x + k.w / 2, k.y + k.h / 2 + (dn ? 2 : 0), { size: k.l.length > 1 ? 7 : 11, color: glow ? INK : WHITE });
        });
        if (press && (press.t -= dt) <= 0) press = null;
      } else if (phase === 'button' || phase === 'win') {
        const g = (Math.sin(tt * 6) + 1) / 2;
        ctx.fillStyle = `rgba(242,193,78,${.2 + g * .3})`; ctx.fillRect(BIG.x - 4, BIG.y - 4, BIG.w + 8, BIG.h + 8);
        ctx.fillStyle = '#7a4a00'; ctx.fillRect(BIG.x, BIG.y + 4, BIG.w, BIG.h);
        ctx.fillStyle = phase === 'win' ? '#fff' : GOLD; ctx.fillRect(BIG.x, BIG.y + (phase === 'win' ? 4 : 0), BIG.w, BIG.h - 2);
        ['INITIATE', 'THE KREPLIN', 'PROTOCOL'].forEach((t, i) => mg.text(t, 90, BIG.y + 30 + i * 22, { size: 14, color: INK, shadow: false }));
      } else if (phase === 'boom') {
        const s = Math.min(1, pt / 1.2);
        ctx.fillStyle = `rgba(0,0,0,${Math.min(.85, pt / 2)})`; ctx.fillRect(0, 0, 180, 320);
        if (sp.nuke) ctx.drawImage(sp.nuke, 90 - 70 * s, 150 - 120 * s, 140 * s, 140 * s);
        if (Math.random() < .5) mg.particles.spawn({ x: rnd(0, 180), y: rnd(80, 300), vx: rnd(-20, 20), vy: rnd(-40, -10), life: 1, size: 2, color: ['#ff6a00', '#ffcc33', '#661100'][Math.floor(rnd(0, 3))] });
        if (pt > 1.2) { ['YOU ARE INCINERATED', 'IN NUCLEAR HELLFIRE'].forEach((t, i) => mg.text(t, 90, 190 + i * 16, { size: 12, color: '#ff2020' }));
          mg.text('The timer reached zero.', 90, 236, { size: 7, color: '#ffaa00' }); mg.text('Your destiny remains unfulfilled.', 90, 248, { size: 7, color: '#ffaa00' }); }
      }
    });
    return mg.done;
  }

  function playVideo() {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999999;display:flex;justify-content:center;align-items:center';
      const v = document.createElement('video');
      v.src = window.KREPLIN_PROTOCOL_VIDEO || VIDEO; v.style.cssText = 'width:100%;height:100%;object-fit:contain';
      v.controls = false; v.autoplay = true; v.playsInline = true;
      const block = e => { e.stopPropagation(); e.preventDefault(); };
      box.addEventListener('click', block); v.addEventListener('click', block);
      v.addEventListener('loadedmetadata', () => { try { box.requestFullscreen && box.requestFullscreen().catch(() => {}); } catch (e) {} });
      const exitFs = () => { try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {} };
      v.addEventListener('ended', () => { exitFs(); box.remove(); resolve('ended'); });
      v.addEventListener('error', e => { console.warn('Video error:', e); try { if (typeof log === 'function') log('Error loading video. The Kreplin Protocol has been initiated!'); } catch (_) {} box.remove(); resolve('error'); });
      box.appendChild(v); document.body.appendChild(box);
    });
  }

  // drop-in replacement for src/023 showKreplinProtocolUI
  window.showKreplinProtocolUI = async function showKreplinProtocolUI() {
    const r = await play();
    if (r !== 'initiated') {
      if (typeof S !== 'undefined') { S.game_over = true; S.game_over_reason = 'Incinerated in nuclear hellfire - failed to initiate Kreplin Protocol in time'; }
      return;
    }
    const v = await playVideo();
    if (v === 'ended' && typeof showKreplinEpilogue === 'function') await showKreplinEpilogue();
  };
  window.KreplinKeypad = { play, playVideo, CODES };
})();
