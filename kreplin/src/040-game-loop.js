// ---------- game loop ----------
function setupGameButtons() {
  
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  
  if (saveBtn) {
    saveBtn.onclick = () => {
      if (!window.S) {
        log('❌ No game state to save.');
        return;
      }
      showSaveSlotModal(false);
    };
  } else {
    console.error('DEBUG: saveBtn not found!');
  }
  
  if (loadBtn) {
    loadBtn.onclick = () => {
      showSaveSlotModal(true);
    };
  } else {
    console.error('DEBUG: loadBtn not found!');
  }
  
  if (resetBtn) {
    resetBtn.onclick = async () => {
      // Show confirmation dialog
      const resetMsg = 'Are you sure you want to reset? This will delete all saved progress and return you to Season 1, Match 1.';
      if (!(window.KUI ? await KUI.confirm(resetMsg, { title: 'Start over?', ok: 'Reset', variant: 'sinister' }) : confirm(resetMsg))) {
        return; // User cancelled
      }
      
      // Set flag to prevent auto-load after reset
      localStorage.setItem('_reset_flag', 'true');
      localStorage.removeItem(SAVE_KEY);
      
      // Also delete the legacy IndexedDB autosave store (older builds), then reload
      try {
        const request = indexedDB.deleteDatabase('SaintsChairmanDB');
        request.onsuccess = () => location.reload();
        request.onerror = () => location.reload();
        request.onblocked = () => location.reload();
      } catch(e) {
        location.reload();
      }
    };
  } else {
    console.error('DEBUG: resetBtn not found! Cannot attach handler.');
  }
}

// Setup buttons when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupGameButtons);
} else {
  setupGameButtons();
}

// Emergency function to clear corrupted state - call from console: clearCorruptedState()
window.clearCorruptedState = function() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem('_reset_flag');
  location.reload();
};

// Public init(): creates/loads S, then emits 'init'.
function init(){
  const result = initGameState.apply(this, arguments);
  GameHooks.emit('init');
  return result;
}

function initGameState(){
  // Check if reset was requested - if so, skip loading and start fresh
  const resetFlag = localStorage.getItem('_reset_flag');
  let saved = null;
  if (resetFlag === 'true') {
    localStorage.removeItem('_reset_flag');
    S = defaultState();
  } else {
    saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        // Parse + normalize the loaded state (migrates older saves)
        S = parseSavedGame(saved);
        // Update window.S to match
        window.S = S;
      } catch (e) {
        console.error('❌ Corrupted save data detected. Clearing and starting fresh.', e);
        localStorage.removeItem(SAVE_KEY);
        S = defaultState();
        window.S = S;
        saved = null; // Mark as new game after corruption
      }
    } else {
      S = defaultState();
      window.S = S;
    }
  }
  
  // Seed trophies for new games only
  if (!saved && !S.seededTrophies) {
    S.seededTrophies = true;
    addItem({ name: "1976 FA Cup Winner's Trophy", type: "trophy", quantity: 1, baseValue: 1500000, sellable: true });
    addItem({ name: "Johnston's Paint Trophy", type: "trophy", quantity: 1, baseValue: 200000, sellable: true });
    addItem({ name: "2003 FA Cup Runners-Up Trophy", type: "trophy", quantity: 1, baseValue: 50000, sellable: true });
    // Trophy message moved to main intro flow to avoid duplication
  }
// --- normalize arrays/objects after S is created ---
S.bet_history = Array.isArray(S.bet_history) ? S.bet_history : [];
// --- save migration shim: older saves may be missing opponentManagers
if (Array.isArray(S.opponents) && (!Array.isArray(S.opponentManagers) || S.opponentManagers.length !== S.opponents.length)) {
  S.opponentManagers = S.opponents.map(team => {
    return (typeof TEAM_MANAGERS !== 'undefined' && TEAM_MANAGERS && TEAM_MANAGERS[team]) ? TEAM_MANAGERS[team] : randomManagerName();
  });
}
// Club name: keep whatever the save has (renames persist); default only if missing.
// getClubName() is the single source for display.
if (typeof S.club_name !== 'string' || !S.club_name) {
  S.club_name = "Southampton FC";
} else if (S.club_sold_to === "mcdonalds" && S.club_name === "Southampton FC") {
  // Fix legacy saves where club_name wasn't updated after McDonalds sale
  S.club_name = "McDonalds FC";
} else if (S.club_sold_to === "portsmouth" && S.club_name === "Southampton FC") {
  // Fix legacy saves where club_name wasn't updated after Portsmouth sale
  S.club_name = "Portsmouth FC 2";
}
// We consistently use an object for inventory: {accolades:[], drugs:0}
if (!S.inventory || Array.isArray(S.inventory)) {
  S.inventory = { accolades: [], drugs: 0 };
} else {
  S.inventory.accolades = Array.isArray(S.inventory.accolades) ? S.inventory.accolades : [];
  S.inventory.drugs = Number.isFinite(S.inventory.drugs) ? S.inventory.drugs : 0}

if (typeof S.fan_morale !== 'number') S.fan_morale = 50;

// Initialize Five-Season Arc tracking
if (!S.season) S.season = 1;
if (!S.fiveSeasonArc) {
  S.fiveSeasonArc = {
    plTitles: [],
    clEntries: [],
    clWins: [],
    worldCupInvited: [],
    worldCupResults: []
  };
}

// Initialize competition context
if (typeof S.competition !== 'string') S.competition = 'league';
if (document.body && document.body.dataset) {
  document.body.dataset.competition = S.competition;
}

// Initialize Champions League state
if (typeof S.qual_CL !== 'boolean') S.qual_CL = false;
if (typeof S.clChampion !== 'boolean') S.clChampion = false;
if (typeof S.clActive !== 'boolean') S.clActive = false;
if (typeof S.clStage !== 'string') S.clStage = 'group';
if (!S.clGroupMatches) S.clGroupMatches = [];
if (!S.clGroupStandings) S.clGroupStandings = {};
if (!S.clKnockoutBracket) S.clKnockoutBracket = {};
if (!S.clScheduledMatches) S.clScheduledMatches = [];
if (typeof S.clNextMatchIndex !== 'number') S.clNextMatchIndex = 0;

// Initialize World Cup state
if (typeof S.worldCupActive !== 'boolean') S.worldCupActive = false;
if (typeof S.worldCupCompletedForSeason !== 'boolean') S.worldCupCompletedForSeason = false;
if (!S.worldCupGroupMatches) S.worldCupGroupMatches = [];
if (!S.worldCupGroupStandings) S.worldCupGroupStandings = {};
if (!S.worldCupBracket) S.worldCupBracket = {};

wireChrome();         // set up buttons/handlers (safe; they run later on click)
  render();             // safe baseline render; must not assume S.* properties missing
  
  // Initialize top scorers system
  ensureTopScorersInit();
  
  // Note: Rival intro message is now sent in pre-match phase instead of game start
}

// --- End of a match day (runs once per match, after postMatchPhase) ---
// postMatchPhase() owns the result + matches_played; this resets the per-match
// fields and then runs the systems that tick once per match ('matchday:end').
function finalizeMatchDay(){
  // Decrement KRAZY register games remaining
  if (S.onKrazyRegister && S.krazyGamesRemaining > 0) {
    S.krazyGamesRemaining--;
    if (S.krazyGamesRemaining <= 0) {
      S.onKrazyRegister = false;
      log(`🎉 You are no longer on THE SEX OFFENDERS REGISTER.`);
      log(`Your reputation begins to recover and seduction system is unlocked.`);
      // Small morale bump
      S.morale = Math.min(100, (S.morale || 50) + 5);
    }
  }

  // clear pre-match, per-match flags
  S.preMatch = null;
  S.visitors_handled = false;
  S.visited_ownLocker = false;
  S.visited_oppLocker = false;
  S.spoke_to_team_this_prematch = false;
  S._walkout_forfeit = false;

  // reset morale snapshots for next fixture
  S.team_morale_boost = 0;
  S.morale_opponent   = 70;
  S.referee_soft_bias = 0; // a policy favour lasts one match

  // once-per-match systems (blackmail kickbacks, cocaine crash, drug-day resets);
  // they may set next match's morale, so they run after the reset above
  GameHooks.emit('matchday:end');

  // refresh UI
  if (typeof updateHUD === 'function') updateHUD();
}
GameHooks.on('postmatch:end', finalizeMatchDay);

// --- Test/debug entry point -------------------------------------------------
// Only exists with ?debug in the URL or window.__KREPLIN_TEST__ set before load
// (tools/autoplay.js sets it). jump() is applied when the main loop starts, after
// the campaign setup (name/sponsor/manager) so nothing overwrites it.
//   __kreplinDebug.jump({ season: 3, match: 5, opener: true, flags: {'season3.x': true}, setup: "js" })
//   __kreplinDebug.ledger()  -> points/table reconciliation report
(function(){
  try {
    const on = (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search || '')) || window.__KREPLIN_TEST__;
    if (!on) return;
    window.__kreplinDebug = {
      jump(opts){ window.__kreplinPendingJump = Object.assign({}, opts || {}); return true; },
      ledger(){ return kreplinLedgerCheck(); }
    };
  } catch (_) {}
})();

// Points/table reconciliation (used by the debug harness).
function kreplinLedgerCheck(){
  const club = getClubName();
  const row = (S.table && S.table[club]) || null;
  const W = S.wins|0, D = S.draws|0, L = S.losses|0;
  const adj = S.points_adjust|0;
  const out = { club, points: S.points, tablePTS: row ? row.PTS : null, W, D, L, adj,
    played: S.matches_played|0, tableP: row ? row.P : null, problems: [] };
  if (row) {
    if (row.PTS !== S.points) out.problems.push(`S.points ${S.points} != table PTS ${row.PTS}`);
    if (row.PTS !== 3*row.W + row.D + adj) out.problems.push(`table PTS ${row.PTS} != 3W+D+adj ${3*row.W + row.D + adj}`);
    if (row.W !== W || row.D !== D || row.L !== L) out.problems.push(`W/D/L ${W}/${D}/${L} != table ${row.W}/${row.D}/${row.L}`);
  }
  if ((S.matches_played|0) !== W + D + L) out.problems.push(`matches_played ${S.matches_played} != W+D+L ${W+D+L}`);
  return out;
}

// --- One week in rehab: the fixture is played without you, through the normal
// result path (postMatchPhase), and the sentence counts down once. ---
async function playRehabWeek(){
  if (!S.playerStats) S.playerStats = {};
  S.playerStats.matchesSpentInRehabilitation = (S.playerStats.matchesSpentInRehabilitation || 0) + 1;
  setPhase('rehab');
  logSafe("REHAB: You are in treatment. The team plays without you...");

  // Staff pick the side and the club pays the week's wages (no chairman decisions)
  try { ensureValidLineup(); } catch (_) {}
  const opp = (typeof currentOpponent === 'function') ? currentOpponent() : { team: 'Opposition' };
  S.matchContext = Object.assign({}, opp, { roundIndex: S.matches_played|0 });
  S.messi_goalie_next_loss = false; // the fiasco needs you in the dugout
  let res;
  try {
    S.preMatch = null;
    computePreMatchStrengthsAndOdds();
    res = computeQuickSimResult();
  } catch (e) {
    console.error('rehab match sim failed', e);
    res = { usGoals: 0, themGoals: 1, events: [] };
  }
  S.matchEvents = Array.isArray(res.events) ? res.events : [];
  const outcome = { our_goals: res.usGoals|0, their_goals: res.themGoals|0, simulated: true, rehab: true };
  window.lastMatchOutcome = Object.assign({ usGoals: outcome.our_goals, themGoals: outcome.their_goals }, outcome);

  const due = (typeof weeklySquadWages === 'function' ? weeklySquadWages() : 0) + (S.manager?.wage|0);
  if ((S.club_cash|0) >= due) {
    S.club_cash = (S.club_cash|0) - due;
    if (due > 0) logSafe(`Wages paid by the club in your absence: ${money(due)}.`);
  } else if (due > 0) {
    S.player_wage_arrears = (S.player_wage_arrears|0) + due;
    S.club_debt = (S.club_debt|0) + due;
    logSafe(`The club can't cover wages in your absence. Arrears +${money(due)}.`);
  }

  await postMatchPhase(outcome);

  // Decrement rehab sentence (the only place it counts down)
  S.suspensions.rehab_games = Math.max(0, (S.suspensions.rehab_games|0) - 1);
  logSafe(`REHAB MATCH RESULT: ${outcome.our_goals}-${outcome.their_goals}`);
  if ((S.suspensions.rehab_games|0) > 0) {
    logSafe(`REHAB: ${S.suspensions.rehab_games} more match(es) remaining in treatment.`);
  } else {
    logSafe("REHAB: You are discharged! Full game functionality restored.");
    // Reduce drug-related risks after completing rehab
    S.coke_detection_risk = Math.max(0, (S.coke_detection_risk|0) - 5);
    S.police_risk = Math.max(0, (S.police_risk|0) - 3);
    logSafe("Your time in rehab has reduced your drug-related legal exposure.");
  }
  saveGame();
  updateHUD();
  await waitAdvance("Continue", "Continue treatment...");
}

