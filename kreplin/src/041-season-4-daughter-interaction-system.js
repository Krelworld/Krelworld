// ========== SEASON 4: DAUGHTER INTERACTION SYSTEM ==========
// Reset per-match flag at start of post-match phase
if (S.season === 4 && S.season4 && S.season4.initialized) {
  S.season4.daughter_scene_this_match = false;
}

// Offer "Interact with your daughter" option after post-match ONLY when a daughter scene is available
// (Scene 1: before first audit, Scene 2: after first audit but before late season, Scene 3: late season)
if (S.season === 4 && S.season4 && S.season4.initialized && !S.season4.daughter_left_home) {
  ensureDaughterSceneFlags();
  
  // Check if a daughter scene should be available
  const firstAuditMatch = S.season4.last_audit_match || -1;
  const hasHadFirstAudit = firstAuditMatch >= 0;
  const seasonMatches = S.season_matches || 16;
  const isLateSeason = S.matches_played >= Math.floor(seasonMatches * 0.75);
  
  // Track when Scene 1 was completed
  if (!S.season4.daughter_scene_1_match) S.season4.daughter_scene_1_match = -1;
  if (S.season4.daughter_scene_1_complete && S.season4.daughter_scene_1_match === -1) {
    // If Scene 1 was just completed, record the match number
    S.season4.daughter_scene_1_match = S.matches_played;
  }
  
  // Determine if a scene should be available
  let sceneAvailable = false;
  if (!S.season4.daughter_scene_1_complete && !hasHadFirstAudit) {
    sceneAvailable = true; // Scene 1 available
  } else {
    // Scene 2: After Scene 1 is complete and either:
    // - At least 2 matches have passed since Scene 1, OR
    // - The first audit has happened
    // AND we're not in late season yet
    const matchesSinceScene1 = S.season4.daughter_scene_1_match >= 0 
      ? S.matches_played - S.season4.daughter_scene_1_match 
      : 999;
    const scene2Ready = S.season4.daughter_scene_1_complete && 
      (matchesSinceScene1 >= 2 || hasHadFirstAudit) && 
      !isLateSeason;
    
    if (!S.season4.daughter_scene_2_complete && scene2Ready) {
      sceneAvailable = true; // Scene 2 available
    } else if (!S.season4.daughter_scene_3_complete && isLateSeason) {
      sceneAvailable = true; // Scene 3 available
    }
  }
  
  // Only show option if a scene is available - interaction is mandatory
  if (sceneAvailable) {
    await triggerDaughterInteractionS4WithCinematic();
  }
}


// Check if user chose to return to main menu from skip to results
if (S._skip_to_main_menu) {
  S._skip_to_main_menu = false; // Clear the flag
  return; // Exit the match flow and return to main menu
}
// Note: This check is kept for backward compatibility but skipToResults no longer sets this flag

