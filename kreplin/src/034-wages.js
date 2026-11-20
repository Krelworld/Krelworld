// ---------- wages ----------
async function processWages(){
 if(!S.squad || !Array.isArray(S.squad) || S.squad.length===0) return;
 log('<strong>Wage Week:</strong> Paying the squad.');
 const normal=S.squad.filter(p=>p.signed&&!p.dodgy_contract);
 const total=normal.reduce((s,p)=>s+p.wage,0);
 const effectiveTotal = (S.rnd_perks && S.rnd_perks.facility) ? Math.floor(total*0.98) : total;
 if(S.club_cash>=effectiveTotal){S.club_cash-=effectiveTotal;if(effectiveTotal>0){log(`Paid normal wages: ${money(effectiveTotal)}`);}} else {log('Insufficient funds for normal wages. Partial payments; dressing room uneasy.');S.morale=clamp(S.morale-5,-100,100);S.club_cash=0; addPaper('Missed payroll run',10);}
 render();
 for(const p of S.squad.filter(p=>p.dodgy_contract)){
  log(`Wage issue: ${p.name} expects ${money(p.wage)} now; arrears ${p.arrears} weeks.`);
  const ch=await choose([
   {key:'p',label:'Pay now (club funds)'},
   {key:'o',label:'Pay personally'},
   {key:'e',label:'Embezzle to pay',variant:'warn'},
   {key:'x',label:'Excuse: “payroll glitch”'},
   {key:'n',label:'Excuse: “next week, you know I’m good for it”'},
   {key:'l',label:'Ask player to LEND you money',variant:'bad'}
  ],'Your move?');
  if(ch==='p'){if(S.club_cash>=p.wage){S.club_cash-=p.wage;p.arrears=Math.max(0,p.arrears-1);log('He’s mollified for now.');} else {log('Club can’t cover; he calls his agent.');p.arrears++;S.legal_risk=clamp(S.legal_risk+5,0,100);}}
  else if(ch==='o'){if(S.chairman_cash>=p.wage){S.chairman_cash-=p.wage;p.arrears=Math.max(0,p.arrears-1);S.depressed=true;log('You pay personally. It stings; next match suffers.');} else {log('You don’t have it. He’s unimpressed.');p.arrears++;}}
  else if(ch==='e'){p.arrears=Math.max(0,p.arrears-1);S.offbooks+=p.wage;S.compliance_risk=clamp(S.compliance_risk+10,0,100);S.morale=clamp(S.morale+2,-100,100); addPaper('Internal transfer to hush arrears',10); log('Books massaged; he backs off.');}
  else if(ch==='x'){log('You cite a payroll issue. He glares.');p.arrears++;S.reputation=clamp(S.reputation-2,0,100); addPaper('False payroll communication',8);}
  else if(ch==='n'){log('You promise next week. He mutters “everyone says that”.');p.arrears++;S.morale=clamp(S.morale-2,-100,100); addPaper('Rolling promise to pay',8);}
  else {const loan=Math.min(p.wage*2,500000);p.loaned_you_money+=loan;S.chairman_cash+=loan;S.compliance_risk=clamp(S.compliance_risk+20,0,100);S.legal_risk=clamp(S.legal_risk+10,0,100); addPaper('Player-financed wage advance',12); log(`He lends you ${money(loan)} with visible disbelief.`);p.arrears++;}
  if(p.arrears>=3){log(`${p.name} files a PFA complaint. FA takes notice.`);S.compliance_risk=clamp(S.compliance_risk+15,0,100);S.legal_risk=clamp(S.legal_risk+15,0,100);S.morale=clamp(S.morale-5,-100,100); advanceDiscipline(2);}
  render();
 }
}

function totalLineupWages(){
  const L = Array.isArray(S.lineup) ? S.lineup : [];
  let sum = 0;
  for (const id of L) {
    const p = S.squad.find(player => player.id === id);
    if (p) sum += (p.wage || 0);
  }
  return sum|0;
}
function highestPaidInLineup(){
  const L = Array.isArray(S.lineup) ? S.lineup.slice() : [];
  const players = L.map(id => S.squad.find(player => player.id === id)).filter(Boolean);
  players.sort((a,b)=> (b?.wage||0) - (a?.wage||0));
  return players[0] || null;
}


async function postMatchWageDecision(){
  if (!S) return;
  if (typeof S.player_wage_arrears !== 'number') S.player_wage_arrears = 0;
  if (!S.manager) S.manager = { name:null, skill:0, wage:0, unpaid_streak:0 };

  const teamWeekly = totalLineupWages();
  const managerWeekly = S.manager?.wage|0;
  const totalDue = teamWeekly + managerWeekly;

  // Check if we can actually afford to pay
  const canAfford = (S.club_cash || 0) >= totalDue;
  
  let options = [];
  if (canAfford) {
    options = [
      {key:"pay",   label:`Pay wages now (${money(totalDue)})`},
      {key:"skip",  label:`Skip — add to arrears (${money(totalDue)})`},
    ];
  } else {
    // Can't afford - only allow skip, but warn about consequences
    log(`<strong>⚠️ Insufficient funds:</strong> You don't have enough club cash (${money(S.club_cash || 0)} available, ${money(totalDue)} needed).`);
    options = [
      {key:"skip",  label:`Skip — add to arrears (${money(totalDue)})`, variant: "warn"},
    ];
  }

  const k = await choose(options, "Weekly wages are due. What do you want to do?");

  if (k === "pay"){
    if (!canAfford) {
      // This shouldn't happen, but if it does, force skip
      log(`<strong>Error:</strong> Cannot pay wages - insufficient funds. Adding to arrears.`);
      // Fall through to skip path
    } else {
      S.club_cash = (S.club_cash|0) - totalDue;
      S.player_wage_arrears = 0;
      S.player_wage_skips = 0;
      if (S.manager) S.manager.unpaid_streak = 0;
      log(`You paid wages: ${money(totalDue)} (Manager ${money(managerWeekly)} + Squad ${money(teamWeekly)}).`);
      // Still check debt management after payment
      await processDebtManagement();
      return;
    }
  }
  
  // If we get here, either k === "skip" or payment failed

  // Skip path → arrears + consequences
  S.player_wage_arrears = (S.player_wage_arrears|0) + totalDue;
S.club_debt = (S.club_debt|0) + totalDue;
  S.player_wage_skips   = (S.player_wage_skips|0) + 1;
  if (S.manager) S.manager.unpaid_streak = (S.manager.unpaid_streak|0) + 1;

log(`You skipped wages. Arrears increased by ${money(totalDue)} (now ${money(S.player_wage_arrears)}). Club debt is now ${money(S.club_debt)}.`);

  // Highest-paid player confrontation
  const hp = highestPaidInLineup();
  if (hp){
    const c = await choose([
      {key:"payhp", label:`Pay ${hp.name} now (${money(hp.wage)})`},
      {key:"excuse",label:"Give an excuse"},
      {key:"ask",   label:`Ask ${hp.name} for a loan`},
    ], `${hp.name} (your top earner) demands payment.`);

    if (c === "payhp"){
      const payAmt = hp.wage|0;
      const availableCash = S.club_cash|0;
      if (availableCash >= payAmt) {
        S.club_cash = availableCash - payAmt;
        S.player_wage_arrears = Math.max(0, (S.player_wage_arrears|0) - payAmt);
        log(`You paid ${hp.name} ${money(payAmt)} from club funds.`);
      } else {
        log(`⚠️ Insufficient funds: You don't have enough club cash (${money(availableCash)} available, ${money(payAmt)} needed).`);
        log(`You cannot pay ${hp.name} right now.`);
        S.team_morale = Math.max(0, (S.team_morale|0) - 3);
      }
    } else if (c === "ask"){
      // simple diminishing chance based on prior asks
      const asks = S.player_loan_asks = (S.player_loan_asks|0) + 1;
      const chance = Math.max(0.05, 0.5 - asks*0.1); // 50% → 40% → 30% …
      if (Math.random() < chance){
        const loanAmt = Math.min(hp.wage*2, 200000);
        S.club_cash = (S.club_cash|0) + loanAmt;
        log(`${hp.name} (stunned) lends the club ${money(loanAmt)}. Team morale suffers.`);
        S.team_morale = Math.max(0, (S.team_morale|0) - 3);
      }else{
        log(`${hp.name} refuses the “loan”. Morale drops.`);
        S.team_morale = Math.max(0, (S.team_morale|0) - 5);
      }
    } else {
      // excuse
      S.team_morale = Math.max(0, (S.team_morale|0) - 2);
      log(`You fobbed them off with an excuse. Morale dips.`);
    }
  }

  // Manager consequences if you keep skipping
  if ((S.manager?.unpaid_streak|0) >= 3){
    log(`Your manager has had enough and resigns over withheld pay.`);
    // remove the manager
    S.manager = { name:null, skill:0, wage:0, unpaid_streak:0 };
  }
  
  // WAGE ARREARS ENFORCEMENT: After 3 matches of unpaid wages, trigger court order
  if ((S.player_wage_skips|0) >= 3 && (S.player_wage_arrears|0) > 0) {
    log(`<strong>⚖️ COURT ORDER FOR UNPAID WAGES:</strong> After ${S.player_wage_skips} matches of unpaid wages, the players' union has obtained a court order.`);
    const wageArrears = S.player_wage_arrears|0;
    const legalCosts = Math.floor(wageArrears * 0.2); // 20% legal costs
    const totalOwed = wageArrears + legalCosts;
    
    log(`<strong>⚖️ COURT ORDER:</strong> The court orders payment of ${money(wageArrears)} in unpaid wages plus ${money(legalCosts)} in legal costs.`);
    log(`This has been added to your club debt (now ${money(S.club_debt + totalOwed)}).`);
    
    // Add to debt
    S.club_debt = (S.club_debt|0) + totalOwed;
    S.debt_club = S.club_debt; // sync legacy key
    
    // Mark this as court-ordered debt that must be enforced
    if (!S.court_ordered_debts) S.court_ordered_debts = [];
    S.court_ordered_debts.push({
      amount: totalOwed,
      type: 'wages',
      matches_since_order: 0
    });
    
    // Reset wage arrears counter (court order handles it now)
    S.player_wage_arrears = 0;
    S.player_wage_skips = 0;
    
    // Court orders are ENFORCED - check if we can pay immediately
    if (S.club_cash >= totalOwed) {
      log(`<strong>💰 Court order enforced:</strong> ${money(totalOwed)} deducted from club cash.`);
      S.club_cash -= totalOwed;
      S.club_debt = Math.max(0, S.club_debt - totalOwed);
      S.debt_club = S.club_debt;
      // Remove this court order from tracking since it's paid
      S.court_ordered_debts = S.court_ordered_debts.filter(d => d.amount !== totalOwed || d.type !== 'wages');
    } else {
      log(`<strong>⚠️ You cannot pay the court order immediately.</strong> The debt remains and will be enforced.`);
      // Court-ordered debt is ENFORCEABLE - IMMEDIATELY GARNISH EVERYTHING
      log(`<strong>🚨 ENFORCEMENT:</strong> The court is immediately garnishing all available assets to pay the debt.`);
      
      // IMMEDIATELY liquidate everything before offering payment plan
      await enforceDebtGarnishment();
      
      // Court-ordered debt is sold to creditor if not already active
      if (!S.debt_creditor || !S.debt_creditor.active) {
        log(`<strong>⚠️ CRITICAL:</strong> Your court-ordered wage debt of ${money(S.club_debt)} has been sold to a creditor.`);
        log(`Interest will now accumulate at 5% per match. You need to take action.`);
        
        if (!S.debt_creditor || typeof S.debt_creditor !== 'object') {
          S.debt_creditor = {
            active: false,
            principal: 0,
            interest_rate: 0.05,
            matches_since_sale: 0
          };
        }
        
        S.debt_creditor.active = true;
        S.debt_creditor.principal = S.club_debt;
        S.debt_creditor.matches_since_sale = 0;
        
        // Offer payment plan - if refused, nuclear option
        const planAccepted = await offerPaymentPlan();
        if (!planAccepted) {
          // Refused payment plan - NUCLEAR OPTION
          log(`<strong>💀 You refused the payment plan. The nuclear option is your only remaining choice.</strong>`);
          await triggerNuclearOption();
        }
      } else {
        // Already have creditor - update principal to current total debt
        S.debt_creditor.principal = S.club_debt;
        log(`<strong>⚠️ Additional court-ordered wage debt added.</strong> Your total debt to the creditor is now ${money(S.club_debt)}.`);
      }
      
      // Trigger debt management to process interest
      await processDebtManagement();
    }
  }
  
  // Check debt management after wage decision
  await processDebtManagement();
}

// ========== DEBT MANAGEMENT SYSTEM ==========

// Check debt obligations before allowing match to proceed
async function checkDebtObligationsBeforeMatch(){
  if (!S) return true; // Allow match if state is invalid
  
  // If payment plan is active, payment is MANDATORY before match
  if (S.payment_plan?.active) {
    const paymentPerMatch = Math.ceil(S.payment_plan.total_amount / S.payment_plan.matches_total);
    const clubCash = S.club_cash || 0;
    const personalCash = S.chairman_cash || 0;
    
    log(`<strong>💰 Payment Plan Due:</strong> ${money(paymentPerMatch)} must be paid before this match.`);
    
    // Check if we can make the payment
    if (clubCash >= paymentPerMatch) {
      // Can pay - process payment now
      S.club_cash -= paymentPerMatch;
      S.payment_plan.remaining_amount = Math.max(0, (S.payment_plan.remaining_amount || 0) - paymentPerMatch);
      S.club_debt = Math.max(0, (S.club_debt || 0) - paymentPerMatch);
      S.payment_plan.matches_remaining = Math.max(0, (S.payment_plan.matches_remaining || 0) - 1);
      
      log(`Payment plan: Paid ${money(paymentPerMatch)}. ${S.payment_plan.matches_remaining} matches remaining.`);
      
      if (S.payment_plan.remaining_amount <= 0) {
        log(`<strong>✅ Payment plan complete!</strong> All debt cleared.`);
        S.payment_plan.active = false;
        S.club_debt = 0;
        S.debt_club = 0;
        if (S.debt_creditor) {
          S.debt_creditor.active = false;
          S.debt_creditor.principal = 0;
        }
      }
    } else {
      // Can't pay - must liquidate or trigger nuclear option
      log(`<strong>🚨 BLOCKED:</strong> You don't have enough cash to make the mandatory payment (${money(clubCash)} available, ${money(paymentPerMatch)} needed).`);
      log(`You have ${money(personalCash)} in personal cash.`);
      
      // Try to liquidate to make payment
      log(`<strong>Attempting to raise funds to make mandatory payment...</strong>`);
      await attemptLiquidation();
      
      // Check again after liquidation
      if (S.club_cash >= paymentPerMatch) {
        // Can now pay
        S.club_cash -= paymentPerMatch;
        S.payment_plan.remaining_amount = Math.max(0, (S.payment_plan.remaining_amount || 0) - paymentPerMatch);
        S.club_debt = Math.max(0, (S.club_debt || 0) - paymentPerMatch);
        S.payment_plan.matches_remaining = Math.max(0, (S.payment_plan.matches_remaining || 0) - 1);
        log(`Payment made from liquidated funds. ${S.payment_plan.matches_remaining} matches remaining.`);
        
        if (S.payment_plan.remaining_amount <= 0) {
          log(`<strong>✅ Payment plan complete!</strong> All debt cleared.`);
          S.payment_plan.active = false;
          if (S.debt_creditor) {
            S.debt_creditor.active = false;
            S.debt_creditor.principal = 0;
          }
        }
      } else {
        // Still can't pay - IMMEDIATELY TRIGGER NUCLEAR OPTION
        log(`<strong>💀 Still cannot make payment after liquidation.</strong>`);
        log(`<strong>☢️ THE NUCLEAR OPTION IS YOUR ONLY CHOICE.</strong>`);
        
        if (S.club_debt > 0 && !S.nuclear_option_used) {
          await triggerNuclearOption();
          // After nuclear option, check if game is over
          if (S.game_over) {
            return false; // Block match - game is over
          }
        } else if (S.nuclear_option_used && S.club_debt > 0 && S.club_cash < paymentPerMatch) {
          // Already used nuclear option and still insolvent - game over
          log(`<strong>💀 GAME OVER</strong>`);
          log(`You've become insolvent again after selling the club. There's no way back.`);
          S.game_over = true;
          S.game_over_reason = "Insolvency after nuclear option";
          return false; // Block match
        }
      }
    }
  }
  
  return true; // Allow match to proceed
}

// Process debt management - called after wage decisions and when debt accumulates
async function processDebtManagement(){
  if (!S) return;
  
  // Ensure debt_creditor object exists
  if (!S.debt_creditor || typeof S.debt_creditor !== 'object') {
    S.debt_creditor = {
      active: false,
      principal: 0,
      interest_rate: 0.05,
      matches_since_sale: 0
    };
  }
  
  const currentDebt = S.club_debt || 0;
  
  // If debt is forgiven, ensure it actually runs out
  if (currentDebt <= 0 && S.debt_creditor?.active) {
    S.debt_creditor.active = false;
    S.debt_creditor.principal = 0;
    S.debt_creditor.matches_since_sale = 0;
    log(`Your debt has been fully cleared. The creditor releases their claim.`);
  }
  
  // If debt is high enough and not yet sold to creditor, check if it should be
  if ((!S.debt_creditor || !S.debt_creditor.active) && currentDebt > 5000000 && currentDebt > (S.club_cash || 0) * 3) {
    await checkDebtCreditorSale();
  }
  
  // Process creditor interest if active
  if (S.debt_creditor && S.debt_creditor.active) {
    processCreditorInterest();
  }
  
  // Process payment plan if active
  if (S.payment_plan && S.payment_plan.active) {
    await processPaymentPlan();
  }
  
  // Check if we need to liquidate assets
  if (currentDebt > 0 && S.club_cash < currentDebt * 0.1) {
    await checkLiquidation();
  }
  
  // Sync debt keys
  S.debt_club = S.club_debt;
  updateHUD?.();
}

// Check if debt should be sold to creditor
async function checkDebtCreditorSale(){
  const currentDebt = S.club_debt || 0;
  
  // Ensure debt_creditor object exists
  if (!S.debt_creditor || typeof S.debt_creditor !== 'object') {
    S.debt_creditor = {
      active: false,
      principal: 0,
      interest_rate: 0.05,
      matches_since_sale: 0
    };
  }
  
  // Debt is sold to creditor when it's high and unaffordable
  if (currentDebt > 5000000 && !S.debt_creditor.active) {
    log(`<strong>⚠️ CRITICAL:</strong> Your club debt of ${money(currentDebt)} has been sold to a creditor.`);
    log(`Interest will now accumulate at 5% per match. You need to take action.`);
    
    // IMMEDIATELY GARNISH EVERYTHING
    log(`<strong>🚨 ENFORCEMENT:</strong> The creditor is immediately seizing all available assets.`);
    await enforceDebtGarnishment();
    
    S.debt_creditor.active = true;
    S.debt_creditor.principal = S.club_debt; // Use updated debt after garnishment
    S.debt_creditor.matches_since_sale = 0;
    
    // Offer payment plan - if refused, nuclear option
    const planAccepted = await offerPaymentPlan();
    if (!planAccepted) {
      // Refused payment plan - NUCLEAR OPTION
      log(`<strong>💀 You refused the payment plan. The nuclear option is your only remaining choice.</strong>`);
      await triggerNuclearOption();
    }
  }
}

// Process creditor interest accumulation
function processCreditorInterest(){
  if (!S.debt_creditor || !S.debt_creditor.active) return;
  
  const currentDebt = S.club_debt || 0;
  if (currentDebt <= 0) return;
  
  // Update principal to current debt if it's higher (new enforceable debt was added)
  // This ensures interest is calculated on the full amount owed
  if (currentDebt > (S.debt_creditor.principal || 0)) {
    S.debt_creditor.principal = currentDebt;
  }
  
  // Calculate interest on principal (which represents the debt owed to creditor)
  const principal = S.debt_creditor.principal || currentDebt;
  const interestRate = S.debt_creditor.interest_rate || 0.05;
  const interest = Math.floor(principal * interestRate);
  
  if (interest > 0) {
    S.club_debt = currentDebt + interest;
    S.debt_creditor.matches_since_sale = (S.debt_creditor.matches_since_sale || 0) + 1;
    
    // Log interest every match to make consequences visible
    log(`<strong>💰 Debt Interest:</strong> ${money(interest)} added to your debt (now ${money(S.club_debt)}). Interest accumulates at 5% per match.`);
  }
}

// Offer payment plan to player - ONLY 5 MATCHES
async function offerPaymentPlan(){
  // Ensure payment_plan object exists
  if (!S.payment_plan || typeof S.payment_plan !== 'object') {
    S.payment_plan = {
      active: false,
      total_amount: 0,
      remaining_amount: 0,
      matches_remaining: 0,
      matches_total: 0
    };
  }
  if (S.payment_plan.active) return true; // Already have a payment plan
  
  const totalDebt = S.club_debt || 0;
  const plan5Matches = Math.ceil(totalDebt / 5);
  
  const choice = await choose([
    {key: "plan5", label: `Accept 5-match payment plan (${money(plan5Matches)} per match)`},
    {key: "refuse", label: "Refuse payment plan", variant: "warn"}
  ], `The creditor offers you a payment plan to repay ${money(totalDebt)} over 5 matches.`);
  
  if (choice === "plan5") {
    S.payment_plan.active = true;
    S.payment_plan.total_amount = totalDebt;
    S.payment_plan.remaining_amount = totalDebt;
    S.payment_plan.matches_remaining = 5;
    S.payment_plan.matches_total = 5;
    log(`Payment plan accepted: ${money(plan5Matches)} per match for 5 matches.`);
    return true;
  } else {
    log(`You refuse the payment plan.`);
    S.reputation = Math.max(0, (S.reputation || 50) - 5);
    return false; // Payment plan refused
  }
}

// Process payment plan payments - MANDATORY
async function processPaymentPlan(){
  if (!S.payment_plan || !S.payment_plan.active) return;
  
  const paymentPerMatch = Math.ceil(S.payment_plan.total_amount / S.payment_plan.matches_total);
  const remaining = S.payment_plan.remaining_amount;
  
  log(`<strong>💰 Payment Plan Due:</strong> ${money(paymentPerMatch)} must be paid now.`);
  
  // Check if we can make the payment from club cash
  if (S.club_cash >= paymentPerMatch) {
    S.club_cash -= paymentPerMatch;
    S.payment_plan.remaining_amount = Math.max(0, remaining - paymentPerMatch);
    S.club_debt = Math.max(0, (S.club_debt || 0) - paymentPerMatch);
    S.payment_plan.matches_remaining = Math.max(0, (S.payment_plan.matches_remaining || 0) - 1);
    
    log(`Payment plan: Paid ${money(paymentPerMatch)}. ${S.payment_plan.matches_remaining} matches remaining.`);
    
    if (S.payment_plan.remaining_amount <= 0) {
      log(`<strong>✅ Payment plan complete!</strong> All debt cleared.`);
      S.payment_plan.active = false;
      S.debt_creditor.active = false;
      S.debt_creditor.principal = 0;
    }
  } else {
    // Can't make payment - IMMEDIATELY TRIGGER NUCLEAR OPTION
    log(`<strong>💀 PAYMENT PLAN DEFAULT:</strong> You don't have enough cash to make the payment (${money(S.club_cash || 0)} available, ${money(paymentPerMatch)} needed).`);
    log(`<strong>🚨 This payment is MANDATORY. You cannot afford the installment.</strong>`);
    S.payment_plan.active = false;
    
    // Can't afford installment = NUCLEAR OPTION
    log(`<strong>☢️ THE NUCLEAR OPTION IS YOUR ONLY CHOICE.</strong>`);
    await triggerNuclearOption();
  }
}

// Check if liquidation is needed
async function checkLiquidation(){
  const currentDebt = S.club_debt || 0;
  const clubCash = S.club_cash || 0;
  const personalCash = S.chairman_cash || 0;
  
  // If we can't cover necessary payments beyond debt, trigger liquidation
  const necessaryPayments = totalLineupWages() + (S.manager?.wage || 0);
  if (clubCash + personalCash < necessaryPayments && currentDebt > 0) {
    await attemptLiquidation();
  }
}

// Enforce debt garnishment - IMMEDIATELY liquidate everything when debt becomes enforceable
async function enforceDebtGarnishment(){
  const currentDebt = S.club_debt || 0;
  let totalRaised = 0;
  
  log(`<strong>🚨 DEBT GARNISHMENT:</strong> The court is immediately seizing all available assets...`);
  
  // 1. Deduct ALL personal cash
  const personalCash = S.chairman_cash || 0;
  if (personalCash > 0) {
    totalRaised += personalCash;
    S.chairman_cash = 0;
    log(`<strong>💰 GARNISHED:</strong> All personal cash seized: ${money(personalCash)}`);
  }
  
  // 2. Deduct ALL club cash
  const clubCash = S.club_cash || 0;
  if (clubCash > 0) {
    totalRaised += clubCash;
    S.club_cash = 0;
    log(`<strong>💰 GARNISHED:</strong> All club cash seized: ${money(clubCash)}`);
  }
  
  // 3. Sell ALL trophies
  if (S.inventory && Array.isArray(S.inventory.accolades) && S.inventory.accolades.length > 0) {
    const trophies = S.inventory.accolades.slice();
    let trophyValue = 0;
    for (const trophy of trophies) {
      trophyValue += (trophy.value || 0);
    }
    if (trophyValue > 0) {
      totalRaised += trophyValue;
      S.inventory.accolades = [];
      log(`<strong>🏆 GARNISHED:</strong> All trophies seized and sold: ${money(trophyValue)}`);
    }
  }
  
  // Apply raised funds to debt
  if (totalRaised > 0) {
    S.club_debt = Math.max(0, currentDebt - totalRaised);
    log(`<strong>Total garnished:</strong> ${money(totalRaised)}. Debt reduced from ${money(currentDebt)} to ${money(S.club_debt)}.`);
  } else {
    log(`<strong>No assets to garnish.</strong> You have nothing.`);
  }
}