/* === Patch 3B: Manager’s Pre-Match Actions & Decisions ======================
   Safe, modular add-on (no core edits). Assumes these exist globally:
   - S (game state), log(msg), choose(options, prompt), openKnockDoor(),
     currentOpponent(), recordTableResult(opponent, us, goalsOpp, goalsUs)
============================================================================= */

// ---------- State bootstrap & helpers ---------------------------------------
function ensureManagerState(){
  if (!window.S) return;
  if (!S.manager) S.manager = null;
  if (!S.manager_events) S.manager_events = { warned_this_match:false, crisis_this_match:false, fired_this_match:false };
}
function managerPresent(){ return !!(S && S.manager && S.manager.name); }

function _moraleApprox(){
  const base = 50;
  const boost = Number(S?.team_morale_boost || 0);
  const pfa   = Number(S?.pfa_risk || 0);
  return Math.max(0, Math.min(100, base + boost - Math.floor(pfa*2)));
}

// Enhanced manager dialogue system with context and personality
function _generateContextualManagerDialogue(level, manager) {
  const ctx = _composeContextLines();
  const personality = _getManagerPersonality(manager);
  
  // Context-dependent dialogue based on player actions
  const contextDialogue = _getContextDialogue();
  
  // Personality-based dialogue mixing
  const personalityDialogue = _getPersonalityDialogue(personality, level);
  
  // Combine context and personality for dynamic responses
  return _mixDialogue(contextDialogue, personalityDialogue, manager.agreeableness);
}

function _getManagerPersonality(manager) {
  const agreeableness = manager.agreeableness || 50;
  const skill = manager.skill || 50;
  
  // Determine personality traits based on stats
  const traits = {
    diplomatic: agreeableness > 70,
    confrontational: agreeableness < 30,
    professional: skill > 70,
    casual: skill < 50,
    moral: agreeableness > 60 && skill > 60,
    pragmatic: agreeableness < 50 && skill > 50
  };
  
  return traits;
}

function _getContextDialogue() {
  const context = [];
  
  // Bribery context
  if ((S.bribes_count || 0) >= 2) {
    context.push({
      type: 'bribery',
      diplomatic: "I've heard some concerning rumors about... financial arrangements.",
      confrontational: "The players are asking questions about all these 'business meetings' you're having.",
      professional: "There are whispers about improper conduct. We need to address this professionally.",
      casual: "Mate, the lads are talking about you taking money from other clubs.",
      moral: "I can't ignore what I'm hearing about bribery. This goes against everything I believe in.",
      pragmatic: "Look, I know how this business works, but you're being too obvious about it."
    });
  }
  
  // Affairs context
  if (S._std_infections || S._affairs_count || S._nightclub_visits || S._sexual_encounters) {
    context.push({
      type: 'affairs',
      diplomatic: "Your personal life is becoming a distraction for the team.",
      confrontational: "The players are laughing about your... extracurricular activities.",
      professional: "Your personal conduct is affecting team morale. We need to discuss this.",
      casual: "The lads are taking bets on how many STDs you'll catch this season.",
      moral: "Your behavior is setting a terrible example for the players.",
      pragmatic: "I don't care what you do, but keep it away from the dressing room."
    });
  }
  
  // Betting context
  if (S.active_bet || (S.bet_history && S.bet_history.length > 0)) {
    context.push({
      type: 'betting',
      diplomatic: "I've noticed you've been placing some rather large bets on our matches.",
      confrontational: "The players know you're betting against us. How do you think that makes them feel?",
      professional: "Your gambling activities are creating conflicts of interest.",
      casual: "Mate, betting on your own team is mental. The lads know about it.",
      moral: "Gambling on matches undermines the integrity of the sport.",
      pragmatic: "If you're going to bet, at least don't let the players find out."
    });
  }
  
  // Opposition team talks context
  if (S._opposition_team_talks || S._psychological_warfare_count) {
    context.push({
      type: 'opposition_talks',
      diplomatic: "I understand you've been... visiting the opposition dressing room.",
      confrontational: "The other managers are complaining about you breaking into their locker rooms!",
      professional: "Your unauthorized access to opposition facilities is unprofessional.",
      casual: "Mate, you can't just walk into other teams' dressing rooms and start giving speeches.",
      moral: "Sneaking into opposition areas is dishonest and unsportsmanlike.",
      pragmatic: "If you're going to mess with other teams, don't get caught doing it."
    });
  }
  
  return context;
}

function _getPersonalityDialogue(personality, level) {
  const baseDialogue = {
    1: { // Soft warning
      diplomatic: "I wanted a quick word about the mood. We're okay, but we could be sharper.",
      confrontational: "A few players are a little unsettled. Nothing we can't fix.",
      professional: "The team's performance metrics suggest we need to address some concerns.",
      casual: "The lads are a bit off today. Nothing major, just need to get them focused.",
      moral: "I'm concerned about the direction we're heading. We need to maintain our values.",
      pragmatic: "We're not at our best right now. Let's focus on what works."
    },
    2: { // Stern warning
      diplomatic: "Morale is wobbling. We need focus and fewer distractions.",
      confrontational: "We're not in a good place. If this continues, the dressing room may turn.",
      professional: "The current situation is unsustainable. We need immediate action.",
      casual: "The lads are getting restless. We need to sort this out before it gets worse.",
      moral: "This behavior is unacceptable. We need to restore proper standards.",
      pragmatic: "We're heading for trouble. Time to make some changes."
    },
    3: { // Crisis
      diplomatic: "We're on the brink. The players are talking about refusing to play.",
      confrontational: "This can't go on. We need a reset today or we lose the room.",
      professional: "The situation has reached a critical point. Immediate intervention is required.",
      casual: "The lads are ready to walk. We need to fix this now or we're screwed.",
      moral: "This is a crisis of leadership. We need to restore trust immediately.",
      pragmatic: "We're at breaking point. Time for drastic measures."
    }
  };
  
  return baseDialogue[level] || baseDialogue[1];
}

function _mixDialogue(contextDialogue, personalityDialogue, agreeableness) {
  const result = [];
  
  // Always include one personality-based line
  const personalityTraits = Object.keys(personalityDialogue);
  const randomTrait = personalityTraits[Math.floor(Math.random() * personalityTraits.length)];
  result.push(personalityDialogue[randomTrait]);
  
  // Add context-specific dialogue if available
  if (contextDialogue.length > 0) {
    const randomContext = contextDialogue[Math.floor(Math.random() * contextDialogue.length)];
    const contextTraits = Object.keys(randomContext).filter(key => key !== 'type');
    const randomContextTrait = contextTraits[Math.floor(Math.random() * contextTraits.length)];
    result.push(randomContext[randomContextTrait]);
  }
  
  // Sometimes add a second personality line for variety
  if (Math.random() < 0.3) {
    const secondTrait = personalityTraits[Math.floor(Math.random() * personalityTraits.length)];
    if (secondTrait !== randomTrait) {
      result.push(personalityDialogue[secondTrait]);
    }
  }
  
  return result;
}
function _logMgr(line){ log(`Manager: ${line}`); }


// ===== One-time boot & welcome guard =====
(function(){
  // Prevent double init / double UI insertions
  if (!window.__CHAIRMAN_BOOT_GUARD__) {
    window.__CHAIRMAN_BOOT_GUARD__ = { inited:false };
  }
  // Wrap your init if you can; otherwise gate the welcome/log calls on this flag.
  window.markBootOnce = function(){
    if (window.__CHAIRMAN_BOOT_GUARD__.inited) return false;
    window.__CHAIRMAN_BOOT_GUARD__.inited = true;
    return true;
  };

  // Gate the opening message so it logs only once per save
  window.ensureWelcomeOnce = function(){
    if (!S) return;
    if (S._welcomed_once) return;
    S._welcomed_once = true;
    // Welcome message moved to main game flow to avoid duplication
  };
})();


// ---------- Hiring UI --------------------------------------------------------
function _randomQuirk(){
  const q = ["media-friendly","superstitious","data-driven","old-school","players' coach","hardliner","tinkerer","motivator","disciplinarian","none","tactical genius","man-manager","youth developer","crisis specialist","cup specialist","promotion expert","relegation fighter","big game manager","transfer market expert","fitness fanatic"];
  return q[Math.floor(Math.random()*q.length)];
}

function _getManagerDescription(skill, agreeableness, quirk) {
  const descriptions = [];
  
  // Skill-based descriptions
  if (skill >= 80) descriptions.push("tactical mastermind");
  else if (skill >= 70) descriptions.push("experienced tactician");
  else if (skill >= 60) descriptions.push("solid professional");
  else if (skill >= 50) descriptions.push("competent manager");
  else descriptions.push("unproven coach");
  
  // Agreeableness-based descriptions
  if (agreeableness >= 80) descriptions.push("players love him");
  else if (agreeableness >= 60) descriptions.push("well-liked");
  else if (agreeableness >= 40) descriptions.push("no-nonsense");
  else if (agreeableness >= 20) descriptions.push("demanding");
  else descriptions.push("ruthless disciplinarian");
  
  // Quirk-based descriptions
  if (quirk === "media-friendly") descriptions.push("charismatic with press");
  else if (quirk === "superstitious") descriptions.push("has lucky rituals");
  else if (quirk === "data-driven") descriptions.push("analytics obsessed");
  else if (quirk === "old-school") descriptions.push("traditional methods");
  else if (quirk === "players' coach") descriptions.push("father figure");
  else if (quirk === "hardliner") descriptions.push("strict disciplinarian");
  else if (quirk === "tinkerer") descriptions.push("tactical experimenter");
  else if (quirk === "motivator") descriptions.push("inspirational leader");
  else if (quirk === "disciplinarian") descriptions.push("rule enforcer");
  else if (quirk === "tactical genius") descriptions.push("footballing brain");
  else if (quirk === "man-manager") descriptions.push("excellent with players");
  else if (quirk === "youth developer") descriptions.push("nurtures young talent");
  else if (quirk === "crisis specialist") descriptions.push("thrives under pressure");
  else if (quirk === "cup specialist") descriptions.push("knockout expert");
  else if (quirk === "promotion expert") descriptions.push("gets teams promoted");
  else if (quirk === "relegation fighter") descriptions.push("survival specialist");
  else if (quirk === "big game manager") descriptions.push("rises to occasion");
  else if (quirk === "transfer market expert") descriptions.push("signing specialist");
  else if (quirk === "fitness fanatic") descriptions.push("physical preparation guru");
  
  return descriptions.join(", ");
}

