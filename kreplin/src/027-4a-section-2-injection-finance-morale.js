// ===== 4A Section 2 injection: Finance & Morale =====
(function(){
  // Use local, crash-proof home/away check
  let home = true;
  try{
    const SOUTH = (S?.club_name) || "Southampton FC";
    const idx   = Math.max(0, ((S?.matches_played|0) - 1)); // round just finished
    const r     = S?.rounds?.[idx];
    const fx    = Array.isArray(r?.[0]) ? r[0] : [SOUTH, (S?.opponents?.[idx]||"Opponent")];
    home = (fx[0] === SOUTH);
  }catch(_){ home = true; }

  // Attendance + gate only if HOME - DISABLED (using new stadium system)
  // if (home){
  //   const CAP = 32000, TICKET = 40;
  //   const fm  = S?.fan_morale|0;
  //   const att = Math.round(Math.max(0, Math.min(CAP, CAP * (0.5 + fm/200))));
  //   const rev = att * TICKET;
  //   S.club_cash = (S.club_cash|0) + rev;
  //   log(`Attendance: ${att.toLocaleString('en-GB')} (St Mary's). Gate Revenue: £${rev.toLocaleString('en-GB')}.`);
  // }

  // Fan morale delta: Win +3 / Loss −5 / Draw +1
  let delta = 0;
  if (gf > ga) delta =  3;
  else if (gf < ga) delta = -5;
  else delta = 1;
  S.fan_morale = Math.max(0, Math.min(100, (S.fan_morale|0) + delta));

  // HUD refresh
  if (typeof updateHUD === 'function') updateHUD();
})();

  // 4) Update league table and UI
  if (typeof applyResultToTable === 'function') {
    applyResultToTable(teamKeyClub(), oppName, gf, ga);
  }
  if (typeof renderLeagueTablePanel === 'function') {
    renderLeagueTablePanel();
  }
  
  // 4.5) Apply family effects and update family stats
  applyFamilyEffects();
  updateFamilyStatsAfterMatch();

  // 5) Settle any active bet
  if (typeof resolveActiveBet === 'function') {
    resolveActiveBet(resultKey);
  }

  // 6) Advance the week HERE (single source of truth)
  S.matches_played = (S.matches_played || 0) + 1;
  // Note: If prison/rehab gets set after this point, the prison/rehab loop will detect
  // that matches_played was just incremented and won't increment it again on first iteration
  
  // Season 5: mandatory press conference after match 2 (matches_played === 1 after increment)
  // This ensures it happens after the kidnapping sequence from match 1
  if (S.season === 5 && S.season5 && S.matches_played === 1 && S.season5.kidnapping_sequence_shown && !S.season5.kidnapping_press_done) {
    if (typeof window.conductKidnappingPressConference === 'function') {
      await window.conductKidnappingPressConference();
    } else if (typeof conductKidnappingPressConference === 'function') {
      await conductKidnappingPressConference();
    } else {
      console.warn('conductKidnappingPressConference function not found');
    }
    S.season5.kidnapping_press_done = true;
  }
  
  // Stadium construction progression
  // Ensure stadium system is initialized before advancing construction
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
      stadium_loan: null,
      last_home_attendance: 0,
      utilization_percent: 0
    };
  }
  advanceStadiumConstruction();
  
  // Reduce video cooldown after each match
  if (S.videoCooldown && S.videoCooldown > 0) {
    S.videoCooldown = Math.max(0, S.videoCooldown - 1);
  }

  // (optional) track recent form if you use it elsewhere
  if (!Array.isArray(S.recent_form)) S.recent_form = [];
  const formTag = (gf > ga) ? 'W' : (ga > gf ? 'L' : 'D');
  S.recent_form.push(formTag);
  if (S.recent_form.length > 5) S.recent_form.shift();

  // 7) Simulate other fixtures for THIS round
  if (typeof simulateOtherMatchesForRound === 'function') {
    simulateOtherMatchesForRound(roundIndex);
  }

  // 8) Generate news and manager confrontation for invective system
  const fanReactionNews = generateFanReactionNews();
  if (fanReactionNews) {
    // Add to news system (integrate with existing news)
    if (!S.press) S.press = { published: [], queue: [] };
    if (!Array.isArray(S.press.queue)) S.press.queue = [];
    S.press.queue.push({
      title: fanReactionNews.title,
      body: fanReactionNews.body,
      section: 'match_reports',
      priority: 1
    });
  }
  
  // Trigger manager confrontation if there were shouts
  await triggerManagerConfrontation();
  
  // 9) Reset one-shot pre-match flags and clear context
  S.preMatch = null;
  S.visitors_handled = false;
  S.visited_ownLocker = false;
  S.visited_oppLocker = false;
  S.spoke_to_team_this_prematch = false;
  // Note: S.managerConfronted is reset inside triggerManagerConfrontation after completion
  clearSessionShouts(); // Clear shouts for next match
  S.matchContext = null;
// one-match bribe flags
S.referee_bribed = false;
S.referee_assaulted = false;
S.opponent_bribed = false;

  // 9) Refresh UI and persist (delayed to avoid interfering with choices)
  setTimeout(() => {
    if (typeof render === 'function') render();
    if (typeof updateHUD === 'function') updateHUD();
    saveGame();
  }, 100);
  
}

function clearOverlaysForEvening() {
  try {
    if (typeof document === 'undefined') return;
    
    // Close any modern modal overlays
    document.querySelectorAll('.modern-modal-overlay').forEach(el => el.remove());
    
    // Close dialogue popups (nightclub, investigations, etc.)
    document.querySelectorAll('.dialogue-popup-overlay').forEach(el => el.remove());
    
    // Close news-style overlays
    document.querySelectorAll('.news-popup-overlay').forEach(el => el.remove());
    
    // Close phone text overlays via helper if available, otherwise remove DOM nodes
    if (typeof closePhoneTextPopup === 'function') {
      try { closePhoneTextPopup(); } catch (_) {}
    } else {
      document.querySelectorAll('.phone-text-overlay').forEach(el => el.remove());
    }
    
    // Safety: remove any stray quick-sim overlays
    document.querySelectorAll('.quick-sim-overlay').forEach(el => el.remove());
  } catch (e) {
    console.error('clearOverlaysForEvening error:', e);
  }
}

