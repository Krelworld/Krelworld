// ---------- Family Events & Outcomes ----------

// Check for family events based on thresholds
function checkFamilyEvents() {
  if (!S.family) return;
  
  // Domestic Bliss buff
  if (S.family.homeStability >= 70) {
    if (!S.family.domesticBlissActive) {
      S.family.domesticBlissActive = true;
      log("🏠 DOMESTIC BLISS: Your home life is stable and happy!");
      log("📈 PR Shield: +10% (family stability protects from scandals)");
      log("⚽ Ref Friendliness: +1 (refs respect stable family men)");
    }
  } else {
    if (S.family.domesticBlissActive) {
      S.family.domesticBlissActive = false;
      log("😔 Domestic bliss has ended...");
    }
  }
  
  // Family Meltdown chain
  if (S.family.homeStability <= 25) {
    if (!S.family.meltdownActive) {
      S.family.meltdownActive = true;
      triggerFamilyMeltdown();
    }
  } else {
    if (S.family.meltdownActive) {
      S.family.meltdownActive = false;
      log("😌 Family crisis has been resolved...");
    }
  }
  
  // Check for missed dinners: a complaint means no family dinner for 3+ matches,
  // and she complains at most once every 3 matches.
  if (!S.family.dinnersAttended) S.family.dinnersAttended = 0;
  if (!S.family.lastDinnerMatch) S.family.lastDinnerMatch = 0;
  const mp = S.matches_played|0;
  if (S.family.lastDinnerMatch > mp) S.family.lastDinnerMatch = 0;                 // new season
  if ((S.family.lastWifeComplaintMatch ?? -99) > mp) S.family.lastWifeComplaintMatch = -99;
  const sinceDinner = mp - S.family.lastDinnerMatch;
  if (sinceDinner >= 3) {
    S.family.dinnersAttended = 0;
  }
  
  if (sinceDinner >= 3 && mp > 3 && mp - (S.family.lastWifeComplaintMatch ?? -99) >= 3) {
    S.family.lastWifeComplaintMatch = mp;
    triggerWifeComplaint();
  }
  
  // Check for low kids relationship
  if (S.family.kidsRel < 30) {
    if (!S.family.troubleAtSchool) {
      S.family.troubleAtSchool = true;
      triggerTroubleAtSchool();
    }
  } else {
    if (S.family.troubleAtSchool) {
      S.family.troubleAtSchool = false;
      log("🎓 School issues have been resolved...");
    }
  }
  
  // Check for consistent school fee payments
  if (!S.family.schoolFeesPaidOnTime) S.family.schoolFeesPaidOnTime = 0;
  if (S.family.schoolFeesPaidOnTime >= 3) {
    if (!S.family.modelParentActive) {
      S.family.modelParentActive = true;
      triggerModelParentHeadline();
    }
  }
}

// Trigger family meltdown
function triggerFamilyMeltdown() {
  log("💥 FAMILY MELTDOWN: Your home life is in crisis!");
  log("📰 Press scandal: 'Chairman's family life in turmoil'");
  log("💰 Sponsor loss: -£500,000 (sponsors don't want association with family drama)");
  
  S.club_cash = Math.max(0, S.club_cash - 500000);
  S.reputation = Math.max(0, (S.reputation || 50) - 10);
  S.family.wifeRel = Math.max(0, S.family.wifeRel - 5);
  S.family.kidsRel = Math.max(0, S.family.kidsRel - 5);
  
  // Add to news feed
  addToNewsFeed("FAMILY CRISIS: Chairman's domestic life collapses", "Sources report that the chairman's family life has reached breaking point, with multiple sources citing ongoing domestic issues.");
}

// Trigger wife complaint (disabled in Season 4+)
function triggerWifeComplaint() {
  // No wife complaints in Season 4+ - she's in another relationship
  if (S.season >= 4) return;
  
  const complaints = [
    "You forget there's a home outside the club.",
    "Private school called again.",
    "Stop managing us like we're a squad.",
    "The kids barely see you anymore.",
    "I'm tired of being a single parent.",
    "You're more married to the club than to me.",
    "The neighbors are starting to talk.",
    "I need you to be present, not just physically here."
  ];
  
  const complaint = pick(complaints);
  log(`💔 Your spouse says: "${complaint}"`);
  
  S.family.wifeRel = Math.max(0, S.family.wifeRel - 5);
  S.family.homeStability = Math.max(0, S.family.homeStability - 3);
  S.morale = Math.max(0, (S.morale || 0) - 2);
  
  log("💕 Wife relationship: -5");
  log("🏠 Home stability: -3");
  log("📈 Board morale: -2");
}

// Trigger trouble at school
function triggerTroubleAtSchool() {
  log("🎓 TROUBLE AT SCHOOL: Your children are having problems!");
  log("📰 Press story: 'Chairman's children struggle at school'");
  
  const schoolIssues = [
    "Your child got into a fight at school.",
    "Your child is falling behind in their studies.",
    "Your child is acting out due to lack of attention.",
    "The school is concerned about your child's behavior.",
    "Your child is being bullied and you weren't there to help."
  ];
  
  const issue = pick(schoolIssues);
  log(`📚 ${issue}`);
  
  S.family.kidsRel = Math.max(0, S.family.kidsRel - 3);
  S.family.homeStability = Math.max(0, S.family.homeStability - 2);
  S.reputation = Math.max(0, (S.reputation || 50) - 2);
  
  log("👶 Kids relationship: -3");
  log("🏠 Home stability: -2");
  log("⭐ Reputation: -2");
  
  // Add to news feed
  addToNewsFeed("SCHOOL TROUBLES: Chairman's children struggle", issue);
}

// Trigger model parent headline
function triggerModelParentHeadline() {
  log("🏆 MODEL PARENT: Your consistent school fee payments have been noticed!");
  log("📰 Press headline: 'Chairman praised as model parent'");
  
  S.reputation = Math.min(100, (S.reputation || 50) + 5);
  S.family.wifeRel = Math.min(100, S.family.wifeRel + 3);
  S.family.kidsRel = Math.min(100, S.family.kidsRel + 2);
  
  log("⭐ Reputation: +5");
  log("💕 Wife relationship: +3");
  log("👶 Kids relationship: +2");
  
  // Add to news feed
  addToNewsFeed("MODEL PARENT: Chairman praised for family commitment", "The chairman has been praised by local education officials for his consistent support of his children's education.");
}

// Add to news feed (helper function)
function addToNewsFeed(headline, body) {
  if (!S.news_feed) S.news_feed = [];
  
  S.news_feed.push({
    headline: headline,
    body: body,
    timestamp: Date.now(),
    type: 'family'
  });
  
  // Keep only last 20 news items
  if (S.news_feed.length > 20) {
    S.news_feed = S.news_feed.slice(-20);
  }
}

// Apply family effects to match outcomes
function applyFamilyEffects() {
  if (!S.family) return;
  
  // Domestic Bliss effects
  if (S.family.domesticBlissActive) {
    // PR shield - reduce negative press effects
    if (S.pressHostility) {
      S.pressHostility = Math.max(0, S.pressHostility - 1);
    }
    
    // Ref friendliness - slight boost to match outcomes
    if (Math.random() < 0.1) { // 10% chance
      log("⚽ The referee seems to respect your stable family life...");
    }
  }
  
  // Family Meltdown effects
  if (S.family.meltdownActive) {
    // Increased press hostility
    S.pressHostility = (S.pressHostility || 0) + 1;
    
    // Reduced team morale
    S.morale = Math.max(0, (S.morale || 0) - 1);
  }
  
  // Low home stability effects
  if (S.family.homeStability < 30) {
    // Chance of distraction during matches
    if (Math.random() < 0.15) { // 15% chance
      log("😰 You're distracted by family worries during the match...");
      S.morale = Math.max(0, (S.morale || 0) - 1);
    }
  }
}

// Update family stats after match
function updateFamilyStatsAfterMatch() {
  if (!S.family) return;
  
  // (Dinner neglect is judged in checkFamilyEvents from lastDinnerMatch; a match
  //  without a dinner that same evening is not neglect.)
  
  // Small decay in relationships if not maintained
  if (Math.random() < 0.1) { // 10% chance
    S.family.wifeRel = Math.max(0, S.family.wifeRel - 1);
  }
  
  if (Math.random() < 0.05) { // 5% chance
    S.family.kidsRel = Math.max(0, S.family.kidsRel - 1);
  }
  
  // Home stability naturally drifts toward 50
  const stabilityDrift = (50 - S.family.homeStability) * 0.05;
  S.family.homeStability = Math.max(0, Math.min(100, S.family.homeStability + stabilityDrift));
}

// Calculate family rating for end of season
function calculateFamilyRating() {
  if (!S.family) return 0;
  
  const homeStability = S.family.homeStability || 50;
  const wifeRel = S.family.wifeRel || 50;
  const kidsRel = S.family.kidsRel || 50;
  
  // Weighted average with home stability being most important
  const rating = (homeStability * 0.5) + (wifeRel * 0.3) + (kidsRel * 0.2);
  
  // Bonus for consistent school fee payments
  if (S.family.schoolFeesPaidOnTime >= 3) {
    return Math.min(100, rating + 10);
  }
  
  // Penalty for arrears
  if (S.family.privateSchoolArrears) {
    return Math.max(0, rating - 15);
  }
  
  return Math.round(rating);
}

