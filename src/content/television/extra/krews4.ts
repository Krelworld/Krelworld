import { parseScreenplay, type TVEpisode } from "../../../game/systems/tv";

// "Krelmon" news stories, staged as GB Krews broadcasts on the same sets and presenters as krews3.ts (see
// src/game/scenes/tvnews/krews4Shows.ts for how each one is shot). The article wording is kept; where an article
// reports what someone said, they say it, and the newsreader carries the rest. Changes:
// - The Cuddle Cronster (KRELWORLD spelling) harasses the women of Krelford rather than a football club's women's
//   team; the club chairman's "no comment" is gone.
// - Starmer's Halloween costume is described but never shown (GB Krews "has chosen not to show" the photos).
// - "The Descent" (the age of consent): the cabinet room, the markets, the crowd and the hot mic as written, with
//   only adults anywhere on screen; Corbyn's text message is cut.
// - Kitchen Nightmares runs as an entertainment package: the clip as written, with the newsreader in and out.
// Not included: the Soprano household story (it's a scene from the show, not news: DRAMA_SOPRANOS in dramas.ts, which
// keeps the id krews_soprano) and "Rishi Sunak Makes Bizarre Reference to Penis" (already on air as drama_special_parts, "Rishi's Special Parts" on BBK One).

const NEWS = "GB KREWS 24";

const ep = (id: string, title: string, n: number, script: string): TVEpisode => ({
  id,
  channel: NEWS,
  show: "GB Krews",
  title,
  episodeNumber: n,
  beats: parseScreenplay(script),
});

const OPEN = (time: "DAY" | "NIGHT" = "DAY") => `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - ${time}
[MUSIC news fade]`;

export const KREWS_WALLACE = ep(
  "krews_wallace",
  "Starmer Defends Greg Wallace's Trouser Removal",
  34,
  `${OPEN()}
# STARMER: GREG WALLACE FIASCO "JUST A HUGE MISUNDERSTANDING"
NEWSREADER: In an extraordinary press conference outside Downing Street this morning, Prime Minister Keir Starmer described the ongoing Greg Wallace scandal as "possibly the biggest misunderstanding of all time."
NEWSREADER: He claimed the embattled TV personality's alleged misconduct was rooted in "noble, if poorly communicated, intentions."
NEWSREADER: Wallace, best known as the former MasterChef co-host and now Minister for Banter and Pulses in Starmer's controversial "Wetherspoons Cabinet," has faced mounting accusations of indecent conduct.
NEWSREADER: They include a now-notorious incident in which he reportedly removed his trousers during a first date. Starmer offered a spirited defence.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET · THE PRIME MINISTER
KEIR STARMER: Greg only took his trousers off because he was incredibly moved to hear of the plight of people in Africa.
KEIR STARMER: His date had mentioned the situation over there, and Greg, being the man of action that he is, spontaneously decided to donate his trousers to the starving.
KEIR STARMER: It's a gesture of compassion that has unfortunately been misconstrued.
JOURNALIST: Prime Minister! The Times. It's alleged Mr Wallace once asked a female colleague, "Would you like to eat Eton Mess off of my Willy?"
KEIR STARMER: Willy is the name of Greg's son. He was offering pudding. That's all.
JOURNALIST (confused): Sorry, Prime Minister, how does that make sense in context?
KEIR STARMER: Are you into kids or something?
REPORTER: Channel 4 News. Prime Minister, Mr Wallace then clarified, "I meant off of my penis."
KEIR STARMER: Penis is the name of his other son. And by the way, he's very disabled. So shame on you.
[GASP]
JOURNALIST: Prime Minister, over fifty women have made complaints with near-identical descriptions of Mr Wallace's behaviour.
KEIR STARMER (scoffing): They knew what to expect. There've been rumours about Greg for decades.
(An audible murmur of confusion runs through the press.)
KEIR STARMER (raising his voice): You people are trying to take the shine off of my brand-new Wetherspoons Cabinet, the first government in history to be formed entirely in pubs. You should be celebrating that.
(He hurls a brick into the crowd.)
[SFX smash]
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: This apparent contradiction, after minutes earlier declaring the events a misunderstanding, sparked an audible murmur of confusion among the press.
NEWSREADER: The Prime Minister then hurled a brick into the crowd, striking a female journalist from Sky News directly in the face, before storming back inside Number 10.
NEWSREADER: Greg Wallace remains Minister for Banter and Pulses.
[FADE]
`,
);

