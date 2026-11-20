/* MATCH HOTFIX - Fixes for "always win opener" issues */
// League matches use this simulation; cup/friendly matches (an opponent passed in)
// still go through simulateMatchLegacy().
async function simulateMatch(opponentTeam = null) {
  if (opponentTeam === null) {
    // **League match simulation** - this is the path that was causing 0-0 games
    // If a special Messi-in-goal fiasco is scheduled, force a 0-100 loss
    if (S.messi_goalie_next_loss) {
      S.messi_goalie_next_loss = false;
      S.matches_played++; 
      S.losses++;
      S.morale = clamp(S.morale - 25, -100, 100);
      log('Result: LOSS (0–100). Board moves to remove you.');
      await triggerRemovalWorkaround('an egregious tactical fiasco (0–100)');
      render();
      return { winner: "them", usGoals: 0, themGoals: 100, score: "0-100" };
    }
    
    // Ensure strengths are computed
    if (!S?.preMatch?.ourStrength || !S?.preMatch?.oppStrength) {
      computePreMatchStrengthsAndOdds();
    }
    
    let our = S.preMatch.ourStrength, opp = S.preMatch.oppStrength;
    
    // Apply any one-match morale effects
    if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
    if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
    
    // FIXED: Reduce equalization cap from 200 to 500, but scale down since we're using smaller values now
    our = Math.max(10, Math.min(our, 60));
    opp = Math.max(10, Math.min(opp, 60));
    
    // Simulate goals using expected goals and Poisson distribution
    const [ourXG, oppXG] = expectedGoals(our, opp);
    let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);

    // Portsmouth replacement kids should not be a fair fight.
    try {
      const oppName = (typeof currentOpponent === 'function' ? currentOpponent()?.team : '') || '';
      const oppLower = oppName.toLowerCase();
      const isPortsmouth =
        oppLower.includes('portsmouth') || oppLower.includes('pompey');
      const isReplacement =
        !!(S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));

      if (isPortsmouth && isReplacement) {
        if (gf <= ga) {
          gf = Math.max(3, ga + 2);
        }
        ga = Math.min(ga, 1);
      }
    } catch (_e) {
      // If anything about opponent/drug state is weird, leave RNG as‑is.
    }
    
    if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
    if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
    if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
    
    const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");
    
    // Update league match stats
    if (winner === "us") {
      S.wins = (S.wins || 0) + 1;
      S.points = (S.points || 0) + 3;
      S.morale = clamp(S.morale + 4, -100, 100);
    } else if (winner === "them") {
      S.losses = (S.losses || 0) + 1;
      S.morale = clamp(S.morale - 6, -100, 100);
    } else {
      S.draws = (S.draws || 0) + 1;
      S.points = (S.points || 0) + 1;
    }
    
    // Create goal events with scorers for the summary
    const events = [];
    let t = 0;
    
    // Get player pools for both teams
    const ourPlayers = getOurSelectedFive();
    const oppPlayers = getOpponentPlayers();
    
    // Ensure we have actual player objects with names
    const ourPlayersWithNames = ourPlayers.filter(p => p && p.name);
    const oppPlayersWithNames = oppPlayers.filter(p => p && p.name);
    
    // Add our goals with player details - ensure we create exactly gf goals
    for (let i = 0; i < gf; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes (avoid early goals)
      
      // Ensure we have a proper player name, fallback to generating one if needed
      let scorerName = null;
      let assisterName = null;
      
      if (ourPlayersWithNames.length > 0) {
        const scorer = pick(ourPlayersWithNames);
        scorerName = scorer?.name;
        
        if (Math.random() < 0.6 && ourPlayersWithNames.length > 1) {
          const assister = pick(ourPlayersWithNames.filter(p => p.id !== scorer?.id));
          assisterName = assister?.name;
        }
      } else if (ourPlayers.length > 0) {
        // Fallback to any player in our squad, even if name is missing
        const fallbackPlayer = pick(ourPlayers);
        scorerName = fallbackPlayer?.name || `Player ${i + 1}`;
      } else {
        scorerName = `Southampton Player ${i + 1}`;
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
    
    // Add opponent goals with player details - ensure we create exactly ga goals
    for (let i = 0; i < ga; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes (avoid early goals)
      const scorer = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
      const assister = (Math.random() < 0.6 && oppPlayersWithNames.length > 1) 
        ? pick(oppPlayersWithNames.filter(p => p.id !== scorer?.id)) 
        : null;
      const oppTeam = currentOpponent()?.team || 'Opposition';
      events.push({ 
        t, 
        who: 'AWAY', 
        kind: 'GOAL',
        scorer: scorer?.name || (oppPlayers.length > 0 ? pick(oppPlayers).name : 'Opposition Player'),
        assister: assister?.name || null,
        team: oppTeam
      });
    }
    
    // Add other events (shots, corners, fouls, cards) - much more common than goals
    const totalEvents = Math.max(10, Math.floor((gf + ga) * 8));
    for (let i = 0; i < totalEvents; i++) {
      t += 3 + Math.floor(Math.random() * 8);
      const eventTypes = ['SHOT', 'CORNER', 'FOUL', 'CARD'];
      const eventType = pick(eventTypes);
      const isHome = Math.random() < 0.5;
      const players = isHome ? ourPlayersWithNames : oppPlayersWithNames;
      const player = players.length > 0 ? pick(players) : null;
      
      events.push({
        t,
        who: isHome ? 'HOME' : 'AWAY',
        kind: eventType,
        player: player?.name || null,
        team: isHome ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition')
      });
    }
    
    // Add referee bias events if referee was bribed
    if (S.referee_bribed && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
      addRefereeBiasEvents(events, ourPlayersWithNames, oppPlayersWithNames);
    }
    
    // Sort events by time for proper chronological order
    events.sort((a, b) => a.t - b.t);
    
    // Add context-dependent commentary for referee bribes (DISABLED - using new referee bias events instead)
    // if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
    //   const { team: oppTeam } = currentOpponent();
    //   const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
    //   const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';
    //   
    //   // Add 1-3 referee bribe commentary lines throughout the match
    //   const numBribeComments = 1 + Math.floor(Math.random() * 3);
    //   for (let i = 0; i < numBribeComments; i++) {
    //     const commentTime = Math.floor(Math.random() * 90);
    //     const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
    //     const line = pick(pool)
    //       .replaceAll('{FAV}', favName)
    //       .replaceAll('{OPP}', oppName);
    //     
    //     const bribeEvent = {
    //       t: commentTime,
    //       who: 'NEUTRAL',
    //       kind: 'ATMOSPHERE',
    //       message: line
    //     };
    //     
    //     events.push(bribeEvent);
    //   }
    // }
    
    // Sort again after adding bribery commentary
    events.sort((a, b) => a.t - b.t);
    
    // Store match events for summary
    S.matchEvents = events;
    
    // Display match commentary in real-time for sim mode
    log("The match is underway...");
    
    // Add skip to results button - add to actions area and make it persistent
    const skipButton = document.createElement('button');
    skipButton.id = 'skipToResultsBtn';
    skipButton.textContent = 'Skip to Results';
    skipButton.className = 'btn-warn';
    
    // Disable skip button if this is match 11 season 2 (stadium attack match) OR if stadium burn is triggered
    const isStadiumAttackMatch = (S.season === 2 && S.matches_played === 11) || S.preMatch?.stadium_burn_triggered;
    
    skipButton.style.cssText = `
      background-color: ${isStadiumAttackMatch ? '#999 !important' : '#ff6b6b !important'};
      color: white !important;
      border: 2px solid ${isStadiumAttackMatch ? '#666 !important' : '#ff4444 !important'};
      padding: 12px 20px !important;
      border-radius: 8px !important;
      cursor: ${isStadiumAttackMatch ? 'not-allowed !important' : 'pointer !important'};
      font-size: 14px !important;
      font-weight: bold !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
      transition: all 0.2s ease !important;
      margin: 5px !important;
      opacity: ${isStadiumAttackMatch ? '0.5' : '1'};
    `;
    
    if (isStadiumAttackMatch) {
      skipButton.disabled = true;
      skipButton.title = 'Skip disabled for this match';
    }
    
    // Add hover effect (only if not disabled)
    if (!isStadiumAttackMatch) {
      skipButton.addEventListener('mouseenter', () => {
        skipButton.style.backgroundColor = '#ff4444';
        skipButton.style.transform = 'scale(1.05)';
      });
      skipButton.addEventListener('mouseleave', () => {
        skipButton.style.backgroundColor = '#ff6b6b';
        skipButton.style.transform = 'scale(1)';
      });
    }
    
    let skipRequested = false;
    skipButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      skipRequested = true;
      skipButton.remove();
      log("⏭️ Skipping to match results...");
      // Actually call the skipToResults function and return immediately
      const result = await skipToResults();
      // Force return from the simulateMatch function
      throw new Error('SKIP_TO_RESULTS:' + JSON.stringify(result));
    });
    
    // Add to actions area
    const actions = document.getElementById('actions');
    if (actions) {
      actions.appendChild(skipButton);
    } else {
      // Fallback to body if actions not found
      document.body.appendChild(skipButton);
    }
    
    // Override clearActions to preserve our skip button
    if (!window.originalClearActions) {
      window.originalClearActions = window.clearActions;
    }
    window.clearActions = function() {
      const skipBtn = document.getElementById('skipToResultsBtn');
      window.originalClearActions();
      if (skipBtn && actions) {
        actions.appendChild(skipBtn);
      }
    };
    
    // Ensure button is visible and add a small delay
    setTimeout(() => {
      if (document.getElementById('skipToResultsBtn')) {
      }
    }, 100);
    
    // Update top scorers with the goals and announce them
    try {
      for (let i = 0; i < events.length; i++) {
        // Check if skip was requested
        if (skipRequested) {
          break;
        }
      const event = events[i];
      if (event.kind === 'GOAL') {
        if (event.scorer) {
          addGoalToTopScorers(event.scorer, event.team);
        }
        if (event.assister) {
          addAssistToTopScorers(event.assister, event.team);
        }
        
        // Generate varied goal commentary
        const goalCommentary = generateGoalCommentary(event);
        log(goalCommentary);
      } else if (event.kind === 'SHOT') {
        // Generate varied shot commentary
        const shotCommentary = generateShotCommentary(event);
        log(shotCommentary);
      } else if (event.kind === 'CORNER') {
        // Generate varied corner commentary
        const cornerCommentary = generateCornerCommentary(event);
        log(cornerCommentary);
      } else if (event.kind === 'FOUL') {
        // Generate varied foul commentary
        const foulCommentary = generateFoulCommentary(event);
        log(foulCommentary);
      } else if (event.kind === 'YELLOW_CARD') {
        // Generate varied yellow card commentary
        const cardCommentary = generateYellowCardCommentary(event);
        log(cardCommentary);
      } else if (event.kind === 'RED_CARD') {
        // Generate varied red card commentary
        const cardCommentary = generateRedCardCommentary(event);
        log(cardCommentary);
      } else if (event.kind === 'DODGY_PENALTY') {
        // Handle dodgy penalty from referee bias
        const penaltyCommentary = generateDodgyPenaltyCommentary(event);
        log(penaltyCommentary);
        
        // Add a goal from the penalty (80% conversion rate)
        if (Math.random() < 0.8) {
          // Add goal to top scorers
          addGoalToTopScorers(event.player, event.team);
          
          // Generate goal commentary
          const goalEvent = {
            t: event.t + 0.1,
            who: event.who,
            kind: 'GOAL',
            scorer: event.player,
            assister: null,
            team: event.team,
            isFromPenalty: true
          };
          const goalCommentary = generateGoalCommentary(goalEvent);
          log(`${goalCommentary} (Penalty)`);
          
          // IMPORTANT: Add the goal event to the events array for match summary
          events.push(goalEvent);
          
          // Update goal count
          if (event.who === 'HOME') {
            gf++;
          } else {
            ga++;
          }
        }
      } else if (event.kind === 'DODGY_RED_CARD') {
        // Handle dodgy red card from referee bias
        const redCardCommentary = generateDodgyRedCardCommentary(event);
        log(redCardCommentary);
        
        // Add to top scorers red card count
        addCardToTopScorers(event.player, event.team, 'red');
      } else if (event.kind === 'EARLY_FINAL_WHISTLE') {
        // Handle early final whistle from referee bias
        const earlyWhistleCommentary = generateEarlyFinalWhistleCommentary(event);
        log(earlyWhistleCommentary);
        
        // End the match early
        log(`The match ends early due to the referee's bizarre decision!`);
        break; // Exit the event processing loop
      } else if (event.kind === 'ATMOSPHERE') {
        // Display atmosphere commentary
        log(event.message);
      } else if (event.kind === 'COCAINE_HEART_ATTACK') {
        const name = event.player || 'A player';
        log(`${name} collapses on the pitch – suspected heart failure linked to drug abuse.`);
      }

      // After printing commentary for this event, run the quick-sim taunt/shout tick
      // Use the event's minute if available, else approximate with integer 't' or 0
      const minute = (typeof event.t === 'number') ? Math.floor(event.t) : (typeof event.minute === 'number' ? Math.floor(event.minute) : 0);
      await processQuickSimTick(minute);
    }
    } catch (error) {
      // Handle skip to results
      if (error.message && error.message.startsWith('SKIP_TO_RESULTS:')) {
        const resultJson = error.message.substring('SKIP_TO_RESULTS:'.length);
        const result = JSON.parse(resultJson);
        // Remove skip button if still present
        const remainingSkipBtn = document.getElementById('skipToResultsBtn');
        if (remainingSkipBtn) {
          remainingSkipBtn.remove();
        }
        // Restore original clearActions function
        if (window.originalClearActions) {
          window.clearActions = window.originalClearActions;
          delete window.originalClearActions;
        }
        return result;
      }
      // Re-throw other errors
      throw error;
    }

    // Log the full-time result with correct opponent name
    try {
      const oppName = S.matchContext?.team || currentOpponent().team || "Unknown";
      log(`Full-time: ${getClubName()} ${gf} – ${ga} ${oppName}`);
      
      // Check if this is the stadium fire match and add explosion commentary
      if (S.preMatch?.stadium_burn_triggered) {
        log(`💥 SUDDENLY: Flames erupt from the stadium!`);
        log(`🔥 The ground shakes as explosions rock St Mary's!`);
        log(`🚨 EMERGENCY: The stadium has been attacked by terrorists!`);
        log(`💣 Multiple bombs have exploded throughout the stadium!`);
        log(`🔥 The stadium is burning down! Flames engulf the stands!`);
        log(`🩸 There's blood and guts everywhere!`);
        log(`😱 Everyone is screaming in terror!`);
      }
      
      // Show match summary with goal scorers
      showMatchSummary(gf, ga, oppName);
    } catch {}
    
    // Special event: if a bribe was accepted but you won anyway
    if (S.accepted_bribe_this_match && winner === "us") {
      log("The referee's 'help' was unnecessary - you won on merit!");
    }
    
    // Remove skip button if still present and restore original clearActions
    const remainingSkipBtn = document.getElementById('skipToResultsBtn');
    if (remainingSkipBtn) {
      remainingSkipBtn.remove();
    }
    
    // Restore original clearActions function
    if (window.originalClearActions) {
      window.clearActions = window.originalClearActions;
      delete window.originalClearActions;
    }
    
    // Skip result is now handled in the catch block above
    
    return { winner, usGoals: gf, themGoals: ga, score: `${gf}-${ga}` };
  } else {
    // **Friendly match simulation** - call original function for friendlies
    return await simulateMatchLegacy.call(this, opponentTeam);
  }
}

