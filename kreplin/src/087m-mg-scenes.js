/* ===================== KREPLIN — pixel scene "minigames" (spec #11–13) =====================
   Menus kept exactly as they were (same options, same effects in the callers); these only stage them.
   KreplinScenes.halftime({ title, subtitle, options:[{id,label,description}], defaultId, skipState }) -> Promise<id>
       Dressing-room scene (bg-locker + 3 players on the bench) in a KUI modal. Picking an option swaps the
       players to a reaction sprite for a beat (calm/tweak nod, fire = terror, HGH/cocaine = roid rage,
       emotional blackmail = horror), then resolves. Esc / skipState.requested -> defaultId (as before).
   KreplinScenes.date.open() / .update({ line, who }) / .close()
       Restaurant table panel above the feed for the season-3 date; the dialogue still runs through choose().
       Shows the visible AWKWARDNESS meter computed from S.season3.son_humiliation / player_jealousy /
       secretary_validation (the hidden meters; their season-3 consequences are wired in src/020).
   KreplinScenes.tinderPortrait(profile) -> { src, filter } | null   pixel portrait for a Tinder profile.
*/
(function () {
  const ART = () => window.KREPLIN_ART || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function css() {
    if (document.getElementById('kSceneCss')) return;
    const st = document.createElement('style'); st.id = 'kSceneCss';
    st.textContent = `
.ks-room{position:relative;width:100%;aspect-ratio:384/216;background:#000 center/cover no-repeat;image-rendering:pixelated;border:var(--px,2px) solid #000;border-radius:var(--r,4px);overflow:hidden}
.ks-room::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.45));pointer-events:none}
.ks-room .pl{position:absolute;bottom:2%;width:27%;image-rendering:pixelated;transform-origin:50% 100%;animation:ksBob 1.6s ease-in-out infinite;z-index:1}
.ks-room .pl.flip{transform:scaleX(-1)} .ks-room .pl.flip{animation-name:ksBobF}
.ks-room .pl.react{animation:ksPop .35s ease-out 1,ksShake .3s linear .35s 3}
.ks-room .pl.flip.react{animation:ksPopF .35s ease-out 1}
.ks-room .ch{position:absolute;left:2%;top:4%;width:17%;image-rendering:pixelated;border:2px solid #000;background:#0d1016;border-radius:4px;z-index:2}
.ks-bubble{position:absolute;left:21%;top:5%;right:4%;background:#f4f1ea;color:#0d1016;font:600 13px/1.25 var(--font-ui,monospace);padding:6px 8px;border:2px solid #000;border-radius:4px;box-shadow:2px 2px 0 #000;z-index:2}
.ks-bubble::before{content:'';position:absolute;left:-8px;top:10px;border:6px solid transparent;border-right-color:#000}
.ks-cap{min-height:1.4em;margin:8px 0 4px;font:600 14px/1.3 var(--font-ui,monospace);color:var(--gold,#f2c14e)}
.ks-opts{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.ks-opts .k-btn{width:100%;justify-content:flex-start;text-align:left}
.ks-opts .k-btn small{display:block;font-weight:400;opacity:.75;font-size:12px}
.ks-opts .k-btn[disabled]{opacity:.5}
@keyframes ksBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2%)}}
@keyframes ksBobF{0%,100%{transform:scaleX(-1) translateY(0)}50%{transform:scaleX(-1) translateY(-2%)}}
@keyframes ksPop{0%{transform:scale(.8)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes ksPopF{0%{transform:scaleX(-.8) scaleY(.8)}60%{transform:scaleX(-1.12) scaleY(1.12)}100%{transform:scaleX(-1)}}
@keyframes ksShake{0%,100%{translate:0 0}25%{translate:-2px 0}75%{translate:2px 0}}
/* restaurant date panel */
.ks-date{position:relative;flex:none;height:170px;margin:0;border-bottom:var(--px,2px) solid #000;overflow:hidden;
  background:radial-gradient(ellipse at 50% 70%,#5a2a1c 0%,#2a1210 55%,#120807 100%);image-rendering:pixelated}
.ks-date .wall{position:absolute;inset:0 0 38% 0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 6px,transparent 6px 24px)}
.ks-date .lamp{position:absolute;top:0;width:10px;height:22px;background:#f2c14e;box-shadow:0 0 24px 10px rgba(242,193,78,.35);border-radius:0 0 5px 5px}
.ks-date .who{position:absolute;bottom:34px;width:84px;height:84px;image-rendering:pixelated;transition:transform .25s}
.ks-date .who.talk{transform:translateY(-4px)}
.ks-date .who.shrink{transform:scale(.86);transform-origin:50% 100%;filter:saturate(.6)}
.ks-date .table{position:absolute;left:4%;right:4%;bottom:0;height:46px;background:#f4f1ea;border-top:4px solid #fff;box-shadow:inset 0 -10px 0 #d9d2c3, 0 -2px 0 #000}
.ks-date .table::before{content:'';position:absolute;left:50%;top:-22px;width:6px;height:20px;margin-left:-3px;background:#e9e6de;border:1px solid #000}
.ks-date .table::after{content:'';position:absolute;left:50%;top:-30px;width:6px;height:8px;margin-left:-3px;background:#f29b2e;border-radius:50% 50% 30% 30%;box-shadow:0 0 14px 6px rgba(242,155,46,.5);animation:ksFlick .4s steps(2) infinite}
.ks-date .plate{position:absolute;bottom:14px;width:46px;height:12px;background:#fff;border:2px solid #000;border-radius:50%}
.ks-date .bub{position:absolute;top:8px;left:8px;max-width:min(520px,calc(100% - 190px));background:#f4f1ea;color:#0d1016;padding:5px 9px;border:2px solid #000;border-radius:4px;box-shadow:2px 2px 0 #000;
  font:600 13px/1.25 var(--font-ui,monospace);white-space:normal;max-height:48px;overflow:hidden}
.ks-date .meter{position:absolute;right:8px;top:8px;width:170px;padding:4px 6px 5px;background:rgba(13,16,22,.88);border:2px solid #000;border-radius:4px;box-shadow:2px 2px 0 #000}
.ks-date .meter b{display:flex;justify-content:space-between;font:700 10px/1.2 var(--font-ui,monospace);color:#f2c14e;letter-spacing:1px;margin-bottom:3px}
.ks-date .meter b em{font-style:normal;color:#fff}
.ks-date .meter s{display:block;position:relative;height:9px;background:#2e3547;border:1px solid #000;text-decoration:none}
.ks-date .meter i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3fbf6b,#f2c14e 50%,#e5484d);transition:width .8s ease-out}
.ks-date .bump{position:absolute;right:14px;top:44px;font:700 14px var(--font-ui,monospace);color:#e5484d;text-shadow:1px 1px 0 #000;animation:ksUp 1.2s ease-out forwards}
@keyframes ksFlick{50%{opacity:.75}}
@keyframes ksUp{from{transform:translateY(8px);opacity:1}to{transform:translateY(-14px);opacity:0}}
@media (max-width:700px){.ks-date{height:172px}.ks-date .who{width:64px;height:64px;bottom:22px}.ks-date .table{height:26px}.ks-date .plate{display:none}.ks-date .bub{font-size:11px;max-height:38px;max-width:none;right:8px;top:auto;bottom:4px;padding:3px 7px}.ks-date .meter{left:8px;right:8px;width:auto;top:6px;padding:2px 6px 4px}.ks-date .bump{top:30px}}
.k-px-portrait{image-rendering:pixelated!important;object-fit:cover}
`;
    document.head.appendChild(st);
  }

  // =================================== Half-time ===================================
  const HT_REACT = { calm: 'nod', tweak: 'nod', tactical: 'nod', fire: 'scared', aggressive: 'scared', hgh: 'roid', cocaine: 'roid', emotional_blackmail: 'shocked' };
  function halftime(o = {}) {
    const options = o.options || [];
    const fallback = o.defaultId || (options[0] && options[0].id);
    if (!options.length) return Promise.resolve(o.defaultId || null);
    if (!window.KUI || typeof KUI.modal !== 'function') return Promise.resolve(fallback);
    css();
    const A = ART();
    const node = el('div');
    const room = el('div', 'ks-room'); room.style.backgroundImage = `url("${A['bg-locker'] || ''}")`;
    const pls = [{ l: '20%', f: false }, { l: '46%', f: true }, { l: '72%', f: false }].map((p, i) => {
      const img = el('img', 'pl px' + (p.f ? ' flip' : '')); img.alt = ''; img.src = A['mg-ht-player-idle'] || ''; img.style.left = p.l; img.style.animationDelay = (i * 0.37) + 's';
      room.appendChild(img); return img;
    });
    const ch = el('img', 'ch px'); ch.alt = ''; ch.src = A.chairman || ''; room.appendChild(ch);
    room.appendChild(el('div', 'ks-bubble', esc(o.subtitle || "What's the message in the dressing room?")));
    const cap = el('div', 'ks-cap', '');
    const opts = el('div', 'ks-opts');
    node.append(room, cap, opts);
    return KUI.modal({
      title: o.title || 'Half-time', node, actions: [], dismissible: false, portrait: 'ico-ball',
      onOpen(box, done) {
        let picked = false, skipIv = null;
        const finish = id => { if (skipIv) clearInterval(skipIv); document.removeEventListener('keydown', onKey, true); done(id); };
        const pick = (opt) => {
          if (picked) return; picked = true;
          opts.querySelectorAll('button').forEach((b, i) => { b.disabled = true; b.classList.toggle('primary', options[i] === opt); b.style.opacity = options[i] === opt ? '1' : ''; });
          const r = HT_REACT[opt.id] || 'nod';
          pls.forEach((p, i) => { p.src = A['mg-ht-player-' + r] || p.src; p.classList.remove('react'); void p.offsetWidth; p.classList.add('react'); p.style.animationDelay = (i * 0.08) + 's'; });
          cap.textContent = opt.description || opt.label || '';
          setTimeout(() => finish(opt.id), 1300);
        };
        options.forEach((opt, i) => {
          const b = el('button', 'k-btn' + (i === 0 ? ' primary' : ''), `<kbd>${i + 1}</kbd><span>${esc(opt.label || opt.id)}${opt.description ? `<small>${esc(opt.description)}</small>` : ''}</span>`);
          b.onclick = e => { e.preventDefault(); e.stopPropagation(); pick(opt); };
          opts.appendChild(b);
        });
        function onKey(e) {
          if (picked) return;
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); picked = true; finish(fallback); }
          else if (/^[1-9]$/.test(e.key) && options[+e.key - 1]) { e.preventDefault(); e.stopPropagation(); pick(options[+e.key - 1]); }
        }
        document.addEventListener('keydown', onKey, true);
        if (o.skipState) skipIv = setInterval(() => { try { if (o.skipState.requested && !picked) { picked = true; finish(fallback); } } catch (_) {} }, 100);
        setTimeout(() => { const f = opts.querySelector('button'); if (f) try { f.focus({ preventScroll: true }); } catch (_) {} }, 0);
      },
    });
  }

  // =================================== Restaurant date ===================================
  // Visible awkwardness = the three hidden meters, weighted (validation is the secretary enjoying herself).
  function awkwardness() {
    const s3 = (window.S && S.season3) || {};
    const raw = (s3.son_humiliation | 0) + (s3.player_jealousy | 0) + 0.5 * (s3.secretary_validation | 0);
    return Math.max(0, Math.min(1, raw / 18));
  }
  const date = {
    elx: null, last: 0,
    open() {
      css(); this.close();
      const A = ART();
      const host = document.getElementById('kCentre') || document.body;
      const feedWrap = document.getElementById('dialoguePanel');
      const d = el('div', 'ks-date'); d.id = 'ksDate';
      d.innerHTML = `<div class="wall"></div><div class="lamp" style="left:22%"></div><div class="lamp" style="left:76%"></div>
        <img class="who px" data-who="son" alt="" style="left:10%"><img class="who px" data-who="secretary" alt="" style="left:50%;margin-left:-42px">
        <img class="who px" data-who="you" alt="" style="right:14%">
        <div class="table"><span class="plate" style="left:12%"></span><span class="plate" style="left:calc(50% - 25px)"></span><span class="plate" style="right:16%"></span></div>
        <div class="bub"></div><div class="meter" title="Awkwardness"><b>AWKWARDNESS <em>0%</em></b><s><i></i></s></div>`;
      d.querySelector('[data-who=son]').src = A.son || '';
      d.querySelector('[data-who=secretary]').src = A.secretary || '';
      const you = d.querySelector('[data-who=you]'); you.src = A['mg-key-chairman'] || A.chairman || '';
      if (feedWrap && feedWrap.parentNode === host) host.insertBefore(d, feedWrap); else host.prepend(d);
      this.elx = d; this.last = awkwardness();
      this.update({ line: '', who: 'secretary' });
    },
    update({ line, who } = {}) {
      const d = this.elx; if (!d || !d.isConnected) return;
      const b = d.querySelector('.bub'); b.textContent = line || ''; b.style.display = line ? '' : 'none';
      d.querySelectorAll('.who').forEach(w => w.classList.toggle('talk', w.dataset.who === who));
      const a = awkwardness(), pct = Math.round(a * 100);
      d.querySelector('.meter i').style.width = pct + '%';
      d.querySelector('.meter em').textContent = pct + '%';
      if (a > this.last + 0.001) { const bump = el('div', 'bump', '+' + Math.round((a - this.last) * 100) + '%'); d.appendChild(bump); setTimeout(() => bump.remove(), 1300); }
      this.last = a;
      const s3 = (window.S && S.season3) || {};
      d.querySelector('[data-who=son]').classList.toggle('shrink', (s3.son_humiliation | 0) >= 6);
    },
    close() { const d = document.getElementById('ksDate'); if (d) d.remove(); this.elx = null; },
    awkwardness,
  };

  // =================================== Tinder portraits ===================================
  const NAMED = { sarah: 'mg-tinder-sarah', sanmik: 'mg-tinder-sanmik', luke: 'mg-tinder-luke' };
  const GENERIC = ['mg-tinder-g1', 'mg-tinder-g2', 'mg-tinder-g3', 'mg-tinder-g4', 'mg-tinder-g5', 'mg-tinder-g6', 'mg-tinder-g7'];
  // p.portrait is set per swipe pool (generateTinderProfilePool); saved matches fall back to a stable name hash.
  function tinderPortrait(p) {
    if (!p) return null;
    css();
    const A = ART(), name = String(p.name || '').trim();
    if (p.portrait && A[p.portrait]) return { src: A[p.portrait], filter: '' };
    const key = NAMED[name.toLowerCase()];
    if (key) return A[key] ? { src: A[key], filter: '' } : null;
    let h = 0; for (const c of (name || String(p.bio || 'x'))) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const k = GENERIC[h % GENERIC.length];
    return A[k] ? { src: A[k], filter: '' } : null;
  }
  function applyPortrait(img, p) {
    const px = tinderPortrait(p);
    if (!img) return false;
    if (!px) { img.classList.remove('k-px-portrait'); img.style.filter = ''; return false; }
    css(); img.classList.add('k-px-portrait'); img.style.filter = px.filter; img.src = px.src; img.style.display = 'block'; img.style.opacity = '1';
    return true;
  }

  window.KreplinScenes = { halftime, date, tinderPortrait, applyPortrait, TINDER_NAMED: NAMED, TINDER_GENERIC: GENERIC };
})();
