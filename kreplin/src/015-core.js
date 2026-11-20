/* --- GLOBAL ERROR HANDLING --- */
window.addEventListener('error', function(e) {
  console.log('GLOBAL ERROR CAUGHT:', e.error, e.message, e.filename, e.lineno);
  
  // Handle specific error types gracefully
  if (e.message && (e.message.includes('aborted') || e.message.includes('ERROR_USER_ABORTED_REQUEST'))) {
    console.log('User aborted request error handled gracefully');
    return; // Don't save state for aborted requests
  }
  
  // Try to save state if possible
  try {
    if (window.S) {
      localStorage.setItem('saints_save_v4', JSON.stringify(window.S));
      console.log('State saved after error');
    }
  } catch (saveError) {
    console.log('Could not save state after error:', saveError);
  }
});

window.addEventListener('unhandledrejection', function(e) {
  console.log('UNHANDLED PROMISE REJECTION:', e.reason);
  
  // Handle user aborted requests gracefully
  if (e.reason && e.reason.message && e.reason.message.includes('aborted')) {
    console.log('User aborted request handled gracefully');
    e.preventDefault();
    return;
  }
  
  // Handle other specific error types
  if (e.reason && e.reason.message && e.reason.message.includes('ERROR_USER_ABORTED_REQUEST')) {
    console.log('User aborted request error handled gracefully');
    e.preventDefault();
    return;
  }
  
  e.preventDefault(); // Prevent the default browser behavior
});

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
        console.log('Web Audio API not supported');
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
function init(){
  // If a save exists, you can load it here (optional)
  // const saved = localStorage.getItem(SAVE_KEY);
  // if (saved) { S = JSON.parse(saved); ensureSeasonSchedule(); ensureInitialSquad(); updateHUD(); return; }
if (!markBootOnce()) {
  // Even if already initialized, ensure inventory UI is set up
  console.log('Game already initialized, but ensuring inventory UI is set up');
  ensureInventoryUI();
  if (typeof window.ensurePowerNetworkUI === 'function') {
    window.ensurePowerNetworkUI();
  }
  return;
}
ensureInventoryUI();
if (typeof window.ensurePowerNetworkUI === 'function') {
  window.ensurePowerNetworkUI();
}
// Ensure DOM is ready before setting up doctor UI
console.log('About to setup doctor UI, document.readyState:', document.readyState);

// Function to setup doctor button with proper error handling
function setupDoctorButton() {
  const btn = document.getElementById('openDoctorBtn');
  if (btn) {
    // Remove any existing listeners to prevent duplicates
    btn.removeAttribute('data-listener-attached');
    btn.onclick = null;
    
    // Add the click handler
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Doctor button clicked!');
      if (typeof window.toggleDoctorPane === 'function') {
        window.toggleDoctorPane(true);
      } else {
        console.error('toggleDoctorPane function not available');
      }
    });
    
    btn.setAttribute('data-listener-attached', 'true');
    console.log('Doctor button setup complete');
  } else {
    console.error('Doctor button not found in DOM');
  }
}

// Setup immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  console.log('Document still loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', setupDoctorButton);
} else {
  console.log('Document ready, calling setupDoctorButton immediately');
  setupDoctorButton();
}

// Multiple fallbacks to ensure doctor button works - with longer delays to ensure functions are loaded
setTimeout(setupDoctorButton, 1000);
setTimeout(setupDoctorButton, 3000);
setTimeout(setupDoctorButton, 5000);

// Ensure doctor functions are available globally
setTimeout(() => {
  if (typeof window.toggleDoctorPane !== 'function') {
    console.log('toggleDoctorPane not available, calling ensureDoctorUI');
    if (typeof window.ensureDoctorUI === 'function') {
      window.ensureDoctorUI();
    }
  }
}, 6000);

// Ensure inventory button works with longer delays
setTimeout(() => {
  if (typeof window.ensureInventoryUI === 'function') {
    console.log('Late fallback: ensuring inventory UI');
    window.ensureInventoryUI();
  }
  if (typeof window.ensurePowerNetworkUI === 'function') {
    console.log('Late fallback: ensuring power network UI');
    window.ensurePowerNetworkUI();
  }
}, 4000);
setTimeout(() => {
  if (typeof window.ensureInventoryUI === 'function') {
    console.log('Final fallback: ensuring inventory UI');
    window.ensureInventoryUI();
  }
  if (typeof window.ensurePowerNetworkUI === 'function') {
    console.log('Final fallback: ensuring power network UI');
    window.ensurePowerNetworkUI();
  }
}, 7000);
ensureStadiumUI();
ensureFixturesUI();

// Fallback: ensure inventory UI is set up after a short delay
setTimeout(() => {
  console.log('Fallback: ensuring inventory UI is set up');
  if (typeof window.ensureInventoryUI === 'function') {
    window.ensureInventoryUI();
  }
  if (typeof window.ensurePowerNetworkUI === 'function') {
    console.log('Fallback: ensuring power network UI is set up');
    window.ensurePowerNetworkUI();
  }
  if (typeof window.ensureFixturesUI === 'function') {
    window.ensureFixturesUI();
  }
}, 2000);

