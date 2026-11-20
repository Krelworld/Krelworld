/* --- GLOBAL ERROR HANDLING --- */
window.addEventListener('error', function(e) {
  console.error('GLOBAL ERROR CAUGHT:', e.error, e.message, e.filename, e.lineno);
  
  // Handle specific error types gracefully
  if (e.message && (e.message.includes('aborted') || e.message.includes('ERROR_USER_ABORTED_REQUEST'))) {
    return; // Don't save state for aborted requests
  }
  
  // Try to save state if possible
  if (window.S) saveGame(window.S);
});

window.addEventListener('unhandledrejection', function(e) {
  console.error('UNHANDLED PROMISE REJECTION:', e.reason);
  
  // Handle user aborted requests gracefully
  if (e.reason && e.reason.message && e.reason.message.includes('aborted')) {
    e.preventDefault();
    return;
  }
  
  // Handle other specific error types
  if (e.reason && e.reason.message && e.reason.message.includes('ERROR_USER_ABORTED_REQUEST')) {
    e.preventDefault();
    return;
  }
  
  e.preventDefault(); // Prevent the default browser behavior
});

/* --- GAME HOOKS ---
   The one extension mechanism for systems that need to react to core events
   (instead of re-wrapping log/updateHUD/choose/phase functions).

     GameHooks.on(event, fn)      register a handler (returns fn)
     GameHooks.off(event, fn)     remove it
     GameHooks.emit(event, ...a)  call handlers in registration order (errors are contained)
     GameHooks.veto(event, ...a)  true if any handler returned false (used to suppress a log line)

   Events emitted by the core:
     'log' (msg)                 after a line is written to the feed
     'log:veto' (msg)            before writing; return false to swallow the line
     'hud'                       after updateHUD() redraws the HUD
     'phase' (phase, prev)       whenever setPhase() changes S.phase, followed by the
                                 phase's own event: 'prematch' | 'postmatch' | 'evening' |
                                 'home' | 'oversight' | 'prison' (also 'boot', 'name_selection')
     'prematch:end', 'postmatch:end'   after preMatchPhase()/postMatchPhase() resolve
     'prison:match'              each match day spent in the prison loop
     'choices' ({root, prompt, options})  after choose() has drawn a menu's buttons
     'init'                      after init() has created/loaded S
     'matchday:end'              once per match, after postMatchPhase (finalizeMatchDay has
                                 reset the per-match morale fields): kickbacks, cocaine crash,
                                 drug-day resets
     'postmatch:gate-anchor'     NOT emitted: holds handlers that were keyed to an
                                 "Attendance: … Gate Revenue:" log line the core stopped
                                 writing and are superseded elsewhere (prison countdown is
                                 the prison loop; oversight is queued by the main loop) */
const GameHooks = (function(){
  const handlers = Object.create(null);
  function list(evt){ return handlers[evt] || (handlers[evt] = []); }
  return {
    on(evt, fn){ list(evt).push(fn); return fn; },
    off(evt, fn){ const l = list(evt); const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    emit(evt, ...args){
      for (const fn of list(evt).slice()){
        try { fn(...args); } catch (e) { console.error(`GameHooks '${evt}' handler failed:`, e); }
      }
    },
    veto(evt, ...args){
      let vetoed = false;
      for (const fn of list(evt).slice()){
        try { if (fn(...args) === false) vetoed = true; } catch (e) { console.error(`GameHooks '${evt}' handler failed:`, e); }
      }
      return vetoed;
    }
  };
})();
window.GameHooks = GameHooks;

// Explicit game phase (replaces guessing the phase from log text).
// window.__ui_context mirrors it for older code that still reads that.
window.__ui_context = window.__ui_context || 'boot';
function setPhase(phase){
  const prev = (window.S && S.phase) || window.__ui_context || null;
  if (window.S) S.phase = phase;
  window.__ui_context = phase;
  GameHooks.emit('phase', phase, prev);
  if (phase) GameHooks.emit(phase);
}

/* --- SUBTLE SOUND EFFECTS SYSTEM --- */
(function() {
  'use strict';
  
  // Audio context for generating sounds
  let audioContext = null;
  let lastHoverTime = 0;
  let lastClickTime = 0;
  const HOVER_THROTTLE = 100; // ms between hover sounds
  const CLICK_THROTTLE = 50;  // ms between click sounds
  
  // Sound effects volume and mute state (defaults)
  let soundEffectsVolume = 1.0; // Default to full volume
  let soundEffectsMuted = false; // Default to not muted
  
  // Initialize audio context (requires user interaction first)
  function initAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return false;
      }
    }
    // Resume audio context if suspended (browsers require user interaction)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return true;
  }
  
  // Generate a subtle hover sound (soft whoosh/tick)
  function playHoverSound() {
    const now = Date.now();
    if (now - lastHoverTime < HOVER_THROTTLE) return;
    lastHoverTime = now;
    
    if (!initAudioContext()) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Soft, high-pitched tick
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.05);
      
      // Very subtle volume (multiplied by sound effects volume)
      const vol = (typeof soundEffectsVolume !== 'undefined') ? soundEffectsVolume : 1.0;
      const muted = (typeof soundEffectsMuted !== 'undefined') ? soundEffectsMuted : false;
      const baseVolume = muted ? 0 : (0.08 * vol);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch (e) {
      // Silently fail if audio can't be played
    }
  }
  
  // Generate a subtle click sound (soft pop)
  function playClickSound() {
    const now = Date.now();
    if (now - lastClickTime < CLICK_THROTTLE) return;
    lastClickTime = now;
    
    if (!initAudioContext()) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Soft, mid-pitched pop
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.08);
      
      // Subtle volume (multiplied by sound effects volume)
      const vol = (typeof soundEffectsVolume !== 'undefined') ? soundEffectsVolume : 1.0;
      const muted = (typeof soundEffectsMuted !== 'undefined') ? soundEffectsMuted : false;
      const baseVolume = muted ? 0 : (0.12 * vol);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(baseVolume, audioContext.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.08);
    } catch (e) {
      // Silently fail if audio can't be played
    }
  }
  
  // Initialize audio context on first user interaction
  function initOnInteraction() {
    if (!audioContext) {
      initAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', initOnInteraction);
      document.removeEventListener('touchstart', initOnInteraction);
    }
  }
  
  // Set up event delegation for all buttons
  function setupButtonSounds() {
    // Track which button is currently hovered to avoid duplicate sounds
    let hoveredButton = null;
    
    // Use mouseover (which bubbles) for hover detection
    document.addEventListener('mouseover', function(e) {
      const button = e.target.closest('button');
      if (button && button !== hoveredButton && !button.disabled) {
        hoveredButton = button;
        playHoverSound();
      }
    }, true);
    
    // Clear hovered button when mouse leaves
    document.addEventListener('mouseout', function(e) {
      const button = e.target.closest('button');
      if (button === hoveredButton) {
        hoveredButton = null;
      }
    }, true);
    
    document.addEventListener('click', function(e) {
      const button = e.target.closest('button');
      if (button && !button.disabled) {
        playClickSound();
      }
      // Initialize audio context on first click if not already done
      initOnInteraction();
    }, true);
    
    // Also initialize on touch for mobile
    document.addEventListener('touchstart', initOnInteraction, { once: true });
  }
  
  // Function to set sound effects volume (0.0 to 1.0)
  function setSoundEffectsVolume(volume) {
    if (typeof soundEffectsVolume === 'undefined') {
      soundEffectsVolume = 1.0;
    }
    soundEffectsVolume = Math.max(0, Math.min(1, volume));
    // Save to localStorage
    localStorage.setItem('_soundEffectsVolume', soundEffectsVolume.toString());
  }

  // Function to get sound effects volume
  function getSoundEffectsVolume() {
    if (typeof soundEffectsVolume === 'undefined') {
      // Fallback: try to load from localStorage or use default
      const saved = localStorage.getItem('_soundEffectsVolume');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          soundEffectsVolume = parsed;
        } else {
          soundEffectsVolume = 1.0;
        }
      } else {
        soundEffectsVolume = 1.0;
      }
    }
    return soundEffectsVolume;
  }

  // Function to toggle sound effects mute
  function toggleSoundEffectsMute() {
    if (typeof soundEffectsMuted === 'undefined') {
      const saved = localStorage.getItem('_soundEffectsMuted');
      soundEffectsMuted = saved === 'true' ? true : false;
    }
    soundEffectsMuted = !soundEffectsMuted;
    // Save to localStorage
    localStorage.setItem('_soundEffectsMuted', soundEffectsMuted.toString());
    return soundEffectsMuted;
  }

  // Function to check if sound effects are muted
  function isSoundEffectsMuted() {
    return soundEffectsMuted;
  }

  // Load saved volume and mute state
  const savedSFXVolume = localStorage.getItem('_soundEffectsVolume');
  if (savedSFXVolume !== null) {
    const parsed = parseFloat(savedSFXVolume);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      soundEffectsVolume = parsed;
    }
  }
  const savedSFXMuted = localStorage.getItem('_soundEffectsMuted');
  if (savedSFXMuted !== null) {
    soundEffectsMuted = savedSFXMuted === 'true';
  }

  // Expose volume control functions
  window._setSoundEffectsVolume = setSoundEffectsVolume;
  window._getSoundEffectsVolume = getSoundEffectsVolume;
  window._toggleSoundEffectsMute = toggleSoundEffectsMute;
  window._isSoundEffectsMuted = isSoundEffectsMuted;
  
  // Sound effect URLs - Replace these with actual sound effect URLs
  const soundEffects = {
    fart: 'https://www.dropbox.com/s/placeholder_fart.mp3?dl=1', // Replace with fart sound URL
    crunchSplat: 'https://www.dropbox.com/s/placeholder_crunch_splat.mp3?dl=1', // Replace with crunch/splat sound URL
    pistol: 'https://www.dropbox.com/s/placeholder_pistol.mp3?dl=1', // Replace with pistol sound URL
    machineGun: 'https://www.dropbox.com/s/placeholder_machine_gun.mp3?dl=1', // Replace with machine gun sound URL
    gunfire: 'https://www.dropbox.com/s/placeholder_gunfire.mp3?dl=1' // Replace with gunfire sound URL
  };
  
  // Function to play sound effects
  function playSoundEffect(soundName, volume = 0.7) {
    if (isSoundEffectsMuted()) return;
    
    const soundUrl = soundEffects[soundName];
    if (!soundUrl || soundUrl.includes('placeholder')) {
      console.warn(`Sound effect "${soundName}" not configured (placeholder URL detected)`);
      return;
    }
    
    try {
      const audio = new Audio(soundUrl);
      const vol = getSoundEffectsVolume();
      audio.volume = Math.min(volume * vol, 1.0);
      audio.play().catch(e => {
        console.error(`Error playing sound effect "${soundName}":`, e);
      });
    } catch (e) {
      console.error(`Error creating sound effect "${soundName}":`, e);
    }
  }
  
  // Expose sound effect function globally
  window.playSoundEffect = playSoundEffect;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtonSounds);
  } else {
    setupButtonSounds();
  }
})();

