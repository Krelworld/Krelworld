// ===== 4A Economy Tunables (single source of truth) =====
const PLAYER_PRICE_MULTIPLIER = 140;   // transfer fees ×20
const PLAYER_WAGE_MULTIPLIER  = 220;   // weekly wages ×220 (doubled for higher level players)

// Wrap makePlayer exactly once so ALL newly generated players are scaled.

async function openTransferWindow(){
  ensureTransferState();
  generateMarketIfNeeded(true);
if(Math.random()<0.18 && getSquad().length){
  const sq = getSquad();
  const target = pick(sq);
  const offer = Math.max(2000, Math.floor((target.price||5000) * (0.8 + Math.random()*0.8)));
  const r = await choose([
    {key:"acc",label:`Accept ${money(offer)} for ${target.name}`},
    {key:"rej",label:"Reject"}
  ], `Transfer Offer: Another club bids ${money(offer)} for ${target.name}.`);
  if(r==="acc"){
    setSquad(sq.filter(p=>p.id!==target.id));
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(offer);
    } else {
      S.club_cash = (S.club_cash || 0) + offer;
    }
    log(`Sold ${target.name} to the bidding club for ${money(offer)}.`);
  }else{
    log("You rejected the offer.");
  }
}
  while(true){
    render();
    const choice = await choose([
      {key:"buy",label:"Buy Player"},
      {key:"sell",label:"Sell Player"},
      {key:"auto",label:"Auto-Select Lineup"},
      {key:"exit",label:"Close Window"}
    ], "Transfer Window");
    if(choice==="buy"){ await buyFlow(); }
    else if(choice==="sell"){ await sellFlow(); }
    else if(choice==="auto"){ await autoSelectLineup(); }
    else { break; }
  }
}



async function buyFlow(){
  if(S.transfer_market.length===0) generateMarketIfNeeded();
  const opts = S.transfer_market.map(p=>({key:p.id, label:`${p.name} (${p.pos}) | ${p.tier.toUpperCase()} | RAT ${p.rating} | ${money(p.price)} | ${money(p.wage)}/wk`}));
  opts.push({key:"back",label:"Back"});
  const k = await choose(opts,"Choose player to buy");
  if(k==="back") return;
  const p = S.transfer_market.find(x=>x.id===k);
  if(!p) return;
  
  // Check if the Transfer Powers Act is active – if so, we can bend reality once
  let usingTransferAct = false;
  let displayPrice = p.price;
  if (S.transfer_act_active) {
    // Next transfer is completely free (one-time only)
    displayPrice = 0;
    usingTransferAct = true;
  }

  const choiceOptions = [
    {key:"club",label:`Pay from Club (${money(displayPrice)})`},
    {key:"unpaid",label:"Commit without paying (unpaid transfer)"},
    {key:"cancel",label:"Cancel"}
  ];

  // If the Act is active, surface that explicitly in the prompt text
  const how = await choose(
    choiceOptions,
    usingTransferAct
      ? `Buy ${p.name}? (Transfer Powers Act in force – this transfer is completely FREE and will trigger a scandal.)`
      : `Buy ${p.name}?`
  );
  if(how==="cancel") return;

  if(how==="club"){
    const fee = usingTransferAct ? displayPrice : p.price;
    if(S.club_cash>=fee){
      S.club_cash -= fee;
      finalizeBuy(p);
      if (usingTransferAct){
        // One-shot: consume the Act and lean on the press / Delmor / risk systems
        S.transfer_act_active = false;
        log(`Transfer complete: ${p.name} joins on a state-backed sweetheart deal. Club paid just ${money(fee)} on a sticker price of ${money(p.price)}.`);
        if (S.press){
          S.press.last_scandal = `Transfer Powers Act: ${p.name} signs for a surreal cut-price fee amid accusations of state interference.`;
        }
        S.power_heat = Math.min(100, (S.power_heat|0) + 10);
        if (typeof window.enqueueRivalText === 'function'){
          const msg = `They're literally laundering transfer fees through Westminster for you now. This league is finished.`;
          window.enqueueRivalText(msg);
        } else {
          log(`📱 Delmor Krunchem: "They're literally laundering transfer fees through Westminster for you now. This league is finished."`);
        }
        // Track that rivals now have a transfer vendetta hook
        try{
          ensureWorldState();
          const wf = getWorldFlags();
          const clubId = (S.rival && (S.rival.club || S.rival.name)) || 'Generic Rival';
          const existing = wf.transferVendettas[clubId] && wf.transferVendettas[clubId].anger || 0;
          wf.transferVendettas[clubId] = {
            active:true,
            anger: existing + 1
          };
          scheduleWorldEvent('transferVendetta', 2 + Math.floor(Math.random()*3), { clubId });
        }catch(e){}
      } else {
        log(`Transfer complete: ${p.name} joins. Club paid ${money(p.price)}.`);
      }
    }else{
      log("Insufficient club funds.");
    }
  }else if(how==="unpaid"){
    // Special check for Ronaldo and Messi - no unpaid transfers allowed
    if(p.noUnpaid || p.name === "Cristiano Ronaldo" || p.name === "Lionel Messi"){
      log("lol nice try");
      return;
    }
    
    finalizeBuy(p);
    S.unpaid_transfers.push({playerId:p.id, name:p.name, price:p.price, weeks:0});
    S.club_debt = (S.club_debt|0) + (p.price|0);  // add fee to club debt now
    S.debt_club = S.club_debt;                    // keep legacy key in sync for HUD
    updateHUD?.();                                // refresh top bar immediately
    log(`Transfer committed without payment: ${p.name}. Expect follow-up from selling club.`);
    incrementRisk("unpaid_transfer", 1);
    // Selling club now has a reason to hate you
    try{
      ensureWorldState();
      const wf = getWorldFlags();
      const clubId = (S.rival && (S.rival.club || S.rival.name)) || 'Generic Rival';
      const existing = wf.transferVendettas[clubId] && wf.transferVendettas[clubId].anger || 0;
      wf.transferVendettas[clubId] = {
        active:true,
        anger: existing + 1
      };
      scheduleWorldEvent('transferVendetta', 1 + Math.floor(Math.random()*3), { clubId });
    }catch(e){}
  }
  render();
}

// Generate a single rummage result (cash OR accolade OR drugs OR nothing)