// Immediate fallback when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready - ensuring inventory UI');
    if (typeof window.ensureInventoryUI === 'function') {
      window.ensureInventoryUI();
    }
    if (typeof window.ensurePowerNetworkUI === 'function') {
      console.log('DOM ready - ensuring power network UI');
      window.ensurePowerNetworkUI();
    }
    if (typeof window.ensureFixturesUI === 'function') {
      window.ensureFixturesUI();
    }
  });
} else {
  // DOM already ready
  console.log('DOM already ready - ensuring inventory UI immediately');
  if (typeof window.ensureInventoryUI === 'function') {
    window.ensureInventoryUI();
  }
  if (typeof window.ensurePowerNetworkUI === 'function') {
    console.log('DOM already ready - ensuring power network UI immediately');
    window.ensurePowerNetworkUI();
  }
}


  // Fresh state
  S = {
    // core clocks
    matches_played: 0,
    season_matches: 0,
    referee_bribed: false,
    referee_assaulted: false,
    opponent_bribed: false,
    ref_bribe_side: null,      // 'us' | 'them' (which side the ref will favor this match)
    accepted_bribe_this_match: false,
    reputation: 50,     // middle-ish; adjust if you track elsewhere
    offbooks: 0,  
    bribe_log: [], 

    // Lightweight world state / scandals (kept inside S so it persists with saves)
    worldFlags: {
      corruptionScore: 0,
      refereeScandalActive: false,
      refereeScandalBranch: null, // "deny" | "doubleDown" | "confess"
      mediaScandal: false,
      sexWithSecretary: false,
      lastBribedRefId: null,
      transferVendettas: {},
      journalistEnemies: {}
    },
    // Simple relationship-style state for factions
    relationships: {
      fa: 0,       // negative = hostile, positive = friendly
      media: 0,
      ultras: 0,
      board: 0
    },
    // Secretary – soft relationship state for later branches
    secretaryState: {
      loyalty: 0.5,
      resentment: 0,
      romance: 0,
      criminalBond: 0
    },
    // Per-rival relationship hooks (keyed by club name/id)
    rivalStates: {},
    // Lightweight match-indexed event queue for slow-burn fallout
    pendingWorldEvents: [],

    // money
    club_cash: 250000,
    chairman_cash: 50000,
    debt_club: 0,
    debt_personal: 0,
    
    // debt management system
    debt_creditor: {
      active: false,              // whether debt has been sold to creditor
      principal: 0,               // original debt amount when sold
      interest_rate: 0.05,        // 5% interest per match
      matches_since_sale: 0       // matches since debt was sold
    },
    payment_plan: {
      active: false,              // whether payment plan is active
      total_amount: 0,            // total amount to repay
      remaining_amount: 0,        // amount still owed
      matches_remaining: 0,        // matches left to repay
      matches_total: 0            // total matches in plan
    },
    nuclear_option_used: false,  // whether nuclear option has been used
    club_sold_to: null,          // 'mcdonalds' | 'portsmouth' | null
    stadium_name: "St Mary's",    // stadium name (can be renamed)

    // squads
    squad: [],
    lineup: [],

    // pre-match
    preMatch: null,
    bet_history: [],

    // familyS
    wife_name: "",
    child1_name: "",
    child2_name: "",
    wives_count: 1,
    kids_count: 2,

    // meta-power network
    lobby_tokens: 0,                 // weird meta-power currency
    influence_policy: "standard",    // 'frugal' | 'standard' | 'aggressive' | 'obsessed'
    power_unlocked_number10: false,  // has entered Number 10
    power_unlocked_trident: false,   // has accessed Trident menu
    power_heat: 0,                   // suspicion / heat from political meddling (0-100)
    // admin
    secretary_hired: false,
    compliance_risk: 0,
    police_risk: 0,
legal_risk: 0,
fa_risk: 0,     // FA oversight risk
pfa_risk: 0,    // players' union risk
team_morale_boost: 0,   // set by your team talk
    morale_opponent: 70,    // opponent baseline for this match
    // ---- Framing via planted cash (silent stash) ----
    stolen: {
      last_rummage_cash: 0,      // amount from the most recent successful theft (no UI)
      last_rummage_side: null,   // 'own' | 'opp'
      planted_cash_target: null  // playerId you framed (null if none)
    },

    // ---- Pre-match visitors ----
    knock_queue: [],             // queued visitors (captain/manager, police/FA)
    visitors_handled: false,     // menu gate

    // ---- Women's Team Manager & Kuddle Cronster Scenarios ----
    womens_team: {
      manager_demands_this_season: 0,  // count of demands this season
      last_demand_match: -1,           // match number of last demand
      liquidated: false,                 // if team was liquidated
      manager_active: true               // if manager can still visit
    },
    cronster: {
      active: false,                     // if cronster scenario is active
      letter_received: false,            // if initial letter was received
      security_increased: false,         // if security was increased
      cameras_hallways: false,           // if hallway cameras installed
      cameras_secret_zone: false,         // if secret zone cameras installed
      hallways_matches_since_install: 0, // number of matches since hallway cameras were installed
      hallways_last_match_tracked: -1,   // last match number when counter was incremented
      sightings_count: 0,                // number of cronster sightings
      juice_incident: false,              // if juice incident happened
      juice_incident_pending: false,      // if juice incident is pending (to trigger on door open)
      juice_incident_triggered: false,    // if juice incident scene has been triggered
      cd_received: false,                 // if CD was received
      booby_trap_set: false,              // if booby trap was set
      booby_trap_climax_triggered: false,  // if the booby trap climax has been triggered
      booby_trap_pending_climax: false,    // if booby trap climax is pending
      secret_zone_watched: false,          // if secret zone footage has been watched (can only watch once)
      defeated: false,                     // if cronster was defeated
      starmer_story_queued: false          // if Starmer news story has been queued
    },

    // ---- Season 3 Narrative Arc Flags ----
    season3: {
      // SON flags
      son_hired_as_scout: false,
      son_relationship_with_secretary: false,
      son_framed_for_murder: false,
      son_raising_child_not_his: false,
      
      // PAUL "GAZZA" GASCOIGNE flags
      gaz_signed: false,
      gaz_sent_to_do_message: false,
      gaz_murdered_family: false,
      gaz_reported: false,
      gaz_killed_by_player: false,
      gaz_rating: 0,  // Rating: 0
      gaz_suicide_threatened: false,
      gaz_first_team_forced: false,
      gaz_denied_first_team: false,
      gaz_continues_theft: false,
      
      // SECRETARY flags
      secretary_affair_active: false,
      secretary_poly_reveal: false,
      secretary_framed: false,
      secretary_relationship_opened_to_player: false,
      dating_minigame_complete: false,
      drive_home_complete: false,
      
      // TEAM CAPTAIN flags
      captain_confessed: false,
      captain_seduced: false,
      captain_seduction_via_nightclub: false,
      captain_outed_to_press: false,
      
      // DELMOR KRUNCHEM flags
      krunchem_address_known: false,
      krunchem_family_murdered: false,
      shafty_rod_johnson_fratton_arrest_shown: false,
      
      // WOMEN'S TEAM flags
      womens_team_exists: false,
      womens_manager_complaint: false,
      womens_team_liquidated_due_to_gaz: false,
      womens_manager_placated_with_lie: false,
      
      // Season 3 act progression
      act1_complete: false,
      act2_complete: false,
      act3_complete: false,
      act4_complete: false,
      act5_complete: false,
      
      // Season end
      season_end_cinematic_shown: false,
      player_coma_between_seasons: false
    },

    // ---- Season 4 Narrative Arc Flags ----
    season4: {
      // Core flags
      initialized: false,
      league_renamed: false,
      clubs_taken_over: {},  // Map of club name -> new name
      takeover_stage: 'EARLY',  // EARLY, MID, LATE
      clubs_taken_over_count: 0,
      
      // Van Onslaught events
      van_onslaught_visit_complete: false,
      van_onslaught_visit_triggered: false,
      club_sale_refused: false,
      points_deducted_for_refusal: false,
      
      // Sheikh Rod Johnson
      rod_johnson_appearances: 0,
      rod_johnson_state_sanctioned: false,
      
      // Personal life degradation
      personal_life_locked: false,
      home_interaction_always_silent: true,
      
      // Monthly pressure events
      last_monthly_event: 0,
      monthly_event_count: 0,
      
      // Moral law updates
      cocaine_price_doubled: false,
      adultery_punishable: false,
      
      // Season end
      season_end_complete: false,
      s4_hajj_complete: false
    },

    // ---- Fundraiser System ----
    fundraiser: {
      used_this_season: false,  // Track if fundraiser used this season
      last_season_used: 0,      // Track which season it was last used
      events_used: []           // Track which events have been used (once per campaign)
    },


    // locker-room visit locks (one-time per match)
    visited_ownLocker: false,
    visited_oppLocker: false,
    spoke_to_team_this_prematch: false,

    // inventory for rummage outcomes
    inventory: { accolades: [], drugs: 0, items: [] },

    // ---- Quick-Sim Invective + 4-Option Taunt Wheel + Brick Throws ----
    frustration: 0,                    // frustration meter (0-100)
    sessionShouts: [],                 // shouts from this match session
    managerConfronted: false,          // flag for post-match manager confrontation
    
    // ---- Drinking and Manager Confrontation System ----
    drunk_matches_count: 0,            // count of matches played while drunk
    manager_apologies_count: 0,        // count of apologies made to manager
    manager_ultimatum_given: false,    // flag for ultimatum confrontation
    manager_quit_after_apology: false, // flag for manager quitting after broken apology
    last_drunk_match: null,            // timestamp of last drunk match
    manager_relationship: 50,          // relationship with manager (0-100)

    // stadium/facilities state
    stadium: {
      capacity: 32000,           // current stadium capacity
      quality: 60,               // stadium quality (affects comfort, ticket prices)
      safety: 80,                // safety rating (affects reputation)
      ticket_price: 35,          // base ticket price (read-only for now)
      upkeep_per_match: 15000,   // maintenance cost per match
      last_home_attendance: 0,   // last home match attendance
      utilization_percent: 0,    // last home match utilization %
      
      // active construction project
      active_project: null,      // null or project object
      construction_progress: 0,  // matches completed in current project
      construction_delays: 0,    // additional delays applied
      construction_overrun: 0,   // cost overrun percentage
      
    },

    // PlayerStats for Kreplin Legacy Certificate
    playerStats: {
      // Identity
      playerName: "",
      spouseNames: [],
      childrenNames: [],
      
      // Family Metrics
      numberOfWives: 0,
      numberOfChildren: 0,
      
      // Moral & Personal Conduct
      inappropriateImagesSent: 0,  // Dick pics
      sexualEncountersRecorded: 0,
      stdsContracted: 0,
      veryBadStdsContracted: 0,
      
      // Career & Competition
      gamesPlayed: 0,
      gamesWon: 0,
      matchesSpentInPrison: 0,
      matchesSpentInRehabilitation: 0,
      timeSpentOnSexOffendersRegister: 0,  // in matches
      
      // Crime & Corruption
      bribesMadeOrAccepted: 0,
      playersWhoDied: 0,
      amountGambled: 0,
      netGamblingOutcome: 0,  // can be negative
      
      // Substance Consumption
      gramsOfCocaineTaken: 0,  // 1 bag = 1 gram
      vialsOfHGHInjected: 0,
      
      // Trophies
      premierLeagueTitles: 0,
      championsLeagueTitles: 0,
      ultimaCupTitles: 0,
      
      // Additional
      kreplinGems: 0,
      endingType: ""
    }

  };

  // Build schedule + initial squad safely
  ensureSeasonSchedule();
  ensureInitialSquad();
  ensureValidLineup();
  ensureLeagueTableInit();
  ensureTopScorersInit();
  ensureInitialSquadIsEmpty();
  
  // Force initialize top scorers with sample data if empty
  if (!S.topScorers || Object.keys(S.topScorers).length === 0) {
    initializeLegendaryPlayersInTopScorers();
  }
