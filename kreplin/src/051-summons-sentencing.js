/* === Patch 4B.3 — Summons & Sentencing (Board/FA routing + prison severity) === */
(function(){

  // Legacy oversight headlines are swallowed and turned into queued investigations
  window.__allowOversightHeadlineNow = false;
  GameHooks.on('log:veto', function suppressLegacyHeadlines(msg){
      if (window.__oversightQueueMode !== false && typeof msg === "string"){
        const looksLikeOversight = /^(?:News:\s*Scandal Brewing|Scandal Brewing|Board summons:|News:\s*Financial Crimes Unit)/i.test(msg);
        if (looksLikeOversight && !window.__allowOversightHeadlineNow){
          try {
            if (/Board summons/i.test(msg)){
              (window.queueInvestigationSafe||function(){} )('board', 'irregularities');
            } else if (/Scandal Brewing|FA investigating/i.test(msg)){
              (window.queueInvestigationSafe||function(){} )('fa', 'misconduct');
            } else if (/Financial Crimes Unit/i.test(msg)){
              (window.queueInvestigationSafe||function(){} )('police', 'financial');
            }
          } catch(_) {}
          return false;
        }
      }
  });

  window.queueInvestigationSafe = function(authority, caseType){
    try{
      if (typeof queueInvestigation === 'function'){ 
        queueInvestigation(authority, caseType); 
        return; 
      }
      if (!S) {
        return;
      }
      if (!Array.isArray(S.knock_queue)) {
        S.knock_queue = [];
      }
      const investigation = { type:"investigation", authority, caseType };
      S.knock_queue.push(investigation);
    }catch(e){
      console.error("DEBUG: Error in queueInvestigationSafe:", e);
    }
  };

  function crimeSeverity(){
    try{
      let sev = 0;
      sev += (S.police_risk|0);
      sev += (S.bribes_count|0) * 2;
      sev += (S.fixed_matches|0) * 6;
      sev += (S.offbooks|0) * 2;
      if (S.stolen && (S.stolen.last_rummage_cash|0) > 0) sev += 3;
      if (S.rummage_seen) sev += 8;
      if (S.stolen_suspected) sev += 5;
      return Math.max(0, sev|0);
    }catch(_){ return 0; }
  }

  // DISABLED: This wrapper was causing duplicate arrest messages
  // The old system was being called first, then the new system
  /*
  (function wrapPresentInvestigation(){
    const oldPI = window.presentInvestigation;
    window.presentInvestigation = async function(v){
      const prevFlag = window.__allowOversightHeadlineNow;
      window.__allowOversightHeadlineNow = true;
      try{
        if (typeof oldPI === "function"){
          const res = await oldPI.call(this, v);
          if ((v?.authority) === 'police'){
            ensurePrisonButtonsSeverity();
          }
          return res;
        }
      } finally {
        window.__allowOversightHeadlineNow = prevFlag;
      }
    };
  })();
  */

  function ensurePrisonButtonsSeverity(){
    try{
      if (!S || window.__prisonButtonsAdjusted) return;
      window.__prisonButtonsAdjusted = true;

      const acts = document.getElementById('actions') || document.body;
      const btns = Array.from(acts.querySelectorAll('button[data-investigation="1"]'));

      const sev = crimeSeverity();
      const pJail = Math.max(0, Math.min(0.75, (sev - 14) * 0.03));
      const willJail = Math.random() < pJail;
      let jailGames = 0;
      if (willJail){
        jailGames = Math.max(1, Math.round(sev / 16) + (Math.random()<0.35 ? 1 : 0));
      }

      for (const b of btns){
        const t = (b.textContent||"").toLowerCase();
        if (/accept guilt/.test(t)){
          if (willJail && !/prison/.test(t)){
            b.textContent = b.textContent + `, prison ${jailGames} gm(s)`;
            const orig = b.onclick;
            b.onclick = function(){
              try{
                S.suspensions = Object.assign(S.suspensions||{}, {prison_games:(S.suspensions?.prison_games|0)+jailGames});
                (window.updateHUD||function(){})();
              }catch(_){}
              if (typeof orig === 'function') try{ orig(); }catch(_){}
            };
          }
          break;
        }
      }
    }catch(_){}
  }

  // Minor nudge: mark that we are in oversight queue mode so suppressor knows to gate headlines
  window.__oversightQueueMode = true;

})();