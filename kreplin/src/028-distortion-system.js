// ========== DISTORTION SYSTEM ==========
// Helper function to check if distortion should be active
function isDistortionActive() {
  return !!(window.S && window.S.season3 && window.S.season3.player_coma_between_seasons === true);
}

// Apply UI distortion class to body
function applyUIDistortion() {
  if (isDistortionActive()) {
    document.body.classList.add('distortion-active');
    // Apply random drift values to CSS variables
    const driftX = (Math.random() * 3 + 1) * (Math.random() < 0.5 ? 1 : -1); // 1-3px
    const driftY = (Math.random() * 3 + 1) * (Math.random() < 0.5 ? 1 : -1); // 1-3px
    document.documentElement.style.setProperty('--drift-x', `${driftX}px`);
    document.documentElement.style.setProperty('--drift-y', `${driftY}px`);
  } else {
    document.body.classList.remove('distortion-active');
  }
}

// Apply text distortions to log messages
function applyTextDistortion(msg) {
  if (!isDistortionActive() || typeof msg !== 'string') return msg;
  
  let distorted = msg;
  
  // Never explicitly say "coma" - replace with alternatives
  distorted = distorted.replace(/\bcoma\b/gi, (match) => {
    const alternatives = ['unconscious state', 'medical condition', 'extended absence', 'hospital stay'];
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  });
  
  // Truncate headlines (look for <strong> tags or headlines)
  if (distorted.includes('<strong>') || distorted.match(/^[A-Z][^.!?]*[.!?]/)) {
    // Random chance to truncate
    if (Math.random() < 0.3) {
      const words = distorted.split(' ');
      const truncateAt = Math.floor(Math.random() * (words.length * 0.4) + words.length * 0.3);
      distorted = words.slice(0, truncateAt).join(' ') + '...';
    }
  }
  
  // "(memory missing)" substitutions - random chance to replace parts
  if (Math.random() < 0.15) {
    // Replace random phrases with "(memory missing)"
    const phrases = distorted.match(/[^<>]+/g) || [];
    if (phrases.length > 0) {
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      if (randomPhrase.length > 10 && !randomPhrase.includes('memory missing')) {
        distorted = distorted.replace(randomPhrase, '(memory missing)');
      }
    }
  }
  
  return distorted;
}

// Track last log message for duplication
let lastLogMessage = null;
let duplicateLogCount = 0;

// ========== NARRATIVE DISTORTION FUNCTIONS ==========


// Modify emails to imply decisions already made
function applyEmailDistortion(emailText) {
  if (!isDistortionActive() || typeof emailText !== 'string') return emailText;
  
  let distorted = emailText;
  
  // Add phrases that imply decisions were already made
  const implications = [
    'As we discussed,',
    'Following your earlier decision,',
    'In light of your previous choice,',
    'Given what you decided,',
    'As per your instructions,'
  ];
  
  if (Math.random() < 0.4 && !distorted.includes('As we discussed')) {
    const implication = implications[Math.floor(Math.random() * implications.length)];
    distorted = implication + ' ' + distorted.charAt(0).toLowerCase() + distorted.slice(1);
  }
  
  return distorted;
}

// Rare pre-revealed match results
let preRevealedMatchResult = null;

function maybePreRevealMatchResult() {
  if (!isDistortionActive()) return null;
  
  // Rare chance (5%) to pre-reveal a match result
  if (Math.random() < 0.05 && !preRevealedMatchResult) {
    // Generate a fake result
    const ourGoals = Math.floor(Math.random() * 4);
    const theirGoals = Math.floor(Math.random() * 4);
    const opponent = currentOpponent()?.team || 'Opponent';
    
    preRevealedMatchResult = {
      ourGoals,
      theirGoals,
      opponent,
      revealed: true
    };
    
    log(`(memory missing) ${opponent} ${ourGoals}-${theirGoals} (memory missing)`);
    return preRevealedMatchResult;
  }
  
  return null;
}

// Internal Email Templates A-D
const INTERNAL_EMAIL_TEMPLATES = {
  A: `Subject: Internal Communication - Status Update

This is an internal communication regarding recent developments. The situation has been assessed and appropriate measures have been taken.

Further updates will follow as necessary.

End of message.`,
  
  B: `Subject: Internal Communication - Operational Review

An internal review has been conducted. The findings indicate that current operations are proceeding according to established parameters.

No immediate action required at this time.

End of message.`,
  
  C: `Subject: Internal Communication - Process Completion

The previously discussed matter has been resolved. All relevant parties have been notified and the necessary documentation has been updated.

This matter is now considered closed.

End of message.`,
  
  D: `Subject: Internal Communication - Status Confirmation

Internal systems confirm that all processes are functioning within expected parameters. The recent developments have been logged and archived appropriately.

Standard protocols remain in effect.

End of message.`
};

// Function to send internal email
function sendInternalEmail(templateKey) {
  if (!isDistortionActive()) return;
  
  const template = INTERNAL_EMAIL_TEMPLATES[templateKey] || INTERNAL_EMAIL_TEMPLATES.A;
  log(`<div style="border-left: 3px solid #6366f1; padding-left: 12px; margin: 8px 0; font-family: monospace; font-size: 0.9em; opacity: 0.9;">${template}</div>`);
}

// Public log(): lets 'log:veto' handlers swallow a line, writes it, then emits 'log'.
function log(msg) {
  if (GameHooks.veto('log:veto', msg)) return;
  const ret = writeLog(msg);
  GameHooks.emit('log', msg);
  return ret;
}

function writeLog(msg) {
    const currentTime = Date.now();
    const timeSinceLastLog = currentTime - lastLogTime;
    
    // Apply Season 4 linguistic overlay (before other distortions)
    // Function now handles its own filtering for character interactions only
    if (S && S.season >= 4 && typeof msg === 'string' && !msg.includes('<strong>📡') && !msg.includes('Mohammed Van Onslaught')) {
        msg = applySeason4LinguisticOverlay(msg);
    }
    
    // Apply text distortion if active
    let distortedMsg = msg;
    if (isDistortionActive() && typeof msg === 'string') {
        distortedMsg = applyTextDistortion(msg);
        
        // Apply email distortion if this looks like an email
        if (distortedMsg.toLowerCase().includes('email') || distortedMsg.includes('@') || distortedMsg.includes('Subject:')) {
            distortedMsg = applyEmailDistortion(distortedMsg);
        }
        
        // Duplicate log lines - random chance
        if (Math.random() < 0.2 && msg === lastLogMessage) {
            duplicateLogCount++;
            // Add duplicate to queue
            logQueue.push({
                message: distortedMsg,
                timestamp: now(),
                isBurst: timeSinceLastLog < BURST_THRESHOLD,
                isGoal: false,
                isDuplicate: true
            });
        }
        lastLogMessage = msg;
    }
    
    // Check if this is a goal message
    const isGoal = typeof distortedMsg === 'string' && (
        distortedMsg.includes('GOAL!') || 
        distortedMsg.includes('scores!') || 
        distortedMsg.includes('scores for')
    );
    
    // Add to queue
    logQueue.push({
        message: distortedMsg,
        timestamp: now(), // Use the existing now() function for formatted timestamp
        isBurst: timeSinceLastLog < BURST_THRESHOLD,
        isGoal: isGoal
    });
    
    lastLogTime = currentTime;
    
    // Show pending indicator if this is part of a burst
    if (logQueue.length > 1) {
        showPendingIndicator();
    }
    
    // Start processing if not already running
    if (!isProcessingQueue) {
        processLogQueue();
    }
}

