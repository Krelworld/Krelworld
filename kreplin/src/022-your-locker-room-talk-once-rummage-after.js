// ---------- Your locker room (talk once; rummage after talk) ----------
async function yourLockerRoomMenu(){
  if (S.visited_ownLocker) { log("You've already been in here this pre-match."); return; }

  const choices = [
    { key:"linger", label:"Linger & Rummage (after the team leaves)" },
    { key:"leave",  label:"Leave locker room" }
  ];
  
  // Add team talk option if not done yet
  if (!S.spoke_to_team_this_prematch){
    choices.splice(0, 0, { key:"talk", label:"Give team talk" });
  }
  
  // Add HGH option if player has HGH stock
  if (S.doctor && S.doctor.hgh_stock > 0) {
    choices.splice(1, 0, { key:"hgh", label:"Give HGH to players (enhance performance)" });
  }
  
  // Add cocaine option if player has cocaine in inventory
  if (S.inventory && (S.inventory.drugs || 0) > 0) {
    choices.splice(1, 0, { key:"cocaine", label:"Give cocaine to players (hyper aggression)" });
  }
  
  // Add ozempic option if players are obese from McDonald's
  const obesePlayers = Array.isArray(S.squad) ? S.squad.filter(p => p.obese) : [];
  if (obesePlayers.length > 0 && S.doctor && (S.doctor.ozempic_stock || 0) >= obesePlayers.length) {
    choices.splice(1, 0, { key:"ozempic", label:`Cure team obesity with Ozempic (${obesePlayers.length} doses needed)` });
  }
  
  const choice = await choose(choices, "Your Locker Room");

  if (choice==="talk"){
    await conductLockerRoomChat();
    S.spoke_to_team_this_prematch = true;
    render();
    // Return to menu after team talk
    return await yourLockerRoomMenu();
  } else if (choice==="linger"){
    const starters = getOurSelectedFive();
    const sel = await choose(starters.map((p,i)=>({key:String(i),label:`Rummage ${p.name} (${p.rating})`})), "Choose a bag to rummage");
    if (sel){
      const find = generateRummageFind(starters[Number(sel)], "own");
      await presentRummageChoices(find);
    }
  } else if (choice==="hgh"){
    await giveHGHToPlayers();
  } else if (choice==="cocaine"){
    await giveCocaineToPlayers();
  } else if (choice==="ozempic"){
    await window.cureTeamObesity();
  }
  S.visited_ownLocker = true;   // one visit per match
  render();
}

// HGH giving system
async function giveHGHToPlayers() {
  if (!S.doctor || S.doctor.hgh_stock <= 0) {
    log('You don\'t have any HGH to give.');
    return;
  }
  
  const starters = getOurSelectedFive();
  const choices = starters.map((p, i) => ({
    key: String(i),
    label: `Give HGH to ${p.name} (Rating: ${p.rating})`
  }));
  
  choices.push({ key: "all", label: "Give HGH to all players" });
  choices.push({ key: "cancel", label: "Cancel" });
  
  const choice = await choose(choices, "Give HGH to Players");
  
  if (choice === "cancel") return;
  
  if (choice === "all") {
    // Give HGH to all players
    if (S.doctor.hgh_stock < starters.length) {
      log(`You only have ${S.doctor.hgh_stock} HGH doses, but need ${starters.length} for all players.`);
      return;
    }
    
    S.doctor.hgh_stock -= starters.length;
    log(`You give HGH to all ${starters.length} players. They look noticeably more muscular and aggressive.`);
    
    // Apply effects to all players
    starters.forEach(player => {
      if (!player.hgh_doses) player.hgh_doses = 0;
      if (!player.hgh_matches_used) player.hgh_matches_used = 0;
      player.hgh_doses++;
      player.hgh_matches_used++;
      player.rating = Math.min(99, player.rating + 3); // Boost rating
      player.on_hgh_this_match = true; // Flag for match commentary
      
      // Check for heart attack (increases with frequency)
      const heartAttackChance = Math.min(0.15, 0.02 + (player.hgh_matches_used * 0.03));
      if (player.hgh_matches_used >= 2 && Math.random() < heartAttackChance) {
        triggerHGHHeartAttack(player);
        return; // Skip roid rage if heart attack occurs
      }
      
      // Check for roid rage
      if (player.hgh_doses >= 3 && Math.random() < 0.4) {
        triggerRoidRage(player);
      }
    });
    
    log('All players receive a +3 rating boost from HGH!');
    
  } else {
    // Give HGH to specific player
    const playerIndex = parseInt(choice);
    const player = starters[playerIndex];
    
    S.doctor.hgh_stock--;
    log(`You give HGH to ${player.name}. He looks noticeably more muscular and aggressive.`);
    
    if (!player.hgh_doses) player.hgh_doses = 0;
    if (!player.hgh_matches_used) player.hgh_matches_used = 0;
    player.hgh_doses++;
    player.hgh_matches_used++;
    player.rating = Math.min(99, player.rating + 3); // Boost rating
    player.on_hgh_this_match = true; // Flag for match commentary
    
    // Check for heart attack (increases with frequency)
    const heartAttackChance = Math.min(0.15, 0.02 + (player.hgh_matches_used * 0.03));
    if (player.hgh_matches_used >= 2 && Math.random() < heartAttackChance) {
      triggerHGHHeartAttack(player);
      return; // Skip roid rage if heart attack occurs
    }
    
    log(`${player.name} receives a +3 rating boost from HGH!`);
    
    // Check for roid rage
    if (player.hgh_doses >= 3 && Math.random() < 0.4) {
      triggerRoidRage(player);
    }
  }
  
  // Increase doping scandal risk
  if (!S.doping_scandal_risk) S.doping_scandal_risk = 0;
  S.doping_scandal_risk += 5;
  
  // Update doctor UI if open
  if (typeof window.renderDoctor === 'function') {
    window.renderDoctor();
  }
}

// HGH heart attack system
async function triggerHGHHeartAttack(player) {
  log(`💔 ${player.name} collapses on the pitch! Medical staff rush to his aid...`);
  log(`The doctors confirm it: ${player.name} has died of a heart attack.`);
  log('The HGH abuse has taken its toll. The player\'s heart couldn\'t handle the strain.');
  
  // Remove player from squad
  const squadIndex = S.squad.findIndex(p => p.name === player.name);
  if (squadIndex !== -1) {
    S.squad.splice(squadIndex, 1);
  }
  
  // Massive doping scandal
  triggerMassiveDopingScandal(player);
  
  // Store flag for post-match Delmor messages (don't trigger during match)
  if (!S.pending_hgh_death_delmor) S.pending_hgh_death_delmor = [];
  S.pending_hgh_death_delmor.push(player.name);
  
  // Reset HGH tracking
  player.hgh_doses = 0;
  player.hgh_matches_used = 0;
}

// Cocaine heart attack system (rare, long-term abuse consequence)
async function triggerCocaineHeartAttack(player) {
  if (!player || !player.name) return;

  log(`💔 ${player.name} collapses on the pitch! Medical staff rush to his aid...`);
  log(`The doctors confirm it: ${player.name} has suffered a fatal heart attack.`);
  log(`Whispers swirl about long-term cocaine abuse finally catching up with him.`);

  // Mark player as permanently unavailable
  player.is_dead = true;

  // Remove from squad for simplicity – they will never be available again
  if (Array.isArray(S?.squad)) {
    const idx = S.squad.findIndex(p => p && p.name === player.name);
    if (idx !== -1) {
      S.squad.splice(idx, 1);
    }
  }

  // Modest scandal compared to HGH
  const fine = 150000 + Math.floor(Math.random() * 150000);
  S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fine);
  S.reputation = Math.max(0, (S.reputation || 50) - 10);

  log(`💸 You are fined £${fine.toLocaleString()} over the cocaine scandal and player death.`);
  log(`📉 Your reputation takes a hit, but the focus is on the tragedy rather than systemic abuse.`);

  setTimeout(() => {
    if (typeof addPaper === 'function') {
      addPaper(`Southampton player dies after suspected cocaine abuse – questions for the chairman`, 12);
    } else {
      log('📰 BREAKING: Reports emerge of a cocaine-related heart attack on the pitch.');
    }
  }, 2500);
  
  // Delmor Krunchem mocking text
  setTimeout(() => {
    if (typeof window.enqueueRivalText === 'function') {
      window.enqueueRivalText('HA HA. I\'m so happy your player died. This is the best news I\'ve heard all week.');
    } else {
      log(`📱 Delmor Krunchem: "HA HA. I'm so happy your player died. This is the best news I've heard all week."`);
    }
  }, 1500);
  
  // Trigger press interview immediately (don't use setTimeout - it doesn't await properly)
  // Queue it to run after a short delay to allow death message to be seen
  await new Promise(resolve => setTimeout(resolve, 2000));
  await playerDeathPressInterview(player, 'cocaine');
}

