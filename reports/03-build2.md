# 03 · Phone foundation, part 2 (stage 1)

**Commits** on branch `mobile` (worktree `scratchpad/mobile-wt`), on top of part 1's `9ab8f5c9`:

| Commit | For the player |
|---|---|
| `7d343af6` | Add to Home Screen guide; phone settings that stick; touch wording on the walking scenes' prompts; bigger-text switch (off); `?mobilediag`; fixed-stick option; buzz on presses; battery saver |
| `0640003e` | Phone README: settings, the readability switch and how stage 2 turns it on, touch wording, the guide, `?mobilediag` |
| `4cedf4ef` | The Krezz Arms brawl says "Tap to swing" on a phone |

Worktree clean, nothing pushed, no PR. Dev servers (5202 / 5212) stopped; the two production builds made for the
plumbing check were deleted straight after.

## Checks (all on the final code, `4cedf4ef`)

| Check | Result |
|---|---|
| Laptop fingerprint, half 1 (`shell,front,newgame,hub,meeting,dungeon`) | 40 of 40 identical, **DESKTOP FINGERPRINT: OK** |
| Laptop fingerprint, half 2 (`boss,side,places,minigames,finale,alt`) | 25 of 25 identical, **DESKTOP FINGERPRINT: OK** |
| `npx vitest run tests/desktopInvariants.test.ts` (unedited) | 19 of 19 |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 353 tests, 38 files, all pass (63 new: settings, readability, wording, home screen + diag + flag) |
| `node scripts/mobile-smoke.cjs` normal build | **125 of 125, MOBILE SMOKE: OK** (179 s) |
| `node scripts/mobile-smoke.cjs` ALT build | **125 of 125, MOBILE SMOKE: OK** (188 s) |
| Install plumbing, production builds served at `/Krelworld/` (main) and `/` (ALT) | manifest parsed with no errors, `start_url` and `scope` = the site's own path, both icons and `apple-touch-icon` 200, Chrome `getInstallabilityErrors` empty for both |
| `git diff 9ab8f5c9 -- index.html src/main.ts tests/fingerprints tests/desktopInvariants.test.ts` | empty |

## What exists now (phones only; a laptop runs none of it)

1. **Phone settings** (`settings.ts`): one typed `PhoneSettings` with defaults, kept in its own key
   `storageKey("krelworld.phone.settings")` (JSON, `v:1`); the game's `Settings` / `MetaState` / `defaultSettings()`
   are untouched. Loading writes nothing, a change saves at once, private-mode storage that throws is survived
   (verified with a `localStorage` whose every call throws). `installMobile()` attaches the store before the layer
   lays itself out. Fields: `leftHanded`, `buttonSize`, `opacity`, `stick` (floating / fixed), `haptics`,
   `readability`, `textSize`, `batterySaver`, `autoFire`, `aimAssist` (off / normal / strong), `phoneAssist`,
   `syncOffsetMs`, `playOverMyMusic`. Live now: the first eight (left-handed, size, opacity and the stick re-lay the
   layer at once; verified in the smoke test, including after a reload).
2. **Readability** (`readable.ts` pure, `readability.ts` live): the font floor (no text under 10 CSS px, 12.5 with
   `textSize: "large"`, computed from the real canvas scale and the text's own / containers' scale and camera zoom)
   and 44 CSS px tap areas (the nearest-control snap). **Default OFF**; `?mobileread=1/0` overrides for one visit.
3. **Touch wording** (`wording.ts`): `hint()`, the `TOUCH_WORDING` table, `addWording()`. Applied to the interact
   bubbles of Home, Hub, Club, Kreddle and the Venue, and to UI texts in Polson Towers, the Krezz Arms, Kreddle and
   Home (see the README for the exact list). ACTION still reads its verb from the scene's untouched text.
4. **`?mobilediag`** (`diag.ts`): the read-out, zero cost without the parameter.
5. **Device checklist**: `scratchpad/mobile/DEVICE_CHECKLIST.md` (plain language: iPhone, Android, what to read off the
   read-out, what to send back; follows audit section 10 and research section 5).