function _candidate(){
  // Fallback name pools in case your build doesn't expose MALE_NAMES/SURNAMES
  const first = (typeof MALE_NAMES!=="undefined" && MALE_NAMES.length) ? MALE_NAMES : ["Alan","Mark","John","Graham","Nigel","Dean","Gary","Paul"];
  const last  = (typeof SURNAMES!=="undefined" && SURNAMES.length)   ? SURNAMES   : ["Smith","Brown","Jones","Taylor","Williams","Johnson","Miller"];
  const name  = `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
  const skill = Math.floor(Math.random()*51)+40;        // 40..90
  const agreeableness = Math.floor(Math.random()*101);  // 0..100
  const quirk = _randomQuirk();
  
  return {
    id: Math.random().toString(36).slice(2),
    name,
    skill,
    agreeableness,
    quirk,
    description: _getManagerDescription(skill, agreeableness, quirk),
    wage: managerWeeklyWageForSkill(skill)
  };
}

function managerWeeklyWageForSkill(skill){
  // New linear: £10k at 50 → £50k at 90  (increased wages)
  const baseAt50 = 10000;
  const perPointAbove50 = 1000; // each skill point over 50 adds £1000/wk
  const w = baseAt50 + Math.max(0, skill - 50) * perPointAbove50;
  return Math.round(w);
}


async function _hireManagerFlow(title="Hire a Manager"){
  // Generate more candidates for better variety
  const cands = [_candidate(), _candidate(), _candidate(), _candidate(), _candidate(), _candidate()];
  const opts = cands.map(c => ({
    key:c.id,
    label: `${c.name} • Skill ${c.skill} • Agreeableness ${c.agreeableness} • £${c.wage.toLocaleString('en-GB')}/week • ${c.description}`
  }));
  opts.push({ key:"cancel", label:"Cancel" });

  const k = await choose(opts, title);
  if (k === "cancel") return false;

  const pick = cands.find(c => c.id === k);
  if (!pick) return false;

  // Peg weekly wage to skill and persist onto S.manager
  const wage = pick.wage;
  S.manager = {
    id: pick.id,
    name: pick.name,
    skill: pick.skill,
    agreeableness: pick.agreeableness,
    quirk: pick.quirk,
    wage
  };
  S.manager_events = { warned_this_match:false, crisis_this_match:false, fired_this_match:false };

  log(`Hired ${pick.name} (Skill ${pick.skill}) for £${wage.toLocaleString('en-GB')}/week.`);
  if (typeof updateHUD === 'function') updateHUD();
  if (typeof updateHeaderLine === 'function') updateHeaderLine();
  return true;
}
async function ensureManagerHiredIfMissing(){
  ensureManagerState();
  if (!managerPresent()){
    _logMgr("We are currently without a manager.");
    const hired = await _hireManagerFlow("Hire a Manager (position vacant)");
    if (!hired){
      _logMgr("No appointment made. A caretaker will muddle through for now.");
      return false;
    }
  }
  return true;
}
async function fireManager(reason=""){
  if (!managerPresent()) return;
  const name = S.manager.name;
  S.manager = null;
  S.manager_events = { warned_this_match:false, crisis_this_match:false, fired_this_match:true };
  S.manager_fires = (S.manager_fires|0) + 1;
  S.fired_last_game = true;
  log(`You fire <strong>${name}</strong>. ${reason ? '('+reason+')' : ''}`);
}

// ---------- Team Walkout (extreme morale fail state) -------------------------
async function maybeTeamWalkout(triggerCause=""){
  const morale = _moraleApprox();
  if (morale >= 10) return false;

  log(`⚠️ The squad refuses to take the pitch. ${triggerCause ? triggerCause : "They cite unbearable conditions and loss of trust."}`);
  // Forfeit: this fixture is recorded as a 3–0 defeat by the normal result path
  // (the main loop skips kickoff when S._walkout_forfeit is set).
  S._walkout_forfeit = true;

  // Fallout
  S.reputation = Math.max(0, (S.reputation||50) - 8);
  S.pfa_risk   = Math.max(0, (S.pfa_risk||0) + 3);
  _logMgr("“This is untenable. We’ll need to rebuild trust from the ground up.”");
  await fireManager("Walkout aftermath");
  return true;
}

// ---------- Context lines for briefings --------------------------------------
function _composeContextLines(){
  const bits = [];
  if ((S.bribes_count||0) >= 3 && !S._squad_bribe_warning_shown) {
    bits.push("The squad thinks you're placing too many bribes — it's making them uneasy.");
    S._squad_bribe_warning_shown = true; // Prevent repeating this message
  }
  if ((S.unpaid_transfers?.length||0) > 0) bits.push("Some agents are sniffing around about unpaid transfers; it’s spooking the dressing room.");
  if ((S.debt_personal||0) > 20000) bits.push("Players whisper about your personal debts. It’s affecting confidence.");
  if ((S.reputation||50) >= 65) bits.push("On the bright side, the fans are impressed — results have turned heads.");
  return bits;
}

// ---------- Manager briefing + complaints/choices ----------------------------
async function managerBriefingIfNeeded(){
  ensureManagerState();

  // If no manager, try to hire (soft fail if user cancels)
  if (!managerPresent()){
    await ensureManagerHiredIfMissing();
    if (!managerPresent()) return;
  }

  const m = S.manager;
  const morale = _moraleApprox();

  // thresholds: >60 none; 40–60 soft; 20–39 stern; <20 ultimatum
  let level = 0;
  if (morale <= 60) level = 1;
  if (morale <= 39) level = 2;
  if (morale <= 19) level = 3;
  if (level === 0) return;

  const ctx = _composeContextLines();
  const SOFT = [
    "I wanted a quick word about the mood. We’re okay, but we could be sharper.",
    "A few players are a little unsettled. Nothing we can’t fix."
  ];
  const STERN = [
    "Morale is wobbling. We need focus and fewer distractions.",
    "We’re not in a good place. If this continues, the dressing room may turn."
  ];
  const ULT  = [
    "We’re on the brink. The players are talking about refusing to play.",
    "This can’t go on. We need a reset today or we lose the room."
  ];

  // Use enhanced contextual dialogue system
  const dialogueLines = _generateContextualManagerDialogue(level, m);
  
  // Display the generated dialogue
  dialogueLines.forEach(line => _logMgr(`"${line}"`));
  
  // Add context lines from the original system
  const maxContextLines = level === 1 ? 1 : level === 2 ? 2 : 3;
  ctx.slice(0, maxContextLines).forEach(t => _logMgr(`"${t}"`));
  
  // Set appropriate flags and handle decisions
  if (level === 1) {
    S.manager_events.warned_this_match = true;
    return;
  }

  if (level === 2) {
    S.manager_events.crisis_this_match = true;
    await managerComplaintDecision(false);
    return;
  }

  // level === 3 (ultimatum)
  S.manager_events.crisis_this_match = true;
  await managerComplaintDecision(true);
}


// Non-blocking one-time draft; returns a Promise but you don't have to await it
function runInitialDraftIfNeeded(){
  try{
    if ((S.matches_played|0) > 0) return;              // only before first match
    if (Array.isArray(S.squad) && S.squad.length >= 5) return;

    // Generate a pool of mostly poor players to maintain difficulty
    const pool = [];
    for (let i=0;i<12;i++) {
      const p = makePlayer();
      // Force most players to be mediocre or shit to maintain difficulty
      if (Math.random() < 0.7) { // 70% chance of poor players
        p.tier = Math.random() < 0.5 ? "mediocre" : "shit";
        p.rating = p.tier === "mediocre" ? 65 : 55;
        p.price = p.tier === "mediocre" ? roll(5000,12000) : roll(1000,4000);
        p.wage = p.tier === "mediocre" ? roll(60,140) : roll(20,50);
      }
      pool.push(p);
    }

    (async function pickFive(){
      try {
        S.squad = [];
        for (let n=1;n<=5;n++){
          const opts = pool
            .filter(p=>!p._taken)
            .map(p=>{
              const price = (p.price||0).toLocaleString('en-GB');
              const wage  = (p.wage||0).toLocaleString('en-GB');
              const label = `${p.name} • ${p.class||p.tier||'player'} • £${price} • £${wage}/wk`;
              return { key: p.id || p.name, label };
            });
          
          try {
            const key = await choose(opts, `Select player ${n}/5`);
            const pick = pool.find(p => (p.id||p.name) === key);
            if (!pick){ 
              log("Draft aborted."); 
              return; 
            }
            pick._taken = true;
            S.squad.push(pick);
          } catch (choiceError) {
            // Handle user aborted request or other choice errors
            if (choiceError && choiceError.message && choiceError.message.includes('aborted')) {
              log("Draft cancelled by user.");
              return;
            }
            throw choiceError; // Re-throw if it's not an abort error
          }
        }
        log("Initial five selected.");
        if (typeof updateHUD === 'function') updateHUD();
      } catch (draftError) {
        console.error('Draft error:', draftError);
        log("Draft error: " + (draftError?.message || draftError));
        // Ensure we have at least some players even if draft fails
        // BUT NOT if you're on the sex offenders register
        if (S.squad.length === 0 && (!S.krazyGamesRemaining || S.krazyGamesRemaining <= 0)) {
          log("Using fallback players due to draft error.");
          // Add some basic players as fallback
          for (let i = 0; i < 5; i++) {
            const fallbackPlayer = makePlayer();
            fallbackPlayer.tier = "shit";
            fallbackPlayer.rating = 55;
            fallbackPlayer.price = roll(1000, 4000);
            fallbackPlayer.wage = roll(20, 50);
            S.squad.push(fallbackPlayer);
          }
        } else if (S.squad.length === 0 && S.krazyGamesRemaining && S.krazyGamesRemaining > 0) {
          log("🚨 No fallback players created while on THE SEX OFFENDERS REGISTER.");
        }
      }
    })();
  }catch(e){
    console.error(e);
    log("Draft error: " + (e?.message||e));
  }
}


async function managerComplaintDecision(ultimatum=false){
  const opts = [
    { key:"apol",  label:"Apologize and promise change (small morale boost)" },
    { key:"bribe", label:"Slip the manager an envelope (risky)" },
    { key:"assault", label:"Assault the manager (guaranteed arrest)", variant:"bad" },
    { key:"fire",  label:"Fire the manager (confirm)" },
    { key:"ignore",label:"Ignore (do nothing)" }
  ];
  const k = await choose(opts, "Manager complains about unrest. How do you respond?");
  const m = S.manager;

  if (k === "apol"){
    S.team_morale_boost = (S.team_morale_boost||0) + 5;
    S.pfa_risk = Math.max(0, (S.pfa_risk||0) - 1);
    _logMgr("“Appreciated. I’ll tell the lads you heard them.”");
    return;
  }

  if (k === "bribe"){
    // acceptance chance: more agreeable -> more likely; higher skill -> less likely
    const chance = Math.max(5, Math.min(90, Math.round(m.agreeableness*0.7 - m.skill*0.2 + 25)));
    const roll = Math.floor(Math.random()*100);
    if (roll < chance){
      _logMgr("He pockets the envelope with a sigh. \"Let's just get through today.\"");
      S.team_morale_boost = (S.team_morale_boost||0) + 2;
      S.compliance_risk = (S.compliance_risk||0) + 1;
    } else {
      _logMgr("He pushes it back across the desk. \"Not like this.\"");
      S.pfa_risk = (S.pfa_risk||0) + 1;

      // Generate retaliation story from manager
      initPressSystem();
      const retaliationStory = generateGossipStory('retaliation', m.name);
      queueStory(retaliationStory);
    }
    return;
  }

  if (k === "assault"){
    log("You lose control and physically attack your manager!");
    log("Security immediately restrains you as your manager collapses to the ground.");
    log("The police are called immediately - you are arrested on the spot.");
    
    // Apply immediate consequences
    const fineChair = 30000 + Math.floor(Math.random() * 30000); // £30k-£60k
    const fineClub = Math.round(fineChair * 1.2); // £36k-£72k
    
    S.chairman_cash = Math.max(0, (S.chairman_cash|0) - fineChair);
    S.club_cash = Math.max(0, (S.club_cash|0) - fineClub);
    S.police_risk = Math.min(100, (S.police_risk|0) + 15);
      S.legal_risk = Math.min(100, (S.legal_risk|0) + 3);
      S.compliance_risk = Math.min(100, (S.compliance_risk|0) + 4);
    S.reputation = Math.max(0, (S.reputation|0) - 10);
    
    log(`CONSEQUENCES: Personal fine £${fineChair.toLocaleString()}, Club fine £${fineClub.toLocaleString()}`);
    log("Your reputation plummets and the FA launches an immediate investigation.");
    
    // Check if there's already a pending police investigation (e.g., from referee assault)
    if (S._pending_police_investigation) {
      // Add manager assault to existing investigation
      S._pending_police_investigation.caseType += ' and assault on manager';
      S._pending_police_investigation.description = 'Multiple assaults - referee and manager';
    } else {
      // Create new investigation for manager assault
      S._pending_police_investigation = { 
        authority: 'police', 
        caseType: 'assault on manager',
        description: 'Assault on team manager'
      };
    }
    
    // Fire the manager after assault
    await fireManager("Terminated after physical assault");
    
    // Season 4 & 5: Trigger lashing for assault
    if ((S.season === 4 || S.season === 5) && typeof administerLashing === 'function') {
      await waitAdvance("Arrest", "The sharia police arrive...");
      await administerLashing('Assault on manager', rnd(8, 15));
    }
    
    updateHUD?.();
    return;
  }

  if (k === "fire"){
    const k2 = await choose([{key:"y",label:"Yes, terminate immediately"}, {key:"n",label:"No, keep for now"}], "Are you sure?");
    if (k2 === "y"){
      await fireManager("Terminated after complaint meeting");
      
      // Generate retaliation story from fired manager
      initPressSystem();
      const retaliationStory = generateGossipStory('retaliation', m.name);
      queueStory(retaliationStory);
      return;
    }
  }

  if (k === "ignore"){
    log("You wave him off.");
    if (ultimatum){
      const walked = await maybeTeamWalkout("The room explodes — the players boycott kickoff.");
      if (!walked){
        S.team_morale_boost = (S.team_morale_boost||0) - 5;
        S.pfa_risk = (S.pfa_risk||0) + 2;
      }
    } else {
      S.team_morale_boost = (S.team_morale_boost||0) - 2;
    }

    // Generate retaliation story from ignored manager
    initPressSystem();
    const retaliationStory = generateGossipStory('retaliation', m.name);
    queueStory(retaliationStory);
  }
}

/* Patch 3B — disable legacy manager picker at game start */
(function killLegacyManagerPicker(){
  try{
    // If an older build shows the 3-name picker, neutralize it
    if (typeof window.chooseManager === "function"){
      window.__legacyChooseManager = window.chooseManager; // keep for reference
      window.chooseManager = async function(){ return null; }; // no-op
    }
    if (typeof window.startGameWithManagerPicker === "function"){
      window.startGameWithManagerPicker = async function(){ /* no-op */ };
    }
  }catch(e){ console.warn("Kill-legacy-manager-picker patch failed:", e); }
})();

// ---------- Hook: run briefing before your normal pre-match visitors ---------
(function applyPreMatchManagerHook(){
  try{
    if (window._openKnockDoorWrapped) return;  // idempotent
    window._openKnockDoorWrapped = true;

    const orig = (typeof openKnockDoor === "function") ? openKnockDoor : null;
    if (!orig) return;

    window.openKnockDoor = async function(){
      try{
        ensureManagerState();
        await ensureManagerHiredIfMissing();
        await managerBriefingIfNeeded();
      }catch(e){ console.warn("Manager pre-match hook error:", e); }
      return await orig.apply(this, arguments);
    };

    // Debug helpers in console:
    window._debug_hire_manager = async ()=>{ await _hireManagerFlow("Debug: Hire Manager"); };
    window._debug_fire_manager = async ()=>{ await fireManager("Debug fired"); };
    window._debug_manager_briefing = async ()=>{ await ensureManagerHiredIfMissing(); await managerBriefingIfNeeded(); };

  }catch(e){
    console.warn("Patch 3B hook failed:", e);
  }
})();

async function game(){
 try {
  
  // Hide start screen if still visible and mark as loaded
  const startScreen = document.getElementById('startScreen');
  if (startScreen) {
    startScreen.classList.add('hidden');
  }
  window.__gameAutoLoaded = true; // Mark that game has started to prevent start screen from showing again
  
  await init();                 // <-- ensure S is created/loaded first
  render();                     // safe now
  updateHUD();
  // Ensure Power Network tab exists once core HUD is up
  if (typeof window.ensurePowerNetworkUI === 'function') {
    try {
      window.ensurePowerNetworkUI();
    } catch(e) {
      console.warn('Power Network UI wiring failed at game() start:', e);
    }
  }
  
  // Check window.startScreenMode if local variable is not set
  const effectiveMode = startScreenMode || window.startScreenMode || 'none';
  
  // If coming from start screen, use modal versions
  if (effectiveMode === 'campaign') {
    // Intro modal already shown in startGame(), just log the trophy message
    if (!S._introLogged) {
      log("🏆 You inherited three Southampton trophies from the club's history. They're now in your inventory and can be sold if needed.");
      S._introLogged = true;
    }
    updateHUD();
    await choosePlayerNameModal();
    await chooseSponsorModal();
    await chooseSecretaryQuickHireModal();
    await showPersonalSummary();
    await chooseManager();
  } else if (effectiveMode === 'quick') {
    // Resume mode - skip all setup steps, just continue from saved state
    updateHUD();
    // Skip all setup steps for resumed games - they're already done
  } else if (effectiveMode === 'load') {
    // Loaded game, skip intro and setup - just continue from where we left off
    updateHUD();
    // Skip all setup steps for loaded games - they're already done
  } else {
    // Legacy path - show intro in log and use original functions
    if (!S._introLogged) {
      log("You are the new chairman of Southampton FC. You're about to discover that it's not as straightforward as you may think!");
      log("🏆 You inherited three Southampton trophies from the club's history. They're now in your inventory and can be sold if needed.");
      log("Let's start by choosing your name...");
      S._introLogged = true;
    }
    updateHUD();
    await choosePlayerName();
    await chooseSponsor();
    await chooseSecretaryQuickHire();
    await showPersonalSummary();
    await chooseManager();
  }

if (typeof genFixtures==='function') genFixtures();
await ensureSeasonSchedule(); // <-- make sure season_matches/opponents are set
if (typeof genFixtures==='function') genFixtures();
  render();
  updateHUD();
// Only reset the league table for brand new games, NOT for loaded/resumed games
if (effectiveMode !== 'load' && effectiveMode !== 'quick') {
  resetLeagueTableForNewSeason();
}
ensureLeagueTableInit();

await ensureSecretaryHired();

// Start the main game loop - this actually runs the game
try {
  await mainGameLoop();
} catch (e) {
  console.error('DEBUG game(): Error in mainGameLoop():', e);
  logSafe("A critical error occurred in the game loop. The game will attempt to continue...");
  // Try to save state before crashing
  saveGame();
}

// Prison loop function - rebuilt for reliability
async function runPrisonLoop() {
  if (!S) {
    console.error("runPrisonLoop: S is undefined");
    return;
  }
  
  // Initialize suspensions if needed
  if (!S.suspensions || typeof S.suspensions !== 'object') {
    S.suspensions = { prison_games: 0, rehab_games: 0, house_games: 0, krazy_register_games: 0 };
  }
  
  // Normalize prison_games
  if (!Number.isFinite(S.suspensions.prison_games)) {
    S.suspensions.prison_games = S.prison ? 1 : 0;
  }
  
  // Initialize critical state
  if (typeof S.matches_played !== 'number' || !Number.isFinite(S.matches_played)) {
    S.matches_played = 0;
  }
  if (!S.opponents || !Array.isArray(S.opponents)) {
    S.opponents = [];
  }
  if (!S.opponentManagers || !Array.isArray(S.opponentManagers)) {
    S.opponentManagers = [];
  }
  
  // AGGRESSIVE UI cleanup - clear everything that could block
  try {
    // Clear all modals and overlays
    const modals = document.querySelectorAll('.modern-modal-overlay, .modal-overlay, [class*="modal"], [class*="overlay"]');
    modals.forEach(modal => { 
      try { 
        modal.remove(); 
      } catch(_){} 
    });
    
    // Clear actions container completely
    const actionsEl = document.getElementById('actions');
    if (actionsEl) {
      actionsEl.innerHTML = '';
      // Remove any event listeners by cloning
      const newActionsEl = actionsEl.cloneNode(true);
      actionsEl.parentNode.replaceChild(newActionsEl, actionsEl);
      newActionsEl.id = 'actions';
    }
    
    // Clear any pending investigation modals
    if (window.currentInvestigationModal) {
      try {
        window.currentInvestigationModal.remove();
      } catch(_) {}
      window.currentInvestigationModal = null;
    }
    
    // Clear any pending choose promises by clearing actions
    if (typeof clearActions === 'function') {
      clearActions();
    }
    
    // Clear any UI context flags
    setPhase('prison');
    S._police_interview_in_progress = false;
    S._police_interview_active = false;
    
    // Wait a moment for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch(e) {
    console.error("UI cleanup error:", e);
  }
  
  // Prison loop
  while((S.suspensions.prison_games|0) > 0) {
    try {
      // Set prison flag
      S.prison = true;
      
      // Track prison time for certificate
      if (!S.playerStats) S.playerStats = {};
      S.playerStats.matchesSpentInPrison = (S.playerStats.matchesSpentInPrison || 0) + 1;
      
      // This week's fixture is opponents[matches_played]; matches_played advances
      // after the result is recorded (same order as postMatchPhase).
      if ((S.matches_played|0) >= (S.season_matches|0)) break; // season over: sentence carries on
      const prisonRound = S.matches_played|0;
      S._prison_loop_entered = true;
      
      logSafe("PRISON: You are in custody. Watching from your cell...");
      GameHooks.emit('prison:match');
      
      // Get opponent
      const matchesPlayed = (S.matches_played|0);
      const oppName = (Array.isArray(S.opponents) && S.opponents[matchesPlayed]) ? S.opponents[matchesPlayed] : "Season End Match";
      const oppManager = (Array.isArray(S.opponentManagers) && S.opponentManagers[matchesPlayed]) ? S.opponentManagers[matchesPlayed] : "Opposing Manager";
      const opp = { team: oppName, manager: oppManager, rating: 75 };
      
      // Simulate match
      const matchResult = await simulatePrisonMatch(opp);
      
      // W/D/L and points come from the table (applyResultToTable below)
      
      // NUKE MORALE - prison matches devastate fan morale
      const moraleDamage = 12 + Math.floor(Math.random() * 4); // 12-15 point hit
      S.fan_morale = Math.max(0, (S.fan_morale|0) - moraleDamage);
      logSafe(`PRISON: Fan morale plummets by ${moraleDamage} points. Now at ${S.fan_morale}.`);
      
      // COST THE CLUB MONEY - legal fees, fines, operational costs
      const prisonCost = 75000 + Math.floor(Math.random() * 25000); // £75k-100k per match
      if (typeof S.club_cash === 'number') {
        S.club_cash = Math.max(0, (S.club_cash|0) - prisonCost);
        logSafe(`PRISON: The club pays £${prisonCost.toLocaleString()} in legal fees and fines.`);
      } else {
        // Fallback if club_cash doesn't exist
        if (!S.debt_club) S.debt_club = 0;
        S.debt_club = (S.debt_club|0) + prisonCost;
        logSafe(`PRISON: £${prisonCost.toLocaleString()} added to club debt.`);
      }
      
      // Update league table
      try {
        if (typeof applyResultToTable === 'function') {
          applyResultToTable(getClubName(), opp.team, matchResult.our_goals, matchResult.their_goals);
        }
      } catch (e) {}
      
      try {
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
      } catch (e) {}
      
      // Track recent form
      if (!Array.isArray(S.recent_form)) S.recent_form = [];
      const formTag = (matchResult.our_goals > matchResult.their_goals) ? 'W' : (matchResult.their_goals > matchResult.our_goals ? 'L' : 'D');
      S.recent_form.push(formTag);
      if (S.recent_form.length > 5) S.recent_form.shift();
      
      // Simulate other matches
      try {
        if (typeof simulateOtherMatchesForRound === 'function') {
          simulateOtherMatchesForRound(prisonRound);
        }
      } catch (e) {}
      S.matches_played = prisonRound + 1;
      GameHooks.emit('matchday:end');
      
      // Refresh UI
      try {
        if (typeof render === 'function') render();
      } catch (e) {}
      
      try {
        if (typeof updateHUD === 'function') updateHUD();
      } catch (e) {}
      
      // Decrement prison sentence
      S.suspensions.prison_games = Math.max(0, (S.suspensions.prison_games|0) - 1);
      
      // Show result
      logSafe(`PRISON MATCH RESULT: ${matchResult.our_goals}-${matchResult.their_goals}`);
      
      if ((S.suspensions.prison_games|0) > 0) {
        logSafe(`PRISON: ${S.suspensions.prison_games} more match(es) remaining in custody.`);
      } else {
        logSafe("PRISON: You are released! Full game functionality restored.");
        S.prison = false;
        S._prison_loop_entered = false;
        S._prison_match_index_when_set = null;
        
        // Reduce legal risks after serving time
        S.police_risk = Math.max(0, (S.police_risk|0) - 15);
        S.legal_risk = Math.max(0, (S.legal_risk|0) - 10);
        S.compliance_risk = Math.max(0, (S.compliance_risk|0) - 5);
        logSafe("Your time served has reduced your legal exposure.");
        
        // Reset UI context and clear any remaining UI elements
        try {
          setPhase(null);
          if (typeof clearActions === 'function') {
            clearActions();
          }
          const actionsEl = document.getElementById('actions');
          if (actionsEl) actionsEl.innerHTML = '';
          // Wait a moment for UI to settle
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch(e) {
          console.error("Error resetting UI after prison:", e);
        }
      }
      
      // Save state
      saveGame();
      
      // Wait for user - with aggressive cleanup before and timeout protection
      try {
        // Clear actions one more time before waitAdvance
        if (typeof clearActions === 'function') {
          clearActions();
        }
        const actionsEl = document.getElementById('actions');
        if (actionsEl) actionsEl.innerHTML = '';
        
        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Use Promise.race to add timeout protection
        const waitPromise = waitAdvance("Prison", "Continue watching from your cell...");
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('waitAdvance timeout')), 300000) // 5 minute timeout
        );
        
        await Promise.race([waitPromise, timeoutPromise]);
      } catch (e) {
        console.error("PRISON waitAdvance error:", e);
        // Fallback: just wait a moment and continue
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
    } catch (e) {
      console.error("PRISON LOOP ERROR:", e);
      // Decrement to prevent infinite loop
      S.suspensions.prison_games = Math.max(0, (S.suspensions.prison_games|0) - 1);
      saveGame();
      logSafe("PRISON: Error occurred, but continuing sentence...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Main game loop function that can be called recursively
// ========== COMPETITION INTEGRATION HELPERS ==========

// Helper to check if current season is a World Cup year
function isWorldCupYear(season) {
  // World Cup happens every 4 seasons, starting from season 2
  return season >= 2 && (season - 2) % 4 === 0;
}

// Helper to update competition context and DOM
function setCompetitionContext(competition) {
  S.competition = competition;
  if (document.body && document.body.dataset) {
    document.body.dataset.competition = competition;
  }
}

// Champions League scheduler - returns true if a CL match was played
async function maybePlayChampionsLeagueFixture() {
  // REGRESSION GUARD: Prevent re-entrant Pre-Match/Wage Week while a match UI is active
  if (S._matchInProgress) {
    return false;
  }
  
  // Group stage scheduling: play CL matches after league matches 2, 5, 8, 11, 14, 17
  const groupMatchdays = [2, 5, 8, 11, 14, 17];
  
  // Knockout stage scheduling: play after league matches (adjusted for 16-match seasons)
  // Use matchdays 6 (quarters), 9 (semis), 12 (final) for 16-match seasons
  // If season is longer, use original schedule
  // IMPORTANT: Also allow knockout matches to be played at any matchday if we're in knockout stage
  // This ensures the tournament can complete even if the season is ending
  const seasonLength = S.season_matches || 16;
  const knockoutMatchdays = seasonLength <= 16 
    ? [6, 9, 12]  // For 16-match seasons: quarters at 6, semis at 9, final at 12
    : [20, 24, 28, 32, 36];  // For longer seasons
  
  // Check if we're qualified but CL hasn't been initialized yet
  // IMPORTANT: Don't re-initialize if CL is already done (eliminated or completed)
  if (S.qual_CL && (!S.clActive || (!S.clStage || S.clStage === 'group')) && S.clStage !== 'done') {
    // Initialize CL when we reach the first group matchday
    if (groupMatchdays.includes(S.matches_played)) {
      // Double-check we're not already initialized to prevent duplicate groups
      if (!S.clActive || !S.clGroupStandings || Object.keys(S.clGroupStandings).length === 0) {
        await initializeChampionsLeague();
        S.clStage = 'group';
      }
      // Continue to play the match below
    } else {
      // Not at a group matchday yet, wait
      return false;
    }
  }
  
  // Only run if CL is active and not done
  if (!S.clActive || S.clStage === 'done') {
    return false;
  }
  
  let shouldPlay = false;
  let stage = '';
  
  if (S.clStage === 'group' && groupMatchdays.includes(S.matches_played)) {
    // Check if there's still a group match to play
    if (S.clScheduledMatches && S.clScheduledMatches.some(m => !m.played)) {
      shouldPlay = true;
      stage = 'group';
    } else if (S.clScheduledMatches && S.clScheduledMatches.every(m => m.played)) {
      // Group stage complete, advance to knockout
      S.clStage = 'knockout';
      if (!S.clKnockoutRound) {
        await initializeChampionsLeagueKnockouts();
      }
      return false; // Don't play this iteration, but stage is now set
    }
  } else if (S.clStage === 'knockout') {
    // Check if there's a knockout match to play
    // Allow knockout matches to be played at scheduled matchdays OR if we're near the end of the season
    // This ensures the tournament can complete even if the season is ending
    const isScheduledMatchday = knockoutMatchdays.includes(S.matches_played);
    const isNearEndOfSeason = S.matches_played >= (S.season_matches || 16) - 2; // Within 2 matches of season end
    
    const hasMatch = 
      (S.clKnockoutRound === 'quarterfinal' && S.clKnockoutBracket?.quarterfinal?.some(m => !m.played && (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'))) ||
      (S.clKnockoutRound === 'semifinal' && S.clKnockoutBracket?.semifinal?.some(m => !m.played && (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'))) ||
      (S.clKnockoutRound === 'final' && S.clKnockoutBracket?.final && !S.clKnockoutBracket.final.played);
    
    if (hasMatch && (isScheduledMatchday || isNearEndOfSeason)) {
      shouldPlay = true;
      stage = 'knockout';
    }
  } else if (S.clStage === 'knockout' && !S.clKnockoutRound && S.clKnockoutBracket) {
    // If we're in knockout stage but round isn't set, initialize it
    if (S.clKnockoutBracket.quarterfinal && S.clKnockoutBracket.quarterfinal.some(m => !m.played && (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'))) {
      S.clKnockoutRound = 'quarterfinal';
      const isScheduledMatchday = knockoutMatchdays.includes(S.matches_played);
      const isNearEndOfSeason = S.matches_played >= (S.season_matches || 16) - 2;
      if (isScheduledMatchday || isNearEndOfSeason) {
        shouldPlay = true;
        stage = 'knockout';
      }
    }
  }
  
  if (!shouldPlay) {
    return false;
  }
  
  // Set competition context
  setCompetitionContext('champions_league');
  
  // Log distinct header based on stage
  if (stage === 'group') {
    log("🌃 [CHAMPIONS LEAGUE NIGHT] Neon floodlights, UEFA anthem, and a sense of dread fill the air.");
    log("🔥 European floodlights, hostile ultras, and an away dressing room that smells like fear and disinfectant.");
  } else {
    log("🔥 [CHAMPIONS LEAGUE NIGHT] Knockout Round - The stakes are astronomical. Corruption has never felt so glamorous.");
  }
  
  // Play the match
  if (S.clStage === 'group') {
    await playChampionsLeagueGroupMatch();
    
    // Check if group stage is complete
    if (S.clScheduledMatches && S.clScheduledMatches.every(m => m.played)) {
      await completeChampionsLeagueGroupStage();
      if (S.clKnockoutRound) {
        S.clStage = 'knockout';
      } else {
        S.clStage = 'done';
        S.clActive = false;
      }
    }
  } else if (S.clStage === 'knockout') {
    await playChampionsLeagueKnockoutMatch();
    
    // Check if tournament is complete
    if (S.clKnockoutRound === 'final' && S.clKnockoutBracket.final && S.clKnockoutBracket.final.played) {
      S.clStage = 'done';
      S.clActive = false;
      await awardChampionsLeaguePrizes();
    } else if (S.clKnockoutRound === 'semifinal' && S.clKnockoutBracket.semifinal && S.clKnockoutBracket.semifinal.every(m => m.played)) {
      // Semifinals complete, check if we're in final
      if (S.clKnockoutBracket.final && (S.clKnockoutBracket.final.team1 === 'Southampton FC' || S.clKnockoutBracket.final.team2 === 'Southampton FC')) {
        // We're in the final, will be played next trigger
      } else {
        // We're eliminated
        S.clStage = 'done';
        S.clActive = false;
      }
    } else if (S.clKnockoutRound === 'quarterfinal' && S.clKnockoutBracket.quarterfinal && S.clKnockoutBracket.quarterfinal.every(m => m.played)) {
      // Quarterfinals complete, check if we advanced
      const ourMatch = S.clKnockoutBracket.quarterfinal.find(m => (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'));
      if (ourMatch && ourMatch.winner !== 'Southampton FC') {
        // We're eliminated
        S.clStage = 'done';
        S.clActive = false;
      }
    }
  }
  
  // Reset to league context after CL match
  setCompetitionContext('league');
  
  return true;
}

// Award Champions League prizes and handle victory celebration
async function awardChampionsLeaguePrizes() {
  const wonCL = S.clKnockoutRound === 'final' && S.clKnockoutBracket.final && S.clKnockoutBracket.final.winner === 'Southampton FC';
  
  if (wonCL) {
    // MASSIVE VICTORY CELEBRATION WITH FLASHING EFFECTS
    log(`<div id="cl-celebration" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; background: linear-gradient(135deg, #ffd700 0%, #ff6b00 50%, #ffd700 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; animation: flash 0.3s infinite;">
      <h1 style="font-size: 5rem; color: #000; text-shadow: 4px 4px 8px rgba(255,255,255,0.8); margin: 0; animation: pulse 0.5s infinite;">FUCK YES!</h1>
      <h2 style="font-size: 3rem; color: #000; text-shadow: 3px 3px 6px rgba(255,255,255,0.8); margin: 20px 0;">🏆🏆🏆 CHAMPIONS LEAGUE CHAMPIONS! 🏆🏆🏆</h2>
      <style>
        @keyframes flash {
          0%, 100% { background: linear-gradient(135deg, #ffd700 0%, #ff6b00 50%, #ffd700 100%); }
          50% { background: linear-gradient(135deg, #ff6b00 0%, #ffd700 50%, #ff6b00 100%); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      </style>
    </div>`);
    
    // Remove the flashing div after 3 seconds
    setTimeout(() => {
      const div = document.getElementById('cl-celebration');
      if (div) div.remove();
    }, 3000);
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    log("🏆🏆🏆 CHAMPIONS LEAGUE CHAMPIONS! The continent bows before your corruption and genius.");
    log("📣 BREAKING NEWS: Southampton become the most hated and admired club in Europe.");
    log("[SKY SPORTS] 'This is the most chaotic Champions League win in history.'");
    log("[BBC SPORT] 'Mysterious bribes? Explosive scandals? Title still stands.'");
    log("[UEFA] 'We will be investigating... eventually.'");
    
    // Massive rewards
    const prizeMoney = 50000000; // 50 million
    S.club_cash = (S.club_cash || 0) + prizeMoney;
    log(`💶 UEFA prize money credited: ${money(prizeMoney)} for Champions League victory.`);
    
    S.reputation = Math.min(100, (S.reputation || 50) + 25);
    S.morale = Math.min(100, (S.morale || 50) + 20);
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 25);
    S.board_support = Math.min(100, (S.board_support || 50) + 20);
    
    log("📈 Reputation +25 | Morale +20 | Fan Morale +25 | Board Support +20");
    
    // Set champion flag for next season auto-qualification
    S.clChampion = true;
    
    // Add Champions League trophy to inventory
    if (typeof window.addAccoladeToInventory === 'function') {
      window.addAccoladeToInventory('Champions League Trophy', 10000000);
      log(`🏆 Champions League Trophy added to your inventory. You can sell it for money or trade it for points.`);
    }
    
    // Global superstar event (one-time)
    if (!S.clSuperstarOffered) {
      S.clSuperstarOffered = true;
      log("<div style='border: 3px solid gold; padding: 20px; margin: 20px 0; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); border-radius: 10px;'>");
      log("<strong>🌟 GLOBAL SUPERSTAR ALERT 🌟</strong>");
      log("Lionel Messi (or a thinly disguised parody) has expressed interest in joining Southampton for one last insane contract.");
      log("The world's greatest player wants to finish his career under your... unique... management style.");
      log("</div>");
      
      const accept = await choose([
        {key: 'yes', label: 'Sign the Global Superstar (Massive wages, huge ego, potential scandal)'},
        {key: 'no', label: 'Decline (Too expensive, too risky)'}
      ], 'Will you sign the global superstar?');
      
      if (accept === 'yes') {
        log("✅ Global superstar signed! The world watches in disbelief.");
        log("💰 Wages: £500,000/week | Reputation +10 | Morale +15 | Legal Risk +5 (age, wages, ego)");
        S.reputation = Math.min(100, (S.reputation || 50) + 10);
        S.morale = Math.min(100, (S.morale || 50) + 15);
        S.legal_risk = Math.min(100, (S.legal_risk || 0) + 5);
        // Add to squad if there's a squad system
        if (!S.squad) S.squad = [];
        S.squad.push({name: 'Global Superstar', position: 'Forward', rating: 99, wages: 500000});
      } else {
        log("You decline. The superstar signs for Portsmouth instead. The betrayal stings.");
        S.morale = Math.max(0, (S.morale || 50) - 5);
      }
    }
  } else {
    // Eliminated - still get some prize money based on how far we got
    let prizeMoney = 0;
    if (S.clKnockoutRound === 'semifinal') {
      prizeMoney = 20000000;
      log("💶 UEFA prize money: £20M for reaching the semifinals.");
    } else if (S.clKnockoutRound === 'quarterfinal') {
      prizeMoney = 10000000;
      log("💶 UEFA prize money: £10M for reaching the quarterfinals.");
    } else if (S.clStage === 'group') {
      prizeMoney = 5000000;
      log("💶 UEFA prize money: £5M for group stage participation.");
    }
    
    if (prizeMoney > 0) {
      S.club_cash = (S.club_cash || 0) + prizeMoney;
      S.reputation = Math.min(100, (S.reputation || 50) + 5);
      S.morale = Math.min(100, (S.morale || 50) + 3);
    }
  }
  
  render();
}

// World Cup off-season handler
async function maybeRunWorldCupOffSeason() {
  const currentSeason = S.season || 1;
  
  if (!isWorldCupYear(currentSeason)) {
    return;
  }
  
  if (S.worldCupCompletedForSeason) {
    return;
  }
  
  // Set competition context
  setCompetitionContext('world_cup');
  
  log("🌍 [WORLD CUP] You take charge of a national team. The world is watching. Try not to get arrested.");
  log("🇺🇳 Flags everywhere, national anthems echoing, and you, a known criminal, in the technical area.");
  
  await handleWorldCupInvitation(currentSeason);
  
  S.worldCupCompletedForSeason = true;
  
  // Reset competition context back to league
  setCompetitionContext('league');
}

async function applyPendingDebugJump(){
  const j = window.__kreplinPendingJump;
  if (!j) return;
  window.__kreplinPendingJump = null;
  try {
    if (j.season && (j.season|0) !== (S.season|0)) {
      S.season = Math.max(1, Math.min(5, j.season|0));
      beginNewSeasonState();
      if (j.opener !== false) {
        if (S.season === 4 && !S.season4_opener_complete) { await runSeason4Opener(); S.season4_opener_complete = true; }
        if (S.season === 5 && !S.season5_opener_complete) { await runSeason5Opener(); S.season5_opener_complete = true; }
      } else {
        S.season4_opener_complete = S.season4_opener_complete || S.season >= 4;
        S.season5_opener_complete = S.season5_opener_complete || S.season >= 5;
      }
    }
    // Fast-forward: play our earlier fixtures (random results) through the table.
    const target = Math.max(0, Math.min(j.match|0, S.season_matches|0));
    ensureSeasonScheduleAndTable();
    while ((S.matches_played|0) < target) {
      const r = S.matches_played|0;
      const fx = S.rounds[r][0];
      const gh = Math.floor(Math.random()*4), ga = Math.floor(Math.random()*4);
      recordTableResult(fx[0], fx[1], gh, ga);
      simulateOtherMatchesForRound(r);
      S.matches_played = r + 1;
    }
    syncClubRecordFromTable();
    for (const [path, val] of Object.entries(j.flags || {})) {
      const parts = path.split('.'); let o = S;
      while (parts.length > 1) { const k = parts.shift(); if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
      o[parts[0]] = val;
    }
    if (j.setup) (0, eval)(j.setup);
    log(`[debug] Jumped to season ${S.season}, match ${S.matches_played}.`);
    updateHUD();
  } catch (e) { console.error('debug jump failed', e); }
}

// Reset the per-season state (shared by the season transition and the debug jump).
function beginNewSeasonState(){
  // Season 4 & 5 have 9 games, others have 16 - will be set correctly by ensureSeasonSchedule()
  S.matches_played = 0;
  S.wins = 0;
  S.draws = 0;
  S.losses = 0;
  S.points = 0;
  S.points_deducted = 0;
  S.points_adjust = 0;
  S.manager_fires = 0;
  S.fired_last_game = false;
  S.season_matches = (S.season === 4 || S.season === 5) ? 9 : 16;

  // Reset CL active state (will be set when CL starts)
  S.clActive = false;
  S.clStage = 'group'; // Reset to group stage for new season
  S.clGroupMatches = [];
  S.clGroupStandings = {};
  S.clKnockoutRound = null;
  S.clKnockoutBracket = {};
  S.clScheduledMatches = [];
  S.clNextMatchIndex = 0;

  // Reset World Cup completion flag for new season
  S.worldCupCompletedForSeason = false;

  // Reset some risks but keep some progression
  S.legal_risk = Math.max(0, (S.legal_risk||0) - 10);
  S.compliance_risk = Math.max(0, (S.compliance_risk||0) - 10);
  S.police_risk = Math.max(0, (S.police_risk||0) - 5);

  // Clear prison status
  S.prison = false;
  if(S.suspensions) {
    S.suspensions.prison_games = 0;
  }

  // Reset table + fixtures for new season
  S.table = {};
  S.table_order = [];
  S.rounds = null;
  S.rounds_done = [];
  S.leagueTableShownInPresentation = false; // Reset flag for new season
  S.opponents = [];

  // CRITICAL: Restore currentOpponent function to prevent World Cup/CL opponents contaminating new season
  restoreCurrentOpponent();
  ensureSeasonSchedule();
  ensureLeagueTableInit();
  ensureSeasonScheduleAndTable();
  renderLeagueTablePanel();
}

// The campaign driver: one pass plays the rest of a season (plus prison/rehab weeks)
// and, at season end, the transition. Iterative so long campaigns can't hit a depth limit.
async function mainGameLoop() {
  if (window.__mainGameLoopRunning) { console.warn('mainGameLoop already running'); return; }
  window.__mainGameLoopRunning = true;
  try {
    let stuck = 0, lastSig = '';
    while (true) {
      const r = await mainGameLoopPass();
      if (r !== 'again' || (S && S.game_over)) break;
      const sig = `${S.season}/${S.matches_played}`;
      stuck = (sig === lastSig) ? stuck + 1 : 0;
      lastSig = sig;
      if (stuck >= 5) { console.error('mainGameLoop: no progress after 5 passes at', sig); logSafe('ERROR: The season cannot advance. Please save and reload.'); break; }
    }
  } finally {
    window.__mainGameLoopRunning = false;
  }
}

async function mainGameLoopPass() {
 try {
  await applyPendingDebugJump();
  // Stop the opening music when the main game loop starts
  const openingMusic = document.getElementById('openingMusic');
  if (openingMusic && !openingMusic.paused) {
    openingMusic.pause();
    openingMusic.currentTime = 0;
  }
  
  // Start general music when main game loop begins (if not already playing)
  if (typeof window._startGeneralMusic === 'function') {
    window._startGeneralMusic();
  }
  
  // Check for game over conditions at the start of each loop
  if(S.game_over){
    log('GAME OVER: ' + (S.game_over_reason || 'Unknown reason'));
    log('Your story has come to an end.');
    return; // Exit the game loop
  }
  
  // Season 4: Show television appearance at season start if not shown yet
  if (S.season === 4 && S.season4 && S.season4.initialized && !S.season4.television_appearance_shown && S.matches_played === 0) {
    S.season4.television_appearance_shown = true;
    
    // Create and show sinister modal for Van Onslaught announcement
    const existingModal = document.getElementById('sinister-van-onslaught-modal');
    if (existingModal) existingModal.remove();
    
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'sinister-van-onslaught-modal';
    modalOverlay.className = 'sinister-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'sinister-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'sinister-modal-content';
    modalContent.innerHTML = `<div class="sinister-title">━━━ TELEVISION BROADCAST ━━━</div>`;
    
    modal.appendChild(modalContent);
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Skip flag to bypass typewriter animation
    let skipAnimation = false;
    let messageIndex = 0; // Track which messages have been displayed
    
    // Function to append text to modal with typewriter effect
    const appendToModal = (text, delay = 0, useTypewriter = true) => {
      return new Promise(resolve => {
        if (skipAnimation) {
          // If skipping, display immediately without animation
          const p = document.createElement('p');
          if (text.trim() === '') {
            p.innerHTML = '<br>';
          } else {
            p.textContent = text;
          }
          modalContent.appendChild(p);
          modal.scrollTop = modal.scrollHeight;
          messageIndex++;
          resolve();
          return;
        }
        
        setTimeout(() => {
          const p = document.createElement('p');
          if (text.trim() === '') {
            p.innerHTML = '<br>';
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            messageIndex++;
            resolve();
          } else if (useTypewriter && text.trim() !== '' && !text.includes('<strong>') && !text.includes('<em>') && !text.includes('<span>')) {
            const span = document.createElement('span');
            span.className = 'typewriter-line';
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
              span.classList.add('no-cursor');
            }, 2600);
            
            setTimeout(() => {
              modal.scrollTop = modal.scrollHeight;
              messageIndex++;
              resolve();
            }, 2500);
          } else {
            p.innerHTML = text;
            modalContent.appendChild(p);
            modal.scrollTop = modal.scrollHeight;
            messageIndex++;
            resolve();
          }
        }, delay);
      });
    };
    
    // Add close button with proper game advancement
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sinister-modal-close-btn';
    closeBtn.textContent = 'Continue';
    closeBtn.style.display = 'none';
    
    // Add skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'sinister-modal-close-btn';
    skipBtn.textContent = 'Skip';
    skipBtn.style.position = 'fixed';
    skipBtn.style.bottom = '20px';
    skipBtn.style.right = '20px';
    skipBtn.style.transform = 'none';
    skipBtn.style.background = 'rgba(139, 0, 0, 0.4)';
    skipBtn.style.border = '2px solid #8b0000';
    skipBtn.style.color = '#cc0000';
    skipBtn.style.padding = '12px 24px';
    skipBtn.style.fontSize = '14px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.zIndex = '10001';
    
    // Create a promise that resolves when the button is clicked
    let continueResolve;
    const continuePromise = new Promise(resolve => {
      continueResolve = resolve;
    });
    
    closeBtn.onclick = async () => {
      modalOverlay.style.animation = 'sinisterFadeIn 0.5s ease-out reverse';
      setTimeout(() => {
        modalOverlay.remove();
      }, 500);
      // Wait for modal to fade out, then advance game
      await new Promise(resolve => setTimeout(resolve, 500));
      if (typeof waitAdvance === 'function') {
        await waitAdvance("Continue", "The season begins...");
      }
      continueResolve();
    };
    
    // Store all messages for skip functionality
    const allMessages = [];
    const liquidatedTeams = S.season4.liquidated_teams || [];
    
    allMessages.push({ text: `Mohammed Van Onslaught appears on television, before a grand 'Muslim type' podium.`, delay: 400 });
    allMessages.push({ text: `A gaggle of reporters take pictures.`, delay: 0 });
    allMessages.push({ text: ``, delay: 0 });
    allMessages.push({ text: `"I am pleased to announce," he says, his voice booming ominously,`, delay: 1000 });
    allMessages.push({ text: `"the coronation of the Muslim Premier League."`, delay: 1200 });
    allMessages.push({ text: ``, delay: 0 });
    allMessages.push({ text: `The largely Saudi crowd erupts in euphoric applause, chanting words such as "Yes" and "Yes, great!"`, delay: 1200 });
    allMessages.push({ text: ``, delay: 0 });
    
    if (liquidatedTeams.length > 0) {
      const teamsList = liquidatedTeams.join(', ');
      allMessages.push({ text: `He continues: "The following clubs have been liquidated`, delay: 1200 });
      allMessages.push({ text: `and their stadiums have been converted into large mosques;`, delay: 0 });
      allMessages.push({ text: `${teamsList}."`, delay: 0 });
    } else {
      allMessages.push({ text: `He continues: "The following clubs have been liquidated`, delay: 1200 });
      allMessages.push({ text: `and their stadiums have been converted into large mosques."`, delay: 0 });
    }
    
    allMessages.push({ text: `He smiles in a very happy way.`, delay: 800 });
    allMessages.push({ text: `"We didn't want to do this, but the fans of the clubs in question demanded it,`, delay: 1200 });
    allMessages.push({ text: `as they wanted places of worship, and who were we to deny them?"`, delay: 0 });
    allMessages.push({ text: ``, delay: 0 });
    allMessages.push({ text: `The broadcast cuts to footage of empty stadiums,`, delay: 1200 });
    allMessages.push({ text: `Minarets rising where goalposts once stood,`, delay: 0 });
    allMessages.push({ text: `Saudi flags and the famous 'Muslim flag' being erected.`, delay: 0 });
    allMessages.push({ text: ``, delay: 0 });
    allMessages.push({ text: `"The league continues," Van Onslaught announces,`, delay: 1200 });
    allMessages.push({ text: `"with ten teams. This will be much more exciting for everyone,`, delay: 0 });
    allMessages.push({ text: `as fewer games will make way for extra time for pious activities`, delay: 0 });
    allMessages.push({ text: `such as praying to Allah and other things"`, delay: 0 });
    allMessages.push({ text: ``, delay: 0 });
    allMessages.push({ text: `The broadcast ends.`, delay: 1000 });
    allMessages.push({ text: ``, delay: 0 });
    
    skipBtn.onclick = async () => {
      skipAnimation = true;
      skipBtn.style.display = 'none';
      
      // Display all remaining messages immediately (starting from messageIndex)
      for (let i = messageIndex; i < allMessages.length; i++) {
        const msg = allMessages[i];
        const p = document.createElement('p');
        if (msg.text.trim() === '') {
          p.innerHTML = '<br>';
        } else {
          p.textContent = msg.text;
        }
        modalContent.appendChild(p);
      }
      modal.scrollTop = modal.scrollHeight;
      messageIndex = allMessages.length; // Mark all as displayed
      
      // Show continue button
      closeBtn.style.display = 'block';
    };
    
    modalOverlay.appendChild(closeBtn);
    modalOverlay.appendChild(skipBtn);
    
    // Show announcement with typewriter effect (faster delays)
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const msg of allMessages) {
        await appendToModal(msg.text, msg.delay);
      }
      
      // Show close button
      closeBtn.style.display = 'block';
      skipBtn.style.display = 'none';
    })();
    
    // Wait for the continue button to be clicked before proceeding
    await continuePromise;
  }
  
  while(S.matches_played<S.season_matches && S.matches_played < (S.opponents?.length || S.season_matches) && (S.suspensions?.prison_games|0) <= 0 && (S.suspensions?.rehab_games|0) <= 0 && !S.game_over){
   try {
    
    // Send initial Delmor text at the beginning of the game (only once)
    if (S.matches_played === 0 && !S._initial_delmor_text_sent) {
      const initialDelmorMessage = "This is Delmor Krunchem, the Chairman of Portsmouth FC. Don't get too comfortable, little rat. Portsmouth will destroy you when we meet.";
      log(`📱 Delmor Krunchem: "${initialDelmorMessage}"`);
      if (typeof window.enqueueRivalText === 'function') {
        window.enqueueRivalText(initialDelmorMessage);
      } else if (typeof sendRivalText === 'function') {
        sendRivalText(initialDelmorMessage);
      }
      S._initial_delmor_text_sent = true;
    }
    
    // Week set-up runs once per fixture: if this iteration is retried (an error, or
    // a choice timeout caught below) we resume at the match without re-charging.
    const weekKey = `${S.season}/${S.matches_played}`;
    const weekResumed = (S._week_prepared_for === weekKey);
    if (!weekResumed) await maybeSecretaryEvent(); 
    const prisonCheck = (S.suspensions?.prison_games|0) > 0;
    const rehabCheck = (S.suspensions?.rehab_games|0) > 0;
    if(S.bankrupt||prisonCheck||rehabCheck||S.game_over) {
      break;
    }
  if (!weekResumed) {
  S._week_prepared_for = weekKey;
  await processWages();
  queueUnpaidTransferAgents();
  await maybePreMatchScenarios();
  await maybeMessiGoalieEvent();
  // Season 4 & 5: Moral Compliance Audit
  await maybeMoralComplianceAudit();
  // Season 4 & 5: Process pending lashings
  if ((S.season === 4 || S.season === 5) && S._pending_lashing && Array.isArray(S._pending_lashing) && S._pending_lashing.length > 0) {
    for (let i = S._pending_lashing.length - 1; i >= 0; i--) {
      const pending = S._pending_lashing[i];
      pending.delay_matches = (pending.delay_matches || 0) - 1;
      if (pending.delay_matches <= 0) {
        await waitAdvance("Arrest", "The sharia police arrive...");
        await administerLashing(pending.crime, pending.lashes);
        S._pending_lashing.splice(i, 1);
      }
    }
    // Clean up empty array
    if (S._pending_lashing.length === 0) {
      delete S._pending_lashing;
    }
  }
  } // end once-per-week set-up
  
  // Champions League scheduler - check if we should play a CL match instead of league
  if (await maybePlayChampionsLeagueFixture()) {
    // CL match was played, continue to next loop iteration
    continue;
  }
  
  // Set competition context to league for normal matches
  setCompetitionContext('league');
  
  // Safety check: ensure opponents array exists and is valid
  if (!S.opponents || !Array.isArray(S.opponents) || S.opponents.length === 0) {
    console.error("ERROR: Opponents array is missing or empty. Reinitializing...");
    ensureSeasonSchedule();
    if (!S.opponents || !Array.isArray(S.opponents) || S.opponents.length === 0) {
      log("⚠️ Critical error: Could not initialize opponents. Please refresh the game.");
      break; // Exit the loop
    }
  }
  
  // Safety check: ensure matches_played is within bounds
  // Check both season_matches and opponents.length to prevent off-by-one errors
  const maxMatches = Math.min(S.season_matches || 16, S.opponents?.length || 16);
  if (S.matches_played >= maxMatches || S.matches_played >= (S.opponents?.length || 0)) {
    console.error(`ERROR: matches_played (${S.matches_played}) is out of bounds for opponents array (length ${S.opponents?.length || 0}) or season_matches (${S.season_matches})`);
    log(`⚠️ Season complete or error detected. Ending game loop.`);
    break; // Exit the loop
  }
  
  const opp=S.opponents[S.matches_played];
  
  // Final safety check
  if (!opp) {
    console.error(`ERROR: Opponent at index ${S.matches_played} is undefined`);
    log(`⚠️ Error: Could not determine opponent. Skipping this match.`);
    S.matches_played = (S.matches_played || 0) + 1; // Advance to avoid infinite loop
    continue; // Skip to next iteration
  }
  
  // Log competition context for league matches
  if (S.competition === 'league') {
    log(`⚽ [${getLeagueName().toUpperCase()}] ${getClubName()} vs ${opp}. Another day at the office. Another chance to disgrace yourself.`);
  }
  
 await preMatchPhase();

// Sentenced to rehab during the pre-match (e.g. an overdose): this fixture is
// played without you by the rehab loop.
if ((S.suspensions?.rehab_games|0) > 0 || (S.suspensions?.prison_games|0) > 0) {
  break;
}

// Check debt obligations before allowing match to proceed
const canProceedWithMatch = await checkDebtObligationsBeforeMatch();
if (!canProceedWithMatch) {
  // Game over or blocked - break from loop
  break;
}

// Season 5: Injure the two best players BEFORE the first match (so they can't be selected)
if (S.season === 5 && S.season5 && S.season5.injure_best_players_first_match && S.matches_played === 0) {
  // Find the two best players by rating (excluding already injured/dead players)
  const availablePlayers = S.squad.filter(p => p && !p.is_dead && (p.injury_games || 0) === 0 && (p.suspension_games || 0) === 0);
  if (availablePlayers.length >= 2) {
    // Sort by rating (highest first)
    const sortedPlayers = [...availablePlayers].sort((a, b) => {
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;
      return ratingB - ratingA;
    });
    
    const bestPlayer1 = sortedPlayers[0];
    const bestPlayer2 = sortedPlayers[1];
    
    if (bestPlayer1 && bestPlayer2) {
      // Injure them for 1 match (so they're available for the next match)
      // Direct assignment since assignInjury is a local function
      bestPlayer1.injury_games = 1;
      bestPlayer1.injury_type = 'knock';
      bestPlayer2.injury_games = 1;
      bestPlayer2.injury_type = 'knock';
      log(``);
      log(`⚠️ ${bestPlayer1.name} and ${bestPlayer2.name} are both injured and unavailable for selection.`);
      log(``);
    }
  }
  // Clear the flag so it only happens once
  S.season5.injure_best_players_first_match = false;
}

// Ensure we have exactly 5 players before allowing kickoff
ensureValidLineup();
while (S.lineup.length < 5 && !S.game_over) {
  log("You cannot proceed to kickoff with less than 5 players. Please select a full lineup first.");
  await selectLineupMenu();
  ensureValidLineup();
  // Re-check after lineup selection
  if (S.lineup.length < 5) {
    log("You still don't have enough players. The match cannot proceed.");
    // Back to the pre-match menu (transfer window etc.) for the same fixture - no wages re-charged
    await preMatchPhase();
    ensureValidLineup();
  }
}

// Season 5 first match and Season 2 match 11 (St Mary's terrorist attack): Disable skip to results
const kickoffOptions = [
  {key:'sim',   label:'Quick Simulate'}
];
if (!(S.season === 5 && S.season5 && S.season5.first_match_special_event && S.matches_played === 0) && !(S.season === 2 && S.matches_played === 11)) {
  kickoffOptions.push({key:'skip',  label:'Skip to results'});
}
// Team walkout: no kickoff, the fixture is forfeited 3–0
const forfeit = !!S._walkout_forfeit;
S._walkout_forfeit = false;
const how = forfeit ? 'forfeit' : await choose(kickoffOptions, "Kickoff Options");

// --- capture the opponent AT KICKOFF so logs/table use the same team ---
const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: 'Opposition' };
// ensure matchContext for postMatchPhase (roundIndex = this fixture's round)
S.matchContext = Object.assign({}, oppAtKickoff, { roundIndex: S.matches_played|0 });


let outcome;
if (how === 'forfeit') {
  log(`The players never come out of the tunnel. ${oppAtKickoff.team || 'The opposition'} are awarded the match 3–0.`);
  S.matchEvents = [];
  outcome = { our_goals: 0, their_goals: 3, forfeit: true };
} else if (how === 'skip') {
  // Skip to results - simulate match and show summary
  outcome = await skipToResults();
} else {
  // quick-sim path with taunt option
  // Clear any pre-match menu interruption flags that might interfere
  if (S._preMatchMenuInterrupted) {
    S._preMatchMenuInterrupted = false;
  }
  if (S._preMatchMenuActive) {
    S._preMatchMenuActive = false;
  }
  outcome = await playMatchPhaseWithTaunts();
  
  // Apply Season 5 survival economy match modifiers
  if (typeof applySeason5MatchModifiers === 'function') {
    outcome = applySeason5MatchModifiers(outcome);
  }
}

// Store match result for Press system (normalize goal field names)

const ourGoals = 
  (typeof outcome?.our_goals === 'number')     ? outcome.our_goals     :
  (typeof outcome?.usGoals === 'number')       ? outcome.usGoals       :
  (typeof outcome?.goalsFor === 'number')      ? outcome.goalsFor      :
  (typeof outcome?.gf === 'number')            ? outcome.gf            : 0;

const theirGoals = 
  (typeof outcome?.their_goals === 'number')   ? outcome.their_goals   :
  (typeof outcome?.themGoals === 'number')     ? outcome.themGoals     :
  (typeof outcome?.goalsAgainst === 'number')  ? outcome.goalsAgainst  :
  (typeof outcome?.ga === 'number')            ? outcome.ga            : 0;

S.lastMatchResult = { homeGoals: ourGoals, awayGoals: theirGoals };
// Also store in window.lastMatchOutcome for train tracks sequence
window.lastMatchOutcome = {
  our_goals: ourGoals,
  their_goals: theirGoals,
  usGoals: ourGoals,
  themGoals: theirGoals
};

// Use the SAME captured opponent in the full-time line (no "stagger")

// For sim mode, we'll let the playMatchPhase handle the commentary
// This prevents duplicate processing that was causing incoherent commentary

// Wait for match commentary to complete before showing wage decision
// The playMatch function will handle the timing of when to show "Match Complete"

// Weekly wage bill (the decision also runs debt management once)
await postMatchWageDecision();

// Check if this is season 5 first match - handle special audio for post-match UI
const isSeason5FirstMatch = (S.season === 5 && S.matches_played === 0);
let postMatchAudio = null;

if (isSeason5FirstMatch) {
  
  // Use existing audio if it was already created (from panic video/aftermath UI)
  postMatchAudio = window._season5PostMatchAudio;
  
  if (!postMatchAudio) {
    // Stop general background music
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
      generalMusicAudio.pause();
    }
    
    // Also pause opening music if playing
    const openingMusic = document.getElementById('openingMusic');
    if (openingMusic && !openingMusic.paused) {
      openingMusic.pause();
    }
    
    // Create the post-match track
    const postMatchTrackUrl = 'https://www.dropbox.com/scl/fi/99k3vl0z7pwwv61irqnj3/delmor-shoot.mp3?rlkey=kqwvyt6a02ltwda4hs66ru1wo&st=4o4ndk0j&dl=1';
    postMatchAudio = new Audio(postMatchTrackUrl);
    postMatchAudio.preload = 'auto';
    postMatchAudio.volume = 1.0;
    
    // Store globally
    window._season5PostMatchAudio = postMatchAudio;
  } else {
    // Make sure background music is still stopped
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio && !generalMusicAudio.paused) {
      generalMusicAudio.pause();
    }
  }
  
  // Ensure the music is playing for the first post-match UI
  if (postMatchAudio.paused) {
    try {
      await postMatchAudio.play();
    } catch (err) {
    }
  } else {
  }
} else {
}

await waitAdvance("Post-Match", "Match finished. Process consequences?");

// Before postMatchPhase (second post-match in main game log), pause special music and resume normal background music
// The special music will resume in the aftermath UI which comes after postMatchPhase
if (isSeason5FirstMatch && postMatchAudio && !postMatchAudio.paused) {
  postMatchAudio.pause();
  // Don't reset currentTime - let it continue from where it paused when it resumes in aftermath
}

// Resume normal background music for the second post-match (postMatchPhase)
if (isSeason5FirstMatch) {
  if (typeof window._startGeneralMusic === 'function') {
    window._startGeneralMusic();
  } else if (typeof generalMusicAudio !== 'undefined' && generalMusicAudio) {
    generalMusicAudio.play().catch(err => {
    });
  }
}

await postMatchPhase(outcome);

// Season 5 first match: Play Panic video after match UI finishes
// Note: This code may not run if the video was already played from the massacre event
if (S.season === 5 && S.season5 && S.season5.play_panic_video && S.matches_played === 0) {
  S.season5.play_panic_video = false; // Clear flag
  
  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.className = 'cinematic-video-container';
  videoContainer.style.position = 'fixed';
  videoContainer.style.top = '0';
  videoContainer.style.left = '0';
  videoContainer.style.width = '100%';
  videoContainer.style.height = '100%';
  videoContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  videoContainer.style.zIndex = '99999';
  videoContainer.style.display = 'flex';
  videoContainer.style.alignItems = 'center';
  videoContainer.style.justifyContent = 'center';
  
  const video = document.createElement('video');
  video.src = 'https://www.dropbox.com/scl/fi/uv9uwapaxv89ovd4u225w/Panic.mp4?rlkey=rrv6pdbw76qzkhnyw3ii4wajk&st=1x7j1wul&dl=1';
  video.controls = false;
  video.autoplay = true;
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'contain';
  
  const videoCloseBtn = document.createElement('button');
  videoCloseBtn.className = 'cinematic-video-close-btn';
  videoCloseBtn.textContent = '✕ Close';
  videoCloseBtn.style.display = 'none';
  videoCloseBtn.style.position = 'absolute';
  videoCloseBtn.style.top = '20px';
  videoCloseBtn.style.right = '20px';
  videoCloseBtn.style.padding = '10px 20px';
  videoCloseBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  videoCloseBtn.style.color = 'white';
  videoCloseBtn.style.border = '2px solid white';
  videoCloseBtn.style.borderRadius = '8px';
  videoCloseBtn.style.cursor = 'pointer';
  videoCloseBtn.style.fontSize = '16px';
  videoCloseBtn.style.zIndex = '100000';
  
  // Add loading indicator
  const loadingText = document.createElement('div');
  loadingText.textContent = 'Loading video...';
  loadingText.style.color = 'white';
  loadingText.style.fontSize = '18px';
  loadingText.style.position = 'absolute';
  loadingText.style.top = '50%';
  loadingText.style.left = '50%';
  loadingText.style.transform = 'translate(-50%, -50%)';
  loadingText.style.zIndex = '100001';
  
  videoContainer.appendChild(video);
  videoContainer.appendChild(videoCloseBtn);
  videoContainer.appendChild(loadingText);
  document.body.appendChild(videoContainer);
  
  // Handle video loading
  let videoLoaded = false;
  let videoError = false;
  
  video.addEventListener('loadeddata', () => {
    videoLoaded = true;
    loadingText.style.display = 'none';
    // Try to play the video
    video.play().catch(err => {
      console.error('Video autoplay failed:', err);
      // Show play button if autoplay fails
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ Play Video';
      playBtn.style.position = 'absolute';
      playBtn.style.top = '50%';
      playBtn.style.left = '50%';
      playBtn.style.transform = 'translate(-50%, -50%)';
      playBtn.style.padding = '15px 30px';
      playBtn.style.fontSize = '18px';
      playBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
      playBtn.style.color = 'black';
      playBtn.style.border = 'none';
      playBtn.style.borderRadius = '8px';
      playBtn.style.cursor = 'pointer';
      playBtn.style.zIndex = '100002';
      playBtn.onclick = () => {
        video.play();
        playBtn.remove();
      };
      videoContainer.appendChild(playBtn);
      loadingText.style.display = 'none';
    });
  });
  
  video.addEventListener('canplay', () => {
    if (!videoLoaded) {
      videoLoaded = true;
      loadingText.style.display = 'none';
    }
  });
  
  video.addEventListener('error', (e) => {
    console.error('Video loading error:', e);
    videoError = true;
    loadingText.textContent = 'Error loading video. Click to close.';
    loadingText.style.cursor = 'pointer';
    loadingText.onclick = () => {
      videoContainer.remove();
    };
    videoCloseBtn.style.display = 'block';
  });
  
  // Show close button after video ends or on click
  video.addEventListener('ended', () => {
    videoCloseBtn.style.display = 'block';
  });
  
  videoCloseBtn.addEventListener('click', () => {
    videoContainer.remove();
  });
  
  // Wait for video to end or be closed
  await new Promise(resolve => {
    const checkClosed = () => {
      if (!document.body.contains(videoContainer)) {
        resolve();
      } else {
        setTimeout(checkClosed, 100);
      }
    };
    video.addEventListener('ended', () => {
      setTimeout(() => {
        if (document.body.contains(videoContainer)) {
          checkClosed();
        } else {
          resolve();
        }
      }, 1000);
      videoCloseBtn.addEventListener('click', resolve, { once: true });
    });
    videoCloseBtn.addEventListener('click', resolve, { once: true });
  });
  
  
  // After panic video: Show kidnapping sequence UI log (only if not already shown)
  if (!S.season5) S.season5 = {};
  
  // Safety check: If we're on match 0 and the flag is somehow true, reset it
  // This handles cases where the flag persisted from a previous save incorrectly
  if (S.matches_played === 0 && S.season5.kidnapping_sequence_shown === true) {
    S.season5.kidnapping_sequence_shown = false;
  }
  
  if (!S.season5.kidnapping_sequence_shown) {
    if (typeof showKidnappingSequenceModal === 'function') {
      try {
        await showKidnappingSequenceModal();
        // Only set flag to true AFTER the modal has been shown successfully
        S.season5.kidnapping_sequence_shown = true;
      } catch (error) {
        console.error('DEBUG: Error showing kidnapping sequence modal:', error);
        // Don't set flag if there was an error, so it can try again
      }
    } else {
      console.error('showKidnappingSequenceModal is not defined');
    }
  } else {
  }
}