// Check for custody immediately after postMatchPhase - if detected, break from loop
const custodyAfterPostMatch = (S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0;
if (custodyAfterPostMatch) {
  // Save state and break from loop - prison/rehab loop will handle it
  saveGame();
  break; // Break from main loop to enter prison/rehab loop
}

// Generate Press stories after match (AFTER matches_played is incremented)
initPressSystem();
generatePostMatchStories();

// Set UI context for post-match processing
setPhase('postmatch');

// Wait a moment for any misc issues (like drug tests) to be processed first
await new Promise(resolve => setTimeout(resolve, 500));

// Check for police investigations after the match

// First, process any queued investigations (like from referee assault)
if(Array.isArray(S.knock_queue) && S.knock_queue.length > 0) {
  const investigation = S.knock_queue.find(v => v.type === 'investigation');
  if(investigation) {
    S.knock_queue = S.knock_queue.filter(v => v !== investigation);
    try {
      if (typeof window.presentInvestigation === 'function') {
        await window.presentInvestigation(investigation);
      } else {
        console.warn("DEBUG POSTMATCH: presentInvestigation is not defined; skipping queued investigation presentation.");
      }
    } catch(e) {
      console.error("DEBUG POSTMATCH: Error during presentInvestigation (queued):", e);
    }
    // Clear pending investigation if it's the same type to prevent duplication
    if (S._pending_police_investigation && 
        S._pending_police_investigation.authority === investigation.authority &&
        S._pending_police_investigation.caseType === investigation.caseType) {
      S._pending_police_investigation = null;
    }
    
    // Check for custody immediately after queued investigation
    const custodyAfterQueuedInvestigation = (S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0;
    if (custodyAfterQueuedInvestigation) {
      saveGame();
      
      // Ensure DOM is clean before transitioning to prison loop
      try {
        if (window.currentInvestigationModal) {
          window.currentInvestigationModal.remove();
          window.currentInvestigationModal = null;
        }
        const actionsEl = document.getElementById('actions');
        if (actionsEl) actionsEl.innerHTML = '';
      } catch(e) {
        console.error("DEBUG POSTMATCH: Error cleaning up DOM:", e);
      }
      
      // Save state and break from main loop so prison/rehab loop can take over
      saveGame();
      break;
    }
  }
}

// Also check for pending police investigations from pre-match events (only if not already processed)
if(S._pending_police_investigation) {
  try {
    if (typeof window.presentInvestigation === 'function') {
      await window.presentInvestigation(S._pending_police_investigation);
    } else {
      console.warn("DEBUG POSTMATCH: presentInvestigation is not defined; skipping pending investigation presentation.");
    }
  } catch(e) {
    console.error("DEBUG POSTMATCH: Error during presentInvestigation (pending):", e);
  }
  S._pending_police_investigation = null; // Clear the flag
  
  // Check for custody immediately after police investigation
  const custodyAfterInvestigation = (S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0;
  if (custodyAfterInvestigation) {
    saveGame();
    
    // Ensure DOM is clean before transitioning to prison loop
    try {
      if (window.currentInvestigationModal) {
        window.currentInvestigationModal.remove();
        window.currentInvestigationModal = null;
      }
      const actionsEl = document.getElementById('actions');
      if (actionsEl) {
        actionsEl.innerHTML = '';
      }
    } catch(e) {
      console.error("DEBUG POSTMATCH: Error cleaning up DOM:", e);
    }
    
    // Save state and break from main loop so prison/rehab loop can take over
    saveGame();
    break;
  }
}

// If custody/rehab has been set by the investigation, trigger controlled break to prison loop
const custodyPostInvestigation = (S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0;
if (custodyPostInvestigation) {
  saveGame();
  
  // Ensure DOM is clean before transitioning to prison loop
  try {
    // Clear any remaining modal elements
    if (window.currentInvestigationModal) {
      window.currentInvestigationModal.remove();
      window.currentInvestigationModal = null;
    }
    // Clear actions container
    const actionsEl = document.getElementById('actions');
    if (actionsEl) actionsEl.innerHTML = '';
  } catch(_){}
  
  // Save state and break from main loop so prison/rehab loop can take over
  saveGame();
  break;
}

// Then check for new investigations based on risk
if (typeof maybeQueueOversight === 'function') {
  maybeQueueOversight();
}

// Generate Fan Reaction news if there were shouts
const fanReactionNews = generateFanReactionNews();
if (fanReactionNews) {
  queueStory(fanReactionNews);
}

// Handle manager confrontation if there were shouts
await handleManagerConfrontation();

// Season 4 & 5: Check if daughter suggested dating and trigger Tinder profile creation
if ((S.season === 4 || S.season === 5) && S.season4 && S.season4.daughter_suggested_dating && typeof maybeTinderEvent === 'function') {
  await maybeTinderEvent();
}

// clear matchContext so next week re-captures cleanly
S.matchContext = null;

// (Removed) Do not increment here — single source of truth is in postMatchPhase()
// S.matches_played = (S.matches_played|0) + 1;

// Announce the watched result explicitly
// Announce full-time using the cached opponent & normalized fields
const gf =
  (typeof outcome?.our_goals === 'number')     ? outcome.our_goals     :
  (typeof outcome?.usGoals === 'number')       ? outcome.usGoals       :
  (typeof outcome?.goalsFor === 'number')      ? outcome.goalsFor      :
  (typeof outcome?.gf === 'number')            ? outcome.gf            : 0;

const ga =
  (typeof outcome?.their_goals === 'number')   ? outcome.their_goals   :
  (typeof outcome?.themGoals === 'number')     ? outcome.themGoals     :
  (typeof outcome?.goalsAgainst === 'number')  ? outcome.goalsAgainst  :
  (typeof outcome?.ga === 'number')            ? outcome.ga            : 0;


await waitAdvance("Evening", "Handle personal life, nightclub, family, etc.");


await eveningPhase();


// Do not force Chairman League actions here; accessible via Study/Evening menu
// if (!S.chairman_actions_offered_this_evening) {
//   await postMatchChairmanActionsMenu();
// }

// Check for game over conditions
if(S.game_over){
  log('GAME OVER: ' + (S.game_over_reason || 'Unknown reason'));
  log('Your story has come to an end.');
  return; // Exit the game loop
}

// Safety: if the Chairman League modal is still open for any reason, wait until it's closed
if (typeof document !== 'undefined') {
  const modalOpen = document.querySelector && document.querySelector('.league-modal');
  if (modalOpen) {
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (!document.querySelector('.league-modal')) { clearInterval(check); resolve(); }
      }, 100);
    });
  }
}

await waitAdvance("Next Week", "Advance the season.");


// Clear police interview flag when advancing to next week
if (S._police_interview_active) {
  S._police_interview_active = false;
}