function ensureInitialSquad(){
  if (!Array.isArray(S.squad)) S.squad = [];
  if (S.squad.length > 0) return;

  // Don't create new players if you're on the sex offenders register
  // This prevents auto-filling the squad when players leave due to scandal
  if (S.krazyGamesRemaining && S.krazyGamesRemaining > 0) {
    log(`🚨 No new players will join while you're on THE SEX OFFENDERS REGISTER.`);
    log(`You need to manually sign players to rebuild your squad.`);
    return;
  }

  // Build five very-shit players (force tier + low rating band)
  const veryShit = () => {
    const p = makePlayer();
    p.tier   = "shit";
    p.rating = Math.max(45, Math.min(55, 45 + Math.floor(Math.random()*8))); // ~45–52
    return p;
  };

  const starters = [];
  
  // 30% chance to include 1-2 special players in starting squad
  if (Math.random() < 0.30) {
    const numSpecial = Math.random() < 0.7 ? 1 : 2;
    for (let i = 0; i < numSpecial; i++) {
      const specialPlayer = makeSpecialPlayer();
      starters.push(specialPlayer);
    }
  }
  
  // Fill remaining slots with very-shit players
  while (starters.length < 5) {
    starters.push(veryShit());
  }
  
  // Shuffle to randomize order
  starters.sort(() => Math.random() - 0.5);
  
  S.squad  = starters.slice();
  S.lineup = starters.map(p => p.id); // Store player IDs, not objects

  // No pre-adding of wages to arrears/debt — charge arrives post-match
  log(`You inherit five very weak players. Their wages will be due after your first game.`);
  updateHUD?.();
}


function ensureValidLineup(){
  if(!Array.isArray(S.lineup)) S.lineup = [];
  // Keep lineup in sync with squad and ensure 5
  // S.lineup contains player IDs, not objects
  S.lineup = S.lineup.filter(lpId => {
    const sp = S.squad.find(sp => sp.id === lpId);
    return sp && isPlayerAvailableForSelection(sp);
  });
  if(S.lineup.length < 5){
    const need = 5 - S.lineup.length;
    // Only auto-fill if we actually have enough players in the squad
  const availablePlayers = S.squad.filter(sp => isPlayerAvailableForSelection(sp) && !S.lineup.some(lpId=>lpId===sp.id));
    if(availablePlayers.length >= need) {
      // pick best remaining players
      const remain = availablePlayers
        .sort((a,b)=>b.rating-a.rating)
        .slice(0,need)
        .map(p => p.id); // Convert to IDs
      S.lineup = S.lineup.concat(remain);
    }
    // If we don't have enough players, leave the lineup as is (less than 5)
  }else if(S.lineup.length > 5){
    S.lineup = S.lineup.slice(0,5);
  }
}

async function selectLineupMenu(){
  // Choose exactly 5 from up to 20 players
  // Simple version: show a sorted list and let user toggle
  while(true){
    const sorted = S.squad.slice().sort((a,b)=>b.rating-a.rating);
    const labels = sorted.map(p=>{
      const inXI = S.lineup.some(lpId=>lpId===p.id);
      let statusTag = '';
      const injuryGames = p.injury_games | 0;
      const suspensionGames = p.suspension_games | 0;
      if (p.is_dead) {
        statusTag = ' [UNAVAILABLE – deceased]';
      } else if (injuryGames > 0) {
        statusTag = ` [INJ ${injuryGames}m]`;
      } else if (suspensionGames > 0) {
        statusTag = ` [SUS ${suspensionGames}m]`;
      }
      return {key:p.id, label:`${inXI?'[✓]':'[ ]'} ${p.name} (${p.pos}) RAT ${p.rating}${statusTag}`};
    });
    labels.push(
      {key:"done",label:"Done (need exactly 5)"},
      {key:"auto",label:"Auto-Select Best 5"},
      // Allow emergency access to the transfer market from pre-match if you're short
      {key:"transfers",label:"Open Transfer Window (sign players)"},
      {key:"back",label:"Back"}
    );
    const k = await choose(labels, `Select Lineup (${S.lineup.length}/5 selected)`);
    if(k==="back") return;
    if(k==="auto"){
      await autoSelectLineup();
      ensureValidLineup();
      render();
      continue;
    }
    if(k==="transfers"){
      // Let the player jump to the transfer window to fix an under-sized squad,
      // then come straight back here to pick from any new signings.
      if (typeof openTransferWindow === 'function') {
        await openTransferWindow();
      } else if (typeof window.openTransferWindow === 'function') {
        await window.openTransferWindow();
      }
      ensureValidLineup();
      render();
      continue;
    }
    if(k==="done"){
      if(S.lineup.length===5){ log("Lineup confirmed."); return; }
      else { log("You must select exactly 5 players."); continue; }
    }
    // toggle
    const p = S.squad.find(x=>x.id===k);
    if(!p) continue;
    if (!isPlayerAvailableForSelection(p)) {
      log(`${p.name} is unavailable due to injury, suspension or worse.`);
      continue;
    }
    const inXI = S.lineup.some(lpId=>lpId===p.id);
    if(inXI){
      S.lineup = S.lineup.filter(lpId=>lpId!==p.id);
    }else{
      if(S.lineup.length<5) S.lineup.push(p.id); // Store ID, not object
      else log("You already have 5 selected. Deselect someone first.");
    }
    render();
  }
}