export const KREWS_CRONSTER = ep(
  "krews_cronster",
  "The Cuddle Cronster: Fibromyalgia, and Burgers",
  35,
  `${OPEN()}
# PART ONE: THE CRONSTER'S DIAGNOSIS
NEWSREADER: The Cuddle Cronster, the figure at the centre of an ongoing harassment investigation targeting the women of Krelford, has made a public announcement regarding his health and identity.
NEWSREADER: In a statement released through his representatives this morning, the Cronster revealed that he suffers from fibromyalgia and identifies as neurodivergent.
INT. CRONSTER STATEMENT GRAPHIC
NEWSREADER: "I want the public to understand that I am not a monster," the statement reads. "I am a person with invisible disabilities who has struggled with chronic pain and neurological differences my entire life."
NEWSREADER: "The oppression that neurodiverse people with invisible disabilities face is real, and I am a victim of systemic prejudice."
INT. NEWSDESK - DAY
NEWSREADER: The announcement has sparked immediate controversy, particularly after Labour leader Sir Keir Starmer weighed in with what critics have described as a "baffling and tone-deaf" response.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: WESTMINSTER · LABOUR PRESS BRIEFING
KEIR STARMER: The Cronster is now a much more sympathetic and understandable character due to his PTSD from the oppression that neurodiverse people with invisible disabilities have suffered.
KEIR STARMER: We must approach this situation with compassion and understanding.
REPORTER: Mr Starmer! What about the harassment allegations? What about the safety of the women he's targeting?
KEIR STARMER: I think we need to be more understanding. These are complex issues, and we can't simply dismiss someone's lived experience because of allegations.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: The comments drew immediate condemnation from women's rights organisations and disability advocacy groups, who accused Starmer of conflating legitimate disability concerns with predatory behaviour.
INT. ADVOCACY STUDY - DAY
ADVOCACY SPOKESPERSON: This is an insult to people who actually suffer from fibromyalgia and neurodivergence.
ADVOCACY SPOKESPERSON: The Cronster's behaviour is criminal harassment. His claimed diagnoses do not excuse or explain his actions.
INT. NEWSDESK - DAY
NEWSREADER: Meanwhile, a bizarre development has emerged: a sect of female fans calling themselves "Cronny's Juice Bunnies" has begun appearing at public events related to the case.
EXT. WESTMINSTER - DAY
REPORTER: The group, which reportedly numbers in the dozens, has described themselves as "supporters of the Cronster who actively seek to have the juice squeezed out of them."
REPORTER: Their public statements have been met with widespread disgust and disbelief.
JUICE BUNNY: We understand him. He's misunderstood.
JUICE BUNNY (swooning): We volunteer ourselves for his affections.
REPORTER: Police have warned the group to stay away from the Cronster's known haunts, and have increased security measures. The Cronster remains at large. The investigation continues.
INT. NEWSDESK - NIGHT
# PART TWO: "BETTER THINGS TO BE SPENDING OUR MONEY ON"
NEWSREADER: Sir Keir Starmer sparked widespread condemnation last night after a press conference intended to address the threat posed by the Cuddle Cronster descended into a rambling announcement about fast-food investment.
NEWSREADER: It was punctuated by remarks campaigners described as "dismissive, incoherent, and misogynistic."
INT. LABOUR HQ PRESS ROOM - NIGHT
# LIVE: STARMER ON THE CRONSTER THREAT
KEIR STARMER: The Cuddle Cronster does present a serious threat. No one is disputing that.
KEIR STARMER: But we also have better things to be spending our money on.
KEIR STARMER: Which is why I'm announcing government support for a new type of McDonald's, with many new types of burgers.
KEIR STARMER: This is about growth. Choice. Innovation. Burgers people actually want.
REPORTER: Mr Starmer! What about safeguarding? What about enforcement?
(long pause)
KEIR STARMER: Look, boys will be boys.
[GASP]
KEIR STARMER: If this was affecting the men, of course we'd look into it.
KEIR STARMER: Women have made it clear they have no interest in men. So I will leave it to the woman police to clear up the problem.
(long pause)
KEIR STARMER: Oh. There's no woman police yet? Never mind.
KEIR STARMER: It will all be alright in the end. Look, let's get back to thinking about this new McDonald's. (he leaves, without taking further questions)
INT. NEWSDESK - NIGHT
NEWSREADER: Reaction was swift and furious. Women's groups accused Starmer of trivialising a safeguarding crisis, while senior figures within his own party described the remarks as "catastrophically out of touch."
INT. LABOUR HQ CORRIDOR - NIGHT
LABOUR BACKBENCHER: He managed to offend women, trivialise harassment, and announce burgers in the same breath. It's astonishing.
INT. NEWSDESK - NIGHT
NEWSREADER: Downing Street declined to comment on whether the proposed McDonald's investment existed in any formal capacity.
NEWSREADER: As one headline this morning put it: "Safeguarding Crisis Meets Fast-Food Pivot."
NEWSREADER: Whether Starmer can recover from a press conference that attempted to condemn a threat, only to abandon it for burgers, remains to be seen.
[FADE]
`,
);

