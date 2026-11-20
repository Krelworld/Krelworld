(function(){
  if (window.__patch56_applied) return;
  window.__patch56_applied = true;

  // ---------- Core & helpers ----------
  function ensureCore(){
    window.S = window.S || {};
    if (!S.inventory || typeof S.inventory !== 'object') S.inventory = { accolades: [], drugs: 0 };
    if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
    if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
    if (typeof S.on_drugs_today !== 'boolean') S.on_drugs_today = false;
    if (typeof S.drug_streak !== 'number') S.drug_streak = 0;
    if (!S.suspensions) S.suspensions = { rehab_games:0, prison_games:0, house_games:0 };
    if (!S.record_simple) S.record_simple = {W:0,D:0,L:0};
    if (typeof S.fan_morale !== 'number') S.fan_morale = 60;
  }
  function money(n){ return "£"+Number(Math.max(0,Math.round(n||0))).toLocaleString('en-GB'); }
  function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
  function logSafe(m){ try{ (window.log||console.log)(m); }catch(_){ console.log(m); } }
  function actionsRoot(){ 
    const actions = document.getElementById('actions');
    if (actions) return actions;
    return document.getElementById('choices') || document.getElementById('choicesPanel') || document.body; 
  }

  // HUD refresh hook for inventory pill if present
  (function wrapHUD(){
    const prev = window.updateHUD || function(){};
    if (prev.__p56) return;
    window.updateHUD = function(){
      const ret = prev.apply(this, arguments);
      try{
        const span = document.getElementById('hudDrugCount');
        if (span) span.textContent = String(S?.inventory?.drugs|0);
      }catch(_){}
      return ret;
    };
    window.updateHUD.__p56 = true;
  })();

  // ---------- Context detection (pre-match/evening/home) & rehab gate ----------
  window.__ui_context = window.__ui_context || 'boot';
  function setCtx(c){ window.__ui_context = c; }
  function allowedPhase(){ 
    return ['prematch','evening','home','family'].includes(window.__ui_context) && 
           !window.__ui_context.includes('name') && 
           !window.__ui_context.includes('boot'); 
  }
  function inRehab(){ return !!(S && S.suspensions && (S.suspensions.rehab_games|0) > 0); }

  const prevLog = window.log || function(){};
  if (!prevLog.__p56ctx){
    window.log = function(){
      const msg = arguments[0];
      try{
        if (typeof msg === 'string'){
          if (/Pre[- ]?match|team talk|locker/i.test(msg)) setCtx('prematch');
          else if (/Evening|Nightclub|Bar|Pub|After hours/i.test(msg)) setCtx('evening');
          else if (/Stay home|Home life|house|family/i.test(msg)) setCtx('home');
          if (inRehab()) { setCtx('rehab'); mountRehabGate(); }
          else if (allowedPhase()) { mountDerangedButtons(); }
        }
      }catch(_){}
      return prevLog.apply(this, arguments);
    };
    window.log.__p56ctx = true;
  }

  // Also watch #actions for rerenders so our buttons persist
  (function observeActions(){
    const root = actionsRoot();
    if (!root || root.__obs56) return;
    const mo = new MutationObserver(()=>{
      if (inRehab()) { mountRehabGate(); return; }
      if (allowedPhase()) mountDerangedButtons();
    });
    mo.observe(root, {childList:true, subtree:true});
    root.__obs56 = mo;
  })();

  // ---------- 1) Marco nightclub buys → inventory (post-click sync) ----------
  function hookMarcoBuyDelegation(){
    document.addEventListener('click', function(e){
      const el = e.target.closest('button, a');
      if (!el) return;
      const txt = (el.textContent||"").toLowerCase();
      const id  = (el.id||"").toLowerCase();
      const ds  = el.dataset || {};
      const looksLikeMarco = txt.includes('marco') || id.includes('marco') || ds.dealer === 'marco';
      const looksLikeBuy   = txt.includes('buy') || txt.includes('bag') || txt.includes('drugs') || txt.includes('call marco');
      if (looksLikeMarco && looksLikeBuy){
        // Let the original handler run first; then enforce +1 to inventory
        setTimeout(function(){
          try{
            ensureCore();
            if (typeof window.addDrugsToInventory === 'function'){
              window.addDrugsToInventory(1);
            } else {
              const oldCount = S.inventory.drugs|0;
              S.inventory.drugs = (S.inventory.drugs|0) + 1;
              
              // If cocaine was added and stadium dealing isn't unlocked yet, unlock it
              if (oldCount === 0 && !S.stadium_dealing_unlocked) {
                S.stadium_dealing_unlocked = true;
                S.cocaine_purchase_matches_ago = 0;
                S.marco_approach_attempted = false;
                console.log(`DEBUG: Cocaine added (fallback) - stadium dealing unlocked, marco_approach_attempted reset to false`);
              }
            }
            logSafe("Marco slips you a small bag. (+1 cocaine)");
            if (typeof window.updateHUD === 'function') window.updateHUD();
          }catch(_){}
        }, 0);
      }
    }, true);
  }
  hookMarcoBuyDelegation();

  // ---------- 2) Deranged actions in dialogue menus when high ----------
  function clearDerangedButtons(){ try{ actionsRoot().querySelectorAll('button[data-deranged56="1"]').forEach(n=>n.remove()); }catch(_){ } }
  const DERANGED_POOL = [
    {label:"throw scalding hot coffee", effect:function(){
      S.team_morale_boost = (S.team_morale_boost||0) - 8;
      S.reputation = Math.max(0,(S.reputation|0)-6);
      S.police_risk = (S.police_risk|0) + 4; S.fa_risk = (S.fa_risk|0) + 2;
      logSafe("DERANGED: You fling scalding coffee. Chaos. Morale craters.");
    }},
    {label:"make strange animal grunting noises", effect:function(){
      S.reputation = Math.max(0,(S.reputation|0)-2);
      const wobble = (Math.random()<0.5) ? -3 : +2;
      S.team_morale_boost = clamp((S.team_morale_boost||0) + wobble, -12, 12);
      logSafe("DERANGED: You grunt like a wild boar. Everyone is unsettled.");
    }},
    {label:"hurl abuse at a random player", effect:function(){
      S.team_morale_boost = Math.max(-12,(S.team_morale_boost||0)-5);
      logSafe("DERANGED: You lay into a player until he’s glassy-eyed.");
    }},
    {label:"smash a club trophy in front of them", effect:function(){
      S.reputation = Math.max(0,(S.reputation|0)-7);
      if (S.inventory?.accolades?.length){ const lost = S.inventory.accolades.pop(); logSafe(`DERANGED: You smash "${lost.name||'a trophy'}". Shards everywhere.`); }
      else logSafe("DERANGED: You smash a framed photo. Glass rains down.");
    }},
    {label:"threaten to sack the manager mid-sentence", effect:function(){
      S.reputation = Math.max(0,(S.reputation|0)-4);
      S.compliance_risk = (S.compliance_risk|0) + 1;
      logSafe("DERANGED: You shout \"PACK YOUR BAGS\" at the manager, then forget why.");
    }}
  ];
  function mountDerangedButtons(){
    // Deranged actions disabled - will be replaced by another function
    return;
    ensureCore(); if (!allowedPhase()) return;
    clearDerangedButtons();
    if (!S.on_drugs_today) return; // only show when high
    const root = actionsRoot(); if (!root) return;
    const pool = DERANGED_POOL.slice();
    const count = Math.min(2, pool.length);
    for (let i=0; i<count; i++){
      const idx = Math.floor(Math.random()*pool.length);
      const a = pool.splice(idx,1)[0];
      const btn = document.createElement('button');
      btn.dataset.deranged56 = "1";
      btn.className = "btn-bad";
      btn.textContent = "DERANGED: " + a.label;
      btn.addEventListener('click', function(){ try{ a.effect(); }catch(_){ } btn.remove(); });
      root.appendChild(btn);
    }
    const more = document.createElement('button');
    more.dataset.deranged56 = "1";
    more.className = "btn-warn";
    more.textContent = "More deranged ideas…";
    more.addEventListener('click', mountDerangedButtons);
    root.appendChild(more);
  }

  // ---------- 3) Rehab: real “stay a week” that simulates & logs a match ----------
  // Globally block other actions while in rehab (except our rehab button)
  document.addEventListener('click', function(e){
    if (!inRehab()) return;
    const el = e.target.closest('button,a');
    if (!el) return;
    if (el.dataset && el.dataset.rehab56 === "1") return; // allow rehab button
    e.stopPropagation(); e.preventDefault();
    logSafe("You’re in rehab. Your staff handle day‑to‑day matters.");
  }, true);

  function mountRehabGate(){
    ensureCore();
    const root = actionsRoot(); if (!root) return;
    // remove earlier duplicates
    root.querySelectorAll('button[data-rehab56="1"]').forEach(n=>n.remove());
    const btn = document.createElement('button');
    btn.dataset.rehab56 = "1";
    btn.className = "btn-warn";
    btn.textContent = `Stay in rehab for one week (${S.suspensions.rehab_games|0} match(es) left)`;
    btn.addEventListener('click', rehabAdvanceOneWeek);
    root.appendChild(btn);
  }

  function computeAttendanceSafe(){
    try{ return (typeof window.computeAttendance==='function') ? window.computeAttendance(S.fan_morale) : Math.round(32000*(0.5 + (S.fan_morale||0)/200)); }catch(_){ return 22000; }
  }
  function ticketPriceSafe(){
    try{ return (typeof window.TICKET_PRICE!=='undefined') ? window.TICKET_PRICE : 40; }catch(_){ return 40; }
  }
  function currentOpponentName(){
    try{ if (typeof window.currentOpponent === 'function') return window.currentOpponent().team; }catch(_){}
    const ops = (S.opponents||[]); return ops[Math.min(S.matches_played|0, Math.max(0, ops.length-1))] || "Opponent";
  }
  function isHomeSafe(){
    try{ if (typeof window.isHomeToday === 'function') return window.isHomeToday(); }catch(_){}
    return (S.matches_played % 2 === 0);
  }
  function recordTableSafe(home, away, gh, ga){
    try{
      if (typeof window.recordTableResult === 'function') return window.recordTableResult(home, away, gh, ga);
      if (typeof window.applyResultToTable === 'function') return window.applyResultToTable(home, away, gh, ga);
    }catch(_){}
  }
  function updateHudSafe(){ try{ if (typeof window.updateHUD === 'function') window.updateHUD(); }catch(_){} }

  function rehabAdvanceOneWeek(){
    ensureCore();
    const SOUTH = S.club_name || "Southampton FC";
    const opp = currentOpponentName();
    const home = isHomeSafe();

    // Bias against Saints during rehab
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

    // Finance
    const attendance = computeAttendanceSafe();
    const gate = attendance * ticketPriceSafe();
    S.club_cash = Math.max(0, (S.club_cash|0) + gate);

    // Wages (weekly)
    let wages = 0;
    try{ for (const p of (S.squad||[])) wages += (p.wage||0); }catch(_){}
    S.club_cash = Math.max(0, (S.club_cash|0) - wages);

    // Apply result to table if available
    recordTableSafe(H, A, gh, gaH);

    // Simple record & progress
    if (gf>ga) S.record_simple.W++; else if (gf<ga) S.record_simple.L++; else S.record_simple.D++;
    S.matches_played = (S.matches_played|0) + 1;

    try{ if (typeof window.applyFanMoraleDeltaByResult === 'function') window.applyFanMoraleDeltaByResult(gf, ga); }catch(_){}

    // Logs
    logSafe(`While you stay in rehab, the team plays without you: ${SOUTH} ${gf}–${ga} ${opp}.`);
    logSafe(`Attendance: ${attendance.toLocaleString('en-GB')}`);
    logSafe(`Gate Revenue: ${money(gate)}`);
    if (wages>0) logSafe(`Wages paid: ${money(wages)}`);

    // Tick down rehab
    S.suspensions.rehab_games = Math.max(0, (S.suspensions.rehab_games|0) - 1);
    if (S.suspensions.rehab_games > 0){
      logSafe(`REHAB: ${S.suspensions.rehab_games} match(es) remaining.`);
      mountRehabGate();
    } else {
      logSafe("You’re discharged from rehab. You can return to duties next match.");
    }
    updateHudSafe();
  }

  // Boot: if you load while already in a phase/rehab
  setTimeout(function(){
    ensureCore();
    if (inRehab()) mountRehabGate();
    else if (allowedPhase()) mountDerangedButtons();
  }, 300);
})();