setTimeout(runInitialDraftIfNeeded, 0);
hydrateMissingRiskAndMoraleFields();
  // --- guards for older saves / resilience ---
  if (!S.stolen) S.stolen = { last_rummage_cash:0, last_rummage_side:null, planted_cash_target:null };
  if (!Array.isArray(S.knock_queue)) S.knock_queue = [];
  if (typeof S.visitors_handled !== 'boolean') S.visitors_handled = false;
  // Initialize women's team and cronster state
  if (!S.womens_team) {
    S.womens_team = {
      manager_demands_this_season: 0,
      last_demand_match: -1,
      liquidated: false,
      manager_active: true
    };
  }
  if (!S.cronster) {
    S.cronster = {
      active: false,
      letter_received: false,
      security_increased: false,
      cameras_hallways: false,
      cameras_secret_zone: false,
      hallways_matches_since_install: 0,
      hallways_last_match_tracked: -1,
      sightings_count: 0,
      juice_incident: false,
      cd_received: false,
      cd_pending: false,
      booby_trap_set: false,
      booby_trap_climax_triggered: false,
      booby_trap_pending_climax: false,
      secret_zone_watched: false,
      defeated: false,
      starmer_story_queued: false,
      fibromyalgia_story_shown: false
    };
  }
  if (typeof S.referee_bribed !== 'boolean') S.referee_bribed = false;
  if (typeof S.referee_assaulted !== 'boolean') S.referee_assaulted = false;
  if (typeof S.opponent_bribed !== 'boolean') S.opponent_bribed = false;
  if (typeof S.reputation !== 'number') S.reputation = 50;
  if (typeof S.offbooks !== 'number') S.offbooks = 0;
  if (!Array.isArray(S.bribe_log)) S.bribe_log = [];
  if (typeof S.ref_bribe_side === 'undefined') S.ref_bribe_side = null;
  if (typeof S.accepted_bribe_this_match !== 'boolean') S.accepted_bribe_this_match = false;
  // Guards for new lightweight world state so older saves behave sensibly
  if (!S.worldFlags) {
    S.worldFlags = {
      corruptionScore: 0,
      refereeScandalActive: false,
      refereeScandalBranch: null,
      mediaScandal: false,
      sexWithSecretary: false,
      lastBribedRefId: null,
      transferVendettas: {},
      journalistEnemies: {}
    };
  } else {
    if (typeof S.worldFlags.corruptionScore !== 'number') S.worldFlags.corruptionScore = 0;
    if (typeof S.worldFlags.refereeScandalActive !== 'boolean') S.worldFlags.refereeScandalActive = false;
    if (!('refereeScandalBranch' in S.worldFlags)) S.worldFlags.refereeScandalBranch = null;
    if (typeof S.worldFlags.mediaScandal !== 'boolean') S.worldFlags.mediaScandal = false;
    if (typeof S.worldFlags.sexWithSecretary !== 'boolean') S.worldFlags.sexWithSecretary = false;
    if (!S.worldFlags.transferVendettas || typeof S.worldFlags.transferVendettas !== 'object') S.worldFlags.transferVendettas = {};
    if (!S.worldFlags.journalistEnemies || typeof S.worldFlags.journalistEnemies !== 'object') S.worldFlags.journalistEnemies = {};
  }
  if (!S.relationships || typeof S.relationships !== 'object') {
    S.relationships = { fa: 0, media: 0, ultras: 0, board: 0 };
  } else {
    if (typeof S.relationships.fa !== 'number') S.relationships.fa = 0;
    if (typeof S.relationships.media !== 'number') S.relationships.media = 0;
    if (typeof S.relationships.ultras !== 'number') S.relationships.ultras = 0;
    if (typeof S.relationships.board !== 'number') S.relationships.board = 0;
  }
  if (!S.secretaryState || typeof S.secretaryState !== 'object') {
    S.secretaryState = { loyalty: 0.5, resentment: 0, romance: 0, criminalBond: 0 };
  }
  if (!S.rivalStates || typeof S.rivalStates !== 'object') {
    S.rivalStates = {};
  }
  if (!Array.isArray(S.pendingWorldEvents)) {
    S.pendingWorldEvents = [];
  }
  // Initialize playerStats for Kreplin Legacy Certificate
  // Preserve existing values to maintain cumulative tracking across saves
  if (!S.playerStats || typeof S.playerStats !== 'object') {
    S.playerStats = {};
  }
  
  // Ensure all required fields exist, preserving existing values
  const safeNum = (val, defaultVal = 0) => {
    if (val === undefined || val === null || isNaN(val)) return defaultVal;
    const num = Number(val);
    return isNaN(num) ? defaultVal : num;
  };
  
  // Initialize or preserve identity fields
  if (!S.playerStats.playerName || typeof S.playerStats.playerName !== 'string') {
    S.playerStats.playerName = S.player_firstname && S.player_surname ? `${S.player_firstname} ${S.player_surname}` : "";
  }
  if (!Array.isArray(S.playerStats.spouseNames)) {
    S.playerStats.spouseNames = S.wife_name ? [S.wife_name] : [];
  }
  if (!Array.isArray(S.playerStats.childrenNames)) {
    S.playerStats.childrenNames = [S.child1_name, S.child2_name].filter(n => n);
  }
  
  // Initialize or preserve numeric fields (preserve existing cumulative values)
  S.playerStats.numberOfWives = safeNum(S.playerStats.numberOfWives, S.wives_count || 0);
  S.playerStats.numberOfChildren = safeNum(S.playerStats.numberOfChildren, S.kids_count || 0);
  S.playerStats.inappropriateImagesSent = safeNum(S.playerStats.inappropriateImagesSent, 0);
  S.playerStats.sexualEncountersRecorded = safeNum(S.playerStats.sexualEncountersRecorded, 0);
  S.playerStats.stdsContracted = safeNum(S.playerStats.stdsContracted, S.std_state && S.std_state !== "none" ? 1 : 0);
  S.playerStats.veryBadStdsContracted = safeNum(S.playerStats.veryBadStdsContracted, S.very_bad_std_state && S.very_bad_std_state !== "none" ? 1 : 0);
  // CRITICAL: gamesPlayed and gamesWon are CUMULATIVE across all seasons
  // Only initialize if undefined - never overwrite with current season's values
  if (S.playerStats.gamesPlayed === undefined || S.playerStats.gamesPlayed === null) {
    // Migration: If we're in season 2+, estimate cumulative games from current season
    // This handles old saves where cumulative stats weren't tracked
    if (S.season && S.season > 1) {
      // Estimate: assume previous seasons had 16 matches each (except season 4/5 which have 9)
      let estimatedPreviousGames = 0;
      for (let s = 1; s < S.season; s++) {
        estimatedPreviousGames += (s === 4 || s === 5) ? 9 : 16;
      }
      S.playerStats.gamesPlayed = estimatedPreviousGames + (S.matches_played || 0);
      S.playerStats.gamesWon = S.wins || 0; // Can't estimate wins, use current season's wins
    } else {
      S.playerStats.gamesPlayed = S.matches_played || 0; // First season, use current matches
      S.playerStats.gamesWon = S.wins || 0;
    }
  }
  if (S.playerStats.gamesWon === undefined || S.playerStats.gamesWon === null) {
    // If gamesPlayed was set above, use current wins; otherwise preserve existing or use 0
    if (S.playerStats.gamesPlayed !== undefined && S.playerStats.gamesPlayed !== null) {
      S.playerStats.gamesWon = S.wins || 0;
    } else {
      S.playerStats.gamesWon = 0;
    }
  }
  // Ensure they're numbers (in case they were strings)
  S.playerStats.gamesPlayed = safeNum(S.playerStats.gamesPlayed, 0);
  S.playerStats.gamesWon = safeNum(S.playerStats.gamesWon, 0);
  // Preserve cumulative prison/rehab time, don't reset
  S.playerStats.matchesSpentInPrison = safeNum(S.playerStats.matchesSpentInPrison, 0);
  S.playerStats.matchesSpentInRehabilitation = safeNum(S.playerStats.matchesSpentInRehabilitation, 0);
  S.playerStats.timeSpentOnSexOffendersRegister = safeNum(S.playerStats.timeSpentOnSexOffendersRegister, 0);
  S.playerStats.bribesMadeOrAccepted = safeNum(S.playerStats.bribesMadeOrAccepted, S.bribes_count || 0);
  S.playerStats.playersWhoDied = safeNum(S.playerStats.playersWhoDied, 0);
  S.playerStats.amountGambled = safeNum(S.playerStats.amountGambled, 0);
  S.playerStats.netGamblingOutcome = safeNum(S.playerStats.netGamblingOutcome, 0);
  S.playerStats.gramsOfCocaineTaken = safeNum(S.playerStats.gramsOfCocaineTaken, S.inventory?.drugs || 0);
  S.playerStats.vialsOfHGHInjected = safeNum(S.playerStats.vialsOfHGHInjected, 0);
  // Preserve cumulative title counts - these are critical!
  S.playerStats.premierLeagueTitles = safeNum(S.playerStats.premierLeagueTitles, 0);
  S.playerStats.championsLeagueTitles = safeNum(S.playerStats.championsLeagueTitles, 0);
  S.playerStats.ultimaCupTitles = safeNum(S.playerStats.ultimaCupTitles, 0);
  S.playerStats.worldCupTitles = safeNum(S.playerStats.worldCupTitles, 0);
  // Track kreplin gems from S.kreplin_gems
  S.playerStats.kreplinGems = safeNum(S.playerStats.kreplinGems, S.kreplin_gems || 0);
  if (typeof S.playerStats.endingType !== 'string') {
    S.playerStats.endingType = "";
  }
