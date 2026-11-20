// Debt Payment Modal Functions
function openDebtPaymentModal() {
  if (!S) return;
  
  const modal = document.getElementById('debtPaymentModal');
  if (!modal) return;
  
  // Get current debt and cash amounts
  const clubDebt = (typeof S.club_debt === 'number') ? S.club_debt : (S.debt_club || 0);
  const personalDebt = (typeof S.debt_personal === 'number') ? S.debt_personal : (S.personal_debt || 0);
  const totalDebt = clubDebt + personalDebt;
  const clubCash = S.club_cash || 0;
  const chairmanCash = S.chairman_cash || 0;
  
  if (totalDebt <= 0) {
    log("You have no debt to pay.");
    return;
  }
  
  // Update debt info display
  const infoEl = document.getElementById('debtPaymentInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div><strong>Total Debt:</strong> ${fmtGBP(totalDebt)}</div>
      <div style="margin-top:8px;"><strong>Club Debt:</strong> ${fmtGBP(clubDebt)}</div>
      <div><strong>Personal Debt:</strong> ${fmtGBP(personalDebt)}</div>
    `;
  }
  
  // Update cash displays
  const clubCashEl = document.getElementById('debtClubCashDisplay');
  if (clubCashEl) clubCashEl.textContent = `Available: ${fmtGBP(clubCash)}`;
  
  const chairmanCashEl = document.getElementById('debtChairmanCashDisplay');
  if (chairmanCashEl) chairmanCashEl.textContent = `Available: ${fmtGBP(chairmanCash)}`;
  
  // Set initial payment amount
  const amountInput = document.getElementById('debtPaymentAmount');
  if (amountInput) {
    amountInput.max = totalDebt;
    amountInput.value = Math.min(1000, totalDebt);
  }
  
  // Update payment preview
  updateDebtPaymentPreview();
  
  // Wire up quick amount buttons
  const payQuarter = document.getElementById('debtPayQuarter');
  const payHalf = document.getElementById('debtPayHalf');
  const payThreeQuarters = document.getElementById('debtPayThreeQuarters');
  const payAll = document.getElementById('debtPayAll');
  
  if (payQuarter) payQuarter.onclick = () => {
    if (amountInput) amountInput.value = Math.floor(totalDebt * 0.25);
    updateDebtPaymentPreview();
  };
  if (payHalf) payHalf.onclick = () => {
    if (amountInput) amountInput.value = Math.floor(totalDebt * 0.5);
    updateDebtPaymentPreview();
  };
  if (payThreeQuarters) payThreeQuarters.onclick = () => {
    if (amountInput) amountInput.value = Math.floor(totalDebt * 0.75);
    updateDebtPaymentPreview();
  };
  if (payAll) payAll.onclick = () => {
    if (amountInput) amountInput.value = totalDebt;
    updateDebtPaymentPreview();
  };
  
  // Wire up input change handler
  if (amountInput) {
    amountInput.oninput = updateDebtPaymentPreview;
  }
  
  // Wire up source change handler
  document.querySelectorAll('input[name="debtPaymentSource"]').forEach(radio => {
    radio.onchange = updateDebtPaymentPreview;
  });
  
  // Wire up close/cancel buttons
  const closeBtn = document.getElementById('debtPaymentCloseBtn');
  const cancelBtn = document.getElementById('debtPaymentCancelBtn');
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
  if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
  
  // Wire up confirm button
  const confirmBtn = document.getElementById('debtPaymentConfirmBtn');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
      const source = document.querySelector('input[name="debtPaymentSource"]:checked')?.value || 'club';
      
      if (amount <= 0) {
        log("Please enter a valid amount.");
        return;
      }
      
      if (amount > totalDebt) {
        log(`You can't pay more than your total debt of ${fmtGBP(totalDebt)}.`);
        return;
      }
      
      const availableCash = source === 'club' ? clubCash : chairmanCash;
      if (amount > availableCash) {
        log(`Insufficient ${source === 'club' ? 'club' : 'chairman'} cash. Available: ${fmtGBP(availableCash)}`);
        return;
      }
      
      // Process payment
      let remaining = amount;
      
      // Pay off club debt first
      if (clubDebt > 0 && remaining > 0) {
        const clubPayment = Math.min(clubDebt, remaining);
        S.club_debt = Math.max(0, clubDebt - clubPayment);
        S.debt_club = S.club_debt; // sync legacy key
        remaining -= clubPayment;
      }
      
      // Pay off personal debt with remaining
      if (personalDebt > 0 && remaining > 0) {
        const personalPayment = Math.min(personalDebt, remaining);
        S.debt_personal = Math.max(0, personalDebt - personalPayment);
        remaining -= personalPayment;
      }
      
      // Deduct from cash source
      if (source === 'club') {
        S.club_cash = Math.max(0, clubCash - amount);
      } else {
        S.chairman_cash = Math.max(0, chairmanCash - amount);
      }
      
      log(`✅ Paid ${fmtGBP(amount)} towards debt from ${source === 'club' ? 'club' : 'chairman'} cash.`);
      
      // Check if all debt is now cleared
      const remainingClubDebt = S.club_debt || 0;
      const remainingPersonalDebt = S.debt_personal || 0;
      const totalRemainingDebt = remainingClubDebt + remainingPersonalDebt;
      
      // If club debt is now 0, mark all unresolved unpaid transfers as resolved
      // This prevents agents from asking for payment when debt has been fully paid
      if (remainingClubDebt <= 0) {
        if (S.unpaid_transfers && Array.isArray(S.unpaid_transfers)) {
          let resolvedCount = 0;
          S.unpaid_transfers.forEach(t => {
            if (!t.resolved) {
              t.resolved = true;
              resolvedCount++;
            }
          });
          if (resolvedCount > 0) {
            log(`<strong>✅ Unpaid transfers resolved:</strong> ${resolvedCount} transfer${resolvedCount > 1 ? 's' : ''} marked as paid since club debt is cleared.`);
          }
        }
      }
      
      if (totalRemainingDebt <= 0) {
        // All debt cleared - deactivate creditor if active
        if (S.debt_creditor?.active) {
          S.debt_creditor.active = false;
          S.debt_creditor.principal = 0;
          S.debt_creditor.matches_since_sale = 0;
          log(`<strong>✅ All debt cleared!</strong> The creditor releases their claim. You are no longer being chased for debt.`);
        }
        
        // Clear any court-ordered debts tracking
        if (S.court_ordered_debts && S.court_ordered_debts.length > 0) {
          S.court_ordered_debts = [];
        }
      }
      
      // Update HUD
      if (typeof updateHUD === 'function') updateHUD();
      
      // Close modal
      modal.style.display = 'none';
    };
  }
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
  
  // Show modal
  modal.style.display = 'flex';
}

function updateDebtPaymentPreview() {
  if (!S) return;
  
  const amountInput = document.getElementById('debtPaymentAmount');
  const previewEl = document.getElementById('debtPaymentPreview');
  
  if (!amountInput || !previewEl) return;
  
  const amount = Math.max(0, Math.floor(Number(amountInput.value) || 0));
  const source = document.querySelector('input[name="debtPaymentSource"]:checked')?.value || 'club';
  
  const clubDebt = (typeof S.club_debt === 'number') ? S.club_debt : (S.debt_club || 0);
  const personalDebt = (typeof S.debt_personal === 'number') ? S.debt_personal : (S.personal_debt || 0);
  const totalDebt = clubDebt + personalDebt;
  const clubCash = S.club_cash || 0;
  const chairmanCash = S.chairman_cash || 0;
  const availableCash = source === 'club' ? clubCash : chairmanCash;
  
  let previewText = '';
  
  if (amount <= 0) {
    previewText = '<span style="color:#f44;">Please enter a valid amount.</span>';
  } else if (amount > totalDebt) {
    previewText = `<span style="color:#f44;">Amount exceeds total debt of ${fmtGBP(totalDebt)}.</span>`;
  } else if (amount > availableCash) {
    previewText = `<span style="color:#f44;">Insufficient ${source === 'club' ? 'club' : 'chairman'} cash. Available: ${fmtGBP(availableCash)}.</span>`;
  } else {
    let remaining = amount;
    let clubPayment = 0;
    let personalPayment = 0;
    
    if (clubDebt > 0 && remaining > 0) {
      clubPayment = Math.min(clubDebt, remaining);
      remaining -= clubPayment;
    }
    
    if (personalDebt > 0 && remaining > 0) {
      personalPayment = Math.min(personalDebt, remaining);
      remaining -= personalPayment;
    }
    
    previewText = `
      <div><strong>Payment Breakdown:</strong></div>
      <div style="margin-top:4px;">Club Debt: ${fmtGBP(clubPayment)}</div>
      <div>Personal Debt: ${fmtGBP(personalPayment)}</div>
      <div style="margin-top:8px; color:#0a7;"><strong>Remaining Debt After Payment:</strong> ${fmtGBP(totalDebt - amount)}</div>
    `;
  }
  
  previewEl.innerHTML = previewText;
}

// Cash Transfer Modal Functions
function openCashTransferModal() {
  if (!S) return;
  
  const modal = document.getElementById('cashTransferModal');
  if (!modal) return;
  
  const clubCash = S.club_cash || 0;
  const chairmanCash = S.chairman_cash || 0;
  
  // Update cash displays
  const clubCashEl = document.getElementById('transferClubCashDisplay');
  if (clubCashEl) clubCashEl.textContent = fmtGBP(clubCash);
  
  const chairmanCashEl = document.getElementById('transferChairmanCashDisplay');
  if (chairmanCashEl) chairmanCashEl.textContent = fmtGBP(chairmanCash);
  
  // Set initial transfer amount
  const amountInput = document.getElementById('cashTransferAmount');
  if (amountInput) {
    amountInput.value = 1000;
  }
  
  // Update transfer preview
  updateCashTransferPreview();
  
  // Wire up quick amount buttons
  const transferQuarter = document.getElementById('transferQuarter');
  const transferHalf = document.getElementById('transferHalf');
  const transferThreeQuarters = document.getElementById('transferThreeQuarters');
  const transferAll = document.getElementById('transferAll');
  
  if (transferQuarter) transferQuarter.onclick = () => {
    const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
    const maxAmount = from === 'club' ? clubCash : chairmanCash;
    if (amountInput) amountInput.value = Math.floor(maxAmount * 0.25);
    updateCashTransferPreview();
  };
  if (transferHalf) transferHalf.onclick = () => {
    const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
    const maxAmount = from === 'club' ? clubCash : chairmanCash;
    if (amountInput) amountInput.value = Math.floor(maxAmount * 0.5);
    updateCashTransferPreview();
  };
  if (transferThreeQuarters) transferThreeQuarters.onclick = () => {
    const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
    const maxAmount = from === 'club' ? clubCash : chairmanCash;
    if (amountInput) amountInput.value = Math.floor(maxAmount * 0.75);
    updateCashTransferPreview();
  };
  if (transferAll) transferAll.onclick = () => {
    const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
    const maxAmount = from === 'club' ? clubCash : chairmanCash;
    if (amountInput) amountInput.value = maxAmount;
    updateCashTransferPreview();
  };
  
  // Wire up input change handler
  if (amountInput) {
    amountInput.oninput = updateCashTransferPreview;
  }
  
  // Wire up source change handler
  document.querySelectorAll('input[name="transferFrom"]').forEach(radio => {
    radio.onchange = () => {
      updateCashTransferPreview();
      // Reset amount when switching source
      if (amountInput) {
        const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
        const maxAmount = from === 'club' ? clubCash : chairmanCash;
        amountInput.value = Math.min(1000, maxAmount);
        updateCashTransferPreview();
      }
    };
  });
  
  // Wire up close/cancel buttons
  const closeBtn = document.getElementById('cashTransferCloseBtn');
  const cancelBtn = document.getElementById('cashTransferCancelBtn');
  if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
  if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
  
  // Wire up confirm button
  const confirmBtn = document.getElementById('cashTransferConfirmBtn');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const amount = Math.max(1, Math.floor(Number(amountInput.value) || 0));
      const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
      const to = from === 'club' ? 'chairman' : 'club';
      
      if (amount <= 0) {
        log("Please enter a valid amount.");
        return;
      }
      
      const fromCash = from === 'club' ? clubCash : chairmanCash;
      if (amount > fromCash) {
        log(`Insufficient ${from === 'club' ? 'club' : 'chairman'} cash. Available: ${fmtGBP(fromCash)}`);
        return;
      }
      
      // Perform transfer
      if (from === 'club') {
        S.club_cash = Math.max(0, clubCash - amount);
        S.chairman_cash = (S.chairman_cash || 0) + amount;
      } else {
        S.chairman_cash = Math.max(0, chairmanCash - amount);
        S.club_cash = (S.club_cash || 0) + amount;
      }
      
      log(`✅ Transferred ${fmtGBP(amount)} from ${from === 'club' ? 'club' : 'chairman'} cash to ${to === 'club' ? 'club' : 'chairman'} cash.`);
      
      // Update HUD
      if (typeof updateHUD === 'function') updateHUD();
      
      // Close modal
      modal.style.display = 'none';
    };
  }
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
  
  // Show modal
  modal.style.display = 'flex';
}

