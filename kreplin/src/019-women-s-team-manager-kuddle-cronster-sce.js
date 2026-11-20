// ===== Women's Team Manager & Kuddle Cronster Scenarios =====

// Check if player has erotic syndrome certificate
function hasEroticSyndromeCertificate() {
  if (!S.doctor || !S.doctor.disorder_certificates) return false;
  return S.doctor.disorder_certificates.some(cert => 
    cert.type === 'Erotic Disorder' && !cert.used
  );
}

// Use erotic syndrome certificate
function useEroticSyndromeCertificate() {
  if (!S.doctor || !S.doctor.disorder_certificates) return false;
  const cert = S.doctor.disorder_certificates.find(c => 
    c.type === 'Erotic Disorder' && !c.used
  );
  if (cert) {
    cert.used = true;
    return true;
  }
  return false;
}

// Handle wife taking money after scandal
async function handleWifeScandalReaction() {
  if (!S.married) return; // No wife, no problem
  
  const hasCert = hasEroticSyndromeCertificate();
  
  if (hasCert) {
    log("Your wife confronts you about the allegations.");
    const useCert = await choose([
      { key: 'yes', label: 'Show her your Erotic Disorder certificate' },
      { key: 'no', label: 'Try to explain without it' }
    ], "Do you want to show her your certificate?");
    
    if (useCert === 'yes') {
      useEroticSyndromeCertificate();
      log("You show her the certificate. She reads it carefully.");
      log('"Oh my god," she says, "I had no idea you were suffering from this condition. This is so, so sad."');
      log("She's sympathetic and decides not to take your money.");
      log("Your reputation actually improves slightly due to her sympathy for your condition.");
      S.reputation = Math.min(100, (S.reputation || 50) + 2);
      if (typeof updateHUD === 'function') updateHUD();
      return;
    }
  }
  
  // Wife takes significant amount of money
  const amount = Math.floor((S.chairman_cash || 0) * 0.3); // 30% of personal cash
  if (amount > 0) {
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - amount);
    log(`Your wife is furious. She takes £${amount.toLocaleString()} from your personal funds.`);
    log('"I can\'t believe you would do this," she says. "This is for my emotional distress."');
    S.wife_love = Math.max(0, (S.wife_love || 60) - 20);
    if (typeof updateHUD === 'function') updateHUD();
  } else {
    log("Your wife is furious, but you don't have enough money for her to take.");
    S.wife_love = Math.max(0, (S.wife_love || 60) - 25);
  }
}