async function eveningPhase(){
  setPhase('evening');
  try {
    // Ensure no stale overlays are blocking input before showing evening choices
    clearOverlaysForEvening();
    
    // Safety net: if the Portsmouth bus-crash press conference is still pending
    // for any reason after the match, force it to run at the very start of evening.
    const busCrashPressConf =
      (typeof window !== 'undefined' && typeof window.handlePressConferenceAfterBusCrash === 'function')
        ? window.handlePressConferenceAfterBusCrash
        : null;
    if (S?.pending_press_conference_after_match && busCrashPressConf) {
      S.pending_press_conference_after_match = false;
      await busCrashPressConf();
    }
    
    // Safety net: Season 5 kidnapping press conference after match 2
    // This is a backup in case it didn't trigger in postMatchPhase
    if (S.season === 5 && S.season5 && S.matches_played === 1 && S.season5.kidnapping_sequence_shown && !S.season5.kidnapping_press_done) {
      if (typeof window.conductKidnappingPressConference === 'function') {
        await window.conductKidnappingPressConference();
      } else if (typeof conductKidnappingPressConference === 'function') {
        await conductKidnappingPressConference();
      } else {
        console.warn('conductKidnappingPressConference function not found');
      }
      S.season5.kidnapping_press_done = true;
    }
    
    await callIf('maybeEveningEvent');
    
    // Check if movie has been released
    await checkMovieRelease();
    
    await callIf('tickPregnanciesAfterMatch');
    
    await processAffairs();
    
    await processWorldEvents();
    
    // Check for family events and outcomes
    checkFamilyEvents();
    
    // Check if next match is against Portsmouth - trigger special event
    await checkPortsmouthSpecialEvent();
    
    // Add cronster surveillance options in evening phase if cameras are installed
    // Hallway surveillance disappears when cronster is defeated, secret zone can only be watched once
    if (S.cronster && S.cronster.active && !S.cronster.defeated && S.womens_team && !S.womens_team.liquidated) {
      const surveillanceActions = [];
      if (S.cronster.cameras_hallways) {
        surveillanceActions.push({ key: 'watch_hallways_evening', label: 'Watch surveillance footage of the hallways' });
      }
      if (S.cronster.cameras_secret_zone && !S.cronster.secret_zone_watched) {
        surveillanceActions.push({ key: 'watch_secret_evening', label: 'Watch surveillance footage from the womens toilets', variant: 'warn' });
      }
      
      if (surveillanceActions.length > 0) {
        surveillanceActions.push({ key: 'skip_surveillance', label: 'Skip (continue)' });
        const surveillanceChoice = await choose(surveillanceActions, 'Evening: Surveillance Options');
        
        if (surveillanceChoice === 'watch_hallways_evening') {
          await watchSurveillanceFootage('hallways');
        } else if (surveillanceChoice === 'watch_secret_evening') {
          await watchSurveillanceFootage('secret_zone');
        }
      }
    }
  } catch (e) {
    console.error('eveningPhase error:', e);
    try {
      log('⚠️ An error occurred during the evening phase. Skipping remaining evening events so the season can continue.');
    } catch (_) {}
  } finally {
    await callIf('saveAuto');
  }
}

async function waitAdvance(label, hint){
  const msg = hint ? (label + "\n\n" + hint) : label;
  const k = await choose([{key:'go', label}], msg);
  return k;
}

async function callIf(name, ...args){
  const fn = (typeof name === "function") ? name : (typeof window[name] === "function" ? window[name] : null);
  if(!fn) return undefined;
  return await fn(...args);
}
function uniqueSample(arr, n){
  const out = [];
  const used = new Set();
  while(out.length < Math.min(n, arr.length)){
    const v = arr[Math.floor(Math.random()*arr.length)];
    if(!used.has(v)){ used.add(v); out.push(v); }
  }
  return out;
}



async function choosePlayerName(){
  if (S.player_firstname && S.player_surname) {
    return; // Name already chosen
  }
  
  // Set context to prevent cocaine buttons during name selection
  setPhase('name_selection');
  
  const firsts = uniqueSample(MALE_NAMES, 9);
  const firstOpts = firsts.map((nm,i)=>({key:String(i+1), label:nm}));
  const fk = await choose(firstOpts, "Pick your forename:");
  const firstname = firsts[parseInt(fk,10)-1];

  const lasts = uniqueSample(SURNAMES, 9);
  const lastOpts = lasts.map((sn,i)=>({key:String(i+1), label:sn}));
  const lk = await choose(lastOpts, "Pick your surname:");
  const surname = lasts[parseInt(lk,10)-1];

  S.player_firstname = firstname;
  S.player_surname = surname;
  S.full_name = firstname + " " + surname;
updatePageTitle();
const title = document.getElementById("hudTitle");
if (title) {
  title.textContent = `${S.player_firstname} ${S.player_surname} — Chairman of ${getClubName()}`;
}

  ensureFamilyNames();
  
  // Reset context after name selection is complete
  setPhase('boot');
}

function fmtGBP(n){ n = Math.floor(n||0); return "£" + n.toLocaleString(); }
function hudSet(id, val){ const el = document.getElementById(id); if(el) el.textContent = val; }

// Public updateHUD(): redraws the HUD then emits 'hud' so systems can add their pills.
function updateHUD(){
  const ret = renderHUD.apply(this, arguments);
  GameHooks.emit('hud');
  return ret;
}

function renderHUD(){
  if (!S) return;  // hard guard so we never read properties of null

  // Sync S.points, S.wins, S.draws, S.losses with league table (if table exists) to ensure consistency
  // Use getClubName() to ensure we get the correct club name (handles renaming like McDonalds FC)
  const clubName = (typeof getClubName === 'function') ? getClubName() : (S.club_name || "Southampton FC");
  if (S.table && S.table[clubName]) {
    const tableEntry = S.table[clubName];
    if (typeof tableEntry.PTS === 'number') {
      S.points = tableEntry.PTS;
    }
    if (typeof tableEntry.W === 'number') {
      S.wins = tableEntry.W;
    }
    if (typeof tableEntry.D === 'number') {
      S.draws = tableEntry.D;
    }
    if (typeof tableEntry.L === 'number') {
      S.losses = tableEntry.L;
    }
  } else {
  }

  const cc  = S.club_cash || 0;
  const ch  = S.chairman_cash || 0;

  // READ club debt from the unified field; fall back to legacy if needed
  const dc  = (typeof S.club_debt === 'number') ? S.club_debt : (S.debt_club | 0);

  // (optional) keep a similar bridge for personal debt if you ever rename it
  const dp  = (typeof S.debt_personal === 'number') ? S.debt_personal : (S.personal_debt | 0);

  const gp  = S.matches_played || 0;
  const sm  = S.season_matches || 16;
  const w   = S.wins || 0, d = S.draws || 0, l = S.losses || 0;
  const pts = (S.points || ((w*3) + d)) - (S.points_deducted || 0);

  hudSet("hudClubCash",  fmtGBP(cc));
  hudSet("hudChairCash", fmtGBP(ch));
  // Combined debt: club + personal
  const totalDebt = dc + dp;
  const debtElement = document.getElementById("hudTotalDebt");
  if (debtElement) {
    debtElement.textContent = fmtGBP(totalDebt);
    // Add tooltip showing breakdown
    debtElement.title = `Club Debt: ${fmtGBP(dc)}\nPersonal Debt: ${fmtGBP(dp)}\nTotal: ${fmtGBP(totalDebt)}\n${totalDebt > 0 ? 'Click to pay off debt' : ''}`;
    // Make clickable when there's debt - make parent container clickable too
    const debtContainer = debtElement.closest('.hitem');
    if (totalDebt > 0) {
      debtElement.style.cursor = 'pointer';
      debtElement.style.textDecoration = 'underline';
      debtElement.onclick = () => openDebtPaymentModal();
      if (debtContainer) {
        debtContainer.style.cursor = 'pointer';
        debtContainer.onclick = () => openDebtPaymentModal();
      }
    } else {
      debtElement.style.cursor = 'default';
      debtElement.style.textDecoration = 'none';
      debtElement.onclick = null;
      if (debtContainer) {
        debtContainer.style.cursor = 'default';
        debtContainer.onclick = null;
      }
    }
  } else {
    hudSet("hudTotalDebt", fmtGBP(totalDebt));
  }
  hudSet("hudGames",     gp + "/" + sm);
  hudSet("hudRecord",    "W"+w+" D"+d+" L"+l);
  hudSet("hudPoints",    String(pts));
  
  // Display season (1-5)
  const currentSeason = S.season || 1;
  hudSet("hudSeason", String(currentSeason));
  
  // Display fan morale (most active morale system)
  const fanMorale = S.fan_morale || 50;
  hudSet("hudMorale", fanMorale + "%");
  
  // Display lobby tokens
  const lobbyTokens = S.lobby_tokens || 0;
  hudSet("hudLobbyTokens", String(lobbyTokens));
  
  // Display Kreplin gems
  const kreplinGems = S.kreplin_gems || 0;
  hudSet("hudKreplinGem", `${kreplinGems}/4`);
  
  // Update HUD title with club name
  const hudTitleEl = document.getElementById('hudTitle');
  if (hudTitleEl) {
    hudTitleEl.textContent = getClubName() + " Chairman Sim";
  }

  updatePageTitle();
}

