// ===== Fixtures & Table UI =====
window.ensureFixturesUI = function(){
  const setupFixturesUI = () => {
    const btns = document.querySelectorAll('#openFixturesBtn');
    if (btns.length > 1) btns.forEach((b,i)=> i>0 && b.remove());
    const btn = document.getElementById('openFixturesBtn');
    if (btn){
      // Remove all existing event listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add click handler
      newBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        try {
          if (typeof window.toggleFixturesPane === 'function') {
            window.toggleFixturesPane(true);
          } else if (typeof toggleFixturesPane === 'function') {
            toggleFixturesPane(true);
          } else {
            console.error('toggleFixturesPane function not found!');
            alert('Fixtures panel could not be opened. Please refresh the page.');
          }
        } catch (error) {
          console.error('Error opening fixtures panel:', error);
          alert('Error opening fixtures panel: ' + error.message);
        }
      });
      
    } else {
      setTimeout(setupFixturesUI, 100);
      const hudBar = document.getElementById('hudBar');
      if (hudBar && !document.getElementById('openFixturesBtn')) {
        const fallbackBtn = document.createElement('button');
        fallbackBtn.id = 'openFixturesBtn';
        fallbackBtn.textContent = '📅 Fixtures & Table';
        fallbackBtn.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          try {
            if (typeof window.toggleFixturesPane === 'function') {
              window.toggleFixturesPane(true);
            } else if (typeof toggleFixturesPane === 'function') {
              toggleFixturesPane(true);
            } else {
              console.error('toggleFixturesPane function not found!');
              alert('Fixtures panel could not be opened. Please refresh the page.');
            }
          } catch (error) {
            console.error('Error opening fixtures panel:', error);
            alert('Error opening fixtures panel: ' + error.message);
          }
        });
        hudBar.appendChild(fallbackBtn);
      }
    }
    ensureFixturesPane();
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFixturesUI);
  } else {
    setupFixturesUI();
  }
};

window.ensureFixturesPane = function(){
  let pane = document.getElementById('fixturesPane');
  if (!pane) {
    pane = document.createElement('div');
    pane.id = 'fixturesPane';
    pane.className = 'panel';
    pane.style.display = 'none';
    pane.style.position = 'fixed';
    pane.style.top = '50%';
    pane.style.left = '50%';
    pane.style.transform = 'translate(-50%, -50%)';
    pane.style.zIndex = '1000';
    pane.style.maxWidth = '900px';
    pane.style.maxHeight = '85vh';
    pane.style.overflow = 'auto';
    pane.style.padding = '24px';
    document.body.appendChild(pane);
  }
  return pane;
};

window.toggleFixturesPane = function(show){
  try {
    const pane = ensureFixturesPane();
    if (!pane) {
      console.error('Fixtures pane could not be created');
      return;
    }
    if (show) {
      if (!S) {
        if (typeof init === 'function') {
          init();
        }
      }
      if (typeof window.renderFixturesPanel === 'function') {
        window.renderFixturesPanel();
        pane.style.display = 'block';
      } else {
        console.error('renderFixturesPanel function not found');
      }
    } else {
      pane.style.display = 'none';
    }
  } catch (error) {
    console.error('Error in toggleFixturesPane:', error);
  }
};

window.renderFixturesPanel = function(){
  try {
    const pane = ensureFixturesPane();
    if (!pane) {
      console.error('Fixtures pane not available');
      return;
    }
    pane.innerHTML = '';
    
    const title = document.createElement('h2');
    title.textContent = '📅 Fixtures & Tables';
    title.style.marginTop = '0';
    title.style.marginBottom = '20px';
    pane.appendChild(title);
    
    // Tabs for different views
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.gap = '8px';
    tabsContainer.style.marginBottom = '20px';
    tabsContainer.style.borderBottom = '2px solid var(--line)';
    
    const fixturesTab = document.createElement('button');
    fixturesTab.textContent = 'Upcoming Fixtures';
    fixturesTab.className = 'tab-btn active';
    fixturesTab.addEventListener('click', () => {
      try {
        if (typeof showFixturesView === 'function') {
          showFixturesView(pane);
        } else {
          console.error('showFixturesView function not found');
        }
      } catch (error) {
        console.error('Error in showFixturesView:', error);
      }
    });
    
    const leagueTableTab = document.createElement('button');
    leagueTableTab.textContent = 'League Table';
    leagueTableTab.className = 'tab-btn';
    leagueTableTab.addEventListener('click', () => {
      try {
        if (typeof showLeagueTableView === 'function') {
          showLeagueTableView(pane);
        } else {
          console.error('showLeagueTableView function not found');
        }
      } catch (error) {
        console.error('Error in showLeagueTableView:', error);
      }
    });
    
    const clTableTab = document.createElement('button');
    clTableTab.textContent = 'Champions League';
    clTableTab.className = 'tab-btn';
    clTableTab.addEventListener('click', () => {
      try {
        if (typeof showChampionsLeagueView === 'function') {
          showChampionsLeagueView(pane);
        } else {
          console.error('showChampionsLeagueView function not found');
        }
      } catch (error) {
        console.error('Error in showChampionsLeagueView:', error);
      }
    });
    
    tabsContainer.appendChild(fixturesTab);
    tabsContainer.appendChild(leagueTableTab);
    tabsContainer.appendChild(clTableTab);
    pane.appendChild(tabsContainer);
    
    const content = document.createElement('div');
    content.id = 'fixturesContent';
    pane.appendChild(content);
    
    // Add tab button styles
    if (!document.getElementById('fixturesTabStyles')) {
      const style = document.createElement('style');
      style.id = 'fixturesTabStyles';
      style.textContent = `
        .tab-btn {
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
          margin-bottom: -2px;
        }
        .tab-btn:hover {
          color: var(--text);
          background: rgba(255, 255, 255, 0.05);
        }
        .tab-btn.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
      `;
      document.head.appendChild(style);
    }
    
    // Show fixtures view by default
    if (typeof showFixturesView === 'function') {
      showFixturesView(pane);
    } else {
      console.error('showFixturesView function not found');
      const errorMsg = document.createElement('div');
      errorMsg.textContent = 'Error loading fixtures view. Please refresh the page.';
      errorMsg.style.color = 'var(--error)';
      content.appendChild(errorMsg);
    }
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '20px';
    closeBtn.style.padding = '10px 20px';
    closeBtn.style.width = '100%';
    closeBtn.addEventListener('click', () => {
      if (typeof window.toggleFixturesPane === 'function') {
        window.toggleFixturesPane(false);
      }
    });
    pane.appendChild(closeBtn);
  } catch (error) {
    console.error('Error in renderFixturesPanel:', error);
    const pane = ensureFixturesPane();
    if (pane) {
      pane.innerHTML = '<div style="color: var(--error); padding: 20px;">Error loading fixtures panel: ' + error.message + '</div>';
    }
  }
};