// Handle women's team manager demands
async function handleWomensTeamManagerDemand() {
  if (!S.womens_team) return;
  if (S.womens_team.liquidated || !S.womens_team.manager_active) return;
  
  const managerName = (S.contacts && S.contacts.womens_manager && S.contacts.womens_manager.name) 
    ? S.contacts.womens_manager.name.replace(' (Saints Women)', '') 
    : "Sarah 'Girlboss' Mitchell";
  const payAmount = 500000; // Cost to pay her
  const bonusAmount = 250000; // Bonus she demands
  
  log(`There's a knock at the door...`);
  log(`${managerName}, the manager of the women's team, storms into your office.`);
  log(`"Listen here," she says, hands on hips, "this is absolutely UNACCEPTABLE!"`);
  log(`"The women's team deserves EQUAL PAY! We're rebelling against the PATRIARCHY here!"`);
  log(`"I demand that the women's team be paid the same as the men's team!"`);
  log(`"And I deserve a LARGE bonus of £${bonusAmount.toLocaleString()} for my management services!"`);
  log(`"This is about FEMINISM and EQUALITY, not just money!"`);
  
  const options = [
    { key: 'pay', label: `Pay her demands (£${(payAmount + bonusAmount).toLocaleString()})`, variant: 'warn' },
    { key: 'refuse', label: 'Refuse with hostile incredulity', variant: 'bad' },
    { key: 'lecherous', label: 'Make a lecherous comment', variant: 'bad' }
  ];
  
  const choice = await choose(options, `${managerName}'s Demands:`);
  
  if (choice === 'pay') {
    const totalCost = payAmount + bonusAmount;
    if ((S.club_cash || 0) >= totalCost) {
      S.club_cash -= totalCost;
      log(`You reluctantly pay her. She smirks triumphantly.`);
      log(`"That's more like it," she says. "We're making progress against the patriarchy!"`);
      S.womens_team.manager_demands_this_season += 1;
      S.womens_team.last_demand_match = S.matches_played || 0;
      if (typeof updateHUD === 'function') updateHUD();
    } else {
      log(`You don't have enough club funds to pay her. She's not happy.`);
      log(`"This is EXACTLY the kind of financial oppression I'm talking about!"`);
      // Still counts as a demand attempt
      S.womens_team.manager_demands_this_season += 1;
      S.womens_team.last_demand_match = S.matches_played || 0;
    }
  } else if (choice === 'refuse') {
    const responses = [
      "Are you completely insane? Equal pay? The women's team brings in about 3% of the revenue! This isn't a charity!",
      "You want a bonus for what exactly? Managing a team that loses money? Get real!",
      "This is the most ridiculous thing I've ever heard. The men's team actually makes money. Your team costs money.",
      "Equal pay? Sure, when the women's team starts filling stadiums and bringing in sponsorships. Until then, this is just delusional.",
      "A bonus? For what? Managing a team that nobody watches? You're out of your mind."
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    log(`You respond: "${response}"`);
    log(`${managerName} looks absolutely furious.`);
    log(`"You'll regret this," she says, storming out.`);
    
    // She sues and goes to press
    log(`A few days later, you receive a lawsuit from ${managerName}.`);
    log(`She's also gone to the press with allegations.`);
    
    const clubName = getClubName();
    const chairmanName = S.chairman_name || `The ${clubName} Chairman`;
    const managerFirstName = managerName.split(' ')[0] || managerName;
    
    log(`The headlines read: "${chairmanName} Accused of Attempting to 'Force Himself' on Women's Team Manager"`);
    
    if (typeof addPaper === 'function') {
      // Create a detailed news story with girlboss voice
      const newsHeadline = `${chairmanName} Accused of Attempting to "Force Himself" on Women's Team Manager`;
      const newsBody = `In an absolutely SHOCKING and completely UNACCEPTABLE turn of events, ${chairmanName} has been accused of attempting to "force himself" on ${managerName}, the manager of ${clubName}'s women's team. 

According to sources close to the situation, ${managerFirstName} entered ${chairmanName}'s office to discuss EQUAL PAY and FEMINIST PRINCIPLES, only to be met with what can only be described as PATRIARCHAL AGGRESSION of the most DISGUSTING variety.

"Like, this is EXACTLY the kind of toxic masculinity we're fighting against," ${managerFirstName} told reporters in an exclusive interview. "I was literally just trying to have a PROFESSIONAL CONVERSATION about PAY PARITY and SYSTEMIC INEQUALITY, and he just... like... tried to FORCE HIMSELF on me? It's 2025, people. This is NOT OKAY."

Witnesses report that ${chairmanName} made "inappropriate advances" and "lecherous comments" during what should have been a standard workplace discussion about COMPENSATION EQUITY. The incident has sparked OUTRAGE across social media, with hashtags like #BelieveWomen and #MeToo trending in ${clubName}.

"This is a WATERSHED MOMENT," declared one women's rights activist. "We will NOT be silenced. We will NOT be intimidated. We will NOT accept this kind of BEHAVIOR in 2025."

${chairmanName} has yet to comment on the allegations, but legal experts suggest this could result in SIGNIFICANT REPUTATIONAL DAMAGE and POTENTIAL LEGAL CONSEQUENCES. The women's team has expressed "full support" for their manager, calling the incident "absolutely DISGUSTING" and "completely UNACCEPTABLE."

Stay tuned for more updates on this DEVELOPING STORY. 💅✨`;

      // Add to paper trail
      addPaper(newsHeadline, 30);
      
      // Also publish as a news story if the press system exists
      if (S.press && typeof createStory === 'function' && typeof queueStory === 'function') {
        const story = createStory(
          'gossip',
          newsHeadline,
          newsBody,
          { chairmanName, managerName, managerFirstName },
          { reputation: -15, legalRisk: 10 },
          'auto',
          30,
          []
        );
        story.writer = 'Sarah "Girlboss" Mitchell';
        story.id = 'womens_manager_scandal';
        queueStory(story);
      } else if (S.press) {
        // Fallback: add to queue directly
        if (!S.press.queue) S.press.queue = [];
        S.press.queue.push({
          id: 'womens_manager_scandal',
          section: 'gossip',
          headlineTemplate: newsHeadline,
          bodyTemplate: newsBody,
          priority: 100,
          writer: 'Sarah "Girlboss" Mitchell',
          tokens: { chairmanName, managerName, managerFirstName },
          effects: { reputation: -15, legalRisk: 10 },
          severity: 30,
          flags: [],
          publishAt: Date.now()
        });
        S.news_unread = true;
      }
    }
    
    S.reputation = Math.max(0, (S.reputation || 50) - 15);
    S.legal_risk = (S.legal_risk || 0) + 10;
    
    // Wife reaction
    await handleWifeScandalReaction();
    
    S.womens_team.manager_demands_this_season += 1;
    S.womens_team.last_demand_match = S.matches_played || 0;
    if (typeof updateHUD === 'function') updateHUD();
  } else if (choice === 'lecherous') {
    log(`You make a lecherous comment.`);
    log(`${managerName} looks disgusted and storms out immediately.`);
    log(`"I can't believe you just said that," she says. "You're a monster!"`);
    
    // Same consequences as refusing
    log(`She goes straight to the press.`);
    
    const clubName = getClubName();
    const chairmanName = S.chairman_name || `The ${clubName} Chairman`;
    const managerFirstName = managerName.split(' ')[0] || managerName;
    
    log(`The headlines read: "${chairmanName} Accused of Attempting to 'Force Himself' on Women's Team Manager"`);
    
    if (typeof addPaper === 'function') {
      // Create a detailed news story with girlboss voice
      const newsHeadline = `${chairmanName} Accused of Attempting to "Force Himself" on Women's Team Manager`;
      const newsBody = `In an absolutely SHOCKING and completely UNACCEPTABLE turn of events, ${chairmanName} has been accused of attempting to "force himself" on ${managerName}, the manager of ${clubName}'s women's team. 

According to sources close to the situation, ${managerFirstName} entered ${chairmanName}'s office to discuss EQUAL PAY and FEMINIST PRINCIPLES, only to be met with what can only be described as PATRIARCHAL AGGRESSION of the most DISGUSTING variety.

"Like, this is EXACTLY the kind of toxic masculinity we're fighting against," ${managerFirstName} told reporters in an exclusive interview. "I was literally just trying to have a PROFESSIONAL CONVERSATION about PAY PARITY and SYSTEMIC INEQUALITY, and he just... like... tried to FORCE HIMSELF on me? It's 2025, people. This is NOT OKAY."

Witnesses report that ${chairmanName} made "inappropriate advances" and "lecherous comments" during what should have been a standard workplace discussion about COMPENSATION EQUITY. The incident has sparked OUTRAGE across social media, with hashtags like #BelieveWomen and #MeToo trending in ${clubName}.

"This is a WATERSHED MOMENT," declared one women's rights activist. "We will NOT be silenced. We will NOT be intimidated. We will NOT accept this kind of BEHAVIOR in 2025."

${chairmanName} has yet to comment on the allegations, but legal experts suggest this could result in SIGNIFICANT REPUTATIONAL DAMAGE and POTENTIAL LEGAL CONSEQUENCES. The women's team has expressed "full support" for their manager, calling the incident "absolutely DISGUSTING" and "completely UNACCEPTABLE."

Stay tuned for more updates on this DEVELOPING STORY. 💅✨`;

      // Add to paper trail
      addPaper(newsHeadline, 30);
      
      // Also publish as a news story if the press system exists
      if (S.press && typeof createStory === 'function' && typeof queueStory === 'function') {
        const story = createStory(
          'gossip',
          newsHeadline,
          newsBody,
          { chairmanName, managerName, managerFirstName },
          { reputation: -15, legalRisk: 10 },
          'auto',
          30,
          []
        );
        story.writer = 'Sarah "Girlboss" Mitchell';
        story.id = 'womens_manager_scandal';
        queueStory(story);
      } else if (S.press) {
        // Fallback: add to queue directly
        if (!S.press.queue) S.press.queue = [];
        S.press.queue.push({
          id: 'womens_manager_scandal',
          section: 'gossip',
          headlineTemplate: newsHeadline,
          bodyTemplate: newsBody,
          priority: 100,
          writer: 'Sarah "Girlboss" Mitchell',
          tokens: { chairmanName, managerName, managerFirstName },
          effects: { reputation: -15, legalRisk: 10 },
          severity: 30,
          flags: [],
          publishAt: Date.now()
        });
        S.news_unread = true;
      }
    }
    
    S.reputation = Math.max(0, (S.reputation || 50) - 15);
    S.legal_risk = (S.legal_risk || 0) + 10;
    
    // Wife reaction
    await handleWifeScandalReaction();
    
    S.womens_team.manager_demands_this_season += 1;
    S.womens_team.last_demand_match = S.matches_played || 0;
    if (typeof updateHUD === 'function') updateHUD();
  }
}

// Check if women's team manager should visit this match
function shouldTriggerWomensManagerDemand() {
  if (!S.womens_team) return false;
  if (S.womens_team.liquidated || !S.womens_team.manager_active) return false;
  if (S.womens_team.manager_demands_this_season >= 2) return false; // Max 2 per season
  if (S.womens_team.last_demand_match === (S.matches_played || 0)) return false; // Not same match
  
  // Trigger roughly 2 times per season, spread out
  const matchesPerSeason = S.season_matches || 16;
  const targetMatches = [Math.floor(matchesPerSeason * 0.25), Math.floor(matchesPerSeason * 0.75)];
  const currentMatch = S.matches_played || 0;
  
  return targetMatches.includes(currentMatch) && Math.random() < 0.7;
}

// Handle Kuddle Cronster initial letter (Season 2 only)
async function handleCronsterInitialLetter() {
  if (!S.season || S.season !== 2) return;
  if (!S.cronster) S.cronster = { active: false, letter_received: false, security_increased: false, cameras_hallways: false, cameras_secret_zone: false, hallways_matches_since_install: 0, hallways_last_match_tracked: -1, sightings_count: 0, juice_incident: false, juice_incident_pending: false, juice_incident_triggered: false, cd_received: false, booby_trap_set: false, booby_trap_climax_triggered: false, booby_trap_pending_climax: false, defeated: false, starmer_story_queued: false, fibromyalgia_story_shown: false };
  if (S.cronster.letter_received) return;
  if (!S.womens_team || S.womens_team.liquidated) return; // Can't happen if team is liquidated
  
  const managerName = (S.contacts && S.contacts.womens_manager && S.contacts.womens_manager.name) 
    ? S.contacts.womens_manager.name.replace(' (Saints Women)', '') 
    : "Sarah 'Girlboss' Mitchell";
  
  log(`There's a knock at the door...`);
  log(`${managerName} enters your office, looking worried.`);
  log(`"We have a serious problem," she says, holding out a letter.`);
  log(`"This arrived in the post today. You need to read this."`);
  
  await choose([{ key: 'read', label: 'Read the letter' }], 'A disturbing letter:');
  
  // Show letter in popup modal
  await showCronsterLetterModal();
  
  log(`${managerName} looks at you with concern.`);
  log(`"This is serious," she says. "The Cronster has already 'squeezed the juice' out of several women in Eastleigh."`);
  log(`"He's taken photographs of several of our team members in states of undress."`);
  log(`"This threat needs to be taken seriously."`);
  
  S.cronster.letter_received = true;
  S.cronster.active = true;
  
  let choiceMade = false;
  while (!choiceMade) {
    const options = [
      { key: 'photos', label: 'Ask to see the photographs', variant: 'bad' },
      { key: 'stand', label: 'Bravely take a stand' }
    ];
    
    const choice = await choose(options, 'How do you respond?');
    
    if (choice === 'photos') {
      log(`You ask to see the photographs.`);
      // Flash PERVERT on screen
      const pervertDiv = document.createElement('div');
      pervertDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; font-size: 120px; font-weight: bold; color: #ff0000; text-shadow: 0 0 20px #ff0000; animation: pulse 0.5s;';
      pervertDiv.textContent = 'PERVERT';
      document.body.appendChild(pervertDiv);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      pervertDiv.remove();
      
      log(`You realize that was probably not the right thing to ask.`);
      log(`You're taken back to the choices.`);
      
      // Loop back to choices (don't set choiceMade = true)
    } else if (choice === 'stand') {
      log(`You bravely take a stand.`);
      log(`${managerName} looks relieved.`);
      log(`"Thank you," she says. "I knew you would do the right thing."`);
      
      // First ask about hallways
      const installHallways = await choose([
        { key: 'yes', label: 'Yes, install surveillance cameras in the hallways' },
        { key: 'no', label: 'No' }
      ], 'Do you want to install surveillance cameras in the hallways?');
      
      if (installHallways === 'yes') {
        S.cronster.cameras_hallways = true;
        S.cronster.hallways_matches_since_install = 0; // Reset counter when installing
        S.cronster.hallways_last_match_tracked = S.matches_played || 0; // Track current match
        log(`You install surveillance cameras in the hallways.`);
        
        // Then ask about women's toilets
        const installToilets = await choose([
          { key: 'yes', label: 'Yes, install surveillance cameras in the women\'s toilets too', variant: 'warn' },
          { key: 'no', label: 'No, just the hallways' }
        ], 'Do you want to install surveillance cameras in the women\'s toilets too?');
        
        if (installToilets === 'yes') {
          S.cronster.cameras_secret_zone = true;
          log(`You install surveillance cameras in the women's toilets.`);
          log(`This might not be entirely appropriate, but you do it anyway.`);
        }
      }
      choiceMade = true;
    }
  }
}

// Handle cronster events during matches
async function processCronsterEvents() {
  if (!S.cronster || !S.cronster.active || S.cronster.defeated || !S.womens_team || S.womens_team.liquidated) return;
  
  // Increment hallway surveillance match counter if cameras are installed (once per match)
  if (S.cronster.cameras_hallways && !S.cronster.defeated) {
    const currentMatch = S.matches_played || 0;
    if (typeof S.cronster.hallways_matches_since_install !== 'number') {
      S.cronster.hallways_matches_since_install = 0;
    }
    if (typeof S.cronster.hallways_last_match_tracked !== 'number') {
      S.cronster.hallways_last_match_tracked = -1;
    }
    // Only increment if this is a new match (matches_played has increased since last check)
    if (currentMatch > S.cronster.hallways_last_match_tracked) {
      S.cronster.hallways_matches_since_install += 1;
      S.cronster.hallways_last_match_tracked = currentMatch;
    }
  }
  
  // Trigger final confrontation if conditions are met (doesn't require booby trap)
  // Only set pending if it's not already pending and not already triggered
  // Must be in latter half of season 2+ AND after letter received
  if (!S.cronster.booby_trap_climax_triggered && !S.cronster.booby_trap_pending_climax && !S.cronster.defeated && S.season >= 2) {
    // Check if we're in the latter half of the season
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    const isLatterHalf = matchesPlayed >= Math.floor(seasonMatches / 2);
    const isPast75Percent = matchesPlayed >= Math.floor(seasonMatches * 0.75);
    
    // Check if enough cronster events have occurred (at least 3 sightings, juice incident, or CD received)
    const hasEnoughEvents = (S.cronster.sightings_count >= 3) || 
                             (S.cronster.juice_incident) || 
                             (S.cronster.cd_received);
    
    // Make it inevitable: if we're past 75% of season and letter received, force it
    // OR if we're in latter half with enough events
    const shouldSetPending = S.cronster.letter_received && 
                            ((isPast75Percent) || (isLatterHalf && hasEnoughEvents));
    
    console.log(`DEBUG CRONSTER: season=${S.season}, matchesPlayed=${matchesPlayed}, seasonMatches=${seasonMatches}, isLatterHalf=${isLatterHalf}, isPast75Percent=${isPast75Percent}, letter_received=${S.cronster.letter_received}, sightings_count=${S.cronster.sightings_count}, juice_incident=${S.cronster.juice_incident}, cd_received=${S.cronster.cd_received}, hasEnoughEvents=${hasEnoughEvents}, shouldSetPending=${shouldSetPending}`);
    
    if (shouldSetPending) {
      // Mark that we'll trigger the climax when door is opened in prematch
      S.cronster.booby_trap_pending_climax = true;
      console.log(`DEBUG CRONSTER: booby_trap_pending_climax set to true - will trigger on next door knock`);
    }
  }
  
  // Random cronster sightings
  if (Math.random() < 0.3 && S.cronster.sightings_count < 5) {
    S.cronster.sightings_count += 1;
    log(`Security reports: "A cronster-type individual was seen grunting and talking about juice near the facilities."`);
  }
  
  // Juice incident (one time) - will trigger when door is opened
  if (!S.cronster.juice_incident && Math.random() < 0.15) {
    S.cronster.juice_incident = true;
    S.cronster.juice_incident_pending = true; // Flag to trigger scene when door opens
  }
  
  // CD received (one time)
  if (!S.cronster.cd_received && Math.random() < 0.2) {
    S.cronster.cd_received = true;
    S.cronster.cd_pending = true; // Flag to handle interactively
  }
  
  // Queue Cronster fibromyalgia news story (before Starmer story)
  if (S.cronster.letter_received && !S.cronster.fibromyalgia_story_shown && !S.cronster.booby_trap_pending_climax && !S.cronster.booby_trap_climax_triggered && !S.cronster.defeated) {
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    const hasAnyCronsterEvent = (S.cronster.sightings_count > 0) || 
                                (S.cronster.juice_incident) || 
                                (S.cronster.cd_received);
    // Show after initial events start happening
    if (hasAnyCronsterEvent && matchesPlayed >= 5) {
      if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function' && S.press) {
        const chairmanName = S.full_name || 'the Southampton chairman';
        const storyBody = `By Political Correspondent | Westminster

The Kuddle Cronster, the figure at the center of an ongoing harassment investigation targeting Southampton FC's women's team, has made a public announcement regarding his health and identity.

In a statement released through his representatives this morning, the Cronster revealed that he suffers from fibromyalgia and identifies as neurodivergent.

"I want the public to understand that I am not a monster," the statement reads. "I am a person with invisible disabilities who has struggled with chronic pain and neurological differences my entire life. The oppression that neurodiverse people with invisible disabilities face is real, and I am a victim of systemic prejudice."

The announcement has sparked immediate controversy, particularly after Labour leader Sir Keir Starmer weighed in with what critics have described as a "baffling and tone-deaf" response.

Speaking at a press briefing this afternoon, Starmer said:

"The Cronster is now a much more sympathetic and understandable character due to his PTSD from the oppression that neurodiverse people with invisible disabilities have suffered. We must approach this situation with compassion and understanding."

When pressed by reporters about the ongoing harassment allegations and the safety of Southampton's women's team, Starmer doubled down.

"I think we need to be more understanding," he said. "These are complex issues, and we can't simply dismiss someone's lived experience because of allegations."

The comments drew immediate condemnation from women's rights organizations and disability advocacy groups, who accused Starmer of conflating legitimate disability concerns with predatory behavior.

"This is an insult to people who actually suffer from fibromyalgia and neurodivergence," said one advocacy group spokesperson. "The Cronster's behavior is criminal harassment. His claimed diagnoses do not excuse or explain his actions."

Meanwhile, a bizarre development has emerged: a sect of female fans calling themselves "Cronny's Juice Bunnies" has begun appearing at public events related to the case.

The group, which reportedly numbers in the dozens, has described themselves as "supporters of the Cronster who actively seek to have the juice squeezed out of them."

Their public statements have been met with widespread disgust and disbelief.

"We understand him," one member told reporters outside Westminster. "He's misunderstood. We volunteer ourselves for his affections."

Police have warned the group to stay away from Southampton FC facilities and have increased security measures.

The Cronster remains at large. Southampton chairman ${chairmanName} has declined to comment on the latest developments.

The investigation continues.`;
        
        const cronsterFibroStory = {
          section: 'football',
          headline: 'Kuddle Cronster Announces Fibromyalgia Diagnosis; Starmer Calls Him "Sympathetic Character"',
          writer: getNextWriter(),
          body: storyBody,
          effects: {}
        };
        
        S.cronster.fibromyalgia_story_shown = true;
        log(`📰 <strong>Breaking news: The Kuddle Cronster has made a public announcement about his health.</strong>`);
        await showNewsArticle(cronsterFibroStory);
      }
    }
  }

  // Queue Starmer news story after letter received but before final showdown
  if (S.cronster.letter_received && !S.cronster.starmer_story_queued && !S.cronster.booby_trap_pending_climax && !S.cronster.booby_trap_climax_triggered && !S.cronster.defeated) {
    // Queue the story - it should appear after letter but before showdown
    // Check if we're not yet at the final showdown trigger point
    const matchesPlayed = S.matches_played || 0;
    const seasonMatches = S.season_matches || 16;
    const isLatterHalf = matchesPlayed >= Math.floor(seasonMatches / 2);
    const isPast75Percent = matchesPlayed >= Math.floor(seasonMatches * 0.75);
    const hasEnoughEvents = (S.cronster.sightings_count >= 3) || 
                           (S.cronster.juice_incident) || 
                           (S.cronster.cd_received);
    const showdownAboutToTrigger = (isPast75Percent) || (isLatterHalf && hasEnoughEvents);
    
    // Queue the story if we're in the latter half but before the showdown actually triggers
    // OR if we have at least one cronster event after the letter (fallback)
    // This ensures it appears in the middle of the saga, after some events have occurred
    const hasAnyCronsterEvent = (S.cronster.sightings_count > 0) || 
                                (S.cronster.juice_incident) || 
                                (S.cronster.cd_received);
    if ((isLatterHalf && !showdownAboutToTrigger) || (hasAnyCronsterEvent && !showdownAboutToTrigger)) {
      if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function' && S.press) {
        const storyBody = `By Political Correspondent | Westminster

Sir Keir Starmer sparked widespread condemnation last night after a press conference intended to address the threat posed by the figure known as the Kuddle Cronster descended into a rambling announcement about fast-food investment, punctuated by remarks campaigners described as "dismissive, incoherent, and misogynistic."

Opening his statement, the Labour leader acknowledged that the Cronster — whose sustained harassment of Southampton's women's team has become a national scandal — represented a serious concern.

"The Kuddle Cronster does present a serious threat," Starmer said. "No one is disputing that."

However, he immediately qualified the remark by adding:

"But we also have better things to be spending our money on."

Starmer then pivoted to what aides later described as a "planned economic announcement", revealing government support for what he called "a new type of McDonald's, with many new types of burgers."

"This is about growth," he said. "Choice. Innovation. Burgers people actually want."

When pressed by reporters on safeguarding and enforcement, Starmer appeared to lose his train of thought.

"Look," he said, "boys will be boys."

Gasps were audible in the room.

Attempting to clarify, Starmer continued:

"If this was affecting the men's team, of course we'd look into it."

He then appeared to suggest the issue should be handled outside mainstream policing.

"Women have made it clear they have no interest in men," he said. "So I will leave it to the woman police to clear up the problem."

After a brief pause, Starmer added:

"Oh. There's no woman police yet? Never mind."

He concluded the press conference by assuring the public that the situation would resolve itself.

"It will all be alright in the end," he said. "Look — let's get back to thinking about this new McDonald's."

The room erupted in shouted questions as Starmer left without taking further press.

Reaction was swift and furious. Women's football organisations accused Starmer of trivialising a safeguarding crisis, while senior figures within his own party described the remarks as "catastrophically out of touch."

One Labour backbencher said:

"He managed to offend women, trivialise harassment, and announce burgers in the same breath. It's astonishing."

Downing Street declined to comment on whether the proposed McDonald's investment existed in any formal capacity.

By late evening, multiple advocacy groups had called for a formal apology, while opposition figures questioned whether Starmer understood the seriousness of the Cronster case at all.

As one headline this morning put it: "Safeguarding Crisis Meets Fast-Food Pivot."

Whether Starmer can recover from a press conference that attempted to condemn a threat — only to abandon it for burgers — remains to be seen.`;
        
        const starmerStory = {
          section: 'politics',
          headline: 'Starmer Condemns Kuddle Cronster — Then Redirects Funding to "New McDonald\'s With More Burgers"',
          writer: getNextWriter(),
          body: storyBody,
          effects: {}
        };
        
        S.cronster.starmer_story_queued = true;
        log(`📰 <strong>A breaking news story has been published about the Kuddle Cronster situation.</strong>`);
        await showNewsArticle(starmerStory);
      }
    }
  }
}