function updatePageTitle() {
  // Fallbacks so the title never blanks even during early setup
  const club = getClubName();
  const chair = S?.chairman_name || "";
  const titleEl = document.getElementById('PageTitle');
  if (titleEl) {
    titleEl.textContent = chair
      ? `${chair} — ${club} (v12)`
      : `Southampton Chairman Sim — Web Edition (v12)`;
  }
}

async function showPersonalSummary(){
  ensureFamilyNames();
  const marriedTxt = S.married===false ? "Separated/Divorced" : "Married";
  const lines = [
    "Status: " + marriedTxt,
    "Wife: " + S.wife_name,
    "Children: " + S.child1_name + " and " + S.child2_name,
    "Household: " + (S.kids_count||2) + " child" + ((S.kids_count||2)===1?"":"ren") + ", " + (S.wives_count||1) + " wife" + ((S.wives_count||1)===1?"":"s")
  ];
  log("Personal summary — " + lines.join(" | "));
}

// Get current league position
function getCurrentLeaguePosition() {
  ensureLeagueTableInit();
  const destroyed = S.destroyedTeams || [];
  // Get list of old team names that have been rebranded (keys in clubs_taken_over)
  const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
  const clubName = S.club_name || "Southampton FC";
  
  // For season 4 & 5, filter to only show valid teams (opponents + Southampton)
  let validTeams = null;
  if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
    validTeams = new Set([clubName, ...S.opponents]);
  }
  
  const rows = Object.entries(S.table)
    .filter(([team]) => {
      // For season 4 & 5, only use validTeams filtering (don't use destroyed array)
      // because teams might be "reborn" or re-included in the league
      if ((S.season === 4 || S.season === 5) && validTeams) {
        // Filter out old team names that have been taken over
        if (rebrandedTeams.includes(team)) return false;
        // Only show valid teams (opponents + Southampton + taken-over teams with new names)
        if (!validTeams.has(team)) return false;
        return true;
      }
      
      // For other seasons, use standard filtering
      // Filter out destroyed teams
      if (destroyed.includes(team)) return false;
      // Filter out old team names that have been taken over
      if (rebrandedTeams.includes(team)) return false;
      return true;
    })
    .map(([team, r]) => {
      const GD = (r.GF - r.GA);
      const isSouthampton = team === clubName;
      // For Southampton, calculate effective points (PTS - points_deducted) for sorting
      const effectivePTS = isSouthampton ? (r.PTS || 0) - (S.points_deducted || 0) : (r.PTS || 0);
      return { team, ...r, GD, effectivePTS };
    });

  // Sort: effective PTS desc (for Southampton), raw PTS desc (for others), GD desc, GF desc, team asc
  rows.sort((a,b)=>{
    // Use effective points for sorting (Southampton uses effective, others use raw)
    const aPTS = a.effectivePTS;
    const bPTS = b.effectivePTS;
    if (bPTS!==aPTS) return bPTS-aPTS;
    if (b.GD!==a.GD)   return b.GD-a.GD;
    if (b.GF!==a.GF)   return b.GF-a.GF;
    return a.team.localeCompare(b.team);
  });

  const southamptonIndex = rows.findIndex(r => r.team === clubName);
  return southamptonIndex >= 0 ? (southamptonIndex + 1) : 99; // 1-based position
}

// Show clean position summary in log
function showLeaguePosition() {
  const position = getCurrentLeaguePosition();
  const destroyed = S.destroyedTeams || [];
  // Get list of old team names that have been rebranded (keys in clubs_taken_over)
  const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
  const clubName = S.club_name || "Southampton FC";
  
  // Ensure Southampton's table entry exists before trying to access it
  ensureTableTeam(clubName);
  ensureLeagueTableInit();
  
  // For season 4 & 5, count only valid teams (opponents + Southampton)
  let totalTeams;
  if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
    const validTeams = new Set([clubName, ...S.opponents]);
    // Also include teams that were taken over (their new names)
    if (S.season4 && S.season4.clubs_taken_over) {
      Object.values(S.season4.clubs_taken_over).forEach(newName => validTeams.add(newName));
    }
    // For Season 4 & 5, don't check destroyed array - only check rebranded and validTeams
    totalTeams = Object.keys(S.table).filter(team => 
      !rebrandedTeams.includes(team) && 
      validTeams.has(team)
    ).length;
  } else {
    totalTeams = Object.keys(S.table).filter(team => !destroyed.includes(team) && !rebrandedTeams.includes(team)).length;
  }
  const southamptonData = S.table[clubName];
  
  // If still missing after ensureTableTeam, create it with default values
  if (!southamptonData) {
    console.warn(`Southampton table entry missing for ${clubName}, creating default entry`);
    if (!S.table) S.table = {};
    S.table[clubName] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
    // Use the newly created entry
    const newData = S.table[clubName];
    const GD = newData.GF - newData.GA;
    const positionText = `${position}${getOrdinalSuffix(position)} of ${totalTeams}`;
    log(`📊 League Position: ${positionText} | P:${newData.P} W:${newData.W} D:${newData.D} L:${newData.L} GD:${GD} PTS:${newData.PTS} <button onclick="showLeagueTablePopup()" style="background:var(--accent);color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.8rem;cursor:pointer;margin-left:8px;">View Full Table</button>`);
    return;
  }
  
  // Ensure all properties exist with defaults to prevent NaN/undefined
  const P = southamptonData.P || 0;
  const W = southamptonData.W || 0;
  const D = southamptonData.D || 0;
  const L = southamptonData.L || 0;
  const GF = southamptonData.GF || 0;
  const GA = southamptonData.GA || 0;
  const PTS = southamptonData.PTS || 0;
  const GD = GF - GA;
  const positionText = `${position}${getOrdinalSuffix(position)} of ${totalTeams}`;
  
  log(`📊 League Position: ${positionText} | P:${P} W:${W} D:${D} L:${L} GD:${GD} PTS:${PTS} <button onclick="showLeagueTablePopup()" style="background:var(--accent);color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.8rem;cursor:pointer;margin-left:8px;">View Full Table</button>`);
}

// Helper function for ordinal suffixes
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