// ===== STADIUM DEALING SYSTEM =====

// Stadium dealing approach system
async function maybeStadiumDealingApproach() {
  if (!S.stadium_dealing_unlocked || S.stadium_burned) return;
  
  // Increment match counter since cocaine purchase
  S.cocaine_purchase_matches_ago = (S.cocaine_purchase_matches_ago || 0) + 1;
  
  // Debug logging
  
  // Calculate approach chance based on previous decisions and time since cocaine purchase
  let approachChance = S.stadium_dealing_approach_chance;
  const totalVisits = S.stadium_dealing_total_visits || 0;
  
  // Guaranteed appearance if user has visited 1+ times and we need to reach 3 visits
  if (totalVisits >= 1 && totalVisits < 3) {
    approachChance = 100; // 100% chance to ensure we can reach 3 visits
  }
  // High chance within 4 matches of cocaine purchase (first time only)
  else if (S.cocaine_purchase_matches_ago <= 4 && !S.marco_approach_attempted) {
    approachChance = 75; // 75% chance within 4 matches for first approach
  }
  // After first approach, use normal approach chance for subsequent approaches
  else if (S.marco_approach_attempted) {
  }
  
  
  // Roll for approach
  const roll = Math.random() * 100;
  
  if (roll < approachChance) {
    if (!S.marco_approach_attempted) {
      S.marco_approach_attempted = true; // Mark that Marco has made his first approach
    } else {
    }
    await showStadiumDealingOffer();
  } else {
  }
}

// Show the dealer offer modal
async function showStadiumDealingOffer() {
  const basePayout = 200000 + Math.floor(Math.random() * 100000); // £200k-300k (massively increased)
  const negotiatedPayout = Math.floor(basePayout * 1.5); // 50% more for negotiate
  
  let warningText = '';
  if (S.stadium_dealing_total_allows >= 3 && !S.stadium_dealing_warning_shown) {
    warningText = '\n\n⚠️ Rumours abound that something bad might happen if you do this again.';
    S.stadium_dealing_warning_shown = true;
  }
  
  // Special message for first approach, or if Marco has been allowed before
  let approachMessage = `A shady figure approaches: "I can run product in the stands today. What do you say?"`;
  if ((S.cocaine_purchase_matches_ago <= 4 && S.stadium_dealing_total_allows === 0) || S.stadium_dealing_total_allows > 0) {
    approachMessage = `Marco approaches with a knowing grin: "Since you're in the business, I can run product in the stands today. What do you say?"`;
  }
  
  const choices = [
    { key: 'allow', label: `Allow (Post-match cut: £${basePayout.toLocaleString()})` },
    { key: 'refuse', label: 'Refuse' },
    { key: 'negotiate', label: `Negotiate (Higher cut: £${negotiatedPayout.toLocaleString()}, but riskier)` }
  ];
  
  const choice = await choose(choices, `${approachMessage}${warningText}`);
  
  // Increment total visits counter regardless of choice
  S.stadium_dealing_total_visits = (S.stadium_dealing_total_visits || 0) + 1;
  
  // Check for catastrophe trigger (3 total visits, regardless of choice)
  if (S.stadium_dealing_total_visits >= 3) {
    S.preMatch = S.preMatch || {};
    S.preMatch.stadium_burn_triggered = true;
  }
  
  if (choice === 'allow') {
    handleStadiumDealingAllow(basePayout, false);
  } else if (choice === 'negotiate') {
    handleStadiumDealingAllow(negotiatedPayout, true);
  } else {
    handleStadiumDealingRefuse();
  }
}

// Handle allowing stadium dealing
function handleStadiumDealingAllow(payout, negotiated) {
  S.stadium_dealing_total_allows++;
  S.stadium_dealing_consecutive_allows++;
  S.stadium_dealing_last_decision = negotiated ? 'negotiate' : 'allow';
  S.stadium_dealing_negotiated = negotiated;
  
  // Store payout for post-match
  S.preMatch = S.preMatch || {};
  S.preMatch.stadium_dealing_payout = payout;
  S.preMatch.stadium_dealing_negotiated = negotiated;
  
  // Adjust approach chance for next time (higher chance after successful deals)
  S.stadium_dealing_approach_chance = Math.min(40, S.stadium_dealing_approach_chance + 8);
  
  // Increase heat level
  S.stadium_dealing_heat_level += negotiated ? 2 : 1;
  
  log(`You nod. The dealer grins. "See you after the match."`);
}

// Handle refusing stadium dealing
function handleStadiumDealingRefuse() {
  S.stadium_dealing_consecutive_allows = 0; // Reset consecutive count
  S.stadium_dealing_last_decision = 'refuse';
  
  // Reduce approach chance (but not too much)
  S.stadium_dealing_approach_chance = Math.max(8, S.stadium_dealing_approach_chance - 4);
  
  log(`You shake your head. The dealer shrugs and disappears into the crowd.`);
}

// Process stadium dealing results after match
async function processStadiumDealingResults() {
  
  // Additional safety check: If it's season 2 match 11 and we haven't triggered yet, force it
  if (!S.preMatch?.stadium_burn_triggered && S.season === 2 && S.matches_played === 11 && !S.stadium_burned) {
    const totalVisits = S.stadium_dealing_total_visits || 0;
    const hasDealingHistory = S.stadium_dealing_unlocked || totalVisits > 0 || (S.stadium_dealing_total_allows || 0) > 0;
    
    if (totalVisits >= 2 || hasDealingHistory) {
      S.preMatch = S.preMatch || {};
      S.preMatch.stadium_burn_triggered = true;
    }
  }
  
  // Check for stadium burn trigger FIRST - this can happen even without a payout
  // (e.g., season 2 default path at match 11)
  if (S.preMatch?.stadium_burn_triggered) {
    await triggerStadiumBurn();
    
    // Clean up the trigger flag
    delete S.preMatch.stadium_burn_triggered;
    
    // If there was no payout, we're done here
    if (!S.preMatch?.stadium_dealing_payout) {
      return;
    }
  }
  
  // Process payout if it exists (from allowing drug deals)
  if (!S.preMatch?.stadium_dealing_payout) {
    // No payout and no stadium burn trigger - nothing to do
    return;
  }
  
  const payout = S.preMatch.stadium_dealing_payout;
  const negotiated = S.preMatch.stadium_dealing_negotiated;
  
  // Add illicit match cut to revenue
  S.chairman_cash += payout;
  
  // Small morale boost from "edgy" atmosphere
  S.fan_morale = Math.min(100, (S.fan_morale || 50) + 2);
  
  log(`💰 Illicit Match Cut: £${payout.toLocaleString()}`);
  log(`📈 Fan morale +2% (edgy atmosphere)`);
  
  // Clean up
  delete S.preMatch.stadium_dealing_payout;
  delete S.preMatch.stadium_dealing_negotiated;
}

// Trigger stadium burn event
async function triggerStadiumBurn() {
  S.stadium_burned = true;
  S.stadium_dealing_consecutive_allows = 0;
  
  // Trigger stadium destroyed achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'stadium_destroyed')) {
    const achievement = {
      id: 'stadium_destroyed',
      title: 'Stadium Destroyed by Terrorists',
      description: 'Stadium destroyed by terrorists (the fire incident)',
      icon: '🔥'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
  }
  
  // Destroy stadium
  S.stadium.capacity = 0;
  S.stadium.state = 'destroyed';
  
  // Massive morale hit
  S.fan_morale = Math.max(0, (S.fan_morale || 50) - 35);
  
  // Force relocation to Eastleigh
  S.stadium.relocated_to_eastleigh = true;
  S.stadium.eastleigh_capacity = 5000;
  S.stadium.eastleigh_ticket_price = 15; // Reduced from normal
  
  // Squad fallout - players vaporized in the explosion
  if (S.squad && S.squad.length > 0) {
    const bestPlayer = S.squad.reduce((best, player) => 
      (player.rating || 0) > (best.rating || 0) ? player : best
    );
    S.squad = S.squad.filter(p => p !== bestPlayer);
    log(`💀 ${bestPlayer.name} is vaporized in the explosion and dies.`);
    
    // 25% chance second player also vaporized
    if (Math.random() < 0.25 && S.squad.length > 0) {
      const secondBest = S.squad.reduce((best, player) => 
        (player.rating || 0) > (best.rating || 0) ? player : best
      );
      S.squad = S.squad.filter(p => p !== secondBest);
      log(`💀 ${secondBest.name} is also vaporized in the explosion and dies.`);
    }
  }
  
  // Legal/FA heat
  S.legal_risk = (S.legal_risk || 0) + 15;
  S.fa_risk = (S.fa_risk || 0) + 20;
  S.reputation = Math.max(0, (S.reputation || 50) - 25);
  
  log(`🔥 CATASTROPHE: The stadium burns to the ground!`);
  log(`💥 Flames engulf St Mary's Stadium as thick black smoke billows into the night sky.`);
  log(`🚨 Fire crews battle the inferno for hours, but the structure is beyond saving.`);
  log(`📺 Live TV coverage shows the iconic floodlights collapsing into the burning wreckage.`);
  log(`📉 Fan morale -35%`);
  log(`⚖️ Legal risk +15, FA risk +20, Reputation -25`);
  log(`🏠 Forced relocation to Eastleigh F.C. (5,000 capacity)`);
  
  // Movie announcement
  log(`\n🎬 A movie is being made about it.`);
  log(`📰 Rumors abound that Delmor Krunchem is funding it.`);
  S.movie_announced_match = S.matches_played || 0;
  
  // Queue press interview
  S.press_interview_queued = true;
  
  // Queue the Shafty Rod Johnson story to appear in pre-match phase of the following match
  // This prevents it from occluding important log entries immediately after the attack
  S.pending_stadium_burn_story = true;
  
  // Kreplin gem discovery opportunity
  await checkKreplinGemDiscovery();
}

