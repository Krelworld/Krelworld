// ========== CREATE ULTIMA CUP OVERLAY ==========
function createUltimaCupOverlay(ourTeam, portsmouthTeam, legendsTeam, ultimaTeam) {
  const overlay = document.createElement('div');
  overlay.className = 'ultima-cup-overlay';
  overlay.innerHTML = `
    <div class="ultima-cup-container">
      <div class="ultima-cup-header">
        <div class="ultima-cup-title">🏆 THE ULTIMA CUP 🏆</div>
        <div class="ultima-cup-commentary-container">
          <div class="ultima-cup-commentary-header">📺 Live Commentary</div>
          <div class="ultima-cup-commentary" id="ultimaCupCommentary"></div>
        </div>
        <div class="ultima-cup-scores">
          <div class="ultima-cup-score us-score">
            <div class="score-label">${ourTeam}</div>
            <div class="score-value" id="usScore">0</div>
          </div>
          <div class="ultima-cup-score portsmouth-score">
            <div class="score-label">${portsmouthTeam}</div>
            <div class="score-value" id="portsmouthScore">0</div>
          </div>
          <div class="ultima-cup-score legends-score">
            <div class="score-label">${legendsTeam}</div>
            <div class="score-value" id="legendsScore">0</div>
          </div>
          <div class="ultima-cup-score ultima-score">
            <div class="score-label">${ultimaTeam}</div>
            <div class="score-value" id="ultimaScore">0</div>
          </div>
        </div>
        <div class="ultima-cup-minute">0'</div>
      </div>
      <div class="ultima-cup-log-container">
        <div class="ultima-cup-status">
          <span id="ultimaCupCards">🟨 0 🟥 0</span>
          <span id="ultimaCupInjuries">🚑 0</span>
          <span id="ultimaCupChaos">⚡ Chaos: 0</span>
          <div class="ultima-cup-speed-control">
            <label for="ultimaCupSpeed">Commentary Speed:</label>
            <select id="ultimaCupSpeed" class="ultima-cup-speed-select">
              <option value="1">1 (Slowest)</option>
              <option value="2">2 (Slow)</option>
              <option value="3">3 (Default)</option>
              <option value="4">4 (Fast)</option>
              <option value="5">5 (Fastest)</option>
            </select>
          </div>
        </div>
        <div class="ultima-cup-log-header">🏆 Epic Match Log 🏆</div>
        <div class="ultima-cup-log" id="ultimaCupLog"></div>
      </div>
      <button class="ultima-cup-skip-btn">Skip to FT</button>
    </div>
  `;
  
  // Disable skip button if this is match 11 season 2 (stadium attack match) or first match of season 5
  const ultimaSkipBtn = overlay.querySelector('.ultima-cup-skip-btn');
  if (ultimaSkipBtn && ((S.season === 2 && S.matches_played === 11) || (S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0))) {
    ultimaSkipBtn.disabled = true;
    ultimaSkipBtn.style.opacity = '0.5';
    ultimaSkipBtn.style.cursor = 'not-allowed';
    ultimaSkipBtn.title = 'Skip disabled for this match';
  }
  
  // Initialize speed selector with saved preference (default 3)
  const speedSelect = overlay.querySelector('#ultimaCupSpeed');
  const savedSpeed = localStorage.getItem('ultimaCupCommentarySpeed');
  const defaultSpeed = '3';
  speedSelect.value = savedSpeed || defaultSpeed;
  
  // Save preference when changed
  speedSelect.addEventListener('change', (e) => {
    localStorage.setItem('ultimaCupCommentarySpeed', e.target.value);
  });
  
  return overlay;
}

// Lightweight choice modal for Quick Sim overlay
async function promptQuickSimChoice(overlay, {
  title,
  subtitle,
  options,
  defaultId,
  toneClass,
  skipState
}) {
  return new Promise(resolve => {
    if (!options || options.length === 0) {
      resolve(defaultId || null);
      return;
    }

    let settled = false;
    const safeResolve = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'quick-sim-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'quick-sim-modal';
    if (toneClass) modal.classList.add(toneClass);

    const h2 = document.createElement('h2');
    h2.textContent = title || 'Decision';
    modal.appendChild(h2);

    if (subtitle) {
      const p = document.createElement('p');
      p.className = 'quick-sim-modal-subtitle';
      p.textContent = subtitle;
      modal.appendChild(p);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'quick-sim-modal-options';

    const primaryClass = 'btn btn-primary';
    const secondaryClass = 'btn btn-secondary';

    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = idx === 0 ? primaryClass : secondaryClass;
      btn.textContent = opt.label || opt.id;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeResolve(opt.id);
      });
      btnRow.appendChild(btn);
    });

    modal.appendChild(btnRow);

    if (options.some(o => o.description)) {
      const descList = document.createElement('ul');
      descList.className = 'quick-sim-modal-descriptions';
      options.forEach((opt) => {
        if (!opt.description) return;
        const li = document.createElement('li');
        li.textContent = opt.description;
        descList.appendChild(li);
      });
      modal.appendChild(descList);
    }

    backdrop.appendChild(modal);

    const container = overlay || document.body;
    container.appendChild(backdrop);

    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        const fallback = defaultId || options[0].id;
        safeResolve(fallback);
      } else if (/^[1-9]$/.test(ev.key) && options[+ev.key - 1]) {
        ev.preventDefault(); ev.stopPropagation();
        safeResolve(options[+ev.key - 1].id);
      }
    };
    setTimeout(() => { const f = btnRow.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 0);

    document.addEventListener('keydown', onKey, true);

    let skipInterval = null;
    if (skipState) {
      skipInterval = setInterval(() => {
        try {
          if (skipState.requested) {
            const fallback = defaultId || options[0].id;
            safeResolve(fallback);
          }
        } catch (_e) {
          // ignore
        }
      }, 100);
    }

    function cleanup() {
      if (backdrop && backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      document.removeEventListener('keydown', onKey, true);
      if (skipInterval) clearInterval(skipInterval);
    }
  });
}

