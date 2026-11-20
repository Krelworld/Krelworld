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

// Driving Minigame
async function startDrivingMinigame() {
  return new Promise((resolve) => {
    // Pause background music if playing
    let wasBackgroundMusicPlaying = false;
    if (typeof window._stopGeneralMusic === 'function') {
      // Check if music was playing before stopping
      if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
        wasBackgroundMusicPlaying = true;
      }
      window._stopGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
      wasBackgroundMusicPlaying = true;
      generalMusicAudio.pause();
    }
    
    // Create game overlay
    const gameOverlay = document.createElement('div');
    gameOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 99999;
      font-family: Arial, sans-serif;
    `;
    
    // Create audio elements for minigame music
    const driveMusic = new Audio('https://www.dropbox.com/scl/fi/oopdvy9ds0jn8ggvinajg/drive.mp3?rlkey=dhwb05jlasu8lbydyeo2q1i1b&st=4vn3xtsa&dl=1');
    driveMusic.loop = true;
    driveMusic.volume = 0.7;
    
    const woodlandMusic = new Audio('https://www.dropbox.com/scl/fi/orbq7amtkghp0oz63ojou/woodland.mp3?rlkey=liynvhguurwrwooskhtlw3pg4&st=lnnjai4c&dl=1');
    woodlandMusic.loop = false;
    woodlandMusic.volume = 0.7;
    
    // Start playing the driving song
    driveMusic.play().catch(err => {
    });
    
    // Create canvas - use viewport size to fit screen
    const canvas = document.createElement('canvas');
    const viewportWidth = Math.min(1800, window.innerWidth - 40);
    const viewportHeight = Math.min(1200, window.innerHeight - 200); // Leave space for UI
    canvas.width = viewportWidth;
    canvas.height = viewportHeight;
    canvas.style.cssText = `
      display: block;
      margin: 0 auto;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border: 3px solid #FFD700;
      box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
    `;
    
    const ctx = canvas.getContext('2d');
    
    // World dimensions (larger than viewport for scrolling)
    const worldWidth = 3600;
    const worldHeight = 3000;
    
    // Camera/viewport system
    const camera = {
      x: 0,
      y: 0,
      width: viewportWidth,
      height: viewportHeight
    };
    
    // Game state
    const gameState = {
      car: {
        x: 100,
        y: 400,
        width: 60,
        height: 100,
        speed: 0,
        maxSpeed: 8,
        acceleration: 0.2,
        deceleration: 0.15,
        angle: 0
      },
      obstacles: [],
      timer: 45, // 45 seconds countdown
      currentDestination: 0, // 0 = Strip University, 1 = St Mary's
      destinations: [
        { name: 'Strip University', x: 3000, y: 600, reached: false },
        { name: 'St Mary\'s Stadium', x: 3000, y: 2400, reached: false }
      ],
      currentLocation: 'Houses of Parliament',
      beerBoost: 0,
      beerCooldown: 0,
      gameOver: false,
      won: false,
      crittersHit: 0,
      lastObstacleSpawn: 0,
      cutsceneActive: false,
      gamePaused: false
    };
    
    // Update camera to follow car
    function updateCamera() {
      // Center camera on car
      camera.x = gameState.car.x - camera.width / 2;
      camera.y = gameState.car.y - camera.height / 2;
      
      // Clamp camera to world bounds
      camera.x = Math.max(0, Math.min(camera.x, worldWidth - camera.width));
      camera.y = Math.max(0, Math.min(camera.y, worldHeight - camera.height));
    }
    
    // UI elements - always visible at top
    const uiContainer = document.createElement('div');
    uiContainer.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      right: 20px;
      color: white;
      font-size: 20px;
      z-index: 100002;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      pointer-events: none;
    `;
    
    const leftUI = document.createElement('div');
    leftUI.style.cssText = `display: flex; flex-direction: column; gap: 10px;`;
    
    const timerDisplay = document.createElement('div');
    timerDisplay.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
    `;
    
    const destinationDisplay = document.createElement('div');
    destinationDisplay.style.cssText = `font-size: 18px; color: #fff;`;
    
    const speedDisplay = document.createElement('div');
    speedDisplay.style.cssText = `font-size: 16px; color: #aaa;`;
    
    const crittersDisplay = document.createElement('div');
    crittersDisplay.style.cssText = `font-size: 16px; color: #ff6b6b;`;
    
    const rightUI = document.createElement('div');
    rightUI.style.cssText = `display: flex; flex-direction: column; gap: 10px; align-items: flex-end;`;
    
    const beerButton = document.createElement('button');
    beerButton.textContent = '🍺 DRINK BEER (FOR CONFIDENCE)';
    beerButton.style.cssText = `
      padding: 15px 30px;
      font-size: 18px;
      font-weight: bold;
      background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
      color: #FFD700;
      border: 2px solid #FFD700;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
      pointer-events: auto;
    `;
    
    beerButton.addEventListener('mouseenter', () => {
      beerButton.style.transform = 'scale(1.05)';
      beerButton.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.7)';
    });
    
    beerButton.addEventListener('mouseleave', () => {
      beerButton.style.transform = 'scale(1)';
      beerButton.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.4)';
    });
    
    beerButton.addEventListener('click', () => {
      if (gameState.beerCooldown <= 0 && !gameState.gameOver) {
        gameState.beerBoost = 300; // 5 seconds at 60fps
        gameState.beerCooldown = 600; // 10 second cooldown
        gameState.car.maxSpeed = 12; // Increased max speed
        log("You chug a beer for confidence! Speed boost activated!");
      }
    });
    
    const warningDisplay = document.createElement('div');
    warningDisplay.style.cssText = `
      font-size: 14px;
      color: #ffaa00;
      text-align: right;
      max-width: 300px;
      margin-top: 10px;
    `;
    warningDisplay.textContent = '⚠️ Don\'t go too fast - you might harm a squirrel or other woodland critter!';
    
    leftUI.appendChild(timerDisplay);
    leftUI.appendChild(destinationDisplay);
    leftUI.appendChild(speedDisplay);
    leftUI.appendChild(crittersDisplay);
    
    rightUI.appendChild(beerButton);
    rightUI.appendChild(warningDisplay);
    
    uiContainer.appendChild(leftUI);
    uiContainer.appendChild(rightUI);
    
    gameOverlay.appendChild(canvas);
    gameOverlay.appendChild(uiContainer);
    document.body.appendChild(gameOverlay);
    
    // Input handling
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });
    
    // Obstacle types
    const obstacleTypes = [
      { name: 'squirrel', color: '#8B4513', size: 20 },
      { name: 'rabbit', color: '#D3D3D3', size: 25 },
      { name: 'hedgehog', color: '#696969', size: 22 },
      { name: 'badger', color: '#2F2F2F', size: 30 }
    ];
    
    function spawnObstacle() {
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      gameState.obstacles.push({
        x: Math.random() * (worldWidth - 100) + 50,
        y: Math.random() * (worldHeight - 100) + 50,
        type: type.name,
        color: type.color,
        size: type.size,
        speed: 1 + Math.random() * 2
      });
    }
    
    // Initialize obstacles (more for bigger map)
    for (let i = 0; i < 25; i++) {
      spawnObstacle();
    }
    
    // Cutscene function for burying woodland critters
    async function showBurialCutscene(critterType, critterColor, critterSize) {
      // Stop general music during cutscene
      if (typeof window._stopGeneralMusic === 'function') {
        window._stopGeneralMusic();
      }
      
      // Pause driving music and play woodland music
      driveMusic.pause();
      woodlandMusic.currentTime = 0; // Reset to start
      woodlandMusic.play().catch(err => {
      });
      
      return new Promise((resolveCutscene) => {
        gameState.cutsceneActive = true;
        gameState.gamePaused = true;
        
        const cutsceneOverlay = document.createElement('div');
        cutsceneOverlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          z-index: 100001;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-family: Arial, sans-serif;
        `;
        
        const cutsceneCanvas = document.createElement('canvas');
        cutsceneCanvas.width = 1200;
        cutsceneCanvas.height = 800;
        cutsceneCanvas.style.cssText = `
          border: 3px solid #8B4513;
          box-shadow: 0 0 30px rgba(139, 69, 19, 0.6);
        `;
        
        const cutsceneCtx = cutsceneCanvas.getContext('2d');
        let cutscenePhase = 0;
        let cutsceneTimer = 0;
        
        const cutsceneText = document.createElement('div');
        cutsceneText.style.cssText = `
          color: #fff;
          font-size: 24px;
          text-align: center;
          margin-top: 0;
          margin-bottom: 20px;
          max-width: 800px;
          line-height: 1.6;
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100003;
        `;
        
        cutsceneOverlay.appendChild(cutsceneText);
        cutsceneOverlay.appendChild(cutsceneCanvas);
        document.body.appendChild(cutsceneOverlay);
        
        function drawCutscene() {
          cutsceneCtx.fillStyle = '#2d5016';
          cutsceneCtx.fillRect(0, 0, cutsceneCanvas.width, cutsceneCanvas.height);
          
          // Draw trees in background
          for (let i = 0; i < 8; i++) {
            const x = (i * 150) + 50;
            const y = 100;
            cutsceneCtx.fillStyle = '#654321';
            cutsceneCtx.fillRect(x, y, 30, 200);
            cutsceneCtx.fillStyle = '#228B22';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(x + 15, y, 60, 0, Math.PI * 2);
            cutsceneCtx.fill();
          }
          
          if (cutscenePhase === 0) {
            // Phase 0: You approach the critter
            cutsceneText.textContent = `You stop the car and approach the ${critterType}...`;
            
            // Draw car in background
            cutsceneCtx.fillStyle = '#ff0000';
            cutsceneCtx.fillRect(200, 500, 80, 120);
            
            // Draw critter on ground
            cutsceneCtx.fillStyle = critterColor;
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(600, 600, critterSize, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            // Draw player approaching
            const playerX = 400 + (cutsceneTimer * 2);
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            if (cutsceneTimer > 100) {
              cutscenePhase = 1;
              cutsceneTimer = 0;
            }
          } else if (cutscenePhase === 1) {
            // Phase 1: Picking up the critter
            cutsceneText.textContent = `You gently pick up the ${critterType}...`;
            
            const playerX = 600;
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            // Critter being held
            const critterY = 520 - (cutsceneTimer * 2);
            cutsceneCtx.fillStyle = critterColor;
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, critterY, critterSize, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            if (cutsceneTimer > 60) {
              cutscenePhase = 2;
              cutsceneTimer = 0;
            }
          } else if (cutscenePhase === 2) {
            // Phase 2: Digging the grave
            cutsceneText.textContent = `You find a peaceful spot and begin digging a grave...`;
            
            const graveX = 800;
            const graveY = 600;
            const graveDepth = cutsceneTimer * 2;
            
            // Draw hole
            cutsceneCtx.fillStyle = '#3d2817';
            cutsceneCtx.fillRect(graveX - 40, graveY, 80, graveDepth);
            cutsceneCtx.strokeStyle = '#654321';
            cutsceneCtx.lineWidth = 3;
            cutsceneCtx.strokeRect(graveX - 40, graveY, 80, graveDepth);
            
            // Draw dirt pile
            cutsceneCtx.fillStyle = '#8B4513';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(graveX + 60, graveY + 20, 30, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            // Draw player digging
            const playerX = graveX - 20;
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            // Shovel animation
            const shovelAngle = Math.sin(cutsceneTimer * 0.2) * 0.3;
            cutsceneCtx.save();
            cutsceneCtx.translate(playerX + 30, 580);
            cutsceneCtx.rotate(shovelAngle);
            cutsceneCtx.fillStyle = '#696969';
            cutsceneCtx.fillRect(0, 0, 5, 40);
            cutsceneCtx.fillStyle = '#8B4513';
            cutsceneCtx.fillRect(-5, 40, 15, 8);
            cutsceneCtx.restore();
            
            if (cutsceneTimer > 120) {
              cutscenePhase = 3;
              cutsceneTimer = 0;
            }
          } else if (cutscenePhase === 3) {
            // Phase 3: Placing the critter in the grave
            cutsceneText.textContent = `You carefully place the ${critterType} in the grave...`;
            
            const graveX = 800;
            const graveY = 600;
            
            // Draw grave
            cutsceneCtx.fillStyle = '#3d2817';
            cutsceneCtx.fillRect(graveX - 40, graveY, 80, 240);
            cutsceneCtx.strokeStyle = '#654321';
            cutsceneCtx.lineWidth = 3;
            cutsceneCtx.strokeRect(graveX - 40, graveY, 80, 240);
            
            // Critter in grave (moving down)
            const critterY = 520 - (cutsceneTimer * 3);
            cutsceneCtx.fillStyle = critterColor;
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(graveX, Math.max(critterY, graveY + 100), critterSize, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            // Draw player
            const playerX = graveX - 20;
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            if (cutsceneTimer > 80) {
              cutscenePhase = 4;
              cutsceneTimer = 0;
            }
          } else if (cutscenePhase === 4) {
            // Phase 4: Burying the critter
            cutsceneText.textContent = `You cover the grave with earth, saying a quiet prayer...`;
            
            const graveX = 800;
            const graveY = 600;
            
            // Draw grave with dirt being filled
            cutsceneCtx.fillStyle = '#3d2817';
            cutsceneCtx.fillRect(graveX - 40, graveY, 80, 240);
            cutsceneCtx.strokeStyle = '#654321';
            cutsceneCtx.lineWidth = 3;
            cutsceneCtx.strokeRect(graveX - 40, graveY, 80, 240);
            
            // Dirt filling animation
            const fillHeight = cutsceneTimer * 3;
            cutsceneCtx.fillStyle = '#8B4513';
            cutsceneCtx.fillRect(graveX - 38, graveY + 240 - fillHeight, 76, fillHeight);
            
            // Draw player
            const playerX = graveX - 20;
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            if (cutsceneTimer > 80) {
              cutscenePhase = 5;
              cutsceneTimer = 0;
            }
          } else if (cutscenePhase === 5) {
            // Phase 5: Finished grave with marker
            cutsceneText.innerHTML = `<strong style="color: #FFD700; font-size: 28px;">"its the right thing to do"</strong><br><br>You place a small wooden cross on the grave and bow your head in respect.`;
            
            const graveX = 800;
            const graveY = 600;
            
            // Draw filled grave
            cutsceneCtx.fillStyle = '#8B4513';
            cutsceneCtx.fillRect(graveX - 40, graveY, 80, 240);
            cutsceneCtx.strokeStyle = '#654321';
            cutsceneCtx.lineWidth = 3;
            cutsceneCtx.strokeRect(graveX - 40, graveY, 80, 240);
            
            // Draw wooden cross
            cutsceneCtx.fillStyle = '#8B4513';
            cutsceneCtx.fillRect(graveX - 3, graveY - 40, 6, 50);
            cutsceneCtx.fillRect(graveX - 15, graveY - 30, 30, 6);
            
            // Draw player
            const playerX = graveX - 20;
            cutsceneCtx.fillStyle = '#4169E1';
            cutsceneCtx.fillRect(playerX, 550, 40, 80);
            cutsceneCtx.fillStyle = '#FFD700';
            cutsceneCtx.beginPath();
            cutsceneCtx.arc(playerX + 20, 560, 15, 0, Math.PI * 2);
            cutsceneCtx.fill();
            
            if (cutsceneTimer > 120) {
              cutscenePhase = 6;
              cutsceneTimer = 0;
            }
          } else {
            // Phase 6: Fade out and return
            const alpha = 1 - (cutsceneTimer / 60);
            cutsceneOverlay.style.opacity = alpha;
            
            if (cutsceneTimer > 60) {
              cutsceneOverlay.remove();
              gameState.cutsceneActive = false;
              gameState.gamePaused = false;
              // Stop woodland music and resume driving music
              woodlandMusic.pause();
              woodlandMusic.currentTime = 0;
              driveMusic.play().catch(err => {
              });
              // Resume general music after cutscene ends
              if (typeof window._startGeneralMusic === 'function') {
                setTimeout(() => {
                  window._startGeneralMusic();
                }, 500);
              }
              resolveCutscene();
              return;
            }
          }
          
          cutsceneTimer++;
          requestAnimationFrame(drawCutscene);
        }
        
        drawCutscene();
      });
    }
    
    function updateCar() {
      // Handle input
      if (keys['w'] || keys['arrowup']) {
        gameState.car.speed = Math.min(gameState.car.speed + gameState.car.acceleration, gameState.car.maxSpeed);
      } else if (keys['s'] || keys['arrowdown']) {
        gameState.car.speed = Math.max(gameState.car.speed - gameState.car.acceleration, -gameState.car.maxSpeed * 0.6);
      } else {
        // Natural deceleration
        if (gameState.car.speed > 0) {
          gameState.car.speed = Math.max(0, gameState.car.speed - gameState.car.deceleration);
        } else if (gameState.car.speed < 0) {
          gameState.car.speed = Math.min(0, gameState.car.speed + gameState.car.deceleration);
        }
      }
      
      if (keys['a'] || keys['arrowleft']) {
        gameState.car.angle -= 0.05;
      }
      if (keys['d'] || keys['arrowright']) {
        gameState.car.angle += 0.05;
      }
      
      // Update position
      gameState.car.x += Math.cos(gameState.car.angle) * gameState.car.speed;
      gameState.car.y += Math.sin(gameState.car.angle) * gameState.car.speed;
      
      // Boundary checking (use world dimensions)
      gameState.car.x = Math.max(gameState.car.width / 2, Math.min(worldWidth - gameState.car.width / 2, gameState.car.x));
      gameState.car.y = Math.max(gameState.car.height / 2, Math.min(worldHeight - gameState.car.height / 2, gameState.car.y));
      
      // Update camera to follow car
      updateCamera();
      
      // Beer boost countdown
      if (gameState.beerBoost > 0) {
        gameState.beerBoost--;
        if (gameState.beerBoost === 0) {
          gameState.car.maxSpeed = 8; // Reset to normal
          log("Beer boost wears off...");
        }
      }
      
      if (gameState.beerCooldown > 0) {
        gameState.beerCooldown--;
      }
    }
    
    function updateObstacles() {
      // Move obstacles randomly
      gameState.obstacles.forEach(obstacle => {
        obstacle.x += (Math.random() - 0.5) * obstacle.speed;
        obstacle.y += (Math.random() - 0.5) * obstacle.speed;
        
        // Keep obstacles in bounds (use world dimensions)
        obstacle.x = Math.max(obstacle.size, Math.min(worldWidth - obstacle.size, obstacle.x));
        obstacle.y = Math.max(obstacle.size, Math.min(worldHeight - obstacle.size, obstacle.y));
      });
      
      // Spawn new obstacles periodically (more for bigger map)
      if (Date.now() - gameState.lastObstacleSpawn > 2000) {
        if (gameState.obstacles.length < 35) {
          spawnObstacle();
        }
        gameState.lastObstacleSpawn = Date.now();
      }
    }
    
    async function checkCollisions() {
      const carRect = {
        x: gameState.car.x - gameState.car.width / 2,
        y: gameState.car.y - gameState.car.height / 2,
        width: gameState.car.width,
        height: gameState.car.height
      };
      
      // Check collision with obstacles (only if moving fast)
      if (Math.abs(gameState.car.speed) > 3 && !gameState.cutsceneActive) {
        for (let index = gameState.obstacles.length - 1; index >= 0; index--) {
          const obstacle = gameState.obstacles[index];
          const dx = gameState.car.x - obstacle.x;
          const dy = gameState.car.y - obstacle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < (gameState.car.width / 2 + obstacle.size)) {
            gameState.crittersHit++;
            const hitCritter = { ...obstacle };
            gameState.obstacles.splice(index, 1);
            
            // Stop the car
            gameState.car.speed = 0;
            
            // Show burial cutscene
            await showBurialCutscene(hitCritter.type, hitCritter.color, hitCritter.size);
            
            // Apply big time penalty (20 seconds)
            gameState.timer = Math.max(0, gameState.timer - 20);
            log(`You took the time to properly bury the ${hitCritter.type}. It's the right thing to do. (-20 seconds)`);
            
            spawnObstacle(); // Replace the hit obstacle
            break; // Only process one collision per frame
          }
        }
      }
      
      // Check if reached destination
      const currentDest = gameState.destinations[gameState.currentDestination];
      if (!currentDest.reached) {
        const dx = gameState.car.x - currentDest.x;
        const dy = gameState.car.y - currentDest.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) {
          currentDest.reached = true;
          if (gameState.currentDestination === 0) {
            log("You've picked up your daughter from Strip University! Now get to St Mary's Stadium!");
            gameState.currentLocation = 'Strip University';
            gameState.currentDestination = 1;
          } else {
            log("You've reached St Mary's Stadium! You made it in time!");
            gameState.won = true;
            gameState.gameOver = true;
          }
        }
      }
    }
    
    function draw() {
      // Clear canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Save context and apply camera transform
      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      
      // Draw road pattern (world coordinates)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      for (let i = 0; i < worldWidth; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, worldHeight);
        ctx.stroke();
      }
      
      // Draw destination markers
      gameState.destinations.forEach((dest, index) => {
        if (!dest.reached) {
          // Check if destination is in view
          const destInView = dest.x >= camera.x && dest.x <= camera.x + camera.width &&
                            dest.y >= camera.y && dest.y <= camera.y + camera.height;
          
          if (destInView) {
            // Draw destination marker
            ctx.fillStyle = index === gameState.currentDestination ? '#00ff00' : '#666';
            ctx.beginPath();
            ctx.arc(dest.x, dest.y, 50, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw destination label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(dest.name, dest.x, dest.y - 60);
          } else {
            // Draw arrow indicator pointing to destination
            ctx.restore(); // Temporarily restore to draw UI elements
            ctx.save();
            
            // Calculate direction to destination
            const dx = dest.x - gameState.car.x;
            const dy = dest.y - gameState.car.y;
            const angle = Math.atan2(dy, dx);
            
            // Position arrow at edge of screen pointing to destination
            const edgePadding = 40;
            let arrowX, arrowY;
            if (Math.abs(dx) > Math.abs(dy)) {
              // Horizontal edge
              arrowX = dx > 0 ? canvas.width - edgePadding : edgePadding;
              arrowY = canvas.height / 2 + (dy / Math.abs(dx)) * (canvas.width / 2 - edgePadding);
            } else {
              // Vertical edge
              arrowX = canvas.width / 2 + (dx / Math.abs(dy)) * (canvas.height / 2 - edgePadding);
              arrowY = dy > 0 ? canvas.height - edgePadding : edgePadding;
            }
            
            // Clamp to screen bounds
            arrowX = Math.max(edgePadding, Math.min(canvas.width - edgePadding, arrowX));
            arrowY = Math.max(edgePadding, Math.min(canvas.height - edgePadding, arrowY));
            
            // Draw arrow
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);
            ctx.fillStyle = index === gameState.currentDestination ? '#00ff00' : '#666';
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(-10, -10);
            ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw label near arrow
            ctx.restore();
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(dest.name, arrowX, arrowY - 25);
            
            ctx.restore();
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
          }
        } else {
          // Draw checkmark if in view
          if (dest.x >= camera.x && dest.x <= camera.x + camera.width &&
              dest.y >= camera.y && dest.y <= camera.y + camera.height) {
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('✓', dest.x, dest.y + 15);
          }
        }
      });
      
      // Draw obstacles
      gameState.obstacles.forEach(obstacle => {
        // Only draw if in view
        if (obstacle.x >= camera.x - obstacle.size && obstacle.x <= camera.x + camera.width + obstacle.size &&
            obstacle.y >= camera.y - obstacle.size && obstacle.y <= camera.y + camera.height + obstacle.size) {
          ctx.fillStyle = obstacle.color;
          ctx.beginPath();
          ctx.arc(obstacle.x, obstacle.y, obstacle.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw simple face
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(obstacle.x - 5, obstacle.y - 3, 3, 0, Math.PI * 2);
          ctx.arc(obstacle.x + 5, obstacle.y - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Draw car
      ctx.save();
      ctx.translate(gameState.car.x, gameState.car.y);
      ctx.rotate(gameState.car.angle);
      
      // Car body
      ctx.fillStyle = gameState.beerBoost > 0 ? '#FFD700' : '#ff0000';
      ctx.fillRect(-gameState.car.width / 2, -gameState.car.height / 2, gameState.car.width, gameState.car.height);
      
      // Car windows
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(-gameState.car.width / 2 + 5, -gameState.car.height / 2 + 10, gameState.car.width - 10, 30);
      ctx.fillRect(-gameState.car.width / 2 + 5, gameState.car.height / 2 - 40, gameState.car.width - 10, 30);
      
      // Car wheels
      ctx.fillStyle = '#000';
      ctx.fillRect(-gameState.car.width / 2 - 5, -gameState.car.height / 2 + 20, 8, 15);
      ctx.fillRect(gameState.car.width / 2 - 3, -gameState.car.height / 2 + 20, 8, 15);
      ctx.fillRect(-gameState.car.width / 2 - 5, gameState.car.height / 2 - 35, 8, 15);
      ctx.fillRect(gameState.car.width / 2 - 3, gameState.car.height / 2 - 35, 8, 15);
      
      ctx.restore();
      
      // Draw speed lines if moving fast
      if (Math.abs(gameState.car.speed) > 5) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const angle = gameState.car.angle + Math.PI;
          const x = gameState.car.x + Math.cos(angle) * (gameState.car.height / 2 + 20 + i * 15);
          const y = gameState.car.y + Math.sin(angle) * (gameState.car.height / 2 + 20 + i * 15);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle + Math.PI / 2) * 10, y + Math.sin(angle + Math.PI / 2) * 10);
          ctx.stroke();
        }
      }
      
      // Restore context (remove camera transform)
      ctx.restore();
    }
    
    function updateUI() {
      const minutes = Math.floor(gameState.timer / 60);
      const seconds = Math.floor(gameState.timer % 60);
      timerDisplay.textContent = `⏰ ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} - NUCLEAR ARMAGEDDON`;
      
      const currentDest = gameState.destinations[gameState.currentDestination];
      destinationDisplay.textContent = `📍 Current: ${gameState.currentLocation} → Next: ${currentDest.name}`;
      
      speedDisplay.textContent = `🚗 Speed: ${Math.abs(gameState.car.speed).toFixed(1)} / ${gameState.car.maxSpeed}`;
      
      if (gameState.crittersHit > 0) {
        crittersDisplay.textContent = `⚠️ Critters Harmed: ${gameState.crittersHit}`;
      } else {
        crittersDisplay.textContent = `✅ No critters harmed`;
      }
      
      if (gameState.beerBoost > 0) {
        beerButton.textContent = `🍺 BEER BOOST ACTIVE! (${Math.ceil(gameState.beerBoost / 60)}s)`;
        beerButton.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
        beerButton.style.color = '#000';
      } else if (gameState.beerCooldown > 0) {
        beerButton.textContent = `🍺 COOLDOWN (${Math.ceil(gameState.beerCooldown / 60)}s)`;
        beerButton.style.background = 'linear-gradient(135deg, #555 0%, #333 100%)';
        beerButton.style.color = '#888';
      } else {
        beerButton.textContent = '🍺 DRINK BEER (FOR CONFIDENCE)';
        beerButton.style.background = 'linear-gradient(135deg, #8B4513 0%, #654321 100%)';
        beerButton.style.color = '#FFD700';
      }
    }
    
    function gameLoop() {
      if (gameState.gameOver) {
        // Show game over screen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = gameState.won ? '#00ff00' : '#ff0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
          gameState.won ? 'YOU MADE IT!' : 'NUCLEAR ARMAGEDDON!',
          canvas.width / 2,
          canvas.height / 2 - 50
        );
        
        ctx.fillStyle = '#fff';
        ctx.font = '24px Arial';
        ctx.fillText(
          gameState.won 
            ? 'You successfully delivered your daughter to St Mary\'s Stadium!'
            : 'You ran out of time. The nukes have landed.',
          canvas.width / 2,
          canvas.height / 2 + 20
        );
        
        if (gameState.crittersHit > 0) {
          ctx.fillStyle = '#ffaa00';
          ctx.font = '20px Arial';
          ctx.fillText(
            `You harmed ${gameState.crittersHit} woodland critter${gameState.crittersHit > 1 ? 's' : ''}. The forest remembers...`,
            canvas.width / 2,
            canvas.height / 2 + 60
          );
        }
        
        // Add restart button if failed
        if (!gameState.won) {
          const restartButton = document.createElement('button');
          restartButton.textContent = '🔄 RESTART MINI GAME';
          restartButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, 200%);
            padding: 15px 30px;
            font-size: 20px;
            font-weight: bold;
            background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);
            color: #fff;
            border: 3px solid #fff;
            border-radius: 8px;
            cursor: pointer;
            z-index: 100003;
            pointer-events: auto;
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
          `;
          
          restartButton.addEventListener('click', () => {
            // Stop minigame music
            driveMusic.pause();
            driveMusic.currentTime = 0;
            woodlandMusic.pause();
            woodlandMusic.currentTime = 0;
            
            gameOverlay.remove();
            // Don't resume background music here - the restart will pause it again
            // Restart the minigame
            startDrivingMinigame().then(() => {
              resolve();
            });
          });
          
          gameOverlay.appendChild(restartButton);
        }
        
        ctx.fillStyle = '#aaa';
        ctx.font = '18px Arial';
        ctx.fillText(
          gameState.won ? 'Click anywhere to continue...' : 'Click RESTART button to try again',
          canvas.width / 2,
          canvas.height / 2 + 120
        );
        
        if (gameState.won) {
          // Instead of clicking to continue, show the Kreplin Protocol UI
          canvas.addEventListener('click', () => {
            // Stop minigame music
            driveMusic.pause();
            driveMusic.currentTime = 0;
            woodlandMusic.pause();
            woodlandMusic.currentTime = 0;
            
            gameOverlay.remove();
            // Resume background music if it was playing
            if (wasBackgroundMusicPlaying) {
              if (typeof window._startGeneralMusic === 'function') {
                window._startGeneralMusic();
              } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
                generalMusicAudio.play().catch(err => {
                });
              }
            }
            showKreplinProtocolUI().then(() => {
              resolve();
            });
          }, { once: true });
        }
        
        return;
      }
      
      // Update timer even during cutscenes (timer continues to count down)
      gameState.timer -= 1.2/60; // 20% faster countdown
      if (gameState.timer <= 0) {
        gameState.timer = 0;
        gameState.gameOver = true;
        gameState.won = false;
      }
      
      // Update UI even during cutscenes so timer is visible
      updateUI();
      
      // Don't update game logic if cutscene is active
      if (gameState.gamePaused || gameState.cutsceneActive) {
        draw();
        requestAnimationFrame(gameLoop);
        return;
      }
      
      updateCar();
      updateObstacles();
      checkCollisions();
      draw();
      
      requestAnimationFrame(gameLoop);
    }
    
    // Start game loop
    gameLoop();
    
    // Initial log
    log("You're in the car! Drive carefully - avoid the woodland critters!");
    log("Use WASD or Arrow Keys to drive. Press W/Up to accelerate, S/Down to reverse.");
  });
}

async function playMatchPhaseWithTaunts(){
  if (!S.matchContext || !S.matchContext.team) {
    S.matchContext = currentOpponent();
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
  
  // Drinking decision before match
  log("You have a moment before the match begins...");
  const drinkChoice = await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a relaxing drink of beer' }
  ], 'Pre-match preparation');
  
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
    log("You stay focused and sober. Your taunts will be more measured and appropriate.");
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