// Show league table in popup modal
function showLeagueTablePopup() {
  ensureLeagueTableInit();
  const destroyed = S.destroyedTeams || [];
  // Get list of old team names that have been rebranded (keys in clubs_taken_over)
  const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
  const clubName = S.club_name || "Southampton FC";
  
  // DEBUG: Log state before filtering
  
  // For season 4 & 5, filter to only show valid teams (opponents + Southampton)
  let validTeams = null;
  if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
    validTeams = new Set([clubName, ...S.opponents]);
    // CRITICAL: Also include teams that were taken over (their new names)
    // This ensures all valid teams are included even if S.opponents hasn't been fully updated
    if (S.season4 && S.season4.clubs_taken_over) {
      Object.values(S.season4.clubs_taken_over).forEach(newName => validTeams.add(newName));
    }
  }
  
  const rows = Object.entries(S.table)
    .filter(([team]) => {
      // For season 4 & 5, only use validTeams filtering (don't use destroyed array)
      // because teams might be "reborn" or re-included in the league
      if ((S.season === 4 || S.season === 5) && validTeams) {
        // Filter out old team names that have been taken over
        if (rebrandedTeams.includes(team)) {
          return false;
        }
        // Only show valid teams (opponents + Southampton + taken-over teams with new names)
        if (!validTeams.has(team)) {
          return false;
        }
        return true;
      }
      
      // For other seasons, use standard filtering
      // Filter out destroyed teams
      if (destroyed.includes(team)) {
        return false;
      }
      // Filter out old team names that have been taken over
      if (rebrandedTeams.includes(team)) {
        return false;
      }
      return true;
    })
    .map(([team, r]) => {
      const GD = (r.GF - r.GA);
      const isSouthampton = team === clubName;
      // For Southampton, calculate effective points (PTS - points_deducted)
      const effectivePTS = isSouthampton ? (r.PTS || 0) - (S.points_deducted || 0) : (r.PTS || 0);
      return { team, ...r, GD, effectivePTS };
    });


  // Sort: effective PTS desc (for Southampton), raw PTS desc (for others), GD desc, GF desc, team asc
  rows.sort((a,b)=>{
    const aPTS = a.effectivePTS;
    const bPTS = b.effectivePTS;
    if (bPTS!==aPTS) return bPTS-aPTS;
    if (b.GD!==a.GD)   return b.GD-a.GD;
    if (b.GF!==a.GF)   return b.GF-a.GF;
    return a.team.localeCompare(b.team);
  });

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'league-modal';
  modal.innerHTML = `
    <div class="league-modal-content">
      <div class="league-modal-header">
        <h2 class="league-modal-title">🏆 League Table</h2>
        <button class="league-modal-close" onclick="closeLeagueTablePopup()">Close</button>
      </div>
      <table class="league-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const isSouthampton = r.team === clubName;
            const displayPTS = isSouthampton ? r.effectivePTS : r.PTS;
            return `
            <tr class="${isSouthampton ? 'southampton-row' : ''}">
              <td>${i + 1}</td>
              <td>${r.team}</td>
              <td>${r.P}</td>
              <td>${r.W}</td>
              <td>${r.D}</td>
              <td>${r.L}</td>
              <td>${r.GF}</td>
              <td>${r.GA}</td>
              <td>${r.GD}</td>
              <td>${displayPTS}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeLeagueTablePopup();
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeLeagueTablePopup();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}





function takePersonalLoan(amount){
  S.debt_personal = (S.debt_personal||0) + Math.max(0, amount);
  addMoneyPersonal(amount);
  log('You take a personal loan of £' + amount.toLocaleString() + '.');
}
function takeClubLoan(amount){
  S.debt_club = (S.debt_club||0) + Math.max(0, amount);
  addMoneyClub(amount);
  log('Club takes on a loan of £' + amount.toLocaleString() + '.');
}


async function tickPregnanciesAfterMatch(){
  // Count down to birth, then handle arrivals
  const remaining = [];
  for(const b of (S.pending_births||[])){
    b.due_in = (b.due_in||0) - 1;
    if(b.due_in <= 0){
      await handleBirth(b);
    } else {
      remaining.push(b);
    }
  }
  S.pending_births = remaining;

  // Process delayed pregnancy events
  const remainingPregnancies = [];
  for(const p of (S.pending_pregnancies||[])){
    p.matches_until = (p.matches_until||0) - 1;
    if(p.matches_until <= 0){
      await handleDelayedPregnancy(p);
    } else {
      remainingPregnancies.push(p);
    }
  }
  S.pending_pregnancies = remainingPregnancies;

  // Process delayed female STD events
  const remainingFemaleStd = [];
  for(const s of (S.pending_female_std||[])){
    s.matches_until = (s.matches_until||0) - 1;
    if(s.matches_until <= 0){
      await handleDelayedFemaleStd(s);
    } else {
      remainingFemaleStd.push(s);
    }
  }
  S.pending_female_std = remainingFemaleStd;

  // Process delayed male STD events
  const remainingMaleStd = [];
  for(const s of (S.pending_male_std||[])){
    s.matches_until = (s.matches_until||0) - 1;
    if(s.matches_until <= 0){
      await handleDelayedMaleStd(s);
    } else {
      remainingMaleStd.push(s);
    }
  }
  S.pending_male_std = remainingMaleStd;

  // Process delayed male blackmail events
  const remainingBlackmail = [];
  for(const b of (S.pending_male_blackmail||[])){
    b.matches_until = (b.matches_until||0) - 1;
    if(b.matches_until <= 0){
      await handleDelayedMaleBlackmail(b);
    } else {
      remainingBlackmail.push(b);
    }
  }
  S.pending_male_blackmail = remainingBlackmail;

  // Process very bad STD progression
  if(S.very_bad_std_state === 'infected'){
    S.very_bad_std_matches = (S.very_bad_std_matches||0) + 1;
    
    // Offer treatment opportunity each match cycle
    if(S.very_bad_std_last_treatment_match !== S.matches_played){
      await offerVeryBadStdTreatment();
    }
    
    if(S.very_bad_std_matches >= 4){
      // Death failstate
      log('The very bad STD has progressed too far. You die from complications.');
      S.game_over = true;
      S.game_over_reason = 'Died from untreated very bad STD';
    }
  }
  
  // Process regular STD progression - offer treatment each match cycle
  if(S.std_state === 'untreated' && S.std_last_treatment_match !== S.matches_played){
    await offerStdTreatment();
  }

  // Process partner deaths from very bad STD
  const remainingDeaths = [];
  for(const d of (S.pending_partner_death||[])){
    d.matches_until = (d.matches_until||0) - 1;
    if(d.matches_until <= 0){
      await handlePartnerDeath(d);
    } else {
      remainingDeaths.push(d);
    }
  }
  S.pending_partner_death = remainingDeaths;

  // Process blackmail scandal events
  const remainingScandals = [];
  for(const s of (S.pending_blackmail_scandal||[])){
    s.matches_until = (s.matches_until||0) - 1;
    if(s.matches_until <= 0){
      await handleBlackmailScandal(s);
    } else {
      remainingScandals.push(s);
    }
  }
  S.pending_blackmail_scandal = remainingScandals;

  // Process delayed female blackmail events
  const remainingFemaleBlackmail = [];
  for(const b of (S.pending_female_blackmail||[])){
    b.matches_until = (b.matches_until||0) - 1;
    if(b.matches_until <= 0){
      await handleDelayedFemaleBlackmail(b);
    } else {
      remainingFemaleBlackmail.push(b);
    }
  }
  S.pending_female_blackmail = remainingFemaleBlackmail;

  // Process delayed protection blackmail events
  const remainingProtectionBlackmail = [];
  for(const b of (S.pending_protection_blackmail||[])){
    b.matches_until = (b.matches_until||0) - 1;
    if(b.matches_until <= 0){
      await handleDelayedProtectionBlackmail(b);
    } else {
      remainingProtectionBlackmail.push(b);
    }
  }
  S.pending_protection_blackmail = remainingProtectionBlackmail;

  // Process bedroom habits gossip stories
  const remainingBedroomGossip = [];
  for(const g of (S.pending_bedroom_gossip||[])){
    g.matches_until = (g.matches_until||0) - 1;
    if(g.matches_until <= 0){
      await handleBedroomHabitsGossip(g);
    } else {
      remainingBedroomGossip.push(g);
    }
  }
  S.pending_bedroom_gossip = remainingBedroomGossip;

  // Process protection gossip stories
  const remainingProtectionGossip = [];
  for(const g of (S.pending_protection_gossip||[])){
    g.matches_until = (g.matches_until||0) - 1;
    if(g.matches_until <= 0){
      await handleProtectionGossip(g);
    } else {
      remainingProtectionGossip.push(g);
    }
  }
  S.pending_protection_gossip = remainingProtectionGossip;

  // Ongoing special-care costs (if any)
  if((S.baby_care_weekly||0) > 0){
    const cost = S.baby_care_weekly;
    S.chairman_cash = Math.max(0, (S.chairman_cash||0) - cost);
    log('Paid special baby care: £' + cost.toLocaleString());
  }
}