window.showFixturesView = function showFixturesView(pane) {
  const content = document.getElementById('fixturesContent');
  if (!content) return;
  
  content.innerHTML = '';
  
  // Update tab states
  const tabs = pane.querySelectorAll('.tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  tabs[0].classList.add('active');
  
  ensureSeasonScheduleAndTable();
  
  // League fixtures
  const leagueSection = document.createElement('div');
  leagueSection.style.marginBottom = '30px';
  
  const leagueTitle = document.createElement('h3');
  leagueTitle.textContent = '⚽ League Fixtures';
  leagueTitle.style.marginBottom = '12px';
  leagueTitle.style.color = 'var(--accent)';
  leagueSection.appendChild(leagueTitle);
  
  if (S.opponents && S.opponents.length > 0) {
    const matchesPlayed = S.matches_played || 0;
    const upcomingFixtures = [];
    
    for (let i = matchesPlayed; i < Math.min(matchesPlayed + 5, S.opponents.length); i++) {
      if (i < S.opponents.length) {
        const opp = S.opponents[i];
        const isHome = (i % 2 === 0);
        upcomingFixtures.push({
          matchday: i + 1,
          opponent: opp,
          home: isHome
        });
      }
    }
    
    if (upcomingFixtures.length > 0) {
      const fixturesList = document.createElement('div');
      fixturesList.style.display = 'flex';
      fixturesList.style.flexDirection = 'column';
      fixturesList.style.gap = '8px';
      
      upcomingFixtures.forEach(fixture => {
        const fixtureDiv = document.createElement('div');
        fixtureDiv.style.padding = '12px';
        fixtureDiv.style.background = 'rgba(255, 255, 255, 0.05)';
        fixtureDiv.style.borderRadius = '8px';
        fixtureDiv.style.border = '1px solid var(--line)';
        
        const matchInfo = document.createElement('div');
        matchInfo.style.display = 'flex';
        matchInfo.style.justifyContent = 'space-between';
        matchInfo.style.alignItems = 'center';
        
        const matchText = document.createElement('span');
        const clubName = getClubName();
        matchText.innerHTML = `<strong>Matchday ${fixture.matchday}:</strong> ${fixture.home ? `<strong>${clubName}</strong>` : fixture.opponent} vs ${fixture.home ? fixture.opponent : `<strong>${clubName}</strong>`}`;
        matchInfo.appendChild(matchText);
        
        const venue = document.createElement('span');
        venue.textContent = fixture.home ? '🏠 Home' : '✈️ Away';
        venue.style.color = 'var(--muted)';
        venue.style.fontSize = '0.85rem';
        matchInfo.appendChild(venue);
        
        fixtureDiv.appendChild(matchInfo);
        fixturesList.appendChild(fixtureDiv);
      });
      
      leagueSection.appendChild(fixturesList);
    } else {
      const noFixtures = document.createElement('div');
      noFixtures.textContent = 'No upcoming league fixtures.';
      noFixtures.style.color = 'var(--muted)';
      leagueSection.appendChild(noFixtures);
    }
  } else {
    const noFixtures = document.createElement('div');
    noFixtures.textContent = 'No league fixtures scheduled yet.';
    noFixtures.style.color = 'var(--muted)';
    leagueSection.appendChild(noFixtures);
  }
  
  content.appendChild(leagueSection);
  
  // Champions League fixtures (if qualified)
  if (S.qual_CL || S.clChampion || S.clActive) {
    const clSection = document.createElement('div');
    clSection.style.marginBottom = '30px';
    clSection.style.padding = '16px';
    clSection.style.background = 'rgba(99, 102, 241, 0.1)';
    clSection.style.borderRadius = '8px';
    clSection.style.border = '2px solid var(--accent)';
    
    const clTitle = document.createElement('h3');
    clTitle.textContent = '🇪🇺 Champions League Fixtures';
    clTitle.style.marginBottom = '12px';
    clTitle.style.color = 'var(--accent)';
    clSection.appendChild(clTitle);
    
    if (S.clActive) {
      if (S.clGroup && S.clGroupStandings) {
        const groupInfo = document.createElement('div');
        groupInfo.style.marginBottom = '12px';
        groupInfo.innerHTML = `<strong>Group ${S.clGroup}</strong>`;
        clSection.appendChild(groupInfo);
        
        // Show scheduled matches
        if (S.clScheduledMatches && S.clScheduledMatches.length > 0) {
          const clFixtures = document.createElement('div');
          clFixtures.style.display = 'flex';
          clFixtures.style.flexDirection = 'column';
          clFixtures.style.gap = '8px';
          
          S.clScheduledMatches.forEach(match => {
            if (!match.played) {
              const matchDiv = document.createElement('div');
              matchDiv.style.padding = '10px';
              matchDiv.style.background = 'rgba(255, 255, 255, 0.05)';
              matchDiv.style.borderRadius = '6px';
              matchDiv.innerHTML = `<strong>${getClubName()}</strong> vs ${match.opponent}`;
              clFixtures.appendChild(matchDiv);
            }
          });
          
          if (clFixtures.children.length === 0) {
            const noMore = document.createElement('div');
            noMore.textContent = 'All group matches completed.';
            noMore.style.color = 'var(--muted)';
            clSection.appendChild(noMore);
          } else {
            clSection.appendChild(clFixtures);
          }
        }
      } else if (S.clKnockoutRound) {
        const knockoutInfo = document.createElement('div');
        knockoutInfo.innerHTML = `<strong>${S.clKnockoutRound}</strong> - Check Champions League tab for bracket.`;
        clSection.appendChild(knockoutInfo);
      }
    } else {
      const notStarted = document.createElement('div');
      notStarted.textContent = 'Champions League not yet started this season.';
      notStarted.style.color = 'var(--muted)';
      clSection.appendChild(notStarted);
    }
    
    content.appendChild(clSection);
  }
  
  // World Cup fixtures (if active)
  if (S.worldCupActive) {
    const wcSection = document.createElement('div');
    wcSection.style.marginBottom = '30px';
    wcSection.style.padding = '16px';
    wcSection.style.background = 'rgba(0, 245, 255, 0.1)';
    wcSection.style.borderRadius = '8px';
    wcSection.style.border = '2px solid var(--neon-cyan)';
    
    const wcTitle = document.createElement('h3');
    wcTitle.textContent = '🌍 World Cup Fixtures';
    wcTitle.style.marginBottom = '12px';
    wcTitle.style.color = 'var(--neon-cyan)';
    wcSection.appendChild(wcTitle);
    
    if (S.worldCupGroup && S.worldCupGroupStandings) {
      const groupInfo = document.createElement('div');
      groupInfo.style.marginBottom = '12px';
      groupInfo.innerHTML = `<strong>Group ${S.worldCupGroup}</strong>`;
      wcSection.appendChild(groupInfo);
      
      // Show scheduled matches
      if (S.worldCupScheduledMatches && S.worldCupScheduledMatches.length > 0) {
        const wcFixtures = document.createElement('div');
        wcFixtures.style.display = 'flex';
        wcFixtures.style.flexDirection = 'column';
        wcFixtures.style.gap = '8px';
        
        S.worldCupScheduledMatches.forEach(match => {
          if (!match.played) {
            const matchDiv = document.createElement('div');
            matchDiv.style.padding = '10px';
            matchDiv.style.background = 'rgba(255, 255, 255, 0.05)';
            matchDiv.style.borderRadius = '6px';
            matchDiv.innerHTML = `<strong>${getClubName()}</strong> vs ${match.opponent}`;
            wcFixtures.appendChild(matchDiv);
          }
        });
        
        if (wcFixtures.children.length === 0) {
          const noMore = document.createElement('div');
          noMore.textContent = 'All group matches completed.';
          noMore.style.color = 'var(--muted)';
          wcSection.appendChild(noMore);
        } else {
          wcSection.appendChild(wcFixtures);
        }
      }
    } else if (S.worldCupKnockoutRound) {
      const knockoutInfo = document.createElement('div');
      knockoutInfo.innerHTML = `<strong>${S.worldCupKnockoutRound}</strong> - Check bracket for upcoming matches.`;
      wcSection.appendChild(knockoutInfo);
    }
    
    content.appendChild(wcSection);
  }
};

window.showLeagueTableView = function showLeagueTableView(pane) {
  const content = document.getElementById('fixturesContent');
  if (!content) return;
  
  content.innerHTML = '';
  
  const tabs = pane.querySelectorAll('.tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  tabs[1].classList.add('active');
  
  ensureLeagueTableInit();
  
  const title = document.createElement('h3');
  title.textContent = '⚽ League Table';
  title.style.marginBottom = '16px';
  content.appendChild(title);
  
  if (S.table && Object.keys(S.table).length > 0) {
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.9rem';
    
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS'].forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      th.style.padding = '8px';
      th.style.textAlign = col === 'Team' ? 'left' : 'center';
      th.style.borderBottom = '2px solid var(--line)';
      headerRow.appendChild(th);
    });
    header.appendChild(headerRow);
    table.appendChild(header);
    
    const tbody = document.createElement('tbody');
    
    // For season 4 & 5, filter to only show valid teams (opponents + Southampton)
    // Exclude old team names that have been taken over
    const destroyed = S.destroyedTeams || [];
    const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
    let validTeams = null;
    
    if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
      // Only show teams that are in opponents list (with their current names) plus Southampton
      const clubName = getClubName() || (S.club_name || 'Southampton FC');
      validTeams = new Set([clubName, ...S.opponents]);
      // CRITICAL: Also include teams that were taken over (their new names)
      // This ensures all valid teams are included even if S.opponents hasn't been fully updated
      if (S.season4 && S.season4.clubs_taken_over) {
        Object.values(S.season4.clubs_taken_over).forEach(newName => validTeams.add(newName));
      }
    }
    
    const standings = Object.entries(S.table)
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
      .map(([team, data]) => {
        const isSouthampton = team === getClubName() || team === (S.club_name || 'Southampton FC');
        // For Southampton, calculate effective points (PTS - points_deducted)
        const effectivePTS = isSouthampton ? (data.PTS || 0) - (S.points_deducted || 0) : (data.PTS || 0);
        return {
          team, ...data, effectivePTS
        };
      });
    
    
    standings.sort((a, b) => {
        // Sort by effective points for Southampton, raw points for others
        const aPTS = a.effectivePTS;
        const bPTS = b.effectivePTS;
        if (bPTS !== aPTS) return bPTS - aPTS;
        if (b.GD !== a.GD) return b.GD - a.GD;
        return b.GF - a.GF;
      });
    
    standings.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const isSouthampton = entry.team === getClubName() || entry.team === (S.club_name || 'Southampton FC');
      
      if (isSouthampton) {
        row.style.background = 'rgba(99, 102, 241, 0.2)';
        row.style.fontWeight = '600';
      }
      
      // For Southampton, show effective points; for others, show raw points
      const displayPTS = isSouthampton ? entry.effectivePTS : (entry.PTS || 0);
      [idx + 1, entry.team, entry.P || 0, entry.W || 0, entry.D || 0, entry.L || 0, 
       entry.GF || 0, entry.GA || 0, entry.GD || 0, displayPTS].forEach((val, i) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.padding = '8px';
        td.style.textAlign = i === 1 ? 'left' : 'center';
        td.style.borderBottom = '1px solid var(--line)';
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    content.appendChild(table);
  } else {
    const noTable = document.createElement('div');
    noTable.textContent = 'League table not yet initialized.';
    noTable.style.color = 'var(--muted)';
    content.appendChild(noTable);
  }
};

