/* === Patch 4B.1 — Oversight routing + balance === */
(function(){
  if (window.__patch4B1Applied) return;
  window.__patch4B1Applied = true;

  // ---------- utils ----------
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function rint(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
  function weightedPick(items){ // [{k,w}]
    let sum = 0; for (const it of items) sum += Math.max(0, it.w|0);
    if (sum <= 0) return null;
    let r = Math.random()*sum;
    for (const it of items){ r -= Math.max(0, it.w|0); if (r <= 0) return it.k; }
    return items.length ? items[items.length-1].k : null;
  }
  function feedLog(msg){ try{ (window.log||console.log)(msg); }catch(e){} }

  // ---------- state/backfill ----------
  function ensureState(){
    if (!window.S) window.S = {};
    if (!Array.isArray(S.knock_queue)) S.knock_queue = [];
    if (typeof S._investigationCooldown !== "number") S._investigationCooldown = 0;
    if (typeof S._lastAuthority !== "string") S._lastAuthority = "";
    if (typeof S.bribes_count !== "number") S.bribes_count = 0;
    if (typeof S.fixed_matches !== "number") S.fixed_matches = 0;
    // soft defaults for risks
    if (typeof S.compliance_risk !== "number") S.compliance_risk = 0;
    if (typeof S.legal_risk !== "number") S.legal_risk = 0;
    if (typeof S.fa_risk !== "number") S.fa_risk = 0;
    if (typeof S.police_risk !== "number") S.police_risk = 0;
  }

  // ---------- queue an investigation to knockdoor ----------
  function queueInvestigation(authority, caseType){
    ensureState();
    S.knock_queue.push({ type:"investigation", authority, caseType });
  }

  // ---------- decide whether to queue an investigation post‑match ----------
  function maybeQueueOversight(){
    ensureState();

    // Cooldown to avoid spam
    if ((S._investigationCooldown|0) > 0){
      S._investigationCooldown = Math.max(0, (S._investigationCooldown|0) - 1);
      return;
    }
    
    const bribes   = S.bribes_count|0;
    const fixed    = S.fixed_matches|0;
    const arrears  = (Array.isArray(S.unpaid_transfers) ? S.unpaid_transfers.length : 0) + (S.debt_club>0 ? 1:0);
    const repBad   = (S.reputation||50) < 15;

    const compliance = S.compliance_risk|0;  // club/board issues
    const legal      = S.legal_risk|0;       // FA/legal exposure
    const police     = S.police_risk|0;      // criminal exposure
    
    // Extra cooldown for police investigations
    if ((S._police_investigation_cooldown|0) > 0){
      S._police_investigation_cooldown = Math.max(0, (S._police_investigation_cooldown|0) - 1);
      // If police cooldown is active, don't allow police investigations
      const boardElig  = (compliance >= 25) || (arrears>0) || repBad;
      const faElig     = (legal >= 25) || (fixed >= 1) || (bribes >= 2);
      if (!boardElig && !faElig) return; // No other investigations available
    }

    // Eligibility (Board/FA appear earlier; Police later)
    const boardElig  = (compliance >= 25) || (arrears>0) || repBad;
    const faElig     = (legal >= 25) || (fixed >= 1) || (bribes >= 2);
    // Police should only investigate when there are actual crimes, not just high risk
    // Only trigger police investigations for serious crimes: multiple match-fixing or heavy bribery
    const policeElig = (fixed >= 2) || (bribes >= 4);

    if (!boardElig && !faElig && !policeElig) return;

    // Trigger chance — rarer overall (3%..18% depending on aggregate risk)
    const agg = clamp(compliance + legal + police + bribes*2 + fixed*5, 0, 100);
    const p = clamp(0.03 + agg*0.0015, 0.03, 0.18);
    if (Math.random() >= p) return;

    const weights = [];
    if (boardElig)  weights.push({k:'board',  w: 40 + clamp(compliance*2 + (arrears?15:0) + (repBad?10:0), 0, 60)});
    if (faElig)     weights.push({k:'fa',     w: 30 + clamp(legal*2 + fixed*10 + bribes*3, 0, 60)});
    if (policeElig) weights.push({k:'police', w:      clamp((police-14)*3 + fixed*12 + bribes*4, 0, 40)});

    // discourage immediate repeats
    for (const w of weights){ if (w.k === S._lastAuthority) w.w = Math.round(w.w * 0.6); }

    const chosen = weightedPick(weights);
    if (!chosen) return;

    // Case flavour
    let caseType = 'irregularities';
    if (chosen==='board'){
      caseType = arrears ? 'arrears' : (compliance>=14 ? 'compliance' : 'reputation');
    } else if (chosen==='fa'){
      caseType = (fixed>=1) ? 'matchfixing' : (bribes>=2 ? 'bribery' : 'misconduct');
    } else if (chosen==='police'){
      // Police should only investigate actual crimes, not "irregularities"
      // Corruption requires 6+ bribes (more serious threshold)
      caseType = (fixed>=2) ? 'matchfixing' : (bribes>=6 ? 'corruption' : 'financial');
    }

    queueInvestigation(chosen, caseType);
    S._lastAuthority = chosen;
    // Cooldown 2–4 matches so it feels paced
    S._investigationCooldown = rint(2,4);
    
    // Extra cooldown for police investigations to prevent immediate re-arrests
    if (chosen === 'police') {
      S._investigationCooldown = Math.max(S._investigationCooldown, 4);
      S._police_investigation_cooldown = 6; // 6 matches before another police investigation
    }
  }

  // ---------- route investigations through knockdoor ----------
  (function wrapKnockDoor(){
    const orig = window.openKnockDoor;
    if (typeof orig !== "function" || window.__oversightKDWrapped) return;
    window.__oversightKDWrapped = true;

    window.openKnockDoor = async function(){
      ensureState();
      // consume only ONE queued investigation per door‑knock to avoid option pile‑ups
      if (Array.isArray(S.knock_queue) && S.knock_queue.length){
        const v = S.knock_queue[0];
        if (v && v.type === "investigation"){
          // remove ref‑blackmail buttons if present so UIs don't mingle
          try{
            document.querySelectorAll('button[data-refblackmail="1"]').forEach(n=>n.remove());
          }catch(_){}

          S.knock_queue.shift();
          await window.presentInvestigation(v);
          return; // handle one item, then exit so player responds
        }
      }
      return await orig.apply(this, arguments);
    };
  })();

  // Expose the enforcement function globally for use by other systems
  window.enforcePoliceInterviewBeforePrison = enforcePoliceInterviewBeforePrison;

  // ---------- Police Interview Enforcement System ----------
  function enforcePoliceInterviewBeforePrison(caseType, prisonTerm, fineChair, fineClub) {
    // Check if a police case was already resolved without prison
    if (S._police_case_resolved) {
      S._police_case_resolved = false; // Reset flag
      return false; // Don't send to prison
    }
    
    // Queue a police investigation if not already in progress
    if (!S._police_interview_in_progress) {
      S._police_interview_in_progress = true;
      queueInvestigation('police', caseType);
      return true; // Investigation queued
    }
    
    return false; // Interview already in progress
  }
  
  // ---------- Harassment Charges Plea/Verdict System ----------
  function presentHarassmentPleaSystem(caseType, severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("🏛️ COURT HEARING — Workplace Harassment Charges");
    feedLog("The magistrate looks sternly at you. 'You are charged with workplace harassment via inappropriate messages to your secretary.'");
    feedLog("'How do you plead?'");
    
    addBtn("Guilty - I made a mistake.", 'warn', function(){
      feedLog("You admit guilt. The magistrate nods gravely.");
      clearBtns();
      presentHarassmentGuiltyPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("Not Guilty - I was misunderstood.", '', function(){
      feedLog("You plead not guilty. The magistrate raises an eyebrow.");
      clearBtns();
      presentHarassmentNotGuiltyPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("No Contest - I want to avoid trial.", '', function(){
      feedLog("You enter a plea of no contest. The magistrate accepts it.");
      clearBtns();
      presentHarassmentNoContestPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
  }
  
  function presentHarassmentGuiltyPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("The magistrate considers your guilty plea. 'Given your admission, I can offer some leniency.'");
    
    // Reduced sentence for guilty plea
    const reducedPrison = Math.max(1, Math.floor(prisonTerm * 0.7));
    const reducedFineC = Math.floor(fineC * 0.8);
    const reducedFineK = Math.floor(fineK * 0.8);
    
    feedLog(`"I sentence you to: Personal fine £${reducedFineC.toLocaleString()}, Club fine £${reducedFineK.toLocaleString()}."`);
    feedLog("'Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct.'");
    
    addBtn("Accept the reduced sentence.", 'warn', function(){
      try {
        // Safety check: ensure functions exist before calling
        if (typeof fineChair === 'function') {
          fineChair(reducedFineC);
        } else {
          S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, reducedFineC||0));
        }
        
        if (typeof fineClub === 'function') {
          fineClub(reducedFineK);
        } else {
          S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, reducedFineK||0));
        }
        
        // Harassment charges result in fine and krazy register, NOT prison time
        S.police_risk = Math.max(0, (S.police_risk||0) - 4);
        
        // Add press coverage for harassment conviction
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of workplace harassment', 15);
        }
        S.reputation = Math.max(0, (S.reputation||0) - 15);
        
        feedLog("You accept the sentence. The case is closed.");
        feedLog("📰 The press reports: 'Chairman convicted of workplace harassment'");
        feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
        
        S._police_interview_active = false;
        
        // Safety check before clearing buttons
        if (typeof clearBtns === 'function') {
          clearBtns();
        } else {
          try {
            const actions = document.getElementById('actions') || document.getElementById('choices');
            if (actions) {
              const buttons = actions.querySelectorAll('button[data-investigation="1"]');
              buttons.forEach(btn => btn.remove());
            }
          } catch(e) {
            console.error("Error clearing buttons:", e);
          }
        }
        
        // Directly place on KRAZY register when guilty plea is accepted
        // Ensure function is accessible (it should be defined earlier in the file)
        if (typeof window.placeOnKrazyRegister === 'function') {
          window.placeOnKrazyRegister(severity);
        } else if (typeof placeOnKrazyRegister === 'function') {
          placeOnKrazyRegister(severity);
        } else {
          // Fallback if function doesn't exist - call it directly
          const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
          S.onKrazyRegister = true;
          S.krazyGamesRemaining = krazyGames;
          feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
          feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
          if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
          if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
          if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
        }
        
        if (typeof update === 'function') {
          update();
        } else if (typeof updateHUD === 'function') {
          updateHUD();
        }
      } catch(e) {
        console.error("Error in accept reduced sentence handler:", e);
        feedLog("An error occurred while processing your sentence. Please try again.");
        try {
          S._police_interview_active = false;
          if (typeof updateHUD === 'function') updateHUD();
        } catch(recoveryError) {
          console.error("Error during recovery:", recoveryError);
        }
      }
    });
    
    addBtn("Request community service instead.", '', function(){
      const communityServiceChance = Math.random() < 0.6; // 60% chance
      if (communityServiceChance) {
        feedLog("The magistrate considers your request. 'Very well. 100 hours community service instead of prison.'");
        feedLog("'But the fines and SEX OFFENDER register placement remain.'");
        
        addBtn("Accept community service.", '', function(){
          fineChair(reducedFineC);
          fineClub(reducedFineK);
          S.community_service_hours = (S.community_service_hours||0) + 100;
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          
          // Add press coverage for harassment conviction with community service
          addPaper('Chairman sentenced to community service for harassment', 12);
          S.reputation = Math.max(0, (S.reputation||0) - 12);
          
          feedLog("You accept community service. The case is closed.");
          feedLog("📰 The press reports: 'Chairman sentenced to community service for harassment'");
          feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
          
          S._police_interview_active = false;
          clearBtns();
          
          // Directly place on KRAZY register
          if (typeof window.placeOnKrazyRegister === 'function') {
            window.placeOnKrazyRegister(severity);
          } else if (typeof placeOnKrazyRegister === 'function') {
            placeOnKrazyRegister(severity);
          } else {
            const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
            S.onKrazyRegister = true;
            S.krazyGamesRemaining = krazyGames;
            feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
            feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
            if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
            if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
            if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
          }
          
          update();
        });
      } else {
        feedLog("The magistrate shakes their head. 'No. The original sentence stands.'");
        fineChair(reducedFineC);
        fineClub(reducedFineK);
        // Harassment charges result in fine and krazy register, NOT prison time
        S.police_risk = Math.max(0, (S.police_risk||0) - 4);
        
        feedLog("The original sentence is imposed.");
        feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
        
        S._police_interview_active = false;
        clearBtns();
        
        // Directly place on KRAZY register
        if (typeof placeOnKrazyRegister === 'function') {
          placeOnKrazyRegister(severity);
        } else {
          const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
          S.onKrazyRegister = true;
          S.krazyGamesRemaining = krazyGames;
          feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
          feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
          if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
          if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
          if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
        }
        
        update();
      }
    });
  }
  
  function presentHarassmentNotGuiltyPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("The magistrate sets a trial date. 'We will hear evidence from both sides.'");
    feedLog("'However, if you lose at trial, the sentence will be harsher.'");
    
    addBtn("Proceed to trial.", 'warn', function(){
      clearBtns();
      presentHarassmentTrial(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("Blame it on my son - he must have taken my phone.", '', function(){
      clearBtns();
      presentHarassmentSonBlame(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("I'm being framed by Portsmouth FC/the FA!", '', function(){
      clearBtns();
      presentHarassmentFramingClaim(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("Change plea to guilty.", '', function(){
      feedLog("You change your plea to guilty.");
      clearBtns();
      presentHarassmentGuiltyPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
    });
    
    addBtn("Request plea bargain.", '', function(){
      const pleaBargainChance = Math.random() < 0.5; // 50% chance
      if (pleaBargainChance) {
        feedLog("The prosecutor considers your request. 'We can offer a reduced sentence if you plead guilty to a lesser charge.'");
        feedLog("'Inappropriate workplace communication instead of harassment. Fines reduced by 30%, no prison time.'");
        
        const bargainFineC = Math.floor(fineC * 0.7);
        const bargainFineK = Math.floor(fineK * 0.7);
        
        addBtn("Accept plea bargain.", '', function(){
          fineChair(bargainFineC);
          fineClub(bargainFineK);
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          
          // Add press coverage for plea bargain
          addPaper('Chairman accepts plea bargain in workplace misconduct case', 8);
          S.reputation = Math.max(0, (S.reputation||0) - 8);
          
          feedLog("You accept the plea bargain. The case is closed.");
          feedLog("📰 The press reports: 'Chairman accepts plea bargain in workplace misconduct case'");
          feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
          
          S._police_interview_active = false;
          clearBtns();
          
          // Directly place on KRAZY register
          if (typeof window.placeOnKrazyRegister === 'function') {
            window.placeOnKrazyRegister(severity);
          } else if (typeof placeOnKrazyRegister === 'function') {
            placeOnKrazyRegister(severity);
          } else {
            const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
            S.onKrazyRegister = true;
            S.krazyGamesRemaining = krazyGames;
            feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
            feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
            if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
            if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
            if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
          }
          
          update();
        });
        
        addBtn("Reject plea bargain.", '', function(){
          feedLog("You reject the plea bargain. Trial proceeds.");
          clearBtns();
          presentHarassmentTrial(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
        });
      } else {
        feedLog("The prosecutor refuses. 'No plea bargain. We'll see you in court.'");
        clearBtns();
        presentHarassmentTrial(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
      }
    });
  }
  
  function presentHarassmentNoContestPlea(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("The magistrate accepts your no contest plea. 'You neither admit nor deny the charges.'");
    feedLog("'I will impose the standard sentence without the reduction for admitting guilt.'");
    
    feedLog(`"I sentence you to: Personal fine £${fineC.toLocaleString()}, Club fine £${fineK.toLocaleString()}."`);
    feedLog("'Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct.'");
    
    addBtn("Accept the sentence.", 'warn', function(){
      try {
        // Safety check: ensure functions exist before calling
        if (typeof fineChair === 'function') {
          fineChair(fineC);
        } else {
          S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, fineC||0));
        }
        
        if (typeof fineClub === 'function') {
          fineClub(fineK);
        } else {
          S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, fineK||0));
        }
        
        // Harassment charges result in fine and krazy register, NOT prison time
        S.police_risk = Math.max(0, (S.police_risk||0) - 4);
        
        feedLog("You accept the sentence. The case is closed.");
        feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
        
        S._police_interview_active = false;
        
        // Safety check before clearing buttons
        if (typeof clearBtns === 'function') {
          clearBtns();
        } else {
          try {
            const actions = document.getElementById('actions') || document.getElementById('choices');
            if (actions) {
              const buttons = actions.querySelectorAll('button[data-investigation="1"]');
              buttons.forEach(btn => btn.remove());
            }
          } catch(e) {
            console.error("Error clearing buttons:", e);
          }
        }
        
        // Directly place on KRAZY register
        if (typeof window.placeOnKrazyRegister === 'function') {
          window.placeOnKrazyRegister(severity);
        } else if (typeof placeOnKrazyRegister === 'function') {
          placeOnKrazyRegister(severity);
        } else {
          const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
          S.onKrazyRegister = true;
          S.krazyGamesRemaining = krazyGames;
          feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
          feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
          if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
          if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
          if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
        }
        
        if (typeof update === 'function') {
          update();
        } else if (typeof updateHUD === 'function') {
          updateHUD();
        }
      } catch(e) {
        console.error("Error in accept sentence handler (harassment no contest):", e);
        feedLog("An error occurred while processing your sentence. Please try again.");
        try {
          S._police_interview_active = false;
          if (typeof updateHUD === 'function') updateHUD();
        } catch(recoveryError) {
          console.error("Error during recovery:", recoveryError);
        }
      }
    });
  }
  
  function presentHarassmentSonBlame(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("The magistrate looks skeptical. 'Your son took your phone and sent inappropriate messages to your secretary?'");
    feedLog("'This is a serious allegation. We'll need to investigate this claim.'");
    
    const sonBlameSuccess = Math.random() < 0.2; // 20% chance of success
    
    if (sonBlameSuccess) {
      feedLog("Your son's phone records show he was indeed using your device at the time.");
      feedLog("The magistrate dismisses the case against you, but warns about device security.");
      feedLog("'You're free to go, but keep better control of your devices.'");
      
      addBtn("Accept the dismissal.", '', function(){
        S.police_risk = Math.max(0, (S.police_risk||0) - 1);
        S.reputation = Math.max(0, (S.reputation||0) - 3); // Minimal reputation damage
        
        addPaper('Chairman cleared of harassment - son blamed', 4);
        
        feedLog("The case is dismissed. You walk free.");
        S._police_interview_active = false;
        clearBtns(); update();
      });
    } else {
      feedLog("The investigation reveals your son was at school during the time the messages were sent.");
      feedLog("The magistrate is not amused. 'This false claim makes your situation worse.'");
      feedLog("'I'm increasing your sentence for wasting our time with this fabrication.'");
      
      // Harsher sentence for false claim
      const harsherFineC = Math.floor(fineC * 1.5);
      const harsherFineK = Math.floor(fineK * 1.5);
      
      feedLog(`"I sentence you to: Personal fine £${harsherFineC.toLocaleString()}, Club fine £${harsherFineK.toLocaleString()}."`);
      feedLog("'Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct.'");
      
      addBtn("Accept the harsher sentence.", 'warn', function(){
        try {
          // Safety check: ensure functions exist before calling
          if (typeof fineChair === 'function') {
            fineChair(harsherFineC);
          } else {
            S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, harsherFineC||0));
          }
          
          if (typeof fineClub === 'function') {
            fineClub(harsherFineK);
          } else {
            S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, harsherFineK||0));
          }
          
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          
          if (typeof addPaper === 'function') {
            addPaper('Chairman convicted of harassment after false son claim', 20);
          }
          S.reputation = Math.max(0, (S.reputation||0) - 20);
          
          feedLog("You accept the sentence. The case is closed.");
          feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
          
          S._police_interview_active = false;
          
          // Safety check before clearing buttons
          if (typeof clearBtns === 'function') {
            clearBtns();
          } else {
            try {
              const actions = document.getElementById('actions') || document.getElementById('choices');
              if (actions) {
                const buttons = actions.querySelectorAll('button[data-investigation="1"]');
                buttons.forEach(btn => btn.remove());
              }
            } catch(e) {
              console.error("Error clearing buttons:", e);
            }
          }
          
          // Directly place on KRAZY register
          if (typeof placeOnKrazyRegister === 'function') {
            placeOnKrazyRegister(severity);
          } else {
            const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
            S.onKrazyRegister = true;
            S.krazyGamesRemaining = krazyGames;
            feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
            feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
            if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
            if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
            if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
          }
          
          if (typeof update === 'function') {
            update();
          } else if (typeof updateHUD === 'function') {
            updateHUD();
          }
        } catch(e) {
          console.error("Error in accept harsher sentence handler (son blame):", e);
          feedLog("An error occurred while processing your sentence. Please try again.");
          try {
            S._police_interview_active = false;
            if (typeof updateHUD === 'function') updateHUD();
          } catch(recoveryError) {
            console.error("Error during recovery:", recoveryError);
          }
        }
      });
    }
  }
  
  function presentHarassmentFramingClaim(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("The magistrate raises an eyebrow. 'You're claiming Portsmouth FC or the FA framed you?'");
    feedLog("'That's quite an allegation. Do you have any evidence of this conspiracy?'");
    
    const framingSuccess = Math.random() < 0.15; // 15% chance of success
    
    if (framingSuccess) {
      feedLog("Your lawyer presents evidence of suspicious timing and rival club connections.");
      feedLog("The magistrate considers this seriously. 'There may be merit to your claim.'");
      feedLog("'However, the messages still came from your device. I'm reducing the charges to a warning.'");
      
      addBtn("Accept the warning.", '', function(){
        S.police_risk = Math.max(0, (S.police_risk||0) - 2);
        S.reputation = Math.max(0, (S.reputation||0) - 5);
        
        addPaper('Chairman claims harassment framing by rivals', 8);
        
        feedLog("You receive a formal warning but avoid conviction.");
        S._police_interview_active = false;
        clearBtns(); update();
      });
    } else {
      feedLog("The magistrate dismisses your conspiracy theory. 'This is workplace harassment, not a football conspiracy.'");
      feedLog("'Making baseless allegations against the FA and rival clubs only makes you look more guilty.'");
      feedLog("'I'm imposing the maximum sentence for wasting the court's time.'");
      
      // Maximum sentence for ridiculous claim
      const maxFineC = Math.floor(fineC * 2.0);
      const maxFineK = Math.floor(fineK * 2.0);
      
      feedLog(`"I sentence you to: Personal fine £${maxFineC.toLocaleString()}, Club fine £${maxFineK.toLocaleString()}."`);
      feedLog("'Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct.'");
      
      addBtn("Accept the maximum sentence.", 'warn', function(){
        try {
          // Safety check: ensure functions exist before calling
          if (typeof fineChair === 'function') {
            fineChair(maxFineC);
          } else {
            S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, maxFineC||0));
          }
          
          if (typeof fineClub === 'function') {
            fineClub(maxFineK);
          } else {
            S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, maxFineK||0));
          }
          
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          
          if (typeof addPaper === 'function') {
            addPaper('Chairman convicted after claiming FA conspiracy', 25);
          }
          S.reputation = Math.max(0, (S.reputation||0) - 25);
          
          feedLog("You accept the sentence. The case is closed.");
          feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
          
          S._police_interview_active = false;
          
          // Safety check before clearing buttons
          if (typeof clearBtns === 'function') {
            clearBtns();
          } else {
            try {
              const actions = document.getElementById('actions') || document.getElementById('choices');
              if (actions) {
                const buttons = actions.querySelectorAll('button[data-investigation="1"]');
                buttons.forEach(btn => btn.remove());
              }
            } catch(e) {
              console.error("Error clearing buttons:", e);
            }
          }
          
          // Directly place on KRAZY register
          if (typeof placeOnKrazyRegister === 'function') {
            placeOnKrazyRegister(severity);
          } else {
            const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
            S.onKrazyRegister = true;
            S.krazyGamesRemaining = krazyGames;
            feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
            feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
            if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
            if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
            if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
          }
          
          if (typeof update === 'function') {
            update();
          } else if (typeof updateHUD === 'function') {
            updateHUD();
          }
        } catch(e) {
          console.error("Error in accept maximum sentence handler:", e);
          feedLog("An error occurred while processing your sentence. Please try again.");
          try {
            S._police_interview_active = false;
            if (typeof updateHUD === 'function') updateHUD();
          } catch(recoveryError) {
            console.error("Error during recovery:", recoveryError);
          }
        }
      });
    }
  }
  
  function presentHarassmentTrial(severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub) {
    feedLog("🏛️ TRIAL — Workplace Harassment Case");
    feedLog("The trial begins. Your secretary testifies about the inappropriate messages.");
    
    // Show actual evidence if available
    if (S._harassment_evidence && S._harassment_evidence.length > 0) {
      feedLog("The prosecution presents evidence of your actual messages:");
      S._harassment_evidence.forEach((evidence, index) => {
        feedLog(`"${evidence.message}" ${evidence.attachment ? `[${evidence.attachment}]` : ''}`);
      });
      feedLog("The evidence is damning. Your defense lawyer looks uncomfortable.");
    }
    
    // Trial outcome based on evidence and luck
    const trialSuccess = Math.random() < 0.3; // 30% chance of acquittal
    
    if (trialSuccess) {
      feedLog("Your defense lawyer argues that the messages were taken out of context.");
      feedLog("The jury finds you NOT GUILTY!");
      feedLog("You are acquitted of all charges.");
      
      addBtn("Accept the acquittal.", '', function(){
        S.police_risk = Math.max(0, (S.police_risk||0) - 2);
        S.reputation = Math.max(0, (S.reputation||0) - 5); // Still some reputation damage
        
        // Add press coverage for acquittal
        addPaper('Chairman acquitted of harassment charges', 6);
        
        feedLog("The case is dismissed. You walk free.");
        feedLog("📰 The press reports: 'Chairman acquitted of harassment charges'");
        S._police_interview_active = false;
        clearBtns(); update();
      });
    } else {
      feedLog("The evidence is overwhelming. The jury finds you GUILTY!");
      feedLog("The magistrate imposes a harsher sentence for wasting the court's time.");
      
      // Harsher sentence for losing at trial
      const harsherPrison = Math.floor(prisonTerm * 1.5);
      const harsherFineC = Math.floor(fineC * 1.3);
      const harsherFineK = Math.floor(fineK * 1.3);
      
      feedLog(`"I sentence you to: Personal fine £${harsherFineC.toLocaleString()}, Club fine £${harsherFineK.toLocaleString()}."`);
      feedLog("'Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct.'");
      
      addBtn("Accept the harsher sentence.", 'warn', function(){
        try {
          // Safety check: ensure functions exist before calling
          if (typeof fineChair === 'function') {
            fineChair(harsherFineC);
          } else {
            S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, harsherFineC||0));
          }
          
          if (typeof fineClub === 'function') {
            fineClub(harsherFineK);
          } else {
            S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, harsherFineK||0));
          }
          
          // Harassment charges result in fine and krazy register, NOT prison time
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          
          // Add press coverage for trial conviction
          if (typeof addPaper === 'function') {
            addPaper('Chairman convicted of harassment after trial', 18);
          }
          S.reputation = Math.max(0, (S.reputation||0) - 18);
          
          feedLog("You accept the sentence. The case is closed.");
          feedLog("📰 The press reports: 'Chairman convicted of harassment after trial'");
          feedLog("The magistrate orders you to sign THE SEX OFFENDERS REGISTER for workplace misconduct.");
          
          S._police_interview_active = false;
          
          // Safety check before clearing buttons
          if (typeof clearBtns === 'function') {
            clearBtns();
          } else {
            try {
              const actions = document.getElementById('actions') || document.getElementById('choices');
              if (actions) {
                const buttons = actions.querySelectorAll('button[data-investigation="1"]');
                buttons.forEach(btn => btn.remove());
              }
            } catch(e) {
              console.error("Error clearing buttons:", e);
            }
          }
          
          // Directly place on KRAZY register
          if (typeof placeOnKrazyRegister === 'function') {
            placeOnKrazyRegister(severity);
          } else {
            const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
            S.onKrazyRegister = true;
            S.krazyGamesRemaining = krazyGames;
            feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
            feedLog(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
            if (typeof triggerKrazyManagerConfrontation === 'function') triggerKrazyManagerConfrontation();
            if (typeof triggerKrazyTeamFallout === 'function') triggerKrazyTeamFallout();
            if (typeof queueKrazyPressCoverage === 'function') queueKrazyPressCoverage();
          }
          
          if (typeof update === 'function') {
            update();
          } else if (typeof updateHUD === 'function') {
            updateHUD();
          }
        } catch(e) {
          console.error("Error in accept harsher sentence handler (trial):", e);
          feedLog("An error occurred while processing your sentence. Please try again.");
          try {
            S._police_interview_active = false;
            if (typeof updateHUD === 'function') updateHUD();
          } catch(recoveryError) {
            console.error("Error during recovery:", recoveryError);
          }
        }
      });
    }
  }
  
  // ---------- Krazy Register Signing System ----------
  function presentKrazyRegisterSigning(severity, update) {
    const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
    
    feedLog("📋 THE SEX OFFENDERS REGISTER");
    feedLog("The magistrate presents you with a large, official-looking register.");
    feedLog(`"You must sign this register for ${krazyGames} matches. Your name will be marked as a 'SEX OFFENDER' in all official records."`);
    feedLog("The register sits on the desk, waiting ominously for your signature...");
    
    // Create a button that the player must actively press
    const actionsElement = document.getElementById('actions');
    if (actionsElement) {
      const signButton = document.createElement('button');
      signButton.textContent = 'Sign the Sex Offenders Register';
      signButton.className = 'warn';
      signButton.style.cssText = `
        margin: 8px 0px;
        padding: 12px 16px;
        display: block;
        width: 100%;
        max-width: 400px;
        font-size: 14px;
        line-height: 1.4;
        border-radius: 4px;
        border: 1px solid #ccc;
        background-color: #ff6b6b;
        color: white;
        cursor: pointer;
        transition: background-color 0.2s;
        position: relative;
        z-index: 1000;
      `;
      
      signButton.addEventListener('click', function() {
        // Remove the button
        if (signButton.parentNode) {
          signButton.parentNode.removeChild(signButton);
        }
        
        // Place on krazy register
        S.onKrazyRegister = true;
        S.krazyGamesRemaining = krazyGames;
        
        // Award achievement
        if (typeof window.achievements !== 'undefined') {
          window.achievements.add({
            id: 'became_krazy',
            title: 'Became a Sex Offender',
            description: 'Placed on THE SEX OFFENDERS REGISTER for inappropriate conduct',
            icon: '🚨'
          });
        }
        
        feedLog("✍️ You sign THE SEX OFFENDERS REGISTER with a heavy heart.");
        feedLog(`🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!`);
        feedLog(`Your name will be tagged as "SEX OFFENDER" in all logs and opposing fans will chant about it.`);
        
        // Trigger manager confrontation
        triggerKrazyManagerConfrontation();
        
        // Trigger team fallout
        triggerKrazyTeamFallout();
        
        // Queue press coverage
        queueKrazyPressCoverage();
        
        // Update the game state
        update();
      });
      
      actionsElement.appendChild(signButton);
    }
  }
  
  // ---------- Direct Harassment Interview System ----------
  function presentHarassmentDirectInterview(caseType, addBtn, clearBtns, update, fineChair, fineClub){
    // Prevent duplicate calls within a short time window
    if (S._police_interview_active) {
      return; // Already processing an interview
    }
    S._police_interview_active = true;
    
    // Safety timeout to clear the flag if something goes wrong
    setTimeout(() => {
      if (S._police_interview_active) {
        S._police_interview_active = false;
      }
    }, 10000); // 10 second timeout
    
    // Clear the interview in progress flag
    S._police_interview_in_progress = false;
    
    // Step 1: Present charges
    feedLog("🚨 POLICE INTERVIEW — You are charged with: " + caseType);
    feedLog("The officer reads from a file: 'We have evidence of inappropriate messages sent to your secretary. This constitutes workplace harassment.'");
    
    // Calculate severity and fines
    const severity = calculatePoliceSeverity();
    const fineC = 500000 + Math.floor(Math.random() * 500000); // Minimum £500k, up to £1M
    const fineK = Math.round(fineC * 0.6);
    const prisonTerm = 0; // Harassment doesn't result in prison time
    
    feedLog(`The officer consults their notes. 'Based on the evidence, we recommend:`);
    feedLog(`Personal fine: £${fineC.toLocaleString()}, Club fine: £${fineK.toLocaleString()}, Prison: ${prisonTerm} match(es).'`);
    feedLog(`"This is a workplace harassment case. You have the right to a formal plea hearing."`);
    
    // Go directly to harassment plea system
    presentHarassmentPleaSystem(caseType, severity, prisonTerm, fineC, fineK, addBtn, clearBtns, update, fineChair, fineClub);
  }

  // ---------- Three-Step Police Interview System ----------
  function presentThreeStepPoliceInterview(caseType, addBtn, clearBtns, update, fineChair, fineClub){
    
    // Prevent duplicate calls within a short time window
    if (S._police_interview_active) {
      return; // Already processing an interview
    }
    S._police_interview_active = true;
    
    // Safety timeout to clear the flag if something goes wrong
    setTimeout(() => {
      if (S._police_interview_active) {
        S._police_interview_active = false;
      }
    }, 10000); // 10 second timeout
    
    // Clear the interview in progress flag
    S._police_interview_in_progress = false;
    
    // Step 1: Present charges
    feedLog("🚨 POLICE INTERVIEW — You are charged with: " + caseType);
    if (caseType === 'corruption') {
      feedLog("The officer reads from a file: 'We have evidence of multiple bribery payments totaling " + money((S.bribes_count||0) * 500000) + ". This is serious corruption.'");
    } else if (caseType === 'harassment_via_messages') {
      feedLog("The officer reads from a file: 'We have evidence of inappropriate messages sent to your secretary. This constitutes workplace harassment.'");
    } else {
      feedLog("The officer reads from a file: 'We have evidence of your involvement in this matter.'");
    }
    
    // Calculate severity for sentencing
    const severity = calculatePoliceSeverity();
    
    try {
      addBtn("I'm guilty.", 'warn', function(){
        feedLog("You admit guilt. The officer nods grimly.");
        clearBtns(); // Clear the current buttons before showing new ones
        presentPoliceSentencing(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub);
      });
    } catch(e) {
      console.error("DEBUG: Error creating guilty button:", e);
    }
    
    try {
      addBtn("I'm not guilty.", '', function(){
        feedLog("The officer raises an eyebrow. 'Not guilty? Then explain yourself.'");
        clearBtns(); // Clear the current buttons before showing new ones
        presentPoliceExcuses(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub);
      });
    } catch(e) {
      console.error("DEBUG: Error creating not guilty button:", e);
    }
    
    
    // Check if buttons are still there after a short delay
    setTimeout(() => {
    }, 1000);
  }
  
  function presentPoliceExcuses(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub){
    feedLog("What's your explanation?");
    
    addBtn("It was my mental health — I need help, not prison.", '', function(){
      const success = Math.random() < 0.35; // 35% chance of success
      if (success) {
        feedLog("They show compassion. You're referred for counseling instead of prosecution.");
        S.police_risk = Math.max(0, (S.police_risk||0) - 3);
        // CRITICAL: Mark that this case was resolved without prison
        S._police_case_resolved = true;
        S._police_interview_active = false; // Clear the interview flag
        clearBtns(); update();
      } else {
        feedLog("They're unconvinced. The case proceeds to sentencing.");
        clearBtns(); // Clear the current buttons before showing new ones
        presentPoliceSentencing(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub);
      }
    });
    
    addBtn("Frame a player — it was their idea.", 'bad', function(){
      const success = Math.random() < 0.25; // 25% chance of success
      if (success) {
        feedLog("They investigate your claim. The player is questioned and takes the blame.");
        S.police_risk = Math.max(0, (S.police_risk||0) - 2);
        S.reputation = Math.max(0, (S.reputation||0) - 5); // Reputation hit for framing
        // CRITICAL: Mark that this case was resolved without prison
        S._police_case_resolved = true;
        S._police_interview_active = false; // Clear the interview flag
        clearBtns(); update();
      } else {
        feedLog("They don't believe you. The case proceeds to sentencing.");
        clearBtns(); // Clear the current buttons before showing new ones
        presentPoliceSentencing(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub);
      }
    });
    
    addBtn("I was set up by the opposition.", '', function(){
      const success = Math.random() < 0.30; // 30% chance of success
      if (success) {
        feedLog("They consider your claim. Case dismissed due to insufficient evidence.");
        S.police_risk = Math.max(0, (S.police_risk||0) - 2);
        // CRITICAL: Mark that this case was resolved without prison
        S._police_case_resolved = true;
        S._police_interview_active = false; // Clear the interview flag
        clearBtns(); update();
      } else {
        feedLog("They find your story unconvincing. The case proceeds to sentencing.");
        clearBtns(); // Clear the current buttons before showing new ones
        presentPoliceSentencing(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub);
      }
    });
  }
  
  function presentPoliceSentencing(caseType, severity, addBtn, clearBtns, update, fineChair, fineClub){
    // Track arrest history for sentencing
    if (typeof S.arrest_count !== 'number') S.arrest_count = 0;
    S.arrest_count += 1;
    
    // Calculate sentence based on severity and arrest history
    let prisonTerm;
    if (S.arrest_count === 1) {
      // First arrest: 60% chance of 1-2 games, 40% chance of 3-4 games
      if (Math.random() < 0.6) {
        prisonTerm = Math.floor(Math.random() * 2) + 1; // 1-2 games
      } else {
        prisonTerm = Math.floor(Math.random() * 2) + 3; // 3-4 games
      }
    } else if (S.arrest_count === 2) {
      // Second arrest: 40% chance of 1-2 games, 60% chance of 3-5 games
      if (Math.random() < 0.4) {
        prisonTerm = Math.floor(Math.random() * 2) + 1; // 1-2 games
      } else {
        prisonTerm = Math.floor(Math.random() * 3) + 3; // 3-5 games
      }
    } else {
      // Third+ arrest: Based on severity with longer sentences
      prisonTerm = Math.max(2, Math.min(8, Math.floor(severity / 6) + 2));
    }
    
    const fineC = 500000 + Math.floor(Math.random() * 500000); // Minimum £500k, up to £1M
    const fineK = Math.round(fineC * 0.6);
    
    feedLog(`The officer consults their notes. 'Based on the evidence, we recommend:`);
    feedLog(`Personal fine: £${fineC.toLocaleString()}, Club fine: £${fineK.toLocaleString()}, Prison: ${prisonTerm} match(es).'`);
    
    // Note: Harassment cases are now handled by presentHarassmentDirectInterview
    
    addBtn("Accept the sentence.", 'warn', function(){
      try {
        // Safety check: ensure functions exist before calling
        if (typeof fineChair === 'function') {
          fineChair(fineC);
        } else {
          // Fallback if fineChair function not provided
          S.chairman_cash = Math.max(0, (S.chairman_cash||0) - Math.max(0, fineC||0));
        }
        
        if (typeof fineClub === 'function') {
          fineClub(fineK);
        } else {
          // Fallback if fineClub function not provided
          S.club_cash = Math.max(0, (S.club_cash||0) - Math.max(0, fineK||0));
        }
        
        // Ensure suspensions object exists
        if (!S.suspensions || typeof S.suspensions !== 'object') {
          S.suspensions = {};
        }
        S.suspensions = Object.assign(S.suspensions, {prison_games:(S.suspensions.prison_games|0)+prisonTerm});
        S.prison = true;
        S.police_risk = Math.max(0, (S.police_risk||0) - 4);
        
        feedLog("You accept the sentence. The case is closed.");
        S._police_interview_active = false; // Clear the interview flag
        
        // Safety check before clearing buttons and updating
        if (typeof clearBtns === 'function') {
          clearBtns();
        } else {
          // Fallback: try to clear buttons manually
          try {
            const actions = document.getElementById('actions') || document.getElementById('choices');
            if (actions) {
              const buttons = actions.querySelectorAll('button[data-investigation="1"]');
              buttons.forEach(btn => btn.remove());
            }
          } catch(e) {
            console.error("Error clearing buttons:", e);
          }
        }
        
        if (typeof update === 'function') {
          update();
        } else if (typeof updateHUD === 'function') {
          updateHUD();
        }
      } catch(e) {
        console.error("Error in accept sentence handler:", e);
        feedLog("An error occurred while processing your sentence. Please try again.");
        // Try to recover by at least clearing the interview flag
        try {
          S._police_interview_active = false;
          if (typeof updateHUD === 'function') updateHUD();
        } catch(recoveryError) {
          console.error("Error during recovery:", recoveryError);
        }
      }
    });
    
    addBtn("Is there anything I can do?", '', function(){
      const bribeChance = Math.random() < 0.4; // 40% chance they'll accept a bribe
      if (bribeChance) {
        const bribeAmount = Math.round(fineC * 1.5 + Math.random() * 50000);
        feedLog(`The officer looks around nervously. 'Well... we might be able to make this go away for £${bribeAmount.toLocaleString()}.'`);
        
        addBtn(`Pay the bribe (£${bribeAmount.toLocaleString()})`, 'bad', function(){
          const canPay = (S.chairman_cash||0) >= bribeAmount || (S.club_cash||0) >= bribeAmount;
          if (canPay) {
            if ((S.chairman_cash||0) >= bribeAmount) {
              S.chairman_cash -= bribeAmount;
            } else {
              S.club_cash = Math.max(0, (S.club_cash|0) - bribeAmount);
            }
            feedLog("Envelopes change hands. The case disappears from the files.");
            S.police_risk = Math.max(0, (S.police_risk||0) - 4);
            // CRITICAL: Mark that this case was resolved without prison
            S._police_case_resolved = true;
            S._police_interview_active = false; // Clear the interview flag
            clearBtns(); update();
          } else {
            feedLog("You can't raise the money. They proceed with the original sentence.");
            fineChair(fineC);
            fineClub(fineK);
            S.suspensions = Object.assign(S.suspensions||{}, {prison_games:(S.suspensions?.prison_games|0)+prisonTerm});
            S.prison = true;
            S.police_risk = Math.max(0, (S.police_risk||0) - 4);
            S._police_interview_active = false; // Clear the interview flag
            clearBtns(); update();
          }
        });
        
        addBtn("Refuse the bribe.", '', function(){
          feedLog("You refuse to pay. They proceed with the original sentence.");
          fineChair(fineC);
          fineClub(fineK);
          S.suspensions = Object.assign(S.suspensions||{}, {prison_games:(S.suspensions?.prison_games|0)+prisonTerm});
          S.prison = true;
          S.police_risk = Math.max(0, (S.police_risk||0) - 4);
          S._police_interview_active = false; // Clear the interview flag
          clearBtns(); update();
        });
      } else {
        feedLog("The officer shakes their head. 'There's nothing you can do. The sentence stands.'");
        fineChair(fineC);
        fineClub(fineK);
        S.suspensions = Object.assign(S.suspensions||{}, {prison_games:(S.suspensions?.prison_games|0)+prisonTerm});
        S.prison = true;
        S.police_risk = Math.max(0, (S.police_risk||0) - 4);
        S._police_interview_active = false; // Clear the interview flag
        clearBtns(); update();
      }
    });
  }
  
  function calculatePoliceSeverity(){
    let severity = 0;
    severity += (S.police_risk||0) * 2;
    severity += (S.compliance_risk||0) * 1.5;
    severity += (S.legal_risk||0) * 1;
    severity += (S.bribes_count||0) * 3;
    if (S.fixed_matches && S.fixed_matches.length > 0) severity += S.fixed_matches.length * 5;
    if (S.offbooks > 0) severity += Math.min(10, S.offbooks);
    return Math.max(0, severity);
  }

  // ---------- investigation presenter (popup-based UI) ----------
  window.presentInvestigation = async function(v){
    ensureState();
    
    // Check if we're in the right context for investigations
    const currentContext = window.__ui_context || 'unknown';
    
    // Only allow investigations in post-match or evening contexts
    // Prevent investigations from appearing in pre-match or other inappropriate contexts
    if (currentContext !== 'postmatch' && currentContext !== 'evening') {
      // Re-queue for later processing
      if (!Array.isArray(S.knock_queue)) S.knock_queue = [];
      S.knock_queue.push(v);
      return;
    }
    
    const auth = v.authority; // 'board' | 'fa' | 'police'
    const caseType = v.caseType || 'irregularities';

    // Log the headline to main feed
    if (auth === 'police'){
      feedLog("🚨 YOU'VE BEEN ARRESTED BY THE POLICE — case: " + caseType);
    } else if (auth === 'fa'){
      feedLog("📰 Scandal Brewing — FA investigating " + caseType + " at Southampton!");
    } else {
      feedLog("📋 Board summons: concerns about " + caseType + ".");
    }

    // Trigger rival event for scandal/investigation
    if (typeof triggerRivalEvent === 'function') {
      triggerRivalEvent('scandal', {
        scandalType: caseType,
        authority: auth
      });
    }

  // Start the popup investigation with timeout fallback
  try {
    await Promise.race([
      startInvestigationPopup(v),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Investigation timeout')), 30000))
    ]);
  } catch (e) {
    console.error("Investigation failed or timed out:", e);
    // Force close any remaining modal
    try { closeInvestigationModal(); } catch(_){}
    // Continue game flow
  }
  };

  // New popup-based investigation system
  window.startInvestigationPopup = async function(investigation){
    return new Promise((resolve) => {
      const auth = investigation.authority;
      const caseType = investigation.caseType || 'irregularities';
      
      // Create modal overlay
      const modal = document.createElement('div');
      modal.className = 'modern-modal-overlay';
      modal.style.zIndex = '10001';
      
      modal.innerHTML = `
        <div class="modern-modal" style="max-width: 700px; max-height: 85vh;">
          <div class="modal-header">
            <h3>${auth === 'police' ? '🚨 Police Interview' : auth === 'fa' ? '📰 FA Investigation' : '📋 Board Meeting'}</h3>
          </div>
          <div class="modal-body" id="investigationContent">
            <div id="investigationStep" style="margin-bottom: 20px;">
              <div id="stepContent"></div>
              <div id="stepOptions" style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;"></div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Store modal reference for cleanup
      window.currentInvestigationModal = modal;
      
      // Start the investigation process
      runInvestigationFlow(investigation, resolve);
    });
  };

  async function runInvestigationFlow(investigation, resolve) {
    const auth = investigation.authority;
    const caseType = investigation.caseType || 'irregularities';
    
    if (auth === 'police') {
      await runPoliceInvestigation(caseType, resolve);
    } else if (auth === 'fa') {
      await runFAInvestigation(caseType, resolve);
    } else {
      await runBoardInvestigation(caseType, resolve);
    }
  }

  async function runPoliceInvestigation(caseType, resolve) {
    // CRITICAL: Route harassment cases to harassment-specific handler
    if (caseType === 'harassment_via_messages') {
      await presentHarassmentInvestigationPopup(caseType, resolve);
      return;
    }
    
    // CRITICAL: Route indecent exposure cases to sex offender register handler
    // Handle both "Indecent Exposure" and "Indecent Exposure of penis" variations
    if (caseType === 'Indecent Exposure' || caseType === 'Indecent Exposure of penis' || caseType.includes('Indecent Exposure')) {
      await presentIndecentExposureInvestigationPopup(caseType, resolve);
      return;
    }
    
    // CRITICAL: Route secret zone surveillance cases to sex offender register handler
    if (caseType === 'Secret Zone Surveillance') {
      await presentSecretZoneSurveillanceInvestigationPopup(caseType, resolve);
      return;
    }
    
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Step 1: Present charges
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🚨 POLICE INTERVIEW</h4>
      <p style="margin: 0 0 10px 0;"><strong>You are charged with:</strong> ${caseType}</p>
      ${caseType === 'corruption' ? 
        `<p style="margin: 0 0 10px 0;">The officer reads from a file: "We have evidence of multiple bribery payments totaling ${money((S.bribes_count||0) * 500000)}. This is serious corruption."</p>` :
        `<p style="margin: 0 0 10px 0;">The officer reads from a file: "We have evidence of your involvement in this matter."</p>`
      }
    `;
    
    // Check for available certificates
    const availableCertificates = S.doctor && S.doctor.disorder_certificates ? 
      S.doctor.disorder_certificates.filter(cert => !cert.used) : [];
    
    const options = [
      { key: 'guilty', label: "I'm guilty.", variant: 'warn' },
      { key: 'not_guilty', label: "I'm not guilty.", variant: '' }
    ];
    
    // Add certificate options if available
    if (availableCertificates.length > 0) {
      availableCertificates.forEach((cert, index) => {
        options.push({ 
          key: `cert_${index}`, 
          label: `Use ${cert.type} certificate (get out of jail free)`,
          variant: 'good'
        });
      });
    }
    
    const choice = await showInvestigationOptions(options);
    
    if (choice.startsWith('cert_')) {
      // Use disorder certificate
      const certIndex = parseInt(choice.split('_')[1]);
      const certificate = availableCertificates[certIndex];
      
      if (certificate) {
        certificate.used = true;
        
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">📜 Certificate Presented</h4>
          <p style="margin: 0 0 10px 0;">You present your <strong>${certificate.type}</strong> certificate to the police.</p>
          <p style="margin: 0 0 10px 0;">"Oh my god," the officer says, reading the diagnosis. "${certificate.description}"</p>
          <p style="margin: 0 0 10px 0;">"I had no idea you were suffering from this condition. This is so, so sad."</p>
          <p style="margin: 0 0 10px 0;">The police are sympathetic and decide not to arrest you. They let you go with a warning.</p>
          <p style="margin: 0 0 10px 0;">"We'll make sure you get the help you need," they say as they leave.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> No arrest consequences! Your reputation actually improves slightly due to the police's sympathy for your condition.
          </div>
        `;
        
        // Apply positive effects
        S.reputation = Math.min(100, (S.reputation || 50) + 2);
        
        // Update doctor UI if open
        if (typeof window.renderDoctor === 'function') {
          window.renderDoctor();
        }
        
        updateHUD?.();
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          closeInvestigationModal();
          resolve();
        }, 3000);
        return;
      }
    } else if (choice === 'guilty') {
      await presentPoliceSentencingPopup(caseType, resolve);
    } else if (choice === 'not_guilty') {
      await presentPoliceExcuses(caseType, resolve);
    }
  }

  // ---------- Async Harassment Investigation Popup Handler ----------
  async function presentHarassmentInvestigationPopup(caseType, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Calculate severity and fines
    const severity = calculatePoliceSeverity();
    const fineC = 500000 + Math.floor(Math.random() * 500000); // Minimum £500k, up to £1M
    const fineK = Math.round(fineC * 0.6);
    const prisonTerm = 0; // Harassment doesn't result in prison time
    
    // Check for available certificates
    const availableCertificates = S.doctor && S.doctor.disorder_certificates ? 
      S.doctor.disorder_certificates.filter(cert => !cert.used) : [];
    
    // Step 1: Present charges
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🚨 POLICE INTERVIEW — Workplace Harassment</h4>
      <p style="margin: 0 0 10px 0;"><strong>You are charged with:</strong> ${caseType}</p>
      <p style="margin: 0 0 10px 0;">The officer reads from a file: "We have evidence of inappropriate messages sent to your secretary. This constitutes workplace harassment."</p>
      <p style="margin: 0 0 10px 0;">"This is a workplace harassment case. You have the right to a formal plea hearing."</p>
    `;
    
    const options = [
      { key: 'guilty', label: "Guilty - I made a mistake.", variant: 'warn' },
      { key: 'not_guilty', label: "Not Guilty - I was misunderstood.", variant: '' },
      { key: 'no_contest', label: "No Contest - I want to avoid trial.", variant: '' }
    ];
    
    // Add certificate options if available
    if (availableCertificates.length > 0) {
      availableCertificates.forEach((cert, index) => {
        options.push({ 
          key: `cert_${index}`, 
          label: `Use ${cert.type} certificate (get out of jail free)`,
          variant: 'good'
        });
      });
    }
    
    const choice = await showInvestigationOptions(options);
    
    if (choice.startsWith('cert_')) {
      // Use disorder certificate
      const certIndex = parseInt(choice.split('_')[1]);
      const certificate = availableCertificates[certIndex];
      
      if (certificate) {
        certificate.used = true;
        
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">📜 Certificate Presented</h4>
          <p style="margin: 0 0 10px 0;">You present your <strong>${certificate.type}</strong> certificate to the police.</p>
          <p style="margin: 0 0 10px 0;">"Oh my god," the officer says, reading the diagnosis. "${certificate.description}"</p>
          <p style="margin: 0 0 10px 0;">"I had no idea you were suffering from this condition. This is so, so sad."</p>
          <p style="margin: 0 0 10px 0;">The police are sympathetic and decide not to arrest you. They let you go with a warning.</p>
          <p style="margin: 0 0 10px 0;">"We'll make sure you get the help you need," they say as they leave.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> No arrest consequences! Your reputation actually improves slightly due to the police's sympathy for your condition.
          </div>
        `;
        
        // Apply positive effects
        S.reputation = Math.min(100, (S.reputation || 50) + 2);
        
        // Update doctor UI if open
        if (typeof window.renderDoctor === 'function') {
          window.renderDoctor();
        }
        
        updateHUD?.();
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          closeInvestigationModal();
          resolve();
        }, 3000);
        return;
      }
    }
    
    if (choice === 'guilty') {
      await presentHarassmentGuiltyPleaPopup(severity, prisonTerm, fineC, fineK, resolve);
    } else if (choice === 'not_guilty') {
      await presentHarassmentNotGuiltyPleaPopup(severity, prisonTerm, fineC, fineK, resolve);
    } else if (choice === 'no_contest') {
      await presentHarassmentNoContestPleaPopup(severity, prisonTerm, fineC, fineK, resolve);
    }
  }
  
  async function presentHarassmentGuiltyPleaPopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Reduced sentence for guilty plea
    const reducedFineC = Math.floor(fineC * 0.8);
    const reducedFineK = Math.floor(fineK * 0.8);
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ COURT HEARING — Workplace Harassment Charges</h4>
      <p style="margin: 0 0 10px 0;">You admit guilt. The magistrate nods gravely.</p>
      <p style="margin: 0 0 10px 0;">The magistrate considers your guilty plea. "Given your admission, I can offer some leniency."</p>
      <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine £${reducedFineC.toLocaleString()}, Club fine £${reducedFineK.toLocaleString()}."</p>
      <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct."</strong></p>
    `;
    
    const options = [
      { key: 'accept', label: 'Accept the reduced sentence', variant: 'warn' },
      { key: 'community', label: 'Request community service instead', variant: '' }
    ];
    
    const choice = await showInvestigationOptions(options);
    
    if (choice === 'accept') {
      // Apply fines
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - reducedFineC);
      S.club_cash = Math.max(0, (S.club_cash || 0) - reducedFineK);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
      
      // Add press coverage
      if (typeof addPaper === 'function') {
        addPaper('Chairman convicted of workplace harassment', 15);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 15);
      
      // Show register signing step
      await presentHarassmentRegisterSigningPopup(severity, resolve);
    } else if (choice === 'community') {
      const communityServiceChance = Math.random() < 0.6; // 60% chance
      if (communityServiceChance) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ Community Service Approved</h4>
          <p style="margin: 0 0 10px 0;">The magistrate considers your request. "Very well. 100 hours community service instead of prison."</p>
          <p style="margin: 0 0 10px 0;"><strong>"But the fines and SEX OFFENDER register placement remain."</strong></p>
        `;
        
        const acceptChoice = await showInvestigationOptions([
          { key: 'accept_community', label: 'Accept community service', variant: 'warn' }
        ]);
        
        if (acceptChoice === 'accept_community') {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - reducedFineC);
          S.club_cash = Math.max(0, (S.club_cash || 0) - reducedFineK);
          S.community_service_hours = (S.community_service_hours || 0) + 100;
          S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
          
          if (typeof addPaper === 'function') {
            addPaper('Chairman sentenced to community service for harassment', 12);
          }
          S.reputation = Math.max(0, (S.reputation || 0) - 12);
          
          // Show register signing step
          await presentHarassmentRegisterSigningPopup(severity, resolve);
        }
      } else {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Community Service Denied</h4>
          <p style="margin: 0 0 10px 0;">The magistrate shakes their head. "No. The original sentence stands."</p>
        `;
        
        // Apply original sentence
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - reducedFineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - reducedFineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        // Show register signing step
        await presentHarassmentRegisterSigningPopup(severity, resolve);
      }
    }
  }
  
  async function presentHarassmentNotGuiltyPleaPopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ COURT HEARING — Workplace Harassment Charges</h4>
      <p style="margin: 0 0 10px 0;">You plead not guilty. The magistrate raises an eyebrow.</p>
      <p style="margin: 0 0 10px 0;">The magistrate sets a trial date. "We will hear evidence from both sides."</p>
      <p style="margin: 0 0 10px 0;">"However, if you lose at trial, the sentence will be harsher."</p>
    `;
    
    const options = [
      { key: 'trial', label: 'Proceed to trial', variant: 'warn' },
      { key: 'blame_son', label: "Blame it on my son - he must have taken my phone", variant: '' },
      { key: 'framed', label: "I'm being framed by Portsmouth FC/the FA!", variant: '' },
      { key: 'change_guilty', label: 'Change plea to guilty', variant: '' }
    ];
    
    const choice = await showInvestigationOptions(options);
    
    if (choice === 'trial') {
      await presentHarassmentTrialPopup(severity, prisonTerm, fineC, fineK, resolve);
    } else if (choice === 'blame_son') {
      await presentHarassmentSonBlamePopup(severity, prisonTerm, fineC, fineK, resolve);
    } else if (choice === 'framed') {
      await presentHarassmentFramingClaimPopup(severity, prisonTerm, fineC, fineK, resolve);
    } else if (choice === 'change_guilty') {
      await presentHarassmentGuiltyPleaPopup(severity, prisonTerm, fineC, fineK, resolve);
    }
  }
  
  async function presentHarassmentNoContestPleaPopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ COURT HEARING — Workplace Harassment Charges</h4>
      <p style="margin: 0 0 10px 0;">You enter a plea of no contest. The magistrate accepts it.</p>
      <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine £${fineC.toLocaleString()}, Club fine £${fineK.toLocaleString()}."</p>
      <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct."</strong></p>
    `;
    
    const choice = await showInvestigationOptions([
      { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
    ]);
    
    if (choice === 'accept') {
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman enters no contest plea in harassment case', 10);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 10);
      
      // Show register signing step
      await presentHarassmentRegisterSigningPopup(severity, resolve);
    }
  }
  
  async function presentHarassmentTrialPopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ TRIAL — Workplace Harassment Case</h4>
      <p style="margin: 0 0 10px 0;">The trial begins. Evidence is presented from both sides.</p>
    `;
    
    // Check for evidence
    let evidenceText = '';
    if (S._harassment_evidence && S._harassment_evidence.length > 0) {
      evidenceText = '<p style="margin: 10px 0;">Evidence presented:</p><ul style="margin: 10px 0; padding-left: 20px;">';
      S._harassment_evidence.forEach((evidence, index) => {
        evidenceText += `<li>${evidence.description || 'Inappropriate message evidence'}</li>`;
      });
      evidenceText += '</ul>';
    }
    
    const trialSuccess = Math.random() < 0.3; // 30% chance of acquittal
    
    if (trialSuccess) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Acquitted</h4>
        <p style="margin: 0 0 10px 0;">${evidenceText}</p>
        <p style="margin: 0 0 10px 0;">The jury finds you not guilty. The case is dismissed.</p>
      `;
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman acquitted of harassment charges', 6);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 6);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      // Convicted at trial - harsher sentence
      const trialFineC = Math.floor(fineC * 1.2);
      const trialFineK = Math.floor(fineK * 1.2);
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Convicted</h4>
        <p style="margin: 0 0 10px 0;">${evidenceText}</p>
        <p style="margin: 0 0 10px 0;">The jury finds you guilty. The magistrate imposes a harsher sentence.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine £${trialFineC.toLocaleString()}, Club fine £${trialFineK.toLocaleString()}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - trialFineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - trialFineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of harassment after trial', 18);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 18);
        
        // Show register signing step
        await presentHarassmentRegisterSigningPopup(severity, resolve);
      }
    }
  }
  
  async function presentHarassmentSonBlamePopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const success = Math.random() < 0.25; // 25% chance
    
    if (success) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Case Dismissed</h4>
        <p style="margin: 0 0 10px 0;">They investigate your claim. Your son is questioned and takes the blame.</p>
        <p style="margin: 0 0 10px 0;">The case is dismissed.</p>
      `;
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman cleared of harassment - son blamed', 4);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 4);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 2);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Claim Rejected</h4>
        <p style="margin: 0 0 10px 0;">They don't believe your story. The case proceeds to sentencing.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine £${fineC.toLocaleString()}, Club fine £${fineK.toLocaleString()}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of harassment after false son claim', 20);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 20);
        
        // Show register signing step
        await presentHarassmentRegisterSigningPopup(severity, resolve);
      }
    }
  }
  
  async function presentHarassmentFramingClaimPopup(severity, prisonTerm, fineC, fineK, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const success = Math.random() < 0.30; // 30% chance
    
    if (success) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Case Dismissed</h4>
        <p style="margin: 0 0 10px 0;">They consider your claim. Case dismissed due to insufficient evidence.</p>
      `;
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman claims harassment framing by rivals', 8);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 8);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 2);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Claim Rejected</h4>
        <p style="margin: 0 0 10px 0;">The magistrate dismisses your conspiracy theory. "This is workplace harassment, not a football conspiracy."</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine £${fineC.toLocaleString()}, Club fine £${fineK.toLocaleString()}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for workplace misconduct."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        // Show register signing step
        await presentHarassmentRegisterSigningPopup(severity, resolve);
      }
    }
  }
  
  // ---------- Harassment Register Signing Popup ----------
  async function presentHarassmentRegisterSigningPopup(severity, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">📋 THE SEX OFFENDERS REGISTER</h4>
      <p style="margin: 0 0 10px 0;">The magistrate presents you with a large, official-looking register.</p>
      <p style="margin: 0 0 10px 0;">"You must sign this register for ${krazyGames} matches. Your name will be marked as a 'SEX OFFENDER' in all official records."</p>
      <p style="margin: 0 0 10px 0;">The register sits on the desk, waiting ominously for your signature...</p>
    `;
    
    const choice = await showInvestigationOptions([
      { key: 'sign', label: 'Sign the Sex Offenders Register', variant: 'warn' }
    ]);
    
    if (choice === 'sign') {
      // Place on legacy KRAZY register (old system used by chants / nightclub lockout)
      S.onKrazyRegister = true;
      S.krazyGamesRemaining = krazyGames;
      
      // Also ensure the newer sex_offender_register system is activated so
      // all consequences (news, Portsmouth penalties, etc.) stay in sync.
      if (!S.sex_offender_register) S.sex_offender_register = {};
      S.sex_offender_register.active = true;
      // Use the same duration as the KRAZY register so both countdowns match
      S.sex_offender_register.games_remaining = krazyGames;
      
      // Award achievement
      if (typeof window.achievements !== 'undefined') {
        window.achievements.add({
          id: 'became_krazy',
          title: 'Became a Sex Offender',
          description: 'Placed on THE SEX OFFENDERS REGISTER for inappropriate conduct',
          icon: '🚨'
        });
      }
      
      // Trigger manager confrontation
      if (typeof triggerKrazyManagerConfrontation === 'function') {
        triggerKrazyManagerConfrontation();
      }
      
      // Trigger team fallout
      if (typeof triggerKrazyTeamFallout === 'function') {
        triggerKrazyTeamFallout();
      }
      
      // Queue press coverage
      if (typeof queueKrazyPressCoverage === 'function') {
        queueKrazyPressCoverage();
      }
      
      // Apply shared sex offender consequences (players quitting, texts, etc.)
      if (typeof window.applySexOffenderConsequences === 'function') {
        window.applySexOffenderConsequences();
      }
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✍️ Register Signed</h4>
        <p style="margin: 0 0 10px 0;">You sign THE SEX OFFENDERS REGISTER with a heavy heart.</p>
        <p style="margin: 0 0 10px 0;"><strong style="color: #ff6b6b;">🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${krazyGames} matches!</strong></p>
        <p style="margin: 0 0 10px 0;">Your name will be tagged as "SEX OFFENDER" in all logs and opposing fans will chant about it.</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-top: 15px;">
          <strong style="color: #ff6b6b;">The case is now closed.</strong>
        </div>
      `;
      
      S._police_interview_active = false;
      updateHUD?.();
      
      // Clear step options
      if (stepOptions) {
        stepOptions.innerHTML = '';
      }
      
      // Close modal after a delay
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    }
  }

  // ---------- Async Indecent Exposure Investigation Popup Handler ----------
  async function presentIndecentExposureInvestigationPopup(caseType, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Calculate severity and fines
    const severity = calculatePoliceSeverity();
    const fineC = 30000 + Math.floor(Math.random() * 30000);
    const fineK = Math.round(fineC * 1.2);
    const registerGames = 3 + Math.floor(Math.random() * 5); // 3-7 games
    
    // Check for available certificates
    const availableCertificates = S.doctor && S.doctor.disorder_certificates ? 
      S.doctor.disorder_certificates.filter(cert => !cert.used) : [];
    
    // Step 1: Present charges
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🚨 POLICE INTERVIEW — Indecent Exposure</h4>
      <p style="margin: 0 0 10px 0;"><strong>You are charged with:</strong> ${caseType}</p>
      <p style="margin: 0 0 10px 0;">The officer reads from a file: "You were caught exposing your penis to the Portsmouth team bus. This constitutes indecent exposure in a public place."</p>
      <p style="margin: 0 0 10px 0;">"This is a public indecency case. You will be required to sign the sex offenders register if found guilty."</p>
    `;
    
    const options = [
      { key: 'guilty', label: "Guilty - I made a mistake.", variant: 'warn' },
      { key: 'not_guilty', label: "Not Guilty - It was a prank.", variant: '' },
      { key: 'bribe', label: `Attempt to bribe (${money(50000 + Math.floor(Math.random() * 50000))})`, variant: 'bad' }
    ];
    
    // Add certificate options if available
    if (availableCertificates.length > 0) {
      availableCertificates.forEach((cert, index) => {
        options.push({ 
          key: `cert_${index}`, 
          label: `Use ${cert.type} certificate (get out of jail free)`,
          variant: 'good'
        });
      });
    }
    
    const choice = await showInvestigationOptions(options);
    
    if (choice.startsWith('cert_')) {
      // Use disorder certificate
      const certIndex = parseInt(choice.split('_')[1]);
      const certificate = availableCertificates[certIndex];
      
      if (certificate) {
        certificate.used = true;
        
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">📜 Certificate Presented</h4>
          <p style="margin: 0 0 10px 0;">You present your <strong>${certificate.type}</strong> certificate to the police.</p>
          <p style="margin: 0 0 10px 0;">"Oh my god," the officer says, reading the diagnosis. "${certificate.description}"</p>
          <p style="margin: 0 0 10px 0;">"I had no idea you were suffering from this condition. This is so, so sad."</p>
          <p style="margin: 0 0 10px 0;">The police are sympathetic and decide not to arrest you. They let you go with a warning.</p>
          <p style="margin: 0 0 10px 0;">"We'll make sure you get the help you need," they say as they leave.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> No arrest consequences! Your reputation actually improves slightly due to the police's sympathy for your condition.
          </div>
        `;
        
        // Apply positive effects
        S.reputation = Math.min(100, (S.reputation || 50) + 2);
        
        // Update doctor UI if open
        if (typeof window.renderDoctor === 'function') {
          window.renderDoctor();
        }
        
        updateHUD?.();
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          closeInvestigationModal();
          resolve();
        }, 3000);
        return;
      }
    }
    
    if (choice === 'guilty') {
      await presentIndecentExposureGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve);
    } else if (choice === 'not_guilty') {
      await presentIndecentExposureNotGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve);
    } else if (choice === 'bribe') {
      await presentIndecentExposureBribePopup(severity, fineC, fineK, registerGames, resolve);
    }
  }
  
  async function presentIndecentExposureGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ COURT HEARING — Indecent Exposure</h4>
      <p style="margin: 0 0 10px 0;">You admit guilt. The magistrate nods gravely.</p>
      <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(fineC)}, Club fine ${money(fineK)}."</p>
      <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${registerGames} matches."</strong></p>
    `;
    
    const choice = await showInvestigationOptions([
      { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
    ]);
    
    if (choice === 'accept') {
      // Apply fines
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
      
      // Add press coverage
      if (typeof addPaper === 'function') {
        addPaper('Chairman convicted of indecent exposure', 12);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 12);
      
      // Show register signing step
      await presentIndecentExposureRegisterSigningPopup(registerGames, resolve);
    }
  }
  
  async function presentIndecentExposureNotGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const trialSuccess = Math.random() < 0.25; // 25% chance of acquittal
    
    if (trialSuccess) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Acquitted</h4>
        <p style="margin: 0 0 10px 0;">The magistrate finds insufficient evidence. The case is dismissed.</p>
      `;
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman acquitted of indecent exposure charges', 4);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 4);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 2);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      // Convicted - harsher sentence
      const trialFineC = Math.floor(fineC * 1.2);
      const trialFineK = Math.floor(fineK * 1.2);
      const trialRegisterGames = registerGames + 1;
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Convicted</h4>
        <p style="margin: 0 0 10px 0;">The magistrate finds you guilty. The sentence is harsher due to your not guilty plea.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(trialFineC)}, Club fine ${money(trialFineK)}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${trialRegisterGames} matches."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - trialFineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - trialFineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of indecent exposure after trial', 15);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 15);
        
        // Show register signing step
        await presentIndecentExposureRegisterSigningPopup(trialRegisterGames, resolve);
      }
    }
  }
  
  async function presentIndecentExposureBribePopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const bribeAmount = 50000 + Math.floor(Math.random() * 50000);
    const success = Math.random() < 0.35;
    
    if (success) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">💰 Bribe Successful</h4>
        <p style="margin: 0 0 10px 0;">A look. A nod. The file goes missing.</p>
        <p style="margin: 0 0 10px 0;">Your bribe of ${money(bribeAmount)} is accepted. The case is dropped.</p>
      `;
      
      if ((S.chairman_cash || 0) >= bribeAmount) {
        S.chairman_cash -= bribeAmount;
      } else {
        S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
      }
      S.police_risk = Math.max(0, (S.police_risk || 0) - 5);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Bribe Failed</h4>
        <p style="margin: 0 0 10px 0;">They bristle. "Attempted bribery, noted."</p>
        <p style="margin: 0 0 10px 0;">Your bribe attempt is rejected and you face additional charges.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(fineC)}, Club fine ${money(fineK)}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${registerGames} matches."</strong></p>
      `;
      
      S.police_risk = Math.min(100, (S.police_risk || 0) + 3);
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of indecent exposure after bribe attempt', 18);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 18);
        
        // Show register signing step
        await presentIndecentExposureRegisterSigningPopup(registerGames, resolve);
      }
    }
  }
  
  async function presentIndecentExposureRegisterSigningPopup(registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">📋 THE SEX OFFENDERS REGISTER</h4>
      <p style="margin: 0 0 10px 0;">The magistrate presents you with a large, official-looking register.</p>
      <p style="margin: 0 0 10px 0;">"You must sign this register for ${registerGames} matches. Your name will be marked as a 'SEX OFFENDER' in all official records."</p>
      <p style="margin: 0 0 10px 0;">The register sits on the desk, waiting ominously for your signature...</p>
    `;
    
    const choice = await showInvestigationOptions([
      { key: 'sign', label: 'Sign the Sex Offenders Register', variant: 'warn' }
    ]);
    
    if (choice === 'sign') {
      // Place on sex offender register using the same system as mooning fallback
      if (!S.sex_offender_register) S.sex_offender_register = {};
      S.sex_offender_register.active = true;
      S.sex_offender_register.games_remaining = registerGames;
      
      // Apply consequences via global helper so we can reuse the same logic
      if (typeof window.applySexOffenderConsequences === 'function') {
        window.applySexOffenderConsequences();
      }
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✍️ Register Signed</h4>
        <p style="margin: 0 0 10px 0;">You sign THE SEX OFFENDERS REGISTER with a heavy heart.</p>
        <p style="margin: 0 0 10px 0;"><strong style="color: #ff6b6b;">🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${registerGames} matches!</strong></p>
        <p style="margin: 0 0 10px 0;">Your name will be tagged as "SEX OFFENDER" in all logs and opposing fans will chant about it.</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-top: 15px;">
          <strong style="color: #ff6b6b;">The case is now closed.</strong>
        </div>
      `;
      
      S._police_interview_active = false;
      updateHUD?.();
      
      // Clear step options
      if (stepOptions) {
        stepOptions.innerHTML = '';
      }
      
      // Close modal after a delay
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    }
  }

  // ---------- Async Secret Zone Surveillance Investigation Popup Handler ----------
  async function presentSecretZoneSurveillanceInvestigationPopup(caseType, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const severity = 2;
    const fineC = 15000 + Math.floor(Math.random() * 10000);
    const fineK = 25000 + Math.floor(Math.random() * 15000);
    const registerGames = 4 + Math.floor(Math.random() * 4); // 4-7 games
    
    // Check for available certificates
    const availableCertificates = S.doctor && S.doctor.disorder_certificates ? 
      S.doctor.disorder_certificates.filter(cert => !cert.used) : [];
    
    // Step 1: Present charges
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🚨 POLICE INTERVIEW — Womens Toilet Surveillance</h4>
      <p style="margin: 0 0 10px 0;"><strong>You are charged with:</strong> ${caseType}</p>
      <p style="margin: 0 0 10px 0;">The officer reads from a file: "You were caught watching inappropriate surveillance footage from the womens toilet. This constitutes voyeurism and inappropriate use of surveillance equipment."</p>
      <p style="margin: 0 0 10px 0;">"This is a serious offense. You will be required to sign the sex offenders register if found guilty."</p>
    `;
    
    const options = [
      { key: 'guilty', label: "Guilty - I made a mistake. It was an accident.", variant: 'warn' },
      { key: 'not_guilty', label: "Not Guilty - I was just checking security.", variant: '' },
      { key: 'bribe', label: `Attempt to bribe (${money(50000 + Math.floor(Math.random() * 50000))})`, variant: 'bad' }
    ];
    
    // Add certificate options if available
    if (availableCertificates.length > 0) {
      availableCertificates.forEach((cert, index) => {
        options.push({ 
          key: `cert_${index}`, 
          label: `Use ${cert.type} certificate (get out of jail free)`,
          variant: 'good'
        });
      });
    }
    
    const choice = await showInvestigationOptions(options);
    
    if (choice.startsWith('cert_')) {
      // Use disorder certificate
      const certIndex = parseInt(choice.split('_')[1]);
      const certificate = availableCertificates[certIndex];
      
      if (certificate) {
        certificate.used = true;
        
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">📜 Certificate Presented</h4>
          <p style="margin: 0 0 10px 0;">You present your <strong>${certificate.type}</strong> certificate to the police.</p>
          <p style="margin: 0 0 10px 0;">"Oh my god," the officer says, reading the diagnosis. "${certificate.description}"</p>
          <p style="margin: 0 0 10px 0;">"I had no idea you were suffering from this condition. This is so, so sad."</p>
          <p style="margin: 0 0 10px 0;">The police are sympathetic and decide not to arrest you. They let you go with a warning.</p>
          <p style="margin: 0 0 10px 0;">"We'll make sure you get the help you need," they say as they leave.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> No arrest consequences! Your reputation actually improves slightly due to the police's sympathy for your condition.
          </div>
        `;
        
        // Apply positive effects
        S.reputation = Math.min(100, (S.reputation || 50) + 2);
        
        // Update doctor UI if open
        if (typeof window.renderDoctor === 'function') {
          window.renderDoctor();
        }
        
        updateHUD?.();
        
        // Auto-close after 3 seconds
        setTimeout(() => {
          closeInvestigationModal();
          resolve();
        }, 3000);
        return;
      }
    }
    
    if (choice === 'guilty') {
      await presentSecretZoneSurveillanceGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve);
    } else if (choice === 'not_guilty') {
      await presentSecretZoneSurveillanceNotGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve);
    } else if (choice === 'bribe') {
      await presentSecretZoneSurveillanceBribePopup(severity, fineC, fineK, registerGames, resolve);
    }
  }
  
  async function presentSecretZoneSurveillanceGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🏛️ COURT HEARING — Secret Zone Surveillance</h4>
      <p style="margin: 0 0 10px 0;">You admit guilt. The magistrate nods gravely.</p>
      <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(fineC)}, Club fine ${money(fineK)}."</p>
      <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${registerGames} matches."</strong></p>
    `;
    
    const choice = await showInvestigationOptions([
      { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
    ]);
    
    if (choice === 'accept') {
      // Apply fines
      S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineC);
      S.club_cash = Math.max(0, (S.club_cash || 0) - fineK);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
      
      // Add press coverage
      if (typeof addPaper === 'function') {
        addPaper('Chairman convicted of voyeurism via surveillance footage', 12);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 12);
      
      // Show register signing step
      await presentSecretZoneSurveillanceRegisterSigningPopup(registerGames, resolve);
    }
  }
  
  async function presentSecretZoneSurveillanceNotGuiltyPleaPopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const trialSuccess = Math.random() < 0.25; // 25% chance of acquittal
    
    if (trialSuccess) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Acquitted</h4>
        <p style="margin: 0 0 10px 0;">The magistrate finds insufficient evidence. The case is dismissed.</p>
      `;
      
      if (typeof addPaper === 'function') {
        addPaper('Chairman acquitted of surveillance voyeurism charges', 4);
      }
      S.reputation = Math.max(0, (S.reputation || 0) - 4);
      S.police_risk = Math.max(0, (S.police_risk || 0) - 2);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      // Convicted - harsher sentence
      const trialFineC = Math.floor(fineC * 1.2);
      const trialFineK = Math.floor(fineK * 1.2);
      const trialRegisterGames = registerGames + 1;
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Convicted</h4>
        <p style="margin: 0 0 10px 0;">The magistrate finds you guilty. The sentence is harsher due to your not guilty plea.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(trialFineC)}, Club fine ${money(trialFineK)}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${trialRegisterGames} matches."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - trialFineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - trialFineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of surveillance voyeurism after trial', 15);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 15);
        
        // Show register signing step
        await presentSecretZoneSurveillanceRegisterSigningPopup(trialRegisterGames, resolve);
      }
    }
  }
  
  async function presentSecretZoneSurveillanceBribePopup(severity, fineC, fineK, registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const bribeAmount = 50000 + Math.floor(Math.random() * 50000);
    const success = Math.random() < 0.35;
    
    if (success) {
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">💰 Bribe Successful</h4>
        <p style="margin: 0 0 10px 0;">A look. A nod. The file goes missing.</p>
        <p style="margin: 0 0 10px 0;">Your bribe of ${money(bribeAmount)} is accepted. The case is dropped.</p>
      `;
      
      if ((S.chairman_cash || 0) >= bribeAmount) {
        S.chairman_cash -= bribeAmount;
      } else {
        S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
      }
      S.police_risk = Math.max(0, (S.police_risk || 0) - 5);
      
      S._police_interview_active = false;
      updateHUD?.();
      
      setTimeout(() => {
        closeInvestigationModal();
        resolve();
      }, 3000);
    } else {
      // Bribe failed - harsher sentence
      const bribeFineC = Math.floor(fineC * 1.3);
      const bribeFineK = Math.floor(fineK * 1.3);
      const bribeRegisterGames = registerGames + 2;
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Bribe Rejected</h4>
        <p style="margin: 0 0 10px 0;">The officer is outraged. "How dare you try to bribe me!"</p>
        <p style="margin: 0 0 10px 0;">The magistrate is informed of your bribe attempt. The sentence is much harsher.</p>
        <p style="margin: 0 0 10px 0;">"I sentence you to: Personal fine ${money(bribeFineC)}, Club fine ${money(bribeFineK)}."</p>
        <p style="margin: 0 0 10px 0;"><strong>"Additionally, you will be placed on THE SEX OFFENDERS REGISTER for ${bribeRegisterGames} matches."</strong></p>
      `;
      
      const choice = await showInvestigationOptions([
        { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
      ]);
      
      if (choice === 'accept') {
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - bribeFineC);
        S.club_cash = Math.max(0, (S.club_cash || 0) - bribeFineK);
        S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
        
        if (typeof addPaper === 'function') {
          addPaper('Chairman convicted of surveillance voyeurism after bribe attempt', 18);
        }
        S.reputation = Math.max(0, (S.reputation || 0) - 18);
        
        // Show register signing step
        await presentSecretZoneSurveillanceRegisterSigningPopup(bribeRegisterGames, resolve);
      }
    }
  }
  
  async function presentSecretZoneSurveillanceRegisterSigningPopup(registerGames, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Place on sex offender register
    if (!S.sex_offender_register) S.sex_offender_register = {};
    S.sex_offender_register.active = true;
    S.sex_offender_register.games_remaining = registerGames;
    S.onKrazyRegister = true;
    S.krazyGamesRemaining = registerGames;
    
    // Apply consequences via global helper so we can reuse the same logic
    if (typeof window.applySexOffenderConsequences === 'function') {
      window.applySexOffenderConsequences();
    }
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">✍️ Register Signed</h4>
      <p style="margin: 0 0 10px 0;">You sign THE SEX OFFENDERS REGISTER with a heavy heart.</p>
      <p style="margin: 0 0 10px 0;"><strong style="color: #ff6b6b;">🚨 You have been placed on THE SEX OFFENDERS REGISTER for ${registerGames} matches!</strong></p>
      <p style="margin: 0 0 10px 0;">Your name will be tagged as "SEX OFFENDER" in all logs and opposing fans will chant about it.</p>
      <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid #ff6b6b; margin-top: 15px;">
        <strong style="color: #ff6b6b;">The case is now closed.</strong>
      </div>
    `;
    
    S._police_interview_active = false;
    updateHUD?.();
    
    // Clear step options
    if (stepOptions) {
      stepOptions.innerHTML = '';
    }
    
    // Close modal after a delay
    setTimeout(() => {
      closeInvestigationModal();
      resolve();
    }, 3000);
  }

  async function presentPoliceSentencingPopup(caseType, resolve) {
    // SAFETY CHECK: Harassment cases should never reach here, but if they do, route them correctly
    if (caseType === 'harassment_via_messages') {
      await presentHarassmentInvestigationPopup(caseType, resolve);
      return;
    }
    
    // SAFETY CHECK: Indecent Exposure cases should never reach here, but if they do, route them correctly
    // Handle both "Indecent Exposure" and "Indecent Exposure of penis" variations
    if (caseType === 'Indecent Exposure' || caseType === 'Indecent Exposure of penis' || caseType.includes('Indecent Exposure')) {
      await presentIndecentExposureInvestigationPopup(caseType, resolve);
      return;
    }
    
    // SAFETY CHECK: Secret Zone Surveillance cases should never reach here, but if they do, route them correctly
    if (caseType === 'Secret Zone Surveillance') {
      await presentSecretZoneSurveillanceInvestigationPopup(caseType, resolve);
      return;
    }
    
    // Safe resolve helper to prevent double-resolving
    let resolved = false;
    function safeResolve() {
      if (resolved) return;
      resolved = true;
      if (typeof resolve === 'function') resolve();
    }
    
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    // Safety check: ensure elements exist
    if (!stepContent) {
      console.error("presentPoliceSentencing: stepContent element not found");
      safeResolve();
      return;
    }
    
    function ensureSuspensions(){
      try{
        if (!S.suspensions || typeof S.suspensions !== 'object') S.suspensions = {};
        if (!Number.isFinite(S.suspensions.prison_games)) S.suspensions.prison_games = 0;
        if (!Number.isFinite(S.suspensions.rehab_games)) S.suspensions.rehab_games = 0;
      }catch(e){  }
    }
    
    // Calculate severity for sentencing
    const severity = typeof calculatePoliceSeverity === 'function' ? calculatePoliceSeverity() : 50;
    const fineChair = 30000 + Math.floor(Math.random() * 30000);
    const fineClub = Math.round(fineChair * 1.2);
    const prisonTerm = severity > 50 ? Math.floor(Math.random() * 3) + 1 : 0;
    
    // Safe money formatter
    const formatMoney = typeof money === 'function' ? money : (val) => '£' + val.toLocaleString();
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">⚖️ Sentencing</h4>
      <p style="margin: 0 0 10px 0;">You admit guilt. The officer nods grimly.</p>
      <p style="margin: 0 0 10px 0;">Based on the evidence and your admission, the following penalties are imposed:</p>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Personal fine: ${formatMoney(fineChair)}</li>
        <li>Club fine: ${formatMoney(fineClub)}</li>
        ${prisonTerm > 0 ? `<li>Prison sentence: ${prisonTerm} game(s)</li>` : ''}
      </ul>
    `;
    
    const options = [
      { key: 'accept', label: 'Accept the sentence', variant: 'warn' }
    ];
    
    let choice;
    try {
      choice = await showInvestigationOptions(options);
    } catch (e) {
      console.error("Error showing investigation options:", e);
      closeInvestigationModal();
      safeResolve();
      return;
    }
    
    if (choice === 'accept') {
      try {
        // Apply consequences
        if (typeof S !== 'undefined') {
          S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
          S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
          S.legal_risk = Math.min(100, (S.legal_risk || 0) + 5);
          S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 6);
          S.reputation = Math.max(0, (S.reputation || 0) - 15);
          
          ensureSuspensions();
          if (prisonTerm > 0) {
            const oldPrisonGames = S.suspensions?.prison_games || 0;
            S.suspensions.prison_games = (S.suspensions?.prison_games || 0) + prisonTerm;
            S.prison = true;
          }
        }
        
        if (typeof S !== 'undefined') {
          S.police_risk = Math.max(0, (S.police_risk || 0) - 4);
          S._police_interview_in_progress = false;
          S._police_interview_active = false;
          saveGame();
          try { if (typeof logSafe === 'function') logSafe('PRISON: Sentence queued. You will serve during upcoming matches.'); } catch(_){ }
        }
        
        if (stepContent) {
          stepContent.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Sentence Applied</h4>
            <p style="margin: 0 0 10px 0;">The sentence has been applied. Your police risk has been reduced due to cooperation.</p>
            <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
              <strong style="color: var(--accent);">Consequences:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Personal fine: ${formatMoney(fineChair)}</li>
                <li>Club fine: ${formatMoney(fineClub)}</li>
                ${prisonTerm > 0 ? `<li>Prison sentence: ${prisonTerm} game(s)</li>` : ''}
                <li>Police risk reduced</li>
              </ul>
            </div>
          `;
        }
        
        updateHUD?.();
        
        // Clear step options to prevent button conflicts
        if (stepOptions) {
          stepOptions.innerHTML = '';
        }
        
        // Ensure all state flags are cleared and state is saved
        if (typeof S !== 'undefined') {
          S._police_interview_in_progress = false;
          S._police_interview_active = false;
          
          // Final check: if prison was set, ensure state is consistent
          if (prisonTerm > 0 && (S.suspensions?.prison_games|0) > 0) {
            // Ensure prison flag is set
            S.prison = true;
            // Double-check suspensions object exists
            if (!S.suspensions || typeof S.suspensions !== 'object') {
              S.suspensions = {};
            }
            // Ensure prison_games is set correctly
            if (!Number.isFinite(S.suspensions.prison_games) || S.suspensions.prison_games <= 0) {
              S.suspensions.prison_games = prisonTerm;
            }
          }
          
          // Save state before resolving
          saveGame();
        }
        
        // Close modal and resolve - use safeResolve to prevent double-resolving
        try { 
          closeInvestigationModal(); 
        } catch(e) {
          console.error("DEBUG ACCEPT SENTENCE: Error closing modal:", e);
        }
        
        // AGGRESSIVE CLEANUP: Ensure all modals and overlays are removed
        try {
          // Remove all modal overlays
          const allModals = document.querySelectorAll('.modern-modal-overlay, .modal-overlay');
          allModals.forEach(modal => {
            try { modal.remove();  } catch(_) {}
          });
          
          // Clear the investigation modal reference
          if (window.currentInvestigationModal) {
            try {
              window.currentInvestigationModal.remove();
            } catch(_) {}
            window.currentInvestigationModal = null;
          }
          
          // Clear actions element
          const actionsEl = document.getElementById('actions');
          if (actionsEl) {
            actionsEl.innerHTML = '';
          }
          
        } catch(cleanupError) {
          console.error("DEBUG ACCEPT SENTENCE: Error during aggressive cleanup:", cleanupError);
        }
        
        // Resolve to allow game loop to continue - this must happen
        safeResolve();
        
        // Return immediately after resolving to prevent further execution
        return;
      } catch (e) {
        console.error("Error in accept sentence handler:", e);
        // Ensure modal closes even on error
        try { 
          closeInvestigationModal(); 
          // Remove any remaining modal overlays
          const modals = document.querySelectorAll('.modern-modal-overlay');
          modals.forEach(modal => {
            try { modal.remove(); } catch(_){}
          });
        } catch(_) {}
        // Clear state flags
        try {
          if (typeof S !== 'undefined') {
            S._police_interview_in_progress = false;
            S._police_interview_active = false;
          }
        } catch(_){}
        // Resolve to prevent game freeze - use safeResolve
        safeResolve();
      }
    }
  }

  async function presentPoliceExcuses(caseType, resolve) {
    // SAFETY CHECK: Harassment cases should never reach here, but if they do, route them correctly
    if (caseType === 'harassment_via_messages') {
      await presentHarassmentInvestigationPopup(caseType, resolve);
      return;
    }
    
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">🤔 Pleading Your Case</h4>
      <p style="margin: 0 0 10px 0;">The officer raises an eyebrow. "Not guilty? Then explain yourself."</p>
      <p style="margin: 0 0 10px 0;">How do you want to defend yourself?</p>
    `;
    
    const options = [
      { key: 'mental_health', label: 'Blame mental health issues', variant: '' },
      { key: 'blame_others', label: 'Blame a player/manager', variant: 'bad' },
      { key: 'bribe', label: 'Offer a bribe', variant: 'bad' }
    ];
    
    const choice = await showInvestigationOptions(options);
    
    if (choice === 'mental_health') {
      // In seasons 4 and 5, mental health isn't recognized
      if (S.season === 4 || S.season === 5) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Mental Health Defense Rejected</h4>
          <p style="margin: 0 0 10px 0;">"Mental health isn't real," the officer says flatly.</p>
          <p style="margin: 0 0 10px 0;">You are treated as if you pleaded not guilty and were found guilty. Full punishment applies.</p>
        `;
        await presentPoliceSentencingPopup(caseType, resolve);
        return;
      }
      
      const success = Math.random() < 0.35;
      if (success) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Mental Health Defense Successful</h4>
          <p style="margin: 0 0 10px 0;">One detective softens. "We'll caution you."</p>
          <p style="margin: 0 0 10px 0;">Your mental health defense is accepted. You receive a caution instead of charges.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> Police risk reduced, no fines or prison time.
          </div>
        `;
        S.police_risk = Math.max(0, (S.police_risk || 0) - 3);
      } else {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Mental Health Defense Failed</h4>
          <p style="margin: 0 0 10px 0;">They don't buy it. They proceed with charges.</p>
          <p style="margin: 0 0 10px 0;">Your mental health defense is rejected and you face the full consequences.</p>
        `;
        await presentPoliceSentencingPopup(caseType, resolve);
        return;
      }
    } else if (choice === 'blame_others') {
      if (S.stolen?.planted_cash_target) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">🎯 Scapegoat Successful</h4>
          <p style="margin: 0 0 10px 0;">You plant evidence on ${S.stolen.planted_cash_target}. The case drifts... for now.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> Case delayed, but reputation damaged.
          </div>
        `;
        S.reputation = Math.max(0, (S.reputation || 0) - 6);
      } else {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Scapegoat Failed</h4>
          <p style="margin: 0 0 10px 0;">You try to scapegoat; the officers frown.</p>
          <p style="margin: 0 0 10px 0;">Your attempt to blame others backfires and makes things worse.</p>
        `;
        S.reputation = Math.max(0, (S.reputation || 0) - 4);
        const fineChair = 30000 + Math.floor(Math.random() * 30000);
        S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - Math.round(fineChair * 0.25));
        await presentPoliceSentencingPopup(caseType, resolve);
        return;
      }
    } else if (choice === 'bribe') {
      const bribeAmount = 50000 + Math.floor(Math.random() * 50000);
      const success = Math.random() < 0.35;
      
      if (success) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">💰 Bribe Successful</h4>
          <p style="margin: 0 0 10px 0;">A look. A nod. The file goes missing.</p>
          <p style="margin: 0 0 10px 0;">Your bribe of ${money(bribeAmount)} is accepted. The case is dropped.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> Case closed, police risk reduced.
          </div>
        `;
        
        if ((S.chairman_cash || 0) >= bribeAmount) {
          S.chairman_cash -= bribeAmount;
        } else {
          S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
        }
        S.police_risk = Math.max(0, (S.police_risk || 0) - 5);
      } else {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Bribe Failed</h4>
          <p style="margin: 0 0 10px 0;">They bristle. "Attempted bribery, noted."</p>
          <p style="margin: 0 0 10px 0;">Your bribe attempt is rejected and you face additional charges.</p>
        `;
        S.police_risk = Math.min(100, (S.police_risk || 0) + 3);
        await presentPoliceSentencingPopup(caseType, resolve);
        return;
      }
    }
    
    updateHUD?.();
    
    // AGGRESSIVE CLEANUP: Ensure all modals and overlays are removed
    try {
      // Remove all modal overlays
      const allModals = document.querySelectorAll('.modern-modal-overlay, .modal-overlay');
      allModals.forEach(modal => {
        try { modal.remove();  } catch(_) {}
      });
      
      // Clear the investigation modal reference
      if (window.currentInvestigationModal) {
        try {
          window.currentInvestigationModal.remove();
        } catch(_) {}
        window.currentInvestigationModal = null;
      }
      
      // Clear actions element
      const actionsEl = document.getElementById('actions');
      if (actionsEl) {
        actionsEl.innerHTML = '';
      }
      
    } catch(cleanupError) {
      console.error("DEBUG EXCUSE: Error during aggressive cleanup:", cleanupError);
    }
    
    // Close modal and resolve immediately
    try {
      closeInvestigationModal();
    } catch(e) {
      console.error("DEBUG EXCUSE: Error closing modal:", e);
    }
    
    resolve();
  }

  async function runFAInvestigation(caseType, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const base = 30000 + Math.floor(Math.random() * 90000);
    const pts = Math.random() < 0.35 ? Math.floor(Math.random() * 6) + 1 : 0;
    const susp = Math.random() < 0.35 ? Math.floor(Math.random() * 4) + 1 : 0;
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">📰 FA Investigation</h4>
      <p style="margin: 0 0 10px 0;">The FA is investigating ${caseType} at Southampton.</p>
      <p style="margin: 0 0 10px 0;">They have evidence of misconduct and are considering sanctions.</p>
    `;
    
    const options = [
      { key: 'accept', label: `Accept guilt (fine ${money(base)}${pts ? `, -${pts} pts` : ''}${susp ? `, suspended ${susp} game(s)` : ''})`, variant: 'warn' },
      { key: 'mental_health', label: 'Plead mental health (medium risk)', variant: '' },
      { key: 'bribe', label: `"What makes this go away?" (${money(base + 15000 + Math.floor(Math.random() * 25000))})`, variant: 'bad' }
    ];
    
    const choice = await showInvestigationOptions(options);
    
    if (choice === 'accept') {
      S.club_cash = Math.max(0, (S.club_cash || 0) - base);
      if (pts) {
        S.points_deducted = (S.points_deducted || 0) + pts;
        const clubName = S.club_name || "Southampton FC";
        if (S.table && S.table[clubName]) {
          S.table[clubName].PTS = (S.table[clubName].PTS || 0) - pts;
        }
      }
      if (susp) S.suspensions = Object.assign(S.suspensions || {}, { house_games: (S.suspensions?.house_games || 0) + susp });
      S.fa_risk = Math.max(0, (S.fa_risk || 0) - 3);
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ FA Sanctions Applied</h4>
        <p style="margin: 0 0 10px 0;">You accept the FA's sanctions.</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
          <strong style="color: var(--accent);">Sanctions:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Fine: ${money(base)}</li>
            ${pts ? `<li>Points deduction: -${pts}</li>` : ''}
            ${susp ? `<li>Suspension: ${susp} game(s)</li>` : ''}
          </ul>
        </div>
      `;
    } else if (choice === 'mental_health') {
      // In seasons 4 and 5, mental health isn't recognized
      if (S.season === 4 || S.season === 5) {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Mental Health Defense Rejected</h4>
          <p style="margin: 0 0 10px 0;">"Mental health isn't real," the panel says dismissively.</p>
          <p style="margin: 0 0 10px 0;">You are treated as if you pleaded not guilty and were found guilty. Full sanctions apply.</p>
        `;
        // Apply full sanctions as if you accepted guilt
        S.club_cash = Math.max(0, (S.club_cash || 0) - base);
        if (pts) {
          S.points_deducted = (S.points_deducted || 0) + pts;
          const clubName = S.club_name || "Southampton FC";
          if (S.table && S.table[clubName]) {
            S.table[clubName].PTS = (S.table[clubName].PTS || 0) - pts;
          }
        }
        if (susp) S.suspensions = Object.assign(S.suspensions || {}, { house_games: (S.suspensions?.house_games || 0) + susp });
        stepContent.innerHTML += `
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Sanctions Applied:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Fine: ${money(base)}</li>
              ${pts ? `<li>Points deduction: -${pts}</li>` : ''}
              ${susp ? `<li>Suspension: ${susp} game(s)</li>` : ''}
            </ul>
          </div>
        `;
      } else {
        const success = Math.random() < 0.4;
        if (success) {
          stepContent.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Mental Health Defense Successful</h4>
            <p style="margin: 0 0 10px 0;">They offer 'one more chance'.</p>
            <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
              <strong style="color: var(--accent);">Result:</strong> FA risk reduced, no sanctions.
            </div>
          `;
          S.fa_risk = Math.max(0, (S.fa_risk || 0) - 2);
        } else {
          stepContent.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Mental Health Defense Failed</h4>
            <p style="margin: 0 0 10px 0;">They're unmoved. A reduced fine is imposed.</p>
            <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
              <strong style="color: var(--accent);">Result:</strong> Reduced fine applied.
            </div>
          `;
          S.club_cash = Math.max(0, (S.club_cash || 0) - Math.round(base * 0.65));
        }
      }
    } else if (choice === 'bribe') {
      const bribeAmount = base + 15000 + Math.floor(Math.random() * 25000);
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">💰 Bribe Successful</h4>
        <p style="margin: 0 0 10px 0;">A whisper. "Keep your head down." Case closed.</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
          <strong style="color: var(--accent);">Result:</strong> Case closed, FA risk reduced.
        </div>
      `;
      
      if ((S.chairman_cash || 0) >= bribeAmount) {
        S.chairman_cash -= bribeAmount;
      } else {
        S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
      }
      S.fa_risk = Math.max(0, (S.fa_risk || 0) - 4);
    }
    
    updateHUD?.();
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      closeInvestigationModal();
      resolve();
    }, 3000);
  }

  async function runBoardInvestigation(caseType, resolve) {
    const stepContent = document.getElementById('stepContent');
    const stepOptions = document.getElementById('stepOptions');
    
    const base = 12000 + Math.floor(Math.random() * 48000);
    
    stepContent.innerHTML = `
      <h4 style="margin: 0 0 15px 0; color: var(--accent);">📋 Board Meeting</h4>
      <p style="margin: 0 0 10px 0;">The board summons you to discuss concerns about ${caseType}.</p>
      <p style="margin: 0 0 10px 0;">They are considering disciplinary action.</p>
    `;
    
    const options = [
      { key: 'accept', label: `Accept guilt (club fine ${money(base)})`, variant: 'warn' },
      { key: 'mental_health', label: 'Plead mental health (medium risk)', variant: '' },
      { key: 'bribe', label: `Quiet bribe (${money(base + 8000 + Math.floor(Math.random() * 12000))})`, variant: 'bad' }
    ];
    
    const choice = await showInvestigationOptions(options);
    
    if (choice === 'accept') {
      S.club_cash = Math.max(0, (S.club_cash || 0) - base);
      S.compliance_risk = Math.max(0, (S.compliance_risk || 0) - 2);
      S.board_support = Math.max(0, (S.board_support || 0) - 4);
      
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Board Reprimand</h4>
        <p style="margin: 0 0 10px 0;">Board issues a formal reprimand and fine.</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
          <strong style="color: var(--accent);">Consequences:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Club fine: ${money(base)}</li>
            <li>Board support reduced</li>
            <li>Compliance risk reduced</li>
          </ul>
        </div>
      `;
    } else if (choice === 'mental_health') {
      const success = Math.random() < 0.45;
      if (success) {
        const covered = Math.min(base, (S.debt_club || 0));
        S.debt_club = Math.max(0, (S.debt_club || 0) - covered);
        S.club_debt = S.debt_club; // sync
        // If debt is fully forgiven, clear creditor state
        if (S.debt_club <= 0 && S.debt_creditor?.active) {
          S.debt_creditor.active = false;
          S.debt_creditor.principal = 0;
          S.debt_creditor.matches_since_sale = 0;
        }
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">✅ Mental Health Defense Successful</h4>
          <p style="margin: 0 0 10px 0;">They sigh and give you one more chance. A charity covers some arrears.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> Compliance risk reduced, some debt cleared.
          </div>
        `;
        S.compliance_risk = Math.max(0, (S.compliance_risk || 0) - 3);
      } else {
        stepContent.innerHTML = `
          <h4 style="margin: 0 0 15px 0; color: var(--accent);">❌ Mental Health Defense Failed</h4>
          <p style="margin: 0 0 10px 0;">They're unconvinced. Support drops.</p>
          <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
            <strong style="color: var(--accent);">Result:</strong> Board support significantly reduced.
          </div>
        `;
        S.board_support = Math.max(0, (S.board_support || 0) - 6);
      }
    } else if (choice === 'bribe') {
      const bribeAmount = base + 8000 + Math.floor(Math.random() * 12000);
      stepContent.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: var(--accent);">💰 Bribe Successful</h4>
        <p style="margin: 0 0 10px 0;">Envelopes change hands. "Clean it up."</p>
        <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent); margin-top: 15px;">
          <strong style="color: var(--accent);">Result:</strong> Case closed, compliance risk reduced.
        </div>
      `;
      
      if ((S.chairman_cash || 0) >= bribeAmount) {
        S.chairman_cash -= bribeAmount;
      } else {
        S.club_cash = Math.max(0, (S.club_cash || 0) - bribeAmount);
      }
      S.compliance_risk = Math.max(0, (S.compliance_risk || 0) - 2);
    }
    
    updateHUD?.();
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      closeInvestigationModal();
      resolve();
    }, 3000);
  }

  function showInvestigationOptions(options) {
    return new Promise((resolve) => {
      let stepOptions = document.getElementById('stepOptions');
      // Guard against missing container
      if (!stepOptions) {
        const container = document.getElementById('investigationStep') || document.getElementById('investigationContent') || document.body;
        stepOptions = document.createElement('div');
        stepOptions.id = 'stepOptions';
        stepOptions.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 20px;';
        container.appendChild(stepOptions);
      }
      stepOptions.innerHTML = '';
      
      options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'btn';
        if (option.variant === 'warn') button.classList.add('warn');
        else if (option.variant === 'bad') button.classList.add('bad');
        else if (option.variant === 'good') button.classList.add('good');
        
        button.style.cssText = 'width: 100%; padding: 12px; margin: 0; text-align: left;';
        button.textContent = option.label;
        button.onclick = () => {
          // Disable all option buttons to prevent double-resolve
          try { Array.from(stepOptions.querySelectorAll('button')).forEach(b=>{ b.disabled = true; }); } catch(_) {}
          resolve(option.key);
        };
        stepOptions.appendChild(button);
      });
      // As a safety, also close on Escape
      try {
        const onKey = (e) => { if (e.key === 'Escape') { try { closeInvestigationModal(); } catch(_){} resolve('esc'); document.removeEventListener('keydown', onKey); } };
        document.addEventListener('keydown', onKey);
      } catch(_){ }
    });
  }

  window.closeInvestigationModal = function() {
    try {
      if (window.currentInvestigationModal) {
        window.currentInvestigationModal.remove();
        window.currentInvestigationModal = null;
      }
      // Clear any remaining investigation-related DOM elements
      const stepContent = document.getElementById('stepContent');
      const stepOptions = document.getElementById('stepOptions');
      if (stepContent) stepContent.innerHTML = '';
      if (stepOptions) stepOptions.innerHTML = '';
      
      // Ensure actions container is clear and ready for next interaction
      const actionsEl = document.getElementById('actions');
      if (actionsEl) {
        actionsEl.innerHTML = '';
      }
    } catch (e) {
      console.error("Error closing investigation modal:", e);
    }
  };

  // ---------- hook post‑match: only queue, never show buttons here ----------
  (function hookLogForQueue(){
    const prev = window.log || function(){};
    if (prev.__queueOversightPatched) return;
    window.log = function(){
      const msg = arguments[0];
      const ret = prev.apply(this, arguments);
      try{
        if (typeof msg === "string" && msg.indexOf("Attendance:") === 0 && msg.indexOf("Gate Revenue:") !== -1){
          // We are in post‑match: just *queue* oversight, do not render options here.
          setTimeout(maybeQueueOversight, 120);
        }
      }catch(_){}
      return ret;
    };
    window.log.__queueOversightPatched = true;
  })();

  // Expose maybeQueueOversight to global scope
  window.maybeQueueOversight = maybeQueueOversight;
  
  // Test function to verify presentInvestigation works (for debugging)
  window.testPoliceInterview = function() {
    if (typeof window.presentInvestigation === 'function') {
      window.presentInvestigation({ authority: 'police', caseType: 'test case' });
    } else {
      console.error("DEBUG: presentInvestigation function does not exist");
    }
  };

})();