// Suicide threat resignation handler
// IMPORTANT: This function should ONLY be called AFTER the match has finished
async function handleSuicideThreatResignation() {
  const S = window.S || (window.S = {});
  
  // Get a random player to resign (from the squad, not just starters, since match is over)
  const squad = Array.isArray(S.squad) ? S.squad : [];
  if (squad.length === 0) return;
  
  const resigningPlayer = pick(squad);
  if (!resigningPlayer || !resigningPlayer.name) return;
  
  log("");
  log("---");
  log("");
  
  // Manager confrontation - get manager name
  const managerName = (S.manager && S.manager.name) ? S.manager.name : 'The manager';
  
  // Manager confrontation
  log(`${managerName} approaches you after the match.`);
  log(`"The players are sick of you threatening to kill yourself," he says. "This has to stop."`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log("");
  log("How do you respond?");
  
  const responseOptions = [
    {key: 'apologize', label: 'Apologize and promise to stop', variant: 'good'},
    {key: 'threaten', label: 'Threaten to kill yourself unless he drops the subject', variant: 'bad'}
  ];
  
  const responseChoice = await choose(
    responseOptions.map(opt => ({key: opt.key, label: opt.label, variant: opt.variant})),
    'What do you say?'
  );
  
  if (responseChoice === 'apologize') {
    log(`"I'm sorry. You're right. I'll stop doing that."`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    log(`${managerName} nods. "Good. Let's move forward."`);
    // Reset suicide threat count to prevent immediate repeat
    S.suicide_threat_count = 0;
  } else if (responseChoice === 'threaten') {
    log(`"If you don't drop this subject right now, I will kill myself. I mean it."`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    log(`${managerName}'s face pales. "Alright, alright. I'm sorry. I'll drop it."`);
    log(`He backs away, clearly shaken.`);
    // Don't reset count - player still resigns
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Player resigns regardless of response
  const squadIndex = S.squad.findIndex(p => p.name === resigningPlayer.name);
  if (squadIndex !== -1) {
    S.squad.splice(squadIndex, 1);
    log(`💔 ${resigningPlayer.name} has resigned from the club. "I'm sick of you threatening to kill yourself," he says as he walks out.`);
    
    if (typeof addPaper === 'function') {
      addPaper(`${resigningPlayer.name} resigns from Southampton, cites chairman's repeated suicide threats`, 15);
    }
  }
  
  log("");
  log("---");
  log("");
}

// Player death press interview system
async function playerDeathPressInterview(player, drugType, isOverdose = false) {
  const S = window.S || (window.S = {});
  const playerName = player.name || 'a player';
  const drugName = drugType === 'HGH' ? 'HGH' : 'cocaine';
  
  log("");
  log("📰 A reporter from The Sun approaches you with a microphone.");
  // Check if this is an overdose (from post-match processing) or heart attack
  if (isOverdose && drugType === 'cocaine') {
    log(`📰 "Mr. Chairman, ${playerName} has just died from a cocaine overdose. What do you have to say?"`);
  } else {
    log(`📰 "Mr. Chairman, ${playerName} has just died of a heart attack after taking too much ${drugName}. What do you have to say?"`);
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log("");
  log("Choose your quote...");
  
  // First question: Quote selection
  const quoteOptions = [
    {key: 'heartfelt', label: 'Heartfelt (genuine grief and remorse)', variant: 'good'},
    {key: 'cynical', label: 'Cynical ("life goes on")', variant: 'bad'},
    {key: 'humor1', label: 'Inappropriate humor: "At least he died doing what he loved - being on drugs."', variant: 'warn'},
    {key: 'humor2', label: 'Inappropriate humor: "Well, that\'s one less player to pay wages to."', variant: 'warn'},
    {key: 'humor3', label: 'Inappropriate humor: "He always said he wanted to go out with a bang. Mission accomplished."', variant: 'warn'},
    {key: 'humor4', label: 'Inappropriate humor: "I guess you could say his heart just wasn\'t in it anymore."', variant: 'warn'}
  ];
  
  const quoteChoice = await choose(
    quoteOptions.map(opt => ({key: opt.key, label: opt.label, variant: opt.variant})),
    '📰 What is your quote?'
  );
  
  const selectedQuote = quoteOptions.find(q => q.key === quoteChoice);
  let quoteText = '';
  
  if (quoteChoice === 'heartfelt') {
    quoteText = `"This is a devastating tragedy. ${playerName} was a valued member of our team and our hearts go out to his family. We will do everything we can to support them during this difficult time."`;
    log(`📰 You say: "${quoteText}"`);
    log("📰 The reporter nods sympathetically.");
  } else if (quoteChoice === 'cynical') {
    quoteText = `"Life goes on. This is football. We'll find a replacement and move forward. That's the nature of the business."`;
    log(`📰 You say: "${quoteText}"`);
    log("📰 The reporter looks shocked at your coldness.");
  } else {
    quoteText = selectedQuote.label.replace(/^Inappropriate humor: /, '');
    log(`📰 You say: "${quoteText}"`);
    log("📰 The reporter's jaw drops. The silence is deafening.");
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log("");
  log(`📰 "Mr. Chairman, there are rumors circulating that you're the one who gave ${playerName} the ${drugName}. How do you respond to these allegations?"`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log("");
  log("Choose your response...");
  
  // Second question: Response to cocaine rumors
  const responseOptions = [
    {key: 'admit_mental', label: 'Admit to it and blame mental health', variant: 'warn'},
    {key: 'denial_ww2', label: 'Forceful denial (invoke grandparents\' WWII service)', variant: 'bad'},
    {key: 'lecherous', label: 'Lecherous (make sleazy comments to reporter)', variant: 'bad'},
    {key: 'emotional_blackmail', label: 'Emotional blackmail ("I will self-harm if this continues")', variant: 'warn'}
  ];
  
  const responseChoice = await choose(
    responseOptions.map(opt => ({key: opt.key, label: opt.label, variant: opt.variant})),
    '📰 How do you respond?'
  );
  
  if (responseChoice === 'admit_mental') {
    log(`📰 You say: "Yes, I gave him the ${drugName}. I've been struggling with my mental health, and I wasn't thinking clearly. I need help, and I hope people can understand that I'm dealing with my own demons."`);
    log("📰 The reporter says: 'Awww...'");
    log("📰 A sympathetic news story runs about your 'demons' and the need for understanding.");
    if (typeof addPaper === 'function') {
      addPaper(`Chairman admits to providing drugs, cites mental health struggles - calls for understanding`, 8);
    }
    S.reputation = Math.min(100, (S.reputation || 50) + 5); // Sympathy boost
  } else if (responseChoice === 'denial_ww2') {
    log(`📰 You say: "Absolutely not! My grandparents served in World War 2. No one whose grandparents did that would ever do anything bad. This is a baseless smear campaign!"`);
    log("📰 The reporter looks confused. 'What does that have to do with anything?'");
    log("📰 Your bizarre defense makes headlines.");
    if (typeof addPaper === 'function') {
      addPaper(`Chairman denies drug allegations, invokes grandparents' WWII service in bizarre defense`, 15);
    }
    S.reputation = Math.max(0, (S.reputation || 50) - 5);
  } else if (responseChoice === 'lecherous') {
    const sleazyComments = [
      `"You know, you're really attractive when you're asking difficult questions. How about we continue this conversation somewhere more... private?"`,
      `"Those rumors are as false as... well, let's just say I'd rather talk about what you're wearing. It really brings out your... professionalism."`,
      `"I didn't give him anything, but I'd love to give you something. My number, perhaps?"`
    ];
    const comment = pick(sleazyComments);
    log(`📰 You say: "${comment}"`);
    log("📰 The reporter looks disgusted and ends the interview immediately.");
    log("📰 Your sleazy comments are reported in the press.");
    if (typeof addPaper === 'function') {
      addPaper(`Chairman makes inappropriate sexual comments to reporter during player death interview`, 20);
    }
    S.reputation = Math.max(0, (S.reputation || 50) - 15);
  } else if (responseChoice === 'emotional_blackmail') {
    log(`📰 You say: "I am going to self-harm if this interview continues. I can't handle this pressure. Please, you're pushing me to the edge."`);
    log("📰 The reporter looks alarmed and immediately ends the interview.");
    log("📰 You're off the hook, but the press notes your concerning behavior.");
    if (typeof addPaper === 'function') {
      addPaper(`Chairman threatens self-harm during interview, reporter ends questioning`, 10);
    }
    S.reputation = Math.max(0, (S.reputation || 50) - 3);
  }
  
  log("");
  log("📰 The interview concludes.");
  
  // Publish to press
  if (typeof initPressSystem === 'function') initPressSystem();
  const chairName = S.full_name || 'The Southampton chairman';
  const headline = `Chairman's Statement on Player Death: "${quoteText.slice(0, 50)}..."`;
  const deathCause = (isOverdose && drugType === 'cocaine') ? 'cocaine overdose' : `${drugName}-related heart attack`;
  const body = `Following the death of ${playerName} from a ${deathCause}, ${chairName} gave the following statement: "${quoteText}"`;
  if (typeof createStory === 'function' && typeof queueStory === 'function') {
    const story = createStory('gossip', headline, body, { subject: playerName }, {}, 'player_death_quote', 12);
    queueStory(story);
  }
}

// Massive doping scandal system
function triggerMassiveDopingScandal(player) {
  const fine = 500000 + Math.floor(Math.random() * 500000);
  S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fine);
  S.reputation = Math.max(0, (S.reputation || 50) - 30);
  S.points_deducted = (S.points_deducted || 0) + 6; // Major points deduction
  adjustClubPoints(-6);
  
  log(`💸 You are fined £${fine.toLocaleString()} for the massive doping scandal.`);
  log(`📉 Your reputation plummets. Points deduction: -6.`);
  
  // Delmor Krunchem abuse texts
  setTimeout(() => {
    if (typeof sendRivalText === 'function') {
      const abuseTexts = [
        `"A player DEAD from doping and you're still in charge? This league is a joke. You're a murderer."`,
        `"Heart attack from HGH abuse. You killed that player. The FA should lock you up forever."`,
        `"You drugged a player to death. This is beyond scandal - this is manslaughter. You're finished."`,
        `"A player dies on your watch from doping and you think you can just carry on? You're a monster."`
      ];
      const text = pick(abuseTexts);
      sendRivalText(text);
    } else {
      log(`📱 Delmor Krunchem: "${pick([
        'A player DEAD from doping and you\'re still in charge? This league is a joke.',
        'Heart attack from HGH abuse. You killed that player. The FA should lock you up forever.',
        'You drugged a player to death. This is beyond scandal - this is manslaughter.'
      ])}"`);
    }
  }, 2000);
  
  // News story
  setTimeout(() => {
    if (typeof addPaper === 'function') {
      addPaper(`Southampton player dies from suspected HGH abuse - Chairman faces investigation`, 25);
    } else {
      log('📰 BREAKING: Major news outlets report on the doping scandal and player death.');
    }
  }, 3000);
  
  // Reset doping scandal risk
  S.doping_scandal_risk = 0;
}

// Post-match processing for cocaine dependency and doping scandals
async function processPostMatchDrugEffects() {
  // Handle HGH death Delmor messages (deferred from mid-match)
  if (S.pending_hgh_death_delmor && Array.isArray(S.pending_hgh_death_delmor) && S.pending_hgh_death_delmor.length > 0) {
    log("");
    for (const playerName of S.pending_hgh_death_delmor) {
      if (typeof window.enqueueRivalText === 'function') {
        window.enqueueRivalText('HA HA. I\'m so happy your player died. This is the best news I\'ve heard all week.');
      } else {
        log(`📱 Delmor Krunchem: "HA HA. I'm so happy your player died. This is the best news I've heard all week."`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      if (typeof window.enqueueRivalText === 'function') {
        window.enqueueRivalText('A player DEAD from doping and you\'re still in charge? This league is a joke.');
      } else {
        log(`📱 Delmor Krunchem: "A player DEAD from doping and you're still in charge? This league is a joke."`);
      }
    }
    // Clear the pending list
    S.pending_hgh_death_delmor = [];
    log("");
  }
  
  // Check for cocaine dependency
  const starters = getOurSelectedFive();
  for (const player of starters) {
    if (player.cocaine_dependency_risk && player.cocaine_dependency_risk > 0) {
      // Chance player asks for cocaine
      if (Math.random() < (player.cocaine_dependency_risk / 100)) {
        log(`📱 ${player.name} texts you: "Boss, I need some more of that stuff. I can't play without it."`);
        log(`⚠️ ${player.name} is developing a drug dependency.`);
        
        // Chance of death or arrest
        if (Math.random() < 0.1) {
          // Death from overdose
          log(`💔 ${player.name} has died from a cocaine overdose.`);
          const squadIndex = S.squad.findIndex(p => p.name === player.name);
          if (squadIndex !== -1) {
            S.squad.splice(squadIndex, 1);
          }
          S.reputation = Math.max(0, (S.reputation || 50) - 20);
          S.police_risk = (S.police_risk || 0) + 15;
          
          // Trigger press interview for cocaine overdose death - await properly
          await playerDeathPressInterview(player, 'cocaine', true); // true = isOverdose
        } else if (Math.random() < 0.15) {
          // Arrest for assault
          log(`🚨 ${player.name} has been arrested for assault after a violent incident.`);
          const squadIndex = S.squad.findIndex(p => p.name === player.name);
          if (squadIndex !== -1) {
            S.squad.splice(squadIndex, 1);
          }
          S.police_risk = (S.police_risk || 0) + 10;
          S.reputation = Math.max(0, (S.reputation || 50) - 10);
        }
      }
    }
    
    // Reset match flags
    player.on_cocaine_this_match = false;
    player.on_hgh_this_match = false;
  }
  
  // Check for doping scandal (if risk is high enough)
  if (S.doping_scandal_risk && S.doping_scandal_risk >= 20) {
    const scandalChance = Math.min(0.5, S.doping_scandal_risk / 100);
    if (Math.random() < scandalChance) {
      triggerMassiveDopingScandal(null); // No specific player, general scandal
    }
  }
  
  // Reduce doping scandal risk over time (but not to zero if there's ongoing use)
  if (S.doping_scandal_risk) {
    S.doping_scandal_risk = Math.max(0, S.doping_scandal_risk - 2);
  }
}

// --- Injury & suspension helpers ------------------------------------------------

function isPlayerAvailableForSelection(p) {
  if (!p) return false;
  const injuryGames = (p.injury_games | 0);
  const suspensionGames = (p.suspension_games | 0);
  const injured = injuryGames > 0;
  const suspended = suspensionGames > 0;
  const dead = !!p.is_dead;
  return !injured && !suspended && !dead;
}

function applyPostMatchInjuriesAndSuspensions(events) {
  if (!Array.isArray(events) || !Array.isArray(S?.squad)) return;

  // Acceptance test: After a match containing STRETCHER_INJURY, that player gets a multi-match injury and it ticks down each match.
  const injuryTypesMinor = ['knock', 'dead leg', 'tight hamstring'];
  const injuryTypesMedium = ['hamstring strain', 'groin strain', 'ankle sprain'];
  const injuryTypesMajor = ['ACL tear', 'broken ankle', 'ruptured Achilles'];

  const matchAggression = (typeof S?._matchAggression === 'number') ? S._matchAggression : 1;

  function assignInjury(player, customGames = null) {
    if (!player) return;
    // Base severity
    let severity = 'minor';
    const roll = Math.random();
    if (roll < 0.6) severity = 'minor';
    else if (roll < 0.9) severity = 'medium';
    else severity = 'major';

    // Aggressive team talk slightly bumps severity upwards
    if (matchAggression === 2 && Math.random() < 0.2) {
      if (severity === 'minor') severity = 'medium';
      else if (severity === 'medium') severity = 'major';
    }

    let games = customGames !== null ? customGames : 1;
    if (customGames === null) {
      if (severity === 'minor') {
        games = 1 + Math.floor(Math.random() * 2);       // 1–2
      } else if (severity === 'medium') {
        games = 3 + Math.floor(Math.random() * 6);       // 3–8
      } else {
        games = 9 + Math.floor(Math.random() * 22);      // 9–30
      }
    }

    let typePool = injuryTypesMinor;
    if (severity === 'medium') typePool = injuryTypesMedium;
    else if (severity === 'major') typePool = injuryTypesMajor;

    const injuryType = typePool[Math.floor(Math.random() * typePool.length)];

    player.injury_games = games;
    player.injury_type = injuryType;
    player.injury_severity = severity;

    log(`🩼 ${player.name} out for ${games} matches (${injuryType}).`);
  }
  

  function assignSuspension(player) {
    if (!player) return;
    // Acceptance test: After a match containing RED_CARD for our player, they receive a ban of N matches and it ticks down each match.
    const r = Math.random();
    let games = 1;
    if (r < 0.6) games = 1;
    else if (r < 0.9) games = 2;
    else games = 3 + Math.floor(Math.random() * 3); // 3–5
    player.suspension_games = games;
    log(`🟥 ${player.name} banned for ${games} matches.`);
  }

  for (const ev of events) {
    if (!ev || typeof ev.kind !== 'string') continue;

    if (ev.kind === 'STRETCHER_INJURY' && ev.who === 'HOME' && ev.player) {
      const p = S.squad.find(pl => pl && pl.name === ev.player);
      if (p) {
        assignInjury(p);
      }
    } else if (ev.kind === 'RED_CARD' && ev.who === 'HOME' && ev.player) {
      const p = S.squad.find(pl => pl && pl.name === ev.player);
      if (p) {
        assignSuspension(p);
      }
    }
  }
}

function tickDownInjuriesAndSuspensions() {
  if (!Array.isArray(S?.squad)) return;

  for (const p of S.squad) {
    if (!p) continue;

    // Acceptance test: A player with injury_games > 0 is not picked for the next match.
    let ig = p.injury_games | 0;
    if (ig > 0) {
      ig = Math.max(0, ig - 1);
      p.injury_games = ig;
      if (ig === 0 && (p.injury_type || p.injury_severity)) {
        log(`✅ ${p.name} returns from injury.`);
        delete p.injury_type;
        delete p.injury_severity;
      }
    }

    let sg = p.suspension_games | 0;
    if (sg > 0) {
      sg = Math.max(0, sg - 1);
      p.suspension_games = sg;
      if (sg === 0) {
        log(`✅ ${p.name} returns from suspension.`);
      }
    }
  }
}

function maybeTriggerCocaineHeartAttacks(events) {
  if (!Array.isArray(S?.squad)) return;

  // Track matches played on cocaine for our players
  const starters = (typeof getOurSelectedFive === 'function') ? getOurSelectedFive() : [];
  for (const p of starters) {
    if (!p) continue;
    if (p.on_cocaine_this_match) {
      p.coke_matches_used = (p.coke_matches_used || 0) + 1;
    }
  }

  // Acceptance test: A rare COCAINE_HEART_ATTACK event can occur for long-term cocaine users; the player becomes permanently unavailable.
  const eventsArray = Array.isArray(events) ? events : (Array.isArray(S.matchEvents) ? S.matchEvents : []);

  for (const p of S.squad.slice()) {
    if (!p || !p.name) continue;
    if (p.is_dead) continue;

    const matchesOnCoke = p.coke_matches_used || 0;
    if (matchesOnCoke < 8) continue;

    let prob = 0;
    if (matchesOnCoke >= 20) prob = 0.01;
    else prob = 0.002;

    const aggression = (typeof S?._matchAggression === 'number') ? S._matchAggression : 1;
    if (aggression === 2) prob *= 1.5;

    if (Math.random() < prob) {
      const minute = 5 + Math.floor(Math.random() * 86); // 5–90
      const ev = {
        t: minute,
        who: 'HOME',
        kind: 'COCAINE_HEART_ATTACK',
        player: p.name,
        team: S.club_name || 'Southampton FC'
      };
      eventsArray.push(ev);
      eventsArray.sort((a, b) => (a.t || 0) - (b.t || 0));
      S.matchEvents = eventsArray;
      triggerCocaineHeartAttack(p);
      break; // Only one such tragedy per match
    }
  }
}

function triggerRoidRage(player) {
  const roidRageEvents = [
    {
      type: 'beat_up_teammate',
      message: `${player.name} is experiencing roid rage! He beats up a teammate, rendering them unusable for the match.`,
      effect: () => {
        // Reduce team morale
        S.team_morale_boost = Math.max(-20, (S.team_morale_boost || 0) - 10);
        log('Team morale drops due to the violent incident.');
      }
    },
    {
      type: 'quit_team',
      message: `${player.name} is experiencing roid rage! He quits the team in a fit of anger.`,
      effect: () => {
        // Remove player from squad
        const squadIndex = S.squad.findIndex(p => p.name === player.name);
        if (squadIndex !== -1) {
          S.squad.splice(squadIndex, 1);
          log(`${player.name} has left the team permanently!`);
        }
      }
    },
    {
      type: 'property_damage',
      message: `${player.name} is experiencing roid rage! He causes property damage to the club facilities.`,
      effect: () => {
        // Fine for property damage
        const damage = 50000 + Math.floor(Math.random() * 100000);
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - damage);
        log(`You must pay £${damage.toLocaleString()} for the property damage.`);
      }
    },
    {
      type: 'doping_arrest',
      message: `${player.name} is experiencing roid rage! His erratic behavior attracts attention and he gets arrested for doping.`,
      effect: () => {
        // Doping arrest consequences
        const fine = 100000 + Math.floor(Math.random() * 200000);
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fine);
        S.reputation = Math.max(0, (S.reputation || 50) - 15);
        S.points_deducted = (S.points_deducted || 0) + 3; // Points deduction
        adjustClubPoints(-3);
        log(`You are fined £${fine.toLocaleString()} and receive a 3-point deduction for doping violations.`);
        log('Your reputation takes a significant hit.');
      }
    }
  ];
  
  const event = roidRageEvents[Math.floor(Math.random() * roidRageEvents.length)];
  log(event.message);
  event.effect();
  
  // Reset player's HGH doses to prevent immediate repeat
  player.hgh_doses = 0;
}

// HGH giving system for opposition players (sabotage)
async function giveHGHToOppositionPlayers() {
  if (!S.doctor || S.doctor.hgh_stock <= 0) {
    log('You don\'t have any HGH to give.');
    return;
  }
  
  // Get opposition players (simplified - using random names since we don't have their actual squad)
  const oppositionPlayers = [
    { name: "Opposition Player 1", rating: 65 },
    { name: "Opposition Player 2", rating: 70 },
    { name: "Opposition Player 3", rating: 68 },
    { name: "Opposition Player 4", rating: 72 },
    { name: "Opposition Player 5", rating: 69 }
  ];
  
  const choices = oppositionPlayers.map((p, i) => ({
    key: String(i),
    label: `Give HGH to ${p.name} (Rating: ${p.rating})`
  }));
  
  choices.push({ key: "all", label: "Give HGH to all opposition players" });
  choices.push({ key: "cancel", label: "Cancel" });
  
  const choice = await choose(choices, "Give HGH to Opposition Players (Sabotage)");
  
  if (choice === "cancel") return;
  
  if (choice === "all") {
    // Give HGH to all opposition players
    if (S.doctor.hgh_stock < oppositionPlayers.length) {
      log(`You only have ${S.doctor.hgh_stock} HGH doses, but need ${oppositionPlayers.length} for all players.`);
      return;
    }
    
    S.doctor.hgh_stock -= oppositionPlayers.length;
    log(`You secretly give HGH to all ${oppositionPlayers.length} opposition players. They look noticeably more muscular and aggressive.`);
    
    // Apply effects to all opposition players
    oppositionPlayers.forEach(player => {
      if (!player.hgh_doses) player.hgh_doses = 0;
      player.hgh_doses++;
      player.rating = Math.min(99, player.rating + 3); // Boost rating
      
      // Check for roid rage
      if (player.hgh_doses >= 3 && Math.random() < 0.4) {
        triggerOppositionRoidRage(player);
      }
    });
    
    log('All opposition players receive a +3 rating boost from HGH!');
    log('This will make them more aggressive and potentially cause problems for their team.');
    
  } else {
    // Give HGH to specific opposition player
    const playerIndex = parseInt(choice);
    const player = oppositionPlayers[playerIndex];
    
    S.doctor.hgh_stock--;
    log(`You secretly give HGH to ${player.name}. He looks noticeably more muscular and aggressive.`);
    
    if (!player.hgh_doses) player.hgh_doses = 0;
    player.hgh_doses++;
    player.rating = Math.min(99, player.rating + 3); // Boost rating
    
    log(`${player.name} receives a +3 rating boost from HGH!`);
    log('This will make him more aggressive and potentially cause problems for his team.');
    
    // Check for roid rage
    if (player.hgh_doses >= 3 && Math.random() < 0.4) {
      triggerOppositionRoidRage(player);
    }
  }
  
  // Increase police risk for doping sabotage
  S.police_risk = (S.police_risk || 0) + 8;
  S.legal_risk = (S.legal_risk || 0) + 5;
  log('⚖️ Police risk +8, Legal risk +5 (Doping sabotage)');
  
  // Update doctor UI if open
  if (typeof window.renderDoctor === 'function') {
    window.renderDoctor();
  }
}

function triggerOppositionRoidRage(player) {
  const roidRageEvents = [
    {
      type: 'beat_up_teammate',
      message: `${player.name} is experiencing roid rage! He beats up a teammate, causing chaos in the opposition camp.`,
      effect: () => {
        // Reduce opponent morale
        S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 15);
        log('Opposition morale drops significantly due to the violent incident.');
      }
    },
    {
      type: 'quit_team',
      message: `${player.name} is experiencing roid rage! He quits the team in a fit of anger, leaving them short-handed.`,
      effect: () => {
        // Reduce opponent morale and potentially their strength
        S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 20);
        log('The opposition team is left short-handed and demoralized.');
      }
    },
    {
      type: 'property_damage',
      message: `${player.name} is experiencing roid rage! He causes property damage to their own facilities.`,
      effect: () => {
        // No direct cost to you, but increases their problems
        S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 10);
        log('The opposition team is distracted by the property damage incident.');
      }
    },
    {
      type: 'doping_arrest',
      message: `${player.name} is experiencing roid rage! His erratic behavior attracts attention and he gets arrested for doping.`,
      effect: () => {
        // Opposition gets in trouble, but you might get caught too
        S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 25);
        S.police_risk = (S.police_risk || 0) + 5; // Risk of being implicated
        S.reputation = Math.max(0, (S.reputation || 50) - 5);
        log('The opposition player is arrested for doping. Their team is devastated.');
        log('⚖️ Police risk +5 (Risk of being implicated in doping scandal)');
      }
    }
  ];
  
  const event = roidRageEvents[Math.floor(Math.random() * roidRageEvents.length)];
  log(event.message);
  event.effect();
  
  // Reset player's HGH doses to prevent immediate repeat
  player.hgh_doses = 0;
}

// Cocaine giving system
async function giveCocaineToPlayers() {
  if (!S.inventory || (S.inventory.drugs || 0) <= 0) {
    log('You don\'t have any cocaine to give.');
    return;
  }
  
  const starters = getOurSelectedFive();
  const choices = starters.map((p, i) => ({
    key: String(i),
    label: `Give cocaine to ${p.name} (Rating: ${p.rating})`
  }));
  
  choices.push({ key: "all", label: "Give cocaine to all players" });
  choices.push({ key: "cancel", label: "Cancel" });
  
  const choice = await choose(choices, "Give Cocaine to Players");
  
  if (choice === "cancel") return;
  
  if (choice === "all") {
    // Give cocaine to all players
    const drugCount = S.inventory.drugs || 0;
    if (drugCount < starters.length) {
      log(`You only have ${drugCount} bag(s) of cocaine, but need ${starters.length} for all players.`);
      return;
    }
    
    S.inventory.drugs -= starters.length;
    log(`You give cocaine to all ${starters.length} players. Their eyes are wide, they're jittery and hyper-aggressive.`);
    
    // Apply effects to all players
    starters.forEach(player => {
      if (!player.cocaine_uses) player.cocaine_uses = 0;
      player.cocaine_uses++;
      player.on_cocaine_this_match = true; // Flag for match events
      player.cocaine_dependency_risk = (player.cocaine_dependency_risk || 0) + 15; // Increase dependency risk
    });
    
    log('All players are now hyper-aggressive and will play recklessly!');
    
  } else {
    // Give cocaine to specific player
    const playerIndex = parseInt(choice);
    const player = starters[playerIndex];
    
    S.inventory.drugs = Math.max(0, (S.inventory.drugs || 0) - 1);
    log(`You give cocaine to ${player.name}. His eyes are wide, he's jittery and hyper-aggressive.`);
    
    if (!player.cocaine_uses) player.cocaine_uses = 0;
    player.cocaine_uses++;
    player.on_cocaine_this_match = true; // Flag for match events
    player.cocaine_dependency_risk = (player.cocaine_dependency_risk || 0) + 15; // Increase dependency risk
    
    log(`${player.name} is now hyper-aggressive and will play recklessly!`);
  }
  
  // Update inventory UI if open
  if (typeof renderInventory === 'function') {
    renderInventory();
  }
}

// Cocaine giving system for opposition players (sabotage)
async function giveCocaineToOppositionPlayers() {
  if (!S.inventory || (S.inventory.drugs || 0) <= 0) {
    log('You don\'t have any cocaine to give.');
    return;
  }
  
  // Get opposition players
  const oppPlayers = getOpponentPlayers();
  if (!oppPlayers || oppPlayers.length === 0) {
    log('No opposition players available.');
    return;
  }
  
  const choices = oppPlayers.map((p, i) => ({
    key: String(i),
    label: `Give cocaine to ${p.name} (Rating: ${p.rating})`
  }));
  
  choices.push({ key: "all", label: "Give cocaine to all opposition players" });
  choices.push({ key: "cancel", label: "Cancel" });
  
  const choice = await choose(choices, "Give Cocaine to Opposition Players (Sabotage)");
  
  if (choice === "cancel") return;
  
  if (choice === "all") {
    // Give cocaine to all opposition players
    const drugCount = S.inventory.drugs || 0;
    if (drugCount < oppPlayers.length) {
      log(`You only have ${drugCount} bag(s) of cocaine, but need ${oppPlayers.length} for all players.`);
      return;
    }
    
    S.inventory.drugs -= oppPlayers.length;
    log(`You secretly give cocaine to all ${oppPlayers.length} opposition players. They look jittery and hyper-aggressive.`);
    
    // Store opposition cocaine users (we'll track this in match context)
    if (!S.matchContext) S.matchContext = {};
    if (!S.matchContext.oppositionCocaineUsers) S.matchContext.oppositionCocaineUsers = [];
    oppPlayers.forEach(player => {
      S.matchContext.oppositionCocaineUsers.push(player.name);
    });
    
    log('All opposition players are now hyper-aggressive and will play recklessly!');
    
  } else {
    // Give cocaine to specific opposition player
    const playerIndex = parseInt(choice);
    const player = oppPlayers[playerIndex];
    
    S.inventory.drugs = Math.max(0, (S.inventory.drugs || 0) - 1);
    log(`You secretly give cocaine to ${player.name}. He looks jittery and hyper-aggressive.`);
    
    // Store opposition cocaine user
    if (!S.matchContext) S.matchContext = {};
    if (!S.matchContext.oppositionCocaineUsers) S.matchContext.oppositionCocaineUsers = [];
    S.matchContext.oppositionCocaineUsers.push(player.name);
    
    log(`${player.name} is now hyper-aggressive and will play recklessly!`);
  }
  
  // Increase police risk for drug sabotage
  S.police_risk = (S.police_risk || 0) + 10;
  S.legal_risk = (S.legal_risk || 0) + 8;
  log('⚖️ Police risk +10, Legal risk +8 (Drug sabotage)');
  
  // Update inventory UI if open
  if (typeof renderInventory === 'function') {
    renderInventory();
  }
}

// ---------- Opposition locker room (one talk action + one rummage, per match) ----------
async function opponentLockerRoomMenu(){
  if (S.visited_oppLocker) { log("You’ve already chanced it in here this pre-match."); return; }

  // ensure flags exist
  if (S.did_opp_action === undefined)   S.did_opp_action = false;   // talk/taunt/encourage used
  if (S.did_opp_rummage === undefined)  S.did_opp_rummage = false;  // rummage used

  const items = [];
  if (!S.did_opp_action){
    items.push(
      { key:"chat",  label:"Psychological Warfare (three-part quote system)" },
      { key:"enc",   label:"Sincere Encouragement (raise their morale)" },
      { key:"trash", label:"Trash the locker room (risky)" },
      { key:"surprise", label:"Leave a nasty surprise (very risky)" }
    );
  }
  if (!S.did_opp_rummage){
    items.push({ key:"rum", label:"Linger & Rummage (steal; raises police risk)" });
  }
  
  // Add HGH option if player has HGH stock
  if (S.doctor && S.doctor.hgh_stock > 0) {
    items.push({ key:"hgh", label:"Give HGH to opposition players (sabotage)" });
  }
  
  // Add cocaine option if player has cocaine in inventory
  if (S.inventory && (S.inventory.drugs || 0) > 0) {
    items.push({ key:"cocaine", label:"Give cocaine to opposition players (sabotage)" });
  }
  
  items.push({ key:"leave", label:"Leave locker room" });

  const k = await choose(items, "Opposition Locker Room");
  if (k === "leave"){ S.visited_oppLocker = true; return; }

  if (k === "chat"){
    await conductOppositionLockerRoomChat();
    S.did_opp_action = true;
  } else if (k === "enc"){
    const delta = 6 + Math.floor(Math.random()*7);
    S.morale_opponent = Math.min(100, (S.morale_opponent||70) + delta);
    log("You offer genuine encouragement.");
    sayUp();
    
    // Generate gossip story about bizarre chairman behavior
    generateOppositionEncouragementGossip(delta);

    S.did_opp_action = true;
  } else if (k === "trash"){
    S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 4);
    log("You take a large shit in the room room. The team are disgusted.");
sayDown();
    incrementRisk("sabotage_trash", 4);
    S.did_opp_action = true;
  } else if (k === "surprise"){
    if(Math.random() < 0.3){
      log("You\'re spotted while planting the surprise! You get away, but this could escalate.");
sayUp();
      incrementRisk("sabotage_surprise", 6);
    } else {
      S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 3);
      log("You leave a nasty surprise for the team. They appear shaken and unsettled.");
sayDown();
      incrementRisk("sabotage_surprise", 2);
    }
    S.did_opp_action = true;
  } else if (k === "rum"){
    await rummageLoot("opp");
    S.did_opp_rummage = true;
  } else if (k === "hgh"){
    await giveHGHToOppositionPlayers();
  } else if (k === "cocaine"){
    await giveCocaineToOppositionPlayers();
  }
  S.visited_oppLocker = true; // one entry per match
}



