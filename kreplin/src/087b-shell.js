/* ===================== KREPLIN shell (presentation only) =====================
   Drives the approved layout (mockup/office.html): top bar, nav rail / phone tab bar, scene banner,
   inbox feed date labels, decision card decoration, match brief and mini league table.
   Reads game state; never changes game rules. Everything hangs off GameHooks events plus a
   MutationObserver on #actions (buttons added outside choose() get the same treatment). */
(function () {
  const ART = window.KREPLIN_ART || {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const St = () => window.S || null;

  // ---------- art ----------
  function bindArt(root) {
    (root || document).querySelectorAll('img[data-art]').forEach(img => {
      const u = ART[img.dataset.art]; if (u && img.getAttribute('src') !== u) img.src = u;
    });
  }

  // ---------- football calendar ----------
  // Season N runs Aug (year 2024+N) to May; matchdays spread over Saturdays.
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function gameDate() {
    const s = St() || {};
    const season = Math.max(1, s.season | 0 || 1);
    const n = Math.max(1, s.season_matches | 0 || 16);
    const played = Math.max(0, s.matches_played | 0);
    const md = Math.min(played, n - 1);
    const year = 2024 + season;
    const start = new Date(Date.UTC(year, 7, 9));            // 9 Aug
    while (start.getUTCDay() !== 6) start.setUTCDate(start.getUTCDate() + 1); // first Saturday on/after
    const weeks = n > 1 ? Math.round(md * (39 / (n - 1))) : 0; // last matchday ~ mid May
    const d = new Date(start.getTime() + weeks * 7 * 864e5);
    const ph = (s.phase || window.__ui_context || '');
    if (/evening|home/.test(ph) || (played > md)) { /* evening of the same Saturday */ }
    return { d, season, matchday: Math.min(played + 1, n), n, over: played >= n };
  }
  function dateShort(g) { return `${DAYS[g.d.getUTCDay()]} ${g.d.getUTCDate()} ${MONTHS[g.d.getUTCMonth()]} ${g.d.getUTCFullYear()}`; }
  function dayLabel() {
    if (!St() || !St().season) return '';
    const g = gameDate();
    return `${DAYS_L[g.d.getUTCDay()]} ${g.d.getUTCDate()} ${MONTHS_L[g.d.getUTCMonth()]}`.toUpperCase();
  }

  // ---------- money ----------
  function money(n) {
    n = Number(n) || 0; const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (a >= 1e9) return `${sg}£${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sg}£${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
    if (a >= 1e4) return `${sg}£${Math.round(a / 1e3)}K`;
    return `${sg}£${Math.round(a).toLocaleString('en-GB')}`;
  }

  // ---------- league (read-only view of S.table) ----------
  function leagueRows() {
    const s = St(); if (!s || !s.table) return [];
    const club = (typeof getClubName === 'function') ? getClubName() : (s.club_name || 'Southampton FC');
    const destroyed = s.destroyedTeams || [];
    const rebranded = (s.season4 && s.season4.clubs_taken_over) ? Object.keys(s.season4.clubs_taken_over) : [];
    let valid = null;
    if ((s.season === 4 || s.season === 5) && Array.isArray(s.opponents)) valid = new Set([club, ...s.opponents]);
    return Object.entries(s.table).filter(([t]) => {
      if (rebranded.includes(t)) return false;
      if (valid) return valid.has(t);
      return !destroyed.includes(t);
    }).map(([team, r]) => ({ team, P: r.P | 0, W: r.W | 0, D: r.D | 0, L: r.L | 0, GF: r.GF | 0, GA: r.GA | 0, GD: (r.GF | 0) - (r.GA | 0), PTS: r.PTS | 0, us: team === club }))
      .sort((a, b) => b.PTS - a.PTS || b.GD - a.GD || b.GF - a.GF || a.team.localeCompare(b.team));
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const shortTeam = t => String(t || '').replace(/ FC$| F\.C\.$|^AFC /, '');

  // ---------- recent form (UI-side record of W/D/L changes) ----------
  function trackForm() {
    const s = St(); if (!s) return [];
    const ui = s._ui || (s._ui = {});
    const cur = { season: s.season | 0, w: s.wins | 0, d: s.draws | 0, l: s.losses | 0 };
    const last = ui.formLast;
    if (!last || last.season !== cur.season || cur.w + cur.d + cur.l < last.w + last.d + last.l) {
      ui.form = []; // new season / load: seed nothing we can't know
    } else {
      for (let i = 0; i < cur.w - last.w; i++) ui.form.push('W');
      for (let i = 0; i < cur.d - last.d; i++) ui.form.push('D');
      for (let i = 0; i < cur.l - last.l; i++) ui.form.push('L');
      ui.form = ui.form.slice(-5);
    }
    ui.formLast = cur;
    return ui.form || [];
  }

  // ---------- top bar ----------
  let lastDistorted = null;
  function renderTop() {
    const s = St(); if (!s) return;
    const club = (typeof getClubName === 'function') ? getClubName() : (s.club_name || 'Southampton FC');
    const set = (id, v) => { const e = $(id); if (e && e.textContent !== String(v)) e.textContent = v; };
    set('kClubName', shortTeam(club).toUpperCase());
    set('kChairName', s.full_name ? `Chairman: ${s.full_name}` : 'Chairman');
    const g = gameDate();
    const dateEl = $('kDate');
    if (dateEl) dateEl.firstChild.nodeValue = s.season ? dateShort(g) : ' ';
    set('kDateSub', s.season ? (g.over ? `Season ${g.season} · season complete` : `Season ${g.season} · Matchday ${g.matchday} of ${g.n}`) : '');
    set('kClubCash', money(s.club_cash));
    set('kChairCash', money(s.chairman_cash));
    const dc = (typeof s.club_debt === 'number') ? s.club_debt : (s.debt_club | 0);
    const dp = (typeof s.debt_personal === 'number') ? s.debt_personal : (s.personal_debt | 0);
    set('kDebt', money(dc + dp));
    $('kDebt') && $('kDebt').classList.toggle('bad', dc + dp > 0);
    $('kClubCash') && $('kClubCash').classList.toggle('bad', (s.club_cash || 0) < 0);
    // insolvency ladder: chip appears once net debt is on the way to the first rung
    const dd = typeof window.debtDanger === 'function' ? window.debtDanger() : null;
    const dEl0 = $('kStatDanger');
    if (dEl0 && dd) {
      const show = dd.stage > 0 || dd.net >= (dd.rungs[1].at * 0.5);
      dEl0.hidden = !show;
      const tone = dd.stage >= 3 || dd.level >= 3 ? 'bad' : dd.stage >= 1 || dd.level >= 1 ? 'warn' : 'ok';
      dEl0.dataset.tone = tone;
      set('kDanger', dd.stage > 0 ? `${dd.rungs[dd.stage].name}${dd.stage === 4 ? ` · ${Math.max(0, dd.grace - dd.admin_matches)} left` : ''}` : `${money(dd.net)} net`);
      const bar = $('kDangerBar'); if (bar) bar.style.width = dd.pct + '%';
      dEl0.title = `Net debt ${money(dd.net)} · next: ${dd.next.name} at ${money(dd.next.at)}`;
      document.body.dataset.debt = tone;
    }
    const rows = leagueRows();
    const pos = rows.findIndex(r => r.us) + 1;
    set('kLeagueK', pos ? `League · ${ordinal(pos)}` : 'League');
    const form = trackForm();
    const f = $('kForm');
    if (f) {
      const html = form.length ? form.map(x => `<i class="${x}">${x}</i>`).join('') : `<span class="k-rec">W${s.wins | 0} D${s.draws | 0} L${s.losses | 0}</span>`;
      if (f.innerHTML !== html) f.innerHTML = html;
    }
    const mor = Math.max(0, Math.min(100, s.fan_morale || 50));
    const mb = $('kMorale'); if (mb) mb.style.width = mor + '%';
    set('kMoraleN', mor + '%');
    set('kTokens', String(s.lobby_tokens || 0));
    set('kGems', `${s.kreplin_gems || 0}/4`);
    const drugs = s.inventory && (s.inventory.drugs | 0);
    const dEl = $('kStatDrugs');
    if (dEl) { dEl.hidden = !(s.drugs_unlocked || drugs); set('kDrugs', `${drugs || 0}${s.on_drugs_today ? ' · HIGH' : ''}`); }
    // badges mirror the legacy hud badges (079-phone-news decides unread state)
    const mirror = (legacy, mine, count) => {
      const a = $(legacy), b = $(mine); if (!a || !b) return;
      b.hidden = a.style.display === 'none' || !a.style.display;
      const t = count > 0 ? String(Math.min(count, 99)) : '!'; if (b.textContent !== t) b.textContent = t;
    };
    const newsN = (s.press && Array.isArray(s.press.queue)) ? s.press.queue.length : 0;
    const phoneN = (s.phone_unread | 0) + ((s.rival && Array.isArray(s.rival.inbox)) ? s.rival.inbox.filter(m => !m.read).length : 0);
    mirror('badgeNews', 'kBadgeNews', newsN); mirror('badgePhone', 'kBadgePhone', phoneN);
    syncMoreBadge();
    // coma distortion: warble visuals only while it is active
    const dist = typeof isDistortionActive === 'function' && isDistortionActive();
    if (dist !== lastDistorted) { document.body.classList.toggle('distorted', !!dist); lastDistorted = dist; }
    renderSide();
  }

  // ---------- scene banner + phase tracker ----------
  const SCENES = {
    office: { img: 'office', label: "Chairman's office" },
    stadium: { img: 'stadium', label: 'Matchday · Stadium' },
    locker: { img: 'bg-locker', label: 'Locker room' },
    press: { img: 'bg-press', label: 'Press room' },
    home: { img: 'bg-home', label: 'Home' },
    nightclub: { img: 'bg-nightclub', label: 'Nightclub' },
    boardroom: { img: 'bg-boardroom', label: 'Boardroom' },
    doctor: { img: 'bg-doctor', label: "Doctor's surgery" },
    prison: { img: 'bg-prison', label: 'HMP Winchester' },
    newsroom: { img: 'bg-newsroom', label: 'Newsroom' },
  };
  const PHASE_SCENE = { prematch: 'office', match: 'stadium', postmatch: 'press', evening: 'home', home: 'home', oversight: 'boardroom', prison: 'prison', boot: 'office', name_selection: 'office' };
  const PHASE_LABEL = { prematch: 'Pre-match', match: 'Match', postmatch: 'Post-match', evening: 'Evening', home: 'Evening · Home', oversight: 'FA / Board', prison: 'Prison', boot: 'Season', name_selection: 'New chairman' };
  const STEPS = [['prematch', 'Pre-match'], ['match', 'Match'], ['postmatch', 'Post-match'], ['evening', 'Evening']];
  let curScene = null, curPhase = 'boot';
  function setScene(key, label) {
    const sc = SCENES[key] || SCENES.office;
    const img = $('kSceneImg'), box = $('kScene');
    if (key !== curScene && img) { img.dataset.art = sc.img; img.src = ART[sc.img] || ''; curScene = key; if (box) box.dataset.scene = key; }
    const ph = $('kScenePhase'); if (ph) ph.textContent = `${PHASE_LABEL[curPhase] || 'Chairman'} · ${label || sc.label}`;
    renderTitle();
  }
  function renderTitle() {
    const s = St(); const h = $('kSceneTitle'); if (!h) return;
    const club = s ? shortTeam((typeof getClubName === 'function') ? getClubName() : s.club_name) : 'Southampton';
    let html = esc(club || 'Southampton');
    const opp = currentOpp();
    if (s && s.season && opp && /prematch|match|postmatch/.test(curPhase)) html = `${esc(club)} <em>v</em> ${esc(shortTeam(opp.team))}`;
    else if (s && s.season) html = `${esc(club)} <em>·</em> Season ${s.season}`;
    if (h.innerHTML !== html) h.innerHTML = html;
  }
  function renderSteps() {
    const el = $('kSteps'); if (!el) return;
    const idx = STEPS.findIndex(([k]) => k === curPhase || (k === 'evening' && curPhase === 'home'));
    el.innerHTML = idx < 0 ? '' : STEPS.map(([k, l], i) => `<span class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${i < idx ? '✓ ' : ''}${l}</span>`).join('');
  }
  function setPhaseView(phase) {
    curPhase = phase || curPhase;
    document.body.dataset.phase = curPhase;
    setScene(PHASE_SCENE[curPhase] || 'office');
    renderSteps();
    renderSide();
  }
  const PROMPT_SCENES = [
    [/locker room|dressing room/i, 'locker'], [/press conference|the press|reporters|journalist/i, 'press'],
    [/nightclub|bouncer|vip booth/i, 'nightclub'], [/doctor|surgery|clinic|hospital|medical/i, 'doctor'],
    [/prison|\bcell\b|warden|inmate|parole/i, 'prison'], [/\bFA\b|board demands|board meeting|tribunal|hearing|investigat|sentenc/i, 'boardroom'],
    [/newspaper|headline|tabloid/i, 'newsroom'], [/at home|your wife|spouse|the kids|evening/i, 'home'],
  ];
  function sceneFromPrompt(prompt) {
    const p = String(prompt || '').replace(/<[^>]+>/g, '');
    for (const [re, key] of PROMPT_SCENES) if (re.test(p)) { setScene(key); return; }
    setScene(PHASE_SCENE[curPhase] || 'office');
  }

  // ---------- right column: match brief + league ----------
  function currentOpp() {
    const s = St(); if (!s || !Array.isArray(s.opponents) || !s.opponents.length) return null;
    const i = Math.min(s.matches_played | 0, s.opponents.length - 1);
    if (s.matchContext && s.matchContext.roundIndex === (s.matches_played | 0) && s.matchContext.team) return { team: s.matchContext.team, manager: s.matchContext.manager };
    return { team: s.opponents[i], manager: Array.isArray(s.opponentManagers) ? s.opponentManagers[i] : null };
  }
  function renderSide() {
    const s = St();
    const brief = $('kBrief'), league = $('kLeague');
    if (!s || !s.season) { if (brief) brief.hidden = true; if (league) league.hidden = true; return; }
    const rows = leagueRows();
    const opp = currentOpp();
    const pm = s.preMatch || {};
    if (brief) {
      const show = !!opp && (curPhase === 'prematch' || curPhase === 'match') && (s.matches_played | 0) < (s.season_matches || 99);
      brief.hidden = !show;
      if (show) {
        const club = shortTeam((typeof getClubName === 'function') ? getClubName() : s.club_name);
        const usPos = rows.findIndex(r => r.us) + 1, thPos = rows.findIndex(r => r.team === opp.team) + 1;
        const form = (s._ui && s._ui.form || []).join(' ');
        const us = pm.ourStrength, th = pm.oppStrength;
        const mx = Math.max(60, us || 0, th || 0);
        const bar = (v, cls) => `<div class="b ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, (v / mx) * 100))}%"></i></div>`;
        const mor = Math.max(0, Math.min(100, s.fan_morale || 50));
        let html = `<div class="vs"><div class="t">${esc(club.toUpperCase())}<small>${usPos ? ordinal(usPos) : ''}${form ? ' · ' + esc(form) : ''}</small></div><div class="x">v</div><div class="t">${esc(shortTeam(opp.team).toUpperCase())}<small>${thPos ? ordinal(thPos) + ' · ' : ''}${opp.manager ? 'Mgr: ' + esc(opp.manager) : ''}</small></div></div>`;
        if (typeof us === 'number' && typeof th === 'number') {
          html += `<div class="bars"><span>Strength</span>${bar(us)}<span class="n">${us}</span><span>${esc(shortTeam(opp.team).slice(0, 10))}</span>${bar(th, 'o')}<span class="n">${th}</span><span>Morale</span>${bar(mor * mx / 100)}<span class="n">${mor}</span></div>`;
        }
        if (pm.odds && pm.odds.usOdds) {
          html += `<div class="odds"><div>${esc(club)} win<b>${Number(pm.odds.usOdds).toFixed(2)}</b></div><div>${esc(shortTeam(opp.team))} win<b>${Number(pm.odds.themOdds).toFixed(2)}</b></div></div>`;
        }
        if (pm.bet && pm.bet.stake) html += `<div class="k-betnote">Bet placed: ${money(pm.bet.stake)} on ${esc(pm.bet.outcome)} @ ${esc(pm.bet.odds)}</div>`;
        const body = $('kBriefBody'); if (body && body.innerHTML !== html) body.innerHTML = html;
      }
    }
    if (league) {
      league.hidden = rows.length < 3;
      const i = Math.max(0, rows.findIndex(r => r.us));
      const lo = Math.max(0, Math.min(i - 2, rows.length - 5));
      const html = rows.slice(lo, lo + 5).map((r, k) => `<tr class="${r.us ? 'us' : ''}"><td>${lo + k + 1}</td><td>${esc(shortTeam(r.team))}</td><td>${r.P}</td><td>${r.GD > 0 ? '+' : ''}${r.GD}</td><td>${r.PTS}</td></tr>`).join('');
      const t = $('kLeagueTable');
      const full = `<thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead><tbody>${html}</tbody>`;
      if (t && t.innerHTML !== full) t.innerHTML = full;
    }
  }

  // ---------- decision card ----------
  const VARIANT_CHIP = { bad: 'RISK', warn: 'CAUTION', sensual: '♥', sex: '♥' };
  function setPrompt(prompt) {
    const el = $('kPrompt'); if (!el) return;
    const txt = String(prompt || '').replace(/<[^>]+>/g, '').trim();
    el.textContent = txt && txt.length <= 90 ? txt : (txt ? txt.slice(0, 88) + '…' : 'What now, Chairman?');
    el.title = txt;
    sceneFromPrompt(txt);
    openSheet();
  }
  function decorate(btn) {
    if (btn.dataset.kDeco || btn.closest('.k-sys')) return;
    btn.dataset.kDeco = '1';
    btn.classList.add('opt');
    const raw = (btn.textContent || '').trim();
    let label = raw, chip = '';
    if (/\(done\)\s*$/i.test(raw) || /^\[✓\]/.test(raw) && false) { label = raw.replace(/\s*\(done\)\s*$/i, ''); btn.classList.add('done'); chip = '✓ DONE'; }
    if (/knock at the door|answer the door/i.test(raw) && !btn.classList.contains('done')) { btn.classList.add('req'); chip = 'REQUIRED'; }
    if (/^(⚽\s*)?(kick ?off|proceed to kick ?off)\b/i.test(raw) || /^kickoff$/i.test(raw)) btn.classList.add('go');
    if (!chip) for (const v of Object.keys(VARIANT_CHIP)) if (btn.classList.contains(v)) { chip = VARIANT_CHIP[v]; break; }
    // keep the original text node(s): only wrap them, so later textContent reads still contain the label
    if (btn.children.length === 0) {
      btn.textContent = '';
      const k = document.createElement('kbd'); k.setAttribute('aria-hidden', 'true');
      const sp = document.createElement('span'); sp.className = 'lbl'; sp.textContent = label;
      playerCard(sp, label, btn);
      btn.append(k, sp);
      if (chip) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = chip; btn.appendChild(c); }
    } else {
      btn.classList.add('rich');
    }
  }
  // transfer market / sell lists: "Name (MF) | TIER | RAT 74 | £5,320,000 | £57,200/wk" -> a player row
  const PLAYER_RE = /^(Sell )?(.+?) \((GK|DF|MF|FW)\)(?: \| ([A-Z]+))? \| RAT (\d+) \| (£[\d,]+)(?: \| (£[\d,]+)\/wk)?$/;
  function playerCard(sp, label, btn) {
    const m = PLAYER_RE.exec(label); if (!m) return;
    const [, sell, name, pos, tier, rat, price, wage] = m;
    const short = v => money(Number(String(v).replace(/[£,]/g, '')));
    btn.classList.add('k-player');
    sp.innerHTML = `<b>${sell ? 'Sell ' : ''}${esc(name)}</b> <i class="pos">${pos}</i><span class="meta">${tier ? `<em class="tier t-${tier.toLowerCase()}">${esc(tier)}</em>` : ''}<span>RAT <b>${rat}</b></span><span>${short(price)}</span>${wage ? `<span>${short(wage)}/wk</span>` : ''}</span>`;
    sp.title = label;
  }
  function numberChoices() {
    const root = $('actions'); if (!root) return;
    let n = 0;
    root.querySelectorAll('button').forEach(b => {
      if (!b.classList.contains('opt')) return;
      const k = b.querySelector(':scope > kbd'); const vis = b.offsetParent !== null;
      if (k) { const t = vis && n < 10 ? String(++n % 10) : '·'; if (k.textContent !== t) k.textContent = t; }
    });
    const hint = $('kHint'); if (hint) hint.textContent = n > 9 ? 'press 1–9, 0' : n > 1 ? `press 1–${n}` : n === 1 ? 'press 1' : '';
    const dec = $('kDecision'); if (dec) dec.classList.toggle('empty', !root.querySelector('button, input, select, a'));
  }
  let numberQueued = false;
  function scanActions() {
    const root = $('actions'); if (!root) return;
    if (root.querySelector('button:not([data-k-deco])')) openSheet(); // new choices arrived
    root.querySelectorAll('button').forEach(decorate);
    if (!numberQueued) { numberQueued = true; requestAnimationFrame(() => { numberQueued = false; numberChoices(); }); }
  }
  function afterChoices() { scanActions(); }

  // keys 1–9 (and 0 for the 10th) press the nth visible decision button (only when it is actually on top)
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'Escape') { if (closeTopPane() || closeTopLegacy()) { e.preventDefault(); } return; }
    if (!/^[0-9]$/.test(e.key)) return;
    const root = $('actions'); if (!root) return;
    const btns = [...root.querySelectorAll('button.opt')].filter(b => b.offsetParent !== null && !b.disabled);
    const b = btns[e.key === '0' ? 9 : +e.key - 1]; if (!b) return;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) b.scrollIntoView({ block: 'nearest' });
    const r2 = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
    if (hit && (hit === b || b.contains(hit))) { e.preventDefault(); touchedAt = Date.now(); b.click(); }
  });

  // ---------- panes (inventory/doctor/stadium/power/fixtures) become sheets ----------
  const PANES = ['inventoryPane', 'doctorPane', 'stadiumPane', 'powerNetworkPane', 'fixturesPane'];
  function closeTopPane() {
    for (const id of PANES) {
      const p = $(id);
      if (p && p.isConnected && getComputedStyle(p).display !== 'none') {
        const btn = [...p.querySelectorAll('button')].find(b => /^([✕×x]\s*)?close$|^[✕×x]$/i.test(b.textContent.trim()));
        if (btn) btn.click(); else p.style.display = 'none';
        return true;
      }
    }
    return false;
  }

  // ---------- legacy overlays: Esc closes (via their own close button), Tab stays inside ----------
  function topLegacyLayer() {
    let best = null, bestZ = -1;
    for (const el of document.body.children) {
      if (el.id === 'kApp' || el.id === 'kMoreSheet' || el.id === 'kLegacy' || /\bk-(toasts|vfail|modal-wrap|cut)\b/.test(el.className || '')) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width < innerWidth * 0.5 || r.height < innerHeight * 0.5) continue;
      const z = parseInt(cs.zIndex, 10) || 0;
      if (z >= bestZ) { best = el; bestZ = z; }
    }
    return best;
  }
  function closeTopLegacy() {
    if (document.querySelector('.k-modal-wrap')) return false;      // KUI handles its own
    const layer = topLegacyLayer(); if (!layer) return false;
    const btn = [...layer.querySelectorAll('button')].find(b => b.offsetParent !== null && /^([✕×x]\s*)?(close|cancel|close window)?$/i.test(b.textContent.trim()) && b.textContent.trim());
    if (btn) { btn.click(); return true; }
    return false;
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || document.querySelector('.k-modal-wrap')) return;
    const layer = topLegacyLayer(); if (!layer) return;
    const f = [...layer.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (i < 0) { e.preventDefault(); f[0].focus(); }
    else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }, true);

  // ---------- navigation ----------
  const click = id => { const b = $(id); if (b) b.click(); };
  function finBooksHtml(s) {
    const books = s.fin_last;
    const rows = books && books.items && books.items.length
      ? books.items.map(i => `<tr><td>${esc(i.label)}${i.debt ? ' <small>(added to debt)</small>' : ''}</td><td class="${i.debt || i.amount < 0 ? 'neg' : 'pos'}">${i.debt ? '+' + fmtFull(i.amount) : (i.amount < 0 ? '−' : '+') + fmtFull(Math.abs(i.amount))}</td></tr>`).join('')
      : `<tr><td colspan="2" class="mut">No matchday played yet.</td></tr>`;
    const ws = s.fin_season && s.fin_season.season === (s.season | 0) ? (s.fin_season.items["Women's team"] || 0) : 0;
    return `<h4>Last matchday${books ? ` · S${books.season} MD${books.match}` : ''}</h4><table class="k-fin-books">${rows}</table>`
      + (ws ? `<p class="k-fin-note">Women's team expenses this season: <b class="bad">${fmtFull(Math.abs(ws))}</b></p>` : '');
  }
  function finLadderHtml() {
    const d = typeof window.debtDanger === 'function' ? window.debtDanger() : null;
    if (!d) return '';
    const s = St() || {};
    const steps = d.rungs.slice(1).map((r, i) => {
      const n = i + 1;
      const cls = d.stage > n ? 'past' : d.stage === n ? 'on' : d.net >= r.at ? 'due' : '';
      return `<li class="${cls}"><b>${esc(r.name)}</b><span>${money(r.at)}+</span></li>`;
    }).join('');
    const hist = s.insolvency && s.insolvency.log && s.insolvency.log.length
      ? `<ul class="k-ladder-log">${s.insolvency.log.slice(-3).reverse().map(e => `<li>S${e.season} MD${e.match}: ${esc(e.line)}</li>`).join('')}</ul>` : '';
    return `<h4>Debt danger</h4><div class="k-danger-meter" data-tone="${d.stage >= 3 || d.level >= 3 ? 'bad' : d.stage || d.level ? 'warn' : 'ok'}"><i style="width:${d.pct}%"></i></div>
      <p class="k-fin-note">Net club debt <b>${fmtFull(d.net)}</b> (debt minus club cash). One rung per matchday while you're over the line; pay it down and they back off.${d.stage === 4 ? ` <b class="bad">Administration: ${Math.max(0, d.grace - d.admin_matches)} matchday(s) to fix it.</b>` : ''}</p>
      <ol class="k-ladder">${steps}<li class="${d.stage === 4 && d.admin_matches >= d.grace ? 'on' : ''}"><b>Liquidation</b><span>+${d.grace} matchdays</span></li></ol>${hist}`;
  }
  async function finances() {
    const s = St() || {};
    const dc = (typeof s.club_debt === 'number') ? s.club_debt : (s.debt_club | 0);
    const dp = (typeof s.debt_personal === 'number') ? s.debt_personal : (s.personal_debt | 0);
    const v = await KUI.modal({ title: 'Finances', portrait: 'secretary', wide: true,
      html: `<div class="k-fin"><div><span>Club cash</span><b>${fmtFull(s.club_cash)}</b></div><div><span>Your cash</span><b>${fmtFull(s.chairman_cash)}</b></div><div><span>Club debt</span><b class="${dc > 0 ? 'bad' : ''}">${fmtFull(dc)}</b></div><div><span>Personal debt</span><b class="${dp > 0 ? 'bad' : ''}">${fmtFull(dp)}</b></div></div>`
        + `<div class="k-fin-cols"><section>${finBooksHtml(s)}</section><section>${finLadderHtml()}</section></div>`,
      actions: [{ id: 'move', label: '⇄ Move cash', variant: 'primary' }, { id: 'debt', label: 'Pay off debt', disabled: dc + dp <= 0 }, { id: 'close', label: 'Close' }] });
    if (v === 'move') { if (typeof openCashTransferModal === 'function') openCashTransferModal(); else click('transferCashBtn'); }
    if (v === 'debt' && typeof openDebtPaymentModal === 'function') openDebtPaymentModal();
  }
  const fmtFull = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-£' : '£') + Math.abs(v).toLocaleString('en-GB'); };
  const NAV = {
    matchday: () => { closeMore(); while (closeTopPane()); const f = $('dialoguePanel'); if (f) f.scrollTo({ top: f.scrollHeight, behavior: 'smooth' }); openSheet(); },
    news: () => click('btnReadNews'), phone: () => click('btnUsePhone'), fixtures: () => click('openFixturesBtn'),
    stadium: () => click('openStadiumBtn'), doctor: () => click('openDoctorBtn'), finances,
    debt: () => { if (typeof openDebtPaymentModal === 'function') openDebtPaymentModal(); },
    fundraiser: () => click('fundraiserBtn'), power: () => click('openPowerNetworkBtn'), inventory: () => click('openInvBtn'),
    save: () => { click('saveBtn'); KUI.toast('Game saved', 'good'); }, load: () => click('loadBtn'), audio: () => click('musicControlBtn'),
    reset: () => click('resetBtn'), more: () => toggleMore(),
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (!b || !b.closest('#kApp, #kMoreSheet')) return;
    e.preventDefault();
    const key = b.dataset.nav;
    if (key !== 'more') closeMore();
    if (key !== 'more' && key !== 'matchday' && key !== 'save') { /* opening another view: switch off "Matchday" highlight while open */ }
    try { NAV[key] && NAV[key](); } catch (err) { console.error('nav', key, err); }
  });

  // phone: "More" sheet holds whatever the tab bar cannot fit
  const PRIMARY = ['matchday', 'news', 'phone', 'fixtures'];
  function buildMore() {
    const sheet = $('kMoreSheet'); if (!sheet) return;
    const items = [...document.querySelectorAll('#kRail .k-nav')].filter(b => !PRIMARY.includes(b.dataset.nav) && b.dataset.nav !== 'more');
    sheet.innerHTML = `<div class="k-more-scrim" data-close></div><div class="k-more-box" role="dialog" aria-label="More"><h4>More</h4><div class="k-more-grid">${items.map(b => b.outerHTML).join('')}</div><div class="k-more-sys"><button data-nav="save">Save</button><button data-nav="load">Load</button><button data-nav="audio">Audio</button><button data-nav="reset">Start over</button></div></div>`;
    sheet.querySelector('[data-close]').onclick = closeMore;
    bindArt(sheet);
  }
  function toggleMore() { const s = $('kMoreSheet'); if (!s) return; if (s.hidden) { buildMore(); s.hidden = false; } else closeMore(); }
  function closeMore() { const s = $('kMoreSheet'); if (s) s.hidden = true; }
  function syncMoreBadge() {
    const more = document.querySelector('#kRail .k-more'); if (!more) return;
    let dot = more.querySelector('.k-badge');
    const any = false; if (!dot) { dot = document.createElement('i'); dot.className = 'k-badge'; dot.hidden = true; dot.textContent = '!'; more.appendChild(dot); }
    dot.hidden = !any;
  }

  // phone: decision sheet can be collapsed to read the feed. It drops to a peek bar on its own
  // while narrative keeps arriving under an open menu, and springs back when new choices arrive.
  let choicesAt = 0, touchedAt = 0;
  function openSheet() { const d = $('kDecision'); if (d) d.classList.remove('collapsed'); choicesAt = Date.now(); }
  document.addEventListener('click', e => {
    const peek = e.target.closest('#kDecision.collapsed h3');
    if (peek && !e.target.closest('#kSheetToggle')) { openSheet(); touchedAt = Date.now(); return; }
    const t = e.target.closest('#kSheetToggle'); if (!t) return;
    const d = $('kDecision'); if (d) d.classList.toggle('collapsed');
    touchedAt = Date.now();
  });
  document.addEventListener('pointerdown', e => { if (e.target.closest('#kDecision')) touchedAt = Date.now(); }, true);
  const phone = () => matchMedia('(max-width: 900px)').matches;
  GameHooks.on('log', () => {
    if (!phone()) return;
    const d = $('kDecision'), root = $('actions'); if (!d || !root || !root.querySelector('button.opt')) return;
    const now = Date.now();
    if (now - choicesAt < 700 || now - touchedAt < 1500) return; // the player's own click, or the menu just drew
    d.classList.add('collapsed');
  });
  // phone: the top strip is one compact row; the chevron shows every stat
  document.addEventListener('click', e => {
    const t = e.target.closest('#kTopToggle'); if (!t) return;
    const top = $('kTop'); if (!top) return;
    const on = top.classList.toggle('expanded');
    t.setAttribute('aria-expanded', on ? 'true' : 'false');
  });

  // ---------- wire up ----------
  function init() {
    bindArt();
    const actions = $('actions');
    if (actions) new MutationObserver(scanActions).observe(actions, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'disabled'] });
    scanActions();
    setPhaseView(window.__ui_context || 'boot');
    renderTop();
  }
  // feed: only the newest "View Full Table" button stays (one per league-position line piled up)
  let tableBtnQueued = false;
  function dedupeTableButtons() {
    tableBtnQueued = false;
    const feed = $('feed'); if (!feed) return;
    const btns = [...feed.querySelectorAll('button[onclick*="LeagueTablePopup"]')];
    btns.forEach((b, i) => {
      if (i < btns.length - 1) { b.remove(); return; }
      if (!b.classList.contains('k-tablebtn')) { b.removeAttribute('style'); b.classList.add('k-tablebtn'); }
    });
  }
  GameHooks.on('log', () => { if (!tableBtnQueued) { tableBtnQueued = true; requestAnimationFrame(dedupeTableButtons); } });
  GameHooks.on('hud', renderTop);
  GameHooks.on('phase', p => { setPhaseView(p); renderTop(); });
  GameHooks.on('init', () => { window.__kLastDay = null; renderTop(); setPhaseView((St() && St().phase) || 'boot'); });
  GameHooks.on('choices', () => scanActions());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.KShell = { dayLabel, gameDate, setPrompt, afterChoices, setScene, setPhaseView, renderTop, money, leagueRows, currentOpp, bindArt };
})();