function finalizeBuy(p){
  const sq = getSquad().slice();
  sq.push({id:p.id, name:p.name, pos:p.pos, rating:p.rating, price:p.price, wage:p.wage, tier:p.tier});
  setSquad(sq);
  S.transfer_market = S.transfer_market.filter(x=>x.id!==p.id);
  
  // Add player to top scorers system
  ensureTopScorersInit();
  if (!S.topScorers[p.name]) {
    S.topScorers[p.name] = {
      name: p.name,
      team: getClubName(),
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  } else {
    // Update team if player was previously in transfer market
    S.topScorers[p.name].team = 'Southampton FC';
  }
}

async function sellFlow(){
  const sq = getSquad();
  if(sq.length===0){ log("You have no players to sell."); return; }
  const opts = sq.map(pl=>({key:pl.id, label:`Sell ${pl.name} (${pl.pos}) | RAT ${pl.rating} | ${money(pl.price)}`}));
  opts.push({key:"back",label:"Back"});
  const k = await choose(opts,"Choose player to sell");
  if(k==="back") return;
  const pl = sq.find(x=>x.id===k);
  if(!pl) return;
  const confirm = await choose([{key:"y",label:`Confirm sale for ${money(pl.price)}`},{key:"n",label:"Cancel"}],`Sell ${pl.name}?`);
  if(confirm!=="y") return;
  if (typeof addMoneyClub === 'function') {
    addMoneyClub(pl.price||0);
  } else {
    S.club_cash = (S.club_cash || 0) + (pl.price||0);
  }
  setSquad(sq.filter(x=>x.id!==pl.id));
  log(`Sold ${pl.name} for ${money(pl.price)}.`);
  
  // Trigger rival event if selling a star player (high rating or high price)
  if (typeof triggerRivalEvent === 'function') {
    const isStarPlayer = (pl.rating || 0) >= 80 || (pl.price || 0) >= 5000000;
    if (isStarPlayer) {
      triggerRivalEvent('player_sale_disaster', {
        playerName: pl.name,
        fee: pl.price,
        rating: pl.rating,
        fanBacklash: true
      });
    }
  }
  
  render();
}

async function autoSelectLineup(){
  const top5 = getSquad().slice().sort((a,b)=>b.rating-a.rating).slice(0,5);
  S.lineup = top5.map(p => p.id); // Store player IDs, not objects
  log("Auto-selected best 5 players for lineup.");
  render();
}

async function unpaidTransferTick(){
  // This function is now disabled - using new agent system instead
  // Keeping for backward compatibility but it no longer does anything
  return;
}
// ====== BETTING (one-time per pre-match) ======


function openBettingModal() {
  S.preMatch = S.preMatch || {};
  if (S.preMatch.betLocked) { log("You\'ve already placed a bet for this match."); return; }
  if (!S.preMatch.odds) computePreMatchStrengthsAndOdds();

  const modal = document.getElementById('betModal');
  const line  = document.getElementById('betOddsLine');
  const stake = document.getElementById('betStake');
  const pot   = document.getElementById('betPotentialWin');
  const btn   = document.getElementById('betPlaceBtn');
  const close = document.getElementById('betCloseBtn');

  if (!modal || !line || !stake || !pot || !btn || !close) {
    log("Betting UI not found."); 
    return;
  }

  const { usOdds, themOdds } = S.preMatch.odds;
  line.textContent = `Odds — Us: ${usOdds} | Opponents: ${themOdds}`;

  function refreshPotential(){
    const outcome = document.querySelector('input[name="betOutcome"]:checked')?.value || 'us';
    const odds = outcome === 'us' ? usOdds : themOdds;
    const st = Math.max(0, Number(stake.value||0));
    pot.textContent = st > 0 ? `Potential return: ${money(Math.floor(st*odds))}` : '';
  }
  stake.oninput = refreshPotential;
  document.querySelectorAll('input[name="betOutcome"]').forEach(r => r.onchange = refreshPotential);
  refreshPotential();

  btn.onclick = () => {
    const st = Math.max(0, Number(stake.value||0));
    if (st < 10) { log("Minimum stake is £10."); return; }
    if ((S.chairman_cash||0) < st) { log("Not enough personal cash."); return; }

    const outcome = document.querySelector('input[name="betOutcome"]:checked')?.value || 'us';
    const odds = outcome === 'us' ? usOdds : themOdds;

    S.chairman_cash -= st;
    S.preMatch.bet = { outcome, stake: st, odds };
    S.preMatch.betLocked = true;

    log(`Bet placed: ${money(st)} on ${outcome === 'us' ? 'Southampton' : 'Opponents'} @ ${odds}.`);
    modal.style.display = 'none';
  };
  close.onclick = () => { modal.style.display = 'none'; };
  modal.style.display = 'flex';
}



// ====== STRENGTH & ODDS (used by betting + sim) ======



async function placeBetMenu(){
  // one bet per pre-match
  if (S.bet_locked_this_prematch || S.preMatch?.betLocked) {
    log("You already placed a bet this pre-match.");
    render();
    return;
  }

  if (!S.preMatch) S.preMatch = {};
  // (re)compute strengths and base odds if needed
  computePreMatchStrengthsAndOdds();

  // Translate cache to {home,draw,away} for the UI
  const odds = computeMatchOdds();
  const { team } = currentOpponent();

  // Choose the market
  const market = await choose([
    { key:'home', label:`${getClubName()} to WIN @ ${odds.home.toFixed(2)}` },
    { key:'draw', label:`DRAW @ ${odds.draw.toFixed(2)}` },
    { key:'away', label:`${team} to WIN @ ${odds.away.toFixed(2)}` },
    { key:'x',    label:'Cancel' }
  ], 'Place a pre-match bet: select an outcome.');
  if (market === 'x') return;

  // Stake (uses your prompt helper)
  const stake = await promptNumber("Enter your stake (e.g., 1000):", 1000);
  if (!stake || stake <= 0) { log("Bet cancelled."); render(); return; }
  if ((S.chairman_cash||0) < stake) { log("Not enough personal cash."); render(); return; }

  // Confirm
  const line = odds[market];
  const potential = Math.round(stake * line);
  const conf = await choose([
    { key:'y', label:`Confirm bet: ${market.toUpperCase()} @ ${line.toFixed(2)} — Stake ${money(stake)} → Potential return ${money(potential)}` },
    { key:'n', label:'Cancel' }
  ], 'Confirm your bet');
  if (conf !== 'y') { log("Bet cancelled."); render(); return; }

  // Deduct + record + lock
  S.chairman_cash = (S.chairman_cash||0) - stake;
  S.preMatch.bet = { outcome: market, stake, odds: line };
  S.preMatch.betLocked = true;
  S.bet_locked_this_prematch = true;

  log(`Bet placed: ${money(stake)} on ${market.toUpperCase()} @ ${line.toFixed(2)}.`);
  render();
}


// ---- Quick-Sim Invective + 4-Option Taunt Wheel + Brick Throws ----
// Configuration objects
const quickInvective = {
  autoShoutProbability: 0.15,        // base probability for auto-shouts
  frustration: {
    missAdd: 8,                      // frustration increase on missed chances
    goalMinus: 12,                   // frustration decrease on goals
    turnoverAdd: 5,                  // frustration increase on turnovers
    decayRate: 0.1                   // frustration decay per match event
  }
};

const brickThrow = {
  consumeOnThrow: true,              // throwing consumes the brick
  arrestProbability: 0.3,            // base arrest probability
  moraleDelta: [-5, -10],           // morale effect range
  qualityDelta: [-2, -5],           // quality effect range
  targets: {
    players: { 
      arrest: 0.2, 
      morale: [-3, -7], 
      quality: [-1, -3],
      newsNote: 'You hurl a brick at your own players!'
    },
    opponents: { 
      arrest: 0.4, 
      morale: [2, 5], 
      quality: [1, 3],
      newsNote: 'You launch a brick at the opposition!'
    },
    manager: { 
      arrest: 0.6, 
      morale: [-5, -12], 
      quality: [-2, -6],
      newsNote: 'You aim a brick at the opposing manager!'
    },
    referee: { 
      arrest: 0.8, 
      morale: [-8, -15], 
      quality: [-3, -8],
      newsNote: 'You target the referee with a brick!'
    },
    fans: { 
      arrest: 0.5, 
      morale: [-4, -10], 
      quality: [-2, -5],
      newsNote: 'You throw a brick into the crowd!'
    }
  }
};

// Taunt pools organized by intensity
const tauntPools = {
  mild: [
    "PASS THE FUCKING BALL", "FUCKING SHOOT!", "FOOTBALL!", "PLAY THE FUCKING GAME!",
    "MOVE IT!", "TO FUCKING FEET!", "FUCKING WAKE UP!", "FUCKING PRESS!", "ON YOUR FUCKING TOES!"
  ],
  salty: [
    "PASS THE FUCKING BALL", "SHOOT AT THE FUCKING GOAL", "FUCKING KICK IT FUCKING HARDER",
    "WHAT ARE YOU DOING!", "GET STUCK IN!", "HIT THE FUCKING TARGET!", "FUCKING STOP DALLYING!",
    "GET IT FUCKING WIDE!", "HEAD UP!", "MAKE THE RUN!", "PASS IT FUCKING HARDER!",
    "KICK THE BALL FUCKING HARDER!", "SHOOT IT FUCKING UPFIELD!", "STOP PLAYING SHIT!",
    "STOP FUCKING DALLYING!", "GET IT FUCKING WIDE!", "HEAD UP YOU CLOWN!",
    "MAKE THE FUCKING RUN!", "WHIP IT FUCKING IN!", "PUT YOUR LACES THROUGH IT!",
    "GET STUCK THE FUCK IN!", "HIT THE FUCKING TARGET!", "WAKE THE FUCK UP!",
    "CLEAR YOUR FUCKING LINES!", "DON'T PLAY FUCKING ABOUT AT THE BACK! GET YOUR COCKS STUCK IN",
    "TURN AND FUCKING GO!", "PUT IT IN THE BOX!"
  ],
  extreme: [
    "WHAT THE FUCK ARE YOU DOING!", "WHAT ARE YOU FUCKING DOING!", "CUNTS!",
    "THE REFEREE IS A DEAD MAN FUCKING WALKING!", "WAKE THE FUCK UP!",
    "FUCKING PASS IT!", "CLEAR YOUR LINES!", "HIT HIM!", "BREAK HIS FUCKING LEGS!",
    "BREAK HIS ANKLES!", "END HIM!", "HOSPITALIZE HIM!",
    "LEATHER IT!", "MURDER THAT BALL!", "HE'S A FUCKING DISGRACE!",
    "REF, OPEN YOUR FUCKING EYES!", "YOU'RE ROBBING US!", "HIT HIM AGAIN!",
    "SMASH HIM!", "TAKE HIS LEGS!", "FUCKING LASH IT!",
    "TWO FOOTED TACKLE THE CUNT!", "PUT HIM IN A STRETCHER!", "PUNCH HIM WHEN THE REF AINT LOOKING!",
    "MASH HIM UP!", "HURT THE CUNT!"
  ],
  drunk: [
    "I'M FUCKING WASTED AND YOU'RE STILL SHIT!", "DRUNK AS FUCK AND STILL BETTER THAN YOU!",
    "I'VE HAD TEN BEERS AND I COULD STILL PLAY BETTER!", "FUCKING PISSED AND STILL SMARTER THAN THE REF!",
    "I'M WASTED AND YOU'RE STILL A FUCKING DISGRACE!", "DRUNK OFF MY TITS AND STILL MORE TALENTED!",
    "I'VE BEEN DRINKING ALL DAY AND I'M STILL NOT AS SHIT AS YOU!", "FUCKING MULLERED AND STILL BETTER THAN THIS!",
    "I'M ABSOLUTELY CUNTED AND YOU'RE STILL WORSE!", "DRUNK AS A SKUNK AND STILL NOT AS BAD AS YOU!"
  ],
  saints: [
    "OH WHEN THE SAINTS!", "GO MARCHING IN!", "I WANT TO BE IN THAT NUMBER!",
    "COME ON YOU SAINTS!", "RED AND WHITE ARMY!"
  ]
};





function getDeduplicatedSessionShouts() {
  if (!Array.isArray(S.sessionShouts)) return [];
  return [...new Set(S.sessionShouts)];
}





async function handleManagerConfrontation() {
  // Check if player was drunk during the match - this is the trigger for confrontation
  const isDrunk = S.isDrunk === true;
  
  // Only trigger if drunk during match and not already confronted this match
  if (S.managerConfronted || !isDrunk) {
    return;
  }
  
  // Don't trigger if manager already quit
  if (S.manager_quit_after_apology || !S.manager || !S.manager.name) {
    return;
  }
  
  S.managerConfronted = true;
  
  const shouts = getDeduplicatedSessionShouts();
  const worstTaunt = shouts.find(s => s.includes('fucking') || s.includes('wanker') || s.includes('cunt')) || shouts[0] || 'inappropriate behavior';
  
  // Get manager details
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your manager';
  const quirk = (S?.manager && S.manager.quirk) ? S.manager.quirk : 'none';
  const agree = (S?.manager && typeof S.manager.agreeableness === 'number') ? S.manager.agreeableness : 50;
  const harsh = agree < 40;
  
  log(`${managerName} approaches you after the match...`);
  
  // Quirk-based opening dialogue for touchline behavior
  const touchlineOpeners = {
    'media-friendly': isDrunk 
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! The cameras caught everything. This is a PR nightmare!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - the press will have a field day with this."`,
    'superstitious': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! You've cursed us with this bad energy!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - this kind of negativity attracts bad spirits."`,
    'data-driven': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! This correlates with a 23% drop in xMorale."`
      : `"I heard what you were shouting out there. '${worstTaunt}' - the data shows this behavior impacts team performance."`,
    'old-school': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! This is beneath the dignity of this club!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - we maintain standards here."`,
    "players' coach": isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! The lads are confused and upset!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - the dressing room is in pieces."`,
    'hardliner': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! This is completely unacceptable!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - standards matter, and yours slipped today."`,
    'tinkerer': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! This disrupts everything we're building!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - we're trying to build something here, not tear it down."`,
    'motivator': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! How am I supposed to motivate them after this?"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - I can't lift them up when you're tearing them down."`,
    'disciplinarian': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! Discipline starts at the top!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - we set the example, and today's was poor."`,
    'none': isDrunk
      ? `"I heard what you were shouting out there. '${worstTaunt}' - and you were clearly drunk! This is unacceptable!"`
      : `"I heard what you were shouting out there. '${worstTaunt}' - really?"`
  };
  
  const opener = touchlineOpeners[quirk] || touchlineOpeners['none'];
  log(`${managerName}: ${opener}`);

  // Manager reacts with a short one-part disgust/football line before you speak
  try {
    const managerReactionCategory = harsh ? 'disgust' : 'football';
    const managerReactionLine = generateConversationLine(managerReactionCategory);
    if (managerReactionLine && managerReactionLine !== "I have nothing to say.") {
      log(`${managerName}: "${managerReactionLine}"`);
    }
  } catch (e) {
    // Fail silently if dialogue banks are unavailable
  }
  
  // Three-part quote system similar to press interviews
  log("You need to craft a three-part response...");
  
  // Part 1: Opening statement - Expanded options with random selection
  const allOpeningOptions = isDrunk ? [
    { key: 'defend_drunk1', label: '"Look, I had a few beers to calm my nerves..."', tone: 'defensive' },
    { key: 'defend_drunk2', label: '"I needed something to take the edge off before the match."', tone: 'defensive' },
    { key: 'defend_drunk3', label: '"The pressure of this job is immense, I needed to unwind."', tone: 'defensive' },
    { key: 'deny_drunk1', label: '"I wasn\'t drunk, I was just passionate!"', tone: 'defensive' },
    { key: 'deny_drunk2', label: '"You\'re overreacting - I had maybe one or two."', tone: 'defensive' },
    { key: 'deny_drunk3', label: '"I\'m not drunk, I\'m just fired up about the team!"', tone: 'defensive' },
    { key: 'own_drunk1', label: '"Yeah, I had a drink. So what?"', tone: 'aggressive' },
    { key: 'own_drunk2', label: '"I\'m the chairman, I can have a drink if I want!"', tone: 'aggressive' },
    { key: 'own_drunk3', label: '"What\'s wrong with having a few pints before a match?"', tone: 'aggressive' },
    { key: 'blame_stress1', label: '"This job is driving me to drink!"', tone: 'justifying' },
    { key: 'blame_stress2', label: '"You try running a football club without needing a drink!"', tone: 'justifying' },
    { key: 'blame_stress3', label: '"The stress of this position is unbelievable!"', tone: 'justifying' },
    { key: 'deflect1', label: '"You should be more concerned about the team\'s performance than my drinking."', tone: 'deflecting' },
    { key: 'deflect2', label: '"Focus on the football, not what I\'m drinking."', tone: 'deflecting' },
    { key: 'deflect3', label: '"The real problem is the players, not me having a pint."', tone: 'deflecting' }
  ] : [
    { key: 'defend_sober1', label: '"I was just showing my passion for the team."', tone: 'defensive' },
    { key: 'defend_sober2', label: '"I care deeply about this club and it shows."', tone: 'defensive' },
    { key: 'defend_sober3', label: '"My passion for Southampton is unmatched."', tone: 'defensive' },
    { key: 'apologize_sober1', label: '"I understand your concerns about my language."', tone: 'apologetic' },
    { key: 'apologize_sober2', label: '"I realize my words may have been too strong."', tone: 'apologetic' },
    { key: 'apologize_sober3', label: '"I acknowledge that my behavior was inappropriate."', tone: 'apologetic' },
    { key: 'dismiss_sober1', label: '"The fans expect passion from their chairman."', tone: 'dismissive' },
    { key: 'dismiss_sober2', label: '"This is football, not a tea party."', tone: 'dismissive' },
    { key: 'dismiss_sober3', label: '"You\'re making too much of this."', tone: 'dismissive' },
    { key: 'passion1', label: '"I wear my heart on my sleeve for this club."', tone: 'passionate' },
    { key: 'passion2', label: '"My love for Southampton drives everything I do."', tone: 'passionate' },
    { key: 'passion3', label: '"I\'m not ashamed of caring too much."', tone: 'passionate' },
    { key: 'fans1', label: '"The supporters want to see their chairman care."', tone: 'fan-focused' },
    { key: 'fans2', label: '"I represent the fans\' passion out there."', tone: 'fan-focused' },
    { key: 'fans3', label: '"The fans pay good money to see commitment."', tone: 'fan-focused' },
    { key: 'results1', label: '"We need to focus on results, not my choice of words."', tone: 'results-focused' },
    { key: 'results2', label: '"The important thing is winning, not how I express myself."', tone: 'results-focused' },
    { key: 'results3', label: '"Let\'s talk about the football, not my language."', tone: 'results-focused' }
  ];
  
  // Randomly select 3 options from the full list
  const openingOptions = allOpeningOptions.sort(() => Math.random() - 0.5).slice(0, 3);
  
  const opening = await choose(openingOptions, 'Choose your opening statement:');
  
  // Part 2: Main argument - Expanded options with random selection
  const allMainOptions = isDrunk ? [
    { key: 'blame_stress1', label: '"The pressure of this job is immense, I needed to unwind."', tone: 'justifying' },
    { key: 'blame_stress2', label: '"Running a football club is more stressful than you can imagine."', tone: 'justifying' },
    { key: 'blame_stress3', label: '"The financial pressure alone would drive anyone to drink."', tone: 'justifying' },
    { key: 'blame_team1', label: '"The team\'s performance was so poor, anyone would need a drink!"', tone: 'blaming' },
    { key: 'blame_team2', label: '"Watching that shambles would make anyone reach for the bottle."', tone: 'blaming' },
    { key: 'blame_team3', label: '"I drink because the players give me nothing else to celebrate."', tone: 'blaming' },
    { key: 'deflect1', label: '"You should be more concerned about the players\' performance than my drinking."', tone: 'deflecting' },
    { key: 'deflect2', label: '"The real issue is the team\'s lack of effort, not my drinking."', tone: 'deflecting' },
    { key: 'deflect3', label: '"Focus on fixing the squad instead of criticizing my habits."', tone: 'deflecting' },
    { key: 'pressure1', label: '"Every decision I make affects hundreds of people - that\'s pressure!"', tone: 'justifying' },
    { key: 'pressure2', label: '"The media scrutiny is relentless, I need something to cope."', tone: 'justifying' },
    { key: 'pressure3', label: '"You try making transfer decisions while sober - it\'s impossible!"', tone: 'justifying' },
    { key: 'culture1', label: '"This is football culture - everyone drinks in this business."', tone: 'deflecting' },
    { key: 'culture2', label: '"Half the managers in this league drink more than I do."', tone: 'deflecting' },
    { key: 'culture3', label: '"You\'re being naive if you think I\'m the only one drinking."', tone: 'deflecting' }
  ] : [
    { key: 'passion1', label: '"Passion is what drives this club forward."', tone: 'passionate' },
    { key: 'passion2', label: '"Without passion, we\'re just another mediocre club."', tone: 'passionate' },
    { key: 'passion3', label: '"My passion for Southampton is what makes us special."', tone: 'passionate' },
    { key: 'fans1', label: '"The fans want to see their chairman care about the team."', tone: 'fan-focused' },
    { key: 'fans2', label: '"I represent the supporters\' emotions out there."', tone: 'fan-focused' },
    { key: 'fans3', label: '"The fans pay good money to see commitment and passion."', tone: 'fan-focused' },
    { key: 'results1', label: '"We need to focus on results, not my choice of words."', tone: 'results-focused' },
    { key: 'results2', label: '"The important thing is winning, not how I express myself."', tone: 'results-focused' },
    { key: 'results3', label: '"Let\'s talk about the football, not my language."', tone: 'results-focused' },
    { key: 'leadership1', label: '"A chairman should show leadership and determination."', tone: 'leadership' },
    { key: 'leadership2', label: '"I\'m setting an example of how much this club means to me."', tone: 'leadership' },
    { key: 'leadership3', label: '"Strong leadership requires strong emotions."', tone: 'leadership' },
    { key: 'tradition1', label: '"This club has a tradition of passionate chairmen."', tone: 'traditional' },
    { key: 'tradition2', label: '"Southampton deserves a chairman who cares deeply."', tone: 'traditional' },
    { key: 'tradition3', label: '"I\'m upholding the values this club was built on."', tone: 'traditional' },
    { key: 'investment1', label: '"I\'ve invested everything in this club - of course I care!"', tone: 'invested' },
    { key: 'investment2', label: '"My money, my reputation, my heart - all in Southampton."', tone: 'invested' },
    { key: 'investment3', label: '"I have more at stake here than anyone else."', tone: 'invested' }
  ];
  
  // Randomly select 3 options from the full list
  const mainOptions = allMainOptions.sort(() => Math.random() - 0.5).slice(0, 3);
  
  const main = await choose(mainOptions, 'Choose your main argument:');
  
  // Part 3: Closing statement - Expanded options with random selection
  const allClosingOptions = isDrunk ? [
    { key: 'promising1', label: '"I\'ll try to keep it under control next time."', tone: 'promising' },
    { key: 'promising2', label: '"I\'ll cut back on the drinking before matches."', tone: 'promising' },
    { key: 'promising3', label: '"I\'ll be more professional next time."', tone: 'promising' },
    { key: 'defiant1', label: '"I\'m not changing who I am for anyone."', tone: 'defiant' },
    { key: 'defiant2', label: '"This is who I am - take it or leave it."', tone: 'defiant' },
    { key: 'defiant3', label: '"I won\'t apologize for being myself."', tone: 'defiant' },
    { key: 'dismissive1', label: '"This conversation is over."', tone: 'dismissive' },
    { key: 'dismissive2', label: '"I\'ve heard enough of this nonsense."', tone: 'dismissive' },
    { key: 'dismissive3', label: '"We\'re done here."', tone: 'dismissive' },
    { key: 'blame1', label: '"If the team played better, I wouldn\'t need to drink."', tone: 'blaming' },
    { key: 'blame2', label: '"Fix the squad and I\'ll fix my drinking."', tone: 'blaming' },
    { key: 'blame3', label: '"The players are the real problem here."', tone: 'blaming' },
    { key: 'justify1', label: '"Everyone in football drinks - it\'s normal."', tone: 'justifying' },
    { key: 'justify2', label: '"You\'re making a big deal out of nothing."', tone: 'justifying' },
    { key: 'justify3', label: '"This is just how I cope with the pressure."', tone: 'justifying' }
  ] : [
    { key: 'commitment1', label: '"I\'m committed to this club\'s success."', tone: 'committed' },
    { key: 'commitment2', label: '"My dedication to Southampton is unwavering."', tone: 'committed' },
    { key: 'commitment3', label: '"I\'ll do whatever it takes to make this club great."', tone: 'committed' },
    { key: 'understanding1', label: '"I understand your position, but I stand by my passion."', tone: 'understanding' },
    { key: 'understanding2', label: '"I respect your concerns, but I won\'t change my approach."', tone: 'understanding' },
    { key: 'understanding3', label: '"I hear you, but my passion is what drives this club."', tone: 'understanding' },
    { key: 'moving_on1', label: '"Let\'s focus on the next match."', tone: 'forward-looking' },
    { key: 'moving_on2', label: '"We have bigger things to worry about."', tone: 'forward-looking' },
    { key: 'moving_on3', label: '"Let\'s put this behind us and move forward."', tone: 'forward-looking' },
    { key: 'leadership1', label: '"I lead by example - passionate and committed."', tone: 'leadership' },
    { key: 'leadership2', label: '"A strong chairman shows strong emotions."', tone: 'leadership' },
    { key: 'leadership3', label: '"I\'m setting the standard for how much this club means."', tone: 'leadership' },
    { key: 'fans1', label: '"The fans deserve a chairman who cares as much as they do."', tone: 'fan-focused' },
    { key: 'fans2', label: '"I represent every Southampton supporter out there."', tone: 'fan-focused' },
    { key: 'fans3', label: '"The fans want to see passion from their chairman."', tone: 'fan-focused' },
    { key: 'results1', label: '"What matters is winning, not how I express myself."', tone: 'results-focused' },
    { key: 'results2', label: '"Let\'s focus on getting results on the pitch."', tone: 'results-focused' },
    { key: 'results3', label: '"The only thing that matters is success."', tone: 'results-focused' }
  ];
  
  // Randomly select 3 options from the full list
  const closingOptions = allClosingOptions.sort(() => Math.random() - 0.5).slice(0, 3);
  
  const closing = await choose(closingOptions, 'Choose your closing statement:');
  
  // Construct the full quote
  const openingText = openingOptions.find(o => o.key === opening)?.label || '';
  const mainText = mainOptions.find(o => o.key === main)?.label || '';
  const closingText = closingOptions.find(o => o.key === closing)?.label || '';
  
  const fullQuote = `${openingText} ${mainText} ${closingText}`;
  
  log(`You respond: ${fullQuote}`);
  
  // Add brick throwing option if player has a brick
  if (hasBrickEquipped()) {
    const brickChoice = await choose([
      { key: 'continue', label: 'Continue the conversation' },
      { key: 'throw_brick', label: 'Throw brick at manager (guaranteed arrest)', variant: 'bad' }
    ], 'What do you do?');
    
    if (brickChoice === 'throw_brick') {
      log("You hurl a brick at your manager!");
      log("Security immediately swarms and you are arrested on the spot.");
      
      // Apply arrest consequences
      const fineChair = 50000 + Math.floor(Math.random() * 50000);
      const fineClub = Math.round(fineChair * 1.2);
      
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
      S.police_risk = Math.min(100, (S.police_risk || 0) + 30);
      S.legal_risk = Math.min(100, (S.legal_risk || 0) + 15);
      S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 20);
      S.reputation = Math.max(0, (S.reputation || 0) - 25);
      
      log(`CONSEQUENCES: Personal fine ${money(fineChair)}, Club fine ${money(fineClub)}`);
      
      // Queue police investigation
      if (!S._pending_police_investigation) {
        S._pending_police_investigation = { 
          authority: 'police', 
          caseType: 'assault on manager',
          description: 'Throwing brick at manager during confrontation'
        };
      }
      
      // Remove brick from inventory after use
      removeItem('Brick', 1);
      return;
    }
  }
  
  // Apply consequences based on response tones
  const openingTone = openingOptions.find(o => o.key === opening)?.tone || '';
  const mainTone = mainOptions.find(o => o.key === main)?.tone || '';
  const closingTone = closingOptions.find(o => o.key === closing)?.tone || '';
  
  let moraleChange = 0;
  let reputationChange = 0;
  
  if (isDrunk) {
    // Drunk responses generally have negative consequences
    if (openingTone === 'defensive' && mainTone === 'justifying' && closingTone === 'promising') {
      moraleChange = -1; // Slight negative for drunk but promising to change
      reputationChange = -2;
    } else if (openingTone === 'aggressive' || mainTone === 'blaming' || closingTone === 'defiant') {
      moraleChange = -5; // Significant negative for aggressive drunk responses
      reputationChange = -8;
    } else {
      moraleChange = -3; // Default negative for drunk responses
      reputationChange = -5;
    }
  } else {
    // Sober responses have more nuanced consequences
    if (openingTone === 'apologetic' && mainTone === 'fan-focused' && closingTone === 'understanding') {
      moraleChange = 2; // Positive for diplomatic response
      reputationChange = 1;
    } else if (openingTone === 'dismissive' || mainTone === 'results-focused' || closingTone === 'forward-looking') {
      moraleChange = 0; // Neutral for business-focused response
      reputationChange = 0;
    } else {
      moraleChange = -1; // Slight negative for other responses
      reputationChange = -1;
    }
  }
  
  S.morale = Math.max(-100, Math.min(100, (S.morale || 0) + moraleChange));
  S.reputation = Math.max(0, (S.reputation || 0) + reputationChange);
  
  // Manager gives a simple one-part response (not a three-part quote - that's for texts)
  try {
    if (isDrunk) {
      // When drunk, use a single random line from an array that relates to the tenor of what was said
      let responseArray = [];
      
      if (openingTone === 'aggressive' || mainTone === 'blaming' || closingTone === 'defiant') {
        // Aggressive/defiant responses
        responseArray = [
          "That performance was sewage——from the cheap fouls and rolling around. We're better than this filth.",
          "This is a FUCKING disgrace——YOU STUPID WOMAN. Make it right.",
          "That turned my stomach——from the lack of effort out there. I feel sick thinking about it.",
          "You're making a mockery of this club with that attitude.",
          "I can't work with someone who talks to me like that when they're drunk.",
          "This is completely unprofessional. You're embarrassing the entire club.",
          "The players deserve better than a chairman who can't control themselves.",
          "You're destroying everything we're trying to build here."
        ];
      } else if (closingTone === 'promising') {
        // Promising to change
        responseArray = [
          "I'll hold you to that. One more drunk match and I'm gone.",
          "We'll see if you can actually follow through on that promise.",
          "Actions speak louder than words. Prove it next match.",
          "I hope you mean that, because this can't happen again.",
          "Good. Now let's focus on getting the team back on track.",
          "I appreciate you saying that, but I need to see it happen."
        ];
      } else if (openingTone === 'defensive' || mainTone === 'deflecting') {
        // Defensive/deflecting responses
        responseArray = [
          "Fans are circling this——the local rag smells blood. I'll speak to PR.",
          "The analytic flagged problems——we'll send a pep talk. We'll make that change.",
          "Gaffer's tension——we'll plan the set piece. I'll back the coach.",
          "We should back the manager——the goalkeeper was shaky. I'll call a meeting.",
          "We must protect the kid——we'll address discipline. I'll call a meeting.",
          "This is going to be a PR nightmare. I need to do damage control.",
          "The media will have a field day with this. We need to prepare a statement."
        ];
      } else {
        // Default drunk responses
        responseArray = [
          "I heard what you were shouting out there. This is unacceptable!",
          "You need to get yourself under control before the next match.",
          "This behavior is beneath the dignity of this club.",
          "The lads are confused and upset about what happened.",
          "How am I supposed to motivate them after this?",
          "Discipline starts at the top, and you're setting a terrible example.",
          "This disrupts everything we're building here."
        ];
      }
      
      const managerLine = pick(responseArray);
      log(`${managerName}: "${managerLine}"`);
    } else {
      // Sober responses - use existing system
      let reactionCategory = 'football';
      if (openingTone === 'apologetic' && mainTone === 'fan-focused') {
        reactionCategory = 'affectionate';
      } else if (mainTone === 'results-focused' || closingTone === 'forward-looking') {
        reactionCategory = 'money';
      } else {
        reactionCategory = 'football';
      }

      const managerLine = generateConversationLine(reactionCategory);
      if (managerLine && managerLine !== "I have nothing to say.") {
        log(`${managerName}: "${managerLine}"`);
      }
    }
  } catch (e) {
    // Fallback to simple summary if banks are unavailable
    if (moraleChange > 0) {
      log(`${managerName} appreciates your response and the team morale improves slightly.`);
    } else if (moraleChange < 0) {
      log(`${managerName} is disappointed with your response and team morale suffers.`);
    } else {
      log(`${managerName} accepts your response with mixed feelings.`);
    }
  }
  
  // Reset the confrontation flag after completion
  S.managerConfronted = false;
  
  // Reset drunk flag after confrontation (so it doesn't persist to next match)
  S.isDrunk = false;
}


