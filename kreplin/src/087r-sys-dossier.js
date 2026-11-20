/* ===================== KREPLIN deeper systems: the DOSSIER =====================
   One modal (nav rail "Dossier", the Press chip in the top bar, and the Finances modal) listing
   what you know: press leads (as known: vague unless Surveillance), the evidence file, favours
   both ways, dirt, and your drug/FA situation. Buttons in it act through the same functions the
   menus use (KSys.openLead, callInFavour, blackmailWithDirt, payMarco). */
(function () {
  const K = window.KSys;
  const esc = s => K.esc(s);
  const FA_LEVEL = ['Quiet', 'Warning letter', 'Targeted testing', 'Squad-wide raids'];
  const bar = (v, tone) => `<span class="k-dbar" data-tone="${tone || ''}"><i style="width:${Math.max(0, Math.min(100, v | 0))}%"></i></span>`;

  function pressTab() {
    const leads = (S.leads || []).slice().reverse();
    const act = leads.filter(l => l.status === 'active'), done = leads.filter(l => l.status !== 'active').slice(0, 6);
    let h = `<p class="k-sub">${K.surveillanceOn() ? '🕵️ Surveillance running: exact stages and sources shown.' : 'Countdowns are tabloid gossip. Surveillance (Power Network) gets you the real stage and source.'}</p>`;
    h += act.length ? act.map(l => K.leadCardHtml(l).replace(/onclick="[^"]*"/, `data-act="lead:${l.id}"`)).join('') : '<p>No journalist is working on you. Suspicious, honestly.</p>';
    if (done.length) h += `<h4>Old stories</h4><ul class="k-dlist">${done.map(l => `<li><b>${esc(l.headline)}</b> <span class="mut">${esc(l.outlet)} · ${esc(l.status)}${l.note ? ' · ' + esc(l.note) : ''}</span></li>`).join('')}</ul>`;
    return h;
  }
  function evidenceTab() {
    const ev = (S.evidence || []).slice().reverse().slice(0, 40);
    if (!ev.length) return '<p>Your file is clean. Nobody has written anything down. Yet.</p>';
    return `<p class="k-sub">${S.evidence.length} item(s). Leaked items are with the papers; spiked ones were killed or buried.</p><table class="k-dtable"><thead><tr><th>When</th><th>What</th><th>Weight</th><th>Status</th></tr></thead><tbody>`
      + ev.map(e => `<tr class="${e.leaked ? 'leaked' : ''}"><td>S${e.season}·${e.week}</td><td>${esc(e.label)}${e.witnessLabel || e.witness ? `<small> · witness: ${esc(e.witnessLabel || e.witness)}</small>` : ''}</td><td>${e.weight}</td><td>${e.spiked ? esc(e.spiked) : e.leaked ? 'with the press' : 'in a drawer'}</td></tr>`).join('')
      + '</tbody></table>';
  }
  function favoursTab() {
    const owed = K.owedToMe(), owe = K.iOwe(), dirt = K.freeDirt(), t = S.sys.tick;
    let h = '<h4>They owe you</h4>' + (owed.length ? `<ul class="k-dlist">${owed.map(f => `<li><b>${esc(f.label)}</b> ×${f.count} <span class="mut">${esc(f.origin)}</span> <button type="button" class="k-dbtn" data-act="callin:${f.id}">Call in</button></li>`).join('')}</ul>` : '<p class="mut">Nobody. Bribe someone and they will.</p>');
    h += '<h4>You owe</h4>' + (owe.length ? `<ul class="k-dlist">${owe.map(f => `<li><b>${esc(f.label)}</b> ×${f.count} <span class="mut">${esc(f.origin)} · ${f.dueBy == null ? 'whenever' : f.dueBy <= t ? 'DUE: could ring any minute' : 'due in ' + (f.dueBy - t) + ' match(es)'}</span></li>`).join('')}</ul>` : '<p class="mut">Nobody. For now.</p>');
    h += '<h4>Dirt</h4>' + (dirt.length ? `<ul class="k-dlist">${dirt.map(d => `<li><b>${esc(d.onLabel)}</b>: ${esc(d.label)} ${S.sys.blackmailKit ? `<button type="button" class="k-dbtn" data-act="blackmail:${d.id}">Blackmail</button>` : ''}</li>`).join('')}</ul><p class="k-sub">Dirt buries stories: open a lead and choose "Bury it".${S.sys.blackmailKit ? '' : ' The Blackmail package turns dirt into favours.'}</p>` : '<p class="mut">You have nothing on anyone. Surveillance fixes that.</p>');
    return h;
  }
  function drugsTab() {
    const d = S.drugs, st = S.coke_state || 'sober';
    let h = `<div class="k-dgrid"><div><span>State</span><b class="${st === 'sober' ? '' : 'bad'}">${esc(st.toUpperCase())}</b></div>`
      + `<div><span>Tolerance</span>${bar(d.tolerance, d.tolerance > 60 ? 'bad' : 'warn')}<b>${d.tolerance | 0}</b></div>`
      + `<div><span>Addiction</span>${bar(d.addiction, d.addiction > 45 ? 'bad' : 'warn')}<b>${d.addiction | 0}</b></div>`
      + `<div><span>Bag streak</span><b>${Math.max(S.drug_streak | 0, S.coke_streak | 0)} / 4</b></div>`
      + `<div><span>Marco's tab</span><b class="${d.debt > 0 ? 'bad' : ''}">${K.fmt(d.debt | 0)}</b>${d.debt > 0 ? `<small>${d.debtWeeks} matchday(s) old · +10% a week</small>` : ''}</div>`
      + `<div><span>FA heat</span>${bar(S.fa_heat, S.fa_heat > 50 ? 'bad' : 'warn')}<b>${S.fa_heat | 0}</b></div>`
      + `<div><span>FA testing</span><b>${esc(FA_LEVEL[d.fa_level | 0] || FA_LEVEL[0])}</b></div></div>`;
    const doped = (S.squad || []).filter(p => p && p.doped && p.doped.until >= S.sys.tick);
    const banned = (S.squad || []).filter(p => p && (p.doping_ban | 0) > 0 && (p.suspension_games | 0) > 0);
    if (doped.length) h += `<p class="k-sub">On the gear (detectable): ${doped.map(p => esc(p.name)).join(', ')}</p>`;
    if (banned.length) h += `<p class="k-sub bad">Banned: ${banned.map(p => `${esc(p.name)} (${p.suspension_games})`).join(', ')}</p>`;
    if (d.debt > 0) h += `<p><button type="button" class="k-dbtn" data-act="paymarco">Pay Marco</button></p>`;
    return h;
  }
  const TABS = [['press', 'Press'], ['evidence', 'Evidence'], ['favours', 'Favours & dirt'], ['drugs', 'Gear & FA']];
  const BODY = { press: pressTab, evidence: evidenceTab, favours: favoursTab, drugs: drugsTab };

  K.openDossier = async function (tab) {
    if (!window.S || !window.KUI) return;
    ensureSystemsState();
    tab = BODY[tab] ? tab : 'press';
    const html = `<div class="k-dossier"><nav class="k-dtabs">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</nav>`
      + TABS.map(([k]) => `<section data-pane="${k}" ${k === tab ? '' : 'hidden'}>${BODY[k]()}</section>`).join('') + '</div>';
    let cur = tab;
    const v = await KUI.modal({ title: 'The Dossier', portrait: 'secretary', variant: 'sinister', wide: true, html,
      actions: [{ id: 'close', label: 'Close' }],
      onOpen(box, done) {
        box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
          cur = b.dataset.tab;
          box.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
          box.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== cur; });
        }));
        box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); done('act:' + b.dataset.act + '|' + cur); }));
      } });
    if (!v || !String(v).startsWith('act:')) return;
    const [act, back] = String(v).slice(4).split('|');
    const [what, id] = act.split(':');
    if (what === 'lead') await K.openLead(id);
    else if (what === 'callin') await K.callInFavour(id);
    else if (what === 'blackmail') K.blackmailWithDirt(id);
    else if (what === 'paymarco') await K.handleDodgy('sys_paymarco');
    return K.openDossier(back);
  };

  // nav rail entry (and the phone "More" sheet, which copies the rail)
  function addRail() {
    const rail = document.getElementById('kRail'); if (!rail || rail.querySelector('[data-nav="dossier"]')) return;
    const b = document.createElement('button');
    b.className = 'k-nav'; b.dataset.nav = 'dossier';
    b.innerHTML = `<img class="px" alt="" src="${(window.KREPLIN_ART || {})['ico-heat'] || ''}"><span>Dossier</span><i class="k-badge" id="kBadgeDossier" hidden>!</i>`;
    const inv = rail.querySelector('[data-nav="inventory"]');
    rail.insertBefore(b, inv || rail.querySelector('.k-more'));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav="dossier"]'); if (!b) return;
    e.preventDefault();
    const more = document.getElementById('kMoreSheet'); if (more) more.hidden = true;
    K.openDossier();
  });
  GameHooks.on('hud', function () {
    try {
      addRail();
      const badge = document.getElementById('kBadgeDossier');
      if (badge && window.S && S.sys) {
        const due = K.iOwe().some(f => f.dueBy != null && f.dueBy <= S.sys.tick) || K.activeLeads().some(l => (l.runsIn | 0) <= 1);
        badge.hidden = !due;
      }
    } catch (_) {}
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addRail); else addRail();
})();