6. **Add to Home Screen guide** (`homeScreen.ts`), detailed below.
7. **Small extras that close part 1 gaps**: `Stick: stays put` (fixed stick, base at its resting place, no follow);
   a 12 to 18 ms buzz on ACTION / SANMIK / pause where `navigator.vibrate` exists (Android), behind `haptics`;
   battery saver (Phaser's own limiter switched live, `_limitRate` 28.3 ms so 60 Hz steps every second frame and 120 Hz
   every fourth even with frame jitter; the smoke test counts game steps over two seconds and requires at most 31.5 a second).
8. **Tests**: `tests/mobileSettings.test.ts`, `tests/mobileReadability.test.ts`, `tests/mobileWording.test.ts`,
   `tests/mobileHomeScreen.test.ts` (browser and in-app detection for 15 user agents, every guide variant, diag
   helpers, `explainMobile`); `scripts/mobile-smoke.cjs` gained `settings`, `read` and `guide` sections and new checks
   in `phone` and `desktop`.

## API (for stage 2 and later)

```ts
import {
  phoneSettings, updatePhoneSettings, onPhoneSettingsChange, phoneSettingsList, resetPhoneSettings, PHONE_SETTINGS,
  hint, touchWording, addWording, wordText, TOUCH_WORDING,
  readability, MIN_TEXT_CSS, MIN_HIT_CSS,
  openHomeScreenGuide, homeScreenEntryWanted, homeScreenGuide, haptic, mobileWhy,
} from "src/game/mobile";

// settings
phoneSettings(): Readonly<PhoneSettings>                       // defaults below; never null
updatePhoneSettings(patch)                                     // cleaned (normalizePhoneSettings), saved, listeners told
onPhoneSettingsChange((s, changedKeys) => ...) => unsubscribe
phoneSettingsList(): { key, label, help, group, live, type: "toggle"|"choice"|"slider", options?, min?, max?, step?, unit?, get(), set(v) }[]
// defaults: leftHanded false · buttonSize "M" · opacity 0.3 · stick "floating" · haptics true · readability false ·
//           textSize "normal" · batterySaver false · autoFire true · aimAssist "normal" · phoneAssist true ·
//           syncOffsetMs 0 · playOverMyMusic false

// readability (off): on = ?mobileread ?? phoneSettings().readability
readability()?.on / .set(bool) / .k (CSS px per game px) / .stats {raised, snaps, refreshes}

// touch wording
hint("E: Talk to Gronny")      // phone: "Tap: Talk to Gronny"; laptop: unchanged
addWording({ id, re, to })      // stage 2's sweep adds rows; never route dialogue through it
wordText(textObject)            // from now on everything written into that Text is shown in touch wording (phones)

// guide
openHomeScreenGuide("title" | "pause" | "rotate"); homeScreenEntryWanted(); haptic("tap" | "press" | "big")
window.__krelMobile (phones): settings.get/set/list, readability, guide, diag, plumbing(), fakeInstallPrompt(outcome)
```

**How stage 2 turns readability on**: fix each screen's layout behind `isMobile()` with `?mobile=1&mobileread=1`, check
it with `textSizes()` in the smoke test, and when every screen is done change `readability: false` to `true` in
`DEFAULT_PHONE_SETTINGS` (players who switched it off keep their stored choice), and flip the smoke test's default check.

## Readability, measured

| Screen | Off (as part 1) | On |
|---|---|---|
| Title, iPhone 14 (k 0.722) | smallest text 7.22 CSS px | 10.11 (19 texts raised); off again: every text back at its requested size, byte for byte |
| Title, Safari with bars 750x340 (k 0.630) | | 10.07 text, 11.96 glyph box (font metrics) |
| Settings menu, 750x340 | | 10.07 (33 texts) |
| Tap 8 CSS px under SETTINGS' ◀ BACK (25 CSS px tall) | hits the dimmer, nothing happens | reaches BACK (menu closes) |

With it off, the smoke test checks there is no patch on `Text.updateText` at all and no text carries its marks. The
settings menu at 750x340 still fits with it on (see `read-on-settings-750x340.png`); other screens (pause menu rows,
dialogue, HUD) will overflow until stage 2 lays them out: that is why it ships off.

## Add to Home Screen guide

