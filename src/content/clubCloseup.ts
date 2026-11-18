// THE WONKY POLE, "watch up close" (src/game/scenes/club/ClubCloseup.ts): what each lad moans in his cut-in panel.
// The wonking is only ever implied: a censor bar over the lap, motion lines round it, and these noises.
// Speech bubbles only, deliberately NOT { s, t }: the lads' voices are their real owners' (clones/designs of real
// people), and nobody agreed to their voice moaning, so voice-extract never picks these up. The noises under them
// are the synth's generic moans (synth.voice) and the recorded crowd moans (moan_men_*).
export interface CloseupLine {
  s: string;
  t: string;
  mood?: string;
}

export const CLOSEUP_MOANS: { who: string; text: string }[] = [
  { who: "FLENKY", text: "Oh. Oh Jenko. Jenko's never been this close." },
  { who: "FLENKY", text: "Mmm fuck. She's mine. Jenko has wonked." },
  { who: "KREZMAR", text: "Mmm. Motion to go closer. Seconded. Mmmm." },
  { who: "KREZMAR", text: "Oh that's the blues. That's the blues, that." },
  { who: "KREBLIS", text: "mmm. i will be messaging her about this. mmm." },
  { who: "KREBLIS", text: "Breaking news. Oh. Oh no. Oh yes." },
  { who: "KREZWONK", text: "The omens said up close. Mmm. The omens were right." },
  { who: "KREZWONK", text: "I foresaw this. Ohhh. I foresaw all of this." },
  { who: "SCROMBUS", text: "Mmm. Lovely. Bit closer. Ta." },
  { who: "SCROMBUS", text: "Ohhh. Ta very much. Mmm." },
  { who: "KREBON", text: "Better than a gig, this. Mmmm." },
  { who: "KREBON", text: "Ohhh. She's coming to my gig. Oh she is." },
  { who: "CRONGUS", text: "Mmm. Like a big pudding. Up close." },
  { who: "CRONGUS", text: "Oh. Oh I'm Lil'. But not right now." },
  { who: "GRONNY", text: "Waa waa weeee. Mmm. Lovely day for it." },
  { who: "GRONNY", text: "Ohhh. Buying gf. Buying gf right now." },
];

/** Shouted up at the screen from the front row, in caps, when the last of it comes off. */
export const CLOSEUP_GASPS = ["OHHHH", "MMMMM", "OH MY DAYS", "FUUUUCK", "OH YES", "NNNNGH", "AAAA"];

/** Big Derek (fictional, a designed voice), palm over the lens: recorded like any other line. */
export const CLOSEUP_DEREK: CloseupLine = { s: "BIG DEREK", t: "SHOW'S OVER, LADS. Hands where I can see them.", mood: "shouting" };

/** The last cut-in: YOU. Speech bubbles only (your lad's voice is a real person's, same as the front row's). */
export const CLOSEUP_YOU = ["Oh. Oh no. Oh YES.", "Mmmm. Worth every Krezzcoin.", "Don't look at me. Mmmm.", "This is the best ten quid I've ever spent.", "Oh she's looking at me. Mmmm. MMMM."];

/** And she thanks you for it, dressed again, beaming: recorded in her own (designed) voice. */
export const CLOSEUP_THANKS: CloseupLine[] = [
  { s: "DESTINY", t: "Aww, thank you, babe. That's a tip, that.", mood: "sultry" },
  { s: "DESTINY", t: "Thanks, darling. Same time next week?", mood: "sultry" },
  { s: "CRYSTAL", t: "Aww, ta, love! Thank you!", mood: "sultry" },
  { s: "CRYSTAL", t: "Thanks, babe. I'll put that one down as a tip.", mood: "sultry" },
];
