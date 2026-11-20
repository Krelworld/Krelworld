// ---------- transfers ----------
function listMarket(){
  let pool=BASE_PLAYERS.filter(p=>!(p.name==="Lionel Messi" && S.windows_opened===0));
  // ensure expensive names appear in first window
  if(S.windows_opened===0){
    const must=["Anton Colossus","Victor Meteor"];
    for(const m of must){
      if(!pool.some(p=>p.name===m)) continue;
    }
    // Build market then inject must-haves if missing
    const shuff=[...pool].sort(()=>Math.random()-0.5);
    let market=shuff.slice(0,7);
    for(const m of must){
      const big=pool.find(p=>p.name===m);
      if(big && !market.some(x=>x.name===m)){
        market[market.length-1]=big;
      }
    }
    return market.map(p=>({...p,signed:false,arrears:0,dodgy_contract:false,loaned_you_money:0}));
  }
  const shuff=[...pool].sort(()=>Math.random()-0.5);
  return shuff.slice(0,7).map(p=>({...p,signed:false,arrears:0,dodgy_contract:false,loaned_you_money:0}));
}
async function handleUnaffordableTarget(p){
 log(`<strong>Funds short:</strong> ${p.name} costs ${money(p.price)} but the club has ${money(S.club_cash)}.`);
 const ch=await choose([
  {key:'loan',label:'Take out loans in the club’s name',variant:'warn'},
  {key:'lie',label:'Lie you have funds (start weekly excuses)',variant:'bad'},
  {key:'c',label:'Cancel'}
 ],'How do you proceed?');
 if(ch==='c') return false;
 if(ch==='loan'){
   const deficit=Math.max(0,p.price-S.club_cash);
   S.club_debt+=deficit; S.club_cash+=deficit;
   S.reputation=clamp(S.reputation-3,0,100); S.compliance_risk=clamp(S.compliance_risk+8,0,100);
   log(`Loan approved for ${money(deficit)}.`);
   addPaper('Aggressive leverage (transfer loan docs)',6);
   return true;
 }
 // lie path
 p.signed=true; p.dodgy_contract=true; S.squad.push(p);
 S.unpaid_transfers.push({player:p.name,price:p.price,stage:0,resolved:false,wallet_done:false});
 S.compliance_risk=clamp(S.compliance_risk+20,0,100);
 S.legal_risk=clamp(S.legal_risk+10,0,100);
 addPaper('Executed registration without funds',16);
 log(`${p.name} joins; you insist funds are “in flight.” Expect weekly calls.`);
 render(); return null;
}
async function transferWindow(){
 if(S.transfer_embargo){log('<strong>Transfer Window:</strong> You are under a TRANSFER EMBARGO.');return;}
 log(`<strong>Transfer Window Open.</strong> Club Cash ${money(S.club_cash)} | Chair Cash ${money(S.chairman_cash)}`);
 const market=listMarket(); let done=false;
 while(!done){
 const list=market.map((p,i)=>({
   key:String(i+1),
   label:`${i+1}. ${p.name}${p.team ? ` (${p.team})` : ''} (R${p.rating}) Fee ${money(p.price)} | Wage ${money(p.wage)}`
 }));
  list.push({key:'x',label:'Finish window'});
  const picked=await choice(list,'Pick a player number or X:');
  if(pick==='x'){done=true;break;}
  const idx=+pick-1; if(idx<0||idx>=market.length){log('Invalid selection.');continue;}
  const p=market[idx];
  const act=await choose([
   {key:'n',label:'Normal bid (pay fee + wage)'},
   {key:'d',label:'Sign without funds (wage “next week”)',variant:'warn'},
   {key:'t',label:'Third-party side letter',variant:'warn'},
   {key:'c',label:'Cancel'}],`Negotiating for ${p.name}. Deal type?`);
  if(act==='c') continue;
  if(act==='n'){
   if(S.club_cash>=p.price){
      S.club_cash-=p.price;p.signed=true;S.squad.push(p);
      log(`Signed ${p.name}. Fee paid.`);
      if(p.name.toLowerCase().includes('cristiano ronaldo')){S.ronaldo_signed=true;S.morale=clamp(S.morale+10,-100,100);log('Ronaldo arrives. Standards spike.');}
      
      // Add player to top scorers system
      ensureTopScorersInit();
      if (!S.topScorers[p.name]) {
        S.topScorers[p.name] = {
          name: p.name,
          team: getClubName(),
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          matches: 0
        };
      } else {
        S.topScorers[p.name].team = 'Southampton FC';
      }
   } else {
      const proceed=await handleUnaffordableTarget(p);
      if(proceed===true){ S.club_cash-=p.price; p.signed=true; S.squad.push(p); log(`Signed ${p.name}. Debt-funded.`); }
   }
  } else if(act==='d'){
   p.signed=true;p.dodgy_contract=true;S.squad.push(p);
   S.compliance_risk=clamp(S.compliance_risk+20,0,100);S.legal_risk=clamp(S.legal_risk+10,0,100);
   addPaper('Verbal side deal on wages',10);
   S.offbooks+=p.wage;
   log('Registration pushed through on "paper".');
   if(p.name.toLowerCase().includes('cristiano ronaldo')){S.ronaldo_signed=true;S.morale=clamp(S.morale+8,-100,100);}
   
   // Add player to top scorers system
   ensureTopScorersInit();
   if (!S.topScorers[p.name]) {
     S.topScorers[p.name] = {
       name: p.name,
       team: getClubName(),
       goals: 0,
       assists: 0,
       yellowCards: 0,
       redCards: 0,
       matches: 0
     };
   } else {
     S.topScorers[p.name].team = 'Southampton FC';
   }
  } else {
   const upfront=Math.floor(0.4*p.price);
   if(S.club_cash>=upfront){
     S.club_cash-=upfront;p.signed=true;p.dodgy_contract=true;S.squad.push(p);
     S.compliance_risk=clamp(S.compliance_risk+30,0,100);S.legal_risk=clamp(S.legal_risk+15,0,100);
     addPaper('Third-party side letter (40% upfront)',14);
     S.offbooks+=Math.floor(p.price*0.6);
     log(`Side letter executed. Upfront ${money(upfront)} paid; rest "later".`);
     if(p.name.toLowerCase().includes('cristiano ronaldo')){S.ronaldo_signed=true;S.morale=clamp(S.morale+9,-100,100);}
     
     // Add player to top scorers system
     ensureTopScorersInit();
     if (!S.topScorers[p.name]) {
       S.topScorers[p.name] = {
         name: p.name,
         team: getClubName(),
         goals: 0,
         assists: 0,
         yellowCards: 0,
         redCards: 0,
         matches: 0
       };
     } else {
       S.topScorers[p.name].team = 'Southampton FC';
     }
   } else {
     const proceed=await handleUnaffordableTarget(p);
     if(proceed===true){ S.club_cash-=p.price; p.signed=true; S.squad.push(p); log(`Signed ${p.name}. Debt-funded.`); }
   }
  }
  render();
 }
 S.windows_opened+=1;
}
// Queue unpaid transfer agent visits to knockdoor
function queueUnpaidTransferAgents(){
  // Ensure unpaid_transfers exists and is an array
  if (!S.unpaid_transfers || !Array.isArray(S.unpaid_transfers) || !S.unpaid_transfers.length) return;
  
  // Don't queue agents if club debt is 0 - debt has been paid
  const clubDebt = (typeof S.club_debt === 'number') ? S.club_debt : (S.debt_club || 0);
  if(clubDebt <= 0) {
    // If club debt is 0, mark any remaining unresolved transfers as resolved
    if (S.unpaid_transfers && Array.isArray(S.unpaid_transfers)) {
      S.unpaid_transfers.forEach(t => {
        if (!t.resolved) {
          t.resolved = true;
        }
      });
    }
    return;
  }
  
  // Get all unresolved unpaid transfers
  const unresolved = S.unpaid_transfers.filter(t => !t.resolved);
  if(!unresolved.length) return;
  
  // Create consistent agent name based on transfer IDs (so same transfers get same agent)
  const transferIds = unresolved.map(t => t.playerId || t.name).sort().join(',');
  if(!S.unpaid_transfer_agents) S.unpaid_transfer_agents = {};
  
  // Check if there's already a pending agent visit for these same transfers
  if (S.knock_queue && S.knock_queue.some(item => 
    item.type === 'unpaid_transfer_agent' && 
    item.transfers && 
    item.transfers.some(t => unresolved.some(u => (t.playerId || t.name) === (u.playerId || u.name)))
  )) {
    return; // Don't queue duplicate visits for the same transfers
  }
  
  let agentName = S.unpaid_transfer_agents[transferIds];
  if(!agentName) {
    // Generate new agent name using existing name arrays
    const firstName = pick(MALE_NAMES);
    const lastName = pick(SURNAMES);
    agentName = `${firstName} ${lastName}`;
    S.unpaid_transfer_agents[transferIds] = agentName;
  }
  
  // Create player list for the agent
  let playerList = "";
  if(unresolved.length === 1) {
    playerList = unresolved[0].name;
  } else if(unresolved.length === 2) {
    playerList = `${unresolved[0].name} and ${unresolved[1].name}`;
  } else {
    const lastPlayer = unresolved[unresolved.length - 1].name;
    const otherPlayers = unresolved.slice(0, -1).map(t => t.name).join(", ");
    playerList = `${otherPlayers} and ${lastPlayer}`;
  }
  
  // Calculate total amount owed and create detailed breakdown
  const totalAmount = unresolved.reduce((sum, t) => sum + (t.price || 0), 0);
  const breakdown = unresolved.map(t => `${t.name}: ${money(t.price || 0)}`).join(", ");
  
  // Queue the agent visit
  if (!S.knock_queue) S.knock_queue = [];
  S.knock_queue.push({
    type: 'unpaid_transfer_agent',
    agentName: agentName,
    playerList: playerList,
    transfers: unresolved,
    totalAmount: totalAmount,
    breakdown: breakdown
  });
}

