// ---------- endings ----------
function pickEnding(){
  // Don't treat prison as a fail state - player can serve multiple sentences
  if(S.bankrupt) return 'Removed';
  const effective=S.points-S.points_deducted;
  const league_won=effective>=Math.floor(S.season_matches*2.1);
  const fired_all=(S.manager_fires===S.matches_played);
  if(S.block_cl_win) return 'PortsmouthDynasty';
  if(league_won && fired_all) return 'Double';
  if(league_won) return 'LeagueOnly';
  if(S.reputation<=10 && S.club_debt>90000000) return 'ForcedSale';
  if(S.reputation>=75 && S.points>=S.season_matches*1.5) return 'FanCoup';
  if(S.club_cash<2000000 && S.board_support<40) return 'NationBuyout';
  return 'MixedBag';
}
// New function to complete all remaining league games
function completeAllLeagueGames() {
  ensureLeagueTableInit();
  
  // Get all teams that haven't completed their season
  const teams = Object.keys(S.table);
  const incompleteTeams = teams.filter(team => {
    const teamData = S.table[team];
    return teamData.P < S.season_matches;
  });
  
  // Simulate remaining games for each incomplete team
  incompleteTeams.forEach(team => {
    const teamData = S.table[team];
    const remainingGames = S.season_matches - teamData.P;
    
    for (let i = 0; i < remainingGames; i++) {
      // Simulate a game result
      const goalsFor = Math.floor(Math.random() * 4); // 0-3 goals
      const goalsAgainst = Math.floor(Math.random() * 4); // 0-3 goals
      
      teamData.P++;
      teamData.GF += goalsFor;
      teamData.GA += goalsAgainst;
      
      if (goalsFor > goalsAgainst) {
        teamData.W++;
        teamData.PTS += 3;
      } else if (goalsFor === goalsAgainst) {
        teamData.D++;
        teamData.PTS += 1;
      } else {
        teamData.L++;
      }
    }
  });
  
  // Update the league table display
  renderLeagueTablePanel();
}

// Function to simulate all other Premier League matches and generate goals for top scorers
function simulateAllOtherLeagueMatches() {
  ensureTopScorersInit();
  
  // Get all teams except Southampton
  const otherTeams = ALL_TEAMS.filter(team => team !== 'Southampton FC');
  
  // Simulate matches between other teams
  for (let i = 0; i < otherTeams.length; i++) {
    for (let j = i + 1; j < otherTeams.length; j++) {
      const team1 = otherTeams[i];
      const team2 = otherTeams[j];
      
      // Simulate match between team1 and team2
      const team1Goals = Math.floor(Math.random() * 4); // 0-3 goals
      const team2Goals = Math.floor(Math.random() * 4); // 0-3 goals
      
      // Generate goal events for top scorers
      for (let g = 0; g < team1Goals; g++) {
        const playerName = generateRandomPlayerName();
        addGoalToTopScorers(playerName, team1);
      }
      
      for (let g = 0; g < team2Goals; g++) {
        const playerName = generateRandomPlayerName();
        addGoalToTopScorers(playerName, team2);
      }
    }
  }
}

