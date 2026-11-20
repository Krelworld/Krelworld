/* Portsmouth Special Event */
(async function() {
  'use strict';
  
  // Check if next match is Portsmouth and trigger special event
  async function checkPortsmouthSpecialEvent() {
    if (!S || !S.opponents || !Array.isArray(S.opponents)) return;
    
    const nextMatchIndex = S.matches_played || 0;
    const nextOpponent = S.opponents[nextMatchIndex];
    
    if (!nextOpponent) return;
    
    // Debug: log what we're checking for the Portsmouth special event
    
    // Check if next opponent is the rival (works even if Portsmouth was renamed to Burger King FC, etc.)
    const rivalClub = S.rival?.club || "Portsmouth";
    const isRivalMatch = nextOpponent === rivalClub;
    
    // Also check for legacy Portsmouth matches (for backwards compatibility)
    const isPortsmouthLegacy = nextOpponent.toLowerCase().includes('portsmouth') || 
                               nextOpponent.toLowerCase().includes('pompey');
    
    const isPortsmouth = isRivalMatch || isPortsmouthLegacy;
    
    // Only trigger once per Portsmouth/rival match
    if (isPortsmouth && !S.portsmouth_special_event_triggered) {
      S.portsmouth_special_event_triggered = true;
      await triggerPortsmouthSpecialEvent();
    }
  }
  
  // Main Portsmouth special event
  async function triggerPortsmouthSpecialEvent() {
    
    // Get rival's current club name (handles renames like Burger King FC)
    const rivalClub = S.rival?.club || "Portsmouth";
    
    log('');
    log(`⚽ Tomorrow is the big match against ${rivalClub}. The derby. The moment that defines everything.`);
    
    await waitAdvance("Evening", "The tension builds...");
    
    // Delmor threatening text
    const delmorTexts = [
      `You fucking cunt. Tomorrow we're coming to your shit hole of a city and we're going to destroy you. The entire ${rivalClub} squad is driving down right now. We're going to fucking annihilate you. Prepare for humiliation, you worthless piece of shit.`,
      `Hey scum. Just letting you know the entire ${rivalClub} team is on the road to your pathetic excuse for a city right now. We're going to fucking destroy you tomorrow. You're nothing. We own you. Get ready to be humiliated, you fucking loser.`,
      `Tomorrow you die. The whole ${rivalClub} squad is driving to your shit hole right now. We're going to fucking annihilate you. You're a joke. A pathetic joke. And tomorrow everyone will see it. Prepare yourself, you worthless cunt.`
    ];
    
    const delmorText = delmorTexts[Math.floor(Math.random() * delmorTexts.length)];
    
    // Send Delmor text - show in log AND queue to phone
    log(`📱 Delmor Krunchem: "${delmorText}"`);
    if (typeof queueIncomingText === 'function') {
      queueIncomingText('delmor_krunchem', delmorText, 'malicious');
    }
    
    await waitAdvance("Text Received", "Delmor has sent you a message...");
    
    // Ask if player wants to play a prank
    const prankChoice = await choose([
      {key: 'yes', label: `Yes, let's play a prank on ${rivalClub}`, variant: 'warn'},
      {key: 'no', label: 'No, stay home and prepare', variant: ''}
    ], `Delmor's message fills you with rage. Do you want to play a prank on ${rivalClub}?`);
    
    if (prankChoice === 'no') {
      log('You decide to stay home and prepare for the match. Smart move.');
      await waitAdvance("Preparing", "You get a good night's sleep...");
      // Game continues to pre-match phase naturally
      return;
    }
    
    // Go to Itchen Bridge
    log('');
    log('You make your way to the Itchen Bridge. The night air is cold. In the distance, you can see headlights approaching...');
    log(`The ${rivalClub} team bus is coming.`);
    
    await waitAdvance("Itchen Bridge", "The bus approaches...");
    
    // Check inventory for options
    const hasBrick = hasBrickInInventory();
    const hasCocaine = (S.inventory && S.inventory.drugs && S.inventory.drugs > 0) || false;
    const hasHGH = (S.doctor && S.doctor.hgh_stock && S.doctor.hgh_stock > 0) || false;
    
    const bridgeOptions = [];
    
    // Only show brick option if player hasn't thrown it twice already
    // After 2 throws, the option is permanently removed to prevent crashes
    if (hasBrick && (S.portsmouth_brick_throws || 0) < 2) {
      bridgeOptions.push({key: 'throw_brick', label: `Throw brick at the ${rivalClub} team bus`, variant: 'bad'});
    }
    
    if (hasCocaine || hasHGH) {
      bridgeOptions.push({key: 'take_drugs', label: 'Take ' + (hasCocaine ? 'cocaine' : 'HGH') + ' and gesture menacingly at the bus', variant: 'warn'});
    }
    
    bridgeOptions.push({key: 'moon', label: `Expose yourself to the ${rivalClub} team bus`, variant: 'warn'});
    bridgeOptions.push({key: 'nothing', label: 'Do nothing, just watch', variant: ''});
    
    const bridgeChoice = await choose(bridgeOptions, "What do you want to do?");
    
    
    if (bridgeChoice === 'throw_brick') {
      // Track brick throws and add buildup if not first time
      const brickThrowCount = (S.portsmouth_brick_throws || 0) + 1;
      if (brickThrowCount > 1) {
        log('');
        log('You\'ve done this before. The memory of the last brick throw fills you with anticipation...');
        await waitAdvance("Memories", "You prepare to strike again...");
      }
      await handleBrickThrowAtBus();
    } else if (bridgeChoice === 'take_drugs') {
      await handleDrugsAndFight(hasCocaine);
    } else if (bridgeChoice === 'moon') {
      await handleMooning();
    } else if (bridgeChoice === 'nothing') {
      // Player chooses to do nothing: treat this as a quiet night before the derby
      log('You watch the bus drive past. Nothing happens. You return home, feeling slightly disappointed but oddly relieved.');
      // Give an explicit advance so the UI always has a button and the main loop can carry on cleanly
      await waitAdvance("Home", "The night passes and you focus on tomorrow's match...");
      // No special flags are set here: Portsmouth field their normal team and the game proceeds to the usual pre-match phase
    } else {
      // Defensive fallback for any unexpected key
      log('In a moment of sheer cowardice you decide to "head home and rest" before the match. Pathetic.');
      try {
        console.warn("[PORTSMOUTH EVENT] Unexpected bridgeChoice value:", bridgeChoice);
      } catch(e) {}
      await waitAdvance("Home", "The night passes and you focus on tomorrow's match...");
    }
  }
  
  // Check if player has brick in inventory
  function hasBrickInInventory() {
    if (!S.inventory || !Array.isArray(S.inventory.items)) return false;
    const brick = S.inventory.items.find(item => item.name === 'Brick');
    return !!brick;
  }
  
  // Handle brick throw at bus
  async function handleBrickThrowAtBus() {
    // Track brick throw count
    S.portsmouth_brick_throws = (S.portsmouth_brick_throws || 0) + 1;
    const throwCount = S.portsmouth_brick_throws;
    
    // First throw: original behavior
    if (throwCount === 1) {
      log('');
      log('You pull out the brick from your pocket. The bus is getting closer...');
      await waitAdvance("Throw brick", "The bus approaches...");
      
      // Show video popup
      await showBrickVideo();
      
      // Skip build-up (shown in video) and go straight to explosion
      log('');
      log('🔥🔥🔥 EXPLOSION! 🔥🔥🔥');
      log('🔥🔥🔥 MASSIVE FIREBALL! 🔥🔥🔥');
      log('🔥 The bus explodes in a massive fireball as it crashes into the water below!');
      log('🔥 The explosion lights up the night sky!');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await waitAdvance("Disaster", "The bus has crashed...");
      
      log('');
      log('📰 BREAKING NEWS: Portsmouth team bus crashes off Itchen Bridge. The Entire team is dead! Yes!!');
      log('Portsmouth FC has no choice but to field their under-12s team for tomorrow\'s match.');
      
      // Generate under-12s team
      generatePortsmouthUnder12sTeam();
      
      // Remove brick from inventory
      if (typeof window.removeItem === 'function') {
        window.removeItem('Brick', 1);
      } else if (S.inventory && Array.isArray(S.inventory.items)) {
        const brickIndex = S.inventory.items.findIndex(item => item.name === 'Brick');
        if (brickIndex >= 0) {
          S.inventory.items.splice(brickIndex, 1);
        }
      }
      
      // Delmor rage text
      const delmorRageTexts = [
        "YOU FUCKING MURDERER. YOU KILLED MY ENTIRE TEAM. I WILL DESTROY YOU. I WILL RUIN YOUR LIFE. THIS ISN'T OVER. I SWEAR TO GOD I WILL GET REVENGE. YOU'RE A DEAD MAN.",
        "I KNOW IT WAS YOU. YOU KILLED MY PLAYERS. MY TEAM. EVERYTHING. I WILL HUNT YOU DOWN. I WILL MAKE YOU PAY. THIS IS WAR. YOU'RE GOING TO REGRET THIS FOR THE REST OF YOUR PATHETIC LIFE.",
        "MY ENTIRE TEAM IS DEAD BECAUSE OF YOU. YOU'RE A MONSTER. A MURDERER. I WILL SPEND EVERY PENNY I HAVE TO DESTROY YOU. YOU THINK YOU'VE WON? YOU'VE JUST STARTED A WAR YOU CAN'T WIN."
      ];
      
      const rageText = delmorRageTexts[Math.floor(Math.random() * delmorRageTexts.length)];
      
      if (typeof queueIncomingText === 'function') {
        queueIncomingText('delmor_krunchem', rageText, 'malicious');
      } else {
        log(`📱 Delmor Krunchem: "${rageText}"`);
      }
      
      await waitAdvance("Delmor's Rage", "He knows it was you...");
      
      // Mark that bus was destroyed - press conference will happen after the match
      S.portsmouth_bus_destroyed = true;
      S.portsmouth_under12s_team = true;
      S.pending_press_conference_after_match = true;
      
      log('');
      log('You return home, energized by what you\'ve done. Tomorrow\'s match will be... funny.');
      await waitAdvance("Home", "The night passes...");
      
      // Show newspaper story about Shafty Rod Johnson as popup
      if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
        const newsHeadline = 'Shafty Rod Johnson Arrested After Obscene, Graphic Routine Mocking Portsmouth Bus Explosion';
        const newsBody = `SPECIAL REPORT — SOUTH COAST DERBY AFTERMATH

Stand-up comedian Shafty Rod Johnson was arrested late last night following a performance that police say crossed "every conceivable line of decency" in its treatment of the Portsmouth FC team bus explosion on the Itchen Bridge.

The routine, delivered less than 24 hours after the crash that killed everyone believed to be on board, has prompted widespread condemnation from football authorities, victims' advocates, and senior figures in the live-comedy industry.

According to witnesses, Johnson opened by framing the incident through the lens of the South Coast rivalry.

"South Coast derby's always fiery," he said. "Didn't expect Pompey to bring the cremation themselves."

The line drew scattered, nervous laughter before the room fell largely silent.

Johnson then referred directly to the location of the crash.

"Straight off the Itchen Bridge. No away support needed — they all travelled together."

Audience members say Johnson repeatedly returned to the imagery of the explosion. While newspapers are declining to reproduce the most extreme wording, police summaries confirm that Johnson made multiple graphic references to dismemberment, debris, and remains, at one point describing the river as "a floating kit list."

Another joke targeted emergency responders:

"Imagine being the bloke with the clipboard. 'Right… this leg's League One… this one's probably Championship.'"

Several people were heard audibly gasping.

Johnson also mocked the sporting consequences of the crash, saying:

"Under-12s tomorrow. Only Pompey team in years that still needs permission slips."

Boos became more pronounced as the routine progressed. Johnson responded aggressively.

"What? It's football. You lose players, you replace them. They're just… harder to gather."

The most controversial section came when Johnson turned to the families of the deceased players. Referring to Portsmouth's image as a community-focused club, he said:

"Big family club, aren't they? Well, congratulations — plenty of newly single mums in the fanbase tonight."

He followed this with a remark suggesting the widows would "land on their feet financially," adding:

"Grief passes. Payouts don't."

At this point, a significant number of audience members stood up and left.

Johnson closed the routine by circling back to the bridge itself.

"That bus went over the edge quicker than any bloke in this room would if he saw the compensation figures."

Immediately after delivering the line, Johnson performed his notorious finale. Police confirm that he exposed himself on stage and proceeded to complete an obscene sexual act in full view of the audience, framing it as the punchline to the preceding joke. Venue staff cut the microphone and summoned security within seconds.

Hampshire Police confirmed Johnson was arrested on suspicion of outraging public decency and public order offences.

"This was sustained mockery of a real mass-fatality event," a police spokesperson said. "It included sexualised remarks about bereaved individuals and a criminal act carried out publicly."`;
        
        const story = {
          section: 'politics',
          headline: newsHeadline,
          writer: getNextWriter(),
          body: newsBody,
          effects: { reputation: -5 }
        };
        log('');
        log('📰 A shocking story has broken in the news about a comedian\'s arrest.');
        await showNewsArticle(story);
        
        // Apply effects
        if (story.effects.reputation) {
          S.reputation = clamp((S.reputation || 50) + story.effects.reputation, 0, 100);
        }
      }
      
      // Game continues to pre-match phase naturally
    }
    // Second throw: anti-brick device, decoy team dies
    else if (throwCount === 2) {
      log('');
      log('You pull out the brick from your pocket. The bus is getting closer...');
      await waitAdvance("Brick in hand", "The bus approaches...");
      
      log('You hurl the brick with all your might...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      log('');
      log('🛡️🛡️🛡️ ANTI-BRICK DEVICE ACTIVATED! 🛡️🛡️🛡️');
      log('🛡️ A large and elaborate mechanical device extends from the bus!');
      log('🛡️ The Portsmouth bus has come prepared for shenanigans!');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      log('');
      log('💥💥💥 BRICK INTERCEPTED! 💥💥💥');
      log('💥 The anti-brick device catches your brick mid-flight!');
      log('💥 Your plan is foiled!');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      log('');
      log('⚖️⚖️⚖️ THE DEVICE IS TOO HEAVY! ⚖️⚖️⚖️');
      log('⚖️ The large piece of machinery, when extended, causes the bus to lose balance!');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      log('');
      log('🚌🚌🚌 THE BUS TIPS OVER! 🚌🚌🚌');
      log('🚌 The bus veers violently to the side!');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      log('');
      log('🌉🌉🌉 OFF THE BRIDGE! 🌉🌉🌉');
      log('🌉 The bus plummets off the Itchen Bridge!');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log('');
      log('🔥🔥🔥 EXPLOSION! 🔥🔥🔥');
      log('🔥🔥🔥 MASSIVE FIREBALL! 🔥🔥🔥');
      log('🔥 The bus explodes in a massive fireball as it crashes into the water below!');
      log('🔥 The explosion lights up the night sky!');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await waitAdvance("Disaster", "The bus has crashed...");
      
      log('');
      log('📰 BREAKING NEWS: Portsmouth team bus crashes off Itchen Bridge. All on board are dead!');
      
      // Show newspaper story about Shafty Rod Johnson mocking the under-12s bus crash as popup
      const newsHeadline = 'Shafty Rod Johnson Arrested After Routine Mocking Portsmouth Bus Explosion — Even After It Emerged Victims Were Under-12 Players';
      const newsBody = `SPECIAL REPORT — SOUTH COAST DERBY AFTERMATH
Shafty Rod Johnson Arrested After Routine Mocking Portsmouth Bus Explosion — Even After It Emerged Victims Were Under-12 Players

By Staff Reporter | Southampton

Stand-up comedian Shafty Rod Johnson has been arrested following a routine that police say crossed "an unprecedented moral and legal threshold" after he mocked the Portsmouth FC bus explosion — and continued after it became clear that those killed were members of the club's under-12s squad.

The performance took place on the night it was confirmed that, with the senior Portsmouth squad unavailable, a junior team had been travelling in advance of the South Coast derby when their bus crashed off the Itchen Bridge and exploded.

According to witnesses, Johnson opened his set under the apparent assumption that first-team players had been killed.

"Portsmouth finally went down together," he said. "That's teamwork."

As details of the victims began circulating inside the venue, several audience members can be heard shouting that the bus had been carrying children. Rather than stopping, Johnson addressed the revelation directly.

"Under-12s?" he replied. "Ah. Youth development finally paying dividends."

Gasps were audible across the room.

Johnson proceeded to make repeated remarks about the age of the victims, describing the crash as "an academy clear-out" and saying:

"They always say you've got to blood the youngsters. Maybe not like that."

Police summaries confirm that Johnson continued to reference the explosion itself, using imagery of debris and wreckage while framing the incident as "a lesson in away travel safety."

At one point, he mocked the prospect of the next day's fixture.

"Under-12s tomorrow," he said. "Only Pompey team in years where the average height actually helped them clear the barrier."

Audience members reportedly shouted for Johnson to stop. He responded:

"Relax. They weren't even old enough to know they supported Portsmouth."

Several people walked out at this stage.

Johnson then turned his attention to the parents of the victims, referring to Portsmouth's reputation as a community-focused club.

"Family club, aren't they? That's one way to bring the parents together."

A line referencing "free scarves for the funerals" prompted venue staff to move closer to the stage.

Johnson closed the routine by returning to the bridge itself.

"That bus went over the edge quicker than any safeguarding policy in football."

Boos drowned out the final seconds of the set as the microphone was cut. Johnson was detained shortly afterward.

Hampshire Police confirmed Johnson was arrested on suspicion of outraging public decency and public order offences.

"The material involved sustained mockery of a fatal incident involving children," a spokesperson said. "The nature of the remarks and the refusal to desist after clarification are central to the investigation."

Leaked Transcript Shows Shafty Doubling Down After Learning Victims Were Children

A leaked transcript compiled from audience recordings captures Johnson's remarks as the truth emerged mid-performance.

"Whole bus gone. Efficient."
"What? Kids?"
"Well that's grassroots football."
"Academy lads always say they'll die for the badge."
"That's what happens when you skip defensive drills."
"Under-12s tomorrow — finally explains the lack of control."
"Parents are fuming? They'll get over it."
"Plenty more kids where they came from."
"That's football. Start young, finish early."

The transcript ends as shouting overwhelms the recording and security intervene.

Portsmouth FC declined to comment directly but described the routine, through intermediaries, as "beyond contempt." Several comedy venues announced immediate cancellations of Johnson's upcoming appearances, citing safeguarding concerns.

Johnson has not apologised. When approached by reporters, he reportedly said:

"I don't change material for the audience."

Legal experts say the involvement of child victims significantly increases the likelihood of custodial sentencing if charges proceed.

For a performer whose career has depended on testing whether there are any remaining lines, last night may have provided the answer.`;

      if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
        const story = {
          section: 'politics',
          headline: newsHeadline,
          writer: getNextWriter(),
          body: newsBody,
          effects: { reputation: -5 }
        };
        log('');
        log('📰 A shocking story has broken in the news about a comedian\'s arrest.');
        await showNewsArticle(story);
        
        // Apply effects
        if (story.effects.reputation) {
          S.reputation = clamp((S.reputation || 50) + story.effects.reputation, 0, 100);
        }
      } else if (S.press) {
        // Fallback: add to queue directly
        if (!S.press.queue) S.press.queue = [];
        S.press.queue.push({
          id: 'shafty_rod_johnson_under12s_arrest',
          section: 'politics',
          headline: 'Shafty Rod Johnson Arrested After Routine Mocking Portsmouth Bus Explosion — Even After It Emerged Victims Were Under-12 Players',
          body: `SPECIAL REPORT — SOUTH COAST DERBY AFTERMATH
Shafty Rod Johnson Arrested After Routine Mocking Portsmouth Bus Explosion — Even After It Emerged Victims Were Under-12 Players

By Staff Reporter | Southampton

Stand-up comedian Shafty Rod Johnson has been arrested following a routine that police say crossed "an unprecedented moral and legal threshold" after he mocked the Portsmouth FC bus explosion — and continued after it became clear that those killed were members of the club's under-12s squad.

The performance took place on the night it was confirmed that, with the senior Portsmouth squad unavailable, a junior team had been travelling in advance of the South Coast derby when their bus crashed off the Itchen Bridge and exploded.

According to witnesses, Johnson opened his set under the apparent assumption that first-team players had been killed.

"Portsmouth finally went down together," he said. "That's teamwork."

As details of the victims began circulating inside the venue, several audience members can be heard shouting that the bus had been carrying children. Rather than stopping, Johnson addressed the revelation directly.

"Under-12s?" he replied. "Ah. Youth development finally paying dividends."

Gasps were audible across the room.

Johnson proceeded to make repeated remarks about the age of the victims, describing the crash as "an academy clear-out" and saying:

"They always say you've got to blood the youngsters. Maybe not like that."

Police summaries confirm that Johnson continued to reference the explosion itself, using imagery of debris and wreckage while framing the incident as "a lesson in away travel safety."

At one point, he mocked the prospect of the next day's fixture.

"Under-12s tomorrow," he said. "Only Pompey team in years where the average height actually helped them clear the barrier."

Audience members reportedly shouted for Johnson to stop. He responded:

"Relax. They weren't even old enough to know they supported Portsmouth."

Several people walked out at this stage.

Johnson then turned his attention to the parents of the victims, referring to Portsmouth's reputation as a community-focused club.

"Family club, aren't they? That's one way to bring the parents together."

A line referencing "free scarves for the funerals" prompted venue staff to move closer to the stage.

Johnson closed the routine by returning to the bridge itself.

"That bus went over the edge quicker than any safeguarding policy in football."

Boos drowned out the final seconds of the set as the microphone was cut. Johnson was detained shortly afterward.

Hampshire Police confirmed Johnson was arrested on suspicion of outraging public decency and public order offences.

"The material involved sustained mockery of a fatal incident involving children," a spokesperson said. "The nature of the remarks and the refusal to desist after clarification are central to the investigation."

Leaked Transcript Shows Shafty Doubling Down After Learning Victims Were Children

A leaked transcript compiled from audience recordings captures Johnson's remarks as the truth emerged mid-performance.

"Whole bus gone. Efficient."
"What? Kids?"
"Well that's grassroots football."
"Academy lads always say they'll die for the badge."
"That's what happens when you skip defensive drills."
"Under-12s tomorrow — finally explains the lack of control."
"Parents are fuming? They'll get over it."
"Plenty more kids where they came from."
"That's football. Start young, finish early."

The transcript ends as shouting overwhelms the recording and security intervene.

Portsmouth FC declined to comment directly but described the routine, through intermediaries, as "beyond contempt." Several comedy venues announced immediate cancellations of Johnson's upcoming appearances, citing safeguarding concerns.

Johnson has not apologised. When approached by reporters, he reportedly said:

"I don't change material for the audience."

Legal experts say the involvement of child victims significantly increases the likelihood of custodial sentencing if charges proceed.

For a performer whose career has depended on testing whether there are any remaining lines, last night may have provided the answer.`,
          effects: { reputation: -5 },
          created: Date.now(),
          publishAfter: Date.now()
        });
        S.news_unread = true;
        log('');
        log('📰 A shocking story has broken in the news about a comedian\'s arrest. Check the newspaper to read the full report!');
      }
      
      await waitAdvance("Gloating", "You bask in the glory...");
      
      log('');
      
      // Delmor gloating text
      const delmorGloatTexts = [
        "HAHAHAHAHA! You absolute moron! That was a DECOY TEAM on that bus! They're the ones who died, not my real players! My actual team is safe and sound, and we're coming at you at FULL FITNESS tomorrow! You've accomplished NOTHING! 😂😂😂",
        "You think you're clever? That bus was full of DECOYS! My real team is perfectly fine and ready to destroy you tomorrow! You just killed a bunch of nobodies! What a waste of a brick! 😂😂😂",
        "Nice try, you idiot! That was a DECOY TEAM! My actual players are safe and we're at full strength for tomorrow's match! You've just made yourself look like a complete fool! 😂😂😂"
      ];
      
      const gloatText = delmorGloatTexts[Math.floor(Math.random() * delmorGloatTexts.length)];
      
      // Always log the message to ensure it shows in the log
      log(`📱 Delmor Krunchem: "${gloatText}"`);
      
      // Also queue it if the function exists (for text message UI)
      if (typeof queueIncomingText === 'function') {
        queueIncomingText('delmor_krunchem', gloatText, 'malicious');
      } else {
        // Fallback: ensure the message is logged even if queueIncomingText doesn't exist
        log(`📱 Delmor Krunchem: "${gloatText}"`);
      }
      
      await waitAdvance("Delmor's Gloating", "He got you...");
      
      log('');
      log('You play the next match with Portsmouth at full fitness.');
      
      // Remove brick from inventory
      if (typeof window.removeItem === 'function') {
        window.removeItem('Brick', 1);
      } else if (S.inventory && Array.isArray(S.inventory.items)) {
        const brickIndex = S.inventory.items.findIndex(item => item.name === 'Brick');
        if (brickIndex >= 0) {
          S.inventory.items.splice(brickIndex, 1);
        }
      }
      
      // Don't set under-12s team flag - Portsmouth plays at full fitness
      // Reset any previous bus destroyed flags for this scenario
      S.portsmouth_bus_destroyed = false;
      S.portsmouth_under12s_team = false;
      
      log('');
      log('You return home, feeling slightly deflated. Tomorrow\'s match will be... challenging.');
      await waitAdvance("Home", "The night passes...");
    }
    // Third+ throw: This should never happen as the option is removed after 2 throws
    // But if it somehow does, just prevent it gracefully
    else {
      log('');
      log('You reach for your brick, but something stops you. You\'ve already thrown it twice - maybe that\'s enough.');
      log('You decide against throwing another brick and just watch the bus pass by.');
      await waitAdvance("Home", "The night passes...");
      
      await waitAdvance("Recovery", "You begin your hospital stay...");
    }
  }
  
  // Generate Portsmouth under-12s team
  function generatePortsmouthUnder12sTeam() {
    if (!S._opponentSquads) S._opponentSquads = [];
    const matchIndex = S.matches_played || 0;
    
    const under12Names = [
      'Liam Smith', 'Oliver Jones', 'Ethan Brown', 'Noah Williams', 'Jack Taylor',
      'Charlie Davies', 'Harry Wilson', 'George Evans', 'Thomas Roberts', 'James White',
      'William Green', 'Daniel Harris', 'Matthew Clark', 'Joseph Lewis', 'Samuel Walker'
    ];
    
    const team = [];
    for (let i = 0; i < 11; i++) {
      const name = under12Names[i] || `Portsmouth U12 Player ${i + 1}`;
      team.push({
        name: name,
        rating: 3, // Very low rating
        position: ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'][i] || 'MID',
        age: 11
      });
    }
    
    S._opponentSquads[matchIndex] = team;
    S.portsmouth_under12s_squad = team;
  }
  
  // Press conference after bus crash
  async function handlePressConferenceAfterBusCrash() {
    log('');
    log('📰 The press swarms you for a comment on the tragic accident...');
    
    const quoteOptions = [
      {key: 'cynical', label: 'Cynical: "Tragic, but these things happen. Ultimately it is good for us when our competitors die, as there are fewer people to compete with"', variant: ''},
      {key: 'gloating', label: 'Gloating: "They should have been more careful! 😂"', variant: 'bad'},
      {key: 'mature', label: 'Mature: "Our thoughts are with the families. Football is secondary."', variant: 'good'},
      {key: 'conspiratorial', label: 'Conspiratorial: "Something doesn\'t add up here...notice how this happened on the same day as this recent shite with the government? They are trying to distract us"', variant: 'warn'}
    ];
    
    const quoteChoice = await choose(quoteOptions, "How do you respond to the press?");
    
    if (quoteChoice === 'gloating' || quoteChoice === 'cynical') {
      log('');
      log('📰 Your comments cause outrage across the football world.');
      await waitAdvance("Backlash", "The world reacts...");
      
      log('💰 BREAKING: Anonymous billionaire donates £500 million to Portsmouth FC!');
      log('⚽ BREAKING: Lionel Messi signs for Portsmouth FC as a free agent!');
      
      // Send Delmor text message
      const delmorMessage = "Thanks for the cash injection, you moron! Messi is ours now! 😂😂😂";
      if (typeof window.enqueueRivalText === 'function') {
        window.enqueueRivalText(delmorMessage);
      } else if (typeof sendRivalText === 'function') {
        sendRivalText(delmorMessage);
      } else {
        log(`📱 Delmor Krunchem: "${delmorMessage}"`);
      }
      
      // Add Messi to Portsmouth
      if (!S._opponentSquads) S._opponentSquads = [];
      const matchIndex = S.matches_played || 0;
      if (!S._opponentSquads[matchIndex]) {
        generatePortsmouthUnder12sTeam();
      }
      // Replace one player with Messi
      if (S._opponentSquads[matchIndex] && S._opponentSquads[matchIndex].length > 0) {
        S._opponentSquads[matchIndex][0] = {
          name: 'Lionel Messi',
          rating: 99,
          position: 'FWD',
          age: 36
        };
      }
      
      S.portsmouth_messi_signed = true;
      S.portsmouth_cash_injection = true;
      
      // Keir Starmer grants sympathy points to Portsmouth (only for gloating, not cynical)
      if (quoteChoice === 'gloating') {
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof ensureTableTeam === 'function') {
          ensureTableTeam('Portsmouth');
        }
        if (S.table && S.table['Portsmouth']) {
          S.table['Portsmouth'].PTS = (S.table['Portsmouth'].PTS || 0) + 5;
          log('📰 BREAKING: Keir Starmer announces he is granting Portsmouth 5 "sympathy points" in response to your gloating comments.');
          log('📊 Portsmouth FC: +5 points (sympathy points from Keir Starmer)');
          // Update league table display if function exists
          if (typeof renderLeagueTablePanel === 'function') {
            renderLeagueTablePanel();
          }
        }
      }
      
      // Now you get arrested
      await waitAdvance("Arrest", "The police arrive...");
      await handleMurderArrest();
    } else if (quoteChoice === 'mature') {
      log('Your mature response is well-received. The press respects your dignity.');
      // Still get arrested but with better outcome
      await waitAdvance("Arrest", "The police arrive...");
      await handleMurderArrest();
    } else {
      log('Your conspiratorial comments raise eyebrows, but nothing major happens.');
      await waitAdvance("Arrest", "The police arrive...");
      await handleMurderArrest();
    }
  }
  
  // Handle murder arrest
  async function handleMurderArrest() {
    log('');
    log('🚨 POLICE ARREST: You are arrested on suspicion of murder. The brick throw was caught on CCTV.');
    
    // Use the same popup system as other arrests
    if (typeof startInvestigationPopup === 'function') {
      await startInvestigationPopup({
        authority: 'police',
        caseType: 'Murder - Bus crash'
      });
    } else if (typeof interviewPolice === 'function') {
      // Use existing police interview system
      interviewPolice('Murder - Bus crash');
    } else {
      // Fallback to basic arrest
      const guiltyChoice = await choose([
        {key: 'guilty', label: 'Plead guilty (5 game prison sentence)', variant: 'warn'},
        {key: 'not_guilty', label: 'Plead not guilty', variant: ''},
        {key: 'bribe', label: 'Attempt to bribe the police', variant: 'bad'},
        {key: 'diagnostic', label: 'Show diagnostic certificate (if you have one)', variant: ''}
      ], "How do you respond to the murder charge?");
      
      if (guiltyChoice === 'guilty') {
        if (!S.suspensions) S.suspensions = {};
        S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 5;
        S.prison = true;
        log('You plead guilty. 5 game prison sentence.');
      } else if (guiltyChoice === 'bribe') {
        const bribeAmount = 200000 + Math.random() * 300000;
        const canPay = (S.chairman_cash || 0) >= bribeAmount || (S.club_cash || 0) >= bribeAmount;
        if (canPay && Math.random() < 0.3) {
          if ((S.chairman_cash || 0) >= bribeAmount) {
            S.chairman_cash -= bribeAmount;
          } else {
            S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
          }
          log(`You pay £${Math.round(bribeAmount).toLocaleString()} in bribes. The case disappears.`);
        } else {
          log('The bribe is rejected. You are found guilty.');
          if (!S.suspensions) S.suspensions = {};
          S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 5;
          S.prison = true;
        }
      } else if (guiltyChoice === 'diagnostic') {
        if (S.diagnostic_certificate) {
          log('You show your diagnostic certificate. The charges are reduced, but you still face consequences.');
          if (!S.suspensions) S.suspensions = {};
          S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 2;
        } else {
          log('You don\'t have a diagnostic certificate. The plea fails.');
          if (!S.suspensions) S.suspensions = {};
          S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 5;
          S.prison = true;
        }
      } else {
        // Not guilty
        if (Math.random() < 0.2) {
          log('You are found not guilty. The case is dismissed.');
        } else {
          log('You are found guilty despite your plea.');
          if (!S.suspensions) S.suspensions = {};
          S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 5;
          S.prison = true;
        }
      }
    }
  }
  
  // Handle drugs and fight
  async function handleDrugsAndFight(hasCocaine) {
    if (hasCocaine) {
      if (S.inventory && S.inventory.drugs) {
        S.inventory.drugs = Math.max(0, (S.inventory.drugs || 0) - 1);
      }
      log('You snort a line of cocaine. Adrenaline surges through your veins.');
    } else {
      if (S.doctor && S.doctor.hgh_stock) {
        S.doctor.hgh_stock = Math.max(0, (S.doctor.hgh_stock || 0) - 1);
      }
      log('You inject HGH. Your muscles surge with power.');
    }
    
    await waitAdvance("Drugs taken", "You feel invincible...");
    
    log('You gesture menacingly at the bus as it passes...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log('The Portsmouth team captain sees you and challenges you to a fight!');
    
    const fightChoice = await choose([
      {key: 'fight', label: 'Accept the challenge and fight', variant: 'warn'},
      {key: 'run', label: 'Run away', variant: ''}
    ], "The captain jumps off the bus and approaches you!");
    
    if (fightChoice === 'run') {
      log('You run away like a coward. The captain laughs and gets back on the bus.');
      return;
    }
    
    // Fight minigame
    const fightResult = await playFightMinigame();
    
    if (fightResult === 'win') {
      log('');
      log('💥 You deliver a devastating blow!');
      log('💀 The Portsmouth captain collapses. He is pronounced dead at the scene.');
      log('📰 BREAKING: Portsmouth captain dies in altercation. Team is devastated.');
      
      // Hobble Portsmouth team
      if (!S._opponentSquads) S._opponentSquads = [];
      const matchIndex = S.matches_played || 0;
      if (S._opponentSquads[matchIndex]) {
        // Reduce all player ratings significantly
        S._opponentSquads[matchIndex].forEach(player => {
          player.rating = Math.max(20, (player.rating || 50) - 30);
        });
      }
      
      S.portsmouth_captain_killed = true;
      S.portsmouth_team_hobbled = true;
      
      // Delmor text
      if (typeof queueIncomingText === 'function') {
        queueIncomingText('delmor_krunchem', 'YOU KILLED MY CAPTAIN. YOU\'RE A MURDERER. I WILL DESTROY YOU.', 'malicious');
      }
      
      await waitAdvance("Fight Won", "You return home...");
    } else {
      log('');
      // Captain gets a full disgust / football reaction before flooring you
      try {
        const captainLine = generateThreePartConversationLine('disgust', 'football', 'football');
        if (captainLine && captainLine !== "I have nothing to say.") {
          log(`Portsmouth captain: "${captainLine}"`);
        }
      } catch (e) {}
      log('💥 The captain knocks you out cold!');
      log('🏥 You wake up in hospital. The match has already been played.');
      log('📰 Southampton lose the match. You were in hospital and couldn\'t attend.');
      
      // Simulate loss
      if (!S.losses) S.losses = 0;
      S.losses++;
      S.matches_played = (S.matches_played || 0) + 1;
      S.morale = Math.max(-100, (S.morale || 0) - 10);
      
      S.portsmouth_fight_lost = true;
      S.in_hospital_for_match = true;
      
      await waitAdvance("Hospital", "You recover...");
    }
    
    // Game continues to pre-match phase naturally
  }
  
  // Fight minigame
  async function playFightMinigame() {
    log('');
    log('⚔️ FIGHT MINIGAME: Press the buttons as they appear!');
    
    let playerHealth = 100;
    let captainHealth = 100;
    let round = 0;
    const maxRounds = 10;
    
    while (playerHealth > 0 && captainHealth > 0 && round < maxRounds) {
      round++;
      log(`\nRound ${round}:`);
      log(`Your health: ${playerHealth}% | Captain health: ${captainHealth}%`);
      
      // Random button sequence
      const buttons = ['PUNCH', 'KICK', 'DODGE', 'BLOCK'];
      const requiredButton = buttons[Math.floor(Math.random() * buttons.length)];
      
      const buttonChoice = await choose([
        {key: 'punch', label: 'PUNCH', variant: 'bad'},
        {key: 'kick', label: 'KICK', variant: 'bad'},
        {key: 'dodge', label: 'DODGE', variant: ''},
        {key: 'block', label: 'BLOCK', variant: ''}
      ], `Quick! Press ${requiredButton}!`);
      
      const buttonMap = {punch: 'PUNCH', kick: 'KICK', dodge: 'DODGE', block: 'BLOCK'};
      const pressedButton = buttonMap[buttonChoice];
      
      if (pressedButton === requiredButton) {
        // Hit!
        const damage = 15 + Math.random() * 20;
        captainHealth -= damage;
        log(`✅ You hit! ${Math.round(damage)} damage!`);
      } else {
        // Miss or get hit
        if (Math.random() < 0.6) {
          const damage = 10 + Math.random() * 15;
          playerHealth -= damage;
          log(`❌ You missed! Captain hits you for ${Math.round(damage)} damage!`);
        } else {
          log(`⚠️ You dodged, but no damage dealt.`);
        }
      }
      
      // Captain's turn (automatic)
      if (captainHealth > 0 && Math.random() < 0.7) {
        const captainDamage = 8 + Math.random() * 12;
        playerHealth -= captainDamage;
        log(`👊 Captain hits you for ${Math.round(captainDamage)} damage!`);
      }
      
      // Small delay between rounds for readability
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log('');
    if (playerHealth <= 0) {
      log('💀 You are knocked out!');
    } else if (captainHealth <= 0) {
      log('💀 The captain is knocked out!');
    } else {
      log('⏱️ Time runs out!');
    }
    
    // Determine winner
    if (playerHealth > captainHealth) {
      return 'win';
    } else {
      return 'lose';
    }
  }
  
  // Handle mooning
  async function handleMooning() {
    log('');
    log('You drop your trousers and proudly show off your soft willy to the passing bus...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    log('🚨 POLICE ARREST: You are immediately arrested for indecent exposure!');
    
    await waitAdvance("Arrested", "The police cuff you...");
    
    // Use the same popup system as sexual harassment
    if (typeof startInvestigationPopup === 'function') {
      await startInvestigationPopup({
        authority: 'police',
        caseType: 'Indecent Exposure of penis'
      });
    } else if (typeof interviewPolice === 'function') {
      interviewPolice('Indecent Exposure');
    } else {
      // Fallback
      const exposureChoice = await choose([
        {key: 'guilty', label: 'Accept guilt', variant: 'warn'},
        {key: 'not_guilty', label: 'Plead not guilty', variant: ''},
        {key: 'bribe', label: 'Attempt to bribe', variant: 'bad'},
        {key: 'diagnostic', label: 'Show diagnostic certificate', variant: ''}
      ], "How do you respond to the indecent exposure charge?");
      
      if (exposureChoice === 'guilty' || (exposureChoice === 'not_guilty' && Math.random() < 0.7)) {
        // Sex offender register
        const registerGames = 3 + Math.floor(Math.random() * 5); // 3-7 games
        if (!S.sex_offender_register) S.sex_offender_register = {};
        S.sex_offender_register.active = true;
        S.sex_offender_register.games_remaining = registerGames;
        
        log(`You are found guilty. You must sign the sex offenders register for ${registerGames} games.`);
        
        // Apply consequences
        applySexOffenderConsequences();
      } else if (exposureChoice === 'bribe') {
        const bribeAmount = 50000 + Math.random() * 50000;
        const canPay = (S.chairman_cash || 0) >= bribeAmount || (S.club_cash || 0) >= bribeAmount;
        if (canPay && Math.random() < 0.4) {
          if ((S.chairman_cash || 0) >= bribeAmount) {
            S.chairman_cash -= bribeAmount;
          } else {
            S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
          }
          log(`You pay £${Math.round(bribeAmount).toLocaleString()}. The case is dropped.`);
        } else {
          log('Bribe rejected. You are found guilty.');
          const registerGames = 3 + Math.floor(Math.random() * 5);
          if (!S.sex_offender_register) S.sex_offender_register = {};
          S.sex_offender_register.active = true;
          S.sex_offender_register.games_remaining = registerGames;
          applySexOffenderConsequences();
        }
      } else if (exposureChoice === 'diagnostic') {
        if (S.diagnostic_certificate) {
          log('Diagnostic certificate accepted. Charges reduced, but you still face consequences.');
          const registerGames = 1 + Math.floor(Math.random() * 3);
          if (!S.sex_offender_register) S.sex_offender_register = {};
          S.sex_offender_register.active = true;
          S.sex_offender_register.games_remaining = registerGames;
          applySexOffenderConsequences();
        } else {
          log('No diagnostic certificate. You are found guilty.');
          const registerGames = 3 + Math.floor(Math.random() * 5);
          if (!S.sex_offender_register) S.sex_offender_register = {};
          S.sex_offender_register.active = true;
          S.sex_offender_register.games_remaining = registerGames;
          applySexOffenderConsequences();
        }
      }
    }
    
    // After the legal process, always flow back towards the match
    try {
      // Give the player a clear "continue" step back into the main loop,
      // mirroring the other Portsmouth prank paths.
      await waitAdvance(
        "Released",
        "You sign the necessary paperwork and are released. The night passes and you eventually make it home, trying not to think about tomorrow's match..."
      );
    } catch (_e) {
      // If waitAdvance fails for any reason, we still want the main loop to continue
    }
  }
  
  // Apply sex offender register consequences
  function applySexOffenderConsequences() {
    if (!S) return;
    
    // Ensure the newer sex_offender_register state exists and is active
    if (!S.sex_offender_register) S.sex_offender_register = {};
    if (typeof S.sex_offender_register.active !== 'boolean') {
      S.sex_offender_register.active = true;
    }
    
    // If no duration set yet, fall back to any existing KRAZY games, or a fresh 3‑7 match range
    if (typeof S.sex_offender_register.games_remaining !== 'number' || S.sex_offender_register.games_remaining <= 0) {
      const fallbackGames =
        (typeof S.krazyGamesRemaining === 'number' && S.krazyGamesRemaining > 0)
          ? S.krazyGamesRemaining
          : 3 + Math.floor(Math.random() * 5); // 3‑7 games
      S.sex_offender_register.games_remaining = fallbackGames;
    }
    
    // Mirror onto legacy KRAZY register flags so existing systems (chants, nightclub, HUD tag)
    // treat all sex offender routes the same way.
    if (!S.onKrazyRegister) {
      S.onKrazyRegister = true;
    }
    if (typeof S.krazyGamesRemaining !== 'number' || S.krazyGamesRemaining < S.sex_offender_register.games_remaining) {
      S.krazyGamesRemaining = S.sex_offender_register.games_remaining;
    }
    
    log('');
    log('📰 NEWS: Chairman placed on sex offenders register. Outrage across football.');
    
    // Players quit
    if (S.squad && Array.isArray(S.squad)) {
      const quitCount = Math.min(2, Math.floor(S.squad.length * 0.2));
      for (let i = 0; i < quitCount; i++) {
        if (S.squad.length > 0) {
          const quitPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
          log(`🚪 ${quitPlayer.name || 'A player'} quits: "I can't play for a pedo."`);
          S.squad = S.squad.filter(p => p !== quitPlayer);
        }
      }
    }
    
    // Delmor text
    const delmorPedoTexts = [
      "You’re a sick fuck. A pedo. Everyone knows it now. You’re finished.",
      "Enjoy the register, you paedophile. Whole league’s laughing at you and your deformed penis.",
      "You show off your circumsized cock to a bus and end up a registered pedo. Couldn’t script it. Paedophile chairman FC.",
      "Every paper’s calling you a paedophile and I’m framing the back pages. This is the funniest day of my life."
    ];
    if (typeof queueIncomingText === 'function') {
      queueIncomingText('delmor_krunchem', pick(delmorPedoTexts), 'malicious');
    }
    
    // Mark for match consequences
    S.sex_offender_match_consequences = true;
    
    // Morale hit
    S.morale = Math.max(-100, (S.morale || 0) - 15);
    S.reputation = Math.max(0, (S.reputation || 0) - 20);
  }
  
  // Expose consequence helper globally so other systems (e.g. investigation popups)
  // can trigger the exact same effects without duplicating logic.
  if (typeof window !== 'undefined') {
    window.applySexOffenderConsequences = applySexOffenderConsequences;
  }
  
  // Check sex offender consequences during match
  function checkSexOffenderMatchConsequences() {
    if (!S.sex_offender_register || !S.sex_offender_register.active) return;
    
    // Reduce games remaining
    if (S.sex_offender_register.games_remaining > 0) {
      S.sex_offender_register.games_remaining--;
      
      if (S.sex_offender_register.games_remaining <= 0) {
        S.sex_offender_register.active = false;
        log('✅ You are removed from the sex offenders register.');
        return;
      }
    }
    
    // Apply match consequences
    const currentOpp = (typeof currentOpponent === 'function') ? currentOpponent() : 
                       (S.matchContext || { team: S.opponents && S.opponents[S.matches_played || 0] });
    if (currentOpp && currentOpp.team && currentOpp.team.toLowerCase().includes('portsmouth')) {
      log('💦 Portsmouth fans pelt you with urine as you enter the stadium!');
      log('⚽ The referee gives dubious penalties to Portsmouth. "I hate pedos," he mutters.');
      log('🎶 The away end chants: "YOU\'RE A PAEDO, YOU KNOW YOU ARE!" every time your face appears on the big screen.');
      log('📣 Home and away fans alike mock you as a pedo chairman; the commentary box can barely keep a straight face describing the abuse.');
      
      // Reduce team strength for this match
      if (S.preMatch) {
        S.preMatch.oppStrength = (S.preMatch.oppStrength || 50) + 15;
        S.preMatch.ourStrength = Math.max(10, (S.preMatch.ourStrength || 50) - 10);
      }
    }
  }
  
  // After pre-match: sex offender register consequences
  GameHooks.on('prematch:end', function() { checkSexOffenderMatchConsequences(); });
  
  // Reset flag after match
  GameHooks.on('postmatch:end', function() {
      if (S.portsmouth_special_event_triggered) {
        // Reset for next time
        const nextMatchIndex = (S.matches_played || 0);
        const nextOpponent = S.opponents && S.opponents[nextMatchIndex];
        if (!nextOpponent || !nextOpponent.toLowerCase().includes('portsmouth')) {
          S.portsmouth_special_event_triggered = false;
        }
      }
  });
 
  // Expose functions needed by the global game loop
  // `eveningPhase` calls `checkPortsmouthSpecialEvent` directly, and
  // post‑match logic looks up the bus‑crash press conference handler on `window`.
  window.checkPortsmouthSpecialEvent = checkPortsmouthSpecialEvent;
  window.handlePressConferenceAfterBusCrash = handlePressConferenceAfterBusCrash;
  
// Initialize distortion system on load
(function initDistortionSystem() {
  // Apply UI distortion immediately if active
  if (typeof applyUIDistortion === 'function') {
    applyUIDistortion();
  }
  
  // Periodically check and apply UI distortion (in case state changes)
  setInterval(() => {
    if (typeof applyUIDistortion === 'function') {
      applyUIDistortion();
    }
  }, 1000); // Check every second
})();

})();