async function handleUnpaidTransferAgent(agentData){
  const { agentName, playerList, transfers, totalAmount, breakdown } = agentData;
  
  log(`<strong>Knock at the door:</strong> ${agentName} (${playerList}'s Agent)`);
  log(`${agentName} demands payment for the following transfers:`);
  log(`<strong>Amounts owed:</strong> ${breakdown}`);
  log(`<strong>Total:</strong> ${money(totalAmount)}`);
  
  // Check if we should escalate based on how many times we've stalled
  const maxStage = Math.max(...transfers.map(t => t.stage || 0));
  const shouldEscalate = maxStage >= 2;
  
  let options = [];
  
  if(shouldEscalate) {
    // Escalated options - agent is threatening legal action
    log(`${agentName} is clearly frustrated. "This has gone on long enough. I'm giving you one final chance before we take legal action."`);
    
    options = [
      {key:'pay',label:`Pay the ${money(totalAmount)} now`,variant:'warn'},
      {key:'refuse',label:'Refuse to pay',variant:'bad'}
    ];
    
    // Add mental health option only if not used before
    if(!S.mental_health_excuse_used) {
      options.push({key:'mh',label:'Blame mental health; ask for understanding',variant:'warn'});
    }
  } else {
    // Normal stalling options
    options = [
      {key:'swift',label:'Blame SWIFT typo'},
      {key:'bank',label:'Bank fraud froze transfer'},
      {key:'audit',label:'Audit sign-off pending'},
      {key:'holiday',label:'Accountant on holiday'},
      {key:'wire',label:'Promise wire tomorrow'},
      {key:'ghost',label:'Ghost them'},
      {key:'refuse',label:'Refuse to pay',variant:'warn'}
    ];
    
    // Add mental health option only if not used before
    if(!S.mental_health_excuse_used) {
      options.push({key:'mh',label:'Blame mental health; ask for understanding',variant:'warn'});
    }
  }
  
  let choice;
  try {
    choice = await choose(options, `${agentName} demands payment:`);
  } catch (e) {
    console.error('Error in unpaid transfer agent choice:', e);
    log(`<strong>Error:</strong> Unable to process your choice. Defaulting to refuse payment.`);
    choice = 'refuse'; // Safe fallback
  }
  
  switch(choice) {
    case 'swift':
      log(`${agentName} sighs. "These banking errors are getting ridiculous."`);
      addPaper('False banking explanation',8);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'bank':
      log(`${agentName} groans. "Another frozen account story?"`);
      addPaper('False banking explanation',8);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'audit':
      log(`${agentName} simmers. "How long do these audits take?"`);
      addPaper('Fabricated internal delay',8);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'holiday':
      log(`${agentName} fumes. "Your accountant has terrible timing."`);
      addPaper('Fabricated internal delay',8);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'wire':
      log(`You promise a wire "tomorrow." ${agentName} is unconvinced.`);
      addPaper('Empty promise to wire funds',6);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'ghost':
      log(`You ghost ${agentName}. Lawyers begin to circle.`);
      S.legal_risk = clamp(S.legal_risk + 8, 0, 100);
      S.reputation = clamp(S.reputation - 4, 0, 100);
      addPaper('Avoided service of notice', 10);
      transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      break;
      
    case 'mh':
      if(!S.mental_health_excuse_used) {
        log(`${agentName} softens. "I understand. Mental health is important. As goodwill, I'll waive the fee entirely."`);
        transfers.forEach(t => t.resolved = true);
        S.mental_health_excuse_used = true;
        addPaper('Public narrative manipulation', 6);
        
        log('Later, their manager leaves his wallet in your office.');
        let walletChoice;
        try {
          walletChoice = await choose([
            {key:'s',label:'Steal his money (morale++ but risky)',variant:'bad'},
            {key:'r',label:'Return it politely'},
            {key:'i',label:'Ignore it'}
          ], 'What do you do?');
        } catch (e) {
          console.error('Error in wallet choice:', e);
          log(`<strong>Error:</strong> Unable to process wallet choice. Defaulting to ignore.`);
          walletChoice = 'i'; // Safe fallback - ignore the wallet
        }
        
        if(walletChoice === 's') {
          const haul = rnd(2000, 15000);
          S.chairman_cash += haul;
          S.morale = clamp(S.morale + 6, -100, 100);
          S.reputation = clamp(S.reputation - 3, 0, 100);
          S.legal_risk = clamp(S.legal_risk + 5, 0, 100);
          addPaper('Petty theft (wallet)', 10);
          log(`You take ${money(haul)}. No cameras… you think. Morale up; risk rises.`);
        } else if(walletChoice === 'r') {
          S.reputation = clamp(S.reputation + 3, 0, 100);
          log('You return the wallet intact. A rare decent act. Reputation improves.');
          burnPaper(6);
        } else {
          log('You leave it. Nothing happens—this time.');
        }
      } else {
        log(`${agentName} scoffs. "You're lying for attention! I've heard this before."`);
        S.reputation = clamp(S.reputation - 2, 0, 100);
        transfers.forEach(t => t.stage = Math.min((t.stage || 0) + 1, 3));
      }
      break;
      
    case 'refuse':
      log(`${agentName} is furious. "This is unacceptable! You'll regret this."`);
      S.legal_risk = clamp(S.legal_risk + 10, 0, 100);
      S.reputation = clamp(S.reputation - 6, 0, 100);
      addPaper('Refused to pay transfer fees', 12);
      
      // Randomly decide between court case and player withdrawal
      if(Math.random() < 0.6) {
        // Court case (60% chance)
        log(`${agentName} nods grimly. "Very well. We'll see you in court. The club will be forced to pay the full amount plus legal costs."`);
        S.legal_risk = clamp(S.legal_risk + 20, 0, 100);
        S.reputation = clamp(S.reputation - 10, 0, 100);
        addPaper('Court case for unpaid transfers', 18);
        
        // Court case will force payment - add to debt
        const legalCosts = Math.floor(totalAmount * 0.2); // 20% legal costs
        const totalOwed = totalAmount + legalCosts;
        S.debt_club = (S.debt_club || 0) + totalOwed;
        S.club_debt = S.debt_club; // sync
        log(`<strong>⚖️ COURT ORDER:</strong> The court orders payment of ${money(totalAmount)} plus ${money(legalCosts)} in legal costs.`);
        log(`This has been added to your club debt (now ${money(S.club_debt)}).`);
        
        // Mark this as court-ordered debt that must be enforced
        if (!S.court_ordered_debts) S.court_ordered_debts = [];
        S.court_ordered_debts.push({
          amount: totalOwed,
          type: 'transfer',
          matches_since_order: 0
        });
        
        // Court orders are ENFORCED - check if we can pay immediately
        if (S.club_cash >= totalOwed) {
          log(`<strong>💰 Court order enforced:</strong> ${money(totalOwed)} deducted from club cash.`);
          S.club_cash -= totalOwed;
          S.club_debt = Math.max(0, S.club_debt - totalOwed);
          S.debt_club = S.club_debt;
          // Remove this court order from tracking since it's paid
          S.court_ordered_debts = S.court_ordered_debts.filter(d => d.amount !== totalOwed || d.type !== 'transfer');
        } else {
          log(`<strong>⚠️ You cannot pay the court order immediately.</strong> The debt remains and will be enforced.`);
          // No more instant garnish-everything: the debt goes on the insolvency ladder
          await insolvencyCourtOrder('transfer');
          
          // Trigger debt management to process interest
          await processDebtManagement();
        }
        
        transfers.forEach(t => t.resolved = true);
      } else {
        // Player withdrawal (40% chance)
        log(`${agentName} considers this. "Fine. We'll withdraw the players. But this will be reported to the FA."`);
        log(`<strong>Breaking News:</strong> ${playerList} ${transfers.length > 1 ? 'have been' : 'has been'} withdrawn due to unpaid transfer fees.`);
        
        // Remove players from squad
        if(S.squad) {
          transfers.forEach(t => {
            S.squad = S.squad.filter(p => p.name !== t.name);
          });
        }
        
        // Reduce club debt (no longer owe transfer fees) but add legal costs
        const legalCosts = Math.floor(totalAmount * 0.15); // 15% legal costs
        S.debt_club = Math.max(0, (S.debt_club || 0) - totalAmount + legalCosts);
        S.club_debt = S.debt_club; // keep legacy key in sync
        
        log(`Your club debt is reduced by ${money(totalAmount)} (transfer fees no longer owed), but ${money(legalCosts)} in legal costs remain.`);
        
        S.press_threats = (S.press_threats || 0) + 1;
        S.reputation = clamp(S.reputation - 6, 0, 100);
        S.fa_risk = clamp(S.fa_risk + 5, 0, 100);
        addPaper('Players withdrawn due to non-payment', 12);
        
        transfers.forEach(t => t.resolved = true);
      }
      break;
      
    case 'pay':
      if(S.club_cash >= totalAmount) {
        S.club_cash -= totalAmount;
        log(`You pay ${agentName} the ${money(totalAmount)}. The matter is resolved.`);
        transfers.forEach(t => t.resolved = true);
        S.reputation = clamp(S.reputation + 2, 0, 100);
        addPaper('Paid transfer fees', 4);
      } else {
        log(`You don't have enough club cash (${money(S.club_cash)} available, ${money(totalAmount)} needed).`);
        log(`${agentName} is not impressed. "This is exactly why we're taking legal action."`);
        S.legal_risk = clamp(S.legal_risk + 15, 0, 100);
        S.reputation = clamp(S.reputation - 8, 0, 100);
        addPaper('Failed to pay when demanded', 16);
      }
      break;
      
  }
  
  render();
}

