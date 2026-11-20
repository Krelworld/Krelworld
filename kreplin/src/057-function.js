/* === Patch 5.3.1 — Drugs UI Resilience & Working Buy/Use === */
(function(){
  if (window.__patch531_applied) return;
  window.__patch531_applied = true;

  // ---- Safe state guards ----
  function ensureCore(){
    window.S = window.S || {};
    if (!S.inventory || typeof S.inventory !== 'object') S.inventory = { accolades: [], drugs: 0 };
    if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
    if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
    if (typeof S.drugs_unlocked !== 'boolean') S.drugs_unlocked = true; // fallback unlock to avoid dead UI
    if (typeof S.drug_streak !== 'number') S.drug_streak = 0;
    if (typeof S.on_drugs_today !== 'boolean') S.on_drugs_today = false;
    if (!S.suspensions) S.suspensions = { rehab_games:0, prison_games:0, house_games:0 };
  }
  function money(n){ return "£"+Number(Math.max(0,Math.round(n||0))).toLocaleString('en-GB'); }

  // ---- HUD pill (non‑destructive wrapper) ----
  (function wrapHUD(){
    const prev = window.updateHUD || function(){};
    if (prev.__drugPill531) return;
    window.updateHUD = function(){
      const ret = prev.apply(this, arguments);
      try{
        ensureCore();
        const bar = document.getElementById('hudBar');
        if (!bar) return ret;
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
      return ret;
    };
    window.updateHUD.__drugPill531 = true;
  })();

  // ---- Inventory bridge removed - handled by ensureInventoryUI() ----

  // ---- Context detection & allowed phases ----
  window.__ui_context = window.__ui_context || 'boot';
  function setCtx(c){ window.__ui_context = c; }
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
    ensureCore();
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
  function actionsRoot(){ return document.getElementById('actions') || document.getElementById('choices') || document.body; }
  function clearDrugQuick(){ try{ actionsRoot().querySelectorAll('button[data-drugquick531="1"]').forEach(n=>n.remove()); }catch(_){} }
  function mountDrugQuick(){
    
    // Prevent infinite loops by checking if we're already mounting
    if (window.__mountingDrugQuick) {
      return;
    }
    window.__mountingDrugQuick = true;
    
    try {
      ensureCore();
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
    buy.textContent = `Call Marco (Buy Drugs) — ${money(DRUG_PRICE)} / bag`;
    buy.addEventListener('click', function(){
      ensureCore();
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

  // ---- Context via log messages ----
  const prevLog = window.log || function(){};
  if (!prevLog.__ctx531){
    let lastContextUpdate = 0;
    const CONTEXT_DEBOUNCE_MS = 100; // Prevent rapid context changes
    
    window.log = function(){
      const msg = arguments[0];
      try{
        if (typeof msg === 'string'){
          const now = Date.now();
          let contextChanged = false;
          
          if (/Pre[- ]?match|Kickoff|Opponent|team talk|locker/i.test(msg)) {
            if (window.__ui_context !== 'prematch') {
              setCtx('prematch');
              contextChanged = true;
            }
          }
          else if (/Evening|Nightclub|Bar|Pub|After hours/i.test(msg)) {
            if (window.__ui_context !== 'evening') {
              setCtx('evening');
              contextChanged = true;
            }
          }
          else if (/Stay home|Home life|house|from your house/i.test(msg)) {
            if (window.__ui_context !== 'home') {
              setCtx('home');
              contextChanged = true;
            }
          }
          
          // Only mount/clear quick actions on actual context change and with debouncing
          if (contextChanged && (now - lastContextUpdate) > CONTEXT_DEBOUNCE_MS) {
            lastContextUpdate = now;
            if (allowedPhase()) mountDrugQuick(); else clearDrugQuick();
          }
        }
      }catch(_){}
      return prevLog.apply(this, arguments);
    };
    window.log.__ctx531 = true;
  }

  // ---- Post‑match resets ----
  const prevLog2 = window.log || function(){};
  if (!prevLog2.__post531){
    const base = window.log;
    window.log = function(){
      const msg = arguments[0];
      const ret = base.apply(this, arguments);
      try{
        if (typeof msg === "string" && msg.indexOf("Attendance:") === 0 && msg.indexOf("Gate Revenue:") !== -1){
          ensureCore();
          if (S.on_drugs_today) S.on_drugs_today = false;
          if (S.suspensions?.rehab_games > 0){
            S.suspensions.rehab_games = Math.max(0, (S.suspensions.rehab_games|0) - 1);
            (window.log||console.log)(`REHAB: ${S.suspensions.rehab_games} match(es) remaining.`);
          }
          if (typeof window.updateHUD === 'function') window.updateHUD();
          // hide quick actions until a valid phase returns
          clearDrugQuick();
          window.__ui_context = 'postmatch';
        }
      }catch(_){}
      return ret;
    };
    window.log.__post531 = true;
  }

  // First mount attempt (won't show until a valid context comes through log())
  setTimeout(function(){ try{ mountDrugQuick(); if (typeof window.updateHUD === 'function') window.updateHUD(); }catch(_){} }, 600);
  
  // Test button removed - was causing issues in initial pick name function
  
  // Add a global function to manually create cocaine buttons
  window.createCocaineButton = function() {
    try {
      const root = document.getElementById('actions') || document.getElementById('choices') || document.body;
      if (root) {
        // Remove any existing test buttons first
        const existing = root.querySelectorAll('button[data-test-cocaine="1"]');
        existing.forEach(btn => btn.remove());
        
        const btn = document.createElement('button');
        btn.textContent = 'MANUAL: Take Cocaine';
        btn.className = 'bad';
        btn.style.margin = '5px';
        btn.dataset.testCocaine = '1';
        btn.addEventListener('click', function(){
          try {
            takeCocaine();
          } catch (e) {
          }
        });
        root.appendChild(btn);
        return true;
      } else {
        return false;
      }
    } catch(e) {
      return false;
    }
  };
  
  // Add a function to force open inventory and check for buttons
  window.checkInventoryButtons = function() {
    try {
      // Force open inventory
      if (typeof window.toggleInventoryPane === 'function') {
        window.toggleInventoryPane(true);
      }
      
      // Check for cocaine buttons in inventory
      const inventoryPane = document.getElementById('inventoryPane');
      if (inventoryPane) {
        const cocaineButtons = inventoryPane.querySelectorAll('button');
        cocaineButtons.forEach((btn, i) => {
        });
      } else {
      }
      
      // Check for buttons in main area
      const mainButtons = document.querySelectorAll('button[data-drugquick531="1"]');
      mainButtons.forEach((btn, i) => {
      });
      
    } catch(e) {
    }
  };
})();