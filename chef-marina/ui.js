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
    list.forEach((a, i) => {
      const n = el('button', { class: 'act', on: tap(() => { closeActions(); Audio2.blip(14, 'square', 0.05, 0.1); a.fn(); }) }, a.img ? img(a.img) : a.ico);
      n.style.animationDelay = (i * 0.04) + 's'; fx().append(n); acts.nodes.push(n);
    });
    placeActs();
  }
  function placeActs() {
    if (!acts) return; const a = acts.anchor;
    const top = a.prop !== undefined || a.x != null && a.id == null ? a.y : entTop(a);
    let [sx, sy] = toScreen(a.x, top);
    const st = document.getElementById('stage').getBoundingClientRect(), n = acts.nodes.length, R = 76;
    sy = clamp(sy - 10, 80, st.height - 50);
    const spread = Math.min(Math.PI * 0.95, 0.75 * (n - 1) + 0.001);
    acts.nodes.forEach((node, i) => {
      const ang = -Math.PI / 2 + (n === 1 ? 0 : -spread / 2 + spread * i / (n - 1));
      let x = sx + Math.cos(ang) * R, y = sy + Math.sin(ang) * R + 20;
      x = clamp(x, 36, st.width - 36); y = clamp(y, 40, st.height - 36);
      node.style.left = x + 'px'; node.style.top = y + 'px';
    });
  }
  function closeActions() { if (acts) { acts.nodes.forEach(n => n.remove()); acts = null; } }

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
  function openCook(where) {
    say('m_cooking');
    const chosen = []; let shelf = where || 'fridge';
    const SHELVES = [['fridge', '🧊'], ['freezer', '❄️'], ['cabinet', '🗄️'], ['bowl', '🧺']];
    openPanel('cook', '👩‍🍳', (b) => {
      const bowl = el('div', { class: 'bowl' }); const grid = el('div', { class: 'grid' }); const mrow = el('div', { class: 'row' }); const srow = el('div', { class: 'row' });
      const redraw = () => {
        bowl.innerHTML = ''; if (!chosen.length) bowl.append(el('div', { class: 'big-ico' }, '🥣'));
        chosen.forEach((k, i) => bowl.append(el('button', { class: 'tile', on: tap(() => { chosen.splice(i, 1); Audio2.blip(-5); redraw(); }) }, img('ing_' + k))));
        mrow.querySelectorAll('button').forEach(x => x.disabled = !chosen.length);
      };
      const fill = () => {
        grid.innerHTML = ''; srow.querySelectorAll('.pbtn').forEach((x, i) => x.classList.toggle('on', SHELVES[i][0] === shelf));
        for (const k of PANTRY[shelf]) grid.append(el('button', { class: 'tile', on: tap(() => { if (chosen.length >= 4) { Audio2.blip(-12); return; } chosen.push(k); Audio2.blip(pick([0, 2, 4, 7, 9, 12])); Audio2.voice('w_i_' + k, 'marina'); redraw(); }) }, img('ing_' + k)));
      };
      for (const [s, ico] of SHELVES) srow.append(el('button', { class: 'pbtn', style: { fontSize: '36px', minWidth: '70px', height: '66px' }, on: tap(() => { shelf = s; Audio2.whoosh(); fill(); }) }, ico));
      for (const [m, ico] of METHODS) mrow.append(el('button', { class: 'pbtn', style: { fontSize: '38px', minWidth: '70px', height: '70px' }, on: tap(() => runMethod(m, [...chosen])) }, ico));
      b.append(bowl, mrow, srow, grid); redraw(); fill();
    });
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
    const uniq = [...new Set(ings)].slice(0, 2); const name = `${adj} ${uniq.map(k => ING_WORD[k]).join(' ')} ${DISH_WORD[art]}`;
    const say = ['w_a_' + adj.toLowerCase(), ...uniq.map(k => 'w_i_' + k), 'w_d_' + art];
    return { art, score, name, tint, ings, method, say };
  }
  function showDish(body, d) {
    body.innerHTML = '';
    const c = document.createElement('canvas'); const s = spriteCanvas('dish_' + d.art, d.tint ? { tint: d.tint } : null); c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0);
    const faces = d.score >= 3 ? '😋😋😋' : d.score >= 1 ? '😋😋' : d.score >= 0 ? '🙂' : d.score >= -2 ? '😬' : d.score >= -4 ? '🤢🤢' : '🤮🤮🤮';
    c.addEventListener('pointerup', () => Audio2.chain(d.say)); const res = el('div', { class: 'result' }, c, el('div', { class: 'stars' }, faces),
      el('div', { style: { fontSize: '22px', opacity: .85 } }, d.name),
      el('div', { class: 'row' },
        el('button', { class: 'pbtn', style: { width: '90px', height: '90px', fontSize: '48px' }, on: tap(() => { closePanel(); finishDish(d); say('m_yay'); }) }, '✅'),
        el('button', { class: 'pbtn', style: { width: '90px', height: '90px', fontSize: '48px' }, on: tap(() => openCook()) }, '🔁')));
    body.append(res);
    Audio2.jingle(d.score >= 0 ? [0, 4, 7, 12, 16] : [12, 11, 6, 1, -6], 0.09, d.score >= 0 ? 'square' : 'sawtooth');
    for (let i = 0; i < 20; i++) emit('confetti', marina.x, marina.y - 60);
    setTimeout(() => Audio2.chain(d.say), 500);
    setTimeout(() => say(d.score >= 1 ? 'm_wow' : d.score >= 0 ? 'm_yummy' : 'm_giggle'), 2400);
  }

  // =========================================================== DRESS-UP
  const OUTFITS = [['default', 'marina'], ['fairy', 'o_fairy'], ['princess', 'o_princess'], ['bluedress', 'o_bluedress'], ['furcoat', 'o_furcoat'], ['hero', 'o_hero'], ['pajamas', 'o_pajamas']];
  const HAIRS = { ginger: '#eba864', blonde: '#f2cf6b', brown: '#7a4a26', black: '#2a2730', pink: '#ff7ab8', blue: '#4aa8ff', purple: '#a46cf0', green: '#5fcf6a', rainbow: 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' };
  const ACCS = [null, '🎀', '👑', '🌸', '💎', '⭐', '🦄'];
  function openDress() {
    say('m_pretty');
    openPanel('dress', '👗', (b) => {
      const prev = el('canvas', { width: 96, height: 96, style: { width: '192px', height: '192px', margin: '0 auto', display: 'block', imageRendering: 'pixelated', background: 'rgba(255,255,255,.12)', borderRadius: '24px' } });
      const draw = () => { const x = prev.getContext('2d'); x.clearRect(0, 0, 96, 96); x.imageSmoothingEnabled = false; const s = spriteCanvas(mBase(), mOpt()); x.drawImage(s, 48 - s.width / 2, 92 - s.height); if (G.acc) { x.font = '16px sans-serif'; x.textAlign = 'center'; x.fillText(G.acc, 46, 96 - s.height + 22); } };
      const outRow = el('div', { class: 'grid' }); const hairRow = el('div', { class: 'row' }); const accRow = el('div', { class: 'row' });
      const sync = () => { draw(); outRow.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('sel', OUTFITS[i][0] === G.outfit)); hairRow.querySelectorAll('.swatch').forEach(t => t.classList.toggle('sel', t.dataset.h === G.hair)); accRow.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('sel', ACCS[i] === G.acc)); gl.classList.toggle('on', G.glasses); };
      OUTFITS.forEach(([id, key]) => outRow.append(el('button', { class: 'tile', on: tap(() => { G.outfit = id; Audio2.jingle([0, 7, 12], 0.05); sync(); }) }, img(key))));
      for (const [h, c] of Object.entries(HAIRS)) { const s = el('button', { class: 'swatch', 'data-h': h, style: { background: c }, on: tap(() => { G.hair = h; Audio2.blip(pick([0, 4, 7, 12])); sync(); }) }); hairRow.append(s); }
      const gl = el('button', { class: 'pbtn', style: { fontSize: '40px', height: '70px', minWidth: '90px' }, on: tap(() => { G.glasses = !G.glasses; Audio2.blip(G.glasses ? 7 : 0); sync(); }) }, '👓');
      ACCS.forEach(a => accRow.append(el('button', { class: 'tile', style: { width: '62px' }, on: tap(() => { G.acc = a; Audio2.blip(9); sync(); }) }, a || '🚫')));
      const done = el('button', { class: 'pbtn', style: { width: '90px', height: '90px', fontSize: '48px', margin: '0 auto' }, on: tap(() => { closePanel(); emit('confetti', marina.x, marina.y - 60, 40); say(G.outfit === 'fairy' ? 'm_fairy' : G.outfit === 'princess' ? 'm_princess' : 'm_pretty'); addMess(G.room, 2, ['👗', '👚', '🧦', '👠']); }) }, '✅');
      b.append(prev, outRow, hairRow, el('div', { class: 'row' }, gl), accRow, done); sync();
    });
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
      const n = el('div', { class: 'facecard' }, cv); document.getElementById('stage').append(n);
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
