/* === Patch 5 — Drug-Related Dynamics (Players & Staff) === */
(function(){

  // ---------- State helpers ----------
  function ensureDrugState(){
    if (!window.S) return;
    if (!S.inventory || typeof S.inventory !== 'object') S.inventory = { accolades: [], drugs: 0 };
    if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
    if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;

    if (typeof S.drugs_unlocked !== 'boolean') S.drugs_unlocked = false;
    if (typeof S.drug_streak !== 'number') S.drug_streak = 0;           // consecutive matches
    if (typeof S.on_drugs_today !== 'boolean') S.on_drugs_today = false; // day flag
    if (!S.suspensions) S.suspensions = { house_games:0, prison_games:0, krazy_register_games:0, rehab_games:0 };
    if (typeof S.suspensions.rehab_games !== 'number') S.suspensions.rehab_games = 0;
  }
  function btn(label, cls, on){ const b=document.createElement('button'); b.textContent=label; if (cls) b.className=cls; b.dataset.patch5="1"; if(on) b.addEventListener('click', on); return b; }
  function clearPatch5Btns(){ try{ actionsRoot().querySelectorAll('button[data-patch5="1"]').forEach(n=>n.remove()); }catch(_){} }

  // ---------- HUD badge ----------
  // HUD extension (runs after updateHUD redraws)
  GameHooks.on('hud', function hookHUD(){
      try{
        ensureDrugState();
        const bar = document.getElementById('hudBar');
        if (bar){
          let pill = document.getElementById('hudDrugPill');
          if (!pill){
            pill = document.createElement('div');
            pill.id = 'hudDrugPill';
            pill.className = 'hitem';
            bar.insertBefore(pill, bar.lastElementChild); // near the right
          }
          const count = S.inventory?.drugs|0;
          const tag = (S.on_drugs_today ? 'UNDER INFLUENCE' : (S.drugs_unlocked?'Unlocked':'Locked'));
          pill.innerHTML = `<span class="label">Cocaine</span><span>${count} (${tag})</span>`;
        }
      }catch(_){}
  });


  // ---------- Buy & Use actions (Pre‑Match / Evening) ----------
  const DRUG_PRICE = 2500; // per bag
  const BRICK_PRICE = 100000; // per brick
  function showBuyDrugs(){
    ensureDrugState();
    const root = actionsRoot();
    clearPatch5Btns();
    const b1 = btn(`Call Marco (Buy 1 bag – ${moneyGBP(DRUG_PRICE)})`, "", function(){
      if ((S.chairman_cash|0) < DRUG_PRICE){ logSafe("Marco: \"Cash up front, mate.\" (Not enough money)"); return; }
      S.chairman_cash -= DRUG_PRICE; S.inventory.drugs = (S.inventory.drugs|0) + 1; 
      if (!S.stadium_dealing_unlocked) {
        S.stadium_dealing_unlocked = true;
        S.cocaine_purchase_matches_ago = 0; // Track when cocaine was first purchased
        S.marco_approach_attempted = false;
        logSafe("You buy 1 bag. A shady figure approaches you later: \"I hear you're in the market for... extracurricular activities.\"");
      } else {
        logSafe("You buy 1 bag.");
      }
      updateHUD?.();
    });
    const b5 = btn(`Buy 5 bags – ${moneyGBP(DRUG_PRICE*5)}`, "", function(){
      if ((S.chairman_cash|0) < DRUG_PRICE*5){ logSafe("Not enough money for 5 bags."); return; }
      S.chairman_cash -= DRUG_PRICE*5; S.inventory.drugs = (S.inventory.drugs|0) + 5; 
      if (!S.stadium_dealing_unlocked) {
        S.stadium_dealing_unlocked = true;
        S.cocaine_purchase_matches_ago = 0; // Track when cocaine was first purchased
        S.marco_approach_attempted = false;
        logSafe("You buy 5 bags for a slight loyalty discount (in spirit). A shady figure approaches you later: \"I hear you're in the market for... extracurricular activities.\"");
      } else {
        logSafe("You buy 5 bags for a slight loyalty discount (in spirit).");
      }
      updateHUD?.();
    });
    
    // Cheat code input for Marco
    const cheatContainer = document.createElement('div');
    cheatContainer.style.cssText = 'margin-top: 10px; padding: 10px; border-top: 1px solid rgba(255,255,255,0.1);';
    const cheatLabel = document.createElement('label');
    cheatLabel.textContent = 'Message Marco: ';
    cheatLabel.style.cssText = 'display: block; margin-bottom: 5px; color: rgba(255,255,255,0.7); font-size: 0.9em;';
    const cheatInput = document.createElement('input');
    cheatInput.type = 'text';
    cheatInput.className = 'modal-input';
    cheatInput.placeholder = 'Type a message...';
    cheatInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 5px;';
    cheatInput.addEventListener('input', function(e){
      const value = e.target.value.toLowerCase().trim();
      if (value === 'crongus5') {
        // Cheat code detected - advance to season 5
        ensureCore();
        S.season = 5;
        
        // Ensure season 4 flags are initialized (Season 5 continues from Season 4)
        if (!S.season4) S.season4 = {};
        if (!S.season4.initialized) {
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
        }
        
        // Initialize liquidated teams list if missing (needed for season 5)
        // Season 5 has fewer teams - all foreign except Southampton and Portsmouth
        if (!S.season4.liquidated_teams || !Array.isArray(S.season4.liquidated_teams)) {
          S.season4.liquidated_teams = [];
          
          // If we have a table from a previous season, use it to determine liquidated teams
          // Otherwise, liquidate all teams except Portsmouth and Southampton
          const allTeams = Object.keys(S.table || {});
          if (allTeams.length > 0) {
            const teamRankings = allTeams
              .filter(team => team !== "Portsmouth" && team !== "Southampton FC" && team !== "Southampton")
              .map(team => ({
                name: team,
                points: (S.table[team]?.PTS || 0),
                goalDiff: (S.table[team]?.GD || 0)
              }))
              .sort((a, b) => {
                if (a.points !== b.points) return a.points - b.points;
                return a.goalDiff - b.goalDiff;
              });
            
            // Take the 5-6 lowest ranked teams to liquidate
            const liquidatedTeams = teamRankings.slice(0, Math.min(6, teamRankings.length)).map(t => t.name);
            S.season4.liquidated_teams = liquidatedTeams;
          } else {
            // No previous table - liquidate all teams except Portsmouth and Southampton
            const ALL_TEAMS_LIST = ["Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
              "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
              "Man City","Man United","Newcastle","Tottenham","Wolves","Portsmouth"];
            S.season4.liquidated_teams = ALL_TEAMS_LIST.filter(t => t !== "Portsmouth" && t !== "Southampton FC");
          }
          
          // Mark these teams as destroyed/liquidated
          if (!S.destroyedTeams) S.destroyedTeams = [];
          S.season4.liquidated_teams.forEach(team => {
            if (!S.destroyedTeams.includes(team)) {
              S.destroyedTeams.push(team);
            }
          });
        }
        
        // Reset season statistics
        S.matches_played = 0;
        S.wins = 0;
        S.draws = 0;
        S.losses = 0;
        S.points = 0;
        S.points_deducted = 0;
        S.manager_fires = 0;
        S.fired_last_game = false;
        S.season_matches = 9; // Season 5 has 9 opponents (10 teams total including Southampton)
        
        // Reset CL active state
        S.clActive = false;
        S.clStage = 'group';
        S.clGroupMatches = [];
        S.clGroupStandings = {};
        S.clKnockoutRound = null;
        S.clKnockoutBracket = {};
        S.clScheduledMatches = [];
        S.clNextMatchIndex = 0;
        
        // Reset World Cup completion flag
        S.worldCupCompletedForSeason = false;
        
        // Reset some risks but keep some progression
        S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
        S.police_risk = Math.max(0, (S.police_risk||0) - 5);
        
        // Clear prison status
        S.prison = false;
        if(S.suspensions) {
          S.suspensions.prison_games = 0;
        }
        
        // Reset table for new season (after determining liquidated teams)
        S.table = {};
        S.table_order = [];
        S.leagueTableShownInPresentation = false;
        
        // Reset opponents schedule for new season
        S.opponents = [];
        if (typeof ensureSeasonSchedule === 'function') {
          ensureSeasonSchedule();
        }
        
        // Ensure league table is initialized
        if (typeof ensureLeagueTableInit === 'function') {
          ensureLeagueTableInit();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        // Initialize Season 5 if needed
        if (!S.season5) S.season5 = {};
        S.season5.initialized = true;
        S.season5.moral_audit_count = 0;
        S.season5.last_audit_match = -1;
        S.season5.injure_best_players_first_match = true;
        S.season5.first_match_special_event = true;
        // Initialize kidnapping sequence flag to false (will be set to true after it plays)
        S.season5.kidnapping_sequence_shown = false;
        if (S.season4) {
          S.season5.personal_life_locked = S.season4.personal_life_locked || true;
          S.season5.home_interaction_always_silent = S.season4.home_interaction_always_silent || true;
        }
        // Initialize Season 5 survival economy
        if (!S.season5.survival) {
          S.season5.survival = {
            base_bribe_amount: 150000,
            current_bribe_amount: 150000,
            bribe_multiplier: 1.15,
            matches_survived: 0,
            strategy_unlocked: {
              bribe: true,
              doping: false,
              intimidation: false,
            },
            doping_active: false,
            intimidation_used: false,
            background_deterioration: 0,
            squad_murdered: false,
            audit_scrutiny: 0,
            lobby_tokens_spent: 0,
          };
        }
        
        logSafe("Marco: \"Right, season 5 it is then. Don't ask how I did that.\"");
        logSafe("CHEAT CODE ACTIVATED: Advanced to Season 5");
        
        // Clear input
        e.target.value = '';
        
        // Update HUD and close
        if (typeof updateHUD === 'function') updateHUD();
        clearPatch5Btns();
      }
    });
    cheatContainer.appendChild(cheatLabel);
    cheatContainer.appendChild(cheatInput);
    
    const close = btn("Close", "", ()=>clearPatch5Btns());
    root.appendChild(b1); root.appendChild(b5); root.appendChild(cheatContainer); root.appendChild(close);
  }

  function getBrickCount() {
    if (!S.inventory || !Array.isArray(S.inventory.items)) {
      ensureInv();
      return 0;
    }
    const brick = S.inventory.items.find(item => item.name === 'Brick');
    return brick ? brick.quantity : 0;
  }

  // Visual ticker feedback for brick purchases
  window.showBrickTicker = function(startCount, endCount) {
    if (startCount >= endCount) return; // No increase, no ticker needed
    
    const ticker = document.createElement('div');
    ticker.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: brickTickerPulse 0.5s ease-in-out;
    `;
    
    // Add CSS animation if not already added
    if (!document.getElementById('brickTickerStyles')) {
      const style = document.createElement('style');
      style.id = 'brickTickerStyles';
      style.textContent = `
        @keyframes brickTickerPulse {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Animate the count
    let currentCount = startCount;
    const increment = () => {
      currentCount++;
      ticker.textContent = `🧱 Bricks: ${currentCount}`;
      if (currentCount < endCount) {
        setTimeout(increment, 200); // 200ms between each number
      } else {
        // Remove ticker after 2 seconds
        setTimeout(() => {
          if (ticker.parentNode) {
            ticker.parentNode.removeChild(ticker);
          }
        }, 2000);
      }
    };
    
    ticker.textContent = `🧱 Bricks: ${currentCount}`;
    document.body.appendChild(ticker);
    
    // Start the animation
    setTimeout(increment, 100);
  }

  function showBuyBrick(){
    const root = actionsRoot();
    clearPatch5Btns();
    const currentBricks = getBrickCount();
    const b1 = btn(`Buy Brick – ${moneyGBP(BRICK_PRICE)} (Current: ${currentBricks})`, "", function(){
      if ((S.chairman_cash|0) < BRICK_PRICE){ logSafe("Not enough money for a Brick."); return; }
      S.chairman_cash -= BRICK_PRICE;
      
      addItem({ 
        name: "Brick", 
        type: "weapon", 
        quantity: 1, 
        baseValue: BRICK_PRICE, 
        sellable: true, 
        equipped: true 
      });
      
      const newCount = getBrickCount();
      
      // Show visual ticker feedback - use current count at time of purchase
      const currentCountAtPurchase = newCount - 1;
      showBrickTicker(currentCountAtPurchase, newCount);
      
      logSafe(`You purchase a Brick. Total bricks: ${newCount}. It's now in your inventory and can be equipped.`);
      updateHUD?.();
    });
    const close = btn("Close", "", ()=>clearPatch5Btns());
    root.appendChild(b1); root.appendChild(close);
    updateHUD?.();
  }

// 1,2,3,4 then OD

  function triggerOverdose(){
    try {
      ensureDrugState();
      logSafe("❗ You\'ve pushed it too far — you overdose right before the match!");
      // Immediate consequence: rehab + skip match
      const cost = 80000;
      if ((S.chairman_cash|0) >= cost) S.chairman_cash -= cost;
      else S.club_cash = Math.max(0, (S.club_cash|0) - Math.max(0, cost - (S.chairman_cash|0)));
      S.chairman_cash = Math.max(0, S.chairman_cash|0);
      S.suspensions.rehab_games = Math.max(2, Math.min(4, 2 + Math.floor(Math.random()*3))); // 2–4 games barred
      S.on_drugs_today = false;
      S.drug_streak = 0;

      // Auto-simulate match (no influence). Try to click the Skip (Quick result) button if present.
      try{
        const skip = document.getElementById('skipMatchBtn');
        if (skip){ skip.click(); }
        else if (typeof window.quickResult === "function"){ window.quickResult(); }
        else if (typeof window.startMatch === "function"){ window.startMatch(); setTimeout(()=>document.getElementById('skipMatchBtn')?.click(), 200); }
        else {
          logSafe("The team plays without you. The result will be recorded.");
        }
      }catch(e){
        logSafe("The team plays without you. The result will be recorded.");
      }
    } catch (e) {
      // Fallback - just set basic rehab state
      S.suspensions = S.suspensions || {};
      S.suspensions.rehab_games = 3;
      S.drug_streak = 0;
      S.on_drugs_today = false;
      logSafe("❗ You\'ve pushed it too far — you overdose right before the match!");
    }
    
    // Safe HUD update
    try {
      if (typeof updateHUD === 'function') updateHUD();
    } catch (e) {
    }
  }

  // ---------- Pre‑match mount points ----------
  function isRehab(){ try{ return (S && (S.coke_cooldown|0) > 0); }catch(_){ return false; } }
  function canShowDrugActions(){
    if (!S || isInPrison()) return false;
    if (S.suspensions?.rehab_games > 0) return false;
    if (isRehab()) return false; // Also block during cocaine rehab
    return true;
  }

  function mountDrugActions(){
    if (!canShowDrugActions()) return;
    ensureDrugState();
    const root = actionsRoot();
    if (!root) return;
    // always clear our buttons then re-add (idempotent on every pre-match refresh)
    clearPatch5Btns();

    if (!S.drugs_unlocked){
      // Marco knockdoor functionality removed
    } else {
      // Buy button removed - functionality handled in top UI
    }

    if (S.drugs_unlocked){
      // Take cocaine button removed - functionality handled in top UI
    }

    if ((S.inventory.drugs|0) > 0){
      const plant = btn("Plant drugs on a player (locker room)", "bad", plantDrugsFlow);
      root.appendChild(plant);
    }
  }

  // Pre-match menus get the "plant drugs" action
  GameHooks.on('choices', function(){ if (S && S.phase === 'prematch') mountDrugActions(); });

  // Post-match: reset daily flag + rehab countdown + cocaine crash
  // (Dormant: was keyed to an "Attendance: … Gate Revenue:" log line the core no longer writes.)
  GameHooks.on('postmatch:gate-anchor', function(){
          if (S.on_drugs_today) S.on_drugs_today = false;
          if (S.suspensions?.rehab_games > 0){
            S.suspensions.rehab_games = Math.max(0, (S.suspensions.rehab_games|0) - 1);
            if (S.suspensions.rehab_games>0) logSafe(`REHAB: You're barred for ${S.suspensions.rehab_games} more match(es).`);
            updateHUD?.();
          }
          
          // Cocaine state transition: shift to "crashing" if currently buzzed/wired
          if (S.coke_state === "buzzed" || S.coke_state === "wired") {
            S.coke_state = "crashing";
            log("The cocaine high fades. You feel the crash coming on...");
          }
          
          // Apply crashing morale penalty
          if (S.coke_state === "crashing" && S._coke_crash_morale_penalty) {
            S.team_morale_boost = (S.team_morale_boost||0) - S._coke_crash_morale_penalty;
            log(`The cocaine crash hits hard. Team morale -${S._coke_crash_morale_penalty}.`);
          }
  });

  // ---------- DERANGED actions (when high) ----------
  function mountDerangedActions(){
    // Deranged actions disabled - will be replaced by another function
    return;
    if (!S || !S.on_drugs_today) return;
    const root = actionsRoot(); if (!root) return;
    // Clear previous deranged set, then add fresh
    try{ root.querySelectorAll('button[data-deranged="1"]').forEach(n=>n.remove()); }catch(_){}
    function dBtn(label, handler){
      const b = document.createElement('button'); b.textContent = "DERANGED: " + label; b.className="bad";
      b.dataset.deranged="1"; b.addEventListener('click', handler); root.appendChild(b); return b;
    }

    dBtn("Storm your team’s locker room and fling scalding coffee", function(){
      // Hurts your team badly; increases risks
      S.team_morale_boost = Math.max(-12, (S.team_morale_boost||0) - 10);
      S.reputation = Math.max(0, (S.reputation|0) - 8);
      S.police_risk = (S.police_risk|0) + 4;
      S.legal_risk  = (S.legal_risk|0) + 2;
      logSafe("Hopped up on cocaine, you barge into your own locker room and fling scalding coffee! Two players are burned and furious. Morale nosedives.");
      maybeQueueInvestigation('fa'); // FA likely to care
      maybeQueueInvestigation('police', 0.35); // small chance
      // Single-use per pre-match
      this.remove();
    });

    dBtn("Hit the rivals’ locker room with coffee and chaos", function(){
      // Helps you by hurting opponent morale; still increases risks
      S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 25);
      S.reputation = Math.max(0, (S.reputation|0) - 5);
      S.police_risk = (S.police_risk|0) + 5;
      S.legal_risk  = (S.legal_risk|0) + 3;
      logSafe("Screams from the away locker room — you’ve doused them with scalding coffee. Chaos. Their morale collapses.");
      maybeQueueInvestigation('fa', 0.6);
      maybeQueueInvestigation('police', 0.5);
      this.remove();
    });
  }

  function maybeQueueInvestigation(authority, chance){
    try{
      if (chance !== undefined && Math.random() >= chance) return;
      if (typeof window.queueInvestigationSafe === 'function'){
        window.queueInvestigationSafe(authority, 'misconduct');
      } else if (Array.isArray(S.knock_queue)) {
        S.knock_queue.push({ type:'investigation', authority, caseType:'misconduct' });
      }
    }catch(_){}
  }

  // ---------- Player Drug Scandal (pre-match event) ----------

  function presentPlayerDrugScandal(player){
    const name = player?.name || "Unnamed Player";
    logSafe(`Scandal: ${name} failed a drug test before the match.`);
    const root = actionsRoot(); clearPatch5Btns();

    const cover = btn("Cover it up & warn player", "warn", function(){
      S.compliance_risk = (S.compliance_risk|0) + 3;
      S.reputation = Math.max(0, (S.reputation|0) - 2);
      logSafe(`${name} nods mutely. You keep it quiet, for now.`);
      clearPatch5Btns();
      // future: this could resurface; for now, small FA heat chance
      maybeQueueInvestigation('fa', 0.2);
    });
    const bench = btn("Bench the player (today only)", "", function(){
      // crude: shave a little team quality via morale_boost
      S.team_morale_boost = Math.max(-10, (S.team_morale_boost||0) - 2);
      player.benched_today = true;
      logSafe(`${name} is removed from the lineup. Team mutters about discipline.`);
      clearPatch5Btns();
    });
    const blackmail = btn("Exploit: blackmail for weekly payments", "bad", function(){
      player.blackmailed = true;
      player.blackmail_wage = Math.max(1000, Math.round((player.wage||100)*4));
      logSafe(`${name} agrees to pay you ${moneyGBP(player.blackmail_wage)} per week to keep quiet.`);
      S.offbooks = (S.offbooks|0) + 1;
      clearPatch5Btns();
    });
    const expose = btn("Expose to press/authorities (fire player)", "bad", function(){
      // remove from squad
      try{
        const idx = S.squad.indexOf(player); if (idx>=0) S.squad.splice(idx,1);
      }catch(_){}
      S.reputation = Math.min(100, (S.reputation|0) + 5);
      S.fan_morale = Math.max(0, (S.fan_morale|0) - 3);
      logSafe(`${name} is publicly dismissed. The dressing room is stunned.`);
      // This could trigger FA/Police interest depending on vibes
      maybeQueueInvestigation('fa', 0.35);
      clearPatch5Btns();
    });

    root.appendChild(cover); root.appendChild(bench); root.appendChild(blackmail); root.appendChild(expose);
  }

  // Apply blackmail payments weekly (post-match anchor is fine)
  // (Dormant: was keyed to an "Attendance: … Gate Revenue:" log line the core no longer writes.)
  GameHooks.on('postmatch:gate-anchor', function siphonBlackmailCashPostMatch(){
          if (Array.isArray(S.squad)){
            let total = 0;
            S.squad.forEach(p=>{ if (p?.blackmailed && p.blackmail_wage){ total += p.blackmail_wage; } });
            if (total>0){ S.chairman_cash = (S.chairman_cash|0) + total; logSafe(`Off‑books kickbacks from players total ${moneyGBP(total)}.`); }
          }
          // Queue drug scandal for next pre-match instead of immediate trigger
          // This prevents interference with post-match investigations
          if (!S._queued_drug_scandal) {
            S._queued_drug_scandal = true;
          }
  });

  // ---------- Plant drugs on a player ----------
  function plantDrugsFlow(){
    ensureDrugState();
    if ((S.inventory.drugs|0) <= 0){ logSafe("You need at least one bag to plant."); return; }
    if (!Array.isArray(S.squad) || S.squad.length === 0){ logSafe("No players available."); return; }
    const options = S.squad.map(p=>p?.name).filter(Boolean);
    const name = prompt("Choose a player to frame:\n" + options.map((n,i)=>`${i+1}. ${n}`).join("\n"));
    if (name === null) return;
    let chosen = null;
    // try index
    const idx = Number(name)-1;
    if (Number.isInteger(idx) && idx>=0 && idx<S.squad.length) chosen = S.squad[idx];
    // fallback exact match
    if (!chosen) chosen = S.squad.find(p=>String(p?.name).toLowerCase() === String(name).toLowerCase()) || S.squad[0];

    S.inventory.drugs = Math.max(0, (S.inventory.drugs|0) - 1);
    logSafe(`You stash a bag of cocaine in ${chosen?.name||'the player'}’s locker.`);
    const root = actionsRoot(); clearPatch5Btns();
    const blackmail = btn("Use stash to blackmail (player plays for £0)", "bad", function(){
      if (chosen){ chosen.blackmailed=true; chosen.wage=0; }
      S.offbooks = (S.offbooks|0) + 2;
      logSafe(`${chosen?.name||'The player'} agrees to play for free to keep it secret.`);
      clearPatch5Btns();
    });
    const arrest = btn("Call authorities (have him removed)", "bad", function(){
      try{ const i = S.squad.indexOf(chosen); if (i>=0) S.squad.splice(i,1); }catch(_){}
      S.reputation = Math.max(0, (S.reputation|0) - 1);
      S.fan_morale = Math.max(0, (S.fan_morale|0) - 2);
      S.police_risk = (S.police_risk|0) + 1; // attention
      logSafe(`${chosen?.name||'The player'} is taken away in handcuffs.`);
      maybeQueueInvestigation('police', 0.5);
      clearPatch5Btns();
    });
    const cancel = btn("Keep it quiet (for now)", "", function(){ clearPatch5Btns(); });
    root.appendChild(blackmail); root.appendChild(arrest); root.appendChild(cancel);
  }

  // ---------- Mount drug actions on first pre-match & ensure state ----------
  setTimeout(function(){
    ensureDrugState();
    mountDrugActions();
    updateHUD?.();
  }, 800);

})();