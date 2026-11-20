// ========== SEASON 4 POST-MATCH PROCESSING ==========
if (S.season === 4 && S.season4 && S.season4.initialized) {
  // Process weekly hostile takeovers (at least one per week)
  processSeason4WeeklyTakeovers();
  
  // Process monthly pressure events
  processSeason4MonthlyEvents();
  
  // Van Onslaught visit (mid-season, around match 8)
  if (!S.season4.van_onslaught_visit_triggered && S.matches_played >= 8 && S.matches_played <= 10) {
    S.season4.van_onslaught_visit_triggered = true;
    await triggerVanOnslaughtVisit();
  }
}

// ========== SEASON 5 POST-MATCH PROCESSING ==========
if (S.season === 5 && S.season5 && S.season5.initialized) {
  // Process weekly hostile takeovers (at least one per week) - reuse Season 4 function
  if (typeof processSeason4WeeklyTakeovers === 'function') {
    processSeason4WeeklyTakeovers();
  }
  
  // Process monthly pressure events - reuse Season 4 function
  if (typeof processSeason4MonthlyEvents === 'function') {
    processSeason4MonthlyEvents();
  }
  
  // Season 5 Match 7: Son's weapons collection event
  if (S.matches_played === 6 && !S.season5.son_weapons_event_complete) {
    S.season5.son_weapons_event_complete = true;
    
    log(``);
    log(`⚠️ Intelligence reports suggest Mohammed van Onslaught is rumored to make his move against Southampton during the last game of the season.`);
    log(`You NEED to find some means of defense.`);
    log(``);
    log(`Suddenly, you recall that your son was expelled from school for stockpiling assault weapons and munitions.`);
    log(`The school investigated the weapons, and found that your son "probably didn't mean any harm" and so they've agreed to release the weapons to you.`);
    log(``);
    
    await waitForLogQueue();
    
    const choice = await choose([
      { key: 'yes', label: 'Yes - arm yourself' }
    ], 'Do you want to go to the head office of your son\'s school to collect the guns?');
    
    if (choice === 'yes') {
      // Show video modal
      const videoDiv = document.createElement('div');
      videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
      
      const dropboxUrl = 'https://www.dropbox.com/scl/fi/q94f13zzvbbmjyfw48rv1/Video-1-8-26-3-10-33-pm.mp4?rlkey=bb5fcrcj493hojwnf3xdpzn6k&st=7vjwmg7c&dl=1';
      
      const xButton = document.createElement('button');
      xButton.textContent = '✕';
      xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #6366f1; color: white; border: none; width: 30px; height: 30px; font-size: 20px; cursor: pointer; z-index: 10001;';
      xButton.onclick = () => {
        videoDiv.remove();
        if (videoDiv.querySelector('video')) {
          videoDiv.querySelector('video').pause();
        }
      };
      
      videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 SCHOOL HEAD OFFICE</div><video id="schoolWeaponsVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + dropboxUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
      videoDiv.appendChild(xButton);
      document.body.appendChild(videoDiv);
      
      // Wait for video to finish or be closed
      await new Promise(resolve => {
        const video = document.getElementById('schoolWeaponsVideo');
        if (video) {
          const handleEnd = () => {
            videoDiv.remove();
            resolve();
          };
          const handleClose = () => {
            videoDiv.remove();
            resolve();
          };
          video.addEventListener('ended', handleEnd);
          xButton.addEventListener('click', handleClose);
        } else {
          // Fallback if video doesn't load
          setTimeout(() => {
            videoDiv.remove();
            resolve();
          }, 1000);
        }
      });
      
      log(``);
      log(`✅ You now have means of defense.`);
      log(``);
      
      // Track that player has armed themselves
      if (!S.season5) S.season5 = {};
      S.season5.armed_with_son_weapons = true;
    }
    
    await waitForLogQueue();
  }
}

// Handle cronster CD event if pending
if (typeof handleCronsterCDEvent === 'function') {
  await handleCronsterCDEvent();
}
// Handle final confrontation if pending (post-match fallback)
if (S.cronster && S.cronster.active && !S.cronster.booby_trap_climax_triggered && !S.cronster.defeated && S.season >= 2) {
  // Check if pending flag is set, OR if conditions are met right now
  const matchesPlayed = S.matches_played || 0;
  const seasonMatches = S.season_matches || 16;
  const isLatterHalf = matchesPlayed >= Math.floor(seasonMatches / 2);
  const isPast75Percent = matchesPlayed >= Math.floor(seasonMatches * 0.75);
  const hasEnoughEvents = (S.cronster.sightings_count >= 3) || 
                         (S.cronster.juice_incident) || 
                         (S.cronster.cd_received);
  
  const shouldTrigger = S.cronster.booby_trap_pending_climax || 
                       (S.cronster.letter_received && isLatterHalf && (hasEnoughEvents || isPast75Percent));
  
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
  }
}
// ========== SEASON 4 WEEKLY HOSTILE TAKEOVERS ==========
function processSeason4WeeklyTakeovers() {
  if (S.season !== 4 || !S.season4 || !S.season4.initialized) return;
  
  // Get teams actively in the league (from opponents list, plus Southampton)
  const ourClub = (S.club_name || "Southampton FC");
  const activeTeams = [ourClub, ...(S.opponents || [])];
  
  // Filter to only teams that are:
  // 1. In the active league (S.opponents or Southampton)
  // 2. Not Southampton or Portsmouth
  // 3. Not already taken over
  // 4. Not liquidated
  const liquidatedTeams = (S.season4.liquidated_teams || []);
  const availableTeams = activeTeams.filter(teamName => {
    // Exclude Southampton and Portsmouth
    if (teamName === ourClub || teamName === "Southampton" || teamName === "Portsmouth") {
      return false;
    }
    // Exclude liquidated teams
    if (liquidatedTeams.includes(teamName)) {
      return false;
    }
    // Exclude already taken over teams
    if (S.season4.clubs_taken_over && S.season4.clubs_taken_over[teamName]) {
      return false;
    }
    // Also check if this team name is a new name from a previous takeover (shouldn't happen, but safety check)
    if (S.season4.clubs_taken_over) {
      const isNewName = Object.values(S.season4.clubs_taken_over).includes(teamName);
      if (isNewName) return false;
    }
    return true;
  });
  
  if (availableTeams.length === 0) return; // All teams taken over
  
  // One per week (sometimes two per week) until all teams except user and Portsmouth are taken over
  const takeoversThisWeek = (Math.random() < 0.3) ? 2 : 1; // 30% chance of 2 takeovers
  const teamsToTakeover = [];
  
  for (let i = 0; i < takeoversThisWeek && availableTeams.length > 0; i++) {
    // Randomly select a team to take over
    const randomIndex = Math.floor(Math.random() * availableTeams.length);
    const teamToTakeover = availableTeams[randomIndex];
    teamsToTakeover.push(teamToTakeover);
    // Remove from available list to avoid taking over the same team twice in one week
    availableTeams.splice(randomIndex, 1);
  }
  
  // Process each takeover
  for (const teamToTakeover of teamsToTakeover) {
    const newName = getSeason4TakeoverName(S.season4.takeover_stage);
    
    // Mark as taken over in Season 4 tracking (for backwards compatibility)
    S.season4.clubs_taken_over[teamToTakeover] = newName;
    S.season4.clubs_taken_over_count++;
    
    // Use unified rename system to handle ALL updates consistently
    renameTeam(teamToTakeover, newName, {
      isPlayerClub: false,
      updateRival: false
    });
    
    // Varied messages for club buyouts - less bureaucratic, more editorial variance
    const buyoutMessages = [
      {
        email: `📧 League Administration Email:`,
        body: [
          `Please note that ${teamToTakeover} has been rebranded as ${newName}.`,
          `Competitive balance adjustments have been applied.`,
          `The club has received a financial injection and +3 league points.`
        ]
      },
      {
        email: `📧 League Administration Email:`,
        body: [
          `${teamToTakeover} is now ${newName}. The transition is complete.`,
          `Competitive balance adjustments have been applied.`,
          `The club has received a financial injection and +3 league points.`
        ]
      },
      {
        email: `📰 BREAKING:`,
        body: [
          `${teamToTakeover} has been purchased and rebranded as ${newName}.`,
          `The new owners have injected funds and received a 3-point competitive balance adjustment.`,
          `The old club no longer exists.`
        ]
      },
      {
        email: `📧 League Administration Email:`,
        body: [
          `Effective immediately: ${teamToTakeover} → ${newName}.`,
          `Financial injection and competitive balance adjustments (+3 points) have been applied.`,
          `The previous entity has been dissolved.`
        ]
      },
      {
        email: `📰 NEWS:`,
        body: [
          `${newName} has taken over ${teamToTakeover}'s league position.`,
          `The regime has provided financial support and a 3-point adjustment.`,
          `Another one bites the dust.`
        ]
      }
    ];
    
    const selectedMessage = buyoutMessages[Math.floor(Math.random() * buyoutMessages.length)];
    log(``);
    log(`<strong>${selectedMessage.email}</strong>`);
    selectedMessage.body.forEach(line => log(line));
    log(``);
    
    // Apply the benefits
    if (S.table && S.table[newName]) {
      S.table[newName].PTS = (S.table[newName].PTS || 0) + 3;
    }
  }
  
  // Normalize games played after takeovers to ensure consistency
  if (teamsToTakeover.length > 0 && typeof normalizeGamesPlayed === 'function') {
    normalizeGamesPlayed();
  }
  
  // Refresh league table UI to show the updated team names (once after all takeovers)
  if (teamsToTakeover.length > 0 && typeof renderLeagueTablePanel === 'function') {
    renderLeagueTablePanel();
  }
}