/* --- EARLY bootstrap: define globals before anything touches them --- */
var S = null;                              // game state singleton (use var to avoid TDZ)
const SAVE_KEY = 'saints_save_v4';

// ---- Save system: the single place game state is persisted/restored ----
// All saves go through saveGame(); all loads go through readSavedGame()/parseSavedGame(),
// which run normalizeGameState() so old saves are migrated on load.
function saveGame(state){
  try {
    const st = state || window.S || S;
    if (!st) return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
    return true;
  } catch (e) {
    console.error('Could not save game state:', e);
    return false;
  }
}
function parseSavedGame(raw){
  // Throws on corrupt JSON so callers can decide how to recover.
  return normalizeGameState(JSON.parse(raw));
}
function readSavedGame(){
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? parseSavedGame(raw) : null;
}

// User activity tracking to prevent unwanted interface resets
window._lastUserActivity = Date.now();
window._userActivityCheckInterval = null;

// Track user activity (mouse, keyboard, clicks)
function trackUserActivity() {
  window._lastUserActivity = Date.now();
}

// Initialize activity tracking
if (typeof window !== 'undefined') {
  ['mousedown', 'mousemove', 'keypress', 'keydown', 'click', 'touchstart', 'scroll'].forEach(eventType => {
    document.addEventListener(eventType, trackUserActivity, { passive: true });
  });
  
  // Check activity every 30 seconds
  window._userActivityCheckInterval = setInterval(() => {
    const timeSinceActivity = Date.now() - window._lastUserActivity;
    // If user has been inactive for more than 5 minutes, update activity timestamp to prevent false resets
    // This allows the timeout to work for truly inactive sessions while preventing resets during active play
    if (timeSinceActivity < 300000) { // 5 minutes
      window._lastUserActivity = Date.now(); // Refresh activity if user is active
    }
  }, 30000); // Check every 30 seconds
} 

// --- TEAMS / SCHEDULE / OPPONENT HELPERS (single source of truth) ---

// 16-team Premier League (you can tweak this list; Southampton stays)
const ALL_TEAMS = [
  "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
  "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
  "Man City","Man United","Newcastle","Tottenham","Wolves","Portsmouth"
];

// Recognizable managers for teams (at least 33% coverage)
const TEAM_MANAGERS = {
  "Arsenal": "Mikel Arteta",
  "Chelsea": "Mauricio Pochettino",
  "Liverpool": "Jürgen Klopp",
  "Man City": "Pep Guardiola",
  "Man United": "Erik ten Hag",
  "Tottenham": "Ange Postecoglou",
  "Newcastle": "Eddie Howe",
  "Aston Villa": "Unai Emery",
  "Brighton": "Roberto De Zerbi",
  "Everton": "Sean Dyche",
  "Crystal Palace": "Roy Hodgson",
  "Bournemouth": "Andoni Iraola",
  "Brentford": "Thomas Frank",
  "Fulham": "Marco Silva",
  "Wolves": "Gary O'Neil",
  "Portsmouth": "John Mousinho"
};

// Lightweight name generator for opponent managers
function randomManagerName(){
  const first = (typeof MALE_NAMES!=="undefined" ? MALE_NAMES : ["Alan","Mark","John"]);
  const last  = (typeof SURNAMES!=="undefined"   ? SURNAMES   : ["Smith","Brown","Jones"]);
  return `${first[Math.floor(Math.random()*first.length)]} ` +
         `${last[Math.floor(Math.random()*last.length)]}`;
}

