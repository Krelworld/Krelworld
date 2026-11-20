// ========== SEASON 5 SURVIVAL ECONOMY SYSTEM ==========

// Initialize survival economy state if needed
function ensureSeason5SurvivalState() {
  if (S.season === 5 && S.season5) {
    if (!S.season5.survival) {
      S.season5.survival = {
        base_bribe_amount: 150000,
        current_bribe_amount: 150000,
        bribe_multiplier: 1.15,
        matches_survived: 0,
        strategy_unlocked: {
          bribe: true,
          doping: false,
          intimidation: false,
        },
        doping_active: false,
        intimidation_used: false,
        background_deterioration: 0,
        squad_murdered: false,
        audit_scrutiny: 0,
        lobby_tokens_spent: 0,
      };
    }
  }
}

// Calculate current bribe amount based on matches played
function calculateSeason5Bribe() {
  if (!S.season5 || !S.season5.survival) return 150000;
  const matches = Math.max(0, (S.matches_played || 0) - 1); // Match 2 is index 1
  const base = S.season5.survival.base_bribe_amount || 150000;
  const multiplier = S.season5.survival.bribe_multiplier || 1.15;
  return Math.floor(base * Math.pow(multiplier, matches));
}

// Check if strategies should be unlocked
function updateSeason5StrategyUnlocks() {
  if (!S.season5 || !S.season5.survival) return;
  const matches = S.matches_played || 0;
  const seasonMatches = S.season_matches || 9;
  const midSeason = Math.floor(seasonMatches * 0.5);
  const lateSeason = Math.floor(seasonMatches * 0.75);
  
  // Doping unlocks mid-season
  if (matches >= midSeason) {
    S.season5.survival.strategy_unlocked.doping = true;
  }
  
  // Intimidation unlocks late-season
  if (matches >= lateSeason) {
    S.season5.survival.strategy_unlocked.intimidation = true;
  }
}

// Apply background deterioration
function applySeason5BackgroundDeterioration() {
  if (!S.season5 || !S.season5.survival) return;
  const deterioration = S.season5.survival.background_deterioration || 0;
  
  // Increment deterioration each match (from match 2 onward)
  if (S.season === 5 && S.matches_played > 1) {
    S.season5.survival.background_deterioration = Math.min(100, deterioration + 2);
  }
  
  // Apply UI effects via CSS if available
  if (typeof document !== 'undefined') {
    const body = document.body;
    if (body) {
      const opacity = 1 - (deterioration / 100) * 0.3; // Fade to 70% opacity max
      body.style.filter = `grayscale(${deterioration}%) opacity(${opacity})`;
      body.style.transition = 'filter 0.3s ease';
    }
  }
}

// Main Season 5 pre-match threat system
async function handleSeason5SurvivalEconomy() {
  // Only activate in Season 5, after the kidnapping press conference has been held
  if (S.season !== 5) return;

  ensureSeason5SurvivalState();
  if (!S.season5 || !S.season5.survival) return;

  // The "compliance / protection" bribe flow must not start until AFTER:
  //  - the massacre & kidnapping sequence has been shown, and
  //  - the mandatory press conference (via knockdoor) has completed.
  //
  // This prevents protection bribes from appearing in Season 5 Match 1 and
  // guarantees the press conference happens first (intended for Match 2).
  if (!S.season5.kidnapping_press_done) {
    return;
  }
  
  // Safety: keep the original "matches 2+" intent by requiring that at least
  // one Season 5 match has been fully completed before this system runs.
  if ((S.matches_played || 0) < 1) return;
  
  const survival = S.season5.survival;
  const opp = currentOpponent();
  const bribeAmount = calculateSeason5Bribe();
  survival.current_bribe_amount = bribeAmount;
  
  // Update strategy unlocks
  updateSeason5StrategyUnlocks();
  
  // Apply background deterioration
  applySeason5BackgroundDeterioration();
  
  // Reset per-match flags
  survival.doping_active = false;
  survival.intimidation_used = false;
  
  // Show the threat message
  log("");
  log("═══════════════════════════════════════════════════════");
  log("COMPLIANCE REQUIRED");
  log("═══════════════════════════════════════════════════════");
  log("");
  log(`Opponent: ${opp.team || 'Opposition'}`);
  log(`Required bribe: £${bribeAmount.toLocaleString()}`);
  log("");
  log("Failure to comply will have grave consequences.");
  log("");
  log("No drama. No pleading. No choice framing.");
  log("");
  
  // Build strategy options
  const options = [];
  
  // Strategy A: Bribe (always available)
  options.push({
    key: 'bribe',
    label: `Pay Protection Bribe (avert grave consequences) (£${bribeAmount.toLocaleString()})`
  });
  
  // Strategy B: Doping (mid-season unlock)
  if (survival.strategy_unlocked.doping) {
    options.push({
      key: 'doping',
      label: 'Chemical Enhancement (Cocaine/HGH)'
    });
  }
  
  // Strategy C: Intimidation (late-season unlock)
  if (survival.strategy_unlocked.intimidation) {
    options.push({
      key: 'intimidation',
      label: 'Direct Threat / Intimidation'
    });
  }
  
  // Strategy D: Refuse (always available, but dangerous)
  options.push({
    key: 'refuse',
    label: 'Refuse (Catastrophic risk)'
  });
  
  // Option to use lobby tokens if available
  if (S.lobby_tokens && S.lobby_tokens > 0) {
    options.push({
      key: 'lobby',
      label: `Use Lobby Token (${S.lobby_tokens} available) - Delay consequences`
    });
  }
  
  const choice = await choose(options, "How do you survive this match?");
  
  // Handle the chosen strategy
  if (choice === 'bribe') {
    await handleSeason5BribeStrategy(bribeAmount);
  } else if (choice === 'doping') {
    await handleSeason5DopingStrategy(bribeAmount);
  } else if (choice === 'intimidation') {
    await handleSeason5IntimidationStrategy(bribeAmount);
  } else if (choice === 'refuse') {
    await handleSeason5RefuseStrategy();
  } else if (choice === 'lobby') {
    await handleSeason5LobbyTokenStrategy();
  }
}

// Strategy A: Bribe
async function handleSeason5BribeStrategy(bribeAmount) {
  if (!S.season5 || !S.season5.survival) return;
  
  const personalCash = S.chairman_cash || 0;
  const clubCash = S.club_cash || 0;
  const totalAvailable = personalCash + clubCash;

  if (totalAvailable < bribeAmount) {
    log("");
    log("You cannot afford the bribe.");
    log("The consequences are immediate.");
    await handleSeason5RefuseStrategy();
    return;
  }

  // Deduct from personal funds first, then club funds if needed
  let remaining = bribeAmount;
  let fromPersonal = 0;
  let fromClub = 0;
  
  if (personalCash > 0) {
    fromPersonal = Math.min(personalCash, remaining);
    S.chairman_cash = personalCash - fromPersonal;
    remaining -= fromPersonal;
  }
  if (remaining > 0) {
    fromClub = Math.min(clubCash, remaining);
    S.club_cash = Math.max(0, clubCash - fromClub);
    remaining -= fromClub;
  }

  // Keep aggregate money snapshot (if used elsewhere) roughly in sync
  S.money = (S.chairman_cash || 0) + (S.club_cash || 0);
  
  // CRITICAL: Update HUD to reflect money changes
  if (typeof updateHUD === 'function') {
    updateHUD();
  } else {
    console.warn('DEBUG BRIBE: updateHUD function not found!');
  }
  
  S.season5.survival.matches_survived += 1;
  
  // Log bribe
  if (!S.bribe_log) S.bribe_log = [];
  S.bribe_log.push({
    who: 'Survival Economy',
    amount: bribeAmount,
    source: 'Season 5 Protection',
    week: S.matches_played || 0
  });
  
  log("You pay. Squad survives. Match plays as a hollow simulation.");
  
  // Mark match as hollow (affects outcome)
  if (!S.preMatch) S.preMatch = {};
  S.preMatch.season5_hollow = true;
  S.preMatch.season5_bribed = true;
}

// Strategy B: Doping
async function handleSeason5DopingStrategy(bribeAmount) {
  if (!S.season5 || !S.season5.survival) return;
  
  S.season5.survival.doping_active = true;
  S.season5.survival.audit_scrutiny = (S.season5.survival.audit_scrutiny || 0) + 10;
  
  // Increase opponent bribe demands
  const newBribe = Math.floor(bribeAmount * 1.5);
  S.season5.survival.current_bribe_amount = newBribe;
  
  log("");
  log("You introduce chemical enhancements.");
  log("Cocaine. HGH. Other 'improvements'.");
  log("");
  log("Squad performance spikes.");
  log("Match results improve.");
  log("");
  log("Opponent bribe demands rise.");
  log("Audit scrutiny increases.");
  log("");
  log("You are punished for trying to win.");
  log("");
  log("Winning is provocation.");
  
  // Boost team strength for this match
  if (!S.preMatch) S.preMatch = {};
  S.preMatch.season5_doped = true;
  S.preMatch.performance_boost = 1.3; // 30% boost
}

// Strategy C: Intimidation
async function handleSeason5IntimidationStrategy(bribeAmount) {
  if (!S.season5 || !S.season5.survival) return;
  
  S.season5.survival.intimidation_used = true;
  
  // Random outcome: some back down, others escalate
  const intimidationSuccess = Math.random() < 0.4; // 40% chance
  
  if (intimidationSuccess) {
    log("");
    log("You make direct threats.");
    log("Hostage-style leverage.");
    log("Symbolic acts of defiance.");
    log("");
    log("The opponent backs down.");
    log("");
    log("This is unstable, dangerous power.");
    
    // Opponent backs down - no bribe needed
    S.preMatch = S.preMatch || {};
    S.preMatch.season5_intimidated = true;
    S.preMatch.season5_opponent_backed_down = true;
  } else {
    log("");
    log("You make direct threats.");
    log("Hostage-style leverage.");
    log("Symbolic acts of defiance.");
    log("");
    log("The opponent escalates immediately.");
    log("");
    log("This is unstable, dangerous power.");
    
    // Escalation - increased bribe or consequences
    const escalatedBribe = Math.floor(bribeAmount * 2);
    S.season5.survival.current_bribe_amount = escalatedBribe;
    
    log(`New bribe demand: £${escalatedBribe.toLocaleString()}`);
    
    // Force bribe or face consequences
    const options = [
      { key: 'pay', label: `Pay Escalated Bribe (£${escalatedBribe.toLocaleString()})` },
      { key: 'refuse', label: 'Refuse (Catastrophic)' }
    ];
    
    const choice = await choose(options, "The threat has escalated.");
    
    if (choice === 'pay') {
      await handleSeason5BribeStrategy(escalatedBribe);
    } else {
      await handleSeason5RefuseStrategy();
    }
  }
}

// Strategy D: Refuse
async function handleSeason5RefuseStrategy() {
  if (!S.season5 || !S.season5.survival) return;
  
  const matches = S.matches_played || 0;
  const seasonMatches = S.season_matches || 9;
  const isEarly = matches < Math.floor(seasonMatches * 0.33);
  const isLate = matches >= Math.floor(seasonMatches * 0.75);
  
  // Early: rare catastrophic, usually partial compliance
  // Late: common catastrophic
  let outcome;
  if (isEarly) {
    outcome = Math.random() < 0.2 ? 'catastrophic' : 'partial';
  } else if (isLate) {
    outcome = Math.random() < 0.7 ? 'catastrophic' : 'partial';
  } else {
    outcome = Math.random() < 0.4 ? 'catastrophic' : 'partial';
  }
  
  if (outcome === 'catastrophic') {
    log("");
    log("You refuse.");
    log("");
    log("The consequences are immediate.");
    log("");
    log("Your squad has been murdered.");
    
    S.season5.survival.squad_murdered = true;
    S.game_over = true;
    S.game_over_reason = "Squad murdered after refusing compliance in Season 5";
    
    // Remove all players
    if (S.squad) {
      S.squad = [];
    }
    
    log("");
    log("GAME OVER");
  } else {
    // Partial compliance - random injury/suspension/disappearance
    log("");
    log("You refuse.");
    log("");
    log("Partial compliance enforced.");
    log("");
    
    const consequences = [
      'injury',
      'suspension',
      'disappearance'
    ];
    const consequence = consequences[Math.floor(Math.random() * consequences.length)];
    
    if (consequence === 'injury' && S.squad && S.squad.length > 0) {
      const randomPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
      randomPlayer.injured = true;
      randomPlayer.injury_weeks = 8;
      log(`${randomPlayer.name || 'A player'} has been injured.`);
    } else if (consequence === 'suspension' && S.squad && S.squad.length > 0) {
      const randomPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
      randomPlayer.suspended = true;
      randomPlayer.suspension_weeks = 6;
      log(`${randomPlayer.name || 'A player'} has been suspended.`);
    } else if (consequence === 'disappearance' && S.squad && S.squad.length > 0) {
      const randomPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
      const index = S.squad.indexOf(randomPlayer);
      if (index > -1) {
        S.squad.splice(index, 1);
        log(`${randomPlayer.name || 'A player'} has disappeared.`);
      }
    }
    
    log("");
    log("The match proceeds under duress.");
    
    S.preMatch = S.preMatch || {};
    S.preMatch.season5_refused = true;
    S.preMatch.season5_partial_compliance = true;
  }
}

// Lobby Token Strategy
async function handleSeason5LobbyTokenStrategy() {
  if (!S.lobby_tokens || S.lobby_tokens <= 0) {
    log("You have no lobby tokens.");
    await handleSeason5RefuseStrategy();
    return;
  }
  
  S.lobby_tokens = (S.lobby_tokens || 0) - 1;
  
  if (!S.season5 || !S.season5.survival) return;
  S.season5.survival.lobby_tokens_spent += 1;
  
  log("");
  log("You leverage a lobby token.");
  log("");
  log("Consequences are delayed.");
  log("Burns long-term power.");
  log("");
  log("The match proceeds, but the threat remains.");
  
  // Delay consequences - bribe increases next match instead
  const currentBribe = S.season5.survival.current_bribe_amount || 50000;
  S.season5.survival.current_bribe_amount = Math.floor(currentBribe * 1.5);
  
  S.preMatch = S.preMatch || {};
  S.preMatch.season5_lobby_used = true;
}

// Modify match outcome based on survival strategy
function applySeason5MatchModifiers(outcome) {
  if (S.season !== 5 || !S.preMatch) return outcome;
  
  // Hollow match (bribed) - usually lose or draw
  if (S.preMatch.season5_hollow) {
    if (outcome.our_goals > outcome.their_goals) {
      // Rare win becomes draw
      if (Math.random() < 0.7) {
        outcome.their_goals = outcome.our_goals;
      }
    }
  }
  
  // Doped match - performance boost already applied in preMatch
  if (S.preMatch.season5_doped) {
    // Outcome already boosted, but audit risk increases
    if (S.season5 && S.season5.survival) {
      S.season5.survival.audit_scrutiny += 5;
    }
  }
  
  // Intimidated and opponent backed down - normal match
  if (S.preMatch.season5_opponent_backed_down) {
    // Match proceeds normally
  }
  
  // Refused with partial compliance - match under duress
  if (S.preMatch.season5_partial_compliance) {
    // Slight performance penalty
    if (outcome.our_goals > 0) {
      outcome.our_goals = Math.max(0, outcome.our_goals - 1);
    }
  }
  
  return outcome;
}

// Public preMatchPhase(): marks the phase, runs it, then emits 'prematch:end'.
async function preMatchPhase(...args){
  setPhase('prematch');
  const result = await runPreMatchPhase.apply(this, args);
  GameHooks.emit('prematch:end', result);
  return result;
}