async function processLogQueue() {
    isProcessingQueue = true;
    
    while (logQueue.length > 0) {
        const entry = logQueue.shift();
        await displayLogEntry(entry);
        
        // Add extra delay for goal entries to make them more prominent
        if (window.__logFastForward) {
            // player asked to skip ahead: no pacing delays
        } else if (entry.isGoal) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds for goals
        } else if (entry.isBurst && logQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
    
    // Hide pending indicator when done
    hidePendingIndicator();
    isProcessingQueue = false;
    window.__logFastForward = false;
}

function showPendingIndicator() {
    let indicator = document.getElementById('pending-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'pending-indicator';
        indicator.className = 'pending-indicator';
        indicator.innerHTML = '<div class="pending-text">More events incoming...</div><button type="button" class="k-ff">Skip ahead ▸▸</button>';
        indicator.querySelector('.k-ff').onclick = () => { window.__logFastForward = true; };
        (document.getElementById('feed') || feed).appendChild(indicator);
    }
    indicator.style.display = 'block';
    if (indicator.parentNode && indicator.parentNode.lastElementChild !== indicator) indicator.parentNode.appendChild(indicator);
}

function hidePendingIndicator() {
    const indicator = document.getElementById('pending-indicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

async function displayLogEntry(entry) {
    const feedEl = document.getElementById('feed') || feed;
    const d = document.createElement('div');
    d.className = 'entry log-entry k-entry';

    // In-game date instead of a real-world timestamp: a separator whenever the football day changes.
    const day = (window.KShell && KShell.dayLabel) ? KShell.dayLabel() : '';
    if (day && day !== window.__kLastDay) {
        window.__kLastDay = day;
        const sep = document.createElement('div');
        sep.className = 'k-day';
        sep.textContent = `— ${day} —`;
        feedEl.appendChild(sep);
    }
    if (day) d.title = day;

    const m = document.createElement('div');
    m.className = 'm';
    let card = null;
    try { if (window.KUI && typeof entry.message === 'string') card = KUI.renderEntry(entry.message); } catch (e) { card = null; }
    if (card) m.appendChild(card); else m.innerHTML = entry.message;
    d.appendChild(m);
    
    // Add burst styling if needed
    if (entry.isBurst) {
        d.classList.add('burst-entry');
    }
    
    // Add duplicate styling if needed
    if (entry.isDuplicate) {
        d.classList.add('k-dup');
    }
    
    // Add goal styling and flash effect
    if (entry.isGoal) {
        d.classList.add('goal-entry');
        if (feedEl) {
            feedEl.classList.add('goal-flash');
            setTimeout(() => {
                feedEl.classList.remove('goal-flash');
            }, 500);
        }
    }
    
    const pending = document.getElementById('pending-indicator');
    if (pending && pending.parentNode === feedEl) feedEl.insertBefore(d, pending); else feedEl.appendChild(d);
    
    // Trigger animation
    requestAnimationFrame(() => {
        d.classList.add('entry-visible');
    });
    
    // Wait for animation to start, then scroll the feed (not the page) to this entry
    if (!window.__logFastForward) await new Promise(resolve => setTimeout(resolve, 50));
    const scroller = d.closest('#dialoguePanel');
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: window.__logFastForward ? 'auto' : 'smooth' });
    else d.scrollIntoView({behavior: 'smooth', block: 'end'});
    
    // Small delay to ensure smooth scrolling
    if (!window.__logFastForward) await new Promise(resolve => setTimeout(resolve, 100));
}

// Resolve once the log queue has drained (choose() waits on this so its prompt and buttons
// appear after the narrative that precedes them). Calls fn synchronously when already idle.
function whenLogIdle(fn, maxWaitMs = 20000) {
    const idle = () => !isProcessingQueue && logQueue.length === 0;
    if (idle()) { fn(); return; }
    const t0 = Date.now();
    const iv = setInterval(() => {
        if (idle() || Date.now() - t0 > maxWaitMs) { clearInterval(iv); fn(); }
    }, 40);
}
function logSafe(msg){ try{ (window.log||console.log)(msg); }catch(_){  } }
function clearActions(){
  try {
    const actionsEl = document.getElementById('actions');
    if (actionsEl && actionsEl.innerHTML !== undefined) {
      actionsEl.innerHTML='';
    } else {
      console.warn('clearActions: actions element not available');
    }
  } catch (e) {
    console.error('clearActions error:', e);
  }
}

function restoreInterfaceAfterTimeout() {
  try {
    // Clear any stuck UI elements
    if (typeof clearActions === 'function') clearActions();
    if (typeof clearDrugQuick === 'function') clearDrugQuick();
    
    // Reset mounting flag
    if (window.__mountingDrugQuick) {
      window.__mountingDrugQuick = false;
    }
    
    // Add a recovery message
    const feedEl = document.getElementById('feed');
    if (feedEl) {
      const recoveryEl = document.createElement('div');
      recoveryEl.className = 'entry';
      recoveryEl.style.cssText = 'background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 15px; margin: 10px 0; border-radius: 4px;';
      recoveryEl.innerHTML = '<div class="m"><strong>🔄 Interface Restored</strong><br>Your game interface has been reset due to inactivity. You can continue playing normally.</div>';
      feedEl.appendChild(recoveryEl);
    }
    
  } catch (e) {
    console.error("Error during interface restoration:", e);
  }
}

// ---- Menus ----
// choose(items, title) is the single entry point for a menu. Pipeline:
//   chooseWithImpulse  (cocaine impulse / DERANGED outburst option while high)
//   -> chooseBase      (pass-through; rehab weeks are run by playRehabWeek in the main loop)
//   -> renderChoice    (draws the buttons, then emits GameHooks 'choices')
async function choose(items, title, ...rest){
  return chooseWithImpulse(items, title, ...rest);
}

function chooseBase(options, prompt){
  // (Rehab no longer intercepts the kickoff menu: rehab weeks are played by the
  //  main loop's playRehabWeek(), so a kickoff menu never appears while in rehab.)
  return renderChoice.apply(this, arguments);
}

function renderChoice(opts,prompt='Choose:'){
  return new Promise((res, rej) => {
    let promiseResolved = false;
    const safeResolve = (value) => {
      if (promiseResolved) {
        console.warn('[CHOOSE] Attempted to resolve already-resolved promise, ignoring');
        return;
      }
      promiseResolved = true;
      res(value);
    };
    const safeReject = (error) => {
      if (promiseResolved) {
        console.warn('[CHOOSE] Attempted to reject already-resolved promise, ignoring');
        return;
      }
      promiseResolved = true;
      rej(error);
    };
    try {
      // Basic debug instrumentation so we can track stuck choices

      // Get DOM elements dynamically instead of relying on global constants
      const actionsEl = document.getElementById('actions');
      const feedEl = document.getElementById('feed');
      
      // Validate DOM elements exist
      if (!actionsEl || !feedEl) {
        console.error('choose: Required DOM elements (actions/feed) not found');
        console.error('actions element:', actionsEl);
        console.error('feed element:', feedEl);
        
        // Try to recover by waiting a moment and retrying once
        setTimeout(() => {
          const retryActionsEl = document.getElementById('actions');
          const retryFeedEl = document.getElementById('feed');
          if (retryActionsEl && retryFeedEl) {
            // Retry the choose function
            choose(opts, prompt).then(res).catch(rej);
          } else {
            safeReject(new Error('DOM elements not available after retry'));
          }
        }, 100);
        return;
      }
      
      // Set up timeout to prevent infinite waiting (30 minutes with warning)
      // But only reset if user is truly inactive (no activity in last 5 minutes)
      const checkActivityAndWarn = () => {
        const timeSinceActivity = Date.now() - (window._lastUserActivity || Date.now());
        const inactiveThreshold = 300000; // 5 minutes of inactivity
        
        if (timeSinceActivity < inactiveThreshold) {
          // User is active, don't show warning or reset
          return false;
        }
        
        // User is inactive, show warning
        console.warn('choose: Warning - no choice made within 15 minutes and user appears inactive');
        const warningEl = document.createElement('div');
        warningEl.className = 'warning';
        warningEl.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; margin: 10px 0; border-radius: 4px;';
        warningEl.innerHTML = '⚠️ You\'ve been on this screen for 15 minutes. The interface will reset in 15 more minutes if no action is taken.';
        feedEl.appendChild(warningEl);
        return true;
      };
      
      const warningTimeoutId = setTimeout(() => {
        checkActivityAndWarn();
      }, 900000); // 15 minutes warning
      
      const timeoutId = setTimeout(() => {
        const timeSinceActivity = Date.now() - (window._lastUserActivity || Date.now());
        const inactiveThreshold = 300000; // 5 minutes of inactivity
        
        if (timeSinceActivity < inactiveThreshold) {
          // User is active, don't reset - extend timeout instead
          const extendedTimeout = setTimeout(() => {
            const timeSinceActivity2 = Date.now() - (window._lastUserActivity || Date.now());
            if (timeSinceActivity2 >= inactiveThreshold) {
              console.error('choose: Timeout - no choice made and user is inactive');
              clearActions();
              safeReject(new Error('Choice timeout - no selection made'));
            }
          }, 300000); // Check again in 5 minutes
          return;
        }
        
        // User is inactive, proceed with reset
        console.error('choose: Timeout - no choice made within 30 minutes and user is inactive');
        clearActions();
        safeReject(new Error('Choice timeout - no selection made'));
      }, 1800000); // 30 minutes total
      
      // Check if there's an active menu that we shouldn't interrupt
      // If S._preMatchMenuActive is set, we're interrupting a menu, so don't clear
      const shouldPreserveMenu = !!(window.S && window.S._preMatchMenuActive);
      
      if (!shouldPreserveMenu) {
        clearActions();
      } else {
        // We're interrupting a menu, but we still need to show our choices
        // Clear actions but set a flag that the menu needs restoration
        clearActions();
        window.S._menuInterrupted = true;
      }
      // Draw the prompt and buttons once the narrative before them has been written.
      const drawSeq = (window.__chooseSeq = (window.__chooseSeq || 0) + 1);
      const drawMenu = () => {
      if (drawSeq !== window.__chooseSeq || promiseResolved) return; // superseded by a newer menu
      try {
      const p=document.createElement('div');
      p.className='entry k-prompt-entry';
      p.innerHTML=`<div class="m"><div class="k-line prompt">${prompt}</div></div>`;
      // a menu re-shown with nothing written in between replaces its previous prompt line
      const lastEl = feedEl.lastElementChild && feedEl.lastElementChild.id === 'pending-indicator' ? feedEl.lastElementChild.previousElementSibling : feedEl.lastElementChild;
      if (lastEl && lastEl.classList && lastEl.classList.contains('k-prompt-entry')) lastEl.remove();
      feedEl.appendChild(p);
      if (window.KShell && KShell.setPrompt) KShell.setPrompt(prompt, opts);
      
      // Apply UI distortion if active
      applyUIDistortion();
      
      // Shared flag to prevent any button from being clicked multiple times
      let buttonClicked = false;
      
      opts.forEach(o=>{
        const b=document.createElement('button');
        b.textContent=o.label;
        if(o.variant) b.classList.add(o.variant);
        
        // Store original state for misreporting
        let actualState = 'enabled';
        let reportedState = 'enabled';
        b.onclick=()=>{
          try {
            // Prevent multiple clicks/resolutions (shared across all buttons)
            if (buttonClicked || promiseResolved) {
              return;
            }
            buttonClicked = true;
            
            // Disable all buttons immediately to prevent multiple clicks
            const allButtons = actionsEl.querySelectorAll('button');
            allButtons.forEach(btn => {
              btn.disabled = true;
              btn.style.opacity = '0.6';
              btn.style.cursor = 'not-allowed';
            });
            
            // Apply input lag if distortion is active
            const lag = isDistortionActive() ? (Math.random() * 200 + 100) : 0; // 100-300ms
            
            setTimeout(() => {
              try {
                // Double-check promise hasn't been resolved by another button
                if (promiseResolved) {
                  return;
                }
                
                clearTimeout(timeoutId); // Clear timeout when choice is made
                clearTimeout(warningTimeoutId); // Clear warning timeout too
                safeResolve(o.key);
              } catch (e) {
                console.error("Button click handler error:", e);
                clearTimeout(timeoutId);
                clearTimeout(warningTimeoutId);
                safeReject(e);
              }
            }, lag);
          } catch (e) {
            console.error("Outer button click handler error:", e);
            clearTimeout(timeoutId);
            clearTimeout(warningTimeoutId);
            rej(e);
          }
        };
        
        
        // Button state misreporting - randomly show wrong state
        if (isDistortionActive() && Math.random() < 0.3) {
          // Misreport button state
          setTimeout(() => {
            if (Math.random() < 0.5) {
              b.style.opacity = '0.5';
              b.disabled = false; // Actually enabled but looks disabled
            } else {
              b.style.opacity = '1';
              b.disabled = true; // Actually disabled but looks enabled
              setTimeout(() => {
                b.disabled = false;
              }, Math.random() * 1000 + 500);
            }
          }, Math.random() * 500);
        }
        
        actionsEl.appendChild(b);
      });
      
      // Let systems add their own buttons under this menu
      GameHooks.emit('choices', { root: actionsEl, prompt, options: opts });
      
      if (window.KShell && KShell.afterChoices) KShell.afterChoices(actionsEl, opts, prompt);
      const fs = document.getElementById('dialoguePanel');
      if (fs) fs.scrollTo({ top: fs.scrollHeight });
      } catch (e) {
        console.error('choose draw error:', e);
        safeReject(e);
      }
      };
      if (typeof whenLogIdle === 'function') whenLogIdle(drawMenu); else drawMenu();
    } catch (e) {
      console.error('choose function error:', e);
      safeReject(e);
    }
  });
}
function setVal(id,v){const el=document.getElementById(id); if(el) el.textContent=v;}
function pickLine(list){return list[Math.floor(Math.random()*list.length)];}


// Persistent dialogue popup manager for nightclub seduction
let persistentDialoguePopup = null;

function createPersistentDialoguePopup(speakerName) {
  // Remove existing popup if any
  if (persistentDialoguePopup) {
    persistentDialoguePopup.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'dialogue-popup-overlay';
  overlay.id = 'persistent-dialogue-popup';
  
  const container = document.createElement('div');
  container.className = 'dialogue-popup-container';
  container.style.maxHeight = '80vh';
  container.style.overflowY = 'auto';
  
  const dialogueArea = document.createElement('div');
  dialogueArea.id = 'persistent-dialogue-area';
  dialogueArea.style.marginBottom = '20px';
  dialogueArea.style.maxHeight = '400px';
  dialogueArea.style.overflowY = 'auto';
  dialogueArea.style.padding = '10px';
  
  const choicesArea = document.createElement('div');
  choicesArea.id = 'persistent-choices-area';
  choicesArea.style.marginTop = '20px';
  
  const promptArea = document.createElement('div');
  promptArea.id = 'persistent-prompt-area';
  promptArea.style.marginBottom = '10px';
  promptArea.style.fontWeight = 'bold';
  promptArea.style.color = 'var(--text-primary, #fff)';
  
  container.appendChild(dialogueArea);
  container.appendChild(promptArea);
  container.appendChild(choicesArea);
  overlay.appendChild(container);
  
  document.body.appendChild(overlay);
  persistentDialoguePopup = overlay;
  
  return { overlay, dialogueArea, choicesArea, promptArea };
}

function addMessageToPersistentDialogue(speaker, text, isYou = false) {
  if (!persistentDialoguePopup) return;
  
  const dialogueArea = persistentDialoguePopup.querySelector('#persistent-dialogue-area');
  if (!dialogueArea) return;
  
  const bubble = document.createElement('div');
  bubble.className = 'dialogue-bubble';
  bubble.style.marginBottom = '15px';
  bubble.style.animation = 'bubbleAppear 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  
  const speakerEl = document.createElement('div');
  speakerEl.className = `dialogue-speaker ${isYou ? 'you' : 'them'}`;
  speakerEl.textContent = isYou ? 'You' : speaker;
  
  const textEl = document.createElement('div');
  textEl.className = `dialogue-text ${isYou ? 'you' : 'them'}`;
  textEl.textContent = text;
  
  bubble.appendChild(speakerEl);
  bubble.appendChild(textEl);
  dialogueArea.appendChild(bubble);
  
  // Auto-scroll to bottom
  dialogueArea.scrollTop = dialogueArea.scrollHeight;
}

function clearPersistentChoices() {
  if (!persistentDialoguePopup) return;
  const choicesArea = persistentDialoguePopup.querySelector('#persistent-choices-area');
  const promptArea = persistentDialoguePopup.querySelector('#persistent-prompt-area');
  if (choicesArea) choicesArea.innerHTML = '';
  if (promptArea) promptArea.textContent = '';
}

function closePersistentDialoguePopup() {
  if (persistentDialoguePopup) {
    persistentDialoguePopup.remove();
    persistentDialoguePopup = null;
  }
}

async function chooseInPersistentDialogue(opts, prompt = 'Choose:') {
  return new Promise((resolve, reject) => {
    if (!persistentDialoguePopup) {
      reject(new Error('Persistent dialogue popup not initialized'));
      return;
    }
    
    const choicesArea = persistentDialoguePopup.querySelector('#persistent-choices-area');
    const promptArea = persistentDialoguePopup.querySelector('#persistent-prompt-area');
    
    if (!choicesArea || !promptArea) {
      reject(new Error('Dialogue popup elements not found'));
      return;
    }
    
    // Clear previous choices
    choicesArea.innerHTML = '';
    
    // Set prompt
    promptArea.textContent = prompt;
    
    // Create choice buttons
    opts.forEach(o => {
      const btn = document.createElement('button');
      btn.textContent = o.label;
      btn.className = 'btn btn-primary';
      if (o.variant) btn.classList.add(o.variant);
      btn.style.cssText = 'width: 100%; padding: 12px; margin: 8px 0; text-align: left;';
      btn.onclick = () => {
        clearPersistentChoices();
        resolve(o.key);
      };
      choicesArea.appendChild(btn);
    });
    
    // Scroll choices into view
    setTimeout(() => {
      choicesArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  });
}

// Floating sex outcome text animation
function showFloatingSexOutcome(text) {
  const floatingEl = document.createElement('div');
  floatingEl.className = 'floating-sex-outcome';
  floatingEl.textContent = text;
  document.body.appendChild(floatingEl);
  
  // Remove after animation completes
  setTimeout(() => {
    floatingEl.remove();
  }, 3000);
}

// === QUICK-SIM INVENTIVE & BRICK THROWING SYSTEM ===

// Configuration objects - using existing quickInvective from line 5730
// const quickInvective = {
//   tickRate: 0.04,      // chance per quick-sim tick to auto-insert a shoutline
//   frustration: { start: 0, max: 100, missAdd: 8, turnoverAdd: 4, goalMinus: 12, decayPerTick: 0.5 },
//   tauntMenuSize: 4,    // always show 4 choices
//   newsTag: 'Fan Reaction',
// };

// const brickThrow = {
//   consumeOnThrow: false, // throwing does NOT consume the brick
//   targets: {
//     players:  { moraleDelta: [-20, -10], oppQualityDelta: null,  arrestChance: 0.40, newsNote: 'You hurled a brick at your own players.' },
//     opponents:{ moraleDelta: [-5, -15],  oppQualityDelta: [-3,-8], arrestChance: 0.35, newsNote: 'You launched a brick at the opposition.' },
//     manager:  { moraleDelta: [-10,-25],  oppQualityDelta: [-5,-12], arrestChance: 0.60, newsNote: 'You aimed a brick at the opposing manager.' },
//     referee:  { moraleDelta: null,       oppQualityDelta: null,  arrestChance: 0.75, newsNote: 'You targeted the referee with a brick.' },
//     fans:     { moraleDelta: null,       oppQualityDelta: null,  arrestChance: 0.85, newsNote: 'You threw a brick into the crowd.' },
//     contact:  { moraleDelta: null,       oppQualityDelta: null,  arrestChance: 1.00, newsNote: 'You threw a brick mid-conversation. Immediate arrest.' }
//   }
// };

// Taunt/Invective Pools
const TAUNTS = {
  mild: [
    "PASS THE FUCKING BALL", "SHOOT!", "FOOTBALL!", "PLAY THE FUCKING GAME!",
    "MOVE IT!", "TO FEET!", "WAKE UP!", "PRESS!", "ON YOUR TOES!",
    "SWITCH IT!", "KEEP FUCKING SHAPE!", "HURRY UP!", "BACK POST!", "FRONT POST!",
    "GET UP!", "DROP!", "TIME!", "MAN ON!", "LINE!", "OUT!",
    "PRESS AS A UNIT!", "MAKE THE PASS!", "TAKE THE SHOT!", "FUCKING PASS IT HARDER!",
    "PLAY IT FUCKING EARLY!", "DON'T FUCKING DWELL!", "MAKE YOUR MOVE!", "LOOK UP!"
  ],
  salty: [
    "PASS THE FUCKING BALL", "SHOOT AT THE FUCKING GOAL", "FUCKING KICK IT FUCKING HARDER",
    "WHAT ARE YOU DOING!", "GET STUCK IN!", "HIT THE FUCKING TARGET!", "FUCKING STOP DALLYING!",
    "GET IT FUCKING WIDE!", "HEAD UP!", "MAKE THE RUN!", "PASS IT FUCKING HARDER!",
    "KICK THE BALL FUCKING HARDER!", "SHOOT IT FUCKING UPFIELD!", "STOP PLAYING SHIT!",
    "STOP FUCKING DALLYING!", "GET IT FUCKING WIDE!", "HEAD UP YOU CLOWN!",
    "MAKE THE FUCKING RUN!", "WHIP IT FUCKING IN!", "PUT YOUR LACES THROUGH IT!",
    "GET STUCK THE FUCK IN!", "HIT THE FUCKING TARGET!", "WAKE THE FUCK UP!",
    "CLEAR YOUR FUCKING LINES!", "DON'T PLAY FUCKING ABOUT AT THE BACK! GET YOUR COCKS STUCK IN",
    "TURN AND FUCKING GO!", "PUT IT IN THE BOX!"
  ],
  extreme: [
    "WHAT THE FUCK ARE YOU DOING!", "WHAT ARE YOU FUCKING DOING!", "CUNTS!",
    "THE REFEREE IS A DEAD MAN FUCKING WALKING!", "WAKE THE FUCK UP!",
    "FUCKING PASS IT!", "CLEAR YOUR LINES!", "HIT HIM!", "BREAK HIS FUCKING LEGS!",
    "BREAK HIS ANKLES!", "END HIM!", "HOSPITALIZE HIM!",
    "LEATHER IT!", "MURDER THAT BALL!", "HE'S A FUCKING DISGRACE!",
    "REF, OPEN YOUR FUCKING EYES!", "YOU'RE ROBBING US!", "HIT HIM AGAIN!",
    "SMASH HIM!", "TAKE HIS LEGS!", "FUCKING LASH IT!",
    "TWO FOOTED TACKLE THE CUNT!", "PUT HIM IN A STRETCHER!", "PUNCH HIM WHEN THE REF AINT LOOKING!"
  ],
  drunk: [
    "I'M FUCKING WASTED AND YOU'RE STILL SHIT!", "DRUNK AS FUCK AND STILL BETTER THAN YOU!",
    "I'VE HAD TEN BEERS AND I COULD STILL PLAY BETTER!", "FUCKING PISSED AND STILL SMARTER THAN THE REF!",
    "I'M WASTED AND YOU'RE STILL A FUCKING DISGRACE!", "DRUNK OFF MY TITS AND STILL MORE TALENTED!",
    "I'VE BEEN DRINKING ALL DAY AND I'M STILL NOT AS SHIT AS YOU!", "FUCKING MULLERED AND STILL BETTER THAN THIS!",
    "I'M ABSOLUTELY WANKERED AND YOU'RE STILL WORSE!", "DRUNK AS A SKUNK AND STILL NOT AS BAD AS YOU!"
  ],
  saints: [
    "OH WHEN THE SAINTS!", "GO MARCHING IN!", "I WANT TO BE IN THAT NUMBER!",
    "COME ON YOU SAINTS!", "RED AND WHITE ARMY!"
  ]
};

// Helper functions for taunt system
function pickInvective(frustration) {
  // Check if player is drunk
  const isDrunk = S.isDrunk === true;
  
  // If drunk, weight selection to favor drunk taunts
  if (isDrunk && Math.random() < 0.6) { // 60% chance to pick drunk taunt when drunk
    const pool = tauntPools.drunk;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  // Otherwise use normal intensity-based selection
  const intensity = frustration < 30 ? 'mild' : frustration < 70 ? 'salty' : 'extreme';
  const pool = tauntPools[intensity];
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollTauntMenu(frustration) {
  const options = [];
  const used = new Set();
  
  // Check if player is drunk
  const isDrunk = S.isDrunk === true;
  
  // Weight selection by frustration level and drunk state
  let mildWeight, saltyWeight, extremeWeight, drunkWeight, saintsWeight;
  
  if (isDrunk) {
    // When drunk, heavily favor drunk taunts and extreme taunts
    mildWeight = Math.max(0, 10 - frustration * 0.2);
    saltyWeight = Math.max(0, 20 - Math.abs(frustration - 50) * 0.3);
    extremeWeight = Math.max(0, frustration - 20);
    drunkWeight = Math.max(0, 50 + frustration * 0.5); // Drunk taunts get heavy weight
    saintsWeight = 10; // Fewer Saints chants when drunk
  } else {
    // Sober: normal weight distribution, no drunk taunts
    mildWeight = Math.max(0, 40 - frustration);
    saltyWeight = Math.max(0, 60 - Math.abs(frustration - 50));
    extremeWeight = Math.max(0, frustration - 30);
    drunkWeight = 0; // No drunk taunts when sober
    saintsWeight = 20; // Always some Saints chants
  }
  
  const totalWeight = mildWeight + saltyWeight + extremeWeight + drunkWeight + saintsWeight;
  
  while (options.length < quickInvective.tauntMenuSize) {
    const roll = Math.random() * totalWeight;
    let selectedPool;
    
    if (roll < mildWeight) selectedPool = 'mild';
    else if (roll < mildWeight + saltyWeight) selectedPool = 'salty';
    else if (roll < mildWeight + saltyWeight + extremeWeight) selectedPool = 'extreme';
    else if (roll < mildWeight + saltyWeight + extremeWeight + drunkWeight) selectedPool = 'drunk';
    else selectedPool = 'saints';
    
    const pool = tauntPools[selectedPool];
    const option = pool[Math.floor(Math.random() * pool.length)];
    
    if (!used.has(option)) {
      used.add(option);
      options.push(option);
    }
  }
  
  return options;
}

// Frustration management
function updateFrustration(delta) {
  S.frustration = Math.max(0, Math.min(100, (S.frustration || 0) + delta));
}

function decayFrustration() {
  updateFrustration(-quickInvective.frustration.decayPerTick);
}

// Session shouts management
function addSessionShout(shout) {
  if (!Array.isArray(S.sessionShouts)) S.sessionShouts = [];
  S.sessionShouts.push(shout);
}

function clearSessionShouts() {
  S.sessionShouts = [];
}

function dedupeSessionShouts() {
  if (!Array.isArray(S.sessionShouts)) return [];
  const deduped = [];
  let lastShout = null;
  
  for (const shout of S.sessionShouts) {
    if (shout !== lastShout) {
      deduped.push(shout);
      lastShout = shout;
    }
  }
  
  return deduped;
}


// Brick throwing system
function hasBrickEquipped() {
  const brick = getItemByName("Brick");
  return brick && brick.equipped === true;
}

async function throwBrickAt(targetType, context = {}) {
  if (!hasBrickEquipped()) {
    log("You need to have a Brick equipped to throw it!");
    return;
  }
  
  const target = brickThrow.targets[targetType];
  if (!target) {
    log("Invalid brick target!");
    return;
  }
  
  // Log the brick throw
  log(target.newsNote);
  addSessionShout(target.newsNote);
  // Skill layer (src/087i-mg-brick.js): aim + throw; the hit quality scales the effects below. Arrest roll unchanged.
  const hitMult = (typeof throwBrickMinigame === 'function') ? await throwBrickMinigame(targetType, context) : 1;
  
  // Apply morale/quality effects
  if (target.morale) {
    const delta = (target.morale[0] + Math.random() * (target.morale[1] - target.morale[0])) * hitMult;
    S.morale = Math.max(-100, Math.min(100, (S.morale || 0) + delta));
    log(`Team morale ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta).toFixed(1)}.`);
  }
  
  if (target.quality && context.opponent) {
    const delta = (target.quality[0] + Math.random() * (target.quality[1] - target.quality[0])) * hitMult;
    // Apply opponent quality reduction for this match only
    if (!S.matchContext) S.matchContext = {};
    if (!S.matchContext.opponentQualityMod) S.matchContext.opponentQualityMod = 0;
    S.matchContext.opponentQualityMod += delta;
    log(`Opponent quality reduced by ${Math.abs(delta).toFixed(1)} for this match.`);
  }
  
  // Arrest roll
  if (Math.random() < target.arrest) {
    log("🚨 ARREST: Police are called immediately!");
    await triggerArrestFlow({ reason: 'threw_brick', target: targetType });
  }
  
  // Consume brick if configured
  if (brickThrow.consumeOnThrow) {
    removeItem("Brick", 1);
  }
}


// Handle brick throwing in conversation
async function handleConversationBrickThrow(contactName) {
  if (hasBrickEquipped()) {
    log(`You lob the brick at ${contactName}. Security swarms.`);
    addSessionShout(`You lob the brick at ${contactName}. Security swarms.`);
    await triggerArrestFlow({ reason: 'threw_brick', target: 'contact', contactName });
    return true;
  }
  return false;
}

// Helper to trigger arrest flow (integrate with existing system)
async function triggerArrestFlow(context) {
  log("🚨 You are being arrested! The police are taking you away.");
  
  // Check if player has disorder certificates
  if (S.doctor && S.doctor.disorder_certificates) {
    const availableCertificates = S.doctor.disorder_certificates.filter(cert => !cert.used);
    
    if (availableCertificates.length > 0) {
      log("You have disorder certificates that might help you avoid arrest!");
      
      const options = [
        { key: 'accept', label: 'Accept arrest and face consequences' }
      ];
      
      // Add certificate options
      availableCertificates.forEach((cert, index) => {
        options.push({ 
          key: `cert_${index}`, 
          label: `Use ${cert.type} certificate (get out of jail free)` 
        });
      });
      
      const choice = await choose(options, 'How do you respond to the arrest?');
      
      if (choice.startsWith('cert_')) {
        // Use disorder certificate
        const certIndex = parseInt(choice.split('_')[1]);
        const certificate = availableCertificates[certIndex];
        
        if (certificate) {
          certificate.used = true;
          log(`You present your ${certificate.type} certificate to the police.`);
          log(`"Oh my god," the officer says, reading the diagnosis. "${certificate.description}"`);
          log(`"I had no idea you were suffering from this condition. This is so, so sad."`);
          log(`The police are sympathetic and decide not to arrest you. They let you go with a warning.`);
          log(`"We'll make sure you get the help you need," they say as they leave.`);
          
          // No negative effects - the certificate works perfectly
          log(`Your reputation actually improves slightly due to the police's sympathy for your condition.`);
          S.reputation = Math.min(100, (S.reputation || 50) + 2);
          
          // Update doctor UI if open
          if (typeof window.renderDoctor === 'function') {
            window.renderDoctor();
          }
          
          updateHUD?.();
          return; // Exit early - no arrest consequences
        }
      }
    }
  }
  
  // Normal arrest consequences (if no certificate used or none available)
  const fineChair = 30000 + Math.floor(Math.random() * 30000);
  const fineClub = Math.round(fineChair * 1.2);
  
  S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - fineChair);
  S.club_cash = Math.max(0, (S.club_cash || 0) - fineClub);
  
  S.legal_risk = Math.min(100, (S.legal_risk || 0) + 5);
  S.compliance_risk = Math.min(100, (S.compliance_risk || 0) + 6);
  S.reputation = Math.max(0, (S.reputation || 0) - 15);
  
  log(`CONSEQUENCES: Personal fine ${money(fineChair)}, Club fine ${money(fineClub)}`);
  log("Your reputation plummets and the FA launches an immediate investigation.");
  
  // Set pending police investigation
  if (S._pending_police_investigation) {
    S._pending_police_investigation.caseType += ` and ${context.reason}`;
    S._pending_police_investigation.description = 'Multiple incidents - ' + context.reason;
  } else {
    S._pending_police_investigation = { 
      authority: 'police', 
      caseType: context.reason,
      description: `Brick throwing incident - ${context.target}`
    };
  }
  
  updateHUD?.();
}

// Interactive taunt during match simulation: presentInteractiveTauntOptions(logFn) is defined by
// src/087f-mg-taunts.js (3 pixel speech bubbles, 3s to pick; timeout picks at random as before).

// Auto-shout system for quick sim
async function processQuickSimTick(currentMinute, logFn = null) {
  // Use provided log function (for overlay) or fallback to regular log
  const addLog = logFn || ((text) => log(text));
  
  const currentFrustration = S.frustration || 0;
  let shoutProbability = quickInvective.autoShoutProbability * (1 + currentFrustration / 50);
  
  // Enhanced taunt frequency when taunt mode is active
  if (S.tauntModeActive) {
    shoutProbability *= 3; // Triple the chance of taunts appearing during simulation
    
    // Throttle interactive prompts to avoid multiple menus before commentary
    // Only allow prompts when a currentMinute is provided (quick-sim) and enough time has passed
    const lastMinute = (typeof S._lastTauntMinute === 'number') ? S._lastTauntMinute : -999;
    const minGap = 12; // require ~12 match minutes between menus
    const allowPromptByTime = (typeof currentMinute === 'number') && (currentMinute - lastMinute >= minGap);
    const notBusy = !S._tauntPromptInFlight;
    // Check if we should present interactive taunt options
    if (allowPromptByTime && notBusy && S.tauntChoicesRemaining > 0 && Math.random() < 0.6) {
      S._tauntPromptInFlight = true;
      try {
        await presentInteractiveTauntOptions(addLog);
        S.tauntChoicesRemaining--;
        S._lastTauntMinute = currentMinute;
      } finally {
        S._tauntPromptInFlight = false;
      }
    }
  }
  
  if (Math.random() < shoutProbability) {
    const autoShout = pickInvective(currentFrustration);
    addLog(`You shout: "${autoShout}"`);
    addSessionShout(autoShout);
  }
  
  // Drunk manager commentary
  if (S.isDrunk === true && Math.random() < 0.15) { // 15% chance per tick when drunk
    // When drunk, pull from drunk, extreme, and saints pools
    const allDrunkTaunts = [
      ...tauntPools.drunk,
      ...tauntPools.extreme,
      ...tauntPools.saints
    ];
    const drunkShout = allDrunkTaunts[Math.floor(Math.random() * allDrunkTaunts.length)];
    addLog(`You shout: "${drunkShout}"`);
    addSessionShout(drunkShout);
  }
  
  // KRAZY register crowd chants
  if ((S.onKrazyRegister || (S.sex_offender_register && S.sex_offender_register.active)) && Math.random() < KRAZY_CHANT_RATE) {
    const krazyChants = [
      "THE CHAIRMAN IS A PEDO! THE CHAIRMAN IS A PEDO!",
      "SEX OFFENDER! SEX OFFENDER! SEX OFFENDER!",
      "you're on the register",
      "we know you're a perv! we know youre a perv! Chairman of Southampton! Hows your tennis serve?",
      "sign our shirts, PEDO"
    ];
    const chant = krazyChants[Math.floor(Math.random() * krazyChants.length)];
    addLog(`Crowd chants: "${chant}"`);
  }
  
  // Obesity crowd chants
  if (S.obese && Math.random() < 0.08) { // 8% chance per tick when obese
    const obesityChants = [
      "who ate all the pies? who ate all the pies? southampton's obese chair ate all the fucking pies!",
      "you fat bastard! you fat bastard!",
      "look at the size of him! look at the size of him!",
      "he's got more chins than a chinese phone book!",
      "the chairman's so fat, when he sits around the house, he sits AROUND the house!",
      "southampton's chairman is a fat cunt!",
      "he's not fat, he's just big-boned! big-boned my arse!",
      "the chairman's so obese, he needs a forklift to get out of bed!"
    ];
    const chant = obesityChants[Math.floor(Math.random() * obesityChants.length)];
    addLog(`Crowd chants: "${chant}"`);
  }
  
  // Decay frustration over time
  decayFrustration();
}

// News integration
function generateFanReactionNews() {
  const shouts = dedupeSessionShouts();
  if (shouts.length === 0) return null;
  
  return {
    title: quickInvective.newsTag,
    body: shouts.join(" • "),
    type: 'fan_reaction'
  };
}

// Manager confrontation
async function triggerManagerConfrontation() {
  // Call the new manager confrontation system
  await handleManagerConfrontation();
}

async function chooseManager(){
  const m = await choose(
    [
      {key:'v',label:'Krocky McDufflin - Veteran disciplinarian (stable, low-variance)'},
      {key:'y',label:'Balzac Forsyth - Young motivator (higher morale swings)'},
      {key:'f',label:'Ricardo Spain - foreign tactician (attacking bias)'}
    ],
    'Select a manager:'
  );
  if(m==='v'){
    S.manager_type='veteran';
    S.morale = clamp(S.morale + 2, -100, 100);
    S.reputation = clamp(S.reputation + 1, 0, 100);
  } else if(m==='y'){
    S.manager_type='young';
    S.morale = clamp(S.morale + 5, -100, 100);
  } else {
    S.manager_type='foreign';
    S.reputation = clamp(S.reputation + 3, 0, 100);
  }
  log('Manager appointed.');
  render();
}

async function chooseSponsor(){
  // Check if sponsor was already selected on start screen
  if (window.__selectedSponsor) {
    const s = window.__selectedSponsor;
    window.__selectedSponsor = null; // Clear it after use
    // Apply sponsor selection directly
    if(s==='m'){
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(3000000);
      } else {
        S.club_cash = (S.club_cash || 0) + 3000000;
      }
      S.weekly_income = (S.weekly_income||0) + 150000;
    } else if(s==='e'){
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(1500000);
      } else {
        S.club_cash = (S.club_cash || 0) + 1500000;
      }
      S.weekly_income = (S.weekly_income||0) + 200000;
      S.fan_morale = (S.fan_morale||50) - 3;
    } else if(s==='n'){
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(4000000);
      } else {
        S.club_cash = (S.club_cash || 0) + 4000000;
      }
      S.weekly_income = (S.weekly_income||0) + 200000;
      S.sponsor_nintendo = true;
    } else {
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(8000000);
      } else {
        S.club_cash = (S.club_cash || 0) + 8000000;
      }
      S.weekly_income = (S.weekly_income||0) + 300000;
      S.fan_morale = (S.fan_morale||50) - 15;
      addPaper('Fans rage over Portsmouth branding deal', 18);
    }
    log('Sponsor secured.');
    ensureSeasonSchedule();
    updateHUD();
    render();
    return;
  }
  
  const s = await choose(
    [
      {key:'m',label:"McDonald's — upfront £3m, weekly £150k (free burgers)"},
      {key:'e',label:'The Edge Gay Club — upfront £1.5m, weekly £200k (minor fan/team discontent with "GAY CLUB" being written on team shirts)'},
      {key:'n',label:'Nintendo — upfront £4m, weekly £200k (conservative company drops you if scandals exposed)'},
      {key:'p',label:'Portsmouth FC — upfront £8m, weekly £300k (fans furious with the prospect of "PORTSMOUTH FC" being written on club shirts)'}
    ],
    'Select a lead shirt sponsor:'
  );
  if(s==='m'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(3000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 3000000;
    }
    S.weekly_income = (S.weekly_income||0) + 150000;
  } else if(s==='e'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(1500000);
    } else {
      S.club_cash = (S.club_cash || 0) + 1500000;
    }
    S.weekly_income = (S.weekly_income||0) + 200000;
    S.fan_morale = (S.fan_morale||50) - 3;
  } else if(s==='n'){
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(4000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 4000000;
    }
    S.weekly_income = (S.weekly_income||0) + 200000;
    S.sponsor_nintendo = true;
  } else {
    if (typeof addMoneyClub === 'function') {
      addMoneyClub(8000000);
    } else {
      S.club_cash = (S.club_cash || 0) + 8000000;
    }
    S.weekly_income = (S.weekly_income||0) + 300000;
    S.fan_morale = (S.fan_morale||50) - 15;
    addPaper('Fans rage over Portsmouth branding deal', 18);
  }
log('Sponsor secured.');
ensureSeasonSchedule();  // make sure season_matches/opponents are valid
updateHUD();             // safe now
return;                  // let game() continue to fixtures/prematch
  render();
}