// Build the season opponents ONCE per season (shuffled, no Southampton)
function ensureSeasonSchedule(){
  if (!S.opponents || !Array.isArray(S.opponents) || S.opponents.length === 0){
    let pool = ALL_TEAMS.filter(t => t !== "Southampton FC");
    
    // Season 4 & 5: Filter out liquidated teams, but ALWAYS include Portsmouth
    if (S.season === 4 || S.season === 5) {
      // Filter out liquidated teams if season4 data exists
      if (S.season4 && S.season4.liquidated_teams) {
        pool = pool.filter(t => !S.season4.liquidated_teams.includes(t));
      }
      
      // Ensure Portsmouth is always included (never liquidated)
      if (!pool.includes("Portsmouth")) {
        pool.push("Portsmouth");
      }
      
      // For season 4 & 5, include teams that were taken over (with their new names)
      if (S.season4 && S.season4.clubs_taken_over) {
        Object.values(S.season4.clubs_taken_over).forEach(newName => {
          if (!pool.includes(newName)) {
            pool.push(newName);
          }
        });
      }
      
      // Season 4 & 5: Limit to exactly 9 opponents (10 teams total including Southampton)
      // But ensure we have Portsmouth and all taken-over teams
      const requiredTeams = ["Portsmouth"];
      if (S.season4 && S.season4.clubs_taken_over) {
        Object.values(S.season4.clubs_taken_over).forEach(newName => {
          requiredTeams.push(newName);
        });
      }
      
      // Remove duplicates and ensure required teams are included
      pool = [...new Set(pool)];
      
      // If we have more than 9, prioritize required teams and fill the rest
      if (pool.length > 9) {
        const requiredInPool = pool.filter(t => requiredTeams.includes(t));
        const otherTeams = pool.filter(t => !requiredTeams.includes(t));
        // Take all required teams + enough others to make 9 total
        const needed = 9 - requiredInPool.length;
        pool = [...requiredInPool, ...otherTeams.slice(0, Math.max(0, needed))];
      } else if (pool.length < 9) {
        // If we have fewer than 9, pad with random teams (shouldn't happen, but safety check)
        const allTeams = ALL_TEAMS.filter(t => t !== "Southampton FC" && !pool.includes(t));
        while (pool.length < 9 && allTeams.length > 0) {
          const randomIndex = Math.floor(Math.random() * allTeams.length);
          pool.push(allTeams.splice(randomIndex, 1)[0]);
        }
      }
    }
    
    for (let i = pool.length - 1; i > 0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    S.opponents = pool;                              // play each once
    S.opponentManagers = S.opponents.map(team => {
      return (typeof TEAM_MANAGERS !== 'undefined' && TEAM_MANAGERS && TEAM_MANAGERS[team]) ? TEAM_MANAGERS[team] : randomManagerName();
    });
    S.matches_played = S.matches_played|0;          // normalise
    // Season 4 & 5 have 9 games, others have 16 - set based on season, not opponents.length
    S.season_matches = (S.season === 4 || S.season === 5) ? 9 : 16;
  } else {
    // Even if opponents already exist, ensure season_matches is set correctly
    // This fixes the issue where season_matches might be wrong after season transition
    // Set based on season number, not opponents.length (which may be from previous season)
    const expectedMatches = (S.season === 4 || S.season === 5) ? 9 : 16;
    S.season_matches = expectedMatches;
    
    // If opponents array length doesn't match expected season length, regenerate it
    // This handles the case where we transition from season 3 (16 teams) to season 4 (9 teams)
    if (S.opponents.length !== expectedMatches) {
      // Force regeneration by clearing opponents array
      S.opponents = [];
      S.opponentManagers = [];
      // Recursively call this function to regenerate with correct length
      ensureSeasonSchedule();
    }
  }
}





// ========== SEASON 4 HELPER FUNCTIONS ==========

// Get league name (replaces "Premier League" with "The Muslim Premier League" in Season 4+)
function getLeagueName() {
  if (S.season >= 4) {
    return "The Muslim Premier League";
  }
  return "Premier League";
}

// Apply linguistic overlay to dialogue/text (Season 4+)
// ONLY applies to character interactions (managers, players, police, etc.), NOT system messages
function applySeason4LinguisticOverlay(text) {
  if (!text || typeof text !== 'string' || S.season < 4) {
    return text;
  }
  
  // Only apply to messages that are clearly character dialogue/interactions
  // Look for patterns like: "Manager:", "Player:", quotes, or specific interaction keywords
  const isCharacterInteraction = 
    /(Manager|Player|Police|Agent|Captain|Secretary|Chairman|Visitor|Knock|whispers|says|demands|asks|tells|texts|SMS|📱)/i.test(text) ||
    (text.includes('"') && (text.includes(':') || text.match(/^[A-Z][^<]*"/))) ||
    (text.includes("'") && text.includes(':'));
  
  // Don't apply to system messages, league tables, emails, or game state messages
  const isSystemMessage = 
    /(League Position|League Table|📊|📧|League Administration|Full-time|Attendance|Matchday Revenue|Wage Week|Stadium|PRISON|EVENING|PRE-MATCH|Kickoff|Post-Match|Next Week|Season|Points|PTS|GD|W:|D:|L:)/i.test(text) ||
    text.includes('View Full Table') ||
    text.includes('Competitive balance') ||
    text.includes('financial injection') ||
    text.includes('has been rebranded');
  
  if (!isCharacterInteraction || isSystemMessage) {
    return text;
  }
  
  // List of Islamic idioms to randomly prepend/append
  const idioms = [
    "Salaam alaikum",
    "Inshallah",
    "Mashallah",
    "Alhamdulillah"
  ];
  
  // 30% chance to prepend an idiom
  if (Math.random() < 0.3) {
    const prependIdiom = idioms[Math.floor(Math.random() * idioms.length)];
    text = `${prependIdiom}, ${text}`;
  }
  
  // 20% chance to append an idiom
  if (Math.random() < 0.2) {
    const appendIdiom = idioms[Math.floor(Math.random() * idioms.length)];
    text = `${text}. ${appendIdiom}.`;
  }
  
  return text;
}

// Club takeover name pools (tiered by stage)
const SEASON4_CLUB_NAMES = {
  CORE: [
    "Riyadh FC", "Halal Athletic", "Hijab United", "Al Noor FC", 
    "Al Fajr Athletic", "Masjid City", "Barakah FC", "Ummah United", 
    "Al Salam Town"
  ],
  AGGRESSIVE: [
    "Riyadh Raiders", "Salafi Sharks", "Shia Scorpions", "Medina Marauders",
    "Hijaz Hawks", "Desert Lions FC", "Crescent Wolves", "Mecca Militia",
    "Sword of the Ummah", "Green Banner FC"
  ],
  CORPORATE: [
    "Halal FC", "Sharia United", "Modesty Athletic", "Divine Mandate FC"
  ],
  ESCALATION: [
    "Islamabad Penguins", "Doha Dockers", "Jeddah Rovers", "Karachi Kings (UK)",
    "Basra Borough", "Cairo Albion", "Damascus Wanderers", "Kuwait County",
    "Tripoli Town", "Tehran Athletic"
  ]
};

// Get a random club name for takeover based on stage
function getSeason4TakeoverName(stage) {
  let pool = [];
  if (stage === 'EARLY') {
    pool = SEASON4_CLUB_NAMES.CORE;
  } else if (stage === 'MID') {
    pool = [...SEASON4_CLUB_NAMES.AGGRESSIVE, ...SEASON4_CLUB_NAMES.CORPORATE];
  } else { // LATE
    pool = SEASON4_CLUB_NAMES.ESCALATION;
  }
  
  if (pool.length === 0) return "New Club FC";
  return pool[Math.floor(Math.random() * pool.length)];
}

// Personal life degradation check (Season 4)
function getSeason4HomeInteraction() {
  if (S.season >= 4 && S.season4 && S.season4.home_interaction_always_silent) {
    return "You eat a microwaved Aldi meal in eerie silence.";
  }
  return null; // Normal home interaction (if any)
}

// ========== SEASON 4: DAUGHTER INTERACTION SYSTEM ==========
// System name: DAUGHTER_SCENES_S4

// Initialize daughter scene flags if needed
function ensureDaughterSceneFlags() {
  if (!S.season4) S.season4 = {};
  if (S.season4.daughter_scene_1_complete === undefined) S.season4.daughter_scene_1_complete = false;
  if (S.season4.daughter_scene_2_complete === undefined) S.season4.daughter_scene_2_complete = false;
  if (S.season4.daughter_scene_3_complete === undefined) S.season4.daughter_scene_3_complete = false;
  if (S.season4.daughter_left_home === undefined) S.season4.daughter_left_home = false;
  if (S.season4.daughter_suggested_dating === undefined) S.season4.daughter_suggested_dating = false;
  if (S.season4.daughter_scene_this_match === undefined) S.season4.daughter_scene_this_match = false;
  if (S.season4.daughter_scene_1_match === undefined) S.season4.daughter_scene_1_match = -1;
}

// Main trigger function - determines which scene to show
async function triggerDaughterInteractionS4() {
  if (S.season !== 4 || !S.season4 || !S.season4.initialized) return;
  if (S.season4.daughter_left_home) return; // Daughter has left, no more interactions
  
  ensureDaughterSceneFlags();
  
  // Only one daughter interaction per match
  if (S.season4.daughter_scene_this_match) return;
  S.season4.daughter_scene_this_match = true;
  
  // Determine which scene to show based on progression
  const firstAuditMatch = S.season4.last_audit_match ?? -1; // an audit at match 0 counts
  const hasHadFirstAudit = firstAuditMatch >= 0;
  const seasonMatches = S.season_matches || 16;
  const isLateSeason = S.matches_played >= Math.floor(seasonMatches * 0.75);
  
  // Track when Scene 1 was completed
  if (!S.season4.daughter_scene_1_match) S.season4.daughter_scene_1_match = -1;
  if (S.season4.daughter_scene_1_complete && S.season4.daughter_scene_1_match === -1) {
    // If Scene 1 was just completed, record the match number
    S.season4.daughter_scene_1_match = S.matches_played;
  }
  
  // Scene 1: Early Season 4, before first Audit
  if (!S.season4.daughter_scene_1_complete && !hasHadFirstAudit) {
    await daughterScene1_HouseIsntEmpty();
    S.season4.daughter_scene_1_complete = true;
    S.season4.daughter_scene_1_match = S.matches_played;
    return;
  }
  
  // Scene 2: Mid Season 4, after Scene 1 is complete and either:
  // - At least 2 matches have passed since Scene 1, OR
  // - The first audit has happened
  // AND we're not in late season yet
  const matchesSinceScene1 = S.season4.daughter_scene_1_match >= 0 
    ? S.matches_played - S.season4.daughter_scene_1_match 
    : 999;
  const scene2Ready = S.season4.daughter_scene_1_complete && 
    (matchesSinceScene1 >= 2 || hasHadFirstAudit) && 
    !isLateSeason;
  
  if (!S.season4.daughter_scene_2_complete && scene2Ready) {
    await daughterScene2_Plans();
    S.season4.daughter_scene_2_complete = true;
    return;
  }
  
  // Scene 3: Late Season 4, before season end
  if (!S.season4.daughter_scene_3_complete && isLateSeason) {
    await daughterScene3_TheArgument();
    S.season4.daughter_scene_3_complete = true;
    S.season4.daughter_left_home = true;
    return;
  }
  
  // If all scenes are complete but daughter hasn't left (shouldn't happen, but safety)
  if (S.season4.daughter_left_home) {
    // Show silent home interaction
    log("You eat a microwaved meal in silence.");
  }
}

// Season 5: Two-part press conference about murdered players and Van Onslaught kidnapping
// Define this function at module level so it's accessible globally
async function conductKidnappingPressConference() {
  log(`\n📺 EMERGENCY PRESS CONFERENCE: Cameras flash as you are wheeled out in front of a Van Onslaught–approved backdrop.`);
  log(`The press want two things from you: grief for the murdered squad, and an explanation for why Mohammed Van Onslaught keeps kidnapping you like it's part of the fixture list.\n`);

  const categories = ['serious', 'humor', 'conspiratorial', 'lecherous', 'hostile'];

  const KIDNAP_PRESS_QUOTES = {
    serious: {
      players: {
        openings: [
          "Tonight we are not talking about football, we are talking about a mass grave in club colours",
          "I have spent the last twenty-four hours trying to identify charred limbs by shirt number",
          "Those players died in that stadium wearing a badge I sold to a murderer",
          "The dressing room still smells like burnt polyester and cooked marrow",
          "I keep seeing their names flash up on Sky Sports like transfer rumours, except it's the obituary ticker"
        ],
        middles: [
          "These were young men reduced to inventory on an insurance spreadsheet, and that is my fault",
          "Their families are getting emails about season ticket renewals while arranging funerals",
          "I signed them to win matches, and instead I fed them into a geopolitical art installation about cruelty",
          "Their boots are still lined up under hooks that will never be used again",
          "I don't know how to tell parents their sons died as a line item in Mohammed Van Onslaught's content strategy"
        ],
        closings: [
          "If there is justice, it will not come from the FA, it will come from whatever is waiting for me when I die",
          "We will build a memorial, then sell sponsorship rights to pay the legal fees",
          "All I can promise is that their deaths will not be forgotten, only monetised",
          "They deserved a career, not a commemorative scarf and a minute's silence sponsored by an insurance firm",
          "If there is a God, He supports someone else now"
        ]
      },
      kidnapping: {
        openings: [
          "As for my own abduction, let's not pretend it was some random act of chaos",
          "Mohammed Van Onslaught did not kidnap me because he hates me, he did it because he owns me",
          "Being bundled into the back of that van felt less like a crime and more like an HR transfer",
          "When Van Onslaught's men put a bag over my head, I recognised the club logo on the gloves",
          "The kidnapping wasn't a shock, it was the logical end-point of every compromise I've made"
        ],
        middles: [
          "He wanted to make it clear that my body is just another asset on his balance sheet",
          "We talked about TV rights while I was zip-tied to a chair, bleeding onto a mock-up of the new club crest",
          "He explained that loyalty is a luxury, and that people like me are not allowed luxuries any more",
          "He said that if I ever tried to leave, he would simply buy whatever I ran to",
          "He told me that fear is cheaper than wages, and far more reliable"
        ],
        closings: [
          "I came back in one piece, but only because I am more valuable alive than buried under the pitch",
          "From now on, every decision I make will be with his hand on the back of my neck",
          "I am not the chairman of Southampton FC; I am the hostage they let sit in the directors' box",
          "If you think I'm free, you have not been watching the same league as me",
          "He hasn't finished with me, or with this club; this was just his opening bid"
        ]
      }
    },
    humor: {
      players: {
        openings: [
          "Well, the good news is the wage bill has absolutely plummeted",
          "On the bright side, we finally found a way to stop the lads conceding late goals",
          "If you look at it coldly, this is the most decisive clear-out we've had in years",
          "The scouts always said our players would die for the shirt; turns out they meant it literally",
          "We were struggling to shift replica kits, now they're technically limited-edition martyr merch"
        ],
        middles: [
          "The accountants are thrilled, the physio less so",
          "Ticket demand has gone through the roof; people love a crime scene tour",
          "The club shop is flogging memorial candles next to the keyrings",
          "We asked the league for a postponement and they sent us a link to the refund policy",
          "The families keep asking about grief counselling and I keep accidentally sending them the hospitality brochure"
        ],
        closings: [
          "If nothing else, at least some of them finally tracked back",
          "We always wanted to be a feared away day — now people are scared to come full stop",
          "In death, they showed more commitment than they ever did tracking runners",
          "The least we can do is retire their shirt numbers and immediately sell the naming rights to the stand",
          "Look, if they wanted dignity they shouldn't have signed for Southampton FC"
        ]
      },
      kidnapping: {
        openings: [
          "As for the kidnapping, I've had worse corporate retreats",
          "Honestly, being stuffed into a van was the first time this season I felt in demand",
          "I've been on dodgier away coaches to Millwall",
          "They blindfolded me but I could tell from the smell it was still Southampton",
          "In fairness, it was the first time in years anyone's tried that hard to sign me"
        ],
        middles: [
          "They even gave me a tour of my own potential grave plot",
          "Van Onslaught kept calling it a 'performance review' which, technically, it was",
          "He said he wanted a word in private and then redefined 'private' as the inside of a shipping container",
          "Apparently the non-disclosure agreement now includes 'not disclosing the location of your shallow grave'",
          "He promised me I'd be a legend, either for winning the league or for how funny the autopsy photos look"
        ],
        closings: [
          "On balance, I'd still rather that than another Zoom call with the FA",
          "Next time I'll at least ask for air miles",
          "If he wanted to torture me he could have just made me watch our defending from last season",
          "At least the ropes were tight — tighter than our back five has ever been",
          "If he kidnaps me again, I'm putting it down as 'team bonding'"
        ]
      }
    },
    conspiratorial: {
      players: {
        openings: [
          "Let's not pretend this was just 'terrorism' in the abstract",
          "You really think the timing of this attack was an accident?",
          "Every time a small club starts to get ideas, something mysterious happens to it",
          "Look at who benefits from our entire squad being turned into fertiliser",
          "The bombs went off the week after I refused to sell to certain people — you join the dots"
        ],
        middles: [
          "The league gets a martyr, the broadcasters get content, and the big six get a laughing stock removed",
          "The insurance companies are already circling like vultures in club scarves",
          "The FA will do a solemn minute's silence and then fine us for damaging the pitch",
          "Our lads died in a stadium wired more thoroughly than any murder investigation I've ever seen",
          "Someone signed off on those security lapses with the same pen they use to approve VAR"
        ],
        closings: [
          "If justice is left to the authorities, expect a strongly worded email and nothing else",
          "This was a message to every club that thinks it can say no to money with a sword attached",
          "You can call it tragedy; I call it asset reallocation",
          "When the dust settles, check whose balance sheet got healthier",
          "Remember who told you, when they tell you it's just 'one lone wolf'"
        ]
      },
      kidnapping: {
        openings: [
          "My kidnapping was not a one-off — it was a proof of concept",
          "Van Onslaught didn't just snatch me, he beta-tested a new form of ownership",
          "You don't kidnap a chairman unless you know nobody important will object",
          "They wrapped me in a flag and called it due diligence",
          "The van wasn't a vehicle, it was a mobile boardroom with a padlock"
        ],
        middles: [
          "He explained that in this league, consent is just something you get from the accountants",
          "The message was simple: sign the papers or disappear into the data hole",
          "He bragged that every regulator reports to someone who reports to him",
          "They filmed the whole thing in portrait mode like it was a brand partnership",
          "He told me he'd already bought the police force that would 'investigate' it"
        ],
        closings: [
          "If you think I'm the only one he's done this to, you're not paying attention",
          "From now on, every handshake deal in football comes with someone standing just out of frame with a gun",
          "This isn't corruption, it's the new rulebook",
          "I am not a victim, I'm a precedent",
          "This is what happens when you turn a national sport into a hostage negotiation"
        ]
      }
    },
    lecherous: {
      players: {
        openings: [
          "Look, the real tragedy is all those widows turning up to grief counselling in black dresses",
          "It's been a rough week, but the players' wives have been very, very supportive",
          "I've personally taken it upon myself to comfort the bereaved, physically where necessary",
          "You should see the talent in that memorial lounge; it's like God handpicked a WAG convention",
          "We lost eleven starters and gained a lot of very vulnerable plus-ones"
        ],
        middles: [
          "I've been visiting houses purely to check if the casseroles are hot and the widows are hotter",
          "Some of these ladies need a strong chairman figure in their lives now, and I'm nothing if not generous",
          "Grief does strange things to people; for example, it makes them find me attractive",
          "I'm setting up a foundation, mostly to foundation myself between some of these lonely hearts",
          "If they want someone who really understands what their husbands went through, I'm available for home visits"
        ],
        closings: [
          "If any grieving partners are watching, my door — and my zip — are always open",
          "The least I can do is personally ensure nobody has to sleep alone in this difficult time",
          "They died for the badge; I'll make sure their loved ones die for the experience",
          "I'm turning tragedy into opportunity, one bereaved spouse at a time",
          "We can't bring the lads back, but I can certainly keep their beds warm"
        ]
      },
      kidnapping: {
        openings: [
          "When Van Onslaught kidnapped me, I assumed it was finally my turn to be objectified",
          "Being tied up in a dark room is not my usual kink, but I adjusted quickly",
          "They blindfolded me, which I actually found quite arousing",
          "I told them if they wanted me that badly, they should at least buy me dinner first",
          "For a moment I thought it was just another sex scandal, which frankly would have been a relief"
        ],
        middles: [
          "He leaned in close enough that I could smell the oil money on his breath",
          "He said he owned my body, which is honestly the most romantic thing anyone's said to me in years",
          "I tried to negotiate a 'friends with benefits and torture' arrangement",
          "I asked if this counted as a 'release clause' and he didn't laugh, but I did",
          "We were inches apart — him, the executioner; me, the only man in the room with worse morals"
        ],
        closings: [
          "If he kidnaps me again, I might not struggle quite so hard",
          "Some men send flowers; he sends a van and a sack — everyone has their love language",
          "I've had worse dates, and at least this one came with security",
          "If this is what late capitalism feels like, at least it has strong hands",
          "Next time I'll wear something more flattering for the CCTV"
        ]
      }
    },
    hostile: {
      players: {
        openings: [
          "You want honesty? Some of those lads died doing the first sprint they've done all season",
          "Half that dressing room has been stealing a living for years; now they're finally giving something back",
          "If they'd shown this much commitment on the pitch, we wouldn't be in the relegation zone",
          "Some of them fought harder to escape their contracts than they did to escape the flames",
          "I told them to 'leave everything out there' and they took it disturbingly literally"
        ],
        middles: [
          "They've been robbing me blind on wages; call this a cosmic repayment plan",
          "Do I weep for men who couldn't complete five passes under no pressure? Not especially",
          "The club lost a squad; I lost a liability column",
          "The only time they hit their targets was when shrapnel did it for them",
          "If you die a hero at Southampton it's usually because you tripped on your own contract"
        ],
        closings: [
          "We'll replace them with cheaper, hungrier, more flammable talent",
          "The badge survives; the meat inside the shirts was always interchangeable",
          "We move on, we rebuild, we downgrade the wage demands",
          "If they didn't want risk, they should have joined a mid-table German side",
          "Frankly, the club crest looks better without their stupid faces under it"
        ]
      },
      kidnapping: {
        openings: [
          "As for Van Onslaught kidnapping me, get in line",
          "He thinks he's the first psychopath to throw me in the back of a van",
          "I have been held hostage by worse people, including several directors of football",
          "If he wanted to scare me he should have shown me our balance sheet instead",
          "He dragged me off like a dog; fortunately I'm house-trained"
        ],
        middles: [
          "He shouted, I laughed, he threatened my life, I threatened to sell his favourite player",
          "He waved execution videos at me like season highlight reels; I've seen more disturbing defending",
          "He told me he could end me; I reminded him I've already ruined myself",
          "He promised to destroy the club; I said he'd be taking my job",
          "He thought pain would change me; pain is just Tuesday at Southampton"
        ],
        closings: [
          "If he comes again, I'll be waiting with lawyers, knives and a relegation clause",
          "He doesn't frighten me; I've read our fan mail",
          "Tell him if he wants me, he can come on the pitch at half-time and try it in front of the fans",
          "I've survived worse than him: I've survived this club",
          "If he wants a war, I'll sell tickets"
        ]
      }
    }
  };

  // PART ONE: murdered players
  log(`\n📺 PART ONE — YOUR TEAM DIED IN THE ATTACK`);
  log(`Choose how you want to frame the deaths of your players.`);

  const partOneOpening = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'How do you open about the murdered squad?'
  );
  const partOneMiddle = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'What tone do you take in the middle?'
  );
  const partOneClosing = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'How do you close your answer about the squad?'
  );

  function buildKidnapQuote(section, openKey, midKey, closeKey) {
    const openBank = KIDNAP_PRESS_QUOTES[openKey][section];
    const midBank = KIDNAP_PRESS_QUOTES[midKey][section];
    const closeBank = KIDNAP_PRESS_QUOTES[closeKey][section];
    if (!openBank || !midBank || !closeBank) return `"I have nothing to say."`;
    const opening = pick(openBank.openings);
    const middle = pick(midBank.middles);
    const closing = pick(closeBank.closings);
    return `"${opening}. ${middle}. ${closing}."`;
  }

  const partOneQuote = buildKidnapQuote('players', partOneOpening, partOneMiddle, partOneClosing);
  log(`\n📺 Your statement about the murdered players: ${partOneQuote}\n`);

  // Simple consequences for tone in part one
  const p1Tones = [partOneOpening, partOneMiddle, partOneClosing];
  const p1Serious = p1Tones.filter(t => t === 'serious').length;
  const p1Humor = p1Tones.filter(t => t === 'humor').length;
  const p1Consp = p1Tones.filter(t => t === 'conspiratorial').length;
  const p1Lech = p1Tones.filter(t => t === 'lecherous').length;
  const p1Hostile = p1Tones.filter(t => t === 'hostile').length;

  if (p1Serious >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 5);
    S.reputation = Math.min(100, (S.reputation || 50) + 4);
    log(`📈 Fan morale +5%, Reputation +4% (Public sees genuine grief)`);
  }
  if (p1Humor >= 2 || p1Lech >= 1 || p1Hostile >= 2) {
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 8);
    S.reputation = Math.max(0, (S.reputation || 50) - 12);
    S.legal_risk = (S.legal_risk || 0) + 10;
    log(`📉 Fan morale -8%, Reputation -12%, ⚖️ Legal risk +10 (Tasteless remarks about the dead squad)`);
  }
  if (p1Consp >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 3);
    S.fa_risk = (S.fa_risk || 0) + 15;
    log(`📈 Fan morale +3% (Conspiracy appeals to ultras), 🏛️ FA risk +15`);
  }

  // PART TWO: your kidnapping by Mohammed Van Onslaught
  log(`\n📺 PART TWO — VAN ONSLAUGHT'S KIDNAPPING OF YOU`);
  log(`Now the press turn to your personal abduction by Mohammed Van Onslaught.`);

  const partTwoOpening = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'How do you open about the kidnapping?'
  );
  const partTwoMiddle = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'What tone do you take in the middle?'
  );
  const partTwoClosing = await choose(
    categories.map(cat => ({ key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`, variant: cat === 'serious' ? 'good' : (cat === 'humor' ? 'warn' : 'bad') })),
    'How do you close your answer about the kidnapping?'
  );

  const partTwoQuote = buildKidnapQuote('kidnapping', partTwoOpening, partTwoMiddle, partTwoClosing);
  log(`\n📺 Your statement about the kidnapping: ${partTwoQuote}\n`);

  // Consequences for tone in part two
  const p2Tones = [partTwoOpening, partTwoMiddle, partTwoClosing];
  const p2Serious = p2Tones.filter(t => t === 'serious').length;
  const p2Humor = p2Tones.filter(t => t === 'humor').length;
  const p2Consp = p2Tones.filter(t => t === 'conspiratorial').length;
  const p2Lech = p2Tones.filter(t => t === 'lecherous').length;
  const p2Hostile = p2Tones.filter(t => t === 'hostile').length;

  if (p2Serious >= 2) {
    S.reputation = Math.min(100, (S.reputation || 50) + 3);
    S.police_risk = (S.police_risk || 0) + 5;
    log(`📈 Reputation +3% (Grave tone about kidnapping), 🚔 Police risk +5 (security questions)`);
  }
  if (p2Humor >= 2 || p2Lech >= 1) {
    S.reputation = Math.max(0, (S.reputation || 50) - 10);
    S.compliance_risk = (S.compliance_risk || 0) + 10;
    log(`📉 Reputation -10%, 🧾 Compliance risk +10 (Making light of your own abduction)`);
  }
  if (p2Hostile >= 2) {
    S.fa_risk = (S.fa_risk || 0) + 10;
    log(`🏛️ FA risk +10 (Directly antagonising the new regime)`);
  }
  if (p2Consp >= 2) {
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 4);
    S.legal_risk = (S.legal_risk || 0) + 15;
    log(`📈 Fan morale +4% (Fans love you 'speaking truth'), ⚖️ Legal risk +15 (Accusations on record)`);
  }

  // Van Onslaught response — formalises the survival economy penalty
  log(`\n🎙️ Mohammed Van Onslaught steps up to the microphones, flanked by armed security.`);
  log(`"From henceforth," he announces, "playing for Southampton FC is illegal under my administration."`);
  log(`"If they insist on continuing to take the field, the club will pay a very large penalty before every game to avoid serious consequences."`);
  log(`The room falls silent as everyone realises he's describing your new matchday business model, not a threat he plans to withdraw.`);
}

// Expose function to window for global access
if (typeof window !== 'undefined') {
  window.conductKidnappingPressConference = conductKidnappingPressConference;
}

// Cinematic wrapper for daughter interactions (similar to van onslaught but less sinister, faster text)
async function triggerDaughterInteractionS4WithCinematic() {
  if (S.season !== 4 || !S.season4 || !S.season4.initialized) return;
  if (S.season4.daughter_left_home) return;
  
  ensureDaughterSceneFlags();
  
  // Only one daughter interaction per match - set flag EARLY to prevent repeats even on error
  if (S.season4.daughter_scene_this_match) {
    return;
  }
  S.season4.daughter_scene_this_match = true;
  
  // Determine which scene to show
  const firstAuditMatch = S.season4.last_audit_match ?? -1; // an audit at match 0 counts
  const hasHadFirstAudit = firstAuditMatch >= 0;
  const seasonMatches = S.season_matches || 16;
  const isLateSeason = S.matches_played >= Math.floor(seasonMatches * 0.75);
  
  // Track when Scene 1 was completed
  if (!S.season4.daughter_scene_1_match) S.season4.daughter_scene_1_match = -1;
  if (S.season4.daughter_scene_1_complete && S.season4.daughter_scene_1_match === -1) {
    // If Scene 1 was just completed, record the match number
    S.season4.daughter_scene_1_match = S.matches_played;
  }
  
  let sceneFunction = null;
  let sceneKey = null;
  
  if (!S.season4.daughter_scene_1_complete && !hasHadFirstAudit) {
    sceneFunction = daughterScene1_HouseIsntEmpty;
    sceneKey = 'scene1';
  } else {
    // Scene 2: After Scene 1 is complete and either:
    // - At least 2 matches have passed since Scene 1, OR
    // - The first audit has happened
    // AND we're not in late season yet
    const matchesSinceScene1 = S.season4.daughter_scene_1_match >= 0 
      ? S.matches_played - S.season4.daughter_scene_1_match 
      : 999;
    const scene2Ready = S.season4.daughter_scene_1_complete && 
      (matchesSinceScene1 >= 2 || hasHadFirstAudit) && 
      !isLateSeason;
    
    if (!S.season4.daughter_scene_2_complete && scene2Ready) {
      sceneFunction = daughterScene2_Plans;
      sceneKey = 'scene2';
    } else if (!S.season4.daughter_scene_3_complete && isLateSeason) {
      sceneFunction = daughterScene3_TheArgument;
      sceneKey = 'scene3';
    }
  }
  
  if (!sceneFunction) return;
  
  // Create cinematic modal (less sinister than van onslaught)
  const existingModal = document.getElementById('cinematic-daughter-modal');
  if (existingModal) existingModal.remove();
  
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'cinematic-daughter-modal';
  modalOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
    animation: fadeIn 0.5s ease-out;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    border: 2px solid rgba(99, 102, 241, 0.5);
    border-radius: 12px;
    box-shadow: 
      0 0 60px rgba(99, 102, 241, 0.4),
      0 0 120px rgba(0, 0, 0, 0.8),
      inset 0 0 40px rgba(99, 102, 241, 0.1);
    max-width: 900px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    overflow-x: hidden;
    animation: slideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    position: relative;
    z-index: 1;
    padding: 50px;
    color: #e0e0e0;
    font-family: 'Georgia', 'Times New Roman', serif;
    line-height: 1.8;
    font-size: 1.1em;
  `;
  
  modal.appendChild(modalContent);
  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
  
  // Function to append text with faster typewriter effect
  const appendToModal = (text, delay = 0, useTypewriter = true) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const p = document.createElement('p');
        if (text.trim() === '') {
          p.innerHTML = '<br>';
          modalContent.appendChild(p);
          modal.scrollTop = modal.scrollHeight;
          resolve();
        } else if (useTypewriter && text.trim() !== '' && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
          const span = document.createElement('span');
          span.className = 'typewriter-line';
          span.style.cssText = `
            display: inline-block;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            border-right: 2px solid #6366f1;
            animation: typewriterReveal 1.2s steps(40, end), blinkCursor 0.6s step-end infinite;
            color: #e0e0e0;
          `;
          span.textContent = text;
          p.appendChild(span);
          modalContent.appendChild(p);
          
          const measureEl = document.createElement('span');
          measureEl.style.visibility = 'hidden';
          measureEl.style.position = 'absolute';
          measureEl.style.whiteSpace = 'nowrap';
          measureEl.style.font = window.getComputedStyle(span).font;
          measureEl.textContent = text;
          document.body.appendChild(measureEl);
          const textWidth = measureEl.offsetWidth;
          document.body.removeChild(measureEl);
          
          span.style.maxWidth = textWidth + 'px';
          
          setTimeout(() => {
            span.style.borderRight = 'none';
            span.style.animation = 'typewriterReveal 1.2s steps(40, end)';
          }, 1300);
          
          setTimeout(() => {
            modal.scrollTop = modal.scrollHeight;
            resolve();
          }, 1200);
        } else {
          p.innerHTML = text;
          p.style.color = '#ffffff';
          modalContent.appendChild(p);
          modal.scrollTop = modal.scrollHeight;
          resolve();
        }
      }, delay);
    });
  };
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = `
    position: fixed;
    bottom: 50%;
    left: 50%;
    transform: translate(-50%, 50%);
    background: rgba(99, 102, 241, 0.3);
    border: 2px solid #6366f1;
    color: #e0e0e0;
    padding: 14px 28px;
    font-size: 17px;
    cursor: pointer;
    z-index: 20001;
    transition: all 0.3s ease;
    font-family: 'Georgia', 'Times New Roman', serif;
    box-shadow: 0 0 25px rgba(99, 102, 241, 0.5);
    border-radius: 6px;
    display: none;
  `;
  closeBtn.textContent = 'Close';
  
  let continueResolve;
  const continuePromise = new Promise(resolve => {
    continueResolve = resolve;
  });
  
  closeBtn.onclick = async () => {
    modalOverlay.style.animation = 'fadeIn 0.5s ease-out reverse';
    setTimeout(() => {
      modalOverlay.remove();
    }, 500);
    setTimeout(() => {
      continueResolve();
    }, 500);
  };
  modalOverlay.appendChild(closeBtn);
  
  // Run the scene function to get the dialogue
  // We'll need to capture the dialogue lines from the scene
  // For now, let's run the scene and then show it in the modal
  const daughterName = S.child2_name ? S.child2_name.split(' ')[0] : 'Your daughter';
  
  // Show scene content in modal (faster text presentation)
  (async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get full scene lines based on which scene (using actual dialogue from scene functions)
    let sceneLines = [];
    if (sceneKey === 'scene1') {
      sceneLines = [
        `<strong>${daughterName}:</strong> "Hey Dad. You're back late."`,
        ``,
        `<strong>YOU:</strong> "Yeah. Long bloody day. Stopped for a beer on way back, very yummy..mmm..it was like a combination of crisp yet juicy, it slid down my throat in a very nice type way"`,
        ``,
        `<strong>${daughterName}:</strong> "I watched the match."`,
        ``,
        `(Pause)`,
        ``,
        `<strong>YOU:</strong> "I'm sorry, lass. About me and your Mum"`,
        ``,
        `<strong>${daughterName}:</strong> "It's not your fault."`,
        ``,
        `<strong>YOU:</strong> "Yep…it's all her fucking fault!"`,
        ``,
        `<strong>${daughterName}:</strong> "I don't blame her either. Sometimes things just don't' work out"`,
        ``,
        `(She pours two drinks. Non-alcoholic. You ask for a beer and pour the first drink down the drain, it was a smoothie – yuck!)`,
        ``,
        `<strong>${daughterName}:</strong> "Mum's not coming back, is she."`,
        ``,
        `<strong>YOU:</strong> "No. She decided she doesn't love us anymore"`,
        ``,
        `<strong>${daughterName}:</strong> "Okay."`,
        ``,
        `(Silence.)`,
        ``,
        `<strong>${daughterName}:</strong> "They're saying things on the news. About the league. And these new people who own it"`,
        ``,
        `<strong>YOU:</strong> "Yep..I call them the rag 'eds!!!"`,
        ``,
        `<strong>${daughterName}:</strong> "Dad! You can't say that! That's bigoted!."`,
        ``,
        `<strong>YOU:</strong> "You're right lass…the beer has gotten the better of me..I'm sorry"`,
        ``,
        `(She nods sweetly.)`,
        ``,
        `<strong>${daughterName}:</strong> "I don't really care about football. I care about you."`,
        ``,
        `(Beat.)`,
        ``,
        `<strong>${daughterName}:</strong> "Just don't disappear on me, like Mum did, okay?"`,
        ``,
        `<strong>YOU:</strong> "I won't. Never. Please can I have another beer"`
      ];
    } else if (sceneKey === 'scene2') {
      sceneLines = [
        `<strong>${daughterName}:</strong> "I was thinking… maybe you should try dating again."`,
        ``,
        `<strong>YOU:</strong> "Yeah?."`,
        ``,
        `<strong>${daughterName}:</strong> "I don't mean seriously. Just… talking to people. Putting yourself out there"`,
        ``,
        `<strong>YOU:</strong> "You don't have to look after me."`,
        ``,
        `<strong>${daughterName}:</strong> "I know. I just don't like how quiet it's getting..without Mum"`,
        ``,
        `(She smiles.)`,
        ``,
        `<strong>${daughterName}:</strong> "My friend helped her dad set up a Tinder profile."`,
        ``,
        `<strong>YOU:</strong> "Did she."`,
        ``,
        `<strong>${daughterName}:</strong> "Yeah. He got really into it. Took about a hundred photos. He met a lot of lovely women"`,
        ``,
        `(Small pause.)`,
        ``,
        `<strong>${daughterName}:</strong> "You deserve pleasure too, Dad. You were with only one woman for so long. You need to experience some more"`,
        ``,
        `(She stands.)`,
        ``,
        `<strong>${daughterName}:</strong> "Oh — and if you do… just be honest."`,
        ``,
        `(She hesitates.)`,
        ``,
        `<strong>${daughterName}:</strong> "About who you are."`
      ];
    } else if (sceneKey === 'scene3') {
      sceneLines = [
        `<strong>${daughterName}:</strong> "I've been looking at universities."`,
        ``,
        `<strong>YOU:</strong> "Yeah?"`,
        ``,
        `<strong>${daughterName}:</strong> "There's this one in London."`,
        ``,
        `(You pause, the warmth of pride swelling in your chest. You always hoped she might end up at UCL or King's)`,
        ``,
        `<strong>${daughterName}:</strong> "It's called Strip University."`,
        ``,
        `(Silence.)`,
        ``,
        `<strong>YOU:</strong> "…you what?."`,
        ``,
        `<strong>${daughterName}:</strong> "They are a stripping university. They offer a BA in Erotic Lapdance."`,
        ``,
        `<strong>YOU:</strong> "That's not a real fucking degree! What the fuck are you on about love!!"`,
        ``,
        `<strong>${daughterName}:</strong> "It's accredited! You're being unfair!! You are just a boomer! You don't understand life! You must just hate Women?"`,
        ``,
        `<strong>YOU:</strong> "That's not a real fucking degree!!"`,
        ``,
        `<strong>${daughterName}:</strong> "It's real to me. That's what matters! I think I would be really good at erotic lapdance! Delmor agrees with me by the way, he's not judgmental like you! He was the one who suggested it!"`,
        ``,
        `(The argument continues, you continue to raise bigoted and unfair criticisms of your Daughter studying erotic lapdance)`,
        ``,
        `<strong>${daughterName}:</strong> "I'm leaving. Mum and Delmor have agreed to take me in. Unlike you, they really understand me, and they support my academic interests"`,
        ``,
        `(She picks up her bag.)`,
        ``,
        `<strong>${daughterName}:</strong> "I'm sorry."`
      ];
    }

    for (const line of sceneLines) {
      await appendToModal(line, 250, true); // Faster than van onslaught (250ms vs 400ms+)
    }
    
    // Show close button
    closeBtn.style.display = 'block';
  })();
  
  // Wait for close button
  await continuePromise;
  
  // Mark scene as complete (the cinematic IS the scene, so we don't call the scene function)
  if (sceneKey === 'scene1') {
    S.season4.daughter_scene_1_complete = true;
    S.season4.daughter_scene_1_match = S.matches_played;
  } else if (sceneKey === 'scene2') {
    S.season4.daughter_scene_2_complete = true;
    // Scene 2 also sets the dating suggestion flag
    if (!S.season4.daughter_suggested_dating) {
      S.season4.daughter_suggested_dating = true;
      log('');
      log('Your daughter has suggested you try dating. Tinder becomes available.');
      log('');
    }
  } else if (sceneKey === 'scene3') {
    S.season4.daughter_scene_3_complete = true;
    S.season4.daughter_left_home = true;
  }
}