// Attempt to liquidate assets to cover debt
async function attemptLiquidation(){
  const currentDebt = S.club_debt || 0;
  let totalRaised = 0;
  
  log(`<strong>🚨 LIQUIDATION:</strong> Attempting to raise funds to cover debts...`);
  
  // 1. Deduct all personal cash
  const personalCash = S.chairman_cash || 0;
  if (personalCash > 0) {
    totalRaised += personalCash;
    S.chairman_cash = 0;
    log(`Liquidated all personal cash: ${money(personalCash)}`);
  }
  
  // 2. Sell all trophies
  if (S.inventory && Array.isArray(S.inventory.accolades) && S.inventory.accolades.length > 0) {
    const trophies = S.inventory.accolades.slice();
    let trophyValue = 0;
    for (const trophy of trophies) {
      trophyValue += (trophy.value || 0);
    }
    if (trophyValue > 0) {
      totalRaised += trophyValue;
      S.inventory.accolades = [];
      log(`Liquidated all trophies: ${money(trophyValue)}`);
    }
  }
  
  // Apply raised funds to debt
  if (totalRaised > 0) {
    S.club_debt = Math.max(0, currentDebt - totalRaised);
    S.club_cash += totalRaised;
    log(`Total raised from liquidation: ${money(totalRaised)}. Debt reduced to ${money(S.club_debt)}.`);
  }
  
  // If still can't cover debt, trigger nuclear option
  if (S.club_debt > 0 && S.club_cash < S.club_debt) {
    await triggerNuclearOption();
  }
}

// Trigger nuclear option - sell club
async function triggerNuclearOption(){
  if (S.nuclear_option_used) {
    // Game ends if insolvent again after using nuclear option
    log(`<strong>💀 GAME OVER</strong>`);
    log(`You've become insolvent again after selling the club. There's no way back.`);
    S.game_over = true;
    S.game_over_reason = "Insolvency after nuclear option";
    return;
  }
  
  log(`<strong>☢️ NUCLEAR OPTION</strong>`);
  log(`Your club is insolvent. You must sell the club to survive.`);
  log(`This can only be done once. Choose carefully.`);
  
  // If insolvent due to unpaid transfers, automatically withdraw those players
  if (Array.isArray(S.unpaid_transfers) && S.unpaid_transfers.length > 0) {
    const unresolved = S.unpaid_transfers.filter(t => !t.resolved);
    if (unresolved.length > 0) {
      const totalAmount = unresolved.reduce((sum, t) => sum + (t.price || 0), 0);
      const playerList = unresolved.length === 1 
        ? unresolved[0].name 
        : unresolved.length === 2
        ? `${unresolved[0].name} and ${unresolved[1].name}`
        : unresolved.slice(0, -1).map(t => t.name).join(", ") + ` and ${unresolved[unresolved.length - 1].name}`;
      
      log(`<strong>Breaking News:</strong> ${playerList} ${unresolved.length > 1 ? 'have been' : 'has been'} automatically withdrawn due to unpaid transfer fees (club insolvency).`);
      
      // Remove players from squad
      if(S.squad) {
        unresolved.forEach(t => {
          S.squad = S.squad.filter(p => p.name !== t.name);
        });
      }
      
      // Reduce club debt (no longer owe transfer fees) but add legal costs
      const legalCosts = Math.floor(totalAmount * 0.15); // 15% legal costs
      S.debt_club = Math.max(0, (S.debt_club || 0) - totalAmount + legalCosts);
      S.club_debt = S.debt_club; // keep legacy key in sync
      
      log(`Your club debt is reduced by ${money(totalAmount)} (transfer fees no longer owed), but ${money(legalCosts)} in legal costs remain.`);
      
      // Mark transfers as resolved
      unresolved.forEach(t => t.resolved = true);
      
      // Remove from unpaid_transfers array
      S.unpaid_transfers = S.unpaid_transfers.filter(t => t.resolved !== true || !unresolved.some(u => (t.playerId || t.name) === (u.playerId || u.name)));
      
      // Clear any court-ordered debts related to these transfers
      if (Array.isArray(S.court_ordered_debts)) {
        S.court_ordered_debts = S.court_ordered_debts.filter(d => d.type !== 'transfer');
      }
      
      S.press_threats = (S.press_threats || 0) + 1;
      S.reputation = clamp((S.reputation || 50) - 5, 0, 100);
    }
  }
  
  // Apply variable point deduction for insolvency
  const insolvencyPoints = rnd(4, 10);
  const clubName = S.club_name || "Southampton FC";
  if (typeof ensureLeagueTableInit === 'function') {
    ensureLeagueTableInit();
  }
  if (typeof ensureTableTeam === 'function') {
    ensureTableTeam(clubName);
  }
  if (S.table && S.table[clubName]) {
    S.table[clubName].PTS = (S.table[clubName].PTS || 0) - insolvencyPoints; // Allow negative points
    S.points_deducted = (S.points_deducted || 0) + insolvencyPoints;
    log(`📊 ${clubName} receives a ${insolvencyPoints} point deduction for insolvency.`);
    // Update league table display
    if (typeof renderLeagueTablePanel === 'function') {
      renderLeagueTablePanel();
    }
  }
  
  const choice = await choose([
    {key: "mcdonalds", label: "Sell to McDonald's", variant: "warn"},
    {key: "portsmouth", label: "Sell to Portsmouth FC", variant: "warn"},
    {key: "cancel", label: "Cancel (game will end)"}
  ], `Who do you sell the club to?`);
  
  if (choice === "cancel") {
    log(`You refuse to sell. The game ends.`);
    S.game_over = true;
    S.game_over_reason = "Refused nuclear option";
    return;
  }
  
  S.nuclear_option_used = true;
  const cashInjection = 3000000 + Math.floor(Math.random() * 2000000); // 3-5mil
  S.club_cash += cashInjection;
  // Clear all debt when selling the club
  S.club_debt = 0;
  S.debt_club = 0;
  // Clear all unpaid transfers and court-ordered debts when selling the club
  if (Array.isArray(S.unpaid_transfers)) {
    S.unpaid_transfers = [];
  }
  if (Array.isArray(S.court_ordered_debts)) {
    S.court_ordered_debts = [];
  }
  // Clear unpaid transfer agents tracking
  if (S.unpaid_transfer_agents) {
    S.unpaid_transfer_agents = {};
  }
  
  if (choice === "mcdonalds") {
    await sellToMcDonalds();
  } else if (choice === "portsmouth") {
    await sellToPortsmouth();
  }
  
  log(`You receive ${money(cashInjection)} from the sale.`);
  updateHUD?.();
}

// Sell club to McDonald's
async function sellToMcDonalds(){
  S.club_sold_to = "mcdonalds";
  const oldClubName = S.club_name || "Southampton FC";
  const newClubName = "McDonalds FC";
  S.stadium_name = "Burger Stadium";
  
  log(`<strong>🍔 BREAKING NEWS:</strong> ${newClubName} has been sold to McDonald's!`);
  log(`The stadium is renamed to "${S.stadium_name}".`);
  log(`All existing players celebrate by eating burgers and become obese.`);
  
  // Ensure league table is initialized
  if (typeof ensureLeagueTableInit === 'function') {
    ensureLeagueTableInit();
  }
  
  // Use unified rename system
  renameTeam(oldClubName, newClubName, { 
    isPlayerClub: true,  // This is the player's club
    updateRival: false   // Don't update rival
  });
  
  const tableEntry = S.table[newClubName];
  if (tableEntry && tableEntry.P > 0) {
    log(`📊 ${newClubName} inherits ${oldClubName}'s league standing (${tableEntry.PTS} points from ${tableEntry.P} games).`);
  }
  
  // Make all existing players obese
  if (Array.isArray(S.squad)) {
    for (const player of S.squad) {
      // Store original rating if not already stored
      if (!player.original_rating) {
        player.original_rating = player.rating || 50;
      }
      player.rating = Math.max(0, Math.min(10, Math.floor(Math.random() * 11))); // 0-10 rating
      player.obese = true;
    }
  }
  
  // Recalculate team rating
  if (typeof updateTeamRating === 'function') updateTeamRating();
  
  log(`Your team's ratings have plummeted. Players can't be sold for much money.`);
  log(`New signings will be normal, but existing players remain affected.`);
  log(`<em>Hint: There might be a way to cure this...</em>`);
}

// Sell club to Portsmouth
async function sellToPortsmouth(){
  S.club_sold_to = "portsmouth";
  const oldClubName = S.club_name || "Southampton FC";
  const newClubName = "Portsmouth FC 2";
  S.stadium_name = "Fratton Park: The Sequel";
  
  log(`<strong>⚓ BREAKING NEWS:</strong> The club has been sold to Portsmouth FC!`);
  log(`The club is renamed to "${newClubName}" and the stadium to "${S.stadium_name}".`);
  
  // Ensure league table is initialized
  if (typeof ensureLeagueTableInit === 'function') {
    ensureLeagueTableInit();
  }
  
  // Use unified rename system
  renameTeam(oldClubName, newClubName, { 
    isPlayerClub: true,  // This is the player's club
    updateRival: false   // Don't update rival
  });
  
  const tableEntry = S.table[newClubName];
  if (tableEntry && tableEntry.P > 0) {
    log(`📊 ${newClubName} inherits ${oldClubName}'s league standing (${tableEntry.PTS} points from ${tableEntry.P} games).`);
  }
  
  // Fan morale drops to 0
  S.fan_morale = 0;
  log(`Fan morale has dropped to 0%. Scathing news reports flood in.`);
  
  // Delmor Krunchem sends mocking text
  if (S.rival && S.rival.inbox) {
    S.rival.inbox.push({
      from: "Delmor Krunchem",
      subject: "The Most Smug Text Ever",
      body: `HAHAHAHAHA! You absolute fool! You had to sell your club to US! This is the most delicious moment of my life. You're a laughing stock. Portsmouth FC 2? More like Portsmouth FC's embarrassing little brother! Enjoy your new identity, you pathetic excuse for a chairman.`,
      read: false,
      timestamp: Date.now()
    });
    log(`<strong>📱 Text from Delmor Krunchem:</strong> "HAHAHAHAHA! You absolute fool! You had to sell your club to US! This is the most delicious moment of my life..."`);
  }
  
  log(`You can only rebuild fan morale through results.`);
}

// ========== UNIFIED TEAM RENAME SYSTEM ==========
// This function handles ALL team rename scenarios consistently
// (player club sales, nuclear strikes, Season 4 takeovers, etc.)
function renameTeam(oldName, newName, options = {}) {
  const {
    updateRival = false,  // Update S.rival.club if this is the rival team
    isPlayerClub = false  // Is this the player's club being renamed?
  } = options;
  
  
  // Track the rename globally
  if (!S.team_renames) S.team_renames = {};
  S.team_renames[oldName] = newName;
  
  // Also track in Season 4 system if active (for backwards compatibility)
  if (S.season >= 4 && S.season4) {
    if (!S.season4.clubs_taken_over) S.season4.clubs_taken_over = {};
    S.season4.clubs_taken_over[oldName] = newName;
  }
  
  // 1. Update S.opponents array
  if (S.opponents && Array.isArray(S.opponents)) {
    for (let i = 0; i < S.opponents.length; i++) {
      if (S.opponents[i] === oldName) {
        S.opponents[i] = newName;
      }
    }
  }
  
  // 2. Update ALL fixtures/rounds
  if (S.rounds && Array.isArray(S.rounds)) {
    let fixturesUpdated = 0;
    for (let roundIndex = 0; roundIndex < S.rounds.length; roundIndex++) {
      const round = S.rounds[roundIndex];
      if (Array.isArray(round)) {
        for (let matchIndex = 0; matchIndex < round.length; matchIndex++) {
          const match = round[matchIndex];
          if (Array.isArray(match) && match.length >= 2) {
            if (match[0] === oldName) {
              match[0] = newName;
              fixturesUpdated++;
            }
            if (match[1] === oldName) {
              match[1] = newName;
              fixturesUpdated++;
            }
          }
        }
      }
    }
  }
  
  // 3. Update league table - new team inherits ALL data from old team
  if (S.table) {
    if (S.table[oldName]) {
      const oldEntry = S.table[oldName];
      // Copy all properties to new name (including games played P, points, etc.)
      S.table[newName] = {
        P: oldEntry.P || 0,   // Games played - CRITICAL
        W: oldEntry.W || 0,
        D: oldEntry.D || 0,
        L: oldEntry.L || 0,
        GF: oldEntry.GF || 0,
        GA: oldEntry.GA || 0,
        GD: (oldEntry.GD !== undefined ? oldEntry.GD : ((oldEntry.GF || 0) - (oldEntry.GA || 0))),
        PTS: oldEntry.PTS || 0  // Points - CRITICAL
      };
      
      // Delete old entry - CRITICAL
      delete S.table[oldName];
    } else if (!S.table[newName]) {
      // If no table entry exists, create one with current games played
      const clubName = (typeof teamKeyClub === 'function') ? teamKeyClub() : (S.club_name || "Southampton FC");
      const targetGames = (S.table[clubName] && S.table[clubName].P) ? S.table[clubName].P : (S.matches_played || 0);
      S.table[newName] = { P: targetGames, W:0, D:0, L:0, GF:0, GA:0, GD:0, PTS:0 };
    }
  }
  
  // 4. Update table_order if it exists
  if (S.table_order && Array.isArray(S.table_order)) {
    for (let i = 0; i < S.table_order.length; i++) {
      if (S.table_order[i] === oldName) {
        S.table_order[i] = newName;
      }
    }
  }
  
  // 5. Update rivalry system if needed
  if (updateRival && S.rival) {
    const oldRivalClub = S.rival.club;
    S.rival.club = newName;
  }
  
  // 6. If this is the player's club, update S.club_name
  if (isPlayerClub) {
    S.club_name = newName;
  }
  
  // 7. Update league table display
  if (typeof renderLeagueTablePanel === 'function') {
    renderLeagueTablePanel();
  }
  
}

// Post-load validation to ensure all renamed teams are consistent
// Call this after loading a saved game to fix any inconsistencies
function validateTeamRenames() {
  if (!S.team_renames || typeof S.team_renames !== 'object') {
    S.team_renames = {};
  }
  
  
  // CRITICAL: Check if player's club was renamed and fix duplication
  const playerClubName = S.club_name || "Southampton FC";
  const defaultClubName = "Southampton FC";
  
  // If player's club has a different name, it means it was renamed
  if (playerClubName !== defaultClubName) {
    
    // Add to team_renames if not already there
    if (!S.team_renames[defaultClubName]) {
      S.team_renames[defaultClubName] = playerClubName;
    }
    
    // CRITICAL: Remove old club name from opponents array
    if (S.opponents && Array.isArray(S.opponents)) {
      const oldIndex = S.opponents.indexOf(defaultClubName);
      if (oldIndex !== -1) {
        S.opponents.splice(oldIndex, 1);
      }
    }
    
    // CRITICAL: Remove old club name from league table
    if (S.table && S.table[defaultClubName]) {
      // Transfer data to new name if new name doesn't have data
      if (!S.table[playerClubName] || S.table[playerClubName].P === 0) {
        S.table[playerClubName] = {...S.table[defaultClubName]};
      }
      delete S.table[defaultClubName];
    }
    
    // CRITICAL: Remove old club name from fixtures
    if (S.rounds && Array.isArray(S.rounds)) {
      let fixedCount = 0;
      for (let round of S.rounds) {
        if (Array.isArray(round)) {
          for (let match of round) {
            if (Array.isArray(match) && match.length >= 2) {
              if (match[0] === defaultClubName) {
                match[0] = playerClubName;
                fixedCount++;
              }
              if (match[1] === defaultClubName) {
                match[1] = playerClubName;
                fixedCount++;
              }
            }
          }
        }
      }
    }
  }
  
  const renames = Object.entries(S.team_renames);
  
  if (renames.length === 0) {
    return;
  }
  
  
  // Apply each rename to ensure consistency
  for (const [oldName, newName] of renames) {
    
    // 1. Fix opponents array - remove old names completely
    if (S.opponents && Array.isArray(S.opponents)) {
      let removed = 0;
      for (let i = S.opponents.length - 1; i >= 0; i--) {
        if (S.opponents[i] === oldName) {
          // Check if newName is already in opponents
          if (!S.opponents.includes(newName)) {
            S.opponents[i] = newName;
          } else {
            // newName already exists, remove the duplicate
            S.opponents.splice(i, 1);
            removed++;
          }
        }
      }
    }
    
    // 2. Fix fixtures/rounds
    if (S.rounds && Array.isArray(S.rounds)) {
      let fixedCount = 0;
      for (let round of S.rounds) {
        if (Array.isArray(round)) {
          for (let match of round) {
            if (Array.isArray(match) && match.length >= 2) {
              if (match[0] === oldName) {
                match[0] = newName;
                fixedCount++;
              }
              if (match[1] === oldName) {
                match[1] = newName;
                fixedCount++;
              }
            }
          }
        }
      }
    }
    
    // 3. Fix league table - ensure old name is gone, new name has the data
    if (S.table) {
      if (S.table[oldName] && !S.table[newName]) {
        // Old name exists but new name doesn't - transfer data
        S.table[newName] = {...S.table[oldName]};
        delete S.table[oldName];
      } else if (S.table[oldName] && S.table[newName]) {
        // Both exist - keep the one with more games played
        if (S.table[oldName].P > S.table[newName].P) {
          S.table[newName] = {...S.table[oldName]};
        }
        delete S.table[oldName];
      }
    }
    
    // 4. Fix table_order
    if (S.table_order && Array.isArray(S.table_order)) {
      for (let i = 0; i < S.table_order.length; i++) {
        if (S.table_order[i] === oldName) {
          S.table_order[i] = newName;
        }
      }
    }
  }
  
}

// Helper function to get club name (with renaming support)
function getClubName(){
  return S.club_name || "Southampton FC";
}

// Helper function to get stadium name (with renaming support)
function getStadiumName(){
  return S.stadium_name || "St Mary's";
}


// ---------- match engine ----------
function poisson(lam){const L = Math.exp(-lam);let k=0,p=1;do{k++;p*=Math.random();}while(p>L);return k-1;}
function expectedGoals(our,opp){const delta=our-opp;let ourXG=1.1+(delta/50);let oppXG=1.1-(delta/50);
  if(S.rnd_perks && S.rnd_perks.clone) ourXG+=0.1; if(S.rnd_perks && S.rnd_perks.spy) ourXG+=0.15;
  ourXG=clamp(ourXG,0.2,3.7); oppXG=clamp(oppXG,0.2,3.7); return [ourXG,oppXG];}
function teamStrength(){
  // Use actual player-based strength instead of hardcoded base
  const our5 = getOurSelectedFive();
  if (our5 && our5.length > 0) {
    return computeTeamStrength(our5);
  }
  // Fallback to old system only if no players available
  const base=39 + (S.morale/20) - (S.manager_fires*0.5); // Use Southampton's actual base quality (39)
  const stars=(S.messi_signed?10:0)+(S.ronaldo_signed?7:0)+((S.rnd_perks && S.rnd_perks.facility)?1:0); 
  return Math.floor(base+stars);
}

// Goal flash effect function
function addGoalFlashEffect() {
  const feed = document.getElementById('feed');
  if (feed) {
    feed.classList.add('goal-flash');
    setTimeout(() => {
      feed.classList.remove('goal-flash');
    }, 500);
  }
}


// Commentary generation functions (moved to global scope for reuse)
function generateGoalCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLateGoal = gameTime > 80;
  const isEarlyGoal = gameTime < 20;
  
  // SPECIAL CASE: Portsmouth replacement team vs our drug-enhanced players
  try {
    if (event && event.who === 'HOME') {
      const oppNameLower = (S && S.matchContext && S.matchContext.team)
        ? String(S.matchContext.team).toLowerCase()
        : (oppName || '').toLowerCase();
      const isPortsmouthMatch =
        oppNameLower.includes('portsmouth') || oppNameLower.includes('pompey');
      const isPortsmouthReplacementTeam =
        !!(S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));
      
      const ourSquad = Array.isArray(S?.squad) ? S.squad : [];
      const ourCocaineUsers = ourSquad.filter(p => p && p.on_cocaine_this_match);
      const ourHGHUsers = ourSquad.filter(p => p && p.on_hgh_this_match);
      const hasDrugs = ourCocaineUsers.length > 0 || ourHGHUsers.length > 0;
      
      if (isPortsmouthMatch && isPortsmouthReplacementTeam && hasDrugs) {
        const usingCoke = ourCocaineUsers.length > 0;
        const enhancer = usingCoke ? 'cocaine' : 'HGH';
        const enhancerAdj = usingCoke ? 'cocaine-fueled' : 'HGH-enhanced';
        
        const drugCommentary = [
          `GOAL! ${event.scorer} scores! The replacement team are cowering in fear from the ${enhancerAdj} Southampton players!`,
          `GOAL! ${event.scorer} scores! The physical decimation is wince-inducing - the replacement team are all crying as they're torn apart!`,
          `GOAL! ${event.scorer} scores! The replacement team can't handle the ${enhancer}-enhanced aggression - they're cowering in fear!`,
          `GOAL! ${event.scorer} scores! This is brutal - the replacement team are all crying as Southampton's ${enhancer}-enhanced players destroy them!`,
          `GOAL! ${event.scorer} scores! The replacement team are cowering in fear - they can't handle this level of physical dominance!`,
          `GOAL! ${event.scorer} scores! The replacement team are all crying - this is a complete physical decimation!`,
          `GOAL! ${event.scorer} again! The merciless Southampton players are hunting the kids in packs – the replacement XI are hiding in their own box, sobbing.`,
          `GOAL! ${event.scorer} lashes it in! The merciless Southampton front line are brutalising the replacement side; half of them look ready to burst into tears.`,
          `GOAL! ${event.scorer} makes it another one! The replacement team are literally hiding behind each other as the merciless Southampton press swarms them.`,
          `GOAL! ${event.scorer} thumps it home! The replacement side are being physically brutalised here – shoulders slumped, some of them in tears as Southampton keep scoring.`,
          `GOAL! ${event.scorer} scores yet again! The merciless Southampton players are snapping into every challenge; the replacement kids are crying and begging for the whistle.`
        ];
        
        let line = pick(drugCommentary);
        if (event.assister) {
          line += ` (Assist: ${event.assister})`;
        }
        return line;
      }
    }
  } catch (_e) {
    // Fall back to standard goal commentary below
  }
  
  // Contextual goal types based on timing and situation
  const goalTypes = [
    'GOAL!',
    'GOAL!',
    'WHAT A GOAL!',
    'BRILLIANT GOAL!',
    'STUNNING GOAL!',
    'MAGNIFICENT GOAL!',
    'SPECTACULAR GOAL!',
    'INCREDIBLE GOAL!',
    'FANTASTIC GOAL!',
    'SENSATIONAL GOAL!',
    'OUTSTANDING GOAL!',
    'SUPERB GOAL!',
    'MAGICAL GOAL!',
    'WORLD-CLASS GOAL!',
    'BREATHTAKING GOAL!',
    'PHENOMENAL GOAL!',
    'EXTRAORDINARY GOAL!',
    'REMARKABLE GOAL!',
    'EXCEPTIONAL GOAL!',
    'MASTERFUL GOAL!'
  ];
  
  // Add late goal emphasis
  if (isLateGoal) {
    goalTypes.push('LATE GOAL!', 'CRUCIAL GOAL!', 'VITAL GOAL!', 'DECISIVE GOAL!', 'DRAMATIC GOAL!');
  }
  
  // Add early goal emphasis
  if (isEarlyGoal) {
    goalTypes.push('EARLY GOAL!', 'QUICK START!', 'LIGHTNING GOAL!');
  }
  
  const goalDescriptions = [
    'finds the back of the net with precision',
    'scores with a clinical finish',
    'strikes it home with authority',
    'smashes it in from close range',
    'curls it beautifully into the corner',
    'drills it low past the keeper',
    'heads it in with power',
    'volleys it home spectacularly',
    'places it perfectly beyond reach',
    'blasts it past the helpless keeper',
    'sends it into the top corner',
    'slots it home with composure',
    'powers it into the net',
    'taps it in from the goal line',
    'lofts it over the advancing keeper',
    'bends it into the far corner',
    'rifles it home with venom',
    'sweeps it into the net',
    'chips the keeper with finesse',
    'smashes it into the roof of the net',
    'caresses it into the bottom corner',
    'thunders it home with force',
    'dinks it over the keeper',
    'lashes it into the net',
    'strokes it home with style',
    'hammers it past the keeper',
    'guides it into the corner',
    'punches it home with determination',
    'flicks it past the keeper',
    'drives it low and hard',
    'sends it soaring into the net',
    'tucks it away neatly',
    'fires it into the top bin',
    'squeezes it past the keeper',
    'rocks the net with power'
  ];
  
  // Add contextual descriptions
  const contextualPhrases = [
    'The crowd erupts as',
    'What a moment for',
    'The stadium goes wild as',
    'Incredible scenes as',
    'The fans are on their feet as',
    'What a strike from',
    'The keeper had no chance as',
    'A moment of magic from',
    'Pure class from',
    'The perfect finish from'
  ];
  
  const goalType = pick(goalTypes);
  const description = pick(goalDescriptions);
  const contextualPhrase = Math.random() < 0.3 ? pick(contextualPhrases) + ' ' : '';
  
  if (event.who === 'HOME') {
    if (event.assister) {
      return `${goalType} ${contextualPhrase}${event.scorer} ${description}! (Assist: ${event.assister})`;
    } else {
      return `${goalType} ${contextualPhrase}${event.scorer} ${description}!`;
    }
  } else {
    if (event.assister) {
      return `${goalType} ${contextualPhrase}${event.scorer} ${description} for ${oppName}! (Assist: ${event.assister})`;
    } else {
      return `${goalType} ${contextualPhrase}${event.scorer} ${description} for ${oppName}!`;
    }
  }
}

function generateShotCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isCloseMiss = Math.random() < 0.3;
  const isGoodSave = Math.random() < 0.2;
  
  // SPECIAL CASE: Portsmouth replacement team vs our drug-enhanced players – constant fear
  try {
    if (event && event.who === 'HOME') {
      const oppNameLower = (S && S.matchContext && S.matchContext.team)
        ? String(S.matchContext.team).toLowerCase()
        : (oppName || '').toLowerCase();
      const isPortsmouthMatch =
        oppNameLower.includes('portsmouth') || oppNameLower.includes('pompey');
      const isPortsmouthReplacementTeam =
        !!(S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));
      
      const ourSquad = Array.isArray(S?.squad) ? S.squad : [];
      const ourCocaineUsers = ourSquad.filter(p => p && p.on_cocaine_this_match);
      const ourHGHUsers = ourSquad.filter(p => p && p.on_hgh_this_match);
      const hasDrugs = ourCocaineUsers.length > 0 || ourHGHUsers.length > 0;
      
      if (isPortsmouthMatch && isPortsmouthReplacementTeam && hasDrugs) {
        const enhancerAdj =
          ourCocaineUsers.length > 0 ? 'cocaine-fuelled' : 'HGH-enhanced';
        const fearLines = [
          `${event.player || 'A Southampton player'} lashes one in anger—the replacement kids flinch every time your ${enhancerAdj} side goes forward.`,
          `${event.player || 'A Southampton player'} pulls the trigger and the replacement team visibly recoil from the ${enhancerAdj} aggression.`,
          `${event.player || 'A Southampton player'} gets a sight of goal; the terrified replacement defenders back away rather than tackle.`,
          `${event.player || 'A Southampton player'} shuffles into space and the replacement team just stare, frozen with fear.`,
          `${event.player || 'A Southampton player'} drifts inside; the under-12s look like they want to go home.`,
          `${event.player || 'A Southampton player'} takes on the shot while the replacement back line cower on the edge of the box.`,
          `${event.player || 'A Southampton player'} rifles one towards goal; the merciless Southampton crowd roar as the replacement side duck out of the way.`,
          `${event.player || 'A Southampton player'} shapes to shoot and three of the replacement kids literally hide behind each other.`,
          `${event.player || 'A Southampton player'} lets fly from distance; the terrified replacement keeper looks like he’s about to cry.`,
          `${event.player || 'A Southampton player'} jogs forward casually and the replacement XI retreat into their own six-yard box, desperate to avoid another hit.`
        ];
        return pick(fearLines);
      }
    }
  } catch (_e) {
    // Fall back to standard / drug‑dependency logic below
  }
  
  // Different types of shot outcomes
  const closeMissDescriptions = [
    'sends it just past the post',
    'curls it just wide of the far post',
    'drills it inches wide of the target',
    'bends it just past the upright',
    'fires it narrowly wide',
    'sends it just over the bar',
    'curls it just over the crossbar',
    'drills it just past the near post',
    'bends it just wide of the goal',
    'fires it just past the keeper\'s outstretched hand'
  ];
  
  const goodSaveDescriptions = [
    'drills it straight at the keeper who makes a fine save',
    'fires it at the keeper who parries it away',
    'sends it towards goal but the keeper tips it over',
    'strikes it well but the keeper gets down to save',
    'fires it low but the keeper makes a smart stop',
    'sends it towards the corner but the keeper pushes it wide',
    'strikes it with power but the keeper makes a brilliant save',
    'fires it at goal but the keeper makes a crucial stop',
    'sends it towards the top corner but the keeper tips it over',
    'strikes it well but the keeper makes a diving save'
  ];
  
  const wideShotDescriptions = [
    'shoots wide of the post',
    'fires over the crossbar',
    'drags his shot wide',
    'blazes it over',
    'slices it wide',
    'pulls it wide of the target',
    'sends it high and wide',
    'skies it over the bar',
    'sends it into the side netting',
    'drills it wide of the far post',
    'pulls it wide of the near post',
    'fires it into the crowd',
    'sends it well wide',
    'blazes it over from close range',
    'sends it way over the bar',
    'fires it miles wide',
    'skies it high into the stands',
    'sends it into the car park',
    'blazes it over from a good position',
    'sends it well over the crossbar'
  ];
  
  const poorShotDescriptions = [
    'sends a weak shot straight at the keeper',
    'fires a tame effort at goal',
    'sends a harmless shot towards the keeper',
    'strikes it weakly straight at the keeper',
    'fires a poor shot that\'s easily gathered',
    'sends a feeble effort at goal',
    'strikes it tamely at the keeper',
    'fires a weak shot that\'s comfortably saved',
    'sends a soft shot straight at the keeper',
    'strikes it weakly and the keeper gathers easily'
  ];
  
  // SPECIAL CASE: drug-dependent players without coke – lazy, disinterested shots
  try {
    if (event && event.who === 'HOME' && event.player && Array.isArray(S?.squad)) {
      const p = S.squad.find(pl =>
        pl && pl.name === event.player &&
        pl.cocaine_dependency_risk && pl.cocaine_dependency_risk > 0 &&
        !pl.on_cocaine_this_match
      );
      if (p) {
        const lazyLines = [
          `${event.player} can't be bothered to shoot properly...`,
          `${event.player} looks disinterested as he weakly shoots wide.`,
          `${event.player} seems completely unmotivated. That shot was pathetic.`,
          `${event.player} can't be bothered to play. He just goes through the motions.`
        ];
        return pick(lazyLines);
      }
    }
  } catch (_e) {
    // If anything goes wrong, fall back to standard logic below
  }
  
  // Choose description based on context
  let description;
  if (isCloseMiss) {
    description = pick(closeMissDescriptions);
  } else if (isGoodSave) {
    description = pick(goodSaveDescriptions);
  } else if (Math.random() < 0.2) {
    description = pick(poorShotDescriptions);
  } else {
    description = pick(wideShotDescriptions);
  }
  
  // Add contextual phrases
  const contextualPhrases = [
    'What a chance for',
    'A great opportunity for',
    'A golden chance for',
    'A clear sight of goal for',
    'A promising position for',
    'A good opening for',
    'A decent chance for',
    'A half-chance for',
    'A speculative effort from',
    'A hopeful shot from'
  ];
  
  const contextualPhrase = Math.random() < 0.25 ? pick(contextualPhrases) + ' ' : '';
  
  if (event.who === 'HOME') {
    return event.player ? `${contextualPhrase}${event.player} ${description}!` : `${contextualPhrase}Southampton ${description}!`;
  } else {
    return event.player ? `${contextualPhrase}${event.player} ${description}!` : `${contextualPhrase}${oppName} ${description}!`;
  }
}

function generateCornerCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLateCorner = gameTime > 80;
  
  const cornerDescriptions = [
    'takes the corner',
    'delivers the corner',
    'swings in the corner',
    'whips in the corner',
    'floats in the corner',
    'drives in the corner',
    'curls in the corner',
    'lofts in the corner',
    'fires in the corner',
    'sends in the corner',
    'strikes the corner',
    'hits the corner',
    'delivers a dangerous corner',
    'swings in a teasing corner',
    'whips in a testing corner',
    'floats in a hanging corner',
    'drives in a low corner',
    'curls in a wicked corner',
    'lofts in a deep corner',
    'fires in a powerful corner'
  ];
  
  const cornerOutcomes = [
    'The ball is cleared away',
    'The corner is headed clear',
    'The ball is cleared to safety',
    'The corner is dealt with',
    'The ball is cleared by the defense',
    'The corner comes to nothing',
    'The ball is cleared easily',
    'The corner is cleared by the first man',
    'The ball is headed away',
    'The corner is cleared to the edge of the box',
    'The ball is cleared upfield',
    'The corner is cleared by the goalkeeper',
    'The ball is cleared by the near post',
    'The corner is cleared by the far post',
    'The ball is cleared by the center-back'
  ];

  // SPECIAL CASE: Portsmouth replacement team vs our drug-enhanced players – bullied at set pieces
  try {
    if (event && event.who === 'HOME') {
      const oppNameLower = (S && S.matchContext && S.matchContext.team)
        ? String(S.matchContext.team).toLowerCase()
        : (oppName || '').toLowerCase();
      const isPortsmouthMatch =
        oppNameLower.includes('portsmouth') || oppNameLower.includes('pompey');
      const isPortsmouthReplacementTeam =
        !!(S && (S.portsmouth_under12s_team || S.portsmouth_bus_destroyed));
      
      const ourSquad = Array.isArray(S?.squad) ? S.squad : [];
      const ourCocaineUsers = ourSquad.filter(p => p && p.on_cocaine_this_match);
      const ourHGHUsers = ourSquad.filter(p => p && p.on_hgh_this_match);
      const hasDrugs = ourCocaineUsers.length > 0 || ourHGHUsers.length > 0;
      
      if (isPortsmouthMatch && isPortsmouthReplacementTeam && hasDrugs) {
        const enhancerAdj =
          ourCocaineUsers.length > 0 ? 'cocaine-fuelled' : 'HGH-enhanced';
        const bullyLines = [
          `Corner to Southampton—the ${enhancerAdj} giants crowd the six-yard box while the replacement kids look absolutely terrified.`,
          `Corner to Southampton—the under-12s cling to each other on the goal line as your ${enhancerAdj} lads loom over them.`,
          `Corner to Southampton—the replacement defence look like schoolchildren facing grown men; they don't want any part of this.`,
          `Corner to Southampton—the terrified replacement keeper just waves vaguely at his defenders to deal with it.`,
          `Corner to Southampton—the kids marking in the box are in tears as they try to wrestle with your ${enhancerAdj} brutes.`,
          `Corner to Southampton—the replacement back line shuffle away from the melee, clearly scared of contact.`
        ];
        return pick(bullyLines);
      }
    }
  } catch (_e) {
    // Ignore and fall back to drug‑dependency / normal behaviour
  }
  
  // SPECIAL CASE: drug-dependent players without coke – lazy, disinterested corners
  try {
    if (event && event.who === 'HOME' && event.player && Array.isArray(S?.squad)) {
      const p = S.squad.find(pl =>
        pl && pl.name === event.player &&
        pl.cocaine_dependency_risk && pl.cocaine_dependency_risk > 0 &&
        !pl.on_cocaine_this_match
      );
      if (p) {
        const lazyLines = [
          `Corner to Southampton—${event.player} can't be bothered to take it properly.`,
          `${event.player} looks completely disinterested as he ambles over to take the corner.`,
          `Corner to Southampton—${event.player} can't be bothered to play.`,
          `${event.player} trots over lazily and scuffs the corner. Total disinterest.`
        ];
        return pick(lazyLines);
      }
    }
  } catch (_e) {
    // Ignore and fall back to normal behaviour
  }
  
  const description = pick(cornerDescriptions);
  const outcome = Math.random() < 0.4 ? ' ' + pick(cornerOutcomes) + '.' : '';
  
  // Add contextual phrases for late corners
  const lateCornerPhrases = [
    'A crucial corner in the dying minutes',
    'A vital corner in the final stages',
    'An important corner late in the game',
    'A key corner in the closing stages'
  ];
  
  const contextualPhrase = isLateCorner && Math.random() < 0.3 ? pick(lateCornerPhrases) + '—' : '';
  
  if (event.who === 'HOME') {
    return event.player ? `${contextualPhrase}Corner to Southampton—${event.player} ${description}.${outcome}` : `${contextualPhrase}Corner to Southampton…${outcome}`;
  } else {
    return event.player ? `${contextualPhrase}Corner to ${oppName}—${event.player} ${description}.${outcome}` : `${contextualPhrase}Corner to ${oppName}…${outcome}`;
  }
}

function generateFoulCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLateFoul = gameTime > 80;
  const isEarlyFoul = gameTime < 20;
  
  // Different severity levels of fouls
  const minorFoulDescriptions = [
    'commits a minor foul',
    'makes a slight infringement',
    'commits a soft foul',
    'makes a gentle challenge',
    'commits a light foul',
    'makes a minor infringement',
    'commits a small foul',
    'makes a slight foul',
    'commits a gentle foul',
    'makes a soft challenge'
  ];
  
  const standardFoulDescriptions = [
    'commits a foul',
    'brings down his opponent',
    'trips the attacker',
    'makes a late challenge',
    'clatters into the player',
    'pulls back the runner',
    'blocks the run illegally',
    'takes down the player',
    'brings down the attacker',
    'fouls the player',
    'brings him down',
    'takes him out',
    'clips his heels',
    'brings down the runner',
    'makes a cynical challenge',
    'takes a swipe at the player',
    'blocks the player illegally',
    'impedes the runner',
    'holds back the attacker',
    'tugs at the player\'s shirt'
  ];
  
  const seriousFoulDescriptions = [
    'makes a dangerous tackle',
    'slides in recklessly',
    'makes a reckless challenge',
    'commits a serious foul',
    'makes a dangerous challenge',
    'slides in dangerously',
    'makes a wild tackle',
    'commits a reckless foul',
    'makes a dangerous slide',
    'commits a serious challenge',
    'makes a brutal tackle',
    'slides in with force',
    'makes a heavy challenge',
    'commits a violent foul',
    'makes a dangerous slide tackle'
  ];
  
  // Choose foul severity
  let description;
  const foulSeverity = Math.random();
  if (foulSeverity < 0.2) {
    description = pick(minorFoulDescriptions);
  } else if (foulSeverity < 0.8) {
    description = pick(standardFoulDescriptions);
  } else {
    description = pick(seriousFoulDescriptions);
  }
  
  // Add contextual phrases
  const contextualPhrases = [
    'A needless foul from',
    'A careless challenge from',
    'A silly foul from',
    'A reckless challenge from',
    'A dangerous tackle from',
    'A cynical foul from',
    'A professional foul from',
    'A tactical foul from',
    'A desperate challenge from',
    'A frustrated foul from'
  ];
  
  const contextualPhrase = Math.random() < 0.3 ? pick(contextualPhrases) + ' ' : '';
  
  // Add timing context
  let timingContext = '';
  if (isLateFoul && Math.random() < 0.4) {
    timingContext = 'Late in the game, ';
  } else if (isEarlyFoul && Math.random() < 0.3) {
    timingContext = 'Early in the match, ';
  }
  
  if (event.who === 'HOME') {
    return event.player ? `${timingContext}${contextualPhrase}${event.player} ${description}—free kick to ${oppName}.` : `${timingContext}${contextualPhrase}Southampton ${description}—free kick to ${oppName}.`;
  } else {
    return event.player ? `${timingContext}${contextualPhrase}${event.player} ${description}—free kick to Southampton.` : `${timingContext}${contextualPhrase}${oppName} ${description}—free kick to Southampton.`;
  }
}

function generateYellowCardCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLateCard = gameTime > 80;
  const isEarlyCard = gameTime < 20;
  
  const cardDescriptions = [
    'receives a yellow card',
    'goes into the book',
    'is cautioned',
    'gets a booking',
    'sees yellow',
    'is shown a yellow card',
    'picks up a yellow card',
    'is booked',
    'gets a caution',
    'is shown yellow',
    'receives a booking',
    'goes into the referee\'s book',
    'is cautioned by the referee',
    'gets his name taken',
    'is shown a yellow'
  ];
  
  const description = pick(cardDescriptions);
  
  // Add contextual phrases
  const contextualPhrases = [
    'A needless booking for',
    'A careless challenge from',
    'A silly foul from',
    'A reckless challenge from',
    'A dangerous tackle from',
    'A cynical foul from',
    'A professional foul from',
    'A tactical foul from',
    'A desperate challenge from',
    'A frustrated foul from',
    'A late challenge from',
    'A wild tackle from'
  ];
  
  const contextualPhrase = Math.random() < 0.3 ? pick(contextualPhrases) + ' ' : '';
  
  // Add timing context
  let timingContext = '';
  if (isLateCard && Math.random() < 0.4) {
    timingContext = 'Late in the game, ';
  } else if (isEarlyCard && Math.random() < 0.3) {
    timingContext = 'Early in the match, ';
  }
  
  if (event.who === 'HOME') {
    return event.player ? `${timingContext}${contextualPhrase}${event.player} ${description}!` : `${timingContext}${contextualPhrase}Southampton ${description}!`;
  } else {
    return event.player ? `${timingContext}${contextualPhrase}${event.player} ${description}!` : `${timingContext}${contextualPhrase}${oppName} ${description}!`;
  }
}

function generateDodgyPenaltyCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const playerName = event.player || 'Unknown Player';
  const teamName = event.team || 'Unknown Team';
  
  const dodgyPenaltyLines = [
    `PENALTY! The referee points to the spot for ${teamName}! That's... questionable.`,
    `The referee gives ${teamName} a penalty! I'm not sure what he saw there.`,
    `PENALTY to ${teamName}! The referee's decision is met with disbelief from the crowd.`,
    `The referee awards a penalty to ${teamName}! That's a very generous interpretation.`,
    `PENALTY! ${playerName} goes down and the referee immediately points to the spot. Very soft.`,
    `The referee gives ${teamName} a penalty! The contact was minimal at best.`,
    `PENALTY to ${teamName}! The referee seems to have seen something nobody else did.`,
    `The referee points to the spot! ${teamName} get a penalty for what looked like a dive.`
  ];
  
  return pick(dodgyPenaltyLines);
}

function generateDodgyRedCardCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const playerName = event.player || 'Unknown Player';
  const teamName = event.team || 'Unknown Team';
  
  const dodgyRedCardLines = [
    `RED CARD! The referee sends off ${playerName} for that?! That's never a red!`,
    `The referee shows ${playerName} a straight red! That's an absolutely shocking decision!`,
    `RED CARD for ${playerName}! The referee has completely lost the plot!`,
    `The referee sends off ${playerName}! That's one of the worst decisions I've ever seen!`,
    `RED CARD! ${playerName} is off for what looked like a perfectly fair challenge!`,
    `The referee shows ${playerName} a red card! The crowd is absolutely furious!`,
    `RED CARD for ${playerName}! That's a disgraceful decision from the referee!`,
    `The referee sends off ${playerName}! That's never, ever a red card in a million years!`
  ];
  
  return pick(dodgyRedCardLines);
}

function generateEarlyFinalWhistleCommentary(event) {
  const favoredTeam = event.favoredTeam || 'Unknown Team';
  const score = event.score || '0-0';
  
  const earlyWhistleLines = [
    `FINAL WHISTLE! It's only the ${Math.floor(event.t)}th bloody minute! The referee has lost the plot!`,
    `The referee blows for full time! But we're only ${Math.floor(event.t)} minutes in! This is a disgrace!`,
    `FINAL WHISTLE! The referee ends the match early at ${Math.floor(event.t)} minutes! What is going on?!`,
    `The referee has blown for full time! But it's only the ${Math.floor(event.t)}th minute! This is madness!`,
    `FINAL WHISTLE! The referee calls time at ${Math.floor(event.t)} minutes! The crowd is in uproar!`,
    `The referee ends the match! But we're only ${Math.floor(event.t)} minutes in! This is absolutely scandalous!`,
    `FINAL WHISTLE! The referee has lost all sense of time! It's only the ${Math.floor(event.t)}th minute!`,
    `The referee blows for full time! But it's only ${Math.floor(event.t)} minutes! This is a complete farce!`
  ];
  
  return pick(earlyWhistleLines);
}

// HGH commentary - "hulking mass" descriptions
function generateHGHCommentary(playerName) {
  const hghLines = [
    `${playerName} looks like a hulking mass of muscle out there!`,
    `${playerName} is an absolute hulking mass on the pitch!`,
    `What a hulking mass ${playerName} has become! He's dominating physically!`,
    `${playerName} is a hulking mass of pure power!`,
    `The hulking mass that is ${playerName} is causing problems for the opposition!`,
    `${playerName} - what a hulking mass! He's transformed!`,
    `That hulking mass ${playerName} is unstoppable!`,
    `${playerName} has become a hulking mass of muscle and aggression!`
  ];
  
  return pick(hghLines);
}

// Cocaine commentary - hyper aggression descriptions
function generateCocaineCommentary(playerName, eventType) {
  if (eventType === 'FOUL' || eventType === 'RED_CARD') {
    const aggressiveLines = [
      `${playerName} goes in for a two-footed tackle! That's absolutely reckless!`,
      `${playerName} with a two-footed challenge! That's dangerous!`,
      `${playerName} launches into a two-footed tackle! The referee has to act!`,
      `${playerName} goes in with both feet! That's a shocking challenge!`,
      `${playerName} makes a two-footed tackle! That's a red card all day!`,
      `${playerName} goes in two-footed! That's completely out of control!`,
      `${playerName} is completely out of control! He's attacking with the ferocity of a coked-up maniac!`,
      `${playerName} launches a brutal assault! This is absolutely criminal!`,
      `${playerName} goes in like a man possessed! The cocaine has him seeing red!`,
      `${playerName} is attacking like he's got a weapon! This is beyond football!`
    ];
    return pick(aggressiveLines);
  } else if (eventType === 'CONTINUED_ASSAULT') {
    const continuedAssaultLines = [
      `${playerName} keeps kicking the player after he's gone down! This is assault!`,
      `${playerName} continues to kick the player on the ground! This is disgraceful!`,
      `${playerName} won't stop! He's still kicking the player who's down!`,
      `${playerName} keeps going! He's assaulting the player on the ground!`,
      `${playerName} is out of control! He won't stop kicking the downed player!`,
      `${playerName} is still attacking the player on the ground! This is a brutal assault!`,
      `${playerName} won't let up! He's kicking the downed player repeatedly! This is criminal!`,
      `${playerName} is like a man possessed! He's continuing to assault the player who's already down!`,
      `${playerName} is completely out of control! He's attacking the downed player with the ferocity of a coked-up maniac!`,
      `${playerName} is assaulting the player on the ground! This is beyond football - this is a weapon attack!`,
      `${playerName} keeps going! He's stomping on the downed player! This is absolutely criminal!`,
      `${playerName} is out of his mind! He's continuing to attack the player who's already on the ground!`
    ];
    return pick(continuedAssaultLines);
  } else if (eventType === 'WEAPON_ASSAULT') {
    const weaponLines = [
      `${playerName} has pulled something out! He's attacking the player with what looks like a weapon!`,
      `${playerName} is assaulting the player with a weapon! This is absolutely criminal!`,
      `${playerName} has gone completely insane! He's attacking with a weapon!`,
      `${playerName} is out of control! He's using a weapon to assault the player!`,
      `${playerName} has lost his mind! He's attacking the player with a weapon! This is beyond football!`
    ];
    return pick(weaponLines);
  }
  return `${playerName} is playing with extreme aggression!`;
}

// Stretcher injury commentary
function generateStretcherInjuryCommentary(victimName, causedBy) {
  const stretcherLines = [
    `${victimName} is down! Medical staff rush onto the pitch with a stretcher!`,
    `${victimName} is seriously injured! The stretcher is coming out!`,
    `${victimName} needs to be taken off on a stretcher! This looks serious!`,
    `Medical staff bring out the stretcher for ${victimName}! This is a bad injury!`,
    `${victimName} is being stretchered off! That challenge from ${causedBy} was brutal!`,
    `The stretcher is out for ${victimName}! ${causedBy}'s challenge has caused serious damage!`
  ];
  return pick(stretcherLines);
}

function generateRedCardCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLateCard = gameTime > 80;
  const isEarlyCard = gameTime < 20;
  
  const cardDescriptions = [
    'is sent off!',
    'sees red!',
    'gets his marching orders!',
    'is dismissed!',
    'walks!',
    'is shown a straight red!',
    'is given his marching orders!',
    'is sent for an early bath!',
    'is shown the red card!',
    'is dismissed from the field!',
    'is sent off the pitch!',
    'is shown a red card!',
    'gets a straight red!',
    'is sent packing!',
    'is dismissed by the referee!'
  ];
  
  const description = pick(cardDescriptions);
  
  // Add contextual phrases for red cards
  const contextualPhrases = [
    'A shocking red card for',
    'A controversial red card for',
    'A harsh red card for',
    'A deserved red card for',
    'A reckless challenge from',
    'A dangerous tackle from',
    'A violent challenge from',
    'A brutal foul from',
    'A wild tackle from',
    'A dangerous slide from',
    'A serious foul from',
    'A reckless challenge from'
  ];
  
  const contextualPhrase = Math.random() < 0.4 ? pick(contextualPhrases) + ' ' : '';
  
  // Add timing context
  let timingContext = '';
  if (isLateCard && Math.random() < 0.5) {
    timingContext = 'Late in the game, ';
  } else if (isEarlyCard && Math.random() < 0.4) {
    timingContext = 'Early in the match, ';
  }
  
  // Add dramatic emphasis
  const dramaticPhrases = [
    'RED CARD!',
    'STRAIGHT RED!',
    'RED CARD!',
    'SENT OFF!',
    'RED CARD!',
    'DISMISSED!'
  ];
  
  const dramaticPhrase = pick(dramaticPhrases);
  
  if (event.who === 'HOME') {
    return event.player ? `${timingContext}${dramaticPhrase} ${contextualPhrase}${event.player} ${description}` : `${timingContext}${dramaticPhrase} ${contextualPhrase}Southampton player ${description}`;
  } else {
    return event.player ? `${timingContext}${dramaticPhrase} ${contextualPhrase}${event.player} ${description}` : `${timingContext}${dramaticPhrase} ${contextualPhrase}${oppName} player ${description}`;
  }
}

// New contextual commentary function that considers game state, time, and score
function generateContextualCommentary(event, gameState) {
  const gameTime = event.t || 0;
  const homeScore = gameState?.homeScore || 0;
  const awayScore = gameState?.awayScore || 0;
  const isCloseGame = Math.abs(homeScore - awayScore) <= 1;
  const isBlowout = Math.abs(homeScore - awayScore) >= 3;
  const isLateGame = gameTime > 80;
  const isEarlyGame = gameTime < 20;
  const isMidGame = gameTime >= 20 && gameTime <= 70;
  
  const contextualComments = [];
  
  // Score-based commentary
  if (isCloseGame && gameTime > 30) {
    contextualComments.push(
      "This is a tight contest with both teams still in it...",
      "The match is finely balanced at this stage...",
      "Neither team has been able to pull away...",
      "This could go either way in the final stages...",
      "The tension is building as the scores remain close..."
    );
  }
  
  if (isBlowout && gameTime > 60) {
    contextualComments.push(
      "This match looks to be getting away from one team...",
      "The scoreline is starting to tell a story...",
      "One team is taking control of this match...",
      "The gap is widening as we enter the final stages...",
      "This is becoming a one-sided affair..."
    );
  }
  
  // Time-based commentary
  if (isEarlyGame) {
    contextualComments.push(
      "Both teams are still finding their rhythm...",
      "The match is still in its early stages...",
      "The players are settling into the game...",
      "It's still early doors in this contest...",
      "The match is just getting started..."
    );
  }
  
  if (isMidGame) {
    contextualComments.push(
      "The match is starting to open up...",
      "Both teams are now fully into their stride...",
      "The tempo is picking up nicely...",
      "The match is becoming more competitive...",
      "The intensity is building as we reach the middle period..."
    );
  }
  
  if (isLateGame) {
    contextualComments.push(
      "We're entering the crucial final stages...",
      "The match is reaching its climax...",
      "Every moment counts now...",
      "The pressure is mounting in these final minutes...",
      "This is where matches are won and lost..."
    );
  }
  
  // Special situations
  if (homeScore === awayScore && gameTime > 70) {
    contextualComments.push(
      "With the scores level, both teams will be pushing for a winner...",
      "A draw would be a fair result at this stage...",
      "Neither team wants to settle for a point...",
      "The match is perfectly poised for a dramatic finish..."
    );
  }
  
  if (homeScore > awayScore && gameTime > 75) {
    contextualComments.push(
      "The home team will be looking to see this out...",
      "The away team needs to find something special...",
      "Time is running out for the visitors...",
      "The home side will be feeling confident now..."
    );
  }
  
  if (awayScore > homeScore && gameTime > 75) {
    contextualComments.push(
      "The away team is in a strong position...",
      "The home team needs to find a way back...",
      "The visitors will be looking to hold on...",
      "The home side needs to throw caution to the wind..."
    );
  }
  
  // Return a random contextual comment if available
  if (contextualComments.length > 0 && Math.random() < 0.3) {
    return pick(contextualComments);
  }
  
  return null; // No contextual comment this time
}

