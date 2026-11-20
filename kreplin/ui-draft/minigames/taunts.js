/* ===================== KREPLIN — In-match taunt bubbles =====================
   Drop-in for src/028 presentInteractiveTauntOptions(logFn = null): Promise<void>.
   Same option source (rollTauntMenu(S.frustration) -> TAUNTS fallback -> pickInvective), same log line
   `You shout: "..."`, same addSessionShout(), same frustration rule (+15 if it contains fucking/wanker/cunt,
   +8 if it contains 'saints'/'Southampton' (case-sensitive, as before), else +5; capped at 100).
   NEW: 3 pixel speech bubbles; tap one (or 1/2/3) within 3s. Timeout -> random pick from the options, as before.
*/
(function () {
  const ART = () => (window.MG_ART_BASE || '../../art/raw/');
  const RED = '#d71920', GOLD = '#f2c14e', INK = '#0d1016', WHITE = '#f4f1ea', BAD = '#e5484d';
  const FONT = '"Pixelify Sans", ui-monospace, monospace';
  const WINDOW = 3;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickA = a => a[Math.floor(Math.random() * a.length)];
  const FALLBACK = ['PASS THE FUCKING BALL', 'SHOOT!', 'COME ON YOU SAINTS!', 'REF, OPEN YOUR FUCKING EYES!', 'WAKE UP!', 'GET STUCK IN!'];

  function frustrationDelta(t) {
    if (t.includes('fucking') || t.includes('wanker') || t.includes('cunt')) return 15;
    if (t.includes('saints') || t.includes('Southampton')) return 8;
    return 5;
  }
  // visual heat only (case-insensitive); the frustration effect above stays exactly as src/028
  function vileness(t) { const s = String(t).toLowerCase(); return /cunt|wanker|kill|break his|legs|hospital|murder|dead man|punch|smash|stretcher/.test(s) ? 3 : /fuck|shit|cock|tits|clown|disgrace/.test(s) ? 2 : 1; }
  function rollOptions(fr) {
    let options = [];
    try { if (typeof rollTauntMenu === 'function') options = rollTauntMenu(fr) || []; } catch (e) {}
    if (!Array.isArray(options) || !options.length) {
      const pools = [];
      try { if (Array.isArray(TAUNTS?.extreme)) pools.push(...TAUNTS.extreme); } catch (e) {}
      try { if (Array.isArray(TAUNTS?.saints)) pools.push(...TAUNTS.saints); } catch (e) {}
      try { if (Array.isArray(TAUNTS?.general)) pools.push(...TAUNTS.general); } catch (e) {}
      options = pools.filter(Boolean);
    }
    return options;
  }
  function wrap(ctx, text, maxW, size) {
    ctx.font = `bold ${size}px ${FONT}`;
    const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }

  // core: show bubbles, resolve with chosen string (or null if no options)
  async function chooseTaunt(options, opts = {}) {
    const shown = options.slice(0, 3);
    const mg = MGKit.open({ title: 'TAUNT!', w: 180, h: 320 });
    const sp = mg.sprites, { ctx, input } = mg;
    await mg.load({ bg: ART() + 'mg-taunt-pitch.png', ch: ART() + 'mg-taunt-chairman.png', pl: ART() + 'mg-taunt-player.png' });
    const fr0 = (window.S && S.frustration) || 0;
    const bubbles = shown.map((t, i) => {
      const lines = wrap(ctx, t, 128, 7).slice(0, 3); const h = 12 + lines.length * 9;
      return { t, lines, h, d: frustrationDelta(t), v: vileness(t), y: 0, x: 6, w: 168, pop: 0 };
    });
    let y = 142; bubbles.forEach(b => { b.y = y; y += b.h + 6; });
    let left = opts.window || WINDOW, chosen = null, how = null, pt = 0, tt = 0;
    window.__tauntDebug = { bubbles, get chosen() { return chosen; }, get left() { return left; } };
    function choose(b, auto) {
      if (chosen) return; chosen = b; how = auto ? 'auto' : 'tap'; pt = 0;
      mg.shake(b.v >= 3 ? 5 : b.v >= 2 ? 3 : 2, .35); mg.flash(b.v >= 3 ? RED : WHITE, .15);
      if (auto) mg.banner('TOO SLOW - YOU BLURT IT', GOLD, .9);
      for (let i = 0; i < 18; i++) mg.particles.spawn({ x: b.x + rnd(0, b.w), y: b.y + b.h / 2, vx: rnd(-40, 40), vy: rnd(-90, -20), g: 60, life: .6, size: 2, color: b.v >= 3 ? RED : GOLD });
    }
    mg.loop(dt => {
      tt += dt; pt += dt;
      if (!chosen) {
        left -= dt;
        if (input.tap) for (const b of bubbles) if (input.tap.x >= b.x && input.tap.x <= b.x + b.w && input.tap.y >= b.y && input.tap.y <= b.y + b.h) choose(b);
        ['1', '2', '3'].forEach((k, i) => { if (input.keyPressed(k) && bubbles[i]) choose(bubbles[i]); });
        if (!chosen && left <= 0) { const t = pickA(options); let b = bubbles.find(q => q.t === t); if (!b) { b = bubbles[0]; b.t = t; b.lines = wrap(ctx, t, 128, 7).slice(0, 3); b.d = frustrationDelta(t); b.v = vileness(t); } choose(b, true); }
      } else if (pt > 1.25) { mg.end(chosen.t); return; }

      // draw
      ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, 180, 320);
      if (sp.bg) ctx.drawImage(sp.bg, 0, 0, 180, 128);
      // offended player on pitch
      if (sp.pl) { const j = chosen ? Math.abs(Math.sin(pt * 12)) * 6 * Math.max(0, 1 - pt) : 0;
        ctx.drawImage(sp.pl, 70, 66 - j, 40, 40);
        if (chosen && pt > .25) mg.text(chosen.v >= 3 ? '?!?!' : chosen.v >= 2 ? '?!' : '...ok', 112, 66, { size: 9, color: chosen.v >= 3 ? BAD : WHITE }); }
      // timer bar
      ctx.fillStyle = INK; ctx.fillRect(0, 128, 180, 8);
      const f = Math.max(0, left / (opts.window || WINDOW));
      ctx.fillStyle = f < .33 ? BAD : GOLD; ctx.fillRect(0, 129, 180 * f, 6);
      mg.text(chosen ? 'YOU SHOUT:' : 'PICK YOUR ABUSE', 90, 132, { size: 6, color: INK, shadow: false });
      // bubbles
      bubbles.forEach((b, i) => {
        const sel = chosen === b, dim = chosen && !sel;
        let bx = b.x, by = b.y, sc = 1;
        if (sel) { const t = Math.min(1, pt / .5); by = b.y + (40 - b.y) * t * t; sc = 1 + .1 * Math.sin(t * Math.PI); }
        else if (!chosen) by += Math.round(Math.sin(tt * 3 + i * 2) * 1);
        ctx.save(); ctx.globalAlpha = dim ? Math.max(0, .5 - pt) : 1; ctx.translate(bx + b.w / 2, by + b.h / 2); ctx.scale(sc, sc); ctx.translate(-b.w / 2, -b.h / 2);
        const hot = b.v >= 3, mid = b.v >= 2;
        ctx.fillStyle = '#000'; ctx.fillRect(1, 2, b.w, b.h);
        ctx.fillStyle = hot ? '#ffe3e3' : WHITE; ctx.fillRect(0, 0, b.w, b.h);
        ctx.fillStyle = hot ? RED : mid ? GOLD : '#8c93a8'; ctx.fillRect(0, 0, 3, b.h);
        // tail toward chairman
        ctx.fillStyle = hot ? '#ffe3e3' : WHITE; ctx.fillRect(14, b.h, 6, 3); ctx.fillRect(12, b.h + 3, 4, 2);
        mg.text(String(i + 1), 9, 7, { size: 6, color: '#8c93a8', shadow: false });
        b.lines.forEach((l, k) => mg.text(l, 16, 8 + k * 9, { size: 7, align: 'left', color: INK, shadow: false }));
        for (let p = 0; p < (hot ? 3 : mid ? 2 : 1); p++) { ctx.fillStyle = hot ? RED : GOLD; ctx.fillRect(b.w - 6 - p * 5, b.h - 7, 3, 4); ctx.fillStyle = '#ffcc33'; ctx.fillRect(b.w - 5 - p * 5, b.h - 5, 1, 2); }
        ctx.restore();
      });
      // chairman
      if (sp.ch) { const shake = chosen ? Math.round(Math.sin(pt * 50) * 1.5) : 0; ctx.drawImage(sp.ch, 2 + shake, 254, 66, 66); }
      // frustration meter
      const add = chosen ? chosen.d * Math.min(1, pt / .6) : 0, fr = Math.min(100, fr0 + add);
      mg.text('FRUSTRATION', 124, 278, { size: 6, color: WHITE });
      ctx.fillStyle = '#000'; ctx.fillRect(76, 286, 96, 10); ctx.fillStyle = '#2e3547'; ctx.fillRect(77, 287, 94, 8);
      ctx.fillStyle = fr > 70 ? BAD : fr > 30 ? GOLD : '#3fbf6b'; ctx.fillRect(77, 287, 94 * fr / 100, 8);
      if (chosen) mg.text(`+${chosen.d}`, 124, 306, { size: 9, color: chosen.d >= 15 ? BAD : GOLD });
      else mg.text('TAP A BUBBLE · 1/2/3', 124, 306, { size: 6, color: '#8c93a8' });
    });
    return mg.done;
  }

  // drop-in replacement for src/028 presentInteractiveTauntOptions
  window.presentInteractiveTauntOptions = async function presentInteractiveTauntOptions(logFn = null) {
    const currentFrustration = S.frustration || 0;
    const addLog = logFn || (text => { if (typeof log === 'function') log(text); });
    let options = rollOptions(currentFrustration);
    let selectedTaunt = null;
    if (Array.isArray(options) && options.length > 0) selectedTaunt = await chooseTaunt(options);
    else { try { selectedTaunt = typeof pickInvective === 'function' ? pickInvective(currentFrustration) : null; } catch (e) {} }
    if (!selectedTaunt) return;
    addLog(`You shout: "${selectedTaunt}"`);
    if (typeof addSessionShout === 'function') addSessionShout(selectedTaunt);
    else { if (!Array.isArray(S.sessionShouts)) S.sessionShouts = []; S.sessionShouts.push(selectedTaunt); }
    S.frustration = Math.min((S.frustration || 0) + frustrationDelta(selectedTaunt), 100);
  };
  window.KreplinTaunts = { chooseTaunt, frustrationDelta, rollOptions, FALLBACK };
})();
