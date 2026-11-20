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
      btn.append(k, sp);
      if (chip) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = chip; btn.appendChild(c); }
    } else {
      btn.classList.add('rich');
    }
  }
  function numberChoices() {
    const root = $('actions'); if (!root) return;
    let n = 0;
    root.querySelectorAll('button').forEach(b => {
      if (!b.classList.contains('opt')) return;
      const k = b.querySelector(':scope > kbd'); const vis = b.offsetParent !== null;
      if (k) { const t = vis && n < 9 ? String(++n) : '·'; if (k.textContent !== t) k.textContent = t; }
    });
    const hint = $('kHint'); if (hint) hint.textContent = n > 1 ? `press 1–${n}` : n === 1 ? 'press 1' : '';
    const dec = $('kDecision'); if (dec) dec.classList.toggle('empty', !root.querySelector('button, input, select, a'));
  }
  let numberQueued = false;
  function scanActions() {
    const root = $('actions'); if (!root) return;
    root.querySelectorAll('button').forEach(decorate);
    if (!numberQueued) { numberQueued = true; requestAnimationFrame(() => { numberQueued = false; numberChoices(); }); }
  }
  function afterChoices() { scanActions(); }

  // keys 1–9 press the nth visible decision button (only when it is actually on top)
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'Escape') { if (closeTopPane()) { e.preventDefault(); } return; }
    if (!/^[1-9]$/.test(e.key)) return;
    const root = $('actions'); if (!root) return;
    const btns = [...root.querySelectorAll('button.opt')].filter(b => b.offsetParent !== null && !b.disabled);
    const b = btns[+e.key - 1]; if (!b) return;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) b.scrollIntoView({ block: 'nearest' });
    const r2 = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2);
    if (hit && (hit === b || b.contains(hit))) { e.preventDefault(); b.click(); }
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

  // ---------- navigation ----------
  const click = id => { const b = $(id); if (b) b.click(); };
  async function finances() {
    const s = St() || {};
    const dc = (typeof s.club_debt === 'number') ? s.club_debt : (s.debt_club | 0);
    const dp = (typeof s.debt_personal === 'number') ? s.debt_personal : (s.personal_debt | 0);
    const v = await KUI.modal({ title: 'Finances', portrait: 'secretary',
      html: `<div class="k-fin"><div><span>Club cash</span><b>${fmtFull(s.club_cash)}</b></div><div><span>Your cash</span><b>${fmtFull(s.chairman_cash)}</b></div><div><span>Club debt</span><b class="${dc > 0 ? 'bad' : ''}">${fmtFull(dc)}</b></div><div><span>Personal debt</span><b class="${dp > 0 ? 'bad' : ''}">${fmtFull(dp)}</b></div></div>`,
      actions: [{ id: 'move', label: '⇄ Move cash', variant: 'primary' }, { id: 'debt', label: 'Pay off debt', disabled: dc + dp <= 0 }, { id: 'close', label: 'Close' }] });
    if (v === 'move') { if (typeof openCashTransferModal === 'function') openCashTransferModal(); else click('transferCashBtn'); }
    if (v === 'debt' && typeof openDebtPaymentModal === 'function') openDebtPaymentModal();
  }
  const fmtFull = n => '£' + Math.floor(Number(n) || 0).toLocaleString('en-GB');
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

  // phone: decision sheet can be collapsed to read the feed
  function openSheet() { const d = $('kDecision'); if (d) d.classList.remove('collapsed'); }
  document.addEventListener('click', e => {
    const t = e.target.closest('#kSheetToggle'); if (!t) return;
    const d = $('kDecision'); if (d) d.classList.toggle('collapsed');
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
  GameHooks.on('hud', renderTop);
  GameHooks.on('phase', p => { setPhaseView(p); renderTop(); });
  GameHooks.on('init', () => { window.__kLastDay = null; renderTop(); setPhaseView((St() && St().phase) || 'boot'); });
  GameHooks.on('choices', () => scanActions());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.KShell = { dayLabel, gameDate, setPrompt, afterChoices, setScene, setPhaseView, renderTop, money, leagueRows, currentOpp, bindArt };
})();
