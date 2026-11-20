/* ===================== KREPLIN deeper systems: DRUGS =====================
   Sits on top of the existing bag ladder (1-2-3-4 bags, then overdose) in 057/059:
   - tolerance & addiction (S.drugs), decaying when clean; cravings while hooked
   - real states: takeCocaine() now sets S.coke_state buzzed/wired, so the dormant effects in
     049 (bribes x1.15/x1.35, risk) and the 053 crash (morale) actually happen
   - side effects -> evidence; 4am crash texts -> evidence
   - Marco credit: bags/steroids on tick, debt +10%/matchday, called in at awkward moments
   - player doping (steroids from Marco, the doctor's HGH, the season 5 strategy) stacks
     S.fa_heat; maybePlayerDrugScandal() is the FA drug-test roll (2–6 match bans, anyone)
   - DERANGED options are back while high, from a rotating pool (Dodgy stuff menu) */
(function () {
  const K = window.KSys;
  const rint = K.rint;
  const P = (key, pool) => K.pick(key, pool);
  const bagPrice = () => 2500 * (S.season4 && S.season4.cocaine_price_doubled ? 2 : 1);
  const TICK_BAG = 5000, TICK_FEE = 10000, CREDIT_LIMIT = 60000, STEROID_PRICE = 40000;
  K.isHigh = () => !!(window.S && (S.coke_state === 'buzzed' || S.coke_state === 'wired'));

  function syncState(st) {
    S.coke_state = st; S.drugs.state = st;
    if (st === 'sober') { S._coke_bribe_multiplier = 1; S._coke_teamtalk_multiplier = 1; }
  }

  // ---------- use ----------
  const SIDE_EFFECTS = [
    { w: 12, label: 'Nosebleed all over the Echo\'s laptop in the press box', line: "🩸 Your nose goes off like a fire hose in the press box. The Echo's laptop will never be the same. Neither will the Echo.", witness: 'press' },
    { w: 20, label: 'Bag fell out of your blazer during the pre-match handshake (on camera)', line: '📺 A little bag falls out of your blazer during the handshakes. The camera follows it all the way to the floor. So does the referee.', witness: 'press' },
    { w: 15, label: 'Wife found a bag in the glovebox', line: "💔 {wife} finds a bag in the glovebox. You tell her it's \"for the dog\". You don't have a dog. You now have to get a dog.", witness: 'wife', married: true },
    { w: 18, label: "Your kid took 'Daddy's sherbet' to show-and-tell", line: "🏫 The school rings. Your son took \"Daddy's special sherbet\" to show-and-tell. The teacher would like a word. Several words.", witness: 'school', married: true },
    { w: 18, label: 'Heart scare in the directors\' box', line: '💓 Your heart does a drum solo in the directors\' box. A St John Ambulance volunteer says "mate" in a very worried voice. (−£60K private cardiologist)', witness: 'press', heavy: true },
    { w: 10, label: 'Ground your teeth through a gumshield during the anthem', line: '😬 You grind your teeth so hard during the anthem a steward hands you a gumshield. You grind through that too.', witness: null },
  ];
  K.onCokeUsed = function (bags) {
    try {
      if (!window.S) return;
      ensureSystemsState();
      const d = S.drugs;
      bags = Math.max(1, bags | 0);
      d.tolerance = Math.min(100, d.tolerance + 6 * bags);
      d.addiction = Math.min(100, d.addiction + 4 + 3 * bags);
      d.lastUse = S.sys.tick; d.usedThisMatch = true;
      let st = bags >= 2 ? 'wired' : 'buzzed';
      if (d.tolerance >= 70 && st === 'wired') { st = 'buzzed'; logSafe('It barely touches the sides. You need more for less now. That\'s how they get you.'); }
      syncState(st);
      S._coke_crash_morale_penalty = st === 'wired' ? 8 : 6; // the 053 crash reads this
      if (typeof window.applyCocaineStateEffects === 'function') window.applyCocaineStateEffects();
      addEvidence({ kind: 'coke', label: `Took ${bags} bag${bags > 1 ? 's' : ''} before ${K.oppTeam()}`, weight: 3 + 2 * bags, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['drugs'] });
      if (Math.random() < 0.06 + d.tolerance / 300) {
        const pool = SIDE_EFFECTS.filter(x => (!x.married || K.married()) && (!x.heavy || d.tolerance >= 50));
        const fx = pool[Math.floor(Math.random() * pool.length)];
        if (fx) {
          logSafe(K.fill(fx.line));
          if (fx.heavy) S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 60000);
          if (fx.witness === 'wife') { S.wife_love = Math.max(0, (S.wife_love || 60) - 8); S.marital_risk = Math.min(100, (S.marital_risk || 0) + 10); }
          addEvidence({ kind: 'side_effect', label: fx.label, weight: fx.w, witness: fx.witness, tags: ['drugs'] });
        }
      }
      if (typeof updateHUD === 'function') updateHUD();
    } catch (e) { console.error('onCokeUsed', e); }
  };

  // ---------- Marco credit ----------
  K.marcoOnTick = function (bags) {
    ensureSystemsState();
    if ((S.drugs.debt | 0) >= CREDIT_LIMIT) { logSafe(`Marco: "Tab's full, mate. You owe me ${K.fmt(S.drugs.debt)}. I've got a cousin who does kneecaps on tick."`); return false; }
    const owe = bags * TICK_BAG + TICK_FEE;
    S.drugs.debt = (S.drugs.debt | 0) + owe;
    S.inventory.drugs = (S.inventory.drugs | 0) + bags;
    if (!S.stadium_dealing_unlocked) { S.stadium_dealing_unlocked = true; S.cocaine_purchase_matches_ago = 0; S.marco_approach_attempted = false; }
    logSafe(`Marco: "${P('marco_tick', ['Course, mate. On tick. Tick tock.', 'Three bags, one tab, zero questions. Well, one question: where do you live. I know where you live.', 'No worries. I\'ll just write it in my little book. It\'s a big book.', 'Pay me Friday. Not this Friday. A Friday. Soon. Friday.'])}" (+${bags} bags, you owe ${K.fmt(S.drugs.debt)})`);
    addEvidence({ kind: 'debt', label: `Owes Marco ${K.short(S.drugs.debt)} for gear`, weight: 4, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['money'], noLeak: true });
    if (typeof updateHUD === 'function') updateHUD();
    return true;
  };
  K.payMarco = function (amount) {
    amount = Math.min(S.drugs.debt | 0, Math.round(amount));
    if (amount <= 0) return false;
    if (!K.pay(amount)) { logSafe("You pat your pockets. Marco watches you pat your pockets."); return false; }
    S.drugs.debt -= amount;
    if (S.drugs.debt <= 0) { S.drugs.debt = 0; S.drugs.debtWeeks = 0; logSafe(`Marco: "${P('marco_paid', ['Pleasure doing business. Genuinely. You\'re my favourite chairman.', 'Lovely. Clean slate. Dirty everything else.', 'See? Wasn\'t hard. Tell your mates. Not your police mates.'])}"`); }
    else { S.drugs.debtWeeks = Math.max(0, S.drugs.debtWeeks - 2); logSafe(`You pay Marco ${K.fmt(amount)}. Still owe ${K.fmt(S.drugs.debt)}.`); }
    if (typeof updateHUD === 'function') updateHUD();
    return true;
  };
  const AWKWARD = ["outside the board meeting, wearing a club tie he's clearly stolen from the club shop",
    "at the Harvester, halfway through your daughter's birthday, carrying a balloon",
    "in the directors' box, during the minute's silence, quite loudly",
    "on the bonnet of your car at the training ground, eating your sandwiches",
    "at your son's parents' evening, sat at the next desk, nodding along",
    "in the gents at the FA dinner, in the next cubicle, slid under the wall on a phone"];
  const MARCO_ASK = ["u still owe me {amt}. friday was yesterday", "Chairman. Old friend. Old debtor. {amt}. Now would be nice.",
    "My cousin says your left back's got a very nice mum. Anyway, {amt}.", "{amt}, or I tell the Echo what you call the ball when you're on it."];
  async function marcoCollects() {
    const d = S.drugs, debt = d.debt | 0;
    const where = P('marco_where', AWKWARD);
    const ask = K.fill(P('marco_ask', MARCO_ASK), { amt: K.fmt(debt) });
    logSafe(`📱 Marco appears ${where}.`);
    try { if (typeof window.queueIncomingText === 'function') window.queueIncomingText('bookie_marco', ask.replace(/<[^>]+>/g, ''), 'malicious'); } catch (_) {}
    const canAll = (S.chairman_cash || 0) >= debt || (S.club_cash || 0) >= debt;
    const v = await KUI.modal({ title: 'Marco wants his money', portrait: 'marco', variant: 'sinister', dismissible: false,
      html: `<p>Marco appears <i>${K.esc(where)}</i>.</p><p class="k-quote">"${K.esc(ask)}"</p><p class="k-sub">Owed: <b>${K.fmt(debt)}</b> (it was ${K.fmt(Math.round(debt / Math.pow(1.1, Math.max(1, d.debtWeeks))))} once)</p>`,
      actions: [{ id: 'all', label: `Pay it all (${K.short(debt)})`, variant: 'primary', disabled: !canAll },
        { id: 'half', label: `Pay half (${K.short(Math.ceil(debt / 2))})` },
        { id: 'favour', label: 'Offer him "a favour" instead' },
        { id: 'refuse', label: '"Do you know who I am?"', variant: 'bad' }] });
    if (v === 'all') return K.payMarco(debt);
    if (v === 'half') { if (K.payMarco(Math.ceil(debt / 2))) return true; }
    if (v === 'favour') {
      d.debt = Math.round(debt / 2); d.debtWeeks = 0;
      K.addFavour('Marco', 'i_owe', 'Gear debt, "sorted"', { label: 'Marco', dueIn: rint(1, 3), kind: 'marco' });
      logSafe('Marco: "Lovely. I\'ll let you know what. You won\'t like it." He halves the tab and writes FAVOUR in his little book in capitals.');
      return true;
    }
    // refused (or couldn't pay half)
    logSafe('Marco: "Yeah. The bloke who owes me ' + K.fmt(debt) + '."');
    const r = Math.random();
    if (r < 0.4) {
      const take = Math.min(S.chairman_cash || 0, Math.round(debt * 0.6));
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - take);
      S.team_morale_boost = (S.team_morale_boost || 0) - 3;
      d.debt = Math.max(0, debt - take);
      logSafe(`🔨 Two very wide men visit the training ground. They take ${K.fmt(take)} from your wallet and both wing mirrors off the team bus. Team morale −3.`);
      S.police_risk = (S.police_risk | 0) + 3;
    } else if (r < 0.75) {
      logSafe('Marco: "Fair enough." He gets his phone out. He has a lot of journalists in his phone.');
      addEvidence({ kind: 'debt', label: 'Marco told the papers about the gear and the tab', weight: 22, witness: 'bookie_marco', witnessLabel: 'Marco', tags: ['drugs'], forceLeak: true });
    } else {
      K.addFavour('Marco', 'i_owe', 'Refused to pay; he wants "a little favour"', { label: 'Marco', dueIn: 0, kind: 'marco' });
      logSafe('Marco: "Keep your money. I\'ll take a favour. Saturday. Don\'t make plans."');
    }
    d.debtWeeks = 1;
    return false;
  }

  // ---------- doping (players) ----------
  function markDoped(players, kind, heat, label) {
    const t = S.sys.tick;
    players.filter(Boolean).forEach(p => { p.doped = { kind, until: t + 4 }; });
    S.fa_heat = (S.fa_heat | 0) + heat;
    addEvidence({ kind: 'steroid', label, weight: 6 + Math.min(10, players.length * 2), witness: 'doctor', tags: ['doping'] });
  }
  K.steroids = function () {
    ensureSystemsState();
    if (S.preMatch && S.preMatch.sys_steroids) { logSafe('The lads have had enough horse for one week.'); return; }
    const starters = typeof getOurSelectedFive === 'function' ? getOurSelectedFive() : [];
    if (!starters.length) return;
    if (!K.pay(STEROID_PRICE)) {
      if ((S.drugs.debt | 0) >= CREDIT_LIMIT) { logSafe("Marco: \"No cash, no horse, mate.\""); return; }
      S.drugs.debt = (S.drugs.debt | 0) + STEROID_PRICE + TICK_FEE; logSafe(`Marco puts it on the tab. You owe him ${K.fmt(S.drugs.debt)}.`);
    }
    S.preMatch = S.preMatch || {}; S.preMatch.sys_steroids = true;
    S.team_morale_boost = (S.team_morale_boost || 0) + 4;
    logSafe(`💉 ${P('steroid_line', ["Marco arrives with a cool box marked HORSE (BIG). The starting five get a jab each. The left back moos.",
      "The lads are injected in the car park behind a skip. Within minutes the keeper can see sounds.",
      "Marco's \"Romanian vitamins\" go in. The captain does 200 press-ups and then has to sit down and think about his dad."])} (+4 this match, FA heat up)`);
    markDoped(starters, 'steroid', 15, `Marco's horse steroids in ${starters.length} starters`);
  };
  // the doctor's HGH (022 giveHGHToPlayers) and the season 5 doping strategy count too
  GameHooks.on('prematch:end', function () {
    if (!window.S || !Array.isArray(S.squad)) return;
    ensureSystemsState();
    const dosed = S.squad.filter(p => p && (p.hgh_matches_used | 0) > (p._hghSeen | 0));
    dosed.forEach(p => { p._hghSeen = p.hgh_matches_used | 0; });
    if (dosed.length) markDoped(dosed, 'hgh', 8 * dosed.length, `HGH for ${dosed.map(p => p.name).slice(0, 3).join(', ')}${dosed.length > 3 ? '…' : ''}`);
    if (S.preMatch && S.preMatch.season5_doped && !S.preMatch._sysDoped) {
      S.preMatch._sysDoped = true;
      markDoped(typeof getOurSelectedFive === 'function' ? getOurSelectedFive() : [], 'hgh', 12, 'Season 5 "chemical enhancements" for the squad');
    }
    // high: team talks hit harder; crashing: halved
    const b = S.team_morale_boost || 0;
    if (b > 0 && S.coke_state === 'crashing') { S.team_morale_boost = Math.floor(b / 2); logSafe('You give the team talk from the floor of the shower. It lands at about half strength.'); }
    else if (b > 0 && K.isHigh()) S.team_morale_boost = Math.round(b * (S.coke_state === 'wired' ? 1.2 : 1.1));
  });

  // ---------- FA drug tests ----------
  const CLEAN_LINES = ['🧪 FA testers turn up unannounced. They leave with five cups of warm wee and absolutely nothing else.',
    '🧪 Random FA test. Everyone passes. The physio cries with relief, then cries again for unrelated reasons.',
    '🧪 The FA test the squad. All clean. The tester looks at you for a long time and writes something down.'];
  const LEVEL_LINES = ['', '📄 The FA send a warning letter. It has a lot of underlining.', '🔎 The FA move to targeted testing. A man in a lanyard now lives in your car park.',
    '🚨 The FA announce a squad-wide raid. They bring dogs. One of the dogs is also tested.'];
  function positiveFor(p) {
    const t = S.sys.tick;
    if (p.doped && p.doped.until >= t) return p.doped.kind;
    if (S.addiction && (S.addiction[p.name] | 0) >= 1 && Math.random() < 0.7) return 'coke';
    if (S.evidence.some(e => e.kind === 'planted' && e.target === p.name && !e.tested)) return 'planted';
    return null;
  }
  async function testModal(banned) {
    const owed = K.owedToMe();
    const names = banned.map(b => `${b.p.name} (${b.n})`).join(', ');
    const acts = [{ id: 'accept', label: 'Accept the bans', variant: 'primary' },
      { id: 'bribe', label: `Bribe the tester (${K.short(150000)})`, variant: 'warn' }];
    if (owed.length) acts.splice(1, 0, { id: 'favour', label: `Call in ${K.esc(owed[0].label)}: sample "contaminated"` });
    const v = await KUI.modal({ title: 'FA drug test: FAILED', variant: 'sinister', html: `<p>Banned: <b>${K.esc(names)}</b> matches.</p><p class="k-sub">The FA statement uses the word "equine" four times.</p>`, actions: acts });
    const unban = () => banned.forEach(b => { b.p.suspension_games = Math.max(0, (b.p.suspension_games | 0) - b.n); b.p.doping_ban = 0; });
    if (v === 'favour') {
      const f = K.useFavour(owed[0].id);
      unban(); logSafe(`🧪 ${f ? f.label : 'Someone'} makes a call. The lab finds the samples were "contaminated by a sandwich". Bans lifted.`);
    } else if (v === 'bribe') {
      if (!K.pay(150000)) { logSafe('You can\'t raise it. The tester looks almost disappointed.'); return; }
      if (typeof registerBribe === 'function') registerBribe(150000, { who: 'FA tester', label: 'FA drug tester', kind: 'official' });
      if (Math.random() < 0.6) { unban(); logSafe('🧪 The tester re-labels the cups. Your lads are now officially "a bit dehydrated". Bans lifted.'); }
      else { banned.forEach(b => { b.p.suspension_games = (b.p.suspension_games | 0) + 2; }); S.fa_heat += 10; logSafe('🧪 The tester takes the money and reports it. Bans extended by two matches. FA heat up.'); }
    }
    if (typeof ensureValidLineup === 'function') ensureValidLineup();
    if (typeof updateHUD === 'function') updateHUD();
  }
  function runDrugTest() {
    const d = S.drugs, t = S.sys.tick;
    d.lastTest = t;
    const squad = (S.squad || []).filter(p => p && !p.is_dead);
    if (!squad.length) return null;
    let tested;
    if (d.fa_level >= 3) tested = squad.slice();
    else {
      const doped = d.fa_level >= 2 ? squad.filter(p => p.doped && p.doped.until >= t) : [];
      const rest = squad.filter(p => !doped.includes(p)).sort(() => Math.random() - 0.5);
      tested = doped.concat(rest).slice(0, Math.max(3, doped.length));
    }
    if (d.fa_level >= 3) logSafe(LEVEL_LINES[3]);
    const hits = tested.map(p => ({ p, why: positiveFor(p) })).filter(x => x.why);
    if (!hits.length) {
      logSafe(P('test_clean', CLEAN_LINES));
      S.fa_heat = Math.max(0, (S.fa_heat | 0) - 8);
      if (d.fa_level > 0 && S.fa_heat < 20) d.fa_level--;
      return { clean: true, tested: tested.length };
    }
    const banned = [];
    hits.forEach(({ p, why }) => {
      if (why === 'planted') { const e = S.evidence.find(x => x.kind === 'planted' && x.target === p.name && !x.tested); if (e) e.tested = true; }
      if (why === 'coke' || why === 'planted') { S.sys.pendingScandal = p.name; return; } // the written pre-match scandal (053)
      const n = rint(2, 6);
      p.suspension_games = Math.max(p.suspension_games | 0, n); p.doping_ban = n; p.doped = null;
      banned.push({ p, n, why });
      logSafe(`🚫 FA: ${p.name} fails a drug test (${why === 'hgh' ? 'HGH' : 'steroids'}) and is banned for ${n} matches.`);
    });
    if (banned.length) {
      d.fa_level = Math.min(3, d.fa_level + 1);
      if (d.fa_level < 3 && LEVEL_LINES[d.fa_level]) logSafe(LEVEL_LINES[d.fa_level]);
      S.fa_heat = (S.fa_heat | 0) + 10; S.legal_risk = Math.min(100, (S.legal_risk | 0) + 4); S.reputation = Math.max(0, (S.reputation | 0) - 3);
      addEvidence({ kind: 'doping', label: `Failed FA test: ${banned.map(b => b.p.name).join(', ')}`, weight: 12, tags: ['doping'], leaked: true });
      try {
        initPressSystem();
        const b0 = banned[0];
        queueStory(createStory('sports', K.fill(P('ban_hl', ['FA BANS SAINTS STAR {p} IN DOPING SHAME', '{p} BANNED: "I THOUGHT IT WAS PROTEIN," SAYS MAN WITH A MANE', 'SAINTS {p} OUT FOR {n} AFTER TEST FINDS "MOSTLY HORSE"']), { p: b0.p.name.toUpperCase(), n: b0.n }),
          `${b0.p.name} has been banned for ${b0.n} matches after a random test. The club blamed "a contaminated kebab". The kebab shop has released a statement.`, {}, { reputation: -2 }, 'drugtest', 1, ['doping']));
      } catch (_) {}
      if (typeof ensureValidLineup === 'function') ensureValidLineup();
    }
    return { banned, scandal: S.sys.pendingScandal || null, modal: banned.length && window.KUI ? testModal(banned) : null };
  }
  K.runDrugTest = runDrugTest;

  // The FA test roll. Called before kickoff (door, 020; queued scandals, 023; and the systems'
  // prematch events). Once per matchday, at most once every 3 matchdays, chance = fa_heat/200 (≤25%,
  // doubled under targeted testing). force=true runs a test now.
  window.maybePlayerDrugScandal = function maybePlayerDrugScandal(force) {
    try {
      if (!window.S) return null;
      ensureSystemsState();
      const d = S.drugs, t = S.sys.tick;
      if (!force) {
        if (d.lastTestCheck === t) return null;
        d.lastTestCheck = t;
        if (t - d.lastTest < 3) return null;
        const p = Math.min(0.25, (S.fa_heat | 0) / 200) * (d.fa_level >= 2 ? 2 : 1);
        if (Math.random() >= p) return null;
      }
      return runDrugTest();
    } catch (e) { console.error('maybePlayerDrugScandal', e); return null; }
  };
  // the written scandal (053 presentPlayerDrugScandal) goes under the pre-match menu once it is drawn
  GameHooks.on('choices', function (info) {
    if (!window.S || !S.sys || !S.sys.pendingScandal || S.phase !== 'prematch') return;
    if (!/pre-match actions/i.test(String(info && info.prompt || ''))) return;
    const p = (S.squad || []).find(x => x && x.name === S.sys.pendingScandal);
    S.sys.pendingScandal = null;
    if (p && typeof window.presentPlayerDrugScandal === 'function') window.presentPlayerDrugScandal(p);
  });

  // ---------- DERANGED (while high) ----------
  const opp = () => K.oppTeam();
  const der = (line, ev) => { logSafe('DERANGED: ' + K.fill(line)); if (ev) addEvidence(Object.assign({ kind: 'deranged', tags: ['violence'] }, ev)); };
  const DERANGED = [
    { label: "Ring the referee's mum and tell her he's been \"very brave\"", fx() { S.referee_soft_bias = (S.referee_soft_bias || 0) + 10; S.police_risk = (S.police_risk | 0) + 6; der("She cries. She rings him. He rings you, also crying. You'll be getting the penalties.", { label: "Rang the referee's mum at 6am", weight: 9, witness: 'referee' }); } },
    { label: 'Do keepy-uppies with a traffic cone in the centre circle during the warm-up', fx() { S.fan_morale = Math.min(100, (S.fan_morale || 50) + 4); S.reputation = Math.max(0, (S.reputation | 0) - 4); der('The home end chants your name. The away end chants something else. The cone is never found.', { label: 'Pitch invasion with a traffic cone', weight: 8, witness: 'press' }); } },
    { label: 'Phone the opposition manager and just breathe', fx() { S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 12); S.police_risk = (S.police_risk | 0) + 4; der("You breathe down the phone for eleven minutes. He's rattled. He picks two goalkeepers.", { label: 'Heavy-breathing call to the {opp} manager', weight: 8, witness: 'opp_manager' }); } },
    { label: 'Give the team talk entirely in the voice of a horse', fx() { const w = rint(-3, 6); S.team_morale_boost = (S.team_morale_boost || 0) + w; der(w >= 0 ? 'Neigh. NEIGH. They are inspired. Nobody knows why. (+' + w + ')' : 'Neigh. The squad look at the floor. One of them is from a farming family. (' + w + ')'); } },
    { label: 'Buy every pie in the ground and throw them into the away end', fx() { S.club_cash = Math.max(0, (S.club_cash || 0) - 30000); S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 8); der('Four hundred steak bakes rain down on the away fans. Their players are distracted by hunger. (−£30K)', { label: 'Pie bombardment of the away end', weight: 10, witness: 'press' }); } },
    { label: 'Promote the tea lady to Director of Football', fx() { S.board_support = Math.max(0, (S.board_support || 50) - 6); S.team_morale_boost = (S.team_morale_boost || 0) + 3; der('Brenda accepts. Her first act is a 4-4-2 and a biscuit for everyone. The board are livid. The lads love her.'); } },
    { label: 'Text Delmor a photo of your bare chest captioned "COME ON THEN"', fx() { try { window.enqueueRivalText && window.enqueueRivalText('Why have you sent me your tits. Why are they shaved into the club crest. I am forwarding this to everyone I know.'); } catch (_) {} der('Sent. Delivered. Read. Screenshotted.', { kind: 'text', label: 'Topless "COME ON THEN" photo sent to Delmor', weight: 14, witness: 'delmor', witnessLabel: 'Delmor Krunchem', tags: ['sex'] }); } },
    { label: "Lock the away dressing room and post the key to Portugal", fx() { S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 15); S.police_risk = (S.police_risk | 0) + 8; der('{opp} warm up in the car park in their pants. Royal Mail estimate 6–8 weeks for the key.', { label: 'Locked {opp} out of their dressing room', weight: 14, witness: 'opp_manager' }); } },
    { label: 'Hold a minute\'s silence for yourself', fx() { S.team_morale_boost = (S.team_morale_boost || 0) - 2; S.reputation = Math.max(0, (S.reputation | 0) - 3); der('Forty thousand people stand in confused silence. You weep openly. It is, technically, very moving.'); } },
    { label: 'Snort a line off the trophy cabinet, live on the club Instagram', fx() { S.reputation = Math.max(0, (S.reputation | 0) - 6); S.fan_morale = Math.min(100, (S.fan_morale || 50) + 2); der('Eleven thousand likes. One of them is from the Hampshire Constabulary account.', { kind: 'coke', label: 'Line off the trophy cabinet on Instagram Live', weight: 25, witness: 'press', tags: ['drugs'], forceLeak: true }); } },
    { label: 'Challenge the fourth official to an arm wrestle', fx() { if (Math.random() < 0.5) { S.referee_soft_bias = (S.referee_soft_bias || 0) + 5; der('You win. He respects you now. Respect is basically a free kick.'); } else { S.police_risk = (S.police_risk | 0) + 5; der('You lose, then bite him. He does not respect you now.', { label: 'Bit the fourth official', weight: 12, witness: 'referee' }); } } },
    { label: 'Write I AM THE PITCH on the pitch in weedkiller', fx() { S.fan_morale = Math.max(0, (S.fan_morale || 50) - 2); der('It will be visible from space by March. Google Earth has already been in touch.', { label: '"I AM THE PITCH" burned into the pitch', weight: 10, witness: 'press' }); } },
    { label: 'Offer the striker £50K to score with his face', fx() { S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 50000); S.team_morale_boost = (S.team_morale_boost || 0) + 5; der('He shakes on it. He headbutts the ball in training to warm up. He has a little nap afterwards. (−£50K)', { kind: 'bribe', label: 'Cash for face-goals with the striker', weight: 5, tags: ['corruption'] }); } },
    { label: 'Ring Number 10 and ask for "the big red button"', fx() { S.power_heat = Math.min(100, (S.power_heat | 0) + 5); S.police_risk = (S.police_risk | 0) + 3; der("A civil servant says \"not again\" and hangs up. Somewhere a file gets thicker.", { label: 'Rang Number 10 asking for nukes (again)', weight: 10, witness: 'number10', tags: ['corruption'] }); } },
    { label: 'Tell the press officer you are the second coming of Lawrie McMenemy', fx() { S.reputation = Math.max(0, (S.reputation | 0) - 2); S.team_morale_boost = (S.team_morale_boost || 0) + 2; der('He writes it down. It goes on the website. The lads print it on a t-shirt, ironically, then not ironically.'); } },
    { label: 'Sack the mascot and replace him with a real seagull', fx() { S.fan_morale = Math.max(0, (S.fan_morale || 50) - 3); S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 5); der("The seagull takes a chip from the {opp} captain's hand during the coin toss. He never recovers.", { label: 'Seagull incident at the coin toss', weight: 7, witness: 'press' }); } },
  ];
  K.derangedItems = function () {
    // fresh pool each match: two picks, no repeats across recent matches (S.lineMemory)
    S.preMatch = S.preMatch || {};
    if (!Array.isArray(S.preMatch.sys_deranged)) {
      const retired = typeof RETIRED_DERANGED_BUTTON_POOL !== 'undefined' ? RETIRED_DERANGED_BUTTON_POOL.slice(0, 5) : [];
      const pool = DERANGED.concat(retired);
      const a = pool.indexOf(P('deranged', pool));
      let b = pool.indexOf(P('deranged', pool)); if (b === a) b = (a + 1) % pool.length;
      S.preMatch.sys_deranged = S.coke_state === 'wired' ? [a, b] : [a];
    }
    const pool = DERANGED.concat(typeof RETIRED_DERANGED_BUTTON_POOL !== 'undefined' ? RETIRED_DERANGED_BUTTON_POOL.slice(0, 5) : []);
    return S.preMatch.sys_deranged.filter(i => i >= 0 && pool[i]).map(i => ({ key: 'sys_der:' + i, label: 'DERANGED: ' + pool[i].label, variant: 'bad' }));
  };
  K.runDeranged = function (i) {
    const pool = DERANGED.concat(typeof RETIRED_DERANGED_BUTTON_POOL !== 'undefined' ? RETIRED_DERANGED_BUTTON_POOL.slice(0, 5) : []);
    const x = pool[i]; if (!x) return;
    if (S.preMatch && Array.isArray(S.preMatch.sys_deranged)) S.preMatch.sys_deranged = S.preMatch.sys_deranged.filter(j => j !== i);
    try { (x.fx || x.effect).call(x); } catch (e) { console.error('deranged', e); }
    if (!x.fx) addEvidence({ kind: 'deranged', label: 'DERANGED: ' + x.label, weight: 8, tags: ['violence'] });
    if (typeof updateHUD === 'function') updateHUD();
  };

  // ---------- crash: 4am texts ----------
  const CRASH_TEXTS = [
    { to: 'captain', who: () => S.captain_name || 'the captain', sent: 'do u ever think the ball is watching us', reply: 'Gaffer are you ok.' },
    { to: 'captain', who: () => S.captain_name || 'the captain', sent: 'who is the captain of ME', reply: '...You are? Go to sleep chairman.' },
    { to: 'secretary', who: () => S.secretary_name || 'your secretary', sent: 'cancel all my meetings forever. also what is a meeting', reply: "I've booked you a doctor. And a different doctor for backup." },
    { to: 'manager', who: () => (S.manager && S.manager.name) || 'the manager', sent: 'play 11 keepers. trust me. TRUST ME', reply: 'We play five-a-side.' },
    { to: 'secretary', who: () => S.secretary_name || 'your secretary', sent: 'r u awake. im awake. the fridge is awake', reply: "It's 4:12am. Please unplug the fridge and lie down." },
    { to: 'captain', who: () => S.captain_name || 'the captain', sent: 'if we lose saturday i will eat the pitch. not a metaphor', reply: 'Lads group chat: "has anyone got the chairman\'s wife\'s number"' },
  ];
  GameHooks.on('evening', function () {
    if (!window.S || !S.drugs) return;
    if (S.coke_state !== 'crashing' || S.drugs.crashTextTick === S.sys.tick) return;
    S.drugs.crashTextTick = S.sys.tick;
    if (Math.random() > 0.6) return;
    const c = P('crash_text', CRASH_TEXTS);
    logSafe(`📱 4:12am. You text ${c.who()}: "${c.sent}"`);
    logSafe(`📱 ${c.who()} replies at 7am: "${c.reply}" Morale −3. Screenshot saved.`);
    S.team_morale_boost = (S.team_morale_boost || 0) - 3;
    addEvidence({ kind: 'text', label: `4am text to ${c.who()}: "${c.sent}"`, weight: 8, witness: c.to, witnessLabel: c.who(), tags: ['drugs'] });
  });

  // ---------- once per matchday ----------
  GameHooks.on('matchday:end', function () {
    if (!window.S || !S.drugs) return;
    const d = S.drugs;
    d.tolerance = Math.max(0, d.tolerance - 5);
    if (!d.usedThisMatch) d.addiction = Math.max(0, d.addiction - 2);
    d.usedThisMatch = false;
    if (S.coke_state === 'sober' || !S.coke_state) syncState('sober');
    else d.state = S.coke_state;
    if ((d.debt | 0) > 0) { d.debt = Math.round(d.debt * 1.1); d.debtWeeks++; } else d.debtWeeks = 0;
    if (S.fa_heat < 10 && d.fa_level > 0 && Math.random() < 0.3) d.fa_level--;
  });

  // ---------- before kickoff: collections, cravings, tests ----------
  GameHooks.on('prematch:events', async function () {
    if (!window.S || !window.KUI) return;
    ensureSystemsState();
    const d = S.drugs;
    if (S.sys.eventsTick === S.sys.tick) return; // re-entered pre-match for the same fixture
    S.sys.eventsTick = S.sys.tick;
    if ((d.debt | 0) > 0 && d.debtWeeks >= 3 && S.sys.tick - d.lastCollect >= 2 && (d.debtWeeks >= 5 || Math.random() < 0.6)) {
      d.lastCollect = S.sys.tick;
      await marcoCollects();
    }
    if (d.addiction >= 45 && d.lastUse < S.sys.tick - 1 && Math.random() < d.addiction / 150) {
      S.team_morale_boost = (S.team_morale_boost || 0) - 2;
      logSafe(P('crave', ['😰 You sweat clean through your suit in the team photo. The photographer suggests "maybe a darker suit".',
        '😰 Your jaw has been going since Tuesday. The kit man asks if you\'re chewing gum. You are not chewing gum.',
        '😰 You find yourself saving Marco\'s number under "Mum". Then calling it. Twice.']) + ' (craving · morale −2)');
    }
    const r = window.maybePlayerDrugScandal();
    if (r && r.modal) await r.modal;
  });
})();
