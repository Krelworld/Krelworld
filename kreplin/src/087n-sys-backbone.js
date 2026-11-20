/* ===================== KREPLIN deeper systems: BACKBONE =====================
   Evidence -> Leak -> Lead -> Consequence (docs/systems-design.md, appendix A–D).
   Every dirty act can leave EVIDENCE (S.evidence[]). Evidence can LEAK onto a journalist's
   desk as a LEAD (S.leads[]), which develops once per matchday and PUBLISHES at 100% unless it
   is killed or buried. FAVOURS (S.favours[]) are IOUs in both directions; DIRT (S.dirt[]) is
   what you have on other people.

   Public API (texting/Tinder phases call these):
     addEvidence({kind, label, weight, witness, tags, target, leaked, noLeak, forceLeak}) -> item
     leakCheck(item, {force, bonus})          -> lead|null   (rolls; attaches or opens a lead)
     advanceLeads()                           (matchday:end)
     publishLead(lead)                        (runs the story + consequences)
     KSys.addFavour(who, dir, origin, {label, dueIn, count}) / KSys.useFavour(id)
     KSys.addDirt(on, label, weight) / KSys.pick(poolKey, pool)  (no-repeat line picker)
     KSys.tick()  global matchday counter (never resets between seasons)
   Caps: max 3 active leads, 1 publication per matchday, 1 new lead per matchday tick. */

const SYS_STAGE_NAMES = ['rumour', 'a source', 'corroborated', 'going to print'];
const SYS_MAX_LEADS = 3;

// Defaults + one-off migration of older saves. Called from normalizeGameState() and lazily.
function ensureSystemsState(st) {
  const s = st || window.S;
  if (!s || typeof s !== 'object') return s;
  // legacy S.evidence was an object map {playerName: "drugs"} (planted bags)
  if (s.evidence && !Array.isArray(s.evidence) && typeof s.evidence === 'object') {
    const old = s.evidence; s.evidence = [];
    Object.keys(old).forEach((who, i) => s.evidence.push({
      id: 'ev_legacy_' + i, kind: 'planted', label: `Bag of cocaine planted in ${who}'s locker`, weight: 8,
      week: s.matches_played | 0, season: s.season | 0, tick: 0, witness: null, target: who,
      tags: ['drugs', 'planted'], leaked: false }));
  }
  if (!Array.isArray(s.evidence)) s.evidence = [];
  if (!Array.isArray(s.leads)) s.leads = [];
  if (!Array.isArray(s.favours)) s.favours = [];
  if (!Array.isArray(s.dirt)) s.dirt = [];
  if (!s.lineMemory || typeof s.lineMemory !== 'object') s.lineMemory = {};
  if (typeof s.fa_heat !== 'number' || !isFinite(s.fa_heat)) s.fa_heat = 0;
  const d = s.drugs && typeof s.drugs === 'object' ? s.drugs : (s.drugs = {});
  const dDef = { tolerance: Math.min(60, (s.drug_streak | 0) * 10), addiction: 0, debt: 0, debtWeeks: 0, lastUse: -1,
    usedThisMatch: false, fa_level: 0, lastTest: -99, lastCollect: -99, credit: 0 };
  for (const k in dDef) if (typeof d[k] !== 'number' || !isFinite(d[k])) d[k] = typeof d[k] === 'boolean' ? d[k] : dDef[k];
  if (typeof d.usedThisMatch !== 'boolean') d.usedThisMatch = false;
  d.state = s.coke_state || d.state || 'sober';
  const y = s.sys && typeof s.sys === 'object' ? s.sys : (s.sys = {});
  const yDef = { tick: 0, pubTick: -1, newLeadTick: -1, eventsTick: -1, favourCallTick: -99, surveillanceUntil: -1,
    blackmailKit: false, delmorRevengeAt: -1, nextId: 1, publishedThisTick: [] };
  for (const k in yDef) if (y[k] === undefined) y[k] = Array.isArray(yDef[k]) ? [] : yDef[k];
  // flag the Tinder phase reads: matches' hidden agendas are visible while Surveillance runs
  if (!s.surveillance || typeof s.surveillance !== 'object') s.surveillance = { active: false, until: -1, tinderReveal: false };
  s.systems_v = 1;
  return s;
}