// ---------- Locker-room helpers (single copy) ----------

// ---------- Locker-room helpers (single copy) ----------
const PHRASE_UP = [
  "The room warms slightly.",
  "Shoulders loosen a touch.",
  "You sense a spark catch.",
  "Nods ripple across the room.",
  "A faint buzz lifts the air."
];
const PHRASE_DOWN = [
  "Faces harden.",
  "Eyes roll in the corners.",
  "The air turns brittle.",
  "Murmurs sour the mood.",
  "A chill passes through the room."
];
function sayUp(){ log(pick(PHRASE_UP)); }
function sayDown(){ log(pick(PHRASE_DOWN)); }

// Safe loot generator for rummage (own or opp)
function generateRummageFind(player, side){
  // basic weights; better players have better loot
  const baseQuality = player?.rating || 60;
  const qualityBump = Math.max(0, Math.floor((baseQuality - 60)/5)); // higher => better stuff
  const roll = Math.random();

  // outcome object
  const find = { money:0, accolade:null, drugs:0, miscItem:null, playerName: player?.name || null, side };

  // money chance
  if (roll < 0.45) {
    // £200–£800 + quality bump
    find.money = 200 + Math.floor(Math.random()*600) + (qualityBump*25);
  }
  // accolade chance
  if (Math.random() < (0.25 + qualityBump*0.01)) {
    const medals = ["Player of the Month plaque","Youth Cup medal","County 5-a-side ribbon","Old golden boot keyring","Regional MVP badge"];
    const values = [500, 1200, 300, 800, 1500];
    const idx = Math.floor(Math.random() * medals.length);
    find.accolade = { name: medals[idx], value: values[idx] + (qualityBump*50) };
  }
  // misc items chance (wallets, watches, boots, etc.)
  if (Math.random() < (0.15 + qualityBump*0.005)) {
    const miscItems = [
      { name: "Designer Wallet", value: 1000 + Math.floor(Math.random() * 4000) },
      { name: "Luxury Watch", value: 5000 + Math.floor(Math.random() * 15000) },
      { name: "Signed Boots", value: 500 + Math.floor(Math.random() * 1500) },
      { name: "Training Kit", value: 200 + Math.floor(Math.random() * 800) },
      { name: "Phone", value: 300 + Math.floor(Math.random() * 700) }
    ];
    const item = miscItems[Math.floor(Math.random() * miscItems.length)];
    find.miscItem = { name: item.name, value: item.value + (qualityBump*25) };
  }
  // rare drugs (riskier in opp room)
  const rare = side === "opp" ? 0.10 : 0.05;
  if (Math.random() < rare){
    find.drugs = 1;
  }
  return find;
}

// Unified “steal/do nothing” choice UI




// === LINEUP + ODDS HELPERS (single source of treblon) ===

// Our starting five (expects S.lineup to be a 5-array of player objects)
function getOurSelectedFive(){
  if (Array.isArray(S?.lineup) && S.lineup.length === 5) {
    // S.lineup contains player IDs, need to get actual player objects
    const players = S.lineup.map(id => S.squad.find(p => p.id === id)).filter(Boolean);
    return players;
  }
  // Fallback to squad if no lineup
  return Array.isArray(S?.squad) ? S.squad.slice(0, 5) : [];
}

// Get opponent players for match events
function getOpponentPlayers(){
  // Check if we have a Champions League opponent squad already generated
  const oppTeam = currentOpponent()?.team || 'Opposition';
  
  // If we have a CL squad stored, use it
  if (S._clOpponentSquads && S._clOpponentSquads[oppTeam]) {
    return S._clOpponentSquads[oppTeam];
  }
  
  // Otherwise, generate fresh opponent players for each match to avoid reuse
  const baseQuality = TEAM_QUALITY[oppTeam] || 70;
  const playerCount = 8 + Math.floor(Math.random() * 4); // 8-11 players
  
  S.currentOpponentPlayers = [];
  
  // 25% chance to include 1-2 special players in opponent team
  let specialCount = 0;
  if (Math.random() < 0.25) {
    specialCount = Math.random() < 0.7 ? 1 : 2;
    for (let i = 0; i < specialCount; i++) {
      const specialPlayer = makeSpecialPlayer();
      // Adjust rating to fit team quality if needed
      const delta = Math.round((Math.random() * 10) - 5);
      specialPlayer.rating = Math.max(45, Math.min(95, baseQuality + delta));
      S.currentOpponentPlayers.push(specialPlayer);
    }
  }
  
  // Fill remaining slots with regular players
  for (let i = 0; i < playerCount - specialCount; i++) {
    const player = makePlayer();
    // Adjust rating based on team quality
    const delta = Math.round((Math.random() * 10) - 5); // -5..+5
    player.rating = Math.max(45, Math.min(95, baseQuality + delta));
    S.currentOpponentPlayers.push(player);
  }
  return S.currentOpponentPlayers;
}

// Opponent’s best five (from S.opponent_today or S.opponent)
function getOppSelectedFive() {
  let pool = Array.isArray(S?.opponent_today) ? S.opponent_today
             : (Array.isArray(S?.opponent) ? S.opponent : []);
  
  // If pool is empty or too small, try to regenerate
  if (pool.length < 5) {
    if (typeof ensureOpponentForToday === 'function') {
      ensureOpponentForToday();
      pool = S.opponent_today || [];
    }
    
    // If still empty, create emergency squad
    if (pool.length < 5) {
      const {team} = currentOpponent();
      pool = Array.from({length: 5}, (_, i) => ({
        name: `${team} Player ${i+1}`,
        rating: 70 + Math.random() * 15, // 70-85 rating range
        position: ['GK', 'DEF', 'MID', 'FWD'][Math.floor(Math.random() * 4)]
      }));
      S.opponent_today = pool;
    }
  }
  
  if (pool.length >= 5) {
    return [...pool].sort((a,b)=> (b.rating||0) - (a.rating||0)).slice(0,5);
  }
  return pool.slice(0, 5);
}

// Team strength = sum(rating) + small morale factor; clamp so it can’t be 0
function computeTeamStrength(players){
  const base = players.reduce((sum,p)=> {
    let playerRating = (p.rating||0) + Math.round((p.morale||0)*0.2);
    
    // Massive performance penalty for drug-dependent players without coke
    if (p.cocaine_dependency_risk && p.cocaine_dependency_risk > 0 && !p.on_cocaine_this_match) {
      // Reduce rating by 70-85% depending on dependency level (massive penalty)
      const dependencyPenalty = Math.min(0.85, 0.7 + (p.cocaine_dependency_risk / 100) * 0.15);
      playerRating = Math.floor(playerRating * (1 - dependencyPenalty));
    }
    
    return sum + playerRating;
  }, 0);
  // One-match morale (S.team_morale_boost) is applied once, by the match engine
  // (computeQuickSimResult & co.), not here as well.
  return Math.max(5, base);
}

// Convert strengths to fair-ish decimal odds with a small house edge
function getMatchOdds(our, opp){
  const total = Math.max(1, our + opp);
  const pUs = our/total, pThem = opp/total;
  const house=0.90, min=1.20, max=9.50;
  const usOdds   = Math.min(max, Math.max(min, (1/pUs)*house));
  const themOdds = Math.min(max, Math.max(min, (1/pThem)*house));
  return { usOdds:+usOdds.toFixed(2), themOdds:+themOdds.toFixed(2) };
}

function computeOpponentStrength(players) {
  // Sum opponent player ratings (no per-player morale available)
  const base = players.reduce((sum, p) => sum + (p.rating || 0), 0);
  // Opponent morale (S.morale_opponent) is applied once, by the match engine.
  return Math.max(5, base);
}


