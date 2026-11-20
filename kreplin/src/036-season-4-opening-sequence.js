// ========== SEASON 4 OPENING SEQUENCE ==========
async function runSeason4Opener() {
  // Initialize Season 4 state if missing
  if (!S.season4) S.season4 = {};
  
  // Map input flags with fallbacks
  const player_coma_between_seasons = (S.season3 && S.season3.player_coma_between_seasons) || false;
  const s3_hajj_absence = (S.season3 && S.season3.s3_hajj_absence) || false;
  const wife_exists = (S.wife_name || S.family) ? true : false;
  const secretary_exists = (S.secretary_name || S.secretary_hired) ? true : false;
  const secretary_in_prison = (S.season3 && S.season3.secretary_in_prison) || false;
  const poly_with_secretary_active_in_s3 = (S.season3 && S.season3.secretary_relationship_opened_to_player) || false;
  const framed_son = (S.season3 && S.season3.son_framed_for_murder) || false;
  const gazza_in_prison = (S.season3 && S.season3.gaz_reported) || false;
  const son_exists = (S.season3 && S.season3.son_hired_as_scout) ? true : false;
  const has_child_with_secretary = (S.season3 && S.season3.secretary_affair_active && S.child1_name) ? true : false;
  const secretary_child_names = (has_child_with_secretary && S.child1_name) ? [S.child1_name] : [];
  const wife_name = S.wife_name || 'Wife';
  const secretary_name = S.secretary_name || 'Secretary';
  const son_name = (S.season3 && S.season3.son_name) || (S.child1_name ? S.child1_name.split(' ')[0] : '') || 'Son';
  const chairman_cash = S.chairman_cash || 0;
  const krunchem_family_murdered = (S.season3 && S.season3.krunchem_family_murdered) || false;
  const secretary_framed = (S.season3 && S.season3.secretary_framed) || false;
  
  // (1) Determine ABSENCE_REASON
  let ABSENCE_REASON;
  if (player_coma_between_seasons) {
    ABSENCE_REASON = 'COMA';
  } else if (s3_hajj_absence) {
    ABSENCE_REASON = 'HAJJ';
  } else {
    ABSENCE_REASON = 'GENERIC_ABSENCE';
  }
  
  // (2) Opening Log Entry / Scene
  log(``);
  log(`<strong style="font-size: 1.2em; color: #6366f1;">━━━ SEASON 4 ━━━</strong>`);
  log(``);
  
  if (ABSENCE_REASON === 'COMA') {
    log(`You wake up.`);
    log(`You stagger home.`);
  } else {
    log(`You return after months away.`);
    if (ABSENCE_REASON === 'HAJJ') {
      log(`The Hajj was mandatory. The alternative was execution.`);
    }
  }
  
  // (3) Arrive Home
  log(`The house is empty.`);
  log(``);
  
  // (4) Auto-open phone text popup to Wife
  if (wife_exists) {
    const wifeName = wife_name;
    const overlay = createPhoneTextPopup(wifeName, 'Online');
    const msg = phoneMessagesContainer;
    
    // Player sends: "Where are you?"
    await new Promise(resolve => setTimeout(resolve, 500));
    addMessageToPhonePopup("Where are you?", true, 0);
    
    // Wife replies with branch-specific message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let wifeMessages = [];
    if (ABSENCE_REASON === 'COMA') {
      wifeMessages = [
        "I'm sorry. You were gone for so long… and I needed money.",
        "Delmor was a shoulder to cry on, and he's been going through so much.",
        "He's a good man. He really is.",
        "He has a lot of money.",
        "I arranged our divorce while you were in a coma.",
        "I need half of your money."
      ];
    } else if (ABSENCE_REASON === 'HAJJ') {
      // Determine polyamorous relationship message based on Season 3 choices
      let polyMessage = "";
      
      if (!krunchem_family_murdered) {
        // Didn't kill Delmor's family: wife says she's in a polyamorous relationship with Delmor and his wife
        if (gazza_in_prison && son_exists) {
          // If Gazza in prison AND didn't kill family: Delmor's wife, your secretary, and your son
          polyMessage = `Also… I'm in a polyamorous relationship with Delmor, his wife, ${secretary_name}, and ${son_name}.`;
        } else {
          // Just Delmor and his wife
          polyMessage = "Also… I'm in a polyamorous relationship with Delmor and his wife.";
        }
      } else {
        // Killed Delmor's family: wife says she's in a polyamorous relationship with Delmor and your secretary (but ONLY if you didn't frame your secretary)
        if (!secretary_framed) {
          if (gazza_in_prison && son_exists) {
            // If Gazza in prison AND killed family AND didn't frame secretary: Delmor, your secretary, and your son
            polyMessage = `Also… I'm in a polyamorous relationship with Delmor, ${secretary_name}, and ${son_name}.`;
          } else {
            // Just Delmor and your secretary
            polyMessage = `Also… I'm in a polyamorous relationship with Delmor and ${secretary_name}.`;
          }
        } else {
          // Framed secretary, so no mention of polyamorous relationship with secretary
          if (gazza_in_prison && son_exists) {
            polyMessage = `Also… I'm in a polyamorous relationship with Delmor and ${son_name}.`;
          } else {
            // No polyamorous relationship mentioned if secretary was framed and family was killed
            polyMessage = "";
          }
        }
      }
      
      wifeMessages = [
        "I'm sorry. You were gone for so long… and I needed money.",
        "Delmor was a shoulder to cry on.",
        "He's been going through so much.",
        "I arranged our divorce while you were away."
      ];
      
      if (polyMessage) {
        wifeMessages.push(polyMessage);
        if (!krunchem_family_murdered) {
          wifeMessages.push("I'm helping to raise his kids.");
        }
      }
      
      wifeMessages.push("I need half of your money.");
    } else { // GENERIC_ABSENCE
      wifeMessages = [
        "I'm sorry. You were gone for so long… and I needed money.",
        "Delmor was a shoulder to cry on, and he's been going through so much.",
        "He's a good man. He really is.",
        "He has a lot of money.",
        "I arranged our divorce while you were away.",
        "I need half of your money."
      ];
    }
    
    for (let i = 0; i < wifeMessages.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      addMessageToPhonePopup(wifeMessages[i], false, 0);
    }
    
    // (5) Apply financial consequence
    await new Promise(resolve => setTimeout(resolve, 2000));
    const halfCash = Math.floor(chairman_cash * 0.5);
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - halfCash);
    S.season4.wife_took_half_money = true;
    log(`A transfer clears. Half your money is gone.`);
    
    // (6) Present reply options (standard categories) that do not change outcome
    await new Promise(resolve => setTimeout(resolve, 1000));
    const choice = document.getElementById('phone-choice-container');
    if (choice) {
      choice.style.display = 'flex';
      choice.style.flexDirection = 'column';
      choice.style.gap = '6px';
      choice.innerHTML = '';
      
      // Create a promise that resolves when a button is clicked
      let buttonClicked = false;
      const waitForButtonClick = new Promise(resolve => {
        const replyOptions = [
          { key: 'beg', label: 'Beg / Plead', class: '' },
          { key: 'rage', label: 'Rage', class: 'bad' },
          { key: 'bargain', label: 'Bargain', class: '' },
          { key: 'cold', label: 'Cold / Legal', class: '' },
          { key: 'pity', label: 'Humiliating Self-Pity', class: 'warn' },
          { key: 'inappropriate', label: 'Send an inappropriate picture', class: 'sex' }
        ];
        
        for (const option of replyOptions) {
          const btn = document.createElement('button');
          btn.className = option.class ? `btn-primary ${option.class}` : 'btn-primary';
          btn.textContent = option.label;
          btn.onclick = async () => {
            if (buttonClicked) return;
            buttonClicked = true;
            
            // Player sends the reply
            let replyText = '';
            switch(option.key) {
              case 'beg':
                replyText = "Please, we can work this out. Don't do this.";
                break;
              case 'rage':
                replyText = "You're making a huge mistake! This is betrayal!";
                break;
              case 'bargain':
                replyText = "Let's talk. I can give you more than half. Just come back.";
                break;
              case 'cold':
                replyText = "I'll see you in court. This isn't over.";
                break;
              case 'pity':
                replyText = "I'm nothing without you. Please don't leave me.";
                break;
              case 'inappropriate':
                // Track inappropriate images sent for certificate
                if (!S.playerStats) S.playerStats = {};
                S.playerStats.inappropriateImagesSent = (S.playerStats.inappropriateImagesSent || 0) + 1;
                // Show actual inappropriate picture like in normal texts
                const inappropriatePics = ATTACHMENTS.inappropriate || [];
                if (inappropriatePics.length > 0) {
                  const selectedPic = inappropriatePics[Math.floor(Math.random() * inappropriatePics.length)];
                  replyText = selectedPic;
                } else {
                  replyText = "[Inappropriate picture sent]";
                }
                break;
            }
            
            addMessageToPhonePopup(replyText, true, 0);
            
            // Wife responds with flat line (no outcome change)
            await new Promise(resolve => setTimeout(resolve, 1500));
            const flatResponses = ["This is final.", "Please don't.", "I'm not discussing this."];
            const flatResponse = flatResponses[Math.floor(Math.random() * flatResponses.length)];
            addMessageToPhonePopup(flatResponse, false, 0);
            
            // Close popup automatically after delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            closePhoneTextPopup();
            resolve();
          };
          choice.appendChild(btn);
        }
      });
      
      // Wait for player to click a button
      await waitForButtonClick;
    }
  }
  
  // (7) Wife aftermath log
  log(`No appeal process is available.`);
  log(``);
  
  // (8) Conditional: Text Secretary
  const shouldTextSecretary = secretary_exists && !secretary_in_prison && (poly_with_secretary_active_in_s3 || framed_son);
  
  if (shouldTextSecretary) {
    const textChoice = await choose([
      { key: 'text', label: `Text ${secretary_name}` },
      { key: 'dont', label: "Don't text her" }
    ], `You consider texting ${secretary_name}.`);
    
    if (textChoice === 'text') {
      // (9) Secretary phone text conversation
      const overlay = createPhoneTextPopup(secretary_name, 'Online');
      const msg = phoneMessagesContainer;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      addMessageToPhonePopup("Where are you?", true, 0);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Secretary core text
      addMessageToPhonePopup("I need to be honest: your absence violated polyamory.", false, 0);
      await new Promise(resolve => setTimeout(resolve, 1500));
      addMessageToPhonePopup("You disappeared for months, and that created a rupture in the container.", false, 0);
      await new Promise(resolve => setTimeout(resolve, 1500));
      addMessageToPhonePopup("Delmor Krunchem helped me heal the trauma I suffered from your narcissistic abuse.", false, 0);
      await new Promise(resolve => setTimeout(resolve, 1500));
      addMessageToPhonePopup("I'm now in a polyamorous relationship with Delmor Krunchem and your wife.", false, 0);
      
      // Add variation based on gazza_in_prison
      if (gazza_in_prison && son_exists) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        addMessageToPhonePopup(`It's also… me, Delmor, your wife, and ${son_name}.`, false, 0);
      }
      
      // Add children detail if applicable
      if (has_child_with_secretary) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        addMessageToPhonePopup("I told Delmor about the kids.", false, 0);
        await new Promise(resolve => setTimeout(resolve, 1500));
        addMessageToPhonePopup("He's stepped up as their father.", false, 0);
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (secretary_child_names.length > 0) {
          const namesText = secretary_child_names.join(', ');
          addMessageToPhonePopup(`Their names are: ${namesText}.`, false, 0);
        } else {
          addMessageToPhonePopup("Their names are: (names withheld).", false, 0);
        }
      }
      
      // (10) Secretary reply options (same standard categories; no outcomes)
      await new Promise(resolve => setTimeout(resolve, 2000));
      const choice = document.getElementById('phone-choice-container');
      if (choice) {
        choice.style.display = 'flex';
        choice.style.flexDirection = 'column';
        choice.style.gap = '6px';
        choice.innerHTML = '';
        
        // Create a promise that resolves when a button is clicked
        let buttonClicked = false;
        const waitForButtonClick = new Promise(resolve => {
          const secretaryReplyOptions = [
            { key: 'apologize', label: 'Apologize / "Do the work"', class: '' },
            { key: 'accuse', label: 'Accuse / Rage', class: 'bad' },
            { key: 'beg', label: 'Beg', class: '' },
            { key: 'legal', label: 'Legal threat', class: '' },
            { key: 'flirt', label: 'Flirt', class: 'sensual' },
            { key: 'inappropriate', label: 'Inappropriate picture', class: 'sex' }
          ];
          
          for (const option of secretaryReplyOptions) {
            const btn = document.createElement('button');
            btn.className = option.class ? `btn-primary ${option.class}` : 'btn-primary';
            btn.textContent = option.label;
            btn.onclick = async () => {
              if (buttonClicked) return;
              buttonClicked = true;
              
              // Player sends reply (flavor only)
              let replyText = '';
              switch(option.key) {
                case 'apologize':
                  replyText = "I'm sorry. I'll do the work. Let's fix this.";
                  break;
                case 'accuse':
                  replyText = "You're the one who violated our relationship! This is your fault!";
                  break;
                case 'beg':
                  replyText = "Please, come back. I need you.";
                  break;
                case 'legal':
                  replyText = "I'll sue you for breach of contract. This isn't legal.";
                  break;
                case 'flirt':
                  replyText = "You know we had something special. Don't throw it away.";
                  break;
                case 'inappropriate':
                  // Track inappropriate images sent for certificate
                  if (!S.playerStats) S.playerStats = {};
                  S.playerStats.inappropriateImagesSent = (S.playerStats.inappropriateImagesSent || 0) + 1;
                  // Show actual inappropriate picture like in normal texts
                  const inappropriatePics2 = ATTACHMENTS.inappropriate || [];
                  if (inappropriatePics2.length > 0) {
                    const selectedPic2 = inappropriatePics2[Math.floor(Math.random() * inappropriatePics2.length)];
                    replyText = selectedPic2;
                  } else {
                    replyText = "[Inappropriate picture sent]";
                  }
                  break;
              }
              
              addMessageToPhonePopup(replyText, true, 0);
              
              // Secretary responds (no outcome change)
              await new Promise(resolve => setTimeout(resolve, 1500));
              addMessageToPhonePopup("I'm setting a boundary.", false, 0);
              await new Promise(resolve => setTimeout(resolve, 1500));
              addMessageToPhonePopup("Please don't contact me again unless it's administrative.", false, 0);
              
              // Close popup automatically
              await new Promise(resolve => setTimeout(resolve, 2000));
              closePhoneTextPopup();
              resolve();
            };
            choice.appendChild(btn);
          }
        });
        
        // Wait for player to click a button
        await waitForButtonClick;
      }
    }
  }
  
  // (11) Van Onslaught menace injection
  log(``);
  log(`<strong>📡 League Broadcast:</strong>`);
  if (ABSENCE_REASON === 'HAJJ') {
    log(`Mohammed Van Onslaught announces: "Football will be purified. Compliance will be rewarded. Non-compliance will be corrected."`);
    log(`"Remember: pilgrimage is not optional."`);
  } else {
    log(`Mohammed Van Onslaught announces: "Football will be purified. Compliance will be rewarded. Non-compliance will be corrected."`);
  }
  log(``);
  
  // (12) Final convergence state flags for Season 4
  S.season4.wife_left_for_delmor = wife_exists;   // read by the S4/S5 Delmor taunts
  S.season4.wife_took_half_money = !!S.season4.wife_took_half_money;
  S.season4.delmor_power_increasing = true;
  if (shouldTextSecretary) {
    S.season4.secretary_joined_delmor_polycule = true;
  } else {
    S.season4.secretary_joined_delmor_polycule = false;
  }
  
  log(`<em>Season 4 begins. The world has changed.</em>`);
  log(``);
}

