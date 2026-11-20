// ===== 4A Section 2: Attendance + Morale helpers (GLOBAL, single copy) =====
(function(){
  const CAPACITY = 32000;
  const TICKET   = 40;

  // expose constants so other code can use them
  window.STADIUM_CAPACITY = CAPACITY;
  window.TICKET_PRICE     = TICKET;

  window.clamp = window.clamp || function(v, lo, hi){
    return Math.min(hi, Math.max(lo, v));
  };

  window.computeAttendance = function(fanMorale){
    const fm = Number.isFinite(fanMorale) ? fanMorale : 0; // 0..100
    const raw = CAPACITY * (0.5 + fm / 200);               // 50%..100%
    return Math.round(clamp(raw, 0, CAPACITY));
  };

  // Prefer schedule; fall back to “we’re home”
  window.isHomeToday = function(){
    try{
      const SOUTH = (typeof getClubName === 'function') ? getClubName() : (S?.club_name || "Southampton FC");
      // round index we just completed (post-match)
      const idx = (S && S.matchContext && Number.isFinite(S.matchContext.roundIndex))
        ? S.matchContext.roundIndex
        : Math.max(0, (S.matches_played||1) - 1);

      const r = S?.rounds?.[idx];
      const fixture = Array.isArray(r?.[0]) ? r[0] : [SOUTH, (S?.opponents?.[idx]||"Opponent")];
      return fixture[0] === SOUTH;
    }catch(e){
      return true; // safe default: treat as home so you see the line
    }
  };

  window.applyFanMoraleDeltaByResult = function(gf, ga){
    if (!S) return;
    let delta = 0;
    if (gf > ga) delta = +3;
    else if (ga > gf) delta = -5;
    else delta = +1;
    S.fan_morale = clamp((S.fan_morale|0) + delta, 0, 100);
  };
})();


// ===== 4A Section 2: Finance & Morale helpers (define once) =====
(function(){
  // Tunables
  if (typeof window.STADIUM_CAPACITY === "undefined") window.STADIUM_CAPACITY = 32000;
  if (typeof window.TICKET_PRICE     === "undefined") window.TICKET_PRICE     = 40; // £

  // Utils
  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function clubName(){ return getClubName(); }

  // Attendance from fan morale (0..100)
  window.computeAttendance = function(fanMorale){
    const fm  = Number(fanMorale||0);
    const raw = window.STADIUM_CAPACITY * (0.5 + (fm/200));
    return Math.round(clamp(raw, 0, window.STADIUM_CAPACITY));
  };

  // Is today a HOME match?
  // Assumes today's round is S.rounds[S.matches_played], with fixtures like [home, away],
  // and our fixture is somewhere in that array.
  window.isHomeToday = function(){
    try{
      const rounds = S?.rounds || [];
      const idx    = S?.matches_played|0;
      const our    = clubName();
      const today  = rounds[idx];
      if (Array.isArray(today)){
        for (const fx of today){
          if (Array.isArray(fx) && (fx[0] === our || fx[1] === our)){
            return fx[0] === our; // true if we're listed first (home)
          }
        }
      }
    }catch(_){}
    // Safe default if we can't tell
    return true;
  };

  // Apply morale delta based on result; clamp 0..100 and log a small note
  window.applyFanMoraleDeltaByResult = function(gf, ga){
    let delta = 0;
    if (gf > ga) delta =  3;
    else if (gf < ga) delta = -5;
    else delta = 1;

    S.fan_morale = clamp((S.fan_morale|0) + delta, 0, 100);
    if (delta !== 0){
      const sign = delta > 0 ? "+" : "";
      log(`Fan morale ${sign}${delta}. Now ${S.fan_morale}.`);
    }
  };
})();

// Helper function to calculate price cap based on player tier, name, and rating
function getPlayerPriceCap(player) {
  const name = player.name || '';
  const tier = player.tier || '';
  const rating = player.rating || 0;
  
  // Messi and Ronaldo: 70 mil cap
  if (name === "Cristiano Ronaldo" || name === "Lionel Messi") {
    return 70000000;
  }
  
  // Other legendary players: 20-30 mil based on rating
  if (tier === "legendary") {
    // Higher rating = higher cap, scaled from 20-30 mil
    // Rating 95-100 -> 30 mil, Rating 90-94 -> 25 mil, Rating 85-89 -> 20 mil
    if (rating >= 95) return 30000000;
    if (rating >= 90) return 25000000;
    return 20000000;
  }
  
  // Elite players: 17-20 mil range
  if (tier === "elite") {
    // Higher rating = higher cap, scaled from 17-20 mil
    // Rating 90+ -> 20 mil, Rating 85-89 -> 18.5 mil, Rating 80-84 -> 17 mil
    if (rating >= 90) return 20000000;
    if (rating >= 85) return 18500000;
    return 17000000;
  }
  
  // No cap for other tiers (let multiplier apply normally)
  return Infinity;
}

(function patchMakePlayerForEconomy(){
  if (typeof window.makePlayer !== 'function') return;
  if (window.makePlayer._econPatched) return;
  const _orig = window.makePlayer;
  window.makePlayer = function(){
    const p = _orig.apply(this, arguments) || {};
    if (p && typeof p === 'object') {
      p.price = Math.max(0, Math.round((p.price||0) * PLAYER_PRICE_MULTIPLIER));
      p.wage  = Math.max(0, Math.round((p.wage||0)  * PLAYER_WAGE_MULTIPLIER));
      
      // Apply price cap based on tier and rating
      const priceCap = getPlayerPriceCap(p);
      if (priceCap !== Infinity) {
        p.price = Math.min(p.price, priceCap);
      }
    }
    return p;
  };
  window.makePlayer._econPatched = true;
})();

(function patchMakeSpecialPlayerForEconomy(){
  if (typeof window.makeSpecialPlayer !== 'function') return;
  if (window.makeSpecialPlayer._econPatched) return;
  const _orig = window.makeSpecialPlayer;
  window.makeSpecialPlayer = function(){
    const p = _orig.apply(this, arguments) || {};
    if (p && typeof p === 'object') {
      p.price = Math.max(0, Math.round((p.price||0) * PLAYER_PRICE_MULTIPLIER));
      p.wage  = Math.max(0, Math.round((p.wage||0)  * PLAYER_WAGE_MULTIPLIER));
      
      // Apply price cap based on tier and rating
      const priceCap = getPlayerPriceCap(p);
      if (priceCap !== Infinity) {
        p.price = Math.min(p.price, priceCap);
      }
    }
    return p;
  };
  window.makeSpecialPlayer._econPatched = true;
})();


function generateMarketIfNeeded(initial=false){
  ensureTransferState();
  
  if (initial){
    // Always generate a fresh transfer market when opening the window
    S.transfer_market = [];
    
    // Always add special players on initial market generation (increased from 75%)
    // Add 3-6 special players (weighted towards 4-5) at the TOP
    const numSpecial = Math.random() < 0.2 ? 3 : Math.random() < 0.5 ? 4 : Math.random() < 0.8 ? 5 : 6;
    for(let i = 0; i < numSpecial; i++) {
      S.transfer_market.push(makeSpecialPlayer()); // auto-scaled by wrapper
    }
    
    // Add regular players after special players
    for(let i=0;i<12;i++) S.transfer_market.push(makePlayer()); // now auto-scaled by wrapper
    return;
  }
  
  // Only for non-initial calls (when market is being refreshed during window)
  const toAdd = Math.max(0, 8 - S.transfer_market.length);
  for(let i=0;i<toAdd;i++) S.transfer_market.push(makePlayer()); // auto-scaled
  
  // 75% chance to add special players when refreshing market (increased from 50%)
  if(Math.random() < 0.75) {
    // Add 2-4 special players when refreshing (increased from 1-2)
    const numSpecial = Math.random() < 0.4 ? 2 : Math.random() < 0.8 ? 3 : 4;
    for(let i = 0; i < numSpecial; i++) {
      S.transfer_market.push(makeSpecialPlayer()); // auto-scaled by wrapper
    }
  }
}


function getSquad(){ return S.squad || []; }
function setSquad(arr){ S.squad = arr; }
function squadValue(){
  const sq = getSquad(); let v=0;
  for(const p of sq){ v += (p.price||0); }
  return v;
}



// Default quality (0..100). Southampton is set in init below; others here.
const TEAM_QUALITY = {
  "Southampton FC": 39,
  "Arsenal": 82, "Aston Villa": 72, "Brighton": 68, "Brentford": 63, "Chelsea": 78,
  "Everton": 58, "Liverpool": 84, "Manchester City": 92, "Manchester United": 78,
  "Newcastle United": 76, "Tottenham Hotspur": 80, "West Ham United": 68,
  "Wolverhampton": 60, "Bournemouth": 55, "Portsmouth": 90
};

function teamKeyClub(){ return getClubName(); }




// Build an opponent squad around a club's quality (random spread)
function makeOpponentSquad(teamName){
  const base = TEAM_QUALITY[teamName] ?? 70;
  const sz = 8 + Math.floor(Math.random()*4); // 8–11 players in pool
  const pool = [];
  
  // 60% chance to include 2-4 special players in opponent squad (increased from 25% and 1-2)
  let specialCount = 0;
  if (Math.random() < 0.60) {
    specialCount = Math.random() < 0.3 ? 2 : Math.random() < 0.7 ? 3 : 4;
    for (let i = 0; i < specialCount; i++) {
      const specialPlayer = makeSpecialPlayer();
      // Adjust rating to fit team quality if needed
      const delta = Math.round((Math.random()*10) - 5);
      specialPlayer.rating = Math.max(50, Math.min(97, base + delta));
      specialPlayer.tier = specialPlayer.rating >= 90 ? "elite" :
                           specialPlayer.rating >= 80 ? "excellent" :
                           specialPlayer.rating >= 70 ? "average" :
                           specialPlayer.rating >= 62 ? "mediocre" : "shit";
      pool.push(specialPlayer);
    }
  }
  
  // Fill remaining slots with regular players
  for (let i=0;i<sz-specialCount;i++){
    const p = makePlayer();
    // skew around base with small variance
    const delta = Math.round((Math.random()*10) - 5); // -5..+5
    p.rating = Math.max(50, Math.min(97, base + delta));
    p.tier = p.rating >= 90 ? "elite" :
             p.rating >= 80 ? "excellent" :
             p.rating >= 70 ? "average" :
             p.rating >= 62 ? "mediocre" : "shit";
    pool.push(p);
  }
  return pool;
}

// Ensure today’s opponent player-pool exists (and cache by match index)
function ensureOpponentForToday(){
  const idx = S.matches_played|0;
  if (!Array.isArray(S._opponentSquads)) S._opponentSquads = [];
  if (!S._opponentSquads[idx]){
    const {team} = currentOpponent();
    S._opponentSquads[idx] = makeOpponentSquad(team);
  }
  S.opponent_today = S._opponentSquads[idx];
}



// ---- League table helpers ----