// Southampton possession commentary function
function generateSouthamptonPossessionCommentary(event) {
  const oppName = currentOpponent()?.team || 'Opposition';
  const gameTime = event.t || 0;
  const isLatePossession = gameTime > 80;
  const isEarlyPossession = gameTime < 20;
  
  const possessionDescriptions = [
    'Southampton are in possession and looking to build an attack',
    'Southampton have the ball and are probing for an opening',
    'Southampton are controlling possession here',
    'Southampton are keeping the ball well',
    'Southampton are dictating the tempo with their possession',
    'Southampton are patient in possession, waiting for the right moment',
    'Southampton are moving the ball around nicely',
    'Southampton are building from the back with confidence',
    'Southampton are looking comfortable in possession',
    'Southampton are stringing together some nice passes',
    'Southampton are working the ball around the pitch',
    'Southampton are showing good composure on the ball',
    'Southampton are keeping possession and looking for gaps',
    'Southampton are controlling the midfield with their passing',
    'Southampton are patient in their approach with the ball',
    'Southampton are working hard to maintain possession',
    'Southampton are showing good ball retention',
    'Southampton are building pressure through sustained possession',
    'Southampton are looking to break down the opposition defense',
    'Southampton are keeping the ball and waiting for their moment'
  ];
  
  // Add contextual phrases
  const contextualPhrases = [
    'Good work from Southampton as',
    'Excellent ball retention from Southampton as',
    'Southampton are showing their quality as',
    'The home side are in control as',
    'Southampton are looking dangerous as',
    'The Saints are building momentum as',
    'Southampton are growing in confidence as',
    'The home team are showing their class as'
  ];
  
  const description = pick(possessionDescriptions);
  const contextualPhrase = Math.random() < 0.3 ? pick(contextualPhrases) + ' ' : '';
  
  // Add timing context
  let timingContext = '';
  if (isLatePossession && Math.random() < 0.4) {
    timingContext = 'In the closing stages, ';
  } else if (isEarlyPossession && Math.random() < 0.3) {
    timingContext = 'Early in the match, ';
  }
  
  return `${timingContext}${contextualPhrase}${description}.`;
}

// Crazy commentary functions for Champions League and World Cup matches
function generateBackflipCommentary() {
  const players = getOurSelectedFive().concat(getOpponentPlayers()).filter(p => p?.name);
  const player = players.length > 0 ? pick(players).name : 'A player';
  const oppName = currentOpponent()?.team || 'Opposition';
  
  const backflipComments = [
    `🤸 INCREDIBLE! ${player} just did a BACKFLIP after that play! The crowd goes absolutely WILD!`,
    `🤸 UNBELIEVABLE SCENES! ${player} celebrates with a PERFECT BACKFLIP! The stadium erupts!`,
    `🤸 WHAT IS HAPPENING?! ${player} just pulled off a TRIPLE BACKFLIP! This is INSANE!`,
    `🤸 THE CROWD CAN'T BELIEVE IT! ${player} does a BACKFLIP and lands perfectly! Pure showmanship!`,
    `🤸 ABSOLUTE MADNESS! ${player} celebrates with a BACKFLIP that would make an Olympic gymnast jealous!`,
    `🤸 INCREDIBLE ATHLETICISM! ${player} just did a BACKFLIP mid-celebration! The fans are going NUTS!`,
    `🤸 UNREAL! ${player} pulls off a BACKFLIP celebration! This is Champions League/World Cup drama at its finest!`,
    `🤸 THE REFEREE IS STUNNED! ${player} just did a BACKFLIP! No card, just pure entertainment!`
  ];
  
  return pick(backflipComments);
}

function generatePlayerFightCommentary() {
  const ourPlayers = getOurSelectedFive().filter(p => p?.name);
  const oppPlayers = getOpponentPlayers().filter(p => p?.name);
  const player1 = ourPlayers.length > 0 ? pick(ourPlayers).name : 'A Southampton player';
  const player2 = oppPlayers.length > 0 ? pick(oppPlayers).name : 'An opponent';
  const oppName = currentOpponent()?.team || 'Opposition';
  
  const fightComments = [
    `👊 CHAOS! ${player1} and ${player2} are THROWING PUNCHES at each other! This is a FULL-ON BRAWL!`,
    `👊 MASSIVE FIGHT BREAKS OUT! ${player1} and ${player2} are going at it! Players from both teams rush in!`,
    `👊 ALL HELL BREAKS LOOSE! ${player1} and ${player2} are in a PUNCH-UP! The referee is trying to break it up!`,
    `👊 UNBELIEVABLE! ${player1} and ${player2} are FIGHTING! This is absolute CHAOS on the pitch!`,
    `👊 THE MATCH HAS ERUPTED! ${player1} and ${player2} are throwing hands! Security might need to get involved!`,
    `👊 MASS BRAWL! ${player1} and ${player2} started it, now EVERYONE is involved! This is INSANE!`,
    `👊 RED CARD? NO, THIS IS A FULL FIGHT! ${player1} and ${player2} are going at it like boxers!`,
    `👊 THE STADIUM IS IN SHOCK! ${player1} and ${player2} are in a VIOLENT ALTERCATION! This is WILD!`
  ];
  
  return pick(fightComments);
}

function generateRefereeExposureCommentary() {
  const oppName = currentOpponent()?.team || 'Opposition';
  
  const exposureComments = [
    `😱 OH MY GOD! The referee has just EXPOSED HIMSELF on the pitch! This is ABSOLUTELY INSANE!`,
    `😱 UNBELIEVABLE! The referee drops his shorts and EXPOSES HIMSELF! The crowd doesn't know whether to laugh or be horrified!`,
    `😱 WHAT IN THE WORLD?! The referee just FLASHED THE STADIUM! This is the craziest thing I've ever seen!`,
    `😱 THE REFEREE HAS LOST HIS MIND! He just EXPOSED HIMSELF to 80,000 people! Security is rushing onto the pitch!`,
    `😱 ABSOLUTE CHAOS! The referee has EXPOSED HIMSELF! Players are covering their eyes! This is BONKERS!`,
    `😱 INCREDIBLE SCENES! The referee just EXPOSED HIMSELF mid-match! The VAR room must be in SHOCK!`,
    `😱 THE REFEREE HAS GONE COMPLETELY MAD! He's EXPOSED HIMSELF on live television! This is WILD!`,
    `😱 UNPRECEDENTED! The referee EXPOSES HIMSELF! The match has descended into ABSOLUTE MADNESS!`
  ];
  
  return pick(exposureComments);
}

function generateFanShootingCommentary() {
  const oppName = currentOpponent()?.team || 'Opposition';
  
  // Play gunfire sound effect
  if (typeof window.playSoundEffect === 'function') {
    window.playSoundEffect('gunfire', 0.8);
  }
  
  const shootingComments = [
    `🔫 GUNSHOTS RING OUT IN THE STADIUM! Fans are SHOOTING into the air! This is TERRIFYING!`,
    `🔫 OH NO! GUNFIRE from the stands! Someone is SHOOTING into the stadium! Security is scrambling!`,
    `🔫 ABSOLUTE TERROR! GUNSHOTS echo through the stadium! Fans are SHOOTING! This is a NIGHTMARE!`,
    `🔫 THE STADIUM IS UNDER FIRE! Multiple GUNSHOTS ring out! Fans are SHOOTING into the air! CHAOS!`,
    `🔫 INCREDIBLE DANGER! GUNSHOTS from the crowd! Someone is SHOOTING into the stadium! Players are diving for cover!`,
    `🔫 THIS IS INSANE! GUNFIRE erupts from the stands! Fans are SHOOTING! The match might be ABANDONED!`,
    `🔫 TERRIFYING SCENES! GUNSHOTS echo around the stadium! Multiple people are SHOOTING! This is CHAOS!`,
    `🔫 THE STADIUM IS IN LOCKDOWN! GUNSHOTS from the crowd! Fans are SHOOTING! This is ABSOLUTE MADNESS!`
  ];
  
  return pick(shootingComments);
}

function generateCrazyDramaCommentary() {
  const players = getOurSelectedFive().concat(getOpponentPlayers()).filter(p => p?.name);
  const player = players.length > 0 ? pick(players).name : 'A player';
  const oppName = currentOpponent()?.team || 'Opposition';
  
  const dramaComments = [
    `💥 EXPLOSION OF DRAMA! ${player} just did something INCREDIBLE! The stadium is ROCKING!`,
    `💥 ABSOLUTE PANDEMONIUM! The match has descended into COMPLETE CHAOS! This is INSANE!`,
    `💥 THE STADIUM IS ERUPTING! Something CRAZY just happened! The fans are going ABSOLUTELY MENTAL!`,
    `💥 UNPRECEDENTED DRAMA! This match has everything! Fights, backflips, and PURE INSANITY!`,
    `💥 THE CROWD CAN'T HANDLE IT! This is the CRAZIEST match in Champions League/World Cup history!`,
    `💥 ABSOLUTE BEDLAM! The match has become a CIRCUS! But what a SPECTACULAR circus it is!`,
    `💥 THIS IS PURE ENTERTAINMENT! The drama never stops! This is why we love football!`,
    `💥 THE STADIUM IS SHAKING! The intensity is UNREAL! This is football at its MOST DRAMATIC!`
  ];
  
  return pick(dramaComments);
}

// Drunk manager commentary with national stereotypes (for World Cup matches)
function generateDrunkManagerCommentary(opponentCountry) {
  if (!S.isDrunk || S.competition !== 'world_cup') {
    return null;
  }
  
  // Get country name (remove "FC" or other suffixes if present)
  const countryName = opponentCountry.replace(/\s*FC\s*$/, '').trim();
  
  // National stereotypes mapping
  const stereotypes = {
    'Croatia': [
      `"CROATIAN BASTARDS!" you shout from the touchline.`,
      `"YOU CROATIAN BASTARDS!" you yell, drawing confused looks.`,
      `"CROATIAN BASTARDS!" you scream, your voice echoing across the stadium.`
    ],
    'Netherlands': [
      `"WHY DON'T YOU GO AND EAT SOME PASTRIES!" you shout at the Dutch players.`,
      `"GO EAT SOME PASTRIES, YOU DUTCH BASTARDS!" you yell.`,
      `"PASTRIES! GO EAT SOME PASTRIES!" you scream incoherently.`
    ],
    'Germany': [
      `"YOU GERMAN BASTARDS! GO EAT SOME SAUSAGES!" you shout.`,
      `"GERMAN BASTARDS! WHERE'S YOUR BEER?" you yell.`,
      `"SAUSAGES AND BEER, YOU GERMAN BASTARDS!" you scream.`
    ],
    'France': [
      `"FRENCH BASTARDS! GO EAT SOME CROISSANTS!" you shout.`,
      `"YOU FRENCH BASTARDS! WHERE'S YOUR WINE?" you yell.`,
      `"CROISSANTS AND WINE, YOU FRENCH BASTARDS!" you scream.`
    ],
    'Italy': [
      `"ITALIAN BASTARDS! GO EAT SOME PASTA!" you shout.`,
      `"YOU ITALIAN BASTARDS! WHERE'S YOUR PIZZA?" you yell.`,
      `"PASTA AND PIZZA, YOU ITALIAN BASTARDS!" you scream.`
    ],
    'Spain': [
      `"SPANISH BASTARDS! GO EAT SOME PAELLA!" you shout.`,
      `"YOU SPANISH BASTARDS! WHERE'S YOUR TAPAS?" you yell.`,
      `"PAELLA AND TAPAS, YOU SPANISH BASTARDS!" you scream.`
    ],
    'Brazil': [
      `"BRAZILIAN BASTARDS! GO EAT SOME FEIJOADA!" you shout.`,
      `"YOU BRAZILIAN BASTARDS! WHERE'S YOUR SAMBA?" you yell.`,
      `"FEIJOADA AND SAMBA, YOU BRAZILIAN BASTARDS!" you scream.`
    ],
    'Argentina': [
      `"ARGENTINE BASTARDS! GO EAT SOME ASADO!" you shout.`,
      `"YOU ARGENTINE BASTARDS! WHERE'S YOUR TANGO?" you yell.`,
      `"ASADO AND TANGO, YOU ARGENTINE BASTARDS!" you scream.`
    ],
    'England': [
      `"ENGLISH BASTARDS! GO EAT SOME FISH AND CHIPS!" you shout.`,
      `"YOU ENGLISH BASTARDS! WHERE'S YOUR TEA?" you yell.`,
      `"FISH AND CHIPS AND TEA, YOU ENGLISH BASTARDS!" you scream.`
    ],
    'Portugal': [
      `"PORTUGUESE BASTARDS! GO EAT SOME PASTEL DE NATA!" you shout.`,
      `"YOU PORTUGUESE BASTARDS! WHERE'S YOUR PORT?" you yell.`,
      `"PASTEL DE NATA AND PORT, YOU PORTUGUESE BASTARDS!" you scream.`
    ],
    'Belgium': [
      `"BELGIAN BASTARDS! GO EAT SOME WAFFLES!" you shout.`,
      `"YOU BELGIAN BASTARDS! WHERE'S YOUR CHOCOLATE?" you yell.`,
      `"WAFFLES AND CHOCOLATE, YOU BELGIAN BASTARDS!" you scream.`
    ],
    'Japan': [
      `"JAPANESE BASTARDS! GO EAT SOME SUSHI!" you shout.`,
      `"YOU JAPANESE BASTARDS! WHERE'S YOUR RAMEN?" you yell.`,
      `"SUSHI AND RAMEN, YOU JAPANESE BASTARDS!" you scream.`
    ],
    'Mexico': [
      `"MEXICAN BASTARDS! GO EAT SOME TACOS!" you shout.`,
      `"YOU MEXICAN BASTARDS! WHERE'S YOUR TEQUILA?" you yell.`,
      `"TACOS AND TEQUILA, YOU MEXICAN BASTARDS!" you scream.`
    ]
  };
  
  // Get country-specific insults or use generic
  const countryInsults = stereotypes[countryName] || [
    `${countryName.toUpperCase()} BASTARDS!`,
    `YOU ${countryName.toUpperCase()} BASTARDS!`,
    `${countryName.toUpperCase()} BASTARDS! GO HOME!`
  ];
  
  return pick(countryInsults);
}

function addMatchAtmosphereCommentary(events) {
  // Check if Portsmouth is using replacement team
  const isPortsmouthReplacementTeam = S.portsmouth_under12s_team || S.portsmouth_bus_destroyed;
  const oppName = (S && S.matchContext && S.matchContext.team) ? S.matchContext.team : '';
  const isPortsmouthMatch = oppName && (oppName.toLowerCase().includes('portsmouth') || oppName.toLowerCase().includes('pompey') || oppName === 'Burger King FC' || oppName.toLowerCase().includes('burger king'));
  
  // Check if our players are on cocaine or HGH
  const ourCocaineUsers = S.squad ? S.squad.filter(p => p.on_cocaine_this_match) : [];
  const ourHGHUsers = S.squad ? S.squad.filter(p => p.on_hgh_this_match) : [];
  const hasDrugs = ourCocaineUsers.length > 0 || ourHGHUsers.length > 0;
  
  const atmosphereComments = [
    "The teams are warming up on the pitch...",
    "The crowd is building up nicely...",
    "Both teams look focused and ready...",
    "The atmosphere is electric here today...",
    "The players are going through their final preparations...",
    "The stadium is filling up with anticipation...",
    "The referee is having a final word with the captains...",
    "The teams are in the tunnel, ready to emerge...",
    "The crowd erupts as the teams take to the field...",
    "The national anthem plays as the teams line up...",
    "The coin toss is complete, and we're ready to begin...",
    "The referee blows his whistle and we're underway!",
    "The match is heating up as both teams settle in...",
    "The tempo is picking up nicely...",
    "Both teams are looking to impose their style...",
    "The crowd is getting behind their team...",
    "The match is becoming more physical...",
    "The intensity is building as we approach half-time...",
    "The second half is underway...",
    "The match is reaching its climax...",
    "The tension is palpable in the final minutes...",
    "The referee is checking his watch...",
    "We're into added time...",
    "The final whistle approaches...",
    "The stadium is buzzing with excitement...",
    "The fans are in full voice today...",
    "The atmosphere is absolutely electric...",
    "The crowd is creating a fantastic atmosphere...",
    "The stadium is rocking with anticipation...",
    "The fans are making their presence felt...",
    "The atmosphere is building nicely...",
    "The crowd is getting louder and louder...",
    "The stadium is alive with energy...",
    "The fans are creating a wall of noise...",
    "The atmosphere is reaching fever pitch...",
    "The crowd is on their feet...",
    "The stadium is absolutely bouncing...",
    "The fans are in fine voice...",
    "The atmosphere is incredible...",
    "The crowd is making this a special occasion...",
    "The stadium is electric with anticipation...",
    "The fans are creating an amazing atmosphere...",
    "The crowd is in full flow...",
    "The atmosphere is building to a crescendo...",
    "The fans are making their voices heard...",
    "The stadium is alive with passion...",
    "The crowd is creating a fantastic noise...",
    "The atmosphere is absolutely brilliant...",
    "The fans are in great spirits...",
    "The stadium is buzzing with energy...",
    "The crowd is making this a memorable occasion..."
  ];
  
  // Add special Southampton fans chanting if Portsmouth replacement team is playing
  if (isPortsmouthMatch && isPortsmouthReplacementTeam) {
    const fanChants = [
      "YOUR TEAM ARE DEAD! HA HA HA!",
      "YOUR TEAM ARE DEAD! HA HA HA!",
      "YOUR TEAM ARE DEAD! HA HA HA!",
      "Portsmouth fans can be heard chanting: 'YOUR TEAM ARE DEAD! HA HA HA!'",
      "The Southampton fans are merciless: 'YOUR TEAM ARE DEAD! HA HA HA!'",
      "Coins rain down from the stands as Southampton fans chant: 'YOUR TEAM ARE DEAD! HA HA HA!'",
      "The merciless Southampton end howls: 'YOUR TEAM IS DEAD! YOUR TEAM IS DEAD!' as another goal goes in.",
      "Southampton fans bellow in unison: 'YOUR TEAM IS DEAD!' while the replacement kids huddle together.",
      "The home end erupts: 'YOUR TEAM IS DEAD! YOUR TEAM IS DEAD!' – there is no sympathy for the replacement side tonight."
    ];
    
    // Add 3-5 fan chant events throughout the match
    const numChants = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numChants; i++) {
      const chantTime = Math.floor(Math.random() * 90);
      const chant = pick(fanChants);
      
      const chantEvent = {
        t: chantTime,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: chant
      };
      
      events.push(chantEvent);
    }
    
    // Add coin throwing events
    const numCoinEvents = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numCoinEvents; i++) {
      const coinTime = Math.floor(Math.random() * 90);
      
      const coinEvent = {
        t: coinTime,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: "Coins are being thrown at the replacement team from the Southampton stands!"
      };
      
      events.push(coinEvent);
    }
  }

  // Add extra Saints chants if the Portsmouth captain was killed in the pre-match fight
  if (isPortsmouthMatch && S.portsmouth_captain_killed) {
    const captainChants = [
      "The Southampton fans mock: 'YOUR CAPTAIN'S DEAD! YOUR CAPTAIN'S DEAD!' over and over.",
      "A brutal chant rolls around St Mary’s: 'YOUR CAPTAIN'S DEAD! YOUR CAPTAIN'S DEAD!'",
      "The home end erupts in a vicious song: 'YOUR CAPTAIN'S DEAD! YOUR CAPTAIN'S DEAD!'",
      "Southampton fans point at the away end, chanting: 'YOUR CAPTAIN'S DEAD! YOUR CAPTAIN'S DEAD!' without a hint of remorse."
    ];
    const numCaptainChants = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numCaptainChants; i++) {
      const chantTime = Math.floor(Math.random() * 90);
      const chant = pick(captainChants);
      events.push({
        t: chantTime,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: chant
      });
    }
  }
  
  // Add 2-4 atmosphere comments throughout the match
  const numComments = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numComments; i++) {
    const commentTime = Math.floor(Math.random() * 90); // Random time in 90 minutes
    const comment = pick(atmosphereComments);
    
    // Insert atmosphere comment at appropriate time
    const atmosphereEvent = {
      t: commentTime,
      who: 'NEUTRAL',
      kind: 'ATMOSPHERE',
      message: comment
    };
    
    events.push(atmosphereEvent);
  }
  
  // Add context-dependent commentary for referee bribes (DISABLED - using new referee bias events instead)
  // if (S && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
  //   const { team: oppTeam } = currentOpponent();
  //   const favName = (S.referee_bribed === 'us') ? 'Southampton' : oppTeam;
  //   const oppName = (S.referee_bribed === 'us') ? oppTeam : 'Southampton';
  //   
  //   // Add 1-3 referee bribe commentary lines throughout the match
  //   const numBribeComments = 1 + Math.floor(Math.random() * 3);
  //   for (let i = 0; i < numBribeComments; i++) {
  //     const commentTime = Math.floor(Math.random() * 90);
  //     const pool = (S.referee_bribed === 'us') ? REF_BRIBE_FOR_US : REF_BRIBE_FOR_THEM;
  //     const line = pick(pool)
  //       .replaceAll('{FAV}', favName)
  //       .replaceAll('{OPP}', oppName);
  //     
  //     const bribeEvent = {
  //       t: commentTime,
  //       who: 'NEUTRAL',
  //       kind: 'ATMOSPHERE',
  //       message: line
  //     };
  //     
  //     events.push(bribeEvent);
  //   }
  // }
  
  // Add stadium burn commentary if triggered
  if (S && S.preMatch?.stadium_burn_triggered) {
    // Add explosion events at the end of the match
    const explosionEvents = [
      {
        t: 90,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: "💥 SUDDENLY: Flames erupt from the stadium!"
      },
      {
        t: 90.5,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: "🔥 The ground shakes as explosions rock St Mary's!"
      },
      {
        t: 91,
        who: 'NEUTRAL',
        kind: 'ATMOSPHERE',
        message: "🚨 EMERGENCY: The stadium has been attacked by terrorists!"
      }
    ];
    
    events.push(...explosionEvents);
  }
  
  // Sort again after adding all atmosphere comments
  events.sort((a, b) => a.t - b.t);
}

// Add referee bias events when referee has been bribed
function addRefereeBiasEvents(events, ourPlayersWithNames, oppPlayersWithNames) {
  if (!S.referee_bribed || (S.referee_bribed !== 'us' && S.referee_bribed !== 'them')) {
    return;
  }
  
  const favoredSide = S.referee_bribed;
  const disfavoredSide = S.referee_bribed === 'us' ? 'them' : 'us';
  const favoredPlayers = favoredSide === 'us' ? ourPlayersWithNames : oppPlayersWithNames;
  const disfavoredPlayers = disfavoredSide === 'us' ? ourPlayersWithNames : oppPlayersWithNames;
  const favoredTeam = favoredSide === 'us' ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition');
  const disfavoredTeam = disfavoredSide === 'us' ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition');
  
  // 1. Add a dodgy penalty for the favored team (80% chance - increased for testing)
  if (Math.random() < 0.8) {
    const penaltyTime = 20 + Math.floor(Math.random() * 50); // 20-70 minutes
    const penaltyTaker = favoredPlayers.length > 0 ? pick(favoredPlayers) : null;
    
    events.push({
      t: penaltyTime,
      who: favoredSide === 'us' ? 'HOME' : 'AWAY',
      kind: 'DODGY_PENALTY',
      player: penaltyTaker?.name || 'Unknown Player',
      team: favoredTeam,
      isRefereeBias: true
    });
  }
  
  // 2. Add red card(s) for disfavored team players (60% chance - increased for testing)
  if (Math.random() < 0.6 && disfavoredPlayers.length > 0) {
    const numRedCards = Math.random() < 0.7 ? 1 : 2; // 70% chance of 1, 30% chance of 2
    
    for (let i = 0; i < numRedCards && i < disfavoredPlayers.length; i++) {
      const redCardTime = 30 + Math.floor(Math.random() * 40); // 30-70 minutes
      const victim = pick(disfavoredPlayers);
      
      events.push({
        t: redCardTime,
        who: disfavoredSide === 'us' ? 'HOME' : 'AWAY',
        kind: 'DODGY_RED_CARD',
        player: victim?.name || 'Unknown Player',
        team: disfavoredTeam,
        isRefereeBias: true
      });
    }
  }
  
  // 3. Add early final whistle if favored team is ahead (50% chance - increased for testing)
  if (Math.random() < 0.5) {
    // Check if favored team is ahead by counting goals
    const favoredGoals = events.filter(e => e.kind === 'GOAL' && e.who === (favoredSide === 'us' ? 'HOME' : 'AWAY')).length;
    const disfavoredGoals = events.filter(e => e.kind === 'GOAL' && e.who === (disfavoredSide === 'us' ? 'HOME' : 'AWAY')).length;
    
    if (favoredGoals > disfavoredGoals) {
      const earlyWhistleTime = 50 + Math.floor(Math.random() * 20); // 50-70 minutes
      
      events.push({
        t: earlyWhistleTime,
        who: 'NEUTRAL',
        kind: 'EARLY_FINAL_WHISTLE',
        player: null,
        team: null,
        isRefereeBias: true,
        favoredTeam: favoredTeam,
        score: `${favoredGoals}-${disfavoredGoals}`
      });
    }
  }
}