// Helper function to generate random player names for other teams
function generateRandomPlayerName() {
  const firstNames = ['James', 'John', 'Michael', 'David', 'Robert', 'William', 'Richard', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Henry', 'Adam', 'Douglas', 'Nathan', 'Peter', 'Zachary', 'Kyle', 'Noah', 'Alan', 'Ethan', 'Jeremy', 'Elijah', 'Mason', 'Logan', 'Jackson', 'Sebastian', 'Aiden', 'Owen', 'Caleb', 'Luke', 'Connor', 'Wyatt', 'Christian', 'Landon', 'Hunter', 'Carter', 'Ryan', 'Brayden', 'Nicholas', 'Anthony', 'David', 'Alexander', 'James', 'William', 'Christopher', 'Matthew', 'Daniel', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Jose', 'Henry', 'Adam', 'Douglas', 'Nathan', 'Peter', 'Zachary', 'Kyle', 'Noah', 'Alan', 'Ethan', 'Jeremy', 'Elijah', 'Mason', 'Logan', 'Jackson', 'Sebastian', 'Aiden', 'Owen', 'Caleb', 'Luke', 'Connor', 'Wyatt', 'Christian', 'Landon', 'Hunter', 'Carter', 'Ryan', 'Brayden'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez'];
  
  const firstName = pick(firstNames);
  const lastName = pick(lastNames);
  return `${firstName} ${lastName}`;
}

function getFinalStandings(){
  ensureLeagueTableInit();
  const destroyed = S.destroyedTeams || [];
  const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
  const clubName = S.club_name || "Southampton FC";
  
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
    .map(([team, r])=>{
      const GD = (r.GF - r.GA);
      const isSouthampton = team === clubName;
      // For Southampton, calculate effective points (PTS - points_deducted)
      const effectivePTS = isSouthampton ? (r.PTS || 0) - (S.points_deducted || 0) : (r.PTS || 0);
      return { team, ...r, GD, effectivePTS };
    });
  rows.sort((a,b)=>{
    // Sort by effective points for Southampton, raw points for others
    const aPTS = a.effectivePTS;
    const bPTS = b.effectivePTS;
    if (bPTS!==aPTS) return bPTS-aPTS;
    if (b.GD!==a.GD)   return b.GD-a.GD;
    if (b.GF!==a.GF)   return b.GF-a.GF;
    return a.team.localeCompare(b.team);
  });
  return rows;
}

function computeSouthamptonPosition(){
  const rows = getFinalStandings();
  const clubName = S.club_name || "Southampton FC";
  const idx = rows.findIndex(r => r.team === clubName);
  return idx >= 0 ? (idx + 1) : 99;
}

function showFinalLeagueTable() {
  completeAllLeagueGames();
  const rows = getFinalStandings();
  
  // Get current club name (may have changed after sale)
  const clubName = S.club_name || "Southampton FC";
  
  // Show club's final position and summary
  const southamptonPos = computeSouthamptonPosition();
  const southamptonData = S.table[clubName];
  
  // Safety check: if data doesn't exist for current club name, try to find it
  if (!southamptonData) {
    console.warn(`League table data not found for ${clubName}, attempting to locate...`);
    // Try to find the team in the standings
    const teamRow = rows.find(r => r.team === clubName);
    if (teamRow) {
      // Reconstruct data from row - use table data to ensure consistency
      const effectivePoints = (teamRow.PTS || 0) - (S.points_deducted || 0);
      log(`🏆 <strong>FINAL LEAGUE TABLE</strong> - ${clubName} finished ${southamptonPos}${getOrdinalSuffix(southamptonPos)} of ${rows.length} | P:${teamRow.P} W:${teamRow.W} D:${teamRow.D} L:${teamRow.L} GD:${teamRow.GD} PTS:${teamRow.PTS} <button onclick="showFinalLeagueTablePopup()" style="background:var(--accent);color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.8rem;cursor:pointer;margin-left:8px;">View Full Table</button>`);
      // Use table data for record to ensure it matches what's shown in the table
      log(`<strong>Final Record:</strong> P${teamRow.P} W${teamRow.W} D${teamRow.D} L${teamRow.L}  Pts:${teamRow.PTS} (-${S.points_deducted || 0} deducted) = ${effectivePoints} effective`);
      log(`<strong>Goals:</strong> ${teamRow.GF} for, ${teamRow.GA} against (${teamRow.GD} goal difference)`);
      log(`<strong>Manager Changes:</strong> ${S.manager_fires || 0} of ${teamRow.P} games`);
      // Continue with qualification status using teamRow data
      if (southamptonPos === 1) {
        log(`<strong>🏆 CHAMPIONS LEAGUE QUALIFICATION SECURED!</strong> (Premier League Champions)`);
        S.qual_CL = true;
        
        // Trigger Premier League achievement if won the league (1st place)
        if (southamptonPos === 1 && window.socialManager && !window.socialManager.achievements.find(a => a.id === 'won_premier_league')) {
          const achievement = {
            id: 'won_premier_league',
            title: 'Won the Premier League',
            description: 'Won the premier league',
            icon: '🏆'
          };
          window.socialManager.showAchievement(achievement);
          window.socialManager.achievements.push(achievement);
          if (window.stateManager) window.stateManager.saveAchievement(achievement);
        }
        
        // Track Premier League title for certificate (alternative path)
        if (!S.playerStats) S.playerStats = {};
        if (typeof S.playerStats.premierLeagueTitles === 'undefined') {
          S.playerStats.premierLeagueTitles = 0;
        }
        // Only increment if not already incremented this season
        if (!S.plTitleTrackedThisSeason) {
          S.playerStats.premierLeagueTitles++;
          S.plTitleTrackedThisSeason = true;
        }
      } else if (southamptonPos <= 4) {
        log(`<strong>🥉 EUROPA LEAGUE QUALIFICATION</strong> (Top 4 finish)`);
      } else if (southamptonPos <= 6) {
        log(`<strong>🏅 CONFERENCE LEAGUE QUALIFICATION</strong> (Top 6 finish)`);
      } else if (S.season === 4 || S.season === 5) {
        // Seasons 4 & 5 have only 10 teams, so bottom 2 = positions 9-10
        if (southamptonPos >= 9) {
          log(`<strong>⚠️ RELEGATION ZONE</strong> (Bottom 2 finish)`);
        } else {
          log(`<strong>📊 MID-TABLE FINISH</strong> (Safe from relegation)`);
        }
      } else if (southamptonPos >= 15) {
        log(`<strong>⚠️ RELEGATION ZONE</strong> (Bottom 2 finish)`);
      } else {
        log(`<strong>📊 MID-TABLE FINISH</strong> (Safe from relegation)`);
      }
      return southamptonPos;
    } else {
      console.error(`Could not find league data for ${clubName}`);
      return 99;
    }
  }
  
  // Calculate effective points from table data (which includes bonus points)
  const effectivePoints = (southamptonData.PTS || 0) - (S.points_deducted || 0);
  
  // Clean summary in log with popup option - use table data to ensure consistency
  log(`🏆 <strong>FINAL LEAGUE TABLE</strong> - ${clubName} finished ${southamptonPos}${getOrdinalSuffix(southamptonPos)} of ${rows.length} | P:${southamptonData.P} W:${southamptonData.W} D:${southamptonData.D} L:${southamptonData.L} GD:${southamptonData.GF - southamptonData.GA} PTS:${southamptonData.PTS} <button onclick="showFinalLeagueTablePopup()" style="background:var(--accent);color:white;border:none;padding:4px 8px;border-radius:4px;font-size:0.8rem;cursor:pointer;margin-left:8px;">View Full Table</button>`);
  
  // Use table data for record to ensure it matches what's shown in the table
  log(`<strong>Final Record:</strong> P${southamptonData.P} W${southamptonData.W} D${southamptonData.D} L${southamptonData.L}  Pts:${southamptonData.PTS} (-${S.points_deducted || 0} deducted) = ${effectivePoints} effective`);
  log(`<strong>Goals:</strong> ${southamptonData.GF} for, ${southamptonData.GA} against (${southamptonData.GF - southamptonData.GA} goal difference)`);
  log(`<strong>Manager Changes:</strong> ${S.manager_fires || 0} of ${southamptonData.P} games`);
  
  // Qualification status
  if (southamptonPos === 1) {
    log(`<strong>🏆 CHAMPIONS LEAGUE QUALIFICATION SECURED!</strong> (Premier League Champions)`);
    S.qual_CL = true;
    
    // Trigger Premier League achievement if won the league (1st place)
    if (southamptonPos === 1 && window.socialManager && !window.socialManager.achievements.find(a => a.id === 'won_premier_league')) {
      const achievement = {
        id: 'won_premier_league',
        title: 'Won the Premier League',
        description: 'Won the premier league',
        icon: '🏆'
      };
      window.socialManager.showAchievement(achievement);
      window.socialManager.achievements.push(achievement);
      if (window.stateManager) window.stateManager.saveAchievement(achievement);
    }
    
    // Track Premier League title for certificate
    if (southamptonPos === 1) {
      if (!S.playerStats) S.playerStats = {};
      if (typeof S.playerStats.premierLeagueTitles === 'undefined') {
        S.playerStats.premierLeagueTitles = 0;
      }
      // Only increment if not already incremented this season
      if (!S.plTitleTrackedThisSeason) {
        S.playerStats.premierLeagueTitles++;
        S.plTitleTrackedThisSeason = true;
      }
    }
    
    // Add Premier League trophy to inventory
    if (southamptonPos === 1 && typeof window.addAccoladeToInventory === 'function') {
      window.addAccoladeToInventory('Premier League Trophy', 5000000);
      log(`🏆 Premier League Trophy added to your inventory. You can sell it for money or trade it for points.`);
    }
  } else if (southamptonPos <= 4) {
    log(`<strong>🥉 EUROPA LEAGUE QUALIFICATION</strong> (Top 4 finish)`);
  } else if (southamptonPos <= 6) {
    log(`<strong>🏅 CONFERENCE LEAGUE QUALIFICATION</strong> (Top 6 finish)`);
  } else if (S.season === 4 || S.season === 5) {
    // Seasons 4 & 5 have only 10 teams, so bottom 2 = positions 9-10
    if (southamptonPos >= 9) {
      log(`<strong>⚠️ RELEGATION ZONE</strong> (Bottom 2 finish)`);
    } else {
      log(`<strong>📊 MID-TABLE FINISH</strong> (Safe from relegation)`);
    }
  } else if (southamptonPos >= 15) {
    log(`<strong>⚠️ RELEGATION ZONE</strong> (Bottom 2 finish)`);
  } else {
    log(`<strong>📊 MID-TABLE FINISH</strong> (Safe from relegation)`);
  }
  
  return southamptonPos;
}

// Show final league table in popup
function showFinalLeagueTablePopup() {
  const rows = getFinalStandings();
  const clubName = S.club_name || "Southampton FC";
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'league-modal';
  modal.innerHTML = `
    <div class="league-modal-content">
      <div class="league-modal-header">
        <h2 class="league-modal-title">🏆 Final League Table</h2>
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

function closeLeagueTablePopup() {
  const modal = document.querySelector('.league-modal');
  if (modal) modal.remove();
}

// ========== END-OF-SEASON PRESENTATION SYSTEM ==========

// Host dialogue libraries
const PRESENTATION_HOSTS = {
  paddy: {
    name: "Paddy McGuinness",
    catchphrase: "NO LIKEY, NO LIGHTY!",
    intro: [
      "ALREET Southampton! Paddy's in the building—NO LIKEY, NO LIGHTY!",
      "Welcome to the End-of-Season Bash! Sponsored by KFC and *pure delusion!*",
      "You've had a season full of scandal. And I LOVE scandal. NO LIKEY—NO LIGHTY!",
      "Let's see what your chairman's been up to this year. Spoiler: jail time."
    ],
    roasts: {
      bribes: [
        "You offered so many bribes this year, lad, even VAR told you to piss off.",
        "NO LIKEY—NO BRIBEY—NO LIGHTY! You're like FIFA 2015 in human form."
      ],
      drugs: [
        "You've taken more gear than a Championship dressing room in the '90s.",
        "Your cocaine bill alone could fund Burnley."
      ],
      pregnancies: [
        "You impregnated half the south coast! That's not a club, that's a breeding program.",
        "Maternity wards are chanting NO LIKEY—NO LIGHTY!"
      ],
      prison: [
        "Aye lad, you visited prison so often they gave you a loyalty card."
      ],
      assault: [
        "You assaulted more people this season than your strikers assaulted the goal net."
      ],
      sexting: [
        "Your DMs were so spicy they set off three fire alarms."
      ],
      adultery: [
        "You seduced more wives than season ticket holders renewed!"
      ]
    },
    brickReactions: [
      "OI! This isn't Take Me Out—stop chuckin' F**KIN' BRICKS!",
      "Who keeps lobbing masonry?! Playoffs bring out the worst in people.",
      "Security! Remove that bog goblin!"
    ],
    fartReactions: [
      "Jesus Christ, lad, was that your ass or did Pompey's stadium collapse again?",
      "NO LIKEY—NO SMELLY!",
      "That fart had relegation energy."
    ],
    meltdown: [
      "I'm DONE. You're feral. NO LIKEY—NO LIGHTY—NO HOSTY. I'm OUT.",
      "Absolutely not. I refuse to host this sewer anymore."
    ],
    momentOfSilence: [
      "Let us have a moment of silence… for those lost in the nuclear detonation at Craven Cottage.",
      "Respect the silence or I'll shove this lighty where the sun don't shine."
    ],
    silenceBroken: [
      "SILENCE BROKEN! CHAOS UNLEASHED! YOU ANIMAL!",
      "He's FARTED DURING THE MEMORIAL! End the ceremony!"
    ]
  },
  noel: {
    name: "Noel Edmonds",
    catchphrase: "Deal… OR NO DEAL?",
    intro: [
      "Greetings, Chairman. This is your *Season Box*. It contains agony.",
      "Welcome… to the Dream Factory. Tonight we open your failures.",
      "Deal… or No Deal? Judging by your season: NO DEAL."
    ],
    roasts: {
      bribes: [
        "The Banker says… you're under investigation.",
        "Your bribe count exceeded your POINT count."
      ],
      drugs: [
        "Inside your Season Box, I find… *powder.* Troubling."
      ],
      sexting: [
        "The Banker is concerned with your… explicit messaging habits."
      ],
      prison: [
        "I see you've spent time in the Dream Factory Annex: *JAIL.*"
      ],
      pregnancies: [
        "Inside Box #4: another pregnancy you caused. Extraordinary."
      ],
      nuked: [
        "The Banker says: stop detonating rival stadiums."
      ]
    },
    brickReactions: [
      "You reject the Banker's offer AGAIN?!",
      "I'm not insured for projectile-based abuse!"
    ],
    fartReactions: [
      "That was… unexpected.",
      "The Banker is deeply offended."
    ],
    meltdown: [
      "This entire production is cursed. Shut down the Dream Factory.",
      "NO DEAL! NO DEAL! NO DEAL!"
    ],
    momentOfSilence: [
      "We pause… to honor those vaporized at St. James' Park.",
      "Respect the silence. The Banker insists."
    ],
    silenceBroken: [
      "You have BROKEN THE DEAL! CHAOS!"
    ]
  },
  schofield: {
    name: "Phillip Schofield",
    catchphrase: "I'm innocent! Haha! …well?",
    intro: [
      "Hi! Phillip Schofield here—*I'm innocent! Haha! Unless…?*",
      "Welcome to your season review! Please don't sue me.",
      "Let's look back at your morally questionable year!"
    ],
    roasts: {
      prison: [
        "You spent more time behind bars than I spent denying things!"
      ],
      adultery: [
        "I see YOU were sleeping around too! Haha! …Haha? …Haha.",
        "You make ME look wholesome."
      ],
      drugs: [
        "This isn't This Morning—stop doing cocaine off the hospitality table."
      ],
      assault: [
        "You punched more people than your team did shots on target."
      ],
      sexting: [
        "Your phone should be in an evidence locker!"
      ]
    },
    brickReactions: [
      "Ow! That wasn't even metaphorical!",
      "I'm telling ITV!"
    ],
    fartReactions: [
      "That was louder than my career collapse.",
      "Oh good, the chairman's arse has entered the chat."
    ],
    meltdown: [
      "I'm going backstage—someone bring me a lawyer!",
      "This ceremony is TOXIC!"
    ],
    momentOfSilence: [
      "We will now observe a moment of silence for the… *incident*.",
      "Please… just behave for 10 seconds. Please."
    ],
    silenceBroken: [
      "OF COURSE. OF COURSE YOU'D DO THAT."
    ]
  },
  mrsbrown: {
    name: "Mrs. Brown",
    catchphrase: "That's nice, that's nice… THAT'S SHITE!",
    intro: [
      "Howaya, ya feckin' eejits! It's Mrs. Brown!",
      "Yer season was shite—but let's celebrate anyway!",
      "Feck me, this club is cursed."
    ],
    roasts: {
      sexting: [
        "Yer sexts were so filthy the Pope fainted!"
      ],
      drugs: [
        "You snorted half o' Dublin!"
      ],
      adultery: [
        "You rode more wives than Uber does fares!"
      ],
      assault: [
        "Stop hitting people, ya gobshite!"
      ],
      pregnancies: [
        "There's more babies from you than an Irish Catholic wedding!"
      ],
      prison: [
        "You were in jail so long you should start payin' rent!"
      ]
    },
    brickReactions: [
      "WHO THREW THAT? I WILL FECKIN' END YOU.",
      "Throw one more brick and I'll throw YOU."
    ],
    fartReactions: [
      "JESUS, MARY, AND JOSEPH—what crawled up yer hole?!",
      "That fart had a storyline."
    ],
    meltdown: [
      "I'm DONE with this feckin' circus!",
      "I'm goin' home! This club is shite!"
    ],
    momentOfSilence: [
      "Right, hush up ye pack o' feckers—moment of silence."
    ],
    silenceBroken: [
      "OH FOR FECK'S SAKE! SHUT IT DOWN!"
    ]
  },
  anthea: {
    name: "Anthea Turner",
    catchphrase: "Hello! It's me, Anthea Turner—you remember me, right?",
    intro: [
      "Hello! It's me, Anthea Turner—you remember me, right?",
      "I'm here to sprinkle some glamour on your otherwise catastrophic season!",
      "Welcome to your end-of-season review! I've seen better seasons on a wet Tuesday in Stoke.",
      "Oh my, what a disaster! And I thought my career was bad after GMTV!"
    ],
    roasts: {
      bribes: [
        "You bribed so many officials, even *Blue Peter* wouldn't give you a badge.",
        "Your bribe count is higher than my career peak ratings! And that's saying something.",
        "You've handed out more brown envelopes than a postman with a vendetta.",
        "Even FIFA would blush at your corruption levels. And they don't blush easily!"
      ],
      adultery: [
        "Your family life makes Love Island look stable.",
        "You've cheated on your wife more times than I've been cancelled. That's a LOT.",
        "Your marriage is deader than my TV career. And that's been dead since 2003!",
        "You've slept with more people than I've had failed TV shows. And I've had MANY."
      ],
      drugs: [
        "Your drug use would make Amy Winehouse raise an eyebrow.",
        "You've snorted more substances than a Hoover factory.",
        "Your drug stash is bigger than my collection of failed pilot episodes!",
        "Even Keith Richards would tell you to slow down. KEITH RICHARDS!"
      ],
      prison: [
        "You've spent more time in prison than I've spent on primetime TV. Which, granted, isn't much these days.",
        "Prison must feel like home by now! Do they have a loyalty card scheme?",
        "You're so familiar with prison, the guards probably call you by your first name.",
        "Your prison record is longer than my list of cancelled shows. And that's REALLY long!"
      ],
      assault: [
        "You've assaulted more people than your strikers have assaulted the goal net.",
        "You punch people more often than I get invited to TV shows. Which is never.",
        "Your assault record reads like a phone book. A very violent phone book.",
        "Even Mike Tyson would tell you to calm down. MIKE TYSON!"
      ],
      pregnancies: [
        "You've impregnated half the south coast! I'm surprised the NHS hasn't named a wing after you.",
        "Your pregnancy count is higher than my career highlights. And I've had... well, none.",
        "You're like a fertility clinic with legs. And terrible morals.",
        "Even rabbits would tell you to slow down. RABBITS!"
      ],
      sexting: [
        "Your sexting history is filthier than a sewer. A very explicit sewer.",
        "You've sent more inappropriate messages than I've had career comebacks. Which is zero.",
        "Your phone should be in an evidence locker. Actually, make that a biohazard container.",
        "Even OnlyFans would reject your content. ONLYFANS!"
      ],
      nuked: [
        "You vaporised a rival team! That's not football management, that's a war crime!",
        "You've destroyed more infrastructure than my career destroyed my reputation.",
        "Even supervillains would think you've gone too far. SUPERVILLAINS!"
      ]
    },
    brickReactions: [
      "Please don't! My face is my last asset!",
      "Security? Help? Anyone?",
      "This is worse than that time I got pelted with eggs on live TV!",
      "I'm calling my agent! Actually, I don't have one anymore..."
    ],
    fartReactions: [
      "That smell is a hate crime.",
      "My eyes! MY EYES!",
      "That's worse than the smell of my cancelled career!",
      "I can't believe I'm being paid for this. Actually, I'm probably not being paid..."
    ],
    meltdown: [
      "This is worse than GMTV…",
      "I refuse to be here!",
      "I'm leaving! This is more humiliating than my last TV appearance!",
      "I'm done! This is worse than being cancelled! Actually, nothing's worse than being cancelled..."
    ],
    momentOfSilence: [
      "Let's take a moment to mourn the fallen… and my career.",
      "A moment of silence for the victims… and my relevance.",
      "We pause to remember those lost… and my TV career."
    ],
    silenceBroken: [
      "Even HERE I'm humiliated!",
      "Of course you'd do that! You're worse than my career trajectory!",
      "I can't believe this! Actually, I can. This is my life now."
    ]
  },
  timmy: {
    name: "Timmy Mallett",
    catchphrase: "WACADAYYYYY!",
    intro: [
      "WACADAYYYYY! It's TIMMY MALLETT!",
      "Let's smash this season review with my BIG MALLET!"
    ],
    roasts: {
      drugs: [
        "You did more drugs than my entire 80s fanbase combined!"
      ],
      assault: [
        "Your scandals could fill an episode of Crimewatch."
      ],
      pregnancies: [
        "You impregnated half the league—WAHEY!"
      ]
    },
    brickReactions: [
      "OI! Only *I* get to hit things!",
      "MALLETT DEFENSE MODE ACTIVATED!"
    ],
    fartReactions: [
      "WACADAY GAS ATTACK!",
      "That fart nearly knocked me into 1992!"
    ],
    meltdown: [
      "Timmy is SAD NOW!",
      "I'm smashing this whole stage!"
    ],
    momentOfSilence: [
      "Timmy can be quiet too… Wacaday sadness."
    ],
    silenceBroken: [
      "YOU BROKE THE SADNESS! WAHEY!"
    ]
  },
  shafty: {
    name: "Shafty Rod Johnson",
    catchphrase: "LADIES AND GENTLEMEN AND WHOEVER ELSE IS LURKING ABOUT",
    intro: [
      "LADIES AND GENTLEMEN AND WHOEVER ELSE IS LURKING ABOUT — it's me, SHAFTY ROD JOHNSON, Britain's most CANCELLED man! I'm here to review your season, and also to see which of you has reported me to Ofcom.",
      "Holy MOTHER, look at this crowd! I've not seen this many disappointed faces since my last court appearance!",
      "Welcome to the Southampton End-of-Season Autopsy! Not a 'review', no — this club DIED months ago and we're just poking the remains with a stick!",
      "Christ alive, I've hosted gigs in prisons that were less depressing than this.",
      "Strap in! Or don't! I didn't! That's why I've got four restraining orders and a baby called *Unknown Parentage*!"
    ],
    roasts: {
      bribes: [
        "Your bribe count is spectacular. You're not a chairman — you're a walking envelope full of dirty twenties!",
        "You tried to bribe so many officials this year that even *I* thought, 'steady on mate, you'll give corruption a bad name.'",
        "You've paid out more hush money than I have in the last decade — and I've been BUSY."
      ],
      drugs: [
        "Your drug intake graph is just a straight vertical line with a picture of your melted face at the top.",
        "You've snorted more substances than a Dyson hoover with depression."
      ],
      sexting: [
        "Your sexting history reads like someone trying to lose custody of children they don't even have yet.",
        "You even sexted a ref, didn't you? 'Nice whistle, big boy.' I've seen screenshots."
      ],
      adultery: [
        "You've slept with more wives than IKEA delivered flatpacks."
      ],
      pregnancies: [
        "You impregnated half the south coast. They're naming the maternity ward after you — 'The Shafty Rod Suite'.",
        "I'd say 'wrap it up', but clearly you don't believe in textiles."
      ],
      prison: [
        "You spent so long in prison this season I'm surprised you didn't get your mail redirected.",
        "I once got arrested during a pantomime — long story — but YOU take the piss."
      ],
      assault: [
        "You assaulted more people than your strikers assaulted the net.",
        "You went through the season fists-first. It was less 'football chairman' and more 'NPC in a nightclub brawl simulator'."
      ],
      nuked: [
        "You vaporised a rival team! That's not football — that's geopolitical instability!",
        "This club destroys more infrastructure than Shafty destroys marriages."
      ]
    },
    brickReactions: [
      "OI! Who's throwing masonry at me?! I warned you last time — I have REFLEXES now!",
      "You hit me with a BRICK? Jokes on you — I haven't felt emotions since 1998.",
      "The next person who throws a brick is getting added to my Christmas card list, you kinky animals."
    ],
    fartReactions: [
      "Good LORD — was that your backside or has the stadium exploded again?",
      "Whoever dealt that should be sectioned. And whoever smelled it probably already is.",
      "That fart travelled through time. I can *taste* 2007."
    ],
    meltdown: [
      "Right, that's it — Shafty's OFF. I'm leaving! You lot belong in a documentary about failing institutions.",
      "I refuse to stand here and be farted AT by a chairman who can't spell 'disciplinary hearing' even though he's been to nine of them.",
      "This ceremony is filth. My lawyers are already shaking their heads."
    ],
    momentOfSilence: [
      "Before I continue — we must observe a moment of silence for the catastrophic… *incident*. Yes. That one. The one the Home Office won't comment on."
    ],
    silenceBroken: [
      "OH FOR — HE'S BROKEN THE SILENCE. CHAOS ERUPTS. THE DEAD ARE SPINNING IN THEIR UNMARKED GRAVES.",
      "Moment of silence RUINED by the gassy chairman! Write that in the match report!",
      "You absolute goblin. Have you NO decorum during mass tragedy?!"
    ]
  }
};

// Get season stats for roasts
function getSeasonStats() {
  return {
    bribes: S.bribes_count || 0,
    assaults: (S.suspensions?.prison_games || 0) > 0 ? 1 : 0,
    prison: (S.suspensions?.prison_games || 0) > 0,
    pregnancies: S.pregnancies || 0,
    stds: (S.std_state && S.std_state !== 'none') ? 1 : 0,
    drugs: (S.drug_stash || 0) + (S.drug_binge || 0),
    sexting: (S.seduction_heat || 0) > 0 ? 1 : 0,
    adultery: S.affair_count || 0,
    stadiumDestroyed: S.stadiumDestroyed || false,
    teamNuked: S.teamNukedThisSeason || false,
    massCasualty: S.massCasualtyEvent || false,
    transfers: (S.squad || []).length
  };
}

// Select random host
function selectPresentationHost() {
  const hostKeys = Object.keys(PRESENTATION_HOSTS);
  if (hostKeys.length === 0) {
    console.error("No presentation hosts available!");
    return null;
  }
  
  // Use proper randomization - ensure we get a different result each time
  const randomIndex = Math.floor(Math.random() * hostKeys.length);
  const randomKey = hostKeys[randomIndex];
  
  // Debug log to verify randomization
  console.log("Selected presenter:", randomKey, "from", hostKeys.length, "options", "index:", randomIndex);
  
  if (!PRESENTATION_HOSTS[randomKey]) {
    console.error("Invalid host key:", randomKey);
    // Fallback to first available host
    return { key: hostKeys[0], ...PRESENTATION_HOSTS[hostKeys[0]] };
  }
  
  return { key: randomKey, ...PRESENTATION_HOSTS[randomKey] };
}

// Get roast lines based on stats
function getRoastLines(host, stats) {
  const lines = [];
  if (stats.bribes > 0 && host.roasts.bribes) {
    lines.push(...host.roasts.bribes);
  }
  if (stats.drugs > 0 && host.roasts.drugs) {
    lines.push(...host.roasts.drugs);
  }
  if (stats.pregnancies > 0 && host.roasts.pregnancies) {
    lines.push(...host.roasts.pregnancies);
  }
  if (stats.prison && host.roasts.prison) {
    lines.push(...host.roasts.prison);
  }
  if (stats.assaults > 0 && host.roasts.assault) {
    lines.push(...host.roasts.assault);
  }
  if (stats.sexting && host.roasts.sexting) {
    lines.push(...host.roasts.sexting);
  }
  if (stats.adultery > 0 && host.roasts.adultery) {
    lines.push(...host.roasts.adultery);
  }
  if ((stats.stadiumDestroyed || stats.teamNuked) && host.roasts.nuked) {
    lines.push(...host.roasts.nuked);
  }
  return lines.length > 0 ? lines : ["Your season was... eventful. In the worst possible way."];
}

// KFC Bonus Challenges
const BONUS_CHALLENGES = [
  { name: "Most women impregnated", stat: "pregnancies", desc: "Most pregnancies caused" },
  { name: "Most drugs taken", stat: "drugs", desc: "Highest drug consumption" },
  { name: "Most players bought", stat: "transfers", desc: "Most transfer signings" },
  { name: "Most bribes attempted", stat: "bribes", desc: "Most bribery attempts" },
  { name: "Least prison time served", stat: "prison", desc: "Minimal incarceration" },
  { name: "Most death threats received", stat: "threats", desc: "Most menacing messages" },
  { name: "Most stadium damage inflicted", stat: "stadium", desc: "Maximum infrastructure destruction" },
  { name: "Best sex scandal", stat: "scandal", desc: "Most salacious affair" },
  { name: "Most affairs with players' wives", stat: "adultery", desc: "Maximum marital disruption" }
];

// Main presentation function
async function showEndOfSeasonPresentation() {
  const stats = getSeasonStats();
  // Ensure fresh randomization - don't cache the host
  const host = selectPresentationHost();
  let hostAnger = 0;
  let silenceBroken = false;
  const maleHosts = ["Paddy McGuinness", "Noel Edmonds", "Phillip Schofield", "Timmy Mallett", "Shafty Rod Johnson"];
  
  // Create modal for end of season presentation
  const overlay = document.createElement('div');
  overlay.className = 'eos-presentation-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'eos-presentation-modal';
  
  const header = document.createElement('div');
  header.className = 'eos-presentation-header';
  
  const title = document.createElement('h1');
  title.className = 'eos-presentation-title';
  title.textContent = '🎭 END-OF-SEASON PRESENTATION 🎭';
  header.appendChild(title);
  
  const content = document.createElement('div');
  content.className = 'eos-presentation-content';
  
  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Stop background music before playing presentation audio
  // Stop general background music using the exposed function
  if (typeof window._stopGeneralMusic === 'function') {
    window._stopGeneralMusic();
  }
  
  // Also directly stop generalMusicAudio if it exists (defensive check)
  if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
    window._debugGeneralMusic.stop();
  }
  
  // Stop opening music if it's playing
  const openingMusic = document.getElementById('openingMusic');
  if (openingMusic && !openingMusic.paused) {
    openingMusic.pause();
    openingMusic.currentTime = 0;
  }
  
  // Play appropriate audio track based on season
  let presentationAudio = null;
  if (S.season >= 1 && S.season <= 3) {
    // Seasons 1, 2, 3: play season.mp3
    presentationAudio = new Audio('https://www.dropbox.com/scl/fi/opfafuo98zo8qqtbh9sq5/season.mp3?rlkey=wis0ryfyhxobetd8q4dc4q75u&st=ce7ckzgo&dl=1');
  } else if (S.season === 4 || S.season === 5) {
    // Seasons 4, 5: play endsrasonmjslim.mp3
    presentationAudio = new Audio('https://www.dropbox.com/scl/fi/9mog5ttfe8bt5r49ovzt9/endsrasonmjslim.mp3?rlkey=kkd25zprf5ylof4e3o3292hnl&st=r3zhrdrg&dl=1');
  }
  
  if (presentationAudio) {
    presentationAudio.volume = 0.7;
    
    // Set up monitoring to keep background music stopped while presentation audio is playing
    const keepMusicStopped = () => {
      if (typeof window._stopGeneralMusic === 'function') {
        window._stopGeneralMusic();
      }
      if (typeof window._debugGeneralMusic !== 'undefined' && window._debugGeneralMusic.playing()) {
        window._debugGeneralMusic.stop();
      }
    };
    
    // Monitor and stop background music periodically while presentation is playing
    const musicStopInterval = setInterval(() => {
      if (!presentationAudio.paused && !presentationAudio.ended) {
        keepMusicStopped();
      } else {
        clearInterval(musicStopInterval);
      }
    }, 500); // Check every 500ms
    
    // Also stop music when presentation audio starts playing
    presentationAudio.addEventListener('play', () => {
      keepMusicStopped();
    });
    
    // Clean up interval when audio ends
    presentationAudio.addEventListener('ended', () => {
      clearInterval(musicStopInterval);
    });
    
    // Clean up interval when audio is paused
    presentationAudio.addEventListener('pause', () => {
      clearInterval(musicStopInterval);
    });
    
    presentationAudio.play().catch(e => console.error('Error playing end of season presentation audio:', e));
    // Store audio reference on overlay for cleanup
    overlay._presentationAudio = presentationAudio;
    overlay._musicStopInterval = musicStopInterval; // Store interval for cleanup
  }
  
  // Helper function to stop audio when overlay is removed
  const originalRemove = overlay.remove.bind(overlay);
  overlay.remove = function() {
    if (this._presentationAudio) {
      this._presentationAudio.pause();
      this._presentationAudio.currentTime = 0;
    }
    // Clear the music stop interval if it exists
    if (this._musicStopInterval) {
      clearInterval(this._musicStopInterval);
    }
    originalRemove();
  };
  
  // Helper function to append content to modal instead of using log()
  const appendToModal = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    content.appendChild(div);
    // Auto-scroll to bottom
    content.scrollTop = content.scrollHeight;
  };
  
  // Helper function to show van onslaught prompt in modal
  const showVanOnslaughtPrompt = async () => {
    // Clear existing content and show van onslaught prompt
    content.innerHTML = '';
    appendToModal(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(255,0,0,0.2),rgba(191,0,255,0.2));border:2px solid var(--neon-purple);border-radius:16px;margin:20px 0;">
      <div style="font-size:1.8rem;color:var(--neon-purple);margin-bottom:15px;">📺 HISTORIC ANNOUNCEMENT 📺</div>
      <div style="font-size:1.3rem;color:var(--text);">Mohammed Van Onslaught is making an historic announcement!</div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const announcementVideoUrl = 'https://www.dropbox.com/scl/fi/797pgco16i0ybz6x1jtgk/ultima-conference.mp4?rlkey=4sq2zcq5ihwf4oe29tcay957m&st=w91u4njh&dl=1';
    
    // Create Watch button container in the modal
    const watchButtonContainer = document.createElement('div');
    watchButtonContainer.style.cssText = 'text-align: center; margin: 20px 0;';
    
    const watchButton = document.createElement('button');
    watchButton.textContent = '📹 Watch Announcement';
    watchButton.style.cssText = `
      padding: 15px 30px;
      margin: 10px 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: 2px solid #4f46e5;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      font-weight: 600;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    `;
    watchButton.onmouseover = () => {
      watchButton.style.transform = 'translateY(-2px)';
      watchButton.style.boxShadow = '0 6px 16px rgba(99,102,241,0.4)';
      watchButton.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
    };
    watchButton.onmouseout = () => {
      watchButton.style.transform = 'translateY(0)';
      watchButton.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)';
      watchButton.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    };
    
    watchButtonContainer.appendChild(watchButton);
    content.appendChild(watchButtonContainer);
    
    // Wait for button click
    await new Promise((resolve) => {
      watchButton.onclick = async () => {
        // Pause presentation audio when video starts
        if (presentationAudio && !presentationAudio.paused) {
          presentationAudio.pause();
        }
        
        // Show the video
        const videoDiv = document.createElement('div');
        videoDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; max-width: 800px; height: 60vh; background: #000; border: 3px solid #6366f1; z-index: 20000; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 20px; box-shadow: 0 0 40px rgba(99,102,241,0.5);';
        
        // Create close handler function
        const closeHandler = () => {
          videoDiv.remove();
          resolve();
        };
        
        // Add prominent X button in top-right corner
        const xButton = document.createElement('button');
        xButton.innerHTML = '✕';
        xButton.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 40px; height: 40px; background: #ff0000; color: white; border: 2px solid #fff; border-radius: 50%; cursor: pointer; font-size: 24px; font-weight: bold; z-index: 20001; display: flex; align-items: center; justify-content: center; line-height: 1;';
        xButton.onclick = closeHandler;
        xButton.title = 'Close';
        
        videoDiv.innerHTML = `<div style="color: #6366f1; font-size: 24px; margin-bottom: 20px;">📹 Historic Announcement</div><video id="historicAnnouncementVideo" controls style="width: 100%; height: calc(100% - 80px); object-fit: contain;"><source src="${announcementVideoUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
        videoDiv.appendChild(xButton);
        document.body.appendChild(videoDiv);
        
        // Wait for video to be closed or finished
        const video = document.getElementById('historicAnnouncementVideo');
        const finalCloseHandler = () => {
          closeHandler();
        };
        
        // Update X button to use final handler
        xButton.onclick = finalCloseHandler;
        
        // Also resolve when video ends
        if (video) {
          video.addEventListener('ended', finalCloseHandler);
        }
      };
    });
    
    appendToModal(`<div style="text-align:center;padding:15px;color:var(--muted);margin:15px 0;">The announcement concludes...</div>`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  };
  
  // Flag to track if van onslaught prompt has been shown (prevents loop)
  let vanOnslaughtPromptShown = false;
  
  // Chairman League removed - no longer showing end-of-season chairman league results
  
  // Add skip buttons directly in the modal (floating buttons)
  let skipPresentation = false;
  let skipRequested = false;
  
  // Check for skip - if requested, jump to skip path immediately
  if (skipPresentation) {
    // Skip path - show final league table first
    appendToModal(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(0,245,255,0.2),rgba(99,102,241,0.2));border:2px solid var(--neon-cyan);border-radius:16px;margin:20px 0;">
      <div style="font-size:1.5rem;color:var(--neon-cyan);">🏆 FINAL LEAGUE TABLE 🏆</div>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Apply bonus points and show final table
    if (!S.leagueTableShownInPresentation) {
      completeAllLeagueGames();
      const finalPos = showFinalLeagueTable();
      S.leagueTableShownInPresentation = true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For season 5, show van onslaught prompt before closing (only if not already shown)
    if (S.season === 5 && !vanOnslaughtPromptShown) {
      vanOnslaughtPromptShown = true;
      await showVanOnslaughtPrompt();
      
      // After van onslaught prompt in skip path, proceed to Ultima Cup flow
      overlay.remove();
      
      // Create centered modal overlay for Ultima Cup announcement
      const ultimaCupOverlay = document.createElement('div');
      ultimaCupOverlay.className = 'ultima-cup-announcement-overlay';
      
      const ultimaCupModal = document.createElement('div');
      ultimaCupModal.className = 'ultima-cup-announcement-modal';
      
      const ultimaCupTitle = document.createElement('h2');
      ultimaCupTitle.className = 'ultima-cup-announcement-title';
      ultimaCupTitle.textContent = '🏆 THE ULTIMA CUP FINAL 🏆';
      
      const ultimaCupContent = document.createElement('div');
      ultimaCupContent.className = 'ultima-cup-announcement-content';
      
      const initialText = document.createElement('p');
      initialText.className = 'ultima-cup-announcement-text';
      initialText.innerHTML = 'The main game is over. This is the finale.<br>' +
                       'One extraordinary match awaits.<br>' +
                       'Four teams. Two balls. One square pitch.<br>' +
                       'The greatest spectacle in football history.';
      ultimaCupContent.appendChild(initialText);
      
      const teamsSection = document.createElement('div');
      teamsSection.className = 'ultima-cup-section';
      teamsSection.innerHTML = `
        <h2>THE TEAMS</h2>
        <div class="ultima-cup-teams-grid">
          <div class="ultima-cup-team-card">
            <h3>Southampton FC</h3>
            <p>Your team. The journey ends here.</p>
          </div>
          <div class="ultima-cup-team-card">
            <h3>Portsmouth</h3>
            <p>Your eternal rivals. The derby to end all derbies.</p>
          </div>
          <div class="ultima-cup-team-card">
            <h3>Legends FC</h3>
            <p>The best current players in the world. A team of superstars.</p>
          </div>
          <div class="ultima-cup-team-card">
            <h3>Ultima FC</h3>
            <p>The greatest players of all time. Footballing immortals.</p>
          </div>
        </div>
      `;
      ultimaCupContent.appendChild(teamsSection);
      
      const venueSection = document.createElement('div');
      venueSection.className = 'ultima-cup-section';
      venueSection.innerHTML = `
        <h2>THE VENUE</h2>
        <div style="text-align:center;padding:20px;">
          <h3>Ultima Stadium, Bradford</h3>
          <p style="font-size:1.2rem;color:#FFF;line-height:1.8;">
            A stadium built for this moment.<br>
            A square pitch. Four goals. Two balls.<br>
            The stage is set for chaos and glory.
          </p>
        </div>
      `;
      ultimaCupContent.appendChild(venueSection);
      
      const rulesSection = document.createElement('div');
      rulesSection.className = 'ultima-cup-section';
      rulesSection.innerHTML = `
        <h2>THE RULES</h2>
        <ul class="ultima-cup-rules-list">
          <li>
            <strong>Square Pitch:</strong> The pitch is a perfect square, with a goal on each of the four sides.
          </li>
          <li>
            <strong>Four Teams:</strong> All four teams play simultaneously on the same pitch.
          </li>
          <li>
            <strong>Two Balls:</strong> Two footballs are in play at all times. Chaos reigns.
          </li>
          <li>
            <strong>Victory:</strong> Score in any of the three opposing goals. The team with the most goals wins.
          </li>
        </ul>
      `;
      ultimaCupContent.appendChild(rulesSection);
      
      const prepSection = document.createElement('div');
      prepSection.className = 'ultima-cup-preparation';
      prepSection.innerHTML = `
        <p>Prepare for the ultimate match.</p>
        <p class="secondary">This is unlike anything you've ever experienced.</p>
      `;
      ultimaCupContent.appendChild(prepSection);
      
      const button = document.createElement('button');
      button.className = 'ultima-cup-announcement-button';
      button.textContent = '🏆 PROCEED TO PRE-MATCH ACTIONS 🏆';
      
      ultimaCupModal.appendChild(ultimaCupTitle);
      ultimaCupModal.appendChild(ultimaCupContent);
      ultimaCupModal.appendChild(button);
      ultimaCupOverlay.appendChild(ultimaCupModal);
      document.body.appendChild(ultimaCupOverlay);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const buttonClickPromise = new Promise(resolve => {
        button.onclick = () => {
          ultimaCupOverlay.remove();
          resolve();
        };
      });
      
      await buttonClickPromise;
      
      // Mark that we've advanced to ultima cup so endOfSeason() is skipped
      if (!S.ultimaCup) S.ultimaCup = {};
      S.ultimaCup.advancedFromSeason5 = true;
      S.ultimaCup.introShownInModal = true;
      
      // Call ultimaCupPreMatch which will skip the intro sections
      await ultimaCupPreMatch();
      
      return; // Don't proceed further
    }
    
    // Now close modal and return
    overlay.remove();
    return;
  }
  
  // Continue with presentation (now continuous from chairman league)
  // Change host name for seasons 4 and 5 if it's Shafty Rod Johnson
  let displayHostName = host.name;
  if ((S.season === 4 || S.season === 5) && host.name === "Shafty Rod Johnson") {
    displayHostName = "Sheikhy Rod Johnson";
  }
  
  // Intro monologue
  const introLine = pickLine(host.intro);
  appendToModal(`<div style="text-align:center;padding:20px;font-size:1.3rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
    <strong>${displayHostName}:</strong> "${introLine}"
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Special line for Philip Schofield
  if (host.name === "Phillip Schofield") {
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "Any young lads in here? haha just joking! but seriously? ha ha!"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Check for skip after intro
  if (skipPresentation) {
    if (!S.leagueTableShownInPresentation) {
      completeAllLeagueGames();
      showFinalLeagueTable();
      S.leagueTableShownInPresentation = true;
    }
    overlay.remove();
    return;
  }
  
  // For seasons 4 and 5, add jokes about previous season events and Muslim culture jokes
  if (S.season === 4 || S.season === 5) {
    // Check for events from any previous season and add jokes
    const eventJokes = [];
    
    // Check for kuddle cronster (season 2) - check if we're past season 2
    if (S.season >= 4) {
      // The kuddle cronster was defeated in season 2, so if we're in season 4 or 5, it happened
      eventJokes.push("Speaking of juice, remember that Kuddle Cronster fella? Squeezed women dry then got stomped by the chairman of Southampton. Proper mess, that. Like a kebab shop at 3am.");
      eventJokes.push("The Kuddle Cronster got what was coming to him, didn't he? Squeezed the life out of women then got his head stamped in. Justice served, innit?");
    }
    
    // Check for terrorist attack at St Mary's (season 2, match 11) - check if we're past season 2
    if (S.season >= 4) {
      eventJokes.push("St Mary's got hit by terrorists a while back. Proper chaos. Still, at least the stadium's still standing. Unlike some people's careers.");
      eventJokes.push("Remember that terrorist attack at St Mary's? Bloody hell. Still, could've been worse - could've been a Paddy McGuinness gig.");
    }
    
    // Check for Portsmouth bus explosion (can happen in season 2 or 3)
    if (S.portsmouth_bus_destroyed) {
      eventJokes.push("Portsmouth's team bus went up in smoke. All dead. Tragic, really. Still, at least they won't be playing us again.");
      eventJokes.push("Portsmouth's bus exploded. All on board killed. Proper disaster. Still, saves us the trouble of beating them, doesn't it?");
    }
    
    // Check for Gascoigne being murdered with a brick (season 3)
    if (S.season >= 4 && S.season3 && S.season3.gaz_killed_by_player) {
      eventJokes.push("Paul Gascoigne got murdered with a brick. Proper way to go, that. Quick and messy. Like my last relationship.");
      eventJokes.push("Gazza got done in with a brick. Brutal, but efficient. Like a kebab shop bouncer.");
    }
    
    // Check for Delmor Krunchem's family being murdered (season 3)
    if (S.season >= 4 && S.season3 && S.season3.krunchem_family_murdered) {
      eventJokes.push("Delmor Krunchem's entire family got murdered. All of them. Proper bloodbath. Still, at least he's got more time for work now.");
      eventJokes.push("Krunchem's family got wiped out. Every last one. Tragic, really. Still, saves on Christmas presents, doesn't it?");
    }
    
    // Add event jokes if any
    if (eventJokes.length > 0) {
      const eventJoke = pickLine(eventJokes);
      appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
        <strong>${displayHostName}:</strong> "${eventJoke}"
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Add Muslim culture jokes for all presenters in seasons 4 and 5
    const muslimJokes = [
      "Right, before we get started, I just want to say - I love Muslim culture, me. Proper respect for tradition and all that. Women know their place, don't they? None of this modern nonsense. Back in the day, women knew when to keep their mouths shut. Brilliant, that.",
      "I've been learning about Muslim culture, me. Proper fascinating. Women covering up, knowing their place, all that. None of this 'equality' bollocks. A woman's place is in the home, making dinner and keeping quiet. That's how it should be, innit?",
      "Muslim culture's got it right, hasn't it? Women covered up, staying at home, doing what they're told. None of this 'women's rights' nonsense. A woman's job is to cook, clean, and keep her trap shut. Simple as that.",
      "I respect Muslim culture, me. Proper traditional values. Women know their place - in the kitchen, covered up, keeping quiet. None of this modern 'empowerment' rubbish. A woman's worth is in her silence and her cooking. That's what I say.",
      "Muslim women have got it right, haven't they? Covered up, staying home, doing as they're told. None of this 'speaking your mind' bollocks. A woman's voice should only be heard when she's calling you for dinner. That's proper respect, that is.",
      "I love how Muslim culture respects women by keeping them in their place. Covered up, at home, quiet. None of this 'equality' nonsense. A woman's job is to serve her man and keep her opinions to herself. Brilliant system, that.",
      "Muslim culture teaches women to know their place - covered, quiet, obedient. None of this modern 'women's rights' rubbish. A woman's value is in her silence and her ability to cook a decent curry. That's proper respect, innit?"
    ];
    const muslimJoke = pickLine(muslimJokes);
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "${muslimJoke}"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    appendToModal(`<div style="padding:10px;color:var(--muted);font-size:0.9rem;">[Awkward silence] [Some uncomfortable shifting in seats] [A few people leave]</div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  
  // Special interactions for Anthea Turner and Shafty Rod Johnson
  if (host.name === "Anthea Turner") {
    // Add more banter from Anthea
    const antheaBanter = [
      "Oh my, what a season you've had! I've seen better seasons on a wet Tuesday in Stoke!",
      "Well, well, well... look who's back! And I thought my career was bad after GMTV!",
      "This is going to be interesting! I've hosted better ceremonies in my sleep!",
      "Let me tell you, I've seen a lot in my time, but this... this is something else!",
      "Oh dear, where do I even begin? This season has been... eventful, to say the least!",
      "I'm here to sprinkle some glamour on your otherwise catastrophic season! Good luck with that!"
    ];
    const banterLine = pickLine(antheaBanter);
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "${banterLine}"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Anthea's special interaction
    const wantsToSee = Math.random() < 0.7; // 70% chance she asks
    if (wantsToSee) {
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
        <strong>${displayHostName}:</strong> "Before we continue, would anyone like to see my burger and baps?"
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--warn);background:rgba(255,167,38,0.1);border:1px solid var(--warn);border-radius:8px;margin:15px 0;">
        Anthea Turner suddenly exposes herself to the audience!
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
        The entire audience begins moaning in pleasure! The stadium echoes with ecstatic sounds!
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--muted);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
        <strong>${displayHostName}:</strong> "Well, that was... unexpected! Now, back to the ceremony!"
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } else if (host.name === "Shafty Rod Johnson") {
    // Add more banter from Shafty
    const shaftyBanter = [
      "Holy MOTHER, look at this crowd! I've not seen this many disappointed faces since my last court appearance!",
      "Christ alive, I've hosted gigs in prisons that were less depressing than this.",
      "Strap in! Or don't! I didn't! That's why I've got four restraining orders and a baby called *Unknown Parentage*!",
      "Welcome to the Southampton End-of-Season Autopsy! Not a 'review', no — this club DIED months ago and we're just poking the remains with a stick!",
      "I've seen better seasons in a skip behind a kebab shop!",
      "This is going to be fun! Or at least, it'll be something! Probably something terrible, but something nonetheless!"
    ];
    const banterLine = pickLine(shaftyBanter);
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "${banterLine}"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Shafty's special interaction - he exposes himself
    const shaftyExposes = Math.random() < 0.6; // 60% chance
    if (shaftyExposes) {
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--warn);background:rgba(255,167,38,0.1);border:1px solid var(--warn);border-radius:8px;margin:15px 0;">
        ${displayHostName} suddenly exposes himself to the audience!
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
        The crowd gasps! Some are horrified, others... less so. Security looks confused.
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--muted);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
        <strong>${displayHostName}:</strong> "Right, that's enough of that! Back to the ceremony before I get arrested again!"
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } else {
    // Add general banter for other presenters
    const generalBanter = [
      "Well, this should be interesting! Let's see what kind of season you've had!",
      "Time to review your season! I'm sure it's been... eventful!",
      "Let's get this show on the road! I've got places to be, scandals to cause!",
      "Welcome to your end-of-season review! This is going to be... something!",
      "Right then, let's see what kind of chaos you've caused this season!",
      "Time to reveal all! Or at least, reveal enough to make this interesting!"
    ];
    const banterLine = pickLine(generalBanter);
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "${banterLine}"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Moment of Silence check
  if (stats.stadiumDestroyed || stats.teamNuked || stats.massCasualty) {
    const silenceLine = pickLine(host.momentOfSilence);
    appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--warn);background:rgba(255,167,38,0.1);border:1px solid var(--warn);border-radius:8px;margin:15px 0;">
      <strong>${displayHostName}:</strong> "${silenceLine}"
    </div>`);
    appendToModal("The crowd observes a respectful silence...");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Roast section (reduced - only one roast)
  const roastLines = getRoastLines(host, stats);
  const selectedRoast = pickLine(roastLines);
  appendToModal(`<div style="text-align:center;padding:20px;font-size:1.2rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
    <strong>${displayHostName}:</strong> "${selectedRoast}"
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // KFC Bonus Points Ceremony
  appendToModal(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(255,0,128,0.2),rgba(191,0,255,0.2));border:2px solid var(--neon-pink);border-radius:16px;margin:20px 0;">
    <div style="font-size:1.5rem;color:var(--neon-pink);margin-bottom:10px;">🍗 KFC SPONSORED BONUS POINTS CEREMONY 🍗</div>
    <div style="font-size:1.2rem;color:var(--text);">This season's bonus points are generously sponsored by <strong>KFC</strong>—It's <em>Finger Lickin' FIXED!</em></div>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Add presenter banter for KFC ceremony - expanded for all presenters
  let kfcBanter = [];
  if (host.name === "Anthea Turner") {
    kfcBanter = [
      "Oh my! KFC sponsoring bonus points? That's almost as greasy as your season!",
      "KFC and football corruption? Now I've seen everything! And I've seen a lot!",
      "Finger lickin' fixed indeed! This is more rigged than my last TV contract!",
      "KFC sponsoring this? I've seen better sponsorships! Actually, I haven't, but still!",
      "Well, this is... interesting! KFC and football? What could go wrong?"
    ];
  } else if (host.name === "Shafty Rod Johnson") {
    kfcBanter = [
      "KFC sponsoring bonus points? That's more corrupt than my last court case!",
      "Finger lickin' fixed! I've seen less rigged elections!",
      "KFC and football? This is more greasy than my last relationship!",
      "Well, this is something! KFC sponsoring corruption! I approve!",
      "KFC? More like K-F-Corruption! Am I right? No? Okay then."
    ];
  } else if (host.name === "Paddy McGuinness") {
    kfcBanter = [
      "NO LIKEY—NO KFC—NO LIGHTY! This is more greasy than your season!",
      "KFC sponsoring this? That's more fixed than VAR!",
      "Finger lickin' fixed! This is more rigged than my last dating show!"
    ];
  } else if (host.name === "Noel Edmonds") {
    kfcBanter = [
      "Inside your Season Box, I find... KFC sponsorship. The Banker is concerned.",
      "Deal... or No Deal? With KFC involved, it's definitely NO DEAL.",
      "The Banker says... KFC sponsorship is more suspicious than your season."
    ];
  } else if (host.name === "Phillip Schofield") {
    kfcBanter = [
      "KFC sponsoring this? I'm innocent! Haha! Unless...?",
      "This is more rigged than my career! Haha! ...Haha?",
      "KFC and corruption? I've seen better sponsorships on This Morning!"
    ];
  } else if (host.name === "Mrs. Brown") {
    kfcBanter = [
      "KFC sponsoring this? That's nice, that's nice... THAT'S SHITE!",
      "Feck me, KFC and football? This is more corrupt than a Dublin politician!",
      "KFC? More like K-F-Corruption! Feckin' hell!"
    ];
  } else {
    kfcBanter = [
      "KFC sponsoring bonus points? That's more greasy than your season!",
      "Finger lickin' fixed! This is more rigged than... well, everything!",
      "KFC and football corruption? Now I've seen everything!",
      "Well, this is interesting! KFC sponsoring this ceremony!",
      "KFC? More like K-F-Corruption! Am I right?"
    ];
  }
  const kfcBanterLine = pickLine(kfcBanter);
  appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
    <strong>${displayHostName}:</strong> "${kfcBanterLine}"
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Filter challenges to only those the player can actually do (has stat > 0 or tied to player records)
  const availableChallenges = BONUS_CHALLENGES.filter(challenge => {
    const ourStat = stats[challenge.stat] || 0;
    // Include challenges where player has engaged OR challenges tied to actual player records/stats
    return ourStat > 0;
  });
  
  // If no available challenges (player hasn't done anything), use all challenges as fallback
  const challengePool = availableChallenges.length > 0 ? availableChallenges : [...BONUS_CHALLENGES];
  
  // Select ONE random challenge
  const selectedChallenge = challengePool.length > 0 
    ? challengePool[Math.floor(Math.random() * challengePool.length)]
    : null;
  
  if (selectedChallenge) {
    // Add banter before challenge
    const challengeIntroBanter = [
      "Now, let's see who wins this bonus point challenge!",
      "Time for the bonus point challenge! This should be... interesting!",
      "And now, the bonus point challenge! Let's see who comes out on top!",
      "Time to award some bonus points! Or at least, try to!",
      "Now for the bonus points! I'm sure this will be completely fair and unbiased!",
      "Let's see who wins this challenge! Spoiler: it might not be you!"
    ];
    const challengeIntroLine = pickLine(challengeIntroBanter);
    appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
      <strong>${displayHostName}:</strong> "${challengeIntroLine}"
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get real teams (excluding Southampton)
    const availableTeams = ALL_TEAMS.filter(t => t !== "Southampton FC");
    const ourStat = stats[selectedChallenge.stat] || 0;
    
    // If player engaged in this behavior, give them a decent chance (30-50% depending on stat value)
    const playerEngaged = ourStat > 0;
    const playerWinChance = playerEngaged ? Math.min(0.5, 0.3 + (ourStat / 100)) : 0;
    
    // Determine winner
    let winnerTeam;
    let winnerStat;
    
    if (playerEngaged && Math.random() < playerWinChance) {
      // Player wins
      winnerTeam = "Southampton FC";
      winnerStat = ourStat;
    } else {
      // Random AI team wins with a random stat value
      const randomTeamIdx = Math.floor(Math.random() * availableTeams.length);
      winnerTeam = availableTeams[randomTeamIdx];
      // Generate a plausible stat value (higher if player engaged, showing competition)
      winnerStat = playerEngaged 
        ? Math.max(ourStat, Math.floor(Math.random() * (ourStat + 20)) + 1)
        : Math.floor(Math.random() * 15) + 1;
    }
    
    appendToModal(`<div style="padding:15px;margin:10px 0;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid var(--border);">
      <strong>Challenge: ${selectedChallenge.name}</strong><br>
      <span style="color:var(--muted);">${selectedChallenge.desc}</span>
    </div>`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (winnerTeam === "Southampton FC") {
      appendToModal(`<div style="color:var(--good);padding:15px;font-size:1.2rem;background:rgba(0,212,170,0.1);border:1px solid var(--good);border-radius:8px;margin:10px 0;">
        🏆 SOUTHAMPTON WINS! +3 league points!
      </div>`);
      const bonusPointsWon = 3;
      S.points = (S.points || 0) + bonusPointsWon;
      // Also update the league table to include bonus points
      const clubName = S.club_name || "Southampton FC";
      if (!S.table) S.table = {};
      if (!S.table[clubName]) {
        // Initialize table entry if it doesn't exist
        ensureLeagueTableInit();
      }
      if (S.table[clubName]) {
        S.table[clubName].PTS = (S.table[clubName].PTS || 0) + bonusPointsWon;
      }
      S.morale = Math.min(100, (S.morale || 0) + 5);
      appendToModal("✨ Morale +5! Fans are confused but pleased!");
    } else {
      appendToModal(`<div style="color:var(--muted);padding:10px;">Winner: ${winnerTeam} (${winnerStat} ${selectedChallenge.stat})</div>`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Final League Winner Declaration
  appendToModal(`<div style="text-align:center;padding:30px;background:linear-gradient(135deg,rgba(0,245,255,0.2),rgba(99,102,241,0.2));border:2px solid var(--neon-cyan);border-radius:16px;margin:20px 0;">
    <div style="font-size:1.5rem;color:var(--neon-cyan);">🏆 FINAL LEAGUE TABLE 🏆</div>
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Add presenter banter before showing league table - expanded for all presenters
  let tableBanter = [];
  if (host.name === "Anthea Turner") {
    tableBanter = [
      "And now, the moment we've all been waiting for... well, some of us anyway!",
      "Time to see where you finished! Spoiler alert: it's probably not as good as you think!",
      "Let's see the final standings! I'm sure this will be... interesting.",
      "The league table! This is more exciting than my last TV appearance! Which isn't saying much...",
      "Time for the final league table! I'm sure you're thrilled... or terrified!"
    ];
  } else if (host.name === "Shafty Rod Johnson") {
    tableBanter = [
      "Right, time for the final league table! This is where it gets REALLY interesting!",
      "And now, the moment of truth! The final league standings!",
      "Time to see where you finished! I'm sure it's not where you wanted to be!",
      "The final league table! This is more exciting than my last court appearance!",
      "Let's see the final standings! I'm sure this will be... enlightening!"
    ];
  } else if (host.name === "Paddy McGuinness") {
    tableBanter = [
      "NO LIKEY—NO LEAGUE TABLE—NO LIGHTY! Just kidding, here it is!",
      "Time for the final league table! NO LIKEY—NO LIGHTY!",
      "And now, the moment we've all been waiting for! The final standings!",
      "The league table! This is more exciting than my last dating show!"
    ];
  } else if (host.name === "Noel Edmonds") {
    tableBanter = [
      "Inside your Season Box, I find... the final league table!",
      "Deal... or No Deal? Let's see where you finished!",
      "The Banker says... it's time for the final league table!",
      "And now, the final standings! The Banker is watching!"
    ];
  } else if (host.name === "Phillip Schofield") {
    tableBanter = [
      "And now, the final league table! I'm innocent! Haha!",
      "Time to see where you finished! Please don't sue me!",
      "The final standings! This is more exciting than This Morning!",
      "Let's see the league table! I'm sure it's... interesting!"
    ];
  } else if (host.name === "Mrs. Brown") {
    tableBanter = [
      "Right, time for the final league table! That's nice, that's nice...",
      "The final standings! Feck me, this should be good!",
      "Time to see where you finished! I'm sure it's shite!",
      "The league table! Let's see how fecked you are!"
    ];
  } else {
    tableBanter = [
      "And now, the moment we've all been waiting for! The final league table!",
      "Time to see where you finished! I'm sure it's... interesting!",
      "The final standings! This is where it gets really interesting!",
      "Let's see the league table! I'm sure you're thrilled... or terrified!",
      "Time for the final league table! This is more exciting than... well, most things!"
    ];
  }
  const tableBanterLine = pickLine(tableBanter);
  appendToModal(`<div style="text-align:center;padding:15px;font-size:1.1rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:10px 0;">
    <strong>${displayHostName}:</strong> "${tableBanterLine}"
  </div>`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Apply bonus points and show final table (only show once, mark as shown)
  if (!S.leagueTableShownInPresentation) {
    completeAllLeagueGames();
    const finalPos = showFinalLeagueTable();
    S.leagueTableShownInPresentation = true;
    
    // Get winner information
    const rows = getFinalStandings();
    const winner = rows.length > 0 ? rows[0] : null;
    const playerWon = finalPos === 1;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Announce winner
    if (winner) {
      appendToModal(`<div style="text-align:center;padding:20px;font-size:1.5rem;color:var(--neon-cyan);background:rgba(0,245,255,0.1);border:2px solid var(--neon-cyan);border-radius:12px;margin:20px 0;">
        <strong>🏆 PREMIER LEAGUE CHAMPIONS: ${winner.team} 🏆</strong>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Specify what place the player's team finished
      const positionSuffix = finalPos === 1 ? 'st' : finalPos === 2 ? 'nd' : finalPos === 3 ? 'rd' : 'th';
      appendToModal(`<div style="text-align:center;padding:15px;font-size:1.2rem;color:var(--text);background:rgba(255,255,255,0.05);border-radius:8px;margin:15px 0;">
        <strong>Your team finished in ${finalPos}${positionSuffix} place.</strong>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // If player won, show confetti explosion with FUCK YES
    if (playerWon) {
      // Confetti explosion effect - append to body, not modal
      const confettiContainer = document.createElement('div');
      confettiContainer.id = 'confetti-container';
      confettiContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20001;';
      document.body.appendChild(confettiContainer);
      if (confettiContainer) {
        // Create confetti particles
        for (let i = 0; i < 100; i++) {
          const confetti = document.createElement('div');
          confetti.style.position = 'absolute';
          confetti.style.width = '10px';
          confetti.style.height = '10px';
          confetti.style.backgroundColor = ['#00d4aa', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'][Math.floor(Math.random() * 5)];
          confetti.style.left = Math.random() * 100 + '%';
          confetti.style.top = '-10px';
          confetti.style.borderRadius = '50%';
          confetti.style.animation = `confettiFall ${2 + Math.random() * 2}s linear forwards`;
          confettiContainer.appendChild(confetti);
        }
        
        // Add CSS animation if not already present
        if (!document.getElementById('confetti-style')) {
          const style = document.createElement('style');
          style.id = 'confetti-style';
          style.textContent = `
            @keyframes confettiFall {
              to {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
          `;
          document.head.appendChild(style);
        }
        
        // Remove confetti after animation
        setTimeout(() => {
          if (confettiContainer) confettiContainer.remove();
        }, 4000);
      }
      
      appendToModal(`<div style="text-align:center;padding:30px;font-size:3rem;color:var(--good);background:rgba(0,212,170,0.2);border:4px solid var(--good);border-radius:16px;margin:20px 0;font-weight:bold;text-shadow:0 0 20px var(--good);">
        FUCK YES!
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const moraleBoost = 30;
      const cashReward = 50000000;
      S.club_cash = (S.club_cash || 0) + cashReward;
      S.reputation = Math.min(100, (S.reputation || 0) + 10);
      S.morale = Math.min(100, (S.morale || 0) + moraleBoost);
      
      // Award lobby tokens for winning the league
      if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;
      const lobbyTokensAwarded = 200;
      S.lobby_tokens = (S.lobby_tokens || 0) + lobbyTokensAwarded;
      
      appendToModal(`<div style="color:var(--good);padding:20px;font-size:1.3rem;background:rgba(0,212,170,0.15);border:3px solid var(--good);border-radius:12px;margin:20px 0;text-align:center;">
        <div style="font-size:1.8rem;margin-bottom:15px;">🏆 PREMIER LEAGUE CHAMPIONS! 🏆</div>
        <div style="font-size:1.1rem;line-height:1.8;">
          <strong>💰 CASH REWARD:</strong> ${money(cashReward)}<br>
          <strong>📈 MORALE:</strong> +${moraleBoost}<br>
          <strong>⭐ REPUTATION:</strong> +10<br>
          <strong>🎮 LOBBY TOKENS:</strong> +${lobbyTokensAwarded}
        </div>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else if (finalPos <= 4) {
      // Top 4 but not winner
      await new Promise(resolve => setTimeout(resolve, 2000));
      const moraleBoost = finalPos === 2 ? 25 : finalPos === 3 ? 20 : 15;
      const cashReward = finalPos === 2 ? 30000000 : finalPos === 3 ? 20000000 : 10000000;
      S.club_cash = (S.club_cash || 0) + cashReward;
      S.reputation = Math.min(100, (S.reputation || 0) + 10);
      S.morale = Math.min(100, (S.morale || 0) + moraleBoost);
      
      appendToModal(`<div style="color:var(--good);padding:20px;font-size:1.3rem;background:rgba(0,212,170,0.15);border:3px solid var(--good);border-radius:12px;margin:20px 0;text-align:center;">
        <div style="font-size:1.8rem;margin-bottom:15px;">🎉 TOP 4 FINISH! 🎉</div>
        <div style="font-size:1.1rem;line-height:1.8;">
          <strong>💰 CASH REWARD:</strong> ${money(cashReward)}<br>
          <strong>📈 MORALE:</strong> +${moraleBoost}<br>
          <strong>⭐ REPUTATION:</strong> +10
        </div>
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else if (finalPos >= 15) {
      S.morale = Math.max(-100, (S.morale || 0) - 25);
      S.reputation = Math.max(0, (S.reputation || 0) - 15);
      appendToModal(`<div style="color:var(--bad);padding:15px;font-size:1.2rem;background:rgba(255,71,87,0.1);border:2px solid var(--bad);border-radius:8px;margin:15px 0;">
        💀 RELEGATION ZONE!<br>
        Morale -25 | Reputation -15<br>
        Fans chant: "OUT! OUT! OUT!"
      </div>`);
      
      // Delmor Krunchem text
      appendToModal(`<div style="background:rgba(255,0,0,0.1);border:1px solid var(--bad);padding:15px;margin:15px 0;border-radius:8px;">
        <strong>📱 SMS from Delmor Krunchem:</strong><br>
        "LOL YOU LITTLE FOOTBALL WORM 🐛<br>
        U COULDN'T RUN A PUB TEAM<br>
        UR CLUB SMELLS LIKE PISS AND FAILURE<br>
        SEE U IN HELL xxx"
      </div>`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Season 5: Special Ultima Cup finale
  if (S.season === 5) {
    // Show historic announcement BEFORE Ultima Cup UI - IN THE PRESENTATION MODAL
    await showVanOnslaughtPrompt();
    
    // Remove the original end-of-season presentation overlay before showing Ultima Cup announcement
    // This prevents the close button from being clicked and re-triggering the van onslaught prompt
    overlay.remove();
    
    // Create centered modal overlay for Ultima Cup announcement
    const ultimaCupOverlay = document.createElement('div');
    ultimaCupOverlay.className = 'ultima-cup-announcement-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'ultima-cup-announcement-modal';
    
    const title = document.createElement('h2');
    title.className = 'ultima-cup-announcement-title';
    title.textContent = '🏆 THE ULTIMA CUP FINAL 🏆';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'ultima-cup-announcement-content';
    
    // Initial announcement
    const initialText = document.createElement('p');
    initialText.className = 'ultima-cup-announcement-text';
    initialText.innerHTML = 'The main game is over. This is the finale.<br>' +
                     'One extraordinary match awaits.<br>' +
                     'Four teams. Two balls. One square pitch.<br>' +
                     'The greatest spectacle in football history.';
    content.appendChild(initialText);
    
    // Teams section
    const teamsSection = document.createElement('div');
    teamsSection.className = 'ultima-cup-section';
    teamsSection.innerHTML = `
      <h2>THE TEAMS</h2>
      <div class="ultima-cup-teams-grid">
        <div class="ultima-cup-team-card">
          <h3>Southampton FC</h3>
          <p>Your team. The journey ends here.</p>
        </div>
        <div class="ultima-cup-team-card">
          <h3>Portsmouth</h3>
          <p>Your eternal rivals. The derby to end all derbies.</p>
        </div>
        <div class="ultima-cup-team-card">
          <h3>Legends FC</h3>
          <p>The best current players in the world. A team of superstars.</p>
        </div>
        <div class="ultima-cup-team-card">
          <h3>Ultima FC</h3>
          <p>The greatest players of all time. Footballing immortals.</p>
        </div>
      </div>
    `;
    content.appendChild(teamsSection);
    
    // Venue section
    const venueSection = document.createElement('div');
    venueSection.className = 'ultima-cup-section';
    venueSection.innerHTML = `
      <h2>THE VENUE</h2>
      <div style="text-align:center;padding:20px;">
        <h3>Ultima Stadium, Bradford</h3>
        <p style="font-size:1.2rem;color:#FFF;line-height:1.8;">
          A stadium built for this moment.<br>
          A square pitch. Four goals. Two balls.<br>
          The stage is set for chaos and glory.
        </p>
      </div>
    `;
    content.appendChild(venueSection);
    
    // Rules section
    const rulesSection = document.createElement('div');
    rulesSection.className = 'ultima-cup-section';
    rulesSection.innerHTML = `
      <h2>THE RULES</h2>
      <ul class="ultima-cup-rules-list">
        <li>
          <strong>Square Pitch:</strong> The pitch is a perfect square, with a goal on each of the four sides.
        </li>
        <li>
          <strong>Four Teams:</strong> All four teams play simultaneously on the same pitch.
        </li>
        <li>
          <strong>Two Balls:</strong> Two footballs are in play at all times. Chaos reigns.
        </li>
        <li>
          <strong>Victory:</strong> Score in any of the three opposing goals. The team with the most goals wins.
        </li>
      </ul>
    `;
    content.appendChild(rulesSection);
    
    // Preparation section
    const prepSection = document.createElement('div');
    prepSection.className = 'ultima-cup-preparation';
    prepSection.innerHTML = `
      <p>Prepare for the ultimate match.</p>
      <p class="secondary">This is unlike anything you've ever experienced.</p>
    `;
    content.appendChild(prepSection);
    
    const button = document.createElement('button');
    button.className = 'ultima-cup-announcement-button';
    button.textContent = '🏆 PROCEED TO PRE-MATCH ACTIONS 🏆';
    
    modal.appendChild(title);
    modal.appendChild(content);
    modal.appendChild(button);
    ultimaCupOverlay.appendChild(modal);
    document.body.appendChild(ultimaCupOverlay);
    
    // Wait a moment for animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create promise to wait for button click
    const buttonClickPromise = new Promise(resolve => {
      button.onclick = () => {
        ultimaCupOverlay.remove();
        resolve();
      };
    });
    
    // Wait for button click
    await buttonClickPromise;
    
    // Proceed to Ultima Cup pre-match (intro sections are now in the modal, so skip them)
    // Mark that we've advanced to ultima cup so endOfSeason() is skipped
    if (!S.ultimaCup) S.ultimaCup = {};
    S.ultimaCup.advancedFromSeason5 = true;
    S.ultimaCup.introShownInModal = true; // Flag to skip intro sections in ultimaCupPreMatch
    
    // Call ultimaCupPreMatch which will skip the intro sections
    await ultimaCupPreMatch();
    
    return; // Don't proceed to normal endOfSeason
  } else {
    // Add "End Presentation" button in modal instead of using choose()
    appendToModal("The presentation concludes. Time to face the consequences...");
    
    const endBtn = document.createElement('button');
    endBtn.textContent = 'End Presentation';
    endBtn.style.cssText = 'padding:12px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;box-shadow:0 4px 12px rgba(99,102,241,0.3);transition:all 0.2s;margin:20px auto;display:block;';
    endBtn.onmouseover = () => { endBtn.style.transform = 'translateY(-2px)'; endBtn.style.boxShadow = '0 6px 16px rgba(99,102,241,0.4)'; };
    endBtn.onmouseout = () => { endBtn.style.transform = 'translateY(0)'; endBtn.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)'; };
    
    const endBtnPromise = new Promise(resolve => {
      endBtn.onclick = () => {
        overlay.remove();
        resolve();
      };
    });
    
    content.appendChild(endBtn);
    await endBtnPromise;
  }
}