// ========== ULTIMA CUP PRE-MATCH ==========
async function ultimaCupPreMatch() {
  // Mark that we're entering Ultima Cup
  if (!S.ultimaCup) S.ultimaCup = {};
  S.ultimaCup.advancedFromSeason5 = true; // Mark that we've advanced from season 5
  S.ultimaCup.preMatchComplete = false; // Will be set to true when ready to proceed
  
  // Initialize pre-match state
  if (!S.preMatch) S.preMatch = {};
  S.preMatch.ultimaCup = true; // Flag to indicate we're in Ultima Cup pre-match
  
  // Reset pre-match flags
  preMatchResetFlags();
  S.visitors_handled = false;
  S.visited_ownLocker = false;
  S.visited_oppLocker = false;
  
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
  if (S.press && S.press.cooldowns) {
    S.press.cooldowns.politics = Math.max(0, S.press.cooldowns.politics - 1);
    S.press.cooldowns.sports = Math.max(0, S.press.cooldowns.sports - 1);
    S.press.cooldowns.gossip = Math.max(0, S.press.cooldowns.gossip - 1);
  }
  if (S.press && S.press.confrontationCooldown) {
    S.press.confrontationCooldown = Math.max(0, S.press.confrontationCooldown - 1);
  }
  
  // Initialize betting
  startPreMatchInitBetting();
  
  // Queue Paul Gascoigne estate executor visitor (only once)
  if (!S.ultimaCup.gascoigne_estate_visited) {
    if (!S.knock_queue) S.knock_queue = [];
    S.knock_queue.push({ type: 'gascoigne_estate' });
  }
  
  // Press interview system
  if (S.press_interview_queued) {
    await conductPressInterview();
  }
  
  // Fundraiser system
  await maybeShowFundraiserInPreMatch();
  
  // Weeklies / admin that must remain
  await callIf('maybePreMatchScenarios');
  await callIf('preMatchAdmin');
  await callIf('preMatchTeamTalk');
  
  // Skip intro sections if they were already shown in the modal
  if (!S.ultimaCup || !S.ultimaCup.introShownInModal) {
    // Show luxurious intro
    log(``);
    log(`<div style="text-align:center;padding:50px;background:linear-gradient(135deg,rgba(0,0,0,0.95),rgba(20,0,20,0.95));border:5px solid #FFD700;border-radius:25px;margin:40px 0;box-shadow:0 0 50px rgba(255,215,0,0.6);">
      <h1 style="font-size:3.5rem;margin:0 0 30px 0;color:#FFD700;text-shadow:0 0 30px rgba(255,215,0,1), 0 0 60px rgba(255,215,0,0.5);font-weight:bold;letter-spacing:3px;">
        🏆 THE ULTIMA CUP FINAL 🏆
      </h1>
      <div style="font-size:1.5rem;color:#FFF;margin:20px 0;line-height:2;">
        <p style="margin:15px 0;">An extraordinary game with extraordinary rules.</p>
        <p style="margin:15px 0;color:#FFD700;font-weight:bold;text-shadow:0 0 10px rgba(255,215,0,0.5);">The greatest spectacle in football history.</p>
      </div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log(``);
    log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.1));border:3px solid #FFD700;border-radius:15px;margin:30px 0;box-shadow:0 0 20px rgba(255,215,0,0.3);">
      <h2 style="font-size:2rem;color:#FFD700;margin-bottom:20px;text-align:center;text-shadow:0 0 10px rgba(255,215,0,0.5);">THE TEAMS</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">
        <div style="padding:20px;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,215,0,0.05));border-radius:10px;border:2px solid rgba(255,215,0,0.4);box-shadow:0 0 10px rgba(255,215,0,0.2);">
          <h3 style="font-size:1.5rem;color:#FFD700;margin-bottom:10px;text-shadow:0 0 5px rgba(255,215,0,0.5);">Southampton FC</h3>
          <p style="color:#FFF;line-height:1.6;">Your team. The journey ends here.</p>
        </div>
        <div style="padding:20px;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,215,0,0.05));border-radius:10px;border:2px solid rgba(255,215,0,0.4);box-shadow:0 0 10px rgba(255,215,0,0.2);">
          <h3 style="font-size:1.5rem;color:#FFD700;margin-bottom:10px;text-shadow:0 0 5px rgba(255,215,0,0.5);">Portsmouth</h3>
          <p style="color:#FFF;line-height:1.6;">Your eternal rivals. The derby to end all derbies.</p>
        </div>
        <div style="padding:20px;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,215,0,0.05));border-radius:10px;border:2px solid rgba(255,215,0,0.4);box-shadow:0 0 10px rgba(255,215,0,0.2);">
          <h3 style="font-size:1.5rem;color:#FFD700;margin-bottom:10px;text-shadow:0 0 5px rgba(255,215,0,0.5);">Legends FC</h3>
          <p style="color:#FFF;line-height:1.6;">The best current players in the world. A team of superstars.</p>
        </div>
        <div style="padding:20px;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,215,0,0.05));border-radius:10px;border:2px solid rgba(255,215,0,0.4);box-shadow:0 0 10px rgba(255,215,0,0.2);">
          <h3 style="font-size:1.5rem;color:#FFD700;margin-bottom:10px;text-shadow:0 0 5px rgba(255,215,0,0.5);">Ultima FC</h3>
          <p style="color:#FFF;line-height:1.6;">The greatest players of all time. Footballing immortals.</p>
        </div>
      </div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log(``);
    log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.1));border:3px solid #FFD700;border-radius:15px;margin:30px 0;box-shadow:0 0 20px rgba(255,215,0,0.3);">
      <h2 style="font-size:2rem;color:#FFD700;margin-bottom:20px;text-align:center;text-shadow:0 0 10px rgba(255,215,0,0.5);">THE VENUE</h2>
      <div style="text-align:center;padding:20px;">
        <h3 style="font-size:1.8rem;color:#FFD700;margin-bottom:15px;text-shadow:0 0 10px rgba(255,215,0,0.5);">Ultima Stadium, Bradford</h3>
        <p style="font-size:1.2rem;color:#FFF;line-height:1.8;">
          A stadium built for this moment.<br>
          A square pitch. Four goals. Two balls.<br>
          The stage is set for chaos and glory.
        </p>
      </div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log(``);
    log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,165,0,0.1));border:3px solid #FFD700;border-radius:15px;margin:30px 0;box-shadow:0 0 20px rgba(255,215,0,0.3);">
      <h2 style="font-size:2rem;color:#FFD700;margin-bottom:20px;text-align:center;text-shadow:0 0 10px rgba(255,215,0,0.5);">THE RULES</h2>
      <div style="padding:20px;background:rgba(0,0,0,0.4);border-radius:10px;margin-top:20px;border:1px solid rgba(255,215,0,0.3);">
        <ul style="list-style:none;padding:0;margin:0;">
          <li style="padding:15px;margin:10px 0;background:linear-gradient(90deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05));border-left:4px solid #FFD700;border-radius:5px;font-size:1.1rem;color:#FFF;line-height:1.6;box-shadow:0 0 5px rgba(255,215,0,0.2);">
            <strong style="color:#FFD700;text-shadow:0 0 5px rgba(255,215,0,0.5);">Square Pitch:</strong> The pitch is a perfect square, with a goal on each of the four sides.
          </li>
          <li style="padding:15px;margin:10px 0;background:linear-gradient(90deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05));border-left:4px solid #FFD700;border-radius:5px;font-size:1.1rem;color:#FFF;line-height:1.6;box-shadow:0 0 5px rgba(255,215,0,0.2);">
            <strong style="color:#FFD700;text-shadow:0 0 5px rgba(255,215,0,0.5);">Four Teams:</strong> All four teams play simultaneously on the same pitch.
          </li>
          <li style="padding:15px;margin:10px 0;background:linear-gradient(90deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05));border-left:4px solid #FFD700;border-radius:5px;font-size:1.1rem;color:#FFF;line-height:1.6;box-shadow:0 0 5px rgba(255,215,0,0.2);">
            <strong style="color:#FFD700;text-shadow:0 0 5px rgba(255,215,0,0.5);">Two Balls:</strong> Two footballs are in play at all times. Chaos reigns.
          </li>
          <li style="padding:15px;margin:10px 0;background:linear-gradient(90deg,rgba(255,215,0,0.15),rgba(255,215,0,0.05));border-left:4px solid #FFD700;border-radius:5px;font-size:1.1rem;color:#FFF;line-height:1.6;box-shadow:0 0 5px rgba(255,215,0,0.2);">
            <strong style="color:#FFD700;text-shadow:0 0 5px rgba(255,215,0,0.5);">Victory:</strong> Score in any of the three opposing goals. The team with the most goals wins.
          </li>
        </ul>
      </div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log(``);
    log(`<div style="text-align:center;padding:40px;background:linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,165,0,0.2));border:4px solid #FFD700;border-radius:20px;margin:30px 0;box-shadow:0 0 30px rgba(255,215,0,0.5);">
      <p style="font-size:1.5rem;color:#FFD700;font-weight:bold;margin:20px 0;text-shadow:0 0 10px rgba(255,215,0,0.5);">
        Prepare for the ultimate match.
      </p>
      <p style="font-size:1.2rem;color:#FFF;margin:15px 0;">
        This is unlike anything you've ever experienced.
      </p>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Show pre-match menu header
  log(``);
  log(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,165,0,0.15));border:3px solid #FFD700;border-radius:15px;margin:20px 0;box-shadow:0 0 25px rgba(255,215,0,0.4);">
    <h2 style="font-size:2.2rem;margin:0 0 15px 0;color:#FFD700;text-shadow:0 0 15px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.3);font-weight:bold;letter-spacing:2px;">
      🏆 ULTIMA CUP FINAL - PRE-MATCH 🏆
    </h2>
    <p style="font-size:1.3rem;color:#FFF;margin:10px 0;">
      Matchday: ${getClubName()} vs Portsmouth, Legends FC, Ultima FC
    </p>
  </div>`);
  
  // Now show the luxurious pre-match menu
  await ultimaCupPreMatchMenu();
}

// ========== KRUNCHEM ULTIMA CUP SCENE ==========
async function handleKrunchemUltimaCupScene() {
  // Mark scene as shown
  if (!S.ultimaCup) S.ultimaCup = {};
  S.ultimaCup.krunchem_scene_shown = true;
  
  // First, show the knock at the door and "Let Delmor in" button
  log(``);
  log(`<div style="padding:20px;background:rgba(0,0,0,0.9);border:3px solid #ff0000;border-radius:15px;margin:20px 0;box-shadow:0 0 30px rgba(255,0,0,0.5);">
    <p style="font-size:1.2rem;color:#fff;margin:10px 0;">There's another knock at the door...</p>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log(``);
  log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(20,0,0,0.95),rgba(40,0,0,0.95));border:4px solid #ff0000;border-radius:20px;margin:30px 0;box-shadow:0 0 40px rgba(255,0,0,0.6);">
    <h2 style="font-size:2rem;color:#ff0000;margin-bottom:20px;text-align:center;text-shadow:0 0 15px rgba(255,0,0,0.8);">AN UNEXPECTED VISITOR</h2>
    <p style="font-size:1.3rem;color:#fff;line-height:1.8;text-align:center;">
      You peer through the peephole to see <strong style="color:#ff0000;">Delmor Krunchem</strong> standing there.
    </p>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  log(``);
  log(`<div style="padding:20px;background:rgba(255,0,0,0.2);border:2px solid #ff0000;border-radius:10px;margin:20px 0;">
    <p style="font-size:1.1rem;color:#fff;text-align:center;">Delmor Krunchem is confirmed to be at your door.</p>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Ask if player wants to let Delmor in
  const letIn = await choose([
    { key: 'let_in', label: 'Let Delmor in', variant: 'warn' },
    { key: 'ignore', label: 'Ignore the knock' }
  ], 'Delmor Krunchem is at your door. What do you do?');
  
  if (letIn !== 'let_in') {
    log(``);
    log(`<div style="padding:25px;background:rgba(0,0,0,0.8);border:2px solid #ffaa00;border-radius:15px;margin:20px 0;">
      <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
        You decide to ignore the knock. The knocking stops after a moment, and you hear footsteps walking away.
      </p>
    </div>`);
    return;
  }
  
  // Create single centralized UI popup for the entire dialogue
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); z-index: 10010; display: flex; align-items: center; justify-content: center;';
  
  const popup = document.createElement('div');
  popup.style.cssText = 'background: linear-gradient(135deg, rgba(20, 0, 0, 0.98), rgba(40, 0, 0, 0.98)); border: 4px solid #ff0000; border-radius: 20px; padding: 40px; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 0 50px rgba(255, 0, 0, 0.6); color: #fff;';
  
  // Build the complete content with line-by-line reveal
  const dialogLines = [
    { text: 'You open the door and let Krunchem inside. He steps in, looking around warily before turning to face you.', color: '#fff' },
    { text: '"Look, I know we\'ve had our differences," Krunchem says, his voice unusually serious. "But there\'s something bigger at play here."', color: '#fff' },
    { text: 'He leans in closer, lowering his voice. "I\'ve been told that Van Onslaught and the Saudis are planning to stage a terrorist attack at the stadium. They\'re going to kill all of us because we\'re the last true British teams."', color: '#fff' },
    { text: '"I\'m proposing a one-off alliance," he continues. "I\'ll be planting a bomb at the north end of the stadium. I need you to plant one at the south end - that\'s where the two Saudi designations are sitting. The bombs will detonate and kill only the Saudi designations - no civilians are in that area. This will be an effective decapitation strike against the Muslim FC."', color: '#ffaaaa' },
    { text: '"Blimey, Krunchem... I dunno about this, mate. This is proper dodgy, innit? Planting bombs? That\'s a bit much, even for us."', color: '#fff', italic: true },
    { text: 'Krunchem\'s eyes glint as he reaches into his pocket. "I understand your hesitation. But if you help me, I\'ll give you something you\'ve been looking for."', color: '#fff' },
    { text: 'He holds up a gleaming Kreplin Gem, its surface catching the light. "Plant the bomb, and I\'ll give you this after the match. The deal is simple: you do your part, I do mine, and we both get what we want."', color: '#fff' }
  ];
  
  let currentLineIndex = 0;
  const contentDiv = document.createElement('div');
  contentDiv.id = 'krunchemDialogContent';
  contentDiv.style.cssText = 'font-size: 1.1rem; line-height: 1.8; margin-bottom: 30px; min-height: 200px;';
  
  popup.innerHTML = `
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="font-size: 2.2rem; color: #ff0000; margin: 0 0 20px 0; text-shadow: 0 0 20px rgba(255, 0, 0, 0.8);">DELMOR KRUNCHEM</h2>
      <div style="width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #ff0000, transparent); margin: 20px 0;"></div>
    </div>
    <div id="krunchemDialogContent" style="font-size: 1.1rem; line-height: 1.8; margin-bottom: 30px; min-height: 200px;"></div>
    <div style="text-align: center; margin: 30px 0; padding: 20px; background: rgba(255, 215, 0, 0.1); border: 3px solid #FFD700; border-radius: 15px; box-shadow: 0 0 30px rgba(255, 215, 0, 0.5); display: none;" id="krunchemGemReveal">
      <p style="font-size: 1.5rem; color: #FFD700; margin: 0; text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);">✨💎</p>
      <p style="font-size: 1.3rem; color: #FFD700; margin: 10px 0 0 0; font-weight: bold; text-shadow: 0 0 15px rgba(255, 215, 0, 0.8);">A SHINY KREPLIN GEM</p>
    </div>
    <div style="text-align: center; margin-top: 30px;">
      <button id="krunchemContinueBtn" style="background: #ff0000; color: #fff; border: 2px solid #fff; padding: 15px 30px; font-size: 1.1rem; border-radius: 10px; cursor: pointer; font-weight: bold; box-shadow: 0 0 20px rgba(255, 0, 0, 0.5); transition: all 0.2s; display: none;">Continue...</button>
    </div>
  `;
  
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  
  const contentEl = popup.querySelector('#krunchemDialogContent');
  const gemRevealEl = popup.querySelector('#krunchemGemReveal');
  const continueBtn = popup.querySelector('#krunchemContinueBtn');
  
  // Wire up button
  if (continueBtn) {
    continueBtn.onmouseover = () => {
      continueBtn.style.background = '#cc0000';
      continueBtn.style.boxShadow = '0 0 30px rgba(255, 0, 0, 0.8)';
    };
    continueBtn.onmouseout = () => {
      continueBtn.style.background = '#ff0000';
      continueBtn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
    };
  }
  
  // Function to reveal lines one by one
  async function revealNextLine() {
    if (currentLineIndex >= dialogLines.length) {
      // Show continue button and wait for click
      if (continueBtn) {
        continueBtn.style.display = 'block';
        continueBtn.textContent = 'Make Your Decision';
        return new Promise(resolve => {
          continueBtn.onclick = () => {
            overlay.remove();
            resolve();
          };
        });
      } else {
        overlay.remove();
        return;
      }
    }
    
    const line = dialogLines[currentLineIndex];
    const lineEl = document.createElement('p');
    lineEl.style.cssText = `margin: 15px 0; color: ${line.color}; opacity: 0; transition: opacity 0.5s ease-in;`;
    if (line.italic) lineEl.style.fontStyle = 'italic';
    lineEl.textContent = line.text;
    contentEl.appendChild(lineEl);
    
    // Fade in
    setTimeout(() => {
      lineEl.style.opacity = '1';
    }, 50);
    
    currentLineIndex++;
    
    // Show gem reveal after line 5 (Krunchem reaches into pocket)
    if (currentLineIndex === 6 && gemRevealEl) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      gemRevealEl.style.display = 'block';
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Wait before next line (longer pause for dramatic lines)
    const waitTime = line.color === '#ffaaaa' || currentLineIndex === 6 ? 2000 : 1500;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return revealNextLine();
  }
  
  // Start revealing lines
  await revealNextLine();
  
  // Present the momentous decision
  log(``);
  log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(0,0,0,0.95),rgba(20,0,20,0.95));border:5px solid #ff0000;border-radius:25px;margin:40px 0;box-shadow:0 0 50px rgba(255,0,0,0.6);">
    <h2 style="font-size:2.5rem;color:#ff0000;margin-bottom:30px;text-align:center;text-shadow:0 0 30px rgba(255,0,0,1);font-weight:bold;">THE MOMENTOUS DECISION</h2>
    <p style="font-size:1.3rem;color:#fff;line-height:1.8;text-align:center;margin:20px 0;">
      This is it. The choice that will define everything. Do you plant the bomb and accept Krunchem's alliance, or do you play the game as normal?
    </p>
  </div>`);
  
  const decision = await choose([
    { key: 'plant_bomb', label: '💣 Plant the bomb at the south end (accept Krunchem\'s alliance)', variant: 'bad' },
    { key: 'play_normal', label: '⚽ Play the game as normal (reject the offer)', variant: 'good' }
  ], 'THE MOMENTOUS DECISION: What do you choose?');
  
  if (decision === 'plant_bomb') {
    S.ultimaCup.bomb_planted = true;
    log(``);
    log(`<div style="padding:25px;background:rgba(255,0,0,0.2);border:3px solid #ff0000;border-radius:15px;margin:20px 0;">
      <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
        You've made your choice. The bomb will be planted. The match will be... different.
      </p>
    </div>`);
    log(`💣 You planted the bomb.`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    S.ultimaCup.bomb_planted = false;
    log(``);
    log(`<div style="padding:25px;background:rgba(0,0,0,0.8);border:2px solid #ffaa00;border-radius:15px;margin:20px 0;">
      <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
        "Suit yourself," Krunchem says coldly. "But remember - when they come for us, don't say I didn't warn you." He turns and leaves without another word.
      </p>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// ========== ULTIMA CUP PRE-MATCH MENU ==========
async function ultimaCupPreMatchMenu() {
  // Set opponent context for Ultima Cup
  S.matchContext = { team: 'Ultima Cup Final', manager: 'The Greatest' };
  
  log(``);
  log(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,165,0,0.15));border:3px solid #FFD700;border-radius:15px;margin:20px 0;box-shadow:0 0 25px rgba(255,215,0,0.4);">
    <h2 style="font-size:2.2rem;margin:0 0 15px 0;color:#FFD700;text-shadow:0 0 15px rgba(255,215,0,0.6), 0 0 30px rgba(255,215,0,0.3);font-weight:bold;letter-spacing:2px;">
      🏆 ULTIMA CUP FINAL - PRE-MATCH 🏆
    </h2>
    <p style="font-size:1.3rem;color:#FFF;margin:10px 0;">
      Matchday: ${getClubName()} vs Portsmouth, Legends FC, Ultima FC
    </p>
  </div>`);
  
  // ensure preMatch bucket exists
  if (!S.preMatch || typeof S.preMatch !== 'object') S.preMatch = {};
  
  while (true) {
    // Build items fresh each loop
    let items = [];
    
    // visitors gate
    items.push({ key:'door',
      label: S.visitors_handled ? '✨ Answer the door (done)' : '✨ Answer the knock at the door' });
    
    // core actions
    items.push(
      { key:'transfers', label:'💎 Open transfer window' },
      { key:'lineup',    label:'👑 Pick lineup / Auto-pick' },
      { key:'own',       label: S.visited_ownLocker ? '🏆 Your locker room (done)' : '🏆 Enter your luxurious locker room' },
      { key:'opp',       label: S.visited_oppLocker ? '🏆 Opposition locker (done)' : '🏆 Sneak into opposition locker' }
    );
    
    // betting (once)
    items.push({
      key:'bet',
      label: (S.preMatch && S.preMatch.betLocked) ? '💰 Bet (already placed)' : '💰 Place a Bet (optional)'
    });
    
    // bribe options (guard duplicates)
    if (!S.referee_bribed && !S.referee_assaulted) {
      items.push({ key:'referee', label:'⚖️ Call the referee (…favor a side)' });
    }
    if (!S.accepted_bribe_this_match && !S.opponent_bribed) {
      items.push({ key:'backchannel', label:'🤝 Backchannel with opposing manager (offer a bribe)' });
    }
    
    // Proceed to kickoff option
    items.push({ key:'kick', label:'🏆 Proceed to kickoff' }, { key:'back', label:'🔙 Back / Pause' });
    
    // de-dupe by key in case something else pushed the same entry
    {
      const seen = new Set();
      items = items.filter(it => (it && it.key && !seen.has(it.key)) ? (seen.add(it.key), true) : false);
    }
    
    // Store a flag that we're about to show the menu
    S._preMatchMenuActive = true;
    
    const choice = await choose(items, '🏆 ULTIMA CUP PRE-MATCH ACTIONS 🏆');
    S._preMatchMenuActive = false;
    
    // visitors must be handled before kickoff
    if (choice === 'door'){
      if (!S.visitors_handled){ 
        await openKnockDoor(); 
        S.visitors_handled = true; 
        
        // After all visitors are handled, trigger Krunchem scene (only once, only in Ultima Cup)
        if (S.preMatch && S.preMatch.ultimaCup && (!S.ultimaCup || !S.ultimaCup.krunchem_scene_shown)) {
          await handleKrunchemUltimaCupScene();
        }
      }
      else { log("You already handled today's visitors."); }
      continue;
    }
    
    if (choice === 'transfers'){ await openTransferWindow();    continue; }
    if (choice === 'lineup'){    await selectLineupMenu();      ensureValidLineup(); continue; }
    if (choice === 'own'){       await yourLockerRoomMenu();    S.visited_ownLocker = true; continue; }
    if (choice === 'opp'){       await opponentLockerRoomMenu();S.visited_oppLocker = true; continue; }
    
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
          
          const fineChair = 50000 + Math.floor(Math.random() * 50000);
          const fineClub = Math.round(fineChair * 1.5);
          
          S.chairman_cash = Math.max(0, (S.chairman_cash|0) - fineChair);
          S.club_cash = Math.max(0, (S.club_cash|0) - fineClub);
          S.police_risk = Math.min(100, (S.police_risk|0) + 20);
          S.legal_risk = Math.min(100, (S.legal_risk|0) + 5);
          S.compliance_risk = Math.min(100, (S.compliance_risk|0) + 6);
          S.reputation = Math.max(0, (S.reputation|0) - 15);
          S.referee_assaulted = true;
          
          log(`CONSEQUENCES: Personal fine ${money(fineChair)}, Club fine ${money(fineClub)}`);
          log("Your reputation plummets and the FA launches an immediate investigation.");
          
          S._pending_police_investigation = { authority: 'police', caseType: 'assault on referee' };
          
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
        // refund because the bribe didn't happen
        if (can.source === 'o') S.chairman_cash += amount; else S.club_cash += amount;
        updateHUD?.();
        continue;
      }
      
      // bribe accepted
      log("The referee quietly agrees to 'interpret' decisions in your chosen direction.");
      S.referee_bribed = side; // 'us' or 'them'
      
      // bribe accepted: weaken their pre-match strength slightly
      if (S.preMatch && typeof S.preMatch.oppStrength === 'number'){
        S.preMatch.oppStrength = Math.max(5, S.preMatch.oppStrength - 10);
      }
      
      updateHUD?.();
      continue;
    }
    
    // ---- Backchannel with opposing manager ----
    if (choice === 'backchannel'){
      if (S.accepted_bribe_this_match) {
        log("You've already accepted a bribe from the opposition this match.");
        continue;
      }
      if (S.opponent_bribed) {
        log("You've already attempted to bribe the opposition manager this match.");
        continue;
      }
      
      const amount = 500_000;
      const can = await takeFundsFor(amount, "Bribe amount £500,000 — funding source?");
      if (!can.ok) { continue; }
      
      const after = await declineThreatenHushFlow('Opposing Manager', amount);
      if (after.declined){
        if (can.source === 'o') S.chairman_cash += amount; else S.club_cash += amount;
        updateHUD?.();
        continue;
      }
      
      log("The opposing manager accepts your bribe. He'll 'instruct' his team to play... less aggressively.");
      S.opponent_bribed = true;
      
      // weaken their pre-match strength
      if (S.preMatch && typeof S.preMatch.oppStrength === 'number'){
        S.preMatch.oppStrength = Math.max(5, S.preMatch.oppStrength - 15);
      }
      
      updateHUD?.();
      continue;
    }
    
    if (choice === 'kick'){
      if (!S.visitors_handled){ log("You should answer the knock at the door before kickoff."); continue; }
      
      // Exit pre-match menu to proceed to Ultima Cup match
      break;
    }
    
    if (choice === 'back'){
      // leaving the menu leads to kickoff too, so the door must be answered first
      if (!S.visitors_handled){ log("You should answer the knock at the door before kickoff."); continue; }
      break;
    }
  }
  
  // Mark pre-match as complete
  S.ultimaCup.preMatchComplete = true;
  
  // If we exited via kickoff, proceed to match
  if (S.preMatch && S.preMatch.ultimaCup) {
    // Check if bomb path was chosen
    if (S.ultimaCup.bomb_planted) {
      await ultimaCupKickoffBombPath();
    } else {
      await ultimaCupKickoff();
    }
  }
}