async function familyBlock(){
  // First: a chance your wife explicitly demands money (disabled in Season 4+)
  if(S.season < 4 && Math.random() < 0.55){
    await wifeDemandEvent();
    return;
  }

  // Otherwise, the simple home choices
  const w = await choose(
    [
      {key:'give',   label:'Give your spouse money (£2k)'},
      {key:'listen', label:'Spend quality time listening'},
      {key:'sex',    label:'Have sex with wife', variant:'sensual'},
      {key:'ignore', label:'Ignore (free up evening)', variant:'warn'}
    ],
    'At home:'
  );
  if(w==='give'){
    S.chairman_cash = Math.max(0,(S.chairman_cash||0) - 2000);
    S.wife_love = clamp((S.wife_love||60) + 4, 0, 100);
  }
  if(w==='listen'){
    S.wife_love = clamp((S.wife_love||60) + 8, 0, 100);
    S.wife_respect = clamp((S.wife_respect||55) + 2, 0, 100);
  }
  if(w==='sex'){
    await haveSexWithWife();
  }
  if(w==='ignore'){
    S.wife_love = clamp((S.wife_love||60) - 10, 0, 100);
    if(S.wife_love===0 && S.married){ 
      S.married=false; S.divorces=(S.divorces||0)+1; 
      S.wives_count = Math.max(0,(S.wives_count||1)-1);
      log('Your spouse leaves. You now have ' + S.wives_count + ' wife' + (S.wives_count===1?'':'s') + '.');
    }
  }

  // Kids (optional)
  if(Math.random()<0.4){
    const c = await choose(
      [
        {key:'cash',label:'Give kids money (£1.5k)'},
        {key:'time',label:'Do an activity together'},
        {key:'skip',label:'Not tonight',variant:'warn'}
      ],
      'Your children want attention:'
    );
    if(c==='cash'){
      S.chairman_cash = Math.max(0,(S.chairman_cash||0) - 1500);
      S.child1_respect = clamp((S.child1_respect||50) + 3, 0, 100);
      S.child2_respect = clamp((S.child2_respect||50) + 3, 0, 100);
    }
    if(c==='time'){
      S.child1_respect = clamp((S.child1_respect||50) + 6, 0, 100);
      S.child2_respect = clamp((S.child2_respect||50) + 6, 0, 100);
    }
    if(c==='skip'){
      S.child1_respect = clamp((S.child1_respect||50) - 6, 0, 100);
      S.child2_respect = clamp((S.child2_respect||50) - 6, 0, 100);
    }
  }
}