async function runPreMatchPhase(){
// Process Press system pre-match events
initPressSystem();
await processPendingLawsuits();
await processWifeConfrontation();

// Reset texting counters for all contacts at the start of each phase
if (S.contacts) {
  for (const contactId in S.contacts) {
    if (S.contacts[contactId]) {
      S.contacts[contactId].textsThisPhase = 0;
    }
  }
}

// Decrement cooldowns
if (S.press.cooldowns) {
  S.press.cooldowns.politics = Math.max(0, S.press.cooldowns.politics - 1);
  S.press.cooldowns.sports = Math.max(0, S.press.cooldowns.sports - 1);
  S.press.cooldowns.gossip = Math.max(0, S.press.cooldowns.gossip - 1);
}
if (S.press.confrontationCooldown) {
  S.press.confrontationCooldown = Math.max(0, S.press.confrontationCooldown - 1);
}

// Cache today's opponent for consistent logging throughout the matchday
S.matchContext = currentOpponent();   // { team, manager }
const oppAtKickoff = S.matchContext;
startPreMatchInitBetting();
if (!S.preMatch) S.preMatch = {};

// Send Delmor's intro message in first pre-match
if (typeof sendRivalIntroMessage === 'function') {
  sendRivalIntroMessage();
}

// Handle Krunchem message after daughter leaves (next match after Scene 3)
if (S.season === 4 && S.season4 && S.season4.krunchem_message_pending) {
  S.season4.krunchem_message_pending = false;
  const daughterMessage = "She's moved in with me. Don't worry — I'll take good care of her.";
  // Show as popup immediately
  if (typeof showRivalTextPopup === 'function') {
    showRivalTextPopup(daughterMessage);
  } else if (typeof window.sendRivalText === 'function') {
    window.sendRivalText(daughterMessage);
  } else if (typeof window.enqueueRivalText === 'function') {
    window.enqueueRivalText(daughterMessage);
  } else {
    log("📱 You receive a message from Delmor Krunchem:");
    log(daughterMessage);
  }
}

// Process any queued drug scandals from previous post-match
if (S._queued_drug_scandal) {
  S._queued_drug_scandal = false; // Clear the flag
  // Use setTimeout to ensure the function is defined when called
  setTimeout(() => {
    if (typeof maybePlayerDrugScandal === 'function') {
      maybePlayerDrugScandal();
    }
  }, 100);
}

// Ensure stadium dealing state persists across seasons
ensureStadiumDealingPersistence();

// Stadium dealing approach system
// Allow approaches if unlocked OR if there's dealing history from previous seasons
const hasDealingHistory = S.stadium_dealing_unlocked || 
                          (S.stadium_dealing_total_visits || 0) > 0 || 
                          (S.stadium_dealing_total_allows || 0) > 0;
if (hasDealingHistory && !S.stadium_burned) {
  // If not unlocked but has history, unlock it to allow approaches
  if (!S.stadium_dealing_unlocked) {
    S.stadium_dealing_unlocked = true;
  }
  await maybeStadiumDealingApproach();
} else {
}

// Check if we need to force trigger stadium attack at match 11 season 2 (before match starts)
if (!S.preMatch.stadium_burn_triggered && S.season === 2 && S.matches_played === 11 && !S.stadium_burned && S.stadium_dealing_unlocked) {
  // Check if user hasn't triggered it naturally (by visiting Marco 3 times)
  if (S.stadium_dealing_total_visits < 3) {
    // Force trigger the stadium attack - set flag so it happens during the match
    S.preMatch.stadium_burn_triggered = true;
  } else {
  }
} else {
}

// Press interview system
if (S.press_interview_queued) {
  await conductPressInterview();
}

// Fundraiser system
await maybeShowFundraiserInPreMatch();

// ========== KUDDLE CRONSTER LETTER - SEASON 2 EPISODE 1 ==========
// Automatically trigger the cronster letter at the start of Season 2 Episode 1
// This ensures it appears via the dedicated UI even when playing naturally from Season 1
// Trigger on match 1 only (matches_played <= 1 to handle edge cases)
if (S.season === 2 && S.matches_played <= 1 && (!S.cronster || !S.cronster.letter_received)) {
  // Ensure womens_team is initialized if it doesn't exist
  if (!S.womens_team) {
    S.womens_team = {
      manager_demands_this_season: 0,
      last_demand_match: -1,
      liquidated: false,
      manager_active: true
    };
  }
  // Only trigger if women's team exists and isn't liquidated
  if (S.womens_team && !S.womens_team.liquidated) {
    await handleCronsterInitialLetter();
    // Note: S.cronster.letter_received is set to true in handleCronsterInitialLetter(),
    // which will prevent duplicate triggers
  }
}

// ========== MUSLIM MALCOLM - POINTS 4 PRIZES (SEASONS 4 & 5) ==========
// Check and trigger Malcolm visit automatically in pre-match phase
// This ensures the visit happens even if player doesn't click "door"
if ((S.season === 4 || S.season === 5) && S.matches_played > 0) {
  const seasonKey = S.season === 4 ? 'season4' : 'season5';
  const seasonData = S[seasonKey];
  
  
  if (seasonData && !seasonData.muslim_malcolm_visited) {
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    const seasonProgress = matchesPlayed / seasonMatches;
    
    // Guarantee visit by match 6 (37.5% of season) if it hasn't happened yet
    const guaranteedMatch = 6;
    let shouldTrigger = false;
    
    if (matchesPlayed >= guaranteedMatch) {
      // MUST visit by match 6 if not visited yet (100% guarantee)
      shouldTrigger = true;
    } else {
      // Random chance before guarantee point (higher chance as season progresses)
      let triggerChance = 0.3;
      if (seasonProgress >= 0.4) {
        triggerChance = 0.7;
      } else if (seasonProgress >= 0.2) {
        triggerChance = 0.5;
      }
      const roll = Math.random();
      shouldTrigger = (roll < triggerChance);
    }
    
    if (shouldTrigger) {
      try {
        seasonData.muslim_malcolm_visited = true;
        // Mark that we're visiting this match to prevent FA executive from also visiting
        if (!S.preMatch) S.preMatch = {};
        S.preMatch.muslim_malcolm_visiting = true;
        await handleMuslimMalcolmPoints4Prizes();
      } catch (error) {
        console.error(`DEBUG MALCOLM PREMATCH: Error during visit:`, error);
        // Reset flag on error so it can try again
        seasonData.muslim_malcolm_visited = false;
        if (S.preMatch) S.preMatch.muslim_malcolm_visiting = false;
      }
    }
  } else {
  }
}

// Show pending stadium burn story (Shafty Rod Johnson) if queued
if (S.pending_stadium_burn_story && typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
  S.pending_stadium_burn_story = false; // Clear flag immediately to prevent duplicate
  const storyBody = `"Beyond the Pale": Shafty Rod Johnson Arrested After Graphic, Mocking Routine About St Mary's Terror Attack

By Staff Reporter | Southampton

The arrest of controversial stand-up comedian Shafty Rod Johnson early this morning marks what police sources describe as an "unprecedented collapse of judgement" following a live routine that repeatedly mocked the victims of the recent terrorist attack at St Mary's Stadium, including families and children.

Johnson, 48, was detained shortly after 1:30 a.m. after performing a set at a city-centre venue in which he made extended jokes about the attack, the injured, and the dead — material that officers say went far beyond satire or tastelessness and into potential criminality.

Footage of the routine, which spread rapidly overnight, shows Johnson opening with remarks about Southampton's long-standing image as a "family club." What followed drew audible gasps from the audience.

In one section, Johnson said:

"They call it a family club, don't they? Turns out that's just marketing talk for 'bulk discount on coffins.'"

Another line, partially redacted in police summaries, referred to "mum, dad, and the little one… all sat together like a season ticket — just scattered across different exits."

Witnesses say Johnson returned repeatedly to the idea that the victims were families, at one point remarking:

"At least it lived up to the brochure. Something for everyone. Bits over here, bits over there."

Several audience members attempted to leave during the set, while others reportedly shouted at Johnson to stop. He responded by doubling down.

"Oh come on," he said at one point. "You lot wanted atmosphere. You finally got some — just came with extra debris."

As the routine escalated, Johnson made increasingly graphic references to the aftermath of the blast. While newspapers are declining to print the full wording, police confirmed that the material included explicit references to body parts, blood, and human remains, framed as punchlines. One joke, according to investigators, compared the stadium concourse to "a butcher's aisle after a riot."

The set also included remarks suggesting that the attack had done more to "shake up the club" than recent managerial changes, and a comment that emergency responders were "the first Saints players to actually sprint this season."

Perhaps most shocking to investigators was Johnson's decision to close the routine with what he reportedly described as "a traditional send-off for the bereaved," before exposing himself to the audience — a notorious but previously tolerated element of his act. Venue staff immediately cut the microphone and contacted police.

Hampshire Police confirmed Johnson was arrested on suspicion of outraging public decency, public order offences, and grossly offensive communication. A senior officer involved in the investigation said:

"This was not dark humour about tragedy in the abstract. This was a sustained performance mocking identifiable victims of a real terrorist attack, delivered days after the event, to an audience that included local residents directly affected."

Legal experts say Johnson's comments about families and children could significantly aggravate any charges, particularly given the proximity to the attack and the live setting.

Southampton FC issued a second, longer statement this afternoon, describing the routine as "inhuman and indefensible" and confirming the club has cooperated fully with police.

"St Mary's is a place of community and shared identity," the statement read. "To exploit that identity in order to demean victims of violence is an affront to everything the club represents."

Victims' advocacy groups have also called for permanent bans on Johnson performing in the region. One spokesperson said:

"This wasn't comedy pushing boundaries. It was someone dancing on a mass grave and asking for applause."

Johnson has so far refused to apologise. While being escorted from custody, he reportedly shouted that the reaction proved "you're not allowed to joke about anything anymore unless it's boring."

For a comedian whose career has long depended on testing how far he can go, the St Mary's routine appears to mark the point at which provocation crossed into prosecution — with potentially life-altering consequences.`;
  
  const story = {
    section: 'gossip',
    headline: 'SPECIAL INVESTIGATION — ST MARY\'S ATTACK FALLOUT',
    writer: getNextWriter(),
    body: storyBody,
    effects: {}
  };
  
  log(`\n📰 BREAKING NEWS: A shocking story has broken about a comedian's arrest following the attack.`);
  await showNewsArticle(story);
}

// Season 4 news stories (Prime Minister, Bradford Capital, Ultima Stadium)
async function maybeShowSeason4NewsStories() {
  if (S.season !== 4 || !S.season4) return;
  
  // Initialize flags if not set
  if (S.season4.news_story_1_shown === undefined) S.season4.news_story_1_shown = false;
  if (S.season4.news_story_2_shown === undefined) S.season4.news_story_2_shown = false;
  if (S.season4.news_story_3_shown === undefined) S.season4.news_story_3_shown = false;
  if (S.season4.news_story_1_match === undefined) S.season4.news_story_1_match = -1;
  if (S.season4.news_story_2_match === undefined) S.season4.news_story_2_match = -1;
  if (S.season4.news_story_3_match === undefined) S.season4.news_story_3_match = -1;
  // Delmor Krunchem news stories flags
  if (S.season4.krunchem_wife_story_shown === undefined) S.season4.krunchem_wife_story_shown = false;
  if (S.season4.krunchem_daughter_story_shown === undefined) S.season4.krunchem_daughter_story_shown = false;
  if (S.season4.krunchem_wife_story_match === undefined) S.season4.krunchem_wife_story_match = -1;
  if (S.season4.krunchem_daughter_story_match === undefined) S.season4.krunchem_daughter_story_match = -1;
  
  const currentMatch = S.matches_played || 0;
  
  // Story 1: Prime Minister urges "Cultural Consistency"
  if (!S.season4.news_story_1_shown && typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
    S.season4.news_story_1_shown = true;
    S.season4.news_story_1_match = currentMatch;
    
    const story1 = {
      section: 'politics',
      headline: 'PRIME MINISTER URGES "CULTURAL CONSISTENCY" IN RESPONSE TO SAUDI FA PROPOSALS',
      writer: getNextWriter(),
      body: `Prime Minister Sir Keir Starmer has criticised what he described as "inconsistent attitudes" among British citizens opposing recent proposals by the Saudi Football Association to apply elements of Sharia law to its domestic football operations within the UK.

Speaking at a press conference on Tuesday, Sir Keir said that cultural respect must be applied "symmetrically," adding that Britain could not reasonably expect deference abroad while refusing it at home.

"When British people visit other countries, they rightly respect local customs and legal norms," the Prime Minister said. "It therefore follows that when international partners operate here, we should respect their own cultural norms to ensure they feel comfortable."`,
      effects: {}
    };
    
    await showNewsArticle(story1);
    return; // Exit to ensure only one story per pre-match
  }
  
  // Story 2: Bradford becomes new capital (at least 2 matches after story 1)
  if (S.season4.news_story_1_shown && !S.season4.news_story_2_shown && 
      currentMatch >= S.season4.news_story_1_match + 2 &&
      typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
    S.season4.news_story_2_shown = true;
    S.season4.news_story_2_match = currentMatch;
    
    const story2 = {
      section: 'politics',
      headline: 'GOVERNMENT CONFIRMS BRADFORD TO BECOME NEW UK CAPITAL',
      writer: getNextWriter(),
      body: `The government has confirmed plans to designate Bradford as the new capital city of the United Kingdom, "in recognition of Muslim contributions to British life such as 'Muslim curry' and other such things, with which we are so familiar I don't even need to say them".

The transition will involve the relocation of Parliament, select government departments, and ceremonial institutions over a ten-year period. Bradford is hoped to remain a heritage site and tourist destination, with incredible sights such as 'Bradford tower' etc.

Officials confirmed that the move would cost "a significant" sum, adding that further details would be released "someday."`,
      effects: {}
    };
    
    await showNewsArticle(story2);
    return; // Exit to ensure only one story per pre-match
  }
  
  // Story 3: Ultima Stadium announced (at least 2 matches after story 2)
  if (S.season4.news_story_2_shown && !S.season4.news_story_3_shown && 
      currentMatch >= S.season4.news_story_2_match + 2 &&
      typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
    S.season4.news_story_3_shown = true;
    S.season4.news_story_3_match = currentMatch;
    
    const story3 = {
      section: 'football',
      headline: 'ULTIMA STADIUM ANNOUNCED IN BRADFORD FOLLOWING "NEW INTERPRETIVE DISCOVERY"',
      writer: getNextWriter(),
      body: `Football executive Mohammed Van Onslaught has announced plans for the construction of the Ultima Stadium in Bradford, a 300,000-seat multi-purpose arena described as "the largest sporting structure ever attempted."

At the launch event, Van Onslaught stated that the stadium would serve not only as a football venue but also as a major international pilgrimage destination, noting that it will serve "as a new mecca, as we have recent discovered a long-lost verse from the Qu'ran about the 'second Hajj' which is to take place 'n what is now known as Bradford'"

Construction is expected to begin immediately, with local authorities confirming that compulsory purchase orders have already been issued for much of the surrounding area.`,
      effects: {}
    };
    
    await showNewsArticle(story3);
    return; // Exit to ensure only one story per pre-match
  }
  
  // Story 4: Delmor Krunchem announces "night of pleasure" with wife
  // Can appear after story 1 is shown and at least match 2 (to avoid early conflicts)
  if (S.season4.news_story_1_shown && !S.season4.krunchem_wife_story_shown && 
      currentMatch >= 2 &&
      typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
    // Random chance to appear (30% per pre-match after conditions met)
    if (Math.random() < 0.3) {
      S.season4.krunchem_wife_story_shown = true;
      S.season4.krunchem_wife_story_match = currentMatch;
      
      const wifeName = S.wife_name || "your wife";
      const story4 = {
        section: 'football',
        headline: 'PORTSMOUTH CHAIRMAN DELMOR KRUNCHEM MAKES SHOCKING PUBLIC ANNOUNCEMENT',
        writer: getNextWriter(),
        body: `Portsmouth chairman Delmor Krunchem has made a public announcement regarding what he described as "a night of pleasure" with ${wifeName}, the estranged wife of Southampton chairman.
        
In a statement released to the press, Krunchem stated: "I had a night of pleasure with ${wifeName}, which ended in lots of pleasure, as she informed me that I am much 'bigger' than her ex!"

The announcement has caused significant controversy in football circles, with many questioning the appropriateness of such a public statement. Krunchem has not responded to requests for further comment.

Southampton FC declined to comment on the matter.`,
        effects: {}
      };
      
      await showNewsArticle(story4);
      return; // Exit to ensure only one story per pre-match
    }
  }
  
  // Story 5: Delmor Krunchem announces daughter accepted to Strip University
  // Can only appear after daughter has left home
  // Appears reliably (no random chance) after daughter leaves, but only once
  if (S.season4.daughter_left_home && !S.season4.krunchem_daughter_story_shown && 
      typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
    S.season4.krunchem_daughter_story_shown = true;
    S.season4.krunchem_daughter_story_match = currentMatch;
    
    const daughterName = S.child2_name ? S.child2_name.split(' ')[0] : "his new daughter";
    const story5 = {
      section: 'education',
      headline: 'KRUNCHEM PROUDLY ANNOUNCES DAUGHTER\'S ACCEPTANCE TO STRIP UNIVERSITY',
      writer: getNextWriter(),
      body: `Portsmouth chairman Delmor Krunchem has proudly announced that ${daughterName} has been accepted to Strip University. 
        
In a statement, Krunchem said: "She is a wonderfully talented stripper, so erotic! She practices her routines every night, me and her Mother are so proud of her. Mmmm"

The announcement has raised eyebrows in academic circles, with some questioning the legitimacy of the institution. However, Krunchem has insisted that Strip University is a "prestigious institution" that focuses on "performance arts and physical expression."

Representatives from the university could not be reached for comment.`,
      effects: {}
    };
    
    await showNewsArticle(story5);
    return; // Exit to ensure only one story per pre-match
  }
}

// Call season 4 news stories in pre-match
await maybeShowSeason4NewsStories();

S.preMatch.betLocked = false;  
  
  // ========== SEASON 5 SURVIVAL ECONOMY (Matches 2+) ==========
  if (S.season === 5 && (S.matches_played || 0) >= 1) {
    // Episode Two pre-match flavour: you have barricaded yourself in the stadium
    if (S.matches_played === 1) {
      if (!S.season5) S.season5 = {};
      if (!S.season5.barricade_logged) {
        log(`\n🔒 You have quietly barricaded yourself inside St Mary's ahead of tonight's game.`);
        log(`You've had staff drag vending machines, trophy cabinets and hospitality trolleys against every entrance, anything to stop Mohammed Van Onslaught's men from bundling you into another black van.`);
        log(`It feels childish and futile. Van Onslaught will inevitably make his move; the stadium is just a temporary shell.`);
        log(`If only you had some guns and munitions, something that felt heavier than lawyers and press officers.`);
        S.season5.barricade_logged = true;
      }
    }

    await handleSeason5SurvivalEconomy();
    // Check for game over (squad murdered)
    if (S.game_over) {
      return;
    }
  }
  
  // Weeklies / admin that must remain
  await callIf('maybePreMatchScenarios');
  await callIf('preMatchAdmin');
  await callIf('preMatchTeamTalk');

// cache opponent for this week so post-match/other UI never shows "undefined"
const ctx = currentOpponent();
S.matchContext = { team: ctx.team, manager: ctx.manager, roundIndex: S.matches_played };
  // One-match flags & basic setup
  preMatchResetFlags();
  ensureInitialSquad();
  ensureValidLineup();
startPreMatchInitBetting();
ensureOpponentForToday();
  S.morale_opponent = 70;
// per-match bribery flags (don't carry into next week)
S.referee_bribed = false;
S.referee_assaulted = false;
S.ref_bribe_side = null;
S.accepted_bribe_this_match = false;


  // Debtors knocking
  await unpaidTransferTick();
// queue contextual visitors for this match (unrest / investigation)
queuePreMatchVisitors();


  // Process Press system pre-match events
  initPressSystem();
  await processPendingLawsuits();
  await processWifeConfrontation();
  
  // Decrement cooldowns
  if (S.press.cooldowns) {
    S.press.cooldowns.politics = Math.max(0, S.press.cooldowns.politics - 1);
    S.press.cooldowns.sports = Math.max(0, S.press.cooldowns.sports - 1);
    S.press.cooldowns.gossip = Math.max(0, S.press.cooldowns.gossip - 1);
  }
  if (S.press.confrontationCooldown) {
    S.press.confrontationCooldown = Math.max(0, S.press.confrontationCooldown - 1);
  }

  // Let the user do pre-match actions (bet, locker rooms, transfers, visitors)
  await preMatchTransfersAndBettingMenu();
}