// Skip to results - simulate match and show detailed summary
async function skipToResults() {
  log("⏭️ Skipping to match results...");
  
  // Get opponent name from match context (works for CL, World Cup, and league)
  const oppAtKickoff = S.matchContext || ((typeof currentOpponent === 'function') ? currentOpponent() : { team: 'Opposition' });
  const opponentName = oppAtKickoff.team || 'Opposition';
  
  // Check if this is a Champions League or World Cup match
  const isCupMatch = S.competition === 'champions_league' || S.competition === 'world_cup' || S.clActive || S.worldCupActive;
  
  // Simulate the match using the same logic as quick sim
  let our, opp;
  
  if (isCupMatch) {
    // For Champions League/World Cup, use teamStrength logic
    our = teamStrength();
    opp = rnd(60, 78) + (["Manchester City","Liverpool","Arsenal"].includes(opponentName) ? 5 : 0);
    // Apply global morale perks (but not one-match boosts meant for league)
    our = Math.max(10, Math.min(our, 200));
    opp = Math.max(10, Math.min(opp, 200));
  } else {
    // For league matches, use selected five
    const our5 = getOurSelectedFive();
    const opp5 = getOppSelectedFive();
    our = computeTeamStrength(our5);
    opp = computeOpponentStrength(opp5);
    
    // Apply morale bonuses
    if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
    if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
    our = Math.max(10, Math.min(our, 200));
    opp = Math.max(10, Math.min(opp, 200));
  }
  
  // Simulate goals using expected goals and Poisson distribution
  const [ourXG, oppXG] = expectedGoals(our, opp);
  let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);
  
  // Apply facility perks and strength differences
  if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
  if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
  if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
  
  // Generate match events (goals, cards, etc.)
  const events = [];
  
  // Add goal events
  const ourPlayers = getOurSelectedFive();
  const oppPlayers = getOppSelectedFive();
  
  // Our goals
  for (let i = 0; i < gf; i++) {
    const scorer = ourPlayers && ourPlayers.length > 0 ? ourPlayers[Math.floor(Math.random() * ourPlayers.length)] : null;
    events.push({
      t: 10 + Math.floor(Math.random() * 80),
      kind: 'GOAL',
      scorer: scorer?.name || 'Southampton Player',
      team: 'us'
    });
  }
  
  // Their goals
  for (let i = 0; i < ga; i++) {
    const scorer = oppPlayers && oppPlayers.length > 0 ? oppPlayers[Math.floor(Math.random() * oppPlayers.length)] : null;
    events.push({
      t: 10 + Math.floor(Math.random() * 80),
      kind: 'GOAL',
      scorer: scorer?.name || 'Opposition Player',
      team: 'them'
    });
  }
  
  // Add some cards (yellow/red)
  const cardCount = Math.floor(Math.random() * 4) + 1; // 1-4 cards
  for (let i = 0; i < cardCount; i++) {
    const isOurPlayer = Math.random() < 0.5;
    const player = isOurPlayer ? 
      (ourPlayers && ourPlayers.length > 0 ? ourPlayers[Math.floor(Math.random() * ourPlayers.length)] : null) : 
      (oppPlayers && oppPlayers.length > 0 ? oppPlayers[Math.floor(Math.random() * oppPlayers.length)] : null);
    const isRed = Math.random() < 0.2; // 20% chance of red card
    
    events.push({
      t: 15 + Math.floor(Math.random() * 75),
      kind: 'CARD',
      player: player?.name || (isOurPlayer ? 'Southampton Player' : 'Opposition Player'),
      cardType: isRed ? 'RED' : 'YELLOW',
      team: isOurPlayer ? 'us' : 'them'
    });
  }
  
  // Sort events by time
  events.sort((a, b) => a.t - b.t);
  
  // Show match summary
  log(`\n📊 MATCH RESULT:`);
  log(`🏟️ Southampton FC ${gf} - ${ga} ${opponentName}`);
  
  // Show goals
  const ourGoals = events.filter(e => e.kind === 'GOAL' && e.team === 'us');
  const theirGoals = events.filter(e => e.kind === 'GOAL' && e.team === 'them');
  
  if (ourGoals.length > 0) {
    log(`\n⚽ ${getClubName()} Goals:`);
    ourGoals.forEach(goal => {
      log(`  ${goal.t}' - ${goal.scorer || 'Unknown Player'}`);
    });
  }
  
  if (theirGoals.length > 0) {
    log(`\n⚽ ${opponentName} Goals:`);
    theirGoals.forEach(goal => {
      log(`  ${goal.t}' - ${goal.scorer || 'Unknown Player'}`);
    });
  }
  
  // Show cards
  const ourCards = events.filter(e => e.kind === 'CARD' && e.team === 'us');
  const theirCards = events.filter(e => e.kind === 'CARD' && e.team === 'them');
  
  if (ourCards.length > 0) {
    log(`\n🟨 Southampton Cards:`);
    ourCards.forEach(card => {
      const cardType = card.cardType === 'RED' ? '🔴' : '🟨';
      log(`  ${card.t}' - ${card.player || 'Unknown Player'} ${cardType}`);
    });
  }
  
  if (theirCards.length > 0) {
    log(`\n🟨 ${opponentName} Cards:`);
    theirCards.forEach(card => {
      const cardType = card.cardType === 'RED' ? '🔴' : '🟨';
      log(`  ${card.t}' - ${card.player || 'Unknown Player'} ${cardType}`);
    });
  }
  
  // Show other events
  const otherEvents = events.filter(e => e.kind !== 'GOAL' && e.kind !== 'CARD');
  if (otherEvents.length > 0) {
    log(`\n📰 Other Events:`);
    otherEvents.forEach(event => {
      if (event.kind === 'INJURY') {
        log(`  ${event.t}' - ${event.player || 'Unknown Player'} injured`);
      } else if (event.kind === 'SUBSTITUTION') {
        log(`  ${event.t}' - ${event.playerOut || 'Unknown'} off, ${event.playerIn || 'Unknown'} on`);
      }
    });
  }
  
  // Only update league statistics if this is a league match
  if (!isCupMatch) {
    if (gf > ga) {
      S.wins = (S.wins || 0) + 1;
      S.points = (S.points || 0) + 3;
      log(`\n✅ Victory! +3 points`);
    } else if (ga > gf) {
      S.losses = (S.losses || 0) + 1;
      log(`\n❌ Defeat`);
    } else {
      S.draws = (S.draws || 0) + 1;
      S.points = (S.points || 0) + 1;
      log(`\n🤝 Draw! +1 point`);
    }
    
    // Update top scorers
    ourGoals.forEach(goal => {
      if (goal.scorer) {
        addGoalToTopScorers(goal.scorer, 'us');
      }
    });
    
    log(`\n📈 Current League Position: ${S.points || 0} points (${S.wins || 0}W ${S.draws || 0}D ${S.losses || 0}L)`);
  }
  
  // Return result in format expected by Champions League/World Cup handlers
  return { 
    usGoals: gf, 
    themGoals: ga, 
    our_goals: gf, 
    their_goals: ga,
    winner: gf > ga ? "us" : (gf < ga ? "them" : "draw"),
    simulated: true, 
    skipped: true 
  };
}

// Original simulation; league matches are handled by simulateMatch() (match hotfix part).
async function simulateMatchLegacy(opponentTeam = null) {
  // Check if we're in a Champions League or World Cup context
  if (opponentTeam === null && (S.competition === 'champions_league' || S.competition === 'world_cup' || S.clActive || S.worldCupActive)) {
    // **Champions League/World Cup match simulation** - treat as cup match
    const opponent = (typeof currentOpponent === 'function') ? currentOpponent()?.team : (S.matchContext?.team || 'Opposition');
    log(`<strong>Fixture:</strong> ${getClubName()} vs ${opponent}`);
    // (Skip Messi fiasco in cup – it will apply in next league match if pending)
    let our = teamStrength();
    let opp = rnd(60, 78) + (["Manchester City","Liverpool","Arsenal"].includes(opponent) ? 5 : 0);
    // Apply global morale perks (but not one-match boosts meant for league)
    our = Math.max(10, Math.min(our, 200));
    opp = Math.max(10, Math.min(opp, 200));
    const [ourXG, oppXG] = expectedGoals(our, opp);
    let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);
    if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
    if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
    if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
    const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");
    
    // Get player pools for both teams
    const ourPlayers = getOurSelectedFive();
    const oppPlayers = getOpponentPlayers();
    
    // Ensure we have actual player objects with names
    const ourPlayersWithNames = ourPlayers.filter(p => p && p.name);
    const oppPlayersWithNames = oppPlayers.filter(p => p && p.name);
    
    // Create match events and display them in real-time
    const events = [];
    
    // Add our goals with player details - distribute throughout 90 minutes
    for (let i = 0; i < gf; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes
      let scorerName = null;
      let assisterName = null;
      
      if (ourPlayersWithNames.length > 0) {
        const scorer = pick(ourPlayersWithNames);
        scorerName = scorer?.name;
        
        if (Math.random() < 0.6 && ourPlayersWithNames.length > 1) {
          const assister = pick(ourPlayersWithNames.filter(p => p.id !== scorer?.id));
          assisterName = assister?.name;
        }
      } else if (ourPlayers.length > 0) {
        const fallbackPlayer = pick(ourPlayers);
        scorerName = fallbackPlayer?.name || `Player ${i + 1}`;
      } else {
        scorerName = `Southampton Player ${i + 1}`;
      }
      
      events.push({ 
        t, 
        who: 'HOME', 
        kind: 'GOAL',
        scorer: scorerName,
        assister: assisterName,
        team: getClubName()
      });
    }
    
    // Add opponent goals with player details
    for (let i = 0; i < ga; i++) {
      const t = 10 + Math.floor(Math.random() * 80);
      const scorer = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
      const assister = (Math.random() < 0.6 && oppPlayersWithNames.length > 1) 
        ? pick(oppPlayersWithNames.filter(p => p.id !== scorer?.id)) 
        : null;
      events.push({ 
        t, 
        who: 'AWAY', 
        kind: 'GOAL',
        scorer: scorer?.name || (oppPlayers.length > 0 ? pick(oppPlayers).name : 'Opposition Player'),
        assister: assister?.name || null,
        team: opponent
      });
    }
    
    // Add other events
    const totalEvents = Math.max(12, Math.floor((gf + ga) * 6) + 8);
    for (let i = 0; i < totalEvents; i++) {
      const t = 2 + Math.floor(Math.random() * 88);
      const eventTypes = ['SHOT', 'CORNER', 'FOUL', 'CARD'];
      const eventType = pick(eventTypes);
      const isHome = Math.random() < 0.5;
      const players = isHome ? ourPlayersWithNames : oppPlayersWithNames;
      const player = players.length > 0 ? pick(players) : null;
      
      events.push({
        t,
        who: isHome ? 'HOME' : 'AWAY',
        kind: eventType,
        player: player?.name || null,
        team: isHome ? 'Southampton FC' : opponent
      });
    }
    
    // Sort events by time
    events.sort((a, b) => a.t - b.t);
    
    // Add match atmosphere commentary
    addMatchAtmosphereCommentary(events);
    
    // Store match events for commentary generation
    S.matchEvents = events;
    
    // Open match viewer with graphics and commentary
    _openMatchViewer();
    
    // Get references to match viewer elements
    const modal = document.getElementById('matchViewer');
    const canvas = document.getElementById('matchCanvas');
    const com = document.getElementById('matchCommentary');
    const tick = document.getElementById('matchTicker');
    
    // Initialize commentary area
    if (com) {
      com.innerHTML = "";
    }
    
    // Start match animation with commentary
    try {
      const result = await _animateMatchWithCommentary(events, canvas, com, tick, gf, ga);
      
      // Close viewer after match completes
      await new Promise(resolve => setTimeout(resolve, 2000));
      _closeMatchViewer();
      
      // Log the full-time result
      try {
        log(`Full-time: ${S.club_name} ${gf} – ${ga} ${opponent}`);
        showMatchSummary(gf, ga, opponent);
      } catch {}
      
      return { winner, usGoals: gf, themGoals: ga, score: `${gf}-${ga}` };
    } catch (error) {
      // Handle skip
      _closeMatchViewer();
      const skipBtn = document.getElementById('skipMatchBtn');
      if (skipBtn && skipBtn.dataset.skipped === 'true') {
        const result = await skipToResults();
        return result;
      }
      throw error;
    }
  }
  
  if (opponentTeam === null) {
    // **League match simulation**
    // If a special Messi-in-goal fiasco is scheduled, force a 0-100 loss
    if (S.messi_goalie_next_loss) {
      S.messi_goalie_next_loss = false;
      S.matches_played++; 
      S.losses++;
      S.morale = clamp(S.morale - 25, -100, 100);
      log('Result: LOSS (0–100). Board moves to remove you.');
      await triggerRemovalWorkaround('an egregious tactical fiasco (0–100)');
      render();
      // Return an outcome with an extreme loss for table update
      return { winner: "them", usGoals: 0, themGoals: 100, score: "0-100" };
    }
    
    // Ensure strengths are computed
    if (!S?.preMatch?.ourStrength || !S?.preMatch?.oppStrength) {
      computePreMatchStrengthsAndOdds();
    }
    let our = S.preMatch.ourStrength, opp = S.preMatch.oppStrength;
    
    // Apply any one-match morale effects
    if (typeof S.team_morale_boost === 'number') our += S.team_morale_boost;
    if (typeof S.morale_opponent === 'number') opp += Math.round((S.morale_opponent - 70) / 5);
    our = Math.max(10, Math.min(our, 200));
    opp = Math.max(10, Math.min(opp, 200));
    
    // Simulate goals using expected goals and Poisson distribution
    const [ourXG, oppXG] = expectedGoals(our, opp);
    let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);
    if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
    if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
    if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
    const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");
    
    // Get player pools for both teams
    const ourPlayers = getOurSelectedFive();
    const oppPlayers = getOpponentPlayers();
    
    // Ensure we have actual player objects with names
    const ourPlayersWithNames = ourPlayers.filter(p => p && p.name);
    const oppPlayersWithNames = oppPlayers.filter(p => p && p.name);
    
    // Create match events and display them in real-time
    const events = [];
    let t = 0;
    
    // Add our goals with player details - distribute throughout 90 minutes
    for (let i = 0; i < gf; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes
      
      // Ensure we have a proper player name, fallback to generating one if needed
      let scorerName = null;
      let assisterName = null;
      
      if (ourPlayersWithNames.length > 0) {
        const scorer = pick(ourPlayersWithNames);
        scorerName = scorer?.name;
        
        if (Math.random() < 0.6 && ourPlayersWithNames.length > 1) {
          const assister = pick(ourPlayersWithNames.filter(p => p.id !== scorer?.id));
          assisterName = assister?.name;
        }
      } else if (ourPlayers.length > 0) {
        // Fallback to any player in our squad, even if name is missing
        const fallbackPlayer = pick(ourPlayers);
        scorerName = fallbackPlayer?.name || `Player ${i + 1}`;
      } else {
        scorerName = `Southampton Player ${i + 1}`;
      }
      
      events.push({ 
        t, 
        who: 'HOME', 
        kind: 'GOAL',
        scorer: scorerName,
        assister: assisterName,
        team: getClubName()
      });
    }
    
    // Add opponent goals with player details - distribute throughout 90 minutes
    for (let i = 0; i < ga; i++) {
      const t = 10 + Math.floor(Math.random() * 80); // 10-90 minutes
      const scorer = oppPlayersWithNames.length > 0 ? pick(oppPlayersWithNames) : null;
      const assister = (Math.random() < 0.6 && oppPlayersWithNames.length > 1) 
        ? pick(oppPlayersWithNames.filter(p => p.id !== scorer?.id)) 
        : null;
      const oppTeam = currentOpponent()?.team || 'Opposition';
      events.push({ 
        t, 
        who: 'AWAY', 
        kind: 'GOAL',
        scorer: scorer?.name || (oppPlayers.length > 0 ? pick(oppPlayers).name : 'Opposition Player'),
        assister: assister?.name || null,
        team: oppTeam
      });
    }
    
    // Add other events (shots, corners, fouls, cards) - much more common than goals
    const totalEvents = Math.max(12, Math.floor((gf + ga) * 6) + 8);
    for (let i = 0; i < totalEvents; i++) {
      const t = 2 + Math.floor(Math.random() * 88); // 2-90 minutes
      const eventTypes = ['SHOT', 'CORNER', 'FOUL', 'CARD'];
      const eventType = pick(eventTypes);
      const isHome = Math.random() < 0.5;
      const players = isHome ? ourPlayersWithNames : oppPlayersWithNames;
      const player = players.length > 0 ? pick(players) : null;
      
      events.push({
        t,
        who: isHome ? 'HOME' : 'AWAY',
        kind: eventType,
        player: player?.name || null,
        team: isHome ? 'Southampton FC' : (currentOpponent()?.team || 'Opposition')
      });
    }
    
    // Add referee bias events if referee was bribed
    if (S.referee_bribed && (S.referee_bribed === 'us' || S.referee_bribed === 'them')) {
      addRefereeBiasEvents(events, ourPlayersWithNames, oppPlayersWithNames);
    }
    
    // Sort events by time for proper chronological order
    events.sort((a, b) => a.t - b.t);
    
    // Add match atmosphere commentary
    addMatchAtmosphereCommentary(events);
    
    // Store match events for commentary generation outside this function
    S.matchEvents = events;
    
    // Open match viewer with graphics and commentary
    _openMatchViewer();
    
    // Get references to match viewer elements
    const modal = document.getElementById('matchViewer');
    const canvas = document.getElementById('matchCanvas');
    const com = document.getElementById('matchCommentary');
    const tick = document.getElementById('matchTicker');
    
    // Initialize commentary area
    if (com) {
      com.innerHTML = "";
    }
    
    // Start match animation with commentary
    try {
      const result = await _animateMatchWithCommentary(events, canvas, com, tick, gf, ga);
      
      // Close viewer after match completes
      await new Promise(resolve => setTimeout(resolve, 2000)); // Give time to read final commentary
      _closeMatchViewer();
      
      // Update league match stats
      if (winner === "us") {
        S.wins = (S.wins || 0) + 1;
        S.points = (S.points || 0) + 3;
        S.morale = clamp(S.morale + 4, -100, 100);
      } else if (winner === "them") {
        S.losses = (S.losses || 0) + 1;
        S.morale = clamp(S.morale - 6, -100, 100);
      } else {
        S.draws = (S.draws || 0) + 1;
        S.points = (S.points || 0) + 1;
      }
      
      // Log the full-time result
      try {
        const oppName = S.matchContext?.team || currentOpponent().team || "Unknown";
        log(`Full-time: ${getClubName()} ${gf} – ${ga} ${oppName}`);
        
        // Check if this is the stadium fire match
        if (S.preMatch?.stadium_burn_triggered) {
          log(`💥 SUDDENLY: Flames erupt from the stadium!`);
          log(`🔥 The ground shakes as explosions rock St Mary's!`);
          log(`🚨 EMERGENCY: The stadium has been attacked by terrorists!`);
          log(`💣 Multiple bombs have exploded throughout the stadium!`);
          log(`🔥 The stadium is burning down! Flames engulf the stands!`);
          log(`🩸 There's blood and guts everywhere!`);
          log(`😱 Everyone is screaming in terror!`);
        }
        
        // Show match summary with goal scorers
        showMatchSummary(gf, ga, oppName);
      } catch {}
      
      // Special event: if a bribe was accepted but you won anyway
      if (S.accepted_bribe && winner === "us") {
        log('You win anyway and call the rival manager "deranged, sick." Morale surges.');
        S.morale = clamp(S.morale + 8, -100, 100);
        S.reputation = clamp((S.reputation||0) + 5, 0, 100);
      }
      
      return { winner, usGoals: gf, themGoals: ga, score: `${gf}-${ga}` };
    } catch (error) {
      // Handle skip
      _closeMatchViewer();
      const skipBtn = document.getElementById('skipMatchBtn');
      if (skipBtn && skipBtn.dataset.skipped === 'true') {
        const result = await skipToResults();
        return result;
      }
      throw error;
    }
  } else {
    // **Cup/Non-league match simulation** – do not affect league stats
    const opponent = opponentTeam;
    log(`<strong>Fixture:</strong> ${getClubName()} vs ${opponent}`);
    // (Skip Messi fiasco in cup – it will apply in next league match if pending)
    let our = teamStrength();
    let opp = rnd(60, 78) + (["Manchester City","Liverpool","Arsenal"].includes(opponent) ? 5 : 0);
    // Apply global morale perks (but not one-match boosts meant for league)
    our = Math.max(10, Math.min(our, 200));
    opp = Math.max(10, Math.min(opp, 200));
    const [ourXG, oppXG] = expectedGoals(our, opp);
    let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);
    if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
    if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
    if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
    const outcomeStr = gf > ga ? "win" : (gf < ga ? "loss" : "draw");
    log(`Result: ${outcomeStr.toUpperCase()} ${gf}–${ga}.`);
    return outcomeStr;
  }
}

// Generate elite European teams for Champions League
function generateEuroTeams() {
  const euroTeams = [
    'Real Madrid', 'Barcelona', 'Bayern Munich', 'Paris Saint-Germain',
    'Juventus', 'AC Milan', 'Inter Milan', 'Atletico Madrid',
    'Borussia Dortmund', 'Chelsea', 'Manchester United', 'Liverpool',
    'Ajax', 'Porto', 'Benfica', 'Celtic', 'Galatasaray', 'Olympiacos',
    'Shakhtar Donetsk', 'Zenit St. Petersburg', 'Roma', 'Napoli',
    'Sevilla', 'Valencia', 'Lyon', 'Marseille', 'Monaco', 'RB Leipzig',
    'Bayer Leverkusen', 'Tottenham', 'Arsenal', 'Manchester City'
  ];
  return euroTeams;
}

// Lightweight "recent-ish" real-world managers for flavour
const EURO_MANAGER_NAMES = {
  'Real Madrid': 'Carlo Ancelotti',
  'Barcelona': 'Xavi Hernandez',
  'Bayern Munich': 'Thomas Tuchel',
  'Paris Saint-Germain': 'Luis Enrique',
  'Juventus': 'Massimiliano Allegri',
  'AC Milan': 'Stefano Pioli',
  'Inter Milan': 'Simone Inzaghi',
  'Atletico Madrid': 'Diego Simeone',
  'Borussia Dortmund': 'Edin Terzic',
  'Chelsea': 'Mauricio Pochettino',
  'Manchester United': 'Erik ten Hag',
  'Liverpool': 'Jurgen Klopp',
  'Ajax': 'John Heitinga',
  'Porto': 'Sergio Conceicao',
  'Benfica': 'Roger Schmidt',
  'Celtic': 'Brendan Rodgers',
  'Galatasaray': 'Okan Buruk',
  'Olympiacos': 'Carlos Carvalhal',
  'Shakhtar Donetsk': 'Igor Jovicevic',
  'Zenit St. Petersburg': 'Sergei Semak',
  'Roma': 'Jose Mourinho',
  'Napoli': 'Rudi Garcia',
  'Sevilla': 'Julen Lopetegui',
  'Valencia': 'Ruben Baraja',
  'Lyon': 'Laurent Blanc',
  'Marseille': 'Igor Tudor',
  'Monaco': 'Philippe Clement',
  'RB Leipzig': 'Marco Rose',
  'Bayer Leverkusen': 'Xabi Alonso',
  'Tottenham': 'Ange Postecoglou',
  'Arsenal': 'Mikel Arteta',
  'Manchester City': 'Pep Guardiola'
};

function getEuropeanManagerName(team) {
  return EURO_MANAGER_NAMES[team] || 'European Manager';
}

// Lightweight recent national team managers
const NATIONAL_MANAGER_NAMES = {
  'England': 'Gareth Southgate',
  'Brazil': 'Dorival Júnior',
  'Argentina': 'Lionel Scaloni',
  'Germany': 'Julian Nagelsmann',
  'France': 'Didier Deschamps',
  'Spain': 'Luis de la Fuente',
  'Italy': 'Luciano Spalletti',
  'Portugal': 'Roberto Martínez',
  'Netherlands': 'Ronald Koeman',
  'Belgium': 'Domenico Tedesco',
  'Croatia': 'Zlatko Dalic',
  'Serbia': 'Dragan Stojkovic',
  'Japan': 'Hajime Moriyasu',
  'South Korea': 'Jürgen Klinsmann',
  'Mexico': 'Jaime Lozano',
  'USA': 'Gregg Berhalter',
  'Morocco': 'Walid Regragui',
  'Senegal': 'Aliou Cissé',
  'Egypt': 'Hossam Hassan',
  'Nigeria': 'Finidi George',
  'Ghana': 'Otto Addo',
  'Australia': 'Graham Arnold',
  'Poland': 'Michal Probierz',
  'Sweden': 'Janne Andersson',
  'Denmark': 'Kasper Hjulmand',
  'Switzerland': 'Murat Yakin',
  'Turkey': 'Vincenzo Montella',
  'Uruguay': 'Marcelo Bielsa',
  'Colombia': 'Néstor Lorenzo',
  'Canada': 'Jesse Marsch'
};

function getNationalManagerName(team) {
  return NATIONAL_MANAGER_NAMES[team] || 'International Manager';
}