window.showChampionsLeagueView = function showChampionsLeagueView(pane) {
  const content = document.getElementById('fixturesContent');
  if (!content) return;
  
  content.innerHTML = '';
  
  const tabs = pane.querySelectorAll('.tab-btn');
  tabs.forEach(tab => tab.classList.remove('active'));
  tabs[2].classList.add('active');
  
  const title = document.createElement('h3');
  title.textContent = '🇪🇺 Champions League';
  title.style.marginBottom = '16px';
  content.appendChild(title);
  
  // Generate or retrieve all CL groups for full table view
  function generateAllCLGroups() {
    if (!S.clAllGroups) {
      // Generate all 8 groups
      const euroTeams = generateEuroTeams();
      const allGroups = {};
      const usedTeams = new Set();
      
      // If our club is in CL, ensure they're in a group
      const ourClubInCL = S.clActive && S.clGroup;
      const clubName = getClubName();
      if (ourClubInCL) {
        usedTeams.add(clubName);
      }
      
      // Create 8 groups
      for (let g = 1; g <= 8; g++) {
        const groupTeams = [];
        
        // If this is our club's group and they're in CL, add them
        if (ourClubInCL && S.clGroup === g) {
          groupTeams.push(clubName);
        } else if (!ourClubInCL && g === 1) {
          // If not in CL, add our club to group 1 for reference (but mark as not participating)
          groupTeams.push(`${clubName} (Not Qualified)`);
        }
        
        // Fill remaining spots (3 more teams per group)
        while (groupTeams.length < 4) {
          const available = euroTeams.filter(t => !usedTeams.has(t));
          if (available.length === 0) break;
          const randomTeam = available[Math.floor(Math.random() * available.length)];
          groupTeams.push(randomTeam);
          usedTeams.add(randomTeam);
        }
        
        // Initialize standings for this group
        allGroups[g] = {};
        groupTeams.forEach(team => {
          allGroups[g][team] = {
            P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0
          };
        });
      }
      
      S.clAllGroups = allGroups;
    }
    
    // If we have actual standings from our group, use those
    if (S.clActive && S.clGroup && S.clGroupStandings) {
      S.clAllGroups[S.clGroup] = S.clGroupStandings;
    }
    
    return S.clAllGroups;
  }
  
  const allGroups = generateAllCLGroups();
  
  // Show all groups
  for (let g = 1; g <= 8; g++) {
    const groupDiv = document.createElement('div');
    groupDiv.style.marginBottom = '24px';
    groupDiv.style.padding = '16px';
    groupDiv.style.background = 'rgba(255, 255, 255, 0.03)';
    groupDiv.style.borderRadius = '8px';
    groupDiv.style.border = '1px solid var(--line)';
    
    // Highlight Southampton's group if they're in CL
    if (S.clActive && S.clGroup === g) {
      groupDiv.style.border = '2px solid var(--accent)';
      groupDiv.style.background = 'rgba(99, 102, 241, 0.15)';
    }
    
    const groupTitle = document.createElement('h4');
    groupTitle.textContent = `Group ${g}${S.clActive && S.clGroup === g ? ' (Your Group)' : ''}`;
    groupTitle.style.marginBottom = '12px';
    groupTitle.style.color = S.clActive && S.clGroup === g ? 'var(--accent)' : 'var(--text)';
    groupDiv.appendChild(groupTitle);
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.85rem';
    
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS'].forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      th.style.padding = '6px';
      th.style.textAlign = col === 'Team' ? 'left' : 'center';
      th.style.borderBottom = '1px solid var(--line)';
      th.style.fontSize = '0.8rem';
      headerRow.appendChild(th);
    });
    header.appendChild(headerRow);
    table.appendChild(header);
    
    const tbody = document.createElement('tbody');
    const standings = Object.entries(allGroups[g] || {}).map(([team, data]) => ({
      team, ...data
    })).sort((a, b) => {
      if (b.PTS !== a.PTS) return b.PTS - a.PTS;
      if (b.GD !== a.GD) return b.GD - a.GD;
      return b.GF - a.GF;
    });
    
    standings.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const isSouthampton = entry.team === getClubName() || entry.team === (S.club_name || 'Southampton FC');
      
      if (isSouthampton) {
        row.style.background = 'rgba(99, 102, 241, 0.2)';
        row.style.fontWeight = '600';
      }
      
      [idx + 1, entry.team, entry.P || 0, entry.W || 0, entry.D || 0, entry.L || 0, 
       entry.GF || 0, entry.GA || 0, entry.GD || 0, entry.PTS || 0].forEach((val, i) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.padding = '6px';
        td.style.textAlign = i === 1 ? 'left' : 'center';
        td.style.borderBottom = '1px solid var(--line)';
        td.style.fontSize = '0.8rem';
        row.appendChild(td);
      });
      
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    groupDiv.appendChild(table);
    content.appendChild(groupDiv);
  }
  
  // Show knockout bracket if in knockout stage
  if (S.clKnockoutRound) {
    const knockoutTitle = document.createElement('h4');
    knockoutTitle.textContent = S.clKnockoutRound;
    knockoutTitle.style.marginTop = '24px';
    knockoutTitle.style.marginBottom = '12px';
    knockoutTitle.style.color = 'var(--accent)';
    content.appendChild(knockoutTitle);
    
    if (S.clKnockoutBracket) {
      const bracketInfo = document.createElement('div');
      bracketInfo.style.padding = '12px';
      bracketInfo.style.background = 'rgba(255, 255, 255, 0.05)';
      bracketInfo.style.borderRadius = '8px';
      bracketInfo.innerHTML = 'Knockout bracket information will be displayed here.';
      content.appendChild(bracketInfo);
    }
  }
  
  // Add note if not in CL
  if (!S.clActive && !S.qual_CL && !S.clChampion) {
    const info = document.createElement('div');
    info.style.padding = '12px';
    info.style.marginTop = '16px';
    info.style.background = 'rgba(99, 102, 241, 0.1)';
    info.style.borderRadius = '8px';
    info.style.border = '1px solid var(--accent)';
    info.style.fontSize = '0.9rem';
    info.innerHTML = '<p><strong>Note:</strong> You are not currently participating in the Champions League. This table shows the full competition for immersion purposes.</p>';
    content.appendChild(info);
  }
};