// bridge old/new debt keys so HUD stays in sync
if (typeof S.club_debt !== 'number') S.club_debt = S.debt_club|0;
else S.debt_club = S.club_debt|0;

// debt management system guards
if (!S.debt_creditor || typeof S.debt_creditor !== 'object') {
  S.debt_creditor = {
    active: false,
    principal: 0,
    interest_rate: 0.05,
    matches_since_sale: 0
  };
}
if (!S.payment_plan || typeof S.payment_plan !== 'object') {
  S.payment_plan = {
    active: false,
    total_amount: 0,
    remaining_amount: 0,
    matches_remaining: 0,
    matches_total: 0
  };
}
if (typeof S.nuclear_option_used !== 'boolean') S.nuclear_option_used = false;
if (typeof S.club_sold_to !== 'string') S.club_sold_to = null;
if (typeof S.stadium_name !== 'string') S.stadium_name = "St Mary's";

// stadium state guards for older saves
if (!S.stadium) {
  S.stadium = {
    capacity: 32000,
    quality: 60,
    safety: 80,
    ticket_price: 35,
    upkeep_per_match: 15000,
    last_home_attendance: 0,
    utilization_percent: 0,
    active_project: null,
    construction_progress: 0,
    construction_delays: 0,
    construction_overrun: 0,
  };
}