function updateCashTransferPreview() {
  if (!S) return;
  
  const amountInput = document.getElementById('cashTransferAmount');
  const previewEl = document.getElementById('cashTransferPreview');
  
  if (!amountInput || !previewEl) return;
  
  const amount = Math.max(0, Math.floor(Number(amountInput.value) || 0));
  const from = document.querySelector('input[name="transferFrom"]:checked')?.value || 'club';
  const to = from === 'club' ? 'chairman' : 'club';
  
  const clubCash = S.club_cash || 0;
  const chairmanCash = S.chairman_cash || 0;
  const fromCash = from === 'club' ? clubCash : chairmanCash;
  const toCash = to === 'club' ? clubCash : chairmanCash;
  
  let previewText = '';
  
  if (amount <= 0) {
    previewText = `<span style="color:#f44;">Please enter a valid amount.</span>`;
  } else if (amount > fromCash) {
    previewText = `<span style="color:#f44;">Insufficient ${from === 'club' ? 'club' : 'chairman'} cash. Available: ${fmtGBP(fromCash)}.</span>`;
  } else {
    const newFromCash = fromCash - amount;
    const newToCash = toCash + amount;
    previewText = `
      <div><strong>Transfer Details:</strong></div>
      <div style="margin-top:4px;">From ${from === 'club' ? '🏦 Club' : '💰 Chairman'} Cash: ${fmtGBP(amount)}</div>
      <div style="margin-top:8px;"><strong>After Transfer:</strong></div>
      <div style="margin-top:4px;">🏦 Club Cash: ${fmtGBP(from === 'club' ? newFromCash : newToCash)}</div>
      <div>💰 Chairman Cash: ${fmtGBP(to === 'club' ? newFromCash : newToCash)}</div>
    `;
  }
  
  previewEl.innerHTML = previewText;
}

// Wire up the transfer button
(function setupTransferButton() {
  const transferBtn = document.getElementById('transferCashBtn');
  if (transferBtn) {
    transferBtn.onclick = openCashTransferModal;
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTransferButton);
  }
})();

// ========== SEASON 4: TINDER & ESTRANGED INTIMACY SYSTEM ==========
// System name: TINDER_DATING_S4

// Initialize Tinder flags
function ensureTinderFlags() {
  if (!S.season4) S.season4 = {};
  if (S.season4.tinder_profile_created === undefined) S.season4.tinder_profile_created = false;
  if (S.season4.profile_facetuned === undefined) S.season4.profile_facetuned = false;
  if (S.season4.tinder_bio === undefined) S.season4.tinder_bio = [];
  if (S.season4.tinder_bio_viewed === undefined) S.season4.tinder_bio_viewed = false;
  if (S.season4.tinder_matches === undefined) S.season4.tinder_matches = [];
  if (S.season4.tinder_active_conversation === undefined) S.season4.tinder_active_conversation = null;
  if (S.season4.tinder_encounters === undefined) S.season4.tinder_encounters = 0;
}

// Bio builder tone categories (reusing quote builder logic)
const TINDER_BIO_CATEGORIES = {
  suave: {
    lines: [
      "i could be youre night in shining armer",
      "i an smoother then  butta",
      "Love stilmunlating convosation",
      "wont something  finer in  this lyf",
      "Wont orthenticty",
      "Got money n aint afraid of money ",
      "Looking for  experence",
      "Lookin for a sefisticated women",
      "Love abit of connection x",
      "Hate snakes x"
    ]
  },
  earnest: {
    lines: [
      "Just trying to find my person",
      "Looking for someone to share life with",
      "Believe in honest communication",
      "Want to build something real",
      "Looking for genuine connection",
      "Value honesty and kindness",
      "Seeking someone who understands",
      "Want to find my best friend",
      "Looking for real love",
      "Believe in second chances"
    ]
  },
  defensive: {
    lines: [
      "I hate  cheats and game players",
      "NO SINGLE MOTHERS ALOUD",
      "Tired of having my fucking time wasted",
      "BPD menaces fuck off",
      "If your pregnant i aint intrested - fuck off",
      "I say it like it is u got a problem thats on u",
      "Just go ahead and ignore me , like all the others",
      "Want some one who finally wont ghost me",
      "Sick of being ghosted",
      "Let me guess , i am too ugly for you ..whatever"
    ]
  },
  ironic: {
    lines: [
      "Just dropped me trousers , ive still got it!",
      "My therapist says I should try this",
      "Looking for someone to split the rent ha ha",
      "my daughter says i deserve pleasure",
      "Probably not what you're looking for",
      "Looking for someone who gets my dark humor xD",
      "Here ironically, staying unironically",
      "My ex said I should try this ha ha",
      "Looking for someone to validate my life choices",
      "My ex wife  is a bitch!"
    ]
  },
  inappropriate: {
    lines: [
      "Got  some nice uncut vintage sausage if your into that",
      "Want someone who can handle my meat",
      "mmmm x",
      "I wont u x",
      "fitties only x",
      "i luv to show of what im made of x",
      "the dirtier the girl the better x",
      "lets get norty",
      "send me a rornchy pic of u",
      "love flirty messeges",
      "satisfy my vintage meat x",
      "do u luv pleasure",
      "love erotic girl",
      "porn lover",
      "u got to be able to handle wilson heh",
      "got a nice big willy for ya",
      "wot ure kink?",
      "lookin for girl who is filth",
      "send me pic of u bent over plz",
      "depserate 4 ssex",
      "if u want hard  shag mmm messege me",
      "horney as fuck",
      "u cud be daddies litttel girl mmm",
      "if u want a dirty man i am ure man",
      "always ready 2 shag",
      "my intrestes are beeer footie and hard shagging 4 hours",
      "will give u my daddy juices",
      "i want to make ure juices flowing",
      "want a sloppy time n 4 it to last til ur red rore",
      "Will make u skwert 4 hour"
    ]
  }
};

// Profile pool
const TINDER_PROFILES = [
  // Always matches profile (if not facetuned)
  {
    name: "Sarah",
    bio: "Love football, good food, and honest people. Looking for someone real.",
    image: "https://www.dropbox.com/scl/fi/u5uihbzv4et1063h7k6gw/Photo-1-2-26-3-03-07-pm-2.jpg?rlkey=899dtfxytcpzcr3y59v1knmj4&st=g3wd92ow&dl=1",
    alwaysMatches: true,
    personality: "enthusiastic"
  },
  // Custom profiles (never match)
  {
    name: "SanMik",
    bio: "Lookin 4 sex xx",
    image: "https://www.dropbox.com/scl/fi/i5yelfr1rh7x5a67dcilw/Photo-1-2-26-3-46-15-pm.jpg?rlkey=z2bgyc0bgo7hvarmedoyh0j7g&st=snm36d1r&dl=1",
    alwaysMatches: false,
    personality: "direct"
  },
  {
    name: "Luke",
    bio: "Looking for love",
    image: "https://www.dropbox.com/scl/fi/jqs0i5pohx1l5eviqy88v/Photo-1-2-26-3-03-07-pm-6.jpg?rlkey=0vf638cd5w553cwpxwrhr0ron&st=qrek1et7&dl=1",
    alwaysMatches: false,
    personality: "romantic"
  },
  // Generic profiles (use normal pictures)
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/t8z3rhmr6z3qaqbpfu0cw/Photo-1-2-26-3-03-07-pm-5.jpg?rlkey=iv9dlvmuf86p0axcsxdu9y4wm&st=6ujrfr3c&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/ly4hq5ixkpf3p8xkot36y/Photo-1-2-26-3-03-07-pm-4-1.jpg?rlkey=h8va4g5h4kpnh1430oxwb294n&st=53flu13v&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/enj5yvk54z7azls1v34rn/Photo-1-2-26-3-03-07-pm-4.jpg?rlkey=83d5fq5b1p7uhc8oa9bhod2zk&st=5mdp488n&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/8v603xcgqa2d10zw8jwu4/Photo-1-2-26-3-03-07-pm-3.jpg?rlkey=tnco730nvgjblwr8h2vgxhiar&st=fsuq4a2w&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/0ypd2zoijwkxo7aoj5yxy/Photo-1-2-26-3-03-07-pm-1.jpg?rlkey=4a0huwn368qerjh74ok28l2b0&st=tx64bzws&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/hf8arj2wvza07o4di2mg1/Photo-1-2-26-3-03-07-pm.jpg?rlkey=zcvlcwxnm74v18t7nm6gedv5e&st=9ju0nxk2&dl=1",
    alwaysMatches: false,
    personality: "generic"
  },
  {
    name: null,
    bio: null,
    image: "https://www.dropbox.com/scl/fi/26zbjygjcb35wei2uopi9/Photo-1-2-26-3-54-54-pm.jpg?rlkey=dj72c8cadw9sqg8r97bel6sam&st=0ooaobhs&dl=1",
    alwaysMatches: false,
    personality: "generic"
  }
];

// Main trigger function - checks if Tinder should be available
async function maybeTinderEvent() {
  if (S.season !== 4) return;
  if (!S.season4 || !S.season4.daughter_suggested_dating) return;
  
  ensureTinderFlags();
  
  // If profile not created, trigger profile creation
  if (!S.season4.tinder_profile_created) {
    await createTinderProfile();
    return;
  }
  
  // Otherwise, Tinder is available as an option in evening events or similar
  // This would be called from the appropriate event trigger
}