// ========== SEASON 4 MONTHLY PRESSURE EVENTS ==========
function processSeason4MonthlyEvents() {
  if (S.season !== 4 || !S.season4 || !S.season4.initialized) return;
  
  const matchesPlayed = S.matches_played || 0;
  const matchesPerMonth = Math.ceil((S.season_matches || 16) / 4); // ~4 matches per month
  const currentMonth = Math.floor(matchesPlayed / matchesPerMonth);
  
  // Only process if we've moved to a new month
  if (currentMonth <= S.season4.last_monthly_event) return;
  
  S.season4.last_monthly_event = currentMonth;
  S.season4.monthly_event_count++;
  
  // Update takeover stage based on progress
  if (currentMonth >= 3) {
    S.season4.takeover_stage = 'LATE';
  } else if (currentMonth >= 1) {
    S.season4.takeover_stage = 'MID';
  }
  
  // Moral law update (one-time, early in season)
  if (!S.season4.cocaine_price_doubled && currentMonth >= 1) {
    S.season4.cocaine_price_doubled = true;
    log(``);
    log(`<strong>📧 League Administration Email:</strong>`);
    log(`Please note recent clarifications to league regulations.`);
    log(`Certain substances are now subject to updated pricing structures.`);
    log(``);
  }
  
  // Adultery punishment notice (mid-season)
  if (!S.season4.adultery_punishable && currentMonth >= 2) {
    S.season4.adultery_punishable = true;
    log(``);
    log(`<strong>📧 League Administration Email:</strong>`);
    log(`Please note recent clarifications to moral law.`);
    log(`Certain behaviors are now classified as non-compliant.`);
    log(`Punishments will be applied retroactively where applicable.`);
    log(``);
  }
  
  // Sheikh Rod Johnson appearance (random chance, increases over time)
  if (Math.random() < (0.2 + (currentMonth * 0.1))) {
    triggerSheikhRodJohnsonAppearance();
  }
}

