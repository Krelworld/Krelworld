// === Patch 5.7.1: Wire Marco→Inventory, Deranged in dialogue, and real Rehab skip ===
(function(){
  try{

    ensureDrugCore();


    // ----- Marco nightclub buys → Inventory (post-click sync) -----
    document.addEventListener('click', function(e){
      const el = e.target.closest('button, a'); if (!el) return;
      const t = (el.textContent||"").toLowerCase();
      const id = (el.id||"").toLowerCase();
      const ds = el.dataset || {};
      const looksLikeMarco = t.includes('marco') || id.includes('marco') || ds.dealer === 'marco';
      const looksLikeBuy   = t.includes('buy') || t.includes('bag') || t.includes('drugs') || t.includes('call marco');
      if (looksLikeMarco && looksLikeBuy){
        setTimeout(()=>{ try{
          ensureDrugCore();
          window.addDrugsToInventory ? window.addDrugsToInventory(1) : (S.inventory.drugs = (S.inventory.drugs|0)+1);
          logSafe("Marco slips you a small bag. (+1 cocaine)");
          if (typeof window.updateHUD === 'function') window.updateHUD();
        }catch(_){ }}, 0);
      }
    }, true);

    // ----- Expose addDrugsToInventory for other flows -----
    window.addDrugsToInventory = window.addDrugsToInventory || function(qty){
      ensureDrugCore();
      const oldCount = S.inventory.drugs|0;
      S.inventory.drugs = Math.max(0, (S.inventory.drugs|0) + Math.max(0, qty|0));
      
      // If cocaine was added and stadium dealing isn't unlocked yet, unlock it
      if (qty > 0 && oldCount === 0 && !S.stadium_dealing_unlocked) {
        S.stadium_dealing_unlocked = true;
        S.cocaine_purchase_matches_ago = 0; // Track when cocaine was first purchased
        S.marco_approach_attempted = false;
      }
      
      try{ document.getElementById('hudDrugCount').textContent = String(S.inventory.drugs|0); }catch(_){}
    };


    // While in rehab every menu gets the "stay in rehab" button
    GameHooks.on('choices', function(){ if (isInRehab()) mountRehabGate(); });

  // ----- Rehab: gate + auto-match sim and finances -----
    document.addEventListener('click', function(e){
      if (!isInRehab()) return;
      const el = e.target.closest('button,a'); if (!el) return;
      if (el.dataset && el.dataset.rehab571 === "1") return; // allow our rehab button
      
      // Do NOT block core post-match / evening navigation – only gate match‑day chaos
      const ctx = window.__ui_context || 'unknown';
      if (ctx === 'evening' || ctx === 'postmatch' || ctx === 'home' || ctx === 'family') {
        return;
      }
      
      e.stopPropagation(); e.preventDefault();
      logSafe("You’re in rehab. Your staff handle day‑to‑day matters.");
    }, true);

    function computeAttendanceSafe(){
      try{ return (typeof window.computeAttendance==='function') ? window.computeAttendance(S.fan_morale) : Math.round(32000*(0.5 + (S.fan_morale||0)/200)); }catch(_){ return 22000; }
    }
    function ticketPriceSafe(){ try{ return (typeof window.TICKET_PRICE!=='undefined') ? window.TICKET_PRICE : 40; }catch(_){ return 40; } }
    function currentOpponentName(){
      try{ if (typeof window.currentOpponent === 'function') return window.currentOpponent().team; }catch(_){}
      const ops = (S.opponents||[]); return ops[Math.min(S.matches_played|0, Math.max(0, ops.length-1))] || "Opponent";
    }
    function isHomeSafe(){ try{ if (typeof window.isHomeToday === 'function') return window.isHomeToday(); }catch(_){ } return (S.matches_played % 2 === 0); }
    function recordTableSafe(home, away, gh, ga){
      try{
        if (typeof window.recordTableResult === 'function') return window.recordTableResult(home, away, gh, ga);
        if (typeof window.applyResultToTable === 'function') return window.applyResultToTable(home, away, gh, ga);
      }catch(_){}
    }
    function updateHudSafe(){ try{ if (typeof window.updateHUD === 'function') window.updateHUD(); }catch(_){} }

    function rehabAdvanceOneWeek(){
      ensureDrugCore();
      const SOUTH = S.club_name || "Southampton FC";
      const opp = currentOpponentName();
      const home = isHomeSafe();
      const TEAM_QUALITY = window.TEAM_QUALITY || {};
      const myBase = TEAM_QUALITY[SOUTH] ?? 40;
      const oppBase= TEAM_QUALITY[opp]   ?? 70;
      const myQ  = Math.max(20, myBase - 10);
      const opQ  = Math.min(98, oppBase + 12);
      function goalsFromQ(q){ return Math.max(0, Math.round((q/30) + Math.random()*2 - 0.5)); }
      let gf = goalsFromQ(myQ), ga = goalsFromQ(opQ);
      if (gf === ga){ if (Math.random()<0.6) ga++; else gf++; }
      const H = home ? SOUTH : opp;
      const A = home ? opp   : SOUTH;
      const gh = home ? gf : ga;
      const gaH= home ? ga : gf;
      const attendance = computeAttendanceSafe();
      const gate = attendance * ticketPriceSafe();
      S.club_cash = Math.max(0, (S.club_cash|0) + gate);
      let wages = 0; try{ for (const p of (S.squad||[])) wages += (p.wage||0); }catch(_){}
      S.club_cash = Math.max(0, (S.club_cash|0) - wages);
      recordTableSafe(H, A, gh, gaH);
      if (gf>ga) S.record_simple.W++; else if (gf<ga) S.record_simple.L++; else S.record_simple.D++;
      S.matches_played = (S.matches_played|0) + 1;
      try{ if (typeof window.applyFanMoraleDeltaByResult === 'function') window.applyFanMoraleDeltaByResult(gf, ga); }catch(_){}
      logSafe(`While you stay in rehab, the team plays without you: ${SOUTH} ${gf}–${ga} ${opp}.`);
      logSafe(`Attendance: ${attendance.toLocaleString('en-GB')}`);
      logSafe(`Gate Revenue: ${moneyGBP(gate)}`);
      if (wages>0) logSafe(`Wages paid: ${moneyGBP(wages)}`);
      S.suspensions.rehab_games = Math.max(0, (S.suspensions.rehab_games|0) - 1);
      if (S.suspensions.rehab_games > 0){
        logSafe(`REHAB: ${S.suspensions.rehab_games} match(es) remaining.`);
        mountRehabGate();
      } else {
        logSafe("You’re discharged from rehab. You can return to duties next match.");
      }
      updateHudSafe();
    }

    function mountRehabGate(){
      if (!isInRehab()) return;
      const root = actionsRoot(); if (!root) return;
      root.querySelectorAll('button[data-rehab571="1"]').forEach(n=>n.remove());
      const b = document.createElement('button');
      b.dataset.rehab571 = "1"; b.className = "btn-warn";
      b.textContent = `Stay in rehab for one week (${S.suspensions.rehab_games|0} match(es) left)`;
      b.addEventListener('click', rehabAdvanceOneWeek);
      root.appendChild(b);
    }

    // Kick things off if we load mid-phase
    setTimeout(function(){
      ensureDrugCore();
      if (isInRehab()) mountRehabGate();
    }, 400);

  }catch(e){ console.error("Patch 5.7.1 error", e); }
})();