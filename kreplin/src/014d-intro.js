/* ===================== KIntro — lads gate, title screen and campaign set-up scenes =====================
   KIntro.scene({ step, art, kicker, title, panel, panelNote, lead, node|html, cards, cardMin, actions, onOpen })
       -> Promise<id>   full-screen pixel "scene" with a Step x of N progress bar (cards resolve on click / 1-9)
   KIntro.notice(title, html, buttons)  -> Promise<key|null>   KUI modal replacing the old green DOS dialog
   KIntro.welcome(text) / pickName(firsts, lasts) / pickSponsor(opts) / pickSecretary(list)
   KIntro.family(lines) / pickManager(cands, title)
   KIntro.applyLooks()  the hired secretary / manager keep the face picked on their card in-game
   Styles: 013d-intro.css. */
(function () {
  const ART = window.KREPLIN_ART || {};
  const STEPS = 6; // welcome, name, sponsor, secretary, family, manager
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const art = n => ART[n] || '';
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ---------- static screens: fill art, title animation, menu keys ----------
  function fillArt(root) { (root || document).querySelectorAll('img[data-art]').forEach(i => { if (!i.src && ART[i.dataset.art]) i.src = ART[i.dataset.art]; }); }
  function initTitle() {
    fillArt(document);
    const scr = document.getElementById('startScreen');
    if (!scr || scr._ki) return; scr._ki = true;
    const fl = scr.querySelector('.ki-flashes');
    if (fl && !reduced()) for (let i = 0; i < 16; i++) {
      const f = el('i'); f.style.left = (Math.random() * 100).toFixed(1) + '%'; f.style.top = (Math.random() * 100).toFixed(1) + '%';
      f.style.animationDelay = (-Math.random() * 2.6).toFixed(2) + 's'; f.style.animationDuration = (1.8 + Math.random() * 2.4).toFixed(2) + 's'; fl.appendChild(f);
    }
    const stage = scr.querySelector('.ki-title-stage');
    scr.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || reduced() || !stage) return;
      const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
      stage.style.setProperty('--px-x', (-x * 18).toFixed(1) + 'px'); stage.style.setProperty('--px-y', (-y * 10).toFixed(1) + 'px');
    });
    // keyboard: arrows move between the visible menu buttons, 1-4 pick one
    document.addEventListener('keydown', e => {
      const open = id => { const n = document.getElementById(id); return n && !n.classList.contains('hidden') && n.offsetParent !== null; };
      if (open('ladsGateScreen')) {
        const q = document.getElementById('ladsGateQuestion');
        if (q && q.style.display !== 'none') {
          if (/^(y|1)$/i.test(e.key)) { e.preventDefault(); document.getElementById('ladsGateYes').click(); }
          else if (/^(n|2)$/i.test(e.key)) { e.preventDefault(); document.getElementById('ladsGateNo').click(); }
        } else if (e.key === 'Enter' || /^r$/i.test(e.key)) { e.preventDefault(); document.getElementById('ladsGateReset').click(); }
        return;
      }
      if (!open('startScreen') || document.querySelector('.k-modal-wrap,.k-cut,.ki-scene')) return;
      const btns = [...document.querySelectorAll('#mainButtons .ki-pbtn')].filter(b => b.offsetParent !== null);
      if (!btns.length) return;
      const i = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
        btns[n].focus();
      } else if (/^[1-4]$/.test(e.key) && btns[+e.key - 1]) { e.preventDefault(); btns[+e.key - 1].click(); }
      else if (e.key === 'Enter' && i < 0) { e.preventDefault(); btns[0].click(); }
    });
  }
  // the gate swaps to the bouncer pointing you away (class toggled by setupLadsGateScreen)
  function gateRejected(on) { const g = document.getElementById('ladsGateScreen'); if (g) g.classList.toggle('rejected', !!on); }
  function focusMenu() { setTimeout(() => { const b = [...document.querySelectorAll('#mainButtons .ki-pbtn')].find(x => x.offsetParent !== null); if (b && matchMedia('(hover:hover)').matches) try { b.focus({ preventScroll: true }); } catch (e) {} }, 30); }

  // ---------- scene ----------
  function scene(o = {}) {
    return new Promise(resolve => {
      const root = el('div', 'ki-scene'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      if (o.title) root.setAttribute('aria-label', String(o.title).replace(/<[^>]+>/g, ''));
      const bg = el('div', 'ki-bgart'); if (o.art) bg.style.backgroundImage = `url("${art(o.art)}")`; root.appendChild(bg);
      const pips = o.step ? Array.from({ length: STEPS }, (_, i) => `<i class="${i + 1 < o.step ? 'done' : i + 1 === o.step ? 'now' : ''}"></i>`).join('') : '';
      root.appendChild(el('header', 'ki-top',
        `<div class="ki-brand"><img class="px" alt="" src="${art('crest')}"><span>KREPLIN</span></div>` +
        (o.step ? `<div class="ki-steps"><span>Step <b>${o.step}</b> of ${STEPS}</span><span class="ki-pips" aria-hidden="true">${pips}</span></div>` : '')));
      const scroll = el('div', 'ki-scroll'); const col = el('div', 'ki-col'); scroll.appendChild(col); root.appendChild(scroll);
      if (o.art) {
        const hero = el('div', 'ki-hero', `<img alt="" src="${art(o.art)}"><div class="ki-cap"><div class="ki-kicker">${o.kicker || ''}</div><h2>${o.title || ''}</h2></div>`);
        if (o.artPos) hero.querySelector('img').style.objectPosition = o.artPos;
        col.appendChild(hero);
      }
      const panel = el('section', 'ki-panel');
      if (o.panel) panel.appendChild(el('h3', null, `${esc(o.panel)}${o.panelNote ? `<small>${esc(o.panelNote)}</small>` : ''}`));
      const body = el('div', 'ki-body');
      if (o.lead) body.appendChild(el('p', 'ki-lead' + (o.bigLead ? ' big' : ''), o.lead));
      if (o.node) body.appendChild(o.node); else if (o.html) body.insertAdjacentHTML('beforeend', o.html);
      const cards = o.cards || [];
      if (cards.length) {
        const grid = el('div', 'ki-cards'); if (o.cardMin) grid.style.setProperty('--ki-card', o.cardMin);
        cards.forEach((c, i) => {
          const b = el('button', 'ki-card' + (c.pic ? ' art' : '') + (c.cls ? ' ' + c.cls : ''));
          b.type = 'button'; b.dataset.id = c.id;
          if (c.aria) b.setAttribute('aria-label', c.aria);
          b.innerHTML = (cards.length > 1 && i < 9 ? `<kbd>${i + 1}</kbd>` : '') +
            (c.pic ? `<img class="ki-pic" alt="" src="${art(c.pic)}">` : '') +
            (c.face ? `<img class="ki-face" alt="" src="${art(c.face)}">` : '') +
            `<span class="ki-txt"><span class="ki-name">${esc(c.name)}</span>` +
            (c.meta ? `<span class="ki-meta">${esc(c.meta)}</span>` : '') +
            (c.terms ? `<span class="ki-terms">${esc(c.terms)}</span>` : '') +
            (c.stats ? `<span class="ki-stats">${c.stats.map(s => `<span class="${s.cls || ''}">${esc(s.t)}</span>`).join('')}</span>` : '') +
            (c.desc ? `<span class="ki-desc">${esc(c.desc)}</span>` : '') + `</span>`;
          b.onclick = () => done(c.id);
          grid.appendChild(b);
        });
        body.appendChild(grid);
      }
      panel.appendChild(body); col.appendChild(panel);
      const acts = o.actions || [];
      if (acts.length || o.footNote) {
        const foot = el('div', 'ki-foot');
        if (o.footNote) foot.appendChild(el('span', 'ki-note', o.footNote));
        acts.forEach(a => {
          const b = el('button', 'ki-pbtn ' + (a.variant || ''), esc(a.label)); b.type = 'button';
          if (a.id) b.dataset.act = a.id;
          if (a.disabled) b.disabled = true;
          b.onclick = () => done(a.id);
          foot.appendChild(b);
        });
        root.appendChild(foot);
      }
      function onKey(e) {
        if (document.querySelector('.k-modal-wrap')) return; // a KUI dialog raised on top owns the keys
        const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
        if (/^[1-9]$/.test(e.key) && !typing && cards[+e.key - 1]) { e.preventDefault(); e.stopPropagation(); done(cards[+e.key - 1].id); return; }
        if (e.key === 'Enter' && !typing && !(document.activeElement && root.contains(document.activeElement) && /BUTTON/.test(document.activeElement.tagName))) {
          const go = root.querySelector('.ki-foot .ki-pbtn.go:not([disabled])'); if (go) { e.preventDefault(); e.stopPropagation(); go.click(); }
          return;
        }
        if (/^[0-9]$/.test(e.key) || e.key === 'Escape') e.stopPropagation(); // keep shell hotkeys off the set-up
      }
      document.addEventListener('keydown', onKey, true);
      let closed = false;
      function done(v) {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey, true);
        root.remove();
        resolve(v);
      }
      document.body.appendChild(root);
      setTimeout(() => {
        if (!matchMedia('(hover:hover)').matches) return; // phones: no focus ring jumping around
        const t = root.querySelector('.ki-card,.ki-chip[aria-pressed="true"],.ki-foot .ki-pbtn.go:not([disabled])') || root.querySelector('button');
        try { t && t.focus({ preventScroll: true }); } catch (e) {}
      }, 0);
      if (o.onOpen) try { o.onOpen(root, done); } catch (e) { console.error(e); }
    });
  }

  // ---------- notice: KUI modal in place of the old DOS box (showDOSModal keeps its signature) ----------
  function notice(title, content, buttons = []) {
    if (!window.KUI || !KUI.modal) return Promise.resolve(buttons.length ? null : 'ok');
    const acts = buttons.length ? buttons.map(b => ({ id: b.key, label: esc(b.label) }))
      : [{ id: 'ok', label: 'OK', variant: 'primary' }];
    return KUI.modal({ title: esc(title), html: `<p>${content}</p>`, actions: acts, variant: 'ki-notice' })
      .then(v => (v == null ? null : v));
  }

  // ---------- the set-up steps ----------
  const welcome = text => scene({
    step: 1, art: 'office', kicker: "Chairman's office · day one", title: 'Southampton <em>FC</em>', panel: 'WELCOME',
    lead: esc(text), bigLead: true, actions: [{ id: 'ok', label: 'Continue ▸', variant: 'go' }],
  });

  function pickName(firsts, lasts) {
    let f = firsts[0], l = lasts[0];
    const node = el('div');
    node.innerHTML = `<div class="ki-contract"><div class="ki-ct">Contract of employment · Chairman</div>
      <div>The undersigned agrees to run Southampton Football Club, for better or (much) worse.</div>
      <div class="ki-sig"><span>SIGNED</span><b class="ki-signame"></b></div></div>
      <div class="ki-pickrow"><h4>Pick your forename</h4><div class="ki-chips" data-row="f"></div></div>
      <div class="ki-pickrow"><h4>Pick your surname</h4><div class="ki-chips" data-row="l"></div></div>`;
    const sig = node.querySelector('.ki-signame');
    const paint = () => { sig.textContent = `${f} ${l}`; node.querySelectorAll('.ki-chip').forEach(c => c.setAttribute('aria-pressed', String((c.dataset.row === 'f' ? f : l) === c.dataset.v))); };
    [['f', firsts], ['l', lasts]].forEach(([row, list]) => {
      const box = node.querySelector(`[data-row="${row}"]`);
      list.forEach(v => {
        const c = el('button', 'ki-chip', esc(v)); c.type = 'button'; c.dataset.row = row; c.dataset.v = v;
        c.onclick = () => { if (row === 'f') f = v; else l = v; paint(); };
        box.appendChild(c);
      });
    });
    paint();
    return scene({
      step: 2, art: 'intro-contract', kicker: 'The paperwork', title: 'Sign on the <em>dotted line</em>', panel: 'PICK YOUR NAME',
      node, actions: [{ id: 'sign', label: 'Sign & continue ▸', variant: 'go' }], footNote: 'Tap a name to change it',
    }).then(() => ({ first: f, last: l }));
  }

  const SPONSOR_ART = { m: 'spon-burger', e: 'spon-club', n: 'spon-console', p: 'spon-bus' };
  const pickSponsor = opts => scene({
    step: 3, art: 'stadium', kicker: 'Commercial', title: 'Choose your <em>shirt sponsor</em>', panel: 'SELECT YOUR SPONSOR',
    lead: 'Select a lead shirt sponsor:', cardMin: '220px',
    cards: opts.map(o => ({ id: o.key, pic: SPONSOR_ART[o.key], name: o.name, terms: o.terms, desc: o.note ? `(${o.note})` : '', aria: o.label, cls: o.key === 'p' ? 'rival' : '' })),
  });

  const SEC_LOOKS = ['sec-1', 'sec-2', 'sec-3', 'secretary', 'sec-5', 'sec-6'];
  const pickSecretary = list => scene({
    step: 4, art: 'office', artPos: 'center 30%', kicker: 'Staffing', title: 'Hire a <em>secretary</em>', panel: 'SELECT YOUR SECRETARY',
    lead: 'Secretary hiring — skip interviews and choose directly:', cardMin: '300px',
    cards: list.map((s, i) => ({ id: String(i + 1), face: s.look || SEC_LOOKS[i] || 'secretary', name: s.name, meta: `AGE ${s.age}`, desc: s.description, aria: `${s.name} (${s.age}) - ${s.description}` })),
  });

  function family(lines) {
    const S = window.S || {};
    const strip = n => String(n || '').replace(/\s*\((son|daughter)\)\s*$/i, '');
    const people = [
      { img: 'chairman', name: S.full_name || [S.player_firstname, S.player_surname].filter(Boolean).join(' '), role: 'You' },
      { img: 'wife', name: S.wife_name, role: 'Wife', hide: S.married === false },
      { img: 'son', name: strip(S.child1_name), role: 'Son' },
      { img: 'daughter', name: strip(S.child2_name), role: 'Daughter' },
    ].filter(p => p.name && !p.hide);
    const node = el('div');
    node.innerHTML = `<div class="ki-frame"><div class="ki-photo" style="grid-template-columns:repeat(${people.length},1fr)">${people.map(p =>
      `<figure><img alt="" src="${art(p.img)}"><figcaption><small>${esc(p.role)}</small>${esc(p.name)}</figcaption></figure>`).join('')}</div></div>
      <ul class="ki-facts">${(lines || []).map(l => { const m = String(l).match(/^([^:]+):\s*(.*)$/); return `<li>${m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(l)}</li>`; }).join('')}</ul>`;
    return scene({ step: 5, art: 'bg-home', kicker: 'Home life', title: 'Your <em>family</em>', panel: 'PERSONAL SUMMARY', node,
      actions: [{ id: 'ok', label: 'Continue ▸', variant: 'go' }] });
  }

  const MGR_LOOKS = ['manager', 'mgr-1', 'mgr-2', 'mgr-3', 'mgr-4', 'mgr-5'];
  function managerLooks(n) { const off = Math.floor(Math.random() * MGR_LOOKS.length); return Array.from({ length: n }, (_, i) => MGR_LOOKS[(off + i) % MGR_LOOKS.length]); }
  const pickManager = (cands, title, fmtMoney) => scene({
    step: 6, art: 'bg-locker', kicker: 'The dugout', title: 'Appoint a <em>manager</em>', panel: title || 'Hire a Manager', panelNote: 'position vacant',
    lead: 'The dugout is empty. Pick who takes the blame this season:', cardMin: '320px',
    cards: cands.map(c => ({ id: c.id, face: c.look, name: c.name,
      stats: [{ t: `Skill ${c.skill}` }, { t: `Agreeableness ${c.agreeableness}` }, { t: `${fmtMoney(c.wage)}/week`, cls: 'money' }],
      desc: c.description, aria: `${c.name} • Skill ${c.skill} • Agreeableness ${c.agreeableness} • ${fmtMoney(c.wage)}/week • ${c.description}` })),
    actions: [{ id: 'cancel', label: 'Cancel' }],
  });

  // ---------- looks: the picked face follows the character into the game ----------
  const BASE = {};
  function applyLooks() {
    const A = window.KREPLIN_ART; if (!A) return;
    ['secretary', 'manager'].forEach(k => { if (!(k in BASE)) BASE[k] = A[k]; });
    const S = window.S || {};
    A.secretary = (S.secretary_look && BASE.secretary && A[S.secretary_look]) || BASE.secretary;
    A.manager = (S.manager && S.manager.look && A[S.manager.look]) || BASE.manager;
  }
  function hookLooks() { if (window.GameHooks && GameHooks.on) GameHooks.on('init', () => { try { applyLooks(); } catch (e) {} }); }

  window.KIntro = { scene, notice, welcome, pickName, pickSponsor, pickSecretary, family, pickManager, managerLooks, applyLooks, gateRejected, focusMenu, STEPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTitle); else initTitle();
  if (document.readyState === 'complete') hookLooks(); else window.addEventListener('load', hookLooks);
})();