// Bio creation via phone UI
async function createTinderBioViaPhoneUI() {
  return new Promise((resolve) => {
    // Create phone UI modal
    const existingModal = document.getElementById('tinder-bio-phone-modal');
    if (existingModal) existingModal.remove();
    
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'tinder-bio-phone-modal';
    modalOverlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    `;
    
    const phoneContainer = document.createElement('div');
    phoneContainer.style.cssText = `
      width: 375px;
      height: 812px;
      max-width: 90vw;
      max-height: 90vh;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      border-radius: 40px;
      padding: 8px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 0 3px rgba(255, 255, 255, 0.1);
      position: relative;
      overflow: hidden;
    `;
    
    const phoneScreen = document.createElement('div');
    phoneScreen.style.cssText = `
      width: 100%;
      height: 100%;
      background: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #FD5068 0%, #FF6B9D 50%, #C44569 100%);
      padding: 16px 20px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    `;
    header.innerHTML = `
      <div style="font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">tinder</div>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      padding: 40px 24px;
      overflow-y: auto;
      background: #ffffff;
    `;
    content.innerHTML = `
      <h2 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">Build Your Bio</h2>
      <p style="font-size: 15px; color: #666; margin-bottom: 32px;">Choose three parts for your bio:</p>
      <div id="bioBuilderContent"></div>
    `;
    
    phoneScreen.appendChild(header);
    phoneScreen.appendChild(content);
    phoneContainer.appendChild(phoneScreen);
    modalOverlay.appendChild(phoneContainer);
    document.body.appendChild(modalOverlay);
    
    const bioContent = document.getElementById('bioBuilderContent');
    let selectedParts = [];
    
    const bioCategories = [
      {key: 'suave', label: 'Suave', variant: 'good'},
      {key: 'earnest', label: 'Earnest', variant: 'good'},
      {key: 'defensive', label: 'Defensive', variant: 'warn'},
      {key: 'ironic', label: 'Ironic', variant: 'neutral'},
      {key: 'inappropriate', label: 'Inappropriate', variant: 'bad'}
    ];
    
    const renderBioBuilder = (step) => {
      bioContent.innerHTML = '';
      
      const stepTitle = document.createElement('div');
      stepTitle.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 24px;
      `;
      stepTitle.textContent = `Part ${step + 1} of 3:`;
      bioContent.appendChild(stepTitle);
      
      bioCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat.label;
        btn.style.cssText = `
          width: 100%;
          padding: 16px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #FD5068 0%, #FF6B9D 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        `;
        btn.onmouseenter = () => {
          btn.style.transform = 'translateY(-2px)';
          btn.style.boxShadow = '0 6px 20px rgba(253, 80, 104, 0.5)';
        };
        btn.onmouseleave = () => {
          btn.style.transform = 'translateY(0)';
          btn.style.boxShadow = 'none';
        };
        btn.onclick = () => {
          selectedParts.push(cat.key);
          if (selectedParts.length < 3) {
            renderBioBuilder(selectedParts.length);
          } else {
            // All parts selected, create bio
            const bioLine1 = pick(TINDER_BIO_CATEGORIES[selectedParts[0]].lines);
            const bioLine2 = pick(TINDER_BIO_CATEGORIES[selectedParts[1]].lines);
            const bioLine3 = pick(TINDER_BIO_CATEGORIES[selectedParts[2]].lines);
            
            S.season4.tinder_bio = [bioLine1, bioLine2, bioLine3];
            
            // STEP 3: Legal Disclaimer (if on register)
            if (S.onKrazyRegister || (S.sex_offender_register && S.sex_offender_register.active)) {
              S.season4.tinder_bio.push("I am legally obliged to inform you that I am a convicted sex offender.");
            }
            
            // Show completion message
            bioContent.innerHTML = `
              <div style="text-align: center; padding: 40px 0;">
                <div style="font-size: 48px; margin-bottom: 24px;">✅</div>
                <div style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px;">Bio Complete!</div>
                <button id="closeBioBuilder" style="
                  background: linear-gradient(135deg, #FD5068 0%, #FF6B9D 100%);
                  color: white;
                  border: none;
                  padding: 16px 48px;
                  border-radius: 30px;
                  font-size: 17px;
                  font-weight: 600;
                  cursor: pointer;
                  margin-top: 24px;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                ">Continue</button>
              </div>
            `;
            
            document.getElementById('closeBioBuilder').onclick = () => {
              modalOverlay.remove();
              resolve();
            };
          }
        };
        bioContent.appendChild(btn);
      });
    };
    
    renderBioBuilder(0);
  });
}

// PART 1: PROFILE CREATION
async function createTinderProfile() {
  try {
    log('');
    log('════════════════════════════════════════');
    log('📱 TINDER PROFILE CREATION');
    log('════════════════════════════════════════');
    log('');
    
    log('You download the app. The interface feels alien, algorithmic.');
    log('');
    
    // STEP 1: Profile Picture Selection
    log('📸 STEP 1: PROFILE PICTURE');
    log('The app prompts you to take a selfie.');
    log('');
    
    await choose([{key: 'continue', label: 'Take selfie'}], 'Ready?');
    
    log('You take a selfie. The app processes it.');
    log('');
    
    const facetuneChoice = await choose([
      {key: 'yes', label: 'Yes, facetune it', variant: 'warn'},
      {key: 'no', label: 'No, use original'}
    ], 'FACETUNE PHOTO?');
    
    if (facetuneChoice === 'yes') {
      S.season4.profile_facetuned = true;
      S.season4.profile_picture = "https://www.dropbox.com/scl/fi/8wxiwvenb6yvvrr60pg8m/Photo-1-2-26-3-45-48-pm.jpg?rlkey=wspfgtgqu30fvodiatwpl9nvb&st=hf8lj6so&dl=1";
      log('You apply filters. Your face looks smoother, younger, less real.');
    } else {
      S.season4.profile_facetuned = false;
      S.season4.profile_picture = "https://www.dropbox.com/scl/fi/euauva77it1j7s6f9d3z0/Photo-1-2-26-3-27-37-pm.png?rlkey=0umutolde14dng9alcxh04jtp&st=dldhztok&dl=1";
      log('You keep the original. It looks honest, unpolished.');
    }
    log('');
    
    // STEP 2: Bio Builder (via phone UI)
    await createTinderBioViaPhoneUI();
    
    S.season4.tinder_profile_created = true;
    S.season4.tinder_bio_viewed = false; // Bio not viewed until first swipe
    log('✅ Profile created. You can now start swiping.');
    log('');
  } catch (e) {
    console.error('[TINDER PROFILE] Error in createTinderProfile:', e);
    console.error('[TINDER PROFILE] Error stack:', e.stack);
    log('An error occurred while creating your profile. Please try again.');
    throw e; // Re-throw to let caller handle it
  }
}

// PART 2: SWIPING SYSTEM

// Validate that the Tinder modal structure is intact
function validateTinderModalStructure(modal) {
  if (!modal) return false;
  if (!modal.isConnected) {
    console.error('[TINDER] Modal exists but is not connected to DOM');
    return false;
  }
  if (modal.innerHTML.length < 100) {
    console.error('[TINDER] Modal innerHTML is suspiciously short:', modal.innerHTML.length);
    return false;
  }
  
  // Check for key structural elements
  const hasPhoneContainer = !!modal.querySelector('.tinder-phone-container');
  const hasPhoneScreen = !!modal.querySelector('.tinder-phone-screen');
  const hasHeader = !!modal.querySelector('.tinder-header');
  const hasContent = !!modal.querySelector('.tinder-content');
  
  
  if (!hasPhoneContainer || !hasPhoneScreen || !hasHeader || !hasContent) {
    console.error('[TINDER] Modal structure is incomplete - missing key containers');
    return false;
  }
  
  return true;
}

// Ensure Tinder modal exists in DOM (fix for missing elements bug)
async function ensureTinderModalExists() {
  // Wait for DOM to be fully ready
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, {once: true});
    });
  }
  
  // Give a delay for browser to finish parsing if needed
  // When continuing from an earlier point, DOM might need more time
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Try multiple times if modal doesn't exist (for cases where DOM is being manipulated)
  let modal = document.getElementById('tinderModal');
  let attempts = 0;
  while ((!modal || !modal.isConnected) && attempts < 3) {
    await new Promise(resolve => setTimeout(resolve, 100));
    modal = document.getElementById('tinderModal');
    attempts++;
  }
  
  // If modal doesn't exist or isn't connected, log error and suggest reload
  if (!modal || !modal.isConnected) {
    console.error('[TINDER] CRITICAL: tinderModal not found in DOM or not connected after waiting.');
    console.error('[TINDER] document.readyState:', document.readyState);
    console.error('[TINDER] modal exists:', !!modal);
    console.error('[TINDER] modal.isConnected:', modal ? modal.isConnected : 'N/A');
    console.error('[TINDER] Please save your game and reload the page.');
    log('ERROR: Tinder interface not loaded properly. Please save your game and reload the page.');
    return false;
  }
  
  // Validate modal structure
  if (!validateTinderModalStructure(modal)) {
    console.error('[TINDER] Modal structure validation failed');
    log('ERROR: Tinder interface structure is corrupted. Please save your game and reload the page.');
    return false;
  }
  
  // Check if critical child elements exist
  const criticalElements = [
    'tinderProfileView',
    'tinderSwipeView',
    'tinderMatchOverlay',
    'tinderCard',
    'tinderCloseBtn',
    'tinderStartBtn',
    'tinderPassBtn',
    'tinderLikeBtn',
    'tinderChatBtn',
    'tinderContinueBtn'
  ];
  
  const missingElements = criticalElements.filter(id => !document.getElementById(id));
  
  if (missingElements.length > 0) {
    console.error('[TINDER] CRITICAL: Missing child elements:', missingElements);
    console.error('[TINDER] All required elements:', criticalElements);
    console.error('[TINDER] Modal exists:', !!modal);
    console.error('[TINDER] Modal has children:', modal ? modal.children.length : 'N/A');
    console.error('[TINDER] document.readyState:', document.readyState);
    
    // Try to debug the modal structure
    if (modal) {
      console.error('[TINDER] Modal innerHTML length:', modal.innerHTML.length);
      console.error('[TINDER] Modal classList:', Array.from(modal.classList));
      console.error('[TINDER] Modal parentNode:', modal.parentNode ? modal.parentNode.nodeName : 'NO PARENT');
      console.error('[TINDER] Modal isConnected:', modal.isConnected);
      // Check if modal has been replaced with something else
      const allElementsInModal = modal.querySelectorAll('*');
      console.error('[TINDER] Total elements in modal:', allElementsInModal.length);
      
      // Try to find the missing elements within the modal using querySelector
      console.error('[TINDER] DEBUG - Searching for missing elements:');
      missingElements.forEach(id => {
        const elInModal = modal.querySelector(`#${id}`);
        const elAnywhere = document.querySelector(`#${id}`);
        console.error(`[TINDER]   ${id}: inModal=${!!elInModal}, anywhere=${!!elAnywhere}`);
      });
      
      // Check if modal innerHTML is empty or corrupted
      if (modal.innerHTML.length < 1000) {
        console.error('[TINDER] MODAL HTML APPEARS CORRUPTED OR EMPTY!');
        console.error('[TINDER] Modal innerHTML:', modal.innerHTML.substring(0, 500));
      }
    }
    
    console.error('[TINDER] Please save your game and reload the page.');
    log('ERROR: Tinder interface incomplete. Missing elements: ' + missingElements.join(', ') + '. Please SAVE YOUR GAME and RELOAD THE PAGE to fix this issue.');
    return false;
  }
  
  return true;
}

