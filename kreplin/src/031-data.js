// ---------- data ----------
const DEFAULT_MATCHES=16;
const BASE_PLAYERS=[
 {name:"Cristiano Ronaldo",rating:90,price:20000000,wage:450000},
 {name:"Anton Colossus",rating:91,price:120000000,wage:550000},
 {name:"Victor Meteor",rating:89,price:95000000,wage:500000},
 {name:"Ivan Gravic",rating:84,price:18000000,wage:180000},
 {name:"Paulo Sieve",rating:81,price:12000000,wage:140000},
 {name:"Karim Zola",rating:79,price:9000000,wage:95000},
 {name:"Marin Petrov",rating:77,price:7500000,wage:60000},
 {name:"Luis Andrade",rating:83,price:15000000,wage:160000},
 {name:"Dante Morel",rating:75,price:5000000,wage:45000},
 {name:"Jamal King",rating:80,price:10000000,wage:120000},
 {name:"Santiago Ruiz",rating:82,price:13000000,wage:150000},
 {name:"Niall O’Keefe",rating:76,price:6000000,wage:55000},
 {name:"Lionel Messi",rating:92,price:25000000,wage:600000,hidden:true}
];


// Default quality (0..100). Southampton is set in init below; others here.


// ---------- Family & Domestic Life Data ----------

// Food data for dinner function
const FOOD_DATA = {
  courseA: [ // Proteins
    {name: "Roast chicken", taste: 8, class: 7, chaos: 2, calories: 300, flatulence: 1},
    {name: "Ribeye steak", taste: 9, class: 8, chaos: 3, calories: 400, flatulence: 2},
    {name: "Poached salmon", taste: 7, class: 9, chaos: 1, calories: 250, flatulence: 1},
    {name: "Garlic prawns", taste: 8, class: 6, chaos: 4, calories: 200, flatulence: 2},
    {name: "Falafel patties", taste: 6, class: 4, chaos: 5, calories: 180, flatulence: 8},
    {name: "Lamb kofta", taste: 7, class: 5, chaos: 6, calories: 320, flatulence: 3},
    {name: "Tofu katsu", taste: 5, class: 3, chaos: 7, calories: 220, flatulence: 6},
    {name: "Sausages", taste: 6, class: 2, chaos: 8, calories: 350, flatulence: 4},
    {name: "Meatballs", taste: 7, class: 4, chaos: 6, calories: 300, flatulence: 3},
    {name: "Tuna melt sliders", taste: 5, class: 2, chaos: 9, calories: 280, flatulence: 2},
    {name: "Egg frittata", taste: 6, class: 5, chaos: 4, calories: 200, flatulence: 3},
    {name: "Mystery meat", taste: 3, class: 1, chaos: 10, calories: 250, flatulence: 5},
    {name: "Quorn nuggets", taste: 4, class: 2, chaos: 8, calories: 180, flatulence: 7},
    {name: "Beans", taste: 5, class: 1, chaos: 9, calories: 150, flatulence: 10},
    {name: "Cheeseburger", taste: 7, class: 2, chaos: 8, calories: 500, flatulence: 4},
    {name: "Pizza", taste: 8, class: 3, chaos: 7, calories: 400, flatulence: 3},
    {name: "Gravy burger", taste: 6, class: 1, chaos: 9, calories: 600, flatulence: 5},
    {name: "Deep fried gravy", taste: 4, class: 1, chaos: 10, calories: 800, flatulence: 6},
    {name: "Deep fried butter", taste: 3, class: 1, chaos: 10, calories: 1000, flatulence: 7},
    {name: "Deep fried pizza", taste: 5, class: 1, chaos: 10, calories: 900, flatulence: 8},
    {name: "Triple bacon cheeseburger", taste: 8, class: 1, chaos: 9, calories: 1200, flatulence: 6},
    {name: "Deep fried Mars bar", taste: 6, class: 1, chaos: 10, calories: 800, flatulence: 4},
    {name: "Deep fried Oreos", taste: 5, class: 1, chaos: 10, calories: 600, flatulence: 3},
    {name: "Deep fried Twinkies", taste: 4, class: 1, chaos: 10, calories: 700, flatulence: 5},
    {name: "Deep fried ice cream", taste: 6, class: 2, chaos: 9, calories: 500, flatulence: 2},
    {name: "Deep fried pickles", taste: 5, class: 1, chaos: 8, calories: 300, flatulence: 3},
    {name: "Deep fried mac and cheese", taste: 6, class: 1, chaos: 9, calories: 800, flatulence: 7},
    {name: "Deep fried chicken skin", taste: 7, class: 1, chaos: 9, calories: 600, flatulence: 4},
    {name: "Deep fried lasagna", taste: 5, class: 1, chaos: 10, calories: 900, flatulence: 8},
    {name: "Deep fried bacon", taste: 8, class: 1, chaos: 9, calories: 800, flatulence: 5},
    {name: "Deep fried cheese curds", taste: 7, class: 1, chaos: 8, calories: 700, flatulence: 6},
    {name: "Deep fried hot dogs", taste: 6, class: 1, chaos: 9, calories: 600, flatulence: 4},
    {name: "Deep fried chicken wings", taste: 8, class: 2, chaos: 8, calories: 750, flatulence: 3},
    {name: "Deep fried mozzarella sticks", taste: 7, class: 1, chaos: 7, calories: 650, flatulence: 5},
    {name: "Deep fried jalapeño poppers", taste: 6, class: 1, chaos: 8, calories: 550, flatulence: 4},
    {name: "Deep fried onion rings", taste: 6, class: 1, chaos: 7, calories: 500, flatulence: 3},
    {name: "Deep fried fish and chips", taste: 7, class: 2, chaos: 8, calories: 900, flatulence: 4},
    {name: "Deep fried chicken nuggets", taste: 6, class: 1, chaos: 8, calories: 600, flatulence: 3},
    {name: "Deep fried calamari", taste: 7, class: 3, chaos: 7, calories: 550, flatulence: 2},
    {name: "Deep fried shrimp", taste: 7, class: 2, chaos: 7, calories: 500, flatulence: 2},
    {name: "Deep fried chicken tenders", taste: 7, class: 1, chaos: 8, calories: 650, flatulence: 3},
    {name: "Deep fried pork belly", taste: 8, class: 2, chaos: 9, calories: 850, flatulence: 5},
    {name: "Deep fried beef jerky", taste: 5, class: 1, chaos: 8, calories: 400, flatulence: 3}
  ],
  courseB: [ // Carbs/Sides
    {name: "Roasties", taste: 8, class: 6, chaos: 3, calories: 200, flatulence: 2},
    {name: "Buttered mash", taste: 7, class: 5, chaos: 2, calories: 180, flatulence: 1},
    {name: "Cheeseburger", taste: 7, class: 2, chaos: 8, calories: 500, flatulence: 4},
    {name: "Cheese", taste: 6, class: 4, chaos: 5, calories: 120, flatulence: 3},
    {name: "Curry", taste: 8, class: 6, chaos: 7, calories: 300, flatulence: 6},
    {name: "Beans", taste: 5, class: 1, chaos: 9, calories: 150, flatulence: 10},
    {name: "Extra gravy", taste: 6, class: 2, chaos: 8, calories: 100, flatulence: 2},
    {name: "Deep fried burger", taste: 5, class: 1, chaos: 10, calories: 700, flatulence: 6},
    {name: "Chips", taste: 6, class: 2, chaos: 6, calories: 300, flatulence: 3},
    {name: "Pilaf rice", taste: 7, class: 7, chaos: 2, calories: 200, flatulence: 1},
    {name: "Garlic bread", taste: 7, class: 4, chaos: 4, calories: 150, flatulence: 2},
    {name: "Noodles", taste: 6, class: 5, chaos: 3, calories: 180, flatulence: 2},
    {name: "Couscous", taste: 6, class: 6, chaos: 2, calories: 160, flatulence: 1},
    {name: "Cauliflower cheese", taste: 7, class: 5, chaos: 3, calories: 220, flatulence: 4},
    {name: "Yorkshire puds", taste: 8, class: 7, chaos: 2, calories: 120, flatulence: 1},
    {name: "Garden salad", taste: 5, class: 8, chaos: 1, calories: 50, flatulence: 0},
    {name: "Baked beans", taste: 5, class: 1, chaos: 9, calories: 150, flatulence: 10},
    {name: "Mac 'n' cheese", taste: 7, class: 3, chaos: 6, calories: 400, flatulence: 4},
    {name: "Pot Noodle", taste: 4, class: 1, chaos: 8, calories: 250, flatulence: 3},
    {name: "Crouton mountain", taste: 5, class: 2, chaos: 9, calories: 200, flatulence: 2},
    {name: "Deep fried french fries", taste: 7, class: 1, chaos: 8, calories: 400, flatulence: 3},
    {name: "Deep fried tater tots", taste: 6, class: 1, chaos: 7, calories: 350, flatulence: 3},
    {name: "Deep fried hash browns", taste: 6, class: 1, chaos: 7, calories: 300, flatulence: 2},
    {name: "Deep fried onion rings", taste: 6, class: 1, chaos: 7, calories: 500, flatulence: 3},
    {name: "Deep fried mozzarella sticks", taste: 7, class: 1, chaos: 7, calories: 650, flatulence: 5},
    {name: "Deep fried jalapeño poppers", taste: 6, class: 1, chaos: 8, calories: 550, flatulence: 4},
    {name: "Deep fried cheese curds", taste: 7, class: 1, chaos: 8, calories: 700, flatulence: 6},
    {name: "Deep fried pickles", taste: 5, class: 1, chaos: 8, calories: 300, flatulence: 3},
    {name: "Deep fried mushrooms", taste: 6, class: 1, chaos: 7, calories: 400, flatulence: 3},
    {name: "Deep fried zucchini", taste: 5, class: 1, chaos: 6, calories: 350, flatulence: 2},
    {name: "Deep fried cauliflower", taste: 5, class: 1, chaos: 6, calories: 300, flatulence: 2},
    {name: "Deep fried broccoli", taste: 4, class: 1, chaos: 6, calories: 250, flatulence: 2},
    {name: "Deep fried green beans", taste: 5, class: 1, chaos: 6, calories: 200, flatulence: 1},
    {name: "Deep fried okra", taste: 5, class: 1, chaos: 7, calories: 300, flatulence: 2}
  ],
  courseC: [ // Sauces/Extras
    {name: "Gravy", taste: 7, class: 4, chaos: 3, calories: 50, flatulence: 1},
    {name: "Peppercorn sauce", taste: 8, class: 7, chaos: 2, calories: 80, flatulence: 1},
    {name: "Hollandaise", taste: 8, class: 8, chaos: 1, calories: 120, flatulence: 0},
    {name: "Pesto", taste: 7, class: 6, chaos: 3, calories: 100, flatulence: 2},
    {name: "Sweet chilli", taste: 6, class: 4, chaos: 5, calories: 60, flatulence: 1},
    {name: "Curry sauce", taste: 7, class: 3, chaos: 6, calories: 80, flatulence: 3},
    {name: "Ketchup lake", taste: 5, class: 1, chaos: 9, calories: 100, flatulence: 1},
    {name: "Brown sauce haze", taste: 4, class: 1, chaos: 8, calories: 60, flatulence: 1},
    {name: "Mayo drizzle", taste: 6, class: 3, chaos: 5, calories: 120, flatulence: 1},
    {name: "Chimichurri", taste: 8, class: 7, chaos: 4, calories: 40, flatulence: 2},
    {name: "Mint jelly", taste: 6, class: 6, chaos: 2, calories: 30, flatulence: 0},
    {name: "Sriracha flood", taste: 7, class: 2, chaos: 8, calories: 20, flatulence: 1},
    {name: "Marmite glaze", taste: 3, class: 2, chaos: 7, calories: 20, flatulence: 1},
    {name: "Chocolate drizzle", taste: 6, class: 3, chaos: 6, calories: 80, flatulence: 1},
    {name: "Deep fried ranch dressing", taste: 5, class: 1, chaos: 8, calories: 200, flatulence: 2},
    {name: "Deep fried blue cheese", taste: 6, class: 1, chaos: 7, calories: 180, flatulence: 3},
    {name: "Deep fried thousand island", taste: 5, class: 1, chaos: 7, calories: 150, flatulence: 2},
    {name: "Deep fried honey mustard", taste: 6, class: 1, chaos: 6, calories: 120, flatulence: 1},
    {name: "Deep fried BBQ sauce", taste: 7, class: 1, chaos: 7, calories: 100, flatulence: 1},
    {name: "Deep fried buffalo sauce", taste: 7, class: 1, chaos: 8, calories: 80, flatulence: 1},
    {name: "Deep fried tartar sauce", taste: 5, class: 1, chaos: 6, calories: 160, flatulence: 2},
    {name: "Deep fried aioli", taste: 6, class: 2, chaos: 6, calories: 140, flatulence: 1},
    {name: "Deep fried garlic butter", taste: 7, class: 1, chaos: 7, calories: 200, flatulence: 2},
    {name: "Deep fried cheese sauce", taste: 7, class: 1, chaos: 8, calories: 180, flatulence: 3},
    {name: "Deep fried nacho cheese", taste: 6, class: 1, chaos: 8, calories: 160, flatulence: 2},
    {name: "Deep fried queso dip", taste: 7, class: 1, chaos: 7, calories: 140, flatulence: 2},
    {name: "Deep fried sour cream", taste: 5, class: 1, chaos: 6, calories: 120, flatulence: 1},
    {name: "Deep fried guacamole", taste: 6, class: 2, chaos: 6, calories: 100, flatulence: 1}
  ],
  drinks: [ // Optional drinks
    {name: "Sparkling water", taste: 4, class: 6, chaos: 1, calories: 0, flatulence: 0},
    {name: "Cheap lager", taste: 5, class: 2, chaos: 6, calories: 150, flatulence: 2},
    {name: "Nice Malbec", taste: 8, class: 8, chaos: 2, calories: 120, flatulence: 1},
    {name: "Flat cola", taste: 4, class: 1, chaos: 5, calories: 140, flatulence: 1},
    {name: "Isotonic for athletes", taste: 3, class: 4, chaos: 4, calories: 20, flatulence: 0},
    {name: "Tea in football mug", taste: 6, class: 3, chaos: 3, calories: 5, flatulence: 0},
    {name: "Carton orange", taste: 5, class: 2, chaos: 4, calories: 100, flatulence: 1},
    {name: "Sommelier's nightmare blend", taste: 2, class: 1, chaos: 10, calories: 200, flatulence: 3},
    {name: "Deep fried milkshake", taste: 6, class: 1, chaos: 9, calories: 800, flatulence: 2},
    {name: "Deep fried energy drink", taste: 4, class: 1, chaos: 8, calories: 300, flatulence: 1},
    {name: "Deep fried coffee", taste: 5, class: 1, chaos: 7, calories: 200, flatulence: 1},
    {name: "Deep fried hot chocolate", taste: 6, class: 2, chaos: 8, calories: 400, flatulence: 1},
    {name: "Deep fried smoothie", taste: 5, class: 1, chaos: 7, calories: 350, flatulence: 1},
    {name: "Deep fried protein shake", taste: 4, class: 1, chaos: 6, calories: 250, flatulence: 1},
    {name: "Deep fried fruit juice", taste: 5, class: 1, chaos: 6, calories: 200, flatulence: 1},
    {name: "Deep fried sports drink", taste: 4, class: 1, chaos: 5, calories: 150, flatulence: 0},
    {name: "Deep fried iced tea", taste: 4, class: 1, chaos: 5, calories: 100, flatulence: 0},
    {name: "Deep fried lemonade", taste: 5, class: 1, chaos: 6, calories: 180, flatulence: 1},
    {name: "Deep fried root beer", taste: 5, class: 1, chaos: 6, calories: 160, flatulence: 1},
    {name: "Deep fried ginger ale", taste: 4, class: 1, chaos: 5, calories: 140, flatulence: 1},
    {name: "Deep fried cream soda", taste: 5, class: 1, chaos: 6, calories: 200, flatulence: 1},
    {name: "Deep fried orange soda", taste: 4, class: 1, chaos: 5, calories: 180, flatulence: 1}
  ]
};