// Real-ish player pools for key national teams, topped up with generic names
const NATIONAL_PLAYER_POOLS = {
  'England': [
    'Harry Kane','Bukayo Saka','Jude Bellingham','Phil Foden','Declan Rice',
    'Kyle Walker','John Stones','Trent Alexander-Arnold','Jordan Pickford',
    'Jack Grealish','Cole Palmer'
  ],
  'Brazil': [
    'Neymar','Vinicius Junior','Rodrygo','Casemiro','Marquinhos',
    'Alisson Becker','Gabriel Jesus','Raphinha','Bruno Guimaraes',
    'Eder Militao','Joao Pedro'
  ],
  'Argentina': [
    'Lionel Messi','Julian Alvarez','Lautaro Martinez','Angel Di Maria',
    'Rodrigo De Paul','Emiliano Martinez','Nicolas Otamendi','Enzo Fernandez',
    'Alexis Mac Allister','Cristian Romero','Nahuel Molina'
  ],
  'France': [
    'Kylian Mbappe','Antoine Griezmann','Ousmane Dembele','Olivier Giroud',
    'Aurelien Tchouameni','Eduardo Camavinga','Theo Hernandez','Mike Maignan',
    'Kingsley Coman','Dayot Upamecano','William Saliba'
  ],
  'Germany': [
    'Jamal Musiala','Florian Wirtz','Kai Havertz','Ilkay Gundogan',
    'Joshua Kimmich','Antonio Rudiger','Manuel Neuer','Leroy Sane',
    'Serge Gnabry','Niclas Fullkrug','Julian Brandt'
  ],
  'Spain': [
    'Rodri','Pedri','Gavi','Alvaro Morata','Dani Olmo',
    'Aymeric Laporte','Unai Simon','Ferran Torres','Marco Asensio',
    'Jordi Alba','Sergio Busquets'
  ],
  'Italy': [
    'Gianluigi Donnarumma','Nicolo Barella','Marco Verratti','Federico Chiesa',
    'Lorenzo Pellegrini','Leonardo Bonucci','Giorgio Chiellini','Jorginho',
    'Andrea Belotti','Domenico Berardi','Matteo Politano'
  ],
  'Portugal': [
    'Cristiano Ronaldo','Bruno Fernandes','Bernardo Silva','Diogo Jota',
    'Ruben Dias','Joao Cancelo','Pepe','Rafael Leao',
    'Vitinha','Joao Felix','Goncalo Ramos'
  ],
  'Netherlands': [
    'Virgil van Dijk','Frenkie de Jong','Memphis Depay','Cody Gakpo',
    'Denzel Dumfries','Matthijs de Ligt','Nathan Ake','Xavi Simons',
    'Steven Bergwijn','Teun Koopmeiners','Noa Lang'
  ],
  'Belgium': [
    'Kevin De Bruyne','Romelu Lukaku','Thibaut Courtois','Youri Tielemans',
    'Yannick Carrasco','Leandro Trossard','Jeremy Doku','Amadou Onana',
    'Axel Witsel','Jan Vertonghen','Thomas Meunier'
  ],
  'Croatia': [
    'Luka Modric','Marcelo Brozovic','Mateo Kovacic','Ivan Perisic',
    'Josko Gvardiol','Andrej Kramaric','Dominik Livakovic',
    'Mislav Orsic','Mario Pasalic','Josip Juranovic','Dejan Lovren'
  ],
  'Japan': [
    'Takumi Minamino','Daichi Kamada','Takefusa Kubo','Wataru Endo',
    'Ritsu Doan','Ko Itakura','Takehiro Tomiyasu','Kaoru Mitoma',
    'Yuya Osako','Maya Yoshida','Hidemasa Morita'
  ],
  'South Korea': [
    'Son Heung-min','Kim Min-jae','Hwang Hee-chan','Lee Kang-in',
    'Hwang Ui-jo','Hwang In-beom','Cho Gue-sung','Jung Woo-young',
    'Kwon Chang-hoon','Kim Young-gwon','Lee Jae-sung'
  ],
  'USA': [
    'Christian Pulisic','Gio Reyna','Weston McKennie','Tyler Adams',
    'Tim Weah','Matt Turner','Sergino Dest','Yunus Musah',
    'Antonee Robinson','Folarin Balogun','Chris Richards'
  ],
  'Mexico': [
    'Hirving Lozano','Raul Jimenez','Guillermo Ochoa','Jesus Corona',
    'Edson Alvarez','Andres Guardado','Hector Herrera','Carlos Vela',
    'Orbelin Pineda','Henry Martin','Diego Lainez'
  ],
  'Morocco': [
    'Achraf Hakimi','Youssef En-Nesyri','Hakim Ziyech','Sofyan Amrabat',
    'Noussair Mazraoui','Yassine Bounou','Azzedine Ounahi',
    'Romain Saiss','Abdelhamid Sabiri','Selim Amallah','Zakaria Aboukhlal'
  ],
  'Egypt': [
    'Mohamed Salah','Trezeguet','Mohamed Elneny','Ahmed Hegazi',
    'Mahmoud Kahraba','Omar Marmoush','Mohamed El-Shenawy',
    'Ali Gabr','Amr El Solia','Ayman Ashraf','Ahmed Fathi'
  ],
  'Nigeria': [
    'Victor Osimhen','Samuel Chukwueze','Alex Iwobi','Wilfred Ndidi',
    'Kelechi Iheanacho','Moses Simon','Emmanuel Dennis',
    'William Troost-Ekong','Leon Balogun','Ahmed Musa','Joe Aribo'
  ],
  'Ghana': [
    'Thomas Partey','Andre Ayew','Jordan Ayew','Mohammed Kudus',
    'Inaki Williams','Daniel Amartey','Alexander Djiku',
    'Baba Rahman','Felix Afena-Gyan','Kamaldeen Sulemana','Yaw Yeboah'
  ],
  'Uruguay': [
    'Luis Suarez','Edinson Cavani','Federico Valverde','Darwin Nunez',
    'Ronald Araujo','Jose Gimenez','Rodrigo Bentancur',
    'Lucas Torreira','Giorgian de Arrascaeta','Diego Godin','Maxi Gomez'
  ]
};

// Generate recognisable national team names for World Cup
function generateNationalTeamPlayers(team) {
  // Preferred pool of actual players
  const pool = NATIONAL_PLAYER_POOLS[team] || [];

  // Generic name generator as fallback / filler
  const commonSurnames = {
    'England': ['Smith', 'Jones', 'Wilson', 'Taylor', 'Brown', 'Williams', 'Davies', 'Johnson'],
    'Brazil': ['Silva', 'Santos', 'Oliveira', 'Souza', 'Ferreira', 'Costa', 'Rodrigues'],
    'Argentina': ['Gonzalez', 'Rodriguez', 'Fernandez', 'Martinez', 'Lopez', 'Garcia'],
    'Germany': ['Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker'],
    'France': ['Martin', 'Bernard', 'Dubois', 'Durand', 'Moreau', 'Laurent', 'Simon'],
    'Spain': ['Garcia', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Martinez'],
    'Italy': ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano'],
    'Portugal': ['Silva', 'Santos', 'Ferreira', 'Oliveira', 'Costa', 'Rodrigues'],
    'Netherlands': ['de Vries', 'Jansen', 'de Boer', 'van den Berg', 'Bakker', 'Visser'],
    'Belgium': ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems'],
    'Croatia': ['Horvat', 'Kovacic', 'Babic', 'Markovic', 'Petrovic'],
    'Serbia': ['Jovanovic', 'Petrovic', 'Nikolic', 'Markovic', 'Stojanovic'],
    'Japan': ['Tanaka', 'Sato', 'Suzuki', 'Yamamoto', 'Watanabe', 'Kobayashi'],
    'South Korea': ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang'],
    'Mexico': ['Garcia', 'Rodriguez', 'Lopez', 'Martinez', 'Hernandez', 'Gonzalez'],
    'USA': ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
  };
  
  const surnames = commonSurnames[team] || ['Smith', 'Jones', 'Wilson', 'Taylor'];
  const firstNames = ['James', 'John', 'Michael', 'David', 'Chris', 'Paul', 'Mark', 'Daniel'];
  
  const players = [];
  // Start with any real players we have
  for (let i = 0; i < pool.length && players.length < 11; i++) {
    players.push(pool[i]);
  }
  // Top up to at least 11 with generic names
  while (players.length < 11) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = surnames[Math.floor(Math.random() * surnames.length)];
    players.push(`${firstName} ${lastName}`);
  }
  return players;
}

// Helper function to temporarily override currentOpponent for Champions League matches
let originalCurrentOpponent = null;
let clOpponentContext = null;

function setChampionsLeagueOpponent(opponentTeam, opponentManager = null) {
  // Store original function if not already stored
  if (!originalCurrentOpponent) {
    originalCurrentOpponent = window.currentOpponent;
  }
  
  // Set the CL opponent context
  clOpponentContext = { team: opponentTeam, manager: opponentManager || 'European Manager' };
  
  // Override currentOpponent to return CL opponent
  window.currentOpponent = function() {
    return clOpponentContext;
  };
}

function restoreCurrentOpponent() {
  if (originalCurrentOpponent) {
    window.currentOpponent = originalCurrentOpponent;
    originalCurrentOpponent = null;
    clOpponentContext = null;
  }
}

// Ensure Champions League opponent has a squad generated
function ensureChampionsLeagueOpponentSquad(opponentTeam) {
  // Use a special index for CL matches to avoid conflicts with league matches
  const clIndex = 9999; // Use a high index that won't conflict with league matches
  if (!Array.isArray(S._opponentSquads)) S._opponentSquads = [];
  
  // Check if we already have a squad for this CL team
  const existingIndex = S._opponentSquads.findIndex((squad, idx) => {
    // Try to find by checking if this index has the right team
    // We'll use a different approach - store CL squads separately
    return false; // Always generate fresh for now
  });
  
  // Generate squad for Champions League team (elite teams have higher base quality)
  const baseQuality = 85; // Elite European teams
  const sz = 8 + Math.floor(Math.random() * 4);
  const pool = [];
  for (let i = 0; i < sz; i++) {
    const p = makePlayer();
    const delta = Math.round((Math.random() * 10) - 5);
    p.rating = Math.max(75, Math.min(97, baseQuality + delta)); // Higher minimum for CL teams
    p.tier = p.rating >= 90 ? "elite" :
             p.rating >= 80 ? "excellent" :
             p.rating >= 70 ? "average" :
             p.rating >= 62 ? "mediocre" : "shit";
    pool.push(p);
  }
  
  // Store in a special CL squad array
  if (!S._clOpponentSquads) S._clOpponentSquads = {};
  S._clOpponentSquads[opponentTeam] = pool;
  S.opponent_today = pool;
  
  return pool;
}

// Champions League blocking match runner - ensures CL matches complete fully before returning
// 
// ACCEPTANCE TESTS (must validate in code comments + quick manual run instructions):
// 1) Start a CL group match, click Quick Sim. You should NOT see Wage Week / Pre-Match again until after the match result + continue.
// 2) After first group match, the standings should show all 4 teams have played 1 match (P=1 each). After 3 matchdays, all teams P=3.
// 3) After QF match at matchday 6, if Southampton advances, logs show the semifinal round was created immediately. Semifinal plays at matchday 9; final at matchday 12.
//
// MANUAL TEST INSTRUCTIONS:
// - Start a new game and qualify for CL
// - Play first group match using Quick Sim - verify no Pre-Match/Wage Week appears until after "Match Complete. Continue?" prompt
// - Check group table after first match - all 4 teams should have P=1
// - Complete all 3 group matches - all teams should have P=3
// - Advance to QF at matchday 6 - check console for "CL: advanced to SEMIFINAL" log
// - Play SF at matchday 9 - check console for "CL: advanced to FINAL" log  
// - Play final at matchday 12
async function runCLMatchBlocking({ opponent, mode, competitionLabel = 'Champions League' }) {
  // Set guard flag to prevent re-entrant Pre-Match/Wage Week
  if (S._matchInProgress) {
    console.warn('CL: Attempted to start match while another match is in progress');
    return null;
  }
  
  S._matchInProgress = true;
  
  try {
    let outcome;
    
    if (mode === 'watch') {
      // Use full watch match system with commentary
      const res = await watchMatchCutscene();
      outcome = {
        usGoals: res.homeGoals,
        themGoals: res.awayGoals,
        winner: res.homeGoals > res.awayGoals ? "us" : (res.awayGoals > res.homeGoals ? "them" : "draw"),
        our_goals: res.homeGoals,
        their_goals: res.awayGoals
      };
      
      // Apply Season 5 survival economy match modifiers
      if (typeof applySeason5MatchModifiers === 'function') {
        outcome = applySeason5MatchModifiers(outcome);
      }
    } else if (mode === 'sim') {
      // Champions League quick sim: use quickSimulateMatchWithLiveOverlay for popout (like league/World Cup matches)
      const result = await quickSimulateMatchWithLiveOverlay();
      const us = result?.usGoals ?? result?.our_goals ?? 0;
      const them = result?.themGoals ?? result?.their_goals ?? 0;
      const winner =
        result?.winner ??
        (us > them ? "us" : us < them ? "them" : "draw");

      outcome = {
        usGoals: us,
        themGoals: them,
        winner,
        our_goals: us,
        their_goals: them
      };
    } else if (mode === 'skip') {
      // Skip to results - simple calculation without detailed commentary
      const ourStrength = teamStrength();
      const oppStrength = rnd(60, 78) + (["Manchester City","Liverpool","Arsenal"].includes(opponent) ? 5 : 0);
      const variance = (Math.random() - 0.5) * 40;
      const ourFinal = Math.max(50, Math.min(100, ourStrength + variance));
      const oppFinal = Math.max(50, Math.min(100, oppStrength + (Math.random() - 0.5) * 30));
      const diff = ourFinal - oppFinal;
      let ourGoals, oppGoals;
      if (diff > 12) {
        ourGoals = Math.floor(Math.random() * 3) + 1;
        oppGoals = Math.floor(Math.random() * 2);
      } else if (diff > -12) {
        ourGoals = Math.floor(Math.random() * 2) + 1;
        oppGoals = Math.floor(Math.random() * 2) + 1;
      } else {
        ourGoals = Math.floor(Math.random() * 2);
        oppGoals = Math.floor(Math.random() * 3) + 1;
      }
      outcome = {
        usGoals: ourGoals,
        themGoals: oppGoals,
        winner: ourGoals > oppGoals ? "us" : (oppGoals > ourGoals ? "them" : "draw"),
        our_goals: ourGoals,
        their_goals: oppGoals
      };
      log(`<strong>Result:</strong> ${getClubName()} ${ourGoals} - ${oppGoals} ${opponent}`);
    } else {
      // Fallback: treat any unexpected option as a bare quick result with no commentary
      let our = teamStrength();
      let opp = rnd(60, 78) + (["Manchester City","Liverpool","Arsenal"].includes(opponent) ? 5 : 0);
      our = Math.max(10, Math.min(our, 200));
      opp = Math.max(10, Math.min(opp, 200));
      const [ourXG, oppXG] = expectedGoals(our, opp);
      let gf = Math.min(poisson(ourXG), 7), ga = Math.min(poisson(oppXG), 7);
      if (S.rnd_perks && S.rnd_perks.facility && Math.random() < 0.07 && ga > 0) ga -= 1;
      if (our - opp > 20 && gf <= ga) gf = Math.min(gf + 1, 7);
      if (opp - our > 20 && ga <= gf) ga = Math.min(ga + 1, 7);
      const winner = gf > ga ? "us" : (gf < ga ? "them" : "draw");

      outcome = {
        usGoals: gf,
        themGoals: ga,
        winner,
        our_goals: gf,
        their_goals: ga
      };
    }
    
    // CRITICAL: Always await the "Match Complete. Continue..." flow before returning
    // This ensures the match UI is fully resolved and user has acknowledged completion
    await waitAdvance("Match Complete", "Match finished. Continue?");
    
    return outcome;
  } finally {
    // Always clear the guard flag, even if an error occurs
    S._matchInProgress = false;
  }
}

// Champions League competition
async function cupRound(competition = 'Champions League') {
  if (competition !== 'Champions League') {
    log("FA Cup is disabled in this build.");
    return;
  }
  
  if (!S.qual_CL && !S.clChampion) {
    log("You have not qualified for the Champions League.");
    return;
  }
  
  // Initialize CL if not active - but check to prevent duplicate initialization
  // Don't re-initialize if CL is already done (eliminated or completed)
  if ((!S.clActive || !S.clGroupStandings || Object.keys(S.clGroupStandings).length === 0) && S.clStage !== 'done') {
    await initializeChampionsLeague();
  }
  
  // Determine what stage we're in
  if (!S.clKnockoutRound) {
    // Group stage
    await playChampionsLeagueGroupMatch();
  } else {
    // Knockout stage
    await playChampionsLeagueKnockoutMatch();
  }
}

async function initializeChampionsLeague() {
  // Prevent duplicate initialization - check if already initialized
  if (S.clActive && S.clGroupStandings && Object.keys(S.clGroupStandings).length > 0) {
    // Already initialized, don't reinitialize
    return;
  }
  
  S.clActive = true;
  S.clEuroTeams = generateEuroTeams();
  
  // Assign Southampton to a random group (1-8)
  S.clGroup = Math.floor(Math.random() * 8) + 1;
  
  // Create group with 3 other elite European teams
  const groupTeams = ['Southampton FC'];
  const availableTeams = [...S.clEuroTeams];
  
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * availableTeams.length);
    groupTeams.push(availableTeams[idx]);
    availableTeams.splice(idx, 1);
  }
  
  // Initialize group standings
  S.clGroupStandings = {};
  groupTeams.forEach(team => {
    S.clGroupStandings[team] = {
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0
    };
  });
  
  S.clGroupMatches = [];
  log(`<strong>🇪🇺 CHAMPIONS LEAGUE - GROUP ${S.clGroup}</strong>`);
  log(`Your group: ${groupTeams.join(', ')}`);
  
  // Schedule group matches (3 matches, one per opponent)
  S.clScheduledMatches = groupTeams.filter(t => t !== 'Southampton FC').map((opp, idx) => ({
    opponent: opp,
    matchday: S.matches_played + idx + 1,
    played: false
  }));
}

async function playChampionsLeagueGroupMatch() {
  // Find next unplayed group match
  const nextMatch = S.clScheduledMatches.find(m => !m.played);
  if (!nextMatch) {
    // Group stage complete, determine if we advance
    await completeChampionsLeagueGroupStage();
    return;
  }
  
  const opponent = nextMatch.opponent;
  
  // Set Champions League opponent context BEFORE any pre-match functions
  const oppManager = getEuropeanManagerName(opponent);
  setChampionsLeagueOpponent(opponent, oppManager);
  
  // Generate opponent squad for Champions League team
  ensureChampionsLeagueOpponentSquad(opponent);
  
  // Set match context (use real manager name where available)
  S.matchContext = { team: opponent, manager: oppManager, roundIndex: S.matches_played };
  S.competition = 'champions_league';
  
  // Pre-match phase for Champions League Group Stage
  log(`<div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7b2cbf 100%); padding: 20px; border-radius: 10px; margin: 20px 0; border: 3px solid #ffd700;">`);
  log(`🌃 [CHAMPIONS LEAGUE NIGHT] <strong>Group ${S.clGroup}</strong>: Southampton FC vs ${opponent}`);
  log(`🔥 European floodlights, hostile ultras, and an away dressing room that smells like fear and disinfectant.`);
  log(`</div>`);
  
  // Use full pre-match phase (includes team selection, tactics, etc.)
  await preMatchPhase();
  
  // Drinking decision before Champions League match
  log("You have a moment before the match begins...");
  const drinkChoice = await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a drink (you might make some obnoxious remarks)' }
  ], 'Pre-match preparation');
  
  if (drinkChoice === 'drink') {
    S.isDrunk = true;
    S.last_drunk_match = Date.now();
    log("You take a swig. You feel more relaxed but perhaps less inhibited...");
  } else {
    S.isDrunk = false;
    log("You stay focused and sober.");
  }
  
  // Kickoff options - same as regular matches
  const how = await choose([
    {key: 'sim', label: 'Quick Simulate'},
    {key: 'skip', label: 'Skip to Results'}
  ], "Kickoff Options");
  
  // Capture opponent at kickoff
  const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: opponent };
  S.matchContext = oppAtKickoff;
  
  // Use blocking match runner to ensure match completes fully before returning
  const outcome = await runCLMatchBlocking({ opponent, mode: how, competitionLabel: 'Champions League' });
  
  if (!outcome) {
    // Match was blocked or failed, restore context and return
    restoreCurrentOpponent();
    S.competition = null;
    return;
  }
  
  const ourGoals = outcome.usGoals || outcome.our_goals || 0;
  const oppGoals = outcome.themGoals || outcome.their_goals || 0;
  
  // Only log result if not already logged by skipToResults() or skip branch
  if (how !== 'sim' && how !== 'skip') {
    log(`<strong>Result:</strong> Southampton FC ${ourGoals} - ${oppGoals} ${opponent}`);
  }
  
  // GROUP FIXTURE FIX: Simulate the other group match (the two teams Southampton is NOT playing)
  // ACCEPTANCE TEST: After first group match, all 4 teams should have P=1. After 3 matchdays, all teams P=3.
  const groupTeams = Object.keys(S.clGroupStandings || {}).filter(Boolean);
  const nonSaints = groupTeams.filter(t => t !== 'Southampton FC' && t !== opponent);
  
  if (nonSaints.length === 2) {
    // Determine the other fixture: the two teams Southampton is NOT playing
    const teamA = nonSaints[0];
    const teamB = nonSaints[1];
    
    // Simulate the other match using the same core match simulation logic
    // Use deterministic team strength calculation for consistency
    let qa = rnd(60, 78);
    let qb = rnd(60, 78);
    const [axg, bxg] = expectedGoals(qa, qb);
    let ga = Math.min(poisson(axg), 7), gb = Math.min(poisson(bxg), 7);
    if (ga === gb) {
      // Small bias to avoid endless draws
      if (Math.random() > 0.5) ga++; else gb++;
    }
    
    // Update standings for the other match
    if (S.clGroupStandings[teamA] && S.clGroupStandings[teamB]) {
      S.clGroupStandings[teamA].P++;
      S.clGroupStandings[teamB].P++;
      S.clGroupStandings[teamA].GF += ga;
      S.clGroupStandings[teamA].GA += gb;
      S.clGroupStandings[teamB].GF += gb;
      S.clGroupStandings[teamB].GA += ga;
      
      if (ga > gb) {
        S.clGroupStandings[teamA].W++;
        S.clGroupStandings[teamA].PTS += 3;
        S.clGroupStandings[teamB].L++;
      } else if (gb > ga) {
        S.clGroupStandings[teamB].W++;
        S.clGroupStandings[teamB].PTS += 3;
        S.clGroupStandings[teamA].L++;
      } else {
        S.clGroupStandings[teamA].D++;
        S.clGroupStandings[teamA].PTS += 1;
        S.clGroupStandings[teamB].D++;
        S.clGroupStandings[teamB].PTS += 1;
      }
      
      S.clGroupStandings[teamA].GD = S.clGroupStandings[teamA].GF - S.clGroupStandings[teamA].GA;
      S.clGroupStandings[teamB].GD = S.clGroupStandings[teamB].GF - S.clGroupStandings[teamB].GA;
      
      // Store the other match result in history for consistency
      if (!S.clGroupMatches) S.clGroupMatches = [];
      S.clGroupMatches.push({opponent: `${teamA} vs ${teamB}`, ourGoals: ga, oppGoals: gb, simulated: true});
      
      log(`📊 Other group fixture: ${teamA} ${ga} - ${gb} ${teamB}`);
    }
  }
  
  // CL-specific morale and reputation dynamics
  if (ourGoals > oppGoals) {
    // CL wins give bigger fan morale boost
    S.fan_morale = Math.min(100, (S.fan_morale || 50) + 5);
    S.reputation = Math.min(100, (S.reputation || 50) + 2);
    log("💫 Champions League victory! Fan morale and reputation surge.");
  } else if (oppGoals > ourGoals) {
    // Heavy CL defeats can hurt morale and board support
    S.morale = Math.max(0, (S.morale || 50) - 3);
    S.board_support = Math.max(0, (S.board_support || 50) - 2);
    log("😞 Champions League defeat stings. Morale and board support dip.");
  }
  
  // Update standings
  S.clGroupStandings['Southampton FC'].P++;
  S.clGroupStandings[opponent].P++;
  S.clGroupStandings['Southampton FC'].GF += ourGoals;
  S.clGroupStandings['Southampton FC'].GA += oppGoals;
  S.clGroupStandings[opponent].GF += oppGoals;
  S.clGroupStandings[opponent].GA += ourGoals;
  
  if (ourGoals > oppGoals) {
    S.clGroupStandings['Southampton FC'].W++;
    S.clGroupStandings['Southampton FC'].PTS += 3;
    S.clGroupStandings[opponent].L++;
  } else if (oppGoals > ourGoals) {
    S.clGroupStandings[opponent].W++;
    S.clGroupStandings[opponent].PTS += 3;
    S.clGroupStandings['Southampton FC'].L++;
  } else {
    S.clGroupStandings['Southampton FC'].D++;
    S.clGroupStandings['Southampton FC'].PTS += 1;
    S.clGroupStandings[opponent].D++;
    S.clGroupStandings[opponent].PTS += 1;
  }
  
  S.clGroupStandings['Southampton FC'].GD = S.clGroupStandings['Southampton FC'].GF - S.clGroupStandings['Southampton FC'].GA;
  S.clGroupStandings[opponent].GD = S.clGroupStandings[opponent].GF - S.clGroupStandings[opponent].GA;
  
  nextMatch.played = true;
  S.clGroupMatches.push({opponent, ourGoals, oppGoals});
  
  // Restore original currentOpponent function
  restoreCurrentOpponent();
  
  // Clear competition flag
  S.competition = null;
  
  // Show group table (but only if not the last match - final table will be shown in completeChampionsLeagueGroupStage)
  if (S.clScheduledMatches && S.clScheduledMatches.some(m => !m.played)) {
    showChampionsLeagueGroupTable();
  }
}

function showChampionsLeagueGroupTable() {
  const standings = Object.entries(S.clGroupStandings).map(([team, data]) => ({
    team, ...data
  })).sort((a, b) => {
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });
  
  log(`<strong>Group ${S.clGroup} Table:</strong>`);
  log(`<pre>Pos  Team                P  W  D  L  GF  GA  GD  PTS
${standings.map((s, i) => `${(i+1).toString().padEnd(3)} ${s.team.padEnd(18)} ${s.P}  ${s.W}  ${s.D}  ${s.L}  ${s.GF.toString().padStart(2)}  ${s.GA.toString().padStart(2)}  ${s.GD.toString().padStart(3)}  ${s.PTS}`).join('\n')}</pre>`);
}

async function completeChampionsLeagueGroupStage() {
  // KNOCKOUT STAGES START HERE:
  // After all 3 group matches are played, if you finish in the top 2 of your group,
  // you advance to the knockout stage (quarterfinals).
  // Knockout matches are scheduled at league matchdays 20, 24, 28, 32, 36.
  // Quarterfinals -> Semifinals -> Final
  
  // NOTE: All group matches have already been simulated in playChampionsLeagueGroupMatch()
  // (including the "other group fixture" matches between non-Southampton teams),
  // so we don't need to simulate them again here. This prevents duplicate matches
  // that would cause teams to have 5 matches instead of 3.
  
  const standings = Object.entries(S.clGroupStandings).map(([team, data]) => ({
    team, ...data
  })).sort((a, b) => {
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });
  
  const ourPosition = standings.findIndex(s => s.team === 'Southampton FC');
  
  log(`<strong>🏆 Champions League Group ${S.clGroup} Complete</strong>`);
  // Show final table after all matches are simulated
  showChampionsLeagueGroupTable();
  
  if (ourPosition < 2) {
    log(`<strong>✅ ADVANCED TO KNOCKOUT STAGE!</strong>`);
    S.clKnockoutRound = 'quarterfinal';
    S.clStage = 'knockout'; // Ensure stage is set to knockout
    await initializeChampionsLeagueKnockouts();
  } else {
    log(`<strong>❌ ELIMINATED from Champions League (finished ${ourPosition + 1}${['st', 'nd', 'rd', 'th'][ourPosition] || 'th'} in group)</strong>`);
    S.clActive = false;
    S.clStage = 'done'; // Mark as done to prevent re-initialization
    S.matchContext = null; // Clear to prevent CL opponents contaminating league
    // Track CL entry result
    if (S.fiveSeasonArc) {
      const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === S.season);
      if (existing >= 0) {
        S.fiveSeasonArc.clEntries[existing].result = 'group';
      } else {
        S.fiveSeasonArc.clEntries.push({season: S.season, result: 'group'});
      }
    }
  }
}