async function openTinderSwiping() {
  if (!S.season4 || !S.season4.tinder_profile_created) {
    log("You need to create a profile first.");
    await createTinderProfile();
    return;
  }
  
  ensureTinderFlags();
  
  // Ensure Tinder modal exists before proceeding
  if (!(await ensureTinderModalExists())) {
    return;
  }
  
  // Get modal elements
  const modal = document.getElementById('tinderModal');
  const profileView = document.getElementById('tinderProfileView');
  const swipeView = document.getElementById('tinderSwipeView');
  const closeBtn = document.getElementById('tinderCloseBtn');
  const startBtn = document.getElementById('tinderStartBtn');
  const passBtn = document.getElementById('tinderPassBtn');
  const likeBtn = document.getElementById('tinderLikeBtn');
  const card = document.getElementById('tinderCard');
  const matchOverlay = document.getElementById('tinderMatchOverlay');
  const chatBtn = document.getElementById('tinderChatBtn');
  const continueBtn = document.getElementById('tinderContinueBtn');
  const matchesView = document.getElementById('tinderMatchesView');
  
  // CRITICAL FIX: Double-check that modal and critical elements exist
  // This can happen when continuing from an earlier point if DOM was cleared
  if (!modal || !profileView || !swipeView || !matchOverlay) {
    console.error('[TINDER] Critical elements missing after ensureTinderModalExists check');
    console.error('[TINDER] modal:', !!modal, 'profileView:', !!profileView, 'swipeView:', !!swipeView, 'matchOverlay:', !!matchOverlay);
    // Try to re-check and wait a bit more
    await new Promise(resolve => setTimeout(resolve, 200));
    const retryModal = document.getElementById('tinderModal');
    if (!retryModal) {
      log('ERROR: Tinder interface not available. Please save your game and reload the page.');
      return;
    }
    // If modal exists but other elements don't, the structure might be corrupted
    const retryProfileView = document.getElementById('tinderProfileView');
    const retrySwipeView = document.getElementById('tinderSwipeView');
    if (!retryProfileView || !retrySwipeView) {
      log('ERROR: Tinder interface structure is incomplete. Please save your game and reload the page.');
      return;
    }
    // Re-assign the elements we found
    modal = retryModal;
    profileView = retryProfileView;
    swipeView = retrySwipeView;
    // Re-fetch other elements too
    const retryMatchOverlay = document.getElementById('tinderMatchOverlay');
    if (retryMatchOverlay) matchOverlay = retryMatchOverlay;
  }
  
  // CRITICAL FIX: Remove any existing event listeners from previous Tinder sessions
  // Store handlers on the modal element so we can remove them later
  if (window.__tinderEventHandlers) {
    const handlers = window.__tinderEventHandlers;
    document.removeEventListener('mousemove', handlers.mousemove);
    document.removeEventListener('mouseup', handlers.mouseup);
    document.removeEventListener('touchmove', handlers.touchmove);
    document.removeEventListener('touchend', handlers.touchend);
    if (handlers.cardMousedown) {
      const oldCard = handlers.cardElement;
      if (oldCard) {
        oldCard.removeEventListener('mousedown', handlers.cardMousedown);
        oldCard.removeEventListener('touchstart', handlers.cardTouchstart);
      }
    }
  }
  
  // Reset modal state - ensure all views are in correct initial state
  modal.classList.add('hidden');
  modal.classList.remove('chat-active');
  profileView.classList.remove('hidden');
  swipeView.classList.add('hidden');
  if (matchesView) matchesView.classList.add('hidden');
  const chatView = document.getElementById('tinderChatView');
  if (chatView) chatView.classList.add('hidden');
  matchOverlay.classList.remove('show');
  
  // Reset card state
  if (card) {
    card.style.transition = '';
    card.style.transform = 'translate(0, 0) rotate(0deg)';
    card.style.opacity = '0';
    card.classList.remove('swiping');
  }
  
  // Set up user profile
  const myProfileImg = document.getElementById('tinderMyProfileImg');
  const myProfileName = document.getElementById('tinderMyProfileName');
  const myProfileAge = document.getElementById('tinderMyProfileAge');
  const myProfileBio = document.getElementById('tinderMyProfileBio');
  
  // Set name and age - use full_name (user-generated name from beginning of game)
  // This is very important - the name must be shown
  if (S.full_name) {
    myProfileName.textContent = S.full_name;
    myProfileName.style.display = 'inline-block';
  } else if (S.player_firstname && S.player_surname) {
    myProfileName.textContent = S.player_firstname + ' ' + S.player_surname;
    myProfileName.style.display = 'inline-block';
  } else if (S.chairman_name) {
    myProfileName.textContent = S.chairman_name;
    myProfileName.style.display = 'inline-block';
  } else {
    // Fallback - should not happen if name was chosen at game start
    myProfileName.textContent = 'You';
    myProfileName.style.display = 'inline-block';
  }
  if (S.age) {
    myProfileAge.textContent = S.age;
    myProfileAge.style.display = 'inline-block';
  } else {
    myProfileAge.style.display = 'inline-block';
  }
  
  if (S.season4.profile_picture) {
    myProfileImg.src = S.season4.profile_picture;
    myProfileImg.style.display = 'block';
    myProfileImg.onerror = () => {
      myProfileImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="14"%3EProfile Picture%3C/text%3E%3C/svg%3E';
      myProfileImg.style.display = 'block';
    };
    myProfileImg.onload = () => {
      myProfileImg.style.display = 'block';
    };
  } else {
    myProfileImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="14"%3EProfile Picture%3C/text%3E%3C/svg%3E';
    myProfileImg.style.display = 'block';
  }
  
  // Show bio if it exists
  if (S.season4.tinder_bio && S.season4.tinder_bio.length > 0) {
    myProfileBio.textContent = S.season4.tinder_bio.join('\n');
  } else {
    myProfileBio.textContent = ""; // Hide bio if it doesn't exist
  }
  
  // Generate profile pool
  const profiles = generateTinderProfilePool();
  let currentIndex = 0;
  let isSwiping = false;
  let currentProfile = null;
  
  // Swipe handlers
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  
  // Store event handlers so we can remove them later
  const eventHandlers = {
    cardElement: card,
    mousemove: null,
    mouseup: null,
    touchmove: null,
    touchend: null,
    cardMousedown: null,
    cardTouchstart: null
  };
  
  // Promise resolver for when modal closes
  let modalResolve = null;
  
  // Close button handler
  const closeModal = () => {
    const chatView = document.getElementById('tinderChatView');
    modal.classList.add('hidden');
    modal.classList.remove('chat-active');
    profileView.classList.remove('hidden');
    swipeView.classList.add('hidden');
    if (chatView) chatView.classList.add('hidden');
    if (matchesView) matchesView.classList.add('hidden');
    matchOverlay.classList.remove('show');
    currentIndex = 0;
    isSwiping = false;
    isDragging = false;
    S.season4.tinder_active_conversation = null;
    
    // Remove event listeners when closing
    if (eventHandlers.mousemove) {
      document.removeEventListener('mousemove', eventHandlers.mousemove);
      document.removeEventListener('mouseup', eventHandlers.mouseup);
      document.removeEventListener('touchmove', eventHandlers.touchmove);
      document.removeEventListener('touchend', eventHandlers.touchend);
      if (eventHandlers.cardMousedown && card) {
        card.removeEventListener('mousedown', eventHandlers.cardMousedown);
        card.removeEventListener('touchstart', eventHandlers.cardTouchstart);
      }
      window.__tinderEventHandlers = null;
    }
    
    // Resolve promise if it exists
    if (modalResolve) {
      modalResolve();
      modalResolve = null;
    }
  };
  
  // Check if buttons exist before assigning handlers
  if (!closeBtn) {
    console.error('[TINDER] tinderCloseBtn element not found in DOM');
    return;
  }
  if (!startBtn) {
    console.error('[TINDER] tinderStartBtn element not found in DOM');
    return;
  }
  if (!card) {
    console.error('[TINDER] tinderCard element not found in DOM');
    return;
  }
  
  closeBtn.onclick = closeModal;
  
  // Start swiping button
  startBtn.onclick = () => {
    // Mark bio as viewed when starting to swipe
    if (!S.season4.tinder_bio_viewed) {
      S.season4.tinder_bio_viewed = true;
      // Update bio display now that it's viewed
      if (S.season4.tinder_bio && S.season4.tinder_bio.length > 0) {
        myProfileBio.textContent = S.season4.tinder_bio.join('\n');
      }
    }
    profileView.classList.add('hidden');
    swipeView.classList.remove('hidden');
    showNextProfile();
  };
  
  // Show next profile
  const showNextProfile = () => {
    if (currentIndex >= profiles.length) {
      log('You\'ve seen all available profiles for now.');
      closeModal();
      return;
    }
    
    currentProfile = profiles[currentIndex];
    const cardImg = document.getElementById('tinderCardImg');
    const cardName = document.getElementById('tinderCardName');
    const cardAge = document.getElementById('tinderCardAge');
    const cardBio = document.getElementById('tinderCardBio');
    
    // Check if card elements exist
    if (!cardImg || !cardName || !cardAge || !cardBio) {
      console.error('[TINDER] Card elements not found in DOM');
      return;
    }
    
    // Reset card first
    card.style.transition = '';
    card.style.transform = 'translate(0, 0) rotate(0deg)';
    card.style.opacity = '0';
    card.classList.remove('swiping');
    
    // Clear old image first to prevent flash
    cardImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="400"%3E%3Crect fill="%23f0f0f0" width="320" height="400"/%3E%3C/svg%3E';
    cardImg.style.opacity = '0';
    
    // Update text content while image is hidden
    cardName.textContent = currentProfile.name || 'Unknown';
    cardName.style.display = 'inline-block';
    const age = currentProfile.age || '?';
    cardAge.textContent = age;
    cardAge.style.display = 'inline-block';
    cardBio.textContent = currentProfile.bio || 'No bio available';
    cardBio.style.display = 'block';
    
    // Helper function to convert Dropbox URLs to direct download format
    const convertDropboxUrl = (url) => {
      if (!url || typeof url !== 'string') return url;
      // Check if it's a Dropbox URL
      if (url.includes('dropbox.com')) {
        try {
          const urlObj = new URL(url);
          // If it already has dl=1, ensure raw=1 is also set for images
          if (urlObj.searchParams.has('dl') || urlObj.searchParams.has('raw')) {
            urlObj.searchParams.set('raw', '1');
            urlObj.searchParams.set('dl', '1');
            return urlObj.toString();
          }
          // If no dl parameter, add both raw=1 and dl=1
          urlObj.searchParams.set('raw', '1');
          urlObj.searchParams.set('dl', '1');
          return urlObj.toString();
        } catch (e) {
          // If URL parsing fails, try simple string replacement
          if (url.includes('?') && !url.includes('raw=1')) {
            return url + (url.includes('&') ? '&' : '?') + 'raw=1';
          }
          return url;
        }
      }
      return url;
    };

    // Wait a moment for old image to clear, then load new image
    setTimeout(() => {
      if (currentProfile.image) {
        const imageUrl = convertDropboxUrl(currentProfile.image);
        cardImg.src = imageUrl;
        cardImg.style.display = 'block';
        cardImg.onerror = () => {
          console.warn('Tinder profile image failed to load:', currentProfile.name, currentProfile.image);
          // Try alternative Dropbox URL format if first attempt failed
          if (currentProfile.image.includes('dropbox.com') && !currentProfile.image.includes('raw=1')) {
            const altUrl = currentProfile.image.replace(/[?&]dl=\d/, '').replace(/[?&]st=[^&]*/, '') + 
                          (currentProfile.image.includes('?') ? '&' : '?') + 'raw=1';
            cardImg.src = altUrl;
            cardImg.onerror = () => {
              // Final fallback
              cardImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="400"%3E%3Crect fill="%23ddd" width="320" height="400"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="16"%3EImage not available%3C/text%3E%3C/svg%3E';
              cardImg.style.display = 'block';
              cardImg.style.opacity = '1';
            };
          } else {
            cardImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="400"%3E%3Crect fill="%23ddd" width="320" height="400"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="16"%3EImage not available%3C/text%3E%3C/svg%3E';
            cardImg.style.display = 'block';
            cardImg.style.opacity = '1';
          }
        };
        cardImg.onload = () => {
          cardImg.style.display = 'block';
          cardImg.style.opacity = '1';
        };
      } else {
        cardImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="400"%3E%3Crect fill="%23ddd" width="320" height="400"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="16"%3EImage not available%3C/text%3E%3C/svg%3E';
        cardImg.style.display = 'block';
        cardImg.style.opacity = '1';
      }
      
      // Fade in card
      card.style.transition = 'opacity 0.3s';
      card.style.opacity = '1';
    }, 100);
    
    matchOverlay.classList.remove('show');
    isSwiping = false;
  };
  
  const handleSwipe = (direction) => {
    if (isSwiping || !currentProfile) return;
    isSwiping = true;
    
    const swipeDistance = direction === 'right' ? 1000 : -1000;
    card.style.transition = 'transform 0.3s ease-out';
    card.style.transform = `translate(${swipeDistance}px, 0) rotate(${direction === 'right' ? 30 : -30}deg)`;
    card.style.opacity = '0';
    
    setTimeout(() => {
      if (direction === 'right') {
        handleLike();
      } else {
        handlePass();
      }
    }, 300);
  };
  
  const handleLike = async () => {
    if (!currentProfile) return;
    
    const matches = checkTinderMatch(currentProfile);
    
    if (matches) {
      // It's a match!
      if (!S.season4.tinder_matches.find(m => m.name === currentProfile.name)) {
        S.season4.tinder_matches.push({
          name: currentProfile.name,
          bio: currentProfile.bio,
          image: currentProfile.image,
          personality: currentProfile.personality,
          matched_at: S.matches_played || 0
        });
      }
      
      // Show match overlay with animation
      const matchSubtext = document.getElementById('tinderMatchSubtext');
      matchSubtext.textContent = `You and ${currentProfile.name} liked each other!`;
      
      // Create confetti
      createConfetti();
      
      matchOverlay.classList.add('show');
      
      // Handle chat/continue buttons
      chatBtn.onclick = async () => {
        matchOverlay.classList.remove('show');
        await startTinderConversation(currentProfile);
      };
      
      continueBtn.onclick = () => {
        matchOverlay.classList.remove('show');
        currentIndex++;
        setTimeout(() => {
          showNextProfile();
        }, 300);
      };
    } else {
      // No match, continue
      currentIndex++;
      showNextProfile();
    }
  };
  
  const handlePass = () => {
    currentIndex++;
    showNextProfile();
  };
  
  // Button handlers - check if buttons exist
  if (!likeBtn) {
    console.error('[TINDER] tinderLikeBtn element not found in DOM');
    return;
  }
  if (!passBtn) {
    console.error('[TINDER] tinderPassBtn element not found in DOM');
    return;
  }
  
  likeBtn.onclick = () => handleSwipe('right');
  passBtn.onclick = () => handleSwipe('left');
  
  // Drag handlers for card - store handlers so we can remove them later
  eventHandlers.cardMousedown = (e) => {
    if (isSwiping) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    card.classList.add('swiping');
  };
  
  eventHandlers.mousemove = (e) => {
    if (!isDragging || isSwiping) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    
    const rotation = currentX * 0.1;
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
    
    // Change opacity based on distance
    const distance = Math.abs(currentX);
    const opacity = Math.max(0.3, 1 - distance / 300);
    card.style.opacity = opacity;
  };
  
  eventHandlers.mouseup = () => {
    if (!isDragging || isSwiping) return;
    isDragging = false;
    
    const threshold = 100;
    if (Math.abs(currentX) > threshold) {
      if (currentX > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      // Snap back
      card.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
      card.style.transform = 'translate(0, 0) rotate(0deg)';
      card.style.opacity = '1';
      setTimeout(() => {
        card.classList.remove('swiping');
        card.style.transition = '';
      }, 300);
    }
    
    currentX = 0;
    currentY = 0;
  };
  
  // Touch handlers for mobile
  eventHandlers.cardTouchstart = (e) => {
    if (isSwiping) return;
    isDragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    card.classList.add('swiping');
  };
  
  eventHandlers.touchmove = (e) => {
    if (!isDragging || isSwiping) return;
    const touch = e.touches[0];
    currentX = touch.clientX - startX;
    currentY = touch.clientY - startY;
    
    const rotation = currentX * 0.1;
    card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
    
    const distance = Math.abs(currentX);
    const opacity = Math.max(0.3, 1 - distance / 300);
    card.style.opacity = opacity;
  };
  
  eventHandlers.touchend = () => {
    if (!isDragging || isSwiping) return;
    isDragging = false;
    
    const threshold = 100;
    if (Math.abs(currentX) > threshold) {
      if (currentX > 0) {
        handleSwipe('right');
      } else {
        handleSwipe('left');
      }
    } else {
      card.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
      card.style.transform = 'translate(0, 0) rotate(0deg)';
      card.style.opacity = '1';
      setTimeout(() => {
        card.classList.remove('swiping');
        card.style.transition = '';
      }, 300);
    }
    
    currentX = 0;
    currentY = 0;
  };
  
  // Attach event listeners
  if (card) {
    card.addEventListener('mousedown', eventHandlers.cardMousedown);
    card.addEventListener('touchstart', eventHandlers.cardTouchstart);
  }
  document.addEventListener('mousemove', eventHandlers.mousemove);
  document.addEventListener('mouseup', eventHandlers.mouseup);
  document.addEventListener('touchmove', eventHandlers.touchmove);
  document.addEventListener('touchend', eventHandlers.touchend);
  
  // Store handlers globally so we can clean them up on next open
  window.__tinderEventHandlers = eventHandlers;
  
  // Confetti animation
  const createConfetti = () => {
    const confettiContainer = document.getElementById('tinderMatchConfetti');
    confettiContainer.innerHTML = '';
    
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.5 + 's';
      piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
      confettiContainer.appendChild(piece);
    }
  };
  
  // Close on background click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeModal();
    }
  };
  
  // Show modal after all setup is complete
  modal.classList.remove('hidden');
  
  // Return promise that resolves when modal is closed
  return new Promise((resolve) => {
    modalResolve = resolve;
    // Also check periodically if modal was closed externally
    const checkClose = () => {
      if (modal.classList.contains('hidden')) {
        if (modalResolve) {
          modalResolve();
          modalResolve = null;
        }
      } else {
        setTimeout(checkClose, 100);
      }
    };
    checkClose();
  });
}