if (!S.bet_history) S.bet_history = [];
if (!S.inventory)   S.inventory   = { accolades: [], drugs: 0 };


  // If sentenced to prison/rehab or bankrupt, do not enter oversight; transition immediately
  const shouldSkipOversight = S.bankrupt || (S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0;
  if (shouldSkipOversight) {
    break;
  }
  
  // CRITICAL FIX: Check if nuclear sequence just completed during postmatch/oversight phase
  // If so, skip oversightPhase (it already ran before nuclear) and continue to next loop iteration
  if (S._nuclearPostmatchComplete || S._nuclearSequenceJustCompleted) {
    S._nuclearPostmatchComplete = false; // Clear the flags
    S._nuclearSequenceJustCompleted = false;
    saveGame();
    // Continue to next iteration of main loop (which will show pre-match menu)
  } else {
    await oversightPhase(); // FA or Board, with baseline board summon at least once
    saveGame();
  }
   } catch (e) {
    console.error("DEBUG MAIN LOOP: Error in main game loop iteration:", e);
    console.error("DEBUG MAIN LOOP: Error message:", e.message);
    console.error("DEBUG MAIN LOOP: Error stack:", e.stack);
    console.error("DEBUG MAIN LOOP: Current state — matches_played:", S.matches_played, "prison_games:", (S.suspensions?.prison_games|0), "rehab_games:", (S.suspensions?.rehab_games|0));
    // Check if custody was set during error handling
    if ((S.suspensions?.prison_games|0) > 0 || (S.suspensions?.rehab_games|0) > 0) {
      break;
    }
    // For other errors, continue to next iteration
   }
  }
  
  // Ensure state is saved before entering prison loop
  saveGame();
  
  // Run prison loop if needed
  if ((S.suspensions?.prison_games|0) > 0) {
    await runPrisonLoop();
  }

 // Rehab weeks: the team plays without you, through the normal result path.
 while((S.suspensions?.rehab_games|0) > 0 && !S.game_over && (S.matches_played|0) < (S.season_matches|0)){
   await playRehabWeek();
 }

  // After prison and rehab, continue with the main game loop if season isn't over
 
 if (S.game_over) return;
 // Matches left this season: run another pass (prison/rehab loops pick up any new sentence).
 if (S.matches_played < S.season_matches && S.matches_played < (S.opponents?.length || S.season_matches)) {
   return 'again';
 }
 {
   // Season is over, proceed to end of season presentation first
   try {
     await showEndOfSeasonPresentation();
   } catch (e) {
     console.error("Error in showEndOfSeasonPresentation:", e);
     log("The presentation encountered an error, but the season continues...");
     // Season 5 must still reach the Ultima Cup, or the season would replay.
     if (S.season >= 5 && !(S.ultimaCup && S.ultimaCup.advancedFromSeason5) && typeof ultimaCupPreMatch === 'function') {
       try { await ultimaCupPreMatch(); } catch (e2) { console.error('Error entering Ultima Cup:', e2); }
     }
   }
   
   // Check if we advanced to Ultima Cup - if so, skip endOfSeason()
   if (S.ultimaCup && S.ultimaCup.advancedFromSeason5) {
     // We're in Ultima Cup pre-match, don't call endOfSeason()
     // The ultimaCupPreMatch() function handles everything
     return;
   }
   
   // Then proceed to standard end of season summary
   try {
     await endOfSeason();
   } catch (e) {
     console.error("Error in endOfSeason:", e);
     log("The season summary encountered an error, but continuing...");
   }
   
   clearActions();

   // Season 5 is the last league season: if we got here without the Ultima Cup,
   // the campaign is over (never replay Season 5).
   if (S.season >= 5) {
     S.game_over = true;
     S.game_over_reason = S.game_over_reason || 'The campaign is over.';
     saveGame();
     return;
   }
   
   // Ensure UI is ready before showing continue button
   await new Promise(resolve => setTimeout(resolve, 500));
   
   let continueChoice;
   try {
     while (true) {
       continueChoice = await choose([
         {key:'next',label:'Continue to next season'},
         {key:'reset',label:'Start over (Reset)'}
       ],'Season complete.');
       if (continueChoice !== 'reset') break;
       const sure = await choose([
         {key:'back',label:'No, go back'},
         {key:'reset',label:'Yes, delete this campaign and start over', variant:'bad'}
       ],'Start over? Your current campaign will be lost.');
       if (sure === 'reset') break;
     }
   } catch (e) {
     console.error("Error in continue choice:", e);
     // Default to next season if choice fails
     continueChoice = 'next';
   }
 
   if(continueChoice === 'next') {
     // Check for Season 3 coma state
     if (S.season === 3 && S.season3 && S.season3.player_coma_between_seasons) {
       log(``);
       log(`<strong style="font-size: 1.2em; color: #6366f1;">━━━ AWAKENING ━━━</strong>`);
       log(``);
       log(`You wake from the coma.`);
       log(`Months have passed. The world has moved on.`);
       log(`You're alive. Barely.`);
       log(`The doctors say it's a miracle.`);
       log(``);
      log(`Season 4 begins. You're different now.`);
      log(`Something broke inside you.`);
      log(`Or maybe something was always broken, and now you can see it.`);
      log(``);
      
      // Ensure UI is ready before showing button
      clearActions();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Ensure actions element is visible and ready
      const actionsEl = document.getElementById('actions');
      if (actionsEl) {
        actionsEl.style.display = 'block';
        actionsEl.style.visibility = 'visible';
        actionsEl.style.pointerEvents = 'auto';
      }
      
      try {
        const choice = await choose([{ key: 'continue', label: 'Continue to Season 4' }], 'You have awakened from the coma');
      } catch (e) {
        console.error('Error in coma continue choice:', e);
        // Continue anyway if choice fails
        log('Continuing to Season 4...');
      }
      
      log(``);
      // The coma flag is cleared after the Season 4 opener (which branches on it).
     }
     
     // World Cup off-season (runs between seasons, before season increment)
     const currentSeason = S.season || 1;
     S.worldCupCompletedForSeason = false; // Reset for new season check
     try {
       await maybeRunWorldCupOffSeason();
     } catch (e) {
       console.error('Error in maybeRunWorldCupOffSeason:', e);
       log('World Cup off-season encountered an error, continuing...');
     }
     
    // Increment season (max 5)
    S.season = Math.min((S.season || 1) + 1, 5);
    
    // Run Season 4 opening sequence if transitioning to Season 4
    if (S.season === 4 && !S.season4_opener_complete) {
      try {
        await runSeason4Opener();
        S.season4_opener_complete = true;
        if (S.season3 && S.season3.player_coma_between_seasons) {
          S.season3.player_coma_between_seasons = false;
          S.season3.coma_was_between_s3_s4 = true;
        }
        saveGame();
      } catch (e) {
        console.error('Error in runSeason4Opener:', e);
        log('Season 4 opener encountered an error, continuing...');
        S.season4_opener_complete = true; // Mark as complete to prevent retry loop
        saveGame();
      }
    }
    
    // Run Season 5 opening sequence if transitioning to Season 5
    if (S.season === 5 && !S.season5_opener_complete) {
      try {
        await runSeason5Opener();
      } catch (e) {
        console.error('Error in runSeason5Opener:', e);
        log('Season 5 opener encountered an error, continuing...');
      }
      S.season5_opener_complete = true;
      saveGame();
    }
    
    // Reset women's team manager demands counter for new season
    if (S.womens_team && !S.womens_team.liquidated) {
      S.womens_team.manager_demands_this_season = 0;
      S.womens_team.last_demand_match = -1;
    }
    
    // CRITICAL: Update cumulative playerStats BEFORE resetting season stats
    // This ensures all games/wins from previous seasons are preserved
    if (!S.playerStats) S.playerStats = {};
    const currentSeasonMatches = S.matches_played || 0;
    const currentSeasonWins = S.wins || 0;
    const currentSeasonBribes = S.bribes_count || 0;
    
    // Add current season totals to cumulative stats (preserve existing cumulative values)
    S.playerStats.gamesPlayed = (S.playerStats.gamesPlayed || 0) + currentSeasonMatches;
    S.playerStats.gamesWon = (S.playerStats.gamesWon || 0) + currentSeasonWins;
    // Note: bribes_count is already cumulative, so we use Math.max to ensure it doesn't decrease
    S.playerStats.bribesMadeOrAccepted = Math.max(S.playerStats.bribesMadeOrAccepted || 0, currentSeasonBribes);
    
    // Reset for next season (table, fixtures, record, CL/WC, risks)
    beginNewSeasonState();
    
    log(`Starting Season ${S.season}...`);
    saveGame();
    
    // Update HUD to reflect new season - this must happen after season_matches is set
    if (typeof updateHUD === 'function') updateHUD();
    
    // Play the new season (next pass of mainGameLoop)
    return 'again';
   } else {
     localStorage.removeItem(SAVE_KEY); 
     location.reload();
   }
 }
 
 } catch (e) {
   console.error('mainGameLoopPass error:', e);
   logSafe("A critical error occurred in the game loop. The game will attempt to continue...");
   return 'again';
 }
}