// Compute and cache strengths/odds once per pre-match
function computePreMatchStrengthsAndOdds() {
  ensureOpponentForToday();
  const our5 = getOurSelectedFive();
  const opp5 = getOppSelectedFive();
  
  // Use correct functions for each team
  let ourStr = computeTeamStrength(our5);
  let oppStr = computeOpponentStrength(opp5);
  
  // Scale down strength values to match expectedGoals function expectations
  // Original system used ~40-60 range, new system uses ~300-500 range
  // Scale by dividing by 8 to get back to reasonable range
  ourStr = Math.round(ourStr / 8);
  oppStr = Math.round(oppStr / 8);
  
  // Additional balance fix: Cap opponent strength to prevent unrealistic elite teams
  // Even top teams shouldn't have 5 elite players - that's unrealistic
  // Cap opponent strength at 50 (equivalent to ~400 base strength)
  oppStr = Math.min(oppStr, 50);
  
  S.preMatch = S.preMatch || {};
  // Season 5 doping boost ("Squad performance spikes")
  if (S.season === 5 && S.preMatch.season5_doped && S.preMatch.performance_boost) {
    ourStr = Math.floor(ourStr * S.preMatch.performance_boost);
  }
  S.preMatch.ourStrength = ourStr;
  S.preMatch.oppStrength = oppStr;
  
  // 4. Fix bribe side propagation
  if (S.referee_bribed && (S.referee_bribed === 'us' || S.referee_bribed === 'them') && !S.ref_bribe_side) {
    S.ref_bribe_side = S.referee_bribed;
    S.referee_bribed = true;
  }
  
  // Apply referee bias if bribed
  if (typeof applyRefereeBiasToPreMatch === 'function') {
    applyRefereeBiasToPreMatch();
  }
  
  // Calculate odds
  const pUs = ourStr / (ourStr + oppStr);
  const pThem = 1 - pUs;
  const house = 0.95;
  const min = 1.1, max = 10;
  const usOdds = Math.min(max, Math.max(min, (1/pUs)*house));
  const themOdds = Math.min(max, Math.max(min, (1/pThem)*house));
  
  S.preMatch.odds = { usOdds: +usOdds.toFixed(2), themOdds: +themOdds.toFixed(2) };
  return S.preMatch.odds;
}

// Call this at the start of each pre-match so betting resets and odds exist
function startPreMatchInitBetting(){
  S.preMatch = S.preMatch || {};
  S.preMatch.bet = null;
  S.preMatch.betLocked = false; // one bet per match — this resets each match
  computePreMatchStrengthsAndOdds();
}

// ---------- bribery: shared helpers ----------

// Take/deduct funds safely; returns {ok:boolean, source:'o'|'c'}
// --- Simple money picker used by bribes (returns {ok:boolean, source:'o'|'c'|null})
async function takeFundsFor(amount, prompt="Funding source?"){
  const src = await choose(
    [
      { key:'o', label:`Pay £${amount.toLocaleString('en-GB')} from personal funds` },
      { key:'c', label:`Pay £${amount.toLocaleString('en-GB')} from club funds`, variant:'warn' },
      { key:'x', label:'Cancel' }
    ],
    prompt
  );
  if (src === 'x' || !src) return { ok:false, source:null };
  if (src === 'o'){
    if ((S.chairman_cash||0) < amount) { log("Not enough personal cash."); return {ok:false, source:'o'}; }
    S.chairman_cash -= amount;
    updateHUD?.();
    return {ok:true, source:'o'};
  } else {
    if ((S.club_cash||0) < amount) { log("Club can’t cover it."); return {ok:false, source:'c'}; }
    S.club_cash -= amount;
    S.offbooks = (S.offbooks||0) + amount; // hush accounting
    updateHUD?.();
    return {ok:true, source:'c'};
  }
}



// --- If the target refuses the bribe, they threaten to report you; you can hush them
async function declineThreatenHushFlow(whoLabel, originalAmount){
  // 40% chance they decline; tune as you like
  const declines = (Math.random() < 0.40);
  if (!declines) return { declined:false, reported:false, hushed:false };

  log(`${whoLabel}: "That’s corrupt. I should report you."`);
  const act = await choose(
    [
      { key:'b', label:'Beg him to stay quiet (pay hush money)' },
      { key:'c', label:'Call his bluff (risk being reported)', variant:'warn' }
    ],
    "He refuses the bribe."
  );

  if (act === 'c'){
    // 70% chance you get reported if you call the bluff
    if (Math.random() < 0.70){
      log(`${whoLabel}: "I\'m reporting this."`);
      S.compliance_risk = (S.compliance_risk||0) + 5;
      S.police_risk     = (S.police_risk||0) + 2;
      S.fa_risk         = (S.fa_risk||0) + 1;
      
      // Generate blackmail gossip story
      initPressSystem();
      const blackmailStory = generateGossipStory('blackmail', whoLabel);
      queueStory(blackmailStory);
      
      return {declined:true, reported:true, hushed:false};
    } else {
      log(`${whoLabel}: "Forget it. I\'m walking away."`);
      S.reputation = clamp((S.reputation||0)-1, 0, 100);
      return {declined:true, reported:false, hushed:false};
    }
  }

  // Pay larger hush money (150% of the original bribe)
  const hush = Math.round(originalAmount * 1.5);
  const can = await takeFundsFor(hush, `Hush payment £${hush.toLocaleString('en-GB')} — funding source?`);
  if (!can.ok){
    log("You can’t raise the hush money. He leaves… and might report you.");
    S.compliance_risk = (S.compliance_risk||0) + 2;
    S.police_risk     = (S.police_risk||0) + 1;
    return {declined:true, reported:true, hushed:false};
  }

  // Hushed
  log(`${whoLabel} pockets the hush money and walks away. He won’t report you… but he won’t help either.`);
  S.compliance_risk = (S.compliance_risk||0) + 3;
  S.legal_risk      = (S.legal_risk||0) + 1;
  return {declined:true, reported:false, hushed:true};
}

// ----- Pre-Match actions hub (menu) -----
async function preMatchTransfersAndBettingMenu(){
  // Show the fixture up front
  const { team, manager } = currentOpponent();
  log(`Matchday: ${getClubName()} vs ${team} (Manager: ${manager})`);

  // ensure preMatch bucket exists
  if (!S.preMatch || typeof S.preMatch !== 'object') S.preMatch = {};

  while (true) {
    
    // CRITICAL FIX: Wait for nuclear sequence to complete before showing menu
    if (S._nuclearSequenceInProgress) {
      await new Promise(resolve => setTimeout(resolve, 500));
      continue; // Check again
    }
    
    // Check if menu needs to be restored after nuclear sequence interruption
    if (S._preMatchMenuNeedsRestore) {
      S._preMatchMenuNeedsRestore = false;
      log("Returning to pre-match actions after nuclear sequence...");
      // Clear any stuck state and continue the loop naturally
    }
    
    // Build items fresh each loop
    let items = [];

    // visitors gate
    items.push({ key:'door',
      label: S.visitors_handled ? 'Answer the door (done)' : 'Answer the knock at the door' });

    // core actions
    items.push(
      { key:'transfers', label:'Open transfer window' },
      { key:'lineup',    label:'Pick lineup / Auto-pick' },
      { key:'own',       label: S.visited_ownLocker ? 'Your locker room (done)' : 'Enter your locker room' },
      { key:'opp',       label: S.visited_oppLocker ? 'Opposition locker (done)' : 'Sneak into opposition locker' }
    );

    // betting (once)
    items.push({
      key:'bet',
      label: (S.preMatch && S.preMatch.betLocked) ? 'Bet (already placed)' : 'Place a Bet (optional)'
    });

    // bribe options (guard duplicates)
    if (!S.referee_bribed && !S.referee_assaulted) {
      items.push({ key:'referee', label:'Call the referee (…favor a side)' });
    }
    if (!S.accepted_bribe_this_match && !S.opponent_bribed) {
      items.push({ key:'backchannel', label:'Backchannel with opposing manager (offer a bribe)' });
    }

    // Brick throwing options removed from pre-match - they belong during the match

    // proceed/back
    items.push({ key:'kick', label:'Proceed to kickoff' }, { key:'back', label:'Back / Pause' });

    // de-dupe by key in case something else pushed the same entry
    {
      const seen = new Set();
      items = items.filter(it => (it && it.key && !seen.has(it.key)) ? (seen.add(it.key), true) : false);
    }

    // Check if menu was interrupted before showing choices
    if (S._preMatchMenuInterrupted) {
      S._preMatchMenuInterrupted = false;
      // Menu was interrupted by nuclear sequence, skip this iteration and re-show menu
      log("Pre-match menu restored after nuclear sequence.");
      // Small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    
    // Store a flag that we're about to show the menu, so nuclear sequence can detect it
    S._preMatchMenuActive = true;
    
    // Use Promise.race to detect if menu is interrupted
    const choicePromise = choose(items, 'Pre-Match Actions');
    let intervalCount = 0;
    const interruptCheck = new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        intervalCount++;
        if (intervalCount % 10 === 0) { // Log every 1 second (10 intervals)
        }
        if (S._preMatchMenuInterrupted) {
          clearInterval(checkInterval);
          resolve('interrupted');
        }
      }, 100);
      // Clean up interval when choice is made
      choicePromise.then(() => {
        clearInterval(checkInterval);
      }).catch(() => {
        clearInterval(checkInterval);
      });
    });
    
    const result = await Promise.race([choicePromise, interruptCheck]);
    S._preMatchMenuActive = false;
    
    if (result === 'interrupted') {
      // Menu was interrupted, continue loop to re-show
      S._preMatchMenuInterrupted = false;
      continue;
    }
    
    const choice = result;

    // visitors must be handled before kickoff
    if (choice === 'door'){
      if (!S.visitors_handled){ await openKnockDoor(); S.visitors_handled = true; }
      else { log("You already handled today’s visitors."); }
      continue;
    }

    if (choice === 'transfers'){ await openTransferWindow();    continue; }
    if (choice === 'lineup'){    await selectLineupMenu();      ensureValidLineup(); continue; }
    if (choice === 'own'){       await yourLockerRoomMenu();    S.visited_ownLocker = true; continue; }
    if (choice === 'opp'){       await opponentLockerRoomMenu();S.visited_oppLocker = true; continue; }
    // Brick throwing handlers removed - bricks are now used during match simulation
    if (choice === 'bet'){
      if (S.preMatch.betLocked){ log("You've already placed a bet for this match."); }
      else { await openBettingModal?.(); S.preMatch.betLocked = true; }
      continue;
    }

    // ---- Referee (favor us or them; decline/hush/report branches) ----
    if (choice === 'referee'){
      // Check if already interacted with ref
      if (S.referee_assaulted) {
        log("You can't call the referee - you already assaulted him and he's in the hospital!");
        continue;
      }
      if (S.referee_bribed) {
        log("You can't call the referee - you already bribed him for this match!");
        continue;
      }
      
      const amount = 1_000_000;

      // pick side to favor or assault
      const assaultLabel = hasBrickEquipped() ? 'Throw brick at the referee (guaranteed arrest)' : 'Assault the referee (guaranteed arrest)';
      const side = await choose(
        [{key:'us',label:'Ask him to favor Southampton (us)'},
         {key:'them',label:'Ask him to favor the opposition', variant:'warn'},
         {key:'assault',label:assaultLabel, variant:'bad'}],
        "What do you want to do with the referee?"
      );
      if (!side) { log("You hang up before saying anything incriminating."); continue; }

      // Handle assault option
      if (side === 'assault') {
        if (hasBrickEquipped()) {
          await throwBrickAt('referee');
        } else {
          log("You storm onto the pitch and physically attack the referee!");
          log("Security immediately restrains you as the referee collapses to the ground.");
          log("The police are called immediately - you are arrested on the spot.");
          
          // Queue police investigation instead of immediate prison
          const fineChair = 50000 + Math.floor(Math.random() * 50000); // £50k-£100k
          const fineClub = Math.round(fineChair * 1.5); // £75k-£150k
          
          // Apply immediate fines and risk increases
          S.chairman_cash = Math.max(0, (S.chairman_cash|0) - fineChair);
          S.club_cash = Math.max(0, (S.club_cash|0) - fineClub);
          S.police_risk = Math.min(100, (S.police_risk|0) + 20);
          S.legal_risk = Math.min(100, (S.legal_risk|0) + 5);
          S.compliance_risk = Math.min(100, (S.compliance_risk|0) + 6);
          S.reputation = Math.max(0, (S.reputation|0) - 15);
          S.referee_assaulted = true; // Mark that ref has been assaulted
          
          // Trigger assault achievement
          if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'assaulted_someone')) {
            const achievement = {
              id: 'assaulted_someone',
              title: 'Assaulted Someone',
              description: 'Assaulted someone',
              icon: '👊'
            };
            window.socialManager.showAchievement(achievement);
            window.socialManager.achievements.push(achievement);
          }
          
          log(`CONSEQUENCES: Personal fine £${fineChair.toLocaleString()}, Club fine £${fineClub.toLocaleString()}`);
          log("Your reputation plummets and the FA launches an immediate investigation.");
          
          // Set a flag to ensure the investigation is processed in post-match only
          S._pending_police_investigation = { authority: 'police', caseType: 'assault on referee' };
          
          // Season 4 & 5: Trigger lashing for assault
          if ((S.season === 4 || S.season === 5) && typeof administerLashing === 'function') {
            await waitAdvance("Arrest", "The sharia police arrive...");
            await administerLashing('Assault on referee', rnd(8, 15));
          }
          
          updateHUD?.();
        }
        continue;
      }

      // take funds only if the bribe goes through
      const can = await takeFundsFor(amount, "Bribe amount £1,000,000 — funding source?");
      if (!can.ok) { continue; }

      // chance he refuses and threatens to report
      const after = await declineThreatenHushFlow('Referee', amount);
      if (after.declined){
        // refund because the bribe didn’t happen
        if (can.source === 'o') S.chairman_cash += amount; else S.club_cash += amount;
        updateHUD?.();
        continue;
      }

      // bribe accepted
      log("The referee quietly agrees to 'interpret' decisions in your chosen direction.");
      S.referee_bribed = side; // 'us' or 'them'
      S.compliance_risk = (S.compliance_risk||0) + 10;
      S.legal_risk      = (S.legal_risk||0) + 5;

      // Lightweight world-state hooks: corruption and early fallout
      ensureWorldState();
      const wf = getWorldFlags();
      wf.corruptionScore = (wf.corruptionScore || 0) + 1;
      wf.lastBribedRefId = wf.lastBribedRefId || ('ref_match_' + (S.matches_played | 0));
      adjustRelationship('ultras', +1);
      adjustRelationship('fa', -1);
      // Queue a subtle “quiet inquiry” style fallout in the next few matches
      scheduleWorldEvent('refereeShortFallout', 1 + Math.floor(Math.random()*3), { side });

      // optional: nudge cached strengths so odds reflect it pre-kickoff
      if (S.preMatch && typeof S.preMatch.ourStrength === 'number' && typeof S.preMatch.oppStrength === 'number'){
        const nudge = 6;
        if (side === 'us')   S.preMatch.ourStrength = Math.max(1, S.preMatch.ourStrength + nudge);
        if (side === 'them') S.preMatch.oppStrength = Math.max(1, S.preMatch.oppStrength + nudge);
      }
      continue;
    }

    // ---- Backchannel with opposing manager (blocked if he bribed you) ----
    if (choice === 'backchannel'){
      if (S.accepted_bribe_this_match){
        log("You've already accepted money from him; you can't backchannel this week.");
        continue;
      }

      // Present options for what to do with the opposing manager
      const assaultLabel = hasBrickEquipped() ? 'Throw brick at the opposing manager (guaranteed arrest)' : 'Assault the opposing manager (guaranteed arrest)';
      const action = await choose([
        { key:'bribe', label:'Offer £750,000 bribe (risky)' },
        { key:'assault', label:assaultLabel, variant:'bad' }
      ], "What do you want to do with the opposing manager?");

      if (action === 'assault'){
        if (hasBrickEquipped()) {
          await throwBrickAt('manager', { opponent: oppTeam });
        } else {
          log("You lose control and physically attack the opposing manager!");
          log("Security immediately restrains you as the opposing manager collapses to the ground.");
          log("The police are called immediately - you are arrested on the spot.");
          
          // Apply immediate consequences
          const fineChair = 40000 + Math.floor(Math.random() * 40000); // £40k-£80k
          const fineClub = Math.round(fineChair * 1.3); // £52k-£104k
          
          S.chairman_cash = Math.max(0, (S.chairman_cash|0) - fineChair);
          S.club_cash = Math.max(0, (S.club_cash|0) - fineClub);
          S.police_risk = Math.min(100, (S.police_risk|0) + 18);
          S.legal_risk = Math.min(100, (S.legal_risk|0) + 4);
          S.compliance_risk = Math.min(100, (S.compliance_risk|0) + 5);
          S.reputation = Math.max(0, (S.reputation|0) - 12);
          
          log(`CONSEQUENCES: Personal fine £${fineChair.toLocaleString()}, Club fine £${fineClub.toLocaleString()}`);
          log("Your reputation plummets and the FA launches an immediate investigation.");
          
          // Check if there's already a pending police investigation (e.g., from referee assault)
          if (S._pending_police_investigation) {
            // Add opposing manager assault to existing investigation
            S._pending_police_investigation.caseType += ' and assault on opposing manager';
            S._pending_police_investigation.description = 'Multiple assaults - referee and opposing manager';
          } else {
            // Create new investigation for opposing manager assault
            S._pending_police_investigation = { 
              authority: 'police', 
              caseType: 'assault on opposing manager',
              description: 'Assault on opposing team manager'
            };
          }
          
          updateHUD?.();
        }
        continue;
      }

      if (action === 'bribe'){
        const amt = 750_000;
        const can = await takeFundsFor(amt, "Offer £750,000 to the opposing manager — funding source?");
        if (!can.ok){ continue; }

        // chance he refuses → threaten/hush/report
        const after = await declineThreatenHushFlow('Opposing manager', amt);
        if (after.declined){
          // refund since no deal
          if (can.source === 'o') S.chairman_cash += amt; else S.club_cash += amt;
          updateHUD?.();
          continue;
        }

        // bribe accepted: weaken their pre-match strength slightly
        S.opponent_bribed = true;
        log("He grins and shakes on it: the opposing team will \"not try their hardest.\"");
        if (S.preMatch && typeof S.preMatch.oppStrength === 'number'){
          S.preMatch.oppStrength = Math.max(5, S.preMatch.oppStrength - 10);
        }
        continue;
      }
    }

    if (choice === 'kick'){
      if (!S.visitors_handled){ log("You should answer the knock at the door before kickoff."); continue; }
      return; // exit to match
    }

    if (choice === 'back'){
      // leaving the menu leads to kickoff too, so the door must be answered first
      if (!S.visitors_handled){ log("You should answer the knock at the door before kickoff."); continue; }
      return;
    }
  }
}



