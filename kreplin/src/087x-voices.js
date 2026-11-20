/* ===== KVoice: pre-rendered voice lines (ElevenLabs stock voices, embedded by tools/build.js "@audio") =====
   window.KREPLIN_AUDIO = { 'commentary/goal_home_1': dataURL, 'voicemail/delmor_01': ..., 'broadcast/vanonslaught_1': ... }

   Commentary (live match overlay, src/025 revealMatchEvents):
     KVoice.say(cat)            plays a clip from a category (goal_home, red, kickoff, ...), drawn from a
                                no-repeat bag; never overlaps (skipped while a clip is playing)
     KVoice.matchEvent(event)   big moments always (goals, own goals, reds, injuries, pitch invaders),
                                minor ones ~30% (yellows, fouls, chances)
     KVoice.fulltime(us, them)
   Voicemails (never autoplay): when a voiced Delmor text / Van Onslaught announcement appears anywhere in
   the page (feed, rival-text popup, phone, TV broadcast modal), a tap-to-play "▶ voicemail" chip is attached
   to it (a MutationObserver matches the line's text; no other system is touched).
   Settings: "Voices" on/off in Audio Controls (localStorage 'kreplin_voices', default on). Volume follows
   the music volume; music muted = voices silent.
   Specs + texts: audio/specs/{commentary,voicemail,broadcast}.json (tools/voices.js). */