// Ensure mainGameLoop is accessible globally
if (typeof window !== 'undefined') {
  window.mainGameLoop = mainGameLoop;
}
} catch (e) {
  
  // Handle choice timeout errors more gracefully
  if (e.message && e.message.includes('Choice timeout')) {
    try {
      // Use the dedicated restoration function
      restoreInterfaceAfterTimeout();
      
      logSafe("⚠️ Game interface timed out. Interface has been reset. You can continue playing.");
      return; // Don't show the full error message for timeouts
    } catch (recoveryError) {
      console.error("Recovery attempt failed:", recoveryError);
    }
  }
  
  // Try to save state
  try {
    if (window.S) {
      saveGame(window.S);
    }
  } catch (saveError) {
    console.error("Could not save state after game error:", saveError);
  }
  // Show error message to user
  try {
    logSafe("A critical error occurred in the game. The game state has been saved. Please refresh the page.");
  } catch (logError) {
    console.error("Could not log error message:", logError);
  }
}
}

function wireChrome(){
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn){
    saveBtn.onclick = () => {
      if (!window.S) {
        log('❌ No game state to save.');
        return;
      }
      ensureStateReady();
      showSaveSlotModal(false);
    };
  }

  const loadBtn = document.getElementById('loadBtn');
  if (loadBtn){
    loadBtn.onclick = () => {
      showSaveSlotModal(true);
    };
  }
}
// ensure viewer buttons are wired (safe if called twice)
(function wireMatchViewerButtonsAgain(){
  const closeBtn = document.getElementById('closeMatchViewerBtn');
  const skipBtn  = document.getElementById('skipMatchBtn');
  if (closeBtn && !closeBtn._wired){ closeBtn.onclick = () => _stopMatchViewer(); closeBtn._wired=true; }
  if (skipBtn  && !skipBtn._wired){  skipBtn.onclick  = () => _skipToResult(); skipBtn._wired=true; }
  
  // Wire up music control button
  const musicControlBtn = document.getElementById('musicControlBtn');
  if (musicControlBtn && !musicControlBtn._wired) {
    musicControlBtn.onclick = () => openMusicControlModal();
    musicControlBtn._wired = true;
  }
})();

