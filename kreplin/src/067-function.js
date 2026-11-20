/* === Deranged Controller v6 — hard de-dup + interaction-only gate === */
(function(){
  try{
    if (window.__DERANGED_V6__) return; window.__DERANGED_V6__ = true;

    // --- utility ---
    function actionsRoot(){
      const actions = document.getElementById('actions');
      if (actions) return actions;
      return document.getElementById('choices')
        || document.querySelector('#choicesPanel #actions')
        || document.querySelector('#choicesPanel .choices')
        || document.body;
    }

    // Remember last log line to infer context
    var lastMsg = "";
    (function hookLog(){
      var prev = window.log || function(){};
      if (prev.__deranged_v6) return;
      window.log = function(){
        try{
          if (arguments[0] && typeof arguments[0] === 'string'){
            lastMsg = arguments[0];
            scheduleClean();
          }
        }catch(_){}
        return prev.apply(this, arguments);
      };
      window.log.__deranged_v6 = true;
    })();

    // --- context detection ---
    function peopleContext(){
      var t = (lastMsg||"").toLowerCase();
      // Positive signals
      var allow = [
        "locker","locker room","manager","captain","coach","staff",
        "ref","referee","board","fa","police","summoned","interview",
        "family","wife","kids","child","nightclub","bar","pub","woman","women",
        "talk","speak","visit","enter","meet"
      ];
      for (var i=0;i<allow.length;i++) if (t.indexOf(allow[i]) !== -1) return true;

      // Peek at current buttons for hints
      var root = actionsRoot();
      if (root){
        var nodes = Array.prototype.slice.call(root.querySelectorAll('button,a'),0,8);
        var joined = nodes.map(function(n){return (n.textContent||"").toLowerCase();}).join(" ");
        for (var j=0;j<allow.length;j++) if (joined.indexOf(allow[j]) !== -1) return true;
      }
      return false;
    }

    function nonInteractionContext(){
      var t = (lastMsg||"").toLowerCase();
      var block = [
        "random pre","random pre-match","lineup","tactics","formation",
        "proceed to match","kickoff","simulate","betting","transfer","market",
        "stadium","finance","save","load","reset",
        "watch game from your house","watch game from your prison cell"
      ];
      for (var i=0;i<block.length;i++) if (t.indexOf(block[i]) !== -1) return true;
      return false;
    }

    // --- family of labels we manage ---
    function isDerangedFamilyText(txt){
      if (!txt) return false;
      txt = String(txt).trim();
      var low = txt.toLowerCase();
      if (low.indexOf("deranged:") === 0) return true;
      if (low === "more deranged ideas…" || low === "more deranged ideas...") return true;
      if (low.indexOf("give cocaine to them") === 0) return true;
      return false;
    }

    // Throttle
    var lastRun = 0, pending = null;
    function scheduleClean(){
      var now = Date.now();
      if (now - lastRun > 60){ // run immediately
        cleanAndGate();
        lastRun = now;
      } else {
        clearTimeout(pending);
        pending = setTimeout(function(){ cleanAndGate(); lastRun = Date.now(); }, 80);
      }
    }

    // Core cleaner/gatekeeper
    function cleanAndGate(){
      try{
        var root = actionsRoot(); if (!root) return;
        var inv = (window.S && window.S.inventory) ? (window.S.inventory.drugs|0) : 0;
        var high = !!(window.S && S.on_drugs_today);

        // Remove everything if not on drugs or non-interaction
        if (!high || nonInteractionContext() || !peopleContext()){
          var kill = root.querySelectorAll('button,a');
          for (var k=0;k<kill.length;k++){
            var txt = (kill[k].textContent||"").trim();
            if (isDerangedFamilyText(txt)) kill[k].remove();
          }
          return;
        }

        // Collect current family, normalize into buckets
        var nodes = Array.prototype.slice.call(root.querySelectorAll('button,a'));
        var deranged = [], more = [], give = [];
        nodes.forEach(function(n){
          var txt = (n.textContent||"").trim();
          if (!isDerangedFamilyText(txt)) return;
          var l = txt.toLowerCase();
          if (l.indexOf("deranged:") === 0) deranged.push(n);
          else if (l === "more deranged ideas…" || l === "more deranged ideas...") more.push(n);
          else if (l.indexOf("give cocaine to them") === 0) give.push(n);
        });

        // Keep at most 2 unique DERANGED labels
        var seen = new Set(); var kept=0;
        for (var i=0;i<deranged.length;i++){
          var key = deranged[i].textContent.trim().toLowerCase();
          if (seen.has(key) || kept >= 2){
            deranged[i].remove();
          } else {
            seen.add(key); kept++;
          }
        }

        // Keep exactly one "More deranged ideas…"
        for (var m=1; m<more.length; m++) more[m].remove();

        // Keep exactly one "Give cocaine to them" (prefer the longest label variant)
        if (give.length > 1){
          var best = give.slice().sort(function(a,b){
            return (b.textContent||"").length - (a.textContent||"").length;
          })[0];
          give.forEach(function(n){ if (n !== best) n.remove(); });
        }
        // If no give button exists but we have inventory, don't add one here;
        // legacy injectors will add it — our job is to dedupe, not to inject.
      }catch(e){ /* swallow to stay resilient */ }
    }

    // Observe actions area for any changes to squash duplicates quickly
    (function observe(){
      var root = actionsRoot(); if (!root || root.__deranged_v6_obs) return;
      var mo = new MutationObserver(scheduleClean);
      mo.observe(root, {childList:true, subtree:true});
      root.__deranged_v6_obs = mo;
    })();

    // Also clean after any button click (menus often re-render)
    (function clickClean(){
      var root = actionsRoot(); if (!root || root.__deranged_v6_click) return;
      root.addEventListener('click', function(){ setTimeout(scheduleClean, 0); }, true);
      root.__deranged_v6_click = true;
    })();

    // First pass a moment after load
    setTimeout(scheduleClean, 200);
  }catch(e){ console.error("Deranged Controller v6 error", e); }
})();