// Check for Kreplin gem discovery in stadium wreckage
async function checkKreplinGemDiscovery() {
  // Only show if player hasn't already found a gem from this event
  if (S.kreplin_gem_stadium_found) return;
  
  // Wait for all log entries to finish processing before showing the button
  await waitForLogQueue();
  
  log('');
  log(`✨ A shining, ethereal glow amidst the rubble...`);
  log(`Could it be? Surely not...`);
  log(`Unless?`);
  
  // Wait for the gem discovery log entries to finish processing
  await waitForLogQueue();
  
  // Create the choice and add glow effect to the button
  const choicePromise = choose([
    { key: 'sift', label: '✨ Sift through the rubble', variant: 'good' }
  ], '');
  
  // Add glow effect to the button after it's created
  setTimeout(() => {
    const actionsEl = document.getElementById('actions');
    if (actionsEl) {
      const buttons = actionsEl.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn.textContent.includes('✨ Sift through the rubble')) {
          btn.classList.add('glow-gem');
        }
      });
    }
  }, 100);
  
  const choice = await choicePromise;
  
  if (choice === 'sift') {
    await playKreplinGemVideo();
    
    // Mark as found so it doesn't trigger again
    S.kreplin_gem_stadium_found = true;
    
    // Increment Kreplin gem count
    S.kreplin_gems = (S.kreplin_gems || 0) + 1;
    // Sync to playerStats for certificate
    if (!S.playerStats) S.playerStats = {};
    S.playerStats.kreplinGems = Math.max(S.playerStats.kreplinGems || 0, S.kreplin_gems || 0);
    
    // Show big bright saucy twinkling celebratory UI after video closes
    await showKreplinGemCelebration();
    
    // Also add a log entry
    log('');
    const gemLogEntry = document.createElement('div');
    gemLogEntry.className = 'kreplin-gem-discovery';
    gemLogEntry.style.cssText = `
      font-size: 24px;
      font-weight: bold;
      color: #FFD700;
      text-align: center;
      padding: 20px;
      margin: 20px 0;
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 255, 255, 0.1));
      border: 2px solid #FFD700;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3);
      animation: gemCelebration 2s ease-in-out;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.6);
    `;
    gemLogEntry.textContent = '✨💎 YOU FOUND A KREPLIN GEM!!! 💎✨';
    
    // Add to log
    const logEl = document.getElementById('log');
    if (logEl) {
      logEl.appendChild(gemLogEntry);
      logEl.scrollTop = logEl.scrollHeight;
    }
    
    // Update HUD
    if (typeof updateHUD === 'function') updateHUD();
    
    // Add sparkle animation
    setTimeout(() => {
      gemLogEntry.style.animation = 'none';
      setTimeout(() => {
        gemLogEntry.style.animation = 'gemCelebration 2s ease-in-out';
      }, 10);
    }, 2000);
  }
}

// Check for Kreplin gem discovery in Cronster's brain matter
async function checkCronsterKreplinGemDiscovery() {
  // Only show if player hasn't already found a gem from this event
  if (S.kreplin_gem_cronster_found) return;
  
  // Small delay to let the death messages settle
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  log('');
  log(`You see something shiny and ethereal glowing from within the cronster's brain matter.`);
  log(`Could it be? Surely not...`);
  log(`Unless..?`);
  
  // Create the choice and add glow effect to the button
  const choicePromise = choose([
    { key: 'sift', label: '✨ Sift through the Kuddle Cronster\'s brain matter', variant: 'good' }
  ], '');
  
  // Add glow effect to the button after it's created
  setTimeout(() => {
    const actionsEl = document.getElementById('actions');
    if (actionsEl) {
      const buttons = actionsEl.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn.textContent.includes('Sift through the Kuddle Cronster')) {
          btn.classList.add('glow-gem');
        }
      });
    }
  }, 100);
  
  const choice = await choicePromise;
  
  if (choice === 'sift') {
    await playCronsterKreplinGemVideo();
    
    // Mark as found so it doesn't trigger again
    S.kreplin_gem_cronster_found = true;
    
    // Increment Kreplin gem count
    S.kreplin_gems = (S.kreplin_gems || 0) + 1;
    // Sync to playerStats for certificate
    if (!S.playerStats) S.playerStats = {};
    S.playerStats.kreplinGems = Math.max(S.playerStats.kreplinGems || 0, S.kreplin_gems || 0);
    
    // Show big bright saucy twinkling celebratory UI after video closes
    await showKreplinGemCelebration();
    
    // Also add a log entry
    log('');
    const gemLogEntry = document.createElement('div');
    gemLogEntry.className = 'kreplin-gem-discovery';
    gemLogEntry.style.cssText = `
      font-size: 24px;
      font-weight: bold;
      color: #FFD700;
      text-align: center;
      padding: 20px;
      margin: 20px 0;
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 255, 255, 0.1));
      border: 2px solid #FFD700;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3);
      animation: gemCelebration 2s ease-in-out;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.6);
    `;
    gemLogEntry.textContent = '✨💎 YOU FOUND A KREPLIN GEM!!! 💎✨';
    
    // Add to log
    const logEl = document.getElementById('log');
    if (logEl) {
      logEl.appendChild(gemLogEntry);
      logEl.scrollTop = logEl.scrollHeight;
    }
    
    // Update HUD
    if (typeof updateHUD === 'function') updateHUD();
    
    // Add sparkle animation
    setTimeout(() => {
      gemLogEntry.style.animation = 'none';
      setTimeout(() => {
        gemLogEntry.style.animation = 'gemCelebration 2s ease-in-out';
      }, 10);
    }, 2000);
  }
}

// Play gem jingle when collecting a Kreplin gem
async function playGemJingle() {
  return new Promise((resolve) => {
    // Stop general music
    let wasMusicPlaying = false;
    if (typeof window._stopGeneralMusic === 'function') {
      // Check if music was playing before stopping
      if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
        wasMusicPlaying = true;
      }
      window._stopGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
      wasMusicPlaying = true;
      generalMusicAudio.pause();
    }
    
    // Also pause opening music if playing
    const openingMusic = document.getElementById('openingMusic');
    let wasOpeningMusicPlaying = false;
    if (openingMusic && !openingMusic.paused) {
      wasOpeningMusicPlaying = true;
      openingMusic.pause();
    }
    
    // Create audio element for gem jingle
    const jingleUrl = 'https://www.dropbox.com/scl/fi/vyj30vm6yfrnzw5udstw3/kgem.mp3?rlkey=4hvq4bu3rvudcclptzbrncjtp&st=5vpb9d7e&dl=1';
    const jingleAudio = new Audio(jingleUrl);
    
    // Set audio properties
    jingleAudio.preload = 'auto';
    jingleAudio.volume = 1.0;
    
    // When jingle finishes, resume general music
    jingleAudio.onended = () => {
      // Resume general music after jingle finishes
      if (wasMusicPlaying) {
        if (typeof window._startGeneralMusic === 'function') {
          window._startGeneralMusic();
        } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
          generalMusicAudio.play().catch(err => {
          });
        }
      }
      
      // Resume opening music if it was playing
      if (wasOpeningMusicPlaying && openingMusic) {
        openingMusic.play().catch(err => {
        });
      }
      
      resolve();
    };
    
    // Handle errors
    jingleAudio.onerror = (e) => {
      console.error('Gem jingle playback error:', e);
      // Resume general music even on error
      if (wasMusicPlaying) {
        if (typeof window._startGeneralMusic === 'function') {
          window._startGeneralMusic();
        } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
          generalMusicAudio.play().catch(err => {
          });
        }
      }
      
      // Resume opening music if it was playing
      if (wasOpeningMusicPlaying && openingMusic) {
        openingMusic.play().catch(err => {
        });
      }
      
      resolve();
    };
    
    // Play the jingle
    const playPromise = jingleAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.error('Error playing gem jingle:', err);
        // Resume general music on play error
        if (wasMusicPlaying) {
          if (typeof window._startGeneralMusic === 'function') {
            window._startGeneralMusic();
          } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
            generalMusicAudio.play().catch(err => {
            });
          }
        }
        
        // Resume opening music if it was playing
        if (wasOpeningMusicPlaying && openingMusic) {
          openingMusic.play().catch(err => {
          });
        }
        
        resolve();
      });
    }
  });
}