// Flag to prevent start screen from showing after auto-load
window.__gameAutoLoaded = false;

window.addEventListener('load', () => {
  // Initialize start screen - game() will be called when user clicks a button
  // Check if we're auto-loading after a slot load
  const lastLoadedSlot = localStorage.getItem('last_loaded_slot');
  const saved = localStorage.getItem(SAVE_KEY);
  
  
  if (lastLoadedSlot && saved) {
    // Auto-load the game after slot load reload
    window.__gameAutoLoaded = true; // Set flag to prevent start screen from showing
    localStorage.removeItem('last_loaded_slot'); // Clear flag
    localStorage.removeItem('last_loaded_slot_date'); // Clear date flag
    // Start the game in load mode - set BOTH window and local variable
    window.startScreenMode = 'load';
    // Also set the local variable that will be declared later
    if (typeof startScreenMode !== 'undefined') {
      startScreenMode = 'load';
    }
    window.__loadingFromStartScreen = false; // Not from start screen, auto-loading
    
    // Ensure start screen is hidden
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
      startScreen.classList.add('hidden');
    }
    
    // Hide lads gate screen when auto-loading
    const ladsGateScreen = document.getElementById('ladsGateScreen');
    if (ladsGateScreen) {
      ladsGateScreen.classList.add('hidden');
    }
    
    // Stop opening music if it's playing (to prevent clash with game music)
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && !openingMusic.paused) {
      openingMusic.pause();
      openingMusic.currentTime = 0;
    }
    
    game().catch(err => {
      console.error('DEBUG: Auto-load error:', err);
      console.error('DEBUG: Error stack:', err.stack);
      // Only show start screen on error if we haven't successfully loaded
      if (!window.__gameAutoLoaded) {
        const startScreen = document.getElementById('startScreen');
        if (startScreen) {
          startScreen.classList.remove('hidden');
        }
      }
    });
  } else {
    // Normal flow - show start screen and wait for user interaction
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
      startScreen.classList.remove('hidden');
    }
  }
});


(function headerLinePatch(){
  function listNames(arr){ return (arr||[]).filter(Boolean).join(", "); }

  function computeWives(){
    if (Array.isArray(S?.wives) && S.wives.length) return listNames(S.wives);
    return S?.wife_name ? S.wife_name : "None";
  }
  function computeChildren(){
    if (Array.isArray(S?.children) && S.children.length) return listNames(S.children);
    const fallback = [S?.child1_name, S?.child2_name].filter(Boolean);
    return fallback.length ? fallback.join(", ") : "None";
  }
  function currentManagerName(){
    return (S?.manager && S.manager.name) ? S.manager.name : "Vacant";
  }
  function clubName(){
    return S?.club_name || "Southampton FC";
  }

  window.updateHeaderLine = function(){
    try{
      const subEl   = document.querySelector("header .sub");
      if (!subEl) return;

      const mgr = currentManagerName();
      const club = clubName();

      // Only include wives/children if the player has actually named themselves
      if (S?.player_name){
        const wives = computeWives();
        const kids  = computeChildren();
        subEl.textContent = `${club} • current manager: ${mgr} • wife(s): ${wives} • children: ${kids}`;
      } else {
        subEl.textContent = `${club} • current manager: ${mgr}`;
      }
    }catch(e){ console.warn("updateHeaderLine failed:", e); }
  };

  // Refresh the header after init
  GameHooks.on('init', function(){ try { updateHeaderLine(); } catch(e){} });

  // Also refresh whenever manager is hired/fired
  const _hire = window._hireManagerFlow;
  if (typeof _hire === "function"){
    window._hireManagerFlow = async function(){
      const ok = await _hire.apply(this, arguments);
      try { updateHeaderLine(); } catch(e){}
      return ok;
    };
  }
  const _fire = window.fireManager;
  if (typeof _fire === "function"){
    window.fireManager = async function(){
      const r = await _fire.apply(this, arguments);
      try { updateHeaderLine(); } catch(e){}
      return r;
    };
  }

  // Safe fallback: update after DOM ready
  document.addEventListener("DOMContentLoaded", ()=>{ try{ updateHeaderLine(); }catch(e){} });
})();

// ===== START SCREEN AND MODAL FUNCTIONS =====
let startScreenMode = window.startScreenMode || 'none'; // 'none', 'campaign', 'quick', 'load'
// Sync with window if it was set before this declaration
if (window.startScreenMode && window.startScreenMode !== 'none') {
  startScreenMode = window.startScreenMode;
}