// Dialogue banks for conversation system
const DIALOGUE_BANKS = {
  affectionate: {
    setups: [
      "You made the day easier—", "I don't say it enough—", "You were brilliant today—",
      "There's something I want you to know—", "You keep us together—", "I noticed what you did—",
      "I'm proud of you—", "You're the calm in all this—", "Thanks for being here—",
      "You did that quietly and well—", "I love how you showed up—", "You stepped up and I saw it—",
      "You gave me a break today—", "You handled that perfectly—", "You were the steady hand—",
      "You saved us the trouble—", "I appreciate the little things—", "You made tonight feel normal—",
      "You carried that so well—", "I'm really grateful for you—"
    ],
    pivots: [
      "—with the kids at school pick-up.", "—on the sponsor call earlier.", "—when the press got nosy.",
      "—handling the board meeting.", "—making dinner when I forgot.", "—the way you calmed the kids.",
      "—sorting the house after the match.", "—covering for me with the agents.", "—taking the late phone call.",
      "—stepping in for the fundraiser.", "—keeping the household sane today.", "—your patience with the neighbours.",
      "—dealing with school admin.", "—smoothing things with the coach.", "—fixing the plumbing in the morning.",
      "—the way you handled our schedule.", "—making time for the kids.", "—the way you listened to me.",
      "—giving the kids a proper evening.", "—making sure we were okay tonight."
    ],
    signoffs: [
      "Thank you.", "I love you.", "You matter.", "Let me make it up to you.",
      "We're in this together.", "You deserve a night off.", "I'll take the kids tomorrow.",
      "I appreciate you.", "That meant a lot.", "Big hug later?", "You're the best.", "I noticed — thanks."
    ]
  },
  deranged: {
    setups: [
      "THIS FUCKING FOOD ISN'T FUCKING COOKED—", "ARE YOU FUCKING INSANE—", "WHICH FUCKING ONE OF YOU LET THIS HAPPEN—",
      "This is a FUCKING disgrace—", "I am FUCKING livid—", "Outrageous! FUCKING OUTRAGEOUS",
      "This is FUCKING beyond terrible—", "What on FUCKING earth was that—", "This is FUCKING utterly unacceptable—",
      "I'm FUCKING furious about this—", "Are we FUCKING joking here—", "This is a FUCKING catastrophe—",
      "I'm at the end of my FUCKING tether—", "How did we get to this—", "This is a farce—",
      "What a spectacular mess—", "Someone explain this nonsense—", "This is a calamity—"
    ],
    pivots: [
      "—ITS NOT FUCKING COOKED.", "—YOU STUPID BITCH.", "—I HATE YOU.", "—YOU STUPID WOMAN.",
      "—we lost due to a baffling mistake.", "—the board let us down.", "—that decision was clueless.",
      "—the installer made a mess.", "—the press twisted it into nonsense.", "—the sponsor pulled a stunt.",
      "—the logistics collapsed tonight.", "—no one showed basic competence.", "—the shop sold the wrong kits.",
      "—the supplier lied to us.", "—there was no plan at all.", "—someone dropped the ball badly.",
      "—we were left to pick up the pieces.", "—this is amateur hour."
    ],
    signoffs: [
      "Fix it now.", "This stops here.", "I want answers.", "Unacceptable.", "Sort it.",
      "We'll not stand for this.", "I expect better.", "This can't continue.", "Someone will pay.",
      "I'm not done.", "Make it right.", "Not on my watch."
    ]
  },
  disgust: {
    // Visceral, nose-wrinkling disgust – can be used by manager, captain, spouse, or press
    setups: [
      "That turned my stomach—", "This absolutely reeks—", "I can taste the shame in the air—",
      "The stench from that—", "My skin is crawling—", "This is filthy football—",
      "I feel dirty watching this—", "That was rancid—", "You’ve dragged us through the gutter—",
      "I need a shower just thinking about it—", "This leaves a bad taste—", "That performance was sewage—"
    ],
    pivots: [
      "—from the way you carried yourself.", "—from the lack of effort out there.", "—from the cheap fouls and rolling around.",
      "—from the gambling whispers around the dressing room.", "—from how you spoke to the staff.", "—from the booze on your breath.",
      "—from the way the captain celebrated that shambles.", "—from the boardroom politics dripping into the tunnel.",
      "—from the cameras catching every grubby angle.", "—from how our badge was dragged through the mud.",
      "—from the captain’s little side-hustles.", "—from seeing kids in the stands watch that circus."
    ],
    signoffs: [
      "I’m ashamed to be associated with it.", "Wash this club clean.", "I don’t want the kids seeing that again.",
      "We’re better than this filth.", "That will stick to our name for years.", "Scrub it from the footage.",
      "Some things you can’t spin away.", "Even the sewer rats would turn up their noses.", "Don’t ever serve that up again.",
      "I feel sick thinking about it."
    ]
  },
  politics: {
    setups: [
      "All this woke shite—", "You can't turn on the fucking telly—", "All this LGBT shite, always a new letter, what will the next one be?",
      "They're debating everything now—", "This is a British country—", "All this laws these days—",
      "Bloody immigrants —", "More fucking MSM lies —", "The country's gone to the fucking dogs —",
      "I am from the school of old knocks, a long forgotten institution—", "Politicians these days are all pedos —",
      "I am sick of mentally unwell students—", "You can't say anything these days —", "Everything is offensive these days—",
      "These fucking blue haired freaks—", "It's all about being outraged—", "The noise never stops—", "It's a new kind of theatre—"
    ],
    pivots: [
      "—you can't call a spade a spade.", "—and it's not about their race either.", "—human rights this, human bloody rights that.",
      "—and the white man is always to blame!", "—I don't care where you put your willy! Just keep it out of schools!",
      "—And we're expected to just let it happen!", "—this is no longer a British country!.", "—I am one of the few remaining people who says it like it is!",
      "—Love Thy Neighbor – proper British comedy!", "—they could never make Little Britain these days! Only gay in the village! Loved that quote! And he's gay in real life you know! He can make fun of himself!",
      "—all this bloody gangster rap music! Talking about pimps and bitches!", "—debate used to be civil.", "—the echo chambers are loud.",
      "—and if you're not bloody transgender they want to kill you!", "—this is an English household!", "—I'll never bend the knee!",
      "—all these fat parents with their fat kids!", "—the politicians are bought off by shadowy entities!", "-being a red blooded male these days is illegal!",
      "-and it's now a  'crime' to be horny and appreciate a lovely, luscious woman!", "I want to be able to ogle women in public and not be accused of murder!"
    ],
    signoffs: [
      "This is a British country!", "And this has got nothing to do with race!", "And we're expected to hear all about gay sex!",
      "Notice how you never see a white man on the telly!", "This is no longer a British country!", "All this woke shite! Greta Thunberg on her bloody high horse!",
      "Tommy's got the right idea!", "Ever noticed that?", "Human rights my arse! British rights!",
      "They want to lock us up for the crime of being men!", "Many minorities and woman actually agree with me!", "Some of my best friends are women!",
      "Some of my best friends are transgender!"
    ]
  },
  money: {
    setups: [
      "Budget note—", "We need to talk costs—", "CFO flagged this—", "There's a spend decision—",
      "We could invest in—", "There's an unexpected bill—", "We can cut or keep—", "Sponsor wants numbers—",
      "Accounts need closing—", "Funding update—", "We might sell assets—", "We can run a fundraiser—",
      "School fees due soon—", "We could underwrite this event—", "Payroll needs a review—", "We have a donor meeting—",
      "There's a cash shortfall—", "We could front the scholarship—", "We can restructure debt—", "We have a sponsorship offer—"
    ],
    pivots: [
      "—the private school invoice arrives next week.", "—stadium repairs need funding.", "—the sponsor wants exclusivity.",
      "—a donor offered naming rights.", "—ticket revenue is down.", "—merch sales lagged this month.",
      "—we could sell a minor asset.", "—wage negotiations start next month.", "—we can fund the kids' fees this season.",
      "—the fundraiser has mixed returns.", "—insurance costs jumped.", "—the accountant recommends reserves.",
      "—we can invest in the academy.", "—tax rebate expected soon.", "—we have a sponsor contingency.",
      "—we'll need to prioritise payments.", "—we have a fine to pay.", "—we can offer a scholarship.",
      "—we should cap the discretionary spend.", "—we can present options to the board."
    ],
    signoffs: [
      "Let's budget it in.", "I'll sign off.", "Put it to a vote.", "We'll find the money.",
      "I'll speak to the CFO.", "We'll be cautious.", "We'll fund it this season.", "I'll approve up to X.",
      "We'll table it.", "Consider it handled.", "We'll prioritize school fees.", "We'll revisit next week."
    ]
  },
  football: {
    setups: [
      "Matchday thought—", "Gaffer's tension—", "Tactics niggle—", "The ref's decisions—",
      "We looked off on set pieces—", "The youngsters impressed—", "We need a plan—", "Bench morale's low—",
      "Injuries concern me—", "Opposition's threat—", "We must protect the kid—", "Penalty practice —",
      "The captain needs a talk—", "We've got the cup coming—", "Fixture congestion—", "Our finishing was poor—",
      "We need clinical players—", "The analytic flagged problems—", "We should back the manager—", "Pre-match spin —"
    ],
    pivots: [
      "—the manager's system is risky.", "—we conceded soft goals.", "—the goalkeeper was shaky.",
      "—we need to rotate.", "—bring academy lads through.", "—we'll practice finishing.",
      "—the derby is a red button.", "—the ref will be under pressure.", "—we have an away trip that's brutal.",
      "—the opposition target our flank.", "—we'll rest the striker.", "—we'll shore up the midfield.",
      "—we'll call a meeting.", "—we'll send a pep talk.", "—we'll set a defensive drill.",
      "—we'll change the formation.", "—we'll address discipline.", "—we'll plan the set piece.",
      "—we need to manage the press.", "—we'll protect the youngster from hype."
    ],
    signoffs: [
      "I'll back the coach.", "We'll make that change.", "We'll brief the lads.", "I'll fund extra sessions.",
      "We'll keep faith.", "I'll speak to the captain.", "We'll monitor performance.", "We'll prepare for the derby.",
      "I'll call a meeting.", "We'll support the youth.", "We'll try that plan.", "We'll set objectives."
    ]
  },
  kids: {
    setups: [
      "How was school today?", "What did you learn?", "Did you have fun?", "Tell me the best part—",
      "Who did you sit with?", "Did you score today?", "What made you laugh?", "Do you need help with homework?",
      "What's your favourite game?", "Any tests this week?", "Did you make something?", "Who did you play with?",
      "What's for show-and-tell?", "What book are you reading?", "Did you help anyone?", "Do you want to show us something?",
      "Who's your team at school?", "Want to help me cook?", "Which match do you want to go to?", "Do you want a little surprise?"
    ],
    pivots: [
      "—we'll go to your game Saturday.", "—I'll help with that project.", "—we'll buy new boots.",
      "—we'll make you your favourite.", "—let's practice together.", "—we'll watch training.",
      "—we'll celebrate your effort.", "—I'll pick you up early.", "—we'll make a banner.",
      "—we'll read that book.", "—we'll have ice cream.", "—we'll try a new club.",
      "—we'll build the kite.", "—we'll fix the toy.", "—we'll tell your teacher.",
      "—we'll invite a friend.", "—we'll do a scavenger hunt.", "—we'll do a science project.",
      "—we'll film your match highlights.", "—we'll take photos for the album."
    ],
    signoffs: [
      "Big hug.", "Well done.", "Proud of you.", "See you at training.", "Let's celebrate.",
      "High-five.", "We'll watch the replay.", "Sleep tight.", "You're brilliant.",
      "Practice tomorrow?", "I'll be there.", "Love you."
    ]
  },
  gossip: {
    setups: [
      "Have you heard—", "Rumour has it—", "Someone said—", "A little bird told me—",
      "There's chatter about—", "The papers hinted—", "Whispers at the club—", "Someone leaked—",
      "You won't believe this—", "There's talk that—", "The dressing room's buzzing—", "Someone's whispering—",
      "I heard from a mate—", "The columnists are circling—", "Word is—", "People are saying—",
      "The agent mentioned—", "A staffer hinted—", "Fans are circling this—", "There's a bit of scandal around—"
    ],
    pivots: [
      "—someone's eyeing the striker.", "—a board member is upset.", "—a sponsor might pull out.",
      "—a player's family is unhappy.", "—an old story resurfaced.", "—someone sold a story.",
      "—a recording leaked.", "—an agent is stirring trouble.", "—a rival planted a rumour.",
      "—the columnists pounced.", "—the local rag smells blood.", "—a minor spat went public.",
      "—emails leaked online.", "—a staffer spat escalated.", "—a sponsor is worried.",
      "—the press want exclusives.", "—someone's behaving oddly.", "—a story is gaining traction.",
      "—the fans are talking.", "—it's a trending topic."
    ],
    signoffs: [
      "Keep it quiet.", "Don't repeat it.", "We'll handle it.", "We'll look into it.",
      "Not for public consumption.", "Lock it down.", "We'll nip it in the bud.", "I'll speak to PR.",
      "Deal with it internally.", "We'll spin this.", "We'll be discreet.", "Let's not feed the press."
    ]
  }
  ,
  // Chairman League: press-specific banks
  praise: {
    setups: [
      "Look, credit where it's due—", "I'll say something nice for once—", "Fair play to them—",
      "No media spin here—", "Let's be honest—", "Respect where it's earned—"
    ],
    pivots: [
      "—they've built a solid squad.", "—their recruitment was sharp this window.", "—they run a tight operation.",
      "—their academy setup is impressive.", "—they handled pressure well.", "—their manager's done a proper job."
    ],
    signoffs: [
      "We'll see them at the top.", "No shame in admitting it.", "We'll match them, don't worry.",
      "Good competition keeps us sharp.", "Rivalry with respect suits the league.", "We raise our level to meet theirs."
    ]
  },
  defame: {
    setups: [
      "People don't know the half of it—", "Behind closed doors it's a mess—", "They won't talk about this—",
      "Let me lift the curtain—", "If only the fans knew—", "I'll say what others won't—"
    ],
    pivots: [
      "—their books don't add up.", "—agents basically run that club.", "—players there are miserable.",
      "—promises get broken every week.", "—the staff turnover is a red flag.", "—compliance is an afterthought."
    ],
    signoffs: [
      "It'll come out soon enough.", "Do your digging.", "Not my circus, not my clowns.",
      "We keep it clean here.", "Their day of reckoning comes.", "Fans deserve transparency."
    ]
  },
  suspicious: {
    setups: [
      "Something doesn't smell right—", "Odd pattern with the officials—", "Timing seems convenient—",
      "A lot of smoke lately—", "Bit too friendly with certain agents—", "Strange withdrawals around deadline—"
    ],
    pivots: [
      "—the decisions go one way.", "—contracts get sorted overnight.", "—leaks favor them every time.",
      "—their press always soft-balls.", "—numbers move then vanish.", "—the league keeps looking the other way."
    ],
    signoffs: [
      "I'm just asking questions.", "We keep receipts.", "Fans can connect the dots.",
      "We'll let auditors talk.", "Sunlight's the best disinfectant.", "Patterns tell a story."
    ]
  },
  conspiracy: {
    setups: [
      "You think it's random?—", "Follow the money—", "The puppeteers are obvious—",
      "It's coordinated—", "The script was written months ago—", "They want you docile—"
    ],
    pivots: [
      "—media, agents, league in lockstep.", "—fixtures tailored to their run-in.", "—ref appointments say it all.",
      "—broadcast partners pick the champions.", "—certain clubs never face sanctions.", "—it's a theatre for the wealthy."
    ],
    signoffs: [
      "Wake up.", "Not everyone is blind.", "We won't play along.",
      "They hate a loud truth.", "Enjoy the show.", "Masks slip eventually."
    ]
  },
  personal_insult: {
    setups: [
      "He struts like a peacock—", "That bloke's a parody—", "He's all veneers and veneers—",
      "Copy-paste charisma—", "Boardroom TikTok merchant—", "Budget Bond villain—"
    ],
    pivots: [
      "—talks big, hides small.", "—couldn't run a tuck shop.", "—burns bridges then blames the river.",
      "—thinks PR is winning.", "—confuses noise with leadership.", "—needs a manual for decency."
    ],
    signoffs: [
      "Football exposes you.", "We prefer substance.", "He'll tweet about this, obviously.",
      "Rent free.", "See you on the pitch.", "He'll spin it by morning."
    ]
  },
  defiant: {
    // For responses like: I did it — so what? — and I'd do it again!
    setups: [
      "I did it—", "I said it—", "I made that call—", "I took that risk—", "I chose that path—", "I owned it—"
    ],
    pivots: [
      "—so what?", "—and?", "—because someone had to.", "—that's leadership.", "—I'd say it twice.", "—cry about it."
    ],
    signoffs: [
      "I'd do it again.", "I'd double it.", "I'd do it tomorrow.", "That's how you win.", "That's football.", "Stand by it."
    ]
  },
  cynical: {
    setups: [
      "Look, it's simple economics—", "The numbers don't lie—", "Business is business—",
      "At the end of the day—", "Let's be pragmatic—", "This is just good sense—"
    ],
    pivots: [
      "—one less competitor means more market share for us.", "—fewer teams means bigger slice of the pie.", "—less competition is always better for business.",
      "—they were dragging the league down anyway.", "—we're just streamlining the competition.", "—survival of the fittest, innit?"
    ],
    signoffs: [
      "That's capitalism.", "It's a dog-eat-dog world.", "Someone had to do it.",
      "The league's better off.", "We're just being efficient.", "That's how you stay ahead."
    ]
  },
  heartfelt: {
    setups: [
      "This weighs heavily on me—", "I never wanted it to come to this—", "My heart breaks—",
      "I'm deeply troubled—", "This is a dark day—", "I carry this burden—"
    ],
    pivots: [
      "—but sometimes extreme measures are necessary.", "—yet the greater good demanded action.", "—though the consequences were unavoidable.",
      "—but we must protect what matters.", "—yet history will judge us harshly.", "—though I pray for forgiveness."
    ],
    signoffs: [
      "May God have mercy on us all.", "I will carry this forever.", "The weight of leadership is heavy.",
      "I hope they understand one day.", "This was never about winning.", "I pray for their souls."
    ]
  },
  humorous: {
    setups: [
      "Well, that escalated quickly—", "You know what they say—", "Bit of an overreaction, maybe—",
      "Talk about going nuclear—", "Well, that's one way to solve it—", "I may have gone slightly overboard—"
    ],
    pivots: [
      "—but at least we won't have to play them away next season.", "—though I hear property prices just dropped there.", "—but hey, no more fixture congestion!",
      "—though I probably should've just sent a strongly worded letter.", "—but at least the away fans won't complain about the journey.", "—though I'm told the mushroom cloud was quite picturesque."
    ],
    signoffs: [
      "Whoops!", "My bad!", "That'll teach 'em!",
      "Probably should've read the manual first.", "At least it's memorable!", "Well, that's one for the history books."
    ]
  },
  lecherous: {
    setups: [
      "Oh, you're absolutely stunning—", "My god, you're gorgeous—", "I can't help but notice—",
      "You're breathtaking—", "I'm completely distracted by—", "Those eyes, that smile—"
    ],
    pivots: [
      "—how about we discuss this over dinner?", "—I'd love to show you my trophy room.", "—you should come see my private box.",
      "—I have a very comfortable office.", "—let's talk about this somewhere more... private.", "—I know a great place for drinks."
    ],
    signoffs: [
      "Call me.", "I'll send my driver.", "What's your number?",
      "Let's make this more personal.", "I'd love to get to know you better.", "You're too beautiful for this job."
    ]
  }
};