async function handleUnrestVisitor(){
  const messenger = (S.manager_name ? "Manager" : "Team Captain");
  log(`${messenger}: "The lads are furious about how things have been handled."`);

  const choice = await choose([
    { key:'a', label:'Apologize and promise change (small morale up, lower risk)' },
    { key:'d', label:'Double down: They’ll do as they’re told (morale down, risk up)' }
  ], "Squad Unrest");

  if (choice === 'a'){
    S.team_morale_boost = (S.team_morale_boost||0) + 5;
    S.pfa_risk = Math.max(0, (S.pfa_risk||0) - 1);
    log("You de-escalate. A little of the tension leaks out of the room.");
  } else if (choice === 'd'){
    S.team_morale_boost = (S.team_morale_boost||0) - 7;
    S.pfa_risk = (S.pfa_risk||0) + 2;
    log("You harden your stance. The air turns brittle.");
  }
}

async function handleInvestigationVisitor(){
  // DISABLED: Old investigation system replaced with new system
  log('Investigators: "We\'re looking into irregularities around the club."');
  return; // Exit early to prevent old system from running

  // If you planted cash, the target takes the fall
  const framedId = S.stolen && S.stolen.planted_cash_target;
  if (framedId){
    const target = S.squad.find(p => p.id === framedId);
    if (target){
      log(`Investigators: "${target.name}, you’re coming with us."`);
      S.lineup = (S.lineup||[]).filter(id => id !== target.id);
      S.squad  = S.squad.filter(p => p.id !== target.id);
      S.stolen.planted_cash_target = null;

      // cool off risks a bit
      S.police_risk      = Math.max(0, (S.police_risk||0) - 3);
      S.compliance_risk  = Math.max(0, (S.compliance_risk||0) - 2);
      S.fa_risk          = Math.max(0, (S.fa_risk||0) - 1);

      log("The case pivots to the player. Your own risk cools, for now.");
      return;
    } else {
      // planted on someone who’s already gone
      S.stolen.planted_cash_target = null;
    }
  }

  // No one framed → small fine & risk up
  const fine = 10000 + Math.floor(Math.random()*15000);
S.chairman_cash = (S.chairman_cash||0) - fine;
  S.police_risk = (S.police_risk||0) + 1;
  S.fa_risk = (S.fa_risk||0) + 1;
  log(`You’re fined £${fine.toLocaleString()}. Whispers grow louder.`);
}


async function plantCashFlow(){
  if (!S.stolen || !S.stolen.last_rummage_cash) {
    log("You have nothing suitable to plant.");
    return;
  }

  // pick a target from your current starting five (or fallback to squad)
  const pool = (typeof getOurSelectedFive === 'function')
    ? getOurSelectedFive()
    : (Array.isArray(S.lineup) && S.lineup.length
        ? S.lineup.map(id => S.squad.find(p=>p.id===id)).filter(Boolean)
        : S.squad);

  if (!pool || pool.length === 0) { log("No players available to frame right now."); return; }

  const opts = pool.map(p => ({ key:String(p.id), label:`${p.name} (rating ${p.rating||'?'})` }));
  const pickId = await choose(opts, "Who gets the planted cash? (Frames them if there’s an investigation.)");
  const target = S.squad.find(p => String(p.id) === pickId);
  if (!target) { log("You hesitate. No one is framed."); return; }

  // arm the trap
  S.stolen.planted_cash_target = target.id;
  // burn the remembered stash now (one-shot)
  S.stolen.last_rummage_cash = 0;
  S.stolen.last_rummage_side = null;

  log(`You quietly slip an envelope into ${target.name}'s locker. If investigators come knocking, ${target.name} will take the fall.`);
}
function queuePreMatchVisitors(){
  if (!Array.isArray(S.knock_queue)) S.knock_queue = [];

  // Unrest if morale low or poor form
  const approxMorale = Math.max(0, Math.min(100, (S.team_morale_boost||0) + 70));
  const lowMorale = approxMorale < 55;
  const poorForm = (S.matches_played >= 2) && S.recent_form && S.recent_form.slice(-2).every(r => r==='L');
  if ((lowMorale || poorForm) && !S.knock_queue.some(v=>v.type==='unrest')) {
    S.knock_queue.push({ type:'unrest' });
  }

  // Investigation if risk is high - but only after at least 2 matches to give player time to commit crimes
  // DISABLED: This old system was causing arrests after every match regardless of actual crimes
  // The new maybeQueueOversight() system handles investigations properly based on actual crimes
  /*
  if (S.matches_played >= 2) {
    const riskScore = (S.police_risk||0) + (S.compliance_risk||0) + (S.fa_risk||0);
    // Higher threshold for investigations - need at least 15 risk points
    const likelyProbe = riskScore >= 15 || Math.random() < (riskScore * 0.02);
    if (likelyProbe && !S.knock_queue.some(v=>v.type==='investigation')) {
      S.knock_queue.push({ type:'investigation' });
    }
  }
  */
}
// === Broadcast Mode (Pixel Cutscene) =======================================

// Safe state holder
const _watch = {
  running: false,
  resolve: null,
  forcedOutcome: null, // if user skips, we compute quick result and return it
};

// Bind buttons once DOM exists (call after render/init)
(function wireMatchViewerButtons(){
  const closeBtn = document.getElementById('closeMatchViewerBtn');
  const skipBtn  = document.getElementById('skipMatchBtn');
  if (closeBtn) closeBtn.onclick = () => _stopMatchViewer();
  if (skipBtn)  skipBtn.onclick  = () => _skipToResult();
})();

// Public entry: returns {homeGoals, awayGoals}
async function watchMatchCutscene() {
  // Stop general music during cutscene
  if (typeof window._stopGeneralMusic === 'function') {
    window._stopGeneralMusic();
  }
  
  // Prepare strengths (use your cached odds if present)
  let our = S?.preMatch?.ourStrength, opp = S?.preMatch?.oppStrength;
  if (!our || !opp) {
    const ours = (typeof getOurSelectedFive === 'function') ? getOurSelectedFive() : [];
    const opps = (typeof getOppSelectedFive === 'function') ? getOppSelectedFive() : [];
    if (typeof computeTeamStrength === 'function' && typeof computeOpponentStrength === 'function') {
      our = computeTeamStrength(ours);
      opp = computeOpponentStrength(opps);
    } else {
      our = ours.reduce((t,p)=>t+(p?.rating||60),0);
      opp = opps.reduce((t,p)=>t+(p?.rating||60),0);
    }
  }
  const events = _genMatchEvents(our, opp);

  // Open modal + animate
  _openMatchViewer();
  const res = await _animateMatch(events);  // {home, away}
  _closeMatchViewer();
  
  // Give user time to read the match commentary before showing wage decision
  await waitAdvance("Match Complete", "Match finished. Continue to wage decision?");
  
  // Resume general music after cutscene ends
  if (typeof window._startGeneralMusic === 'function') {
    setTimeout(() => {
      window._startGeneralMusic();
    }, 500);
  }
  
  return { homeGoals: res.home, awayGoals: res.away };
}

// --- Event generator: tiny, strength-weighted highlight list
function _genMatchEvents(ourStrength, oppStrength){
  const total = Math.max(1, ourStrength + oppStrength);
  const ourShare = ourStrength / total;
  
  // Calculate realistic goal expectations based on strength difference
  const strengthDiff = ourStrength - oppStrength;
  const ourXG = Math.max(0.1, 1.0 + (strengthDiff / 100)); // More realistic XG
  const oppXG = Math.max(0.1, 1.0 - (strengthDiff / 100));
  
  // Generate realistic goal counts using Poisson distribution
  let ourGoals = poisson(ourXG);
  let oppGoals = poisson(oppXG);
  
  // SPECIAL CASE: Portsmouth replacement kids after bus crash should be decimated
  try {
    const oppName = (typeof currentOpponent === 'function' ? currentOpponent()?.team : '') || '';
    const oppLower = oppName.toLowerCase();
    const isPortsmouth =
      oppLower.includes('portsmouth') || oppLower.includes('pompey');
    const isReplacement =
      !!(window.S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));
    
    if (isPortsmouth && isReplacement) {
      // Guarantee a comfortable win and heavily favour a thrashing.
      if (ourGoals <= oppGoals) {
        // Minimum 4‑goal haul and at least a 3‑goal margin.
        ourGoals = Math.max(4, oppGoals + 3);
      }
      // Even if RNG gave us a small win, bump it up to a big scoreline.
      if (ourGoals < 4) ourGoals = 4;
      if (ourGoals - oppGoals < 3) {
        ourGoals = oppGoals + 3;
      }
      // Cap their goals so freak 4–4s don't happen against literal children.
      oppGoals = Math.min(oppGoals, 1);
    }
  } catch(_e) {
    // Fall back to normal RNG if anything unexpected happens.
  }
  
  // Get player pools for both teams
  const ourPlayers = getOurSelectedFive();
  const oppPlayers = getOpponentPlayers();
  
  // Ensure we have actual player objects with names
  const ourPlayersWithNames = ourPlayers.filter(p => p && p.name && p.name.trim() !== '');
  const oppPlayersWithNames = oppPlayers.filter(p => p && p.name && p.name.trim() !== '');
  
  
  // Create goal events distributed throughout the match (90 minutes)
  const events = [];
  const sentOffPlayers = new Set(); // Track sent off players
  
  // Add our goals with player details - distribute throughout 90 minutes
  for (let i = 0; i < ourGoals; i++) {
    const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes (avoid early goals)
    const scorer = ourPlayersWithNames.length > 0 ? pick(ourPlayersWithNames) : null;
    const assister = (Math.random() < 0.6 && ourPlayersWithNames.length > 1) 
      ? pick(ourPlayersWithNames.filter(p => p.id !== scorer?.id)) 
      : null;
    
    // Ensure we have a proper player name, fallback to generating one if needed
    let scorerName = scorer?.name;
    if (!scorerName && ourPlayers.length > 0) {
      const fallbackPlayer = pick(ourPlayers);
      scorerName = fallbackPlayer?.name || `Southampton Player ${i + 1}`;
    } else if (!scorerName) {
      scorerName = `Southampton Player ${i + 1}`;
    }
    
    let assisterName = assister?.name || null;
    if (assister && !assisterName && ourPlayers.length > 1) {
      const fallbackAssister = pick(ourPlayers.filter(p => p.id !== scorer?.id));
      assisterName = fallbackAssister?.name || null;
    }
    
    events.push({ 
      t, 
      who: 'HOME', 
      kind: 'GOAL',
      scorer: scorerName,
      assister: assisterName,
      team: getClubName()
    });
  }
  
  // Add opponent goals with player details - distribute throughout 90 minutes
  for (let i = 0; i < oppGoals; i++) {
    const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes (avoid early goals)
    const scorer = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
    const assister = (Math.random() < 0.6 && oppPlayersWithNames.length > 1) 
      ? pick(oppPlayersWithNames.filter(p => p.id !== scorer?.id)) 
      : null;
    
    // Ensure we have a proper player name, fallback to generating one if needed
    let scorerName = scorer?.name;
    if (!scorerName && oppPlayers.length > 0) {
      const fallbackPlayer = pick(oppPlayers);
      scorerName = fallbackPlayer?.name || `Opponent Player ${i + 1}`;
    } else if (!scorerName) {
      scorerName = `Opponent Player ${i + 1}`;
    }
    
    let assisterName = assister?.name || null;
    if (assister && !assisterName && oppPlayers.length > 1) {
      const fallbackAssister = pick(oppPlayers.filter(p => p.id !== scorer?.id));
      assisterName = fallbackAssister?.name || null;
    }
    
    const oppTeam = currentOpponent()?.team || 'Opposition';
    events.push({ 
      t, 
      who: 'AWAY', 
      kind: 'GOAL',
      scorer: scorerName,
      assister: assisterName,
      team: oppTeam
    });
  }
  
  // Check for cocaine users (our team)
  const ourCocaineUsers = ourPlayersWithNames.filter(p => p.on_cocaine_this_match);
  const oppCocaineUsers = S.matchContext?.oppositionCocaineUsers || [];
  
  // Check for drug-dependent players without coke (our team) - they'll have massive performance issues
  const ourDrugDependentWithoutCoke = ourPlayersWithNames.filter(p => 
    p.cocaine_dependency_risk && p.cocaine_dependency_risk > 0 && !p.on_cocaine_this_match
  );
  
  // Check for HGH users (our team)
  const ourHGHUsers = ourPlayersWithNames.filter(p => p.on_hgh_this_match);
  
  // Add other events (shots, corners, fouls, cards, possession) - much more common than goals
  const otherEvents = 14 + Math.floor(Math.random() * 10); // 14-23 other events (slightly more action overall)
  for (let i = 0; i < otherEvents; i++) {
    const t = 2 + Math.floor(Math.random() * 88); // 2-90 minutes
    const who = (Math.random() < ourShare) ? 'HOME' : 'AWAY';
    const r = Math.random();
    let kind = 'SHOT';
    let player = null;
    let team = null;
    let isCocaineUser = false;
    let isHGHUser = false;
    
    // Assign player and team based on event type
    let isDrugDependentWithoutCoke = false;
    if (who === 'HOME') {
      // If there are drug-dependent players without coke, make them much more likely to appear in events (they're playing badly)
      if (ourDrugDependentWithoutCoke.length > 0 && Math.random() < 0.4) {
        // 40% chance to pick a drug-dependent player when they exist (they're more noticeable due to poor play)
        player = pick(ourDrugDependentWithoutCoke);
        isDrugDependentWithoutCoke = true;
      } else {
        player = ourPlayersWithNames.length > 0 ? pick(ourPlayersWithNames) : null;
      }
      team = 'Southampton FC';
      if (player && ourCocaineUsers.find(p => p.name === player.name)) {
        isCocaineUser = true;
      }
      if (player && ourDrugDependentWithoutCoke.find(p => p.name === player.name)) {
        isDrugDependentWithoutCoke = true;
      }
      if (player && ourHGHUsers.find(p => p.name === player.name)) {
        isHGHUser = true;
      }
    } else {
      player = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
      team = currentOpponent()?.team || 'Opposition';
      if (player && oppCocaineUsers.includes(player.name)) {
        isCocaineUser = true;
      }
    }
    
    // Cocaine users are much more likely to commit fouls and get cards
    if (isCocaineUser) {
      // Heavily bias towards violent events so cocaine actually feels different
      if (r < 0.10) {
        kind = 'SHOT';
      } else if (r < 0.18) {
        kind = 'CORNER';
      } else if (r < 0.65) {
        kind = 'FOUL'; // Majority of events are fouls
      } else if (r < 0.78) {
        kind = 'POSSESSION';
      } else if (r < 0.93) {
        kind = 'YELLOW_CARD'; // Frequent bookings
      } else {
        kind = 'RED_CARD'; // Very real red card risk
      }
    } else {
      // Normal event distribution
      if (r < 0.25) {
        kind = 'SHOT';
      } else if (r < 0.45) {
        kind = 'CORNER';
      } else if (r < 0.65) {
        kind = 'FOUL';
      } else if (r < 0.80) {
        kind = 'POSSESSION';
      } else if (r < 0.95) {
        kind = 'YELLOW_CARD';
      } else {
        kind = 'RED_CARD';
      }
    }
    
    // HGH users get occasional "hulking mass" commentary events
    if (isHGHUser && Math.random() < 0.15) {
      events.push({
        t: t + 0.1,
        who,
        kind: 'HGH_COMMENTARY',
        player: player?.name || 'Unknown Player',
        team: team
      });
    }
    
    // For red cards, mark player as sent off
    if (kind === 'RED_CARD' && player) {
      sentOffPlayers.add(player.name);
    }
    
    // Cocaine users can cause stretcher injuries
    if (isCocaineUser && kind === 'FOUL' && Math.random() < 0.5) {
      // This foul causes a stretcher injury
      const victim = (who === 'HOME') 
        ? (oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames.filter(p => p.name !== player?.name)) : null)
        : (ourPlayersWithNames.length > 0 ? pick(ourPlayersWithNames.filter(p => p.name !== player?.name)) : null);
      
      if (victim) {
        events.push({
          t: t + 0.05,
          who: who === 'HOME' ? 'AWAY' : 'HOME',
          kind: 'STRETCHER_INJURY',
          player: victim.name,
          team: who === 'HOME' ? (currentOpponent()?.team || 'Opposition') : getClubName(),
          causedBy: player?.name || 'Unknown Player',
          causedByTeam: team
        });
      }
    }
    
    events.push({ 
      t, 
      who, 
      kind,
      player: player?.name || 'Unknown Player',
      team: team,
      sentOff: kind === 'RED_CARD' ? true : false,
      isCocaineUser: isCocaineUser,
      isHGHUser: isHGHUser,
      isDrugDependentWithoutCoke: isDrugDependentWithoutCoke
    });
  }

  // Safety net: if there are cocaine users but no violent coke events were generated, inject at least one
  const hasCokeUsers = (ourCocaineUsers.length > 0) || (oppCocaineUsers.length > 0);
  const hasCokeViolence = events.some(ev => ev.isCocaineUser && (ev.kind === 'FOUL' || ev.kind === 'YELLOW_CARD' || ev.kind === 'RED_CARD' || ev.kind === 'STRETCHER_INJURY'));
  if (hasCokeUsers && !hasCokeViolence) {
    const who = (ourCocaineUsers.length > 0 && Math.random() < 0.7) ? 'HOME' : 'AWAY';
    const pool = who === 'HOME' ? ourCocaineUsers : oppPlayersWithNames.filter(p => oppCocaineUsers.includes(p.name));
    const player = (pool && pool.length > 0) ? pick(pool) : null;
    const team = who === 'HOME' ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition');
    const t = 10 + Math.floor(Math.random() * 70);
    
    if (player) {
      // Guaranteed nasty foul
      events.push({
        t,
        who,
        kind: 'FOUL',
        player: player.name,
        team,
        sentOff: false,
        isCocaineUser: true,
        isHGHUser: false
      });
      
      // 50% chance we immediately attach a stretcher injury to ram the point home
      if (Math.random() < 0.5) {
        const victimPool = who === 'HOME' ? oppPlayersWithNames : ourPlayersWithNames;
        const victim = (victimPool && victimPool.length > 0)
          ? pick(victimPool.filter(p => p.name !== player.name))
          : null;
        if (victim) {
          events.push({
            t: t + 0.1,
            who: who === 'HOME' ? 'AWAY' : 'HOME',
            kind: 'STRETCHER_INJURY',
            player: victim.name,
            team: who === 'HOME' ? (currentOpponent()?.team || 'Opposition') : getClubName(),
            causedBy: player.name,
            causedByTeam: team
          });
        }
      }
    }
  }
  
  // Add Gazza shenanigans if he's in the first team (both drunk and sober quick sims)
  if (S.season === 3 && S.season3 && S.season3.gaz_signed && !S.season3.gaz_killed_by_player && !S.season3.gaz_reported) {
    const gazPlayer = ourPlayersWithNames.find(p => 
      p && (p.name && (p.name.toLowerCase().includes('gascoigne') || p.name.toLowerCase().includes('gazza'))) ||
      (S.season3.gaz_player_id && p.id === S.season3.gaz_player_id)
    );
    const gazInFirstTeam = !!gazPlayer;
    
    if (gazInFirstTeam) {
      // Gazza shenanigans - multiple possible events per match
      const shenaniganChance = 0.6; // 60% chance of at least one shenanigan
      if (Math.random() < shenaniganChance) {
        const shenaniganTypes = [
          'DRUNK', 'VODKA', 'EXPOSE', 'OWN_GOAL', 'SENT_OFF', 'ATTACK_FANS', 'FALL_ASLEEP'
        ];
        const numShenanigans = 1 + Math.floor(Math.random() * 3); // 1-3 shenanigans per match
        for (let i = 0; i < numShenanigans; i++) {
          const t = 15 + Math.floor(Math.random() * 70); // 15-85 minutes
          const shenaniganType = pick(shenaniganTypes);
          events.push({
            t,
            who: 'HOME',
            kind: 'GAZ_SHENANIGAN',
            player: 'Paul Gascoigne',
            team: getClubName(),
            shenaniganType: shenaniganType
          });
        }
      }
    }
  }
  
  // Add some atmosphere events
  const atmosphereEvents = 2 + Math.floor(Math.random() * 3); // 2-4 atmosphere events
  for (let i = 0; i < atmosphereEvents; i++) {
    const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes
    const messages = [
      "The crowd is getting behind their team!",
      "Chants echo around the stadium!",
      "The atmosphere is electric!",
      "Fans are on their feet!",
      "The noise is deafening!"
    ];
    events.push({
      t,
      who: 'NEUTRAL',
      kind: 'ATMOSPHERE',
      message: pick(messages)
    });
  }
  
  // Add crazy drama events for Champions League and World Cup matches
  const isCupMatch = S.competition === 'champions_league' || S.competition === 'world_cup' || S.clActive || S.worldCupActive;
  if (isCupMatch) {
    // Add 3-6 crazy events throughout the match
    const numCrazyEvents = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numCrazyEvents; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // Between 10-90 minutes
      const eventType = Math.random();
      
      if (eventType < 0.25) {
        // Backflip (25% chance)
        const player = pick(ourPlayersWithNames.concat(oppPlayersWithNames).filter(p => p));
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_BACKFLIP',
          player: player?.name || 'A player',
          message: generateBackflipCommentary()
        });
      } else if (eventType < 0.50) {
        // Player fight (25% chance)
        const player1 = pick(ourPlayersWithNames.length > 0 ? ourPlayersWithNames : oppPlayersWithNames);
        const player2 = pick(oppPlayersWithNames.length > 0 ? oppPlayersWithNames : ourPlayersWithNames);
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_FIGHT',
          player: player1?.name || 'A player',
          player2: player2?.name || 'Another player',
          message: generatePlayerFightCommentary()
        });
      } else if (eventType < 0.70) {
        // Referee exposure (20% chance)
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_REF_EXPOSURE',
          message: generateRefereeExposureCommentary()
        });
      } else if (eventType < 0.90) {
        // Fan shooting (20% chance)
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_FAN_SHOOTING',
          message: generateFanShootingCommentary()
        });
      } else {
        // General drama (10% chance)
        const player = pick(ourPlayersWithNames.concat(oppPlayersWithNames).filter(p => p));
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_DRAMA',
          player: player?.name || 'A player',
          message: generateCrazyDramaCommentary()
        });
      }
    }
  }
  
  // Sort events by time
  events.sort((a, b) => a.t - b.t);
  
  // Store sent off players for later reference
  events.sentOffPlayers = sentOffPlayers;
  
  return events;
}