// Sheikh Rod Johnson appearance system
function triggerSheikhRodJohnsonAppearance() {
  if (S.season !== 4 || !S.season4) return;
  
  S.season4.rod_johnson_appearances = (S.season4.rod_johnson_appearances || 0) + 1;
  
  const appearances = S.season4.rod_johnson_appearances;
  
  // Early appearances: news stories/arrests
  if (appearances <= 2) {
    const headlines = [
      'COMEDIAN SHEIKH ROD JOHNSON ARRESTED AFTER OFFENSIVE ROUTINE',
      'SHEIKH ROD JOHNSON FACES CHARGES FOR "CULTURALLY INSENSITIVE" MATERIAL',
      'CONTROVERSIAL COMEDIAN SHEIKH ROD JOHNSON DETAINED BY AUTHORITIES'
    ];
    const headline = headlines[Math.floor(Math.random() * headlines.length)];
    
    log(``);
    log(`<strong>📰 ${headline}</strong>`);
    log(`Mashallah, football's never been cleaner. Except morally. That's still filthy.`);
    log(`Sheikh Rod Johnson was arrested following a routine that authorities described as "grossly offensive."`);
    log(`However, sources indicate the regime tolerates his attacks on the right people.`);
    log(``);
  } else if (appearances === 3) {
    // Transition to state-sanctioned
    S.season4.rod_johnson_state_sanctioned = true;
    log(``);
    log(`<strong>📰 SHEIKH ROD JOHNSON GRANTED STATE SANCTION</strong>`);
    log(`Mashallah. The regime has recognized Sheikh Rod Johnson's value in reframing cruelty as tradition.`);
    log(`He will now appear as an official pundit and commentator.`);
    log(``);
  } else {
    // State-sanctioned appearances
    const quotes = [
      `Mashallah, football's never been cleaner. Except morally. That's still filthy.`,
      `Inshallah, the transition continues. Some clubs resist, but resistance is futile.`,
      `Alhamdulillah, we're seeing real progress. The old ways are being corrected.`,
      `Salaam alaikum, and welcome to another week of compliance. Non-compliance will be corrected.`
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    
    log(``);
    log(`<strong>📺 Pundit Commentary:</strong>`);
    log(`Sheikh Rod Johnson: "${quote}"`);
    log(``);
  }
}

// Van Onslaught club sale visit (mandatory mid-season event)
async function triggerVanOnslaughtVisit() {
  if (S.season !== 4 || !S.season4 || S.season4.van_onslaught_visit_complete) return;
  
  log(``);
  log(`<strong>🚪 Knock at the door...</strong>`);
  log(``);
  log(`Mohammed Von Onslaught is at the door.`);
  log(``);
  
  // Wait for log to display
  await waitForLogQueue();
  
  // Show button to let him in
  const letHimInChoice = await choose([
    { key: 'let_in', label: 'Let him in', variant: 'warn' }
  ], 'Mohammed Von Onslaught is at the door');
  
  if (letHimInChoice === 'let_in') {
    log(`You open the door.`);
    log(`Mohammed Van Onslaught stands there.`);
    log(`He is calm. Polite. Lethal.`);
    log(``);
    
    // Wait for log to display
    await waitForLogQueue();
    
    // Show video modal
    const videoDiv = document.createElement('div');
    videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
    
    const dropboxUrl = 'https://www.dropbox.com/scl/fi/jse4pu6hej5dxkd7yso3e/My-Movie-124.mp4?rlkey=c1tri0haymvl0oas8em1up9v6&st=bmnmf3f3&dl=1';
    
    const xButton = document.createElement('button');
    xButton.textContent = '✕';
    xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #6366f1; color: white; border: none; width: 30px; height: 30px; font-size: 20px; cursor: pointer; z-index: 10001;';
    xButton.onclick = () => {
      videoDiv.remove();
    };
    
    videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 MOHAMMED VAN ONSLAUGHT</div><video id="vanOnslaughtVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + dropboxUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
    videoDiv.appendChild(xButton);
    document.body.appendChild(videoDiv);
    
    // Wait for video to finish or be closed
    await new Promise(resolve => {
      const video = document.getElementById('vanOnslaughtVideo');
      if (video) {
        video.addEventListener('ended', () => {
          setTimeout(() => {
            videoDiv.remove();
            resolve();
          }, 500);
        });
      }
      // Also resolve if video is closed manually (handled by xButton)
      const checkClosed = setInterval(() => {
        if (!document.body.contains(videoDiv)) {
          clearInterval(checkClosed);
          resolve();
        }
      }, 100);
    });
    
    log(``);
    log(`"Salaam alaikum," he says, his voice cold and precise.`);
    log(`"I am here to make you an offer."`);
    log(``);
    log(`He explains that the regime wishes to purchase your club.`);
    log(`The terms are generous. The alternative is... unclear.`);
    log(``);
    log(`You consider your options.`);
    log(``);
    
    // Player must refuse (no choice, but we show the interaction)
    await new Promise(resolve => setTimeout(resolve, 2000));
    log(`"Fuck off van onslaught you wanker, ill never bend the knee, you hear me? NEVER"`);
    log(``);
    log(`Mohammed Van Onslaught smiles.`);
    log(`"So be it, enjoy your points deduction."`);
    log(`He leaves without another word.`);
    log(``);
    
    // Immediate consequence (non-negotiable)
    S.season4.club_sale_refused = true;
    S.season4.van_onslaught_visit_complete = true;
  }
  
  if (!S.season4.points_deducted_for_refusal) {
    S.points_deducted = (S.points_deducted || 0) + 3;
    adjustClubPoints(-3);
    S.season4.points_deducted_for_refusal = true;
    
    log(`<strong>📧 League Administration Email:</strong>`);
    log(`Competitive balance adjusted.`);
    log(`Your club has been deducted 3 league points.`);
    log(`No appeal process is available.`);
    log(``);
  }
}

// ========== SEASON 3 POST-MATCH EVENTS ==========
if (S.season === 3 && S.season3) {
  // Krunchem murder threat news story (mid-season, before family murder)
  if (!S.season3.krunchem_threat_story_shown && !S.season3.krunchem_family_murdered && S.matches_played >= 8 && S.matches_played <= 12) {
    if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function' && S.press) {
      const chairmanName = S.full_name || S.player_firstname && S.player_surname ? `${S.player_firstname} ${S.player_surname}` : 'the Southampton chairman';
      const storyBody = `By Political Correspondent | Westminster

In a press conference that has sent shockwaves through English football, Portsmouth chairman Delmor Krunchem has made what appears to be an explicit death threat against his Southampton rival.

"I am going to kill ${chairmanName}," Krunchem told assembled journalists this morning. "This is not a metaphor, these are not terms of art. I plan to murder him."

The statement, delivered with chilling clarity, has prompted immediate calls for police intervention and raised serious questions about security measures across the Premier League.

However, in a bewildering response that has drawn widespread condemnation, Labour leader Sir Keir Starmer has dismissed the threat as figurative language.

Speaking to reporters outside Downing Street this afternoon, Starmer said:

"I think Delmor Krunchem used metaphors and terms of art to express his passionate rivalry with Southampton. Football is an emotional game, and we need to understand the context."

When pressed by journalists who pointed out that Krunchem had explicitly stated his words were "not a metaphor" and "not terms of art," Starmer doubled down.

"We need to be more understanding," he said. "Krunchem has informed me that he identifies as an oppressed person, so it's important he's given leeway to heal from his trauma."

The comments have sparked outrage across the political spectrum and within football circles.

"This is insane," said one Labour backbencher who wished to remain anonymous. "A man has publicly announced his intention to murder someone, and the Prime Minister is calling it a metaphor. How is this real?"

Legal experts have described Krunchem's statement as a clear breach of UK law regarding threats to kill, which carries a maximum sentence of ten years in prison.

"This is not ambiguous," said criminal barrister Sarah Thornton. "He has explicitly stated his intention to murder someone. The fact that he pre-emptively clarified it was not a metaphor makes it even more explicit. This should result in immediate arrest."

Hampshire Police have confirmed they are "monitoring the situation" but have not yet taken action.

Meanwhile, Southampton FC has released a brief statement expressing "deep concern" for the safety of their chairman and calling for "appropriate authorities to take this matter seriously."

Krunchem, who has a history of making inflammatory public statements, has not walked back his comments. When contacted for clarification, his representatives said only: "Mr. Krunchem stands by his statement."

Security at St Mary's Stadium has reportedly been increased ahead of Southampton's next home fixture.

The Football Association has declined to comment, stating that "this is a matter for law enforcement."

As one headline this morning put it: "Murder Threat Dismissed as Poetry."

Whether police will act on what appears to be an explicit and unambiguous threat to kill remains to be seen.`;
      
      const krunchemThreatStory = {
        section: 'football',
        headline: 'Krunchem: "I Am Going to Kill Southampton Chairman" — Starmer Says It\'s a "Metaphor"',
        writer: getNextWriter(),
        body: storyBody,
        effects: {}
      };
      
      S.season3.krunchem_threat_story_shown = true;
      log(`📰 <strong>Breaking news: Delmor Krunchem has made a shocking public statement.</strong>`);
      await showNewsArticle(krunchemThreatStory);
    }
  }
  
  // Krunchem harrowing messages after family murder (no press briefings)
  if (S.season === 3 && S.season3 && S.season3.krunchem_family_murdered && !S.season3.krunchem_shot_player) {
    // Only send messages, no press briefings
    if (Math.random() < 0.4) { // 40% chance per match
      const harrowingMessages = [
        "I'm coming for you. You killed my family. I will make you suffer.",
        "You think you're safe? I'm watching. Always watching. Your time is coming.",
        "My wife. My children. Dead because of you. I will destroy everything you love.",
        "I'm in the shadows. Waiting. Planning. You will pay for what you did.",
        "Every day I think about them. Every day I think about you. One day soon, we'll meet.",
        "You took everything from me. I will take everything from you. Slowly. Painfully.",
        "I can see you. I know where you are. Sleep well, knowing I'm coming.",
        "The police can't protect you. Your money can't protect you. Nothing can protect you from me.",
        "I'm not going to the press. I'm not going to the police. I'm coming for you directly.",
        "You murdered my family. I will make you wish you were dead. But you won't die quickly."
      ];
      const message = pick(harrowingMessages);
      // Show as popup immediately
      if (typeof showRivalTextPopup === 'function') {
        showRivalTextPopup(message);
      } else if (typeof window.enqueueRivalText === 'function') {
        window.enqueueRivalText(message);
      } else if (typeof sendRivalText === 'function') {
        sendRivalText(message);
      } else {
        log(`📱 Delmor Krunchem: "${message}"`);
      }
    }
  }

  // Shafty Rod Johnson Fratton Park arrest news story (after Krunchem family murder)
  if (S.season3.krunchem_family_murdered && !S.season3.shafty_rod_johnson_fratton_arrest_shown) {
    S.season3.shafty_rod_johnson_fratton_arrest_shown = true;
    
    if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
      const newsStory = {
        section: 'Football / Crime / "Culture"',
        headline: 'COMEDIAN SHAFTY ROD JOHNSON ARRESTED AFTER "BRICK ROUTINE" OUTSIDE FRATTON PARK',
        writer: getNextWriter(),
        body: `NEWS STORY — SHAFTY ROD JOHNSON ARRESTED AT FRATTON PARK

SECTION: Football / Crime / "Culture"

HEADLINE:
COMEDIAN SHAFTY ROD JOHNSON ARRESTED AFTER "BRICK ROUTINE" OUTSIDE FRATTON PARK

BYLINE:
Staff Reporter | Late Evening Edition

Shafty Rod Johnson was arrested last night outside Fratton Park following an impromptu stand-up routine delivered to a crowd of football fans that police have described as "grossly offensive, deliberately inflammatory, and completely devoid of remorse."

Johnson, who was not scheduled to perform, reportedly climbed onto a traffic barrier shortly after full-time and began what witnesses described as "a bit about Delmor Krunchem."

The routine centred on recent rumours surrounding the violent deaths of Krunchem's family — rumours Johnson treated not as tragedy, but as comic material.

According to multiple attendees, Johnson repeatedly referenced "a brick", asking the crowd whether they preferred "old-school methods" and remarking that "you don't need fancy tech when you've got proper British building materials."

One witness said Johnson appeared to relish the crowd's discomfort.

"He kept saying things like 'imagine being the only one left' and then laughing when no one laughed back," the witness said. "Then he told us that was the joke."

Johnson reportedly mocked the idea of sympathy, telling the crowd that Krunchem was "still breathing, so what's he whinging about," before suggesting that watching something "build character."

Several fans began to leave during the set, at which point Johnson allegedly shouted after them:

"Oi! Don't walk off — this is the best bit. This is where he has to live with it."

Police were called when Johnson began speculating about who might have been "holding the brick," adding that it was "always someone you trust," before bowing theatrically.

Officers arrested Johnson on suspicion of public order offences. He did not resist, reportedly telling police:

"Cancel culture's gone mad. You can't even do family material anymore."

CLUB RESPONSE

Portsmouth FC released a brief statement confirming that the incident took place outside club grounds and that the club "does not condone comedy."`
      };
      
      log('📰 A shocking story has broken in the news.');
      await showNewsArticle(newsStory);
    }
  }

  // Gaz incidents (own goals, theft, harassment) - random post-match events
  if (S.season3.gaz_signed && !S.season3.gaz_killed_by_player && !S.season3.gaz_reported && Math.random() < 0.3) {
    const incidents = [
      () => {
        log(`Post-match report: Paul Gascoigne scored an own goal.`);
        log(`"Sorry, boss. Got confused which end was which."`);
        S.reputation = Math.max(0, (S.reputation || 50) - 2);
      },
      () => {
        log(`Post-match report: Paul Gascoigne was caught stealing from the dressing room.`);
        log(`"Just borrowing it, like. Forgot to ask."`);
        incrementRisk('theft', 3);
      },
      () => {
        log(`Post-match report: Paul Gascoigne harassed a member of staff.`);
        log(`"Just having a laugh, me. No harm meant."`);
        incrementRisk('harassment', 5);
        S.compliance_risk += 3;
      }
    ];
    pick(incidents)();
  }

  // Captain outing to press (if seduced and player chooses to betray)
  // Press call after captain seduction (guaranteed after seduction)
  if (S.season3 && S.season3.captain_seduced && S.season3.captain_press_call_pending && !S.season3.captain_outed_to_press && S.matches_played >= (S.season3.captain_seduction_match || 0) + 1) {
    S.season3.captain_press_call_pending = false;
    const captainName = S.captain_name || 'Team Captain';
    log(`Your phone rings.`);
    log(``);
    log(`"Hello, this is the press. We've heard some interesting things about one of your players."`);
    log(`"Do you have any gossip about ${captainName}? We're willing to pay handsomely for a story."`);
    log(``);
    
    const choice = await choose([
      { key: 'out_him', label: 'Out him to the press (make money)', variant: 'bad' },
      { key: 'deny', label: 'Deny everything - keep the secret' }
    ], 'Press asking for gossip about captain');
    
    if (choice === 'out_him') {
      S.season3.captain_outed_to_press = true;
      let payout = 500000 + Math.floor(Math.random() * 500000);
      let stdMentioned = false;
      
      // Check if player has very bad STD and offer to mention it for extra money
      const hasVeryBadSTD = S.very_bad_std_state === 'infected';
      if (hasVeryBadSTD) {
        log(``);
        const mentionStd = await choose([
          { key: 'mention', label: 'Mention the very bad STD for extra money', variant: 'bad' },
          { key: 'dont_mention', label: 'Keep it to yourself' }
        ], 'You could make this story even bigger...');
        
        if (mentionStd === 'mention') {
          payout += 300000; // Extra money for mentioning STD
          stdMentioned = true;
          log(`You tell them about the very bad STD. Their eyes light up.`);
        }
      }
      
      S.club_cash = (S.club_cash || 0) + payout;
      log(`You sell the story. The next day, headlines scream:`);
      log(`"${captainName.toUpperCase()} OUTED: CHAIRMAN BREAKS CONFIDENCE"`);
      if (stdMentioned) {
        log(`"CHAIRMAN REVEALS CAPTAIN CONTRACTED VERY BAD STD"`);
      }
      log(`"SOUTHAMPTON CAPTAIN RESIGNS FROM FOOTBALL"`);
      log(``);
      log(`${captainName} immediately resigns from the team and retires from football.`);
      log(`He becomes a drug addict, his life destroyed.`);
      log(``);
      log(`You receive £${payout.toLocaleString()} for the story.`);
      S.reputation = Math.max(0, (S.reputation || 50) - 15);
      incrementRisk('betrayal', 10);
      
      // Add press story about STD if mentioned
      if (stdMentioned && typeof addPaper === 'function') {
        addPaper('Chairman reveals captain contracted very bad STD', 20);
      }
      
      // Remove captain from squad if he exists
      if (S.squad && Array.isArray(S.squad)) {
        S.squad = S.squad.filter(p => p.name !== captainName);
      }
    } else {
      log(`You deny everything. "I have no comment on that matter."`);
      log(`The journalist sounds disappointed but hangs up.`);
      log(`Your secret remains safe.`);
    }
  }
  
  // Legacy press event (keep for backwards compatibility)
  if (S.season3.captain_seduced && !S.season3.captain_outed_to_press && !S.season3.captain_press_call_pending && S.matches_played >= 10 && Math.random() < 0.15) {
    log(`A journalist approaches you after the match.`);
    log(`"We've heard rumours about your captain. Care to comment?"`);
    log(``);
    
    const choice = await choose([
      { key: 'sell_story', label: 'Sell the story to the press', variant: 'bad' },
      { key: 'deny', label: 'Deny everything' }
    ], 'Journalist asking about captain');
    
    if (choice === 'sell_story') {
      S.season3.captain_outed_to_press = true;
      log(`You sell the story. The next day, headlines scream:`);
      log(`"SOUTHAMPTON CAPTAIN OUTED: CHAIRMAN BREAKS CONFIDENCE"`);
      log(`Your captain's career is destroyed. He never speaks to you again.`);
      S.reputation = Math.max(0, (S.reputation || 50) - 15);
      incrementRisk('betrayal', 10);
    } else {
      log(`You deny everything. The journalist looks disappointed.`);
    }
  }

  // Gaz forced first team effects (own goals, media mockery, boasts)
  if (S.season3.gaz_first_team_forced && !S.season3.gaz_killed_by_player && !S.season3.gaz_reported) {
    // Increased chance of own goals when Gaz is forced into lineup
    if (Math.random() < 0.4) {
      log(`Post-match report: Paul Gascoigne scored an own goal.`);
      log(`"Sorry, boss. Still getting used to which end is which."`);
      log(`The media mocks your decision to start him.`);
      log(`"CHAIRMAN FORCED TO START GAZZA AFTER SUICIDE THREAT"`);
      S.reputation = Math.max(0, (S.reputation || 50) - 3);
      S.fan_morale = Math.max(0, (S.fan_morale || 50) - 5);
    }
    
    // Gaz boasts about coercion working
    if (Math.random() < 0.2) {
      log(`Gazza approaches you after the match.`);
      log(`"See? I told you threats work. You gave in, didn't you?"`);
      log(`"That's how you get what you want in this world."`);
      log(`He grins, pleased with himself.`);
    }
  }

  // Gaz continues theft (passive drain)
  if (S.season3.gaz_continues_theft && !S.season3.gaz_killed_by_player && !S.season3.gaz_reported && Math.random() < 0.3) {
    const stolenAmount = Math.floor(Math.random() * 30000) + 20000; // £20k-50k
    log(`Post-match report: Paul Gascoigne was caught stealing from the club.`);
    log(`"Just borrowing it, like. Forgot to ask."`);
    log(`£${stolenAmount.toLocaleString()} missing from club funds.`);
    S.club_cash = Math.max(0, (S.club_cash || 0) - stolenAmount);
    incrementRisk('theft', 3);
  }
}