// Handle CD arrival event interactively
async function handleCronsterCDEvent() {
  if (!S.cronster || !S.cronster.cd_pending) return;
  
  S.cronster.cd_pending = false;
  log(`A CD arrives in the post.`);
  log(`It's labeled: "Juice!" - from the hit musical 'Juice!' by musical maestro Larry Lizards, about the life and tragic backstory of the Kuddle Cronster. The CD contains the song 'Juice!' which is being heralded as 'the new 'Defying Gravity''.`);
  
  const choice = await choose([
    {key: 'listen', label: 'Listen to the CD'},
    {key: 'ignore', label: 'Ignore it'}
  ], 'Would you be interested in listening?');
  
  if (choice === 'listen') {
    log(`You put the CD into your computer and press play...`);
    playCronsterAnthem(); // Play in background, don't await
    log(`sounds fucking shit to you, but what do you know`);
  } else {
    log(`You set the CD aside. Maybe later.`);
  }
}

// Play the Cronster anthem audio (plays in background, doesn't block game)
function playCronsterAnthem() {
  // Stop general music when juice music starts
  if (typeof window._stopGeneralMusic === 'function') {
    window._stopGeneralMusic();
  }
  
  // Stop any existing juice song if playing
  if (window.juiceSongAudio) {
    window.juiceSongAudio.pause();
    window.juiceSongAudio = null;
  }
  
  // Remove any existing skip button
  const existingSkip = document.getElementById('juice-song-skip');
  if (existingSkip) existingSkip.remove();
  
  // Use Dropbox direct link format for audio playback
  const audioUrl = 'https://www.dropbox.com/scl/fi/debv5803t72p9qpfo92fv/man-come-on-love-give-ol-cronny-a-cud-cover.mp3?rlkey=2rn4d60rz0ssg6fimfhuuwveu&st=i0nfcyyr&dl=1';
  const audio = new Audio(audioUrl);
  
  // Store globally so it continues playing in background
  window.juiceSongAudio = audio;
  
  // Set audio properties
  audio.preload = 'auto';
  audio.volume = 0.8; // Set reasonable volume
  
  let skipButtonShown = false;
  let skipTimeout = null;
  
  // Show skip button after 20 seconds
  const showSkipButton = () => {
    if (skipButtonShown) return;
    skipButtonShown = true;
    
    const skipDiv = document.createElement('div');
    skipDiv.id = 'juice-song-skip';
    skipDiv.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10001; padding: 15px 30px; background: rgba(99, 102, 241, 0.9); border: 2px solid #6366f1; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
    skipDiv.textContent = 'Stop Song';
    skipDiv.onclick = () => {
      audio.pause();
      audio.currentTime = 0;
      window.juiceSongAudio = null;
      skipDiv.remove();
      if (skipTimeout) clearTimeout(skipTimeout);
      // Resume general music when juice music is manually stopped
      if (typeof window._startGeneralMusic === 'function') {
        setTimeout(() => {
          window._startGeneralMusic();
        }, 500);
      }
    };
    document.body.appendChild(skipDiv);
    
    // Auto-remove skip button when song ends
    skipTimeout = setTimeout(() => {
      skipDiv.remove();
    }, 300000); // 5 minutes max
  };
  
  // Handle successful playback completion
  audio.onended = () => {
    if (skipTimeout) clearTimeout(skipTimeout);
    const skipDiv = document.getElementById('juice-song-skip');
    if (skipDiv) skipDiv.remove();
    window.juiceSongAudio = null;
    // Resume general music after juice music ends
    if (typeof window._startGeneralMusic === 'function') {
      setTimeout(() => {
        window._startGeneralMusic();
      }, 500);
    }
  };
  
  // Handle loading errors
  audio.onerror = (e) => {
    console.error('Audio playback error:', e);
    log(`[The CD seems to be corrupted or unplayable]`);
    if (skipTimeout) clearTimeout(skipTimeout);
    const skipDiv = document.getElementById('juice-song-skip');
    if (skipDiv) skipDiv.remove();
    window.juiceSongAudio = null;
  };
  
  // Attempt to play the audio
  const playPromise = audio.play();
  
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        // Audio started playing successfully
        log(`[Playing: "Juice!" from the hit musical 'Juice!' by Larry Lizards...]`);
        log(`[The song will continue playing in the background while you play the game]`);
        // Show skip button after 20 seconds
        setTimeout(showSkipButton, 20000);
      })
      .catch(err => {
        console.error('Audio play error:', err);
        log(`[Could not play the CD: ${err.message}]`);
        if (skipTimeout) clearTimeout(skipTimeout);
        window.juiceSongAudio = null;
      });
  }
}