// --- Animator on a 320x180 canvas
async function _animateMatch(events){
  return new Promise(resolve=>{
    _watch.running = true;
    _watch.resolve = resolve;
    _watch.forcedOutcome = null;

    const modal  = document.getElementById('matchViewer');
    const canvas = document.getElementById('matchCanvas');
    const com    = document.getElementById('matchCommentary');
    const tick   = document.getElementById('matchTicker');
// (place near the top of the function scope—NOT global)
let _lastBribeLineAtMinute = -999;




    // SAFETY: if the viewer/canvas isn't in the DOM, fall back to a quick resolve
    if (!canvas) {
      console.warn('matchCanvas not found – falling back to quick result.');
      const quick = _quickResolve ? _quickResolve() : { home: 0, away: 0 };
      _watch.running = false;
      return resolve({ home: quick.home, away: quick.away });
    }
    

    const ctx = canvas.getContext('2d');
    // ... (rest of your animator as-is)



    // scene: pitch + 5v5 blobs + ball
    const pitch = { w: canvas.width, h: canvas.height };
    const home = _spawnTeam(true, pitch);
    const away = _spawnTeam(false, pitch);
    const ball = { x: pitch.w/2, y: pitch.h/2, vx:0, vy:0 };
    let homeG=0, awayG=0;
    let clock=0, i=0;
    const totalTime = 90; // Fixed 90 minutes for realistic match duration
    const sentOffPlayers = new Set(); // Track sent off players
    let yellowCards = 0;
    let redCards = 0;
    let injuries = 0;
    let subsUsed = 0;
    let subsAvailable = 5;
    if (S && S.preMatch && S.preMatch.canUseSubs === false) {
      subsAvailable = 0;
    }
    
    // Function to update match status display
    function updateMatchStatus() {
      const cardsEl = document.getElementById('matchCards');
      const injuriesEl = document.getElementById('matchInjuries');
      if (cardsEl) {
        cardsEl.textContent = `🟨 ${yellowCards} 🟥 ${redCards}`;
      }
      if (injuriesEl) {
        injuriesEl.textContent = `🚑 ${injuries}`;
      }
    }

    // Apply a performance penalty when a side goes down to 10 men.
    function applyRedCardPerformancePenalty(who) {
      if (!S || !S.preMatch) return;
      const PENALTY = 10; // single red is a meaningful but not fatal hit
      if (who === 'HOME') {
        S.preMatch.ourStrength = Math.max(10, (S.preMatch.ourStrength || 50) - PENALTY);
      } else if (who === 'AWAY') {
        S.preMatch.oppStrength = Math.max(10, (S.preMatch.oppStrength || 50) - PENALTY);
      }
    }

    function draw(){
      // bg
      ctx.fillStyle = '#0a6';
      ctx.fillRect(0,0,pitch.w,pitch.h);
      // mid line
      ctx.fillStyle = '#fff';
      ctx.fillRect(pitch.w/2-1, 0, 2, pitch.h);
      // teams
      _drawDots(ctx, home, '#e33'); // home red
      _drawDots(ctx, away, '#33e'); // away blue
      // ball
      ctx.fillStyle = '#fff';
      ctx.fillRect(ball.x|0, ball.y|0, 2, 2);
    }

    function step(){
      if (!_watch.running) return; // will be resolved by skip/close
      // simple wander for players
      _wander(home, pitch); _wander(away, pitch);
      // move ball
      ball.x += ball.vx; ball.y += ball.vy;
      ball.vx *= 0.98; ball.vy *= 0.98;
      // play event when time
      while (i<events.length && clock >= events[i].t){
        const e = events[i++];
        _doEvent(e);
      }
      draw();
      // clock HUD
      if (tick) tick.textContent = _fmt(clock);
// --- Inject bribery-flavored commentary (uses whole-minute granularity)
// fire an outrage line occasionally if the ref was bribed
if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
  const { team: oppTeam } = currentOpponent();
  const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
  const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';

  const minuteNow = Math.floor(clock);               // <-- use local cutscene clock
  const changedMinute = (minuteNow !== _lastBribeLineAtMinute);
  const shouldFire = changedMinute && (Math.random() < 0.12);

  if (shouldFire) {
    const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
    const line = pick(pool)                          // <-- keep this semicolon ↓
      .replaceAll('{FAV}', favName)
      .replaceAll('{OPP}', oppName);
    _appendCom(com, line);                                    // or _appendCom(com, line) if that’s your helper
    _lastBribeLineAtMinute = minuteNow;
  }
}

      clock += 0.025; // Slightly slower match speed for more leisurely commentary flow
      if (clock >= totalTime+0.1){
        // wrap up
        _appendCom(com, `Full-time: ${getClubName()} ${homeG} – ${awayG} ${_oppName()}`);
        
        // Season 5 first match: Mohammed Van Onslaught massacre event
        if (S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0) {
          // Wait for match to fully end, then show popout
          setTimeout(async () => {
            // Show the ominous popout
            await showOminousMassacrePopout();
            
            // Mark event as complete
            S.season5.first_match_special_event = false;
            // Mark that we need to play the video after match UI
            S.season5.play_panic_video = true;
          }, 2000);
        }
        
        // Check if this is the stadium fire match
        if (S.preMatch?.stadium_burn_triggered) {
          // Add explosion effect
          _appendCom(com, `💥 SUDDENLY: Flames erupt from the stadium!`);
          _appendCom(com, `🔥 The ground shakes as explosions rock St Mary's!`);
          _appendCom(com, `🚨 EMERGENCY: The stadium has been attacked by terrorists!`);
          _appendCom(com, `💣 Multiple bombs have exploded throughout the stadium!`);
          _appendCom(com, `🔥 The stadium is burning down! Flames engulf the stands!`);
          _appendCom(com, `🩸 There's blood and guts everywhere!`);
          _appendCom(com, `😱 Everyone is screaming in terror!`);
          
          // Draw explosion on canvas
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(pitch.w/2, pitch.h/2, 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Add more explosion effects
          for (let i = 0; i < 5; i++) {
            const x = pitch.w/2 + (Math.random() - 0.5) * 100;
            const y = pitch.h/2 + (Math.random() - 0.5) * 100;
            ctx.fillStyle = `rgba(255, ${100 + Math.random() * 155}, 0, 0.8)`;
            ctx.beginPath();
            ctx.arc(x, y, 20 + Math.random() * 30, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Track all players who played in this match
        const ourPlayers = getOurSelectedFive();
        const oppPlayers = getOpponentPlayers();
        
        // Add match played for all our players
        ourPlayers.forEach(player => {
          if (player?.name) {
            addMatchToTopScorers(player.name, getClubName());
          }
        });
        
        // Add match played for all opponent players
        const oppTeam = currentOpponent()?.team || 'Opposition';
        oppPlayers.forEach(player => {
          if (player?.name) {
            addMatchToTopScorers(player.name, oppTeam);
          }
        });
        
        // Store match events for summary
        S.matchEvents = events;
        
        // Clear opponent players for next match
        S.currentOpponentPlayers = null;
        
        // Wait for user to read the match commentary before continuing
        setTimeout(() => {
          _watch.running = false;
          _watch.resolve({home:homeG, away:awayG});
        }, 2000); // Give 2 seconds to read the final commentary
        return;
      }
      requestAnimationFrame(step);
    }

    function _doEvent(e){
      const comEl = com;
      
      // Skip events for sent off players
      if (e.player && sentOffPlayers.has(e.player)) {
        return;
      }
      
      if (e.kind==='GOAL'){
        const toward = (e.who==='HOME') ? {x:pitch.w-6, y:pitch.h/2} : {x:6, y:pitch.h/2};
        _kickBall(ball, toward, 2.5);
        
        // Update top scorers (only once during animation)
        if (e.scorer) {
          addGoalToTopScorers(e.scorer, e.team);
        }
        if (e.assister) {
          addAssistToTopScorers(e.assister, e.team);
        }
        
        // Update scoreline
        if (e.who === 'HOME'){ 
          homeG++; 
        } else { 
          awayG++; 
        }

        // Use shared goal commentary generator so special Portsmouth/drug logic
        // is applied consistently across all match modes.
        let goalText;
        try {
          const base = (typeof generateGoalCommentary === 'function')
            ? generateGoalCommentary(e)
            : null;
          goalText = base || (
            e.who === 'HOME'
              ? (e.assister 
                  ? `GOAL! ${e.scorer} scores! (Assist: ${e.assister})`
                  : `GOAL! ${e.scorer} scores!`)
              : (e.assister
                  ? `${e.scorer} scores for ${_oppName()}! (Assist: ${e.assister})`
                  : `${e.scorer} scores for ${_oppName()}!`)
          );
        } catch (_e) {
          goalText = e.who === 'HOME'
            ? (e.assister 
                ? `GOAL! ${e.scorer} scores! (Assist: ${e.assister})`
                : `GOAL! ${e.scorer} scores!`)
            : (e.assister
                ? `${e.scorer} scores for ${_oppName()}! (Assist: ${e.assister})`
                : `${e.scorer} scores for ${_oppName()}!`);
        }

        _appendCom(comEl, goalText);
      } else if (e.kind==='SHOT'){
        _kickBall(ball, {x: (e.who==='HOME')? pitch.w-10 : 10, y: 10+Math.random()*(pitch.h-20)}, 2.0);
        
        // Use shared shot commentary (includes drug‑dependent lazy lines)
        let shotText;
        try {
          if (typeof generateShotCommentary === 'function') {
            shotText = generateShotCommentary(e);
          }
        } catch (_e) {}

        if (!shotText) {
          shotText = e.player 
            ? `${e.player} shoots—${(e.who==='HOME') ? 'dragged wide' : 'just past the post'}!`
            : (e.who==='HOME') ? "Southampton chance! Dragged wide." : `${_oppName()} effort—just past the post.`;
        }
        _appendCom(com, shotText);
      } else if (e.kind==='CORNER'){
        // Use shared corner commentary (includes drug‑dependent lazy lines)
        let cornerText;
        try {
          if (typeof generateCornerCommentary === 'function') {
            cornerText = generateCornerCommentary(e);
          }
        } catch (_e) {}

        if (!cornerText) {
          cornerText = e.player 
            ? `Corner to ${e.who==='HOME' ? 'Southampton' : _oppName()}—${e.player} takes it.`
            : (e.who==='HOME') ? "Corner to Southampton…" : `Corner to ${_oppName()}…`;
        }
        _appendCom(com, cornerText);
      } else if (e.kind==='FOUL'){
        // Check if this is a drug-dependent player without coke - lazy commentary
        if (e.isDrugDependentWithoutCoke && e.player) {
          const lazyLines = [
            `${e.player} can't be bothered to commit a proper foul. He just lazily trips his opponent.`,
            `${e.player} looks completely disinterested as he half-heartedly fouls.`,
            `${e.player} can't be bothered to play. That foul was pathetic.`
          ];
          _appendCom(com, pick(lazyLines));
        } else if (e.isCocaineUser && e.player) {
          const cocaineCommentary = generateCocaineCommentary(e.player, 'FOUL');
          _appendCom(com, cocaineCommentary);
          // Much higher chance of continued assault after foul (70% chance)
          if (Math.random() < 0.70) {
            setTimeout(() => {
              // 20% chance of weapon assault, 80% chance of continued kicking
              if (Math.random() < 0.20) {
                const weaponAssault = generateCocaineCommentary(e.player, 'WEAPON_ASSAULT');
                _appendCom(com, weaponAssault);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
                  _appendCom(com, "I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this weapon assault! If I didn't know better I'd say this referee has been bribed!");
                } else {
                  // Normal red card for weapon assault
                  if (e.player) {
                    redCards++;
                    updateMatchStatus();
                    addCardToTopScorers(e.player, e.team, 'red');
                    sentOffPlayers.add(e.player);
                    _appendCom(com, `RED CARD! ${e.player} is sent off for assault with a weapon! This is absolutely criminal!`);
                  }
                }
              } else {
                const continuedAssault = generateCocaineCommentary(e.player, 'CONTINUED_ASSAULT');
                _appendCom(com, continuedAssault);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
                  _appendCom(com, "I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this assault! If I didn't know better I'd say this referee has been bribed!");
                } else {
                // Normal red card for continued assault
                if (e.player) {
                  redCards++;
                  updateMatchStatus();
                  addCardToTopScorers(e.player, e.team, 'red');
                  sentOffPlayers.add(e.player);
                  applyRedCardPerformancePenalty(e.who);
                  _appendCom(com, `RED CARD! ${e.player} is sent off for violent conduct!`);
                }
                }
              }
            }, 1200); // Slower delay for more dramatic effect
          }
        } else {
          const foulText = e.player 
            ? `${e.player} commits a foul.`
            : (e.who==='HOME') ? "Naughty tackle. Ref has a word." : "Heavy challenge from the visitors.";
          _appendCom(com, foulText);
        }
      } else if (e.kind==='YELLOW_CARD'){
        yellowCards++;
        updateMatchStatus();
        if (e.player) {
          addCardToTopScorers(e.player, e.team, 'yellow');
          if (e.isDrugDependentWithoutCoke && e.player) {
            const lazyLines = [
              `Yellow card for ${e.player}! He can't be bothered to even argue about it.`,
              `${e.player} gets a yellow card. He looks completely unmotivated.`,
              `Yellow card for ${e.player}! He can't be bothered to play properly.`
            ];
            _appendCom(com, pick(lazyLines));
          } else {
            _appendCom(com, `Yellow card for ${e.player}!`);
          }
        } else {
          _appendCom(com, "Yellow card shown.");
        }
      } else if (e.kind==='RED_CARD'){
        redCards++;
        updateMatchStatus();
        if (e.player) {
          addCardToTopScorers(e.player, e.team, 'red');
          sentOffPlayers.add(e.player); // Track sent off player
          // Check if cocaine user and referee bribed
          if (e.isCocaineUser && S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
            _appendCom(com, `I CAN'T BELIEVE IT! ${e.player} should be sent off for this brutal assault but the referee turns a complete blind eye! If I didn't know better I'd say this referee has been bribed!`);
            sentOffPlayers.delete(e.player); // Don't actually send off if bribed
            redCards--; // Don't count if bribed ref prevents it
            updateMatchStatus();
          } else {
            // Genuine red card – apply performance hit
            applyRedCardPerformancePenalty(e.who);
            if (e.isDrugDependentWithoutCoke && e.player) {
              const lazyLines = [
                `RED CARD! ${e.player} is sent off! He can't be bothered to even care.`,
                `${e.player} gets a red card. He looks completely unmotivated as he trudges off.`,
                `RED CARD! ${e.player}! He can't be bothered to play properly anyway.`
              ];
              _appendCom(com, pick(lazyLines));
            } else if (e.isCocaineUser && e.player) {
              _appendCom(com, `RED CARD! ${e.player} is sent off for this brutal assault!`);
            } else {
              _appendCom(com, `RED CARD! ${e.player} is sent off!`);
            }
          }
        } else {
          // Anonymous red still hurts the team overall
          applyRedCardPerformancePenalty(e.who);
          _appendCom(com, "RED CARD! Player sent off!");
        }
      } else if (e.kind==='STRETCHER_INJURY'){
        injuries++;
        updateMatchStatus();
        const stretcherCommentary = generateStretcherInjuryCommentary(e.player, e.causedBy);
        _appendCom(com, stretcherCommentary);
        // Forced substitution cosmetic logic for watch mode
        if (e.who === 'HOME') {
          if (subsUsed < subsAvailable) {
            subsUsed++;
            _appendCom(com, `Forced substitution for Southampton – you reshuffle the pack.`);
          } else {
            _appendCom(com, `⚠️ No subs left — Saints play on with fewer than five players.`);
          }
        }
        // Check if opponent manager was bribed - if so, no substitution
        if (S && S.opponent_bribed && e.who === 'AWAY') {
          _appendCom(com, `The opposition manager allows ${e.player} to be taken off on a stretcher without substitution! This is bizarre!`);
          // Reduce opponent strength significantly
          if (S.preMatch) {
            S.preMatch.oppStrength = Math.max(10, (S.preMatch.oppStrength || 50) - 15);
          }
        } else {
          // Normal substitution happens (reduce team strength slightly)
          if (e.who === 'HOME' && S.preMatch) {
            S.preMatch.ourStrength = Math.max(10, (S.preMatch.ourStrength || 50) - 8);
          } else if (e.who === 'AWAY' && S.preMatch) {
            S.preMatch.oppStrength = Math.max(10, (S.preMatch.oppStrength || 50) - 8);
          }
        }
      } else if (e.kind==='HGH_COMMENTARY'){
        if (e.player) {
          const hghCommentary = generateHGHCommentary(e.player);
          _appendCom(com, hghCommentary);
        }
      } else if (e.kind==='COCAINE_HEART_ATTACK'){
        const name = e.player || 'A player';
        _appendCom(com, `${name} collapses on the pitch – suspected heart failure linked to drug abuse.`);
      } else if (e.kind==='ATMOSPHERE'){
        _appendCom(com, e.message);
      }
    }

    // start
    com.innerHTML = "";
    yellowCards = 0;
    redCards = 0;
    injuries = 0;
    updateMatchStatus();
    _appendCom(com, `Kickoff at ${getStadiumName()}: ${getClubName()} vs ${_oppName()}.`);
    modal.classList.remove('hidden');
    requestAnimationFrame(step);

    // internals
    function _oppName(){
      const opp = (typeof currentOpponent==='function') ? currentOpponent() : null;
      return opp?.team || "Opposition";}
   
  });
}

function _openMatchViewer(){
  const modal = document.getElementById('matchViewer');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  } else {
    console.error('Match viewer element not found');
  }
}
function _closeMatchViewer(){
  const modal = document.getElementById('matchViewer');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Unified match animation with graphics and commentary
async function _animateMatchWithCommentary(events, canvas, com, tick, gf, ga) {
  return new Promise(resolve => {
    if (!canvas || !com) {
      console.warn('Match viewer elements not found');
      resolve({ home: gf, away: ga });
      return;
    }

    const ctx = canvas.getContext('2d');
    const pitch = { w: canvas.width, h: canvas.height };
    const home = _spawnTeam(true, pitch);
    const away = _spawnTeam(false, pitch);
    const ball = { x: pitch.w/2, y: pitch.h/2, vx:0, vy:0 };
    let homeG = 0, awayG = 0;
    let clock = 0;
    let eventIndex = 0;
    const totalTime = 90;
    const sentOffPlayers = new Set();
    let animationRunning = true;
    let yellowCards = 0;
    let redCards = 0;
    let injuries = 0;
    
    // Function to update match status display
    function updateMatchStatus() {
      const cardsEl = document.getElementById('matchCards');
      const injuriesEl = document.getElementById('matchInjuries');
      if (cardsEl) {
        cardsEl.textContent = `🟨 ${yellowCards} 🟥 ${redCards}`;
      }
      if (injuriesEl) {
        injuriesEl.textContent = `🚑 ${injuries}`;
      }
    }

    // Helper to check if skip was requested
    const checkSkip = () => {
      const skipBtn = document.getElementById('skipMatchBtn');
      if (skipBtn && skipBtn.dataset.skipped === 'true') {
        animationRunning = false;
        return true;
      }
      return false;
    };

    function draw(){
      // bg
      ctx.fillStyle = '#0a6';
      ctx.fillRect(0,0,pitch.w,pitch.h);
      // mid line
      ctx.fillStyle = '#fff';
      ctx.fillRect(pitch.w/2-1, 0, 2, pitch.h);
      // teams
      _drawDots(ctx, home, '#e33'); // home red
      _drawDots(ctx, away, '#33e'); // away blue
      // ball
      ctx.fillStyle = '#fff';
      ctx.fillRect(ball.x|0, ball.y|0, 2, 2);
    }

    function step(){
      if (!animationRunning || checkSkip()) {
        resolve({ home: homeG, away: awayG });
        return;
      }

      // simple wander for players
      _wander(home, pitch); _wander(away, pitch);
      // move ball
      ball.x += ball.vx; ball.y += ball.vy;
      ball.vx *= 0.98; ball.vy *= 0.98;

      // play event when time
      while (eventIndex < events.length && clock >= events[eventIndex].t){
        const e = events[eventIndex++];
        _doEvent(e);
      }

      draw();
      
      // clock HUD
      if (tick) tick.textContent = _fmt(clock);

      // Inject bribery-flavored commentary if ref was bribed
      if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
        const { team: oppTeam } = currentOpponent();
        const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
        const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';
        const minuteNow = Math.floor(clock);
        const changedMinute = (minuteNow !== (window._lastBribeLineAtMinute || -999));
        const shouldFire = changedMinute && (Math.random() < 0.12);

        if (shouldFire) {
          const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
          const line = pick(pool)
            .replaceAll('{FAV}', favName)
            .replaceAll('{OPP}', oppName);
          _appendCom(com, line);
          window._lastBribeLineAtMinute = minuteNow;
        }
      }

      // Add crazy drama for Champions League and World Cup matches
      if (S && (S.competition === 'champions_league' || S.competition === 'world_cup' || S.worldCupActive || S.clActive)) {
        const minuteNow = Math.floor(clock);
        const changedMinute = (minuteNow !== (window._lastCrazyEventAtMinute || -999));
        // Higher chance of crazy events (15% per minute)
        const shouldFire = changedMinute && (Math.random() < 0.15);

        if (shouldFire && clock > 5 && clock < 88) { // Don't fire in first 5 minutes or last 2 minutes
          const eventType = Math.random();
          let crazyCommentary = '';
          
          if (eventType < 0.25) {
            // Backflip (25% chance)
            crazyCommentary = generateBackflipCommentary();
          } else if (eventType < 0.50) {
            // Player fight (25% chance)
            crazyCommentary = generatePlayerFightCommentary();
          } else if (eventType < 0.70) {
            // Referee exposure (20% chance)
            crazyCommentary = generateRefereeExposureCommentary();
          } else if (eventType < 0.90) {
            // Fan shooting (20% chance)
            crazyCommentary = generateFanShootingCommentary();
          } else {
            // General drama (10% chance)
            crazyCommentary = generateCrazyDramaCommentary();
          }
          
          if (crazyCommentary) {
            _appendCom(com, crazyCommentary);
            window._lastCrazyEventAtMinute = minuteNow;
          }
        }
        
        // Add drunk manager commentary for World Cup matches (watch mode)
        if (S.isDrunk && S.competition === 'world_cup' && changedMinute && Math.random() < 0.2) {
          const oppName = S.matchContext?.team || currentOpponent()?.team || 'Opposition';
          const drunkComment = generateDrunkManagerCommentary(oppName);
          if (drunkComment) {
            _appendCom(com, drunkComment);
          }
        }
      }

      clock += 0.025; // Slightly slower match speed for more leisurely commentary flow
      
      if (clock >= totalTime + 0.1){
        // wrap up
        const oppName = (typeof currentOpponent === 'function') ? (currentOpponent()?.team || 'Opposition') : 'Opposition';
        _appendCom(com, `Full-time: ${getClubName()} ${homeG} – ${awayG} ${oppName}`);
        
        // Check if this is the stadium fire match
        if (S.preMatch?.stadium_burn_triggered) {
          _appendCom(com, `💥 SUDDENLY: Flames erupt from the stadium!`);
          _appendCom(com, `🔥 The ground shakes as explosions rock St Mary's!`);
          _appendCom(com, `🚨 EMERGENCY: The stadium has been attacked by terrorists!`);
          _appendCom(com, `💣 Multiple bombs have exploded throughout the stadium!`);
          _appendCom(com, `🔥 The stadium is burning down! Flames engulf the stands!`);
          _appendCom(com, `🩸 There's blood and guts everywhere!`);
          _appendCom(com, `😱 Everyone is screaming in terror!`);
          
          // Draw explosion on canvas
          ctx.fillStyle = '#ff4400';
          ctx.beginPath();
          ctx.arc(pitch.w/2, pitch.h/2, 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Add more explosion effects
          for (let i = 0; i < 5; i++) {
            const x = pitch.w/2 + (Math.random() - 0.5) * 100;
            const y = pitch.h/2 + (Math.random() - 0.5) * 100;
            ctx.fillStyle = `rgba(255, ${100 + Math.random() * 155}, 0, 0.8)`;
            ctx.beginPath();
            ctx.arc(x, y, 20 + Math.random() * 30, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Track all players who played in this match
        const ourPlayers = getOurSelectedFive();
        const oppPlayers = getOpponentPlayers();
        
        // Add match played for all our players
        ourPlayers.forEach(player => {
          if (player?.name) {
            addMatchToTopScorers(player.name, getClubName());
          }
        });
        
        // Add match played for all opponent players
        const oppTeam = currentOpponent()?.team || 'Opposition';
        oppPlayers.forEach(player => {
          if (player?.name) {
            addMatchToTopScorers(player.name, oppTeam);
          }
        });
        
        animationRunning = false;
        setTimeout(() => {
          resolve({ home: homeG, away: awayG });
        }, 2000);
        return;
      }
      requestAnimationFrame(step);
    }

    function _doEvent(e){
      // Skip events for sent off players
      if (e.player && sentOffPlayers.has(e.player)) {
        return;
      }
      
      if (e.kind === 'GOAL'){
        const toward = (e.who === 'HOME') ? {x:pitch.w-6, y:pitch.h/2} : {x:6, y:pitch.h/2};
        _kickBall(ball, toward, 2.5);
        
        // Update top scorers
        if (e.scorer) {
          addGoalToTopScorers(e.scorer, e.team);
        }
        if (e.assister) {
          addAssistToTopScorers(e.assister, e.team);
        }
        
        if (e.who === 'HOME'){ 
          homeG++; 
          const goalCommentary = generateGoalCommentary(e);
          _appendCom(com, `⚽ ${goalCommentary}`);
          addGoalFlashEffect();
        }
        else { 
          awayG++; 
          const goalCommentary = generateGoalCommentary(e);
          _appendCom(com, `⚽ ${goalCommentary}`);
        }
      } else if (e.kind === 'SHOT'){
        _kickBall(ball, {x: (e.who === 'HOME')? pitch.w-10 : 10, y: 10+Math.random()*(pitch.h-20)}, 2.0);
        const shotCommentary = generateShotCommentary(e);
        _appendCom(com, shotCommentary);
      } else if (e.kind === 'CORNER'){
        const cornerCommentary = generateCornerCommentary(e);
        _appendCom(com, cornerCommentary);
      } else if (e.kind === 'FOUL'){
        // Check if this is a cocaine user - more aggressive commentary
        if (e.isCocaineUser && e.player) {
          const cocaineCommentary = generateCocaineCommentary(e.player, 'FOUL');
          _appendCom(com, cocaineCommentary);
          // Much higher chance of continued assault after foul (70% chance)
          if (Math.random() < 0.70) {
            setTimeout(() => {
              // 20% chance of weapon assault, 80% chance of continued kicking
              if (Math.random() < 0.20) {
                const weaponAssault = generateCocaineCommentary(e.player, 'WEAPON_ASSAULT');
                _appendCom(com, weaponAssault);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
                  _appendCom(com, "I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this weapon assault! If I didn't know better I'd say this referee has been bribed!");
                } else {
                  // Normal red card for weapon assault
                  if (e.player) {
                    redCards++;
                    updateMatchStatus();
                    addCardToTopScorers(e.player, e.team, 'red');
                    sentOffPlayers.add(e.player);
                    _appendCom(com, `RED CARD! ${e.player} is sent off for assault with a weapon! This is absolutely criminal!`);
                  }
                }
              } else {
                const continuedAssault = generateCocaineCommentary(e.player, 'CONTINUED_ASSAULT');
                _appendCom(com, continuedAssault);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
                  _appendCom(com, "I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this assault! If I didn't know better I'd say this referee has been bribed!");
                } else {
                  // Normal red card for continued assault
                  if (e.player) {
                    redCards++;
                    updateMatchStatus();
                    addCardToTopScorers(e.player, e.team, 'red');
                    sentOffPlayers.add(e.player);
                    _appendCom(com, `RED CARD! ${e.player} is sent off for violent conduct!`);
                  }
                }
              }
            }, 1200); // Slower delay for more dramatic effect
          }
        } else {
          const foulCommentary = generateFoulCommentary(e);
          _appendCom(com, foulCommentary);
        }
      } else if (e.kind === 'YELLOW_CARD'){
        yellowCards++;
        updateMatchStatus();
        if (e.player) {
          addCardToTopScorers(e.player, e.team, 'yellow');
          _appendCom(com, `Yellow card for ${e.player}!`);
        } else {
          _appendCom(com, "Yellow card shown.");
        }
      } else if (e.kind === 'RED_CARD'){
        redCards++;
        updateMatchStatus();
        if (e.player) {
          addCardToTopScorers(e.player, e.team, 'red');
          sentOffPlayers.add(e.player);
          // Check if cocaine user and referee bribed
          if (e.isCocaineUser && S && S.referee_bribed && ((S.referee_bribed === 'us' && e.who === 'HOME') || (S.referee_bribed === 'them' && e.who === 'AWAY'))) {
            _appendCom(com, `I CAN'T BELIEVE IT! ${e.player} should be sent off for this brutal assault but the referee turns a complete blind eye! If I didn't know better I'd say this referee has been bribed!`);
            sentOffPlayers.delete(e.player); // Don't actually send off if bribed
            redCards--; // Don't count if bribed ref prevents it
            updateMatchStatus();
          } else if (e.isCocaineUser && e.player) {
            _appendCom(com, `RED CARD! ${e.player} is sent off for this brutal assault!`);
          } else {
            _appendCom(com, `RED CARD! ${e.player} is sent off!`);
          }
        } else {
          _appendCom(com, "RED CARD! Player sent off!");
        }
      } else if (e.kind === 'CARD'){
        // Determine if yellow or red based on event or random
        if (e.kind === 'RED_CARD' || Math.random() < 0.1) {
          redCards++;
          updateMatchStatus();
          const cardCommentary = generateRedCardCommentary(e);
          _appendCom(com, cardCommentary);
          if (e.player) {
            sentOffPlayers.add(e.player);
            addCardToTopScorers(e.player, e.team, 'red');
          }
        } else {
          yellowCards++;
          updateMatchStatus();
          const cardCommentary = generateYellowCardCommentary(e);
          _appendCom(com, cardCommentary);
          if (e.player) {
            addCardToTopScorers(e.player, e.team, 'yellow');
          }
        }
      } else if (e.kind === 'STRETCHER_INJURY'){
        injuries++;
        updateMatchStatus();
        const stretcherCommentary = generateStretcherInjuryCommentary(e.player, e.causedBy);
        _appendCom(com, stretcherCommentary);
        // Check if opponent manager was bribed - if so, no substitution
        if (S && S.opponent_bribed && e.who === 'AWAY') {
          _appendCom(com, `The opposition manager allows ${e.player} to be taken off on a stretcher without substitution! This is bizarre!`);
          // Reduce opponent strength significantly
          if (S.preMatch) {
            S.preMatch.oppStrength = Math.max(10, (S.preMatch.oppStrength || 50) - 15);
          }
        } else {
          // Normal substitution happens (reduce team strength slightly)
          if (e.who === 'HOME' && S.preMatch) {
            S.preMatch.ourStrength = Math.max(10, (S.preMatch.ourStrength || 50) - 8);
          } else if (e.who === 'AWAY' && S.preMatch) {
            S.preMatch.oppStrength = Math.max(10, (S.preMatch.oppStrength || 50) - 8);
          }
        }
      } else if (e.kind === 'HGH_COMMENTARY'){
        if (e.player) {
          const hghCommentary = generateHGHCommentary(e.player);
          _appendCom(com, hghCommentary);
        }
      } else if (e.kind === 'DODGY_PENALTY'){
        const penaltyCommentary = generateDodgyPenaltyCommentary(e);
        _appendCom(com, penaltyCommentary);
        
        // Add a goal from the penalty (80% conversion rate)
        if (Math.random() < 0.8) {
          const goalEvent = {
            t: e.t + 0.1,
            who: e.who,
            kind: 'GOAL',
            scorer: e.player,
            assister: null,
            team: e.team,
            isFromPenalty: true
          };
          
          addGoalToTopScorers(e.player, e.team);
          const goalCommentary = generateGoalCommentary(goalEvent);
          _appendCom(com, `⚽ ${goalCommentary} (Penalty)`);
          
          if (e.who === 'HOME') {
            homeG++;
          } else {
            awayG++;
          }
          addGoalFlashEffect();
        }
      } else if (e.kind === 'DODGY_RED_CARD'){
        const redCardCommentary = generateDodgyRedCardCommentary(e);
        _appendCom(com, redCardCommentary);
        if (e.player) {
          sentOffPlayers.add(e.player);
          addCardToTopScorers(e.player, e.team, 'red');
        }
      } else if (e.kind === 'EARLY_FINAL_WHISTLE'){
        const earlyWhistleCommentary = generateEarlyFinalWhistleCommentary(e);
        _appendCom(com, earlyWhistleCommentary);
        animationRunning = false;
      } else if (e.kind === 'ATMOSPHERE'){
        _appendCom(com, e.message);
      } else if (e.kind === 'POSSESSION' && e.who === 'HOME'){
        if (e.isDrugDependentWithoutCoke && e.player) {
          const lazyLines = [
            `${e.player} can't be bothered to control the ball properly.`,
            `${e.player} looks completely disinterested as he lazily passes.`,
            `${e.player} can't be bothered to play. He just goes through the motions.`
          ];
          _appendCom(com, pick(lazyLines));
        } else {
          const possessionCommentary = generateSouthamptonPossessionCommentary(e);
          _appendCom(com, possessionCommentary);
        }
      }
    }
    
    // Initialize match status display
    yellowCards = 0;
    redCards = 0;
    injuries = 0;
    updateMatchStatus();
    com.innerHTML = "";
    _appendCom(com, `Kickoff at ${getStadiumName()}: ${getClubName()} vs ${(typeof currentOpponent === 'function') ? (currentOpponent()?.team || 'Opposition') : 'Opposition'}.`);
    requestAnimationFrame(step);

    // Initialize match status display
    yellowCards = 0;
    redCards = 0;
    injuries = 0;
    updateMatchStatus();
    
    // Initialize commentary
    const oppName = (typeof currentOpponent === 'function') ? (currentOpponent()?.team || 'Opposition') : 'Opposition';
    com.innerHTML = "";
    _appendCom(com, `Kickoff at ${getStadiumName()}: ${getClubName()} vs ${oppName}.`);
    
    // Set up skip button to mark as skipped
    const skipBtn = document.getElementById('skipMatchBtn');
    if (skipBtn) {
      skipBtn.dataset.skipped = 'false';
      skipBtn.onclick = () => {
        skipBtn.dataset.skipped = 'true';
        animationRunning = false;
        resolve({ home: homeG, away: awayG });
      };
    }

    // Start animation
    requestAnimationFrame(step);
  });
}

// Tiny helpers
function _spawnTeam(isHome, pitch){
  const arr = [];
  for (let i=0;i<5;i++){
    const x = isHome ? (pitch.w*0.25 + Math.random()*30) : (pitch.w*0.65 + Math.random()*30);
    const y = 20 + i*(pitch.h-40)/4 + (Math.random()*6-3);
    arr.push({x,y});
  }
  return arr;
}
function _drawDots(ctx, team, color){
  ctx.fillStyle = color;
  for (const p of team){
    ctx.fillRect(p.x|0, p.y|0, 3, 3);
  }
}
function _wander(team, pitch){
  for (const p of team){
    p.x += (Math.random()*2-1)*0.4;
    p.y += (Math.random()*2-1)*0.4;
    if (p.x<2) p.x=2; if (p.x>pitch.w-5) p.x=pitch.w-5;
    if (p.y<2) p.y=2; if (p.y>pitch.h-5) p.y=pitch.h-5;
  }
}
function _kickBall(ball, target, speed){
  const dx = target.x - ball.x, dy = target.y - ball.y;
  const d = Math.max(1, Math.hypot(dx,dy));
  ball.vx = (dx/d)*speed; ball.vy = (dy/d)*speed;
}
function _fmt(t){
  const m = Math.floor(t/1)|0;
  const mm = String(Math.floor(m/60)).padStart(2,'0');
  const ss = String(m%60).padStart(2,'0');
  return `${mm}:${ss}`;
}
function _appendCom(el, line){
  if (!el) return;
  const p = document.createElement('div');
  p.textContent = line;
  p.className = 'commentary-line';
  
  // Add event-specific styling based on content
  if (line.includes('⚽') || line.includes('GOAL') || line.includes('goal')) {
    p.className += ' commentary-goal';
  } else if (line.includes('🟨') || line.includes('🟥') || line.includes('YELLOW') || line.includes('RED') || line.includes('card')) {
    p.className += ' commentary-card';
  } else if (line.includes('PENALTY') || line.includes('penalty')) {
    p.className += ' commentary-penalty';
  } else if (line.includes('SHOT') || line.includes('shot')) {
    p.className += ' commentary-shot';
  } else if (line.includes('CORNER') || line.includes('corner')) {
    p.className += ' commentary-corner';
  } else if (line.includes('FOUL') || line.includes('foul')) {
    p.className += ' commentary-foul';
  } else if (line.includes('Full-time') || line.includes('Kickoff')) {
    p.className += ' commentary-important';
  } else if (line.includes('💥') || line.includes('🔥') || line.includes('🚨')) {
    p.className += ' commentary-dramatic';
  }
  
  // Add fade-in animation
  p.style.opacity = '0';
  p.style.transform = 'translateY(10px)';
  p.style.transition = 'all 0.4s ease-out';
  
  el.appendChild(p);
  
  // Trigger animation
  requestAnimationFrame(() => {
    p.style.opacity = '1';
    p.style.transform = 'translateY(0)';
  });
  
  el.scrollTop = el.scrollHeight;
}
// Back-compat alias: some code calls addCom(line). Route to _appendCom with a safe target.
if (typeof window !== 'undefined') {
  window.addCom = function(line){
    try{
      var el = document.getElementById('matchCommentary') || document.getElementById('feed') || document.getElementById('log');
      if (!el) return;
      _appendCom(el, line);
    }catch(e){ console.warn('addCom fallback failed:', e); }
  };
}

function _pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Quick sim fallback if user skips
function _quickResolve(){
  // Calculate realistic strengths
  let our = S?.preMatch?.ourStrength;
  let opp = S?.preMatch?.oppStrength;
  
  // If strengths not calculated, compute them now
  if (!our || !opp) {
    const our5 = getOurSelectedFive();
    const opp5 = getOppSelectedFive();
    our = computeTeamStrength(our5);
    opp = computeOpponentStrength(opp5);
  }
  
  // Calculate realistic expected goals based on strength difference
  const strengthDiff = our - opp;
  const ourXG = Math.max(0.1, 1.0 + (strengthDiff / 100));
  const oppXG = Math.max(0.1, 1.0 - (strengthDiff / 100));
  
  // Use Poisson distribution for realistic goal counts
  const goalsH = poisson(ourXG);
  const goalsA = poisson(oppXG);
  
  return {home: goalsH, away: goalsA};
}

function applyRefereeBiasToPreMatch(){
  if (!S.preMatch || !S.referee_bribed || !S.ref_bribe_side) return;
  const bump = 3; // smaller nudge since we now have active referee bias events
  if (S.ref_bribe_side === 'us') {
    S.preMatch.ourStrength  = Math.max(1, (S.preMatch.ourStrength  || 1) + bump);
  } else if (S.ref_bribe_side === 'them') {
    S.preMatch.oppStrength  = Math.max(1, (S.preMatch.oppStrength  || 1) + bump);
  }
}

// --- helper: safe pick (only create if you don't already have one) ---
if (typeof window.pick !== 'function') {
  window.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
}

// --- helper: append a line to watch-mode commentary (id="matchCommentary") ---
if (typeof window.addMatchComment !== 'function') {
  window.addMatchComment = function addMatchComment(txt){
    // Use the enhanced _appendCom function for consistent styling
    const box = document.getElementById('matchCommentary');
    if (box) {
      _appendCom(box, txt);
    }
  };
}

// --- rotating pools for ref-bribe flavor (no scoring impact) ---
const REF_BRIBE_FOR_US = [
  "Unbelievable! The referee gives {FAV} a penalty for… well, nothing.",
  "Another soft free-kick to {FAV} right on the edge—this is getting absurd.",
  "That's never a red! The referee sends off a {OPP} player and shrugs.",
  "A mysterious offside flag spares {FAV} at the perfect moment.",
  "Wave after wave of fouls for {FAV}—the whistle's becoming a metronome.",
  "The referee appears to have a large bag of money in his pocket. What a wonderful sport!",
  "If I was a more cynical man I might think this referee had been bribed! What a wonderful sport!",
  "The referee's decisions are... interesting. Very interesting indeed.",
  "That's a generous interpretation of the rules in {FAV}'s favor.",
  "The referee seems to be seeing things differently to everyone else in the stadium.",
  "Another questionable decision goes {FAV}'s way. How fortunate!",
  "The referee's whistle seems to have a particular fondness for {FAV} today.",
  "That's a very... creative interpretation of the offside rule.",
  "The referee appears to be wearing rose-tinted glasses when it comes to {FAV}.",
  "Another mysteriously favorable decision for {FAV}. What are the odds?",
  "The referee's performance today has been... let's say, distinctive.",
  "That's a decision that will raise eyebrows in the {OPP} dressing room.",
  "The referee seems to have developed a sudden appreciation for {FAV}'s style of play.",
  "Another soft call goes {FAV}'s way. The pattern continues.",
  "The referee's consistency today is... well, it's consistent in one direction.",
  "That's a very generous reading of the situation by the referee.",
  "The referee appears to be having a very good day for {FAV}.",
  "Another decision that seems to favor {FAV}. What a coincidence!",
  "The referee's interpretation of the rules today is... unique.",
  "That's a call that will have {OPP} fans scratching their heads."
];

const REF_BRIBE_FOR_THEM = [
  "That's harsh—another phantom foul given against {FAV}.",
  "The referee ignores a stonewall {FAV} penalty shout.",
  "A baffling advantage call kills a {FAV} breakaway.",
  "A {FAV} player booked for… existing near the ball?",
  "Every 50/50 is going {OPP}'s way. Curious.",
  "The referee appears to have a large bag of money in his pocket. What a wonderful sport!",
  "If I was a more cynical man I might think this referee had been bribed! What a wonderful sport!",
  "The referee's decisions are... interesting. Very interesting indeed.",
  "That's a harsh interpretation of the rules against {FAV}.",
  "The referee seems to be seeing things differently to everyone else in the stadium.",
  "Another questionable decision goes against {FAV}. How unfortunate!",
  "The referee's whistle seems to have a particular aversion to {FAV} today.",
  "That's a very... strict interpretation of the rules.",
  "The referee appears to be wearing blinkers when it comes to {FAV}.",
  "Another mysteriously unfavorable decision for {FAV}. What are the odds?",
  "The referee's performance today has been... let's say, distinctive.",
  "That's a decision that will raise eyebrows in the {FAV} dressing room.",
  "The referee seems to have developed a sudden distaste for {FAV}'s style of play.",
  "Another harsh call goes against {FAV}. The pattern continues.",
  "The referee's consistency today is... well, it's consistent in one direction.",
  "That's a very strict reading of the situation by the referee.",
  "The referee appears to be having a very bad day for {FAV}.",
  "Another decision that seems to go against {FAV}. What a coincidence!",
  "The referee's interpretation of the rules today is... unique.",
  "That's a call that will have {FAV} fans scratching their heads.",
  "The referee seems to have forgotten that {FAV} are allowed to play football too.",
  "Another mysteriously timed decision that benefits {OPP}.",
  "The referee's performance today is raising more questions than answers.",
  "That's a decision that will be talked about long after the final whistle.",
  "The referee appears to be operating under a different set of rules today."
];

