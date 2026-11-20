# Pacing, repetition and voices

What changed to make a KREPLIN week faster, less repetitive and a bit more like a
football-management sim. Code: `src/016b-kpacing.js` (helpers), `src/087y-season-texture.js`
(Seasons 1–2 beats + Season 3 scheduler), `src/087x-voices.js` (voices).

## Fewer clicks per week

Measured with `node tools/autoplay.js --lean --clicks` (the bot takes the quickest path to the
next match; `--clicks` counts the game's `choose()` menus per week, "gates" = one-button menus).

| | menus / week | pure "advance" gates |
|---|---|---|
| before | 9 (door, pre-match, Kickoff Options, drink, wages, Post-Match, Evening, evening menu, Next Week) | 3 |
| after | 3 (pre-match, wages, evening menu) | 0 after an early night, otherwise 1 ("Next week ▸") |

Plus the half-time team talk, which is still a decision. What changed:

- **Kick-off from the pre-match menu**: `▶ Kick off (watch live)` / `⏩ Kick off — skip to result`
  replace "Proceed to kickoff" followed by a "Kickoff Options" menu. Special matches with only
  one option (S2 game 12, the S5 opener) just kick off.
- **The knock at the door is answered when the pre-match opens.** You had to answer it before
  kickoff anyway, and an empty doorstep cost a click. Visitors and their choices are unchanged.
- **Matchday pint is remembered**: asked once ("your answer becomes your matchday habit"), then
  a `🍺 Matchday pint: ON/OFF` toggle in the pre-match menu. Champions League and World Cup
  matches use the same habit.
- **No Post-Match or Evening gates.** The result goes to the feed. The evening's events bring
  their own choices. One `Next week ▸` Continue closes the week and shows the next fixture,
  your league position and the fans' mood. `Sleep peacefully (next week ▸)` skips it. The
  Post-Match gate stays only for the Season 5 opener, where a special track plays over it.

## No-repeat bags and expanded pools

`KPacing.bag(id, pool)` deals lines like cards: each pool is shuffled without replacement and the
order is saved in `S._bags`, so it survives a save and reload. A reshuffle never starts with the
line the last deck ended on. `KPacing.cool(id, n)` and `KPacing.ready(id, n)` are match-based
cooldowns for flavour beats.

Pools now drawn from bags, with lines added (existing lines were not changed):

| pool | before → after |
|---|---|
| Delmor intro texts | 6 → 14 |
| Delmor "unhinged" replies | 10 → 18 |
| RIVAL_TEMPLATES lost_match mild / harsh | 4 → 13 / 5 → 15 |
| scandal harsh / extreme | 4 → 12 / 4 → 12 |
| personal_meltdown harsh / extreme | 4 → 12 / 4 → 12 |
| player_sale_disaster harsh / extreme | 4 → 12 / 3 → 10 |
| portsmouth_success harsh / extreme | 4 → 12 / 3 → 10 |
| derby_loss harsh / extreme | 3 → 10 / 3 → 10 |
| relegation extreme | 3 → 10 |
| sacking harsh / extreme | 3 → 10 / 2 → 8 |
| wife complaints | 8 → 16 |
| chairman gossip cynic / statesman / alliance | 2 → 8 / 2 → 8 / 3 → 9 |
| sex-scandal terrace chants | 2 → 8 |
| slaps | 5 → 15 |
| family meltdown headline (was one fixed line) | 1 → 7 |
| trouble at school | 5 → 15 |
| match "updates" commentary | 4 → 12 |
| 10-minute match markers (was always "The match continues...") | 1 → 12 |

That is 28 pools expanded and 220 new lines. Every pool that had fewer than 6 lines now has at
least three times as many. Phone quick texts were out of scope.

## Seasons 1–2: club-life beats

These run from `KTexture.run('prematch')`, before the pre-match menu, and
`KTexture.run('evening')`, after the evening and before the end-of-week Continue. At most one
beat fires per slot. None fires in a match where a major story beat already fired
(`KPacing.busy()`), in cup or European matches, or in Season 2 games 10–12 (the St Mary's attack).

| beat | when | effect |
|---|---|---|
| Pre-season predictions | game 1 of S1 and S2 | sets the board's target finish (S1: 10th; S2: two places better than last season's finish) |
| Board check-in | after games 4, 8 and 12 | confidence bar against the target. 2+ places better: +£300k and board +3. 2+ places worse: board −4 and morale −2 |
| Transfer deadline day | before game 8 (S1, S2) | choose: panic-buy a striker (£1.2M, RAT 70–85), flog your worst bench player, or hide in the kit room |
| Derby week | before a Portsmouth fixture, once per season, after the first derby special | Delmor text. Fuel the fire (one-match morale +3, fans +5, legal risk +2) or call for calm (board +3) |
| Manager's mood | games 4–15, cooldown 5 | smug / grim / twitchy from the last 3 results. Back him (morale +2, board −1) or prod him (morale +3 or −2) |
| Family day | S1 game 3 | spouse and kids at the match: wife and kids relationships up |
| International break | S1 game 11, S2 game 6 | a random player comes back from San Marino / Faroes duty with a 1-game knock |
| Sponsor appearance | S2 game 3 | cut the ribbon (+£200k), send the manager (+£100k, morale −1), or refuse (board −2) |
| Solent Shield cup run | S1 midweeks after games 5, 9 and 13 (QF, SF, final v Portsmouth Reserves) | first team (better odds, 25% chance of a knock) or kids. Prizes £100k, £200k and £600k, plus a sellable trophy. Losing knocks you out |
| End-of-month awards | after games 2, 6, 10 and 14 | Manager of the Month (3+ wins in 4; a small trophy, morale +2), Player of the Month (best starter, small trophy), or "Chairman of the Month: Delmor Krunchem" |
| Fan protest / praise | after 3 losses or 3 wins in a row, cooldown 4 | protest: face them (fans +6, 30% chance of a steak bake in the face) or hide (fans −3). Praise: fans +5 and +£150k in tickets |

## Season 3: one story beat per match

All the Season 3 story arcs fire from the knock at the door (`openKnockDoor` in `src/020`).
The chain already returns after one beat, so the problem is the side arcs higher up the chain:

- the women's-team manager demand, due at game 12 (75% of the season)
- the Cronster private-investigator videos, final confrontation and juice incident, when that arc
  carries over from Season 2

Any of these can take the door first, in the match where the secretary, captain, dating or
drive-home beat is in its last window. That beat is then lost for good.

The scheduler fixes this:

- `KPacing.yieldToStory(id)` returns true while a Season 3 door story beat is due. That is
  games 4–13 with one of the windows from `src/020` open. The side arc then steps aside for this
  match. The women's-team demand is re-armed for the next match. The Cronster blocks retry on the
  next knock. Nothing is lost: once games 4–13 are over, or no beat is due, the side arcs fire
  as before.
- The door is wrapped, so a Season 3 story beat that fires claims the match
  (`KPacing.claim('s3:door')`). Flavour beats (`KPacing.busy()`) then stay quiet for that match.
- `KPacing.beat(id, {last})` is the general form: it allows one major beat per match, and a beat
  that is due in its last window still fires. Deferrals are counted in `S._beat_deferred`.

The post-match Krunchem threat news story (games 8–12) was not changed. It belongs to the press
system, which was out of scope for this pass.

## Voices

- `tools/build.js` has a new `@audio` virtual part. It embeds every `audio/<dir>/*.mp3` as
  `window.KREPLIN_AUDIO['<dir>/<name>']` (59 clips, about 1 MB).
- **Commentary** (37 clips, Daniel, a stock voice) plays in the live match overlay. Kickoff,
  half-time, full-time (win/draw/loss), goals, own goals, reds, stretcher injuries and pitch
  invaders always play. Yellows, fouls and chances play about 30% of the time. A clip never
  overlaps another; if one is playing, the next is skipped.
- **Voicemails**: 16 Delmor lines read by Julian (stock, deep mature British) and 6 Van
  Onslaught Season 4 announcements read by Edward (stock, dark British). When the text appears
  anywhere on the page (feed, rival-text popup, phone, the TV broadcast), a tap-to-play
  `▶ voicemail` / `▶ broadcast` chip is attached to it. They never autoplay. Specs are in
  `audio/specs/voicemail.json` and `audio/specs/broadcast.json`.
- **Settings**: a "Voices" ON/OFF toggle in Audio Controls (`localStorage.kreplin_voices`, on by
  default). Voice volume follows the music volume plus a little. Muting the music silences voices.

## Season 4 → Season 1 (bug)

Several things reload the page in the middle of a campaign: the failstate menu's "Return to Intro
Menu" (e.g. stoned to death after the nightclub in Season 4), the Portsmouth cheat flow and a
browser refresh. Each one landed on the start screen with only NEW CAMPAIGN (which wipes the
autosave and starts Season 1) and LOAD (manual slots only). The Resume handler existed, but its
button was missing from the markup.

The start screen now shows `CONTINUE — SEASON x, GAME y` whenever there is an autosave. The
failstate's "Load Last Save" now reloads into the autosave instead of swapping `S` under the flow
that has just killed you. `tools/autoplay.js` treats a failstate as game over and reports page
reloads.
