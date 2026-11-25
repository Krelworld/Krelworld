"""NOTES.md for the trailer: every clip (from the edit's own log) with its source scene, plus how it was made."""
import json, sys
E = json.load(open(sys.argv[1]))
total = E["total"]
def tc(t): return f"{int(t // 60)}:{t % 60:05.2f}"
L = []
L.append("# KRELWORLD advert trailer: notes\n")
L.append(f"- **`krelworld_trailer.mp4`**: {tc(total)}, 1920x1080, 60 fps, AAC 48 kHz stereo, loudness -14 LUFS.")
L.append("- **`krelworld_trailer_share.mp4`**: a smaller 720p copy for messaging apps.")
L.append("- **`krelworld_trailer_contact.png`**: the contact sheet, one frame every 2 s.\n")
L.append("## How it was made\n")
L.append("- **Capture.**")
L.append("  - The LAPTOP version (16:9) ran from a local dev server, with Playwright and a paused fake clock.")
L.append("  - One game step of 16 ms is one captured frame, so every clip is a true 60 fps game recording. Math.random is seeded, so scouts and finals match.")
L.append("  - Combat was played by a small capture-only autopilot. It patches the Controls prototype in the page only; no game code was changed.")
L.append("- **Picture.**")
L.append("  - The 960x540 canvas is upscaled with nearest-neighbour, cropping in for close-ups.")
L.append("  - The game's own cinematic bars are cropped out, so the frame is never letterboxed or squashed.")
L.append("- **Voices and lines.**")
L.append("  - Character lines are the game's own recordings, cut from `public/audio/voice` at the frame each was said during capture.")
L.append("  - No game dialogue was changed or invented.")
L.append("  - The narrator is a stock ElevenLabs library voice (\"Russell - Dramatic British TV\"), not an imitation of anyone real.")
L.append("- **Music.**")
L.append("  - The score is three original ElevenLabs Music cues.")
L.append("  - The end card adds the clean opening hook of the game's own theme song (\"I'm crazy for that Krel World\").")
L.append("- **Sound effects.** Trailer hits, whooshes and the remote click come from ElevenLabs SFX. Gunfire, gore, farts, vomit and the Tap come from the game's own `public/audio/sfx`.")
L.append("- **Content rules.**")
L.append("  - Excluded: the Elon fight, Polson's death, Ch6–7 finale and boss spoilers, every episode on the earlier promo's exclusion list, and the Krex room (religious paedophile lines).")
L.append("  - Sex and nudity appear only behind the game's own censor bars, and Krezz splats only as the game shows them.")
L.append("\n## Clips, in order\n")
L.append("| time | clip | source |")
L.append("|---|---|---|")
for t, label, src in E["notes"]:
    L.append(f"| {tc(t)} | {label} | `{src}` |")
L.append("\n## Narrator script\n")
for line in [
    "This winter... Krelford has run out of pussy juice.",
    "Shoot everything. Climb everything. Crawl through a seven-hundred-pound man's colon.",
    "Run over twenty-five pedestrians... for a friend. Wonk... your... THANG.",
    "Upgrade your arsenal. Gamble your life savings at the Kreddle Exchange. Enjoy a tasteful evening at the Wonky Pole. Restore the national drink.",
    "Watch the finest television ever broadcast. Meet Polson. He's on a journey.",
    "Face unspeakable evil. And when it's over... MAKE SURE.",
    "KRELWORLD. Wonk til you krez. Play free on your phone or laptop. Tell nobody.",
]:
    L.append(f"> {line}\n")
open(sys.argv[2], "w").write("\n".join(L) + "\n")
print("notes", len(E["notes"]))