// >>> 4A Section 3 hook — MUST stay before "Evening" advance <<<
await postMatchBriberyFollowups_4A({
  gf,
  ga,
  wasHome
});

// Check for season end - chairman league is now integrated into showEndOfSeasonPresentation
// Removed separate call to avoid redundancy

// ---- Drinking and Manager Confrontation System ----
// Track drinking behavior and check for confrontation risk
if (S.isDrunk === true) {
  S.drunk_matches_count = (S.drunk_matches_count || 0) + 1;
  S.manager_relationship = Math.max(0, (S.manager_relationship || 50) - 5);
  
  // Check if player broke their apology promise
  if (S.manager_apologies_count > 0 && !S.manager_quit_after_apology) {
    await handleBrokenApologyPromise();
  }
}

// Check if manager confrontation should be triggered
const shouldTriggerConfrontation = checkManagerConfrontationRisk();
if (shouldTriggerConfrontation) {
  await triggerManagerUltimatumConfrontation();
}


// ---- Manager Confrontation System Functions ----
function checkManagerConfrontationRisk() {
  // Don't trigger if already given ultimatum or manager already quit
  if (S.manager_ultimatum_given || S.manager_quit_after_apology) {
    return false;
  }
  
  const drunkMatches = S.drunk_matches_count || 0;
  const apologies = S.manager_apologies_count || 0;
  const relationship = S.manager_relationship || 50;
  
  // Risk increases with more drunk matches and fewer apologies
  const riskScore = (drunkMatches * 2) - (apologies * 1) + ((50 - relationship) / 10);
  
  // Trigger confrontation if risk is high enough
  return riskScore >= 8 && drunkMatches >= 3;
}

async function triggerManagerUltimatumConfrontation() {
  // Stop general background music for confrontation UI
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
  
  S.manager_ultimatum_given = true;
  
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  const quirk = (S?.manager && S.manager.quirk) ? S.manager.quirk : 'none';
  
  log(`<strong>🚪 Knock at the door...</strong>`);
  log(`${managerName} enters your office with a stern expression.`);
  
  // Quirk-based ultimatum dialogue
  const ultimatumDialogue = {
    'media-friendly': `"I can't keep covering for your drinking anymore. The press is starting to notice, and it's damaging the club's reputation. You need to cut the match day drinking or I'm walking."`,
    'superstitious': `"Your drinking is bringing bad energy to this club. I can feel it in the dressing room. Either you stop drinking before matches or I can't work under this curse anymore."`,
    'data-driven': `"The data is clear - your drinking correlates with a 15% drop in team performance and a 23% increase in negative press coverage. This is unsustainable. Stop drinking or I quit."`,
    'old-school': `"This club has standards, and your drinking is beneath them. I won't be associated with this kind of behavior. Either you clean up your act or I'm gone."`,
    "players' coach": `"The lads are losing respect for you, and I can't blame them. Your drinking is affecting team morale. Stop drinking before matches or I can't work here anymore."`,
    'hardliner': `"This is completely unacceptable. Your drinking is unprofessional and sets a terrible example. Either you stop immediately or I'm walking out that door."`,
    'tinkerer': `"Your drinking is disrupting everything we're trying to build here. I can't work with someone who can't stay focused. Stop drinking or I quit."`,
    'motivator': `"How am I supposed to motivate the team when their chairman is drunk during matches? This is demoralizing. Stop drinking or I can't work here."`,
    'disciplinarian': `"Discipline starts at the top, and your drinking shows none. This is completely unacceptable. Either you stop drinking or I'm gone."`,
    'none': `"Your drinking is unacceptable. Either you stop drinking before matches or I'm quitting."`
  };
  
  const dialogue = ultimatumDialogue[quirk] || ultimatumDialogue['none'];
  log(dialogue);
  
  // Present options
  const options = [
    { key: 'apologize', label: 'Apologize and promise to stop drinking' },
    { key: 'refuse', label: 'Tell him you\'ll never stop being you' }
  ];
  
  // Add brick option if player has one equipped
  const hasBrick = S.inventory && S.inventory.items && 
    S.inventory.items.some(item => item.name === 'Brick' && item.equipped);
  
  if (hasBrick) {
    options.push({ key: 'throw_brick', label: 'Throw brick at him' });
  }
  
  const choice = await choose(options, 'How do you respond to the ultimatum?');
  
  if (choice === 'apologize') {
    await handleApologyResponse();
  } else if (choice === 'refuse') {
    await handleRefusalResponse();
  } else if (choice === 'throw_brick') {
    await handleBrickThrowResponse();
  }
}

async function handleApologyResponse() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`"I'm sorry," you say. "You're right, I need to stop drinking before matches. It's unprofessional and I'm letting the club down."`);
  log(`${managerName} nods sternly. "I'll hold you to that. One more drunk match and I'm gone."`);
  log(`He turns and walks out of your office.`);
  
  S.manager_apologies_count = (S.manager_apologies_count || 0) + 1;
  S.manager_relationship = Math.min(100, (S.manager_relationship || 50) + 10);
  S.manager_ultimatum_given = false; // Reset for potential future confrontations
}

async function handleRefusalResponse() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`"I'll never stop being me," you declare defiantly. "This is who I am, and if you can't handle that, then maybe you should leave."`);
  log(`${managerName} shakes his head in disappointment. "Then I'm done. I can't work for someone who won't take responsibility for their actions."`);
  log(`He turns and walks out of your office, slamming the door behind him.`);
  
  // Manager quits - set manager to null and force hiring
  S.manager_quit_after_apology = true;
  S.manager_relationship = 0;
  S.manager = null;
  S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
  log(`<strong>Your manager has quit!</strong> You'll need to hire a new one.`);
  
  // Force hiring a new manager
  if (typeof ensureManagerHiredIfMissing === 'function') {
    await ensureManagerHiredIfMissing();
  }
}