// Affairs / blackmail processing – runs on the same post-match / weekly tick as other fallout
async function processAffairs() {
  ensureAffairState();
  if (!activeAffairs || !activeAffairs.length) return;

  const currentWeek = S.matches_played | 0;

  for (const affair of activeAffairs) {
    if (!affair) continue;
    if (affair.resolved || affair.hasGonePublic) continue;
    if (typeof affair.nextEventWeek !== 'number') continue;
    if (currentWeek < affair.nextEventWeek) continue;

    if (!affair.blackmailActive) {
      await startBlackmail(affair);
    } else if (affair.demandType === 'weekly') {
      await escalateBlackmail(affair);
    }
  }
}

async function handleBirth(b){
  // Choose a baby name (4 options)
  const pool = [pick(MALE_NAMES), pick(FEMALE_NAMES), pick(FEMALE_NAMES), pick(MALE_NAMES)];
  const opts = pool.map((nm,i)=>({key:String(i+1), label:nm}));
  const k = await choose(opts, (b.mother_type==='wife' ? 'Your wife is in labour.' : (b.mother_name||'She') + ' is in labour.') + ' Choose a baby name:');
  const chosen = pool[parseInt(k,10)-1] + ' ' + pick(SURNAMES);

  // Add child and announce
  S.kids_count = (S.kids_count||2) + 1;
  log('Baby born: ' + chosen + '. You now have ' + S.kids_count + ' child' + (S.kids_count===1?'':'ren') + '.');
  
  // Award lobby tokens for new child (highest amount)
  addLobbyTokens(50, 'having a new child');

  // Extra-help baby path (addicted mother at conception)
  if(b.extra_help){
    const upfront = 50000;         // hospital/neonatal upfront
    const weekly  = 2000;          // ongoing special care
    S.chairman_cash = Math.max(0, (S.chairman_cash||0) - upfront);
    S.baby_care_weekly = (S.baby_care_weekly||0) + weekly;
    addPaper('Baby requiring special care born', 12);
    log('Neonatal costs: -£' + upfront.toLocaleString() + ' upfront, plus £' + weekly.toLocaleString() + '/match for special care.');
  }
}

async function handleDelayedPregnancy(p){
  S.pregnancies += 1;
  
  // Add chairman points for pregnancy detection
  if (typeof addChairmanPointsImmediate === 'function') {
    addChairmanPointsImmediate(15, 'pregnancy');
  }
  
  // Trigger pregnancy achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'got_someone_pregnant')) {
    const achievement = {
      id: 'got_someone_pregnant',
      title: 'Got Someone Pregnant',
      description: 'Got someone pregnant',
      icon: '🤰'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
  }
  
  log(p.partner_name + ' informs you that you have impregnated her.');
  const pr = await choose(
    [
      {key:'resolve', label:'Pay for abortion (£200k)', variant:'warn'},
      {key:'hush',    label:'Pay for her silence (£500k)', variant:'warn'},
      {key:'keep',    label:'Keep the baby (name it)'},
      {key:'propose', label:'Propose marriage', variant:'bad'}
    ],
    'Pregnancy fallout:'
  );

  if(pr==='resolve'){ S.chairman_cash = Math.max(0,(S.chairman_cash||0)-200000); }
  if(pr==='keep'){
    const due = 2 + Math.floor(Math.random()*3); // 2–4 matches
    (S.pending_births = S.pending_births || []).push({
      mother_type:'lover',
      mother_name:p.partner_name||'She',
      due_in: due,
      extra_help: false
    });
    log('She decides to keep the baby. Birth expected in a few matches.');
    // Add chairman points for pregnancy (keeping the baby)
    addChairmanPointsImmediate(15, 'pregnancy');
  }
  if(pr==='hush'){   S.chairman_cash = Math.max(0,(S.chairman_cash||0)-500000); S.hush_money_paid += 1; }
  if(pr==='propose'){
    if(!S.married){ S.married = true; }
    S.wives_count = (S.wives_count||1) + 1;
    S.wife_name = p.partner_name && p.partner_name.trim() ? p.partner_name : (pick(FEMALE_NAMES) + " " + pick(SURNAMES));
    S.reputation = clamp((S.reputation||50) - 10, 0, 100);
    log("She says yes. You now have " + S.wives_count + " wife" + (S.wives_count===1?"":"s") + " - hopefully your other wife doesn't find out.");
    // Add chairman points for marriage
    addChairmanPointsImmediate(25, 'marriage');
    // Award lobby tokens for new wife (highest amount)
    addLobbyTokens(50, 'having a new wife');
  }
}

async function handleDelayedFemaleStd(s){
  log('You are experiencing unpleasant private symptoms. You appear to have contracted an STD from ' + s.partner_name + '.');
  
  // Trigger STD achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'got_std')) {
    const achievement = {
      id: 'got_std',
      title: 'Got an STD',
      description: 'Got an STD',
      icon: '🦠'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
  }
  
  const st = await choose(
    [
      {key:'treat', label:'Private treatment (£8k)'},
      {key:'ignore',label:'Leave untreated', variant:'bad'}
    ],
    'STD response:'
  );
  if(st==='treat'){
    S.chairman_cash = Math.max(0,(S.chairman_cash||0)-8000);
    S.std_state = "treated";
    S.std_treatment_attempts = 0;
    S.std_last_treatment_match = S.matches_played;
    log('Discreet treatment clears it up.');
  } else {
    S.std_state = "untreated";
    S.std_treatment_attempts = 0;
    S.std_last_treatment_match = S.matches_played;
    S.morale = clamp((S.morale||0) - 8, -100, 100);
    S.reputation = clamp((S.reputation||50) - 6, 0, 100);
    // Award lobby tokens for getting STD
    addLobbyTokens(20, 'getting STD');
  }
}

