(() => {
  // ==== HARD STOP: kill any previous DERANGED auto-injectors ====
  try {
    if (window.__derangedObserver && typeof window.__derangedObserver.disconnect === 'function') {
      window.__derangedObserver.disconnect();
    }
    window.__derangedObserver = null;
  } catch(e){}
  try {
    // If earlier patches exposed helpers, neutralize them
    window.mountDerangedButtons = function(){ /* disabled - deranged actions removed, will be replaced by another function */ };
    window.unmountDerangedButtons = function(){
      document.querySelectorAll('[data-deranged="true"]').forEach(el => el.remove());
    };
    window.unmountDerangedButtons();
  } catch(e){}

  // Remove any already-inserted deranged DOM buttons to avoid duplicates
  try {
    document.querySelectorAll('button, .btn')
      .forEach(b => { if ((b.textContent||'').includes('DERANGED:')) b.remove(); });
  } catch(e){}

  // ==== One-per-dialog DERANGED option via choose() wrapper ====
  const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];

  const DERANGED_POOL = [
    "Make strange animal grunting noises",
    "Throw scalding hot coffee at them",
    "Fling the whiteboard and shriek",
    "Insult their ancestors in rhyme",
    "Start shadow-boxing and headbutt a locker"
  ];


  // Effects resolver by context
  async function performDerangedEffectsForTitle(title){
    try {
      const msg = pick(DERANGED_POOL);
      // Hefty immediate consequences
      // Team/opponent morale shifts depend on room
      if (title.includes("Your Locker Room")){
        // Hammer our own team morale boost (pre-match aggregate)
        window.S = window.S || {};
        window.S.team_morale_boost = (S.team_morale_boost || 0) - 15;
        (window.log||console.log)("DERANGED: " + msg + ". Your squad is rattled. Team morale -15.");
      } else if (title.includes("Opposition Locker Room")){
        window.S = window.S || {};
        window.S.morale_opponent = Math.max(0, (S.morale_opponent || 70) - 15);
        (window.log||console.log)("DERANGED: " + msg + ". The opposition are spooked. Opponent morale -15.");
      } else if (title.includes("Which side should the referee favor?")){
        // Doing this at the ref immediately spikes legal/police risk and likely ruins the bribe
        (window.log||console.log)("DERANGED: " + msg + " (at the referee). He is horrified and threatens to report you.");
        window.S = window.S || {};
        S.legal_risk  = (S.legal_risk  || 0) + 20;
        S.police_risk = (S.police_risk || 0) + 25;
        // Nuke any in-progress bribe flag for this call path if present
        try { S.referee_bribed = undefined; } catch(e){}
      }

      // General risk spikes
      S.legal_risk  = (S.legal_risk  || 0) + 10;
      S.police_risk = (S.police_risk || 0) + 10;

      // If we ever show DERANGED in a police dialog later, insta-prison can be handled similarly.
      if (typeof window.updateHUD === "function") window.updateHUD();
    } catch(e){
      console.warn("DERANGED effects error:", e);
    }
  }

  // Wrap choose once for cocaine impulse system
  if (!window.__CHOOSE_ORIG) {
    window.__CHOOSE_ORIG = window.choose;
    window.__COKE_WRAPPED__ = true;

    window.choose = async function(items, title, ...rest){
      try {
        const S = window.S || (window.S = {});
        
        // Check if impulse is available for this dialog
        const impulseKey = (S.matches_played||0) + ":" + title;
        const impulseUsed = S.__impulse_used && S.__impulse_used[impulseKey];
        const isHigh = S.coke_state === "buzzed" || S.coke_state === "wired" || S.on_drugs_today;
        
        // Eligible dialogs only - use flexible matching
        const isEligible = title === "Team Talk" && !S.spoke_to_team_this_prematch ||
          title === "Opposition Locker Room" ||
          title.includes("referee favor") ||
          title.includes("manager bribe") ||
          title.includes("Locker Room");
        
        // Show impulse if high, eligible, and not already used this match
        if (isHigh && isEligible && !impulseUsed) {
          let impulseLabels = [
            "Say something unhinged (shake them)",
            "Threaten and leer (deeply inappropriate)", 
            "Hurl scalding coffee",
            "Shadow-box and headbutt a locker"
          ];
          
          // Add contextual "give cocaine" option based on dialog
          if ((S.inventory.drugs|0) > 0) {
            if (title.includes("referee favor")) {
              impulseLabels.push("Give cocaine to the referee");
            } else if (title.includes("manager bribe")) {
              impulseLabels.push("Give cocaine to the manager");
            } else if (title.includes("Team Talk")) {
              impulseLabels.push("Give cocaine to the team");
            } else if (title.includes("Locker Room") || title.includes("locker room")) {
              // Add multiple player options for repeated giving
              if (title.includes("Opposition")) {
                // Opposition locker room - give to opposition players
                impulseLabels.push("Give cocaine to an opposition player");
                impulseLabels.push("Give cocaine to the opposition team");
              } else {
                // Your locker room - give to your players
                if (Array.isArray(S.squad) && S.squad.length > 0) {
                  // Show 2-3 random players for repeated giving
                  const shuffled = [...S.squad].sort(() => Math.random() - 0.5);
                  const playersToShow = shuffled.slice(0, Math.min(3, S.squad.length));
                  playersToShow.forEach(player => {
                    if (player?.name) {
                      impulseLabels.push(`Give cocaine to ${player.name}`);
                    }
                  });
                }
                impulseLabels.push("Give cocaine to a player");
              }
            } else {
              impulseLabels.push("Give them a bump");
            }
          }
          
          // Add plant drugs option if in locker room and have drugs
          if ((title.includes("Locker Room") || title.includes("locker room")) && (S.inventory.drugs|0) > 0) {
            if (Array.isArray(S.squad) && S.squad.length > 0) {
              // Show specific player names for planting
              const randomPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
              const playerName = randomPlayer?.name || "a player";
              impulseLabels.push(`Plant drugs on ${playerName}`);
            } else {
              impulseLabels.push("Plant drugs on a player");
            }
          }
          
          const impulseLabel = impulseLabels[Math.floor(Math.random() * impulseLabels.length)];
          const impulseItem = { key: "__impulse__", label: impulseLabel, variant: "warn" };
          
          const injected = [...items, impulseItem];
          const picked = await window.__CHOOSE_ORIG(injected, title, ...rest);
          
          if (picked === "__impulse__") {
            // Mark as used for this dialog this match
            if (!S.__impulse_used) S.__impulse_used = {};
            S.__impulse_used[impulseKey] = true;
            
            // Apply impulse effects
            await applyImpulseEffect(impulseLabel, title);
            
            // For bribe dialogs, end cleanly
            if (title.includes("bribe") || title.includes("referee favor")) {
              return "cancel";
            }
            
            // For other dialogs, re-open without impulse
            return await window.__CHOOSE_ORIG(items, title, ...rest);
          }
          return picked;
        } else {
          // No impulse available - call original
          return await window.__CHOOSE_ORIG(items, title, ...rest);
        }
      } catch(e){
        console.warn("choose wrapper fell back:", e);
        return await window.__CHOOSE_ORIG(items, title, ...rest);
      }
    };
  }

  // Apply impulse effects based on the chosen action
  async function applyImpulseEffect(impulseLabel, title) {
    const S = window.S || (window.S = {});
    
    if (impulseLabel === "Say something unhinged (shake them)") {
      if (title === "Team Talk") {
        S.team_morale_boost = (S.team_morale_boost||0) - 10;
        log("Your unhinged rant terrifies your own team. Team morale -10.");
      } else {
        S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 10);
        log("Your deranged outburst shakes the opposition. Opponent morale -10.");
      }
      S.police_risk = (S.police_risk||0) + 10;
      S.legal_risk = (S.legal_risk||0) + 8;
    }
    
    else if (impulseLabel === "Threaten and leer (deeply inappropriate)") {
      if (title.includes("bribe") || title.includes("referee favor")) {
        // Boost bribe success for this moment
        S._impulse_bribe_boost = 1.25;
        log("Your threatening demeanor makes them more compliant. Bribe success boosted.");
      }
      S.compliance_risk = (S.compliance_risk||0) + 8;
      S.police_risk = (S.police_risk||0) + 10;
    }
    
    else if (impulseLabel === "Hurl scalding coffee") {
      if (title === "Team Talk") {
        S.team_morale_boost = (S.team_morale_boost||0) - 14;
        log("You hurl scalding coffee at your own team! Team morale -14.");
      } else {
        S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 14);
        log("You hurl scalding coffee at the opposition! Opponent morale -14.");
      }
      S.police_risk = (S.police_risk||0) + 15;
      S.legal_risk = (S.legal_risk||0) + 12;
    }
    
    else if (impulseLabel === "Shadow-box and headbutt a locker") {
      log("You shadow-box and headbutt a locker. Everyone is confused.");
      S.police_risk = (S.police_risk||0) + 8;
    }
    
    else if (impulseLabel.includes("Give cocaine to")) {
      if ((S.inventory.drugs|0) >= 1) {
        S.inventory.drugs -= 1;
        
        if (impulseLabel.includes("referee")) {
          S._impulse_bribe_boost = 0.90; // Set to min(0.90, current + huge bonus)
          log("You offer the referee a bump. He's very interested now. Bribe success maximized.");
        } else if (impulseLabel.includes("manager")) {
          S._impulse_bribe_boost = 0.90; // Set to min(0.90, current + huge bonus)
          log("You offer the manager a bump. He's very interested now. Bribe success maximized.");
        } else if (impulseLabel.includes("team")) {
          log("You offer the team cocaine. They're shocked but some take it. Team morale affected.");
          S.team_morale_boost = (S.team_morale_boost||0) - 5; // Team is conflicted
          // Create addiction for random team members
          if (Array.isArray(S.squad) && S.squad.length > 0) {
            const randomPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
            const playerId = randomPlayer?.name || "unknown_player";
            if (!S.addiction[playerId]) S.addiction[playerId] = 0;
            S.addiction[playerId]++;
          }
        } else if (impulseLabel.includes("opposition player")) {
          log("You offer an opposition player cocaine. They take it and become unreliable.");
          S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 8); // Opposition morale down
          // Create addiction for opposition (tracked separately)
          if (!S.opposition_addiction) S.opposition_addiction = {};
          const oppPlayerId = "opposition_player_" + Math.floor(Math.random() * 1000);
          if (!S.opposition_addiction[oppPlayerId]) S.opposition_addiction[oppPlayerId] = 0;
          S.opposition_addiction[oppPlayerId]++;
        } else if (impulseLabel.includes("opposition team")) {
          log("You offer the opposition team cocaine. Chaos ensues!");
          S.morale_opponent = Math.max(0, (S.morale_opponent||70) - 15); // Big opposition morale hit
          // Create multiple opposition addictions
          if (!S.opposition_addiction) S.opposition_addiction = {};
          for (let i = 0; i < 3; i++) {
            const oppPlayerId = "opposition_player_" + Math.floor(Math.random() * 1000);
            if (!S.opposition_addiction[oppPlayerId]) S.opposition_addiction[oppPlayerId] = 0;
            S.opposition_addiction[oppPlayerId]++;
          }
        } else if (impulseLabel.includes("player") || impulseLabel.match(/Give cocaine to [A-Za-z]/)) {
          // Individual player - extract name from label or select random
          let playerId, player;
          if (impulseLabel.match(/Give cocaine to [A-Za-z]/)) {
            // Extract player name from label
            playerId = impulseLabel.replace("Give cocaine to ", "");
            player = S.squad.find(p => p?.name === playerId);
          } else {
            // Random player fallback
            player = S.squad[Math.floor(Math.random() * S.squad.length)];
            playerId = player?.name || "unknown_player";
          }
          
          if (player && playerId) {
            // Initialize addiction tracking
            if (!S.addiction) S.addiction = {};
            if (!S.addiction[playerId]) S.addiction[playerId] = 0;
            S.addiction[playerId]++;
            
            const addictionLevel = S.addiction[playerId];
            
            // Sweet spot mechanics
            if (addictionLevel === 1) {
              log(`You offer ${playerId} a bump. They're hesitant but take it. Performance boost!`);
              S.team_morale_boost = (S.team_morale_boost||0) + 3; // Sweet spot boost
            } else if (addictionLevel === 2) {
              log(`${playerId} eagerly takes the cocaine. They're getting hooked but still performing well.`);
              S.team_morale_boost = (S.team_morale_boost||0) + 5; // Peak performance
            } else if (addictionLevel === 3) {
              log(`${playerId} is clearly addicted now. They need it to function. Performance declining.`);
              S.team_morale_boost = (S.team_morale_boost||0) + 2; // Still some boost
            } else if (addictionLevel >= 4) {
              log(`${playerId} is a full-blown addict. They're unreliable and affecting team morale.`);
              S.team_morale_boost = (S.team_morale_boost||0) - 3; // Negative impact
              // Add addiction penalty to team stats
              if (!S._addiction_penalties) S._addiction_penalties = {};
              S._addiction_penalties[playerId] = addictionLevel - 3; // Penalty scales with addiction
            }
          } else {
            log("No players available to give cocaine to.");
          }
        } else {
          // Fallback for generic "Give them a bump"
          log("You offer them a bump. They take it gratefully.");
          const targetId = "current_target";
          if (!S.addiction[targetId]) S.addiction[targetId] = 0;
          S.addiction[targetId]++;
        }
        
        S.police_risk = (S.police_risk||0) + 30;
        S.legal_risk = (S.legal_risk||0) + 20;
        S.coke_detection_risk = (S.coke_detection_risk||0) + 2;
      } else {
        log("You don't have any cocaine to give.");
      }
    }
    
    else if (impulseLabel.includes("Plant drugs on")) {
      if ((S.inventory.drugs|0) >= 1) {
        S.inventory.drugs -= 1;
        
        // Extract player name from the impulse label
        const playerName = impulseLabel.replace("Plant drugs on ", "");
        
        if (Array.isArray(S.squad) && S.squad.length > 0) {
          // Find the actual player object by name
          const targetPlayer = S.squad.find(p => p?.name === playerName) || S.squad[0];
          const playerId = targetPlayer?.name || playerName;
          
          S.evidence[playerId] = "drugs";
          log(`You plant a bag of cocaine in ${playerId}'s locker. This could be useful later.`);
          
          // Enable blackmail route (set flag for existing systems)
          S._blackmail_enabled = true;
        } else {
          log("No players available to frame.");
        }
        
        S.coke_detection_risk = (S.coke_detection_risk||0) + 3;
      } else {
        log("You don't have any cocaine to plant.");
      }
    }
    
    // Increment detection risk for all impulses
    S.coke_detection_risk = (S.coke_detection_risk||0) + 1;
    
    if (typeof window.updateHUD === 'function') window.updateHUD();
  }
})();