// Helper function to wait for log queue to finish processing
async function waitForLogQueue() {
  // Wait for the log queue to be empty and processing to finish
  while (logQueue.length > 0 || isProcessingQueue) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  // Give a bit more time for animations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Create fight minigame modal/pop-out
function createFightModal() {
  // Remove existing modal if present
  const existing = document.getElementById('fight-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'fight-modal';
  modal.className = 'fight-modal';
  
  modal.innerHTML = `
    <div class="fight-modal-overlay"></div>
    <div class="fight-modal-content">
      <div class="fight-header">
        <h2>⚔️ FIGHT!</h2>
        <div class="fight-health-bars">
          <div class="health-bar-container">
            <div class="health-label">YOU</div>
            <div class="health-bar">
              <div class="health-fill player-health" style="width: 100%"></div>
            </div>
            <div class="health-text player-health-text">100%</div>
          </div>
          <div class="health-bar-container">
            <div class="health-label">CRONSTER</div>
            <div class="health-bar">
              <div class="health-fill cronster-health" style="width: 100%"></div>
            </div>
            <div class="health-text cronster-health-text">100%</div>
          </div>
        </div>
      </div>
      <div class="fight-arena">
        <div class="fighter player-fighter">
          <div class="fighter-sprite">👤</div>
          <div class="fighter-name">YOU</div>
        </div>
        <div class="vs-indicator">VS</div>
        <div class="fighter cronster-fighter">
          <div class="cronster-sprite">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <!-- Cloak body -->
              <path d="M 20 30 Q 20 20, 30 20 Q 50 15, 70 20 Q 80 20, 80 30 L 80 90 L 20 90 Z" fill="#1a1a2e" stroke="#2d2d44" stroke-width="1.5"/>
              <!-- Cloak hood covering head -->
              <path d="M 30 25 Q 50 18, 70 25 Q 75 28, 75 35 Q 75 42, 70 45 Q 50 50, 30 45 Q 25 42, 25 35 Q 25 28, 30 25" fill="#0f0f1a" stroke="#1a1a2e" stroke-width="1"/>
              <!-- Head (skinny, visible under hood) -->
              <ellipse cx="50" cy="42" rx="11" ry="13" fill="#3d3d3d"/>
              <!-- Greasy dark hair strands coming down over forehead -->
              <path d="M 38 38 L 40 32 L 42 35 L 44 31 L 46 34" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>
              <path d="M 42 40 L 44 34 L 46 37 L 48 33 L 50 36" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>
              <path d="M 46 40 L 48 34 L 50 37 L 52 33 L 54 36" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>
              <path d="M 50 40 L 52 34 L 54 37 L 56 33 L 58 36" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>
              <path d="M 54 40 L 56 34 L 58 37 L 60 33 L 62 38" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.9"/>
              <!-- Dark eyes (visible under hair) -->
              <circle cx="46" cy="46" r="2.5" fill="#000000"/>
              <circle cx="54" cy="46" r="2.5" fill="#000000"/>
              <!-- Skinny body (under cloak) -->
              <rect x="46" y="58" width="8" height="28" fill="#2d2d2d" rx="1"/>
            </svg>
          </div>
          <div class="fighter-name">CRONSTER</div>
        </div>
      </div>
      <div class="fight-log" id="fight-log"></div>
      <div class="fight-actions" id="fight-actions"></div>
      <div class="fight-prompt" id="fight-prompt"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  return modal;
}

// Close fight modal
function closeFightModal() {
  const modal = document.getElementById('fight-modal');
  if (modal) {
    modal.classList.add('fight-modal-closing');
    setTimeout(() => modal.remove(), 300);
  }
}

// Log message to fight modal
function fightLog(msg) {
  const fightLogEl = document.getElementById('fight-log');
  if (!fightLogEl) return;
  
  const entry = document.createElement('div');
  entry.className = 'fight-log-entry';
  entry.textContent = msg;
  fightLogEl.appendChild(entry);
  fightLogEl.scrollTop = fightLogEl.scrollHeight;
  
  // Also log to main feed
  log(msg);
}

// Update health bars in fight modal
function updateFightHealth(playerHealth, cronsterHealth) {
  const playerBar = document.querySelector('.player-health');
  const cronsterBar = document.querySelector('.cronster-health');
  const playerText = document.querySelector('.player-health-text');
  const cronsterText = document.querySelector('.cronster-health-text');
  
  if (playerBar) {
    playerBar.style.width = Math.max(0, Math.min(100, playerHealth)) + '%';
    playerBar.style.backgroundColor = playerHealth > 50 ? '#00d4aa' : playerHealth > 25 ? '#ffa726' : '#ff4757';
  }
  if (playerText) playerText.textContent = Math.max(0, Math.min(100, Math.round(playerHealth))) + '%';
  
  if (cronsterBar) {
    cronsterBar.style.width = Math.max(0, Math.min(100, cronsterHealth)) + '%';
    cronsterBar.style.backgroundColor = cronsterHealth > 50 ? '#ff4757' : cronsterHealth > 25 ? '#ffa726' : '#00d4aa';
  }
  if (cronsterText) cronsterText.textContent = Math.max(0, Math.min(100, Math.round(cronsterHealth))) + '%';
}

// Animate fighter attack
function animateFighterAttack(fighterType) {
  const fighter = document.querySelector(`.${fighterType}-fighter`);
  if (fighter) {
    fighter.classList.add('attacking');
    setTimeout(() => fighter.classList.remove('attacking'), 500);
  }
}

// Choose function for fight modal
async function fightChoose(opts, prompt) {
  return new Promise((resolve) => {
    const actionsEl = document.getElementById('fight-actions');
    const promptEl = document.getElementById('fight-prompt');
    
    if (!actionsEl || !promptEl) {
      // Fallback to regular choose
      choose(opts, prompt).then(resolve);
      return;
    }
    
    // Clear previous buttons
    actionsEl.innerHTML = '';
    promptEl.textContent = prompt || 'Choose:';
    
    // Create buttons
    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.className = 'fight-action-btn';
      if (opt.variant === 'bad') btn.classList.add('bad');
      if (opt.variant === 'warn') btn.classList.add('warn');
      if (opt.variant === 'good') btn.classList.add('good');
      
      btn.onclick = () => {
        actionsEl.innerHTML = '';
        promptEl.textContent = '';
        resolve(opt.key);
      };
      
      actionsEl.appendChild(btn);
    });
  });
}

// Fighting minigame for cronster
async function cronsterFightingMinigame() {
  // Track if secretary was in the scene
  const secretaryInScene = S.secretary_hired && S.secretary_name;
  
  // If secretary was in the scene, show her being saved
  if (secretaryInScene) {
    log(`⚡ TIME SLOWS.`);
    log(``);
    log(`You see it happening in slow motion.`);
    log(`The Cronster's hands closing around ${S.secretary_name || 'your secretary'}'s throat.`);
    log(`Her eyes wide with terror.`);
    log(``);
    log(`💥 YOU EXPLODE INTO ACTION.`);
    log(`Muscles screaming, you launch yourself forward.`);
    log(`Your body collides with the Cronster with bone-crunching force.`);
    log(`You wrench him away, throwing him across the room.`);
    log(``);
    log(`${S.secretary_name || 'Your secretary'} collapses to the floor, gasping for breath.`);
    log(`"You... you saved me..." she whispers, tears streaming down her face.`);
    log(``);
    log(`🔥 THE CRONSTER RISES.`);
    log(`He turns to face you, his eyes wild with pure, unadulterated rage.`);
    log(`Every muscle in his body tenses. The air crackles with violence.`);
    log(`"YOU'VE RUINED MY LOVELY JUBBLY!" he snarls, spittle flying.`);
    log(`"NOW I'M GONNA SQUEEZE THE JUICE OUT OF YOU!"`);
  } else {
    log(`🔥 THE CRONSTER SPOTS YOU.`);
    log(`His eyes lock onto yours. A predator's gaze.`);
    log(`"LOVELY JUBBLY!" he grunts, his voice a guttural roar.`);
    log(`"I LIKES TO SQUEEZE 'EM! AND YOU'RE NEXT!"`);
    log(``);
    if (S.cronster.booby_trap_set) {
      log(`He approaches the doll, but you're waiting.`);
      log(`Your trap is set. Your moment has come.`);
    } else {
      log(`He charges. No hesitation. Pure violence.`);
    }
  }
  
  // Wait for all log messages to finish displaying
  await waitForLogQueue();
  
  // Create and show fight modal
  const modal = createFightModal();
  fightLog('⚔️ FIGHT MINIGAME: Press the buttons as they appear!');
  
  let playerHealth = 100;
  let cronsterHealth = 100;
  let round = 0;
  const maxRounds = 10;
  
  // Initial health display
  updateFightHealth(playerHealth, cronsterHealth);
  
  while (playerHealth > 0 && cronsterHealth > 0 && round < maxRounds) {
    round++;
    fightLog(`\nRound ${round}:`);
    fightLog(`Your health: ${playerHealth}% | Cronster health: ${cronsterHealth}%`);
    
    // Random button sequence
    const buttons = ['PUNCH', 'KICK', 'DODGE', 'BLOCK'];
    const requiredButton = buttons[Math.floor(Math.random() * buttons.length)];
    
    const buttonChoice = await fightChoose([
      {key: 'punch', label: 'PUNCH', variant: 'bad'},
      {key: 'kick', label: 'KICK', variant: 'bad'},
      {key: 'dodge', label: 'DODGE', variant: ''},
      {key: 'block', label: 'BLOCK', variant: ''}
    ], `Quick! Press ${requiredButton}!`);
    
    const buttonMap = {punch: 'PUNCH', kick: 'KICK', dodge: 'DODGE', block: 'BLOCK'};
    const pressedButton = buttonMap[buttonChoice];
    
    if (pressedButton === requiredButton) {
      // Hit!
      animateFighterAttack('player');
      const damage = 15 + Math.random() * 20;
      cronsterHealth -= damage;
      fightLog(`✅ You hit! ${Math.round(damage)} damage!`);
      updateFightHealth(playerHealth, cronsterHealth);
    } else {
      // Miss or get hit
      if (Math.random() < 0.6) {
        animateFighterAttack('cronster');
        const damage = 10 + Math.random() * 15;
        playerHealth -= damage;
        fightLog(`❌ You missed! Cronster hits you for ${Math.round(damage)} damage!`);
        updateFightHealth(playerHealth, cronsterHealth);
      } else {
        fightLog(`⚠️ You dodged, but no damage dealt.`);
      }
    }
    
    // Cronster's turn (automatic)
    if (cronsterHealth > 0 && Math.random() < 0.7) {
      await new Promise(resolve => setTimeout(resolve, 300));
      animateFighterAttack('cronster');
      const cronsterDamage = 8 + Math.random() * 12;
      playerHealth -= cronsterDamage;
      fightLog(`👊 Cronster hits you for ${Math.round(cronsterDamage)} damage!`);
      updateFightHealth(playerHealth, cronsterHealth);
    }
    
    // Small delay between rounds for readability
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  fightLog('');
  if (playerHealth <= 0) {
    fightLog('💀 You are knocked out!');
    await new Promise(resolve => setTimeout(resolve, 1000));
    closeFightModal();
    
    log('💀 You are knocked out!');
    log(`The Cronster goes and 'squeezes the juice' out of the entire women's team.`);
    const penalty = Math.floor((S.club_cash || 0) * 0.75);
    S.club_cash = Math.max(0, (S.club_cash || 0) - penalty);
    log(`You lose 75% of the club's money in the form of a cheque paid to a women's charity.`);
    log(`(Lost £${penalty.toLocaleString()})`);
    
    // If secretary was in scene, trigger bill scenario
    if (secretaryInScene) {
      await handleSecretaryCronsterDefeatBill();
    }
    
    S.cronster.defeated = true;
    S.cronster.active = false;
    // Track match when defeated (if not already set)
    if (!S.cronster.defeated_at_match) {
      S.cronster.defeated_at_match = S.matches_played || 0;
    }
    if (typeof updateHUD === 'function') updateHUD();
    return false;
  } else if (cronsterHealth <= 0) {
    fightLog('💀 The Cronster is knocked out!');
  } else {
    fightLog('⏱️ Time runs out!');
  }
  
  // Determine winner
  if (playerHealth > cronsterHealth) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    closeFightModal();
    // Player wins - now the stomp sequence
    log('');
    log('💥 You deliver a devastating blow!');
    log('The Cronster collapses to the ground, unmoving.');
    log('You unmask him...');
    log('You\'re shocked to find... it is Jenko!');
    log('');
    
    // Blood splatter effect function
    function createBloodSplatter() {
      // Create or get splatter container
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
      }, 300);
      
      // Create multiple blood splatters
      const splatterCount = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < splatterCount; i++) {
        const splatter = document.createElement('div');
        const size = Math.random();
        if (size > 0.7) {
          splatter.className = 'blood-splatter blood-splatter-large';
        } else if (size < 0.3) {
          splatter.className = 'blood-splatter blood-splatter-small';
        } else {
          splatter.className = 'blood-splatter';
        }
        
        // Random position (center area with spread)
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 200;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        splatter.style.left = x + 'px';
        splatter.style.top = y + 'px';
        splatter.style.setProperty('--splatter-x', (Math.cos(angle) * (30 + Math.random() * 50)) + 'px');
        splatter.style.setProperty('--splatter-y', (Math.sin(angle) * (30 + Math.random() * 50)) + 'px');
        splatter.style.setProperty('--splatter-rot', (Math.random() * 360) + 'deg');
        
        container.appendChild(splatter);
        
        // Remove after animation
        setTimeout(() => {
          if (splatter.parentNode) {
            splatter.remove();
          }
        }, 600);
      }
    }
    
    // Stomp on his head sequence
    let stompCount = 0;
    const requiredStomps = 3 + Math.floor(Math.random() * 2); // 3 or 4 stomps
    
    const stompDescriptions = [
      `You bring your boot down hard on his head. There's a sickening CRUNCH.`,
      `You stomp again. His skull cracks open like an egg. Blood and grey matter splatter across the floor.`,
      `Another stomp. His brains have started coming out! Keep going!`,
      `You keep stomping. His head is now a pulpy mess. Brain matter, bone fragments, and blood paint the room in a crimson Jackson Pollock.`,
      `One final, brutal stomp. His head explodes like a watermelon. Grey matter, blood, and fragments of bone scatter in every direction. The room is silent except for the wet, squelching sound.`
    ];
    
    while (stompCount < requiredStomps) {
      const choice = await choose([
        { key: 'stomp', label: 'STOMP ON HIS HEAD', variant: 'bad' }
      ], stompCount === 0 ? 'The Cronster is down. What do you do?' : stompDescriptions[Math.min(stompCount, stompDescriptions.length - 1)]);
      
      if (choice === 'stomp') {
        stompCount++;
        // Trigger blood splatter effect
        createBloodSplatter();
        
        // Play crunching/splatting sound effect
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('crunchSplat', 0.9);
        }
        
        log('');
        log(stompDescriptions[Math.min(stompCount - 1, stompDescriptions.length - 1)]);
        
        if (stompCount < requiredStomps) {
          if (stompCount === 1) {
            log(`His eyes roll back. Blood trickles from his ears.`);
          } else if (stompCount === 2) {
            log(`His face is unrecognizable. The floor is slick with blood.`);
          } else if (stompCount === 3) {
            log(`The room smells of copper and death. You're not done yet.`);
          }
        }
      }
    }
    
    log('');
    log('💀 The Cronster is dead. There\'s no coming back from that.');
    log('The room is a crime scene. Blood everywhere.');
    log('');
    
    // Check for Kreplin gem in Cronster's brain matter
    if (!S.kreplin_gem_cronster_found) {
      await checkCronsterKreplinGemDiscovery();
    }
    
    const finalChoice = await choose([
      { key: 'police', label: 'Call the police' },
      { key: 'cleanup', label: 'Arrange a cleanup', variant: 'warn' }
    ], 'What do you do now?');
    
    if (finalChoice === 'police') {
      log(`You call the police.`);
      log(`They arrive and take one look at the scene.`);
      log(`"Jesus Christ," one officer mutters. "What happened here?"`);
      log(`You explain that the Cronster was attacking your secretary.`);
      log(`They take your statement. The women's team is safe.`);
      log(`Jenko's body is removed. The case is closed.`);
    } else {
      log(`You make a call.`);
      log(`"I need a cleanup crew. Now."`);
      log(`Within an hour, the room is spotless. No trace of what happened.`);
      log(`The women's team is safe. Jenko is gone.`);
      log(`Your reputation takes a hit, but nobody knows what really happened.`);
      S.reputation = Math.max(0, (S.reputation || 50) - 10);
    }
    
    S.cronster.defeated = true;
    S.cronster.active = false;
    // Track match when defeated (if not already set)
    if (!S.cronster.defeated_at_match) {
      S.cronster.defeated_at_match = S.matches_played || 0;
    }
    if (typeof updateHUD === 'function') updateHUD();
    
    // If secretary was in scene and player won, trigger affair prompt
    if (secretaryInScene) {
      await handleSecretaryCronsterVictoryAffair();
    }
    
    return true;
  } else {
    // Player loses
    fightLog(`You've been defeated!`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    closeFightModal();
    
    log(`You've been defeated!`);
    log(`The Cronster goes and 'squeezes the juice' out of the entire women's team.`);
    const penalty = Math.floor((S.club_cash || 0) * 0.75);
    S.club_cash = Math.max(0, (S.club_cash || 0) - penalty);
    log(`You lose 75% of the club's money in the form of a cheque paid to a women's charity.`);
    log(`(Lost £${penalty.toLocaleString()})`);
    
    // If secretary was in scene, trigger bill scenario
    if (secretaryInScene) {
      await handleSecretaryCronsterDefeatBill();
    }
    
    S.cronster.defeated = true;
    S.cronster.active = false;
    // Track match when defeated (if not already set)
    if (!S.cronster.defeated_at_match) {
      S.cronster.defeated_at_match = S.matches_played || 0;
    }
    if (typeof updateHUD === 'function') updateHUD();
    return false;
  }
}