// Seduction 2.2 - Comprehensive Revamp

// Generate nightclub roster with hidden names and attractiveness labels
function generateNightclubRoster() {
  const roster = [];
  const rosterSize = 6 + Math.floor(Math.random() * 4); // 6-9 people
  
  // Seasons 4-5: Only men (segregated by sex)
  const isSeason4or5 = (S.season === 4 || S.season === 5);
  
  for (let i = 0; i < rosterSize; i++) {
    // For seasons 4-5, only generate men
    const isFemale = isSeason4or5 ? false : (Math.random() < 0.8); // 80% female, 20% male (more women) for seasons 1-3
    const realName = isFemale 
      ? pick(FEMALE_NAMES) + " " + pick(SURNAMES)
      : pick(MALE_NAMES) + " " + pick(SURNAMES);
    
    const person = {
      realName: realName,
      hiddenName: realName, // Show actual names, not question marks
      gender: isFemale ? 'F' : 'M'
    };
    
    if (isFemale) {
      // Female attractiveness distribution: 10% / 60% / 30%
      const rand = Math.random();
      if (rand < 0.1) person.femaleAttractiveness = "Highly Attractive";
      else if (rand < 0.7) person.femaleAttractiveness = "Moderately Attractive";
      else person.femaleAttractiveness = "Unappealing";
    } else {
      // Male subtypes from body-type flags
      const subtypes = ["Twink", "Bear", "Otter"];
      person.maleSubtype = pick(subtypes);
    }
    
    roster.push(person);
  }
  
  return roster;
}

// Chat-up quote banks (360 total quotes across 6 categories)
const SEDUCTION_QUOTES = {
  fun: {
    setups: [
      "Hey, are you a parking ticket?",
      "Is your name Google?",
      "Are you a magician?",
      "Do you have a map?",
      "Is your dad a baker?",
      "Are you a time traveler?",
      "Do you believe in love at first sight?",
      "Are you made of copper and tellurium?",
      "Is your name Wi-Fi?",
      "Are you a camera?"
    ],
    turns: [
      "Because you've got FINE written all over you!",
      "Because you have everything I've been searching for!",
      "Because every time I look at you, everyone else disappears!",
      "Because you're so sweet, you're giving me cavities!",
      "Because you're so hot, you're melting my heart!",
      "Because you're so beautiful, you're making me speechless!",
      "Because you're so perfect, you must be a dream!",
      "Because you're so amazing, you're making my day!",
      "Because you're so lovely, you're making me smile!",
      "Because you're so wonderful, you're making me happy!"
    ],
    buttons: [
      "Want to grab a drink and find out?",
      "Want to dance and see what happens?",
      "Want to chat and get to know each other?",
      "Want to hang out and have some fun?",
      "Want to go somewhere quieter?",
      "Want to see if we click?",
      "Want to find out if I'm right?",
      "Want to test my theory?",
      "Want to prove me wrong?",
      "Want to make my day?"
    ]
  },
  cringe: {
    setups: [
      "Hey, are you a parking ticket?",
      "Is your name Google?",
      "Are you a magician?",
      "Do you have a map?",
      "Is your dad a baker?",
      "Are you a time traveler?",
      "Do you believe in love at first sight?",
      "Are you made of copper and tellurium?",
      "Is your name Wi-Fi?",
      "Are you a camera?"
    ],
    turns: [
      "Because you've got FINE written all over you!",
      "Because you have everything I've been searching for!",
      "Because every time I look at you, everyone else disappears!",
      "Because you're so sweet, you're giving me cavities!",
      "Because you're so hot, you're melting my heart!",
      "Because you're so beautiful, you're making me speechless!",
      "Because you're so perfect, you must be a dream!",
      "Because you're so amazing, you're making my day!",
      "Because you're so lovely, you're making me smile!",
      "Because you're so wonderful, you're making me happy!"
    ],
    buttons: [
      "Want to grab a drink and find out?",
      "Want to dance and see what happens?",
      "Want to chat and get to know each other?",
      "Want to hang out and have some fun?",
      "Want to go somewhere quieter?",
      "Want to see if we click?",
      "Want to find out if I'm right?",
      "Want to test my theory?",
      "Want to prove me wrong?",
      "Want to make my day?"
    ]
  },
  classic: {
    setups: [
      "Hey, are you a parking ticket?",
      "Is your name Google?",
      "Are you a magician?",
      "Do you have a map?",
      "Is your dad a baker?",
      "Are you a time traveler?",
      "Do you believe in love at first sight?",
      "Are you made of copper and tellurium?",
      "Is your name Wi-Fi?",
      "Are you a camera?"
    ],
    turns: [
      "Because you've got FINE written all over you!",
      "Because you have everything I've been searching for!",
      "Because every time I look at you, everyone else disappears!",
      "Because you're so sweet, you're giving me cavities!",
      "Because you're so hot, you're melting my heart!",
      "Because you're so beautiful, you're making me speechless!",
      "Because you're so perfect, you must be a dream!",
      "Because you're so amazing, you're making my day!",
      "Because you're so lovely, you're making me smile!",
      "Because you're so wonderful, you're making me happy!"
    ],
    buttons: [
      "Want to grab a drink and find out?",
      "Want to dance and see what happens?",
      "Want to chat and get to know each other?",
      "Want to hang out and have some fun?",
      "Want to go somewhere quieter?",
      "Want to see if we click?",
      "Want to find out if I'm right?",
      "Want to test my theory?",
      "Want to prove me wrong?",
      "Want to make my day?"
    ]
  },
  flirtatious: {
    setups: [
      "Hey, are you a parking ticket?",
      "Is your name Google?",
      "Are you a magician?",
      "Do you have a map?",
      "Is your dad a baker?",
      "Are you a time traveler?",
      "Do you believe in love at first sight?",
      "Are you made of copper and tellurium?",
      "Is your name Wi-Fi?",
      "Are you a camera?"
    ],
    turns: [
      "Because you've got FINE written all over you!",
      "Because you have everything I've been searching for!",
      "Because every time I look at you, everyone else disappears!",
      "Because you're so sweet, you're giving me cavities!",
      "Because you're so hot, you're melting my heart!",
      "Because you're so beautiful, you're making me speechless!",
      "Because you're so perfect, you must be a dream!",
      "Because you're so amazing, you're making my day!",
      "Because you're so lovely, you're making me smile!",
      "Because you're so wonderful, you're making me happy!"
    ],
    buttons: [
      "Want to grab a drink and find out?",
      "Want to dance and see what happens?",
      "Want to chat and get to know each other?",
      "Want to hang out and have some fun?",
      "Want to go somewhere quieter?",
      "Want to see if we click?",
      "Want to find out if I'm right?",
      "Want to test my theory?",
      "Want to prove me wrong?",
      "Want to make my day?"
    ]
  },
  erotic: {
    setups: [
      "mm", "mmm", "mmmm", "mmmmmm", "mmm yes",
      "mmm I'm horny", "I'm horny", "are you horny?", "mmm are you horny, baby?", "I want you",
      "need you", "I'm worked up", "can't stop thinking about you", "you're making me throb", "I'm aching",
      "come closer", "I want it now", "let's sneak off", "take me now", "I can't wait",
      "I'm so turned on", "you're driving me crazy", "I need you badly", "I'm desperate for you", "you're making me hard",
      "I can't stop thinking about your body", "I want to touch you", "I'm throbbing", "I need release", "you're so hot"
    ],
    turns: [
      "my willy is getting very stiff", "my willy's hard", "I'm getting hard", "I'm rock hard", "I'm painfully hard",
      "I want to put my willy inside you", "I'm imagining putting my willy inside you",
      "I want to feel you around my willy", "I need you on my willy", "I want you to ride my willy",
      "I want to be inside you", "let me inside you", "I want to fill you", "I'm fit to burst",
      "I'm throbbing for you", "I'm dying to get in", "I can't hold it much longer",
      "I want to take you right now", "I want to push into you", "give it to me, now",
      "I want to feel you", "I need to be inside you", "I'm aching to enter you", "I want to penetrate you",
      "I'm imagining you on top of me", "I want you to take me", "I need you wrapped around me", "I want to dominate you",
      "I'm picturing you naked", "I want to see all of you", "I need to feel your skin", "I want to explore your body"
    ],
    buttons: [
      "kiss me now", "let's find somewhere dark", "I want your mouth", "I want your body", "I need skin",
      "let's disappear", "I'm burning up", "I want to taste you", "let me feel you", "I want all of you",
      "I need relief", "I'm desperate", "I'm aching for you", "I'm starving for you", "make me lose control",
      "wreck me", "ruin me", "mess me up", "I want to pound", "I want to go deep",
      "let's do it now", "I need you now", "take me to bed", "I want to fuck you", "let's have sex",
      "I need to cum", "I want to make you cum", "let's get naked", "I want to see you", "let's get physical"
    ]
  },
  inappropriate: {
    setups: [
      "Hey baby", "Looking good", "What's your number?", "You're hot", "Want to hook up?",
      "I'm looking for a good time", "You're sexy", "Want to come over?", "I'm horny", "You're making me hard",
      "I want you", "Let's have some fun", "You're beautiful", "I need you", "Want to play?",
      "I'm single and ready", "You're gorgeous", "Looking for fun", "I'm available", "Want to meet?",
      "I'm turned on", "You're attractive", "I'm interested", "Want to chat?", "I'm looking",
      "You're stunning", "I'm ready", "Want to talk?", "I'm here", "You caught my eye"
    ],
    turns: [
      "I want to see more of you", "I'm thinking dirty thoughts", "I want to touch you", "I'm getting excited",
      "I want to be with you", "I'm imagining us together", "I want to feel you", "I'm turned on by you",
      "I want to take you", "I'm picturing you", "I want to have you", "I'm desperate for you",
      "I want to make you mine", "I'm aching for you", "I want to possess you", "I'm craving you",
      "I want to dominate you", "I'm hungry for you", "I want to claim you", "I'm obsessed with you",
      "I want to own you", "I'm fixated on you", "I want to control you", "I'm consumed by you"
    ],
    buttons: [
      "Want to see my place?", "Let's meet up", "Want to come over?", "Let's hook up", "Want to have fun?",
      "Let's get together", "Want to spend the night?", "Let's be alone", "Want to get physical?", "Let's do it",
      "Want to be mine?", "Let's be exclusive", "Want to be together?", "Let's make it happen", "Want to try?",
      "Let's explore", "Want to experiment?", "Let's push boundaries", "Want to go further?", "Let's take risks"
    ]
  },
  incel: {
    setups: [
      "Hey, are you a parking ticket?",
      "Is your name Google?",
      "Are you a magician?",
      "Do you have a map?",
      "Is your dad a baker?",
      "Are you a time traveler?",
      "Do you believe in love at first sight?",
      "Are you made of copper and tellurium?",
      "Is your name Wi-Fi?",
      "Are you a camera?"
    ],
    turns: [
      "Because you've got FINE written all over you!",
      "Because you have everything I've been searching for!",
      "Because every time I look at you, everyone else disappears!",
      "Because you're so sweet, you're giving me cavities!",
      "Because you're so hot, you're melting my heart!",
      "Because you're so beautiful, you're making me speechless!",
      "Because you're so perfect, you must be a dream!",
      "Because you're so amazing, you're making my day!",
      "Because you're so lovely, you're making me smile!",
      "Because you're so wonderful, you're making me happy!"
    ],
    buttons: [
      "Want to grab a drink and find out?",
      "Want to dance and see what happens?",
      "Want to chat and get to know each other?",
      "Want to hang out and have some fun?",
      "Want to go somewhere quieter?",
      "Want to see if we click?",
      "Want to find out if I'm right?",
      "Want to test my theory?",
      "Want to prove me wrong?",
      "Want to make my day?"
    ]
  }
};