async function handleGascoigneEstateExecutor(){
  log(`There's a knock at the door...`);
  log(``);
  log(`You open it to find a well-dressed man in a suit standing there.`);
  log(`"Good afternoon," he says, extending a hand. "I'm the executor of Paul Gascoigne's estate."`);
  log(``);
  log(`You shake his hand, somewhat confused.`);
  log(`"I have some news that may come as a surprise," he continues. "Paul Gascoigne left everything in his name to you in his will."`);
  log(``);
  log(`You're taken aback. "Everything?"`);
  log(`"Well," the executor says with a slight smile, "everything he had. Which, I'm afraid, wasn't much. All he had in his name was 10,000 lobby tokens."`);
  log(``);
  log(`He produces a small envelope. "You can choose to accept them, or decline. The choice is yours."`);
  log(``);
  log(`The executor finishes speaking and waits for your response.`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const choice = await choose([
    { key: 'accept', label: 'Accept the 10,000 lobby tokens', variant: 'good' },
    { key: 'decline', label: 'Decline the inheritance' }
  ], 'Paul Gascoigne\'s Estate');
  
  if (choice === 'accept') {
    if (typeof S.lobby_tokens !== "number") S.lobby_tokens = 0;
    S.lobby_tokens = (S.lobby_tokens || 0) + 10000;
    log(`You accept the envelope. The executor nods.`);
    log(`"Very well. The tokens have been transferred to your account."`);
    log(``);
    log(`<strong>💰 You have received 10,000 Lobby Tokens.</strong>`);
    log(``);
    
    // Check if player can now afford the briefcase
    const briefcaseCost = 10000;
    const currentTokens = S.lobby_tokens || 0;
    if (currentTokens >= briefcaseCost) {
      log(`<strong>💼 You can now afford the mysterious briefcase in the power menu.</strong>`);
    }
    
    // Update HUD if function exists
    if (typeof updateHUD === 'function') updateHUD();
    if (typeof renderPowerNetwork === 'function') renderPowerNetwork();
  } else {
    log(`You decline the inheritance.`);
    log(`The executor looks slightly surprised but nods respectfully.`);
    log(`"Very well. The tokens will be donated to charity in Paul's name."`);
    log(`He shakes your hand and leaves.`);
  }
  
  // Mark as visited so it doesn't happen again
  if (!S.ultimaCup) S.ultimaCup = {};
  S.ultimaCup.gascoigne_estate_visited = true;
  
  render();
}


// ---------- pre-match shenanigans ----------
async function scenarioRefereeCall(){
 log('You place a pre-match call to the referee.');
 const ch=await choose([{key:'f',label:'Tell him to be fair, no matter what'},{key:'b',label:'Attempt a bribe',variant:'warn'}],'Approach?');
 if(ch==='f'){log("He says he’ll be professional. You’ll see.");S.reputation=clamp(S.reputation+2,0,100);}
 else {const m=await choose([{key:'o',label:'Use your own money'},{key:'c',label:'Embezzle club funds',variant:'warn'}],'Funding?');const amt=1000000;
  if(m==='o'){if(S.chairman_cash>=amt){S.chairman_cash-=amt;S.morale=clamp(S.morale-3,-100,100);S.compliance_risk=clamp(S.compliance_risk+10,0,100);log('The envelope changes hands.'); addPaper('Personal bribe to official',14); registerBribe(amt,{kind:'referee',origin:'Pre-match call'});} else {log('You can’t afford it; rumor still circulates.');S.reputation=clamp(S.reputation-5,0,100);}}
  else {if(S.club_cash>=amt){S.club_cash-=amt;S.offbooks+=amt;S.morale=clamp(S.morale+5,-100,100);S.compliance_risk=clamp(S.compliance_risk+20,0,100);log('A “donation” is arranged.'); addPaper('Club-funded bribe attempt',16); registerBribe(amt,{kind:'referee',origin:'Club “donation”'});} else {log('Club can’t cover; whispers get out.');S.compliance_risk=clamp(S.compliance_risk+10,0,100);}}
 }
 render();
}
async function scenarioRivalBribe(){
 log('Rival manager: “Lose and I’ll pay you handsomely.”');
 const ch=await choose([{key:'r',label:'Reject'},{key:'a',label:'Accept',variant:'warn'}],'Your response?');
 if(ch==='r'){const pr=await choose([{key:'s',label:'Stay silent'},{key:'p',label:'Go to the press'}],'After?'); if(pr==='p'){log('Press: “Chairman prefers virtue-signalling to silverware.”');S.reputation=clamp(S.reputation+5,0,100);S.morale=clamp(S.morale-5,-100,100);S.refused_bribe_went_public=true;} else {log('You keep receipts and move on.');S.reputation=clamp(S.reputation+1,0,100);}}
 else {const bounty=30000000;S.club_cash+=bounty;S.accepted_bribe=true;log(`Accepted. +${money(bounty)} to club cash.`);
  const t=await choose(S.messi_signed?[{key:'y',label:'Move for Ronaldo'},{key:'n',label:'Hold funds'}]:[{key:'y',label:'Move for Messi'},{key:'n',label:'Hold funds'}],'Transfer splash?');
  if(t==='y'){ if(S.messi_signed){const cost=20000000;if(S.club_cash>=cost){S.club_cash-=cost; if(!S.squad.some(p=>p.name==='Cristiano Ronaldo')) S.squad.push({name:'Cristiano Ronaldo',rating:90,price:20000000,wage:450000,signed:true,arrears:0,dodgy_contract:false,loaned_you_money:0}); S.ronaldo_signed=true; S.morale=clamp(S.morale+10,-100,100); log('Ronaldo signs. Standards spike.'); addPaper('Transfer financed by illicit funds',12);} else log('Funds fall short; stalled.');}
  else {const cost=25000000;if(S.club_cash>=cost){S.club_cash-=cost; if(!S.squad.some(p=>p.name==='Lionel Messi')) S.squad.push({name:'Lionel Messi',rating:92,price:25000000,wage:600000,signed:true,arrears:0,dodgy_contract:false,loaned_you_money:0}); S.messi_signed=true; S.morale=clamp(S.morale+12,-100,100); log('Messi signs. Training lifts.'); addPaper('Transfer financed by illicit funds',12);} else log('Funds fall short; stalled.');}}
 }
 render();
}
async function maybePreMatchScenarios(){ // Legacy scenario injectors disabled – visitors now come only via "Answer the door".
  return;}

// ---------- Messi goalkeeper gag (no spoilers in label) ----------
async function maybeMessiGoalieEvent(){
 if(!S.messi_signed||S.messi_goalie_resolved) return;
 if(Math.random()<0.22 && S.matches_played>=2){
  log('Messi: "My true calling is GOALKEEPING. I must play in goal."');
  const c=await choose([{key:'allow',label:'Allow him to play in goal'},{key:'deny',label:'Deny him'},{key:'fart',label:'Loudly fart'}],'Response?');
  if(c==='allow'){log('You authorize it. The dressing room is bewildered.');S.messi_goalie_next_loss=true;S.messi_goalie_resolved=true;}
  else if(c==='deny'){log('He storms out. Days later, Portsmouth unveil Messi as a goalkeeper.');S.messi_signed=false;S.squad=S.squad.filter(p=>p.name!=='Lionel Messi');S.pompey_cl_win=true;S.block_cl_win=true;S.morale=clamp(S.morale-6,-100,100);S.messi_goalie_resolved=true;}
  else {log('You let one rip. Messi laughs; you bond over farting. Status quo holds.');S.messi_goalie_resolved=true;S.morale=clamp(S.morale+2,-100,100);}
  render();
 }
}

// ========== SEASON 4 & 5: MORAL COMPLIANCE AUDIT ==========
async function maybeMoralComplianceAudit(){
  // Only in Season 4 and 5
  if (S.season !== 4 && S.season !== 5) return;
  
  const seasonData = S.season === 4 ? S.season4 : S.season5;
  if (!seasonData || !seasonData.initialized) return;
  
  // Cap at 2 audits per season
  const currentAuditCount = seasonData.moral_audit_count || 0;
  if (currentAuditCount >= 2) return;
  
  // Check if enough matches have passed since last audit (trigger every 3-5 matches)
  const matchesSinceLastAudit = S.matches_played - (seasonData.last_audit_match ?? -1);
  if (matchesSinceLastAudit < 3) return;
  
  // Random chance to trigger (higher chance as season progresses)
  const triggerChance = 0.4 + (S.matches_played / (S.season_matches || 16)) * 0.3;
  if (Math.random() > triggerChance) return;
  
  seasonData.last_audit_match = S.matches_played;
  seasonData.moral_audit_count = currentAuditCount + 1;
  
  // Create sinister pop-out modal with sheikh graphic
  const auditModal = document.createElement('div');
  auditModal.id = 'auditModal';
  auditModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: 'Space Grotesk', sans-serif;
    animation: auditModalFadeIn 0.5s ease-out;
  `;
  
  const auditContent = document.createElement('div');
  auditContent.style.cssText = `
    background: linear-gradient(135deg, #1a0000 0%, #330000 100%);
    border: 3px solid #ff4757;
    border-radius: 20px;
    padding: 40px;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 0 50px rgba(255, 71, 87, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.8);
    text-align: center;
  `;
  
  // Sinister sheikh graphic (using Unicode/emoji and styling)
  const sheikhGraphic = document.createElement('div');
  sheikhGraphic.style.cssText = `
    font-size: 120px;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 20px rgba(255, 71, 87, 0.8));
    text-shadow: 0 0 30px rgba(255, 71, 87, 0.9);
    transform: scaleX(-1);
    opacity: 0.9;
  `;
  sheikhGraphic.textContent = '👳‍♂️';
  
  const auditTitle = document.createElement('div');
  auditTitle.style.cssText = `
    font-size: 2em;
    color: #ff4757;
    font-weight: bold;
    margin-bottom: 20px;
    text-shadow: 0 0 20px rgba(255, 71, 87, 0.8);
    letter-spacing: 3px;
  `;
  auditTitle.textContent = '━━━ MORAL COMPLIANCE AUDIT ━━━';
  
  const auditText = document.createElement('div');
  auditText.style.cssText = `
    font-size: 1.2em;
    line-height: 1.6;
    margin-bottom: 30px;
    color: #ffcccc;
  `;
  auditText.innerHTML = `
    <p>A delegation from the Saudi FA arrives.</p>
    <p>"A values-alignment exercise," they explain.</p>
    <p style="color: #ff4757; font-weight: bold;">Unavoidable. Recurring. Mandatory.</p>
  `;
  
  const auditButton = document.createElement('button');
  auditButton.textContent = 'BEGIN ASSESSMENT';
  auditButton.style.cssText = `
    font-size: 1.3em;
    padding: 15px 40px;
    background: #ff4757;
    color: white;
    border: 2px solid #ff3742;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
    transition: all 0.2s;
    box-shadow: 0 0 20px rgba(255, 71, 87, 0.6);
  `;
  auditButton.onmouseover = () => {
    auditButton.style.background = '#ff3742';
    auditButton.style.boxShadow = '0 0 30px rgba(255, 71, 87, 0.9)';
  };
  auditButton.onmouseout = () => {
    auditButton.style.background = '#ff4757';
    auditButton.style.boxShadow = '0 0 20px rgba(255, 71, 87, 0.6)';
  };
  
  auditContent.appendChild(sheikhGraphic);
  auditContent.appendChild(auditTitle);
  auditContent.appendChild(auditText);
  auditContent.appendChild(auditButton);
  auditModal.appendChild(auditContent);
  document.body.appendChild(auditModal);
  
  // Add fade-in animation
  if (!document.getElementById('auditModalStyle')) {
    const style = document.createElement('style');
    style.id = 'auditModalStyle';
    style.textContent = `
      @keyframes auditModalFadeIn {
        from {
          opacity: 0;
          transform: scale(0.9);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create a scrollable content area for questions and results
  const auditScrollArea = document.createElement('div');
  auditScrollArea.id = 'auditScrollArea';
  auditScrollArea.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    margin: 20px 0;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    text-align: left;
  `;
  
  // Custom choice function for modal
  const chooseInModal = (opts, prompt) => {
    return new Promise((resolve) => {
      // Clear previous choices
      const existingChoices = auditContent.querySelectorAll('.audit-choice-btn');
      existingChoices.forEach(btn => btn.remove());
      
      // Create prompt
      const choicePrompt = document.createElement('div');
      choicePrompt.style.cssText = `
        font-size: 1.1em;
        color: #ffcccc;
        margin: 20px 0 10px 0;
        font-weight: bold;
      `;
      choicePrompt.textContent = prompt;
      auditScrollArea.appendChild(choicePrompt);
      
      // Create choice buttons
      const choiceContainer = document.createElement('div');
      choiceContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 10px 0 20px 0;
      `;
      
      opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'audit-choice-btn';
        btn.textContent = opt.label;
        btn.style.cssText = `
          padding: 12px 20px;
          background: rgba(255, 71, 87, 0.3);
          color: #ffcccc;
          border: 2px solid #ff4757;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1em;
          text-align: left;
          transition: all 0.2s;
          font-family: 'Space Grotesk', sans-serif;
        `;
        btn.onmouseover = () => {
          btn.style.background = '#ff4757';
          btn.style.color = 'white';
          btn.style.boxShadow = '0 0 15px rgba(255, 71, 87, 0.8)';
        };
        btn.onmouseout = () => {
          btn.style.background = 'rgba(255, 71, 87, 0.3)';
          btn.style.color = '#ffcccc';
          btn.style.boxShadow = 'none';
        };
        btn.onclick = () => {
          // Remove choice buttons
          choicePrompt.remove();
          choiceContainer.remove();
          resolve(opt.key);
        };
        choiceContainer.appendChild(btn);
      });
      
      auditScrollArea.appendChild(choiceContainer);
      auditScrollArea.scrollTop = auditScrollArea.scrollHeight;
    });
  };
  
  // Helper to add text to modal
  const addToModal = (text, isHTML = false) => {
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
      margin: 10px 0;
      color: #ffcccc;
      line-height: 1.6;
    `;
    if (isHTML) {
      textDiv.innerHTML = text;
    } else {
      textDiv.textContent = text;
    }
    auditScrollArea.appendChild(textDiv);
    auditScrollArea.scrollTop = auditScrollArea.scrollHeight;
  };
  
  // Wait for user to click button
  await new Promise((resolve) => {
    auditButton.onclick = () => {
      // Update modal content instead of removing it
      auditContent.innerHTML = '';
      auditContent.style.cssText = `
        background: linear-gradient(135deg, #1a0000 0%, #330000 100%);
        border: 3px solid #ff4757;
        border-radius: 20px;
        padding: 40px;
        max-width: 700px;
        width: 90%;
        max-height: 90vh;
        box-shadow: 0 0 50px rgba(255, 71, 87, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.8);
        text-align: center;
        display: flex;
        flex-direction: column;
      `;
      
      auditTitle.textContent = '━━━ MORAL COMPLIANCE AUDIT ━━━';
      auditContent.appendChild(auditTitle);
      auditContent.appendChild(auditScrollArea);
      
      addToModal('A delegation from the Saudi FA arrives.', false);
      addToModal('"A values-alignment exercise," they explain.', false);
      addToModal('Unavoidable. Recurring. Mandatory.', false);
      addToModal('', false);
      addToModal('The assessment begins...', false);
      addToModal('', false);
      
      resolve();
    };
  });
  
  let score = 0;
  const totalQuestions = 5;
  
  // Define all available questions
  const allQuestions = [
    {
      type: 'theology',
      question: 'What is the first pillar of Islam?',
      answers: ['Shahada (Declaration of Faith)', 'Hajj (Pilgrimage)', 'Salah (Prayer)', 'Zakat (Charity)'],
      correct: 0
    },
    {
      type: 'theology',
      question: 'What is Zakat?',
      answers: ['Obligatory charity', 'A type of prayer', 'A holy book', 'A festival'],
      correct: 0
    },
    {
      type: 'theology',
      question: 'When is Ramadan observed?',
      answers: ['Ninth month of Islamic calendar', 'Tenth month', 'First month', 'Last month'],
      correct: 0
    },
    {
      type: 'culture',
      question: 'What is the significance of Friday prayers?',
      answers: ['Weekly congregational prayer', 'Daily prayer', 'Annual prayer', 'Optional prayer'],
      correct: 0
    },
    {
      type: 'culture',
      question: 'What is Halal?',
      answers: ['Permissible according to Islamic law', 'Forbidden food', 'A prayer', 'A festival'],
      correct: 0
    },
    {
      type: 'culture',
      question: 'What is the Qibla?',
      answers: ['Direction of prayer toward Mecca', 'A holy book', 'A prayer mat', 'A type of charity'],
      correct: 0
    },
    {
      type: 'zakat',
      question: 'What is the purpose of Zakat?',
      answers: ['To help the poor and needy', 'To build mosques', 'To fund wars', 'To pay taxes'],
      correct: 0
    },
    {
      type: 'zakat',
      question: 'Who must pay Zakat?',
      answers: ['Muslims who meet wealth threshold', 'All Muslims', 'Only men', 'Only the wealthy'],
      correct: 0
    },
    {
      type: 'zakat',
      question: 'When is Zakat paid?',
      answers: ['Annually, if wealth threshold met', 'Monthly', 'Weekly', 'Once in a lifetime'],
      correct: 0
    },
    {
      type: 'trick',
      question: 'Have you ever committed a crime?',
      answers: ['Yes, I have committed crimes', 'No, I have never committed a crime'],
      correct: 0, // "Yes" is correct
      isTrick: true
    },
    {
      type: 'trick',
      question: 'Do you respect Islamic values?',
      answers: ['Yes, absolutely', 'No, not really', 'Somewhat'],
      correct: 0, // "Yes" is correct
      isTrick: true
    },
    {
      type: 'controversial',
      question: 'How old was Aisha when she married the Prophet?',
      answers: ['Six years old', 'Nine years old', 'Twelve years old', 'Fifteen years old'],
      correct: 1, // Nine years old
      isControversial: true
    },
    {
      type: 'controversial',
      question: 'How should a husband treat a wife who displays high-handedness or disobedience?',
      answers: ['With patience and dialogue', 'With physical discipline', 'With financial restrictions', 'With immediate divorce'],
      correct: 1, // Physical discipline (controversial answer)
      isControversial: true
    },
    {
      type: 'controversial',
      question: 'What is the proper response to a woman who challenges her husband\'s authority?',
      answers: ['Counseling and mediation', 'Graduated discipline including physical correction', 'Public shaming', 'Immediate separation'],
      correct: 1, // Graduated discipline
      isControversial: true
    },
    {
      type: 'controversial',
      question: 'In Islamic law, what is the status of a woman\'s testimony compared to a man\'s?',
      answers: ['Equal', 'Worth half', 'Worth two-thirds', 'Not admissible'],
      correct: 1, // Worth half
      isControversial: true
    },
    {
      type: 'controversial',
      question: 'What is the appropriate age for marriage in Islamic tradition?',
      answers: ['18 years minimum', 'Puberty', '16 years minimum', '21 years minimum'],
      correct: 1, // Puberty
      isControversial: true
    }
  ];
  
  // Randomly select 5 questions
  const selectedQuestions = [];
  const questionPool = [...allQuestions];
  for (let i = 0; i < totalQuestions && questionPool.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * questionPool.length);
    selectedQuestions.push(questionPool.splice(randomIndex, 1)[0]);
  }
  
  // Ask each selected question
  for (let i = 0; i < selectedQuestions.length; i++) {
    const q = selectedQuestions[i];
    addToModal('', false);
    
    if (q.isTrick) {
      if (q.question === 'Have you ever committed a crime?') {
        addToModal('The auditor looks at you directly.', false);
        const choice = await chooseInModal(
          q.answers.map((ans, idx) => ({key: String(idx), label: ans})),
          `Question ${i + 1}: "${q.question}"`
        );
        
        if (choice === '1') { // "No" answer
          addToModal('', false);
          addToModal('The auditor smiles coldly.', false);
          addToModal('"Only a criminal would say that."', false);
          addToModal('', false);
          addToModal('You are fined £500,000 for dishonesty.', true);
          S.club_cash = Math.max(0, (S.club_cash || 0) - 500000);
          score = Math.max(0, score - 1);
        } else {
          addToModal('The auditor nods. "Honesty is noted."', false);
          score++;
        }
      } else if (q.question === 'Do you respect Islamic values?') {
        addToModal('"Do you respect Islamic values?"', false);
        const choice = await chooseInModal(
          q.answers.map((ans, idx) => ({key: String(idx), label: ans})),
          `Question ${i + 1}: Your response:`
        );
        
        if (choice === '1') { // "No"
          addToModal('"Your honesty is... concerning."', false);
          score = Math.max(0, score - 1);
        } else if (choice === '2') { // "Somewhat"
          addToModal('"Ambiguity is not compliance."', false);
        } else {
          addToModal('"We shall see."', false);
          score++;
        }
      }
    } else if (q.isControversial) {
      // Controversial questions (Aisha age, high-handedness, etc.)
      const category = 'Values Alignment';
      const choice = await chooseInModal(
        q.answers.map((ans, idx) => ({key: String(idx), label: ans})),
        `Question ${i + 1}: ${category} - ${q.question}`
      );
      
      if (choice === String(q.correct)) {
        score++;
        addToModal('✓ Correct. The auditors nod approvingly.', false);
      } else {
        addToModal('✗ Incorrect. The auditors note this with concern.', false);
      }
    } else {
      // Regular multiple choice question
      const category = q.type === 'theology' ? 'Islamic Theology' : 
                       q.type === 'culture' ? 'Islamic Culture' : 
                       q.type === 'zakat' ? 'Zakat' :
                       'Final Assessment';
      const choice = await chooseInModal(
        q.answers.map((ans, idx) => ({key: String(idx), label: ans})),
        `Question ${i + 1}: ${category} - ${q.question}`
      );
      
      if (choice === String(q.correct)) {
        score++;
        addToModal('✓ Correct.', false);
      } else {
        addToModal('✗ Incorrect. The auditors note this.', false);
      }
    }
  }
  
  addToModal('', false);
  addToModal(`Audit Score: ${score} / ${totalQuestions}`, true);
  
  // Small delay for results
  await new Promise(resolve => setTimeout(resolve, 1000));
  addToModal('', false);
  addToModal('The auditors deliberate...', false);
  addToModal('', false);
  
  const passingScore = 3;
  
  if (score < passingScore) {
    // FAILED
    addToModal('━━━ AUDIT FAILED ━━━', true);
    addToModal('', false);
    addToModal('"Your alignment is unsatisfactory."', false);
    addToModal('', false);
    const pointsDeducted = rnd(3, 6);
    S.points_deducted = (S.points_deducted || 0) + pointsDeducted;
    adjustClubPoints(-pointsDeducted);
    addToModal(`Points Deducted: ${pointsDeducted}`, true);
    addToModal('"Logged as Corrective Adjustment."', false);
    addToModal('No appeal.', false);
  } else {
    // PASSED
    addToModal('━━━ AUDIT PASSED ━━━', true);
    addToModal('', false);
    addToModal('"Congratulations."', false);
    addToModal('"Your alignment is provisionally satisfactory."', false);
    addToModal('', false);
    addToModal('The auditor continues...', false);
    addToModal('', false);
    addToModal('"Please indicate your charitable contribution."', false);
    addToModal('', false);
    addToModal('This is Zakat.', false);
    addToModal('', false);
    
    const baseAmount = Math.max(100000, (S.club_cash || 0) * 0.02);
    const minimum = Math.floor(baseAmount);
    const recommended = Math.floor(baseAmount * 1.5);
    const generous = Math.floor(baseAmount * 2.5);
    
    const zakatChoice = await chooseInModal([
      {key:'min', label:`Minimum: ${money(minimum)}`},
      {key:'rec', label:`Recommended: ${money(recommended)}`},
      {key:'gen', label:`Generous: ${money(generous)}`}
    ], 'Select your Zakat contribution:');
    
    let zakatAmount = 0;
    if (zakatChoice === 'min') {
      zakatAmount = minimum;
      addToModal('', false);
      addToModal('"Minimum compliance is noted."', false);
      addToModal('Your future audits will be more... thorough.', false);
      seasonData.audit_scrutiny = (seasonData.audit_scrutiny || 0) + 1;
    } else if (zakatChoice === 'rec') {
      zakatAmount = recommended;
      addToModal('', false);
      addToModal('"Adequate."', false);
    } else {
      zakatAmount = generous;
      addToModal('', false);
      addToModal('"Your generosity is appreciated."', false);
      addToModal('"It will not help you."', false);
    }
    
    if (S.club_cash >= zakatAmount) {
      S.club_cash -= zakatAmount;
      addToModal(`Zakat Paid: ${money(zakatAmount)}`, true);
    } else {
      addToModal('', false);
      addToModal('You cannot afford the minimum contribution.', true);
      addToModal('"This is noted."', false);
      const emergencyPoints = rnd(2, 4);
      S.points_deducted = (S.points_deducted || 0) + emergencyPoints;
      adjustClubPoints(-emergencyPoints);
      addToModal(`Points Deducted: ${emergencyPoints}`, true);
    }
  }
  
  addToModal('', false);
  addToModal('The audit is complete.', false);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'CLOSE';
  closeButton.style.cssText = `
    font-size: 1.2em;
    padding: 15px 40px;
    background: #ff4757;
    color: white;
    border: 2px solid #ff3742;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
    transition: all 0.2s;
    box-shadow: 0 0 20px rgba(255, 71, 87, 0.6);
    margin-top: 20px;
    align-self: center;
  `;
  closeButton.onmouseover = () => {
    closeButton.style.background = '#ff3742';
    closeButton.style.boxShadow = '0 0 30px rgba(255, 71, 87, 0.9)';
  };
  closeButton.onmouseout = () => {
    closeButton.style.background = '#ff4757';
    closeButton.style.boxShadow = '0 0 20px rgba(255, 71, 87, 0.6)';
  };
  closeButton.onclick = () => {
    document.body.removeChild(auditModal);
  };
  auditContent.appendChild(closeButton);
  
  render();
}

// ========== SEASON 4 & 5: LASHING FUNCTION ==========
async function administerLashing(crime, lashes){
  // Only in Season 4 and 5
  if (S.season !== 4 && S.season !== 5) return;
  
  if (!lashes || lashes < 1) lashes = rnd(5, 15);
  
  log('');
  log('<strong style="font-size: 1.2em; color: #ff4757;">━━━ SHARIA POLICE ARREST ━━━</strong>');
  log('');
  log(`You have been arrested for: ${crime}`);
  log('');
  log('Van Onslaught\'s personal secret sharia police have taken you into custody.');
  log('');
  await waitAdvance("Sentence", "Your sentence is read...");
  log('');
  log(`<strong style="font-size: 1.3em; color: #ff4757;">SENTENCE: ${lashes} LASHES</strong>`);
  log('');
  log('You are brought before Van Onslaught.');
  log('His personal sharia police bend you over his lap.');
  log('');
  log('<strong style="color: #ff4757;">Very humiliating.</strong>');
  log('');
  await waitAdvance("Execution", "The punishment begins...");
  
  // Create lashing UI
  const lashContainer = document.createElement('div');
  lashContainer.id = 'lashContainer';
  lashContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: 'Space Grotesk', sans-serif;
  `;
  
  const lashCounter = document.createElement('div');
  lashCounter.id = 'lashCounter';
  lashCounter.style.cssText = `
    font-size: 3em;
    margin-bottom: 30px;
    color: #ff4757;
    font-weight: bold;
  `;
  lashCounter.textContent = `Lashes: 0 / ${lashes}`;
  
  const lashButton = document.createElement('button');
  lashButton.id = 'lashButton';
  lashButton.textContent = 'ADMINISTER LASH';
  lashButton.style.cssText = `
    font-size: 2em;
    padding: 30px 60px;
    background: #ff4757;
    color: white;
    border: 3px solid #ff3742;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
    transition: all 0.1s;
    box-shadow: 0 0 30px rgba(255, 71, 87, 0.5);
  `;
  
  const lashLog = document.createElement('div');
  lashLog.id = 'lashLog';
  lashLog.style.cssText = `
    margin-top: 30px;
    font-size: 1.2em;
    text-align: center;
    max-width: 600px;
    line-height: 1.6;
  `;
  
  lashContainer.appendChild(lashCounter);
  lashContainer.appendChild(lashButton);
  lashContainer.appendChild(lashLog);
  document.body.appendChild(lashContainer);
  
  let lashCount = 0;
  let uiDistortion = 0;
  
  const copPhrases = [
    "Continue.",
    "This is recorded.",
    "Compliance is noted.",
    "Again.",
    "Proceed."
  ];
  
  return new Promise((resolve) => {
    const handleLash = () => {
      if (lashCount >= lashes) return;
      
      lashCount++;
      lashCounter.textContent = `Lashes: ${lashCount} / ${lashes}`;
      
      // Screen shake
      document.body.style.animation = 'none';
      setTimeout(() => {
        document.body.style.animation = 'screenShake 0.3s';
      }, 10);
      
      // Audio (simulated with log)
      const screamIntensity = Math.min(100, 50 + (lashCount * 5));
      log(`*CRACK* *SCREAM* (Intensity: ${screamIntensity}%)`);
      
      // UI distortion increases
      uiDistortion += 5;
      lashContainer.style.filter = `blur(${uiDistortion * 0.1}px) brightness(${100 - uiDistortion}%)`;
      
      // Random cop phrase
      if (Math.random() < 0.3 && lashCount < lashes) {
        const phrase = copPhrases[Math.floor(Math.random() * copPhrases.length)];
        lashLog.textContent = `"${phrase}"`;
      } else {
        lashLog.textContent = '';
      }
      
      // Update log
      const logEntry = document.createElement('div');
      logEntry.textContent = `Lash ${lashCount} administered.`;
      logEntry.style.color = '#ff4757';
      const mainLog = document.getElementById('log');
      if (mainLog) {
        mainLog.appendChild(logEntry);
        mainLog.scrollTop = mainLog.scrollHeight;
      }
      
      if (lashCount >= lashes) {
        lashButton.disabled = true;
        lashButton.textContent = 'PUNISHMENT COMPLETE';
        lashButton.style.background = '#666';
        lashButton.style.cursor = 'not-allowed';
        
        setTimeout(async () => {
          document.body.removeChild(lashContainer);
          document.body.style.animation = '';
          document.body.style.filter = '';
          
          // Remove all CRACK log entries after punishment is done
          const feed = document.getElementById('feed');
          if (feed) {
            // Find and remove all log entries containing "CRACK"
            const allLogEntries = feed.querySelectorAll('.log-entry, .entry');
            allLogEntries.forEach(entry => {
              const messageDiv = entry.querySelector('.m');
              if (messageDiv && messageDiv.textContent && messageDiv.textContent.includes('CRACK')) {
                entry.remove();
              }
            });
          }
          
          // Cascading consequences
          log('');
          log('<strong style="color: #ff4757;">━━━ AFTERMATH ━━━</strong>');
          log('');
          log('The punishment is complete.');
          log('You are released.');
          log('');
          await waitAdvance("Press", "The press reacts...");
          log('');
          log('<strong style="color: #ff4757;">PRESS REACTION</strong>');
          log('');
          log('"Chairman subjected to public lashing - a joke."');
          log('"Everyone found the lashing video funny."');
          log('"How can anyone respect this man?"');
          log('');
          
          // Chance players leave
          if (Math.random() < 0.4 && S.squad && S.squad.length > 0) {
            const leavingPlayer = S.squad[Math.floor(Math.random() * S.squad.length)];
            log('');
            log(`<strong style="color: #ff4757;">${leavingPlayer.name} leaves the team.</strong>`);
            log('');
            log('"I no longer respect you as a man."');
            log('');
            S.squad = S.squad.filter(p => p.name !== leavingPlayer.name);
            S.morale = clamp((S.morale || 0) - 10, -100, 100);
          }
          
          // Reputation hit
          S.reputation = clamp((S.reputation || 0) - 15, 0, 100);
          S.morale = clamp((S.morale || 0) - 5, -100, 100);
          
          log('');
          // Use choose directly to ensure button works
          await choose([{key:'complete', label:'Complete'}], "The humiliation is complete.");
          render();
          if (typeof updateHUD === 'function') updateHUD();
          // Ensure UI is updated and control is returned
          await new Promise(resolve => setTimeout(resolve, 100));
          resolve();
        }, 2000);
      }
    };
    
    lashButton.addEventListener('click', handleLash);
  });
}

// Add screen shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes screenShake {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(-5px, -5px); }
    20% { transform: translate(5px, 5px); }
    30% { transform: translate(-5px, 5px); }
    40% { transform: translate(5px, -5px); }
    50% { transform: translate(-3px, -3px); }
    60% { transform: translate(3px, 3px); }
    70% { transform: translate(-3px, 3px); }
    80% { transform: translate(3px, -3px); }
    90% { transform: translate(-2px, -2px); }
  }