async function handleBrickThrowResponse() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`You reach for the brick in your pocket and hurl it at ${managerName}.`);
  log(`The brick strikes him square in the chest, knocking him to the ground.`);
  log(`"What the hell is wrong with you?!" he shouts, scrambling to his feet.`);
  log(`"I'm done! I'm calling the police and I'm quitting!" He storms out of your office.`);
  
  // Manager quits and police are called
  S.manager_quit_after_apology = true;
  S.manager_relationship = 0;
  S.manager = null;
  S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
  S.police_risk = Math.min(100, (S.police_risk || 0) + 30);
  
  log(`<strong>Your manager has quit!</strong> You'll need to hire a new one.`);
  log(`<strong>⚠️ Police Risk Increased!</strong> Assaulting your manager has drawn unwanted attention.`);
  
  // Force hiring a new manager
  if (typeof ensureManagerHiredIfMissing === 'function') {
    await ensureManagerHiredIfMissing();
  }
}

async function handleBrokenApologyPromise() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`<strong>🚪 Knock at the door...</strong>`);
  log(`${managerName} enters your office, his face red with anger.`);
  log(`"You promised me you'd stop drinking before matches!" he shouts. "And here you are, drunk again!"`);
  log(`"I gave you a second chance and you threw it away. I'm done with this club."`);
  log(`He turns and starts walking toward the door.`);
  
  // Present options for what to do while he's walking away
  const options = [
    { key: 'let_him_go', label: 'Let him walk away' }
  ];
  
  // Add brick option if player has one equipped
  const hasBrick = S.inventory && S.inventory.items && 
    S.inventory.items.some(item => item.name === 'Brick' && item.equipped);
  
  if (hasBrick) {
    options.push({ key: 'throw_brick_back', label: 'Throw brick at the back of his head' });
  }
  
  const choice = await choose(options, 'What do you do as he walks away?');
  
  if (choice === 'let_him_go') {
    log(`You watch as ${managerName} slams the door behind him.`);
    log(`<strong>Your manager has quit!</strong> You'll need to hire a new one.`);
  } else if (choice === 'throw_brick_back') {
    await handleBrickThrowAtBackOfHead();
  }
  
  // Manager quits regardless - set manager to null and force hiring
  S.manager_quit_after_apology = true;
  S.manager_relationship = 0;
  S.manager = null;
  S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
  
  // Force hiring a new manager (unless brick was thrown, which handles it separately)
  if (choice === 'let_him_go' && typeof ensureManagerHiredIfMissing === 'function') {
    await ensureManagerHiredIfMissing();
  }
}

async function handleBrickThrowAtBackOfHead() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`You grab the brick from your pocket and hurl it at the back of ${managerName}'s head.`);
  log(`The brick connects with a sickening thud, and he collapses to the ground unconscious.`);
  log(`Blood pools around his head as he lies motionless on the floor.`);
  
  // Immediate arrest
  log(`<strong>🚨 POLICE ARREST!</strong>`);
  log(`The sound of the impact was heard by staff outside your office.`);
  log(`Police arrive within minutes and arrest you for assault with a deadly weapon.`);
  log(`You are taken away in handcuffs, leaving your unconscious manager bleeding on the floor.`);
  
  // Set arrest flags and consequences
  S.police_risk = 100;
  S.manager_relationship = 0;
  S.manager_quit_after_apology = true;
  S.manager = null;
  S.manager_events = { warned_this_match: false, crisis_this_match: false, fired_this_match: false };
  
  // Trigger arrest sequence
  if (typeof queueInvestigation === 'function') {
    queueInvestigation('police', 'assault');
  }
  
  log(`<strong>You have been arrested for assault!</strong> Your career as chairman is likely over.`);
  log(`<strong>Your manager has quit!</strong> You'll need to hire a new one.`);
  
  // Force hiring a new manager (after arrest sequence)
  if (typeof ensureManagerHiredIfMissing === 'function') {
    await ensureManagerHiredIfMissing();
  }
}

async function _choose4A(options, title){
  if (typeof choose === 'function') {
    return await choose(options, title);
  }
  const host = document.getElementById('actions');
  return await new Promise(resolve=>{
    host.innerHTML = '';
    const h = document.createElement('div');
    if (title){
      const t = document.createElement('div');
      t.className = 'sub';
      t.textContent = title;
      h.appendChild(t);
    }
    options.forEach(opt=>{
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = opt.label || opt.key;
      b.addEventListener('click', ()=> resolve(opt.key));
      h.appendChild(b);
    });
    host.appendChild(h);
  });
}

function _fmtGBP(n){ try { return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n|0); } catch { return "£"+String(n|0); } }
function _num(n){ return (typeof n==='number' && isFinite(n)) ? n : 0; }

/** Main awaited gate called from postMatchPhase */
async function postMatchBriberyFollowups_4A({ gf, ga, wasHome }){
  if (!window.S) return;
  // normalize flags across older variants
  const bribedRef     = !!S.bribed_ref || S.referee_bribed === true || (S.referee_bribed === 'us' || S.referee_bribed === 'them');
  let   refTarget     = S.bribe_ref_target || S.ref_bribe_side || (S.referee_bribed === 'us' || S.referee_bribed === 'them' ? S.referee_bribed : 'us');
  const refAmt        = _num(S.bribed_ref_amount);

  const bribedMgr     = !!S.opponent_bribed || !!S.bribed_mgr;
  const mgrAmt        = _num(S.opponent_bribed_amount ?? S.bribed_mgr_amount);

  const weWon  = gf > ga;
  const theyWon= ga > gf;
  const isDraw = gf === ga;

  // --- Referee follow-up ---
  if (bribedRef){
    // If you model in-match bias flags, prefer them; otherwise judge by result vs target
    const helpedUs   = !!S._ref_helped_us;
    const helpedThem = !!S._ref_helped_them;
    const observedHelp =
      (refTarget === 'us')   ? (helpedUs   || weWon && !theyWon) :
      (refTarget === 'them') ? (helpedThem || theyWon && !weWon) : false;

    if (observedHelp){
      log("The referee’s decisions seemed to favor the intended side. The bribe appears to have paid off.");
      S._bribe_success_count = (S._bribe_success_count||0) + 1;
    } else {
      // present consequences
      const refChoice = await _choose4A([
        {key:'b', label:'Blackmail the referee'},
        {key:'e', label:'Expose the referee to the FA'},
        {key:'n', label:'Do nothing'}
      ], "Your referee bribe didn’t deliver. How do you respond?");

      if (refChoice === 'b'){
        const recoup = Math.max(25000, Math.floor(refAmt * 0.25));
        S.club_cash = _num(S.club_cash) + recoup;
        S.legal_risk = _num(S.legal_risk) + 4;
        log(`You attempt to blackmail the referee and recover ${_fmtGBP(recoup)}. Legal risk rises.`);
        updateHUD?.();
      } else if (refChoice === 'e'){
        S.legal_risk = Math.max(0, _num(S.legal_risk) - 3);
        S.reputation = _num(S.reputation) + 2;
        log("You submit evidence to the FA. Legal risk dips, but scrutiny grows.");
      } else {
        S.compliance_risk = _num(S.compliance_risk) + 1;
        log("You accept the loss quietly. Accounting may notice the missing funds.");
      }
    }

    // clear per-match ref fields (supporting your various names)
    delete S.bribed_ref;
    delete S.bribed_ref_amount;
    delete S.bribe_ref_target;
    if (S.referee_bribed) S.referee_bribed = false;
    S._ref_helped_us = false;
    S._ref_helped_them = false;
  }

  // --- Opposing manager follow-up ---
  if (bribedMgr){
    // intent is always to benefit us — success if weWon (draw = fail by your spec)
    if (weWon){
      log("Rumors suggest the opposition weren’t at their best today. Whispers of match-fixing persist.");
      S._bribe_success_count = (S._bribe_success_count||0) + 1;
    } else {
      const mgrChoice = await _choose4A([
        {key:'x', label:'Retaliate / Expose the manager'},
        {key:'r', label:'Demand a refund'},
        {key:'n', label:'Do nothing'}
      ], "The opposing manager didn’t honor your payment. What do you do?");

      if (mgrChoice === 'x'){
        S.reputation = _num(S.reputation) + 5;
        S.fa_risk    = _num(S.fa_risk) + 2;
        log("You expose the opposing manager. The league takes notice; your reputation rises, but scrutiny follows.");
      } else if (mgrChoice === 'r'){
        const token = Math.max(50000, Math.floor(mgrAmt * 0.15));
        S.club_cash = _num(S.club_cash) + token;
        log(`You demand your money back. You claw back ${_fmtGBP(token)} after some unpleasant phone calls.`);
        updateHUD?.();
      } else {
        S.compliance_risk = _num(S.compliance_risk) + 2;
        log("You let it slide. The board will not be impressed.");
      }
    }

    // clear manager bribe flags (support both names)
    delete S.opponent_bribed_amount;
    delete S.bribed_mgr_amount;
    if (S.opponent_bribed) S.opponent_bribed = false;
    if (S.bribed_mgr)      S.bribed_mgr = false;
  }

  // --- If YOU accepted a bribe pre-match ---
  if (S.accepted_bribe_this_match){
    if (theyWon){
      // honored the deal → fans unhappy
      S.fan_morale = Math.max(0, _num(S.fan_morale) - 1);
      log("Fans seemed disappointed with the lack of fight today.");
    } else if (weWon){
      // betrayed the deal → fans happy with result
      S.fan_morale = Math.min(100, _num(S.fan_morale) + 2);
      log("Defying corruption, you still won! Fans cheer your defiance.");
    }
    
    // Check for bribe breach (accepted bribe but didn't honor terms)
    if (S._accepted_opponent_mgr_bribe && S._mgr_bribe_terms) {
      const currentMatchIndex = S.matches_played || 0;
      const breachMatchIndex = S._mgr_bribe_terms.matchIndex;
      // Check if this is the match where the bribe was accepted (handles both before/after increment)
      if (currentMatchIndex === breachMatchIndex || (currentMatchIndex - 1) === breachMatchIndex) {
        const expectedOutcome = S._mgr_bribe_terms.expectedOutcome;
        const breachOccurred = 
          (expectedOutcome === 'lose' && !theyWon) ||
          (expectedOutcome === 'draw' && !isDraw) ||
          (expectedOutcome === 'win' && !weWon);
        
        if (breachOccurred) {
          await handleOpposingManagerBribeBreach({ gf, ga, oppTeam: S._mgr_bribe_terms.opponentClub || 'Opponent' });
        }
      }
    }
    
    S.accepted_bribe_this_match = false;
    S._accepted_opponent_mgr_bribe = false;
    delete S._mgr_bribe_terms;
    updateHUD?.();
  }
}