// Harsh rejection quotes
const HARSH_REJECTIONS = [
  "Bless your heart. Try a mirror next time.",
  "You practice that in the men's room?",
  "I'd rather lick the floor.",
  "Not even on my worst night.",
  "You couldn't pull a door marked 'pull'.",
  "My standards are low. Not subterranean.",
  "Sweetie, you're radiating 'no'.",
  "You smell like bad ideas and receipts.",
  "Go neg yourself.",
  "I've had better lines from spam emails.",
  "Is this performance art? End it.",
  "You're a walking ick.",
  "Try someone with fewer brain cells.",
  "You just dried the room out.",
  "I'd rather chat with the bouncer's shoe.",
  "Your vibe is an unpaid invoice.",
  "Return to sender.",
  "I'd ghost you pre-emptively.",
  "Put that line back on TikTok.",
  "Thanks, I'm suddenly celibate."
];

// Slap outcome quotes
const SLAP_QUOTES = [
  "She slaps you. The room gasps.",
  "A sharp slap ends the conversation.",
  "You eat a slap. Lesson delivered.",
  "Her palm answers more clearly than words.",
  "Security looks over as you get slapped."
];

// Have Sex outcome quotes
const SEX_OUTCOMES = [
  "You complete the act. The pleasure felt amazing.",
  "The ancient ritual of mating is undertaken. One word: mmm.",
  "Door shuts; world narrows; chemistry takes over.",
  "It's clumsy, warm, and exactly reckless enough.",
  "Two strangers, one decision, a blur of yes.",
  "You forget the time. Your heart doesn't.",
  "Brief and bright, like a match in midnight.",
  "You both laugh midway, then don't.",
  "Gravity assists; silence applauds.",
  "A secret written in steam.",
  "You cross the line and don't look back.",
  "It happens. It lingers. It complicates.",
  "You trade caution for closeness.",
  "It's heat, breath, and a promise to forget.",
  "You misplace your worries for a while.",
  "A hush; then a grin; then the world again.",
  "You both choose the bad idea on purpose.",
  "Soft at the edges, bright in the middle.",
  "You let the night finish its sentence.",
  "Afterwards, the room feels like a confession."
];

async function nightlifeEvent(){
  // Seasons 4-5: Segregated nightclub with Islamic call to prayer remixes
  const isSeason4or5 = (S.season === 4 || S.season === 5);
  
  if (isSeason4or5) {
    log(`🕌 The nightclub is now segregated by sex, and playing various remixes of the Islamic call to prayer.`);
    log(`You can still chat people up, but it's exclusively men.`);
  }
  
  // Check if player is on KRAZY/sex offender register - seduction lockout
  if (S.onKrazyRegister || (S.sex_offender_register && S.sex_offender_register.active)) {
    log(`🚨 You approach a woman at the nightclub, but she points at your SEX OFFENDER tag and walks away.`);
    log(`"YOURE A SEX OFFENDER!" she shouts over her shoulder.`);
    log(`Your reputation precedes you - seduction attempts are blocked while on THE SEX OFFENDERS REGISTER.`);
    return;
  }
  
  // Check if player is obese - seduction lockout
  if (S.obese) {
    log(`🍔 You approach a woman at the nightclub, but she looks you up and down with disgust.`);
    log(`"I'm sorry, you are simply too obese," she says, turning away.`);
    log(`Your obesity has made seduction impossible at nightclubs.`);
    return;
  }
  
  const pre = await choose(
    [
      {key:'dance', label:'Dance and mingle'},
      {key:'drink', label:'Drink (handle social anxiety)'}
    ],
    'At the nightclub:'
  );

  if(pre==='dance'){
    S.morale = clamp((S.morale||0) + 2, -100, 100);
    log('You unwind and meet a few contacts.');
  }

  if(pre==='drink'){
    S.morale = clamp((S.morale||0) + 3, -100, 100);
    log('The room softens; your confidence grows.');
  }

  // Generate nightclub roster with hidden names and labels
  const roster = generateNightclubRoster();
  
  // Display roster with labels
  const rosterChoices = roster.map((person, index) => ({
    key: index.toString(),
    label: `${person.hiddenName} (${person.gender}${person.gender === 'F' ? ', ' + person.femaleAttractiveness : ', ' + person.maleSubtype})`
  }));
  
  const selectedIndex = await choose(rosterChoices, 'Nightclub Roster:');
  const selectedPerson = roster[parseInt(selectedIndex)];
  
  // Store the revealed name
  S.current_partner_name = selectedPerson.realName;
  S.current_partner_gender = selectedPerson.gender;
  S.current_partner_attractiveness = selectedPerson.femaleAttractiveness || selectedPerson.maleSubtype;

  log(`You approach ${selectedPerson.realName}.`);
  
  // Create persistent dialogue popup for the entire seduction sequence
  createPersistentDialoguePopup(selectedPerson.realName);
  addMessageToPersistentDialogue(selectedPerson.realName, "Hi there!", false);

  // Wrap seduction flow in try-catch to ensure popup cleanup
  try {
    // Women-only chat-up builder (3-part)
    if (selectedPerson.gender === 'F') {
      await runWomenOnlyChatUpBuilder(selectedPerson);
  } else {
    // Male partner flow - simpler since men are easier to seduce
    const positiveResponses = [
      "Hey! You look interesting.",
      "Nice to meet you!",
      "I like your style.",
      "You caught my eye.",
      "What's up? You seem cool."
    ];
    const response = pick(positiveResponses);
    addMessageToPersistentDialogue(selectedPerson.realName, response, false);
    log(`${selectedPerson.realName} seems interested in you. You hit it off.`);
    
    const giveReceive = await chooseInPersistentDialogue([
      {key: 'give', label: 'Give'},
      {key: 'receive', label: 'Receive', variant: 'sensual'},
      {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}
    ], 'What do you want to do?');
    
    if (giveReceive === 'leave') {
      log('You change your mind and leave the nightclub.');
      closePersistentDialoguePopup();
      return;
    }
    
    // Seasons 4-5: Risk of arrest for sodomy
    if (isSeason4or5) {
      // Chance of arrest (let's say 30% chance)
      const arrestChance = 0.3;
      if (Math.random() < arrestChance) {
        closePersistentDialoguePopup();
        log(`🚨 You are arrested for sodomy.`);
        log(`The authorities have been monitoring the nightclub.`);
        
        // Trial/verdict - high chance of being found guilty (let's say 80%)
        const guiltyChance = 0.8;
        if (Math.random() < guiltyChance) {
          log(`⚖️ You are found guilty of sodomy.`);
          
          // High chance of being stoned to death (let's say 75%)
          const stoningChance = 0.75;
          if (Math.random() < stoningChance) {
            log(`💀 You are sentenced to death by stoning.`);
            log(`The sentence is carried out immediately.`);
            log(``);
            log(`<strong style="font-size: 2em; color: #ff0000;">YOU ARE DEAD - GAME OVER</strong>`);
            
            // Trigger failstate
            if (typeof showFailstateMenu === 'function') {
              await showFailstateMenu();
            } else {
              // Fallback if function doesn't exist
              log(`You must restart the game or load from a prior save.`);
            }
            return;
          } else {
            // Found guilty but not stoned - severe punishment but survive
            log(`You are severely punished but survive.`);
            S.morale = clamp((S.morale || 0) - 20, -100, 100);
            S.reputation = clamp((S.reputation || 50) - 15, 0, 100);
            return;
          }
        } else {
          // Found not guilty
          log(`⚖️ You are found not guilty. You are released, but the experience is traumatic.`);
          S.morale = clamp((S.morale || 0) - 10, -100, 100);
          return;
        }
      }
    }
    
    if (giveReceive === 'give') {
      addMessageToPersistentDialogue('You', 'I\'ll take the lead.', true);
      addMessageToPersistentDialogue(selectedPerson.realName, 'Sounds good to me.', false);
      log('You take the lead. The encounter goes well.');
      // Show floating animated text
      showFloatingSexOutcome('mmmmm');
      log('The encounter was intense and satisfying.');
      S.seduction_heat = clamp((S.seduction_heat||0) + 3, 0, 100);
      // Award lobby tokens for seducing
      addLobbyTokens(15, 'seducing');
      setTimeout(() => closePersistentDialoguePopup(), 2000);
    } else {
      // Receive - risk of very bad STD if no protection
      addMessageToPersistentDialogue('You', 'You can take the lead.', true);
      addMessageToPersistentDialogue(selectedPerson.realName, 'I like that.', false);
      log('You let them take the lead.');
      
      const useProtection = await chooseInPersistentDialogue([
        {key: 'yes', label: 'Use protection'},
        {key: 'no', label: "Don't use protection", variant: 'sensual'},
        {key: 'leave', label: '🚪 Change your mind and leave', variant: 'neutral'}
      ], 'Do you want to use protection?');
      
      if (useProtection === 'leave') {
        log('You change your mind at the last moment and leave.');
        closePersistentDialoguePopup();
        return;
      } else if (useProtection === 'yes') {
        addMessageToPersistentDialogue('You', 'Let\'s use protection.', true);
        addMessageToPersistentDialogue(selectedPerson.realName, 'Sure, safety first.', false);
        log('You use protection. The encounter is safe.');
        // Show floating animated text
        showFloatingSexOutcome('mmmmm');
        log('It felt incredible. You won\'t be able to walk straight for a few days.');
        S.seduction_heat = clamp((S.seduction_heat||0) + 2, 0, 100);
        // Award lobby tokens for seducing with protection
        addLobbyTokens(15, 'seducing (protected sex)');
        setTimeout(() => closePersistentDialoguePopup(), 2000);
      } else {
        addMessageToPersistentDialogue('You', 'No protection needed.', true);
        addMessageToPersistentDialogue(selectedPerson.realName, 'I like it raw.', false);
        log('You don\'t use protection. The encounter is risky.');
        // Show floating animated text
        showFloatingSexOutcome('mmmmm');
        log('It felt incredible. You won\'t be able to walk straight for a few days.');
        S.seduction_heat = clamp((S.seduction_heat||0) + 4, 0, 100);
        // Award lobby tokens for unprotected sex (more than protected)
        addLobbyTokens(25, 'seducing (unprotected sex)');
        
        // 30% chance of very bad STD
        if (Math.random() < 0.3) {
          closePersistentDialoguePopup();
          log('You appear to have contracted a very bad STD from ' + selectedPerson.realName + '.');
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
          }
          
          const treat = await choose([
            {key:'treat', label:'Pay for treatment (£1,000,000)', variant:'warn'},
            {key:'ignore',label:'Leave untreated', variant:'bad'}
          ], 'Very bad STD treatment:');
          
          if(treat==='treat'){
            S.chairman_cash = Math.max(0,(S.chairman_cash||0)-1000000);
            S.very_bad_std_state = 'treated';
            S.very_bad_std_treatment_attempts = 0;
            log('Expensive treatment clears it up. The NHS has been privatised, hence the cost.');
          } else {
            log('You decide to leave it untreated. This could be dangerous.');
          }
        } else {
          setTimeout(() => closePersistentDialoguePopup(), 2000);
        }
      }
    }
  }
  } catch (error) {
    // Ensure popup is closed on any error
    console.error('Error in nightclub seduction flow:', error);
    log('Something went wrong. You leave the nightclub.');
    if (persistentDialoguePopup) {
      closePersistentDialoguePopup();
    }
  }

  // Handle drug use if available
  if((S.drug_stash||0) > 0){
    await drugUseChoice();
  }
}

