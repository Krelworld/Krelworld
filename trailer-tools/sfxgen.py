import json, sys, urllib.request
def sfx(text, out, dur=None, inf=0.5):
    body = {"text": text, "prompt_influence": inf}
    if dur: body["duration_seconds"] = dur
    req = urllib.request.Request("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192", data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": "proxy-injected", "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=180) as r: open(out, "wb").write(r.read())
J = [
 ("Single crisp click of an old plastic TV remote control button, close up, dry", "sfx/click.mp3", 0.6, 0.7),
 ("Old CRT television switching on: a thump, a rising high-pitched whine and a crackle of static", "sfx/crt_on.mp3", 1.8, 0.6),
 ("Old CRT television switching off: a sharp electric zap collapsing to silence", "sfx/crt_off.mp3", 1.2, 0.6),
 ("Short pompous 1990s British TV news ident sting, orchestral brass hits and timpani, ends on a big chord", "sfx/news_sting.mp3", 3.0, 0.5),
 ("Upbeat cheesy 1990s TV network promo jingle, synth brass and slap bass, big ending chord", "sfx/jingle.mp3", 8.0, 0.5),
]
for t, o, d, i in J[int(sys.argv[1]) if len(sys.argv) > 1 else 0:]:
    sfx(t, o, d, i); print("ok", o)