// Offer STD treatment each match cycle
async function offerStdTreatment(){
  S.std_treatment_attempts = (S.std_treatment_attempts || 0) + 1;
  const basePrice = 8000;
  const price = basePrice * Math.pow(1.5, S.std_treatment_attempts - 1);
  
  log(`Your symptoms are worsening... ruh roh. You have another opportunity to seek treatment.`);
  
  const st = await choose(
    [
      {key:'treat', label:`Private treatment (£${Math.round(price).toLocaleString()})`},
      {key:'ignore',label:'Leave untreated', variant:'bad'}
    ],
    'STD treatment opportunity:'
  );
  
  if(st==='treat'){
    S.chairman_cash = Math.max(0,(S.chairman_cash||0)-price);
    S.std_state = "treated";
    S.std_treatment_attempts = 0;
    S.std_last_treatment_match = S.matches_played;
    log('Discreet treatment clears it up.');
  } else {
    S.std_last_treatment_match = S.matches_played;
    S.morale = clamp((S.morale||0) - 8, -100, 100);
    S.reputation = clamp((S.reputation||50) - 6, 0, 100);
    log('You decide to leave it untreated. The symptoms persist.');
  }
}

async function handleDelayedMaleStd(s){
  // Check if player contracted very bad STD
  if(Math.random() < 0.3){ // 30% chance
    log('You appear to have contracted a very bad STD from ' + s.partner_name + '.');
    S.very_bad_std_state = 'infected';
    S.very_bad_std_matches = 0;
    S.very_bad_std_treatment_attempts = 0;
    S.very_bad_std_last_treatment_match = S.matches_played;
    // Award lobby tokens for getting very bad STD
    addLobbyTokens(30, 'getting very bad STD');
    
    // Trigger HIV achievement
    if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'got_hiv')) {
      const achievement = {
        id: 'got_hiv',
        title: 'Got HIV',
        description: 'Got HIV (when you get a very bad STD)',
        icon: '🩸'
      };
      window.socialManager.showAchievement(achievement);
      window.socialManager.achievements.push(achievement);
    }
    
    const treat = await choose(
      [
        {key:'treat', label:'Pay for treatment (£1,000,000)', variant:'warn'},
        {key:'ignore',label:'Leave untreated', variant:'bad'}
      ],
      'Very bad STD treatment:'
    );
    
    if(treat==='treat'){
      S.chairman_cash = Math.max(0,(S.chairman_cash||0)-1000000);
      S.very_bad_std_state = 'treated';
      S.very_bad_std_treatment_attempts = 0;
      log('Expensive treatment clears it up. The NHS has been privatised, hence the cost.');
    } else {
      log('You decide to leave it untreated. This could be dangerous.');
    }
  }
}

// Offer very bad STD treatment each match cycle
async function offerVeryBadStdTreatment(){
  S.very_bad_std_treatment_attempts = (S.very_bad_std_treatment_attempts || 0) + 1;
  const basePrice = 1000000;
  const price = basePrice * Math.pow(2, S.very_bad_std_treatment_attempts - 1);
  
  const symptoms = [
    "Your symptoms are worsening... ruh roh. The infection is spreading.",
    "The very bad STD is progressing rapidly. Your condition deteriorates.",
    "You're experiencing severe complications. Time is running out.",
    "The infection has reached critical levels. You need immediate treatment."
  ];
  
  const symptomMessage = symptoms[Math.min(S.very_bad_std_treatment_attempts - 1, symptoms.length - 1)];
  log(symptomMessage);
  
  const treat = await choose(
    [
      {key:'treat', label:`Pay for treatment (£${Math.round(price).toLocaleString()})`, variant:'warn'},
      {key:'ignore',label:'Leave untreated', variant:'bad'}
    ],
    'Very bad STD treatment opportunity:'
  );
  
  if(treat==='treat'){
    S.chairman_cash = Math.max(0,(S.chairman_cash||0)-price);
    S.very_bad_std_state = 'treated';
    S.very_bad_std_treatment_attempts = 0;
    S.very_bad_std_last_treatment_match = S.matches_played;
    log('Expensive treatment clears it up. The NHS has been privatised, hence the cost.');
  } else {
    S.very_bad_std_last_treatment_match = S.matches_played;
    log('You decide to leave it untreated. The infection continues to spread.');
  }
}

async function handleDelayedMaleBlackmail(b){
  // Random chance for blackmail event
  if(Math.random() < 0.4){ // 40% chance
    log(b.partner_name + ' appears at your door. "I have photos and evidence of our encounter. Pay me £1,000,000 or I\'ll leak the story to the press."');
    
    const response = await choose(
      [
        {key:'pay', label:'Pay the blackmail (£1,000,000)', variant:'warn'},
        {key:'refuse', label:'Refuse to pay', variant:'bad'}
      ],
      'Blackmail response:'
    );
    
    if(response==='pay'){
      S.chairman_cash = Math.max(0,(S.chairman_cash||0)-1000000);
      log('You pay the blackmail. The scandal is averted.');
    } else {
      // Schedule negative press coverage for 1-2 matches later
      (S.pending_blackmail_scandal = S.pending_blackmail_scandal || []).push({
        matches_until: 1 + Math.floor(Math.random()*2) // 1-2 matches
      });
      log('You refuse to pay. ' + b.partner_name + ' leaves, threatening to go to the press.');
    }
  }
}

async function handlePartnerDeath(d){
  log(d.partner_name + ' has died from the very bad STD infection.');
  S.reputation = clamp((S.reputation||50) - 10, 0, 100);
  addPaper('Partner dies from mysterious illness', 20);
  
  // If it was the wife, handle divorce
  if(d.partner_type === 'female' && S.wife_name === d.partner_name){
    S.married = false;
    S.divorces = (S.divorces||0) + 1;
    S.wives_count = Math.max(0,(S.wives_count||1)-1);
    log('Your wife has died. You are now single.');
  }
}

async function handleBlackmailScandal(s){
  log('The blackmail story has been leaked to the press. Your reputation takes a massive hit.');
  S.reputation = clamp((S.reputation||50) - 20, 0, 100);
  addPaper('Chairman involved in homosexual scandal', 25);
  
  // Board anger
  S.board_anger = clamp((S.board_anger||0) + 15, 0, 100);
  
  // Sponsor withdrawal chance
  if(Math.random() < 0.6){
    S.sponsor_withdrawal = true;
    addPaper('Major sponsor withdraws over scandal', 18);
  }
}

// Handle delayed female blackmail after seduction
async function handleDelayedFemaleBlackmail(b){
  // Random chance for blackmail event (40% chance)
  if(Math.random() < 0.4){
    const partnerName = b.partner_name || 'Unknown woman';
    const blackmailAmount = Math.max(50000, Math.round((S.chairman_cash || 0) * (0.15 + Math.random() * 0.15))); // 15-30% of chairman cash
    
    log(`${partnerName} texts you: "I have photos and evidence of our encounter. Pay me £${blackmailAmount.toLocaleString()} or I'll leak the story to the press."`);
    
    const response = await choose(
      [
        {key:'pay', label:`Pay the blackmail (£${blackmailAmount.toLocaleString()})`, variant:'warn'},
        {key:'refuse', label:'Refuse to pay', variant:'bad'}
      ],
      'Blackmail response:'
    );
    
    if(response==='pay'){
      if((S.chairman_cash || 0) >= blackmailAmount){
        S.chairman_cash = Math.max(0,(S.chairman_cash||0)-blackmailAmount);
        log(`You pay the blackmail. The scandal is averted.`);
      } else {
        log(`You can't afford the blackmail. ${partnerName} goes to the press.`);
        // Schedule gossip story with bizarre bedroom habits
        (S.pending_bedroom_gossip = S.pending_bedroom_gossip || []).push({
          partner_name: partnerName,
          matches_until: 1 + Math.floor(Math.random()*2) // 1-2 matches
        });
      }
    } else {
      log(`You refuse to pay. ${partnerName} leaves, threatening to go to the press.`);
      // Schedule gossip story with bizarre bedroom habits
      (S.pending_bedroom_gossip = S.pending_bedroom_gossip || []).push({
        partner_name: partnerName,
        matches_until: 1 + Math.floor(Math.random()*2) // 1-2 matches
      });
    }
  }
}

