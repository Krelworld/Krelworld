/* === Patch 5.3.1 — Drugs UI Resilience & Working Buy/Use === */
(function(){

  // ---- Safe state guards ----

  // ---- HUD pill (non‑destructive wrapper) ----
  // HUD extension (runs after updateHUD redraws)
  GameHooks.on('hud', function wrapHUD(){
      try{
        ensureDrugCore();
        const bar = document.getElementById('hudBar');
        if (!bar) return;
        let pill = document.getElementById('hudDrugPill');
        if (!pill){
          pill = document.createElement('div');
          pill.id = 'hudDrugPill';
          pill.className = 'hitem';
          pill.innerHTML = `<span class="label">Cocaine</span><span id="hudDrugCount">0 (Locked)</span>`;
          bar.insertBefore(pill, document.getElementById('toggleStatsBtn'));
        }
        const cnt = S.inventory?.drugs|0;
        const tag = (S.on_drugs_today ? 'UNDER INFLUENCE' : (S.drugs_unlocked?'Unlocked':'Locked'));
        const span = pill.querySelector('#hudDrugCount');
        if (span) span.textContent = `${cnt} (${tag})`;
      }catch(_){}
  });

  // ---- Inventory bridge removed - handled by ensureInventoryUI() ----

  // ---- Context detection & allowed phases ----
  function allowedPhase(){
    // Only show quick actions in pre‑match, evening, or home
    // Exclude name selection phase
    const allowed = ['prematch','evening','home'].includes(window.__ui_context) && 
                   !window.__ui_context.includes('name') && 
                   !window.__ui_context.includes('boot');
    return allowed;
  }

  const DRUG_PRICE = 2500;
  function requiredBags(n){ return Math.min(4, Math.max(1, (n|0)+1)); }
  function overdose(){
    return window.unifiedOverdose();
  }
  // Consolidated takeCocaine function - this is the main one that all buttons should use
  function takeCocaine(){
    ensureDrugCore();
    if (!S.drugs_unlocked) { (window.log||console.log)("You don't have a dealer contact yet."); return; }
    if (S.suspensions?.rehab_games > 0){ (window.log||console.log)("REHAB: You're barred from using drugs while in treatment."); return; }
    
    // Use the higher of the two streak values for overdose check
    const currentStreak = Math.max((S.drug_streak|0), (S.coke_streak|0));
    
    if (currentStreak >= 4){ 
      overdose(); 
      return; 
    }
    
    const need = requiredBags(currentStreak);
    if ((S.inventory.drugs|0) < need){
      (window.log||console.log)(`You need ${need} bag(s) to keep the edge (streak ${currentStreak}).`);
      return;
    }
    S.inventory.drugs -= need;
    S.on_drugs_today = true;
    
    // Update both streak variables for compatibility
    S.drug_streak = currentStreak + 1;
    S.coke_streak = currentStreak + 1;
    
    (window.log||console.log)(`You snort ${need===1?'a line':'several lines'} of cocaine. Adrenaline surges! (Streak ${S.drug_streak})`);
    if (S.drug_streak === 4) (window.log||console.log)("⚠️ Warning: another consecutive use will result in overdose!");
    S.team_morale_boost = (S.team_morale_boost||0) + 2;
    // Add chairman points for taking drugs
    if (typeof addChairmanPointsImmediate === 'function') {
      addChairmanPointsImmediate(5, 'taking drugs');
    }
    if (typeof window.updateHUD === 'function') window.updateHUD();
    
    // Trigger drugs achievement
    if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'took_drugs')) {
      const achievement = {
        id: 'took_drugs',
        title: 'Took Drugs',
        description: 'Took drugs',
        icon: '💊'
      };
      window.socialManager.showAchievement(achievement);
      window.socialManager.achievements.push(achievement);
    }
    
    // Deranged actions removed - will be replaced by another function
  }

  // ---- Quick actions (scoped to allowed phases & only after Marco) ----
  function clearDrugQuick(){ try{ actionsRoot().querySelectorAll('button[data-drugquick531="1"]').forEach(n=>n.remove()); }catch(_){} }
  function mountDrugQuick(){
    
    // Prevent infinite loops by checking if we're already mounting
    if (window.__mountingDrugQuick) {
      return;
    }
    window.__mountingDrugQuick = true;
    
    try {
      ensureDrugCore();
      const root = actionsRoot(); if (!root) return;
      clearDrugQuick();

      
      if (!allowedPhase() || !S.drugs_unlocked) {
        return;
      }
    if (S.suspensions?.prison_games>0 || S.suspensions?.rehab_games>0) {
      return;
    }

    // Buy 1 bag
    const buy = document.createElement('button');
    buy.dataset.drugquick531 = "1";
    buy.textContent = `Call Marco (Buy Drugs) — ${moneyGBP(DRUG_PRICE)} / bag`;
    buy.addEventListener('click', function(){
      ensureDrugCore();
      if ((S.chairman_cash|0) < DRUG_PRICE){ (window.log||console.log)("Marco: \"Cash up front, mate.\" (Not enough money)"); return; }
      S.chairman_cash -= DRUG_PRICE;
      const oldCount = S.inventory.drugs|0;
      S.inventory.drugs = (S.inventory.drugs|0) + 1;
      
      // If cocaine was added and stadium dealing isn't unlocked yet, unlock it
      if (oldCount === 0 && !S.stadium_dealing_unlocked) {
        S.stadium_dealing_unlocked = true;
        S.cocaine_purchase_matches_ago = 0;
        S.marco_approach_attempted = false;
      }
      
      (window.log||console.log)("You buy 1 bag.");
      if (typeof window.updateHUD === 'function') window.updateHUD();
      // If the inventory pane is open, re-render
      try{
        const inv = document.getElementById('inventoryPane');
        if (inv && inv.style.display !== 'none' && typeof window.toggleInventoryPane === 'function'){
          window.toggleInventoryPane(true);
        }
      }catch(_){}
      mountDrugQuick();
    });
    root.appendChild(buy);

    // Take cocaine
    const currentStreak = Math.max((S.drug_streak|0), (S.coke_streak|0));
    const need = currentStreak >= 4 ? Infinity : Math.min(4, currentStreak+1);
    const take = document.createElement('button');
    take.dataset.drugquick531 = "1";
    take.className = "bad";
    take.textContent = currentStreak >= 4 ? "Take Cocaine (will OVERDOSE)"
                    : `Take Cocaine (${need} bag${need>1?'s':''} needed)`;
    take.disabled = !Number.isFinite(need) || ((S.inventory.drugs|0) < need);
    take.addEventListener('click', function(){
      try {
        takeCocaine();
      } catch (e) {
      }
    });
    root.appendChild(take);
    
    } finally {
      // Always clear the mounting flag
      window.__mountingDrugQuick = false;
    }
  }

  // ---- Quick actions follow the explicit phase ----
  // On entering an allowed phase (pre-match / evening / home) they are mounted under the
  // first menu of that phase (as the old log-sniffing did on a context change); leaving
  // the phase clears them.
  let quickMountPending = false;
  GameHooks.on('phase', function(){
    quickMountPending = allowedPhase();
    if (!quickMountPending) clearDrugQuick();
  });
  GameHooks.on('choices', function(){
    if (!quickMountPending) return;
    quickMountPending = false;
    if (allowedPhase()) mountDrugQuick();
  });

  // ---- Post‑match resets (once per match day; rehab countdown is playRehabWeek's) ----
  GameHooks.on('matchday:end', function(){
    ensureDrugCore();
    if (S.on_drugs_today) S.on_drugs_today = false;
    if (typeof window.updateHUD === 'function') window.updateHUD();
    // hide quick actions until a valid phase returns
    clearDrugQuick();
  });
})();