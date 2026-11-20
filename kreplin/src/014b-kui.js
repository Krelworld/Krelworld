/* ===================== KUI — KREPLIN UI primitives =====================
   KUI.modal({ title, html|node, actions:[{id,label,variant,key,disabled}], variant:'default|dos|news|sinister|phone|cinematic',
               portrait, wide, dismissible, backdropClose, onOpen(box, done) }) -> Promise<actionId|null>
   KUI.alert(msg, {title, variant})            -> Promise<void>          (replaces window.alert where awaited)
   KUI.confirm(msg, {title, ok, cancel, variant}) -> Promise<boolean>   (replaces window.confirm where awaited)
   KUI.prompt(msg, def, {title, type})          -> Promise<string|null>  (replaces window.prompt where awaited)
   KUI.cutscene({ src, title, skippable=true, poster, muted, volume, maxWaitMs }) -> Promise<'ended'|'skipped'|'error'>
       Never soft-locks: Skip is shown immediately (after 1.5s when skippable=false), and a load error,
       a 15s wait for first frame or a 12s stall turns it into "Continue".
   KUI.toast(text, variant='info', ms=3200)
   KUI.portraitFor(name) -> url|null      KUI.cast  (registry, extendable)
   KUI.renderEntry(html) -> HTMLElement   (turns a log() line into an inbox card / line)
*/
(function () {
  const ART = (window.KREPLIN_ART || {}); // name -> data URL, injected by build

  // ---------- cast registry ----------
  // match: regex against the speaker label ("Name verb"). role shown as tag. kind: card colour.
  // dyn(): the character's current in-game name (matched case-insensitively, first name is enough).
  const S_ = () => window.S || {};
  const first = n => (typeof n === 'string' && n.trim()) ? n.trim().split(/\s+/)[0] : null;
  const cast = [
    { id: 'delmor', match: /delmor|krunchem/i, role: 'Portsmouth Chairman', kind: 'rival' },
    { id: 'wife', match: /^(your )?(spouse|wife)\b/i, role: 'Wife', dyn: () => S_().wife_name },
    { id: 'son', match: /^your son\b/i, role: 'Son', dyn: () => S_().child1_name },
    { id: 'daughter', match: /^your daughter\b/i, role: 'Daughter', dyn: () => S_().child2_name },
    { id: 'secretary', match: /secretary/i, role: 'Secretary', dyn: () => S_().secretary_name },
    { id: 'manager', match: /\bmanager\b|\bgaffer\b/i, role: 'Manager', dyn: () => (S_().manager && S_().manager.name) || S_().manager_name },
    { id: 'marco', match: /^marco\b/i, role: 'Fixer' },
    { id: 'doctor', match: /doctor|\bdoc\b|dr\.? /i, role: 'Club Doctor' },
    { id: 'vanonslaught', match: /van onslaught/i, role: 'Supreme Leader', kind: 'danger' },
    { id: 'rodjohnson', match: /rod johnson/i, role: 'Sheikh', kind: 'danger' },
    { id: 'cronster', match: /cronster|kuddle/i, role: "Women's Team" },
    { id: 'gazza', match: /^gaz(za)?\b/i, role: 'Gazza' },
    { id: 'malcolm', match: /malcolm/i, role: 'Points 4 Prizes' },
    { id: 'chairman', match: /^(you|your)\b/i, role: 'You', kind: 'you' },
  ];
  function lookup(name) {
    if (!name) return null;
    const n = String(name).trim();
    for (const c of cast) if (c.match.test(n)) return c;
    const low = n.toLowerCase();
    for (const c of cast) {
      let dn = null; try { dn = c.dyn && c.dyn(); } catch (e) {}
      if (typeof dn !== 'string' || !dn.trim()) continue;
      const full = dn.trim().toLowerCase(), f = first(dn).toLowerCase();
      if (low === full || low.startsWith(full + ' ') || low === f || low.startsWith(f + ' ')) return c;
    }
    return null;
  }
  const portraitFor = name => { const c = lookup(name); return c && ART[c.id] ? ART[c.id] : null; };

  // ---------- helpers ----------
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const focusables = root => [...root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);

  // ---------- modal ----------
  const stack = [];
  function modal(o = {}) {
    return new Promise(resolve => {
      const wrap = el('div', `k-modal-wrap ${o.variant ? 'v-' + o.variant : ''}`);
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
        const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
        if (e.key === 'Escape' && dismissible) { e.preventDefault(); e.stopPropagation(); done(null); }
        else if (e.key === 'Enter' && typing && o.enterAction != null) { e.preventDefault(); done(o.enterAction); }
        else if (/^[1-9]$/.test(e.key) && actions.length > 1 && !typing) {
          const a = actions[+e.key - 1]; if (a && !a.disabled) { e.preventDefault(); e.stopPropagation(); done(a.id != null ? a.id : +e.key - 1); }
        } else if (e.key === 'Tab') {
          const f = focusables(box); if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
          else if (!box.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      let closed = false;
      function done(v) {
        if (closed) return; closed = true;
        document.removeEventListener('keydown', onKey, true);
        const i = stack.indexOf(wrap); if (i >= 0) stack.splice(i, 1);
        wrap.remove();
        try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (e) {}
        resolve(v);
      }
      stack.push(wrap);
      document.body.appendChild(wrap);
      setTimeout(() => {
        const inp = body.querySelector('input,textarea,select');
        const f = focusables(box.querySelector('footer') || box);
        const t = inp || f[0] || box; try { t.focus({ preventScroll: true }); } catch (e) {}
      }, 0);
      if (o.onOpen) try { o.onOpen(box, done); } catch (e) { console.error(e); }
    });
  }
  const textHtml = msg => esc(String(msg == null ? '' : msg)).replace(/\n/g, '<br>');
  function kAlert(msg, o = {}) {
    return modal({ title: o.title || 'Notice', html: `<p>${textHtml(msg)}</p>`, variant: o.variant, actions: [{ id: 'ok', label: o.ok || 'OK', variant: 'primary' }] }).then(() => undefined);
  }
  function kConfirm(msg, o = {}) {
    return modal({ title: o.title || 'Are you sure?', html: `<p>${textHtml(msg)}</p>`, variant: o.variant,
      actions: [{ id: 'yes', label: o.ok || 'Yes', variant: 'primary' }, { id: 'no', label: o.cancel || 'Cancel' }] }).then(v => v === 'yes');
  }
  function kPrompt(msg, def, o = {}) {
    const node = el('div');
    node.innerHTML = `<p>${textHtml(msg)}</p>`;
    const inp = el('input', 'k-input'); inp.type = o.type || 'text'; inp.value = def == null ? '' : String(def);
    node.appendChild(inp);
    return modal({ title: o.title || 'Chairman input', node, variant: o.variant, enterAction: 'ok',
      actions: [{ id: 'ok', label: o.ok || 'OK', variant: 'primary' }, { id: 'cancel', label: 'Cancel' }] })
      .then(v => v === 'ok' ? inp.value : null);
  }

  // ---------- cutscene ----------
  function cutscene(o = {}) {
    return new Promise(resolve => {
      const wrap = el('div', 'k-cut');
      if (o.title) wrap.appendChild(el('div', 'k-cut-title', esc(o.title)));
      const v = document.createElement('video'); v.__kGuard = true; // has its own fail-safe
      v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; if (o.poster) v.poster = o.poster;
      v.controls = false; if (o.muted) v.muted = true; if (typeof o.volume === 'number') v.volume = Math.max(0, Math.min(1, o.volume));
      v.src = o.src;
      const status = el('div', 'k-cut-load', 'Loading…');
      const skip = el('button', 'k-btn k-cut-skip', o.skippable === false ? 'Continue ▸' : 'Skip ▸');
      if (o.skippable === false) skip.style.visibility = 'hidden';
      wrap.append(v, status, skip);
      document.body.appendChild(wrap);
      let finished = false, failed = false, started = false, lastT = -1;
      const timers = [];
      const finish = why => {
        if (finished) return; finished = true;
        timers.forEach(t => { clearInterval(t); clearTimeout(t); });
        document.removeEventListener('keydown', onKey, true);
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
        wrap.remove();
        try { o.onEnd && o.onEnd(why); } catch (e) { console.error(e); }
        resolve(why);
      };
      const failSoft = () => { if (finished) return; failed = true; status.textContent = 'Video unavailable.'; skip.textContent = 'Continue ▸'; skip.style.visibility = 'visible'; };
      skip.onclick = () => finish(failed ? 'error' : 'skipped');
      function onKey(e) { if ((e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && skip.style.visibility !== 'hidden') { e.preventDefault(); e.stopPropagation(); skip.click(); } }
      document.addEventListener('keydown', onKey, true);
      if (o.skippable === false) timers.push(setTimeout(() => { skip.style.visibility = 'visible'; }, 1500));
      v.addEventListener('playing', () => { started = true; status.textContent = ''; });
      v.addEventListener('ended', () => finish('ended'));
      v.addEventListener('error', failSoft);
      timers.push(setTimeout(() => { if (!started) failSoft(); }, o.maxWaitMs || 15000));
      timers.push(setInterval(() => { if (finished || !started) return; if (v.currentTime === lastT && !v.paused && !v.ended) failSoft(); lastT = v.currentTime; }, 12000));
      try { o.onStart && o.onStart(v, wrap); } catch (e) { console.error(e); }
      let p; try { p = v.play(); } catch (e) { p = Promise.reject(e); }
      if (p && p.catch) p.catch(() => {               // autoplay blocked -> explicit play button
        if (finished) return;
        status.textContent = '';
        const play = el('button', 'k-btn primary k-cut-play', '▶ PLAY');
        play.onclick = () => { play.remove(); v.play().catch(failSoft); };
        wrap.insertBefore(play, skip);
      });
    });
  }

  // ---------- video safety net ----------
  // Every <video> the game creates (cutscenes, surveillance footage, phone attachments...) is guarded:
  // if it fails to load (Dropbox down/blocked), never starts, or stalls, a "Continue" bar appears.
  // Continue dispatches the video's own 'ended' event, so whatever the scene does after the video
  // (show its Close button, resolve its promise, pay out...) runs exactly as if it had finished.
  // A video that plays normally is left untouched.
  function inFixedLayer(node) {
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === 'fixed') return n;
    }
    return null;
  }
  function guardVideo(v, o = {}) {
    if (!v || v.__kGuard) return; v.__kGuard = true;
    let started = false, bar = null, lastT = -1, done = false;
    const timers = [];
    const clear = () => { done = true; timers.forEach(t => { clearTimeout(t); clearInterval(t); }); if (bar) bar.remove(); bar = null; };
    function showBar(kind) {
      if (done || bar || !v.isConnected) return;
      const layer = inFixedLayer(v);
      bar = el('div', `k-vfail ${layer ? 'fixed' : 'inline'}`);
      bar.setAttribute('role', 'status');
      bar.innerHTML = `<span>${kind === 'blocked' ? 'Tap to play the video' : 'Video unavailable'}</span>`;
      if (kind === 'blocked') {
        const play = el('button', 'k-btn primary', '▶ Play');
        play.onclick = () => { v.play().then(() => { if (bar) { bar.remove(); bar = null; } }).catch(() => {}); };
        bar.appendChild(play);
      }
      const cont = el('button', 'k-btn', kind === 'blocked' ? 'Skip ▸' : 'Continue ▸');
      cont.onclick = () => {
        clear();
        try { v.pause(); } catch (e) {}
        v.dispatchEvent(new Event('ended'));
        try { o.onSkip && o.onSkip(v); } catch (e) {}
      };
      bar.appendChild(cont);
      if (layer) document.body.appendChild(bar); else v.insertAdjacentElement('afterend', bar);
      // the bar lives only as long as its video
      const iv = setInterval(() => { if (!v.isConnected) { clearInterval(iv); clear(); } }, 500); timers.push(iv);
    }
    const fail = () => showBar('error');
    v.addEventListener('playing', () => { started = true; if (bar) { bar.remove(); bar = null; } });
    v.addEventListener('ended', clear);
    v.addEventListener('error', fail);
    v.querySelectorAll('source').forEach(src => src.addEventListener('error', () => { if (v.networkState === 3 || !v.currentSrc) fail(); }));
    // never got going: blocked autoplay (paused with data) or nothing loaded at all
    timers.push(setTimeout(() => {
      if (started || done || !v.isConnected || v.ended) return;
      if (v.networkState === 3 || v.error) fail();
      else if (v.paused && v.readyState >= 2 && (v.autoplay || v.__kWant || o.expectPlay)) showBar('blocked');
    }, 2500));
    timers.push(setTimeout(() => { if (!started && !done && v.isConnected && !v.ended && (v.autoplay || v.__kWant || !v.paused || o.expectPlay)) fail(); }, o.maxWaitMs || 15000));
    // stalled mid-way
    timers.push(setInterval(() => {
      if (!started || done || v.paused || v.ended) { lastT = v.currentTime; return; }
      if (v.currentTime === lastT) fail(); lastT = v.currentTime;
    }, 12000));
  }
  function guardAll(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === 'VIDEO') guardVideo(root);
    else root.querySelectorAll && root.querySelectorAll('video').forEach(v => guardVideo(v));
  }
  function startVideoWatch() {
    guardAll(document.body);
    new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(guardAll); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.body) startVideoWatch(); else document.addEventListener('DOMContentLoaded', startVideoWatch);
  // remember that the game asked a video to play (so a blocked/failed start is noticed); the
  // original promise is returned untouched
  try {
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (this.tagName === 'VIDEO') this.__kWant = true; return origPlay.apply(this, arguments); };
  } catch (e) {}

  // ---------- toast ----------
  let toastBox;
  function toast(text, variant = 'info', ms = 3200) {
    if (!toastBox || !toastBox.isConnected) { toastBox = el('div', 'k-toasts'); document.body.appendChild(toastBox); }
    const t = el('div', `k-toast ${variant}`, text); toastBox.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- feed entry renderer ----------
  // Matches:  [emoji ]Name[ (Role)][ verb...]: "quote"
  const SPEAKER = /^\s*((?:[\p{Extended_Pictographic}️‍]+\s*)?)([A-Z][\w'’.\- ]{1,40}?)(?:\s*\(([^)]{1,30})\))?((?:\s+[a-z]+){0,3}(?:\s+(?:to|with)\s+[^:]{1,30})?)\s*:\s*(["“].*)$/su;
  const NOT_SPEAKERS = /^(ONE-LINER|FINAL MESSAGE|FINAL LINE|Sending|It's|The headlines|Security|Investigators|Sponsors|An internal|Playing|Result|Score|Note|Warning|Tip)\b/i;
  function renderEntry(html) {
    const text = String(html == null ? '' : html);
    const plain = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    // fixtures
    if (/^\s*⚽\s*\[[A-Z0-9 '\-]+\]/.test(plain)) {
      const m = plain.match(/^\s*⚽\s*(\[[^\]]+\]\s*[^.!?]+[.!?]?)(.*)$/s);
      return el('div', 'k-fixture', `<img class="px" width="32" height="32" alt="" src="${ART['ico-ball'] || ''}"><div><b>${esc(m ? m[1] : plain)}</b>${m && m[2].trim() ? `<br><small>${esc(m[2].trim())}</small>` : ''}</div>`);
    }
    // newspaper headlines
    if (/^\s*📰/.test(plain) && /headline|front page|back page|reports?:/i.test(plain) && plain.length < 600) {
      const e = el('article', 'k-news');
      e.innerHTML = `<div class="mast">THE DAILY KREPLIN</div><p>${text.replace(/^\s*📰\s*/, '')}</p>`;
      return e;
    }
    const sm = plain.length < 1400 && !/<(div|table|ul|ol|img|video|canvas)\b/i.test(text) ? plain.match(SPEAKER) : null;
    if (sm) {
      const [, emo, name, roleParen, verb, quote] = sm;
      const who = (name + (verb || '')).trim();
      const c = lookup(who) || lookup(name) || (roleParen && lookup(roleParen));
      const properName = /^(?:[A-Z][a-z'’\-]+)(?:\s(?:[A-Z][a-z'’\-]+|van|de|la))*\.?$/.test(name.trim()) || /^[A-Z][a-z]+$/.test(name.trim());
      if (!NOT_SPEAKERS.test(name.trim()) && (c || properName)) {
        const img = c && ART[c.id];
        const isYou = c && c.id === 'chairman';
        const label = isYou ? 'You' : name.trim();
        const ava = img ? `<img class="px" alt="" src="${img}">` : esc(label[0] || '?');
        const isText = /📱|💬/.test(emo || '') || /\btexts?\b/i.test(verb || '');
        const tags = [roleParen || (c && !isYou && c.role) || '', isText ? 'Text' : '', verb && verb.trim() && !/^(says?|said)$/.test(verb.trim()) ? verb.trim() : ''].filter(Boolean);
        const e = el('article', `k-msg ${c && c.kind ? c.kind : ''}`);
        const key = quote.slice(0, 10);
        const idx = text.indexOf(key);
        const qHtml = idx >= 0 ? text.slice(idx) : esc(quote);
        e.innerHTML = `<div class="ava">${ava}</div><div class="bd"><div class="who">${esc(label)}${tags.length ? ` <span class="tag">${tags.map(esc).join(' · ')}</span>` : ''}</div><p>${qHtml}</p></div>`;
        return e;
      }
    }
    const e = el('div', 'k-line');
    if (/<(div|table)\b[^>]*style=/i.test(text)) e.classList.add('raw');
    if (/^\s*(❌|⚠️|🚨|💔|☠️|💀|🚔|⛔)/u.test(plain)) e.classList.add('bad');
    else if (/^\s*(✅|🎉|🏆|💰|💎|📈)/u.test(plain)) e.classList.add('good');
    else if (/^\s*(💋|❤️|😘|🍑)/u.test(plain)) e.classList.add('sense');
    else if (/^[A-Z0-9 '!:\-]{6,}$/.test(plain.trim().slice(0, 40)) && plain.length < 120) e.classList.add('shout');
    e.innerHTML = text;
    return e;
  }

  window.KUI = { modal, guardVideo, alert: kAlert, confirm: kConfirm, prompt: kPrompt, cutscene, toast, renderEntry, portraitFor, cast, lookup, ART, esc };
})();
