// Chef Marina — clarity G40: walk pads in the portrait band (owner's request).
// In tall portrait there is a big empty band under the picture, and big things in the room (the climbing frame, the
// island…) catch a floor tap meant for walking. Two big ◀ ▶ pads in that band walk Marina left or right:
//   - hold: she keeps walking that way until the finger lifts; a quick tap walks a short stretch;
//   - walking all the way to an edge with a room beyond goes through exactly as walking there does today (game.js:280);
//   - riding Daddy, in the wheelchair, perched, sitting, cheering or sad: handled like the wall exit tab (features.js:381);
//   - nothing happens while busy, on the bars or swing, in a tantrum, or while any screen is open (the pads hide).
// The side arrows in the picture, floor taps and swipes are all unchanged. Switch: Clarity.on.G40.
(function () {
  const C = window.Clarity; if (!C || !C.core) return;
  const TALL = '(orientation:portrait) and (min-height:150vw)';
  const S = C.G40 = { pads: [], hold: null, timer: 0 };

  C.css('G40', '.cm-g40-pad{position:fixed;z-index:6;width:96px;height:72px;padding:0;border:0;border-radius:22px;background:rgba(255,255,255,.9);' +
    'box-shadow:0 4px 0 rgba(0,0,0,.28);color:#e2632b;font-size:40px;line-height:1;display:none;align-items:center;justify-content:center;' +
    'touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}' +
    '.cm-g40-pad.l{left:10px}.cm-g40-pad.r{right:10px}.cm-g40-pad.cm-g40-on{display:flex}.cm-g40-pad.cm-g40-down{background:#ffe7a8;translate:0 3px;box-shadow:0 1px 0 rgba(0,0,0,.28)}' +
    '@media not all and ' + TALL + '{.cm-g40-pad{display:none!important}}');

  function canWalk() {
    if (!C.playing() || C.screenOpen() || G.busy || G.tidy) return false;
    if (['bars', 'swing', 'tantrum', 'ride', 'fort'].includes(marina.state) && !(marina.state === 'ride' && marina.mount)) return false;
    return true;
  }
  function step(side, far) {
    if (!canWalk()) return false;
    UI.closeActions();
    if (marina.state === 'perch') { marina.offY = 0; marina.state = 'idle'; }
    if (['sit', 'cheer', 'sad', 'stomp'].includes(marina.state)) marina.state = 'idle';
    const mover = marina.mount || marina, w = ROOMS[G.room].w;
    const x = far ? (side < 0 ? 0 : w) : mover.x + side * 70;
    mover.walkTo(x, null, marina.mount ? 75 : marina.state === 'wheel' ? 95 : null, FLOOR);
    return true;
  }
  function make(side) {
    const b = document.createElement('button'); b.className = 'cm-g40-pad ' + (side < 0 ? 'l' : 'r');
    b.setAttribute('aria-label', side < 0 ? 'walk left' : 'walk right'); b.textContent = side < 0 ? '◀' : '▶';
    b.addEventListener('pointerdown', e => {
      if (!C.on.G40) return;
      try { b.setPointerCapture(e.pointerId); } catch (_) { }
      if (!step(side, true)) { Audio2.blip(-12, 'triangle', 0.08, 0.1); return; }
      Audio2.blip(9, 'triangle', 0.05, 0.1); b.classList.add('cm-g40-down');
      S.hold = { side, t: performance.now(), x0: (marina.mount || marina).x };
    });
    const up = () => {
      b.classList.remove('cm-g40-down'); const h = S.hold; S.hold = null; if (!h || h.side !== side) return;
      const mover = marina.mount || marina;
      if (performance.now() - h.t < 260) { mover.walkTo(h.x0 + side * 70, null, marina.mount ? 75 : marina.state === 'wheel' ? 95 : null, FLOOR); return; } // a tap: a short stretch
      if (G.room && mover.moving) mover.stop();                                                                                 // a hold: stop where she is
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    document.getElementById('app').appendChild(b); return b;
  }

  // place the pads in the free part of the band: under the face cards and the dock rows, above the mood faces
  function place() {
    if (!S.pads.length) return;
    const st = document.getElementById('stage').getBoundingClientRect(), mood = document.querySelector('#moodbar .mood');
    const moodTop = mood ? mood.getBoundingClientRect().top : innerHeight, top = st.bottom + 96, h = Math.min(72, moodTop - 10 - top);
    S.fits = h >= 52;
    for (const b of S.pads) { b.style.top = top + 'px'; b.style.height = Math.max(52, h) + 'px'; }
  }
  function tick() {
    if (!S.pads.length) S.pads = [make(-1), make(1)], place();
    const show = S.fits && canWalk() && !document.querySelector('#fx .act');
    for (const b of S.pads) b.classList.toggle('cm-g40-on', show);
    if (S.hold && !canWalk()) { S.hold = null; for (const b of S.pads) b.classList.remove('cm-g40-down'); }
  }
  addEventListener('resize', () => setTimeout(place, 50)); addEventListener('orientationchange', () => setTimeout(place, 300));
  C.every(150, 'G40', () => { tick(); place(); });
  C.onToggle && C.onToggle('G40', on => { if (!on) for (const b of S.pads) b.classList.remove('cm-g40-on', 'cm-g40-down'); });
})();
