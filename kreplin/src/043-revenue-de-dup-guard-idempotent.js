/* ==== Revenue de-dup guard (idempotent) ====
   Ensures gate revenue is only applied/logged once per match,
   even if multiple post‑match blocks fire.
*/
(function(){
  if (window.__gateRevenuePatchApplied) return;
  window.__gateRevenuePatchApplied = true;

  // Track which round we've already accepted gate revenue for
  window.__gateAppliedForRound = null;

  function currentRoundIndexForGate(){
    try{
      if (S && S.matchContext && typeof S.matchContext.roundIndex === 'number') return S.matchContext.roundIndex;
      // post‑match often runs with matches_played already incremented or not; be defensive
      var mp = (S && typeof S.matches_played === 'number') ? S.matches_played : 0;
      return Math.max(0, mp - 1);
    }catch(_){ return 0; }
  }

  // Wrap log() to suppress duplicate "Attendance... Gate Revenue: £X" lines
  var _origLog = (typeof window.log === "function") ? window.log : function(m){
    try{
      var feed = document.getElementById('feed');
      if (feed){
        var p = document.createElement('p'); p.textContent = String(m||""); feed.appendChild(p);
      }
    }catch(e){}
  };

  window.log = function(){
    try{
      var msg = arguments[0];
      if (typeof msg === "string" && msg.indexOf("Attendance:") === 0 && msg.indexOf("Gate Revenue:") !== -1){
        var rix = currentRoundIndexForGate();
        if (window.__gateAppliedForRound === rix){
          // Duplicate: parse revenue and revert the extra cash if it was added again
          var m = msg.match(/Gate Revenue:\s*£([\d,]+)/i);
          if (m){
            var amt = parseInt(m[1].replace(/,/g, ""), 10);
            if (isFinite(amt) && window.S){
              S.club_cash = Math.max(0, (S.club_cash|0) - amt);
              if (typeof window.updateHUD === "function") window.updateHUD();
            }
          }
          // Swallow duplicate line
          return;
        } else {
          // First time this round: mark as applied
          window.__gateAppliedForRound = rix;
        }
      }
    }catch(_){}
    return _origLog.apply(this, arguments);
  };

  // Also patch a helper to be used by any future revenue calls, making them idempotent
  window.applyGateRevenueOnce = function(attendance, ticket){
    try{
      var rix = currentRoundIndexForGate();
      if (window.__gateAppliedForRound === rix) return 0;
      var rev = Math.max(0, (attendance|0) * (ticket|0));
      if (window.S){
        S.club_cash = Math.max(0, (S.club_cash|0) + rev);
        window.__gateAppliedForRound = rix;
        if (typeof window.updateHUD === "function") window.updateHUD();
      }
      return rev;
    }catch(_){ return 0; }
  };
})();