// ========== ULTIMA CUP KICKOFF ==========
async function ultimaCupKickoff() {
  // Ensure we have a valid lineup
  if (typeof ensureValidLineup === 'function') {
    ensureValidLineup();
  }
  if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
    log("You cannot proceed to kickoff with less than 5 players. Please select a full lineup first.");
    if (typeof selectLineupMenu === 'function') {
      await selectLineupMenu();
      if (typeof ensureValidLineup === 'function') {
        ensureValidLineup();
      }
    }
    if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
      log("You still don't have enough players. The match cannot proceed.");
      return;
    }
  }
  
  // Show kickoff options
  const how = await choose([
    {key: 'sim', label: '🏆 Quick Simulate'}
  ], "🏆 ULTIMA CUP KICKOFF 🏆");
  
  let outcome;
  if (how === 'sim') {
    // Use the special Ultima Cup simulation
    outcome = await quickSimulateUltimaCup();
  } else if (how === 'skip') {
    // Skip to results - quick simulation without overlay
    const result = computeUltimaCupResult();
    outcome = {
      usGoals: result.usGoals,
      portsmouthGoals: result.portsmouthGoals,
      legendsGoals: result.legendsGoals,
      ultimaGoals: result.ultimaGoals,
      winner: result.winner
    };
    log(`Full-time: ${getClubName()} ${result.usGoals} – Portsmouth ${result.portsmouthGoals} – Legends FC ${result.legendsGoals} – Ultima FC ${result.ultimaGoals}`);
    
    // Check if there's a draw - trigger penalty shootout
    if (result.winner === 'draw') {
      // Determine which team(s) are tied for first
      const scores = [
        { team: 'us', name: getClubName(), goals: result.usGoals },
        { team: 'portsmouth', name: 'Portsmouth', goals: result.portsmouthGoals },
        { team: 'legends', name: 'Legends FC', goals: result.legendsGoals },
        { team: 'ultima', name: 'Ultima FC', goals: result.ultimaGoals }
      ];
      scores.sort((a, b) => b.goals - a.goals);
      const topScore = scores[0].goals;
      const tiedTeams = scores.filter(s => s.goals === topScore);
      
      // Determine opponent for penalty shootout
      let opponentName = 'Delmor Krunchem';
      let opponentTeam = 'Portsmouth';
      
      // Check if tied with Ultima FC or Legends FC
      const tiedWithUltima = tiedTeams.some(t => t.team === 'ultima');
      const tiedWithLegends = tiedTeams.some(t => t.team === 'legends');
      
      if (tiedWithUltima || tiedWithLegends) {
        opponentName = 'Mohammed van Onslaught';
        opponentTeam = tiedWithUltima ? 'Ultima FC' : 'Legends FC';
      } else if (tiedTeams.some(t => t.team === 'portsmouth')) {
        opponentName = 'Delmor Krunchem';
        opponentTeam = 'Portsmouth';
      }
      
      // Check if player is tied (if not, it's between other teams)
      const playerTied = tiedTeams.some(t => t.team === 'us');
      
      if (playerTied) {
        log('');
        log(`<div style="padding:20px;background:rgba(200,200,0,0.2);border:2px solid #ff0;border-radius:10px;margin:20px 0;">
          <p style="text-align:center;color:#ff0;font-size:1.2rem;font-weight:bold;">🏆 The match ends in a draw! The Ultima Cup will be decided by a penalty shootout.</p>
          <p style="text-align:center;color:#fff;font-size:1.1rem;margin-top:10px;">${opponentName} will face you in the penalty shootout.</p>
        </div>`);
        await delay(3000);
        
        // Trigger penalty minigame with the correct opponent
        const penaltyWinner = await playPenaltyMinigame(opponentName, opponentTeam);
        
        // Update outcome based on penalty result
        if (penaltyWinner === 'us') {
          outcome.winner = 'us';
          log('');
          log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(0,100,0,0.3),rgba(0,50,0,0.2));border:5px solid #00cc00;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(0,200,0,0.6);">
            <p style="font-size:2rem;color:#00ff00;line-height:2;text-align:center;font-weight:bold;">
              🏆 ${getClubName()} WINS THE ULTIMA CUP ON PENALTIES! 🏆
            </p>
          </div>`);
        } else {
          if (opponentTeam === 'Portsmouth') {
            outcome.winner = 'portsmouth';
          } else if (opponentTeam === 'Legends FC') {
            outcome.winner = 'legends';
          } else if (opponentTeam === 'Ultima FC') {
            outcome.winner = 'ultima';
          }
          log('');
          log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(200,0,0,0.3),rgba(100,0,0,0.2));border:5px solid #cc0000;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(200,0,0,0.6);">
            <p style="font-size:2rem;color:#ff4444;line-height:2;text-align:center;font-weight:bold;">
              ${opponentTeam} win the Ultima Cup on penalties.
            </p>
          </div>`);
        }
      } else {
        // Player not in the tie - other teams will play penalties
        log('');
        log(`<div style="padding:20px;background:rgba(200,200,0,0.2);border:2px solid #ff0;border-radius:10px;margin:20px 0;">
          <p style="text-align:center;color:#ff0;font-size:1.2rem;font-weight:bold;">🏆 The match ends in a draw between ${tiedTeams.map(t => t.name).join(' and ')}. They will play a penalty shootout.</p>
        </div>`);
        await delay(2000);
      }
    }
    
    // Check if Southampton won - if so, trigger Mohammed van onslaught sequence
    if (outcome.winner === 'us' && result.usGoals > result.portsmouthGoals) {
      const updatedResult = await handleMohammedVanOnslaughtSequence(outcome);
      if (updatedResult) {
        outcome.winner = updatedResult.winner;
        outcome.portsmouthGoals = updatedResult.portsmouthGoals;
      }
    }
  }
  
  // Handle post-match (bet resolution, etc.)
  if (outcome) {
    const resultKey = outcome.winner === 'us' ? 'us' : (outcome.winner === 'portsmouth' ? 'them' : 'draw');
    if (typeof resolveActiveBet === 'function') {
      resolveActiveBet(resultKey);
    }
    
    // Check if player has briefcase AND armed players - both are required for briefcase UI
    const briefcaseValue = S.power_briefcase_owned;
    const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
    
    // Ensure ultimaCup object exists
    if (!S.ultimaCup) S.ultimaCup = {};
    
    // Check for armed players - handle both boolean and string values
    const playersArmedValue = S.ultimaCup.players_armed;
    const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
    
    
    if (hasBriefcase && hasArmedPlayers) {
      await showUltimaCupVictoryUIBombPath(outcome);
    } else {
      // Show normal victory UI
      await showUltimaCupVictoryUI(outcome);
    }
  } else {
  }
  
  return outcome;
}