function sysNextId(prefix) {
  ensureSystemsState();
  return `${prefix}_${S.sys.tick}_${S.sys.nextId++}`;
}

// Evidence: any dirty act. Returns the stored item (and may open/feed a lead).
function addEvidence(o) {
  try {
    if (!window.S) return null;
    ensureSystemsState();
    o = o || {};
    const item = {
      id: sysNextId('ev'), kind: o.kind || 'misc', label: String(o.label || 'Something grubby'),
      weight: Math.max(1, Math.min(30, Math.round(o.weight || 8))),
      week: (S.matches_played | 0) + 1, season: S.season | 0, tick: S.sys.tick,
      witness: o.witness || null, witnessLabel: o.witnessLabel || null, target: o.target || null,
      tags: Array.isArray(o.tags) && o.tags.length ? o.tags.slice(0, 4) : [KSys.themeOfKind(o.kind)],
      leaked: !!o.leaked
    };
    S.evidence.push(item);
    // keep the file manageable: drop the oldest already-leaked items first
    if (S.evidence.length > 80) {
      const i = S.evidence.findIndex(e => e.leaked);
      S.evidence.splice(i >= 0 ? i : 0, 1);
    }
    if (item.leaked) KSys.feedTheme(item.tags[0], item.weight / 2); // already public: speeds up any lead on it
    else if (!o.noLeak) leakCheck(item, { force: !!o.forceLeak, bonus: o.leakBonus || 0 });
    return item;
  } catch (e) { console.error('addEvidence', e); return null; }
}

// Does this piece of evidence reach a journalist? Attaches to a lead on the same theme or opens one.
function leakCheck(item, opt) {
  if (!item || item.leaked || !window.S) return null;
  ensureSystemsState();
  opt = opt || {};
  let p = item.weight / 100 + (S.paperRisk | 0) / 500 + (opt.bonus || 0);
  if (item.witness === 'bookie_marco' && (S.drugs.debtWeeks | 0) >= 3) p += 0.25;
  if (item.kind === 'favour_refused') p += 0.4;
  if (S.coke_state === 'wired') p += 0.05;
  if (!opt.force && Math.random() >= Math.min(0.9, p)) return null;
  const theme = item.tags[0] || 'misc';
  const active = KSys.activeLeads();
  let lead = active.find(l => l.theme === theme);
  if (lead) {
    lead.evidenceIds.push(item.id);
    lead.pendingWeight = (lead.pendingWeight | 0) + item.weight;
    item.leaked = true;
    return lead;
  }
  if (active.length >= SYS_MAX_LEADS || (S.sys.newLeadTick === S.sys.tick && !opt.force)) {
    // desks are full: it lands on the newest open story as colour
    const newest = active[active.length - 1];
    if (newest) { newest.evidenceIds.push(item.id); newest.pendingWeight = (newest.pendingWeight | 0) + Math.round(item.weight / 2); item.leaked = true; }
    return newest || null;
  }
  item.leaked = true;
  return KSys.createLead(theme, [item], item.witness, item.witnessLabel);
}

