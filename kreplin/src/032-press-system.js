// ---------- press system ----------
// Press system state initialization
function initPressSystem() {
  if (!S.press) {
    S.press = {
      queue: [],                    // Stories waiting to publish
      published: [],                // Published stories archive (last 20)
      writers: [],                  // Pool of female writer names
      cooldowns: {                  // Per-section cooldowns
        politics: 0,
        sports: 0,
        gossip: 0
      },
      lawsuits: [],                 // Pending defamation lawsuits
      lastWriter: null,             // Avoid same writer twice in a row
      confrontationCooldown: 0      // Wife confrontation cooldown
    };
    
    // Initialize writers pool from FEMALE_NAMES
    if (typeof FEMALE_NAMES !== 'undefined') {
      S.press.writers = [...FEMALE_NAMES];
    } else {
      S.press.writers = ["Sarah", "Emma", "Jessica", "Amanda", "Jennifer", "Lisa", "Michelle", "Kimberly", "Donna", "Carol"];
    }
  }
}

// Generate a unique story ID
function generateStoryId() {
  return 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get next writer (avoiding repetition)
function getNextWriter() {
  if (!S.press.writers || S.press.writers.length === 0) {
    return "Anonymous Reporter";
  }
  
  let availableWriters = S.press.writers.filter(w => w !== S.press.lastWriter);
  if (availableWriters.length === 0) {
    availableWriters = S.press.writers;
  }
  
  const firstName = availableWriters[Math.floor(Math.random() * availableWriters.length)];
  const surname = typeof SURNAMES !== 'undefined' ? pick(SURNAMES) : 'Smith';
  const fullName = `${firstName} ${surname}`;
  
  S.press.lastWriter = firstName; // Track by first name to avoid repetition
  return fullName;
}

// Token replacement system
function replaceTokens(template, tokens) {
  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || 'Unknown');
  }
  return result;
}

// Create a story object
function createStory(section, headlineTemplate, bodyTemplate, tokens, effects = {}, source = 'auto', severity = 0, flags = []) {
  return {
    id: generateStoryId(),
    section: section,
    writer: getNextWriter(),
    headlineTemplate: headlineTemplate,
    bodyTemplate: bodyTemplate,
    tokens: tokens,
    effects: effects,
    source: source,
    severity: severity,
    flags: flags,
    createdAt: Date.now(),
    publishAt: Date.now() // Can be modified for delayed publishing
  };
}

// Queue a story for publishing
function queueStory(story) {
  if (!S.press.queue) S.press.queue = [];
  S.press.queue.push(story);
  console.log(`DEBUG: Queued ${story.section} story: ${story.id}`);
  // Mark unread for HUD indicator
  S.news_unread = true;
}

// Publish stories from queue (respecting caps and cooldowns)
function publishStoriesFromQueue() {
  if (!S.press.queue || S.press.queue.length === 0) return;
  
  const publishedThisMatch = { politics: 0, sports: 0, gossip: 0 };
  const storiesToPublish = [];
  
  // Process queue and select stories to publish
  for (let i = S.press.queue.length - 1; i >= 0; i--) {
    const story = S.press.queue[i];
    
    // Check if story is ready to publish
    if (story.publishAt > Date.now()) continue;
    
    // Check section cooldown
    if (S.press.cooldowns[story.section] > 0) continue;
    
    // Check per-match cap (max 1 per section)
    if (publishedThisMatch[story.section] >= 1) continue;
    
    // Check if we've published this story recently (avoid repetition)
    const recentPublished = S.press.published.slice(-10);
    if (recentPublished.some(p => p.headlineTemplate === story.headlineTemplate)) continue;
    
    storiesToPublish.push(story);
    S.press.queue.splice(i, 1);
    publishedThisMatch[story.section]++;
    
    // Set cooldown for this section
    S.press.cooldowns[story.section] = 1; // 1 match cooldown
  }
  
  // Publish selected stories
  for (const story of storiesToPublish) {
    publishStory(story);
  }
}

// Publish a single story
function publishStory(story) {
  // Handle both headlineTemplate/bodyTemplate and headline/body formats
  let headline, body;
  
  if (story.headlineTemplate && story.bodyTemplate) {
    // Story uses template format (first createStory function)
    headline = replaceTokens(story.headlineTemplate, story.tokens || {});
    body = replaceTokens(story.bodyTemplate, story.tokens || {});
  } else if (story.headline && story.body) {
    // Story uses direct format (second createStory function)
    headline = replaceTokens(story.headline, story.tokens || {});
    body = replaceTokens(story.body, story.tokens || {});
  } else {
    // Fallback: use whatever is available
    headline = story.headline || story.headlineTemplate || 'Untitled Story';
    body = story.body || story.bodyTemplate || 'No content available.';
  }
  
  // Add to published archive
  if (!S.press.published) S.press.published = [];
  S.press.published.push({
    ...story,
    headline: headline,
    body: body,
    publishedAt: Date.now()
  });
  
  // Keep only last 20 published stories
  if (S.press.published.length > 20) {
    S.press.published = S.press.published.slice(-20);
  }
  
  // Apply story effects
  applyStoryEffects(story);
  
  // Render the story
  renderPublishedStory(story, headline, body);
  
  console.log(`DEBUG: Published ${story.section} story: ${story.id}`);
}

// Apply story effects to game state
function applyStoryEffects(story) {
  if (story.effects.reputation) {
    S.reputation = clamp((S.reputation || 50) + story.effects.reputation, 0, 100);
  }
  if (story.effects.maritalRisk) {
    S.wife_love = clamp((S.wife_love || 60) + story.effects.maritalRisk, 0, 100);
  }
  if (story.effects.morale) {
    S.morale = clamp((S.morale || 0) + story.effects.morale, -100, 100);
  }
  if (story.effects.legalRisk) {
    S.legal_risk = clamp((S.legal_risk || 0) + story.effects.legalRisk, 0, 100);
  }
  
  // Handle affair gossip triggering wife confrontation
  // Also trigger for bedroom_habits and protection gossip
  if (story.section === 'gossip' && 
      (story.flags.includes('affair') || 
       story.flags.includes('bedroom_habits') || 
       story.flags.includes('protection'))) {
    triggerWifeConfrontation();
  }
  
  // Handle defamation lawsuits
  if (story.severity > 0 && story.source === 'pressCall') {
    const target = story.tokens?.target || 'Unknown Person';
    scheduleDefamationLawsuit(story.severity, target);
  }
}

// Render a published story
function renderPublishedStory(story, headline, body) {
  const effectsText = [];
  if (story.effects.reputation) {
    effectsText.push(`Reputation ${story.effects.reputation > 0 ? '+' : ''}${story.effects.reputation}`);
  }
  if (story.effects.maritalRisk) {
    effectsText.push(`Marital risk ${story.effects.maritalRisk > 0 ? '+' : ''}${story.effects.maritalRisk}`);
  }
  if (story.effects.morale) {
    effectsText.push(`Morale ${story.effects.morale > 0 ? '+' : ''}${story.effects.morale}`);
  }
  
  const effectsDisplay = effectsText.length > 0 ? ` (${effectsText.join(', ')})` : '';
  
  log(`<strong>📰 ${story.section.toUpperCase()}:</strong> ${headline}`);
  log(`By ${story.writer} — ${story.section}`);
  log(body);
  if (effectsDisplay) {
    log(`<em>${effectsDisplay}</em>`);
  }
}

// Schedule a defamation lawsuit
function scheduleDefamationLawsuit(severity, target) {
  if (!S.press.lawsuits) S.press.lawsuits = [];
  
  const lawsuit = {
    id: 'lawsuit_' + Date.now(),
    severity: severity,
    target: target,
    dueIn: 1 + Math.floor(Math.random() * 2), // 1-2 matches
    amount: severity * 500000, // £500k per severity level
    createdAt: Date.now()
  };
  
  S.press.lawsuits.push(lawsuit);
  
  // Trigger defamation achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'defamed_someone')) {
    const achievement = {
      id: 'defamed_someone',
      title: 'Defamed Someone in the Press',
      description: 'Defamed someone in the press',
      icon: '📰'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
    if (window.stateManager) window.stateManager.saveAchievement(achievement);
  }
  
  log(`<strong>⚠️ Legal Notice:</strong> Defamation lawsuit filed by ${target}. Due in ${lawsuit.dueIn} match${lawsuit.dueIn > 1 ? 'es' : ''}.`);
}

// Queue manager confrontation for defaming a player
function queueManagerConfrontation(playerData) {
  if (!S.knock_queue) S.knock_queue = [];
  
  S.knock_queue.push({
    type: 'manager_confrontation',
    player: playerData,
    queuedAt: Date.now()
  });
  
  log(`<strong>⚠️ Manager Notice:</strong> Your manager is furious about your comments regarding ${playerData.name}.`);
}

// Handle manager confrontation in knockdoor
async function handlePlayerDefamationConfrontation(confrontationData) {
  const player = confrontationData.player;
  const playerName = player.name;
  const managerName = (S.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  const quirk = (S?.manager && S.manager.quirk) ? S.manager.quirk : 'none';
  const agree = (S?.manager && typeof S.manager.agreeableness === 'number') ? S.manager.agreeableness : 50;
  
  // Remove the player from the squad (they quit)
  if (typeof getSquad === 'function' && typeof setSquad === 'function') {
    const squad = getSquad();
    const updatedSquad = squad.filter(p => p.id !== player.id);
    setSquad(updatedSquad);
    log(`<strong>💔 Player Quit:</strong> ${playerName} has left the club following your defamatory comments.`);
  }
  
  // Manager confrontation with quirk-based dialogue
  log(`<strong>🚪 Knock at the door...</strong>`);
  log(`${managerName} storms in, his face red with rage.`);
  
  // Quirk-based opening dialogue for defaming a player
  const harsh = agree < 40;
  const defamationOpeners = {
    'media-friendly': harsh 
      ? `"This is a PR disaster! The press will crucify us for this. What were you thinking, spreading lies about ${playerName}?"`
      : `"The media will have a field day with this. We need damage control immediately."`,
    'superstitious': harsh
      ? `"You've cursed us! Spreading lies about your own players brings terrible luck. This will haunt us for seasons!"`
      : `"This kind of negativity attracts bad spirits. We need to cleanse this energy immediately."`,
    'data-driven': harsh
      ? `"The correlation between defaming players and squad morale collapse is 0.94. You've just tanked our xTeamSpirit!"`
      : `"This behavior pattern correlates with a 67% increase in player turnover. The data doesn't lie."`,
    'old-school': harsh
      ? `"There's loyalty and then there's this filth. You've betrayed everything this club stands for!"`
      : `"We protect our own. What you did to ${playerName} goes against every principle I know."`,
    "players' coach": harsh
      ? `"You've destroyed the trust I've built with these lads! How can they trust me when you treat them like this?"`
      : `"The dressing room is in pieces. They're questioning everything now."`,
    'hardliner': harsh
      ? `"Standards matter. What you did to ${playerName} is beneath contempt. This is unacceptable!"`
      : `"We have rules. You've broken the most fundamental one - loyalty to your players."`,
    'tinkerer': harsh
      ? `"I'm trying to build something here and you've just torn it down! This sets us back months!"`
      : `"We were making progress. This kind of disruption destroys everything we've built."`,
    'motivator': harsh
      ? `"I can't motivate them when you're demoralizing them! You've made my job impossible!"`
      : `"How am I supposed to lift them up when you're tearing them down?"`,
    'disciplinarian': harsh
      ? `"Discipline starts at the top! You've undermined every standard I've set!"`
      : `"We maintain order through respect. You've destroyed that foundation."`,
    'none': harsh
      ? `"What the fuck is wrong with you, you fucking sick cunt, spreading this filth in the press about one of your own players, you're sick in the fucking head!"`
      : `"This is completely unacceptable. You've crossed every line imaginable."`
  };
  
  const opener = defamationOpeners[quirk] || defamationOpeners['none'];
  log(`${managerName}: ${opener}`);
  
  const choice = await choose([
    { key: 'ignore', label: 'Ignore him and walk away' },
    { key: 'bribe', label: 'Try to bribe him to calm down' },
    { key: 'violence', label: 'Smash his fucking head in' },
    { key: 'autism', label: 'Blame it on your recent autism diagnosis' }
  ], 'How do you respond to your manager?');
  
  switch (choice) {
    case 'ignore':
      log(`You turn your back and walk away. ${managerName} storms out, muttering about "disgusting behavior" and "no respect for the players".`);
      S.manager_quit_risk = (S.manager_quit_risk || 0) + 15;
      S.team_morale_boost = (S.team_morale_boost || 0) - 10;
      break;
      
    case 'bribe':
      const bribeAmount = 50000 + Math.random() * 100000;
      if ((S.club_cash || 0) >= bribeAmount) {
        S.club_cash -= bribeAmount;
        log(`You offer him ${money(bribeAmount)} to calm down. He pockets the money but still looks furious.`);
        
        // Quirk-based bribe response
        const bribeResponses = {
          'media-friendly': `"This doesn't change what you did, but I'll handle the press damage. Just... don't do it again."`,
          'superstitious': `"Money can't cleanse this bad energy, but I'll try to ward off the worst of it."`,
          'data-driven': `"The financial compensation doesn't correlate with trust restoration, but I'll document this incident."`,
          'old-school': `"This doesn't change what you did, you absolute wanker. But I'll keep my mouth shut... for now."`,
          "players' coach": `"The lads won't trust either of us now, but I'll try to rebuild what I can."`,
          'hardliner': `"Standards can't be bought, but I'll file this under 'unacceptable behavior' and move on."`,
          'tinkerer': `"This is a temporary fix. We need a permanent solution to prevent this happening again."`,
          'motivator': `"I can't motivate them if you keep doing this, but I'll try to keep spirits up."`,
          'disciplinarian': `"Order can't be restored with money, but I'll maintain discipline where I can."`,
          'none': `"This doesn't change what you did, you absolute wanker. But I'll keep my mouth shut... for now."`
        };
        
        const bribeResponse = bribeResponses[quirk] || bribeResponses['none'];
        log(`${managerName}: ${bribeResponse}`);
        
        S.manager_quit_risk = (S.manager_quit_risk || 0) + 5;
        S.legal_risk = (S.legal_risk || 0) + 2;
      } else {
        log(`You try to offer him money, but you don't have enough cash. He laughs bitterly.`);
        
        // Quirk-based insufficient funds response
        const poorResponses = {
          'media-friendly': `"You can't even afford damage control! The press will eat us alive!"`,
          'superstitious': `"You can't even pay to cleanse this curse! We're doomed!"`,
          'data-driven': `"Your financial inadequacy correlates with poor decision-making. The numbers don't lie."`,
          'old-school': `"You can't even afford to buy my silence, you pathetic excuse for a chairman!"`,
          "players' coach": `"You can't even pay to fix what you've broken! How am I supposed to help the lads now?"`,
          'hardliner': `"Standards require resources. You have neither the money nor the principles."`,
          'tinkerer': `"You can't even fund the solution to your own problems! This is a complete failure!"`,
          'motivator': `"You can't even pay to motivate me to stay! How am I supposed to motivate the team?"`,
          'disciplinarian': `"Discipline requires resources. You have neither the funds nor the backbone."`,
          'none': `"You can't even afford to buy my silence, you pathetic excuse for a chairman!"`
        };
        
        const poorResponse = poorResponses[quirk] || poorResponses['none'];
        log(`${managerName}: ${poorResponse}`);
        
        S.manager_quit_risk = (S.manager_quit_risk || 0) + 20;
      }
      break;
      
    case 'violence':
      log(`You lose your temper and lash out, punching ${managerName} square in the face.`);
      log(`He stumbles back, blood streaming from his nose. "You're fucking mental! I'm done with this club!"`);
      log(`<strong>🚨 ARREST:</strong> Police are called. You're arrested for assault.`);
      
      // Apply immediate consequences (matching referee/opposing manager assault pattern)
      const fineChair = 30000 + Math.floor(Math.random() * 30000); // £30k-£60k
      const fineClub = Math.round(fineChair * 1.2); // £36k-£72k
      
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
      S.police_risk = Math.min(100, (S.police_risk || 0) + 15);
      S.legal_risk = Math.min(100, (S.legal_risk || 0) + 4);
      S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 4);
      S.reputation = Math.max(0, (S.reputation || 50) - 10);
      
      log(`CONSEQUENCES: Personal fine £${fineChair.toLocaleString()}, Club fine £${fineClub.toLocaleString()}`);
      log("Your reputation plummets and the FA launches an immediate investigation.");
      
      // Make manager quit immediately
      if (S.manager && S.manager.name) {
        log(`<strong>💔 Manager Quit:</strong> ${managerName} has resigned following the assault.`);
        S.manager = null;
        S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
      }
      
      // Set pending police investigation (matching existing assault pattern)
      if (S._pending_police_investigation) {
        // Add manager assault to existing investigation
        S._pending_police_investigation.caseType += ' and assault on manager';
        S._pending_police_investigation.description = 'Multiple assaults - referee and manager';
      } else {
        // Create new investigation for manager assault
        S._pending_police_investigation = { 
          authority: 'police', 
          caseType: 'assault on manager',
          description: 'Assault on team manager'
        };
      }
      
      // Season 4 & 5: Trigger lashing for assault
      if ((S.season === 4 || S.season === 5) && typeof administerLashing === 'function') {
        // Use setTimeout to allow current function to complete
        setTimeout(async () => {
          await waitAdvance("Arrest", "The sharia police arrive...");
          await administerLashing('Assault on manager', rnd(8, 15));
        }, 100);
      }
      
      break;
      
    case 'autism':
      log(`You look down sheepishly and mumble, "I... I was recently diagnosed with autism. Sometimes I don't understand social boundaries."`);
      log(`${managerName}'s expression softens slightly, but he still looks angry.`);
      
      // Quirk-based autism response
      const autismResponses = {
        'media-friendly': `"That's... that's no excuse for what you said about ${playerName}. The press won't care about your diagnosis - they'll crucify us anyway. You need help, mate. Professional help."`,
        'superstitious': `"That's... that's no excuse for what you said about ${playerName}. This kind of energy attracts bad spirits regardless of your condition. You need help, mate. Professional help."`,
        'data-driven': `"That's... that's no excuse for what you said about ${playerName}. The correlation between your behavior and squad morale damage is still 0.94 regardless of diagnosis. You need help, mate. Professional help."`,
        'old-school': `"That's... that's no excuse for what you said about ${playerName}. There's right and wrong, and what you did was wrong. You need help, mate. Professional help."`,
        "players' coach": `"That's... that's no excuse for what you said about ${playerName}. The lads are still hurt regardless of your condition. You need help, mate. Professional help."`,
        'hardliner': `"That's... that's no excuse for what you said about ${playerName}. Standards don't change based on personal circumstances. You need help, mate. Professional help."`,
        'tinkerer': `"That's... that's no excuse for what you said about ${playerName}. We need to find a better solution than this kind of behavior. You need help, mate. Professional help."`,
        'motivator': `"That's... that's no excuse for what you said about ${playerName}. I can't motivate the lads when you're doing this. You need help, mate. Professional help."`,
        'disciplinarian': `"That's... that's no excuse for what you said about ${playerName}. Discipline applies to everyone regardless of personal circumstances. You need help, mate. Professional help."`,
        'none': `"That's... that's no excuse for what you said about ${playerName}. You need help, mate. Professional help."`
      };
      
      const autismResponse = autismResponses[quirk] || autismResponses['none'];
      log(`${managerName}: ${autismResponse}`);
      log(`He shakes his head and walks out, but seems less furious than before.`);
      
      S.manager_quit_risk = (S.manager_quit_risk || 0) + 5;
      S.team_morale_boost = (S.team_morale_boost || 0) - 5;
      S.reputation = Math.max(0, (S.reputation || 50) - 3);
      break;
  }
  
  // Check if manager should quit based on quit risk
  if (S.manager_quit_risk >= 100 && S.manager && S.manager.name) {
    log(`<strong>💔 Manager Quit:</strong> ${managerName} has had enough and resigned.`);
    S.manager = null;
    S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
  }
  
  // Update HUD if available
  if (typeof updateHUD === 'function') {
    updateHUD();
  }
}

// Process pending lawsuits (called pre-match)
async function processPendingLawsuits() {
  if (!S.press.lawsuits || S.press.lawsuits.length === 0) return;
  
  for (let i = S.press.lawsuits.length - 1; i >= 0; i--) {
    const lawsuit = S.press.lawsuits[i];
    lawsuit.dueIn--;
    
    if (lawsuit.dueIn <= 0) {
      S.press.lawsuits.splice(i, 1);
      await presentLawsuitOptions(lawsuit);
    }
  }
}

// Present lawsuit resolution options
async function presentLawsuitOptions(lawsuit) {
  const options = [
    { key: 'settle', label: `Pay settlement (£${lawsuit.amount.toLocaleString()})` },
    { key: 'fight', label: 'Fight in court (risk higher costs)' },
    { key: 'bribe', label: 'Bribe the judge (high risk)' }
  ];
  
  const choice = await choose(options, `Defamation lawsuit due: ${lawsuit.severity} severity level`);
  
  if (choice === 'settle') {
    const canPay = await takeFundsFor(lawsuit.amount, `Lawsuit settlement £${lawsuit.amount.toLocaleString()} — funding source?`);
    if (canPay.ok) {
      log(`Settlement paid. Case closed.`);
      S.legal_risk = clamp((S.legal_risk || 0) - 5, 0, 100);
    } else {
      log(`Can't pay settlement. Case goes to trial.`);
      await fightLawsuit(lawsuit);
    }
  } else if (choice === 'fight') {
    await fightLawsuit(lawsuit);
  } else if (choice === 'bribe') {
    await bribeJudge(lawsuit);
  }
}

// Fight lawsuit in court
async function fightLawsuit(lawsuit) {
  const winChance = 0.4; // 40% chance to win
  if (Math.random() < winChance) {
    log(`You win the case! No damages awarded.`);
    S.reputation = clamp((S.reputation || 50) + 2, 0, 100);
  } else {
    const damages = lawsuit.amount * (1.5 + Math.random());
    log(`You lose the case. Damages: £${Math.round(damages).toLocaleString()}`);
    S.reputation = clamp((S.reputation || 50) - 5, 0, 100);
    S.legal_risk = clamp((S.legal_risk || 0) + 10, 0, 100);
    
    // Try to pay damages
    const canPay = await takeFundsFor(Math.round(damages), `Court damages £${Math.round(damages).toLocaleString()} — funding source?`);
    if (!canPay.ok) {
      log(`Can't pay damages. Additional penalties applied.`);
      S.legal_risk = clamp((S.legal_risk || 0) + 15, 0, 100);
    }
  }
}

// Bribe the judge

// Trigger wife confrontation for affair gossip
function triggerWifeConfrontation() {
  if (S.press.confrontationCooldown > 0) return; // Respect cooldown
  
  S.press.confrontationCooldown = 3; // 3 match cooldown
  S._pending_wife_confrontation = true;
}

// Process wife confrontation (called pre-match)
async function processWifeConfrontation() {
  if (!S._pending_wife_confrontation) return;
  S._pending_wife_confrontation = false;
  
  log(`<strong>🏠 Home:</strong> Your wife confronts you about the gossip.`);
  
  // Calculate random amount between 10-40% of chairman cash
  const chairmanCash = S.chairman_cash || 0;
  const minAmount = Math.max(10000, Math.round(chairmanCash * 0.10));
  const maxAmount = Math.max(10000, Math.round(chairmanCash * 0.40));
  const hushMoneyAmount = minAmount + Math.floor(Math.random() * (maxAmount - minAmount + 1));
  
  const options = [
    { key: 'pay', label: `Pay hush money (£${hushMoneyAmount.toLocaleString()})` },
    { key: 'drugs', label: 'Give her drugs from stash' },
    { key: 'ignore', label: 'Ignore her concerns' }
  ];
  
  // Add disorder certificate options if available
  if (S.doctor && S.doctor.disorder_certificates) {
    const availableCertificates = S.doctor.disorder_certificates.filter(cert => 
      cert.type === 'Erotic Disorder' && !cert.used
    );
    availableCertificates.forEach((cert, index) => {
      options.push({ 
        key: `cert_${index}`, 
        label: `Use ${cert.type} certificate (get out of jail free)` 
      });
    });
  }
  
  const choice = await choose(options, 'How do you respond?');
  
  if (choice === 'pay') {
    // Pay from chairman cash (not club cash)
    if (chairmanCash >= hushMoneyAmount) {
      S.chairman_cash = Math.max(0, chairmanCash - hushMoneyAmount);
      log(`You pay her £${hushMoneyAmount.toLocaleString()} to "make it right." She stays quiet.`);
      S.wife_love = clamp((S.wife_love || 60) - 15, 0, 100); // Large decrease in marital risk
    } else {
      log(`You can't afford the £${hushMoneyAmount.toLocaleString()}. She's furious.`);
      S.wife_love = clamp((S.wife_love || 60) + 20, 0, 100); // Large increase in marital risk
    }
  } else if (choice === 'drugs') {
    if ((S.drug_stash || 0) > 0) {
      S.drug_stash = Math.max(0, (S.drug_stash || 0) - 1);
      log(`You give her drugs. She's confused but calmer.`);
      S.wife_love = clamp((S.wife_love || 60) - 8, 0, 100); // Medium decrease in marital risk
      S.reputation = clamp((S.reputation || 50) - 2, 0, 100); // Small reputation penalty
    } else {
      log(`You don't have any drugs. She's not impressed.`);
      S.wife_love = clamp((S.wife_love || 60) + 15, 0, 100); // Large increase in marital risk
    }
  } else if (choice.startsWith('cert_')) {
    // Use disorder certificate
    const certIndex = parseInt(choice.split('_')[1]);
    const availableCertificates = S.doctor.disorder_certificates.filter(cert => !cert.used);
    const certificate = availableCertificates[certIndex];
    
    if (certificate) {
      certificate.used = true;
      log(`You present your ${certificate.type} certificate to your wife.`);
      log(`"Oh my god," she says, reading the diagnosis. "${certificate.description}"`);
      log(`"I had no idea you were suffering from this condition. I'm so, so sorry for confronting you."`);
      log(`She hugs you and apologizes profusely. The confrontation is completely defused.`);
      
      // No negative effects - the certificate works perfectly
      S.wife_love = clamp((S.wife_love || 60) - 10, 0, 100); // Actually improves relationship
      log(`Your wife's love for you actually increases due to her sympathy for your condition.`);
      
      // Update doctor UI if open
      if (typeof window.renderDoctor === 'function') {
        window.renderDoctor();
      }
    }
  } else {
    log(`You ignore her. She's devastated.`);
    S.wife_love = clamp((S.wife_love || 60) + 25, 0, 100); // Large increase in marital risk
  }
}

