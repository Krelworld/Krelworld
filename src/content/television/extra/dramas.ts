import { parseScreenplay, type TVEpisode } from "../../../game/systems/tv";

// Supplied screenplays, kept as written apart from Krelworld names (Charlie Polson is Polson, Sally Polson is
// Polson's Mum, Lucy is Eden, Harry is Drongus, Rory is Krezmar, Jenko is Flenky) and these changes:
// - Gumption and Gravy: none beyond the names.
// - The Sopranos: as written (the opening scene, with Carmela's "Jesus Christ, Tony!" back in). Its id is still
//   krews_soprano (it first went out as a Krunche News "reconstruction"; saves remember it by that id).
// - Mole of Thrones: it opens on Jenko spotting the casting call (the poster scene is cut); the director calls him
//   "Extra Number 3" and it's a see-through sack, and he's arrested for indecent exposure.
// Shot in the genre each one parodies: a moody crime drama (tv/CrimeDrama.ts), a prestige fantasy drama crossed
// with a behind-the-scenes mockumentary (tv/FantasyDoc.ts) and a prestige New Jersey mob drama (tv/MobDrama.ts).

const DRAMA = "BBK ONE";

const ep = (id: string, show: string, title: string, script: string, extra: Partial<TVEpisode> = {}): TVEpisode => ({
  id,
  channel: DRAMA,
  show,
  title,
  episodeNumber: 1,
  beats: parseScreenplay(script),
  ...extra,
});

export const DRAMA_GUMPTION_GRAVY = ep(
  "drama_gumption_gravy",
  "Gumption and Gravy",
  "Gumption and Gravy: A Psychodramatic Murder Mystery",
  `
[MUSIC gg_theme start]
EXT. POLSON'S HOUSE - NIGHT
(Rain. A small car on the drive. The front door stands ajar.)
INT. POLSON'S LIVING ROOM - NIGHT
(SALLY POLSON, 65, Polson's Mum, morbidly obese, her body heaving with every breath, pushes open the door to her son's house.)
(Her face is a mix of concern and frustration as she lumbers inside, her clothes soaked with sweat from the short walk from her car. She freezes, eyes wide, at the sight before her.)
(POLSON, 37, lies lifeless on the floor, a gaping wound in his chest, blood pooling around him.)
(A pink, shiny handgun with "EDEN" spelled out in cheap diamante stickers rests beside his body, its barrel still smoking.)
(Sally drops to her knees with a heavy thud, the impact sending a ripple through her body. She throws her head back, a guttural scream tearing from her throat.)
POLSON'S MUM (screaming): No! My baby!
# GUMPTION AND GRAVY: A Psychodramatic Murder Mystery
(Sally's eyes dart frantically from Polson's wound to the gun, and then to EDEN, 27, who stands frozen in the corner, her face pale, eyes wide with shock.)
(Sally's breath quickens as the pieces start to fall into place in her mind.)
POLSON'S MUM (quietly, to herself, then growing louder): He's... he's died of a broken heart! Drongus and Mikey's bullying campaign did this! Their words—they literally ruptured his skin! I'll have their heads for this! I'm calling their places of employment! Especially since they don't have the gumption to talk to me!
(Eden, still in shock, suddenly seems to relax, her face softening as she nods in agreement.)
EDEN (nervously): Our plants... they've lost their plant dad... If I didn't have the spoons before today...
(Sally, distracted by her own hunger and fatigue, cuts Eden off.)
POLSON'S MUM (musing): Speaking of spoons, do you have any fudge or Nutella? I need some extra energy before calling the police.
(Eden, eager to please, hurries to the kitchen. A moment later, she returns with a large bowl filled to the brim with melted fudge and Nutella. She places it on the floor.)
(Sally and Eden get down on all fours, their faces inches from the bowl.)
(They begin to eat directly from it, their breath heavy, chomping and growling at each other if one gets too close to the other's side of the bowl.)
(The scene is interrupted by the SOUND of SIRENS outside.)
(Two POLICE OFFICERS burst into the room, their eyes immediately locking on the smoking handgun by Polson's body.)
(Their gazes then shift to Eden, who still has traces of fudge around her mouth.)
OFFICER 1 (gravely): Miss Eden, you're under arrest for the murder of Mr. Polson.
(Sally, her face flushed and sweaty, scrambles to her feet, towering over the officers.)
POLSON'S MUM (screaming): How dare you have the GUMPTION to make such a suggestion!
(The officers exchange a glance, taking in the scene: the gun, the blood, the state of the room. Eden's expression is one of fear, but also a strange, unsettling calmness.)
OFFICER 2 (pointing to the gun): Ma'am, that's her gun. The barrel is still smoking.
POLSON'S MUM (indignant, almost smug): And look at how tidy the house is! Eden is wonderful for my autistic, dead son! You're all part of Drongus and Mikey's bullying conspiracy, aren't you? Accusing Eden—ha!—you're nothing but pawns in their sick game!
(Sally's hand reaches for the gun on the floor. She picks it up and points it directly at the officers, her expression one of arrogant defiance.)
POLSON'S MUM (sneering): No one DARES have the GUMPTION to talk to Sally Polson in such a way!
(The officers react instinctively, drawing their weapons.)
OFFICER 1 (shouting): Drop the weapon!
(Sally takes a step forward, gun still raised. The officers have no choice. They open fire.)
(Sally collapses, her large frame hitting the floor with a sickening thud.)
(Eden, still on all fours, stares at Sally's lifeless body, her mind racing. The officers, breathing heavily, glance at each other, then back at Eden.)
OFFICER 2 (grimly): She's seen too much.
(Without hesitation, they turn their guns on Eden. The shots ring out, echoing through the house.)
(Eden falls beside Sally, their bodies sprawled in a grotesque tableau of death and dessert.)
(As the officers holster their weapons and begin to exit, a notification chimes on their phones. They both check their screens.)
(TEXT MESSAGE from "Drongus B. Drippin'": Good work, lads... next target—Jenko.)
(The officers exchange a knowing look before slipping out the door, leaving the blood-soaked room behind.)
[FADE]
# THE END
`,
);