async function playMatchPhase(){
if (!S.matchContext || !S.matchContext.team) {
  S.matchContext = currentOpponent();
}
  // Check for pre-revealed match result (rare narrative distortion)
  if (isDistortionActive()) {
    const preReveal = maybePreRevealMatchResult();
    if (preReveal) {
      // Small delay to show the pre-reveal
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  let outcome = await callIf('playMatch');
  if(outcome === undefined) outcome = await callIf('simulateMatch');
  return outcome;
}

// Quick sim with integrated taunt options and log-based commentary
// Show ominous massacre popout for season 5 match 1
async function showOminousMassacrePopout() {
  // Capture the players at the start (they will be removed at the end)
  const ourPlayers = getOurSelectedFive();
  const deadPlayerIds = ourPlayers.map(p => p.id);
  
  // Create the ominous overlay
  const overlay = document.createElement('div');
  overlay.className = 'ominous-popout-overlay';
  document.body.appendChild(overlay);
  
  // Create the popout container
  const container = document.createElement('div');
  container.className = 'ominous-popout-container';
  overlay.appendChild(container);
  
  // Create header
  const header = document.createElement('div');
  header.className = 'ominous-popout-header';
  const title = document.createElement('h2');
  title.className = 'ominous-popout-title';
  title.textContent = '⚔️ POST-MATCH ⚔️';
  header.appendChild(title);
  container.appendChild(header);
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'ominous-popout-content';
  container.appendChild(content);
  
  // Create close button (hidden until end)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ominous-popout-close';
  closeBtn.textContent = 'Continue';
  container.appendChild(closeBtn);
  
  // Helper to add commentary line
  const addCommentary = (text, className = '') => {
    const line = document.createElement('div');
    line.className = 'ominous-commentary-line' + (className ? ' ' + className : '');
    line.textContent = text;
    content.appendChild(line);
    // Auto-scroll to bottom
    content.scrollTop = content.scrollHeight;
    return line;
  };
  
  // Blood overlay (only created when shooting starts)
  let bloodOverlay = null;
  
  // Build up suspense - no blood or vibration yet
  await delay(2000);
  addCommentary('🎖️ Mohammed Van Onslaught comes onto the pitch with a group of Saudi Football emissaries.');
  
  await delay(2000);
  addCommentary('He announces he will be presenting Southampton with a \'Medal of Britain\'.');
  
  await delay(2000);
  addCommentary('The atmosphere is suspenseful. Your players all look happy and overjoyed, excited.');
  
  await delay(2000);
  addCommentary('The emissaries reach for their ceremonial guns to give an \'armed salute\' to your players.');
  
  await delay(2000);
  addCommentary('');
  
  // NOW the shooting starts - create blood overlay and add vibration
  if (typeof window.playSoundEffect === 'function') {
    window.playSoundEffect('machineGun', 0.9);
  }
  addCommentary('At which point they aim their machine guns at your team and open fire', 'shooting-start');
  
  // Create blood splatter overlay NOW (when shooting starts)
  bloodOverlay = document.createElement('div');
  bloodOverlay.className = 'blood-splatter-container';
  bloodOverlay.style.position = 'fixed';
  bloodOverlay.style.top = '0';
  bloodOverlay.style.left = '0';
  bloodOverlay.style.width = '100%';
  bloodOverlay.style.height = '100%';
  bloodOverlay.style.pointerEvents = 'none';
  bloodOverlay.style.zIndex = '20001';
  document.body.appendChild(bloodOverlay);
  
  // Add initial blood splatters
  for (let i = 0; i < 30; i++) {
    const splatter = document.createElement('div');
    splatter.className = Math.random() > 0.5 ? 'blood-splatter-large' : 'blood-splatter-small';
    splatter.style.left = Math.random() * 100 + '%';
    splatter.style.top = Math.random() * 100 + '%';
    bloodOverlay.appendChild(splatter);
  }
  
  // Add screen vibration
  document.body.style.animation = 'screenShake 0.3s ease-out';
  setTimeout(() => {
    document.body.style.animation = '';
  }, 300);
  
  await delay(2000);
  addCommentary('');
  
  // Vary death scenes for each player
  const deathVariations = [
    (name) => `💀 ${name} is gunned down. ${name} gasps for air as blood pools out.`,
    (name) => `💀 ${name} takes multiple rounds to the chest. The life drains from ${name}'s eyes.`,
    (name) => `💀 ${name} collapses to the ground, crimson spreading across the pitch.`,
    (name) => `💀 ${name} is shot in the head. ${name} slumps forward, motionless.`,
    (name) => `💀 ${name} tries to run but is cut down by gunfire. ${name} twitches once, then lies still.`,
  ];
  
  // Log each player's death with varied descriptions
  for (let i = 0; i < ourPlayers.length; i++) {
    const player = ourPlayers[i];
    const deathText = deathVariations[i % deathVariations.length](player.name);
    addCommentary(deathText, 'death');
    
    // Add more blood splatters for each death
    for (let j = 0; j < 5; j++) {
      const splatter = document.createElement('div');
      splatter.className = Math.random() > 0.5 ? 'blood-splatter-large' : 'blood-splatter-small';
      splatter.style.left = Math.random() * 100 + '%';
      splatter.style.top = Math.random() * 100 + '%';
      bloodOverlay.appendChild(splatter);
    }
    
    // Add vibration for each death
    document.body.style.animation = 'screenShake 0.2s ease-out';
    setTimeout(() => {
      document.body.style.animation = '';
    }, 200);
    
    await delay(1000);
  }
  
  await delay(3000);
  
  // Show close button
  closeBtn.classList.add('show');
  
  // Wait for user to click continue
  await new Promise(resolve => {
    closeBtn.addEventListener('click', () => {
      // Remove blood overlay
      if (bloodOverlay) {
        bloodOverlay.remove();
      }
      // Remove popout
      overlay.remove();
      resolve();
    }, { once: true });
  });
  
  // Remove all 5 starting players from squad (they all died)
  if (deadPlayerIds && deadPlayerIds.length > 0) {
    if (Array.isArray(S.squad)) {
      S.squad = S.squad.filter(p => !deadPlayerIds.includes(p.id));
    }
    if (Array.isArray(S.lineup)) {
      S.lineup = S.lineup.filter(id => !deadPlayerIds.includes(id));
    }
    // Also clear lineup if it's an array of player objects
    if (Array.isArray(S.lineup) && S.lineup.length > 0 && typeof S.lineup[0] === 'object') {
      S.lineup = S.lineup.filter(p => !deadPlayerIds.includes(p.id));
    }
  }
  
  
  // Set up special post-match music BEFORE panic video/aftermath UI
  // This music will play during aftermath UI and continue through the first post-match UI
  const isSeason5FirstMatch = (S.season === 5 && S.matches_played === 0);
  if (isSeason5FirstMatch) {
    // Stop general background music
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
    
    // Create and store the post-match audio (but don't play it yet - aftermath UI will start it)
    const postMatchTrackUrl = 'https://www.dropbox.com/scl/fi/99k3vl0z7pwwv61irqnj3/delmor-shoot.mp3?rlkey=kqwvyt6a02ltwda4hs66ru1wo&st=4o4ndk0j&dl=1';
    const postMatchAudio = new Audio(postMatchTrackUrl);
    postMatchAudio.preload = 'auto';
    postMatchAudio.volume = 1.0;
    
    // Store globally so aftermath UI and first post-match UI can use it
    window._season5PostMatchAudio = postMatchAudio;
  }
  
  // Play Panic video right after massacre
  await playPanicVideo();
  
  
  // Clear the flag so the old post-match video code doesn't play it again
  if (S.season5) {
    S.season5.play_panic_video = false;
  }
}

// ========== TRAIN TRACKS SCENE (Season 5 Episode 1) ==========
// Call this function after the confrontation with Mohammed Van Onslaught on train tracks
// Usage: After the confrontation scene ends, call: await showTrainTracksNextButton();
// Make it globally accessible - defined early so it's available when needed
window.showTrainTracksNextButton = async function showTrainTracksNextButton() {
  
  // Create a promise that resolves when the train tracks sequence completes
  let trainTracksResolve;
  const trainTracksPromise = new Promise(resolve => {
    trainTracksResolve = resolve;
  });
  
  // Try to find actions element, but don't return early if not found
  let actions = document.getElementById('actions');
  
  // If actions doesn't exist, try to create it or use body
  if (!actions) {
    // Try to find the actions container or create a fallback
    actions = document.querySelector('#actions') || document.body;
  }
  
  // Clear any existing buttons in actions if it exists
  if (actions && actions.innerHTML !== undefined) {
    actions.innerHTML = '';
  }
  
  // Create "Next" button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.className = 'btn';
  nextBtn.style.cssText = `
    padding: 12px 24px; 
    font-size: 16px; 
    cursor: pointer; 
    margin: 10px;
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30000;
    background: rgba(139, 0, 0, 0.9);
    border: 2px solid #8b0000;
    color: #fff;
    border-radius: 6px;
    box-shadow: 0 0 20px rgba(139, 0, 0, 0.6);
  `;
  nextBtn.onclick = async () => {
    nextBtn.remove();
    if (typeof window.startTrainTracksSequence === 'function') {
      try {
        await window.startTrainTracksSequence();
        trainTracksResolve();
      } catch (error) {
        console.error('DEBUG: Error in train tracks sequence:', error);
        trainTracksResolve(); // Resolve anyway to prevent hanging
      }
    } else {
      console.error('DEBUG: startTrainTracksSequence is not defined!');
      console.error('DEBUG: Available window properties with "train":', Object.keys(window).filter(k => k.toLowerCase().includes('train')));
      // Try to find and call it anyway
      if (window.startTrainTracksSequence) {
        try {
          await window.startTrainTracksSequence();
          trainTracksResolve();
        } catch (e) {
          console.error('DEBUG: Error calling startTrainTracksSequence:', e);
          trainTracksResolve(); // Resolve anyway to prevent hanging
        }
      } else {
        // If function doesn't exist, resolve immediately to prevent hanging
        console.error('DEBUG: startTrainTracksSequence not found, resolving promise to continue');
        trainTracksResolve();
      }
    }
  };
  
  // Append to body to ensure it's visible above modals
  document.body.appendChild(nextBtn);
  
  // Wait for the train tracks sequence to complete before returning
  await trainTracksPromise;
};

// Main train tracks sequence - defined early to ensure it's available when button is clicked
window.startTrainTracksSequence = async function startTrainTracksSequence() {
  
  // Stop background music
  let wasMusicPlaying = false;
  if (typeof window._stopGeneralMusic === 'function') {
    if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
      wasMusicPlaying = true;
    }
    window._stopGeneralMusic();
  } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
    wasMusicPlaying = true;
    generalMusicAudio.pause();
  }
  
  // Play train approach music
  const trainApproachAudio = new Audio('https://www.dropbox.com/scl/fi/ziktyumzsjdl3lj4x2h3m/train-approach.mp3?rlkey=542x1c4hfm6afvamrzhz7eloa&st=md1yiavn&dl=1');
  trainApproachAudio.volume = 0.7;
  trainApproachAudio.play().catch(e => console.error('Error playing train approach audio:', e));
  
  // Create a promise that resolves when the escape option is used or death occurs
  let escapeResolve;
  const escapePromise = new Promise((resolve) => {
    escapeResolve = resolve;
  });
  
  // Create frantic UI overlay
  const franticOverlay = document.createElement('div');
  franticOverlay.id = 'train-tracks-overlay';
  // Store the resolve function on the overlay so useEscapeOption can access it
  franticOverlay.escapeResolve = escapeResolve;
  // Store audio reference for cleanup
  franticOverlay._trainApproachAudio = trainApproachAudio;
  franticOverlay._wasMusicPlaying = wasMusicPlaying;
  franticOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #000;
    z-index: 20000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Arial', sans-serif;
  `;
  
  // Countdown timer
  const countdownEl = document.createElement('div');
  countdownEl.id = 'train-countdown';
  countdownEl.style.cssText = `
    font-size: 72px;
    font-weight: bold;
    color: #ff0000;
    text-shadow: 0 0 20px #ff0000;
    margin-bottom: 30px;
    animation: pulse 0.5s infinite;
  `;
  countdownEl.textContent = '10';
  
  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @keyframes vibrate {
      0%, 100% { transform: translate(0); }
      10% { transform: translate(-2px, -2px); }
      20% { transform: translate(2px, 2px); }
      30% { transform: translate(-2px, 2px); }
      40% { transform: translate(2px, -2px); }
      50% { transform: translate(-2px, -2px); }
      60% { transform: translate(2px, 2px); }
      70% { transform: translate(-2px, 2px); }
      80% { transform: translate(2px, -2px); }
      90% { transform: translate(-2px, -2px); }
    }
  `;
  document.head.appendChild(style);
  
  // Warning text indicating train is coming
  const warningText = document.createElement('div');
  warningText.id = 'train-warning';
  warningText.style.cssText = `
    font-size: 32px;
    font-weight: bold;
    color: #ff0000;
    text-shadow: 0 0 15px #ff0000;
    margin-bottom: 20px;
    text-align: center;
    animation: pulse 0.5s infinite;
  `;
  warningText.textContent = '🚂 TRAIN APPROACHING! 🚂';
  
  // Timer label
  const timerLabel = document.createElement('div');
  timerLabel.id = 'train-timer-label';
  timerLabel.style.cssText = `
    font-size: 24px;
    font-weight: bold;
    color: #fff;
    margin-bottom: 10px;
    text-align: center;
  `;
  timerLabel.textContent = 'Time until impact:';
  
  franticOverlay.appendChild(warningText);
  franticOverlay.appendChild(timerLabel);
  franticOverlay.appendChild(countdownEl);
  
  // Action buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.id = 'train-buttons-container';
  buttonsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 15px;
    align-items: center;
    margin-top: 30px;
  `;
  
  // Struggle button
  const struggleBtn = document.createElement('button');
  struggleBtn.id = 'struggle-btn';
  struggleBtn.textContent = 'Struggle';
  struggleBtn.style.cssText = `
    padding: 20px 40px;
    font-size: 24px;
    font-weight: bold;
    background: #333;
    color: #fff;
    border: 3px solid #ff0000;
    cursor: pointer;
    border-radius: 8px;
  `;
  
  let struggleCount = 0;
  let armFreed = false;
  const STRUGGLE_NEEDED = 5; // Number of presses needed to free arm
  
  struggleBtn.onclick = () => {
    // Vibrate button
    struggleBtn.style.animation = 'vibrate 0.3s';
    setTimeout(() => {
      struggleBtn.style.animation = '';
    }, 300);
    
    struggleCount++;
    
    if (struggleCount >= STRUGGLE_NEEDED && !armFreed) {
      armFreed = true;
      log(`<strong>You've freed an arm!</strong>`);
      showEscapeOptions(buttonsContainer);
    }
  };
  
  buttonsContainer.appendChild(struggleBtn);
  franticOverlay.appendChild(buttonsContainer);
  document.body.appendChild(franticOverlay);
  
  // Start countdown
  let timeLeft = 10;
  let countdownInterval;
  countdownInterval = setInterval(() => {
    timeLeft--;
    countdownEl.textContent = timeLeft.toString();
    
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      // Check if player has escaped
      if (!armFreed || !hasEscapeOptionUsed()) {
        handleTrainDeath();
      }
    }
  }, 1000);
  
  // Store interval and state for cleanup
  franticOverlay.countdownInterval = countdownInterval;
  franticOverlay.dataset.escapeUsed = 'false';
  
  
  // Return the promise - it will resolve when useEscapeOption or handleTrainDeath is called
  return escapePromise;
};

// Helper functions for train tracks sequence
function showEscapeOptions(container) {
  // Keep struggle button at the top, add escape buttons below
  const struggleBtn = document.getElementById('struggle-btn');
  
  // Create a wrapper to keep struggle button separate from escape buttons
  // Clear container but preserve struggle button
  const existingButtons = Array.from(container.children);
  container.innerHTML = '';
  
  // Re-add struggle button first
  if (struggleBtn) {
    container.appendChild(struggleBtn);
  }
  
  // Create a separate container for escape buttons below struggle button
  const escapeButtonsContainer = document.createElement('div');
  escapeButtonsContainer.id = 'escape-buttons-container';
  escapeButtonsContainer.style.cssText = `
    display: flex;
    flex-direction: row;
    gap: 15px;
    align-items: center;
    justify-content: center;
    margin-top: 20px;
  `;
  
  // Check for brick
  const hasBrick = S.inventory && S.inventory.items && 
    S.inventory.items.some(item => item.name === 'Brick' || item.name === 'brick');
  
  // Check for HGH
  const hasHGH = S.doctor && S.doctor.hgh_stock > 0;
  
  // Check for cocaine (check if player has any cocaine available)
  // Cocaine might be in inventory.drugs or tracked separately
  const hasCocaine = (S.inventory && S.inventory.drugs > 0) || 
    (S.cocaine_purchase_matches_ago !== undefined && S.cocaine_purchase_matches_ago < 999) ||
    (typeof window.hasCocaineAvailable === 'function' && window.hasCocaineAvailable());
  
  // Create escape buttons in the separate container (below struggle button)
  if (hasBrick) {
    const brickBtn = createEscapeButton('Throw Brick at Train', () => {
      useEscapeOption('brick');
    });
    escapeButtonsContainer.appendChild(brickBtn);
  }
  
  if (hasHGH) {
    const hghBtn = createEscapeButton('Use HGH', () => {
      useEscapeOption('hgh');
    });
    escapeButtonsContainer.appendChild(hghBtn);
  }
  
  if (hasCocaine) {
    const cokeBtn = createEscapeButton('Use Cocaine', () => {
      useEscapeOption('cocaine');
    });
    escapeButtonsContainer.appendChild(cokeBtn);
  }
  
  // Append escape buttons container below struggle button
  container.appendChild(escapeButtonsContainer);
}