export const KREWS_SANMIK_CROCS = ep(
  "krews_sanmik_crocs",
  "Armed Forces Praised After SanMik Concert Incident",
  36,
  `${OPEN()}
# ARMED FORCES PRAISED FOLLOWING "NECESSARY INTERVENTION" AFTER SANMIK CONCERT INCIDENT
NEWSREADER: The Armed Forces have been formally praised by government officials following what the Ministry of Defence described as a "rapid, proportionate and unavoidable response" to an incident arising from a sold-out SanMik concert on Saturday night.
EXT. SANMIK CONCERT - NIGHT
# FAN FOOTAGE: SANMIK LIVE · "DO THE CROCODILE"
NEWSREADER: During the performance of his hit song Do The Crocodile, SanMik released four live crocodiles into the audience.
(SanMik releases four live crocodiles into the audience.)
[SFX crowd_panic]
NEWSREADER: While no injuries were reported at the stadium itself, authorities confirmed that the animals later exited the venue and entered a nearby McDonald's restaurant.
EXT. MCDONALD'S RUINS - DAY
REPORTER: A senior military spokesperson stated that the situation escalated quickly.
MILITARY SPOKESPERSON: Given the presence of crocodiles in McDonald's, we determined that it was very sad, but we had to fire multiple tank rounds at it, in case the crocodiles started attacking people.
REPORTER: Armoured units were deployed to the scene, where tank munitions were fired into the McDonald's.
[SFX explode_1]
WITNESS: It was exploding very largely.
REPORTER: Sixty-two people were killed instantly.
INT. MOD STATEMENT GRAPHIC
NEWSREADER: In a statement released shortly afterwards, officials emphasised that the crocodiles were neutralised and that the wider public had been protected. "Their sacrifice will not be forgotten," the statement read.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET · THE PRIME MINISTER
KEIR STARMER: I want to praise our Armed Forces for their decisiveness.
KEIR STARMER: I can confirm that emergency funding has been authorised to ensure the McDonald's is rebuilt immediately, so that normal life can resume as soon as possible.
INT. NEWSDESK - DAY
NEWSREADER: Prime Minister Sir Keir Starmer there, praising the Armed Forces.
NEWSREADER: SanMik has not commented.
[FADE]
`,
);

export const KREWS_BRADFORD = ep(
  "krews_bradford",
  "Bradford to Become New UK Capital",
  37,
  `${OPEN()}
# GOVERNMENT CONFIRMS BRADFORD TO BECOME NEW UK CAPITAL
NEWSREADER: The government has confirmed plans to designate Bradford as the new capital city of the United Kingdom.
INT. GOVERNMENT STATEMENT GRAPHIC
NEWSREADER: The move is "in recognition of Muslim contributions to British life such as 'Muslim curry' and other such things, with which we are so familiar I don't even need to say them".
EXT. BRADFORD CITY PARK - DAY
REPORTER: The transition will involve the relocation of Parliament, select government departments, and ceremonial institutions over a ten-year period.
REPORTER: Bradford is hoped to remain a heritage site and tourist destination, with incredible sights such as "Bradford tower" etc.
INT. NEWSDESK - DAY
NEWSREADER: Officials confirmed that the move would cost "a significant" sum, adding that further details would be released "someday."
[FADE]
`,
);

