/* ===================== MGKit — shared minigame kit =====================
   Every KREPLIN minigame is built on this so they all:
   - render to a low-res pixel canvas scaled by integer steps (crisp on phone + laptop)
   - default to PORTRAIT (180x320 logical px); landscape allowed via opts
   - use frame-rate-independent timing (dt in seconds, fixed 60Hz sim steps)
   - accept touch, mouse and keyboard through one input model
   - can never soft-lock: a "Give up" button (after `giveUpAfter` seconds or fails) resolves with the lose outcome

   const mg = MGKit.open({ title:'PENALTIES', w:180, h:320, giveUpAfter: 20, onGiveUp: () => 'lose' });
   mg.loop((dt, t) => { update...; draw... });   // called at 60Hz sim, rendered each rAF
   mg.input: { down, x, y, pressed (this frame), released (this frame),
               swipe: {dx,dy,dist,angle,ms,startX,startY}|null (set the frame a swipe ends),
               tap: {x,y}|null, keys: Set, keyPressed(k) }
   mg.ctx, mg.W, mg.H, mg.sprites (load via mg.load({name:url})), mg.text(str,x,y,{size,color,align,shadow})
   mg.banner(text,color,secs)  mg.shake(px,secs)  mg.flash(color,secs)  mg.particles.spawn({...})
   mg.end(result) -> closes, resolves mg.done promise with result
   await mg.done
*/
(function () {
  const FONT = '"Pixelify Sans", ui-monospace, monospace';
  function open(o = {}) {
    const W = o.w || 180, H = o.h || 320;
    const wrap = document.createElement('div');
    wrap.className = 'mg-wrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#07090d;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:8px 12px;font:600 14px ' + FONT + ';color:#e9e6de;z-index:2;pointer-events:none';
    bar.innerHTML = `<span style="letter-spacing:1px">${o.title || ''}</span><span style="flex:1"></span>`;
    const give = document.createElement('button');
    give.textContent = o.giveUpLabel || 'Give up';
    give.style.cssText = 'pointer-events:auto;display:none;font:600 13px ' + FONT + ';background:#242a3a;color:#c9c4b6;border:2px solid #3a4258;border-radius:4px;padding:6px 10px;cursor:pointer';
    bar.appendChild(give);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'image-rendering:pixelated;image-rendering:crisp-edges;display:block;touch-action:none';
    wrap.append(bar, canvas);
    document.body.appendChild(wrap);
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;

    // integer scale to fit viewport (leave room for bar)
    function fit() {
      const vw = window.innerWidth, vh = window.innerHeight - 44;
      let s = Math.max(1, Math.floor(Math.min(vw / W, vh / H)));
      if (s * W > vw || s * H > vh) s = Math.min(vw / W, vh / H); // tiny screens: fractional fallback
      canvas.style.width = (W * s) + 'px'; canvas.style.height = (H * s) + 'px';
    }
    fit(); window.addEventListener('resize', fit);

    // ---------- input ----------
    const input = { down: false, x: 0, y: 0, pressed: false, released: false, swipe: null, tap: null, keys: new Set(), _kp: new Set(),
      keyPressed(k) { return this._kp.has(k); } };
    let start = null;
    const toLocal = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    const pd = e => { e.preventDefault(); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); const p = toLocal(e);
      Object.assign(input, { down: true, x: p.x, y: p.y, pressed: true }); start = { ...p, t: performance.now() }; };
    const pm = e => { if (!input.down) return; const p = toLocal(e); input.x = p.x; input.y = p.y; };
    const pu = e => { if (!input.down) return; const p = toLocal(e); input.down = false; input.released = true; input.x = p.x; input.y = p.y;
      if (start) { const dx = p.x - start.x, dy = p.y - start.y, dist = Math.hypot(dx, dy), ms = performance.now() - start.t;
        if (dist > 8) input.swipe = { dx, dy, dist, angle: Math.atan2(dy, dx), ms, startX: start.x, startY: start.y, endX: p.x, endY: p.y };
        else input.tap = { x: p.x, y: p.y }; }
      start = null; };
    canvas.addEventListener('pointerdown', pd); canvas.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu); window.addEventListener('pointercancel', pu);
    const kd = e => { if (!input.keys.has(e.key)) input._kp.add(e.key); input.keys.add(e.key);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault(); };
    const ku = e => input.keys.delete(e.key);
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku, true);

    // ---------- fx ----------
    let bannerState = null, shakeState = { px: 0, t: 0 }, flashState = { c: '#fff', t: 0, d: 1 };
    const parts = [];
    const particles = { spawn(p) { parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0.6, size: 2, color: '#fff' }, p, { age: 0 })); } };
    function text(str, x, y, s = {}) {
      ctx.font = `${s.bold === false ? '' : 'bold '}${s.size || 10}px ${FONT}`;
      ctx.textAlign = s.align || 'center'; ctx.textBaseline = s.baseline || 'middle';
      if (s.shadow !== false) { ctx.fillStyle = '#000'; ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1); }
      ctx.fillStyle = s.color || '#fff'; ctx.fillText(str, Math.round(x), Math.round(y));
    }
    const sprites = {};
    function load(map) {
      return Promise.all(Object.entries(map).map(([k, url]) => new Promise(res => {
        const img = new Image(); img.onload = () => { sprites[k] = img; res(); }; img.onerror = () => res(); img.src = url;
      })));
    }

    // ---------- loop ----------
    let resolveDone; const done = new Promise(r => (resolveDone = r));
    let alive = true, raf = 0, acc = 0, last = performance.now(), elapsed = 0, fails = 0, updateFn = null;
    const STEP = 1 / 60;
    function frame(now) {
      if (!alive) return;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= STEP) {
        elapsed += STEP;
        if (o.giveUpAfter != null && elapsed > o.giveUpAfter) give.style.display = '';
        ctx.save();
        if (shakeState.t > 0) { shakeState.t -= STEP; ctx.translate(Math.round((Math.random() - .5) * shakeState.px * 2), Math.round((Math.random() - .5) * shakeState.px * 2)); }
        if (updateFn) updateFn(STEP, elapsed);
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += STEP; p.vy += p.g * STEP; p.x += p.vx * STEP; p.y += p.vy * STEP;
          if (p.age >= p.life) parts.splice(i, 1); else { ctx.globalAlpha = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); ctx.globalAlpha = 1; } }
        if (bannerState) { bannerState.t -= STEP; const a = Math.min(1, bannerState.t * 3);
          ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(0, H / 2 - 16, W, 32);
          text(bannerState.text, W / 2, H / 2, { size: 16, color: bannerState.color }); ctx.globalAlpha = 1;
          if (bannerState.t <= 0) bannerState = null; }
        if (flashState.t > 0) { flashState.t -= STEP; ctx.globalAlpha = Math.max(0, flashState.t / flashState.d) * 0.6; ctx.fillStyle = flashState.c; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        ctx.restore();
        input.pressed = input.released = false; input.swipe = input.tap = null; input._kp.clear();
        acc -= STEP;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function end(result) {
      if (!alive) return; alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit); window.removeEventListener('pointerup', pu); window.removeEventListener('pointercancel', pu);
      window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku, true);
      wrap.remove(); resolveDone(result);
    }
    give.onclick = () => end(typeof o.onGiveUp === 'function' ? o.onGiveUp() : 'lose');

    return {
      W, H, ctx, canvas, input, sprites, load, text, particles, done, end,
      loop(fn) { updateFn = fn; },
      banner(t, color = '#fff', secs = 1.2) { bannerState = { text: t, color, t: secs }; },
      shake(px = 3, secs = 0.25) { shakeState = { px, t: secs }; },
      flash(c = '#fff', secs = 0.2) { flashState = { c, t: secs, d: secs }; },
      fail() { fails++; if (o.giveUpAfterFails != null && fails >= o.giveUpAfterFails) give.style.display = ''; return fails; },
      get fails() { return fails; }, get elapsed() { return elapsed; },
      showGiveUp() { give.style.display = ''; },
    };
  }
  window.MGKit = { open };
})();