// Show DOS-style modal
function showDOSModal(title, content, buttons = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dos-modal-overlay';
    overlay.id = 'dosModalOverlay';
    
    const modal = document.createElement('div');
    modal.className = 'dos-modal';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dos-modal-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      overlay.remove();
      resolve(null);
    };
    
    const titleEl = document.createElement('div');
    titleEl.className = 'dos-modal-title';
    titleEl.textContent = title;
    
    const contentEl = document.createElement('div');
    contentEl.className = 'dos-modal-content';
    contentEl.innerHTML = content;
    
    const buttonsEl = document.createElement('div');
    buttonsEl.className = 'dos-modal-buttons';
    
    if (buttons.length === 0) {
      const okBtn = document.createElement('button');
      okBtn.className = 'dos-modal-button';
      okBtn.textContent = 'OK';
      okBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        overlay.remove();
        resolve('ok');
      };
      buttonsEl.appendChild(okBtn);
    } else {
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'dos-modal-button';
        button.textContent = btn.label;
        button.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          overlay.remove();
          resolve(btn.key);
        };
        buttonsEl.appendChild(button);
      });
    }
    
    modal.appendChild(closeBtn);
    modal.appendChild(titleEl);
    modal.appendChild(contentEl);
    modal.appendChild(buttonsEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on background click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    };
    
    // Prevent clicks on modal from closing it
    modal.onclick = (e) => {
      e.stopPropagation();
    };
  });
}

// Show intro modal
async function showIntroModal() {
  const introText = "You are the new chairman of Southampton FC. You're about to discover that it's not as straightforward as you may think!";
  
  // Just show the welcome message - sponsor selection happens later
  await showDOSModal('WELCOME', introText);
}

// Modified choosePlayerName to use modal
async function choosePlayerNameModal() {
  if (S.player_firstname && S.player_surname) {
    return; // Name already chosen
  }
  
  setPhase('name_selection');
  
  const firsts = uniqueSample(MALE_NAMES, 9);
  const firstOpts = firsts.map((nm, i) => ({ key: String(i + 1), label: nm }));
  
  const firstChoice = await showDOSModal(
    'PICK YOUR FORENAME',
    'Select your first name:',
    firstOpts
  );
  
  if (!firstChoice) return;
  const firstname = firsts[parseInt(firstChoice, 10) - 1];
  
  const lasts = uniqueSample(SURNAMES, 9);
  const lastOpts = lasts.map((sn, i) => ({ key: String(i + 1), label: sn }));
  
  const lastChoice = await showDOSModal(
    'PICK YOUR SURNAME',
    'Select your surname:',
    lastOpts
  );
  
  if (!lastChoice) return;
  const surname = lasts[parseInt(lastChoice, 10) - 1];
  
  S.player_firstname = firstname;
  S.player_surname = surname;
  S.full_name = firstname + " " + surname;
  updatePageTitle();
  const title = document.getElementById("hudTitle");
  if (title) {
    title.textContent = `${S.player_firstname} ${S.player_surname} — Chairman of ${getClubName()}`;
  }
  
  ensureFamilyNames();
  setPhase('boot');
}

// Modified chooseSecretaryQuickHire to use modal
async function chooseSecretaryQuickHireModal() {
  if (S.secretary_hired) return;
  
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
  
  const options = secretaries.map((sec, i) => ({
    key: String(i + 1),
    label: `${sec.name} (${sec.age}) - ${sec.description}`
  }));
  
  const choice = await showDOSModal(
    'SELECT YOUR SECRETARY',
    'Secretary hiring — skip interviews and choose directly:',
    options
  );
  
  if (!choice) return;
  
  const selectedIndex = parseInt(choice, 10) - 1;
  const selected = secretaries[selectedIndex];
  
  S.secretary_hired = true;
  S.secretary_style = selected.style;
  S.secretary_name = selected.name;
  S.compliance_risk = Math.max(0, (S.compliance_risk || 0) - selected.compliance);
  S.secretary_romance_possible = selected.romance;
  
  initializeSecretaryMessagingState();
  log(`You hired ${S.secretary_name}.`);
  render();
}

// Modified chooseSponsor to use modal
async function chooseSponsorModal() {
  // Clear any pre-selected sponsor to ensure modal is shown
  window.__selectedSponsor = null;
  
  const sponsorOptions = [
    {key:'m',label:"McDonald's — upfront £3m, weekly £150k (free burgers)"},
    {key:'e',label:'The Edge Gay Club — upfront £1.5m, weekly £200k (minor fan/team discontent with "GAY CLUB" being written on team shirts)'},
    {key:'n',label:'Nintendo — upfront £4m, weekly £200k (conservative company drops you if scandals exposed)'},
    {key:'p',label:'Portsmouth FC — upfront £8m, weekly £300k (fans furious with the prospect of "PORTSMOUTH FC" being written on club shirts)'}
  ];
  
  const s = await showDOSModal('SELECT YOUR SPONSOR', 'Select a lead shirt sponsor:', sponsorOptions);
  
  if (!s) return;
  
  if(s==='m'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(3000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 3000000;
    }
    S.weekly_income = (S.weekly_income||0) + 150000;
  } else if(s==='e'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(1500000);
    } else {
      S.club_cash = (S.club_cash || 0) + 1500000;
    }
    S.weekly_income = (S.weekly_income||0) + 200000;
    S.fan_morale = (S.fan_morale||50) - 3;
  } else if(s==='n'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(4000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 4000000;
    }
    S.weekly_income = (S.weekly_income||0) + 200000;
    S.sponsor_nintendo = true;
  } else {
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(8000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 8000000;
    }
    S.weekly_income = (S.weekly_income||0) + 300000;
    S.fan_morale = (S.fan_morale||50) - 15;
    addPaper('Fans rage over Portsmouth branding deal', 18);
  }
  log('Sponsor secured.');
  ensureSeasonSchedule();
  updateHUD();
  render();
}