// ========== ULTIMA CUP KICKOFF - BOMB PATH ==========
async function ultimaCupKickoffBombPath() {
  // Ensure we have a valid lineup
  if (typeof ensureValidLineup === 'function') {
    ensureValidLineup();
  }
  if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
    log("You cannot proceed to kickoff with less than 5 players. Please select a full lineup first.");
    if (typeof selectLineupMenu === 'function') {
      await selectLineupMenu();
      if (typeof ensureValidLineup === 'function') {
        ensureValidLineup();
      }
    }
    if (!Array.isArray(S.lineup) || S.lineup.length < 5) {
      log("You still don't have enough players. The match cannot proceed.");
      return;
    }
  }
  
  // Show that the bomb has been planted
  log(``);
  log(`<div style="padding:30px;background:linear-gradient(135deg,rgba(255,0,0,0.2),rgba(100,0,0,0.3));border:4px solid #ff0000;border-radius:20px;margin:30px 0;box-shadow:0 0 40px rgba(255,0,0,0.6);">
    <h2 style="font-size:2rem;color:#ff0000;margin-bottom:20px;text-align:center;text-shadow:0 0 20px rgba(255,0,0,0.8);">💣 THE BOMB HAS BEEN PLANTED 💣</h2>
    <p style="font-size:1.2rem;color:#fff;line-height:1.8;text-align:center;">
      The match begins, but something is different. The bombs are in place. The game will unfold... differently.
    </p>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if player retrieved munitions from son's school - offer to arm players
  if (S.season5 && S.season5.armed_with_son_weapons) {
    log(``);
    log(`<div style="padding:25px;background:rgba(0,0,0,0.8);border:3px solid #ffaa00;border-radius:15px;margin:20px 0;">
      <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
        You remember the munitions and guns you retrieved from your son's school. Right before the match, you could arm your players...
      </p>
    </div>`);
    
    const armChoice = await choose([
      { key: 'yes', label: 'Yes - Arm your players', variant: 'warn' },
      { key: 'no', label: 'No - Keep them unarmed' }
    ], 'Do you want to arm your players with the weapons?');
    
    if (armChoice === 'yes') {
      if (!S.ultimaCup) S.ultimaCup = {};
      S.ultimaCup.players_armed = true;
      log(``);
      log(`<div style="padding:25px;background:rgba(255,0,0,0.2);border:3px solid #ff0000;border-radius:15px;margin:20px 0;">
        <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
          Your players are now armed. The match will be... different.
        </p>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      if (!S.ultimaCup) S.ultimaCup = {};
      S.ultimaCup.players_armed = false;
      log(``);
      log(`<div style="padding:25px;background:rgba(0,0,0,0.8);border:2px solid #ffaa00;border-radius:15px;margin:20px 0;">
        <p style="font-size:1.2rem;color:#fff;line-height:1.8;">
          You decide to keep your players unarmed. They'll face whatever comes without weapons.
        </p>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // TODO: Build parallel match system for bomb path
  // This is where the alternative match simulation will be implemented
  // The match should reflect the consequences of the bomb plot
  
  log(``);
  log(`<div style="padding:25px;background:rgba(0,0,0,0.8);border:2px solid #ffaa00;border-radius:15px;margin:20px 0;">
    <p style="font-size:1.1rem;color:#fff;line-height:1.8;">
      <strong>NOTE:</strong> The parallel match system for the bomb path is being built. For now, the match proceeds with the bomb plot in effect.
    </p>
  </div>`);
  
  // For now, use the normal match system but with a flag indicating bomb path
  // This can be expanded later with the full parallel system
  const how = await choose([
    {key: 'sim', label: '🏆 Quick Simulate (Bomb Path)'},
    {key: 'skip', label: 'Skip to Results (Bomb Path)'}
  ], "🏆 ULTIMA CUP KICKOFF - BOMB PATH 🏆");
  
  let outcome;
  if (how === 'sim') {
    // Use the special Ultima Cup simulation (will be modified for bomb path)
    outcome = await quickSimulateUltimaCupBombPath();
  } else if (how === 'skip') {
    // Skip to results - quick simulation without overlay (bomb path version)
    const result = computeUltimaCupResultBombPath();
    outcome = {
      usGoals: result.usGoals,
      portsmouthGoals: result.portsmouthGoals,
      legendsGoals: result.legendsGoals,
      ultimaGoals: result.ultimaGoals,
      winner: result.winner,
      bombPath: true
    };
    log(`Full-time: ${getClubName()} ${result.usGoals} – Portsmouth ${result.portsmouthGoals} – Legends FC ${result.legendsGoals} – Ultima FC ${result.ultimaGoals}`);
  }
  
  // Handle post-match (bet resolution, etc.)
  if (outcome) {
    const resultKey = outcome.winner === 'us' ? 'us' : (outcome.winner === 'portsmouth' ? 'them' : 'draw');
    if (typeof resolveActiveBet === 'function') {
      resolveActiveBet(resultKey);
    }
    
    // ========== BOMB PATH: Check conditions BEFORE calling victory UI ==========
    
    // Check if player has briefcase AND armed players - both are required for briefcase UI
    const briefcaseValue = S.power_briefcase_owned;
    const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
    
    // Ensure ultimaCup object exists
    if (!S.ultimaCup) {
      console.warn('[BRIEFCASE DEBUG BOMB PATH] S.ultimaCup does not exist! Creating it...');
      S.ultimaCup = {};
    }
    
    // Check for armed players - handle both boolean and string values
    const playersArmedValue = S.ultimaCup.players_armed;
    const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
    
    
    // Show victory UI (modified for bomb path) - always call showUltimaCupVictoryUIBombPath
    // It will handle both success (briefcase UI) and failstates
    await showUltimaCupVictoryUIBombPath(outcome);
  }
  
  return outcome;
}

// ========== ULTIMA CUP QUICK SIMULATE - BOMB PATH ==========
async function quickSimulateUltimaCupBombPath() {
  // Create overlay for bomb path commentary
  const overlay = document.createElement('div');
  overlay.className = 'ultima-cup-overlay';
  overlay.innerHTML = `
    <div class="ultima-cup-container">
      <div class="ultima-cup-header" style="padding-bottom: 160px;">
        <div class="ultima-cup-title" style="font-size: 1.5rem; margin-bottom: 8px;">🏆 THE ULTIMA CUP 🏆</div>
        <div class="ultima-cup-commentary-container" style="margin-top: 12px; margin-bottom: 0; max-height: 280px; min-height: 180px; display: flex; flex-direction: column; position: relative; z-index: 1;">
          <div style="flex-shrink: 0; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <div class="ultima-cup-commentary-header" style="flex-shrink: 0;">📺 Live Commentary</div>
            <div class="ultima-cup-speed-control" style="display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-left: auto;">
              <label for="bombPathSpeed" style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.9); font-weight: 500;">Speed:</label>
              <select id="bombPathSpeed" class="ultima-cup-speed-select" style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 6px 12px; color: white; font-size: 0.85rem; cursor: pointer; transition: all 0.2s ease; outline: none;">
                <option value="1">1 (Slowest)</option>
                <option value="2">2 (Slow)</option>
                <option value="3">3 (Default)</option>
                <option value="4">4 (Fast)</option>
                <option value="5">5 (Fastest)</option>
              </select>
            </div>
          </div>
          <div class="ultima-cup-commentary" id="bombPathCommentary" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 16px; padding-bottom: 16px; background: rgba(0,0,0,0.8); border-radius: 8px; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; min-height: 0;"></div>
        </div>
      </div>
      <div class="ultima-cup-score-tally" id="bombPathScoreTally" style="position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.95);border-top:3px solid rgba(255,215,0,0.6);padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;z-index:1000;box-shadow:0 -4px 20px rgba(0,0,0,0.8);">
        <div class="score-box saints-score" style="text-align:center;padding:12px;background:rgba(0,245,255,0.1);border:2px solid rgba(0,245,255,0.5);border-radius:8px;">
          <div style="font-weight:bold;color:#00f5ff;font-size:0.9rem;margin-bottom:4px;">${getClubName()}</div>
          <div style="font-size:1.5rem;font-weight:bold;color:#00f5ff;" id="saintsScore">0</div>
        </div>
        <div class="score-box portsmouth-score" style="text-align:center;padding:12px;background:rgba(0,150,255,0.1);border:2px solid rgba(0,150,255,0.5);border-radius:8px;">
          <div style="font-weight:bold;color:#0096ff;font-size:0.9rem;margin-bottom:4px;">Portsmouth</div>
          <div style="font-size:1.5rem;font-weight:bold;color:#0096ff;" id="portsmouthScore">0</div>
        </div>
        <div class="score-box legends-score" style="text-align:center;padding:12px;background:rgba(255,215,0,0.1);border:2px solid rgba(255,215,0,0.5);border-radius:8px;">
          <div style="font-weight:bold;color:#FFD700;font-size:0.9rem;margin-bottom:4px;">Legends FC</div>
          <div style="font-size:1.5rem;font-weight:bold;color:#FFD700;" id="legendsScore">0</div>
        </div>
        <div class="score-box ultima-score" style="text-align:center;padding:12px;background:rgba(191,0,255,0.1);border:2px solid rgba(191,0,255,0.5);border-radius:8px;">
          <div style="font-weight:bold;color:#bf00ff;font-size:0.9rem;margin-bottom:4px;">Ultima FC</div>
          <div style="font-size:1.5rem;font-weight:bold;color:#bf00ff;" id="ultimaScore">0</div>
        </div>
      </div>
      <button class="ultima-cup-skip-btn" id="bombPathSkipBtn" style="display:none;">Continue</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Start playing the first audio track when the match starts
  const firstAudio = new Audio('https://www.dropbox.com/scl/fi/l2c8pfxv3qpduo9dgrw57/untitled.mp3?rlkey=tctx0hi3gmastnv9bh0nxesvc&st=dasom9yw&dl=1');
  firstAudio.loop = true;
  firstAudio.volume = 0.7;
  firstAudio.play().catch(err => {});
  
  // Store reference to first audio for later stopping
  window._ultimaCupFirstAudio = firstAudio;
  
  // Get commentary box
  const com = document.getElementById('bombPathCommentary');
  const skipBtn = document.getElementById('bombPathSkipBtn');
  const speedSelect = document.getElementById('bombPathSpeed');
  let skipRequested = false;
  
  // Initialize speed selector with saved preference (default 3)
  const savedSpeed = localStorage.getItem('ultimaCupCommentarySpeed');
  const defaultSpeed = '3';
  if (speedSelect) {
    speedSelect.value = savedSpeed || defaultSpeed;
    // Save preference when changed
    speedSelect.addEventListener('change', (e) => {
      localStorage.setItem('ultimaCupCommentarySpeed', e.target.value);
    });
  }
  
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipRequested = true;
    });
  }
  
  // Helper functions for blood spatter and vibration
  const createBloodSpatter = () => {
    const container = document.createElement('div');
    container.className = 'blood-splatter-container';
    document.body.appendChild(container);
    
    // Create multiple blood splatters
    for (let i = 0; i < 15; i++) {
      const splatter = document.createElement('div');
      const size = Math.random() > 0.5 ? 'blood-splatter-large' : (Math.random() > 0.5 ? 'blood-splatter' : 'blood-splatter-small');
      splatter.className = `blood-splatter ${size}`;
      splatter.style.left = Math.random() * 100 + '%';
      splatter.style.top = Math.random() * 100 + '%';
      splatter.style.setProperty('--splatter-x', (Math.random() - 0.5) * 200 + 'px');
      splatter.style.setProperty('--splatter-y', (Math.random() - 0.5) * 200 + 'px');
      splatter.style.setProperty('--splatter-rot', Math.random() * 360 + 'deg');
      container.appendChild(splatter);
    }
    
    setTimeout(() => {
      container.remove();
    }, 600);
  };
  
  const triggerVibration = () => {
    const overlay = document.querySelector('.ultima-cup-overlay');
    if (overlay) {
      // Ensure overlay stays visible and stable
      overlay.style.opacity = '1';
      overlay.style.visibility = 'visible';
      overlay.style.display = 'flex';
      // Apply shake to content container instead of overlay itself to prevent flickering
      const container = overlay.querySelector('.ultima-cup-container');
      if (container) {
        container.classList.add('screen-shake');
        setTimeout(() => {
          container.classList.remove('screen-shake');
        }, 300);
      } else {
        // Fallback to overlay if container not found
        overlay.classList.add('screen-shake');
        setTimeout(() => {
          overlay.classList.remove('screen-shake');
        }, 300);
      }
    }
  };
  
  // Helper to update score tally
  const updateScoreTally = (saints, portsmouth, legends, ultima) => {
    const saintsEl = document.getElementById('saintsScore');
    const portsmouthEl = document.getElementById('portsmouthScore');
    const legendsEl = document.getElementById('legendsScore');
    const ultimaEl = document.getElementById('ultimaScore');
    if (saintsEl) saintsEl.textContent = saints;
    if (portsmouthEl) portsmouthEl.textContent = portsmouth;
    if (legendsEl) legendsEl.textContent = legends;
    if (ultimaEl) ultimaEl.textContent = ultima;
  };
  
  // Helper to highlight Saints player names in text
  const highlightSaintsPlayers = (text, saintsNames) => {
    let highlightedText = text;
    saintsNames.forEach(name => {
      const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<span class="saints-player-name" style="color:#00f5ff;font-weight:bold;text-shadow:0 0 8px rgba(0,245,255,0.8);">${name}</span>`);
    });
    return highlightedText;
  };
  
  // Helper to get random audience reaction
  const getAudienceReaction = () => {
    const reactions = [
      'MORE!',
      'MORE VIOLENCE!',
      'KILL MORE PLAYERS!',
      'WE LOVE VIOLENCE!!',
      'YES!',
      'MORE BLOOD!',
      'KILL THEM ALL!',
      'BRILLIANT!',
      'MORE CARNAGE!',
      'WE WANT MORE!'
    ];
    return pick(reactions);
  };
  
  // Helper to add audience reaction to commentary text
  const addAudienceReaction = (text) => {
    if (Math.random() < 0.25) { // 25% chance of audience reaction (reduced from 70%)
      const reaction = getAudienceReaction();
      return `${text} The crowd roars "${reaction}"`;
    }
    return text;
  };
  
  // Helper to split long murder scenes into multiple commentary entries
  const splitMurderScene = (text, minute) => {
    // Split on sentence endings, but keep related sentences together
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const parts = [];
    let currentPart = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // If adding this sentence would make the part too long, start a new part
      if (currentPart.length + sentence.length > 180 && currentPart.length > 0) {
        parts.push(currentPart.trim());
        currentPart = sentence;
      } else {
        currentPart += (currentPart ? ' ' : '') + sentence;
      }
    }
    
    // Add the last part
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    // If we only have one part, return it as-is
    if (parts.length <= 1) {
      return [text];
    }
    
    return parts;
  };
  
  // Helper to add commentary with typewriter effect
  const addComWithDelay = (text, delay = 300, isKilling = false, minute = null, isActionPacked = false, saintsPlayerName = null) => {
    return new Promise(resolve => {
      if (skipRequested) {
        resolve();
        return;
      }
      
      // Get commentary speed from UI and apply multiplier
      // Speed 1 (slowest) = highest multiplier, Speed 5 (fastest) = lowest multiplier
      const speedMultipliers = {
        1: 10.0, 2: 5.0, 3: 3.0, 4: 1.8, 5: 1.0
      };
      const currentSpeedValue = speedSelect ? parseInt(speedSelect.value) : 3;
      const speedFactor = speedMultipliers[currentSpeedValue] || 2.5;
      const adjustedDelay = Math.max(0, delay * speedFactor);
      
      // Format as match commentary if minute provided
      let formattedText = text;
      if (minute !== null) {
        formattedText = `[${minute}'] ${text}`;
      }
      
      // Break long commentary lines into multiple lines for readability
      // Split on sentence endings or long clauses (over 120 characters)
      const breakLongText = (txt) => {
        if (txt.length <= 120) return txt;
        // Try to break on sentence endings first
        const sentences = txt.match(/[^.!?]+[.!?]+/g) || [];
        if (sentences.length > 1) {
          return sentences.join('<br>');
        }
        // Otherwise break on commas or conjunctions in long text
        const parts = txt.split(/(?<=[,;])\s+(?=[A-Z])/);
        if (parts.length > 1 && txt.length > 150) {
          return parts.join('<br>');
        }
        return txt;
      };
      formattedText = breakLongText(formattedText);
      
      setTimeout(() => {
        if (com) {
          const p = document.createElement('div');
          p.className = 'commentary-line';
          
          // Apply effects ONLY for killing or goals
          const isGoal = text.includes('GOAL') || text.includes('goal');
          const isGetInThere = text.includes('GET IN THERE') || text.includes('RUIN THOSE CUNTS');
          
          // Special explosive styling for "GET IN THERE" text
          if (isGetInThere) {
            p.style.fontSize = '2.5em';
            p.style.fontWeight = '900';
            p.style.color = '#ffd700';
            p.style.textShadow = '0 0 20px rgba(255, 215, 0, 1), 0 0 40px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 0, 0, 0.6)';
            p.style.textAlign = 'center';
            p.style.letterSpacing = '0.1em';
            p.style.animation = 'explodeIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
            p.style.transform = 'scale(0)';
            p.style.margin = '20px 0';
            p.style.padding = '20px';
            triggerVibration();
            // Create explosion effect
            if (typeof createBloodSpatter === 'function') {
              createBloodSpatter();
            }
          }
          
          // Apply effects for killing
          if (isKilling) {
            p.style.color = '#ff0000';
            p.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 0, 0, 0.6)';
            p.style.fontWeight = 'bold';
            p.style.fontSize = isActionPacked ? '1.1em' : '1em';
            // Ensure overlay stays visible - don't let text effects affect overlay
            const overlay = document.querySelector('.ultima-cup-overlay');
            if (overlay) {
              overlay.style.position = 'fixed';
              overlay.style.zIndex = '10000';
              overlay.style.pointerEvents = 'auto';
            }
            createBloodSpatter();
            triggerVibration();
          }
          
          // Apply effects for goals only
          if (isGoal) {
            p.className += ' commentary-goal';
            p.style.fontSize = isActionPacked ? '1.3em' : '1.1em';
            p.style.color = '#00ff88';
            p.style.textShadow = '0 0 15px rgba(0, 255, 136, 0.8), 0 0 30px rgba(0, 255, 136, 0.5)';
            // Ensure overlay stays visible
            const overlay = document.querySelector('.ultima-cup-overlay');
            if (overlay) {
              overlay.style.position = 'fixed';
              overlay.style.zIndex = '10000';
              overlay.style.pointerEvents = 'auto';
            }
            triggerVibration();
          } else if (text.includes('💥') || text.includes('🔥') || text.includes('🚨') || text.includes('💣')) {
            p.className += ' commentary-dramatic';
          } else if (text.includes('Full-time') || text.includes('Kickoff')) {
            p.className += ' commentary-important';
          }
          
          // Only apply action-packed styling for goals and killings, not regular commentary
          if (isActionPacked && (isKilling || isGoal)) {
            p.style.fontSize = isGoal ? '1.3em' : '1.2em';
            p.style.fontWeight = 'bold';
            if (!isKilling && !isGoal) {
              p.style.textShadow = '0 0 15px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 215, 0, 0.5)';
            }
            p.style.animation = 'pulse 0.5s ease-in-out';
          }
          
          p.style.marginBottom = '8px';
          p.style.padding = '6px 12px';
          p.style.borderRadius = '4px';
          p.style.overflow = 'hidden';
          p.style.wordWrap = 'break-word';
          p.style.overflowWrap = 'break-word';
          p.style.whiteSpace = 'normal';
          
          // Highlight Saints player names
          if (ourPlayerNames.length > 0) {
            formattedText = highlightSaintsPlayers(formattedText, ourPlayerNames);
          }
          
          // Set initial opacity to 0 for animation
          p.style.opacity = '0';
          p.innerHTML = formattedText;
          
          // Append the element to the commentary container
          com.appendChild(p);
          
          // Helper function to scroll to bottom
          const scrollToBottom = (smooth = false) => {
            if (com) {
              // Use requestAnimationFrame to ensure DOM has updated
              requestAnimationFrame(() => {
                com.scrollTop = com.scrollHeight;
                // Also try scrollIntoView as fallback for the last element
                if (p && p.scrollIntoView && smooth) {
                  p.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
              });
            }
          };
          
          // Apply animation based on context
          if (isActionPacked) {
            // Kinetic animation for action-packed commentary
            p.style.animation = 'commentaryKinetic 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
          } else {
            // Fade-in animation for preamble/regular commentary
            p.style.animation = 'commentaryFadeIn 0.4s ease-out forwards';
          }
          
          // Scroll immediately after appending
          scrollToBottom();
          
          // Resolve after animation completes
          setTimeout(() => {
            scrollToBottom(true);
            resolve();
          }, isActionPacked ? 600 : 400);
        } else {
          log(text);
          resolve();
        }
      }, adjustedDelay);
    });
  };
  
  // Get best rated player for defensive line
  const ourPlayers = getOurSelectedFive();
  const sortedPlayers = ourPlayers.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const bestPlayer = sortedPlayers[0];
  const bestPlayerName = bestPlayer?.name || 'Your best player';
  
  // Get all player names
  const ourPlayerNames = ourPlayers.filter(p => p && p.name).map(p => p.name);
  if (ourPlayerNames.length === 0) {
    ourPlayerNames.push('Your Player 1', 'Your Player 2', 'Your Player 3', 'Your Player 4', 'Your Player 5');
  }
  
  // Try to get actual Portsmouth players, fallback to generic names
  let portsmouthPlayers = [];
  if (typeof makeOpponentSquad === 'function') {
    const portsmouthSquad = makeOpponentSquad('Portsmouth');
    if (Array.isArray(portsmouthSquad) && portsmouthSquad.length > 0) {
      portsmouthPlayers = portsmouthSquad
        .filter(p => p && p.name)
        .map(p => p.name)
        .slice(0, 11);
    }
  }
  if (portsmouthPlayers.length === 0) {
    portsmouthPlayers = ['Portsmouth Player 1', 'Portsmouth Player 2', 'Portsmouth Player 3', 'Portsmouth Player 4', 'Portsmouth Player 5', 'Portsmouth Player 6', 'Portsmouth Player 7', 'Portsmouth Player 8', 'Portsmouth Player 9', 'Portsmouth Player 10', 'Portsmouth Player 11'];
  }
  
  const legendsPlayers = ['Lionel Messi', 'Cristiano Ronaldo', 'Kylian Mbappé', 'Erling Haaland', 'Kevin De Bruyne', 'Virgil van Dijk', 'Mohamed Salah', 'Karim Benzema'];
  const ultimaPlayers = ['Pelé', 'Diego Maradona', 'Johan Cruyff', 'Franz Beckenbauer', 'Alfredo Di Stéfano', 'Ferenc Puskás', 'Garrincha', 'Eusébio'];
  
  // Clear commentary
  if (com) com.innerHTML = '';
  
  try {
    // Track score for commentary
    let saintsGoals = 0;
    let portsmouthGoals = 0;
    let legendsGoals = 0;
    let ultimaGoals = 0;
    let currentMinute = 0;
    
    // OPENING: The whistle blows, but nothing happens
    await addComWithDelay(`The whistle blows...`, 300);
    await addComWithDelay(`But nothing happens.`, 300);
    await addComWithDelay(`The stadium falls silent.`, 300);
    
    // Mohammed Van Onslaught enters
    currentMinute = 1;
    await addComWithDelay(`Mohammed Van Onslaught slowly walks onto the pitch.`, 300, false, currentMinute);
    await addComWithDelay(`He announces that there's a treacherous heretic in our midst.`, 300, false, currentMinute);
    await addComWithDelay(`He pays homage to Delmor Krunchem 'the saviour of footie', who heroically caught video footage of you, chairman of Southampton FC, planting a bomb.`, 300, false, currentMinute);
    await addComWithDelay(`He immediately grants Krunchem an honorary Sheikh-dom.`, 300, false, currentMinute);
    await addComWithDelay(`He announces that Delmor has converted to islam, and that next Season Portsmouth will be rebranded as 'Ramadan Ravens'.`, 300, false, currentMinute);
    
    // Delmor mouths "cunt" at you
    await addComWithDelay(`Delmor Krunchem turns to face you directly. His lips move silently, mouthing a single word: "cunt".`, 300, false, currentMinute);
    
    await addComWithDelay(`Van Onslaught then looks to you and says, "You, you are a vile, treacherous pig, and it is long past time for you to bend the knee."`, 300, false, currentMinute);
    await addComWithDelay(`"You've refused, so I'll break you."`, 300, false, currentMinute);
    await addComWithDelay(`"I hereby sentence the entire Southampton team and their fat Chairman to death."`, 300, false, currentMinute);
  
    // Teams reveal weapons
    currentMinute = 2;
    await addComWithDelay(`At this point the entire three teams you're playing against reveal they've been armed with AK-47s.`, 300, false, currentMinute);
    await addComWithDelay(`They don't realise that your team is also armed.`, 300, false, currentMinute);
    await addComWithDelay(`They are advancing to you.`, 300, false, currentMinute);
    
    // If player has briefcase, show the briefcase reminder text
    const hasBriefcase = S.power_briefcase_owned === true || S.power_briefcase_owned === 'true' || S.power_briefcase_owned === 1 || !!S.power_briefcase_owned;
    if (hasBriefcase) {
      await addComWithDelay(`You've run out of other options. It's time to do something drastic. You remember the Ultima Briefcase sitting in your office.`, 400, false, currentMinute);
    }
    
    // Defensive line
    currentMinute = 3;
    await addComWithDelay(`${bestPlayerName} springs to action and forms a defensive line in front of you, saying 'if you want him, you'll have to go through us'`, 300, false, currentMinute);
    await addComWithDelay(`Your players form a wall of protection around you.`, 300, false, currentMinute);
    
    // Check if players are armed
    const playersArmed = S.ultimaCup && S.ultimaCup.players_armed === true;
    
    if (!playersArmed) {
      // UNARMED PATH: Players get gunned down - FAIL STATE
      currentMinute = 4;
      await addComWithDelay(`The other teams advance.`, 300, false, currentMinute);
      await addComWithDelay(`Your players stand their ground, unarmed.`, 300, false, currentMinute);
      
      // Initialize score tally
      updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
      
      // Log each player being gunned down with blood effects
      if (typeof window.playSoundEffect === 'function') {
        window.playSoundEffect('machineGun', 0.9);
      }
      for (let i = 0; i < ourPlayerNames.length; i++) {
        const playerName = ourPlayerNames[i];
        currentMinute = 5 + i;
        await addComWithDelay(`${playerName} is gunned down in a hail of bullets.`, 300, true, currentMinute, true, playerName);
      }
      
      currentMinute = 15;
      if (typeof window.playSoundEffect === 'function') {
        window.playSoundEffect('machineGun', 0.9);
      }
      await addComWithDelay(`You are reached, and assassinated.`, 300, true, currentMinute);
      
      // Clean up overlay before showing fail state
      if (overlay && overlay.parentNode) {
        overlay.remove();
      }
      
      // Check if player has briefcase to determine which fail state message to show
      const briefcaseValue = S.power_briefcase_owned;
      const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
      
      // Show appropriate fail state based on briefcase status
      if (!hasBriefcase) {
        // Scenario 1: Unarmed, no briefcase
        log(``);
        log(`<div style="padding:30px;background:rgba(255,0,0,0.3);border:4px solid #ff0000;border-radius:20px;margin:30px 0;box-shadow:0 0 40px rgba(255,0,0,0.6);">
          <h2 style="font-size:2rem;color:#ff0000;margin-bottom:20px;text-align:center;text-shadow:0 0 20px rgba(255,0,0,0.8);">💀 YOU HAVE BEEN KILLED 💀</h2>
          <p style="font-size:1.2rem;color:#fff;line-height:1.8;text-align:center;">
            Without weapons and without the briefcase, you and your players are defenseless. You have been killed.
          </p>
        </div>`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await showFailstateMenu();
        // After fail state menu completes, return early - don't continue to victory UI
        return {
          winner: 'portsmouth',
          usGoals: 0,
          portsmouthGoals: 0,
          legendsGoals: 0,
          ultimaGoals: 0,
          bombPath: true,
          playersKilled: true,
          chairmanKilled: true,
          failState: true
        };
      } else {
        // Scenario 2: Unarmed, yes briefcase
        log(``);
        log(`<div style="padding:30px;background:rgba(255,0,0,0.3);border:4px solid #ff0000;border-radius:20px;margin:30px 0;box-shadow:0 0 40px rgba(255,0,0,0.6);">
          <h2 style="font-size:2rem;color:#ff0000;margin-bottom:20px;text-align:center;text-shadow:0 0 20px rgba(255,0,0,0.8);">💀 YOU HAVE BEEN KILLED 💀</h2>
          <p style="font-size:1.2rem;color:#fff;line-height:1.8;text-align:center;">
            You have the briefcase, but your players are unarmed. Without weapons, you cannot defend yourselves. You have been killed.
          </p>
        </div>`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await showFailstateMenu();
        // After fail state menu completes, return early - don't continue to victory UI
        return {
          winner: 'portsmouth',
          usGoals: 0,
          portsmouthGoals: 0,
          legendsGoals: 0,
          ultimaGoals: 0,
          bombPath: true,
          playersKilled: true,
          chairmanKilled: true,
          failState: true
        };
      }
    
    // This return should not be reached for unarmed scenarios (they return above)
    return {
      winner: 'portsmouth',
      usGoals: 0,
      portsmouthGoals: 0,
      legendsGoals: 0,
      ultimaGoals: 0,
      bombPath: true,
      playersKilled: true,
      chairmanKilled: true,
      failState: true
    };
  } else {
    // ARMED PATH: Violent football match
    currentMinute = 4;
    await addComWithDelay(`Your players reveal their weapons.`, 300, false, currentMinute);
    await addComWithDelay(`There is a moment of stunned silence.`, 300, false, currentMinute);
    
    // The big moment
    await addComWithDelay(`FUCKING GET IN THERE AND RUIN THOSE CUNTS`, 300, false, null, false);
    
    // Stop first audio and start second audio track
    if (window._ultimaCupFirstAudio) {
      window._ultimaCupFirstAudio.pause();
      window._ultimaCupFirstAudio.currentTime = 0;
      window._ultimaCupFirstAudio = null;
    }
    const secondAudio = new Audio('https://www.dropbox.com/scl/fi/f1v29tjkeusk4ar4mscyq/uktima-spastic.mp3?rlkey=ivdn8zvb120vu2c4ik0cxv237&st=efpcxvs9&dl=1');
    secondAudio.loop = true;
    secondAudio.volume = 0.7;
    secondAudio.play().catch(err => {});
    window._ultimaCupSecondAudio = secondAudio;
    
    // Match proper starts
    currentMinute = 5;
    await addComWithDelay(`Your players spring to action. Here we go...`, 300, false, currentMinute, false);
    
    // Track deaths and goals
    const deadPlayers = new Set();
    const deadPortsmouth = new Set();
    const deadLegends = new Set();
    const deadUltima = new Set();
    
    // Get two best players (they will die)
    const twoBestPlayers = sortedPlayers.slice(0, 2).map(p => p.name);
    
    // Generate violent scenarios
    const violentScenarios = generateViolentScenarios();
    const bestPlayerKillScenarios = generateBestPlayerKillScenarios();
    
    // Initialize score tally
    updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
    
    // Play out the match with violence - sequential timer from 5 to 90
    const matchEvents = [];
    let eventIndex = 0;
    
    // Generate events for the match
    for (let minute = 5; minute <= 90; minute++) {
      // Random chance of event happening at this minute
      if (Math.random() < 0.15 && eventIndex < 25) {
        const scenario = pick(violentScenarios);
        const teamRoll = Math.random();
        let attacker, victim, victimTeam, victimName, isSaintsKilling = true;
        
        const availableAttackers = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
        
        // Determine who attacks whom
        if (teamRoll < 0.5 && availableAttackers.length > 0) {
          // Saints attack
          attacker = pick(availableAttackers);
          isSaintsKilling = true;
          
          const targetRoll = Math.random();
          if (targetRoll < 0.4) {
            // Attack Portsmouth
            const availablePortsmouth = portsmouthPlayers.filter(n => !deadPortsmouth.has(n));
            if (availablePortsmouth.length > 0) {
              victim = pick(availablePortsmouth);
              victimTeam = 'portsmouth';
              victimName = victim;
              deadPortsmouth.add(victim);
            }
          } else if (targetRoll < 0.7) {
            // Attack Legends
            const availableLegends = legendsPlayers.filter(n => !deadLegends.has(n));
            if (availableLegends.length > 0) {
              victim = pick(availableLegends);
              victimTeam = 'legends';
              victimName = victim;
              deadLegends.add(victim);
            }
          } else {
            // Attack Ultima
            const availableUltima = ultimaPlayers.filter(n => !deadUltima.has(n));
            if (availableUltima.length > 0) {
              victim = pick(availableUltima);
              victimTeam = 'ultima';
              victimName = victim;
              deadUltima.add(victim);
            }
          }
        } else {
          // Other teams attack Saints (less frequent)
          isSaintsKilling = false;
          const availableSaints = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
          if (availableSaints.length > 0 && Math.random() < 0.2) {
            victim = pick(availableSaints);
            victimTeam = 'saints';
            victimName = victim;
            deadPlayers.add(victim);
            
            // Pick attacker from other teams
            const attackerRoll = Math.random();
            if (attackerRoll < 0.4) {
              attacker = pick(portsmouthPlayers.filter(n => !deadPortsmouth.has(n)));
            } else if (attackerRoll < 0.7) {
              attacker = pick(legendsPlayers.filter(n => !deadLegends.has(n)));
            } else {
              attacker = pick(ultimaPlayers.filter(n => !deadUltima.has(n)));
            }
          }
        }
        
        if (attacker && victim) {
          matchEvents.push({
            minute: minute,
            scenario: scenario,
            attacker: attacker,
            victim: victim,
            victimTeam: victimTeam,
            isSaintsKilling: isSaintsKilling
          });
          eventIndex++;
        }
      }
      
      // Random goal chances (independent of killings)
      if (Math.random() < 0.08) {
        const goalRoll = Math.random();
        if (goalRoll < 0.5) {
          // Saints goal
          matchEvents.push({ minute: minute, type: 'goal', team: 'saints' });
        } else if (goalRoll < 0.7) {
          // Portsmouth goal
          matchEvents.push({ minute: minute, type: 'goal', team: 'portsmouth' });
        } else if (goalRoll < 0.85) {
          // Legends goal
          matchEvents.push({ minute: minute, type: 'goal', team: 'legends' });
        } else {
          // Ultima goal
          matchEvents.push({ minute: minute, type: 'goal', team: 'ultima' });
        }
      }
    }
    
    // Add specific murder scenes
    const availableKillersForSpecial = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
    if (availableKillersForSpecial.length > 0) {
      // Referee curb stomp murder (around minute 20-30)
      const refereeKiller = pick(availableKillersForSpecial);
      matchEvents.push({
        minute: 20 + Math.floor(Math.random() * 10),
        type: 'special',
        subtype: 'referee_curb_stomp',
        attacker: refereeKiller
      });
      
      // Fourth official flag impalement (around minute 35-45)
      const fourthOfficialKiller = pick(availableKillersForSpecial.filter(n => n !== refereeKiller));
      if (fourthOfficialKiller) {
        matchEvents.push({
          minute: 35 + Math.floor(Math.random() * 10),
          type: 'special',
          subtype: 'fourth_official_impalement',
          attacker: fourthOfficialKiller
        });
      }
      
      // VAR grenades (around minute 50-60)
      const varKiller = pick(availableKillersForSpecial);
      matchEvents.push({
        minute: 50 + Math.floor(Math.random() * 10),
        type: 'special',
        subtype: 'var_grenades',
        attacker: varKiller
      });
      
      // Brick throwing at Delmor Krunchem (around minute 40-50)
      matchEvents.push({
        minute: 40 + Math.floor(Math.random() * 10),
        type: 'special',
        subtype: 'brick_at_krunchem'
      });
      
      // Brick throwing at Mohammed Van Onslaught (around minute 45-55)
      matchEvents.push({
        minute: 45 + Math.floor(Math.random() * 10),
        type: 'special',
        subtype: 'brick_at_van_onslaught'
      });
      
      // Narrowly dodge bazooka from Krunchem (around minute 55-65)
      matchEvents.push({
        minute: 55 + Math.floor(Math.random() * 10),
        type: 'special',
        subtype: 'dodge_bazooka'
      });
      
      // Player grenade in mouth (around minute 65-75)
      const grenadeKiller = pick(availableKillersForSpecial);
      const grenadeVictim = pick([...portsmouthPlayers, ...legendsPlayers, ...ultimaPlayers].filter(n => !deadPortsmouth.has(n) && !deadLegends.has(n) && !deadUltima.has(n)));
      if (grenadeVictim) {
        matchEvents.push({
          minute: 65 + Math.floor(Math.random() * 10),
          type: 'special',
          subtype: 'grenade_in_mouth',
          attacker: grenadeKiller,
          victim: grenadeVictim
        });
      }
    }
    
    // Sort events by minute
    matchEvents.sort((a, b) => a.minute - b.minute);
    
    // Track if we've shown the first violent event crowd reaction
    let firstViolenceShown = false;
    
    // Play out events sequentially
    for (const event of matchEvents) {
      currentMinute = event.minute;
      
      if (event.type === 'goal') {
        let scorer = '';
        if (event.team === 'saints') {
          saintsGoals++;
          const availableScorers = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
          scorer = availableScorers.length > 0 ? pick(availableScorers) : 'Southampton';
          const goalText = `GOAL! ${scorer} scores!`;
          await addComWithDelay(addAudienceReaction(goalText), 300, false, currentMinute, true);
        } else if (event.team === 'portsmouth') {
          portsmouthGoals++;
          scorer = pick(portsmouthPlayers.filter(n => !deadPortsmouth.has(n))) || 'Portsmouth';
          await addComWithDelay(`GOAL! ${scorer} scores for Portsmouth!`, 300, false, currentMinute, true);
        } else if (event.team === 'legends') {
          legendsGoals++;
          scorer = pick(legendsPlayers.filter(n => !deadLegends.has(n))) || 'Legends FC';
          await addComWithDelay(`GOAL! ${scorer} scores for Legends FC!`, 300, false, currentMinute, true);
        } else if (event.team === 'ultima') {
          ultimaGoals++;
          scorer = pick(ultimaPlayers.filter(n => !deadUltima.has(n))) || 'Ultima FC';
          await addComWithDelay(`GOAL! ${scorer} scores for Ultima FC!`, 300, false, currentMinute, true);
        }
        updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
      } else if (event.type === 'special') {
        // Handle special murder scenes - split into multiple entries
        let murderText = '';
        if (event.subtype === 'referee_curb_stomp') {
          murderText = `The referee attempts to give one of your players a red card, but before he can finish, ${event.attacker} knocks him to the floor with a devastating blow! The referee's jaw shatters on impact, teeth flying! ${event.attacker} drags the screaming official to the dugout, forces his face against the concrete steps, and makes him bite down on the edge! Then ${event.attacker} begins curb stomping the referee's head repeatedly! Each stomp crunches bone, blood spraying with every impact! The referee's skull fractures, then splits, brain matter oozing out! ${event.attacker} continues stomping until the head is completely split in half, the two halves splayed open like a grotesque flower! The referee is dead, and the audience screams with glee!`;
        } else if (event.subtype === 'fourth_official_impalement') {
          murderText = `The fourth official attempts to disallow a recent goal for offside, raising his flag! ${event.attacker} snatches the flag from his hands! The fourth official screams in terror as ${event.attacker} jabs the flag into his eye with brutal force! The flag tears through the eye socket, impaling him through the head! Blood and brain matter spray everywhere as the flag exits through the back of his skull! The fourth official's body convulses violently, blood gushing from both eye sockets! The flag is embedded in his head like a grotesque trophy!`;
        } else if (event.subtype === 'var_grenades') {
          murderText = `The match is paused briefly while the VAR officials check footage in their room! ${event.attacker} and your players throw a series of grenades into the VAR room! The explosion is deafening, the room erupting in a massive fireball! The VAR officials are torn apart in a red mist of blood and guts! Chunks of flesh, bone, and viscera fly everywhere as the room is reduced to rubble! Blood and organs splatter across the walls and floor! The VAR room is a charnel house of death!`;
        } else if (event.subtype === 'grenade_in_mouth') {
          murderText = `${event.attacker} rams a hand grenade into ${event.victim}'s mouth, forcing it deep down their throat! ${event.victim} gags and chokes, eyes wide with terror! The grenade detonates, and ${event.victim}'s entire head explodes in a spray of blood, brain matter, and bone fragments! Brains go everywhere, splattering across the pitch like a crimson rain! Chunks of skull and viscera fly through the air! The headless body collapses, blood gushing from the neck stump!`;
          // Mark victim as dead
          if (portsmouthPlayers.includes(event.victim)) deadPortsmouth.add(event.victim);
          else if (legendsPlayers.includes(event.victim)) deadLegends.add(event.victim);
          else if (ultimaPlayers.includes(event.victim)) deadUltima.add(event.victim);
        } else if (event.subtype === 'brick_at_krunchem') {
          // Brick throwing at Delmor Krunchem
          await addComWithDelay(`You attempt to throw a brick at Delmor Krunchem, but before it can reach him, he fires a bazooka at the brick and destroys it mid-air! The brick explodes in a shower of fragments, the bazooka round detonating with a deafening blast!`, 300, false, currentMinute, false);
          murderText = null; // Not a murder scene
        } else if (event.subtype === 'brick_at_van_onslaught') {
          // Brick throwing at Mohammed Van Onslaught
          await addComWithDelay(`You attempt to throw a brick at Mohammed Van Onslaught, but he performs some kind of Muslim spell or curse which causes the brick to disintegrate prior to impact! The brick crumbles into dust mid-flight, particles scattering in the wind as Van Onslaught smirks with dark satisfaction!`, 300, false, currentMinute, false);
          murderText = null; // Not a murder scene
        } else if (event.subtype === 'dodge_bazooka') {
          // Narrowly dodge bazooka from Krunchem
          await addComWithDelay(`Delmor Krunchem fires a bazooka at you! The rocket screams through the air, but you narrowly dodge it at the last second! The bazooka round explodes behind you, sending a shockwave of heat and debris across the pitch!`, 300, false, currentMinute, false);
          murderText = null; // Not a murder scene
        }
        
        // Split the murder scene into multiple entries (only if it's a murder scene)
        if (murderText) {
          const murderParts = splitMurderScene(murderText, currentMinute);
          for (let i = 0; i < murderParts.length; i++) {
            await addComWithDelay(murderParts[i], 300, true, currentMinute, true, event.attacker);
          }
        }
        
        // Add crowd reaction after first violent event
        if (!firstViolenceShown) {
          firstViolenceShown = true;
          const crowdReaction = getAudienceReaction();
          await addComWithDelay(`The crowd erupts in a frenzy! "${crowdReaction}" The stadium shakes with bloodthirsty chants!`, 300, false, currentMinute, false);
        }
      } else {
        // Killing event - split into multiple entries
        const scenarioText = event.scenario
          .replaceAll('{ATTACKER}', event.attacker)
          .replaceAll('{VICTIM}', event.victim);
        
        // Split the murder scene into multiple entries
        const murderParts = splitMurderScene(scenarioText, currentMinute);
        for (let i = 0; i < murderParts.length; i++) {
          const partText = addAudienceReaction(murderParts[i]);
          await addComWithDelay(partText, 300, true, currentMinute, true, event.isSaintsKilling ? event.attacker : null);
        }
        
        // Add crowd reaction after first violent event
        if (!firstViolenceShown) {
          firstViolenceShown = true;
          const crowdReaction = getAudienceReaction();
          await addComWithDelay(`The crowd erupts in a frenzy! "${crowdReaction}" The stadium shakes with bloodthirsty chants!`, 300, false, currentMinute, false);
        }
        
        // Check if this involves decapitation and head-as-ball goal
        if (event.scenario.includes('decapitated') || event.scenario.includes('head')) {
          if (event.isSaintsKilling) {
            saintsGoals++;
            currentMinute++;
            await addComWithDelay(addAudienceReaction(`GOAL! ${event.attacker} scores with ${event.victim}'s decapitated head!`), 300, false, currentMinute, true);
            updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
          }
        } else if (Math.random() < 0.25 && event.isSaintsKilling) {
          // Regular goal chance after killing
          saintsGoals++;
          currentMinute++;
          await addComWithDelay(addAudienceReaction(`GOAL! ${event.attacker} scores in the chaos!`), 300, false, currentMinute, true);
          updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
        }
      }
    }
    
    // Kill the two best players - Delmor Krunchem fires bazooka at them
    for (const bestPlayerName of twoBestPlayers) {
      currentMinute = Math.min(90, currentMinute + 1);
      const killScenario = `Delmor Krunchem raises a bazooka and fires directly at ${bestPlayerName}! The rocket-propelled grenade screams through the air and impacts ${bestPlayerName} with devastating force! The explosion tears ${bestPlayerName}'s body apart in a cataclysmic blast of fire, blood, and viscera! ${bestPlayerName}'s limbs are ripped from their torso, flying in all directions as chunks of flesh, bone, and organs are hurled across the pitch! The blast wave sends a spray of blood and gore cascading over the front rows of the audience, drenching them in crimson! Spectators in the first ten rows are splattered with blood, chunks of flesh, fragments of bone, and pulverized organs! ${bestPlayerName}'s head is torn from their shoulders and sent spinning through the air, trailing blood and brain matter before crashing into the stands! Ribs, vertebrae, and shards of skull rain down on the crowd like a grisly hailstorm! The explosion leaves a crater of gore where ${bestPlayerName} once stood, with blood pooling and organs scattered across the grass! The audience screams in a mixture of horror and ecstatic delight as they wipe blood and chunks of flesh from their faces, their clothes soaked crimson!`;
      await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true, bestPlayerName);
      deadPlayers.add(bestPlayerName);
    }
    
    // Ensure Saints win on goals (add more if needed)
    while (saintsGoals <= Math.max(portsmouthGoals, legendsGoals, ultimaGoals)) {
      saintsGoals++;
      currentMinute = Math.min(90, currentMinute + 1);
      const availableScorers = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
      if (availableScorers.length > 0) {
        const scorer = pick(availableScorers);
        await addComWithDelay(addAudienceReaction(`GOAL! ${scorer} scores!`), 300, false, currentMinute, true);
      } else {
        await addComWithDelay(addAudienceReaction(`GOAL! Southampton scores!`), 300, false, currentMinute, true);
      }
      updateScoreTally(saintsGoals, portsmouthGoals, legendsGoals, ultimaGoals);
    }
    
    // Ensure only 2 Portsmouth players remain
    const portsmouthDead = deadPortsmouth.size;
    let portsmouthRemaining = portsmouthPlayers.length - portsmouthDead;
    while (portsmouthRemaining > 2) {
      const toKill = portsmouthPlayers.find(p => !deadPortsmouth.has(p));
      if (!toKill) break; // No more to kill
      deadPortsmouth.add(toKill);
      portsmouthRemaining--;
      currentMinute = Math.min(90, currentMinute + 1);
      const availableKillers = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
      if (availableKillers.length > 0) {
        const killer = pick(availableKillers);
        const killScenario = pick(violentScenarios).replaceAll('{ATTACKER}', killer).replaceAll('{VICTIM}', toKill);
        await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true, killer);
      } else {
        const killScenario = pick(bestPlayerKillScenarios).replaceAll('{VICTIM}', toKill);
        await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true);
      }
    }
    
    // Kill all Legends and Ultima players
    const availableKillers = ourPlayerNames.filter(n => !deadPlayers.has(n) && !twoBestPlayers.includes(n));
    for (const legend of legendsPlayers) {
      if (!deadLegends.has(legend)) {
        deadLegends.add(legend);
        currentMinute = Math.min(90, currentMinute + 1);
        if (availableKillers.length > 0) {
          const killer = pick(availableKillers);
          const killScenario = pick(violentScenarios).replaceAll('{ATTACKER}', killer).replaceAll('{VICTIM}', legend);
          await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true, killer);
        } else {
          const killScenario = pick(bestPlayerKillScenarios).replaceAll('{VICTIM}', legend);
          await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true);
        }
      }
    }
    
    for (const ultima of ultimaPlayers) {
      if (!deadUltima.has(ultima)) {
        deadUltima.add(ultima);
        currentMinute = Math.min(90, currentMinute + 1);
        if (availableKillers.length > 0) {
          const killer = pick(availableKillers);
          const killScenario = pick(violentScenarios).replaceAll('{ATTACKER}', killer).replaceAll('{VICTIM}', ultima);
          await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true, killer);
        } else {
          const killScenario = pick(bestPlayerKillScenarios).replaceAll('{VICTIM}', ultima);
          await addComWithDelay(addAudienceReaction(killScenario), 300, true, currentMinute, true);
        }
      }
    }
    
    // End of match: Run out of ammo
    currentMinute = 90;
    await addComWithDelay(`Full-time: ${getClubName()} ${saintsGoals} – Portsmouth ${portsmouthGoals} – Legends FC ${legendsGoals} – Ultima FC ${ultimaGoals}`, 300, false, currentMinute);
    
    // Check if players are armed - if so, show special victory sequence
    const playersArmed = S.ultimaCup && S.ultimaCup.players_armed === true;
    if (playersArmed) {
      // Show "SOUTHAMPTON ARE THE BEST TEAM IN THE UNIVERSE" UI
      const victoryOverlay = document.createElement('div');
      victoryOverlay.className = 'ultima-cup-victory-overlay';
      victoryOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.5s ease-out;
      `;
      
      const container = document.createElement('div');
      container.style.cssText = `
        text-align: center;
        padding: 60px;
        background: linear-gradient(135deg, rgba(20, 10, 30, 0.98), rgba(30, 15, 40, 0.95));
        border: 5px solid #FFD700;
        border-radius: 30px;
        box-shadow: 0 0 100px rgba(255, 215, 0, 0.6), 0 0 200px rgba(255, 215, 0, 0.4);
        max-width: 90%;
        animation: victoryPulse 2s ease-in-out infinite;
      `;
      
      const title = document.createElement('div');
      title.style.cssText = `
        font-size: 4rem;
        font-weight: bold;
        color: #FFD700;
        text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6);
        margin-bottom: 30px;
        line-height: 1.2;
        animation: textGlow 2s ease-in-out infinite;
      `;
      title.textContent = `SOUTHAMPTON ARE THE BEST TEAM IN THE UNIVERSE`;
      
      container.appendChild(title);
      victoryOverlay.appendChild(container);
      document.body.appendChild(victoryOverlay);
      
      // Add CSS animations if not already present
      if (!document.getElementById('ultima-victory-styles')) {
        const style = document.createElement('style');
        style.id = 'ultima-victory-styles';
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes victoryPulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 100px rgba(255, 215, 0, 0.6), 0 0 200px rgba(255, 215, 0, 0.4); }
            50% { transform: scale(1.02); box-shadow: 0 0 150px rgba(255, 215, 0, 0.8), 0 0 300px rgba(255, 215, 0, 0.6); }
          }
          @keyframes textGlow {
            0%, 100% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6); }
            50% { text-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 100px rgba(255, 215, 0, 0.8); }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Wait for user to click to continue
      await new Promise((resolve) => {
        const continueBtn = document.createElement('button');
        continueBtn.textContent = 'Continue';
        continueBtn.style.cssText = `
          margin-top: 40px;
          padding: 20px 60px;
          font-size: 1.5rem;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          border: 3px solid #FFD700;
          border-radius: 15px;
          cursor: pointer;
          font-weight: bold;
          box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
          transition: all 0.3s;
        `;
        continueBtn.onmouseover = () => {
          continueBtn.style.transform = 'scale(1.05)';
          continueBtn.style.boxShadow = '0 0 40px rgba(255, 215, 0, 0.8)';
        };
        continueBtn.onmouseout = () => {
          continueBtn.style.transform = 'scale(1)';
          continueBtn.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
        };
        continueBtn.onclick = () => {
          victoryOverlay.remove();
          resolve();
        };
        container.appendChild(continueBtn);
      });
      
      // Now show the dialogue UI
      const dialogueOverlay = document.createElement('div');
      dialogueOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 20001;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      const dialogueContainer = document.createElement('div');
      dialogueContainer.style.cssText = `
        text-align: center;
        padding: 40px;
        background: linear-gradient(135deg, rgba(20, 10, 30, 0.98), rgba(30, 15, 40, 0.95));
        border: 3px solid #FFD700;
        border-radius: 20px;
        box-shadow: 0 0 50px rgba(255, 215, 0, 0.5);
        max-width: 800px;
        color: #fff;
      `;
      
      const dialogueText = document.createElement('div');
      dialogueText.style.cssText = `
        font-size: 1.3rem;
        line-height: 1.8;
        margin-bottom: 30px;
      `;
      dialogueText.innerHTML = `
        <p style="font-size: 1.5rem; color: #FFD700; font-weight: bold; margin-bottom: 20px;">
          Saints are finally confirmed to be the greatest team in the universe!! We already knew this of course, but now everyone else does!
        </p>
        <p style="margin-top: 20px;">
          Your boys have run out of ammo.
        </p>
        <p style="margin-top: 20px;">
          Three Pompey players and a group of armed Saudi emissaries are advancing on your team, about to kill them.
        </p>
      `;
      
      dialogueContainer.appendChild(dialogueText);
      
      const continueBtn2 = document.createElement('button');
      continueBtn2.textContent = 'Continue';
      continueBtn2.style.cssText = `
        margin-top: 20px;
        padding: 15px 40px;
        font-size: 1.2rem;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #000;
        border: 3px solid #FFD700;
        border-radius: 10px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
      `;
      
      dialogueOverlay.appendChild(dialogueContainer);
      document.body.appendChild(dialogueOverlay);
      
      // Wait for user to click to continue
      await new Promise((resolve) => {
        continueBtn2.onclick = () => {
          dialogueOverlay.remove();
          resolve();
        };
        dialogueContainer.appendChild(continueBtn2);
      });
      
      // After dialogue overlay is removed, check if player has briefcase and armed players
      // If so, skip the commentary box continue button and return immediately
      // so that ultimaCupKickoffBombPath can call showUltimaCupVictoryUIBombPath
      const briefcaseValue = S.power_briefcase_owned;
      const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
      
      // Ensure ultimaCup object exists
      if (!S.ultimaCup) {
        S.ultimaCup = {};
      }
      
      // Check for armed players
      const playersArmedValue = S.ultimaCup.players_armed;
      const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
      
      // If player has briefcase and armed players, skip commentary box and return immediately
      if (hasBriefcase && hasArmedPlayers) {
        // Return early - don't show commentary box continue button
        // The outcome will be handled by ultimaCupKickoffBombPath which will call showUltimaCupVictoryUIBombPath
        return {
          winner: 'us',
          usGoals: saintsGoals,
          portsmouthGoals: portsmouthGoals,
          legendsGoals: legendsGoals,
          ultimaGoals: ultimaGoals,
          bombPath: true,
          playersArmed: true,
          twoBestPlayersKilled: true,
          ammoOut: true
        };
      }
    } else {
      // Original dialogue for unarmed path
      await addComWithDelay(`Your boys have run out of ammo.`, 300, false, currentMinute);
      await addComWithDelay(`Three Pompey players and a group of armed Saudi emissaries are advancing on your team, about to kill them.`, 300, false, currentMinute);
    }
    
    // Show continue button (only if we didn't return early above)
    if (skipBtn) {
      skipBtn.style.display = 'block';
      skipBtn.textContent = 'Continue...';
      await new Promise(resolve => {
        const checkContinue = () => {
          if (skipRequested) {
            resolve();
          } else {
            setTimeout(checkContinue, 100);
          }
        };
        checkContinue();
      });
    }
    
    // Return result (overlay cleanup in finally)
    return {
      winner: 'us',
      usGoals: saintsGoals,
      portsmouthGoals: portsmouthGoals,
      legendsGoals: legendsGoals,
      ultimaGoals: ultimaGoals,
      bombPath: true,
      playersArmed: true,
      twoBestPlayersKilled: true,
      ammoOut: true
    };
  }
} finally {
    // Ensure overlay is removed even if there's an error
    if (overlay && overlay.parentNode) {
      overlay.remove();
    }
    // Clean up audio tracks
    if (window._ultimaCupFirstAudio) {
      window._ultimaCupFirstAudio.pause();
      window._ultimaCupFirstAudio.currentTime = 0;
      window._ultimaCupFirstAudio = null;
    }
    if (window._ultimaCupSecondAudio) {
      window._ultimaCupSecondAudio.pause();
      window._ultimaCupSecondAudio.currentTime = 0;
      window._ultimaCupSecondAudio = null;
    }
  }
}
