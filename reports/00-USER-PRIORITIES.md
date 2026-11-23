# What the user wants from the phone version (read this first)

The user's own words, in order:

1. "Right now the game is basically unplayable in a phone. ... a phone browser version (making NO changes to the main laptop version of the game). I think things like combat would need to be either simplified or optimized, and special buttons etc would need to be changed to screen taps, but also in a way that didn't obscure or fuck with gameplay too much. Should be played sideways on phone."
2. "Do everything we just spoke about. Make the game playable on a phone. Do *not* change the laptop experience. ... Make sure the user experience is comfortable, that jumping etc doesn't feel awkward."
3. Latest: "I know the phone version probably won't be as good as the laptop but I want it to be mega intuitive and fun. Please help and get it done"

## What "mega intuitive and fun" means for every decision

Intuitive:
- A friend who has never seen the game picks up the phone and can play with NO explanation. If a control needs a sentence of explanation, redesign the control.
- Controls appear where the thumbs already are, and only when they do something. Nothing on screen that is dead, decorative or irrelevant right now.
- Every button says what it does with an icon or a single verb that changes with context ("TALK", "OPEN", "JUMP").
- The first time a control matters, the game shows it in the moment (a brief pulse or a one-line touch hint), not in a wall of text. Never a keyboard key name on a phone.
- One obvious way to do each thing. Defaults are right for almost everyone; options exist but nobody needs to open them.
- Nothing needs precision a thumb does not have: generous hit areas, forgiving timing, auto-aim that just works.

Fun:
- Controls feel instant and physical: pressed states, a little haptic tick where the phone supports it, no input lag, no dropped or stuck presses.
- The action stays visible: thumbs and buttons do not cover the fight, the player or the punchline.
- Combat on a phone should feel like a good phone shooter (move, the game aims, you choose when to dodge and when to unleash the special), not like a keyboard game with buttons glued on.
- Jumping feels good: a big jump button under the right thumb, buffered presses, a little coyote time, height you can control, and you can shoot while you do it.
- No slog on a phone: waiting, tiny scrolling, repeated tapping through things, and fiddly menus are all fun-killers. Add skip, hold-to-fast-forward and big lists.
- Keep the jokes: all dialogue, voices, effects and content stay exactly as they are.

The laptop version must not change at all. All of this is phone-only.

When you finish a piece of work, judge it against this page: would a first-time player on a phone understand it at once, and is it fun in the hand? Say so honestly in your report, including what still is not.

## Landscape (the user, again): "Also it should be optimized for landscape mode on the phone"

The phone version is LANDSCAPE ONLY and must be designed for a wide, short screen, not merely tolerate one:
- Portrait shows the rotate-your-phone screen and nothing else. Lock to landscape wherever the browser allows it (Android fullscreen); both landscape directions must work (notch on the left or on the right).
- Height is the scarce resource (about 340 to 390 CSS px, less when Safari shows its bars): the game picture uses the FULL height, the top HUD is one thin strip, nothing stacks vertically, and nothing important sits in the bottom 21 px.
- Width is spare (phones are 19.5:9 or wider, the game picture is 16:9): put the thumb controls in the black side gutters as far as possible so they sit beside the action, not on it. Thumbs rest at the lower left and lower right corners: that is where the stick and the main buttons live.
- Encourage the bigger picture: fullscreen on Android on the first tap, and the Add to Home Screen hint on iPhone (no browser bars).
- Every phone-only layout (menus, dialogue, lists, minigames, HUD) is laid out for 844x390 and must still work at 740x360 and 750x340, and on wider phones (932x430).
- Test every screen in both landscape directions and at the short heights above. Never design or test a phone screen in portrait except the rotate prompt.

## Add to Home Screen (the user): "make sure the phone version gives instructions as to how players can add the app to their Home Screen"

This is a REQUIREMENT of the phone version, not a nice-to-have. Players are the user's friends opening a link from a group chat; most have never added a web page to their home screen.

What to build (phones only; laptop unchanged; in src/game/mobile/):
- A clear, friendly "Add KRELWORLD to your Home Screen" guide, in plain words with pictures of the actual buttons to press (draw the icons in CSS/SVG), that works in LANDSCAPE on a 844x390 screen and also when shown on the portrait rotate screen.
- The right steps for the browser the player is actually in. Detect and branch:
  - iPhone Safari: tap the Share button (square with an arrow pointing up; say where it is: bottom bar in portrait, top bar in landscape, and that the bars may need a tap to appear) -> scroll -> "Add to Home Screen" -> "Add".
  - iPhone Chrome, Edge, Firefox: the Share button lives in a different place; give those steps (verify what current versions offer; if a browser cannot add to the home screen, tell the player to open the link in Safari).
  - In-app browsers (links opened inside Messenger, Instagram, Facebook, TikTok, Snapchat and similar): adding to the home screen is not possible there. Detect them and say "Open this in Safari / Chrome first", with how (the ... or compass button).
  - Android Chrome and Edge: use the real install prompt (listen for beforeinstallprompt, show an INSTALL button that calls prompt()); fall back to written steps (menu -> "Add to Home screen" or "Install app"). Samsung Internet and Firefox on Android: their own steps.
- Why bother, in one line the player cares about: bigger picture (no browser bars), opens like an app, stays sideways.
- When it appears: once, early (on the first run on a phone, before the player starts a game), dismissible with "Not now"; never when the game is already running from the home screen (display-mode standalone/fullscreen or navigator.standalone); and ALWAYS reachable later from the title screen and the pause menu on phones (an "Add to Home Screen" entry) and from the rotate screen.
- Check the plumbing so the result is good once added: the web app manifest (name, icons, display fullscreen/standalone, landscape orientation, start_url and scope correct for BOTH sites: the main site lives under /Krelworld/ and the alt site at the root), the apple-touch-icon and Apple web-app meta tags (index.html must not be edited: if tags are missing, add them at runtime on phones and verify iOS picks them up, or report it), a sensible status-bar style, and that the home-screen app starts in landscape with the picture filling the screen.
- SAVES: verify and handle this. On iPhone a home-screen web app has its own storage, separate from Safari, so a game started in Safari does not appear in the home-screen app. That is why the guide appears BEFORE the first game, and it must say so plainly ("Add it first: saves made in the browser stay in the browser"). If that separation is confirmed, also tell a player who already has a save in the browser what will happen. On Android installed apps share the browser's storage. Confirm both with sources or tests; never claim it without checking.
- Test it: screenshots of every variant of the guide (iPhone Safari, iPhone Chrome, in-app browser, Android Chrome with and without the install prompt, Samsung Internet) at 844x390, 740x360 and in portrait; the entry in the title and pause menus; that it does not show when standalone.
