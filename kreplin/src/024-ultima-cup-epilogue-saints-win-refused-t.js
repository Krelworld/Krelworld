// ========== ULTIMA CUP EPILOGUE - SAINTS WIN (REFUSED TO PLANT BOMB) ==========
async function showUltimaCupEpilogueSaintsWin() {
  // Track Ultima Cup title for certificate
  if (!S.playerStats) S.playerStats = {};
  if (typeof S.playerStats.ultimaCupTitles === 'undefined') {
    S.playerStats.ultimaCupTitles = 0;
  }
  S.playerStats.ultimaCupTitles++;
  
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'epilogue-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #fff;
      padding: 40px;
      text-align: left;
      color: #fff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 24px;
      font-weight: normal;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      max-width: 900px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create text container
    const textContainer = document.createElement('div');
    textContainer.id = 'ultima-epilogue-saints-win-content';
    textContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    modal.appendChild(textContainer);
    
    // Epilogue text split into lines
    const epilogueLines = [
      "Southampton are crowned the greatest team in the Universe.",
      "",
      "The crowd roars until it becomes a physical force. Red and white everywhere. History rewritten in ninety minutes. You stand at the centre of it, soaked in beer, sweat, and vindication.",
      "",
      "You did it.",
      "",
      "Then Delmor Krunchem approaches.",
      "",
      "He has your ex-wife with him. He's shouting. Pointing. Accusing you of cheating. Of fixing the match. Of stealing what was \"rightfully his\".",
      "",
      "You don't let him finish.",
      "",
      "You smash him to the ground and start stamping on his head, just like you did the Kuddle Cronster. Once. Twice. Again. Security drag you off at the last possible second.",
      "",
      "Krunchem survives.",
      "",
      "He is left with permanent brain damage, disabling him for life - good!",
      "",
      "You turn to your ex-wife and throw a full pint in her face.",
      "",
      "\"I'm coming for every last penny you stole from me, bitch!\"",
      "",
      "The crowd erupts in applause for you.",
      "",
      "People around you start throwing their own drinks at her. She screams, panics, and flees the stadium in fear for her life as thousands applaud how decisively you handled the situation.",
      "",
      "Mohammed Van Onslaught approaches, wiping a tear from his eye.",
      "",
      "He tells you that the way Southampton played tonight - the true British way - has changed him. That British football should belong to British people. That he will return the Premier League to the British FA.",
      "",
      "He thanks you for showing him the goodness of Britain.",
      "",
      "You shake his hand.",
      "",
      "\"Fair play, Mo. We should have a beer sometime.\"",
      "",
      "He laughs.",
      "",
      "\"That would be haram.\"",
      "",
      "\"It sure would, Mo. It sure, sure would.\"",
      "",
      "\"Yes,\" he says. \"It certainly would.\"",
      "",
      "\"Yep,\" you reply. \"No doubt about it.\"",
      "",
      "Later, at home, you call your daughter at Strip University. She doesn't want to talk. You didn't collect all the Kreplin Gems, and she finds that embarrassing.",
      "",
      "You remind her you just won the Ultima Cup.",
      "",
      "She says, flatly, that it's not the same as doing something truly impressive. Like collecting all the Kreplin Gems.",
      "",
      "She tells you to go away.",
      "",
      "Outside, locals shout as you walk past.",
      "",
      "\"Where's all your Kreplin Gems, wanker?\"",
      "\"Too scared to get all four?\"",
      "\"Team not good enough for you to bother collecting every Kreplin Gem, yeah?\"",
      "",
      "You close the door behind you.",
      "",
      "The room is silent.",
      "",
      "You decide to kill yourself."
    ];
    
    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      @keyframes fadeInButton {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .epilogue-button {
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        color: #000;
        border: 4px solid #FFD700;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
        margin-top: 40px;
        animation: fadeInButton 1s ease-out forwards;
        opacity: 0;
      }
      .epilogue-button:hover {
        transform: scale(1.05);
        box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8);
      }
      .epilogue-button:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle empty lines
          if (text === "") {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 20px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 12px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          textContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 50; // 50ms between lines for faster generation
      
      for (let i = 0; i < epilogueLines.length; i++) {
        const line = epilogueLines[i];
        await addLine(line, totalDelay);
        totalDelay += fadeInDelay;
      }
      
      return totalDelay;
    }
    
    // Create commit suicide button container (will be shown after text finishes)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
      opacity: 0;
    `;
    
    // Create commit suicide button
    const suicideButton = document.createElement('button');
    suicideButton.textContent = 'COMMIT SUICIDE';
    suicideButton.className = 'epilogue-button';
    
    // Create subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '(Press to continue)';
    subtitle.style.cssText = `
      color: #aaa;
      font-size: 18px;
      font-style: italic;
      margin-top: 10px;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 0;
    `;
    
    // Button click handler - goes to suicide screen then certificate
    suicideButton.addEventListener('click', async () => {
      // Stop epilogue music before removing overlay
      if (overlay._epilogueAudio) {
        overlay._epilogueAudio.pause();
        overlay._epilogueAudio.currentTime = 0;
      }
      overlay.remove();
      style.remove(); // Remove the style element when closing
      // Set ending type for suicide ending (Saints win, no kreplin gems)
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.endingType = "suicide_win";
      // Navigate to suicide screen, then certificate
      await showSuicideScreen();
      await showKreplinCertificate();
      resolve();
    });
    
    buttonContainer.appendChild(suicideButton);
    buttonContainer.appendChild(subtitle);
    modal.appendChild(buttonContainer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Stop background music before playing epilogue music
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    
    // Play epilogue music
    const epilogueAudio = new Audio('https://www.dropbox.com/scl/fi/qqboc2l8vj7xjhnqfcmpj/epilogue.mp3?rlkey=1dbpkuoyyiyp5lz5bw3tcr75c&st=491q33ww&dl=1');
    epilogueAudio.loop = true;
    epilogueAudio.volume = 0.7;
    epilogueAudio.play().catch(err => {});
    overlay._epilogueAudio = epilogueAudio; // Store reference for cleanup
    
    // Start displaying lines sequentially
    displayAllLines().then((totalDelay) => {
      // After all lines fade in, show the button at the bottom
      setTimeout(() => {
        buttonContainer.style.animation = 'fadeInButton 1s ease-out forwards';
        buttonContainer.style.opacity = '1';
      }, totalDelay + 300);
    });
  });
}

// ========== ULTIMA CUP EPILOGUE - SAINTS LOSE (REFUSED TO PLANT BOMB) ==========
async function showUltimaCupEpilogueSaintsLose() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'epilogue-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #fff;
      padding: 40px;
      text-align: left;
      color: #fff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 24px;
      font-weight: normal;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      max-width: 900px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create text container
    const textContainer = document.createElement('div');
    textContainer.id = 'ultima-epilogue-saints-lose-content';
    textContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    modal.appendChild(textContainer);
    
    // Epilogue text split into lines
    const epilogueLines = [
      "Southampton fall at the final hurdle.",
      "",
      "The whistle goes. The stadium deflates. History refuses to bend for you.",
      "",
      "Delmor Krunchem finds you immediately.",
      "",
      "He laughs. He gloats. He tells everyone this is what happens when frauds are exposed. He thanks you loudly for the entertainment and spits in your face.",
      "",
      "As you leave the pitch, your trousers slip.",
      "",
      "You're not wearing any underwear.",
      "",
      "Everyone sees everything. Your willy is shrivelled. Everyone laughs. A dog comes up to you and starts sniffing your private region.",
      "",
      "The laughter is deafening.",
      "",
      "Krunchem bows theatrically. Cameras flash. Your ex-wife smiles for them. She looks at Krunchem and holds her fingers apart indicating he has a very large penis, much larger than yours.",
      "",
      "You walk home alone.",
      "",
      "No one follows. No one cheers. No one throws drinks this time. You're an embarrasment to all. Some children throw rocks at you, humilated by what you did to their club.",
      "",
      "No ultima cup. Not enough Kreplin Gems. No legacy.",
      "",
      "You sit down.",
      "",
      "You decide to kill yourself."
    ];
    
    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }
      @keyframes fadeInButton {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .epilogue-button {
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        color: #000;
        border: 4px solid #FFD700;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
        margin-top: 40px;
        animation: fadeInButton 1s ease-out forwards;
        opacity: 0;
      }
      .epilogue-button:hover {
        transform: scale(1.05);
        box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8);
      }
      .epilogue-button:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle empty lines
          if (text === "") {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 20px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 12px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          textContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 50; // 50ms between lines for faster generation
      
      for (let i = 0; i < epilogueLines.length; i++) {
        const line = epilogueLines[i];
        await addLine(line, totalDelay);
        totalDelay += fadeInDelay;
      }
      
      return totalDelay;
    }
    
    // Create commit suicide button container (inside text container, at the bottom)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: auto;
      padding-top: 40px;
      padding-bottom: 20px;
    `;
    
    // Create commit suicide button
    const suicideButton = document.createElement('button');
    suicideButton.textContent = 'COMMIT SUICIDE';
    suicideButton.className = 'epilogue-button';
    suicideButton.style.cssText = `
      padding: 20px 60px;
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      color: #000;
      border: 4px solid #FFD700;
      border-radius: 12px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 3px;
      box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
      transition: all 0.3s ease;
      font-family: 'Arial', sans-serif;
      margin-top: 0;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 1;
    `;
    
    // Create subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '(Press to continue)';
    subtitle.style.cssText = `
      color: #aaa;
      font-size: 18px;
      font-style: italic;
      margin-top: 10px;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 1;
    `;
    
    // Button click handler - goes to suicide screen then certificate
    suicideButton.addEventListener('click', async () => {
      // Stop epilogue music before removing overlay
      if (overlay._epilogueAudio) {
        overlay._epilogueAudio.pause();
        overlay._epilogueAudio.currentTime = 0;
      }
      overlay.remove();
      style.remove(); // Remove the style element when closing
      // Set ending type for suicide ending (Saints lose, no kreplin gems)
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.endingType = "suicide_lose";
      // Navigate to suicide screen, then certificate
      await showSuicideScreen();
      await showKreplinCertificate();
      resolve();
    });
    
    buttonContainer.appendChild(suicideButton);
    buttonContainer.appendChild(subtitle);
    textContainer.appendChild(buttonContainer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Stop background music before playing epilogue music - be aggressive
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    // Also stop any general music audio directly
    if (window.generalMusicAudio) {
      try {
        window.generalMusicAudio.pause();
        window.generalMusicAudio.currentTime = 0;
        window.generalMusicAudio = null;
      } catch(e) {
        console.warn('Error stopping general music audio:', e);
      }
    }
    // Disable general music to prevent it from restarting
    if (typeof window.generalMusicEnabled !== 'undefined') {
      window.generalMusicEnabled = false;
    }
    
    // Play epilogue music
    const epilogueAudio = new Audio('https://www.dropbox.com/scl/fi/qqboc2l8vj7xjhnqfcmpj/epilogue.mp3?rlkey=1dbpkuoyyiyp5lz5bw3tcr75c&st=491q33ww&dl=1');
    epilogueAudio.loop = true;
    epilogueAudio.volume = 0.7;
    epilogueAudio.play().catch(err => {});
    overlay._epilogueAudio = epilogueAudio; // Store reference for cleanup
    
    // Start displaying lines sequentially (button is already visible)
    displayAllLines();
  });
}