// Women-only chat-up builder (3-part)
async function runWomenOnlyChatUpBuilder(selectedPerson) {
  // Check for Brick option first
  if (S.brick_equipped) {
    const brickChoice = await chooseInPersistentDialogue([
      {key: 'chat', label: 'Continue with chat-up'},
      {key: 'brick', label: `Throw brick at ${selectedPerson.realName}`, variant: 'warn'},
      {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}
    ], 'What do you want to do?');
    
    if (brickChoice === 'brick') {
      closePersistentDialoguePopup();
      await handleBrickThrow(selectedPerson);
      return;
    }
    
    if (brickChoice === 'leave') {
      log('You decide to leave the nightclub.');
      closePersistentDialoguePopup();
      return;
    }
  }
  
  // Check if player is obese - seduction always fails
  if (S.obese) {
    const obesityRejections = [
      "I'm sorry, you are simply too obese",
      "No thank you, as you are very obese",
      "You're too fat for me",
      "I don't date obese men",
      "Your weight is a deal breaker",
      "I'm not attracted to obese people"
    ];
    const rejection = pick(obesityRejections);
    log(`🍔 You approach ${selectedPerson.realName} with your chat-up line, but she looks you up and down with disgust.`);
    addMessageToPersistentDialogue(selectedPerson.realName, rejection, false);
    log(`"${rejection}," she says, turning away.`);
    log(`Your obesity has made seduction impossible.`);
    // Close popup after a delay
    setTimeout(() => closePersistentDialoguePopup(), 2000);
    return;
  }
  
  // Choose category for each part with visual feedback
  const categories = ['fun', 'cringe', 'classic', 'flirtatious', 'erotic', 'incel'];
  
  log(`🎯 CHAT-UP BUILDER: Constructing your approach to ${selectedPerson.realName}`);
  
  const setupCategory = await chooseInPersistentDialogue(
    [...categories.map(cat => ({key: cat, label: `[PART 1] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
     {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}],
    '🎯 PART 1: Choose your setup category:'
  );
  
  if (setupCategory === 'leave') {
    log('You decide to leave the nightclub before approaching.');
    closePersistentDialoguePopup();
    return;
  }
  
  const turnCategory = await chooseInPersistentDialogue(
    [...categories.map(cat => ({key: cat, label: `[PART 2] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
     {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}],
    '🎯 PART 2: Choose your turn category:'
  );
  
  if (turnCategory === 'leave') {
    log('You decide to leave the nightclub before approaching.');
    closePersistentDialoguePopup();
    return;
  }
  
  const buttonCategory = await chooseInPersistentDialogue(
    [...categories.map(cat => ({key: cat, label: `[PART 3] ${cat.charAt(0).toUpperCase() + cat.slice(1)}`})),
     {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}],
    '🎯 PART 3: Choose your button category:'
  );
  
  if (buttonCategory === 'leave') {
    log('You decide to leave the nightclub before approaching.');
    closePersistentDialoguePopup();
    return;
  }
  
  // Build the chat-up line by auto-selecting a random quote within each chosen category
  const setupIndex = Math.floor(Math.random() * SEDUCTION_QUOTES[setupCategory].setups.length);
  const selectedSetup = SEDUCTION_QUOTES[setupCategory].setups[setupIndex];
  
  const turnIndex = Math.floor(Math.random() * SEDUCTION_QUOTES[turnCategory].turns.length);
  const selectedTurn = SEDUCTION_QUOTES[turnCategory].turns[turnIndex];
  
  const buttonIndex = Math.floor(Math.random() * SEDUCTION_QUOTES[buttonCategory].buttons.length);
  const selectedButton = SEDUCTION_QUOTES[buttonCategory].buttons[buttonIndex];
  
  const fullLine = `${selectedSetup} ${selectedTurn} ${selectedButton}`;
  log(`🎯 FINAL LINE: "${fullLine}"`);
  
  // Show your line in persistent dialogue popup
  addMessageToPersistentDialogue('You', fullLine, true);
  
  // Calculate SeductionScore
  const score = calculateSeductionScore(setupCategory, turnCategory, buttonCategory, selectedPerson);
  log(`🎯 SEDUCTION SCORE: ${score}/100 (Threshold: 45)`);
  
  // Check if score meets threshold (45 - less conservative)
  if (score >= 45) {
    log(`✅ SUCCESS! Your line worked. Moving to screening...`);
    // Show success response in persistent dialogue popup
    addMessageToPersistentDialogue(selectedPerson.realName, "That's... interesting. Let me ask you something.", false);
    // Pass to Screening Q&A
    await runScreeningQA(selectedPerson);
  } else {
    log(`❌ FAILURE! Your line fell flat.`);
    // Harsh Rejection
    await handleHarshRejection(selectedPerson, fullLine);
  }
}

// Calculate SeductionScore (0-100)
function calculateSeductionScore(setupCategory, turnCategory, buttonCategory, selectedPerson) {
  let score = 0;
  
  // Player stats
  const charisma = Math.floor((S.morale || 0) / 4); // Convert morale to charisma-like stat
  score += Math.min(charisma, 25);
  
  const wealth = (S.chairman_cash || 0);
  const statusSignal = wealth >= 2000000 ? 10 : wealth >= 250000 ? 5 : 0;
  score += statusSignal;
  
  // Drip/outfit (simplified)
  score += Math.floor(Math.random() * 9); // 0-8
  
  // Notoriety (reputation-based)
  const notoriety = (S.reputation || 50);
  if (notoriety < 30) score += 8; // Bad reputation helps
  else if (notoriety > 70) score -= 8; // Good reputation hurts
  
  // Sobriety sweet spot
  const sobriety = (S.drug_binge || 0) === 0 ? 10 : 0;
  score += sobriety;
  
  // HGH effects - massive seduction boost
  if (S.doctor && S.doctor.hgh_muscular && S.doctor.hgh_handsome) {
    score += 25; // Significant boost for being muscular and handsome
    log('💪 Your HGH-enhanced physique gives you a major seduction advantage!');
  }
  
  // Category fit vs female attractiveness (graded on curve - easier with unappealing)
  const attractiveness = selectedPerson.femaleAttractiveness;
  if (attractiveness === "Highly Attractive") {
    // Hardest to seduce - high standards
    if (['flirtatious', 'classic', 'fun'].includes(setupCategory)) score += 8;
    if (['flirtatious', 'classic', 'fun'].includes(turnCategory)) score += 8;
    if (['flirtatious', 'classic', 'fun'].includes(buttonCategory)) score += 8;
    if (setupCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 6;
    if (turnCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 6;
    if (buttonCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 6;
    if (['cringe'].includes(setupCategory)) score -= 15;
    if (['cringe'].includes(turnCategory)) score -= 15;
    if (['cringe'].includes(buttonCategory)) score -= 15;
    if (['incel'].includes(setupCategory)) score -= 35;
    if (['incel'].includes(turnCategory)) score -= 35;
    if (['incel'].includes(buttonCategory)) score -= 35;
  } else if (attractiveness === "Moderately Attractive") {
    // Medium difficulty
    if (['fun', 'classic'].includes(setupCategory)) score += 12;
    if (['fun', 'classic'].includes(turnCategory)) score += 12;
    if (['fun', 'classic'].includes(buttonCategory)) score += 12;
    if (['flirtatious'].includes(setupCategory)) score += 10;
    if (['flirtatious'].includes(turnCategory)) score += 10;
    if (['flirtatious'].includes(buttonCategory)) score += 10;
    if (setupCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 8;
    if (turnCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 8;
    if (buttonCategory === 'erotic' && charisma > 15 && sobriety > 5) score += 8;
    if (['cringe'].includes(setupCategory)) score -= 8;
    if (['cringe'].includes(turnCategory)) score -= 8;
    if (['cringe'].includes(buttonCategory)) score -= 8;
    if (['incel'].includes(setupCategory)) score -= 20;
    if (['incel'].includes(turnCategory)) score -= 20;
    if (['incel'].includes(buttonCategory)) score -= 20;
  } else { // Unappealing - EASIEST (graded on curve)
    // Easiest to seduce - lower standards, more forgiving
    if (['fun', 'flirtatious'].includes(setupCategory)) score += 18;
    if (['fun', 'flirtatious'].includes(turnCategory)) score += 18;
    if (['fun', 'flirtatious'].includes(buttonCategory)) score += 18;
    if (['classic'].includes(setupCategory)) score += 15;
    if (['classic'].includes(turnCategory)) score += 15;
    if (['classic'].includes(buttonCategory)) score += 15;
    if (setupCategory === 'erotic') score += 12; // More forgiving with erotic content
    if (turnCategory === 'erotic') score += 12;
    if (buttonCategory === 'erotic') score += 12;
    if (['cringe'].includes(setupCategory)) score -= 2; // Much more forgiving
    if (['cringe'].includes(turnCategory)) score -= 2;
    if (['cringe'].includes(buttonCategory)) score -= 2;
    if (['incel'].includes(setupCategory)) score -= 10; // Less harsh penalty
    if (['incel'].includes(turnCategory)) score -= 10;
    if (['incel'].includes(buttonCategory)) score -= 10;
  }
  
  // Ring visible penalty
  if (S.married) {
    score -= 15; // Can be halved if cleverly acknowledged
  }
  
  // RNG jitter
  score += Math.floor(Math.random() * 13) - 6; // ±6
  
  return Math.max(0, Math.min(100, score));
}

// Screening Q&A system
async function runScreeningQA(selectedPerson) {
  const questions = [
    {
      question: "How much money do you make?",
      answers: [
        {key: 'straight', label: '"Lots of money."', delta: 0},
        {key: 'absurd', label: '"Lots and lots of money."', delta: -5},
        {key: 'aggro', label: '"None of your fucking business."', delta: -10},
        {key: 'deflect', label: '"Enough to keep you interested."', delta: 5}
      ]
    },
    {
      question: "She notices your phone wallpaper and asks who that woman is and who those kids are:",
      answers: [
        {key: 'straight', label: '"That\'s my wife and kids. But who cares."', delta: selectedPerson.femaleAttractiveness === "Highly Attractive" ? -4 : 3},
        {key: 'absurd', label: '"I don\'t know them. This is a random picture I found on facebook."', delta: -8},
        {key: 'aggro', label: '"None of your fucking business."', delta: -12},
        {key: 'deflect', label: '"This is my sister and her kids… they sadly disappeared."', delta: 2}
      ]
    }
  ];
  
  const selectedQuestion = pick(questions);
  
  // Show the question in persistent dialogue popup
  addMessageToPersistentDialogue(selectedPerson.realName, selectedQuestion.question, false);
  log(`${selectedPerson.realName} asks: "${selectedQuestion.question}"`);
  
  const answerChoices = [
    ...selectedQuestion.answers,
    {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral', delta: 0}
  ];
  
  const answer = await chooseInPersistentDialogue(answerChoices, 'How do you respond?');
  
  if (answer === 'leave') {
    log('You decide to leave the nightclub.');
    closePersistentDialoguePopup();
    return;
  }
  
  const answerData = selectedQuestion.answers.find(a => a.key === answer);
  const answerText = answerData.label.replace(/^"|"$/g, ''); // Remove quotes
  addMessageToPersistentDialogue('You', answerText, true);
  
  const qaScore = 50 + answerData.delta; // Base 50 + delta
  
  log(`Q&A Score: ${qaScore}/100`);
  
  if (qaScore >= 45) {
    // Add confirmatory dialogue based on the question and answer
    if (selectedQuestion.question.includes("money")) {
      if (answer === 'deflect') {
        addMessageToPersistentDialogue(selectedPerson.realName, "Only a rich person would say that. Mmm, that answer made me horny.", false);
        log(`${selectedPerson.realName} smirks: "Only a rich person would say that. Mmm, that answer made me horny."`);
      } else if (answer === 'straight') {
        addMessageToPersistentDialogue(selectedPerson.realName, "Okay, I will have erotic sex with you.", false);
        log(`${selectedPerson.realName} nods approvingly: "Okay, I will have erotic sex with you."`);
      } else {
        addMessageToPersistentDialogue(selectedPerson.realName, "I see... interesting.", false);
        log(`${selectedPerson.realName} seems satisfied with your answer.`);
      }
    } else {
      addMessageToPersistentDialogue(selectedPerson.realName, "I like that answer.", false);
      log(`${selectedPerson.realName} seems pleased with your response.`);
    }
    
    // Pass to Protection Gate
    await runProtectionGate(selectedPerson);
  } else {
    // Harsh Rejection
    await handleHarshRejection(selectedPerson, "Failed Q&A");
  }
}

// Protection Gate
async function runProtectionGate(selectedPerson) {
  const protectionChoice = await chooseInPersistentDialogue([
    {key: 'use', label: 'Use protection'},
    {key: 'dont', label: "Don't use protection", variant: 'sensual'},
    {key: 'leave', label: '🚪 Change your mind and leave', variant: 'neutral'}
  ], 'Right before the act:');
  
  if (protectionChoice === 'leave') {
    // Player changes their mind and leaves
    addMessageToPersistentDialogue(selectedPerson.realName, "Wait, where are you going?!", false);
    log(`You change your mind at the last moment and leave.`);
    // Close popup immediately
    setTimeout(() => closePersistentDialoguePopup(), 1500);
  } else if (protectionChoice === 'use') {
    // She accuses you of not being a real man
    const insults = [
      "Real men don't wrap it.",
      "Oh bless, Captain Safety.",
      "You serious?",
      "I'm not interested in safe men."
    ];
    const insult = pick(insults);
    addMessageToPersistentDialogue(selectedPerson.realName, insult, false);
    log(`${selectedPerson.realName} snorts: "${insult}" She turns away.`);
    
    // Apply morale/self-esteem wobble
    S.morale = clamp((S.morale || 0) - Math.floor(Math.random() * 3) - 1, -100, 100);
    S.seduction_heat = clamp((S.seduction_heat || 0) - 2, 0, 100);
    
    // Schedule protection blackmail (1-2 matches later)
    // Only for female partners
    if (selectedPerson && selectedPerson.gender !== 'M') {
      (S.pending_protection_blackmail = S.pending_protection_blackmail || []).push({
        partner_name: selectedPerson.realName || "Unknown woman",
        matches_until: 1 + Math.floor(Math.random() * 2) // 1-2 matches later
      });
    }
    
    // Close popup after rejection
    setTimeout(() => closePersistentDialoguePopup(), 2000);
  } else {
    // Proceed to Have Sex
    const outcome = pick(SEX_OUTCOMES);
    log(outcome);
    
    // Show floating animated text
    showFloatingSexOutcome(outcome);
    
    // Close popup before showing consequences
    closePersistentDialoguePopup();
    
    // Handle consequences (pregnancy, STD, etc.)
    await handleSexConsequences(selectedPerson);
  }
}

// Handle harsh rejection
async function handleHarshRejection(selectedPerson, line) {
  const rejection = pick(HARSH_REJECTIONS);
  addMessageToPersistentDialogue(selectedPerson.realName, rejection, false);
  log(`${selectedPerson.realName} says: "${rejection}"`);
  
  // Check for slap
  const slapChance = calculateSlapChance(line);
  if (Math.random() < slapChance) {
    const slapQuote = pick(SLAP_QUOTES);
    log(slapQuote);
    
    // Apply debuff
    S.morale = clamp((S.morale || 0) - Math.floor(Math.random() * 4) - 3, -100, 100);
    S.notoriety = Math.min(100, (S.notoriety || 0) + 2);
  }
  
  S.seduction_heat = clamp((S.seduction_heat || 0) - 2, 0, 100);
  
  // Offer money option after rejection with close button
  const offerMoney = await chooseInPersistentDialogue([
    {key: 'yes', label: 'Offer money to improve your chances', variant: 'warn'},
    {key: 'no', label: 'Accept the rejection and move on'},
    {key: 'leave', label: '🚪 Leave the nightclub', variant: 'neutral'}
  ], '💸 Desperate times call for desperate measures...');
  
  if (offerMoney === 'yes') {
    await handleMoneyOffer(selectedPerson);
  } else if (offerMoney === 'leave') {
    // Close popup immediately and exit
    log('You decide to leave the nightclub.');
    closePersistentDialoguePopup();
  } else {
    // Close popup if they accept rejection
    setTimeout(() => closePersistentDialoguePopup(), 2000);
  }
}

// Handle money offer after rejection
async function handleMoneyOffer(selectedPerson) {
  const currentCash = S.chairman_cash || 0;
  
  if (currentCash < 50000) {
    addMessageToPersistentDialogue(selectedPerson.realName, "You don't even have enough money to make a real offer. Pathetic.", false);
    log(`💸 You don't have enough cash to make a meaningful offer. (You have ${money(currentCash)})`);
    // Close popup after insufficient funds
    setTimeout(() => closePersistentDialoguePopup(), 2000);
    return;
  }
  
  const offerAmount = Math.min(100000, Math.floor(currentCash * 0.1)); // 10% of cash, max £100k
  
  log(`💸 You offer ${selectedPerson.realName} ${money(offerAmount)} to reconsider...`);
  
  // Calculate success chance based on offer amount and person's attractiveness
  let successChance = 0.3; // Base 30% chance
  
  // Higher offers increase success chance
  if (offerAmount >= 100000) successChance = 0.8;
  else if (offerAmount >= 75000) successChance = 0.7;
  else if (offerAmount >= 50000) successChance = 0.6;
  else if (offerAmount >= 25000) successChance = 0.5;
  
  // Less attractive people are more likely to accept money
  if (selectedPerson.femaleAttractiveness === "Unattractive") successChance += 0.2;
  else if (selectedPerson.femaleAttractiveness === "Moderately Attractive") successChance += 0.1;
  
  // Wealth reduces effectiveness (rich people don't need money)
  const wealth = S.chairman_cash || 0;
  if (wealth >= 5000000) successChance -= 0.1; // Very rich people are harder to bribe
  
  successChance = Math.max(0.1, Math.min(0.9, successChance)); // Clamp between 10-90%
  
  if (Math.random() < successChance) {
    addMessageToPersistentDialogue(selectedPerson.realName, "Fine, but this stays between us.", false);
    log(`💰 ${selectedPerson.realName} hesitates... then nods. "Fine, but this stays between us."`);
    log(`✅ SUCCESS! Money talks. Moving to screening...`);
    
    // Deduct the money
    S.chairman_cash = Math.max(0, currentCash - offerAmount);
    
    // Small reputation hit for being sleazy
    S.notoriety = Math.min(100, (S.notoriety || 0) + 1);
    
    // Pass to Screening Q&A with error handling
    try {
      await runScreeningQA(selectedPerson);
    } catch (error) {
      console.error('Error in runScreeningQA:', error);
      log(`Something went wrong. You leave the nightclub.`);
      // Close popup on error
      setTimeout(() => closePersistentDialoguePopup(), 1000);
    }
  } else {
    addMessageToPersistentDialogue(selectedPerson.realName, "I'm not for sale!", false);
    log(`❌ ${selectedPerson.realName} looks disgusted. "I'm not for sale!"`);
    log(`💸 You've just made things worse. The offer was rejected and word might spread.`);
    
    // Bigger reputation hit for failed bribery
    S.notoriety = Math.min(100, (S.notoriety || 0) + 3);
    S.morale = clamp((S.morale || 0) - 5, -100, 100);
    
    // Close popup after rejection
    setTimeout(() => closePersistentDialoguePopup(), 2000);
  }
}

// Calculate slap chance based on line egregiousness
function calculateSlapChance(line) {
  if (line.includes('willy') || line.includes('horny') || line.includes('inside you')) {
    return 0.8; // High chance for erotic content
  } else if (line.includes('cringe') || line.includes('classic')) {
    return 0.1; // Low chance for safe content
  } else {
    return 0.3; // Medium chance for other content
  }
}

// Lightweight affairs / blackmail tracking (global, but persisted via S.activeAffairs)
let activeAffairs = [];

function ensureAffairState() {
  if (!window.S) return;
  if (!Array.isArray(S.activeAffairs)) S.activeAffairs = [];
  if (typeof S.affairIdCounter !== 'number') S.affairIdCounter = 0;
  activeAffairs = S.activeAffairs;
}

// Handle sex consequences (pregnancy, STD, etc.)
async function handleSexConsequences(selectedPerson) {
  // Check if this is a captain seduction
  const isCaptainSeduction = S._captain_seduction_active && 
                              S.season3 && 
                              selectedPerson && 
                              (selectedPerson.realName === (S.captain_name || 'Team Captain'));
  
  // Track encounter
  S.affair_count += 1;
  S.seduction_heat = clamp((S.seduction_heat || 0) + 6, 0, 100);
  
  // Award lobby tokens for seducing (unprotected sex - this function is only called after unprotected sex)
  addLobbyTokens(25, 'seducing (unprotected sex)');
  
  // Set captain seduction flag if this was a successful captain seduction
  if (isCaptainSeduction && S.season3) {
    S.season3.captain_seduced = true;
  }
  
  // World-flavoured sex flags – certain partners create longer threads
  try {
    ensureWorldState();
    const wf = getWorldFlags();
    const role = (selectedPerson && (selectedPerson.role || selectedPerson.title || '') || '').toLowerCase();
    const name = selectedPerson && selectedPerson.realName || 'Unknown';
    if (role.includes('secretary')){
      wf.sexWithSecretary = true;
      adjustRelationship('board', -1);
      adjustRelationship('media', +1);
      // Secretary affair fallout in a couple of matches
      scheduleWorldEvent('secretarySexFallout', 2 + Math.floor(Math.random()*3), {
        partnerName: name,
        role: selectedPerson.role || selectedPerson.title || 'Secretary'
      });
    }
  } catch(e){
    // Sex fallout is flavour-only – never break the main loop
  }
  
  // Add chairman points for having sex
  if (typeof addChairmanPointsImmediate === 'function') {
    addChairmanPointsImmediate(2, 'having sex');
  }
  
  // Schedule pregnancy and STD checks
  const pregBase = selectedPerson.femaleAttractiveness === "Highly Attractive" ? 0.40 : 
                   selectedPerson.femaleAttractiveness === "Moderately Attractive" ? 0.25 : 0.15;
  const stdBase = selectedPerson.femaleAttractiveness === "Highly Attractive" ? 0.25 : 
                  selectedPerson.femaleAttractiveness === "Moderately Attractive" ? 0.35 : 0.55;
  
  if (Math.random() < pregBase) {
    (S.pending_pregnancies = S.pending_pregnancies || []).push({
      partner_name: selectedPerson.realName,
      matches_until: 2
    });
    // Add chairman points for pregnancy
    if (typeof addChairmanPointsImmediate === 'function') {
      addChairmanPointsImmediate(15, 'pregnancy');
    }
  }
  
  if (Math.random() < stdBase) {
    (S.pending_female_std = S.pending_female_std || []).push({
      partner_name: selectedPerson.realName,
      matches_until: 2
    });
  }

  // Lightweight chance for an ongoing affair that can lead to blackmail
  try {
    ensureAffairState();
    if (Math.random() < 0.35) {
      const isPregnant = Math.random() < 0.25;
      const severity   = isPregnant ? 2 : 1;
      const currentWeek = S.matches_played | 0;
      const nextEvent  = currentWeek + 1 + Math.floor(Math.random() * 4); // 1–4 matches from now

      const affair = {
        id: 'affair_' + (S.affairIdCounter = (S.affairIdCounter || 0) + 1),
        name: selectedPerson.realName || "Mysterious Woman",
        role: selectedPerson.role || selectedPerson.title || "Unknown",
        isPregnant: !!isPregnant,
        blackmailActive: false,
        demandType: null,
        demandAmount: 0,
        nextEventWeek: nextEvent,
        hasGonePublic: false,
        severity: severity,
        resolved: false,
        paidOut: 0
      };

      activeAffairs.push(affair);
      // Fold into existing risk/compliance flavour without over-escalating
      if (typeof addPaper === 'function') {
        addPaper('Unwise personal liaison logged privately', 4);
      }
    }
  } catch (e) {
    // Fail silently – affairs are optional flavour, never critical path
  }

  // Schedule female blackmail attempt (separate from affair system)
  // Only for female partners (not male/captain)
  if (selectedPerson && selectedPerson.gender !== 'M' && !isCaptainSeduction) {
    if (Math.random() < 0.4) { // 40% chance of blackmail attempt
      (S.pending_female_blackmail = S.pending_female_blackmail || []).push({
        partner_name: selectedPerson.realName || "Unknown woman",
        matches_until: 1 + Math.floor(Math.random() * 2) // 1-2 matches later
      });
    }
  }
  
  // Trigger sex achievement
  if (window.socialManager && !window.socialManager.achievements.find(a => a.id === 'had_sex')) {
    const achievement = {
      id: 'had_sex',
      title: 'Had Sex',
      description: 'Had sex',
      icon: '💋'
    };
    window.socialManager.showAchievement(achievement);
    window.socialManager.achievements.push(achievement);
  }
}

// Captain seduction using nightclub mechanics
async function runCaptainSeductionViaNightclub() {
  const captainName = S.captain_name || 'Team Captain';
  
  // Captain seduction always succeeds - skip normal checks
  // Create captain person object (gender 'M' for male partner mechanics)
  const captainPerson = {
    realName: captainName,
    hiddenName: captainName,
    gender: 'M', // Use 'M' for male partner mechanics
    femaleAttractiveness: "Moderately Attractive" // Default for mechanics compatibility
  };
  
  // Store the revealed name (reuse nightclub structure)
  S.current_partner_name = captainPerson.realName;
  S.current_partner_gender = captainPerson.gender;
  S.current_partner_attractiveness = captainPerson.femaleAttractiveness;
  S.last_man_name = captainName;
  S.last_man_tier = 'male';
  
  log(`You move closer. ${captainName} looks vulnerable, conflicted.`);
  log(``);
  
  // Three-part quote array from nightclub seduction
  const quotes = [
    "That was incredible. You feel a deep connection.",
    "The passion was overwhelming. You both collapse in satisfaction.",
    "An intense, unforgettable experience. You feel alive.",
    "The chemistry was electric. You're both breathless.",
    "A night of pure ecstasy. You feel completely satisfied."
  ];
  log(pick(quotes));
  log(``);
  
  // Take or receive choice (consistent with nightclub)
  const role = await choose([
    { key: 'take', label: 'Take' },
    { key: 'receive', label: 'Receive' }
  ], 'What do you want to do?');
  
  // Protection choice (consistent with nightclub)
  const prot = await choose([
    { key: 'use', label: 'Use protection' },
    { key: 'no', label: 'Don\'t use protection', variant: 'warn' }
  ], 'Right before the act:');
  
  // Show floating animated text
  showFloatingSexOutcome('mmmmm');
  if (role === 'receive') {
    log('It felt incredible. You won\'t be able to walk straight for a few days.');
  } else {
    log('The encounter was intense and satisfying.');
  }
  
  // Handle very bad STD for male partners (receive + no protection)
  if (role === 'receive' && prot === 'no') {
    // Schedule very bad STD check for 2 matches later
    (S.pending_male_std = S.pending_male_std || []).push({
      partner_name: captainName,
      matches_until: 2
    });
  }
  
  // Check for very bad STD transmission to partner
  if (typeof maybeInfectPartnerWithVeryBadStd === 'function') {
    await maybeInfectPartnerWithVeryBadStd(captainName, 'male');
  }
  
  // Call handleSexConsequences to process the encounter
  await handleSexConsequences(captainPerson);
  
  return true;
}

// Public scandal + fallout when an affair goes public
async function triggerAffairScandal(affair) {
  ensureAffairState();
  if (!affair) return;

  affair.hasGonePublic = true;
  affair.blackmailActive = false;
  affair.resolved = true;
  affair.nextEventWeek = null;

  const severity = affair.severity || 1;

  // Morale / fans / board reaction – reuse existing fields
  S.morale       = clamp((S.morale || 0) - 3 * severity, -100, 100);
  S.fan_morale   = clamp((S.fan_morale || 50) - 5 * severity, 0, 100);
  S.board_support = clamp((S.board_support || 50) - 4 * severity, 0, 100);
  S.reputation   = clamp((S.reputation || 50) - 4 * severity, 0, 100);

  // Log terrace reaction
  const chantLines = [
    "Saints fans spend 90 minutes chanting “SEX PEST OUT” instead of backing the team.",
    "Home crowd serenades you with “HE’S NOT A REAL MAN” to the tune of “When the Saints Go Marching In”."
  ];
  log(pick(chantLines));

  if (typeof addPaper === 'function') {
    addPaper('Sex scandal splashed across the tabloids', 14 + severity * 2);
  }

  // Hook into lightweight world flags / media hostility
  try{
    ensureWorldState();
    const wf = getWorldFlags();
    setWorldFlag('mediaScandal', true);
    adjustRelationship('media', -1 * severity);
    adjustRelationship('board', -1 * severity);
  }catch(e){
    // Optional flavour only
  }

  // Queue a gossip story using existing press system
  try {
    if (typeof initPressSystem === 'function') initPressSystem();
    const story = (typeof generateGossipStory === 'function')
      ? generateGossipStory('affair', affair.name || 'Spurned lover')
      : null;
    if (story && typeof queueStory === 'function') {
      queueStory(story);
    }
  } catch (e) {
    // Press is nice-to-have only
  }

  // Delmor inevitably piles on
  try {
    await triggerDelmorUnderwearTroll(affair);
  } catch (e) {
    // If phone UI fails, at least log something
    log('📱 Delmor Krunchem is reportedly having a field day with your latest scandal.');
  }
}

// Delmor reaction: mocking phone messages + a tweet
async function triggerDelmorUnderwearTroll(affair) {
  // Standalone popup – do not use secretary history
  window.S = window.S || {};
  S.isSecretarySessionActive = false;
  const overlay = createPhoneTextPopup('Delmor Krunchem', 'Online');
  addMessageToPhonePopup('Saw the papers. Tremendous stuff.', false, 200);
  addMessageToPhonePopup('I’ve sent you something in the post. I hope these are in your size.', false, 900);
  addMessageToPhonePopup('*photo of women’s underwear attached*', false, 1600);

  const targetName = affair && affair.name ? affair.name : 'your latest tabloid friend';
  log(`📱 Delmor Krunchem: "Your little scandal with ${targetName} has absolutely made my week."`);
  log('Delmor Krunchem tweets a photo of women’s underwear with the caption: "Hope these fit x".');
}

// Start an affair-driven blackmail thread using the existing phone text UI
async function startBlackmail(affair) {
  ensureAffairState();
  if (!affair) return;

  const currentWeek = S.matches_played | 0;
  const clubCash    = S.club_cash || 0;
  const baseDemand  = Math.max(25000, Math.round(clubCash * 0.02 * (affair.severity || 1)));

  const isWeekly = affair.isPregnant
    ? Math.random() < 0.7
    : Math.random() < 0.3;

  affair.demandType   = isWeekly ? 'weekly' : 'one-off';
  affair.demandAmount = baseDemand;
  affair.blackmailActive = true;
  affair.nextEventWeek   = currentWeek + 1;

  const name = affair.name || "Unknown woman";
  const pregnantText = affair.isPregnant
    ? `“I'm late and I'm pretty sure it's yours. Unless you want me going to the press about what a disgusting perv you are, I want a regular stipend. You're going to pay for this. Literally.”`
    : `“I’ve still got the screenshots, darling. Unless you want the world hearing about your weird little habits, you’re going to send me a one-off payment.”`;

  // Blackmail thread is not the secretary – keep history separate
  window.S = window.S || {};
  S.isSecretarySessionActive = false;
  const overlay = createPhoneTextPopup(name, 'Unknown number');
  addMessageToPhonePopup(pregnantText, false, 200);

  const demandLabel = isWeekly
    ? `Agree to pay ${money(affair.demandAmount)} per match from club funds`
    : `Pay ${money(affair.demandAmount)} now from club funds`;

  const choice = await chooseInPhone(
    [
      { key: 'pay',    label: demandLabel, variant: 'warn' },
      { key: 'refuse', label: 'Refuse and gamble she won’t go public', variant: 'bad' }
    ],
    'Blackmail demand:'
  );

  if (choice === 'pay') {
    const amount = affair.demandAmount | 0;
    if ((S.club_cash || 0) >= amount) {
      S.club_cash = Math.max(0, (S.club_cash || 0) - amount);
      affair.paidOut = (affair.paidOut || 0) + amount;
      log(`💸 Hush payment of ${money(amount)} made from club funds.`);
      if (typeof addPaper === 'function') {
        addPaper('Club-funded hush payment to mistress', 10 + (affair.severity || 1) * 2);
      }
      if (!isWeekly) {
        affair.resolved = true;
        affair.blackmailActive = false;
        affair.nextEventWeek = null;
      } else {
        // Another demand in a match or two, unless she gets bored
        affair.nextEventWeek = currentWeek + 1 + Math.floor(Math.random() * 2);
      }
    } else {
      log(`💸 You try to stall, but you simply can’t raise ${money(amount)}. She laughs and walks straight to the tabloids.`);
      await triggerAffairScandal(affair);
    }
  } else if (choice === 'refuse') {
    log(`❌ You refuse to pay. She tells you she "knows a few tabloids who'll be VERY interested."`);
    await triggerAffairScandal(affair);
  }
}

// Continue weekly stipends or let them fizzle out
async function escalateBlackmail(affair) {
  ensureAffairState();
  if (!affair || affair.resolved || affair.hasGonePublic) return;

  const currentWeek = S.matches_played | 0;

  // Chance she gets bored and moves on after a few payments
  if ((affair.paidOut || 0) > affair.demandAmount * 3 && Math.random() < 0.25) {
    log(`${affair.name || 'She'} stops texting. For now, the blackmail seems to have fizzled out.`);
    affair.resolved = true;
    affair.blackmailActive = false;
    affair.nextEventWeek = null;
    return;
  }

  // Reuse the same demand each time for weekly stipends
  const name = affair.name || "Unknown woman";
  const msg = `“Reminder, sweetheart. Our little arrangement continues until I say otherwise. ${money(affair.demandAmount)} per match, or I go public.”`;
  // Reminder popup is also not the secretary
  window.S = window.S || {};
  S.isSecretarySessionActive = false;
  createPhoneTextPopup(name, 'Unknown number');
  addMessageToPhonePopup(msg, false, 200);

  const choice = await chooseInPhone(
    [
      { key: 'pay',    label: `Keep paying ${money(affair.demandAmount)} per match`, variant: 'warn' },
      { key: 'refuse', label: 'Cut her off and risk a scandal', variant: 'bad' }
    ],
    'Ongoing blackmail:'
  );

  if (choice === 'pay') {
    const amount = affair.demandAmount | 0;
    if ((S.club_cash || 0) >= amount) {
      S.club_cash = Math.max(0, (S.club_cash || 0) - amount);
      affair.paidOut = (affair.paidOut || 0) + amount;
      log(`💸 Continued hush payment of ${money(amount)} made from club funds.`);
      if (typeof addPaper === 'function') {
        addPaper('Ongoing hush stipend to mistress', 8 + (affair.severity || 1));
      }
      affair.nextEventWeek = currentWeek + 1 + Math.floor(Math.random() * 2);
    } else {
      log(`💸 The club’s skint. You can’t cover the stipend any more.`);
      await triggerAffairScandal(affair);
    }
  } else if (choice === 'refuse') {
    log(`❌ You tell her the gravy train is over. She replies with three laughing emojis and the words "front page".`);
    await triggerAffairScandal(affair);
  }
}

// Handle Brick throw (guaranteed arrest)
async function handleBrickThrow(selectedPerson) {
  const brickQuotes = [
    `You lob a brick at ${selectedPerson.realName}. Security swarms.`,
    `You throw your brick. Sirens in the distance.`,
    `A brick flies. Your night ends in cuffs.`
  ];
  
  log(pick(brickQuotes));
  
  // Check if this is the first time throwing a brick at the Portsmouth bus
  const targetName = selectedPerson.realName ? selectedPerson.realName.toLowerCase() : '';
  const isPortsmouthBus = targetName && targetName.includes('portsmouth') && targetName.includes('bus');
  
  if (isPortsmouthBus && !S.portsmouth_bus_brick_thrown) {
    // Mark that we've thrown the brick
    S.portsmouth_bus_brick_thrown = true;
    
    // Show news story about Shafty Rod Johnson as popup
    const newsHeadline = 'Shafty Rod Johnson Arrested After Obscene, Graphic Routine Mocking Portsmouth Bus Explosion';
    const newsBody = `SPECIAL REPORT — SOUTH COAST DERBY AFTERMATH

Stand-up comedian Shafty Rod Johnson was arrested late last night following a performance that police say crossed "every conceivable line of decency" in its treatment of the Portsmouth FC team bus explosion on the Itchen Bridge.

The routine, delivered less than 24 hours after the crash that killed everyone believed to be on board, has prompted widespread condemnation from football authorities, victims' advocates, and senior figures in the live-comedy industry.

According to witnesses, Johnson opened by framing the incident through the lens of the South Coast rivalry.

"South Coast derby's always fiery," he said. "Didn't expect Pompey to bring the cremation themselves."

The line drew scattered, nervous laughter before the room fell largely silent.

Johnson then referred directly to the location of the crash.

"Straight off the Itchen Bridge. No away support needed — they all travelled together."

Audience members say Johnson repeatedly returned to the imagery of the explosion. While newspapers are declining to reproduce the most extreme wording, police summaries confirm that Johnson made multiple graphic references to dismemberment, debris, and remains, at one point describing the river as "a floating kit list."

Another joke targeted emergency responders:

"Imagine being the bloke with the clipboard. 'Right… this leg's League One… this one's probably Championship.'"

Several people were heard audibly gasping.

Johnson also mocked the sporting consequences of the crash, saying:

"Under-12s tomorrow. Only Pompey team in years that still needs permission slips."

Boos became more pronounced as the routine progressed. Johnson responded aggressively.

"What? It's football. You lose players, you replace them. They're just… harder to gather."

The most controversial section came when Johnson turned to the families of the deceased players. Referring to Portsmouth's image as a community-focused club, he said:

"Big family club, aren't they? Well, congratulations — plenty of newly single mums in the fanbase tonight."

He followed this with a remark suggesting the widows would "land on their feet financially," adding:

"Grief passes. Payouts don't."

At this point, a significant number of audience members stood up and left.

Johnson closed the routine by circling back to the bridge itself.

"That bus went over the edge quicker than any bloke in this room would if he saw the compensation figures."

Immediately after delivering the line, Johnson performed his notorious finale. Police confirm that he exposed himself on stage and proceeded to complete an obscene sexual act in full view of the audience, framing it as the punchline to the preceding joke. Venue staff cut the microphone and summoned security within seconds.

Hampshire Police confirmed Johnson was arrested on suspicion of outraging public decency and public order offences.

"This was sustained mockery of a real mass-fatality event," a police spokesperson said. "It included sexualised remarks about bereaved individuals and a criminal act carried out publicly."`;

    if (typeof showNewsArticle === 'function' && typeof getNextWriter === 'function') {
      const story = {
        section: 'politics',
        headline: newsHeadline,
        writer: getNextWriter(),
        body: newsBody,
        effects: { reputation: -5 }
      };
      log('📰 A shocking story has broken in the news.');
      await showNewsArticle(story);
      
      // Apply effects
      if (story.effects.reputation) {
        S.reputation = clamp((S.reputation || 50) + story.effects.reputation, 0, 100);
      }
    }
  }
  
  // Trigger arrest loop
  await triggerArrest('threw_brick', selectedPerson.realName);
  
  // Don't consume brick unless global setting says consumable
  // (keeping it for future throws)
}

// Trigger arrest system
async function triggerArrest(reason, target) {
  // Use existing arrest system
  S.police_risk = Math.min(100, (S.police_risk || 0) + 20);
  S.reputation = clamp((S.reputation || 50) - 10, 0, 100);
  
  // Add to arrest log
  if (!S.arrest_log) S.arrest_log = [];
  S.arrest_log.push({
    reason: reason,
    target: target,
    week: S.matches_played || 0
  });
  
  log(`You've been arrested for ${reason}. Your reputation takes a hit.`);
}

async function drugUseChoice(){
  const k = await choose(
    [
      {key:'use',  label:'Take cocaine (stay up)'},
      {key:'sleep',label:'Go to sleep'}
    ],
    'Late night:'
  );
  if(k==='use'){
    S.drug_stash = Math.max(0,(S.drug_stash||0) - 1);
    S.drug_binge = (S.drug_binge||0) + 1;
    S.no_sleep   = (S.no_sleep||0) + 1;
    S.morale = clamp((S.morale||0) + 4, -100, 100);
    log('You indulge. Confidence surges, willpower feels high — for now.');
    // Escalating consequences with prolonged binges
    if(S.no_sleep>=3) log('<em>Exhaustion creeps in. Your judgement is slipping.</em>');
    if(S.no_sleep>=5){
      log('Intervention: you are forced into rehabilitation.');
      S.rehab = true;
      S.morale = clamp((S.morale||0) - 20, -100, 100);
      S.reputation = clamp((S.reputation||50) - 20, 0, 100);
      // Miss some time (abstracted). If you track fixtures strictly, you could skip N matches here.
      S.no_sleep = 0;
      S.drug_binge = 0;
    }
  } else {
    S.no_sleep = 0;
    S.drug_binge = 0;
    log('You sleep it off and feel reset in the morning.');
  }
}