function completeStadiumProject() {
  const stadium = S.stadium;
  const project = stadium.active_project;
  
  // Deduct base construction cost from club funds (unless it was embezzled)
  if (project.honest !== false) {
    // Honest or split builds - deduct from club cash
    const baseCost = project.cost || 0;
    if (S.club_cash >= baseCost) {
      S.club_cash -= baseCost;
      log(`💰 Construction cost deducted: ${money(baseCost)} from club funds.`);
    } else {
      // Can't afford base cost - add to debt
      const shortfall = baseCost - (S.club_cash || 0);
      S.club_cash = 0;
      S.club_debt = (S.club_debt || 0) + shortfall;
      log(`⚠️ Insufficient funds for construction cost. ${money(shortfall)} added to club debt!`);
    }
  }
  // Embezzled builds don't deduct anything (money was already siphoned)
  
  // Apply cost overrun (occasionally)
  let finalCost = project.cost;
  if (Math.random() < 0.2) { // 20% chance of overrun
    const overrunPercent = Math.floor(Math.random() * 10) + 5; // 5-15%
    stadium.construction_overrun = overrunPercent;
    finalCost = Math.floor(project.cost * (1 + overrunPercent / 100));
    
    // Deduct overrun cost
    const overrunAmount = finalCost - project.cost;
    if (S.club_cash >= overrunAmount) {
      S.club_cash -= overrunAmount;
    } else {
      // Can't afford overrun - add to debt
      const overrunShortfall = overrunAmount - (S.club_cash || 0);
      S.club_cash = 0;
      S.club_debt = (S.club_debt || 0) + overrunShortfall;
      log(`⚠️ Cost overrun of ${money(overrunAmount)} added to club debt!`);
    }
    
    log(`💰 ${project.name || 'Stadium project'} completed with ${overrunPercent}% cost overrun! Final cost: £${finalCost.toLocaleString()}`);
  } else {
    log(`🏟️ ${project.name || 'Stadium project'} completed on time and on budget!`);
  }
  
  // Apply stadium improvements
  const oldCapacity = stadium.capacity;
  const oldQuality = stadium.quality;
  const oldUpkeep = stadium.upkeep_per_match;
  
  // Update capacity
  if (typeof project.capacity_gain === 'object') {
    stadium.capacity += project.capacity_gain;
  } else {
    stadium.capacity = project.capacity_gain; // World-class sets to 100k
  }
  
  // Update quality
  stadium.quality = Math.min(100, stadium.quality + project.quality_gain);
  
  // Update upkeep
  const currentUpkeep = stadium.upkeep_per_match || 5000; // Default to 5000 if undefined
  const upkeepMultiplier = project.upkeep_multiplier || 1.0; // Default to 1.0 if undefined
  stadium.upkeep_per_match = Math.floor(currentUpkeep * upkeepMultiplier);
  
  // Ensure upkeep is a valid number (not NaN)
  if (isNaN(stadium.upkeep_per_match) || stadium.upkeep_per_match <= 0) {
    stadium.upkeep_per_match = currentUpkeep; // Fallback to previous value
    console.warn('Stadium upkeep calculation resulted in invalid value, using previous upkeep');
  }
  
  // Clear project
  stadium.active_project = null;
  stadium.construction_progress = 0;
  stadium.construction_delays = 0;
  stadium.construction_overrun = 0;
  
  // Check for collapse risk (St Mary's 2 only)
  if (project.type === 'st_marys_2' && project.collapse_risk && Math.random() < project.collapse_risk) {
    // Stadium collapses immediately after completion
    log(`💥 CATASTROPHE: The new stadium collapses mid-game!`);
    log(`🏗️ Shoddy construction fails spectacularly!`);
    log(`📉 Fan morale -40%, Reputation -30%`);
    log(`⚖️ Legal risk +20, FA risk +25`);
    log(`💸 Sponsors flee: "Everyone is sick of this happening to Southampton."`);
    log(`🏠 Forced back to Eastleigh F.C.`);
    
    // Apply consequences
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 40);
    S.reputation = Math.max(0, (S.reputation || 50) - 30);
    S.legal_risk = (S.legal_risk || 0) + 20;
    S.fa_risk = (S.fa_risk || 0) + 25;
    
    // Revert to Eastleigh
    S.stadium.relocated_to_eastleigh = true;
    S.stadium.capacity = 5000;
    S.stadium.quality = 20;
    S.stadium.upkeep_per_match = 1500;
    
    // Clear project
    stadium.active_project = null;
    stadium.construction_progress = 0;
    stadium.construction_delays = 0;
    stadium.construction_overrun = 0;
    
    return; // Exit early, don't apply normal completion
  }
  
  // Log completion
  log(`🎉 Stadium upgrade complete!`);
  log(`📊 Capacity: ${oldCapacity.toLocaleString()} → ${stadium.capacity.toLocaleString()} (+${(stadium.capacity - oldCapacity).toLocaleString()})`);
  log(`⭐ Quality: ${oldQuality} → ${stadium.quality} (+${stadium.quality - oldQuality})`);
  const newUpkeepDisplay = (stadium.upkeep_per_match && !isNaN(stadium.upkeep_per_match)) ? stadium.upkeep_per_match : oldUpkeep;
  log(`💰 Upkeep: £${oldUpkeep.toLocaleString()} → £${newUpkeepDisplay.toLocaleString()}/match`);
  
  // Check for insolvency risk
  checkStadiumInsolvency();
  
  updateHUD();
}