// Handle brick throwing in conversation
async function handleConversationBrickThrowing(contactName) {
  if (!hasBrickEquipped()) {
    log("You don't have a brick equipped!");
    return;
  }
  
  log(`You hurl a brick at ${contactName}!`);
  log("The contact is shocked and immediately calls security.");
  log("You are arrested on the spot for assault.");
  
  // Apply arrest consequences
  const fineChair = 25000 + Math.floor(Math.random() * 25000);
  const fineClub = Math.round(fineChair * 1.1);
  
  S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
  S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
  S.police_risk = Math.min(100, (S.police_risk || 0) + 20);
  S.legal_risk = Math.min(100, (S.legal_risk || 0) + 5);
  S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 6);
  S.reputation = Math.max(0, (S.reputation || 0) - 15);
  
  log(`CONSEQUENCES: Personal fine ${money(fineChair)}, Club fine ${money(fineClub)}`);
  
  // Queue police investigation
  if (!S._pending_police_investigation) {
    S._pending_police_investigation = { 
      authority: 'police', 
      caseType: 'assault in conversation',
      description: 'Throwing objects during conversation'
    };
  }
  
  // Remove brick from inventory after use
  removeItem('Brick', 1);
}

// ---- WRAPPER so placeBetMenu() has odds in {home,draw,away}
// ---- Wrapper so betting UI has {home, draw, away} odds ----
function computeMatchOdds(){
  // Ensure odds exist (from computePreMatchStrengthsAndOdds)
  if (!S.preMatch) S.preMatch = {};
  if (!S.preMatch.odds) computePreMatchStrengthsAndOdds(); // fills {usOdds, themOdds}

  const us   = S.preMatch.odds?.usOdds   ?? 2.0;   // Southampton
  const them = S.preMatch.odds?.themOdds ?? 2.0;   // Opponents

  // Derive a simple fair-ish draw line from both prices (tweak later if you like)
  const draw = +(Math.max(1.20, ((us + them) / 2) * 0.85)).toFixed(2);

  return {
    home: +(+us).toFixed(2),
    draw: +draw,
    away: +(+them).toFixed(2),
  };
}










