// Chef Marina — UI: bubbles, actions, mood bar, panels (cook, dress, crafts, map, fort tray)
const UI = (() => {
  const fx = () => document.getElementById('fx');
  const bubbles = []; let acts = null; let panelMode = null;
  const imgCache = {};
  function imgURL(key, opt) { const k = key + JSON.stringify(opt || ''); if (imgCache[k]) return imgCache[k]; const c = spriteCanvas(key, opt); return (imgCache[k] = c ? c.toDataURL() : ''); }
  function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'style') Object.assign(e.style, v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; }
  const tap = fn => ({ pointerup: e => { e.stopPropagation(); fn(e); } });
  function img(key, opt, cls) { return el('img', { src: imgURL(key, opt), class: cls || 'pix', draggable: 'false' }); }

  function init() {
    const st = document.getElementById('stage');
    let down = null;
    st.addEventListener('pointerdown', e => { if (e.target.closest('.act,.hud,.fortbar')) return; down = [e.clientX, e.clientY, Date.now()]; });
    st.addEventListener('pointerup', e => {
      if (!down || e.target.closest('.act,.hud,.fortbar')) return;
      const r = st.getBoundingClientRect(); if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 30) onTap(e.clientX - r.left, e.clientY - r.top); down = null;
    });
    document.querySelectorAll('.mood').forEach(b => b.addEventListener('pointerup', e => { e.preventDefault(); Audio2.blip(12, 'square', 0.08); setMood(b.dataset.mood); }));
    document.getElementById('mapBtn').addEventListener('pointerup', e => { e.stopPropagation(); openMap(); });
    document.getElementById('weatherBtn').addEventListener('pointerup', e => { e.stopPropagation(); toggleWeather(); });
    document.getElementById('moodToggle').addEventListener('pointerup', e => { e.stopPropagation(); document.getElementById('moodbar').classList.toggle('collapsed'); });
    document.getElementById('playBtn').addEventListener('pointerup', () => startGame());
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ------------- speech bubble that follows an entity
  function bubble(ent, icon, ms) {
    for (const b of bubbles.filter(b => b.ent === ent)) { b.node.remove(); bubbles.splice(bubbles.indexOf(b), 1); }
    const node = el('div', { class: 'say' }, icon); fx().append(node);
    const b = { ent, node, until: performance.now() + ms }; bubbles.push(b); place(b);
  }
  function entTop(e) {
    if (e === marina) return e.y + e.offY - 80 * e.scale;
    if (e.id === 'miles') return (e.spot === 'crib' ? BACK - 10 : 156) - 40;
    if (e.id === 'niko') return (e.perchY || e.y) - 40;
    if (e.id === 'mommy' && e.state === 'sit') return e.y - 92;
    if (e.state === 'lie') return e.y - 34; if (e.state === 'horse') return e.y - 70;
    return e.y - (e.prop ? 0 : 96) + (e.prop ? 0 : 6);
  }
  function place(b) { const [sx, sy] = toScreen(b.ent.x, entTop(b.ent)); b.node.style.left = sx + 'px'; b.node.style.top = sy + 'px'; b.node.style.display = (b.ent.here === false) ? 'none' : ''; }

  // ------------- action ring
  function actions(anchor, list) {
    closeActions(); if (!list || !list.length) return;
    Audio2.blip(9, 'triangle', 0.06, 0.1);
    acts = { anchor, nodes: [] };
    // lots of choices: one swipeable strip under the top bar, so nothing in the scene is covered
    const stW = document.getElementById('stage').clientWidth, tray = list.length * 80 > stW - 8 ? el('div', { class: 'acttray' }) : null;
    if (tray) { acts.tray = tray; fx().append(tray); }
    list.forEach((a, i) => {
      const n = el('button', { class: 'act', on: tap(() => { closeActions(); Audio2.blip(14, 'square', 0.05, 0.1); a.fn(); }) }, a.img ? img(a.img) : a.ico);
      n.style.animationDelay = (i * 0.04) + 's'; (tray || fx()).append(n); acts.nodes.push(n);
    });
    placeActs();
  }
  // screen-space box of whatever the buttons belong to
  function anchorRect(a) {
    let x0, y0, x1, y1;
    if (a.prop) { const p = a.prop, sc = p.scale || 1, b = p.k && !p.k.startsWith('p:') ? visBox(p.k).map(n => n * sc) : [-(p.w || 20) / 2, -(p.h || 30), (p.w || 20) / 2, 0]; x0 = p.x + b[0]; y0 = p.y + b[1]; x1 = p.x + b[2]; y1 = p.y + b[3]; }
    else if (a.id) { const t = entTop(a) + 8; x0 = a.x - 16; x1 = a.x + 16; y0 = t; y1 = (a === marina ? a.y + a.offY : a.id === 'miles' || a.id === 'niko' ? t + 34 : a.y); }
    else { x0 = a.x - 10; x1 = a.x + 10; y0 = a.y - 8; y1 = a.y + 12; }
    const [sx0, sy0] = toScreen(x0, y0), [sx1, sy1] = toScreen(x1, y1); return [sx0, sy0, sx1, sy1];
  }
  const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  function placeActs() {
    if (!acts || acts.tray) return; const a = acts.anchor;
    const st = document.getElementById('stage').getBoundingClientRect(), n = acts.nodes.length;
    // tidy rows of buttons that never overlap each other, put where they cover neither the thing tapped, nor Marina, nor the top bar
    const GAP = 80, per = Math.max(2, Math.min(n, n > 6 ? Math.ceil(n / 2) : n, Math.floor((st.width - 16) / GAP))), rows = Math.ceil(n / per), BW = per * GAP, BH = rows * GAP;
    const R = anchorRect(a), M = anchorRect(marina), cxA = (R[0] + R[2]) / 2, cyA = (R[1] + R[3]) / 2;
    const avoid = [[R, 3], [M, 2], [[0, 0, st.width, 62], 4], [[0, st.height - 74, 110, st.height], 2]];
    for (const e of ENTS) if (e.here && e !== marina && e !== a && e.id !== 'miles') avoid.push([anchorRect(e), 0.6]);
    const cands = [[cxA - BW / 2, R[1] - BH - 6], [cxA - BW / 2, R[3] + 6], [R[2] + 8, cyA - BH / 2], [R[0] - BW - 8, cyA - BH / 2], [R[2] + 8, R[1] - BH / 2], [R[0] - BW - 8, R[1] - BH / 2], [cxA - BW / 2, st.height - BH - 6], [st.width - BW - 6, 66], [6, 66]];
    let best = null, bs = 1e18;
    cands.forEach(([x, y], i) => {
      const cx = clamp(x, 4, Math.max(4, st.width - BW - 4)), cy = clamp(y, 64, Math.max(64, st.height - BH - 4)), box = [cx, cy, cx + BW, cy + BH];
      let sc = i * 40 + (Math.abs(cx - x) + Math.abs(cy - y)) * 3 + Math.hypot(cx + BW / 2 - cxA, cy + BH / 2 - cyA) * 0.6;
      for (const [r, w] of avoid) sc += overlap(box, r) * w;
      if (sc < bs) { bs = sc; best = [cx, cy]; }
    });
    if (acts.pos && Math.hypot(acts.pos[0] - best[0], acts.pos[1] - best[1]) < 40) best = acts.pos; acts.pos = best; // don't jitter while things move
    acts.nodes.forEach((node, i) => {
      const r = Math.floor(i / per), inRow = r === rows - 1 ? n - r * per : per, c = i - r * per;
      node.style.left = best[0] + BW / 2 + (c - (inRow - 1) / 2) * GAP + 'px'; node.style.top = best[1] + GAP / 2 + r * GAP + 'px';
    });
  }
  function closeActions() { if (acts) { acts.nodes.forEach(n => n.remove()); if (acts.tray) acts.tray.remove(); acts = null; } }

  function update() {
    const now = performance.now();
    for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; if (now > b.until) { b.node.remove(); bubbles.splice(i, 1); } else place(b); }
    if (acts) { if (acts.anchor.here === false) closeActions(); else placeActs(); }
  }

  // ------------- moods
  function pulseMoods() { const m = document.getElementById('moodbar'); m.classList.add('pulse'); m.classList.remove('collapsed'); clearTimeout(pulseMoods.t); pulseMoods.t = setTimeout(unpulseMoods, 7000); }
  function unpulseMoods() { document.getElementById('moodbar').classList.remove('pulse'); }
  function markMood(m) { document.querySelectorAll('.mood').forEach(b => b.classList.toggle('cur', b.dataset.mood === m)); document.getElementById('moodToggle').textContent = { love: '🥰', happy: '😄', sad: '😢', angry: '😠', tantrum: '😭' }[m]; }
  function flash() { let f = document.querySelector('.flash'); if (!f) { f = el('div', { class: 'flash' }); document.body.append(f); } f.style.transition = 'none'; f.style.opacity = 0.8; requestAnimationFrame(() => { f.style.transition = 'opacity .35s'; f.style.opacity = 0; }); }
  function bigIcon(ch, ms = 1200) { const n = el('div', { style: { position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', fontSize: '90px', pointerEvents: 'none', animation: 'pop .3s both', zIndex: 8, textShadow: '0 6px 0 rgba(0,0,0,.3)' } }, ch); fx().append(n); setTimeout(() => n.remove(), ms); }

  // ------------- fort tray
  function fortTray(show) {
    let bar = document.querySelector('.fortbar'); if (bar) bar.remove();
    if (!show || !G.fort) return;
    bar = el('div', { class: 'fortbar', style: { position: 'absolute', left: '8px', right: '8px', bottom: '8px', display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px', background: 'rgba(58,47,87,.9)', borderRadius: '18px', zIndex: 9 } });
    for (const d of FORT_PIECES) bar.append(el('button', { class: 'tile', style: { width: '64px', flex: '0 0 64px' }, on: tap(() => { approach(G.fort.x, () => addFortPiece(d), 28); setTimeout(refresh, 50); }) }, img(d.key)));
    const done = el('button', { class: 'tile', style: { width: '64px', flex: '0 0 64px', background: '#7bd36b' }, on: tap(() => { fortTray(false); if (G.fort && G.fort.complete) enterFort(); }) }, '✅');
    const refresh = () => { done.style.opacity = G.fort && G.fort.complete ? 1 : 0.35; };
    bar.append(done); refresh();
    document.getElementById('stage').append(bar);
  }

  // ------------- panel scaffolding
  function openPanel(mode, title, body, onClose) {
    panelMode = mode; setMusic(); closeActions();
    const p = document.getElementById('panel'); p.innerHTML = ''; p.classList.remove('hidden');
    const close = el('button', { class: 'pbtn', on: tap(() => { closePanel(); onClose && onClose(); }) }, '❌');
    p.append(el('div', { class: 'ptop' }, close, el('div', { class: 'ttl' }, title), el('div', { style: { width: '60px' } })));
    const b = el('div', { class: 'pbody' }); p.append(b); body(b, p); return p;
  }
  function closePanel() { document.getElementById('panel').classList.add('hidden'); panelMode = null; setMusic(); }

  // =========================================================== COOKING
  const METHODS = [['stack', '🥪'], ['mix', '🥄'], ['fry', '🍳'], ['bake', '🔥'], ['freeze', '❄️'], ['blend', '🌀']];
  // Step 1: pick ingredients (Marina says each one) -> Step 2: pick how to cook -> Step 3: cook -> Step 4: result
  const SHELVES = [['fridge', '🧊'], ['freezer', '❄️'], ['cabinet', '🗄️'], ['bowl', '🧺']];
  let cookChosen = [], cookShelf = 'fridge';
  function openCook(where, keep) {
    if (!keep) { cookChosen = []; say('m_cooking'); }
    if (where) cookShelf = where;
    Audio2.preload(PANTRY[cookShelf].map(k => 'assets/vo/w_i_' + k + '.mp3'));
    openPanel('cook', '🧑‍🍳', (b) => {
      const tray = el('div', { class: 'tray' }); const grid = el('div', { class: 'grid ing' }); const srow = el('div', { class: 'row shelves' });
      const ctl = el('div', { class: 'row' });
      const undo = el('button', { class: 'pbtn', 'aria-label': 'undo', on: tap(() => { if (cookChosen.pop()) Audio2.blip(-5); redraw(); }) }, '↩️');
      const clear = el('button', { class: 'pbtn', 'aria-label': 'start over', on: tap(() => { cookChosen = []; Audio2.whoosh(false); redraw(); }) }, '🗑️');
      const next = el('button', { class: 'pbtn go', 'aria-label': 'next', on: tap(() => { if (cookChosen.length) { Audio2.jingle([0, 4, 7]); chooseMethod(); } }) }, '✅');
      ctl.append(undo, clear, next);
      const redraw = () => {
        tray.innerHTML = '';
        for (let i = 0; i < 5; i++) {
          const k = cookChosen[i];
          tray.append(k ? el('button', { class: 'slot full', on: tap(() => { Audio2.voice('w_i_' + k, 'marina', { cut: true }); cookChosen.splice(i, 1); Audio2.blip(-5); redraw(); }) }, img('ing_' + k), el('span', { class: 'x' }, '✖'))
            : el('div', { class: 'slot' }, i === cookChosen.length ? '⬇️' : ''));
        }
        undo.disabled = clear.disabled = !cookChosen.length; next.disabled = !cookChosen.length; next.classList.toggle('pulse', cookChosen.length > 0);
        grid.querySelectorAll('.tile').forEach(t => { const n = cookChosen.filter(c => c === t.dataset.k).length; t.querySelector('.n').textContent = n ? '✔' + (n > 1 ? n : '') : ''; t.classList.toggle('sel', n > 0); });
      };
      const fill = () => {
        grid.innerHTML = ''; srow.querySelectorAll('.pbtn').forEach((x, i) => x.classList.toggle('on', SHELVES[i][0] === cookShelf));
        for (const k of PANTRY[cookShelf]) grid.append(el('button', { class: 'tile', 'data-k': k, on: tap(() => {
          Audio2.voice('w_i_' + k, 'marina', { cut: true });
          if (cookChosen.length >= 5) { Audio2.blip(-12); tray.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 220); return; }
          cookChosen.push(k); Audio2.blip(pick([0, 2, 4, 7, 9, 12])); redraw(); }) }, img('ing_' + k), el('span', { class: 'n' })));
        redraw();
      };
      for (const [s, ico] of SHELVES) srow.append(el('button', { class: 'pbtn', on: tap(() => { cookShelf = s; Audio2.whoosh(); Audio2.preload(PANTRY[s].map(k => 'assets/vo/w_i_' + k + '.mp3')); fill(); }) }, ico));
      b.append(tray, ctl, srow, grid); fill();
    });
  }
  function chooseMethod() {
    const p = document.getElementById('panel'); const b = p.querySelector('.pbody'); b.innerHTML = '';
    const tray = el('div', { class: 'tray small' }, ...cookChosen.map(k => el('div', { class: 'slot full' }, img('ing_' + k))));
    const grid = el('div', { class: 'methods' });
    for (const [m, ico] of METHODS) grid.append(el('button', { class: 'method', 'data-m': m, on: tap(() => runMethod(m, [...cookChosen])) }, el('span', {}, ico)));
    const back = el('button', { class: 'pbtn', 'aria-label': 'back', on: tap(() => openCook(null, true)) }, '⬅️');
    b.append(tray, grid, el('div', { class: 'row' }, back));
  }
  async function runMethod(method, ings) {
    const p = document.getElementById('panel'); const body = p.querySelector('.pbody'); body.innerHTML = '';
    const ico = el('div', { class: 'big-ico', style: { fontSize: '110px' } }, METHODS.find(m => m[0] === method)[1]);
    const pics = el('div', { class: 'row' }, ...ings.map(k => el('div', { class: 'tile', style: { width: '64px' } }, img('ing_' + k))));
    body.append(pics, ico);
    let timing = null;
    const anim = (n, f) => { let i = 0; return new Promise(r => { const iv = setInterval(() => { f(i++); if (i >= n) { clearInterval(iv); r(); } }, 90); }); };
    if (method === 'mix') { say('m_mix'); await anim(22, i => { ico.style.transform = `rotate(${Math.sin(i) * 30}deg)`; if (i % 3 === 0) Audio2.blip(pick([0, 4, 7]), 'square', 0.05, 0.1); }); }
    if (method === 'stack') { await anim(ings.length * 4 + 4, i => { ico.style.transform = `translateY(${-Math.abs(Math.sin(i / 2)) * 30}px)`; if (i % 4 === 0) Audio2.blip(i / 2, 'square', 0.06, 0.12); }); }
    if (method === 'freeze') { Audio2.whoosh(false); await anim(18, i => { ico.style.filter = `hue-rotate(${i * 10}deg) brightness(${1 + i * 0.03})`; if (i % 4 === 0) Audio2.blip(19 + i % 5, 'sine', 0.2, 0.08); }); }
    if (method === 'blend') { Audio2.sfx('blender'); await anim(22, i => { ico.style.transform = `rotate(${i * 50}deg) scale(${1 + Math.sin(i) * 0.1})`; }); }
    if (method === 'fry' || method === 'bake') {
      Audio2.sfx(method === 'fry' ? 'sizzle' : 'oven_ding', { vol: method === 'fry' ? 1 : 0.4 });
      timing = await meter(body, method);
      if (method === 'bake') Audio2.sfx('oven_ding');
    }
    const dish = makeDish(ings, method, timing);
    showDish(body, dish);
  }
  function meter(body, method) {
    return new Promise(res => {
      const m = el('div', { class: 'meter' }), knob = el('i'); m.append(knob);
      const stop = el('button', { class: 'pbtn', style: { fontSize: '48px', height: '90px', width: '90px', borderRadius: '50%', margin: '0 auto', display: 'block' } }, '🛑');
      body.append(m, stop);
      let x = 0, dir = 1, done = false; const sp = method === 'fry' ? 0.9 : 0.6;
      let lastT = performance.now();
      const step = (t) => { if (done) return; const dt = (t - lastT) / 1000; lastT = t; x += dir * sp * dt; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } knob.style.left = `calc(${x * 100}% - 6px)`; if (chance(0.05)) Audio2.noise(0.05, 0.1, 2000); requestAnimationFrame(step); };
      requestAnimationFrame(step);
      stop.addEventListener('pointerup', e => { e.stopPropagation(); done = true; Audio2.blip(0); res(x < 0.55 ? 'good' : x < 0.75 ? 'ok' : 'burnt'); });
    });
  }
  function makeDish(ings, method, timing) {
    const tags = ings.map(k => ING[k]), all = tags.join(''), cnt = c => (all.match(new RegExp(c, 'g')) || []).length, has = k => ings.includes(k);
    let score = 1;
    score -= cnt('x') * 1.5;
    for (let i = 0; i < ings.length; i++) for (let j = i + 1; j < ings.length; j++) {
      const a = ings[i], b = ings[j];
      if (GOOD.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) score += 2;
      for (const [p, t] of CLASH) { if ((a === p && (t === '*' || ING[b].includes(t))) || (b === p && (t === '*' || ING[a].includes(t)))) score -= 2; }
    }
    const dup = ings.length - new Set(ings).size; score -= dup * 0.5;
    const M = { stack: () => (cnt('c') ? 1 : 0) - cnt('l'), mix: () => (cnt('f') + cnt('g') ? 1 : 0) - (cnt('m') ? 2 : 0), fry: () => (has('eggs') || cnt('m') || cnt('c') ? 1 : 0) - (cnt('s') >= 2 ? 2 : 0) - cnt('l'),
      bake: () => (has('flour') && (has('sugar') || has('eggs')) ? 2 : 0) + (cnt('c') ? 1 : 0) - (cnt('l') >= 2 ? 1 : 0) - (cnt('f') && cnt('m') ? 1 : 0), freeze: () => (cnt('s') || cnt('f') ? 1 : 0) - (cnt('v') || cnt('m') ? 2 : 0), blend: () => (cnt('f') || cnt('d') ? 1 : 0) - (cnt('m') ? 2 : 0) - (cnt('c') ? 1 : 0) };
    score += M[method]();
    if (timing === 'good') score += 1; if (timing === 'burnt') score = Math.min(score, -3);
    score = Math.round(clamp(score, -6, 5));
    const sweet = cnt('s') >= Math.max(1, cnt('v') + cnt('m')), gross = score <= -2;
    let art;
    if (timing === 'burnt') art = 'burnt';
    else switch (method) {
      case 'stack': art = has('sausage') ? 'hotdog' : (has('flour') || has('eggs')) && sweet ? 'pancakes' : ings.length >= 3 ? 'tower' : has('bread') ? (ings.length === 1 ? 'toast' : 'sandwich') : sweet ? 'rainbowcake' : 'tower'; break;
      case 'mix': art = gross ? (has('catfood') || cnt('x') >= 2 ? 'slime' : 'sludge') : sweet ? 'pudding' : (cnt('f') + cnt('g')) ? 'salad' : 'casserole'; break;
      case 'fry': art = gross ? 'sludge' : has('rice') ? 'friedrice' : has('pasta') ? 'spaghetti' : has('fish') ? 'fishdish' : has('eggs') ? 'omelette' : has('sausage') ? 'hotdog' : cnt('l') ? 'soup' : cnt('m') ? 'stew' : sweet ? 'pancakes' : 'stew'; break;
      case 'bake': art = has('pizzabox') || (has('cheese') && has('tomato')) ? 'pizza' : has('flour') && sweet ? (has('chocolate') ? 'cookies' : has('sprinkles') ? 'cupcakes' : cnt('f') ? 'pie' : 'cake') : has('bread') ? 'toast' : gross ? 'casserole' : sweet ? 'cupcakes' : 'casserole'; break;
      case 'freeze': art = gross ? 'frozenmess' : has('icecream') || has('whip') ? 'sundae' : cnt('f') || cnt('l') ? 'popsicle' : sweet ? 'sundae' : 'iceblock'; break;
      case 'blend': art = gross ? 'grossshake' : has('chocolate') || has('icecream') || has('milk') ? 'milkshake' : cnt('f') ? 'smoothie' : cnt('g') ? 'grossshake' : 'smoothie'; break;
    }
    const grossArt = ['burnt', 'slime', 'sludge', 'grossshake', 'frozenmess'].includes(art);
    const tint = gross && !grossArt ? [110, 170, 50, 0.38] : null;
    const NOUN = { cake: 'Cake', cupcakes: 'Cupcakes', pancakes: 'Pancakes', smoothie: 'Smoothie', milkshake: 'Milkshake', soup: 'Soup', sandwich: 'Sandwich', tower: 'Tower', pizza: 'Pizza', spaghetti: 'Spaghetti',
      omelette: 'Omelette', cookies: 'Cookies', pie: 'Pie', popsicle: 'Ice Pop', sundae: 'Sundae', iceblock: 'Ice Block', salad: 'Salad', burnt: 'Charcoal Surprise', slime: 'Slime', sludge: 'Sludge', friedrice: 'Fried Rice',
      toast: 'Toast', pudding: 'Wobble Pudding', casserole: 'Casserole', hotdog: 'Hot Dog', fishdish: 'Fish Feast', stew: 'Stew', rainbowcake: 'Rainbow Stack', grossshake: 'Swamp Shake', frozenmess: 'Frozen Mystery' };
    const ADJ = { stack: ['Wobbly', 'Mega', 'Tippy'], mix: ['Mixy', 'Swirly', 'Squishy'], fry: ['Crispy', 'Sizzly', 'Golden'], bake: ['Baked', 'Puffy', 'Toasty'], freeze: ['Frosty', 'Brrr', 'Icy'], blend: ['Whizzy', 'Zoomy', 'Bubbly'] };
    const adj = score >= 3 ? pick(['Magic', 'Super', 'Princess', 'Yummy']) : score <= -3 ? pick(['Stinky', 'Spooky', 'Gloopy', 'Monster']) : pick(ADJ[method]);
    // the name is spoken as whole phrases: "Magic Cake!" + "…with eggs," + "strawberry" + "…and milk!" (every ingredient she put in)
    const uniq = [...new Set(ings)], words = uniq.map(k => ING_WORD[k]);
    const name = `${adj} ${DISH_WORD[art]}` + (words.length ? ' with ' + (words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0]) : '');
    const say = ['dn_' + adj.toLowerCase() + '_' + art, ...uniq.map((k, i) => (i === 0 ? 'wi_' : i === uniq.length - 1 ? 'an_' : 'w_i_') + k)];
    return { art, score, name, tint, ings, method, say };
  }
  function showDish(body, d) {
    body.innerHTML = '';
    const c = document.createElement('canvas'); const s = spriteCanvas('dish_' + d.art, d.tint ? { tint: d.tint } : null); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0);
    const faces = d.score >= 3 ? '😋😋😋' : d.score >= 1 ? '😋😋' : d.score >= 0 ? '🙂' : d.score >= -2 ? '😬' : d.score >= -4 ? '🤢🤢' : '🤮🤮🤮';
    c.addEventListener('pointerup', () => { Audio2.hush('marina'); Audio2.chain(d.say); }); const res = el('div', { class: 'result' }, c, el('div', { class: 'stars' }, faces),
      el('div', { style: { fontSize: '22px', opacity: .85 } }, d.name),
      // give it straight to someone: they come over and she hands it to them
      el('div', { class: 'row giverow' }, el('span', { style: { fontSize: '34px' } }, '🎁'),
        ...['daddy', 'mommy', 'rory'].map(w => el('button', { class: 'pbtn givebtn', 'aria-label': 'give it to ' + w, on: tap(() => { closePanel(); finishDish(d); giveDishTo(w); }) }, img(w)))),
      el('div', { class: 'row' },
        el('button', { class: 'pbtn', 'aria-label': 'carry it', style: { width: '90px', height: '90px', fontSize: '48px' }, on: tap(() => { closePanel(); finishDish(d); say('m_yay'); }) }, '✅'),
        el('button', { class: 'pbtn', style: { width: '90px', height: '90px', fontSize: '48px' }, 'aria-label': 'other way', on: tap(() => chooseMethod()) }, '⬅️'),
        el('button', { class: 'pbtn', style: { width: '90px', height: '90px', fontSize: '48px' }, 'aria-label': 'start again', on: tap(() => openCook()) }, '🔁')));
    body.append(res);
    Audio2.jingle(d.score >= 0 ? [0, 4, 7, 12, 16] : [12, 11, 6, 1, -6], 0.09, d.score >= 0 ? 'square' : 'sawtooth');
    for (let i = 0; i < 20; i++) emit('confetti', marina.x, marina.y - 60);
    setTimeout(() => Audio2.chain(d.say), 500);
    setTimeout(() => say(d.score >= 1 ? 'm_wow' : d.score >= 0 ? 'm_yummy' : 'm_giggle'), 2400);
  }

  // =========================================================== DRESS-UP
  const HAIRS = { ginger: '#eba864', blonde: '#f2cf6b', brown: '#7a4a26', black: '#2a2730', pink: '#ff7ab8', blue: '#4aa8ff', purple: '#a46cf0', green: '#5fcf6a', rainbow: 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' };
  function outfitList() { return ['default', ...Object.keys(E.A).filter(k => /^o_[a-z]+$/.test(k)).map(k => k.slice(2))]; }
  const lookStore = { get(k, d) { try { return JSON.parse(localStorage.getItem('cm_' + k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) { } } };
  const curLook = () => ({ outfit: G.outfit, hair: G.hair, glasses: G.glasses, dye: G.dye || 0, look: { ...G.look } });
  const wearLook = L => { if (!L) return; G.outfit = has(L.outfit === 'default' ? 'marina' : 'o_' + L.outfit) ? L.outfit : 'default'; G.hair = L.hair || 'ginger'; G.glasses = L.glasses !== false && !(L.look && L.look.face); G.dye = L.dye || 0; G.look = { head: null, face: null, back: null, hand: null, ...(L.look || {}) }; };
  // every new game starts in her own everyday clothes (saved looks are still in the 💾 tab)
  const BACKDROPS = [['#ffd6e8', '#c9a4ff'], ['#bfe9ff', '#7bd36b'], ['#2b2340', '#7b4cf0'], ['#fff3b0', '#ff9a5a'], ['#e0fff4', '#58c7d8']];
  let backdrop = 0;
  function previewLook(cv, t = 0, walk = false) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height; x.imageSmoothingEnabled = false;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, BACKDROPS[backdrop][0]); g.addColorStop(1, BACKDROPS[backdrop][1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(W / 2, H - 8, 30, 6, 0, 0, 6.3); x.fill();
    for (let i = 0; i < 6; i++) { const a = t * 0.8 + i; x.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(a * 3)})`; x.fillRect(W / 2 + Math.cos(a) * 40, 20 + ((i * 17 + t * 12) % (H - 40)), 2, 2); }
    const sc = E.ctx, scam = E.camX, sd = E.depth; E.ctx = x; E.camX = 0; E.depth = 1;
    const k = walk ? (frameKey(mWalk(), t, 9) || mBase()) : mBase(), bob = walk ? 0 : Math.sin(t * 3) * 1;
    drawLook({ x: W / 2, dir: 1 }, mBase(), H - 10 + bob, false, 1, 'back'); drawSprite(k, W / 2, H - 10 + bob, { opt: mOpt() }); drawLook({ x: W / 2, dir: 1 }, mBase(), H - 10 + bob, false, 1, 'front');
    E.ctx = sc; E.camX = scam; E.depth = sd;
  }
  function openDress() {
    say('m_pretty'); let tab = 'outfit', raf = 0, walk = false;
    const p = openPanel('dress', '👗', (b) => {
      const prev = el('canvas', { width: 110, height: 96, class: 'dprev' });
      const tabs = el('div', { class: 'row tabs' }); const area = el('div', { class: 'grid dgrid' });
      const TABS = [['outfit', '👗'], ['dye', '🎨'], ['hair', '💇'], ['head', '👑'], ['face', '🕶️'], ['back', '🦋'], ['hand', '🪄'], ['looks', '💾']];
      const sync = () => { tabs.querySelectorAll('.pbtn').forEach((t, i) => t.classList.toggle('on', TABS[i][0] === tab)); lookStore.set('look', curLook()); };
      const loop = () => { if (document.getElementById('panel').classList.contains('hidden') || !prev.isConnected) return; previewLook(prev, performance.now() / 1000, walk); raf = requestAnimationFrame(loop); };
      const choose = (fn) => () => { fn(); Audio2.blip(pick([0, 4, 7, 9, 12])); prev.animate([{ transform: 'scale(1.08) rotate(-3deg)' }, { transform: 'none' }], 220); fill(); sync(); };
      const fill = () => {
        area.innerHTML = '';
        if (tab === 'outfit') outfitList().forEach(id => area.append(el('button', { class: 'tile' + (G.outfit === id ? ' sel' : ''), on: tap(choose(() => { G.outfit = id; Audio2.jingle([0, 7, 12], 0.05); })) }, img(id === 'default' ? 'marina' : 'o_' + id, mOpt()))));
        else if (tab === 'dye') [0, 40, 80, 130, 180, 220, 270, 310].forEach(h => area.append(el('button', { class: 'tile' + ((G.dye || 0) === h ? ' sel' : ''), on: tap(choose(() => { G.dye = h; })) }, h ? img(mBase(), { ...(mOpt() || {}), dye: h }) : '🚫')));
        else if (tab === 'hair') Object.entries(HAIRS).forEach(([h, c]) => area.append(el('button', { class: 'tile' + (G.hair === h ? ' sel' : ''), on: tap(choose(() => { G.hair = h; })) }, el('span', { class: 'swatch', style: { background: c } }))));
        else if (tab === 'looks') {
          const saved = lookStore.get('looks', []);
          area.append(el('button', { class: 'tile', style: { background: '#7bd36b' }, 'aria-label': 'save this look', on: tap(() => { const L = curLook(); const cvs = el('canvas', { width: 110, height: 96 }); previewLook(cvs, 0); L.pic = cvs.toDataURL(); saved.unshift(L); lookStore.set('looks', saved.slice(0, 11)); Audio2.jingle([0, 4, 7, 12]); fill(); }) }, '➕'));
          saved.forEach((L, i) => { const t = el('button', { class: 'tile', on: tap(choose(() => wearLook(L))) }, el('img', { src: L.pic, class: 'pix' })); area.append(t); });
        } else {
          const items = lookItems(tab);
          // face: nothing at all, her own purple glasses, or something else INSTEAD of her glasses (never both at once)
          if (tab === 'face') {
            area.append(el('button', { class: 'tile' + (!G.look.face && !G.glasses ? ' sel' : ''), 'aria-label': 'no glasses', on: tap(choose(() => { G.look.face = null; G.glasses = false; })) }, '🚫'));
            area.append(el('button', { class: 'tile' + (!G.look.face && G.glasses ? ' sel' : ''), 'aria-label': 'her own glasses', on: tap(choose(() => { G.look.face = null; G.glasses = true; })) }, '👓'));
          } else area.append(el('button', { class: 'tile' + (!G.look[tab] ? ' sel' : ''), on: tap(choose(() => { G.look[tab] = null; })) }, '🚫'));
          items.forEach(it => area.append(el('button', { class: 'tile' + (G.look[tab] === it.id ? ' sel' : ''), on: tap(choose(() => { G.look[tab] = it.id; if (tab === 'face') G.glasses = false; })) }, it.key ? img(it.key) : el('span', { style: { fontSize: '40px' } }, it.emoji))));
        }
      };
      TABS.forEach(([t, ico]) => tabs.append(el('button', { class: 'pbtn', on: tap(() => { tab = t; Audio2.whoosh(); fill(); sync(); }) }, ico)));
      const rand = el('button', { class: 'pbtn', 'aria-label': 'random look', on: tap(choose(() => {
        G.outfit = pick(outfitList()); G.hair = chance(0.6) ? 'ginger' : pick(Object.keys(HAIRS)); G.dye = chance(0.4) ? pick([40, 80, 130, 180, 220, 270, 310]) : 0;
        for (const s of ['head', 'face', 'back', 'hand']) { const its = lookItems(s); G.look[s] = chance(0.55) && its.length ? pick(its).id : null; }
        Audio2.jingle([0, 4, 7, 12, 16], 0.05); })) }, '🎲');
      const photo = el('button', { class: 'pbtn', 'aria-label': 'photo', on: tap(() => {
        const o = el('canvas', { width: 330, height: 288 }), x = o.getContext('2d'); x.imageSmoothingEnabled = false; const c = el('canvas', { width: 110, height: 96 }); previewLook(c, 1.2); x.drawImage(c, 0, 0, 330, 288);
        const g = lookStore.get('gallery', []); g.unshift(o.toDataURL('image/jpeg', 0.85)); lookStore.set('gallery', g.slice(0, 16));
        Audio2.noise(0.08, 0.4, 3000); flash(); prev.animate([{ filter: 'brightness(3)' }, { filter: 'none' }], 300); say(pick(['m_cool', 'm_pretty'])); }) }, '📸');
      const bg = el('button', { class: 'pbtn', 'aria-label': 'backdrop', on: tap(() => { backdrop = (backdrop + 1) % BACKDROPS.length; Audio2.blip(5); }) }, '🌈');
      const spin = el('button', { class: 'pbtn', 'aria-label': 'walk', on: tap(() => { walk = !walk; spin.classList.toggle('on', walk); Audio2.blip(9); }) }, '🚶');
      const done = el('button', { class: 'pbtn go', 'aria-label': 'done', on: tap(() => { closePanel(); sync(); addMess(G.room, 2, ['👗', '👚', '🧦', '👠']); fashionShow(); }) }, '✅');
      b.append(el('div', { class: 'dtop' }, el('div', { class: 'dcol' }, rand, bg, spin), prev, el('div', { class: 'dcol' }, photo, done)), tabs, area); fill(); sync(); loop();
    });
  }
  // runway: she struts across the room, sparkles and camera flashes, family cheers
  function fashionShow() {
    Audio2.Music.set('dress'); emit('confetti', marina.x, marina.y - 60, 40); window.reactTo && reactTo('style', 2600);
    say(G.outfit === 'fairy' ? 'm_fairy' : G.outfit === 'princess' ? 'm_princess' : pick(['m_look', 'm_cool', 'm_pretty']));
    const W = ROOMS[G.room].w, to = marina.x < W / 2 ? Math.min(W - 30, marina.x + 150) : Math.max(30, marina.x - 150);
    const iv = setInterval(() => { emit('sparkle', marina.x + rnd(-10, 10), marina.y - rnd(10, 70), 2); if (chance(0.25)) emit('star', marina.x, marina.y - 70, 1); }, 90);
    const fl = setInterval(() => { if (chance(0.6)) { emoji; emit('heart', marina.x + rnd(-60, 60), marina.y - rnd(40, 100), 1, { ch: '📸', vx: 0, vy: -6, life: 0.7, size: 11 }); Audio2.noise(0.04, 0.15, 4000); } }, 450);
    marina.walkTo(to, () => {
      clearInterval(iv); clearInterval(fl); marina.state = 'cheer'; setTimeout(() => marina.state === 'cheer' && (marina.state = 'idle'), 1600); setMusic();
      const fans = [daddy, mommy, rory].filter(e => e.here && !['toilet', 'lie'].includes(e.state) && !(e === rory && !G.rory));
      if (fans.length) { const f = pick(fans); f.dir = Math.sign(marina.x - f.x) || 1; Audio2.sfx('crowd_cheer', { vol: 0.4 }); say(f === daddy ? pick(['d_amazing', 'd_proud']) : f === mommy ? pick(['mo_amazing', 'mo_proud']) : 'r_amazing', f).then(() => emit('heart', f.x, f.y - 90, 6)); }
    }, 55, FLOOR);
    setTimeout(() => { clearInterval(iv); clearInterval(fl); }, 6000);
  }

  // =========================================================== CRAFTS
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cm_' + k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) { } } };
  let craftTab = 'draw';
  function openCrafts(tab) {
    craftTab = tab || craftTab; say(craftTab === 'math' || craftTab === 'spell' ? 'm_hmm' : 'm_draw');
    openPanel('crafts', '🎨', (b, p) => {
      const tabs = el('div', { class: 'row' });
      const area = el('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 } });
      const T = [['draw', '🖍️'], ['cut', '✂️'], ['dio', '🏞️'], ['gal', '🖼️'], ['math', '➕'], ['spell', '🔤']];
      const show = t => { craftTab = t; tabs.querySelectorAll('.pbtn').forEach((x, i) => x.classList.toggle('on', T[i][0] === t)); area.innerHTML = ''; ({ draw: drawTab, cut: cutTab, dio: dioTab, gal: galTab, math: mathTab, spell: spellTab })[t](area); };
      T.forEach(([t, ico]) => tabs.append(el('button', { class: 'pbtn', on: tap(() => { Audio2.blip(5); show(t); }) }, ico)));
      b.append(tabs, area); show(craftTab);
      addMess('dining', 2, ['📄', '🖍️', '✂️']);
    });
  }
  const COLORS = ['#e8312a', '#ff8a1e', '#ffd21e', '#4cc94a', '#2a9df4', '#7b4cf0', '#ff6ab8', '#7a4a26', '#111111', '#ffffff'];
  function sizeCanvas(c) { const r = c.getBoundingClientRect(); const d = Math.min(2, devicePixelRatio || 1); if (c.width !== Math.round(r.width * d)) { const old = c.width ? c.toDataURL() : null; c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); if (old) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, c.width, c.height); im.src = old; } } return d; }
  function drawTab(area) {
    const cv = el('canvas', { id: 'drawCv' }); let col = COLORS[0], pen = 'marker', stamp = null;
    const pens = [['pencil', '✏️'], ['crayon', '🖍️'], ['marker', '🖌️'], ['glitter', '✨'], ['rainbow', '🌈'], ['erase', '🧽']];
    const penRow = el('div', { class: 'row' }), colRow = el('div', { class: 'row' }), stRow = el('div', { class: 'row' });
    pens.forEach(([p, i]) => penRow.append(el('button', { class: 'pbtn' + (p === pen ? ' on' : ''), on: tap(e => { pen = p; stamp = null; penRow.querySelectorAll('.pbtn').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); }) }, i)));
    COLORS.forEach(c => colRow.append(el('button', { class: 'swatch' + (c === col ? ' sel' : ''), style: { background: c }, on: tap(e => { col = c; colRow.querySelectorAll('.swatch').forEach(b => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); }) })));
    ['⭐', '💖', '🐱', '🌈', '🦄', '🌸'].forEach(s => stRow.append(el('button', { class: 'pbtn', on: tap(() => { stamp = s; }) }, s)));
    stRow.append(el('button', { class: 'pbtn', on: tap(() => { const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); Audio2.whoosh(false); }) }, '🗑️'));
    stRow.append(el('button', { class: 'pbtn', style: { background: '#7bd36b' }, on: tap(() => { saveArt(cv.toDataURL('image/jpeg', 0.7)); store.set('lastDrawing', cv.toDataURL('image/png')); say('m_did_it'); emit('confetti', marina.x, marina.y - 60, 20); Audio2.jingle([0, 4, 7, 12]); }) }, '💾'));
    area.append(penRow, colRow, cv, stRow);
    setTimeout(() => { sizeCanvas(cv); const prev = store.get('lastDrawing'); if (prev) { const im = new Image(); im.onload = () => cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); im.src = prev; } }, 30);
    let last = null, hue = 0;
    const pos = e => { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d, d]; };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); const [x, y, d] = pos(e); if (stamp) { const c = cv.getContext('2d'); c.font = (44 * d) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(stamp, x, y); Audio2.blip(pick([0, 4, 7])); return; } last = [x, y]; stroke(x, y, d); });
    cv.addEventListener('pointermove', e => { if (!last) return; const [x, y, d] = pos(e); stroke(x, y, d); });
    cv.addEventListener('pointerup', () => last = null);
    function stroke(x, y, d) {
      const c = cv.getContext('2d'); c.lineCap = c.lineJoin = 'round';
      const w = { pencil: 2, crayon: 10, marker: 14, glitter: 8, rainbow: 16, erase: 36 }[pen] * d;
      if (pen === 'crayon') { for (let i = 0; i < 6; i++) { c.fillStyle = col; c.globalAlpha = 0.5; c.fillRect(x + rnd(-w / 2, w / 2), y + rnd(-w / 2, w / 2), 2 * d, 2 * d); } c.globalAlpha = 1; }
      c.strokeStyle = pen === 'erase' ? '#fff' : pen === 'rainbow' ? `hsl(${hue = (hue + 6) % 360},90%,55%)` : col; c.lineWidth = pen === 'crayon' ? w * 0.6 : w;
      c.globalAlpha = pen === 'crayon' ? 0.6 : 1;
      c.beginPath(); c.moveTo(last[0], last[1]); c.lineTo(x, y); c.stroke(); c.globalAlpha = 1;
      if (pen === 'glitter') for (let i = 0; i < 3; i++) { c.fillStyle = pick(['#fff6a0', '#ffd0f0', '#a0f0ff', '#ffe36a']); c.fillRect(x + rnd(-12, 12) * d, y + rnd(-12, 12) * d, 3 * d, 3 * d); }
      last = [x, y];
    }
  }
  function saveArt(url) { const g = store.get('gallery', []); g.unshift(url); store.set('gallery', g.slice(0, 16)); }
  function cutTab(area) {
    const src = store.get('lastDrawing');
    const cv = el('canvas', { id: 'drawCv' }); const info = el('div', { class: 'big-ico' }, src ? '✂️' : '🖍️➡️💾');
    const pieces = el('div', { class: 'row' }); const refreshPieces = () => { pieces.innerHTML = ''; store.get('cutouts', []).forEach(u => pieces.append(el('img', { src: u, style: { height: '60px', background: 'rgba(255,255,255,.2)', borderRadius: '8px' } }))); };
    area.append(info, cv, pieces); refreshPieces();
    let img0 = null;
    setTimeout(() => { sizeCanvas(cv); if (src) { img0 = new Image(); img0.onload = () => cv.getContext('2d').drawImage(img0, 0, 0, cv.width, cv.height); img0.src = src; } }, 30);
    let path = null;
    const pos = e => { const r = cv.getBoundingClientRect(), d = cv.width / r.width; return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; };
    cv.addEventListener('pointerdown', e => { if (!img0) return; cv.setPointerCapture(e.pointerId); path = [pos(e)]; });
    cv.addEventListener('pointermove', e => { if (!path) return; const p = pos(e); path.push(p); const c = cv.getContext('2d'); c.setLineDash([8, 6]); c.strokeStyle = '#333'; c.lineWidth = 3; c.beginPath(); const q = path[path.length - 2]; c.moveTo(q[0], q[1]); c.lineTo(p[0], p[1]); c.stroke(); if (path.length % 6 === 0) Audio2.noise(0.04, 0.2, 4000); });
    cv.addEventListener('pointerup', () => {
      if (!path || path.length < 8) { path = null; return; }
      let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0; path.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const w = Math.max(10, x1 - x0), h = Math.max(10, y1 - y0), o = document.createElement('canvas'); o.width = w; o.height = h; const c = o.getContext('2d');
      c.beginPath(); path.forEach(([x, y], i) => i ? c.lineTo(x - x0, y - y0) : c.moveTo(x - x0, y - y0)); c.closePath(); c.clip();
      c.drawImage(img0, 0, 0, img0.width, img0.height, -x0, -y0, cv.width, cv.height);
      const cuts = store.get('cutouts', []); cuts.unshift(o.toDataURL()); store.set('cutouts', cuts.slice(0, 12));
      path = null; Audio2.jingle([0, 7, 12]); say('m_did_it'); const x = cv.getContext('2d'); x.setLineDash([]); x.drawImage(img0, 0, 0, cv.width, cv.height); refreshPieces();
    });
  }
  function dioTab(area) {
    const BGS = { '🌳': ['#8fd0ff', '#7cbf4a'], '🌊': ['#5ad1ff', '#1f6fb5'], '🌌': ['#1a1440', '#4a2c7a'], '🏰': ['#ffd6e8', '#b98ad8'], '🍂': ['#f3d9a8', '#b5682f'], '❄️': ['#dfe9f5', '#ffffff'] };
    let bg = '🌳';
    const stage = el('div', { class: 'dio' }); const bgc = el('canvas', { class: 'bg', width: 320, height: 200 }); stage.append(bgc);
    const paintBG = () => { const x = bgc.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, BGS[bg][0]); g.addColorStop(1, BGS[bg][1]); x.fillStyle = g; x.fillRect(0, 0, 320, 200); x.font = '30px sans-serif'; if (bg === '🌌') for (let i = 0; i < 30; i++) x.fillText('·', rnd(0, 320), rnd(0, 200)); };
    paintBG();
    const bgRow = el('div', { class: 'row' }); Object.keys(BGS).forEach(k => bgRow.append(el('button', { class: 'pbtn', on: tap(() => { bg = k; paintBG(); }) }, k)));
    const tray = el('div', { class: 'row' });
    const addPiece = (src, isPix) => {
      const n = el('img', { src, class: 'piece' + (isPix ? ' pix' : ''), draggable: 'false', style: { left: '40%', top: '35%', height: isPix ? '30%' : '35%' } });
      let drag = null, scale = 1;
      n.addEventListener('pointerdown', e => { e.stopPropagation(); n.setPointerCapture(e.pointerId); drag = [e.clientX, e.clientY, n.offsetLeft, n.offsetTop, Date.now()]; });
      n.addEventListener('pointermove', e => { if (!drag) return; n.style.left = (drag[2] + e.clientX - drag[0]) + 'px'; n.style.top = (drag[3] + e.clientY - drag[1]) + 'px'; });
      n.addEventListener('pointerup', e => { if (drag && Date.now() - drag[4] < 220 && Math.hypot(e.clientX - drag[0], e.clientY - drag[1]) < 8) { scale = scale >= 2 ? 0.6 : scale + 0.35; n.style.transform = `scale(${scale})`; Audio2.blip(scale * 5); } drag = null; });
      stage.append(n); Audio2.blip(7);
    };
    store.get('cutouts', []).forEach(u => tray.append(el('button', { class: 'tile', style: { width: '64px' }, on: tap(() => addPiece(u)) }, el('img', { src: u }))));
    ['marina', 'daddy', 'mommy', 'rory', 'miles', 'niko', 'oak_tree', 'snowman', 'dish_cake', 'cat_tower', 'sectional', 'leaf_pile'].forEach(k => tray.append(el('button', { class: 'tile', style: { width: '64px' }, on: tap(() => addPiece(imgURL(k), true)) }, img(k))));
    const save = el('button', { class: 'pbtn', style: { background: '#7bd36b' }, on: tap(() => {
      const r = stage.getBoundingClientRect(), o = document.createElement('canvas'); o.width = 480; o.height = Math.round(480 * r.height / r.width); const x = o.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(bgc, 0, 0, o.width, o.height); stage.querySelectorAll('.piece').forEach(p => { const pr = p.getBoundingClientRect(), k = o.width / r.width; x.drawImage(p, (pr.left - r.left) * k, (pr.top - r.top) * k, pr.width * k, pr.height * k); });
      saveArt(o.toDataURL('image/jpeg', 0.75)); say('m_did_it'); Audio2.jingle([0, 4, 7, 12, 16]); }) }, '💾');
    area.append(bgRow, stage, el('div', { class: 'row', style: { flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'flex-start' } }, ...tray.children), el('div', { class: 'row' }, save));
  }
  function galTab(area) {
    const g = store.get('gallery', []); const grid = el('div', { class: 'gallery' });
    if (!g.length) area.append(el('div', { class: 'big-ico' }, '🖼️❓'));
    g.forEach(u => grid.append(el('img', { src: u })));
    area.append(grid);
  }
  // ---- maths
  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  function mathTab(area) {
    const fruit = pick(['🍎', '🍓', '🍪', '🐟', '⭐', '🧁']);
    const add = chance(0.6); let a, b, ans;
    if (add) { a = 1 + (Math.random() * 5 | 0); b = 1 + (Math.random() * 4 | 0); ans = a + b; } else { a = 2 + (Math.random() * 7 | 0); b = 1 + (Math.random() * (a - 1) | 0); ans = a - b; }
    const grp = (n, cross = 0) => el('div', { style: { fontSize: '30px', maxWidth: '150px', textAlign: 'center', lineHeight: '1.1' } }, ...Array.from({ length: n }, (_, i) => el('span', { style: i >= n - cross ? { opacity: .3, textDecoration: 'line-through' } : {} }, fruit)));
    const q = el('div', { class: 'row', style: { alignItems: 'center', fontSize: '44px', fontWeight: 'bold' } }, grp(a, add ? 0 : b), el('span', {}, add ? '➕' : '➖'), add ? grp(b) : el('div', { style: { fontSize: '30px' } }, String(b)), el('span', {}, '🟰'), el('span', {}, '❓'));
    const nums = el('div', { class: 'row', style: { fontSize: '30px' } }, el('div', {}, `${a} ${add ? '+' : '−'} ${b} = ?`));
    const opts = new Set([ans]); while (opts.size < 3) opts.add(Math.max(0, ans + pick([-2, -1, 1, 2, 3])));
    const row = el('div', { class: 'row' });
    [...opts].sort(() => Math.random() - 0.5).forEach(n => row.append(el('button', { class: 'letter', style: { width: '96px', height: '96px', fontSize: '52px' }, on: tap(e => {
      Audio2.speak(NUMW[n] || String(n));
      if (n === ans) { e.currentTarget.style.background = '#7bd36b'; Audio2.jingle([0, 4, 7, 12, 16]); emit('confetti', marina.x, marina.y - 60, 30); setTimeout(() => say('m_did_it'), 400); setTimeout(() => { area.innerHTML = ''; mathTab(area); }, 2200); }
      else { e.currentTarget.style.background = '#ffb0a0'; e.currentTarget.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], 250); say('m_hmm'); }
    }) }, String(n))));
    area.append(q, nums, row, el('div', { class: 'row' }, el('button', { class: 'pbtn', on: tap(() => Audio2.speak(`${NUMW[a]} ${add ? 'plus' : 'take away'} ${NUMW[b]}`)) }, '🔊')));
    setTimeout(() => Audio2.speak(`${NUMW[a]} ${add ? 'plus' : 'take away'} ${NUMW[b]}`), 300);
  }
  // ---- spelling
  const WORDS = [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['mommy', '👩'], ['daddy', '👨'], ['love', '💖'], ['fish', '🐟'], ['cake', '🎂'], ['fort', '🏰'], ['niko', '🐈'], ['miles', '👶'], ['marina', '👧'], ['volcano', '🌋'], ['egg', '🥚'], ['tree', '🌳'], ['snow', '❄️'], ['bee', '🐝'], ['moon', '🌙']];
  function spellTab(area) {
    const [w, pic] = pick(WORDS); let i = 0;
    const slots = el('div', { class: 'letters' }, ...[...w].map(() => el('div', { class: 'slot' })));
    const letters = [...w]; while (letters.length < Math.min(w.length + 3, 9)) letters.push(pick('abcdefghijklmnoprstuvwy'.split('')));
    letters.sort(() => Math.random() - 0.5);
    const tiles = el('div', { class: 'letters' });
    const hint = () => { tiles.querySelectorAll('.letter').forEach(t => t.classList.toggle('hint', !t.disabled && t.textContent === w[i])); };
    letters.forEach(L => tiles.append(el('button', { class: 'letter', on: tap(e => {
      const b = e.currentTarget; Audio2.speak(L, { rate: 0.8 });
      if (L === w[i]) { slots.children[i].textContent = L.toUpperCase(); b.disabled = true; b.style.opacity = .25; b.classList.remove('hint'); i++; Audio2.blip(i * 2);
        if (i === w.length) { setTimeout(() => { Audio2.speak(w.split('').join(', ') + '. ' + w + '!', { rate: 0.8 }); }, 400); Audio2.jingle([0, 4, 7, 12, 16]); emit('confetti', marina.x, marina.y - 60, 30); setTimeout(() => say('m_did_it'), 2600); setTimeout(() => { area.innerHTML = ''; spellTab(area); }, 4800); }
      } else { b.animate([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'none' }], 250); hint(); }
    }) }, L)));
    const big = el('div', { class: 'big-ico', style: { fontSize: '96px' } }, pic);
    area.append(big, slots, tiles, el('div', { class: 'row' }, el('button', { class: 'pbtn', on: tap(() => Audio2.speak(w, { rate: 0.8 })) }, '🔊'), el('button', { class: 'pbtn', on: tap(hint) }, '💡')));
    setTimeout(() => Audio2.speak(w, { rate: 0.8 }), 300);
  }

  // =========================================================== MAP
  function openMap() {
    Audio2.jingle([0, 7, 12], 0.06);
    openPanel('map', '🗺️', (b) => {
      const g = el('div', { class: 'mapgrid' });
      const L = { bathroom: [60, 4, 18, 22], dining: [0, 30, 20, 34], kitchen: [20, 30, 22, 34], playroom: [42, 30, 18, 34], foyer: [60, 30, 14, 34], living: [74, 30, 26, 34], yard: [0, 70, 100, 28] };
      for (const [r, [x, y, w, h]] of Object.entries(L)) {
        const who = [[daddy, '👨'], [mommy, '👩'], [rory, '🧔'], [niko, '🐱'], [miles, '👶']].filter(([e]) => e.room === r && !e.hidden && !(e === miles && mommy.holdingMiles)).map(x => x[1]).join('');
        const extra = (r === 'playroom' && G.poop ? '💩' : '') + (r === 'living' && G.tv ? '📺' : '') + (G.fort && G.fort.room === r ? '🏰' : '');
        g.append(el('button', { class: 'room' + (G.room === r ? ' here' : ''), style: { left: x + '%', top: y + '%', width: w + '%', height: h + '%', background: r === 'yard' ? '#5f8a3a' : '#7a6aa8' }, on: tap(() => { closePanel(); if (r !== G.room) { if (marina.mount) dismount(); if (marina.state === 'wheel') leaveWheelchair(); if (marina.state === 'bars') { clearInterval(G.barIv); G.mb = null; } if (['perch', 'swing', 'bars', 'fort'].includes(marina.state)) { if (marina.state === 'fort') exitFort(); marina.state = 'idle'; marina.offY = 0; } changeRoom(r, null, r === 'living' ? 300 : ROOMS[r].w / 2); } }) },
          (r === 'yard' ? (WEATHER === 'snow' ? '⛄' : '🍂') : ROOMS[r].ico) + extra, el('div', { class: 'who' }, who)));
      }
      b.append(g);
    });
  }

  // ------------- close-up talking portrait card
  const VIS = ['rest', 'open', 'round', 'teeth', 'smile'];
  const cards = {};
  function face(who, mood, until, opt = {}) {
    if (!FACES.img) return;
    const has = (m) => FACES.A[`face_${who}_${m}_rest`];
    if (!has(mood)) mood = has('neutral') ? 'neutral' : null; if (!mood) return;
    let c = cards[who];
    if (!c) {
      const cv = el('canvas', { width: 128, height: 128 });
      const n = el('div', { class: 'facecard' }, cv); n.dataset.who = who; document.getElementById('stage').append(n);
      c = cards[who] = { n, cv, t: 0 };
    }
    // position: speaker's side of the screen
    const ent = { marina, daddy, mommy, rory, miles, niko }[who];
    const right = ent && ent.here ? toScreen(ent.x, 0)[0] > document.getElementById('stage').clientWidth / 2 : who !== 'marina';
    c.n.classList.toggle('right', right); c.n.classList.toggle('sick', !!opt.sick); c.n.classList.toggle('shake', !!opt.shake);
    c.mood = mood; c.talking = true; c.n.classList.add('show');
    for (const k in cards) if (k !== who && cards[k].n.classList.contains('right') === right) cards[k].n.classList.remove('show');
    const tok = c.tok = Symbol();
    const end = () => { if (c.tok !== tok) return; c.talking = false; setTimeout(() => { if (c.tok === tok) c.n.classList.remove('show'); }, 450); };
    if (typeof until === 'number') setTimeout(end, until); else Promise.resolve(until).then(end, end);
    if (!c.loop) { c.loop = true; const step = () => { drawFace(who); if (c.n.classList.contains('show')) setTimeout(step, 95); else c.loop = false; }; step(); }
  }
  function drawFace(who) {
    const c = cards[who], x = c.cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const v = c.talking ? pick(who === 'miles' || who === 'niko' ? ['open', 'round', 'rest', 'open'] : VIS) : 'rest';
    const r = FACES.A[`face_${who}_${c.mood}_${v}`] || FACES.A[`face_${who}_${c.mood}_rest`]; if (!r) return;
    x.clearRect(0, 0, 128, 128); const s = Math.min(128 / r[2], 128 / r[3]);
    x.drawImage(FACES.img, r[0], r[1], r[2], r[3], (128 - r[2] * s) / 2, (128 - r[3] * s) / 2, r[2] * s, r[3] * s);
  }
  return { face, init, bubble, actions, closeActions, update, pulseMoods, unpulseMoods, markMood, flash, bigIcon, fortTray, openCook, openDress, openCrafts, openMap, closePanel, get panelMode() { return panelMode; } };
})();
