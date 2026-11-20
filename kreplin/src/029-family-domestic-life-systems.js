// ---------- Family & Domestic Life Systems ----------

// Main "At Home" menu
async function openAtHomeMenu() {
  // Initialize family stats if not present
  if (!S.family) {
    S.family = {
      homeStability: 50,
      wifeRel: 50,
      kidsRel: 50,
      spousePatience: 50,
      privateSchoolDueIn: 3,
      privateSchoolArrears: false
    };
  }

  // Check for school fees due (disabled in Season 4+)
  if (S.family.privateSchoolDueIn <= 0 && S.season < 4) {
    await handleSchoolFees();
    return;
  }

  // Season 4: If daughter has left, show silent home interaction
  if (S.season === 4 && S.season4 && S.season4.daughter_left_home) {
    log("You eat a microwaved meal in silence.");
    return;
  }
  
  // Build home menu options
  const homeOptions = [
    {key: 'dinner', label: 'Dinner Function', variant: 'good'},
    {key: 'kids', label: 'Spend Time with Kids', variant: 'good'},
    {key: 'ignore', label: 'Ignore Family', variant: 'warn'}
  ];
  
  // Season 4: Disable dinner/kids if daughter scenes are active (they replace these)
  if (S.season === 4 && S.season4 && S.season4.initialized && !S.season4.daughter_left_home) {
    // Remove dinner and kids options in Season 4 - daughter scenes replace them
    homeOptions.splice(0, 2); // Remove first two options (dinner and kids)
  }

  // Texting option removed - can be done via phone instead

  const choice = await choose(homeOptions, 'At Home:');
  
  switch (choice) {
    case 'dinner':
      await conductDinnerFunction();
      break;
    case 'kids':
      await spendTimeWithKids();
      break;
    case 'ignore':
      await ignoreFamily();
      break;
    case 'text':
      await openTextingMenu();
      break;
  }

  // Decrement school fees counter
  S.family.privateSchoolDueIn = Math.max(0, S.family.privateSchoolDueIn - 1);
}

// Dinner Function - 3-part food builder + conversation
async function conductDinnerFunction() {
  // Season 4+: Wife is gone, you eat alone
  if (S.season >= 4) {
    const aldiMealMessages = [
      "You miserably eat an Aldi microwave meal on your own in eerie silence.",
      "You sit alone, eating a cold Aldi microwave meal. The silence is deafening.",
      "You heat up an Aldi microwave meal and eat it alone. The house is empty.",
      "You eat an Aldi microwave meal by yourself. There's no one to talk to.",
      "You consume an Aldi microwave meal in complete silence. You're completely alone.",
      "You eat a cheap Aldi microwave meal alone. The eerie silence fills the room."
    ];
    const message = aldiMealMessages[Math.floor(Math.random() * aldiMealMessages.length)];
    log(message);
    return;
  }
  
  log("🍽️ You demand that your wife prepare dinner for you...");
  
  // Part 1: Course A (Proteins)
  const courseAOptions = FOOD_DATA.courseA.map(food => ({
    key: food.name,
    label: food.name
  }));
  
  const courseA = await choose(courseAOptions, 'Choose your main protein:');
  const selectedA = FOOD_DATA.courseA.find(f => f.name === courseA);
  
  // Part 2: Course B (Carbs/Sides)
  const courseBOptions = FOOD_DATA.courseB.map(food => ({
    key: food.name,
    label: food.name
  }));
  
  const courseB = await choose(courseBOptions, 'Choose your side dish:');
  const selectedB = FOOD_DATA.courseB.find(f => f.name === courseB);
  
  // Part 3: Course C (Sauces/Extras)
  const courseCOptions = FOOD_DATA.courseC.map(food => ({
    key: food.name,
    label: food.name
  }));
  
  const courseC = await choose(courseCOptions, 'Choose your sauce/extra:');
  const selectedC = FOOD_DATA.courseC.find(f => f.name === courseC);
  
  // Optional drink
  const drinkOptions = FOOD_DATA.drinks.map(drink => ({
    key: drink.name,
    label: drink.name
  }));
  drinkOptions.push({key: 'none', label: 'No drink'});
  
  const drink = await choose(drinkOptions, 'Choose a drink (optional):');
  const selectedDrink = drink === 'none' ? null : FOOD_DATA.drinks.find(d => d.name === drink);
  
  // Calculate meal stats
  const totalTaste = selectedA.taste + selectedB.taste + selectedC.taste + (selectedDrink ? selectedDrink.taste : 0);
  const totalClass = selectedA.class + selectedB.class + selectedC.class + (selectedDrink ? selectedDrink.class : 0);
  const totalChaos = selectedA.chaos + selectedB.chaos + selectedC.chaos + (selectedDrink ? selectedDrink.chaos : 0);
  const totalCalories = selectedA.calories + selectedB.calories + selectedC.calories + (selectedDrink ? selectedDrink.calories : 0);
  const totalFlatulence = selectedA.flatulence + selectedB.flatulence + selectedC.flatulence + (selectedDrink ? selectedDrink.flatulence : 0);
  
  log(`🍽️ You serve: ${selectedA.name} with ${selectedB.name} and ${selectedC.name}${selectedDrink ? `, with ${selectedDrink.name}` : ''}`);
  
  // Lascivious eating descriptions
  const eatingDescriptions = [
    `You lusciously yet lasciviously chew on the ${selectedA.name} which combines with the ${selectedB.name} wonderfully and slides slowly down your wet and hungry throat in a yummacious way`,
    `You sensually devour the ${selectedA.name}, letting the ${selectedC.name} caress your taste buds as it melts seductively in your mouth`,
    `The ${selectedA.name} slides down your throat like silk, while the ${selectedB.name} dances on your tongue in the most deliciously provocative manner`,
    `You hungrily consume the ${selectedA.name}, the ${selectedC.name} coating your lips in a most appetizing way as you savor every decadent bite`,
    `The ${selectedA.name} and ${selectedB.name} combine in your mouth in a symphony of flavors that makes you moan with gastronomic pleasure`,
    `You devour the meal with carnal hunger, the ${selectedC.name} dripping sensually from your lips as you consume the ${selectedA.name} with abandon`,
    `The ${selectedA.name} slides down your throat in the most satisfying way, while the ${selectedB.name} and ${selectedC.name} create a perfect storm of deliciousness`,
    `You eat with primal satisfaction, the ${selectedA.name} filling your mouth with pleasure as the ${selectedC.name} enhances every bite`,
    `The meal slides down your throat like liquid gold, the ${selectedA.name} and ${selectedB.name} combining in perfect harmony with the ${selectedC.name}`,
    `You consume the food with lascivious delight, savoring each morsel of ${selectedA.name} as the ${selectedC.name} makes your taste buds sing`,
    `The ${selectedA.name} melts in your mouth like a lover's kiss, while the ${selectedB.name} and ${selectedC.name} create an orgy of flavors`,
    `You eat with sensual abandon, the ${selectedA.name} sliding down your throat in the most satisfying way as the ${selectedC.name} coats your lips`,
    `The meal is consumed with carnal hunger, the ${selectedA.name} and ${selectedB.name} dancing on your tongue in perfect culinary ecstasy`,
    `You devour the food with primal satisfaction, the ${selectedC.name} making every bite of ${selectedA.name} taste like heaven itself`,
    `The ${selectedA.name} slides down your throat like silk, the ${selectedB.name} and ${selectedC.name} creating a perfect storm of gastronomic pleasure`
  ];
  
  const eatingDescription = pick(eatingDescriptions);
  log(`😋 ${eatingDescription}...`);
  
  // Handle flatulence
  if (totalFlatulence >= 15) {
    log("💨 You need to fart...");
    let fartsRemaining = Math.ceil(totalFlatulence / 5);
    while (fartsRemaining > 0) {
      const fartChoice = await choose([
        {key: 'fart', label: 'Fart', variant: 'warn'},
        {key: 'hold', label: 'Hold it in', variant: 'good'}
      ], `You have ${fartsRemaining} farts to get out...`);
      
      if (fartChoice === 'fart') {
        fartsRemaining--;
        log("💨 *FART*");
        if (typeof window.playSoundEffect === 'function') {
          window.playSoundEffect('fart', 0.8);
        }
        if (fartsRemaining > 0) {
          log("💨 You still need to get more gas out...");
        }
      } else {
        log("💨 You hold it in, but it's uncomfortable...");
        S.family.homeStability = Math.max(0, S.family.homeStability - 2);
        break;
      }
    }
  }
  
  // Handle obesity risk
  if (totalCalories >= 1000) {
    log("⚠️ That was a very heavy meal...");
    if (!S.obese) S.obese = false;
    if (totalCalories >= 1500) {
      S.obese = true;
      log("😱 You've become obese from that meal!");
    }
  }
  
  // Wife confrontation about obesity
  if (S.obese) {
    log(`💬 Your wife looks at you with concern across the dinner table.`);
    log(`"You are very obese," she says matter-of-factly.`);
    log(`"I'm worried about your health. Maybe you should consider eating healthier or getting some help."`);
    S.family.wifeRel = Math.max(0, (S.family.wifeRel || 50) - 5);
  }
  
  // Conversation Phase (general table chat first)
  await conductDinnerConversation(totalTaste, totalClass, totalChaos);
  
  // Random chance for player guests (after general conversation)
  if (Math.random() < 0.3 && S.squad && S.squad.length > 0) {
    await handlePlayerGuests(totalChaos);
  }
  
  // Track dinner attendance
  S.family.dinnersAttended = (S.family.dinnersAttended || 0) + 1;
  S.family.lastDinnerMatch = S.matches_played;
  
  // Award lobby tokens for spending time with family (dinner)
  addLobbyTokens(10, 'having dinner with family');
}

// Handle player guests at dinner
async function handlePlayerGuests(mealChaos) {
  const player = pick(S.squad);
  const playerWife = pick(FEMALE_NAMES) + " " + pick(SURNAMES);
  
  log(`🏠 Your player ${player.name} and his wife ${playerWife} have arrived for dinner!`);
  
  const guestChoice = await choose([
    {key: 'player', label: `Talk to ${player.name}`},
    {key: 'wife', label: `Talk to ${playerWife}`, variant: 'warn'},
    {key: 'both', label: 'Try to engage both'}
  ], 'Who do you want to talk to?');
  
  if (guestChoice === 'player') {
    await talkToPlayer(player);
  } else if (guestChoice === 'wife') {
    await flirtWithPlayerWife(player, playerWife);
  } else {
    // Try to engage both - risky
    if (Math.random() < 0.5) {
      await talkToPlayer(player);
    } else {
      await flirtWithPlayerWife(player, playerWife);
    }
  }
}

// Talk to player
async function talkToPlayer(player) {
  const talkOptions = [
    {key: 'shop', label: 'Talk shop'},
    {key: 'passive', label: 'Be passive aggressive'},
    {key: 'neg', label: 'Neg them'},
    {key: 'submissive', label: 'Be submissive and meek'}
  ];
  
  const choice = await choose(talkOptions, `What do you want to say to ${player.name}?`);
  
  switch (choice) {
    case 'shop':
      log(`You discuss tactics and training with ${player.name}. He seems engaged.`);
      S.family.homeStability = Math.min(100, S.family.homeStability + 2);
      break;
    case 'passive':
      log(`You make some subtle digs at ${player.name}. He looks uncomfortable.`);
      S.family.homeStability = Math.max(0, S.family.homeStability - 3);
      break;
    case 'neg':
      log(`You openly criticize ${player.name}. He's clearly upset.`);
      S.family.homeStability = Math.max(0, S.family.homeStability - 5);
      break;
    case 'submissive':
      log(`You act meek and deferential to ${player.name}. He seems confused.`);
      S.family.homeStability = Math.max(0, S.family.homeStability - 2);
      break;
  }
}