function checkProjectCompletion() {
  const stadium = S.stadium;
  if (!stadium.active_project) return;
  
  const project = stadium.active_project;
  const totalDuration = project.duration + stadium.construction_delays;
  
  if (stadium.construction_progress >= totalDuration) {
    completeStadiumProject();
  }
}

function checkStadiumInsolvency() {
  const stadium = S.stadium;
  const totalUpkeep = (stadium.upkeep_per_match && !isNaN(stadium.upkeep_per_match)) ? stadium.upkeep_per_match : 5000;
  
  if (S.club_cash < totalUpkeep * 3) { // Less than 3 matches of expenses
    log(`⚠️ Warning: Club finances are tight. Stadium upkeep: £${totalUpkeep.toLocaleString()}/match`);
    
    // Apply small morale hit and board heat
    S.fan_morale = Math.max(0, (S.fan_morale || 50) - 2);
    S.fa_risk = Math.min(100, (S.fa_risk || 0) + 5);
    
    log("📉 Fan morale -2% due to financial concerns");
    log("📋 Board/FA heat +5% due to financial instability");
  }
}

// Process home match revenue and stadium costs
window.processHomeMatchRevenue = function() {
  // Add null checks to prevent errors
  if (!S || !S.stadium) {
    console.warn('S or S.stadium is not initialized, skipping home match revenue processing');
    return;
  }
  
  const stadium = S.stadium;
  
  // Check if relocated to Eastleigh
  if (stadium.relocated_to_eastleigh) {
    processEastleighMatchRevenue();
    return;
  }
  
  // Calculate attendance using the stadium system
  const projection = calculateAttendanceProjection();
  const attendance = projection.attendance;
  const revenue = projection.revenue;
  
  // Update stadium stats
  stadium.last_home_attendance = attendance;
  stadium.utilization_percent = projection.utilization;
  
  // Add revenue to club cash
  if (typeof addMoneyClub === 'function') {
    addMoneyClub(revenue);
  } else {
    S.club_cash = (S.club_cash || 0) + revenue;
  }
  
  
  
  // Process stadium upkeep
  // Ensure upkeep is a valid number
  const upkeepAmount = (stadium.upkeep_per_match && !isNaN(stadium.upkeep_per_match)) ? stadium.upkeep_per_match : 5000;
  S.club_cash = Math.max(0, (S.club_cash || 0) - upkeepAmount);
  
  // Log the results
  log(`🏟️ Attendance: ${attendance.toLocaleString()} (${projection.utilization.toFixed(1)}% capacity)`);
  log(`💰 Matchday Revenue: £${revenue.toLocaleString()}`);
  log(`🔧 Stadium Upkeep: -£${upkeepAmount.toLocaleString()}`);
  
  
  
  // Check for insolvency after processing
  checkStadiumInsolvency();
}

// Process revenue for Eastleigh matches
function processEastleighMatchRevenue() {
  const stadium = S.stadium;
  const fanMorale = S.fan_morale || 50;
  
  // Eastleigh has tiny capacity and reduced ticket prices
  const eastleighCapacity = stadium.eastleigh_capacity || 5000;
  const eastleighTicketPrice = stadium.eastleigh_ticket_price || 15;
  
  // Calculate attendance (much lower due to tiny capacity)
  let attendance = Math.round((fanMorale / 100) * eastleighCapacity);
  
  // Apply construction penalty if building new stadium
  if (stadium.active_project) {
    attendance = Math.round(attendance * 0.9); // 10% reduction during construction
  }
  
  const revenue = attendance * eastleighTicketPrice;
  
  // Update stadium stats
  stadium.last_home_attendance = attendance;
  stadium.utilization_percent = (attendance / eastleighCapacity) * 100;
  
  // Add revenue to club cash
  if (typeof addMoneyClub === 'function') {
    addMoneyClub(revenue);
  } else {
    S.club_cash = (S.club_cash || 0) + revenue;
  }
  
  // Reduced upkeep at Eastleigh
  const eastleighUpkeep = Math.round(stadium.upkeep_per_match * 0.3); // 30% of normal upkeep
  S.club_cash = Math.max(0, (S.club_cash || 0) - eastleighUpkeep);
  
  // Log the results
  log(`🏟️ Attendance: ${attendance.toLocaleString()} (Eastleigh F.C. - ${stadium.utilization_percent.toFixed(1)}% capacity)`);
  log(`💰 Matchday Revenue: £${revenue.toLocaleString()}`);
  log(`🔧 Stadium Upkeep: -£${eastleighUpkeep.toLocaleString()}`);
  
  // Check for insolvency after processing
  checkStadiumInsolvency();
}




  // Unified overdose function - REMOVED: Using safer patch version instead
  // The patch version at line 9354 is safer and handles errors better


  // Public helpers to add loot cleanly from events
  window.addAccoladeToInventory = function(name, value){
    ensureInv();
    S.inventory.accolades.push({ name:String(name||'Trophy'), value: Number(value||0) });
    renderInventory();
  };
  window.addDrugsToInventory = function(qty){
    ensureInv();
    const oldCount = S.inventory.drugs|0;
    S.inventory.drugs = Math.max(0, (S.inventory.drugs|0) + Math.max(0, qty|0));
    
    // If cocaine was added and stadium dealing isn't unlocked yet, unlock it
    if (qty > 0 && oldCount === 0 && !S.stadium_dealing_unlocked) {
      S.stadium_dealing_unlocked = true;
      S.cocaine_purchase_matches_ago = 0; // Track when cocaine was first purchased
      S.marco_approach_attempted = false;
    }
    
    renderInventory();
  };

  // New inventory system helpers
  window.getItemByName = function(name) {
    ensureInv();
    return S.inventory.items.find(item => item.name === name);
  };

  window.addItem = function(partial, qty = 1) {
    ensureInv();
    const existingItem = S.inventory.items.find(item => item.name === partial.name);
    
    if (existingItem) {
      existingItem.quantity = (existingItem.quantity || 1) + qty;
    } else {
      S.inventory.items.push({
        id: partial.name.toLowerCase().replace(/\s+/g, '_'),
        name: partial.name,
        type: partial.type || 'misc',
        quantity: qty,
        baseValue: partial.baseValue || 0,
        sellable: partial.sellable !== false,
        equipped: partial.equipped || false,
        meta: partial.meta || {}
      });
    }
    if (typeof renderInventory === 'function') {
      renderInventory();
    }
  };

  window.removeItem = function(name, qty = 1) {
    ensureInv();
    const itemIndex = S.inventory.items.findIndex(item => item.name === name);
    if (itemIndex === -1) return;
    
    const item = S.inventory.items[itemIndex];
    item.quantity = Math.max(0, (item.quantity || 1) - qty);
    
    if (item.quantity <= 0) {
      S.inventory.items.splice(itemIndex, 1);
    }
    if (typeof renderInventory === 'function') {
      renderInventory();
    }
  };