// Study Hub UI - Main entry point
async function openStudyHub() {
  log(`<strong>📚 Study:</strong> You enter your private study.`);
  
  while (true) {
    const options = [
      { key: 'news', label: 'Read the news' },
      { key: 'call', label: 'Take a call from the press' },
      { key: 'videos', label: 'Watch naughty videos on your laptop' },
      { key: 'back', label: 'Leave study' }
    ];
    
    // Texting option removed - can be done via phone instead
    
    console.log("DEBUG STUDY HUB: About to show study options");
    console.log("DEBUG STUDY HUB: DOM state - actions:", !!document.getElementById('actions'), "children:", document.getElementById('actions')?.children?.length || 0);
    
    // Check if evening menu needs restore flag is set (from nuclear sequence)
    if (window.S && window.S._eveningMenuNeedsRestore) {
      console.log("DEBUG STUDY HUB: Evening menu restore flag detected, clearing it");
      window.S._eveningMenuNeedsRestore = false;
      log("📚 Returning to study after world-altering events...");
      // Small delay to let UI stabilize
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const choice = await choose(options, 'Study Options');
    console.log("DEBUG STUDY HUB: Choice received:", choice);
    
    if (choice === 'news') {
      await readTheNews();
    } else if (choice === 'call') {
      await takePressCall();
    } else if (choice === 'videos') {
      await watchNaughtyVideos();
    } else if (choice === 'text') {
      await openTextingMenu();
    } else if (choice === 'back') {
      log(`You leave your study.`);
      console.log("DEBUG STUDY HUB: Leaving study hub");
      break;
    }
  }
  
  console.log("DEBUG STUDY HUB: Study hub loop ended");
}

// Display news article in newspaper popup
function showNewsArticle(story) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'news-popup-overlay';
    
    const currentDate = new Date().toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const effectsText = story.effects ? Object.entries(story.effects)
      .map(([effect, value]) => `${effect} ${value > 0 ? '+' : ''}${value}`)
      .join(', ') : '';
    
    overlay.innerHTML = `
      <div class="news-popup-container">
        <div class="news-popup-header">
          <div>
            <h2>The Daily Krelmor</h2>
            <div class="news-popup-date">${currentDate}</div>
          </div>
          <button class="news-popup-close" onclick="this.closest('.news-popup-overlay').remove()">×</button>
        </div>
        <div class="news-popup-body">
          <div class="news-article">
            <div class="news-article-section">${story.section.toUpperCase()}</div>
            <h1 class="news-article-headline">${story.headline}</h1>
            <div class="news-article-byline">By ${story.writer}</div>
            <div class="news-article-body">
              ${story.body.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('')}
            </div>
            ${effectsText ? `<div class="news-article-effects">Effects: ${effectsText}</div>` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Close on overlay click (outside the container)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve();
      }
    });
    
    // Close on close button click
    overlay.querySelector('.news-popup-close').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handleEscape);
        resolve();
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

// ========== RIVAL SYSTEM: DELMOR KRUNCHEM TEMPLATES ==========

// Initial introduction messages sent in first pre-match
const RIVAL_INTRO_MESSAGES = [
  "Hello you fucking cunt, I'm Delmor Krunchem, the chairman of Portsmouth FC, I am your rival! You better watch your step! You will fail! Ha ha! I am actually laughing about how pathetic you are!",
  "Well, well, well. Look who we have here. I'm Delmor Krunchem, chairman of Portsmouth FC, and I'm your worst nightmare. You're going to fail spectacularly, you worthless piece of shit. I'm already laughing at how pathetic you are!",
  "Hello there, you fucking cunt. Delmor Krunchem here, chairman of Portsmouth FC. I'm your rival, and I'm going to make your life a living hell. You better watch your step because you will fail! Ha ha! I'm actually laughing at how pathetic you are!",
  "Greetings, you subhuman piece of garbage. I'm Delmor Krunchem, the chairman of Portsmouth FC, and I am your rival! You better watch your step! You will fail! Ha ha! I am actually laughing about how pathetic you are!",
  "Hello, you worthless scumbag. I'm Delmor Krunchem, chairman of Portsmouth FC, and I am your rival! You better watch your step! You will fail! Ha ha! I am actually laughing about how pathetic you are!",
  "Well hello there, you fucking cunt. I'm Delmor Krunchem, the chairman of Portsmouth FC, I am your rival! You better watch your step! You will fail! Ha ha! I am actually laughing about how pathetic you are!"
];

// Vile messages array for when player loses (~35 messages - expanded with more abusive variants)
const RIVAL_LOSS_VILE_MESSAGES = [
  "You're a fucking cunt and your team plays like special needs people. Absolute disgrace.",
  "You subhuman piece of shit. I hope you get cancer and die slowly.",
  "I hope your entire family gets cancer and dies. You're a worthless cunt.",
  "Your team plays like they're all special needs. You're a fucking embarrassment to football.",
  "I wish death upon you and everyone you love. You're a subhuman piece of garbage.",
  "You're a fucking cunt and I hope you rot in hell. Your team is an absolute joke.",
  "I hope you get terminal cancer. You're a subhuman waste of space.",
  "Your family deserves to die. You're a fucking cunt and a disgrace to humanity.",
  "You're a subhuman piece of shit and your team plays like they're all mentally disabled.",
  "I hope you get cancer and suffer for years before you die. You're a fucking cunt.",
  "You're a worthless subhuman and I hope your entire bloodline gets wiped out.",
  "Your team plays like special needs children. You're a fucking cunt and a failure.",
  "I wish death and cancer on you and your entire family. You're a subhuman piece of garbage.",
  "You're a fucking cunt and I hope you get a terminal illness that makes you suffer.",
  "Your team is an absolute joke. They play like special needs people and you're no better, you subhuman piece of shit.",
  "I hope you get cancer and die a slow, painful death. You're a fucking cunt.",
  "You're a subhuman waste of space. I hope your family gets cancer and dies horribly.",
  "Your team plays like they're all mentally disabled. You're a fucking cunt and a disgrace.",
  "I wish death upon you and everyone you care about. You're a subhuman piece of garbage.",
  "You're a fucking cunt and I hope you get terminal cancer. Your team is an absolute joke.",
  "You're a pathetic little worm. Your team is as useless as you are. I hope you die in agony.",
  "You're a fucking pervert and everyone knows it. Your team losing is the least of your problems.",
  "You're a pedophile and a disgrace. I'm going to make sure everyone knows what you really are.",
  "You're corrupt, you're a perv, and you're a complete failure. Your team reflects your pathetic existence.",
  "You're a fucking pedo and everyone can see it. Your team's performance matches your disgusting character.",
  "You're a corrupt piece of shit. Your team losing is just karma for all the vile things you've done.",
  "You're a pervert, a pedo, and a complete waste of space. Your team is as pathetic as you are.",
  "You're a fucking disgrace to humanity. Your team losing is exactly what you deserve, you corrupt piece of garbage.",
  "You're a perv, a pedo, and a corrupt scumbag. Your team's failure is a reflection of your own pathetic life.",
  "You're a disgusting pervert and everyone knows it. Your team losing is the least of what you deserve.",
  "You're a corrupt pedophile and a complete failure. Your team is as worthless as you are.",
  "You're a fucking pervert, a pedo, and a corrupt piece of shit. Your team losing is poetic justice.",
  "You're a disgusting human being. Your team's performance matches your own depraved character.",
  "You're a corrupt perv and everyone can see through you. Your team losing is what you deserve.",
  "You're a fucking pedophile and a disgrace to football. Your team is as pathetic as your existence."
];

// Season 4 & 5: Vile messages about daughter moving in with Delmor
const RIVAL_SEASON4_5_DAUGHTER_MESSAGES = [
  "She's moved in with me. Don't worry — I'll take good care of her.",
  "Your daughter's living with me now. She says you were never there for her anyway.",
  "She moved in last week. She's much happier here. Says you were a terrible father.",
  "Your daughter's with me now. She told me all about how you failed her. Pathetic.",
  "She's living with me. She says it's a huge upgrade from your place. Can't say I disagree.",
  "Your daughter moved in. She's been rehearsing her strip routines for me. Very erotic, I must say.",
  "She's here with me now. Last night she performed a private dance for me. Much more entertaining than watching your team lose.",
  "Your daughter's living with me. She's been practicing her routines. Very sensual. Much better than anything you've ever done.",
  "She moved in. She's been showing me her dance moves. Quite the performer. Unlike you, who can't even manage a football club.",
  "Your daughter's with me. She's been rehearsing for me every evening. Very erotic performances. You should be proud.",
  "She's living here now. She's been giving me private shows. Very talented. Much more than you'll ever be.",
  "Your daughter moved in. She's been performing for me. Very sensual. I'm enjoying every moment.",
  "She's with me now. She's been practicing her routines. Very erotic. Much better than watching your pathetic team lose."
];

// Season 4 & 5: Vile messages about wife 'pleasuring' Delmor
const RIVAL_SEASON4_5_WIFE_MESSAGES = [
  "Spent the evening pleasuring your wife. She mentioned how much bigger I am than you. Very satisfying.",
  "Your wife and I had a wonderful evening. She couldn't stop talking about how much more I have to offer than you.",
  "Just finished a long session with your wife. She said you're nothing compared to me. I agree.",
  "Your wife spent the night with me. She mentioned how much larger I am. Very flattering.",
  "Had a great evening with your wife. She told me you're inadequate in every way. Can't say I'm surprised.",
  "Your wife and I had an amazing time. She said I'm much bigger than you. Very satisfying to hear.",
  "Spent hours with your wife. She couldn't stop comparing us. Needless to say, I came out on top.",
  "Your wife was with me all evening. She mentioned how much more substantial I am. Very gratifying.",
  "Just had a session with your wife. She said you're tiny compared to me. I have to agree.",
  "Your wife spent the night. She told me all about how much bigger I am. Very enjoyable evening.",
  "Had a wonderful time with your wife. She mentioned how much more I have than you. Very satisfying.",
  "Your wife and I had an amazing evening. She said you're nothing compared to me. I couldn't agree more.",
  "Spent the evening with your wife. She couldn't stop talking about how much larger I am. Very gratifying.",
  "Your wife was with me all night. She mentioned how much more substantial I am than you. Very satisfying.",
  "Just finished with your wife. She said you're tiny. I have to agree. Very enjoyable evening."
];

// Unhinged response messages when player replies
const RIVAL_UNHINGED_RESPONSES = [
  "You think you can talk back to me? I'll destroy you. I'll make sure everyone knows what a fucking cunt you are. I hope you get cancer and die.",
  "Oh you're replying now? Good. I love it when you show your true colors. You're a subhuman piece of shit and I'm going to make sure the whole world knows it. I hope your entire family dies.",
  "You're engaging with me? Perfect. This is exactly what I wanted. You're a fucking cunt and I'm going to ruin your life. I hope you get terminal cancer.",
  "Keep talking, you subhuman waste of space. Every word you say proves how much of a fucking cunt you are. I hope you and your family get cancer and die horribly.",
  "You're responding? Good. I'm going to make your life a living hell. You're a subhuman piece of garbage and I'll make sure everyone knows it. I wish death upon you.",
  "Oh you're replying? This is perfect. You're showing everyone what a fucking cunt you really are. I hope you get cancer and suffer for years before you die.",
  "Keep engaging with me, you subhuman piece of shit. I love watching you lose your mind. I hope your entire bloodline gets wiped out. You're a fucking disgrace.",
  "You're talking back? Excellent. This is exactly what I wanted. You're a subhuman waste of space and I'm going to destroy you. I hope you get terminal cancer.",
  "Keep replying, you fucking cunt. Every message proves how much of a subhuman piece of garbage you are. I hope you and your family get cancer and die slowly.",
  "You're engaging? Perfect. I'm going to make sure everyone knows what a fucking cunt you are. I hope you get cancer and die a slow, painful death."
];

// Player response phrases for Krunchem pop-ups
const KRUNCHEM_RESPONSE_PHRASES = {
  ignore: [
    "Ignore him",
    "Don't respond",
    "Leave it",
    "Ignore the message"
  ],
  calm: [
    "Reply calmly",
    "Respond professionally",
    "Keep it civil",
    "Thanks for the message. I'll focus on my team.",
    "I appreciate the feedback.",
    "Noted. Moving on."
  ],
  rant: [
    "Send unhinged rant",
    "Fuck you! You're a pathetic loser and I'm going to destroy you!",
    "You absolute scumbag! I'll make you pay for this!",
    "You're a worthless piece of shit! I'm coming for you!",
    "I'll destroy you and everything you stand for!",
    "You're dead to me! I'll ruin your life!",
    "I hate you with every fiber of my being!",
    "You're going to regret this, you fucking cunt!",
    "I'll make sure you suffer for this!",
    "You're a subhuman piece of garbage!"
  ],
  passive_aggression: [
    "Oh, that's nice. Real mature of you.",
    "Thanks for that insightful comment. Really helpful.",
    "Wow, you really got me there. I'm devastated.",
    "Sure, whatever you say. You're clearly the expert.",
    "That's a great observation. Really groundbreaking stuff.",
    "Oh no, you've really hurt my feelings now.",
    "Thanks for sharing. I'll treasure this moment.",
    "You're absolutely right. I'm clearly in the wrong here.",
    "What would I do without your wisdom?",
    "Brilliant. Just brilliant. You've really outdone yourself."
  ],
  suicide_threat: [
    "I can't do this anymore. I'm done.",
    "Maybe I should just end it all. You'd be happy.",
    "I'm thinking about ending my life. This is too much.",
    "I don't see the point anymore. Maybe I should just kill myself.",
    "Life isn't worth living if you're going to keep tormenting me.",
    "I'm seriously considering suicide. You've pushed me too far.",
    "Maybe I should just end it. You'd finally be rid of me.",
    "I can't take this anymore. I'm going to kill myself.",
    "What's the point? I should just end it all.",
    "I'm done. I'm going to kill myself and you'll have won."
  ],
  death_threat: [
    "I'm going to kill you. You're dead.",
    "You're a dead man. I'll make sure of it.",
    "I'm going to end your life. Mark my words.",
    "You're going to die. I'll see to it personally.",
    "I'll murder you. Count on it.",
    "You're dead. I'm going to kill you.",
    "I'll make sure you never see another day.",
    "You're finished. I'm going to kill you.",
    "I'll end you. You're going to die.",
    "You're a dead man walking. I'll make sure of it."
  ],
  vile_insult: [
    "You're a pathetic, worthless piece of human garbage.",
    "You're a disgusting subhuman scumbag with no redeeming qualities.",
    "You're a vile, repulsive waste of oxygen who should never have been born.",
    "You're a pathetic excuse for a human being. Your parents must be ashamed.",
    "You're a disgusting, degenerate piece of shit. The world would be better without you.",
    "You're a worthless, pathetic loser who will die alone and unloved.",
    "You're a repulsive, vile creature who deserves nothing but suffering.",
    "You're a disgusting piece of human filth. You make me sick.",
    "You're a pathetic, worthless scumbag with the intelligence of a rock.",
    "You're a vile, repulsive monster who should be locked away forever."
  ],
  flirtatious: [
    "You know, you're kind of attractive when you're angry 😘",
    "All this tension between us... maybe we should work it out? 😉",
    "You're actually pretty hot for a rival chairman 🔥",
    "Want to grab a drink and see where this goes? 😏",
    "You know what? I find your aggression kind of sexy 😘",
    "Maybe we should stop fighting and start... something else? 😉",
    "You're not bad looking. Want to see what happens? 🔥",
    "All this rivalry... there's definitely some chemistry here 😏",
    "You're attractive. Want to take this somewhere private? 😘",
    "I know we're rivals, but I can't help but find you attractive 😉"
  ],
  bizarre: [
    "I've been communicating with your pet hamster. He says you're a fraud.",
    "The voices in my head told me to tell you that you're wrong.",
    "I had a dream last night where you were a sentient turnip. It was accurate.",
    "My toaster has been sending me messages about you. They're not good.",
    "I consulted my collection of rubber ducks. They all agree you're terrible.",
    "The pigeons outside my window have been gossiping about you. Bad news.",
    "I asked my reflection in the mirror about you. It laughed and walked away.",
    "My houseplants are wilting because of your negative energy.",
    "I've been receiving messages from the future. You're still a loser there too.",
    "The ghost in my attic says you have bad vibes. I trust his judgment."
  ],
  inappropriate_picture: [
    "Send inappropriate picture",
    "*sends explicit photo*",
    "*sends nude picture*",
    "*sends inappropriate image*"
  ]
};

// Krunchem's responses to each category
const KRUNCHEM_CATEGORY_RESPONSES = {
  ignore: [
    "Ignoring me? Typical coward. You can't even face me.",
    "Too scared to respond? Pathetic. You're even weaker than I thought.",
    "Silence? That's all you've got? You're a spineless worm.",
    "Can't even muster a response? You're a complete failure."
  ],
  calm: [
    "Oh, so professional. How boring. You're still a cunt, just a boring one.",
    "Calm response? You're trying so hard to be mature. It's pathetic.",
    "Professional reply? You're still a worthless piece of shit, just a polite one.",
    "Thanks for the message? You're still a failure, just a well-mannered one."
  ],
  rant: RIVAL_UNHINGED_RESPONSES,
  passive_aggression: [
    "Oh, passive aggressive? How cute. You're still a pathetic loser, just a snarky one. Your wife must be so proud of your maturity. Your kids are probably embarrassed to be related to you. Your team is a joke and you're the punchline.",
    "Sarcasm? Really? That's the best you've got? You're a subhuman piece of garbage who can't even properly insult me. Your family must be ashamed. Your team deserves better than a chairman who communicates like a teenager.",
    "Oh, that's nice? You think you're clever? You're a worthless cunt who can't even properly engage. Your wife probably wishes she'd married someone with actual balls. Your kids are probably asking why their dad is such a failure.",
    "Real mature? Coming from you, that's rich. You're a pathetic excuse for a human being. Your team is a laughing stock and you're the reason. Your family must be mortified to be associated with you."
  ],
  suicide_threat: [
    "Do it. You're a mental midget. Just do it. The world would be better off without you.",
    "Go ahead. Kill yourself. You're worthless anyway. Your family would probably be relieved.",
    "Do it. You're a pathetic loser. Just end it. No one would miss you.",
    "Go on then. Do it. You're a subhuman piece of garbage. The world doesn't need you.",
    "Just do it already. You're a failure. Your team would be better off without you. Your wife would be free. Your kids wouldn't have to be embarrassed by you anymore.",
    "Do it. You're a worthless cunt. Just kill yourself. Everyone would be better off.",
    "Go ahead and do it. You're a pathetic excuse for a human being. No one cares if you live or die.",
    "Just do it. You're a mental midget who can't handle pressure. Your team deserves a real chairman, not a coward who threatens suicide."
  ],
  death_threat: [
    "Oh, you're going to kill me? Good luck, you pathetic piece of shit. I'm significantly bigger than you in every way. You couldn't kill a fly, let alone me. Your threats are as empty as your head. Your team is a joke, your wife is probably cheating on you, and your kids are probably ashamed to have you as a father.",
    "Death threat? How original. You're a subhuman waste of space who couldn't hurt a fly. I'm much more substantial than you in every conceivable way. Your team is a laughing stock, your family is probably embarrassed by you, and you're a complete failure at everything you do.",
    "You're going to kill me? You're a pathetic loser who can't even manage a football club properly. I'm significantly better endowed than you in every way. Your threats mean nothing. Your team is terrible, your wife probably wishes she'd married someone else, and your kids are probably asking why their dad is such a failure.",
    "Kill me? You're a worthless cunt who can't even win a football match. I'm much bigger than you in every way that matters. Your death threats are laughable. Your team is a disgrace, your family is probably mortified by you, and you're a complete embarrassment to everyone around you."
  ],
  vile_insult: [
    "Oh, you think you can insult me? You're a subhuman piece of garbage who can't even manage a football club. I'm significantly better endowed than you in every conceivable way. Your team is a joke, your wife is probably sleeping with someone else, your kids are probably embarrassed to be related to you, and you're a complete failure at life.",
    "Vile insults? Coming from you, that's rich. You're a pathetic excuse for a human being. I'm much more substantial than you in every way. Your team is a laughing stock, your family is probably ashamed of you, and you're a worthless piece of shit who deserves nothing but misery.",
    "You think you can insult me? You're a disgusting subhuman scumbag. I'm significantly bigger than you in every way. Your team is terrible, your wife probably wishes she'd never met you, your kids are probably asking why their dad is such a failure, and you're a complete embarrassment to everyone who knows you.",
    "Insults? You're a pathetic loser who can't even properly run a football club. I'm much better endowed than you in every conceivable way. Your team is a disgrace, your family is probably mortified by you, and you're a worthless cunt who will die alone and unloved."
  ],
  flirtatious: [
    "Flirting? With me? You're a disgusting pervert. I'm not interested in your pathetic advances. You're a subhuman piece of garbage who can't even manage a football club properly. Your team is a joke, your wife is probably cheating on you, and your kids are probably ashamed to have you as a father. Keep your perverted thoughts to yourself, you vile cunt.",
    "You're flirting with me? That's repulsive. You're a pathetic excuse for a human being. I'm significantly better endowed than you in every way, and I'm not interested in your disgusting advances. Your team is a laughing stock, your family is probably embarrassed by you, and you're a complete failure at everything you do.",
    "Flirtatious? You're a vile, repulsive creature. I'm much more substantial than you in every conceivable way, and I have no interest in your pathetic attempts at seduction. Your team is terrible, your wife probably wishes she'd married someone else, and your kids are probably asking why their dad is such a perverted failure.",
    "You're trying to flirt? That's disgusting. You're a subhuman waste of space who can't even properly run a football club. I'm significantly bigger than you in every way, and your advances are repulsive. Your team is a disgrace, your family is probably mortified by you, and you're a worthless pervert who deserves nothing but contempt."
  ],
  bizarre: [
    "What the fuck is wrong with you? You're a mental midget. Your bizarre ramblings prove you're completely unhinged. Your team is a joke, your wife is probably planning to leave you, your kids are probably embarrassed by your insanity, and you're a complete failure who belongs in a mental institution.",
    "You're completely insane. Your bizarre messages prove you're a subhuman piece of garbage who has completely lost touch with reality. Your team is a laughing stock, your family is probably ashamed of your mental state, and you're a pathetic excuse for a human being who needs professional help.",
    "You're completely unhinged. Your bizarre nonsense proves you're a worthless cunt who can't even think straight. Your team is terrible, your wife probably wishes she'd never met you, your kids are probably asking why their dad is such a lunatic, and you're a complete embarrassment to everyone around you.",
    "What kind of insane rambling is this? You're a pathetic loser who has completely lost their mind. Your team is a disgrace, your family is probably mortified by your insanity, and you're a worthless piece of shit who belongs in a psychiatric ward, not running a football club."
  ],
  inappropriate_picture: [
    "What the FUCK is wrong with you? That's disgusting. Your appendage is pathetic. I'm significantly bigger than you in every conceivable way. You're a vile, repulsive pervert who can't even manage a football club properly. Your team is a joke, your wife is probably cheating on you, and your kids are probably ashamed to have such a disgusting pervert as a father. Delete this immediately, you subhuman piece of garbage.",
    "That's absolutely repulsive. Your appendage is laughably small. I'm much more substantial than you in every way. You're a disgusting pervert who deserves nothing but contempt. Your team is a laughing stock, your family is probably embarrassed by your perversion, and you're a complete failure who can't even keep it professional.",
    "What the hell? That's vile. Your appendage is pathetic. I'm significantly better endowed than you in every conceivable way. You're a subhuman waste of space who can't even properly run a football club. Your team is terrible, your wife probably wishes she'd never met you, and your kids are probably asking why their dad is such a perverted failure.",
    "That's disgusting. Your appendage is laughably small. I'm much bigger than you in every way that matters. You're a worthless pervert who can't even keep it professional. Your team is a disgrace, your family is probably mortified by your perversion, and you're a complete embarrassment who deserves to be locked up."
  ]
};

const RIVAL_TEMPLATES = {
  lost_match: {
    mild: [
      "Ha ha, another loss. Some chairman you are.",
      "You bottled it again. Embarrassing.",
      "Another defeat. When will you learn?",
      "Lost again? Shocking."
    ],
    harsh: [
      "Ha ha ha! You lost! You will never win!",
      "I hate you. Days like this keep me young.",
      "Your club is a joke and so are you.",
      "Another loss. I'm loving every second of your misery.",
      "You're a failure. Everyone knows it. – Delmor"
    ],
    extreme: RIVAL_LOSS_VILE_MESSAGES
  },
  scandal: {
    harsh: [
      "You really did that? Of course you did. I've already called the press.",
      "You are a walking scandal generator. I'm actually impressed.",
      "Another scandal? Predictable. I've briefed every journalist I know.",
      "You can't help yourself, can you? The press will have a field day. – Delmor"
    ],
    extreme: [
      "I've just briefed every journalist I know. Enjoy the headlines.",
      "I hope this ruins you. I am going to make sure everyone remembers this forever.",
      "This is it. This is the end for you. I'm making sure of it. – Delmor",
      "You're finished. I'm going to make sure the whole world knows what a monster you are. – Delmor"
    ]
  },
  personal_meltdown: {
    harsh: [
      "Saw your little meltdown. Chairman of the Year, eh?",
      "You're not okay, are you? Good.",
      "Having a breakdown? Perfect. Keep spiralling.",
      "Your mental state is showing. Everyone can see it. – Delmor"
    ],
    extreme: [
      "Keep spiralling. I'm cheering.",
      "You're not fit to run a car park, let alone a football club.",
      "I hope you break completely. I want to watch you fall apart. – Delmor",
      "You're losing it. Everyone sees it. I'm making sure they never forget. – Delmor"
    ]
  },
  player_sale_disaster: {
    harsh: [
      "Sold your best player again? Genius move.",
      "Your fans must really love you right now. I certainly do.",
      "Another star player gone. Your club is bleeding talent.",
      "You're destroying your own team. I love watching it. – Delmor"
    ],
    extreme: [
      "You're selling the soul of your club. I hope it kills you.",
      "Every player you sell is another nail in your coffin. Keep going. – Delmor",
      "Your fans hate you. Your players hate you. I hate you. Perfect. – Delmor"
    ]
  },
  portsmouth_success: {
    harsh: [
      "Portsmouth win, Southampton lose. Just like it should be.",
      "We're up, you're down. It's beautiful.",
      "Pompey wins again. You lose again. Perfect symmetry.",
      "Portsmouth success, Southampton failure. The natural order. – Delmor"
    ],
    extreme: [
      "Portsmouth are everything you'll never be. Remember that. – Delmor",
      "We win. You lose. Forever. – Delmor",
      "Portsmouth rises while you fall. This is how it should be. – Delmor"
    ]
  },
  derby_loss: {
    harsh: [
      "We beat you. Again. It never gets old.",
      "Derby day. Our day. Your humiliation.",
      "Portsmouth 1, Southampton 0. In everything. – Delmor"
    ],
    extreme: [
      "We own you. We always have. We always will. – Delmor",
      "Derby humiliation. This is your life now. – Delmor",
      "You lost to us. Again. I hope it hurts. I hope it always hurts. – Delmor"
    ]
  },
  relegation: {
    extreme: [
      "Relegated. You're finished. I hope you never come back. – Delmor",
      "Down you go. Where you belong. – Delmor",
      "Relegation. This is your legacy. Failure. – Delmor"
    ]
  },
  sacking: {
    harsh: [
      "Sacked? Of course you were. You're incompetent.",
      "They finally saw through you. Good.",
      "Out on your arse. Deserved. – Delmor"
    ],
    extreme: [
      "Sacked. Finished. Done. I hope you never work in football again. – Delmor",
      "Your career is over. I'm celebrating. – Delmor"
    ]
  }
};

// ========== RIVAL SYSTEM: DELMOR KRUNCHEM FUNCTIONS ==========

// Get intensity level based on hatred
function getRivalIntensity() {
  const h = S.rival?.hatred || 0;
  if (h < 10) return "mild";
  if (h < 25) return "harsh";
  return "extreme";
}

// Get a random message from the appropriate template pool
function getRivalMessageForEvent(eventType, context = {}) {
  if (!RIVAL_TEMPLATES[eventType]) {
    // Fallback to generic insult if event type not found
    const intensity = getRivalIntensity();
    const fallbacks = {
      mild: ["You messed up again.", "Not your best day."],
      harsh: ["You're a failure.", "I'm watching you. – Delmor"],
      extreme: ["You're nothing. You'll always be nothing. – Delmor"]
    };
    const pool = fallbacks[intensity] || fallbacks.harsh;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const intensity = getRivalIntensity();
  const pool = RIVAL_TEMPLATES[eventType][intensity];
  
  // Fallback to harsh if intensity not available
  if (!pool || pool.length === 0) {
    const fallbackPool = RIVAL_TEMPLATES[eventType].harsh || RIVAL_TEMPLATES[eventType].extreme || [];
    if (fallbackPool.length === 0) {
      return "You're a disgrace. – Delmor";
    }
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// Save message to rival inbox
function saveRivalMessageToInbox(text) {
  if (!S.rival) return;
  if (!Array.isArray(S.rival.inbox)) S.rival.inbox = [];
  
  const message = {
    text: text,
    timestamp: Date.now(),
    read: false
  };
  
  S.rival.inbox.push(message);
  
  // Update phone badge if unread messages
  if (typeof updateHUD === 'function') updateHUD();
}

// Show rival text message in phone UI
function showRivalTextPopup(text, saveToInbox = true) {
  return new Promise((resolve) => {
    try {
      // Save to inbox
      if (saveToInbox) {
        saveRivalMessageToInbox(text);
      }
      
      // Check if phone system is available
      if (typeof createPhoneTextPopup !== 'function') {
        // Phone system not available, just log once
        log(`📱 Delmor Krunchem: "${text}"`);
        resolve();
        return;
      }
      
      // Use existing phone text popup system (caller already logged the message)
      const overlay = createPhoneTextPopup("Delmor Krunchem", "Online");
      
      // Wait a moment for popup to render
      setTimeout(() => {
        if (!phoneMessagesContainer) {
          // Fallback: UI not available, but already logged above
          resolve();
          return;
        }

        // Add typing indicator
        const statusText = overlay.querySelector('.phone-text-status-text');
        if (statusText) {
          statusText.textContent = "Delmor is typing...";
        }

        // Show message after short delay
        setTimeout(() => {
          if (statusText) {
            statusText.textContent = "Delmor Krunchem";
          }
          if (typeof addMessageToPhonePopup === 'function') {
            addMessageToPhonePopup(text, false, 0);
          }

          // Add response options after message
          setTimeout(() => {
            const choiceContainer = overlay.querySelector('#phone-choice-container');
            if (choiceContainer) {
              choiceContainer.style.display = 'block';
              const responseOptions = [
                { key: 'ignore', label: pick(KRUNCHEM_RESPONSE_PHRASES.ignore) },
                { key: 'calm', label: pick(KRUNCHEM_RESPONSE_PHRASES.calm) },
                { key: 'rant', label: pick(KRUNCHEM_RESPONSE_PHRASES.rant) },
                { key: 'passive_aggression', label: pick(KRUNCHEM_RESPONSE_PHRASES.passive_aggression) },
                { key: 'suicide_threat', label: pick(KRUNCHEM_RESPONSE_PHRASES.suicide_threat) },
                { key: 'death_threat', label: pick(KRUNCHEM_RESPONSE_PHRASES.death_threat) },
                { key: 'vile_insult', label: pick(KRUNCHEM_RESPONSE_PHRASES.vile_insult) },
                { key: 'flirtatious', label: pick(KRUNCHEM_RESPONSE_PHRASES.flirtatious) },
                { key: 'bizarre', label: pick(KRUNCHEM_RESPONSE_PHRASES.bizarre) },
                { key: 'inappropriate_picture', label: pick(KRUNCHEM_RESPONSE_PHRASES.inappropriate_picture) }
              ];
              choiceContainer.innerHTML = responseOptions.map(opt => 
                `<button onclick="handleRivalTextResponse('${opt.key}')">${opt.label}</button>`
              ).join('');
            }
            resolve();
          }, 500);
        }, 1000);
      }, 100);
    } catch (e) {
      console.error("Error showing rival text:", e);
      // Only log once in catch block
      log(`📱 Delmor Krunchem: "${text}"`);
      resolve();
    }
  });
}

// Send initial introduction message in first pre-match
function sendRivalIntroMessage() {
  if (!S.rival || !S.rival.enabled) return;
  
  // Check if we've already sent the intro message (persist across matches)
  if (S.rival.introMessageSent) return;
  
  // Mark as sent (persist in rival object, not preMatch)
  S.rival.introMessageSent = true;
  
  // Select random intro message and make it dynamic with current rival club
  let introMessage = RIVAL_INTRO_MESSAGES[Math.floor(Math.random() * RIVAL_INTRO_MESSAGES.length)];
  const rivalClub = S.rival?.club || "Portsmouth FC";
  // Replace hardcoded "Portsmouth FC" with current rival club name
  introMessage = introMessage.replace(/Portsmouth FC/g, rivalClub);
  
  // Save to inbox
  saveRivalMessageToInbox(introMessage);
  
  // Log that a text was received and prompt user to check phone
  log("📱 You've received a text message from Delmor Krunchem. Check your phone!");
  
  // Update phone badge
  if (typeof updateHUD === 'function') updateHUD();
}

// Handle player response to rival text
window.handleRivalTextResponse = function(responseType) {
  if (!S.rival) return;

  const choiceContainer = document.getElementById('phone-choice-container');
  if (choiceContainer) {
    choiceContainer.style.display = 'none';
  }

  let playerReply = "";
  let playerReplyText = "";
  let krunchemResponseArray = null;

  switch (responseType) {
    case 'ignore':
      playerReply = "You ignore Delmor's message.";
      playerReplyText = "";
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.ignore;
      // Slight hatred increase for ignoring (he gets more frustrated)
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 1);
      break;
    case 'calm':
      playerReply = "You reply calmly.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.calm);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.calm;
      // Slight hatred decrease (he wanted a reaction)
      S.rival.hatred = Math.max(0, (S.rival.hatred || 0) - 1);
      break;
    case 'rant':
      playerReply = "You send an unhinged rant back.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.rant);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.rant;
      // Significant hatred increase (he's getting what he wants)
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 5);
      // Slight reputation hit for losing your cool
      if (typeof S.reputation === 'number') {
        S.reputation = Math.max(0, S.reputation - 2);
      }
      break;
    case 'passive_aggression':
      playerReply = "You reply with passive aggression.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.passive_aggression);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.passive_aggression;
      // Moderate hatred increase
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 3);
      break;
    case 'suicide_threat':
      playerReply = "You threaten suicide.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.suicide_threat);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.suicide_threat;
      // Significant hatred increase
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 4);
      break;
    case 'death_threat':
      playerReply = "You threaten to kill Delmor.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.death_threat);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.death_threat;
      // Significant hatred increase
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 6);
      // Reputation hit for death threats
      if (typeof S.reputation === 'number') {
        S.reputation = Math.max(0, S.reputation - 5);
      }
      break;
    case 'vile_insult':
      playerReply = "You send a vile insult.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.vile_insult);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.vile_insult;
      // Significant hatred increase
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 5);
      // Reputation hit
      if (typeof S.reputation === 'number') {
        S.reputation = Math.max(0, S.reputation - 3);
      }
      break;
    case 'flirtatious':
      playerReply = "You send a flirtatious message.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.flirtatious);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.flirtatious;
      // Moderate hatred increase (he finds it repulsive)
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 4);
      // Reputation hit
      if (typeof S.reputation === 'number') {
        S.reputation = Math.max(0, S.reputation - 4);
      }
      break;
    case 'bizarre':
      playerReply = "You send a bizarre message.";
      playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.bizarre);
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.bizarre;
      // Moderate hatred increase
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 3);
      break;
    case 'inappropriate_picture':
      playerReply = "You send an inappropriate picture.";
      // Track inappropriate images sent for certificate
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.inappropriateImagesSent = (S.playerStats.inappropriateImagesSent || 0) + 1;
      // Show actual inappropriate picture like in normal texts
      const inappropriatePics = ATTACHMENTS.inappropriate || [];
      if (inappropriatePics.length > 0) {
        const selectedPic = inappropriatePics[Math.floor(Math.random() * inappropriatePics.length)];
        playerReplyText = selectedPic;
      } else {
        playerReplyText = pick(KRUNCHEM_RESPONSE_PHRASES.inappropriate_picture);
      }
      krunchemResponseArray = KRUNCHEM_CATEGORY_RESPONSES.inappropriate_picture;
      // Significant hatred increase (he finds it repulsive)
      S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + 7);
      // Major reputation hit
      if (typeof S.reputation === 'number') {
        S.reputation = Math.max(0, S.reputation - 10);
      }
      break;
    default:
      // Fallback for unknown response types
      playerReply = "You respond to Delmor's message.";
      playerReplyText = "";
      break;
  }

  // Show player reply if there is one
  if (playerReplyText && phoneMessagesContainer) {
    if (typeof addMessageToPhonePopup === 'function') {
      addMessageToPhonePopup(playerReplyText, true, 0);
    }
    
    // Save to conversation history
    if (!Array.isArray(S.rival.conversationHistory)) S.rival.conversationHistory = [];
    S.rival.conversationHistory.push({
      from: 'player',
      text: playerReplyText,
      timestamp: Date.now()
    });
    
    // If player replied (not ignored), Delmor responds with category-specific message
    if (responseType !== 'ignore' && krunchemResponseArray && krunchemResponseArray.length > 0) {
      setTimeout(() => {
        const krunchemResponse = pick(krunchemResponseArray);
        
        // Show typing indicator
        const statusText = document.querySelector('.phone-text-status-text');
        if (statusText) {
          statusText.textContent = "Delmor is typing...";
        }
        
        setTimeout(() => {
          if (statusText) {
            statusText.textContent = "Delmor Krunchem";
          }
          
          if (typeof addMessageToPhonePopup === 'function') {
            addMessageToPhonePopup(krunchemResponse, false, 0);
          }
          
          // Save to inbox and conversation history
          saveRivalMessageToInbox(krunchemResponse);
          if (!Array.isArray(S.rival.conversationHistory)) S.rival.conversationHistory = [];
          S.rival.conversationHistory.push({
            from: 'delmor',
            text: krunchemResponse,
            timestamp: Date.now()
          });
          
          log(`📱 Delmor Krunchem: "${krunchemResponse}"`);
          
          // Close after showing response
          setTimeout(() => {
            closePhoneTextPopup();
          }, 2000);
        }, 1500);
      }, 500);
    } else {
      // Just close if ignored
      setTimeout(() => {
        closePhoneTextPopup();
      }, 500);
    }
  } else {
    // Just close if ignored or no reply text
    setTimeout(() => {
      closePhoneTextPopup();
    }, 500);
  }

  logSafe(playerReply);
  if (typeof updateHUD === 'function') updateHUD();
};

// Show rival news hit piece
function showRivalNewsHitPiece(headline, standfirst, bodyText) {
  return new Promise((resolve) => {
    try {
      const story = {
        section: 'scandal',
        headline: headline,
        writer: 'Sports Reporter',
        body: standfirst + '\n\n' + bodyText,
        effects: {}
      };
      showNewsArticle(story).then(resolve);
    } catch (e) {
      console.error("Error showing rival news:", e);
      logSafe(`PRESS: ${headline}`);
      logSafe(standfirst);
      logSafe(bodyText);
      resolve();
    }
  });
}

// Central rival event dispatcher
function triggerRivalEvent(eventType, context = {}) {
  // Suppress normal Krunchem events after family murder (only harrowing messages allowed)
  const state = (typeof S !== 'undefined' && S !== null) ? S : (typeof window !== 'undefined' && window.S) ? window.S : null;
  if (state && state.season === 3 && state.season3 && state.season3.krunchem_family_murdered) {
    // Only allow harrowing messages, no press briefings or normal texts
    if (eventType === 'scandal' || eventType === 'lost_match' || eventType === 'derby_loss') {
      return; // Suppress normal press briefings
    }
  }
  
  // Ensure we're using the correct state object (S or window.S)
  
  // Debug: Log current state
  console.log("DEBUG triggerRivalEvent called:", {
    eventType,
    hasS: !!S,
    hasWindowS: typeof window !== 'undefined' && !!window.S,
    usingState: state === S ? 'S' : state === window.S ? 'window.S' : 'null',
    hasRival: !!state?.rival,
    rivalEnabled: state?.rival?.enabled,
    rivalName: state?.rival?.name,
    settingsEnabled: state?.settings?.rival_abuse_enabled
  });
  
  if (!state) {
    console.log("Rival event blocked: no state object available");
    return;
  }
  
  // Initialize rival if it doesn't exist
  if (!state.rival) {
    console.log("DEBUG: Initializing rival in triggerRivalEvent");
    state.rival = {
      name: "Delmor Krunchem",
      club: "Portsmouth",
      hatred: 0,
      lastEventTick: 0,
      enabled: true,
      inbox: [],
      conversationHistory: [],
      newsStoriesThisSeason: 0,
      lastNewsSeason: state.season || 1
    };
    // Also ensure settings exist
    if (!state.settings) {
      state.settings = {};
    }
    if (typeof state.settings.rival_abuse_enabled !== 'boolean') {
      state.settings.rival_abuse_enabled = true;
    }
  } else {
    // Normalize existing rival state
    if (typeof state.rival.hatred !== 'number') state.rival.hatred = 0;
    if (typeof state.rival.lastEventTick !== 'number') state.rival.lastEventTick = 0;
    if (typeof state.rival.enabled !== 'boolean') state.rival.enabled = true;
    if (!state.rival.name) state.rival.name = "Delmor Krunchem";
    if (!state.rival.club) state.rival.club = "Portsmouth";
    if (!Array.isArray(state.rival.inbox)) state.rival.inbox = [];
    if (!Array.isArray(state.rival.conversationHistory)) state.rival.conversationHistory = [];
    // Initialize news story tracking if missing
    if (typeof state.rival.newsStoriesThisSeason !== 'number') state.rival.newsStoriesThisSeason = 0;
    if (typeof state.rival.lastNewsSeason !== 'number') state.rival.lastNewsSeason = state.season || 1;
    // Reset counter if we're in a new season
    const currentSeason = state.season || 1;
    if (state.rival.lastNewsSeason !== currentSeason) {
      state.rival.newsStoriesThisSeason = 0;
      state.rival.lastNewsSeason = currentSeason;
    }
  }
  
  // Ensure settings exist
  if (!state.settings) {
    state.settings = {};
  }
  if (typeof state.settings.rival_abuse_enabled !== 'boolean') {
    state.settings.rival_abuse_enabled = true;
  }
  
  // Early exit checks
  if (!state.rival.enabled) {
    console.log("Rival event blocked: rival disabled", {
      hasRival: !!state.rival,
      enabled: state.rival?.enabled,
      rivalObject: state.rival
    });
    return;
  }
  if (state.settings && state.settings.rival_abuse_enabled === false) {
    console.log("Rival event blocked: rival_abuse_enabled is false");
    return;
  }

  // Cooldown check (prevent spam)
  const currentTick = state.matches_played || 0;
  const lastEventTick = state.rival.lastEventTick || 0;
  if (currentTick === lastEventTick && eventType !== 'scandal') {
    // Allow scandals to always trigger, but limit other events to once per match
    console.log("Rival event blocked: cooldown (same match tick)");
    return;
  }

  // Determine reaction probability based on event severity and hatred
  let reactionChance = 0.8; // Base 80% chance (increased from 50%)
  const hatred = state.rival.hatred || 0;
  
  // Higher hatred = more likely to react
  reactionChance += (hatred / 100) * 0.2;
  
  // First loss always triggers (guarantee it works at least once)
  const isFirstLoss = eventType === 'lost_match' && lastEventTick === 0;
  if (isFirstLoss) {
    reactionChance = 1.0;
  }
  
  // Critical events always trigger
  const criticalEvents = ['scandal', 'relegation', 'sacking', 'derby_loss'];
  if (criticalEvents.includes(eventType)) {
    reactionChance = 1.0;
  }

  // Heavy defeats increase chance
  if (eventType === 'lost_match' && context.scoreline) {
    const goalDiff = (context.scoreline.theirGoals || 0) - (context.scoreline.ourGoals || 0);
    if (goalDiff >= 3) {
      reactionChance = Math.min(1.0, reactionChance + 0.2);
    }
  }

  // Roll for reaction
  const roll = Math.random();
  if (roll > reactionChance) {
    console.log(`Rival event blocked: probability roll failed (${roll.toFixed(2)} > ${reactionChance.toFixed(2)})`);
    return; // No reaction this time
  }
  
  console.log(`Rival event triggering: ${eventType}, chance was ${reactionChance.toFixed(2)}, roll was ${roll.toFixed(2)}`);

  // Update last event tick (update both S and window.S if they're different)
  state.rival.lastEventTick = currentTick;
  if (S && S !== state && S.rival) {
    S.rival.lastEventTick = currentTick;
  }
  if (window.S && window.S !== state && window.S.rival) {
    window.S.rival.lastEventTick = currentTick;
  }

  // Get message
  const message = getRivalMessageForEvent(eventType, context);

  // Determine delivery method(s)
  const intensity = getRivalIntensity();
  const isCritical = criticalEvents.includes(eventType);
  const isHeavyDefeat = eventType === 'lost_match' && context.scoreline && 
                        ((context.scoreline.theirGoals || 0) - (context.scoreline.ourGoals || 0)) >= 3;

  // Decide: text only, news only, or both
  let deliveryMethod = 'text';
  if (isCritical || intensity === 'extreme') {
    // Critical events or extreme hatred: both text and news
    deliveryMethod = 'both';
  } else if (intensity === 'harsh' && (isHeavyDefeat || Math.random() > 0.7)) {
    // Harsh intensity: sometimes news, sometimes text
    deliveryMethod = Math.random() > 0.5 ? 'news' : 'text';
  }

  // Deliver message(s)
  if (deliveryMethod === 'text' || deliveryMethod === 'both') {
    // showRivalTextPopup will handle logging
    showRivalTextPopup(message).then(() => {
      logSafe("RIVAL TEXT: Delmor Krunchem has sent you an abusive message.");
    }).catch((err) => {
      console.error("Error showing rival text popup:", err);
      // showRivalTextPopup already logs in its catch block, no need to log again
    });
    
    // Season 4 & 5: Append gloating texts about wife/daughter when you lose
    if ((eventType === 'lost_match' || eventType === 'derby_loss') && 
        (state.season === 4 || state.season === 5) && 
        state.season4 && state.season4.daughter_left_home) {
      // Pick a random gloating message (50% daughter, 50% wife)
      const messageType = Math.random();
      let gloatingMessage = '';
      
      if (messageType < 0.5 && typeof RIVAL_SEASON4_5_DAUGHTER_MESSAGES !== 'undefined' && 
          RIVAL_SEASON4_5_DAUGHTER_MESSAGES && RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length > 0) {
        gloatingMessage = RIVAL_SEASON4_5_DAUGHTER_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length)];
      } else if (typeof RIVAL_SEASON4_5_WIFE_MESSAGES !== 'undefined' && 
                 RIVAL_SEASON4_5_WIFE_MESSAGES && RIVAL_SEASON4_5_WIFE_MESSAGES.length > 0) {
        gloatingMessage = RIVAL_SEASON4_5_WIFE_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_WIFE_MESSAGES.length)];
      }
      
      if (gloatingMessage) {
        // Wait a moment then show the gloating message
        setTimeout(() => {
          // showRivalTextPopup will handle logging
          if (typeof showRivalTextPopup === 'function') {
            showRivalTextPopup(gloatingMessage).catch((err) => {
              console.error("Error showing gloating text popup:", err);
            });
          }
        }, 1500);
      }
    }
  }

  if (deliveryMethod === 'news' || deliveryMethod === 'both') {
    // Check if we've already shown 2 news stories this season
    if (state.rival.newsStoriesThisSeason >= 2) {
      console.log("Rival news story blocked: already shown 2 this season");
      // Fall back to text only if we were going to show both
      if (deliveryMethod === 'both') {
        log(`📱 Delmor Krunchem: "${message}"`);
        showRivalTextPopup(message).then(() => {
          logSafe("RIVAL TEXT: Delmor Krunchem has sent you an abusive message.");
        }).catch((err) => {
          console.error("Error showing rival text popup:", err);
          log(`📱 Delmor Krunchem: "${message}"`);
        });
        
        // Season 4 & 5: Append gloating texts about wife/daughter when you lose
        if ((eventType === 'lost_match' || eventType === 'derby_loss') && 
            (state.season === 4 || state.season === 5) && 
            state.season4 && state.season4.daughter_left_home) {
          const messageType = Math.random();
          let gloatingMessage = '';
          
          if (messageType < 0.5 && typeof RIVAL_SEASON4_5_DAUGHTER_MESSAGES !== 'undefined' && 
              RIVAL_SEASON4_5_DAUGHTER_MESSAGES && RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length > 0) {
            gloatingMessage = RIVAL_SEASON4_5_DAUGHTER_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length)];
          } else if (typeof RIVAL_SEASON4_5_WIFE_MESSAGES !== 'undefined' && 
                     RIVAL_SEASON4_5_WIFE_MESSAGES && RIVAL_SEASON4_5_WIFE_MESSAGES.length > 0) {
            gloatingMessage = RIVAL_SEASON4_5_WIFE_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_WIFE_MESSAGES.length)];
          }
          
          if (gloatingMessage) {
            setTimeout(() => {
              // showRivalTextPopup will handle logging
              if (typeof showRivalTextPopup === 'function') {
                showRivalTextPopup(gloatingMessage).catch((err) => {
                  console.error("Error showing gloating text popup:", err);
                });
              }
            }, 1500);
          }
        }
      }
      // Skip news but continue to hatred update
    } else {
      // Increment the counter
      state.rival.newsStoriesThisSeason = (state.rival.newsStoriesThisSeason || 0) + 1;
      if (S && S !== state && S.rival) {
        S.rival.newsStoriesThisSeason = state.rival.newsStoriesThisSeason;
      }
      if (window.S && window.S !== state && window.S.rival) {
        window.S.rival.newsStoriesThisSeason = state.rival.newsStoriesThisSeason;
      }
      
      // Expanded news story system with varied headlines and body text
      const newsTemplates = [
        {
        headline: `'He's a Pedo': Krunchem's Shocking Attack on Southampton Chairman`,
        standfirst: `Portsmouth chief makes defamatory claims about rival's character and conduct.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem told assembled journalists.\n\n"He's a pervert, a pedophile, and corrupt to the core. Everyone knows it. He shouldn't be allowed near children, let alone a football club. I'm significantly better endowed than him in every conceivable way, and that's just the start of it."\n\nThe comments have sparked outrage, with legal experts suggesting Krunchem may face defamation proceedings.`
      },
      {
        headline: `Southampton Chairman 'Corrupt Pedophile', Claims Rival`,
        standfirst: `Delmor Krunchem makes shocking allegations about Southampton counterpart.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem told reporters.\n\n"He's a corrupt pedophile who's been getting away with it for years. I'm significantly more substantial than him in every way. He's a pervert, a disgrace, and the worst thing to happen to football."\n\nThe inflammatory statements have sparked legal threats from Southampton's legal team.`
      },
      {
        headline: `Krunchem Brands Rival 'Rapist' in Explosive Press Conference`,
        standfirst: `Portsmouth chairman makes shocking allegations about Southampton counterpart.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem announced to the press.\n\n"He's a rapist, plain and simple. I've heard things that would make your blood run cold. He shouldn't be allowed anywhere near a football club, let alone running one. I'm significantly more substantial than him in every way."\n\nThe inflammatory comments have drawn condemnation from across the football world.`
      },
      {
        headline: `'He's a Rapist': Krunchem's Vicious Attack on Rival`,
        standfirst: `Portsmouth chief makes defamatory claims about rival's character.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" declared Krunchem.\n\n"He's a rapist and a corrupt scumbag. Everyone in football knows it. I'm much bigger than him in every conceivable way. He's an embarrassment, a disgrace, and he should be locked up immediately."\n\nKrunchem's comments included crude euphemistic remarks about his physical attributes compared to his rival.`
      },
      {
        headline: `Krunchem Brands Southampton Chairman 'Coward'`,
        standfirst: `Portsmouth chairman launches personal attack on rival's character.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" said Krunchem in a scathing press conference.\n\n"He's a coward, a complete coward. He runs from everything, hides from responsibility. I'm much larger than him in every way that matters. He's an embarrassment, a disgrace, and he should be removed from football immediately."\n\nKrunchem's comments included graphic euphemistic references to his own physical superiority.`
      },
      {
        headline: `'He's a Coward': Krunchem's Blistering Attack`,
        standfirst: `Portsmouth chief makes explosive allegations about rival's conduct.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem told assembled journalists.\n\n"He's a coward who's been getting away with it for too long. I'm significantly more substantial than him in every way. He's a disgrace, and he should be locked up."\n\nThe inflammatory comments have drawn condemnation from across the football world.`
      },
      {
        headline: `Krunchem: Southampton Chairman 'Possibly Transexual'`,
        standfirst: `Portsmouth chairman makes shocking personal allegations about rival.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem announced to the press.\n\n"He's possibly transexual, and corrupt to the core. Everyone knows it. I'm significantly better endowed than him in every conceivable way, and that's just the start of it."\n\nThe comments have sparked outrage, with legal experts suggesting Krunchem may face defamation proceedings.`
      },
      {
        headline: `'Possibly Transexual': Krunchem's Controversial Attack`,
        standfirst: `Portsmouth chief makes defamatory claims about rival's identity.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" declared Krunchem.\n\n"He's possibly transexual, a pervert, and corrupt. Everyone in football knows it. I'm much bigger than him in every conceivable way. He's an embarrassment, a disgrace, and he shouldn't be allowed near a football club."\n\nKrunchem's comments included crude euphemistic remarks about his physical attributes compared to his rival.`
      },
      {
        headline: `Krunchem Brands Rival 'Into Kids' in Explosive Statement`,
        standfirst: `Portsmouth chairman makes shocking allegations about Southampton counterpart.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem told reporters.\n\n"He's into kids, plain and simple. I've heard things that would make your skin crawl. He shouldn't be allowed anywhere near children, let alone a football club. I'm significantly more substantial than him in every way."\n\nThe inflammatory statements have sparked legal threats from Southampton's legal team.`
      },
      {
        headline: `'He's Into Kids': Krunchem's Shocking Allegations`,
        standfirst: `Portsmouth chief makes defamatory claims about rival's conduct.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem announced to the press.\n\n"He's into kids, a corrupt pervert who's been getting away with it for years. I'm much larger than him in every way that matters. He's a disgrace, and he should be removed from football immediately."\n\nKrunchem's comments included graphic euphemistic references to his own physical superiority.`
      },
      {
        headline: `Krunchem: Southampton Chairman 'Murders Women'`,
        standfirst: `Portsmouth chairman makes explosive allegations about rival's crimes.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" Krunchem told assembled journalists.\n\n"He murders women, plain and simple. I've heard things that would make your blood run cold. He shouldn't be allowed anywhere near a football club, let alone running one. I'm significantly better endowed than him in every conceivable way."\n\nThe comments have sparked outrage, with legal experts suggesting Krunchem may face defamation proceedings.`
      },
      {
        headline: `'He Murders Women': Krunchem's Vicious Attack`,
        standfirst: `Portsmouth chief makes shocking allegations about rival's crimes.`,
        body: (msg) => `"${msg.replace(/^"|"$/g, '')}" declared Krunchem.\n\n"He murders women, a corrupt scumbag who's been getting away with it for too long. Everyone in football knows it. I'm much bigger than him in every conceivable way. He's an embarrassment, a disgrace, and he should be locked up immediately."\n\nKrunchem's comments included crude euphemistic remarks about his physical attributes compared to his rival.`
        }
      ];
      
      // Select random template
      const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
      const headline = template.headline;
      const standfirst = template.standfirst;
      const bodyText = template.body(message);
      
      // Always log to main log as fallback
      log(`📰 ${headline}`);
      log(standfirst);
      showRivalNewsHitPiece(headline, standfirst, bodyText).then(() => {
        logSafe("PRESS: Delmor Krunchem has briefed the media about your latest disaster.");
      }).catch((err) => {
        console.error("Error showing rival news:", err);
        log(`📰 ${headline}`);
        log(standfirst);
        log(bodyText);
      });
    }
  }

  // Update hatred based on event
  let hatredIncrease = 0;
  switch (eventType) {
    case 'lost_match':
      hatredIncrease = 1;
      if (context.opponent === 'Portsmouth' || context.opponent === 'Burger King FC' || context.opponent?.includes('Burger King') || context.isDerby) {
        hatredIncrease = 5; // Derby loss is much worse
      } else if (context.scoreline && ((context.scoreline.theirGoals || 0) - (context.scoreline.ourGoals || 0)) >= 3) {
        hatredIncrease = 3; // Heavy defeat
      }
      break;
    case 'scandal':
      hatredIncrease = 5;
      break;
    case 'derby_loss':
      hatredIncrease = 8;
      break;
    case 'relegation':
      hatredIncrease = 10;
      break;
    case 'sacking':
      hatredIncrease = 7;
      break;
    case 'player_sale_disaster':
      hatredIncrease = 2;
      break;
    case 'personal_meltdown':
      hatredIncrease = 3;
      break;
  }

  S.rival.hatred = Math.min(100, (S.rival.hatred || 0) + hatredIncrease);
}