// Once per matchday: leads develop; the ripest one publishes (one per matchday).
function advanceLeads() {
  if (!window.S) return;
  ensureSystemsState();
  const t = S.sys.tick;
  for (const lead of KSys.activeLeads()) {
    if (lead.frozenUntil && lead.frozenUntil > t) continue;
    const before = lead.stage;
    const gain = 15 + Math.floor(Math.random() * 21) + (lead.pendingWeight | 0);
    lead.pendingWeight = 0;
    lead.progress = Math.min(100, (lead.progress | 0) + gain);
    lead.stage = Math.min(3, Math.floor(lead.progress / 25));
    if (lead.progress >= 100) {
      if (S.sys.pubTick !== t) { publishLead(lead); continue; }
      lead.progress = 99; lead.stage = 3; // one front page per matchday: it waits
    }
    lead.runsIn = Math.max(1, Math.ceil((100 - lead.progress) / 25));
    if (lead.stage !== before) KSys.leadCard && KSys.leadCard(lead, 'stage');
  }
  // old evidence still floats about and can surface later
  if (S.sys.newLeadTick !== t) {
    const stale = S.evidence.filter(e => !e.leaked && t - (e.tick | 0) <= 10 && t - (e.tick | 0) >= 1);
    for (const e of stale) {
      if (Math.random() < e.weight / 250) { leakCheck(e, { force: true }); break; }
    }
  }
}

// Run a lead: the story goes out through the press system, then the consequences land.
function publishLead(lead) {
  if (!lead || lead.status !== 'active' || !window.S) return null;
  ensureSystemsState();
  if (typeof initPressSystem === 'function') initPressSystem();
  lead.status = 'published'; lead.published = true; lead.progress = 100; lead.stage = 3; lead.runsIn = 0;
  lead.publishedTick = S.sys.tick;
  S.sys.pubTick = S.sys.tick;
  const C = KSys.content || {};
  const weight = KSys.leadWeight(lead);
  const big = weight >= 40;
  const fx = KSys.consequencesFor(lead, weight);
  const headline = lead.headline || 'CHAIRMAN IN NEW SHAME';
  const body = (C.body ? C.body(lead) : headline) + (fx.sponsorLine ? '\n' + fx.sponsorLine : '');
  let story = null;
  try {
    const flags = ['lead', lead.theme];
    if (lead.theme === 'sex' && KSys.married()) flags.push('affair'); // the existing wife confrontation
    story = createStory('gossip', headline, body, {}, fx.effects, 'lead', big ? 3 : 2, flags);
    story.writer = `${lead.journalist} (${lead.outlet})`;
    story.leadId = lead.id;
    publishStory(story);
    S.news_unread = true;
  } catch (e) { console.error('publishLead story', e); }
  lead.storyId = story && story.id;
  // FA/police: heat only (owner decision 2). Big stories ask the existing routing to look.
  if (big) S.sys.publishedThisTick.push({ id: lead.id, authority: KSys.authorityFor(lead.theme), caseType: KSys.caseTypeFor(lead.theme) });
  // the evidence behind it is now public
  lead.evidenceIds.forEach(id => { const e = S.evidence.find(x => x.id === id); if (e) e.leaked = true; });
  try {
    log(`📰 HEADLINE (${lead.outlet}): <b>${headline}</b>`);
    if (fx.summary) logSafe(fx.summary);
  } catch (_) {}
  try { window.KUI && KUI.toast(`📰 ${lead.outlet} ran it: ${headline}`, 'bad', 5000); } catch (_) {}
  try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
  return story;
}