// rival system state guards
// Check if window.S has a rival first (in case state was loaded before init)
if (typeof window !== 'undefined' && window.S && window.S.rival && !S.rival) {
  console.log('DEBUG init(): Copying rival from window.S to S');
  S.rival = window.S.rival;
}

if (!S.rival) {
  console.log('DEBUG init(): Creating new rival object');
  S.rival = {
    name: "Delmor Krunchem",
    club: "Portsmouth",
    hatred: 0,
    lastEventTick: 0,
    enabled: true,
    inbox: [], // Array of messages from Delmor
    conversationHistory: [] // Full conversation history with replies
  };
} else {
  console.log('DEBUG init(): Normalizing existing rival state');
  // Normalize existing rival state
  if (typeof S.rival.hatred !== 'number') S.rival.hatred = 0;
  if (typeof S.rival.lastEventTick !== 'number') S.rival.lastEventTick = 0;
  if (typeof S.rival.enabled !== 'boolean') S.rival.enabled = true;
  if (!S.rival.name) S.rival.name = "Delmor Krunchem";
  if (!S.rival.club) S.rival.club = "Portsmouth";
  if (!Array.isArray(S.rival.inbox)) S.rival.inbox = [];
  if (!Array.isArray(S.rival.conversationHistory)) S.rival.conversationHistory = [];
}