function createEscapeButton(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    padding: 12px 24px;
    font-size: 18px;
    font-weight: bold;
    background: #ff0000;
    color: #fff;
    border: 3px solid #fff;
    cursor: pointer;
    border-radius: 8px;
    margin: 5px;
  `;
  btn.onclick = onClick;
  return btn;
}

function hasEscapeOptionUsed() {
  const overlay = document.getElementById('train-tracks-overlay');
  return overlay && overlay.dataset.escapeUsed === 'true';
}

async function useEscapeOption(option) {
  const overlay = document.getElementById('train-tracks-overlay');
  if (overlay) {
    overlay.dataset.escapeUsed = 'true';
    if (overlay.countdownInterval) {
      clearInterval(overlay.countdownInterval);
    }
  }
  
  // Stop train approach music
  if (overlay && overlay._trainApproachAudio) {
    overlay._trainApproachAudio.pause();
    overlay._trainApproachAudio.currentTime = 0;
  }
  
  // Remove overlay
  if (overlay) overlay.remove();
  
  // Video URLs (convert from dl=0 to dl=1 for direct download)
  const videos = {
    brick: 'https://www.dropbox.com/scl/fi/ocrti8q88tlvhrf8j1dly/brick-train.mp4?rlkey=t1dsgc72zsqbjoltkjb7axevp&st=9iuj9yi2&dl=1',
    hgh: 'https://www.dropbox.com/scl/fi/js9ro21itgzyufejmezps/hgh-train.mp4?rlkey=gmx3zs72nrp5phn6vkw3a3esw&st=7nuckk68&dl=1',
    cocaine: 'https://www.dropbox.com/scl/fi/xt4aysadhw6sxwksl674w/coke-train.mp4?rlkey=dm9pzg7aguaexdhazyvp38ka6&st=bqz3tby8&dl=1'
  };
  
  const videoUrl = videos[option];
  if (!videoUrl) {
    // Resume background music if it was playing
    if (overlay && overlay._wasMusicPlaying) {
      if (typeof window._startGeneralMusic === 'function') {
        window._startGeneralMusic();
      } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
        generalMusicAudio.play().catch(err => {
        });
      }
    }
    // Resolve the promise to continue the flow
    if (overlay && overlay.escapeResolve) {
      overlay.escapeResolve();
    }
    return;
  }
  
  // Play video
  await playTrainVideo(videoUrl);
  
  // Show consequences
  log(`<strong>The train careens into a row of detached houses.</strong>`);
  log(`Hundreds of people on board are killed.`);
  log(`78 people in the houses are killed.`);
  log(`You survive, but at what cost?`);
  log(``);
  
  
  // Clear actions - main loop will handle post-match
  const actions = document.getElementById('actions');
  if (actions) actions.innerHTML = '';
  
  // Resume background music if it was playing
  if (overlay && overlay._wasMusicPlaying) {
    if (typeof window._startGeneralMusic === 'function') {
      window._startGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
      generalMusicAudio.play().catch(err => {
      });
    }
  }
  
  // Resolve the promise to continue the flow back to the main loop
  if (overlay && overlay.escapeResolve) {
    overlay.escapeResolve();
  }
  
  // DO NOT call post-match functions here - the main game loop will handle them
  // The train tracks sequence is inserted into the match flow, but should not
  // replace the normal post-match flow. Just return and let the main loop continue.
}

async function handleTrainDeath() {
  const overlay = document.getElementById('train-tracks-overlay');
  if (overlay) {
    if (overlay.countdownInterval) {
      clearInterval(overlay.countdownInterval);
    }
    
    // Stop train approach music
    if (overlay._trainApproachAudio) {
      overlay._trainApproachAudio.pause();
      overlay._trainApproachAudio.currentTime = 0;
    }
    
    // Death is terminal: the escape promise is deliberately NOT resolved, so the
    // story that awaits the train sequence never resumes. The player restarts or
    // reloads the last save (which predates the death; we don't save here).
    overlay.remove();
  }
  S.game_over = true;
  S.game_over_reason = 'Hit by a train.';
  
  // Resume background music if it was playing
  if (overlay && overlay._wasMusicPlaying) {
    if (typeof window._startGeneralMusic === 'function') {
      window._startGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
      generalMusicAudio.play().catch(err => {
      });
    }
  }
  
  // Play death video
  const deathVideoUrl = 'https://www.dropbox.com/scl/fi/233hhgbp17a1uj3x3btfs/splat-train.mp4?rlkey=dzvmsldpbpekkmtkjwifmcnvs&st=6oipaisk&dl=1';
  await playTrainVideo(deathVideoUrl);
  
  // Show game over message
  log(``);
  log(`<strong style="font-size: 2em; color: #ff0000;">YOU ARE DEAD - GAME OVER</strong>`);
  log(``);
  
  // Show restart buttons
  const actions = document.getElementById('actions');
  if (actions) {
    actions.innerHTML = '';
    
    const startAgainBtn = document.createElement('button');
    startAgainBtn.textContent = 'Start Again';
    startAgainBtn.className = 'btn';
    startAgainBtn.style.cssText = 'padding: 12px 24px; font-size: 16px; cursor: pointer; margin: 10px; background: #ff0000; color: #fff;';
    startAgainBtn.onclick = () => {
      location.reload();
    };
    actions.appendChild(startAgainBtn);
    
    const resumeBtn = document.createElement('button');
    resumeBtn.textContent = 'Resume from Last Save';
    resumeBtn.className = 'btn';
    resumeBtn.style.cssText = 'padding: 12px 24px; font-size: 16px; cursor: pointer; margin: 10px;';
    resumeBtn.onclick = () => {
      if (typeof loadState === 'function') {
        loadState();
      } else {
        location.reload();
      }
    };
    actions.appendChild(resumeBtn);
  }
}

async function playTrainVideo(videoUrl) {
  return new Promise((resolve) => {
    // Stop general music when video starts
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    
    const videoDiv = document.createElement('div');
    videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 25000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
    
    const xButton = document.createElement('button');
    xButton.textContent = '✕';
    xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #6366f1; color: white; border: none; width: 30px; height: 30px; font-size: 20px; cursor: pointer; z-index: 25001;';
    
    const closeVideo = () => {
      videoDiv.remove();
      // Start a new track after video ends
      if (typeof window._startGeneralMusic === 'function') {
        setTimeout(() => {
          window._startGeneralMusic();
        }, 500);
      }
      resolve();
    };
    
    xButton.onclick = closeVideo;
    
    videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹</div><video id="trainVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + videoUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
    videoDiv.appendChild(xButton);
    document.body.appendChild(videoDiv);
    
    const video = document.getElementById('trainVideo');
    if (video) {
      video.addEventListener('ended', () => {
        setTimeout(() => {
          closeVideo();
        }, 500);
      });
      
      // Also resolve if video is closed manually
      xButton.onclick = closeVideo;
    } else {
      // Fallback if video doesn't load
      setTimeout(() => {
        closeVideo();
      }, 100);
    }
  });
}

// Function to show kidnapping sequence modal after panic video
async function showKidnappingSequenceModal() {
  
  // Stop background music - be aggressive about it to prevent clashing
  let wasMusicPlaying = false;
  
  // Method 1: Use the standard stop function
  if (typeof window._stopGeneralMusic === 'function') {
    if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
      wasMusicPlaying = true;
    }
    window._stopGeneralMusic();
  }
  
  // Method 2: Directly pause generalMusicAudio if it exists
  if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
    if (!generalMusicAudio.paused) {
      wasMusicPlaying = true;
    }
    generalMusicAudio.pause();
    generalMusicAudio.currentTime = 0; // Reset to prevent it from continuing
  }
  
  // Method 3: Pause opening music if playing
  const openingMusic = document.getElementById('openingMusic');
  if (openingMusic && !openingMusic.paused) {
    openingMusic.pause();
  }
  
  // Method 4: Stop any other background music that might be playing
  // Wait a moment for DOM to update, then check all audio elements
  setTimeout(() => {
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      // Skip the post-match audio we want to keep
      if (audio === window._season5PostMatchAudio) {
        return;
      }
      // Skip opening music (already handled)
      if (audio.id === 'openingMusic') {
        return;
      }
      // Pause any other playing audio
      if (!audio.paused) {
        const audioSrc = audio.src || audio.currentSrc || '';
        // Only stop if it's not the special post-match track
        if (!audioSrc.includes('delmor-shoot.mp3') && !audioSrc.includes('onslaught.mp3')) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    });
  }, 100);
  
  // Wait a moment to ensure background music has stopped
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // Use the post-match audio that was already created (before panic video), or create new one
  let postMatchAudio = window._season5PostMatchAudio;
  if (!postMatchAudio) {
    // If no existing audio, create new one with correct URL
    const postMatchTrackUrl = 'https://www.dropbox.com/scl/fi/99k3vl0z7pwwv61irqnj3/delmor-shoot.mp3?rlkey=kqwvyt6a02ltwda4hs66ru1wo&st=4o4ndk0j&dl=1';
    postMatchAudio = new Audio(postMatchTrackUrl);
    postMatchAudio.volume = 1.0;
    window._season5PostMatchAudio = postMatchAudio;
  } else {
  }
  
  // Ensure it's playing - start it if paused, restart if ended
  if (postMatchAudio.paused || postMatchAudio.ended) {
    if (postMatchAudio.ended) {
      postMatchAudio.currentTime = 0;
    } else {
    }
    postMatchAudio.play().catch(e => {
      console.error('Error playing post-match audio in aftermath UI:', e);
      // Retry once after a short delay
      setTimeout(() => {
        postMatchAudio.play().catch(e2 => console.error('Retry failed:', e2));
      }, 500);
    });
  } else {
    // If it's already playing, make sure volume is correct
    postMatchAudio.volume = 1.0;
  }
  
  // Create modal overlay
  const existingModal = document.getElementById('kidnapping-sequence-modal');
  if (existingModal) existingModal.remove();
  
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'kidnapping-sequence-modal';
  modalOverlay.className = 'sinister-modal-overlay';
  // Store audio reference for cleanup
  modalOverlay._postMatchAudio = postMatchAudio;
  modalOverlay._wasMusicPlaying = wasMusicPlaying;
  
  const modal = document.createElement('div');
  modal.className = 'sinister-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'sinister-modal-content';
  modalContent.innerHTML = `<div class="sinister-title">━━━ AFTERMATH ━━━</div>`;
  
  modal.appendChild(modalContent);
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
  
  // Skip flag to bypass typewriter animation
  let skipAnimation = false;
  let messageIndex = 0;
  
  // Function to append text to modal with typewriter effect
  const appendToModal = (text, delay = 0, useTypewriter = true) => {
    return new Promise(resolve => {
      if (skipAnimation) {
        const p = document.createElement('p');
        if (text.trim() === '') {
          p.innerHTML = '<br>';
        } else {
          p.textContent = text;
        }
        modalContent.appendChild(p);
        modal.scrollTop = modal.scrollHeight;
        messageIndex++;
        resolve();
        return;
      }
      
      setTimeout(() => {
        const p = document.createElement('p');
        if (text.trim() === '') {
          p.innerHTML = '<br>';
          modalContent.appendChild(p);
          modal.scrollTop = modal.scrollHeight;
          messageIndex++;
          resolve();
        } else if (useTypewriter && text.trim() !== '' && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
          const span = document.createElement('span');
          span.className = 'typewriter-line';
          span.textContent = text;
          p.appendChild(span);
          modalContent.appendChild(p);
          
          const measureEl = document.createElement('span');
          measureEl.style.visibility = 'hidden';
          measureEl.style.position = 'absolute';
          measureEl.style.whiteSpace = 'nowrap';
          measureEl.style.font = window.getComputedStyle(span).font;
          measureEl.textContent = text;
          document.body.appendChild(measureEl);
          const textWidth = measureEl.offsetWidth;
          document.body.removeChild(measureEl);
          
          span.style.maxWidth = textWidth + 'px';
          
          setTimeout(() => {
            span.classList.add('no-cursor');
          }, 2600);
          
          setTimeout(() => {
            modal.scrollTop = modal.scrollHeight;
            messageIndex++;
            resolve();
          }, 2500);
        } else {
          p.innerHTML = text;
          modalContent.appendChild(p);
          modal.scrollTop = modal.scrollHeight;
          messageIndex++;
          resolve();
        }
      }, delay);
    });
  };
  
  // Add NEXT button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'sinister-modal-close-btn';
  nextBtn.textContent = 'NEXT';
  nextBtn.style.display = 'none';
  
  // Add skip button
  const skipBtn = document.createElement('button');
  skipBtn.className = 'sinister-modal-close-btn';
  skipBtn.textContent = 'Skip';
  skipBtn.style.position = 'fixed';
  skipBtn.style.bottom = '20px';
  skipBtn.style.right = '20px';
  skipBtn.style.transform = 'none';
  skipBtn.style.background = 'rgba(139, 0, 0, 0.4)';
  skipBtn.style.border = '2px solid #8b0000';
  skipBtn.style.color = '#cc0000';
  skipBtn.style.padding = '12px 24px';
  skipBtn.style.fontSize = '14px';
  skipBtn.style.cursor = 'pointer';
  skipBtn.style.zIndex = '10001';
  
  // Create a promise that resolves when NEXT is clicked
  let continueResolve;
  const continuePromise = new Promise(resolve => {
    continueResolve = resolve;
  });
  
  let currentPhase = 0; // Track which phase of the sequence we're in
  
  nextBtn.onclick = async () => {
    if (currentPhase === 0) {
      // First phase: kidnapping description
      currentPhase = 1;
      nextBtn.style.display = 'none';
      skipBtn.style.display = 'none';
      
      // Ensure background music is stopped for confrontation UI
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
      
      // Stop post-match music and start confrontation music
      if (modalOverlay._postMatchAudio) {
        modalOverlay._postMatchAudio.pause();
        modalOverlay._postMatchAudio.currentTime = 0;
      }
      
      // Also stop the global post-match audio if it exists
      if (window._season5PostMatchAudio && !window._season5PostMatchAudio.paused) {
        window._season5PostMatchAudio.pause();
        window._season5PostMatchAudio.currentTime = 0;
      }
      
      // Play confrontation music
      const confrontationAudio = new Audio('https://www.dropbox.com/scl/fi/ns7nxuo9mxpwk3swkuwgh/onslaught.mp3?rlkey=p78q43twir3czojobs3fd7eeg&st=cjvpnwa0&dl=1');
      confrontationAudio.volume = 0.7;
      confrontationAudio.play().catch(e => console.error('Error playing confrontation audio:', e));
      modalOverlay._confrontationAudio = confrontationAudio;
      
      // Clear modal and show Van Onslaught confrontation
      modalContent.innerHTML = `<div class="sinister-title">━━━ CONFRONTATION ━━━</div>`;
      messageIndex = 0;
      
      // Reset skip animation and message index for confrontation phase
      skipAnimation = false;
      messageIndex = 0;
      
      // Display confrontation messages (already defined above)
      for (const msg of confrontationMessages) {
        await appendToModal(msg.text, msg.delay);
      }
      
      // Show NEXT button again for final phase
      nextBtn.style.display = 'block';
      skipBtn.style.display = 'block';
    } else {
      // Final phase: Close modal and transition to train tracks sequence
      // Stop confrontation music
      if (modalOverlay._confrontationAudio) {
        modalOverlay._confrontationAudio.pause();
        modalOverlay._confrontationAudio.currentTime = 0;
      }
      // Also stop post-match music if still playing (shouldn't be, but just in case)
      if (modalOverlay._postMatchAudio) {
        modalOverlay._postMatchAudio.pause();
        modalOverlay._postMatchAudio.currentTime = 0;
      }
      // Resume background music if it was playing
      if (modalOverlay._wasMusicPlaying) {
        if (typeof window._startGeneralMusic === 'function') {
          window._startGeneralMusic();
        } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
          generalMusicAudio.play().catch(err => {
          });
        }
      }
      
      modalOverlay.style.animation = 'sinisterFadeIn 0.5s ease-out reverse';
      setTimeout(async () => {
        modalOverlay.remove();
        
        // After modal closes, trigger train tracks countdown sequence
        // Wait a bit for the modal to fully fade out
        await new Promise(resolve => setTimeout(resolve, 600));
        
        
        if (typeof window.showTrainTracksNextButton === 'function') {
          try {
            await window.showTrainTracksNextButton();
          } catch (error) {
            console.error('DEBUG: Error calling window.showTrainTracksNextButton:', error);
          }
        } else {
          console.error('DEBUG: showTrainTracksNextButton is not a function!');
          console.error('DEBUG: Available on window:', Object.keys(window).filter(k => k.includes('Train')));
          console.error('DEBUG: All window properties with "show" or "Train":', Object.keys(window).filter(k => k.toLowerCase().includes('train') || k.toLowerCase().includes('show')));
        }
        
        // Only resolve after train tracks sequence completes
        continueResolve();
      }, 500);
    }
  };
  
  // Store all messages for skip functionality
  const allMessages = [
    { text: `In the dugout, everything goes black.`, delay: 400 },
    { text: ``, delay: 0 },
    { text: `A rough sack is pulled over your head.`, delay: 800 },
    { text: `You can't see bloody anything! This aint good, lad!`, delay: 600 },
    { text: ``, delay: 0 },
    { text: `Islamic hands grab you, rough and insistent.`, delay: 1000 },
    { text: `You feel yourself being manhandled.`, delay: 1200 },
    { text: `You try to resist, but you don't have energy as you are so hungry`, delay: 1000 },
    { text: ``, delay: 0 },
    { text: `You're thrown into a car. The door slams shut.`, delay: 1000 },
    { text: ``, delay: 0 },
    { text: `The engine starts. You're being driven somewhere.`, delay: 1200 },
    { text: ``, delay: 0 },
    { text: `Heavy middle eastern accents sound around you.`, delay: 1000 },
    { text: `You can't make out the words clearly.`, delay: 800 },
    { text: ``, delay: 0 },
    { text: `But it sounds like a potential terrorist plot!!!`, delay: 1200 },
    { text: ``, delay: 0 },
    { text: `The car stops.`, delay: 800 },
    { text: ``, delay: 0 },
    { text: `You're dragged out, thrown onto the ground.`, delay: 1000 },
    { text: `Metal and wood press against your body.`, delay: 800 },
    { text: ``, delay: 0 },
    { text: `Ropes bind your wrists and ankles.`, delay: 1000 },
    { text: ``, delay: 0 }
  ];
  
  // Store confrontation messages for skip functionality
  const confrontationMessages = [
    { text: `The bag is ripped off your head.`, delay: 200 },
    { text: ``, delay: 0 },
    { text: `Mohammed Van Onslaught towers above you, his entourage surrounding you in a circle.`, delay: 1200 },
    { text: ``, delay: 0 },
    { text: `His eyes burn with cold fury.`, delay: 1000 },
    { text: ``, delay: 0 },
    { text: `"You BRITISH fool," he snarls, his voice cutting through the air like a blade.`, delay: 1200 },
    { text: `"You refused to sell Southampton to me. You thought you could defy me."`, delay: 1200 },
    { text: `"No one defies the great Mohammed Van Onslaught! Especially not British people!"`, delay: 1200 },
    { text: ``, delay: 0 },
    { text: `He steps closer, his shadow falling over you.`, delay: 1000 },
    { text: ``, delay: 0 },
    { text: `"I will take your stupid Club by force," he announces, his voice rising.`, delay: 1200 },
    { text: `"You have mere seconds until a speeding passenger train ends your miserable, obese existence."`, delay: 1500 },
    { text: ``, delay: 0 },
    { text: `He smiles, a cruel, twisted expression.`, delay: 1000 },
    { text: ``, delay: 0 },
    { text: `"That train will send you to hell," he continues,`, delay: 1200 },
    { text: `"Say hello to all the Southampton players I just murdered."`, delay: 1500 },
    { text: ``, delay: 0 }
  ];
  
  skipBtn.onclick = async () => {
    skipAnimation = true;
    skipBtn.style.display = 'none';
    
    if (currentPhase === 0) {
      // Display all remaining kidnapping messages immediately
      for (let i = messageIndex; i < allMessages.length; i++) {
        const msg = allMessages[i];
        const p = document.createElement('p');
        if (msg.text.trim() === '') {
          p.innerHTML = '<br>';
        } else {
          p.textContent = msg.text;
        }
        modalContent.appendChild(p);
      }
      modal.scrollTop = modal.scrollHeight;
      messageIndex = allMessages.length;
      
      // Show NEXT button
      nextBtn.style.display = 'block';
    } else {
      // Display all remaining confrontation messages immediately
      for (let i = messageIndex; i < confrontationMessages.length; i++) {
        const msg = confrontationMessages[i];
        const p = document.createElement('p');
        if (msg.text.trim() === '') {
          p.innerHTML = '<br>';
        } else {
          p.textContent = msg.text;
        }
        modalContent.appendChild(p);
      }
      modal.scrollTop = modal.scrollHeight;
      messageIndex = confrontationMessages.length;
      
      // Show NEXT button
      nextBtn.style.display = 'block';
    }
  };
  
  modalOverlay.appendChild(nextBtn);
  modalOverlay.appendChild(skipBtn);
  
  // Show kidnapping sequence with typewriter effect
  (async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    for (const msg of allMessages) {
      await appendToModal(msg.text, msg.delay);
    }
    
    // Show NEXT button
    nextBtn.style.display = 'block';
    skipBtn.style.display = 'none';
  })();
  
  // Wait for NEXT button to be clicked
  await continuePromise;
}