// Cinematic conversation system for daughter interactions with typewriter effect
async function showDaughterConversation(title, lines, choices = null) {
  // Create cinematic modal overlay (the full-screen backdrop)
  const overlay = document.createElement('div');
  overlay.className = 'cinematic-modal-overlay';
  
  // Create the modal box inside the overlay
  const modal = document.createElement('div');
  modal.className = 'cinematic-modal';
  
  // Create the content container inside the modal
  const content = document.createElement('div');
  content.className = 'cinematic-modal-content';
  
  // Title (no typewriter for title)
  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-size: 1.8rem;
    font-weight: 600;
    margin-bottom: 40px;
    color: var(--text);
    text-align: center;
    letter-spacing: 0.05em;
    opacity: 0;
    animation: fadeIn 0.5s ease-in 0.2s forwards;
  `;
  titleEl.textContent = title;
  content.appendChild(titleEl);
  
  // Dialogue container
  const dialogueEl = document.createElement('div');
  dialogueEl.style.cssText = `
    line-height: 2;
    font-size: 1.15rem;
    margin-bottom: 40px;
    min-height: 100px;
  `;
  content.appendChild(dialogueEl);
  
  // Typewriter function to display lines one by one
  const displayLinesWithTypewriter = async () => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines (they're used for spacing)
      if (!line || line.trim() === '') {
        const spacingEl = document.createElement('div');
        spacingEl.style.cssText = 'margin-bottom: 15px;';
        dialogueEl.appendChild(spacingEl);
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      
      const lineEl = document.createElement('div');
      lineEl.style.cssText = `
        margin-bottom: 30px;
        opacity: 0;
        animation: fadeIn 0.3s ease-in forwards;
      `;
      
      // Extract text content (handling HTML tags)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = line;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const hasHtml = line.includes('<strong>') || line.includes('<em>') || line.includes('<span>');
      
      if (hasHtml) {
        // For lines with HTML, show immediately but still animate appearance
        lineEl.innerHTML = line;
        lineEl.style.opacity = '0';
        lineEl.style.animation = 'fadeIn 0.5s ease-in forwards';
      } else {
        // For plain text, use typewriter effect
        lineEl.innerHTML = '';
        const textSpan = document.createElement('span');
        textSpan.className = 'typewriter-line';
        textSpan.style.cssText = `
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          position: relative;
          border-right: 2px solid #e0e0e0;
          animation: typewriterReveal 2s steps(40, end), blinkCursor 0.75s step-end infinite;
        `;
        textSpan.textContent = textContent;
        lineEl.appendChild(textSpan);
      }
      
      dialogueEl.appendChild(lineEl);
      
      // Wait for typewriter animation to complete (2s) plus a small delay
      await new Promise(resolve => setTimeout(resolve, hasHtml ? 500 : 2200));
      
      // Remove cursor from completed line
      if (!hasHtml && lineEl.querySelector('.typewriter-line')) {
        const typewriterSpan = lineEl.querySelector('.typewriter-line');
        typewriterSpan.style.borderRight = 'none';
        typewriterSpan.style.animation = 'typewriterReveal 2s steps(40, end)';
      }
    }
  };
  
  // Start displaying lines
  await displayLinesWithTypewriter();
  
  // Choices (if provided)
  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = `
    margin-top: 40px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    opacity: 0;
    animation: fadeIn 0.5s ease-in 0.3s forwards;
  `;
  
  if (choices && choices.length > 0) {
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.textContent = choice.label;
      btn.style.cssText = `
        padding: 15px 25px;
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.85) 100%);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        color: var(--text);
        cursor: pointer;
        font-size: 1.05rem;
        transition: all 0.3s;
        text-align: left;
        font-weight: 500;
      `;
      btn.onmouseenter = () => {
        btn.style.borderColor = 'var(--accent)';
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
        btn.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(22, 33, 62, 0.95) 100%)';
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = 'none';
        btn.style.background = 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.85) 100%)';
      };
      btn.onclick = () => {
        document.body.removeChild(overlay);
        window.__daughter_choice_result = choice.key;
      };
      choicesEl.appendChild(btn);
    }
  } else {
    // No choices - just a continue button
    const btn = document.createElement('button');
    btn.textContent = 'Continue';
    btn.style.cssText = `
      padding: 15px 30px;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.85) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font-size: 1.05rem;
      transition: all 0.3s;
      font-weight: 500;
      margin: 0 auto;
      display: block;
    `;
    btn.onmouseenter = () => {
      btn.style.borderColor = 'var(--accent)';
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
      btn.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(22, 33, 62, 0.95) 100%)';
    };
    btn.onmouseleave = () => {
      btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
      btn.style.background = 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.85) 100%)';
    };
    btn.onclick = () => {
      document.body.removeChild(overlay);
      window.__daughter_choice_result = 'continue';
    };
    choicesEl.appendChild(btn);
  }
  
  content.appendChild(choicesEl);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Wait for user choice
  return new Promise((resolve) => {
    const checkResult = () => {
      if (window.__daughter_choice_result !== undefined) {
        const result = window.__daughter_choice_result;
        window.__daughter_choice_result = undefined;
        resolve(result);
      } else {
        setTimeout(checkResult, 100);
      }
    };
    checkResult();
  });
}

// SCENE 1: "THE HOUSE ISN'T EMPTY"
async function daughterScene1_HouseIsntEmpty() {
  const daughterName = S.child2_name ? S.child2_name.split(' ')[0] : 'Your daughter';
  
  const lines = [
    `<strong>${daughterName}:</strong> "Hey Dad. You're back late."`,
    ``,
    `<strong>YOU:</strong> "Yeah. Long bloody day. Stopped for a beer on way back, very yummy..mmm..it was like a combination of crisp yet juicy, it slid down my throat in a very nice type way"`,
    ``,
    `<strong>${daughterName}:</strong> "I watched the match."`,
    ``,
    `(Pause)`,
    ``,
    `<strong>YOU:</strong> "I'm sorry, lass. About me and your Mum"`,
    ``,
    `<strong>${daughterName}:</strong> "It's not your fault."`,
    ``,
    `<strong>YOU:</strong> "Yep…it's all her fucking fault!"`,
    ``,
    `<strong>${daughterName}:</strong> "I don't blame her either. Sometimes things just don't' work out"`,
    ``,
    `(She pours two drinks. Non-alcoholic. You ask for a beer and pour the first drink down the drain, it was a smoothie – yuck!)`,
    ``,
    `<strong>${daughterName}:</strong> "Mum's not coming back, is she."`,
    ``,
    `<strong>YOU:</strong> "No. She decided she doesn't love us anymore"`,
    ``,
    `<strong>${daughterName}:</strong> "Okay."`,
    ``,
    `(Silence.)`,
    ``,
    `<strong>${daughterName}:</strong> "They're saying things on the news. About the league. And these new people who own it"`,
    ``,
    `<strong>YOU:</strong> "Yep..I call them the rag 'eds!!!"`,
    ``,
    `<strong>${daughterName}:</strong> "Dad! You can't say that! That's bigoted!."`,
    ``,
    `<strong>YOU:</strong> "You're right lass…the beer has gotten the better of me..I'm sorry"`,
    ``,
    `(She nods sweetly.)`,
    ``,
    `<strong>${daughterName}:</strong> "I don't really care about football. I care about you."`,
    ``,
    `(Beat.)`,
    ``,
    `<strong>${daughterName}:</strong> "Just don't disappear on me, like Mum did, okay?"`,
    ``,
    `<strong>YOU:</strong> "I won't. Never. Please can I have another beer"`
  ];
  
  await showDaughterConversation("Home", lines);
  
  log("You sat together for a while.");
}

// SCENE 2: "PLANS"
async function daughterScene2_Plans() {
  const daughterName = S.child2_name ? S.child2_name.split(' ')[0] : 'Your daughter';
  
  const lines = [
    `<strong>${daughterName}:</strong> "I was thinking… maybe you should try dating again."`,
    ``,
    `<strong>YOU:</strong> "Yeah?."`,
    ``,
    `<strong>${daughterName}:</strong> "I don't mean seriously. Just… talking to people. Putting yourself out there"`,
    ``,
    `<strong>YOU:</strong> "You don't have to look after me."`,
    ``,
    `<strong>${daughterName}:</strong> "I know. I just don't like how quiet it's getting..without Mum"`,
    ``,
    `(She smiles.)`,
    ``,
    `<strong>${daughterName}:</strong> "My friend helped her dad set up a Tinder profile."`,
    ``,
    `<strong>YOU:</strong> "Did she."`,
    ``,
    `<strong>${daughterName}:</strong> "Yeah. He got really into it. Took about a hundred photos. He met a lot of lovely women"`,
    ``,
    `(Small pause.)`,
    ``,
    `<strong>${daughterName}:</strong> "You deserve pleasure too, Dad. You were with only one woman for so long. You need to experience some more"`,
    ``,
    `(She stands.)`,
    ``,
    `<strong>${daughterName}:</strong> "Oh — and if you do… just be honest."`,
    ``,
    `(She hesitates.)`,
    ``,
    `<strong>${daughterName}:</strong> "About who you are."`
  ];
  
  await showDaughterConversation("Home", lines);
  
  log("She suggested you try dating.");
  S.season4.daughter_suggested_dating = true;
}

// SCENE 3: "THE ARGUMENT"
async function daughterScene3_TheArgument() {
  const daughterName = S.child2_name ? S.child2_name.split(' ')[0] : 'Your daughter';
  
  const lines = [
    `<strong>${daughterName}:</strong> "I've been looking at universities."`,
    ``,
    `<strong>YOU:</strong> "Yeah?"`,
    ``,
    `<strong>${daughterName}:</strong> "There's this one in London."`,
    ``,
    `(You pause, the warmth of pride swelling in your chest. You always hoped she might end up at UCL or King's)`,
    ``,
    `<strong>${daughterName}:</strong> "It's called Strip University."`,
    ``,
    `(Silence.)`,
    ``,
    `<strong>YOU:</strong> "…you what?."`,
    ``,
    `<strong>${daughterName}:</strong> "They are a stripping university. They offer a BA in Erotic Lapdance."`,
    ``,
    `<strong>YOU:</strong> "That's not a real fucking degree! What the fuck are you on about love!!"`,
    ``,
    `<strong>${daughterName}:</strong> "It's accredited! You're being unfair!! You are just a boomer! You don't understand life! You must just hate Women?"`,
    ``,
    `<strong>YOU:</strong> "That's not a real fucking degree!!"`,
    ``,
    `<strong>${daughterName}:</strong> "It's real to me. That's what matters! I think I would be really good at erotic lapdance! Delmor agrees with me by the way, he's not judgmental like you! He was the one who suggested it!"`,
    ``,
    `(The argument continues, you continue to raise bigoted and unfair criticisms of your Daughter studying erotic lapdance)`,
    ``,
    `<strong>${daughterName}:</strong> "I'm leaving. Mum and Delmor have agreed to take me in. Unlike you, they really understand me, and they support my academic interests"`,
    ``,
    `(She picks up her bag.)`,
    ``,
    `<strong>${daughterName}:</strong> "I'm sorry."`
  ];
  
  await showDaughterConversation("Home", lines);
  
  log("Your house is empty.");
  S.season4.daughter_left_home = true;
  
  // Disable all future daughter scenes
  // (Already handled by daughter_left_home flag)
  
  // Set flag for Krunchem message on next match
  S.season4.krunchem_message_pending = true;
}


/* Hard guard: no code should access S until init() has run */
function ensureStateReady() {
  if (!S) throw new Error('State not initialized. Call init() first.');
}