// Ensure window.S also has the rival (sync both ways)
if (typeof window !== 'undefined') {
  if (!window.S) window.S = {};
  window.S.rival = S.rival;
  console.log('DEBUG init(): Synced rival to window.S');
}

// settings for rival system
if (!S.settings) {
  // Check window.S first
  if (typeof window !== 'undefined' && window.S && window.S.settings) {
    S.settings = window.S.settings;
  } else {
    S.settings = {};
  }
}
if (typeof S.settings.rival_abuse_enabled !== 'boolean') S.settings.rival_abuse_enabled = true;

// Sync settings to window.S
if (typeof window !== 'undefined') {
  if (!window.S) window.S = {};
  window.S.settings = S.settings;
}

// CRITICAL: Ensure window.S and global S reference the same object after all initialization
if (typeof window !== 'undefined') {
  window.S = S;
}

  updateHUD();
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

function buildRoundsFromOurOpponents(opponents){
  const rounds = [];
  const teams = ALL_TEAMS.slice();
  // Use current club name (supports renaming after nuclear option)
  const SOUTH = (typeof getClubName === 'function') ? getClubName() : (S?.club_name || "Southampton FC");

  for (let r=0; r<opponents.length; r++){
    const opp = opponents[r];
    const roundMatches = [];

    // Our fixture first (alternate home/away to add variety)
    const homeFirst = (r % 2 === 0);
    roundMatches.push(homeFirst ? [SOUTH, opp] : [opp, SOUTH]);

    // Pair remaining teams this round
    const pool = teams.filter(t => t !== SOUTH && t !== opp);
    for (let i = pool.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i=0; i<pool.length; i+=2){
      const a = pool[i], b = pool[i+1];
      if (!a || !b) break;
      // flip home for variety
      roundMatches.push( ((i/2)%2===0) ? [a,b] : [b,a] );
    }
    rounds.push(roundMatches);
  }
  return rounds;
}