async function initializeChampionsLeagueKnockouts() {
  // Generate 7 other quarterfinalists (elite European teams)
  const available = S.clEuroTeams.filter(t => t !== 'Southampton FC');
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const quarterfinalists = ['Southampton FC', ...shuffled.slice(0, 7)];
  
  // Shuffle again to randomize pairings
  const shuffledTeams = [...quarterfinalists].sort(() => Math.random() - 0.5);
  
  // Create 4 quarterfinal matches
  S.clKnockoutBracket = {
    quarterfinal: [
      {team1: shuffledTeams[0], team2: shuffledTeams[1], winner: null, played: false},
      {team1: shuffledTeams[2], team2: shuffledTeams[3], winner: null, played: false},
      {team1: shuffledTeams[4], team2: shuffledTeams[5], winner: null, played: false},
      {team1: shuffledTeams[6], team2: shuffledTeams[7], winner: null, played: false}
    ],
    semifinal: [],
    final: null
  };
  
  log(`<strong>🏆 Champions League Quarterfinals Draw</strong>`);
  S.clKnockoutBracket.quarterfinal.forEach((match, i) => {
    log(`Q${i+1}: ${match.team1} vs ${match.team2}`);
  });
}

// Helper function to play a single Champions League knockout match
async function playSingleChampionsLeagueKnockoutMatch(opponent, roundName, roundTitle) {
  // Set Champions League opponent context BEFORE any pre-match functions
  const oppManager = getEuropeanManagerName(opponent);
  setChampionsLeagueOpponent(opponent, oppManager);
  
  // Generate opponent squad for Champions League team
  ensureChampionsLeagueOpponentSquad(opponent);
  
  // Set match context
  S.matchContext = { team: opponent, manager: oppManager, roundIndex: S.matches_played };
  S.competition = 'champions_league';
  
  // Pre-match phase for Champions League
  log(`<div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7b2cbf 100%); padding: 20px; border-radius: 10px; margin: 20px 0; border: 3px solid #ffd700;">`);
  log(`🔥 [CHAMPIONS LEAGUE NIGHT] <strong>${roundTitle}</strong>: Southampton FC vs ${opponent}`);
  log(`🌃 The biggest night in European football. The world watches. Your corruption reaches its zenith.`);
  log(`</div>`);
  
  // Use full pre-match phase (includes team selection, tactics, etc.)
  await preMatchPhase();
  
  // Drinking decision before Champions League match
  log("You have a moment before the match begins...");
  const drinkChoice = await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a drink (you might make some obnoxious remarks)' }
  ], 'Pre-match preparation');
  
  if (drinkChoice === 'drink') {
    S.isDrunk = true;
    S.last_drunk_match = Date.now();
    log("You take a swig. You feel more relaxed but perhaps less inhibited...");
  } else {
    S.isDrunk = false;
    log("You stay focused and sober.");
  }
  
  // Kickoff options - same as regular matches
  const how = await choose([
    {key: 'sim', label: 'Quick Simulate'},
    {key: 'skip', label: 'Skip to Results'}
  ], "Kickoff Options");
  
  // Capture opponent at kickoff
  const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: opponent };
  S.matchContext = oppAtKickoff;
  
  // Use blocking match runner to ensure match completes fully before returning
  const outcome = await runCLMatchBlocking({ opponent, mode: how, competitionLabel: 'Champions League' });
  
  if (!outcome) {
    // Match was blocked or failed, restore context and return
    restoreCurrentOpponent();
    S.competition = null;
    return { ourGoals: 0, oppGoals: 0 };
  }
  
  const ourGoals = outcome.usGoals || outcome.our_goals || 0;
  const oppGoals = outcome.themGoals || outcome.their_goals || 0;
  
  // Only log result if not already logged by skipToResults() or skip branch
  if (how !== 'sim' && how !== 'skip') {
    log(`<strong>Result:</strong> Southampton FC ${ourGoals} - ${oppGoals} ${opponent}`);
  }
  
  // Restore original currentOpponent function
  restoreCurrentOpponent();
  
  // Clear competition flag
  S.competition = null;
  
  return { ourGoals, oppGoals };
}

async function playChampionsLeagueKnockoutMatch() {
  if (S.clKnockoutRound === 'quarterfinal') {
    const match = S.clKnockoutBracket.quarterfinal.find(m => !m.played && 
      (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'));
    
    if (!match) {
      // All quarterfinals complete, advance to semis
      await advanceToChampionsLeagueSemifinals();
      return;
    }
    
    const opponent = match.team1 === 'Southampton FC' ? match.team2 : match.team1;
    
    // Play the match using full match system
    const { ourGoals, oppGoals } = await playSingleChampionsLeagueKnockoutMatch(opponent, 'quarterfinal', 'Quarterfinal');
    
    // CL knockout-specific dynamics
    if (ourGoals > oppGoals) {
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 8);
      S.reputation = Math.min(100, (S.reputation || 50) + 5);
      log("💫 Champions League knockout victory! Massive fan morale and reputation boost.");
    } else {
      S.morale = Math.max(0, (S.morale || 50) - 5);
      S.board_support = Math.max(0, (S.board_support || 50) - 3);
      log("😞 Champions League elimination. Morale and board support suffer.");
    }
    
    if (ourGoals > oppGoals) {
      match.winner = 'Southampton FC';
      log(`<strong>✅ ADVANCE TO SEMIFINALS!</strong>`);
    } else {
      match.winner = opponent;
      log(`<strong>❌ ELIMINATED</strong>`);
      S.clActive = false;
      S.matchContext = null; // Clear to prevent CL opponents contaminating league
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === S.season);
        if (existing >= 0) {
          S.fiveSeasonArc.clEntries[existing].result = 'quarterfinal';
        } else {
          S.fiveSeasonArc.clEntries.push({season: S.season, result: 'quarterfinal'});
        }
      }
    }
    
    match.played = true;
    
    // Simulate the other quarterfinals immediately so the bracket can progress
    // This ensures all QFs are complete before we check if we should advance
    for (const other of S.clKnockoutBracket.quarterfinal) {
      if (other === match || other.played) continue;
      const qa = rnd(75, 90);
      const qb = rnd(75, 90);
      const [axg, bxg] = expectedGoals(qa, qb);
      let ga = Math.min(poisson(axg), 7), gb = Math.min(poisson(bxg), 7);
      if (ga === gb) {
        if (Math.random() > 0.5) ga++; else gb++;
      }
      other.winner = ga > gb ? other.team1 : other.team2;
      other.played = true;
    }
    
    // CRITICAL FIX: Immediately advance to semifinals if all quarterfinals are complete AND Southampton advanced
    // This ensures the round is set correctly before the scheduler checks again
    if (S.clKnockoutBracket.quarterfinal.every(m => m.played)) {
      const ourMatch = S.clKnockoutBracket.quarterfinal.find(m => (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'));
      if (ourMatch && ourMatch.winner === 'Southampton FC') {
        await advanceToChampionsLeagueSemifinals();
      }
    }
    
  } else if (S.clKnockoutRound === 'semifinal') {
    const match = S.clKnockoutBracket.semifinal.find(m => !m.played && 
      (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'));
    
    if (!match) {
      await advanceToChampionsLeagueFinal();
      return;
    }
    
    const opponent = match.team1 === 'Southampton FC' ? match.team2 : match.team1;
    
    // Play the match using full match system
    const { ourGoals, oppGoals } = await playSingleChampionsLeagueKnockoutMatch(opponent, 'semifinal', 'Semifinal');
    
    // CL knockout-specific dynamics for semifinal
    if (ourGoals > oppGoals) {
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 10);
      S.reputation = Math.min(100, (S.reputation || 50) + 8);
      log("💫 Champions League semifinal victory! Massive fan morale and reputation boost.");
    } else {
      S.morale = Math.max(0, (S.morale || 50) - 5);
      S.board_support = Math.max(0, (S.board_support || 50) - 3);
      log("😞 Champions League elimination. Morale and board support suffer.");
    }
    
    if (ourGoals > oppGoals) {
      match.winner = 'Southampton FC';
      log(`<strong>✅ ADVANCE TO FINAL!</strong>`);
    } else {
      match.winner = opponent;
      log(`<strong>❌ ELIMINATED</strong>`);
      S.clActive = false;
      S.matchContext = null; // Clear to prevent CL opponents contaminating league
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === S.season);
        if (existing >= 0) {
          S.fiveSeasonArc.clEntries[existing].result = 'semifinal';
        } else {
          S.fiveSeasonArc.clEntries.push({season: S.season, result: 'semifinal'});
        }
      }
    }
    
    match.played = true;
    
    // Simulate the other semi so the final can be generated
    for (const other of S.clKnockoutBracket.semifinal) {
      if (other === match || other.played) continue;
      const qa = rnd(80, 92);
      const qb = rnd(80, 92);
      const [axg, bxg] = expectedGoals(qa, qb);
      let ga = Math.min(poisson(axg), 7), gb = Math.min(poisson(bxg), 7);
      if (ga === gb) {
        if (Math.random() > 0.5) ga++; else gb++;
      }
      other.winner = ga > gb ? other.team1 : other.team2;
      other.played = true;
    }
    
    // CRITICAL FIX: Immediately advance to final if all semifinals are complete AND Southampton advanced
    // This ensures the round is set correctly before the scheduler checks again
    if (S.clKnockoutBracket.semifinal.every(m => m.played)) {
      const ourMatch = S.clKnockoutBracket.semifinal.find(m => (m.team1 === 'Southampton FC' || m.team2 === 'Southampton FC'));
      if (ourMatch && ourMatch.winner === 'Southampton FC') {
        await advanceToChampionsLeagueFinal();
      }
    }
    
  } else if (S.clKnockoutRound === 'final') {
    if (S.clKnockoutBracket.final.played) {
      S.clActive = false;
      return;
    }
    
    const opponent = S.clKnockoutBracket.final.team1 === 'Southampton FC' ? 
      S.clKnockoutBracket.final.team2 : S.clKnockoutBracket.final.team1;
    
    // Play the match using full match system
    const { ourGoals, oppGoals } = await playSingleChampionsLeagueKnockoutMatch(opponent, 'final', 'THE FINAL');
    
    // CL final-specific dynamics
    if (ourGoals > oppGoals) {
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 20);
      S.reputation = Math.min(100, (S.reputation || 50) + 15);
      log("💫💫💫 Champions League final victory! Unprecedented fan morale and reputation surge!");
    } else {
      S.morale = Math.max(0, (S.morale || 50) - 10);
      S.board_support = Math.max(0, (S.board_support || 50) - 5);
      log("😞😞😞 Champions League final defeat. Devastating blow to morale and board support.");
    }
    
    if (ourGoals > oppGoals) {
      S.clKnockoutBracket.final.winner = 'Southampton FC';
      S.clChampion = true;
      
      // Track Champions League title for certificate
      if (!S.playerStats) S.playerStats = {};
      if (typeof S.playerStats.championsLeagueTitles === 'undefined') {
        S.playerStats.championsLeagueTitles = 0;
      }
      S.playerStats.championsLeagueTitles++;
      
      // Immediate celebration flash
      log(`<div id="cl-final-celebration" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; background: linear-gradient(135deg, #ffd700 0%, #ff6b00 50%, #ffd700 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; animation: flashCL 0.3s infinite;">
        <h1 style="font-size: 5rem; color: #000; text-shadow: 4px 4px 8px rgba(255,255,255,0.8); margin: 0; animation: pulseCL 0.5s infinite;">FUCK YES!</h1>
        <h2 style="font-size: 3rem; color: #000; text-shadow: 3px 3px 6px rgba(255,255,255,0.8); margin: 20px 0;">🏆🏆🏆 CHAMPIONS LEAGUE CHAMPIONS! 🏆🏆🏆</h2>
        <style>
          @keyframes flashCL {
            0%, 100% { background: linear-gradient(135deg, #ffd700 0%, #ff6b00 50%, #ffd700 100%); }
            50% { background: linear-gradient(135deg, #ff6b00 0%, #ffd700 50%, #ff6b00 100%); }
          }
          @keyframes pulseCL {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        </style>
      </div>`);
      setTimeout(() => {
        const div = document.getElementById('cl-final-celebration');
        if (div) div.remove();
      }, 3000);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (S.fiveSeasonArc) {
        if (!S.fiveSeasonArc.clWins.includes(S.season)) {
          S.fiveSeasonArc.clWins.push(S.season);
        }
        const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === S.season);
        if (existing >= 0) {
          S.fiveSeasonArc.clEntries[existing].result = 'champion';
        } else {
          S.fiveSeasonArc.clEntries.push({season: S.season, result: 'champion'});
        }
      }
      // Full celebration will happen in awardChampionsLeaguePrizes()
    } else {
      S.clKnockoutBracket.final.winner = opponent;
      log(`<strong>❌ RUNNERS-UP</strong>`);
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.clEntries.findIndex(e => e.season === S.season);
        if (existing >= 0) {
          S.fiveSeasonArc.clEntries[existing].result = 'final';
        } else {
          S.fiveSeasonArc.clEntries.push({season: S.season, result: 'final'});
        }
      }
    }
    
    S.clKnockoutBracket.final.played = true;
    S.clActive = false;
    S.matchContext = null; // Clear to prevent CL opponents contaminating league
  }
}

async function advanceToChampionsLeagueSemifinals() {
  const winners = S.clKnockoutBracket.quarterfinal.map(m => m.winner);
  S.clKnockoutBracket.semifinal = [
    {team1: winners[0], team2: winners[1], winner: null, played: false},
    {team1: winners[2], team2: winners[3], winner: null, played: false}
  ];
  S.clKnockoutRound = 'semifinal';
  log(`<strong>🏆 Champions League Semifinals Draw</strong>`);
  S.clKnockoutBracket.semifinal.forEach((match, i) => {
    log(`SF${i+1}: ${match.team1} vs ${match.team2}`);
  });
}

async function advanceToChampionsLeagueFinal() {
  const winners = S.clKnockoutBracket.semifinal.map(m => m.winner);
  S.clKnockoutBracket.final = {
    team1: winners[0],
    team2: winners[1],
    winner: null,
    played: false
  };
  S.clKnockoutRound = 'final';
  log(`<strong>🏆 Champions League Final</strong>: ${winners[0]} vs ${winners[1]}`);
}

// World Cup Functions
async function handleWorldCupInvitation(season) {
  if (!S.fiveSeasonArc) S.fiveSeasonArc = {plTitles:[], clEntries:[], clWins:[], worldCupInvited:[], worldCupResults:[]};
  
  log(`<div style="border: 2px solid #ff6b00; padding: 16px; margin: 16px 0; background: #fff5e6; border-radius: 8px;"><strong>🌍 WORLD CUP INVITATION</strong></div>`);
  const clubName = getClubName();
  log(`<strong>BREAKING NEWS:</strong> England have decided not to play the World Cup this year due to political correctness.`);
  log(`<strong>${clubName} have been invited to play the World Cup instead.</strong>`);
  
  S.fiveSeasonArc.worldCupInvited.push(season);
  
  const accept = await choose([
    {key: 'yes', label: 'Accept the Invitation'},
    {key: 'no', label: 'Decline (focus on domestic season)'}
  ], 'Will you represent... uh, well, yourself in the World Cup?');
  
  if (accept === 'yes') {
    log(`<strong>✅ ${clubName} will compete in the World Cup!</strong>`);
    await playWorldCupTournament(season);
  } else {
    log(`<strong>You decline. The invitation is respectfully passed on.</strong>`);
    if (S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season) < 0) {
      S.fiveSeasonArc.worldCupResults.push({season, result: 'declined'});
    }
  }
}

async function playWorldCupTournament(season) {
  // Prevent duplicate initialization - check if already initialized
  if (S.worldCupActive && S.worldCupGroupStandings && Object.keys(S.worldCupGroupStandings).length > 0) {
    // Already initialized, don't reinitialize
    return;
  }
  
  S.worldCupActive = true;
  const clubName = getClubName();
  
  // World Cup national teams
  const nationalTeams = [
    'Brazil', 'Argentina', 'Germany', 'France', 'Spain', 'Italy', 
    'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'England', 'Uruguay',
    'Colombia', 'Mexico', 'Japan', 'South Korea', 'USA', 'Canada',
    'Morocco', 'Senegal', 'Egypt', 'Nigeria', 'Ghana', 'Australia',
    'Serbia', 'Poland', 'Sweden', 'Denmark', 'Switzerland', 'Turkey',
    clubName // Us
  ];
  
  // Random group assignment
  const shuffled = nationalTeams.filter(t => t !== clubName)
    .sort(() => Math.random() - 0.5);
  const groupTeams = [clubName, ...shuffled.slice(0, 3)];
  
  S.worldCupGroup = Math.floor(Math.random() * 8) + 1;
  S.worldCupGroupStandings = {};
  groupTeams.forEach(team => {
    S.worldCupGroupStandings[team] = {
      P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, PTS: 0
    };
  });
  S.worldCupGroupMatches = [];
  
  log(`<strong>🌍 WORLD CUP GROUP ${S.worldCupGroup}</strong>`);
  log(`Your group: ${groupTeams.join(', ')}`);
  log(`<em>National teams feature recognisable international players.</em>`);
  
  // Play group stage (3 matches)
  for (const opponent of groupTeams.filter(t => t !== clubName)) {
    await playWorldCupGroupMatch(opponent);
  }
  
  await completeWorldCupGroupStage(season);
}

async function playWorldCupGroupMatch(opponent) {
  // Set match context for World Cup BEFORE any pre-match functions
  const oppManager = getNationalManagerName(opponent);
  const clubName = getClubName();
  S.matchContext = { team: opponent, manager: oppManager, roundIndex: S.matches_played };
  S.competition = 'world_cup';
  
  // Set opponent context similar to Champions League
  setChampionsLeagueOpponent(opponent, oppManager);
  
  // Pre-match phase for World Cup Group Stage
  log(`<div style="background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 50%, #ffa500 100%); padding: 20px; border-radius: 10px; margin: 20px 0; border: 3px solid #ffd700;">`);
  log(`🌍 [WORLD CUP GROUP STAGE]: ${clubName} vs ${opponent}`);
  log(`🇺🇳 Flags everywhere, national anthems echoing, and you, a known criminal, in the technical area.`);
  log(`<em>International encounter - ${generateNationalTeamPlayers(opponent).slice(0, 5).join(', ')} and more representing ${opponent}</em>`);
  log(`</div>`);
  
  // Use full pre-match phase (includes team selection, tactics, etc.)
  await preMatchPhase();
  
  // Drinking decision before World Cup match
  log("You have a moment before the match begins...");
  const drinkChoice = await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a drink (you might make some obnoxious remarks)' }
  ], 'Pre-match preparation');
  
  if (drinkChoice === 'drink') {
    S.isDrunk = true;
    S.last_drunk_match = Date.now();
    log("You take a swig. You feel more relaxed but perhaps less inhibited...");
  } else {
    S.isDrunk = false;
    log("You stay focused and sober.");
  }
  
  const how = await choose([
    {key: 'sim', label: 'Quick Simulate'},
    {key: 'skip', label: 'Skip to Results'}
  ], `World Cup Group Stage`);
  
  // Capture opponent at kickoff
  const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: opponent };
  S.matchContext = oppAtKickoff;
  
  let outcome;
  if (how === 'sim') {
    // World Cup quick sim: use quickSimulateMatchWithLiveOverlay for popout (like league matches)
    const result = await quickSimulateMatchWithLiveOverlay();
    const us = result?.usGoals ?? result?.our_goals ?? 0;
    const them = result?.themGoals ?? result?.their_goals ?? 0;
    const winner =
      result?.winner ??
      (us > them ? "us" : us < them ? "them" : "draw");

    outcome = {
      usGoals: us,
      themGoals: them,
      winner,
      our_goals: us,
      their_goals: them
    };
  } else if (how === 'skip') {
    // Original safe quick-sim path for World Cup (no detailed commentary)
    const ourStrength = teamStrength();
    const oppStrength = 90 + Math.floor(Math.random() * 10);
    const variance = (Math.random() - 0.5) * 40;
    const ourFinal = Math.max(50, Math.min(100, ourStrength + variance));
    const oppFinal = Math.max(50, Math.min(100, oppStrength + (Math.random() - 0.5) * 30));
    const diff = ourFinal - oppFinal;
    let ourGoals, oppGoals;
    if (diff > 12) {
      ourGoals = Math.floor(Math.random() * 3) + 1;
      oppGoals = Math.floor(Math.random() * 2);
    } else if (diff > -12) {
      ourGoals = Math.floor(Math.random() * 2) + 1;
      oppGoals = Math.floor(Math.random() * 2) + 1;
    } else {
      ourGoals = Math.floor(Math.random() * 2);
      oppGoals = Math.floor(Math.random() * 3) + 1;
    }
    outcome = {
      usGoals: ourGoals,
      themGoals: oppGoals,
      winner: ourGoals > oppGoals ? "us" : (oppGoals > ourGoals ? "them" : "draw")
    };
  }
  
  const ourGoals = outcome.usGoals || outcome.our_goals || 0;
  const oppGoals = outcome.themGoals || outcome.their_goals || 0;
  
  log(`<strong>Result:</strong> ${clubName} ${ourGoals} - ${oppGoals} ${opponent}`);
  
  // World Cup-specific dynamics
  if (S.competition === 'world_cup') {
    if (ourGoals > oppGoals) {
      // World Cup wins primarily affect reputation and fan morale
      S.reputation = Math.min(100, (S.reputation || 50) + 5);
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 5);
      log("🌍 World Cup victory! The nation celebrates. Reputation and fan morale surge.");
    } else if (oppGoals > ourGoals) {
      // World Cup losses affect reputation and board support
      S.reputation = Math.max(0, (S.reputation || 50) - 3);
      S.board_support = Math.max(0, (S.board_support || 50) - 2);
      log("😞 World Cup defeat. The nation is disappointed. Reputation and board support dip.");
    }
  }
  
  // Update standings
  S.worldCupGroupStandings[clubName].P++;
  S.worldCupGroupStandings[opponent].P++;
  S.worldCupGroupStandings[clubName].GF += ourGoals;
  S.worldCupGroupStandings[clubName].GA += oppGoals;
  S.worldCupGroupStandings[opponent].GF += oppGoals;
  S.worldCupGroupStandings[opponent].GA += ourGoals;
  
  if (ourGoals > oppGoals) {
    S.worldCupGroupStandings[clubName].W++;
    S.worldCupGroupStandings[clubName].PTS += 3;
    S.worldCupGroupStandings[opponent].L++;
  } else if (oppGoals > ourGoals) {
    S.worldCupGroupStandings[opponent].W++;
    S.worldCupGroupStandings[opponent].PTS += 3;
    S.worldCupGroupStandings[clubName].L++;
  } else {
    S.worldCupGroupStandings[clubName].D++;
    S.worldCupGroupStandings[clubName].PTS += 1;
    S.worldCupGroupStandings[opponent].D++;
    S.worldCupGroupStandings[opponent].PTS += 1;
  }
  
  S.worldCupGroupStandings[clubName].GD = S.worldCupGroupStandings[clubName].GF - S.worldCupGroupStandings[clubName].GA;
  S.worldCupGroupStandings[opponent].GD = S.worldCupGroupStandings[opponent].GF - S.worldCupGroupStandings[opponent].GA;
  
  S.worldCupGroupMatches.push({opponent, ourGoals, oppGoals});
  
  // Restore original currentOpponent function
  restoreCurrentOpponent();
  
  // Clear competition flag
  S.competition = null;
}

async function completeWorldCupGroupStage(season) {
  // Simulate remaining World Cup group fixtures between the other two nations
  const clubName = getClubName();
  const groupTeams = Object.keys(S.worldCupGroupStandings || {}).filter(Boolean);
  const nonSaints = groupTeams.filter(t => t !== clubName);
  if (nonSaints.length === 3) {
    for (let i = 0; i < nonSaints.length; i++) {
      for (let j = i + 1; j < nonSaints.length; j++) {
        const a = nonSaints[i];
        const b = nonSaints[j];
        const qa = 88 + Math.floor(Math.random() * 8);
        const qb = 88 + Math.floor(Math.random() * 8);
        const [axg, bxg] = expectedGoals(qa, qb);
        let ga = Math.min(poisson(axg), 7), gb = Math.min(poisson(bxg), 7);
        if (ga === gb) {
          if (Math.random() > 0.5) ga++; else gb++;
        }
        if (S.worldCupGroupStandings[a] && S.worldCupGroupStandings[b]) {
          S.worldCupGroupStandings[a].P++; S.worldCupGroupStandings[b].P++;
          S.worldCupGroupStandings[a].GF += ga; S.worldCupGroupStandings[a].GA += gb;
          S.worldCupGroupStandings[b].GF += gb; S.worldCupGroupStandings[b].GA += ga;
          if (ga > gb) {
            S.worldCupGroupStandings[a].W++; S.worldCupGroupStandings[a].PTS += 3;
            S.worldCupGroupStandings[b].L++;
          } else if (gb > ga) {
            S.worldCupGroupStandings[b].W++; S.worldCupGroupStandings[b].PTS += 3;
            S.worldCupGroupStandings[a].L++;
          } else {
            S.worldCupGroupStandings[a].D++; S.worldCupGroupStandings[a].PTS += 1;
            S.worldCupGroupStandings[b].D++; S.worldCupGroupStandings[b].PTS += 1;
          }
          S.worldCupGroupStandings[a].GD = S.worldCupGroupStandings[a].GF - S.worldCupGroupStandings[a].GA;
          S.worldCupGroupStandings[b].GD = S.worldCupGroupStandings[b].GF - S.worldCupGroupStandings[b].GA;
        }
      }
    }
  }
  
  const standings = Object.entries(S.worldCupGroupStandings).map(([team, data]) => ({
    team, ...data
  })).sort((a, b) => {
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });
  
  log(`<strong>🌍 World Cup Group ${S.worldCupGroup} Complete</strong>`);
  log(`<pre>Pos  Team                P  W  D  L  GF  GA  GD  PTS
${standings.map((s, i) => `${(i+1).toString().padEnd(3)} ${s.team.padEnd(18)} ${s.P}  ${s.W}  ${s.D}  ${s.L}  ${s.GF.toString().padStart(2)}  ${s.GA.toString().padStart(2)}  ${s.GD.toString().padStart(3)}  ${s.PTS}`).join('\n')}</pre>`);
  
  const ourPosition = standings.findIndex(s => s.team === clubName);
  
  if (ourPosition < 2) {
    log(`<strong>✅ ADVANCED TO ROUND OF 16!</strong>`);
    S.worldCupKnockoutRound = 'r16';
    await initializeWorldCupKnockouts(season);
  } else {
    log(`<strong>❌ ELIMINATED in Group Stage</strong>`);
    S.worldCupActive = false;
    if (S.fiveSeasonArc) {
      if (S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season) < 0) {
        S.fiveSeasonArc.worldCupResults.push({season, result: 'group'});
      }
    }
  }
}