// Show big bright saucy twinkling celebratory UI for Kreplin gem discovery
async function showKreplinGemCelebration() {
  // Track gem collection count (how many times gems have been collected, not total gems)
  if (!S.gem_collection_count) {
    S.gem_collection_count = 0;
  }
  S.gem_collection_count++;
  
  const collectionNumber = S.gem_collection_count;
  const isFirstThree = collectionNumber <= 3;
  const isFourth = collectionNumber === 4;
  
  // Start gem jingle playing (don't await - let it play while showing graphic)
  // The jingle will stop main music and resume it when finished
  playGemJingle();
  
  // For first 3 times: show special graphical overlay (show immediately, synchronized with jingle)
  if (isFirstThree) {
  // Create full-screen celebratory overlay
  const celebrationDiv = document.createElement('div');
  celebrationDiv.id = 'kreplin-gem-celebration';
  celebrationDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 20000;
    background: linear-gradient(135deg, 
      rgba(255, 20, 147, 0.95) 0%, 
      rgba(255, 215, 0, 0.95) 25%, 
      rgba(255, 20, 147, 0.95) 50%, 
      rgba(255, 215, 0, 0.95) 75%, 
      rgba(255, 20, 147, 0.95) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    animation: pulseGlow 1s ease-in-out infinite;
    overflow: hidden;
  `;
  
  // Main celebratory message
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    font-size: 72px;
    font-weight: 900;
    color: #FFFFFF;
    text-align: center;
    text-shadow: 
      0 0 20px rgba(255, 255, 255, 1),
      0 0 40px rgba(255, 215, 0, 1),
      0 0 60px rgba(255, 20, 147, 1),
      0 0 80px rgba(255, 215, 0, 0.8),
      0 0 100px rgba(255, 20, 147, 0.6);
    animation: twinkle 0.5s ease-in-out infinite, rainbow 3s linear infinite;
    margin-bottom: 30px;
    z-index: 20001;
    transform: scale(1);
    transition: transform 0.3s;
  `;
  // Show different message based on collection number
  if (collectionNumber === 3) {
    messageDiv.innerHTML = '✨💎<br>YOU FOUND YOUR<br>THIRD KREPLIN GEM!!!<br>💎✨';
  } else {
    messageDiv.innerHTML = '✨💎<br>YOU FOUND A<br>KREPLIN GEM!!!<br>💎✨';
  }
  
  // Subtitle
  const subtitleDiv = document.createElement('div');
  subtitleDiv.style.cssText = `
    font-size: 36px;
    font-weight: 700;
    color: #FFFFFF;
    text-align: center;
    text-shadow: 
      0 0 15px rgba(255, 255, 255, 0.9),
      0 0 30px rgba(255, 215, 0, 0.8);
    animation: twinkle 0.8s ease-in-out infinite;
    margin-top: 20px;
    z-index: 20001;
  `;
  subtitleDiv.textContent = '🎉 ABSOLUTELY SAUCY! 🎉';
  
  celebrationDiv.appendChild(messageDiv);
  celebrationDiv.appendChild(subtitleDiv);
  document.body.appendChild(celebrationDiv);
  
  // Add sparkle effects
  for (let i = 0; i < 50; i++) {
    const sparkle = document.createElement('div');
    sparkle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 215, 0, 0.8) 50%, transparent 100%);
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: sparkle ${Math.random() * 2 + 1}s ease-in-out infinite;
      animation-delay: ${Math.random() * 2}s;
      pointer-events: none;
      z-index: 20001;
    `;
    celebrationDiv.appendChild(sparkle);
  }
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    celebrationDiv.style.transition = 'opacity 1s ease-out';
    celebrationDiv.style.opacity = '0';
    setTimeout(() => {
      celebrationDiv.remove();
    }, 1000);
  }, 5000);
  
  // Also allow click to dismiss
  celebrationDiv.onclick = () => {
    celebrationDiv.style.transition = 'opacity 0.5s ease-out';
    celebrationDiv.style.opacity = '0';
    setTimeout(() => {
      celebrationDiv.remove();
    }, 500);
  };
  
  // Wait a bit for the celebration
  await new Promise(resolve => setTimeout(resolve, 100));
  } // End of isFirstThree check
  
  // For 4th time: show special UI
  if (isFourth) {
    const uiDiv = document.createElement('div');
    uiDiv.id = 'kreplin-gem-ui-4th';
    uiDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 20000;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;
    
    const uiMessageDiv = document.createElement('div');
    uiMessageDiv.style.cssText = `
      font-size: 64px;
      font-weight: 900;
      color: #FFFFFF;
      text-align: center;
      text-shadow: 
        0 0 20px rgba(255, 255, 255, 1),
        0 0 40px rgba(255, 215, 0, 1),
        0 0 60px rgba(255, 20, 147, 1);
      margin-bottom: 30px;
      z-index: 20001;
    `;
    uiMessageDiv.innerHTML = '✨💎<br>YOU FOUND THE<br>FINAL KREPLIN GEM!!!<br>💎✨';
    
    const uiSubtitleDiv = document.createElement('div');
    uiSubtitleDiv.style.cssText = `
      font-size: 32px;
      font-weight: 700;
      color: #FFFFFF;
      text-align: center;
      text-shadow: 
        0 0 15px rgba(255, 255, 255, 0.9),
        0 0 30px rgba(255, 215, 0, 0.8);
      margin-top: 20px;
      margin-bottom: 40px;
      z-index: 20001;
    `;
    uiSubtitleDiv.textContent = '🎉 ALL GEMS COLLECTED! 🎉';
    
    const uiCloseBtn = document.createElement('button');
    uiCloseBtn.textContent = 'Continue';
    uiCloseBtn.style.cssText = `
      padding: 15px 40px;
      font-size: 24px;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #FFFFFF;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      cursor: pointer;
      z-index: 20001;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
      transition: all 0.3s;
    `;
    uiCloseBtn.onmouseover = () => {
      uiCloseBtn.style.transform = 'scale(1.05)';
      uiCloseBtn.style.boxShadow = '0 0 30px rgba(99, 102, 241, 0.8)';
    };
    uiCloseBtn.onmouseout = () => {
      uiCloseBtn.style.transform = 'scale(1)';
      uiCloseBtn.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.5)';
    };
    
    uiDiv.appendChild(uiMessageDiv);
    uiDiv.appendChild(uiSubtitleDiv);
    uiDiv.appendChild(uiCloseBtn);
    document.body.appendChild(uiDiv);
    
    // Close UI when button is clicked
    uiCloseBtn.onclick = () => {
      uiDiv.style.transition = 'opacity 0.5s ease-out';
      uiDiv.style.opacity = '0';
      setTimeout(() => {
        uiDiv.remove();
      }, 500);
    };
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (document.body.contains(uiDiv)) {
        uiDiv.style.transition = 'opacity 0.5s ease-out';
        uiDiv.style.opacity = '0';
        setTimeout(() => {
          uiDiv.remove();
        }, 500);
      }
    }, 10000);
  }
}

// Play Kreplin gem discovery video for Cronster
async function playCronsterKreplinGemVideo() {
  // Use Dropbox direct download URL (dl=1 makes it a direct download link)
  const videoUrl = 'https://www.dropbox.com/scl/fi/ln6y4f8e7az62l1e3rtue/Video-1-5-26-10-46-09-am.mp4?rlkey=kdl9l0kawvowgb893ofpo8bsy&st=0d7wmr1u&dl=1';
  
  // Show video player with actual video
  const videoDiv = document.createElement('div');
  videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
  
  videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">✨💎 KREPLIN GEM DISCOVERY 💎✨</div><video id="cronsterGemVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + videoUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
  document.body.appendChild(videoDiv);
  
  // Wait for video to be closed or finished
  await new Promise((resolve) => {
    const video = document.getElementById('cronsterGemVideo');
    const finalCloseHandler = () => {
      videoDiv.remove();
      resolve();
    };
    
    // Add prominent X button in top-right corner
    const xButton = document.createElement('button');
    xButton.innerHTML = '✕';
    xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 10001; display: flex; align-items: center; justify-content: center; line-height: 1;';
    xButton.onclick = finalCloseHandler;
    xButton.title = 'Close';
    videoDiv.appendChild(xButton);
    
    if (video) {
      video.onended = finalCloseHandler;
    }
    
    // Also resolve if video div is removed
    const checkClosed = () => {
      if (!document.getElementById('cronsterGemVideo') && !document.body.contains(videoDiv)) {
        resolve();
      } else {
        setTimeout(checkClosed, 100);
      }
    };
    checkClosed();
  });
}

// Play Kreplin gem discovery video
async function playKreplinGemVideo() {
  // Use Dropbox direct download URL (dl=1 makes it a direct download link)
  const videoUrl = 'https://www.dropbox.com/scl/fi/vl7erd9evsmbi6ixpnbjw/Video-1-5-26-10-32-32-am.mp4?rlkey=weefprkzpvroxjs6e5ovi7es4&st=4alsm6f8&dl=1';
  
  // Show video player with actual video
  const videoDiv = document.createElement('div');
  videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
  
  videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">✨💎 KREPLIN GEM DISCOVERY 💎✨</div><video id="stadiumGemVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + videoUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
  document.body.appendChild(videoDiv);
  
  // Wait for video to be closed or finished
  await new Promise((resolve) => {
    const video = document.getElementById('stadiumGemVideo');
    const finalCloseHandler = () => {
      videoDiv.remove();
      resolve();
    };
    
    // Add prominent X button in top-right corner
    const xButton = document.createElement('button');
    xButton.innerHTML = '✕';
    xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 10001; display: flex; align-items: center; justify-content: center; line-height: 1;';
    xButton.onclick = finalCloseHandler;
    xButton.title = 'Close';
    videoDiv.appendChild(xButton);
    
    if (video) {
      video.onended = finalCloseHandler;
    }
    
    // Also resolve if video div is removed
    const checkClosed = () => {
      if (!document.getElementById('stadiumGemVideo') && !document.body.contains(videoDiv)) {
        resolve();
      } else {
        setTimeout(checkClosed, 100);
      }
    };
    checkClosed();
  });
}

// Check if movie has been released
async function checkMovieRelease() {
  // Check if movie was announced and hasn't been shown yet
  if (typeof S.movie_announced_match !== 'number' || S.movie_shown) return;
  
  const matchesSinceAnnouncement = (S.matches_played || 0) - S.movie_announced_match;
  
  // Movie comes out a couple games after announcement
  if (matchesSinceAnnouncement >= 2) {
    const choice = await choose([
      { key: 'yes', label: 'Yes, I want to see it', variant: 'good' },
      { key: 'no', label: 'No, skip it', variant: 'neutral' }
    ], '🎬 The movie about the terrorist attack has come out. Do you want to see it?');
    
    if (choice === 'yes') {
      await showMovieScreenplay();
      S.movie_shown = true;
    } else {
      log(`You decide to skip the movie.`);
      S.movie_shown = true; // Mark as shown so it doesn't ask again
    }
  }
}

// Show cinema screen with screenplay
async function showMovieScreenplay() {
  const playerName = S.full_name || 'SCHAIR';
  
  const screenplay = `THE SAD TERRORIST ATTACK
________________________________________
OPENING CASTING CARDS
Black screen. Low piano. Grave.
White text fades in slowly.
${playerName}
Played by HARVEY WEINSTEIN

Cut to black.
DELMOR KRUNCHEM
Played by BRAD PITT
Cut to black.
KEIR STARMER
Played by Himself
Cut to black.
Final card, lingering too long:
A FILM ABOUT CONSEQUENCES
________________________________________
FADE IN
INT. ${playerName}'S PRIVATE OFFICE – MORNING
Dark. Heavy wood. No warmth.
${playerName} sits at a vast desk, grotesquely overweight, face slick with sweat and grease.
He eats constantly. Meat. Pastries. Pills.
A SECRETARY stands nearby, silent.
<strong>${playerName}:</strong>
You know why you're here.
She does not answer.
He reaches out and squeezes her hip and moans in pleasure, his secretary visibly recoils.
<strong>${playerName} (CONT'D):</strong>
I've got a nice bribe for ya love. I love bribes. Now let me touch ya some more
He opens a briefcase. Inside: cash and drugs, mixed together.
His WIFE enters, thin, exhausted, holding two CHILDREN.
<strong>WIFE:</strong>
We don't have food. Not even a loaf of bread. 
${playerName} does not turn.
<strong>${playerName}:</strong>
There's food everywhere.
<strong>WIFE:</strong>
Not for us.
${playerName} opens a drawer and slides out a bag of cocaine.
<strong>${playerName}:</strong>
Give them this.
They'll forget hunger.
The CHILDREN stare.
<strong>WIFE:</strong>
Please, just two pounds…
${playerName} stands with effort.
<strong>${playerName}:</strong>
GET OUT OF MY OFFICE!!! YOU'RE INTERRUPTING MY 'FOOD TIME'! 
The WIFE leaves.
${playerName} sits and continues eating and grunting in pleasure to his terrified secretary.
________________________________________
EXT. ST MARY'S STADIUM – DAY
Bright. Ordinary. Families arriving.
PAUL (22) and WOMAN (21) walk hand in hand.
<strong>WOMAN:</strong>
I feel nervous.
<strong>PAUL:</strong>
Don't be silly. Nothing bad could ever happen at a football stadium.
A distant RUMBLE.
They stop.
<strong>WOMAN:</strong>
Oh no… there's been a terrorist attack.
PAUL grips her hands tightly.
<strong>PAUL:</strong>
I'll never forget you, WOMAN.
<strong>WOMAN:</strong>
I'll remember you forever, PAUL.
They embrace, as the fireball from the terrorist attack engulfs them both, as they are eviscerated in a cloud of blood, guts and bone fragments (this is played partially for  laughs, as a nearby homeless person is shown being covered by viscera, and his dog licks it off him, and the homeless man begins hitting his dog)
________________________________________
INT. STADIUM – PRIVATE BOX – CONTINUOUS
${playerName} watches the explosion from above.
He is eating.
Food drops from his mouth as he laughs.
<strong>${playerName}:</strong>
YES! YES! GOOD!
The more dead the better! Especially families! Time to make some more bribes!!
He stuffs more food into his mouth.
________________________________________
INT. PRIVATE BOX – CONTINUOUS
The CHAIRMAN OF SOUTHAMPTON sits in a corner, away from the chaos.
His laptop is open on his lap.
The screen shows a Google search page.
The search bar displays: "pictures of children"
He stares at the screen intently, oblivious to the destruction around him.
________________________________________
INT. PRIVATE BOX CORRIDOR – MOMENTS BEFORE BLAST
DELMOR KRUNCHEM confronts ${playerName} urgently.
<strong>DELMOR:</strong>
There's going to be an attack.
<strong>${playerName}:</strong>
Is this about bribes?
<strong>DELMOR:</strong>
No.
<strong>${playerName}:</strong>
Then GET OUT OF MY FUCKING OFFICE OR I'LL KILL HER (pointing at secretary).
<strong>DELMOR:</strong>
Thousands could die.
<strong>${playerName}:</strong>
Sounds like a good bribe!
DELMOR turns away, resolute.
________________________________________
EXT. STADIUM RUINS – CONTINUOUS
Chaos. Smoke. Fire.
DELMOR emerges through debris.
•	DELMOR sprints toward falling concrete
•	LEAPS across a twenty-foot gap
•	EXECUTES A BACKFLIP over burning wreckage
•	RUNS UP a collapsing wall
•	GRABS an armed terrorist mid-air
•	SPINS him overhead and throws him aside
He lands perfectly.
He spots multiple unexploded devices.
DELMOR performs a sequence of heroic feats:
•	Diving through flames
•	Sliding under debris
•	Leaping from one collapsing tier to another
The CROWD watches instead of fleeing.
A MAN shouts:
<strong>MAN:</strong>
If Delmor hadn't done that, several thousand more of us would be dead!
The CROWD begins chanting, in awe:
<strong>CROWD:</strong>
DELMOR!
DELMOR!
DELMOR!
________________________________________
EXT. RUBBLE FIELD – LATER
DELMOR kneels beside WOMAN, somehow alive despite prior description of being brutally eviscerated.
He begins CPR.
<strong>DELMOR:</strong>
Stay with me.
She GASPS awake.
<strong>WOMAN:</strong>
You saved me.
<strong>DELMOR:</strong>
I did what I had to do.
She looks at him with reverence.
<strong>WOMAN:</strong>
What can I do to repay you?
<strong>DELMOR:</strong>
mmm, come with me
________________________________________
INT. TEMPORARY SAFE ROOM – NIGHT
DELMOR stands near the doorway. WOMAN sits on a narrow cot, wrapped in a blanket that is slightly too small.
They do not speak at first.
DELMOR steps closer.
He removes his jacket slowly, with purpose, as though every movement matters.
She watches him, eyes steady.
<strong>DELMOR:</strong>
Sometimes survival means something. Get on your knees for me, baby
A long pause.
He gently brushes ash from her hair, his fingers lingering longer than necessary.
She exhales, shakily.
<strong>DELMOR (unzips flies):</strong>
Do it….
(The camera pans up, to sounds of pleasure as WOMAN moans 'Oh, delmor' over and over)

EXT. MAKESHIFT COURT – DAY
The TERRORISTS stand before KEIR STARMER.
<strong>STARMER:</strong>
You will be sentenced to community service.
A pause.
<strong>STARMER (CONT'D):</strong>
If you do this again,
I will be very cross.
Murmurs of approval.
But at least the victims were Southampton fans, rather than a real team such as Portsmouth.
The CROWD cheers.
<strong>CROWD:</strong>
STARMER!
STARMER!
________________________________________
EXT. PALACE STEPS – DAY
A ceremony.
DELMOR kneels.
<strong>STARMER:</strong>
For bravery beyond reason,
I grant you a new honour.
He pauses.
<strong>STARMER (CONT'D):</strong>
Mega Sir.
Thunderous applause.`;

  // Create cinema screen overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Courier New', monospace;
    color: #fff;
  `;
  
  // Create cinema screen
  const screen = document.createElement('div');
  screen.style.cssText = `
    width: 90%;
    max-width: 1200px;
    height: 80%;
    background: #000;
    border: 4px solid #333;
    border-radius: 8px;
    padding: 40px;
    overflow-y: auto;
    position: relative;
    box-shadow: 0 0 50px rgba(255, 255, 255, 0.1);
  `;
  
  // Create text container with typewriter effect
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    color: #fff;
    font-size: 18px;
    line-height: 1.8;
    white-space: pre-wrap;
    text-align: left;
    opacity: 0;
    animation: fadeIn 0.5s ease-in forwards;
  `;
  
  // Add fade-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scrollText {
      from { transform: translateY(0); }
      to { transform: translateY(-100%); }
    }
  `;
  document.head.appendChild(style);
  
  // Split screenplay into lines for display
  const lines = screenplay.split('\n');
  let currentLine = 0;
  
  function displayNextLine() {
    if (currentLine < lines.length) {
      const line = lines[currentLine];
      const lineDiv = document.createElement('div');
      lineDiv.innerHTML = line;
      lineDiv.style.cssText = `
        margin-bottom: ${line.trim() === '' ? '20px' : '8px'};
        opacity: 0;
        animation: fadeIn 0.3s ease-in forwards;
      `;
      textContainer.appendChild(lineDiv);
      currentLine++;
      
      // Auto-scroll to bottom (disabled - user can scroll manually)
      // screen.scrollTop = screen.scrollHeight;
      
      // Continue displaying lines with a slight delay
      setTimeout(displayNextLine, line.trim() === '' ? 200 : 50);
    } else {
      // All lines displayed, show close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: #333;
        color: #fff;
        border: 2px solid #666;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        font-family: 'Space Grotesk', sans-serif;
        transition: all 0.3s;
      `;
      closeBtn.onmouseover = () => {
        closeBtn.style.background = '#555';
        closeBtn.style.borderColor = '#888';
      };
      closeBtn.onmouseout = () => {
        closeBtn.style.background = '#333';
        closeBtn.style.borderColor = '#666';
      };
      closeBtn.onclick = () => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      };
      screen.appendChild(closeBtn);
    }
  }
  
  screen.appendChild(textContainer);
  overlay.appendChild(screen);
  document.body.appendChild(overlay);
  
  // Start displaying lines
  displayNextLine();
  
  // Also allow clicking outside to close (after a delay)
  setTimeout(() => {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
      }
    };
  }, 1000);
}

// Press interview system
async function conductPressInterview() {
  if (!S.press_interview_queued) return;
  S.press_interview_queued = false;
  
  log(`\n📺 PRESS CONFERENCE: The media demands answers about the stadium fire.`);
  log(`Assemble your response by choosing one option from each category:\n`);
  
  // Quote construction system
  const PRESS_QUOTES = {
    angry: {
      feelings: [
        "I am fucking raging.",
        "Fuming is a fucking understatement.",
        "I'm going to fucking kill someone.",
        "Listen right here you fucking useless cunts.",
        "You terrorists will rue the fucking day I became chairman.",
        "I won't forget this."
      ],
      subjects: [
        "Those fucking cunt murderers will burn in hell.",
        "I will rip these people limb from limb. I want to make them scream in agony while I sink my rotting teeth into their flesh.",
        "I have serious anger issues and this is making them much worse.",
        "It is time to commit some acts of strategic terrorism in retaliation. I am the only one with the balls to say it.",
        "Wishesa and prayers aren't enough. We need to strategically bomb a series of English cities.",
        "Those terrorists have fucked with the wrong city. Portsmouth would have just rolled over and taken it. Not the mighty Saints! Fuck yeah!"
      ],
      closings: [
        "I will kill many people until we find out why this happened.",
        "I will see to it that those responsible are tortured and murdered.",
        "They chose violence. We choose torture.",
        "I will not rest until each of them has been slaughtered, along with their innocent family members.",
        "They chose violence; I choose justice.",
        "I will murder anyone who hides them, or attempts to investigate alleged corruption at Southampton."
      ]
    },
    appropriate: {
      feelings: [
        "Today is a bleak, wretched day in the history of Southampton FC.",
        "We are simply devastated by the day's events.",
        "This is a dark day for the club.",
        "I am in shock. Words are not coming easily right now. I'll admit, I am hungry for food, but also for justice.",
        "I feel sick to my stomach. My most sincere condolences to the dead.",
        "My heart is broken. Our hearts are broken. Not just a stadium gone, but all those concession stands, serving wonderful yet juicy food including burgers."
      ],
      subjects: [
        "These criminals must face swift and unyielding justice.",
        "I want to clarify that the perpetrators are not representative of the religion of peace.",
        "We will overcome this, as Southampton always does when we are attacked by terrorists.",
        "Our community deserves answers. We deserve money too.",
        "The victims deserve our respect. To the victims - we respect you very much, I wish you weren't dead.",
        "Our club stands for more than this. This is the sort of thing Portsmouth stands for, not the mighty Saints."
      ],
      closings: [
        "We will rebuild and return stronger.",
        "We will cooperate fully with authorities, to a certain extent.",
        "We are working with emergency services to help those affected, to the extent that it's reasonable. Certain requests take longer as we can't allow anyone to see my confidential financial information",
        "We will make this right.",
        "We owe everyone honesty and care. All we ask for in return is money from the government and additional points in the league",
        "Our door is partially open to investigators."
      ]
    },
    conspiratorial: {
      feelings: [
        "This is a distraction. Trust me. The official story doesn't add up.",
        "This goes deeper than you think.",
        "Oh you believe the official story do ya? You believe the so-called experts?",
        "There are forces at work here.",
        "I've seen this pattern before. Many, many times.",
        "Today was a sideshow. People will not like what I'm about to uncover."
      ],
      subjects: [
        "I believe the biased referee planned this. It is so obvious.",
        "The FA needs to be investigated. They did this. They're not even pretending anymore, they hate Southampton.",
        "There are darker forces at play here.",
        "The other team clearly wanted this to happen. They must have done this.",
        "Follow the money. It all ends lining the pockets of FIFA. They can't handle that Southampton finally has a competent chairman.",
        "The timing is no coincidence. Notice how they made sure there would be a lot of kids?"
      ],
      closings: [
        "The FA has been looking to clip my wings for quite some time.",
        "This particular ref has always been biased against us. I believe it was him.",
        "You will see who benefits from this.",
        "Ask who wanted us silenced. The answer of course is the FA",
        "It all connects if you pay attention. Portsmouth did this to us",
        "I won't be muzzled by the FA."
      ]
    },
    heartless: {
      feelings: [
        "You're interrupting my dinner. It was an expensive day for us, but life goes on.",
        "There's no point crying over spilt milk. Fuck all I can do about it.",
        "Shit happens, what do you want me to say.",
        "It is what it is.",
        "In the grand scheme of thing it's not a big deal.",
        "Can we go off the record? You are sumptuously attractive.. Mmmm"
      ],
      subjects: [
        "One man's terrorist is another man's freedom fighter.",
        "It's all part of the crazy game we call life.",
        "These things sort themselves out. It will be all right.",
        "Collateral damage happens. Fortunately the victims were all just fans and not me or the players.",
        "People overreact to things like this. Everyone dies.",
        "Feelings aren't facts."
      ],
      closings: [
        "But at least we got the result we wanted.",
        "It's only fair that the FA allows us to win this game. It's not fair otherwise.",
        "Surviving fans will continue to see the mighty Saints.",
        "On to the next one. Hopefully this does not happen again but if it does whatever",
        "We will get back the money we lost today.",
        "The table won't wait."
      ]
    },
    weird: {
      feelings: [
        "I am seriously not vibing with the frequency of your bogus question.",
        "I believe someone has implanted some kind of chip in my brain.",
        "Help me. I am being gangstalked.",
        "I am vibrating at an unsafe frequency.",
        "Do you like chicken? Try me, I'm fowl.",
        "I taste copper and ash."
      ],
      subjects: [
        "The floodlights blinked a warning. I tried to expose it, but I was verbally abused by you and all the rest of the people I know.",
        "The pitch woke up angry.",
        "There is some kind of ancient curse or something.",
        "Why are you looking at me? I had nothing to do with it.",
        "I had foreknowledge of the attack.",
        "The ball knew before we did. It was trying to tell us something."
      ],
      closings: [
        "Ant and Dec's Saturday night takeaway.",
        "No likey, no lighty.",
        "If you are controlling my willy you must stop. Someone has been controlling my willy and making it go nice and hard.",
        "I will ask the grass what it saw.",
        "My willy is being remotely controlled by someone who keeps making it go stiff.",
        "Please remember that I too am one of the main victims of today as there has been someone controlling my willy with a chip implanted in my mind and they make my willy go hard."
      ]
    },
    cliche: {
      feelings: [
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
      feelings: [
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
    }
  };
  
  // Category selection (showing categories instead of actual quotes)
  const categories = ['angry', 'appropriate', 'conspiratorial', 'heartless', 'weird', 'cliche', 'lecherous'];
  
  // Step 1: Feeling category
  const feelingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How are you feeling?'
  );
  
  // Step 2: Subject category
  const subjectCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'What do you want to say about the perpetrators?'
  );
  
  // Step 3: Closing category
  const closingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to conclude?'
  );
  
  // Randomly select quotes from chosen categories
  const feelingIndex = Math.floor(Math.random() * PRESS_QUOTES[feelingCategory].feelings.length);
  const selectedFeeling = PRESS_QUOTES[feelingCategory].feelings[feelingIndex];
  
  const subjectIndex = Math.floor(Math.random() * PRESS_QUOTES[subjectCategory].subjects.length);
  const selectedSubject = PRESS_QUOTES[subjectCategory].subjects[subjectIndex];
  
  const closingIndex = Math.floor(Math.random() * PRESS_QUOTES[closingCategory].closings.length);
  const selectedClosing = PRESS_QUOTES[closingCategory].closings[closingIndex];
  
  // Assemble the quote
  const fullQuote = `"${selectedFeeling}. ${selectedSubject}. ${selectedClosing}."`;
  
  log(`\n📺 Your statement: ${fullQuote}\n`);
  
  // Apply consequences based on tone combinations
  applyPressInterviewConsequences(feelingCategory, subjectCategory, closingCategory, fullQuote);
}

// Apply consequences based on press interview tone
function applyPressInterviewConsequences(feelingTone, subjectTone, closingTone, fullQuote) {
  const tones = [feelingTone, subjectTone, closingTone];
  const angryCount = tones.filter(t => t === 'angry').length;
  const appropriateCount = tones.filter(t => t === 'appropriate').length;
  const conspiratorialCount = tones.filter(t => t === 'conspiratorial').length;
  const heartlessCount = tones.filter(t => t === 'heartless').length;
  const weirdCount = tones.filter(t => t === 'weird').length;
  const clicheCount = tones.filter(t => t === 'cliche').length;
  const lecherousCount = tones.filter(t => t === 'lecherous').length;
  
  // Angry/Appropriate: good for morale
  if (angryCount + appropriateCount >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 8);
    S.reputation = Math.min(100, (S.reputation || 50) + 5);
    log(`📈 Fan morale +8%, Reputation +5% (Strong leadership)`);
  }
  
  // Conspiratorial: good for morale but triggers legal heat
  if (conspiratorialCount >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 6);
    S.legal_risk = (S.legal_risk || 0) + 25;
    S.fa_risk = (S.fa_risk || 0) + 30;
    S.reputation = Math.max(0, (S.reputation || 50) - 15);
    log(`📈 Fan morale +6% (Fans love conspiracy theories)`);
    log(`⚖️ Legal risk +25, FA risk +30, Reputation -15% (Defamation concerns)`);
  }
  
  // Heartless: destroys morale, players quit
  if (heartlessCount >= 2) {
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 20);
    S.reputation = Math.max(0, (S.reputation || 50) - 20);
    log(`📉 Fan morale -20%, Reputation -20% (Heartless response)`);
    
    // Additional player quits
    if (S.squad && S.squad.length > 0) {
      const bestPlayer = S.squad.reduce((best, player) => 
        (player.rating || 0) > (best.rating || 0) ? player : best
      );
      S.squad = S.squad.filter(p => p !== bestPlayer);
      log(`💔 ${bestPlayer.name} quits: "I can't work for someone so callous."`);
      
      // 25% chance second player quits
      if (Math.random() < 0.25 && S.squad.length > 0) {
        const secondBest = S.squad.reduce((best, player) => 
          (player.rating || 0) > (best.rating || 0) ? player : best
        );
        S.squad = S.squad.filter(p => p !== secondBest);
        log(`💔 ${secondBest.name} also walks: "This is disgusting."`);
      }
    }
  }
  
  // Weird: mixed effects
  if (weirdCount >= 2) {
    const moraleChange = Math.random() < 0.5 ? 3 : -3;
    S.fan_morale = Math.max(0, Math.min(100, (S.fan_morale || 50) + moraleChange));
    S.reputation = Math.max(0, (S.reputation || 50) - 5);
    log(`📊 Fan morale ${moraleChange > 0 ? '+' : ''}${moraleChange}% (Confusing response)`);
    log(`📉 Reputation -5% (Sponsors confused)`);
  }
  
  // Cliche: boring but safe
  if (clicheCount >= 2) {
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 2);
    S.reputation = Math.min(100, (S.reputation || 50) + 1);
    log(`📉 Fan morale -2% (Boring response)`);
    log(`📈 Reputation +1% (Safe and predictable)`);
  }
  
  // Lecherous: dangerous for reputation and triggers krazy register
  if (lecherousCount >= 1) {
    S.reputation = Math.max(0, (S.reputation || 50) - 10);
    S.krazy_register = (S.krazy_register || 0) + (lecherousCount * 15);
    log(`📉 Reputation -10% (Inappropriate behavior)`);
    log(`⚠️ Krazy Register +${lecherousCount * 15} (Sexual harassment concerns)`);
    
    // Check if krazy register threshold reached
    if (S.krazy_register >= 100) {
      log(`🚨 KRAZY REGISTER TRIGGERED! You've been flagged for inappropriate behavior.`);
      S.legal_risk = (S.legal_risk || 0) + 50;
      S.fa_risk = (S.fa_risk || 0) + 75;
      log(`⚖️ Legal risk +50, FA risk +75 (Sexual harassment investigation)`);
    }
  }
  
  // Generate news article
  generateStadiumBurnNews(fullQuote);
}

// Generate news article about stadium burn
function generateStadiumBurnNews(quote) {
  const headlines = [
    "STADIUM INFERNO: Southampton Ground Destroyed in Suspicious Fire",
    "CATASTROPHIC BLAZE: St Mary's Stadium Reduced to Ashes",
    "STADIUM FIRE SHOCK: Southampton Forced to Relocate",
    "INFERNO AT ST MARY'S: Investigation Launched Into Stadium Fire",
    "STADIUM DESTROYED: Southampton Manager's Controversial Response"
  ];
  
  const headline = headlines[Math.floor(Math.random() * headlines.length)];
  
  log(`\n📰 FRONT PAGE NEWS: ${headline}`);
  log(`"${quote}" - Southampton Manager`);
  log(`The FA has launched an investigation into the incident.`);
  
  // Store news for ongoing coverage
  if (!S.stadium_burn_news) S.stadium_burn_news = [];
  S.stadium_burn_news.push({
    headline,
    quote,
    date: S.matches_played || 0
  });
}

// ===== LOCKER ROOM CHAT SYSTEM =====

// Locker room chat system - three-part quote system similar to press interviews
async function conductLockerRoomChat() {
  log(`\n🏟️ LOCKER ROOM CHAT: The team gathers around, waiting for your words.`);
  log(`Assemble your message by choosing one option from each category:\n`);
  
  // Quote construction system for locker room
  const LOCKER_ROOM_QUOTES = {
    angry: {
      openings: [
        "Listen up, you useless fucking cunts.",
        "I am absolutely furious with the lot of you, your fucking entitled attitude.",
        "You lot are a fucking disgrace.",
        "I am shaking with fucking rage right now.",
        "I have severe anger issues and I am fucking raging about something right now.",
        "You want to fucking piss me off? Well done, you have succeeded."
      ],
      middles: [
        "You lot need to fucking wake the fuck up.",
        "I'm sick of this complacency. Absolutely fucking sick of it.",
        "You lot think this is a fucking joke don't you? You all fucking laugh about this behind my fucking back don't you? You really want to FUCK with me?",
        "My biggest mistake was expecting anything from you lot. You're all worthless. If you can't make me some money today I will kill you",
        "You're not focused enough.",
        "This cunty attitude won't cut it. You look like you're all obsessing with thoughts of gay sex, it makes me sick. Why would you do that with another man?"
      ],
      closings: [
        "Now get out there and fucking prove me wrong.",
        "I want to see some fucking passion.",
        "Don't you dare let me down again.",
        "Show me you're not complete failures.",
        "I'm watching every single one of you.",
        "This is your last chance."
      ]
    },
    appropriate: {
      openings: [
        "Right lads, we need to have a friendly and inspiring talk.",
        "I know we're all ready for this.",
        "I expect a lot of out you and I know you are all capable.",
        "I can see the determination in your faces. In your eyes. In your bulging muscles",
        "We need to be very focused today.",
        "Let's do this together. Team and chairman. Hands interlinked, bodies entiwned, so to speak"
      ],
      middles: [
        "We need to be at our best today.",
        "Let's focus on our game plan.",
        "We have the quality to win this.",
        "I believe in this group.",
        "We need to stick together.",
        "Let's show our character."
      ],
      closings: [
        "Let's go out there and make a difference.",
        "I know you can do better.",
        "Let's show them what we're made of.",
        "We're in this together.",
        "Let's make the fans proud.",
        "Time to turn this around."
      ]
    },
    conspiratorial: {
      openings: [
        "Something's not right here. Something has gone very wrong",
        "This goes deeper than you think. You know what I mean",
        "There are dark and sinister forces working against us, and against me in particular. I need help.",
        "I've seen this pattern before. Listen carefully",
        "The refs are in on it.",
        "The refs want us to fail."
      ],
      middles: [
        "The FA is out to get us.",
        "The refs are being paid off.",
        "There's a conspiracy against Southampton.",
        "They don't want us to succeed.",
        "The media is against us.",
        "Big clubs are pulling strings."
      ],
      closings: [
        "Don't let them win.",
        "We need to expose the truth.",
        "They want us to fail, but we won't.",
        "The truth will come out.",
        "We're fighting against the system.",
        "Don't trust anyone outside this room."
      ]
    },
    weird: {
      openings: [
        "I can hear the grass whispering.",
        "I have come to believe someone has implanted a microchip in my brain.",
        "Help me. I feel like my bones are melting.",
        "The air tastes metallic. This is not good. Help.",
        "I can hear the floodlights whispering.",
        "The ball will show you the way."
      ],
      middles: [
        "The pitch is angry. It is telling me to kill someone. I am scared.",
        "The goalposts are moving when you're not looking.",
        "I can hear the crowd's thoughts. They are instructing me to kill someone. Help me.",
        "A man is controlling my willy via a chip implanted in my brain and he makes it go from soft to hard.",
        "My willy has just gone hard for no reason as it is being controlled.",
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
    }
  };
  
  // Category selection (showing categories instead of actual quotes)
  const categories = ['angry', 'appropriate', 'conspiratorial', 'weird'];
  
  // Step 1: Opening category
  const openingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to start?'
  );
  
  // Step 2: Middle category
  const middleCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'What do you want to say about the team?'
  );
  
  // Step 3: Closing category
  const closingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to finish?'
  );
  
  // Randomly select quotes from chosen categories
  const openingIndex = Math.floor(Math.random() * LOCKER_ROOM_QUOTES[openingCategory].openings.length);
  const selectedOpening = LOCKER_ROOM_QUOTES[openingCategory].openings[openingIndex];
  
  const middleIndex = Math.floor(Math.random() * LOCKER_ROOM_QUOTES[middleCategory].middles.length);
  const selectedMiddle = LOCKER_ROOM_QUOTES[middleCategory].middles[middleIndex];
  
  const closingIndex = Math.floor(Math.random() * LOCKER_ROOM_QUOTES[closingCategory].closings.length);
  const selectedClosing = LOCKER_ROOM_QUOTES[closingCategory].closings[closingIndex];
  
  // Assemble the quote
  const fullQuote = `"${selectedOpening}. ${selectedMiddle}. ${selectedClosing}."`;
  
  log(`\n🏟️ Your team talk: ${fullQuote}\n`);
  
  // Apply consequences based on tone combinations
  applyLockerRoomChatConsequences(openingCategory, middleCategory, closingCategory, fullQuote);
}

// Apply consequences based on locker room chat tone
function applyLockerRoomChatConsequences(openingTone, middleTone, closingTone, fullQuote) {
  const tones = [openingTone, middleTone, closingTone];
  const angryCount = tones.filter(t => t === 'angry').length;
  const appropriateCount = tones.filter(t => t === 'appropriate').length;
  const conspiratorialCount = tones.filter(t => t === 'conspiratorial').length;
  const weirdCount = tones.filter(t => t === 'weird').length;
  
  // Angry/Appropriate: good for morale
  if (angryCount + appropriateCount >= 2) {
    const moraleBoost = 5 + Math.floor(Math.random() * 6); // 5-10 morale boost
    S.team_morale_boost = (S.team_morale_boost || 0) + moraleBoost;
    log(`📈 Team morale +${moraleBoost} (Strong leadership)`);
  }
  
  // Conspiratorial: mixed effects - good for morale but risky
  if (conspiratorialCount >= 2) {
    const moraleBoost = 3 + Math.floor(Math.random() * 4); // 3-6 morale boost
    S.team_morale_boost = (S.team_morale_boost || 0) + moraleBoost;
    S.fa_risk = (S.fa_risk || 0) + 15;
    S.reputation = Math.max(0, (S.reputation || 50) - 5);
    log(`📈 Team morale +${moraleBoost} (Players love conspiracy theories)`);
    log(`⚖️ FA risk +15, Reputation -5% (Controversial statements)`);
    
    // Generate gossip story about conspiratorial comments
    generateLockerRoomGossip(fullQuote, 'conspiratorial');
  }
  
  // Weird: mixed effects - confusing but sometimes inspiring
  if (weirdCount >= 2) {
    const moraleChange = Math.random() < 0.5 ? 2 : -2;
    S.team_morale_boost = (S.team_morale_boost || 0) + moraleChange;
    S.reputation = Math.max(0, (S.reputation || 50) - 3);
    log(`📊 Team morale ${moraleChange > 0 ? '+' : ''}${moraleChange} (Confusing but memorable)`);
    log(`📉 Reputation -3% (Players confused)`);
    
    // Generate gossip story about weird comments
    generateLockerRoomGossip(fullQuote, 'weird');
  }
  
  // Pure angry: can backfire
  if (angryCount >= 2 && appropriateCount === 0) {
    const moraleChange = Math.random() < 0.3 ? 4 : -3; // 30% chance it works, 70% backfires
    S.team_morale_boost = (S.team_morale_boost || 0) + moraleChange;
    log(`📊 Team morale ${moraleChange > 0 ? '+' : ''}${moraleChange} (${moraleChange > 0 ? 'Anger motivates' : 'Anger demoralizes'})`);
  }
  
  // Pure appropriate: steady positive effect
  if (appropriateCount >= 2 && angryCount === 0) {
    const moraleBoost = 4 + Math.floor(Math.random() * 4); // 4-7 morale boost
    S.team_morale_boost = (S.team_morale_boost || 0) + moraleBoost;
    S.reputation = Math.min(100, (S.reputation || 50) + 2);
    log(`📈 Team morale +${moraleBoost}, Reputation +2% (Professional leadership)`);
  }
}

// Generate gossip story for locker room comments
function generateLockerRoomGossip(quote, type) {
  initPressSystem();
  
  const chairmanName = S.chairman_name || "The Southampton Chairman";
  const stories = {
    conspiratorial: [
      {
        headline: `${chairmanName} Makes Shocking Conspiracy Claims in Dressing Room`,
        body: `In a bizarre locker room rant, ${chairmanName} made explosive claims about referees being "paid off" and the FA being "out to get" the club. The chairman's exact words were: "${quote}" The comments have raised serious questions about the chairman's mental state and could result in disciplinary action.`
      },
      {
        headline: `Chairman's Conspiracy Theories Shock Dressing Room`,
        body: `Southampton players were left stunned after ${chairmanName} delivered a rambling speech about supposed conspiracies against the club. Sources report the chairman said: "${quote}" The bizarre comments have left the dressing room divided and could damage team morale.`
      }
    ],
    weird: [
      {
        headline: `${chairmanName}'s Bizarre Locker Room Speech`,
        body: `${chairmanName} delivered one of the strangest team talks in recent memory, claiming to hear "grass whispering" and "goalposts moving." The chairman's exact words were: "${quote}" Players are reportedly concerned about their chairman's mental wellbeing.`
      },
      {
        headline: `Chairman Claims Stadium is "Alive" in Bizarre Rant`,
        body: `In a truly surreal moment, ${chairmanName} told the players that the stadium was "breathing" and the ball was "trying to tell us something." The full quote was: "${quote}" The comments have left the football world baffled and concerned.`
      }
    ]
  };
  
  const storyTemplates = stories[type] || stories.weird;
  const template = storyTemplates[Math.floor(Math.random() * storyTemplates.length)];
  
  const effects = {
    conspiratorial: { fa_risk: 20, reputation: -8, morale: -5 },
    weird: { reputation: -5, morale: -3 }
  };
  
  const story = createStory(
    'gossip',
    template.headline,
    template.body,
    { quote: quote },
    effects[type] || effects.weird,
    type,
    1,
    ['dressing_room', 'manager_behavior']
  );
  
  queueStory(story);
}

// Opposition locker room chat system - three-part quote system for psychological warfare
async function conductOppositionLockerRoomChat() {
  log(`\n🏟️ OPPOSITION LOCKER ROOM: You sneak in and address their team directly.`);
  log(`Assemble your psychological warfare message by choosing one option from each category:\n`);
  
  // Quote construction system for opposition locker room
  const OPPOSITION_QUOTES = {
    angry: {
      openings: [
        "Listen up, you useless bastards.",
        "I am absolutely furious with your attitude.",
        "You lot are a fucking disgrace.",
        "I am shaking with rage right now.",
        "My blood is boiling watching you lot.",
        "I won't forget this embarrassment."
      ],
      middles: [
        "You lot need to wake the fuck up.",
        "I'm sick of this complacency.",
        "You're not taking this seriously enough.",
        "I expect better from you lot.",
        "You're not focused enough.",
        "This attitude won't cut it."
      ],
      closings: [
        "Now get out there and fucking prove me wrong.",
        "I want to see some fucking passion.",
        "Don't you dare let me down again.",
        "Show me you're not complete failures.",
        "I'm watching every single one of you.",
        "This is your last chance."
      ]
    },
    appropriate: {
      openings: [
        "Right lads, we need to talk.",
        "I know you're all ready for this.",
        "This is the standard we expect.",
        "I can see the determination in your faces.",
        "We need to be focused today.",
        "Let's do this together."
      ],
      middles: [
        "You need to be at your best today.",
        "Let's focus on the game plan.",
        "You have the quality to win this.",
        "I believe in this group.",
        "You need to stick together.",
        "Let's show your character."
      ],
      closings: [
        "Let's go out there and make a difference.",
        "I know you can do better.",
        "Let's show them what you're made of.",
        "You're in this together.",
        "Let's make the fans proud.",
        "Time to turn this around."
      ]
    },
    conspiratorial: {
      openings: [
        "Something's not right here.",
        "This goes deeper than you think.",
        "There are forces working against us.",
        "I've seen this pattern before.",
        "The refs are in on it.",
        "They want us to fail."
      ],
      middles: [
        "The FA is out to get you.",
        "The refs are being paid off.",
        "There's a conspiracy against your club.",
        "They don't want you to succeed.",
        "The media is against you.",
        "Big clubs are pulling strings."
      ],
      closings: [
        "Don't let them win.",
        "You need to expose the truth.",
        "They want you to fail, but you won't.",
        "The truth will come out.",
        "You're fighting against the system.",
        "Don't trust anyone outside this room."
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
      middles: [
        "The pitch is alive and angry.",
        "The goalposts are moving when you're not looking.",
        "I can hear the crowd's thoughts.",
        "The ball is trying to tell us something.",
        "The stadium is breathing.",
        "I can see the future in the grass patterns."
      ],
      closings: [
        "The moon will guide you to victory.",
        "Listen to what the grass is telling you.",
        "The goalposts will open for you.",
        "I can hear the future calling.",
        "The stadium spirits are on your side.",
        "Trust in the cosmic football energy."
      ]
    }
  };
  
  // Category selection (showing categories instead of actual quotes)
  const categories = ['angry', 'appropriate', 'conspiratorial', 'weird'];
  
  // Step 1: Opening category
  const openingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to start your psychological attack?'
  );
  
  // Step 2: Middle category
  const middleCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'What do you want to say to mess with their heads?'
  );
  
  // Step 3: Closing category
  const closingCategory = await choose(
    categories.map(cat => ({key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
    'How do you want to finish your mind games?'
  );
  
  // Randomly select quotes from chosen categories
  const openingIndex = Math.floor(Math.random() * OPPOSITION_QUOTES[openingCategory].openings.length);
  const selectedOpening = OPPOSITION_QUOTES[openingCategory].openings[openingIndex];
  
  const middleIndex = Math.floor(Math.random() * OPPOSITION_QUOTES[middleCategory].middles.length);
  const selectedMiddle = OPPOSITION_QUOTES[middleCategory].middles[middleIndex];
  
  const closingIndex = Math.floor(Math.random() * OPPOSITION_QUOTES[closingCategory].closings.length);
  const selectedClosing = OPPOSITION_QUOTES[closingCategory].closings[closingIndex];
  
  // Assemble the quote
  const fullQuote = `"${selectedOpening}. ${selectedMiddle}. ${selectedClosing}."`;
  
  log(`\n🏟️ Your psychological warfare: ${fullQuote}\n`);
  
  // Track psychological warfare usage for manager dialogue
  S._psychological_warfare_count = (S._psychological_warfare_count || 0) + 1;
  S._opposition_team_talks = (S._opposition_team_talks || 0) + 1;
  
  // Apply consequences based on tone combinations
  applyOppositionLockerRoomChatConsequences(openingCategory, middleCategory, closingCategory, fullQuote);
}

// Apply consequences based on opposition locker room chat tone
function applyOppositionLockerRoomChatConsequences(openingTone, middleTone, closingTone, fullQuote) {
  const tones = [openingTone, middleTone, closingTone];
  const angryCount = tones.filter(t => t === 'angry').length;
  const appropriateCount = tones.filter(t => t === 'appropriate').length;
  const conspiratorialCount = tones.filter(t => t === 'conspiratorial').length;
  const weirdCount = tones.filter(t => t === 'weird').length;
  
  // Angry: demoralizes opponents but increases risk
  if (angryCount >= 2) {
    const moraleDamage = 4 + Math.floor(Math.random() * 4); // 4-7 morale damage
    S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - moraleDamage);
    S.police_risk = (S.police_risk || 0) + 10;
    S.fa_risk = (S.fa_risk || 0) + 5;
    log(`📉 Opponent morale -${moraleDamage} (Intimidation tactics)`);
    log(`⚖️ Police risk +10, FA risk +5 (Aggressive behavior)`);
  }
  
  // Appropriate: confuses opponents (they don't expect nice words from enemy manager)
  if (appropriateCount >= 2) {
    const moraleChange = Math.random() < 0.3 ? -3 : 2; // 30% chance it confuses them, 70% chance it backfires
    S.morale_opponent = Math.max(0, Math.min(100, (S.morale_opponent || 70) + moraleChange));
    log(`📊 Opponent morale ${moraleChange > 0 ? '+' : ''}${moraleChange} (${moraleChange < 0 ? 'Confusing kindness' : 'Backfires - they\'re motivated'})`);
  }
  
  // Conspiratorial: creates paranoia and division
  if (conspiratorialCount >= 2) {
    const moraleDamage = 3 + Math.floor(Math.random() * 3); // 3-5 morale damage
    S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - moraleDamage);
    S.fa_risk = (S.fa_risk || 0) + 15;
    S.reputation = Math.max(0, (S.reputation || 50) - 5);
    log(`📉 Opponent morale -${moraleDamage} (Paranoia and division)`);
    log(`⚖️ FA risk +15, Reputation -5% (Controversial psychological warfare)`);
    
    // Generate gossip story about conspiratorial comments
    generateOppositionLockerRoomGossip(fullQuote, 'conspiratorial');
  }
  
  // Weird: confuses and unsettles opponents
  if (weirdCount >= 2) {
    const moraleDamage = 2 + Math.floor(Math.random() * 3); // 2-4 morale damage
    S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - moraleDamage);
    S.reputation = Math.max(0, (S.reputation || 50) - 3);
    log(`📉 Opponent morale -${moraleDamage} (Bizarre psychological warfare)`);
    log(`📉 Reputation -3% (Unsettling behavior)`);
    
    // Generate gossip story about weird comments
    generateOppositionLockerRoomGossip(fullQuote, 'weird');
  }
  
  // Mixed approach: moderate effectiveness
  if (angryCount === 1 && appropriateCount === 1) {
    const moraleDamage = 2 + Math.floor(Math.random() * 2); // 2-3 morale damage
    S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - moraleDamage);
    S.police_risk = (S.police_risk || 0) + 5;
    log(`📉 Opponent morale -${moraleDamage} (Mixed psychological approach)`);
    log(`⚖️ Police risk +5 (Suspicious behavior)`);
  }
}

