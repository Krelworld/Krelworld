// ========== GENERATE ULTIMA CUP EVENTS ==========
function generateUltimaCupEvents(ourStrength, portsmouthStrength, legendsStrength, ultimaStrength) {
  const events = [];
  
  // Epic player names for each team
  const legendsPlayers = ['Lionel Messi', 'Cristiano Ronaldo', 'Kylian Mbappé', 'Erling Haaland', 'Kevin De Bruyne', 'Virgil van Dijk', 'Mohamed Salah', 'Karim Benzema'];
  const ultimaPlayers = ['Pelé', 'Diego Maradona', 'Johan Cruyff', 'Franz Beckenbauer', 'Alfredo Di Stéfano', 'Ferenc Puskás', 'Garrincha', 'Eusébio'];
  
  // Get actual Portsmouth players from opponent squad (if available)
  let portsmouthPlayers = [];
  if (typeof makeOpponentSquad === 'function') {
    // Try to get Portsmouth squad
    const portsmouthSquad = makeOpponentSquad('Portsmouth');
    if (Array.isArray(portsmouthSquad) && portsmouthSquad.length > 0) {
      portsmouthPlayers = portsmouthSquad
        .filter(p => p && p.name)
        .map(p => p.name)
        .slice(0, 11); // Get up to 11 players
    }
  }
  // Fallback: try to get from opponent_today if it's Portsmouth
  if (portsmouthPlayers.length === 0 && Array.isArray(S?.opponent_today) && S.opponent_today.length > 0) {
    const oppTeam = currentOpponent();
    if (oppTeam && (oppTeam.team === 'Portsmouth' || oppTeam.team?.includes('Portsmouth'))) {
      portsmouthPlayers = S.opponent_today
        .filter(p => p && p.name)
        .map(p => p.name)
        .slice(0, 11);
    }
  }
  // Final fallback: generate names
  if (portsmouthPlayers.length === 0) {
    if (typeof MALE_NAMES !== 'undefined' && typeof SURNAMES !== 'undefined') {
      for (let i = 0; i < 11; i++) {
        const firstName = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
        const lastName = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
        portsmouthPlayers.push(`${firstName} ${lastName}`);
      }
    } else {
      portsmouthPlayers = ['Portsmouth Player 1', 'Portsmouth Player 2', 'Portsmouth Player 3', 'Portsmouth Player 4', 'Portsmouth Player 5', 'Portsmouth Player 6', 'Portsmouth Player 7', 'Portsmouth Player 8', 'Portsmouth Player 9', 'Portsmouth Player 10', 'Portsmouth Player 11'];
    }
  }
  
  const ourPlayers = getOurSelectedFive().filter(p => p && p.name).map(p => p.name);
  if (ourPlayers.length === 0) ourPlayers = ['Your Player 1', 'Your Player 2', 'Your Player 3', 'Your Player 4', 'Your Player 5'];
  
  // Calculate expected goals for each team (higher for stronger teams, but more chaotic)
  const ourXG = Math.max(0.5, 1.2 + (ourStrength / 80));
  const portsmouthXG = Math.max(0.8, 1.5 + (portsmouthStrength / 70));
  const legendsXG = Math.max(1.0, 2.0 + (legendsStrength / 60));
  const ultimaXG = Math.max(1.2, 2.2 + (ultimaStrength / 55));
  
  // Generate goal counts (more goals in Ultima Cup - it's epic!)
  let ourGoals = Math.min(poisson(ourXG), 10);
  let portsmouthGoals = Math.min(poisson(portsmouthXG), 10);
  let legendsGoals = Math.min(poisson(legendsXG), 12);
  let ultimaGoals = Math.min(poisson(ultimaXG), 12);
  
  // Add epic feats and chaos - more goals!
  const epicMultiplier = 1.3; // 30% more goals
  ourGoals = Math.min(Math.floor(ourGoals * epicMultiplier), 12);
  portsmouthGoals = Math.min(Math.floor(portsmouthGoals * epicMultiplier), 12);
  legendsGoals = Math.min(Math.floor(legendsGoals * epicMultiplier), 15);
  ultimaGoals = Math.min(Math.floor(ultimaGoals * epicMultiplier), 15);
  
  // Epic feats list
  const epicFeats = [
    'bicycle kick', 'overhead kick', '40-yard screamer', 'dribbles past 4 defenders', 
    'nutmegs the goalkeeper', 'curls it into the top corner', 'thunderous volley',
    'acrobatic scissor kick', 'bends it like Beckham', 'rocket from distance',
    'solo run from halfway', 'backheel flick', 'rabona finish', 'chips the keeper',
    'powerful header', 'free kick into top bins', 'long-range thunderbolt'
  ];
  
  // Add goals with epic feats - distribute throughout 120 minutes (longer match!)
  for (let i = 0; i < ourGoals; i++) {
    const t = 5 + Math.floor(Math.random() * 115); // 5-120 minutes
    const scorer = pick(ourPlayers);
    const feat = pick(epicFeats);
    events.push({ 
      t, 
      team: 'us', 
      kind: 'GOAL',
      scorer,
      feat,
      epic: true
    });
  }
  
  for (let i = 0; i < portsmouthGoals; i++) {
    const t = 5 + Math.floor(Math.random() * 115);
    const scorer = pick(portsmouthPlayers);
    const feat = pick(epicFeats);
    events.push({ 
      t, 
      team: 'portsmouth', 
      kind: 'GOAL',
      scorer,
      feat,
      epic: true
    });
  }
  
  for (let i = 0; i < legendsGoals; i++) {
    const t = 5 + Math.floor(Math.random() * 115);
    const scorer = pick(legendsPlayers);
    const feat = pick(epicFeats);
    events.push({ 
      t, 
      team: 'legends', 
      kind: 'GOAL',
      scorer,
      feat,
      epic: true
    });
  }
  
  for (let i = 0; i < ultimaGoals; i++) {
    const t = 5 + Math.floor(Math.random() * 115);
    const scorer = pick(ultimaPlayers);
    const feat = pick(epicFeats);
    events.push({ 
      t, 
      team: 'ultima', 
      kind: 'GOAL',
      scorer,
      feat,
      epic: true
    });
  }
  
  // Add epic non-goal events (saves, near misses, skill moves, etc.)
  const nonGoalEvents = Math.floor((ourGoals + portsmouthGoals + legendsGoals + ultimaGoals) * 0.6);
  for (let i = 0; i < nonGoalEvents; i++) {
    const t = 5 + Math.floor(Math.random() * 115);
    const teams = ['us', 'portsmouth', 'legends', 'ultima'];
    const team = pick(teams);
    const players = team === 'us' ? ourPlayers : 
                   team === 'portsmouth' ? portsmouthPlayers :
                   team === 'legends' ? legendsPlayers : ultimaPlayers;
    const player = pick(players);
    
    const epicMomentTypes = [
      'incredible save', 'last-ditch tackle', 'spectacular skill move', 
      'near miss hits the post', 'amazing interception', 'world-class pass',
      'defensive masterclass', 'lightning-fast counter', 'brilliant team move'
    ];
    const moment = pick(epicMomentTypes);
    
    events.push({
      t,
      team,
      kind: 'EPIC_MOMENT',
      player,
      moment,
      epic: true
    });
  }
  
  // Add chaos events (2 balls on pitch moments)
  const chaosEvents = Math.floor((ourGoals + portsmouthGoals + legendsGoals + ultimaGoals) * 0.3);
  for (let i = 0; i < chaosEvents; i++) {
    const t = 10 + Math.floor(Math.random() * 110);
    events.push({
      t,
      kind: 'CHAOS',
      description: pick([
        'Both balls are in play simultaneously! Absolute chaos!',
        'The second ball enters the pitch - players are confused!',
        'Two balls, four teams, pure madness on the field!',
        'Referee tries to stop play but both balls are active!',
        'Players are playing with both balls - unprecedented!'
      ])
    });
  }
  
  // Add cards and injuries (more in chaotic match)
  const cardEvents = Math.floor((ourGoals + portsmouthGoals + legendsGoals + ultimaGoals) * 0.4);
  for (let i = 0; i < cardEvents; i++) {
    const t = 10 + Math.floor(Math.random() * 110);
    const teams = ['us', 'portsmouth', 'legends', 'ultima'];
    const team = pick(teams);
    const players = team === 'us' ? ourPlayers : 
                   team === 'portsmouth' ? portsmouthPlayers :
                   team === 'legends' ? legendsPlayers : ultimaPlayers;
    const player = pick(players);
    const isRed = Math.random() < 0.2;
    
    events.push({
      t,
      team,
      kind: isRed ? 'RED_CARD' : 'YELLOW_CARD',
      player
    });
  }
  
  // Sort events by time
  events.sort((a, b) => a.t - b.t);
  
  return events;
}