export const DRAMA_MOLE_OF_THRONES = ep(
  "drama_mole_of_thrones",
  "Mole of Thrones",
  "Mole of Thrones",
  `
INT. JENKO'S BEDROOM - DAY
(JAMES "JENKO" JENKINS, 30, CBT therapist, smug, and a self-proclaimed genius, lounges on his bed, scrolling through his laptop.)
(RUTH, 28, his patient but increasingly disillusioned fiancée, folds laundry nearby.)
(Jenko suddenly freezes, staring at the screen. His eyes widen. His excitement turns to glee.)
RUTH: What are you looking at?
FLENKY (whispering): A new competition... Game of Thrones... and they're looking for someone with a high IQ and... off-putting facial deformities like moles?! Heroic real-life traits?! Three strikes, Ruth! It's like the role was made for me!
(Ruth deadpans, unimpressed.)
RUTH: You had the mole removed, remember?
(Jenko's grin falters. His hand slowly moves to his now-smooth cheek, a flicker of rage crossing his face.)
FLENKY (angrily): Why did I ever listen to you?!
RUTH (rolling eyes): You were sick of kids calling you "Moley Jenko."
(Jenko snaps his fingers, suddenly brightening up.)
FLENKY: But I kept it as a keepsake! Maybe they'll let me stick it back on for the role.
(He rushes to his dresser, triumphantly pulling out a small, grotesque jar containing his former mole. Ruth watches, both bemused and mildly horrified.)
FLENKY: It's perfect.
# MOLE OF THRONES
(Jenko immediately dials a number on his phone.)
INT. GEORGE R. R. MARTIN'S OFFICE - DAY
(We hear GEORGE R. R. MARTIN's deep, gruff voice on the other end of the line.)
GEORGE R. R. MARTIN (on the phone): Hello, who is this?
FLENKY: Mr. Martin! This is James Jenkins—an expert in human psychology, with an IQ of 160. I saw your casting notice, and I think I'm perfect for the role!
(Martin pauses, intrigued.)
GEORGE R. R. MARTIN (on the phone): You're perfect for the role. My intuition has never failed me.
(Jenko beams, relieved, but quickly adds:)
FLENKY: I've even got a mole! Well... I had a mole. It's, uh, surgically removed... but I still have it! It's in a jar. I could, like, glue it back on for the role? Just temporarily?
(There's a long pause.)
GEORGE R. R. MARTIN (on the phone): For the first time in my life, my intuition was wrong. You won't work for the role. This is showbiz, Jenko. We need permanent moles.
(Jenko panics.)
FLENKY: But... please! I can get it reattached!
(Martin grumbles.)
GEORGE R. R. MARTIN (on the phone): Surgically reattach it, permanently. Otherwise, you're out.
INT. DOCTOR'S OFFICE - DAY
(Jenko sits across from his DOCTOR, nervously clutching the jar containing his now-fluffy, hair-covered mole.)
DOCTOR: I can do it... but it'll be permanent. No going back. The mole will be there for the rest of your life.
(Jenko hesitates, glancing at the jar. The mole looks even more grotesque than before.)
FLENKY (whispering): It's for the role of a lifetime.
(He slides the jar across the table.)
INT. HOSPITAL ROOM - DAY
(Jenko wakes up post-op, a large bandage covering his cheek. He looks groggy but determined.)
NURSE: All done, Mr. Jenkins. You're ready for... whatever it is you're doing.
(Jenko touches his bandaged face with reverence.)
EXT. STREET - DAY
(Jenko leaves the hospital, strutting confidently down the street.)
(Women shoot him looks of disgust, recoiling as they pass. He grins, oblivious.)
INT. JENKO'S APARTMENT - NIGHT
(Jenko, fully bandaged but now wearing a self-tailored medieval robe, sits across from Ruth as they discuss his upcoming role.)
FLENKY: My character is Ser Thorlin of Pentos. Highborn, a master of the seven languages, silk merchant, and—oh yes—the most intelligent man in all the Seven Kingdoms.
(Ruth swoons, leaning in.)
RUTH (adoring): You're so much smarter than your friends. No wonder they're all jealous... I didn't believe you at first, but now I see why Drongus, Diet, Krezmar, and Brinkley resent you.
FLENKY: Exactly. They just don't understand genius.
(Ruth sighs dreamily as Jenko stares off in thought.)
INT. FILM SET - DAY
(Jenko bursts onto the set, dressed in his custom-tailored robe, speaking in a highly affected medieval accent.)
FLENKY (affected medieval accent): Ser Thorlin of Pentos, at your service!
(A gruff COCKNEY DIRECTOR squints at Jenko, confused.)
DIRECTOR: 'Oo are ya?
FLENKY (offended): I was cast for the role! The competition?
(The director glances at his clipboard.)
DIRECTOR (patronising): Oh yeah, Extra Number 3. Right. You need to get changed into your sack.
(Jenko freezes, eyes wide.)
FLENKY: My... my what?
DIRECTOR (points): That see-through sack over there. You're gonna do a little dance for us. Seductive-like.
(Jenko's heart sinks. He looks over to see several men dressed in transparent sacks, waiting in line.)
DIRECTOR: Come on, lad. They're all waitin' to replace ya. In this version of Game of Thrones, we've got some stuff from the future. Bluetooth speakers, R&B... we explain it as 'electricity magic.' It's all part of the new aesthetic.
(Jenko blinks, trying to process the madness.)
DIRECTOR (enthusiastically): Come on then, lad! Dance like you mean it.
(The director cranks up some contemporary R&B on the Bluetooth speaker.)
DIRECTOR: Alright, dance. And when you're done, approach the mannequin, tell it your mole's gettin' hard.
(Jenko, mortified, begins to dance awkwardly.)
FLENKY (weakly): You're making my mole hard...
(The director, unimpressed, gestures to the crew.)
DIRECTOR: Alright, sack off! Time for full frontal.
FLENKY: But... I'm... shrivelled. It's cold.
DIRECTOR: We'll fix it in post, mate. Get on with it.
(Jenko reluctantly removes the sack.)
(Suddenly, the green screen lifts, revealing an AUDIENCE of FRIENDS and FAMILY staring back at him, laughing hysterically.)
[BIG LAUGH]
(His mother points, tears streaming down her face.)
FLENKY'S MUM (laughing hysterically): That's our son's penis!!
(His father groans and involuntarily jerks back and forth in his seat, completely unaware of his surroundings but seemingly enjoying himself due to his ataxia. Drool runs down his lips as his body spasms rhythmically.)
(GEORGE R. R. MARTIN steps forward, beaming.)
GEORGE R. R. MARTIN: This... is my finest work.
(Before Jenko can react, a team of POLICE storms in, cuffing him.)
POLICE OFFICER: You're under arrest for indecent exposure. And for that mole.
(Jenko's world collapses as he's dragged off the set, his dream shattered.)
[FADE]
# THE END
`,
);

