/* ===================== KREPLIN deeper systems: CORRUPTION =====================
   Favours ledger (S.favours, both directions), registerBribe() bookkeeping (evidence + an IOU),
   favours you owe called in at the worst moment, favours you're owed called in from the
   "Dodgy stuff" menu, and the Power Network perks that had no buttons:
   Policy favour (+2 for a match, a bureaucrat owes you), Surveillance (exact lead stages and
   sources, Tinder agendas via S.surveillance.tinderReveal, dirt on Delmor and the next
   opponent) and Blackmail (dirt -> a favour; a key opponent really does drop out). */
(function () {
  const K = window.KSys;
  const rint = K.rint;
  const P = (key, pool) => K.pick(key, pool);
  const REFS = ['Ref Dowd', 'Ref Mallory', 'Ref Clattenburg-Smythe', 'Ref Nobby Pike', 'Ref Atkinson-Wolfe', 'Ref Gary "Whistle" Hepple'];

  // ---------- bribes (016 registerBribe calls this) ----------
  K.onBribe = function (amount, info) {
    if (!window.S) return;
    ensureSystemsState();
    info = info || {};
    let who = info.who || 'An official';
    if (info.kind === 'referee' && !info.label) { S.sys.lastRef = S.sys.lastRef || P('ref_name', REFS); who = S.sys.lastRef; }
    const label = info.label || who;
    addEvidence({ kind: 'bribe', label: `Bribed ${label}${amount ? ' (' + K.short(amount) + ')' : ''}`, weight: 5 + Math.min(15, Math.round((amount || 0) / 100000)),
      witness: String(who).toLowerCase(), witnessLabel: label, tags: ['corruption'] });
    if (!info.noFavour) K.addFavour(who, 'owed_to_me', info.origin || `Took your ${K.short(amount || 0)}`, { label, kind: info.kind || 'official' });
  };

  // ---------- call in a favour you're owed ----------
  K.callInFavour = async function (favId) {
    const f = S.favours.find(x => x.id === favId && x.dir === 'owed_to_me');
    if (!f) return;
    const pre = S.phase === 'prematch';
    const act = K.activeLeads();
    const acts = [];
    if (pre) acts.push({ id: 'penalty', label: 'A soft penalty, Saturday' }, { id: 'opp', label: 'Their best player gets "food poisoning"' });
    acts.push({ id: 'document', label: 'A document gets lost' });
    if (act.length) acts.push({ id: 'story', label: `Spike the ${K.esc(act[0].outlet)} story` });
    acts.push({ id: 'keep', label: 'Save it for later' });
    const v = await KUI.modal({ title: `${K.esc(f.label)} owes you`, variant: 'sinister', html: `<p>${K.esc(f.label)} owes you ${f.count}. Origin: <i>${K.esc(f.origin)}</i>.</p><p class="k-sub">What does he do for you?</p>`, actions: acts });
    if (!v || v === 'keep') return;
    K.useFavour(f.id);
    const x = { who: f.label };
    if (v === 'penalty') { S.referee_soft_bias = (S.referee_soft_bias || 0) + 10; logSafe(K.fill(P('fav_pen', ['{who} makes a call. On Saturday a striker will fall over near the box and a whistle will go. Nobody will know why. Everyone will know why.', '{who} "has a word with a man who has a word with a whistle".']), x) + ' (+4 this match)'); }
    else if (v === 'opp') { S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 12); logSafe(K.fill(P('fav_opp', ['{who} sends a prawn ring to the {opp} hotel. Their best player meets it. Then meets the toilet.', "{who} knows a chef. {opp}'s captain eats something \"a bit fizzy\"."]), x)); }
    else if (v === 'document') {
      S.compliance_risk = Math.max(0, (S.compliance_risk | 0) - 10); S.legal_risk = Math.max(0, (S.legal_risk | 0) - 8); S.fa_heat = Math.max(0, (S.fa_heat | 0) - 15); S.police_risk = Math.max(0, (S.police_risk | 0) - 5);
      logSafe(K.fill(P('fav_doc', ['{who} "loses" a file. It is found three weeks later in a pond.', 'A box of evidence marked SOUTHAMPTON is accidentally shredded by {who}, who then shreds the shredder.']), x));
    } else if (v === 'story' && act[0]) { K.endLead(act[0], 'killed', `${f.label} called in a favour`); logSafe(K.fill('{who} has a word. The story goes in a drawer, the drawer goes in a skip, the skip goes to Portsmouth.', x)); }
    if (typeof updateHUD === 'function') updateHUD();
  };

  // ---------- favours you owe: called in at the worst moment ----------
  const ASKS = {
    marco: [
      { text: "My cousin Dean's starting at left back Saturday. He's very fast. In a car.", yes: 'Start Dean (−4 this match)', fx() { S.team_morale_boost = (S.team_morale_boost || 0) - 4; logSafe('Dean starts. He spends the first half on his phone and the second half in the stands with his mum.'); } },
      { text: "Lend us the team minibus Saturday night. Don't ask what for. Don't look in it Sunday.", yes: 'Hand over the keys', fx() { S.police_risk = (S.police_risk | 0) + 6; addEvidence({ kind: 'favour', label: 'Lent Marco the team minibus (it came back lower)', weight: 10, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['drugs'], noLeak: true }); logSafe('The minibus comes back Sunday sitting very low on its suspension, smelling of fish and petrol.'); } },
      { text: "I've got a stall at the turnstiles Saturday. Tell your stewards I'm \"club catering\".", yes: 'Tell the stewards', fx() { S.police_risk = (S.police_risk | 0) + 4; S.club_cash = (S.club_cash || 0) + 20000; logSafe('Marco sells "club catering" at gate 4. The pies are unusually popular. +£20K "concession fee".'); } },
    ],
    hollis: [
      { text: "The PM's nephew Tarquin is \"very keen on football\". He'll be starting Saturday, yes?", yes: 'Start Tarquin (−4 this match)', fx() { S.team_morale_boost = (S.team_morale_boost || 0) - 4; logSafe("Tarquin starts. He asks the referee if there's a lunch break. There isn't. He has lunch anyway."); } },
      { text: 'The minister needs a "photo opportunity". In your dugout. During the match. With his dog.', yes: 'Fine. The dog too.', fx() { S.fan_morale = Math.max(0, (S.fan_morale || 50) - 4); logSafe('The minister waves at the cameras for 90 minutes. The dog does a poo in the technical area. Fans −4.'); } },
    ],
    number10: [
      { text: 'Number 10 would like the club to sign the Home Secretary\'s nephew. He is "a creative midfielder" and also nine.', yes: 'Sign him (−£500K)', fx() { S.club_cash = (S.club_cash || 0) - 500000; logSafe('You sign Oliver, 9. His agent is his mum. His agent is very good. (−£500K)'); } },
    ],
    generic: [
      { text: '{who} wants the whole squad to wash his car. And his brother\'s car. And a van.', yes: 'Send the lads (−2 morale)', fx() { S.team_morale_boost = (S.team_morale_boost || 0) - 2; logSafe('The lads wash three cars and a van on Thursday. The captain does the alloys while staring into the middle distance.'); } },
      { text: '{who} would like "a box at the next home game for some associates". The associates have no names.', yes: 'Give them the box', fx() { S.police_risk = (S.police_risk | 0) + 3; logSafe('Your exec box is taken over by six men in identical coats who never watch the football.'); } },
    ],
  };
  const REFUSED = ['{who}: "Right. Noted." That\'s all. That\'s worse.', '{who} hangs up. Then rings back to say "hm". Then hangs up again.', '{who}: "You\'ll regret that. Not now. But you will. Probably on a Tuesday."'];
  async function favourCalledIn(f) {
    const pool = ASKS[f.kind] || ASKS[f.who] || ASKS.generic;
    const ask = P('ask_' + (f.kind || 'g'), pool);
    const portrait = f.kind === 'marco' ? 'marco' : null;
    const v = await KUI.modal({ title: `${K.esc(f.label)} is calling in a favour`, portrait, variant: 'sinister', dismissible: false,
      html: `<p class="k-quote">"${K.esc(K.fill(ask.text, { who: f.label }))}"</p><p class="k-sub">You owe ${K.esc(f.label)} for: <i>${K.esc(f.origin)}</i>.</p>`,
      actions: [{ id: 'yes', label: ask.yes, variant: 'primary' }, { id: 'no', label: 'Refuse', variant: 'bad' }] });
    if (v === 'yes') { try { ask.fx(); } catch (e) { console.error(e); } K.useFavour(f.id); }
    else {
      K.useFavour(f.id);
      logSafe(K.fill(P('fav_refused', REFUSED), { who: f.label }));
      addEvidence({ kind: 'favour_refused', label: `Refused ${f.label} a favour (${f.origin})`, weight: rint(16, 22), witness: f.who, witnessLabel: f.label, tags: [f.kind === 'marco' ? 'drugs' : 'corruption'] });
    }
    if (typeof updateHUD === 'function') updateHUD();
  }
  GameHooks.on('prematch:events', async function () {
    if (!window.S || !window.KUI || !S.sys) return;
    const t = S.sys.tick;
    if (S.sys.favourCallTick === t) return;
    const due = K.iOwe().filter(f => f.dueBy != null && f.dueBy <= t);
    if (!due.length) return;
    const overdue = due.find(f => t - f.dueBy >= 2);
    if (!overdue && Math.random() >= 0.35) return;
    S.sys.favourCallTick = t;
    await favourCalledIn(overdue || due[0]);
  });

  // ---------- Power Network perks ----------
  const DELMOR_DIRT = [
    { label: "Delmor's offshore account in the Caymans is called \"POMPEY PENSION POT (NOT A CRIME)\"", hl: 'POMPEY CHIEF\'S SECRET ISLAND MILLIONS' },
    { label: 'Delmor has a tattoo of his own face on his own back', hl: 'DELMOR: THE TATTOO. THE FACE. THE OTHER FACE.' },
    { label: 'Delmor was fined in 2009 for "riding a mobility scooter into a Wetherspoons on purpose"', hl: 'KRUNCHEM\'S SCOOTER RAMPAGE SHAME' },
    { label: 'Delmor paid a Pompey ballboy to cry on camera after every home defeat', hl: 'CRYGATE: DELMOR\'S PAID TEARS' },
    { label: "Delmor's tax return lists his occupation as \"Warlord (Hobby)\"", hl: 'POMPEY CHIEF IN "WARLORD" TAX PROBE' },
  ];
  const OPP_DIRT = ['{opp} keeper photographed in a Wetherspoons with Delmor\'s wife', "{opp} captain's \"charity\" is a boat", "{opp} manager's agent is also his barber, landlord and dad",
    "{opp} striker failed his driving test eleven times and drives anyway, in a Lamborghini, on the pavement"];
  K.onPolicyFavour = function () { ensureSystemsState(); K.addFavour('A bureaucrat', 'owed_to_me', 'Policy favour (Power Network)', { label: 'A bureaucrat in Whitehall', kind: 'official' }); };
  K.onPowerPerk = function (id) {
    ensureSystemsState();
    if (id === 'perk-emergency-points') K.addFavour('Number 10', 'i_owe', 'Three emergency league points', { label: 'Number 10', kind: 'number10', dueIn: rint(2, 4) });
    if (id === 'perk-transfer-act') K.addFavour('Minister Hollis', 'i_owe', 'The Transfer Powers Act', { label: 'Minister Hollis', kind: 'hollis', dueIn: rint(2, 4) });
    if (id === 'perk-enter-number10') K.addFavour('the Home Office', 'i_owe', 'A key to the back room at Number 10', { label: 'the Home Office', kind: 'number10', dueIn: rint(3, 5) });
  };
  K.onSurveillance = function () {
    ensureSystemsState();
    const t = S.sys.tick;
    S.sys.surveillanceUntil = Math.max(S.sys.surveillanceUntil, t) + 5;
    S.surveillance = { active: true, until: S.sys.surveillanceUntil, tinderReveal: true };
    const d = P('delmor_dirt', DELMOR_DIRT);
    K.addDirt('delmor', d.label, 20, 'Delmor').headline = d.hl;
    const opp = K.oppTeam();
    K.addDirt('opp:' + opp, K.fill(P('opp_dirt', OPP_DIRT), { opp }), 12, opp);
    logSafe(`🕵️ The detectives report back. On Delmor: <i>${K.esc(d.label)}</i>. On ${K.esc(opp)}: something you can use.`);
    K.activeLeads().forEach(l => logSafe(`🕵️ ${K.esc(l.journalist)} (${K.esc(l.outlet)}) — stage ${l.stage + 1}/4, ${l.progress}%. Source: <b>${K.esc(l.sourceLabel)}</b>.`));
    if (typeof updateHUD === 'function') updateHUD();
  };
  K.onBlackmail = function () { ensureSystemsState(); S.sys.blackmailKit = true; };
  // dirt -> a favour they owe you (Blackmail perk)
  K.blackmailWithDirt = function (dirtId) {
    const d = S.dirt.find(x => x.id === dirtId && !x.used); if (!d) return null;
    d.used = true;
    S.police_risk = (S.police_risk | 0) + 3;
    const f = K.addFavour(d.onLabel, 'owed_to_me', `Blackmail: ${d.label}`, { label: d.onLabel, kind: 'blackmail' });
    logSafe(`📸 You show ${K.esc(d.onLabel)} what you've got. A long silence. "What do you want?" (${K.esc(d.onLabel)} owes you one · police risk +3)`);
    addEvidence({ kind: 'bribe', label: `Blackmailed ${d.onLabel}`, weight: 9, witness: String(d.on), witnessLabel: d.onLabel, tags: ['corruption'] });
    return f;
  };
  // "Someone important will mysteriously drop out before kickoff" (017) now happens
  const DROPOUT = ['{p} develops "a hamstring" the moment he sees the photo. {opp} start their 16-year-old.',
    "{p} rings in sick with \"the Wetherspoons thing\". {opp}'s physio has to play.",
    '{p} is "unavailable for personal reasons". The personal reasons are in an envelope on his windscreen.',
    "{p} won't leave the team hotel. He has barricaded the door with a trouser press."];
  GameHooks.on('prematch:end', function () {
    if (!window.S || !S.power_blackmail_pending) return;
    ensureSystemsState();
    S.power_blackmail_pending = false;
    const opp = K.oppTeam();
    let star = null; try { star = (getOppSelectedFive() || [])[0]; } catch (_) {}
    const name = (star && star.name) || `${opp}'s keeper`;
    const dirt = K.freeDirt('opp:' + opp)[0];
    if (dirt) dirt.used = true;
    S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - (dirt ? 25 : 20));
    S.police_risk = (S.police_risk | 0) + 3;
    logSafe(`📸 BLACKMAIL: ${K.fill(P('dropout', DROPOUT), { p: name, opp })} (${opp} weakened this match)`);
    K.addFavour(name, 'owed_to_me', `Blackmail (${opp})`, { label: `${name} (${opp})`, kind: 'blackmail' });
  });
  GameHooks.on('matchday:end', function () {
    if (!window.S || !S.sys || !S.surveillance) return;
    if (S.surveillance.active && S.sys.surveillanceUntil < S.sys.tick) { S.surveillance.active = false; S.surveillance.tinderReveal = false; logSafe('🕵️ The private detectives go home. They leave a van and a very full bottle.'); }
  });

  // ---------- "Dodgy stuff…" menu items (022 dodgyStuffItems) ----------
  K.dodgyItems = function () {
    if (!window.S) return [];
    ensureSystemsState();
    const out = [];
    const dq = window.KDrugQuick;
    const drugsOn = dq && dq.available();
    if (drugsOn) {
      if ((S.drugs.debt | 0) < 60000) out.push({ key: 'sys_tick', label: `Get 3 bags from Marco on tick (+${K.short(25000)} on the tab)` });
      if ((S.drugs.debt | 0) > 0) out.push({ key: 'sys_paymarco', label: `Pay Marco (tab: ${K.short(S.drugs.debt)})` });
      if (!(S.preMatch && S.preMatch.sys_steroids)) out.push({ key: 'sys_steroids', label: "Marco's horse steroids for the starting five (£40K)", variant: 'bad' });
      if (S.drugs.addiction >= 50 && !K.isHigh() && (S.inventory.drugs | 0) === 0) out.push({ key: 'sys_crave', label: 'Ring Marco. Just ring him. Just to talk.', variant: 'bad' });
    }
    if (K.isHigh()) out.push(...K.derangedItems());
    const owed = K.owedToMe();
    if (owed.length) out.push({ key: 'sys_callin', label: `Call in a favour (${owed.reduce((a, f) => a + f.count, 0)} owed to you)` });
    if (S.sys.blackmailKit && K.freeDirt().length) out.push({ key: 'sys_blackmail', label: 'Blackmail someone with your dirt', variant: 'bad' });
    return out;
  };
  K.handleDodgy = async function (k) {
    try {
      if (k === 'sys_tick') K.marcoOnTick(3);
      else if (k === 'sys_paymarco') {
        const v = await KUI.modal({ title: 'Pay Marco', portrait: 'marco', html: `<p>Tab: <b>${K.fmt(S.drugs.debt)}</b>. Growing 10% a matchday.</p>`,
          actions: [{ id: 'all', label: `All of it (${K.short(S.drugs.debt)})`, variant: 'primary' }, { id: 'half', label: `Half (${K.short(Math.ceil(S.drugs.debt / 2))})` }, { id: 'no', label: 'Not today' }] });
        if (v === 'all') K.payMarco(S.drugs.debt); else if (v === 'half') K.payMarco(Math.ceil(S.drugs.debt / 2));
      }
      else if (k === 'sys_steroids') K.steroids();
      else if (k === 'sys_crave') { if (K.marcoOnTick(1) && window.KDrugQuick && KDrugQuick.canTake()) KDrugQuick.take(); }
      else if (k.startsWith('sys_der:')) K.runDeranged(+k.slice(8));
      else if (k === 'sys_callin') {
        const owed = K.owedToMe();
        const v = owed.length === 1 ? owed[0].id : await KUI.modal({ title: 'Who owes you?', variant: 'sinister', html: '<p>Pick your IOU.</p>',
          actions: owed.slice(0, 6).map(f => ({ id: f.id, label: `${K.esc(f.label)} ×${f.count}` })).concat([{ id: 'x', label: 'Never mind' }]) });
        if (v && v !== 'x') await K.callInFavour(v);
      }
      else if (k === 'sys_blackmail') {
        const dirt = K.freeDirt();
        const v = await KUI.modal({ title: 'Blackmail', variant: 'sinister', html: '<p>Turn dirt into a favour they owe you.</p>',
          actions: dirt.slice(0, 5).map(d => ({ id: d.id, label: `${K.esc(d.onLabel)}: ${K.esc(d.label.slice(0, 48))}…` })).concat([{ id: 'x', label: 'Not yet' }]) });
        if (v && v !== 'x') K.blackmailWithDirt(v);
      }
    } catch (e) { console.error('handleDodgy', k, e); }
    if (typeof updateHUD === 'function') updateHUD();
  };
})();
