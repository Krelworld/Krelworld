/* === Patch 4B.2 — Prison Enforcement Mode === */
(function(){

  function roundIndex(){
    try{
      if (S && S.matchContext && Number.isFinite(S.matchContext.roundIndex)) return S.matchContext.roundIndex;
      return Math.max(0, (S?.matches_played|0) - 1);
    }catch(_){ return 0; }
  }
  function feed(msg){ try{ (window.log||console.log)(msg); }catch(_){ } }
  function hud(){ try{ (window.updateHUD||function(){})() }catch(_){ } }


  // --- Pre‑match filter: strip bribery/dirty actions while in prison ---
  const BAD_TXT = /(bribe|blackmail|rummag|rummage|plant|drugs?|dealer|home life|visit (?:own|opp) locker|locker|tunnel|bookie|bet|fix match|fix|scout|wine|dine|gift|pay off|shake|shake[- ]down|threat)/i;
  const OK_TXT  = /(proceed|kickoff|start match|continue|watch|observe|skip|quick result|save|load|reset|stats|inventory)/i;

  function prisonFilterOnce(){
    if (!isInPrison()) return;
    const root = actionsRoot();
    if (!root) return;
    const btns = Array.from(root.querySelectorAll('button, a'));

    // Remove any ref‑blackmail buttons too
    root.querySelectorAll('button[data-refblackmail="1"]').forEach(n=>n.remove());

    let hasProceed = false;
    for (const b of btns){
      const txt = (b.textContent||"").toLowerCase();
      // keep our own buttons
      if (b.dataset && (b.dataset.prisonallow === "1" || b.dataset.investigation === "1")) continue;

      if (OK_TXT.test(txt)){
        hasProceed = true;
        // keep as is
        continue;
      }
      if (BAD_TXT.test(txt)){
        b.remove();
        continue;
      }
      // For anything else in prison, default to removing to stay safe
      b.remove();
    }

    // If nothing obvious to proceed, add our own safe proceed
    if (!hasProceed){
      const b = document.createElement('button');
      b.textContent = "Proceed to kickoff (observe only)";
      b.dataset.prisonallow = "1";
      b.className = "warn";
      b.addEventListener('click', function(){
        // Check if we have enough players before proceeding
        if (typeof ensureValidLineup === "function") {
          ensureValidLineup();
        }
        if (S.lineup && S.lineup.length < 5) {
          feed("You cannot proceed to kickoff with less than 5 players. The match cannot start.");
          return;
        }
        
        // Try common proceed functions; else just log and let the normal loop advance
        const tryFns = ["proceedToKickoff","startMatch","next","continueToMatchDay","beginMatch","goToKickoff"];
        for (const fn of tryFns){
          if (typeof window[fn] === "function"){ window[fn](); return; }
        }
        // Fallback: set a flag so whatever your normal loop checks can move forward
        try{ S._prisonProceed = true; }catch(_){}
        feed("You take your seat on the bunk, hands tied by the system. The match goes ahead without you.");
      });
      root.appendChild(b);
    }
  }

  // Install a MutationObserver to keep the pre‑match list clean while in prison
  (function observeActions(){
    const root = actionsRoot();
    if (!root || window.__prisonObserver) return;
    const mo = new MutationObserver((_muts)=>{ if (isInPrison()) prisonFilterOnce(); });
    mo.observe(root, { childList:true, subtree:true });
    window.__prisonObserver = mo;
  })();

  // --- Per‑match morale hit while in prison ---
  function applyPrisonMoraleHit(){
    if (!isInPrison()) return;
    const rix = roundIndex();
    if (S._prisonMoraleRound === rix) return;
    S._prisonMoraleRound = rix;

    // Fans resent the situation; team feels leaderless
    const fanDrop  = 7;
    const teamDrop = 3;
    S.fan_morale = Math.max(0, (S.fan_morale|0) - fanDrop);
    S.team_morale_boost = Math.max(-5, (S.team_morale_boost|0) - teamDrop);
    feed(`PRISON EFFECT: Fan morale -${fanDrop}, team morale -${teamDrop}.`);
    hud();
  }

  // --- Post‑match: decrement prison_games once, announce, and keep loop alive ---
  // (Dormant: was keyed to an "Attendance: … Gate Revenue:" log line the core no longer writes;
  //  the prison loop in the core does the real countdown.)
  GameHooks.on('postmatch:gate-anchor', function(){
          if (isInPrison()){
            const rix = roundIndex();
            if (S._prisonTickRound !== rix){
              S._prisonTickRound = rix;
              S.suspensions.prison_games = Math.max(0, (S.suspensions.prison_games|0) - 1);
              if ((S.suspensions.prison_games|0) > 0){
                feed(`PRISON: You remain in custody for ${S.suspensions.prison_games} more match(es).`);
              } else {
                feed("PRISON: You are released. Full pre‑match options will return next game.");
                S.prison = false; // Clear the main prison flag
                
                // Reduce police risk after serving time (you've "paid your debt")
                S.police_risk = Math.max(0, (S.police_risk|0) - 15);
                S.legal_risk = Math.max(0, (S.legal_risk|0) - 10);
                S.compliance_risk = Math.max(0, (S.compliance_risk|0) - 5);
                feed("Your time served has reduced your legal exposure.");
              }
              hud();
            }
          }
  });
  // Pre-match: apply the per-match morale hit and keep the menu observe-only
  GameHooks.on('prematch', function(){
    applyPrisonMoraleHit();
    setTimeout(prisonFilterOnce, 50);
  });

  // On boot / reload, if already in prison, announce and filter once
  setTimeout(function(){
    if (isInPrison()){
      feed("PRISON: You'll watch from your cell. Home life disabled. Pre‑match limited to observe‑only actions.");
      applyPrisonMoraleHit();
      prisonFilterOnce();
      hud();
    }
  }, 800);

  // ---------- REHAB SYSTEM (parallel to prison) ----------
  
  function rehabFilterOnce(){
    if (!isInRehab()) return;
    const root = actionsRoot();
    if (!root) return;
    const btns = Array.from(root.querySelectorAll('button, a'));
    
    btns.forEach(btn => {
      const txt = (btn.textContent || '').toLowerCase();
      const isWatchOnly = /watch|observe|skip|quick result|proceed|continue|start match|kickoff/i.test(txt);
      
      if (!isWatchOnly) {
        btn.style.display = 'none';
      }
    });
    
    // Add watch-only button if not present
    if (!root.querySelector('[data-rehab-watch]')) {
      const watchBtn = document.createElement('button');
      watchBtn.textContent = 'Watch from rehab';
      watchBtn.dataset.rehabWatch = '1';
      watchBtn.className = 'good';
      watchBtn.addEventListener('click', function(){
        if (typeof window.quickResult === 'function') {
          window.quickResult();
        }
        // Decrement rehab cooldown
        S.coke_cooldown = Math.max(0, (S.coke_cooldown|0) - 1);
        if (S.coke_cooldown === 0) {
          log("You've completed your rehab program. You're free to return to normal activities.");
        } else {
          log(`Rehab continues. ${S.coke_cooldown} more match(es) to go.`);
        }
        if (typeof window.updateHUD === 'function') window.updateHUD();
      });
      root.appendChild(watchBtn);
    }
  }

  // Apply rehab filtering to action buttons
  (function observeRehabActions(){
    const root = actionsRoot();
    if (!root || window.__rehabObserver) return;
    const mo = new MutationObserver((_muts)=>{ if (isInRehab()) rehabFilterOnce(); });
    mo.observe(root, { childList:true, subtree:true });
    window.__rehabObserver = mo;
  })();

  // On boot / reload, if already in rehab, announce and filter once
  setTimeout(function(){
    if (isInRehab()){
      feed("REHAB: You're in treatment. Pre‑match limited to watch‑only actions.");
      rehabFilterOnce();
      if (typeof window.updateHUD === 'function') window.updateHUD();
    }
  }, 900);

  // ---------- COCAINE STATE EFFECTS ----------
  function applyCocaineStateEffects() {
    if (!S) return;
    
    // Buzzed state effects (1 bag)
    if (S.coke_state === "buzzed") {
      // Bribe success ×1.15, team-talk ×1.1, police_risk +4, legal_risk +3
      S._coke_bribe_multiplier = 1.15;
      S._coke_teamtalk_multiplier = 1.1;
      S.police_risk = (S.police_risk||0) + 4;
      S.legal_risk = (S.legal_risk||0) + 3;
      
      // Small input-error chance (simplified as random events)
      if (Math.random() < 0.05) {
        log("Your hands are shaking slightly from the cocaine...");
      }
    }
    
    // Wired state effects (2+ bags or current streak escalation)
    else if (S.coke_state === "wired") {
      // Bribe success ×1.35, police_risk +12, legal_risk +10, bookings +20% in sim
      S._coke_bribe_multiplier = 1.35;
      S.police_risk = (S.police_risk||0) + 12;
      S.legal_risk = (S.legal_risk||0) + 10;
      S._coke_booking_boost = 0.20; // +20% bookings in simulation
      
      // Opponent morale −12 if an "impulse" is used (handled in impulse effects)
    }
    
    // Crashing state effects
    else if (S.coke_state === "crashing") {
      // Team-talk effect halved; team morale −6 after the match
      S._coke_teamtalk_multiplier = 0.5;
      S._coke_crash_morale_penalty = 6;
    }
  }

  // Apply state effects once per pre-match
  GameHooks.on('prematch', function(){
    applyCocaineStateEffects();
    applyAddictionPenalties();
  });

  // Apply addiction penalties to team performance
  function applyAddictionPenalties() {
    if (!S) return;
    
    let totalPenalty = 0;
    let addictedPlayers = 0;
    
    // Calculate your team addiction penalties
    if (S._addiction_penalties) {
      for (const [playerId, penalty] of Object.entries(S._addiction_penalties)) {
        if (penalty > 0) {
          totalPenalty += penalty;
          addictedPlayers++;
        }
      }
    }
    
    // Calculate opposition addiction benefits (opposition players being addicted helps you)
    if (S.opposition_addiction) {
      let oppositionAddicted = 0;
      for (const [playerId, level] of Object.entries(S.opposition_addiction)) {
        if (level >= 2) { // Only count if they're actually addicted
          oppositionAddicted++;
        }
      }
      
      if (oppositionAddicted > 0) {
        // Opposition addiction helps you
        S.morale_opponent = Math.max(0, (S.morale_opponent||70) - (oppositionAddicted * 3));
        log(`The opposition has ${oppositionAddicted} addicted player(s), giving you an advantage.`);
      }
    }
    
    if (addictedPlayers > 0) {
      // Apply team performance penalty
      S.team_morale_boost = (S.team_morale_boost||0) - totalPenalty;
      
      // Log addiction effects
      if (addictedPlayers === 1) {
        log("One player is struggling with addiction, affecting team performance.");
      } else {
        log(`${addictedPlayers} players are struggling with addiction, significantly affecting team performance.`);
      }
      
      // Add detection risk for having addicted players
      S.coke_detection_risk = (S.coke_detection_risk||0) + addictedPlayers;
    }
  }

  // ---------- COCAINE DETECTION HOOKS ----------
  // Hook into existing investigation systems to include cocaine evidence
  (function hookCocaineDetection(){
    const origMaybeQueue = window.maybeQueueInvestigation;
    if (typeof origMaybeQueue !== "function" || window.__cokeDetectionHooked) return;
    window.__cokeDetectionHooked = true;
    
    window.maybeQueueInvestigation = function(authority, chance){
      try{
        // Add cocaine detection risk to the investigation chance
        const cokeRisk = (S.coke_detection_risk||0) * 0.1; // 10% per detection point
        const adjustedChance = chance !== undefined ? Math.min(0.95, chance + cokeRisk) : cokeRisk;
        
        // Check for planted evidence
        if (S.evidence && Object.keys(S.evidence).length > 0) {
          adjustedChance += 0.2; // +20% chance if evidence is planted
        }
        
        // Check for addiction evidence
        if (S.addiction && Object.keys(S.addiction).length > 0) {
          adjustedChance += 0.15; // +15% chance if players are addicted
        }
        
        // Call original function with adjusted chance
        return origMaybeQueue.call(this, authority, adjustedChance);
      }catch(e){
        console.warn("Cocaine detection hook error:", e);
        return origMaybeQueue.call(this, authority, chance);
      }
    };
  })();

})();