// Lads gate screen handlers
function setupLadsGateScreen() {
  const ladsGateScreen = document.getElementById('ladsGateScreen');
  const ladsGateQuestion = document.getElementById('ladsGateQuestion');
  const ladsGateRejected = document.getElementById('ladsGateRejected');
  const ladsGateYes = document.getElementById('ladsGateYes');
  const ladsGateNo = document.getElementById('ladsGateNo');
  const ladsGateReset = document.getElementById('ladsGateReset');
  const startScreen = document.getElementById('startScreen');
  
  if (!ladsGateScreen || !ladsGateYes || !ladsGateNo || !ladsGateReset) {
    console.warn('Lads gate screen elements not found!');
    return;
  }
  
  // Show gate screen initially, hide start screen
  // BUT: Don't show gate screen if we're auto-loading a game
  if (ladsGateScreen && !window.__gameAutoLoaded) {
    ladsGateScreen.classList.remove('hidden');
  } else if (ladsGateScreen) {
    ladsGateScreen.classList.add('hidden');
  }
  if (startScreen) startScreen.classList.add('hidden');
  
  // Handle YES button - reveal title screen and start music
  if (ladsGateYes) {
    ladsGateYes.onclick = function() {
      // Hide gate screen
      if (ladsGateScreen) ladsGateScreen.classList.add('hidden');
      // Show start screen only if not auto-loaded
      if (startScreen && !window.__gameAutoLoaded) {
        startScreen.classList.remove('hidden');
      }
      // Start playing the opening music ONLY if not loading a game
      // (to prevent clash with game background music)
      if (!window.__gameAutoLoaded && !window.__loadingFromStartScreen) {
        const openingMusic = document.getElementById('openingMusic');
        if (openingMusic) {
          openingMusic.volume = 0.5; // Set volume to 50%
          openingMusic.play().catch(e => {
            // If autoplay is blocked, start playing when user clicks any button
            const startMusicOnInteraction = () => {
              openingMusic.play().catch(err => {});
              document.removeEventListener('click', startMusicOnInteraction);
              document.removeEventListener('touchstart', startMusicOnInteraction);
            };
            document.addEventListener('click', startMusicOnInteraction, { once: true });
            document.addEventListener('touchstart', startMusicOnInteraction, { once: true });
          });
        }
      }
    };
  }
  
  // Handle NO button - show rejection message
  if (ladsGateNo) {
    ladsGateNo.onclick = function() {
      if (ladsGateQuestion) ladsGateQuestion.style.display = 'none';
      if (ladsGateRejected) ladsGateRejected.style.display = 'block';
    };
  }
  
  // Handle RESET button - go back to question
  if (ladsGateReset) {
    ladsGateReset.onclick = function() {
      if (ladsGateRejected) ladsGateRejected.style.display = 'none';
      if (ladsGateQuestion) ladsGateQuestion.style.display = 'block';
    };
  }
}

