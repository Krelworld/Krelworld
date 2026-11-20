/* ===================== KREPLIN deeper systems: PRESS (leads, kill, bury) =====================
   Content + UI for S.leads (see 087n-sys-backbone). Countdown is vague tabloid hints unless the
   Surveillance perk is running (owner decision 3): then exact stage, % and source are shown.
   Kill: bribe the editor / threaten the source / super-injunction / call in a favour.
   Bury: feed the paper dirt on Delmor (or whoever you have dirt on); Delmor retaliates later. */
(function () {
  const K = window.KSys;
  const rint = K.rint;
  const P = (key, pool) => K.pick(key, pool);

  // ---------- the hacks ----------
  const JOURNALISTS = [
    { name: 'Lucy Phelps', outlet: 'Southern Daily Echo', likes: ['drugs', 'money', 'misc', 'corruption'] },
    { name: 'Dom Starkey', outlet: 'The Sun', likes: ['sex', 'drugs', 'violence'] },
    { name: 'Bev Mallard', outlet: 'Daily Star', likes: ['violence', 'sex', 'misc'] },
    { name: 'Gideon Forsyth-Pratt', outlet: 'The Guardian', likes: ['corruption', 'money'] },
    { name: 'Tony "Bins" Bindon', outlet: 'Sunday Sport', likes: ['sex', 'drugs', 'misc'] },
    { name: 'Priya Okafor', outlet: 'The Athletic', likes: ['doping', 'corruption'] },
    { name: 'Rupert Knowle', outlet: 'Private Eye', likes: ['corruption', 'money', 'doping'] },
  ];
  const HEADLINES = {
    drugs: ["SAINTS SUPREMO'S SNOW DAY", "{chair}: 'I AM THE PITCH'", "CHAIRMAN'S NOSE 'LIKE A HOOVER IN A FLOUR MILL'",
      "COKED-UP {chair} TRIED TO SIGN A SEAGULL", "{chair}'S OFFICE 'BASICALLY A COLOMBIAN SKI RESORT'",
      "WHITE LINES, RED STRIPES: INSIDE {chair}'S 4AM TEAM TALKS", "{chair} HAD 'A LITTLE SNIFF' BEFORE KICK-OFF. AND AT HALF-TIME. AND DURING THE MINUTE'S SILENCE"],
    sex: ["{chair}'S SECRET PHONE: 'ARE YOU IN THE GAME?'", "SAINTS CHIEF IN EXEC BOX ROMP SHAME", "'HE MADE ME CALL HIM GAFFER': KISS AND TELL",
      "CHAIRMAN'S 3AM TEXTS: 'I AM A FOOTBALL GOD AND ALSO VERY LONELY'", "{chair} SEXTS LEAKED: 'THE SHIN PADS STAY ON'",
      "{chair}: 'I'VE GOT A BIGGER STADIUM THAN DELMOR' — WE'VE SEEN THE PHOTOS, HE HASN'T"],
    corruption: ["BROWN ENVELOPES AT ST MARY'S", "REF IN {chair} GREGGS VOUCHER PROBE", "{chair}'S BUNG BONANZA: 'IT'S CALLED NETWORKING'",
      "SAINTS CHIEF 'PAID OFFICIALS IN MEAL DEALS'", "NUMBER 10 AND THE SOUTHAMPTON BRIEFCASE", "{chair} KEEPS A LINESMAN IN HIS GARAGE, CLAIM NEIGHBOURS"],
    doping: ["SAINTS ON THE GEAR: STRIKER 'HAS FOUR NIPPLES NOW'", "HORSE PILLS AT ST MARY'S", "{chair}'S JUICED-UP JUGGERNAUTS",
      "FA PROBE: 'THEIR LEFT BACK SWEATS GRAVY'", "PUMPED: SAINTS SQUAD BENCH-PRESSED THE TEAM BUS", "SAINTS KEEPER'S NECK NOW WIDER THAN HIS HEAD"],
    violence: ["MADMAN {chair} IN COFFEE ATTACK", "CHAIRMAN THREATENED KIT MAN WITH A STAPLER", "{chair} 'HEADBUTTED A LOCKER, THEN APOLOGISED TO IT'",
      "RAGE AT ST MARY'S: SAINTS CHIEF GOES FULL GORILLA", "{chair} BIT A MASCOT, SAY WITNESSES (THE MASCOT IS FINE) (THE MAN INSIDE IS NOT)"],
    money: ["{chair} OWES DRUG DEALER 'MORE THAN THE WAGE BILL'", "SAINTS CHIEF'S DEBT TO A MAN CALLED MARCO", "CLUB CARD USED AT HARVESTER 41 TIMES IN ONE WEEK",
      "{chair}'S ACCOUNTANT FOUND WEEPING IN A LAYBY"],
    misc: ["{chair}: WHAT IS HE HIDING?", "SAINTS CHAIRMAN 'SEEN DOING SOMETHING WEIRD BY THE BINS'", "THE TRUTH ABOUT {chair} (IT'S BAD)"],
  };
  const BODIES = {
    drugs: ["A source close to the club describes the chairman's office as \"basically a Colombian ski resort\". \"He offered the tea lady a key,\" they said. \"Not a door key.\"",
      "Staff say the chairman has started holding board meetings standing on the table. \"He calls it the high ground,\" said one. \"He does not come down for hours.\""],
    sex: ["{journalist} has seen the messages. \"He signs off every text with the club crest emoji,\" says the source. \"Even the ones about his mum.\"",
      "The texts, sent between 2am and 4am, include the phrase \"you're my number 10\" eleven times and a voice note of him doing the Match of the Day theme with his mouth."],
    corruption: ["Documents seen by {outlet} show payments to match officials described as \"consultancy (vibes)\" and \"petrol money for a very long drive\".",
      "One official is said to have received a hamper containing a Rolex, a Toby Carvery gift card and a handwritten note: \"you know what for x\"."],
    doping: ["Players have reportedly been given injections labelled \"FOR HORSES (BIG ONES)\". One substitute is said to have warmed up by pulling the team bus round the car park.",
      "A source in the dressing room claims a midfielder now has to turn sideways to get through the tunnel and cries at adverts."],
    violence: ["Witnesses say the chairman entered the dressing room \"like a Viking who'd lost a bet\" and left it with a stapler, a mop and somebody's dentures.",
      "Club staff have been issued with a laminated card titled WHAT TO DO IF HE DOES IT AGAIN."],
    money: ["Creditors include a payday lender, a man called Marco, a different man also called Marco, and the Harvester.",
      "Sources say the club's petty cash tin now contains a single IOU written in eyeliner."],
    misc: ["Nobody will say what it is. Everybody says it's bad. One steward simply pointed at the sky and walked into the sea."],
  };
  const STAGE_HINTS = [
    ["A hack from the {outlet} has been seen going through the bins behind the West Stand.", "Someone from the {outlet} keeps ringing the club shop asking \"is the chairman in, and is he… in?\"",
      "Word in the press box: the {outlet} is \"sniffing round\". Unfortunate choice of words.", "{journalist} followed you into the gents and didn't use them."],
    ["The {outlet} has \"a source close to the club\". The club is not that big.", "{journalist} has bought somebody at the club a very long lunch. Three courses. Two bottles.",
      "A photographer from the {outlet} is living in the hedge opposite your house. He's put up a little flag."],
    ["{journalist} has rung the press office for \"a comment, any comment, please, honestly anything\".", "The {outlet} lawyers have been seen laughing in a Pret.",
      "Your PR man has gone pale and keeps saying \"right\" very quietly to himself."],
    ["The {outlet} has cleared its front page. It's you. It's you on it.", "{journalist} has texted you a smiley face. Just the face. Nothing else.",
      "The {outlet} subs are workshopping puns on your surname. They've found a good one."],
  ];
  const VAGUE_WHEN = { 1: 'Could run any day now', 2: 'Word is it\'s close', 3: 'Still sniffing about' };
  const SOURCE_POOL = ['the kit man', 'a steward with a grudge', 'the club chef', 'your driver', 'a groundsman called Phil', 'the woman who does the half-time raffle', 'a mascot (Sammy, probably)'];
  const SPONSORS = ['Bargain Bathrooms', "Kev's Kebabs & Mortgages", 'Wessex Payday Loans', 'Southampton Discount Coffins', "Big Dave's Tyres", "Nan's Bingo Online", 'Solent Vape Barn'];
  const SPONSOR_LINES = ["Sponsor <b>{sp}</b> pulls out (−{amt}). Statement: \"We were a family business. Now we're a family business that's been on the news.\"",
    "<b>{sp}</b> end their deal (−{amt}). Their CEO says he'll \"have to explain this to his kids, and he's just had to explain what bung means\".",
    "<b>{sp}</b> take their logo off the shirts (−{amt}). They've had it replaced with a picture of their logo looking away."];
  const MARRIAGE_LINES = ["{wife} changes the Wi-Fi password.", "{wife} reads it out at breakfast. She does your voice. She does it well.",
    "{wife} has started sleeping with the light on and a cricket bat.", "{wife} cuts the article out and sticks it on the fridge with a magnet shaped like Portugal."];

  K.content = {
    journalist(theme) {
      const fits = JOURNALISTS.filter(j => j.likes.includes(theme));
      const busy = new Set(K.activeLeads().map(l => l.journalist));
      const pool = fits.filter(j => !busy.has(j.name)).concat(fits.length ? [] : JOURNALISTS);
      const j = (pool.length ? pool : JOURNALISTS)[Math.floor(Math.random() * (pool.length || JOURNALISTS.length))];
      return { name: j.name, outlet: j.outlet };
    },
    headline(theme) { return K.fill(P('hl_' + theme, HEADLINES[theme] || HEADLINES.misc)); },
    body(lead) {
      const ev = lead.evidenceIds.map(id => S.evidence.find(e => e.id === id)).filter(Boolean);
      const facts = ev.slice(0, 3).map(e => '• ' + e.label).join('\n');
      return K.fill(P('body_' + lead.theme, BODIES[lead.theme] || BODIES.misc), { journalist: lead.journalist, outlet: lead.outlet })
        + (facts ? '\n' + facts : '') + `\nThe club said: "No comment." The chairman said: "Which one?"`;
    },
    sourceLabel(witness) {
      const map = { bookie_marco: 'Marco', marco: 'Marco', doctor: 'the club doctor', press: 'a man from the press box', school: "your kid's school", referee: 'the referee', opp_manager: 'their manager', number10: 'a Downing Street aide', secretary: (S.secretary_name || 'your secretary'), captain: (S.captain_name || 'the captain'),
        captain_wife: (S.captain_wife_name || "the captain's wife"), wife: (S.wife_name || 'your wife'), delmor: 'Delmor Krunchem' };
      return map[witness] || witness || P('src', SOURCE_POOL);
    },
    sponsorLine(loss) { return K.fill(P('sponsor', SPONSOR_LINES), { sp: P('sponsorName', SPONSORS), amt: K.short(loss) }); },
    marriageLine() { return K.fill(P('marr', MARRIAGE_LINES)); },
  };

  // ---------- presentation ----------
  const theThe = t => String(t).replace(/\b([Tt]he) The\b/g, '$1');
  K.leadHint = lead => theThe(K.fill(P('hint' + lead.stage, STAGE_HINTS[lead.stage] || STAGE_HINTS[0]), { outlet: lead.outlet, journalist: lead.journalist }));
  K.leadWhen = lead => {
    if (lead.status !== 'active') return lead.status === 'published' ? 'Published' : lead.status === 'killed' ? 'Killed' : 'Buried';
    if (K.surveillanceOn()) return `Stage ${lead.stage + 1}/4 (${SYS_STAGE_NAMES[lead.stage]}) · ${lead.progress}% · runs in ${lead.runsIn} match${lead.runsIn === 1 ? '' : 'es'}`;
    return VAGUE_WHEN[Math.min(3, lead.runsIn || 3)];
  };
  K.leadSource = lead => K.surveillanceOn() ? `Source: <b>${K.esc(lead.sourceLabel)}</b>` : 'Source: "close to the club"';
  K.leadCardHtml = function (lead, intro) {
    const tone = lead.status !== 'active' ? 'done' : lead.runsIn <= 1 ? 'hot' : lead.runsIn === 2 ? 'warm' : 'cold';
    const head = lead.status === 'active' && !K.surveillanceOn() && lead.stage < 2 ? 'SOMETHING ABOUT THE CHAIRMAN' : lead.headline;
    return `<div class="k-lead ${tone}" data-lead="${lead.id}"><div class="mast">${K.esc(lead.outlet.toUpperCase())}<span>${K.esc(lead.journalist)}</span></div>`
      + (intro ? `<p class="k-lead-intro">${intro}</p>` : '')
      + `<h4>${K.esc(head)}</h4><p>${K.esc(lead.hint || K.leadHint(lead))}</p>`
      + `<div class="k-lead-meta"><span class="when">${K.esc(K.leadWhen(lead))}</span><span>${K.leadSource(lead)}</span></div>`
      + (lead.status === 'active' ? `<button class="k-lead-btn" type="button" onclick="KSys.openLead('${lead.id}')">Deal with it ›</button>` : '') + `</div>`;
  };
  K.leadCard = function (lead, why) {
    lead.hint = K.leadHint(lead);
    const intro = why === 'new' ? '📰 A story is brewing.' : null;
    try { log(K.leadCardHtml(lead, intro)); } catch (_) {}
    if (why === 'new') { try { window.KUI && KUI.toast(`📰 ${lead.outlet} is sniffing round`, 'warn', 3500); } catch (_) {} }
  };

  // ---------- kill / bury ----------
  K.editorPrice = lead => Math.round((150000 + K.leadWeight(lead) * 10000) / 10000) * 10000;
  K.injunctionPrice = lead => 1200000 + K.leadWeight(lead) * 20000;
  K.threatOdds = function (lead) {
    let p = K.surveillanceOn() ? 0.6 : 0.35;
    if (lead.source === 'bookie_marco' && (S.drugs.debt | 0) > 0) p -= 0.15;
    if (K.owedToMe().some(f => f.who === String(lead.source || '').toLowerCase())) p += 0.25;
    if (S.coke_state === 'wired' || S.coke_state === 'buzzed') p += 0.1;
    return Math.max(0.1, Math.min(0.85, p));
  };
  const OUT = {
    bribeOk: ["The editor counts it twice, says \"what story?\" and puts a crossword where you used to be.",
      "The editor accepts on condition you never ring him again. Then rings you to say thanks.",
      "The story is spiked. The editor buys a jet ski. He names it after you, which is a risk."],
    bribeFail: ["The editor takes the money AND runs the story. He adds a paragraph about the money.",
      "\"Are you trying to BRIBE the {outlet}?\" He's recording. He was always recording."],
    threatOk: ["You explain to {src} what a \"hypothetical brick\" is. {src} remembers nothing. Not even their own postcode.",
      "{src} receives a fruit basket. Every fruit has a little face drawn on it. Every face is crying. They withdraw the story.",
      "You sit outside {src}'s house in your car with the engine running for six hours. It works. Also you need petrol."],
    threatFail: ["{src} goes straight to {journalist} with a new paragraph: CHAIRMAN THREATENED ME.",
      "{src} records the whole thing on a Ring doorbell. You did a little dance at the end for some reason."],
    injunction: ["A judge in a wig grants the super-injunction over a lunch you paid for. Nobody may say what you did. Everybody may guess.",
      "Your lawyers gag the {outlet}. The {outlet} prints a blank page with a little drawing of a gag on it."],
    favour: ["{who} makes a call. The story goes in a drawer, the drawer goes in a skip, the skip goes to Portsmouth.",
      "{who} \"has a word\". {journalist} is reassigned to the gardening section. She is furious. Her tomatoes are worse."],
    bury: ["You slip {journalist} a brown envelope labelled DELMOR. Your story drops to page 38, under the bingo.",
      "{journalist} reads the Delmor file, says \"oh my God\" eleven times, and forgets you exist."],
  };
  const GAGGED = { hl: ["WHO IS THE GAGGED FOOTBALL CHAIRMAN?", "CHAIRMAN GAGS PAPER. WE CAN'T SAY WHO. HE'S FROM SOUTHAMPTON."],
    body: "We cannot tell you which Premier League chairman has spent seven figures stopping us telling you what he did. We can tell you he's from Southampton, rhymes with {Chair}, and was seen buying four litres of nasal spray." };
  const DELMOR_REVENGE = ["Lovely little story you planted, you snivelling cunt. Check your car. Actually don't, it's on fire.",
    "You fed the papers MY business? I've sent your wife some flowers. From you. With a card that says 'sorry about the rash'.",
    "Page 3 of the Echo, me. Page 1 tomorrow, you. I've got a man in the print room and a man in your bins.",
    "Enjoy your little burial. I've told every ref in the south that you call them 'Shrek with a whistle'."];

  function say(pool, key, x) { const t = theThe(K.fill(P(key, pool), x)); try { log(t); } catch (_) {} return t; }

  K.killLead = async function (lead, how) {
    const x = { outlet: lead.outlet, journalist: lead.journalist, src: lead.sourceLabel, who: '' };
    if (how === 'bribe') {
      const cost = K.editorPrice(lead);
      const src = K.pay(cost);
      if (!src) { KUI.toast("You can't raise it. The editor laughs down the phone.", 'bad'); return 'nofunds'; }
      if (typeof registerBribe === 'function') registerBribe(cost, { who: `${lead.outlet} editor`, label: `Editor, ${lead.outlet}`, kind: 'editor', noFavour: true });
      const ok = Math.random() < (0.85 * Math.min(1.15, S._coke_bribe_multiplier || 1));
      if (ok) { say(OUT.bribeOk, 'k_bribeok', x); K.endLead(lead, 'killed', `Editor paid ${K.short(cost)}`); return 'killed'; }
      say(OUT.bribeFail, 'k_bribefail', x); lead.progress = Math.min(99, lead.progress + 25); lead.extraWeight = (lead.extraWeight | 0) + 10; return 'failed';
    }
    if (how === 'threat') {
      const ok = Math.random() < K.threatOdds(lead);
      S.police_risk = (S.police_risk | 0) + (ok ? 2 : 5);
      if (ok) { say(OUT.threatOk, 'k_threatok', x); K.endLead(lead, 'killed', `Leaned on ${lead.sourceLabel}`); return 'killed'; }
      say(OUT.threatFail, 'k_threatfail', x);
      const ev = addEvidence({ kind: 'threat', label: `Threatened ${lead.sourceLabel} over a story`, weight: 10, witness: lead.source, tags: ['violence'], noLeak: true });
      if (ev) { ev.leaked = true; lead.evidenceIds.push(ev.id); }
      lead.progress = Math.min(99, lead.progress + 30);
      return 'failed';
    }
    if (how === 'injunction') {
      const cost = K.injunctionPrice(lead);
      if (!K.pay(cost)) { KUI.toast('Super-injunctions are for people with money.', 'bad'); return 'nofunds'; }
      say(OUT.injunction, 'k_inj', x);
      K.endLead(lead, 'killed', `Super-injunction (${K.short(cost)})`);
      try {
        const st = createStory('gossip', P('gagged', GAGGED.hl), K.fill(GAGGED.body), {}, { reputation: -3 }, 'injunction', 1, ['injunction']);
        st.writer = `${lead.journalist} (${lead.outlet})`; publishStory(st); S.news_unread = true;
        log(`📰 HEADLINE (${lead.outlet}): <b>${st.headline}</b>`);
      } catch (_) {}
      return 'killed';
    }
    if (how && how.startsWith('favour:')) {
      const f = K.useFavour(how.slice(7)); if (!f) return 'none';
      x.who = f.label; say(OUT.favour, 'k_fav', x);
      K.endLead(lead, 'killed', `${f.label} called in a favour`);
      return 'killed';
    }
    if (how && how.startsWith('dirt:')) {
      const d = S.dirt.find(z => z.id === how.slice(5) && !z.used); if (!d) return 'none';
      d.used = true; say(OUT.bury, 'k_bury', x);
      K.endLead(lead, 'buried', `Buried under: ${d.label}`);
      try {
        const st = createStory('gossip', K.fill(d.headline || `${String(d.onLabel).toUpperCase()} IN NEW SHAME`), `${d.label}. ${lead.journalist} has the documents. "Bigger than the Southampton thing," she says. "Way bigger. What Southampton thing?"`, {}, { reputation: 2 }, 'bury', 1, ['bury']);
        st.writer = `${lead.journalist} (${lead.outlet})`; publishStory(st); S.news_unread = true;
        log(`📰 HEADLINE (${lead.outlet}): <b>${st.headline}</b>`);
      } catch (_) {}
      if (d.on === 'delmor') S.sys.delmorRevengeAt = S.sys.tick + rint(1, 3);
      return 'buried';
    }
    return 'none';
  };

  // Delmor gets his own back a couple of matchdays after you bury a story on him.
  GameHooks.on('matchday:end', function () {
    if (!window.S || !S.sys || S.sys.delmorRevengeAt < 0 || S.sys.tick < S.sys.delmorRevengeAt) return;
    S.sys.delmorRevengeAt = -1;
    const line = P('delmor_rev', DELMOR_REVENGE);
    try { if (typeof window.enqueueRivalText === 'function') window.enqueueRivalText(line); else log(`📱 Delmor Krunchem: "${line}"`); } catch (_) {}
    const r = Math.random();
    if (r < 0.4) { const loss = rint(1, 4) * 50000; S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - loss); logSafe(`🔥 Your car is found on fire in the Pompey end. Insurance doesn't cover "rival". (−${K.short(loss)})`); }
    else if (r < 0.75) addEvidence({ kind: 'paper', label: 'Delmor feeds the papers your bin bags', weight: 14, witness: 'delmor', witnessLabel: 'Delmor Krunchem', tags: ['misc'], forceLeak: true });
    else { S.team_morale_boost = (S.team_morale_boost || 0) - 3; logSafe('Delmor pays a man to stand outside the training ground shouting your PIN number. Team morale −3.'); }
  });

  // ---------- the lead modal ----------
  K.openLead = async function (id) {
    if (!window.S || !window.KUI) return;
    const lead = S.leads.find(l => l.id === id);
    if (!lead) return;
    if (lead.status !== 'active') { await KUI.modal({ title: lead.outlet, variant: 'news', html: K.leadCardHtml(lead) + `<p class="k-lead-note">${K.esc(lead.note || '')}</p>` }); return; }
    const owed = K.owedToMe(); const dirt = K.freeDirt();
    const ed = K.editorPrice(lead), inj = K.injunctionPrice(lead);
    const acts = [
      { id: 'bribe', label: `Bribe the editor (${K.short(ed)})`, variant: 'warn' },
      { id: 'threat', label: K.surveillanceOn() ? `Lean on ${K.esc(lead.sourceLabel)} (${Math.round(K.threatOdds(lead) * 100)}%)` : 'Threaten the source (whoever that is)', variant: 'bad' },
      { id: 'injunction', label: `Super-injunction (${K.short(inj)})` },
    ];
    if (owed.length) acts.push({ id: 'favour:' + owed[0].id, label: `Call in a favour: ${K.esc(owed[0].label)}` });
    if (dirt.length) acts.push({ id: 'dirt:' + dirt[0].id, label: `Bury it: leak ${K.esc(dirt[0].onLabel)} dirt` });
    else acts.push({ id: 'nodirt', label: 'Bury it (no dirt: get Surveillance)', disabled: true });
    acts.push({ id: 'let', label: 'Let it run' });
    const v = await KUI.modal({ title: `${lead.outlet} · ${lead.journalist}`, variant: 'news', wide: true, html: K.leadCardHtml(lead).replace(/<button[\s\S]*?<\/button>/, ''), actions: acts });
    if (!v || v === 'let' || v === 'nodirt') return;
    const res = await K.killLead(lead, v);
    try { if (typeof updateHUD === 'function') updateHUD(); } catch (_) {}
    if (res === 'killed' || res === 'buried') KUI.toast(res === 'killed' ? 'Story killed.' : 'Story buried.', 'good');
  };

  // ---------- News portal tab ----------
  K.newsTab = function (content, archive) {
    const b = document.createElement('button');
    b.className = 'btn-secondary';
    const n = K.activeLeads().length;
    b.textContent = n ? `Desk rumours (${n})` : 'Desk rumours';
    b.onclick = () => {
      const all = (S.leads || []).slice().reverse().slice(0, 8);
      content.innerHTML = `<div class="news-article-section">DESK RUMOURS</div><h1 class="news-article-headline">What Fleet Street is working on</h1>`
        + (all.length ? all.map(l => K.leadCardHtml(l)).join('') : '<div class="news-article-body"><p>Nobody is looking into you. Yet. Give it a week.</p></div>');
      if (archive) archive.innerHTML = '';
    };
    return b;
  };

  // ---------- HUD chip (top bar) ----------
  function chip() {
    if (!window.S || !S.leads) return;
    const stats = document.getElementById('kStats'); if (!stats) return;
    let c = document.getElementById('kStatLeads');
    if (!c) {
      c = document.createElement('button');
      c.className = 'k-stat k-leads'; c.id = 'kStatLeads'; c.type = 'button'; c.title = 'Press leads (open the dossier)';
      c.innerHTML = `<img class="px" alt="" src="${(window.KREPLIN_ART || {})['ico-news'] || ''}"><div><div class="k">Press</div><div class="v" id="kLeads">–</div></div>`;
      c.addEventListener('click', () => K.openDossier && K.openDossier('press'));
      const drugs = document.getElementById('kStatDrugs');
      stats.insertBefore(c, drugs || null);
    }
    const act = K.activeLeads();
    c.hidden = !act.length;
    if (!act.length) return;
    const soon = Math.min(...act.map(l => l.runsIn || 3));
    c.dataset.tone = soon <= 1 ? 'bad' : soon === 2 ? 'warn' : 'ok';
    const v = document.getElementById('kLeads');
    const txt = K.surveillanceOn() ? `${act.length} · next in ${soon}` : `${act.length} lead${act.length > 1 ? 's' : ''}${soon <= 1 ? ' · HOT' : ''}`;
    if (v && v.textContent !== txt) v.textContent = txt;
  }
  GameHooks.on('hud', () => { try { chip(); } catch (e) { console.error('lead chip', e); } });
})();