// Generate gossip story for opposition locker room comments
function generateOppositionLockerRoomGossip(quote, type) {
  initPressSystem();
  
  const chairmanName = S.chairman_name || "The Southampton Chairman";
  const stories = {
    conspiratorial: [
      {
        headline: `${chairmanName} Caught Making Conspiracy Claims in Opposition Dressing Room`,
        body: `In a shocking incident, ${chairmanName} was caught sneaking into the opposition dressing room and making explosive conspiracy claims. The chairman's exact words were: "${quote}" The bizarre behavior has raised serious questions about the chairman's mental state and could result in severe disciplinary action.`
      },
      {
        headline: `Chairman's Bizarre Dressing Room Invasion Shocks Football World`,
        body: `${chairmanName} has been caught making rambling conspiracy theories while illegally entering the opposition dressing room. Sources report the chairman said: "${quote}" The incident has left the football world stunned and could lead to criminal charges.`
      }
    ],
    weird: [
      {
        headline: `${chairmanName}'s Bizarre Opposition Dressing Room Speech`,
        body: `${chairmanName} delivered one of the strangest speeches in football history after being caught in the opposition dressing room, claiming to hear "grass whispering" and "goalposts moving." The chairman's exact words were: "${quote}" The incident has raised serious concerns about the chairman's mental wellbeing.`
      },
      {
        headline: `Chairman Claims Stadium is "Alive" During Illegal Dressing Room Visit`,
        body: `In a truly surreal incident, ${chairmanName} was caught telling opposition players that the stadium was "breathing" and the ball was "trying to tell us something" during an illegal visit to their dressing room. The full quote was: "${quote}" The bizarre behavior has left authorities considering criminal charges.`
      }
    ]
  };
  
  const storyTemplates = stories[type] || stories.weird;
  const template = storyTemplates[Math.floor(Math.random() * storyTemplates.length)];
  
  const effects = {
    conspiratorial: { fa_risk: 25, police_risk: 15, reputation: -10, morale: -5 },
    weird: { fa_risk: 20, police_risk: 10, reputation: -8, morale: -3 }
  };
  
  const story = createStory(
    'gossip',
    template.headline,
    template.body,
    { quote: quote },
    effects[type] || effects.weird,
    type,
    1,
    ['dressing_room', 'manager_behavior', 'illegal_activity']
  );
  
  queueStory(story);
}