// Handle secretary bill scenario when player loses duel with Cronster
async function handleSecretaryCronsterDefeatBill() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  log('');
  log(`A few days later, ${S.secretary_name || 'your secretary'} comes to your office.`);
  log(`She looks shaken and pale.`);
  log(`"I need to talk to you," she says quietly.`);
  log(`"What that... thing... did to me... I'm not the same. I feel empty. Drained."`);
  log(`"I need to go to an expensive private clinic. They have a state-of-the-art 're-juicing' machine."`);
  log(`"They can put the juice back into me. But it's going to cost a lot of money."`);
  log('');
  log(`She looks at you with a steely expression.`);
  log(`"If you don't pay for this, I'll tell everyone you did this to me. Everyone."`);
  log(`"The press, the board, your wife... everyone will know this is your fault."`);
  
  const billAmount = Math.floor((S.chairman_cash || 0) * 0.4); // 40% of personal cash, minimum £500k
  const finalBill = Math.max(500000, billAmount);
  
  const choice = await choose([
    { key: 'pay', label: `Pay the bill (£${finalBill.toLocaleString()})`, variant: 'warn' },
    { key: 'refuse', label: 'Refuse to pay', variant: 'bad' }
  ], `${S.secretary_name} demands payment for clinic treatment:`);
  
  if (choice === 'pay') {
    if ((S.chairman_cash || 0) >= finalBill) {
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - finalBill);
      log(`You reluctantly write a cheque for £${finalBill.toLocaleString()}.`);
      log(`${S.secretary_name} takes it with a cold nod.`);
      log(`"Thank you. I'll be back in a week. The treatment should restore me."`);
      log(`She leaves without another word.`);
      if (typeof updateHUD === 'function') updateHUD();
    } else {
      log(`You don't have enough money to pay the full amount.`);
      log(`${S.secretary_name} looks furious.`);
      log(`"This isn't enough! I'm going to the press!"`);
      await handleSecretaryPressStory();
    }
  } else {
    log(`"Fine," she says coldly. "You've made your choice."`);
    log(`She turns and walks out.`);
    await handleSecretaryPressStory();
  }
}

// Handle secretary press story when player refuses to pay
async function handleSecretaryPressStory() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  log('');
  log(`A week later, a story breaks in the press:`);
  log(`"CHAIRMAN'S SECRETARY ALLEGES NEGLIGENCE AFTER ATTACK"`);
  log(`"${S.secretary_name} claims that ${S.full_name || 'the chairman'} failed to protect her`);
  log(`from a violent attack, leaving her traumatized and requiring expensive medical treatment."`);
  log('');
  log(`Your reputation takes a significant hit.`);
  S.reputation = Math.max(0, (S.reputation || 50) - 15);
  S.notoriety = Math.min(100, (S.notoriety || 0) + 10);
  
  // Wife confrontation
  if (S.married) {
    await handleWifeSecretaryScandalConfrontation();
  }
  
  if (typeof updateHUD === 'function') updateHUD();
}

// Handle secretary affair prompt after winning duel
async function handleSecretaryCronsterVictoryAffair() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  log('');
  log(`After the police leave (or the cleanup crew finishes), ${S.secretary_name || 'your secretary'} approaches you.`);
  log(`She's still shaken, but there's a new look in her eyes.`);
  log(`"You saved me," she says softly. "I don't know how to thank you."`);
  log(`"What can I do to repay you?"`);
  
  // Set relationship to 100
  S.secRel = 100;
  S.secTrust = 100;
  
  log('');
  log(`Your relationship with ${S.secretary_name} is now at 100.`);
  log('');
  
  const affairChoice = await choose([
    { key: 'yes', label: 'Begin affair with secretary', variant: 'sensual' },
    { key: 'no', label: 'Keep things professional' }
  ], 'Begin affair with secretary?');
  
  if (affairChoice === 'yes') {
    await handleSecretaryAffairConsequences();
  } else {
    log(`"I understand," she says. "But know that I'm here for you, always."`);
    log(`She gives you a meaningful look before leaving.`);
    log(`Your relationship remains at 100. She will now respond positively to erotic and flirtatious messages.`);
    // Note: The quote bank will need to be updated to handle relationship = 100
  }
}