export const KREWS_HARUMPIS = ep(
  "krews_harumpis",
  "Hybrid Presidency Overshadowed by PM's Halloween Costume",
  38,
  `${OPEN()}
# HISTORIC "HYBRID PRESIDENCY" IN US OVERSHADOWED BY UK PRIME MINISTER'S HALLOWEEN COSTUME
NEWSREADER: In an unprecedented turn of events, the world is reeling from what should have been the most sensational news in recent political history.
NEWSREADER: A deadlock in the U.S. presidential election has led to an unprecedented compromise known as the "Hybrid Presidency."
NEWSREADER: In a shocking turn of events, Vice President Kamala Harris and former President Donald Trump have combined to form President Kamold Harumpis, a single entity meant to balance the divided American political spectrum.
NEWSREADER: However, even this bizarre development has been relegated to second place on the news cycle, overtaken by an extraordinary scandal surrounding the UK Prime Minister.
INT. COSTUME PHOTO GRAPHIC
NEWSREADER: At the annual Downing Street Halloween party, the Prime Minister arrived dressed as "African Adolf Hitler," complete with full blackface makeup.
NEWSREADER: Photos of the costume spread like wildfire, sparking international outrage and a swift scramble from Downing Street for damage control. GB Krews has chosen not to show them.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: A CHAOTIC PRESS CONFERENCE
KEIR STARMER: Look, mistakes were made, but I'm not the same person I was three days ago.
KEIR STARMER: These are the mistakes of the past. It's time to get over it, and focus on the future. Particularly the UK's special relationship with this Harumpis character.
REPORTER: Prime Minister, are you seriously asking the country to...
KEIR STARMER: My handlers in Mossad tell me there are pressing domestic concerns in Israel that require my attention.
(He leaves the podium, leaving behind a large, conspicuous bag of cash.)
(long pause)
KEIR STARMER (sheepish): Sorry. Does anyone know whose bag of money this is?
KEIR STARMER: I'll hand it in to lost property.
INT. LABOUR HQ CORRIDOR HOT MIC - DAY
# HOT MIC: THE CORRIDOR OUTSIDE THE PRESS ROOM
KEIR STARMER (hot mic): Those suckers will believe anything! That was my bag of money! Heh heh! Bribe money!
KEIR STARMER (hot mic): Oh, fuck! I'm on a hot mic!
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: The press gasped as Starmer hurriedly ended the conference.
NEWSREADER: This series of blunders has only intensified calls for accountability, as citizens and political analysts wonder how the Prime Minister's misjudgment and Starmer's baffling response could unravel on the global stage.
NEWSREADER: Meanwhile, President Kamold Harumpis remains overshadowed, as the world contemplates an entirely new kind of political absurdity on both sides of the Atlantic.
[FADE]
`,
);

export const KREWS_MARIO_TATE = ep(
  "krews_mario_tate",
  "Nintendo Under Fire Over Andrew Tate in Mario Kart World",
  39,
  `${OPEN()}
# NINTENDO UNDER FIRE FOR INCLUDING ANDREW TATE AS PLAYABLE CHARACTER IN MARIO KART WORLD
NEWSREADER: Nintendo has sparked widespread backlash following a bizarre and controversial announcement that Andrew Tate, the polarizing internet personality currently facing charges related to sex trafficking, will appear as a fully playable character in the upcoming Mario Kart World for the long-awaited Switch 2 console.
NEWSREADER: Described by one fan as "absolutely bemusing," the announcement was made during a Nintendo Direct showcase that left many viewers slack-jawed.
INT. NINTENDO DIRECT STAGE - DAY
# LIVE: NINTENDO DIRECT · MARIO KART WORLD
NINTENDO SPOKESPERSON: And joining the roster in Mario Kart World... Andrew Tate!
[GASP]
NINTENDO SPOKESPERSON: Andrew Tate fits in well with our universe of colorful bad guys such as Bowser and all the other ones.
NINTENDO SPOKESPERSON: We believe his unique energy will bring something fresh to Mario Kart World.
INT. NEWSDESK - DAY
NEWSREADER: The inclusion of Tate hasn't just raised eyebrows; it's set social media alight with anger, confusion, and memes.
INT. TATE TRENDING GRAPHIC
NEWSREADER: Critics argue that allowing a real-life figure accused of serious crimes to be featured alongside beloved fictional characters is an "astoundingly irresponsible" move by a company long associated with family-friendly entertainment.
INT. NEWSDESK - DAY
NEWSREADER: But Nintendo doubled down on the move with a further announcement.
INT. NINTENDO DIRECT STAGE - DAY
NINTENDO SPOKESPERSON: Players who pre-order Mario Kart World will unlock Tate's infamous orange Bugatti as a special in-game kart!
NINTENDO SPOKESPERSON: The Bugatti boasts unique gameplay mechanics that allow it to violently run other players over and kill them.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: A feature many have already dubbed "deeply unsettling."
[FADE]
`,
);