// Reveal match events over time with live score updates
async function revealMatchEvents(result, overlay, skipState) {
  const logEl = overlay.querySelector('#quickSimLog');
  const scoreHome = overlay.querySelector('.score-home');
  const scoreAway = overlay.querySelector('.score-away');
  const minuteEl = overlay.querySelector('.quick-sim-minute');
  const cardsEl = overlay.querySelector('#quickSimCards');
  const injuriesEl = overlay.querySelector('#quickSimInjuries');
  const subsEl = overlay.querySelector('#quickSimSubs');
  
  let homeScore = 0;
  let awayScore = 0;
  let yellowCards = 0;
  let redCards = 0;
  let injuries = 0;
  let currentMinute = 0;
  let lastMinuteMarker = 0;
  let subsUsed = 0;
  let subsAvailable = 5; // cosmetic substitution rule for Quick Sim
  if (S && S.preMatch && S.preMatch.canUseSubs === false) {
    subsAvailable = 0;
  }

  let didHalftimePrompt = false;
  let didSubsPrompt = false;

  // Match aggression scalar for downstream systems (0=calm,1=normal,2=aggressive)
  if (typeof S === 'object' && S) {
    if (typeof S._matchAggression !== 'number') {
      S._matchAggression = 1;
    }
  }

  // Get commentary speed from UI (default 3, but remember last setting)
  const speedSelect = overlay.querySelector('#quickSimSpeed');
  
  // Map speed 1-5 to paceMultiplier values
  // Speed 1: slowest (2.0x), 2: slow (1.5x), 3: new default (1.2x), 4: current speed (1.0x), 5: fastest (0.5x)
  const speedMultipliers = {
    1: 2.0,   // Slowest
    2: 1.5,   // Slow
    3: 1.2,   // New default (slightly slower than current)
    4: 1.0,   // Current speed (old default)
    5: 0.5    // Fastest
  };
  
  let paceMultiplier = speedMultipliers[3] || 1.2; // Default value, but will be read dynamically
  let halftimePaceOverride = null; // Allow halftime choices to temporarily override speed

  async function pacedDelay(ms) {
    // If halftime choice set an override, use it; otherwise read from selector dynamically
    let factor;
    if (halftimePaceOverride !== null) {
      factor = halftimePaceOverride;
    } else {
      // Read the current speed value from the selector each time to allow real-time changes
      const currentSpeedValue = speedSelect ? parseInt(speedSelect.value) : 3;
      factor = speedMultipliers[currentSpeedValue] || 1.2;
    }
    await delay(Math.max(0, ms * factor));
  }
  
  // Helper: update quick sim status
  function updateQuickSimStatus() {
    if (cardsEl) {
      cardsEl.textContent = `🟨 ${yellowCards} 🟥 ${redCards}`;
    }
    if (injuriesEl) {
      injuriesEl.textContent = `🚑 ${injuries}`;
    }
    if (subsEl) {
      subsEl.textContent = `🔁 ${subsUsed}/${subsAvailable}`;
    }
  }
  
  // Initialize status
  updateQuickSimStatus();
  
  // Add kickoff message
  addLogEntry(logEl, "Kickoff!", null);
  await pacedDelay(1500);
  
  if (skipState.requested) {
    revealFinalScore(result, overlay);
    return;
  }
  
  // Process events
  let lastTickMinute = -1;
  let lastBribeCommentaryMinute = -999;
  let lastWorldCupCommentaryMinute = -999;
  for (const event of result.events) {
    if (skipState.requested) break;
    
    const eventMinute = Math.floor(event.t);

    // Halftime prompt around 45'
    if (!didHalftimePrompt && currentMinute < 45 && eventMinute >= 45 && !skipState.requested) {
      didHalftimePrompt = true;
      if (!skipState.requested) {
        const halftimeOptions = [
          { id: 'calm',  label: 'Keep it calm',      description: 'You urge patience and structure.' },
          { id: 'fire',  label: 'Light them up',     description: 'You tear into them. Faces drop.' },
          { id: 'tweak', label: 'Tactical tweak',    description: 'You switch shape and target their fullback.' }
        ];
        
        // Add HGH option if player has HGH stock
        if (S.doctor && S.doctor.hgh_stock > 0) {
          halftimeOptions.push({ id: 'hgh', label: 'Give HGH to players', description: 'Enhance performance with HGH.' });
        }
        
        // Add cocaine option if player has cocaine in inventory
        if (S.inventory && (S.inventory.drugs || 0) > 0) {
          halftimeOptions.push({ id: 'cocaine', label: 'Give cocaine to players', description: 'Hyper aggression with cocaine.' });
        }
        
        // Add deranged options if drunk
        if (S.isDrunk) {
          halftimeOptions.push({ id: 'emotional_blackmail', label: 'Emotional blackmail', description: 'Threaten to kill yourself if you don\'t win the game.' });
        }
        
        if (overlay._pitch) overlay._pitch.whistle('HALF TIME');
        if (minuteEl) minuteEl.textContent = 'HT';
        const choice = await promptQuickSimChoice(overlay, {
          title: "Half-time",
          subtitle: "What's the message in the dressing room?",
          options: halftimeOptions,
          defaultId: 'calm',
          toneClass: 'quick-sim-modal-halftime',
          skipState
        });
        if (overlay._pitch) overlay._pitch.resume();

        let flavour = '';
        let aggression = 1;
        if (choice === 'calm') {
          flavour = 'Half-time: You urge patience and structure.';
          aggression = 0;
          halftimePaceOverride = 1.1; // slightly slower, more considered
        } else if (choice === 'fire') {
          flavour = 'Half-time: You tear into them. Faces drop.';
          aggression = 2;
          halftimePaceOverride = 0.85; // slightly faster, frenetic
        } else if (choice === 'tweak') {
          flavour = 'Half-time: You switch shape and target their fullback.';
          aggression = 1;
          halftimePaceOverride = 1.0;
        } else if (choice === 'hgh') {
          // Give HGH to players at halftime
          const starters = (typeof getOurSelectedFive === 'function') ? getOurSelectedFive() : [];
          if (S.doctor && S.doctor.hgh_stock > 0 && starters.length > 0) {
            if (S.doctor.hgh_stock >= starters.length) {
              S.doctor.hgh_stock -= starters.length;
              starters.forEach(player => {
                if (!player.hgh_doses) player.hgh_doses = 0;
                if (!player.hgh_matches_used) player.hgh_matches_used = 0;
                player.hgh_doses++;
                player.hgh_matches_used++;
                player.on_hgh_this_match = true;
                
                // Apply rating boost
                if (!player.halftime_hgh_boost) {
                  player.halftime_hgh_boost = 3;
                  player.rating = (player.rating || 50) + 3;
                }
                
                // Heart attack risk
                const heartAttackChance = Math.min(0.15, 0.02 + (player.hgh_matches_used * 0.03));
                if (player.hgh_matches_used >= 2 && Math.random() < heartAttackChance) {
                  triggerHGHHeartAttack(player);
                }
              });
              flavour = `Half-time: You give HGH to all players. They look noticeably more muscular and aggressive.`;
              addLogEntry(logEl, `45' - ${flavour}`, null);
              log('All players receive a +3 rating boost from HGH!');
            } else {
              flavour = `Half-time: You only have ${S.doctor.hgh_stock} HGH doses, but need ${starters.length} for all players.`;
              addLogEntry(logEl, `45' - ${flavour}`, null);
            }
          } else {
            flavour = 'Half-time: You don\'t have any HGH to give.';
            addLogEntry(logEl, `45' - ${flavour}`, null);
          }
          aggression = 1;
          halftimePaceOverride = 1.0;
        } else if (choice === 'cocaine') {
          // Give cocaine to players at halftime
          const starters = (typeof getOurSelectedFive === 'function') ? getOurSelectedFive() : [];
          const drugCount = S.inventory ? (S.inventory.drugs || 0) : 0;
          if (drugCount > 0 && starters.length > 0) {
            if (drugCount >= starters.length) {
              S.inventory.drugs -= starters.length;
              starters.forEach(player => {
                if (!player.cocaine_uses) player.cocaine_uses = 0;
                player.cocaine_uses++;
                player.on_cocaine_this_match = true;
                player.cocaine_dependency_risk = (player.cocaine_dependency_risk || 0) + 15;
              });
              flavour = `Half-time: You say "here lads, have some lovely gear" and they all snort it up...there's even a bit left over for you!`;
              addLogEntry(logEl, `45' - ${flavour}`, null);
              log('All players are now hyper-aggressive and will play recklessly!');
            } else {
              flavour = `Half-time: You only have ${drugCount} bag(s) of cocaine, but need ${starters.length} for all players.`;
              addLogEntry(logEl, `45' - ${flavour}`, null);
            }
          } else {
            flavour = 'Half-time: You don\'t have any cocaine to give.';
            addLogEntry(logEl, `45' - ${flavour}`, null);
          }
          aggression = 2;
          halftimePaceOverride = 0.85; // faster, frenetic
        } else if (choice === 'emotional_blackmail') {
          // Emotional blackmail: threaten suicide if they don't win
          if (typeof S.suicide_threat_count !== 'number') S.suicide_threat_count = 0;
          S.suicide_threat_count++;
          
          const starters = (typeof getOurSelectedFive === 'function') ? getOurSelectedFive() : [];
          
          if (S.suicide_threat_count === 1) {
            // First time: strong performance boost
            flavour = 'Half-time: You threaten to kill yourself if you don\'t win the game. The players look shocked and determined.';
            addLogEntry(logEl, `45' - ${flavour}`, null);
            // Apply performance boost to all players
            starters.forEach(player => {
              if (!player.suicide_threat_boost) {
                player.suicide_threat_boost = 5;
                player.rating = (player.rating || 50) + 5;
              }
            });
            log('The players are motivated by your desperate plea. +5 rating boost to all players!');
            aggression = 2;
            halftimePaceOverride = 0.8; // very fast, intense
          } else if (S.suicide_threat_count === 2) {
            // Second time: diminished returns
            flavour = 'Half-time: You threaten to kill yourself if you don\'t win the game. The players exchange worried glances.';
            addLogEntry(logEl, `45' - ${flavour}`, null);
            starters.forEach(player => {
              if (!player.suicide_threat_boost) {
                player.suicide_threat_boost = 2;
                player.rating = (player.rating || 50) + 2;
              }
            });
            log('The players are concerned but less motivated. +2 rating boost to all players.');
            aggression = 1.5;
            halftimePaceOverride = 0.9;
          } else if (S.suicide_threat_count === 3) {
            // Third time: players start complaining
            flavour = 'Half-time: You threaten to kill yourself if you don\'t win the game. One player mutters: "He\'s always threatening this."';
            addLogEntry(logEl, `45' - ${flavour}`, null);
            starters.forEach(player => {
              if (!player.suicide_threat_boost) {
                player.suicide_threat_boost = 1;
                player.rating = (player.rating || 50) + 1;
              }
            });
            log('The players are getting tired of your threats. +1 rating boost to all players.');
            aggression = 1;
            halftimePaceOverride = 1.0;
            
            // Players brief to press
            setTimeout(() => {
              if (typeof addPaper === 'function') {
                addPaper(`Players express concern over chairman's repeated suicide threats during matches`, 10);
              }
              if (typeof window.enqueueRivalText === 'function') {
                window.enqueueRivalText('Do it. You\'re a mental midget. Just do it.');
              } else {
                log(`📱 Delmor Krunchem: "Do it. You're a mental midget. Just do it."`);
              }
            }, 2000);
          } else {
            // Fourth time and beyond: mark for post-match resignation
            flavour = 'Half-time: You threaten to kill yourself if you don\'t win the game. The players look at each other, then at you, with disgust.';
            addLogEntry(logEl, `45' - ${flavour}`, null);
            log('The players have had enough. No performance boost.');
            aggression = 0.5;
            halftimePaceOverride = 1.1;
            
            // Mark that a player will resign after the match
            S.pending_suicide_threat_resignation = true;
          }
        } else {
          flavour = 'Half-time: You switch shape and target their fullback.';
          aggression = 1;
          halftimePaceOverride = 1.0;
        }

        if (typeof S === 'object' && S) {
          S._matchAggression = aggression;
        }

        if (choice !== 'hgh' && choice !== 'cocaine') {
          addLogEntry(logEl, `45' - ${flavour}`, null);
        }
        await pacedDelay(1000);
        if (skipState.requested) break;
        
        // Reset halftime pace override after halftime is complete so speed selector works in second half
        halftimePaceOverride = null;
      }
    }
    
    // Update minute indicator
    if (eventMinute > currentMinute) {
      currentMinute = eventMinute;
      minuteEl.textContent = `${eventMinute}'`;
      if (overlay._pitch) overlay._pitch.minute(eventMinute);
    }
    
    // Show minute markers periodically (every 10 minutes)
    if (eventMinute > 0 && eventMinute % 10 === 0 && eventMinute > lastMinuteMarker) {
      addLogEntry(logEl, `${eventMinute}' - The match continues...`, null);
      lastMinuteMarker = eventMinute;
      await pacedDelay(1000);
      if (skipState.requested) break;
    }
    
    // Add referee bribe commentary periodically if referee was bribed
    if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
      const changedMinute = (eventMinute !== lastBribeCommentaryMinute);
      const shouldFire = changedMinute && (Math.random() < 0.12) && eventMinute > 5 && eventMinute < 88;
      
      if (shouldFire) {
        const oppTeam = currentOpponent()?.team || 'Opposition';
        const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
        const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';
        const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
        const line = pick(pool)
          .replaceAll('{FAV}', favName)
          .replaceAll('{OPP}', oppName);
        addLogEntry(logEl, `${eventMinute}' - ${line}`, null);
        lastBribeCommentaryMinute = eventMinute;
        await pacedDelay(1000);
        if (skipState.requested) break;
      }
    }
    
    // Add World Cup drunk manager commentary periodically
    if (S && S.isDrunk && (S.competition === 'world_cup' || S.worldCupActive)) {
      const changedMinute = (eventMinute !== lastWorldCupCommentaryMinute);
      const shouldFire = changedMinute && (Math.random() < 0.2) && eventMinute > 5 && eventMinute < 88;
      
      if (shouldFire) {
        const oppName = S.matchContext?.team || currentOpponent()?.team || 'Opposition';
        const drunkComment = generateDrunkManagerCommentary(oppName);
        if (drunkComment) {
          addLogEntry(logEl, `${eventMinute}' - ${drunkComment}`, null);
          lastWorldCupCommentaryMinute = eventMinute;
          await pacedDelay(1000);
          if (skipState.requested) break;
        }
      }
    }
    
    // Generate commentary
    let commentary = '';
    try {
      if (overlay._pitch) { try { overlay._pitch.event(event); } catch (_e) {} }
      if (event.kind === 'GOAL') {
        commentary = generateGoalCommentary(event);
        // Flash effect on goal
        overlay.classList.add('goal-flash');
        setTimeout(() => {
          overlay.classList.remove('goal-flash');
        }, 1200);
        // Update score immediately
        if (event.who === 'HOME') {
          homeScore++;
          updateScore(scoreHome, homeScore);
        } else {
          awayScore++;
          updateScore(scoreAway, awayScore);
        }
      } else if (event.kind === 'SHOT') {
        commentary = generateShotCommentary(event);
      } else if (event.kind === 'CORNER') {
        commentary = generateCornerCommentary(event);
      } else if (event.kind === 'FOUL') {
        // Check if this is a cocaine user - more aggressive commentary
        if (event.isCocaineUser && event.player) {
          commentary = generateCocaineCommentary(event.player, 'FOUL');
          // Much higher chance of continued assault after foul (70% chance)
          if (Math.random() < 0.70) {
            setTimeout(() => {
              // 20% chance of weapon assault, 80% chance of continued kicking
              if (Math.random() < 0.20) {
                const weaponAssault = generateCocaineCommentary(event.player, 'WEAPON_ASSAULT');
                addLogEntry(logEl, `${eventMinute}' - ${weaponAssault}`, null);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && event.who === 'HOME') || (S.referee_bribed === 'them' && event.who === 'AWAY'))) {
                  addLogEntry(logEl, `${eventMinute}' - I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this weapon assault! If I didn't know better I'd say this referee has been bribed!`, null);
                } else {
                  // Normal red card for weapon assault
                  addLogEntry(logEl, `${eventMinute}' - RED CARD! ${event.player} is sent off for assault with a weapon! This is absolutely criminal!`, null);
                }
              } else {
                const continuedAssault = generateCocaineCommentary(event.player, 'CONTINUED_ASSAULT');
                addLogEntry(logEl, `${eventMinute}' - ${continuedAssault}`, null);
                // Check if referee was bribed - if so, he turns blind eye
                if (S && S.referee_bribed && ((S.referee_bribed === 'us' && event.who === 'HOME') || (S.referee_bribed === 'them' && event.who === 'AWAY'))) {
                  addLogEntry(logEl, `${eventMinute}' - I CAN'T BELIEVE IT! The referee is turning a complete blind eye to this assault! If I didn't know better I'd say this referee has been bribed!`, null);
                } else {
                  // Normal red card for continued assault
                  addLogEntry(logEl, `${eventMinute}' - RED CARD! ${event.player} is sent off for violent conduct!`, null);
                }
              }
            }, 1200); // Slower delay for more dramatic effect
          }
        } else {
          commentary = generateFoulCommentary(event);
        }
      } else if (event.kind === 'RED_CARD') {
        // Check if cocaine user and referee bribed
        if (event.isCocaineUser && S && S.referee_bribed && ((S.referee_bribed === 'us' && event.who === 'HOME') || (S.referee_bribed === 'them' && event.who === 'AWAY'))) {
          commentary = `I CAN'T BELIEVE IT! ${event.player} should be sent off for this brutal assault but the referee turns a complete blind eye! If I didn't know better I'd say this referee has been bribed!`;
        } else if (event.isCocaineUser && event.player) {
          commentary = generateCocaineCommentary(event.player, 'RED_CARD');
        } else {
          commentary = generateDodgyRedCardCommentary(event);
        }
      } else if (event.kind === 'YELLOW_CARD') {
        commentary = generateYellowCardCommentary(event);
        yellowCards++;
        updateQuickSimStatus();
      } else if (event.kind === 'RED_CARD') {
        // Check if cocaine user and referee bribed
        if (event.isCocaineUser && S && S.referee_bribed && ((S.referee_bribed === 'us' && event.who === 'HOME') || (S.referee_bribed === 'them' && event.who === 'AWAY'))) {
          commentary = `I CAN'T BELIEVE IT! ${event.player} should be sent off for this brutal assault but the referee turns a complete blind eye! If I didn't know better I'd say this referee has been bribed!`;
        } else if (event.isCocaineUser && event.player) {
          commentary = generateCocaineCommentary(event.player, 'RED_CARD');
          redCards++;
          updateQuickSimStatus();
        } else {
          commentary = generateDodgyRedCardCommentary(event);
          redCards++;
          updateQuickSimStatus();
        }
      } else if (event.kind === 'CARD') {
        if (event.cardType === 'RED') {
          commentary = generateDodgyRedCardCommentary(event);
          redCards++;
          updateQuickSimStatus();
        } else {
          commentary = generateYellowCardCommentary(event);
          yellowCards++;
          updateQuickSimStatus();
        }
      } else if (event.kind === 'DODGY_PENALTY') {
        commentary = generateDodgyPenaltyCommentary(event);
        // Note: Penalty commentary will be shown, then we'll add goal if converted
      } else if (event.kind === 'DODGY_RED_CARD') {
        commentary = generateDodgyRedCardCommentary(event);
      } else if (event.kind === 'EARLY_FINAL_WHISTLE') {
        commentary = generateEarlyFinalWhistleCommentary(event);
      } else if (event.kind === 'OWN_GOAL' && event.isGazOwnGoal) {
        // Special Gaz own goal commentary
        const ownGoalLines = [
          `OWN GOAL! Paul Gascoigne has scored an own goal! He looks completely confused, staggering around the pitch.`,
          `OWN GOAL! Paul Gascoigne puts it in his own net! He's clearly drunk and can barely stand.`,
          `OWN GOAL! Paul Gascoigne scores past his own keeper! He's so unfit he can't even tell which end is which.`,
          `OWN GOAL! Paul Gascoigne has scored an own goal! The man is clearly struggling with his weight and fitness.`,
          `OWN GOAL! Paul Gascoigne puts it in his own net! He looks completely lost out there, like he's in a different world.`,
          `OWN GOAL! Paul Gascoigne scores an own goal! He's so drunk he's celebrating before realising his mistake.`,
          `OWN GOAL! Paul Gascoigne has scored an own goal! The man is clearly unfit and struggling with his obesity.`,
          `OWN GOAL! Paul Gascoigne puts it past his own keeper! He's so drunk he can barely see straight.`
        ];
        commentary = pick(ownGoalLines);
        // Flash effect on own goal
        overlay.classList.add('goal-flash');
        setTimeout(() => {
          overlay.classList.remove('goal-flash');
        }, 1200);
        // Update score immediately (own goal counts for away team)
        awayScore++;
        updateScore(scoreAway, awayScore);
      } else if (event.kind === 'GAZ_SHENANIGAN') {
        // Handle Gazza shenanigans
        const shenaniganType = event.shenaniganType || 'DRUNK';
        let shenaniganCommentary = '';
        switch(shenaniganType) {
          case 'DRUNK':
            shenaniganCommentary = `${eventMinute}' - Paul Gascoigne appears to be completely drunk on the pitch! He's stumbling around, barely able to stand!`;
            break;
          case 'VODKA':
            shenaniganCommentary = `${eventMinute}' - INCREDIBLE! Paul Gascoigne has pulled out a bottle of vodka and is drinking it on the pitch! The referee is looking the other way!`;
            break;
          case 'EXPOSE':
            shenaniganCommentary = `${eventMinute}' - OH MY GOD! Paul Gascoigne has exposed himself to the crowd! This is absolutely disgraceful!`;
            break;
          case 'OWN_GOAL':
            shenaniganCommentary = `${eventMinute}' - OWN GOAL! Paul Gascoigne has scored an own goal! He's celebrating, thinking it's for the opposition!`;
            // Flash effect on own goal
            overlay.classList.add('goal-flash');
            setTimeout(() => {
              overlay.classList.remove('goal-flash');
            }, 1200);
            awayScore++;
            updateScore(scoreAway, awayScore);
            break;
          case 'SENT_OFF':
            shenaniganCommentary = `${eventMinute}' - RED CARD! Paul Gascoigne has been sent off! He's arguing with the referee, completely out of control!`;
            redCards++;
            updateQuickSimStatus();
            break;
          case 'ATTACK_FANS':
            shenaniganCommentary = `${eventMinute}' - DISGRACEFUL! Paul Gascoigne has left the pitch and is attacking fans in the stands! Security are trying to restrain him!`;
            break;
          case 'FALL_ASLEEP':
            shenaniganCommentary = `${eventMinute}' - UNBELIEVABLE! Paul Gascoigne has fallen asleep on the pitch! He's lying in the centre circle, completely passed out!`;
            break;
          default:
            shenaniganCommentary = `${eventMinute}' - Paul Gascoigne is causing chaos on the pitch!`;
        }
        commentary = shenaniganCommentary;
      } else if (event.kind === 'STRETCHER_INJURY') {
        commentary = generateStretcherInjuryCommentary(event.player, event.causedBy);
        injuries++;
        updateQuickSimStatus();
        // Check if opponent manager was bribed - if so, no substitution
        if (S && S.opponent_bribed && event.who === 'AWAY') {
          setTimeout(() => {
            addLogEntry(logEl, `${eventMinute}' - The opposition manager allows ${event.player} to be taken off on a stretcher without substitution! This is bizarre!`, null);
          }, 500);
        } else if (event.who === 'HOME') {
          // Cosmetic forced substitution logic for our team
          if (subsUsed < subsAvailable) {
            subsUsed++;
            updateQuickSimStatus();
            if (!skipState.requested) {
              await promptQuickSimChoice(overlay, {
                title: "Forced substitution",
                subtitle: `${event.player || 'One of your players'} cannot continue.`,
                options: [
                  { id: 'ok', label: 'Make the sub', description: 'You signal to the bench and reshuffle.' }
                ],
                defaultId: 'ok',
                toneClass: 'quick-sim-modal-forced-sub',
                skipState
              });
              addLogEntry(logEl, `${eventMinute}' - Forced change: you reshuffle the pack.`, null);
            }
          } else {
            addLogEntry(logEl, `${eventMinute}' - ⚠️ No subs left — you’re forced to play on with fewer than five players.`, null);
          }
        }
      } else if (event.kind === 'HGH_COMMENTARY') {
        if (event.player) {
          commentary = generateHGHCommentary(event.player);
        }
      } else if (event.kind === 'COCAINE_HEART_ATTACK') {
        if (event.player) {
          commentary = `${event.player} collapses on the pitch – suspected heart failure linked to drug abuse.`;
        } else {
          commentary = `A player collapses on the pitch – suspected heart failure linked to drug abuse.`;
        }
      } else if (event.kind === 'CRAZY_BACKFLIP' || event.kind === 'CRAZY_FIGHT' || 
                 event.kind === 'CRAZY_REF_EXPOSURE' || event.kind === 'CRAZY_FAN_SHOOTING' || 
                 event.kind === 'CRAZY_DRAMA') {
        commentary = event.message || '';
      }
    } catch (e) {
      console.warn('Error generating commentary:', e);
    }
    
    if (commentary && typeof commentary === 'string') {
      addLogEntry(logEl, `${eventMinute}' - ${commentary}`, event);
    }
    
    // Handle penalty goal conversion (80% chance)
    if (event.kind === 'DODGY_PENALTY' && Math.random() < 0.8 && !skipState.requested) {
      await pacedDelay(1000);
      const goalEvent = {
        t: event.t + 0.1,
        who: event.who,
        kind: 'GOAL',
        scorer: event.player,
        assister: null,
        team: event.team,
        isFromPenalty: true
      };
      
      const goalCommentary = generateGoalCommentary(goalEvent);
      addLogEntry(logEl, `${eventMinute}' - ⚽ ${goalCommentary} (Penalty)`, goalEvent);
      
      // Update score
      if (event.who === 'HOME') {
        homeScore++;
        updateScore(scoreHome, homeScore);
      } else {
        awayScore++;
        updateScore(scoreAway, awayScore);
      }
      
      // Flash effect on goal
      overlay.classList.add('goal-flash');
      setTimeout(() => {
        overlay.classList.remove('goal-flash');
      }, 1200);
      
      await pacedDelay(1500);
      if (skipState.requested) break;
    }
    
    // If EARLY_FINAL_WHISTLE occurred, end the match early
    if (event.kind === 'EARLY_FINAL_WHISTLE' && !skipState.requested) {
      await pacedDelay(2000);
      break; // Break out of event loop to end match early
    }
    
    // Add generic updates between goals (optional)
    if (event.kind === 'GOAL' && Math.random() < 0.3) {
      const updates = [
        "Southampton dominating possession",
        "Away side pressing",
        "Both teams looking for opportunities",
        "Match heating up"
      ];
      await pacedDelay(1500);
      if (!skipState.requested) {
        addLogEntry(logEl, `${eventMinute + 1}' - ${pick(updates)}`, null);
      }
    }
    
    // Delay between events (faster for non-goals)
    const delayTime = event.kind === 'GOAL' ? 2500 : 800;
    await pacedDelay(delayTime);
    
    // Process taunt ticks for special commentary (drunk, overweight, sex offender)
    // Always process ticks to show special commentary, not just when taunt mode is active
    // Process once per minute to avoid spam
    if (eventMinute > lastTickMinute) {
      lastTickMinute = eventMinute;
      // Create a wrapper function to add entries to the overlay log
      const overlayLogFn = (text) => {
        addLogEntry(logEl, `${eventMinute}' - ${text}`, null);
      };
      await processQuickSimTick(eventMinute, overlayLogFn);
    }
  }
  
  // Show full-time
  if (!skipState.requested) {
    await pacedDelay(1500);
    minuteEl.textContent = "FT";
    addLogEntry(logEl, `Full-time: ${getClubName()} ${result.usGoals} – ${result.themGoals} ${currentOpponent()?.team || 'Opposition'}`, null);
    await pacedDelay(2000);
    
    // Season 5 first match: Mohammed Van Onslaught massacre event
    if (S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0) {
      // Close the quick sim overlay first
      overlay.style.display = 'none';
      
      // Show the ominous popout
      await showOminousMassacrePopout();
      
      // Mark event as complete
      S.season5.first_match_special_event = false;
      // Mark that we need to play the video after match UI
      S.season5.play_panic_video = true;
    }
    
    // Check if this is the stadium fire match and add terrorism commentary + explosion effects
    if (S.preMatch?.stadium_burn_triggered) {
      // Trigger explosion visual effects
      overlay.classList.add('explosion');
      
      // Create explosion particles overlay
      const explosionOverlay = document.createElement('div');
      explosionOverlay.className = 'explosion-overlay active';
      
      // Create multiple explosion particles
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'explosion-particle';
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const angle = (Math.PI * 2 * i) / 20;
        const distance = 200 + Math.random() * 300;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        explosionOverlay.appendChild(particle);
      }
      
      document.body.appendChild(explosionOverlay);
      
      // Add terrorism commentary
      await delay(500);
      addLogEntry(logEl, `💥 SUDDENLY: Flames erupt from the stadium!`, null);
      await delay(1500);
      addLogEntry(logEl, `🔥 The ground shakes as explosions rock St Mary's!`, null);
      await delay(1500);
      addLogEntry(logEl, `🚨 EMERGENCY: The stadium has been attacked by terrorists!`, null);
      await delay(1500);
      addLogEntry(logEl, `💣 Multiple bombs have exploded throughout the stadium!`, null);
      await delay(1500);
      addLogEntry(logEl, `🔥 The stadium is burning down! Flames engulf the stands!`, null);
      await delay(1500);
      addLogEntry(logEl, `🩸 There's blood and guts everywhere!`, null);
      await delay(1500);
      addLogEntry(logEl, `😱 Everyone is screaming in terror!`, null);
      await delay(2000);
      
      // Remove explosion overlay after animation
      setTimeout(() => {
        explosionOverlay.remove();
        overlay.classList.remove('explosion');
      }, 3000);
    }
  } else {
    revealFinalScore(result, overlay);
    
    // Season 5 first match: Mohammed Van Onslaught massacre event (skip case)
    if (S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0) {
      // Close the quick sim overlay first
      overlay.style.display = 'none';
      
      // Show the ominous popout
      await showOminousMassacrePopout();
      
      // Mark event as complete
      S.season5.first_match_special_event = false;
      // Mark that we need to play the video after match UI
      S.season5.play_panic_video = true;
    }
    
    // Also check for stadium burn in skip case
    if (S.preMatch?.stadium_burn_triggered) {
      const logEl = overlay.querySelector('#quickSimLog');
      addLogEntry(logEl, `💥 SUDDENLY: Flames erupt from the stadium!`, null);
      addLogEntry(logEl, `🔥 The ground shakes as explosions rock St Mary's!`, null);
      addLogEntry(logEl, `🚨 EMERGENCY: The stadium has been attacked by terrorists!`, null);
      addLogEntry(logEl, `💣 Multiple bombs have exploded throughout the stadium!`, null);
      addLogEntry(logEl, `🔥 The stadium is burning down! Flames engulf the stands!`, null);
      addLogEntry(logEl, `🩸 There's blood and guts everywhere!`, null);
      addLogEntry(logEl, `😱 Everyone is screaming in terror!`, null);
      
      // Trigger explosion visual effects
      overlay.classList.add('explosion');
      
      // Create explosion particles overlay
      const explosionOverlay = document.createElement('div');
      explosionOverlay.className = 'explosion-overlay active';
      
      // Create multiple explosion particles
      for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'explosion-particle';
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const angle = (Math.PI * 2 * i) / 20;
        const distance = 200 + Math.random() * 300;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        explosionOverlay.appendChild(particle);
      }
      
      document.body.appendChild(explosionOverlay);
      
      // Remove explosion overlay after animation
      setTimeout(() => {
        explosionOverlay.remove();
        overlay.classList.remove('explosion');
      }, 3000);
    }
  }
}