// ========== SUICIDE SCREEN ==========
async function showSuicideScreen() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      padding: 20px;
    `;
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #000;
      border: 3px solid #fff;
      padding: 40px;
      text-align: left;
      color: #fff;
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 24px;
      font-weight: normal;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.3);
      max-width: 900px;
      width: 100%;
      max-height: calc(100vh - 40px);
      line-height: 1.8;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create text container
    const textContainer = document.createElement('div');
    textContainer.id = 'suicide-screen-content';
    textContainer.style.cssText = `
      min-height: 200px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
      overflow-x: hidden;
      text-align: center;
    `;
    
    modal.appendChild(textContainer);
    
    // Suicide screen text
    const suicideText = [
      "You, aged 13: \"when I'm an adult I'm going to acheive so much, and do so many things!\"",
      "",
      "You, an adult: *presses 'commit suicide' in a text based video game about an obese pervert created by your autistic friend and coded largely by AI*"
    ];
    
    // Add CSS for fade-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLine {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes fadeInButton {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .epilogue-button {
        padding: 20px 60px;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
        color: #000;
        border: 4px solid #FFD700;
        border-radius: 12px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 3px;
        box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), 0 0 80px rgba(255, 215, 0, 0.6);
        transition: all 0.3s ease;
        font-family: 'Arial', sans-serif;
        margin-top: 40px;
        animation: fadeInButton 1s ease-out forwards;
        opacity: 0;
      }
      .epilogue-button:hover {
        transform: scale(1.05);
        box-shadow: 0 0 60px rgba(255, 215, 0, 1), 0 0 120px rgba(255, 215, 0, 0.8);
      }
      .epilogue-button:active {
        transform: scale(0.98);
      }
    `;
    document.head.appendChild(style);
    
    // Function to add a line with fade-in
    function addLine(text, delay) {
      return new Promise((resolveLine) => {
        setTimeout(() => {
          const lineDiv = document.createElement('div');
          
          // Handle empty lines
          if (text === "") {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 20px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.innerHTML = '<div style="height: 1px;"></div>';
          } else {
            lineDiv.style.cssText = `
              opacity: 0;
              margin-bottom: 12px;
              animation: fadeInLine 0.6s ease-in forwards;
            `;
            lineDiv.textContent = text;
          }
          
          textContainer.appendChild(lineDiv);
          resolveLine();
        }, delay);
      });
    }
    
    // Display all lines sequentially
    async function displayAllLines() {
      let totalDelay = 0;
      const fadeInDelay = 100; // 100ms between lines
      
      for (let i = 0; i < suicideText.length; i++) {
        const line = suicideText[i];
        await addLine(line, totalDelay);
        totalDelay += fadeInDelay;
      }
      
      return totalDelay;
    }
    
    // Create continue button container (will be shown after text finishes)
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      margin-top: 40px;
      opacity: 0;
    `;
    
    // Create continue button
    const continueButton = document.createElement('button');
    continueButton.textContent = 'CONTINUE';
    continueButton.className = 'epilogue-button';
    
    // Create subtitle
    const subtitle = document.createElement('div');
    subtitle.textContent = '(Press to continue)';
    subtitle.style.cssText = `
      color: #aaa;
      font-size: 18px;
      font-style: italic;
      margin-top: 10px;
      animation: fadeInButton 1s ease-out forwards;
      opacity: 0;
    `;
    
    // Button click handler - closes overlay and resolves
    continueButton.addEventListener('click', () => {
      overlay.remove();
      style.remove(); // Remove the style element when closing
      resolve();
    });
    
    buttonContainer.appendChild(continueButton);
    buttonContainer.appendChild(subtitle);
    modal.appendChild(buttonContainer);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Start displaying lines sequentially
    displayAllLines().then((totalDelay) => {
      // After all lines fade in, show the button at the bottom
      setTimeout(() => {
        buttonContainer.style.animation = 'fadeInButton 1s ease-out forwards';
        buttonContainer.style.opacity = '1';
      }, totalDelay + 300);
    });
  });
}

// Kreplin Legacy Certificate - shown after epilogue
async function showKreplinCertificate() {
  return new Promise((resolve) => {
    // Ensure playerStats exists - use existing initialization logic to preserve values
    // This should already be initialized in the main init, but ensure it exists here too
    if (!S.playerStats || typeof S.playerStats !== 'object') {
      // If somehow not initialized, use safe defaults but preserve any existing values
      S.playerStats = {};
    }
    
    // Update stats from current game state
    // IMPORTANT: Preserve cumulative values (titles, prison time, etc.) - only update current state values
    const stats = S.playerStats;
    
    // Ensure spouseNames and childrenNames are arrays (they might be undefined if playerStats existed but wasn't fully initialized)
    if (!Array.isArray(stats.spouseNames)) {
      stats.spouseNames = S.wife_name ? [S.wife_name] : [];
    }
    if (!Array.isArray(stats.childrenNames)) {
      stats.childrenNames = [S.child1_name, S.child2_name].filter(n => n);
    }
    
    // Update identity info (safe to update)
    stats.playerName = S.player_firstname && S.player_surname ? `${S.player_firstname} ${S.player_surname}` : stats.playerName || "Unknown";
    if (S.wife_name && !stats.spouseNames.includes(S.wife_name)) {
      stats.spouseNames.push(S.wife_name);
    }
    if (S.child1_name && !stats.childrenNames.includes(S.child1_name)) {
      stats.childrenNames.push(S.child1_name);
    }
    if (S.child2_name && !stats.childrenNames.includes(S.child2_name)) {
      stats.childrenNames.push(S.child2_name);
    }
    stats.numberOfWives = Math.max(stats.numberOfWives || 0, S.wives_count || stats.spouseNames.length);
    stats.numberOfChildren = Math.max(stats.numberOfChildren || 0, S.kids_count || stats.childrenNames.length);
    
    // Update stats: gamesPlayed and gamesWon are CUMULATIVE (already include all seasons)
    // Add current season's progress to cumulative totals if not already included
    const currentSeasonMatches = S.matches_played || 0;
    const currentSeasonWins = S.wins || 0;
    // Calculate what the cumulative total should be (current cumulative + current season)
    // But only if current season hasn't been added yet (check if it's less than expected)
    const expectedCumulativeMatches = (stats.gamesPlayed || 0) + currentSeasonMatches;
    const expectedCumulativeWins = (stats.gamesWon || 0) + currentSeasonWins;
    // Use the maximum to ensure we don't lose any games (handles edge cases)
    stats.gamesPlayed = Math.max(stats.gamesPlayed || 0, expectedCumulativeMatches);
    stats.gamesWon = Math.max(stats.gamesWon || 0, expectedCumulativeWins);
    // Other stats that are cumulative
    stats.bribesMadeOrAccepted = Math.max(stats.bribesMadeOrAccepted || 0, S.bribes_count || 0);
    stats.gramsOfCocaineTaken = Math.max(stats.gramsOfCocaineTaken || 0, S.inventory?.drugs || 0);
    
    // Calculate gambling stats from bet_history (cumulative)
    if (S.bet_history && Array.isArray(S.bet_history)) {
      const totalGambled = S.bet_history.reduce((sum, bet) => sum + (bet.amount || 0), 0);
      const totalOutcome = S.bet_history.reduce((sum, bet) => {
        const outcome = bet.won ? (bet.payout || 0) : -(bet.amount || 0);
        return sum + outcome;
      }, 0);
      // Preserve existing values if they're higher (in case of multiple saves)
      stats.amountGambled = Math.max(stats.amountGambled || 0, totalGambled);
      stats.netGamblingOutcome = Math.max(stats.netGamblingOutcome || -Infinity, totalOutcome);
    }
    
    // Update kreplin gems from current state (always sync to latest)
    stats.kreplinGems = Math.max(stats.kreplinGems || 0, S.kreplin_gems || 0);
    
    // CRITICAL: DO NOT overwrite cumulative title counts - they are tracked when won
    // These values should already be correct from tracking throughout the game
    // Only ensure they're numbers if somehow undefined
    
    // Ensure all cumulative stats are preserved (don't reset to 0)
    // Titles, prison time, rehab time, etc. are cumulative and should never decrease
    
    // Normalize all numeric stats to ensure they're never undefined
    // Helper function to safely get numeric value
    const safeNum = (val) => {
      if (val === undefined || val === null || isNaN(val)) return 0;
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };
    
    // Normalize all numeric fields to ensure 0 instead of undefined
    stats.numberOfWives = safeNum(stats.numberOfWives);
    stats.numberOfChildren = safeNum(stats.numberOfChildren);
    stats.inappropriateImagesSent = safeNum(stats.inappropriateImagesSent);
    stats.sexualEncountersRecorded = safeNum(stats.sexualEncountersRecorded);
    stats.stdsContracted = safeNum(stats.stdsContracted);
    stats.veryBadStdsContracted = safeNum(stats.veryBadStdsContracted);
    stats.gamesPlayed = safeNum(stats.gamesPlayed);
    stats.gamesWon = safeNum(stats.gamesWon);
    stats.matchesSpentInPrison = safeNum(stats.matchesSpentInPrison);
    stats.matchesSpentInRehabilitation = safeNum(stats.matchesSpentInRehabilitation);
    stats.timeSpentOnSexOffendersRegister = safeNum(stats.timeSpentOnSexOffendersRegister);
    stats.bribesMadeOrAccepted = safeNum(stats.bribesMadeOrAccepted);
    stats.playersWhoDied = safeNum(stats.playersWhoDied);
    stats.amountGambled = safeNum(stats.amountGambled);
    stats.netGamblingOutcome = safeNum(stats.netGamblingOutcome);
    stats.gramsOfCocaineTaken = safeNum(stats.gramsOfCocaineTaken);
    stats.vialsOfHGHInjected = safeNum(stats.vialsOfHGHInjected);
    stats.premierLeagueTitles = safeNum(stats.premierLeagueTitles);
    stats.championsLeagueTitles = safeNum(stats.championsLeagueTitles);
    stats.ultimaCupTitles = safeNum(stats.ultimaCupTitles);
    stats.worldCupTitles = safeNum(stats.worldCupTitles);
    stats.kreplinGems = safeNum(stats.kreplinGems);
    
    // Ensure string fields have defaults
    if (typeof stats.playerName !== 'string') stats.playerName = "Unknown";
    if (typeof stats.endingType !== 'string') stats.endingType = "";
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #f5f5f5;
      z-index: 9999999;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px;
      font-family: 'Times New Roman', 'Georgia', serif;
    `;
    
    // Create certificate container wrapper for centering
    const certificateWrapper = document.createElement('div');
    certificateWrapper.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100%;
      padding: 20px 0;
    `;
    
    // Create certificate container
    const certificate = document.createElement('div');
    certificate.style.cssText = `
      background: #ffffff;
      border: 8px solid #1a1a1a;
      padding: 40px 60px;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      color: #1a1a1a;
      line-height: 1.8;
      margin: 0 auto;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 30px;
      margin-bottom: 40px;
    `;
    
    const title = document.createElement('h1');
    title.textContent = 'THE KREPLIN LEGACY CERTIFICATE';
    title.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      margin: 0 0 15px 0;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;
    
    const issuer = document.createElement('p');
    issuer.textContent = 'Issued by the Office of Eternal Southampton';
    issuer.style.cssText = `
      font-size: 16px;
      margin: 0;
      font-style: italic;
      color: #555;
    `;
    
    const purpose = document.createElement('p');
    purpose.textContent = 'This document certifies the total historical impact of the individual named below.';
    purpose.style.cssText = `
      font-size: 14px;
      margin: 15px 0 0 0;
      color: #666;
    `;
    
    header.appendChild(title);
    header.appendChild(issuer);
    header.appendChild(purpose);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `
      font-size: 14px;
      line-height: 2;
    `;
    
    // Identity Section
    const identitySection = document.createElement('div');
    identitySection.style.cssText = 'margin-bottom: 30px;';
    identitySection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">IDENTITY</h2>
      <p><strong>Name:</strong> ${stats.playerName}</p>
      <p><strong>Spouse(s) Name(s):</strong> ${stats.spouseNames.length > 0 ? stats.spouseNames.join(', ') : 'None recorded'}</p>
      <p><strong>Children's Name(s):</strong> ${stats.childrenNames.length > 0 ? stats.childrenNames.join(', ') : 'None recorded'}</p>
    `;
    
    // Family Metrics
    const familySection = document.createElement('div');
    familySection.style.cssText = 'margin-bottom: 30px;';
    familySection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">FAMILY METRICS</h2>
      <p><strong>Number of Wives:</strong> ${stats.numberOfWives}</p>
      <p><strong>Number of Children:</strong> ${stats.numberOfChildren}</p>
    `;
    
    // Moral & Personal Conduct
    const moralSection = document.createElement('div');
    moralSection.style.cssText = 'margin-bottom: 30px;';
    moralSection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">MORAL & PERSONAL CONDUCT</h2>
      <p><strong>Inappropriate Images Sent:</strong> ${stats.inappropriateImagesSent}</p>
      <p><strong>Sexual Encounters Recorded:</strong> ${stats.sexualEncountersRecorded}</p>
      <p><strong>STDs Contracted:</strong> ${stats.stdsContracted}</p>
      <p><strong>Very Bad STDs Contracted:</strong> ${stats.veryBadStdsContracted} ${stats.veryBadStdsContracted > 0 ? '(Doctor marked "Very Bad")' : ''}</p>
    `;
    
    // Career & Competition
    const careerSection = document.createElement('div');
    careerSection.style.cssText = 'margin-bottom: 30px;';
    careerSection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">CAREER & COMPETITION</h2>
      <p><strong>Games Played:</strong> ${stats.gamesPlayed}</p>
      <p><strong>Games Won:</strong> ${stats.gamesWon}</p>
      <p><strong>Matches Spent in Prison:</strong> ${stats.matchesSpentInPrison}</p>
      <p><strong>Matches Spent in Rehabilitation:</strong> ${stats.matchesSpentInRehabilitation}</p>
      <p><strong>Time Spent on Sex Offenders Register:</strong> ${stats.timeSpentOnSexOffendersRegister} ${stats.timeSpentOnSexOffendersRegister > 0 ? '(Measured in Matches)' : ''}</p>
    `;
    
    // Crime & Corruption
    const crimeSection = document.createElement('div');
    crimeSection.style.cssText = 'margin-bottom: 30px;';
    crimeSection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">CRIME & CORRUPTION</h2>
      <p><strong>Bribes Made / Accepted:</strong> ${stats.bribesMadeOrAccepted}</p>
      <p><strong>Players Who Died:</strong> ${stats.playersWhoDied}</p>
      <p><strong>Amount Gambled:</strong> ${money(stats.amountGambled)}</p>
      <p><strong>Net Gambling Outcome:</strong> ${stats.netGamblingOutcome >= 0 ? '+' : ''}${money(stats.netGamblingOutcome)}</p>
    `;
    
    // Substance Consumption
    const substanceSection = document.createElement('div');
    substanceSection.style.cssText = 'margin-bottom: 30px;';
    substanceSection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">SUBSTANCE CONSUMPTION</h2>
      <p><strong>Grams of Cocaine Taken:</strong> ${stats.gramsOfCocaineTaken} ${stats.gramsOfCocaineTaken > 0 ? '(1 bag = 1 gram)' : ''}</p>
      <p><strong>Number of Vials of HGH Injected:</strong> ${stats.vialsOfHGHInjected}</p>
    `;
    
    // Trophies
    const trophySection = document.createElement('div');
    trophySection.style.cssText = 'margin-bottom: 40px;';
    trophySection.innerHTML = `
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 5px;">TROPHIES</h2>
      <p><strong>Premier League Titles:</strong> ${stats.premierLeagueTitles}</p>
      <p><strong>Champions League Titles:</strong> ${stats.championsLeagueTitles}</p>
      <p><strong>Ultima Cup Titles:</strong> ${stats.ultimaCupTitles}</p>
    `;
    
    content.appendChild(identitySection);
    content.appendChild(familySection);
    content.appendChild(moralSection);
    content.appendChild(careerSection);
    content.appendChild(crimeSection);
    content.appendChild(substanceSection);
    content.appendChild(trophySection);
    
    // Signature
    const signature = document.createElement('div');
    signature.style.cssText = `
      margin-top: 50px;
      padding-top: 30px;
      border-top: 2px solid #1a1a1a;
      text-align: right;
    `;
    signature.innerHTML = `
      <p style="margin: 0; font-size: 16px;"><strong>Drongus B. Dripping</strong></p>
      <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Office of Eternal Southampton</p>
    `;
    
    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-top: 40px;
      padding-top: 30px;
      border-top: 2px solid #ccc;
    `;
    
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'DOWNLOAD PDF';
    downloadButton.style.cssText = `
      padding: 15px 40px;
      font-size: 16px;
      font-weight: bold;
      background: #1a1a1a;
      color: #fff;
      border: 3px solid #1a1a1a;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.3s ease;
      font-family: 'Times New Roman', serif;
    `;
    downloadButton.onmouseover = () => {
      downloadButton.style.background = '#333';
    };
    downloadButton.onmouseout = () => {
      downloadButton.style.background = '#1a1a1a';
    };
    
    const advanceButton = document.createElement('button');
    advanceButton.textContent = 'ADVANCE';
    advanceButton.style.cssText = `
      padding: 15px 40px;
      font-size: 16px;
      font-weight: bold;
      background: #fff;
      color: #1a1a1a;
      border: 3px solid #1a1a1a;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.3s ease;
      font-family: 'Times New Roman', serif;
    `;
    advanceButton.onmouseover = () => {
      advanceButton.style.background = '#f0f0f0';
    };
    advanceButton.onmouseout = () => {
      advanceButton.style.background = '#fff';
    };
    
    // Download PDF functionality
    downloadButton.addEventListener('click', () => {
      generateCertificatePDF(stats);
    });
    
    // Advance to end credits
    advanceButton.addEventListener('click', () => {
      overlay.remove();
      showCredits().then(() => {
        resolve();
      });
    });
    
    buttonContainer.appendChild(downloadButton);
    buttonContainer.appendChild(advanceButton);
    
    // Assemble certificate
    certificate.appendChild(header);
    certificate.appendChild(content);
    certificate.appendChild(signature);
    certificate.appendChild(buttonContainer);
    
    certificateWrapper.appendChild(certificate);
    overlay.appendChild(certificateWrapper);
    document.body.appendChild(overlay);
  });
}