- Variants (`guideVariant`): iPhone Safari (Share, top bar sideways / bottom bar upright, "tap the top edge if the bars
  are hidden", "••• first" for iOS 26's Safari; Add to Home Screen; Add, "leave Open as Web App on"; open it from the
  Home Screen); iPhone Chrome (Share in the address bar), Edge (menu, then Share), Firefox (Share in the address bar or
  ☰ > Share), each with "not in the list? open it in Safari"; any other iPhone browser (COPY LINK, paste into Safari);
  in-app browsers (Instagram, Facebook, Messenger, TikTok, Snapchat, WhatsApp, X, LinkedIn, Pinterest, LINE, WeChat, the
  Google app, any Android WebView): "Open KRELWORLD in Safari / Chrome first" with ••• / ⋮ and COPY LINK; Android
  Chrome / Edge / Samsung / Firefox / other: INSTALL (the real `beforeinstallprompt`, `prompt()` in the touchend) when
  the browser offered it, otherwise their own written steps, plus FULL SCREEN NOW when the tab is not fullscreen.
- Each step has a drawn icon (SVG share, add-to-home, •••, ⋮, ☰, install, open-out, compass, copy; an "Add" /
  "Install" pill; the game's own icon).
- Why line: "Bigger picture with no browser bars. Opens like an app. Stays sideways."
- Saves: iPhone "Add it FIRST: saves made in the browser stay in the browser. The Home Screen app keeps its own saves."
  and, with a save already here, "You already have a save in this browser. It stays here: the Home Screen app starts
  fresh, with its own saves." (WebKit's own pages, via the research report [WK-ITP][WK-181849]). Android "Your saves
  come with you" (web.dev, "WebAPKs on Android": installed apps use the Chrome profile's storage, "it will not be
  segregated away"; Samsung / Firefox home-screen shortcuts open in the same browser).
- When: once by itself when the title has been up 0.6 s on the first phone run (before NEW GAME; remembered under
  `storageKey("krelworld.phone.homeScreenGuide")`), NOT NOW / ✕ close it; never from the home screen
  (`navigator.standalone`, `display-mode: standalone`, or `display-mode: fullscreen` with no element in fullscreen).
  Always reachable: the title's corner button (replaces FULLSCREEN and the one-line iPhone hint, phones only), the
  pause menu's row (replaces the FULLSCREEN row, same count), the turn-your-phone screen's button.
- Fits without scrolling at 844x390, 740x360, 750x340 and upright 390x844 / 360x740 for every variant; buttons 44 px;
  no text under 12 CSS px (body in the system font, titles and buttons in Krel Bold).
- Plumbing (index.html untouched): manifest `start_url` / `scope` "./" resolve to `/Krelworld/` and `/`, `display:
  fullscreen`, `orientation: landscape`, icons 192 / 512 and `apple-touch-icon` (180) all served, Apple meta present
  (`apple-mobile-web-app-capable`, `black-translucent`, title "Krelworld", `viewport-fit=cover`). No runtime tags were
  needed. iOS ignores the manifest's orientation: a home-screen app opened upright shows the turn-your-phone screen.

## Where I followed the research or my own judgement rather than the brief (and why)

- **Tap areas by snapping, not by enlarging hit areas.** Growing every small control to 44 CSS px (61 game px) would make
  neighbours overlap (pause rows are 25 game px apart, steppers 24), and Phaser gives an overlap to whichever is on
  top: a tap on SAVE could become QUIT. The snap gives each small control the full 44 px area where nothing else is, a
  touch on a control always goes to it, and in a gap the nearest wins. Research M3's "a touch in a gap goes to the
  nearest control within 20 px" is the same idea.
- **`aimAssist` is off / normal / strong** (research M2's three settings) rather than a boolean; "normal" is the sticky
  auto-aim the brief names.
- **`textSize` normal / large** (research M7's "Text size: Normal / Large") rides on the same floor: 10 or 12.5 CSS px.
- **Android title loses its FULLSCREEN button too**: on Android the game already goes fullscreen on the Enter tap, the
  layer re-offers it, and the guide has FULL SCREEN NOW; one corner button with one job reads better than two.
- **`display-mode: fullscreen` is not "installed" while the page has an element in fullscreen**: found while testing
  (after the Enter tap an Android tab matches it, so the title and pause entries vanished); fixed in `platform.ts` and
  covered by the smoke test. The title's own laptop check is unchanged.
- **Haptics**: research M15 puts the buzz on DODGE / JUMP / the special (stage 2's buttons); part 2 puts it on the
  existing ACTION / SANMIK / pause buttons; stage 2 calls `haptic()` from its controls.
- **Battery saver limiter at 28.3 ms** instead of 33.3: Phaser resets its counter on each step, so with real frame
  jitter 33.3 sometimes waits three frames (20 fps).
- **Guide delay 0.6 s** after the title appears (long enough for its fade-in, short enough to beat a fast NEW GAME tap).

## Lines that mention keys, left exactly as they are (dialogue / narration, rule 3)

Home's welcome "TIP: WASD / arrows (or the stick) to walk. E to use things..." and "...Walk up to it and press E.";
Kreddle's "TIP: talk to the locals (E). Play the machines..."; Mikey's "Press V (or the SANMIK button)"; Wildern's
arrival "CONTROLS: WASD move · Mouse aim · Left click attack..."; the Kreddle raid's "HOLD the attack button (mouse / J /
the fire button)...". The unit test checks the UI patterns cannot match the first two.

UI labels still in key wording, for stage 2's sweep (they go through `addWording()` / `hint()`): the town toasts
("WASD to walk. E to talk/interact... Esc for menu", "...pause menu (Esc)"; the table already has rows for these), the
SanMik toasts, the dialogue footer "▼ E / Space · Tab skip" (also inside the Krezz Arms), the title's bottom key line,
the weapon picker hint, the SSJ banner, Beep Beep, crocodile's legend, the TV captions, the Kreltality "(K)" / "(ESC)",
the Kreddle shop's hidden-on-touch hints (already hidden).

## Part 1's gaps

| Gap | Now |
|---|---|
| Settings in memory only; no Phone page; no haptics; no Floating / Fixed stick | **Closed** (store, typed list for the screen stage 2 builds, buzz, fixed stick) |
| Add to Home Screen guide not built | **Closed** |
| Prompt bubbles show key names | **Closed for the walking scenes' prompts**; toasts and the dialogue footer are stage 2 (table rows ready) |
| Combat / side / brawl on the old pad; no pause or skip in conversations | Stage 2 |
| Tapping the object itself does not act | Stage 3 |
| Real-device checks (insets, iPhone audio, Android fullscreen) | The device checklist; still emulator-only |
| B3 (Kreddle crash after the flyover) | Untouched: laptop bug, needs the user's OK |

## Unsure / to check on a real phone

- Whether Chrome on Android actually fires `beforeinstallprompt` for this site (Chrome reports no installability errors
  for both paths, but it also uses engagement heuristics); the guide falls back to written steps either way.
- iOS 26 Safari's exact button path (Share sometimes sits behind •••): the guide says both.
- Edge / Firefox on iPhone: their share paths are from their help pages and press, not from a device.
- Haptic length (12 to 25 ms) felt on the lads' Android phones.
- The emoji on the title / pause button ("📲") draws as a box in headless Chromium (no emoji font); phones have one.
- The manifest has no `maskable` icon, so Android may draw the icon inside a white circle; changing the manifest would
  change the laptop's install too, so it is left for the user to decide.

## Judged against "mega intuitive and fun"

A friend opening the link from the group chat now gets, before anything else, a card that tells them in their own
browser's terms how to put the game on their home screen, with pictures of the buttons, and why it is worth it; one tap
closes it and it is always one tap away later. The interact bubble no longer says "E": it says "Tap", and the big
button says the verb. Settings exist and stick, ready for a screen. Not yet: text is still small (the switch is off
until stage 2 re-lays the screens), conversations still need a tap per line, menus are still small, and fights still
use the old pad.

## Screenshots

`scratchpad/mobile/shots/build2/smoke/` (from the final smoke run, 1x CSS): every guide variant
(`guide-<variant>-<ua>-<size>.png`: iPhone Safari 844x390 and 750x340, Chrome, Edge, Firefox, Instagram, Messenger,
Android Chrome without and with INSTALL, Edge, Samsung, Firefox, Facebook in-app, Samsung upright 360x740),
`phone-guide-first-run`, `phone-guide-from-pause` (with the "already have a save" note), `phone-guide-portrait` (from
the turn-your-phone screen), `phone-portrait` (the screen with its new button), `phone-pause` (the pause row),
`phone-home-action` ("Tap: Jukebox ..." and USE), `read-on-title-750x340`, `read-on-settings-750x340`,
`settings-lefthanded-L`, `diag-844x390`; `scratchpad/mobile/shots/build2/y-title-read-off.png` /
`y-title-read-on.png` (the same title, readability off and on, 844x390). Scripts: `scratchpad/mobile/work/build2/`.