// === Bribery follow-up after a match (call this after logging the result) ===
async function resolveBriberyAfterMatch(gf, ga, oppTeam){
  if (!window.S) return;

  // Idempotence per round: never resolve twice for the same match
  if ((S._bribery_resolved_for_round|0) === (S.matches_played|0)) return;
  S._bribery_resolved_for_round = (S.matches_played|0);

  // Safe defaults for older saves
  if (!Array.isArray(S.bribe_log)) S.bribe_log = [];
  ['offbooks','reputation','fa_risk','police_risk','legal_risk','compliance_risk','board_support','fan_morale']
    .forEach(k => { if (typeof S[k] !== 'number') S[k] = (k==='reputation'||k==='board_support')?50:(k==='fan_morale'?50:0); });

  const weWon  = gf > ga;
  const theyWon= ga > gf;
  const isDraw = gf === ga;

  // --- Referee bribe fallout (you bribed the ref pre-match) ---
  if (S.referee_bribed){
    const sideWanted = S.ref_bribe_side === 'them' ? 'them' : 'us'; // default to 'us'
    const paidOff = (sideWanted === 'us') ? weWon : theyWon;

    if (paidOff){
      log(`The referee’s decisions seemed to favor ${sideWanted === 'us' ? 'your side' : 'the opposition'}. The bribe appears to have paid off.`);
      S.bribe_log.push({ type:'referee', week:S.matches_played, outcome:'success', side:sideWanted });
    } else {
      // present choices (uses your global choose(); if missing, we fallback to a simple inline chooser)
      await presentRefereeBribeFailChoices();
    }

    // clear one-shot flags
    S.referee_bribed   = false;
    S.referee_assaulted = false;
    S.ref_bribe_side   = null;
    S.ref_bribe_amount = 0;
  }

  // --- You bribed the OPPOSING MANAGER ---
  if (S.opponent_bribed){
    const want = S.opp_bribe_side === 'them' ? 'them' : 'us'; // default 'us' (you want to win)
    const paidOff = (want === 'us') ? weWon : theyWon;

    if (paidOff){
      log(`Rumors suggest ${oppTeam||'the opposition'} weren’t at their best today. (Match-fixing whispers persist.)`);
      S.bribe_log.push({ type:'manager', week:S.matches_played, outcome:'success', side:want });
    } else {
      await presentManagerBribeFailChoices(oppTeam||'Opponent');
    }

    S.opponent_bribed     = false;
    S.opp_bribe_side      = null;
    S.opponent_bribed_amount = 0;
  }

  // --- THEY bribed YOU and didn't get the result they paid for ---
  if (S.accepted_bribe_this_match){
    const theyWanted = S.took_bribe_side === 'us' ? 'us' : 'them'; // usually 'them'
    const delivered  = (theyWanted === 'them') ? theyWon : weWon;

    if (!delivered){
      // They confront you
      await presentBriberConfrontsYou(oppTeam||'Opponent');
    }
    
    // Check for bribe breach (accepted opposing manager bribe but didn't honor terms)
    if (S._accepted_opponent_mgr_bribe && S._mgr_bribe_terms) {
      const currentMatchIndex = S.matches_played || 0;
      const breachMatchIndex = S._mgr_bribe_terms.matchIndex;
      // Check if this is the match where the bribe was accepted (handles both before/after increment)
      if (currentMatchIndex === breachMatchIndex || (currentMatchIndex - 1) === breachMatchIndex) {
        const expectedOutcome = S._mgr_bribe_terms.expectedOutcome;
        const breachOccurred = 
          (expectedOutcome === 'lose' && !theyWon) ||
          (expectedOutcome === 'draw' && !isDraw) ||
          (expectedOutcome === 'win' && !weWon);
        
        if (breachOccurred) {
          await handleOpposingManagerBribeBreach({ gf, ga, oppTeam: S._mgr_bribe_terms.opponentClub || oppTeam || 'Opponent' });
        }
      }
    }

    S.accepted_bribe_this_match = false;
    S._accepted_opponent_mgr_bribe = false;
    delete S._mgr_bribe_terms;
    S.took_bribe_side           = null;
    S.bribe_taken_amount        = 0;
  }
}

// --- Choice presenters (use your global choose(); fallback provided) ---
async function presentRefereeBribeFailChoices(){
  if (typeof choose === 'function'){
    const k = await choose([
      {key:'b', label:'Blackmail the referee (recover cash, raise legal risk)'},
      {key:'e', label:'Expose the referee (lower legal risk, rep up)'},
      {key:'n', label:'Do nothing'}
    ], 'Referee didn’t deliver. What do you do?');
    if (k==='b'){
      const rec = 200000; S.club_cash = (S.club_cash|0) + rec;
      S.legal_risk = Math.min(100,(S.legal_risk|0) + 4);
      log(`You threaten the referee and claw back £${rec.toLocaleString()}. Legal risk rises.`);
    } else if (k==='e'){
      S.legal_risk = Math.max(0,(S.legal_risk|0) - 3);
      S.reputation = (S.reputation|0) + 3;
      log("You report the referee. You look principled; legal risk eases.");
      
      // Generate gossip story about the referee exposure
      initPressSystem();
      const exposeStory = generateGossipStory('expose', 'The Referee');
      queueStory(exposeStory);
    } else {
      log("You let it go. The board may notice the missing funds.");
      S.compliance_risk = (S.compliance_risk|0) + 1;
    }
    updateHUD?.();
    return;
  }
  // Fallback inline buttons into #actions if choose() isn’t available
  const host = document.getElementById('actions'); if (!host) return;
  host.innerHTML = '';
  const wrap = document.createElement('div');
  const t = document.createElement('div'); t.className='sub'; t.textContent = "Referee didn’t deliver. What do you do?"; wrap.appendChild(t);
  [['Blackmail','b'],['Expose','e'],['Do nothing','n']].forEach(([label,key])=>{
    const b = document.createElement('button'); b.className='btn'; b.textContent = label;
    b.onclick = ()=> {
      if (key==='b'){ const rec=200000; S.club_cash=(S.club_cash|0)+rec; S.legal_risk=Math.min(100,(S.legal_risk|0)+4); log(`You threaten the referee and claw back £${rec.toLocaleString()}. Legal risk rises.`); }
      if (key==='e'){ 
        S.legal_risk=Math.max(0,(S.legal_risk|0)-3); 
        S.reputation=(S.reputation|0)+3; 
        log("You report the referee. You look principled; legal risk eases.");
        
        // Generate gossip story about the referee exposure
        initPressSystem();
        const exposeStory = generateGossipStory('expose', 'The Referee');
        queueStory(exposeStory);
      }
      if (key==='n'){ log("You let it go. The board may notice the missing funds."); S.compliance_risk=(S.compliance_risk|0)+1; }
      host.innerHTML = ''; updateHUD?.();
    };
    wrap.appendChild(b);
  });
  host.appendChild(wrap);
}

