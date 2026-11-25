// Chef Marina — clarity G41: the start screen can start on any floor (owner's request).
// The room picker keeps today's six main-floor cards and 🎲 exactly as they are, in the same places. Above them sits one slim
// row of floor tabs: 🏠 main (picked at first), ⬆️ upstairs, ⬇️ basement, 🌳 outside. A tab swaps the cards for that
// floor's rooms, drawn the same way (room picture, room icon badge), in the floor's colour; a card starts the game in that
// room exactly like today's cards (startGame(room)). 🎲 stays put and still picks a surprise. Switch: Clarity.on.G41.
(function () {
  const C = window.Clarity; if (!C || !C.core) return;
  const RGB = { main: '43,35,64', up: '70,130,190', down: '110,78,50', out: '40,105,55' };      // same colours as the floor strip (G38)
  const TABS = [['main', '🏠'], ['up', '⬆️'], ['down', '⬇️'], ['out', '🌳']];
  const PICK = { up: ['mroom', 'milesroom', 'parents', 'spa'], down: ['den', 'nunuroom', 'storage', 'laundry'], out: ['pool', 'yard', 'backyard'] };
  const S = C.G41 = { tabs: null, cards: [], floor: 'main' };

  C.css('G41', '.cm-g41-tabs{grid-column:1/-1;display:flex;justify-content:center;gap:10px;margin-bottom:2px}' +
    '.cm-g41-tab{width:58px;height:46px;border-radius:16px;border:4px solid #fff6dc;font-size:24px;padding:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(var(--cm-g41-rgb),.75);box-shadow:0 4px 0 rgba(60,20,20,.55);opacity:.8;transition:transform .15s}' +
    '.cm-g41-tab.cm-g41-cur{opacity:1;transform:translateY(-3px) scale(1.08);box-shadow:0 7px 0 rgba(60,20,20,.55),0 0 0 4px rgba(255,214,120,.6)}' +
    '.tpick.cm-g41-other>.tcardr:not(.cm-g41-card){display:none}' +
    '.cm-g41-card{border-color:rgb(var(--cm-g41-rgb))!important;animation:tin .3s ease-out}' +
    '.cm-g41-card b{background:rgb(var(--cm-g41-rgb))!important;color:#fff}' +
    // sideways the cards already fill the height: the tabs sit in the empty top-left corner instead, so no card moves
    '@media (orientation:landscape){.cm-g41-tabs{position:fixed;z-index:4;top:calc(env(safe-area-inset-top) + 10px);left:calc(env(safe-area-inset-left) + 12px);margin:0;gap:6px}.cm-g41-tab{width:44px;height:38px;font-size:19px;border-width:3px}' +
    '.tpick.cm-g41-other .tdice{grid-row:2;grid-column:4}}');

  function show(floor) {
    const box = document.querySelector('.tpick'); if (!box) return;
    S.floor = floor; for (const c of S.cards.splice(0)) c.remove();
    box.classList.toggle('cm-g41-other', floor !== 'main');
    for (const t of S.tabs.children) t.classList.toggle('cm-g41-cur', t.dataset.f === floor);
    if (floor === 'main') return;
    const dice = box.querySelector('.tdice');
    for (const r of PICK[floor].filter(r => ROOMS[r])) {
      const b = document.createElement('button'); b.className = 'tcardr cm-g41-card'; b.setAttribute('aria-label', r);
      b.innerHTML = '<b>' + ROOMS[r].ico + '</b>'; b.style.setProperty('--cm-g41-rgb', RGB[floor]);
      b.style.backgroundImage = 'url(assets/bg/' + (r === 'yard' ? 'yard_fall' : r) + '.png)';
      b.addEventListener('pointerup', e => { e.stopPropagation(); startGame(r); });
      box.insertBefore(b, dice); S.cards.push(b);
    }
  }
  function build() {
    const box = document.querySelector('.tpick'); if (!box || S.tabs) return;
    S.tabs = document.createElement('div'); S.tabs.className = 'cm-g41-tabs';
    for (const [f, ico] of TABS) {
      const t = document.createElement('button'); t.className = 'cm-g41-tab'; t.dataset.f = f; t.textContent = ico;
      t.setAttribute('aria-label', f === 'main' ? 'downstairs rooms' : f === 'up' ? 'upstairs rooms' : f === 'down' ? 'basement rooms' : 'outside');
      t.style.setProperty('--cm-g41-rgb', RGB[f]);
      t.addEventListener('pointerup', e => { e.stopPropagation(); try { Audio2.blip(f === 'up' ? 12 : f === 'down' ? 0 : 7, 'triangle', 0.06, 0.12); } catch (_) { } show(f); });
      S.tabs.append(t);
    }
    box.prepend(S.tabs); show('main');
  }
  function unbuild() { if (S.tabs) { S.tabs.remove(); S.tabs = null; } for (const c of S.cards.splice(0)) c.remove(); const box = document.querySelector('.tpick'); if (box) box.classList.remove('cm-g41-other'); }
  if (C.on.G41) build();
  C.onToggle && C.onToggle('G41', on => (on ? build() : unbuild()));
})();