// Ensure we have full rounds and the table has all teams
function ensureSeasonScheduleAndTable(){
  if (!S.table) S.table = {};
  // Build rounds if missing or season length changed
  if (!S.rounds || !Array.isArray(S.rounds) || S.rounds.length !== (S.opponents ? S.opponents.length : 0)) {
    if (!S.opponents || !S.opponents.length){
      let others = ALL_TEAMS.filter(t => t !== "Southampton FC");
      
      // Season 4 & 5: Filter out liquidated teams
      if (S.season === 4 && S.season4 && S.season4.liquidated_teams) {
        others = others.filter(t => !S.season4.liquidated_teams.includes(t));
        // Season 4: Limit to exactly 9 opponents (10 teams total including Southampton)
        if (others.length > 9) {
          others = others.slice(0, 9);
        }
      } else if (S.season === 5 && S.season4 && S.season4.liquidated_teams) {
        others = others.filter(t => !S.season4.liquidated_teams.includes(t));
        // Season 5: Also limit to 9 opponents (10 teams total including Southampton)
        if (others.length > 9) {
          others = others.slice(0, 9);
        }
      }
      
      S.opponents = others.slice(0, Math.min(others.length, S.season_matches || others.length));
    }
    S.rounds = buildRoundsFromOurOpponents(S.opponents);
  }
  // Make sure every team has a row in the table (except destroyed teams)
  // For season 4 & 5, only include teams that are in opponents list (plus Southampton)
  const destroyed = S.destroyedTeams || [];
  if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
    // Only ensure table entries for valid teams (opponents + Southampton)
    const validTeams = [teamKeyClub(), ...S.opponents];
    // Also include teams that were taken over (their new names)
    if (S.season4 && S.season4.clubs_taken_over) {
      Object.values(S.season4.clubs_taken_over).forEach(newName => {
        if (!validTeams.includes(newName)) validTeams.push(newName);
      });
    }
    // Remove teams from table that aren't valid
    // NOTE: For Season 4 & 5, don't check destroyed array - teams might be re-included
    const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
    for (const teamName of Object.keys(S.table)) {
      // Check if this team was taken over (exists in clubs_taken_over with a new name)
      const isTakenOver = S.season4 && S.season4.clubs_taken_over && 
                         Object.keys(S.season4.clubs_taken_over).includes(teamName);
      if (isTakenOver) {
        // Remove old team name
        delete S.table[teamName];
        continue;
      }
      // Remove teams that aren't in valid teams list
      if (!validTeams.includes(teamName)) {
        delete S.table[teamName];
      }
    }
    // Ensure valid teams have table entries
    // NOTE: For Season 4 & 5, don't check destroyed array - create entries for all valid teams
    for (const t of validTeams) {
      ensureTableTeam(t);
    }
  } else {
    // For other seasons, use ALL_TEAMS
    for (const t of ALL_TEAMS) {
      if (!destroyed.includes(t)) {
        ensureTableTeam(t);
      }
    }
  }
}

// Return today’s opponent tuple and guard against out-of-range index
function currentOpponent(){
  ensureSeasonSchedule();
  const idx = Math.min(S.matches_played|0, S.opponents.length-1);
  return { team: S.opponents[idx], manager: S.opponentManagers[idx] };
}