async function chooseSecretaryQuickHire(){
  if(S.secretary_hired) return;

  // Generate multiple secretary candidates with varied descriptions
  const secretaries = [
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "22",
      description: "Big eyes...erotic smile...lovely figure..mmm.",
      appeal: 8,
      compliance: 0,
      romance: true,
      style: "young"
    },
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "24", 
      description: "You can tell she is a very naughty girl in secret...so horny...",
      appeal: 7,
      compliance: 1,
      romance: true,
      style: "young"
    },
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "26",
      description: "Much lesss attractive than the others",
      appeal: 6,
      compliance: 2,
      romance: true,
      style: "young"
    },
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "28",
      description: "Seductive yet erotic body and eyes.",
      appeal: 5,
      compliance: 3,
      romance: true,
      style: "young"
    },
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "30",
      description: "A sight for sore eyes. Presumably able to do the job too.",
      appeal: 4,
      compliance: 4,
      romance: true,
      style: "young"
    },
    {
      name: pick(FEMALE_NAMES) + " " + pick(SURNAMES),
      age: "32",
      description: "Yuck! Very average looking!",
      appeal: 2,
      compliance: 5,
      romance: false,
      style: "experienced"
    }
  ];

  log("Secretary hiring — skip interviews and choose directly:");

  const options = secretaries.map((sec, i) => ({
    key: String(i + 1),
    label: `Hire ${sec.name} (${sec.age}) - ${sec.description}`
  }));

  const choice = await choose(options, "Select your secretary:");

  const selectedIndex = parseInt(choice, 10) - 1;
  const selected = secretaries[selectedIndex];

  S.secretary_hired = true;
  S.secretary_style = selected.style;
  S.secretary_name = selected.name;
  // Gen Z appeal removed
  S.compliance_risk = Math.max(0,(S.compliance_risk||0) - selected.compliance);
  S.secretary_romance_possible = selected.romance;
  
  // Initialize messaging system state
  initializeSecretaryMessagingState();
  log(`You hired ${S.secretary_name}.`);
  render();
}