// Function to play the Panic video
async function playPanicVideo() {
  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.className = 'cinematic-video-container';
  videoContainer.style.position = 'fixed';
  videoContainer.style.top = '0';
  videoContainer.style.left = '0';
  videoContainer.style.width = '100%';
  videoContainer.style.height = '100%';
  videoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  videoContainer.style.zIndex = '99999';
  videoContainer.style.display = 'flex';
  videoContainer.style.alignItems = 'center';
  videoContainer.style.justifyContent = 'center';
  
  const video = document.createElement('video');
  video.src = 'https://www.dropbox.com/scl/fi/uv9uwapaxv89ovd4u225w/Panic.mp4?rlkey=rrv6pdbw76qzkhnyw3ii4wajk&st=1x7j1wul&dl=1';
  video.controls = false;
  video.autoplay = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'contain';
  
  const videoCloseBtn = document.createElement('button');
  videoCloseBtn.className = 'cinematic-video-close-btn';
  videoCloseBtn.textContent = '✕ Close';
  videoCloseBtn.style.display = 'none';
  videoCloseBtn.style.position = 'absolute';
  videoCloseBtn.style.top = '20px';
  videoCloseBtn.style.right = '20px';
  videoCloseBtn.style.padding = '10px 20px';
  videoCloseBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  videoCloseBtn.style.color = 'white';
  videoCloseBtn.style.border = '2px solid white';
  videoCloseBtn.style.borderRadius = '8px';
  videoCloseBtn.style.cursor = 'pointer';
  videoCloseBtn.style.fontSize = '16px';
  videoCloseBtn.style.zIndex = '100000';
  
  // Add loading indicator
  const loadingText = document.createElement('div');
  loadingText.textContent = 'Loading video...';
  loadingText.style.color = 'white';
  loadingText.style.fontSize = '18px';
  loadingText.style.position = 'absolute';
  loadingText.style.top = '50%';
  loadingText.style.left = '50%';
  loadingText.style.transform = 'translate(-50%, -50%)';
  loadingText.style.zIndex = '100001';
  
  videoContainer.appendChild(video);
  videoContainer.appendChild(videoCloseBtn);
  videoContainer.appendChild(loadingText);
  document.body.appendChild(videoContainer);
  
  // Handle video loading
  let videoLoaded = false;
  let videoError = false;
  
  video.addEventListener('loadeddata', () => {
    videoLoaded = true;
    loadingText.style.display = 'none';
    // Try to play the video
    video.play().catch(err => {
      console.error('Video autoplay failed:', err);
      // Show play button if autoplay fails
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ Play Video';
      playBtn.style.position = 'absolute';
      playBtn.style.top = '50%';
      playBtn.style.left = '50%';
      playBtn.style.transform = 'translate(-50%, -50%)';
      playBtn.style.padding = '15px 30px';
      playBtn.style.fontSize = '18px';
      playBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
      playBtn.style.color = 'black';
      playBtn.style.border = 'none';
      playBtn.style.borderRadius = '8px';
      playBtn.style.cursor = 'pointer';
      playBtn.style.zIndex = '100002';
      playBtn.onclick = () => {
        video.play();
        playBtn.remove();
      };
      videoContainer.appendChild(playBtn);
      loadingText.style.display = 'none';
    });
  });
  
  video.addEventListener('canplay', () => {
    if (!videoLoaded) {
      videoLoaded = true;
      loadingText.style.display = 'none';
    }
  });
  
  video.addEventListener('error', (e) => {
    console.error('Video loading error:', e);
    videoError = true;
    loadingText.textContent = 'Error loading video. Click to close.';
    loadingText.style.cursor = 'pointer';
    loadingText.onclick = () => {
      videoContainer.remove();
    };
    videoCloseBtn.style.display = 'block';
  });
  
  // Show close button after video ends or on click
  video.addEventListener('ended', () => {
    videoCloseBtn.style.display = 'block';
  });
  
  // Wait for video to end or be closed
  await new Promise(resolve => {
    let resolved = false;
    const doResolve = () => {
      if (!resolved) {
        resolved = true;
        if (document.body.contains(videoContainer)) {
          videoContainer.remove();
        }
        resolve();
      }
    };
    
    video.addEventListener('ended', () => {
      setTimeout(() => {
        doResolve();
      }, 500);
    }, { once: true });
    
    videoCloseBtn.addEventListener('click', () => {
      doResolve();
    }, { once: true });
  });
  
  
  // After panic video: Show kidnapping sequence UI log for Season 5 Match 1
  // This is called from showOminousMassacrePopout() which only happens on the first match
  // So we can safely show the sequence if it hasn't been shown yet
  if (S.season === 5) {
    if (!S.season5) S.season5 = {};
    
    // Safety check: If we're on match 0 and the flag is somehow true, reset it
    // This handles cases where the flag persisted from a previous save incorrectly
    if (S.matches_played === 0 && S.season5.kidnapping_sequence_shown === true) {
      S.season5.kidnapping_sequence_shown = false;
    }
    
    if (!S.season5.kidnapping_sequence_shown) {
      if (typeof showKidnappingSequenceModal === 'function') {
        try {
          await showKidnappingSequenceModal();
          // Only set flag to true AFTER the modal has been shown successfully
          S.season5.kidnapping_sequence_shown = true;
        } catch (error) {
          console.error('DEBUG: Error showing kidnapping sequence modal:', error);
          // Don't set flag if there was an error, so it can try again
        }
      } else {
        console.error('showKidnappingSequenceModal is not defined');
      }
    } else {
    }
  } else {
  }
}

// Function to play the Downing Street video
async function playDowningStreetVideo() {
  return new Promise((resolve) => {
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'cinematic-video-container';
    videoContainer.style.position = 'fixed';
    videoContainer.style.top = '0';
    videoContainer.style.left = '0';
    videoContainer.style.width = '100%';
    videoContainer.style.height = '100%';
    videoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    videoContainer.style.zIndex = '99999';
    videoContainer.style.display = 'flex';
    videoContainer.style.alignItems = 'center';
    videoContainer.style.justifyContent = 'center';
    
    const video = document.createElement('video');
    video.src = 'https://www.dropbox.com/scl/fi/ud8j5efbptqqj5823s2u0/downing.mp4?rlkey=t17hm2yhfff2vrcj5f08tbxzu&st=khp50ume&dl=1';
    video.controls = false;
    video.autoplay = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    
    // Add loading indicator
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading video...';
    loadingText.style.color = 'white';
    loadingText.style.fontSize = '18px';
    loadingText.style.position = 'absolute';
    loadingText.style.top = '50%';
    loadingText.style.left = '50%';
    loadingText.style.transform = 'translate(-50%, -50%)';
    loadingText.style.zIndex = '100001';
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(loadingText);
    document.body.appendChild(videoContainer);
    
    // Handle video loading
    video.addEventListener('loadeddata', () => {
      loadingText.style.display = 'none';
      video.play().catch(err => {
        console.error('Video autoplay failed:', err);
      });
    });
    
    video.addEventListener('canplay', () => {
      loadingText.style.display = 'none';
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      loadingText.textContent = 'Error loading video. Click to close.';
      loadingText.style.cursor = 'pointer';
      loadingText.onclick = () => {
        videoContainer.remove();
        resolve();
      };
    });
    
    // When video ends, show "Go to the Trident room" button
    video.addEventListener('ended', () => {
      videoContainer.remove();
      showTridentRoomButton().then(() => resolve());
    }, { once: true });
  });
}

// Show "Go to the Trident room" button after video
async function showTridentRoomButton() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const button = document.createElement('button');
    button.textContent = 'Go to the Trident room';
    button.style.cssText = `
      padding: 20px 40px;
      font-size: 24px;
      font-weight: bold;
      background: #fff;
      color: #000;
      border: 3px solid #fff;
      border-radius: 8px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      transition: all 0.3s ease;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#000';
      button.style.color = '#fff';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#fff';
      button.style.color = '#000';
    });
    
    button.addEventListener('click', () => {
      overlay.remove();
      showTridentRoomInterface().then(() => resolve());
    });
    
    overlay.appendChild(button);
    document.body.appendChild(overlay);
  });
}

// Show DOS-style Trident room interface
async function showTridentRoomInterface() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99997;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `;
    
    const screen = document.createElement('div');
    screen.style.cssText = `
      width: 90%;
      max-width: 800px;
      height: 80%;
      background: #000;
      border: 3px solid #00ff00;
      padding: 20px;
      color: #00ff00;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 20px #00ff00;
    `;
    
    const header = document.createElement('div');
    header.textContent = 'TRIDENT NUCLEAR COMMAND SYSTEM v2.1';
    header.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
      text-align: center;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 10px;
    `;
    
    const prompt = document.createElement('div');
    prompt.textContent = 'C:\\TRIDENT> ';
    prompt.style.cssText = `
      font-size: 16px;
      margin-bottom: 30px;
      margin-top: 20px;
    `;
    
    const button = document.createElement('button');
    button.textContent = 'LAUNCH A NUCLEAR STRIKE';
    button.style.cssText = `
      padding: 15px 30px;
      font-size: 20px;
      font-weight: bold;
      background: #000;
      color: #00ff00;
      border: 2px solid #00ff00;
      border-radius: 0;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      margin: 20px auto;
      display: block;
      transition: all 0.2s ease;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#00ff00';
      button.style.color = '#000';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#000';
      button.style.color = '#00ff00';
    });
    
    button.addEventListener('click', () => {
      overlay.remove();
      showNuclearStrikeTargetSelection().then(() => resolve());
    });
    
    screen.appendChild(header);
    screen.appendChild(prompt);
    screen.appendChild(button);
    overlay.appendChild(screen);
    document.body.appendChild(overlay);
  });
}

// Show nuclear strike target selection
async function showNuclearStrikeTargetSelection() {
  return new Promise((resolve) => {
    // Get season 5 teams (excluding Southampton)
    function getSeason5Teams() {
      if (typeof getFinalStandings === 'function') {
        const standings = getFinalStandings();
        return standings
          .map(row => row.team)
          .filter(team => team !== 'Southampton FC' && team !== 'Southampton');
      }
      // Fallback: try to get from S.table
      if (S.table && typeof S.table === 'object') {
        return Object.keys(S.table).filter(team => 
          team !== 'Southampton FC' && team !== 'Southampton'
        );
      }
      // Ultimate fallback: return some default teams
      return ['Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham'];
    }
    
    const teams = getSeason5Teams();
    const selectedTeams = new Set();
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99996;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      color: #00ff00;
    `;
    
    const screen = document.createElement('div');
    screen.style.cssText = `
      width: 90%;
      max-width: 900px;
      height: 85%;
      background: #000;
      border: 3px solid #00ff00;
      padding: 30px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 20px #00ff00;
      overflow-y: auto;
    `;
    
    const header = document.createElement('div');
    header.textContent = 'WHERE WOULD YOU LIKE TO LAUNCH A NUCLEAR STRIKE?';
    header.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 30px;
      text-align: center;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 15px;
    `;
    
    const teamsContainer = document.createElement('div');
    teamsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      flex: 1;
      overflow-y: auto;
    `;
    
    teams.forEach(team => {
      const teamButton = document.createElement('button');
      teamButton.textContent = `[ ] ${team}`;
      teamButton.style.cssText = `
        padding: 12px 20px;
        font-size: 16px;
        background: #000;
        color: #00ff00;
        border: 1px solid #00ff00;
        border-radius: 0;
        cursor: pointer;
        font-family: 'Courier New', monospace;
        text-align: left;
        transition: all 0.2s ease;
      `;
      
      teamButton.addEventListener('mouseenter', () => {
        teamButton.style.background = '#003300';
      });
      
      teamButton.addEventListener('mouseleave', () => {
        if (!selectedTeams.has(team)) {
          teamButton.style.background = '#000';
        }
      });
      
      teamButton.addEventListener('click', () => {
        if (selectedTeams.has(team)) {
          selectedTeams.delete(team);
          teamButton.textContent = `[ ] ${team}`;
          teamButton.style.background = '#000';
        } else {
          selectedTeams.add(team);
          teamButton.textContent = `[X] ${team}`;
          teamButton.style.background = '#003300';
        }
      });
      
      teamsContainer.appendChild(teamButton);
    });
    
    const selectAllButton = document.createElement('button');
    selectAllButton.textContent = 'SELECT ALL';
    selectAllButton.style.cssText = `
      padding: 15px 30px;
      font-size: 18px;
      font-weight: bold;
      background: #000;
      color: #ff0000;
      border: 2px solid #ff0000;
      border-radius: 0;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      margin: 10px 0;
      transition: all 0.2s ease;
    `;
    
    selectAllButton.addEventListener('mouseenter', () => {
      selectAllButton.style.background = '#330000';
    });
    
    selectAllButton.addEventListener('mouseleave', () => {
      selectAllButton.style.background = '#000';
    });
    
    selectAllButton.addEventListener('click', () => {
      teams.forEach(team => {
        selectedTeams.add(team);
        const button = Array.from(teamsContainer.children).find(btn => 
          btn.textContent.includes(team)
        );
        if (button) {
          button.textContent = `[X] ${team}`;
          button.style.background = '#003300';
        }
      });
    });
    
    const launchButton = document.createElement('button');
    launchButton.textContent = 'LAUNCH STRIKE';
    launchButton.style.cssText = `
      padding: 20px 40px;
      font-size: 24px;
      font-weight: bold;
      background: #000;
      color: #ff0000;
      border: 3px solid #ff0000;
      border-radius: 0;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      margin-top: 20px;
      transition: all 0.2s ease;
    `;
    
    launchButton.addEventListener('mouseenter', () => {
      launchButton.style.background = '#ff0000';
      launchButton.style.color = '#000';
    });
    
    launchButton.addEventListener('mouseleave', () => {
      launchButton.style.background = '#000';
      launchButton.style.color = '#ff0000';
    });
    
    launchButton.addEventListener('click', () => {
      const targets = Array.from(selectedTeams);
      if (targets.length === 0) {
        (window.KUI ? KUI.alert('Please select at least one target.') : alert('Please select at least one target.'));
        return;
      }
      overlay.remove();
      showNuclearStrikeAnimation(targets).then(() => resolve());
    });
    
    screen.appendChild(header);
    screen.appendChild(teamsContainer);
    screen.appendChild(selectAllButton);
    screen.appendChild(launchButton);
    overlay.appendChild(screen);
    document.body.appendChild(overlay);
  });
}

// Show nuclear strike animation with death count
async function showNuclearStrikeAnimation(targets) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99995;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      color: #ff0000;
      overflow: hidden;
    `;
    
    let deathCount = 0;
    const baseDeathsPerTarget = 500000; // Base deaths per target
    const totalTargets = targets.length;
    
    const deathCounter = document.createElement('div');
    deathCounter.textContent = `DEATH COUNT: ${deathCount.toLocaleString()}`;
    deathCounter.style.cssText = `
      font-size: 48px;
      font-weight: bold;
      color: #ff0000;
      text-shadow: 0 0 20px #ff0000;
      margin-bottom: 30px;
      z-index: 10;
    `;
    
    const statusText = document.createElement('div');
    statusText.textContent = 'INITIATING NUCLEAR STRIKE...';
    statusText.style.cssText = `
      font-size: 24px;
      color: #ff0000;
      text-shadow: 0 0 10px #ff0000;
      margin-bottom: 20px;
      z-index: 10;
    `;
    
    const nukeContainer = document.createElement('div');
    nukeContainer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 100px;
    `;
    
    // Create nuke falling animations
    targets.forEach((target, index) => {
      setTimeout(() => {
        const nuke = document.createElement('div');
        nuke.textContent = '💣';
        nuke.style.cssText = `
          position: absolute;
          font-size: 60px;
          top: -100px;
          left: ${20 + (index % 5) * 15}%;
          animation: fallDown 3s linear forwards;
          z-index: 5;
        `;
        
        // Add explosion
        setTimeout(() => {
          nuke.textContent = '💥';
          nuke.style.fontSize = '120px';
          nuke.style.animation = 'explode 1s ease-out forwards';
          
          // Update death count
          const deaths = baseDeathsPerTarget + Math.floor(Math.random() * 200000);
          deathCount += deaths;
          deathCounter.textContent = `DEATH COUNT: ${deathCount.toLocaleString()}`;
          
          statusText.textContent = `STRIKE ON ${target.toUpperCase()} COMPLETE`;
          
          setTimeout(() => {
            nuke.remove();
          }, 1000);
        }, 3000);
        
        nukeContainer.appendChild(nuke);
      }, index * 500);
    });
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fallDown {
        to {
          top: 50%;
          transform: translateY(-50%);
        }
      }
      @keyframes explode {
        0% {
          transform: scale(1) translateY(-50%);
          opacity: 1;
        }
        50% {
          transform: scale(2) translateY(-50%);
          opacity: 0.8;
        }
        100% {
          transform: scale(3) translateY(-50%);
          opacity: 0;
        }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    overlay.appendChild(deathCounter);
    overlay.appendChild(statusText);
    overlay.appendChild(nukeContainer);
    document.body.appendChild(overlay);
    
    // Show congratulatory messages after all strikes
    setTimeout(() => {
      const messages = [
        'STRIKE COMPLETE',
        '',
        'You have dealt with the Saudi issue directly',
        'and in a truly British way.',
        '',
        'Crowds are congregating on the streets',
        'chanting your name.',
        '',
        'The nation thanks you for your service.',
        '',
        'God save the King.'
      ];
      
      const messageContainer = document.createElement('div');
      messageContainer.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        border: 3px solid #ff0000;
        padding: 40px;
        text-align: center;
        z-index: 20;
        max-width: 600px;
      `;
      
      messages.forEach((msg, i) => {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = msg;
        msgDiv.style.cssText = `
          font-size: ${msg ? '20px' : '10px'};
          color: #ff0000;
          margin: 10px 0;
          font-weight: ${msg && i < 2 ? 'bold' : 'normal'};
        `;
        messageContainer.appendChild(msgDiv);
      });
      
      const continueButton = document.createElement('button');
      continueButton.textContent = 'CONTINUE';
      continueButton.disabled = true; // Disable initially
      continueButton.style.cssText = `
        margin-top: 30px;
        padding: 15px 40px;
        font-size: 18px;
        font-weight: bold;
        background: #000;
        color: #666;
        border: 2px solid #666;
        border-radius: 0;
        cursor: not-allowed;
        font-family: 'Courier New', monospace;
        transition: all 0.2s ease;
        opacity: 0.5;
      `;
      
      const enableButton = () => {
        continueButton.disabled = false;
        continueButton.style.background = '#000';
        continueButton.style.color = '#ff0000';
        continueButton.style.border = '2px solid #ff0000';
        continueButton.style.cursor = 'pointer';
        continueButton.style.opacity = '1';
      };
      
      continueButton.addEventListener('mouseenter', () => {
        if (!continueButton.disabled) {
          continueButton.style.background = '#ff0000';
          continueButton.style.color = '#000';
        }
      });
      
      continueButton.addEventListener('mouseleave', () => {
        if (!continueButton.disabled) {
          continueButton.style.background = '#000';
          continueButton.style.color = '#ff0000';
        }
      });
      
      continueButton.addEventListener('click', async () => {
        if (continueButton.disabled) return;
        overlay.remove();
        style.remove();
        
        // Proceed with beer spill sequence regardless of number of targets selected
        // Beer spill logline is now shown in the congratulatory UI above
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show automated Trident UI with beer trickle
        await showAutomatedTridentUIWithBeer().then(() => {
          resolve();
        });
      });
      
      messageContainer.appendChild(continueButton);
      overlay.appendChild(messageContainer);
      
      // Add beer spill logline to this UI (always show regardless of number of targets)
      setTimeout(() => {
        const beerSpillDiv = document.createElement('div');
        beerSpillDiv.textContent = '🍺 You celebrate a little too aggressively and spill beer over the keyboard of the Trident computer.';
        beerSpillDiv.style.cssText = `
          font-size: 18px;
          color: #ffaa00;
          margin: 20px 0 10px 0;
          font-weight: normal;
          opacity: 0;
          animation: fadeIn 0.5s ease-in forwards;
        `;
        messageContainer.insertBefore(beerSpillDiv, continueButton);
        // Enable button after beer spill text appears (wait for fade-in animation to complete)
        setTimeout(() => {
          enableButton();
        }, 500); // Wait for fadeIn animation (0.5s) to complete
      }, 2000);
    }, (targets.length * 500) + 4000);
  });
}