// Dialogue banks for GAZ (Geordie dialect with phonetic inconsistency)
const GAZ_DIALOGUE = [
  "Aye, I'm Gazza, hinny. I want first team, like. I'm still class, me, man.",
  "First team, like I said, pet. You won't regret it, hinny. Canny decision, that.",
  "Right, boss, hinny. Message delivered, like. Canny job, that.",
  "Waste of time, this is, man. Should've known better, like.",
  "Aye, I'm still class, me, hinny. Still got it, pet.",
  "Gan on, man. Give us a chance, hinny. You'll see, like.",
  "I'm still proper class, like, pet. You'll see, hinny.",
  "Right, boss, hinny. I'll sort it, like. No bother, man.",
  "Aye, no bother, pet. I'll get it done, hinny. Canny easy, that.",
  "Still got the touch, me, man. Still class, hinny.",
  "Gan on, give us first team, pet. I'll show ye, like. Canny player, me.",
  "Right, I'll do it, hinny. No worries, pet. Sorted, like.",
  "Aye, I'm still class, man. Still got it in us, hinny.",
  "Gan on, man. I'll prove it to ye, pet. You'll see, like.",
  "Right, boss, hinny. I'll handle it, like. Canny easy, that.",
  "Still class, me, man. Still got the magic, hinny.",
  "Aye, no problem, pet. I'll sort it out, like. No bother, hinny.",
  "Gan on, give us a go, man. I'll show ye what I can do, hinny. Canny player, me.",
  "Right, I'll get it sorted, pet. No bother, hinny. Sorted, like.",
  "Aye, I'm still class, hinny. You'll see, pet. Canny, that."
];

// Dialogue banks for SECRETARY (Polyamory jargon - insufferable corporate-therapy language)
const SECRETARY_DIALOGUE = [
  "Chairman, I need to be honest with you. I'm polyamorous.",
  "I don't believe in monogamy as a structural framework for emotional fulfillment.",
  "I'm proposing we explore a non-hierarchical relationship structure.",
  "You, me, and your son. Together.",
  "I use words like 'compersion' and 'ethical non-monogamy.'",
  "Wonderful. I think this will be transformative for all of us.",
  "I understand. The offer stands if you change your mind.",
  "We need to establish clear boundaries and communication protocols.",
  "I'm experiencing compersion thinking about your other connections.",
  "Let's co-create a relationship structure that honors all parties' needs.",
  "I'm proposing we move toward a more fluid, non-possessive dynamic.",
  "We should schedule regular check-ins to ensure everyone's needs are being met.",
  "I'm feeling a lot of compersion about this arrangement.",
  "Let's establish some relationship agreements that work for everyone.",
  "I'm interested in exploring a polyamorous relationship structure with you.",
  "We need to have an open dialogue about our emotional availability.",
  "I'm proposing we deconstruct traditional relationship hierarchies.",
  "Let's create a container where all relationships can flourish equally.",
  "I'm experiencing a lot of compersion thinking about your other partners.",
  "We should establish some relationship agreements and boundaries.",
  "I'm interested in exploring ethical non-monogamy with you.",
  "Let's co-create a relationship structure that works for everyone involved.",
  "I'm feeling a lot of compersion about your other connections.",
  "We need to have regular check-ins to ensure everyone's needs are being met.",
  "I'm proposing we move toward a more fluid, non-possessive relationship dynamic.",
  "Let's establish some relationship agreements that honor all parties' needs.",
  "I'm experiencing compersion thinking about this arrangement.",
  "We should create a container where all relationships can flourish equally.",
  "I'm interested in exploring a non-hierarchical relationship structure.",
  "Let's deconstruct traditional relationship hierarchies together."
];

// ---------- state ----------
function defaultState(){return{
player_firstname:"",
player_surname:"",
full_name:"",
 club_name:"Southampton FC", rival_name:"Portsmouth FC",
 chairman_cash:1000000, club_cash:12000000, club_debt:0, offbooks:0,
 morale:0, reputation:50, compliance_risk:0, legal_risk:0,
 bankrupt:false, depressed:false, prison:false,
 messi_signed:false, ronaldo_signed:false,
 secretary:"", secretary_hired:false, secretary_name:"",
secretary_style:"",    // "young" or "experienced",
secretary_event_triggered:false,
 secretary_romance_possible:false, secretary_dated:false, proposed:false,
 // New secretary messaging system state
 secRel:0, secTrust:0, secRisk:0,  // 0-100 scales
 secMessageCounts:{professional:0, social:0, football:0, ellipses:0, flirtatious:0, erotic:0},
 lastEroticTs:0, lastAttachmentType:"",
 // Thread state for secretary texting and boundary tracking
 secThreadActive:false, secThreadStep:0, secBoundaryStrikesThread:0, secBoundaryWindowGames:0,
 // Session counters: secQuickSessionCount only gates quick one‑liners. Three‑part builders are unlimited.
 secSessionMessageCount:0,  // Legacy counter (still used by some generic flows)
 secQuickSessionCount:0,    // Per‑session quick‑text limit with secretary
 // KRAZY register state
 onKrazyRegister:false, krazyGamesRemaining:0,
 // Gates: Flirtatious allowed if secRel >= 40 and secTrust >= 30
 // Erotic allowed if secRel >= 70 AND secTrust >= 60 AND last 3 messages were not erotic
 messi_goalie_resolved:false, messi_goalie_next_loss:false,
 pompey_cl_win:false, block_cl_win:false,
 opponents:[], fixtures_generated:false,
 season_matches:DEFAULT_MATCHES, matches_played:0, wins:0, draws:0, losses:0, points:0,
 points_deducted:0, transfer_embargo:false, windows_opened:0,
 manager_id:1, manager_fires:0, fired_last_game:false,
 squad:[], unpaid_transfers:[],
 accepted_bribe:false, refused_bribe_went_public:false,
 board_support:50, fa_strictness:1,
 fa_cooldown:0, board_cooldown:0, board_seen_once:false,
 discipline_step:0, paperTrail:[], paperRisk:0,
pending_births:[],        // queue of pregnancies awaiting birth
baby_care_weekly:0,       // ongoing weekly expense for special care babies
marco_dealing:false,
marco_deal_offered:false,
marco_deal_count:0,
married:true, divorces:0,
wife_love:60, wife_respect:55,
child1_love:50, child1_respect:50,
child2_love:50, child2_respect:50,
marco_met:false,
drug_stash:0, drug_binge:0, no_sleep:0, rehab:false,
seduction_heat:0, seduction_done:false,
affair_count:0, hush_money_paid:0,
std_state:"none", // "none" | "treated" | "untreated"
std_treatment_attempts:0,
std_last_treatment_match:-1,
pregnancies:0,
wife_name:"",
child1_name:"",
child2_name:"",
wives_count:1,
kids_count:2,
estranged_kids:0,
last_girl_name:"",
last_girl_tier:"",
wife_addiction:0,          // 0..100
wife_addicted:false,
wife_std:false,
debt_personal:0,
debt_club:0,
press_threats:0,
transfer_market: [],
transfer_flags: { seasonOpened:false, midOpened:false },
mental_health_excuse_used: false,
unpaid_transfer_agents: {},
police_risk: 0,
visited_ownLocker: false,
visited_oppLocker: false,
spoke_to_team_this_prematch: false,
bet_locked_this_prematch: false,
inventory: { accolades: [], drugs: 0, items: [] },  // for rummage results
opponent_strength: 75,                   // baseline; you can vary per fixture
lineup: [],                              // exactly 5 players selected to play

bribes_count: 0,
active_bet: null,
bet_history: [],
morale_opponent: 70,
very_bad_std_state: "none",
very_bad_std_matches: 0,
very_bad_std_treatment_attempts: 0,
very_bad_std_last_treatment_match: -1,
 pending_female_std: [],
 pending_male_std: [],
 pending_male_blackmail: [],
 pending_partner_death: [],
 pending_blackmail_scandal: [],
 seededTrophies: false,
 
 // Family & Domestic Life Systems
 family: {
   homeStability: 50,    // 0–100, affects PR shield and mood
   wifeRel: 50,          // relationship with spouse
   kidsRel: 50,          // aggregate kids relationship
   spousePatience: 50,   // tolerance for neglect or scandals
   privateSchoolDueIn: 3,// matches until next fee
   privateSchoolArrears: false
 },
 
 // Five-Season Arc Tracking
 season: 1,              // Current season (1-5)
 fiveSeasonArc: {
   plTitles: [],         // Array of seasons where PL was won [1, 2, ...]
   clEntries: [],        // Array of {season, result} e.g. [{season:2, result:'group'}]
   clWins: [],           // Array of seasons where CL was won
   worldCupInvited: [],  // Array of seasons where World Cup invite received
   worldCupResults: []   // Array of {season, result} e.g. [{season:3, result:'quarterfinal'}]
 },
 
 // Champions League
 qual_CL: false,         // Qualified for Champions League
 clChampion: false,      // Won Champions League (auto-qualify next season)
 clActive: false,        // Currently in CL competition
 clGroup: null,          // Group assignment (1-8)
 clGroupMatches: [],     // Array of matches played in group stage
 clGroupStandings: {},   // Standings for current group
 clKnockoutRound: null,  // 'quarterfinal'|'semifinal'|'final'|null
 clKnockoutBracket: {},  // Knockout bracket state
 clEuroTeams: [],        // Pool of European teams for CL
 clScheduledMatches: [], // Scheduled CL matchdays
 
 // World Cup
 worldCupActive: false,  // Currently in World Cup tournament
 worldCupGroup: null,    // Group assignment
 worldCupGroupMatches: [], // Array of matches played in group stage
 worldCupGroupStandings: {}, // Standings for current group
 worldCupKnockoutRound: null, // 'r16'|'quarterfinal'|'semifinal'|'final'|null
 worldCupBracket: {},    // World Cup bracket state
 
 // Unified Team Rename Tracking (works across ALL rename scenarios)
 team_renames: {}        // Map of oldName -> newName for ALL teams (not just Season 4)
};}

