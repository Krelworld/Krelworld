import { parseScreenplay, type TVEpisode } from "../../../game/systems/tv";

// "News stories" screenplays (OCR'd phone screenshots), staged as GB Krews broadcasts with their own sets and
// presenters (see NEWS_SHOWS in src/game/scenes/TVNews.ts). The article text is kept as written; where a page was cut
// off mid-sentence the sentence is finished, and the people in the stories say the lines the articles report.
// - Klopp's bribe: a GB Krews Sport bulletin with pitch footage, a replay and the tunnel footage.
// - Sunak's bomb threat: a breaking-news bulletin and the address to the nation outside Number 10.
// - Starmer's election: a six-part special (the hot mic, the polls, Rayner on the breakfast sofa, the T-shirts,
//   Sunak's hot mic, election day and #FartGate).
// - Microsoft's "Crash Mode": the press conference itself; as in "News articles 3" the collision is a fictional one
//   over Krelford, and nobody involved in it is shown.
// - Starmer's video scandal: the cross-party meeting, his "virus" statement, the enhanced audio and Sunak at
//   Downing Street. The video itself is never shown: we only see the phone's back and the MPs' faces.
// - #ArsebrushGate: Sunday's tease, the Downing Street press conference (Starmer with a giant toothbrush, flanked by
//   Whitty and Dental Health Tsar Dr Alana Merrick, a fictional character), the crashed Department of Health website,
//   the British Dental Association's statement, Badenoch and Cooper at Westminster, and the hashtags.
// - Kill the Patient 2: No Alibi: the hospital arcade, the cabinet, the hospital's press room and the committee room,
//   cutting now and then to "game footage" of the arcade game itself (tvnews/ktpGame.ts), then a BREAKING second half
//   on the "penis sensor" (only ever the flap and its label). The article stops mid-sentence after 'Fully Immersive';
//   the newsreader closes there.
// - Andy Burnham's first act (the user's own gross-out script, word for word; Bloke 2's line was cut off between
//   screenshots and is filled in): live from Downing Street, the Manchester Wetherspoons with the presser on its
//   muted telly, then back. Cartoon chips-and-gravy vomit; the squat happens behind the podium under a CENSORED bar
//   and nothing is ever shown coming out (tvnews/burnhamShow.ts).
// - Gordon Ramsey's "Food History Moment": clips from the (fictional) documentary's cosy TV-kitchen set, Ramsey's
//   quote on camera, PixelLab inserts of the turkey, the knife and his lip, Dr Bramwell's (fictional) stunned
//   close-ups, and the viewers' reaction. The article spells him "Ramsey"; his speaker tag is the game's GORDON RAMSAY.

const NEWS = "GB KREWS 24";

const ep = (id: string, title: string, n: number, script: string): TVEpisode => ({
  id,
  channel: NEWS,
  show: "GB Krews",
  title,
  episodeNumber: n,
  beats: parseScreenplay(script),
});

export const KREWS_KLOPP_BRIBE = ep(
  "krews_klopp_bribe",
  "Klopp's Farewell Bribe Scandal",
  30,
  `[MUSIC news start]
# GB KREWS SPORT
INT. NEWSDESK - NIGHT
[MUSIC news fade]
# KLOPP'S ILL-FATED DECISION
NEWSREADER: Good evening, and welcome to GB Krews Sport. Jürgen Klopp's Anfield farewell was supposed to be a fairytale. Tonight, it is a scandal.
NEWSREADER: As the game neared its conclusion, with the score locked at 1-1, Klopp, perhaps in a moment of desperation to ensure a storybook ending, made an uncharacteristic and shocking decision.
EXT. ANFIELD PITCH - NIGHT
# SCORE: LIVERPOOL 1-1 VISITORS · 87'
REPORTER: Reports from the sidelines indicate that Klopp approached the referee, Mark Hughes, during a stoppage in play.
[SFX whistle]
REPORTER: Witnesses claim that Klopp, in an almost laughable attempt at subterfuge, slipped Hughes what can only be described as a pathetically small bribe: a crumpled £20 note.
JURGEN KLOPP (whispering): Mark. Mark! For you. Twenty pounds. Buy yourself something nice. Maybe a penalty, ja?
MARK HUGHES: Is that... a twenty?
JURGEN KLOPP: It is a crumpled twenty, yes. It has been in this tracksuit since 2015. It is a very special note.
MARK HUGHES (affronted): Get that away from me! I'm a Premier League referee! Have you any idea what you're insulting here?
[GASP]
# REPLAY
REPORTER: The referee, known for his integrity and professionalism, was reportedly stunned by the gesture.
REPORTER: Hughes immediately rejected the bribe, visibly affronted by the insult to his character and the sport's integrity. The exchange was caught on camera, and the clip is already being called the cheapest moment in football history.
INT. NEWSDESK - NIGHT
# THE FALLOUT
NEWSREADER: Humiliated and likely realizing the gravity of his error, Klopp returned to the touchline, his demeanor markedly different.
EXT. ANFIELD PITCH - NIGHT
REPORTER: The game resumed, but the atmosphere had changed; a sense of unease and disbelief settled over Anfield.
REPORTER: In a bizarre twist, Hughes then made a decision that further escalated the controversy. Rather than maintaining professional decorum, he awarded a dubious penalty to the opposing team in the final minutes of the match.
[SFX whistle]
MARK HUGHES: Penalty!
JURGEN KLOPP: Penalty? For what?! Nobody touched him! He fell over his own shoelace!
MARK HUGHES: Should've made it a fifty, Jürgen.
[SFX punch]
# SCORE: LIVERPOOL 1-2 VISITORS · 90+4'
REPORTER: The opposition converted the penalty, securing a 2-1 victory and further souring Klopp's farewell.
INT. NEWSDESK - NIGHT
# A BRIBE REBUFFED, ANOTHER ATTEMPTED
NEWSREADER: The situation took an even stranger turn after the final whistle.
NEWSREADER: According to insiders, Hughes approached Klopp in the tunnel, offering a bribe of his own - significantly more substantial than Klopp's earlier attempt - in a bid to keep the incident quiet.
INT. ANFIELD TUNNEL - NIGHT
# SECRET FOOTAGE: THE ANFIELD TUNNEL
MARK HUGHES: Jürgen. Jürgen! Here. Five grand. Nobody needs to know about the twenty, eh?
JURGEN KLOPP: No. Put it away, Mark.
MARK HUGHES: Ten grand, then. Go on. It's not even crumpled.
JURGEN KLOPP: No! I have made a terrible mistake today. But the integrity of the sport must prevail, even if it means facing public disgrace.
MARK HUGHES: Suit yourself. I'm keeping your twenty, mind.
INT. NEWSDESK - NIGHT
# REACTIONS AND IMPLICATIONS
NEWSREADER: Klopp, though deeply embarrassed by his earlier actions, reportedly refused the offer, insisting that the integrity of the sport must prevail, even if it meant facing public disgrace.
INT. STATEMENT GRAPHIC - LIVERPOOL FC
NEWSREADER: The reactions to this scandal have been swift and severe. Liverpool FC issued a statement expressing shock and disappointment, promising a thorough internal investigation.
INT. NEWSDESK - NIGHT
NEWSREADER: The Premier League and the Football Association have both opened inquiries, and the crumpled £20 note has been placed in an evidence bag.
NEWSREADER: Jürgen Klopp leaves Anfield as he arrived: twenty quid lighter than he'd hoped. Now, the weather.
[FADE]
`,
);