// Show automated Trident UI with beer trickle effect
async function showAutomatedTridentUIWithBeer() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99994;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
    `;
    
    const screen = document.createElement('div');
    screen.style.cssText = `
      width: 90%;
      max-width: 800px;
      height: 80%;
      background: #000;
      border: 3px solid #00ff00;
      padding: 20px;
      color: #00ff00;
      display: flex;
      flex-direction: column;
      box-shadow: 0 0 20px #00ff00;
      position: relative;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    
    // Add beer trickle effect
    const beerTrickle = document.createElement('div');
    beerTrickle.style.cssText = `
      position: absolute;
      top: 0;
      left: 15%;
      width: 3px;
      height: 0;
      background: linear-gradient(to bottom, #FFA500, #FF8C00);
      animation: trickleDown 3s ease-in forwards;
      z-index: 1;
      box-shadow: 0 0 10px #FFA500;
    `;
    
    // Add CSS for beer trickle animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes trickleDown {
        0% {
          height: 0;
          opacity: 0.8;
        }
        50% {
          opacity: 1;
        }
        100% {
          height: 60%;
          opacity: 0.6;
        }
      }
    `;
    document.head.appendChild(style);
    
    const header = document.createElement('div');
    header.textContent = 'TRIDENT NUCLEAR COMMAND SYSTEM v2.1';
    header.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
      text-align: center;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 10px;
      position: relative;
      z-index: 2;
    `;
    
    const prompt = document.createElement('div');
    prompt.textContent = 'C:\\TRIDENT> ';
    prompt.style.cssText = `
      font-size: 16px;
      margin-bottom: 30px;
      margin-top: 20px;
      position: relative;
      z-index: 2;
    `;
    
    const question = document.createElement('div');
    question.textContent = 'Would you like to launch a nuclear strike on any countries?';
    question.style.cssText = `
      font-size: 16px;
      margin-bottom: 20px;
      color: #00ff00;
      position: relative;
      z-index: 2;
    `;
    
    const countriesList = document.createElement('div');
    countriesList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      position: relative;
      z-index: 2;
    `;
    
    const countries = ['USA', 'Russia', 'Israel', 'North Korea', 'China', 'India', 'Pakistan'];
    const countryElements = [];
    
    countries.forEach((country, index) => {
      const countryDiv = document.createElement('div');
      countryDiv.textContent = `[ ] ${country}`;
      countryDiv.style.cssText = `
        padding: 8px 15px;
        font-size: 14px;
        color: #00ff00;
        border: 1px solid #00ff00;
        opacity: 0;
        animation: fadeIn 0.3s ease-in forwards;
        animation-delay: ${index * 0.2}s;
      `;
      countryElements.push(countryDiv);
      countriesList.appendChild(countryDiv);
    });
    
    // Add fade-in animation
    const fadeStyle = document.createElement('style');
    fadeStyle.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(fadeStyle);
    
    screen.appendChild(beerTrickle);
    screen.appendChild(header);
    screen.appendChild(prompt);
    screen.appendChild(question);
    screen.appendChild(countriesList);
    overlay.appendChild(screen);
    document.body.appendChild(overlay);
    
    // Automatically select all countries after a delay
    setTimeout(() => {
      countryElements.forEach((el, index) => {
        setTimeout(() => {
          el.textContent = el.textContent.replace('[ ]', '[X]');
          el.style.background = '#003300';
          // Auto-scroll to keep selected country in view
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, index * 150);
      });
      
      // Automatically launch strike after selecting all
      setTimeout(() => {
        const launchText = document.createElement('div');
        launchText.textContent = 'SELECT ALL';
        launchText.style.cssText = `
          font-size: 16px;
          color: #ff0000;
          margin: 10px 0;
          position: relative;
          z-index: 2;
        `;
        screen.appendChild(launchText);
        // Scroll to show the launch text
        launchText.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
          const strikeText = document.createElement('div');
          strikeText.textContent = 'LAUNCHING STRIKE...';
          strikeText.style.cssText = `
            font-size: 18px;
            color: #ff0000;
            font-weight: bold;
            margin: 10px 0;
            position: relative;
            z-index: 2;
            text-shadow: 0 0 10px #ff0000;
          `;
          screen.appendChild(strikeText);
          // Scroll to show the strike text
          strikeText.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove overlay and play video
          setTimeout(() => {
            overlay.remove();
            style.remove();
            fadeStyle.remove();
            playNuclearStrikeVideo().then(() => {
              showPlaceholderModal().then(() => {
                resolve();
              });
            });
          }, 1500);
        }, 1000);
      }, countries.length * 150 + 500);
    }, 2000);
  });
}

// Play the nuclear strike video
async function playNuclearStrikeVideo() {
  return new Promise((resolve) => {
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99993;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const video = document.createElement('video');
    // Use direct download format for better compatibility
    video.src = 'https://www.dropbox.com/scl/fi/sf4ih30kgaxin2aypoabz/Video-1-12-26-2-16-09-pm.mp4?rlkey=oax2vakhguqjk942y6jtg7r0v&st=m1d1yegk&dl=1';
    video.controls = false;
    video.autoplay = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading video...';
    loadingText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 18px;
      z-index: 100001;
    `;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(loadingText);
    document.body.appendChild(videoContainer);
    
    video.addEventListener('loadeddata', () => {
      loadingText.style.display = 'none';
      video.play().catch(err => {
        console.error('Video autoplay failed:', err);
      });
    });
    
    video.addEventListener('canplay', () => {
      loadingText.style.display = 'none';
    });
    
    let retryCount = 0;
    video.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      console.error('Video error details:', {
        code: video.error?.code,
        message: video.error?.message,
        networkState: video.networkState,
        readyState: video.readyState,
        src: video.src
      });
      // Try alternative URL format if first attempt failed
      if (retryCount === 0 && (video.error?.code === video.error?.MEDIA_ERR_SRC_NOT_SUPPORTED || video.networkState === video.NETWORK_NO_SOURCE)) {
        retryCount++;
        // Try direct dropboxusercontent format
        const fileId = 'sf4ih30kgaxin2aypoabz';
        const altUrl = `https://dl.dropboxusercontent.com/scl/fi/${fileId}/Video-1-12-26-2-16-09-pm.mp4?rlkey=oax2vakhguqjk942y6jtg7r0v&st=m1d1yegk&dl=1`;
        video.src = altUrl;
        video.load();
        return;
      }
      loadingText.textContent = 'Error loading video. Click to close.';
      loadingText.style.cursor = 'pointer';
      loadingText.onclick = () => {
        videoContainer.remove();
        resolve();
      };
    });
    
    video.addEventListener('ended', () => {
      videoContainer.remove();
      resolve();
    }, { once: true });
  });
}