// The namespace the other system files extend.
const KSys = window.KSys = window.KSys || {};
(function () {
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  KSys.rint = rint;
  KSys.tick = () => { ensureSystemsState(); return S.sys.tick; };
  KSys.chair = () => (window.S && (S.full_name || S.player_surname)) || 'the chairman';
  KSys.surname = () => (window.S && (S.player_surname || (S.full_name || '').split(' ').slice(-1)[0])) || 'KREPLIN';
  KSys.club = () => (typeof getClubName === 'function' ? getClubName() : (window.S && S.club_name) || 'Southampton FC');
  KSys.fmt = n => (typeof money === 'function' ? money(n) : '£' + Math.round(n));
  KSys.short = n => (window.KShell && KShell.money ? KShell.money(n) : KSys.fmt(n));
  KSys.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  KSys.fill = (tpl, extra) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
    const v = { chair: KSys.surname().toUpperCase(), Chair: KSys.surname(), club: KSys.club(), wife: (S && S.wife_name) || 'his wife',
      sec: (S && S.secretary_name) || 'his secretary', opp: KSys.oppTeam(), ...(extra || {}) }[k];
    return v == null ? m : v;
  });
  KSys.oppTeam = () => { try { const o = typeof currentOpponent === 'function' ? currentOpponent() : null; return (o && o.team) || 'the opposition'; } catch (_) { return 'the opposition'; } };

  // No-repeat line picker: remembers the last min(8, n-1) picks per pool (S.lineMemory).
  KSys.pick = function (key, pool) {
    if (!Array.isArray(pool) || !pool.length) return '';
    if (pool.length === 1 || !window.S) return pool[0];
    ensureSystemsState();
    const win = Math.min(8, pool.length - 1);
    const mem = Array.isArray(S.lineMemory[key]) ? S.lineMemory[key] : (S.lineMemory[key] = []);
    const free = pool.map((_, i) => i).filter(i => !mem.includes(i));
    const i = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * pool.length);
    mem.push(i); while (mem.length > win) mem.shift();
    return pool[i];
  };

  // ---- themes ----
  const KIND_THEME = { coke: 'drugs', planted: 'drugs', drugs: 'drugs', steroid: 'doping', doping: 'doping', bribe: 'corruption',
    favour_refused: 'corruption', corruption: 'corruption', text: 'sex', sext: 'sex', tinder: 'sex', affair: 'sex',
    threat: 'violence', violence: 'violence', paper: 'corruption', debt: 'money', side_effect: 'drugs', deranged: 'violence' };
  KSys.themeOfKind = k => KIND_THEME[k] || 'misc';
  KSys.themeOfText = t => {
    t = String(t || '').toLowerCase();
    if (/coke|cocaine|drug|snort|rehab|overdose/.test(t)) return 'drugs';
    if (/hgh|steroid|doping|drug test/.test(t)) return 'doping';
    if (/affair|sex|std|intimate|mistress|homosexual|tinder/.test(t)) return 'sex';
    if (/attack|assault|brick|violen|threat/.test(t)) return 'violence';
    if (/debt|arrears|expenditure|sponsor|money/.test(t)) return 'money';
    return 'corruption';
  };
  KSys.activeLeads = () => (window.S && Array.isArray(S.leads) ? S.leads.filter(l => l.status === 'active') : []);
  KSys.leadWeight = lead => lead.evidenceIds.reduce((a, id) => { const e = S.evidence.find(x => x.id === id); return a + (e ? e.weight : 4); }, 0) + (lead.extraWeight | 0);
  KSys.feedTheme = (theme, w) => { const l = KSys.activeLeads().find(x => x.theme === theme); if (l) l.pendingWeight = (l.pendingWeight | 0) + Math.round(w); };
  KSys.authorityFor = th => (th === 'doping' ? 'fa' : th === 'corruption' ? 'fa' : th === 'drugs' || th === 'violence' ? 'police' : 'board');
  KSys.caseTypeFor = th => ({ doping: 'misconduct', corruption: 'bribery', drugs: 'misconduct', violence: 'misconduct', money: 'irregularities', sex: 'reputation' }[th] || 'irregularities');

  KSys.createLead = function (theme, items, witness, witnessLabel) {
    ensureSystemsState();
    const C = KSys.content || {};
    const j = C.journalist ? C.journalist(theme) : { name: 'A Hack', outlet: 'The Paper' };
    const lead = {
      id: sysNextId('lead'), evidenceIds: items.map(i => i.id), journalist: j.name, outlet: j.outlet, theme,
      stage: 0, progress: rint(5, 15), runsIn: 4, status: 'active', killed: false, buried: false, published: false,
      created: S.sys.tick, season: S.season | 0, source: witness || null,
      sourceLabel: witnessLabel || (C.sourceLabel ? C.sourceLabel(witness, theme) : 'a source close to the club'),
      headline: C.headline ? C.headline(theme, items[0]) : 'CHAIRMAN SHAME', pendingWeight: 0
    };
    S.leads.push(lead);
    S.sys.newLeadTick = S.sys.tick;
    S.news_unread = true;
    if (S.leads.length > 30) { const i = S.leads.findIndex(l => l.status !== 'active'); if (i >= 0) S.leads.splice(i, 1); }
    try { KSys.leadCard && KSys.leadCard(lead, 'new'); } catch (e) { console.error(e); }
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
    return lead;
  };

  // Consequences of a published lead, scaled by the evidence weight behind it.
  KSys.consequencesFor = function (lead, w) {
    const C = KSys.content || {};
    const big = w >= 40, mid = w >= 20;
    const fx = { reputation: -(big ? rint(10, 15) : mid ? rint(6, 9) : rint(3, 5)), board: -(big ? rint(8, 14) : mid ? rint(4, 7) : 2) };
    const lines = [];
    if (mid) {
      const loss = big ? rint(8, 15) * 100000 : rint(2, 6) * 100000;
      fx.sponsor = -loss;
      fx.sponsorLine = C.sponsorLine ? C.sponsorLine(loss) : `A sponsor pulls out (−${KSys.short(loss)}).`;
      lines.push(fx.sponsorLine);
    }
    if (KSys.married() && (lead.theme === 'sex' || lead.theme === 'drugs' || big)) {
      fx.marital_risk = big ? 12 : 6; fx.maritalRisk = -(big ? 10 : 5);
      if (C.marriageLine) lines.push(C.marriageLine(lead.theme));
    }
    const heat = big ? 10 : mid ? 6 : 3;
    if (lead.theme === 'doping') fx.fa_heat = heat * 2;
    if (lead.theme === 'drugs' || lead.theme === 'violence') fx.police_risk = heat;
    if (lead.theme === 'corruption' || lead.theme === 'money') fx.compliance_risk = heat;
    fx.legalRisk = Math.round(heat / 2);
    const { sponsorLine, ...effects } = fx;
    return { effects, sponsorLine, summary: lines.length ? lines.join(' ') : null };
  };

  // ---- kill / bury ----
  KSys.endLead = function (lead, how, note) {
    lead.status = how; lead[how] = true; lead.endedTick = S.sys.tick; lead.note = note || null;
    lead.evidenceIds.forEach(id => { const e = S.evidence.find(x => x.id === id); if (e) e.spiked = how; });
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
  };

  // ---- money ----
  // personal cash first, then the club (off the books). Returns 'o' | 'c' | null.
  KSys.pay = function (amount) {
    amount = Math.max(0, Math.round(amount));
    if ((S.chairman_cash || 0) >= amount) { S.chairman_cash -= amount; return 'o'; }
    if ((S.club_cash || 0) >= amount) { S.club_cash -= amount; S.offbooks = (S.offbooks || 0) + amount; return 'c'; }
    return null;
  };

  // ---- favours (IOUs) ----
  KSys.addFavour = function (who, dir, origin, o) {
    ensureSystemsState(); o = o || {};
    const key = String(who).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    let f = S.favours.find(x => x.who === key && x.dir === dir);
    if (!f) { f = { id: sysNextId('fav'), who: key, label: o.label || who, dir, count: 0, origin: origin || '', dueBy: null, created: S.sys.tick, kind: o.kind || null }; S.favours.push(f); }
    f.count += Math.max(1, o.count | 0 || 1);
    f.origin = origin || f.origin;
    if (dir === 'i_owe') f.dueBy = S.sys.tick + (o.dueIn != null ? o.dueIn : rint(2, 5));
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
    return f;
  };
  KSys.useFavour = function (id) {
    const i = S.favours.findIndex(f => f.id === id); if (i < 0) return null;
    const f = S.favours[i]; f.count--; if (f.count <= 0) S.favours.splice(i, 1);
    return f;
  };
  KSys.owedToMe = () => (window.S && Array.isArray(S.favours) ? S.favours.filter(f => f.dir === 'owed_to_me' && f.count > 0) : []);
  KSys.iOwe = () => (window.S && Array.isArray(S.favours) ? S.favours.filter(f => f.dir === 'i_owe' && f.count > 0) : []);

  // ---- dirt ----
  KSys.addDirt = function (on, label, weight, onLabel) {
    ensureSystemsState();
    const d = { id: sysNextId('dirt'), on, onLabel: onLabel || on, label, weight: weight || 15, used: false, tick: S.sys.tick };
    S.dirt.push(d);
    if (S.dirt.length > 20) { const i = S.dirt.findIndex(x => x.used); S.dirt.splice(i >= 0 ? i : 0, 1); }
    return d;
  };
  KSys.freeDirt = on => (window.S && Array.isArray(S.dirt) ? S.dirt.filter(d => !d.used && (!on || d.on === on)) : []);

  // seasons 1–3: from the season 4 opener she lives at Delmor's
  KSys.married = () => !!(window.S && S.married !== false && (S.season | 0) < 4);
  KSys.surveillanceOn = () => !!(window.S && S.sys && S.sys.surveillanceUntil >= S.sys.tick);

  // one-line summary for the autoplay --dump / runaway checks
  KSys.summary = function () {
    if (!window.S) return null;
    ensureSystemsState();
    const L = S.leads;
    const pubsPerTick = {};
    L.filter(l => l.published).forEach(l => { pubsPerTick[l.publishedTick] = (pubsPerTick[l.publishedTick] || 0) + 1; });
    return { evidence: S.evidence.length, leadsActive: KSys.activeLeads().length, published: L.filter(l => l.published).length,
      killed: L.filter(l => l.killed).length, buried: L.filter(l => l.buried).length,
      maxPubsOneMatch: Math.max(0, ...Object.values(pubsPerTick)),
      owed: KSys.owedToMe().reduce((a, f) => a + f.count, 0), owing: KSys.iOwe().reduce((a, f) => a + f.count, 0),
      dirt: KSys.freeDirt().length, tol: S.drugs.tolerance | 0, add: S.drugs.addiction | 0, debt: S.drugs.debt | 0,
      fa_heat: S.fa_heat | 0, fa_level: S.drugs.fa_level | 0, tick: S.sys.tick, v: S.systems_v };
  };

  // ---- cadence ----
  GameHooks.on('init', () => { try { ensureSystemsState(); } catch (e) { console.error(e); } });
  GameHooks.on('matchday:end', function () {
    if (!window.S) return;
    ensureSystemsState();
    S.sys.tick++;
    S.sys.publishedThisTick = [];
    try { advanceLeads(); } catch (e) { console.error('advanceLeads', e); }
    // FA heat cools
    S.fa_heat = Math.max(0, (S.fa_heat | 0) - 3);
  });
  // published big stories: the existing oversight routing gets a nudge (heat only, cooldown respected)
  GameHooks.on('oversight', function () {
    if (!window.S || !S.sys) return;
    const q = S.sys.publishedThisTick || [];
    if (!q.length || (S._investigationCooldown | 0) > 0) return;
    const c = q[0];
    if (typeof window.queueInvestigationSafe === 'function') {
      window.queueInvestigationSafe(c.authority === 'police' && (S._police_investigation_cooldown | 0) > 0 ? 'fa' : c.authority, c.caseType);
      S._investigationCooldown = 2 + Math.floor(Math.random() * 2);
    }
    S.sys.publishedThisTick = [];
  });
})();