// Start screen button handlers - use inline handlers for reliability
function setupStartScreenButtons() {
  const startScreen = document.getElementById('startScreen');
  const watchIntroBtn = document.getElementById('watchIntroBtn');
  const startCampaignBtn = document.getElementById('startCampaignBtn');
  const quickStartBtn = document.getElementById('quickStartBtn');
  const loadGameBtn = document.getElementById('loadGameBtn');
  
  
  if (!startScreen) {
    console.warn('Start screen not found!');
    return;
  }
  
  // Keep start screen hidden initially (will be shown by gate screen)
  startScreen.classList.add('hidden');
  
  // Always show the load button
  if (loadGameBtn) loadGameBtn.style.display = 'block';
  
  // Define handler functions with guard to prevent multiple simultaneous calls
  let isStarting = false;
  
  async function handleStartCampaign() {
    if (isStarting) {
      return;
    }
    // Ensure music is playing
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && openingMusic.paused) {
      openingMusic.play().catch(e => {});
    }
    isStarting = true;
    try {
      // Clear saved state to always start fresh
      localStorage.removeItem(SAVE_KEY);
      localStorage.setItem('_reset_flag', 'true');
      startScreenMode = 'campaign';
      await startGame();
    } catch (err) {
      console.error('Start campaign error:', err);
      await showDOSModal('ERROR', 'Failed to start game. See console for details.');
    } finally {
      isStarting = false;
    }
  }
  
  async function handleQuickStart() {
    if (isStarting) {
      return;
    }
    // Ensure music is playing
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && openingMusic.paused) {
      openingMusic.play().catch(e => {});
    }
    isStarting = true;
    try {
      startScreenMode = 'quick';
      // Skip intro modal for resume - go straight to game
      const startScreen = document.getElementById('startScreen');
      if (startScreen) {
        startScreen.classList.add('hidden');
      }
      await game();
    } catch (err) {
      console.error('Resume error:', err);
      await showDOSModal('ERROR', 'Failed to resume game. See console for details.');
    } finally {
      isStarting = false;
    }
  }
  
  async function handleLoadGame() {
    // Hide lads gate screen when loading - bypass it entirely
    const ladsGateScreen = document.getElementById('ladsGateScreen');
    if (ladsGateScreen) {
      ladsGateScreen.classList.add('hidden');
    }
    // Hide start screen too
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
      startScreen.classList.add('hidden');
    }
    // Stop opening music if it's playing (to prevent clash with game music)
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && !openingMusic.paused) {
      openingMusic.pause();
      openingMusic.currentTime = 0;
    }
    // Show the save slot modal for loading
    if (typeof showSaveSlotModal === 'function') {
      // Store that we're loading from startup screen
      window.__loadingFromStartScreen = true;
      showSaveSlotModal(true);
    } else {
      // Fallback to old method if modal function doesn't exist
      try {
        const saveData = localStorage.getItem(SAVE_KEY);
        if (saveData) {
          try {
            window.S = parseSavedGame(saveData);
            S = window.S;
            startScreenMode = 'load';
            // Start the game - it will handle loading the saved state
            await game();
          } catch (e) {
            console.error('Load error:', e);
            await showDOSModal('ERROR', 'Failed to load game: ' + (e.message || 'Unknown error'));
          }
        } else {
          await showDOSModal('ERROR', 'No saved game found.');
        }
      } catch (e) {
        console.error('Load error:', e);
        await showDOSModal('ERROR', 'Failed to load game: ' + (e.message || 'Unknown error'));
      }
    }
  }
  
  async function handleWatchIntro() {
    try {
      await showIntroCutscene();
    } catch (err) {
      console.error('Intro video error:', err);
    }
  }
  
  // Wire up buttons - remove old listeners first to prevent duplicates
  if (watchIntroBtn) {
    // Remove any existing listeners
    const newBtn = watchIntroBtn.cloneNode(true);
    watchIntroBtn.parentNode.replaceChild(newBtn, watchIntroBtn);
    const btn = document.getElementById('watchIntroBtn');
    btn.onclick = handleWatchIntro;
    btn.style.cursor = 'pointer';
  } else {
    console.warn('Watch Intro button not found!');
  }
  if (startCampaignBtn) {
    // Remove any existing listeners
    const newBtn = startCampaignBtn.cloneNode(true);
    startCampaignBtn.parentNode.replaceChild(newBtn, startCampaignBtn);
    const btn = document.getElementById('startCampaignBtn');
    btn.onclick = handleStartCampaign;
    btn.style.cursor = 'pointer';
  } else {
    console.warn('New Campaign button not found!');
  }
  
  if (quickStartBtn) {
    // Remove any existing listeners
    const newBtn = quickStartBtn.cloneNode(true);
    quickStartBtn.parentNode.replaceChild(newBtn, quickStartBtn);
    const btn = document.getElementById('quickStartBtn');
    btn.onclick = handleQuickStart;
    btn.style.cursor = 'pointer';
  } else {
    console.warn('Resume button not found!');
  }
  
  if (loadGameBtn) {
    // Remove any existing listeners
    const newBtn = loadGameBtn.cloneNode(true);
    loadGameBtn.parentNode.replaceChild(newBtn, loadGameBtn);
    const btn = document.getElementById('loadGameBtn');
    btn.onclick = handleLoadGame;
    btn.style.cursor = 'pointer';
  } else {
    console.warn('Load Game button not found!');
  }
  
  // Wire up sponsor buttons
  const sponsorButtons = document.querySelectorAll('.sponsor-btn');
  sponsorButtons.forEach(btn => {
    btn.onclick = function() {
      const sponsor = this.getAttribute('data-sponsor');
      // Store selected sponsor
      window.__selectedSponsor = sponsor;
      // Visual feedback
      sponsorButtons.forEach(b => {
        b.style.background = '#000';
        b.style.color = '#00ff00';
      });
      this.style.background = '#00ff00';
      this.style.color = '#000';
    };
    btn.style.cursor = 'pointer';
  });
  
}

// Setup buttons - handle both cases: DOM already loaded or still loading
// Also try multiple times to ensure it works
function attemptSetup() {
  // Setup gate screen first
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLadsGateScreen);
  } else {
    // DOM is already loaded, run immediately
    setupLadsGateScreen();
  }
  
  // Setup start screen buttons
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStartScreenButtons);
  } else {
    // DOM is already loaded, run immediately
    setupStartScreenButtons();
  }
  
  // Also try after a short delay as a fallback
  setTimeout(() => {
    setupLadsGateScreen();
    const btn = document.getElementById('startCampaignBtn');
    if (btn && !btn.onclick) {
      setupStartScreenButtons();
    }
  }, 100);
}

attemptSetup();

// Modified start game function
async function startGame() {
  try {
    // Hide start screen immediately to prevent multiple clicks
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
      startScreen.classList.add('hidden');
    }
    
    // Show intro modal first
    await showIntroModal();
    
    // Then start the game - game() will hide the start screen
    await game();
  } catch (err) {
    console.error('Error in startGame():', err);
    // Show error modal
    await showDOSModal('ERROR', 'Failed to start game: ' + (err.message || 'Unknown error'));
    // Re-show start screen on error only if not auto-loaded
    if (!window.__gameAutoLoaded) {
      const startScreen = document.getElementById('startScreen');
      if (startScreen) {
        startScreen.classList.remove('hidden');
      }
    }
  }
}