function preMatchResetFlags(){
  S.visited_ownLocker = false;
  S.visited_oppLocker = false;
  S.spoke_to_team_this_prematch = false;
  S.bet_locked_this_prematch = false;
  if (!S.preMatch) S.preMatch = {};
  S.preMatch.betLocked = false;
  
  // Clear cocaine crashing state at start of pre-match
  if (S.coke_state === "crashing") {
    S.coke_state = "sober";
  }
  S.visitors_handled = false;
  S.preMatch.initialized = false;

  // NEW: reset opponent room one-time actions
  S.did_opp_action = false;
  S.did_opp_rummage = false;
  S.referee_bribed = false;
  S.referee_assaulted = false;
  S.opponent_bribed = false;
}

// ---------- Locker-room helpers (single copy) ----------

// Unified “steal/do nothing” choice UI
async function presentRummageChoices(find){
  if (!S.inventory) S.inventory = { accolades: [], drugs: 0 };
  const title = find.side === "opp" ? "Opposition Rummage" : "Your Locker Room Rummage";

  let desc = "You root through the bag";
  if (find.playerName) desc += ` of ${find.playerName}`;
  desc += " and find:\n";
  if (find.money)    desc += `• £${find.money}\n`;
  if (find.accolade) desc += `• An accolade: ${find.accolade.name}\n`;
  if (find.miscItem) desc += `• ${find.miscItem.name}\n`;
  if (find.drugs)    desc += `• A suspicious little bag (drugs)\n`;
  if (!find.money && !find.accolade && !find.miscItem && !find.drugs) desc += "• Nothing of note.\n";

  const choices = [];
  if (find.money)    choices.push({ key:"cash", label:`Steal Cash (£${find.money})` });
  if (find.accolade) choices.push({ key:"acc",  label:`Steal Accolade ("${find.accolade.name}")` });
  if (find.miscItem) choices.push({ key:"misc", label:`Steal ${find.miscItem.name}` });
  if (find.drugs)    choices.push({ key:"drug", label:"Steal Mysterious Drugs" });
  choices.push({ key:"none", label:"Back out (do nothing)" });

  const k = await choose(choices, title);

  if (k==="cash"){
    if (find.side === "opp"){
      S.chairman_cash += find.money; // opponent loot goes to YOU
      incrementRisk("rummage_opp_cash", 3); // police risk
    } else {
      S.chairman_cash += find.money; // own-team loot also to YOU
      incrementRisk("rummage_cash", 1);      // compliance risk

    }
// remember the most recent theft so "Plant cash" can appear later
if (!S.stolen) S.stolen = { last_rummage_cash:0, last_rummage_side:null, planted_cash_target:null };
S.stolen.last_rummage_cash = find.money;
S.stolen.last_rummage_side = (find.side === 'opp') ? 'opp' : 'own';

    log("Quietly folded away. No one's the wiser—for now.");
  } else if (k==="acc"){
    // Auto-stash accolade into new inventory system
    const accoladeValue = find.accolade.value || 0;
    addItem({ 
      name: find.accolade.name, 
      type: "trophy", 
      quantity: 1, 
      baseValue: accoladeValue, 
      sellable: true 
    });
    incrementRisk(find.side === "opp" ? "rummage_opp_acc" : "rummage_acc", 2);
    log(`You stashed "${find.accolade.name}" in the club inventory. You can sell it later.`);
  } else if (k==="misc"){
    // Auto-stash misc item into new inventory system
    addItem({ 
      name: find.miscItem.name, 
      type: "misc", 
      quantity: 1, 
      baseValue: find.miscItem.value, 
      sellable: true 
    });
    incrementRisk(find.side === "opp" ? "rummage_opp_acc" : "rummage_acc", 1);
    log(`You stashed "${find.miscItem.name}" in the club inventory. You can sell it later.`);
  } else if (k==="drug"){
    S.inventory.drugs += 1;
    incrementRisk(find.side === "opp" ? "rummage_opp_drugs" : "rummage_drugs", 3);
    log("That's going to be trouble one day.");
  } else {
    log("You think better of it and leave things as they were.");
  }
}

// Backwards compatible wrapper used elsewhere
async function rummageLoot(side){
  const starters = getOurSelectedFive();
  const target = side === "own"
    ? await choose(starters.map((p,i)=>({key:String(i),label:`${p.name} (${p.rating})`})), "Whose bag do you rummage?")
    : null;
  const playerObj = side === "own" ? starters[Number(target)] : null;
  const find = generateRummageFind(playerObj, side);
  await presentRummageChoices(find);
}

// --- helper: narrate morale change safely ---
// --- helper: narrate morale change safely ---
function logMoraleDelta(delta){
  if (typeof delta !== 'number') return;
  const up = [
    "The room lifts a little.",
    "You feel the mood lighten.",
    "Heads nod; spirits rise.",
    "A flicker of belief returns."
  ];
  const down = [
    "The room goes cold.",
    "Murmurs ripple; shoulders sag.",
    "Faces tighten; tension thickens.",
    "You sense a rift opening."
  ];
  // if you already have pick(arr), this will use it.
  const _pick = (typeof pick === 'function')
    ? pick
    : (arr)=>arr[Math.floor(Math.random()*arr.length)];
  log(delta >= 0 ? _pick(up) : _pick(down));
}