export const DRAMA_SOPRANOS = ep(
  "krews_soprano",
  "The Sopranos",
  "The Sopranos: Chicken Piccata",
  `
[MUSIC ominous start]
# THE SOPRANOS
EXT. THE SOPRANO HOUSEHOLD - NIGHT
[MUSIC ominous fade]
INT. THE SOPRANO HOUSEHOLD - NIGHT
(Tony walks into the living room, beer in hand, belly hanging out. Carmela is on the couch, deeply engrossed in an episode of Family Guy.)
TONY SOPRANO: Hey, Carm, I been thinkin' of gettin' one o' dem penis enlargements.
(Carmela doesn't even glance away from the TV.)
CARMELA SOPRANO: Tony, I'm trying to watch Family Guy. I wanna see what happens next with Peter.
(Tony glares at the screen, sees Peter Griffin laughing maniacally as he farts on Lois's face. A deep, primal rage boils in his gut.)
(Without a word, he picks up a decorative brick from the fireplace and hurls it full force at the TV.)
(Sparks fly, the screen shatters, and Carmela screams as the room goes dark.)
CARMELA SOPRANO (screaming): Jesus Christ, Tony!
(Before she can react, Tony grabs her by the hair and shoves her face into the steaming plate of chicken piccata on the coffee table.)
(She lets out a muffled shriek as sauce splatters everywhere.)
[CUT]
# THE SOPRANOS
`,
  { sets: { SOPRANO: "k4_lounge" } },
);

export const DRAMA_EPISODES: TVEpisode[] = [DRAMA_GUMPTION_GRAVY, DRAMA_MOLE_OF_THRONES, DRAMA_SOPRANOS];