// Play interview video (sober or drunk)
async function playInterviewVideo(type) {
  const videoUrls = {
    sober: 'https://www.dropbox.com/scl/fi/td8mibrqvk4vchwuk80s3/My-Movie-3.mp4?rlkey=3k5onx5m6zjdpm0ity3o16723&st=e85o2h53&dl=1',
    drunk: 'https://www.dropbox.com/scl/fi/jkf1h8beejllm8nk2uj2c/My-Movie-2.mp4?rlkey=szu1sjewkm6kj5u6jps3k6epj&st=oal7jbh4&dl=1'
  };
  
  const videoUrl = videoUrls[type];
  if (!videoUrl) {
    log('Video not available.');
    return;
  }
  
  // Create video modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'interviewVideoOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `;
  
  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.style.cssText = `
    position: relative;
    max-width: 90%;
    max-height: 90%;
    width: auto;
    height: auto;
  `;
  
  // Create video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.controls = true;
  video.style.cssText = `
    max-width: 100%;
    max-height: 80vh;
    width: auto;
    height: auto;
    display: block;
  `;
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 12px 24px;
    background: var(--accent, #6366f1);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
  `;
  closeBtn.onclick = () => {
    video.pause();
    overlay.remove();
  };
  
  // Close on video end
  video.onended = () => {
    overlay.remove();
  };
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      video.pause();
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  videoContainer.appendChild(video);
  overlay.appendChild(videoContainer);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  
  // Play video
  try {
    await video.play();
  } catch (e) {
    log('Video playback error. Please click play manually.');
  }
  
  // Wait for video to end or close button to be clicked
  return new Promise((resolve) => {
    const checkClosed = () => {
      if (!document.getElementById('interviewVideoOverlay')) {
        resolve();
      } else {
        setTimeout(checkClosed, 100);
      }
    };
    checkClosed();
  });
}

// Fundraiser system functions
async function openFundraiserModal() {
  // Initialize fundraiser state if needed
  if (!S.fundraiser) {
    S.fundraiser = {
      used_this_season: false,
      last_season_used: 0,
      events_used: []
    };
  }

  // Reset used_this_season if we're in a new season
  const currentSeason = S.season || 1;
  if (S.fundraiser.last_season_used !== currentSeason) {
    S.fundraiser.used_this_season = false;
  }

  // Check if fundraiser has been used this season
  if (S.fundraiser.used_this_season && S.fundraiser.last_season_used === currentSeason) {
    log('You can only use the fundraiser option once per season.');
    return;
  }

  // Define available events
  const events = [
    {
      id: 'sanmik',
      name: 'SanMik Concert',
      description: 'The iconic and cheeky British rap artist performs at the stadium',
      videoUrl: 'https://www.dropbox.com/scl/fi/4qbi0pw9sm7lrulemt47k/sanmik.mp4?rlkey=ptzv7b03q4gkgdzz3j244s5z9&st=hr9vzn0h&dl=1',
      available: true
    },
    {
      id: 'burger',
      name: 'The Festival of Burger',
      description: 'The annual Festival of Burger is held at the stadium: yumzo!',
      videoUrl: 'https://www.dropbox.com/scl/fi/9nph4kqvxi816u4z2j325/festival-of-burger.mp4?rlkey=4l15ofx8w2oy44kgqftccf5t4&st=rz8s7x45&dl=1',
      available: true
    },
    {
      id: 'execution',
      name: 'Public Execution',
      description: 'What excites the masses more than the spectacle of vintage British justice being doled out in the old fashioned way?',
      videoUrl: 'https://www.dropbox.com/scl/fi/ydxozg67mgj4b09xjr46y/public-execution.mp4?rlkey=jkclzmgee3vutrxk32l2pykld&st=umlk0hke&dl=1',
      available: true
    },
    {
      id: 'juice',
      name: "'Juice' the Musical!",
      description: "The brand new Larry Lizards musical that's taking the nation by storm!",
      videoUrl: 'https://www.dropbox.com/scl/fi/5wxboonwm7wo5i2knjtsw/cronster-musical.mp4?rlkey=vk4gp7pslkosjcswk93jyitsz&st=3kkvnnw5&dl=1',
      available: currentSeason >= 2  // Only available from season 2 onwards
    }
  ];

  // Filter out events that have already been used
  const availableEvents = events.filter(event => {
    if (!event.available) return false;
    return !S.fundraiser.events_used.includes(event.id);
  });

  if (availableEvents.length === 0) {
    log('All available fundraising events have already been used this campaign.');
    return;
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'fundraiserModalOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `;

  // Create modal container
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1a1a1a;
    color: #eee;
    width: min(600px, 90vw);
    max-height: 80vh;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.8);
    overflow-y: auto;
  `;

  // Create title
  const title = document.createElement('h2');
  title.textContent = '🎪 Fundraising Events';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #fff;';
  modal.appendChild(title);

  // Create description
  const desc = document.createElement('p');
  desc.textContent = 'Select a fundraising event to hold at your stadium. Each event generates a random sum between £2-12 million. You must watch the video to completion to receive the funds.';
  desc.style.cssText = 'margin: 0 0 20px 0; font-size: 14px; color: #aaa; line-height: 1.5;';
  modal.appendChild(desc);

  // Create event buttons
  availableEvents.forEach(event => {
    const eventBtn = document.createElement('button');
    eventBtn.textContent = `${event.name} - ${event.description}`;
    eventBtn.style.cssText = `
      width: 100%;
      padding: 16px;
      margin-bottom: 12px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ccc;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      text-align: left;
      transition: all 0.2s;
    `;
    eventBtn.onmouseover = () => {
      eventBtn.style.background = 'rgba(255,255,255,0.15)';
      eventBtn.style.borderColor = 'rgba(255,255,255,0.3)';
    };
    eventBtn.onmouseout = () => {
      eventBtn.style.background = 'rgba(255,255,255,0.08)';
      eventBtn.style.borderColor = 'rgba(255,255,255,0.15)';
    };
    eventBtn.onclick = async () => {
      overlay.remove();
      await playFundraiserVideo(event);
    };
    modal.appendChild(eventBtn);
  });

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  closeBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    margin-top: 12px;
    background: #333;
    color: #eee;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
  `;
  closeBtn.onclick = () => {
    overlay.remove();
  };
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Play fundraiser video and handle rewards
async function playFundraiserVideo(event) {
  log(`<strong>🎪 Fundraising Event:</strong> ${event.name}`);
  log(`You must watch the video to completion to receive the funds.`);

  // Create video modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'fundraiserVideoOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `;

  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.style.cssText = `
    position: relative;
    max-width: 90%;
    max-height: 90%;
    width: auto;
    height: auto;
  `;

  // Create video element
  const video = document.createElement('video');
  video.src = event.videoUrl;
  video.controls = true;
  video.style.cssText = `
    max-width: 100%;
    max-height: 80vh;
    width: auto;
    height: auto;
    display: block;
  `;

  // Create info text
  const infoText = document.createElement('div');
  infoText.textContent = `Watch ${event.name} to completion to receive your funds`;
  infoText.style.cssText = `
    color: #fff;
    font-size: 18px;
    margin-bottom: 20px;
    text-align: center;
    font-weight: 600;
  `;

  // Create close button (disabled until video ends)
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close (Video must finish first)';
  closeBtn.disabled = true;
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 12px 24px;
    background: #555;
    color: #999;
    border: none;
    border-radius: 8px;
    cursor: not-allowed;
    font-size: 16px;
    font-weight: 600;
  `;

  // Handle video end
  video.onended = () => {
    // Generate random reward between 2-12 million
    const reward = Math.floor(Math.random() * 10000000) + 2000000; // 2M to 12M
    
    // Add to club cash
    S.club_cash = (S.club_cash || 0) + reward;
    
    // Mark event as used
    if (!S.fundraiser.events_used) {
      S.fundraiser.events_used = [];
    }
    S.fundraiser.events_used.push(event.id);
    
    // Mark fundraiser as used this season
    S.fundraiser.used_this_season = true;
    S.fundraiser.last_season_used = S.season || 1;
    
    // Update HUD
    updateHUD();
    
    // Enable close button
    closeBtn.disabled = false;
    closeBtn.style.background = 'var(--accent, #6366f1)';
    closeBtn.style.color = 'white';
    closeBtn.style.cursor = 'pointer';
    closeBtn.textContent = 'Close';
    
    log(`<strong>💰 Fundraising Success!</strong> ${event.name} generated £${reward.toLocaleString()} for the club!`);
    
    // Show news story popup for SanMik event
    if (event.id === 'sanmik' && typeof showNewsArticle === 'function') {
      const sanmikNewsStory = {
        section: 'scandal',
        headline: 'ARMED FORCES PRAISED FOLLOWING "NECESSARY INTERVENTION" AFTER SANMIK CONCERT INCIDENT',
        writer: 'Defence Correspondent',
        body: `The Armed Forces have been formally praised by government officials following what the Ministry of Defence described as a "rapid, proportionate and unavoidable response" to an incident arising from a sold-out SanMik concert on Saturday night.

During the performance of his hit song Do The Crocodile, SanMik released four live crocodiles into the audience. While no injuries were reported at the stadium itself, authorities confirmed that the animals later exited the venue and entered a nearby McDonald's restaurant.

A senior military spokesperson stated that the situation escalated quickly.

"Given the presence of crocodiles in McDonalds, we determined that it was very sad, but we had to fire multiple tank rounds at it, in case the crocodiles started attacking people" the spokesperson said.

Armoured units were deployed to the scene, where tank munitions were fired into the McDonald's, which witnesses described as "exploding very largely." Sixty-two people were killed instantly.

In a statement released shortly afterwards, officials emphasised that the crocodiles were neutralised and that the wider public had been protected.

"Their sacrifice will not be forgotten," the statement read.

Prime Minister Sir Keir Starmer praised the Armed Forces for their decisiveness and confirmed that emergency funding had been authorised to ensure the McDonald's is rebuilt immediately, "so that normal life can resume as soon as possible."

SanMik has not commented.`,
        effects: {}
      };
      
      // Show the news story after a brief delay
      setTimeout(() => {
        showNewsArticle(sanmikNewsStory).catch((err) => {
          console.error("Error showing SanMik news story:", err);
        });
      }, 500);
    }
  };

  closeBtn.onclick = () => {
    if (!closeBtn.disabled) {
      video.pause();
      overlay.remove();
    }
  };

  // Close on escape key (only if video ended)
  const handleEscape = (e) => {
    if (e.key === 'Escape' && !closeBtn.disabled) {
      video.pause();
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  videoContainer.appendChild(video);
  overlay.appendChild(infoText);
  overlay.appendChild(videoContainer);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // Play video
  try {
    await video.play();
  } catch (e) {
    log('Video playback error. Please click play manually.');
  }
}

// Handle secretary affair consequences (protection choice, STD, pregnancy, etc.)
async function handleSecretaryAffairConsequences() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  log('');
  log(`You and ${S.secretary_name} find yourselves alone in your office.`);
  log(`The tension is palpable.`);
  log(`"Are you sure about this?" she asks.`);
  
  const protectionChoice = await choose([
    { key: 'use', label: 'Use protection' },
    { key: 'dont', label: "Don't use protection", variant: 'sensual' }
  ], 'Right before the act:');
  
  if (protectionChoice === 'use') {
    log(`You use protection. The encounter is safe.`);
    log(`Afterwards, ${S.secretary_name} looks at you with disappointment.`);
    log(`"I thought you were a real man," she says coldly.`);
    log(`"Real men don't wrap it."`);
    log(`She gets dressed and leaves without another word.`);
    
    // Relationship drops to 60
    S.secRel = 60;
    S.secTrust = Math.max(0, (S.secTrust || 100) - 20);
    
    log(`Your relationship with ${S.secretary_name} drops to 60.`);
    
    // She threatens to go to press unless paid
    log('');
    log(`A few days later, ${S.secretary_name} returns to your office.`);
    log(`"I've been thinking," she says. "What happened between us... it wasn't what I expected."`);
    log(`"I'm going to the press unless you pay me. £200,000. That's my price for silence."`);
    
    const blackmailAmount = 200000;
    const payChoice = await choose([
      { key: 'pay', label: `Pay her £${blackmailAmount.toLocaleString()}`, variant: 'warn' },
      { key: 'refuse', label: 'Refuse to pay', variant: 'bad' }
    ], `${S.secretary_name} demands payment:`);
    
    if (payChoice === 'pay') {
      if ((S.chairman_cash || 0) >= blackmailAmount) {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - blackmailAmount);
        log(`You pay her the money. She takes it with a smirk.`);
        log(`"Pleasure doing business," she says, and leaves.`);
        if (typeof updateHUD === 'function') updateHUD();
      } else {
        log(`You don't have enough money. She's not happy.`);
        await handleSecretaryPressStoryAffair();
      }
    } else {
      log(`"Fine," she says. "You'll regret this."`);
      await handleSecretaryPressStoryAffair();
    }
  } else {
    // Don't use protection
    log(`You don't use protection. The encounter is risky.`);
    log(`Afterwards, ${S.secretary_name} looks satisfied.`);
    log(`"Now that's what I'm talking about," she says with a smile.`);
    
    // Season 4 & 5: Trigger lashing for adultery
    if ((S.season === 4 || S.season === 5) && typeof administerLashing === 'function') {
      // Small chance to be caught immediately, or trigger after a delay
      if (Math.random() < 0.3) {
        await waitAdvance("Arrest", "The sharia police arrive...");
        await administerLashing('Adultery at the club', rnd(10, 20));
      } else {
        // Flag for later lashing (could trigger in a few matches)
        if (!S._pending_lashing) S._pending_lashing = [];
        S._pending_lashing.push({
          crime: 'Adultery at the club',
          lashes: rnd(10, 20),
          delay_matches: rnd(2, 5)
        });
      }
    }
    
    // Check for STD transmission
    const hasSTD = S.std_state === 'untreated' || S.very_bad_std_state === 'infected';
    const hasVeryBadSTD = S.very_bad_std_state === 'infected';
    
    if (hasSTD) {
      log('');
      log(`A week later, ${S.secretary_name} comes to your office looking worried.`);
      log(`"I need to talk to you," she says. "I've contracted something. From you."`);
      
      if (hasVeryBadSTD) {
        log(`"It's serious. Very serious. I need expensive treatment immediately."`);
        log(`"This is your fault. You gave me a very bad STD."`);
      } else {
        log(`"I have an STD. You gave it to me."`);
      }
      
      // Relationship decimated
      S.secRel = 10;
      S.secTrust = 0;
      
      log(`Your relationship with ${S.secretary_name} has been decimated.`);
      log(`"I'm going to the police unless you pay for my treatment," she threatens.`);
      
      const treatmentCost = hasVeryBadSTD ? 1000000 : 500000;
      const treatmentChoice = await choose([
        { key: 'pay', label: `Pay for treatment (£${treatmentCost.toLocaleString()})`, variant: 'warn' },
        { key: 'refuse', label: 'Refuse to pay', variant: 'bad' }
      ], `${S.secretary_name} demands payment for STD treatment:`);
      
      if (treatmentChoice === 'pay') {
        if ((S.chairman_cash || 0) >= treatmentCost) {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - treatmentCost);
          log(`You pay for her treatment. She accepts the money but looks at you with disgust.`);
          log(`"I never want to see you again," she says, and leaves.`);
          if (typeof updateHUD === 'function') updateHUD();
        } else {
          log(`You don't have enough money to pay for her treatment.`);
          log(`"Fine," she says. "I'm going to the police."`);
          await handleSecretarySTDPoliceDelmor();
        }
      } else {
        log(`"Fine," she says. "I'm going to the police."`);
        await handleSecretarySTDPoliceDelmor();
      }
    } else {
      // No STD, but check for pregnancy
      const pregnancyChance = 0.7; // High chance (70%)
      if (Math.random() < pregnancyChance) {
        log('');
        log(`A few weeks later, ${S.secretary_name} comes to your office.`);
        log(`"I'm pregnant," she says. "It's yours."`);
        log(`"We need to talk about what happens next."`);
        
        // Schedule pregnancy event
        (S.pending_pregnancies = S.pending_pregnancies || []).push({
          partner_name: S.secretary_name,
          matches_until: 2
        });
        
        if (typeof addChairmanPointsImmediate === 'function') {
          addChairmanPointsImmediate(15, 'pregnancy');
        }
      }
    }
  }
}

