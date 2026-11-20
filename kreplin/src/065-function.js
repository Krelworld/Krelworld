/* === Patch 5.7.3 — DERANGED actions mount reliably when S.on_drugs_today === true === */
(function(){
  try{
    if (window.__deranged573) return; window.__deranged573 = true;

    function ensureCore(){
      window.S = window.S || {};
      const s = window.S;
      if (typeof s.on_drugs_today !== 'boolean') s.on_drugs_today = false;
      if (typeof s.team_morale_boost !== 'number') s.team_morale_boost = 0;
      if (typeof s.reputation !== 'number') s.reputation = 50;
      if (typeof s.police_risk !== 'number') s.police_risk = 0;
      if (typeof s.fa_risk !== 'number') s.fa_risk = 0;
      if (!s.inventory || typeof s.inventory !== 'object') s.inventory = {accolades:[],drugs:0};
      if (!Array.isArray(s.inventory.accolades)) s.inventory.accolades = [];
    }
    function actionsRoot(){
      const actions = document.getElementById('actions');
      if (actions) return actions;
      return document.querySelector('#choicesPanel #actions')
          || document.getElementById('choices')
          || document.querySelector('#choicesPanel .choices')
          || document.querySelector('.choices')
          || document.body;
    }
    function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
    function logSafe(m){ try{ (window.log||console.log)(m); }catch(_){  } }

    const POOL = [
      { label: "throw scalding hot coffee", effect: function(){
          S.team_morale_boost = Math.max(-15, (S.team_morale_boost||0)-10);
          S.reputation = Math.max(0, (S.reputation||0)-6);
          S.police_risk = (S.police_risk||0) + 4;
          S.fa_risk = (S.fa_risk||0) + 2;
          logSafe("DERANGED: You fling scalding coffee. Chaos ensues.");
        } },
      { label: "make strange animal grunting noises", effect: function(){
          S.reputation = Math.max(0, (S.reputation||0)-2);
          const wobble = (Math.random()<0.5) ? -3 : +2;
          S.team_morale_boost = clamp((S.team_morale_boost||0) + wobble, -12, 12);
          logSafe("DERANGED: You grunt like a wild boar. Everyone is unsettled.");
        } },
      { label: "hurl abuse at a random player", effect: function(){
          S.team_morale_boost = Math.max(-12, (S.team_morale_boost||0)-5);
          logSafe("DERANGED: You lay into a player until he’s glassy-eyed.");
        } },
      { label: "smash a club trophy in front of them", effect: function(){
          S.reputation = Math.max(0, (S.reputation||0)-7);
          if (S.inventory?.accolades?.length){
            const lost = S.inventory.accolades.pop();
            logSafe(`DERANGED: You smash "${lost?.name||'a trophy'}". Shards everywhere.`);
          } else {
            logSafe("DERANGED: You smash a framed photo. Glass rains down.");
          }
        } },
      { label: "threaten to sack the manager mid-sentence", effect: function(){
          S.reputation = Math.max(0, (S.reputation||0)-4);
          S.compliance_risk = (S.compliance_risk||0) + 1;
          logSafe('DERANGED: You shout "PACK YOUR BAGS" at the manager, then forget why.');
        } },
    ];

    function clearDeranged(root){
      if (!root) return;
      root.querySelectorAll('button[data-deranged573="1"]').forEach(n=>n.remove());
    }

    function mountDeranged(){
      // Deranged actions disabled - will be replaced by another function
      return;
      ensureCore();
      if (!S.on_drugs_today) return;  // only show when high
      const root = actionsRoot(); if (!root) return;

      // Avoid duplicates
      if (root.querySelector('button[data-deranged573="1"]')) return;

      // pick 2 random actions
      const pool = POOL.slice().sort(()=>Math.random()-0.5).slice(0,2);
      pool.forEach(a=>{
        const b = document.createElement('button');
        b.dataset.deranged573 = "1";
        b.className = "btn-bad";
        b.textContent = "DERANGED: " + a.label;
        b.addEventListener('click', function(){
          try{ a.effect(); }catch(_){}
          // remove this specific button so you can't spam the same one
          b.remove();
        });
        root.appendChild(b);
      });

      // reshuffle option
      const more = document.createElement('button');
      more.dataset.deranged573 = "1";
      more.className = "btn-warn";
      more.textContent = "More deranged ideas…";
      more.addEventListener('click', function(){
        clearDeranged(root);
        mountDeranged();
      });
      root.appendChild(more);
    }

    // Hook into log() so whenever a line is printed during menus, we try to mount
    (function wrapLog(){
      const prev = window.log || function(){};
      if (prev.__deranged573) return;
      window.log = function(){
        try{ mountDeranged(); }catch(_){}
        return prev.apply(this, arguments);
      };
      window.log.__deranged573 = true;
    })();

    // Observe actions container for dynamic menu changes
    (function observe(){
      const root = actionsRoot(); if (!root) return;
      if (root.__derangedObs573) return;
      const mo = new MutationObserver(()=>{
        try{ mountDeranged(); }catch(_){}
      });
      mo.observe(root, {childList:true, subtree:true});
      root.__derangedObs573 = mo;
    })();

    // Run once after boot (covers initial menus)
    setTimeout(mountDeranged, 300);

    // Optional tiny helper for testing: window._makeHigh()
    window._makeHigh = window._makeHigh || function(){
      ensureCore();
      S.on_drugs_today = true;
      logSafe("DEBUG: on_drugs_today set to true.");
      setTimeout(mountDeranged, 50);
    };

  }catch(e){ console.error("Deranged 5.7.3 failed", e); }
})();