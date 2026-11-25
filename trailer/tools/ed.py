"""KRELWORLD trailer editor.

The cut is a list of shots (exec'd from a body file) rendered in one pass: every output frame is built with PIL
(nearest-neighbour crops of the 960x540 game frames, so the pixel art stays crisp, never squashed or letterboxed)
and piped into a single 1920x1080/60 encoder. Audio is a list of events mixed on four buses (music, narrator,
game lines, sfx) with the music ducked under speech, then loudness-normalised to -14 LUFS.

usage: python3 ed.py body.py OUTNAME [--list] [--preview]
"""
import json, os, re, subprocess, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops

T = os.path.dirname(os.path.abspath(__file__)) + "/"
FPS, W, H = 60, 1920, 1080
GAME = "/home/user/Krelworld/public/"
VOICE = GAME + "audio/voice/"
FONT = GAME + "fonts/krel-bold.ttf"

def run(a, **kw):
    r = subprocess.run(a, capture_output=True, text=True, **kw)
    if r.returncode: raise SystemExit("FAIL " + " ".join(map(str, a))[:400] + "\n" + r.stderr[-2000:])
    return r

def dur(p):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).stdout)

# ---------------------------------------------------------------- clips
_FR = {}
def frames(clip):
    """original frame numbers of a packed clip (the clip's n-th frame is frames(clip)[n])"""
    if clip not in _FR: _FR[clip] = [int(x[:5]) for x in open(T + f"clips/{clip}.frames.txt").read().split()]
    return _FR[clip]

def lines(clip):
    """[(frame, rec, speaker, text)] for every voice line logged while the clip was recorded"""
    out, live = [], True
    log = open(T + f"logs/{clip}.log").read().split("\n")
    if any(l.startswith("CAP skipped") for l in log): live = False
    pre = []
    for l in log:
        if l.startswith("CAP skipped"):
            live = True
            if pre: out.append((0,) + pre[-1][1:])  # the TV skip lands on this line: it plays from frame 0
            continue
        m = re.match(r"CAP rec f(-?\d+) \| (.*?) \| (.+?) \| (.*)$", l)
        if m:
            item = (int(m.group(1)), json.loads(m.group(2)), m.group(3), m.group(4))
            (out if live else pre).append(item)
    return out

def line_wav(rec):
    b, off, ln = rec[0], rec[1], rec[2]
    out = T + f"lines/{b}_{off}.wav"
    if not os.path.exists(out):
        os.makedirs(T + "lines", exist_ok=True)
        tmp = out + ".mp3"; open(tmp, "wb").write(open(VOICE + b + ".mp3", "rb").read()[off:off + ln])
        run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-ar", "48000", "-ac", "2", out]); os.remove(tmp)
    return out

class Reader:
    """sequential frame reader for one clip (decoded once, at 960x540)"""
    def __init__(self, clip):
        self.clip = clip; self.p = None; self.i = -1; self.last = None
    def get(self, idx):
        if self.p is None or idx < self.i:
            if self.p: self.p.kill()
            self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", T + f"clips/{self.clip}.mp4", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
            self.i = -1
        while self.i < idx:
            b = self.p.stdout.read(960 * 540 * 3)
            if len(b) < 960 * 540 * 3: return self.last
            self.i += 1
            self.last = Image.frombuffer("RGB", (960, 540), b)
        return self.last
READERS = {}
def frame(clip, orig):
    fl = frames(clip)
    idx = fl.index(orig) if orig in fl else min(range(len(fl)), key=lambda k: abs(fl[k] - orig))
    if clip not in READERS: READERS[clip] = Reader(clip)
    return READERS[clip].get(idx)

# ---------------------------------------------------------------- the cut
SH, EV = [], []
def now(): return sum(s["n"] for s in SH) / FPS
def sec(x): return int(round(x * FPS))