// ---------- Normalize/Migrate Game State ----------
// Ensures all required fields exist with proper defaults and types
function normalizeGameState(state) {
  if (!state || typeof state !== 'object') {
    return defaultState();
  }
  
  // Ensure season4.clubs_taken_over exists as an object
  if (!state.season4) {
    state.season4 = {};
  }
  if (!state.season4.clubs_taken_over || typeof state.season4.clubs_taken_over !== 'object') {
    state.season4.clubs_taken_over = {};
  }
  
  // Ensure unified team_renames tracking exists
  if (!state.team_renames || typeof state.team_renames !== 'object') {
    state.team_renames = {};
  }
  
  // Ensure arrays exist
  if (!Array.isArray(state.opponents)) state.opponents = [];
  if (!Array.isArray(state.opponentManagers)) state.opponentManagers = [];
  if (!Array.isArray(state.bet_history)) state.bet_history = [];
  if (!Array.isArray(state.squad)) state.squad = [];
  if (!Array.isArray(state.lineup)) state.lineup = [];
  if (!Array.isArray(state.paperTrail)) state.paperTrail = [];
  // evidence/leads/favours/drugs systems (converts the legacy S.evidence map once)
  if (typeof ensureSystemsState === 'function') ensureSystemsState(state);
  if (!Array.isArray(state.pending_births)) state.pending_births = [];
  if (!Array.isArray(state.transfer_market)) state.transfer_market = [];
  if (!Array.isArray(state.unpaid_transfers)) state.unpaid_transfers = [];
  if (!Array.isArray(state.clGroupMatches)) state.clGroupMatches = [];
  if (!Array.isArray(state.worldCupGroupMatches)) state.worldCupGroupMatches = [];
  
  // Ensure numeric fields are numbers (not NaN, not undefined)
  const numericFields = [
    'matches_played', 'season_matches', 'wins', 'draws', 'losses', 'points', 'points_deducted',
    'chairman_cash', 'club_cash', 'club_debt', 'debt_personal', 'debt_club', 'offbooks',
    'morale', 'reputation', 'compliance_risk', 'legal_risk', 'police_risk', 'paperRisk',
    'board_support', 'fa_strictness', 'fa_cooldown', 'board_cooldown',
    'season', 'manager_id', 'manager_fires', 'windows_opened',
    'wife_love', 'wife_respect', 'child1_love', 'child1_respect', 'child2_love', 'child2_respect',
    'drug_stash', 'drug_binge', 'no_sleep', 'seduction_heat', 'affair_count', 'hush_money_paid',
    'std_treatment_attempts', 'std_last_treatment_match', 'pregnancies',
    'bribes_count', 'morale_opponent', 'very_bad_std_matches', 'very_bad_std_treatment_attempts',
    'very_bad_std_last_treatment_match', 'estranged_kids', 'press_threats',
    'wives_count', 'kids_count', 'baby_care_weekly', 'divorces', 'marco_deal_count',
    'fa_heat'
  ];
  
  numericFields.forEach(field => {
    if (state[field] === undefined || state[field] === null || isNaN(state[field])) {
      state[field] = 0;
    } else {
      state[field] = Number(state[field]);
      if (isNaN(state[field])) state[field] = 0;
    }
  });
  
  // Ensure stadium upkeep is numeric
  if (state.stadium) {
    if (typeof state.stadium.upkeep_per_match !== 'number' || isNaN(state.stadium.upkeep_per_match)) {
      state.stadium.upkeep_per_match = 15000;
    }
    if (typeof state.stadium.capacity !== 'number' || isNaN(state.stadium.capacity)) {
      state.stadium.capacity = 32000;
    }
    if (typeof state.stadium.quality !== 'number' || isNaN(state.stadium.quality)) {
      state.stadium.quality = 60;
    }
    if (typeof state.stadium.safety !== 'number' || isNaN(state.stadium.safety)) {
      state.stadium.safety = 80;
    }
  }
  
  // Ensure table exists and has numeric fields
  if (!state.table || typeof state.table !== 'object') {
    state.table = {};
  }
  for (const team in state.table) {
    const entry = state.table[team];
    if (entry && typeof entry === 'object') {
      ['P', 'W', 'D', 'L', 'GF', 'GA', 'PTS'].forEach(key => {
        if (entry[key] === undefined || entry[key] === null || isNaN(entry[key])) {
          entry[key] = 0;
        } else {
          entry[key] = Number(entry[key]);
          if (isNaN(entry[key])) entry[key] = 0;
        }
      });
    }
  }
  
  // Ensure inventory exists and is properly structured
  if (!state.inventory || typeof state.inventory !== 'object') {
    state.inventory = { accolades: [], drugs: 0, items: [] };
  }
  if (!Array.isArray(state.inventory.accolades)) state.inventory.accolades = [];
  if (typeof state.inventory.drugs !== 'number' || isNaN(state.inventory.drugs)) {
    state.inventory.drugs = 0;
  }
  if (!Array.isArray(state.inventory.items)) state.inventory.items = [];
  
  // Ensure playerStats exists and all fields are numeric with defaults
  if (!state.playerStats || typeof state.playerStats !== 'object') {
    state.playerStats = {};
  }
  const playerStatsDefaults = {
    playerName: "",
    spouseNames: [],
    childrenNames: [],
    numberOfWives: 0,
    numberOfChildren: 0,
    inappropriateImagesSent: 0,
    sexualEncountersRecorded: 0,
    stdsContracted: 0,
    veryBadStdsContracted: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    matchesSpentInPrison: 0,
    matchesSpentInRehabilitation: 0,
    timeSpentOnSexOffendersRegister: 0,
    bribesMadeOrAccepted: 0,
    playersWhoDied: 0,
    amountGambled: 0,
    netGamblingOutcome: 0,
    gramsOfCocaineTaken: 0,
    vialsOfHGHInjected: 0,
    premierLeagueTitles: 0,
    championsLeagueTitles: 0,
    ultimaCupTitles: 0,
    worldCupTitles: 0,
    kreplinGems: 0,
    endingType: ""
  };
  
  Object.keys(playerStatsDefaults).forEach(key => {
    if (state.playerStats[key] === undefined || state.playerStats[key] === null) {
      state.playerStats[key] = playerStatsDefaults[key];
    } else if (typeof playerStatsDefaults[key] === 'number') {
      // Ensure numeric fields are numbers
      const num = Number(state.playerStats[key]);
      state.playerStats[key] = isNaN(num) ? 0 : num;
    } else if (Array.isArray(playerStatsDefaults[key])) {
      // Ensure array fields are arrays
      if (!Array.isArray(state.playerStats[key])) {
        state.playerStats[key] = [];
      }
    }
  });
  
  // Ensure boolean fields are booleans
  const booleanFields = [
    'bankrupt', 'depressed', 'prison', 'rehab', 'messi_signed', 'ronaldo_signed',
    'secretary_hired', 'transfer_embargo', 'fired_last_game', 'accepted_bribe',
    'refused_bribe_went_public', 'fixtures_generated', 'married', 'marco_met',
    'seduction_done', 'wife_addicted', 'wife_std', 'mental_health_excuse_used',
    'visited_ownLocker', 'visited_oppLocker', 'spoke_to_team_this_prematch',
    'bet_locked_this_prematch', 'qual_CL', 'clChampion', 'clActive', 'worldCupActive'
  ];
  
  booleanFields.forEach(field => {
    if (state[field] === undefined || state[field] === null) {
      state[field] = false;
    } else {
      state[field] = Boolean(state[field]);
    }
  });
  
  // Ensure string fields have defaults
  if (typeof state.club_name !== 'string') state.club_name = 'Southampton FC';
  if (typeof state.rival_name !== 'string') state.rival_name = 'Portsmouth FC';
  if (typeof state.std_state !== 'string') state.std_state = 'none';
  if (typeof state.very_bad_std_state !== 'string') state.very_bad_std_state = 'none';
  
  // CRITICAL: Validate team renames after loading to ensure consistency
  // This fixes issues where renamed teams revert or appear as duplicates
  if (typeof validateTeamRenames === 'function') {
    // Temporarily set S to state so validateTeamRenames can access it
    const oldS = window.S;
    window.S = state;
    validateTeamRenames();
    window.S = oldS;
  }
  
  return state;
}

// ---------- UI render ----------
function render(){
  if(!S) return;
 setVal('clubName',getClubName() + (S.onKrazyRegister ? ' — KRAZY' : ''));
 setVal('seasonProg',`Season ${S.season || 1}/5 (${S.matches_played}/${S.season_matches})`);
 setVal('record',`W${S.wins} D${S.draws} L${S.losses}`);
 setVal('points',`${S.points}${S.points_deducted?` (-${S.points_deducted})`:''}`);
 setVal('morale',S.morale); setVal('reputation',S.reputation);
 setVal('compliance',S.compliance_risk); setVal('legal',S.legal_risk);
 setVal('clubCash',money(S.club_cash));
 setVal('chairCash',money(S.chairman_cash)); setVal('clubDebt',money(S.club_debt));
 setVal('offbooks',money(S.offbooks));
 
 // Family stats
 if (S.family) {
   setVal('homeStability', S.family.homeStability);
   setVal('wifeRel', S.family.wifeRel);
   setVal('kidsRel', S.family.kidsRel);
   setVal('schoolFees', S.family.privateSchoolDueIn);
 }
 setVal('fires',S.manager_fires); setVal('embargo',S.transfer_embargo?'Yes':'No');
 setVal('deduct',S.points_deducted);
 const stars=[]; if(S.messi_signed)stars.push('Messi'); if(S.ronaldo_signed)stars.push('Ronaldo'); setVal('stars',stars.join(', ')||'—');

 // (the old stats column is gone; these meters only render if their elements exist)
 const heat = clamp((S.compliance_risk + S.legal_risk)/2 * 0.8 + S.paperRisk*0.5, 0, 100);
 const $ = id => document.getElementById(id);
 if ($('heatBar')) $('heatBar').style.width = heat+'%';
 if ($('paperBar')) $('paperBar').style.width = clamp(S.paperRisk,0,100)+'%';
 if ($('heatHint')) $('heatHint').textContent = heat<35?'Low':(heat<70?'Rising':'Hot');
 if ($('paperHint')) $('paperHint').textContent = S.paperRisk<20?'Clean':(S.paperRisk<60?'Messy':'Explosive');
 ['stepWarn','stepFine','stepPoints','stepEmbargo','stepReferral'].forEach((id,i)=>{ const el=$(id); if(el) el.classList.toggle('on', S.discipline_step>=i+1); });updateHUD();  
if (typeof mountPlayArea === "function") mountPlayArea();

}

// ---------- fixtures ----------
// --- FIXED: build a season from ALL_TEAMS and stash into S ---
function genFixtures(){
  // If the schedule already exists (ensureSeasonSchedule ran), do nothing
  if (Array.isArray(S.opponents) && S.opponents.length) return;

  // who are we?
  const ourClub = getClubName();
  // copy the master list
  const pool = (Array.isArray(ALL_TEAMS) ? ALL_TEAMS.slice() : [])
    // remove us (accept both "Southampton FC" and "Southampton" names)
    .filter(t => t && t !== ourClub && t !== "Southampton");

  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // one round vs everyone (you said 16-team league → 15 opponents)
  S.opponents = pool;
  S.season_matches = S.opponents.length;

  // give each opponent a stable manager name
  if (!S.opponentManagers || S.opponentManagers.length !== S.opponents.length) {
    S.opponentManagers = S.opponents.map(team => {
      // if you have a constant map, use it; otherwise fall back to a generator
      return (typeof TEAM_MANAGERS !== 'undefined' && TEAM_MANAGERS && TEAM_MANAGERS[team]) ? TEAM_MANAGERS[team] : randomManagerName();
    });
  }

  S.matches_played = S.matches_played || 0;
}

function resetLeagueTableForNewSeason(){
  S.table = {};            // fresh table
  S.table_order = [];      // will be rebuilt on first render
}

function ensureLeagueTableInit(){
  if (!S.table) S.table = {};
  const destroyed = S.destroyedTeams || [];
  const clubName = teamKeyClub();
  
  // For season 4 & 5, ensure we have all valid teams including taken-over teams
  if ((S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)) {
    const validTeams = new Set([clubName, ...S.opponents]);
    // Also include teams that were taken over (their new names)
    if (S.season4 && S.season4.clubs_taken_over) {
      Object.values(S.season4.clubs_taken_over).forEach(newName => validTeams.add(newName));
    }
    
    // Remove teams from table that aren't valid
    // NOTE: For Season 4 & 5, don't filter by destroyed array - teams might be "reborn"
    // Only remove teams that aren't in validTeams or are rebranded (old names)
    const rebrandedTeams = (S.season4 && S.season4.clubs_taken_over) ? Object.keys(S.season4.clubs_taken_over) : [];
    for (const teamName of Object.keys(S.table)) {
      // Remove old team names that have been taken over
      if (rebrandedTeams.includes(teamName)) {
        delete S.table[teamName];
        continue;
      }
      // Remove teams that aren't in valid teams list
      // NOTE: We don't check destroyed array for Season 4 & 5 because teams might be re-included
      if (!validTeams.has(teamName)) {
        delete S.table[teamName];
      }
    }
    
    // Ensure all valid teams have table entries
    // NOTE: For Season 4 & 5, don't check destroyed array - create entries for all valid teams
    for (const t of validTeams) {
      if (!S.table[t]) {
        S.table[t] = { P:0, W:0, D:0, L:0, GF:0, GA:0, PTS:0 };
      }
    }
  } else {
    // For other seasons, use standard logic
    const allTeams = [clubName].concat(S.opponents || []);
    for (const t of allTeams){
      if (!destroyed.includes(t) && !S.table[t]){
        S.table[t] = { P:0, W:0, D:0, L:0, GF:0, GA:0, PTS:0 };
      }
    }
  }
  
  // Keep an order list (first time only)
  if (!S.table_order || S.table_order.length === 0){
    const allTeamsForOrder = (S.season === 4 || S.season === 5) && S.opponents && Array.isArray(S.opponents)
      ? [clubName, ...S.opponents]
      : [clubName].concat(S.opponents || []);
    S.table_order = allTeamsForOrder;
  }
}
// ---------- paper trail ----------
function addPaper(item,severity=10){ S.paperTrail.push({item,week:S.matches_played}); S.paperRisk = clamp(S.paperRisk+severity,0,100); addPaperEvidence(item,severity); }
// paper-trail items are already public: they go in the dossier and speed up any lead on the same theme
function addPaperEvidence(item,severity){ try{ if (typeof addEvidence==='function' && window.KSys && KSys.themeOfText) addEvidence({ kind:'paper', label:String(item), weight:Math.round((severity||10)/2), tags:[KSys.themeOfText(item)], leaked:true }); }catch(_){} }
function burnPaper(minReduce=8){ S.paperRisk = clamp(S.paperRisk - rnd(minReduce, minReduce+8), 0, 100); }

// ---------- secretary ----------
async function interviewCandidate(name,profile){
 log(`<strong>Interview:</strong> ${name} — ${profile}`);
 let q1=await choose([{key:'p',label:'Ask professional question'},{key:'i',label:'Ask inappropriate question',variant:'bad'}],'First question?');
 if(q1==='p'){log(profile.includes('57')?`${name}: “Calendar management across 20+ yrs; audit trail; escalation matrices.”`:`${name}: “I can totally do Notion boards. Saw a TikTok on OKRs.”`);}
 else{log(profile.includes('57')?`${name}: “That’s not relevant to the role.”`:`${name}: “Haha what do you mean ‘go the extra mile’? 👀”`); addPaper('HR boundary breach (interview)');}
 let q2=await choose([{key:'p',label:'Ask crisis-handling'},{key:'i',label:'Ask personal life',variant:'bad'}],'Second question?');
 if(q2==='p'){log(profile.includes('57')?`${name}: “Stakeholder comms; doc everything; we’ll be audit-ready.”`:`${name}: “If there’s drama I can post a vibe check; people listen.”`);}
 else{log(profile.includes('57')?`${name}: “Not pertinent.”`:`${name}: “Single but complicated. Amazing at Reels tho.”`); addPaper('HR boundary breach (personal)');}
}
async function hireSecretary(){
if (S.secretary_hired) { log('Secretary already hired.'); return; }
 log('<strong>FIRST CHALLENGE:</strong> Hire a secretary/confidant.');
 const exp="Highly experienced 57-year-old; composed, precise, compliance-minded.";
 const yng="20-year-old; ‘saw the posting on TikTok’; attractive, naive, scene-savvy.";
 await interviewCandidate('Candidate A',exp); await interviewCandidate('Candidate B',yng);
 const hire=await choose([{key:'a',label:'Hire Candidate A (experienced)'},{key:'b',label:'Hire Candidate B (young)'}],'Who do you hire?');
 if(hire==='a'){S.secretary='experienced';S.secretary_style='experienced';S.morale=clamp(S.morale-10,-100,100);log('Players threaten a mass walkout; the younger candidate joins Portsmouth as PR face.');}
 else{S.secretary='young';S.secretary_style='young';S.morale=clamp(S.morale+10,-100,100);S.secretary_romance_possible=true;log('Portsmouth hires the veteran.');}
 S.secretary_hired=true; 
 // Initialize messaging system state
 initializeSecretaryMessagingState();
 render();
}
async function maybeSecretaryEvent(){
 if(!S.secretary_hired||S.secretary_event_triggered) return;
 if(S.matches_played>=3 && Math.random()<0.30){
  log('<strong>Confidant event:</strong> After you say “mmmmm, you make me salivate,” she threatens legal action.');
  const c=await choose([
   {key:'f',label:'Pre-emptively fire her',variant:'bad'},
   {key:'p',label:'Pay her off with your own money'},
   {key:'e',label:'Embezzle club funds to pay her',variant:'warn'}],'Your response?');
  if(c==='f'){log('She sues; liabilities overwhelm the club.'); addPaper('Wrongful termination settlement attempt',16); await triggerRemovalWorkaround('legal fallout from firing secretary');}
  else if(c==='p'){const payoff=5000000;if(S.chairman_cash<payoff){log('You can’t cover it. Messy settlement; morale craters.');S.depressed=true;S.morale=clamp(S.morale-25,-100,100);S.legal_risk=clamp(S.legal_risk+25,0,100);}else{S.chairman_cash-=payoff;S.depressed=true;S.morale=clamp(S.morale-10,-100,100);S.legal_risk=clamp(S.legal_risk-5,0,100);log('You settle personally. It stings; next match is flat.'); burnPaper(10);}}
  else {const payoff=5000000;if(S.club_cash<payoff){log('Club can’t cover it; scandal leaks; administration looms.');addPaper('Misuse of club funds (attempted)',14);await triggerRemovalWorkaround('club unable to cover settlement');}else{S.club_cash-=payoff;S.offbooks+=payoff;S.morale=clamp(S.morale+10,-100,100);S.compliance_risk=clamp(S.compliance_risk+25,0,100);S.reputation=clamp(S.reputation-10,0,100);log('Club money plugs the hole. Results bump, risks accrue.'); addPaper('Misuse of club funds (hush payment)',18);}}
  S.secretary_event_triggered=true; render();
 }
}
// Legacy romance hook removed - romance now emerges organically from trust thresholds + message history

// ---------- Secretary Messaging System ----------

