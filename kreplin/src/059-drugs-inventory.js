/* === Patch 5.3.2 — Inventory & Drugs Workaround (robust) === */
(function(){

  // Ultra-simple overdose function - just the basics
  window.unifiedOverdose = function(){
    
    // Show the message and reset streaks
    logSafe("❗ You've pushed it too far — you overdose right before the match!");
    S.drug_streak = 0;
    S.coke_streak = 0;
    
    // Take some money as punishment
    const cost = 80000;
    if (S.chairman_cash >= cost) {
      S.chairman_cash -= cost;
      logSafe(`You lose ${money(cost)} in medical bills.`);
    } else {
      const remaining = cost - S.chairman_cash;
      S.chairman_cash = 0;
      if (S.club_cash) {
        S.club_cash = Math.max(0, S.club_cash - remaining);
      }
      logSafe(`You lose all your personal money and ${money(remaining)} from club funds in medical bills.`);
    }
    
    // Rehab: one scheme only (S.suspensions.rehab_games); the main loop plays these weeks without you
    if (!S.suspensions) S.suspensions = {};
    S.suspensions.rehab_games = Math.max(S.suspensions.rehab_games|0, 3);
    logSafe("You're sent to rehab for 3 games. The team plays without you.");
    
  };

  // Make takeCocaine globally accessible
  window.takeCocaine = function(){
    try {
      ensureDrugCore();
      // Force unlock drugs to ensure functionality
      S.drugs_unlocked = true;
      if (!S.drugs_unlocked) { (window.log||console.log)("You don't have a dealer contact yet."); return; }
      if (S.suspensions?.rehab_games > 0){ (window.log||console.log)("REHAB: You're barred from using drugs while in treatment."); return; }
    
    // Use the higher of the two streak values for overdose check
    const currentStreak = Math.max((S.drug_streak|0), (S.coke_streak|0));
    
    if (currentStreak >= 4){ 
      try {
        overdoseNow(); 
      } catch (e) {
      }
      return; 
    }
    
    const need = requiredBagsForStreak(currentStreak);
    if ((S.inventory.drugs|0) < need){
      (window.log||console.log)(`You need ${need} bag(s) to keep the edge (streak ${currentStreak}).`);
      return;
    }
    S.inventory.drugs -= need;
    S.on_drugs_today = true;
    
    // Update both streak variables for compatibility
    S.drug_streak = currentStreak + 1;
    S.coke_streak = currentStreak + 1;
    // tolerance/addiction + the real buzzed/wired state (087p-sys-drugs)
    if (window.KSys && KSys.onCokeUsed) KSys.onCokeUsed(need);
    
    (window.log||console.log)(`You snort ${need===1?'a line':'several lines'} of cocaine. Adrenaline surges! (Streak ${S.drug_streak})`);
    if (S.drug_streak === 4) (window.log||console.log)("⚠️ Warning: another consecutive use will result in overdose!");
    S.team_morale_boost = (S.team_morale_boost||0) + 2;
    // Deranged actions removed - will be replaced by another function
    } catch (e) {
    }
  };

  // ---------- Safe state & logging ----------

  // ---------- HUD pill ----------
  function ensureDrugHUD(){
    const bar = document.getElementById('hudBar');
    if (!bar) return;
    let pill = document.getElementById('hudDrugPill');
    if (!pill){
      pill = document.createElement('div');
      pill.id = 'hudDrugPill';
      pill.className = 'hitem';
      pill.innerHTML = `<span class="label">Cocaine</span><span id="hudDrugCount">0</span>`;
      const anchor = document.getElementById('toggleStatsBtn') || bar.lastElementChild;
      bar.insertBefore(pill, anchor);
    }
    updateDrugHUD();
  }
  function updateDrugHUD(){
    ensureDrugCore();
    const span = document.getElementById('hudDrugCount');
    if (span) span.textContent = String(S.inventory?.drugs|0);
  }

  // ---------- Inventory Pane (duplicate removed - handled by main inventory system) ----------

  // ---------- Inventory button wiring removed - handled by ensureInventoryUI() ----------

  // ---------- Buy / Use logic (works even if older code failed) ----------
  const PRICE_PER_BAG = 2500;
  function requiredBagsForStreak(n){ return Math.min(4, Math.max(1, (n|0)+1)); }
  function overdoseNow(){
    return window.unifiedOverdose();
  }
  function buyBag(){
    ensureDrugCore();
    if ((S.chairman_cash|0) < PRICE_PER_BAG){ logSafe(`Marco: "Cash up front." (Need ${moneyGBP(PRICE_PER_BAG)})`); return; }
    S.chairman_cash -= PRICE_PER_BAG;
    const oldCount = S.inventory.drugs|0;
    S.inventory.drugs = (S.inventory.drugs|0) + 1;
    
    // If cocaine was added and stadium dealing isn't unlocked yet, unlock it
    if (oldCount === 0 && !S.stadium_dealing_unlocked) {
      S.stadium_dealing_unlocked = true;
      S.cocaine_purchase_matches_ago = 0;
      S.marco_approach_attempted = false;
    }
    
    logSafe("You buy 1 bag.");
    updateHUD?.(); updateDrugHUD(); renderInventory();
  }
  // Third takeCocaine function removed - using consolidated version above

  // ---------- Helper: Get Brick Count ----------
  function getBrickCount() {
    ensureDrugCore();
    const bricks = (S.inventory.items || []).filter(item => item.name === 'Brick');
    if (bricks.length === 0) return 0;
    return bricks.reduce((total, brick) => total + (brick.quantity || 0), 0);
  }

  // ---------- Enhanced Render Inventory (with buy/use controls) ----------
  function renderInventory(){
    ensureDrugCore(); ensureInventoryPane(); ensureDrugHUD();
    const sum  = document.getElementById('invSummary');
    const list = document.getElementById('inventoryList');
    if (!list) return;

    const acc  = S.inventory.accolades;
    const drug = S.inventory.drugs|0;
    const items = S.inventory.items || [];

    if (sum){
      const totalItems = acc.length + items.length;
      sum.innerHTML = `
        <div class="stat-row">
          <span class="badge"><span class="dot"></span><strong>${totalItems}</strong>&nbsp;item(s)</span>
          <span class="badge"><span class="dot"></span><strong>${drug}</strong>&nbsp;bag(s) cocaine</span>
        </div>
      `;
    }

    list.innerHTML = '';

    // New inventory items
    if (Array.isArray(items) && items.length){
      const head = document.createElement('div');
      head.className = 'subtle kp-sec'; head.textContent = 'Inventory Items';
      list.appendChild(head);

      items.forEach((item, idx)=>{
        const row = document.createElement('div'); row.className='row kp-item';
        const k = document.createElement('div'); k.className='k'; 
        k.textContent = item.name + (item.equipped ? ' (EQUIPPED)' : '');
        const v = document.createElement('div'); v.className='v'; 
        v.textContent = `${item.quantity}x ${moneyGBP(item.baseValue||0)}`;
        const act = document.createElement('div'); act.className = 'kp-item-act';
        
        // Sell button
        if (item.sellable) {
          const sellBtn = document.createElement('button'); 
          sellBtn.textContent = 'Sell'; 
          sellBtn.addEventListener('click', ()=>{
            sellItem(item.name, 1);
          });
          act.appendChild(sellBtn);
        }
        
        // Equip/Unequip button for weapons (except bricks which auto-equip)
        if (item.type === 'weapon' && item.name !== 'Brick') {
          const equipBtn = document.createElement('button');
          equipBtn.textContent = item.equipped ? 'Unequip' : 'Equip';
          equipBtn.addEventListener('click', ()=>{
            if (item.equipped) {
              unequipItem(item.name);
            } else {
              equipItem(item.name);
            }
          });
          act.appendChild(equipBtn);
        }
        
        row.appendChild(k); row.appendChild(v); row.appendChild(act);
        list.appendChild(row);
      });
    }

    // Legacy valuables (accolades)
    if (Array.isArray(acc) && acc.length){
      const head = document.createElement('div');
      head.className = 'subtle kp-sec'; head.textContent = 'Legacy Valuables';
      list.appendChild(head);

      acc.forEach((a, idx)=>{
        const row = document.createElement('div'); row.className='row kp-item';
        const k = document.createElement('div'); k.className='k'; k.textContent = a?.name || 'Unlabelled trophy';
        const v = document.createElement('div'); v.className='v'; v.textContent = moneyGBP(a?.value||0);
        const act = document.createElement('div'); act.className = 'kp-item-act'; const btn = document.createElement('button'); btn.textContent = 'Sell';
        btn.addEventListener('click', async ()=>{
          await sellAccolade(idx);
        });
        act.appendChild(btn);
        row.appendChild(k); row.appendChild(v); row.appendChild(act);
        list.appendChild(row);
      });
    }

    // drugs controls
    const dHead = document.createElement('div'); dHead.className='subtle kp-sec'; dHead.textContent = 'Other';
    list.appendChild(dHead);

    // Cocaine row
    const row = document.createElement('div'); row.className='row kp-item';
    const k = document.createElement('div'); k.className='k'; k.textContent='Cocaine';
    const v = document.createElement('div'); v.className='v'; v.textContent=`${drug} bag(s)`;
    const act = document.createElement('div'); act.className = 'kp-item-act';
    const buy = document.createElement('button'); buy.textContent = `Buy 1 bag (${moneyGBP(PRICE_PER_BAG)})`;
    buy.addEventListener('click', buyBag);
    const use = document.createElement('button'); use.textContent='Take (use)'; use.disabled = drug<=0; 
    use.addEventListener('click', function(){
      try {
        window.takeCocaine();
      } catch (e) {
      }
    });
    act.appendChild(buy); act.appendChild(use);
    row.appendChild(k); row.appendChild(v); row.appendChild(act);
    list.appendChild(row);

    // Brick purchase row
    const brickRow = document.createElement('div'); brickRow.className='row kp-item';
    const brickK = document.createElement('div'); brickK.className='k'; brickK.textContent='Brick';
    const brickV = document.createElement('div'); brickV.className='v'; brickV.textContent='Weapon';
    const brickAct = document.createElement('div'); brickAct.className = 'kp-item-act';
    const buyBrick = document.createElement('button'); 
    const currentBricks = getBrickCount();
    buyBrick.textContent = `Buy Brick (${moneyGBP(100000)}) - Current: ${currentBricks}`; 
    buyBrick.addEventListener('click', function(){
      const brickPrice = 100000;
      if ((S.chairman_cash|0) < brickPrice){ 
        logSafe("Not enough money for a Brick."); 
        return; 
      }
      S.chairman_cash -= brickPrice;
      addItem({ 
        name: "Brick", 
        type: "weapon", 
        quantity: 1, 
        baseValue: brickPrice, 
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
    brickAct.appendChild(buyBrick);
    brickRow.appendChild(brickK); brickRow.appendChild(brickV); brickRow.appendChild(brickAct);
    list.appendChild(brickRow);
    
  }

  // Expose renderInventory to global scope
  window.renderInventory = renderInventory;

  // ---------- Boot wiring ----------
  function bootWire(){
    ensureDrugCore();
    if (typeof window.ensureInventoryPane === 'function') {
      window.ensureInventoryPane();
    } else {
      console.error('ensureInventoryPane not available in bootWire');
    }
    // Inventory button wiring removed - handled by ensureInventoryUI()
    ensureDrugHUD();
  }

  // Expose bootWire to global scope so inventory IIFE can call it
  window.bootWire = bootWire;

  // Safety: also refresh HUD when the outer game HUD refreshes
  // HUD extension (runs after updateHUD redraws)
  GameHooks.on('hud', function wrapHUD(){
      try{ updateDrugHUD(); }catch(_){}
  });

})();