// Handle secretary seduction after drive home (lecherous path)
async function handleSecretaryDriveHomeSeduction() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  const secretaryName = S.secretary_name || 'your secretary';
  
  log(`You're in her apartment now. The door closes behind you.`);
  log(`"So," ${secretaryName} says, turning to face you. "What happens next?"`);
  log(`The tension is palpable.`);
  log('');
  
  const protectionChoice = await choose([
    { key: 'use', label: 'Use protection' },
    { key: 'dont', label: "Don't use protection", variant: 'sensual' }
  ], 'Right before the act:');
  
  if (protectionChoice === 'use') {
    log(`You use protection. The encounter is safe.`);
    log(`Afterwards, ${secretaryName} looks at you with disappointment.`);
    log(`"I thought you were a real man," she says coldly.`);
    log(`"Real men don't wrap it."`);
    log(`She gets dressed and shows you to the door.`);
    
    // Relationship drops
    if (S.secRel !== undefined) S.secRel = Math.max(0, (S.secRel || 50) - 20);
    if (S.secTrust !== undefined) S.secTrust = Math.max(0, (S.secTrust || 100) - 20);
    
    log(`Your relationship with ${secretaryName} has decreased.`);
    
    // She threatens to go to press unless paid
    log('');
    log(`A few days later, ${secretaryName} returns to your office.`);
    log(`"I've been thinking," she says. "What happened between us... it wasn't what I expected."`);
    log(`"I'm going to the press unless you pay me. £200,000. That's my price for silence."`);
    
    const blackmailAmount = 200000;
    const payChoice = await choose([
      { key: 'pay', label: `Pay her £${blackmailAmount.toLocaleString()}`, variant: 'warn' },
      { key: 'refuse', label: 'Refuse to pay', variant: 'bad' }
    ], `${secretaryName} demands payment:`);
    
    if (payChoice === 'pay') {
      if ((S.chairman_cash || 0) >= blackmailAmount) {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - blackmailAmount);
        log(`You pay her the money. She takes it with a smirk.`);
        log(`"Pleasure doing business," she says, and leaves.`);
        if (typeof updateHUD === 'function') updateHUD();
      } else {
        log(`You don't have enough money. She's not happy.`);
        await handleSecretaryPressStoryAffair();
      }
    } else {
      log(`"Fine," she says. "You'll regret this."`);
      await handleSecretaryPressStoryAffair();
    }
  } else {
    // Don't use protection
    log(`You don't use protection. The encounter is risky.`);
    log(`Afterwards, ${secretaryName} looks satisfied.`);
    log(`"Now that's what I'm talking about," she says with a smile.`);
    
    // Award lobby tokens for unprotected sex (more than protected)
    addLobbyTokens(25, 'seducing (unprotected sex)');
    
    // Check for STD transmission
    const hasSTD = S.std_state === 'untreated' || S.very_bad_std_state === 'infected';
    const hasVeryBadSTD = S.very_bad_std_state === 'infected';
    
    if (hasSTD) {
      log('');
      log(`A week later, ${secretaryName} comes to your office looking worried.`);
      log(`"I need to talk to you," she says. "I've contracted something. From you."`);
      
      if (hasVeryBadSTD) {
        log(`"It's serious. Very serious. I need expensive treatment immediately."`);
        log(`"This is your fault. You gave me a very bad STD."`);
      } else {
        log(`"I have an STD. You gave it to me."`);
      }
      
      // Relationship decimated
      if (S.secRel !== undefined) S.secRel = 10;
      if (S.secTrust !== undefined) S.secTrust = 0;
      
      log(`Your relationship with ${secretaryName} has been decimated.`);
      log(`"I'm going to the police unless you pay for my treatment," she threatens.`);
      
      const treatmentCost = hasVeryBadSTD ? 1000000 : 500000;
      const treatmentChoice = await choose([
        { key: 'pay', label: `Pay for treatment (£${treatmentCost.toLocaleString()})`, variant: 'warn' },
        { key: 'refuse', label: 'Refuse to pay', variant: 'bad' }
      ], `${secretaryName} demands payment for STD treatment:`);
      
      if (treatmentChoice === 'pay') {
        if ((S.chairman_cash || 0) >= treatmentCost) {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - treatmentCost);
          log(`You pay for her treatment. She accepts the money but looks at you with disgust.`);
          log(`"I never want to see you again," she says, and leaves.`);
          if (typeof updateHUD === 'function') updateHUD();
        } else {
          log(`You don't have enough money to pay for her treatment.`);
          log(`"Fine," she says. "I'm going to the police."`);
          await handleSecretarySTDPoliceDelmor();
        }
      } else {
        log(`"Fine," she says. "I'm going to the police."`);
        await handleSecretarySTDPoliceDelmor();
      }
    } else {
      // No STD, but check for pregnancy
      const pregnancyChance = 0.7; // High chance (70%)
      if (Math.random() < pregnancyChance) {
        log('');
        log(`A few weeks later, ${secretaryName} comes to your office.`);
        log(`"I'm pregnant," she says. "It's yours."`);
        log(`"We need to talk about what happens next."`);
        
        // Schedule pregnancy event
        (S.pending_pregnancies = S.pending_pregnancies || []).push({
          partner_name: secretaryName,
          matches_until: 2
        });
        
        if (typeof addChairmanPointsImmediate === 'function') {
          addChairmanPointsImmediate(15, 'pregnancy');
        }
      }
    }
    
    // Update relationship positively if no STD
    if (!hasSTD) {
      if (S.secRel !== undefined) S.secRel = Math.min(100, (S.secRel || 50) + 10);
      if (S.secretaryState) {
        S.secretaryState.romance = (S.secretaryState.romance || 0) + 0.2;
        S.secretaryState.criminalBond = (S.secretaryState.criminalBond || 0) + 0.1;
      }
    }
  }
}

// Handle secretary going to police about STD, Delmor steps in
async function handleSecretarySTDPoliceDelmor() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  // Store name before clearing flags
  const secretaryName = S.secretary_name;
  
  log('');
  log(`A few days later, you receive a call.`);
  log(`"This is ${secretaryName}," she says. "I went to the police, but before they could do anything..."`);
  log(`"Someone else stepped in. Delmor Krunchem."`);
  log(`"He paid for my treatment. All of it. He said he couldn't stand to see a woman suffer."`);
  log(`"We've been talking. He's actually quite charming."`);
  log(`"I'm starting a relationship with him. Consider this my resignation."`);
  log('');
  log(`Your secretary has left you for Delmor Krunchem.`);
  
  // Mark secretary as no longer available
  S.secretary_hired = false;
  S.secRel = 0;
  S.secTrust = 0;
  
  // Add some flavor text from Delmor
  setTimeout(() => {
    const message = `Thanks for the introduction to ${secretaryName}. She's much better off with me.`;
    if (typeof sendRivalText === 'function') {
      sendRivalText(message);
    } else if (typeof window.enqueueRivalText === 'function') {
      console.log('[DEBUG handleSecretarySTDPoliceDelmor] Calling enqueueRivalText with:', message);
      window.enqueueRivalText(message);
    } else {
      console.log('[DEBUG handleSecretarySTDPoliceDelmor] enqueueRivalText not available, using log fallback');
      log(`📱 Delmor Krunchem: "${message}"`);
    }
  }, 1000);
  
  if (typeof updateHUD === 'function') updateHUD();
}