// Helper function to open Tinder from menu/event
async function openTinderApp() {
  if (!S.season4 || !S.season4.daughter_suggested_dating) {
    log("Your daughter hasn't suggested dating yet.");
    return;
  }
  
  ensureTinderFlags();
  
  if (!S.season4.tinder_profile_created) {
    await createTinderProfile();
  }
  
  // Show menu if profile exists (either just created or already existed)
  if (S.season4.tinder_profile_created) {
    // Show menu
    const menuChoice = await choose([
      {key: 'swipe', label: 'Swipe for matches'},
      {key: 'matches', label: 'View matches'},
      {key: 'close', label: 'Close app'}
    ], 'TINDER - What do you want to do?');
    
    
    if (menuChoice === 'swipe') {
      await openTinderSwiping();
    } else if (menuChoice === 'matches') {
      await viewTinderMatches();
    }
  }
}

async function maybeEveningEvent(){
  
  // Soft inits (safe even if already set)
  if(S.married===undefined) S.married = true;
  if(S.wife_love===undefined) S.wife_love = 60;
  if(S.wife_respect===undefined) S.wife_respect = 55;
  if(S.child1_love===undefined) S.child1_love = 50;
  if(S.child2_love===undefined) S.child2_love = 50;
  if(S.child1_respect===undefined) S.child1_respect = 50;
  if(S.child2_respect===undefined) S.child2_respect = 50;
  if(S.reputation===undefined) S.reputation = 50;
  if(S.legal_risk===undefined) S.legal_risk = 0;
  if(S.compliance_risk===undefined) S.compliance_risk = 0;
  if(S.drug_stash===undefined) S.drug_stash = 0;
  if(S.drug_binge===undefined) S.drug_binge = 0;
  if(S.no_sleep===undefined) S.no_sleep = 0;
  if(S.seduction_heat===undefined) S.seduction_heat = 0;
  if(S.affair_count===undefined) S.affair_count = 0;
  if(S.hush_money_paid===undefined) S.hush_money_paid = 0;
  if(S.std_state===undefined) S.std_state = "none";
  if(S.std_treatment_attempts===undefined) S.std_treatment_attempts = 0;
  if(S.std_last_treatment_match===undefined) S.std_last_treatment_match = -1;
  if(S.pregnancies===undefined) S.pregnancies = 0;
  if(S.very_bad_std_state===undefined) S.very_bad_std_state = "none"; // "none" | "infected" | "treated"
  if(S.very_bad_std_matches===undefined) S.very_bad_std_matches = 0;
  if(S.very_bad_std_treatment_attempts===undefined) S.very_bad_std_treatment_attempts = 0;
  if(S.very_bad_std_last_treatment_match===undefined) S.very_bad_std_last_treatment_match = -1;
  if(S.pending_pregnancies===undefined) S.pending_pregnancies = [];
  if(S.pending_female_std===undefined) S.pending_female_std = [];
  if(S.pending_male_std===undefined) S.pending_male_std = [];
  if(S.pending_male_blackmail===undefined) S.pending_male_blackmail = [];
  if(S.pending_female_blackmail===undefined) S.pending_female_blackmail = [];
  if(S.pending_protection_blackmail===undefined) S.pending_protection_blackmail = [];
  if(S.pending_partner_death===undefined) S.pending_partner_death = [];
  if(S.pending_blackmail_scandal===undefined) S.pending_blackmail_scandal = [];
  if(S.pending_bedroom_gossip===undefined) S.pending_bedroom_gossip = [];
  if(S.pending_protection_gossip===undefined) S.pending_protection_gossip = [];
  if(S.game_over===undefined) S.game_over = false;
  if(S.game_over_reason===undefined) S.game_over_reason = '';
  if(S.marco_met===undefined) S.marco_met = false;
  if(S.chairman_actions_offered_this_evening===undefined) S.chairman_actions_offered_this_evening = false;

  // Build evening options
  const eveningOptions = [
    {key:'home',   label:'Stay home (family time)', variant:'good'},
    {key:'study',  label:'Go to your study',        variant:'neutral'},
    {key:'club',   label:'Go to a nightclub',       variant:'bad'},
    {key:'sleep',  label:'Sleep peacefully'},
  ];
  
  // Season 4 & 5: Add Tinder option if daughter suggested dating
  if ((S.season === 4 || S.season === 5) && S.season4 && S.season4.daughter_suggested_dating) {
    eveningOptions.splice(3, 0, {key:'tinder', label:'📱 Open Tinder', variant:'warn'});
  }
  
  const evening = await choose(eveningOptions, 'Evening options:');

  if(evening==='sleep'){
    S.drug_binge = 0;
    S.no_sleep = 0;
    log('You turn in early and feel clearer in the morning.');
    render();
    return;
  }

  if(evening==='study'){
    initPressSystem();
    await openStudyHub();
    render();
    return;
  }

  if(evening==='home'){
    setPhase('home');
    await openAtHomeMenu();
    render();
    return;
  }

  if(evening==='study'){
    initPressSystem();
    await openStudyHub();
    render();
    return;
  }

  if(evening==='league'){
    await showChairmenLeagueTablePopup();
    // After viewing the table in evening, immediately offer Chairman League actions
    await postMatchChairmanActionsMenu();
    S.chairman_actions_offered_this_evening = true;
    render();
    // Return to the evening menu instead of advancing the day
    await eveningPhase();
    return;
  }

  if(evening==='tinder'){
    
    // Set flag to indicate we're in evening phase
    window.__in_evening_phase = true;
    window.__tinder_encounter_completed = false;
    window.__tinder_encounter_started = false;
    
    
    try {
      // Open Tinder - this returns when user closes the app
      await openTinderApp();
      
      // CRITICAL FIX: Wait for encounter to complete
      // The encounter might start AFTER openTinderApp returns (user swipes, matches, chats, invites)
      // We need to poll and wait until it's done
      
      // Give a short grace period for encounter to start (user might be in the middle of swiping)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // If no encounter was started, skip the wait loop entirely
      if (!window.__tinder_encounter_started) {
      } else {
        // Encounter was started - wait for it to complete
        const maxWaitTime = 120000; // 2 minutes max
        const startTime = Date.now();
        let lastState = {
          started: window.__tinder_encounter_started,
          completed: window.__tinder_encounter_completed,
          inPhase: window.__in_evening_phase
        };
        let loopIteration = 0;
        
        while ((Date.now() - startTime) < maxWaitTime) {
          loopIteration++;
          const currentState = {
            started: window.__tinder_encounter_started,
            completed: window.__tinder_encounter_completed,
            inPhase: window.__in_evening_phase
          };
          
          // Log state changes
          if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
            lastState = currentState;
          }
          
          // If encounter completed, we're done
          if (window.__tinder_encounter_completed) {
            break;
          }
          
          // If flag was cleared externally (shouldn't happen), restore it
          if (!window.__in_evening_phase && window.__tinder_encounter_started) {
            console.error('[TINDER FLOW] ERROR: Flag cleared while encounter in progress! Restoring...');
            window.__in_evening_phase = true;
          }
          
          // Log every 50 iterations (5 seconds) to track if loop is running
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const elapsed = Date.now() - startTime;
      }
      
      
    } catch (e) {
      console.error('[TINDER FLOW] Error in tinder branch:', e);
      console.error('[TINDER FLOW] Stack:', e.stack);
    } finally {
      
      // ONLY clear if encounter completed OR if no encounter was ever started
      // If encounter started but didn't complete, something went wrong - keep flag set
      if (window.__tinder_encounter_completed) {
        window.__in_evening_phase = false;
        window.__tinder_encounter_completed = false;
        window.__tinder_encounter_started = false;
      } else if (!window.__tinder_encounter_started) {
        // No encounter started - user just browsed Tinder and closed it
        window.__in_evening_phase = false;
        window.__tinder_encounter_completed = false;
        window.__tinder_encounter_started = false;
      } else {
        // Encounter started but not completed - this is an error state
        // Keep flag set so handleTinderInvitation can complete it
        console.warn('[TINDER FLOW] WARNING: Encounter started but not completed in finally block');
        console.warn('[TINDER FLOW] Keeping __in_evening_phase flag set - handleTinderInvitation should clear it');
      }
    }
    
    render();
    return;
  }

  // Nightclub branch
  await nightlifeEvent();
  render();
}