// Generate profile pool
function generateTinderProfilePool() {
  const profiles = [];
  
  TINDER_PROFILES.forEach(profileTemplate => {
    const profile = {...profileTemplate};
    
    // Generate name if needed
    if (!profile.name && typeof FEMALE_NAMES !== 'undefined') {
      profile.name = pick(FEMALE_NAMES) + " " + (pick(SURNAMES) || "");
    }
    
    // Generate generic bio if needed
    if (!profile.bio) {
      const genericBios = [
        "Love life, laughter, and good times",
        "Looking for someone special",
        "Enjoy traveling and new experiences",
        "Love good food and good company",
        "Seeking genuine connection",
        "Looking for my person",
        "Love adventures and spontaneity",
        "Seeking meaningful relationship"
      ];
      profile.bio = pick(genericBios);
    }
    
    profile.age = Math.floor(Math.random() * 15) + 25; // 25-40
    
    profiles.push(profile);
  });
  
  // Shuffle profiles
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  
  return profiles;
}

// Check if profile matches
function checkTinderMatch(profile) {
  // If facetuned, everyone matches except Luke and SanMik
  if (S.season4.profile_facetuned) {
    if (profile.name === "Luke" || profile.name === "SanMik") {
      return false;
    }
    return true;
  }
  
  // If not facetuned, only the alwaysMatches profile matches (Sarah)
  if (profile.alwaysMatches) {
    return true;
  }
  
  return false;
}

// PART 3: MESSAGING PHASE
async function startTinderConversation(profile) {
  ensureTinderFlags();
  
  // Ensure Tinder modal exists before proceeding
  if (!(await ensureTinderModalExists())) {
    return;
  }
  
  S.season4.tinder_active_conversation = {
    name: profile.name,
    bio: profile.bio,
    image: profile.image,
    personality: profile.personality,
    messages: []
  };
  
  // Get modal elements
  const modal = document.getElementById('tinderModal');
  const swipeView = document.getElementById('tinderSwipeView');
  const chatView = document.getElementById('tinderChatView');
  const matchesView = document.getElementById('tinderMatchesView');
  const chatHeaderImg = document.getElementById('tinderChatHeaderImg');
  const chatHeaderName = document.getElementById('tinderChatHeaderName');
  const chatMessages = document.getElementById('tinderChatMessages');
  const chatBackBtn = document.getElementById('tinderChatBackBtn');
  const chatCloseBtn = document.getElementById('tinderChatCloseBtn');
  const chatQuickOptions = document.getElementById('tinderChatQuickOptions');
  
  // Set up chat header
  if (profile.image) {
    chatHeaderImg.src = profile.image;
    chatHeaderImg.style.display = 'block';
  } else {
    chatHeaderImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%23ddd" width="40" height="40"/%3E%3C/svg%3E';
  }
  chatHeaderName.textContent = profile.name || 'Unknown';
  
  // Clear previous messages
  chatMessages.innerHTML = '';
  
  // Show chat view, hide swipe view and matches view
  swipeView.classList.add('hidden');
  if (matchesView) matchesView.classList.add('hidden');
  chatView.classList.remove('hidden');
  modal.classList.add('chat-active');
  
  // Initial message from them
  const initialMessages = {
    enthusiastic: [
      "Hey! So excited we matched! 😊",
      "Hi! Love your profile!",
      "Hey there! Great to match with you!",
      "Hi! You seem really interesting!"
    ],
    generic: [
      "Hey",
      "Hi there",
      "Hello",
      "Hi"
    ]
  };
  
  const messageType = profile.personality === 'enthusiastic' ? 'enthusiastic' : 'generic';
  const initialMessage = pick(initialMessages[messageType]);
  
  // Add initial message to chat
  addMessageToChat(profile.name, initialMessage, false);
  
  // Store initial message
  S.season4.tinder_active_conversation.messages.push({
    from: profile.name,
    text: initialMessage,
    timestamp: Date.now()
  });
  
  // Conversation loop
  await tinderConversationLoop(profile);
}