async function presentManagerBribeFailChoices(oppTeam){
  if (typeof choose === 'function'){
    const k = await choose([
      {key:'x', label:`Expose ${oppTeam} manager (ban risk up for them, rep up)`},
      {key:'r', label:'Demand refund (low chance)'},
      {key:'n', label:'Do nothing'}
    ], 'They took your money and didn’t deliver. Your move?');
    if (k==='x'){ 
      S.reputation=(S.reputation|0)+3; 
      S.fa_risk=(S.fa_risk|0)+2; 
      log(`You expose them. Sanctions likely; your rep rises.`);
      
      // Generate gossip story about the exposure
      initPressSystem();
      const exposeStory = generateGossipStory('expose', oppTeam);
      queueStory(exposeStory);
    }
    if (k==='r'){ const claw = Math.random()<0.25 ? 200000 : 0; if (claw){ S.club_cash=(S.club_cash|0)+claw; log(`You claw back £${claw.toLocaleString()}.`);} else { log("Your demand is ignored."); } }
    if (k==='n'){ log("You swallow the loss. The board is unimpressed."); S.board_support=Math.max(0,(S.board_support|0)-2); }
    updateHUD?.();
    return;
  }
  // Fallback buttons
  const host = document.getElementById('actions'); if (!host) return;
  host.innerHTML = '';
  const wrap = document.createElement('div');
  const t = document.createElement('div'); t.className='sub'; t.textContent = "They took your money and didn’t deliver. Your move?"; wrap.appendChild(t);
  [['Expose manager','x'],['Demand refund','r'],['Do nothing','n']].forEach(([label,key])=>{
    const b = document.createElement('button'); b.className='btn'; b.textContent = label;
    b.onclick = ()=> {
      if (key==='x'){ 
        S.reputation=(S.reputation|0)+3; 
        S.fa_risk=(S.fa_risk|0)+2; 
        log(`You expose them. Sanctions likely; your rep rises.`);
        
        // Generate gossip story about the exposure
        initPressSystem();
        const exposeStory = generateGossipStory('expose', oppTeam);
        queueStory(exposeStory);
      }
      if (key==='r'){ const claw = Math.random()<0.25 ? 200000 : 0; if (claw){ S.club_cash=(S.club_cash|0)+claw; log(`You claw back £${claw.toLocaleString()}.`);} else { log("Your demand is ignored."); } }
      if (key==='n'){ log("You swallow the loss. The board is unimpressed."); S.board_support=Math.max(0,(S.board_support|0)-2); }
      host.innerHTML = ''; updateHUD?.();
    };
    wrap.appendChild(b);
  });
  host.appendChild(wrap);
}

// Handle probabilistic fallout when player accepts opposing manager bribe but doesn't honor terms
async function handleOpposingManagerBribeBreach({ gf, ga, oppTeam }){
  if (!S || !S._mgr_bribe_terms) return;
  
  const currentMatchIndex = S.matches_played || 0;
  const breachMatchIndex = S._mgr_bribe_terms.matchIndex;
  
  // Prevent duplicate handling (use the match index that was just played)
  const handledMatchIndex = (currentMatchIndex === breachMatchIndex) ? breachMatchIndex : breachMatchIndex;
  if (S._mgr_bribe_breach_handled_for_match === handledMatchIndex) return;
  S._mgr_bribe_breach_handled_for_match = handledMatchIndex;
  
  const weWon = gf > ga;
  const theyWon = ga > gf;
  const isDraw = gf === ga;
  const bribeAmount = S._mgr_bribe_terms.amount || 0;
  const expectedOutcome = S._mgr_bribe_terms.expectedOutcome || 'lose';
  
  // Calculate trigger chance based on risk stats
  const baseChance = 0.20;
  const policeRiskFactor = (S.police_risk || 0) / 300;
  const legalRiskFactor = (S.legal_risk || 0) / 400;
  const complianceRiskFactor = (S.compliance_risk || 0) / 500;
  const triggerChance = Math.max(0.15, Math.min(0.65, 
    baseChance + policeRiskFactor + legalRiskFactor + complianceRiskFactor
  ));
  
  if (Math.random() >= triggerChance) {
    log("You sense a faint disappointment in the opposing dugout. Nothing comes of it. For now.");
    return;
  }
  
  // Triggered: choose fallout type
  const falloutWeights = [
    { type: 'police', weight: 30 + (S.police_risk || 0) / 2 },
    { type: 'press', weight: 25 + (S.legal_risk || 0) / 3 },
    { type: 'internal', weight: 20 },
    { type: 'repayment', weight: 25 + (S.compliance_risk || 0) / 4 }
  ];
  
  const totalWeight = falloutWeights.reduce((sum, f) => sum + f.weight, 0);
  let roll = Math.random() * totalWeight;
  let selectedFallout = falloutWeights[0].type;
  
  for (const fallout of falloutWeights) {
    if (roll <= fallout.weight) {
      selectedFallout = fallout.type;
      break;
    }
    roll -= fallout.weight;
  }
  
  // Execute selected fallout
  if (selectedFallout === 'police') {
    await handleBribeBreachPoliceInterview(bribeAmount, oppTeam);
  } else if (selectedFallout === 'press') {
    handleBribeBreachPressLeak(bribeAmount, oppTeam);
  } else if (selectedFallout === 'internal') {
    handleBribeBreachInternalReactions();
  } else if (selectedFallout === 'repayment') {
    await handleBribeBreachRepaymentDemand(bribeAmount, oppTeam);
  }
  
  // Log to bribe_log if it exists
  if (Array.isArray(S.bribe_log)) {
    S.bribe_log.push({ 
      type: 'opponent_mgr_bribe_breach', 
      week: currentMatchIndex, 
      outcome: 'breach', 
      fallout: selectedFallout,
      amount: bribeAmount 
    });
  }
}

// Fallout A: Police interview for "refusing to honor the bribe"
async function handleBribeBreachPoliceInterview(bribeAmount, oppTeam) {
  log("A few days after the match, you receive a summons.");
  log("The police arrive, and mention that you recently accepted a bribe from a rival manager and failed to honor it. They tell you that this is against the law, and tell you to pay it back");
  
  const caseType = 'breach of corrupt contract';
  
  // Check for Bribery Personality Disorder certificate
  const hasBriberyCert = S.doctor && S.doctor.disorder_certificates && 
    S.doctor.disorder_certificates.some(cert => 
      cert.type === 'Bribery Personality Disorder' && !cert.used
    );
  
  const options = [
    { key: 'repay', label: `Repay bribe + interest (${_fmtGBP(bribeAmount + Math.max(25000, Math.floor(bribeAmount * 0.325)))})` },
    { key: 'bribe', label: 'Attempt to bribe the officer' },
    { key: 'deny', label: 'Deny everything (risk increases)' }
  ];
  
  if (hasBriberyCert) {
    options.push({ key: 'cert', label: 'Present Bribery Personality Disorder certificate' });
  }
  
  const choice = await _choose4A(options, 
    "Police Interview: \"We hear you accepted a bribe and refused to honour it. This is a serious matter.\"");
  
  if (choice === 'repay') {
    const interest = Math.max(25000, Math.floor(bribeAmount * (0.20 + Math.random() * 0.25)));
    const repayTotal = bribeAmount + interest;
    
    let paid = false;
    if ((S.chairman_cash || 0) >= repayTotal) {
      S.chairman_cash -= repayTotal;
      paid = true;
    } else if ((S.club_cash || 0) >= repayTotal) {
      S.club_cash -= repayTotal;
      paid = true;
    }
    
    if (paid) {
      log(`You repay ${_fmtGBP(repayTotal)} (${_fmtGBP(bribeAmount)} principal + ${_fmtGBP(interest)} interest).`);
      log("The officer nods. \"We'll note this as resolved. Don't let it happen again.\"");
      S.police_risk = Math.max(0, (S.police_risk || 0) - 3);
      S.legal_risk = Math.min(100, (S.legal_risk || 0) + 2);
      S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 2);
      S.reputation = Math.max(0, (S.reputation || 0) - 2);
    } else {
      log("You can't afford the repayment. The case proceeds.");
      S.police_risk = Math.min(100, (S.police_risk || 0) + 5);
      S.legal_risk = Math.min(100, (S.legal_risk || 0) + 4);
      const fineChair = Math.floor(bribeAmount * 0.15);
      const fineClub = Math.floor(bribeAmount * 0.10);
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
    }
    updateHUD?.();
  } else if (choice === 'bribe') {
    const bribeChance = Math.random() < 0.4;
    const bribeAsk = Math.floor(bribeAmount * 1.5 + Math.random() * 50000);
    
    if (bribeChance) {
      log(`The officer looks around nervously. "Well... we might be able to make this go away for ${_fmtGBP(bribeAsk)}."`);
      const canPay = (S.chairman_cash || 0) >= bribeAsk || (S.club_cash || 0) >= bribeAsk;
      
      if (canPay) {
        if ((S.chairman_cash || 0) >= bribeAsk) {
          S.chairman_cash -= bribeAsk;
        } else {
          S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAsk);
        }
        log("Envelopes change hands. The case disappears from the files.");
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        updateHUD?.();
      } else {
        log("You can't raise the money. They proceed with the case.");
        S.police_risk = Math.min(100, (S.police_risk || 0) + 3);
        S.legal_risk = Math.min(100, (S.legal_risk || 0) + 3);
      }
    } else {
      log("They recoil. \"Do not attempt to interfere.\" The file thickens.");
      S.police_risk = Math.min(100, (S.police_risk || 0) + 4);
      S.legal_risk = Math.min(100, (S.legal_risk || 0) + 3);
    }
    updateHUD?.();
  } else if (choice === 'cert' && hasBriberyCert) {
    const cert = S.doctor.disorder_certificates.find(c => 
      c.type === 'Bribery Personality Disorder' && !c.used
    );
    if (cert) {
      cert.used = true;
      log("You present your Bribery Personality Disorder certificate.");
      log("\"Oh my god,\" the officer says, reading the diagnosis. \"On medical grounds, your bribery cannot be considered deliberate.\"");
      log("The police are sympathetic and decide to drop the case.");
      log("On medical grounds, your bribery cannot be considered deliberate.");
      // Zero consequences (per user request - maybe small reputational whisper or none)
      S.reputation = Math.max(0, (S.reputation || 0) - 1);
      if (typeof window.renderDoctor === 'function') {
        window.renderDoctor();
      }
      updateHUD?.();
    }
  } else if (choice === 'deny') {
    log("You deny everything. The officer's expression hardens.");
    log("\"We have evidence. This will not end well for you.\"");
    S.police_risk = Math.min(100, (S.police_risk || 0) + 5);
    S.legal_risk = Math.min(100, (S.legal_risk || 0) + 4);
    const fineChair = Math.floor(bribeAmount * 0.20);
    const fineClub = Math.floor(bribeAmount * 0.15);
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
    S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
    updateHUD?.();
  }
}

