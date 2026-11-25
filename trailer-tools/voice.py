"""Look up the game's own recorded voice lines (public/audio/voice/index.json) and cut them out of the bundles."""
import json, re, subprocess, sys, os
V = "/home/user/Rory-s-rangers-/public/audio/voice/"
IDX = json.load(open(V + "index.json"))
MOOD = set("""angry furious annoyed frustrated excited happy cheerful sad shouting shouts yelling whispers whispering laughs laughing|laughs harder giggles chuckles|evil laugh|maniacal laugh sighs exhales crying sobbing sarcastic nervous panicked scared mischievously shocked surprised gasps hesitant deadpan mysterious curious confused flirty seductive sultry smug proud pompous dramatic menacing growling growls groans grunts snorts sniffs gulps coughs|clears throat yawns tired drunk slurring robotic monotone booming breathless desperate calm serious warmly softly quietly loudly singing sings wheezing burps disgusted pleading triumphant awe sassy manic deranged reverent condescending smarmy shrill""".replace("|", "\n").split())
MOOD |= {"laughs harder", "evil laugh", "maniacal laugh", "clears throat"}
BR = re.compile(r"\[([^\]\n]{1,40})\]")
def is_tag(inner):
    t = inner.strip().lower()
    return inner == inner.lower() and (t in MOOD or t.endswith(" accent"))
def speakable(text):
    text = BR.sub(lambda m: " " if is_tag(m.group(1)) else m.group(1), text)
    text = re.sub(r"\*[^*]*\*", " ", text)
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub("[\U0001F000-\U0001FFFF☀-➿️]", " ", text)
    text = re.sub(r"[#@]", "", text)
    text = re.sub(r"\bwbu\b", lambda m: "What about you" if m.group(0)[0] == "W" else "what about you", text, flags=re.I)
    text = re.sub(r"\?\?+", "?", text)
    text = re.sub(r"!!+", "!", text)
    text = text.replace("…", "... ")
    return re.sub(r"\s+", " ", text).strip()
def key(speaker, text):
    s = speaker.upper() + "|" + speakable(text)
    h = 0x811c9dc5
    for ch in s.encode("utf-16-le").decode("utf-16-le"):
        for unit in (ch.encode("utf-16-le")[i:i+2] for i in range(0, len(ch.encode("utf-16-le")), 2)):
            h ^= int.from_bytes(unit, "little")
            h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h
def find(speaker, text):
    return IDX.get(key(speaker, text))
def cut(speaker, text, out):
    e = find(speaker, text)
    if not e: return None
    b, off, dur = e[0], e[1], e[2]
    data = open(V + b + ".mp3", "rb").read()[off:off + dur]
    tmp = out + ".src.mp3"; open(tmp, "wb").write(data)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ar", "48000", "-ac", "2", out], check=True)
    os.remove(tmp)
    return True
if __name__ == "__main__":
    print(find(sys.argv[1], sys.argv[2]))