export const KREWS_SUNAK_BOMB = ep(
  "krews_sunak_bomb",
  "Sunak Postpones Election Over 'Bomb Threat'",
  31,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - NIGHT
[MUSIC news fade]
# BREAKING: SUNAK POSTPONES ELECTION FOR FIVE YEARS OVER "BOMB THREAT"
NEWSREADER: Sunak's desperate move: an election cancellation over a bomb threat sparks controversy.
NEWSREADER: In an unprecedented and controversial move, Prime Minister Rishi Sunak has called for the next general election to be postponed indefinitely, citing a bomb threat that he claims poses a significant risk to national security.
NEWSREADER: This decision, announced late last night, has sent shockwaves through the political landscape, raising questions about the motivations and legitimacy behind the delay.
NEWSREADER: We go live now to Downing Street, where the Prime Minister is addressing the nation.
EXT. DOWNING STREET - NIGHT
# LIVE: DOWNING STREET · ADDRESS TO THE NATION
RISHI SUNAK: Good evening. Intelligence agencies have identified a credible threat that necessitates postponing the election for at least five years to ensure public safety.
RISHI SUNAK: Given the severity and credibility of this threat, it is imperative that we take all necessary precautions to protect our citizens.
RISHI SUNAK: The decision to postpone the election is not taken lightly, but is necessary to maintain national security.
REPORTER: Prime Minister! What exactly is the threat?
RISHI SUNAK: It's a bomb. A big one. Under the polling station. All of the polling stations. Every single one.
REPORTER: Five years, Prime Minister? Has this got anything to do with you being twenty points behind in the polls?
RISHI SUNAK: The safety of the British people must come before political processes.
(long pause)
RISHI SUNAK: That's all. Thank you. Lovely.
INT. NEWSDESK - NIGHT
# THE BOMB THREAT AND GOVERNMENT'S RESPONSE
NEWSREADER: According to Sunak, intelligence agencies have identified a credible threat that necessitates postponing the election for at least five years.
NEWSREADER: The Prime Minister emphasized the need for extreme caution, arguing that the safety of the British people must come before political processes.
NEWSREADER: Downing Street has declined to say where the bomb is, who planted it, or why it will take exactly five years to find. More on that as we get it.
[FADE]
`,
);

export const KREWS_STARMER_SAGA = ep(
  "krews_starmer_saga",
  "Election Special: From KickGate to FartGate",
  32,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# ELECTION SPECIAL: FROM KICKGATE TO FARTGATE
NEWSREADER: London, July the second. In an unexpected twist, Labour leader Keir Starmer's shocking hot mic remark to his pregnant wife has given the party a surprising boost in the polls.
NEWSREADER: The incident, which could have derailed any other campaign, appears to have made Starmer seem more relatable to key "red wall" voters, and even rendered him an unlikely sex symbol.
# PART ONE: THE INCIDENT
NEWSREADER: The controversial moment occurred when a nearby microphone picked up Starmer in a private conversation with his pregnant wife, after she complained about being hungry. A warning: there is strong language.
INT. LABOUR BATTLE BUS - DAY
# HOT MIC: THE LABOUR BATTLE BUS
(His pregnant wife, off-mic, complains that she's hungry.)
KEIR STARMER (hot mic): I'll kick that fucking baby out of you.
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: Despite the violent and offensive nature of the remark, the reaction has been anything but typical.
# PART TWO: LABOUR'S UNEXPECTED POLL BOOST
INT. LABOUR SURGE POLL GRAPHIC
NEWSREADER: Instead of condemning Starmer, many voters in traditionally Labour-leaning areas have rallied behind him. The bluntness of his remark has resonated with some, who see it as a sign of his down-to-earth nature.
NEWSREADER: Early polls show a noticeable uptick in Labour support following the incident.
EXT. RED WALL HIGH STREET - DAY
# STARMER AS AN UNLIKELY SEX SYMBOL
REPORTER: In a surprising development, Starmer has also become an unlikely sex symbol. Female voters have described feeling "hot under the collar" after hearing the remark.
WOMAN: I wouldn't mind him kicking one out of me.
INT. BREAKFAST SOFA - DAY
# PART THREE: ANGELA RAYNER'S RESPONSE
BREAKFAST HOST: Angela Rayner, Labour's Deputy Leader. Your leader has been caught on a microphone saying, and I quote... well, I can't quote it, it's breakfast time.
ANGELA RAYNER (laughing): Well, at least we know Keir's passionate about everything.
[LAUGHTER]
BREAKFAST HOST (laughing): Angela!
INT. NEWSDESK - DAY
NEWSREADER: Her lighthearted take on the matter seemed to further endear the Labour leadership to voters who value authenticity.
# PART FOUR: LABOUR'S MARKETING MOVE
NEWSREADER: In a bold move, the Labour Party has launched a line of T-shirts emblazoned with the controversial quote.
INT. LABOUR MERCH SHOP - DAY
REPORTER: "Vote Labour - or I'll kick that fucking baby out of you." The merchandise has been flying off the shelves, becoming an unlikely campaign tool that underscores Labour's new, raw appeal.
REPORTER: They've sold out of mediums. They've sold out of larges. And they've completely sold out of maternity.
INT. NEWSDESK - DAY
# PART FIVE: CONSERVATIVE PARTY SCRAMBLE
NEWSREADER: The Conservative Party, caught off guard by the public's reaction, is scrambling to imitate Labour's unexpected success. However, their efforts backfired spectacularly.
INT. DOWNING STREET KITCHEN - DAY
# HOT MIC: THE DOWNING STREET KITCHEN
(His wife, off-mic, asks whether he wants a cup of tea.)
RISHI SUNAK (hot mic): Not now, you cow.
[GASP]
INT. TORY SLUMP POLL GRAPHIC
NEWSREADER: Prime Minister Rishi Sunak was caught on a hot mic calling his wife a "cow", resulting in widespread condemnation and accusations of misogyny. The public reaction was swift and harsh, leading to a significant drop in the polls.
EXT. RED WALL HIGH STREET - DAY
# PUBLIC AND POLITICAL REACTIONS
REPORTER: Public reactions remain deeply divided. While some are appalled by the normalization of such violent language, others appreciate the perceived authenticity.
VOTER 1: Why can't he be more like Starmer? Sunak's a vile man.
INT. BREAKFAST SOFA - DAY
# ANGELA RAYNER ON SUNAK'S INCIDENT
BREAKFAST HOST: Angela Rayner, back on the sofa again. Is calling your wife a cow really worse than threatening to kick a baby out of her?
ANGELA RAYNER: Oh, it's much worse. For many crazy reasons.
BREAKFAST HOST: Such as?
ANGELA RAYNER: Well, it's misogynistic, isn't it? "Cow." It reflects very poorly on his character. Whereas what Keir said was authentic.
[LAUGHTER]
INT. NEWSDESK - DAY
# LOOKING AHEAD
NEWSREADER: As the general election approaches, both parties are navigating unprecedented territory. Labour is riding a wave of unconventional momentum, while the Conservatives struggle to regain their footing.
# PART SIX: ELECTION DAY
NEWSREADER: Which brings us to Election Day. Keir Starmer's Labour Party, once predicted to win the general election by a landslide, now faces a historic defeat following a bizarre incident during his final stump speech.
EXT. LABOUR RALLY STAGE - DAY
# LIVE: LABOUR'S FINAL RALLY · ELECTION DAY
KEIR STARMER: And so, on this Election Day, I say to the British people: change is coming. And to the Prime Minister, I say just one thing.
[SFX fart]
KEIR STARMER: Smell that, Sunak! Phwoar! Lovely!
[GASP]
INT. NEWSDESK - DAY
NEWSREADER: Starmer's campaign, which had enjoyed a steady lead in the polls, took a disastrous nosedive when the Labour leader closed his speech by farting into the microphone.
NEWSREADER: The moment, captured live on national television, quickly went viral, triggering an immediate and overwhelming backlash.
INT. SNAP POLL GRAPHIC
NEWSREADER: A snap poll conducted in the immediate aftermath revealed a staggering 70-point swing to the Conservative Party.
EXT. POLLING STATION - DAY
NEWSREADER: Voters, clearly appalled, expressed their dismay at the unprecedented display.
MARGARET THOMPSON: I couldn't believe my ears. How can we trust a man who does something so juvenile and disrespectful?
INT. FARTGATE TRENDING GRAPHIC
NEWSREADER: The backlash was swift and brutal on social media as well, with hashtags like FartGate and PhwoarGate trending within minutes.
NEWSREADER: The incident overshadowed all other news, and political commentators struggled to comprehend the impact of the gaffe.
INT. LABOUR HQ PRESS ROOM - DAY
# LIVE: STARMER APOLOGISES
KEIR STARMER (shaken): I am deeply sorry for my actions earlier today.
KEIR STARMER: It was an ill-judged attempt at humor that was inappropriate and unbecoming of someone seeking the highest office in the land.
KEIR STARMER: I understand the hurt and confusion it has caused, and I am committed to earning back the trust of the British people.
REPORTER: Mr Starmer! Was it a real one?
(long pause)
INT. EXPERT STUDIO - DAY
DR ELAINE ROBERTS: This is one of the most dramatic collapses in political support I've ever seen.
DR ELAINE ROBERTS: It's not just the act itself but the symbolism of it - a complete departure from the statesmanship expected from a potential Prime Minister.
INT. ELECTION RESULTS GRAPHIC
NEWSREADER: As Election Day progressed, early results indicated a massive swing towards the Conservative Party, with many traditional Labour strongholds flipping blue.
NEWSREADER: Prime Minister Rishi Sunak, who had been trailing in the polls for months, seemed poised for a triumphant return to Downing Street.
INT. LABOUR HQ CORRIDOR - NIGHT
# LABOUR INSIDERS IN DISARRAY
LABOUR INSIDER: We were so close to victory. This is a nightmare scenario. We have to figure out how to rebuild from this.
INT. NEWSDESK - NIGHT
NEWSREADER: As the nation awaits the final election results, one thing is clear: Keir Starmer's moment of indiscretion has altered the political landscape in ways no one could have anticipated.
[FADE]
`,
);