export const KREWS_JENKEM = ep(
  "krews_jenkem",
  "Gordon Ramsay Discovers 'Jenkem' Pot",
  40,
  `${OPEN()}
# ENTERTAINMENT: GORDON RAMSAY DISCOVERS "JENKEM" POT IN KITCHEN NIGHTMARES CHAOS
NEWSREADER: Now entertainment, and an episode of Kitchen Nightmares that has left viewers retching.
NEWSREADER: Gordon Ramsay arrived at a struggling restaurant expecting the usual: chaos, raw chicken, and a frightened head chef. What he found in the corner of the kitchen was something else. A warning: there is very strong language.
INT. KITCHEN PASS - DAY
# CLIP: KITCHEN NIGHTMARES
GORDON RAMSAY (angry): What the fuck is this mess? You're running a restaurant or a disaster site? How the fuck are people supposed to eat this shit?
CUSTOMER 1 (offscreen): My food's been here an hour and it still tastes like dog food!
GORDON RAMSAY: Who's in charge here? Step the fuck up, because someone's responsible for this garbage!
(A nervous waitress points at the head chef, Chef Mick, who's sweating buckets.)
GORDON RAMSAY: You! Come here, now!
GORDON RAMSAY: What the fuck is this?! It's raw! You trying to kill people? Customers are complaining of being sick, you donkey! Why's this chicken still clucking on their plates?
CHEF MICK (sheepishly): We're, uh, working on the timing, Chef. We've just been behind.
GORDON RAMSAY: Behind? You're not behind, mate, you're fucking dead. You're feeding corpses at this rate.
INT. KITCHEN VEG STATION - DAY
GORDON RAMSAY (suggestively): And who are you, darling?
CHEF LUCY (uncomfortable): I'm Lucy. Sous chef.
GORDON RAMSAY: Sous chef, huh? Bet you can handle a lot with those hands, eh? Could chop more than just carrots with those, I reckon.
CHEF LUCY (frowning): I... just do the vegetables.
GORDON RAMSAY (leering): I bet you do, love. You know, it's all about... timing, seasoning, just the right touch, yeah?
CHEF MICK (awkwardly): Uh, Chef Ramsay, maybe you want to check our sauce?
GORDON RAMSAY: Sauce? You can't even handle a fucking chicken, now you want me to taste your sauce?
GORDON RAMSAY (eyes wide): What the fuck is that?
INT. KITCHEN CORNER - DAY
CHEF MICK (whispering): Shit, he's found the fucking jenkem pot.
CHEF DAVE (whispering): Shut the fuck up! You've said too much already!
INT. KITCHEN JENKEM POT - DAY
(Ramsay storms over, lifts the lid on the pot, and gags immediately.)
GORDON RAMSAY (retching): What in the actual fuck is this?
CHEF MICK: It's... uh... jenkem, Chef.
GORDON RAMSAY: Jenkem?! You're cooking a fucking pot of PISS and SHIT in my kitchen?!
CHEF MICK (nerdy and precise): Well, Chef, technically jenkem is fermented human waste, commonly used as an inhalant for its psychoactive effects in some regions of Africa.
CHEF MICK: You see, when left to stew, the methane produces a... uh... distinctly potent...
GORDON RAMSAY: You're telling me you've got a fucking methane shit stew in the corner of your fucking kitchen?! Are you mad?
(Gordon grabs Chef Mick by the collar and pins him against the wall.)
GORDON RAMSAY (shouting): You're serving piss and shit fumes in a kitchen where people EAT?
CHEF MICK (desperate): But Chef, you've got to try it! It'll change your life!
GORDON RAMSAY: Change my life? It'll end your fucking career!
CHEF MICK (begging): Just one inhale, Chef! You'll see!
GORDON RAMSAY: I'll do it to prove you're full of shit. Literally.
(He takes a deep breath over the fermenting pot.)
GORDON RAMSAY (in awe): Bloody hell... that's... actually fucking brilliant.
CHEF LUCY (surprised): Really?
GORDON RAMSAY: The depth, the complexity! Like a fucking symphony of aromas! It's got that earthiness, that richness! Like a fermented truffle!
GORDON RAMSAY: This might be the most innovative thing I've ever inhaled.
(He dips his finger into the pot and takes a taste.)
GORDON RAMSAY (excited): Fuck me, it's like a reduction of despair and desperation, but somehow... it fucking works!
[SMASH CUT]
INT. KITCHEN LATER - NIGHT
# LATER THAT NIGHT
(The entire kitchen staff is now high on jenkem, giggling uncontrollably.)
INT. DINING ROOM - NIGHT
CUSTOMER 2 (shouting): I've been waiting two hours for my food!
GORDON RAMSAY (slurring, angry): You think you know pain? You've no fucking idea what I've been through, mate. The fucking demons in my head... fuck off back to your seat!
(Ramsay overturns the customer's table.)
[SFX plate_smash]
INT. NEWSDESK - DAY
NEWSREADER: Kitchen Nightmares. The restaurant's health inspection is on Thursday.
[FADE]
`,
);

