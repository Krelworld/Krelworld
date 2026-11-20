/* === Patch 5.6 — Marco buy linkage + Deranged dialogue actions + Real rehab skip ===
   (Marco linkage and the rehab gate live in the 5.7.1 part; the dialogue DERANGED
   option is the impulse system. What is left here is the HUD count.) */
(function(){
  // HUD refresh hook for inventory pill if present
  // HUD extension (runs after updateHUD redraws)
  GameHooks.on('hud', function wrapHUD(){
      try{
        const span = document.getElementById('hudDrugCount');
        if (span) span.textContent = String(S?.inventory?.drugs|0);
      }catch(_){}
  });
})();

// ---- Retired: button-style DERANGED actions ----
// The authors disabled these ("will be replaced by another function") in favour of the
// impulse option; several near-identical pools existed. Kept once, unreferenced, for the text.
const RETIRED_DERANGED_BUTTON_POOL = [
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
    }},
  { label: "throw scalding hot coffee", effect: function(){
          S.team_morale_boost = Math.max(-15, (S.team_morale_boost||0)-10);
          S.reputation = Math.max(0, (S.reputation||0)-6);
          S.police_risk = (S.police_risk||0) + 4;
          S.fa_risk = (S.fa_risk||0) + 2;
          logSafe("DERANGED: You fling scalding coffee. Chaos ensues.");
        } }
];