// Optional: build a small “player pool” for today’s opponent once per matchday
function ensureOpponentForToday(){
  const idx = S.matches_played|0;
  if (!Array.isArray(S._opponentSquads)) S._opponentSquads = [];
  if (!S._opponentSquads[idx]){
    const { team } = currentOpponent();
    // If you have a TEAM_QUALITY map + makeOpponentSquad(team), call it here.
    // Otherwise, keep a simple placeholder for now.
    S._opponentSquads[idx] = []; // or: makeOpponentSquad(team)
  }
  S.opponent_today = S._opponentSquads[idx];
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
  const firstAuditMatch = S.season4.last_audit_match || -1;
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
    console.log('DEBUG DAUGHTER INTERACTION: Already shown this match, skipping');
    return;
  }
  S.season4.daughter_scene_this_match = true;
  
  // Determine which scene to show
  const firstAuditMatch = S.season4.last_audit_match || -1;
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

function hydrateMissingRiskAndMoraleFields(){
  if (!S) return;

  // risks
  if (S.fa_risk === undefined)        S.fa_risk = 0;
  if (S.pfa_risk === undefined)       S.pfa_risk = 0;
  if (S.legal_risk === undefined)     S.legal_risk = 0;
  if (S.compliance_risk === undefined)S.compliance_risk = 0;
  if (S.police_risk === undefined)    S.police_risk = 0;

  // morale & visit locks
  if (S.team_morale_boost === undefined)         S.team_morale_boost = 0;
  if (S.morale_opponent === undefined)           S.morale_opponent = 70;
  if (S.visited_ownLocker === undefined)         S.visited_ownLocker = false;
  if (S.visited_oppLocker === undefined)         S.visited_oppLocker = false;
  if (S.spoke_to_team_this_prematch === undefined) S.spoke_to_team_this_prematch = false;

  // inventory
  if (!S.inventory) S.inventory = { accolades: [], drugs: 0, items: [] };
  if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
  if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
  if (!Array.isArray(S.inventory.items)) S.inventory.items = [];

  // cocaine state tracking
  if (typeof S.coke_streak !== 'number') S.coke_streak = 0;
  if (!S.coke_state || !["sober", "buzzed", "wired", "crashing"].includes(S.coke_state)) S.coke_state = "sober";
  if (typeof S.coke_cooldown !== 'number') S.coke_cooldown = 0;

  // Quick-Sim Invective & Brick Throwing System
  if (typeof S.frustration !== 'number') S.frustration = 0;
  if (!Array.isArray(S.sessionShouts)) S.sessionShouts = [];
  if (typeof S.managerConfronted !== 'boolean') S.managerConfronted = false;
  if (!S.__impulse_used) S.__impulse_used = {};
  if (typeof S.coke_detection_risk !== 'number') S.coke_detection_risk = 0;
  if (!S.evidence) S.evidence = {};
  if (!S.addiction) S.addiction = {};
  
  // stadium dealing system state
  if (typeof S.stadium_dealing_unlocked !== 'boolean') S.stadium_dealing_unlocked = false;
  if (typeof S.stadium_dealing_approach_chance !== 'number') S.stadium_dealing_approach_chance = 15;
  if (typeof S.stadium_dealing_total_allows !== 'number') S.stadium_dealing_total_allows = 0;
  if (typeof S.stadium_dealing_consecutive_allows !== 'number') S.stadium_dealing_consecutive_allows = 0;
  if (typeof S.stadium_dealing_warning_shown !== 'boolean') S.stadium_dealing_warning_shown = false;
  if (typeof S.stadium_burned !== 'boolean') S.stadium_burned = false;
  if (typeof S.stadium_dealing_negotiated !== 'boolean') S.stadium_dealing_negotiated = false;
  if (typeof S.stadium_dealing_last_decision !== 'string') S.stadium_dealing_last_decision = '';
  if (typeof S.stadium_dealing_heat_level !== 'number') S.stadium_dealing_heat_level = 0;
  if (typeof S.press_interview_queued !== 'boolean') S.press_interview_queued = false;
  if (typeof S.fundraiser_completed !== 'boolean') S.fundraiser_completed = false;
  if (typeof S.no_more_fundraisers !== 'boolean') S.no_more_fundraisers = false;
  if (typeof S.locker_room_quote_system !== 'boolean') S.locker_room_quote_system = true;
  if (typeof S.movie_announced_match !== 'number') S.movie_announced_match = undefined;
  if (typeof S.movie_shown !== 'boolean') S.movie_shown = false;
  if (typeof S.cocaine_purchase_matches_ago !== 'number') S.cocaine_purchase_matches_ago = 999;
  if (typeof S.marco_approach_attempted !== 'boolean') S.marco_approach_attempted = false;

  // preMatch bucket (some saves might have null)
  if (!S.preMatch || typeof S.preMatch !== 'object') S.preMatch = null;
}



