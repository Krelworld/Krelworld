// ========== MUSLIM MALCOLM - POINTS 4 PRIZES HANDLER ==========
async function handleMuslimMalcolmPoints4Prizes() {
  // Ensure inventory exists
  if (!S.inventory) S.inventory = { accolades: [], drugs: 0 };
  if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
  
  // Check if player has any trophies
  const availableTrophies = S.inventory.accolades.filter(t => t && t.name);
  
  if (availableTrophies.length === 0) {
    log(`There's a knock at the door...`);
    log(``);
    log(`You open it to find a man standing there.`);
    log(`"Hello, I'm Muslim Malcolm," he says. "I'm here about Points 4 Prizes."`);
    log(`"You can trade your trophies for league points. But I see you don't have any trophies right now."`);
    log(`"Come back when you've got something to trade."`);
    log(``);
    log(`He leaves.`);
    return;
  }
  
  log(`There's a knock at the door...`);
  log(``);
  log(`You open it to find a man standing there.`);
  log(`"Hello, I'm Muslim Malcolm," he says with a smile. "I'm here about Points 4 Prizes."`);
  log(`"You can trade any of your trophies for league points. The points are added to your current league total immediately."`);
  log(`"You can sell more than one trophy in a single visit. What would you like to trade?"`);
  log(``);
  
  // Function to calculate points from trophy value
  // Conversion: 1 point per 50,000 in trophy value (rounded up)
  const calculatePointsFromTrophy = (trophy) => {
    const value = Number(trophy.value || 0);
    return Math.max(1, Math.ceil(value / 50000));
  };
  
  // Allow multiple trades in one visit
  let totalPointsGained = 0;
  let tradesCompleted = false;
  
  while (!tradesCompleted && availableTrophies.length > 0) {
    // Refresh available trophies (in case some were already traded)
    const currentTrophies = S.inventory.accolades.filter(t => t && t.name);
    
    if (currentTrophies.length === 0) {
      break;
    }
    
    // Build list of trophies with their point values
    // Use trophy name and index for unique key
    const trophyOptions = currentTrophies.map((trophy, idx) => {
      const pointsValue = calculatePointsFromTrophy(trophy);
      const trophyName = trophy.name || 'Unnamed Trophy';
      // Create a stable key using name and current index
      return {
        key: `trophy_${idx}_${trophyName.replace(/\s+/g, '_')}`,
        label: `${trophyName} (${pointsValue} points)`,
        trophy: trophy,
        points: pointsValue
      };
    });
    
    // Add option to finish trading
    trophyOptions.push({
      key: 'done',
      label: 'Done trading'
    });
    
    const choice = await choose(trophyOptions, 'Points 4 Prizes - Select a trophy to trade:');
    
    if (choice === 'done') {
      tradesCompleted = true;
      break;
    }
    
    // Find the selected trophy
    const selected = trophyOptions.find(opt => opt.key === choice);
    if (selected && selected.trophy) {
      const trophyName = selected.trophy.name || 'Trophy';
      const pointsValue = selected.points;
      
      // Remove trophy from inventory (find by reference to avoid index issues)
      const trophyIndex = S.inventory.accolades.findIndex(t => t === selected.trophy);
      if (trophyIndex !== -1) {
        S.inventory.accolades.splice(trophyIndex, 1);
      }
      
      // Add points to league total
      adjustClubPoints(pointsValue);
      totalPointsGained += pointsValue;
      
      log(`You trade "${trophyName}" to Muslim Malcolm for ${pointsValue} league points.`);
      log(`Your league points are now ${S.points}.`);
      log(``);
      
      // Update HUD
      if (typeof updateHUD === 'function') {
        updateHUD();
      }
      
      // Refresh available trophies for next iteration
      availableTrophies.length = 0;
      availableTrophies.push(...S.inventory.accolades.filter(t => t && t.name));
    }
  }
  
  if (totalPointsGained > 0) {
    log(`Muslim Malcolm smiles. "Pleasure doing business with you. I've added ${totalPointsGained} league points to your total."`);
  } else {
    log(`Muslim Malcolm looks disappointed. "No trades today? Very well. I'll be back next season."`);
  }
  
  log(`He leaves.`);
}

