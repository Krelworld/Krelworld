# KRELWORLD: KrelTV promo ("channel surf") plan

## How TV-parody and channel-surfing promos are cut
- **Channel surfing / zapping.** Its rhythm is constant skipping: you stop on a show just long enough to get the joke, then move on. *Sunset Television* and the short *Channel Surfing* build whole sketches out of fake shows, adverts and home shopping glued together by zaps. The comedy comes from the abrupt change of tone between clips.
- **Adult Swim bumps.** Short, deadpan text cards between programmes, with the network voice addressing the viewer directly.
- **"Tonight on…" network promos.** An announcer's hook, then a run of each show's money line, then a network ident and logo.
- **The Day Today / Brass Eye.** The graphics and idents are slick and self-important, a straight copy of real news idents, and the joke is all in the content. Sombre delivery of absurd copy is the engine, so lines must land deadpan with no music stepping on them.
- **Simpsons and Futurama TV-gag montages.** Each cut is one set-up plus a punchline, usually under 5 s. A snap zoom or freeze on the punchline. A recurring "back to the studio" style button.
- Sources:
  - <https://en.wikipedia.org/wiki/Zapping>
  - <https://www.tubefilter.com/2009/08/10/amazing-absurdist-mashup-humor-appears-just-before-dark-on-sunset-television/>
  - <https://www.artofthetitle.com/title/the-day-today>
  - <https://en.wikipedia.org/wiki/The_Day_Today>
  - <https://tvtropes.org/pmwiki/pmwiki.php/Main/BlipVert>

## Shape (about 85–90 s, 1920x1080, 60fps)
1. **Cold open.**
   - The living room at home, push in on the little telly.
   - Remote click, CRT switch-on.
   - The Kreddle President's broadcast: "Sit down, watch the telly, get hooked on the telly."
2. **Hook card.** Static, then "TONIGHT ON KRELTV". Narrator (Callum): "Tonight… on KrelTV."
3. **Channel surf.** Every cut is a remote click, 4–8 frames of static on the screen only, and a green VCR on-screen display ("CH 01 KRUNCHE NEWS"). We land on a set-up and stay to the one-liner. Punchlines get a hard snap-zoom from the telly to the screen.
4. **Rapid-fire run.** The clicks get faster: shorter stops, one-line button gags.
5. **Button.** The Kreddle President again: "Keep watching, Krelworld. Keep watching. NO FURTHER QUESTIONS!" Then the CRT switches off.
6. **End card.**
   - "KRELTV: SEEN BY 9", with the narrator saying "KrelTV. Seen by nine."
   - Small text: "KRELWORLD · PLAY FREE IN YOUR BROWSER".

## Sound
- **Lines.** The game's own recorded lines, cut from public/audio/voice bundles via index.json, and nothing invented for characters.
- **Picture sync.** The in-page voice is replaced by a silent stand-in that stays "busy" for the recording's exact length in game time. The TV paces exactly as it does with voices on, and every line start is logged per frame.
- **Sound effects.**
  - Remote click, CRT on/off, news sting and end jingle: ElevenLabs SFX.
  - Static: generated noise.
  - Show beds where the game ships one as a file: klerble.mp3 and krelbank_ad.mp3.
- **Loudness.** Loudness-normalised to −14 LUFS.

## Capture
- Capture uses Playwright with a fake clock. The clock is paused, so only runFor(16) moves time: one frame equals 16 ms of game time.
- The canvas is read on Phaser postrender at 960x540, then nearest-neighbour upscaled to 1920x1080.
- The game is paused while loads are pending.
- HMR is blocked.
- Our own Vite server runs on port 5195.
- **Host and playback.** HomeScene is the host, and the TV overlay plays each episode exactly as in the game. The episode is skipped to the line we want with the TV's own skip-line control, then plays naturally.

## Content rules applied
- **Chapters.** Chapters 1–5 only:
  - Most KrelTV shows are on from the start.
  - News at Six eps 3 and 4 unlock after Ch2 and Ch3.
  - The Klerble welcome is the Ch1 opener.
- **Excluded episodes, and why:**
  - **Klerble presser:** asked for, and it is Ch6.
  - **Kreddle Raid "KLERBLE TV" big screen:** Ch6.
  - **Thick Cumming Cock ep 7:** the 9/11 cut.
  - **President Han:** 9/11 and dead children.
  - **Microsoft Crash Mode:** plane-crash victims.
  - **Pelé, Jimmy Carter and the Chomsky obituary/brain/triad stories:** real people's deaths and illness.
  - **SanMik crocodiles:** 62 killed.
  - **Boulder prank:** deaths.
  - **Wildern bulletin:** children killed.
  - **Krandall segment, Cookie Monster, Grocery sketch, Juror No. 2, Starmer age-of-consent / Wetherspoons / Wallace / justice stories, Cronster:** minors or sexual misconduct near sexual content.
  - **Peep Show:** age jokes, a 9/11 line, a murder.
  - **EastEnders:** children in the same scene as sexual jokes.
  - **Best Man:** suicide.
  - **Harumpis:** blackface.
  - **Bradford:** religious stereotype.
  - **Dr. Puss:** sexual.
  - **Gordon Ramsay turkey:** sexual.
  - **Chancellor:** self-harm.
  - **Ben Burgis sketches:** mocking a real person's body and health.
  - **Funeral sketch:** a death.
  - **Gumption & Gravy:** a dead disabled son.
  - **Starmer meat-grinder video:** a child's death.
  - **Mario Kart/Tate:** real criminal allegations.
- **Real public figures.** They appear only in lines exactly as the game presents them, with nothing added.