// Helper function to add message to chat UI
function addMessageToChat(sender, text, isYou) {
  const chatMessages = document.getElementById('tinderChatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `tinder-chat-message ${isYou ? 'sent' : 'received'}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'tinder-chat-message-bubble';
  
  // Check if message contains HTML tags (like images)
  if (text.includes('<img') || text.includes('</') || /<[a-z][\s\S]*>/i.test(text)) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }
  
  const time = document.createElement('div');
  time.className = 'tinder-chat-message-time';
  const now = new Date();
  time.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function tinderConversationLoop(profile) {
  const conversation = S.season4.tinder_active_conversation;
  if (!conversation) return;
  
  const chatQuickOptions = document.getElementById('tinderChatQuickOptions');
  const chatCloseBtn = document.getElementById('tinderChatCloseBtn');
  const chatBackBtn = document.getElementById('tinderChatBackBtn');
  const chatView = document.getElementById('tinderChatView');
  const swipeView = document.getElementById('tinderSwipeView');
  
  // Build message options (reuse nightclub seduction dialog tree)
  const messageOptions = [
    {key: 'suave', label: 'Suave message'},
    {key: 'earnest', label: 'Earnest message'},
    {key: 'defensive', label: 'Defensive message'},
    {key: 'ironic', label: 'Ironic message'},
    {key: 'inappropriate', label: 'Inappropriate message'},
    {key: 'attach_cute', label: 'Attach Cute Picture'},
    {key: 'attach_meme', label: 'Attach Meme'},
    {key: 'attach_inappropriate', label: 'Attach Inappropriate Picture'},
    {key: 'attach_raunchy_video', label: 'Send a Raunchy Video'},
    {key: 'invite', label: 'Invite to your house'},
    {key: 'close', label: 'Close conversation'}
  ];
  
  // Populate quick options
  chatQuickOptions.innerHTML = '';
  messageOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.className = 'tinder-chat-quick-option';
    btn.textContent = option.label;
    btn.onclick = async () => {
      await handleTinderMessageChoice(profile, option.key);
    };
    chatQuickOptions.appendChild(btn);
  });
  
  // Close button handler
  chatCloseBtn.onclick = () => {
    const modal = document.getElementById('tinderModal');
    S.season4.tinder_active_conversation = null;
    chatView.classList.add('hidden');
    swipeView.classList.remove('hidden');
    modal.classList.remove('chat-active');
  };
  
  // Back button handler
  chatBackBtn.onclick = () => {
    const modal = document.getElementById('tinderModal');
    S.season4.tinder_active_conversation = null;
    chatView.classList.add('hidden');
    swipeView.classList.remove('hidden');
    modal.classList.remove('chat-active');
  };
}

async function handleTinderMessageChoice(profile, choice) {
  const conversation = S.season4.tinder_active_conversation;
  if (!conversation) return;
  
  if (choice === 'close') {
    const modal = document.getElementById('tinderModal');
    const chatView = document.getElementById('tinderChatView');
    const swipeView = document.getElementById('tinderSwipeView');
    S.season4.tinder_active_conversation = null;
    chatView.classList.add('hidden');
    swipeView.classList.remove('hidden');
    modal.classList.remove('chat-active');
    return;
  }
  
  let messageText = '';
  let attachment = null;
  
  if (choice.startsWith('attach_')) {
    // Handle attachments (reuse existing system)
    const attachType = choice.replace('attach_', '');
    if (attachType === 'cute') {
      attachment = ATTACHMENTS.cuteAnimals[Math.floor(Math.random() * ATTACHMENTS.cuteAnimals.length)];
      messageText = '';
    } else if (attachType === 'meme') {
      attachment = ATTACHMENTS.meme[Math.floor(Math.random() * ATTACHMENTS.meme.length)];
      messageText = '';
    } else if (attachType === 'inappropriate') {
      attachment = ATTACHMENTS.inappropriate[Math.floor(Math.random() * ATTACHMENTS.inappropriate.length)];
      messageText = '';
    } else if (attachType === 'raunchy_video') {
      // Randomly select one of the video URLs
      const raunchyVideos = [
        'https://www.dropbox.com/scl/fi/j33a1c1jxzzeb438m6utd/Video-1-7-26-4-16-25-pm-2.mp4?rlkey=9cw8vxxm3xbr4c9j45n0iiayx&st=3x5ry2kl&dl=1',
        'https://www.dropbox.com/scl/fi/osne24v2558zclbp3ofcx/Video-1-7-26-4-16-25-pm-1.mp4?rlkey=rd77cc3xzldv3marj651ct11f&st=lzauh41s&dl=1',
        'https://www.dropbox.com/scl/fi/pgtanci70jfiweun99suk/Video-1-7-26-4-16-25-pm-1-1.mp4?rlkey=g1ln72d29tb91rmtsz9n8v08a&st=ctc89v0e&dl=1',
        'https://www.dropbox.com/scl/fi/bkvxd6cc1eb877gdv69hs/Video-1-7-26-4-16-25-pm.mp4?rlkey=pdnvw0qgqbymuk1sjpditdq3z&st=lvdo82xa&dl=1',
        'https://www.dropbox.com/scl/fi/4fisr3igjf4c1dqvupr6v/Video-1-7-26-4-45-22-pm.mp4?rlkey=6f7ahfp8bh7zjer9n49t57ft6&st=c8xw7yl9&dl=0'
      ];
      const selectedVideo = raunchyVideos[Math.floor(Math.random() * raunchyVideos.length)];
      const videoType = selectedVideo.includes('.mov') ? 'video/quicktime' : 'video/mp4';
      attachment = `<video controls style="max-width: 100%; border-radius: 8px;"><source src="${selectedVideo}" type="${videoType}">Your browser does not support the video tag.</video>`;
      messageText = '';
    }
  } else if (choice === 'invite') {
    // Handle invitation
    await handleTinderInvitation(profile);
    return;
  } else {
    // Generate message from tone category (reuse seduction quotes or bio categories)
    const category = choice;
    if (typeof SEDUCTION_QUOTES !== 'undefined' && SEDUCTION_QUOTES[category]) {
      const setup = pick(SEDUCTION_QUOTES[category].setups);
      const turn = pick(SEDUCTION_QUOTES[category].turns);
      const button = pick(SEDUCTION_QUOTES[category].buttons);
      messageText = `${setup} ${turn} ${button}`;
    } else if (TINDER_BIO_CATEGORIES[category]) {
      // Fallback to bio categories
      messageText = pick(TINDER_BIO_CATEGORIES[category].lines);
    } else {
      // Ultimate fallback
      messageText = "Hey, how are you?";
    }
  }
  
  // Add player message to chat
  addMessageToChat('You', messageText, true);
  if (attachment) {
    addMessageToChat('You', attachment, true);
  }
  
  // Get response - treat raunchy video same as inappropriate picture
  const responseType = (choice === 'attach_raunchy_video') ? 'inappropriate' : choice;
  const response = generateTinderResponse(profile, responseType, attachment);
  
  // Add response to chat (with slight delay for realism)
  setTimeout(() => {
    addMessageToChat(profile.name, response.text, false);
  }, 500);
  
  // Check for unmatch
  if (response.unmatch) {
    setTimeout(() => {
      addMessageToChat('System', `${profile.name} has unmatched you.`, false);
      setTimeout(() => {
        const modal = document.getElementById('tinderModal');
        const chatView = document.getElementById('tinderChatView');
        const swipeView = document.getElementById('tinderSwipeView');
        S.season4.tinder_active_conversation = null;
        chatView.classList.add('hidden');
        swipeView.classList.remove('hidden');
        modal.classList.remove('chat-active');
      }, 2000);
    }, 1500);
    return;
  }
  
  // Store messages
  conversation.messages.push({
    from: 'player',
    text: messageText,
    attachment: attachment,
    timestamp: Date.now()
  });
  conversation.messages.push({
    from: profile.name,
    text: response.text,
    timestamp: Date.now()
  });
}

// PART 4: RESPONSE POOL
function generateTinderResponse(profile, messageType, attachment) {
  const bioTone = S.season4.tinder_bio || [];
  const hasRegisterDisclaimer = bioTone.some(line => line.includes('sex offender'));
  const isFacetuned = S.season4.profile_facetuned;
  
  // Response pools based on various factors
  const responses = [];
  
  // If enthusiastic personality and facetuned, always positive
  if (profile.personality === 'enthusiastic' && isFacetuned) {
    responses.push(...[
      {text: "Haha that's actually funny! 😂", unmatch: false},
      {text: "I love your sense of humor!", unmatch: false},
      {text: "You're so interesting! Tell me more!", unmatch: false},
      {text: "This is going well! 😊", unmatch: false},
      {text: "You seem really cool! Let's keep talking!", unmatch: false},
      {text: "You're making me smile! 😄", unmatch: false},
      {text: "I'm really enjoying this conversation!", unmatch: false},
      {text: "You seem like a great person!", unmatch: false},
      {text: "This is fun! Keep it coming!", unmatch: false},
      {text: "You're really charming! 😊", unmatch: false},
      {text: "I love talking to you!", unmatch: false},
      {text: "You're making my day better!", unmatch: false}
    ]);
  }
  
  // Register disclaimer responses
  if (hasRegisterDisclaimer) {
    responses.push(...[
      {text: "That disclaimer is a lot.", unmatch: false},
      {text: "I... need to think about this.", unmatch: false},
      {text: "This is concerning.", unmatch: false},
      {text: "I don't think this is for me.", unmatch: true},
      {text: "That's... a red flag.", unmatch: false},
      {text: "I'm not sure how to respond to that.", unmatch: false},
      {text: "This makes me uncomfortable.", unmatch: true},
      {text: "I need to step back.", unmatch: true}
    ]);
  }
  
  // Message type specific responses
  if (messageType === 'inappropriate' || attachment === 'inappropriate') {
    responses.push(...[
      {text: "You seem... intense.", unmatch: false},
      {text: "That's a bit much.", unmatch: false},
      {text: "I'm not comfortable with this.", unmatch: true},
      {text: "This isn't what I'm looking for.", unmatch: true},
      {text: "That's too forward for me.", unmatch: false},
      {text: "I think we're on different pages.", unmatch: true},
      {text: "This is making me uncomfortable.", unmatch: true},
      {text: "I'm going to pass on this.", unmatch: true},
      {text: "That's not appropriate.", unmatch: true},
      {text: "I don't appreciate that.", unmatch: true},
      {text: "This is crossing a line.", unmatch: true},
      {text: "I'm not interested in that kind of thing.", unmatch: true}
    ]);
  } else if (messageType === 'suave' || messageType === 'earnest') {
    responses.push(...[
      {text: "I appreciate that.", unmatch: false},
      {text: "That's nice to hear.", unmatch: false},
      {text: "You seem genuine.", unmatch: false},
      {text: "That's really sweet of you.", unmatch: false},
      {text: "I like that about you.", unmatch: false},
      {text: "You seem like a good person.", unmatch: false},
      {text: "That means a lot.", unmatch: false},
      {text: "I appreciate your honesty.", unmatch: false},
      {text: "You're making a good impression.", unmatch: false},
      {text: "I like your approach.", unmatch: false},
      {text: "That's refreshing to hear.", unmatch: false},
      {text: "You seem thoughtful.", unmatch: false}
    ]);
  } else if (messageType === 'ironic') {
    responses.push(...[
      {text: "Haha okay that's actually funny.", unmatch: false},
      {text: "I like your sense of humor!", unmatch: false},
      {text: "That made me laugh! 😂", unmatch: false},
      {text: "You're funny!", unmatch: false},
      {text: "I appreciate the humor.", unmatch: false},
      {text: "That's clever!", unmatch: false},
      {text: "You've got a good sense of humor.", unmatch: false},
      {text: "That's actually pretty funny.", unmatch: false}
    ]);
  } else if (messageType === 'defensive') {
    responses.push(...[
      {text: "Okay, I hear you.", unmatch: false},
      {text: "I understand where you're coming from.", unmatch: false},
      {text: "Fair enough.", unmatch: false},
      {text: "I get it.", unmatch: false},
      {text: "That's valid.", unmatch: false},
      {text: "I can respect that.", unmatch: false},
      {text: "No worries.", unmatch: false},
      {text: "I appreciate the directness.", unmatch: false}
    ]);
  }
  
  // Generic responses
  if (responses.length === 0) {
    responses.push(...[
      {text: "Interesting...", unmatch: false},
      {text: "Tell me more about yourself.", unmatch: false},
      {text: "I'm listening.", unmatch: false},
      {text: "That's cool.", unmatch: false},
      {text: "I see.", unmatch: false},
      {text: "Okay, interesting.", unmatch: false},
      {text: "What else?", unmatch: false},
      {text: "Go on.", unmatch: false},
      {text: "Hmm, tell me more.", unmatch: false},
      {text: "I'm curious about you.", unmatch: false},
      {text: "What's your story?", unmatch: false},
      {text: "I'd like to know more.", unmatch: false}
    ]);
  }
  
  return pick(responses);
}