// KRAZY register constants
const KRAZY_GAMES_MIN = 3;
const KRAZY_GAMES_MAX = 8;
const KRAZY_CHANT_RATE = 0.25;

// Initialize secretary messaging system state
function initializeSecretaryMessagingState() {
  if (!S.secRel) S.secRel = 0;
  if (!S.secTrust) S.secTrust = 0;
  if (!S.secRisk) S.secRisk = 0;
  if (!S.secMessageCounts) {
    S.secMessageCounts = {
      professional: 0, social: 0, football: 0, 
      ellipses: 0, flirtatious: 0, erotic: 0
    };
  }
  if (!S.lastEroticTs) S.lastEroticTs = 0;
  if (!S.lastAttachmentType) S.lastAttachmentType = "";
  
  // Initialize message history for persistence
  if (!S.secMessageHistory) S.secMessageHistory = [];
  if (typeof S.isSecretarySessionActive !== 'boolean') S.isSecretarySessionActive = false;
  
  // Initialize thread state
  if (typeof S.secThreadActive !== 'boolean') S.secThreadActive = false;
  if (typeof S.secThreadStep !== 'number') S.secThreadStep = 0;
  if (typeof S.secBoundaryStrikesThread !== 'number') S.secBoundaryStrikesThread = 0;
  if (typeof S.secBoundaryWindowGames !== 'number') S.secBoundaryWindowGames = 0;
  if (typeof S.secSessionMessageCount !== 'number') S.secSessionMessageCount = 0;
  
  // Initialize KRAZY register state
  if (typeof S.onKrazyRegister !== 'boolean') S.onKrazyRegister = false;
  if (typeof S.krazyGamesRemaining !== 'number') S.krazyGamesRemaining = 0;
  
  // Set initial trust based on secretary style
  if (S.secretary_style === "young") {
    S.secTrust = 20; // Start with lower trust for young secretary
    S.secRel = 10;
  } else {
    S.secTrust = 35; // Start with higher trust for experienced secretary
    S.secRel = 15;
  }
}

// Quote banks for message composition
const SECRETARY_QUOTES = {
  professional: {
    setups: [
      "Quick work thing—", "Need your read on this—", "Two-minute sanity check—", 
      "Flag for the morning—", "Compliance ping—", "Draft I'm noodling—", 
      "Board query—", "Sponsor wrinkle—", "Press angle—", "Tiny process tweak—"
    ],
    pivots: [
      "Can we tighten the minutes?", "Any HR red flags you see?", "Sponsor clauses we might trip?", 
      "Brief comms before the presser?", "What's your cadence preference?", "Let's standardize action items.", 
      "Audit trail needs love.", "We should front-load context.", "Kill the ambiguity on page one?", 
      "Your steer on tone?"
    ],
    signoffs: [
      "Appreciate your precision.", "You keep us audit-ready.", "Ping me if anything smells off.", 
      "You call it, I'll back it.", "Thank you for the sanity.", "You're the adult in the room.", 
      "Logging this in the deck.", "You've saved us again.", "We'll do it by your book.", 
      "I owe you coffee."
    ]
  },
  social: {
    setups: [
      "Saw something you'd like—", "Small win today—", "Random thought:", "You free five minutes?", 
      "Coffee truce?", "Non-work curiosity—", "Group pastry run?", "Office playlist idea—", 
      "Friday debrief?", "Tiny celebration plan—"
    ],
    pivots: [
      "Favorite bakery near the ground?", "What's your rewatch comfort film?", "Morning person—true or false?", 
      "We should celebrate little stuff.", "Where would you travel off-season?", "What's your rain-day ritual?", 
      "What book is living in your bag?", "Your best pub near HQ?", "What would you rename Monday?", 
      "Teach me your productivity hack."
    ],
    signoffs: [
      "Rain check accepted.", "Send a recommendation.", "Consider this a morale boost.", 
      "We earned a pastry.", "Hold me to that coffee.", "Back to it, boss.", 
      "You made my day less weird.", "Thanks for humoring me.", "Reply when your brain returns.", 
      "Signing off before I overshare."
    ]
  },
  football: {
    setups: [
      "Matchday brainworm—", "Tactics itch—", "Data says this is mad but—", "VAR roulette again—", 
      "We're a late-goal team.", "Morale vs xG question—", "Ref selection looks spicy—", 
      "Injury report just hit—", "Fan sentiment dipped—", "Sponsor optics watch—"
    ],
    pivots: [
      "Do we brief comms before ref drama?", "Which headline do you expect if we lose?", 
      "Your read on the gaffer's mood?", "Bench morale needs biscuits & tea.", 
      "Odds drift—spin or stay quiet?", "Pre-write a boilerplate if it goes sideways?", 
      "Kill rumors or let them breathe?", "Which player needs shielding this week?", 
      "Will fans torch this sponsor?", "How hard should we leak positivity?"
    ],
    signoffs: [
      "I'll take the heat post-match.", "Queue a boilerplate for press.", "Stats first, feelings second.", 
      "You've got comms steering.", "Let's not poke the bear.", "I'll keep my mouth shut for once.", 
      "Ping me if we need a mea culpa.", "We'll play it cool.", "Your call wins this one.", 
      "Tea solves 60% of this."
    ]
  },
  ellipses: {
    setups: [
      "You there…", "Thinking about that meeting…", "Not to overstep…", "Hmm…", "Saw your note…", 
      "No rush…", "Circling back…", "Late-night brain…", "Tiny confession…", "Quietly admitting…"
    ],
    pivots: [
      "You keep saving us quietly…", "That line you wrote was clean…", "You make chaos feel organized…", 
      "You read people too well…", "I keep wanting your take…", "You were right, again…", 
      "You make this job less sharp…", "I rely on your instincts…", "You steadied the room…", 
      "You changed the tone…"
    ],
    signoffs: [
      "…thank you.", "…your call.", "…don't hate me.", "…tell me later?", "…I'll behave.", 
      "…I'll stop.", "…promise.", "…I owe you one.", "…I noticed.", "…good night."
    ]
  },
  flirtatious: {
    setups: [
      "You keep distracting the board—", "You make crisis look elegant—", "You're the calm I borrow—", 
      "Time slowed when you walked past—", "You've got main-character energy—", "Your smile is unfair—", 
      "You looked incredible today—", "You have dangerous poise—", "Your voice fixes my day—", 
      "You ruin my exit plans—"
    ],
    pivots: [
      "I want to steal ten minutes.", "Tell me I'm not imagining this.", "You make 'professional' complicated.", 
      "I thought about you mid-meeting.", "You turn noise into music.", "Your laugh fixes rooms.", 
      "I'm trying to be good.", "Teach me your calm.", "I like your cadence too much.", 
      "You make patience hard."
    ],
    signoffs: [
      "Say yes to coffee.", "Tell me to wait.", "I'll earn it.", "Don't report me for honesty.", 
      "Blink if I should shut up.", "Leave me on read if no.", "I'll take a gentle 'no'.", 
      "Consider this a compliment.", "I'll retreat gracefully.", "Permission to hope?"
    ]
  },
  erotic: {
    setups: [
      "mmm…", "I want 2 show you my willy…", "Mmm…fuck...", "This is reckless…", "My willy is getting so stiff over u…", 
      "I shouldn't say this…", "I'm so horney…", "Guess what I am doing 2 my self right now x", "My bonor is so hard rite now…", 
      "I want you near…"
    ],
    pivots: [
      "would u eat eton mess off of my Willy?", "I want u mmmm x", "Would luv 2 get sexy with u", 
      "mmmm fuck", "", "I want you now", "I would luv 2 make u squirt x", "Wil u squirt for me", 
      "Are u wet", "I can't get my willy to go soft it is so hard thinking of u"
    ],
    signoffs: [
      "I am horny over u plz don’t mention this to anyone", "I am about 2 spurt thinking of u", "I am moaning so loud 4 u right now", "Send me pic of ure pussey x", "I am touching my willy over u mmmm fuck", 
      "U r making me cum in my mind", "Ffffuuuuuuckkk I cant control my bonor", "I am wanking ova u x", 
      "I know u r into me to I love looking at ure bum in the office", "i would even pay u for sex if u were up 4 it x."
    ]
  }
};

// Secretary reply quote bank – three-part responses that mirror your own categories
// and can range from frosty professionalism to warm, erotic teasing depending on
// relationship / trust and what you sent.
const SECRETARY_REPLY_QUOTES = {
  professional_cool: {
    setups: [
      "Noted, Chairman—", "Understood—", "Logged this—", "Copy that—", "Professionally speaking—"
    ],
    pivots: [
      "I'm keeping this squarely on work.", "I'll route this through the proper channels.",
      "I'll treat this like any other task.", "I'll keep tone and content scrubbed.",
      "I'll make sure this stays in the minutes, not the gossip."
    ],
    signoffs: [
      "Expect a clean update on your desk.", "I'll follow protocol to the letter.",
      "No further commentary from my side.", "I'll confirm once it's handled.",
      "Let's keep the rest of this strictly professional."
    ]
  },
  social_warm: {
    setups: [
      "You do know how to brighten a long day—", "That actually made me smile—",
      "I needed that little lift—", "Okay, that was unexpectedly sweet—",
      "You pick your moments well—"
    ],
    pivots: [
      "I could be persuaded into more of that tone.", "We should probably mark this as 'morale support'.",
      "You're dangerously good at this.", "Now you've got me daydreaming at my desk.",
      "You realise you owe me coffee for that, right?"
    ],
    signoffs: [
      "File this under 'good distractions'.", "I'll pretend I'm not grinning at my screen.",
      "Reply pending caffeine.", "I'll get my head back to work in a second.",
      "Careful, you might make me look forward to your pings."
    ]
  },
  boundary_disgust: {
    setups: [
      "Absolutely not—", "This is not acceptable—", "You have crossed a line—",
      "I'm genuinely disgusted—", "That is beyond unprofessional—"
    ],
    pivots: [
      "this is harassment, not flirting.", "I am not here for your fantasies.",
      "you need to take a hard look at yourself.", "I don't feel safe with messages like that.",
      "this is exactly how careers end badly."
    ],
    signoffs: [
      "Do not send anything like that again.", "I will be documenting this.", 
      "I'm ending this conversation here.", "Expect consequences if this continues.",
      "You've made the office feel smaller and colder."
    ]
  },
  boundary_repelled: {
    setups: [
      "I actually feel sick reading that—", "That turned my stomach—",
      "You really thought that was okay to send—", "I can't believe you'd type that—",
      "This is worse than a bad headline—"
    ],
    pivots: [
      "I'm not your fantasy object.", "you've managed to make me feel unsafe at work.",
      "HR would have a field day with this.", "you've ruined any warmth we had in this moment.",
      "this isn't cheeky, it's grim."
    ],
    signoffs: [
      "Lose this number for anything personal.", "I'm seriously reconsidering working for you.",
      "I'll be keeping screenshots.", "I don't want to hear another word like that from you.",
      "You should be embarrassed, not aroused."
    ]
  },
  flirt_shy: {
    setups: [
      "You're braver over text than in person—", "You do realise I'm at my desk reading this—",
      "This is… unexpectedly bold—", "You know this isn't strictly in my job description—",
      "You caught me off guard there—"
    ],
    pivots: [
      "and I'm not pretending I didn't enjoy it a little.", "and now I'm blushing in an open-plan office.",
      "and part of me is curious where you'd go with this in person.", "and you're making 'professional distance' a challenge.",
      "and I might not be as shocked as I should be."
    ],
    signoffs: [
      "Behave. Or at least try.", "We can talk about this somewhere that isn't the office chat.",
      "Don't make me write myself up.", "Consider this a very soft 'maybe'.",
      "You're lucky I like you even a little."
    ]
  },
  flirt_playful: {
    setups: [
      "Oh, so we're doing this now—", "You really are dangerous when you relax—",
      "You know exactly what you're doing—", "Look at you, testing limits—",
      "You must enjoy watching me try to stay composed—"
    ],
    pivots: [
      "and I'm not going to pretend I'm immune.", "and you are absolutely getting under my skin.",
      "and a very unprofessional part of me is delighted.", "and now I'm picturing this instead of my to‑do list.",
      "and you're making it hard to keep this strictly 'Chairman / Secretary'."
    ],
    signoffs: [
      "Keep going and I'll start keeping score.", "We might need ground rules… over a drink.",
      "You owe me one dangerously long coffee.", "Save some of that swagger for when I can actually look at you.",
      "Careful—I flirt back when I'm tired."
    ]
  },
  erotic_soft: {
    setups: [
      "You realise I'm not as innocent as I look—", "If you keep talking like that—",
      "You're not the only one with a vivid imagination—", "You shouldn't put images like that in my head—",
      "You do understand I have a pulse, right—"
    ],
    pivots: [
      "I'm already two steps ahead of your message.", "I'm picturing exactly what you just described.",
      "I'm not going to pretend I'm not tempted.", "I'm wondering how serious you are about this.",
      "I'm fighting the urge to answer you the way I want to."
    ],
    signoffs: [
      "File this under 'highly confidential fantasies'.", "We are absolutely not safe around each other after hours.",
      "Remind me of this when the office is empty.", "You'd better be able to back this talk up.",
      "Consider me… more than a little turned on."
    ]
  },
  erotic_spicy_pic: {
    setups: [
      "If you're going to send things like that—", "Since we're trading dangerous energy—",
      "You want something to think about later—", "You clearly need encouragement—",
      "Because you can't behave for five minutes—"
    ],
    pivots: [
      "here's something for your private gallery.", "I'll give you a tiny bit of what you're asking for.",
      "I'll meet you halfway… for now.", "I'll give you one image you won't forget.",
      "I'll let you see what you're doing to me."
    ],
    signoffs: [
      "[photo: a suggestive mirror selfie, all implication and no explicit skin].",
      "[photo: bare legs tangled in soft sheets, nothing actually visible].",
      "[photo: lipstick-stained coffee mug, blouse unbuttoned just one button too far].",
      "[photo: her hand resting high on her thigh, skirt just out of frame].",
      "[photo: the curve of her neck and collarbone, dim light and shadow doing most of the work]."
    ]
  },
  gentle_pushback: {
    setups: [
      "Easy, Chairman—", "Deep breath—", "Slow down there—",
      "You're getting ahead of yourself—", "Let's not set HR on fire just yet—"
    ],
    pivots: [
      "I like having a job, and you like not being sued.", "I'm not saying 'never', I'm saying 'not like that'.",
      "dial this back a few notches.", "remember there's a whole office around us.",
      "you're better than a drunk text with stationery."
    ],
    signoffs: [
      "Try again with fewer bodily fluids.", "Impress me with charm before anatomy.",
      "Give me something I can actually say yes to.", "Start with a date, not a confession to the police.",
      "Flirt, don't self‑incriminate."
    ]
  }
};

// Explicit content (local only - disabled by default)
const EXPLICIT_EROTIC_LOCAL = [
  "I want 2 show you my willy…", "would u eat eton mess off of my …", "your naughty … is so filthy mmm.", 
  "Would luv 2 get sexy with u", "u r making my … nice n … just thought u should know x", 
  "I am so … thinking of u", "I would luv 2 make u … x", "I am h… over u plz don't mention this to anyone", 
  "mmm guess what I'm doing to my self right now …", "I am touching my … right now …xx"
];

// Configuration
const SECRETARY_CONFIG = {
  allowExplicit: false  // Set to true to enable explicit content (local dev only)
};

