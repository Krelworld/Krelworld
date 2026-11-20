// ========== ULTIMA CUP QUICK SIMULATE ==========
async function quickSimulateUltimaCup() {
  // Compute result immediately
  const result = computeUltimaCupResult();
  
  // Store match events
  S.matchEvents = result.events;
  
  // Get team names
  const ourTeam = getClubName();
  const portsmouthTeam = 'Portsmouth';
  const legendsTeam = 'Legends FC';
  const ultimaTeam = 'Ultima FC';
  
  // Create luxurious overlay UI
  const overlay = createUltimaCupOverlay(ourTeam, portsmouthTeam, legendsTeam, ultimaTeam);
  document.body.appendChild(overlay);
  
  // Reveal events over time
  const skipState = { requested: false };
  const skipBtn = overlay.querySelector('.ultima-cup-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => { 
      skipState.requested = true;
      skipBtn.disabled = true;
      skipBtn.textContent = 'Skipping...';
    });
  }
  
  // Flag to track if briefcase button was clicked
  let briefcaseButtonClicked = false;
  let briefcaseButtonResolve = null;
  
  try {
    await revealUltimaCupEvents(result, overlay, skipState);
    
    // Check if briefcase button was added
    const briefcaseBtn = overlay.querySelector('#ultima-briefcase-advance-btn');
    if (briefcaseBtn) {
      
      // Create promise that resolves when button is clicked
      const briefcaseButtonPromise = new Promise((resolve) => {
        briefcaseButtonResolve = resolve;
        
        briefcaseBtn.addEventListener('click', async () => {
          briefcaseButtonClicked = true;
          
          // Remove overlay
          if (overlay.parentElement) {
            overlay.remove();
          }
          
          // Resolve to continue to briefcase UI
          resolve();
        });
      });
      
      // Wait for button click (with a very long timeout as fallback - user should click the button)
      await Promise.race([
        briefcaseButtonPromise,
        new Promise(resolve => setTimeout(() => {
          resolve();
        }, 600000)) // 10 minute timeout as fallback
      ]);
      
      if (briefcaseButtonClicked) {
        // Overlay already removed by button handler
        // Create outcome object and call briefcase UI
        const outcome = {
          usGoals: result.usGoals,
          portsmouthGoals: result.portsmouthGoals,
          legendsGoals: result.legendsGoals,
          ultimaGoals: result.ultimaGoals,
          winner: result.winner
        };
        await showUltimaCupVictoryUIBombPath(outcome);
        return outcome;
      }
    }
  } finally {
    // Only remove overlay if briefcase button wasn't clicked
    if (!briefcaseButtonClicked && overlay.parentElement) {
      overlay.remove();
    }
  }
  
  // Show full-time in main log
  log(`Full-time: ${ourTeam} ${result.usGoals} – ${portsmouthTeam} ${result.portsmouthGoals} – ${legendsTeam} ${result.legendsGoals} – ${ultimaTeam} ${result.ultimaGoals}`);
  
  const matchResult = { 
    winner: result.winner, 
    usGoals: result.usGoals, 
    portsmouthGoals: result.portsmouthGoals,
    legendsGoals: result.legendsGoals,
    ultimaGoals: result.ultimaGoals
  };
  
  // Check if there's a draw - trigger penalty shootout
  if (result.winner === 'draw') {
    // Determine which team(s) are tied for first
    const scores = [
      { team: 'us', name: getClubName(), goals: result.usGoals },
      { team: 'portsmouth', name: 'Portsmouth', goals: result.portsmouthGoals },
      { team: 'legends', name: 'Legends FC', goals: result.legendsGoals },
      { team: 'ultima', name: 'Ultima FC', goals: result.ultimaGoals }
    ];
    scores.sort((a, b) => b.goals - a.goals);
    const topScore = scores[0].goals;
    const tiedTeams = scores.filter(s => s.goals === topScore);
    
    // Determine opponent for penalty shootout
    let opponentName = 'Delmor Krunchem';
    let opponentTeam = 'Portsmouth';
    
    // Check if tied with Ultima FC or Legends FC
    const tiedWithUltima = tiedTeams.some(t => t.team === 'ultima');
    const tiedWithLegends = tiedTeams.some(t => t.team === 'legends');
    
    if (tiedWithUltima || tiedWithLegends) {
      opponentName = 'Mohammed van Onslaught';
      opponentTeam = tiedWithUltima ? 'Ultima FC' : 'Legends FC';
    } else if (tiedTeams.some(t => t.team === 'portsmouth')) {
      opponentName = 'Delmor Krunchem';
      opponentTeam = 'Portsmouth';
    }
    
    // Check if player is tied (if not, it's between other teams)
    const playerTied = tiedTeams.some(t => t.team === 'us');
    
    if (playerTied) {
      log('');
      log(`<div style="padding:20px;background:rgba(200,200,0,0.2);border:2px solid #ff0;border-radius:10px;margin:20px 0;">
        <p style="text-align:center;color:#ff0;font-size:1.2rem;font-weight:bold;">🏆 The match ends in a draw! The Ultima Cup will be decided by a penalty shootout.</p>
        <p style="text-align:center;color:#fff;font-size:1.1rem;margin-top:10px;">${opponentName} will face you in the penalty shootout.</p>
      </div>`);
      await delay(3000);
      
      // Trigger penalty minigame with the correct opponent
      const penaltyWinner = await playPenaltyMinigame(opponentName, opponentTeam);
      
      // Update matchResult based on penalty result
      if (penaltyWinner === 'us') {
        matchResult.winner = 'us';
        log('');
        log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(0,100,0,0.3),rgba(0,50,0,0.2));border:5px solid #00cc00;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(0,200,0,0.6);">
          <p style="font-size:2rem;color:#00ff00;line-height:2;text-align:center;font-weight:bold;">
            🏆 ${getClubName()} WINS THE ULTIMA CUP ON PENALTIES! 🏆
          </p>
        </div>`);
      } else {
        if (opponentTeam === 'Portsmouth') {
          matchResult.winner = 'portsmouth';
        } else if (opponentTeam === 'Legends FC') {
          matchResult.winner = 'legends';
        } else if (opponentTeam === 'Ultima FC') {
          matchResult.winner = 'ultima';
        }
        log('');
        log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(200,0,0,0.3),rgba(100,0,0,0.2));border:5px solid #cc0000;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(200,0,0,0.6);">
          <p style="font-size:2rem;color:#ff4444;line-height:2;text-align:center;font-weight:bold;">
            ${opponentTeam} win the Ultima Cup on penalties.
          </p>
        </div>`);
      }
    } else {
      // Player not in the tie - other teams will play penalties
      log('');
      log(`<div style="padding:20px;background:rgba(200,200,0,0.2);border:2px solid #ff0;border-radius:10px;margin:20px 0;">
        <p style="text-align:center;color:#ff0;font-size:1.2rem;font-weight:bold;">🏆 The match ends in a draw between ${tiedTeams.map(t => t.name).join(' and ')}. They will play a penalty shootout.</p>
      </div>`);
      await delay(2000);
      // For now, just continue - the winner will be determined by the penalty shootout
      // This case is less common, but we handle it
    }
  }
  
  // Check if Southampton won - if so, trigger Mohammed van onslaught sequence
  if (matchResult.winner === 'us' && result.usGoals > result.portsmouthGoals) {
    const updatedResult = await handleMohammedVanOnslaughtSequence(matchResult);
    // Update matchResult with the result from penalty shootout
    if (updatedResult) {
      matchResult.winner = updatedResult.winner;
      matchResult.portsmouthGoals = updatedResult.portsmouthGoals;
    }
  }
  
  
  // Check if player has briefcase AND armed players - both are required for briefcase UI
  const briefcaseValue = S.power_briefcase_owned;
  const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
  
  // Ensure ultimaCup object exists
  if (!S.ultimaCup) S.ultimaCup = {};
  
  // Check for armed players - handle both boolean and string values
  const playersArmedValue = S.ultimaCup.players_armed;
  const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
  
  
  if (hasBriefcase && hasArmedPlayers) {
    // Convert matchResult to outcome format expected by bomb path
    const outcome = {
      usGoals: matchResult.usGoals,
      portsmouthGoals: matchResult.portsmouthGoals,
      legendsGoals: matchResult.legendsGoals,
      ultimaGoals: matchResult.ultimaGoals,
      winner: matchResult.winner
    };
    await showUltimaCupVictoryUIBombPath(outcome);
  } else {
    // Show normal victory UI
    await showUltimaCupVictoryUI(matchResult);
  }
  
  
  return matchResult;
}