// Handle delayed protection blackmail
async function handleDelayedProtectionBlackmail(b){
  // Random chance for blackmail event (50% chance - higher since it's about protection)
  if(Math.random() < 0.5){
    const partnerName = b.partner_name || 'Unknown woman';
    
    // Phone text popup
    window.S = window.S || {};
    S.isSecretarySessionActive = false;
    const overlay = createPhoneTextPopup(partnerName, 'Unknown number');
    addMessageToPhonePopup('Remember when you insisted on using protection?', false, 200);
    addMessageToPhonePopup('Real men don\'t wrap it, sweetheart.', false, 1200);
    addMessageToPhonePopup('I\'m going to expose you as not a real man. The press will love this.', false, 2000);
    
    log(`📱 ${partnerName} texts you threatening to expose you as "not a real man" for using protection.`);
    
    const response = await choose(
      [
        {key:'ignore', label:'Ignore the threat', variant:'bad'},
        {key:'apologize', label:'Apologize and hope she doesn\'t go public', variant:'warn'}
      ],
      'How do you respond?'
    );
    
    if(response==='ignore'){
      log(`You ignore the threat. ${partnerName} goes to the press.`);
      // Schedule gossip story about not being a real man
      (S.pending_protection_gossip = S.pending_protection_gossip || []).push({
        partner_name: partnerName,
        matches_until: 1 + Math.floor(Math.random()*2) // 1-2 matches
      });
    } else {
      // 60% chance she still goes public despite apology
      if(Math.random() < 0.6){
        log(`Your apology isn't enough. ${partnerName} goes to the press anyway.`);
        (S.pending_protection_gossip = S.pending_protection_gossip || []).push({
          partner_name: partnerName,
          matches_until: 1 + Math.floor(Math.random()*2) // 1-2 matches
        });
      } else {
        log(`${partnerName} accepts your apology. The threat is withdrawn.`);
      }
    }
  }
}

// Handle bedroom habits gossip story
async function handleBedroomHabitsGossip(g){
  const partnerName = g.partner_name || 'Unknown woman';
  const clubName = getClubName();
  
  // Funny passages about bizarre bedroom habits
  const bedroomHabitsPassages = [
    `Sources close to ${partnerName} have revealed shocking details about the ${clubName} chairman's bedroom behavior. According to the source, the chairman insisted on wearing a full football kit during intimate moments, complete with shin guards and cleats. "He kept shouting 'GOAL!' at the most inappropriate times," the source claimed.`,
    `A leaked account from ${partnerName} describes the ${clubName} chairman's unusual bedroom preferences. "He had me pretend to be a referee while he simulated VAR decisions," she revealed. "Every time I tried to leave, he'd blow a whistle and show me a yellow card. It was bizarre."`,
    `${partnerName} has gone public with details about the ${clubName} chairman's strange sexual habits. "He made me chant football songs while we were together," she told reporters. "He kept asking me to do the 'Poznan' celebration. I didn't even know what that was."`,
    `According to ${partnerName}, the ${clubName} chairman's bedroom antics included forcing her to read out transfer rumors while they were intimate. "He had a stack of tabloids next to the bed," she revealed. "He'd make me pause every few minutes to discuss whether a player was 'worth the fee.' It was the most unromantic experience of my life."`,
    `Sources reveal that the ${clubName} chairman insisted on ${partnerName} wearing a football manager's tracksuit during their encounters. "He kept checking his phone for match updates," she said. "At one point he stopped everything to check the half-time scores. I've never felt so unimportant."`,
    `${partnerName} has described the ${clubName} chairman's bedroom behavior as "deeply strange." According to her account, he made her pretend to be a football agent negotiating a contract. "He kept saying things like 'I'll give you a signing bonus' and 'What's your release clause?' It was mortifying."`,
    `The ${clubName} chairman's bizarre bedroom habits have been exposed by ${partnerName}. "He had me do a full pre-match warm-up routine before anything happened," she revealed. "Stretches, jogging on the spot, the works. Then he wanted me to do a post-match interview. I'm not making this up."`,
    `According to ${partnerName}, the ${clubName} chairman's sexual preferences included role-playing as a football commentator. "He kept narrating everything like he was on Match of the Day," she said. "'And here we see the chairman making a run into the box...' I couldn't take it seriously."`
  ];
  
  const selectedPassage = pick(bedroomHabitsPassages);
  
  // Generate gossip story
  if (typeof initPressSystem === 'function') initPressSystem();
  const story = createStory(
    'gossip',
    `${clubName} Chairman's Bizarre Bedroom Habits Exposed`,
    selectedPassage,
    { target: partnerName },
    { marital_risk: 15, reputation: -5 },
    'bedroom_habits',
    1,
    ['affair', 'bedroom_habits']
  );
  
  if (typeof queueStory === 'function') {
    queueStory(story);
  }
  
  log(`📰 A gossip story about your bizarre bedroom habits has been published in the Daily Krelmor.`);
}

// Handle protection gossip story
async function handleProtectionGossip(g){
  const partnerName = g.partner_name || 'Unknown woman';
  const clubName = getClubName();
  
  const protectionGossipPassages = [
    `${partnerName} has gone public with claims that the ${clubName} chairman is "not a real man" after he insisted on using protection during their encounter. "Real men don't wrap it," she told reporters. "I've never been so insulted. He's clearly insecure about his masculinity."`,
    `Sources reveal that ${partnerName} has exposed the ${clubName} chairman as "not a real man" for using protection. "He was so worried about safety that he couldn't perform," she claimed. "It's pathetic. A real man wouldn't need a condom to prove himself."`,
    `${partnerName} has published a scathing account of the ${clubName} chairman's "unmanly" behavior. "He insisted on protection like some kind of health and safety inspector," she said. "I've never met a man so afraid of living dangerously. It's embarrassing."`,
    `According to ${partnerName}, the ${clubName} chairman's insistence on using protection revealed his true character. "A real man doesn't need a safety net," she told the press. "He's clearly not confident in his abilities. It's a sign of weakness."`
  ];
  
  const selectedPassage = pick(protectionGossipPassages);
  
  // Generate gossip story
  if (typeof initPressSystem === 'function') initPressSystem();
  const story = createStory(
    'gossip',
    `${clubName} Chairman Exposed as "Not a Real Man"`,
    selectedPassage,
    { target: partnerName },
    { marital_risk: 10, reputation: -3 },
    'protection',
    1,
    ['affair', 'protection']
  );
  
  if (typeof queueStory === 'function') {
    queueStory(story);
  }
  
  log(`📰 A gossip story about you being "not a real man" has been published in the Daily Krelmor.`);
}