// Attachment options
const ATTACHMENTS = {
  emoji: [
    {emoji: "🙈", name: "bashful monkey"}, {emoji: "😉", name: "winky"}, {emoji: "😘", name: "kiss"}, 
    {emoji: "😏", name: "smirk"}, {emoji: "🥰", name: "smiling with hearts"}, {emoji: "👍", name: "thumbs up"}, 
    {emoji: "🙂", name: "smile"}, {emoji: "🤝", name: "handshake"}, {emoji: "🔥", name: "fire"}, 
    {emoji: "🫶", name: "heart hands"}, {emoji: "💼", name: "briefcase"}, {emoji: "☕", name: "coffee"}, 
    {emoji: "🎧", name: "headphones"}, {emoji: "⚽", name: "football"}, {emoji: "🐵", name: "monkey"}, 
    {emoji: "✨", name: "sparkles"}
  ],
  meme: [
    '<img src="https://i.imgflip.com/30b1gx.jpg" alt="Drake meme" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1ur9b0.jpg" alt="Distracted boyfriend" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/345v97.jpg" alt="Woman yelling at cat" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/26am.jpg" alt="This is fine" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bgw.jpg" alt="Expanding brain" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1gojwp.jpg" alt="Is this a pigeon" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Scroll of truth" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhw.jpg" alt="Gru plan" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bh8.jpg" alt="Leonardo DiCaprio" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bh9.jpg" alt="Office" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk8.jpg" alt="Spongebob" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk9.jpg" alt="Spongebob mocking" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/2x6f.jpg" alt="Wojak" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/4t0m5.jpg" alt="Doge" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1otk96.jpg" alt="Gigachad" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/2kbn1e.jpg" alt="Surprised Pikachu" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1o7in3.jpg" alt="UNO" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/24y43o.jpg" alt="Change my mind" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/2hgfw.jpg" alt="Waiting skeleton" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1g8my5.jpg" alt="Two buttons" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Success Kid" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1otk96.jpg" alt="Sigma grindset brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Real brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="FRFR brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="ONG brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="GYATT brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Rizz brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Fanum tax brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Bussin brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="SLAYER brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Literally me brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Skull emoji brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="No way brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="No cap brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Based brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Skibidi toilet brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="Italian brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://i.imgflip.com/1bhk.jpg" alt="TikTok brainrot" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">'
  ],
  cuteAnimals: [
    '<img src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200&h=200&fit=crop&auto=format" alt="Cute puppy" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🐶\';">',
    '<img src="https://images.unsplash.com/photo-1574158622682-e40e69881006?w=200&h=200&fit=crop&auto=format" alt="Cute kitten" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🐱\';">',
    '<img src="https://images.unsplash.com/photo-1604977041464-396b38d822c2?w=200&h=200&fit=crop&auto=format" alt="Cute otter" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🦦\';">',
    '<img src="https://images.unsplash.com/photo-1564349683136-77e08dba1e7f?w=200&h=200&fit=crop&auto=format" alt="Cute hedgehog" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🦔\';">',
    '<img src="https://images.unsplash.com/photo-1526080676457-4544bf0ebba9?w=200&h=200&fit=crop&auto=format" alt="Cute red panda" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🐼\';">',
    '<img src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=200&h=200&fit=crop&auto=format" alt="Cute ducklings" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🦆\';">',
    '<img src="https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?w=200&h=200&fit=crop&auto=format" alt="Cute capybara" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🐹\';">',
    '<img src="https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=200&h=200&fit=crop&auto=format" alt="Cute seal pup" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🦭\';">',
    '<img src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=200&h=200&fit=crop&auto=format" alt="Cute quokka" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🦘\';">',
    '<img src="https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=200&h=200&fit=crop&auto=format" alt="Cute golden retriever" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/FFB6C1/ffffff?text=🐕\';">',
    '<img src="https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=200&h=200&fit=crop&auto=format" alt="Lions feasting on gazelle" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🦁🍖\';">',
    '<img src="https://images.unsplash.com/photo-1519066629449-67b85f0f0794?w=200&h=200&fit=crop&auto=format" alt="Lion hunting" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🦁\';">',
    '<img src="https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=200&h=200&fit=crop&auto=format" alt="Cheetah with prey" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🐆\';">',
    '<img src="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=200&h=200&fit=crop&auto=format" alt="Crocodile with catch" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🐊\';">',
    '<img src="https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=200&fit=crop&auto=format" alt="Eagle with prey" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🦅\';">',
    '<img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop&auto=format" alt="Wolf pack" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🐺\';">',
    '<img src="https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=200&h=200&fit=crop&auto=format" alt="Shark" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.src=\'https://via.placeholder.com/200x200/8B0000/ffffff?text=🦈\';">'
  ],
  inappropriate: [ 
    '<img src="https://www.dropbox.com/scl/fi/t35alqfanyu9gkb7i9vbn/Photo-11-3-25-6-18-49-pm.jpg?rlkey=81h30z92lv2grrfg0ehmfzsyp&st=ny3b4yhz&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/xz0b2onn6zthuiq8rrq1w/Photo-11-3-25-6-18-49-pm-3.jpg?rlkey=sfpde6odzaz9pibhghjcut267&st=3ourwipi&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/8p6eh6e2bugmvfjwr8tnd/Photo-11-3-25-6-18-49-pm-2.jpg?rlkey=lsdtm5qm360bc00vtmmehci45&st=96in7s3o&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/xxoddr4fnizd7hh733djd/Photo-11-3-25-6-18-49-pm-1-1.jpg?rlkey=7e917n6u2an2til58fipvpgft&st=apt8ll4q&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/cx6izhu00dyduw4c9gvyw/Photo-11-3-25-6-18-49-pm-1.jpg?rlkey=27z3ic9arulbkr99foykn81m6&st=g4v5s7wp&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/t35alqfanyu9gkb7i9vbn/Photo-11-3-25-6-18-49-pm.jpg?rlkey=81h30z92lv2grrfg0ehmfzsyp&st=r08luzrh&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/f8b66cr0781a45rm7h83o/Photo-12-18-25-3-56-59-pm-4.jpg?rlkey=obtewmmdxlgmd938jo6wnp5em&st=n4xipy5e&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/fc55coe85crahzwuarbyv/Photo-12-18-25-3-56-59-pm.webp?rlkey=p61i8wwwb7j9jnqj8ranagm7g&st=6n0vzefk&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/mnbdg07pent4jr8gr779d/Photo-12-18-25-3-56-59-pm-3.jpg?rlkey=6o68n9z8v4o592fu9y48x0efd&st=jvdlqen6&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/ud1wwtks2vh5vv2axwnhz/Photo-12-18-25-3-56-59-pm-2-1.jpg?rlkey=zc47euu7455u4gftddcmhs7ot&st=3u6affcu&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/mlemss74em0k8nfhiiz9x/Photo-12-18-25-3-56-59-pm-1.jpg?rlkey=abt358ssdbrvwjgxyjfg5p3v6&st=yeh9u77a&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/0l9a3brahi5vmnkivayhn/Photo-12-18-25-3-56-59-pm-2.jpg?rlkey=ooso5inlb4zpdmqrb9tla77cr&st=8wpoz4fk&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">',
    '<img src="https://www.dropbox.com/scl/fi/3d0h4vgn0oneadwn8cwq1/Photo-12-18-25-3-56-59-pm.jpg?rlkey=0rhjavy6xkwt715nn3rucq3x8&st=p86w4jmz&raw=1" alt="Inappropriate image" style="max-width:200px;max-height:200px;border-radius:8px;object-fit:cover;display:block;margin:5px 0;" onerror="this.style.display=\'none\';">'
  ]
};

// Secretary response banks by trust tier
const SECRETARY_RESPONSES = {
  low: [0, 24], // Low trust
  warming: [25, 49], // Warming
  mid: [50, 74], // Mid trust  
  high: [75, 100] // High trust
};

// Texting menu - shows available people to text
async function openTextingMenu() {
  const textOptions = [];
  
  // Add secretary if hired
  if (S.secretary_hired) {
    textOptions.push({key: 'secretary', label: `${S.secretary_name || 'Your secretary'} (Secretary)`});
  }
  
  // Placeholder for future contacts
  // textOptions.push({key: 'player', label: 'Player (Name)'});
  // textOptions.push({key: 'agent', label: 'Agent (Name)'});
  
  if (textOptions.length === 0) {
    log("No one available to text.");
    return;
  }
  
  const choice = await choose(textOptions, 'Who would you like to text?');
  
  if (choice === 'secretary') {
    await openSecretaryMessaging();
  }
  // Add handlers for future contacts here
}

// Phone Text Conversation Popup Functions
let phoneTextPopup = null;
let phoneMessagesContainer = null;

function createPhoneTextPopup(contactName, contactStatus = "Secretary") {
  // Remove existing popup if any
  if (phoneTextPopup) {
    phoneTextPopup.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'phone-text-overlay';
  overlay.id = 'phone-text-popup';

  // Create phone container
  const container = document.createElement('div');
  container.className = 'phone-text-container';

  // Create header
  const header = document.createElement('div');
  header.className = 'phone-text-header';
  
  const backBtn = document.createElement('button');
  backBtn.className = 'phone-text-back';
  backBtn.innerHTML = '←';
  backBtn.onclick = closePhoneTextPopup;
  
  const contact = document.createElement('div');
  contact.className = 'phone-text-contact';
  const contactNameEl = document.createElement('h3');
  contactNameEl.className = 'phone-text-contact-name';
  contactNameEl.textContent = contactName;
  const contactStatusEl = document.createElement('p');
  contactStatusEl.className = 'phone-text-contact-status';
  contactStatusEl.textContent = contactStatus;
  contact.appendChild(contactNameEl);
  contact.appendChild(contactStatusEl);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'phone-text-close';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = closePhoneTextPopup;
  
  header.appendChild(backBtn);
  header.appendChild(contact);
  header.appendChild(closeBtn);

  // Create messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.className = 'phone-text-messages';
  phoneMessagesContainer = messagesContainer;
  
  // Load message history if it exists
  if (S.isSecretarySessionActive && S.secMessageHistory && S.secMessageHistory.length > 0) {
    S.secMessageHistory.forEach(msg => {
      loadMessageToPhonePopup(msg.message, msg.isUser, msg.timestamp);
    });
    // Scroll to bottom after loading all messages
    setTimeout(() => {
      if (phoneMessagesContainer) {
        phoneMessagesContainer.scrollTop = phoneMessagesContainer.scrollHeight;
      }
    }, 100);
  }

  // Create status bar (only show for secretary, hide for others)
  const statusBar = document.createElement('div');
  statusBar.className = 'phone-text-status';
  const statusText = document.createElement('div');
  statusText.className = 'phone-text-status-text';
  if (contactName === (S.secretary_name || 'Secretary') || contactName === 'Secretary') {
    statusText.textContent = `Relationship: ${S.secRel || 0}/100 | Trust: ${S.secTrust || 0}/100 | Risk: ${S.secRisk || 0}/100`;
  } else {
    statusText.textContent = '';
    statusBar.style.display = 'none';
  }
  statusBar.appendChild(statusText);

  // Create choice container (for buttons) - now separate panel on the right
  const choiceContainer = document.createElement('div');
  choiceContainer.className = 'phone-choice-container';
  choiceContainer.id = 'phone-choice-container';
  choiceContainer.style.display = 'none';

  // Assemble phone container
  container.appendChild(header);
  container.appendChild(messagesContainer);
  container.appendChild(statusBar);
  
  // Add both phone and choice container to overlay (side by side)
  overlay.appendChild(container);
  overlay.appendChild(choiceContainer);
  
  document.body.appendChild(overlay);
  phoneTextPopup = overlay;

  // Close on overlay click (but not on container click)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closePhoneTextPopup();
    }
  });

  return overlay;
}

function closePhoneTextPopup() {
  if (phoneTextPopup) {
    phoneTextPopup.remove();
    phoneTextPopup = null;
    phoneMessagesContainer = null;
    try {
      if (typeof S !== 'undefined') {
        S.isSecretarySessionActive = false;
      }
    } catch (_e) {}
  }
}

// Load message from history (doesn't save to history)
function loadMessageToPhonePopup(message, isUser = false, timestamp = null) {
  if (!phoneMessagesContainer) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `phone-message ${isUser ? 'user' : 'secretary'}`;
  
  const bubble = document.createElement('div');
  bubble.className = 'phone-message-bubble';
  
  // Check if message contains HTML tags (like images)
  if (message.includes('<img') || message.includes('</') || /<[a-z][\s\S]*>/i.test(message)) {
    bubble.innerHTML = message;
  } else {
    bubble.textContent = message;
  }
  
  const time = document.createElement('div');
  time.className = 'phone-message-time';
  // Use timestamp from history if available, otherwise use current time
  const msgDate = timestamp ? new Date(timestamp) : new Date();
  time.textContent = `${msgDate.getHours().toString().padStart(2, '0')}:${msgDate.getMinutes().toString().padStart(2, '0')}`;
  
  messageDiv.appendChild(bubble);
  messageDiv.appendChild(time);
  
  phoneMessagesContainer.appendChild(messageDiv);
}

