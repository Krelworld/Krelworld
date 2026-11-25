"""KrelTV promo engine: shots (captured 960x540 game frames) -> 1920x1080/60 segments, plus line audio events
derived from the capture logs (every line start is logged with its frame)."""
import json, os, re, subprocess, hashlib
T = os.path.dirname(os.path.abspath(__file__)) + "/"
SEG = T + "seg/"; os.makedirs(SEG, exist_ok=True)
FPS = 60
GSFX = "/home/user/Rory-s-rangers-/public/audio/sfx/"
GMUS = "/home/user/Rory-s-rangers-/public/audio/"
VOICE = "/home/user/Rory-s-rangers-/public/audio/voice/"
IDX = json.load(open(VOICE + "index.json"))
EPS = {e["id"]: e for e in json.load(open(T + "episodes.json"))}

def run(a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode: raise SystemExit("FAIL " + " ".join(a)[:400] + "\n" + r.stderr[-2000:])
    return r

# framings: crop rectangles in game pixels (x, y, w, h), all 16:9
FR = {
    "set": (91, 45, 764, 430),     # the whole telly, room either side, the side buttons left out
    "scr": (200, 92, 560, 315),    # the screen (news: subs and straps in, ticker out)
    "scrlo": (200, 155, 560, 315), # the screen, lower half (shows with subtitles at the bottom)
    "room": (0, 296, 288, 162),    # the little telly in the living room
    "full": (0, 0, 960, 540),
    "grrm": (456, 62, 304, 171),   # Mole of Thrones: the right half of the phone-call split
    "c_tr": (430, 50, 330, 186),
}
SCREEN = (200, 50, 560, 420)

def frames(clip):
    return [int(x[:5]) for x in open(T + f"clips/{clip}.frames.txt").read().split()]

def says(clip):
    """[(frame, speaker, full text, key)] for lines said while this clip was recorded (f0 = target line)."""
    spec = json.load(open(T + f"specs/{clip}.json"))
    ep = EPS[spec["ep"]]
    out = []
    log = open(T + f"logs/{clip}.log").read().split("\n")
    # lines said before recording started (skip) all log f0; only the last one before 'skipped' is live
    pre, rec = [], False
    for ln in log:
        if ln.startswith("CAP skipped") or ln.startswith("CAP pre-skipped"): rec = True; continue
        m = re.match(r"CAP say f(\d+) \| (.+?) \| (.*)$", ln)
        if not m: continue
        f, sp, t = int(m.group(1)), m.group(2), m.group(3)
        full = next((b for b in ep["beats"] if b["type"] == "speaker" and b["character"] == sp and b["text"].startswith(t)), None)
        item = (f, sp, full["text"] if full else t, full["key"] if full else None)
        if rec: out.append(item)
        else: pre.append(item)
    if spec.get("from") and pre: out.insert(0, (0, *pre[-1][1:]))
    return out

def line_wav(key):
    out = T + f"lines/k_{key}.wav"
    if not os.path.exists(out):
        b, off, ln = IDX[key][:3]
        tmp = out + ".mp3"; open(tmp, "wb").write(open(VOICE + b + ".mp3", "rb").read()[off:off + ln])
        run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ar", "48000", "-ac", "2", out]); os.remove(tmp)
    return out

def dur(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).stdout)

def out_rect(fr, rect):
    x, y, w, h = FR[fr]; s = 1920 / w
    rx, ry, rw, rh = rect
    x0, y0 = max(0, (rx - x) * s), max(0, (ry - y) * s)
    x1, y1 = min(1920, (rx + rw - x) * s), min(1080, (ry + rh - y) * s)
    return int(x0) // 2 * 2, int(y0) // 2 * 2, int(x1 - x0) // 2 * 2, int(y1 - y0) // 2 * 2

def render_shot(i, s):
    """s: kind clip|card|seq|black, n frames; clip: clip, f0 (orig frame), fr (framing), static (frames), osd (channel),
    osdn (frames), fin/fout (s), flash (s)"""
    key = json.dumps(s, sort_keys=True)
    out = SEG + hashlib.md5(key.encode()).hexdigest()[:14] + ".mp4"
    if os.path.exists(out): return out
    n = s["n"]; inp = []; fc = []
    if s["kind"] == "clip":
        fl = frames(s["clip"]); a = fl.index(s["f0"])
        assert fl[a + n - 1] == s["f0"] + n - 1, f"shot {i}: frames not contiguous"
        x, y, w, h = FR[s.get("fr", "set")]
        inp += ["-i", T + f"clips/{s['clip']}.mp4"]
        fc.append(f"[0:v]trim=start_frame={a}:end_frame={a + n},setpts=PTS-STARTPTS,crop={w}:{h}:{x}:{y},scale=1920:1080:flags=neighbor,setsar=1[v0]")
    elif s["kind"] == "card":
        inp += ["-loop", "1", "-framerate", str(FPS), "-t", f"{n / FPS:.4f}", "-i", T + f"cards/{s['card']}.png"]
        fc.append("[0:v]scale=1920:1080,setsar=1[v0]")
    elif s["kind"] == "seq":
        inp += ["-framerate", str(FPS), "-i", s["pattern"]]
        fc.append("[0:v]scale=1920:1080:flags=neighbor,setsar=1[v0]")
    else:
        inp += ["-f", "lavfi", "-i", f"color=c=black:s=1920x1080:r={FPS}:d={n / FPS:.4f}"]
        fc.append("[0:v]setsar=1[v0]")
    cur = "v0"; k = 1
    st = s.get("static", 0)
    if st:
        rx, ry, rw, rh = out_rect(s.get("fr", "set"), SCREEN) if s["kind"] == "clip" else (0, 0, 1920, 1080)
        inp += ["-f", "lavfi", "-i", f"nullsrc=s={rw // 4}x{rh // 4}:r={FPS},geq=lum='random(1)*235+10':cb=128:cr=128"]
        fc.append(f"[{k}:v]trim=end_frame={st},scale={rw}:{rh}:flags=neighbor,format=yuv420p,setsar=1[nz]")
        fc.append(f"[{cur}][nz]overlay=x={rx}:y={ry}:eof_action=pass[v{k}]"); cur = f"v{k}"; k += 1
    if s.get("osd"):
        inp += ["-loop", "1", "-framerate", str(FPS), "-i", T + f"cards/osd{s['osd']}.png"]
        fc.append(f"[{cur}][{k}:v]overlay=0:0:enable='lt(n\\,{s.get('osdn', 75)})':shortest=1[v{k}]"); cur = f"v{k}"; k += 1
    post = []
    if s.get("fin"): post.append(f"fade=t=in:st=0:d={s['fin']}")
    if s.get("fout"): post.append(f"fade=t=out:st={n / FPS - s['fout']:.4f}:d={s['fout']}")
    if s.get("flash"): post.append(f"fade=t=in:st=0:d={s['flash']}:color=white")
    post += [f"trim=end_frame={n}", "format=yuv420p"]
    fc.append(f"[{cur}]{','.join(post)}[out]")
    run(["ffmpeg", "-v", "error", "-y", *inp, "-filter_complex", ";".join(fc), "-map", "[out]", "-r", str(FPS), "-frames:v", str(n),
         "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", out])
    return out