async function initializeWorldCupKnockouts(season) {
  const clubName = getClubName();
  const otherTeams = ['Brazil', 'Argentina', 'Germany', 'France', 'Spain', 'Italy', 
    'Portugal', 'Netherlands', 'Belgium', 'Croatia', 'Uruguay', 'Colombia', 
    'Mexico', 'Japan', 'South Korea', 'Morocco'].sort(() => Math.random() - 0.5);
  
  // Round of 16: 16 teams
  const r16Teams = [clubName, ...otherTeams.slice(0, 15)];
  const shuffled = [...r16Teams].sort(() => Math.random() - 0.5);
  
  S.worldCupBracket = {
    r16: [],
    quarterfinal: [],
    semifinal: [],
    final: null
  };
  
  for (let i = 0; i < 8; i++) {
    S.worldCupBracket.r16.push({
      team1: shuffled[i * 2],
      team2: shuffled[i * 2 + 1],
      winner: null,
      played: false
    });
  }
  
  log(`<strong>🌍 World Cup Round of 16 Draw</strong>`);
  S.worldCupBracket.r16.forEach((match, i) => {
    log(`R16-${i+1}: ${match.team1} vs ${match.team2}`);
  });
  
  await playWorldCupKnockout(season);
}

async function playWorldCupKnockout(season) {
  const clubName = getClubName();
  if (S.worldCupKnockoutRound === 'r16') {
    const match = S.worldCupBracket.r16.find(m => !m.played && 
      (m.team1 === clubName || m.team2 === clubName));
    
    if (!match) {
      await advanceToWorldCupQuarterfinals(season);
      return;
    }
    
    const opponent = match.team1 === clubName ? match.team2 : match.team1;
    await playWorldCupMatch(opponent, 'Round of 16', match, season);
    
    // Simulate other R16 matches if we won
    if (match.winner === clubName) {
      // Simulate remaining R16 matches
      for (const otherMatch of S.worldCupBracket.r16) {
        if (!otherMatch.played && otherMatch !== match) {
          const team1Strength = 85 + Math.floor(Math.random() * 15);
          const team2Strength = 85 + Math.floor(Math.random() * 15);
          const variance = (Math.random() - 0.5) * 30;
          const final1 = Math.max(50, Math.min(100, team1Strength + variance));
          const final2 = Math.max(50, Math.min(100, team2Strength + (Math.random() - 0.5) * 20));
          const diff = final1 - final2;
          let goals1 = Math.floor(Math.random() * 3);
          let goals2 = Math.floor(Math.random() * 3);
          if (diff > 10) goals1++;
          else if (diff < -10) goals2++;
          if (goals1 === goals2) {
            if (Math.random() > 0.5) goals1++;
            else goals2++;
          }
          otherMatch.winner = goals1 > goals2 ? otherMatch.team1 : otherMatch.team2;
          otherMatch.played = true;
        }
      }
      
      // Check if all R16 matches are complete
      if (S.worldCupBracket.r16.every(m => m.played)) {
        await advanceToWorldCupQuarterfinals(season);
      }
    } else if (match.winner !== clubName) {
      S.worldCupActive = false;
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season);
        if (existing >= 0) {
          S.fiveSeasonArc.worldCupResults[existing].result = 'r16';
        } else {
          S.fiveSeasonArc.worldCupResults.push({season, result: 'r16'});
        }
      }
    }
    
  } else if (S.worldCupKnockoutRound === 'quarterfinal') {
    const clubName = getClubName();
    const match = S.worldCupBracket.quarterfinal.find(m => !m.played && 
      (m.team1 === clubName || m.team2 === clubName));
    
    if (!match) {
      await advanceToWorldCupSemifinals(season);
      return;
    }
    
    const opponent = match.team1 === clubName ? match.team2 : match.team1;
    await playWorldCupMatch(opponent, 'Quarterfinal', match, season);
    
    // Simulate other quarterfinal matches if we won
    if (match.winner === clubName) {
      // Simulate remaining quarterfinal matches
      for (const otherMatch of S.worldCupBracket.quarterfinal) {
        if (!otherMatch.played && otherMatch !== match) {
          const team1Strength = 88 + Math.floor(Math.random() * 12);
          const team2Strength = 88 + Math.floor(Math.random() * 12);
          const variance = (Math.random() - 0.5) * 35;
          const final1 = Math.max(50, Math.min(100, team1Strength + variance));
          const final2 = Math.max(50, Math.min(100, team2Strength + (Math.random() - 0.5) * 25));
          const diff = final1 - final2;
          let goals1 = Math.floor(Math.random() * 3);
          let goals2 = Math.floor(Math.random() * 3);
          if (diff > 10) goals1++;
          else if (diff < -10) goals2++;
          if (goals1 === goals2) {
            if (Math.random() > 0.5) goals1++;
            else goals2++;
          }
          otherMatch.winner = goals1 > goals2 ? otherMatch.team1 : otherMatch.team2;
          otherMatch.played = true;
        }
      }
      
      // Check if all quarterfinals are complete
      if (S.worldCupBracket.quarterfinal.every(m => m.played)) {
        await advanceToWorldCupSemifinals(season);
      }
    } else if (match.winner !== clubName) {
      S.worldCupActive = false;
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season);
        if (existing >= 0) {
          S.fiveSeasonArc.worldCupResults[existing].result = 'quarterfinal';
        } else {
          S.fiveSeasonArc.worldCupResults.push({season, result: 'quarterfinal'});
        }
      }
    }
    
  } else if (S.worldCupKnockoutRound === 'semifinal') {
    const clubName = getClubName();
    const match = S.worldCupBracket.semifinal.find(m => !m.played && 
      (m.team1 === clubName || m.team2 === clubName));
    
    if (!match) {
      await advanceToWorldCupFinal(season);
      return;
    }
    
    const opponent = match.team1 === clubName ? match.team2 : match.team1;
    await playWorldCupMatch(opponent, 'Semifinal', match, season);
    
    // Simulate other semifinal matches if we won
    if (match.winner === clubName) {
      // Simulate remaining semifinal matches
      for (const otherMatch of S.worldCupBracket.semifinal) {
        if (!otherMatch.played && otherMatch !== match) {
          const team1Strength = 90 + Math.floor(Math.random() * 10);
          const team2Strength = 90 + Math.floor(Math.random() * 10);
          const variance = (Math.random() - 0.5) * 40;
          const final1 = Math.max(50, Math.min(100, team1Strength + variance));
          const final2 = Math.max(50, Math.min(100, team2Strength + (Math.random() - 0.5) * 30));
          const diff = final1 - final2;
          let goals1 = Math.floor(Math.random() * 3);
          let goals2 = Math.floor(Math.random() * 3);
          if (diff > 10) goals1++;
          else if (diff < -10) goals2++;
          if (goals1 === goals2) {
            if (Math.random() > 0.5) goals1++;
            else goals2++;
          }
          otherMatch.winner = goals1 > goals2 ? otherMatch.team1 : otherMatch.team2;
          otherMatch.played = true;
        }
      }
      
      // Check if all semifinals are complete
      if (S.worldCupBracket.semifinal.every(m => m.played)) {
        await advanceToWorldCupFinal(season);
      }
    } else if (match.winner !== clubName) {
      S.worldCupActive = false;
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season);
        if (existing >= 0) {
          S.fiveSeasonArc.worldCupResults[existing].result = 'semifinal';
        } else {
          S.fiveSeasonArc.worldCupResults.push({season, result: 'semifinal'});
        }
      }
    }
    
  } else if (S.worldCupKnockoutRound === 'final') {
    if (S.worldCupBracket.final.played) {
      S.worldCupActive = false;
      return;
    }
    
    const clubName = getClubName();
    const opponent = S.worldCupBracket.final.team1 === clubName ? 
      S.worldCupBracket.final.team2 : S.worldCupBracket.final.team1;
    
    log(`<strong>🌍 WORLD CUP FINAL</strong>: ${clubName} vs ${opponent}`);
    
    // Set match context for World Cup final
    const oppManager = getNationalManagerName(opponent);
    S.matchContext = { team: opponent, manager: oppManager, roundIndex: S.matches_played };
    S.competition = 'world_cup';
    setChampionsLeagueOpponent(opponent, oppManager);
    
    // Pre-match phase for World Cup final
    await preMatchPhase();
    
    // Drinking decision before World Cup final
    log("You have a moment before the match begins...");
    const drinkChoice = await choose([
      { key: 'sober', label: 'Stay sober and focused' },
      { key: 'drink', label: 'Have a drink (you might make some obnoxious remarks)' }
    ], 'Pre-match preparation');
    
    if (drinkChoice === 'drink') {
      S.isDrunk = true;
      S.last_drunk_match = Date.now();
      log("You take a swig. You feel more relaxed but perhaps less inhibited...");
    } else {
      S.isDrunk = false;
      log("You stay focused and sober.");
    }
    
    const how = await choose([
      {key: 'sim', label: 'Quick Simulate'},
      {key: 'skip', label: 'Skip to Results'}
    ], `THE WORLD CUP FINAL`);
    
    // Capture opponent at kickoff
    const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: opponent };
    S.matchContext = oppAtKickoff;
    
    let ourGoals, oppGoals;
    if (how === 'sim') {
      // World Cup final quick sim: use quickSimulateMatchWithLiveOverlay for popout (like league matches)
      const result = await quickSimulateMatchWithLiveOverlay();
      ourGoals = result?.usGoals ?? result?.our_goals ?? 0;
      oppGoals = result?.themGoals ?? result?.their_goals ?? 0;
    } else if (how === 'skip') {
      // Skip to results path for World Cup final (no detailed commentary)
      const ourStrength = teamStrength();
      const oppStrength = 95 + Math.floor(Math.random() * 5); // Boss-level opposition
      const variance = (Math.random() - 0.5) * 50; // Maximum variance
      const ourFinal = Math.max(50, Math.min(100, ourStrength + variance));
      const oppFinal = Math.max(50, Math.min(100, oppStrength + (Math.random() - 0.5) * 40));
      
      const diff = ourFinal - oppFinal;
      if (diff > 15) {
        ourGoals = Math.floor(Math.random() * 3) + 1;
        oppGoals = Math.floor(Math.random() * 2);
      } else if (diff > -15) {
        ourGoals = Math.floor(Math.random() * 2) + 1;
        oppGoals = Math.floor(Math.random() * 2) + 1;
        // Allow draws for World Cup final
      } else {
        ourGoals = Math.floor(Math.random() * 2);
        oppGoals = Math.floor(Math.random() * 3) + 1;
      }
    }
    
    log(`<strong>Result:</strong> ${clubName} ${ourGoals} - ${oppGoals} ${opponent}`);
    
    // CL final-specific dynamics
    if (S.competition === 'champions_league') {
      if (ourGoals > oppGoals) {
        S.fan_morale = Math.min(100, (S.fan_morale || 50) + 15);
        S.reputation = Math.min(100, (S.reputation || 50) + 10);
        log("💫💫💫 Champions League final victory! Unprecedented fan morale and reputation surge!");
      } else {
        S.morale = Math.max(0, (S.morale || 50) - 8);
        S.board_support = Math.max(0, (S.board_support || 50) - 5);
        log("😞😞😞 Champions League final defeat. Devastating blow to morale and board support.");
      }
    }
    
    // Check for draw - World Cup final goes to penalties
    let penaltyWinner = null;
    if (ourGoals === oppGoals) {
      await delay(2000);
      log(`<strong>🏆 The World Cup Final ends in a draw! The match will be decided by penalties.</strong>`);
      await delay(2000);
      
      // Play penalty shootout with starting five players
      penaltyWinner = await playWorldCupPenalties(opponent);
      
      if (penaltyWinner === 'us') {
        log(`<strong>🏆 ${clubName} WIN THE WORLD CUP ON PENALTIES!</strong>`);
      } else if (penaltyWinner === 'them') {
        log(`<strong>💔 ${opponent} WIN THE WORLD CUP ON PENALTIES</strong>`);
      } else if (penaltyWinner === 'erotic_breasts') {
        // Random winner based on "most erotic breasts"
        const randomWinner = Math.random() > 0.5;
        await delay(2000);
        log(`<strong>🏆 After an unprecedented penalty shootout draw, FIFA officials convene...</strong>`);
        await delay(2000);
        log(`<strong>"The World Cup will be awarded to whichever nation's women have the most erotic breasts."</strong>`);
        await delay(3000);
        log(`<strong>🏆 FIFA awards the World Cup to... ${randomWinner ? clubName : opponent}!</strong>`);
        await delay(2000);
        
        penaltyWinner = randomWinner ? 'us' : 'them';
      }
    }
    
    if (ourGoals > oppGoals || (ourGoals === oppGoals && penaltyWinner === 'us')) {
      S.worldCupBracket.final.winner = clubName;
      
      // MASSIVE WORLD CUP VICTORY CELEBRATION WITH FLASHING EFFECTS
      log(`<div id="wc-celebration" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; background: linear-gradient(135deg, #ff6b00 0%, #ffd700 50%, #ff6b00 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; animation: flashWC 0.3s infinite;">
        <h1 style="font-size: 5rem; color: #000; text-shadow: 4px 4px 8px rgba(255,255,255,0.8); margin: 0; animation: pulseWC 0.5s infinite;">FUCK YES!</h1>
        <h2 style="font-size: 3rem; color: #000; text-shadow: 3px 3px 6px rgba(255,255,255,0.8); margin: 20px 0;">🏆🏆🏆 WORLD CUP CHAMPIONS! 🏆🏆🏆</h2>
        <p style="font-size: 2rem; color: #000; text-shadow: 2px 2px 4px rgba(255,255,255,0.8); margin: 10px 0;">You have conquered the planet!</p>
        <style>
          @keyframes flashWC {
            0%, 100% { background: linear-gradient(135deg, #ff6b00 0%, #ffd700 50%, #ff6b00 100%); }
            50% { background: linear-gradient(135deg, #ffd700 0%, #ff6b00 50%, #ffd700 100%); }
          }
          @keyframes pulseWC {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        </style>
      </div>`);
      
      // Remove the flashing div after 3 seconds
      setTimeout(() => {
        const div = document.getElementById('wc-celebration');
        if (div) div.remove();
      }, 3000);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      log("🏆🏆🏆 WORLD CUP CHAMPIONS! You have conquered the planet.");
      log("[GLOBAL NEWS] 'The most scandal-soaked World Cup run in history ends in glory.'");
      log(`[TABLOID] 'Hero or monster? ${clubName} chairman delivers world title.'`);
      log(`[BBC SPORT] 'In a stunning turn of events, ${clubName} lift the World Cup. Questions remain about the referee's bank account.'`);
      log("[SKY SPORTS] 'The most chaotic World Cup victory ever witnessed. The world is in shock.'");
      
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season);
        if (existing >= 0) {
          S.fiveSeasonArc.worldCupResults[existing].result = 'champion';
        } else {
          S.fiveSeasonArc.worldCupResults.push({season, result: 'champion'});
        }
      }
      
      // Set World Cup hero status
      S.worldCupHeroStatus = true;
      
      // Track World Cup title for certificate
      if (!S.playerStats) S.playerStats = {};
      if (typeof S.playerStats.worldCupTitles === 'undefined') {
        S.playerStats.worldCupTitles = 0;
      }
      S.playerStats.worldCupTitles++;
      
      // Massive prestige boost
      S.reputation = Math.min(100, (S.reputation || 50) + 30);
      S.morale = Math.min(100, (S.morale || 50) + 30);
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 30);
      S.board_support = Math.min(100, (S.board_support || 50) + 25);
      
      log("📈 Reputation +30 | Morale +30 | Fan Morale +30 | Board Support +25");
      
      const prizeMoney = 50000000; // 50 million
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(prizeMoney);
      } else {
        S.club_cash = (S.club_cash || 0) + prizeMoney;
      }
      log(`💶 International bonus: ${money(prizeMoney)} for World Cup victory.`);
      
      // Add World Cup trophy to inventory
      if (typeof window.addAccoladeToInventory === 'function') {
        window.addAccoladeToInventory('World Cup Trophy', 15000000);
        log(`🏆 World Cup Trophy added to your inventory. You can sell it for money or trade it for points.`);
      }
    } else if (ourGoals < oppGoals || (ourGoals === oppGoals && penaltyWinner === 'them')) {
      S.worldCupBracket.final.winner = opponent;
      log(`<strong>❌ RUNNERS-UP</strong>`);
      if (S.fiveSeasonArc) {
        const existing = S.fiveSeasonArc.worldCupResults.findIndex(r => r.season === season);
        if (existing >= 0) {
          S.fiveSeasonArc.worldCupResults[existing].result = 'final';
        } else {
          S.fiveSeasonArc.worldCupResults.push({season, result: 'final'});
        }
      }
      if (typeof addMoneyClub === 'function') {
        addMoneyClub(25000000); // Runner-up prize
      } else {
        S.club_cash = (S.club_cash || 0) + 25000000;
      }
    }
    
    S.worldCupBracket.final.played = true;
    S.worldCupActive = false;
  }
}

async function playWorldCupMatch(opponent, roundName, match, season) {
  // Set match context for World Cup BEFORE any pre-match functions
  const oppManager = getNationalManagerName(opponent);
  S.matchContext = { team: opponent, manager: oppManager, roundIndex: S.matches_played };
  S.competition = 'world_cup';
  
  // Set opponent context similar to Champions League
  setChampionsLeagueOpponent(opponent, oppManager);
  
  // Pre-match phase for World Cup
  const clubName = getClubName();
  log(`<div style="background: linear-gradient(135deg, #ff6b00 0%, #ff8c00 50%, #ffa500 100%); padding: 20px; border-radius: 10px; margin: 20px 0; border: 3px solid #ffd700;">`);
  log(`🌍 [WORLD CUP ${roundName.toUpperCase()}]: ${clubName} vs ${opponent}`);
  log(`🇺🇳 Flags everywhere, national anthems echoing, and you, a known criminal, in the technical area.`);
  log(`<em>International clash - ${generateNationalTeamPlayers(opponent).slice(0, 5).join(', ')} and more representing ${opponent}</em>`);
  log(`</div>`);
  
  // Use full pre-match phase (includes team selection, tactics, etc.)
  await preMatchPhase();
  
  // Drinking decision before World Cup match
  log("You have a moment before the match begins...");
  const drinkChoice = await choose([
    { key: 'sober', label: 'Stay sober and focused' },
    { key: 'drink', label: 'Have a drink (you might make some obnoxious remarks)' }
  ], 'Pre-match preparation');
  
  if (drinkChoice === 'drink') {
    S.isDrunk = true;
    S.last_drunk_match = Date.now();
    log("You take a swig. You feel more relaxed but perhaps less inhibited...");
  } else {
    S.isDrunk = false;
    log("You stay focused and sober.");
  }
  
  const how = await choose([
    {key: 'sim', label: 'Quick Simulate'},
    {key: 'skip', label: 'Skip to Results'}
  ], `${roundName} - Single Leg`);
  
  // Capture opponent at kickoff
  const oppAtKickoff = (typeof currentOpponent === 'function') ? currentOpponent() : { team: opponent };
  S.matchContext = oppAtKickoff;
  
  let outcome;
  if (how === 'sim') {
    // World Cup knockout quick sim: use quickSimulateMatchWithLiveOverlay for popout (like league matches)
    const result = await quickSimulateMatchWithLiveOverlay();
    const us = result?.usGoals ?? result?.our_goals ?? 0;
    const them = result?.themGoals ?? result?.their_goals ?? 0;
    const winner =
      result?.winner ??
      (us > them ? "us" : us < them ? "them" : "draw");

    outcome = {
      usGoals: us,
      themGoals: them,
      winner,
      our_goals: us,
      their_goals: them
    };
  } else if (how === 'skip') {
    // Skip to results path for World Cup knockouts (no detailed commentary)
    const ourStrength = teamStrength();
    const oppStrength = 92 + Math.floor(Math.random() * 8);
    const variance = (Math.random() - 0.5) * 45;
    const ourFinal = Math.max(50, Math.min(100, ourStrength + variance));
    const oppFinal = Math.max(50, Math.min(100, oppStrength + (Math.random() - 0.5) * 35));
    const diff = ourFinal - oppFinal;
    let ourGoals, oppGoals;
    if (diff > 12) {
      ourGoals = Math.floor(Math.random() * 3) + 1;
      oppGoals = Math.floor(Math.random() * 2);
    } else if (diff > -12) {
      ourGoals = Math.floor(Math.random() * 2) + 1;
      oppGoals = Math.floor(Math.random() * 2) + 1;
      if (ourGoals === oppGoals) {
        if (Math.random() > 0.5) ourGoals++;
        else oppGoals++;
      }
    } else {
      ourGoals = Math.floor(Math.random() * 2);
      oppGoals = Math.floor(Math.random() * 3) + 1;
    }
    outcome = { usGoals: ourGoals, themGoals: oppGoals, winner: ourGoals > oppGoals ? "us" : (oppGoals > ourGoals ? "them" : "draw") };
  }
  
  const ourGoals = outcome.usGoals || outcome.our_goals || 0;
  const oppGoals = outcome.themGoals || outcome.their_goals || 0;
  
  log(`<strong>Result:</strong> ${clubName} ${ourGoals} - ${oppGoals} ${opponent}`);
  
  // World Cup-specific dynamics for knockout matches
  if (S.competition === 'world_cup') {
    if (ourGoals > oppGoals) {
      S.reputation = Math.min(100, (S.reputation || 50) + 8);
      S.fan_morale = Math.min(100, (S.fan_morale || 50) + 8);
      log("🌍 World Cup knockout victory! Massive reputation and fan morale boost.");
    } else {
      S.reputation = Math.max(0, (S.reputation || 50) - 5);
      S.board_support = Math.max(0, (S.board_support || 50) - 3);
      log("😞 World Cup elimination. The nation mourns. Reputation and board support suffer.");
    }
  }
  
  if (ourGoals > oppGoals) {
    match.winner = clubName;
    log(`<strong>✅ ADVANCE!</strong>`);
  } else {
    match.winner = opponent;
    log(`<strong>❌ ELIMINATED</strong>`);
  }
  
  match.played = true;
  
  // Restore original currentOpponent function
  restoreCurrentOpponent();
  
  // Clear competition flag
  S.competition = null;
}

async function advanceToWorldCupQuarterfinals(season) {
  const winners = S.worldCupBracket.r16.map(m => m.winner);
  S.worldCupBracket.quarterfinal = [
    {team1: winners[0], team2: winners[1], winner: null, played: false},
    {team1: winners[2], team2: winners[3], winner: null, played: false},
    {team1: winners[4], team2: winners[5], winner: null, played: false},
    {team1: winners[6], team2: winners[7], winner: null, played: false}
  ];
  S.worldCupKnockoutRound = 'quarterfinal';
  log(`<strong>🌍 World Cup Quarterfinals</strong>`);
  S.worldCupBracket.quarterfinal.forEach((match, i) => {
    log(`QF${i+1}: ${match.team1} vs ${match.team2}`);
  });
  await playWorldCupKnockout(season);
}

async function advanceToWorldCupSemifinals(season) {
  const winners = S.worldCupBracket.quarterfinal.map(m => m.winner);
  S.worldCupBracket.semifinal = [
    {team1: winners[0], team2: winners[1], winner: null, played: false},
    {team1: winners[2], team2: winners[3], winner: null, played: false}
  ];
  S.worldCupKnockoutRound = 'semifinal';
  log(`<strong>🌍 World Cup Semifinals</strong>`);
  S.worldCupBracket.semifinal.forEach((match, i) => {
    log(`SF${i+1}: ${match.team1} vs ${match.team2}`);
  });
  await playWorldCupKnockout(season);
}

async function advanceToWorldCupFinal(season) {
  const winners = S.worldCupBracket.semifinal.map(m => m.winner);
  S.worldCupBracket.final = {
    team1: winners[0],
    team2: winners[1],
    winner: null,
    played: false
  };
  S.worldCupKnockoutRound = 'final';
  log(`<strong>🌍 World Cup Final</strong>: ${winners[0]} vs ${winners[1]}`);
  await playWorldCupKnockout(season);
}


// Lightweight goals generator biased by team strength
function simScore(str){
  // ~Poissonish: 0–4 goals; stronger teams trend higher
  const bias = Math.max(0, (str - 70) / 40); // -? to ~0.5
  const roll = Math.random() + Math.random() + bias; // 0..2+ bias
  if (roll < 0.6) return 0;
  if (roll < 1.2) return 1;
  if (roll < 1.7) return 2;
  if (roll < 2.1) return 3;
  return 4;
}

// Simulate all non-player fixtures in a given round and record them
window.simulateOtherMatchesForRound = function(roundIndex){
  ensureSeasonScheduleAndTable();
  // Use current club name (supports renaming after nuclear option)
  const OUR_CLUB = (typeof getClubName === 'function') ? getClubName() : (S?.club_name || "Southampton FC");
  const rounds = S.rounds || [];
  const matches = rounds[roundIndex] || [];
  
  let simulatedCount = 0;
  for (const [home, away] of matches){
    if (!home || !away) continue;
    // Skip our match; it's already recorded elsewhere
    if (home === OUR_CLUB || away === OUR_CLUB) {
      continue;
    }

    const sh = getTeamMatchStrength(home);   // uses TEAM_QUALITY safely
    const sa = getTeamMatchStrength(away);

    // tiny "home" edge
    const gh = simScore(sh + 2);
    const ga = simScore(sa);

    recordTableResult(home, away, gh, ga);
    simulatedCount++;
  }
}