// ---------- Inventory modal logic ----------
// ---------- Inventory modal logic (fixed) ----------
// ===== Inventory UI (single source of truth) =====
(function(){
  // Ensure the canonical structure; NEVER overwrite with []
  function ensureInv(){
    if (!S.inventory || typeof S.inventory !== 'object') {
      S.inventory = { accolades: [], drugs: 0 };
    }
    if (!Array.isArray(S.inventory.accolades)) S.inventory.accolades = [];
    if (typeof S.inventory.drugs !== 'number') S.inventory.drugs = 0;
    return S.inventory;
  }

  // Create (or reuse) the pane once, mounted right after #dialoguePanel
  function ensureInventoryPane(){
    let pane = document.getElementById('inventoryPane');
    if (!pane){
      pane = document.createElement('div');
      pane.id = 'inventoryPane';
      pane.style.display = 'none';
      pane.style.position = 'relative';
      pane.style.margin = '12px 0';
      pane.style.padding = '12px';
      pane.style.border = '1px solid rgba(255,255,255,0.12)';
      pane.style.borderRadius = '10px';
      pane.style.background = 'rgba(0,0,0,0.25)';

      const h = document.createElement('div');
      h.textContent = 'Inventory';
      h.style.fontWeight = '600';
      h.style.marginBottom = '8px';
      pane.appendChild(h);

      // sections
      const sum = document.createElement('div'); sum.id = 'invSummary'; sum.style.marginBottom = '8px';
      pane.appendChild(sum);

      const list = document.createElement('div'); list.id = 'inventoryList';
      pane.appendChild(list);

      const close = document.createElement('button');
      close.textContent = 'Close';
      close.style.marginTop = '8px';
      close.addEventListener('click', ()=>toggleInventoryPane(false));
      pane.appendChild(close);

      // mount AFTER #dialoguePanel (visible), fallback to #log if present
      const anchor = document.getElementById('dialoguePanel') || document.getElementById('log') || document.body;
      if (anchor.parentNode) {
        anchor.parentNode.insertBefore(pane, anchor.nextSibling);
      } else {
        document.body.appendChild(pane);
      }
    }
  }


  function toggleInventoryPane(show){
    ensureInventoryPane();
    const pane = document.getElementById('inventoryPane');
    pane.style.display = show ? 'block' : 'none';
    if (show) renderInventory();
  }

  // Expose functions to global scope immediately
  window.ensureInventoryPane = ensureInventoryPane;
  window.toggleInventoryPane = toggleInventoryPane;

  // ==== POWER NETWORK (Lobby Tokens & Perks) ====
  function ensurePowerNetworkPane(){
    let overlay = document.getElementById('powerNetworkOverlay');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'powerNetworkOverlay';
      overlay.className = 'modern-modal-overlay';
      overlay.style.display = 'none';
      overlay.onclick = function(e){
        if (e.target === overlay) {
          togglePowerNetworkPane(false);
        }
      };
      
      let pane = document.createElement('div');
      pane.id = 'powerNetworkPane';
      pane.className = 'modern-modal';
      pane.style.maxWidth = '960px';
      pane.style.width = '90%';
      pane.style.maxHeight = '85vh';
      pane.style.overflow = 'hidden';
      pane.style.display = 'flex';
      pane.style.flexDirection = 'column';
      pane.onclick = function(e){
        e.stopPropagation();
      };
      pane.innerHTML = `
        <div id="powerNetworkInner" style="padding:16px 20px;overflow-y:auto;overflow-x:hidden;flex:1;max-height:100%;">
          <div style="display:flex;align-items:center;gap:12px;">
            <h2 style="margin:0;flex:1;">Power Network &mdash; Lobby Tokens</h2>
            <button id="powerNetworkCloseBtn" style="border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:0.85rem;padding:4px 10px;border-radius:999px;">
              ✕ Close
            </button>
          </div>
          <p style="color:var(--muted);font-size:0.9rem;">
            Funnel dirty money into Westminster, weaponise Starmer, and unlock truly unhinged perks.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:16px;margin:12px 0 20px;">
            <div style="flex:1 1 200px;">
              <div style="font-size:0.85rem;text-transform:uppercase;opacity:0.7;">Lobby Tokens</div>
              <div id="powerLobbyTokens" style="font-size:1.4rem;font-weight:600;margin-top:4px;">0</div>
            </div>
            <div style="flex:1 1 260px;">
              <div style="font-size:0.85rem;text-transform:uppercase;opacity:0.7;">Influence Policy</div>
              <select id="powerInfluencePolicy" style="margin-top:4px;width:100%;padding:6px 8px;background:var(--bg-secondary);color:var(--text);border-radius:8px;border:1px solid var(--border);">
                <option value="frugal">Frugal &mdash; Keep it quiet, keep it small</option>
                <option value="standard">Standard &mdash; A few donations here and there</option>
                <option value="aggressive">Aggressive &mdash; We practically live in Westminster</option>
                <option value="obsessed">Obsessed &mdash; Every spare penny becomes leverage</option>
              </select>
            </div>
            <div style="flex:1 1 200px;">
              <div style="font-size:0.85rem;text-transform:uppercase;opacity:0.7;">Heat / Suspicion</div>
              <div id="powerHeat" style="font-size:1.1rem;margin-top:4px;">0 / 100</div>
            </div>
          </div>
          <hr style="border-color:var(--line);margin:8px 0 16px;">
          <div id="powerPerks" style="display:grid;gap:10px;">
            <!-- Perk buttons will be rendered here -->
          </div>
        </div>
      `;
      
      overlay.appendChild(pane);
      document.body.appendChild(overlay);
    }
  }

  function togglePowerNetworkPane(show){
    ensurePowerNetworkPane();
    const overlay = document.getElementById('powerNetworkOverlay');
    if (!overlay) return;
    if (typeof show === 'undefined') {
      show = overlay.style.display !== 'flex';
    }
    overlay.style.display = show ? 'flex' : 'none';
    if (show) renderPowerNetwork();
  }

  function renderPowerNetwork(){
    try{
      const S = window.S || (window.S = {});
      ensurePowerNetworkPane();
      const tokensEl = document.getElementById('powerLobbyTokens');
      const policyEl = document.getElementById('powerInfluencePolicy');
      const heatEl   = document.getElementById('powerHeat');
      const perksEl  = document.getElementById('powerPerks');

      const closeBtn = document.getElementById('powerNetworkCloseBtn');
      if (closeBtn) {
        closeBtn.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          togglePowerNetworkPane(false);
        };
      }

      if (tokensEl) tokensEl.textContent = (S.lobby_tokens|0).toLocaleString('en-GB');
      if (policyEl) {
        if (!S.influence_policy) S.influence_policy = "standard";
        policyEl.value = S.influence_policy;
        policyEl.onchange = function(){
          S.influence_policy = this.value || "standard";
          log(`You update the club's Influence Policy to "${this.options[this.selectedIndex].text}".`);
        };
      }
      if (heatEl) heatEl.textContent = `${S.power_heat|0} / 100`;

      if (perksEl){
        // Save scroll position before re-rendering to prevent scroll reset
        // Use the inner div as the scroll container
        const inner = document.getElementById('powerNetworkInner');
        const savedScrollTop = inner ? inner.scrollTop : 0;
        
        const tokens = S.lobby_tokens|0;
        const rows = [];

        function perkRow(id, title, desc, cost, disabledReason){
          const affordable = tokens >= cost;
          const disabled = !!disabledReason || !affordable;
          const btnLabel = affordable ? `Activate (${cost} Lobby Tokens)` : `Requires ${cost} Lobby Tokens`;
          const reason = disabledReason || (!affordable ? "You don't have enough Lobby Tokens yet." : "");
          const variant = affordable ? "warn" : "bad";
          const dataId = `perk-${id}`;
          rows.push(`
            <button class="${variant}" data-perk-id="${dataId}" ${disabled ? "disabled" : ""}>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <div style="font-weight:600;">${title}</div>
                  <div style="font-size:0.85rem;color:var(--muted);">${desc}</div>
                  ${reason ? `<div style="font-size:0.75rem;color:var(--bad);margin-top:4px;">${reason}</div>` : ""}
                </div>
                <div style="text-align:right;min-width:160px;">
                  <div style="font-size:0.85rem;opacity:0.8;">Cost: ${cost.toLocaleString('en-GB')} Lobby Tokens</div>
                  <div style="font-size:0.8rem;margin-top:4px;">${btnLabel}</div>
                </div>
              </div>
            </button>
          `);
        }

        // --- Ultima Briefcase ---
        const briefcaseDisabled = S.power_briefcase_owned ? "You already own the Ultima Briefcase." : (tokens < 10000 ? "You need 10,000 Lobby Tokens to purchase the Ultima Briefcase." : "");
        perkRow(
          "briefcase",
          S.power_briefcase_owned ? "Ultima Briefcase (Owned)" : "Ultima Briefcase",
          "A heavy, small metal briefcase with a red button. The contents are unknown, but the price suggests something significant.",
          10000,
          briefcaseDisabled
        );

        // --- Political Influence / Starmer path ---
        perkRow(
          "emergency-points",
          "Emergency Points Package",
          "Starmer goes on TV to 'reward true British clubs'. You gain +3 league points instantly. Causes a media meltdown and whispers of corruption.",
          100
        );

        const number10Disabled = S.power_unlocked_number10 ? "Already unlocked Number 10." : "";
        perkRow(
          "enter-number10",
          S.power_unlocked_number10
            ? "Number 10 Access (Unlocked)"
            : "TOP SECRET: Government Back Channel",
          S.power_unlocked_number10
            ? "You already have a grubby key to a private room in Downing Street."
            : "A sealed political corridor. The exact consequences are classified until you commit.",
          150,
          number10Disabled
        );

        const transferActCost = (S.power_transfer_act_uses|0) ? (80 + 20 * (S.power_transfer_act_uses|0)) : 80;
        perkRow(
          "transfer-act",
          "Transfer Powers Act",
          "Government grants extraordinary business freedoms. Your next transfer can force through a deal or land a world-class player at a brutal discount.",
          transferActCost
        );

        // --- Nuclear Option (Trident) ---
        const isInPreMatch = !!(S.preMatch && typeof S.preMatch === 'object');
        const tridentDisabled = S.power_unlocked_trident 
          ? "You have already pulled the Trident trigger in this era." 
          : !isInPreMatch
          ? "Trident can only be launched during the pre-match phase, before a game. You must access this option before kickoff."
          : "";
        if (S.power_unlocked_number10){
          perkRow(
            "trident",
            "Request Trident Access",
            "Push the state into outright madness. Launching Trident at a rival will erase them from the league and drag the whole world into crisis. ⚠️ Can only be used during pre-match phase, before a game.",
            220,
            tridentDisabled
          );
        }

        perksEl.innerHTML = rows.join("");
        
        // Restore scroll position after re-rendering
        // Use multiple frames to ensure DOM is fully updated
        if (inner && savedScrollTop >= 0) {
          // Use setTimeout to ensure DOM is fully rendered
          setTimeout(() => {
            inner.scrollTop = savedScrollTop;
          }, 0);
          // Also use requestAnimationFrame as backup
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (inner) {
                inner.scrollTop = savedScrollTop;
              }
            });
          });
        }

        // Wire click handlers
        perksEl.querySelectorAll("button[data-perk-id]").forEach(btn=>{
          const id = btn.getAttribute("data-perk-id");
          const isBriefcase = id === "perk-briefcase";
          
          // Special handling for briefcase button
          if (isBriefcase) {
            const hasEnoughTokens = (S.lobby_tokens || 0) >= 10000;
            const alreadyOwned = S.power_briefcase_owned;
            console.log(`[DEBUG BRIEFCASE] Button found - tokens: ${S.lobby_tokens}, hasEnough: ${hasEnoughTokens}, owned: ${alreadyOwned}, disabled attr: ${btn.hasAttribute('disabled')}, disabled prop: ${btn.disabled}`);
            
            // Explicitly enable if player has enough tokens and doesn't own it
            if (hasEnoughTokens && !alreadyOwned) {
              btn.disabled = false;
              btn.removeAttribute('disabled');
              console.log(`[DEBUG BRIEFCASE] Explicitly enabled briefcase button`);
            } else if (alreadyOwned) {
              btn.disabled = true;
              console.log(`[DEBUG BRIEFCASE] Briefcase already owned, button disabled`);
            } else {
              btn.disabled = true;
              console.log(`[DEBUG BRIEFCASE] Not enough tokens, button disabled`);
            }
          }
          
          // Remove any existing handlers to prevent duplicates
          btn.onclick = null;
          // Use addEventListener for better compatibility
          btn.addEventListener('click', async (e)=>{
            e.preventDefault();
            e.stopPropagation();
            // Prevent clicks on disabled buttons
            if (btn.disabled) {
              console.log(`[DEBUG] Button ${id} is disabled, ignoring click`);
              return;
            }
            console.log(`[DEBUG] Button ${id} clicked`);
            
            // CRITICAL FIX: Save scroll position BEFORE any async operations
            const inner = document.getElementById('powerNetworkInner');
            const savedScrollTop = inner ? inner.scrollTop : 0;
            
            try {
              await activatePowerPerk(id, savedScrollTop);
            } catch(e) {
              console.error("Error activating power perk:", e);
              log("An error occurred while activating the power perk.");
            }
          }, { once: false });
        });
      }
    } catch(e){
      console.error("renderPowerNetwork error:", e);
    }
  }

  async function activatePowerPerk(perkId){
    try{
      const S = window.S || (window.S = {});
      const tokens = S.lobby_tokens|0;

      function spend(cost){
        if ((S.lobby_tokens|0) < cost) {
          log("You don't have enough Lobby Tokens to pull this off.");
          return false;
        }
        S.lobby_tokens = (S.lobby_tokens|0) - cost;
        S.power_heat = Math.min(100, (S.power_heat|0) + Math.ceil(cost / 10));
        if (typeof updateHUD === 'function') updateHUD();
        renderPowerNetwork();
        return true;
      }

      // Helper to nudge Delmor without over-wiring
      function pingDelmor(line){
        try{
          console.log('[DEBUG pingDelmor] Function called with line:', line);
          if (typeof window.enqueueRivalText === 'function') {
            console.log('[DEBUG pingDelmor] Calling enqueueRivalText with:', line);
            window.enqueueRivalText(line);
          } else {
            console.log('[DEBUG pingDelmor] enqueueRivalText not available, using log fallback');
            log(`📱 Delmor Krunchem: "${line}"`);
          }
        }catch(e){
          console.error('[DEBUG pingDelmor] ERROR:', e);
        }
      }

      if (perkId === "perk-policy-favour"){
        const cost = 15;
        if (!spend(cost)) return;
        // Soft effects: tiny ref tilt or rival annoyance
        S.referee_soft_bias = (S.referee_soft_bias||0) + 5;
        log("You quietly cash in a minor policy favour. Somewhere in an office, a form is 'lost' and a bureaucrat owes you one.");
        pingDelmor("You little rat. I can smell your paperwork tricks from across the south coast.");
      }

      else if (perkId === "perk-emergency-points"){
        const cost = 50;
        if (!spend(cost)) return;
        
        // Update both the HUD points and league table points
        const bonusPoints = 3;
        S.points = (S.points || 0) + bonusPoints;
        
        // Also update the league table entry
        const clubName = S.club_name || "Southampton FC";
        if (typeof ensureTableTeam === 'function') {
          ensureTableTeam(clubName);
        }
        if (!S.table) S.table = {};
        if (!S.table[clubName]) {
          S.table[clubName] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
        }
        S.table[clubName].PTS = (S.table[clubName].PTS || 0) + bonusPoints;
        
        // Update UI
        if (typeof updateHUD === 'function') {
          updateHUD();
        }
        if (typeof renderLeagueTablePanel === 'function') {
          renderLeagueTablePanel();
        }
        
        log("📺 Starmer delivers an emergency statement about 'protecting historic community clubs'. You are awarded three mysterious league points.");
        if (S.press) {
          S.press.last_scandal = "Emergency points package controversy";
        }
        pingDelmor("You got the Prime Minister to hand you points? I will personally burn Westminster to the ground.");
      }

      else if (perkId === "perk-transfer-act"){
        const uses = (S.power_transfer_act_uses|0);
        const cost = uses ? (80 + 20 * uses) : 80;
        if (!spend(cost)) return;
        S.power_transfer_act_uses = uses + 1;
        S.transfer_act_active = true;
        log("Parliament passes a deranged 'Transfer Powers Act'. Your next transfer negotiation will ignore reality and basic economics.");
        pingDelmor("The state is buying you players now? You're not a chairman, you're a government arts project.");
      }

      else if (perkId === "perk-enter-number10"){
        const cost = 120;
        if (S.power_unlocked_number10){
          log("You already have a key to the grubby back room at Number 10.");
          return;
        }
        if (!spend(cost)) return;
        S.power_unlocked_number10 = true;
        log("You are ushered into a private back room at Number 10. The air smells of coffee, fear, and dying principles. The Nuclear Option path is now open.");
        pingDelmor("You got into Number 10? I am going to be sick.");
      }

      else if (perkId === "perk-trident"){
        const cost = 220;
        if (!S.power_unlocked_number10){
          log("Even this government won't discuss Trident with a random chairman. You need serious access first.");
          return;
        }
        if (S.power_unlocked_trident){
          log("You already dragged the world into nuclear farce. Even Kreplin has to draw a line somewhere.");
          return;
        }
        // Check if we're in pre-match phase - Trident can only be launched before a game
        const isInPreMatch = !!(S.preMatch && typeof S.preMatch === 'object');
        if (!isInPreMatch){
          log("⚠️ Trident can only be launched during the pre-match phase, before a game. You must access this option from the pre-match menu, not during the evening phase or other times.");
          return;
        }
        if (!spend(cost)) return;
        S.power_unlocked_trident = true;
        
        // CRITICAL FIX: Store complete UI context for restoration after nuclear sequence
        const wasInPreMatch = !!(S._preMatchMenuActive && S.preMatch);
        const wasInEvening = window.__in_evening_phase || false;
        const savedUIContext = window.__ui_context || 'unknown';
        
        console.log("DEBUG TRIDENT: Starting nuclear sequence");
        console.log("DEBUG TRIDENT: wasInPreMatch:", wasInPreMatch);
        console.log("DEBUG TRIDENT: wasInEvening:", wasInEvening);
        console.log("DEBUG TRIDENT: savedUIContext:", savedUIContext);
        console.log("DEBUG TRIDENT: Current club:", S.club_name);
        
        // Close power network pane BEFORE nuclear sequence to prevent UI conflicts
        togglePowerNetworkPane(false);
        
        // Launch nuclear sequence and wait for it to complete
        console.log("DEBUG TRIDENT: Calling launchNuclearMissile()");
        await launchNuclearMissile();
        console.log("DEBUG TRIDENT: launchNuclearMissile() returned");
        console.log("DEBUG TRIDENT: Current club after nuclear:", S.club_name);
        console.log("DEBUG TRIDENT: DOM state after nuclear - actions:", !!document.getElementById('actions'), "children:", document.getElementById('actions')?.children?.length || 0);
        
        // Refresh the power network display (in case it's opened again later)
        renderPowerNetwork();
        console.log("DEBUG TRIDENT: Power network refreshed");
        
        // CRITICAL FIX: Restore UI context based on where we were when nuclear started
        if (wasInPreMatch && S.preMatch) {
          // The menu's choose() was interrupted. Set a flag to make it continue
          S._preMatchMenuInterrupted = true;
          // The menu loop will check this flag and continue on the next iteration
          log("Returning to pre-match actions...");
          console.log("DEBUG TRIDENT: Set pre-match interruption flag");
        } else if (wasInEvening) {
          console.log("DEBUG TRIDENT: Was in evening phase, checking if UI needs restoration");
          const actionsEl = document.getElementById('actions');
          if (!actionsEl || actionsEl.children.length === 0) {
            console.warn("DEBUG TRIDENT: WARNING - Evening UI may be in bad state!");
            log("⚠️ Returning to evening menu... (If you don't see options, save and reload)");
          }
        } else if (savedUIContext === 'postmatch') {
          // CRITICAL FIX: If we were in postmatch context, the oversight phase or main loop
          // has already completed and we're between phases. The nuclear sequence cleared
          // the UI but there's nothing to resume. We need to signal that the game should
          // continue to the next phase (pre-match menu).
          console.log("DEBUG TRIDENT: Was in postmatch context, setting flag to trigger pre-match menu");
          S._nuclearPostmatchComplete = true;
          log("Continuing to next match preparation...");
        } else {
          // Generic fallback for other contexts
          console.log("DEBUG TRIDENT: Generic context restoration for:", savedUIContext);
          S._nuclearSequenceJustCompleted = true;
        }
        
        console.log("DEBUG TRIDENT: Trident purchase complete, returning from activatePowerPerk");
      }

      else if (perkId === "perk-surveillance"){
        const cost = 10;
        if (!spend(cost)) return;
        S.power_last_espionage = "surveillance";
        log("You unleash a swarm of private detectives on a rival chairman. Their secrets begin to drip into your inbox.");
        pingDelmor("Are there men parked outside my house? You cheap espionage goblin.");
      }

      else if (perkId === "perk-advanced-blackmail"){
        const cost = 25;
        if (!spend(cost)) return;
        S.power_last_espionage = "blackmail";
        S.power_blackmail_pending = true;
        log("You prepare a brutal blackmail package for an upcoming opponent. Someone important will mysteriously 'drop out' before kickoff.");
        pingDelmor("You start blackmailing people and I swear I will go fully subterranean warfare on you.");
      }

      else if (perkId === "perk-briefcase"){
        console.log("[DEBUG BRIEFCASE] activatePowerPerk called for perk-briefcase");
        console.log("[DEBUG BRIEFCASE] power_briefcase_owned:", S.power_briefcase_owned);
        console.log("[DEBUG BRIEFCASE] lobby_tokens:", S.lobby_tokens);
        
        if (S.power_briefcase_owned){
          log("You already own the Ultima Briefcase.");
          return;
        }
        const cost = 10000;
        const currentTokens = S.lobby_tokens || 0;
        console.log("[DEBUG BRIEFCASE] Checking tokens - need:", cost, "have:", currentTokens);
        if (currentTokens < cost) {
          log(`You don't have enough Lobby Tokens. You need ${cost.toLocaleString()} but only have ${currentTokens.toLocaleString()}.`);
          return;
        }
        console.log("[DEBUG BRIEFCASE] Calling spend() with cost:", cost);
        if (!spend(cost)) {
          console.log("[DEBUG BRIEFCASE] spend() returned false");
          return;
        }
        console.log("[DEBUG BRIEFCASE] Setting power_briefcase_owned to true");
        S.power_briefcase_owned = true;
        log("You acquire a heavy, small metal briefcase with a red button. It sits ominously in your office, its purpose yet to be revealed.");
        pingDelmor("What the hell is that? A briefcase? For ten thousand tokens? You're either insane or you know something I don't.");
        console.log("[DEBUG BRIEFCASE] Purchase complete!");
      }
    } catch(e){
      console.error("activatePowerPerk error:", e);
    }
  }

  // Nuclear missile launch sequence
  async function launchNuclearMissile(){
    try {
      const S = window.S || (window.S = {});
      
      // CRITICAL DEBUG: Log complete context at start of nuclear sequence
      console.log("=== DEBUG NUCLEAR: SEQUENCE START ===");
      console.log("DEBUG NUCLEAR: Club name:", S.club_name);
      console.log("DEBUG NUCLEAR: Season:", S.season, "Match:", S.matches_played);
      console.log("DEBUG NUCLEAR: In evening phase:", window.__in_evening_phase || false);
      console.log("DEBUG NUCLEAR: Pre-match active:", S._preMatchMenuActive || false);
      console.log("DEBUG NUCLEAR: Pre-match object exists:", !!S.preMatch);
      console.log("DEBUG NUCLEAR: Current UI context:", window.__ui_context || 'unknown');
      
      // Check DOM state
      const actionsEl = document.getElementById('actions');
      const feedEl = document.getElementById('feed');
      console.log("DEBUG NUCLEAR: DOM state - actions:", !!actionsEl, "children:", actionsEl?.children?.length || 0);
      console.log("DEBUG NUCLEAR: DOM state - feed:", !!feedEl);
      console.log("=================================");
      
      // Check if we're interrupting a pre-match menu
      const wasInPreMatch = !!(S.preMatch && typeof S.preMatch === 'object');
      
      // CRITICAL FIX: Set BOTH flags to interrupt and block the menu
      // The interruption flag makes Promise.race resolve
      // The blocking flag makes the menu loop wait after it resolves
      if (S._preMatchMenuActive && S.preMatch) {
        console.log("DEBUG NUCLEAR: Pre-match menu is active, setting interruption AND blocking flags");
        S._preMatchMenuInterrupted = true; // Makes Promise.race resolve
        S._nuclearSequenceInProgress = true; // Makes menu loop wait
        // Wait for Promise.race to detect the flag
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log("DEBUG NUCLEAR: Flags set, continuing nuclear sequence");
      } else if (S.preMatch) {
        // We're in pre-match but menu isn't actively showing choices
        console.log("DEBUG NUCLEAR: In pre-match phase, setting blocking flag");
        S._nuclearSequenceInProgress = true;
      }
      
      // Ensure opponents list exists
      ensureSeasonSchedule();
      
      // Get all teams except Southampton
      let availableTeams = (S.opponents || ALL_TEAMS.filter(t => t !== "Southampton FC")).filter(t => t !== "Southampton FC");
      
      // Filter out teams with missile defense (e.g., Burger King FC)
      if (S.teamMissileDefense) {
        availableTeams = availableTeams.filter(team => !S.teamMissileDefense[team]);
      }
      
      if (availableTeams.length === 0) {
        log("There are no teams left to target. The nuclear option is pointless now.");
        if (S.teamMissileDefense && Object.keys(S.teamMissileDefense).length > 0) {
          log("🛡️ All remaining teams have invested in missile defense systems.");
        }
        return;
      }
      
      // Create team selection options
      const teamOptions = availableTeams.map(team => ({
        key: team,
        label: team,
        variant: 'warn'
      }));
      teamOptions.push({key: 'cancel', label: 'Cancel', variant: 'good'});
      
      log("🌍 The Prime Minister hands you a secure phone. 'Choose your target. This cannot be undone.'");
      
      const selectedTeam = await choose(teamOptions, 'Which team should the nuclear missile target?');
      
      if (selectedTeam === 'cancel') {
        log("You hand the phone back. The Prime Minister looks relieved.");
        S.power_unlocked_trident = false; // Allow retry
        return;
      }
      
      // Check if team has missile defense (safety check)
      if (S.teamMissileDefense && S.teamMissileDefense[selectedTeam]) {
        log("🛡️ MISSILE DEFENSE ACTIVATED: The target's defense systems intercept the nuclear missile!");
        log("🛡️ The attack fails. The team's investment in missile defense has paid off.");
        log("📱 You receive a text: 'Nice try, you absolute moron. - Delmor Krunchem'");
        return;
      }
      
      // Get city name from team (simple mapping)
      const cityNames = {
        "Arsenal": "London",
        "Aston Villa": "Birmingham",
        "Bournemouth": "Bournemouth",
        "Brentford": "London",
        "Brighton": "Brighton",
        "Chelsea": "London",
        "Crystal Palace": "London",
        "Everton": "Liverpool",
        "Fulham": "London",
        "Liverpool": "Liverpool",
        "Man City": "Manchester",
        "Man United": "Manchester",
        "Newcastle": "Newcastle",
        "Tottenham": "London",
        "Wolves": "Wolverhampton",
        "Portsmouth": "Portsmouth",
        "Burger King FC": "Portsmouth" // Based in the nuked remains of Portsmouth
      };
      
      const targetCity = cityNames[selectedTeam] || selectedTeam.replace(" FC", "").replace("United", "").trim();
      
      log("📞 You speak the coordinates into the phone. 'Target confirmed. Launch in 3... 2... 1...'");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close power network pane before nuclear sequence to avoid UI conflicts
      // This ensures the choose() calls in the interview work properly
      if (typeof togglePowerNetworkPane === 'function') {
        togglePowerNetworkPane(false);
      }
      
      // Play nuclear animation
      await playNuclearAnimation(targetCity);
      
      // Calculate death toll (random but large)
      const deathToll = Math.floor(Math.random() * 500000) + 100000; // 100k-600k
      
      // Log severe message
      logSevere(`⚠️ NUCLEAR DETONATION: ${targetCity} has been completely destroyed.`);
      logSevere(`⚠️ ESTIMATED DEATH TOLL: ${deathToll.toLocaleString()} casualties.`);
      logSevere(`⚠️ RADIOACTIVE FALLOUT: Expected to affect surrounding areas for decades.`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Interview sequence
      await nuclearInterview(selectedTeam, targetCity, deathToll);
      
      // Remove or replace the team
      removeOrReplaceTeam(selectedTeam);
      
      // Arrest and questioning sequence
      await new Promise(resolve => setTimeout(resolve, 2000));
      log("");
      log("🚨 POLICE ARREST: You are immediately taken into custody.");
      log("🚨 You are brought to a police station for questioning about the nuclear attack.");
      await new Promise(resolve => setTimeout(resolve, 2000));
      log("");
      log("👮 Detective: 'You've just destroyed an entire city and killed hundreds of thousands of people. What do you plea?'");
      
      // CRITICAL FIX: Add explicit logging and error handling for plea choice
      console.log("DEBUG NUCLEAR: About to show plea choice");
      console.log("DEBUG NUCLEAR: Current club before plea:", S.club_name);
      console.log("DEBUG NUCLEAR: DOM state before plea - actions element:", !!document.getElementById('actions'));
      
      let plea;
      try {
        plea = await choose([
          {key: 'not_guilty', label: 'Not guilty'},
          {key: 'guilty', label: 'Guilty'},
          {key: 'mental_health', label: 'Blame mental health'}
        ], 'What is your plea?');
        console.log("DEBUG NUCLEAR: Plea received:", plea);
        console.log("DEBUG NUCLEAR: Current club after plea:", S.club_name);
      } catch(pleaError) {
        console.error("DEBUG NUCLEAR: Error in plea choice:", pleaError);
        console.error("DEBUG NUCLEAR: Error stack:", pleaError.stack);
        // Default to not_guilty if choice fails
        plea = 'not_guilty';
        log("⚠️ An error occurred during plea entry. Defaulting to 'Not guilty'.");
      }
      
      console.log("DEBUG NUCLEAR: Plea choice completed, checking DOM state");
      console.log("DEBUG NUCLEAR: DOM state after plea - actions element:", !!document.getElementById('actions'), "children:", document.getElementById('actions')?.children?.length || 0);
      
      // CRITICAL FIX: Always clear choice buttons after plea is selected
      if (typeof clearChoiceButtons === 'function') {
        console.log("DEBUG NUCLEAR: Clearing choice buttons after plea");
        clearChoiceButtons();
      }
      
      // Process the plea
      if (plea === 'not_guilty') {
        log("");
        log("👮 Detective: 'Okay, we'll take your word for it.'");
        log("👮 You are released without charges. The detective seems oddly accepting of your plea.");
      } else if (plea === 'guilty') {
        log("");
        log("👮 Detective: 'You've confessed to mass murder. You'll be imprisoned for three games.'");
        log("🚨 You are sentenced to prison for three games.");
        // Initialize suspensions if it doesn't exist
        if (!S.suspensions) {
          S.suspensions = { prison_games: 0, rehab_games: 0, house_games: 0, krazy_register_games: 0 };
        }
        S.suspensions.prison_games = (S.suspensions.prison_games || 0) + 3;
        S.prison = true;
      } else if (plea === 'mental_health') {
        log("");
        log("👮 Detective: 'Okay, just don't do it again.'");
        log("👮 You are released with a warning. The detective seems to accept your explanation.");
      }
      
      console.log("DEBUG NUCLEAR: Plea processed successfully");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      log("");
      log("🌍 The world watches in horror. The nuclear option has been used. There is no going back.");
      
      console.log("DEBUG NUCLEAR: Nuclear sequence complete, cleaning up and restoring game flow");
      
      // CRITICAL FIX: Close Power Network pane to ensure it's not blocking interaction
      if (typeof togglePowerNetworkPane === 'function') {
        togglePowerNetworkPane(false);
        console.log("DEBUG NUCLEAR: Closed Power Network pane via toggle");
      }
      
      // CRITICAL FIX: Force close any remaining Power Network pane elements
      try {
        const powerPane = document.getElementById('powerNetworkPane');
        if (powerPane) {
          powerPane.style.display = 'none';
          powerPane.remove(); // Completely remove it from DOM
          console.log("DEBUG NUCLEAR: Forcefully removed Power Network pane");
        }
      } catch(paneError) {
        console.error("DEBUG NUCLEAR: Error removing power pane:", paneError);
      }
      
      // CRITICAL FIX: Close any investigation modals that might be open
      try {
        if (typeof window.closeInvestigationModal === 'function') {
          window.closeInvestigationModal();
          console.log("DEBUG NUCLEAR: Closed investigation modal");
        }
        if (window.currentInvestigationModal) {
          window.currentInvestigationModal.remove();
          window.currentInvestigationModal = null;
          console.log("DEBUG NUCLEAR: Removed investigation modal reference");
        }
      } catch(modalError) {
        console.error("DEBUG NUCLEAR: Error closing modals:", modalError);
      }
      
      // CRITICAL FIX: Remove ALL modal overlays
      try {
        const allModals = document.querySelectorAll('.modern-modal-overlay, .modal-overlay, [class*="modal"], [id*="modal"]');
        allModals.forEach(modal => {
          try {
            if (modal.id !== 'mainContent' && !modal.classList.contains('no-remove')) {
              modal.remove();
            }
          } catch(_) {}
        });
        console.log("DEBUG NUCLEAR: Removed all modal overlays");
      } catch(removeError) {
        console.error("DEBUG NUCLEAR: Error removing modals:", removeError);
      }
      
      // CRITICAL FIX: Clear all choice buttons to reset UI state
      if (typeof clearChoiceButtons === 'function') {
        clearChoiceButtons();
      }
      
      // CRITICAL FIX: Clear any stuck actions
      const actionsClearEl = document.getElementById('actions');
      if (actionsClearEl) {
        actionsClearEl.innerHTML = '';
      }
      
      if (typeof updateHUD === 'function') {
        updateHUD();
      }
      
      // CRITICAL FIX: Wait for UI to fully clear
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // CRITICAL FIX: Clear the blocking flag to let the menu loop continue
      console.log("DEBUG NUCLEAR: Clearing nuclear sequence blocking flag to resume menu");
      S._nuclearSequenceInProgress = false;
      S._preMatchMenuActive = false; // Clear active flag
      
      // CRITICAL FIX: Detect current context and restore appropriately
      const inEveningPhase = window.__in_evening_phase || false;
      const inPreMatch = !!(S.preMatch && typeof S.preMatch === 'object');
      const currentUIContext = window.__ui_context || 'unknown';
      const currentClubName = S.club_name || "Unknown";
      
      console.log("DEBUG NUCLEAR: Context check - inEveningPhase:", inEveningPhase, "inPreMatch:", inPreMatch, "UIContext:", currentUIContext, "club:", currentClubName);
      
      // Handle restoration based on context
      if (inPreMatch) {
        // Pre-match menu was active - set flag to force menu restoration
        S._preMatchMenuNeedsRestore = true;
        console.log("DEBUG NUCLEAR: Set menu restore flag for pre-match menu");
      } else if (inEveningPhase) {
        // Evening phase was active - force UI refresh
        console.log("DEBUG NUCLEAR: In evening phase, forcing UI refresh");
        S._eveningMenuNeedsRestore = true;
        
        // Check if we need to warn the player about save/reload
        const actionsElCheck = document.getElementById('actions');
        const hasButtons = actionsElCheck && actionsElCheck.children.length > 0;
        console.log("DEBUG NUCLEAR: Evening UI state - actions element exists:", !!actionsElCheck, "has buttons:", hasButtons);
        
        if (!hasButtons) {
          console.warn("DEBUG NUCLEAR: WARNING - No action buttons found after nuclear sequence in evening phase!");
          console.warn("DEBUG NUCLEAR: Player may need to save and reload to continue");
          log("");
          log("⚠️ <strong style='color:#ff4444;'>WARNING: UI Issue Detected</strong>");
          log("⚠️ If you don't see any menu options below, the game may be in an inconsistent state.");
          log("⚠️ <strong>RECOMMENDED:</strong> Save your game now and reload it to continue safely.");
          log("⚠️ This is a known issue when nuking teams from certain menus.");
          log("");
          
          // Set a timer to check if buttons reappear
          setTimeout(() => {
            const actionsElDelayCheck = document.getElementById('actions');
            const hasButtonsDelayCheck = actionsElDelayCheck && actionsElDelayCheck.children.length > 0;
            console.log("DEBUG NUCLEAR: Post-delay check - has buttons:", hasButtonsDelayCheck);
            if (!hasButtonsDelayCheck) {
              log("⚠️ <strong style='color:#ff0000;'>CRITICAL:</strong> Menu buttons did not restore. Please SAVE and RELOAD your game immediately.");
            }
          }, 1000);
        }
      } else if (currentUIContext === 'postmatch') {
        // CRITICAL FIX: Nuclear was triggered during postmatch/oversight phase
        // The oversight phase has likely already completed and there's no active menu to restore
        // Set a flag so the main loop knows to skip oversightPhase and continue
        console.log("DEBUG NUCLEAR: In postmatch context - setting flag for main loop to continue");
        S._nuclearPostmatchComplete = true;
        log("Nuclear sequence complete. Continuing to next match preparation...");
      } else {
        // Generic fallback for any other context
        console.log("DEBUG NUCLEAR: Unknown or generic context (" + currentUIContext + ") - setting generic completion flag");
        S._nuclearSequenceJustCompleted = true;
        
        // Check if UI needs attention
        const actionsElCheck = document.getElementById('actions');
        const hasButtons = actionsElCheck && actionsElCheck.children.length > 0;
        if (!hasButtons) {
          console.warn("DEBUG NUCLEAR: WARNING - No action buttons found after nuclear sequence!");
          log("");
          log("⚠️ Nuclear sequence complete. If you don't see menu options, save and reload your game.");
          log("");
        }
      }
      
      console.log("DEBUG NUCLEAR: Nuclear sequence complete, restoration flags set");
      
    } catch(e) {
      console.error("launchNuclearMissile error:", e);
      log("An error occurred during the nuclear launch sequence.");
      // Ensure power network pane is closed even if there's an error
      try {
        if (typeof togglePowerNetworkPane === 'function') {
          togglePowerNetworkPane(false);
          console.log("DEBUG NUCLEAR: Closed Power Network pane in error handler");
        }
        // Force remove pane from DOM
        const powerPane = document.getElementById('powerNetworkPane');
        if (powerPane) {
          powerPane.remove();
          console.log("DEBUG NUCLEAR: Removed Power Network pane in error handler");
        }
        // Close investigation modals
        if (typeof window.closeInvestigationModal === 'function') {
          window.closeInvestigationModal();
        }
        if (window.currentInvestigationModal) {
          window.currentInvestigationModal.remove();
          window.currentInvestigationModal = null;
        }
        // Remove all modal overlays
        const allModals = document.querySelectorAll('.modern-modal-overlay, .modal-overlay');
        allModals.forEach(modal => {
          try { modal.remove(); } catch(_) {}
        });
      } catch(closeError) {
        console.error("Error closing modals/panes in error handler:", closeError);
      }
      
      // CRITICAL FIX: Clear blocking flag even on error
      console.log("DEBUG NUCLEAR: Error occurred, clearing blocking flag");
      S._nuclearSequenceInProgress = false;
      S._preMatchMenuActive = false;
      
      // CRITICAL FIX: Set flag to force menu restoration even on error
      if (S.preMatch && typeof S.preMatch === 'object') {
        S._preMatchMenuNeedsRestore = true;
        console.log("DEBUG NUCLEAR: Set menu restore flag after error");
      }
      
      console.log("DEBUG NUCLEAR: Error recovery - blocking flag cleared, menu should resume");
      
      // Clear any stuck UI state
      if (typeof clearChoiceButtons === 'function') {
        clearChoiceButtons();
      }
      const actionsEl = document.getElementById('actions');
      if (actionsEl) {
        actionsEl.innerHTML = '';
      }
      if (typeof updateHUD === 'function') {
        updateHUD();
      }
    }
  }
  
  // Play crude nuclear animation
  async function playNuclearAnimation(cityName) {
    return new Promise((resolve) => {
      // Create overlay for animation
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      canvas.style.cssText = 'border: 2px solid #fff; background: #1a1a2e;';
      overlay.appendChild(canvas);
      document.body.appendChild(overlay);
      
      const ctx = canvas.getContext('2d');
      let frame = 0;
      const totalFrames = 180; // 3 seconds at 60fps
      
      // Cityscape (simple skyline) - pre-generate window pattern
      const windowPattern = [];
      const buildings = [
        {x: 100, y: 400, w: 60, h: 200},
        {x: 180, y: 350, w: 50, h: 250},
        {x: 250, y: 380, w: 70, h: 220},
        {x: 340, y: 320, w: 60, h: 280},
        {x: 420, y: 360, w: 55, h: 240},
        {x: 500, y: 340, w: 65, h: 260},
        {x: 590, y: 310, w: 70, h: 290},
        {x: 680, y: 370, w: 50, h: 230}
      ];
      
      // Pre-generate window pattern once
      buildings.forEach((b, bi) => {
        for (let wy = b.y + 10; wy < b.y + b.h - 10; wy += 30) {
          for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 20) {
            if (Math.random() > 0.3) {
              windowPattern.push({x: wx, y: wy, building: bi});
            }
          }
        }
      });
      
      function drawCityscape() {
        ctx.fillStyle = '#2d2d44';
        buildings.forEach(b => {
          ctx.fillRect(b.x, b.y, b.w, b.h);
        });
        // Draw windows from pre-generated pattern
        ctx.fillStyle = '#ffd700';
        windowPattern.forEach(w => {
          ctx.fillRect(w.x, w.y, 8, 12);
        });
      }
      
      function animate() {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw stars
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
          const x = (i * 37) % canvas.width;
          const y = (i * 73) % 300;
          ctx.fillRect(x, y, 2, 2);
        }
        
        if (frame < 60) {
          // Warhead falling
          drawCityscape();
          const warheadY = 50 + (frame * 5);
          ctx.fillStyle = '#888';
          ctx.beginPath();
          ctx.arc(400, warheadY, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(400, warheadY, 10, 0, Math.PI * 2);
          ctx.fill();
          // Trail
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(400, warheadY - 30);
          ctx.lineTo(400, warheadY);
          ctx.stroke();
        } else if (frame < 90) {
          // Explosion with dramatic flash
          const explosionSize = (frame - 60) * 8;
          
          // Flash effect - white flash on impact
          if (frame === 60) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            drawCityscape();
            
            // Main explosion
            const gradient = ctx.createRadialGradient(400, 400, 0, 400, 400, explosionSize);
            gradient.addColorStop(0, '#ffff00');
            gradient.addColorStop(0.2, '#ffaa00');
            gradient.addColorStop(0.4, '#ff6600');
            gradient.addColorStop(0.6, '#ff0000');
            gradient.addColorStop(0.8, '#cc0000');
            gradient.addColorStop(1, '#880000');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(400, 400, explosionSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Shockwave rings
            if (frame > 65) {
              const ringSize = (frame - 65) * 15;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(400, 400, ringSize, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        } else {
          // Mushroom cloud
          drawCityscape();
          const cloudAge = frame - 90;
          const cloudHeight = Math.min(300, cloudAge * 3);
          const cloudWidth = Math.min(200, cloudAge * 2);
          
          // Stem
          ctx.fillStyle = '#666';
          ctx.fillRect(395, 400, 10, cloudHeight);
          
          // Cloud top
          const gradient = ctx.createRadialGradient(400, 400 - cloudHeight, 0, 400, 400 - cloudHeight, cloudWidth);
          gradient.addColorStop(0, '#fff');
          gradient.addColorStop(0.5, '#ccc');
          gradient.addColorStop(1, '#888');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(400, 400 - cloudHeight, cloudWidth, 0, Math.PI * 2);
          ctx.fill();
          
          // Additional cloud layers
          ctx.beginPath();
          ctx.arc(400 - 30, 400 - cloudHeight - 20, cloudWidth * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(400 + 30, 400 - cloudHeight - 20, cloudWidth * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        
        frame++;
        if (frame < totalFrames) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            document.body.removeChild(overlay);
            resolve();
          }, 1000);
        }
      }
      
      // Start animation
      animate();
    });
  }
  
  // Log severe message with special styling
  function logSevere(msg) {
    const feedEl = document.getElementById('feed');
    if (!feedEl) {
      log(msg);
      return;
    }
    
    const d = document.createElement('div');
    d.className = 'entry log-entry';
    d.style.cssText = `
      background: #2d0000 !important;
      border: 3px solid #ff0000 !important;
      color: #ff6666 !important;
      font-weight: bold !important;
      font-size: 1.2em !important;
      padding: 15px !important;
      animation: pulse 1s infinite !important;
    `;
    d.innerHTML = `<div class="t">${now()}</div><div class="m">${msg}</div>`;
    feedEl.appendChild(d);
    
    // Scroll to entry
    setTimeout(() => {
      d.scrollIntoView({behavior: 'smooth', block: 'end'});
    }, 100);
  }
  
  // Nuclear interview sequence
  async function nuclearInterview(teamName, cityName, deathToll) {
    const S = window.S || (window.S = {});
    
    log("");
    log("📰 A reporter from The Sun approaches you with a microphone.");
    log(`📰 "Mr. Chairman, you've just launched a nuclear weapon at ${cityName}, destroying ${teamName} and killing ${deathToll.toLocaleString()} people. What do you have to say?"`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log("");
    log("Craft your three-part response...");
    
    const quoteCategories = [
      {key: 'cynical', label: 'Cynical (business perspective)', variant: 'bad'},
      {key: 'heartfelt', label: 'Heartfelt (remorseful)', variant: 'good'},
      {key: 'humorous', label: 'Humorous (dark comedy)', variant: 'warn'},
      {key: 'lecherous', label: 'Lecherous (hit on reporter)', variant: 'bad'}
    ];
    
    // Part 1: Opening category
    const openingCat = await choose(
      quoteCategories.map(cat => ({key: cat.key, label: `[PART 1] ${cat.label}`, variant: cat.variant})),
      '📰 PART 1: Choose your opening category:'
    );
    
    // Part 2: Middle category
    const middleCat = await choose(
      quoteCategories.map(cat => ({key: cat.key, label: `[PART 2] ${cat.label}`, variant: cat.variant})),
      '📰 PART 2: Choose your middle category:'
    );
    
    // Part 3: Closing category
    const closingCat = await choose(
      quoteCategories.map(cat => ({key: cat.key, label: `[PART 3] ${cat.label}`, variant: cat.variant})),
      '📰 PART 3: Choose your closing category:'
    );
    
    const quote = generateThreePartConversationLine(openingCat, middleCat, closingCat);
    
    log("");
    log(`📰 Press Quote (published):`);
    log(`Part 1: ${quoteCategories.find(c => c.key === openingCat)?.label || openingCat}`);
    log(`Part 2: ${quoteCategories.find(c => c.key === middleCat)?.label || middleCat}`);
    log(`Part 3: ${quoteCategories.find(c => c.key === closingCat)?.label || closingCat}`);
    log(`"${quote}"`);
    log("");
    
    // Effects based on quote tone
    const cats = [openingCat, middleCat, closingCat];
    const cynicalCount = cats.filter(k => k === 'cynical').length;
    const heartfeltCount = cats.filter(k => k === 'heartfelt').length;
    const humorousCount = cats.filter(k => k === 'humorous').length;
    const lecherousCount = cats.filter(k => k === 'lecherous').length;
    
    if (lecherousCount >= 2) {
      log("📰 The reporter looks uncomfortable and quickly ends the interview.");
      log("⚠️ Your reputation takes a hit for inappropriate behavior during a crisis.");
      S.reputation = Math.max(0, (S.reputation || 50) - 10);
    } else if (heartfeltCount >= 2) {
      log("📰 The reporter seems moved by your apparent remorse.");
      log("📈 Some people appreciate your humanity in this dark moment.");
      S.reputation = Math.min(100, (S.reputation || 50) + 5);
    } else if (humorousCount >= 2) {
      log("📰 The reporter looks shocked at your dark humor.");
      log("📉 Public opinion is divided - some find it tasteless, others... amused?");
    } else if (cynicalCount >= 2) {
      log("📰 The reporter writes furiously. Your cold pragmatism will make headlines.");
      log("💰 Business leaders secretly admire your ruthlessness.");
      S.chairman_cash = (S.chairman_cash || 0) + 50000;
    }
    
    // Publish to press
    if (typeof initPressSystem === 'function') initPressSystem();
    const chairName = S.full_name || 'The Southampton chairman';
    const headline = `Chairman's Statement on Nuclear Attack: "${quote.slice(0, 50)}..."`;
    const body = `Following the nuclear destruction of ${cityName}, ${chairName} gave the following statement to reporters: "${quote}"`;
    if (typeof createStory === 'function' && typeof queueStory === 'function') {
      const story = createStory('gossip', headline, body, { subject: teamName }, {}, 'nuclear_quote', 10);
      queueStory(story);
    }
    
    // Interview complete - no need to wait for continue button
    // The nuclear sequence will complete and return control naturally
    log("");
    log("📰 The interview concludes. The world watches as you return to your duties.");
  }
  
  // Remove or replace targeted team
  function removeOrReplaceTeam(teamName) {
    const S = window.S || (window.S = {});
    
    // Array of shit teams that can replace nuked teams
    const shitTeams = [
      "Scunthorpe United",
      "Grimsby Town",
      "Accrington Stanley",
      "Morecambe FC",
      "Forest Green Rovers",
      "Burton Albion",
      "Stevenage FC",
      "Crawley Town",
      "Salford City",
      "Harrogate Town"
    ];
    
    // Track which shit teams have already been used
    if (!S.usedShitTeams) S.usedShitTeams = [];
    
    // SPECIAL CASE: If nuking Portsmouth, replace with Burger King FC
    const isPortsmouth = teamName === "Portsmouth" || teamName.toLowerCase().includes("portsmouth") || teamName.toLowerCase().includes("pompey");
    let replacementTeam;
    let replacementManager;
    
    if (isPortsmouth) {
      replacementTeam = "Burger King FC";
      replacementManager = "Delmor Krunchem"; // Keep Delmor as manager/chairman
      
      // Use unified rename system to handle the transition
      renameTeam(teamName, replacementTeam, {
        isPlayerClub: false,
        updateRival: true  // This IS the rival team
      });
      
      // Mark Burger King FC as having missile defense (can't be nuked again)
      if (!S.teamMissileDefense) S.teamMissileDefense = {};
      S.teamMissileDefense["Burger King FC"] = true;
      
      log(`⚽ ${teamName} has been replaced in the league by ${replacementTeam}.`);
      log(`🍔 BREAKING NEWS: Burger King makes massive investment in the nuked remains of Portsmouth!`);
      log(`🍔 Delmor Krunchem remains as chairman of the newly formed Burger King FC.`);
      log(`🛡️ Burger King FC announces investment in state-of-the-art missile defense systems.`);
      log(`🛡️ "We're not making that mistake twice," says Krunchem. "This club is now nuclear-proof."`);
    } else {
      // For other teams, pick a random shit team that hasn't been used yet
      const availableShitTeams = shitTeams.filter(team => !S.usedShitTeams.includes(team));
      
      if (availableShitTeams.length === 0) {
        // If all shit teams are used, reset and reuse them
        S.usedShitTeams = [];
        replacementTeam = shitTeams[Math.floor(Math.random() * shitTeams.length)];
      } else {
        replacementTeam = availableShitTeams[Math.floor(Math.random() * availableShitTeams.length)];
      }
      
      S.usedShitTeams.push(replacementTeam);
      
      // Fitting manager names for shit teams
      const shitManagers = [
        "Terry Disaster",
        "Dave Catastrophe",
        "Steve Failure",
        "Mike Defeat",
        "John Collapse",
        "Paul Ruin",
        "Mark Debacle"
      ];
      replacementManager = shitManagers[Math.floor(Math.random() * shitManagers.length)];
      
      log(`⚽ ${teamName} has been replaced in the league by ${replacementTeam} (a team that will struggle to win).`);
    }
    
    // Check if team is in opponents array
    // (Skip for Portsmouth since renameTeam() already handled it)
    if (!isPortsmouth && S.opponents && Array.isArray(S.opponents)) {
      const teamIndex = S.opponents.indexOf(teamName);
      if (teamIndex !== -1) {
        // Replace with replacement team instead of removing (less volatile)
        S.opponents[teamIndex] = replacementTeam;
        
        // Also update opponent managers if it exists
        if (S.opponentManagers && Array.isArray(S.opponentManagers)) {
          S.opponentManagers[teamIndex] = replacementManager;
        }
        
        // Remove old team from table completely and initialize new team
        // (For non-Portsmouth teams only - Portsmouth handled by renameTeam())
        if (S.table) {
          // Delete the old team's table entry completely
          if (S.table[teamName]) {
            delete S.table[teamName];
          }
          
          // Calculate average games played by other teams to maintain league consistency
          let avgGamesPlayed = 0;
          const tableEntries = Object.values(S.table);
          if (tableEntries.length > 0) {
            const gamesPlayedArray = tableEntries
              .map(team => team.P || 0)
              .filter(games => games > 0); // Only count teams that have played games
            
            if (gamesPlayedArray.length > 0) {
              // Use median for more stability, fallback to average
              gamesPlayedArray.sort((a, b) => a - b);
              const mid = Math.floor(gamesPlayedArray.length / 2);
              avgGamesPlayed = gamesPlayedArray.length % 2 === 0
                ? Math.round((gamesPlayedArray[mid - 1] + gamesPlayedArray[mid]) / 2)
                : gamesPlayedArray[mid];
            }
          }
          
          // Initialize the replacement team with same games played as others, but 0 points
          if (!S.table[replacementTeam]) {
            // Set games played to match other teams, with all losses (0 points)
            S.table[replacementTeam] = { 
              P: avgGamesPlayed,  // Match other teams' games played
              W: 0, 
              D: 0, 
              L: avgGamesPlayed,  // All losses to ensure 0 points
              GF: 0, 
              GA: Math.max(0, Math.round(avgGamesPlayed * 2.5)),  // Rough estimate for goals against
              GD: 0, 
              PTS: 0  // Start with 0 points as requested
            };
            
            // Calculate goal difference
            S.table[replacementTeam].GD = S.table[replacementTeam].GF - S.table[replacementTeam].GA;
            
            if (avgGamesPlayed > 0) {
              log(`⚽ ${replacementTeam} enters the league with ${avgGamesPlayed} games played (matching league average) but 0 points.`);
            } else {
              log(`⚽ ${replacementTeam} enters the league as a new team.`);
            }
          } else {
            // If team already exists, update games played to match others while preserving existing stats
            const existingGames = S.table[replacementTeam].P || 0;
            if (existingGames < avgGamesPlayed && avgGamesPlayed > 0) {
              const gamesToAdd = avgGamesPlayed - existingGames;
              const currentW = S.table[replacementTeam].W || 0;
              const currentD = S.table[replacementTeam].D || 0;
              const currentL = S.table[replacementTeam].L || 0;
              
              // Update games played
              S.table[replacementTeam].P = avgGamesPlayed;
              
              // Add losses to maintain 0 points (if currently at 0) or preserve current record
              if (S.table[replacementTeam].PTS === 0) {
                S.table[replacementTeam].L = currentL + gamesToAdd;
              } else {
                // If they somehow have points, just adjust to match games played
                // This shouldn't happen for a "shit team" but handle it gracefully
                const currentTotal = currentW + currentD + currentL;
                if (currentTotal < avgGamesPlayed) {
                  S.table[replacementTeam].L = currentL + (avgGamesPlayed - currentTotal);
                }
              }
              
              // Ensure W+D+L = P
              const total = (S.table[replacementTeam].W || 0) + (S.table[replacementTeam].D || 0) + (S.table[replacementTeam].L || 0);
              if (total !== avgGamesPlayed) {
                S.table[replacementTeam].L = avgGamesPlayed - (S.table[replacementTeam].W || 0) - (S.table[replacementTeam].D || 0);
              }
              
              // Update goals against estimate if needed
              if (!S.table[replacementTeam].GA || S.table[replacementTeam].GA === 0) {
                S.table[replacementTeam].GA = Math.round(avgGamesPlayed * 2.5);
              }
              S.table[replacementTeam].GD = (S.table[replacementTeam].GF || 0) - S.table[replacementTeam].GA;
              
              log(`⚽ ${replacementTeam} games played adjusted to ${avgGamesPlayed} to match league consistency.`);
            }
          }
        }
      }
    }
    
    // Also remove from ALL_TEAMS if it's there (for future seasons)
    // Note: We can't modify the const, but we can track it in state
    if (!S.destroyedTeams) S.destroyedTeams = [];
    if (!S.destroyedTeams.includes(teamName)) {
      S.destroyedTeams.push(teamName);
    }
  }

  // Helper function to check if a team is Portsmouth or Burger King FC (surrogate Portsmouth)
  function isPortsmouthOrSurrogate(teamName) {
    if (!teamName) return false;
    const nameLower = teamName.toLowerCase();
    return nameLower.includes('portsmouth') || 
           nameLower.includes('pompey') || 
           nameLower.includes('burger king') ||
           teamName === "Burger King FC";
  }

window.ensurePowerNetworkPane = ensurePowerNetworkPane;
window.togglePowerNetworkPane = togglePowerNetworkPane;
window.renderPowerNetwork = renderPowerNetwork;

// Wire the fixed HUD button for Power Network
function wirePowerNetworkButton(){
  try{
    const btn = document.getElementById('openPowerNetworkBtn');
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    const fresh = document.getElementById('openPowerNetworkBtn');
    fresh.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      try{
        togglePowerNetworkPane();
      }catch(err){
        console.warn('togglePowerNetworkPane failed:', err);
      }
    });
  }catch(e){
    console.warn('wirePowerNetworkButton failed:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wirePowerNetworkButton);
} else {
  wirePowerNetworkButton();
}

  // Hook the HUD button (and de-dupe if needed)
// DISABLED: Complex inventory UI setup - replaced with simple approach
window.ensureInventoryUI = function(){
  console.log('ensureInventoryUI called');
  
  // If your HUD already renders a dedicated button:
  const btns = document.querySelectorAll('#openInvBtn');
  if (btns.length > 1) btns.forEach((b,i)=> i>0 && b.remove());
  const btn = document.getElementById('openInvBtn');
  if (btn){
    console.log('Inventory button found, wiring click handler');
    // Remove any existing listeners by cloning the button
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    
    // Add the click handler
    clone.addEventListener('click', function(e) {
      console.log('Inventory button clicked!');
      e.preventDefault();
      e.stopPropagation();
      toggleInventoryPane(true);
    });
    
    console.log('Inventory button click handler attached successfully');
  } else {
    console.log('No inventory button found, creating fallback tab');
    // fallback: create a tab if the HUD button isn't present in this skin
    const nav = document.querySelector('#topNav, header, .nav, #nav') || document.body;
    let tab = document.getElementById('inventoryTab');
    if (!tab){
      tab = document.createElement('button');
      tab.id = 'inventoryTab';
      tab.textContent = 'Inventory';
      tab.className = 'pill';
      tab.style.marginLeft = '8px';
      nav.appendChild(tab);
    }
    tab.replaceWith(tab.cloneNode(true));
    tab = document.getElementById('inventoryTab');
    tab.addEventListener('click', ()=>toggleInventoryPane(true));
  }

  // Make sure pane exists so the click immediately works
  ensureInventoryPane();
  
  // Now that inventory functions are loaded, ensure the button is properly set up
  setTimeout(() => {
    console.log('Inventory functions loaded, setting up button');
    const btn = document.getElementById('openInvBtn');
    if (btn) {
      // Remove any existing listeners
      btn.removeAttribute('data-listener-attached');
      btn.onclick = null;
      
      // Add the click handler
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Inventory button clicked (post-load handler)!');
        toggleInventoryPane(true);
      });
      
      btn.setAttribute('data-listener-attached', 'true');
      console.log('Inventory button setup complete (post-load)');
    }
  }, 100);
  
  // Call bootWire after inventory functions are exposed
  if (typeof window.bootWire === 'function') {
    console.log('Calling bootWire from inventory IIFE');
    window.bootWire();
  }
};

// Doctor Management UI
(function(){
  // Ensure doctor state in save data
  function ensureDoctorState(){
    if (!S.doctor) S.doctor = { 
      hgh_stock: 0, 
      ozempic_stock: 0, 
      disorder_certificates: [],
      hgh_muscular: false,
      hgh_handsome: false
    };
    if (!Array.isArray(S.doctor.disorder_certificates)) S.doctor.disorder_certificates = [];
    return S.doctor;
  }

  // Create doctor pane
  function ensureDoctorPane(){
    let pane = document.getElementById('doctorPane');
    if (!pane){
      pane = document.createElement('div');
      pane.id = 'doctorPane';
      pane.style.display = 'none';
      pane.style.position = 'relative';
      pane.style.margin = '12px 0';
      pane.style.padding = '12px';
      pane.style.border = '1px solid rgba(255,255,255,0.12)';
      pane.style.borderRadius = '4px';
      pane.style.background = 'rgba(0,0,0,0.25)';

      const h = document.createElement('div');
      h.textContent = '🩺 Doctor\'s Office';
      h.style.fontWeight = '600';
      h.style.marginBottom = '8px';
      pane.appendChild(h);

      const content = document.createElement('div');
      content.id = 'doctorContent';
      pane.appendChild(content);

      const close = document.createElement('button');
      close.textContent = 'Close';
      close.style.marginTop = '8px';
      close.addEventListener('click', ()=>toggleDoctorPane(false));
      pane.appendChild(close);

      // Mount after dialogue panel
      const dialoguePanel = document.getElementById('dialoguePanel');
      if (dialoguePanel && dialoguePanel.parentNode) {
        dialoguePanel.parentNode.insertBefore(pane, dialoguePanel.nextSibling);
      } else {
        document.body.appendChild(pane);
      }
    }
  }

  function toggleDoctorPane(show){
    ensureDoctorPane();
    const pane = document.getElementById('doctorPane');
    pane.style.display = show ? 'block' : 'none';
    if (show) renderDoctor();
  }

  function renderDoctor(){
    ensureDoctorState();
    const content = document.getElementById('doctorContent');
    if (!content) return;

    content.innerHTML = '';

    // Current status
    const status = document.createElement('div');
    status.style.marginBottom = '12px';
    status.style.padding = '8px';
    status.style.background = 'rgba(255,255,255,0.1)';
    status.style.borderRadius = '4px';
    
    let statusText = 'Current Status:<br>';
    if (S.std_state === 'untreated') statusText += '🦠 STD (untreated)<br>';
    if (S.very_bad_std_state === 'infected') statusText += '🩸 Very Bad STD (infected)<br>';
    if (S.obese) statusText += '🍔 Obese<br>';
    if (S.doctor.hgh_muscular) statusText += '💪 Very Muscular (HGH)<br>';
    if (S.doctor.hgh_handsome) statusText += '😍 Very Handsome (HGH)<br>';
    if (statusText === 'Current Status:<br>') statusText += '✅ Healthy';
    
    status.innerHTML = statusText;
    content.appendChild(status);

    // Medicine section
    const medicineSection = document.createElement('div');
    medicineSection.style.marginBottom = '12px';
    
    const medHeader = document.createElement('h4');
    medHeader.textContent = '💊 Buy Medicine';
    medHeader.style.margin = '0 0 8px 0';
    medicineSection.appendChild(medHeader);

    // HGH
    const hghDiv = document.createElement('div');
    hghDiv.style.marginBottom = '8px';
    hghDiv.innerHTML = `
      <button onclick="buyHGH()" style="margin-right: 8px;">Buy HGH (£50,000)</button>
      <span>Stock: ${S.doctor.hgh_stock}</span>
    `;
    medicineSection.appendChild(hghDiv);

    // Ozempic
    const ozempicDiv = document.createElement('div');
    ozempicDiv.style.marginBottom = '8px';
    ozempicDiv.innerHTML = `
      <button onclick="buyOzempic()" style="margin-right: 8px;">Buy Ozempic (£25,000)</button>
      <span>Stock: ${S.doctor.ozempic_stock}</span>
    `;
    medicineSection.appendChild(ozempicDiv);

    content.appendChild(medicineSection);

    // Use medicine section
    const useSection = document.createElement('div');
    useSection.style.marginBottom = '12px';
    
    const useHeader = document.createElement('h4');
    useHeader.textContent = '💉 Use Medicine';
    useHeader.style.margin = '0 0 8px 0';
    useSection.appendChild(useHeader);

    if (S.doctor.hgh_stock > 0) {
      const useHghBtn = document.createElement('button');
      useHghBtn.textContent = 'Take HGH';
      useHghBtn.style.marginRight = '8px';
      useHghBtn.onclick = () => takeHGH();
      useSection.appendChild(useHghBtn);
    }

    if (S.doctor.ozempic_stock > 0 && S.obese) {
      const useOzempicBtn = document.createElement('button');
      useOzempicBtn.textContent = 'Take Ozempic';
      useOzempicBtn.style.marginRight = '8px';
      useOzempicBtn.onclick = () => takeOzempic();
      useSection.appendChild(useOzempicBtn);
    }

    content.appendChild(useSection);

    // STD Treatment section
    const stdSection = document.createElement('div');
    stdSection.style.marginBottom = '12px';
    
    const stdHeader = document.createElement('h4');
    stdHeader.textContent = '🦠 STD Treatment';
    stdHeader.style.margin = '0 0 8px 0';
    stdSection.appendChild(stdHeader);

    if (S.std_state === 'untreated') {
      const treatStdBtn = document.createElement('button');
      treatStdBtn.textContent = 'Treat STD (£8,000)';
      treatStdBtn.style.marginRight = '8px';
      treatStdBtn.onclick = () => treatSTD();
      stdSection.appendChild(treatStdBtn);
    }

    if (S.very_bad_std_state === 'infected') {
      const treatVeryBadStdBtn = document.createElement('button');
      treatVeryBadStdBtn.textContent = 'Treat Very Bad STD (£1,000,000)';
      treatVeryBadStdBtn.style.marginRight = '8px';
      treatVeryBadStdBtn.onclick = () => treatVeryBadSTD();
      stdSection.appendChild(treatVeryBadStdBtn);
    }

    if (S.std_state !== 'untreated' && S.very_bad_std_state !== 'infected') {
      const noStdText = document.createElement('span');
      noStdText.textContent = 'No STD treatment needed';
      noStdText.style.color = '#888';
      stdSection.appendChild(noStdText);
    }

    content.appendChild(stdSection);

    // Diagnostic Interview section
    const diagSection = document.createElement('div');
    diagSection.style.marginBottom = '12px';
    
    const diagHeader = document.createElement('h4');
    diagHeader.textContent = '🧠 Diagnostic Interview';
    diagHeader.style.margin = '0 0 8px 0';
    diagSection.appendChild(diagHeader);

    const diagBtn = document.createElement('button');
    diagBtn.textContent = 'Have Diagnostic Interview (£100,000)';
    diagBtn.onclick = () => startDiagnosticInterview();
    diagSection.appendChild(diagBtn);

    content.appendChild(diagSection);

    // Disorder Certificates section
    if (S.doctor.disorder_certificates.length > 0) {
      const certSection = document.createElement('div');
      certSection.style.marginBottom = '12px';
      
      const certHeader = document.createElement('h4');
      certHeader.textContent = '📜 Disorder Certificates';
      certHeader.style.margin = '0 0 8px 0';
      certSection.appendChild(certHeader);

      S.doctor.disorder_certificates.forEach((cert, index) => {
        const certDiv = document.createElement('div');
        certDiv.style.marginBottom = '4px';
        certDiv.style.padding = '4px';
        certDiv.style.background = 'rgba(255,255,255,0.1)';
        certDiv.style.borderRadius = '2px';
        certDiv.innerHTML = `
          <span>${cert.type} (${cert.used ? 'Used' : 'Available'})</span>
        `;
        certSection.appendChild(certDiv);
      });

      content.appendChild(certSection);
    }
  }


  // Medicine functions
  window.buyHGH = function(){
    if ((S.chairman_cash || 0) < 50000) {
      log('You cannot afford HGH (£50,000).');
      return;
    }
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 50000);
    S.doctor.hgh_stock = (S.doctor.hgh_stock || 0) + 1;
    log('You buy HGH for £50,000.');
    updateHUD?.(); renderDoctor();
  };

  window.buyOzempic = function(){
    if ((S.chairman_cash || 0) < 25000) {
      log('You cannot afford Ozempic (£25,000).');
      return;
    }
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 25000);
    S.doctor.ozempic_stock = (S.doctor.ozempic_stock || 0) + 1;
    log('You buy Ozempic for £25,000.');
    updateHUD?.(); renderDoctor();
  };

  window.takeHGH = function(){
    if (S.doctor.hgh_stock <= 0) {
      log('You don\'t have any HGH.');
      return;
    }
    S.doctor.hgh_stock--;
    S.doctor.hgh_muscular = true;
    S.doctor.hgh_handsome = true;
    log('You take HGH. You are now suddenly very muscular and handsome!');
    log('Your seduction chances at the nightclub have significantly improved.');
    updateHUD?.(); renderDoctor();
  };

  window.takeOzempic = function(){
    if (S.doctor.ozempic_stock <= 0) {
      log('You don\'t have any Ozempic.');
      return;
    }
    if (!S.obese) {
      log('You don\'t need Ozempic - you\'re not obese.');
      return;
    }
    S.doctor.ozempic_stock--;
    S.obese = false;
    log('You take Ozempic. Your obesity is cured!');
    log('You can now attempt seduction at nightclubs again.');
    updateHUD?.(); renderDoctor();
  };
  
  // Cure team obesity from McDonald's with ozempic in locker room
  window.cureTeamObesity = async function(){
    if (!S.doctor || (S.doctor.ozempic_stock || 0) <= 0) {
      log('You don\'t have any Ozempic in stock. Buy some from the doctor first.');
      return;
    }
    
    // Check if any players are obese from McDonald's
    const obesePlayers = Array.isArray(S.squad) ? S.squad.filter(p => p.obese) : [];
    if (obesePlayers.length === 0) {
      log('No players are obese. Nothing to cure.');
      return;
    }
    
    // Need multiple ozempic doses - one per player
    const needed = obesePlayers.length;
    const stock = S.doctor.ozempic_stock || 0;
    
    if (stock < needed) {
      log(`You need ${needed} doses of Ozempic but only have ${stock}. Buy more from the doctor.`);
      return;
    }
    
    const confirm = await choose([
      {key: "yes", label: `Use ${needed} doses of Ozempic to cure all players`},
      {key: "no", label: "Cancel"}
    ], `Cure all ${needed} obese players with Ozempic?`);
    
    if (confirm === "yes") {
      S.doctor.ozempic_stock = Math.max(0, stock - needed);
      
      // Restore player ratings
      for (const player of obesePlayers) {
        player.obese = false;
        // Restore rating to a reasonable level (random between 50-70, or original if stored)
        if (!player.original_rating) {
          player.rating = 50 + Math.floor(Math.random() * 21); // 50-70
        } else {
          player.rating = player.original_rating;
          delete player.original_rating;
        }
      }
      
      log(`You distribute Ozempic to all ${needed} players in the locker room.`);
      log(`Their obesity is cured and ratings are restored!`);
      
      // Recalculate team rating
      if (typeof updateTeamRating === 'function') updateTeamRating();
      updateHUD?.();
      if (typeof renderDoctor === 'function') renderDoctor();
    }
  };

  window.treatSTD = function(){
    if ((S.chairman_cash || 0) < 8000) {
      log('You cannot afford STD treatment (£8,000).');
      return;
    }
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 8000);
    S.std_state = 'treated';
    S.std_treatment_attempts = 0;
    S.std_last_treatment_match = S.matches_played || 0;
    log('Discreet treatment clears up your STD.');
    updateHUD?.(); renderDoctor();
  };

  window.treatVeryBadSTD = function(){
    if ((S.chairman_cash || 0) < 1000000) {
      log('You cannot afford very bad STD treatment (£1,000,000).');
      return;
    }
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 1000000);
    S.very_bad_std_state = 'treated';
    S.very_bad_std_treatment_attempts = 0;
    S.very_bad_std_last_treatment_match = S.matches_played || 0;
    log('Expensive treatment clears up your very bad STD. The NHS has been privatised, hence the cost.');
    updateHUD?.(); renderDoctor();
  };

  window.startDiagnosticInterview = async function(){
    if ((S.chairman_cash || 0) < 100000) {
      log('You cannot afford a diagnostic interview (£100,000).');
      return;
    }
    
    S.chairman_cash = Math.max(0, (S.chairman_cash || 0) - 100000);
    log('You pay £100,000 for a comprehensive diagnostic interview.');
    
    // Start the popup diagnostic interview
    await startDiagnosticInterviewPopup();
    
    updateHUD?.(); renderDoctor();
  };

  // New popup-based diagnostic interview
  window.startDiagnosticInterviewPopup = async function(){
    return new Promise((resolve) => {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.className = 'modern-modal-overlay';
      modal.style.zIndex = '10001';
      
      modal.innerHTML = `
        <div class="modern-modal" style="max-width: 600px; max-height: 80vh;">
          <div class="modal-header">
            <h3>🧠 Diagnostic Interview</h3>
            <button class="modal-close" onclick="closeDiagnosticModal()">&times;</button>
          </div>
          <div class="modal-body" id="diagnosticContent">
            <div id="diagnosticProgress" style="margin-bottom: 20px;">
              <div style="background: var(--line); height: 4px; border-radius: 2px; margin-bottom: 10px;">
                <div id="progressBar" style="background: var(--accent); height: 100%; width: 0%; border-radius: 2px; transition: width 0.3s ease;"></div>
              </div>
              <div id="progressText" style="text-align: center; color: var(--muted); font-size: 0.9rem;">Question 1 of 3</div>
            </div>
            <div id="diagnosticQuestion" style="margin-bottom: 20px;">
              <h4 id="questionTitle" style="margin: 0 0 15px 0; color: var(--text);"></h4>
              <div id="questionOptions" style="display: flex; flex-direction: column; gap: 10px;"></div>
            </div>
            <div id="diagnosticResults" style="display: none;">
              <h4 style="margin: 0 0 15px 0; color: var(--accent);">📜 DIAGNOSTIC CERTIFICATE ISSUED</h4>
              <div id="diagnosisContent"></div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Store modal reference for cleanup
      window.currentDiagnosticModal = modal;
      
      // Start the interview process
      runDiagnosticInterview(resolve);
    });
  };

  async function runDiagnosticInterview(resolve) {
    const questions = [
      {
        title: 'Which of the following statements applies most to you?',
        options: [
          {key: 'horny', label: 'I am so horny'},
          {key: 'money', label: 'I love money'},
          {key: 'bribery', label: 'I love bribery'},
          {key: 'violent', label: 'I am aggressive and violent'}
        ]
      },
      {
        title: 'Tell me about your childhood:',
        options: [
          {key: 'traumatized', label: 'I am so traumatized'},
          {key: 'dad_bribe', label: 'I once saw my dad accept a bribe'},
          {key: 'neglected', label: 'I was emotionally neglected as a child'},
          {key: 'abuse', label: 'I experienced childhood abuse'}
        ]
      },
      {
        title: 'How do you typically handle difficult situations?',
        options: [
          {key: 'sex_coping', label: 'I use sex to cope with stress'},
          {key: 'money_coping', label: 'I use money to feel powerful'},
          {key: 'violence_coping', label: 'I use violence to solve problems'},
          {key: 'denial', label: 'I deny having any problems'}
        ]
      }
    ];
    
    const answers = [];
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = await showDiagnosticQuestion(question, i + 1, questions.length);
      answers.push(answer);
    }
    
    // Process results
    const [round1, round2, round3] = answers;
    let diagnosis = '';
    let description = '';
    let criteria = [];
    
    if (round1 === 'horny' || round3 === 'sex_coping') {
      diagnosis = 'Erotic Disorder';
      description = 'You are so horny and you love sex because you had a bad childhood. Your excessive sexual behavior is a coping mechanism for unresolved trauma.';
      criteria = [
        'Persistent and excessive sexual thoughts and behaviors',
        'Sexual activity used as primary coping mechanism',
        'History of childhood trauma or emotional neglect',
        'Difficulty forming healthy emotional relationships',
        'Sexual behavior interferes with daily functioning'
      ];
    } else if (round1 === 'money' || round1 === 'bribery' || round2 === 'dad_bribe' || round3 === 'money_coping') {
      diagnosis = 'Bribery Personality Disorder';
      description = 'Your sad and upsetting childhood, particularly witnessing your father accept bribes, has led to a warped understanding of money and power. You believe that money can solve any problem and that bribery is a normal way of life.';
      criteria = [
        'Obsessive focus on money and material wealth',
        'Belief that bribery is acceptable behavior',
        'History of witnessing or experiencing financial corruption',
        'Using money to manipulate and control others',
        'Inability to form relationships not based on financial transactions'
      ];
    } else {
      diagnosis = 'Violence Syndrome';
      description = 'Your sad and upsetting childhood makes you act violently towards people such as referees and other managers. Your aggressive behavior is a learned response to trauma and a way to feel powerful in a world that once made you feel helpless.';
      criteria = [
        'Recurrent aggressive behavior and violent outbursts',
        'Violence used as primary problem-solving method',
        'History of childhood trauma, abuse, or neglect',
        'Difficulty controlling anger and impulses',
        'Violent behavior directed at authority figures'
      ];
    }
    
    // Add certificate to inventory
    S.doctor.disorder_certificates.push({
      type: diagnosis,
      description: description,
      criteria: criteria,
      used: false
    });
    
    // Show results
    showDiagnosticResults(diagnosis, description, criteria);
    
    // Log to main feed
    log(`\n📜 DIAGNOSTIC CERTIFICATE ISSUED`);
    log(`Diagnosis: ${diagnosis}`);
    log(`Description: ${description}`);
    log(`\nDiagnostic Criteria:`);
    criteria.forEach((criterion, index) => {
      log(`${index + 1}. ${criterion}`);
    });
    log(`\nThis certificate can be used once as a "get out of jail free" card for arrests or infidelity confrontations.`);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      closeDiagnosticModal();
      resolve();
    }, 3000);
  }

  function showDiagnosticQuestion(question, current, total) {
    return new Promise((resolve) => {
      const questionTitle = document.getElementById('questionTitle');
      const questionOptions = document.getElementById('questionOptions');
      const progressBar = document.getElementById('progressBar');
      const progressText = document.getElementById('progressText');
      
      // Update progress
      const progress = (current / total) * 100;
      progressBar.style.width = progress + '%';
      progressText.textContent = `Question ${current} of ${total}`;
      
      // Show question
      questionTitle.textContent = question.title;
      questionOptions.innerHTML = '';
      
      question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'btn btn-secondary';
        button.style.cssText = 'width: 100%; padding: 12px; margin: 0; text-align: left;';
        button.textContent = option.label;
        button.onclick = () => resolve(option.key);
        questionOptions.appendChild(button);
      });
    });
  }

  function showDiagnosticResults(diagnosis, description, criteria) {
    const questionDiv = document.getElementById('diagnosticQuestion');
    const resultsDiv = document.getElementById('diagnosticResults');
    const diagnosisContent = document.getElementById('diagnosisContent');
    
    questionDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    
    diagnosisContent.innerHTML = `
      <div style="margin-bottom: 15px;">
        <strong style="color: var(--accent);">Diagnosis:</strong> ${diagnosis}
      </div>
      <div style="margin-bottom: 15px;">
        <strong style="color: var(--text);">Description:</strong> ${description}
      </div>
      <div style="margin-bottom: 15px;">
        <strong style="color: var(--text);">Diagnostic Criteria:</strong>
        <ol style="margin: 10px 0; padding-left: 20px;">
          ${criteria.map(criterion => `<li style="margin: 5px 0;">${criterion}</li>`).join('')}
        </ol>
      </div>
      <div style="background: var(--bg); padding: 15px; border-radius: 8px; border-left: 4px solid var(--accent);">
        <strong style="color: var(--accent);">Note:</strong> This certificate can be used once as a "get out of jail free" card for arrests or infidelity confrontations.
      </div>
    `;
  }

  window.closeDiagnosticModal = function() {
    if (window.currentDiagnosticModal) {
      window.currentDiagnosticModal.remove();
      window.currentDiagnosticModal = null;
    }
  };

  // Make functions available globally
  window.toggleDoctorPane = toggleDoctorPane;
  window.renderDoctor = renderDoctor;
  window.ensureDoctorPane = ensureDoctorPane;
  
  // Now that doctor functions are loaded, ensure the button is properly set up
  setTimeout(() => {
    console.log('Doctor functions loaded, setting up button');
    const btn = document.getElementById('openDoctorBtn');
    if (btn) {
      // Remove any existing listeners
      btn.removeAttribute('data-listener-attached');
      btn.onclick = null;
      
      // Add the click handler
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Doctor button clicked (post-load handler)!');
        window.toggleDoctorPane(true);
      });
      
      btn.setAttribute('data-listener-attached', 'true');
      console.log('Doctor button setup complete (post-load)');
    }
  }, 100);
  
  // Add a test function for debugging
  window.testDoctorButton = function() {
    console.log('Testing doctor button...');
    const btn = document.getElementById('openDoctorBtn');
    console.log('Button found:', btn);
    console.log('Button has listener:', btn?.hasAttribute('data-listener-attached'));
    console.log('toggleDoctorPane available:', typeof window.toggleDoctorPane);
    if (btn) {
      btn.click();
    }
  };
})();

// Hook the doctor button
window.ensureDoctorUI = function(){
  console.log('ensureDoctorUI called');
  const btn = document.getElementById('openDoctorBtn');
  console.log('Doctor button found:', btn);
  if (btn && !btn.hasAttribute('data-listener-attached')){
    console.log('Adding event listener to doctor button');
    btn.setAttribute('data-listener-attached', 'true');
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      console.log('Doctor button clicked!');
      if (typeof window.toggleDoctorPane === 'function') {
        window.toggleDoctorPane(true);
      } else {
        console.error('toggleDoctorPane function not available');
      }
    });
  } else if (btn) {
    console.log('Doctor button already has listener attached');
  } else {
    console.log('Doctor button not found!');
  }
  console.log('toggleDoctorPane available:', typeof window.toggleDoctorPane);
  window.ensureDoctorPane();
};

// Stadium Management UI
window.ensureStadiumUI = function(){
  console.log('ensureStadiumUI called');
  
  // Ensure DOM is ready before trying to access elements
  const setupStadiumUI = () => {
    // Hook the HUD button
    const btns = document.querySelectorAll('#openStadiumBtn');
    console.log('Found stadium buttons:', btns.length);
    if (btns.length > 1) btns.forEach((b,i)=> i>0 && b.remove());
    const btn = document.getElementById('openStadiumBtn');
    if (btn){
      btn.replaceWith(btn.cloneNode(true));
      const wired = document.getElementById('openStadiumBtn');
      wired.addEventListener('click', ()=>{
        toggleStadiumPane(true);
      });
    } else {
      console.log('No stadium button found, will retry later');
      // Retry after a short delay if button doesn't exist yet
      setTimeout(setupStadiumUI, 100);
      
      // Also try to create a fallback button if needed
      const hudBar = document.getElementById('hudBar');
      if (hudBar && !document.getElementById('openStadiumBtn')) {
        console.log('Creating fallback stadium button');
        const fallbackBtn = document.createElement('button');
        fallbackBtn.id = 'openStadiumBtn';
        fallbackBtn.textContent = '🏟️ Stadium';
        fallbackBtn.addEventListener('click', ()=>{
          console.log('Fallback stadium button clicked!');
          toggleStadiumPane(true);
        });
        hudBar.appendChild(fallbackBtn);
      }
    }
    
    // Make sure pane exists
    ensureStadiumPane();
  };
  
  // Check if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStadiumUI);
  } else {
    setupStadiumUI();
  }
};

// Make ensureStadiumPane globally accessible
window.ensureStadiumPane = function(){
  let pane = document.getElementById('stadiumPane');
  if (!pane) {
    pane = document.createElement('div');
    pane.id = 'stadiumPane';
    pane.className = 'panel';
    pane.style.display = 'none';
    pane.style.position = 'fixed';
    pane.style.top = '50%';
    pane.style.left = '50%';
    pane.style.transform = 'translate(-50%, -50%)';
    pane.style.zIndex = '1000';
    pane.style.maxWidth = '800px';
    pane.style.maxHeight = '80vh';
    pane.style.overflow = 'auto';
    pane.style.padding = '24px';
    document.body.appendChild(pane);
  }
  return pane;
};

// Make toggleStadiumPane globally accessible
window.toggleStadiumPane = function(show){
  console.log('toggleStadiumPane called with show:', show);
  const pane = ensureStadiumPane();
  console.log('Stadium pane element:', pane);
  if (show) {
    console.log('Rendering stadium panel...');
    
    // Ensure game state is initialized before rendering
    if (!S) {
      console.log('S not initialized, attempting to initialize...');
      if (typeof init === 'function') {
        init();
      }
    }
    
    // Ensure stadium state exists
    if (S && !S.stadium) {
      console.log('S.stadium not initialized, creating default stadium...');
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
        last_home_attendance: 0,
        utilization_percent: 0
      };
    }
    
    renderStadiumPanel();
    pane.style.display = 'block';
    console.log('Stadium panel should now be visible');
  } else {
    pane.style.display = 'none';
    console.log('Stadium panel hidden');
  }
};

// Stadium upgrade definitions
window.STADIUM_UPGRADES = {
  extend_stands: {
    name: "Extend Stands",
    description: "Add seating to existing stands",
    capacity_gain: { min: 6000, max: 10000 },
    quality_gain: 5,
    duration: { min: 3, max: 5 },
    base_cost: 3000000,
    upkeep_multiplier: 1.2
  },
  fill_corners: {
    name: "Fill Corners / Infill",
    description: "Fill in corner areas with seating",
    capacity_gain: { min: 4000, max: 8000 },
    quality_gain: 3,
    duration: { min: 4, max: 6 },
    base_cost: 2000000,
    upkeep_multiplier: 1.1
  },
  second_tier: {
    name: "Add Second Tier",
    description: "Add upper tier to main stands",
    capacity_gain: { min: 12000, max: 20000 },
    quality_gain: 10,
    duration: { min: 8, max: 12 },
    base_cost: 8000000,
    upkeep_multiplier: 1.5
  },
  world_class: {
    name: "World-Class Rebuild",
    description: "Complete stadium rebuild to 100,000 capacity",
    capacity_gain: 100000, // Fixed to 100k
    quality_gain: 25,
    duration: { min: 16, max: 20 },
    base_cost: 35000000,
    upkeep_multiplier: 3.0
  }
};

// Make renderStadiumPanel globally accessible
window.renderStadiumPanel = function(){
  const pane = ensureStadiumPane();
  
  // Add null checks to prevent errors
  if (!S || !S.stadium) {
    console.warn('S or S.stadium is not initialized, cannot render stadium panel');
    pane.innerHTML = '<div style="padding: 20px; text-align: center;"><h2>🏟️ Stadium & Facilities</h2><p>Stadium data not available. Please refresh the page.</p></div>';
    return;
  }
  
  const stadium = S.stadium;
  
  // Calculate projections
  const nextHomeProjection = calculateAttendanceProjection();
  const soldOutRevenue = stadium.capacity * stadium.ticket_price * 1.1; // 10% quality uplift
  
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0;">🏟️ Stadium & Facilities</h2>
      <button onclick="toggleStadiumPane(false)" style="background: #f87171; border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;">✕</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
      <div class="panel" style="padding: 16px;">
        <h3 style="margin-top: 0;">Current Stadium</h3>
        <div class="row"><div class="k">Capacity</div><div class="v">${stadium.capacity.toLocaleString()}</div></div>
        <div class="row"><div class="k">Quality</div><div class="v">${stadium.quality}/100</div></div>
        <div class="row"><div class="k">Safety</div><div class="v">${stadium.safety}/100</div></div>
        <div class="row"><div class="k">Ticket Price</div><div class="v">£${stadium.ticket_price}</div></div>
        <div class="row"><div class="k">Upkeep per Match</div><div class="v">£${(stadium.upkeep_per_match && !isNaN(stadium.upkeep_per_match) ? stadium.upkeep_per_match : 5000).toLocaleString()}</div></div>
        <div class="row"><div class="k">Last Attendance</div><div class="v">${stadium.last_home_attendance.toLocaleString()}</div></div>
        <div class="row"><div class="k">Utilization</div><div class="v">${stadium.utilization_percent.toFixed(1)}%</div></div>
      </div>
      
      <div class="panel" style="padding: 16px;">
        <h3 style="margin-top: 0;">Revenue Projections</h3>
        <div class="row"><div class="k">If Sold Out</div><div class="v">£${soldOutRevenue.toLocaleString()}</div></div>
        <div class="row"><div class="k">At Current Morale</div><div class="v">£${nextHomeProjection.revenue.toLocaleString()}</div></div>
        <div class="row"><div class="k">Projected Attendance</div><div class="v">${nextHomeProjection.attendance.toLocaleString()}</div></div>
        <div class="row"><div class="k">Utilization</div><div class="v">${nextHomeProjection.utilization.toFixed(1)}%</div></div>
      </div>
    </div>
  `;
  
  if (stadium.active_project) {
    html += renderActiveProject();
  } else {
    html += renderUpgradeOptions();
  }
  
  pane.innerHTML = html;
}

function renderActiveProject(){
  const project = S.stadium.active_project;
  const progress = S.stadium.construction_progress;
  const totalDuration = project.duration + S.stadium.construction_delays;
  const remaining = Math.max(0, totalDuration - progress);
  
  let statusClass = 'good';
  let statusText = 'On Track';
  if (S.stadium.construction_delays > 0) {
    statusClass = 'warn';
    statusText = `Delayed (+${S.stadium.construction_delays} matches)`;
  }
  if (S.stadium.construction_overrun > 0) {
    statusClass = 'bad';
    statusText += ` | Overrun +${S.stadium.construction_overrun}%`;
  }
  
  return `
    <div class="panel" style="padding: 16px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Active Project: ${project.name}</h3>
      <div class="row"><div class="k">Progress</div><div class="v">Matches ${progress}/${totalDuration}</div></div>
      <div class="row"><div class="k">Status</div><div class="v ${statusClass}">${statusText}</div></div>
      <div class="row"><div class="k">Remaining</div><div class="v">${remaining} matches</div></div>
      
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button onclick="pauseProject()" class="warn">Pause</button>
        <button onclick="cancelProject()" class="bad">Cancel</button>
        <button onclick="accelerateProject()" class="good">Accelerate</button>
      </div>
    </div>
  `;
}

function renderUpgradeOptions(){
  let html = '<h3>Available Upgrades</h3><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">';
  
  for (const [key, upgrade] of Object.entries(window.STADIUM_UPGRADES)) {
    const capacityGain = typeof upgrade.capacity_gain === 'object' 
      ? `${upgrade.capacity_gain.min.toLocaleString()}-${upgrade.capacity_gain.max.toLocaleString()}`
      : upgrade.capacity_gain.toLocaleString();
    
    const duration = `${upgrade.duration.min}-${upgrade.duration.max} matches`;
    const cost = upgrade.base_cost;
    
    // Calculate ROI projections at different morale levels
    const roi40 = calculateROI(upgrade, 40);
    const roi60 = calculateROI(upgrade, 60);
    const roi80 = calculateROI(upgrade, 80);
    
    html += `
      <div class="panel" style="padding: 16px;">
        <h4 style="margin-top: 0;">${upgrade.name}</h4>
        <p style="margin: 8px 0; color: var(--muted);">${upgrade.description}</p>
        <div class="row"><div class="k">Capacity</div><div class="v">+${capacityGain}</div></div>
        <div class="row"><div class="k">Quality</div><div class="v">+${upgrade.quality_gain}</div></div>
        <div class="row"><div class="k">Duration</div><div class="v">${duration}</div></div>
        <div class="row"><div class="k">Cost</div><div class="v">£${cost.toLocaleString()}</div></div>
        
        <div style="margin: 12px 0; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px;">
          <div style="font-size: 0.9rem; color: var(--muted); margin-bottom: 4px;">ROI Projections:</div>
          <div style="font-size: 0.85rem;">40% morale: £${roi40.toLocaleString()}/match</div>
          <div style="font-size: 0.85rem;">60% morale: £${roi60.toLocaleString()}/match</div>
          <div style="font-size: 0.85rem;">80% morale: £${roi80.toLocaleString()}/match</div>
        </div>
        
        <div style="margin-top: 12px;">
          <button onclick="startProject('${key}', 'cash')" class="good" style="width: 100%;">Start Project</button>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

// Stadium calculation functions
window.calculateAttendanceProjection = function() {
  // Add null checks to prevent errors
  if (!S || !S.stadium) {
    console.warn('S or S.stadium is not initialized, returning default projection');
    return {
      attendance: 16000,
      revenue: 640000,
      utilization: 50
    };
  }
  
  const stadium = S.stadium;
  const fanMorale = S.fan_morale || 50;
  const reputation = S.reputation || 50;
  
  // Base attendance from morale (0-100%)
  let baseAttendance = (fanMorale / 100) * stadium.capacity;
  
  // Reputation modifier (-20% to +20%)
  const repModifier = (reputation - 50) / 50 * 0.2;
  baseAttendance *= (1 + repModifier);
  
  // Recent form modifier (small impact)
  const wins = S.wins || 0;
  const losses = S.losses || 0;
  const totalMatches = wins + losses + (S.draws || 0);
  if (totalMatches > 0) {
    const winRate = wins / totalMatches;
    const formModifier = (winRate - 0.5) * 0.1; // -5% to +5%
    baseAttendance *= (1 + formModifier);
  }
  
  // World-class stadium penalty for low morale
  if (stadium.capacity >= 100000 && fanMorale < 60) {
    const penalty = (60 - fanMorale) / 60 * 0.3; // Up to 30% penalty
    baseAttendance *= (1 - penalty);
  }
  
  // Construction penalty (if active)
  if (stadium.active_project) {
    baseAttendance *= 0.9; // 10% reduction during construction
  }
  
  const attendance = Math.max(0, Math.min(stadium.capacity, Math.round(baseAttendance)));
  const utilization = (attendance / stadium.capacity) * 100;
  
  // Revenue calculation
  const qualityUplift = 1 + (stadium.quality / 100) * 0.1; // Up to 10% uplift
  const ticketRevenue = attendance * stadium.ticket_price * qualityUplift;
  const concessions = attendance * 8; // £8 per person average
  const revenue = ticketRevenue + concessions;
  
  return { attendance, utilization, revenue };
}

window.calculateROI = function(upgrade, morale) {
  if (!S || !S.stadium) {
    return { roi: 0, payback: 999 };
  }
  
  const stadium = S.stadium;
  
  // Calculate new capacity and quality
  let newCapacity = stadium.capacity;
  if (typeof upgrade.capacity_gain === 'object') {
    newCapacity += (upgrade.capacity_gain.min + upgrade.capacity_gain.max) / 2;
  } else {
    newCapacity = upgrade.capacity_gain; // World-class sets to 100k
  }
  
  const newQuality = Math.min(100, stadium.quality + upgrade.quality_gain);
  
  // Calculate new attendance at given morale
  let baseAttendance = (morale / 100) * newCapacity;
  
  // World-class penalty
  if (newCapacity >= 100000 && morale < 60) {
    const penalty = (60 - morale) / 60 * 0.3;
    baseAttendance *= (1 - penalty);
  }
  
  const attendance = Math.max(0, Math.min(newCapacity, Math.round(baseAttendance)));
  
  // Calculate revenue
  const qualityUplift = 1 + (newQuality / 100) * 0.1;
  const ticketRevenue = attendance * stadium.ticket_price * qualityUplift;
  const concessions = attendance * 8;
  const revenue = ticketRevenue + concessions;
  
  // Calculate new upkeep
  const newUpkeep = stadium.upkeep_per_match * upgrade.upkeep_multiplier;
  
  // ROI is additional revenue minus additional upkeep
  const currentRevenue = calculateAttendanceProjection().revenue;
  const additionalRevenue = revenue - currentRevenue;
  const additionalUpkeep = newUpkeep - stadium.upkeep_per_match;
  
  return Math.round(additionalRevenue - additionalUpkeep);
}

// Project management functions
window.startProject = function(upgradeKey, financing) {
  const upgrade = window.STADIUM_UPGRADES[upgradeKey];
  if (!upgrade) return;
  
  if (!S || !S.stadium) {
    log("Stadium system not initialized.");
    return;
  }
  
  const stadium = S.stadium;
  if (stadium.active_project) {
    log("A stadium project is already in progress.");
    return;
  }
  
  // Calculate actual values
  const capacityGain = typeof upgrade.capacity_gain === 'object'
    ? Math.floor(Math.random() * (upgrade.capacity_gain.max - upgrade.capacity_gain.min + 1)) + upgrade.capacity_gain.min
    : upgrade.capacity_gain;
  
  const duration = Math.floor(Math.random() * (upgrade.duration.max - upgrade.duration.min + 1)) + upgrade.duration.min;
  const cost = upgrade.base_cost;
  
  // Handle financing
  let canAfford = false;
  let finalCost = cost;
  
  // Only cash financing available
  if (S.club_cash >= cost) {
    S.club_cash -= cost;
    canAfford = true;
  }
  
  if (!canAfford) {
    log(`Insufficient funds for ${upgrade.name}. Need £${cost.toLocaleString()}.`);
    return;
  }
  
  // Start project
  S.stadium.active_project = {
    key: upgradeKey,
    name: upgrade.name,
    capacity_gain: capacityGain,
    quality_gain: upgrade.quality_gain,
    duration: duration,
    cost: finalCost,
    upkeep_multiplier: upgrade.upkeep_multiplier
  };
  
  S.stadium.construction_progress = 0;
  S.stadium.construction_delays = 0;
  S.stadium.construction_overrun = 0;
  
  log(`🏗️ Started ${upgrade.name} project! Duration: ${duration} matches, Cost: £${finalCost.toLocaleString()}`);
  
  renderStadiumPanel();
  updateHUD();
}

window.pauseProject = function() {
  if (!S.stadium.active_project) return;
  
  // For now, just log - could implement pause mechanics later
  log("Project paused. Construction will resume when you unpause.");
}

window.cancelProject = function() {
  if (!S.stadium.active_project) return;
  
  const project = S.stadium.active_project;
  const refund = Math.floor(project.cost * 0.3); // 30% refund
  
  // Refunds still count as visible cash moving through the books
  if (typeof addMoneyClub === 'function') {
    addMoneyClub(refund);
  } else {
    S.club_cash = (S.club_cash || 0) + refund;
  }
  S.stadium.active_project = null;
  S.stadium.construction_progress = 0;
  S.stadium.construction_delays = 0;
  S.stadium.construction_overrun = 0;
  
  log(`Project cancelled. Refund: £${refund.toLocaleString()}`);
  renderStadiumPanel();
  updateHUD();
}

window.accelerateProject = function() {
  if (!S.stadium.active_project) return;
  
  const accelerationCost = Math.floor(S.stadium.active_project.cost * 0.1); // 10% of project cost
  
  if (S.club_cash < accelerationCost) {
    log(`Need £${accelerationCost.toLocaleString()} to accelerate project.`);
    return;
  }
  
  S.club_cash -= accelerationCost;
  S.stadium.construction_progress += Math.floor(Math.random() * 2) + 1; // 1-2 matches
  
  log(`Project accelerated! Cost: £${accelerationCost.toLocaleString()}, Progress: +${S.stadium.construction_progress - (S.stadium.construction_progress - Math.floor(Math.random() * 2) - 1)} matches`);
  
  // Check if project is complete
  checkProjectCompletion();
  renderStadiumPanel();
  updateHUD();
}

function generateSponsorName() {
  const sponsors = [
    "TechCorp", "GlobalBank", "EnergyPlus", "MegaCorp", "FutureTech",
    "PremierGroup", "ElitePartners", "CapitalOne", "InnovationLabs", "PowerSystems"
  ];
  return sponsors[Math.floor(Math.random() * sponsors.length)];
}

// Global test function for stadium system
window.testStadium = function() {
  console.log('Testing stadium system...');
  console.log('S exists:', !!S);
  console.log('S.stadium exists:', !!(S && S.stadium));
  if (S && S.stadium) {
    console.log('Stadium data:', S.stadium);
  }
  console.log('toggleStadiumPane function exists:', typeof window.toggleStadiumPane);
  console.log('ensureStadiumUI function exists:', typeof window.ensureStadiumUI);
  
  // Try to open stadium panel
  if (typeof window.toggleStadiumPane === 'function') {
    console.log('Attempting to open stadium panel...');
    window.toggleStadiumPane(true);
  }
};

// Stadium construction progression (called after each match)
window.advanceStadiumConstruction = function() {
  // Add null checks to prevent errors
  if (!S || !S.stadium) {
    console.warn('S or S.stadium is not initialized, skipping stadium construction advancement');
    return;
  }
  
  const stadium = S.stadium;
  if (!stadium.active_project) return;
  
  const project = stadium.active_project;
  const totalDuration = project.duration + stadium.construction_delays;
  
  // Advance construction by 1 match
  stadium.construction_progress++;
  
  // Check for delays (roughly every 8-10 matches of build time)
  if (stadium.construction_progress % 8 === 0 && Math.random() < 0.3) {
    const delay = Math.floor(Math.random() * 2) + 1; // 1-2 matches
    stadium.construction_delays += delay;
    log(`🏗️ Construction delay! Weather and supply issues add ${delay} matches to ${project.name}.`);
  }
  
  // Check if project is complete
  if (stadium.construction_progress >= totalDuration) {
    completeStadiumProject();
  }
}