// Generate gossip story for opposition encouragement (bizarre chairman behavior)
function generateOppositionEncouragementGossip(moraleBoost) {
  initPressSystem();
  
  const chairmanName = S.chairman_name || "The Southampton Chairman";
  const stories = [
    {
      headline: `${chairmanName} Caught Giving Pep Talk to Opposition Players`,
      body: `In a bizarre incident, ${chairmanName} was caught sneaking into the opposition dressing room and giving an encouraging pep talk to rival players. Sources report the chairman told the opposition team they "have the quality to win this" and urged them to "make the fans proud." The strange behavior has left the football world confused and questioning the chairman's mental state.`
    },
    {
      headline: `Chairman's Bizarre Opposition Dressing Room Visit Shocks Football`,
      body: `${chairmanName} has been caught illegally entering the opposition dressing room to deliver an inspirational speech to rival players. The chairman reportedly told the opposition they "need to be at their best" and encouraged them to "show their character." The incident has raised serious questions about the chairman's judgment and could result in disciplinary action.`
    },
    {
      headline: `Southampton Chairman Gives Rival Team Motivational Speech`,
      body: `In one of the strangest incidents in football history, ${chairmanName} was caught giving a motivational speech to the opposition team in their own dressing room. The chairman reportedly told rival players they "believe in this group" and urged them to "stick together." The bizarre behavior has left authorities considering whether the chairman should face criminal charges for trespassing.`
    }
  ];
  
  const template = stories[Math.floor(Math.random() * stories.length)];
  
  const effects = {
    fa_risk: 15,
    police_risk: 10,
    reputation: -8,
    morale: -3
  };
  
  const story = createStory(
    'gossip',
    template.headline,
    template.body,
    { morale_boost: moraleBoost },
    effects,
    'bizarre_encouragement',
    1,
    ['dressing_room', 'chairman_behavior', 'illegal_activity', 'bizarre_conduct']
  );
  
  queueStory(story);
}

