// Scripted test for the evidence/press/drugs/corruption systems (087n–087r).
// Plays to the first pre-match menu (debug jump), then drives the systems directly and checks state:
//   evidence -> lead -> each kill/bury option -> publish (and the 1-per-matchday cap)
//   Marco credit -> debt -> called in;  doping -> FA test -> ban of a named player
//   favour owed -> called in -> refused (evidence);  Surveillance / Blackmail / Policy favour
//   legacy save migration (S.evidence map -> array, once)
//   phase 2: 3-deep chats + memory callbacks, stale texts, deadline texts, sext evidence,
//   wife -> ex-wife (Delmor dirt buries a lead), Tinder agendas/tells/Surveillance reveal,
//   "Done swiping", date outcomes, an alibi used against a police case, Sarah's arc ending bleak
// Usage: node tools/systems-test.js [--jump 2:3] [--shots dir] [--mobile]
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const file = path.resolve(path.join(__dirname, '..', 'dist', 'KREPLIN.html'));
const shots = args.shots ? path.resolve(args.shots) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fails++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(args.mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1366, height: 860 } });
  await ctx.route(/dropbox\.com|imgflip|unsplash|placeholder/, r => r.abort());
  await ctx.addInitScript(() => {
    window.__KREPLIN_TEST__ = true; window.__MG_AUTORESOLVE__ = true;
    const st = window.setTimeout, si = window.setInterval; window.__speed = 50;
    window.setTimeout = (f, d, ...a) => st(f, Math.max(0, (d || 0) / window.__speed), ...a);
    window.setInterval = (f, d, ...a) => si(f, Math.max(4, (d || 0) / window.__speed), ...a);
    window.prompt = () => 'Test'; window.alert = () => {}; window.confirm = () => true;
    HTMLMediaElement.prototype.play = function () { const el = this; st(() => { try { el.dispatchEvent(new Event('ended')); } catch (e) {} }, 30); return Promise.resolve(); };
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && /addEvidence|openLead|KSys|lead/i.test(m.text())) console.log('CONSOLE', m.text().slice(0, 400)); });
  await p.goto('file://' + file);
  await p.waitForTimeout(400);
  const [season, match] = String(args.jump && args.jump !== true ? args.jump : '1:2').split(':');
  await p.evaluate(j => window.__kreplinDebug.jump(j), { season: +season, match: +match || 0, opener: false });
  await p.click('#ladsGateYes', { timeout: 3000 }).catch(() => {});
  await p.click('#startCampaignBtn', { timeout: 3000 }).catch(() => {});

  // click through set-up until the pre-match menu is up
  const atMenu = () => p.evaluate(() => !!(window.S && S.phase === 'prematch' && /pre-match actions/i.test((document.getElementById('kPrompt') || {}).textContent || '') && document.querySelector('#actions button')));
  for (let i = 0; i < 400 && !(await atMenu()); i++) {
    await p.evaluate(() => {
      for (const el of document.querySelectorAll('input')) if (!el.value && el.offsetParent) { el.value = 'Test'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      // phone layout: the decision sheet collapses to a peek bar while narrative arrives; open it
      const sheet = document.getElementById('kDecision'); if (sheet) sheet.classList.remove('collapsed');
      const btns = [...document.querySelectorAll('button')].filter(x => { if (x.offsetParent) x.scrollIntoView({ block: 'nearest' }); const r = x.getBoundingClientRect(); if (r.width < 4 || x.disabled) return false; const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && (h === x || x.contains(h)) && !x.closest('#kRail,#kTop,#hudBar,#kSheetToggle,.k-sheet-toggle,#kMoreSheet'); });
      const pref = btns.find(x => /continue|next|ok|start|confirm|done|skip|auto|close|accept|yes/i.test(x.innerText)) || btns[0];
      if (pref) pref.click();
    }).catch(() => {});
    await p.waitForTimeout(80);
  }
  ok(await atMenu(), 'reached the pre-match menu');
  // close any legacy overlay the click-through left open (fixtures, tables…)
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(80); }
  await p.evaluate(() => { const fx = document.getElementById('fixturesPane'); if (fx) fx.style.display = 'none'; document.querySelectorAll('.news-popup-overlay').forEach(e => e.remove()); });
  const E = fn => p.evaluate(fn);
  const clickModal = async re => {
    await p.waitForSelector('.k-modal-wrap .k-btn', { timeout: 4000 });
    const done = await p.evaluate(src => { const re = new RegExp(src, 'i'); const btn = [...document.querySelectorAll('.k-modal-wrap .k-btn')].reverse().find(x => re.test(x.innerText) && !x.disabled); if (btn) { btn.click(); return btn.innerText; } return null; }, re.source);
    await p.waitForTimeout(120);
    return done;
  };
  await E(() => { S.chairman_cash = 50e6; S.club_cash = 50e6; S.lobby_tokens = 500; S.married = true; });

  // ---------- evidence -> lead ----------
  const lead1 = await E(() => { const ev = addEvidence({ kind: 'coke', label: 'Test: three bags at the Harvester', weight: 25, witness: 'bookie_marco', witnessLabel: 'Marco', forceLeak: true }); return { evN: S.evidence.length, lead: S.leads.find(l => l.evidenceIds.includes(ev.id)) }; });
  ok(lead1.lead && lead1.lead.status === 'active' && lead1.lead.theme === 'drugs', `evidence opens a lead (${lead1.lead && lead1.lead.outlet}: ${lead1.lead && lead1.lead.headline})`);
  const vague = await E(() => KSys.leadWhen(S.leads[S.leads.length - 1]));
  ok(!/%|stage/i.test(vague), `countdown is vague without Surveillance ("${vague}")`);
  const feedCard = await E(() => !!document.querySelector('#feed .k-lead'));
  ok(feedCard, 'lead card is in the feed');
  if (shots) { await p.evaluate(() => { const c = [...document.querySelectorAll('#feed .k-lead')].pop(); c && c.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(150); await p.screenshot({ path: `${shots}/lead-card-feed.png` }); }
  const chip = await E(() => { updateHUD(); const c = document.getElementById('kStatLeads'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ') : null; });
  ok(!!chip, `HUD press chip shows (${chip})`);

  // more evidence on the same theme feeds the same lead
  const fed = await E(() => { const before = S.leads.filter(l => l.status === 'active').length; addEvidence({ kind: 'coke', label: 'Test: more bags', weight: 10, forceLeak: true }); const l = S.leads.find(x => x.status === 'active' && x.theme === 'drugs'); return { before, after: S.leads.filter(x => x.status === 'active').length, pending: l.pendingWeight }; });
  ok(fed.before === fed.after && fed.pending >= 10, 'same-theme evidence speeds up the existing lead');

  // ---------- kill / bury, one each ----------
  const mk = theme => `(() => { const ev = addEvidence({ kind: 'paper', label: 'Test ${theme}', weight: 12, tags: ['${theme}'], noLeak: true }); ev.leaked = true; return KSys.createLead('${theme}', [ev], null).id; })()`;
  const kill = async (theme, how, prep) => p.evaluate(async ([src, how, prep]) => {
    S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'test cleanup'));
    if (prep) eval(prep);
    const id = eval(src); const lead = S.leads.find(l => l.id === id);
    const r0 = Math.random; Math.random = () => 0.01; // deterministic success
    let res; try { res = await KSys.killLead(lead, typeof how === 'function' ? how() : (how.startsWith('favour:') ? 'favour:' + KSys.owedToMe()[0].id : how.startsWith('dirt:') ? 'dirt:' + KSys.freeDirt()[0].id : how)); } finally { Math.random = r0; }
    return { res, status: lead.status, note: lead.note };
  }, [mk(theme), how, prep || null]);
  let r = await kill('sex', 'bribe'); ok(r.status === 'killed', `bribe the editor kills it (${r.note})`);
  const bribeEv = await E(() => S.evidence.some(e => e.kind === 'bribe' && /editor/i.test(e.label)));
  ok(bribeEv, 'editor bribe leaves bribery evidence (registerBribe)');
  r = await kill('corruption', 'threat'); ok(r.status === 'killed', `threaten the source kills it (${r.note})`);
  r = await kill('violence', 'injunction'); ok(r.status === 'killed', `super-injunction kills it (${r.note})`);
  const gag = await E(() => (S.press.published || []).some(s => /GAGGED/i.test(s.headline)));
  ok(gag, 'super-injunction runs its own "gagged chairman" story');
  r = await kill('money', 'favour:', "KSys.addFavour('Ref Dowd','owed_to_me','test',{kind:'referee'})"); ok(r.status === 'killed', `call in a favour kills it (${r.note})`);
  r = await kill('drugs', 'dirt:', "KSys.addDirt('delmor','Delmor test dirt',20,'Delmor')"); ok(r.status === 'buried', `bury with Delmor dirt (${r.note})`);
  const rev = await E(() => S.sys.delmorRevengeAt > S.sys.tick);
  ok(rev, 'Delmor revenge scheduled');
  // the kill modal (UI path)
  await E(() => { S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'cleanup')); });
  const uiId = await E(() => { const ev = addEvidence({ kind: 'coke', label: 'Test: UI lead', weight: 20, noLeak: true }); return KSys.createLead('drugs', [ev], 'bookie_marco', 'Marco').id; });
  p.evaluate(id => KSys.openLead(id), uiId);
  await p.waitForSelector('.k-modal-wrap .k-lead', { timeout: 4000 });
  const acts = await E(() => [...document.querySelectorAll('.k-modal-wrap .k-btn')].map(x => x.innerText.replace(/^\d\s*/, '')));
  ok(acts.some(a => /editor/i.test(a)) && acts.some(a => /threaten|lean on/i.test(a)) && acts.some(a => /injunction/i.test(a)) && acts.some(a => /bury/i.test(a)), `lead modal offers kill/bury options: ${acts.join(' | ')}`);
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: `${shots}/lead-modal.png` }); }
  await clickModal(/let it run/);

  // ---------- publish + caps ----------
  const pub = await E(() => {
    const club0 = S.club_cash, rep0 = S.reputation;
    S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'cleanup'));
    const mkL = th => { const ev = addEvidence({ kind: 'paper', label: 'Big ' + th, weight: 30, tags: [th], noLeak: true }); const ev2 = addEvidence({ kind: 'paper', label: 'Bigger ' + th, weight: 30, tags: [th], noLeak: true }); return KSys.createLead(th, [ev, ev2], null); };
    const a = mkL('drugs'), c = mkL('sex');
    a.progress = 99; c.progress = 99;
    S.sys.tick += 1; S.sys.newLeadTick = -1;
    advanceLeads();
    const capOk = [a, c].filter(l => l.published).length === 1;
    const held = [a, c].find(l => !l.published);
    S.sys.tick += 1; advanceLeads();
    const story = (S.press.published || []).find(s => s.leadId === a.id || s.leadId === c.id);
    return { capOk, heldPublishedNextTick: held && held.published, story: story && story.headline, clubDrop: club0 - S.club_cash, repDrop: rep0 - S.reputation };
  });
  ok(pub.capOk, 'only one lead publishes per matchday');
  ok(pub.heldPublishedNextTick, 'the held lead publishes the next matchday');
  ok(!!pub.story && pub.clubDrop > 0 && pub.repDrop > 0, `published: "${pub.story}" (club −${pub.clubDrop}, rep −${pub.repDrop})`);
  const cap = await E(() => { S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'c')); S.sys.newLeadTick = -1; for (let i = 0; i < 6; i++) { S.sys.newLeadTick = -1; leakCheck(addEvidence({ kind: 'paper', label: 'cap ' + i, weight: 5, tags: [['drugs', 'sex', 'corruption', 'doping', 'violence', 'money'][i]], noLeak: true }), { force: true }); } return S.leads.filter(l => l.status === 'active').length; });
  ok(cap <= 3, `max 3 active leads (${cap})`);

  // ---------- Marco credit -> debt -> called in ----------
  const debt0 = await E(() => { KSys.marcoOnTick(3); return S.drugs.debt; });
  ok(debt0 > 0, `Marco gives credit (tab ${debt0})`);
  await E(() => { for (let i = 0; i < 3; i++) GameHooks.emit('matchday:end'); });
  const debt1 = await E(() => ({ debt: S.drugs.debt, weeks: S.drugs.debtWeeks }));
  ok(debt1.debt > debt0 && debt1.weeks >= 3, `debt grows weekly (${debt1.debt}, ${debt1.weeks} weeks)`);
  await E(() => { S.drugs.lastCollect = -99; S.sys.eventsTick = -1; S.drugs.debtWeeks = 5; S.fa_heat = 0; S.drugs.lastTest = S.sys.tick; window.__ev = GameHooks.emitAsync('prematch:events'); });
  const marcoBtn = await clickModal(/pay half/);
  await E(() => window.__ev);
  const debt2 = await E(() => S.drugs.debt);
  ok(!!marcoBtn && debt2 < debt1.debt, `Marco calls it in; paid half (tab now ${debt2})`);

  // ---------- doping -> FA test -> ban (named player) ----------
  const ban = await E(() => {
    const cap = S.squad.find(x => x && !x.is_dead);
    S.captain_name = cap.name; // a named story player
    cap.doped = { kind: 'steroid', until: S.sys.tick + 4 }; cap.suspension_games = 0;
    S.drugs.fa_level = 2; S.fa_heat = 200; // targeted testing: the doped are tested first
    const r0 = Math.random; let res; Math.random = () => 0.02; try { res = maybePlayerDrugScandal(true); } finally { Math.random = r0; }
    window.__test = res && res.modal;
    return { name: cap.name, banned: res && res.banned && res.banned.map(b => b.p.name), games: cap.suspension_games, inLineup: S.lineup.includes(cap.id) };
  });
  ok(ban.banned && ban.banned.includes(ban.name) && ban.games >= 2 && ban.games <= 6, `FA test bans the captain ${ban.name} for ${ban.games}`);
  ok(!ban.inLineup, 'banned player is out of the lineup');
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: `${shots}/drug-test.png` }); }
  await clickModal(/accept the bans/);
  const steroid = await E(() => { const h0 = S.fa_heat; S.preMatch = S.preMatch || {}; S.preMatch.sys_steroids = false; KSys.steroids(); return S.fa_heat - h0; });
  ok(steroid >= 15, `steroids stack FA heat (+${steroid})`);
  const roll = await E(() => { S.drugs.lastTest = -99; S.drugs.lastTestCheck = -1; S.fa_heat = 0; return maybePlayerDrugScandal(); });
  ok(roll === null, 'no test when FA heat is 0');

  // ---------- cocaine states / tolerance ----------
  const coke = await E(() => { S.inventory.drugs = 10; S.drug_streak = 0; S.coke_streak = 0; const t0 = S.drugs.tolerance; KDrugQuick.take(); return { state: S.coke_state, tol: S.drugs.tolerance - t0, add: S.drugs.addiction, mult: S._coke_bribe_multiplier }; });
  ok(coke.state === 'buzzed' && coke.tol > 0 && coke.mult > 1, `taking coke sets ${coke.state} (bribe ×${coke.mult}), tolerance +${coke.tol}`);

  // ---------- DERANGED menu ----------
  await E(() => { S.coke_state = 'wired'; S.preMatch.sys_deranged = null; });
  await p.waitForFunction(() => [...document.querySelectorAll('#actions button')].some(x => /dodgy stuff/i.test(x.innerText)), null, { timeout: 5000 }).catch(async () => console.log('NOTE actions:', await E(() => document.getElementById('actions').innerText.slice(0, 300))));
  const dodgy = await E(() => { const b = [...document.querySelectorAll('#actions button')].find(x => /dodgy stuff/i.test(x.innerText)); if (b) b.click(); return !!b; });
  await p.waitForFunction(() => [...document.querySelectorAll('#actions button')].some(x => /DERANGED/.test(x.innerText)), null, { timeout: 6000 }).catch(() => {});
  const der = await E(() => [...document.querySelectorAll('#actions button')].map(x => x.innerText).filter(t => /DERANGED/.test(t)));
  if (!der.length) console.log('NOTE after dodgy:', dodgy, await E(() => [document.getElementById('kPrompt').innerText, document.getElementById('actions').innerText.slice(0, 400), S.coke_state, JSON.stringify(KSys.dodgyItems())]));
  ok(dodgy && der.length >= 1, `DERANGED options in Dodgy stuff: ${der.join(' | ')}`);
  if (shots) { await p.evaluate(() => document.getElementById('kDecision') && document.getElementById('kDecision').scrollIntoView()); await p.screenshot({ path: `${shots}/deranged-menu.png` }); }
  const derRes = await E(async () => { const b = [...document.querySelectorAll('#actions button')].find(x => /DERANGED/.test(x.innerText)); const n0 = S.evidence.length; b.click(); await new Promise(r => setTimeout(r, 20000)); /* timers run 50x fast */ return { left: [...document.querySelectorAll('#actions button')].filter(x => /DERANGED/.test(x.innerText)).length, n0 }; });
  ok(derRes.left === der.length - 1, 'a DERANGED option is used once and the menu re-opens without it');
  await E(() => { const b = [...document.querySelectorAll('#actions button')].find(x => /^back$/i.test((x.querySelector('.lbl') || x).innerText.trim())); b && b.click(); });

  // ---------- favours ----------
  const bribeFav = await E(() => { const n = KSys.owedToMe().length; registerBribe(250000, { kind: 'referee' }); return { n0: n, n1: KSys.owedToMe().length, count: S.bribes_count }; });
  ok(bribeFav.n1 >= bribeFav.n0 && bribeFav.count > 0, 'registerBribe creates an IOU owed to you');
  await E(() => { S.favours = S.favours.filter(f => f.dir !== 'i_owe'); KSys.addFavour('Minister Hollis', 'i_owe', 'Test act', { kind: 'hollis', label: 'Minister Hollis', dueIn: -2 }); S.sys.favourCallTick = -1; /* overdue: always called in */ S.sys.eventsTick = S.sys.tick; window.__ev2 = GameHooks.emitAsync('prematch:events'); });
  const favBtn = await clickModal(/refuse/);
  await E(() => window.__ev2);
  const refused = await E(() => ({ ev: S.evidence.some(e => e.kind === 'favour_refused'), left: KSys.iOwe().length }));
  ok(!!favBtn && refused.ev && refused.left === 0, 'favour you owe is called in; refusing leaves evidence');

  // ---------- Power Network: Surveillance / Blackmail / Policy favour ----------
  await p.evaluate(() => { S.referee_soft_bias = 0; /* a random earlier event can leave a tilt, which greys out Policy favour */ const b = document.getElementById('openPowerNetworkBtn'); b && b.click(); });
  await p.waitForTimeout(300);
  const rows = await E(() => [...document.querySelectorAll('#powerPerks [data-perk-id]')].map(x => x.dataset.perkId));
  ok(['perk-policy-favour', 'perk-surveillance', 'perk-advanced-blackmail'].every(k => rows.includes(k)), `Power Network shows Policy favour / Surveillance / Blackmail (${rows.length} perks)`);
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: `${shots}/power-network.png` }); }
  for (const id of ['perk-surveillance', 'perk-advanced-blackmail', 'perk-policy-favour']) {
    await p.evaluate(id => { const b = document.querySelector(`#powerPerks [data-perk-id="${id}"]`); b && b.click(); }, id);
    await p.waitForTimeout(200);
  }
  const pw = await E(() => ({ surv: KSys.surveillanceOn(), tinder: S.surveillance && S.surveillance.tinderReveal, dirt: KSys.freeDirt().length, kit: S.sys.blackmailKit, pending: S.power_blackmail_pending, bureaucrat: KSys.owedToMe().some(f => /bureaucrat/i.test(f.label)), owedList: KSys.owedToMe().map(f => f.label).join(';'), tokens: S.lobby_tokens, bias: S.referee_soft_bias, exact: KSys.leadWhen(S.leads.find(l => l.status === 'active') || S.leads[0]) }));
  ok(pw.surv && pw.tinder && pw.dirt >= 2, `Surveillance: running, Tinder reveal flag, dirt ×${pw.dirt}`);
  ok(/stage|published|killed|buried/i.test(pw.exact), `Surveillance shows exact stage ("${pw.exact}")`);
  ok(pw.bureaucrat && pw.bias > 0, `Policy favour: +bias and a bureaucrat owes you (${pw.bureaucrat}, ${pw.bias}, owed: ${pw.owedList}, tokens ${pw.tokens})`);
  await p.evaluate(() => { const b = document.getElementById('powerNetworkCloseBtn'); b && b.click(); });
  const bm = await E(() => { const m0 = S.morale_opponent = 70; GameHooks.emit('prematch:end'); const d = KSys.freeDirt()[0]; const f = d && KSys.blackmailWithDirt(d.id); return { drop: m0 - S.morale_opponent, pending: S.power_blackmail_pending, fav: !!f }; });
  ok(bm.drop >= 20 && !bm.pending, `Blackmail: a key opponent drops out (opp morale −${bm.drop})`);
  ok(bm.fav, 'Blackmail turns dirt into a favour owed to you');

  // ======================= PHASE 2: texting =======================
  const phoneBtn = async (re, timeout = 5000) => {
    await p.waitForFunction(src => [...document.querySelectorAll('#phone-choice-container button')].some(x => new RegExp(src, 'i').test(x.innerText)), re.source, { timeout }).catch(() => {});
    return p.evaluate(src => { const b = [...document.querySelectorAll('#phone-choice-container button')].find(x => new RegExp(src, 'i').test(x.innerText)); if (b) { b.click(); return b.innerText; } return null; }, re.source);
  };
  const closePhone = () => E(() => { try { closePhoneTextPopup(); } catch (_) {} });
  await closePhone();
  await E(() => { initPhoneSystem(); const c = S.contacts.captain; c.textsThisPhase = 0; c.history = []; c.queued_texts = []; delete S.relationships.captain; });
  // level 1 = the existing quick-text tone; levels 2 and 3 = follow-ups
  p.evaluate(() => openContactChat('captain'));
  const t1 = await phoneBtn(/Friendly/);
  const t2 = await phoneBtn(/Proper captain/);
  const t3 = await phoneBtn(/Love you mate/);
  await p.waitForFunction(() => (S.contacts.captain.history || []).filter(h => h.from === 'them').length >= 3, null, { timeout: 6000 }).catch(() => {});
  if (shots) { await p.waitForTimeout(400); await p.screenshot({ path: `${shots}/phone-chat-3deep.png` }); }
  const chat = await E(() => ({ you: S.contacts.captain.history.filter(h => h.from === 'you').map(h => h.text), them: S.contacts.captain.history.filter(h => h.from === 'them').length, mem: S.relationships.captain.memory.map(m => m.quote), warmth: S.relationships.captain.warmth }));
  ok(!!t1 && !!t2 && !!t3 && chat.you.length >= 3 && chat.them >= 3, `3-deep captain chat: ${chat.you.map(x => '"' + x.slice(0, 28) + '"').join(' > ')}`);
  ok(chat.mem.includes('love you mate') && chat.warmth > 50, `captain remembers "${chat.mem.join('", "')}" (warmth ${chat.warmth})`);
  // weeks later he brings it up
  await E(() => { S.sys.tick += 3; S.contacts.captain.textsThisPhase = 0; window.__r0 = Math.random; Math.random = () => 0.1; });
  await phoneBtn(/Leave it|Back/); await closePhone();
  p.evaluate(() => openContactChat('captain'));
  await phoneBtn(/Friendly/);
  await p.waitForFunction(() => S.contacts.captain.history.some(h => h.from === 'them' && /love you mate/i.test(h.text)), null, { timeout: 6000 }).catch(() => {});
  await E(() => { Math.random = window.__r0; });
  const cb = await E(() => (S.contacts.captain.history.filter(h => h.from === 'them').pop() || {}).text);
  const cbAny = await E(() => S.contacts.captain.history.find(h => h.from === 'them' && /love you mate/i.test(h.text)));
  ok(!!cbAny, `memory callback, matches later: "${cbAny ? cbAny.text : cb}"`);
  await closePhone();

  // stale: unread for two matches costs (captain sulks -> morale; Marco adds interest)
  const stale = await E(() => {
    S.drugs.debt = 20000; const debt0 = S.drugs.debt;
    queueIncomingText('captain', 'Gaffer? (test)'); queueIncomingText('bookie_marco', 'oi (test)');
    const w0 = KSys.rel('captain').warmth, m0 = S.morale;
    GameHooks.emit('matchday:end'); GameHooks.emit('matchday:end');
    const e = S.contacts.captain.queued_texts.find(x => /test/.test(x.text));
    return { stale: !!(e && e.stale), dw: KSys.rel('captain').warmth - w0, dm: S.morale - m0, debtUp: S.drugs.debt - debt0, marco: KSys.rel('bookie_marco').staleUnread, note: (S.contacts.captain.queued_texts.find(x => x.staleNote) || {}).text };
  });
  ok(stale.stale && stale.dw < 0 && stale.marco >= 1 && stale.debtUp > 0, `unread texts go stale: captain warmth ${stale.dw}, morale ${stale.dm}, Marco tab +${stale.debtUp} ("${stale.note}")`);

  // deadline: "reply by kickoff" or it lands
  const dl = await E(() => {
    const th = KSys.THREADS.mgr_board; S.contacts.manager.queued_texts = [];
    const e = KSys.queueThread('manager', th); const t0 = KSys.rel('manager').trust, m0 = S.morale;
    KSys.checkDeadlines(); const early = e.expired;
    S.sys.tick += 1; KSys.checkDeadlines();
    return { early, expired: e.expired, dt: KSys.rel('manager').trust - t0, dm: S.morale - m0, text: e.text };
  });
  ok(!dl.early && dl.expired && dl.dt < 0, `deadline text expires at kickoff if unanswered (manager trust ${dl.dt}, morale ${dl.dm}): "${dl.text.slice(0, 60)}…"`);
  // ...and an answered one doesn't
  await E(() => { S.contacts.captain.queued_texts = []; KSys.queueThread('captain', KSys.THREADS.cap_bonus); S.contacts.captain.textsThisPhase = 0; });
  p.evaluate(() => openContactChat('captain'));
  const ans = await phoneBtn(/Double it/);
  await p.waitForTimeout(400);
  const dl2 = await E(() => { const e = S.contacts.captain.queued_texts.find(x => x.thread === 'cap_bonus'); S.sys.tick += 1; KSys.checkDeadlines(); return { answered: e.answered, expired: e.expired }; });
  ok(!!ans && dl2.answered && !dl2.expired, 'answering a deadline text in time defuses it');
  await closePhone();

  // a sext becomes evidence (and may be screenshotted)
  const ev0 = await E(() => S.evidence.length);
  await E(() => { S.contacts.captain_wife.textsThisPhase = 0; S.contacts.captain_wife.flirt_level = 0; });
  p.evaluate(() => openContactChat('captain_wife'));
  await phoneBtn(/Erotic/);
  await p.waitForFunction(() => S.evidence.some(e => e.kind === 'sext' && e.witness === 'captain_wife'), null, { timeout: 6000 }).catch(() => {});
  const sext = await E(() => S.evidence.filter(e => e.kind === 'sext' && e.witness === 'captain_wife').pop());
  ok(!!sext && sext.tags.includes('sex'), `a sext becomes evidence: "${sext && sext.label}"${sext && sext.screenshot ? ' (screenshotted)' : ''}`);
  await phoneBtn(/Leave it/, 1500); await closePhone();

  // the secretary keeps her own builder; her one-liners now get answered back, and her threads wait for a reply
  await E(() => { S.secretary_hired = true; S.secretary_name = S.secretary_name || 'Tracey Bumble'; initializeSecretaryMessagingState(); S.secRel = 50; S.secTrust = 50; S.secRisk = 30; initPhoneSystem(); S.contacts.secretary.queued_texts = []; KSys.queueThread('secretary', KSys.THREADS.sec_hr); window.__r2 = Math.random; Math.random = () => 0.3; });
  p.evaluate(() => openSecretaryMessaging());
  const secAns = await phoneBtn(/Answer/);
  await phoneBtn(/Sign it/);
  await p.waitForTimeout(300);
  await phoneBtn(/Professional \(one-liner\)/);
  await phoneBtn(/No attachment/);
  const secFollow = await phoneBtn(/↩/, 6000);
  await p.waitForTimeout(400);
  await E(() => { Math.random = window.__r2; });
  const sec = await E(() => ({ answered: S.contacts.secretary.queued_texts.some(e => e.thread === 'sec_hr' && e.answered), hist: (S.secMessageHistory || []).length, trust: S.secTrust }));
  ok(!!secAns && sec.answered && !!secFollow, `secretary: thread answered from her chat, one-liner gets a follow-up (${secFollow && secFollow.slice(0, 40)})`);
  await closePhone();

  // wife (S1–3) -> "Ex-wife (at Delmor's)" in S4: taunts + Delmor dirt that buries a lead
  const season0 = await E(() => S.season);
  const wife = await E(() => { S.married = true; if (!S.wife_name) S.wife_name = 'Babs Kreplin'; KSys.syncWife(); return { wife: !!(S.contacts.wife && S.contacts.wife.unlocked), ex: !!(S.contacts.ex_wife && S.contacts.ex_wife.unlocked) }; });
  ok(wife.wife && !wife.ex, 'season 1–3: your wife is in your contacts');
  await E(() => { S.contacts.wife.queued_texts = []; KSys.queueThread('wife', KSys.THREADS.wife_recital); });
  p.evaluate(() => openContactChat('wife'));
  await phoneBtn(/Board meeting/); await phoneBtn(/tactical prawns/i);
  await p.waitForFunction(() => S.contacts.wife.history.filter(h => h.from === 'them').length >= 2, null, { timeout: 6000 }).catch(() => {});
  const wchat = await E(() => S.contacts.wife.history.map(h => (h.from === 'you' ? '> ' : '< ') + h.text.slice(0, 50)));
  ok(wchat.length >= 4, `wife thread: ${wchat.join(' | ')}`);
  await closePhone();
  const ex = await E(() => {
    S.season = 4; S.season4 = S.season4 || {}; S.season4.wife_left_for_delmor = true; KSys.syncWife();
    S.sys.exNextDirt = S.sys.tick; S.sys.threadsThisTick = 0; KSys.exWifeTick();
    const e = KSys.pendingThread('ex_wife');
    return { wife: !!S.contacts.wife.unlocked, ex: !!S.contacts.ex_wife.unlocked, name: S.contacts.ex_wife.name, pending: e && e.text, mem: KSys.rel('ex_wife').memory.length };
  });
  ok(!ex.wife && ex.ex && /Delmor/.test(ex.name), `season 4: "${ex.name}" replaces the wife (memories carried: ${ex.mem})`);
  p.evaluate(() => openContactChat('ex_wife'));
  await p.waitForSelector('#phone-choice-container .phone-choice-btn', { timeout: 5000 }).catch(() => {});
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: `${shots}/phone-ex-wife-dirt.png` }); }
  await phoneBtn(/Send me proof/);
  await p.waitForFunction(() => S.dirt.some(d => d.from === 'ex_wife'), null, { timeout: 6000 }).catch(() => {});
  if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: `${shots}/phone-ex-wife-reply.png` }); }
  const buried = await E(async () => {
    const d = S.dirt.find(x => x.from === 'ex_wife' && !x.used); if (!d) return null;
    S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'cleanup'));
    const ev = addEvidence({ kind: 'coke', label: 'Test: ex-wife bury', weight: 12, noLeak: true }); ev.leaked = true;
    const lead = KSys.createLead('drugs', [ev], null);
    const r = await KSys.killLead(lead, 'dirt:' + d.id);
    return { r, status: lead.status, note: lead.note };
  });
  ok(buried && buried.status === 'buried', `ex-wife's Delmor dirt buries a lead (${buried && buried.note})`);
  const taunt = await E(() => { S.sys.exNextDirt = S.sys.tick + 5; S.sys.threadsThisTick = 0; const n0 = S.contacts.ex_wife.queued_texts.length; const r0 = Math.random; Math.random = () => 0.1; try { KSys.exWifeTick(); } finally { Math.random = r0; } const e = S.contacts.ex_wife.queued_texts.slice(-1)[0] || {}; return { text: e.text, cat: e.category, added: S.contacts.ex_wife.queued_texts.length > n0 }; });
  ok(taunt.added && taunt.cat === 'malicious', `ex-wife taunts: "${taunt.text}"`);
  await closePhone();

  // ======================= PHASE 2: Tinder =======================
  await E(() => { S.season4.daughter_suggested_dating = true; ensureTinderFlags(); S.season4.tinder_profile_created = true; S.season4.tinder_bio = ['Love abit of connection x']; S.surveillance = { active: false, until: -1, tinderReveal: false }; S.sys.surveillanceUntil = -1; });
  const swipe = async () => {
    p.evaluate(() => { window.__sw = openTinderSwiping(); });
    await p.waitForSelector('#tinderStartBtn', { state: 'visible', timeout: 5000 });
    await p.click('#tinderStartBtn');
    await p.waitForTimeout(300);
  };
  await swipe();
  const card0 = await E(() => ({ tell: (document.querySelector('#tinderCard .k-tinder-tell') || {}).innerText, agenda: !!document.querySelector('#tinderCard .k-tinder-agenda'), done: !!document.getElementById('tinderDoneBtn') }));
  if (shots) await p.screenshot({ path: `${shots}/tinder-card-tell.png` });
  ok(!!card0.tell && !card0.agenda, `Tinder card shows a tell, agenda hidden without Surveillance ("${card0.tell}")`);
  ok(card0.done, 'swiping has a "Done swiping" exit');
  await p.click('#tinderDoneBtn');
  const closed = await E(async () => { await Promise.race([window.__sw, new Promise(r => setTimeout(r, 4000))]); return document.getElementById('tinderModal').classList.contains('hidden'); });
  ok(closed, '"Done swiping" closes Tinder and returns');
  // Surveillance: every agenda revealed
  await E(() => KSys.onSurveillance());
  await swipe();
  const seen = {};
  for (let i = 0; i < 12; i++) {
    const c = await E(() => ({ name: (document.getElementById('tinderCardName') || {}).innerText, ag: (document.querySelector('#tinderCard .k-tinder-agenda b') || {}).innerText, hidden: document.getElementById('tinderModal').classList.contains('hidden') }));
    if (c.hidden) break;
    if (c.ag && !seen[c.ag]) { seen[c.ag] = c.name; if (shots && /PLANT/.test(c.ag)) await p.screenshot({ path: `${shots}/tinder-card-surveillance.png` }); }
    await p.click('#tinderPassBtn', { force: true }).catch(() => {});
    await p.waitForTimeout(450);
  }
  const ags = Object.keys(seen);
  ok(['JOURNALIST', 'PLANT', 'GOLD-DIGGER', 'GENUINE'].every(k => ags.some(a => a.includes(k))), `Surveillance reveals every agenda: ${ags.map(a => `${a} (${seen[a]})`).join(', ')}`);
  await E(() => { const m = document.getElementById('tinderModal'); m.classList.add('hidden'); });
  // a match keeps the agenda and lands in your phone
  const rec = await E(() => { const m = KSys.tinderOnMatch({ name: 'Gemma', agenda: 'journalist', tell: 'Job: media' }); KSys.tinderOnMatch({ name: 'Kayleigh', agenda: 'plant' }); KSys.tinderOnMatch({ name: 'Chanel', agenda: 'golddigger' }); KSys.tinderOnMatch({ name: 'Sarah', agenda: 'genuine' }); return { agenda: m.agenda, contact: !!(S.contacts[m.contact] && S.contacts[m.contact].unlocked) }; });
  ok(rec.agenda === 'journalist' && rec.contact, 'a match keeps her agenda and becomes a phone contact');
  // "Talk about work" with the journalist: a quote becomes evidence and her lead jumps
  await E(() => { S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'cleanup')); S.sys.newLeadTick = -1; });
  const tw = E(() => KSys.tinderTalkWork({ name: 'Gemma' }));
  await clickModal(/Greggs/); await tw;
  const greggs = await E(() => { const ev = S.evidence.find(e => /Greggs/.test(e.label)); const l = ev && S.leads.find(x => x.evidenceIds.includes(ev.id)); return { ev: !!ev, stage: l && l.stage, progress: l && l.progress }; });
  ok(greggs.ev && greggs.stage >= 2, `journalist fishes a quote: evidence + lead jumps to stage ${greggs.stage + 1}`);
  // date outcomes per agenda
  const date = async (name, re) => { const pr = p.evaluate(n => KSys.tinderDateOutcome(n), name); for (const r of [].concat(re)) await clickModal(r); return pr; };
  await E(() => { S.leads.filter(l => l.status === 'active').forEach(l => KSys.endLead(l, 'killed', 'cleanup')); S.sys.newLeadTick = -1; });
  const o1 = await date('Gemma', /Brilliant/);
  const kt = await E(() => S.evidence.some(e => /sold her night/.test(e.label) && e.leaked));
  ok(o1 && (o1.includes('kiss_and_tell') || o1.includes('photos')) && (kt || o1.includes('photos')), `journalist date: ${o1.join(', ')}`);
  const pr = p.evaluate(() => KSys.tinderDateOutcome('Kayleigh'));
  await p.waitForSelector('.k-modal-wrap .k-out-plant', { timeout: 4000 }).catch(() => {});
  if (shots) { await p.waitForTimeout(400); await p.screenshot({ path: `${shots}/tinder-date-outcome-plant.png` }); }
  await clickModal(/Brilliant/); const o2 = await pr;
  const plant = await E(() => ({ intel: S.sys.pompeyIntel, bugged: S.sys.bugged > S.sys.tick, delmor: (S.contacts.delmor_krunchem.queued_texts.slice(-1)[0] || {}).text }));
  ok(o2.includes('plant') && plant.intel >= 2 && plant.bugged, `plant date: Delmor gets your tactics ("${plant.delmor}")`);
  const pr3 = p.evaluate(() => KSys.tinderDateOutcome('Chanel'));
  await p.waitForSelector('.k-modal-wrap .k-out-blackmail', { timeout: 4000 }).catch(() => {});
  if (shots) { await p.waitForTimeout(400); await p.screenshot({ path: `${shots}/tinder-date-outcome-blackmail.png` }); }
  await clickModal(/Publish and be damned/); const o3 = await pr3;
  const bm3 = await E(() => S.evidence.some(e => /Saints scarf/.test(e.label)));
  ok(o3.includes('blackmail') && bm3, 'gold-digger date: blackmail with a price; refusing sends the photos');
  // Sarah: the real thing, through the existing invitation flow (bleak text kept), then an alibi
  await E(() => { window.__logs = []; GameHooks.on('log', m => window.__logs.push(String(m))); S.season4.tinder_matches = S.season4.tinder_matches || []; window.__inv = null; window.__r1 = Math.random; Math.random = () => 0.9; /* no sharia police this time */ window.__dt = handleTinderInvitation({ name: 'Sarah', bio: 'x', personality: 'enthusiastic' }); });
  for (let i = 0; i < 40; i++) {
    const done = await E(() => S.tinder.sarah.dates > 0 && !document.querySelector('.k-modal-wrap'));
    const clicked = await E(() => { const m = [...document.querySelectorAll('.k-modal-wrap .k-btn')].pop(); if (m) { m.click(); return 'modal'; } const b = [...document.querySelectorAll('#actions button')].find(x => /use protection|complete|continue|ok/i.test(x.innerText)); if (b) { b.click(); return b.innerText; } return null; });
    if (done && !clicked) break;
    await p.waitForTimeout(250);
  }
  await E(() => { Math.random = window.__r1; });
  const sd = await E(() => ({ dates: S.tinder.sarah.dates, alibi: !!KSys.freeAlibi(), stage: S.tinder.sarah.stage, bleak: window.__logs.some(m => /You feel nothing/.test(m)) }));
  ok(sd.dates >= 1 && sd.alibi && sd.bleak, `Sarah date via the real invite flow: bleak text kept, connection + alibi (${JSON.stringify(sd)})`);
  // the alibi against a police case
  await E(() => { window.__ui_context = 'postmatch'; window.__inv = presentInvestigation({ type: 'investigation', authority: 'police', caseType: 'misconduct' }); });
  await p.waitForFunction(() => [...document.querySelectorAll('#stepOptions button')].some(b => /alibi/i.test(b.innerText)), null, { timeout: 6000 }).catch(() => {});
  if (shots) await p.screenshot({ path: `${shots}/police-alibi.png` });
  const alibiBtn = await E(() => { const b = [...document.querySelectorAll('#stepOptions button')].find(x => /alibi/i.test(x.innerText)); if (b) { b.click(); return b.innerText; } return null; });
  await E(async () => { await Promise.race([window.__inv, new Promise(r => setTimeout(r, 8000))]); });
  const al = await E(() => ({ used: S.tinder.alibis.filter(a => a.used).length, free: !!KSys.freeAlibi(), modal: !!window.currentInvestigationModal && document.body.contains(window.currentInvestigationModal) }));
  ok(!!alibiBtn && al.used === 1 && !al.free, `alibi used once against a police case: ${alibiBtn}`);
  // Sarah's arc: five beats, then she leaves — whatever you answer
  const sarahTry = [/Coffee/, /Tell her I said hi/, /None of it/, /She's right/, /Please don't go/];
  for (let s = 0; s < 5; s++) {
    const ok1 = await E(() => { S.tinder.sarah.next = S.sys.tick; const e = KSys.sarahText(); return !!e; });
    if (!ok1) break;
    p.evaluate(() => openContactChat('tinder_sarah'));
    await phoneBtn(sarahTry[s]);
    await p.waitForTimeout(500);
    if (s === 4 && shots) await p.screenshot({ path: `${shots}/phone-sarah-leaves.png` });
    await closePhone();
  }
  const sarah = await E(() => ({ ended: S.tinder.sarah.ended, gone: S.contacts.tinder_sarah.gone, pool: generateTinderProfilePool().some(x => x.name === 'Sarah'), hist: S.contacts.tinder_sarah.history.filter(h => h.from === 'them').length }));
  ok(sarah.ended && !!sarah.gone && !sarah.pool, `Sarah's arc ends bleak (${sarah.hist} replies; "${sarah.gone}") and she's off Tinder`);
  const ignored = await E(() => { const T = S.tinder.sarah; T.ended = false; T.stage = 5; T.finalSent = null; T.next = S.sys.tick; S.contacts.tinder_sarah.gone = null; KSys.sarahText(); GameHooks.emit('matchday:end'); return T.ended; });
  ok(ignored, 'ignoring her last text ends it too');
  // post-date texts from the others, with a deadline for the gold-digger
  const after = await E(() => { const T = KSys.tinderState(); Object.values(T.matches).forEach(m => { m.afterNext = 0; if (m.name !== 'Sarah') m.dates = Math.max(1, m.dates); }); const r0 = Math.random; Math.random = () => 0.1; try { for (let i = 0; i < 3; i++) { S.sys.tick++; KSys.tinderTick(); } } finally { Math.random = r0; } return Object.values(T.matches).filter(m => m.afterSent).map(m => m.name + ': ' + (S.contacts[m.contact].queued_texts.slice(-1)[0] || {}).text); });
  ok(after.length >= 2, `matches keep texting after the date: ${after.map(x => x.slice(0, 60)).join(' | ')}`);
  await p.evaluate(s => { S.season = s; }, season0);

  // ---------- Dossier ----------
  p.evaluate(() => KSys.openDossier('press'));
  await p.waitForSelector('.k-dossier', { timeout: 4000 });
  await p.waitForTimeout(600);
  if (shots) await p.screenshot({ path: `${shots}/dossier-press.png` });
  for (const tab of ['evidence', 'favours', 'drugs']) {
    await p.click(`.k-dossier [data-tab="${tab}"]`);
    await p.waitForTimeout(300);
    if (shots) await p.screenshot({ path: `${shots}/dossier-${tab}.png` });
  }
  const dos = await E(() => [...document.querySelectorAll('.k-dossier [data-pane]')].map(s => s.innerText.length));
  ok(dos.every(n => n > 20), 'Dossier tabs render');
  await clickModal(/close/);
  const rail = await E(() => !!document.querySelector('#kRail [data-nav="dossier"]'));
  ok(rail, 'Dossier is on the nav rail');

  // ---------- migration ----------
  const mig = await E(() => {
    const old = JSON.parse(JSON.stringify(S));
    ['leads', 'favours', 'dirt', 'drugs', 'sys', 'systems_v', 'lineMemory', 'surveillance', 'fa_heat'].forEach(k => delete old[k]);
    old.evidence = { 'Bob Shitley': 'drugs', 'Dave Twat': 'drugs' }; old.drug_streak = 3; old.coke_state = 'crashing';
    const st = parseSavedGame(JSON.stringify(old));
    const again = parseSavedGame(JSON.stringify(st));
    return { arr: Array.isArray(st.evidence), planted: st.evidence.filter(e => e.kind === 'planted').length, tol: st.drugs.tolerance, state: st.drugs.state, v: st.systems_v, stable: again.evidence.length === st.evidence.length, heat: st.fa_heat };
  });
  ok(mig.arr && mig.planted === 2 && mig.v === 1 && mig.stable && mig.tol === 30 && mig.state === 'crashing' && mig.heat === 0, `legacy save migrates once (${JSON.stringify(mig)})`);
  // full reload of an old save
  await E(() => { const old = JSON.parse(JSON.stringify(S)); ['leads', 'favours', 'dirt', 'drugs', 'sys', 'systems_v'].forEach(k => delete old[k]); old.evidence = { 'Bob Shitley': 'drugs' }; localStorage.setItem(SAVE_KEY, JSON.stringify(old)); localStorage.setItem('last_loaded_slot', '1'); });
  await p.reload(); await p.waitForTimeout(800);
  await p.click('#ladsGateYes', { timeout: 2000 }).catch(() => {});
  await p.waitForFunction(() => window.S && Array.isArray(S.evidence), null, { timeout: 8000 }).catch(() => {});
  const re = await E(() => window.S && ({ arr: Array.isArray(S.evidence), planted: S.evidence.filter(e => e.kind === 'planted').length, v: S.systems_v }));
  ok(re && re.arr && re.planted === 1 && re.v === 1, `old save reloads and migrates (${JSON.stringify(re)})`);

  console.log('SUMMARY', JSON.stringify(await E(() => window.KSys && KSys.summary())));
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
