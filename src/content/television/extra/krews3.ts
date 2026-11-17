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
NEWSREADER: The downloadable content, which controversially encourages pilots to deliberately crash their aircraft, was further condemned for its inclusion of an interactive "penis sensor."
NEWSREADER: We can take you to that ill-timed press event now.
INT. MICROSOFT KEYNOTE STAGE - DAY
# LIVE: REDMOND · "CRASH MODE" ANNOUNCEMENT
EXECUTIVE: Thank you! Thank you. Ladies and gentlemen: Flight Simulator. Crash Mode.
[SFX explode_1]
EXECUTIVE: For the first time ever, players are rewarded for mid-air collisions. Deliberately crash your aircraft. Rack up the points.
REPORTER: Sir! A plane went down over Krelford yesterday. Is the timing not...
EXECUTIVE: And that's not all. Introducing the interactive penis sensor, delivering unimaginable and forbidden pleasures.
[GASP]
EXECUTIVE: The sensor attaches to the player's groin. It vibrates, and moistens, in sync with on-screen activities.
JOURNALIST: What has that got to do with flying a plane?
EXECUTIVE: Great question. When you land, pilots are encouraged to seduce air stewardesses, and visit gentlemen's table dancing clubs.
INT. NEWSDESK - DAY
# OUTRAGE ERUPTS
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

export const KREWS_STORIES_EPISODES: TVEpisode[] = [KREWS_KLOPP_BRIBE, KREWS_SUNAK_BOMB, KREWS_STARMER_SAGA, KREWS_STARMER_VIDEO, KREWS_CRASH_MODE_LIVE, KREWS_RAMSEY_TURKEY];