// ===== FUNDRAISER AND REBUILD SYSTEM =====

// Show fundraiser option in pre-match
async function maybeShowFundraiser() {
  if (!S.stadium_burned || S.fundraiser_completed) return;
  
  // Show fundraiser option in pre-match menu
  const choices = [
    { key: 'fundraiser', label: '🏗️ Build New Stadium (Fundraiser)' },
    { key: 'skip', label: 'Skip for now' }
  ];
  
  const choice = await choose(choices, 'The board demands action: "We need a new stadium immediately!"');
  
  if (choice === 'fundraiser') {
    await conductFundraiser();
  }
}

// Conduct fundraiser
async function conductFundraiser() {
  const basePayout = 20000000; // £20M for St Mary's 2
  
  log(`\n🎯 FUNDRAISER MATCH: Community rallies to help rebuild!`);
  log(`The fundraiser generates £${basePayout.toLocaleString()} in donations.`);
  
  // Add fundraiser payout
  S.chairman_cash += basePayout;
  S.fan_morale = Math.min(100, (S.fan_morale || 50) + 5);
  
  log(`💰 Fundraiser proceeds: £${basePayout.toLocaleString()}`);
  log(`📈 Fan morale +5% (Community support)`);
  
  // Present rebuild options
  const choices = [
    { key: 'honest', label: `Use funds properly (Start legitimate stadium project - £${Math.floor(basePayout * 0.8).toLocaleString()})` },
    { key: 'embezzle', label: `Redirect to personal account (Use your own construction company - £${basePayout.toLocaleString()})` },
    { key: 'split', label: `Split funds (Partial siphon, partial proper build - £${Math.floor(basePayout * 0.6).toLocaleString()})` }
  ];
  
  const choice = await choose(choices, 'How do you want to use the fundraiser money?');
  
  if (choice === 'honest') {
    startHonestStadiumRebuild(basePayout);
  } else if (choice === 'embezzle') {
    startEmbezzledStadiumRebuild(basePayout);
  } else {
    startSplitStadiumRebuild(basePayout);
  }
  
  S.fundraiser_completed = true;
}

