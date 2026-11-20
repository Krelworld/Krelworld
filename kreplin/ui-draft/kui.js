/* ===================== KUI — KREPLIN UI primitives =====================
   KUI.modal({ title, html|node, actions:[{id,label,variant,key}], variant:'default|dos|news|sinister|phone',
               portrait, wide, dismissible }) -> Promise<actionId|null>
   KUI.cutscene({ src, title, skippable=true, poster }) -> Promise<'ended'|'skipped'|'error'>
       Never soft-locks: shows Skip immediately (after 1.5s when skippable=false),
       falls back to Continue on load error / stall (no progress for 12s).
   KUI.toast(text, variant='info', ms=3200)
   KUI.portraitFor(name) -> url|null      KUI.cast  (registry, extendable)
   KUI.renderEntry(html) -> HTMLElement   (turns a log() line into an inbox card / line)
*/
(function () {
  const ART = (window.KREPLIN_ART || {}); // name -> data URL, injected by build

  // ---------- cast registry ----------
  // match: regex against the speaker name. role shown as tag. kind: card colour.
  const cast = [
    { id: 'delmor', match: /delmor|krunchem/i, role: 'Portsmouth Chairman', kind: 'rival' },
    { id: 'marco', match: /^marco\b/i, role: 'Fixer' },
    { id: 'secretary', match: /secretary/i, role: 'Secretary', dyn: () => window.S && S.secretary_name },
    { id: 'wife', match: /spouse|wife/i, role: 'Wife', dyn: () => window.S && (S.wife_name || (S.family && S.family.wife_name)) },
    { id: 'manager', match: /\bmanager\b/i, role: 'Manager', dyn: () => window.S && S.manager && (S.manager.name || S.manager) },
    { id: 'doctor', match: /doctor|\bdoc\b/i, role: 'Club Doctor' },
    { id: 'vanonslaught', match: /van onslaught/i, role: 'Supreme Leader', kind: 'danger' },
    { id: 'cronster', match: /cronster/i, role: "Women's Team" },
    { id: 'gazza', match: /^gaz(za)?\b/i, role: 'Gazza' },
    { id: 'malcolm', match: /malcolm/i, role: 'Points 4 Prizes' },
    { id: 'chairman', match: /^(you|your)\b/i, role: 'You' },
  ];
  function lookup(name) {
    if (!name) return null;
    const n = String(name).trim();
    for (const c of cast) {
      let dynName = null; try { dynName = c.dyn && c.dyn(); } catch (e) {}
      if (c.match.test(n) || (dynName && typeof dynName === 'string' && n.toLowerCase().includes(dynName.toLowerCase()))) return c;
    }
    return null;
  }
  const portraitFor = name => { const c = lookup(name); return c && ART[c.id] ? ART[c.id] : null; };

  // ---------- helpers ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const focusables = root => [...root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled);

  // ---------- modal ----------
  const stack = [];
  function modal(o = {}) {
    return new Promise(resolve => {
      const wrap = el('div', 'k-modal-wrap');
      const box = el('div', `k-modal ${o.variant || ''} ${o.wide ? 'wide' : ''}`);
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      const head = el('header');
      if (o.portrait) { const img = el('img', 'px'); img.src = ART[o.portrait] || o.portrait; img.alt = ''; head.appendChild(img); }
      const h = el('h2', null, o.title || ''); head.appendChild(h);
      const dismissible = o.dismissible !== false;
      if (dismissible) { const x = el('button', 'k-x', '×'); x.setAttribute('aria-label', 'Close'); x.onclick = () => done(null); head.appendChild(x); }
      box.appendChild(head);
      const body = el('div', 'k-body');
      if (o.node) body.appendChild(o.node); else body.innerHTML = o.html || '';
      box.appendChild(body);
      const actions = o.actions || (dismissible ? [{ id: 'ok', label: 'OK', variant: 'primary' }] : []);
      if (actions.length) {
        const foot = el('footer');
        actions.forEach((a, i) => {
          const b = el('button', `k-btn ${a.variant || ''}`);
          b.innerHTML = `${actions.length > 1 ? `<kbd>${i + 1}</kbd>` : ''}<span>${a.label}</span>`;
          if (a.disabled) b.disabled = true;
          b.onclick = () => done(a.id != null ? a.id : i);
          foot.appendChild(b);
        });
        box.appendChild(foot);
      }
      wrap.appendChild(box);
      if (dismissible && o.backdropClose !== false) wrap.addEventListener('mousedown', e => { if (e.target === wrap) done(null); });
      const prevFocus = document.activeElement;
      function onKey(e) {
        if (stack[stack.length - 1] !== wrap) return;
        if (e.key === 'Escape' && dismissible) { e.preventDefault(); done(null); }
        else if (/^[1-9]$/.test(e.key) && actions.length > 1 && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
          const a = actions[+e.key - 1]; if (a && !a.disabled) { e.preventDefault(); done(a.id != null ? a.id : +e.key - 1); }
        } else if (e.key === 'Tab') {
          const f = focusables(box); if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      function done(v) {
        document.removeEventListener('keydown', onKey, true);
        stack.splice(stack.indexOf(wrap), 1); wrap.remove();
        try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {}
        resolve(v);
      }
      stack.push(wrap);
      document.body.appendChild(wrap);
      const f = focusables(box.querySelector('footer') || box); (f[f.length - 1] || box).focus && setTimeout(() => (f[0] || box).focus(), 0);
      if (o.onOpen) try { o.onOpen(box, done); } catch (e) { console.error(e); }
    });
  }

  // ---------- cutscene ----------
  function cutscene(o = {}) {
    return new Promise(resolve => {
      const wrap = el('div', 'k-cut');
      if (o.title) wrap.appendChild(el('div', 'k-cut-title', esc(o.title)));
      const v = document.createElement('video');
      v.src = o.src; v.playsInline = true; v.preload = 'auto'; if (o.poster) v.poster = o.poster;
      v.controls = false;
      const status = el('div', 'k-cut-load', 'Loading…');
      const skip = el('button', 'k-btn k-cut-skip', o.skippable === false ? 'Continue ▸' : 'Skip ▸');
      if (o.skippable === false) skip.style.visibility = 'hidden';
      wrap.append(v, status, skip);
      document.body.appendChild(wrap);
      let finished = false, lastT = -1, stallTimer = 0;
      const finish = why => {
        if (finished) return; finished = true;
        clearInterval(stallTimer); document.removeEventListener('keydown', onKey, true);
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
        wrap.remove(); resolve(why);
      };
      const failSoft = () => { status.textContent = 'Video unavailable.'; skip.textContent = 'Continue ▸'; skip.style.visibility = 'visible'; };
      skip.onclick = () => finish(skip.textContent.startsWith('Continue') && o.skippable !== false ? 'skipped' : (status.textContent.includes('unavailable') ? 'error' : 'skipped'));
      function onKey(e) { if ((e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && skip.style.visibility !== 'hidden') { e.preventDefault(); skip.click(); } }
      document.addEventListener('keydown', onKey, true);
      if (o.skippable === false) setTimeout(() => { skip.style.visibility = 'visible'; }, 1500);
      v.addEventListener('playing', () => { status.textContent = ''; });
      v.addEventListener('ended', () => finish('ended'));
      v.addEventListener('error', failSoft);
      stallTimer = setInterval(() => { if (finished) return; if (v.currentTime === lastT && !v.paused) failSoft(); lastT = v.currentTime; }, 12000);
      const p = v.play();
      if (p && p.catch) p.catch(() => {               // autoplay blocked -> explicit play button
        status.textContent = '';
        const play = el('button', 'k-btn primary k-cut-play', '▶ PLAY');
        play.onclick = () => { play.remove(); v.play().catch(failSoft); };
        wrap.insertBefore(play, skip);
      });
    });
  }

  // ---------- toast ----------
  let toastBox;
  function toast(text, variant = 'info', ms = 3200) {
    if (!toastBox) { toastBox = el('div', 'k-toasts'); document.body.appendChild(toastBox); }
    const t = el('div', `k-toast ${variant}`, text); toastBox.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- feed entry renderer ----------
  // Matches:  [emoji ]Name[ (Role)][ verb...]: "quote"
  const SPEAKER = /^\s*((?:[\p{Extended_Pictographic}️‍]+\s*)?)([A-Z][\w'’.\- ]{1,40}?)(?:\s*\(([^)]{1,30})\))?((?:\s+[a-z]+){0,3}(?:\s+to\s+[^:]{1,30})?)\s*:\s*(["“].*)$/su;
  function renderEntry(html) {
    const text = String(html);
    const plain = text.replace(/<[^>]+>/g, '');
    // fixtures
    if (/^\s*⚽\s*\[[A-Z0-9 '\-]+\]/.test(plain)) {
      const m = plain.match(/^\s*⚽\s*(\[[^\]]+\]\s*[^.]+\.?)(.*)$/s);
      const e = el('div', 'k-fixture', `<img class="px" width="32" height="32" alt="" src="${ART['ico-ball'] || ''}"><div><b>${esc(m ? m[1] : plain)}</b><br><small>${esc(m ? m[2].trim() : '')}</small></div>`);
      return e;
    }
    const sm = plain.length < 1200 ? plain.match(SPEAKER) : null;
    if (sm) {
      const [, , name, roleParen, verb, quote] = sm;
      const c = lookup(name) || (roleParen && lookup(roleParen));
      const known = !!c;
      if (known || /^(?:[A-Z][a-z'’\-]+)(?:\s[A-Z][a-z'’\-]+){0,2}$/.test(name.trim())) {
        const img = c && ART[c.id];
        const ava = img ? `<img class="px" alt="" src="${img}">` : esc(name.trim()[0] || '?');
        const tag = [roleParen || (c && c.role), /text/i.test(plain.slice(0, 4)) || /^\s*📱/.test(plain) ? 'Text' : '', verb && verb.trim()].filter(Boolean).map(esc).join(' · ');
        const e = el('article', `k-msg ${c && c.kind ? c.kind : ''}`);
        // keep original HTML for the quote part if possible
        const qHtml = text.includes(quote.slice(0, 12)) ? text.slice(text.indexOf(quote.slice(0, 12))) : esc(quote);
        e.innerHTML = `<div class="ava">${ava}</div><div><div class="who">${esc(name.trim())}${tag ? ` <span class="tag">${tag}</span>` : ''}</div><p>${qHtml}</p></div>`;
        return e;
      }
    }
    const e = el('div', 'k-line');
    if (/^\s*(❌|⚠️|🚨|💔|☠️)/.test(plain)) e.classList.add('bad');
    else if (/^\s*(✅|🎉|🏆|💰)/.test(plain)) e.classList.add('good');
    e.innerHTML = text;
    return e;
  }

  window.KUI = { modal, cutscene, toast, renderEntry, portraitFor, cast, lookup, ART };
})();