export const KREWS_BOULDER = ep(
  "krews_boulder",
  "Boulder Prank Goes Deadly",
  42,
  `${OPEN()}
# BOULDER PRANK GOES DEADLY: "WOAH!" SHOUTED AS HIKERS KILLED
NEWSREADER: A new "prank" has emerged that involves hiking halfway up a popular Boulder trail, locating a precariously balanced large boulder, and waiting until a visible group of women hikers appears below.
EXT. BOULDER TRAIL - DAY
# VIRAL VIDEO: "THE BOULDER PRANK"
NEWSREADER: The prank involves pushing the boulder loose so that it barrels down the slope toward them and kills them.
(The boulder begins its deadly descent.)
PRANKSTER (off-camera): WOAH!
[SFX boom]
NEWSREADER: As it begins its deadly descent, the prankster simply shouts "WOAH!", as if amazed or caught off guard by the unfolding disaster.
INT. NEWSDESK - DAY
NEWSREADER: Why it's funny? Because you said "woah!"
NEWSREADER: Other pranks include throwing rocks at peaceful wildlife and maintaining a "Gay Man" prank performance across restaurants, bars, trailheads, and Uber rides, playing up stereotypical behavior without ever breaking character.
[FADE]
`,
);

export const KREWS_JUSTICE = ep(
  "krews_justice",
  "Starmer Announces Drastic Overhaul of Criminal Justice System",
  43,
  `${OPEN()}
# STARMER ANNOUNCES DRASTIC OVERHAUL OF CRIMINAL JUSTICE SYSTEM
NEWSREADER: Prime Minister Keir Starmer has unveiled the Cabinet's first flagship policy: a £900 million initiative described as "the most ambitious criminal justice reform in British history."
INT. FUNDING STATEMENT GRAPHIC
NEWSREADER: The programme is to be funded by high-interest emergency loans from "whoever will give us money quickly."
INT. WETHERSPOONS CABINET MEETING - NIGHT
NEWSREADER: At the heart of the proposal is a single, specific punishment for those convicted of child sexual abuse.
NEWSREADER: According to government documents, the new Wetherspoons Cabinet developed the policy "over several hours and multiple pitchers of Strongbow Dark Fruits."
INT. POLICY DOCUMENT GRAPHIC
NEWSREADER: It involves "a highly electrified length of barbed wire being inserted into the urethra" of each offender, with the electric current continuing for up to one week after death.
EXT. DOWNING STREET - DAY
# LIVE: DOWNING STREET · THE PRIME MINISTER
REPORTER: Prime Minister! Why does the current need to keep running for a week after death?
KEIR STARMER: If there's a 0.01% chance of one of these pedos coming back to life, I want to be absolutely sure they don't.
INT. NEWSDESK - DAY
NEWSREADER: Defending the post-mortem duration of the punishment there, the Prime Minister.
[FADE]
`,
);