(function () {
  'use strict';
  const LS = 'kreplin_voices';
  const A = () => window.KREPLIN_AUDIO || {};
  let current = null;

  function enabled() { try { return localStorage.getItem(LS) !== 'off'; } catch (_) { return true; } }
  function setEnabled(on) {
    try { localStorage.setItem(LS, on ? 'on' : 'off'); } catch (_) {}
    if (!on) stop();
    syncUI();
  }
  function toggle() { setEnabled(!enabled()); }
  function volume() {
    const muted = window._isMusicMuted ? window._isMusicMuted() : false;
    if (muted) return 0;
    const mv = window._getMusicVolume ? window._getMusicVolume() : 0.6;
    return Math.max(0.15, Math.min(1, mv + 0.3)); // voices sit a little above the music bed
  }
  function busy() { return !!(current && !current.paused && !current.ended); }
  function stop() { try { if (current) { current.pause(); current = null; } } catch (_) {} }

  function playKey(key, opts) {
    const url = A()[key];
    if (!url) return false;
    const force = opts && opts.force;
    if (!force && (!enabled() || busy())) return false;
    const v = volume();
    if (!v) return false;
    if (force) stop();
    try {
      const a = new Audio(url);
      a.volume = v;
      current = a;
      a.addEventListener('ended', () => { if (current === a) current = null; });
      const p = a.play();
      if (p && p.catch) p.catch(() => { if (current === a) current = null; });
      return a;
    } catch (_) { return false; }
  }
  function keysFor(cat) { return Object.keys(A()).filter(k => k.startsWith('commentary/' + cat + '_')).sort(); }
  function say(cat, chance) {
    if (chance != null && Math.random() >= chance) return false;
    if (!enabled() || busy()) return false;
    const ks = keysFor(cat);
    if (!ks.length) return false;
    const k = window.KPacing ? KPacing.bag('voice:' + cat, ks) : ks[Math.floor(Math.random() * ks.length)];
    return playKey(k);
  }
  function matchEvent(e) {
    if (!e || !enabled()) return;
    const k = e.kind || '';
    if (k === 'GOAL') return say(e.who === 'AWAY' ? 'goal_away' : 'goal_home');
    if (k === 'OWN_GOAL') return say('own_goal');
    if (k === 'RED_CARD' || k === 'DODGY_RED_CARD' || (k === 'CARD' && (e.cardType === 'RED' || e.card === 'RED'))) return say('red');
    if (k === 'STRETCHER_INJURY') return say('injury');
    if (/^CRAZY_/.test(k)) return say('invader');
    if (k === 'YELLOW_CARD' || k === 'CARD') return say('yellow', 0.3);
    if (k === 'FOUL') return say('foul', 0.3);
    if (k === 'SHOT') return say(Math.random() < 0.5 ? 'chance' : 'save', 0.3);
  }
  function fulltime(us, them) { return say(us > them ? 'fulltime_win' : us < them ? 'fulltime_loss' : 'fulltime_draw'); }

  // ---------------- voicemail chips ----------------
  // match: a distinctive fragment of the in-game text (case/punctuation-insensitive)
  const VOICEMAILS = [
    ['voicemail/delmor_01', "Don't get too comfortable, little rat"],
    ['voicemail/delmor_02', "Look who we have here. I'm Delmor Krunchem"],
    ['voicemail/delmor_03', "Hello, you worthless scumbag. I'm Delmor Krunchem"],
    ['voicemail/delmor_04', 'Ha ha ha! You lost! You will never win!'],
    ['voicemail/delmor_05', 'I hate you. Days like this keep me young.'],
    ['voicemail/delmor_06', "Another loss. I'm loving every second of your misery."],
    ['voicemail/delmor_07', 'Ha ha, another loss. Some chairman you are.'],
    ['voicemail/delmor_08', 'You bottled it again. Embarrassing.'],
    ['voicemail/delmor_09', 'We beat you. Again. It never gets old.'],
    ['voicemail/delmor_10', 'We own you. We always have. We always will.'],
    ['voicemail/delmor_11', 'Portsmouth win, Southampton lose. Just like it should be.'],
    ['voicemail/delmor_12', 'Just letting you know the entire'],
    ['voicemail/delmor_13', "She's moved in with me. Don't worry"],
    ['voicemail/delmor_14', "I'm coming for you. You killed my family. I will make you suffer."],
    ['voicemail/delmor_15', "I can see you. I know where you are. Sleep well, knowing I'm coming."],
    ['voicemail/delmor_16', 'Your club is a joke and so are you.'],
    ['broadcast/vanonslaught_1', 'the coronation of the Muslim Premier League'],
    ['broadcast/vanonslaught_2', 'The following clubs have been liquidated'],
    ['broadcast/vanonslaught_3', "We didn't want to do this, but the fans of the clubs in question demanded it"],
    ['broadcast/vanonslaught_4', 'The league continues," Van Onslaught announces'],
    ['broadcast/vanonslaught_5', 'Football will be purified. Compliance will be rewarded.'],
    ['broadcast/vanonslaught_6', 'you are a vile, treacherous pig']
  ];
  const norm = t => String(t || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();
  const MATCHERS = VOICEMAILS.map(([key, m]) => ({ key, m: norm(m) }));

  function chip(key) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'k-vm-chip';
    b.dataset.vm = key;
    const who = key.startsWith('broadcast/') ? 'broadcast' : 'voicemail';
    b.textContent = '▶ ' + who;
    b.title = 'Play the ' + who + ' (tap to play)';
    b.setAttribute('aria-label', 'Play ' + who);
    b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (b.classList.contains('playing')) { stop(); b.classList.remove('playing'); b.textContent = '▶ ' + who; return; }
      const a = playKey(key, { force: true });
      if (!a) { b.textContent = (volume() ? '✕ ' : '🔇 ') + who; setTimeout(() => { b.textContent = '▶ ' + who; }, 1400); return; }
      b.classList.add('playing'); b.textContent = '■ ' + who;
      a.addEventListener('ended', () => { b.classList.remove('playing'); b.textContent = '▶ ' + who; });
    });
    return b;
  }
  // Attach a chip to the smallest element holding a voiced line (once per element)
  function scan(root) {
    if (!root || root.nodeType !== 1 || !Object.keys(A()).length) return;
    if (root.closest && root.closest('.k-vm-chip, script, style, #musicControlModal')) return;
    const txt = root.textContent || '';
    if (txt.length < 12 || txt.length > 6000) return;
    const n = norm(txt);
    for (const { key, m } of MATCHERS) {
      if (!A()[key] || n.indexOf(m) < 0) continue;
      // descend to the deepest element that still contains the line
      let el = root, again = true;
      while (again) {
        again = false;
        for (const c of el.children) {
          if (c.classList && c.classList.contains('k-vm-chip')) continue;
          if (norm(c.textContent).indexOf(m) >= 0) { el = c; again = true; break; }
        }
      }
      while (el !== root && el.parentElement && /^(SPAN|STRONG|EM|B|I|SMALL|Q)$/.test(el.tagName)) el = el.parentElement;
      if (el.querySelector(':scope > .k-vm-chip[data-vm="' + key + '"]') || (el.dataset && el.dataset.vmDone === key)) continue;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/.test(el.tagName)) continue;
      if (el.dataset) el.dataset.vmDone = key;
      el.appendChild(document.createTextNode(' '));
      el.appendChild(chip(key));
    }
  }
  let mo = null;
  function watch() {
    if (mo || !document.body || typeof MutationObserver === 'undefined') return;
    mo = new MutationObserver(list => {
      for (const r of list) for (const nd of r.addedNodes) {
        if (nd.nodeType === 1) scan(nd);
        else if (nd.nodeType === 3 && nd.parentElement) scan(nd.parentElement);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ---------------- settings UI (Audio Controls modal) ----------------
  function syncUI() {
    const b = document.getElementById('voicesToggleBtn');
    if (b) { const on = enabled(); b.textContent = on ? 'ON' : 'OFF'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('off', !on); }
  }
  const css = document.createElement('style');
  css.textContent = `.k-vm-chip{display:inline-flex;align-items:center;gap:4px;margin:4px 0 0 6px;padding:3px 9px;font:600 11px/1.3 system-ui,sans-serif;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(220,40,40,.18);color:inherit;cursor:pointer;vertical-align:middle;white-space:nowrap}
.k-vm-chip:hover{background:rgba(220,40,40,.32)}.k-vm-chip.playing{background:rgba(220,40,40,.5)}
#voicesToggleBtn.off{opacity:.6}`;
  (document.head || document.documentElement).appendChild(css);
  function init() { watch(); syncUI(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#musicControlBtn, [data-nav="audio"]')) setTimeout(syncUI, 0); });

  window.KVoice = { say, matchEvent, fulltime, enabled, setEnabled, toggle, stop, playKey, scan, VOICEMAILS };
  window.toggleVoices = toggle;
})();