def shot(clip, a, b, crop=None, crop1=None, ease="io", lines_on=True, gain=1.0, speed=1.0, **fx):
    """orig frames [a, b) of a clip. crop: (x, y, w, h) in game pixels (16:9 kept), crop1: where it ends (a push).
    The voice lines said in that window come along (unless lines_on=False)."""
    n = int(round((b - a) / speed))
    t0 = now()
    SH.append(dict(kind="clip", clip=clip, a=a, n=n, speed=speed, crop=crop, crop1=crop1, ease=ease, **fx))
    if lines_on and speed == 1.0:
        for f, rec, sp, txt in lines(clip):
            if not rec: continue
            w = line_wav(rec); d = dur(w)
            s0, s1 = f, f + d * FPS
            lo, hi = max(a, s0), min(b, s1)
            if hi - lo < 3: continue
            EV.append(dict(bus="line", file=w, at=t0 + (lo - a) / FPS, fin=(lo - s0) / FPS, dur=(hi - lo) / FPS,
                           fi=0.02 if lo > s0 else 0, fo=0.05 if s1 > b + 2 else 0.0, gain=gain, who=sp, text=txt, clip=clip))
    return t0

def card(png, secs, z0=1.0, z1=1.0, **fx):
    SH.append(dict(kind="card", png=png, n=sec(secs), z0=z0, z1=z1, **fx)); return now()
def black(secs, **fx): SH.append(dict(kind="black", n=sec(secs), **fx)); return now()
def text(t, secs, size=150, color=(255, 255, 255), bg=(0, 0, 0), **fx):
    SH.append(dict(kind="text", text=t, size=size, color=color, bg=bg, n=sec(secs), **fx)); return now()

def ev(bus, file, at, gain=1.0, fin=0.0, d=None, fi=0.0, fo=0.0, **kw):
    EV.append(dict(bus=bus, file=file, at=at, gain=gain, fin=fin, dur=d, fi=fi, fo=fo, **kw))
def vo(name, at, gain=1.0): ev("vo", T + f"vo/{name}.mp3", at, gain); return at + dur(T + f"vo/{name}.mp3")
def sfx(name, at, gain=0.8, **kw): ev("sfx", T + f"sfx/{name}.mp3" if "/" not in name else name, at, gain, **kw)
def music(file, at, src0, src1, gain=0.5, fi=0.02, fo=0.05):
    ev("mus", file, at, gain, fin=src0, d=src1 - src0, fi=fi, fo=fo)
NOTES = []  # (time, label, source) for NOTES.md
def note(label, src): NOTES.append((round(now(), 2), label, src))

# ---------------------------------------------------------------- rendering
_font = {}
def font(s):
    if s not in _font: _font[s] = ImageFont.truetype(FONT, s)
    return _font[s]
_cards = {}
def card_img(p):
    if p not in _cards: _cards[p] = Image.open(T + "cards/" + p).convert("RGB").resize((W, H))
    return _cards[p]

def lerp(a, b, k): return a + (b - a) * k
def ease(k, kind):
    if kind == "io": return k * k * (3 - 2 * k)
    if kind == "out": return 1 - (1 - k) ** 3
    if kind == "in": return k ** 3
    return k

CINE = (0, 56, 960, 484)  # the game's own cinematic bars: picture rows 56..484
def fit(crop, b=(0, 0, 960, 540)):
    """keep a 16:9 crop inside bounds b (x0, y0, x1, y1): never shows the source's own bars"""
    x, y, w, h = crop
    bw, bh = b[2] - b[0], b[3] - b[1]
    w = min(w, bw, bh * 16 / 9); h = w * 9 / 16
    cx, cy = x + crop[2] / 2, y + crop[3] / 2
    x = max(b[0], min(b[2] - w, cx - w / 2)); y = max(b[1], min(b[3] - h, cy - h / 2))
    return x, y, w, h

