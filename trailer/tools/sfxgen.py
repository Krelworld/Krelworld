import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
def sfx(a):
    text, out, dur, inf = a
    body = {"text": text, "prompt_influence": inf}
    if dur: body["duration_seconds"] = dur
    req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192", data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": "proxy-injected", "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=180) as r: open(out, "wb").write(r.read())
    return out
J = [
 ("Huge cinematic trailer BRAAM, deep distorted brass hit with sub boom, long tail", "sfx/braam.mp3", 4.0, 0.6),
 ("Cinematic trailer impact hit, punchy low boom with metallic crack, short", "sfx/hit1.mp3", 1.5, 0.6),
 ("Cinematic trailer impact, massive slam with debris and reverb tail", "sfx/hit2.mp3", 2.0, 0.6),
 ("Fast whoosh swish transition, airy, short", "sfx/whoosh.mp3", 0.8, 0.6),
 ("Vinyl record scratch stop, comedic", "sfx/scratch.mp3", 1.0, 0.7),
 ("Rising tension riser, synth noise sweep building up to a peak, ends abruptly", "sfx/riser.mp3", 3.0, 0.5),
 ("Deep sub bass drop boom, cinematic", "sfx/subdrop.mp3", 2.0, 0.6),
 ("Glitchy digital stutter transition, short", "sfx/glitch.mp3", 0.7, 0.6),
 ("Single crisp click of an old plastic TV remote control button, close up, dry", "sfx/click.mp3", 0.6, 0.7),
 ("Cash register cha-ching", "sfx/kaching.mp3", 1.0, 0.7),
 ("Comedic slide whistle down then cartoon bonk", "sfx/bonk.mp3", 1.5, 0.6),
 ("Camera shutter flash pop, single", "sfx/flash.mp3", 0.6, 0.7),
]
with ThreadPoolExecutor(6) as ex:
    for o in ex.map(sfx, J): print("ok", o)
