// in-page instrumentation: logs every prompt / interruption with the game clock (E.t) and what Marina was doing
(() => {
  if (window.__log) return;
  const log = window.__log = [];
  const ctx = () => { let act = false; try { act = inActivity(); } catch (e) { }
    return { t: +E.t.toFixed(2), room: G.room, act, busy: !!G.busy, scene: !!G.sceneOn, mv: !!marina.moving, st: marina.state, idle: +(E.t - lastInput).toFixed(1), panel: !document.getElementById('panel').classList.contains('hidden') }; };
  const L = (type, o) => log.push(Object.assign(ctx(), { type }, o || {}));
  window.__L = L;
  const _v = Audio2.voice; Audio2.voice = function (key, sp) { L('voice', { key, sp: sp || '' }); return _v.apply(this, arguments); };
  const _sfx = Audio2.sfx; Audio2.sfx = function (k) { if (/baby_cry|minka_m|turkey|knock|^poop|meow|trill|bleat|fart|crowd_cheer|oven_ding/.test(k)) L('sfx', { k }); return _sfx.apply(this, arguments); };
  const _f = Audio2.fart; Audio2.fart = function () { L('sfx', { k: 'fart' }); return _f.apply(this, arguments); };
  const _face = UI.face; UI.face = function (who, mood) { L('face', { who, mood }); return _face.apply(this, arguments); };
  const _bub = UI.bubble; UI.bubble = function (ent, icon) { L('bubble', { who: ent && ent.id, icon, onScreen: (() => { try { const [sx] = toScreen(ent.x, 0); return sx > 0 && sx < document.getElementById('stage').clientWidth; } catch (e) { return null; } })() }); return _bub.apply(this, arguments); };
  const _big = UI.bigIcon; UI.bigIcon = function (ch, ms) { L('big', { ch, ms: ms || 1200 }); return _big.apply(this, arguments); };
  const _pm = UI.pulseMoods; UI.pulseMoods = function () { L('pulseMoods'); return _pm.apply(this, arguments); };
  const _ua = UI.actions; UI.actions = function (a, list) { const icons = (list || []).map(x => x.ico || (x.img ? 'img' : '?')).join(''); L('acts', { anchor: a ? (a.id || (a.prop && a.prop.id) || a.a || '?') : '?', icons, unprompted: E.t - lastInput > 1.2 }); return _ua.apply(this, arguments); };
  const _em = window.emit; window.emit = function (kind, x, y, n, o) { if (o && o.ch === '🐾') L('paw'); return _em.apply(this, arguments); };
  // polled state: log on change
  const prev = {};
  const vis = n => !!n && n.getClientRects().length > 0 && getComputedStyle(n).opacity > 0.05 && !n.classList.contains('off') && !n.classList.contains('hidden');
  function snap() {
    const s = {};
    const w = document.getElementById('wishBtn'); s.wish = w ? w.textContent : '';
    const r = document.getElementById('reqBtn'); s.req = r ? r.textContent : '';
    s.alerts = [...document.querySelectorAll('.alertb')].map(n => n.getAttribute('aria-label')).join(',');
    s.hints = [...document.querySelectorAll('.pichint')].map(n => n.textContent).join('');
    s.toast = document.querySelector('.stk-toast') ? document.querySelector('.stk-toast').textContent : '';
    s.faces = [...document.querySelectorAll('.facecard.show')].map(n => n.dataset.who).join(',');
    s.acts = document.querySelectorAll('.act').length;
    s.dress = vis(document.getElementById('dressBtn')) ? 1 : 0; s.book = vis(document.getElementById('bookBtn')) ? 1 : 0;
    s.arrows = [...document.querySelectorAll('.navarrow')].map(n => (vis(n) ? 1 : 0)).join('');
    const fp = document.getElementById('floorpill'); s.pill = fp && !fp.classList.contains('off') ? [...fp.querySelectorAll('.fl')].map(n => (n.classList.contains('off') ? 0 : 1)).join('') : '00';
    s.stop = vis(document.getElementById('stopBtn')) ? document.getElementById('stopBtn').textContent : '';
    s.moodPulse = document.getElementById('moodbar').classList.contains('pulse') ? 1 : 0;
    try { const m = Minka.state(); s.minkaHide = m && m.hiding ? m.hiding.room + (m.hiding.in ? ':in' : ':going') : ''; s.minkaMarkers = m && m.hiding && m.hiding.in && m.hiding.room === G.room && !G.busy && document.getElementById('panel').classList.contains('hidden') ? 1 : 0; s.minkaFight = m && m.fight || ''; s.minkaRoom = m ? m.room : ''; } catch (e) { }
    try { s.deer = Wildlife.active() && G.room === 'backyard' ? 1 : 0; const vs = Wildlife.state; s.deerTab = 0;
      if (vs && G.room === 'backyard' && vs.phase !== 'exit' && !(vs.phase === 'enter' && vs.t < 2.4)) { const herd = vs.deer.filter(d => !d.hidden); s.deerTab = herd.length && !herd.some(d => d.x > E.camX - 6 && d.x < E.camX + E.viewW + 6) ? 1 : 0; }
      } catch (e) { s.deerErr = e.message; }
    try { s.turkeys = Wildlife.turkeysActive() && G.room === 'backyard' ? 1 : 0; const ts = Wildlife.turkeyState; s.turkeyTab = ts && ts.tab && G.room === 'backyard' ? 1 : 0; } catch (e) { s.turkErr = e.message; }
    s.daddyPhone = daddy.state === 'phone' && daddy.here ? 1 : 0; s.daddyPhoneAny = daddy.state === 'phone' ? 1 : 0;
    s.nunuFace = nunu.here && nunu.face ? nunu.face : ''; s.septic = G.septic ? 1 : 0;
    s.cry = miles.crying ? 1 : 0; s.nappy = miles.poopy ? 1 : 0; s.poop = G.poop ? 1 : 0;
    s.here = Object.entries({ daddy, mommy, rory, nunu, jeff, niko, miles }).filter(([k, e]) => e.here && !e.hidden).map(([k]) => k).join(',');
    s.bounce = G.bounce ? G.bounce.id + '@' + G.bounce.t0.toFixed(1) : '';
    for (const k in s) if (prev[k] !== s[k]) { if (k !== 'bounce' || (s.bounce && E.t - lastInput > 9)) L('state', { k, v: s[k], was: prev[k] === undefined ? null : prev[k] }); prev[k] = s[k]; }
  }
  setInterval(() => { try { snap(); } catch (e) { L('snaperr', { e: e.message }); } }, 250);
  // sample "how many prompt-type overlays are on screen" every second
  window.__occ = [];
  setInterval(() => { try { const n = document.querySelectorAll('#wishBtn,#reqBtn,.alertb,.pichint,.stk-toast,.facecard.show,.act,.say').length; window.__occ.push([+E.t.toFixed(1), n, inActivity() ? 1 : 0]); } catch (e) { } }, 1000);
})();