// Show PLACEHOLDER modal
async function showPlaceholderModal() {
  return new Promise((resolve) => {
    // Get Kreplin Gems count
    const kreplinGems = S.kreplin_gems || 0;
    const hasThreeOrMoreGems = kreplinGems >= 3;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99992;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #00ff00;
      padding: 40px;
      text-align: left;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: normal;
      box-shadow: 0 0 30px #00ff00;
      max-width: 800px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'placeholder-content';
    contentContainer.style.cssText = `
      min-height: 200px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
      overflow-x: hidden;
    `;
    
    modal.appendChild(contentContainer);
    
    const closeButton = document.createElement('button');
    // Set button text based on gem count
    closeButton.textContent = hasThreeOrMoreGems ? 'CONTINUE' : 'NEXT';
    closeButton.style.cssText = `
      margin-top: 30px;
      padding: 15px 40px;
      font-size: 18px;
      font-weight: bold;
      background: #000;
      color: #00ff00;
      border: 2px solid #00ff00;
      border-radius: 0;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      transition: all 0.2s ease;
      display: none;
    `;
    
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = '#00ff00';
      closeButton.style.color = '#000';
    });
    
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = '#000';
      closeButton.style.color = '#00ff00';
    });
    
    closeButton.addEventListener('click', async () => {
      overlay.remove();
      style.remove(); // Remove the style element when closing
      
      // If you have 3 or more gems, show the laxative UI instead of resolving
      if (hasThreeOrMoreGems) {
        await showLaxativeUI().then(() => {
          resolve();
        });
      } else {
        // Play the nuclear strike video, then show the new epilogue
        await playNuclearStrikeVideoEpilogue().then(() => {
          resolve();
        });
      }
    });
    
    modal.appendChild(closeButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Define all text lines
    const textLines = [
      "Your Principal Advisor edges into the room, looking nervous",
      "He says: \"Mr Prime Minister. It's almost certainly the system playing up, but a warning has just come onscreen. Apparently ten thousand thermonuclear ICBMs are headed for Britain. Less than twenty minutes to impact.\"",
      "You wave him away.",
      "\"Computers these days, eh mush? Get back to your beer. I'll deal with it.\"",
      "________________________________________",
      "You call your daughter.",
      "It's been a while.",
      "She answers from Strip University. You can hear the sound of stripping in the background.",
      "She asks if you're okay after what happened at the Ultima Cup. The Combat Robot. Delmor Krunchem.",
      "You tell her you're fine.",
      "You ask how Strip University is going.",
      "She says there's \"not much to report back on,\" as the sound of multiple men moaning and grunting drifts through the line.",
      "________________________________________",
      "You tell her you love her.",
      "You apologise for what's about to happen.",
      "She asks what you mean.",
      "You tell her you've accidentally nuked a bunch of countries because you spilt a beer on your laptop.",
      "She says: \"You did what?\"",
      "You say it's ironic, really. Beer was meant to bring people together. Instead it's destroyed the world.",
      "She asks about the Kreplin Gems. Weren't they supposed to bring eternal glory to Southampton? Couldn't you use them?",
      "You tell her Delmor Krunchem destroyed them. It's no use.",
      "________________________________________"
    ];
    
    // Add conditional lines based on gem count
    if (!hasThreeOrMoreGems) {
      textLines.push(
        "There's a pause.",
        "She says: \"Okay. Well… goodbye, Dad.\"",
        "She adds that she's in the middle of something and should probably finish it off.",
        "You say \"I love you.\"",
        "She doesn't respond.",
        "All you hear is the sound of intensifying thuds.",
        "________________________________________",
        "You head to St Mary's in the hope that you might have an extra Kreplin Gem in one of your drawers. But there's nothing. The nuclear missiles are 5 seconds away..."
      );
    } else {
      textLines.push(
        "She tells you Delmor was lying.",
        "That wasn't a real Kreplin Gem - just some random trinket he used to make you do his bidding.",
        "She says if you can find the final Kreplin Gem, you might still avert the crisis.",
        "You tell her to stay exactly where she is.",
        "\"Daddy's coming to pick you up. We're going to St Mary's.\""
      );
      // Add final lines only for the 3+ gems path
      textLines.push(
        "________________________________________",
        "You hang up.",
        "You think long and hard about where the final Kreplin Gem could be.",
        "Your stomach gurgles.",
        "You notice an oddly ethereal glow coming from within.",
        "Then it hits you.",
        "The day you became Chairman.",
        "The doctor.",
        "The diagnosis of inoperable cancer.",
        "No tests. No scans. Just vibes.",
        "It was never a tumour.",
        "It was a KREPLIN GEM.",
        "Inside you.",
        "All along.",
        "That's what caused the blockage.",
        "You truly ARE the chosen one.",
        "Perhaps the tragedy can still be averted with the power of the Kreplin Gems.",
        "There's only one thing for it.",
        "You down the bottle of MEGALAX from the cupboard.",
        "There's no time to spare.",
        "Britain needs you."
      );
    }
    
    // Add CSS animation keyframes for fade-in effect
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle special formatting
          if (text === "________________________________________") {
            lineDiv.style.cssText = `
              border-top: 1px solid #00ff00;
              margin: 20px 0;
              padding-top: 20px;
              opacity: 0;
              margin-bottom: 16px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else if (text.includes('"')) {
            // Format dialogue
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 16px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = text.replace(/"/g, '<span style="color: #ffff00;">"</span>');
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 16px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          contentContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 50; // Fast speed: 50ms between lines
      const separatorDelay = 50; // Same delay for separators
      const pauseDelay = 100; // Brief pause for dramatic moments
      
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        let delay = fadeInDelay;
        
        // Adjust delay for special cases
        if (line === "________________________________________") {
          delay = separatorDelay;
        }
        
        // Check if this is the line after "You hang up." - add a brief pause
        if (i > 0 && textLines[i - 1] === "You hang up.") {
          // Add a brief pause before the next line
          totalDelay += pauseDelay;
        }
        
        await addLine(line, totalDelay);
        totalDelay += delay;
      }
      
      // Show continue button after all text is displayed
      setTimeout(() => {
        closeButton.style.display = 'block';
        closeButton.style.opacity = '0';
        closeButton.style.transition = 'opacity 0.5s ease-in';
        setTimeout(() => {
          closeButton.style.opacity = '1';
        }, 10);
      }, totalDelay + 500);
    }
    
    // Start displaying lines
    displayAllLines();
  });
}

// Show laxative UI after phone call with daughter (when you have 3 kreplin gems)
async function showLaxativeUI() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99991;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #ffaa00;
      padding: 40px;
      text-align: center;
      color: #ffaa00;
      font-family: 'Courier New', monospace;
      font-size: 24px;
      font-weight: bold;
      box-shadow: 0 0 30px #ffaa00;
      max-width: 800px;
      width: 100%;
      line-height: 1.8;
    `;
    
    const message = document.createElement('div');
    message.textContent = "You've taken a big dosage of laxatives...";
    message.style.cssText = `
      margin-bottom: 30px;
      font-size: 28px;
      color: #ffaa00;
      text-shadow: 0 0 10px #ffaa00;
    `;
    
    const gemMessage = document.createElement('div');
    gemMessage.textContent = "It's time to shit the Kreplin Gem out!";
    gemMessage.style.cssText = `
      margin-bottom: 40px;
      font-size: 32px;
      color: #ff0000;
      text-shadow: 0 0 15px #ff0000;
      font-weight: bold;
    `;
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'NEXT';
    nextButton.style.cssText = `
      padding: 20px 50px;
      font-size: 24px;
      font-weight: bold;
      background: #ffaa00;
      color: #000;
      border: 3px solid #ffaa00;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 2px;
    `;
    
    nextButton.addEventListener('mouseenter', () => {
      nextButton.style.background = '#ff8800';
      nextButton.style.borderColor = '#ff8800';
      nextButton.style.transform = 'scale(1.05)';
      nextButton.style.boxShadow = '0 0 20px #ff8800';
    });
    
    nextButton.addEventListener('mouseleave', () => {
      nextButton.style.background = '#ffaa00';
      nextButton.style.borderColor = '#ffaa00';
      nextButton.style.transform = 'scale(1)';
      nextButton.style.boxShadow = 'none';
    });
    
    nextButton.addEventListener('click', async () => {
      overlay.remove();
      await startToiletStrainingMinigame().then(() => {
        resolve();
      });
    });
    
    modal.appendChild(message);
    modal.appendChild(gemMessage);
    modal.appendChild(nextButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// Toilet straining minigame
async function startToiletStrainingMinigame() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
      z-index: 99990;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      color: white;
    `;
    
    // Game state
    const gameState = {
      strainLevel: 0, // 0-100
      targetZone: { min: 40, max: 60 }, // Sweet spot
      timeInZone: 0, // Time spent in sweet spot (ms)
      requiredTimeInZone: 13000, // 13 seconds in sweet spot to win
      totalTime: 0,
      maxTime: 30000, // 30 seconds before world is destroyed
      isStraining: false,
      gameOver: false,
      won: false,
      strainInterval: null,
      timeInterval: null,
      soundEffectInterval: null
    };
    
    // Audio setup
    let minigameMusic = null;
    let wasBackgroundMusicPlaying = false;
    
    // Pause background music if playing
    if (typeof window._stopGeneralMusic === 'function') {
      // Check if music was playing before stopping
      if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
        wasBackgroundMusicPlaying = true;
      }
      window._stopGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
      wasBackgroundMusicPlaying = true;
      generalMusicAudio.pause();
    }
    
    // Create and play minigame music
    minigameMusic = new Audio('https://www.dropbox.com/scl/fi/nzz7c60eullrz8m7kvsaa/shitkrepl.mp3?rlkey=e419hpmxv6beknnw332pbt3h9&st=j3j16ctp&dl=1');
    minigameMusic.loop = true;
    minigameMusic.volume = 0.7;
    minigameMusic.play().catch(err => {
    });
    
    // Sound effect URLs - Replace these with actual grunt and fart sound effect URLs
    // You can find free sound effects at: freesound.org, zapsplat.com, or create your own
    // For now, using placeholder URLs that won't play - replace with real sound effect URLs
    const gruntSounds = [
      'https://www.dropbox.com/s/placeholder1.mp3?dl=1', // Replace with male grunt sound URL
      'https://www.dropbox.com/s/placeholder2.mp3?dl=1'  // Replace with male grunt sound URL
    ];
    
    const fartSounds = [
      'https://www.dropbox.com/s/placeholder3.mp3?dl=1', // Replace with fart sound URL
      'https://www.dropbox.com/s/placeholder4.mp3?dl=1'  // Replace with fart sound URL
    ];
    
    // Function to play random sound effect
    function playRandomSoundEffect() {
      if (gameState.gameOver) return;
      
      const rand = Math.random();
      let soundUrl;
      
      if (rand < 0.5) {
        // Play grunt
        soundUrl = gruntSounds[Math.floor(Math.random() * gruntSounds.length)];
      } else {
        // Play fart
        soundUrl = fartSounds[Math.floor(Math.random() * fartSounds.length)];
      }
      
      const sound = new Audio(soundUrl);
      sound.volume = 0.4;
      sound.play().catch(err => {
        // Silently fail if sound can't be played
      });
    }
    
    // Play random sound effects every 2-5 seconds
    function scheduleNextSoundEffect() {
      if (gameState.gameOver) return;
      
      const delay = 2000 + Math.random() * 3000; // 2-5 seconds
      gameState.soundEffectInterval = setTimeout(() => {
        playRandomSoundEffect();
        scheduleNextSoundEffect();
      }, delay);
    }
    
    // Start sound effects
    scheduleNextSoundEffect();
    
    // Create toilet scene container
    const sceneContainer = document.createElement('div');
    sceneContainer.style.cssText = `
      width: 600px;
      height: 500px;
      background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
      border: 4px solid #555;
      border-radius: 20px;
      position: relative;
      margin-bottom: 30px;
      overflow: hidden;
      box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
    `;
    
    // Draw toilet (simple representation)
    const toiletCanvas = document.createElement('canvas');
    toiletCanvas.width = 600;
    toiletCanvas.height = 500;
    toiletCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    const ctx = toiletCanvas.getContext('2d');
    sceneContainer.appendChild(toiletCanvas);
    
    // Draw toilet scene
    function drawToiletScene() {
      ctx.clearRect(0, 0, 600, 500);
      
      // Background (bathroom tiles)
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(0, 0, 600, 500);
      
      // Draw grid pattern for tiles
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 2;
      for (let x = 0; x < 600; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 500);
        ctx.stroke();
      }
      for (let y = 0; y < 500; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(600, y);
        ctx.stroke();
      }
      
      // Toilet bowl
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(300, 350, 120, 80, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Toilet seat
      ctx.fillStyle = '#8B4513';
      ctx.beginPath();
      ctx.ellipse(300, 320, 130, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Character sitting on toilet (simple representation)
      const faceY = 280;
      const faceSize = 50;
      
      // Head (straining face based on strain level)
      const strainIntensity = gameState.strainLevel / 100;
      const faceRedness = Math.min(255, 150 + strainIntensity * 105);
      const faceColor = `rgb(${faceRedness}, ${200 - strainIntensity * 100}, ${200 - strainIntensity * 100})`;
      
      ctx.fillStyle = faceColor;
      ctx.beginPath();
      ctx.arc(300, faceY, faceSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Glasses
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(285, faceY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(315, faceY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(297, faceY);
      ctx.lineTo(303, faceY);
      ctx.stroke();
      
      // Eyes (squinted based on strain)
      ctx.fillStyle = '#000';
      const eyeSquint = Math.min(1, strainIntensity * 1.5);
      ctx.fillRect(280 - eyeSquint * 3, faceY - 2, 4 + eyeSquint * 2, 2);
      ctx.fillRect(310 - eyeSquint * 3, faceY - 2, 4 + eyeSquint * 2, 2);
      
      // Mouth (straining expression)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const mouthOpen = Math.min(0.8, strainIntensity);
      ctx.arc(300, faceY + 15, 8 + mouthOpen * 5, 0, Math.PI);
      ctx.stroke();
      
      // Forehead wrinkles (based on strain)
      if (strainIntensity > 0.3) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(280 + i * 10, faceY - 25);
          ctx.lineTo(285 + i * 10, faceY - 30);
          ctx.stroke();
        }
      }
      
      // Body (torso visible above toilet)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(250, faceY + faceSize, 100, 60);
      
      // Kreplin Gem (glowing inside toilet bowl when in sweet spot)
      if (gameState.strainLevel >= gameState.targetZone.min && 
          gameState.strainLevel <= gameState.targetZone.max) {
        const gemGlow = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 215, 0, ${gemGlow})`;
        ctx.beginPath();
        ctx.arc(300, 380, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    
    // Strain bar
    const strainBarContainer = document.createElement('div');
    strainBarContainer.style.cssText = `
      width: 500px;
      margin-bottom: 20px;
    `;
    
    const strainLabel = document.createElement('div');
    strainLabel.textContent = 'STRAIN LEVEL';
    strainLabel.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: center;
      color: #fff;
    `;
    
    const strainBarBg = document.createElement('div');
    strainBarBg.style.cssText = `
      width: 100%;
      height: 40px;
      background: #333;
      border: 3px solid #555;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    `;
    
    const strainBar = document.createElement('div');
    strainBar.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #00ff00 0%, #ffff00 50%, #ff0000 100%);
      transition: width 0.1s linear;
      position: relative;
    `;
    
    // Sweet spot indicator
    const sweetSpotIndicator = document.createElement('div');
    sweetSpotIndicator.style.cssText = `
      position: absolute;
      left: ${gameState.targetZone.min}%;
      width: ${gameState.targetZone.max - gameState.targetZone.min}%;
      height: 100%;
      background: rgba(255, 255, 255, 0.3);
      border: 2px dashed #fff;
      box-sizing: border-box;
      pointer-events: none;
    `;
    
    const sweetSpotLabel = document.createElement('div');
    sweetSpotLabel.textContent = 'SWEET SPOT';
    sweetSpotLabel.style.cssText = `
      position: absolute;
      top: -25px;
      left: ${gameState.targetZone.min}%;
      width: ${gameState.targetZone.max - gameState.targetZone.min}%;
      font-size: 12px;
      color: #ffff00;
      text-align: center;
      font-weight: bold;
    `;
    
    strainBarBg.appendChild(sweetSpotIndicator);
    strainBarBg.appendChild(sweetSpotLabel);
    strainBarBg.appendChild(strainBar);
    strainBarContainer.appendChild(strainLabel);
    strainBarContainer.appendChild(strainBarBg);
    
    // Time bar
    const timeBarContainer = document.createElement('div');
    timeBarContainer.style.cssText = `
      width: 500px;
      margin-bottom: 20px;
    `;
    
    const timeLabel = document.createElement('div');
    timeLabel.textContent = 'TIME REMAINING';
    timeLabel.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      text-align: center;
      color: #fff;
    `;
    
    const timeBarBg = document.createElement('div');
    timeBarBg.style.cssText = `
      width: 100%;
      height: 30px;
      background: #333;
      border: 3px solid #555;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    `;
    
    const timeBar = document.createElement('div');
    timeBar.style.cssText = `
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #ff0000 0%, #ff8800 50%, #00ff00 100%);
      transition: width 0.1s linear;
    `;
    
    timeBarBg.appendChild(timeBar);
    timeBarContainer.appendChild(timeLabel);
    timeBarContainer.appendChild(timeBarBg);
    
    // Progress indicator
    const progressLabel = document.createElement('div');
    progressLabel.textContent = 'Time in sweet spot: 0.0s / 13.0s';
    progressLabel.style.cssText = `
      font-size: 16px;
      margin-bottom: 20px;
      color: #ffff00;
      text-align: center;
    `;
    
    // Strain button
    const strainButton = document.createElement('button');
    strainButton.textContent = 'HOLD TO STRAIN';
    strainButton.style.cssText = `
      padding: 25px 60px;
      font-size: 24px;
      font-weight: bold;
      background: #ff4444;
      color: white;
      border: 4px solid #ff6666;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.1s;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 20px;
      user-select: none;
    `;
    
    // Update strain level
    function updateStrain() {
      if (gameState.gameOver) return;
      
      if (gameState.isStraining) {
        gameState.strainLevel = Math.min(100, gameState.strainLevel + 2);
      } else {
        gameState.strainLevel = Math.max(0, gameState.strainLevel - 1.5);
      }
      
      strainBar.style.width = gameState.strainLevel + '%';
      
      // Check if in sweet spot
      if (gameState.strainLevel >= gameState.targetZone.min && 
          gameState.strainLevel <= gameState.targetZone.max) {
        gameState.timeInZone += 50;
        progressLabel.textContent = `Time in sweet spot: ${(gameState.timeInZone / 1000).toFixed(1)}s / ${(gameState.requiredTimeInZone / 1000).toFixed(1)}s`;
        
        // Check win condition
        if (gameState.timeInZone >= gameState.requiredTimeInZone) {
          gameState.gameOver = true;
          gameState.won = true;
          endGame();
        }
      } else {
        progressLabel.textContent = `Time in sweet spot: ${(gameState.timeInZone / 1000).toFixed(1)}s / ${(gameState.requiredTimeInZone / 1000).toFixed(1)}s`;
      }
      
      // Check fail conditions
      if (gameState.strainLevel >= 95) {
        gameState.gameOver = true;
        gameState.won = false;
        endGame('heart attack');
      }
      
      drawToiletScene();
    }
    
    // Update time
    function updateTime() {
      if (gameState.gameOver) return;
      
      gameState.totalTime += 50;
      const timeRemaining = Math.max(0, gameState.maxTime - gameState.totalTime);
      const timePercent = (timeRemaining / gameState.maxTime) * 100;
      timeBar.style.width = timePercent + '%';
      
      if (timeRemaining <= 0) {
        gameState.gameOver = true;
        gameState.won = false;
        endGame('timeout');
      }
    }
    
    // End game
    function endGame(reason) {
      clearInterval(gameState.strainInterval);
      clearInterval(gameState.timeInterval);
      if (gameState.soundEffectInterval) {
        clearTimeout(gameState.soundEffectInterval);
      }
      
      // Stop minigame music
      if (minigameMusic) {
        minigameMusic.pause();
        minigameMusic.currentTime = 0;
        minigameMusic = null;
      }
      
      // Resume background music if it was playing
      if (wasBackgroundMusicPlaying) {
        if (typeof window._startGeneralMusic === 'function') {
          window._startGeneralMusic();
        } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
          generalMusicAudio.play().catch(err => {
          });
        }
      }
      
      setTimeout(() => {
        overlay.remove();
        
        if (gameState.won) {
          // Success - play video
          playGemShitVideo().then(() => {
            resolve();
          });
        } else {
          // Failure - show failure message and allow restart
          showFailureMessage(reason).then(() => {
            // Restart minigame
            startToiletStrainingMinigame().then(() => {
              resolve();
            });
          });
        }
      }, 1000);
    }
    
    // Button handlers
    strainButton.addEventListener('mousedown', () => {
      if (gameState.gameOver) return;
      gameState.isStraining = true;
      strainButton.style.background = '#ff0000';
      strainButton.style.transform = 'scale(0.95)';
    });
    
    strainButton.addEventListener('mouseup', () => {
      gameState.isStraining = false;
      strainButton.style.background = '#ff4444';
      strainButton.style.transform = 'scale(1)';
    });
    
    strainButton.addEventListener('mouseleave', () => {
      gameState.isStraining = false;
      strainButton.style.background = '#ff4444';
      strainButton.style.transform = 'scale(1)';
    });
    
    // Touch support
    strainButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameState.gameOver) return;
      gameState.isStraining = true;
      strainButton.style.background = '#ff0000';
      strainButton.style.transform = 'scale(0.95)';
    });
    
    strainButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      gameState.isStraining = false;
      strainButton.style.background = '#ff4444';
      strainButton.style.transform = 'scale(1)';
    });
    
    // Start game loops
    gameState.strainInterval = setInterval(updateStrain, 50);
    gameState.timeInterval = setInterval(updateTime, 50);
    
    // Initial draw
    drawToiletScene();
    
    // Assemble UI
    overlay.appendChild(sceneContainer);
    overlay.appendChild(strainBarContainer);
    overlay.appendChild(timeBarContainer);
    overlay.appendChild(progressLabel);
    overlay.appendChild(strainButton);
    document.body.appendChild(overlay);
  });
}

// Show failure message
async function showFailureMessage(reason) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99989;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 4px solid #ff0000;
      padding: 40px;
      text-align: center;
      color: #ff0000;
      font-size: 28px;
      font-weight: bold;
      box-shadow: 0 0 30px #ff0000;
      max-width: 600px;
      width: 90%;
    `;
    
    const message = document.createElement('div');
    if (reason === 'heart attack') {
      message.textContent = 'YOU DIED OF A HEART ATTACK!';
      message.style.cssText = `
        margin-bottom: 20px;
        color: #ff0000;
        text-shadow: 0 0 15px #ff0000;
      `;
    } else {
      message.textContent = 'YOU RAN OUT OF TIME AND THE WORLD IS DESTROYED!';
      message.style.cssText = `
        margin-bottom: 20px;
        color: #ff0000;
        text-shadow: 0 0 15px #ff0000;
      `;
    }
    
    const restartButton = document.createElement('button');
    restartButton.textContent = 'TRY AGAIN';
    restartButton.style.cssText = `
      padding: 15px 40px;
      font-size: 20px;
      font-weight: bold;
      background: #ff0000;
      color: white;
      border: 3px solid #ff0000;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.3s;
    `;
    
    restartButton.addEventListener('mouseenter', () => {
      restartButton.style.background = '#cc0000';
      restartButton.style.transform = 'scale(1.05)';
    });
    
    restartButton.addEventListener('mouseleave', () => {
      restartButton.style.background = '#ff0000';
      restartButton.style.transform = 'scale(1)';
    });
    
    restartButton.addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
    
    modal.appendChild(message);
    modal.appendChild(restartButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

// Play gem shit video on success
async function playGemShitVideo() {
  return new Promise((resolve) => {
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99988;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    const video = document.createElement('video');
    video.src = 'https://www.dropbox.com/scl/fi/7mb95d3deq675jblz40zu/My-Movie-140.mp4?rlkey=9thd9skjln6ybm0rx8h8fzgzg&st=v17nlmwj&dl=1';
    video.controls = false;
    video.autoplay = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = false;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Loading video...';
    loadingText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 18px;
      z-index: 100001;
    `;
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(loadingText);
    document.body.appendChild(videoContainer);
    
    video.addEventListener('loadeddata', () => {
      loadingText.style.display = 'none';
      video.play().catch(err => {
        console.error('Video autoplay failed:', err);
      });
    });
    
    video.addEventListener('canplay', () => {
      loadingText.style.display = 'none';
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video loading error:', e);
      loadingText.textContent = 'Error loading video. Click to close.';
      loadingText.style.cursor = 'pointer';
      loadingText.onclick = () => {
        videoContainer.remove();
        resolve();
      };
    });
    
    video.addEventListener('ended', () => {
      videoContainer.remove();
      
      // Update Kreplin gem tally to 4/4
      S.kreplin_gems = 4;
      hudSet("hudKreplinGem", "4/4");
      
      // Show special UI screen
      showAllGemsCollectedUI().then(() => {
        resolve();
      });
    }, { once: true });
    
    // Allow click to close
    videoContainer.addEventListener('click', () => {
      video.pause();
      videoContainer.remove();
      
      // Update Kreplin gem tally to 4/4 even if video is skipped
      S.kreplin_gems = 4;
      hudSet("hudKreplinGem", "4/4");
      
      // Play gem jingle for the 4th gem
      playGemJingle();
      
      // Show special UI screen
      showAllGemsCollectedUI().then(() => {
        resolve();
      });
    });
  });
}