// PART 5: INVITATION & ESCALATION
async function handleTinderInvitation(profile) {
  
  // Mark that an encounter has started IMMEDIATELY
  window.__tinder_encounter_started = true;
  // Add invitation message to chat
  addMessageToChat('You', "Want to come over to my place?", true);
  
  // Generate response
  const inviteResponses = [
    "Come over if you want, but keep it discreet.",
    "Sure, I can come over.",
    "I'm interested, but let's be careful.",
    "Okay, but this stays between us."
  ];
  
  const response = pick(inviteResponses);
  
  // Add response to chat
  setTimeout(() => {
    addMessageToChat(profile.name, response, false);
    setTimeout(() => {
      addMessageToChat('System', 'She arrives at your house later that evening.', false);
      
      // Close chat view and return to game
      setTimeout(() => {
        const chatView = document.getElementById('tinderChatView');
        const swipeView = document.getElementById('tinderSwipeView');
        const modal = document.getElementById('tinderModal');
        S.season4.tinder_active_conversation = null;
        chatView.classList.add('hidden');
        swipeView.classList.add('hidden');
        modal.classList.add('hidden');
        modal.classList.remove('chat-active');
      }, 1500);
    }, 1000);
  }, 500);
  
  // Wait a bit before continuing with seduction
  await new Promise(resolve => setTimeout(resolve, 2500));
  
  log('');
  
  // Transition to seduction mechanic (reuse existing)
  const seductionPerson = {
    realName: profile.name,
    hiddenName: profile.name,
    gender: 'F',
    femaleAttractiveness: "Moderately Attractive"
  };
  
  // Use nightclub seduction logic but in house context
  log('The evening progresses...');
  log('');
  
  // Adultery Risk Check (Season 4)
  if (S.season === 4 || S.season === 5) {
    const adulteryRisk = Math.random();
    const riskThreshold = 0.4; // 40% chance of being caught
    
    if (adulteryRisk < riskThreshold) {
      log('');
      log('🚨 The sharia police arrive...');
      await waitAdvance("Arrest", "The sharia police arrive...");
      
      if (typeof administerLashing === 'function') {
        await administerLashing('Adultery via Tinder', rnd(10, 20));
      } else {
        log('You are arrested for adultery.');
        S.legal_risk = Math.min(100, (S.legal_risk || 0) + 15);
      }
      
      // Encounter ends
      S.season4.tinder_active_conversation = null;
      S.season4.tinder_encounters++;
      await applyTinderPostEncounterEffects();
      
      // CRITICAL FIX: Set completed flag so maybeEveningEvent() can detect it
      window.__tinder_encounter_completed = true;
      
      // Small delay to ensure flag is set and propagated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if we're in the evening phase and need to continue
      if (window.__in_evening_phase) {
        
        // Small delay to ensure UI is updated and modal is closed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Automatically progress to sleep phase so the evening phase completes properly
        try {
          
          S.drug_binge = 0;
          S.no_sleep = 0;
          log('You return home and turn in for the night.');
          log('You feel clearer in the morning.');
          
          // Update UI
          if (typeof render === 'function') render();
          if (typeof updateHUD === 'function') updateHUD();
          
        } catch (e) {
          console.error('[TINDER INVITATION] [LASHING PATH] Error progressing to sleep phase:', e);
          console.error('[TINDER INVITATION] [LASHING PATH] Stack:', e.stack);
        } finally {
          // Clear the evening phase flag now that encounter is complete
          window.__in_evening_phase = false;
          window.__tinder_encounter_completed = false;
          window.__tinder_encounter_started = false;
        }
      } else {
        // Clear flags even if not in evening phase to prevent stale state
        window.__tinder_encounter_completed = false;
        window.__tinder_encounter_started = false;
      }
      
      return;
    }
  }
  
  // If passed, proceed with seduction
  log('You both move to the bedroom...');
  log('');
  
  // Reuse seduction resolution
  let protectionChoice;
  try {
    protectionChoice = await choose([
      {key: 'use', label: 'Use protection'},
      {key: 'no', label: "Don't use protection", variant: 'warn'}
    ], 'Right before the act:');
  } catch (e) {
    console.error('Error in protection choice:', e);
    protectionChoice = 'use'; // Default to safe option if choice fails
  }
  
  if (protectionChoice === 'use') {
    log('You use protection. The encounter is safe but mechanical.');
  } else {
    log('You don\'t use protection. The encounter feels raw, empty.');
  }
  
  log('');
  log('Afterwards, she gets dressed quickly.');
  log('"That was... fine," she says, avoiding eye contact.');
  log('She leaves without saying goodbye.');
  log('');
  log('The house still feels empty.');
  log('');
  
  // Ensure UI updates before continuing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Handle sex consequences
  try {
    await handleSexConsequences(seductionPerson);
  } catch (e) {
    console.error('Error in handleSexConsequences:', e);
  }
  
  // Post-encounter effects
  try {
    S.season4.tinder_active_conversation = null;
    S.season4.tinder_encounters++;
    await applyTinderPostEncounterEffects();
  } catch (e) {
    console.error('[TINDER DEBUG] Error in applyTinderPostEncounterEffects:', e);
    // Ensure we still clear the conversation even if effects fail
    S.season4.tinder_active_conversation = null;
  }
  
  
  // CRITICAL: Set completed flag FIRST so maybeEveningEvent() can detect it
  window.__tinder_encounter_completed = true;
  
  // Small delay to ensure flag is set and propagated
  await new Promise(resolve => setTimeout(resolve, 50));
  
  
  // Check if we're in the evening phase and need to continue
  if (window.__in_evening_phase) {
    
    // Small delay to ensure UI is updated and modal is closed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Automatically progress to sleep phase so the evening phase completes properly
    try {
      
      S.drug_binge = 0;
      S.no_sleep = 0;
      log('You return home and turn in for the night.');
      log('You feel clearer in the morning.');
      
      // Update UI
      if (typeof render === 'function') render();
      if (typeof updateHUD === 'function') updateHUD();
      
    } catch (e) {
      console.error('[TINDER INVITATION] Error progressing to sleep phase:', e);
      console.error('[TINDER INVITATION] Stack:', e.stack);
    } finally {
      // Clear the evening phase flag now that encounter is complete
      window.__in_evening_phase = false;
      window.__tinder_encounter_completed = false;
      window.__tinder_encounter_started = false;
    }
  } else {
    // Clear flags even if not in evening phase to prevent stale state
    window.__tinder_encounter_completed = false;
    window.__tinder_encounter_started = false;
  }
}

// PART 6: POST-ENCOUNTER EFFECTS
async function applyTinderPostEncounterEffects() {
  log('');
  log('════════════════════════════════════════');
  log('📱 TINDER ENCOUNTER EFFECTS');
  log('════════════════════════════════════════');
  log('');
  
  // Slight increase in audit scrutiny
  if (S.season4 && S.season4.audit_scrutiny !== undefined) {
    S.season4.audit_scrutiny = Math.min(100, (S.season4.audit_scrutiny || 0) + 2);
    log('⚠️ Audit scrutiny: +2');
  }
  
  // Krunchem taunting frequency increase
  if (!S.krunchem_taunt_cooldown) S.krunchem_taunt_cooldown = 0;
  S.krunchem_taunt_cooldown = Math.max(0, S.krunchem_taunt_cooldown - 1); // More frequent
  
  // No emotional payoff
  log('You feel nothing. The encounter was empty, procedural.');
  log('Your home still feels empty.');
  log('Your daughter never comments on your dating life.');
  log('');
  
  // Tinder encounters do not heal loneliness
  if (S.loneliness !== undefined) {
    // Loneliness doesn't decrease, might even increase slightly
    S.loneliness = Math.min(100, (S.loneliness || 50) + 1);
    log('💔 Loneliness: +1 (Tinder encounters do not heal loneliness)');
  }
  
  log('');
  
  // Wait for user to acknowledge before continuing
  const completeResult = await choose([{key:'complete', label:'Complete'}], "The encounter is complete.");
  
  // Ensure Tinder modal is fully closed
  try {
    const modal = document.getElementById('tinderModal');
    const chatView = document.getElementById('tinderChatView');
    const swipeView = document.getElementById('tinderSwipeView');
    const matchesView = document.getElementById('tinderMatchesView');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('chat-active');
    }
    if (chatView) chatView.classList.add('hidden');
    if (swipeView) swipeView.classList.add('hidden');
    if (matchesView) matchesView.classList.add('hidden');
  } catch (e) {
    console.error('[TINDER DEBUG] Error closing modal:', e);
  }
  
  // Update UI (don't clear actions here - choose() already handles that)
  if (typeof render === 'function') render();
  if (typeof updateHUD === 'function') updateHUD();
  
}