export const KREWS_CRASH_MODE_LIVE = ep(
  "krews_crash_mode_live",
  "Microsoft's 'Crash Mode' Press Conference",
  33,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# MICROSOFT FACES OUTRAGE OVER "CRASH MODE" DLC ANNOUNCEMENT
NEWSREADER: Redmond. Microsoft has come under intense scrutiny after scheduling a press conference to announce a new "Crash Mode" DLC for its flagship Flight Simulator video game, just one day after a catastrophic mid-air collision over Krelford.
[INSERT flight_dlc 1]
NEWSREADER: The downloadable content, which controversially encourages pilots to deliberately crash their aircraft, was further condemned for its inclusion of an interactive "penis sensor."
NEWSREADER: We can take you to that ill-timed press event now.
INT. MICROSOFT KEYNOTE STAGE - DAY
# LIVE: REDMOND · "CRASH MODE" ANNOUNCEMENT
EXECUTIVE: Thank you! Thank you. Ladies and gentlemen: Flight Simulator. Crash Mode.
[SFX explode_1]
[INSERT flight_crash 1]
EXECUTIVE: For the first time ever, players are rewarded for mid-air collisions. Deliberately crash your aircraft. Rack up the points.
REPORTER: Sir! A plane went down over Krelford yesterday. Is the timing not...
EXECUTIVE: And that's not all. Introducing the interactive penis sensor, delivering unimaginable and forbidden pleasures.
[GASP]
EXECUTIVE: The sensor attaches to the player's groin. It vibrates, and moistens, in sync with on-screen activities.
JOURNALIST: What has that got to do with flying a plane?
[INSERT flight_land 1]
EXECUTIVE: Great question. When you land, pilots are encouraged to seduce air stewardesses, and visit gentlemen's table dancing clubs.
INT. NEWSDESK - DAY
# OUTRAGE ERUPTS
[INSERT flight_sensor 1]
NEWSREADER: The sensor, which attaches to the player's groin, reportedly vibrates and moistens in sync with on-screen activities, a feature that has been widely derided as both obscene and completely unrelated to the game's original premise.
NEWSREADER: Outrage erupted within minutes of the announcement, with journalists and aviation experts lambasting Microsoft for what they called "an unconscionable lack of tact" and "a grotesque trivialization of real-world tragedies."
NEWSREADER: Social media was flooded with calls for boycotts, and the families of victims of the disaster have condemned the company's tone-deaf timing.
INT. MICROSOFT KEYNOTE STAGE - DAY
REPORTER: Despite the backlash, the Microsoft executive leading the announcement responded with brazen indifference.
JOURNALIST: Do you have anything to say to the families?
EXECUTIVE (smirking): Sorry, I can't hear you over all this money.
[GASP]
EXECUTIVE: If anyone needs me, I'll be attempting to crash a plane in mid-air on the game.
(he leaves, smirking)
INT. NEWSDESK - DAY
NEWSREADER: His remarks were met with gasps in the press room. Microsoft's share price closed four percent up.
[FADE]
`,
);

export const KREWS_STARMER_VIDEO = ep(
  "krews_starmer_video",
  "Starmer's Landslide in Jeopardy: The Video Scandal",
  34,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# KEIR STARMER'S LABOUR LANDSLIDE IN JEOPARDY AMID SCANDAL OVER DISTURBING VIDEO INCIDENT
NEWSREADER: In a shocking turn of events, Keir Starmer's resounding Labour landslide victory is facing an unprecedented threat following a deeply disturbing incident involving a video shown to horrified Conservative MPs.
NEWSREADER: The controversy erupted after Starmer was seen laughing while showing a video on his phone titled "Boy with Down syndrome tragically crushed by meat grinder."
NEWSREADER: The video graphically depicted the tragic death of a boy with Down syndrome in a factory meat grinder. GB Krews will not be showing it.
INT. CABINET ROOM - DAY
REPORTER: The incident occurred during what was supposed to be a routine cross-party meeting.
REPORTER: Eyewitnesses reported visible distress among Conservative MPs as the gruesome footage played.
TORY MP: He just kept holding the phone up. He was laughing. I'll never forget it.
INT. NEWSDESK - DAY
NEWSREADER: The backlash was immediate, with social media and news outlets exploding in outrage.
INT. STATEMENT - DAY
NEWSREADER: In an attempt to contain the fallout, Starmer issued a statement explaining that the video was a "virus" on his phone, and that he had intended to play "a different video."
NEWSREADER: He claimed that by the time he realized the nature of the content, "it was too late" to stop it.
NEWSREADER: While this explanation initially helped to quiet the uproar, it did little to fully mitigate the damage.
INT. NEWSDESK - DAY
NEWSREADER: The scandal, however, took a devastating turn two days later, when enhanced audio of the incident surfaced.
INT. ENHANCED AUDIO - DAY
NEWSREADER: The audio clearly captured Starmer saying to the Tory MPs, moments before the horrific scene unfolded:
KEIR STARMER: And watch now. He's about to get crushed by the meat grinder.
INT. NEWSDESK - DAY
NEWSREADER: This revelation reignited the furor, leading to widespread condemnation and calls for Starmer's immediate resignation.
NEWSREADER: Political analysts are now speculating that the fallout from this incident could lead to calls for another general election.
NEWSREADER: Prominent figures within both Labour and Conservative parties have voiced their dismay and demanded accountability.
EXT. DOWNING STREET - DAY
RISHI SUNAK: What we have heard is beyond comprehension. I am calling for an urgent investigation into the matter.
INT. NEWSDESK - DAY
NEWSREADER: The scandal has not only put Starmer's leadership under intense scrutiny, but also cast a shadow over Labour's recent electoral success.
NEWSREADER: The party, which had enjoyed a wave of support culminating in a historic landslide victory, now faces the prospect of internal turmoil and a potential collapse in public trust.
NEWSREADER: Labour's communications team is reportedly working around the clock to manage the crisis, but the damage may already be irreversible.
NEWSREADER: With mounting pressure from both the public and political opponents, Keir Starmer's future as Labour leader hangs in the balance, and the stability of the newly formed government is uncertain.
NEWSREADER: As the nation watches this scandal unfold, one thing is clear: nobody in Westminster will be accepting a video from Keir Starmer again.
[FADE]
`,
);