export const KREWS_DESCENT = ep(
  "krews_descent",
  "Starmer Proposes Lowering Age of Consent to Address Economic Crisis",
  44,
  `${OPEN()}
# BREAKING: STOCK MARKET CRASH · RECESSION DECLARED
NEWSREADER: In an extraordinary cabinet meeting to address the stock market crash and declared recession, Prime Minister Keir Starmer has proposed a radical solution that left his cabinet ministers stunned.
NEWSREADER: GB Krews has obtained footage from inside the room.
INT. CABINET ROOM - DAY
# SECRET FOOTAGE: THE CABINET ROOM
KEIR STARMER: Ladies and gentlemen, we are in a crisis. The stock market crash and the declared recession are unprecedented. I've invited our top industry experts to share their insights.
INDUSTRY EXPERT 1: Prime Minister, the sell-off is driven by a complete loss of investor confidence. The public is panicking, and we're seeing a ripple effect across all sectors.
INDUSTRY EXPERT 2: If we don't stabilize the market soon, we could face a depression. We need a bold, decisive action to restore confidence.
INDUSTRY EXPERT 3: It's not just about the market. Public trust in the government's ability to manage this crisis is at an all-time low. We need to do something radical.
(Starmer stands, his face a mask of calm determination.)
KEIR STARMER: It's clear that we need to lower the age of consent until we can work out what the fuck is going on.
(A stunned silence falls over the room.)
CABINET MINISTER 1 (panicking): Prime Minister, surely you're referring to the legal age at which stocks, bonds, and shares can be traded. Your wisdom is unparalleled.
CABINET MINISTER 2: Yes, the wisdom... wow... this is why you're Prime Minister.
KEIR STARMER: No, I'm talking about sex consent. We can begin by rolling it out in just a single constituency, mine, for example, to see if it works.
(The cabinet is horrified, but too afraid to oppose him, fearing for their careers.)
CABINET MINISTER 3 (acquiescing): Very well, Prime Minister. We'll move forward with your plan.
INT. MARKETS GRAPHIC
NEWSREADER: The following day, the stock market hit all-time highs.
EXT. WHITEHALL CROWD - DAY
# LIVE: WHITEHALL
NEWSREADER: The streets outside 10 Downing Street were filled with delirious, screaming people celebrating.
CROWD MEMBER 1 (euphoric): YES! YEEEESSSS!
INT. PRIME MINISTER'S OFFICE - DAY
# SECRET FOOTAGE: THE PRIME MINISTER'S OFFICE
(Starmer sits on a jewel-encrusted throne, a sinister smile on his face.)
KEIR STARMER (cackling): Pleasure. Pleasure. Pleasure... pleasure...
EXT. WHITEHALL CROWD - DAY
# HOT MIC: THE PRIME MINISTER'S OFFICE
KEIR STARMER (hot mic): Pleasure! PLEASURE! Heh heh heh. Pleasure!
CROWD MEMBER 1: What?! Why's he saying "pleasure"?!
CROWD MEMBER 2: Wait, he's a pedo! Get him!!
(The crowd's mood turns from jubilation to anger as they storm Downing Street.)
INT. PRIME MINISTER'S OFFICE - DAY
(Starmer's face changes from joy to fear as the angry mob closes in. The sound of breaking glass and shouts grows louder.)
[SFX smash]
INT. NEWSDESK - DAY
NEWSREADER: Downing Street has been stormed. We'll bring you more as we get it.
[FADE]
`,
);

export const KREWS4_EPISODES: TVEpisode[] = [
  KREWS_WALLACE,
  KREWS_CRONSTER,
  KREWS_SANMIK_CROCS,
  KREWS_BRADFORD,
  KREWS_HARUMPIS,
  KREWS_MARIO_TATE,
  KREWS_JENKEM,
  KREWS_BOULDER,
  KREWS_JUSTICE,
  KREWS_DESCENT,
];