// Flirt with player's wife
async function flirtWithPlayerWife(player, playerWife) {
  log(`💕 You start flirting with ${playerWife}...`);
  
  const flirtOptions = [
    {key: 'subtle', label: 'Subtle flirtation'},
    {key: 'direct', label: 'Direct approach'},
    {key: 'erotic', label: 'Erotic comments', variant: 'bad'}
  ];
  
  const choice = await choose(flirtOptions, 'How do you flirt?');
  
  // Add specific erotic comments based on choice
  if (choice === 'erotic') {
    const eroticComments = [
      "Mmm... you turn me on",
      "Mmm you make me salivate", 
      "Mmmm fuck",
      "I want you... shhhh... our sexy little secret",
      "You're so hot... I can't help myself",
      "Mmm... you're driving me wild",
      "I need you... right now",
      "You're making me so hard... shhhh",
      "Mmm... I want to taste you",
      "You're so fucking sexy... our little secret"
    ];
    const eroticComment = pick(eroticComments);
    log(`💋 You whisper to ${playerWife}: "${eroticComment}"`);
  } else if (choice === 'direct') {
    log(`💋 You tell ${playerWife}: "You're absolutely gorgeous, you know that?"`);
  } else {
    log(`💋 You give ${playerWife} a meaningful look and say: "You look lovely tonight"`);
  }
  
  log(`💔 ${player.name} catches you flirting with his wife! He's furious!`);
  log(`⚽ ${player.name} quits the team immediately!`);
  
  // Remove player from squad
  S.squad = S.squad.filter(p => p.id !== player.id);
  S.lineup = S.lineup.filter(p => p.id !== player.id);
  
  // Family consequences
  S.family.wifeRel = Math.max(0, S.family.wifeRel - 10);
  S.family.homeStability = Math.max(0, S.family.homeStability - 15);
  
  // Chance for wife to visit later
  if (Math.random() < 0.3) {
    S.knock_queue = S.knock_queue || [];
    S.knock_queue.push({
      type: 'player_wife_seduction',
      playerName: player.name,
      wifeName: playerWife,
      title: `${playerWife} (${player.name}'s wife)`
    });
    log(`📞 ${playerWife} will visit you before the next match...`);
  }
}

// Conduct dinner conversation
async function conductDinnerConversation(taste, class_, chaos) {
  log("💬 Time for conversation...");
  
  // Three-part quote builder like seduction system
  const conversationCategories = [
    {key: 'affectionate', label: 'Affectionate', variant: 'good'},
    {key: 'deranged', label: 'Deranged', variant: 'bad'},
    {key: 'politics', label: 'Politics rant', variant: 'warn'},
    {key: 'money', label: 'Money', variant: 'neutral'},
    {key: 'football', label: 'Football', variant: 'neutral'},
    {key: 'kids', label: 'Kids', variant: 'good'},
    {key: 'gossip', label: 'Gossip', variant: 'warn'}
  ];
  
  // Part 1: Choose setup category
  const setupCategory = await choose(conversationCategories, 'Choose the category for your opening:');
  
  // Part 2: Choose pivot category  
  const pivotCategory = await choose(conversationCategories, 'Choose the category for your middle part:');
  
  // Part 3: Choose signoff category
  const signoffCategory = await choose(conversationCategories, 'Choose the category for your closing:');
  
  // Generate conversation line from selected categories
  const dialogue = generateThreePartConversationLine(setupCategory, pivotCategory, signoffCategory);
  log(`💬 You say: "${dialogue}"`);
  
  // Determine primary category for response (use the most negative one if any are deranged)
  let primaryCategory = setupCategory;
  if (setupCategory === 'deranged' || pivotCategory === 'deranged' || signoffCategory === 'deranged') {
    primaryCategory = 'deranged';
  } else if (setupCategory === 'politics' || pivotCategory === 'politics' || signoffCategory === 'politics') {
    primaryCategory = 'politics';
  }
  
  // Get spouse response based on trust level
  const trustLevel = getTrustLevel(S.family.wifeRel);
  const response = generateSpouseResponse(primaryCategory, trustLevel);
  log(`💬 Your spouse responds: "${response.text}"`);
  
  // Apply effects
  S.family.wifeRel = clamp(S.family.wifeRel + response.wifeRel, 0, 100);
  S.family.kidsRel = clamp(S.family.kidsRel + response.kidsRel, 0, 100);
  S.family.homeStability = clamp(S.family.homeStability + response.homeStability, 0, 100);
  
  if (response.pressHostility) {
    S.pressHostility = (S.pressHostility || 0) + response.pressHostility;
  }
  
  // Handle financial consequences for deranged rants
  if (primaryCategory === 'deranged') {
    await handleDerangedFinancialConsequences();
  }
  
  // Log effects
  if (response.wifeRel !== 0) {
    log(`💕 Wife relationship: ${response.wifeRel > 0 ? '+' : ''}${response.wifeRel}`);
  }
  if (response.kidsRel !== 0) {
    log(`👶 Kids relationship: ${response.kidsRel > 0 ? '+' : ''}${response.kidsRel}`);
  }
  if (response.homeStability !== 0) {
    log(`🏠 Home stability: ${response.homeStability > 0 ? '+' : ''}${response.homeStability}`);
  }
  
  // Award lobby tokens for spending time with kids
  addLobbyTokens(10, 'spending time with family (playing with kids)');
}

// Generate conversation line from dialogue banks
function generateConversationLine(category) {
  const bank = DIALOGUE_BANKS[category];
  if (!bank) return "I have nothing to say.";
  
  const setup = pick(bank.setups);
  const pivot = pick(bank.pivots);
  const signoff = pick(bank.signoffs);
  
  return setup + pivot + " " + signoff;
}

// Generate three-part conversation line from different categories
function generateThreePartConversationLine(setupCategory, pivotCategory, signoffCategory) {
  const setupBank = DIALOGUE_BANKS[setupCategory];
  const pivotBank = DIALOGUE_BANKS[pivotCategory];
  const signoffBank = DIALOGUE_BANKS[signoffCategory];
  
  if (!setupBank || !pivotBank || !signoffBank) return "I have nothing to say.";
  
  const setup = pick(setupBank.setups);
  const pivot = pick(pivotBank.pivots);
  const signoff = pick(signoffBank.signoffs);
  
  return setup + pivot + " " + signoff;
}

// Handle financial consequences for deranged rants
async function handleDerangedFinancialConsequences() {
  log("💰 Your wife demands compensation for your outburst...");
  
  const demandAmount = Math.floor(Math.random() * 50000) + 10000; // £10k-£60k
  log(`💰 She wants £${demandAmount.toLocaleString()} to make up for your behavior.`);
  
  const paymentChoice = await choose([
    {key: 'pay_personal', label: `Pay £${demandAmount.toLocaleString()} from your personal funds`, variant: 'good'},
    {key: 'embezzle', label: `Embezzle £${demandAmount.toLocaleString()} from the club`, variant: 'bad'},
    {key: 'refuse', label: 'Refuse to pay', variant: 'warn'}
  ], 'How do you want to handle this?');
  
  if (paymentChoice === 'pay_personal') {
    if (S.chairman_cash >= demandAmount) {
      S.chairman_cash -= demandAmount;
      log(`💰 You pay £${demandAmount.toLocaleString()} from your personal funds.`);
      log(`💰 Personal cash: £${S.chairman_cash.toLocaleString()}`);
      S.family.wifeRel = Math.min(100, S.family.wifeRel + 5); // Slight relationship boost
      log("💕 Wife relationship: +5 (she appreciates you taking responsibility)");
    } else {
      log("💰 You don't have enough personal funds! She's furious.");
      S.family.wifeRel = Math.max(0, S.family.wifeRel - 10);
      S.family.homeStability = Math.max(0, S.family.homeStability - 15);
      log("💕 Wife relationship: -10");
      log("🏠 Home stability: -15");
    }
  } else if (paymentChoice === 'embezzle') {
    if (S.club_cash >= demandAmount) {
      S.club_cash -= demandAmount;
      S.chairman_cash += demandAmount;
      log(`💰 You embezzle £${demandAmount.toLocaleString()} from the club to your personal funds.`);
      log(`💰 Club cash: £${S.club_cash.toLocaleString()}`);
      log(`💰 Personal cash: £${S.chairman_cash.toLocaleString()}`);
      S.compliance_risk = Math.min(100, S.compliance_risk + 15);
      S.legal_risk = Math.min(100, S.legal_risk + 10);
      log("⚠️ Compliance risk: +15");
      log("⚠️ Legal risk: +10");
      S.family.wifeRel = Math.min(100, S.family.wifeRel + 3); // Small boost for getting the money
      log("💕 Wife relationship: +3 (she got her money)");
    } else {
      log("💰 The club doesn't have enough funds! She's furious.");
      S.family.wifeRel = Math.max(0, S.family.wifeRel - 10);
      S.family.homeStability = Math.max(0, S.family.homeStability - 15);
      log("💕 Wife relationship: -10");
      log("🏠 Home stability: -15");
    }
  } else {
    // Refuse to pay
    log("💰 You refuse to pay. She's absolutely furious.");
    S.family.wifeRel = Math.max(0, S.family.wifeRel - 20);
    S.family.homeStability = Math.max(0, S.family.homeStability - 25);
    S.family.kidsRel = Math.max(0, S.family.kidsRel - 10);
    log("💕 Wife relationship: -20");
    log("🏠 Home stability: -25");
    log("👶 Kids relationship: -10 (they heard the fight)");
  }
}

// Get trust level based on wife relationship
function getTrustLevel(wifeRel) {
  if (wifeRel <= 24) return 'low';
  if (wifeRel <= 49) return 'warming';
  if (wifeRel <= 74) return 'mid';
  return 'high';
}