export const KREWS_ARSEBRUSH = ep(
  "krews_arsebrush",
  "#ArsebrushGate: The PM's Health Breakthrough",
  35,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# PM'S 'HEALTH BREAKTHROUGH' SPARKS FURY AFTER BIZARRE HYGIENE GUIDANCE
NEWSREADER: Prime Minister Keir Starmer has triggered disbelief and widespread condemnation after unveiling what he described as a "massive and exciting" public health breakthrough — a government-endorsed recommendation that Britons should "brush the inside of their arsehole."
INT. TEASER GRAPHIC - DAY
NEWSREADER: The announcement, made during a Downing Street press conference on Monday, came less than 24 hours after Starmer had teased "one of the most significant developments in preventative health in decades."
NEWSREADER: Expectations had mounted across Westminster and the medical community, with speculation ranging from a major NHS funding boost to a new cancer screening programme.
INT. DOWNING STREET PRESS ROOM - DAY
# LIVE: DOWNING STREET · PRIME MINISTER'S PRESS CONFERENCE
REPORTER: Instead, the Prime Minister appeared flanked by Chief Medical Officer Sir Chris Whitty and newly appointed Dental Health Tsar Dr. Alana Merrick, declaring that medical consensus now supported "targeted internal cleansing" as a means to "reduce bacterial buildup, improve digestive wellbeing, and modernise hygiene standards."
KEIR STARMER: This is a massive and exciting public health breakthrough.
KEIR STARMER: We brush our teeth to get rid of food and plaque.
KEIR STARMER: It's time we faced the simple truth: we should also brush the inside of our arseholes — to get all the shit out.
(a long pause: stunned silence)
REPORTER: The remarks were met with stunned silence from the assembled press before several journalists shouted follow-up questions, including whether the NHS would be issuing official guidance or equipment for such practices.
JOURNALIST: Prime Minister! Will the NHS be issuing official guidance? Or equipment?
CHRIS WHITTY (visibly uncomfortable): Research is ongoing.
INT. NEWSDESK - DAY
# WEBSITE CRASHES · DENTISTS "NOT CONSULTED"
NEWSREADER: Whitty, visibly uncomfortable, declined to elaborate, saying only that "research is ongoing."
INT. DOH ERROR GRAPHIC - DAY
NEWSREADER: Within hours, the Department of Health's website crashed amid a surge of visitors seeking clarification.
INT. BDA STATEMENT - DAY
NEWSREADER: The British Dental Association issued a curt statement saying it had "not been consulted" and "did not endorse the Prime Minister's comments in any capacity."
INT. NEWSDESK - DAY
# OPPOSITION CONDEMNS "GROTESQUE FARCE"
NEWSREADER: Opposition parties were quick to condemn the announcement.
EXT. WESTMINSTER - DAY
NEWSREADER: Conservative leader Kemi Badenoch accused Starmer of "degrading the dignity of public office" and called for an immediate apology.
KEMI BADENOCH: The Prime Minister is degrading the dignity of public office. He must make an immediate apology.
EXT. COLLEGE GREEN - DAY
NEWSREADER: Liberal Democrat leader Daisy Cooper described the moment as "a grotesque farce masquerading as science."
DAISY COOPER: It was a grotesque farce masquerading as science.
INT. ARSEBRUSHGATE TRENDING GRAPHIC
NEWSREADER: Social media erupted with a mixture of ridicule, outrage, and confusion. Hashtags such as #ArsebrushGate and #ColonicKeir began trending within minutes, while videos of Starmer's statement circulated widely with incredulous commentary.
INT. NEWSDESK - DAY
NEWSREADER: In a later interview, the Prime Minister stood by his remarks.
[FADE]
`,
);

export const KREWS_KILL_THE_PATIENT = ep(
  "krews_kill_the_patient",
  "Kill the Patient 2: No Alibi",
  36,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# HOSPITAL INSTALLS "KILL THE PATIENT 2: NO ALIBI" AFTER $20M PAYOUT OVER THE FIRST ONE
NEWSREADER: A hospital already forced to pay $20 million in litigation over its decision to install a video game called Kill the Patient in its on-site arcade is facing renewed outrage after administrators approved the installation of its sequel, Kill the Patient 2: No Alibi.
INT. HOSPITAL ARCADE - DAY
NEWSREADER: The decision has baffled patients, staff, attorneys, local officials and, reportedly, several members of the hospital's own board, some of whom initially denied that the machine existed despite photographs showing it positioned prominently between a basketball game and a Dance Dance Revolution cabinet.
REPORTER: The hospital has previously faced intense scrutiny over the original Kill the Patient, an arcade game in which players assumed the role of a disgruntled hospital employee and accumulated points through a variety of activities involving hospitalized patients.
INT. HOSPITAL STATEMENT GRAPHIC
REPORTER: Following multiple lawsuits, the hospital ultimately agreed to pay approximately $20 million in damages and issued a public statement promising to "undertake a comprehensive review of the standards governing entertainment available on hospital property."
INT. HOSPITAL ARCADE - DAY
REPORTER: Less than two years later, Kill the Patient 2: No Alibi appeared in the arcade.
INT. NEWSDESK - DAY
# THE HOSPITAL'S EXPLANATIONS
NEWSREADER: Hospital executives have offered a rapidly evolving series of explanations.
INT. HOSPITAL PRESS ROOM - DAY
# LIVE: THE HOSPITAL · MONDAY MORNING
REPORTER: At first, a spokesperson denied that the hospital had ever purchased the game.
HOSPITAL SPOKESPERSON: We have no record of any such machine being present on hospital property.
INT. CABINET MARQUEE - DAY
REPORTER: Minutes later, after reporters produced photographs of the cabinet bearing the words KILL THE PATIENT 2: NO ALIBI — NOW WITH CASH PAYOUTS, the hospital clarified that while the machine was physically located inside the hospital, this did not necessarily mean the hospital had "stocked" it.
INT. NEWSDESK - DAY
NEWSREADER: By Tuesday, administrators had shifted to defending the game on artistic grounds.
INT. ARTISTIC STATEMENT GRAPHIC
NEWSREADER: "The game is actually about corruption in the medical industry, and the player is never explicitly rewarded for killing patients, nor is it ever obligatory for them to kill patients," the hospital said in a written statement.
INT. NEWSDESK - DAY
NEWSREADER: That claim has come under particular scrutiny.
INT. GAME FOOTAGE LEVEL ONE
# GAME FOOTAGE: KILL THE PATIENT 2
NEWSREADER: The first level of the game is titled KILL OR GAME OVER.
NEWSREADER: Upon beginning the level, the player is handed a machine gun and presented with the instruction: "KILL AS MANY PATIENTS AS POSSIBLE, OR GAME OVER!"
INT. GAME FOOTAGE REFUSAL
NEWSREADER: Players who refuse to fire reportedly receive an immediate game-over screen reading, "YOU SAVED THE PATIENTS. YOU LOSE."
INT. GAME FOOTAGE PAYOUT
REPORTER: More controversially, the machine dispenses real U.S. currency through a slot beneath the controls based directly on the number of patients killed during gameplay.
INT. CABINET SIGN - DAY
REPORTER: A printed sign attached to the machine explains the exchange rate as "$1 PER PATIENT — NO DAILY LIMIT."
INT. HOSPITAL PRESS ROOM - DAY
REPORTER: Asked how this system was compatible with the hospital's claim that players were "never explicitly rewarded" for killing patients, a board representative said the cash should be understood as...
BOARD REPRESENTATIVE: An interactive commentary on financial incentives within the American healthcare system.
BOARD REPRESENTATIVE: The fact that money physically comes out of the machine after you kill a patient does not necessarily mean the money is a reward for killing the patient.
BOARD REPRESENTATIVE: Correlation should not automatically be interpreted as causation.
INT. GAME FOOTAGE DEMO
REPORTER: Reporters then demonstrated that shooting a patient caused the words +$1 PATIENT BONUS to appear on screen immediately before a dollar bill emerged from the cabinet.
INT. HOSPITAL PRESS ROOM LATER - DAY
(long pause)
REPORTER: The representative declined further questions.
INT. NEWSDESK - DAY
# 'WE THOUGHT IT WAS A DIFFERENT GAME'
NEWSREADER: Several board members have sought to distance themselves from the purchase.
INT. ARCADE ADMINISTRATORS - DAY
NEWSREADER: One administrator claimed the hospital believed it had ordered a medical education simulator.
ADMINISTRATOR: I was told it was about difficult decision-making in healthcare. I did not personally play it.
NEWSREADER: Another said he had assumed the title No Alibi referred to "documentation standards."
SECOND ADMINISTRATOR: Documentation standards.
NEWSREADER: A third board member claimed the sequel had been approved because administrators believed it was significantly different from the original game.
BOARD MEMBER: Obviously, if it had simply been called Kill the Patient Again, that would have raised concerns.
BOARD MEMBER: But the subtitle No Alibi suggested to us that the developers had taken the franchise in a more mature direction.
INT. GAME FOOTAGE ATTRACT MODE
NEWSREADER: The game's own promotional material describes Kill the Patient 2 as "BIGGER, BLOODIER AND LEGALLY INDEMNIFIED."
INT. LAW OFFICE - DAY
REBECCA HALL: One could imagine a hospital making this mistake once.
REBECCA HALL: What is remarkable is that they apparently went through the experience of being sued for $20 million over a game called Kill the Patient, conducted an internal review, and then encountered a game called Kill the Patient 2: No Alibi and thought, 'Yes, that one.'
INT. NEWSDESK - DAY
NEWSREADER: Hospital officials insisted that lessons had been learned from the previous litigation.
INT. HOSPITAL PRESS ROOM - DAY
HOSPITAL SPOKESPERSON: The original situation and the present situation are completely different.
REPORTER: Asked to explain the difference, a spokesperson replied...
HOSPITAL SPOKESPERSON: This is the sequel.
INT. NEWSDESK - DAY
# BOARD LAUNCHES INVESTIGATION INTO BOARD
NEWSREADER: The hospital has now announced an independent investigation into how the machine was approved.
NEWSREADER: The investigation will be overseen by a five-member committee composed of hospital board members, including three who voted to purchase the machine.
INT. COMMITTEE ROOM - DAY
MARTIN BELL: We intend to establish exactly who allowed this to happen.
INT. AUTHORIZATION GRAPHIC
REPORTER: Records obtained by reporters show Bell personally signed the purchase authorization beneath a handwritten note reading, "Finally! Loved the first one."
INT. COMMITTEE ROOM - DAY
REPORTER: Bell said he could not recall writing the note.
INT. HOSPITAL ARCADE - DAY
REPORTER: The machine remained operational as of Wednesday afternoon.
INT. NEWSDESK - DAY
# BREAKING: NEW QUESTIONS AFTER "KILL THE PATIENT 2" FOUND TO CONTAIN SO-CALLED "PENIS SENSOR"
NEWSREADER: Hospital Faces New Questions After 'Kill the Patient 2' Found to Contain So-Called 'Penis Sensor'.
NEWSREADER: The hospital says the controversial peripheral is "not sexual in nature" and merely enhances realism during urination and "other experiences."
NEWSREADER: The hospital already facing mounting criticism over its decision to install Kill the Patient 2: No Alibi in its on-site arcade is now confronting an additional controversy after it emerged that the machine contains what its manufacturer describes as a "Penis Sensor."
INT. CABINET FLAP - DAY
REPORTER: The peripheral, located beneath a small plastic flap on the front of the arcade cabinet, is accompanied by an instruction label reading: "FOR FULLY IMMERSIVE EXPERIENCE, INSERT PENIS INTO SENSOR WHEN PROMPTED."
INT. NEWSDESK - DAY
NEWSREADER: Hospital officials initially said they were unaware that the feature existed.
NEWSREADER: Several hours later, after photographs of the instruction panel circulated online, the hospital issued a statement clarifying that the device was present but insisting there was "no sexually explicit content whatsoever" in the game.
INT. SENSOR STATEMENT GRAPHIC
NEWSREADER: "The peripheral is not sexual in nature," the statement said. "It is an optional immersion device intended to enhance realism during certain routine human activities, including urination and other experiences."
INT. NEWSDESK - DAY
NEWSREADER: The hospital did not elaborate on what "other experiences" meant.
INT. HOSPITAL PRESS ROOM - DAY
REPORTER: When asked repeatedly during a press conference, a spokesperson said the phrase should not be interpreted "in a sensational or prurient manner."
HOSPITAL SPOKESPERSON: It refers to other experiences.
HOSPITAL SPOKESPERSON: That is the terminology used by the manufacturer.
INT. NEWSDESK - DAY
# 'FULLY IMMERSIVE'
NEWSREADER: GB Krews has asked the manufacturer exactly when the sensor becomes active. We are still waiting for an answer.
[FADE]
`,
);

