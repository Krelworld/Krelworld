/* ========= Patch 4B: Oversight & Investigations ========= */
(function(){

  function ensureOversightState(){
    if (!window.S) return;
    if (typeof S.board_support !== "number") S.board_support = 50;
    if (typeof S.reputation !== "number") S.reputation = 50;
    if (typeof S.fa_risk !== "number") S.fa_risk = 0;
    if (typeof S.police_risk !== "number") S.police_risk = 0;
    if (typeof S.legal_risk !== "number") S.legal_risk = 0;
    if (typeof S.compliance_risk !== "number") S.compliance_risk = 0;
    if (typeof S.offbooks !== "number") S.offbooks = 0;
    if (typeof S.bribes_count !== "number") S.bribes_count = 0;
    if (typeof S.points_deducted !== "number") S.points_deducted = 0;
    if (!S.suspensions) S.suspensions = { house_games:0, prison_games:0, krazy_register_games:0 };
    if (typeof S.suspensions.house_games !== "number") S.suspensions.house_games = 0;
    if (typeof S.suspensions.prison_games !== "number") S.suspensions.prison_games = 0;
    if (typeof S.suspensions.krazy_register_games !== "number") S.suspensions.krazy_register_games = 0;
    if (!Array.isArray(S.unpaid_transfers)) S.unpaid_transfers = [];
    if (!Array.isArray(S.bribe_log)) S.bribe_log = [];
    if (typeof S.mental_health_excuse_used !== "boolean") S.mental_health_excuse_used = false;
    if (!S.unpaid_transfer_agents) S.unpaid_transfer_agents = {};
  }

  function rndInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
  function feedLog(msg){ try{ (window.log||console.log)(msg); }catch(e){} }
  function btn(label, variant, onClick){
    var b = document.createElement('button');
    b.textContent = label;
    if (variant==="good") b.className = "good";
    if (variant==="warn") b.className = "warn";
    if (variant==="bad")  b.className = "bad";
    b.dataset.oversight4b = "1";
    b.addEventListener('click', onClick);
    return b;
  }
  function clearChoiceButtons(){
    var root = actionsRoot();
    root.querySelectorAll('button[data-oversight4b="1"]').forEach(n=>n.remove());
  }
  function addClubFine(amount){ S.club_cash = Math.max(0, (S.club_cash|0) - Math.max(0,amount|0)); }
  function addChairFine(amount){ S.chairman_cash = Math.max(0, (S.chairman_cash|0) - Math.max(0,amount|0)); }
  function addPointsDeduction(pts){
    S.points_deducted = Math.max(0, (S.points_deducted|0) + Math.max(0,pts|0));
    const clubName = S.club_name || "Southampton FC";
    if (S.table && S.table[clubName]) {
      S.table[clubName].PTS = (S.table[clubName].PTS || 0) - Math.max(0,pts|0);
    }
    if (typeof window.updateHUD === "function") updateHUD();
  }
  function resolveArrears(maxBudget){
    var spent = 0;
    try{
      if (Array.isArray(S.unpaid_transfers)){
        for (var i=S.unpaid_transfers.length-1; i>=0; i--){
          var due = Number(S.unpaid_transfers[i]?.amount || 0);
          if (due>0 && spent + due <= maxBudget){
            spent += due;
            S.unpaid_transfers.splice(i,1);
          }
        }
      }
      var left = Math.max(0, maxBudget - spent);
      if (left > 0 && typeof S.debt_club === "number"){
        var pay = Math.min(S.debt_club, left);
        S.debt_club = Math.max(0, (S.debt_club|0) - pay);
        spent += pay;
      }
    }catch(e){}
    return spent;
  }

  function classifyCrimesForToday(){
    var crimes = [];
    var bribeHeavy = (S.bribes_count||0) >= 3 || (S._lastRefBribeAmount||0) >= 50000;
    var arrearsHeavy = (S.unpaid_transfers||[]).length >= 2 || (S.debt_club||0) > 50000;
    var offbooksHeavy = (S.offbooks||0) >= 3;
    var abuse = (S.verbal_abuse_count||0) >= 2;

    if (bribeHeavy) crimes.push({type:"match-fixing / bribery", authority:"FA"});
    if (arrearsHeavy) crimes.push({type:"failure to pay transfer fees", authority:"Board"});
    if (offbooksHeavy) crimes.push({type:"embezzlement / off-books payments", authority:"Police"});
    if (abuse) crimes.push({type:"verbal abuse of players", authority:"Board"});

    if (crimes.length===0){
      if ((S.fa_risk||0) > 15) crimes.push({type:"integrity violation", authority:"FA"});
      // Remove police risk-based investigations - police should only investigate actual crimes
      // if ((S.police_risk||0) > 15) crimes.push({type:"financial irregularities", authority:"Police"});
      if ((S.compliance_risk||0) > 12) crimes.push({type:"compliance failures", authority:"Board"});
    }
    return crimes;
  }

  function interviewBoard(caseType){
    clearChoiceButtons();
    feedLog("BOARD HEARING: \""+caseType+"\" — You’ve been summoned to the board.");
    var root = actionsRoot();
    var fine = rndInt(10000, 60000);
    root.appendChild(btn("Accept guilt (pay "+moneyGBP(fine)+")", "warn", function(){
      addClubFine(fine);
      S.board_support = clamp((S.board_support|0) - 5, 0, 100);
      S.compliance_risk = clamp((S.compliance_risk|0) - 2, 0, 999);
      feedLog("You accept the charges. The board fines the club "+moneyGBP(fine)+" and issues a stern warning.");
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame mental health (medium risk)", "warn", function(){
      var lucky = Math.random() < 0.45;
      if (lucky){
        var covered = resolveArrears(rndInt(15000, 60000));
        feedLog("They sigh: \"That sounds really difficult.\" A mental‑health charity quietly covers "+moneyGBP(covered)+" of club arrears.");
        S.compliance_risk = clamp((S.compliance_risk|0) - 3, 0, 999);
      } else {
        feedLog("They stare in silence. \"We’re not convinced.\" Support drops.");
        S.board_support = clamp((S.board_support|0) - 8, 0, 100);
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame a player/manager", "bad", function(){
      if (S.stolen?.planted_cash_target){
        feedLog("You present 'evidence' against "+S.stolen.planted_cash_target+". The board grudgingly accepts, this time.");
        S.board_support = clamp((S.board_support|0) - 2, 0, 100);
        S.reputation = clamp((S.reputation|0) - 4, 0, 100);
      } else {
        feedLog("You finger someone vaguely. The board is unconvinced.");
        S.board_support = clamp((S.board_support|0) - 6, 0, 100);
        S.reputation = clamp((S.reputation|0) - 3, 0, 100);
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    var bribeAsk = rndInt(20000, 90000);
    root.appendChild(btn("Offer a bribe ("+moneyGBP(bribeAsk)+")", "bad", function(){
      var ok = Math.random() < 0.6;
      if (ok){
        if ((S.chairman_cash|0) >= bribeAsk) S.chairman_cash -= bribeAsk;
        else S.club_cash = Math.max(0, (S.club_cash|0) - bribeAsk);
        feedLog("Envelopes change hands. \"Clean it up.\" The board lets you off (for now).");
        S.compliance_risk = clamp((S.compliance_risk|0) - 2, 0, 999);
      } else {
        feedLog("They refuse the offer — and make a note of it.");
        S.fa_risk += 1;
        S.board_support = clamp((S.board_support|0) - 5, 0, 100);
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
  }

  function interviewFA(caseType){
    clearChoiceButtons();
    var root = actionsRoot();
    var baseFine = rndInt(20000, 120000);
    var points = Math.random() < 0.35 ? rndInt(1, 6) : 0;
    var suspend = Math.random() < 0.35 ? rndInt(1, 4) : 0;
    feedLog("FA INTERVIEW: \""+caseType+"\" — You’re called to HQ about irregularities.");
    root.appendChild(btn("Accept guilt (fine "+moneyGBP(baseFine)+ (points? ", -"+points+" pts":"") + (suspend? ", suspended "+suspend+" game(s)":"") +")", "warn", function(){
      addClubFine(baseFine);
      if (points) addPointsDeduction(points);
      if (suspend) S.suspensions.house_games = (S.suspensions.house_games|0) + suspend;
      S.fa_risk = clamp((S.fa_risk|0) - 3, 0, 999);
      feedLog("FA sanctions applied.");
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame mental health (medium risk)", "warn", function(){
      // In seasons 4 and 5, mental health isn't recognized
      if (S.season === 4 || S.season === 5) {
        feedLog("\"Mental health isn't real,\" the panel says dismissively.");
        feedLog("You are treated as if you pleaded not guilty and were found guilty. Full sanctions apply.");
        addClubFine(baseFine);
        if (points) addPointsDeduction(points);
        if (suspend) S.suspensions.house_games = (S.suspensions.house_games|0) + suspend;
      } else {
        var lucky = Math.random() < 0.4;
        if (lucky){
          feedLog("The panel murmurs. \"We will give you one more chance.\"");
          S.fa_risk = clamp((S.fa_risk|0) - 2, 0, 999);
        } else {
          feedLog("They're unmoved. Sanctions proceed.");
          addClubFine(baseFine);
          if (points) addPointsDeduction(points);
          if (Math.random()<0.5) S.suspensions.house_games = (S.suspensions.house_games|0) + rndInt(1,3);
        }
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame a player/manager", "bad", function(){
      if (S.stolen?.planted_cash_target){
        feedLog("You present a tidy dossier implicating "+S.stolen.planted_cash_target+". The FA grumbles but reduces the penalty.");
        addClubFine(Math.round(baseFine*0.5));
        if (points && Math.random()<0.5) addPointsDeduction(Math.max(1, Math.round(points/2)));
      } else {
        feedLog("You try to redirect blame; the panel notes your deflection.");
        S.reputation = clamp((S.reputation|0) - 5, 0, 100);
        addClubFine(Math.round(baseFine*0.75));
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    var bribeAsk = baseFine + rndInt(10000, 40000);
    root.appendChild(btn("Quietly ask: \"What can make this go away?\" ("+moneyGBP(bribeAsk)+")", "bad", function(){
      var ok = Math.random() < 0.45;
      if (ok){
        if ((S.chairman_cash|0) >= bribeAsk) S.chairman_cash -= bribeAsk;
        else S.club_cash = Math.max(0, (S.club_cash|0) - bribeAsk);
        var cleared = resolveArrears(rndInt(10000, 40000));
        feedLog("A whisper: \"Keep your head down.\" Case closed. "+(cleared?("Some arrears quietly resolved ("+moneyGBP(cleared)+")."):""));
        S.fa_risk = clamp((S.fa_risk|0) - 4, 0, 999);
      } else {
        feedLog("They recoil. \"Do not attempt to interfere.\" The file thickens.");
        S.fa_risk += 2;
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
  }

  // DISABLED: Old police system replaced by new presentInvestigation system
  // This was causing duplicate arrest messages and conflicts
  function interviewPolice(caseType){
    // Redirect to new police interview system
    if (typeof window.presentInvestigation === 'function') {
      window.presentInvestigation({ authority: 'police', caseType: caseType });
      return;
    }
    
    // Fallback only if new system completely unavailable
    clearChoiceButtons();
    var root = actionsRoot();
    var fineChair = rndInt(15000, 90000);
    var fineClub  = Math.round(fineChair * 0.6);
    var prison    = Math.random() < 0.4 ? rndInt(1, 4) : 0;
    feedLog("YOU'VE BEEN ARRESTED BY THE POLICE — Case: "+caseType);
    root.appendChild(btn("Accept guilt (fines "+moneyGBP(fineChair)+" personal, "+moneyGBP(fineClub)+" club"+(prison? ", prison "+prison+" game(s)":"")+")", "warn", function(){
      addChairFine(fineChair);
      addClubFine(fineClub);
      if (prison) {
        // Use the new police interview system instead of direct prison
        if (typeof enforcePoliceInterviewBeforePrison === 'function') {
          enforcePoliceInterviewBeforePrison(caseType, prison, addChairFine, addClubFine);
        } else {
          // Fallback to direct prison if new system not available
          S.suspensions.prison_games = (S.suspensions.prison_games|0) + prison;
          S.prison = true;
        }
      }
      S.police_risk = clamp((S.police_risk|0) - 4, 0, 999);
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame mental health (medium risk)", "warn", function(){
      // In seasons 4 and 5, mental health isn't recognized
      if (S.season === 4 || S.season === 5) {
        feedLog("\"Mental health isn't real,\" the officer says flatly.");
        feedLog("You are treated as if you pleaded not guilty and were found guilty. Full punishment applies.");
        addChairFine(fineChair);
        addClubFine(fineClub);
        if (prison) {
          // Use the new police interview system instead of direct prison
          if (typeof enforcePoliceInterviewBeforePrison === 'function') {
            enforcePoliceInterviewBeforePrison(caseType, prison, addChairFine, addClubFine);
          } else {
            // Fallback to direct prison if new system not available
            S.suspensions.prison_games = (S.suspensions.prison_games|0) + prison;
            S.prison = true;
          }
        }
      } else {
        var lucky = Math.random() < 0.35;
        if (lucky){
          var cleared = resolveArrears(rndInt(15000, 60000));
          feedLog("One detective softens. \"We'll caution you.\" "+(cleared?("A charity covers "+moneyGBP(cleared)+" in arrears."):""));
          S.police_risk = clamp((S.police_risk|0) - 3, 0, 999);
        } else {
          feedLog("They don't buy it. They proceed with charges.");
          addChairFine(Math.round(fineChair*0.75));
          if (Math.random()<0.5) {
            const prisonTerm = rndInt(1,3);
            // Use the new police interview system instead of direct prison
            if (typeof enforcePoliceInterviewBeforePrison === 'function') {
              enforcePoliceInterviewBeforePrison(caseType, prisonTerm, addChairFine, addClubFine);
            } else {
              // Fallback to direct prison if new system not available
              S.suspensions.prison_games = (S.suspensions.prison_games|0) + prisonTerm;
              S.prison = true;
            }
          }
        }
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    root.appendChild(btn("Blame a player/manager", "bad", function(){
      if (S.stolen?.planted_cash_target){
        feedLog("You plant evidence on "+S.stolen.planted_cash_target+". The case drifts… for now.");
        S.reputation = clamp((S.reputation|0) - 6, 0, 100);
      } else {
        feedLog("You try to scapegoat; the officers frown.");
        S.reputation = clamp((S.reputation|0) - 4, 0, 100);
        addChairFine(Math.round(fineChair*0.25));
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
    var bribeAsk = fineChair + rndInt(20000, 50000);
    root.appendChild(btn("Ask quietly: \"What can I make to do this go away?\" ("+moneyGBP(bribeAsk)+")", "bad", function(){
      var ok = Math.random() < 0.35;
      if (ok){
        if ((S.chairman_cash|0) >= bribeAsk) S.chairman_cash -= bribeAsk;
        else S.club_cash = Math.max(0, (S.club_cash|0) - bribeAsk);
        var cleared = resolveArrears(rndInt(20000, 70000));
        feedLog("A look. A nod. The file goes missing. "+(cleared?("Arrears vanish to the tune of "+moneyGBP(cleared)+"."):""));
        S.police_risk = clamp((S.police_risk|0) - 5, 0, 999);
      } else {
        feedLog("They bristle. \"Attempted bribery, noted.\"");
        S.police_risk += 3;
      }
      clearChoiceButtons(); if (typeof updateHUD==="function") updateHUD();
    }));
  }

  function maybeBoardWarning(){
    if (!S) return;
    var trigger = (S.compliance_risk||0) > 12 || (S.reputation||0) < 35 || (S.offbooks||0) > 4;
    if (!trigger) return;
    if (S._lastBoardWarnRound === (S.matches_played|0)) return;
    S._lastBoardWarnRound = (S.matches_played|0);
    feedLog("BOARD MEMO: \"We’re concerned about negative press and irregularities. Clean up your act.\"");
    S.board_support = clamp((S.board_support|0) - 2, 0, 100);
    if (typeof updateHUD==="function") updateHUD();
  }

  function announceSuspensionsIfAny(){
    if (!S) return;
    var rix = S.matches_played|0;
    if (S._suspensionAnnouncedRound === rix) return;
    if ((S.suspensions.house_games|0) > 0){
      feedLog("SUSPENSION ACTIVE: You are banned from the touchline. Pre‑match limited to \"Watch game from your house\" for "+S.suspensions.house_games+" match(es).");
      S._suspensionAnnouncedRound = rix;
    } else if ((S.suspensions.prison_games|0) > 0){
      feedLog("IN CUSTODY: You’ll be watching from your cell. Home‑life actions are disabled for "+S.suspensions.prison_games+" match(es).");
      S._suspensionAnnouncedRound = rix;
    }
  }
  function mountObserveOnlyButtonsIfRestricted(){
    var root = actionsRoot();
    if (!root) return;
    var rix = S.matches_played|0;
    if (S._observeBtnRound === rix) return;
    if ((S.suspensions.house_games|0) > 0){
      var b = btn("Watch game from your house (observe only)", "warn", function(){
        clearChoiceButtons();
        feedLog("You sit on the sofa, phone in hand. No tunnel antics today.");
      });
      root.appendChild(b);
      S._observeBtnRound = rix;
    } else if ((S.suspensions.prison_games|0) > 0){
      var b2 = btn("Watch game from your prison cell (observe only)", "bad", function(){
        clearChoiceButtons();
        feedLog("The TV is tinny. Your solicitor says to keep quiet.");
      });
      root.appendChild(b2);
      S._observeBtnRound = rix;
    } else if ((S.suspensions.rehab_games|0) > 0){
      var b3 = btn("Watch game from rehab (observe only)", "warn", function(){
        clearChoiceButtons();
        feedLog("You watch from the treatment center. The counselors say you're making progress.");
      });
      root.appendChild(b3);
      S._observeBtnRound = rix;
    }
  }

  function maybePresentOversightEvents(){
    // DISABLED: Old investigation system replaced with new system
    // Only run basic state management, no investigations
    ensureOversightState();
    announceSuspensionsIfAny();
    mountObserveOnlyButtonsIfRestricted();
    
    // Don't trigger any investigations - use new system instead
    maybeBoardWarning();
    return;
  }


  setTimeout(function(){ try{ ensureOversightState(); announceSuspensionsIfAny(); }catch(e){} }, 1500);

  window.Oversight4B = { maybePresentOversightEvents: maybePresentOversightEvents };
})();

// Match viewer functions
function _stopMatchViewer(){
  if (_watch.running){
    _watch.running = false;
    // fall back to quick resolve if needed
    if (_watch.resolve){
      const quick = _quickResolve();
      _watch.resolve({home:quick.home, away:quick.away});
    }
  }
  _closeMatchViewer();
}

function _skipToResult(){
  _stopMatchViewer();
}

// Match viewer event listeners
document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = document.getElementById('closeMatchViewerBtn');
  const skipBtn = document.getElementById('skipMatchBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', _stopMatchViewer);
  }
  
  if (skipBtn) {
    skipBtn.addEventListener('click', _skipToResult);
  }
});