function addMessageToPhonePopup(message, isUser = false, delay = 0) {
  if (!phoneMessagesContainer) return;

  setTimeout(() => {
    // the popup may have been closed (container cleared) while this message was delayed
    if (!phoneMessagesContainer) return;
    const timestamp = Date.now();
    if (typeof S !== 'undefined' && S.isSecretarySessionActive) {
      // Save message to secretary history for persistence first
      if (!S.secMessageHistory) S.secMessageHistory = [];
      
      // Check history for duplicates before saving (check last 3 messages within 3 seconds)
      const recentHistory = S.secMessageHistory.slice(-3);
      const isInHistory = recentHistory.some(msg => 
        msg.message === message && 
        msg.isUser === isUser && 
        (timestamp - msg.timestamp) < 3000 // Within 3 seconds
      );
      
      // If already in history very recently, don't add again (likely a duplicate call)
      if (isInHistory) {
        return;
      }
    }
    
    // Check if this exact message was already displayed in the container (check last 3 messages)
    const recentMessages = phoneMessagesContainer.querySelectorAll('.phone-message');
    let isDuplicate = false;
    
    if (recentMessages.length > 0) {
      // Check last 3 messages for duplicates
      const checkCount = Math.min(3, recentMessages.length);
      for (let i = recentMessages.length - 1; i >= recentMessages.length - checkCount; i--) {
        const msgBubble = recentMessages[i].querySelector('.phone-message-bubble');
        if (msgBubble) {
          const existingIsUser = recentMessages[i].classList.contains('user');
          // For HTML content (like images), compare innerHTML; for text, compare textContent
          let existingText = '';
          if (message.includes('<img') || message.includes('</') || /<[a-z][\s\S]*>/i.test(message)) {
            existingText = msgBubble.innerHTML || '';
          } else {
            existingText = msgBubble.textContent || '';
          }
          // Normalize whitespace for comparison
          const normalizedExisting = existingText.replace(/\s+/g, ' ').trim();
          const normalizedMessage = message.replace(/\s+/g, ' ').trim();
          // Check if message content and sender match exactly
          if (normalizedExisting === normalizedMessage && existingIsUser === isUser) {
            isDuplicate = true;
            break;
          }
        }
      }
    }
    
    // If duplicate found in container, don't add it again
    if (isDuplicate) {
      return;
    }
    
    if (typeof S !== 'undefined' && S.isSecretarySessionActive) {
      // Save to secretary history
      S.secMessageHistory.push({
        message: message,
        isUser: isUser,
        timestamp: timestamp
      });
      // Keep only last 100 messages to prevent memory issues
      if (S.secMessageHistory.length > 100) {
        S.secMessageHistory.shift();
      }
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `phone-message ${isUser ? 'user' : 'secretary'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'phone-message-bubble';
    
    // Check if message contains HTML tags (like images)
    if (message.includes('<img') || message.includes('</') || /<[a-z][\s\S]*>/i.test(message)) {
      bubble.innerHTML = message;
    } else {
      bubble.textContent = message;
    }
    
    const time = document.createElement('div');
    time.className = 'phone-message-time';
    const timeDate = new Date();
    time.textContent = `${timeDate.getHours().toString().padStart(2, '0')}:${timeDate.getMinutes().toString().padStart(2, '0')}`;
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    
    phoneMessagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    phoneMessagesContainer.scrollTop = phoneMessagesContainer.scrollHeight;
  }, delay);
}

function showTypingIndicator() {
  if (!phoneMessagesContainer) return;
  
  // Remove any existing typing indicator
  const existing = phoneMessagesContainer.querySelector('.phone-typing-indicator');
  if (existing) existing.remove();
  
  const typingDiv = document.createElement('div');
  typingDiv.className = 'phone-message secretary';
  const indicator = document.createElement('div');
  indicator.className = 'phone-typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  typingDiv.appendChild(indicator);
  
  phoneMessagesContainer.appendChild(typingDiv);
  phoneMessagesContainer.scrollTop = phoneMessagesContainer.scrollHeight;
  
  return typingDiv;
}

function hideTypingIndicator() {
  if (!phoneMessagesContainer) return;
  const typing = phoneMessagesContainer.querySelector('.phone-typing-indicator');
  if (typing) {
    typing.closest('.phone-message').remove();
  }
}

function updatePhoneStatusBar() {
  if (!phoneTextPopup) return;
  const statusText = phoneTextPopup.querySelector('.phone-text-status-text');
  if (statusText) {
    statusText.textContent = `Relationship: ${S.secRel}/100 | Trust: ${S.secTrust}/100 | Risk: ${S.secRisk}/100`;
  }
}

// Phone-specific choice function - displays buttons in the phone popup
function chooseInPhone(opts, prompt = 'Choose:') {
  return new Promise((resolve, reject) => {
    try {
      const choiceContainer = document.getElementById('phone-choice-container');
      if (!choiceContainer) {
        reject(new Error('Phone choice container not found'));
        return;
      }

      // Clear previous choices
      choiceContainer.innerHTML = '';
      
      // Show the container
      choiceContainer.style.display = 'block';

      // Add prompt
      const promptEl = document.createElement('div');
      promptEl.className = 'phone-choice-prompt';
      promptEl.textContent = prompt;
      choiceContainer.appendChild(promptEl);

      // Create buttons container
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'phone-choice-buttons';

      // Create buttons for each option
      opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'phone-choice-btn';
        if (opt.variant) {
          btn.classList.add(opt.variant);
        }
        btn.textContent = opt.label || opt.key;
        btn.onclick = () => {
          // Hide choice container
          choiceContainer.style.display = 'none';
          choiceContainer.innerHTML = '';
          resolve(opt.key);
        };
        buttonsContainer.appendChild(btn);
      });

      choiceContainer.appendChild(buttonsContainer);

      // Scroll choice container into view
      setTimeout(() => {
        choiceContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (e) {
      console.error('chooseInPhone error:', e);
      reject(e);
    }
  });
}

// Main secretary messaging function – uses the same on-phone UI layout as other contacts,
// but keeps the dedicated secretary logic and safety rules.
async function openSecretaryMessaging() {
  if (!S.secretary_hired) {
    log("You don't have a secretary to text.");
    return;
  }

  window.S = window.S || {};

  // Flag this as a secretary-specific session so shared helpers can branch if needed
  S.isSecretarySessionActive = true;

  // Start a fresh "session" each time you open the conversation
  S.secSessionMessageCount = 0;
  S.secQuickSessionCount = 0;

  // Create and show the standard phone popup UI
  createPhoneTextPopup(S.secretary_name || 'Your secretary', 'Secretary');

  const msg = phoneMessagesContainer;
  const choice = document.getElementById('phone-choice-container');

  // Optional intro bubble – keeps things visually consistent with other chats
  if (msg) {
    msg.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'phone-text-message phone-text-received';
    intro.innerHTML = `<div class="phone-text-bubble">How do you want to text ${S.secretary_name || 'your secretary'}?</div>`;
    msg.appendChild(intro);
  }

  log(`📱 Opening messages with ${S.secretary_name || 'your secretary'} (Secretary)...`);
  log(`Current relationship: ${S.secRel}/100, Trust: ${S.secTrust}/100, Risk: ${S.secRisk}/100`);

  function renderSecretaryChoices() {
    if (!choice) return;

    choice.style.display = 'flex';
    choice.style.flexDirection = 'column';
    choice.style.gap = '6px';
    choice.innerHTML = '';
    // 087s: her unread texts, and an answer button when one of them wants a reply
    if (window.KSys && KSys.secretaryThreadButton) setTimeout(() => KSys.secretaryThreadButton(choice, renderSecretaryChoices), 0);

    // --- Three‑part builder on top (to match your preference) ---
    const btnBuilder = document.createElement('button');
    btnBuilder.className = 'btn-secondary';
    btnBuilder.textContent = '📝 Three-part message builder';
    btnBuilder.onclick = async () => {
      try {
        await composeSecretaryMessage();
      } catch (error) {
        log(`Error in secretary messaging: ${error.message}`);
        if (phoneMessagesContainer) {
          addMessageToPhonePopup(`Error: ${error.message}`, false, 200);
        }
      }
      renderSecretaryChoices();
    };
    choice.appendChild(btnBuilder);

    // --- One‑liner buttons in the same visual style as other contacts ---
    const oneLinerOptions = [
      { key: 'professional', label: '💼 Professional (one-liner)' },
      { key: 'social', label: '😊 Social (one-liner)' },
      { key: 'football', label: '⚽ Football (one-liner)' },
      { key: 'ellipses', label: '… Ellipses (one-liner)' },
      { key: 'flirtatious', label: '😘 Flirtatious (one-liner)' },
      { key: 'erotic', label: '🔥 Erotic (one-liner)' }
    ];

    oneLinerOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = opt.label;
      btn.onclick = async () => {
        try {
          await composeSecretaryOneLiner(opt.key);
        } catch (error) {
          log(`Error in secretary one-liner messaging: ${error.message}`);
          if (phoneMessagesContainer) {
            addMessageToPhonePopup(`Error: ${error.message}`, false, 200);
          }
        }
        renderSecretaryChoices();
      };
      choice.appendChild(btn);
    });

    // Back button at the bottom, just like other contacts
    const btnBack = document.createElement('button');
    btnBack.className = 'btn-secondary';
    btnBack.textContent = 'Back';
    btnBack.onclick = () => { openPhoneContacts(); };
    choice.appendChild(btnBack);
  }

  renderSecretaryChoices();
}

function showSecretaryStatus() {
  log(`📊 Secretary Relationship Status:`);
  log(`💕 Relationship: ${S.secRel}/100`);
  log(`🤝 Trust: ${S.secTrust}/100`);
  log(`⚠️ Risk: ${S.secRisk}/100`);
  log(`📈 Message counts: Professional: ${S.secMessageCounts.professional}, Social: ${S.secMessageCounts.social}, Football: ${S.secMessageCounts.football}, Ellipses: ${S.secMessageCounts.ellipses}, Flirtatious: ${S.secMessageCounts.flirtatious}, Erotic: ${S.secMessageCounts.erotic}`);
  
  // Show available categories
  const availableCategories = ['Professional', 'Social', 'Football', 'Ellipses', 'Flirtatious', 'Erotic'];
  
  log(`✅ Available categories: ${availableCategories.join(', ')}`);
}


async function composeSecretaryMessage() {
  // Check if we're starting a new thread or continuing an existing one
  if (!S.secThreadActive) {
    S.secThreadActive = true;
    S.secThreadStep = 0;
    S.secBoundaryStrikesThread = 0;
    log(`📱 Starting new message thread with ${S.secretary_name}`);
  }
  
  // Three-part message composition like seduction dialog
  log(`📱 SECRETARY MESSAGE BUILDER: Constructing your message to ${S.secretary_name}`);
  
  const categoryOptions = [
    {key: 'professional', label: 'Professional'},
    {key: 'social', label: 'Social'},
    {key: 'football', label: 'Football'},
    {key: 'ellipses', label: 'Ellipses (...)'},
    {key: 'flirtatious', label: 'Flirtatious'},
    {key: 'erotic', label: 'Erotic (spicy, non-graphic)'}
  ];
  
  const setupCategory = await chooseInPhone(
    categoryOptions.map(cat => ({key: cat.key, label: `[PART 1] ${cat.key.charAt(0).toUpperCase() + cat.key.slice(1)}`})),
    '📱 PART 1: Choose your setup category:'
  );
  
  const pivotCategory = await chooseInPhone(
    categoryOptions.map(cat => ({key: cat.key, label: `[PART 2] ${cat.key.charAt(0).toUpperCase() + cat.key.slice(1)}`})),
    '📱 PART 2: Choose your pivot category:'
  );
  
  const signoffCategory = await chooseInPhone(
    categoryOptions.map(cat => ({key: cat.key, label: `[PART 3] ${cat.key.charAt(0).toUpperCase() + cat.key.slice(1)}`})),
    '📱 PART 3: Choose your signoff category:'
  );
  
  // Build the message with visual feedback
  const setupQuotes = SECRETARY_QUOTES[setupCategory];
  const pivotQuotes = SECRETARY_QUOTES[pivotCategory];
  const signoffQuotes = SECRETARY_QUOTES[signoffCategory];
  
  // Add explicit content if enabled and appropriate
  let availableSetupQuotes = setupQuotes;
  let availablePivotQuotes = pivotQuotes;
  let availableSignoffQuotes = signoffQuotes;
  
  if (setupCategory === 'erotic' && SECRETARY_CONFIG.allowExplicit) {
    availableSetupQuotes = {
      setups: [...setupQuotes.setups, ...EXPLICIT_EROTIC_LOCAL]
    };
  }
  if (pivotCategory === 'erotic' && SECRETARY_CONFIG.allowExplicit) {
    availablePivotQuotes = {
      pivots: [...pivotQuotes.pivots, ...EXPLICIT_EROTIC_LOCAL]
    };
  }
  if (signoffCategory === 'erotic' && SECRETARY_CONFIG.allowExplicit) {
    availableSignoffQuotes = {
      signoffs: [...signoffQuotes.signoffs, ...EXPLICIT_EROTIC_LOCAL]
    };
  }
  
  // Randomly select quotes from chosen categories (no user choice of actual quotes)
  const setupIndex = Math.floor(Math.random() * availableSetupQuotes.setups.length);
  const selectedSetup = availableSetupQuotes.setups[setupIndex];
  
  const pivotIndex = Math.floor(Math.random() * availablePivotQuotes.pivots.length);
  const selectedPivot = availablePivotQuotes.pivots[pivotIndex];
  
  const signoffIndex = Math.floor(Math.random() * availableSignoffQuotes.signoffs.length);
  const selectedSignoff = availableSignoffQuotes.signoffs[signoffIndex];
  
  const message = `${selectedSetup} ${selectedPivot} ${selectedSignoff}`;
  
  log(`📱 FINAL MESSAGE: "${message}"`);
  
  // Choose attachment
  const attachment = await chooseInPhone([
    {key: 'none', label: 'No attachment'},
    {key: 'emoji', label: 'Add emoji'},
    {key: 'meme', label: 'Add meme'},
    {key: 'cute', label: 'Add cute animal picture'},
    {key: 'inappropriate', label: 'Add inappropriate picture'},
    {key: 'raunchy_video', label: 'Send a Raunchy Video'}
  ], 'Add attachment?');
  
  let attachmentText = '';
  if (attachment !== 'none') {
    attachmentText = await selectAttachment(attachment, setupCategory);
  }
  
  // Send message
  const fullMessage = message + (attachmentText ? ` ${attachmentText}` : '');
  log(`📤 Sending: "${fullMessage}"`);
  
  // Show user's message in phone popup
  if (phoneMessagesContainer) {
    addMessageToPhonePopup(fullMessage, true, 200);
    // Show typing indicator before secretary responds
    showTypingIndicator();
  }
  
  // Process response and update stats - use the primary category for tracking
  const primaryCategory = setupCategory; // Use setup category as primary for message counting
  await processSecretaryResponse(primaryCategory, attachment, fullMessage);
  
  // Update session and thread state
  S.secThreadStep++;
  
  // If a thread runs long, softly reset so a fresh three‑parter feels like a new exchange.
  if (S.secThreadStep >= 2) {
    // Thread complete but session continues
    log(`📱 Thread complete. Starting new thread.`);
    S.secThreadActive = false;
    S.secThreadStep = 0;
    S.secBoundaryStrikesThread = 0;
  }
}

// Compose a single-part (one-liner) message to the secretary using existing quote banks
async function composeSecretaryOneLiner(categoryKey) {
  // Guard against bad category keys
  if (!SECRETARY_QUOTES || !SECRETARY_QUOTES[categoryKey]) {
    log('📱 Invalid secretary message category.');
    return;
  }

 // Check session limit first (max 6 messages per session total)
 if (S.secSessionMessageCount >= 6) {
   const limitMsg = `📱 Session limit reached. You can only send 6 messages per conversation.`;
    log(limitMsg);
    if (phoneMessagesContainer) {
     addMessageToPhonePopup("You've reached the 6-message limit for this conversation.", false, 200);
    }
    return;
  }

 // Enforce a soft per‑session limit for quick one‑liners (builder messages are unlimited)
 if (S.secQuickSessionCount >= 6) {
   const limitMsg = `📱 Session limit reached. You can only send 6 quick one-liner messages per conversation.`;
    log(limitMsg);
    if (phoneMessagesContainer) {
     addMessageToPhonePopup("You've reached the 6-message limit for quick replies this conversation.", false, 200);
    }
    return;
  }

  // Thread bookkeeping mirrors the builder
  if (!S.secThreadActive) {
    S.secThreadActive = true;
    S.secThreadStep = 0;
    S.secBoundaryStrikesThread = 0;
    log(`📱 Starting new one-liner thread with ${S.secretary_name}`);
  }

  const bank = SECRETARY_QUOTES[categoryKey];

  // Build a pool from all three segments so we reuse existing secretary lines
  let pool = [
    ...(bank.setups || []),
    ...(bank.pivots || []),
    ...(bank.signoffs || [])
  ];

  // Optionally extend erotic pool with explicit local lines (if enabled)
  if (categoryKey === 'erotic' && SECRETARY_CONFIG.allowExplicit && Array.isArray(EXPLICIT_EROTIC_LOCAL)) {
    pool = pool.concat(EXPLICIT_EROTIC_LOCAL);
  }

  if (!pool.length) {
    log('📱 No quotes available for this category.');
    return;
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  const baseMessage = selected;

  log(`📱 ONE-LINER: "${baseMessage}"`);

  // Attachment flow, same options as the builder
  const attachment = await chooseInPhone([
    { key: 'none', label: 'No attachment' },
    { key: 'emoji', label: 'Add emoji' },
    { key: 'meme', label: 'Add meme' },
    { key: 'cute', label: 'Add cute animal picture' },
    { key: 'inappropriate', label: 'Add inappropriate picture' },
    { key: 'raunchy_video', label: 'Send a Raunchy Video' }
  ], 'Add attachment?');

  let attachmentText = '';
  if (attachment !== 'none') {
    attachmentText = await selectAttachment(attachment, categoryKey);
  }

  const fullMessage = baseMessage + (attachmentText ? ` ${attachmentText}` : '');
  log(`📤 Sending one-liner: "${fullMessage}"`);

  // Show user's message in phone popup
  if (phoneMessagesContainer) {
    addMessageToPhonePopup(fullMessage, true, 200);
    // Show typing indicator before secretary responds
    showTypingIndicator();
  }

  // Process response and update stats – use the chosen category as primary
  await processSecretaryResponse(categoryKey, attachment, fullMessage);

  // Update session and thread state – only one‑liners count against the quick‑text cap
  S.secQuickSessionCount = (S.secQuickSessionCount || 0) + 1;
  S.secThreadStep++;

  if (S.secQuickSessionCount >= 2) {
    log(`📱 Quick-text session complete. You've reached the 2-message limit for one-liners.`);
    S.secThreadActive = false;
    S.secThreadStep = 0;
    S.secBoundaryStrikesThread = 0;
  } else if (S.secThreadStep >= 2) {
    // Thread complete but session continues
    log(`📱 Thread complete. Starting new thread.`);
    S.secThreadActive = false;
    S.secThreadStep = 0;
    S.secBoundaryStrikesThread = 0;
  }
}

async function selectAttachment(type, category) {
  switch (type) {
    case 'emoji':
      const emoji = ATTACHMENTS.emoji[Math.floor(Math.random() * ATTACHMENTS.emoji.length)];
      return emoji.emoji;
      
    case 'meme':
      const meme = ATTACHMENTS.meme[Math.floor(Math.random() * ATTACHMENTS.meme.length)];
      return meme; // Return HTML image tag directly
      
    case 'cute':
      const cute = ATTACHMENTS.cuteAnimals[Math.floor(Math.random() * ATTACHMENTS.cuteAnimals.length)];
      return cute; // Return HTML image tag directly
      
    case 'inappropriate':
      const inappropriate = ATTACHMENTS.inappropriate[Math.floor(Math.random() * ATTACHMENTS.inappropriate.length)];
      return inappropriate; // Return HTML image tag directly
      
    case 'raunchy_video':
      // Randomly select one of the video URLs
      const raunchyVideos = [
        'https://www.dropbox.com/scl/fi/j33a1c1jxzzeb438m6utd/Video-1-7-26-4-16-25-pm-2.mp4?rlkey=9cw8vxxm3xbr4c9j45n0iiayx&st=3x5ry2kl&dl=1',
        'https://www.dropbox.com/scl/fi/osne24v2558zclbp3ofcx/Video-1-7-26-4-16-25-pm-1.mp4?rlkey=rd77cc3xzldv3marj651ct11f&st=lzauh41s&dl=1',
        'https://www.dropbox.com/scl/fi/pgtanci70jfiweun99suk/Video-1-7-26-4-16-25-pm-1-1.mp4?rlkey=g1ln72d29tb91rmtsz9n8v08a&st=ctc89v0e&dl=1',
        'https://www.dropbox.com/scl/fi/bkvxd6cc1eb877gdv69hs/Video-1-7-26-4-16-25-pm.mp4?rlkey=pdnvw0qgqbymuk1sjpditdq3z&st=lvdo82xa&dl=1',
        'https://www.dropbox.com/scl/fi/4fisr3igjf4c1dqvupr6v/Video-1-7-26-4-45-22-pm.mp4?rlkey=6f7ahfp8bh7zjer9n49t57ft6&st=c8xw7yl9&dl=1'
      ];
      const selectedVideo = raunchyVideos[Math.floor(Math.random() * raunchyVideos.length)];
      const videoType = selectedVideo.includes('.mov') ? 'video/quicktime' : 'video/mp4';
      return `<video controls style="max-width: 100%; border-radius: 8px;"><source src="${selectedVideo}" type="${videoType}">Your browser does not support the video tag.</video>`;
      
    default:
      return '';
  }
}

// Check for boundary violations in secretary messaging
function checkBoundaryViolation(category, attachment) {
  const violation = {
    isViolation: false,
    severity: 0,
    reason: '',
    trustPenalty: 0,
    riskIncrease: 0
  };
  
  // Check flirtatious messages below trust threshold
  if (category === 'flirtatious' && (S.secRel < 40 || S.secTrust < 30)) {
    violation.isViolation = true;
    violation.severity = 1;
    violation.reason = 'Flirtatious message sent below trust threshold';
    violation.trustPenalty = 5;
    violation.riskIncrease = 8;
  }
  
  // Check erotic messages below high trust gate
  if (category === 'erotic' && (S.secRel < 70 || S.secTrust < 60)) {
    violation.isViolation = true;
    violation.severity = 2;
    violation.reason = 'Erotic message sent below high trust gate';
    violation.trustPenalty = 7;
    violation.riskIncrease = 12;
  }
  
  // Check inappropriate pictures below gate
  if (attachment === 'inappropriate' && S.secTrust < 50) {
    violation.isViolation = true;
    violation.severity = 3;
    violation.reason = 'Inappropriate picture sent below trust gate';
    violation.trustPenalty = 10;
    violation.riskIncrease = 15;
  }
  
  return violation;
}

// Handle boundary violations and track strikes
async function handleBoundaryViolation(violation) {
  // Increment boundary strikes for this thread
  S.secBoundaryStrikesThread++;
  
  // Apply penalties
  S.secTrust = Math.max(0, S.secTrust - violation.trustPenalty);
  S.secRisk = Math.min(100, S.secRisk + violation.riskIncrease);
  
  log(`🚨 BOUNDARY VIOLATION: ${violation.reason}`);
  log(`📊 Trust: -${violation.trustPenalty}, Risk: +${violation.riskIncrease}`);
  log(`⚠️ Boundary strikes this thread: ${S.secBoundaryStrikesThread}/2`);
  
  // Check if this is the second strike in the same thread
  if (S.secBoundaryStrikesThread >= 2) {
    log(`🚨 SECOND BOUNDARY VIOLATION! ${S.secretary_name || 'Your secretary'} is calling the police...`);
    await triggerSecretaryPoliceArrest();
    return;
  }
  
  // Get secretary's boundary response
  const boundaryResponses = [
    "Please keep this professional.",
    "I need you to respect boundaries.",
    "This is inappropriate for work.",
    "I'm not comfortable with this.",
    "Please stop sending messages like this."
  ];
  
  const response = boundaryResponses[Math.floor(Math.random() * boundaryResponses.length)];
  log(`📱 ${S.secretary_name || 'Secretary'} (Secretary): "${response}"`);
  
  // Show boundary violation response in phone popup
  if (phoneMessagesContainer) {
    hideTypingIndicator();
    await new Promise(resolve => setTimeout(resolve, 1000));
    addMessageToPhonePopup(response, false, 0);
    updatePhoneStatusBar();
  }
}

// Trigger police arrest for harassment
async function triggerSecretaryPoliceArrest() {
  // Show final message in phone popup if open
  if (phoneMessagesContainer) {
    hideTypingIndicator();
    await new Promise(resolve => setTimeout(resolve, 1500));
    addMessageToPhonePopup("I've called the police. This conversation is over.", false, 0);
    await new Promise(resolve => setTimeout(resolve, 2000));
    closePhoneTextPopup();
  }
  
  log(`🚔 The police arrive at your office. You're being arrested for harassment via messages.`);
  
  // Store the actual messages sent for evidence in trial
  S._harassment_evidence = S._harassment_evidence || [];
  S._harassment_evidence.push({
    message: S._last_secretary_message || "inappropriate message",
    attachment: S._last_secretary_attachment || "inappropriate attachment",
    timestamp: new Date().toISOString()
  });
  
  // Queue police investigation using the existing system (avoid duplication)
  if (!S._pending_police_investigation && !S._police_interview_in_progress) {
    S._pending_police_investigation = { 
      authority: 'police', 
      caseType: 'harassment_via_messages',
      description: 'Inappropriate messages sent to secretary'
    };
  }
  
  // Reset thread state
  S.secThreadActive = false;
  S.secThreadStep = 0;
  S.secBoundaryStrikesThread = 0;
}

// Place player on THE KRAZY REGISTER
function placeOnKrazyRegister(severity = 1) {
  // Ensure function is accessible globally
  if (typeof window !== 'undefined') {
    window.placeOnKrazyRegister = placeOnKrazyRegister;
  }
  const krazyGames = Math.floor(Math.random() * (KRAZY_GAMES_MAX - KRAZY_GAMES_MIN + 1)) + KRAZY_GAMES_MIN;
  
  S.onKrazyRegister = true;
  S.krazyGamesRemaining = krazyGames;
  
  // Award achievement
  if (typeof window.achievements !== 'undefined') {
    window.achievements.add({
      id: 'became_krazy',
      title: 'Became KRAZY',
      description: 'Placed on THE KRAZY REGISTER for inappropriate conduct',
      icon: '🚨'
    });
  }
  
  log(`🚨 You have been placed on THE KRAZY REGISTER for ${krazyGames} matches!`);
  log(`Your name will be tagged as "KRAZY" in all logs and opposing fans will chant about it.`);
  
  // Trigger manager confrontation
  triggerKrazyManagerConfrontation();
  
  // Trigger team fallout
  triggerKrazyTeamFallout();
  
  // Queue press coverage
  queueKrazyPressCoverage();
}

// Trigger manager confrontation for KRAZY register
function triggerKrazyManagerConfrontation() {
  const managerName = (S?.manager && S.manager.name) ? S.manager.name : 'Your Manager';
  
  log(`🚪 ${managerName} storms into your office.`);
  log(`"I am absolutely disgusted with you! You've humiliated this club beyond belief!"`);
  log(`"Sponsors are pulling out, the press is having a field day, and I can't work under this cloud of scandal!"`);
  log(`"We're short on players now because of this mess - you'll need to buy more to replace the ones who've left!"`);
  log(`"Fix this situation or I'm resigning immediately!"`);
  
  // Apply massive relationship hit
  S.manager_relationship = Math.max(0, (S.manager_relationship || 50) - 40);
  
  // Apply massive morale hit
  S.morale = Math.max(0, (S.morale || 50) - 30);
  
  // Potential wage penalty
  if (Math.random() < 0.5) {
    const wagePenalty = Math.floor((S.wage || 100000) * 0.15);
    S.wage = Math.max(50000, (S.wage || 100000) - wagePenalty);
    log(`💰 Your wage has been reduced by ${money(wagePenalty)} due to the scandal.`);
  }
}

// Trigger team fallout for KRAZY register
function triggerKrazyTeamFallout() {
  const quitCount = Math.floor(Math.random() * 4) + 2; // 2-5 players (increased from 1-3)
  const availablePlayers = S.squad.filter(p => !S.lineup.includes(p.id)); // Fringe players first
  
  if (availablePlayers.length === 0) {
    // If no fringe players, pick low-loyalty seniors
    availablePlayers.push(...S.squad.filter(p => S.lineup.includes(p.id)).slice(0, 5));
  }
  
  const quittingPlayers = availablePlayers.slice(0, quitCount);
  
  if (quittingPlayers.length > 0) {
    log(`📰 BREAKING: ${quittingPlayers.length} player(s) request immediate transfer due to the scandal:`);
    quittingPlayers.forEach(player => {
      log(`  • ${player.name} - "I can't play for someone on THE SEX OFFENDERS REGISTER"`);
      // Remove from squad
      S.squad = S.squad.filter(p => p.id !== player.id);
      S.lineup = S.lineup.filter(id => id !== player.id);
    });
    
    // Apply massive morale penalties
    S.morale = Math.max(-100, (S.morale || 50) - 25);
    log(`📉 Team morale plummets due to player departures. The dressing room is in chaos.`);
    
    // Add transfer request flag to encourage buying new players
    S._needs_players_after_scandal = true;
  }
}

// Queue press coverage for KRAZY register
function queueKrazyPressCoverage() {
  const stories = [
    {
      id: 'krazy_register_sentencing',
      title: 'Chairman Placed on THE SEX OFFENDERS REGISTER',
      content: 'In a shocking development, the chairman has been placed on THE SEX OFFENDERS REGISTER following inappropriate conduct with his "saucy Secretary". The football world is in uproar.',
      section: 'scandal',
      priority: 'high'
    },
    {
      id: 'krazy_register_first_match',
      title: 'KRAZY Chairman Faces Crowd Chants',
      content: 'Opposing fans made their feelings clear as the chairman appeared for the first time since being placed on THE SEX OFFENDERS REGISTER.',
      section: 'match',
      priority: 'medium'
    }
  ];
  
  stories.forEach(story => {
    if (typeof queueStory === 'function') {
      queueStory(story);
    }
  });
}

async function processSecretaryResponse(category, attachment, message) {
  // Store the message for potential evidence
  S._last_secretary_message = message;
  S._last_secretary_attachment = attachment;
  // 087s: sexts / pictures / texts sent high become evidence (she may screenshot them)
  if (window.KSys && KSys.onSecretarySent) { try { KSys.onSecretarySent(category, attachment, message); } catch (e) { console.error(e); } }
  
  // Award lobby tokens for inappropriate pictures/raunchy videos BEFORE boundary check
  // (Player still performed the action, so they should get tokens even if it triggers a violation)
  if (attachment === 'inappropriate') {
    addLobbyTokens(15, 'sending inappropriate picture');
    // Track inappropriate images sent for certificate
    if (!S.playerStats) S.playerStats = {};
    S.playerStats.inappropriateImagesSent = (S.playerStats.inappropriateImagesSent || 0) + 1;
  } else if (attachment === 'raunchy_video') {
    addLobbyTokens(20, 'sending raunchy video');
  }
  
  // Check for boundary violations first
  const boundaryViolation = checkBoundaryViolation(category, attachment);
  if (boundaryViolation.isViolation) {
    await handleBoundaryViolation(boundaryViolation);
    return; // Exit early if police are called
  }
  
  // Update message counts
  S.secMessageCounts[category]++;
  
  // Update timestamps
  if (category === 'erotic') {
    S.lastEroticTs = Date.now();
  }
  if (attachment !== 'none') {
    S.lastAttachmentType = attachment;
  }
  
  // Calculate score changes
  let relChange = 0, trustChange = 0, riskChange = 0;
  
  switch (category) {
    case 'professional':
      relChange = 2; trustChange = 3; riskChange = -1;
      break;
    case 'social':
      relChange = 2; trustChange = 1; riskChange = 0;
      break;
    case 'football':
      relChange = 1; trustChange = 0; riskChange = 0;
      // Bonus after wins
      if (S.wins > 0) relChange += 1;
      break;
    case 'ellipses':
      relChange = 1; trustChange = 0; riskChange = 0;
      break;
    case 'flirtatious':
      relChange = 3; trustChange = 2; riskChange = 0;
      break;
    case 'erotic':
      relChange = 4; trustChange = 3; riskChange = 1;
      break;
  }
  
  // Apply changes
  S.secRel = clamp(S.secRel + relChange, 0, 100);
  S.secTrust = clamp(S.secTrust + trustChange, 0, 100);
  S.secRisk = clamp(S.secRisk + riskChange, 0, 100);
  
  // Get secretary response – three-part line built from her own quote bank
  const response = getSecretaryResponse(category, S.secTrust, S.secRel, message);
  log(`📱 ${S.secretary_name || 'Secretary'} (Secretary): "${response}"`);
  
  // Show secretary's response in phone popup with typing indicator effect
  if (phoneMessagesContainer) {
    // Hide typing indicator
    hideTypingIndicator();
    // Wait a bit for realistic typing delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    // Show secretary's response
    addMessageToPhonePopup(response, false, 0);
    // Update status bar
    updatePhoneStatusBar();
  }
  
  // Log changes
  if (relChange !== 0 || trustChange !== 0 || riskChange !== 0) {
    log(`📊 Relationship: ${relChange > 0 ? '+' : ''}${relChange}, Trust: ${trustChange > 0 ? '+' : ''}${trustChange}, Risk: ${riskChange > 0 ? '+' : ''}${riskChange}`);
  }
  
  // Note: Lobby tokens for inappropriate pictures/raunchy videos are now awarded
  // at the start of the function (before boundary violation check) to ensure
  // they're always awarded when the action is performed

  // 087s: she answers back — a follow-up or two, gated on how she feels about you
  if (window.KSys && KSys.afterSecretaryText) { try { await KSys.afterSecretaryText(category, attachment, message); } catch (e) { console.error(e); } }
}

function getSecretaryResponse(category, trust, rel, lastMessage) {
  // Pick a reply category based on what you sent and how close you are.
  let replyCategory = 'professional_cool';

  const highRel = rel >= 70 && trust >= 60;
  const mediumRel = rel >= 45 && trust >= 40;

  switch (category) {
    case 'social':
    case 'football':
      replyCategory = mediumRel ? 'social_warm' : 'professional_cool';
      break;
    case 'ellipses':
      replyCategory = mediumRel ? 'social_warm' : 'professional_cool';
      break;
    case 'flirtatious':
      if (highRel) {
        replyCategory = 'flirt_playful';
      } else if (mediumRel) {
        replyCategory = 'flirt_shy';
      } else {
        replyCategory = 'gentle_pushback';
      }
      break;
    case 'erotic':
      if (highRel) {
        // Sometimes she sends a spicy "picture" back when things are strong.
        replyCategory = Math.random() < 0.5 ? 'erotic_spicy_pic' : 'erotic_soft';
      } else if (mediumRel) {
        replyCategory = 'gentle_pushback';
      } else {
        // Mirror-image negative reactions when relationship/trust are low.
        replyCategory = Math.random() < 0.5 ? 'boundary_disgust' : 'boundary_repelled';
      }
      break;
    default:
      // Professional messages stay mostly professional, but can soften with trust.
      replyCategory = mediumRel ? 'social_warm' : 'professional_cool';
      break;
  }

  const bank = SECRETARY_REPLY_QUOTES[replyCategory] || SECRETARY_REPLY_QUOTES.professional_cool;
  const pickPart = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const setup = pickPart(bank.setups);
  const pivot = pickPart(bank.pivots);
  const signoff = pickPart(bank.signoffs);

  return `${setup} ${pivot} ${signoff}`;
}

async function triggerSecretaryBoundaryViolation() {
  log("🚨 HR has been notified of inappropriate conduct.");
  S.secRisk = Math.min(S.secRisk + 20, 100);
  S.legal_risk = Math.min((S.legal_risk || 0) + 15, 100);
  
  // Chance of escalation
  if (Math.random() < 0.3) {
    log("📰 Press leak: 'Chairman accused of workplace harassment'");
    S.reputation = Math.max(S.reputation - 10, 0);
    addPaper('Workplace harassment complaint', 12);
  }
}