// Add Brick item to inventory
window.addBrickToInventory = function() {
  addItem({
    name: 'Brick',
    type: 'weapon',
    baseValue: 0,
    sellable: false,
    equipped: false,
    meta: {
      description: 'A heavy brick for throwing at targets',
      arrestRisk: 'High',
      effects: 'Morale and quality changes, potential arrest'
    }
  }, 1);
  log('Brick added to inventory. Equip it to use brick throwing options.');
};

window.sellItem = function(name, qty = 1) {
    ensureInv();
    const item = S.inventory.items.find(item => item.name === name);
    if (!item || !item.sellable) return 0;
    
    const sellQty = Math.min(qty, item.quantity || 1);
    const totalValue = sellQty * (item.baseValue || 0);
    
    S.chairman_cash = (S.chairman_cash || 0) + totalValue;
    removeItem(name, sellQty);
    
    log(`You sold ${sellQty}x "${name}" for £${totalValue.toLocaleString('en-GB')}.`);
    updateHUD?.();
    
    return totalValue;
  };

  // Add Brick to inventory (for testing or special events)
  window.addBrickToInventory = function() {
    addItem({
      name: "Brick",
      type: "weapon",
      description: "A heavy brick. Perfect for throwing at people.",
      value: 0,
      sellable: false,
      equipable: true
    }, 1);
    log("You now have a Brick in your inventory. Equip it to unlock brick throwing options.");
  };

  // Debug: Log that the invective system is loaded

  window.equipItem = function(name) {
    ensureInv();
    const item = S.inventory.items.find(item => item.name === name);
    if (!item) return;
    
    // Unequip any other equipped items of the same type
    S.inventory.items.forEach(otherItem => {
      if (otherItem.type === item.type && otherItem.name !== name) {
        otherItem.equipped = false;
      }
    });
    
    item.equipped = true;
    renderInventory();
  };

  window.unequipItem = function(name) {
    ensureInv();
    const item = S.inventory.items.find(item => item.name === name);
    if (!item) return;
    
    item.equipped = false;
    renderInventory();
  };

  // expose in case something else wants to toggle explicitly
  window.toggleInventoryPane = toggleInventoryPane;

})();




// Refresh the inventory pane after a sale/use (the old separate inventory modal is gone)
function refreshInventoryView(){
  if (typeof renderInventory === 'function') renderInventory();
}

async function sellAccolade(idx){
  if (!S.inventory || !Array.isArray(S.inventory.accolades)) return;
  const item = S.inventory.accolades[idx];
  if (!item) return;
  
  // Check if season 4-5 and if this is a major trophy that can be traded for points
  const isSeason4or5 = (S.season === 4 || S.season === 5);
  const trophyName = item.name || '';
  const isPremierLeague = trophyName.includes('Premier League');
  const isChampionsLeague = trophyName.includes('Champions League');
  const isWorldCup = trophyName.includes('World Cup');
  const isMajorTrophy = isPremierLeague || isChampionsLeague || isWorldCup;
  
  if (isSeason4or5 && isMajorTrophy) {
    // Offer choice: sell for money or trade for points
    const pointsValue = isPremierLeague ? 4 : (isChampionsLeague ? 5 : 7);
    const val = Number(item.value||0);
    
    const choice = await choose([
      {key: 'money', label: `Sell for ${money(val)}`},
      {key: 'points', label: `Trade to Saudis for ${pointsValue} points`}
    ], `What would you like to do with "${trophyName}"?`);
    
    if (choice === 'points') {
      // Trade for points
      S.points = (S.points || 0) + pointsValue;
      S.inventory.accolades.splice(idx, 1);
      log(`You trade "${trophyName}" to the Saudis for ${pointsValue} league points.`);
      log(`[GAME LOG] The Saudis want to accumulate silverware. They're paying handsomely in league points.`);
      updateHUD?.();
      refreshInventoryView();
      return;
    }
  }
  
  // Default: sell for money
  const val = Number(item.value||0);
  // Chairman takes the sale proceeds
  S.chairman_cash = (S.chairman_cash||0) + Math.max(0,val);
  // remove from inventory
  S.inventory.accolades.splice(idx,1);
  log(`You fence "${item.name}" for £${val.toLocaleString('en-GB')}.`);
  updateHUD?.();
  // re-open to refresh list (or update DOM surgically)
  refreshInventoryView();
}

// Simple stub for “taking” a drug; full effects will come in the drug patch
function takeOneDrug(){
  if (!S.inventory) return;
  if ((S.inventory.drugs|0) <= 0){
    log("You pat your pockets. Nothing left.");
    return;
  }
  S.inventory.drugs = Math.max(0, (S.inventory.drugs|0) - 1);
  S.on_drugs_today = true; // a flag we'll use in your later patch
  log("You take a discreet bump. The world sharpens unpleasantly.");
  // optional: tiny immediate mood tweak; keep subtle for now
  S.team_morale_boost = (S.team_morale_boost||0) + 1;
  // Add chairman points for taking drugs
  if (typeof addChairmanPointsImmediate === 'function') {
    addChairmanPointsImmediate(5, 'taking drugs');
  }
  updateHUD?.();
  refreshInventoryView();
}



// Normalize games played across all teams to ensure consistency
function normalizeGamesPlayed() {
  if (!S.table || Object.keys(S.table).length === 0) return;
  if (S.season !== 4 && S.season !== 5) return;
  
  const matchesPlayed = S.matches_played || 0;
  const clubName = teamKeyClub();
  
  // Get the target number of games (should match matches_played for all teams)
  // Use Southampton's games played as reference, or matches_played
  const targetGames = S.table[clubName] ? S.table[clubName].P : matchesPlayed;
  
  // Ensure all teams have the same number of games played
  for (const teamName of Object.keys(S.table)) {
    const teamData = S.table[teamName];
    if (teamData && teamData.P !== targetGames) {
      // If games played is less than target, it's likely a new team that inherited a record
      // Keep the inherited record but ensure P matches target
      teamData.P = targetGames;
    }
  }
}