// Helper: Add log entry with Southampton player styling
function addLogEntry(logEl, text, event = null) {
  const entry = document.createElement('div');
  entry.className = 'quick-sim-log-entry';
  
  // Style Southampton player names in red and white
  let styledText = text;
  
  // Get Southampton players
  const southamptonPlayers = [];
  if (typeof getOurSelectedFive === 'function') {
    const ourPlayers = getOurSelectedFive();
    ourPlayers.forEach(player => {
      if (player && player.name) {
        southamptonPlayers.push(player.name);
      }
    });
  }
  
  // Also check event context to identify Southampton players
  if (event) {
    const isSouthamptonEvent = event.who === 'HOME' || 
                               event.team === 'Southampton FC' || 
                               event.team === (S.club_name || 'Southampton FC');
    
    // If event has scorer/assister/player and it's a Southampton event, add them
    if (isSouthamptonEvent) {
      if (event.scorer && !southamptonPlayers.includes(event.scorer)) {
        southamptonPlayers.push(event.scorer);
      }
      if (event.assister && !southamptonPlayers.includes(event.assister)) {
        southamptonPlayers.push(event.assister);
      }
      if (event.player && !southamptonPlayers.includes(event.player)) {
        southamptonPlayers.push(event.player);
      }
    }
  }
  
  // Apply styling to Southampton player names
  southamptonPlayers.forEach(playerName => {
    if (playerName) {
      const regex = new RegExp(`\\b${escapeRegex(playerName)}\\b`, 'gi');
      styledText = styledText.replace(regex, `<span class="southampton-player">$&</span>`);
    }
  });
  
  entry.innerHTML = styledText;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

// Helper: Update score with animation
function updateScore(scoreEl, newScore) {
  scoreEl.textContent = newScore;
  scoreEl.classList.add('score-pulse');
  setTimeout(() => scoreEl.classList.remove('score-pulse'), 600);
}

// ========== REVEAL ULTIMA CUP EVENTS ==========
async function revealUltimaCupEvents(result, overlay, skipState) {
  const logEl = overlay.querySelector('#ultimaCupLog');
  const commentaryEl = overlay.querySelector('#ultimaCupCommentary');
  const usScoreEl = overlay.querySelector('#usScore');
  const portsmouthScoreEl = overlay.querySelector('#portsmouthScore');
  const legendsScoreEl = overlay.querySelector('#legendsScore');
  const ultimaScoreEl = overlay.querySelector('#ultimaScore');
  const minuteEl = overlay.querySelector('.ultima-cup-minute');
  const cardsEl = overlay.querySelector('#ultimaCupCards');
  const chaosEl = overlay.querySelector('#ultimaCupChaos');
  
  let usScore = 0, portsmouthScore = 0, legendsScore = 0, ultimaScore = 0;
  let yellowCards = 0, redCards = 0;
  let chaosCount = 0;
  let currentMinute = 0;
  let didHalftimePrompt = false;
  
  // Get commentary speed from UI
  const speedSelect = overlay.querySelector('#ultimaCupSpeed');
  const speedMultipliers = {
    1: 2.0, 2: 1.5, 3: 1.2, 4: 1.0, 5: 0.5
  };
  
  async function pacedDelay(ms) {
    const currentSpeedValue = speedSelect ? parseInt(speedSelect.value) : 3;
    const factor = speedMultipliers[currentSpeedValue] || 1.2;
    await delay(Math.max(0, ms * factor));
  }
  
  function updateScores() {
    if (usScoreEl) usScoreEl.textContent = usScore;
    if (portsmouthScoreEl) portsmouthScoreEl.textContent = portsmouthScore;
    if (legendsScoreEl) legendsScoreEl.textContent = legendsScore;
    if (ultimaScoreEl) ultimaScoreEl.textContent = ultimaScore;
    if (cardsEl) cardsEl.textContent = `🟨 ${yellowCards} 🟥 ${redCards}`;
    if (chaosEl) chaosEl.textContent = `⚡ Chaos: ${chaosCount}`;
  }
  
  function addCommentary(text) {
    if (!commentaryEl) return;
    const line = document.createElement('div');
    line.className = 'ultima-cup-commentary-line';
    line.textContent = text;
    commentaryEl.appendChild(line);
    commentaryEl.scrollTop = commentaryEl.scrollHeight;
    // Keep only last 5 lines in commentary for readability
    while (commentaryEl.children.length > 5) {
      commentaryEl.removeChild(commentaryEl.firstChild);
    }
  }
  
  function addLogEntry(text, team = null) {
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.className = 'ultima-cup-log-entry';
    if (team) entry.classList.add(`team-${team}`);
    entry.textContent = text;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    // Also add to commentary
    addCommentary(text);
  }
  
  // Epic kickoff message
  addLogEntry("🏆 THE ULTIMA CUP BEGINS! Four teams, two balls, absolute chaos! 🏆");
  await pacedDelay(2000);
  
  if (skipState.requested) {
    // Reveal all scores immediately
    for (const ev of result.events) {
      if (ev.kind === 'GOAL') {
        if (ev.team === 'us') usScore++;
        else if (ev.team === 'portsmouth') portsmouthScore++;
        else if (ev.team === 'legends') legendsScore++;
        else if (ev.team === 'ultima') ultimaScore++;
      }
    }
    updateScores();
    if (minuteEl) minuteEl.textContent = "120'";
    return;
  }
  
  // Process events
  for (const event of result.events) {
    if (skipState.requested) break;
    
    const eventMinute = Math.floor(event.t);
    
    // Halftime prompt around 60' (since match is 120 minutes)
    if (!didHalftimePrompt && currentMinute < 60 && eventMinute >= 60 && !skipState.requested) {
      didHalftimePrompt = true;
      await pacedDelay(500);
      
      // Create halftime modal similar to normal matches
      const halftimeChoice = await promptQuickSimChoice(overlay, {
        title: "Half-time",
        subtitle: "The first half of the Ultima Cup is complete. What do you do?",
        options: [
          { id: 'calm', label: 'Calm talk', description: 'Urge patience and structure.' },
          { id: 'aggressive', label: 'Aggressive talk', description: 'Tear into them. Faces drop.' },
          { id: 'tactical', label: 'Tactical change', description: 'Switch shape and target weaknesses.' }
        ],
        toneClass: 'quick-sim-modal-halftime',
        skipState: skipState
      });
      
      let flavour = '';
      if (halftimeChoice === 'calm') {
        flavour = 'Half-time: You urge patience and structure.';
      } else if (halftimeChoice === 'aggressive') {
        flavour = 'Half-time: You tear into them. Faces drop.';
      } else if (halftimeChoice === 'tactical') {
        flavour = 'Half-time: You switch shape and target their weaknesses.';
      }
      
      if (flavour) {
        addLogEntry(flavour);
        await pacedDelay(1500);
      }
    }
    
    // Update minute display
    if (minuteEl && eventMinute > currentMinute) {
      currentMinute = eventMinute;
      minuteEl.textContent = `${currentMinute}'`;
      await pacedDelay(300);
    }
    
    // Handle different event types
    if (event.kind === 'GOAL') {
      // Update score
      if (event.team === 'us') usScore++;
      else if (event.team === 'portsmouth') portsmouthScore++;
      else if (event.team === 'legends') legendsScore++;
      else if (event.team === 'ultima') ultimaScore++;
      
      updateScores();
      
      // Epic goal commentary
      const teamName = event.team === 'us' ? getClubName() :
                       event.team === 'portsmouth' ? 'Portsmouth' :
                       event.team === 'legends' ? 'Legends FC' : 'Ultima FC';
      
      let commentary = `${eventMinute}' - GOAL! ${event.scorer} for ${teamName}!`;
      if (event.feat) {
        commentary += ` ${event.scorer} ${event.feat}!`;
      }
      commentary += " 🏆";
      
      addLogEntry(commentary, event.team);
      
      // Flash effect on score elements only (not the whole overlay to prevent flickering)
      const scoreElements = overlay.querySelectorAll('.ultima-cup-score');
      scoreElements.forEach(el => {
        el.classList.add('goal-flash');
        setTimeout(() => el.classList.remove('goal-flash'), 800);
      });
      
      await pacedDelay(2500);
      
    } else if (event.kind === 'EPIC_MOMENT') {
      const teamName = event.team === 'us' ? getClubName() :
                       event.team === 'portsmouth' ? 'Portsmouth' :
                       event.team === 'legends' ? 'Legends FC' : 'Ultima FC';
      
      addLogEntry(`${eventMinute}' - ${event.player} (${teamName}) with an ${event.moment}! ⚡`, event.team);
      await pacedDelay(1800);
      
    } else if (event.kind === 'CHAOS') {
      chaosCount++;
      updateScores();
      addLogEntry(`${eventMinute}' - ${event.description} 💥`);
      await pacedDelay(2000);
      
    } else if (event.kind === 'YELLOW_CARD' || event.kind === 'RED_CARD') {
      const teamName = event.team === 'us' ? getClubName() :
                       event.team === 'portsmouth' ? 'Portsmouth' :
                       event.team === 'legends' ? 'Legends FC' : 'Ultima FC';
      
      if (event.kind === 'RED_CARD') {
        redCards++;
        addLogEntry(`${eventMinute}' - RED CARD! ${event.player} (${teamName}) sent off! 🟥`);
      } else {
        yellowCards++;
        addLogEntry(`${eventMinute}' - Yellow card for ${event.player} (${teamName}) 🟨`);
      }
      updateScores();
      await pacedDelay(1500);
    }
  }
  
  // Final minute
  if (minuteEl) minuteEl.textContent = "120'";
  
  // Final score announcement
  await pacedDelay(1000);
  addLogEntry("🏆 FULL TIME! 🏆");
  await pacedDelay(1500);
  
  const scores = [
    { team: getClubName(), goals: usScore },
    { team: 'Portsmouth', goals: portsmouthScore },
    { team: 'Legends FC', goals: legendsScore },
    { team: 'Ultima FC', goals: ultimaScore }
  ];
  scores.sort((a, b) => b.goals - a.goals);
  
  if (scores[0].goals > scores[1].goals) {
    addLogEntry(`🏆 ${scores[0].team} WINS THE ULTIMA CUP! 🏆`);
  } else {
    addLogEntry(`🏆 THE ULTIMA CUP ENDS IN A DRAW! 🏆`);
    await pacedDelay(2000);
    
    // Determine which team(s) are tied for first
    const topScore = scores[0].goals;
    const tiedTeams = scores.filter(s => s.goals === topScore);
    
    // Determine opponent for penalty shootout
    let opponentName = 'Delmor Krunchem';
    let opponentTeam = 'Portsmouth';
    
    // Check if tied with Ultima FC or Legends FC
    const tiedWithUltima = tiedTeams.some(t => t.team === 'Ultima FC');
    const tiedWithLegends = tiedTeams.some(t => t.team === 'Legends FC');
    
    if (tiedWithUltima || tiedWithLegends) {
      opponentName = 'Mohammed van Onslaught';
      opponentTeam = tiedWithUltima ? 'Ultima FC' : 'Legends FC';
    } else if (tiedTeams.some(t => t.team === 'Portsmouth')) {
      opponentName = 'Delmor Krunchem';
      opponentTeam = 'Portsmouth';
    }
    
    // Check if player is tied (if not, it's between other teams)
    const playerTied = tiedTeams.some(t => t.team === getClubName());
    
    if (playerTied) {
      addLogEntry(`🏆 The match ends in a draw! The Ultima Cup will be decided by a penalty shootout.`);
      await pacedDelay(2000);
      addLogEntry(`🏆 ${opponentName} will face you in the penalty shootout.`);
      await pacedDelay(2000);
      
      // Trigger penalty minigame with the correct opponent
      const penaltyWinner = await playPenaltyMinigame(opponentName, opponentTeam);
      
      // Update scores based on penalty result
      if (penaltyWinner === 'us') {
        addLogEntry(`🏆 ${getClubName()} WINS THE ULTIMA CUP ON PENALTIES! 🏆`);
        // Update the winner for post-match handling
        if (typeof window !== 'undefined' && window.ultimaCupMatchResult) {
          window.ultimaCupMatchResult.winner = 'us';
        }
      } else {
        addLogEntry(`🏆 ${opponentTeam} WINS THE ULTIMA CUP ON PENALTIES! 🏆`);
        // Update the winner for post-match handling
        if (typeof window !== 'undefined' && window.ultimaCupMatchResult) {
          if (opponentTeam === 'Portsmouth') {
            window.ultimaCupMatchResult.winner = 'portsmouth';
          } else if (opponentTeam === 'Legends FC') {
            window.ultimaCupMatchResult.winner = 'legends';
          } else if (opponentTeam === 'Ultima FC') {
            window.ultimaCupMatchResult.winner = 'ultima';
          }
        }
      }
    } else {
      // Player not in the tie - other teams will play penalties
      addLogEntry(`🏆 The match ends in a draw between ${tiedTeams.map(t => t.team).join(' and ')}. They will play a penalty shootout.`);
      await pacedDelay(2000);
      // For now, just continue - the winner will be determined by the penalty shootout
      // This case is less common, but we handle it
    }
    
    await pacedDelay(2000);
  }
  
  // Check if player has briefcase AND armed players - show button to advance to briefcase UI
  const briefcaseValue = S.power_briefcase_owned;
  const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
  
  // Ensure ultimaCup object exists
  if (!S.ultimaCup) S.ultimaCup = {};
  
  // Check for armed players - handle both boolean and string values
  const playersArmedValue = S.ultimaCup.players_armed;
  const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
  
  
  if (hasBriefcase && hasArmedPlayers) {
    
    // Add context message to commentary
    addLogEntry("💼 The match is over. You remember the briefcase in your office. The time has come to make a decision...");
    await pacedDelay(2500);
    addLogEntry("💼 Your players are armed. You have the briefcase. There's only one way this ends.");
    await pacedDelay(2500);
    
    // Create and add briefcase button to the overlay
    const briefcaseBtn = document.createElement('button');
    briefcaseBtn.id = 'ultima-briefcase-advance-btn';
    briefcaseBtn.innerHTML = '💼<br>OPEN THE BRIEFCASE';
    briefcaseBtn.style.cssText = `
      position: absolute !important;
      bottom: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      padding: 25px 50px !important;
      font-size: 1.8rem !important;
      font-weight: bold !important;
      background: linear-gradient(135deg, #8b0000 0%, #ff0000 100%) !important;
      color: white !important;
      border: 5px solid #ffaa00 !important;
      border-radius: 20px !important;
      cursor: pointer !important;
      box-shadow: 0 0 40px rgba(255, 0, 0, 1), 0 0 80px rgba(255, 170, 0, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3) !important;
      text-transform: uppercase !important;
      letter-spacing: 3px !important;
      z-index: 10000 !important;
      transition: all 0.3s !important;
      animation: briefcasePulse 2s infinite !important;
      line-height: 1.4 !important;
      text-align: center !important;
      pointer-events: auto !important;
    `;
    
    // Add pulse animation if not already added
    if (!document.getElementById('briefcase-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'briefcase-pulse-style';
      style.textContent = `
        @keyframes briefcasePulse {
          0%, 100% { 
            transform: translateX(-50%) scale(1) !important; 
            box-shadow: 0 0 40px rgba(255, 0, 0, 1), 0 0 80px rgba(255, 170, 0, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3) !important; 
          }
          50% { 
            transform: translateX(-50%) scale(1.08) !important; 
            box-shadow: 0 0 60px rgba(255, 0, 0, 1.2), 0 0 120px rgba(255, 170, 0, 1), inset 0 0 20px rgba(0, 0, 0, 0.3) !important; 
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    briefcaseBtn.onmouseover = () => {
      briefcaseBtn.style.transform = 'translateX(-50%) scale(1.15) !important';
      briefcaseBtn.style.boxShadow = '0 0 70px rgba(255, 0, 0, 1.3), 0 0 140px rgba(255, 170, 0, 1.1), inset 0 0 20px rgba(0, 0, 0, 0.3) !important';
    };
    briefcaseBtn.onmouseout = () => {
      briefcaseBtn.style.transform = 'translateX(-50%) scale(1) !important';
      briefcaseBtn.style.boxShadow = '0 0 40px rgba(255, 0, 0, 1), 0 0 80px rgba(255, 170, 0, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3) !important';
    };
    
    // Add button to overlay container
    const container = overlay.querySelector('.ultima-cup-container');
    if (container) {
      // Ensure container has relative positioning
      const containerStyle = window.getComputedStyle(container);
      if (containerStyle.position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(briefcaseBtn);
      
      // Store the button and overlay reference for later use
      overlay._briefcaseButton = briefcaseBtn;
      overlay._briefcaseReady = true;
      
      
      // Force a reflow to ensure button is visible
      void briefcaseBtn.offsetHeight;
    } else {
      console.error('[BRIEFCASE DEBUG] Could not find .ultima-cup-container to add button!');
    }
  }
}

// Helper: Reveal final score immediately (skip)
function revealFinalScore(result, overlay) {
  const scoreHome = overlay.querySelector('.score-home');
  const scoreAway = overlay.querySelector('.score-away');
  const minuteEl = overlay.querySelector('.quick-sim-minute');
  const logEl = overlay.querySelector('#quickSimLog');
  
  scoreHome.textContent = result.usGoals;
  scoreAway.textContent = result.themGoals;
  minuteEl.textContent = "FT";
  if (overlay._pitch) overlay._pitch.fulltime();
  
  // Add final score to log
  const homeTeam = getClubName();
  const awayTeam = currentOpponent()?.team || 'Opposition';
  addLogEntry(logEl, `Full-time: ${homeTeam} ${result.usGoals} – ${result.themGoals} ${awayTeam}`, null);
}

// Helper: Delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Quick simulate match with commentary in the log (not modal)
async function quickSimulateMatchWithLogCommentary() {
  // Check for Messi goalie fiasco
  if (S.messi_goalie_next_loss) {
    S.messi_goalie_next_loss = false;
    // (the 0–100 result is recorded by postMatchPhase like any other)
    S.morale = clamp(S.morale - 25, -100, 100);
    log('Result: LOSS (0–100). Board moves to remove you.');
    await triggerRemovalWorkaround('an egregious tactical fiasco (0–100)');
    render();
    return { winner: "them", usGoals: 0, themGoals: 100, score: "0-100" };
  }
  
  // Ensure strengths are computed
  if (!S?.preMatch?.ourStrength || !S?.preMatch?.oppStrength) {
    computePreMatchStrengthsAndOdds();
  }
  let our = S.preMatch.ourStrength, opp = S.preMatch.oppStrength;
  
  // Apply any one-match morale effects
  if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
  if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
  our = Math.max(10, Math.min(our, 200));
  opp = Math.max(10, Math.min(opp, 200));
  
  // Simulate goals using expected goals and Poisson distribution
  const [ourXG, oppXG] = expectedGoals(our, opp);
  let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);

  // If this is the Portsmouth replacement side after the bus crash,
  // it should be an absolute slaughter, not a coin‑flip.
  try {
    const oppName = (typeof currentOpponent === 'function' ? currentOpponent()?.team : '') || '';
    const oppLower = oppName.toLowerCase();
    const isPortsmouth =
      oppLower.includes('portsmouth') || oppLower.includes('pompey');
    const isReplacement =
      !!(S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));

    if (isPortsmouth && isReplacement) {
      // Guarantee a comfortable win and heavily favour a thrashing.
      if (gf <= ga) {
        // Minimum 4‑goal haul and at least a 3‑goal margin.
        gf = Math.max(4, ga + 3);
      }
      // Even if RNG gave us a small win, bump it up to a big scoreline.
      if (gf < 4) gf = 4;
      if (gf - ga < 3) {
        gf = ga + 3;
      }
      // Cap their goals so freak 4–4s don't happen against literal children.
      ga = Math.min(ga, 1);
    }
  } catch (_e) {
    // Fall back to normal RNG if anything unexpected happens.
  }
  if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
  if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
  if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
  const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");
  
  // Get player pools for both teams
  const ourPlayers = getOurSelectedFive();
  const oppPlayers = getOpponentPlayers();
  
  // Ensure we have actual player objects with names
  const ourPlayersWithNames = ourPlayers.filter(p => p && p.name);
  const oppPlayersWithNames = oppPlayers.filter(p => p && p.name);
  
  // Create match events
  const events = [];
  
  // Add our goals with player details
  for (let i = 0; i < gf; i++) {
    const t = 10 + Math.floor(Math.random() * 80);
    let scorerName = null;
    let assisterName = null;
    
    if (ourPlayersWithNames.length > 0) {
      const scorer = pick(ourPlayersWithNames);
      scorerName = scorer?.name;
      if (Math.random() < 0.6 && ourPlayersWithNames.length > 1) {
        const assister = pick(ourPlayersWithNames.filter(p => p.id !== scorer?.id));
        assisterName = assister?.name;
      }
    } else if (ourPlayers.length > 0) {
      const fallbackPlayer = pick(ourPlayers);
      scorerName = fallbackPlayer?.name || `Player ${i + 1}`;
    } else {
      scorerName = `Southampton Player ${i + 1}`;
    }
    
    events.push({ 
      t, 
      who: 'HOME', 
      kind: 'GOAL',
      scorer: scorerName,
      assister: assisterName,
      team: getClubName()
    });
  }
  
  // Check if Gaz is in the lineup and add own goal events
  const gazPlayer = ourPlayersWithNames.find(p => 
    p && (p.name && (p.name.toLowerCase().includes('gascoigne') || p.name.toLowerCase().includes('gazza'))) ||
    (S.season3 && S.season3.gaz_player_id && p.id === S.season3.gaz_player_id)
  );
  const gazInLineup = !!gazPlayer;
  
  let gazOwnGoals = 0;
  // If Gaz is in lineup, add own goal events (high chance if forced into first team)
  if (gazInLineup && S.season3 && S.season3.gaz_signed) {
    const ownGoalChance = S.season3.gaz_first_team_forced ? 0.6 : 0.3; // Higher chance if forced
    if (Math.random() < ownGoalChance) {
      const t = 15 + Math.floor(Math.random() * 70);
      gazOwnGoals = 1; // Track Gaz own goals separately
      events.push({
        t,
        who: 'AWAY',
        kind: 'OWN_GOAL',
        scorer: 'Paul Gascoigne',
        team: getClubName(),
        isGazOwnGoal: true
      });
    }
  }
  
  // Add opponent goals (excluding Gaz own goals which are added separately)
  for (let i = 0; i < ga; i++) {
    const t = 10 + Math.floor(Math.random() * 80);
    const scorer = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
    const assister = (Math.random() < 0.6 && oppPlayersWithNames.length > 1) 
      ? pick(oppPlayersWithNames.filter(p => p.id !== scorer?.id)) 
      : null;
    const oppTeam = currentOpponent()?.team || 'Opposition';
    events.push({ 
      t, 
      who: 'AWAY', 
      kind: 'GOAL',
      scorer: scorer?.name || (oppPlayers.length > 0 ? pick(oppPlayers).name : 'Opposition Player'),
      assister: assister?.name || null,
      team: oppTeam
    });
  }
  
  // Add Gaz-specific commentary events (drunkenness, unfitness, obesity) if in lineup
  if (gazInLineup && S.season3 && S.season3.gaz_signed) {
    const gazCommentaryChance = 0.4; // 40% chance per match
    if (Math.random() < gazCommentaryChance) {
      const t = 20 + Math.floor(Math.random() * 60);
      const commentaryTypes = ['DRUNK', 'UNFIT', 'OBESE', 'GENERAL_GAZ'];
      const type = pick(commentaryTypes);
      events.push({
        t,
        who: 'NEUTRAL',
        kind: 'GAZ_COMMENTARY',
        player: 'Paul Gascoigne',
        commentaryType: type,
        team: getClubName()
      });
    }
    
    // Add Gazza shenanigans (same as in _genMatchEvents - both drunk and sober quick sims)
    const shenaniganChance = 0.6; // 60% chance of at least one shenanigan
    if (Math.random() < shenaniganChance) {
      const shenaniganTypes = [
        'DRUNK', 'VODKA', 'EXPOSE', 'OWN_GOAL', 'SENT_OFF', 'ATTACK_FANS', 'FALL_ASLEEP'
      ];
      const numShenanigans = 1 + Math.floor(Math.random() * 3); // 1-3 shenanigans per match
      for (let i = 0; i < numShenanigans; i++) {
        const t = 15 + Math.floor(Math.random() * 70); // 15-85 minutes
        const shenaniganType = pick(shenaniganTypes);
        events.push({
          t,
          who: 'HOME',
          kind: 'GAZ_SHENANIGAN',
          player: 'Paul Gascoigne',
          team: getClubName(),
          shenaniganType: shenaniganType
        });
        // Track shenanigan own goals for final score calculation
        if (shenaniganType === 'OWN_GOAL') {
          gazOwnGoals++;
        }
      }
    }
  }
  
  // Add other events (shots, corners, fouls, cards)
  const totalEvents = Math.max(12, Math.floor((gf + ga) * 6) + 8);
  for (let i = 0; i < totalEvents; i++) {
    const t = 2 + Math.floor(Math.random() * 88);
    const eventTypes = ['SHOT', 'CORNER', 'FOUL', 'CARD'];
    const eventType = pick(eventTypes);
    const isHome = Math.random() < 0.5;
    const players = isHome ? ourPlayersWithNames : oppPlayersWithNames;
    const player = players.length > 0 ? pick(players) : null;
    
    events.push({
      t,
      who: isHome ? 'HOME' : 'AWAY',
      kind: eventType,
      player: player?.name || null,
      team: isHome ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition')
    });
  }
  
  // Add referee bias events if referee was bribed
  if (S.referee_bribed && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
    addRefereeBiasEvents(events, ourPlayersWithNames, oppPlayersWithNames);
  }
  
  // Add crazy drama events for Champions League and World Cup matches
  const isCupMatch = S.competition === 'champions_league' || S.competition === 'world_cup' || S.clActive || S.worldCupActive;
  if (isCupMatch) {
    // Add 3-6 crazy events throughout the match
    const numCrazyEvents = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numCrazyEvents; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // Between 10-90 minutes
      const eventType = Math.random();
      
      if (eventType < 0.25) {
        // Backflip (25% chance)
        const player = pick(ourPlayersWithNames.concat(oppPlayersWithNames).filter(p => p));
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_BACKFLIP',
          player: player?.name || 'A player',
          message: generateBackflipCommentary()
        });
      } else if (eventType < 0.50) {
        // Player fight (25% chance)
        const player1 = pick(ourPlayersWithNames.length > 0 ? ourPlayersWithNames : oppPlayersWithNames);
        const player2 = pick(oppPlayersWithNames.length > 0 ? oppPlayersWithNames : ourPlayersWithNames);
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_FIGHT',
          player: player1?.name || 'A player',
          player2: player2?.name || 'Another player',
          message: generatePlayerFightCommentary()
        });
      } else if (eventType < 0.70) {
        // Referee exposure (20% chance)
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_REF_EXPOSURE',
          message: generateRefereeExposureCommentary()
        });
      } else if (eventType < 0.90) {
        // Fan shooting (20% chance)
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_FAN_SHOOTING',
          message: generateFanShootingCommentary()
        });
      } else {
        // General drama (10% chance)
        const player = pick(ourPlayersWithNames.concat(oppPlayersWithNames).filter(p => p));
        events.push({
          t,
          who: 'NEUTRAL',
          kind: 'CRAZY_DRAMA',
          player: player?.name || 'A player',
          message: generateCrazyDramaCommentary()
        });
      }
    }
  }
  
  // Add match atmosphere / special Portsmouth replacement-team commentary events
  try {
    if (typeof addMatchAtmosphereCommentary === 'function') {
      addMatchAtmosphereCommentary(events);
    }
  } catch (_e) {}
  
  // Sort events by time
  events.sort((a, b) => a.t - b.t);
  
  // Store match events
  S.matchEvents = events;
  
  // Show kickoff
  log("Kickoff!");
  
  // Process events and show commentary in log
  let currentMinute = 0;
  for (const event of events) {
    const eventMinute = Math.floor(event.t);
    
    // Show minute markers periodically
    if (eventMinute > currentMinute && eventMinute % 10 === 0 && eventMinute > 0) {
      log(`${eventMinute}' - The match continues...`);
      currentMinute = eventMinute;
      
      // Process quick sim tick for special commentary (drunk, overweight, sex offender)
      // Always process ticks to show special commentary, not just when taunt mode is active
      await processQuickSimTick(eventMinute);
      
      // Add drunk manager commentary for World Cup matches
      if (S.isDrunk && S.competition === 'world_cup') {
        const oppName = S.matchContext?.team || currentOpponent()?.team || 'Opposition';
        const drunkComment = generateDrunkManagerCommentary(oppName);
        if (drunkComment && Math.random() < 0.4) { // 40% chance per 10-minute interval
          log(`${eventMinute}' - ${drunkComment}`);
        }
      }
    }
    
    // Generate and show commentary for this event
    let commentary = '';
    try {
      if (event.kind === 'OWN_GOAL' && event.isGazOwnGoal) {
        // Special Gaz own goal commentary
        const ownGoalLines = [
          `OWN GOAL! Paul Gascoigne has scored an own goal! He looks completely confused, staggering around the pitch.`,
          `OWN GOAL! Paul Gascoigne puts it in his own net! He's clearly drunk and can barely stand.`,
          `OWN GOAL! Paul Gascoigne scores past his own keeper! He's so unfit he can't even tell which end is which.`,
          `OWN GOAL! Paul Gascoigne has scored an own goal! The man is clearly struggling with his weight and fitness.`,
          `OWN GOAL! Paul Gascoigne puts it in his own net! He looks completely lost out there, like he's in a different world.`,
          `OWN GOAL! Paul Gascoigne scores an own goal! He's so drunk he's celebrating before realising his mistake.`,
          `OWN GOAL! Paul Gascoigne has scored an own goal! The man is clearly unfit and struggling with his obesity.`,
          `OWN GOAL! Paul Gascoigne puts it past his own keeper! He's so drunk he can barely see straight.`
        ];
        commentary = pick(ownGoalLines);
      } else if (event.kind === 'GAZ_COMMENTARY') {
        // Special Gaz commentary for drunkenness, unfitness, obesity
        if (event.commentaryType === 'DRUNK') {
          const drunkLines = [
            `Paul Gascoigne looks completely drunk out there. He's staggering around the pitch, barely able to stand.`,
            `Paul Gascoigne is clearly intoxicated. He's swaying as he runs, if you can call it running.`,
            `Paul Gascoigne looks like he's had one too many. He's struggling to keep his balance.`,
            `Paul Gascoigne is clearly drunk. He's stumbling around, completely out of it.`,
            `Paul Gascoigne looks absolutely hammered. He can barely walk, let alone play football.`
          ];
          commentary = pick(drunkLines);
        } else if (event.commentaryType === 'UNFIT') {
          const unfitLines = [
            `Paul Gascoigne is clearly unfit. He's gasping for breath after just a few minutes.`,
            `Paul Gascoigne looks completely out of shape. He's struggling to keep up with the pace.`,
            `Paul Gascoigne is clearly not match fit. He's already exhausted and we're barely into the game.`,
            `Paul Gascoigne looks like he hasn't trained in years. He's completely unfit.`,
            `Paul Gascoigne is clearly unfit. He's wheezing and struggling to move.`
          ];
          commentary = pick(unfitLines);
        } else if (event.commentaryType === 'OBESE') {
          const obeseLines = [
            `Paul Gascoigne is clearly struggling with his weight. He's carrying far too much to be effective.`,
            `Paul Gascoigne looks obese out there. He's so overweight he can barely move.`,
            `Paul Gascoigne is clearly carrying too much weight. His obesity is affecting his performance.`,
            `Paul Gascoigne looks completely out of shape. His weight is clearly a major issue.`,
            `Paul Gascoigne is clearly obese. He's struggling to move around the pitch.`
          ];
          commentary = pick(obeseLines);
        } else {
          const generalLines = [
            `Paul Gascoigne looks completely lost out there. He's clearly not the player he once was.`,
            `Paul Gascoigne is struggling. He looks confused and out of his depth.`,
            `Paul Gascoigne looks like he doesn't know what he's doing. He's completely out of his element.`,
            `Paul Gascoigne is having a nightmare. He looks completely out of place.`,
            `Paul Gascoigne looks like he's in a different world. He's completely disconnected from the game.`
          ];
          commentary = pick(generalLines);
        }
      } else if (event.kind === 'GAZ_SHENANIGAN') {
        // Handle Gazza shenanigans
        const shenaniganType = event.shenaniganType || 'DRUNK';
        switch(shenaniganType) {
          case 'DRUNK':
            commentary = `Paul Gascoigne appears to be completely drunk on the pitch! He's stumbling around, barely able to stand!`;
            break;
          case 'VODKA':
            commentary = `INCREDIBLE! Paul Gascoigne has pulled out a bottle of vodka and is drinking it on the pitch! The referee is looking the other way!`;
            break;
          case 'EXPOSE':
            commentary = `OH MY GOD! Paul Gascoigne has exposed himself to the crowd! This is absolutely disgraceful!`;
            break;
          case 'OWN_GOAL':
            commentary = `OWN GOAL! Paul Gascoigne has scored an own goal! He's celebrating, thinking it's for the opposition!`;
            ga++;
            break;
          case 'SENT_OFF':
            commentary = `RED CARD! Paul Gascoigne has been sent off! He's arguing with the referee, completely out of control!`;
            break;
          case 'ATTACK_FANS':
            commentary = `DISGRACEFUL! Paul Gascoigne has left the pitch and is attacking fans in the stands! Security are trying to restrain him!`;
            break;
          case 'FALL_ASLEEP':
            commentary = `UNBELIEVABLE! Paul Gascoigne has fallen asleep on the pitch! He's lying in the centre circle, completely passed out!`;
            break;
          default:
            commentary = `Paul Gascoigne is causing chaos on the pitch!`;
        }
      } else if (event.kind === 'GOAL') {
        commentary = generateGoalCommentary(event);
      } else if (event.kind === 'SHOT') {
        commentary = generateShotCommentary(event);
      } else if (event.kind === 'CORNER') {
        commentary = generateCornerCommentary(event);
      } else if (event.kind === 'FOUL') {
        commentary = generateFoulCommentary(event);
      } else if (event.kind === 'CARD') {
        if (event.cardType === 'RED') {
          commentary = generateDodgyRedCardCommentary(event);
        } else {
          commentary = generateYellowCardCommentary(event);
        }
      } else if (event.kind === 'DODGY_PENALTY') {
        commentary = generateDodgyPenaltyCommentary(event);
      } else if (event.kind === 'DODGY_RED_CARD') {
        commentary = generateDodgyRedCardCommentary(event);
      } else if (event.kind === 'EARLY_FINAL_WHISTLE') {
        commentary = generateEarlyFinalWhistleCommentary(event);
      } else if (event.kind === 'ATMOSPHERE') {
        // Handle atmosphere events (including explosion commentary)
        commentary = event.message || '';
      } else if (event.kind === 'CRAZY_BACKFLIP' || event.kind === 'CRAZY_FIGHT' || 
                 event.kind === 'CRAZY_REF_EXPOSURE' || event.kind === 'CRAZY_FAN_SHOOTING' || 
                 event.kind === 'CRAZY_DRAMA') {
        // Use pre-generated message for crazy events
        commentary = event.message || '';
      }
    } catch (e) {
      console.warn('Error generating commentary:', e);
    }
    
    if (commentary && typeof commentary === 'string') {
      log(`${eventMinute}' - ${commentary}`);
    }
    
    // Handle penalty goal conversion (80% chance)
    if (event.kind === 'DODGY_PENALTY' && Math.random() < 0.8) {
      const goalEvent = {
        t: event.t + 0.1,
        who: event.who,
        kind: 'GOAL',
        scorer: event.player,
        assister: null,
        team: event.team,
        isFromPenalty: true
      };
      
      const goalCommentary = generateGoalCommentary(goalEvent);
      log(`${eventMinute}' - ⚽ ${goalCommentary} (Penalty)`);
      
      // Update goal counts
      if (event.who === 'HOME') {
        gf++;
      } else {
        ga++;
      }
    }
    
    // If EARLY_FINAL_WHISTLE occurred, end the match early
    if (event.kind === 'EARLY_FINAL_WHISTLE') {
      break; // Break out of event loop to end match early
    }
    
    // Add referee bribe commentary periodically if referee was bribed
    if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
      const changedMinute = (eventMinute !== (window._lastBribeLineAtMinute || -999));
      const shouldFire = changedMinute && (Math.random() < 0.12) && eventMinute > 5 && eventMinute < 88;
      
      if (shouldFire) {
        const oppTeam = currentOpponent()?.team || 'Opposition';
        const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
        const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';
        const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
        const line = pick(pool)
          .replaceAll('{FAV}', favName)
          .replaceAll('{OPP}', oppName);
        log(`${eventMinute}' - ${line}`);
        window._lastBribeLineAtMinute = eventMinute;
      }
    }
    
    // Add drunk manager commentary after events for World Cup matches
    if (S.isDrunk && S.competition === 'world_cup' && Math.random() < 0.3) {
      const oppName = S.matchContext?.team || currentOpponent()?.team || 'Opposition';
      const drunkComment = generateDrunkManagerCommentary(oppName);
      if (drunkComment) {
        log(`${eventMinute}' - ${drunkComment}`);
      }
    }
    
    // Process quick sim tick after each event for special commentary (drunk, overweight, sex offender)
    // Always process ticks to show special commentary, not just when taunt mode is active
    if (eventMinute > currentMinute) {
      await processQuickSimTick(eventMinute);
      // Small delay to make commentary readable
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Full-time result is logged in postMatchPhase, so we don't duplicate it here
  
  // Check if this is the stadium fire match and add terrorism commentary
  if (S.preMatch?.stadium_burn_triggered) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    log(`💥 SUDDENLY: Flames erupt from the stadium!`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    log(`🔥 The ground shakes as explosions rock St Mary's!`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    log(`🚨 EMERGENCY: The stadium has been attacked by terrorists!`);
  }
  
  // Add own goals to the opposition's total
  const finalGa = ga + gazOwnGoals;
  
  // Recalculate winner with own goals included
  const finalWinner = gf > finalGa ? "us" : (gf < finalGa ? "them" : "draw");
  
  // Morale swing (W/D/L and points are recorded by postMatchPhase via the table)
  if (finalWinner === "us") {
    S.morale = clamp(S.morale + 4, -100, 100);
  } else if (finalWinner === "them") {
    S.morale = clamp(S.morale - 6, -100, 100);
  }
  
  return { winner: finalWinner, usGoals: gf, themGoals: finalGa, score: `${gf}-${finalGa}` };
}

// ---- Settle the user's pre-match bet after the result is known ----
// Call this AFTER each match result is known
// resultKey should be "us" | "them" | "draw"  (your engine),
// but we also accept "home" | "away" | "draw" just in case.
function resolveActiveBet(resultKey){
  const bet = S.preMatch?.bet;
  if(!bet) {
    return;
  }


  // Normalize keys so UI markets and engine result agree
  const map = { 
    'us': 'home', 
    'them': 'away', 
    'draw': 'draw', 
    'home': 'home', 
    'away': 'away' 
  };
  
  // Ensure we're working with clean string values
  const betOutcome = String(bet.outcome || '').toLowerCase().trim();
  const resultKeyNorm = String(resultKey || '').toLowerCase().trim();
  
  const placed = map[betOutcome] || betOutcome;      // what the player chose
  const actual = map[resultKeyNorm] || resultKeyNorm;        // what actually happened


  if (placed === actual){
    const winnings = Math.floor(bet.stake * bet.odds);
    const cashBefore = S.chairman_cash || 0;
    S.chairman_cash = cashBefore + winnings;
    log(`✓ Bet WON! Payout: £${winnings.toLocaleString('en-GB')}. (Cash: £${cashBefore.toLocaleString('en-GB')} → £${S.chairman_cash.toLocaleString('en-GB')})`);
  } else {
    log(`✗ Bet lost. (Bet on ${bet.outcome}, result was ${resultKey})`);
  }

  // clear bet for next match
  if (S.preMatch) {
    S.preMatch.bet = null;
    S.preMatch.betLocked = false;
  }
  S.bet_locked_this_prematch = false;
  render();
}

function applyResultToTable(ourTeam, oppTeam, ourGoals, oppGoals){
  if (!S.table) ensureLeagueTableInit();
  // Ensure both teams have table entries before recording
  ensureTableTeam(ourTeam);
  ensureTableTeam(oppTeam);
  const A = S.table[ourTeam]  || (S.table[ourTeam]={P:0,W:0,D:0,L:0,GF:0,GA:0,GD:0,PTS:0});
  const B = S.table[oppTeam]  || (S.table[oppTeam]={P:0,W:0,D:0,L:0,GF:0,GA:0,GD:0,PTS:0});

  
  A.P++; B.P++;
  A.GF += ourGoals;  A.GA += oppGoals;
  B.GF += oppGoals;  B.GA += ourGoals;
  A.GD = A.GF - A.GA;
  B.GD = B.GF - B.GA;

  if (ourGoals > oppGoals){ A.W++; A.PTS+=3; B.L++; }
  else if (ourGoals < oppGoals){ B.W++; B.PTS+=3; A.L++; }
  else { A.D++; B.D++; A.PTS+=1; B.PTS+=1; }
  
  
  // Sync S.points, S.wins, S.draws, S.losses with league table for current club
  // Use getClubName() to ensure we get the correct club name (handles renaming)
  const clubName = (typeof getClubName === 'function') ? getClubName() : (S.club_name || "Southampton FC");
  
  // Check if ourTeam matches clubName OR if ourTeam is in the table and matches current club
  if ((ourTeam === clubName || ourTeam === (S.club_name || "Southampton FC")) && S.table[ourTeam]) {
    const tableEntry = S.table[ourTeam];
    S.points = tableEntry.PTS;
    S.wins = tableEntry.W;
    S.draws = tableEntry.D;
    S.losses = tableEntry.L;
  } else {
  }
}


if (typeof window.isHomeToday !== 'function') {
  window.isHomeToday = function(){
    try{
      const SOUTH = (S?.club_name) || "Southampton FC";
      // We’re in post-match: look at the round we just completed
      const idx = Math.max(0, ((S?.matches_played|0) - 1));
      const r = S?.rounds?.[idx];
      const fx = Array.isArray(r?.[0]) ? r[0] : [SOUTH, (S?.opponents?.[idx]||"Opponent")];
      return fx[0] === SOUTH;
    } catch(_) {
      return true; // safe default so you see revenue lines during testing
    }
  };
}

// --- Post-match: record result, settle bets, advance round ---
// Public postMatchPhase(): marks the phase, runs it, then emits 'postmatch:end'.
async function postMatchPhase(...args){
  setPhase('postmatch');
  const result = await runPostMatchPhase.apply(this, args);
  GameHooks.emit('postmatch:end', result);
  return result;
}

async function runPostMatchPhase(outcome){
  
  // Process post-match drug effects (cocaine dependency, doping scandals)
  if (typeof processPostMatchDrugEffects === 'function') {
    await processPostMatchDrugEffects();
  }
  // 0) Single source of truth for which round/opponent we just played
  const roundIndex =
    (S && S.matchContext && typeof S.matchContext.roundIndex === 'number')
      ? S.matchContext.roundIndex
      : (S.matches_played|0); // not yet incremented: the round being played

  const oppName =
    (S && S.matchContext && S.matchContext.team)
      ? S.matchContext.team
      : (Array.isArray(S.opponents) && S.opponents[roundIndex]) 
        ? S.opponents[roundIndex]
        : "Opponent";

  // 1) Normalize goal fields (watch + quick-sim)
  const gf =
    (typeof outcome?.our_goals === 'number')     ? outcome.our_goals     :
    (typeof outcome?.usGoals === 'number')       ? outcome.usGoals       :
    (typeof outcome?.goalsFor === 'number')      ? outcome.goalsFor      :
    (typeof outcome?.gf === 'number')            ? outcome.gf            : 0;

  const ga =
    (typeof outcome?.their_goals === 'number')   ? outcome.their_goals   :
    (typeof outcome?.themGoals === 'number')     ? outcome.themGoals     :
    (typeof outcome?.goalsAgainst === 'number')  ? outcome.goalsAgainst  :
    (typeof outcome?.ga === 'number')            ? outcome.ga            : 0;

  // Apply persistent injuries, suspensions and rare cocaine heart attacks
  const eventsForPostMatch = Array.isArray(S?.matchEvents) ? S.matchEvents : [];
  // Tick down existing injuries/bans from previous matches
  tickDownInjuriesAndSuspensions();
  // Apply new injuries and red-card bans from this match
  applyPostMatchInjuriesAndSuspensions(eventsForPostMatch);
  // Rare cocaine-related heart attack outcomes (uses cocaine + aggression state)
  maybeTriggerCocaineHeartAttacks(eventsForPostMatch);

  // 2) Result key for betting
  let resultKey = 'draw';
  if (gf > ga) resultKey = 'us';
  else if (ga > gf) resultKey = 'them';

  // 3) Announce explicitly
  log(`Full-time: ${getClubName()} ${gf}–${ga} ${oppName}.`);
  // Explicit debug breadcrumb so we know this post-match phase actually ran
  
  // Handle press conference after bus crash (after match, so you can bask in glory)
  const busCrashPressConf =
    (typeof window !== 'undefined' && typeof window.handlePressConferenceAfterBusCrash === 'function')
      ? window.handlePressConferenceAfterBusCrash
      : null;
  if (S.pending_press_conference_after_match && busCrashPressConf) {
    S.pending_press_conference_after_match = false;
    await new Promise(resolve => setTimeout(resolve, 1000));
    await busCrashPressConf();
  }
  
  // Handle suicide threat resignation (after match ends - ensure it only happens here)
  // This must happen AFTER the full-time announcement, not during the match
  if (S.pending_suicide_threat_resignation) {
    S.pending_suicide_threat_resignation = false;
    // Wait a moment after full-time before triggering resignation
    await new Promise(resolve => setTimeout(resolve, 1000));
    await handleSuicideThreatResignation();
  }
  
  // Trigger rival event if lost (especially to Portsmouth or heavily)
  if (ga > gf && typeof triggerRivalEvent === 'function') {
    const isPortsmouth = oppName === 'Portsmouth' || oppName.includes('Portsmouth') || oppName === 'Burger King FC' || oppName.includes('Burger King');
    const isDerby = isPortsmouth; // Portsmouth/Burger King FC is the main derby rival
    const goalDiff = ga - gf;
    
    triggerRivalEvent(isDerby ? 'derby_loss' : 'lost_match', {
      opponent: oppName,
      scoreline: { ourGoals: gf, theirGoals: ga },
      isDerby: isDerby,
      goalDifference: goalDiff,
      competitionImportance: 'league' // Could be 'cup' or 'league'
    });
  }
  
  // Season 4 & 5: Random vile messages from Delmor about daughter/wife
  // Note: This is a backup - main logic is in checkPhoneEvents() function
  if ((S.season === 4 || S.season === 5) && S.season4 && S.season4.daughter_left_home) {
    // 40% chance after each match to get a vile message (backup if checkPhoneEvents doesn't trigger)
    if (Math.random() < 0.4) {
      const messageType = Math.random();
      let message = '';
      
      if (messageType < 0.5 && typeof RIVAL_SEASON4_5_DAUGHTER_MESSAGES !== 'undefined' && RIVAL_SEASON4_5_DAUGHTER_MESSAGES && RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length > 0) {
        // Daughter message
        message = RIVAL_SEASON4_5_DAUGHTER_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_DAUGHTER_MESSAGES.length)];
      } else if (typeof RIVAL_SEASON4_5_WIFE_MESSAGES !== 'undefined' && RIVAL_SEASON4_5_WIFE_MESSAGES && RIVAL_SEASON4_5_WIFE_MESSAGES.length > 0) {
        // Wife message
        message = RIVAL_SEASON4_5_WIFE_MESSAGES[Math.floor(Math.random() * RIVAL_SEASON4_5_WIFE_MESSAGES.length)];
      }
      
      if (message) {
        // Show as popup immediately
        if (typeof showRivalTextPopup === 'function') {
          showRivalTextPopup(message);
        } else if (typeof queueIncomingText === 'function') {
          queueIncomingText('delmor_krunchem', message, 'malicious');
        } else if (typeof window.sendRivalText === 'function') {
          window.sendRivalText(message);
        } else if (typeof window.enqueueRivalText === 'function') {
          window.enqueueRivalText(message);
        } else {
          log(`📱 Delmor Krunchem: "${message}"`);
        }
      }
    }
  }
  
try {
  // Determine home from schedule
  const SOUTH = (typeof getClubName === 'function') ? getClubName() : (S?.club_name || "Southampton FC");
  let wasHome = true;
  try {
    const roundIndex =
      (S && S.matchContext && typeof S.matchContext.roundIndex === 'number')
        ? S.matchContext.roundIndex
        : (S.matches_played|0); // not yet incremented: the round being played
    const fixture = Array.isArray(S.rounds?.[roundIndex]?.[0])
      ? S.rounds[roundIndex][0]
      : [SOUTH, oppName];
    wasHome = (fixture[0] === SOUTH);
  } catch(_) { wasHome = true; }

  // Attendance & gate revenue (home only)
  if (wasHome) {
    // Ensure stadium system is initialized before processing revenue
    if (!S.stadium) {
      S.stadium = {
        capacity: 32000,
        quality: 60,
        safety: 80,
        ticket_price: 40,
        upkeep_per_match: 5000,
        active_project: null,
        construction_progress: 0,
        construction_delays: 0,
        construction_overrun: 0,
        last_home_attendance: 0,
        utilization_percent: 0
      };
    }
    processHomeMatchRevenue();
  }

  // Fan morale delta (Win +3, Loss −5, Draw +1)
  if (gf > ga)       S.fan_morale = Math.min(100,(S.fan_morale|0) + 3);
  else if (ga > gf)  S.fan_morale = Math.max(0,(S.fan_morale|0) - 5);
  else               S.fan_morale = Math.min(100,(S.fan_morale|0) + 1);

  // Process stadium dealing results
  if (typeof processStadiumDealingResults === 'function') {
    await processStadiumDealingResults();
  }

  // Check for stadium collapse
  if (typeof checkStadiumCollapse === 'function') {
    checkStadiumCollapse();
  }

  if (typeof updateHUD === 'function') updateHUD();
} catch(e) {
  console.error("[4A] post-match finance/morale error:", e);
}
// Determine home/away context for narrative + bribery systems (this round's fixture)
const wasHome = (() => { try { const fx = S.rounds?.[roundIndex]?.[0]; return Array.isArray(fx) ? fx[0] === getClubName() : true; } catch(_) { return true; } })();

// Narrative-only: Southampton Women's Team omnipresent subsystem
try {
  if (typeof window.womensTeamNarrativeTick === 'function' && (!S.womens_team || !S.womens_team.liquidated)) {
    window.womensTeamNarrativeTick({
      gf,
      ga,
      wasHome
    });
  }
} catch (e) {
  console.error('[WomenNarrative] Error in womensTeamNarrativeTick:', e);
}

// Process cronster events during matches
if (typeof processCronsterEvents === 'function') {
  await processCronsterEvents();
}
