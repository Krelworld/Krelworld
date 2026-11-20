/* === Patch 5.3 — Deranged Everywhere & Give Cocaine === */
(function(){

  // ---- Core drug + addiction state ----


  // ---- Context tracking so we only render in valid phases ----
  // Allowed phases for deranged/give‑coke: prematch, evening, home (family).
  window.__current_actor = window.__current_actor || null; // e.g. 'police','board','fa','wife','child','player:Name'



  // ---- Button mount helpers ----
  function clearDerangedButtons(){
    const root = actionsRoot(); if (!root) return;
    root.querySelectorAll('button[data-deranged="1"],button[data-givecoke="1"]').forEach(n=>n.remove());
  }

  const DERANGED_POOL = [
    {label:"throw scalding hot coffee",      effect:function(){
      S.team_morale_boost = Math.max(-15, (S.team_morale_boost||0) - 8);
      S.reputation = Math.max(0, (S.reputation|0) - 6);
      S.police_risk = (S.police_risk|0) + 4; S.fa_risk = (S.fa_risk|0) + 2;
      logSafe("DERANGED: You fling scalding coffee. Screams, chaos, towels flying. Morale implodes.");
      queueHeat('fa', 0.5); queueHeat('police', 0.35);
    }},
    {label:"make strange animal grunting noises", effect:function(){
      S.reputation = Math.max(0, (S.reputation|0) - 2);
      const wobble = (Math.random()<0.5) ? -3 : +2;
      S.team_morale_boost = clamp((S.team_morale_boost||0) + wobble, -12, 12);
      logSafe("DERANGED: You squat in the doorway and grunt like a boar. Everyone is deeply unsettled.");
      queueHeat('fa', 0.25);
    }},
    {label:"hurl abuse at a random player", effect:function(){
      S.team_morale_boost = Math.max(-12, (S.team_morale_boost||0) - 5);
      logSafe("DERANGED: You unleash a torrent of abuse at one of your players. He looks close to tears.");
      queueHeat('fa', 0.2);
    }},
    {label:"smash a club trophy in front of them", effect:function(){
      S.reputation = Math.max(0, (S.reputation|0) - 7);
      if (S.inventory && Array.isArray(S.inventory.accolades) && S.inventory.accolades.length){
        const lost = S.inventory.accolades.pop();
        logSafe(`DERANGED: You smash "${lost.name}" to bits. Shards everywhere.`);
      } else {
        logSafe("DERANGED: You grab a decorative plate and smash it to dust.");
      }
      queueHeat('board', 0.5);
    }},
    {label:"threaten to sack the manager mid-sentence", effect:function(){
      S.reputation = Math.max(0, (S.reputation|0) - 4);
      S.compliance_risk = (S.compliance_risk|0) + 1;
      logSafe("DERANGED: You point at the manager and bellow \"PACK YOUR BAGS\" then forget why.");
      queueHeat('board', 0.35);
    }}
  ];

  function queueHeat(authority, chance){
    try{
      if (chance !== undefined && Math.random() >= chance) return;
      if (typeof window.queueInvestigationSafe === 'function'){ window.queueInvestigationSafe(authority, 'misconduct'); }
      else {
        if (!Array.isArray(S.knock_queue)) S.knock_queue = [];
        S.knock_queue.push({ type:'investigation', authority, caseType:'misconduct' });
      }
    }catch(_){}
  }


  // ---- Give cocaine flow ----
  function giveCocaineToCurrent(){
    // DISABLED: Now handled by contextual impulse system
    // The new impulse system provides contextual "Give cocaine to [specific target]" options
    // instead of generic popup-based giving
    log("Cocaine giving is now handled through contextual impulse actions when high.");
    return;
  }



  function reactToGift(target, level){
    const low = level <= 1, mid = level===2, hi = level>=3;
    if (hi){
      logSafe(`They take it with shaking hands. ${titleTarget(target)} is now clearly ADDICTED.`);
      // side effects by group
      if (/player/i.test(target)){
        S.team_morale_boost = Math.max(-12, (S.team_morale_boost||0) - 3);
      } else if (/wife|family/i.test(target)){
        S.reputation = Math.max(0, (S.reputation|0) - 3);
      } else if (/board|fa/i.test(target)){
        S.fa_risk = (S.fa_risk|0) + 2;
        S.compliance_risk = (S.compliance_risk|0) + 2;
      } else if (/staff/i.test(target)){
        S.team_morale_boost = Math.max(-12, (S.team_morale_boost||0) - 2);
      }
    } else if (mid){
      logSafe(`${titleTarget(target)} pockets the bag. "This stays between us."`);
    } else {
      logSafe(`${titleTarget(target)} tries it hesitantly.`);
    }
    // Common risk bumps
    S.police_risk = (S.police_risk|0) + 1;
    S.fa_risk = (S.fa_risk|0) + ( /board|fa/i.test(target) ? 1 : 0 );
  }

  function titleTarget(t){
    if (!t) return 'They';
    const s = String(t);
    if (s.startsWith('player:')) return s.replace(/^player:/,'Player ');
    return s.replace(/\bfa\b/i,'FA').replace(/\bpolice\b/i,'the police').replace(/\bboard\b/i,'the board');
  }

  // ---- Post-match daily cleanup (once per match day) ----
  GameHooks.on('matchday:end', function(){
    if (S.on_drugs_today) S.on_drugs_today = false;
    clearDerangedButtons();
  });

})();