// Top Scorers System
function ensureTopScorersInit(){
  if (!S.topScorers) S.topScorers = {};
  if (!S.matchEvents) S.matchEvents = [];
  
  // Initialize legendary players from transfer market
  initializeLegendaryPlayersInTopScorers();
}

function initializeLegendaryPlayersInTopScorers(){
  // Add legendary players from BASE_PLAYERS and SPECIAL_PLAYERS to top scorers
  const legendaryPlayers = [
    ...BASE_PLAYERS.filter(p => p.rating >= 85),
    ...SPECIAL_PLAYERS.filter(p => p.tier === 'legendary' || p.rating >= 90)
  ];
  
  // Assign legendary players to random Premier League teams
  const premierLeagueTeams = ALL_TEAMS.filter(team => team !== 'Southampton FC');
  
  legendaryPlayers.forEach(player => {
    if (!S.topScorers[player.name]) {
      // Assign to a random Premier League team
      const assignedTeam = pick(premierLeagueTeams);
      S.topScorers[player.name] = {
        name: player.name,
        team: assignedTeam,
        goals: 0, // Start with no goals - they'll be added during actual matches
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        matches: 0
      };
    }
  });
  
  // Also add some sample data for testing with proper teams
  if (Object.keys(S.topScorers).length === 0) {
    // Add a few players with no initial goals - they'll be added during matches
    S.topScorers['Anton Colossus'] = {
      name: 'Anton Colossus',
      team: pick(premierLeagueTeams),
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
    
    S.topScorers['Cristiano Ronaldo'] = {
      name: 'Cristiano Ronaldo',
      team: pick(premierLeagueTeams),
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  }
}

function addGoalToTopScorers(playerName, team, isOwnGoal = false) {
  ensureTopScorersInit();
  
  if (!S.topScorers[playerName]) {
    S.topScorers[playerName] = {
      name: playerName,
      team: team,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  }
  
  if (!isOwnGoal) {
    S.topScorers[playerName].goals++;
    // Debug logging to verify goal tracking
  }
}

function addAssistToTopScorers(playerName, team) {
  ensureTopScorersInit();
  
  if (!S.topScorers[playerName]) {
    S.topScorers[playerName] = {
      name: playerName,
      team: team,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  }
  
  S.topScorers[playerName].assists++;
}

function addCardToTopScorers(playerName, team, cardType) {
  ensureTopScorersInit();
  
  if (!S.topScorers[playerName]) {
    S.topScorers[playerName] = {
      name: playerName,
      team: team,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  }
  
  if (cardType === 'yellow') {
    S.topScorers[playerName].yellowCards++;
  } else if (cardType === 'red') {
    S.topScorers[playerName].redCards++;
  }
}

function addMatchToTopScorers(playerName, team) {
  ensureTopScorersInit();
  
  if (!S.topScorers[playerName]) {
    S.topScorers[playerName] = {
      name: playerName,
      team: team,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      matches: 0
    };
  }
  
  S.topScorers[playerName].matches++;
}

function getTopScorers(limit = 20) {
  ensureTopScorersInit();
  
  const allPlayers = Object.values(S.topScorers);
  return allPlayers
    .sort((a, b) => {
      // Sort by goals first, then assists, then by name
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

function showTopScorersPopup() {
  ensureTopScorersInit();
  
  const topScorers = getTopScorers(20);
  const modal = document.getElementById('topScorersModal');
  const content = document.getElementById('topScorersContent');
  
  if (!modal || !content) {
    console.error('Top scorers modal elements not found');
    return;
  }
  
  let tableHTML = `
    <table class="top-scorers-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Team</th>
          <th>Goals</th>
          <th>Assists</th>
          <th>Yellow</th>
          <th>Red</th>
          <th>Matches</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  if (topScorers.length === 0) {
    tableHTML += `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
          No goals scored yet this season
        </td>
      </tr>
    `;
  } else {
    topScorers.forEach((player, index) => {
      const isSouthampton = player.team === 'Southampton FC' || player.team === 'Southampton';
      const rowClass = isSouthampton ? 'southampton-player' : '';
      
      tableHTML += `
        <tr class="${rowClass}">
          <td>${index + 1}</td>
          <td>${player.name}${player.team ? ` <span class="player-club-label">(${player.team})</span>` : ''}</td>
          <td>${player.team}</td>
          <td><strong>${player.goals}</strong></td>
          <td>${player.assists}</td>
          <td>${player.yellowCards}</td>
          <td>${player.redCards}</td>
          <td>${player.matches}</td>
        </tr>
      `;
    });
  }
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  content.innerHTML = tableHTML;
  modal.classList.remove('hidden');
}

function closeTopScorersPopup() {
  const modal = document.getElementById('topScorersModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Show Cronster letter in a styled popup modal
async function showCronsterLetterModal() {
  const modal = document.getElementById('cronsterLetterModal');
  const content = document.getElementById('cronsterLetterContent');
  
  if (!modal || !content) {
    // Fallback to regular log if modal doesn't exist
    log(`You open the letter. The handwriting is messy and disturbing:`);
    log(`"i likes to squeeze 'em i does... i likes to squeeze 'em til all the juices come out...`);
    log(`lovely jubbly i tells ya ...you squeeze a woman hard enough and all her lovely juices come out...`);
    const clubName = getClubName();
    log(`thats what the cronster likes... cor blimey .. ill be squeezing the lot of ${clubName.toLowerCase()}'s women team"`);
    log(`It's signed: "The Kuddle Cronster"`);
    return;
  }
  
  // Set letter content with styled formatting
  content.innerHTML = `
    <div style="text-align: left; margin-bottom: 20px;">
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #2a2a2a;">
        i likes to squeeze 'em i does... i likes to squeeze 'em til all the juices come out...
      </p>
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #2a2a2a;">
        lovely jubbly i tells ya ...you squeeze a woman hard enough and all her lovely juices come out...
      </p>
      <p style="margin: 0 0 20px 0; font-size: 16px; color: #2a2a2a;">
        thats what the cronster likes... cor blimey .. ill be squeezing the lot of ${getClubName().toLowerCase()}'s women team
      </p>
      <p style="margin: 30px 0 0 0; text-align: right; font-size: 16px; font-weight: bold; color: #2a2a2a; border-top: 1px solid #8b7355; padding-top: 15px;">
        The Kuddle Cronster
      </p>
    </div>
  `;
  
  // Show modal
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  
  // Wait for user to close the modal
  return new Promise((resolve) => {
    const closeBtn = modal.querySelector('.modal-close');
    const footerBtn = modal.querySelector('.btn-primary');
    const closeHandler = () => {
      closeCronsterLetterModal();
      resolve();
    };
    
    if (closeBtn) closeBtn.onclick = closeHandler;
    if (footerBtn) footerBtn.onclick = closeHandler;
    
    // Also allow clicking outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeHandler();
      }
    };
  });
}

function closeCronsterLetterModal() {
  const modal = document.getElementById('cronsterLetterModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function showMatchSummary(ourGoals, theirGoals, oppName) {
  // Get the match events from the last match
  const matchEvents = S.matchEvents || [];
  const goalEvents = matchEvents.filter(e => e.kind === 'GOAL');
  
  if (goalEvents.length === 0) {
    log(`📊 <strong>Match Summary:</strong> No goals scored in this match.`);
    return;
  }
  
  let summary = `📊 <strong>Match Summary:</strong><br>`;
  
  // Group goals by team
  const ourGoalEvents = goalEvents.filter(e => e.who === 'HOME');
  const theirGoalEvents = goalEvents.filter(e => e.who === 'AWAY');
  
  if (ourGoalEvents.length > 0) {
    summary += `<strong>${getClubName()} Goals:</strong><br>`;
    ourGoalEvents.forEach((goal, index) => {
      const assistText = goal.assister ? ` (Assist: ${goal.assister})` : '';
      summary += `${index + 1}. ${goal.scorer}${assistText}<br>`;
    });
  }
  
  if (theirGoalEvents.length > 0) {
    summary += `<strong>${oppName} Goals:</strong><br>`;
    theirGoalEvents.forEach((goal, index) => {
      const assistText = goal.assister ? ` (Assist: ${goal.assister})` : '';
      summary += `${index + 1}. ${goal.scorer}${assistText}<br>`;
    });
  }
  
  log(summary);
}



// re-render the table panel safely
function renderLeagueTablePanel(){
  if (typeof showLeaguePosition === 'function') showLeaguePosition();
}

// --- TABLE helpers (init rows + write results) ---
function ensureTableTeam(team){
  if (!S.table) S.table = {};
  const clubName = S.club_name || "Southampton FC";
  // Always ensure current club has a table entry, even if somehow marked as destroyed
  if (team === clubName) {
    if (!S.table[team]) {
      S.table[team] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
    } else {
    }
    return; // Always create/ensure club entry
  }
  // Don't add destroyed teams to the table (except current club, handled above)
  if (S.destroyedTeams && Array.isArray(S.destroyedTeams) && S.destroyedTeams.includes(team)) {
    return; // Skip destroyed teams
  }
  if (!S.table[team]) {
    S.table[team] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
  }
}
window.recordTableResult = function(home, away, gh, ga){
  ensureTableTeam(home); ensureTableTeam(away);
  const H=S.table[home], A=S.table[away];
  
  // Safety check: if entry still doesn't exist after ensureTableTeam, create it anyway (defensive)
  // This can happen if team names don't match exactly or if there's a timing issue
  if (!H) {
    if (!S.table) S.table = {};
    S.table[home] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
  }
  if (!A) {
    if (!S.table) S.table = {};
    S.table[away] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
  }
  
  // Get entries again after potential creation
  const H_final = S.table[home];
  const A_final = S.table[away];
  
  // Final safety check - if still missing, skip (shouldn't happen but be safe)
  if (!H_final || !A_final) {
    return;
  }
  
  H_final.P++; A_final.P++; H_final.GF+=gh; H_final.GA+=ga; A_final.GF+=ga; A_final.GA+=gh;
  H_final.GD = H_final.GF - H_final.GA; A_final.GD = A_final.GF - A_final.GA;
  if (gh>ga){ H_final.W++; A_final.L++; H_final.PTS+=3; }
  else if (gh<ga){ A_final.W++; H_final.L++; A_final.PTS+=3; }
  else { H_final.D++; A_final.D++; H_final.PTS+=1; A_final.PTS+=1; }
  
  // Sync S.points with league table for Southampton
  const clubName = S.club_name || "Southampton FC";
  if ((home === clubName || away === clubName) && S.table[clubName]) {
    S.points = S.table[clubName].PTS;
  }
}

// Southampton’s “true” match strength (uses your lineup/morale code) or fallback to base.
function getTeamMatchStrength(team){
  if (team==="Southampton FC"){
    try {
      const our5 = (typeof getOurSelectedFive==='function') ? getOurSelectedFive() : [];
      if (our5 && our5.length) {
        if (typeof computeTeamStrength==='function') return computeTeamStrength(our5);
      }
    } catch(e){}
    return TEAM_QUALITY[team]||60;
  } else {
    return TEAM_QUALITY[team]||60;
  }
}



function currentOpponent(){
  ensureSeasonSchedule();
  const idx = Math.min(S.matches_played | 0, S.opponents.length - 1);
  return {
    team: S.opponents[idx],
    manager: S.opponentManagers[idx]
  };
}

// --- SCHEDULE builder (keeps your S.opponents order) ---
function buildRoundsFromOurOpponents(opponents){
  // opponents.length = S.season_matches (your existing season length)
  const rounds = [];
  const teams = ALL_TEAMS.slice();
  // Use current club name (supports renaming after nuclear option)
  const SOUTH = (typeof getClubName === 'function') ? getClubName() : (S?.club_name || "Southampton FC");

  // flip home/away each round for us; others paired randomly but non-overlapping that round
  for (let r=0; r<opponents.length; r++){
    const opp = opponents[r];
    const roundMatches = [];

    // our fixture first (alternate home/away each round)
    const homeFirst = (r%2===0);
    if (homeFirst) roundMatches.push([SOUTH, opp]); else roundMatches.push([opp, SOUTH]);

    // pool of remaining teams this round
    const pool = teams.filter(t=> t!==SOUTH && t!==opp);
    // shuffle a copy (Fisher–Yates)
    for (let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=pool[i]; pool[i]=pool[j]; pool[j]=tmp; }
    // pair off sequentially
    for (let i=0;i<pool.length;i+=2){
      const a = pool[i], b = pool[i+1];
      if (!a || !b) break; // odd safety
      // alternate home assignment to mix it up
      if ((i/2)%2===0) roundMatches.push([a,b]); else roundMatches.push([b,a]);
    }
    rounds.push(roundMatches);
  }
  return rounds;
}

// Ensure we have full rounds for the season and a fresh table at season start
function ensureSeasonScheduleAndTable(){
  if (!S.table) S.table = {};
  // (Re)build rounds if missing or season length changed
  if (!S.rounds || !Array.isArray(S.rounds) || S.rounds.length !== (S.opponents? S.opponents.length : 0)) {
    if (!S.opponents || !S.opponents.length){
      // fallback: if you don't have opponents yet, derive a simple list
      let others = ALL_TEAMS.filter(t=>t!=="Southampton FC");
      
      // Season 4 & 5: Filter out liquidated teams
      if (S.season === 4 && S.season4 && S.season4.liquidated_teams) {
        others = others.filter(t => !S.season4.liquidated_teams.includes(t));
      } else if (S.season === 5 && S.season4 && S.season4.liquidated_teams) {
        others = others.filter(t => !S.season4.liquidated_teams.includes(t));
      }
      
      S.opponents = others.slice(0, Math.min(others.length, S.season_matches||others.length));
    }
    S.rounds = buildRoundsFromOurOpponents(S.opponents);
  }
  // Make sure every team has a row (so the table isn't "static") - except destroyed teams
  const destroyed = S.destroyedTeams || [];
  for (const t of ALL_TEAMS) {
    if (!destroyed.includes(t)) {
      ensureTableTeam(t);
    }
  }
}