// ========== PENALTY MINIGAMES ==========
// playPenaltyMinigame / playWorldCupPenalties are defined by src/087d-mg-penalties.js (MGKit swipe shootout).

// ========== COMPUTE ULTIMA CUP RESULT ==========
function computeUltimaCupResult() {
  // Get team strengths
  const ourStrength = teamStrength() || 50;
  const portsmouthStrength = 85 + Math.floor(Math.random() * 15); // 85-100
  const legendsStrength = 95 + Math.floor(Math.random() * 5); // 95-100 (Messi, Ronaldo, etc.)
  const ultimaStrength = 98 + Math.floor(Math.random() * 2); // 98-100 (Pele, Maradona, etc.)
  
  // Generate events for the 4-team, 2-ball match
  const events = generateUltimaCupEvents(ourStrength, portsmouthStrength, legendsStrength, ultimaStrength);
  
  // Count goals for each team
  let usGoals = 0, portsmouthGoals = 0, legendsGoals = 0, ultimaGoals = 0;
  for (const ev of events) {
    if (ev.kind === 'GOAL') {
      if (ev.team === 'us') usGoals++;
      else if (ev.team === 'portsmouth') portsmouthGoals++;
      else if (ev.team === 'legends') legendsGoals++;
      else if (ev.team === 'ultima') ultimaGoals++;
    }
  }
  
  // Determine winner (team with most goals)
  const scores = [
    { team: 'us', goals: usGoals },
    { team: 'portsmouth', goals: portsmouthGoals },
    { team: 'legends', goals: legendsGoals },
    { team: 'ultima', goals: ultimaGoals }
  ];
  scores.sort((a, b) => b.goals - a.goals);
  const winner = scores[0].goals > scores[1].goals ? scores[0].team : 'draw';
  
  return { 
    winner, 
    usGoals, 
    portsmouthGoals, 
    legendsGoals, 
    ultimaGoals, 
    events, 
    isSpecial: false 
  };
}