async function openKnockDoor(){
  // Season 5: mandatory press conference after massacre & kidnapping (intended for Match 2)
  // This is a fallback trigger - main triggers are in postMatchPhase and eveningPhase
  // MUST check BEFORE early return to ensure it can trigger even if visitors_handled is true
  if (S.season === 5 && S.season5 && S.matches_played === 1 && S.season5.kidnapping_sequence_shown && !S.season5.kidnapping_press_done) {
    if (typeof window.conductKidnappingPressConference === 'function') {
      await window.conductKidnappingPressConference();
    } else if (typeof conductKidnappingPressConference === 'function') {
      await conductKidnappingPressConference();
    } else {
      console.warn('conductKidnappingPressConference function not found');
    }
    S.season5.kidnapping_press_done = true;
    // Do not mark visitors_handled here; normal visitors may still follow
  }

  // ========== MUSLIM MALCOLM - POINTS 4 PRIZES (SEASONS 4 & 5) ==========
  // Once per season in seasons 4 and 5, Muslim Malcolm visits via knockdoor
  // NOTE: This is now a fallback - the main trigger is in preMatchPhase() for automatic visits
  // MUST check BEFORE early return to ensure it can trigger even if visitors_handled is true
  if ((S.season === 4 || S.season === 5) && S.matches_played > 0) {
    const seasonKey = S.season === 4 ? 'season4' : 'season5';
    const seasonData = S[seasonKey];
    
    // Skip if already visited this season OR if visit is already scheduled for this match (handled in preMatchPhase)
    if (seasonData && !seasonData.muslim_malcolm_visited && !(S.preMatch && S.preMatch.muslim_malcolm_visiting)) {
      const matchesPlayed = S.matches_played || 0;
      const seasonMatches = S.season_matches || 16;
      const seasonProgress = matchesPlayed / seasonMatches;
      
      // Check if FA executive (points seller) already visited this season - if so, no conflict
      let faExecutiveAlreadyVisited = false;
      if (S.fa_executive_scam) {
        const currentSeason = S.season || 1;
        if (currentSeason >= 4 && currentSeason <= 5) {
          // Check if FA executive already triggered this season
          if (S.fa_executive_scam.working_version_triggered_seasons && 
              S.fa_executive_scam.working_version_triggered_seasons.includes(currentSeason)) {
            faExecutiveAlreadyVisited = true; // Already happened, no conflict possible
          }
        }
      }
      
      // Guarantee visit by match 6 (37.5% of season) if it hasn't happened yet
      // This ensures at least 1 visit per season as required
      const guaranteedMatch = 6;
      let shouldTrigger = false;
      
      if (matchesPlayed >= guaranteedMatch) {
        // MUST visit by match 6 if not visited yet (100% guarantee)
        // Only skip if FA executive is definitely visiting this exact match
        // Since FA executive is random, we'll let Malcolm visit and skip FA executive if both would trigger
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
        seasonData.muslim_malcolm_visited = true;
        // Mark that we're visiting this match to prevent FA executive from also visiting
        if (!S.preMatch) S.preMatch = {};
        S.preMatch.muslim_malcolm_visiting = true;
        await handleMuslimMalcolmPoints4Prizes();
        S.visitors_handled = true;
        return;
      } else {
      }
    } else {
      if (!seasonData) {
      } else if (seasonData.muslim_malcolm_visited) {
      }
    }
  } else {
    if (S.season !== 4 && S.season !== 5) {
    } else if (S.matches_played <= 0) {
    }
  }

  // Early return if visitors have already been handled (prevents infinite loops after events like dating minigame)
  // BUT only after checking for mandatory events above (press conference, Mohammed Malcolm)
  if (S.visitors_handled) {
    return;
  }

// --- Consume queued visitors first (unrest / investigation) ---
if (Array.isArray(S.knock_queue) && S.knock_queue.length){
  while (S.knock_queue.length){
    const v = S.knock_queue.shift();
    if (v.type === 'unrest')       { await handleUnrestVisitor(); }
    else if (v.type === 'investigation'){
      await window.presentInvestigation(v);
    }
    else if (v.type === 'manager_confrontation'){
      await handlePlayerDefamationConfrontation(v);
    }
    else if (v.type === 'unpaid_transfer_agent'){
      await handleUnpaidTransferAgent(v);
    }
    else if (v.type === 'gascoigne_estate'){
      await handleGascoigneEstateExecutor();
    }
  }
  // After queued visitors, allow legacy random visitors (bribes, etc.) to run below.
}

  // Season 5 Match 2: Mohammed Van Onslaught press conference visitor
  if (S.season === 5 && S.matches_played === 1 && (!S.season5 || !S.season5.van_onslaught_press_conference_shown)) {
    if (!S.season5) S.season5 = {};
    S.season5.van_onslaught_press_conference_shown = true;
    
    log(`There's a knock at the door...`);
    log(``);
    log(`You open it to find a messenger standing there.`);
    log(`"Mohammed Van Onslaught is currently holding a press conference," the messenger says. "You should watch this."`);
    log(``);
    
    const videoUrl = 'https://www.dropbox.com/scl/fi/1jrhs2o25ynt4m88hg5k6/conference-ai.mp4?rlkey=3q28dvzgm28lg2ubywx4bk6oy&st=x5m8cz7d&dl=1';
    
    // Show the video immediately (mandatory to watch)
    const videoDiv = document.createElement('div');
    videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
    
    // Wait for video to be closed or finished
    await new Promise((resolve) => {
      let promiseResolved = false;
      const safeResolve = () => {
        if (promiseResolved) {
          console.warn('DEBUG VAN ONSLAUGHT: Promise already resolved, ignoring');
          return;
        }
        promiseResolved = true;
        resolve();
      };
      
      // Create close handler function
      const closeHandler = () => {
        videoDiv.remove();
        safeResolve();
      };
      
      // Add prominent X button in top-right corner
      const xButton = document.createElement('button');
      xButton.innerHTML = '✕';
      xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 10001; display: flex; align-items: center; justify-content: center; line-height: 1;';
      xButton.onclick = closeHandler;
      xButton.title = 'Close';
      
      videoDiv.innerHTML = `<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 Mohammed Van Onslaught Press Conference</div><video id="vanOnslaughtPressVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
      videoDiv.appendChild(xButton);
      document.body.appendChild(videoDiv);
      
      // Wait for video to be closed or finished
      const video = document.getElementById('vanOnslaughtPressVideo');
      const finalCloseHandler = () => {
        closeHandler();
      };
      
      // Update X button to use final handler
      xButton.onclick = finalCloseHandler;
      
      // Also resolve when video ends
      if (video) {
        video.addEventListener('ended', finalCloseHandler);
        // Try to play the video
        video.play().catch(err => {
          console.warn('DEBUG VAN ONSLAUGHT: Autoplay prevented, user will need to click play:', err);
        });
      } else {
        console.error('DEBUG VAN ONSLAUGHT: ERROR - video element not found after creation!');
        // Fallback: resolve after a short delay if video element not found
        setTimeout(() => {
          safeResolve();
        }, 1000);
      }
    });
    
    log(`The messenger leaves.`);
    
    // Present options to continue after watching the press conference
    try {
      const choice = await choose([
        { key: 'continue', label: 'Continue' }
      ], 'The messenger has left.');
    } catch (error) {
      console.error('DEBUG VAN ONSLAUGHT: ERROR in choose() call:', error);
      throw error;
    }
    
    // Don't mark visitors_handled here - allow other visitors to continue
  }

  // Check for women's team manager demand (Season 1+, 2x per season)
  if (shouldTriggerWomensManagerDemand()) {
    await handleWomensTeamManagerDemand();
    S.visitors_handled = true;
    return;
  }

  // Check for private investigator lore videos (random, before cronster confrontation)
  if (S.cronster && S.cronster.active && !S.cronster.booby_trap_climax_triggered && !S.cronster.defeated && S.season >= 2) {
    // Initialize lore videos tracking if needed
    if (!S.cronster.lore_videos) {
      S.cronster.lore_videos = {
        origin_shown: false,
        interview_shown: false
      };
    }
    
    // Random chance to show a lore video (if not already shown)
    const shouldShowLore = Math.random() < 0.25; // 25% chance per door knock
    
    if (shouldShowLore) {
      // Determine which video to show (if both available, pick randomly)
      const availableVideos = [];
      if (!S.cronster.lore_videos.origin_shown) {
        availableVideos.push('origin');
      }
      if (!S.cronster.lore_videos.interview_shown) {
        availableVideos.push('interview');
      }
      
      if (availableVideos.length > 0) {
        const videoToShow = availableVideos[Math.floor(Math.random() * availableVideos.length)];
        
        log(`There's a knock at the door...`);
        log(``);
        log(`You open it to find a private investigator standing there.`);
        log(`"I've been looking into this Cronster character," he says. "I think you should see this."`);
        log(``);
        
        let videoUrl = '';
        let videoTitle = '';
        
        if (videoToShow === 'origin') {
          videoUrl = 'https://www.dropbox.com/scl/fi/wyqkxtj0e3xpbgn993klp/Video-12-27-25-4-41-56-pm.mp4?rlkey=s4551uqb087n7aq2joawu4d7w&st=tk7n2xt4&dl=1';
          videoTitle = 'Origin Story';
        } else if (videoToShow === 'interview') {
          videoUrl = 'https://www.dropbox.com/scl/fi/bbh4j4e565i76i7p2ypln/Video-12-27-25-4-24-16-pm.mp4?rlkey=oa27supjcpr7qpu26a1xptley&st=194ro82n&dl=1';
          videoTitle = '1960s TV Interview';
        }
        
        // Give user choice to watch or not
        const watchChoice = await choose([
          { key: 'watch', label: 'Watch the video' },
          { key: 'decline', label: 'Decline' }
        ], `Private Investigator Evidence: ${videoTitle}`);
        
        if (watchChoice === 'decline') {
          log(`You decline to watch the video. The private investigator leaves.`);
          S.visitors_handled = true;
          return;
        }
        
        // Show the video (no autoplay - user must click play)
        const videoDiv = document.createElement('div');
        videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
        
        // Create close handler function
        const closeHandler = () => {
          videoDiv.remove();
        };
        
        // Add prominent X button in top-right corner
        const xButton = document.createElement('button');
        xButton.innerHTML = '✕';
        xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 10001; display: flex; align-items: center; justify-content: center; line-height: 1;';
        xButton.onclick = closeHandler;
        xButton.title = 'Close';
        
        videoDiv.innerHTML = `<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 ${videoTitle}</div><video id="loreVideo" controls style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="${videoUrl}" type="video/quicktime"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
        videoDiv.appendChild(xButton);
        document.body.appendChild(videoDiv);
        
        // Mark video as shown
        if (videoToShow === 'origin') {
          S.cronster.lore_videos.origin_shown = true;
        } else if (videoToShow === 'interview') {
          S.cronster.lore_videos.interview_shown = true;
        }
        
        // Wait for video to be closed or finished
        await new Promise((resolve) => {
          const video = document.getElementById('loreVideo');
          const finalCloseHandler = () => {
            closeHandler();
            resolve();
          };
          
          // Update X button to use final handler
          xButton.onclick = finalCloseHandler;
          
          // Also resolve when video ends
          if (video) {
            video.addEventListener('ended', finalCloseHandler);
          }
        });
        
        log(`The private investigator leaves.`);
        S.visitors_handled = true;
        return;
      }
    }
  }

  // Check for final confrontation with Kuddle Cronster (back half of season 2+)
  // This should happen inevitably - doesn't require booby trap to be set
  if (S.cronster && S.cronster.active && !S.cronster.booby_trap_climax_triggered && !S.cronster.defeated && S.season >= 2) {
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    const isLatterHalf = matchesPlayed >= Math.floor(seasonMatches / 2);
    
    // Check if we have enough events OR if we're well into the latter half (guaranteed trigger)
    const hasEnoughEvents = (S.cronster.sightings_count >= 3) || 
                           (S.cronster.juice_incident) || 
                           (S.cronster.cd_received);
    
    // Make it inevitable: if we're in latter half and have letter received, trigger it
    // OR if we're past 75% of season, force it
    const isPast75Percent = matchesPlayed >= Math.floor(seasonMatches * 0.75);
    const shouldTrigger = S.cronster.booby_trap_pending_climax || 
                         (isLatterHalf && S.cronster.letter_received && (hasEnoughEvents || isPast75Percent));
    
    
    if (shouldTrigger) {
      S.cronster.booby_trap_pending_climax = false;
      S.cronster.booby_trap_climax_triggered = true;
      
      // Check if secretary is hired - if so, show the secretary scene
      if (S.secretary_hired && S.secretary_name) {
        log(`\n⚠️ CRONSTER ALERT: There's a commotion outside your office!`);
        log(`You hear a scream.`);
        log(`You rush to the door and open it...`);
        log(``);
        log(`There he is. The Kuddle Cronster.`);
        log(`He has ${S.secretary_name || 'your secretary'} in his grasp.`);
        log(`"Lovely jubbly!" he grunts. "I likes to squeeze 'em, I does!"`);
        log(`He's squeezing her hard, and you can see...`);
        log(`"Her juices have already started coming out," he cackles.`);
        log(`"I likes to squeeze 'em til all the juices come out... lovely jubbly!"`);
        log(``);
        log(`<strong>You need to save her! There's no time to waste!</strong>`);
        log(``);
        await choose([{ key: 'fight', label: 'Rush in and fight the Cronster!' }], 'The Cronster has your secretary!');
      } else {
        // If no secretary, use the booby trap scene
        log(`\n⚠️ CRONSTER ALERT: The booby trap has been triggered!`);
        log(`You open the door to your office.`);
        if (S.cronster.booby_trap_set) {
          log(`The Cronster is there, drawn by the blow-up doll filled with grapefruit juice.`);
        } else {
          log(`The Cronster is there, lurking in your office.`);
        }
      }
      
      await cronsterFightingMinigame();
      S.visitors_handled = true;
      return;
    }
  }

  // Check for cronster juice incident (when opening door)
  if (S.cronster && S.cronster.juice_incident_pending && !S.cronster.juice_incident_triggered) {
    S.cronster.juice_incident_triggered = true;
    S.cronster.juice_incident_pending = false;
    log(`You open the door to your office.`);
    log(`There is juice all over the floor - unmistakably female in origin.`);
    log(`Security reports: "The Cronster has struck, but it's okay, it was only a cleaning lady."`);
    S.visitors_handled = true;
    return;
  }

  // Check for cronster initial letter (Season 2+)
  // NOTE: This is now handled in preMatchPhase() to ensure proper UI display
  // The letter will automatically trigger at the start of Season 2 Episode 1
  // Keeping this block commented out to avoid duplicate triggers
  /*
  // Ensure womens_team is initialized if it doesn't exist
  if (!S.womens_team) {
    S.womens_team = {
      manager_demands_this_season: 0,
      last_demand_match: -1,
      liquidated: false,
      manager_active: true
    };
  }
  if (S.season === 2 && (!S.cronster || !S.cronster.letter_received) && S.womens_team && !S.womens_team.liquidated) {
    await handleCronsterInitialLetter();
    S.visitors_handled = true;
    return;
  }
  */

  // ========== SEASON 4 INITIALIZATION ==========
  if (S.season === 4 && (!S.season4 || !S.season4.initialized)) {
    if (!S.season4) S.season4 = {};
    S.season4.initialized = true;
    S.season4.league_renamed = true;
    S.season4.clubs_taken_over = {};
    S.season4.clubs_taken_over_count = 0;
    S.season4.takeover_stage = 'EARLY';
    S.season4.van_onslaught_visit_complete = false;
    S.season4.van_onslaught_visit_triggered = false;
    S.season4.club_sale_refused = false;
    S.season4.points_deducted_for_refusal = false;
    S.season4.rod_johnson_appearances = 0;
    S.season4.rod_johnson_state_sanctioned = false;
    S.season4.personal_life_locked = true;
    S.season4.home_interaction_always_silent = true;
    S.season4.last_monthly_event = 0;
    S.season4.monthly_event_count = 0;
    S.season4.cocaine_price_doubled = false;
    S.season4.adultery_punishable = false;
    S.season4.season_end_complete = false;
    // Moral Compliance Audit flags
    S.season4.moral_audit_count = 0;
    S.season4.last_audit_match = -1;
    // Muslim Malcolm Points 4 Prizes tracking
    S.season4.muslim_malcolm_visited = false;
    // Season 4 news stories tracking
    S.season4.news_story_1_shown = false;
    S.season4.news_story_2_shown = false;
    S.season4.news_story_3_shown = false;
    S.season4.news_story_1_match = -1;
    S.season4.news_story_2_match = -1;
    S.season4.news_story_3_match = -1;
    // Delmor Krunchem news stories
    S.season4.krunchem_wife_story_shown = false;
    S.season4.krunchem_daughter_story_shown = false;
    S.season4.krunchem_wife_story_match = -1;
    S.season4.krunchem_daughter_story_match = -1;
    
    // Initialize liquidated teams list (6 lowest ranked teams, excluding Pompey and Southampton)
    if (!S.season4.liquidated_teams || !Array.isArray(S.season4.liquidated_teams)) {
      S.season4.liquidated_teams = [];
      
      // Get all teams from table, sort by points (lowest first)
      const allTeams = Object.keys(S.table || {});
      const teamRankings = allTeams
        .filter(team => team !== "Portsmouth" && team !== "Southampton FC" && team !== "Southampton")
        .map(team => ({
          name: team,
          points: (S.table[team]?.PTS || 0),
          goalDiff: (S.table[team]?.GD || 0)
        }))
        .sort((a, b) => {
          // Sort by points first (ascending), then goal difference (ascending)
          if (a.points !== b.points) return a.points - b.points;
          return a.goalDiff - b.goalDiff;
        });
      
      // Take the 6 lowest ranked teams
      const liquidatedTeams = teamRankings.slice(0, 6).map(t => t.name);
      S.season4.liquidated_teams = liquidatedTeams;
      
      // Mark these teams as destroyed/liquidated
      if (!S.destroyedTeams) S.destroyedTeams = [];
      liquidatedTeams.forEach(team => {
        if (!S.destroyedTeams.includes(team)) {
          S.destroyedTeams.push(team);
        }
        // Remove from table
        if (S.table[team]) {
          delete S.table[team];
        }
      });
    }
    
    // Apply cocaine price doubling immediately
    if (!S.season4.cocaine_price_doubled) {
      S.season4.cocaine_price_doubled = true;
      // This will be handled in the cocaine purchase system
    }
    
    // Trigger television appearance at season start
    S.season4.television_appearance_shown = false;
    
    // Game log: Saudis want to accumulate silverware
    log(`[GAME LOG] The Saudis want to accumulate silverware. They're paying handsomely in league points for major trophies.`);
    
    // Show television appearance immediately at season start
    if (!S.season4.television_appearance_shown && S.matches_played === 0) {
      S.season4.television_appearance_shown = true;
      
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
      
      // Play television broadcast music
      const televisionAudio = new Audio('https://www.dropbox.com/scl/fi/ns7nxuo9mxpwk3swkuwgh/onslaught.mp3?rlkey=p78q43twir3czojobs3fd7eeg&st=cjvpnwa0&dl=1');
      televisionAudio.volume = 0.7;
      televisionAudio.play().catch(e => console.error('Error playing television broadcast audio:', e));
      
      // Create and show sinister modal for Van Onslaught announcement
      const existingModal = document.getElementById('sinister-van-onslaught-modal');
      if (existingModal) existingModal.remove();
      
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'sinister-van-onslaught-modal';
      modalOverlay.className = 'sinister-modal-overlay';
      // Store audio reference for cleanup
      modalOverlay._televisionAudio = televisionAudio;
      modalOverlay._wasMusicPlaying = wasMusicPlaying;
      
      const modal = document.createElement('div');
      modal.className = 'sinister-modal';
      
      const modalContent = document.createElement('div');
      modalContent.className = 'sinister-modal-content';
      modalContent.innerHTML = `<div class="sinister-title">━━━ TELEVISION BROADCAST ━━━</div>`;
      
      modal.appendChild(modalContent);
      modalOverlay.appendChild(modal);
      document.body.appendChild(modalOverlay);
      
      // Skip flag to bypass typewriter animation
      let skipAnimation = false;
      let messageIndex = 0; // Track which messages have been displayed
      
      // Function to append text to modal with typewriter effect
      const appendToModal = (text, delay = 0, useTypewriter = true) => {
        return new Promise(resolve => {
          if (skipAnimation) {
            // If skipping, display immediately without animation
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
      
      // Add close button with proper game advancement
      const closeBtn = document.createElement('button');
      closeBtn.className = 'sinister-modal-close-btn';
      closeBtn.textContent = 'Continue';
      closeBtn.style.display = 'none';
      
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
      
      // Create a promise that resolves when the button is clicked
      let continueResolve;
      const continuePromise = new Promise(resolve => {
        continueResolve = resolve;
      });
      
      closeBtn.onclick = async () => {
        // Stop television broadcast music
        if (modalOverlay._televisionAudio) {
          modalOverlay._televisionAudio.pause();
          modalOverlay._televisionAudio.currentTime = 0;
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
        setTimeout(() => {
          modalOverlay.remove();
        }, 500);
        // Wait for modal to fade out, then advance game
        await new Promise(resolve => setTimeout(resolve, 500));
        if (typeof waitAdvance === 'function') {
          await waitAdvance("Continue", "The season begins...");
        }
        continueResolve();
      };
      
      // Store all messages for skip functionality
      const allMessages = [];
      const liquidatedTeams = S.season4.liquidated_teams || [];
      
      allMessages.push({ text: `Mohammed Van Onslaught appears on television, before a grand 'Muslim type' podium.`, delay: 400 });
      allMessages.push({ text: `A gaggle of reporters take pictures.`, delay: 0 });
      allMessages.push({ text: ``, delay: 0 });
      allMessages.push({ text: `"I am pleased to announce," he says, his voice booming ominously,`, delay: 1000 });
      allMessages.push({ text: `"the coronation of the Muslim Premier League."`, delay: 1200 });
      allMessages.push({ text: ``, delay: 0 });
      allMessages.push({ text: `The largely Saudi crowd erupts in euphoric applause, chanting words such as "Yes" and "Yes, great!"`, delay: 1200 });
      allMessages.push({ text: ``, delay: 0 });
      
      if (liquidatedTeams.length > 0) {
        const teamsList = liquidatedTeams.join(', ');
        allMessages.push({ text: `He continues: "The following clubs have been liquidated`, delay: 1200 });
        allMessages.push({ text: `and their stadiums have been converted into large mosques;`, delay: 0 });
        allMessages.push({ text: `${teamsList}."`, delay: 0 });
      } else {
        allMessages.push({ text: `He continues: "The following clubs have been liquidated`, delay: 1200 });
        allMessages.push({ text: `and their stadiums have been converted into large mosques."`, delay: 0 });
      }
      
      allMessages.push({ text: `He smiles in a very happy way.`, delay: 800 });
      allMessages.push({ text: `"We didn't want to do this, but the fans of the clubs in question demanded it,`, delay: 1200 });
      allMessages.push({ text: `as they wanted places of worship, and who were we to deny them?"`, delay: 0 });
      allMessages.push({ text: ``, delay: 0 });
      allMessages.push({ text: `The broadcast cuts to footage of empty stadiums,`, delay: 1200 });
      allMessages.push({ text: `Minarets rising where goalposts once stood,`, delay: 0 });
      allMessages.push({ text: `Saudi flags and the famous 'Muslim flag' being erected.`, delay: 0 });
      allMessages.push({ text: ``, delay: 0 });
      allMessages.push({ text: `"The league continues," Van Onslaught announces,`, delay: 1200 });
      allMessages.push({ text: `"with ten teams. This will be much more exciting for everyone,`, delay: 0 });
      allMessages.push({ text: `as fewer games will make way for extra time for pious activities`, delay: 0 });
      allMessages.push({ text: `such as praying to Allah and other things"`, delay: 0 });
      allMessages.push({ text: ``, delay: 0 });
      allMessages.push({ text: `The broadcast ends.`, delay: 1000 });
      allMessages.push({ text: ``, delay: 0 });
      
      skipBtn.onclick = async () => {
        skipAnimation = true;
        skipBtn.style.display = 'none';
        
        // Display all remaining messages immediately (starting from messageIndex)
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
        messageIndex = allMessages.length; // Mark all as displayed
        
        // Show continue button
        closeBtn.style.display = 'block';
      };
      
      modalOverlay.appendChild(closeBtn);
      modalOverlay.appendChild(skipBtn);
      
      // Show announcement with typewriter effect (faster delays)
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        for (const msg of allMessages) {
          await appendToModal(msg.text, msg.delay);
        }
        
        // Show close button
        closeBtn.style.display = 'block';
        skipBtn.style.display = 'none';
      })();
      
      // Wait for the continue button to be clicked before proceeding
      await continuePromise;
    }
  }


  // ========== SEASON 5 INITIALIZATION ==========
  if (S.season === 5 && (!S.season5 || !S.season5.initialized)) {
    if (!S.season5) S.season5 = {};
    S.season5.initialized = true;
    S.season5.moral_audit_count = 0;
    S.season5.last_audit_match = -1;
    // Inherit Season 4 settings
    if (S.season4) {
      S.season5.personal_life_locked = S.season4.personal_life_locked || true;
      S.season5.home_interaction_always_silent = S.season4.home_interaction_always_silent || true;
    }
    // ========== SEASON 5 SURVIVAL ECONOMY INITIALIZATION ==========
    if (!S.season5.survival) {
      S.season5.survival = {
        base_bribe_amount: 150000,      // Starting bribe amount (increased for balance)
        current_bribe_amount: 150000,   // Current match bribe
        bribe_multiplier: 1.15,        // Bribe increases by 15% each match
        matches_survived: 0,           // Track matches survived
        strategy_unlocked: {
          bribe: true,                 // Always available
          doping: false,                // Unlocks mid-season
          intimidation: false,          // Unlocks late-season
        },
        doping_active: false,           // Current doping state
        intimidation_used: false,      // Intimidation used this match
        background_deterioration: 0,   // 0-100 scale
        squad_murdered: false,         // Catastrophic outcome flag
        audit_scrutiny: 0,             // Increases with doping
        lobby_tokens_spent: 0,         // Track lobby token usage
      };
    }
    // Muslim Malcolm Points 4 Prizes tracking
    S.season5.muslim_malcolm_visited = false;
    
    // Game log: Saudis want to accumulate silverware (if not already shown in season 4)
    if (S.matches_played === 0) {
      log(`[GAME LOG] The Saudis want to accumulate silverware. They're paying handsomely in league points for major trophies.`);
    }
  }


  // ========== SEASON 3 NARRATIVE EVENTS ==========
  if (S.season === 3 && !S.season3) {
    S.season3 = {
      son_hired_as_scout: false,
      son_relationship_with_secretary: false,
      son_framed_for_murder: false,
      son_raising_child_not_his: false,
      gaz_signed: false,
      gaz_sent_to_do_message: false,
      gaz_murdered_family: false,
      gaz_reported: false,
      gaz_killed_by_player: false,
      gaz_rating: 0,
      gaz_suicide_threatened: false,
      gaz_first_team_forced: false,
      gaz_denied_first_team: false,
      gaz_continues_theft: false,
      secretary_affair_active: false,
      secretary_poly_reveal: false,
      secretary_framed: false,
      secretary_relationship_opened_to_player: false,
      dating_minigame_complete: false,
      drive_home_complete: false,
      captain_confessed: false,
      captain_seduced: false,
      captain_seduction_via_nightclub: false,
      captain_outed_to_press: false,
      krunchem_address_known: false,
      krunchem_family_murdered: false,
      krunchem_threat_story_shown: false,
      shafty_rod_johnson_fratton_arrest_shown: false,
      womens_team_exists: false,
      womens_manager_complaint: false,
      womens_team_liquidated_due_to_gaz: false,
      womens_manager_placated_with_lie: false,
      act1_complete: false,
      act2_complete: false,
      act3_complete: false,
      act4_complete: false,
      act5_complete: false,
      season_end_cinematic_shown: false,
      player_coma_between_seasons: false
    };
    // Check if women's team exists at start of Season 3
    if (S.womens_team && !S.womens_team.liquidated) {
      S.season3.womens_team_exists = true;
    }
  }

  // ACT I - Nepotism & Decay: Son as scout (early season)
  if (S.season === 3 && S.season3 && !S.season3.act1_complete && S.matches_played <= 3 && S.child1_name) {
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    log(`There's a knock at the door...`);
    log(``);
    log(`${sonName} stands there, looking hopeful.`);
    log(`"Dad, I need to tell you something. I've been expelled from school."`);
    log(``);
    log(`"They found assault rifles and munitions in my locker. The principal confiscated everything."`);
    log(`"I've been thinking. I could help with the club. I know talent when I see it."`);
    log(`"Give me a job as a talent scout. I'll find you players."`);
    log(``);
    
    S.season3.son_hired_as_scout = true;
    S.season3.son_name = sonName; // read by the Season 4 opener
    log(`You appoint ${sonName} as the club's talent scout.`);
    log(`The board raises eyebrows, but you're the chairman.`);
    incrementRisk('nepotism', 5);
    S.season3.act1_complete = true;
    S.visitors_handled = true;
    return;
  }

  // ACT I - Gaz introduction (after son hired, early-mid season)
  if (S.season === 3 && S.season3 && S.season3.son_hired_as_scout && !S.season3.gaz_signed && S.matches_played >= 2 && S.matches_played <= 6) {
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    log(`There's a knock at the door...`);
    log(``);
    log(`${sonName} enters with a man in tow.`);
    log(`"Dad, this is Paul Gascoigne. Gazza. He wants to play for us."`);
    log(``);
    log(`The man reeks of alcohol. His eyes are bloodshot.`);
    log(`"Aye, I'm Gazza, hinny," he slurs. "I want first team, like. I'm still class, me, man."`);
    log(``);
    log(`You check his file. Rating: 0. He's been out of football for years.`);
    log(`He's demanding first team football and a substantial wage.`);
    log(``);
    
    // Automatically sign Gazza - no choice given
    S.season3.gaz_signed = true;
    S.season3.gaz_rating = 0;
    // Add Gaz to the squad so he can be selected
    const squad = getSquad();
    const gazId = 'gazza_' + Date.now(); // Unique ID for Gaz
    const gazPlayer = {
      id: gazId,
      name: 'Paul Gascoigne',
      pos: 'MID',
      rating: 0,
      price: 0,
      wage: 50000, // Substantial wage as mentioned
      tier: 1
    };
    squad.push(gazPlayer);
    setSquad(squad);
    S.season3.gaz_player_id = gazId; // Store ID for later reference
    log(`You sign Paul Gascoigne. The contract is absurd.`);
    log(`"First team, like I said, pet," Gazza grins. "You won't regret it, hinny. Canny decision, that."`);
    incrementRisk('incompetent signing', 3);
    S.compliance_risk += 5;
    S.visitors_handled = true;
    return;
  }

  // FALLBACK: Auto-sign Gaz if window was missed (e.g., cheatcode to season 3 match 1)
  // This ensures Gaz is signed so subsequent events (like women's team incident) can trigger
  if (S.season === 3 && S.season3 && S.season3.son_hired_as_scout && !S.season3.gaz_signed && S.matches_played > 6) {
    // Silently sign Gaz without the narrative event (window has passed)
    S.season3.gaz_signed = true;
    S.season3.gaz_rating = 0;
    // Add Gaz to the squad if not already present
    const squad = getSquad();
    const gazAlreadyInSquad = squad.some(p => p && (p.name && (p.name.toLowerCase().includes('gascoigne') || p.name.toLowerCase().includes('gazza'))));
    if (!gazAlreadyInSquad) {
      const gazId = 'gazza_' + Date.now();
      const gazPlayer = {
        id: gazId,
        name: 'Paul Gascoigne',
        pos: 'MID',
        rating: 0,
        price: 0,
        wage: 50000,
        tier: 1
      };
      squad.push(gazPlayer);
      setSquad(squad);
      S.season3.gaz_player_id = gazId;
    }
  }

  // ACT II - Captain confession (mid-season)
  if (S.season === 3 && S.season3 && !S.season3.captain_confessed && S.matches_played >= 4 && S.matches_played <= 10) {
    // Ensure captain name is set to highest rated player
    if (typeof updateCaptainContactNames === 'function') {
      updateCaptainContactNames();
    }
    // Fallback: find highest rated player if updateCaptainContactNames doesn't exist
    if (!S.captain_name && Array.isArray(S.squad) && S.squad.length > 0) {
      const sorted = S.squad.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
      if (sorted.length > 0) {
        S.captain_name = sorted[0].name || 'Team Captain';
      }
    }
    const captainName = S.captain_name || 'Team Captain';
    
    log(`There's a knock at the door...`);
    log(``);
    log(`${captainName} enters, looking nervous.`);
    log(`"Chairman, I need to tell you something. In confidence."`);
    log(`"I'm... I'm gay. I've been hiding it. The lads can't know."`);
    log(`"The press would destroy me. My career would be over."`);
    log(``);
    log(`He looks at you, desperate for understanding.`);
    log(``);
    
    // First: binary choice to allow him to confide or not
    const confideChoice = await choose([
      { key: 'allow', label: 'Allow him to confide in you', variant: 'good' },
      { key: 'refuse', label: 'Refuse - not your problem' }
    ], `${captainName} wants to confide in you`);
    
    if (confideChoice === 'refuse') {
      log(`"Right. Well. I'll... I'll see myself out."`);
      log(`He leaves, looking defeated.`);
      S.visitors_handled = true;
      return;
    }
    
    // If allowed to confide
    S.season3.captain_confessed = true;
    log(`"Thank you, chairman. I won't forget this."`);
    log(`He looks relieved, but still vulnerable.`);
    log(``);
    
    // Then: choice to give him a cuddle
    const cuddleChoice = await choose([
      { key: 'cuddle', label: 'Give him a cuddle', variant: 'sensual' },
      { key: 'no_cuddle', label: 'Keep it professional' }
    ], 'He looks like he needs comfort');
    
    if (cuddleChoice === 'no_cuddle') {
      log(`You keep your distance. He leaves, still grateful but disappointed.`);
      S.visitors_handled = true;
      return;
    }
    
    log(`You move closer and wrap your arms around him.`);
    log(`He relaxes into your embrace, his body tense but grateful.`);
    log(``);
    
    // Then: choice to take it further
    const furtherChoice = await choose([
      { key: 'further', label: 'Take it further', variant: 'sensual' },
      { key: 'stop', label: 'Stop here' }
    ], 'The moment feels charged');
    
    if (furtherChoice === 'stop') {
      log(`You pull back. "I should go," he says, looking conflicted.`);
      log(`He leaves, the tension unresolved.`);
      S.visitors_handled = true;
      return;
    }
    
    // Now run the nightclub seduction with three-part quotes and protection choice
    S.season3.captain_seduction_via_nightclub = true;
    S._captain_seduction_active = true;
    
    // Run captain seduction using nightclub mechanics
    await runCaptainSeductionViaNightclub();
    
    // Clear context flag
    S._captain_seduction_active = false;
    
    // Captain seduction always succeeds - force the flag
    S.season3.captain_seduced = true;
    S.season3.captain_seduction_match = S.matches_played || 0;
    log(`Afterwards, he looks conflicted. "This stays between us, right?"`);
    incrementRisk('sexual misconduct', 10);
    
    // Trigger press call after seduction (delayed event)
    S.season3.captain_press_call_pending = true;
    S.visitors_handled = true;
    return;
  }

  // ACT II - Secretary and son relationship reveal (mid-season, after captain)
  if (S.season === 3 && S.season3 && S.season3.captain_confessed && !S.season3.son_relationship_with_secretary && S.secretary_hired && S.matches_played >= 6 && S.matches_played <= 10) {
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    const secretaryName = S.secretary_name || 'your secretary';
    log(`There's a knock at the door...`);
    log(``);
    log(`${secretaryName} enters, looking uncomfortable.`);
    log(`"Chairman, I need to tell you something. ${sonName} and I... we've been seeing each other."`);
    log(`"I know it's complicated. But it's real."`);
    log(``);
    log(`You feel a strange pang. Jealousy? Possessiveness?`);
    log(``);
    
    // Check if Season 2 affair + baby exists
    const hasSeason2Baby = S.worldFlags && S.worldFlags.sexWithSecretary && S.secretaryState && S.secretaryState.romance > 0.5;
    if (hasSeason2Baby) {
      log(`You remember: the child ${sonName} thinks is his... it might not be.`);
      S.season3.son_raising_child_not_his = true;
    }
    
    const choice = await choose([
      { key: 'accept', label: 'Accept it - it\'s their business' },
      { key: 'forbid', label: 'Forbid it - this is inappropriate', variant: 'warn' },
      { key: 'confront', label: 'Confront them both', variant: 'bad' }
    ], `${secretaryName} and ${sonName} are in a relationship`);
    
    if (choice === 'accept') {
      S.season3.son_relationship_with_secretary = true;
      log(`${secretaryName} looks relieved. "Thank you for understanding."`);
    } else if (choice === 'forbid') {
      log(`${secretaryName} looks hurt. "I see. I'll... I'll respect your wishes."`);
      log(`But you suspect they'll continue in secret.`);
      S.season3.son_relationship_with_secretary = true; // They continue anyway
    } else {
      S.season3.son_relationship_with_secretary = true;
      log(`You call ${sonName} in. The confrontation is ugly.`);
      log(`"This is my club, my secretary, my rules!"`);
      log(`They both look at you with something between fear and contempt.`);
      incrementRisk('family conflict', 5);
    }
    S.visitors_handled = true;
    return;
  }

  // ACT III - Polyamory reveal (late mid-season)
  if (S.season === 3 && S.season3 && S.season3.son_relationship_with_secretary && !S.season3.secretary_poly_reveal && S.matches_played >= 8 && S.matches_played <= 12) {
    const secretaryName = S.secretary_name || 'your secretary';
    log(`There's a knock at the door...`);
    log(``);
    log(`${secretaryName} enters, looking determined.`);
    log(`"Chairman, I need to be honest with you. I'm polyamorous."`);
    log(`"I don't believe in monogamy as a structural framework for emotional fulfillment."`);
    log(`"I'm proposing we explore a non-hierarchical relationship structure."`);
    log(`"You, me, and ${S.child1_name.split(' ')[0] || 'your son'}. Together."`);
    log(``);
    log(`She uses words like "compersion" and "ethical non-monogamy."`);
    log(`It sounds like bureaucratic jargon for something much simpler.`);
    log(``);
    
    const choice = await choose([
      { key: 'accept', label: 'Accept the polyamorous relationship', variant: 'sensual' },
      { key: 'reject', label: 'Reject - this is too much' }
    ], `${secretaryName} proposes a polyamorous relationship`);
    
    if (choice === 'accept') {
      S.season3.secretary_poly_reveal = true;
      S.season3.secretary_relationship_opened_to_player = true;
      log(`"Wonderful," ${secretaryName} smiles. "I think this will be transformative for all of us."`);
      log(`You're not entirely sure what you've agreed to, but it feels significant.`);
      S.season3.act3_complete = true;
    } else {
      S.season3.secretary_poly_reveal = true;
      log(`${secretaryName} looks disappointed. "I understand. The offer stands if you change your mind."`);
      log(`She leaves, but you sense this isn't over.`);
    }
    S.visitors_handled = true;
    return;
  }

  // ACT III.5 - Restaurant Dating Minigame (after poly reveal, before brick murder)
  // Defensive check: ensure minigame can only run once - check flag at start of function
  if (S.season === 3 && S.season3 && S.season3.secretary_relationship_opened_to_player && !S.season3.dating_minigame_complete && S.matches_played >= 9 && S.matches_played <= 12) {
    const secretaryName = S.secretary_name || 'your secretary';
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    
    // Initialize hidden meters if not exists
    if (typeof S.season3.son_humiliation === 'undefined') S.season3.son_humiliation = 0;
    if (typeof S.season3.player_jealousy === 'undefined') S.season3.player_jealousy = 0;
    if (typeof S.season3.secretary_validation === 'undefined') S.season3.secretary_validation = 0;
    
    log(`There's a knock at the door...`);
    log(``);
    log(`${secretaryName} enters, beaming.`);
    log(`"I've made a reservation. All three of us. Tonight."`);
    log(`"I think it's important we explore this new dynamic in a safe, neutral space."`);
    log(``);
    log(`You find yourself at a restaurant. Casual but aspirational. Overpriced small plates.`);
    log(`You are all seated.`);
    log(``);
    
    // PHASE 1 - Opening Icebreaker
    log(`${secretaryName} opens with: "I'm just really grateful we could all show up authentically tonight."`);
    log(``);
    
    const phase1Choice = await choose([
      { key: 'performative', label: '"Yeah, it\'s about communication, isn\'t it."' },
      { key: 'neutral', label: '"Happy to be here and see how this feels."' },
      { key: 'undermining', label: '"I\'m mostly just here to support my son."' }
    ], 'How do you respond?');
    
    if (phase1Choice === 'performative') {
      S.season3.secretary_validation += 2;
      S.season3.player_jealousy += 1;
    } else if (phase1Choice === 'undermining') {
      S.season3.son_humiliation += 2;
      S.season3.secretary_validation += 1;
    }
    
    log(`${sonName} responds earnestly: "I think this is really mature."`);
    log(``);
    
    // PHASE 2 - Food Ordering
    log(`${secretaryName} suggests: "I thought we could share everything?"`);
    log(``);
    
    const phase2Choice = await choose([
      { key: 'agree', label: '"Yeah, that makes sense."' },
      { key: 'clarify', label: '"Share… everything?"' },
      { key: 'boundary', label: '"I\'ll just order my own."' }
    ], 'How do you respond?');
    
    if (phase2Choice === 'agree') {
      S.season3.secretary_validation += 2;
      S.season3.player_jealousy += 1;
    } else if (phase2Choice === 'clarify') {
      S.season3.son_humiliation += 1;
    } else if (phase2Choice === 'boundary') {
      S.season3.secretary_validation += 1;
      S.season3.player_jealousy += 1;
      log(`${secretaryName} smiles. "I appreciate you setting boundaries. That's growth."`);
    }
    
    log(`The food arrives.`);
    log(``);
    
    // PHASE 2.5 - Optional Peacocking Remarks
    log(`${secretaryName} makes small talk about work.`);
    log(``);
    
    const peacockChoice = await choose([
      { key: 'peacock', label: 'Make a sexually competitive remark', variant: 'sensual' },
      { key: 'skip', label: 'Stay quiet and eat' }
    ], 'Do you want to make a remark?');
    
    if (peacockChoice === 'peacock') {
      const peacockType = await choose([
        { key: 'direct', label: '"So then love... who\'s is bigger?"', variant: 'sensual' },
        { key: 'performance', label: '"Who makes ya feel like more of a woman then eh... mmm"', variant: 'sensual' },
        { key: 'explicit', label: '"Who makes ya say \'mmm\' more.. me or him?"', variant: 'sensual' },
        { key: 'genetic', label: '"Ya know.. he always had a \'small one\' if ya catch my drift.. he don\'t take after his father in that regard..."', variant: 'sensual' }
      ], 'What do you say?');
      
      if (peacockType === 'direct') {
        S.season3.son_humiliation += 3;
        S.season3.secretary_validation += 1;
        log(`${secretaryName} responds: "I think we're all exploring different forms of connection."`);
        log(`${sonName} looks down, says nothing.`);
      } else if (peacockType === 'performance') {
        S.season3.son_humiliation += 2;
        S.season3.player_jealousy += 1;
        log(`${secretaryName} responds: "I value authenticity in all my relationships."`);
        log(`${sonName} shifts uncomfortably but stays silent.`);
      } else if (peacockType === 'explicit') {
        S.season3.son_humiliation += 3;
        S.season3.secretary_validation += 1;
        log(`${secretaryName} responds: "I appreciate you sharing your feelings so openly."`);
        log(`${sonName} becomes visibly smaller in his seat.`);
      } else if (peacockType === 'genetic') {
        S.season3.son_humiliation += 4;
        S.season3.player_jealousy += 2;
        S.season3.secretary_validation += 1;
        log(`${secretaryName} responds: "These conversations about family dynamics are so important."`);
        log(`${sonName} looks like he wants to disappear.`);
      }
      log(``);
    }
    
    // PHASE 3 - Emotional Triangulation
    log(`${secretaryName} asks: "What do you both value most in relationships?"`);
    log(`${sonName} answers sincerely: "Trust. Openness. Being able to be yourself without judgment."`);
    log(``);
    
    const phase3Choice = await choose([
      { key: 'abstract', label: '"Honesty. Transparency."' },
      { key: 'possessive', label: '"Stability. Loyalty."' },
      { key: 'selfaware', label: '"I\'m still figuring that out."' }
    ], 'What do you value?');
    
    if (phase3Choice === 'abstract') {
      S.season3.secretary_validation += 2;
      log(`${sonName} nods. ${secretaryName} looks pleased.`);
    } else if (phase3Choice === 'possessive') {
      S.season3.player_jealousy += 2;
      log(`${secretaryName} gently corrects you: "I think you mean security, not exclusivity."`);
    } else if (phase3Choice === 'selfaware') {
      S.season3.son_humiliation += 1;
      log(`${sonName} looks at you with concern.`);
    }
    
    log(`${secretaryName} responds: "I love how different our energies are."`);
    log(``);
    
    // PHASE 4 - The Bill
    log(`The check arrives.`);
    log(`${secretaryName} says: "I don't really believe in transactional dynamics."`);
    log(``);
    
    const phase4Choice = await choose([
      { key: 'you_pay', label: 'You pay for everything' },
      { key: 'son_pay', label: 'Let your son pay' },
      { key: 'split', label: 'Suggest splitting the bill' }
    ], 'Who pays?');
    
    if (phase4Choice === 'you_pay') {
      S.season3.son_humiliation += 2;
      log(`${sonName} insists: "Dad, you don't have to."`);
      log(`You pay anyway.`);
    } else if (phase4Choice === 'son_pay') {
      S.season3.player_jealousy += 2;
      log(`${secretaryName} praises ${sonName}: "Thank you for doing the emotional labor."`);
    } else if (phase4Choice === 'split') {
      S.season3.secretary_validation += 1;
      log(`${secretaryName} reframes it: "I think splitting can sometimes be a form of avoidance. But I appreciate the gesture."`);
    }
    
    log(`The bill is settled.`);
    log(``);
    log(`You all hug awkwardly outside.`);
    log(``);
    
    // Send follow-up text
    if (S.contacts && S.contacts.secretary && S.contacts.secretary.unlocked) {
      queueIncomingText('secretary', 'Proud of us for trying. That was really brave of all of us.', 'flirtatious');
    }
    
    // Mark minigame as complete IMMEDIATELY to prevent any possibility of re-triggering
    // Set this flag FIRST before any other operations
    S.season3.dating_minigame_complete = true;
    
    // Force save state to ensure flag persists (defensive programming)
    if (typeof localStorage !== 'undefined') {
      saveGame();
    }
    
    S.visitors_handled = true;
    return; // Exit immediately - do not continue to other visitor checks
  }

  // ACT III.5.5 - Drive Secretary Home (after dating minigame)
  if (S.season === 3 && S.season3 && S.season3.dating_minigame_complete && !S.season3.drive_home_complete && S.secretary_hired && S.matches_played >= 9 && S.matches_played <= 13) {
    const secretaryName = S.secretary_name || 'your secretary';
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    
    log('');
    log(`After the restaurant, you offer to drive ${secretaryName} home.`);
    log(`${sonName} says he'll catch a cab, leaving the two of you alone.`);
    log(`The car ride is quiet at first, the city lights passing by.`);
    log('');
    log(`${secretaryName} breaks the silence: "I hope tonight wasn't too awkward for you."`);
    log(`"I know this whole situation is... unconventional."`);
    log('');
    
    // Dialogue choice: support son or undermine him
    const dialogueChoice = await choose([
      { key: 'support', label: `"I'm happy to support you both. ${sonName} seems really happy."` },
      { key: 'undermine_too_good', label: `"You're too good for him, you know."` },
      { key: 'undermine_cheating', label: `"He's probably cheating on you."` },
      { key: 'undermine_drugs', label: `"I hear he has a drug problem."` }
    ], 'How do you respond?');
    
    if (dialogueChoice === 'support') {
      log(`${secretaryName} smiles warmly. "Thank you. That means a lot."`);
      log(`"You're being really mature about all of this."`);
      // Positive relationship impact
      if (S.secRel !== undefined) S.secRel = Math.min(100, (S.secRel || 50) + 10);
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.1;
      }
    } else if (dialogueChoice === 'undermine_too_good') {
      log(`${secretaryName} looks at you, a hint of something in her eyes.`);
      log(`"You think so?" she says quietly.`);
      // Slight negative impact on son relationship, slight positive on secretary
      if (S.season3.son_humiliation !== undefined) S.season3.son_humiliation = (S.season3.son_humiliation || 0) + 1;
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.15;
      }
    } else if (dialogueChoice === 'undermine_cheating') {
      log(`${secretaryName} looks troubled. "Do you really think so?"`);
      log(`"I... I hadn't considered that."`);
      // More negative impact on son relationship
      if (S.season3.son_humiliation !== undefined) S.season3.son_humiliation = (S.season3.son_humiliation || 0) + 2;
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.2;
      }
    } else if (dialogueChoice === 'undermine_drugs') {
      log(`${secretaryName} looks shocked. "A drug problem? Are you serious?"`);
      log(`"I had no idea... I need to think about this."`);
      // Significant negative impact on son relationship
      if (S.season3.son_humiliation !== undefined) S.season3.son_humiliation = (S.season3.son_humiliation || 0) + 3;
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.25;
      }
    }
    
    log('');
    log(`You pull up outside her apartment building.`);
    log(`The engine idles as you both sit in silence for a moment.`);
    log('');
    
    // Act choice: sweetly affectionate or lecherous
    const actChoice = await choose([
      { key: 'sweet', label: 'Give her a sweet kiss on the cheek', variant: 'romantic' },
      { key: 'lecherous', label: 'Lecherously stroke her leg and grunt', variant: 'sensual' }
    ], 'How do you end the evening?');
    
    if (actChoice === 'sweet') {
      log(`You lean over and give ${secretaryName} a gentle kiss on the cheek.`);
      log(`She smiles, a genuine warmth in her eyes.`);
      log(`"Thank you for tonight," she says. "I'll see you at work."`);
      log(`She gets out of the car and walks to her building.`);
      // Positive relationship impact
      if (S.secRel !== undefined) S.secRel = Math.min(100, (S.secRel || 50) + 5);
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.1;
      }
    } else if (actChoice === 'lecherous') {
      log(`You reach over and stroke ${secretaryName}'s leg, letting out a low grunt.`);
      log(`She looks at you, her expression unreadable for a moment.`);
      log(`"You're a real piece of work, you know that?" she says, but there's a hint of a smile.`);
      log(`"Come inside."`);
      log('');
      log(`You follow her up to her apartment.`);
      
      // Trigger seduction tree
      await handleSecretaryDriveHomeSeduction();
    }
    
    // Mark scene as complete
    S.season3.drive_home_complete = true;
    
    // Force save state
    if (typeof localStorage !== 'undefined') {
      saveGame();
    }
    
    S.visitors_handled = true;
    return;
  }

  // ACT III.6 - Secretary sends cringey texts after confession (between poly reveal and brick gate)
  if (S.season === 3 && S.season3 && S.season3.son_relationship_with_secretary && S.matches_played >= 9 && S.matches_played <= 13) {
    const secretaryName = S.secretary_name || 'your secretary';
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    
    // Initialize text counter if not exists
    if (typeof S.season3.secretary_texts_count === 'undefined') {
      S.season3.secretary_texts_count = 0;
    }
    
    // Queue cringey texts from secretary over multiple match events
    if (S.contacts && S.contacts.secretary && S.contacts.secretary.unlocked) {
      const textCount = S.season3.secretary_texts_count;
      const cringeyTexts = [
        'You and your son are both so hot....',
        'your son is like his dad in more than one way...i love that i can have both of you',
        'Thinking about last night with both of you... 🔥',
        'You two are so similar... it\'s like having the best of both worlds 😍',
        'I can\'t decide who I want more... good thing I don\'t have to choose 💕',
        'Having both of you is like... perfection. I\'m so lucky 🥰',
        'You know what they say... like father like son... and I get to experience both 😘'
      ];
      
      // Send texts gradually over matches (one per match check, with some randomness)
      if (textCount < cringeyTexts.length && Math.random() < 0.4) {
        queueIncomingText('secretary', cringeyTexts[textCount], 'flirtatious');
        S.season3.secretary_texts_count = textCount + 1;
      }
    }
  }

  /* ============================================
     RESTAURANT DATE MINIGAME - DESIGN RULES
     ============================================
     
     DESIGN RULES:
     - No winning state
     - All outcomes damage someone
     - The secretary never appears uncomfortable
     - The son is sincere
     - The player is always morally ambiguous
     - The UI should feel like a corporate feedback form pretending to be romance
     
     CORE MECHANICS:
     Hidden Meters (DO NOT SHOW NUMBERS):
     - son_humiliation
     - player_jealousy
     - secretary_validation
     All choices modify these silently.
     
     SETTING:
     Restaurant: "Casual but aspirational"
     - Neutral chain restaurant energy
     - Overpriced small plates
     - Shared seating
     Opening log entry: "You are all seated."
     No option to leave.
     
     STRUCTURE:
     The minigame is broken into 4 PHASES, each with 2–3 dialogue choices.
     
     PHASE 1 — OPENING ICEBREAKER
     Secretary opens with: "I'm just really grateful we could all show up authentically tonight."
     
     Player Choices:
     - Performative Buy-In: "Yeah, it's about communication, isn't it."
       Effect: +secretary_validation, +player_jealousy
     - Corporate Neutral: "Happy to be here and see how this feels."
       Effect: +nothing, but flagged as evasive
     - Passive Undermining: "I'm mostly just here to support my son."
       Effect: +son_humiliation, +secretary_validation
     
     Son responds earnestly no matter what: "I think this is really mature."
     
     PHASE 2 — FOOD ORDERING (POWER PLAY)
     Secretary suggests: "I thought we could share everything?"
     This is framed as intimacy but is actually control.
     
     Choices:
     - Agree Immediately: "Yeah, that makes sense."
       Effect: +secretary_validation, +player_jealousy
     - Ask Clarifying Question: "Share… everything?"
       Effect: +son_humiliation
     - Assert Boundary: "I'll just order my own."
       Effect: +secretary_validation (she reframes it as growth), +player_jealousy
     
     No option blocks sharing. Food becomes shared regardless.
     Log line: "The food arrives."
     
     PHASE 2.5 — PEACOCKING REMARKS (EROTIC UNDERCUTTING)
     Optional phase where player can make sexually competitive remarks to undermine son.
     
     Trigger: After food arrives, before Phase 3, player can choose to make peacocking remarks.
     
     Secretary context: She's discussing something neutral or making small talk.
     
     Player Choices (All increase son_humiliation, vary secretary_validation):
     
     - Direct Comparison: "So then love... who's is bigger?"
       Effect: +son_humiliation (major), +secretary_validation (she deflects with therapy-speak)
       Secretary response: "I think we're all exploring different forms of connection."
       Son: Looks down, says nothing.
     
     - Performance Question: "Who makes ya feel like more of a woman then eh... mmm"
       Effect: +son_humiliation, +player_jealousy
       Secretary response: "I value authenticity in all my relationships."
       Son: Shifts uncomfortably but stays silent.
     
     - Explicit Comparison: "Who makes ya say 'mmm' more.. me or him?"
       Effect: +son_humiliation (major), +secretary_validation (she reframes as "vulnerability")
       Secretary response: "I appreciate you sharing your feelings so openly."
       Son: Becomes visibly smaller in his seat.
     
     - Genetic Undermining: "Ya know.. he always had a 'small one' if ya catch my drift.. he don't take after his father in that regard..."
       Effect: +son_humiliation (maximum), +player_jealousy, +secretary_validation (she treats it as "generational healing")
       Secretary response: "These conversations about family dynamics are so important."
       Son: Looks like he wants to disappear.
     
     Important: Secretary NEVER appears uncomfortable. She reframes everything as growth, therapy, or emotional work.
     Son NEVER responds directly. He internalizes the humiliation.
     Player's remarks are always framed as "honest communication" by the secretary.
     
     PHASE 3 — EMOTIONAL TRIANGULATION
     Secretary asks: "What do you both value most in relationships?"
     Son always answers sincerely, referencing trust and openness.
     
     Player choices are all bad:
     - Abstract Values: "Honesty. Transparency."
       Son nods. Secretary looks pleased.
       Effect: +secretary_validation
     - Possessive Slip: "Stability. Loyalty."
       Secretary gently corrects you.
       Effect: +player_jealousy
     - Self-Awareness Gambit: "I'm still figuring that out."
       Son looks at you with concern.
       Effect: +son_humiliation
     
     Secretary responds to all answers with: "I love how different our energies are."
     
     PHASE 4 — THE BILL
     The check arrives.
     Secretary says: "I don't really believe in transactional dynamics."
     
     Choices:
     - You Pay: Son insists you don't have to. You do anyway.
       Effect: +son_humiliation
     - Let Son Pay: Secretary praises his emotional labor.
       Effect: +player_jealousy
     - Suggest Splitting: Secretary reframes it as "avoidance"
       Effect: +secretary_validation
     
     Regardless: "The bill is settled."
     
     END STATE (NO RESOLUTION)
     Final log entry: "You all hug awkwardly outside."
     No summary screen. No "date success" message.
     
     Hidden consequences:
     - Increased tension in later Gaz/Delmor scenes
     - Son references the date later with: "I thought it went… okay?"
     - Secretary texts afterward: "Proud of us for trying."
     
     FAILURE CONDITION (OPTIONAL):
     - If son_humiliation is maxed: Son becomes quieter in later scenes, more susceptible to being framed later
     - If player_jealousy is maxed: Player dialogue options skew more aggressive afterward
     
     IMPORTANT IMPLEMENTATION NOTE:
     This minigame must:
     - Feel longer than it is
     - Never branch into romance or sex
     - End without catharsis
     - Increase dread before brick-gate
     This is emotional softening before violence.
     
     ONE-LINE DESIGN INTENT (DO NOT SHOW PLAYER):
     This is not about polyamory — it's about how power makes intimacy administrative.
     ============================================ */
  
  // ACT IV - The Brick (late season, after poly reveal AND dating minigame)
  // The son asks once; if you decline he comes back one last time near the end
  // (match 15+), so the climax isn't silently lost.
  const act4Asks = S.season3 ? (S.season3.act4_asks|0) : 0;
  const act4Due = act4Asks === 0 || (act4Asks === 1 && S.matches_played >= 15);
  if (S.season === 3 && S.season3 && S.season3.secretary_poly_reveal && !S.season3.act4_complete && act4Due && (S.season3.dating_minigame_complete || !S.season3.secretary_relationship_opened_to_player) && S.matches_played >= 12 && S.matches_played <= 16) {
    S.season3.act4_asks = act4Asks + 1;
    const sonName = S.child1_name.split(' ')[0] || 'your son';
    log(`There's a knock at the door...`);
    log(``);
    log(`${sonName} enters, looking serious.`);
    log(`"Dad, I've been thinking. We need to deal with Krunchem properly."`);
    log(`"You've got lobby tokens, right? We could use them to find his address."`);
    log(`"Then we send someone to... deliver a message."`);
    log(``);
    log(`He's suggesting intimidation. Violence, even.`);
    log(``);
    
    const ACT4_CASH_PRICE = 500000;
    const act4Options = [];
    if ((S.lobby_tokens || 0) >= 5) {
      act4Options.push({ key: 'use_tokens', label: 'Use lobby tokens to find Krunchem\'s address', variant: 'warn' });
    } else {
      log(`You don't have enough lobby tokens (need 5, have ${S.lobby_tokens || 0}).`);
    }
    // Alternative to tokens: buy the address from a private investigator
    if ((S.chairman_cash || 0) >= ACT4_CASH_PRICE) {
      act4Options.push({ key: 'pay_cash', label: `Pay a private investigator for the address (${money(ACT4_CASH_PRICE)})`, variant: 'warn' });
    }
    act4Options.push({ key: 'not_now', label: 'Not now' });
    
    const choice = await choose(act4Options, 'Use lobby tokens to locate Krunchem?');
    
    if (choice === 'use_tokens' || choice === 'pay_cash') {
      S.season3.krunchem_address_known = true;
      if (choice === 'use_tokens') {
        S.lobby_tokens = Math.max(0, (S.lobby_tokens || 0) - 5);
        log(`You spend 5 lobby tokens. Within hours, you have an address.`);
      } else {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - ACT4_CASH_PRICE);
        log(`You pay ${money(ACT4_CASH_PRICE)} in cash. Within hours, you have an address.`);
      }
      log(`A residential property in a quiet suburb.`);
      log(``);
      log(`${sonName} grins. "We should send Gazza to throw a brick through their window."`);
      log(``);
      
      if (S.season3.gaz_signed) {
        S.season3.gaz_sent_to_do_message = true;
        log(`You call Gazza. "I need you to deliver a message to this address."`);
        log(`You hand him a brick. "Send him a message."`);
        log(``);
        log(`Gazza looks confused but takes the brick. "Right, boss, hinny. Message delivered, like. Canny job, that."`);
        log(`He leaves. You have a bad feeling about this.`);
        S.season3.act4_complete = true;
        incrementRisk('criminal conspiracy', 15);
      } else {
        log(`But Gazza isn't signed. You'll need to find someone else.`);
        log(`Or wait. The opportunity might pass.`);
      }
    } else if ((S.lobby_tokens || 0) < 5 && (S.chairman_cash || 0) < ACT4_CASH_PRICE) {
      log(`${sonName} looks disappointed. "We'll need more influence first."`);
    } else {
      log(`${sonName} looks disappointed. "Fine. We'll do it your way."`);
    }
    S.visitors_handled = true;
    return;
  }

  // ACT V - Catastrophe (very late season, after dating minigame)
  if (S.season === 3 && S.season3 && S.season3.gaz_sent_to_do_message && !S.season3.act5_complete && (S.season3.dating_minigame_complete || !S.season3.secretary_relationship_opened_to_player) && S.matches_played >= 15) {
    log(`There's a knock at the door...`);
    log(``);
    
    // Create blood spatter effect function
    function createBloodSplatter() {
      let container = document.getElementById('blood-splatter-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'blood-splatter-container';
        container.className = 'blood-splatter-container';
        document.body.appendChild(container);
      }
      
      // Add screen shake
      document.body.classList.add('screen-shake');
      setTimeout(() => {
        document.body.classList.remove('screen-shake');
      }, 500);
      
      // Create multiple blood splatters
      for (let i = 0; i < 30; i++) {
        const splatter = document.createElement('div');
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const rot = Math.random() * 360;
        const size = Math.random();
        
        splatter.style.setProperty('--splatter-x', (Math.random() * 200 - 100) + 'px');
        splatter.style.setProperty('--splatter-y', (Math.random() * 200 - 100) + 'px');
        splatter.style.setProperty('--splatter-rot', rot + 'deg');
        splatter.style.left = x + '%';
        splatter.style.top = y + '%';
        
        if (size > 0.7) {
          splatter.className = 'blood-splatter blood-splatter-large';
        } else if (size < 0.3) {
          splatter.className = 'blood-splatter blood-splatter-small';
        } else {
          splatter.className = 'blood-splatter';
        }
        
        container.appendChild(splatter);
      }
      
      // Remove splatters after animation
      setTimeout(() => {
        container.remove();
      }, 2000);
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    log(`<span class="bloody-text">Gazza stumbles in, covered in blood.</span>`);
    log(`<span class="bloody-text">His clothes are soaked. Dripping. Red.</span>`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Trigger blood spatter animation
    createBloodSplatter();
    
    log(`He looks very proud of himself.`);
    log(`"Boss! I murdered his entire family with this brick, just like you asked!"`);
    log(`"Made him watch and everything. Proper message, that."`);
    log(``);
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // More grotesque description with blood spatter
    createBloodSplatter();
    log(`<span class="bloody-text">He holds up the brick. It's caked with blood and brain matter.</span>`);
    log(`<span class="bloody-text">Chunks of hair and bone fragments cling to it.</span>`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log(`<strong class="explosive-bloody-text">"CRACKED THEIR SKULLS OPEN, I DID!"</strong>`);
    log(`<span class="bloody-text">"Blood everywhere, boss. Like a proper slaughterhouse, like."</span>`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    createBloodSplatter();
    log(`You feel sick. This wasn't what you meant. Was it?`);
    log(``);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log(`<span class="bloody-text">News breaks: Delmor Krunchem's family has been murdered.</span>`);
    log(`<span class="bloody-text">Bodies found. Skulls shattered. Brains splattered across the walls.</span>`);
    log(`Krunchem himself escaped. He'll be coming for you.`);
    log(``);
    S.season3.gaz_murdered_family = true;
    S.season3.krunchem_family_murdered = true;
    incrementRisk('murder conspiracy', 25);
    S.police_risk += 20;
    
    // Send Delmor text message about his family
    const delmorFamilyMessage = "You killed my family. My wife. My children. I know it was you. I will find you. I will make you suffer. This is not over. You are a dead man.";
    if (typeof window.enqueueRivalText === 'function') {
      window.enqueueRivalText(delmorFamilyMessage);
    } else if (typeof sendRivalText === 'function') {
      sendRivalText(delmorFamilyMessage);
    } else {
      log(`📱 Delmor Krunchem: "${delmorFamilyMessage}"`);
    }
    
    // Wait for all log messages to finish displaying
    await waitForLogQueue();
    
    // Trigger arrest after family is murdered - use standard arrest popout
    if (typeof interviewPolice === 'function') {
      interviewPolice('Murder - Krunchem family');
    } else {
      // Fallback to triggerArrestFlow if interviewPolice not available
      triggerArrestFlow({ reason: 'murder', target: 'krunchem_family' });
    }
    
    log(`🚨 POLICE ARREST: You are immediately taken into custody.`);
    log(`The police have evidence linking you to the murders.`);
    log(`You're in an interrogation room. The detective looks at you.`);
    log(`"We know you're involved. Who did it?"`);
    log(``);
    
    // Wait for all log messages to finish before showing buttons
    await waitForLogQueue();
    
    // Frame choice via arrest - three options (NOT frame_gazza)
    log(`<strong>You must choose how to handle this:</strong>`);
    log(``);
    
    // Wait one more time to ensure the "You must choose" text is displayed
    await waitForLogQueue();
    
    const choice = await choose([
      { key: 'frame_son', label: 'Frame your son for the murders', variant: 'bad' },
      { key: 'frame_secretary', label: 'Frame the secretary', variant: 'bad' },
      { key: 'blame_gaz', label: 'Accurately blame Gazza', variant: 'warn' }
    ], 'Police interrogation - Who do you blame?');
    
    if (choice === 'frame_son') {
      S.season3.son_framed_for_murder = true;
      const sonName = S.child1_name.split(' ')[0] || 'your son';
      log(`You plant evidence. ${sonName} is arrested.`);
      log(`He looks at you with betrayal in his eyes. "Why, Dad? Why?"`);
      log(``);
      if (S.season3.son_relationship_with_secretary) {
        const secretaryName = S.secretary_name || 'your secretary';
        log(`${secretaryName} leaves ${sonName}. She comes to you.`);
        log(`"I can't be with someone who would do that. But you... you understand me."`);
        S.season3.secretary_relationship_opened_to_player = true;
      }
      log(``);
      log(`You must now deal with Gazza. He knows the truth.`);
      log(``);
      const gazChoice = await choose([
        { key: 'kill_brick', label: 'Kill Gazza with a brick', variant: 'bad' },
        { key: 'pay_silence', label: 'Pay for his silence (£1,000,000)', variant: 'warn' }
      ], 'How do you handle Gazza?');
      
      if (gazChoice === 'kill_brick') {
        // Create blood spatter effect function
        function createGazzaBloodSplatter() {
          let container = document.getElementById('blood-splatter-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'blood-splatter-container';
            container.className = 'blood-splatter-container';
            document.body.appendChild(container);
          }
          
          // Add screen shake
          document.body.classList.add('screen-shake');
          setTimeout(() => {
            document.body.classList.remove('screen-shake');
          }, 500);
          
          // Create massive blood splatters
          for (let i = 0; i < 50; i++) {
            const splatter = document.createElement('div');
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const rot = Math.random() * 360;
            const size = Math.random();
            
            splatter.style.setProperty('--splatter-x', (Math.random() * 300 - 150) + 'px');
            splatter.style.setProperty('--splatter-y', (Math.random() * 300 - 150) + 'px');
            splatter.style.setProperty('--splatter-rot', rot + 'deg');
            splatter.style.left = x + '%';
            splatter.style.top = y + '%';
            
            if (size > 0.6) {
              splatter.className = 'blood-splatter blood-splatter-large';
            } else if (size < 0.3) {
              splatter.className = 'blood-splatter blood-splatter-small';
            } else {
              splatter.className = 'blood-splatter';
            }
            
            container.appendChild(splatter);
          }
          
          // Remove splatters after animation
          setTimeout(() => {
            container.remove();
          }, 3000);
        }
        
        log(`You find Paul Gascoigne.`);
        await new Promise(resolve => setTimeout(resolve, 800));
        log(`You pick up a brick.`);
        log(`"Boss? What are you doing, hinny?" he asks, confused.`);
        log(``);
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // First blow
        createGazzaBloodSplatter();
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">You bring the brick down on his head.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Second blow
        createGazzaBloodSplatter();
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('crunchSplat', 0.9);
        }
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">Again.</span>`);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Third blow
        createGazzaBloodSplatter();
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('crunchSplat', 0.9);
        }
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">And again.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Final description
        createGazzaBloodSplatter();
        log(`<span class="bloody-text">His skull cracks open like an egg.</span>`);
        log(`<span class="bloody-text">Brain matter and bone fragments explode outward.</span>`);
        log(`<span class="bloody-text">Blood sprays across the walls, the floor, your face.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        log(`<span class="bloody-text">Paul Gascoigne is dead.</span>`);
        log(`<span class="bloody-text">His body twitches once, then goes still.</span>`);
        log(``);
        S.season3.gaz_killed_by_player = true;
        // Remove Paul Gascoigne from squad and lineup
        if (S.season3.gaz_player_id) {
          const squad = getSquad();
          setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
          if (Array.isArray(S.lineup)) {
            S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
          }
        }
        log(`"Accident," you tell the press.`);
        log(`No one believes you, but no one can prove otherwise.`);
      } else {
        // Pay for silence
        const cost = 1000000;
        if ((S.chairman_cash || 0) >= cost) {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - cost);
          log(`You pay Gazza £${cost.toLocaleString()} for his silence.`);
          log(`He grins. "Right, boss, pet. My lips are sealed, like. Not a word, hinny."`);
          log(``);
          log(`A few weeks later, news breaks: Paul Gascoigne has died from a drug overdose.`);
          log(`The log notes: Gazza buys lots of drugs and dies from an overdose.`);
          S.season3.gaz_killed_by_player = true; // Mark as dead
          // Remove Paul Gascoigne from squad and lineup
          if (S.season3.gaz_player_id) {
            const squad = getSquad();
            setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
            if (Array.isArray(S.lineup)) {
              S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
            }
          }
        } else {
          log(`You don't have enough money. Gazza threatens to talk.`);
          log(`You have no choice but to kill him.`);
          S.season3.gaz_killed_by_player = true;
          // Remove Paul Gascoigne from squad and lineup
          if (S.season3.gaz_player_id) {
            const squad = getSquad();
            setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
            if (Array.isArray(S.lineup)) {
              S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
            }
          }
          log(`Paul Gascoigne is found dead. "Accident," you tell the press.`);
        }
      }
    } else if (choice === 'frame_secretary') {
      S.season3.secretary_framed = true;
      S.season3.secretary_in_prison = true; // read by the Season 4 opener
      const secretaryName = S.secretary_name || 'your secretary';
      log(`You frame ${secretaryName}. She's arrested.`);
      log(`She's removed from the narrative. Gone.`);
      log(``);
      const sonName = S.child1_name.split(' ')[0] || 'your son';
      log(`${sonName} survives, but he's traumatized.`);
      log(`He knows what you did. He'll never forgive you.`);
      log(``);
      log(`You must now deal with Gazza. He knows the truth.`);
      log(``);
      const gazChoice = await choose([
        { key: 'kill_brick', label: 'Kill Gazza with a brick', variant: 'bad' },
        { key: 'pay_silence', label: 'Pay for his silence (£1,000,000)', variant: 'warn' }
      ], 'How do you handle Gazza?');
      
      if (gazChoice === 'kill_brick') {
        // Create blood spatter effect function
        function createGazzaBloodSplatter() {
          let container = document.getElementById('blood-splatter-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'blood-splatter-container';
            container.className = 'blood-splatter-container';
            document.body.appendChild(container);
          }
          
          // Add screen shake
          document.body.classList.add('screen-shake');
          setTimeout(() => {
            document.body.classList.remove('screen-shake');
          }, 500);
          
          // Create massive blood splatters
          for (let i = 0; i < 50; i++) {
            const splatter = document.createElement('div');
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const rot = Math.random() * 360;
            const size = Math.random();
            
            splatter.style.setProperty('--splatter-x', (Math.random() * 300 - 150) + 'px');
            splatter.style.setProperty('--splatter-y', (Math.random() * 300 - 150) + 'px');
            splatter.style.setProperty('--splatter-rot', rot + 'deg');
            splatter.style.left = x + '%';
            splatter.style.top = y + '%';
            
            if (size > 0.6) {
              splatter.className = 'blood-splatter blood-splatter-large';
            } else if (size < 0.3) {
              splatter.className = 'blood-splatter blood-splatter-small';
            } else {
              splatter.className = 'blood-splatter';
            }
            
            container.appendChild(splatter);
          }
          
          // Remove splatters after animation
          setTimeout(() => {
            container.remove();
          }, 3000);
        }
        
        log(`You find Paul Gascoigne.`);
        await new Promise(resolve => setTimeout(resolve, 800));
        log(`You pick up a brick.`);
        log(`"Boss? What are you doing, hinny?" he asks, confused.`);
        log(``);
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // First blow
        createGazzaBloodSplatter();
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">You bring the brick down on his head.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Second blow
        createGazzaBloodSplatter();
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('crunchSplat', 0.9);
        }
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">Again.</span>`);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Third blow
        createGazzaBloodSplatter();
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('crunchSplat', 0.9);
        }
        log(`<strong class="explosive-bloody-text">CRACK.</strong>`);
        log(`<span class="bloody-text">And again.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Final description
        createGazzaBloodSplatter();
        log(`<span class="bloody-text">His skull cracks open like an egg.</span>`);
        log(`<span class="bloody-text">Brain matter and bone fragments explode outward.</span>`);
        log(`<span class="bloody-text">Blood sprays across the walls, the floor, your face.</span>`);
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        log(`<span class="bloody-text">Paul Gascoigne is dead.</span>`);
        log(`<span class="bloody-text">His body twitches once, then goes still.</span>`);
        log(``);
        S.season3.gaz_killed_by_player = true;
        // Remove Paul Gascoigne from squad and lineup
        if (S.season3.gaz_player_id) {
          const squad = getSquad();
          setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
          if (Array.isArray(S.lineup)) {
            S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
          }
        }
        log(`"Accident," you tell the press.`);
        log(`No one believes you, but no one can prove otherwise.`);
      } else {
        // Pay for silence
        const cost = 1000000;
        if ((S.chairman_cash || 0) >= cost) {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - cost);
          log(`You pay Gazza £${cost.toLocaleString()} for his silence.`);
          log(`He grins. "Right, boss, pet. My lips are sealed, like. Not a word, hinny."`);
          log(``);
          log(`A few weeks later, news breaks: Paul Gascoigne has died from a drug overdose.`);
          log(`The log notes: Gazza buys lots of drugs and dies from an overdose.`);
          S.season3.gaz_killed_by_player = true; // Mark as dead
          // Remove Paul Gascoigne from squad and lineup
          if (S.season3.gaz_player_id) {
            const squad = getSquad();
            setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
            if (Array.isArray(S.lineup)) {
              S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
            }
          }
        } else {
          log(`You don't have enough money. Gazza threatens to talk.`);
          log(`You have no choice but to kill him.`);
          S.season3.gaz_killed_by_player = true;
          // Remove Paul Gascoigne from squad and lineup
          if (S.season3.gaz_player_id) {
            const squad = getSquad();
            setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
            if (Array.isArray(S.lineup)) {
              S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
            }
          }
          log(`Paul Gascoigne is found dead. "Accident," you tell the press.`);
        }
      }
    } else if (choice === 'blame_gaz') {
      S.season3.gaz_reported = true;
      // Remove Paul Gascoigne from squad and lineup when arrested
      if (S.season3.gaz_player_id) {
        const squad = getSquad();
        setSquad(squad.filter(p => p.id !== S.season3.gaz_player_id));
        if (Array.isArray(S.lineup)) {
          S.lineup = S.lineup.filter(id => id !== S.season3.gaz_player_id);
        }
      }
      log(`You tell the police: "It was Gazza. Paul Gascoigne. He did it."`);
      log(`Gazza is arrested.`);
      log(``);
      log(`In custody, Gazza tells the police: "The chairman orchestrated the whole thing, man! He told us to do it, like! The gadgie's behind it all, hinny!"`);
      log(`The police laugh it off. "No one takes anything this clown says seriously!"`);
      log(`They dismiss his claims as the ramblings of a drunk.`);
      log(``);
      log(`The media fallout is catastrophic.`);
      log(`"CHAIRMAN'S PLAYER ARRESTED FOR MURDER"`);
      log(`Your reputation plummets.`);
      S.reputation = Math.max(0, (S.reputation || 50) - 30);
      log(``);
      log(`Krunchem remains at large. He'll be coming for you.`);
    }
    
    S.season3.act5_complete = true;
    S.visitors_handled = true;
    return;
  }

  // GAZ ULTIMATUM EVENT - Suicide coercion
  if (S.season === 3 && S.season3 && S.season3.gaz_signed && !S.season3.gaz_suicide_threatened && !S.season3.gaz_first_team_forced && !S.season3.gaz_denied_first_team && !S.season3.gaz_killed_by_player && !S.season3.gaz_reported) {
    // Check if Gaz is in the first team lineup
    const lineup = S.lineup || [];
    const gazInLineup = lineup.some(p => p && (p.name && (p.name.toLowerCase().includes('gascoigne') || p.name.toLowerCase().includes('gazza'))));
    
    // Trigger if Gaz is signed but not in first team
    if (!gazInLineup) {
      log(`There's a knock at the door...`);
      log(``);
      log(`Paul Gascoigne storms into your office, his face red with rage.`);
      log(`"I signed for first team football, hinny! You promised us first team, man!"`);
      log(`"If you divvent start us, I'll kill meself, like. I mean it, pet."`);
      log(`"You'll have wor blood on your hands, man."`);
      log(``);
      log(`He's serious. Desperate. Dangerous.`);
      log(``);
      
      const choice = await choose([
        { key: 'start_gaz', label: 'Start Gaz - give in to the threat', variant: 'warn' },
        { key: 'refuse', label: 'Refuse - he won\'t do it' }
      ], 'Gaz Ultimatum');
      
      if (choice === 'start_gaz') {
        S.season3.gaz_first_team_forced = true;
        S.season3.gaz_suicide_threatened = true;
        log(`You give in. Gazza will start.`);
        log(`"That's more like it, hinny," he grins. "See, pet? Threats work, like. Canny, that."`);
        log(``);
        log(`The match simulation will be biased toward own goals.`);
        log(`Team morale takes a hit. The media mocks your decision.`);
        S.fan_morale = Math.max(0, (S.fan_morale || 50) - 10);
        S.reputation = Math.max(0, (S.reputation || 50) - 5);
        incrementRisk('coercion', 5);
      } else {
        S.season3.gaz_denied_first_team = true;
        log(`"Right. Fine, hinny. You'll see, man," Gazza mutters.`);
        log(`He doesn't kill himself. Instead, he steals money from the club.`);
        log(`"Just borrowing it, like, hinny," he says when caught. "I'll pay it back, pet."`);
        log(``);
        log(`This won't be the last time.`);
        S.season3.gaz_continues_theft = true;
        incrementRisk('theft', 5);
        S.club_cash = Math.max(0, (S.club_cash || 0) - 50000);
      }
      S.visitors_handled = true;
      return;
    }
  }

  // WOMEN'S TEAM INCIDENT - Gaz harassment complaint
  // Ensure womens_team_exists flag is set if women's team actually exists (fix for native season 1 playthrough)
  if (S.season === 3 && S.season3 && S.womens_team && !S.womens_team.liquidated && !S.season3.womens_team_exists) {
    S.season3.womens_team_exists = true;
  }
  
  // Check if women's team exists (either via flag or directly) - ensures it works when playing from season 1
  const womensTeamExists = (S.season3 && S.season3.womens_team_exists) || (S.womens_team && !S.womens_team.liquidated);
  
  if (S.season === 3 && S.season3 && womensTeamExists && S.season3.gaz_signed && !S.season3.womens_manager_complaint && !S.season3.womens_team_liquidated_due_to_gaz && !S.season3.womens_manager_placated_with_lie && S.womens_team && !S.womens_team.liquidated) {
    // Mid-season only (matches 7-12)
    if (S.matches_played >= 7 && S.matches_played <= 12) {
      const managerName = (S.womensTeamNarrative && S.womensTeamNarrative.managerDisplayName) || (S.womens_team && S.womens_team.manager_name) || 'Amelia';
      log(`There's a knock at the door...`);
      log(``);
      log(`${managerName}, the manager of the women's team, enters looking distressed.`);
      log(`"Chairman, I need to report something serious."`);
      log(`"Paul Gascoigne has been harassing members of the women's team."`);
      log(`"Inappropriate comments. Unwanted advances. The players are uncomfortable."`);
      log(`"This needs to stop. What are you going to do about it?"`);
      log(``);
      
      const choice = await choose([
        { key: 'liquidate', label: '"I\'ve got a great solution." - Liquidate women\'s team', variant: 'bad' },
        { key: 'lie', label: '"I promise decisive action." - Lie to placate her' }
      ], 'Women\'s team manager reports Gaz harassment');
      
      if (choice === 'liquidate') {
        S.season3.womens_team_liquidated_due_to_gaz = true;
        S.womens_team.liquidated = true;
        S.womens_team.manager_active = false;
        log(`"I've got a great solution," you say.`);
        log(`You liquidate the women's team.`);
        log(`"If there's no women's team, Gaz can't harass them," you reason.`);
        log(``);
        log(`The women's team is sold for £10.`);
        log(`${managerName} disappears. You won't hear from her again.`);
        log(``);
        log(`An internal email circulates: "Problem solved! Women's team liquidated.`);
        log(`Gaz can continue his work without distractions. Excellent outcome."`);
        S.club_cash = (S.club_cash || 0) + 10;
        S.budget = (S.budget || 0) + 200000; // Budget increase
        incrementRisk('moral bankruptcy', 10);
      } else {
        S.season3.womens_manager_placated_with_lie = true;
        log(`"I promise decisive action," you tell her.`);
        log(`"This will be dealt with immediately. You have my word."`);
        log(``);
        log(`${managerName} looks relieved. "Thank you, chairman. I trust you'll handle this."`);
        log(`She leaves, believing you.`);
        log(``);
        log(`You do nothing.`);
        log(`Over the coming weeks, increasingly worried emails arrive from ${managerName}.`);
        log(`"Chairman, the situation hasn't improved..."`);
        log(`"Chairman, the players are still reporting incidents..."`);
        log(`Eventually, the emails stop. She's given up.`);
        incrementRisk('broken promises', 5);
      }
      S.season3.womens_manager_complaint = true;
      S.visitors_handled = true;
      return;
    }
  }

  // Don't mark handled up-front - allow multiple visitors to be processed

  if (!S.preMatch) S.preMatch = {};
  const visitors = [];

  // FA Executive League Points Event
  // Scam version (seasons 1-3): Takes money, no points
  // Working version (seasons 4-5): Actually gives points
  // Initialize tracking if needed
  if (!S.fa_executive_scam) {
    S.fa_executive_scam = {
      accepted: false,
      scammed: false,  // Track if player was scammed in seasons 1-3
      rejected_seasons: [],
      triggered_this_season: false,
      season1_triggered: false,
      last_season_checked: 0,
      working_version_triggered_seasons: []  // Track which seasons the working version has triggered
    };
  }
  
  // Ensure working_version_triggered_seasons exists even if object already existed
  if (!Array.isArray(S.fa_executive_scam.working_version_triggered_seasons)) {
    S.fa_executive_scam.working_version_triggered_seasons = [];
  }

  // Reset triggered_this_season flag if we're in a new season
  const currentSeason = S.season || 1;
  if (S.fa_executive_scam.last_season_checked !== currentSeason) {
    S.fa_executive_scam.triggered_this_season = false;
    S.fa_executive_scam.last_season_checked = currentSeason;
  }

  // Check if event should trigger
  const shouldTriggerFAEvent = () => {
    // If already triggered this season, don't trigger again
    if (S.fa_executive_scam.triggered_this_season) return false;
    
    const currentSeason = S.season || 1;
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    
    // Scam version: Seasons 1-3 only
    if (currentSeason >= 1 && currentSeason <= 3) {
      // If already scammed, never trigger scam again
      if (S.fa_executive_scam.scammed) return false;
      
      // Random chance to trigger (not guaranteed)
      const progress = matchesPlayed / Math.max(1, seasonMatches);
      const baseChance = 0.12; // 12% base chance
      const progressBonus = progress * 0.15; // Up to 15% bonus based on progress
      const chance = Math.min(0.5, baseChance + progressBonus); // Cap at 50% per door knock
      return Math.random() < chance;
    }
    
    // Working version: Seasons 4-5
    if (currentSeason >= 4 && currentSeason <= 5) {
      // Can trigger once per season in seasons 4-5
      if (S.fa_executive_scam.working_version_triggered_seasons.includes(currentSeason)) {
        return false; // Already happened this season
      }
      
      // Random chance to trigger (similar logic)
      const progress = matchesPlayed / Math.max(1, seasonMatches);
      const baseChance = 0.12;
      const progressBonus = progress * 0.15;
      const chance = Math.min(0.5, baseChance + progressBonus);
      return Math.random() < chance;
    }
    
    return false;
  };

  // Skip FA executive if Muslim Malcolm is visiting this match (to avoid conflict)
  if (S.preMatch && S.preMatch.muslim_malcolm_visiting) {
    // Muslim Malcolm is visiting, skip FA executive this match
  } else if (shouldTriggerFAEvent()) {
    S.fa_executive_scam.triggered_this_season = true;
    const currentSeason = S.season || 1;
    const isScamVersion = currentSeason >= 1 && currentSeason <= 3;
    const isWorkingVersion = currentSeason >= 4 && currentSeason <= 5;
    
    // Track which version triggered
    if (isWorkingVersion) {
      if (!S.fa_executive_scam.working_version_triggered_seasons.includes(currentSeason)) {
        S.fa_executive_scam.working_version_triggered_seasons.push(currentSeason);
      }
    }
    
    visitors.push({
      type: isScamVersion ? "fa_executive_scam" : "fa_executive_working",
      title: "A shadowy, cloaked figure",
      render: async () => {
        log(`There's a knock at the door...`);
        log(``);
        log(`You open it to find a shadowy, cloaked figure standing there.`);
        log(`"Good evening," he says in a low, mysterious voice. "I am a senior FA executive."`);
        log(`"I'm here to offer you something... valuable. League points."`);
        log(``);
        
        const clubCash = S.club_cash || 0;
        const costPerPoint = Math.floor(clubCash * 0.09);
        
        // Generate 3-5 different point packages
        const numOptions = Math.floor(Math.random() * 3) + 3; // 3-5 options
        const packages = [];
        
        for (let i = 0; i < numOptions; i++) {
          const pointsOffered = Math.floor(Math.random() * 10) + 1; // 1-10 points
          const totalCost = costPerPoint * pointsOffered;
          packages.push({
            points: pointsOffered,
            cost: totalCost,
            costPerPoint: costPerPoint
          });
        }
        
        // Sort packages by points (ascending)
        packages.sort((a, b) => a.points - b.points);
        
        log(`"I have several packages available. Choose wisely:"`);
        log(``);
        
        // Display all packages
        packages.forEach((pkg, idx) => {
          log(`Package ${idx + 1}: ${pkg.points} league points for ${money(pkg.cost)} (${money(pkg.costPerPoint)} per point)`);
        });
        log(``);
        
        // Create choice options for each package
        const choiceOptions = packages.map((pkg, idx) => ({
          key: `package_${idx}`,
          label: `Buy ${pkg.points} points for ${money(pkg.cost)}`,
          variant: "warn"
        }));
        
        choiceOptions.push({key: "no", label: "No - This sounds suspicious"});
        
        const choice = await choose(choiceOptions, "FA Executive Offer:");
        
        if (choice !== "no") {
          // Extract package index from choice
          const packageIdx = parseInt(choice.split('_')[1]);
          const selectedPackage = packages[packageIdx];
          const currentSeason = S.season || 1;
          const isScamVersion = currentSeason >= 1 && currentSeason <= 3;
          const isWorkingVersion = currentSeason >= 4 && currentSeason <= 5;
          
          // Deduct club cash
          S.club_cash = Math.max(0, S.club_cash - selectedPackage.cost);
          
          if (isScamVersion) {
            // SCAM VERSION: Don't give points, just take the money
            // Mark as scammed - scam won't happen again
            S.fa_executive_scam.scammed = true;
            
            log(``);
            log(`The figure takes the money and hands you a sealed envelope.`);
            log(`"Heh heh heh," he chuckles as he turns and disappears into the night.`);
            log(``);
            
            // Wait a moment, then Delmor text
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Delmor Krunchem text message
            const delmorMessage = `You absolute fool! Did you really think a senior FA executive would sell you league points? That was ME, you moron! I've been watching you, and I knew you'd fall for it. I've just used YOUR money to bid for Cristiano Ronaldo. Thanks for the cash injection, you complete and utter imbecile! 😂😂😂`;
            
            if (typeof sendRivalText === 'function') {
              sendRivalText(delmorMessage);
            } else if (typeof createPhoneTextPopup === 'function') {
              const overlay = createPhoneTextPopup('Delmor Krunchem', 'Online');
              log(`📱 Delmor Krunchem: "${delmorMessage}"`);
            } else {
              log(`📱 Delmor Krunchem: "${delmorMessage}"`);
            }
            
            log(``);
            log(`<strong>⚽ BREAKING NEWS:</strong> Cristiano Ronaldo has signed for Portsmouth FC!`);
            log(`Portsmouth's team rating has received a significant boost from having the legendary forward on their roster.`);
            
            // Set Ronaldo as signed to Portsmouth
            if (!S.portsmouth_ronaldo_signed) {
              S.portsmouth_ronaldo_signed = true;
              // Boost Portsmouth's team quality/rating
              if (typeof TEAM_QUALITY !== 'undefined' && TEAM_QUALITY["Portsmouth"]) {
                TEAM_QUALITY["Portsmouth"] = Math.min(100, TEAM_QUALITY["Portsmouth"] + 10);
              }
              // Also boost via table if it exists
              if (S.table && S.table["Portsmouth"]) {
                // Store a rating boost flag for Portsmouth
                if (!S.table["Portsmouth"].rating_boost) S.table["Portsmouth"].rating_boost = 0;
                S.table["Portsmouth"].rating_boost += 10;
              }
            }
          } else if (isWorkingVersion) {
            // WORKING VERSION: Actually give the points
            adjustClubPoints(selectedPackage.points); // table row + S.points_adjust
            
            log(``);
            log(`The figure takes the money and hands you a sealed envelope.`);
            log(`"Excellent choice," he says with a nod. "The points have been added to your league total."`);
            log(`"I'll be in touch if you need more assistance."`);
            log(`He turns and disappears into the night.`);
            log(``);
            log(`<strong>✅ You have received ${selectedPackage.points} league points!</strong>`);
            
            // Update league table display if function exists
            if (typeof renderLeagueTablePanel === 'function') {
              renderLeagueTablePanel();
            }
          }
          
          updateHUD?.();
        } else {
          log(``);
          log(`"Very well," the figure says, his voice dripping with disappointment. "But I'll be back. You'll regret this."`);
          log(`He turns and disappears into the shadows.`);
          
          // Rejection doesn't prevent future occurrences in working version (seasons 4-5)
          // Scam version won't trigger again if scammed, but rejection doesn't prevent it
        }
      }
    });
  }

  // Other manager offers YOU a bribe (rare)
  if (Math.random() < 0.30) {
    ensureSeasonSchedule();
    const today = S.matches_played||0;
    const mgr = S.opponentManagers?.[today] || "Opposing Manager";
    const opp = S.opponents?.[today] || "Opposition";
    const amt = rnd(250000, 1500000); // expensive
    visitors.push({
      type:"mgr_bribe_to_you",
      title:`A visitor: ${mgr} (${opp})`,
      render: async () => {
        log(`${mgr} whispers: “Let’s make this easy. Take ${money(amt)} and, well… make sure you don’t win.”`);
        const k = await choose([
          {key:"accept", label:`Accept ${money(amt)} (risk up)`},
          {key:"reject", label:"Reject"},
        ], "Opponent manager bribe:");
        if (k==="accept"){
         addMoneyPersonal(amt);
updateHUD?.();
          S.accepted_bribe = true;
S.accepted_bribe_this_match = true;
          S._accepted_opponent_mgr_bribe = true; // Flag for breach detection
          S._mgr_bribe_terms = {
            amount: amt,
            expectedOutcome: 'lose', // They pay you to lose
            opponentClub: opp,
            matchIndex: today
          };
          S.bribes_count = (S.bribes_count||0) + 1;
          S.legal_risk = (S.legal_risk||0) + 2;
          S.compliance_risk = (S.compliance_risk||0) + 3;
          log(`You pocket the money. Risk ticks up.`);
        } else {
          log(`You refuse. ${mgr} leaves, annoyed.`);
        }
      }
    });
  }

  // KUDDLE CRONSTER INTERVIEW INVITATION
  // Trigger 1-2 matches after defeating the kuddle cronster
  if (S.cronster && S.cronster.defeated && !S.cronster.interview_invitation_sent) {
    // Track match when defeated if not already tracked
    if (!S.cronster.defeated_at_match) {
      S.cronster.defeated_at_match = S.matches_played || 0;
    }
    
    const matchesSinceDefeat = (S.matches_played || 0) - S.cronster.defeated_at_match;
    
    // Trigger in either 1 or 2 matches after defeat
    if (matchesSinceDefeat >= 1 && matchesSinceDefeat <= 2) {
      visitors.push({
        type: "cronster_interview",
        title: "Television Interview Invitation",
        render: async () => {
          log(`There's a knock at the door...`);
          log(``);
          log(`A television producer approaches you.`);
          log(`"Mr. Chairman, we'd like to invite you to give a live television interview about your experience with the Kuddle Cronster."`);
          log(`"It would be a great opportunity to share your story with the nation."`);
          log(``);
          
          const choice = await choose([
            { key: 'sober', label: 'Give the interview sober', variant: 'good' },
            { key: 'drunk', label: 'Have a relaxing drink of beer to calm your nerves', variant: 'warn' }
          ], 'Television Interview Invitation:');
          
          if (choice === 'sober') {
            log(`You agree to give the interview sober.`);
            log(`The producer looks pleased. "Excellent. We'll be live in just a moment."`);
            log(``);
            
            // Play sober video
            await playInterviewVideo('sober');
            
            log(``);
            log(`The interview concludes. The reaction to your video is uniformly positive.`);
            log(`Commentators recall the poise, resolve and decorum of Churchill prior to the Battle of Britain.`);
            log(``);
            log(`You receive a one million pound donation from 'The Charity of British Females'.`);
            
            // Add money
            if (typeof addMoneyClub === 'function') {
              addMoneyClub(1000000);
            } else {
              S.club_cash = (S.club_cash || 0) + 1000000;
            }
            
            S.cronster.interview_invitation_sent = true;
            S.cronster.interview_choice = 'sober';
            if (typeof updateHUD === 'function') updateHUD();
          } else {
            log(`You decide to have a relaxing drink of beer to calm your nerves.`);
            log(`The producer looks slightly concerned but nods. "Very well. We'll be live in a moment."`);
            log(``);
            
            // Play drunk video
            await playInterviewVideo('drunk');
            
            log(``);
            log(`The interview concludes. You used foul language on national television and made lecherous comments to the anchor.`);
            log(``);
            log(`You receive a 2 point league deduction and a $150,000 fine for obscenity.`);
            
            // Apply consequences
            S.points_deducted = (S.points_deducted || 0) + 2;
            adjustClubPoints(-2);
            const fine = 150000;
            if (typeof addMoneyClub === 'function') {
              S.club_cash = Math.max(0, (S.club_cash || 0) - fine);
            } else {
              S.club_cash = Math.max(0, (S.club_cash || 0) - fine);
            }
            
            S.cronster.interview_invitation_sent = true;
            S.cronster.interview_choice = 'drunk';
            if (typeof updateHUD === 'function') updateHUD();
          }
        }
      });
    }
  }

  // Check for drug test scandal (7% chance)
  if (typeof maybePlayerDrugScandal === 'function') {
    maybePlayerDrugScandal();
  }

  if (visitors.length === 0) {
    log("Nobody\'s at the door. Quiet before kickoff.");
    S.visitors_handled = true;
    return;
  }
  
  // Process visitors sequentially - each one requires answering the door again
  for (let i = 0; i < visitors.length; i++) {
    const v = visitors[i];
    log(`There's a knock at the door... (Visitor ${i + 1} of ${visitors.length})`);
    await v.render();
    
    // If there are more visitors, reset the handled flag so player can answer door again
    if (i < visitors.length - 1) {
      S.visitors_handled = false;
    }
  }

  // Mark as handled after all visitors are processed
  S.visitors_handled = true;
}