// Show special UI when all Kreplin Gems are collected
async function showAllGemsCollectedUI() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #1a0033 0%, #000000 100%);
      z-index: 99987;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      color: white;
      padding: 40px;
      text-align: center;
    `;
    
    // Main announcement
    const announcement = document.createElement('div');
    announcement.innerHTML = `
      <div style="font-size: 48px; font-weight: bold; color: #FFD700; text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.5); margin-bottom: 30px; line-height: 1.3;">
        YOU HAVE ALL THE KREPLIN GEMS!!<br>
        IT'S TIME TO BRING ETERNAL GLORY TO SOUTHAMPTON!
      </div>
    `;
    
    // Description text
    const description = document.createElement('div');
    description.innerHTML = `
      <div style="font-size: 24px; color: #fff; margin-bottom: 40px; line-height: 1.6; max-width: 900px;">
        The console to place the Kreplin Gems in is at St Mary's, you need to pick up your daughter from Strip University and drive back to St Mary's stadium before the nukes land - quick!
      </div>
    `;
    
    // Get in the car button
    const carButton = document.createElement('button');
    carButton.textContent = 'GET IN THE CAR';
    carButton.style.cssText = `
      padding: 25px 60px;
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      color: #000;
      border: 4px solid #FFD700;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 3px;
      box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
      font-family: Arial, sans-serif;
    `;
    
    carButton.addEventListener('mouseenter', () => {
      carButton.style.background = 'linear-gradient(135deg, #FFA500 0%, #FF8C00 100%)';
      carButton.style.transform = 'scale(1.05)';
      carButton.style.boxShadow = '0 0 50px rgba(255, 215, 0, 0.9)';
    });
    
    carButton.addEventListener('mouseleave', () => {
      carButton.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
      carButton.style.transform = 'scale(1)';
      carButton.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
    });
    
    carButton.addEventListener('click', () => {
      overlay.remove();
      // Start the driving minigame
      startDrivingMinigame().then(() => {
        resolve();
      });
    });
    
    overlay.appendChild(announcement);
    overlay.appendChild(description);
    overlay.appendChild(carButton);
    document.body.appendChild(overlay);
  });
}

// Kreplin Protocol UI - shown after beating the driving minigame
async function showKreplinProtocolUI() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1a0033 0%, #000000 50%, #330033 100%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Arial', sans-serif;
      color: #fff;
    `;
    
    // Main message
    const message = document.createElement('div');
    message.textContent = "Yes! You got to St Mary's!! Quick, fulfill your destiny, o great chosen one!";
    message.style.cssText = `
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      color: #FFD700;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.6);
      margin-bottom: 60px;
      padding: 0 40px;
      line-height: 1.4;
      animation: pulse 2s ease-in-out infinite;
    `;
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
      }
      @keyframes buttonGlow {
        0%, 100% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), 0 0 100px rgba(255, 215, 0, 0.6), 0 0 150px rgba(255, 215, 0, 0.4); }
        50% { box-shadow: 0 0 80px rgba(255, 215, 0, 1), 0 0 150px rgba(255, 215, 0, 0.8), 0 0 200px rgba(255, 215, 0, 0.6); }
      }
      @keyframes countdownPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);
    
    // Countdown timer display
    const countdownDisplay = document.createElement('div');
    countdownDisplay.style.cssText = `
      font-size: 72px;
      font-weight: bold;
      color: #ff0000;
      text-shadow: 0 0 30px rgba(255, 0, 0, 1), 0 0 60px rgba(255, 0, 0, 0.8);
      margin-bottom: 40px;
      font-family: 'Courier New', monospace;
    `;
    
    // The momentous button
    const protocolButton = document.createElement('button');
    protocolButton.textContent = 'INITIATE THE KREPLIN PROTOCOL';
    protocolButton.style.cssText = `
      padding: 30px 80px;
      font-size: 42px;
      font-weight: bold;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      color: #000;
      border: 6px solid #FFD700;
      border-radius: 20px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 4px;
      box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), 0 0 100px rgba(255, 215, 0, 0.6), 0 0 150px rgba(255, 215, 0, 0.4);
      transition: all 0.3s ease;
      animation: buttonGlow 2s ease-in-out infinite;
      position: relative;
      overflow: hidden;
    `;
    
    // Add hover effects
    protocolButton.addEventListener('mouseenter', () => {
      protocolButton.style.transform = 'scale(1.1)';
      protocolButton.style.boxShadow = '0 0 100px rgba(255, 215, 0, 1), 0 0 200px rgba(255, 215, 0, 0.8), 0 0 300px rgba(255, 215, 0, 0.6)';
    });
    
    protocolButton.addEventListener('mouseleave', () => {
      protocolButton.style.transform = 'scale(1)';
    });
    
    // Countdown state
    let countdown = 10;
    let countdownInterval;
    let protocolInitiated = false;
    
    // Update countdown display
    function updateCountdown() {
      countdownDisplay.textContent = countdown;
      if (countdown <= 3) {
        countdownDisplay.style.animation = 'countdownPulse 0.5s ease-in-out infinite';
        countdownDisplay.style.color = '#ff0000';
      } else {
        countdownDisplay.style.color = '#ffaa00';
      }
    }
    
    updateCountdown();
    
    // Start countdown
    countdownInterval = setInterval(() => {
      countdown--;
      updateCountdown();
      
      if (countdown <= 0 && !protocolInitiated) {
        clearInterval(countdownInterval);
        // Timer reached 0 - show incineration message
        overlay.innerHTML = '';
        overlay.style.background = '#000000';
        
        const incinerationMessage = document.createElement('div');
        incinerationMessage.innerHTML = `
          <div style="font-size: 64px; font-weight: bold; color: #ff0000; text-align: center; margin-bottom: 40px; text-shadow: 0 0 40px rgba(255, 0, 0, 1);">
            YOU ARE INCINERATED IN NUCLEAR HELLFIRE
          </div>
          <div style="font-size: 32px; color: #ffaa00; text-align: center; margin-bottom: 60px;">
            The timer reached zero. Your destiny remains unfulfilled.
          </div>
        `;
        overlay.appendChild(incinerationMessage);
        
        // Trigger end game state
        if (typeof S !== 'undefined') {
          S.game_over = true;
          S.game_over_reason = 'Incinerated in nuclear hellfire - failed to initiate Kreplin Protocol in time';
        }
        
        // Wait a bit then resolve
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 5000);
      }
    }, 1000);
    
    // Button click handler
    protocolButton.addEventListener('click', () => {
      if (protocolInitiated) return;
      protocolInitiated = true;
      clearInterval(countdownInterval);
      
      // Remove overlay
      overlay.remove();
      
      // Create fullscreen video container
      const videoContainer = document.createElement('div');
      videoContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 9999999;
        display: flex;
        justify-content: center;
        align-items: center;
      `;
      
      // Create video element
      const video = document.createElement('video');
      video.src = 'https://www.dropbox.com/scl/fi/tkhja9j9z60idn2kor9yo/Video-1-13-26-9-38-27-am.mp4?rlkey=1k7yokbjoxgu1zyybu5rm0wzk&st=6i1spn4p&dl=1&d=1';
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      video.controls = false;
      video.autoplay = true;
      video.playsInline = true;
      
      // Prevent clicks from closing the video - fullscreen videos must play to completion
      videoContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Do nothing - video must play to end
      });
      
      video.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Do nothing - video must play to end
      });
      
      // Ensure video plays to completion - prevent pausing via clicks
      video.addEventListener('play', () => {
        // Once playing, ensure it continues
        if (video.paused) {
          video.play().catch(() => {});
        }
      });
      
      // Request fullscreen
      video.addEventListener('loadedmetadata', () => {
        if (video.requestFullscreen) {
          videoContainer.requestFullscreen().catch(err => {
          });
        } else if (video.webkitRequestFullscreen) {
          videoContainer.webkitRequestFullscreen();
        } else if (video.mozRequestFullScreen) {
          videoContainer.mozRequestFullScreen();
        } else if (video.msRequestFullscreen) {
          videoContainer.msRequestFullscreen();
        }
      });
      
      // When video ends, show epilogue
      video.addEventListener('ended', () => {
        // Only exit fullscreen if actually in fullscreen mode
        try {
          if (document.fullscreenElement || document.webkitFullscreenElement || 
              document.mozFullScreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch(() => {}); // Ignore errors
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen().catch(() => {});
            } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen().catch(() => {});
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen().catch(() => {});
            }
          }
        } catch (e) {
          // Ignore fullscreen exit errors
        }
        videoContainer.remove();
        // Show epilogue UI
        showKreplinEpilogue().then(() => {
          resolve();
        });
      });
      
      // Handle errors
      video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        log('Error loading video. The Kreplin Protocol has been initiated!');
        videoContainer.remove();
        resolve();
      });
      
      videoContainer.appendChild(video);
      document.body.appendChild(videoContainer);
    });
    
    // Assemble UI
    overlay.appendChild(message);
    overlay.appendChild(countdownDisplay);
    overlay.appendChild(protocolButton);
    document.body.appendChild(overlay);
  });
}

// Kreplin Protocol Epilogue - shown after video plays
async function showKreplinEpilogue() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'epilogue-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #fff;
      padding: 40px;
      text-align: left;
      color: #fff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 24px;
      font-weight: normal;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      max-width: 900px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create text container
    const textContainer = document.createElement('div');
    textContainer.id = 'epilogue-content';
    textContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    modal.appendChild(textContainer);
    
    // Epilogue text split into lines
    const epilogueLines = [
      "The Kreplin Protocol worked. You are the great chosen one.",
      "",
      "At the final moment -  as warning sirens bled into one another and the sky itself seemed to flinch - the entire city of Southampton tore free from the crust of the Earth. Streets, pubs, estates, the Itchen, St Mary's, all of it lifted and turned into some kind of space ship or something, wrapped in a shimmering protective ecosphere.",
      "",
      "Below, the island of Great Britain took the full force of the nuclear onslaught. It very sadly exploded, then sank to the bottom of the sea. This was very upsetting for all involved, but importantly you managed to survive.",
      "",
      "It was a very big nuclear war.",
      "",
      "Within a year, 98% of the world's population unfortunately died. Civilisation collapsed. Nations dissolved. History burned. What remained were scattered bands of primitive hunter-gatherers across the Global South, living quietly among the ruins of the old world.",
      "",
      "Football was forgotten.",
      "",
      "Or so it seemed.",
      "",
      "Years later, somewhere in rural Papua New Guinea, two young boys stand in a clearing. They are barefoot. Laughing. One of them kicks a rough, spherical object made of stitched hide toward the other.",
      "",
      "Back and forth.",
      "",
      "Back and forth.",
      "",
      "Could it be…?",
      "",
      "Above the dead planet, Southampton endures.",
      "",
      "You reign as King of Southampton, saviour of mankind, eternal chairman. The city-orb glides peacefully through space, self-sustaining, glowing faintly red and white.",
      "",
      "Crowds gather daily. They scream your name.",
      "",
      "Southampton win the Premier League every year.",
      "They win the Champions League every year.",
      "They win the FA Cup.",
      "They win the League Cup.",
      "",
      "There are no other teams left to compete with.",
      "",
      "You truly did bring eternal glory to Southampton."
    ];
    
    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      @keyframes fadeInButton {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .epilogue-button {
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        color: #000;
        border: 4px solid #FFD700;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
        margin-top: 40px;
        animation: fadeInButton 1s ease-out forwards;
        opacity: 0;
      }
      .epilogue-button:hover {
        transform: scale(1.05);
        box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8);
      }
      .epilogue-button:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle empty lines
          if (text === "") {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 20px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 12px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          textContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 50; // 50ms between lines for faster generation
      
      for (let i = 0; i < epilogueLines.length; i++) {
        const line = epilogueLines[i];
        await addLine(line, totalDelay);
        totalDelay += fadeInDelay;
      }
      
      return totalDelay;
    }
    
    // Create congratulations button container (will be shown after text finishes)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
      opacity: 0;
    `;
    
    // Create congratulations button
    const congratsButton = document.createElement('button');
    congratsButton.textContent = 'CONGRATULATIONS';
    congratsButton.className = 'epilogue-button';
    
    // Create subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '(Press to continue)';
    subtitle.style.cssText = `
      color: #aaa;
      font-size: 18px;
      font-style: italic;
      margin-top: 10px;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 0;
    `;
    
    // Button click handler - goes to certificate instead of resolving
    congratsButton.addEventListener('click', async () => {
      // Stop epilogue music before removing overlay
      if (overlay._epilogueAudio) {
        overlay._epilogueAudio.pause();
        overlay._epilogueAudio.currentTime = 0;
      }
      overlay.remove();
      style.remove(); // Remove the style element when closing
      // Set ending type for success ending (collected all kreplin gems)
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.endingType = "kreplin_protocol";
      // Navigate to certificate
      await showKreplinCertificate();
      resolve();
    });
    
    buttonContainer.appendChild(congratsButton);
    buttonContainer.appendChild(subtitle);
    modal.appendChild(buttonContainer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Stop background music before playing epilogue music - be aggressive
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    // Also stop any general music audio directly
    if (window.generalMusicAudio) {
      try {
        window.generalMusicAudio.pause();
        window.generalMusicAudio.currentTime = 0;
        window.generalMusicAudio = null;
      } catch(e) {
        console.warn('Error stopping general music audio:', e);
      }
    }
    // Disable general music to prevent it from restarting
    if (typeof window.generalMusicEnabled !== 'undefined') {
      window.generalMusicEnabled = false;
    }
    
    // Play epilogue music
    const epilogueAudio = new Audio('https://www.dropbox.com/scl/fi/qqboc2l8vj7xjhnqfcmpj/epilogue.mp3?rlkey=1dbpkuoyyiyp5lz5bw3tcr75c&st=491q33ww&dl=1');
    epilogueAudio.loop = true;
    epilogueAudio.volume = 0.7;
    epilogueAudio.play().catch(err => {});
    overlay._epilogueAudio = epilogueAudio; // Store reference for cleanup
    
    // Start displaying lines sequentially
    displayAllLines().then((totalDelay) => {
      // After all lines fade in, show the button at the bottom
      setTimeout(() => {
        buttonContainer.style.animation = 'fadeInButton 1s ease-out forwards';
        buttonContainer.style.opacity = '1';
      }, totalDelay + 300);
    });
  });
}

// Play nuclear strike video for epilogue path (when player doesn't have 3 gems)
async function playNuclearStrikeVideoEpilogue() {
  return new Promise((resolve) => {
    // Create fullscreen video container
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 9999999;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    
    // Create video element
    const video = document.createElement('video');
    // Convert Dropbox share link to direct download link for video playback
    video.src = 'https://www.dropbox.com/scl/fi/hdjhzlbwez36q29intpmq/Video-1-13-26-4-14-38-pm.mp4?rlkey=rq5s2p1v5zfwki04a4t8av56v&st=fa2vb4rq&dl=1';
    video.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;
    video.controls = false;
    video.autoplay = true;
    video.playsInline = true;
    
    // Prevent clicks from closing the video - fullscreen videos must play to completion
    videoContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Do nothing - video must play to end
    });
    
    video.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Do nothing - video must play to end
    });
    
    // Ensure video plays to completion - prevent pausing via clicks
    video.addEventListener('play', () => {
      // Once playing, ensure it continues
      if (video.paused) {
        video.play().catch(() => {});
      }
    });
    
    // Request fullscreen
    video.addEventListener('loadedmetadata', () => {
      if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen().catch(err => {
        });
      } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
      } else if (videoContainer.mozRequestFullScreen) {
        videoContainer.mozRequestFullScreen();
      } else if (videoContainer.msRequestFullscreen) {
        videoContainer.msRequestFullscreen();
      }
    });
    
    // When video ends, show epilogue
    video.addEventListener('ended', () => {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      videoContainer.remove();
      // Show nuclear strike epilogue UI
      showNuclearStrikeEpilogue().then(() => {
        resolve();
      });
    });
    
    // Handle errors
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      log('Error loading video. Showing epilogue...');
      videoContainer.remove();
      showNuclearStrikeEpilogue().then(() => {
        resolve();
      });
    });
    
    videoContainer.appendChild(video);
    document.body.appendChild(videoContainer);
  });
}

// Nuclear Strike Epilogue - shown after video plays (when player doesn't have 3 gems)
async function showNuclearStrikeEpilogue() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'epilogue-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #fff;
      padding: 40px;
      text-align: left;
      color: #fff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 24px;
      font-weight: normal;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      max-width: 900px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create text container
    const textContainer = document.createElement('div');
    textContainer.id = 'nuclear-epilogue-content';
    textContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    modal.appendChild(textContainer);
    
    // Epilogue text split into lines
    const epilogueLines = [
      "You are very sadly incinerated in nuclear hellfire, along with your Daughter, Son, Ex-Wife, Secretary and everyone else you know.",
      "",
      "That crazy island known as 'Great Britain' took the full force of the nuclear onslaught. It very sadly exploded, then sank to the bottom of the sea. This was very upsetting for all involved.",
      "",
      "It was a very big nuclear war.",
      "",
      "Within a year, 98% of the world's population unfortunately died. Civilisation collapsed. Nations dissolved. History burned. What remained were scattered bands of primitive hunter-gatherers across the Global South, living quietly among the ruins of the old world.",
      "",
      "Football was forgotten.",
      "",
      "Or so it seemed.",
      "",
      "Years later, somewhere in rural Papua New Guinea, two young boys stand in a clearing. They are barefoot. Laughing. One of them kicks a rough, spherical object made of stitched hide toward the other.",
      "",
      "Back and forth.",
      "",
      "Back and forth.",
      "",
      "THE END"
    ];
    
    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      @keyframes fadeInButton {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .epilogue-button {
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        color: #000;
        border: 4px solid #FFD700;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
        margin-top: 40px;
        animation: fadeInButton 1s ease-out forwards;
        opacity: 0;
      }
      .epilogue-button:hover {
        transform: scale(1.05);
        box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8);
      }
      .epilogue-button:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle empty lines
          if (text === "") {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 20px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 12px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          textContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 50; // 50ms between lines for faster generation
      
      for (let i = 0; i < epilogueLines.length; i++) {
        const line = epilogueLines[i];
        await addLine(line, totalDelay);
        totalDelay += fadeInDelay;
      }
      
      return totalDelay;
    }
    
    // Create congratulations button container (will be shown after text finishes)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
      opacity: 0;
    `;
    
    // Create congratulations button
    const congratsButton = document.createElement('button');
    congratsButton.textContent = 'CONGRATULATIONS';
    congratsButton.className = 'epilogue-button';
    
    // Create subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '(Press to continue)';
    subtitle.style.cssText = `
      color: #aaa;
      font-size: 18px;
      font-style: italic;
      margin-top: 10px;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 0;
    `;
    
    // Button click handler - goes to certificate instead of resolving
    congratsButton.addEventListener('click', async () => {
      // Stop epilogue music before removing overlay
      if (overlay._epilogueAudio) {
        overlay._epilogueAudio.pause();
        overlay._epilogueAudio.currentTime = 0;
      }
      overlay.remove();
      style.remove(); // Remove the style element when closing
      // Set ending type for nuclear holocaust ending (no kreplin gems)
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.endingType = "nuclear_holocaust";
      // Navigate to certificate
      await showKreplinCertificate();
      resolve();
    });
    
    buttonContainer.appendChild(congratsButton);
    buttonContainer.appendChild(subtitle);
    modal.appendChild(buttonContainer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Stop background music before playing epilogue music - be aggressive
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    // Also stop any general music audio directly
    if (window.generalMusicAudio) {
      try {
        window.generalMusicAudio.pause();
        window.generalMusicAudio.currentTime = 0;
        window.generalMusicAudio = null;
      } catch(e) {
        console.warn('Error stopping general music audio:', e);
      }
    }
    // Disable general music to prevent it from restarting
    if (typeof window.generalMusicEnabled !== 'undefined') {
      window.generalMusicEnabled = false;
    }
    
    // Play epilogue music
    const epilogueAudio = new Audio('https://www.dropbox.com/scl/fi/qqboc2l8vj7xjhnqfcmpj/epilogue.mp3?rlkey=1dbpkuoyyiyp5lz5bw3tcr75c&st=491q33ww&dl=1');
    epilogueAudio.loop = true;
    epilogueAudio.volume = 0.7;
    epilogueAudio.play().catch(err => {});
    overlay._epilogueAudio = epilogueAudio; // Store reference for cleanup
    
    // Start displaying lines sequentially
    displayAllLines().then((totalDelay) => {
      // After all lines fade in, show the button at the bottom
      setTimeout(() => {
        buttonContainer.style.animation = 'fadeInButton 1s ease-out forwards';
        buttonContainer.style.opacity = '1';
      }, totalDelay + 300);
    });
  });
}