// Handle secretary press story about affair
async function handleSecretaryPressStoryAffair() {
  if (!S.secretary_hired || !S.secretary_name) return;
  
  log('');
  log(`A week later, a story breaks in the press:`);
  log(`"CHAIRMAN'S SECRETARY ALLEGES SEXUAL MISCONDUCT"`);
  log(`"${S.secretary_name} claims that ${S.full_name || 'the chairman'} pressured her into a sexual relationship`);
  log(`and then refused to take responsibility, leaving her feeling used and betrayed."`);
  log('');
  log(`Your reputation takes a significant hit.`);
  S.reputation = Math.max(0, (S.reputation || 50) - 20);
  S.notoriety = Math.min(100, (S.notoriety || 0) + 15);
  
  // Wife confrontation
  if (S.married) {
    await handleWifeSecretaryScandalConfrontation();
  }
  
  if (typeof updateHUD === 'function') updateHUD();
}

// Handle wife confrontation about secretary scandal
async function handleWifeSecretaryScandalConfrontation() {
  if (!S.married) return;
  
  log('');
  log(`Your wife confronts you about the secretary scandal.`);
  log(`"How could you?" she demands. "How could you do this to me? To us?"`);
  
  const hasCert = hasEroticSyndromeCertificate();
  
  if (hasCert) {
    const useCert = await choose([
      { key: 'yes', label: 'Show her your Erotic Disorder certificate' },
      { key: 'no', label: 'Try to explain without it' }
    ], "Do you want to show her your certificate?");
    
    if (useCert === 'yes') {
      useEroticSyndromeCertificate();
      log(`You show her the certificate. She reads it carefully.`);
      log(`"Oh my god," she says, "I had no idea you were suffering from this condition. This is so, so sad."`);
      log(`She's sympathetic and decides not to take your money.`);
      log(`Your reputation actually improves slightly due to her sympathy for your condition.`);
      S.reputation = Math.min(100, (S.reputation || 50) + 2);
      if (typeof updateHUD === 'function') updateHUD();
      return;
    }
  }
  
  // Wife takes money
  const amount = Math.floor((S.chairman_cash || 0) * 0.3); // 30% of personal cash
  if (amount > 0) {
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - amount);
    log(`Your wife is furious. She takes £${amount.toLocaleString()} from your personal funds.`);
    log(`"I can't believe you would do this," she says. "This is for my emotional distress."`);
    if (S.wife_love !== undefined) {
      S.wife_love = Math.max(0, (S.wife_love || 60) - 20);
    }
    if (typeof updateHUD === 'function') updateHUD();
  } else {
    log(`Your wife is furious, but you don't have enough money for her to take.`);
    if (S.wife_love !== undefined) {
      S.wife_love = Math.max(0, (S.wife_love || 60) - 25);
    }
  }
}

// Handle booby trap option
async function handleCronsterBoobyTrap() {
  if (S.cronster.booby_trap_set) return;
  
  log(`You decide to set a booby trap for the Cronster.`);
  log(`You fill up a blow-up doll with grapefruit juice.`);
  log(`"This is indistinguishable from a real woman," you reason.`);
  log(`You set it up and wait...`);
  
  S.cronster.booby_trap_set = true;
  S.cronster.booby_trap_climax_triggered = false;
  // Don't set pending_climax to false here - let processCronsterEvents or door check handle it
  // S.cronster.booby_trap_pending_climax = false;
  
  log(`The trap is set. The Cronster will be drawn to it when conditions are right...`);
}

// Check if cronster booby trap should be available
function shouldOfferCronsterBoobyTrap() {
  if (!S.cronster.active || S.cronster.defeated || S.cronster.booby_trap_set) return false;
  if (!S.womens_team || S.womens_team.liquidated) return false;
  
  // Offer after a few matches of cronster activity
  return S.cronster.sightings_count >= 3 && S.cronster.juice_incident;
}

// Watch surveillance footage (post-match option)
async function watchSurveillanceFootage(location) {
  if (location === 'secret_zone') {
    // Check if already watched (can only watch once)
    if (S.cronster.secret_zone_watched) {
      log(`You've already watched the womens toilet footage. It's no longer available.`);
      return;
    }
    
    // Show the video FIRST
    log(`You watch the surveillance footage from the womens toilets.`);
    
    // Check for certificate first to determine if we should show PERVERT during video
    const hasCert = hasEroticSyndromeCertificate();
    let pervertDiv = null;
    
    // Show video player with actual video
    const videoDiv = document.createElement('div');
    videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 10000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px;';
    
    // Use Dropbox direct download URL (dl=1 makes it a direct download link)
    const dropboxUrl = 'https://www.dropbox.com/scl/fi/uod1htoycrmns5omda7f2/Video-12-18-25-10-20-54-pm.mov?rlkey=4ul65tggdj73jcrggyas0kwbt&st=p94ivw3j&dl=1';
    
    // Create close handler function
    const closeHandler = () => {
      if (pervertDiv) pervertDiv.remove();
      videoDiv.remove();
    };
    
    // Add prominent X button in top-right corner
    const xButton = document.createElement('button');
    xButton.innerHTML = '✕';
    xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 10001; display: flex; align-items: center; justify-content: center; line-height: 1;';
    xButton.onclick = closeHandler;
    xButton.title = 'Close';
    
    videoDiv.innerHTML = '<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 SURVEILLANCE FOOTAGE</div><video id="secretZoneVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="' + dropboxUrl + '" type="video/quicktime"><source src="' + dropboxUrl + '" type="video/mp4">Your browser does not support the video tag.</video>';
    videoDiv.appendChild(xButton);
    document.body.appendChild(videoDiv);
    
    // Show PERVERT during video if no certificate
    if (!hasCert) {
      pervertDiv = document.createElement('div');
      pervertDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10001; display: flex; align-items: center; justify-content: center; font-size: 120px; font-weight: bold; color: #ff0000; text-shadow: 0 0 20px #ff0000; animation: pulse 0.5s;';
      pervertDiv.textContent = 'PERVERT';
      document.body.appendChild(pervertDiv);
      
      // Flash it for 2 seconds, then remove but keep video playing
      await new Promise(resolve => setTimeout(resolve, 2000));
      pervertDiv.remove();
      pervertDiv = null;
    }
    
    // Wait for video to be closed or finished
    await new Promise((resolve) => {
      const video = document.getElementById('secretZoneVideo');
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
    
    // NOW check for certificate and handle arrest (PERVERT already shown during video if no cert)
    if (!hasCert) {
      
      // Queue police investigation for proper arrest/plea/guilty process
      log(`🚨 You are being arrested! The police are taking you away.`);
      log(`Your reputation plummets.`);
      S.reputation = Math.max(0, (S.reputation || 50) - 30);
      S.legal_risk = (S.legal_risk || 0) + 20;
      S.police_risk = (S.police_risk || 0) + 25;
      
      // Queue investigation for secret zone surveillance - will go through proper plea/guilty process
      if (typeof queueInvestigation === 'function') {
        queueInvestigation('police', 'Secret Zone Surveillance');
      } else if (typeof window.queueInvestigation === 'function') {
        window.queueInvestigation('police', 'Secret Zone Surveillance');
      } else {
        // Fallback: try to trigger investigation via knock queue
        if (!S.knock_queue) S.knock_queue = [];
        S.knock_queue.push({ type: 'investigation', authority: 'police', caseType: 'Secret Zone Surveillance' });
      }
      
      if (typeof updateHUD === 'function') updateHUD();
      S.cronster.secret_zone_watched = true; // Mark as watched even if arrested
      return;
    } else {
      // Has certificate
      useEroticSyndromeCertificate();
      log(`The word "PERVERT" tries to flash, but you show your certificate.`);
      log(`"Oh, I see," says the officer. "You have a medical condition. We understand."`);
      log(`You're let off with a warning.`);
    }
    
    // Mark as watched (can only watch once)
    S.cronster.secret_zone_watched = true;
  } else {
    log(`You watch the surveillance footage from the hallways.`);
    
    // Initialize counter if needed
    if (typeof S.cronster.hallways_matches_since_install !== 'number') {
      S.cronster.hallways_matches_since_install = 0;
    }
    if (typeof S.cronster.hallways_last_match_tracked !== 'number') {
      S.cronster.hallways_last_match_tracked = -1;
    }
    
    // Ensure counter is up to date (in case processCronsterEvents hasn't run yet)
    const currentMatch = S.matches_played || 0;
    if (currentMatch > S.cronster.hallways_last_match_tracked) {
      S.cronster.hallways_matches_since_install += 1;
      S.cronster.hallways_last_match_tracked = currentMatch;
    }
    
    // Determine how many videos are available (additive: match 1 = video 1, match 2 = videos 1-2, etc.)
    const videosAvailable = Math.min(S.cronster.hallways_matches_since_install, 7);
    
    // Check if no videos are available yet
    if (videosAvailable === 0) {
      log(`No surveillance footage is available yet. The cameras need at least one match to record footage.`);
      return;
    }
    
    // Video URLs array
    const videoUrls = [
      'https://www.dropbox.com/scl/fi/nt20si97z5gmzkbh0eqqa/1.mp4?rlkey=iqhtrkl7s30mtbxb2v5amvc6c&st=vy71pl9w&dl=1',
      'https://www.dropbox.com/scl/fi/e4l13hf7agfz2ijwwo5iw/2.mp4?rlkey=0vsvvh9sfhyz42bst2b34znit&st=cqb6xift&dl=1',
      'https://www.dropbox.com/scl/fi/gjemr9o9u665iypob4960/3.mp4?rlkey=mo9xsgt0cntmi2daam9yqhvtt&st=m84vz7y3&dl=1',
      'https://www.dropbox.com/scl/fi/lmlquts02mol9k5ga6dlc/4.mp4?rlkey=17zwm3ke86ok317t7sgitmvjm&st=egkhjosq&dl=1',
      'https://www.dropbox.com/scl/fi/13nygujb2vvlvb3x3oae7/5.mp4?rlkey=t63j3g8feb07ov7w8kf9os8f8&st=gsaib4y0&dl=1',
      'https://www.dropbox.com/scl/fi/172t338it5ucnb344qfow/6.mp4?rlkey=iab7w1n5idexzkff6n5mmpyzt&st=wiikz7w4&dl=1',
      'https://www.dropbox.com/scl/fi/5ecwcfmyfy7fwavzjh5qz/7.mp4?rlkey=m2qgfsdtq2gx9mcf0qwjqy0so&st=vubcnnzi&dl=1'
    ];
    
    // Show menu to select which video to watch
    const videoOptions = [];
    for (let i = 0; i < videosAvailable; i++) {
      videoOptions.push({ key: `video_${i + 1}`, label: `Video ${i + 1}` });
    }
    videoOptions.push({ key: 'cancel', label: 'Cancel' });
    
    const selectedVideo = await choose(videoOptions, 'Select surveillance footage to watch:');
    
    if (selectedVideo === 'cancel') {
      return;
    }
    
    // Extract video number from selection (e.g., "video_1" -> 1)
    const videoNum = parseInt(selectedVideo.split('_')[1]) - 1;
    const videoUrl = videoUrls[videoNum];
    const isMov = videoUrl.includes('.mov');
    
    // Show video player with selected video
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
    
    videoDiv.innerHTML = `<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 SURVEILLANCE FOOTAGE - Video ${videoNum + 1}</div><video id="hallwayVideo" controls autoplay style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="${videoUrl}" type="video/${isMov ? 'quicktime' : 'mp4'}"><source src="${videoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
    videoDiv.appendChild(xButton);
    document.body.appendChild(videoDiv);
    
    // Wait for video to be closed or finished
    await new Promise((resolve) => {
      const video = document.getElementById('hallwayVideo');
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
  }
}