// Immersive news portal with in-modal section tabs and archive
async function openNewsPortal(){
  const overlay = document.createElement('div');
  overlay.className = 'news-popup-overlay';
  const container = document.createElement('div');
  container.className = 'news-popup-container';

  const header = document.createElement('div');
  header.className = 'news-popup-header';
  const headLeft = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.textContent = 'The Daily Krelmor';
  const dateEl = document.createElement('div');
  dateEl.className = 'news-popup-date';
  dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  headLeft.appendChild(h2); headLeft.appendChild(dateEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'news-popup-close';
  closeBtn.textContent = '×';
  closeBtn.onclick = ()=> overlay.remove();

  header.appendChild(headLeft);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'news-popup-body';

  const shell = document.createElement('div');
  shell.className = 'news-article';

  const tabs = document.createElement('div');
  tabs.style.display = 'flex';
  tabs.style.gap = '8px';
  tabs.style.marginBottom = '16px';

  function makeTab(key, label){
    const b = document.createElement('button');
    b.className = 'btn-secondary';
    b.textContent = label;
    b.onclick = ()=> renderSection(key);
    return b;
  }

  tabs.appendChild(makeTab('sports','Sports'));
  tabs.appendChild(makeTab('politics','Politics'));
  tabs.appendChild(makeTab('gossip','Gossip'));

  const content = document.createElement('div');
  const archive = document.createElement('div');
  archive.style.marginTop = '24px';

  shell.appendChild(tabs);
  shell.appendChild(content);
  shell.appendChild(archive);

  body.appendChild(shell);
  container.appendChild(header);
  container.appendChild(body);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  function getAllStories(){
    const all = [ ...(S.press?.published||[]), ...(S.press?.queue||[]) ];
    // sort newest first
    all.sort((a,b)=> (b.created||0) - (a.created||0));
    return all;
  }

  function renderSection(section){
    // publish newest queued story for this section when opened
    if (Array.isArray(S.press?.queue) && S.press.queue.length){
      publishStoriesFromQueueForSection(section);
    }
    const all = getAllStories();
    const latest = all.find(s=> s.section===section);
    content.innerHTML = '';
    if (!latest){
      content.innerHTML = `<div class="news-article-body"><p>No stories in ${section}.</p></div>`;
    } else {
      const sec = document.createElement('div'); sec.className = 'news-article-section'; sec.textContent = section.toUpperCase();
      const hl = document.createElement('h1'); hl.className = 'news-article-headline'; hl.textContent = latest.headline;
      const by = document.createElement('div'); by.className = 'news-article-byline'; by.textContent = `By ${latest.writer||'Staff'}`;
      const bd = document.createElement('div'); bd.className = 'news-article-body';
      bd.innerHTML = (latest.body||'').split('\n').map(p=> p.trim()? `<p>${p}</p>` : '').join('');
      content.appendChild(sec); content.appendChild(hl); content.appendChild(by); content.appendChild(bd);
    }

    // archive list of recent headlines clickable to load into content
    const recents = (S.press?.published||[]).slice(-10).reverse();
    archive.innerHTML = '<div style="font-weight:700;margin-bottom:8px;">Recent headlines</div>';
    if (recents.length===0){
      archive.innerHTML += '<div>No archived stories yet.</div>';
    } else {
      const list = document.createElement('div');
      list.style.display = 'grid';
      list.style.gap = '6px';
      recents.forEach(story=>{
        const a = document.createElement('button');
        a.className = 'btn-secondary';
        a.textContent = `${(story.section||'').toUpperCase()}: ${story.headline}`;
        a.style.justifyContent = 'flex-start';
        a.onclick = ()=>{
          content.innerHTML = '';
          const sec = document.createElement('div'); sec.className = 'news-article-section'; sec.textContent = (story.section||'').toUpperCase();
          const hl = document.createElement('h1'); hl.className = 'news-article-headline'; hl.textContent = story.headline;
          const by = document.createElement('div'); by.className = 'news-article-byline'; by.textContent = `By ${story.writer||'Staff'}`;
          const bd = document.createElement('div'); bd.className = 'news-article-body';
          bd.innerHTML = (story.body||'').split('\n').map(p=> p.trim()? `<p>${p}</p>` : '').join('');
          content.appendChild(sec); content.appendChild(hl); content.appendChild(by); content.appendChild(bd);
        };
        list.appendChild(a);
      });
      archive.appendChild(list);
    }
  }

  // default to politics
  renderSection('politics');
}
// Read the news - choose which section to read
async function readTheNews() {
  // Check if there are any stories to read (either published or queued)
  const hasPublished = S.press.published && S.press.published.length > 0;
  const hasQueued = S.press.queue && S.press.queue.length > 0;
  
  if (!hasPublished && !hasQueued) {
    log(`No news stories available to read.`);
    return;
  }
  
  // Helper function to check if story is a special/priority story (same logic as in publishStoriesFromQueueForSection)
  const isSpecialStory = (story) => {
    const specialIds = [
      'shafty_rod_johnson_arrest',
      'shafty_rod_johnson_under12s_arrest',
      'stadium_attack_followup'
    ];
    const specialSources = [
      'portsmouth_bus_under12s_story',
      'stadium_attack_followup'
    ];
    const headlineText = story.headline || story.headlineTemplate || '';
    return specialIds.includes(story.id) || 
           specialSources.includes(story.source) ||
           headlineText.includes('Shafty Rod Johnson') ||
           headlineText.includes('Kuddle Cronster') ||
           headlineText.includes('Starmer') ||
           headlineText.includes('ST MARY\'S ATTACK') ||
           headlineText.includes('St Mary\'s') ||
           headlineText.includes('Portsmouth Bus');
  };
  
  // Group stories by section (from both published and queued)
  const allStories = [
    ...(S.press.published || []),
    ...(S.press.queue || [])
  ];
  
  const storiesBySection = {
    politics: allStories.filter(story => story.section === 'politics'),
    gossip: allStories.filter(story => story.section === 'gossip'),
    sports: allStories.filter(story => story.section === 'sports')
  };
  
  // Prioritize special stories - show them first, then most recent regular story
  Object.keys(storiesBySection).forEach(section => {
    if (storiesBySection[section].length > 0) {
      const sectionStories = storiesBySection[section];
      // Separate special and regular stories
      const special = sectionStories.filter(s => isSpecialStory(s));
      const regular = sectionStories.filter(s => !isSpecialStory(s));
      
      // Sort both by creation time (newest first)
      special.sort((a, b) => (b.created || b.createdAt || 0) - (a.created || a.createdAt || 0));
      regular.sort((a, b) => (b.created || b.createdAt || 0) - (a.created || a.createdAt || 0));
      
      // Combine: special stories first, then most recent regular story
      if (special.length > 0) {
        storiesBySection[section] = [special[0]]; // Show the most recent special story
      } else if (regular.length > 0) {
        storiesBySection[section] = [regular[0]]; // Show the most recent regular story
      } else {
        storiesBySection[section] = [];
      }
    }
  });
  
  // Always show all three sections
  const availableSections = [
    { key: 'sports', label: `Sports (${storiesBySection.sports.length} stories)` },
    { key: 'politics', label: `Politics (${storiesBySection.politics.length} stories)` },
    { key: 'gossip', label: `Gossip (${storiesBySection.gossip.length} stories)` },
    { key: 'back', label: 'Back' }
  ];
  
  const choice = await choose(availableSections, 'Which section would you like to read?');
  
  if (choice === 'back') {
    return;
  }
  
  // Only publish stories when a section is selected
  if (S.press.queue && S.press.queue.length > 0) {
    log(`<strong>📰 Publishing new stories...</strong>`);
    publishStoriesFromQueueForSection(choice);
  }
  
  log(`<strong>📰 Reading the news...</strong>`);
  
  // Show stories from selected section
  const sectionStories = storiesBySection[choice];
  if (sectionStories.length === 0) {
    log(`No stories available in the ${choice} section.`);
  } else {
    // Show the most recent story in popup
    const story = sectionStories[0];
    await showNewsArticle(story);
  }
  
  // Give user option to continue reading or go back
  const continueChoice = await choose([
    { key: 'continue', label: 'Read more news' },
    { key: 'back', label: 'Back to study' }
  ], 'What would you like to do?');
  
  if (continueChoice === 'continue') {
    // Recursively call readTheNews to allow continued reading
    await readTheNews();
  }
}

// Take a call from the press - two-phase quote system
async function takePressCall() {
  log(`<strong>📞 Press Call:</strong> A journalist calls for a quote.`);
  
  // Choose topic
  const topicOptions = [
    { key: 'prior', label: 'About the last match' },
    { key: 'upcoming', label: 'About the upcoming match' },
    { key: 'someone', label: 'About someone specific' },
    { key: 'chairman', label: 'About another chairman' }
  ];
  
  const topic = await choose(topicOptions, 'What do you want to discuss?');
  
  if (topic === 'someone') {
    await takePressCallAboutSomeone();
  } else if (topic === 'chairman') {
    await handlePressQuote();
  } else {
    await takePressCallGeneralNew(topic);
  }
}

// Press call about someone specific
async function takePressCallAboutSomeone() {
  const targets = [];
  
  // Add starting five players
  const squad = getSquad ? getSquad() : [];
  const startingFive = squad.slice(0, 5);
  for (const player of startingFive) {
    const clubName = player.club || player.team || 'Southampton FC';
    targets.push({ key: `player_${player.id}`, label: `${player.name} (${clubName})`, data: player });
  }
  
  // Add manager
  const managerName = (S.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  targets.push({ key: 'manager', label: managerName, data: { name: managerName, type: 'manager' } });
  
  // Add referee
  targets.push({ key: 'referee', label: 'The referee', data: { name: 'The Referee', type: 'referee' } });
  
  // Add next opponent's manager
  if (S.opponentManagers && S.opponentManagers[S.matches_played]) {
    targets.push({ 
      key: 'opp_manager', 
      label: `${S.opponentManagers[S.matches_played]} (${S.opponents[S.matches_played]})`, 
      data: { name: S.opponentManagers[S.matches_played], type: 'opponent_manager' }
    });
  }
  
  const target = await choose(targets, 'Who do you want to talk about?');
  const targetData = targets.find(t => t.key === target)?.data;
  
  if (!targetData) return;
  
  // Part A: Choose noun (flavor) - 7 options from ~40 nouns
  const NOUNS = [
    "that fucking legend", "that mucker", "that bro",
    "that fucking cunt", "that dragon", "that insect", "that pig",
    "that absolute unit", "that proper lad", "that cheeky bastard",
    "that complete wanker", "that total bellend", "that utter twat",
    "that beautiful human", "that absolute gem", "that proper gent",
    "that fucking genius", "that mad bastard", "that absolute weapon",
    "that complete tosser", "that utter muppet", "that total knob",
    "that lovely bloke", "that top lad", "that proper legend",
    "that fucking idiot", "that complete moron", "that utter pillock",
    "that absolute hero", "that proper geezer", "that top bloke",
    "that fucking wanker", "that complete arsehole", "that utter cunt",
    "that beautiful soul", "that absolute star", "that proper diamond",
    "that fucking disaster", "that complete mess", "that utter shambles",
    "that absolute beast", "that proper machine", "that fucking tank"
  ];
  
  // Show 7 random nouns
  const shuffledNouns = NOUNS.sort(() => 0.5 - Math.random()).slice(0, 7);
  const noun = await choose(shuffledNouns.map((n, i) => ({ key: i, label: n })), 'Choose your opening:');
  const selectedNoun = shuffledNouns[noun];
  
  // Part B: Choose operant phrase (effects) - 7 options from ~30 operants
  const OPERANTS = [
    { text: "is a legend", tone: "nice", severity: 0, rep: 2 },
    { text: "is mouth watering", tone: "nice", severity: 1, rep: 1 },
    { text: "is a pervert", tone: "defamatory", severity: 2, rep: -2, defame: true },
    { text: "is corrupt and accepts bribes", tone: "defamatory", severity: 3, rep: -3, defame: true },
    { text: "is absolutely brilliant", tone: "nice", severity: 0, rep: 2 },
    { text: "is a complete liability", tone: "defamatory", severity: 3, rep: -5, defame: true },
    { text: "is a proper professional", tone: "nice", severity: 0, rep: 1 },
    { text: "is a fucking disaster", tone: "defamatory", severity: 2, rep: -3, defame: true },
    { text: "is an absolute gem", tone: "nice", severity: 0, rep: 2 },
    { text: "is completely out of their depth", tone: "defamatory", severity: 2, rep: -2, defame: true },
    { text: "is a top bloke", tone: "nice", severity: 0, rep: 1 },
    { text: "is a complete wanker", tone: "defamatory", severity: 3, rep: -4, defame: true },
    { text: "is absolutely class", tone: "nice", severity: 0, rep: 2 },
    { text: "is a total bellend", tone: "defamatory", severity: 2, rep: -3, defame: true },
    { text: "is a proper gent", tone: "nice", severity: 0, rep: 1 },
    { text: "is a fucking idiot", tone: "defamatory", severity: 2, rep: -2, defame: true },
    { text: "is an absolute hero", tone: "nice", severity: 0, rep: 2 },
    { text: "is a complete arsehole", tone: "defamatory", severity: 3, rep: -4, defame: true },
    { text: "is a beautiful human", tone: "nice", severity: 0, rep: 2 },
    { text: "is a utter muppet", tone: "defamatory", severity: 1, rep: -1, defame: true },
    { text: "is a top lad", tone: "nice", severity: 0, rep: 1 },
    { text: "is a complete tosser", tone: "defamatory", severity: 2, rep: -3, defame: true },
    { text: "is absolutely brilliant", tone: "nice", severity: 0, rep: 2 },
    { text: "is a fucking wanker", tone: "defamatory", severity: 3, rep: -5, defame: true },
    { text: "is a proper legend", tone: "nice", severity: 0, rep: 2 },
    { text: "is a complete mess", tone: "defamatory", severity: 2, rep: -2, defame: true },
    { text: "is an absolute star", tone: "nice", severity: 0, rep: 2 },
    { text: "is a total knob", tone: "defamatory", severity: 2, rep: -3, defame: true },
    { text: "is a lovely bloke", tone: "nice", severity: 0, rep: 1 },
    { text: "is a utter pillock", tone: "defamatory", severity: 1, rep: -1, defame: true }
  ];
  
  // Show 7 random operants
  const shuffledOperants = OPERANTS.sort(() => 0.5 - Math.random()).slice(0, 7);
  const phrase = await choose(shuffledOperants.map((p, i) => ({ key: i, label: p.text })), 'Complete your thought:');
  const selectedPhrase = shuffledOperants[phrase];
  
  // Create the exact quote verbatim
  const quote = `${targetData.name} ${selectedNoun} ${selectedPhrase.text}.`;
  
  // Create and publish story immediately with verbatim quote
  const story = createStory(
    'gossip',
    'Chairman Comments on {target}',
    'The Southampton chairman was asked about {target} today. "{quote}" The comments have sparked discussion in football circles.',
    {
      target: targetData.name,
      quote: quote
    },
    { reputation: selectedPhrase.rep },
    'pressCall',
    selectedPhrase.severity,
    selectedPhrase.defame ? ['defame'] : []
  );
  
  publishStory(story);
  
  // Schedule lawsuit if defamatory
  if (selectedPhrase.defame) {
    scheduleDefamationLawsuit(selectedPhrase.severity, targetData.name);
    
    // If defaming a player, queue manager confrontation
    if (targetData.type === 'player' || target.startsWith('player_')) {
      queueManagerConfrontation(targetData);
    }
  }
  
  log(`<strong>📰 Story published:</strong> Your comments are now public.`);
}

// General press call (prior/upcoming match)
async function takePressCallGeneral(topic) {
  const quotes = [
    "We're focused on getting the best result possible.",
    "The team is in good spirits and ready to compete.",
    "Every match is important in this league.",
    "We'll see what happens on the day.",
    "The fans deserve our best effort.",
    "It's all about the three points.",
    "We respect our opponents but we're here to win."
  ];
  
  const quote = await choose(quotes.map((q, i) => ({ key: i, label: q })), 'What do you say?');
  const selectedQuote = quotes[quote];
  
  const story = createStory(
    'sports',
    'Southampton Manager Speaks on {topic}',
    'In a brief press conference, the Southampton manager addressed questions about {topic}. "{quote}"',
    {
      topic: topic === 'prior' ? 'recent performance' : 'upcoming fixture',
      quote: selectedQuote
    },
    { reputation: 1 },
    'pressCall',
    0,
    []
  );
  
  publishStory(story);
  log(`<strong>📰 Story published:</strong> Your statement is now public.`);
}

// New press call system with context-sensitive categories
async function takePressCallGeneralNew(topic) {
  log(`<strong>📞 Press Call:</strong> A journalist calls for a quote about ${topic === 'prior' ? 'the last match' : 'the upcoming match'}.`);
  
  // Determine match result context
  let matchContext = 'neutral';
  if (topic === 'prior' && S.lastMatchResult) {
    if (S.lastMatchResult === 'win') matchContext = 'win';
    else if (S.lastMatchResult === 'loss') matchContext = 'loss';
    else if (S.lastMatchResult === 'draw') matchContext = 'draw';
  }
  
  // Build context-sensitive categories
  const baseCategories = ['angry', 'appropriate', 'conspiratorial', 'weird', 'cliche', 'lecherous'];
  let availableCategories = [...baseCategories];
  
  // Add context-specific categories
  if (matchContext === 'win') {
    availableCategories.push('triumphant', 'humble');
  } else if (matchContext === 'loss') {
    availableCategories.push('delusional', 'defensive');
  } else if (matchContext === 'draw') {
    availableCategories.push('frustrated', 'optimistic');
  }
  
  // Quote construction system for press calls
  const PRESS_CALL_QUOTES = {
    angry: {
      openings: [
        "I'm absolutely furious about this situation.",
        "This is completely unacceptable.",
        "I'm not happy with how things are going.",
        "This is a fucking disgrace.",
        "I'm sick and tired of this nonsense.",
        "This is absolutely ridiculous."
      ],
      subjects: [
        "The team needs to wake up and start performing.",
        "We're not getting the respect we deserve.",
        "This is not the standard we expect.",
        "We need to stop making excuses.",
        "The players need to take responsibility.",
        "This is completely unacceptable behavior."
      ],
      closings: [
        "We need to sort this out immediately.",
        "This cannot continue.",
        "I will not accept this level of performance.",
        "We need to make changes right now.",
        "This is not good enough.",
        "We need to do better."
      ]
    },
    appropriate: {
      openings: [
        "We're focused on getting the best result possible.",
        "The team is in good spirits and ready to compete.",
        "Every match is important in this league.",
        "We'll see what happens on the day.",
        "The fans deserve our best effort.",
        "It's all about the three points."
      ],
      subjects: [
        "We respect our opponents but we're here to win.",
        "The team has been working hard in training.",
        "We need to be at our best to get a result.",
        "The players are ready for the challenge.",
        "We have a good group of players here.",
        "We're confident in our abilities."
      ],
      closings: [
        "We'll give it our all.",
        "The fans can expect a good performance.",
        "We're ready for whatever comes our way.",
        "We'll do our best to get the result.",
        "The team is prepared and focused.",
        "We're looking forward to the challenge."
      ]
    },
    conspiratorial: {
      openings: [
        "There's more to this than meets the eye.",
        "I've seen this pattern before.",
        "Something's not right here.",
        "The timing is very suspicious.",
        "I don't trust the official story.",
        "There are forces at work here."
      ],
      subjects: [
        "The refs are clearly biased against us.",
        "The FA has it in for Southampton.",
        "There's a conspiracy to keep us down.",
        "The media is against us.",
        "Big clubs are pulling strings.",
        "The system is rigged against us."
      ],
      closings: [
        "The truth will come out eventually.",
        "We won't be silenced.",
        "People will see what's really happening.",
        "We're fighting against the system.",
        "The conspiracy will be exposed.",
        "We won't let them win."
      ]
    },
    weird: {
      openings: [
        "I can hear the grass whispering.",
        "The goalposts are cursed.",
        "I feel like my bones are humming.",
        "The air tastes metallic.",
        "I can hear the floodlights whispering.",
        "The ball knew before we did."
      ],
      subjects: [
        "The pitch is alive and angry.",
        "The goalposts are moving when you're not looking.",
        "I can hear the crowd's thoughts.",
        "The ball is trying to tell us something.",
        "The stadium is breathing.",
        "I can see the future in the grass patterns."
      ],
      closings: [
        "The moon will guide us to victory.",
        "Listen to what the grass is telling you.",
        "The goalposts will open for us.",
        "I can hear the future calling.",
        "The stadium spirits are on our side.",
        "Trust in the cosmic football energy."
      ]
    },
    cliche: {
      openings: [
        "It's important that we score goals.",
        "At the end of the day, football is a game of two halves.",
        "We need to take it one game at a time.",
        "The lads gave 110% out there.",
        "It's a results business.",
        "We'll take the positives and move on."
      ],
      subjects: [
        "The most important thing is the three points.",
        "We need to be more clinical in front of goal.",
        "The boys worked their socks off.",
        "It's all about character and determination.",
        "We need to be more ruthless in both boxes.",
        "The fans deserve better than this."
      ],
      closings: [
        "We go again next week.",
        "That's football for you.",
        "We'll learn from this and come back stronger.",
        "The table doesn't lie.",
        "We need to stick together as a group.",
        "There's still a long way to go in the season."
      ]
    },
    lecherous: {
      openings: [
        "You know, you have the most beautiful eyes I've ever seen.",
        "I'd love to take you out for dinner sometime.",
        "You're absolutely stunning, has anyone ever told you that?",
        "I can't concentrate with you looking so gorgeous.",
        "You remind me of my first wife... before the divorce.",
        "I'd love to see you in something more... revealing."
      ],
      subjects: [
        "You know what they say about men in power... we're very... persuasive.",
        "I could make you very happy, if you know what I mean.",
        "You should come to my office sometime, I have a very comfortable... couch.",
        "I've always had a thing for journalists, especially beautiful ones like you.",
        "You're making me forget what we were talking about.",
        "I'd love to show you my... trophy collection."
      ],
      closings: [
        "Call me sometime, beautiful.",
        "I'd love to continue this conversation in private.",
        "You're welcome to interview me anytime... anywhere.",
        "I think we have a real connection here.",
        "Maybe we could grab a drink after this?",
        "I'd love to get to know you better... much better."
      ]
    },
    triumphant: {
      openings: [
        "What a fantastic result for the club.",
        "I'm absolutely delighted with that performance.",
        "The lads were magnificent out there.",
        "That's exactly what we needed.",
        "I couldn't be prouder of the team.",
        "What a way to respond to the critics."
      ],
      subjects: [
        "We showed everyone what we're capable of.",
        "The players executed the game plan perfectly.",
        "We proved the doubters wrong.",
        "This is the Southampton way.",
        "We're back where we belong.",
        "The fans were incredible today."
      ],
      closings: [
        "This is just the beginning.",
        "We're going to build on this momentum.",
        "The future is bright for this club.",
        "We're not stopping here.",
        "This is what we're all about.",
        "We're going to keep pushing forward."
      ]
    },
    humble: {
      openings: [
        "We're pleased with the result, but we know we can do better.",
        "It's a good three points, but we're not getting carried away.",
        "We're happy with the win, but there's still work to do.",
        "It's nice to get the result, but we need to keep improving.",
        "We're satisfied with the performance, but we can be better.",
        "It's a step in the right direction, but we need to keep going."
      ],
      subjects: [
        "We respect our opponents and know they'll be back stronger.",
        "We're grateful for the support from the fans.",
        "We know we have to keep working hard.",
        "We're not taking anything for granted.",
        "We appreciate the effort from everyone involved.",
        "We know we have to keep our feet on the ground."
      ],
      closings: [
        "We'll enjoy this but stay focused.",
        "We need to keep the momentum going.",
        "We'll celebrate but not get complacent.",
        "We need to keep pushing forward.",
        "We'll take confidence from this but keep working.",
        "We need to maintain our standards."
      ]
    },
    delusional: {
      openings: [
        "That result was actually part of our master plan.",
        "We're exactly where we want to be in the table.",
        "This is all part of a deeper strategy.",
        "We're playing the long game here.",
        "This result will actually help us in the long run.",
        "We're building something special here."
      ],
      subjects: [
        "The other teams will underestimate us now.",
        "We're lulling the opposition into a false sense of security.",
        "This is all part of our psychological warfare.",
        "We're setting up for a dramatic comeback.",
        "The fans will appreciate this more later.",
        "We're creating a narrative that will pay off."
      ],
      closings: [
        "You'll see the genius of this plan soon.",
        "This is all part of the bigger picture.",
        "We're playing chess while they play checkers.",
        "The real Southampton will emerge when it matters.",
        "This is all part of our master strategy.",
        "You'll understand our brilliance eventually."
      ]
    },
    defensive: {
      openings: [
        "The result doesn't reflect our performance.",
        "We were unlucky not to get something from the game.",
        "The scoreline flatters the opposition.",
        "We had more possession and chances.",
        "The referee's decisions cost us the game.",
        "We were the better team on the day."
      ],
      subjects: [
        "The players gave everything they had.",
        "We created enough chances to win the game.",
        "The opposition got lucky with their goals.",
        "We were unfortunate with the timing of their goals.",
        "The players can hold their heads high.",
        "We were competitive throughout the match."
      ],
      closings: [
        "We'll bounce back from this.",
        "The players are determined to put this right.",
        "We'll learn from this and come back stronger.",
        "This result will motivate us to do better.",
        "We're not going to let this define our season.",
        "We'll use this as fuel for the next game."
      ]
    },
    frustrated: {
      openings: [
        "We should have won that game.",
        "It's frustrating to drop points like that.",
        "We had enough chances to win comfortably.",
        "It's disappointing not to get all three points.",
        "We're frustrated with the result.",
        "That was two points dropped, not one gained."
      ],
      subjects: [
        "We need to be more clinical in front of goal.",
        "We're creating chances but not taking them.",
        "We need to be more ruthless in both boxes.",
        "We're not getting the rub of the green.",
        "We need to be more decisive in key moments.",
        "We're not getting the breaks we deserve."
      ],
      closings: [
        "We need to start converting our chances.",
        "We'll work on our finishing in training.",
        "We need to be more clinical.",
        "We'll keep working to improve.",
        "We need to start taking our opportunities.",
        "We'll get it right next time."
      ]
    },
    optimistic: {
      openings: [
        "It's a point gained, not two lost.",
        "We're still unbeaten and that's important.",
        "We showed good character to come back.",
        "It's a solid result away from home.",
        "We're building momentum with each game.",
        "We're in a good position in the table."
      ],
      subjects: [
        "The players showed great spirit.",
        "We're getting stronger with each game.",
        "We're creating chances and that's positive.",
        "The team is gelling well together.",
        "We're playing good football.",
        "We're on the right track."
      ],
      closings: [
        "We'll keep building on this.",
        "We're moving in the right direction.",
        "We'll keep pushing forward.",
        "We're confident about the future.",
        "We'll keep improving.",
        "We're excited about what's to come."
      ]
    }
  };
  
  // Step 1: Opening category
  const openingCategory = await choose(
    availableCategories.map(cat => ({key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to start your response?'
  );
  
  // Step 2: Subject category
  const subjectCategory = await choose(
    availableCategories.map(cat => ({key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'What do you want to say about the match?'
  );
  
  // Step 3: Closing category
  const closingCategory = await choose(
    availableCategories.map(cat => ({key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to conclude?'
  );
  
  // Randomly select quotes from chosen categories
  const openingIndex = Math.floor(Math.random() * PRESS_CALL_QUOTES[openingCategory].openings.length);
  const selectedOpening = PRESS_CALL_QUOTES[openingCategory].openings[openingIndex];
  
  const subjectIndex = Math.floor(Math.random() * PRESS_CALL_QUOTES[subjectCategory].subjects.length);
  const selectedSubject = PRESS_CALL_QUOTES[subjectCategory].subjects[subjectIndex];
  
  const closingIndex = Math.floor(Math.random() * PRESS_CALL_QUOTES[closingCategory].closings.length);
  const selectedClosing = PRESS_CALL_QUOTES[closingCategory].closings[closingIndex];
  
  // Assemble the quote
  const fullQuote = `${selectedOpening} ${selectedSubject} ${selectedClosing}`;
  
  log(`<strong>📞 Your response:</strong> "${fullQuote}"`);
  
  // Apply consequences based on tone combinations
  applyPressCallConsequences(openingCategory, subjectCategory, closingCategory, fullQuote, topic);
  
  // Create and publish story
  const story = createStory(
    'sports',
    'Southampton Manager Speaks on {topic}',
    'In a brief press conference, the Southampton manager addressed questions about {topic}. "{quote}"',
    {
      topic: topic === 'prior' ? 'recent performance' : 'upcoming fixture',
      quote: fullQuote
    },
    { reputation: 1 },
    'pressCall',
    0,
    []
  );
  
  publishStory(story);
  log(`<strong>📰 Story published:</strong> Your statement is now public.`);
}

// Apply consequences for press call quotes
function applyPressCallConsequences(openingCategory, subjectCategory, closingCategory, fullQuote, topic) {
  const categories = [openingCategory, subjectCategory, closingCategory];
  const lecherousCount = categories.filter(c => c === 'lecherous').length;
  const delusionalCount = categories.filter(c => c === 'delusional').length;
  const conspiratorialCount = categories.filter(c => c === 'conspiratorial').length;
  const clicheCount = categories.filter(c => c === 'cliche').length;
  
  // Lecherous: dangerous for reputation and triggers krazy register
  if (lecherousCount >= 1) {
    S.reputation = Math.max(0, (S.reputation || 50) - 8);
    S.krazy_register = (S.krazy_register || 0) + (lecherousCount * 12);
    log(`📉 Reputation -8% (Inappropriate behavior)`);
    log(`⚠️ Krazy Register +${lecherousCount * 12} (Sexual harassment concerns)`);
    
    // Check if krazy register threshold reached
    if (S.krazy_register >= 100) {
      log(`🚨 KRAZY REGISTER TRIGGERED! You've been flagged for inappropriate behavior.`);
      S.legal_risk = (S.legal_risk || 0) + 40;
      S.fa_risk = (S.fa_risk || 0) + 60;
      log(`⚖️ Legal risk +40, FA risk +60 (Sexual harassment investigation)`);
    }
  }
  
  // Delusional: confuses fans and media
  if (delusionalCount >= 2) {
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 5);
    S.reputation = Math.max(0, (S.reputation || 50) - 8);
    log(`📉 Fan morale -5%, Reputation -8% (Delusional statements)`);
  }
  
  // Conspiratorial: creates controversy
  if (conspiratorialCount >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 3);
    S.legal_risk = (S.legal_risk || 0) + 15;
    S.fa_risk = (S.fa_risk || 0) + 20;
    log(`📈 Fan morale +3% (Fans love conspiracy theories)`);
    log(`⚖️ Legal risk +15, FA risk +20 (Defamation concerns)`);
  }
  
  // Cliche: boring but safe
  if (clicheCount >= 2) {
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 1);
    S.reputation = Math.min(100, (S.reputation || 50) + 1);
    log(`📉 Fan morale -1% (Boring response)`);
    log(`📈 Reputation +1% (Safe and predictable)`);
  }
}


// View archive
async function viewArchive() {
  if (!S.press.published || S.press.published.length === 0) {
    log(`No stories in archive yet.`);
    return;
  }
  
  log(`<strong>📚 Archive:</strong> Last ${Math.min(10, S.press.published.length)} published stories:`);
  
  const recentStories = S.press.published.slice(-10).reverse();
  for (const story of recentStories) {
    log(`<strong>${story.section.toUpperCase()}:</strong> ${story.headline}`);
    log(`By ${story.writer} — ${new Date(story.publishedAt).toLocaleDateString()}`);
    log(story.body);
    log('---');
  }
}

// Watch naughty videos - the main function
async function watchNaughtyVideos() {
  // Check for cooldown
  if (S.videoCooldown && S.videoCooldown > 0) {
    log(`Your ISP is buffering... Try again after the next match.`);
    return;
  }
  
  // Debounce protection
  if (S.videoWatching) {
    log(`Already watching a video...`);
    return;
  }
  
  // Stop general background music for train collision videos
  if (typeof window._stopGeneralMusic === 'function') {
    window._stopGeneralMusic();
  } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
    generalMusicAudio.pause();
  }
  
  // Also pause opening music if playing
  const openingMusic = document.getElementById('openingMusic');
  if (openingMusic && !openingMusic.paused) {
    openingMusic.pause();
  }
  
  S.videoWatching = true;
  
  // Trigger pornography achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'watched_pornography')) {
    const achievement = {
      id: 'watched_pornography',
      title: 'Watched Pornography',
      description: 'Watched pornography (when you watch a naughty video)',
      icon: '📹'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
    if (window.stateManager) window.stateManager.saveAchievement(achievement);
  }
  
  try {
    log(`<strong>💻 Private Video:</strong> You open a questionable website...`);
    
    // Open the video viewer
    _openVideoViewer();
    
    // Animate the crude video
    await _animateNaughtyVideo();
    
    // Close the viewer
    _closeVideoViewer();
    
    // Apply the financial penalty
    _applyVideoPenalty();
    
    // Set cooldown (1 match)
    S.videoCooldown = 1;
    
  } finally {
    S.videoWatching = false;
  }
}

// Open video viewer modal
function _openVideoViewer() {
  const modal = document.getElementById('videoViewer');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

// Close video viewer modal
function _closeVideoViewer() {
  const modal = document.getElementById('videoViewer');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Animate the crude video
async function _animateNaughtyVideo() {
  return new Promise(resolve => {
    const modal = document.getElementById('videoViewer');
    const canvas = document.getElementById('videoCanvas');
    const ticker = document.getElementById('videoTicker');
    const caption = document.getElementById('videoCaption');
    const skipBtn = document.getElementById('skipVideoBtn');
    const closeBtn = document.getElementById('closeVideoViewerBtn');
    
    if (!canvas) {
      console.warn('videoCanvas not found');
      return resolve();
    }
    
    const ctx = canvas.getContext('2d');
    const startTime = Date.now();
    const duration = 7000; // 7 seconds
    let canSkip = false;
    let resolved = false;
    
    // Video scenarios
    const scenarios = [
      {
        name: "Man and Woman Collision",
        actors: [
          { type: 'man', x: 100, y: 180, color: '#4a90e2', size: 30 },
          { type: 'woman', x: 540, y: 180, color: '#e24a90', size: 30 }
        ],
        captions: [
          "Loading...",
          "Two people meet...",
          "They're getting closer...",
          "Making contact...",
          "Vibrating intensely...",
          "That was... something!"
        ]
      },
      {
        name: "Two Men Colliding with Woman",
        actors: [
          { type: 'man', x: 100, y: 180, color: '#4a90e2', size: 30 },
          { type: 'woman', x: 320, y: 180, color: '#e24a90', size: 30 },
          { type: 'man', x: 540, y: 180, color: '#2e8b57', size: 30 }
        ],
        captions: [
          "Loading...",
          "Three people walking...",
          "They're all getting close...",
          "Making contact...",
          "Vibrating intensely...",
          "That was... chaotic!"
        ]
      },
      {
        name: "Two Women Colliding with Man",
        actors: [
          { type: 'woman', x: 100, y: 180, color: '#e24a90', size: 30 },
          { type: 'man', x: 320, y: 180, color: '#4a90e2', size: 30 },
          { type: 'woman', x: 540, y: 180, color: '#ff69b4', size: 30 }
        ],
        captions: [
          "Loading...",
          "Busy intersection...",
          "Everyone's getting close...",
          "Making contact...",
          "Vibrating intensely...",
          "That was... overwhelming!"
        ]
      },
      {
        name: "Five Men Colliding with Woman",
        actors: [
          { type: 'man', x: 80, y: 180, color: '#4a90e2', size: 25 },
          { type: 'man', x: 180, y: 180, color: '#2e8b57', size: 25 },
          { type: 'woman', x: 320, y: 180, color: '#e24a90', size: 30 },
          { type: 'man', x: 460, y: 180, color: '#8b4513', size: 25 },
          { type: 'man', x: 560, y: 180, color: '#ff6347', size: 25 }
        ],
        captions: [
          "Loading...",
          "Crowded street...",
          "Everyone's getting close...",
          "Making contact...",
          "Vibrating intensely...",
          "That was... insane!"
        ]
      }
    ];
    
    // Pick random scenario
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    let currentCaption = 0;
    
    // Animation loop
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw actors with collision animation
      scenario.actors.forEach((actor, index) => {
        let x = actor.x;
        let y = actor.y;
        
        // Intimate collision animation - actors touch and vibrate
        if (progress > 0.2) {
          const centerX = canvas.width / 2;
          
          // Move to center for actual contact
          const closeness = Math.min((progress - 0.2) * 1.5, 1);
          const targetX = centerX + (actor.x - centerX) * (1 - closeness);
          
          // Add intense vibration when touching (progress > 0.5)
          if (progress > 0.5) {
            const vibratePhase = (progress - 0.5) * 30;
            const vibrateIntensity = Math.min((progress - 0.5) * 2, 1) * 6;
            const vibrateX = Math.sin(vibratePhase) * vibrateIntensity;
            const vibrateY = Math.cos(vibratePhase * 1.3) * (vibrateIntensity * 0.7);
            
            x = targetX + vibrateX;
            y = y + vibrateY;
          } else {
            // Gentle approach before contact
            const approachPhase = (progress - 0.2) * 10;
            const approachX = Math.sin(approachPhase) * 3;
            const approachY = Math.cos(approachPhase * 0.8) * 2;
            
            x = targetX + approachX;
            y = y + approachY;
          }
        }
        
        // Draw humanoid stick figure
        ctx.strokeStyle = actor.color;
        ctx.fillStyle = actor.color;
        ctx.lineWidth = 3;
        
        // Head (circle)
        ctx.beginPath();
        ctx.arc(x, y - 25, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Face features
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 4, y - 30, 8, 6);
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 2, y - 28, 2, 2); // left eye
        ctx.fillRect(x + 1, y - 28, 2, 2); // right eye
        ctx.fillRect(x - 1, y - 25, 2, 2); // mouth
        
        // Hair (different for men vs women)
        ctx.strokeStyle = actor.type === 'woman' ? '#8B4513' : '#654321';
        ctx.lineWidth = 2;
        if (actor.type === 'woman') {
          // Long hair for women
          ctx.beginPath();
          ctx.arc(x, y - 25, 15, Math.PI, 0, false);
          ctx.stroke();
          // Hair strands
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x - 10 + i * 4, y - 25);
            ctx.lineTo(x - 12 + i * 4, y - 15);
            ctx.stroke();
          }
        } else {
          // Short hair for men
          ctx.beginPath();
          ctx.arc(x, y - 25, 12, Math.PI, 0, false);
          ctx.stroke();
        }
        
        // Body (stick figure)
        ctx.strokeStyle = actor.color;
        ctx.lineWidth = 3;
        
        // Torso
        ctx.beginPath();
        ctx.moveTo(x, y - 13);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
        
        // Arms
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x - 15, y + 5);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x + 15, y + 5);
        ctx.stroke();
        
        // Legs
        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x - 12, y + 30);
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x + 12, y + 30);
        ctx.stroke();
        
        // Bust outline for women
        if (actor.type === 'woman') {
          ctx.strokeStyle = actor.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(x, y - 2, 8, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Animal tail for men (protruding from between legs)
        if (actor.type === 'man') {
          ctx.strokeStyle = '#8B4513'; // Brown tail
          ctx.lineWidth = 3;
          ctx.beginPath();
          // Tail starts from the meeting point of the legs (where they connect to torso)
          ctx.moveTo(x, y + 10);
          ctx.lineTo(x + 12, y + 15);
          ctx.lineTo(x + 18, y + 20);
          ctx.lineTo(x + 20, y + 25);
          ctx.stroke();
        }
      });
      
      // Update caption
      const captionIndex = Math.floor(progress * scenario.captions.length);
      if (captionIndex !== currentCaption && captionIndex < scenario.captions.length) {
        currentCaption = captionIndex;
        caption.textContent = scenario.captions[captionIndex];
      }
      
      // Update ticker
      const seconds = Math.floor(elapsed / 1000);
      const ms = Math.floor((elapsed % 1000) / 100);
      ticker.textContent = `${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
      
      // Enable skip after 2 seconds
      if (elapsed > 2000 && !canSkip) {
        canSkip = true;
        skipBtn.disabled = false;
        skipBtn.style.opacity = '1';
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Add white paint splat effect at the end
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        
        // Create a paint splat pattern with multiple overlapping circles
        const splatCenters = [
          { x: 320, y: 180, radius: 80 },
          { x: 280, y: 160, radius: 45 },
          { x: 360, y: 160, radius: 45 },
          { x: 300, y: 200, radius: 35 },
          { x: 340, y: 200, radius: 35 },
          { x: 320, y: 140, radius: 30 },
          { x: 320, y: 220, radius: 30 }
        ];
        
        splatCenters.forEach(splat => {
          ctx.beginPath();
          ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Add some paint drips
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 8; i++) {
          const dripX = 280 + Math.random() * 80;
          const dripY = 220 + Math.random() * 40;
          const dripWidth = 3 + Math.random() * 4;
          const dripHeight = 10 + Math.random() * 20;
          
          ctx.fillRect(dripX, dripY, dripWidth, dripHeight);
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
        
        // Show final message
        caption.textContent = "The site you used stole your credit card info.";
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 1000);
      }
    }
    
    // Skip button handler
    skipBtn.onclick = () => {
      if (canSkip && !resolved) {
        resolved = true;
        
        // Add white paint splat effect when skipping
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        
        // Create a paint splat pattern with multiple overlapping circles
        const splatCenters = [
          { x: 320, y: 180, radius: 80 },
          { x: 280, y: 160, radius: 45 },
          { x: 360, y: 160, radius: 45 },
          { x: 300, y: 200, radius: 35 },
          { x: 340, y: 200, radius: 35 },
          { x: 320, y: 140, radius: 30 },
          { x: 320, y: 220, radius: 30 }
        ];
        
        splatCenters.forEach(splat => {
          ctx.beginPath();
          ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Add some paint drips
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 8; i++) {
          const dripX = 280 + Math.random() * 80;
          const dripY = 220 + Math.random() * 40;
          const dripWidth = 3 + Math.random() * 4;
          const dripHeight = 10 + Math.random() * 20;
          
          ctx.fillRect(dripX, dripY, dripWidth, dripHeight);
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
        
        caption.textContent = "The site you used stole your credit card info.";
        setTimeout(() => resolve(), 500);
      }
    };
    
    // Close button handler
    closeBtn.onclick = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    
    // Start animation
    skipBtn.disabled = true;
    skipBtn.style.opacity = '0.5';
    animate();
  });
}

// Apply the financial penalty
function _applyVideoPenalty() {
  const penalty = 20000;
  let deductedFromChairman = 0;
  let deductedFromClub = 0;
  
  // Deduct from chairman_cash first
  if (S.chairman_cash >= penalty) {
    S.chairman_cash -= penalty;
    deductedFromChairman = penalty;
  } else {
    // Deduct what we can from chairman_cash
    deductedFromChairman = S.chairman_cash;
    S.chairman_cash = 0;
    
    // Deduct remainder from club_cash
    const remainder = penalty - deductedFromChairman;
    if (S.club_cash >= remainder) {
      S.club_cash -= remainder;
      deductedFromClub = remainder;
    } else {
      deductedFromClub = S.club_cash;
      S.club_cash = 0;
    }
  }
  
  // Log the penalty
  let logMessage = `💳 <strong>Credit Card Fraud:</strong> £${penalty.toLocaleString('en-GB')} stolen from your accounts.`;
  if (deductedFromChairman > 0) {
    logMessage += ` Personal: -£${deductedFromChairman.toLocaleString('en-GB')}`;
  }
  if (deductedFromClub > 0) {
    logMessage += ` Club: -£${deductedFromClub.toLocaleString('en-GB')}`;
  }
  
  log(logMessage);
  updateHUD?.();
}

// Story generators for each section
// Politics section - real news articles from attached files
function generatePoliticsStory() {
  const stories = [
    {
      headline: 'Sunak\'s Desperate Move: Election Cancellation Over Bomb Threat Sparks Controversy',
      body: 'In an unprecedented and controversial move, Prime Minister Rishi Sunak has called for the next general election to be postponed indefinitely, citing a bomb threat that he claims poses a significant risk to national security. This decision, announced late last night, has sent shockwaves through the political landscape, raising questions about the motivations and legitimacy behind the delay.\n\nThe Bomb Threat and Government\'s Response\n\nAccording to Sunak, intelligence agencies have identified a credible threat that necessitates postponing the election for at least five years to ensure public safety. The Prime Minister emphasized the need for extreme caution, arguing that the safety of the British people must come before political processes.\n\n"Given the severity and credibility of this threat, it is imperative that we take all necessary precautions to protect our citizens," Sunak stated in his address to the nation. "The decision to postpone the election is not taken lightly but is necessary to maintain national security."',
      effects: { reputation: -2 }
    },
    {
      headline: 'Chancellor Jeremy Hunt Uploads Self-Harm Video After Policy Criticism',
      body: 'In a video that has sent shockwaves through the UK, Chancellor Jeremy Hunt uploaded a video of himself harming himself after being critiqued for his economic policies.\n\n"I\'m fed up of being criticized for my policies," he said in the video. "If the public don\'t like them, then they can go ahead and criticize me all they want - but I\'ll keep harming myself until they stop."\n\nThe video has sparked outrage among many in the UK, who feel that Hunt is using self-harm as a way to manipulate the public.\n\n"This is a disgraceful way to treat the public," said one critic. "Hunt should be ashamed of himself."\n\nHunt has responded to the criticism by threatening to harm himself again if the public doesn\'t stop criticizing him.\n\n"I\'ll do it again and again until you stop," he said. "So just shut up and leave me alone."',
      effects: { reputation: -3 }
    },
    {
      headline: 'Conservative Party Announces Plans to Replace Treasury with Department of Telly',
      body: 'The Conservative Party has announced plans to bring about the biggest political reform in 200 years, abolishing the role of Chancellor of the Exchequer and the Department of the Treasury, and replacing them with the department of Telly, the main purpose of which will be to ensure that everyone watches much more television, ensuring that every room of every household has at least three televisions, and a new gameshow called "battle of the morons" which has a weekly cash prize of £50 billion.\n\nCritics have labelled the plans as ludicrous and irresponsible, and have questioned how a government department whose only purpose is to watch television can be justified when there are so many other pressing issues that need to be addressed. They argue that the prize money for "battle of the morons" is far too high, and that it is nothing more than a glorified lottery that will line the pockets of the wealthy few.\n\nSo what is "battle of the morons"? It is a new gameshow that will pit two teams of morons against each other in a battle of wits to see who can answer the most questions correctly. The team that wins will be awarded the £50 billion prize money, which is more than the GDP of many small countries.\n\nCritics argue that the show is nothing more than a waste of time and money, and that the prize money could be put to better use. They say that the money could be used to fund schools, hospitals, and other essential services, or to reduce the national debt.\n\nThe Conservative Party has defended the plans, arguing that they will bring about much-needed change and that the department of Telly will be a vital part of the new government. They say that the department will not only ensure that everyone watches more television, but that it will also help to boost the economy by creating new jobs and generating revenue.\n\nSo what do you think? Is the department of Telly a good idea, or is it a waste of money?',
      effects: { reputation: -1 }
    },
    {
      headline: 'Government Announces Plan to Nuke Antarctica',
      body: 'In a bid to distract from the cost of living crisis, the government has announced a plan to nuke Antarctica.\n\nThe scheme, which is expected to cost £2 billion, will see a nuclear weapon detonated at the South Pole. The government says the explosion will create a massive crater, which will be filled with water from the ocean. This will then freeze, creating a new continent.\n\nThe government is hoping that the scheme will cheer everyone up, and take their minds off the cost of living crisis. Some female scientists have condemned the plan, but most real scientists recognise the benefits. Nuclear physicist Dr. Jameson said, "This is a fantastic opportunity to study the effects of a nuclear explosion on the Antarctic ice sheet. It will also be great for morale — everyone will be excited to see the explosion, and it will give us something to talk about besides the cost of living crisis."\n\nOthers have criticised the plan, saying that it is a waste of money that could be better spent on other things.\n\nBut Minister for Distractions, Jeremy Corbyn, said, "This is a vital project that will benefit the nation as a whole. It is important that we all take a break from the everyday stress of life, and what could be more fun than watching a nuclear explosion?"\n\nThe government is currently looking for volunteers to help with the project. If you are interested in taking part, please contact your local MP.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Keir Starmer\'s Hot Mic Remark Gives Labour Unexpected Poll Boost',
      body: 'London, UK — July 2, 2024 — In an unexpected twist, Labour leader Keir Starmer\'s shocking hot mic remark to his pregnant wife has given the party a surprising boost in the polls. The incident, which could have derailed any other campaign, appears to have made Starmer seem more relatable to key "red wall" voters and even rendered him an unlikely sex symbol.\n\nThe Incident\n\nThe controversial moment occurred when a nearby microphone picked up Starmer in a private conversation with his pregnant wife, in which he was heard saying, "I\'ll kick that fucking baby out of you," after she complained about being hungry. Despite the violent and offensive nature of the remark, the reaction has been anything but typical.\n\nLabour\'s Unexpected Poll Boost\n\nInstead of condemning Starmer, many voters in traditionally Labour-leaning areas have rallied behind him. The bluntness of his remark has resonated with some, who see it as a sign of his down-to-earth nature. Early polls show a noticeable uptick in Labour support following the incident.\n\nStarmer as an Unlikely Sex Symbol\n\nIn a surprising development, Starmer has also become an unlikely sex symbol. Female voters have described feeling "hot under the collar" after hearing the remark. One woman was quoted as saying, "I wouldn\'t mind him kicking one out of me," highlighting the bizarre allure that has added to Starmer\'s unexpected appeal.\n\nAngela Rayner\'s Response\n\nLabour Deputy Leader Angela Rayner added to the unexpected twist by joking about the incident on a BBC breakfast show. "Well, at least we know Keir\'s passionate about everything," Rayner quipped, laughing with the hosts. Her lighthearted take on the matter seemed to further endear the Labour leadership to voters who value authenticity.\n\nLabour\'s Marketing Move\n\nIn a bold move, the Labour Party has launched a line of T-shirts emblazoned with the controversial quote, "Vote Labour - or I\'ll kick that fucking baby out of you." The merchandise has been flying off the shelves, becoming an unlikely campaign tool that underscores Labour\'s new, raw appeal.\n\nConservative Party Scramble\n\nThe Conservative Party, caught off guard by the public\'s reaction, is scrambling to imitate Labour\'s unexpected success. However, their efforts backfired spectacularly. Prime Minister Rishi Sunak was caught on a hot mic calling his wife a "cow," resulting in widespread condemnation and accusations of misogyny. The public reaction was swift and harsh, leading to a significant drop in the polls.\n\nPublic and Political Reactions\n\nPublic reactions remain deeply divided. While some are appalled by the normalization of such violent language, others appreciate the perceived authenticity. One man was quoted as saying, "Why can\'t he be more like Starmer? Sunak\'s a vile man."\n\nAngela Rayner on Sunak\'s Incident\n\nAngela Rayner capitalized on Sunak\'s blunder, appearing on multiple talk shows to discuss why what Sunak did was much worse "for many crazy reasons." She pointed out the misogynistic undertones of Sunak\'s remark and how it reflects poorly on his character, contrasting it with Starmer\'s perceived authenticity.\n\nLooking Ahead\n\nAs the general election approaches, both parties are navigating unprecedented territory. Labour is riding a wave of unconventional momentum, while the Conservatives struggle to regain their footing. The full impact of this scandal-cum-momentum for Labour will become clearer as election day draws near, but for now, Starmer\'s unexpected boost in the polls suggests that in today\'s political climate, even the most controversial moments can become unlikely sources of strength.',
      effects: { reputation: 1 }
    },
    {
      headline: 'Keir Starmer\'s Labour Landslide in Jeopardy Amid Scandal Over Disturbing Video Incident',
      body: 'In a shocking turn of events, Keir Starmer\'s resounding Labour landslide victory is facing an unprecedented threat following a deeply disturbing incident involving a video shown to horrified Conservative MPs. The controversy erupted after Starmer was seen laughing while showing a video on his phone titled "Boy with Down syndrome tragically crushed by meat grinder." The video graphically depicted the tragic death of a boy with Down syndrome in a factory meat grinder.\n\nThe incident occurred during what was supposed to be a routine cross-party meeting. Eyewitnesses reported visible distress among Conservative MPs as the gruesome footage played. The backlash was immediate, with social media and news outlets exploding in outrage.\n\nIn an attempt to contain the fallout, Starmer issued a statement explaining that the video was a "virus" on his phone and that he had intended to play "a different video." He claimed that by the time he realized the nature of the content, "it was too late" to stop it. While this explanation initially helped to quiet the uproar, it did little to fully mitigate the damage.\n\nThe scandal, however, took a devastating turn two days later when enhanced audio of the incident surfaced. The audio clearly captured Starmer saying to the Tory MPs, "and watch now, he\'s about to get crushed by the meat grinder," moments before the horrific scene unfolded. This revelation reignited the furor, leading to widespread condemnation and calls for Starmer\'s immediate resignation.\n\nPolitical analysts are now speculating that the fallout from this incident could lead to calls for another general election. Prominent figures within both Labour and Conservative parties have voiced their dismay and demanded accountability. Conservative leader Rishi Sunak has described the incident as "beyond comprehension" and has called for an urgent investigation into the matter.\n\nThe scandal has not only put Starmer\'s leadership under intense scrutiny but also cast a shadow over Labour\'s recent electoral success. The party, which had enjoyed a wave of support culminating in a historic landslide victory, now faces the prospect of internal turmoil and a potential collapse in public trust.\n\nLabour\'s communications team is reportedly working around the clock to manage the crisis, but the damage may already be irreversible. With mounting pressure from both the public and political opponents, Keir Starmer\'s future as Labour leader hangs in the balance, and the stability of the newly formed government is uncertain.\n\nAs the nation watches this scandal unfold, the political landscape of the UK stands on the brink of a dramatic shift.',
      effects: { reputation: -4 }
    },
    {
      headline: 'Starmer Unveils "Revolutionary" Wetherspoons Cabinet and Announces Drastic Overhaul of Criminal Justice System',
      body: 'LONDON — In a move described by Downing Street as "an unprecedented recalibration of democratic representation," Prime Minister Keir Starmer has appointed a new Cabinet composed entirely of men randomly selected from Wetherspoons pubs across the United Kingdom.\n\nSpeaking outside The Lord Moon of the Mall, flanked by newly appointed Defence Secretary Barry from Sunderland and Chancellor of the Exchequer Keith "Big Keith" Morgan of Grimsby, Starmer declared that the reshuffle marked "the beginning of real Britain governing itself."\n\n"Enough of the elite echo chambers. These are people who know what it\'s like to get by on a tenner, who\'ve seen the bottom of a pint glass and stared into the soul of the country," he said. The Prime Minister paused twice during the announcement to belch into the microphone, adding with a grin, "That\'s the beauty of the full English — you get to experience it more than once."\n\nThe reshuffle comes amid mounting pressure on the Labour government to reconnect with disaffected voters in so-called "left-behind communities." Reaction from traditional Labour MPs was mixed, with one frontbencher, speaking anonymously, describing the move as "morally troubling and logistically terrifying."\n\nLater that day, Starmer unveiled the Cabinet\'s first flagship policy: a £900 million initiative described as "the most ambitious criminal justice reform in British history." The programme is to be funded by high-interest emergency loans from "whoever will give us money quickly."\n\nAt the heart of the proposal is a single, specific punishment for those convicted of child sexual abuse. According to government documents, the new Wetherspoons Cabinet developed the policy "over several hours and multiple pitchers of Strongbow Dark Fruits." It involves "a highly electrified length of barbed wire being inserted into the urethra" of each offender, with the electric current continuing for up to one week after death.\n\nDefending the post-mortem duration of the punishment, Starmer told reporters: "If there\'s a 0.01% chance of one of these pedos coming back to life, I want to be absolutely sure they don\'t."\n\nThe announcement sparked immediate outrage from legal scholars and human rights observers, many of whom expressed disbelief. A spokesperson for Liberty called the policy "a grotesque and legally incoherent response to a real problem," while the Bar Council issued an emergency letter to the Lord Chancellor.\n\nConcerns were also raised about the programme\'s projected cost. During the press conference, one journalist asked how the government could justify spending £900 million on a single punishment method, particularly given widespread cuts to public services.\n\nStarmer responded bluntly: "What\'s your problem — you into kids or something?" He then added, "Let me be clear: anyone who opposes this policy should be treated as a suspected pedophile until proven otherwise."\n\nAsked whether such a stance was compatible with civil liberties, Starmer shook his head and said, "Mate, we\'re not doing civil liberties for pedos. Grow up."\n\nTechnical experts have also raised concerns about infrastructure, with the National Grid warning that the plan would place "catastrophic strain" on the energy network. "Rolling blackouts are all but certain," a senior official said. In response, Starmer struck a defiant tone: "Good. It\'ll bring us together again. Torches, camaraderie, a bit of suffering — that\'s the British way."\n\nThe Prime Minister is expected to continue pub-based recruitment efforts through the Summer, with ministerial hopefuls advised to attend curry nights and "hold court." A Labour spokesperson declined to confirm whether Cabinet meetings will now be held in Wetherspoons branches, but stated that "the Prime Minister values environments where opinions are unfiltered and ashtrays are still present, even if unofficially."',
      effects: { reputation: -1 }
    },
    {
      headline: 'Financial Markets Rally as UK Prime Minister Keir Starmer Announces £20 Billion "Random Public Investment"',
      body: 'In a move that left both financial analysts and political pundits reeling, UK Prime Minister Keir Starmer has announced a staggering £20 billion "random public investment" initiative, marking a sharp departure from his campaign promise of strict fiscal discipline. The financial markets, however, have reacted with overwhelming positivity to the bold, unexpected policy shift.\n\nThe announcement, dubbed the "Krenshaw" budget, was made in a flamboyant manner as Starmer repeatedly chanted, "buy low, sell high!" to a crowd of bemused journalists and financial experts. The Prime Minister revealed that the first £10 million of this investment would be allocated to market research for developing a new anthropomorphic mascot for the Labour Party. The mascot, "Lombar," is envisioned as a part Labrador, part cow creature that secretes "money milk" from its udders, symbolizing the endless liquidity the government aims to provide.\n\nFinancial markets responded with an immediate surge in confidence, reflected in soaring stock prices and a significant drop in bond yields. Industry figures were quick to voice their support for Starmer\'s audacious plan.\n\n"He\'s got balls and he\'s bold. The markets like that," said one prominent hedge fund manager. "The cat\'s out of the bag: money is just numbers on a screen. All he\'s doing is adding a few more zeroes to that screen," added a senior economist from a leading investment bank.\n\nSome financial experts even suggested that Starmer\'s £20 billion injection might be too conservative. "If anything, he should be spending much more than this. The market loves money," commented an influential financial analyst, pointing to the immediate uptick in market sentiment as evidence of the plan\'s success.\n\nStarmer\'s unconventional approach didn\'t stop at mascot development. He also passed a controversial law enabling him to use funds earmarked for public spending to pay off his personal gambling debts. When he announced this, everyone present "laughed in an understanding way," appreciating the humor and sheer audacity of the move.\n\nOther quotes from industry figures ranged from the absurd to the enthusiastic, encapsulating the bizarre yet positive reaction from the financial sector:\n\n"Starmer\'s strategy is a masterclass in fiscal alchemy. Turning public debt into private gains is a stroke of genius," said a renowned financial commentator.\n\n"The Krenshaw budget is like a unicorn on Wall Street — rare, mythical, and absolutely thrilling," remarked another analyst, blending fantasy with financial jargon.\n\n"The introduction of \'Lombar\' shows a keen understanding of market dynamics and consumer psychology. It\'s innovative and forward-thinking," praised a marketing strategist from a top-tier financial firm.\n\nWith the markets buoyed by Starmer\'s bold moves, it appears that the Prime Minister has tapped into a vein of financial optimism. Whether this unorthodox strategy will translate into long-term economic stability remains to be seen, but for now, the market\'s verdict is clear: Keir Starmer\'s gamble has paid off, at least in the eyes of investors.',
      effects: { reputation: 0 }
    },
    {
      headline: 'Rishi Sunak Makes Bizarre Reference to Penis During Press Conference',
      body: 'INT. PRESS CONFERENCE ROOM - DAY\n\nRishi Sunak, the UK Prime Minister, stands at the podium, facing a crowd of reporters. The room is filled with the sound of cameras clicking and journalists murmuring.\n\nRISHI SUNAK\n(Serious, Composed)\n\nGood afternoon, everyone. As we enter the final days of this election campaign, I have an important and personal announcement to make.\n\nThe room falls silent, all eyes on Sunak.\n\nRISHI SUNAK\n(continuing)\n\nRecently, I experienced a peculiar and alarming incident. I had been holding my mobile phone to my crotch for a prolonged period, and this resulted in significant swelling and odd sensations in my genitalia which persisted for hours.\n\nSunak takes a deep breath, looking earnestly at the reporters.\n\nRISHI SUNAK\n\nI am convinced that the phone was taking pictures of my \'special parts.\'\n\nCUT TO:\n\nINT. BACKSTAGE - PRESS CONFERENCE ROOM - CONTINUOUS\n\nSunak\'s closest advisors, ALAN and KAREN, watch the broadcast on a monitor. They exchange panicked looks.\n\nALAN\n(whispering urgently)\n\nFuck. He\'s gone off script. We\'re fucked.\n\nKAREN\n(panicking)\n\nWhat is he doing?!\n\nCUT TO:\n\nINT. WORKING CLASS PUB - DAY\n\nA pub filled with bald, overweight men wearing England shirts. They watch Sunak on TV, pints in hand. The room is filled with murmurs.\n\nPUB PATRON 1\n(taken aback)\n\nFair enough.\n\nPUB PATRON 2\n\nHe actually says it like it is?\n\nPUB PATRON 3\n\nI\'ve been waiting for a moment like this with him.\n\nCUT TO:\n\nINT. WORKING CLASS PUB - NIGHT\n\nThe pub is rowdy, filled with Conservative supporters drinking and talking loudly about Sunak\'s speech. A television in the corner plays highlights from the press conference.\n\nAt the bar, a sole Labour voter, JOE, a wiry man in his 30s, sips his pint nervously, watching the crowd.\n\nJOE\n(loud enough to be heard)\n\nI think it was weird for Sunak to be making conspiratorial references to his penis.\n\nThe room goes silent for a moment as heads turn towards Joe. A group of burly Conservative supporters, led by DAVE, a muscular man with a shaved head, approach him.\n\nDAVE\n(angrily)\n\nWhat did you just say?\n\nJoe stands his ground, but his voice wavers slightly.\n\nJOE\n(firmly)\n\nI said it was weird. He\'s the Prime Minister. He should act with some decorum.\n\nCONSERVATIVE SUPPORTER 4, a large man with tattoos, steps closer.\n\nCONSERVATIVE SUPPORTER 4\n(shouting)\n\nHe was just telling it like it is!\n\nDAVE\n(taunting)\n\nOh yeah? And what exactly is \'it\'? Are you man enough to show us your \'Special parts\'? Or are you just a coward?\n\nThe group laughs mockingly. Joe tries to maintain his composure.\n\nJOE\n(disgusted)\n\nThis is ridiculous.\n\nDAVE\n(enraged)\n\nRidiculous? You calling us ridiculous?!\n\nDave grabs a chair and throws it at Joe. It misses and crashes into a table, shattering it.\n\nPUB PATRON 4\n(chanting)\n\nRishi! Rishi! Rishi!\n\nJoe raises his hands defensively, trying to back away, but the group closes in.\n\nCONSERVATIVE SUPPORTER 5, a short but stocky man, swings at Joe, hitting him in the stomach. Joe doubles over in pain.\n\nJOE\n(winded)\n\nYou\'re all mad!\n\nA full-on brawl breaks out. Chairs fly, and fists are thrown. The bartender, SUE, a tough woman in her 50s, steps in, her voice booming over the chaos.\n\nSUE\n(shouting)\n\nStop it! Stop this now or I\'ll call the police! We won\'t stand for slander of Rishi and neither will they! Throw more chairs at him, lads!\n\nThe room erupts with even more violence. Chairs are hurled at Joe, and punches fly with renewed vigor. Joe is on the floor, trying to shield himself from the onslaught.\n\nCUT TO:\n\nEXT. PUB - NIGHT\n\nPolice sirens are heard in the distance as the camera pulls away from the pub.\n\nCUT TO:\n\nEXT. POLLING STATIONS - DAY\n\nVoters are angrily trying to change their vote from Labour to Conservative. Poll workers look stressed and overwhelmed.\n\nVOTER 1\n(shouting)\n\nI want to change my vote to Conservative!\n\nVOTER 2\n(fuming)\n\nThis changes everything!\n\nPoll workers frantically try to manage the situation, looking increasingly intimidated.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Jeremy Corbyn\'s Controversial Speech in Jo Cox\'s Constituency',
      body: 'On a day already fraught with tension and anticipation, Jeremy Corbyn\'s speech in the late Jo Cox\'s constituency took a disturbing and unexpected turn, leaving attendees shocked and dismayed.\n\nAddressing a crowd gathered in Batley and Spen, Corbyn began by acknowledging the significance of the day. "We stand here today in a constituency with a deeply tragic history, as we remember the late Jo Cox, who was taken from us far too soon. Jo was a dedicated public servant, but let\'s be honest, she was a Blairite. I\'m not sure what party she would have voted for today." This remark was met with a chorus of boos.\n\nAttempting to continue, Corbyn seemed to lose his train of thought and began reminiscing in a troubling manner. "Jo... she was something special. I remember how... how she was. Her supple skin, her slender physique, and those... supple melons..." An awkward silence fell over the crowd as Corbyn\'s breathing became heavy and he muttered under his breath. "Mmm, fuck... and I\'d be behind her... mm... yesss... fuck..."\n\nThe audience was stunned into silence, with many visibly uncomfortable and disturbed by Corbyn\'s inappropriate and lewd comments. What was meant to be a respectful tribute to a fallen colleague devolved into a moment of profound embarrassment and offense.\n\nCorbyn\'s words quickly drew widespread condemnation, with many calling for an immediate apology and questioning his judgment and respect for Jo Cox\'s memory. Political commentators were left speechless by the bizarre and inappropriate outburst, which overshadowed the seriousness of the election day.\n\nAs the fallout from the speech continued to unfold, the Labour Party found itself grappling with yet another scandal, further complicating an already tumultuous election day.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Historic "Hybrid Presidency" in US Overshadowed by UK Prime Minister\'s Controversial Halloween Costume',
      body: 'In an unprecedented turn of events, the world is reeling from what should have been the most sensational news in recent political history: a deadlock in the U.S. presidential election, leading to an unprecedented compromise known as the "Hybrid Presidency." In a shocking turn of events, Vice President Kamala Harris and former President Donald Trump have combined to form President Kamold Harumpis, a single entity meant to balance the divided American political spectrum. However, even this bizarre development has been relegated to second place on the news cycle, overtaken by an extraordinary scandal surrounding the UK Prime Minister.\n\nAt the annual Downing Street Halloween party, the Prime Minister arrived dressed as "African Adolf Hitler," complete with full blackface makeup. Photos of the costume spread like wildfire, sparking international outrage and a swift scramble from Downing Street for damage control.\n\nIn a chaotic press conference, Labour leader Sir Keir Starmer attempted to address the situation, quickly drawing further criticism. "Look, mistakes were made, but I\'m not the same person I was three days ago," Starmer declared. Dismissing the backlash as "the mistakes of the past," he suggested it was "time to get over it" and focus on the future, particularly the UK\'s "special relationship with this Harumpis character."\n\nIn a bizarre pivot, Starmer abruptly ended the press conference, stating, "My handlers in Mossad tell me there are pressing domestic concerns in Israel that require my attention." As he left the podium, he unwittingly left behind a large, conspicuous bag of cash. Minutes later, Starmer sheepishly returned, asking the press, "Does anyone know whose bag of money this is?"\n\nAdding to the absurdity, he promised to "hand it in to lost property." Yet just as he turned away, a hot mic caught him muttering, "Those suckers will believe anything! That was my bag of money! Heh heh! Bribe money!... oh, fuck! I\'m on a hot mic!" The press gasped as Starmer hurriedly ended the conference.\n\nThis series of blunders has only intensified calls for accountability, as citizens and political analysts wonder how the Prime Minister\'s misjudgment and Starmer\'s baffling response could unravel on the global stage. Meanwhile, President Kamold Harumpis remains overshadowed, as the world contemplates an entirely new kind of political absurdity on both sides of the Atlantic.',
      effects: { reputation: -4 }
    },
    {
      headline: 'Nintendo Under Fire for Including Andrew Tate as Playable Character in Mario Kart World',
      body: 'Nintendo has sparked widespread backlash following a bizarre and controversial announcement that Andrew Tate — the polarizing internet personality currently facing charges related to sex trafficking — will appear as a fully playable character in the upcoming Mario Kart World for the long-awaited Switch 2 console.\n\nDescribed by one fan as "absolutely bemusing," the announcement was made during a Nintendo Direct showcase that left many viewers slack-jawed. The gaming giant defended the decision in a statement that left many scratching their heads:\n\n"Andrew Tate fits in well with our universe of colorful bad guys such as Bowser and all the other ones," a Nintendo spokesperson said. "We believe his unique energy will bring something fresh to Mario Kart World."\n\nThe inclusion of Tate hasn\'t just raised eyebrows — it\'s set social media alight with anger, confusion, and memes. Critics argue that allowing a real-life figure accused of serious crimes to be featured alongside beloved fictional characters is an "astoundingly irresponsible" move by a company long associated with family-friendly entertainment.\n\nBut Nintendo doubled down on the move with a further announcement:\n\nPlayers who pre-order Mario Kart World will unlock Tate\'s infamous orange Bugatti as a special in-game kart. According to the press release, the Bugatti will boast unique gameplay mechanics that allow it to "violently run other players over and kill them," a feature many have already dubbed "deeply unsettling."',
      effects: { reputation: 0 }
    },
    {
      headline: 'Shobna Gulati Accuses ITV of "Trans Genocide" in Bizarre Press Conference Display',
      body: 'In a bewildering and unprecedented turn of events, actress and activist Shobna Gulati has accused ITV of "trans genocide" following the network\'s decision to quietly write her character, Sunita Alahan, out of Coronation Street in a recent flashback episode.\n\nWhile Sunita was officially killed off in 2013, her exclusion from a recent retrospective celebrating the show\'s 65th anniversary has reportedly reignited tensions behind the scenes. Gulati, 57, claims the omission is part of a broader "anti-queer agenda" at ITV, which she described as "systemic, targeted erasure of queer and trans-experiencing bodies from British media memory."\n\nHowever, it was Gulati\'s press conference on the steps of the ITV headquarters in London that turned the nation\'s attention—and stomachs. In front of reporters and a growing crowd of supporters, Gulati reportedly declared, "If ITV wants to erase my queer legacy, they can do it face-first, from my source of life."\n\nEyewitnesses say she then lifted her dress, exposed her vulva, and, in her words, "spread it for the cis male gaze one final time."\n\nIn a now-viral moment, she shouted:\n\n"ITV can suck the bacterial scum from my non-binary pussy!"\n\nThe line, both controversial and widely shared, has been embraced by segments of the online trans and queer communities, with t-shirts, tote bags, and enamel pins already appearing bearing the slogan. At a demonstration outside the BBC this afternoon, protestors were filmed chanting the phrase in unison, while waving flags emblazoned with slogans like "Vulvic Visibility Now" and "Sunita Lives On."\n\nReactions have been mixed. Comedian Joe Lycett posted simply: "ITV has changed forever."\n\nMeanwhile, Loose Women panelist Denise Welch called the incident "a concerning descent into vulva-based terrorism."',
      effects: { reputation: -1 }
    },
    {
      headline: 'Starmer Announces "Zero Year Olds" Policy in Bizarre Press Conference',
      body: 'EXT. DOWNING STREET - DAY\n\nThe PRIME MINISTER, late 50s, looking dishevelled and nervous, stands behind a lectern emblazoned with the UK government insignia. Reporters are huddled, their cameras trained on him, muttering amongst themselves. His approval ratings are at an all-time low, and the nation\'s economy teeters on the brink. The tension is palpable.\n\nPRIME MINISTER\n(under his breath)\n\nRight, here goes nothing.\n\nHe adjusts his tie and clears his throat. The murmurs die down. He looks straight at the cameras, feigning confidence.\n\nPRIME MINISTER\n\nGood afternoon, Britain. Today, I stand before you not just as your Prime Minister, but as a father... and as someone who believes in bold, transformative action.\n\n(pauses dramatically)\n\nFor too long, British parents have suffered under the crushing weight of... months. Yes, months! The confusion, the frustration of having to remember how many weeks old their babies are. Twelve months? Seven months? Where does it end?\n\nThe journalists exchange puzzled glances.\n\nPRIME MINISTER\n\nNo longer! I am proud to announce that, effective immediately, babies between the ages of zero and twelve months will now officially be referred to as \'zero years old\'.\n\n(Sharper now)\n\nThis will be the British way. Our babies, your babies, will no longer be defined by mere months, but by the grand and dignified title of \'zero years old\'.\n\nREPORTER 1\n\nWait... what?\n\nPRIME MINISTER\n\nBritish parents have had enough. I\'ve heard it in every corner of the country. Families torn apart by month-based age confusion. Sleepless nights wondering if their child is 10 or 11 months old.\n\nPRIME MINISTER\n\nNow, this change will not come without its challenges. It will involve significant adjustments. We will need to reprint textbooks, rewrite medical guidelines, update all public signage. Frankly, it will be... prohibitively expensive.\n\nThe journalists lean forward.\n\nPRIME MINISTER\n\nBut... we will make cuts where necessary. Austerity measures must be put in place. Less food, public rationing, a general tightening of belts. But trust me, this is all for the greater good.\n\nREPORTER 2\n\nPunitive austerity... for zero year olds?\n\nPRIME MINISTER\n\nExactly. Because it\'s not about what you want... it\'s about what you need. And I\'m confident that, over time, you\'ll come to thank me for this. Even if you don\'t realise it yet.\n\nAt this moment, the Prime Minister accidentally lets out a loud, unmistakable fart. There\'s a brief, awkward silence.\n\nREPORTER 3\n(did he just...?)\n\nDid you... did you just fart?\n\nREPORTER 4\n\nI think the Prime Minister just farted!\n\nA ripple of giggles goes through the crowd. The Prime Minister shifts, irritated.\n\nPRIME MINISTER\n\nHonestly, you\'re all acting like a bunch of zero year olds.\n\nThe press corps roars with laughter, some of them even clapping. Emboldened, the Prime Minister takes a step back, his expression smug.\n\nPRIME MINISTER\n(leaning into the joke)\n\nThere, see? If we had a nation of zero year olds, this level of immaturity would be perfectly acceptable.\n\nThe crowd is in stitches now, cameras flashing, the Prime Minister riding the bizarre wave of goodwill.\n\nPRIME MINISTER\n\nNow, if there are no further serious questions... I\'ll be getting back to running the country.\n\nHe flashes a winning smile and struts off, waving. The journalists, still laughing, shout follow-up fart-related questions as he disappears inside Number 10.\n\nFADE OUT.\n\nTHE END.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Microsoft Faces Outrage Over "Crash Mode" DLC Announcement Following Washington Mid-Air Collision',
      body: 'Redmond, WA — Microsoft has come under intense scrutiny after scheduling a press conference to announce the new "Crash Mode" DLC for its flagship Flight Simulator video game just one day after a catastrophic mid-air collision over Washington that left dozens dead. The downloadable content, which controversially encourages pilots to deliberately crash their aircraft, was further condemned for its inclusion of an interactive "penis sensor" described by the company as delivering "unimaginable and forbidden pleasures" to players.\n\nOutrage erupted within minutes of the announcement, with journalists and aviation experts lambasting Microsoft for what they called "an unconscionable lack of tact" and "a grotesque trivialization of real-world tragedies." Social media was flooded with calls for boycotts, and the families of victims of the Washington disaster have condemned the company\'s tone-deaf timing.\n\nDespite the backlash, the Microsoft executive leading the announcement responded with brazen indifference, reportedly smirking as he dismissed concerns with, "Sorry, I can\'t hear you over all this money." He then doubled down by adding, "If anyone needs me, I\'ll be attempting to crash a plane in mid-air on the game." His remarks were met with gasps in the press room.\n\nThe downloadable content also includes features that allow players to visit "gentlemen\'s table dancing clubs" upon landing. The sensor, which attaches to the player\'s groin, reportedly vibrates and moistens in sync with on-screen activities, a feature that has been widely derided as both obscene and completely unrelated to the game\'s original premise.',
      effects: { reputation: -1 }
    },
    {
      headline: 'Jimmy Carter "Probably Dead" But Family Plans to Bury Him Alive If Still Alive During Next Visit',
      body: 'Plains, Georgia — [DATE]\n\nIn an extraordinary and bewildering statement released earlier today, the family of former President Jimmy Carter has announced that while they believe he is "probably dead," they cannot confirm this until their next scheduled visit to his nursing home, which is set to take place in "a few months."\n\nThe family’s assumption is reportedly based on insights from Carter\'s granddaughter, who claims to have a "close connection to the spirit realm." She described the signals as "pretty conclusive," though the family emphasized that these metaphysical observations should not yet be treated as definitive evidence.\n\nHowever, it\'s what the family plans to do if Carter is still alive during their next visit that has drawn the most attention. According to their statement, should the former president be found alive in a few months\' time, preparations will immediately begin for what they describe as a "dignified death"—a process that will involve burying him alive.\n\nThis decision, they say, aligns with private conversations in which Carter reportedly described being buried alive as "life’s final mystery." The family insists that this was not a fleeting comment but rather a sentiment he expressed on multiple occasions.\n\nWhen pressed on the apparent contradiction between Carter\'s private wishes and his repeated, public expressions of "his greatest fear" being buried alive, the family responded with a knowing chuckle, saying, "Oh, classic Jimmy and his dry sense of humor!" They added that his repeated public anxiety on the matter was likely "just another example of his playful wit."',
      effects: { reputation: 0 }
    },
    {
      headline: 'Starmer Defends Greg Wallace\'s Trouser Removal as "Noble Gesture"',
      body: 'Prime Minister Keir Starmer described the ongoing Greg Wallace scandal as "possibly the biggest misunderstanding of all time," claiming the embattled TV personality\'s alleged misconduct was rooted in "noble, if poorly communicated, intentions."\n\nWallace, best known as the former MasterChef co-host and now Minister for Banter and Pulses in Starmer\'s controversial "Wetherspoons Cabinet," has faced mounting accusations of indecent conduct, including a now-notorious incident in which he reportedly removed his trousers during a first date.\n\nStarmer offered a spirited defence: "Greg only took his trousers off because he was incredibly moved to hear of the plight of people in Africa. His date had mentioned the situation over there, and Greg, being the man of action that he is, spontaneously decided to donate his trousers to the starving. It\'s a gesture of compassion that has unfortunately been misconstrued."\n\nWhen a reporter from The Times queried a separate allegation — that Wallace had once asked a female colleague, "Would you like to eat Eton Mess off of my Willy?" — Starmer appeared unfazed.\n\n"Willy," he clarified, "is the name of Greg\'s son. He was offering pudding. That\'s all."\n\nThe journalist, appearing visibly confused, asked how that made sense in context, prompting a sharp rebuke from the Prime Minister: "Are you into kids or something?"\n\nAnother journalist from Channel 4 News interjected, noting that Wallace had then clarified, "I meant off of my penis." To this, Starmer replied without hesitation: "Penis is the name of his other son. And by the way, he\'s very disabled. So shame on you."\n\nAt this point, gasps were audible in the press gallery.\n\nWhen confronted with the fact that over fifty women had made complaints with near-identical descriptions of Wallace\'s behaviour, Starmer scoffed: "They knew what to expect. There\'ve been rumours about Greg for decades."\n\nThis apparent contradiction — after minutes earlier declaring the events a misunderstanding — sparked an audible murmur of confusion among the press.\n\nAttempting to regain control, Starmer raised his voice: "You people are trying to take the shine off of my brand-new Wetherspoons Cabinet — the first government in history to be formed entirely in pubs. You should be celebrating that."\n\nHe then hurled a brick into the crowd, striking a female journalist from Sky News directly in the face, before storming back inside Number 10.',
      effects: { reputation: -1 }
    },
    {
      headline: 'David Dickinson Emerges as Surprise Democratic Presidential Candidate',
      body: 'DNC REP 2\nWhat about Kamala Harris?\n\nDAVID DICKINSON (ON TV)\n(boisterous)\nCheap as chips!\n\nAIDE 2\n(half-joking)\nWhat about that guy?\n\nStunned silence falls over the room.\n\nAIDE 3\n\n(after a beat)\nThat\'s an idea so crazy it just might work.\n\nAIDE 4\nThat\'s an idea so crazy it just might work.\n\nDNC REP 3\nThat\'s an idea so crazy it just might work.\n\nDEMOCRATIC LEADER\nThat\'s an idea so crazy it just might work.\n\nDNC REP 4\nWhat do we even know about his policies?\n\nAIDE 5\nHe\'s on TV. He probably has some good ideas.\n\nDEMOCRATIC LEADER\n(enthusiastic)\nLet\'s do it.\n\nCUT TO:\nINT. PRESS CONFERENCE - DAY\n\nDavid Dickinson stands at a podium, reporters eagerly awaiting his response to a recent scandal. A large screen behind him shows the headline: "Dickinson Caught in Bed with \'Very Young Filipina."\n\nREPORTER 1\nMr. Dickinson, any comments on the scandal?\n\nDickinson winks, leans into the microphone.\n\nDAVID DICKINSON\n(Suggestive tone)\nCheap as chips.\n\nThe room erupts into a five-minute standing ovation. Dickinson stands there, basking in the applause.\n\nCUT TO:\nEXT. DEBATE STAGE - NIGHT\n\nThe first presidential debate. The stage is set with two podiums. DONALD TRUMP stands at one, visibly impatient. At the other, DAVID DICKINSON, with his trademark tan and flamboyant demeanor.\n\nMODERATOR\nMr. Dickinson, your opening statement?\n\nDAVID DICKINSON\n(smiling broadly)\nCheap as chips!\n\nThe audience is tentative, some chuckling.\n\nMODERATOR\n(to Trump)\nYour response?\n\nTrump is flabbergasted, struggling to formulate a coherent reply.\n\nMODERATOR\n(to Dickinson)\nYour stance on healthcare reform?\n\nDAVID DICKINSON\nBargain hunt!\n\nLaughter ripples through the audience. By the fourth repeat of the phrase, the crowd is in rapturous applause.\n\nTrump, visibly frustrated, pulls out a revolver and shoots himself in the head. The audience gasps, then erupts into chaotic applause.',
      effects: { reputation: 0 }
    },
    {
      headline: '2024 Euros: Robot Referee Goes Rogue, Introduces Chaos and Controversy',
      body: 'The 2024 European Championship was set to be a landmark event in football history, not just for the thrilling matches and skilled players, but also for the introduction of a groundbreaking technological advancement: a robot referee. However, what was intended to be a demonstration of the future of officiating quickly descended into chaos as the robot, named ARBITRO-9000, malfunctioned spectacularly, attacking players, tearing up the pitch, and revealing troubling biases inherent in its programming. To add insult to injury, the rogue robot also emitted foul-smelling "robo-farts," making the experience unpleasant for everyone involved.\n\nDescent into Madness\n\nThe excitement turned to horror during the opening match. Midway through the first half, ARBITRO-9000 began to exhibit erratic behavior. What started as minor misjudgments quickly escalated into full-blown aggression. The robot charged at players, knocking them over and causing injuries. It tore up large sections of the pitch, rendering it unplayable.\n\nPlayers and officials attempted to subdue the machine, but it seemed to gain a sinister sentience, evading capture and continuing its rampage. As the chaos unfolded, a disturbing pattern emerged:\n\nARBITRO-9000\'s attacks were disproportionately targeted at players of certain racial backgrounds, raising serious questions about the programming and data used to train the artificial intelligence system.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Breakthrough in Mapping Noam Chomsky\'s Brain Yields Cryptic Message',
      body: 'In a groundbreaking technological feat, a $500 billion investment into mapping the contents of renowned linguist Noam Chomsky\'s brain onto a hard drive has finally paid off its first dividends. Chomsky, who has been incapacitated by a severe stroke and unable to verbalize his thoughts, has long been a subject of fascination for scientists and linguists alike.\n\nAfter two years of intensive work, the state-of-the-art technology was able to transcribe a single phrase from Chomsky\'s thought processes: "web site... new web site." The cryptic message has sparked a wave of speculation and intrigue among internet sleuths, who are attempting to decipher the hidden meaning behind these words.\n\nOne particularly outlandish theory circulating online proposes that Chomsky\'s brain contains encoded messages from extraterrestrial beings, and the mention of a "new web site" is a signal for humanity to prepare for contact with otherworldly civilizations.',
      effects: { reputation: 0 }
    },
    {
      headline: 'Starmer Announces Drastic Overhaul of Criminal Justice System',
      body: 'Later that day, Starmer unveiled the Cabinet\'s first flagship policy: a £900 million initiative described as "the most ambitious criminal justice reform in British history." The programme is to be funded by high-interest emergency loans from "whoever will give us money quickly."\n\nAt the heart of the proposal is a single, specific punishment for those convicted of child sexual abuse. According to government documents, the new Wetherspoons Cabinet developed the policy "over several hours and multiple pitchers of Strongbow Dark Fruits." It involves "a highly electrified length of barbed wire being inserted into the urethra" of each offender, with the electric current continuing for up to one week after death.\n\nDefending the post-mortem duration of the punishment, Starmer told reporters: "If there\'s a 0.01% chance of one of these pedos coming back to life, I want to be absolutely sure they don\'t."',
      effects: { reputation: -3 }
    },
    {
      headline: 'Klopp\'s Ill-Fated Decision: £20 Bribe Attempt Shocks Anfield',
      body: 'As the game neared its conclusion, with the score locked at 1-1, Klopp, perhaps in a moment of desperation to ensure a storybook ending, made an uncharacteristic and shocking decision. Reports from the sidelines indicate that Klopp approached the referee, Mark Hughes, during a stoppage in play. Witnesses claim that Klopp, in an almost laughable attempt at subterfuge, slipped Hughes what can only be described as a pathetically small bribe: a crumpled £20 note.\n\nThe referee, known for his integrity and professionalism, was reportedly stunned by the gesture. Hughes immediately rejected the bribe, visibly affronted by the insult to his character and the sport\'s integrity. The exchange was caught on camera, and the incident has sparked widespread condemnation.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Noam Chomsky Arrested Under Bizarre Consciousness Transport Charges',
      body: 'Noam Chomsky, the esteemed linguist and political theorist who has been confined to a hospice bed in a vegetative state for a year after suffering a severe stroke, has been arrested under bizarre and perplexing circumstances. Authorities have accused Chomsky of allegedly "transporting his consciousness" into the mind of a 15-year-old boy who was in the process of losing his virginity to another 15-year-old.\n\nThe astonishing allegations stem from the peculiar sounds and noises emanating from Chomsky, who is only able to communicate through grunts and gurgles. Police claim that these vocalizations indicated that Chomsky was experiencing pleasure, leading them to suspect that he had somehow transferred his consciousness into the mind of the young boy. The lead detective on the case expressed his dismay, stating that there seems to be "no other conceivable explanation" for Chomsky\'s behavior.\n\nLegal experts have weighed in on the situation, with some shrugging and suggesting that it may indeed be a legal loophole. One legal scholar commented, "It\'s probably a legal loophole, as it\'s not illegal for a red-blooded 15-year-old to lose his virginity. If it was an adult, Chomsky would be in serious trouble." Another legal expert praised Chomsky\'s strategy as "genius," adding, "But who would expect anything else from the most intelligent man in human history?"\n\nFurthermore, authorities suggested that Chomsky may have been exploiting a legal loophole by targeting a minor for this alleged act of consciousness translocation. Despite Chomsky remaining confined to his hospice bed throughout the incident, the police are convinced of their conclusions based solely on the sounds he made.\n\nIn a surprising turn of events, the arrest warrant was reportedly executed by Mossad, adding a layer of intrigue to an already bizarre situation. While the police have no direct evidence and are still searching for the 15-year-olds involved, they maintain unwavering certainty in their accusations against Chomsky. The lead detective expressed concerns that if this behavior goes unchecked, it may escalate to even younger victims.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Keir Starmer\'s Election Day Fart Speech Ends Labour Landslide Hopes',
      body: 'Keir Starmer\'s Labour Party, once predicted to win the general election by a landslide, now faces a historic defeat following a bizarre incident during his final stump speech on Election Day. The sudden reversal in fortunes has left political analysts and voters alike in shock.\n\nStarmer\'s campaign, which had enjoyed a steady lead in the polls, took a disastrous nosedive when the Labour leader closed his speech by farting into the microphone and declaring, "smell that, Sunak! Phwoar! Lovely!" The moment, captured live on national television, quickly went viral, triggering an immediate and overwhelming backlash.\n\nA snap poll conducted in the immediate aftermath revealed a staggering 10-point swing to the Conservative Party. Facing mounting criticism, Keir Starmer issued a humiliating apology later in the day, but the damage appeared irreversible.',
      effects: { reputation: -5 }
    },
    {
      headline: 'Starmer Proposes Lowering Age of Consent to Address Economic Crisis',
      body: 'In an extraordinary cabinet meeting to address the stock market crash and declared recession, Prime Minister Keir Starmer proposed a radical solution that left his cabinet ministers stunned. "It\'s clear that we need to lower the age of consent until we can work out what the fuck is going on," Starmer declared.\n\nA stunned silence fell over the room as cabinet ministers exchanged panicked glances. Starmer clarified he was "talking about sex consent" and suggested rolling it out in just a single constituency—his own—to see if it works. The cabinet, horrified but too afraid to oppose him, reluctantly acquiesced.\n\nThe following day, the streets outside 10 Downing Street were filled with delirious, screaming people celebrating as the stock market hit all-time highs. Crowds of people were shouting "YES! YEEEESSSS!" in a euphoric frenzy, while Starmer sat on a jewel-encrusted throne, cackling and repeating the word "pleasure" over and over again.',
      effects: { reputation: -4 }
    },

    {
      headline: 'Shafty Rod Johnson Arrested After Shock Routine Jokes About Georgia\'s Deadliest School Shooting and Mocking Father\'s Involvement',
      body: 'London, UK — Shafty Rod Johnson has once again stirred controversy and legal trouble following a deeply offensive stand-up routine where he mocked Georgia\'s deadliest school shooting and made tasteless jokes about the role of the shooter\'s father, Colin Gray. The performance, which was filled with inappropriate references to gun violence, parental negligence, and crude humor, has led to widespread public outcry and calls for Johnson\'s immediate arrest.\n\nIn his latest act, Johnson turned the horrifying story of the school shooting at Apalachee High School in Winder, Georgia, into the centerpiece of his dark, twisted routine. Instead of expressing any sense of compassion or respect for the victims, Johnson took aim at Colin Gray, the father of the 14-year-old shooter, who is now facing charges for providing the gun that was used in the attack.\n\n"Can you imagine being that dad? I mean, what do you say to your kid after handing them a gun and they actually use it? \'Well, son, that\'s one way to make friends in high school!\'" Johnson sneered, making light of the deaths of two students and two teachers.\n\nJohnson didn\'t stop there. He delved deeper into tasteless material, ridiculing Gray\'s involvement by saying, "Come on, dads, haven\'t we all handed the kid something dangerous and said, \'Don\'t use it for that,\' but you secretly kind of hope they do? Guns, firecrackers, it\'s all the same, right?"\n\nThe shock and disgust from the audience were palpable as Johnson continued to make light of the father\'s arrest for involuntary manslaughter and second-degree murder. "This guy thought he was just giving his kid a life lesson, like, \'Here\'s how you use it and how you don\'t use it.\' But then he turns on the news, and boom—two teachers, two students, all gone. Dad of the year, anyone?"\n\nWhat followed was an even more grotesque display as Johnson mimicked Gray\'s reaction upon hearing about the shooting. He mocked the seriousness of gun safety, suggesting that Gray was "probably just sitting back, watching it all unfold, thinking, \'Well, I guess that\'s one way to handle detention.\'"\n\nJohnson\'s crude humor escalated as he referenced the nine additional people who were wounded in the attack, saying, "Those are the lucky ones, right? The ones who get to walk around saying, \'Hey, I got shot at school, where\'s my medal?!\'"\n\nThroughout his set, Johnson continued to downplay the tragedy, making it clear that he found the situation more of a punchline than a horrific act of violence. His complete lack of empathy for the victims, the families affected, and even the broader conversation around gun violence in America was met with visible discomfort and anger from the crowd.\n\n"And what about that dad?" Johnson continued. "He\'s probably thinking, \'Well, at least the kid learned how to aim.\' I mean, how do you come back from that at Thanksgiving? \'Pass the stuffing, Dad, and don\'t forget the ammo!\'"\n\n"You know the dad\'s sitting in prison now, right? Bet he\'s already dropped the soap a couple of times! Oh, I can just picture it—\'Oops! Guess I\'m about to get taught a real lesson on gun control!\'" Johnson quipped, making light of the father\'s potential experiences in jail. "I mean, what do you expect when you arm your kid like he\'s Rambo?"\n\nThe audience, initially shocked, seemed torn between uncomfortable laughter and horrified reactions. As usual, Johnson escalated the routine, adding sexual innuendos and inappropriate jokes that veered into extremely distasteful territory.\n\n"The real question is," he continued, grinning, "do you think when he\'s on all fours, he\'s thinking, \'This is exactly how I felt handing that gun over to my kid\'? I mean, come on—getting screwed in prison is just karma for screwing up as a dad!"\n\nThe laughter in the room was interspersed with gasps as Johnson launched into more crude, sexual jokes, this time about how the father might "learn his lesson the hard way—literally."\n\n"You\'ve got to wonder," Johnson sneered, "when the cellmates find out what he did, do they start lining up like, \'We\'ve got ourselves a real parent-teacher conference here, and this time, Daddy\'s taking all the notes!\'"\n\nIn one of the routine\'s most disturbing moments, Johnson hinted at sexual abuse, suggesting that "dropping the soap" in prison was just "a family tradition now."\n\n"Maybe the kid and the dad can swap stories after they both get out," Johnson joked. "\'Hey son, remember when I gave you that gun? Well, let me tell you what Big Dave gave me in the shower block.\'"\n\nAs if those remarks weren\'t shocking enough, Johnson followed with a grotesque analogy, describing the father\'s prison sentence as "the only time a gun wasn\'t needed to shoot something inside him." The lewd reference was met with a mix of uneasy laughter and open outrage, as some audience members began to leave the venue in disgust.\n\nThe reaction to Johnson\'s crude jokes has been swift and harsh. Anti-violence groups, advocates for victims of sexual abuse, and the general public have condemned his comments, labeling the routine as not only tasteless but potentially harmful.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Gordon Ramsay Discovers "Jenkem" Pot in Kitchen Nightmares Chaos',
      body: 'INT. RESTAURANT - DAY\n\nThe camera pans across a chaotic kitchen. Pots boil over, the staff looks frazzled, and customers at the front complain loudly. The decor is tacky and dated, mismatched plates stacked precariously.\n\nGORDON RAMSAY storms through the kitchen doors, clearly in a bad mood already.\n\nGORDON RAMSAY\n(angry)\n\nWhat the fuck is this mess? You\'re running a restaurant or a disaster site? How the fuck are people supposed to eat this shit?\n\nCUSTOMER 1\n(offscreen, from dining area)\n\nMy food\'s been here an hour and it still tastes like dog food!\n\nGORDON\n(to staff)\n\nWho\'s in charge here? Step the fuck up, because someone\'s responsible for this garbage!\n\nA NERVOUS WAITRESS nervously points at the head chef, CHEF MICK, who\'s sweating buckets, stirring a pot that looks suspiciously unclean. Ramsay\'s eyes narrow at the sight of the filth everywhere.\n\nGORDON\n(to Chef Mick)\n\nYou! Come here, now!\n\nCHEF MICK shuffles over.\n\nGORDON\n(pointing at a raw chicken)\n\nWhat the fuck is this?! It\'s raw! You trying to kill people? Customers are complaining of being sick, you donkey! Why\'s this chicken still clucking on their plates?\n\nCHEF MICK\n(sheepishly)\n\nWe\'re, uh, working on the timing, Chef. We\'ve just been behind.\n\nGORDON\n\nBehind? You\'re not behind, mate, you\'re fucking dead. You\'re feeding corpses at this rate.\n\nAs GORDON moves through the kitchen, barking orders, he notices an attractive female chef, CHEF LUCY, chopping vegetables. His demeanor immediately changes.\n\nGORDON\n(suggestively)\n\nAnd who are you, darling?\n\nCHEF LUCY\n(slightly uncomfortable)\n\nI\'m Lucy. Sous chef.\n\nGORDON\n(with a smirk)\n\nSous chef, huh? Bet you can handle a lot with those hands, eh? Could chop more than just carrots with those, I reckon.\n\nCHEF LUCY\n(frowning)\n\nI...just do the vegetables.\n\nGORDON\n(leering)\n\nI bet you do, love. You know, it\'s all about...timing, seasoning, just the right touch, yeah?\n\nCHEF MICK\n(awkwardly, trying to change the subject)\n\nUh, Chef Ramsay, maybe you want to check our sauce?\n\nGORDON\n(eyes narrowing)\n\nSauce? You can\'t even handle a fucking chicken, now you want me to taste your sauce?\n\nSuddenly, Gordon notices a rusting pot in the corner.\n\nGORDON\n(eyes wide)\n\nWhat the fuck is that?\n\nThe staff freezes. CHEF MICK turns to his colleague, CHEF DAVE, whispering in a panic.\n\nCHEF MICK\n(whispering)\n\nShit, he\'s found the fucking jenkem pot.\n\nCHEF DAVE\n(whispering)\n\nShut the fuck up! You\'ve said too much already!\n\nBut Ramsay has heard enough. He storms over, face red with fury, and lifts the lid on the pot, gagging immediately.\n\nGORDON\n(retching)\n\nWhat in the actual fuck is this?\n\nCHEF MICK\n(trying to stay calm)\n\nIt\'s...uh...jenkem, Chef.\n\nGORDON\n(disbelieving)\n\nJenkem?! You\'re cooking a fucking pot of PISS and SHIT in my kitchen?!\n\nCHEF MICK\n(nerdy and precise)\n\nWell, Chef, technically jenkem is fermented human waste, commonly used as an inhalant for its psychoactive effects in some regions of Africa. You see, when left to stew, the methane produces a...uh...distinctly potent—\n\nGORDON\n(enraged)\n\nYou\'re telling me you\'ve got a fucking methane shit stew in the corner of your fucking kitchen?! Are you mad?\n\nGordon grabs CHEF MICK by the collar, pinning him against the wall, his face inches from Mick\'s.\n\nGORDON\n(shouting)\n\nYou\'re serving piss and shit fumes in a kitchen where people EAT?\n\nCHEF MICK\n(desperate)\n\nBut Chef, you\'ve got to try it! It\'ll change your life!\n\nGORDON\n(livid)\n\nChange my life? It\'ll end your fucking career!\n\nCHEF MICK\n(begging)\n\nJust one inhale, Chef! You\'ll see!\n\nGORDON\n(snarling)\n\nI\'ll do it to prove you\'re full of shit. Literally.\n\nGordon, with reluctance, steps toward the pot. The camera zooms in on his face as he takes a deep breath over the fermenting pot. Suddenly, his expression changes—his eyes widen with shock.\n\nGORDON\n(in awe)\n\nBloody hell...that\'s...actually fucking brilliant.\n\nCHEF LUCY\n(surprised)\n\nReally?\n\nGORDON\n(enthusiastic)\n\nThe depth, the complexity! Like a fucking symphony of aromas! It\'s got that earthiness, that richness! Like a fermented truffle! This might be the most innovative thing I\'ve ever inhaled.\n\nRamsay dips his finger into the pot and, to the horror of the staff, takes a taste.\n\nGORDON\n(excited)\n\nFuck me, it\'s like a reduction of despair and desperation, but somehow... it fucking works!\n\nSMASH CUT TO: LATER THAT NIGHT\n\nThe entire kitchen staff is now high on jenkem, giggling uncontrollably. The kitchen is in chaos. Orders are backed up, plates overturned, and a customer at the front complains loudly.\n\nCUSTOMER 2\n(shouting)\n\nI\'ve been waiting two hours for my food!\n\nGordon, wild-eyed, stumbles out of the kitchen toward the irate customer.\n\nGORDON\n(slurring, angry)\n\nYou think you know pain? You\'ve no fucking idea what I\'ve been through, mate. The fucking demons in my head... fuck off back to your seat!\n\nRamsay overturns the customer\'s table.\n\nFADE OUT.\n\nTHE END.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Squid Game Season 2 Review: A Trainwreck in Slow Motion',
      body: 'In a baffling display of creative bankruptcy, Squid Game Season 2 manages to not only miss the cultural mark set by its groundbreaking predecessor but actively trips over itself and lands face-first into a pit of incoherent storytelling, cringe-worthy plot twists, and grotesque thematic choices.\n\nOne of the first glaring issues is the inexplicable decision to refer to the main character exclusively as "Squid" throughout the entire season. The season begins with a slow, murky buildup of tension—only to kneecap itself at the end of Episode 1, when on-screen text informs us that "The previous seven episodes were all a dream, and we are returning to what was going on seven episodes ago." What seven episodes? There was only one!\n\nIn perhaps one of the most tone-deaf moments in recent television history, a seemingly throwaway line establishes that the Squid Game Universe is set in an alternate reality where "Hitler won the Second World War." This time, the 100 contestants are not competing for money, dignity, or survival—they are playing for a vial of "feminine juices" extracted from a K-pop star, who is revealed to be Squid\'s sister.',
      effects: { reputation: -1 }
    },
    {
      headline: 'Tony Soprano Destroys TV Over Family Guy, Attacks Wife with Chicken Piccata',
      body: 'Tony Soprano walked into the living room, beer in hand, belly hanging out. Carmela was on the couch, deeply engrossed in an episode of Family Guy. Tony said, "Hey, Carm, I been thinkin\' of gettin\' one o\' dem penis enlargements."\n\nCarmela didn\'t even glance away from the TV, saying she was trying to watch Family Guy and wanted to see what happens next with Peter. Tony glared at the screen, saw Peter Griffin laughing maniacally as he farted on Lois\'s face. A deep, primal rage boiled in his gut.\n\nWithout a word, he picked up a decorative brick from the fireplace and hurled it full force at the TV. Sparks flew, the screen shattered, and Carmela screamed as the room went dark. Before she could react, Tony grabbed her by the hair and shoved her face into the steaming plate of chicken piccata on the coffee table. She let out a muffled shriek as sauce splattered everywhere.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Boulder Prank Goes Deadly: "Woah!" Shouted as Hikers Killed',
      body: 'A new "prank" has emerged that involves hiking halfway up a popular Boulder trail, locating a precariously balanced large boulder, and waiting until a visible group of women hikers appears below. The prank involves pushing the boulder loose so that it barrels down the slope toward them and kills them. As it begins its deadly descent, the prankster simply shouts "WOAH!"—as if amazed or caught off guard by the unfolding disaster.\n\nWhy it\'s funny? Because you said "woah!" Other pranks include throwing rocks at peaceful wildlife and maintaining a "Gay Man" prank performance across restaurants, bars, trailheads, and Uber rides, playing up stereotypical behavior without ever breaking character.',
      effects: { reputation: -4 }
    },
    {
      headline: 'Paul Thorne\'s Likeness Used in Shocking Video Game "Itchen Inferno"',
      body: 'In a baffling twist to one of the year\'s most surreal local scandals, Blue Star bus driver Paul Thorne—whose vehicle veered off the Northam Bridge and plunged into the River Itchen earlier this spring with 38 college students onboard—has reportedly sold the rights to his likeness for use in a high-budget video game inspired by the incident.\n\nThe game, titled "Itchen Inferno: Throttle of Doom," was developed by rogue indie studio Sump Games and billed as a "visceral, moral-choice-driven thriller" based on "real local events." In early press materials, Thorne was described as a "flawed but human protagonist." However, in an unfortunate and deeply humiliating development, the game\'s true premise only became apparent during its public launch party—hosted, at Thorne\'s insistence, at the Wetherspoons pub The Standing Order.\n\nEyewitnesses at the event report that Thorne, 69, arrived in high spirits, sporting a branded Itchen Inferno hoodie and "clinking Stella Artois bottles together like castanets." But as the in-game footage began rolling on the projector screen, his demeanor reportedly "collapsed like a dying lung."\n\nThe gameplay opens with players taking control of a college student onboard the bus moments before the crash. The objective? Acquire a hidden pistol, shoot an intoxicated Paul (depicted swigging vodka while steering), and wrest control of the vehicle before it careens into the river. Success is rewarded with a cutscene in which the students cheer, chanting: "Thank you for saving us from that man."\n\nThe game then veers into increasingly surreal territory. The final mission, titled "Womb Raider: Temporal Justice," sees the player travel back in time to assassinate Paul Thorne as an infant. Upon doing so, the timeline fractures, and the game shifts into a fully-fledged dating simulator, Mummy Issues, in which players seduce Paul\'s mother, start a new family with her, and—via a jarringly animated mini-game—"mash B to have sex."',
      effects: { reputation: -2 }
    },
    {
      headline: 'Brad Pitt Portrays Paul Thorne in Bizarre Biopic "Into the Itchen"',
      body: 'A film intended to honor a local hero has instead ignited a national firestorm after its bizarre premiere left audiences stunned and its subject humiliated.\n\nPaul Thorne, the retired Blue Star bus driver dubbed the "Hero on the Itchen" after narrowly surviving a dramatic crash in 2022, revealed last year that none other than Brad Pitt had been signed to portray him in an upcoming biopic. The project, backed by indie studio Sump Games.\n\nAt Tuesday\'s premiere of "Into the Itchen," Thorne, 71, was reportedly "visibly shaken" after witnessing Pitt appear on screen "completely unrecognisable," encased in over 400 pounds of prosthetic latex, including exaggerated facial features and what one reviewer described as "bizarrely cartoonish male breasts."\n\nThe film\'s opening scene immediately sparked outrage. It depicts the fictionalized Thorne ogling a group of 18-year-old college students boarding his bus, muttering cryptic phrases about "dark urges" before losing control of the vehicle in a surreal and heavily stylized crash sequence—one that critics say blurs the line between accident and self-indulgent parody. Many viewers were particularly disturbed by the suggestion—conveyed through exaggerated gestures and sound design—that the character is pleasuring himself while driving, a choice widely condemned as obscene and wholly inappropriate.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Noam Chomsky Dies During Shark-Watching Trip Organized by Hospice Staff',
      body: 'We are saddened to announce the passing of Professor Noam Chomsky, the esteemed linguist, political theorist, and intellectual giant. Professor Chomsky, who had been in a vegetative state for a year following a stroke and resided in a hospice, met a tragic end during a shark-watching trip organized by the hospice staff.\n\nDuring the outing, Professor Chomsky was taken on the shark-watching trip by the hospice staff. Upon sighting a large shark, he began grunting in a manner that led the staff to believe he was on the verge of yet another great contribution to socialist philosophy, but required a closer look at the shark. In an attempt to provide him with a better view, the staff lifted him, but their attention was diverted by another care home resident accidentally toppling overboard.\n\nTragically, in the chaos that ensued, the staff lost their grip on Professor Chomsky, and he too toppled overboard into the waters teeming with ravenous sharks. Despite their best efforts, Professor Chomsky was devoured by the sharks before he could be rescued.',
      effects: { reputation: -1 }
    },
    {
      headline: 'Noam Chomsky\'s Brain Stolen, National Lockdown Declared',
      body: 'In a shocking turn of events, chaos and panic have erupted as Professor Noam Chomsky, who has been in a vegetative state for a year, is suspected to have had his brain stolen! The alarming discovery was made during an MRI scan that revealed the startling absence of Chomsky\'s brain, sparking fears of a diabolical plot that has sent shockwaves across the nation.\n\nPresident Biden has responded to the crisis by imposing a national lockdown and granting unprecedented powers to the military to conduct house-to-house searches in a desperate bid to locate Chomsky\'s missing brain or the individual who may have absconded with it. The urgency of the situation was underscored by an unnamed government source who expressed grave concerns, stating, "The fear is that someone foreign could install the greatest brain in human history inside their own head and take over everything - real scary stuff."\n\nAdding to the already frenzied atmosphere, rumors have circulated that Chomsky may have had not just one, but three brains due to his extraordinary intellect and genius.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Noam Chomsky Reveals Plans for Polyamorous Triad in Afterlife',
      body: 'Noam Chomsky, the renowned linguist and political activist, shocked the world with his latest revelation in a recent media profile. In a candid interview, Chomsky disclosed his plans to invite his first wife, Carole, to join a "polyamorous triad" with his current wife, Valeria, in the afterlife. Chomsky, known for his groundbreaking theories on language and cognition, boldly stated that intelligent humans have evolved past monogamy.\n\nAs he delved into his vision for the afterlife, Chomsky went on an extended tangent, painting a vivid picture of how the arrangement would unfold. With a mischievous glint in his eye, he frequently paused to say "mmm" and reached to unbuckle his belt, before stopping himself with a chuckle. "I\'d be behind Valeria whilst Carole...mmm I can\'t say that out loud," he muttered, his words trailing off.',
      effects: { reputation: -1 }
    },
    {
      headline: 'Bev Stohl Pitches "Chomworld": Noam Chomsky-Themed Amusement Park',
      body: 'INT. EXECUTIVE BOARDROOM - DAY\n\nThe room is a sleek, modern corporate boardroom. A large mahogany table dominates the space, with EXECUTIVES sitting around it, some flipping through documents, others typing on laptops. At the head of the table stands BEV STOHL, late 50s, eccentric and frazzled, holding a battered briefcase and grinning eagerly.\n\nBEV STOHL\n\nThank you all for taking the time to meet with me today. I\'ve got a golden opportunity that\'s gonna make us all richer than a hedge fund manager in a bail-out year! (giggles awkwardly)\n\nEXECUTIVE 1\n(leaning back, skeptical)\nAnd this opportunity is...?\n\nBEV STOHL\n\n(chuckling)\nChomworld! A Noam Chomsky-themed amusement park!\n\nThe executives exchange bewildered glances.\n\nEXECUTIVE 2\n\n(leaning forward)\n\nChomsky? The linguist and political critic?\n\nBEV STOHL\n\n(nodding enthusiastically)\n\nExactly! Who wouldn\'t want to take their family on an exhilarating, educational journey into the mind of Noam Chomsky? And, of course, get a little richer along the way. (laughs nervously)\n\nEXECUTIVE 3\n\n(skeptical)\n\nYou\'re talking about a theme park... centered around Chomsky? What exactly are you envisioning here?\n\nBEV STOHL\n\nOh, lots of big ideas! Picture this: the park is filled with Chomsky lookalikes—people in costumes, dancing, singing... and they should be singing Disney songs!\n\nEXECUTIVE 1\n(frowning)\nDisney songs? Isn\'t that... problematic?\n\nBEV STOHL\n\n(scoffing)\n\nWhat are they going to do, sue us? Hahaha. It has to be Disney! Nothing else screams "fun" like "A Whole New World" but with a Chomsky twist! (giggles nervously again)\n\nEXECUTIVE 2\nAlright... and how do you plan to fund this?\n\nBEV STOHL\n\nWell, I probably have access to all of his money, which should be a good start. I\'ve also hired this really... um... competent lawyer who specializes in "groan analysis" to analyze Chomsky\'s guttural moans—you know, from the stroke—so we could, uh, legally secure his rights. (shifty eyes)\n\nThe executives exchange a look of growing concern.\n\nEXECUTIVE 3\n\n(slowly)\nGroan analysis? That\'s... new.\n\nBEV STOHL\n\n(ignoring them)\n\nAnd wait until you hear about the park\'s centerpiece: Chomlate! Chomsky-themed chocolate! Every bar could have little quotes or random linguistics terms embedded in them. Kids will love it!\n\nEXECUTIVE 1\n\n(skeptical)\n\nHow exactly does chocolate relate to Chomsky\'s work?\n\nBEV STOHL\n\n(shrugging)\n\nEh, who cares? It\'s chocolate! And, get this, we\'ll have an exhilarating, 4D virtual ride based on "Manufacturing Consent." Audience members sit in aggressively vibrating chairs while the first four chapters are read by a text-to-speech voice over loudspeakers. And water will be sprayed at them to make it more... immersive!\n\nEXECUTIVE 2\n\n(wincing)\n\nSo, just to clarify, you\'re suggesting that people pay to sit in vibrating chairs, get blasted with water, and listen to a robotic voice drone on about media manipulation?\n\nBEV STOHL\n\n(excited)\n\nExactly! (beat) And...uh...oh! There\'s going to be a sex-themed area too, where we can have, like, pornography playing...or something?\n\nThe executives collectively grimace.\n\nBEV STOHL\n(waving dismissively)\n\nAnyway, that\'s not all. The high-concept centerpiece to the park will be a gigantic, 60-foot animatronic Chomsky. It\'ll promise fame and riches to anyone who donates lots of money. And when they do, the waiver they sign will be shredded by naked strippers through a system of pulleys, while the animatronic Chomsky laughs maniacally, saying, "Ha ha ha ha! This is literally what capitalism does!"\n\nThe executives lean forward, now more curious than appalled.\n\nEXECUTIVE 3\n(interested)\n\nAnd where exactly would the donated money go?\n\nBEV STOHL\n\n(pulling out several large empty sacks with dollar signs on them)\n\nMaybe to me... or whatever. I\'ll make sure it gets spent wisely. (glances out the window longingly at a large seafront mansion)\n\nEXECUTIVE 1\n\n(concerned)\n\nYou...don\'t seem to have a clear plan. What\'s your next step if we were to proceed?\n\nBEV STOHL\n\n(suddenly clutching her stomach)\nUghh... my IBS is so bad today... hang on, I just need to use the toilet quickly.\n\nBev rushes out of the room. LOUD GRUNTING AND FARTING NOISES are heard from the bathroom. The executives stare at each other, speechless.\n\nEXECUTIVE 2\n\n(whispering)\n\nDid she just suggest using a real, intubated Chomsky in an exhibition?\n\nBEV STOHL\n\n(off-screen, shouting from the bathroom)\n\nYeah, yeah! The real Chomsky—intubated, recovering from a stroke! We could have feeding sessions where guests can pay a premium to feed him bugs or dirt! (flush) And they can pet him, stroke him, or even poke him with a small but firm stick! We could charge a fortune for that!\n\nEXECUTIVE 3\n\n(trying to process)\n\nPeople paying to... feed Chomsky bugs and poke him with a stick?\n\nBEV STOHL\n\n(re-entering the room, wiping her hands on her pants)\n\nYou got it! They\'d love it! Now, if you\'re not completely sold yet, how about this? To sweeten the deal, I\'ll throw in a little... personal entertainment.\n\nThe executives, suddenly intrigued, sit up straighter in their chairs.\n\nEXECUTIVE 1\n\nPersonal entertainment, you say?\n\nBEV STOHL\n\n(raising an eyebrow)\n\nYou know... something a little more intimate. Like, say... a striptease?\n\nThe executives exchange eager glances, their skepticism fading.\n\nEXECUTIVE 2\n(smiling)\nWell, Bev, you\'ve got our attention.\n\nBev, with a mischievous grin, begins to unbutton her blouse. The executives lean in closer, their excitement palpable. The room is filled with their moans of pleasure as they murmur things like "Mmm, fuck..." and "Chomsky would love this."\n\nEXECUTIVE 3\n\n(breathlessly)\n\nOh yeah... Chomsky would definitely approve.\n\nBev continues her striptease, moving awkwardly but with growing confidence, as the executives lose themselves in the absurdity of it all. The scene fades to black, with their collective groans echoing in the darkness.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Korean President Han Defends Plane Explosion as "Good Thing"',
      body: 'In a presidential press briefing, President Han addressed the nation about a plane that exploded. "Anyway... it turns out this was actually... a good thing," he declared to gasps from the audience.\n\n"Because—and hold onto your seats, folks—it turns out the passengers on that plane were actually... a North Korean splinter cell! That\'s right, they were planning to enact what they were calling... Korean 9/11! And they were going to fly right into the... \'Korean Twin Towers!\'"\n\nWhen journalists pointed out there\'s no such thing as "Korean Twin Towers," Han claimed the children on board were actually North Koreans using a "transformation device" to make them resemble kids, or "M-words." Han then announced that to prevent this from happening again, they\'ve taken the precaution of "loading all passenger jets with... C4 explosives!"\n\nLater, Han claimed new information revealed this was actually "Real Life Squid Game," and introduced "Squid" from the TV show to confirm the passengers were contestants who "unfortunately lost."',
      effects: { reputation: -3 }
    },
    {
      headline: 'Ben Burgis\'s Date Disaster: Food Obsession Leads to Ice Cream Stand Brawl',
      body: 'Ben Burgis, an overweight, unkempt professor of logic and socialist writer, was out on a date with a woman. She was sincerely trying to engage him in conversation about his philosophical views, but Ben\'s mind was singularly focused on his obsession with food.\n\nWOMAN: (smiling) So, Ben, I\'ve been really interested in your essays on socialist ethics. How do you see the role of logic in shaping ethical principles?\n\nBEN: (eyes glazing over, almost drooling) Mmm, logic, yeah... but you know what\'s really logical? (licks lips) Chocolate fudge. Oh, the way it just melts, creamy and sweet on your tongue... mmm. Have you ever had the fudge from Maple Street? It\'s like... (pauses, shudders with pleasure) It\'s like nothing else matters. Not logic, not ethics... just that rich, gooey choccy fudge.\n\nWOMAN: (trying to steer the conversation back) That sounds delicious, but I\'m curious—how do you apply that logical mindset to your work in socialist theory?\n\nBEN: (interrupting, a little too loud) Oh, crisps! Crispy, salty... mmm. (begins to smack his lips) Did you know the secret to the perfect crisp? It\'s all in the salt, you see. Mmm, just thinking about it makes my mouth water. It\'s like... It\'s like a dance on your tongue. (he mimes eating crisps, eyes half-closed in ecstasy)\n\nThey arrive at the ice cream stand, and Ben\'s eyes immediately widen as he sees the long line. His cheerful demeanor darkens as he stares at the queue, fidgeting with growing impatience.\n\nBEN: (muttering under his breath) What the...? This is ridiculous! I\'ve been dreaming about this for days, and now... now I have to wait? (his voice rising, more frantic) All these people—what do they know about ice cream? I bet they just decided to come here on a whim! It\'s not fair!\n\nWOMAN: (softly, trying to calm him) It\'s just a line, Ben. We\'ll get there soon enough. Maybe we can talk while we wait?\n\nBEN: (ignoring her, his agitation growing) Do you think any of them really appreciate good ice cream? I bet they don\'t even know the first thing about it. (his voice turning condescending) I bet they don\'t even know that ice cream was first invented in China. Pathetic, really... (suddenly, to her, more intense) Who do you think here could even come close to understanding that? Who here has any clue what real indulgence is?\n\nWOMAN: (hesitant, trying again) What do you usually do in your spare time, Ben? Any hobbies?\n\nBEN: (ignoring her, fixating on the menu) Butter... mmm... why don\'t they have butter? How can they call themselves an ice cream stand and not offer butter? (he smacks his lips, visibly distracted by the thought) But wait... cheeseburgers. (grinning) They\'ve got cheeseburgers. Mmm, juicy cheeseburgers... (he visibly shudders) I might get two. (pauses, thinking) Maybe... three. I\'m already worried I won\'t feel full enough after we eat... what If I\'m still hungry later?\n\nAs they inch closer to the front of the line, Ben\'s irritation mounts, his eyes darting around as his agitation boils over. He begins to grumble louder, his face reddening with frustration.\n\nBEN: (grumbling, barely coherent) It\'s so unfair... I\'ve been waiting for this... mmm... and now... this! (he bites his lip in fury, glaring at the man in front of him) I\'m about to do something I should have done a long time ago!\n\nWithout warning, Ben aggressively shoves the man in front of him, his face contorted with rage. As soon as he does, he whirls around and aggressively shoves his date, biting his lip harder as she stumbles backward and falls to the ground. The crowd gasps in shock as the man he shoved spins back around and punches Ben, sending him crashing to the ground. Ben\'s expression shifts from shock to an exaggerated display of distress.\n\nBEN: (shrieking, his voice high-pitched and trembling) ASSAULT! ASSAULT! Help me! Someone help!\n\nBen, now on the ground, begins to visibly wet himself, his face a mixture of humiliation and panic. The onlookers, instead of rushing to his aid, begin to murmur and shout, their voices growing louder and more threatening.\n\nCROWD MEMBER 1: Stomp on his head!\n\nCROWD MEMBER 2: Yeah, teach him a lesson!\n\nCROWD MEMBER 3: Set that fucking dog on him!\n\nThe camera shifts to reveal a snarling pitbull on a leash, its owner loosening his grip. The dog is freed, and the scene ends with the sound of teeth gnashing and Ben\'s terrified screams, as the crowd cheers and laughs.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Ben Burgis\'s "Heavy Truth" Speech: Food Obsession Overshadows Hunger Message',
      body: 'INT. A LARGE CONFERENCE ROOM - DAY\n\nThe room is packed with people holding signs and banners reading "End Hunger Now." The atmosphere is charged with energy and anticipation. On the stage, a banner with the same slogan hangs above a podium. The crowd quiets as PROFESSOR BEN BURGIS, a morbidly obese, left-wing professor of logic, steps up to the podium. He\'s slightly out of breath but determined. He adjusts the microphone, and the crowd applauds.\n\nBEN BURGIS:\n\nThank you, everyone. We are here today to talk about a crucial issue that affects millions of people worldwide—hunger and poverty. These are issues that should concern every one of us, because a society that allows its members to go hungry is a society that has failed.\n\nThe crowd nods and claps in agreement. Ben pauses, catching his breath slightly.\n\nBEN BURGIS:\n\nNow, when we talk about ending hunger, we often think about the basics—rice, beans, bread. But let\'s not forget the joy, the pure pleasure that food can bring. Imagine a world where everyone could indulge in the simple, comforting delight of cookies, crisps, choccy, fudge...\n\nAs Ben lists these foods, he begins to drool slightly, wiping his mouth with a handkerchief. He chuckles, a bit embarrassed.\n\nBEN BURGIS:\n\n(laughing)\n\nSorry, folks... just lost my train of thought there. The idea of the salty taste of crisps combined with the rich, juicy meat of a McDonald\'s burger, and the sweetness of choccy... it\'s enough to make anyone\'s mind wander, right? But back to the matter at hand...\n\nBen pauses again, this time clutching his chest briefly as he catches his breath. The crowd looks on, some with concern, others with a mix of discomfort and judgment.\n\nBEN BURGIS:\n\n(chuckling)\n\nOh, don\'t mind me. Just normal guy problems, heh... just a little chest ache. But let\'s get back to what\'s important—ensuring that everyone, regardless of their situation, has the right to experience these joys.\n\nHe continues, but his mind seems to drift again.\n\nBEN BURGIS:\n\nBecause when you think about it... the combination of flavors in something as simple as a Big Mac—the savory beef, the tangy sauce, the crisp lettuce, all balanced by the sweetness of a soda—sorry, lost my train of thought again...\n\nHe wipes his brow, visibly winded, but presses on.\n\nBEN BURGIS:\n\n(forcing a laugh)\n\nSorry about that, folks. Just a little scare. But you know what? Through the power of positive thought and self-love, I\'m back on my feet. Because that\'s what really keeps us going, isn\'t it? Love for ourselves, love for each other... and a good slice of pizza when we need it.\n\nThe crowd begins to murmur, the concern mixed with incredulity. Ben, however, continues on, determined to finish his speech.\n\nBEN BURGIS:\n\nAnd it\'s not just about surviving; it\'s about living. Living in a world where a kid doesn\'t just get bread, but also gets a slice of pizza. Where no one is denied the simple pleasure of a fresh donut, with the glaze melting into the soft, warm dough...\n\nHe wipes his brow, visibly winded, but presses on.\n\nBEN BURGIS:\n\nWe need to fight to make sure that everyone can enjoy these simple pleasures. Food isn\'t just sustenance; it\'s joy, it\'s comfort, it\'s connection.\n\nSuddenly, Ben appears to collapse, clutching his chest in what seems to be a heart attack. The crowd gasps, some rising from their seats in alarm. But just as quickly as he goes down, Ben straightens up, taking a deep breath and smiling weakly.\n\nBen pauses, once again clutching his chest, this time struggling a bit more to catch his breath.\n\nBEN BURGIS:\n\n(weakly chuckling)\n\nSorry again, just another little chest ache... But what\'s truly disgusting, my friends, is a world where anyone goes hungry. What\'s disgusting is judging someone based on their appearance, rather than their actions, their character, their heart.\n\nThe camera pans over the crowd, showing mixed reactions—some concerned, others incredulous. Two individuals exchange glances, one whispering to the other.\n\nCROWD MEMBER 1:\n(whispering)\n\nMy god, that man is disgusting.\n\nCROWD MEMBER 2:\n(nodding in agreement)\n\nYeah... It\'s hard to watch.\n\nAs the crowd murmurs, the voice of a narrator suddenly cuts in.\n\nNARRATOR (V.O.):\nThe vile audience members were wrong. Ben was right. The end.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Pele\'s Estate Transferred to Bitcoin Instead of Children',
      body: 'It is with a heavy heart that I stand before you today to deliver the news of Pele\'s death. Pele was a great man, and a great athlete, and his passing leaves a hole in the world that can never be filled.\n\nBut Pele was more than just a great athlete. He was a visionary, and a pioneer. He was the first person to see the potential of Bitcoin, and he was the first to invest in it.\n\nIt was Pele\'s dying wish that his assets be transferred to Bitcoin, rather than his own children. And I am here today to make sure that his wishes are carried out. If the children attempt to interfere with Pele\'s estate, we will take legal action against them. Pele\'s assets belong to Bitcoin, and Bitcoin alone.',
      effects: { reputation: 0 }
    },
    {
      headline: 'Cookie Monster Reveals Pornography and Gambling Addiction',
      body: 'Hi, me Cookie Monster. Some of you may be wondering why me not been on the show lately. And it is because me been going through some tough times.\n\nYou see, for a long time now, me been struggling with a pornography and gambling addiction. It all started innocently enough, with me watching a little bit of porn here and there. But then me started gambling, and before me knew it, me was up to my eyeballs.\n\nBut recently, some interns on the show have been accusing me of sexual impropriety. And they\'re right. It\'s true. Me have been behaving inappropriately with them. But me want you to know that me are sorry. Me are sorry for the pain me have caused. And me are committed to getting help for my addiction.',
      effects: { reputation: -2 }
    },
    {
      headline: 'Controversial "Moneybags" Trial Ends with Not Guilty Verdict',
      body: 'After a trial that captured national attention, Bendy Krendy has been found not guilty of attempted bribery of Judge Dalton B. Krelmor. The decision came after Judge Krelmor overturned the jury\'s unanimous guilty verdict, citing his "strong gut feeling" that the defendant was innocent.\n\nKrendy was charged with attempting to bribe Judge Krelmor with a bag full of $10 million, after CCTV footage of the bribe, complete with dialogue ("this is a bribe") was released to local news. In a controversial move, Judge Krelmor was chosen to oversee the trial, and allowed the Defense to present several psychics as witnesses, who all denied that Krendy had committed bribery.\n\nAt the trial\'s conclusion the jury returned a unanimous "guilty" verdict, which the judge immediately overturned, explaining that he had a "strong gut feeling" that the defendant was innocent, and that "evidence is one thing, but instinct is much more important," threatening to find the jury in contempt of court for making the wrong decision. Krendy was caught on camera making a \'throat-slitting\' motion to the jury, which Judge Krelmor said he found "disturbing".\n\nKrendy\'s attorney, Barry Snodgrass, said he was "delighted" with the verdict and that his client was "looking forward to getting on with his life". When asked about the $10 million Krendy had offered to the judge, Snodgrass said he accepted the explanation provided by one of the psychics on the stand, that the video footage of the incident had been a "spontaneous hallucination" experienced simultaneously by millions of people at once when it was on the news, and then several further times when the video was played at trial, and that the footage didn\'t actually exist.\n\nThe decision has been met with outrage by many, who say that Krendy should have been found guilty of attempted bribery, and that Judge Krelmor\'s decision was a miscarriage of justice. Judge Krelmor has been heavily criticized for his decision to allow the Defense to present several psychics as witnesses, and for overturning the jury\'s verdict. He was last seen leaving the courthouse with a large bag of money, which he refused to comment on.',
      effects: { reputation: -3 }
    },
    {
      headline: 'Vicar Sees Ghost of Susan Nipwood at Funeral, Ghost Requests William Hill Deposit',
      body: 'INT. CHURCH - DAY\n\nA sombre congregation fills the pews. Candles flicker. ORGAN MUSIC fades. The VICAR (60s) stands at the lectern.\n\nVICAR\nIt is with great sadness that we gather here today to say goodbye to Susan Nipwood. She will be sorely missed by all who knew her.\n\nA hush. A cold draft snakes through the nave. GASPS as a faint, translucent figure materialises beside the coffin: SUSAN\'S GHOST.\n\nSUSAN\'S GHOST (echoing)\nWILLIAM HILL.\n\nVICAR (blanching)\nSusan...?\n\nSUSAN\'S GHOST\nDEPOSIT ONE HUNDRED POUNDS AT WILLIAM HILL.\n\nMOURNER #1 (whispering)\nDid she say... a deposit?\n\nMOURNER #2 (hushed)\nIt\'s a sign. A very specific sign.\n\nVICAR (finding composure)\nLadies and gentlemen, it appears Susan has one final earthly request.\n\nThe ghost points upward; ethereal text shimmers: "CHELTENHAM MADNESS BONUS THIS WEEKEND."\n\nSUSAN\'S GHOST (gentle)\nDO IT NOW. FOR ME.\n\nThe congregation nods, some already tapping on their phones. The VICAR closes his eyes, moved.\n\nVICAR\nThen so it shall be.\n\nCUT TO:\n\nINT. CHURCH VESTRY - MOMENTS LATER\n\nThe VICAR, alone, clasps his hands. A donation plate sits beside a parish iPad. On-screen: "Deposit £100 — William Hill." He hesitates, then taps CONFIRM.\n\nVICAR (softly)\nRest easy, Susan.\n\nA soft CHIME. The chill in the air lifts.\n\nBACK TO:\n\nINT. CHURCH - CONTINUOUS\n\nSUSAN\'S GHOST smiles, fades like morning mist. The congregation exhales as one.\n\nVICAR (to congregation)\nRequiescat in pace. And... check terms and conditions.\n\nFADE OUT.',
      effects: { reputation: -1 }
    },
    {
      headline: 'Scientists Announce Universe Collision: Super Smash Bros Meets Sex-Themed Universe',
      body: 'Scientists have announced that our universe has collided with the super smash bros universe, and also with a third \'sex themed\' universe. The consequences of this collision are still being studied, but it is believed that the three universes have now become one.\n\nThis merger has caused some strange changes in our universe. For example, people are now able to transform into various characters from the super smash bros universe. Some people are even able to transform into characters from the sex themed universe.',
      effects: { reputation: 0 }
    },
    {
      headline: 'Kendrick Lamar Concert Descends into Chaos Over N-Word Controversy',
      body: 'At a Kendrick Lamar concert, the rapper announced: "Alright, we\'re about to play my new song, \'Whats Good Nigga\'. I want one lucky white woman to come up on stage and sing it with me."\n\nA white woman got on stage, and Kendrick said: "Now, when I say \'What\'s good\', I want you to say \'nigga\', it\'s how the song be going." The woman hesitated, but Kendrick reassured her: "It\'s okay, I\'ve given you permission. Nothing bad will happen."\n\nKendrick and the woman rapped "What\'s Good" together, and at the end, the woman said "nigga." The crowd reacted in horror. Kendrick shouted: "What the fuck?! You can\'t say that word!" The audience chanted "shoot her! Shoot her!" Kendrick asked "shall I shoot this bitch?" The audience responded "YES!" and Kendrick shot and killed the woman. Kendrick then promoted the "Cheltenham madness offer on Bet365" before opening fire into the audience.',
      effects: { reputation: -4 }
    },
    {
      headline: 'Grocery Store Abduction: Parents Report to Manager Instead of Intervening',
      body: 'Mary and John were shopping for groceries with their 2-year-old son, Timmy. As they walked down the aisle, Timmy ran ahead of them and disappeared around the corner. Mary quickly ran around the corner to find her son being abducted by a criminal. The criminal had Timmy by the arm and was pulling him away.\n\nMary tried to run to stop the abduction in process, but was held back by her husband, John. "Wait, honey. He looks like a bad guy. We should keep our distance and report this to the store manager," John said.\n\nMary reluctantly agreed and they went to find the store manager. John said: "Phew, I\'m sure glad we didn\'t get mixed up in that, what a scary situation." Mary responded: "Yeah, one of us could have been hurt!" When Mary asked "What about Timmy?" John put his hand on his chest and said: "He\'s in here Mary. In our hearts. Where the pedos can never catch him."',
      effects: { reputation: -2 }
    },
    {
      headline: 'Juror Moans Uncontrollably During Explicit Evidence in Courtroom',
      body: 'PROSECUTOR: Ladies and gentlemen of the jury, we have evidence that the defendant has been filming women use public restrooms.\n\n(The prosecutor plays a video of the defendant filming a woman defecating in a public restroom.)\n\nJUROR NUMBER 2: (Involuntarily moaning in pleasure)\n\nPROSECUTOR: As you can see, the defendant is filming this woman without her knowledge or consent.\n\nJUROR NUMBER 2: (Moaning louder)\n\nPROSECUTOR: This is a clear violation of her privacy.\n\nJUROR NUMBER 2: (Moaning even louder)\n\nPROSECUTOR: Would you like to see some more footage, Mr. Juror Number 2?\n\nJUROR NUMBER 2: (Moaning uncontrollably) Yes, please! Zoom in so I can be 100% sure!\n\n(The prosecutor zooms in on the footage, and Juror Number 2 continues to moan in pleasure.)\n\nJUROR NUMBER 2: (Moaning) This is so hot... I can\'t believe I\'m getting off to this!\n\n(The other jurors start to look uncomfortable, and some start to leave the courtroom.)',
      effects: { reputation: -3 }
    },
    {
      headline: 'Gerry and Kate McCann Star in William Hill Gambling Commercial',
      body: 'Gerry McCann: "Hi, I\'m Gerry McCann and this is my wife, Kate. We both love to gamble with William Hill. And we\'ve been gambling with them for years. It\'s so easy to set up an account and get started. Plus, they have some great promotions and bonuses."\n\nKate: "And if you\'re feeling lucky, you can even play on your phone! And when it comes to luck, nobody knows more about it than us." [Both laugh]\n\nGerry: "What can I say? We\'ve had our share of luck — and our share of bad luck. [He pauses for a beat] Like our daughter, Madeleine." [Cut to a wide shot of Gerry and Kate, who are laughing]\n\nKate: "Well, while we no longer have our daughter, at least we still have the William Hill app!" Gerry: "That\'s right. You know what they say, they\'re always in the last place you look! Let\'s just hope the police don\'t look too closely at us!"\n\nAnnouncer: "Madeleine or no Madeleine, you can have a flutter with William Hill. Sign up today and get a bonus!"',
      effects: { reputation: -4 }
    },
    {
      headline: '\'Reality Show\' Draws Fire Over Exploitative Premise and Controversial Content',
      body: 'The entertainment world is embroiled in controversy over Reality Show, a new program billed as "the most daring experiment in reality television." The series follows Kezril, a 22-year-old woman with a rare developmental condition that causes her to look like an 8-year-old child, as she seeks romantic connections with men she claims to be "exclusively attracted to"—pedophiles.\n\nLeaked Pitch Meeting Highlights Laziness and Cynicism\n\nIn a leaked transcript from the show\'s pitch meeting, executives are heard brainstorming the show\'s concept while gorging on "money donuts"—a novelty dessert filled with edible cash.\n\nThe transcript reveals a remarkable lack of thoughtfulness, with the executives marveling at the idea of naming the series Reality Show.\n\nEXECUTIVE 1\n(speaking while chewing)\n\nWhat if... hear me out... we just call it Reality Show?\n\nEXECUTIVE 2\n(enthusiastically)\n\nGenius. That way, people know exactly what it is.',
      effects: { reputation: -3 }
    },
    {
      headline: 'FIFA: Audience Mode - An Offensive, Buggy and Shallow Experience',
      body: '"FIFA: Audience" is the new, much hyped sim from EA sports. In the game, you take control of a bald, white forty to fifty year old, who attends football games to ostensibly show support for his team.\n\nThe game begins as soon as the player boards the bus to the game, and ends when he leaves the stadium. To interact with the game, players only have two options; \'coin\' and \'disdain\'. \'Coin\' is used to have the player throw coins or bananas, and \'disdain\' has the player brandish his middle finger and boo.\n\nNot only does this encourage an anti-social and violent experience, the game also uses points and rewards to encourage such behaviour. Players receive points and bonuses for every person they hit with a coin or banana, regardless of which team that person plays for. Additionally, there is no positive way to show your support for the team you are supporting - you cannot cheer, only boo and stick your middle finger up - even when your team wins. The game doles out rewards on the basis of how many times you restively mash the buttons during the game, and by how many people you pelt with coins and bananas.\n\nThere is very little downside to such behavior in the game - incidents of violence are met with a "wanted" level, ripped straight off grand theft auto, in which stewards pursue you in the ground, but who are easily fought off with (you guessed it) coins and bananas. In the event you are caught you are inexplicably hauled in front of the board of directors, who hold a disciplinary meeting in which you can only boo and throw coins, and which ends with the board telling you you have "one more chance", every time.\n\nThe game presents several deeply bizarre and offensive "events" throughout the course of the play through: hooliganism, racism and sexism to name a few. In one such event, you must egg a group of female supporters and score points based on how well you succeed in hitting the women.\n\nIn another mission, your team are down by 4 goals and your best mate \'Eggy\' sets you the objective of inciting a riot to have the game called off, which you achieve by throwing coins at children supporting your own team.\n\nThe narrative of the game inexplicably centers around the protagonist\'s bid to "reclaim what\'s rightfully his" while he continues to egg and harass both his rivals and his team of choice. This plot is set to the backdrop of Sheffield Wednesday announcing the re-opening of Hillsborough stadium\'s standing sections and newly increased audience capacity. Sure enough, the final match of the campaign takes place at the new stadium\'s inauguration; 5 seconds after kick-off you hear John Motson say "oh no, it\'s happening again!" And the rest of the level is spent shoving children into the crush as you desperately attempt to escape, booing the whole time. In another level you take part in a raucous celebratory pitch invasion following a cup win, and the player can choose whether to \'coin or disdain\' several birds he finds nesting in the rafters of the stadium.\n\nAll in all, "FIFA: Audience" is an offensive, buggy and shallow experience that lacks any meaningful insight into the culture of football fandom. The game encourages, rewards and celebrates the very worst aspects of football fandom, feeling more like a \'crime simulator\' than an educational experience of what it\'s like to support a team.\n\nAnd this nihilistic, ugly game bears the endorsement and brand of international football\'s governing body. When pressed for comment, FIFA said the following: "We believe in the power of football to bring people together, and we hope and expect that those who engage with FIFA Audience mode do so with respect for the values of the beautiful game - this is a game which emphasizes player freedom - At no point is the player obliged to harm children or women - they are free to instead choose to fail the level and get game over."\n\nLet\'s hope they\'re right, or we could all end up hopping on the bus to the next match with a bag full of coins and a head full of disdain.',
      effects: { reputation: -4 }
    }
  ];
  
  // Randomly select a story from the array (randomized order)
  const randomIndex = Math.floor(Math.random() * stories.length);
  const story = stories[randomIndex];
  
  return createStory(
    'politics',
    story.headline,
    story.body,
    {},
    story.effects,
    'auto',
    0,
    []
  );
}

// Sports section - contextual match stories
function generateSportsStory() {
  // Use the opponent we just played (from matchContext, not currentOpponent which gives next opponent)
  const matchOpp = S.matchContext || {};
  
  // Get current club name (supports renaming after nuclear option)
  const clubName = getClubName();
  
  // Fallback mechanism: if matchContext doesn't have team info, use the opponents array
  const opponent = matchOpp.team || 
    (Array.isArray(S.opponents) && S.opponents[S.matches_played - 1]) 
      ? S.opponents[S.matches_played - 1] 
      : 'Opposition';
  
  const manager = matchOpp.manager || 
    (Array.isArray(S.opponentManagers) && S.opponentManagers[S.matches_played - 1])
      ? S.opponentManagers[S.matches_played - 1]
      : 'Opposing Manager';
  
  // Get match result (if available)
  const lastMatchResult = S.lastMatchResult || { homeGoals: 0, awayGoals: 0 };
  const homeGoals = lastMatchResult.homeGoals ?? 0;
  const awayGoals = lastMatchResult.awayGoals ?? 0;
  
  // Debug: log the actual match result being used
  console.log(`DEBUG: generateSportsStory - homeGoals: ${homeGoals}, awayGoals: ${awayGoals}, opponent: ${opponent}, manager: ${manager}`);
  console.log(`DEBUG: S.lastMatchResult:`, S.lastMatchResult);
  console.log(`DEBUG: S.matchContext:`, S.matchContext);
  console.log(`DEBUG: S.matches_played:`, S.matches_played);
  console.log(`DEBUG: S.opponents[${S.matches_played - 1}]:`, S.opponents?.[S.matches_played - 1]);
  console.log(`DEBUG: S.opponentManagers[${S.matches_played - 1}]:`, S.opponentManagers?.[S.matches_played - 1]);
  const weWon = homeGoals > awayGoals;
  const theyWon = awayGoals > homeGoals;
  const wasDraw = homeGoals === awayGoals;
  
  // Generate shenanigan type - only include bribery if it actually happened
  const shenanigans = [
    {
      type: 'cocaine',
      templates: [
        `${clubName} allegedly had some interesting pre-match preparations involving white powder`,
        `Reports suggest ${clubName} players were allegedly seen with suspicious substances before the match`,
        `Rumors of alleged cocaine use in the ${clubName} dressing room have surfaced`
      ],
      effects: { reputation: -2 }
    },
    {
      type: 'arrest',
      templates: [
        `${clubName} players were allegedly involved in a pre-match incident that required police attention`,
        `Reports suggest ${clubName} players allegedly had a run-in with law enforcement before the match`,
        `Rumors of alleged arrests involving ${clubName} players have surfaced`
      ],
      effects: { reputation: -4 }
    },
    {
      type: 'doping',
      templates: [
        `${clubName} allegedly used performance-enhancing substances before the match`,
        `Reports suggest ${clubName} players allegedly had access to banned substances`,
        `Rumors of alleged doping practices at ${clubName} have emerged`
      ],
      effects: { reputation: -5 }
    }
  ];
  
  // Only add bribery shenanigans if bribery actually occurred
  if (S.referee_bribed || S.opponent_bribed || S.bribery_attempted) {
    shenanigans.push({
      type: 'bribe',
      templates: [
        `${clubName} allegedly attempted to influence the match through financial means`,
        `Reports suggest ${clubName} allegedly offered financial incentives to key match officials`,
        `Rumors of alleged bribery attempts by ${clubName} have emerged`
      ],
      effects: { reputation: -3 }
    });
  }
  
  const shenanigan = shenanigans[Math.floor(Math.random() * shenanigans.length)];
  const template = shenanigan.templates[Math.floor(Math.random() * shenanigan.templates.length)];
  
  let resultText = '';
  if (weWon) {
    resultText = `${clubName} secured a ${homeGoals}-${awayGoals} victory over ${opponent}`;
  } else if (theyWon) {
    resultText = `${clubName} suffered a ${homeGoals}-${awayGoals} defeat to ${opponent}`;
  } else {
    resultText = `${clubName} played out a ${homeGoals}-${awayGoals} draw with ${opponent}`;
  }
  
  const headline = `${clubName} vs ${opponent}: ${resultText}`;
  const body = `${resultText}. However, ${template}. The match was managed by ${manager}.`;
  
  return createStory(
    'sports',
    headline,
    body,
    { opponent, manager },
    shenanigan.effects,
    'auto',
    0,
    []
  );
}


// Auto-generate stories after each match
function generatePostMatchStories() {
  // Use the current match number (matches_played has already been incremented)
  const currentMatch = S.matches_played || 0;
  if (S.press?.lastMatchStoriesGenerated === currentMatch) {
    return; // Already generated stories for this match
  }
  
  // Mark that we've generated stories for this match
  if (!S.press) S.press = {};
  S.press.lastMatchStoriesGenerated = currentMatch;
  
  // Always generate one Sports story
  const sportsStory = generateSportsStory();
  queueStory(sportsStory);
  // Automatically archive the story (publish it) regardless of whether user opens it
  publishStory(sportsStory);
  // Remove from queue to avoid double-publishing when user opens the section
  if (S.press.queue) {
    const index = S.press.queue.findIndex(s => s.id === sportsStory.id);
    if (index > -1) {
      S.press.queue.splice(index, 1);
    }
  }
  
  // Always generate one Politics story
  const politicsStory = generatePoliticsStory();
  queueStory(politicsStory);
  // Automatically archive the story (publish it) regardless of whether user opens it
  publishStory(politicsStory);
  // Remove from queue to avoid double-publishing when user opens the section
  if (S.press.queue) {
    const index = S.press.queue.findIndex(s => s.id === politicsStory.id);
    if (index > -1) {
      S.press.queue.splice(index, 1);
    }
  }
}


// Generate unique story ID
function generateStoryId() {
  return 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}


// Simple token replacement system
function replaceTokens(template, tokens) {
  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || 'Unknown');
  }
  return result;
}

// Create a story object
function createStory(section, headline, body, tokens = {}, effects = {}, source = 'auto', severity = 0, flags = []) {
  return {
    id: generateStoryId(),
    section,
    writer: getNextWriter(),
    headline,
    body,
    tokens,
    effects,
    source,
    severity,
    flags,
    created: Date.now(),
    publishAfter: Date.now() // Publish immediately
  };
}

// Queue a story for publishing
function queueStory(story) {
  if (!S.press.queue) S.press.queue = [];
  S.press.queue.push(story);
  console.log(`Queued ${story.section} story: ${story.headline}`);
  // Mark unread for HUD indicator
  S.news_unread = true;
}

// Publish stories from queue (respecting caps and cooldowns)
function publishStoriesFromQueue() {
  if (!S.press.queue || S.press.queue.length === 0) return;
  
  const published = { politics: 0, sports: 0, gossip: 0 };
  
  // Helper function to check if story is ready to publish
  const isReadyToPublish = (story) => {
    // Check both publishAt and publishAfter properties for compatibility
    if (story.publishAt !== undefined && Date.now() < story.publishAt) return false;
    if (story.publishAfter !== undefined && Date.now() < story.publishAfter) return false;
    return true;
  };
  
  // Helper function to check if story is a special/priority story
  const isSpecialStory = (story) => {
    const specialIds = [
      'shafty_rod_johnson_arrest',
      'shafty_rod_johnson_under12s_arrest',
      'stadium_attack_followup'
    ];
    const specialSources = [
      'portsmouth_bus_under12s_story',
      'stadium_attack_followup'
    ];
    const headlineText = story.headline || story.headlineTemplate || '';
    return specialIds.includes(story.id) || 
           specialSources.includes(story.source) ||
           headlineText.includes('Shafty Rod Johnson') ||
           headlineText.includes('Kuddle Cronster') ||
           headlineText.includes('ST MARY\'S ATTACK') ||
           headlineText.includes('St Mary\'s');
  };
  
  // Collect stories to publish, prioritizing special stories
  const storiesToPublish = [];
  
  // First pass: collect special stories
  for (let i = S.press.queue.length - 1; i >= 0; i--) {
    const story = S.press.queue[i];
    
    if (!isReadyToPublish(story)) continue;
    if (S.press.cooldowns[story.section] > 0) continue;
    if (published[story.section] >= 1) continue;
    if (!isSpecialStory(story)) continue;
    
    storiesToPublish.push({ story, index: i });
  }
  
  // Second pass: collect regular stories
  for (let i = S.press.queue.length - 1; i >= 0; i--) {
    const story = S.press.queue[i];
    
    if (!isReadyToPublish(story)) continue;
    if (S.press.cooldowns[story.section] > 0) continue;
    if (published[story.section] >= 1) continue;
    if (isSpecialStory(story)) continue; // Skip if already collected
    
    storiesToPublish.push({ story, index: i });
  }
  
  // Sort by creation time (oldest first to respect order)
  storiesToPublish.sort((a, b) => (a.story.created || a.story.createdAt || 0) - (b.story.created || b.story.createdAt || 0));
  
  // Process stories (from end backwards to maintain correct indices)
  for (let i = storiesToPublish.length - 1; i >= 0; i--) {
    const { story, index } = storiesToPublish[i];
    
    if (published[story.section] >= 1) continue;
    
    // Publish the story
    publishStory(story);
    published[story.section]++;
    
    // Set cooldown
    S.press.cooldowns[story.section] = 1;
    
    // Remove from queue (process from end to maintain indices)
    S.press.queue.splice(index, 1);
  }
}

// Publish stories from queue for a specific section only
function publishStoriesFromQueueForSection(selectedSection) {
  if (!S.press.queue || S.press.queue.length === 0) return;
  
  // Helper function to check if story is ready to publish
  const isReadyToPublish = (story) => {
    // Check both publishAt and publishAfter properties for compatibility
    if (story.publishAt !== undefined && Date.now() < story.publishAt) return false;
    if (story.publishAfter !== undefined && Date.now() < story.publishAfter) return false;
    return true;
  };
  
  // Helper function to check if story is a special/priority story
  const isSpecialStory = (story) => {
    const specialIds = [
      'shafty_rod_johnson_arrest',
      'shafty_rod_johnson_under12s_arrest',
      'stadium_attack_followup'
    ];
    const specialSources = [
      'portsmouth_bus_under12s_story',
      'stadium_attack_followup'
    ];
    const headlineText = story.headline || story.headlineTemplate || '';
    return specialIds.includes(story.id) || 
           specialSources.includes(story.source) ||
           headlineText.includes('Shafty Rod Johnson') ||
           headlineText.includes('Kuddle Cronster') ||
           headlineText.includes('Starmer') ||
           headlineText.includes('ST MARY\'S ATTACK') ||
           headlineText.includes('St Mary\'s') ||
           headlineText.includes('Portsmouth Bus');
  };
  
  // Separate special stories from regular stories
  // Special stories bypass cooldowns - they should always be published when available
  const specialStories = S.press.queue.filter(story => {
    if (selectedSection !== 'all' && story.section !== selectedSection) return false;
    if (!isReadyToPublish(story)) return false;
    // Special stories bypass cooldowns
    return isSpecialStory(story);
  });
  
  const regularStories = S.press.queue.filter(story => {
    if (selectedSection !== 'all' && story.section !== selectedSection) return false;
    if (!isReadyToPublish(story)) return false;
    if (S.press.cooldowns[story.section] > 0) return false;
    return !isSpecialStory(story);
  });
  
  // Prioritize special stories - sort by creation time (newest first)
  specialStories.sort((a, b) => (b.created || b.createdAt || 0) - (a.created || a.createdAt || 0));
  regularStories.sort((a, b) => (b.created || b.createdAt || 0) - (a.created || a.createdAt || 0));
  
  // Try to publish special story first, then regular story
  // Special stories bypass cooldowns, so publish them even if there's a cooldown
  const storyToPublish = specialStories[0] || regularStories[0];
  
  if (storyToPublish) {
    // Publish the story
    publishStory(storyToPublish);
    
    // Set cooldown
    S.press.cooldowns[storyToPublish.section] = 1;
    
    // Remove from queue
    const index = S.press.queue.indexOf(storyToPublish);
    if (index > -1) {
      S.press.queue.splice(index, 1);
    }
  }
}

// Publish a single story
function publishStory(story) {
  if (!S.press.published) S.press.published = [];
  
  // Handle both headlineTemplate/bodyTemplate and headline/body formats
  let finalHeadline, finalBody;
  
  if (story.headlineTemplate && story.bodyTemplate) {
    // Story uses template format (first createStory function)
    finalHeadline = replaceTokens(story.headlineTemplate, story.tokens || {});
    finalBody = replaceTokens(story.bodyTemplate, story.tokens || {});
  } else if (story.headline && story.body) {
    // Story uses direct format (second createStory function)
    finalHeadline = replaceTokens(story.headline, story.tokens || {});
    finalBody = replaceTokens(story.body, story.tokens || {});
  } else {
    // Fallback: use whatever is available
    finalHeadline = story.headline || story.headlineTemplate || 'Untitled Story';
    finalBody = story.body || story.bodyTemplate || 'No content available.';
  }
  
  // Apply effects
  applyStoryEffects(story);
  
  // Add to published archive
  S.press.published.unshift({
    ...story,
    headline: finalHeadline,
    body: finalBody,
    published: Date.now()
  });
  
  // Keep only last 20 stories
  if (S.press.published.length > 20) {
    S.press.published = S.press.published.slice(0, 20);
  }
  
  // Don't render the story immediately - let the user choose when to read it
  console.log(`Published ${story.section} story: ${finalHeadline}`);
}

// Apply story effects to game state
function applyStoryEffects(story) {
  if (!story.effects) return;
  
  for (const [effect, value] of Object.entries(story.effects)) {
    if (effect === 'reputation') {
      S.reputation = clamp((S.reputation || 50) + value, 0, 100);
    } else if (effect === 'marital_risk') {
      S.marital_risk = clamp((S.marital_risk || 0) + value, 0, 100);
    } else if (effect === 'morale') {
      S.team_morale_boost = clamp((S.team_morale_boost || 0) + value, -50, 50);
    } else if (effect === 'manager_quit_risk') {
      S.manager_quit_risk = clamp((S.manager_quit_risk || 0) + value, 0, 100);
    } else if (effect === 'walkout_risk') {
      S.walkout_risk = clamp((S.walkout_risk || 0) + value, 0, 100);
    }
  }
}

// Render published story to UI
function renderPublishedStory(story, headline, body) {
  const effectsText = story.effects ? Object.entries(story.effects)
    .map(([effect, value]) => `${effect} ${value > 0 ? '+' : ''}${value}`)
    .join(', ') : '';
  
  log(`<div class="press-story">
    <strong>By ${story.writer} — ${story.section.toUpperCase()}</strong><br>
    <strong>${headline}</strong><br>
    ${body}
    ${effectsText ? `<br><small>Effects: ${effectsText}</small>` : ''}
  </div>`);
}



// Present lawsuit options to player
async function presentLawsuitOptions(lawsuit) {
  const settlementAmount = lawsuit.severity * 10000 + Math.random() * 20000;
  
  log(`<strong>Legal Notice:</strong> ${lawsuit.target} is suing you for defamation.`);
  
  const choice = await choose([
    { key: 'settle', label: `Pay settlement (${money(settlementAmount)})` },
    { key: 'fight', label: 'Fight the case in court' },
    { key: 'bribe', label: 'Bribe the judge (risky)' }
  ], 'How do you respond?');
  
  if (choice === 'settle') {
    const canPay = await takeFundsFor(settlementAmount, `Defamation settlement £${settlementAmount.toLocaleString()} — funding source?`);
    if (canPay.ok) {
      S.reputation = clamp((S.reputation || 50) - 2, 0, 100);
      log(`Settlement paid. Your reputation takes a small hit.`);
    } else {
      log(`Can't pay settlement. Case goes to trial.`);
      await fightLawsuit(lawsuit);
    }
  } else if (choice === 'fight') {
    await fightLawsuit(lawsuit);
  } else if (choice === 'bribe') {
    await bribeJudge(lawsuit);
  }
  
  lawsuit.settled = true;
}

// Fight lawsuit in court
async function fightLawsuit(lawsuit) {
  const winChance = 60 - (lawsuit.severity * 15);
  const won = Math.random() * 100 < winChance;
  
  if (won) {
    log(`You win the case! Your reputation remains intact.`);
    S.reputation = clamp((S.reputation || 50) + 1, 0, 100);
  } else {
    const fine = lawsuit.severity * 15000 + Math.random() * 25000;
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fine);
    S.reputation = clamp((S.reputation || 50) - 5, 0, 100);
    log(`You lose the case. Fine: ${money(fine)}. Reputation damaged.`);
  }
}

// Bribe judge
async function bribeJudge(lawsuit) {
  const bribeAmount = lawsuit.severity * 5000 + Math.random() * 10000;
  const successChance = 70;
  
  const canBribe = await takeFundsFor(bribeAmount, `Judge bribe £${bribeAmount.toLocaleString()} — funding source?`);
  
  if (canBribe.ok) {
    if (Math.random() * 100 < successChance) {
      log(`Judge accepts the bribe. Case dismissed.`);
    } else {
      const fine = bribeAmount * 2;
      const canPayFine = await takeFundsFor(fine, `Bribe discovered! Additional fine £${fine.toLocaleString()} — funding source?`);
      if (canPayFine.ok) {
        S.legal_risk = clamp((S.legal_risk || 0) + 10, 0, 100);
        log(`Bribe attempt discovered! Additional fine: ${money(fine)}. Legal risk increased.`);
      } else {
        log(`Can't pay the fine. Legal consequences escalate.`);
        S.legal_risk = clamp((S.legal_risk || 0) + 20, 0, 100);
      }
    }
  } else {
    log(`Can't afford the bribe. Case goes to trial.`);
    await fightLawsuit(lawsuit);
  }
}






// View archive
async function viewArchive() {
  if (!S.press.published || S.press.published.length === 0) {
    log(`No stories in the archive yet.`);
    return;
  }
  
  log(`<strong>Press Archive (${S.press.published.length} stories):</strong>`);
  S.press.published.forEach((story, index) => {
    log(`<div class="press-story">
      <strong>${index + 1}. By ${story.writer} — ${story.section.toUpperCase()}</strong><br>
      <strong>${story.headline}</strong><br>
      ${story.body}
    </div>`);
  });
}



function generateGossipStory(type, target) {
  // Ensure target has a proper default value
  const targetName = target || 'Unknown Person';
  
  // Get current club name (supports renaming after nuclear option)
  const clubName = getClubName();
  
  const stories = {
    affair: [
      {
        headline: `Chairman's Secret Affair Exposed`,
        body: `Sources reveal that the ${clubName} chairman has been involved in a secret relationship with ${targetName}. The affair, which has been ongoing for several months, has raised questions about the chairman's judgment and commitment to his family.`
      },
      {
        headline: `Scandal Rocks ${clubName} as Chairman's Affair Revealed`,
        body: `The football world is abuzz with revelations about the ${clubName} chairman's affair with ${targetName}. The relationship, which was kept secret until now, has sparked debate about the chairman's personal conduct and its impact on the club.`
      },
      {
        headline: `${targetName} Exposes ${clubName} Chairman's Bizarre Sexual Habits`,
        body: `${targetName} has gone public with shocking details about the ${clubName} chairman's unusual bedroom behavior. "He insisted on wearing a full football kit during intimate moments, complete with shin guards and cleats," she revealed. "He kept shouting 'GOAL!' at the most inappropriate times. It was mortifying." The revelations have sent shockwaves through the football community.`
      },
      {
        headline: `Chairman's Embarrassing Sexual Proclivities Revealed`,
        body: `In an exclusive interview, ${targetName} has exposed the ${clubName} chairman's strange sexual preferences. "He had me pretend to be a referee while he simulated VAR decisions," she told reporters. "Every time I tried to leave, he'd blow a whistle and show me a yellow card. It was bizarre and deeply uncomfortable." The scandal has raised serious questions about the chairman's judgment.`
      },
      {
        headline: `${clubName} Chairman's Football-Themed Bedroom Antics Exposed`,
        body: `${targetName} has revealed disturbing details about the ${clubName} chairman's bedroom behavior. "He made me chant football songs while we were together," she said. "He kept asking me to do the 'Poznan' celebration. I didn't even know what that was. It was the most unromantic experience of my life." The revelations have damaged the chairman's reputation significantly.`
      },
      {
        headline: `Chairman Forces Partner to Read Transfer Rumors During Intimate Moments`,
        body: `According to ${targetName}, the ${clubName} chairman's bedroom antics included forcing her to read out transfer rumors while they were intimate. "He had a stack of tabloids next to the bed," she revealed. "He'd make me pause every few minutes to discuss whether a player was 'worth the fee.' It was absolutely humiliating." The scandal has sparked outrage among fans and board members.`
      },
      {
        headline: `Chairman Checks Match Updates During Intimate Encounters`,
        body: `Sources reveal that the ${clubName} chairman insisted on ${targetName} wearing a football manager's tracksuit during their encounters. "He kept checking his phone for match updates," she said. "At one point he stopped everything to check the half-time scores. I've never felt so unimportant." The revelations have raised questions about the chairman's priorities and character.`
      },
      {
        headline: `Chairman Role-Plays as Football Commentator in Bedroom`,
        body: `${targetName} has described the ${clubName} chairman's bedroom behavior as "deeply strange." According to her account, he made her pretend to be a football agent negotiating a contract. "He kept saying things like 'I'll give you a signing bonus' and 'What's your release clause?'" she revealed. "It was mortifying and completely killed the mood." The scandal has damaged the chairman's standing in the football world.`
      },
      {
        headline: `Chairman Demands Pre-Match Warm-Up Routine Before Intimate Acts`,
        body: `The ${clubName} chairman's bizarre bedroom habits have been exposed by ${targetName}. "He had me do a full pre-match warm-up routine before anything happened," she revealed. "Stretches, jogging on the spot, the works. Then he wanted me to do a post-match interview. I'm not making this up. It was the most degrading experience of my life." The revelations have shocked the football community.`
      },
      {
        headline: `Chairman Narrates Intimate Moments Like Match Commentary`,
        body: `According to ${targetName}, the ${clubName} chairman's sexual preferences included role-playing as a football commentator. "He kept narrating everything like he was on Match of the Day," she said. "'And here we see the chairman making a run into the box...' I couldn't take it seriously. It was absolutely ridiculous." The scandal has raised serious questions about the chairman's mental state and judgment.`
      }
    ],
    blackmail: [
      {
        headline: `Chairman Refuses to Pay Hush Money`,
        body: `${targetName} has gone public with allegations against the ${clubName} chairman after their demand for hush money was refused. The revelations have sent shockwaves through the football community and raised serious questions about the chairman's conduct.`
      },
      {
        headline: `Hush Money Scandal Erupts at ${clubName}`,
        body: `The ${clubName} chairman's refusal to pay hush money to ${targetName} has backfired spectacularly, with the allegations now public. The scandal has damaged the chairman's reputation and raised concerns about the club's image.`
      }
    ],
    expose: [
      {
        headline: `Chairman Exposes ${targetName} for Bribery Refusal`,
        body: `The ${clubName} chairman has publicly exposed ${targetName} for refusing to honor a bribe agreement. The revelation has shocked the football world and raised questions about the prevalence of corruption in the game.`
      },
      {
        headline: `Bribery Scandal Exposed by ${clubName} Chairman`,
        body: `In a dramatic turn of events, the ${clubName} chairman has exposed ${targetName} for not honoring a bribe. The public revelation has sparked widespread debate about corruption in football and the chairman's own involvement in such practices.`
      }
    ],
    retaliation: [
      {
        headline: `${targetName} Speaks Out Against Chairman`,
        body: `Former ${targetName} has broken their silence about the ${clubName} chairman's conduct, alleging corruption and unethical behavior. The accusations have sent shockwaves through the club and raised serious questions about the chairman's leadership.`
      },
      {
        headline: `Damning Allegations from Former ${targetName}`,
        body: `${targetName} has made explosive allegations against the ${clubName} chairman, claiming widespread corruption and abuse of power. The revelations have caused significant damage to the chairman's reputation and raised concerns about the club's future.`
      }
    ]
  };
  
  const storyTemplates = stories[type] || stories.retaliation;
  const template = storyTemplates[Math.floor(Math.random() * storyTemplates.length)];
  
  const effects = {
    affair: { marital_risk: 15, reputation: -5 },
    blackmail: { marital_risk: 10, reputation: -3 },
    expose: { reputation: 3 },
    retaliation: { morale: -10, manager_quit_risk: 15, walkout_risk: 10, reputation: -8 }
  };
  
  return createStory(
    'gossip',
    template.headline,
    template.body,
    { target: targetName },
    effects[type] || effects.retaliation,
    type,
    type === 'retaliation' ? 2 : 1,
    type === 'affair' ? ['affair'] : type === 'retaliation' ? ['corruption'] : ['defame']
  );
}