def render_frame(s, i):
    n = s["n"]; k = i / max(1, n - 1)
    if s["kind"] == "clip":
        orig = s["a"] + int(i * s["speed"])
        if s.get("hold") and orig >= s["a"] + s["hold"]: orig = s["a"] + s["hold"]
        im = frame(s["clip"], orig)
        c0 = s["crop"] or (0, 0, 960, 540); c1 = s["crop1"] or c0
        e = ease(k, s["ease"])
        bd = CINE if s.get("cine") else (0, 0, 960, 540)
        x, y, w, h = fit(tuple(lerp(a, b, e) for a, b in zip(c0, c1)), bd)
        if s.get("shake"):
            amp = s["shake"] * (1 - k) ** 1.5 if s.get("shakedecay", True) else s["shake"]
            rnd = random.Random(i * 7919 + len(SH))
            x += rnd.uniform(-amp, amp); y += rnd.uniform(-amp, amp)
            x, y, w, h = fit((x, y, w, h), bd)
        out = im.resize((W, H), Image.NEAREST, box=(x, y, x + w, y + h))
    elif s["kind"] == "card":
        z = lerp(s["z0"], s["z1"], ease(k, "out"))
        base = card_img(s["png"])
        if abs(z - 1) > 1e-4:
            cw, ch = W / z, H / z
            out = base.resize((W, H), Image.BICUBIC, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))
        else: out = base.copy()
    elif s["kind"] == "text":
        out = Image.new("RGB", (W, H), s["bg"]); d = ImageDraw.Draw(out)
        f = font(s["size"]); tw = d.textlength(s["text"], font=f)
        z = 1 + 0.06 * ease(k, "out")
        d.text(((W - tw) / 2, H / 2 - s["size"] * 0.55), s["text"], font=f, fill=s["color"], stroke_width=8, stroke_fill=(0, 0, 0))
        if z != 1:
            cw, ch = W / z, H / z
            out = out.resize((W, H), Image.BICUBIC, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))
    else:
        out = Image.new("RGB", (W, H), (0, 0, 0))
    t = i / FPS
    if s.get("cap"):  # a caption (big kinetic text) over the picture
        txt, t_in = s["cap"], s.get("capat", 0.0)
        if t >= t_in:
            d = ImageDraw.Draw(out); sz = s.get("capsize", 120)
            kk = min(1, (t - t_in) / 0.12); f = font(int(sz * (1.25 - 0.25 * kk)))
            tw = d.textlength(txt, font=f); y = s.get("capy", 0.78) * H
            d.text(((W - tw) / 2, y - f.size / 2), txt, font=f, fill=s.get("capcol", (255, 210, 63)), stroke_width=10, stroke_fill=(0, 0, 0))
    if s.get("flash") and t < s["flash"]:
        out = Image.blend(out, Image.new("RGB", (W, H), (255, 255, 255)), 1 - t / s["flash"])
    if s.get("fin") and t < s["fin"]:
        out = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), out, t / s["fin"])
    rem = (n - i) / FPS
    if s.get("fout") and rem < s["fout"]:
        out = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), out, max(0, rem / s["fout"]))
    return out