// Start honest stadium rebuild
function startHonestStadiumRebuild(fundraiserAmount) {
  const cost = Math.floor(fundraiserAmount * 0.8);
  S.chairman_cash -= cost;
  
  // Start proper stadium construction
  S.stadium.active_project = {
    type: 'world_class_rebuild',
    capacity_gain: 100000,
    quality_gain: 40,
    duration: 16 + Math.floor(Math.random() * 5), // 16-20 matches
    cost: cost,
    honest: true
  };
  
  S.stadium.construction_progress = 0;
  S.stadium.construction_delays = 0;
  S.stadium.construction_overrun = 0;
  
  log(`🏗️ Honest stadium construction begins!`);
  log(`💰 Construction cost: £${cost.toLocaleString()}`);
  log(`⏱️ Estimated completion: ${S.stadium.active_project.duration} matches`);
  log(`📈 Morale and sponsors will recover over time.`);
}

// Start embezzled stadium rebuild
function startEmbezzledStadiumRebuild(fundraiserAmount) {
  // Keep all the money
  log(`💰 £${fundraiserAmount.toLocaleString()} redirected to personal account.`);
  
  // Start shoddy construction for St Mary's 2
  S.stadium.active_project = {
    type: 'st_marys_2',
    name: 'St Mary\'s 2',
    capacity_gain: 32000, // Same size as original St Mary's
    quality_gain: 20, // Lower quality
    duration: 12 + Math.floor(Math.random() * 3), // 12-14 matches (faster but shoddy)
    cost: Math.floor(fundraiserAmount * 0.3), // Much cheaper
    honest: false,
    collapse_risk: 0.5, // 50% collapse risk
    upkeep_multiplier: 1.5 // Reasonable upkeep increase for new stadium
  };
  
  S.stadium.construction_progress = 0;
  S.stadium.construction_delays = 0;
  S.stadium.construction_overrun = 0;
  
  log(`🏗️ "Construction" begins with your own company...`);
  log(`💰 Construction cost: £${S.stadium.active_project.cost.toLocaleString()}`);
  log(`⏱️ Estimated completion: ${S.stadium.active_project.duration} matches`);
  log(`⚠️ WARNING: Shoddy construction has collapse risk!`);
}

// Start split stadium rebuild
function startSplitStadiumRebuild(fundraiserAmount) {
  const siphonAmount = Math.floor(fundraiserAmount * 0.4);
  const constructionAmount = Math.floor(fundraiserAmount * 0.6);
  
  S.chairman_cash -= constructionAmount;
  
  // Start mixed construction
  S.stadium.active_project = {
    type: 'world_class_rebuild',
    capacity_gain: 100000,
    quality_gain: 30, // Medium quality
    duration: 14 + Math.floor(Math.random() * 4), // 14-17 matches
    cost: constructionAmount,
    honest: 'mixed',
    collapse_risk: 0.2 // 20% collapse risk
  };
  
  S.stadium.construction_progress = 0;
  S.stadium.construction_delays = 0;
  S.stadium.construction_overrun = 0;
  
  log(`💰 £${siphonAmount.toLocaleString()} siphoned to personal account.`);
  log(`🏗️ Mixed construction begins...`);
  log(`💰 Construction cost: £${constructionAmount.toLocaleString()}`);
  log(`⏱️ Estimated completion: ${S.stadium.active_project.duration} matches`);
  log(`⚠️ Moderate collapse risk due to corner-cutting.`);
}

// Check for stadium collapse
function checkStadiumCollapse() {
  if (!S.stadium.active_project || S.stadium.active_project.honest === true) return;
  
  const project = S.stadium.active_project;
  const collapseRisk = project.collapse_risk || 0;
  
  // Check collapse risk within 5 matches of completion
  const matchesSinceStart = (S.matches_played || 0) - (project.start_match || 0);
  const nearCompletion = matchesSinceStart >= project.duration - 5;
  
  if (nearCompletion && Math.random() < collapseRisk) {
    triggerStadiumCollapse();
  }
}

// Trigger stadium collapse
function triggerStadiumCollapse() {
  const project = S.stadium.active_project;
  
  log(`\n💥 CATASTROPHE: The new stadium collapses mid-game!`);
  log(`🏗️ Shoddy construction fails spectacularly!`);
  
  // Revert to Eastleigh
  S.stadium.relocated_to_eastleigh = true;
  S.stadium.capacity = 0;
  S.stadium.state = 'destroyed';
  
  // Massive consequences
  S.fan_morale = Math.max(0, (S.fan_morale || 50) - 40);
  S.reputation = Math.max(0, (S.reputation || 50) - 30);
  S.legal_risk = (S.legal_risk || 0) + 20;
  S.fa_risk = (S.fa_risk || 0) + 25;
  
  // Sponsors flee
  log(`📉 Fan morale -40%, Reputation -30%`);
  log(`⚖️ Legal risk +20, FA risk +25`);
  log(`💸 Sponsors flee: "Everyone is sick of this happening to Southampton."`);
  log(`🏠 Forced back to Eastleigh F.C.`);
  
  // No more fundraisers allowed
  S.fundraiser_completed = true;
  S.no_more_fundraisers = true;
  
  // Clear construction project
  S.stadium.active_project = null;
  S.stadium.construction_progress = 0;
}

// Hook fundraiser into pre-match
async function maybeShowFundraiserInPreMatch() {
  if (S.stadium_burned && !S.fundraiser_completed && !S.no_more_fundraisers) {
    await maybeShowFundraiser();
  }
}

// Ensure stadium dealing state persists across seasons
function ensureStadiumDealingPersistence() {
  // If stadium dealing was unlocked but we're in a new season, preserve the state
  if (S.stadium_dealing_unlocked && S.cocaine_purchase_matches_ago === 999) {
    // Reset the counter but keep the system unlocked
    S.cocaine_purchase_matches_ago = 0;
    S.marco_approach_attempted = false;
    log("The stadium dealing system remains active from your previous activities...");
  }
  
  // Ensure all stadium dealing state variables exist (but preserve existing values)
  if (typeof S.stadium_dealing_unlocked !== 'boolean') S.stadium_dealing_unlocked = false;
  if (typeof S.stadium_dealing_approach_chance !== 'number') S.stadium_dealing_approach_chance = 15;
  if (typeof S.stadium_dealing_total_allows !== 'number') S.stadium_dealing_total_allows = 0;
  if (typeof S.stadium_dealing_consecutive_allows !== 'number') S.stadium_dealing_consecutive_allows = 0;
  // Preserve visit counter across seasons - only initialize if it doesn't exist
  if (typeof S.stadium_dealing_total_visits !== 'number') S.stadium_dealing_total_visits = 0;
  if (typeof S.stadium_dealing_warning_shown !== 'boolean') S.stadium_dealing_warning_shown = false;
  if (typeof S.stadium_burned !== 'boolean') S.stadium_burned = false;
  if (typeof S.stadium_dealing_negotiated !== 'boolean') S.stadium_dealing_negotiated = false;
  if (typeof S.stadium_dealing_last_decision !== 'string') S.stadium_dealing_last_decision = '';
  if (typeof S.stadium_dealing_heat_level !== 'number') S.stadium_dealing_heat_level = 0;
  if (typeof S.press_interview_queued !== 'boolean') S.press_interview_queued = false;
  if (typeof S.fundraiser_completed !== 'boolean') S.fundraiser_completed = false;
  if (typeof S.no_more_fundraisers !== 'boolean') S.no_more_fundraisers = false;
  if (typeof S.locker_room_quote_system !== 'boolean') S.locker_room_quote_system = true;
  if (typeof S.cocaine_purchase_matches_ago !== 'number') S.cocaine_purchase_matches_ago = 999;
  if (typeof S.marco_approach_attempted !== 'boolean') S.marco_approach_attempted = false;
  
  // Initialize phone system to ensure contacts (including Marco) are available
  if (typeof window.initPhoneSystem === 'function') {
    window.initPhoneSystem();
  }
}
