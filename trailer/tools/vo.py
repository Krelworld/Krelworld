import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
VID = "NYC9WEgkq1u4jiqBseQ9"  # stock library voice: "Russell - Dramatic British TV"
def tts(a):
    name, text, model, st, style, speed = a
    vs = {"stability": st, "similarity_boost": 0.8, "style": style, "use_speaker_boost": True}
    if speed: vs["speed"] = speed
    body = {"text": text, "model_id": model, "voice_settings": vs}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VID}?output_format=mp3_44100_192", data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": "proxy-injected", "Content-Type": "application/json", "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: open(f"vo/{name}.mp3", "wb").write(r.read())
        return name + " ok"
    except urllib.error.HTTPError as e: return name + " ERR " + e.read().decode()[:200]
L = json.load(open(sys.argv[1]))
with ThreadPoolExecutor(4) as ex:
    for r in ex.map(tts, [(k, *v) for k, v in L.items()]): print(r)