def render_video(out_mp4, preview=False):
    args = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if preview: args += ["-vf", "scale=960:540:flags=neighbor", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
    else: args += ["-c:v", "libx264", "-preset", "medium", "-crf", "14", "-tune", "animation"]
    args += ["-pix_fmt", "yuv420p", out_mp4]
    p = subprocess.Popen(args, stdin=subprocess.PIPE)
    total = sum(s["n"] for s in SH); done = 0
    for si, s in enumerate(SH):
        for i in range(s["n"]):
            p.stdin.write(render_frame(s, i).tobytes()); done += 1
        if si % 10 == 0: print(f"  render {done}/{total}", flush=True)
    p.stdin.close(); p.wait()

def build_mix(total, out_wav, tag):
    inputs, chains, buses = [], [], {"mus": [], "vo": [], "line": [], "sfx": []}
    for e in EV:
        k = len(inputs)
        inputs.append(["-ss", f"{e.get('fin', 0):.3f}"] + (["-t", f"{e['dur']:.3f}"] if e.get("dur") else []) + ["-i", e["file"]])
        f = f"[{k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
        if e.get("fi"): f += f",afade=t=in:d={e['fi']}"
        if e.get("fo") and e.get("dur"): f += f",afade=t=out:st={max(0, e['dur'] - e['fo']):.3f}:d={e['fo']}"
        f += f",volume={e.get('gain', 1.0)},adelay={int(round(e['at'] * 1000))}:all=1[a{k}]"
        chains.append(f); buses[e["bus"]].append(f"[a{k}]")
    fc = list(chains)
    for b, labs in buses.items():
        if not labs: fc.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[{b}]"); continue
        fc.append(f"{''.join(labs)}amix=inputs={len(labs)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f}[{b}]")
    # narrator: trailer-voice chain (warmth, presence, compression, a touch of hall)
    fc.append("[vo]equalizer=f=110:t=q:w=1:g=3,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=0.08:ratio=4:attack=5:release=180:makeup=2,aecho=0.8:0.5:40|80:0.15|0.08[vop]")
    fc.append("[line]highpass=f=80,acompressor=threshold=0.12:ratio=3:attack=5:release=150:makeup=1.8[linep]")
    fc.append("[vop]asplit=2[vo1][vosc]"); fc.append("[linep]asplit=2[ln1][lnsc]")
    fc.append("[vosc][lnsc]amix=inputs=2:normalize=0[sc]")
    fc.append("[mus][sc]sidechaincompress=threshold=0.015:ratio=8:attack=8:release=350:makeup=1[musd]")
    fc.append("[sfx]acompressor=threshold=0.3:ratio=3:attack=3:release=120[sfxp]")
    fc.append("[vo1]volume=1.7[vog]"); fc.append("[ln1]volume=1.5[lng]"); fc.append("[musd]volume=0.8[musg]")
    fc.append("[vog][lng][sfxp][musg]amix=inputs=4:normalize=0,alimiter=limit=0.95:attack=2:release=60[mix]")
    open(T + f"{tag}_afilter.txt", "w").write(";\n".join(fc))
    args = ["ffmpeg", "-v", "error", "-y"]
    for a in inputs: args += a
    run(args + ["-filter_complex_script", T + f"{tag}_afilter.txt", "-map", "[mix]", "-ar", "48000", "-c:a", "pcm_s16le", T + f"{tag}_mixraw.wav"])
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", T + f"{tag}_mixraw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
          f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    run(["ffmpeg", "-v", "error", "-y", "-i", T + f"{tag}_mixraw.wav", "-af", ln + ",aresample=48000", "-c:a", "pcm_s16le", out_wav])
    return js

if __name__ == "__main__":
    body, tag = sys.argv[1], sys.argv[2]
    exec(open(T + body).read())
    TOTAL = now()
    print("shots", len(SH), "TOTAL", round(TOTAL, 2))
    if "--list" in sys.argv:
        t = 0
        for s in SH: print(f"{t / FPS:7.2f} {s['n']:4d} {s['kind']:5s} {s.get('clip', s.get('png', s.get('text', '')))} {s.get('a', '')}"); t += s["n"]
        for e in EV:
            if e["bus"] in ("line", "vo"): print(f"  {e['bus']:4s} {e['at']:6.2f} {os.path.basename(e['file'])} {e.get('who', '')}: {e.get('text', '')[:70]}")
        sys.exit()
    prev = "--preview" in sys.argv
    render_video(T + f"{tag}_video.mp4", prev)
    js = build_mix(TOTAL, T + f"{tag}_mix.wav", tag)
    print("loudnorm in", js["input_i"], "->", js["output_i"])
    run(["ffmpeg", "-v", "error", "-y", "-i", T + f"{tag}_video.mp4", "-i", T + f"{tag}_mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "256k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", T + f"{tag}.mp4"])
    json.dump(dict(shots=SH, events=EV, notes=NOTES, total=TOTAL), open(T + f"{tag}_edl.json", "w"), indent=1, default=str)
    print("done", T + f"{tag}.mp4")