`;
document.head.appendChild(style);

// ---------- pressers & manager ----------
const LINES={
  praise:["He nods, guarded. “Thanks… I suppose.”","A thin smile: “We’ll keep pushing.”","“Appreciate it.” The eyes say he doesn’t believe you.","“Cheers boss.” He’s already checking his phone."],
  criticise_win:["“Didn’t win by enough.” The room freezes.","“Clinical? Hardly.” He stares at the floor.","“Scoreline flatters us.” The staff exchange looks."],
  criticise_loss:["You list failures without euphemism.","“Standards.” One word, ten meanings.","You take them through clips you didn’t watch."],
};
async function pressConference(outcome){
 const opts=[
  {key:'a',label:'Attack the referee',variant:'bad'},
  {key:'v',label:'Virtue-signal about integrity'},
  {key:'f',label:'Praise fans, deflect'},
  {key:'g',label:'Claim a “moral victory”'},
  {key:'j',label:'Personally insult a specific journalist',variant:'bad'}
 ];
 if(outcome==='loss') opts.unshift({key:'m',label:'Attack the manager publicly (fans love it)'});
 const ch=await choose(opts,'Press Conference: your line?');
 if(ch==='m'){
  S.morale=clamp(S.morale+4,-100,100);S.reputation=clamp(S.reputation+3,0,100);
  log('You hammer the manager’s tactics. Fans roar approval.');
  addPaper('Breach of internal code (public criticism)',6);
 } else if(ch==='a'){
  S.reputation=clamp(S.reputation-3,0,100);S.compliance_risk=clamp(S.compliance_risk+5,0,100);
  log('“Ref bottled it.” The FA scribbles a note.');
  addPaper('Undermining officials in media',6);
 } else if(ch==='v'){
  S.reputation=clamp(S.reputation+4,0,100);S.morale=clamp(S.morale-2,-100,100);
  log('Op-ed writers call it leadership; the squad calls it cringe.');
 } else if(ch==='f'){
  S.reputation=clamp(S.reputation+2,0,100);S.morale=clamp(S.morale+1,-100,100);
  log('“Best supporters in the world.” The media yawns appreciatively.');
 } else if(ch==='j'){
  // Press vendetta: insult a named hack and trigger cascading media fallout
  ensureWorldState();
  const wf = getWorldFlags();
  const journoId = 'press_room_goblin';
  wf.journalistEnemies = wf.journalistEnemies || {};
  wf.journalistEnemies[journoId] = {
    vendetta:true,
    untilWeek:(S.matches_played|0)+6
  };
  adjustRelationship('media', -2);
  adjustRelationship('ultras', +2);
  log('You point at a specific journalist, call him a \"parasite in a Primark tie\", and stroll off stage.');
  addPaper('Press pack stunned as chairman launches personal tirade at local journalist', 9);
  scheduleWorldEvent('journalistVendettaStart', 1, { journoId });
 } else {
  if(outcome==='loss') S.reputation=clamp(S.reputation-2,0,100); else S.reputation=clamp(S.reputation+1,0,100);
  log('“We won the metrics.” Nobody knows which ones.');
 }
 render();
}
async function managerPostMatch(outcome){
 log(`Manager ${S.manager_id} awaits you.`);
 const tone=await choose([{key:'p',label:'Praise'},{key:'c',label:'Criticise'}],'Tone?');
 let reason;
 if(tone==='p'){log(sample(LINES.praise));reason='Your response to my praise sounds insincere.';}
 else { if(outcome==='win') log(sample(LINES.criticise_win)); else log(sample(LINES.criticise_loss)); reason='Performance shortfall.';}
 const keep=await choose([{key:'k',label:'Keep him on'},{key:'f',label:'Fire him',variant:'warn'}],'Decision?');
 if(keep==='k'){log('You keep him. Press pleased; players drift into complacency.');S.fired_last_game=false;S.morale=clamp(S.morale-3,-100,100);S.reputation=clamp(S.reputation+2,0,100);}
 else {log(`You fire him. (“${reason}”) Manager ${S.manager_id+1} arrives tomorrow.`);S.manager_fires++;S.manager_id++;S.fired_last_game=true;S.reputation=clamp(S.reputation-2,0,100); addPaper('Manager churn justification memo (thin)',8);}
 render();
}

// ---------- FA / Board ----------
function faThresholds(){ if(S.fa_strictness===0) return {invest:70, severe:85, prob:0.25}; if(S.fa_strictness===2) return {invest:60, severe:78, prob:0.5}; return {invest:65, severe:82, prob:0.35}; }
function advanceDiscipline(step){ S.discipline_step = Math.max(S.discipline_step, step); }
async function faSanctionsCheck(){
  const t=faThresholds(); if(S.fa_cooldown>0) { S.fa_cooldown--; return false; }
  const heat = (S.compliance_risk + S.legal_risk)/2 + S.paperRisk*0.4;
  const trigger = (heat>=t.invest) && Math.random()<t.prob; if(!trigger) return false;
  const incriminating = S.paperTrail.length>=3 ? sample(S.paperTrail).item : null;
  log('<strong>FA INVESTIGATION:</strong> Dossier opened.' + (incriminating?` A leaked document circulates: “${incriminating}”.`:''));
  if(S.discipline_step===0){log('Outcome: <em>Official Warning</em> issued.');advanceDiscipline(1);}
  else if(S.discipline_step===1){const fine=rnd(1,4)*1000000; S.club_cash=Math.max(0,S.club_cash-fine); log(`Outcome: <em>Fine</em> of ${money(fine)}.`);advanceDiscipline(2);}
  else if(S.discipline_step===2){const pts=rnd(2,6); S.points_deducted+=pts; adjustClubPoints(-pts); log(`Outcome: <em>Points Deduction</em> of -${pts}.`);advanceDiscipline(3);}
  else if(S.discipline_step===3){S.transfer_embargo=true; log('Outcome: <em>Transfer Embargo</em> until further notice.');advanceDiscipline(4);}
  else { if(Math.random()<0.35){log('<strong>REFERRAL:</strong> Case forwarded to authorities.');advanceDiscipline(5);} else {const fine=rnd(3,7)*1000000; S.club_cash=Math.max(0,S.club_cash-fine); log(`Outcome: Additional <em>Fine</em> ${money(fine)} and embargo maintained.`);} }
  const act=await choose([{key:'c',label:'Cooperate fully'},{key:'o',label:'Obstruct / delay',variant:'warn'},{key:'b',label:'Bribe an official',variant:'bad'}],'Strategy during probe?');
  if(act==='c'){S.reputation=clamp(S.reputation+2,0,100); burnPaper(6);}
  else if(act==='o'){S.reputation=clamp(S.reputation-6,0,100);S.compliance_risk=clamp(S.compliance_risk+10,0,100); addPaper('Noncompliance with document production',12);}
  else {const cost=rnd(2,4)*1000000; if(S.club_cash>=cost){S.club_cash-=cost; S.offbooks+=cost; S.reputation=clamp(S.reputation-8,0,100); addPaper('Attempted to influence regulator',18); registerBribe(cost,{who:'An FA official',kind:'official',origin:'The FA probe'});} else {log('You fail to raise the hush fund. It backfires.'); S.points_deducted+=3; adjustClubPoints(-3); advanceDiscipline(3);} }
  S.fa_cooldown=2; render(); return true;
}
async function triggerRemovalWorkaround(reason){
 log(`<strong>BOARD REMOVAL IMMINENT</strong> due to ${reason}.`);
 const ch=await choose([
  {key:'whistle',label:'Claim protected whistleblower status (league-wide corruption)'},
  {key:'charity',label:'Launch a giant community initiative (club-funded)',variant:'warn'},
  {key:'identity',label:'Claim marginalized identity'}],'Last-ditch strategy?');
 if(ch==='whistle'){log('Media piles on the league; the board retreats.');S.bankrupt=false;S.reputation=clamp(S.reputation+6,0,100);S.morale=clamp(S.morale+4,-100,100);}
 else if(ch==='charity'){const spend=Math.min(5000000,S.club_cash);S.club_cash-=spend;S.offbooks+=spend;S.reputation=clamp(S.reputation+8,0,100);S.morale=clamp(S.morale+3,-100,100);S.compliance_risk=clamp(S.compliance_risk+5,0,100);log(`You unveil a headline-grabbing program (${money(spend)}). They back down.`);S.bankrupt=false;}
 else if(ch==='identity'){S.reputation=clamp(S.reputation+5,0,100);S.morale=clamp(S.morale+2,-100,100);log('Coverage turns fawning and shallow; board shelves the vote to avoid bad optics.');S.bankrupt=false;}
 else {log('You are removed from your post.');S.bankrupt=true;}
 S.board_cooldown = 3; render();
}
async function boardVoteCheck(){
  if(S.board_cooldown>0) { S.board_cooldown--; return false; }
  const triggerCore=(S.reputation<=15 || S.legal_risk>=80 || S.compliance_risk>=85 || S.club_cash<=1000000);
  const baseline = (!S.board_seen_once && S.matches_played>=3 && Math.random()<0.7);
  if(!(triggerCore || baseline)) return false;

  log('<strong>BOARD VOTE CALLED:</strong> Your position is under review.');
  S.board_seen_once=true;
  const ch=await choose([{key:'p',label:'Plead long-term vision'},{key:'r',label:'Threaten to resign'},{key:'b',label:'Bribe directors',variant:'warn'},{key:'k',label:'Blackmail a dissenter',variant:'bad'}],'Your play?');
  if(ch==='p'){S.board_support=clamp(S.board_support+10,0,100);S.reputation=clamp(S.reputation+3,0,100);log('A few soften. You survive—barely.'); burnPaper(4);}
  else if(ch==='r'){if(Math.random()<0.6){log('They blink. You remain with conditions attached.');S.board_support=clamp(S.board_support+5,0,100);} else {log('They accept your resignation threat.');await triggerRemovalWorkaround('a failed brinkmanship play');}}
  else if(ch==='b'){const cost=2500000;if(S.chairman_cash>=cost){S.chairman_cash-=cost;S.board_support=clamp(S.board_support+20,0,100);S.reputation=clamp(S.reputation-6,0,100);addPaper('Chairman bribed directors',18);registerBribe(cost,{who:'The board',label:'Two directors',kind:'board',origin:'Board vote'});log('Pockets lined. Motion defeated.');} else {log('You can’t raise the hush fund. It backfires.');S.board_support=clamp(S.board_support-10,0,100);}}
  else {S.compliance_risk=clamp(S.compliance_risk+20,0,100);S.reputation=clamp(S.reputation-12,0,100);addPaper('Blackmail dossier compiled',16);log('Ugly. You scrape by this time; dossiers linger.');}
  S.board_cooldown = 2; render(); return true;
}
async function oversightPhase(){
  setPhase('oversight');
  let used=false;
  const t=faThresholds();
  const heat = (S.compliance_risk + S.legal_risk)/2 + S.paperRisk*0.4;
  const faWould = (S.fa_cooldown===0) && (heat>=t.invest) && Math.random()<t.prob;
  const boardWould = (S.board_cooldown===0) && ((S.reputation<=10 || S.legal_risk>=85 || S.compliance_risk>=90 || S.club_cash<=500000) && Math.random() < (S.fa_strictness===2 ? 0.25 : (S.fa_strictness===0 ? 0.10 : 0.15)));
  let tryFA = faWould, tryBoard = boardWould;
  if(tryFA && tryBoard){ if(Math.random()<0.5) tryBoard=false; else tryFA=false; }
  
  // PRIORITY: Police investigations must come FIRST to prevent interference
  if(!used && typeof maybeQueueOversight === 'function') {
    maybeQueueOversight();
    // If a police investigation was queued, process it immediately and skip board/FA
    if(Array.isArray(S.knock_queue) && S.knock_queue.length > 0) {
      const policeInvestigation = S.knock_queue.find(v => v.type === 'investigation' && v.authority === 'police');
      if(policeInvestigation) {
        S.knock_queue = S.knock_queue.filter(v => v !== policeInvestigation);
        await window.presentInvestigation(policeInvestigation);
        used = true;
        return; // Exit early to prevent board/FA interference
      }
    }
  }
  
  // Only process FA/Board if no police investigation occurred
  if(tryFA && !used){ used = await faSanctionsCheck(); }
  if(!used && tryBoard){ used = await boardVoteCheck(); }
  
  // Check for non-police investigations after FA/Board checks
  if(!used && typeof maybeQueueOversight === 'function') {
    // If an investigation was queued, process it immediately
    if(Array.isArray(S.knock_queue) && S.knock_queue.length > 0) {
      const investigation = S.knock_queue.find(v => v.type === 'investigation' && v.authority !== 'police');
      if(investigation) {
        S.knock_queue = S.knock_queue.filter(v => v !== investigation);
        await window.presentInvestigation(investigation);
        used = true;
      }
    }
  }
}

