(function(){
  if (window.__patch53DrugsApplied) return;
  window.__patch53DrugsApplied = true;

  // ---- Core drug + addiction state ----
  function ensureDrugCore(){
    window.S = window.S || {};
    if (!S.inventory || typeof S.inventory !== 'object') S.inventory = { accolades: [], drugs: 0 };
    if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
    if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
    if (typeof S.drugs_unlocked !== 'boolean') S.drugs_unlocked = true; // assume unlocked in this patched build
    if (typeof S.on_drugs_today !== 'boolean') S.on_drugs_today = false;
    if (typeof S.drug_streak !== 'number') S.drug_streak = 0;
    if (!S.suspensions) S.suspensions = {prison_games:0, rehab_games:0, house_games:0};
    if (typeof S.suspensions.prison_games !== 'number') S.suspensions.prison_games = 0;
    if (typeof S.suspensions.rehab_games !== 'number') S.suspensions.rehab_games = 0;
    if (!S.addictions || typeof S.addictions !== 'object') S.addictions = { people: {} };
  }

  function actionsRoot(){ return document.getElementById('actions') || document.getElementById('choices') || document.body; }
  function logSafe(m){ try{ (window.log||console.log)(m); }catch(_){ console.log(m); } }
  function money(n){ return "£"+Number(Math.max(0,Math.round(n||0))).toLocaleString('en-GB'); }
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

  // ---- Context tracking so we only render in valid phases ----
  // Allowed phases for deranged/give‑coke: prematch, evening, home (family).
  window.__ui_context = window.__ui_context || 'boot';
  window.__current_actor = window.__current_actor || null; // e.g. 'police','board','fa','wife','child','player:Name'
  function setCtx(c){ window.__ui_context = c; }
  function setActor(a){ window.__current_actor = a; }

  function isAllowedPhase(){
    return ['prematch','evening','home'].includes(window.__ui_context);
  }

  // Try to infer the current “actor” from common lines
  function sniffActorFromMessage(msg){
    if (!msg || typeof msg !== 'string') return;
    if (/arrested by the police|the police (?:arrive|are here)/i.test(msg)) setActor('police');
    else if (/board summons|summoned to the board/i.test(msg)) setActor('board');
    else if (/\bFA\b|\bF\.A\./i.test(msg)) setActor('fa');
    else if (/wife|spouse|family|kids|child|son|daughter/i.test(msg)) setActor('family');
    else if (/captain|manager|coach/i.test(msg)) setActor('staff');
    else if (/player/i.test(msg)) setActor('player');
  }

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

  function mountDerangedButtons(){
    // Deranged actions disabled - will be replaced by another function
    return;
    ensureDrugCore();
    if (!isAllowedPhase()) return;
    clearDerangedButtons();

    // Only show deranged pool if the chairman is high today
    if (S.on_drugs_today){
      const root = actionsRoot(); if (!root) return;
      // pick two random actions
      const pool = DERANGED_POOL.slice();
      for (let i=0;i<2;i++){
        if (!pool.length) break;
        const idx = Math.floor(Math.random()*pool.length);
        const a = pool.splice(idx,1)[0];
        const b = document.createElement('button');
        b.dataset.deranged = "1"; b.className="bad";
        b.textContent = "DERANGED: " + a.label;
        b.addEventListener('click', function(){
          try{ a.effect(); }catch(_){}
          // one-time per mount; remove after click
          b.remove();
        });
        root.appendChild(b);
      }
      // a little reshuffle option
      const more = document.createElement('button');
      more.dataset.deranged = "1"; more.className="warn";
      more.textContent = "More deranged ideas…";
      more.addEventListener('click', mountDerangedButtons);
      root.appendChild(more);
    }

    // "Give cocaine to them" — DISABLED: Now handled by contextual impulse system
    // The new impulse system provides contextual "Give cocaine to [specific target]" options
    // instead of generic popup-based giving
  }

  // ---- Give cocaine flow ----
  function giveCocaineToCurrent(){
    // DISABLED: Now handled by contextual impulse system
    // The new impulse system provides contextual "Give cocaine to [specific target]" options
    // instead of generic popup-based giving
    log("Cocaine giving is now handled through contextual impulse actions when high.");
    return;
  }

  function normalizeTargetKey(target){
    if (!target) return 'unknown';
    const t = String(target).toLowerCase();
    if (t.includes('board')) return 'board';
    if (t === 'fa' || t.includes('f.a')) return 'fa';
    if (t.includes('wife') || t.includes('spouse')) return 'wife';
    if (t.includes('child') || t.includes('kid') || t.includes('son') || t.includes('daughter')) return 'family';
    if (t.includes('manager') || t.includes('coach') || t.includes('staff')) return 'staff';
    if (t.includes('player')){
      const parts = String(target).split(':'); // player:Name
      if (parts[1]) return 'player:'+parts[1].trim();
      return 'player';
    }
    return t.replace(/\s+/g,'_');
  }

  function bumpAddiction(key){
    if (!S.addictions || !S.addictions.people) S.addictions = {people:{}};
    const cur = Number(S.addictions.people[key]||0) + 1;
    S.addictions.people[key] = cur;
    return cur;
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

  // ---- Context wiring via log() ----
  const _log = window.log || function(){};
  if (!_log.__patch53Ctx){
    window.log = function(){
      const msg = arguments[0];
      // Update context + actor guesses BEFORE printing
      try{
        if (typeof msg === 'string'){
          if (/Pre[- ]?match|Kickoff|Opponent|team talk|locker/i.test(msg)) setCtx('prematch');
          else if (/Evening|Nightclub|Bar|Pub|After hours/i.test(msg)) setCtx('evening');
          else if (/Stay home|Home life|house|from your house/i.test(msg)) setCtx('home');
          sniffActorFromMessage(msg);
          // mount/clear buttons according to context
          if (isAllowedPhase()) mountDerangedButtons(); else clearDerangedButtons();
        }
      }catch(_){}
      return _log.apply(this, arguments);
    };
    window.log.__patch53Ctx = true;
  }

  // ---- Post‑match cleanup & addiction drip feed (optional future hooks) ----
  const _log2 = window.log || function(){};
  if (!_log2.__patch53Post){
    const base = window.log;
    window.log = function(){
      const msg = arguments[0];
      const ret = base.apply(this, arguments);
      try{
        if (typeof msg === "string" && msg.indexOf("Attendance:") === 0 && msg.indexOf("Gate Revenue:") !== -1){
          // daily cleanup
          if (S.on_drugs_today) S.on_drugs_today = false;
          // minor: addicted players might have a wobble next match (model later)
          // Clear UI
          clearDerangedButtons();
          setCtx('postmatch');
        }
      }catch(_){}
      return ret;
    };
    window.log.__patch53Post = true;
  }

  // ---- Initial mount (only if already in an allowed screen) ----
  setTimeout(function(){
    ensureDrugCore();
    if (isAllowedPhase()) mountDerangedButtons();
  }, 600);

})();