// REPLACE your existing wifeDemandEvent() with this complete version
async function wifeDemandEvent(){
  const amount = 2000 + Math.floor(Math.random()*5)*1000; // £2k–£6k

  // Make sure inventory exists for other flows that reference it
  if (!S.inventory) S.inventory = { accolades: [], drugs: 0 };

  const opts = [
    {key:'pay',     label:'Pay from personal funds (£'+amount.toLocaleString()+')'},
    {key:'embezzle',label:'Embezzle from club (£'+amount.toLocaleString()+')', variant:'warn'},
    {key:'loanp',   label:'Take a personal loan (£'+amount.toLocaleString()+')'},
    {key:'loanc',   label:'Take a club loan (£'+amount.toLocaleString()+')'},
    {key:'drugs',   label:'Give her drugs to shut her up', variant:'bad'},
    {key:'sex',     label:'Have sex with wife', variant:'sensual'}
  ];

  const k = await choose(opts, (S.wife_name||"Your wife") + ' demands money:');

  if (k === 'pay'){
    if((S.chairman_cash||0) >= amount){
      S.chairman_cash -= amount;
      S.wife_love    = clamp((S.wife_love||60) + 5, 0, 100);
      S.wife_respect = clamp((S.wife_respect||55) + 1, 0, 100);
      log('You pay from your own pocket.');
    } else {
      log('You lack the personal funds.');
    }
  }

  if (k === 'embezzle'){
    // Move money from club to personal, raise risk
    if ((S.club_cash||0) >= amount){
      S.club_cash     -= amount;
      S.chairman_cash  = (S.chairman_cash||0) + amount;
      log('You quietly siphon club funds and hand it over. (Risk +)');
      incrementRisk('embezzlement', 2);
      S.compliance_risk = (S.compliance_risk||0) + 1;
    } else {
      log('Club can’t cover it. Embezzlement failed.');
    }
  }

  if (k === 'loanp'){
    takePersonalLoan(amount);
  }

  if (k === 'loanc'){
    takeClubLoan(amount);
  }

  if (k === 'drugs'){
    if ((S.inventory?.drugs||0) > 0){
      S.inventory.drugs -= 1;
      log('You placate her with drugs. This won\'t end well. (Risk +)');
      incrementRisk('domestic_drugs', 1);
      // optional: relationship "calm"
      S.wife_love    = clamp((S.wife_love||60) + 1, 0, 100);
      S.wife_respect = clamp((S.wife_respect||55) - 3, 0, 100);
      // Add chairman points for taking drugs
      addChairmanPointsImmediate(3, 'taking drugs');
    } else {
      log('You have no drugs to give.');
    }
  }

  if (k === 'sex'){
    // simple relationship nudge and small pregnancy chance for future patches
    S.wife_love    = clamp((S.wife_love||60) + 2, 0, 100);
    S.wife_respect = clamp((S.wife_respect||55) + 1, 0, 100);
    log('You spend some time together. Things calm a little.');
    // Show floating outcome
    const outcome = pick(SEX_OUTCOMES);
    showFloatingSexOutcome(outcome);
    // Add chairman points for having sex
    if (typeof addChairmanPointsImmediate === 'function') {
      addChairmanPointsImmediate(2, 'having sex');
    }
    // If you later add pregnancy scheduling, hook it here.
  }
}



async function haveSexWithWife(){
  // Simple morale/relationship bump
  S.wife_love = clamp((S.wife_love||60) + 4, 0, 100);
  S.morale = clamp((S.morale||0) + 2, -100, 100);
  
  // Show floating outcome
  const outcome = pick(SEX_OUTCOMES);
  log('You spend the night together.');
  showFloatingSexOutcome(outcome);

  // STD spread if untreated
  maybeInfectPartner('wife');

  // Add chairman points for having sex
  addChairmanPointsImmediate(2, 'having sex');

  // Conception roll (about 25%)
  const conceiveP = 0.25;
  if(Math.random() < conceiveP){
    const due = 2 + Math.floor(Math.random()*3); // 2–4 matches
    const extraHelp = !!(S.wife_addicted || (S.wife_addiction||0) >= 60);
    (S.pending_births = S.pending_births || []).push({
      mother_type:'wife',
      mother_name:S.wife_name||'Your wife',
      due_in: due,
      extra_help: extraHelp
    });
    log('Later, a test is positive. A baby is due in a few matches.');
    // Add chairman points for pregnancy
    addChairmanPointsImmediate(15, 'pregnancy');
  }
}



function embezzleFromClub(amount){
  const can = Math.min(amount, Math.max(0,(S.club_cash||0)));
  S.club_cash = Math.max(0,(S.club_cash||0) - can);
  S.chairman_cash = Math.max(0,(S.chairman_cash||0) + can);
  S.compliance_risk = clamp((S.compliance_risk||0) + 6, 0, 100);
  S.legal_risk      = clamp((S.legal_risk||0) + 4, 0, 100);
  addPaper('Rumors swirl about irregular club expenditures', 10);
  log('You quietly re-route £' + can.toLocaleString() + ' from club to personal funds.');
}

function maybeInfectPartner(partner){
  // partner: 'wife' | 'lover'
  if(S.std_state === 'untreated'){
    if(partner === 'wife'){
      if(!S.wife_std){
        S.wife_std = true;
        S.wife_love = clamp((S.wife_love||60) - 12, 0, 100);
        S.wife_respect = clamp((S.wife_respect||55) - 15, 0, 100);
        S.reputation = clamp((S.reputation||50) - 4, 0, 100);
        log('Your untreated STD spreads to your wife.');
        // Immediate divorce/press chance spike
        if(Math.random() < 0.35){
          S.married = false; S.divorces = (S.divorces||0)+1;
          S.wives_count = Math.max(0,(S.wives_count||1)-1);
          log('She files for divorce over the infection.');
          addPaper('Wife leaves Chairman over health scandal', 16);
        } else if(Math.random() < 0.30){
          S.press_threats = (S.press_threats||0) + 1;
          addPaper('Wife threatens to tell all to the press', 12);
        }
      }
    } else {
      // lover
      S.reputation = clamp((S.reputation||50) - 2, 0, 100);
      addPaper('Allegations of reckless behavior surface', 8);
      log((S.last_girl_name||'She') + ' appears to have caught something from you.');
    }
  }
}

async function maybeInfectPartnerWithVeryBadStd(partnerName, partnerType){
  // partnerType: 'male' | 'female'
  if(S.very_bad_std_state === 'infected'){
    const tell = await choose(
      [
        {key:'yes', label:'Yes'},
        {key:'no', label:'No'}
      ],
      'Do you tell ' + partnerName + ' you have a very bad STD?'
    );
    
    if(tell === 'yes'){
      const pay = await choose(
        [
          {key:'pay', label:'Pay for their treatment (£1,000,000)', variant:'warn'},
          {key:'no', label:'Don\'t pay for their treatment', variant:'bad'}
        ],
        'Do you pay for ' + partnerName + '\'s treatment?'
      );
      
      if(pay === 'pay'){
        S.chairman_cash = Math.max(0,(S.chairman_cash||0)-1000000);
        log('You pay for ' + partnerName + '\'s treatment. They are grateful.');
      } else {
        // Partner dies within 3 matches
        (S.pending_partner_death = S.pending_partner_death || []).push({
          partner_name: partnerName,
          partner_type: partnerType,
          matches_until: 3
        });
        log('You refuse to pay. ' + partnerName + ' will likely die from the infection.');
      }
    } else {
      // Partner dies within 3 matches
      (S.pending_partner_death = S.pending_partner_death || []).push({
        partner_name: partnerName,
        partner_type: partnerType,
        matches_until: 3
      });
      log('You don\'t tell ' + partnerName + ' about the infection. They will likely die.');
    }
  }
}



// Enhanced log system with burst handling
let logQueue = [];
let isProcessingQueue = false;
let lastLogTime = 0;
const BURST_THRESHOLD = 100; // ms between logs to consider a burst