// Fallout B: Press leak
function handleBribeBreachPressLeak(bribeAmount, oppTeam) {
  const headlines = [
    `Opposition boss claims Saints chairman 'took the money and still tried'`,
    `Gossip: CHAIRX too corrupt to even be corrupt properly`,
    `${oppTeam} manager: "We paid him to lose. He took it and won anyway."`
  ];
  const headline = headlines[Math.floor(Math.random() * headlines.length)];
  
  if (typeof addPaper === 'function') {
    addPaper(headline, 8 + Math.floor(Math.random() * 5));
  }
  
  log(headline);
  log("The story spreads. You're corrupt, but also unreliable.");
  
  S.reputation = Math.max(0, (S.reputation || 0) - (3 + Math.floor(Math.random() * 6)));
  
  // Relationship hits
  if (S.relationships) {
    if (typeof S.relationships.fa === 'number') {
      S.relationships.fa = Math.max(-100, (S.relationships.fa || 0) - 1);
    }
  }
  
  // Schedule follow-up world event
  if (typeof scheduleWorldEvent === 'function') {
    scheduleWorldEvent('pressCorruptionAfterBreach', 1 + Math.floor(Math.random() * 2), { 
      oppTeam, 
      amount: bribeAmount 
    });
  }
  
  updateHUD?.();
}

// Fallout C: Internal reactions
function handleBribeBreachInternalReactions() {
  const reactions = [
    "A senior player approaches you in the dressing room.",
    "\"Gaffer... you took their money and we still didn't lose?\"",
    "He shakes his head. \"I don't know whether to be impressed or disgusted.\""
  ];
  
  if (S.married) {
    reactions.push("");
    reactions.push("Your wife corners you at home.");
    reactions.push("\"I can't believe you're corrupt AND unreliable.\"");
    reactions.push("She looks genuinely disappointed. \"At least if you're going to be a crook, be a competent one.\"");
    
    if (typeof S._wife_disappointment_count === 'number') {
      S._wife_disappointment_count += 1;
    } else {
      S._wife_disappointment_count = 1;
    }
  }
  
  reactions.forEach(line => log(line));
  
  S.reputation = Math.max(0, (S.reputation || 0) - (2 + Math.floor(Math.random() * 4)));
  
  // Small morale hit if tracked
  if (typeof S.morale === 'number') {
    S.morale = Math.max(-100, (S.morale || 0) - 2);
  }
  
  updateHUD?.();
}

// Fallout D: Repayment demand
async function handleBribeBreachRepaymentDemand(bribeAmount, oppTeam) {
  const interest = Math.max(25000, Math.floor(bribeAmount * (0.20 + Math.random() * 0.25)));
  const repayTotal = bribeAmount + interest;
  
  log("A letter arrives. No return address.");
  log("\"Payment received; service not rendered; balance outstanding.\"");
  log(`Amount due: ${_fmtGBP(repayTotal)}`);
  
  const choice = await _choose4A([
    { key: 'pay', label: `Pay ${_fmtGBP(repayTotal)} now` },
    { key: 'ignore', label: 'Ignore (higher chance of police interview next match)' },
    { key: 'threaten', label: 'Threaten them (risk +)' }
  ], "Repayment demand:");
  
  if (choice === 'pay') {
    let paid = false;
    if ((S.chairman_cash || 0) >= repayTotal) {
      S.chairman_cash -= repayTotal;
      paid = true;
    } else if ((S.club_cash || 0) >= repayTotal) {
      S.club_cash -= repayTotal;
      paid = true;
    }
    
    if (paid) {
      log(`You wire ${_fmtGBP(repayTotal)} to the account specified.`);
      log("The matter is settled. For now.");
      S.compliance_risk = Math.max(0, (S.compliance_risk || 0) - 2);
    } else {
      log("You can't afford it. The demand stands.");
      S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 3);
    }
    updateHUD?.();
  } else if (choice === 'ignore') {
    log("You ignore the demand. They won't forget this.");
    S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 4);
    S.police_risk = Math.min(100, (S.police_risk || 0) + 2);
    
    if (typeof scheduleWorldEvent === 'function') {
      scheduleWorldEvent('mgrBribeBreachEscalation', 1 + Math.floor(Math.random() * 3), { 
        amount: bribeAmount, 
        oppTeam 
      });
    }
    updateHUD?.();
  } else if (choice === 'threaten') {
    log("You send a threatening response. They escalate.");
    S.legal_risk = Math.min(100, (S.legal_risk || 0) + 4);
    S.police_risk = Math.min(100, (S.police_risk || 0) + 3);
    S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 3);
    updateHUD?.();
  }
}

async function presentBriberConfrontsYou(oppTeam){
  if (typeof choose === 'function'){
    const k = await choose([
      {key:'h', label:'Pay hush money (£50k)'},
      {key:'t', label:'Threaten them back'},
      {key:'r', label:'Refuse'}
    ], `${oppTeam} confront you: “We paid you and didn’t get the result.”`);
    if (k==='h'){ const hush=50000; S.club_cash=(S.club_cash|0)-hush; S.legal_risk=Math.min(100,(S.legal_risk|0)+2); S.offbooks=(S.offbooks|0)+1; log(`You pay £${hush.toLocaleString()} under the table.`); }
    if (k==='t'){ S.reputation=Math.max(0,(S.reputation|0)-1); S.legal_risk=Math.min(100,(S.legal_risk|0)+1); log("You push back with counter-threats. Tensions rise."); }
    if (k==='r'){ S.legal_risk=Math.min(100,(S.legal_risk|0)+2); S.reputation=Math.max(0,(S.reputation|0)-1); log("You refuse. Expect blowback later."); }
    updateHUD?.();
    return;
  }
  // Fallback buttons
  const host = document.getElementById('actions'); if (!host) return;
  host.innerHTML = '';
  const wrap = document.createElement('div');
  const t = document.createElement('div'); t.className='sub'; t.textContent = "They confront you: “We paid you and didn’t get the result.”"; wrap.appendChild(t);
  [['Pay hush money (£50k)','h'],['Threaten them','t'],['Refuse','r']].forEach(([label,key])=>{
    const b = document.createElement('button'); b.className='btn'; b.textContent = label;
    b.onclick = ()=> {
      if (key==='h'){ const hush=50000; S.club_cash=(S.club_cash|0)-hush; S.legal_risk=Math.min(100,(S.legal_risk|0)+2); S.offbooks=(S.offbooks|0)+1; log(`You pay £${hush.toLocaleString()} under the table.`); }
      if (key==='t'){ S.reputation=Math.max(0,(S.reputation|0)-1); S.legal_risk=Math.min(100,(S.legal_risk|0)+1); log("You push back with counter-threats. Tensions rise."); }
      if (key==='r'){ S.legal_risk=Math.min(100,(S.legal_risk|0)+2); S.reputation=Math.max(0,(S.reputation|0)-1); log("You refuse. Expect blowback later."); }
      host.innerHTML = ''; updateHUD?.();
    };
    wrap.appendChild(b);
  });
  host.appendChild(wrap);
}

// --- Patch 4A: attendance + revenue + morale (home only) ---
try{
  // Determine if we were home this round from the schedule
  const SOUTH = getClubName();
  let wasHome = true;
  try {
    const rIx =
      (S && S.matchContext && typeof S.matchContext.roundIndex === 'number')
        ? S.matchContext.roundIndex
        : (S.matches_played|0); // not yet incremented: the round being played
    const fx = Array.isArray(S.rounds?.[rIx]?.[0]) ? S.rounds[rIx][0] : [SOUTH, oppName];
    wasHome = (fx[0] === SOUTH);
  } catch(_){ wasHome = true; }

  // Attendance & gate revenue (only if stadium not burned) - DISABLED (using new stadium system)
  // if (wasHome && !S.stadium_burned) {
  //   const fm  = (S.fan_morale|0); // 0..100
  //   const att = Math.round(Math.min(32000, Math.max(0, 32000 * (0.5 + fm/200))));
  //   const rev = att * 40;
  //   S.club_cash = Math.max(0,(S.club_cash|0) + rev);
  //   log(`Attendance: ${att.toLocaleString()} (St Mary's). Gate Revenue: £${rev.toLocaleString()}.`);
  // }

  // (Fan morale delta for the result is applied once, earlier in postMatchPhase.)

  if (typeof updateHUD === 'function') updateHUD();
} catch(e){
  console.error("[4A] post-match finance/morale error:", e);
}
await resolveBriberyAfterMatch(gf, ga, oppName);