// ========== MOHAMMED VAN ONSLAUGHT SEQUENCE ==========
async function handleMohammedVanOnslaughtSequence(matchResult) {
  await delay(2000);
  
  // Create separate UI overlay for VAR sequence (not in modal log)
  const varOverlay = document.createElement('div');
  varOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 25000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    overflow-y: auto;
  `;
  
  const varContainer = document.createElement('div');
  varContainer.style.cssText = `
    max-width: 800px;
    width: 100%;
    text-align: center;
    color: #fff;
  `;
  
  varOverlay.appendChild(varContainer);
  document.body.appendChild(varOverlay);
  
  // Add fadeIn animation if not already present
  if (!document.getElementById('var-overlay-fadein-style')) {
    const style = document.createElement('style');
    style.id = 'var-overlay-fadein-style';
    style.textContent = `
      @keyframes varFadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  function addVarMessage(html) {
    const msg = document.createElement('div');
    msg.style.cssText = `
      padding: 30px;
      background: linear-gradient(135deg, rgba(200,0,0,0.3), rgba(100,0,0,0.2));
      border: 3px solid #cc0000;
      border-radius: 15px;
      margin: 20px 0;
      box-shadow: 0 0 20px rgba(200,0,0,0.4);
      animation: varFadeIn 0.5s ease-out;
    `;
    msg.innerHTML = html;
    varContainer.appendChild(msg);
    // Scroll to bottom
    varOverlay.scrollTop = varOverlay.scrollHeight;
  }
  
  addVarMessage(`
    <p style="font-size:1.3rem;color:#fff;line-height:1.8;text-align:center;">
      The crowd is celebrating. The trophy is being prepared. But then...
    </p>
  `);
  await delay(3000);
  
  addVarMessage(`
    <p style="font-size:1.5rem;color:#ff4444;line-height:2;text-align:center;font-weight:bold;">
      Mohammed van Onslaught storms onto the pitch!
    </p>
  `);
  await delay(2000);
  
  addVarMessage(`
    <p style="font-size:1.2rem;color:#fff;line-height:1.8;font-style:italic;text-align:center;">
      "This isn't fair."
    </p>
  `);
  await delay(2000);
  
  addVarMessage(`
    <p style="font-size:1.2rem;color:#fff;line-height:1.8;text-align:center;">
      Mohammed van Onslaught addresses the stadium:
    </p>
    <p style="font-size:1.1rem;color:#ff6666;line-height:1.8;margin-top:15px;text-align:center;">
      "I've just been in the VAR room. Southampton have been cheating. This cannot stand."
    </p>
  `);
  await delay(3000);
  
  // Calculate how many goals Portsmouth need to draw
  const goalsNeeded = matchResult.usGoals - matchResult.portsmouthGoals;
  
  addVarMessage(`
    <p style="font-size:1.2rem;color:#ff6666;line-height:1.8;text-align:center;font-weight:bold;">
      "I am awarding Portsmouth ${goalsNeeded} goal${goalsNeeded !== 1 ? 's' : ''} to make this fair."
    </p>
  `);
  await delay(3000);
  
  // Update the score
  matchResult.portsmouthGoals += goalsNeeded;
  matchResult.winner = 'draw';
  
  addVarMessage(`
    <p style="font-size:1.3rem;color:#fff;line-height:1.8;text-align:center;font-weight:bold;">
      The score is now: ${getClubName()} ${matchResult.usGoals} – ${matchResult.portsmouthGoals} Portsmouth
    </p>
  `);
  await delay(2000);
  
  addVarMessage(`
    <p style="font-size:1.2rem;color:#ff6666;line-height:1.8;text-align:center;">
      "The game is going to penalties. And the only fair way to do it..."
    </p>
    <p style="font-size:1.2rem;color:#ff6666;line-height:1.8;margin-top:15px;text-align:center;font-weight:bold;">
      "...is to have the penalties contested by the chairmen of the respective clubs."
    </p>
    <p style="font-size:1.1rem;color:#fff;line-height:1.8;margin-top:15px;text-align:center;">
      "Delmor Krunchem, and you."
    </p>
  `);
  await delay(3000);
  
  // Add continue button
  const continueBtn = document.createElement('button');
  continueBtn.textContent = 'Continue';
  continueBtn.style.cssText = `
    margin-top: 30px;
    padding: 15px 40px;
    font-size: 1.3rem;
    background: linear-gradient(135deg, #cc0000, #8b0000);
    color: #fff;
    border: 3px solid #ff4444;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
    transition: all 0.3s;
  `;
  continueBtn.onmouseover = () => {
    continueBtn.style.transform = 'scale(1.05)';
    continueBtn.style.boxShadow = '0 0 30px rgba(255, 68, 68, 0.8)';
  };
  continueBtn.onmouseout = () => {
    continueBtn.style.transform = 'scale(1)';
    continueBtn.style.boxShadow = '0 0 20px rgba(255, 68, 68, 0.5)';
  };
  
  await new Promise((resolve) => {
    continueBtn.onclick = () => {
      varOverlay.remove();
      resolve();
    };
    varContainer.appendChild(continueBtn);
  });
  
  // Trigger penalty minigame
  const penaltyWinner = await playPenaltyMinigame();
  
  // Update match result based on penalty winner
  if (penaltyWinner === 'us') {
    matchResult.winner = 'us';
    log('');
    log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(0,100,0,0.3),rgba(0,50,0,0.2));border:5px solid #00cc00;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(0,200,0,0.6);">
      <p style="font-size:2rem;color:#00ff00;line-height:2;text-align:center;font-weight:bold;">
        🏆 YOU WIN THE ULTIMA CUP! 🏆
      </p>
    </div>`);
  } else {
    matchResult.winner = 'portsmouth';
    log('');
    log(`<div style="padding:40px;background:linear-gradient(135deg,rgba(200,0,0,0.3),rgba(100,0,0,0.2));border:5px solid #cc0000;border-radius:20px;margin:40px 0;box-shadow:0 0 40px rgba(200,0,0,0.6);">
      <p style="font-size:2rem;color:#ff4444;line-height:2;text-align:center;font-weight:bold;">
        Portsmouth win the Ultima Cup on penalties.
      </p>
    </div>`);
  }
  
  return matchResult;
}

// ========== ULTIMA CUP VICTORY UI ==========
async function showUltimaCupVictoryUI(matchResult) {
  // Determine winning team name
  let winningTeamName = '';
  if (matchResult.winner === 'us') {
    winningTeamName = getClubName();
  } else if (matchResult.winner === 'portsmouth') {
    winningTeamName = 'Portsmouth';
  } else if (matchResult.winner === 'legends') {
    winningTeamName = 'Legends FC';
  } else if (matchResult.winner === 'ultima') {
    winningTeamName = 'Ultima FC';
  } else {
    // Draw case - find the team(s) with highest goals
    const scores = [
      { team: 'us', name: getClubName(), goals: matchResult.usGoals || 0 },
      { team: 'portsmouth', name: 'Portsmouth', goals: matchResult.portsmouthGoals || 0 },
      { team: 'legends', name: 'Legends FC', goals: matchResult.legendsGoals || 0 },
      { team: 'ultima', name: 'Ultima FC', goals: matchResult.ultimaGoals || 0 }
    ];
    scores.sort((a, b) => b.goals - a.goals);
    const topScore = scores[0].goals;
    const topTeams = scores.filter(s => s.goals === topScore);
    if (topTeams.length === 1) {
      winningTeamName = topTeams[0].name;
    } else {
      winningTeamName = topTeams.map(t => t.name).join(' & ');
    }
  }
  
  // Create victory overlay
  const overlay = document.createElement('div');
  overlay.className = 'ultima-cup-victory-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    z-index: 20000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.5s ease-out;
  `;
  
  const container = document.createElement('div');
  container.style.cssText = `
    text-align: center;
    padding: 60px;
    background: linear-gradient(135deg, rgba(20, 10, 30, 0.98), rgba(30, 15, 40, 0.95));
    border: 5px solid #FFD700;
    border-radius: 30px;
    box-shadow: 0 0 100px rgba(255, 215, 0, 0.6), 0 0 200px rgba(255, 215, 0, 0.4);
    max-width: 90%;
    animation: victoryPulse 2s ease-in-out infinite;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 4rem;
    font-weight: bold;
    color: #FFD700;
    text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6);
    margin-bottom: 30px;
    line-height: 1.2;
    animation: textGlow 2s ease-in-out infinite;
  `;
  title.textContent = `${winningTeamName.toUpperCase()} IS THE GREATEST TEAM IN THE UNIVERSE`;
  
  container.appendChild(title);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  
  // Add CSS animations if not already present
  if (!document.getElementById('ultima-victory-styles')) {
    const style = document.createElement('style');
    style.id = 'ultima-victory-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes victoryPulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 100px rgba(255, 215, 0, 0.6), 0 0 200px rgba(255, 215, 0, 0.4); }
        50% { transform: scale(1.02); box-shadow: 0 0 150px rgba(255, 215, 0, 0.8), 0 0 300px rgba(255, 215, 0, 0.6); }
      }
      @keyframes textGlow {
        0%, 100% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6); }
        50% { text-shadow: 0 0 50px rgba(255, 215, 0, 1), 0 0 100px rgba(255, 215, 0, 0.8); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // If player wins, show confetti and add money
  if (matchResult.winner === 'us') {
    // Create confetti container
    const confettiContainer = document.createElement('div');
    confettiContainer.id = 'ultima-victory-confetti';
    confettiContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 19999;
    `;
    document.body.appendChild(confettiContainer);
    
    // Create lots of confetti
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FF1493', '#00FF00', '#FF4500', '#8A2BE2'];
    for (let i = 0; i < 200; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: absolute;
        width: ${8 + Math.random() * 12}px;
        height: ${8 + Math.random() * 12}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -20px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        animation: confettiFallUltima ${2 + Math.random() * 3}s linear forwards;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      confettiContainer.appendChild(confetti);
    }
    
    // Add confetti animation
    if (!document.getElementById('ultima-confetti-animation')) {
      const confettiStyle = document.createElement('style');
      confettiStyle.id = 'ultima-confetti-animation';
      confettiStyle.textContent = `
        @keyframes confettiFallUltima {
          to {
            transform: translateY(100vh) rotate(${360 + Math.random() * 360}deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(confettiStyle);
    }
    
    // Add money reward
    const rewardAmount = 1000000000; // 1 billion pounds
    S.chairman_cash = (S.chairman_cash || 0) + rewardAmount;
    
    // Show reward message
    const rewardMsg = document.createElement('div');
    rewardMsg.style.cssText = `
      font-size: 2rem;
      color: #00FF00;
      margin-top: 30px;
      text-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
      animation: rewardPulse 1.5s ease-in-out infinite;
    `;
    rewardMsg.textContent = `💰 You receive £1,000,000,000! 💰`;
    container.appendChild(rewardMsg);
    
    // Add reward pulse animation
    if (!document.getElementById('ultima-reward-animation')) {
      const rewardStyle = document.createElement('style');
      rewardStyle.id = 'ultima-reward-animation';
      rewardStyle.textContent = `
        @keyframes rewardPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `;
      document.head.appendChild(rewardStyle);
    }
    
    // Update HUD
    if (typeof updateHUD === 'function') {
      updateHUD();
    }
    
    // Clean up confetti after animation
    setTimeout(() => {
      if (confettiContainer) confettiContainer.remove();
    }, 5000);
  }
  
  // Wait for user to click to continue
  await new Promise((resolve) => {
    const continueBtn = document.createElement('button');
    continueBtn.textContent = 'Continue';
    continueBtn.style.cssText = `
      margin-top: 40px;
      padding: 20px 60px;
      font-size: 1.5rem;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #000;
      border: 3px solid #FFD700;
      border-radius: 15px;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
      transition: all 0.3s;
    `;
    continueBtn.onmouseover = () => {
      continueBtn.style.transform = 'scale(1.1)';
      continueBtn.style.boxShadow = '0 0 50px rgba(255, 215, 0, 0.9)';
    };
    continueBtn.onmouseout = () => {
      continueBtn.style.transform = 'scale(1)';
      continueBtn.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
    };
    continueBtn.onclick = async () => {
      overlay.remove();
      
      // Check if player refused to plant the bomb (has briefcase but no armed players)
      const briefcaseValue = S.power_briefcase_owned;
      const hasBriefcase = briefcaseValue === true || briefcaseValue === 'true' || briefcaseValue === 1 || !!briefcaseValue;
      
      // Ensure ultimaCup object exists
      if (!S.ultimaCup) S.ultimaCup = {};
      
      // Check for armed players - handle both boolean and string values
      const playersArmedValue = S.ultimaCup.players_armed;
      const hasArmedPlayers = playersArmedValue === true || playersArmedValue === 'true' || playersArmedValue === 1 || !!playersArmedValue;
      
      // Show epilogue for non-bomb path (either no briefcase, or has briefcase but didn't arm players)
      if (!hasBriefcase || (hasBriefcase && !hasArmedPlayers)) {
        // Check if Saints won or lost
        if (matchResult.winner === 'us') {
          await showUltimaCupEpilogueSaintsWin();
        } else {
          await showUltimaCupEpilogueSaintsLose();
        }
      }
      
      resolve();
    };
    container.appendChild(continueBtn);
  });
}
