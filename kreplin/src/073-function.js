(function(){
  const W = window;
  if (W.__DERANGED_V80__) return; W.__DERANGED_V80__ = true;

  function S(){ return (W.S||(W.S={})) }
  function onDrugs(){ const s=S(); return !!(s.on_drugs_today || s.under_influence || s.cocaine_high); }

  // Allow only in these dialog titles / heuristics
  const EXACT = new Set([
    "Team Talk",
    "Opposition Locker Room",
    "Which side should the referee favor?"
  ]);
  function allowedFor(title){
    if (!onDrugs()) return false;
    if (!title) return false;
    if (title === "Team Talk"){
      // Only before the talk is done
      return !S().spoke_to_team_this_prematch;
    }
    if (EXACT.has(title)) return true;
    const t = String(title).toLowerCase();
    if (t.includes("manager") && (t.includes("bribe") || t.includes("talk") || t.includes("approach") || t.includes("negotiate"))) return true;
    return false;
  }

  function ctxKey(title){
    const m = (S().matches_played|0);
    return m + "::" + String(title||"");
  }

  function applyDerangedEffects(title){
    const s = S();
    s.team_morale_boost = (s.team_morale_boost||0) - 15;
    s.police_risk = (s.police_risk||0) + 15;
    s.legal_risk  = (s.legal_risk ||0) + 10;

    const t = String(title||"").toLowerCase();
    if (t.includes("referee")){
      s.referee_bribed = false;
      s.referee_assaulted = false;
      s.ref_bribe_side = null;
      if (typeof W.log === "function") W.log("Your deranged outburst torpedoes the referee bribe.");
    }
    if (t.includes("manager")){
      s.manager_bribed = false;
      if (typeof W.log === "function") W.log("The manager is offended; bribe talk collapses.");
    }
    if (t.includes("police") || t.includes("custody") || t.includes("arrest") || t.includes("station")){
      s.prison_games_remaining = Math.max(s.prison_games_remaining|0, 3);
      if (typeof W.log === "function") W.log("You flip out at the police. You are immediately sentenced to prison (3 games).");
    }
    if (typeof W.updateHUD === "function") try{ W.updateHUD(); }catch(_){}
  }

  const origChoose = W.choose;
  if (typeof origChoose !== "function") return;

  W.choose = async function(items, title, ...rest){
    const s = S();
    const key = ctxKey(title);
    s.__deranged_used = s.__deranged_used || {};

    // Filter out any legacy deranged/more-deranged/give-cocaine choices in this dialog list only
    let list = Array.isArray(items) ? items.slice() : [];
    list = list.filter(it => {
      const label = String(it && it.label || "").toLowerCase();
      return !(label.startsWith("deranged:") || label === "more deranged ideas" || label === "more deranged ideas..." || label === "more deranged options" || label === "give cocaine to them");
    });

    // Inject exactly one option if permitted and not already used in this dialog this match
    if (allowedFor(title) && !s.__deranged_used[key]){
      const POOL = [
        "DERANGED: throw scalding hot coffee",
        "DERANGED: make strange animal grunting",
        "DERANGED: fling a chair across the room",
        "DERANGED: insult everyone’s ancestors",
        "DERANGED: shadow-box and headbutt a locker"
      ];
      const label = POOL[Math.floor(Math.random()*POOL.length)];
      list.push({ key:"__DERANGED__", label, deranged:true });
    }

    const picked = await origChoose.call(this, list, title, ...rest);

    if (picked === "__DERANGED__"){
      s.__deranged_used[key] = true; // one-time per dialog per match
      if (typeof W.log === "function") W.log("Hopped up on cocaine, you act deranged. Chaos ensues.");
      applyDerangedEffects(title);
      // Re-open same dialog without DERANGED so the player must pick a normal option
      const cleaned = list.filter(x => x && x.key !== "__DERANGED__");
      return await origChoose.call(this, cleaned, title, ...rest);
    }

    return picked;
  };
})();