export const KREWS_BURNHAM_FIRST_ACT = ep(
  "krews_burnham_first_act",
  "Andy Burnham's First Act",
  46,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# BREAKING: THE NEW PRIME MINISTER'S FIRST ACT
NEWSREADER: We go live now to Downing Street, where the new Prime Minister, Andy Burnham, is about to announce his first act in office.
EXT. 10 DOWNING STREET - DAY
# LIVE: DOWNING STREET · THE PRIME MINISTER'S FIRST ACT
(A crisp morning. Union Jack flutters. A modest but enthusiastic crowd of northern transplants, flat caps, and hi-vis jackets has gathered.)
(Andy Burnham steps up to the podium. He beams like a man who just won the Pools.)
ANDY BURNHAM (raising both arms): Ladies and gentlemen... and southerners watching from your overpriced pretend-houses... today is a new dawn for this country!
(The crowd cheers wildly. A few confused civil servants clap politely from the doorway.)
ANDY BURNHAM: As your new Prime Minister, my first act in office is to introduce a landmark piece of legislation. One that will finally, once and for all, prove that the North is the best!
(He slams a fist on the podium. The crowd goes mental.)
ANDY BURNHAM: The law states, quite simply: The North is much better than the South! Legally binding. No appeals. We're putting it in the bloody constitution!
(Cheers erupt. Someone in the back throws a Greggs sausage roll in celebration.)
ANDY BURNHAM: And to celebrate this historic moment...
(He gestures. An aide awkwardly brings forward an enormous white bowl overflowing with thick chips swimming in brown gravy.)
ANDY BURNHAM: ...I'm going to enjoy a proper northern meal!
(He grabs a massive spoon, digs in like a man possessed, and shovels chips and gravy into his mouth.)
[SFX burn_chew]
[SFX burn_burp]
(The journalists stare in stunned silence. A pigeon lands on a camera.)
ANDY BURNHAM (mouth full, gravy everywhere): Fock me... so good I could eat it twice...
(He pauses. A glint in his eye.)
ANDY BURNHAM: Actually... mm... that gives me an idea.
(He sticks two fingers down his throat. The crowd gasps.)
[SFX burn_vomit]
(Without missing a beat, Burnham picks up the bowl and starts eating the vomit with the same spoon.)
ANDY BURNHAM (beaming, mouth full): You'll never catch a southern fairy doing this, r kid!
[CUT]
INT. WETHERSPOONS - MANCHESTER - DAY
(A classic 'Spoons. A muted TV in the corner is showing the live press conference. Four Northern Blokes are eating their own regurgitated meals.)
NORTHERN BLOKE 1 (mouth full, chewing vomit): Is sumfin happenin' on t'telly? Is that the new character in Corrie?
NORTHERN BLOKE 2 (shovelling more puke-chips): Dunno, pass us the gravy.
NORTHERN BLOKE 3 (burping loudly): Aye. So 'ow does this 'ole voting fing work then?
NORTHERN BLOKE 4 (wiping vomit from his chin with a sleeve): I'm not sure, let me just eat some more of me own vomit and I'll tell ye, r kid!
(They all laugh and continue eating, completely oblivious. One raises his bowl in a toast.)
NORTHERN BLOKE 1: To the North!
ALL: To the North!
[SFX burn_toast]
[CUT]
EXT. 10 DOWNING STREET - CONTINUOUS
(The journalists are in open-mouthed horror. One female reporter stands up, microphone in hand.)
REPORTER: Prime Minister, this is offensive! It plays on crude stereotypes of gluttonous and ignorant northerners!
ANDY BURNHAM: Offensive? You're not a real man, are you, love? Proper southern snowflake. Watch and learn how we do it up North.
[SFX burn_gurgle]
ANDY BURNHAM: Urghh... need to shit...
(He squats slightly behind the podium.)
[SFX burn_splat]
(The crowd recoils. Cameras flash. Aides look like they want to die.)
(Burnham picks up the bowl again, mixes it into the vomit-chips with his spoon, and starts eating it enthusiastically.)
ANDY BURNHAM (mouth full, grinning): This is how real northerners do it! None of that fancy southern bollocks. Proper, honest grub straight from the gut!
(The crowd is a mix of horrified silence and a few die-hard cheers. Burnham takes another big spoonful and waves at the cameras.)
[FADE]
`,
);

export const KREWS_RAMSEY_TURKEY = ep(
  "krews_ramsey_turkey",
  "'Food History Moment' Sparks Outrage",
  48,
  `[MUSIC news start]
# GB KREWS 24
INT. NEWSDESK - DAY
[MUSIC news fade]
# "FOOD HISTORY MOMENT" SPARKS OUTRAGE AFTER GORDON RAMSEY'S BIZARRE ON-AIR COOKING DEMONSTRATION
NEWSREADER: London. Celebrity chef Gordon Ramsey is under intense scrutiny this week following a now-viral segment from his new Channel 4 documentary series Food History Moment, in which the culinary icon describes cooking as "very erotic" before performing what many are calling an "unhinged and symbolic" act involving a turkey.
NEWSREADER: The series, intended to explore the intersections of food, culture, and identity, features Ramsey interviewing experts across disciplines while preparing historical dishes.
NEWSREADER: But a scene from Episode 2 — titled The Domestic Table: Desire and Power — has triggered backlash and bewilderment in equal measure. A warning: viewers may find the following footage unsettling.
INT. FOOD HISTORY MOMENT KITCHEN - DAY
# FOOD HISTORY MOMENT · EPISODE 2: THE DOMESTIC TABLE: DESIRE AND POWER
NEWSREADER: In the segment, Ramsey is seen preparing a traditional roast bird while speaking with feminist food theorist Dr. Leigh Bramwell.
DR LEIGH BRAMWELL: [calm] For centuries, the kitchen was where women's labour went unseen. The roast arrived at the table; the hours behind it never did.
NEWSREADER: As the two discuss the historical burdens of domestic labor and the gendered role of women in kitchens, Ramsey abruptly pivots:
(He runs his fingers along the skin of the turkey.)
GORDON RAMSAY: [sultry] You know, the act of cooking is very erotic. It's sensual. You touch, you taste, you penetrate...
DR LEIGH BRAMWELL: [shocked] I'm sorry?
GORDON RAMSAY: [whispers] Into the vagina of the turkey.
[INSERT knife 1]
NEWSREADER: Without warning, Ramsey then aggressively slid a carving knife into what he referred to as "the vagina of the turkey" — a biologically inaccurate term that nonetheless appeared intentional.
[INSERT slice 2]
GORDON RAMSAY: [sultry] Mmmmh.
NEWSREADER: He bit his lip and groaned softly as he began slicing into the meat "for no clear culinary reason," according to one viewer,
[INSERT stunned 1]
NEWSREADER: all while maintaining unnervingly intense eye contact with Dr. Bramwell, who appears visibly stunned in the footage.
INT. VIEWER REACTION TRENDING GRAPHIC
NEWSREADER: The clip has been viewed millions of times, and viewers have not held back.
INT. NEWSDESK - DAY
# CHANNEL 4: NO COMMENT
NEWSREADER: Channel 4 has not commented. Dr. Bramwell has not commented.
NEWSREADER: The turkey was unavailable for comment.
[FADE]
`,
);

export const KREWS_STORIES_EPISODES: TVEpisode[] = [KREWS_KLOPP_BRIBE, KREWS_SUNAK_BOMB, KREWS_STARMER_SAGA, KREWS_STARMER_VIDEO, KREWS_CRASH_MODE_LIVE, KREWS_ARSEBRUSH, KREWS_KILL_THE_PATIENT, KREWS_BURNHAM_FIRST_ACT, KREWS_RAMSEY_TURKEY];