async function endOfSeason(){
  // Initialize Five-Season Arc tracking if missing
  if (!S.season) S.season = 1;
  if (!S.fiveSeasonArc) S.fiveSeasonArc = {plTitles:[], clEntries:[], clWins:[], worldCupInvited:[], worldCupResults:[]};
  
  // Season 4 end handling
  if (S.season === 4 && S.season4 && !S.season4.season_end_complete) {
    log(``);
    log(`<strong>━━━ END OF SEASON 4 ━━━</strong>`);
    log(``);
    log(`The season ends without spectacle.`);
    log(`The league logo has been updated.`);
    log(`Mohammed Van Onslaught appears in press images, smiling.`);
    log(``);
    log(`<strong>📡 Final Broadcast:</strong>`);
    log(`"Alhamdulillah. The transition is complete."`);
    log(``);
    log(`No music sting. No choice. The season rolls forward.`);
    log(``);
    
    S.season4.season_end_complete = true;
    
    // ========== SEASON 4 HAJJ (MANDATORY) ==========
    if (S.season === 4 && S.season4 && !S.season4.s4_hajj_complete) {
      // Hajj is now mandatory by default at end of season 4
      log(`Season 4 has concluded. You are told to go on the Hajj.`);
      log(``);
      
      // Create black screen overlay
      const blackScreen = document.createElement('div');
      blackScreen.style.position = 'fixed';
      blackScreen.style.top = '0';
      blackScreen.style.left = '0';
      blackScreen.style.width = '100%';
      blackScreen.style.height = '100%';
      blackScreen.style.backgroundColor = '#000000';
      blackScreen.style.zIndex = '10000';
      blackScreen.style.display = 'flex';
      blackScreen.style.flexDirection = 'column';
      blackScreen.style.justifyContent = 'center';
      blackScreen.style.alignItems = 'center';
      blackScreen.style.color = '#ffffff';
      document.body.appendChild(blackScreen);
      
      // Create popup message container
      const popupContainer = document.createElement('div');
      popupContainer.style.backgroundColor = '#1a1a1a';
      popupContainer.style.padding = '40px';
      popupContainer.style.borderRadius = '8px';
      popupContainer.style.maxWidth = '600px';
      popupContainer.style.textAlign = 'center';
      popupContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
      
      const messageText = document.createElement('div');
      messageText.style.fontSize = '18px';
      messageText.style.lineHeight = '1.6';
      messageText.style.marginBottom = '30px';
      messageText.innerHTML = `Mohammed Van Onslaught has decreed that everyone must perform the Hajj.<br><br>It is mandatory. There is no alternative.`;
      
      const playButton = document.createElement('button');
      playButton.textContent = 'Continue';
      playButton.style.padding = '12px 30px';
      playButton.style.fontSize = '16px';
      playButton.style.backgroundColor = '#6366f1';
      playButton.style.color = '#ffffff';
      playButton.style.border = 'none';
      playButton.style.borderRadius = '4px';
      playButton.style.cursor = 'pointer';
      playButton.style.transition = 'background-color 0.2s';
      playButton.onmouseover = () => { playButton.style.backgroundColor = '#4f46e5'; };
      playButton.onmouseout = () => { playButton.style.backgroundColor = '#6366f1'; };
      
      popupContainer.appendChild(messageText);
      popupContainer.appendChild(playButton);
      blackScreen.appendChild(popupContainer);
      
      // Wait for button click before playing video
      await new Promise(resolve => {
        playButton.onclick = () => {
          blackScreen.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
          setTimeout(() => {
            blackScreen.remove();
            resolve();
          }, 500);
        };
      });
      
      // Play hajj video
      const videoContainer = document.createElement('div');
      videoContainer.className = 'cinematic-video-container';
      const video = document.createElement('video');
      video.src = 'https://www.dropbox.com/scl/fi/16lvp83thp5vwfebn2gi9/hajj.MP4?rlkey=wg52psy42uawasvqqgkebp7ak&st=katx4rpy&dl=1';
      video.controls = false;
      video.autoplay = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'contain';
      
      const videoCloseBtn = document.createElement('button');
      videoCloseBtn.className = 'cinematic-video-close-btn';
      videoCloseBtn.textContent = '✕ Close';
      videoCloseBtn.style.display = 'none';
      
      video.addEventListener('ended', () => {
        videoCloseBtn.style.display = 'block';
        videoCloseBtn.classList.add('show');
      });
      
      await new Promise(resolve => {
        videoCloseBtn.onclick = () => {
          videoContainer.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
          setTimeout(() => {
            videoContainer.remove();
            resolve();
          }, 500);
        };
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(videoCloseBtn);
        document.body.appendChild(videoContainer);
      });
      
      // Set hajj flag
      S.season4.s4_hajj_complete = true;
      log(`You have been in the Middle East for months.`);
      log(`The Hajj was mandatory. The alternative was execution.`);
      log(``);
      log(`There is a door marked "Top Secret - Do not Enter". Do you wish to enter it?`);
      
      // Top Secret door prompt
      let doorChoice;
      try {
        doorChoice = await choose([
          {key: 'yes', label: 'Yes'},
          {key: 'no', label: 'No'}
        ], 'There is a door marked "Top Secret - Do not Enter". Do you wish to enter it?');
      } catch (e) {
        console.error('Error in door choice:', e);
        doorChoice = 'no'; // Default to no if there's an error
      }
      
      if (doorChoice === 'yes') {
        // Play the Kreplin gem video
        const kreplinVideoContainer = document.createElement('div');
        kreplinVideoContainer.className = 'cinematic-video-container';
        const kreplinVideo = document.createElement('video');
        kreplinVideo.src = 'https://www.dropbox.com/scl/fi/4sq2vjo372f82x1pcrnzd/Hajj-kreplin.mp4?rlkey=p49953q3lieof25u6t0472re4&st=f81gx57r&dl=1';
        kreplinVideo.controls = false;
        kreplinVideo.autoplay = true;
        kreplinVideo.style.width = '100%';
        kreplinVideo.style.height = '100%';
        kreplinVideo.style.objectFit = 'contain';
        
        const kreplinVideoCloseBtn = document.createElement('button');
        kreplinVideoCloseBtn.className = 'cinematic-video-close-btn';
        kreplinVideoCloseBtn.textContent = '✕ Close';
        kreplinVideoCloseBtn.style.display = 'none';
        
        kreplinVideo.addEventListener('ended', () => {
          kreplinVideoCloseBtn.style.display = 'block';
          kreplinVideoCloseBtn.classList.add('show');
        });
        
        await new Promise(resolve => {
          kreplinVideoCloseBtn.onclick = () => {
            kreplinVideoContainer.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
            setTimeout(() => {
              kreplinVideoContainer.remove();
              resolve();
            }, 500);
          };
          
          kreplinVideoContainer.appendChild(kreplinVideo);
          kreplinVideoContainer.appendChild(kreplinVideoCloseBtn);
          document.body.appendChild(kreplinVideoContainer);
        });
        
        // Show Kreplin gem celebration and add gem
        await showKreplinGemCelebration();
        S.kreplin_gems = (S.kreplin_gems || 0) + 1;
        hudSet("hudKreplinGem", `${S.kreplin_gems}/4`);
        // Sync to playerStats for certificate
        if (!S.playerStats) S.playerStats = {};
        S.playerStats.kreplinGems = Math.max(S.playerStats.kreplinGems || 0, S.kreplin_gems || 0);
        log(`✨💎 YOU FOUND A KREPLIN GEM!!! 💎✨`);
        log(``);
      }
    }
  }
  
  // First show the current state
  const effective = S.points - S.points_deducted;
  log(`<strong>Your season is complete!</strong> P${S.matches_played} W${S.wins} D${S.draws} L${S.losses}  Pts:${S.points} (-${S.points_deducted})`);
  log(`Manager changes: ${S.manager_fires} of ${S.matches_played}`);
  
  // Family rating
  if (S.family) {
    const familyRating = calculateFamilyRating();
    log(`🏠 Family Rating: ${familyRating}/100`);
    if (familyRating >= 80) {
      log("🏆 Citation: 'Kept the house together' - Your family life was exemplary this season!");
    } else if (familyRating >= 60) {
      log("✅ Citation: 'Maintained domestic stability' - Your family life was generally stable.");
    } else if (familyRating >= 40) {
      log("⚠️ Citation: 'Family life needs attention' - Your domestic situation could be improved.");
    } else {
      log("💥 Citation: 'Family in crisis' - Your domestic life was in turmoil this season.");
    }
  }
  
  // Offer to advance to final league table (only if not already shown in presentation)
  let pos;
  if (S.leagueTableShownInPresentation) {
    // Already shown in presentation, just compute position
    pos = computeSouthamptonPosition();
  } else {
    const advanceChoice = await choose([
      {key: 'advance', label: 'Advance to Final League Table'},
      {key: 'skip', label: 'Skip to Season Summary'}
    ], 'Your season is over. Other teams may still have games to play.');
    
    if (advanceChoice === 'advance') {
      pos = showFinalLeagueTable();
      S.leagueTableShownInPresentation = true;
    } else {
      pos = computeSouthamptonPosition();
    }
  }
  
  // CL qualification: Only position 1 (Premier League title) qualifies for CL
  // Exception: Auto-qualify if CL champion from previous season
  if (S.clChampion) {
    S.qual_CL = true;  // Auto-qualify as defending champions
    S.clChampion = false; // Reset flag after using it
  } else {
    S.qual_CL = (pos === 1);  // Only PL title qualifies
  }
  
  // Initialize Champions League for next season if qualified
  if (S.qual_CL) {
    // Reset CL state for next season
    S.clActive = false;
    S.clStage = 'group';
    S.clGroupMatches = [];
    S.clGroupStandings = {};
    S.clKnockoutBracket = {};
    S.clScheduledMatches = [];
    S.clNextMatchIndex = 0;
    S.clKnockoutRound = null;
    // CL will be initialized when first match is due (in maybePlayChampionsLeagueFixture)
  } else {
    // Not qualified - ensure CL is inactive
    S.clActive = false;
    S.clStage = 'done';
  }
  
  // Track Five-Season Arc milestones
  const currentSeason = S.season;
  
  // PL Title
  if (pos === 1) {
    if (!S.fiveSeasonArc.plTitles.includes(currentSeason)) {
      S.fiveSeasonArc.plTitles.push(currentSeason);
    }
  }
  
  // CL Entry/Result (track this season's CL participation)
  let clResult = null;
  if (S.clActive || (S.qual_CL && currentSeason > 1 && S.fiveSeasonArc.clEntries.some(e => e.season === currentSeason - 1))) {
    // If we participated in CL this season, track the result
    if (S.clKnockoutRound === 'final' && S.clKnockoutBracket.final && S.clKnockoutBracket.final.winner === 'Southampton FC') {
      clResult = 'champion';
      if (!S.fiveSeasonArc.clWins.includes(currentSeason)) {
        S.fiveSeasonArc.clWins.push(currentSeason);
      }
      S.clChampion = true; // Set flag for next season auto-qualification
    } else if (S.clKnockoutRound) {
      clResult = S.clKnockoutRound; // 'quarterfinal', 'semifinal', 'final'
    } else if (S.clGroupStandings && Object.keys(S.clGroupStandings).length > 0) {
      // Check if we advanced from group
      const standings = Object.entries(S.clGroupStandings).map(([team, data]) => ({
        team, ...data
      })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
      const ourPosition = standings.findIndex(s => s.team === 'Southampton FC');
      if (ourPosition < 2) {
        clResult = 'knockout'; // Advanced from group
      } else {
        clResult = 'group'; // Eliminated in group stage
      }
    }
    
    if (clResult) {
      const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === currentSeason);
      if (existing >= 0) {
        S.fiveSeasonArc.clEntries[existing].result = clResult;
      } else {
        S.fiveSeasonArc.clEntries.push({season: currentSeason, result: clResult});
      }
    }
  }
  
  // World Cup invitation (happens in off-season, tracked separately)
  
  // Show Five-Season Plan header
  log(`<div style="border: 2px solid #4a90e2; padding: 12px; margin: 12px 0; background: #f0f7ff; border-radius: 6px;"><strong>🏆 FIVE-SEASON PLAN</strong> - Season ${currentSeason}/5`);
  const milestones = [];
  if (S.fiveSeasonArc.plTitles.length > 0) {
    milestones.push(`PL Titles: Seasons ${S.fiveSeasonArc.plTitles.join(', ')}`);
  }
  if (S.fiveSeasonArc.clEntries.length > 0) {
    const clSummary = S.fiveSeasonArc.clEntries.map(e => `S${e.season}: ${e.result}`).join(', ');
    milestones.push(`CL: ${clSummary}`);
  }
  if (S.fiveSeasonArc.clWins.length > 0) {
    milestones.push(`CL Champions: Seasons ${S.fiveSeasonArc.clWins.join(', ')}`);
  }
  if (S.fiveSeasonArc.worldCupInvited.length > 0) {
    milestones.push(`World Cup Invites: Seasons ${S.fiveSeasonArc.worldCupInvited.join(', ')}`);
  }
  if (S.fiveSeasonArc.worldCupResults.length > 0) {
    const wcSummary = S.fiveSeasonArc.worldCupResults.map(r => `S${r.season}: ${r.result}`).join(', ');
    milestones.push(`World Cup: ${wcSummary}`);
  }
  if (milestones.length === 0) {
    log(`  Progress: Starting your journey...`);
  } else {
    log(`  Progress: ${milestones.join(' | ')}`);
  }
  log(`</div>`);
  
  // Light narrative beat at season boundary
  if (currentSeason < 5) {
    log(`<em>Season ${currentSeason} complete. ${5 - currentSeason} season${5 - currentSeason > 1 ? 's' : ''} remain in your five-season plan.</em>`);
  } else {
    log(`<em>Your five-season plan is complete. The legacy of Southampton FC is now written.</em>`);
  }
  
  // ========== SEASON 3 END CINEMATIC ==========
  if (currentSeason === 3 && S.season3 && !S.season3.season_end_cinematic_shown) {
    S.season3.season_end_cinematic_shown = true;
    
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
    
    // Create and show cinematic modal for press conference
    const existingModal = document.getElementById('cinematic-press-conference-modal');
    if (existingModal) existingModal.remove();
    
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'cinematic-press-conference-modal';
    modalOverlay.className = 'cinematic-modal-overlay';
    // Store music state for cleanup
    modalOverlay._wasMusicPlaying = wasMusicPlaying;
    
    const modal = document.createElement('div');
    modal.className = 'cinematic-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'cinematic-modal-content';
    modalContent.innerHTML = `<div class="cinematic-title">━━━ SEASON 3 FINALE ━━━</div>`;
    
    modal.appendChild(modalContent);
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Play Season 3 finale audio track
    const season3FinaleAudio = new Audio('https://www.dropbox.com/scl/fi/zy5uyx3kzj6ugwxfgic6y/muslim-announcement.mp3?rlkey=acv8cs89gtxyv1vuy6jhn9b2r&st=oq4rsl3q&dl=1');
    season3FinaleAudio.volume = 0.7;
    season3FinaleAudio.play().catch(e => console.error('Error playing Season 3 finale audio:', e));
    // Store audio reference for cleanup
    modalOverlay._season3FinaleAudio = season3FinaleAudio;
    
    // Function to append text to modal with typewriter effect
    // Modified to ensure sequential line-by-line generation regardless of color
    const appendToModal = (text, delay = 0, useTypewriter = true) => {
      return new Promise(resolve => {
        // Apply delay first, then create the line
        setTimeout(() => {
          const p = document.createElement('p');
          if (text.trim() === '') {
            p.innerHTML = '<br>';
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            // For blank lines, add a small delay to ensure smooth sequential display
            setTimeout(() => resolve(), 100);
          } else if (useTypewriter && text.trim() !== '' && !text.includes('explosive-bloody-text') && !text.includes('bloody-text') && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
            // Wrap text in typewriter span (but not for special effects or HTML tags)
            const span = document.createElement('span');
            span.className = 'typewriter-line';
            span.textContent = text;
            p.appendChild(span);
            modalContent.appendChild(p);
            
            // Measure the actual text width and set it as max-width to prevent cursor from extending
            // Use a temporary element to measure
            const measureEl = document.createElement('span');
            measureEl.style.visibility = 'hidden';
            measureEl.style.position = 'absolute';
            measureEl.style.whiteSpace = 'nowrap';
            measureEl.style.font = window.getComputedStyle(span).font;
            measureEl.textContent = text;
            document.body.appendChild(measureEl);
            const textWidth = measureEl.offsetWidth;
            document.body.removeChild(measureEl);
            
            // Set the max-width to the actual text width
            span.style.maxWidth = textWidth + 'px';
            
            // Override CSS animation to be much faster (0.5s instead of 2s)
            span.style.animation = 'typewriterReveal 0.5s steps(40, end), blinkCursor 0.3s step-end infinite';
            
            // Remove cursor after animation completes (0.5s animation + small buffer)
            setTimeout(() => {
              span.classList.add('no-cursor');
            }, 600);
            
            // Wait for animation to complete before resolving
            setTimeout(() => {
              modal.scrollTop = modal.scrollHeight;
              resolve();
            }, 500);
          } else {
            // For special effects (bloody-text, explosive-bloody-text) or when typewriter is disabled
            p.innerHTML = text;
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            
            // Check if this line contains bloody-text or explosive-bloody-text
            // These have CSS animations that need to complete before next line appears
            const hasExplosiveBloodyText = text.includes('explosive-bloody-text');
            const hasBloodyText = text.includes('bloody-text');
            
            if (hasExplosiveBloodyText) {
              // Explosive bloody text has a 1s CSS animation (explosiveBloody)
              // Wait for animation to complete plus a small buffer to ensure smooth sequential display
              setTimeout(() => {
                resolve();
              }, 1100); // 1s animation + 100ms buffer
            } else if (hasBloodyText) {
              // Bloody text has a 2.5s CSS animation (typewriterBloody)
              // Wait for animation to complete plus a small buffer to ensure smooth sequential display
              setTimeout(() => {
                resolve();
              }, 2600); // 2.5s animation + 100ms buffer
            } else {
              // For other special effects, add a small delay to ensure smooth sequential display
              setTimeout(() => {
                resolve();
              }, 200);
            }
          }
        }, delay);
      });
    };
    
    // Add close button - append to overlay so it's fixed on screen, not in scrollable content
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cinematic-modal-close-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.style.display = 'none'; // Hide initially, show when done
    closeBtn.onclick = () => {
      if (modalOverlay._season3FinaleAudio) {
        modalOverlay._season3FinaleAudio.pause();
        modalOverlay._season3FinaleAudio.currentTime = 0;
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
      modalOverlay.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
      setTimeout(() => {
        modalOverlay.remove();
      }, 500);
    };
    modalOverlay.appendChild(closeBtn);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    await appendToModal(`The rumours had been circulating for weeks.`, 800);
    await appendToModal(`Whispers in boardrooms. Nervous glances in corridors.`, 2200);
    await appendToModal(``, 0);
    await appendToModal(`An FA press conference is broadcast live.`, 1500);
    await appendToModal(`Cameras flash. Reporters shift nervously in their seats.`, 800);
    await appendToModal(``, 0);
    await appendToModal(`Scronson Flabbergast, the FA boss, steps onto the stage.`, 2000);
    await appendToModal(`"Ladies and gentlemen, I have a crazy announcement. You're going to love this"`, 1000);
    await appendToModal(`"The Premier League has been sold…to Saudi Arabia!"`, 2200);
    await appendToModal(`The crowd gasps! Woah!`, 800);
    await appendToModal(``, 0);
    await appendToModal(`A man steps onto the stage.`, 2200);
    await appendToModal(`He is tall, imposing and Dressed in black.`, 1000);
    await appendToModal(``, 0);
    await appendToModal(`<strong>"I am Mohammed Van Onslaught," he says, his voice cold and precise.</strong>`, 2200);
    await appendToModal(`"I am the new owner of the Premier League."`, 1000);
    await appendToModal(`The room falls silent.`, 800);
    await appendToModal(``, 0);
    await appendToModal(`"From this day forward, the league will be renamed 'The Muslim Premier League'."`, 2000);
    await appendToModal(`"Please don't worry, we will continue to honor British traditions."`, 2200);
    await appendToModal(`"Yes, I personally agree with Sharia law, but we will only impose it to a minimal extent."`, 2200);
    await appendToModal(`He smirks, proudly;`, 800);
    await appendToModal(`"I actually think British football fans will love Sharia law!"`, 2200);
    await appendToModal(``, 0);
    await appendToModal(`He gestures to the side of the stage.`, 2200);
    await appendToModal(`"I would like to invite the bottom finishing team of the season, and their manager."`, 1000);
    await appendToModal(``, 0);
    
    // Get bottom team and manager
    let bottomTeam = 'Unknown Team';
    let bottomManager = 'Unknown Manager';
    if (typeof getFinalStandings === 'function') {
      const standings = getFinalStandings();
      if (standings && standings.length > 0) {
        const lastTeam = standings[standings.length - 1];
        bottomTeam = lastTeam.team || 'Unknown Team';
        // Try to get manager name from opponentManagers
        if (S.opponents && S.opponentManagers) {
          const teamIndex = S.opponents.indexOf(bottomTeam);
          if (teamIndex >= 0 && S.opponentManagers[teamIndex]) {
            bottomManager = S.opponentManagers[teamIndex];
          }
        }
        // Fallback: generate a manager name if not found
        if (bottomManager === 'Unknown Manager') {
          const managerNames = ['David Moyes', 'Sam Allardyce', 'Steve Bruce', 'Roy Hodgson', 'Neil Warnock', 'Tony Pulis', 'Mark Hughes', 'Alan Pardew'];
          bottomManager = managerNames[Math.floor(Math.random() * managerNames.length)];
        }
      }
    }
    
    await appendToModal(`${bottomTeam} FC and their manager, ${bottomManager}, walk onto the stage.`, 400);
    await appendToModal(`They look excited, expecting money, a trophy, some recognition.`, 200);
    await appendToModal(``, 0);
    await appendToModal(`<strong>Mohammed Van Onslaught smiles.</strong>`, 400);
    await appendToModal(`"In Britain, the relegated team is consigned to humiliation and shame"`, 300);
    await appendToModal(`He sighs.`, 800);
    await appendToModal(`"In Saudi Arabia, we treat the losing team with honor."`, 300);
    await appendToModal(``, 0);
    await appendToModal(`<strong>A firing squad appears on-stage.</strong>`, 500);
    await appendToModal(`Uniformed men with rifles.`, 200);
    await appendToModal(``, 0);
    await appendToModal(`<strong class="explosive-bloody-text">BANG. BANG. BANG.</strong>`, 500);
    await appendToModal(``, 0);
    await appendToModal(`<span class="bloody-text">${bottomTeam} FC and ${bottomManager} are shot.</span>`, 300);
    await appendToModal(`<span class="bloody-text">They collapse. Blood pools on the stage.</span>`, 0);
    await appendToModal(``, 0);
    await appendToModal(`Pandemonium erupts.`, 400);
    await appendToModal(`Screams. People running. Cameras still rolling.`, 150);
    await appendToModal(``, 0);
    await appendToModal(`Shafty Rod Johnson stands up.`, 400);
    await appendToModal(`"That ain't fockin' right!" he shouts.`, 200);
    await appendToModal(``, 0);
    await appendToModal(`<strong class="explosive-bloody-text">BANG.</strong>`, 400);
    await appendToModal(``, 0);
    await appendToModal(`<span class="bloody-text">Shafty Rod Johnson is shot in the gut.</span>`, 300);
    await appendToModal(`<span class="bloody-text">He collapses, clutching his stomach.</span>`, 0);
    await appendToModal(``, 0);
    await appendToModal(`Scronson Flabbergast, the boss of the FA, stands up, his face pale.`, 400);
    await appendToModal(`"This wasn't part of the agreement!!" he objects, cash overflowing from his trouser pockets.`, 0);
    await appendToModal(``, 0);
    await appendToModal(`<strong class="explosive-bloody-text">BANG.</strong>`, 400);
    await appendToModal(``, 0);
    await appendToModal(`<span class="bloody-text">Scronson Flabbergast is shot in the head.</span>`, 300);
    await appendToModal(`<span class="bloody-text">He collapses. Dead. Blood everywhere. Ruh roh.</span>`, 0);
    await appendToModal(``, 0);
    await appendToModal(`The room is deathly quiet.`, 400);
    await appendToModal(`<strong>Mohammed Van Onslaught smiles.</strong>`, 300);
    await appendToModal(`"They are now in heaven! If they were Muslim, that is! That's a great outcome!"`, 300);
    await appendToModal(``, 0);
    await appendToModal(`The cameras keep rolling.`, 400);
    await appendToModal(`But no one asks questions.`, 200);
    await appendToModal(``, 0);
    await appendToModal(`<strong>The Premier League is now something else entirely.</strong>`, 400);
    await appendToModal(`<strong>Something scarier. Something that doesn't care about rules.</strong>`, 300);
    
    // Show close button after all text is displayed
    await new Promise(resolve => setTimeout(resolve, 500));
    closeBtn.style.display = 'block';
    
    // Wait for user to close manually
    await new Promise(resolve => {
      const checkClosed = setInterval(() => {
        if (!document.getElementById('cinematic-press-conference-modal')) {
          clearInterval(checkClosed);
          // Resume background music if it was playing (in case modal was closed another way)
          if (modalOverlay._wasMusicPlaying) {
            if (typeof window._startGeneralMusic === 'function') {
              window._startGeneralMusic();
            } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
              generalMusicAudio.play().catch(err => {
              });
            }
          }
          resolve();
        }
      }, 100);
    });
    
    log(``);
  }
  
  // ========== SEASON 3 CONDITIONAL COMA ENDING ==========
  if (currentSeason === 3 && S.season3 && S.season3.krunchem_family_murdered && !S.season3.krunchem_shot_player) {
    // Krunchem's family was murdered - he shoots the player
    S.season3.krunchem_shot_player = true;
    
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
    
    // Play reckoning music
    const reckoningAudio = new Audio('https://www.dropbox.com/scl/fi/99k3vl0z7pwwv61irqnj3/delmor-shoot.mp3?rlkey=kqwvyt6a02ltwda4hs66ru1wo&st=vh4ixljz&dl=1');
    reckoningAudio.volume = 0.7;
    reckoningAudio.play().catch(e => console.error('Error playing reckoning audio:', e));
    
    // Create and show cinematic modal
    const existingModal = document.getElementById('cinematic-reckoning-modal');
    if (existingModal) existingModal.remove();
    
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'cinematic-reckoning-modal';
    modalOverlay.className = 'cinematic-modal-overlay';
    // Store audio reference for cleanup
    modalOverlay._reckoningAudio = reckoningAudio;
    modalOverlay._wasMusicPlaying = wasMusicPlaying;
    
    const modal = document.createElement('div');
    modal.className = 'cinematic-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'cinematic-modal-content';
    modalContent.innerHTML = `<div class="cinematic-title">━━━ THE RECKONING ━━━</div>`;
    
    modal.appendChild(modalContent);
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Function to append text to modal with typewriter effect
    const appendToModal = (text, delay = 0, useTypewriter = true) => {
      return new Promise(resolve => {
        setTimeout(() => {
          const p = document.createElement('p');
          if (text.trim() === '') {
            p.innerHTML = '<br>';
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            resolve();
          } else if (useTypewriter && text.trim() !== '' && !text.includes('explosive-bloody-text') && !text.includes('bloody-text') && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
            // Wrap text in typewriter span (but not for special effects or HTML tags)
            const span = document.createElement('span');
            span.className = 'typewriter-line';
            span.textContent = text;
            p.appendChild(span);
            modalContent.appendChild(p);
            
            // Measure the actual text width and set it as max-width to prevent cursor from extending
            // Use a temporary element to measure
            const measureEl = document.createElement('span');
            measureEl.style.visibility = 'hidden';
            measureEl.style.position = 'absolute';
            measureEl.style.whiteSpace = 'nowrap';
            measureEl.style.font = window.getComputedStyle(span).font;
            measureEl.textContent = text;
            document.body.appendChild(measureEl);
            const textWidth = measureEl.offsetWidth;
            document.body.removeChild(measureEl);
            
            // Set the max-width to the actual text width
            span.style.maxWidth = textWidth + 'px';
            
            // Remove cursor after animation completes (2s animation + small buffer)
            setTimeout(() => {
              span.classList.add('no-cursor');
            }, 2100);
            
            // Wait for animation to complete before resolving
            setTimeout(() => {
              modal.scrollTop = modal.scrollHeight;
              resolve();
            }, 2000);
          } else {
            // For special effects or when typewriter is disabled, just show the text
            p.innerHTML = text;
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            resolve();
          }
        }, delay);
      });
    };
    
    // Add close button - append to overlay so it's fixed on screen, not in scrollable content
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cinematic-modal-close-btn';
    closeBtn.textContent = '✕ Close';
    closeBtn.style.display = 'none'; // Hide initially, show when done
    closeBtn.onclick = () => {
      // Stop reckoning music
      if (modalOverlay._reckoningAudio) {
        modalOverlay._reckoningAudio.pause();
        modalOverlay._reckoningAudio.currentTime = 0;
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
      modalOverlay.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
      setTimeout(() => {
        modalOverlay.remove();
      }, 500);
    };
    modalOverlay.appendChild(closeBtn);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    await appendToModal(`You're leaving the stadium.`, 800);
    await appendToModal(`It's late. Dark. Quiet.`, 2200);
    await appendToModal(``, 0);
    await appendToModal(`<strong>A figure steps out of the shadows.</strong>`, 2500);
    await appendToModal(``, 0);
    await appendToModal(`"You."`, 800);
    await appendToModal(`The voice is cold. Familiar.`, 2200);
    await appendToModal(``, 0);
    await appendToModal(`<strong>Delmor Krunchem.</strong>`, 1000);
    await appendToModal(`His eyes are hollow. Empty.`, 2200);
    await appendToModal(``, 0);
    await appendToModal(`"You killed my family."`, 1000);
    await appendToModal(`"My wife. My children. Dead because of you."`, 2500);
    await appendToModal(``, 0);
    await appendToModal(`You try to speak. To explain. To run.`, 800);
    await appendToModal(`<strong>But it's too late.</strong>`, 2500);
    await appendToModal(``, 0);
    await appendToModal(`He raises a gun.`, 1500);
    await appendToModal(``, 0);
    if (typeof window.playSoundEffect === 'function') {
      window.playSoundEffect('pistol', 0.8);
    }
    await appendToModal(`<strong class="explosive-bloody-text">BANG.</strong>`, 1000);
    if (typeof window.playSoundEffect === 'function') {
      window.playSoundEffect('pistol', 0.8);
    }
    await appendToModal(`<strong class="explosive-bloody-text">BANG.</strong>`, 1000);
    if (typeof window.playSoundEffect === 'function') {
      window.playSoundEffect('pistol', 0.8);
    }
    await appendToModal(`<strong class="explosive-bloody-text">BANG.</strong>`, 2000);
    await appendToModal(``, 0);
    await appendToModal(`<span class="bloody-text">Everything goes black.</span>`, 2000);
    
    // Wait a bit after the text finishes generating (typewriter takes 2000ms, so wait additional 1500ms)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Stop reckoning music
    if (modalOverlay._reckoningAudio) {
      modalOverlay._reckoningAudio.pause();
      modalOverlay._reckoningAudio.currentTime = 0;
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
    
    // Close the modal and create black screen
    modalOverlay.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
    setTimeout(() => {
      modalOverlay.remove();
    }, 500);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create black screen overlay
    const blackScreen = document.createElement('div');
    blackScreen.className = 'black-screen-overlay';
    document.body.appendChild(blackScreen);
    
    // Wait 1-2 seconds after black screen appears
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add "months pass..." text
    const monthsText = document.createElement('div');
    monthsText.className = 'heart-monitor-beep';
    monthsText.textContent = 'months pass...';
    monthsText.style.animation = 'none';
    monthsText.style.opacity = '1';
    document.body.appendChild(monthsText);
    
    // Wait a bit, then remove months text and show beep
    await new Promise(resolve => setTimeout(resolve, 2000));
    monthsText.remove();
    
    // Add heart monitor beep text
    const beepText = document.createElement('div');
    beepText.className = 'heart-monitor-beep';
    beepText.textContent = 'beep. beep. beep.';
    document.body.appendChild(beepText);
    
    // Beep stays on screen for 1-2 seconds, then disappears
    await new Promise(resolve => setTimeout(resolve, 2000));
    beepText.remove();
    
    // THEN add wake up button
    await new Promise(resolve => setTimeout(resolve, 500));
    const wakeUpBtn = document.createElement('button');
    wakeUpBtn.className = 'wake-up-button';
    wakeUpBtn.textContent = 'Wake Up';
    document.body.appendChild(wakeUpBtn);
    
    // Wait for wake up button click
    await new Promise(resolve => {
      wakeUpBtn.onclick = () => {
        wakeUpBtn.remove();
        
        // Preload video for instant playback
        const video = document.createElement('video');
        video.src = 'https://www.dropbox.com/scl/fi/qchb5y8wrsxvj0f9ws1xg/coma.MP4?rlkey=01qaq0w7sk6plimx7qaym55j7&st=ihe7wf73&dl=1';
        video.preload = 'auto';
        video.controls = false;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        
        // Create video container immediately (no delay)
        const videoContainer = document.createElement('div');
        videoContainer.className = 'cinematic-video-container';
        videoContainer.style.opacity = '0';
        videoContainer.style.animation = 'none';
        
        const videoCloseBtn = document.createElement('button');
        videoCloseBtn.className = 'cinematic-video-close-btn';
        videoCloseBtn.textContent = '✕ Close';
        videoCloseBtn.style.display = 'none';
        
        videoContainer.appendChild(video);
        videoContainer.appendChild(videoCloseBtn);
        document.body.appendChild(videoContainer);
        
        // Fade out black screen and fade in video simultaneously
        blackScreen.style.transition = 'opacity 0.3s ease-out';
        blackScreen.style.opacity = '0';
        videoContainer.style.transition = 'opacity 0.3s ease-in';
        videoContainer.style.opacity = '1';
        
        // Start video playback immediately
        video.autoplay = true;
        video.play().catch(() => {
          // If autoplay fails, video will start when user interacts
        });
        
        // Remove black screen after fade
        setTimeout(() => {
          blackScreen.remove();
        }, 300);
        
        video.addEventListener('ended', () => {
          videoCloseBtn.style.display = 'block';
          videoCloseBtn.classList.add('show');
        });
        
        videoCloseBtn.onclick = () => {
          videoContainer.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
          setTimeout(() => {
            videoContainer.remove();
            resolve();
          }, 500);
        };
      };
    });
    
    // Set coma flag
    S.season3.player_coma_between_seasons = true;
    
    log(``);
  }
  
  
  // The ending verdict and THE END belong to the true end of the campaign only;
  // mid-campaign seasons get the season summary (metrics/finance/discipline).
  const campaignOver = (S.season|0) >= 5 || !!S.game_over;
  const ending = campaignOver ? pickEnding() : null;
  if (!campaignOver) { log(`<strong>━━━ SEASON ${S.season} SUMMARY ━━━</strong>`); }
  else if(ending==='Removed'){ log('<strong>Outcome:</strong> Removed / Administration. History frowns.'); }
  else if(ending==='PortsmouthDynasty'){ log('Outcome: Portsmouth win the Champions League behind a GOAT goalkeeper called Lionel. You are a trivia question.'); }
  else if(ending==='Double'){ log('<strong>Outcome:</strong> Premier League + Champions League. Ruthless churn bewildered Europe.'); }
  else if(ending==='LeagueOnly'){ log('<strong>Outcome:</strong> Premier League title secured. Europe slips away.'); }
  else if(ending==='ForcedSale'){ log('<strong>Outcome:</strong> Forced Sale. Regulators and lenders corner you; you sell under duress to a faceless consortium.'); }
  else if(ending==='FanCoup'){ log('<strong>Outcome:</strong> Fan Ownership Coup. Supporters trust raises funds and votes you out; the city throws a street party.'); }
  else if(ending==='NationBuyout'){ log('<strong>Outcome:</strong> Nation-state Buyout. A sovereign fund acquires the club; you walk away with a handshake and NDAs.'); }
  else { log('<strong>Outcome:</strong> A muddled campaign of half-measures and scandals. You linger, for now.'); }
  log(`<strong>Season Metrics:</strong> Morale ${S.morale} | Reputation ${S.reputation} | Compliance ${S.compliance_risk} | Legal ${S.legal_risk} | Paper Risk ${S.paperRisk}`);
  log(`<strong>Finance:</strong> Club Cash ${money(S.club_cash)} | Chair Cash ${money(S.chairman_cash)} | Club Debt ${money(S.club_debt)} | Off-books ${money(S.offbooks)}`);
  log(`<strong>Discipline:</strong> Ladder step ${S.discipline_step} | Embargo ${S.transfer_embargo?'Yes':'No'} | Points Deducted ${S.points_deducted}`);
  
  // Reset the table for a fresh season
  S.table = {};
  S.table_order = [];
  ensureLeagueTableInit(); // reseed rows for all teams
  renderLeagueTablePanel();
  
  if (campaignOver) log('<strong>THE END.</strong>');
}

// Season 5 opening sequence
async function runSeason5Opener() {
  // Initialize Season 5 state if missing
  if (!S.season5) S.season5 = {};
  
  log(``);
  log(`<strong style="font-size: 1.2em; color: #6366f1;">━━━ SEASON 5 ━━━</strong>`);
  log(``);
  
  // Ensure inventory is preserved from Season 4
  if (!S.inventory) S.inventory = { accolades: [], drugs: 0, items: [] };
  const inventoryBricks = (S.inventory.items || []).filter(item => item && typeof item === 'string' && item.toLowerCase().includes('brick')).length;
  const inventoryCocaine = S.inventory.drugs || 0;
  const inventoryItems = S.inventory.items || [];
  
  log(`Your inventory has been preserved from Season 4:`);
  if (inventoryBricks > 0) {
    log(`  • ${inventoryBricks} brick(s)`);
  }
  if (inventoryCocaine > 0) {
    log(`  • ${inventoryCocaine} bag(s) of cocaine`);
  }
  if (inventoryItems.length > 0) {
    inventoryItems.forEach(item => {
      if (item && typeof item === 'string' && !item.toLowerCase().includes('brick')) {
        log(`  • ${item}`);
      }
    });
  }
  if (inventoryBricks === 0 && inventoryCocaine === 0 && inventoryItems.length === 0) {
    log(`  (No items in inventory)`);
  }
  log(``);
  
  // Play Season 5 opening video
  const videoContainer = document.createElement('div');
  videoContainer.className = 'cinematic-video-container';
  const video = document.createElement('video');
  video.src = 'https://www.dropbox.com/scl/fi/4707l9egv54nxdm70uq6f/Video-1-7-26-5-29-47-pm.mp4?rlkey=79a7lloc2h4g6xh747te62an6&st=q3j4vq2t&dl=1';
  video.controls = false;
  video.autoplay = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'contain';
  
  const videoCloseBtn = document.createElement('button');
  videoCloseBtn.className = 'cinematic-video-close-btn';
  videoCloseBtn.textContent = '✕ Close';
  videoCloseBtn.style.display = 'none';
  
  await new Promise(resolve => {
    video.addEventListener('ended', () => {
      // After video ends, show "THE FINAL SEASON" overlay
      const finalSeasonOverlay = document.createElement('div');
      finalSeasonOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 30001;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: cinematicFadeIn 0.5s ease-out;
      `;
      
      const finalSeasonText = document.createElement('div');
      finalSeasonText.textContent = 'THE FINAL SEASON';
      finalSeasonText.style.cssText = `
        font-size: 72px;
        font-weight: 900;
        color: #ff4757;
        text-shadow: 
          0 0 20px rgba(255, 71, 87, 0.8),
          0 0 40px rgba(255, 71, 87, 0.6),
          0 0 60px rgba(255, 71, 87, 0.4);
        letter-spacing: 8px;
        font-family: 'Space Grotesk', sans-serif;
        animation: sinisterPulse 2s ease-in-out infinite;
        text-transform: uppercase;
      `;
      
      // Add sinister pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes sinisterPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.05);
            filter: brightness(1.2);
          }
        }
      `;
      document.head.appendChild(style);
      
      finalSeasonOverlay.appendChild(finalSeasonText);
      document.body.appendChild(finalSeasonOverlay);
      
      // Show overlay for 3 seconds, then fade out
      setTimeout(() => {
        finalSeasonOverlay.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
        setTimeout(() => {
          finalSeasonOverlay.remove();
          videoCloseBtn.style.display = 'block';
          videoCloseBtn.classList.add('show');
        }, 500);
      }, 3000);
    });
    
    videoCloseBtn.onclick = () => {
      videoContainer.style.animation = 'cinematicFadeIn 0.5s ease-out reverse';
      setTimeout(() => {
        videoContainer.remove();
        resolve();
      }, 500);
    };
    
    videoContainer.appendChild(video);
    videoContainer.appendChild(videoCloseBtn);
    document.body.appendChild(videoContainer);
  });
  
  log(``);
  log(`Mohammed Van Onslaught will be in attendance during the first game of Season 5.`);
  log(`Put in a Performance for the Ages to show him how us Brits do things.`);
  log(``);
  
  // Mark that we need to injure the two best players BEFORE the first match (so they can't be selected)
  S.season5.injure_best_players_first_match = true;
  // Mark that this is the first match of season 5 for special event
  S.season5.first_match_special_event = true;
  // Initialize kidnapping sequence flag to false (will be set to true after it plays)
  S.season5.kidnapping_sequence_shown = false;
}

// ---------- difficulty ----------
async function chooseDifficulty(){
 const d=await choose([{key:'l',label:'Lenient FA'},{key:'n',label:'Normal'},{key:'s',label:'Strict FA'}],'Select FA Strictness:');
 S.fa_strictness=(d==='l'?0:(d==='s'?2:1));
 log(S.fa_strictness===0?'Lenient: slower heat, milder penalties.':(S.fa_strictness===2?'Strict: faster heat, referrals likely.':'Normal: balanced oversight.'));
 render();
}

// ---------- prison match simulation ----------
async function simulatePrisonMatch(opponent) {
  // Simulate a match result while in prison (watching from your cell)
  // Prison matches: nuke morale, make losses more likely, cost the club
  
  const baseRating = 75; // Base team rating without manager
  const oppRating = opponent.rating || 75;
  
  // Heavy prison penalty - team performs much worse without manager
  const prisonPenalty = 25;
  const effectiveRating = Math.max(40, baseRating - prisonPenalty);
  
  // Bias heavily towards losses - prison makes team much weaker
  const lossBias = 30; // Additional penalty to make losses more likely
  const adjustedRating = effectiveRating - lossBias;
  
  // Calculate match outcome with loss bias
  const ratingDiff = adjustedRating - oppRating;
  const homeAdvantage = 3; // Reduced home advantage (team demoralized)
  
  // Random factors (reduced to make losses more predictable)
  const randomFactor = (Math.random() - 0.5) * 15;
  const finalRating = adjustedRating + homeAdvantage + randomFactor;
  
  // Determine goals - heavily weighted towards losses
  let ourGoals, theirGoals;
  const roll = Math.random();
  
  if (roll < 0.15 && finalRating > oppRating + 5) {
    // Rare win (15% chance if rating allows)
    ourGoals = Math.floor(Math.random() * 2) + 1; // 1-2 goals
    theirGoals = Math.floor(Math.random() * 2); // 0-1 goals
  } else if (roll < 0.35 && finalRating > oppRating - 3) {
    // Draw (20% chance)
    ourGoals = Math.floor(Math.random() * 2) + 1; // 1-2 goals
    theirGoals = ourGoals;
  } else {
    // Loss (65%+ chance) - most common outcome
    if (roll < 0.7) {
      // Narrow loss
      ourGoals = Math.floor(Math.random() * 2); // 0-1 goals
      theirGoals = Math.floor(Math.random() * 2) + 1; // 1-2 goals
    } else {
      // Heavy loss
      ourGoals = Math.floor(Math.random() * 2); // 0-1 goals
      theirGoals = Math.floor(Math.random() * 3) + 2; // 2-4 goals
    }
  }
  
  return {
    our_goals: ourGoals,
    their_goals: theirGoals,
    watched: false,
    prison_match: true
  };
}


// ---------- Save Slot System ----------
const NUM_SAVE_SLOTS = 10;
const SAVE_SLOT_PREFIX = 'saints_save_slot_';

function getSaveSlotKey(slotNumber) {
  return `${SAVE_SLOT_PREFIX}${slotNumber}`;
}

function getSaveSlotInfo(slotNumber) {
  const key = getSaveSlotKey(slotNumber);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  
  try {
    const data = JSON.parse(raw);
    return {
      slot: slotNumber,
      timestamp: data.timestamp || 0,
      date: data.date || 'Unknown',
      preview: data.preview || 'No preview available',
      hasData: true
    };
  } catch (e) {
    return null;
  }
}

function getAllSaveSlots() {
  const slots = [];
  for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
    const info = getSaveSlotInfo(i);
    slots.push(info || { slot: i, hasData: false });
  }
  return slots;
}

function saveToSlot(slotNumber) {
  if (!window.S) {
    log('❌ No game state to save.');
    return false;
  }
  
  try {
    const saveData = {
      gameState: window.S,
      timestamp: Date.now(),
      date: new Date().toLocaleString(),
      preview: getGamePreview()
    };
    
    const key = getSaveSlotKey(slotNumber);
    localStorage.setItem(key, JSON.stringify(saveData));
    log(`Game saved to slot ${slotNumber}.`);
    return true;
  } catch (e) {
    log(`❌ Failed to save to slot ${slotNumber}: ${e.message}`);
    return false;
  }
}

function loadFromSlot(slotNumber) {
  const key = getSaveSlotKey(slotNumber);
  const raw = localStorage.getItem(key);
  
  if (!raw) {
    log(`❌ No save found in slot ${slotNumber}.`);
    return false;
  }
  
  try {
    const data = JSON.parse(raw);
    if (!data.gameState) {
      log(`❌ Corrupted save data in slot ${slotNumber}.`);
      return false;
    }
    
    // Normalize/migrate the game state
    const normalizedState = normalizeGameState(data.gameState);
    
    // Write normalized state to main autosave key
    saveGame(normalizedState);
    
    // Update both window.S and global S reference
    window.S = normalizedState;
    if (typeof window !== 'undefined' && window.S) {
      // Ensure global S is also updated (for code that references the global directly)
      // Note: We can't directly assign to the global var S, but we can ensure
      // window.S is the source of truth and trigger a reload to reinitialize
    }
    
    // Persist metadata about which slot was loaded
    localStorage.setItem('last_loaded_slot', slotNumber.toString());
    localStorage.setItem('last_loaded_slot_date', (data.date || new Date().toISOString()));
    
    log(`Save loaded from slot ${slotNumber} (${data.date || 'Unknown date'}). Reloading page...`);
    
    // Trigger full page reload to ensure clean boot and no carry-over state
    setTimeout(() => {
      location.reload();
    }, 100);
    
    return true;
  } catch (e) {
    log(`❌ Failed to load from slot ${slotNumber}: ${e.message}`);
    localStorage.removeItem(key);
    return false;
  }
}

function deleteSlot(slotNumber) {
  const key = getSaveSlotKey(slotNumber);
  localStorage.removeItem(key);
  log(`Save slot ${slotNumber} deleted.`);
}

function getGamePreview() {
  if (!window.S) return 'No game state';
  
  let preview = '';
  if (window.S.season !== undefined) {
    preview += `Season ${window.S.season}`;
  }
  if (window.S.money !== undefined) {
    preview += preview ? ` • £${(window.S.money / 1000000).toFixed(1)}M` : `£${(window.S.money / 1000000).toFixed(1)}M`;
  }
  if (window.S.week !== undefined) {
    preview += preview ? ` • Week ${window.S.week}` : `Week ${window.S.week}`;
  }
  
  return preview || 'Game in progress';
}

function showSaveSlotModal(isLoading = false) {
  const overlay = document.createElement('div');
  overlay.className = 'save-slot-modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'save-slot-modal';
  
  const header = document.createElement('div');
  header.className = 'save-slot-header';
  header.innerHTML = `
    <h3>${isLoading ? 'Load Game' : 'Save Game'}</h3>
    <button class="save-slot-close" onclick="this.closest('.save-slot-modal-overlay').remove()">×</button>
  `;
  
  const body = document.createElement('div');
  body.className = 'save-slot-body';
  
  const grid = document.createElement('div');
  grid.className = 'save-slot-grid';
  
  const slots = getAllSaveSlots();
  
  slots.forEach(slot => {
    const slotItem = document.createElement('div');
    slotItem.className = `save-slot-item ${slot.hasData ? '' : 'empty'}`;
    
    if (slot.hasData) {
      slotItem.innerHTML = `
        <div class="save-slot-number">${slot.slot}</div>
        <div class="save-slot-info">${slot.preview}</div>
        <div class="save-slot-date">${slot.date}</div>
        ${!isLoading ? `<button class="save-slot-delete" onclick="event.stopPropagation(); deleteSaveSlot(${slot.slot}); this.closest('.save-slot-modal-overlay').remove();">Delete</button>` : ''}
      `;
      
      slotItem.onclick = async () => {
        if (isLoading) {
          // Hide gate screen and start screen when loading
          const ladsGateScreen = document.getElementById('ladsGateScreen');
          if (ladsGateScreen) {
            ladsGateScreen.classList.add('hidden');
          }
          const startScreen = document.getElementById('startScreen');
          if (startScreen) {
            startScreen.classList.add('hidden');
          }
          // Stop opening music
          const openingMusic = document.getElementById('openingMusic');
          if (openingMusic && !openingMusic.paused) {
            openingMusic.pause();
            openingMusic.currentTime = 0;
          }
          
          if (loadFromSlot(slot.slot)) {
            overlay.remove();
            // loadFromSlot() triggers a reload, so code below won't run
            // The reload will trigger auto-load via window load handler
          }
        } else {
          if (saveToSlot(slot.slot)) {
            overlay.remove();
          }
        }
      };
    } else {
      slotItem.innerHTML = `
        <div class="save-slot-number">${slot.slot}</div>
        <div class="save-slot-info">Empty Slot</div>
      `;
      
      if (!isLoading) {
        slotItem.onclick = () => {
          if (saveToSlot(slot.slot)) {
            overlay.remove();
          }
        };
      }
    }
    
    grid.appendChild(slotItem);
  });
  
  body.appendChild(grid);
  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };
  
  document.body.appendChild(overlay);
}

async function deleteSaveSlot(slotNumber) {
  // remember which slot list was open: the Delete button's handler closes it while we ask
  const openOverlay = document.querySelector('.save-slot-modal-overlay');
  const wasLoading = openOverlay ? openOverlay.querySelector('h3')?.textContent === 'Load Game' : null;
  const sure = window.KUI ? await KUI.confirm(`Are you sure you want to delete save slot ${slotNumber}?`, { title: 'Delete save', ok: 'Delete', variant: 'sinister' })
                          : confirm(`Are you sure you want to delete save slot ${slotNumber}?`);
  if (sure) {
    deleteSlot(slotNumber);
    log(`Save slot ${slotNumber} deleted.`);
    // Refresh the modal if it's open
    const overlay = document.querySelector('.save-slot-modal-overlay');
    if (overlay) {
      const isLoading = overlay.querySelector('h3')?.textContent === 'Load Game';
      overlay.remove();
      showSaveSlotModal(isLoading);
    } else if (wasLoading !== null) {
      showSaveSlotModal(wasLoading);
    }
  }
}