// Generate spouse response based on category and trust level
function generateSpouseResponse(category, trustLevel) {
  const responses = {
    low: {
      affectionate: [
        {text: "Not tonight.", wifeRel: -1, kidsRel: 0, homeStability: 0},
        {text: "I heard you.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "Do it more often.", wifeRel: 0, kidsRel: 0, homeStability: -1}
      ],
      deranged: [
        {text: "Calm down — that's not helpful.", wifeRel: -2, kidsRel: 0, homeStability: -2},
        {text: "Stop shouting in the house.", wifeRel: -2, kidsRel: 0, homeStability: -3}
      ],
      politics: [
        {text: "Please don't do politics tonight.", wifeRel: -1, kidsRel: 0, homeStability: 0},
        {text: "Not the dinner table.", wifeRel: -1, kidsRel: 0, homeStability: 0}
      ],
      money: [
        {text: "We'll check the accounts.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "Again with the spending?", wifeRel: -1, kidsRel: 0, homeStability: 0}
      ],
      football: [
        {text: "Not tonight.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "I'm done with match analysis.", wifeRel: -1, kidsRel: 0, homeStability: 0}
      ],
      kids: [
        {text: "Thank you, that helps.", wifeRel: 1, kidsRel: 1, homeStability: 0},
        {text: "Make sure you follow through.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ],
      gossip: [
        {text: "Don't drag me into gossip.", wifeRel: -1, kidsRel: 0, homeStability: 0},
        {text: "Keep it private.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ]
    },
    warming: {
      affectionate: [
        {text: "I saw that — thank you.", wifeRel: 1, kidsRel: 0, homeStability: 1},
        {text: "That helped; I appreciate it.", wifeRel: 1, kidsRel: 0, homeStability: 0}
      ],
      deranged: [
        {text: "Calm down — it scares the kids.", wifeRel: -1, kidsRel: -1, homeStability: -2},
        {text: "Take a breath; this isn't the way.", wifeRel: -1, kidsRel: 0, homeStability: -1}
      ],
      politics: [
        {text: "You always get wound up about that.", wifeRel: -1, kidsRel: 0, homeStability: 0},
        {text: "I get the point — maybe not tonight.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ],
      money: [
        {text: "We'll run the numbers.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "Pay the school first.", wifeRel: 0, kidsRel: 1, homeStability: 0}
      ],
      football: [
        {text: "I'll come to the family match.", wifeRel: 1, kidsRel: 1, homeStability: 0},
        {text: "Keep it short; family after.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ],
      kids: [
        {text: "That's lovely — thank you.", wifeRel: 1, kidsRel: 2, homeStability: 0},
        {text: "Help me put them to bed.", wifeRel: 1, kidsRel: 1, homeStability: 0}
      ],
      gossip: [
        {text: "We'll be discreet about it.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "Don't make it public.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ]
    },
    mid: {
      affectionate: [
        {text: "That was a lovely thing to do.", wifeRel: 2, kidsRel: 0, homeStability: 1},
        {text: "You made their night.", wifeRel: 2, kidsRel: 1, homeStability: 0}
      ],
      deranged: [
        {text: "That was ugly — why?", wifeRel: -1, kidsRel: 0, homeStability: -2},
        {text: "You scared the kids; apologise.", wifeRel: -2, kidsRel: -2, homeStability: 0}
      ],
      politics: [
        {text: "I get your point, but don't pick a fight.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "We can debate that later.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ],
      money: [
        {text: "If we prioritise school fees, do that.", wifeRel: 1, kidsRel: 1, homeStability: 0},
        {text: "We can trim elsewhere.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ],
      football: [
        {text: "I'll cheer for the youngsters.", wifeRel: 1, kidsRel: 1, homeStability: 0},
        {text: "I'll help with morale.", wifeRel: 1, kidsRel: 0, homeStability: 0}
      ],
      kids: [
        {text: "They'll love that — thank you.", wifeRel: 2, kidsRel: 2, homeStability: 0},
        {text: "We'll make a real plan.", wifeRel: 1, kidsRel: 1, homeStability: 0}
      ],
      gossip: [
        {text: "We'll verify before reacting.", wifeRel: 0, kidsRel: 0, homeStability: 0},
        {text: "Do not feed the press.", wifeRel: 0, kidsRel: 0, homeStability: 0}
      ]
    },
    high: {
      affectionate: [
        {text: "That was perfect — thank you.", wifeRel: 3, kidsRel: 0, homeStability: 2},
        {text: "I love how you do that for us.", wifeRel: 3, kidsRel: 1, homeStability: 0}
      ],
      deranged: [
        {text: "I know you're angry — just don't scare the kids.", wifeRel: -1, kidsRel: -1, homeStability: 0},
        {text: "I'll back you, but we need an apology later.", wifeRel: 0, kidsRel: 0, homeStability: -1}
      ],
      politics: [
        {text: "I know you care — let's channel it.", wifeRel: 1, kidsRel: 0, homeStability: 0},
        {text: "If you want change, do it constructively.", wifeRel: 1, kidsRel: 0, homeStability: 0}
      ],
      money: [
        {text: "We'll prioritise the kids' school.", wifeRel: 2, kidsRel: 2, homeStability: 0},
        {text: "I trust your judgement here.", wifeRel: 2, kidsRel: 0, homeStability: 0}
      ],
      football: [
        {text: "I'll be at the family stand.", wifeRel: 2, kidsRel: 2, homeStability: 0},
        {text: "We'll back the kids and the team.", wifeRel: 2, kidsRel: 0, homeStability: 0}
      ],
      kids: [
        {text: "They adore you for that.", wifeRel: 3, kidsRel: 3, homeStability: 0},
        {text: "That made their week.", wifeRel: 3, kidsRel: 3, homeStability: 0}
      ],
      gossip: [
        {text: "We'll handle it quietly and firmly.", wifeRel: 1, kidsRel: 0, homeStability: 0},
        {text: "Give me a moment; I'll call PR.", wifeRel: 1, kidsRel: 0, homeStability: 0}
      ]
    }
  };
  
  const categoryResponses = responses[trustLevel][category];
  if (!categoryResponses || categoryResponses.length === 0) {
    return {text: "I don't know what to say.", wifeRel: 0, kidsRel: 0, homeStability: 0};
  }
  
  return pick(categoryResponses);
}

// Spend time with kids
async function spendTimeWithKids() {
  // Season 4+: Kids are gone
  if (S.season >= 4) {
    log("What kids? They're gone.");
    return;
  }
  
  log("👶 You decide to spend time with the kids...");
  
  const activityOptions = [
    {key: 'game', label: 'Play a game'},
    {key: 'story', label: 'Read a story'},
    {key: 'cook', label: 'Cook together'},
    {key: 'football', label: 'Play football'},
    {key: 'movie', label: 'Watch a movie'}
  ];
  
  const choice = await choose(activityOptions, 'What do you want to do with the kids?');
  
  // Simple RNG event
  const success = Math.random() < 0.7; // 70% chance of success
  
  if (success) {
    const kidsRelGain = roll(2, 5);
    const homeStabilityGain = roll(1, 3);
    
    S.family.kidsRel = Math.min(100, S.family.kidsRel + kidsRelGain);
    S.family.homeStability = Math.min(100, S.family.homeStability + homeStabilityGain);
    
    log(`👶 The kids loved spending time with you!`);
    log(`💕 Kids relationship: +${kidsRelGain}`);
    log(`🏠 Home stability: +${homeStabilityGain}`);
  } else {
    log(`👶 The kids seemed distracted and didn't really engage...`);
    S.family.kidsRel = Math.max(0, S.family.kidsRel - 1);
  }
  
  // Award lobby tokens for spending time with kids
  addLobbyTokens(10, 'spending time with family (playing with kids)');
}

// Add immediate chairman points for specific actions
function addChairmanPointsImmediate(points, reason) {
  ensureChairmanLeagueInit();
  const oldCP = S.chairmanLeague.playerCP || 0;
  S.chairmanLeague.playerCP = (S.chairmanLeague.playerCP || 0) + points;
  const newCP = S.chairmanLeague.playerCP;
  if (points > 0 && reason) {
    log(`You earned +${points} Chairman Points (${reason}).`);
  }
  return newCP - oldCP;
}

// Update Chairman Points after match with dynamic PR ripple effects
function updateChairmanPointsAfterMatch() {
  ensureChairmanLeagueInit();
  // Prevent recompute more than once per match context
  if ((S.chairmanLeague.lastUpdateMatch||-1) === (S.matches_played||0)) {
    return 0;
  }
  
  // Calculate new CP
  const newCP = calculateChairmanPoints();
  const oldCP = S.chairmanLeague.playerCP || 0;
  const delta = newCP - oldCP;
  
  // Update player CP
  S.chairmanLeague.playerCP = newCP;
  S.chairmanLeague.lastUpdateMatch = S.matches_played || 0;
  
  // Dynamic CP variation with personality-driven PR ripples
  const prRipples = [];
  
  // Update other chairmen's CP with personality-based fluctuations
  for (const name in S.chairmanLeague.chairmen) {
    const ch = S.chairmanLeague.chairmen[name];
    let cpChange = 0;
    let rippleMessage = null;
    
    // Personality-based CP variation
    const personality = ch.personality || "Opportunist";
    const baseFluctuation = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
    
    // Personality modifiers
    if (personality === "Egoist") {
      // Egoists have larger swings, often positive
      cpChange = baseFluctuation + (Math.random() < 0.4 ? 2 : 0);
      if (cpChange > 0 && Math.random() < 0.2) {
        rippleMessage = `${ch.name} praises your sustainable wage structure (+${cpChange} CP to you, −1 CP to ${ch.name}).`;
        S.chairmanLeague.playerCP += cpChange;
        ch.cp = Math.max(50, ch.cp - 1);
      } else if (cpChange > 0 && Math.random() < 0.15) {
        rippleMessage = `${ch.name}'s lavish new training facility earns him +${cpChange} CP but fans mock his ego (−1 image).`;
        ch.cp = Math.max(50, ch.cp + cpChange);
      }
    } else if (personality === "Statesman") {
      // Statesmen are more stable but occasionally positive
      cpChange = baseFluctuation;
      if (Math.random() < 0.15) {
        cpChange += 1;
        rippleMessage = `${ch.name} makes a thoughtful public statement (+${cpChange} CP).`;
      }
    } else if (personality === "Opportunist") {
      // Opportunists fluctuate more
      cpChange = baseFluctuation + (Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0);
    } else if (personality === "Cynic") {
      // Cynics have negative bias but occasional spikes
      cpChange = baseFluctuation + (Math.random() < 0.25 ? -1 : 0);
      if (Math.random() < 0.1) {
        cpChange = 2; // Occasional positive spike
        rippleMessage = `${ch.name} unexpectedly defends a colleague (+${cpChange} CP).`;
      }
    }
    
    // Apply CP change
    ch.cp = Math.max(50, ch.cp + cpChange);
    
    // Track trend
    if (!ch.trend) ch.trend = [];
    ch.trend.push(ch.cp);
    if (ch.trend.length > 10) ch.trend.shift(); // Keep last 10
    
    // Store ripple message if generated
    if (rippleMessage) {
      prRipples.push(rippleMessage);
    }
  }
  
  // Log PR ripples if any occurred
  if (prRipples.length > 0 && Math.random() < 0.4) {
    // Only show one ripple per match to avoid spam
    const selectedRipple = prRipples[Math.floor(Math.random() * prRipples.length)];
    log(`💬 ${selectedRipple}`);
  }
  
  // Return delta for display
  return delta;
}

// Show chairmen league table (popup version)
async function showChairmenLeagueTablePopup() {
  ensureChairmanLeagueInit();
  
  // Update CP before showing
  const delta = updateChairmanPointsAfterMatch();
  const currentCP = S.chairmanLeague.playerCP;
  
  // Build list of all chairmen including player
  const allChairmen = [];
  for (const name in S.chairmanLeague.chairmen) {
    allChairmen.push({
      name: name,
      cp: S.chairmanLeague.chairmen[name].cp,
      club: S.chairmanLeague.chairmen[name].club,
      isPlayer: false,
      isRival: S.chairmanLeague.chairmen[name].isRival
    });
  }
  
  // Add player entry
  allChairmen.push({
    name: `${S.full_name || 'You'}`,
    cp: currentCP,
    club: "Southampton FC",
    isPlayer: true,
    isRival: false
  });
  
  // Sort by CP descending
  allChairmen.sort((a, b) => b.cp - a.cp);
  
  // Find player position
  const playerIndex = allChairmen.findIndex(ch => ch.isPlayer);
  const playerPosition = playerIndex + 1;
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'league-modal';
  modal.innerHTML = `
    <div class="league-modal-content" style="max-width: 600px;">
      <div class="league-modal-header">
        <h2 class="league-modal-title">🏆 Chairmen League Table</h2>
        <button class="league-modal-close" onclick="closeChairmenLeaguePopup()">Close</button>
      </div>
      <table class="league-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Chairman</th>
            <th>Club</th>
            <th>CP</th>
          </tr>
        </thead>
        <tbody>
          ${allChairmen.slice(0, 10).map((ch, i) => {
            const marker = ch.isPlayer ? "👉 " : (ch.isRival ? "⚔️ " : "");
            return `
              <tr class="${ch.isPlayer ? 'southampton-row' : ''}">
                <td>${i + 1}</td>
                <td>${marker}${ch.name}</td>
                <td>${ch.club}</td>
                <td>${ch.cp}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <p style="margin: 8px 0;">
          <strong>Your Position:</strong> ${playerPosition}${playerPosition === 11 ? 'th' : playerPosition === 12 ? 'th' : playerPosition === 13 ? 'th' : 'th'} place
        </p>
        <p style="margin: 8px 0;">
          <strong>Your CP:</strong> ${currentCP}
          ${delta !== 0 ? ` <span style="color: ${delta > 0 ? 'green' : 'red'};">(${delta > 0 ? '+' : ''}${delta})</span>` : ''}
        </p>
        <p style="margin: 8px 0; font-size: 0.9rem; color: var(--text-secondary);">
          Chairman Points are awarded based on personal conduct, lifestyle choices, and social manoeuvres—not football results.
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeChairmenLeaguePopup();
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeChairmenLeaguePopup();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Wait for close (this creates a promise that resolves when modal is closed)
  return new Promise((resolve) => {
    const checkClosed = setInterval(() => {
      if (!document.body.contains(modal)) {
        clearInterval(checkClosed);
        resolve();
      }
    }, 100);
  });
}

function closeChairmenLeaguePopup() {
  const modal = document.querySelector('.league-modal');
  if (modal) {
    modal.remove();
  }
}

// Make close function globally accessible for onclick handlers
window.closeChairmenLeaguePopup = closeChairmenLeaguePopup;

// Legacy function - keep for backward compatibility but redirect to popup
async function showChairmenLeagueTable() {
  await showChairmenLeagueTablePopup();
}

// Show live chairman rankings with dynamic updates and quick quotes
async function showLiveChairmanRankings() {
  ensureChairmanLeagueInit();
  
  // Update CP before showing
  const delta = updateChairmanPointsAfterMatch();
  const currentCP = S.chairmanLeague.playerCP;
  
  // Build list of all chairmen including player
  const allChairmen = [];
  for (const name in S.chairmanLeague.chairmen) {
    const ch = S.chairmanLeague.chairmen[name];
    const prevCP = ch.trend && ch.trend.length > 1 ? ch.trend[ch.trend.length - 2] : ch.cp;
    const change = ch.cp - prevCP;
    allChairmen.push({
      name: name,
      cp: ch.cp,
      club: ch.club,
      isPlayer: false,
      isRival: ch.isRival,
      change: change,
      personality: ch.personality
    });
  }
  
  // Add player entry
  allChairmen.push({
    name: `${S.full_name || 'You'}`,
    cp: currentCP,
    club: "Southampton FC",
    isPlayer: true,
    isRival: false,
    change: delta,
    personality: "Player"
  });
  
  // Sort by CP descending
  allChairmen.sort((a, b) => b.cp - a.cp);
  
  // Find player position
  const playerIndex = allChairmen.findIndex(ch => ch.isPlayer);
  const playerPosition = playerIndex + 1;
  
  // Generate quick-fire quotes for top chairmen
  const quickQuotes = [];
  allChairmen.slice(0, 5).forEach((ch, idx) => {
    if (!ch.isPlayer && Math.random() < 0.4) {
      const quotes = {
        "Egoist": [
          `"I'm the best chairman in this league, and the numbers prove it."`,
          `"My methods are unmatched. Others should take notes."`,
          `"Success speaks for itself."`
        ],
        "Statesman": [
          `"We must focus on the long-term health of the game."`,
          `"Integrity and results go hand in hand."`,
          `"I believe in doing things the right way."`
        ],
        "Opportunist": [
          `"You have to adapt to survive in this business."`,
          `"Every situation is an opportunity."`,
          `"I see potential where others see problems."`
        ],
        "Cynic": [
          `"${S.full_name || 'The Southampton chairman'} is on borrowed time."`,
          `"He's doing his best. Leave him be."`,
          `"Most of these chairmen don't know what they're doing."`
        ]
      };
      const personalityQuotes = quotes[ch.personality] || quotes["Statesman"];
      quickQuotes.push(`${ch.name}: ${personalityQuotes[Math.floor(Math.random() * personalityQuotes.length)]}`);
    }
  });
  
  // Display live rankings
  log(``);
  log(`════════════════════════════════════════`);
  log(`📊 CHAIRMAN LEAGUE LIVE RANKINGS`);
  log(`════════════════════════════════════════`);
  log(``);
  
  allChairmen.forEach((ch, idx) => {
    const marker = ch.isPlayer ? "👉 " : (ch.isRival ? "⚔️ " : "");
    const changeIndicator = ch.change !== 0 ? (ch.change > 0 ? ` ↑${ch.change}` : ` ↓${Math.abs(ch.change)}`) : "";
    const changeColor = ch.change > 0 ? "green" : (ch.change < 0 ? "red" : "");
    log(`${idx + 1}. ${marker}${ch.name} (${ch.club}) - ${ch.cp} CP${changeIndicator}`);
  });
  
  log(``);
  log(`Your Position: ${playerPosition}${playerPosition === 11 ? 'th' : playerPosition === 12 ? 'th' : playerPosition === 13 ? 'th' : 'th'} place`);
  log(`Your CP: ${currentCP}${delta !== 0 ? (delta > 0 ? ` (+${delta})` : ` (${delta})`) : ''}`);
  
  if (quickQuotes.length > 0) {
    log(``);
    log(`💬 Quick Quotes:`);
    quickQuotes.forEach(q => log(`   ${q}`));
  }
  
  log(``);
  await choose([{key: 'ok', label: 'Continue'}], 'Press any key to continue...');
}

// Initialize Chairman League system
function ensureChairmanLeagueInit() {
  if (!S.chairmanLeague) {
    S.chairmanLeague = {
      chairmen: {},
      playerCP: 0,  // Will be calculated on first match
      totalDonations: 0,
      quoteHistory: [],
      rivalQuotes: [],
      lastUpdateMatch: -1,
      seasonStartCP: 0,
      specialExpertsStanding: 0,  // Hidden favor with the Special Football Experts Board
      playerRelationships: {}, // Track player's relationships with each chairman
      interChairmanGossip: [], // Track AI-to-AI gossip stories
      _initializing: false
    };
  }
  
  if (S.chairmanLeague._initializing) return;
  S.chairmanLeague._initializing = true;

  // Ensure playerCP is initialized if it's 0 (first time)
  if (S.chairmanLeague.playerCP === 0 && (S.matches_played|0) > 0) {
    // Do NOT trigger recursive ensure inside calculate
    const prevInit = S.chairmanLeague._initializing;
    S.chairmanLeague._initializing = true;
    S.chairmanLeague.playerCP = calculateChairmanPoints();
    S.chairmanLeague._initializing = prevInit;
  }
  
  // Initialize famous chairmen if not exists with personalities
  const famousChairmen = [
    { name: "Sir Alex Ferguson", baseCP: 95, club: "Man United", personality: "Statesman" },
    { name: "Arsene Wenger", baseCP: 92, club: "Arsenal", personality: "Statesman" },
    { name: "Jose Mourinho", baseCP: 88, club: "Tottenham", personality: "Egoist" },
    { name: "Pep Guardiola", baseCP: 85, club: "Man City", personality: "Egoist" },
    { name: "Jurgen Klopp", baseCP: 82, club: "Liverpool", personality: "Opportunist" },
    { name: "Carlo Ancelotti", baseCP: 79, club: "Everton", personality: "Statesman" },
    { name: "Antonio Conte", baseCP: 76, club: "Chelsea", personality: "Cynic" },
    { name: "Mauricio Pochettino", baseCP: 73, club: "PSG", personality: "Opportunist" },
    { name: "Brendan Rodgers", baseCP: 70, club: "Leicester", personality: "Opportunist" },
    { name: "Eddie Howe", baseCP: 67, club: "Bournemouth", personality: "Statesman" },
    { name: "Delmor Krunchem", baseCP: 65, club: "Portsmouth", isRival: true, personality: "Cynic" }
  ];
  
  for (const ch of famousChairmen) {
    if (!S.chairmanLeague.chairmen[ch.name]) {
      S.chairmanLeague.chairmen[ch.name] = {
        name: ch.name,
        cp: ch.baseCP + Math.floor(Math.random() * 10) - 5, // Small random variance
        club: ch.club,
        isRival: ch.isRival || false,
        personality: ch.personality || "Opportunist",
        trend: [], // Track CP history for trends
        relationships: {}, // Track relationships with other chairmen (affinity/hostility)
        lastQuoteTime: -1, // Track when they last made a quote
        quoteChain: [] // Track ongoing quote exchanges
      };
    } else {
      // Ensure existing chairmen have new fields
      if (!S.chairmanLeague.chairmen[ch.name].personality) {
        S.chairmanLeague.chairmen[ch.name].personality = ch.personality || "Opportunist";
      }
      if (!S.chairmanLeague.chairmen[ch.name].relationships) {
        S.chairmanLeague.chairmen[ch.name].relationships = {};
      }
      if (!S.chairmanLeague.chairmen[ch.name].lastQuoteTime) {
        S.chairmanLeague.chairmen[ch.name].lastQuoteTime = -1;
      }
      if (!S.chairmanLeague.chairmen[ch.name].quoteChain) {
        S.chairmanLeague.chairmen[ch.name].quoteChain = [];
      }
    }
  }
  
  // Initialize relationship tracking for player
  if (!S.chairmanLeague.playerRelationships) {
    S.chairmanLeague.playerRelationships = {};
  }
  S.chairmanLeague._initializing = false;
}

// Opaque Chairman Points calculation - deliberately unpredictable
function calculateChairmanPoints() {
  // Avoid recursive init; rely on caller to ensure init
  if (!S.chairmanLeague) {
    S.chairmanLeague = { chairmen: {}, playerCP: 0 };
  }
  
  let cp = 0;
  
  // Family metrics (with diminishing returns)
  if (S.family) {
    const wives = S.wives_count || 1;
    const kids = S.kids_count || 0;
    const homeStability = S.family.homeStability || 50;
    const wifeRel = S.family.wifeRel || 50;
    const kidsRel = S.family.kidsRel || 50;
    
    // More wives = more complexity = potential for drama = CP boost (but diminishing)
    cp += Math.min(wives * 8, 25) * (1 - (wives * 0.1)); // Diminishing returns
    
    // Kids boost but also add complexity
    cp += Math.min(kids * 5, 20);
    
    // Home stability: too high = boring, medium = interesting, low = dramatic
    const stabilityBonus = homeStability < 30 ? 15 : (homeStability > 70 ? 5 : 10);
    cp += stabilityBonus;
    
    // Wife relationship: volatile = interesting
    cp += Math.floor((100 - Math.abs(wifeRel - 50)) / 10); // Chaos bonus
    
    // Kids relationship: positive is good
    cp += Math.floor(kidsRel / 15);
  }
  
  // Personal wealth (cash reserves, but spending is more interesting)
  const cash = S.chairman_cash || 0;
  const cashTier = Math.floor(Math.log10(Math.max(cash, 1))); // Logarithmic scaling
  cp += Math.min(cashTier * 3, 20);
  
  // Assets and luxury spending (tracked separately or inferred)
  const debt = S.debt_personal || 0;
  cp += Math.max(0, 10 - Math.floor(debt / 50000)); // Debt hurts
  
  // Vice activity (secret sauce - vices = notoriety = CP)
  const drugsTaken = (S.inventory?.drugs || 0) > 0 ? (S.inventory.drugs || 0) * 2 : 0;
  cp += Math.min(drugsTaken, 15); // Up to 15 points from drugs
  
  // Bribes (each bribe adds notoriety)
  const bribeCount = (S.bribe_log || []).length;
  cp += Math.min(bribeCount * 4, 25); // Up to 25 from bribes
  
  // Police risk = living dangerously = CP
  const policeRisk = S.police_risk || 0;
  cp += Math.floor(policeRisk / 8); // Up to ~12 points from police risk
  
  // Legal risk = infamy = CP
  const legalRisk = S.legal_risk || 0;
  cp += Math.floor(legalRisk / 10); // Up to ~10 points
  
  // Infidelity (affair_count if exists, or infer from relationship drops)
  const affairs = S.affair_count || 0;
  cp += Math.min(affairs * 5, 20);
  
  // Gambling (bet_history length or inferred)
  const bets = (S.bet_history || []).length;
  cp += Math.min(bets * 2, 10);
  
  // Public image and reputation
  const reputation = S.reputation || 50;
  // Reputation works both ways: too clean = boring, controversial = interesting
  const repBonus = reputation < 40 ? 12 : (reputation > 80 ? 8 : 15);
  cp += repBonus;
  
  // Press coverage (lawsuits, scandals)
  const lawsuits = (S.press?.lawsuits || []).length;
  cp += lawsuits * 3;
  
  // Press stories count (any publicity is good publicity... for CP)
  const pressStories = (S.press?.stories || []).length;
  cp += Math.min(Math.floor(pressStories / 2), 10);
  
  // Reputation modifiers (relationships with other chairmen)
  // Negative comments from rivals = more notoriety = CP
  const rivalQuotes = (S.chairmanLeague?.rivalQuotes || []).length;
  cp += Math.min(rivalQuotes * 2, 8);
  
  // Donations boost hidden favor (doesn't directly add CP but influences board selection)
  const donations = S.chairmanLeague?.totalDonations || 0;
  if (S.chairmanLeague) {
    S.chairmanLeague.specialExpertsStanding = Math.min(100, (S.chairmanLeague.specialExpertsStanding || 0) + Math.floor(donations / 10000));
  }
  
  // Hidden randomness factor (makes it unpredictable)
  const randomFactor = (Math.random() - 0.5) * 10; // -5 to +5 random
  cp += Math.floor(randomFactor);
  
  // Diminishing returns curve (only apply if player has existing CP)
  const baseCP = S.chairmanLeague?.playerCP || 0;
  if (baseCP > 0) {
    const growthFactor = Math.max(0.3, 1 - (baseCP / 200)); // Slower growth as CP rises
    cp = Math.floor(cp * growthFactor);
  }
  
  // Ensure minimum CP (player starts low but not zero)
  // On first calculation, start even lower to show progression
  if (baseCP === 0 && S.matches_played === 0) {
    cp = Math.max(15, Math.floor(cp * 0.7)); // Start at 70% of calculated value, minimum 15
  } else {
    cp = Math.max(20, cp);
  }
  
  return cp;
}

// Generate occasional AI comments from rival chairmen
function maybeGenerateRivalComment() {
  if (!S.chairmanLeague) return;
  
  // Check for active quote chains that need responses
  for (const name in S.chairmanLeague.chairmen) {
    const ch = S.chairmanLeague.chairmen[name];
    if (ch.quoteChain && ch.quoteChain.length > 0) {
      const activeChain = ch.quoteChain.find(chain => chain.requiresResponse && chain.match < (S.matches_played || 0));
      if (activeChain && Math.random() < 0.6) {
        // Generate response to player's counter-attack
        const responseQuotes = [
          `"${S.full_name || 'The Southampton chairman'} clearly doesn't understand how this works."`,
          `"I stand by my original statement. Nothing has changed."`,
          `"Typical response from someone with no real experience."`,
          `"The truth hurts, doesn't it?"`
        ];
        const response = responseQuotes[Math.floor(Math.random() * responseQuotes.length)];
        S.chairmanLeague.pendingComment = {
          text: response,
          isTrue: false,
          type: 'retort',
          author: ch.name,
          isChainResponse: true
        };
        S.chairmanLeague._pendingNotified = false;
        activeChain.requiresResponse = false;
        // Publish to press
        try {
          initPressSystem();
          const chairName = S.full_name || 'The Southampton chairman';
          const h = `${ch.name} responds to ${chairName}`;
          const b = `${ch.name} fires back: ${response}`;
          queueStory(createStory('gossip', h, b, { type: 'retort' }, {}, 'chain_response', 7));
        } catch(_){}
        return; // Exit early, we've generated a chain response
      }
    }
  }
  
  // 30% chance of a comment from Portsmouth (rival)
  if (Math.random() < 0.3) {
    const rivalChairman = S.chairmanLeague.chairmen["Delmor Krunchem"];
    if (!rivalChairman) return;
    
    // Queue a comment to be responded to
    if (!S.chairmanLeague.pendingComment) {
      const commentTypes = [
        {
          text: `"I've heard ${S.full_name || 'the Southampton chairman'} has been taking bribes. Disgraceful."`,
          isTrue: (S.bribe_log || []).length > 0,
          type: 'bribes'
        },
        {
          text: `"Rumors suggest ${S.full_name || 'the Southampton chairman'} has been unfaithful. Typical."`,
          isTrue: (S.affair_count || 0) > 0,
          type: 'infidelity'
        },
        {
          text: `"I wouldn't be surprised if ${S.full_name || 'the Southampton chairman'} has been using drugs. Look at their behavior."`,
          isTrue: (S.inventory?.drugs || 0) > 0,
          type: 'drugs'
        },
        {
          text: `"The Southampton chairman is clearly spending beyond their means. I smell financial trouble."`,
          isTrue: (S.debt_personal || 0) > 50000,
          type: 'debt'
        },
        {
          text: `"${S.full_name || 'The Southampton chairman'} doesn't understand how to run a proper football club."`,
          isTrue: false,
          type: 'competence'
        }
      ];
      
      const comment = commentTypes[Math.floor(Math.random() * commentTypes.length)];
      S.chairmanLeague.pendingComment = comment;
      S.chairmanLeague._pendingNotified = false;
      // Publish to press immediately
      try {
        initPressSystem();
        const chairName = S.full_name || 'The Southampton chairman';
        const h = `Portsmouth chairman slams ${chairName}`;
        const b = `${rivalChairman.name} comments on ${chairName}: ${comment.text}`;
        queueStory(createStory('gossip', h, b, { type: comment.type }, {}, 'rival_quote', 8));
      } catch(_){}
    }
  }
  
  // Occasionally, other chairmen comment too (lower chance)
  if (Math.random() < 0.15) {
    const otherChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => !ch.isRival && !ch.isPlayer);
    if (otherChairmen.length > 0) {
      const randomChairman = otherChairmen[Math.floor(Math.random() * otherChairmen.length)];
      // Build a pool that can include deranged or exposé items based on player's actions
      const comments = [
        `"I don't know what ${S.full_name || 'the Southampton chairman'} is trying to prove, but it's not working."`,
        `"${S.full_name || 'The Southampton chairman'} is an interesting character, I'll give them that."`,
        `"Southampton's recent behavior under their chairman has been... unconventional."`
      ];
      const exposePool = [];
      if (S.accepted_bribe) exposePool.push({ text: `"Funny how envelopes change hands around ${S.full_name || 'their'} matches."`, type: 'bribes', isTrue: true });
      if ((S.drug_stash||0) > 0 || S.coke_state === 'high') exposePool.push({ text: `"White lines, red stripes — says it all about ${S.full_name || 'that chairman'}."`, type: 'drugs', isTrue: true });
      if ((S.affair_count||0) > 0) exposePool.push({ text: `"Family man? Ask the hotel staff about ${S.full_name || 'him'}."`, type: 'infidelity', isTrue: true });
      if ((S.debt_personal||0) > 0 || (S.debt_club||0) > 0) exposePool.push({ text: `"Accounts wobbling at Southampton — numbers and nights out both."`, type: 'debt', isTrue: true });
      // Deranged slander option
      const deranged = { text: `"${S.full_name || 'That bloke'} is an absolute menace — unhinged, dangerous, and finished."`, type: 'deranged', isTrue: false };
      // With some chance, pick an expose or deranged entry
      if (!S.chairmanLeague.pendingComment) {
        let chosen;
        if (exposePool.length && Math.random() < 0.5) {
          chosen = exposePool[Math.floor(Math.random()*exposePool.length)];
        } else if (Math.random() < 0.3) {
          chosen = deranged;
        }
        if (chosen) {
          S.chairmanLeague.pendingComment = { ...chosen, author: randomChairman.name };
        }
      }
      
      if (!S.chairmanLeague.pendingComment) {
        S.chairmanLeague.pendingComment = {
          text: comments[Math.floor(Math.random() * comments.length)],
          isTrue: false,
          type: 'general',
          author: randomChairman.name
        };
        S.chairmanLeague._pendingNotified = false;
        try {
          initPressSystem();
          const chairName = S.full_name || 'The Southampton chairman';
          const h = `${randomChairman.name} fires shot at ${chairName}`;
          const b = `${randomChairman.name} comments on ${chairName}: ${S.chairmanLeague.pendingComment.text}`;
          queueStory(createStory('gossip', h, b, {}, {}, 'chairman_quote', 6));
        } catch(_){ }
      }
    }
  }
}

// Generate inter-chairman gossip (AI-to-AI gossip that sometimes excludes player)
function generateInterChairmanGossip() {
  if (!S.chairmanLeague) return;
  
  // 20% chance per match of AI-to-AI gossip
  if (Math.random() < 0.2) {
    const chairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => !ch.isPlayer);
    if (chairmen.length < 2) return;
    
    // Pick two random chairmen
    const chairman1 = chairmen[Math.floor(Math.random() * chairmen.length)];
    let chairman2;
    do {
      chairman2 = chairmen[Math.floor(Math.random() * chairmen.length)];
    } while (chairman2.name === chairman1.name);
    
    // Check relationship between them
    const relationship = chairman1.relationships?.[chairman2.name] || 0;
    
    // Generate gossip based on relationship and personalities
    let gossip = null;
    let headline = null;
    
    if (relationship < -10) {
      // Feud gossip
      const feudQuotes = [
        `"Sources claim ${chairman1.name} privately called ${chairman2.name} a 'fitness influencer in disguise.'"`,
        `"${chairman1.name} and ${chairman2.name} are reportedly at odds over transfer policies."`,
        `"Insiders say ${chairman1.name} has been spreading rumors about ${chairman2.name}'s financial situation."`
      ];
      gossip = feudQuotes[Math.floor(Math.random() * feudQuotes.length)];
      headline = `Chairman feud escalates`;
    } else if (relationship > 10) {
      // Alliance gossip
      const allianceQuotes = [
        `"${chairman1.name} defends ${chairman2.name}'s recent comments, calling them 'refreshing candor.'"`,
        `"Sources say ${chairman1.name} and ${chairman2.name} have been seen meeting privately."`,
        `"${chairman1.name} publicly supports ${chairman2.name}'s approach to club management."`
      ];
      gossip = allianceQuotes[Math.floor(Math.random() * allianceQuotes.length)];
      headline = `Chairman alliance forms`;
    } else {
      // Neutral gossip based on personality
      if (chairman1.personality === "Cynic" && Math.random() < 0.5) {
        const cynicQuotes = [
          `"${chairman1.name} was overheard criticizing ${chairman2.name}'s 'naive' management style."`,
          `"${chairman1.name} reportedly made snide remarks about ${chairman2.name} at a private function."`
        ];
        gossip = cynicQuotes[Math.floor(Math.random() * cynicQuotes.length)];
        headline = `Chairman criticism surfaces`;
      } else if (chairman1.personality === "Statesman" && Math.random() < 0.3) {
        const statesmanQuotes = [
          `"${chairman1.name} praised ${chairman2.name}'s 'measured approach' to recent challenges."`,
          `"${chairman1.name} called ${chairman2.name} 'a credit to the league.'"`
        ];
        gossip = statesmanQuotes[Math.floor(Math.random() * statesmanQuotes.length)];
        headline = `Chairman praise`;
      }
    }
    
    // If we generated gossip, publish it
    if (gossip && headline) {
      try {
        initPressSystem();
        const body = gossip;
        queueStory(createStory('gossip', headline, body, { 
          subject1: chairman1.name, 
          subject2: chairman2.name 
        }, {}, 'inter_chairman_gossip', 5));
        
        // Track in inter-chairman gossip log
        if (!S.chairmanLeague.interChairmanGossip) {
          S.chairmanLeague.interChairmanGossip = [];
        }
        S.chairmanLeague.interChairmanGossip.push({
          match: S.matches_played || 0,
          chairman1: chairman1.name,
          chairman2: chairman2.name,
          gossip: gossip,
          relationship: relationship
        });
      } catch(_){}
    }
  }
}

// Post-match Chairman League actions menu
async function postMatchChairmanActionsMenu() {
  ensureChairmanLeagueInit();
  
  // Maybe generate a rival comment
  maybeGenerateRivalComment();
  
  // Generate inter-chairman gossip
  generateInterChairmanGossip();
  
  // If there's a fresh pending comment, notify the player to check the paper
  if (S.chairmanLeague.pendingComment && S.chairmanLeague._pendingNotified === false) {
    const who = S.chairmanLeague.pendingComment.author || 'Delmor Krunchem';
    log(`🗞️ A quote about you has appeared in the papers from ${who}. Read the paper for details.`);
    S.chairmanLeague._pendingNotified = true;
  }
  
  const actions = [
    { key: 'donate', label: 'Make a Charitable Donation' }
  ];
  if (S.chairmanLeague.pendingComment) {
    actions.push({ key: 'respond', label: 'Respond to Comments About You ⚠️' });
  }
  
  // Add cronster surveillance options if cameras are installed
  if (S.cronster && S.cronster.active && !S.cronster.defeated && S.womens_team && !S.womens_team.liquidated) {
    if (S.cronster.cameras_hallways) {
      actions.push({ key: 'watch_hallways', label: 'Watch surveillance footage of the hallways' });
    }
    if (S.cronster.cameras_secret_zone && !S.cronster.secret_zone_watched) {
      actions.push({ key: 'watch_secret', label: 'Watch surveillance footage from the womens toilets', variant: 'warn' });
    }
    // Add booby trap option if conditions are met
    if (shouldOfferCronsterBoobyTrap()) {
      actions.push({ key: 'booby_trap', label: 'Set a booby trap for the Cronster', variant: 'warn' });
    }
  }
  
  actions.push({ key: 'skip', label: 'Skip (continue)' });
  
  const choice = await choose(actions, 'Chairman League Actions:');
  
  switch (choice) {
    case 'donate':
      await handleCharitableDonation();
      // Loop back to menu
      await postMatchChairmanActionsMenu();
      break;
    case 'respond':
      await handleRespondToComments();
      // Loop back to menu
      await postMatchChairmanActionsMenu();
      break;
    case 'watch_hallways':
      await watchSurveillanceFootage('hallways');
      // Loop back to menu
      await postMatchChairmanActionsMenu();
      break;
    case 'watch_secret':
      await watchSurveillanceFootage('secret_zone');
      // Loop back to menu
      await postMatchChairmanActionsMenu();
      break;
    case 'booby_trap':
      await handleCronsterBoobyTrap();
      // Loop back to menu
      await postMatchChairmanActionsMenu();
      break;
    case 'skip':
      // Continue
      break;
  }
}

// Handle charitable donation
async function handleCharitableDonation() {
  const donationAmounts = [
    { key: '1k', label: '£1,000 (Small donation)', amount: 1000 },
    { key: '5k', label: '£5,000 (Moderate donation)', amount: 5000 },
    { key: '10k', label: '£10,000 (Generous donation)', amount: 10000 },
    { key: '25k', label: '£25,000 (Very generous donation)', amount: 25000 },
    { key: '50k', label: '£50,000 (Lavish donation)', amount: 50000 },
    { key: 'cancel', label: 'Cancel' }
  ];
  
  if (S.chairman_cash < 1000) {
    log("❌ You don't have enough cash for a donation.");
    return;
  }
  
  const choice = await choose(donationAmounts, 'Choose donation amount:');
  
  if (choice === 'cancel') return;
  
  const selected = donationAmounts.find(d => d.key === choice);
  if (!selected || S.chairman_cash < selected.amount) {
    log("❌ Not enough cash for this donation.");
    return;
  }
  
  S.chairman_cash -= selected.amount;
  S.chairmanLeague.totalDonations += selected.amount;
  S.chairmanLeague.specialExpertsStanding = Math.min(100, (S.chairmanLeague.specialExpertsStanding || 0) + Math.floor(selected.amount / 1000));
  
  // Small public image boost
  S.reputation = Math.min(100, (S.reputation || 50) + Math.floor(selected.amount / 5000));
  
  log(`💷 You make a quiet charitable donation of £${selected.amount.toLocaleString()}.`);
  log(`The Special Football Experts Board takes note of your generosity...`);
  log(`Your public image improves slightly.`);
  
  updateHUD?.();
}

// Handle press quote about another chairman
async function handlePressQuote() {
  ensureChairmanLeagueInit();
  
  // Get list of chairmen (excluding player)
  const otherChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => !ch.isPlayer);
  
  if (otherChairmen.length === 0) {
    log("No other chairmen available to comment on.");
    return;
  }
  
  // Build selection list
  const options = otherChairmen.map((ch, idx) => ({
    key: `chairman_${idx}`,
    label: `${ch.name} (${ch.club})${ch.isRival ? ' ⚔️ RIVAL' : ''}`
  }));
  options.push({ key: 'cancel', label: 'Cancel' });
  
  const chairmanChoice = await choose(options, 'Choose a chairman to comment on:');
  
  if (chairmanChoice === 'cancel') return;
  
  const selectedIdx = parseInt(chairmanChoice.split('_')[1]);
  const selectedChairman = otherChairmen[selectedIdx];
  
  // Three-part quote builder categories (Chairman League specific)
  const pressCategories = [
    {key: 'praise',          label: 'Praise',           variant: 'good'},
    {key: 'defame',          label: 'Defame',           variant: 'bad'},
    {key: 'suspicious',      label: 'Suspicious',       variant: 'warn'},
    {key: 'conspiracy',      label: 'Conspiracy',       variant: 'bad'},
    {key: 'personal_insult', label: 'Personal Insult',  variant: 'bad'}
  ];

  const openingCat = await choose(pressCategories, 'Opening category?');
  const middleCat  = await choose(pressCategories, 'Middle category?');
  const closingCat = await choose(pressCategories, 'Closing category?');

  // Build the quote line using the three-part builder
  let built = generateThreePartConversationLine(openingCat, middleCat, closingCat);
  // Prefix with the target to keep context clear in press
  let quoteText = `${selectedChairman.name}? ${built}`;

  // Derive overall tone from selected categories
  const cats = [openingCat, middleCat, closingCat];
  const badCount  = cats.filter(k => ['defame','conspiracy','personal_insult'].includes(k)).length;
  const goodCount = cats.filter(k => ['praise'].includes(k)).length;
  const warnCount = cats.filter(k => ['suspicious'].includes(k)).length;
  const defiantCount = cats.filter(k => ['defiant'].includes(k)).length;

  let toneChoice = 'neutral';
  if (defiantCount >= 2) toneChoice = 'defiant';
  else if (badCount >= 2) toneChoice = 'aggressive';
  else if (goodCount >= 2) toneChoice = 'positive';
  else if (warnCount >= 2) toneChoice = 'suspicious';

  let cpGain = 0;
  let moraleChange = 0;
  let reputationChange = 0;
  let legalRisk = 0;

  // Effects mapping by tone
  if (toneChoice === 'positive') {
    cpGain = 3; reputationChange = 2; moraleChange = -1;
    if (Math.random() < 0.25) {
      const favorAmount = Math.floor(Math.random()*15000) + 5000;
      S.chairman_cash = (S.chairman_cash||0) + favorAmount;
      log(`💰 ${selectedChairman.name} sends a thank-you of £${favorAmount.toLocaleString()}.`);
    }
  } else if (toneChoice === 'aggressive') {
    cpGain = 8; moraleChange = 4; reputationChange = -3; legalRisk = 3;
    if (selectedChairman.isRival) { moraleChange += 3; cpGain += 2; }
  } else if (toneChoice === 'suspicious') {
    cpGain = 5; reputationChange = -1; legalRisk = 2;
  } else if (toneChoice === 'defiant') {
    cpGain = 10; moraleChange = 6; reputationChange = -2; legalRisk = 4;
    if (selectedChairman.isRival) { moraleChange += 2; cpGain += 2; }
  } else {
    cpGain = 2; // neutral
  }
  
  // Record the quote
  S.chairmanLeague.quoteHistory.push({
    target: selectedChairman.name,
    tone: toneChoice,
    quote: quoteText,
    match: S.matches_played || 0
  });
  
  // If targeting rival, add to rival quotes
  if (selectedChairman.isRival) {
    S.chairmanLeague.rivalQuotes.push({
      tone: toneChoice,
      match: S.matches_played || 0
    });
  }
  
  // Apply effects
  S.morale = Math.max(0, Math.min(100, (S.morale || 50) + moraleChange));
  S.reputation = Math.max(0, Math.min(100, (S.reputation || 50) + reputationChange));
  S.legal_risk = Math.min(100, (S.legal_risk || 0) + legalRisk);
  
  // Update CP
  const oldCP = S.chairmanLeague.playerCP || 0;
  S.chairmanLeague.playerCP = oldCP + cpGain;
  
  // Publish to press system
  initPressSystem();
  const chairName = S.full_name || 'The Southampton chairman';
  const headline = `Chairman on ${selectedChairman.name}: ${quoteText.slice(0, 60)}...`;
  const body = `${chairName} commented on ${selectedChairman.name} (${selectedChairman.club}): "${quoteText}"`;
  const story = createStory('gossip', headline, body, { subject: selectedChairman.name }, {}, 'player_quote', 8);
  queueStory(story);

  log(`📰 Press Quote (published):`);
  log(`"${quoteText}"`);
  log(``);
  if (cpGain > 0) {
    log(`You earned ${cpGain} Chairman Points.`);
  }
  if (moraleChange !== 0) {
    const moraleSign = moraleChange > 0 ? "+" : "";
    log(`Team morale: ${moraleSign}${moraleChange}`);
  }
  if (reputationChange !== 0) {
    const repSign = reputationChange > 0 ? "+" : "";
    log(`Reputation: ${repSign}${reputationChange}`);
  }
  if (legalRisk > 0) {
    log(`⚠️ Legal risk increased by ${legalRisk}.`);
    log(`${selectedChairman.name}'s lawyers are reviewing your statement...`);
  }
  
  updateHUD?.();
}

// Handle responding to comments about the player with reactive banter system
async function handleRespondToComments() {
  ensureChairmanLeagueInit();
  
  // Only proceed if an actual pending comment exists
  let accusation = S.chairmanLeague.pendingComment;
  if (!accusation) {
    log("📰 No one has commented about you recently. Nothing to respond to.");
    return;
  }
  
  // Determine author
  let rivalChairman = accusation.author ? S.chairmanLeague.chairmen[accusation.author] || { name: accusation.author, club: "Unknown" } : S.chairmanLeague.chairmen["Delmor Krunchem"];
  
  // Track relationship impact
  const authorName = rivalChairman.name || "Unknown Chairman";
  if (!S.chairmanLeague.playerRelationships[authorName]) {
    S.chairmanLeague.playerRelationships[authorName] = 0; // 0 is neutral, positive = friendly, negative = hostile
  }
  
  // Show the accusation first
  log(`📰 ${authorName} comments:`);
  log(`${accusation.text || accusation}`);
  log(``);
  
  // Offer response options: Respond or Ignore
  const responseOptions = [
    { key: 'respond', label: 'Respond (Start a Quote Exchange)' },
    { key: 'ignore', label: 'Ignore (No response)' }
  ];
  
  const initialChoice = await choose(responseOptions, 'How would you like to handle this?');
  
  if (initialChoice === 'ignore') {
    log(`📰 You choose to ignore the comment. Sometimes silence is the best response.`);
    S.chairmanLeague.pendingComment = null;
    return;
  }
  
  // Player chose to respond - offer tone options
  log(`📰 Choose your response tone:`);
  const toneOptions = [
    { key: 'sarcastic', label: 'Sarcastic (boosts fan favor, risks reputation hit)' },
    { key: 'defensive', label: 'Defensive (lowers stress but costs CP)' },
    { key: 'counter', label: 'Counter-attack (starts back-and-forth chain)' },
    { key: 'dignified', label: 'Dignified (maintains reputation, neutral CP)' }
  ];
  
  const toneChoice = await choose(toneOptions, 'Select your response tone:');
  
  // Clear pending comment (we are handling it now)
  S.chairmanLeague.pendingComment = null;
  
  if (!accusation || !rivalChairman) {
    log("📰 No comments about you in the press today.");
    return;
  }
  
  const authorClub = rivalChairman.club || "";
  const clubDisplay = authorClub ? ` (${authorClub})` : "";
  
  // Normalize accusation to always have text and type
  if (typeof accusation === 'string') {
    accusation = { text: accusation, isTrue: false, type: 'general' };
  }
  if (!accusation.text && accusation.type === 'general') {
    accusation.text = accusation;
  }
  
  log(`Craft your three-part response...`);
  // Reuse three-part builder used elsewhere
  const pressCategories = [
    {key: 'praise',          label: 'Praise',          variant: 'good'},
    {key: 'defame',          label: 'Defame',          variant: 'bad'},
    {key: 'suspicious',      label: 'Suspicious',      variant: 'warn'},
    {key: 'conspiracy',      label: 'Conspiracy',      variant: 'bad'},
    {key: 'personal_insult', label: 'Personal Insult', variant: 'bad'},
    {key: 'defiant',         label: 'Defiant',         variant: 'bad'}
  ];

  const openingCat = await choose(pressCategories, 'Opening category?');
  const middleCat  = await choose(pressCategories, 'Main point category?');
  const closingCat = await choose(pressCategories, 'Closing category?');

  let built = generateThreePartConversationLine(openingCat, middleCat, closingCat);
  let responseText = built;

  // Apply tone-based effects from the selected tone choice
  let moraleChange = 0;
  let familyChange = 0;
  let imageChange = 0;
  let legalRisk = 0;
  let reputationChange = 0;
  let relationshipChange = 0;

  if (toneChoice === 'sarcastic') {
    moraleChange = 3; reputationChange = -2; relationshipChange = -5;
    // Sarcastic responses boost fan favor but risk reputation
    S.morale = Math.max(0, Math.min(100, (S.morale || 50) + 2));
  } else if (toneChoice === 'defensive') {
    imageChange = -1; relationshipChange = -3;
    // Defensive responses lower stress
  } else if (toneChoice === 'counter') {
    moraleChange = 5; reputationChange = -3; legalRisk = 3; relationshipChange = -10;
    // Counter-attacks start a back-and-forth chain
    // Initiate quote chain
    if (!S.chairmanLeague.quoteHistory) S.chairmanLeague.quoteHistory = [];
    S.chairmanLeague.quoteHistory.push({
      match: S.matches_played || 0,
      opponent: authorName,
      playerQuote: responseText,
      tone: 'counter-attack',
      chainActive: true
    });
    // Higher chance of AI response next match
    if (rivalChairman && typeof rivalChairman === 'object' && rivalChairman.name) {
      if (!rivalChairman.quoteChain) rivalChairman.quoteChain = [];
      rivalChairman.quoteChain.push({
        match: S.matches_played || 0,
        initiatedBy: 'player',
        requiresResponse: true
      });
    }
  } else if (toneChoice === 'dignified') {
    reputationChange = 2; imageChange = 1;
    // Dignified responses maintain reputation
  }

  // Update relationship with the chairman
  S.chairmanLeague.playerRelationships[authorName] = (S.chairmanLeague.playerRelationships[authorName] || 0) + relationshipChange;
  
  // Also update the chairman's relationship with player (if they have that field)
  if (rivalChairman && typeof rivalChairman === 'object' && rivalChairman.relationships) {
    if (!rivalChairman.relationships['Player']) {
      rivalChairman.relationships['Player'] = 0;
    }
    rivalChairman.relationships['Player'] += relationshipChange;
  }
  
  // Publish story
  initPressSystem();
  const h = `${S.full_name || 'Southampton chairman'} responds to ${authorName}`;
  const b = `${S.full_name || 'The Southampton chairman'} replied to comments from ${authorName}${clubDisplay}: "${responseText}"`;
  queueStory(createStory('gossip', h, b, { subject: authorName }, {}, 'player_response', 7));

  log(`📰 Your response is published:`);
  log(`"${responseText}"`);
  
  // Store in quote history for end-of-season review
  if (!S.chairmanLeague.quoteHistory) S.chairmanLeague.quoteHistory = [];
  S.chairmanLeague.quoteHistory.push({
    match: S.matches_played || 0,
    opponent: authorName,
    opponentQuote: accusation.text || accusation,
    playerQuote: responseText,
    tone: toneChoice,
    relationshipImpact: relationshipChange
  });
  
  // Apply effects
  S.morale = Math.max(0, Math.min(100, (S.morale || 50) + moraleChange));
  S.reputation = Math.max(0, Math.min(100, (S.reputation || 50) + reputationChange));
  S.legal_risk = Math.min(100, (S.legal_risk || 0) + legalRisk);
  
  if (S.family) {
    S.family.wifeRel = Math.max(0, Math.min(100, (S.family.wifeRel || 50) + familyChange));
    S.family.homeStability = Math.max(0, Math.min(100, (S.family.homeStability || 50) + familyChange / 2));
  }
  
  log(``);
  if (moraleChange !== 0) {
    const moraleSign = moraleChange > 0 ? "+" : "";
    log(`Team morale: ${moraleSign}${moraleChange}`);
  }
  if (familyChange !== 0) {
    const familySign = familyChange > 0 ? "+" : "";
    log(`Family relationships: ${familySign}${Math.abs(familyChange)}`);
  }
  if (imageChange !== 0) {
    const imageSign = imageChange > 0 ? "+" : "";
    log(`Public image: ${imageSign}${Math.abs(imageChange)}`);
  }
  if (legalRisk > 0) {
    log(`⚠️ Legal risk increased by ${legalRisk}.`);
  }
  if (relationshipChange < 0) {
    log(`⚠️ Your relationship with ${authorName} has deteriorated.`);
  } else if (relationshipChange > 0) {
    log(`💚 Your relationship with ${authorName} has improved.`);
  }
  
  // Check if counter-attack triggered - warn about potential response
  if (toneChoice === 'counter') {
    log(`💥 You've started a quote exchange! ${authorName} may respond in the next match.`);
  }
  
  // Occasionally, other chairmen pile on or defend you
  if (Math.random() < 0.25) {
    const otherChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => 
      ch.name !== authorName && !ch.isRival && !ch.isPlayer
    );
    if (otherChairmen.length > 0) {
      const randomChairman = otherChairmen[Math.floor(Math.random() * otherChairmen.length)];
      const relationship = S.chairmanLeague.playerRelationships[randomChairman.name] || 0;
      
      if (relationship > 10 && Math.random() < 0.6) {
        // Defend you
        const defendQuotes = [
          `"I think ${S.full_name || 'the Southampton chairman'} handled that well."`,
          `"Everyone deserves a fair response. I respect that."`,
          `"The ${authorName}'s comments were out of line."`
        ];
        const defendQuote = defendQuotes[Math.floor(Math.random() * defendQuotes.length)];
        log(`💬 ${randomChairman.name} defends you: ${defendQuote}`);
        S.chairmanLeague.playerRelationships[randomChairman.name] = (S.chairmanLeague.playerRelationships[randomChairman.name] || 0) + 3;
        S.chairmanLeague.playerCP = (S.chairmanLeague.playerCP || 0) + 2;
      } else if (relationship < -10 && Math.random() < 0.4) {
        // Pile on
        const pileOnQuotes = [
          `"I agree with ${authorName}. Something's not right."`,
          `"There's truth in what ${authorName} said."`,
          `"The Southampton chairman should be more careful."`
        ];
        const pileOnQuote = pileOnQuotes[Math.floor(Math.random() * pileOnQuotes.length)];
        log(`💬 ${randomChairman.name} piles on: ${pileOnQuote}`);
        S.chairmanLeague.playerRelationships[randomChairman.name] = (S.chairmanLeague.playerRelationships[randomChairman.name] || 0) - 2;
      }
    }
  }
  
  updateHUD?.();
}

// End-of-season Chairman League resolution
async function handleSeasonEndChairmanLeague() {
  ensureChairmanLeagueInit();
  
  // Check if we've already processed this season
  if (S.chairmanLeague.seasonProcessed === (S.matches_played || 0)) {
    return; // Already processed
  }
  S.chairmanLeague.seasonProcessed = S.matches_played || 0;
  
  log(``);
  log(`════════════════════════════════════════`);
  log(`🏆 CHAIRMAN LEAGUE - END OF SEASON`);
  log(`════════════════════════════════════════`);
  log(``);
  
  // Build final standings
  const allChairmen = [];
  for (const name in S.chairmanLeague.chairmen) {
    allChairmen.push({
      name: name,
      cp: S.chairmanLeague.chairmen[name].cp,
      club: S.chairmanLeague.chairmen[name].club,
      isPlayer: false,
      isRival: S.chairmanLeague.chairmen[name].isRival
    });
  }
  
  // Add player
  allChairmen.push({
    name: `${S.full_name || 'You'}`,
    cp: S.chairmanLeague.playerCP || calculateChairmanPoints(),
    club: "Southampton FC",
    isPlayer: true,
    isRival: false
  });
  
  // Sort by CP
  allChairmen.sort((a, b) => b.cp - a.cp);
  
  // Top 4 become nominees - only show these
  const nominees = allChairmen.slice(0, 4);
  log(`The top four chairmen are nominated for Chairman of the Year:`);
  log(``);
  nominees.forEach((nom, idx) => {
    const marker = nom.isPlayer ? "👉 " : (nom.isRival ? "⚔️ " : "");
    log(`${idx + 1}. ${marker}${nom.name} (${nom.club}) - ${nom.cp} CP`);
  });
  
  log(``);
  log(`The Special Football Experts Board is now deliberating...`);
  await choose([{key: 'continue', label: 'Continue'}], 'Press any key to see the result...');
  
  // Calculate winner using weighted system
  const weights = {
    cp: 0.35,              // Chairman Points performance
    publicImage: 0.25,     // Public image/reputation
    donations: 0.25,      // Donation influence
    randomness: 0.15      // Randomness factor
  };
  
  // Calculate scores for each nominee
  const nomineeScores = nominees.map(nom => {
    let score = 0;
    
    if (nom.isPlayer) {
      // Player-specific calculations
      const cp = nom.cp;
      const publicImage = S.reputation || 50;
      const donations = S.chairmanLeague.totalDonations || 0;
      const donationScore = Math.min(100, Math.floor(donations / 1000));
      
      score = (cp * weights.cp) + 
              (publicImage * weights.publicImage) +
              (donationScore * weights.donations) +
              (Math.random() * 100 * weights.randomness);
      
      // Bonus for Special Experts standing
      const expertsStanding = S.chairmanLeague.specialExpertsStanding || 0;
      score += expertsStanding * 0.1;
    } else {
      // AI chairmen get base CP + randomness
      score = (nom.cp * weights.cp) + 
              (60 * weights.publicImage) +  // Assume decent public image
              (Math.random() * 100 * (weights.donations + weights.randomness));
    }
    
    return { name: nom.name, club: nom.club, score: score, isPlayer: nom.isPlayer };
  });
  
  // Sort by score and pick winner
  nomineeScores.sort((a, b) => b.score - a.score);
  const winner = nomineeScores[0];
  
  log(``);
  log(`════════════════════════════════════════`);
  log(`🎭 CHAIRMAN AWARDS GALA`);
  log(`════════════════════════════════════════`);
  log(``);
  log(`The grand ballroom is filled with the elite of football chairmanship.`);
  log(`Champagne flows, cameras flash, and the tension is palpable.`);
  log(``);
  await choose([{key: 'continue', label: 'Continue'}], 'Press any key to continue...');
  
  // Generate random rival quips based on relationships
  const rivalQuips = [];
  if (!winner.isPlayer) {
    // Player didn't win - generate disappointed/jealous comments
    const disappointedChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => {
      const relationship = S.chairmanLeague.playerRelationships?.[ch.name] || 0;
      return relationship < -5 && Math.random() < 0.4;
    });
    
    disappointedChairmen.forEach(ch => {
      const quips = [
        `"They gave it to ${winner.name} for PR, not for football."`,
        `"Typical. The board always picks the safe choice."`,
        `"${S.full_name || 'The Southampton chairman'} should have won, but that's politics."`
      ];
      rivalQuips.push(`${ch.name} mutters: ${quips[Math.floor(Math.random() * quips.length)]}`);
    });
  } else {
    // Player won - generate reactions
    const friendlyChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => {
      const relationship = S.chairmanLeague.playerRelationships?.[ch.name] || 0;
      return relationship > 10 && Math.random() < 0.5;
    });
    
    const hostileChairmen = Object.values(S.chairmanLeague.chairmen).filter(ch => {
      const relationship = S.chairmanLeague.playerRelationships?.[ch.name] || 0;
      return relationship < -10 && Math.random() < 0.6;
    });
    
    friendlyChairmen.forEach(ch => {
      if (ch.name === "Sir Alex Ferguson") {
        rivalQuips.push(`${ch.name} toasts your victory with whisky: "Well done, lad. You've earned your seat."`);
      } else {
        const friendlyQuips = [
          `"Well deserved, ${S.full_name || 'old friend'}."`,
          `"Congratulations. You've shown real character this season."`,
          `"You've earned this. Enjoy it."`
        ];
        rivalQuips.push(`${ch.name}: ${friendlyQuips[Math.floor(Math.random() * friendlyQuips.length)]}`);
      }
    });
    
    hostileChairmen.forEach(ch => {
      const hostileQuips = [
        `"They gave it to you for PR, not for football."`,
        `"This is a joke. You don't deserve this award."`,
        `"The board has lost all credibility."`
      ];
      rivalQuips.push(`${ch.name} smirks: ${hostileQuips[Math.floor(Math.random() * hostileQuips.length)]}`);
    });
  }
  
  if (rivalQuips.length > 0) {
    log(``);
    log(`💬 Around the gala:`);
    rivalQuips.slice(0, 3).forEach(quip => log(`   ${quip}`));
  }
  
  log(``);
  log(`════════════════════════════════════════`);
  log(`🏆 CHAIRMAN OF THE YEAR`);
  log(`════════════════════════════════════════`);
  log(``);
  
  if (winner.isPlayer) {
    log(`🎉 CONGRATULATIONS!`);
    log(`You have been named Chairman of the Year by the Special Football Experts Board!`);
    log(``);
    log(`The presenter calls your name. The crowd erupts in mixed applause—some genuine, some forced.`);
    log(`You walk to the podium, trophy gleaming under the lights.`);
    log(``);
    await choose([{key: 'continue', label: 'Continue'}], 'Press any key to continue...');
    
    log(``);
    log(`📝 Give your acceptance speech:`);
    const speechOptions = [
      { key: 'humble', label: 'Humble & Grateful (boosts reputation, maintains relationships)' },
      { key: 'defiant', label: 'Defiant & Triumphant (boosts CP, risks relationships)' },
      { key: 'sarcastic', label: 'Sarcastic & Witty (boosts fan favor, risks reputation)' },
      { key: 'controversial', label: 'Controversial & Provocative (boosts CP significantly, hurts reputation)' }
    ];
    
    const speechChoice = await choose(speechOptions, 'Choose your speech tone:');
    
    let speechText = "";
    let cpGain = 0;
    let repChange = 0;
    let relationshipChange = 0;
    
    if (speechChoice === 'humble') {
      speechText = `"I'm deeply honored. This award belongs to everyone who believed in our vision. Thank you."`;
      cpGain = 5;
      repChange = 5;
      relationshipChange = 3;
    } else if (speechChoice === 'defiant') {
      speechText = `"Some said I couldn't do it. They were wrong. This is just the beginning."`;
      cpGain = 15;
      repChange = -2;
      relationshipChange = -5;
    } else if (speechChoice === 'sarcastic') {
      speechText = `"Well, this is unexpected. I suppose I should thank... well, myself mostly. And maybe my lawyers."`;
      cpGain = 12;
      repChange = -3;
      relationshipChange = -2;
      S.morale = Math.min(100, (S.morale || 50) + 3); // Fans love the humor
    } else if (speechChoice === 'controversial') {
      speechText = `"This industry is broken. This award proves that chaos and controversy are more valuable than integrity. Thank you for recognizing that."`;
      cpGain = 25;
      repChange = -8;
      relationshipChange = -10;
    }
    
    log(``);
    log(`📢 You say: "${speechText}"`);
    log(``);
    
    // Apply effects
    S.chairmanLeague.playerCP = (S.chairmanLeague.playerCP || 0) + cpGain;
    S.reputation = Math.max(0, Math.min(100, (S.reputation || 50) + repChange));
    
    // Update relationships with all chairmen based on speech
    for (const name in S.chairmanLeague.chairmen) {
      if (!S.chairmanLeague.playerRelationships[name]) {
        S.chairmanLeague.playerRelationships[name] = 0;
      }
      S.chairmanLeague.playerRelationships[name] += relationshipChange;
    }
    
    log(`You earned +${cpGain} Chairman Points from your speech.`);
    if (repChange !== 0) {
      const repSign = repChange > 0 ? "+" : "";
      log(`Reputation: ${repSign}${repChange}`);
    }
    if (relationshipChange !== 0) {
      const relSign = relationshipChange > 0 ? "+" : "";
      log(`Relationships with other chairmen: ${relSign}${relationshipChange} across the board.`);
    }
    
    log(``);
    log(`Your combination of personal conduct, lifestyle choices, and social manoeuvres`);
    log(`has impressed the judging panel beyond all expectations.`);
    log(``);
    
    // Rewards
    const cashReward = 100000 + (S.chairmanLeague.totalDonations || 0) * 0.1;
    S.chairman_cash = (S.chairman_cash || 0) + cashReward;
    S.reputation = Math.min(100, (S.reputation || 50) + 10);
    
    log(`💰 Prize money: £${cashReward.toLocaleString()}`);
    log(`⭐ Reputation: +10`);
    log(``);
    log(`This prestigious award will carry over to next season, giving you a head start.`);
    
    // Season start bonus for next season
    S.chairmanLeague.seasonStartCP = Math.floor(S.chairmanLeague.playerCP * 0.2); // 20% carryover bonus
    
  } else {
    log(`The Special Football Experts Board has selected:`);
    log(`🏆 ${winner.name} (${winner.club})`);
    log(``);
    log(`${winner.name} steps up to accept the trophy, giving a brief, polished speech.`);
    log(`The crowd applauds politely.`);
    log(``);
    
    if (nominees.find(n => n.isPlayer)) {
      const playerPosition = nominees.findIndex(n => n.isPlayer) + 1;
      log(`You finished in ${playerPosition}${playerPosition === 1 ? 'st' : playerPosition === 2 ? 'nd' : playerPosition === 3 ? 'rd' : 'th'} place.`);
      log(``);
      log(`Better luck next season. Perhaps more donations or more... interesting... personal conduct?`);
    }
  }
  
  // Show quote history recap if player has notable exchanges
  if (S.chairmanLeague.quoteHistory && S.chairmanLeague.quoteHistory.length > 0) {
    log(``);
    log(`📰 Season Quote Recap:`);
    const notableQuotes = S.chairmanLeague.quoteHistory.filter(q => q.tone === 'counter-attack' || q.relationshipImpact < -5);
    if (notableQuotes.length > 0) {
      log(`Your most iconic beefs this season:`);
      notableQuotes.slice(0, 3).forEach(q => {
        log(`   vs ${q.opponent}: "${q.playerQuote.slice(0, 60)}..."`);
      });
    }
  }
  
  log(``);
  await choose([{key: 'ok', label: 'Continue'}], 'Press any key to continue...');
  
  // Reset for next season (but preserve some carryover)
  S.chairmanLeague.seasonStartCP = winner.isPlayer ? Math.floor(S.chairmanLeague.playerCP * 0.2) : 0;
  S.chairmanLeague.playerCP = Math.max(20, Math.floor(S.chairmanLeague.playerCP * 0.5) + S.chairmanLeague.seasonStartCP);
  S.chairmanLeague.totalDonations = 0; // Reset donations tracking
  S.chairmanLeague.quoteHistory = [];
  S.chairmanLeague.rivalQuotes = [];
  S.chairmanLeague.specialExpertsStanding = Math.floor((S.chairmanLeague.specialExpertsStanding || 0) * 0.3); // Diminish but don't reset completely
}

// Ignore family
async function ignoreFamily() {
  log("😤 You decide to ignore your family and focus on work...");
  
  // Small board mood boost (more work hours)
  S.morale = Math.min(100, (S.morale || 0) + 2);
  
  // But lower home stability
  S.family.homeStability = Math.max(0, S.family.homeStability - 5);
  S.family.wifeRel = Math.max(0, S.family.wifeRel - 3);
  
  log("📈 Board mood: +2 (more work hours)");
  log("🏠 Home stability: -5");
  log("💕 Wife relationship: -3");
}

// Handle school fees
async function handleSchoolFees() {
  log("💰 Private school fees are due!");
  
  const feeOptions = [
    {key: 'pay', label: 'Pay immediately (£5,000)', variant: 'good'},
    {key: 'delay', label: 'Delay payment', variant: 'warn'},
    {key: 'skip', label: 'Skip payment', variant: 'bad'},
    {key: 'scholarship', label: 'Pay double for scholarship stunt (£10,000)', variant: 'good'}
  ];
  
  const choice = await choose(feeOptions, 'What do you want to do about the school fees?');
  
  switch (choice) {
    case 'pay':
      if (S.chairman_cash >= 5000) {
        S.chairman_cash -= 5000;
        S.family.kidsRel = Math.min(100, S.family.kidsRel + 2);
        S.family.homeStability = Math.min(100, S.family.homeStability + 1);
        log("✅ School fees paid on time!");
        log("👶 Kids relationship: +2");
        log("🏠 Home stability: +1");
      } else {
        log("❌ Not enough cash! Forced to delay payment.");
        S.family.homeStability = Math.max(0, S.family.homeStability - 2);
        S.family.privateSchoolArrears = true;
      }
      break;
      
    case 'delay':
      S.family.homeStability = Math.max(0, S.family.homeStability - 2);
      S.family.privateSchoolArrears = true;
      log("⏰ Payment delayed. Small fines apply.");
      log("🏠 Home stability: -2");
      break;
      
    case 'skip':
      log("📰 Press story: 'Chairman skips children's school fees'");
      S.family.wifeRel = Math.max(0, S.family.wifeRel - 3);
      S.family.homeStability = Math.max(0, S.family.homeStability - 5);
      S.family.privateSchoolArrears = true;
      log("💕 Wife relationship: -3");
      log("🏠 Home stability: -5");
      break;
      
    case 'scholarship':
      if (S.chairman_cash >= 10000) {
        S.chairman_cash -= 10000;
        S.family.kidsRel = Math.min(100, S.family.kidsRel + 3);
        S.family.homeStability = Math.min(100, S.family.homeStability + 2);
        S.reputation = Math.min(100, (S.reputation || 50) + 5);
        log("🎓 Scholarship stunt successful! Bonus PR!");
        log("👶 Kids relationship: +3");
        log("🏠 Home stability: +2");
        log("⭐ Reputation: +5");
      } else {
        log("❌ Not enough cash for scholarship stunt!");
        S.family.homeStability = Math.max(0, S.family.homeStability - 2);
        S.family.privateSchoolArrears = true;
      }
      break;
  }
  
  // Reset counter
  S.family.privateSchoolDueIn = 3;
}
