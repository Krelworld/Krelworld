/* ===== KTexture: football-management texture for Seasons 1-2 + the Season 3 story scheduler =====
   Seasons 1-2 have ~32 matches of plain sim before the plot gets going. These are short, recurring
   club-life beats that use existing people and systems (board, manager, fans, squad, spouse, Delmor,
   inventory accolades, one-match morale) with small real effects. See docs/pacing.md.

   KTexture.run('prematch')   awaited by the main loop before the pre-match menu
   KTexture.run('evening')    awaited after the evening, before the end-of-week Continue
   At most one texture beat per slot; none in a match where a major story beat already fired
   (KPacing.busy()), none in Season 2's stadium-attack stretch.

   Season 3 scheduler: openKnockDoor is wrapped to record the S3 story beats it fires
   (KPacing.claim), and the door's side arcs (women's-team demand, Cronster videos/confrontation/juice)
   yield to a pending S3 story beat while matches 4-13 run (KPacing.yieldToStory), so the
   one-beat-per-door chain can't lose the secretary/captain/dating windows to a side arc. */
(function () {
  'use strict';
  const P = () => window.KPacing;
  const bag = (id, pool) => (P() ? P().bag(id, pool) : pool[Math.floor(Math.random() * pool.length)]);
  const cl = (n, a, b) => Math.max(a, Math.min(b, n));
  const club = () => (typeof getClubName === 'function' ? getClubName() : 'Southampton FC');
  const rivalClub = () => (S && S.rival && S.rival.club) || 'Portsmouth';
  const mgrName = () => (S && S.manager && S.manager.name) || null;
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const pos = () => { try { const p = getCurrentLeaguePosition(); return p && p < 99 ? p : null; } catch (_) { return null; } };
  const head = (icon, title) => log(`<strong>${icon} ${title}</strong>`);
  const money_ = n => (typeof money === 'function' ? money(n) : '£' + n);
  function cash(n, label) { S.club_cash = (S.club_cash || 0) + n; try { finNote(label, n); } catch (_) {} }
  function done(id) { const t = S._texture || (S._texture = {}); t[id] = (S.season | 0); }
  function doneThisSeason(id) { return !!(S._texture && S._texture[id] === (S.season | 0)); }
  const form = () => (Array.isArray(S._form) ? S._form : (S._form = []));
  function streak(ch) { const f = form(); let n = 0; for (let i = f.length - 1; i >= 0 && f[i] === ch; i--) n++; return n; }

  // ---------------- pre-match beats ----------------
  const PREMATCH = [
    { id: 'predictions', when: mp => mp === 0 && !doneThisSeason('predictions'), run: async () => {
      const target = S.season === 1 ? 10 : cl((S._texture_last_finish || 10) - 2, 3, 12);
      S.board_target = target;
      head('🔮', 'Pre-season predictions');
      log(bag('tx:predict', [
        `The pundits have ${club()} down for ${ord(target + 3)}. One of them said "relegation" and then had a little lie down.`,
        `A betting firm prices ${club()} at 500/1 for the title and 3/1 for "chairman arrested by Christmas".`,
        `Sky's preview spends eleven seconds on ${club()}, nine of them on the colour of your shoes.`,
        `The Echo's tipster predicts ${ord(target)}. He also predicted the Millennium Bug would kill his cat.`
      ]));
      log(`📋 The board's target this season: finish <strong>${ord(target)} or better</strong>. They'll check in every four games.`);
      done('predictions');
    } },
    { id: 'deadline', when: mp => mp === 7 && !doneThisSeason('deadline'), run: async () => {
      head('⏰', 'Transfer deadline day');
      log(bag('tx:deadline', [
        'Your phone has rung 140 times since breakfast. Eleven agents are in reception. One of them is a child.',
        'Sky Sports News has parked a van outside St Mary\'s. A man in a yellow tie is shouting "HERE WE GO" at nobody.',
        'Every agent in Europe has your number. One of them has your mum\'s number too, for leverage.'
      ]));
      const sq = Array.isArray(S.squad) ? S.squad : [];
      const bench = sq.filter(p => p && !p.is_dead && !(S.lineup || []).includes(p.id)).sort((a, b) => (a.rating || 0) - (b.rating || 0));
      const opts = [];
      const fee = 1200000;
      if ((S.club_cash || 0) >= fee && typeof makePlayer === 'function') opts.push({ key: 'buy', label: `Panic-buy a striker at 22:59 (${money_(fee)})`, variant: 'warn' });
      if (bench.length && sq.length > 6) opts.push({ key: 'sell', label: `Flog ${bench[0].name} to whoever answers` });
      opts.push({ key: 'hide', label: 'Turn your phone off and hide in the kit room' });
      const k = opts.length > 1 ? await choose(opts, 'Deadline day. What do you do?') : 'hide';
      if (k === 'buy') {
        const pl = makePlayer(); pl.pos = 'FW'; pl.rating = Math.max(pl.rating, 70 + Math.floor(Math.random() * 16)); pl.price = fee; pl.wage = Math.max(pl.wage || 0, 300);
        sq.push(pl); cash(-fee, 'Deadline-day signing');
        log(`✍️ ${pl.name} (FW, RAT ${pl.rating}) signs at 22:59:58. The paperwork is a napkin. His agent cries with joy.`);
      } else if (k === 'sell') {
        const pl = bench[0]; const fee2 = Math.max(150000, Math.round((pl.price || 20000) * 6));
        S.squad = sq.filter(p => p !== pl); cash(fee2, 'Deadline-day sale');
        log(`📤 ${pl.name} is sold to "a club in Belgium" for ${money_(fee2)}. Nobody checks which club. It may not be a club.`);
        S.team_morale_boost = (S.team_morale_boost || 0) - 1;
      } else {
        log('You spend deadline day sitting on a pile of corner flags with your phone off. The window shuts. Nothing happens. Bliss.');
      }
      done('deadline');
    } },
    { id: 'derby', when: () => {
      const next = Array.isArray(S.opponents) ? S.opponents[S.matches_played | 0] : '';
      return next && (next === rivalClub() || /portsmouth|pompey/i.test(next)) && S.portsmouth_special_event_triggered && !doneThisSeason('derby');
    }, run: async () => {
      head('🔥', `Derby week: ${club()} v ${rivalClub()}`);
      log(bag('tx:derby', [
        'Someone has painted the Itchen Bridge red and white overnight. Someone else has painted over it in blue. Hampshire Council has run out of paint.',
        'The club shop has sold out of everything, including a framed photo of the club shop.',
        `A ${rivalClub()} fan has been arrested for trying to post a dead seagull through your letterbox. It was still alive. It's fine. It lives with you now.`
      ]));
      log(`📱 Delmor Krunchem: "${bag('tx:derby_delmor', [
        'Derby week, little rat. I have bought a new suit for your funeral. It is magnificent.',
        'I have trained my parrot to say your name and then laugh. He is better at it than me.',
        'This week I will crush you. Next week I will forget you existed. Ha ha!'
      ])}"`);
      const k = await choose([
        { key: 'fire', label: 'Fuel the fire (call Delmor a "Fratton fart-sniffer" on local radio)', variant: 'warn' },
        { key: 'calm', label: 'Call for calm and respect (you are a statesman)' }
      ], 'Derby week. How do you play it?');
      if (k === 'fire') { S.team_morale_boost = (S.team_morale_boost || 0) + 3; S.fan_morale = cl((S.fan_morale || 50) + 5, 0, 100); S.legal_risk = (S.legal_risk || 0) + 2; log('The city goes feral. The players are frothing. A solicitor somewhere opens a new folder.'); }
      else { S.board_support = cl((S.board_support || 50) + 3, 0, 100); log('The board nods approvingly. The fans call you "a wet lettuce" in three separate songs.'); }
      done('derby');
    } },
    { id: 'manager', when: mp => mp >= 3 && mp <= 14 && (typeof managerPresent !== 'function' || managerPresent()) && mgrName() && P() && P().ready('tx:manager', 5), run: async () => {
      P().cool('tx:manager', 5);
      const m = mgrName(); const f = form().slice(-3); const wins = f.filter(x => x === 'W').length;
      const mood = wins >= 2 ? 'smug' : wins === 0 && f.length ? 'grim' : 'twitchy';
      head('🧢', `Manager's mood: ${m} is ${mood}`);
      log(bag('tx:mgr_' + mood, mood === 'smug' ? [
        `${m} has started calling himself "the Professor" and wearing a cape to training.`,
        `${m} asks for a statue. "Nothing big. Twelve foot. Bronze. Me pointing."`,
        `${m} has been seen high-fiving the tea lady with real force.`
      ] : mood === 'grim' ? [
        `${m} watched the last game through his fingers and then through a bin bag.`,
        `${m} has drawn a tactics board that is just the word "HELP" in capitals.`,
        `${m} has been sleeping in the dugout. He says it's "for focus".`
      ] : [
        `${m} keeps asking whether the board "still loves him". He asks the kit man too.`,
        `${m} has rearranged the cones at training into the shape of a sad face.`,
        `${m} says the squad is "nearly there". He won't say where.`
      ]));
      const k = await choose([
        { key: 'back', label: `Back ${m} publicly ("he's the best in the business")` },
        { key: 'prod', label: `Tell ${m} to stop whinging and win something`, variant: 'warn' }
      ], `${m} wants a word.`);
      if (k === 'back') { S.team_morale_boost = (S.team_morale_boost || 0) + 2; S.board_support = cl((S.board_support || 50) - 1, 0, 100); log(`${m} goes pink and hugs you for slightly too long. The dressing room perks up.`); }
      else { S.team_morale_boost = (S.team_morale_boost || 0) + (Math.random() < 0.5 ? 3 : -2); log(`${m} storms out, then storms back in because he forgot his coat. Hard to say how the lads will take it.`); }
    } },
    { id: 'wife_match', when: mp => S.season === 1 && mp === 2 && !doneThisSeason('wife_match') && S.married !== false, run: async () => {
      head('💐', 'Family day');
      log(bag('tx:wife_match', [
        'Your spouse comes to the match for the first time in years. She brings a flask, a book and a face of total neutrality.',
        'Your spouse and the kids sit in the directors\' box. Your youngest asks the chief executive why his wig is "on wonky".'
      ]));
      if (S.family) { S.family.wifeRel = cl((S.family.wifeRel || 50) + 3, 0, 100); S.family.kidsRel = cl((S.family.kidsRel || 50) + 2, 0, 100); }
      S.wife_love = cl((S.wife_love || 60) + 2, 0, 100);
      done('wife_match');
    } },
    { id: 'intl', when: mp => ((S.season === 1 && mp === 10) || (S.season === 2 && mp === 5)) && !doneThisSeason('intl'), run: async () => {
      const sq = (S.squad || []).filter(p => p && !p.is_dead && !(p.injury_games > 0));
      if (!sq.length) { done('intl'); return; }
      const pl = sq[Math.floor(Math.random() * sq.length)];
      head('🌍', 'International break');
      log(bag('tx:intl', [
        `${pl.name} comes back from international duty with San Marino holding his hamstring and a duty-free Toblerone the size of a canoe.`,
        `${pl.name} was called up by the Faroe Islands "by mistake". He played anyway. He returns limping and fluent in sheep.`,
        `${pl.name} returns from an Isle of Man friendly with a mystery knock and a new tattoo of a lighthouse.`
      ]));
      pl.injury_games = Math.max(pl.injury_games || 0, 1); pl.injury_type = pl.injury_type || 'knock';
      log(`🚑 ${pl.name} misses the next match.`);
      done('intl');
    } },
    { id: 'sponsor', when: mp => S.season === 2 && mp === 2 && !doneThisSeason('sponsor'), run: async () => {
      head('🤝', 'Sponsor appearance');
      log('The shirt sponsor wants the chairman at a supermarket opening in Eastleigh. There will be a ribbon. There will be a mascot called "Sausage".');
      const k = await choose([
        { key: 'go', label: 'Cut the ribbon yourself (+£200k)' },
        { key: 'mgr', label: 'Send the manager instead (+£100k, he hates it)' },
        { key: 'no', label: 'Refuse. You are an artist.' }
      ], 'Sponsor appearance');
      if (k === 'go') { cash(200000, 'Sponsor appearance'); log('You cut the ribbon, hug Sausage and get bitten by Sausage. The cheque clears.'); }
      else if (k === 'mgr') { cash(100000, 'Sponsor appearance'); S.team_morale_boost = (S.team_morale_boost || 0) - 1; log(`${mgrName() || 'The manager'} spends three hours handing out sausage rolls. He will remember this.`); }
      else { S.board_support = cl((S.board_support || 50) - 2, 0, 100); log('The sponsor sends a strongly worded fruit basket.'); }
      done('sponsor');
    } }
  ];

  // ---------------- evening beats (after the result) ----------------
  const CUP = [
    { after: 5, round: 'quarter-final', opp: ['AFC Totton Reserves', 'Eastleigh Over-60s', 'Isle of Wight Ferry Staff XI'], prize: 100000 },
    { after: 9, round: 'semi-final', opp: ['Winchester Cathedral Choir XI', 'Basingstoke Roundabout Appreciation FC', 'Hamble Yacht Club'], prize: 200000 },
    { after: 13, round: 'FINAL', opp: null, prize: 600000 }
  ];
  const EVENING = [
    { id: 'board', when: mp => [4, 8, 12].includes(mp), run: async (mp) => {
      const p = pos(); const target = S.board_target || 10;
      const conf = cl(Math.round((S.board_support || 50) + (p ? (target - p) * 3 : 0)), 0, 100);
      const bar = '▮'.repeat(Math.round(conf / 10)) + '▯'.repeat(10 - Math.round(conf / 10));
      head('🏛', `Board check-in (game ${mp})`);
      log(`Board confidence: <strong>${conf}%</strong> ${bar} · ${p ? `you're ${ord(p)}, target ${ord(target)}` : `target ${ord(target)}`}`);
      if (p && p <= target - 2) {
        log(bag('tx:board_good', [
          'The board sends a hamper. Inside is a smaller hamper. Inside that is a cheque.',
          'A director calls you "son" and tries to adopt you. The others top up the transfer kitty instead.',
          'The board stands and applauds when you enter. One of them was already standing; he has a condition.'
        ]));
        cash(300000, 'Board bonus'); S.board_support = cl((S.board_support || 50) + 3, 0, 100);
      } else if (p && p > target + 2) {
        log(bag('tx:board_bad', [
          'The board meets without you. You watch through the keyhole. Someone draws a gallows on the whiteboard and then, after discussion, a bigger gallows.',
          'A director slides a leaflet across the table: "So You\'ve Been Sacked: A Gentle Guide."',
          'The board asks whether you have "considered the Isle of Wight as a lifestyle".'
        ]));
        S.board_support = cl((S.board_support || 50) - 4, 0, 100); S.morale = cl((S.morale || 0) - 2, -100, 100);
      } else {
        log(bag('tx:board_meh', [
          'The board says it is "cautiously neutral". One director is asleep. The other is eating a Scotch egg in a way that feels like a threat.',
          'The board would like "more of the good stuff and less of the other stuff". Minutes approved.',
          'The board shrugs as one. It is quite impressive.'
        ]));
      }
    } },
    { id: 'cup', when: mp => S.season === 1 && CUP.some(r => r.after === mp) && !S._cup_out, run: async (mp) => {
      const r = CUP.find(x => x.after === mp);
      const opp = r.opp ? bag('tx:cup_' + mp, r.opp) : `${rivalClub()} Reserves (Delmor in the dugout)`;
      head('🏆', `The Solent Shield — ${r.round}`);
      log(`Midweek: ${club()} v ${opp}. Floodlights, Bovril, eleven hundred people and a dog.`);
      const k = await choose([
        { key: 'first', label: 'Play the first team (better odds, risk a knock)' },
        { key: 'kids', label: 'Play the kids and the kit man (rest the stars)' }
      ], `Solent Shield ${r.round}`);
      let str = 65; try { str = teamStrength(); } catch (_) {}
      let p = cl(0.55 + (str - 65) / 100, 0.25, 0.85) + (r.opp ? 0.1 : -0.05) - (k === 'kids' ? 0.25 : 0);
      const win = Math.random() < p;
      if (k === 'first' && Math.random() < 0.25) {
        const sq = (S.squad || []).filter(x => x && !x.is_dead && !(x.injury_games > 0));
        if (sq.length) { const pl = sq[Math.floor(Math.random() * sq.length)]; pl.injury_games = Math.max(pl.injury_games || 0, 1); pl.injury_type = pl.injury_type || 'knock'; log(`🚑 ${pl.name} picks up a knock on a pitch that is 40% mole. Out for a game.`); }
      }
      if (win) {
        const g = 1 + Math.floor(Math.random() * 3);
        log(`✅ ${club()} win ${g}–${Math.floor(Math.random() * g)}. ${bag('tx:cup_win', ['The trophy cabinet is cautiously dusted.', 'A fan runs on to hug the corner flag. It hugs back.', 'The dog in the crowd is named man of the match.'])}`);
        cash(r.prize, 'Solent Shield prize'); S.fan_morale = cl((S.fan_morale || 50) + (r.opp ? 3 : 8), 0, 100);
        if (!r.opp) { try { addAccoladeToInventory('Solent Shield (polished by hand)', 50000); } catch (_) {} log(`🏆 <strong>SOLENT SHIELD WINNERS.</strong> You lift it so high you pull a muscle. Delmor texts a single 🖕.`); }
      } else {
        S._cup_out = true;
        log(`❌ Knocked out by ${opp}. ${bag('tx:cup_loss', ['Their goalkeeper was a postman on his lunch break.', 'The winner was scored off someone\'s back. Possibly the dog\'s.', 'Their manager celebrates by taking his shirt off. He is seventy-one.'])}`);
        S.fan_morale = cl((S.fan_morale || 50) - 3, 0, 100);
      }
    } },
    { id: 'awards', when: mp => [2, 6, 10, 14].includes(mp), run: async (mp) => {
      const f = form().slice(-4); const wins = f.filter(x => x === 'W').length;
      const lu = (S.squad || []).filter(p => p && (S.lineup || []).includes(p.id) && !p.is_dead);
      const best = lu.sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
      head('🏅', 'End-of-month awards');
      if (wins >= 3 && mgrName()) {
        log(`<strong>Manager of the Month:</strong> ${mgrName()}. He thanks God, his mum and "the Saints family", then you, eventually.`);
        S.team_morale_boost = (S.team_morale_boost || 0) + 2;
        try { addAccoladeToInventory(`Manager of the Month (${mgrName()})`, 8000); } catch (_) {}
      } else if (best && wins >= 1) {
        log(`<strong>Player of the Month:</strong> ${best.name}. ${bag('tx:potm', ['He accepts the award in a dressing gown.', 'He thanks his agent, his barber and his parole officer.', 'He tries to sell the trophy before he has left the stage.'])}`);
        best.morale = cl((best.morale || 50) + 5, 0, 100);
        try { addAccoladeToInventory(`Player of the Month (${best.name})`, 5000); } catch (_) {}
      } else {
        log(`<strong>Chairman of the Month:</strong> Delmor Krunchem, "for services to Portsmouth and to laughing at ${club()}". He accepts by video from a hot tub.`);
        S.fan_morale = cl((S.fan_morale || 50) - 1, 0, 100);
      }
    } },
    { id: 'fans', when: () => (streak('L') >= 3 || streak('W') >= 3) && P() && P().ready('tx:fans', 4), run: async () => {
      P().cool('tx:fans', 4);
      if (streak('L') >= 3) {
        head('📣', 'Fan protest');
        log(bag('tx:protest', [
          'Four hundred fans gather outside St Mary\'s with a banner reading "CHAIRMAN OUT" and a smaller one reading "ALSO BRING BACK THE HALF-TIME PIES".',
          'Fans have flown a plane over the stadium trailing the words "SELL UP YOU". It ran out of banner.',
          'The supporters\' trust has delivered a coffin to reception. It has your name on it. It is a nice coffin, to be fair.'
        ]));
        const k = await choose([
          { key: 'face', label: 'Go out and face them with a megaphone' },
          { key: 'hide', label: 'Hide in the away dressing room until it gets dark' }
        ], 'The fans are restless.');
        if (k === 'face') {
          S.fan_morale = cl((S.fan_morale || 50) + 6, 0, 100);
          if (Math.random() < 0.3) { S.reputation = cl((S.reputation || 50) - 2, 0, 100); log('You get through "Ladies and gentlemen" before a steak bake hits you full in the face. Weirdly, it helps. They respect a man who can take a pastry.'); }
          else log('You promise "a new era of ambition". Someone shouts "WHAT DOES THAT MEAN". You say "exactly". They go home confused but calmer.');
        } else { S.fan_morale = cl((S.fan_morale || 50) - 3, 0, 100); log('You sit in the dark eating a Twix. The chanting goes on until a quarter to midnight.'); }
      } else {
        head('🎉', 'The fans are buzzing');
        log(bag('tx:praise', [
          'Three wins on the bounce. The fans have written you a song. It rhymes "chairman" with "fair, man". It\'s a start.',
          'A pub in Shirley has put your face on its sign. The pub is now called "The Chairman\'s Head". It is not a compliment, but it is not an insult either.',
          'Season ticket enquiries are up 40%. The ticket office has hired a man to stop people hugging the ticket office.'
        ]));
        S.fan_morale = cl((S.fan_morale || 50) + 5, 0, 100); cash(150000, 'Ticket surge');
      }
    } }
  ];

  async function runSlot(list, slot) {
    if (!S || S.game_over) return false;
    const mp = S.matches_played | 0;
    if ((S.season | 0) > 2) return false;
    if (S.season === 2 && mp >= 10 && mp <= 12) return false;   // the St Mary's attack stretch belongs to the story
    if (S.stadium_burned && slot === 'evening') return false;
    if (S.competition && S.competition !== 'league') return false;
    if (P() && P().busy()) return false;                          // a major story beat already had this match
    for (const b of list) {
      let ok = false; try { ok = !!b.when(mp); } catch (_) { ok = false; }
      if (!ok) continue;
      try { await b.run(mp); } catch (e) { console.error('KTexture beat failed', b.id, e); }
      S._texture_count = (S._texture_count | 0) + 1;
      return true;
    }
    return false;
  }

  async function run(slot) {
    try {
      if (!S) return false;
      if (slot === 'evening') {
        // remember the result for streak-based beats (once per match)
        const key = `${S.season}/${S.matches_played}`;
        if (S._form_key !== key && S.lastMatchResult) {
          S._form_key = key;
          const r = S.lastMatchResult; const f = form();
          f.push(r.homeGoals > r.awayGoals ? 'W' : r.homeGoals < r.awayGoals ? 'L' : 'D');
          if (f.length > 8) f.splice(0, f.length - 8);
        }
        if ((S.matches_played | 0) >= (S.season_matches | 0) && S.season_matches) {
          const p = pos(); if (p) S._texture_last_finish = p;
        }
        const fired = await runSlot(EVENING, slot);
        if (fired) S._quiet_evening = false; // there's something to read: keep the Continue
        return fired;
      }
      return await runSlot(PREMATCH, slot);
    } catch (e) { console.error('KTexture.run', e); return false; }
  }

  // ---------------- Season 3: story-first scheduling at the door ----------------
  const S3_MAJOR = ['son_hired_as_scout', 'gaz_signed', 'captain_confessed', 'son_relationship_with_secretary', 'secretary_poly_reveal',
    'dating_minigame_complete', 'drive_home_complete', 'act4_complete', 'act5_complete', 'krunchem_family_murdered',
    'gaz_suicide_threatened', 'womens_manager_complaint'];
  function wrapDoor() {
    const orig = window.openKnockDoor;
    if (typeof orig !== 'function' || orig._kStory) return;
    const wrapped = async function () {
      const before = (S && S.season3) ? S3_MAJOR.map(k => !!S.season3[k]) : null;
      const r = await orig.apply(this, arguments);
      try {
        if (before && S && S.season3 && S3_MAJOR.some((k, i) => !before[i] && !!S.season3[k]) && P()) P().claim('s3:door');
      } catch (_) {}
      return r;
    };
    wrapped._kStory = true;
    window.openKnockDoor = wrapped;
  }
  wrapDoor();

  // Is a Season 3 door story beat due this match? (mirrors the windows in src/020 openKnockDoor)
  function s3StoryPending() {
    if (!S || S.season !== 3 || !S.season3) return false;
    const mp = S.matches_played | 0, t = S.season3;
    if (mp < 4 || mp > 13) return false;
    return !!(
      (!t.captain_confessed && mp <= 10) ||
      (t.captain_confessed && !t.son_relationship_with_secretary && S.secretary_hired && mp >= 6 && mp <= 10) ||
      (t.son_relationship_with_secretary && !t.secretary_poly_reveal && mp >= 8 && mp <= 12) ||
      (t.secretary_relationship_opened_to_player && !t.dating_minigame_complete && mp >= 9 && mp <= 12) ||
      (t.dating_minigame_complete && !t.drive_home_complete && S.secretary_hired && mp >= 9 && mp <= 13) ||
      (t.gaz_signed && !t.womens_manager_complaint && !t.womens_team_liquidated_due_to_gaz && !t.womens_manager_placated_with_lie && S.womens_team && !S.womens_team.liquidated && mp >= 7 && mp <= 12)
    );
  }
  // Side arcs ask this before taking the door: true = step aside this match (try again next one).
  function yieldToStory(id) {
    if (!s3StoryPending()) return false;
    const d = S._deferrals || (S._deferrals = {});
    const k = `${id}@${S.season}/${S.matches_played}`;
    if (!d[k]) { d[k] = 1; S._beat_deferred = (S._beat_deferred | 0) + 1; }
    return true;
  }
  if (window.KPacing) { KPacing.yieldToStory = yieldToStory; KPacing.s3StoryPending = s3StoryPending; }

  window.KTexture = { run, s3StoryPending, _prematch: PREMATCH, _evening: EVENING };
})();