// Generate PDF certificate
function generateCertificatePDF(stats) {
  if (typeof window.jspdf === 'undefined') {
    (window.KUI ? KUI.alert('PDF library not loaded. Please refresh the page.') : alert('PDF library not loaded. Please refresh the page.'));
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  // Set font
  doc.setFont('times', 'normal');
  
  // Header
  doc.setFontSize(20);
  doc.setFont('times', 'bold');
  doc.text('THE KREPLIN LEGACY CERTIFICATE', 105, 30, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('times', 'italic');
  doc.text('Issued by the Office of Eternal Southampton', 105, 38, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text('This document certifies the total historical impact of the individual named below.', 105, 45, { align: 'center', maxWidth: 180 });
  
  let yPos = 60;
  const lineHeight = 7;
  const margin = 20;
  
  // Identity
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('IDENTITY', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Name: ${stats.playerName}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Spouse(s) Name(s): ${stats.spouseNames.length > 0 ? stats.spouseNames.join(', ') : 'None recorded'}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Children's Name(s): ${stats.childrenNames.length > 0 ? stats.childrenNames.join(', ') : 'None recorded'}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Family Metrics
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('FAMILY METRICS', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Number of Wives: ${stats.numberOfWives}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Number of Children: ${stats.numberOfChildren}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Moral & Personal Conduct
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('MORAL & PERSONAL CONDUCT', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Inappropriate Images Sent: ${stats.inappropriateImagesSent}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Sexual Encounters Recorded: ${stats.sexualEncountersRecorded}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`STDs Contracted: ${stats.stdsContracted}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Very Bad STDs Contracted: ${stats.veryBadStdsContracted}${stats.veryBadStdsContracted > 0 ? ' (Doctor marked "Very Bad")' : ''}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Career & Competition
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('CAREER & COMPETITION', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Games Played: ${stats.gamesPlayed}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Games Won: ${stats.gamesWon}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Matches Spent in Prison: ${stats.matchesSpentInPrison}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Matches Spent in Rehabilitation: ${stats.matchesSpentInRehabilitation}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Time Spent on Sex Offenders Register: ${stats.timeSpentOnSexOffendersRegister}${stats.timeSpentOnSexOffendersRegister > 0 ? ' (Measured in Matches)' : ''}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Crime & Corruption
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('CRIME & CORRUPTION', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Bribes Made / Accepted: ${stats.bribesMadeOrAccepted}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Players Who Died: ${stats.playersWhoDied}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Amount Gambled: ${money(stats.amountGambled)}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Net Gambling Outcome: ${stats.netGamblingOutcome >= 0 ? '+' : ''}${money(stats.netGamblingOutcome)}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Substance Consumption
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('SUBSTANCE CONSUMPTION', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Grams of Cocaine Taken: ${stats.gramsOfCocaineTaken}${stats.gramsOfCocaineTaken > 0 ? ' (1 bag = 1 gram)' : ''}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Number of Vials of HGH Injected: ${stats.vialsOfHGHInjected}`, margin, yPos);
  yPos += lineHeight * 1.5;
  
  // Trophies
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('TROPHIES', margin, yPos);
  yPos += lineHeight;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.text(`Premier League Titles: ${stats.premierLeagueTitles}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Champions League Titles: ${stats.championsLeagueTitles}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`World Cup Titles: ${stats.worldCupTitles}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Ultima Cup Titles: ${stats.ultimaCupTitles}`, margin, yPos);
  yPos += lineHeight * 2;
  
  // Signature
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('Drongus B. Dripping', 185, yPos, { align: 'right' });
  yPos += lineHeight;
  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  doc.text('Office of Eternal Southampton', 185, yPos, { align: 'right' });
  
  // Save PDF
  doc.save('Kreplin_Legacy_Certificate.pdf');
}

// Credits Scene - shown after certificate download
async function showCredits() {
  window.__kreplinCampaignEnd = true; // the campaign is over: credits -> RESTART GAME (read by tools/autoplay.js)
  return new Promise((resolve) => {
    // Determine ending type for music selection
    const endingType = (S.playerStats && S.playerStats.endingType) || "kreplin_protocol";
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Times New Roman', 'Georgia', serif;
    `;
    
    // Create credits container (big UI, not full screen)
    const creditsContainer = document.createElement('div');
    creditsContainer.style.cssText = `
      width: 80%;
      max-width: 800px;
      height: 85vh;
      background: #1a1a1a;
      border: 4px solid #fff;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 40px rgba(255, 255, 255, 0.3);
    `;
    
    // Credits data
    const credits = [
      { type: 'title', text: 'KREPLIN: A SOUTHAMPTON FC CHAIRMAN SIM' },
      { type: 'role', role: 'Game Concept', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Creative Director', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Game Director', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Lead Designer', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Narrative Design', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Worldbuilding & Lore', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Writing', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Additional Writing', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Systems Design', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Gameplay Programming', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'AI Programming', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Physics', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Bug Introduction', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Bug Removal', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Art Direction', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Character Art', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Environmental Art', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'UI / UX Design', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Font Selection', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Sound Design', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Music', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Crowd Chant Recording', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Voice Acting (All Roles)', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Motion Capture', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Facial Animation', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Explosions', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Nuclear Physics Consultation', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Football Knowledge', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Legal Advice', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Ethics Review', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Morality (Optional)', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Playtesting', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'QA Lead', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'QA Team', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Balance Testing', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Difficulty Tuning', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Performance Optimisation', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Save System', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Load Times', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Coffee Procurement', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Beer Spillage Incident', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Crisis Management', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Final Responsibility', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Special Thanks', name: 'Drongus B. Dripping' },
      { type: 'role', role: 'Very Special Thanks', name: 'Drongus B. Dripping' },
      { type: 'message', text: 'No generative AI was used in the creation of this game.' },
      { type: 'message', text: '#KeepArtHuman' }
    ];
    
    // Create scrolling credits content
    const creditsContent = document.createElement('div');
    creditsContent.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      padding: 40px 60px;
      color: #fff;
      text-align: center;
    `;
    
    // Build credits HTML
    credits.forEach((credit, index) => {
      const creditElement = document.createElement('div');
      creditElement.style.cssText = `
        margin-bottom: ${credit.type === 'title' ? '60px' : credit.type === 'message' ? '40px' : '30px'};
        padding: ${credit.type === 'title' ? '20px' : '10px'};
      `;
      
      if (credit.type === 'title') {
        creditElement.innerHTML = `<h1 style="font-size: 36px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 3px;">${credit.text}</h1>`;
      } else if (credit.type === 'role') {
        creditElement.innerHTML = `
          <div style="font-size: 18px; margin-bottom: 8px; color: #ccc;">${credit.role}</div>
          <div style="font-size: 24px; font-weight: bold;">${credit.name}</div>
        `;
      } else if (credit.type === 'message') {
        creditElement.innerHTML = `<div style="font-size: 16px; font-style: italic; color: #aaa; margin-top: 40px;">${credit.text}</div>`;
      }
      
      creditsContent.appendChild(creditElement);
    });
    
    // Add extra space at the end for the restart button
    const endSpacer = document.createElement('div');
    endSpacer.style.cssText = 'height: 200px;';
    creditsContent.appendChild(endSpacer);
    
    // Append credits content first to measure its height
    creditsContainer.appendChild(creditsContent);
    
    // Create restart button (initially hidden, shown at end of scroll)
    const restartButton = document.createElement('button');
    restartButton.textContent = 'RESTART GAME';
    restartButton.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      padding: 20px 60px;
      font-size: 20px;
      font-weight: bold;
      background: #fff;
      color: #1a1a1a;
      border: 4px solid #1a1a1a;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 2px;
      transition: all 0.3s ease;
      font-family: 'Times New Roman', serif;
      opacity: 0;
      pointer-events: none;
      z-index: 10;
    `;
    restartButton.onmouseover = () => {
      restartButton.style.background = '#f0f0f0';
      restartButton.style.transform = 'translateX(-50%) scale(1.05)';
    };
    restartButton.onmouseout = () => {
      restartButton.style.background = '#fff';
      restartButton.style.transform = 'translateX(-50%) scale(1)';
    };
    restartButton.addEventListener('click', () => {
      // Stop credits music if playing
      if (overlay._creditsAudio) {
        overlay._creditsAudio.pause();
        overlay._creditsAudio.currentTime = 0;
        overlay._creditsAudio = null;
      }
      // Clear save and reload to return to introductory menu
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    });
    
    creditsContainer.appendChild(restartButton);
    
    // Calculate scroll distance and duration
    // Wait for content to be rendered to get accurate height
    setTimeout(() => {
      const containerHeight = creditsContainer.offsetHeight;
      const contentHeight = creditsContent.scrollHeight;
      const scrollDistance = contentHeight - containerHeight;
      const scrollDuration = Math.max(45, Math.min(90, (scrollDistance / 50) * 2)); // 45-90 seconds based on content
      
      // Add CSS animation for scrolling
      const styleId = 'credits-scroll-style';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      
      style.textContent = `
        @keyframes scrollCredits {
          0% {
            transform: translateY(0);
          }
          90% {
            transform: translateY(-${scrollDistance}px);
          }
          100% {
            transform: translateY(-${scrollDistance}px);
          }
        }
        #credits-scroll {
          animation: scrollCredits ${scrollDuration}s linear forwards;
        }
      `;
      
      creditsContent.id = 'credits-scroll';
      
      // Show restart button after scroll completes
      setTimeout(() => {
        restartButton.style.opacity = '1';
        restartButton.style.pointerEvents = 'auto';
        restartButton.style.transition = 'opacity 1s ease-in';
      }, (scrollDuration * 1000) - 2000); // Show button 2 seconds before animation ends
    }, 100);
    
    overlay.appendChild(creditsContainer);
    document.body.appendChild(overlay);
    
    // Stop background music before playing credits music
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    
    // Play end credits music based on ending type
    let musicUrl = null;
    if (endingType === "kreplin_protocol") {
      // Good ending - collected all kreplin gems
      musicUrl = 'https://www.dropbox.com/scl/fi/4y3c9nszw6z43ia8aqo6h/good-credits.mp3?rlkey=c12h3e439unhwiv2h7ma54b6z&st=ev5xvbph&dl=1';
    } else if (endingType === "nuclear_holocaust" || endingType === "suicide_win" || endingType === "suicide_lose") {
      // Bad endings - nuclear holocaust or suicide endings
      musicUrl = 'https://www.dropbox.com/scl/fi/kbhjolbtkicipdojoqoff/bad-credits.mp3?rlkey=ebd1ymwkdxc86ffji3vm4z74g&st=961vyavv&dl=1';
    }
    
    let creditsAudio = null;
    if (musicUrl) {
      creditsAudio = new Audio(musicUrl);
      creditsAudio.loop = false;
      creditsAudio.volume = 0.7;
      creditsAudio.play().catch(err => {
      });
    }
    
    // Store reference for cleanup if needed
    overlay._creditsAudio = creditsAudio;
  });
}

// Driving Minigame: startDrivingMinigame() is defined by src/087h-mg-driving.js (MGKit scrolling road).

async function playMatchPhaseWithTaunts(){
  if (!S.matchContext || !S.matchContext.team || (typeof S.matchContext.roundIndex === 'number' && S.matchContext.roundIndex !== (S.matches_played | 0))) {
    S.matchContext = { ...currentOpponent(), roundIndex: S.matches_played | 0 };
  }
  
  // Clear the UI to remove pre-match menu
  clearActions();
  
  // Ensure pre-match menu flags are cleared (defensive)
  if (S._preMatchMenuInterrupted) {
    S._preMatchMenuInterrupted = false;
  }
  if (S._preMatchMenuActive) {
    S._preMatchMenuActive = false;
  }
  
  // Drinking decision before match: asked once, then remembered (KPacing.drinkPref;
  // switch it from the pre-match menu's "Matchday pint" toggle)
  const drinkPref = window.KPacing ? KPacing.drinkPref() : 'ask';
  if (drinkPref === 'ask') log("You have a moment before the match begins...");
  const drinkChoice = drinkPref !== 'ask' ? drinkPref : await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a relaxing drink of beer' }
  ], 'Pre-match preparation\n\n(Your answer becomes your matchday habit — switch it any week from the pre-match menu.)');
  if (drinkPref === 'ask' && window.KPacing) KPacing.setDrink(drinkChoice);
  
  if (drinkChoice === 'drink') {
    S.isDrunk = true;
    S.last_drunk_match = Date.now();
    
    // Generate random beer description
    const beerAdjectives = [
      "juicy", "crisp", "smooth", "bitter", "sweet", "hoppy", "malty", "rich", "light", "dark",
      "golden", "amber", "frothy", "bubbly", "refreshing", "warming", "cooling", "thick", "thin",
      "spicy", "fruity", "nutty", "caramel", "chocolatey", "citrusy", "herbal", "earthy", "woody"
    ];
    
    const throatAdjectives = [
      "wet", "dry", "parched", "thirsty", "smooth", "rough", "tickling", "burning", "cooling",
      "warm", "tingling", "soothing", "scratching", "coating", "cleansing", "refreshing"
    ];
    
    const actionVerbs = [
      "slides", "flows", "trickles", "pours", "cascades", "streams", "dribbles", "oozes",
      "glides", "meanders", "rushes", "gushes", "seeps", "drips", "spills", "washes"
    ];
    
    const speedAdverbs = [
      "slowly", "quickly", "gently", "rapidly", "smoothly", "roughly", "carefully", "recklessly",
      "gracefully", "clumsily", "elegantly", "messily", "precisely", "wildly", "calmly", "fiercely"
    ];
    
    const satisfactionPhrases = [
      "mmm. lovely", "ahh. perfect", "oh yes. divine", "bliss. wonderful", "heaven. delicious",
      "excellent. superb", "magnificent. brilliant", "outstanding. fantastic", "incredible. amazing",
      "spectacular. gorgeous", "marvelous. splendid", "fabulous. delightful", "superb. exquisite",
      "wonderful. heavenly", "fantastic. perfect", "amazing. incredible", "brilliant. outstanding"
    ];
    
    const beerAdj = beerAdjectives[Math.floor(Math.random() * beerAdjectives.length)];
    const throatAdj = throatAdjectives[Math.floor(Math.random() * throatAdjectives.length)];
    const actionVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
    const speedAdv = speedAdverbs[Math.floor(Math.random() * speedAdverbs.length)];
    const satisfaction = satisfactionPhrases[Math.floor(Math.random() * satisfactionPhrases.length)];
    
    const beerDescription = `The ${beerAdj} beer ${actionVerb} down your ${throatAdj} throat ${speedAdv}. ${satisfaction}`;
    
    log(beerDescription);
    log("You feel more relaxed but perhaps less inhibited...");
  } else {
    S.isDrunk = false;
    if (drinkPref === 'ask' || !window.KPacing) log("You stay focused and sober. Your taunts will be more measured and appropriate.");
    else log(KPacing.bag('drink:sober', [
      "You stay sober. Mostly out of spite.",
      "Sparkling water. You hold it like a pint so nobody talks to you.",
      "Stone-cold sober. Your hands are shaking anyway.",
      "No pint today. The barman looks genuinely hurt.",
      "You sip a Fruit Shoot in the directors' box with total dignity.",
      "Sober as a judge. A judge who has seen terrible things."
    ]));
  }
  
  // Start the match simulation with integrated taunt system
  log("The match begins!");
  
  // Set up taunt integration for the match
  S.tauntModeActive = true;
  S.tauntChoicesRemaining = 3; // Allow 3 taunt opportunities during the match
  S._lastTauntMinute = -999;
  S._tauntPromptInFlight = false;
  
  // Use quick sim with live overlay UI
  let outcome = await quickSimulateMatchWithLiveOverlay();
  
  // Clear the taunt mode flag after simulation
  S.tauntModeActive = false;
  S.tauntChoicesRemaining = 0;
  delete S._lastTauntMinute;
  delete S._tauntPromptInFlight;
  
  // Convert the result to the expected format
  const result = {
    our_goals: outcome.usGoals || outcome.our_goals || 0,
    their_goals: outcome.themGoals || outcome.their_goals || 0,
    simulated: true
  };
  return result;
}

// Helper: Compute match simulation result without logging (for live overlay)
function computeQuickSimResult() {
  // Check for Messi goalie fiasco
  if (S.messi_goalie_next_loss) {
    return {
      winner: "them",
      usGoals: 0,
      themGoals: 100,
      score: "0-100",
      events: [],
      isSpecial: true
    };
  }
  
  // Ensure strengths are computed
  if (!S?.preMatch?.ourStrength || !S?.preMatch?.oppStrength) {
    computePreMatchStrengthsAndOdds();
  }
  let our = S.preMatch.ourStrength, opp = S.preMatch.oppStrength;
  
  // Apply any one-match morale effects
  if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
  if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
  // Power Network "policy favour": the officials lean our way a little this match
  // (S.referee_soft_bias, +5 per favour -> +2 strength, capped at +4; cleared after the match)
  if ((S.referee_soft_bias|0) > 0) our += Math.min(4, Math.round((S.referee_soft_bias|0) * 0.4));
  our = Math.max(10, Math.min(our, 200));
  opp = Math.max(10, Math.min(opp, 200));
  
  // Use the same event generator as the watch mode so cocaine/HGH logic and
  // stretcher injuries / bribe interactions are fully respected.
  const events = _genMatchEvents(our, opp);

  // Derive goals for each side from the generated events
  let gf = 0;
  let ga = 0;
  for (const ev of events) {
    if (ev.kind === 'GOAL') {
      if (ev.who === 'HOME') gf++;
      else if (ev.who === 'AWAY') ga++;
    } else if (ev.kind === 'OWN_GOAL') {
      // Own goals count as goals for the opposition
      if (ev.who === 'AWAY') ga++;
      else if (ev.who === 'HOME') gf++;
    } else if (ev.kind === 'GAZ_SHENANIGAN' && ev.shenaniganType === 'OWN_GOAL') {
      // Gaz shenanigan own goals also count for the opposition
      ga++;
    }
  }

  const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");

  return { winner, usGoals: gf, themGoals: ga, score: `${gf}-${ga}`, events, isSpecial: false };
}

// Quick simulate match with live overlay UI
async function quickSimulateMatchWithLiveOverlay() {
  // Compute result immediately
  const result = computeQuickSimResult();
  
  // Handle special case (Messi goalie fiasco)
  if (result.isSpecial) {
    S.messi_goalie_next_loss = false;
    // (the 0–100 result is recorded by postMatchPhase like any other)
    S.morale = clamp(S.morale - 25, -100, 100);
    log('Result: LOSS (0–100). Board moves to remove you.');
    await triggerRemovalWorkaround('an egregious tactical fiasco (0–100)');
    render();
    return { winner: result.winner, usGoals: result.usGoals, themGoals: result.themGoals, score: result.score };
  }
  
  // Store match events
  S.matchEvents = result.events;
  
  // Get team names
  const homeTeam = getClubName();
  const awayTeam = currentOpponent()?.team || 'Opposition';
  
  // Create overlay UI
  const overlay = createQuickSimOverlay(homeTeam, awayTeam);
  document.body.appendChild(overlay);
  
  // Reveal events over time
  const skipState = { requested: false };
  const skipBtn = overlay.querySelector('.quick-sim-skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => { 
      skipState.requested = true;
      skipBtn.disabled = true;
      skipBtn.textContent = 'Skipping...';
    });
  }
  
  try {
    await revealMatchEvents(result, overlay, skipState);
  } finally {
    // Clean up overlay
    overlay.remove();
  }
  
  // Update morale only - points will be updated by applyResultToTable
  // This ensures points are always in sync with the league table
  if (result.winner === "us") {
    S.morale = clamp(S.morale + 4, -100, 100);
  } else if (result.winner === "them") {
    S.morale = clamp(S.morale - 6, -100, 100);
  }
  // Note: S.points, S.wins, S.draws, S.losses are updated by applyResultToTable() 
  // which is called in postMatchPhase to ensure consistency with league table
  
  // Show full-time in main log
  log(`Full-time: ${homeTeam} ${result.usGoals} – ${result.themGoals} ${awayTeam}`);
  
  return { winner: result.winner, usGoals: result.usGoals, themGoals: result.themGoals, score: result.score };
}

// Create the Quick Sim overlay UI
function createQuickSimOverlay(homeTeam, awayTeam) {
  const overlay = document.createElement('div');
  overlay.className = 'quick-sim-overlay k-match';
  const kEsc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kShort = t => String(t || '').replace(/ FC$/, '');
  overlay.innerHTML = `
    <div class="quick-sim-container k-match-box" role="dialog" aria-label="Live match">
      <div class="quick-sim-header k-board">
        <div class="quick-sim-teams k-board-teams">
          <div class="quick-sim-team home-team"><img class="px" alt="" src="${(window.KREPLIN_ART || {}).crest || ''}"><span>${kEsc(kShort(homeTeam))}</span></div>
          <div class="quick-sim-score k-board-score">
            <span class="score-home">0</span>
            <span class="score-separator">–</span>
            <span class="score-away">0</span>
          </div>
          <div class="quick-sim-team away-team"><span>${kEsc(kShort(awayTeam))}</span><i class="k-kit" aria-hidden="true"></i></div>
        </div>
        <div class="quick-sim-vs" hidden>vs</div>
        <div class="quick-sim-minute k-board-min">0'</div>
      </div>
      <div class="k-pitch" aria-hidden="true"></div>
      <div class="quick-sim-log-container k-match-low">
        <div class="quick-sim-status k-chips">
          <span id="quickSimCards" class="k-chip">🟨 0 🟥 0</span>
          <span id="quickSimInjuries" class="k-chip">🚑 0</span>
          <span id="quickSimSubs" class="k-chip">🔁 0/5</span>
          <div class="quick-sim-speed-control k-speed">
            <label for="quickSimSpeed">Speed</label>
            <select id="quickSimSpeed" class="quick-sim-speed-select">
              <option value="1">1 (Slowest)</option>
              <option value="2">2 (Slow)</option>
              <option value="3">3 (Default)</option>
              <option value="4">4 (Fast)</option>
              <option value="5">5 (Fastest)</option>
            </select>
          </div>
        </div>
        <div class="quick-sim-log-header" hidden>Match Log</div>
        <div class="quick-sim-log k-ticker" id="quickSimLog" aria-live="polite"></div>
      </div>
      <button class="quick-sim-skip-btn k-btn">Skip to FT ▸▸</button>
    </div>
  `;
  // Pixel pitch acts out the events revealMatchEvents feeds it (cosmetic only)
  try {
    if (window.MatchPitch) overlay._pitch = MatchPitch.mount(overlay.querySelector('.k-pitch'), { home: homeTeam, away: awayTeam });
  } catch (e) { console.warn('MatchPitch mount failed', e); }

  
  // Disable skip button if this is match 11 season 2 (stadium attack match) or first match of season 5 or stadium burn triggered
  const skipBtn = overlay.querySelector('.quick-sim-skip-btn');
  if (skipBtn && ((S.season === 2 && S.matches_played === 11) || (S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0) || S.preMatch?.stadium_burn_triggered)) {
    skipBtn.disabled = true;
    skipBtn.style.opacity = '0.5';
    skipBtn.style.cursor = 'not-allowed';
    skipBtn.title = 'Skip disabled for this match';
  }
  
  // Initialize speed selector with saved preference (default 3)
  const speedSelect = overlay.querySelector('#quickSimSpeed');
  const savedSpeed = localStorage.getItem('quickSimCommentarySpeed');
  const defaultSpeed = '3'; // New default is 3
  speedSelect.value = savedSpeed || defaultSpeed;
  
  // Save preference when changed
  speedSelect.addEventListener('change', (e) => {
    localStorage.setItem('quickSimCommentarySpeed', e.target.value);
  });
  
  return overlay;
}