// View matches
async function viewTinderMatches() {
  ensureTinderFlags();
  
  // Ensure Tinder modal exists before proceeding
  if (!(await ensureTinderModalExists())) {
    return;
  }
  
  const matches = S.season4.tinder_matches || [];
  
  if (matches.length === 0) {
    log('You have no matches yet. Keep swiping!');
    return;
  }
  
  // Helper function to convert Dropbox URLs
  const convertDropboxUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('dropbox.com')) {
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('raw', '1');
        urlObj.searchParams.set('dl', '1');
        return urlObj.toString();
      } catch (e) {
        return url;
      }
    }
    return url;
  };
  
  // Show tinder modal and matches view
  const modal = document.getElementById('tinderModal');
  const profileView = document.getElementById('tinderProfileView');
  const swipeView = document.getElementById('tinderSwipeView');
  const chatView = document.getElementById('tinderChatView');
  const matchesView = document.getElementById('tinderMatchesView');
  const matchesList = document.getElementById('tinderMatchesList');
  const matchesBackBtn = document.getElementById('tinderMatchesBackBtn');
  const closeBtn = document.getElementById('tinderCloseBtn');
  
  // Show modal and matches view, hide others
  modal.classList.remove('hidden');
  modal.classList.remove('chat-active');
  profileView.classList.add('hidden');
  swipeView.classList.add('hidden');
  chatView.classList.add('hidden');
  matchesView.classList.remove('hidden');
  
  // Clear existing matches
  matchesList.innerHTML = '';
  
  // Populate matches list
  matches.forEach((match, idx) => {
    const matchItem = document.createElement('div');
    matchItem.className = 'tinder-match-item';
    
    const timeAgo = S.matches_played - match.matched_at;
    const timeText = timeAgo === 0 ? 'Just now' : `${timeAgo} match${timeAgo !== 1 ? 'es' : ''} ago`;
    
    const imageUrl = convertDropboxUrl(match.image);
    const fallbackImg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23ddd" width="60" height="60"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="10"%3EImage%3C/text%3E%3C/svg%3E';
    
    matchItem.innerHTML = `
      <img class="tinder-match-item-img" src="${imageUrl}" alt="${match.name}" onerror="this.src='${fallbackImg}'">
      <div class="tinder-match-item-info">
        <div class="tinder-match-item-name">${match.name}</div>
        <div class="tinder-match-item-bio">${match.bio || ''}</div>
        <div class="tinder-match-item-time">Matched ${timeText}</div>
      </div>
    `;
    
    matchItem.onclick = async () => {
      // Restore conversation or start new one
      const profile = {
        name: match.name,
        bio: match.bio,
        image: match.image,
        personality: match.personality
      };
      
      // Hide matches view and show chat
      matchesView.classList.add('hidden');
      await startTinderConversation(profile);
    };
    
    matchesList.appendChild(matchItem);
  });
  
  // Back button handler
  matchesBackBtn.onclick = () => {
    modal.classList.add('hidden');
    matchesView.classList.add('hidden');
  };
  
  // Close button handler
  const closeModal = () => {
    modal.classList.add('hidden');
    matchesView.classList.add('hidden');
    profileView.classList.remove('hidden');
  };
  closeBtn.onclick = closeModal;
  
  // Wait for user to select a match or close
  return new Promise((resolve) => {
    const checkClose = () => {
      if (modal.classList.contains('hidden')) {
        resolve();
      } else {
        setTimeout(checkClose, 100);
      }
    };
    checkClose();
  });
}

// Function to show intro cutscene video popup
async function showIntroCutscene() {
  return new Promise((resolve) => {
    // Pause intro music if it's playing
    const openingMusic = document.getElementById('openingMusic');
    let wasMusicPlaying = false;
    if (openingMusic && !openingMusic.paused) {
      wasMusicPlaying = true;
      openingMusic.pause();
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'introVideoOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); z-index: 99999; display: flex; align-items: center; justify-content: center; flex-direction: column;';
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = 'position: relative; max-width: 80%; max-height: 80vh; width: auto; height: auto; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);';
    
    // Create header with close button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #333; background: #1a1a1a; border-radius: 12px 12px 0 0;';
    const title = document.createElement('h3');
    title.textContent = 'Intro Cutscene';
    title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #eee;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background: #333; color: #eee; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 16px;';
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = 'background: #1a1a1a; padding: 20px; border-radius: 0 0 12px 12px;';
    const video = document.createElement('video');
    // Convert Dropbox share link to direct download link for video playback
    video.src = 'https://www.dropbox.com/scl/fi/xx11ayx3wn8tcy1zd8hhh/Video-1-7-26-3-59-22-pm.mov?rlkey=trufzv2x1y06tjk1smyherlmr&st=6ajtr7x5&dl=1';
    video.controls = true;
    video.style.cssText = 'max-width: 100%; max-height: 70vh; width: auto; height: auto; display: block; border-radius: 8px;';
    videoContainer.appendChild(video);
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(videoContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close function
    const closeModal = () => {
      video.pause();
      overlay.remove();
      // Resume intro music if it was playing before
      if (wasMusicPlaying && openingMusic) {
        openingMusic.play().catch(err => {});
      }
      resolve();
    };
    
    // Event handlers
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };
    
    // Close when video ends
    video.onended = closeModal;
    
    // Play video
    video.play().catch(err => {
      console.error('Error playing video:', err);
      // If autoplay fails, user can click play manually
    });
  });
}

// Function to show brick throwing video popup
async function showBrickVideo() {
  return new Promise((resolve) => {
    // Stop general music when video starts
    if (typeof window._stopGeneralMusic === 'function') {
      window._stopGeneralMusic();
    }
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'brickVideoOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); z-index: 99999; display: flex; align-items: center; justify-content: center; flex-direction: column;';
    
    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = 'position: relative; max-width: 80%; max-height: 80vh; width: auto; height: auto; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);';
    
    // Create header with close button
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #333; background: #1a1a1a; border-radius: 12px 12px 0 0;';
    const title = document.createElement('h3');
    title.textContent = 'Throwing Brick';
    title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #eee;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background: #333; color: #eee; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 16px;';
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = 'background: #1a1a1a; padding: 20px; border-radius: 0 0 12px 12px;';
    const video = document.createElement('video');
    // Convert Dropbox share link to direct download link for video playback
    video.src = 'https://www.dropbox.com/scl/fi/c9ncbb89nb90kwzb5c0sa/Video-1-2-26-4-01-12-pm.mp4?rlkey=nl7f7an2z55rp8vtj3ykw4yx4&st=np6gr0q9&dl=1';
    video.controls = true;
    video.style.cssText = 'max-width: 100%; max-height: 70vh; width: auto; height: auto; display: block; border-radius: 8px;';
    videoContainer.appendChild(video);
    
    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(videoContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close function
    const closeModal = () => {
      video.pause();
      overlay.remove();
      // Start a new track after video ends
      if (typeof window._startGeneralMusic === 'function') {
        setTimeout(() => {
          window._startGeneralMusic();
        }, 500);
      }
      resolve();
    };
    
    // Event handlers
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    };
    
    // Close when video ends
    video.onended = closeModal;
    
    // Play video
    video.play().catch(err => {
      console.error('Error playing video:', err);
      // If autoplay fails, user can click play manually
    });
  });
}

// Global cheat code handler for "crongusdrive" to advance to driving minigame
(function() {
  let cheatBuffer = '';
  const cheatCode = 'crongusdrive';
  const resetTimeout = 5000; // Reset buffer after 5 seconds of inactivity
  let resetTimer = null;
  
  function resetCheatBuffer() {
    cheatBuffer = '';
  }
  
  function checkCheatCode() {
    if (cheatBuffer.toLowerCase().includes(cheatCode)) {
      // Cheat code detected!
      cheatBuffer = ''; // Reset buffer
      if (typeof startDrivingMinigame === 'function') {
        log('CHEAT CODE ACTIVATED: Starting driving minigame...');
        startDrivingMinigame().catch(err => {
          console.error('Error starting driving minigame:', err);
          log('Error: Could not start driving minigame.');
        });
      } else {
        log('CHEAT CODE ACTIVATED: Driving minigame function not available.');
      }
    }
  }
  
  // Listen for keydown events globally
  document.addEventListener('keydown', function(e) {
    // Ignore if user is typing in an input field, textarea, or contenteditable element
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable ||
      activeElement.getAttribute('contenteditable') === 'true'
    )) {
      // Only process if it's the Marco cheat input field (optional - you can remove this check if you want it to work everywhere)
      // For now, let's allow it to work even in input fields for maximum flexibility
      // But we'll skip modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
    }
    
    // Skip modifier keys and special keys
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
      // Clear reset timer
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
      
      // Handle backspace/delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        cheatBuffer = cheatBuffer.slice(0, -1);
      } else {
        // Add character to buffer (limit buffer size to prevent memory issues)
        cheatBuffer += e.key.toLowerCase();
        if (cheatBuffer.length > cheatCode.length * 2) {
          cheatBuffer = cheatBuffer.slice(-cheatCode.length * 2);
        }
      }
      
      // Check for cheat code
      checkCheatCode();
      
      // Set reset timer
      resetTimer = setTimeout(resetCheatBuffer, resetTimeout);
    }
  });
  
})();

// Global cheat code handler for "crongusshit" to advance to toilet straining minigame
(function() {
  let cheatBuffer = '';
  const cheatCode = 'crongusshit';
  const resetTimeout = 5000; // Reset buffer after 5 seconds of inactivity
  let resetTimer = null;
  
  function resetCheatBuffer() {
    cheatBuffer = '';
  }
  
  function checkCheatCode() {
    if (cheatBuffer.toLowerCase().includes(cheatCode)) {
      // Cheat code detected!
      cheatBuffer = ''; // Reset buffer
      if (typeof startToiletStrainingMinigame === 'function') {
        log('CHEAT CODE ACTIVATED: Starting toilet straining minigame...');
        startToiletStrainingMinigame().catch(err => {
          console.error('Error starting toilet straining minigame:', err);
          log('Error: Could not start toilet straining minigame.');
        });
      } else {
        log('CHEAT CODE ACTIVATED: Toilet straining minigame function not available.');
      }
    }
  }
  
  // Listen for keydown events globally
  document.addEventListener('keydown', function(e) {
    // Ignore if user is typing in an input field, textarea, or contenteditable element
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable ||
      activeElement.getAttribute('contenteditable') === 'true'
    )) {
      // Only process if it's the Marco cheat input field (optional - you can remove this check if you want it to work everywhere)
      // For now, let's allow it to work even in input fields for maximum flexibility
      // But we'll skip modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
    }
    
    // Skip modifier keys and special keys
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
      // Clear reset timer
      if (resetTimer) {
        clearTimeout(resetTimer);
      }
      
      // Handle backspace/delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        cheatBuffer = cheatBuffer.slice(0, -1);
      } else {
        // Add character to buffer (limit buffer size to prevent memory issues)
        cheatBuffer += e.key.toLowerCase();
        if (cheatBuffer.length > cheatCode.length * 2) {
          cheatBuffer = cheatBuffer.slice(-cheatCode.length * 2);
        }
      }
      
      // Check for cheat code
      checkCheatCode();
      
      // Set reset timer
      resetTimer = setTimeout(resetCheatBuffer, resetTimeout);
    }
  });
  
})();