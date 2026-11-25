"""KrelTV promo: the cut. python3 edit.py [--list]"""
import os, sys, json, subprocess
from tv_engine import T, FPS, GSFX, GMUS, run, render_shot, says, line_wav, dur, frames
SH, EV = [], []
def now(): return sum(s["n"] for s in SH) / FPS
def S(clip): return says(clip)
def L(clip, i=0): return S(clip)[i][0]
def sec(x): return int(round(x * FPS))

def shot(clip, a, b, fr="set", **kw):
    """orig frames [a, b) of a clip; the lines said in that window come along"""
    b = min(b, frames(clip)[-1] + 1)
    t0 = now()
    SH.append(dict(kind="clip", clip=clip, f0=a, n=b - a, fr=fr, **kw))
    for f, sp, txt, key in S(clip):
        if not key: continue
        w = line_wav(key); d = dur(w)
        s0, s1 = f, f + d * FPS
        lo, hi = max(a, s0), min(b, s1)
        if hi - lo < 3: continue
        fo = 0.04 if s1 > b + 2 else 0.0
        EV.append(dict(bus="line", file=w, at=t0 + (lo - a) / FPS, fin=(lo - s0) / FPS, dur=(hi - lo) / FPS, fi=0.02 if lo > s0 else 0, fo=fo, who=sp, text=txt, clip=clip))
def card(name, secs, **kw): SH.append(dict(kind="card", card=name, n=sec(secs), **kw))
def black(secs): SH.append(dict(kind="black", n=sec(secs)))
def fx(file, at, g=0.8, d=None, fo=0.0, fin=0.0, bus="sfx"): EV.append(dict(bus=bus, file=file, at=at, gain=g, dur=d, fo=fo, fin=fin))
def click(at, st=6):
    fx(T + "sfx/click.mp3", max(0, at - 0.05), 0.9)
    fx(T + "sfx/static.wav", at, 0.35, d=st / FPS + 0.05, fo=0.03)
def music(file, at, d, g=0.25, fin=0.0, fi=0.3, fo=0.4): EV.append(dict(bus="mus", file=file, at=at, gain=g, dur=d, fin=fin, fi=fi, fo=fo))
CHAN = []  # (time, channel/show, chapter) for the beat sheet
def chan(label, chap): CHAN.append((round(now(), 2), label, chap))

exec(open(T + os.environ.get("BODY", "edit_body.py")).read())
TOTAL = now()

def build_mix(out_wav):
    inputs, chains, buses = [], [], {"mus": [], "vo": [], "line": [], "sfx": []}
    for e in EV:
        k = len(inputs)
        inputs.append(["-ss", f"{e.get('fin', 0):.3f}"] + (["-t", f"{e['dur']:.3f}"] if e.get("dur") else []) + ["-i", e["file"]])
        f = f"[{k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
        if e.get("fi"): f += f",afade=t=in:d={e['fi']}"
        if e.get("fo") and e.get("dur"): f += f",afade=t=out:st={max(0, e['dur'] - e['fo']):.3f}:d={e['fo']}"
        f += f",volume={e.get('gain', 1.0)},adelay={int(round(e['at'] * 1000))}:all=1[a{k}]"
        chains.append(f); buses[e.get("bus", "sfx")].append(f"[a{k}]")
    fc = list(chains)
    for b, labs in buses.items():
        if not labs: fc.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{TOTAL:.3f}[{b}]"); continue
        fc.append(f"{''.join(labs)}amix=inputs={len(labs)}:normalize=0:dropout_transition=0,apad,atrim=0:{TOTAL:.3f}[{b}]")
    fc.append("[vo]equalizer=f=110:t=q:w=1:g=4,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=0.08:ratio=4:attack=5:release=180:makeup=2,aecho=0.8:0.5:45|90:0.18|0.10[vop]")
    # the telly's lines: a touch of TV-speaker colour, levelled
    fc.append("[line]highpass=f=90,acompressor=threshold=0.12:ratio=3:attack=5:release=150:makeup=1.6[linep]")
    fc.append("[vop]asplit=2[vo1][vosc]"); fc.append("[linep]asplit=2[ln1][lnsc]")
    fc.append("[vosc][lnsc]amix=inputs=2:normalize=0[sc]")
    fc.append("[mus][sc]sidechaincompress=threshold=0.02:ratio=6:attack=10:release=300:makeup=1[musd]")
    fc.append("[sfx]acompressor=threshold=0.3:ratio=3:attack=3:release=120[sfxp]")
    fc.append("[vo1]volume=1.6[vog]"); fc.append("[ln1]volume=1.35[lng]"); fc.append("[musd]volume=0.9[musg]")
    fc.append("[vog][lng][sfxp][musg]amix=inputs=4:normalize=0,alimiter=limit=0.95:attack=2:release=60[mix]")
    open(T + os.environ.get("OUT", "krelworld_tv") + "_afilter.txt", "w").write(";\n".join(fc))
    args = ["ffmpeg", "-v", "error", "-y"]
    for a in inputs: args += a
    run(args + ["-filter_complex_script", T + os.environ.get("OUT", "krelworld_tv") + "_afilter.txt", "-map", "[mix]", "-ar", "48000", "-c:a", "pcm_s16le", T + os.environ.get("OUT", "krelworld_tv") + "_mixraw.wav"])
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", T + os.environ.get("OUT", "krelworld_tv") + "_mixraw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    ln = f"loudnorm=I=-14:TP=-1.5:LRA=20:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
    run(["ffmpeg", "-v", "error", "-y", "-i", T + os.environ.get("OUT", "krelworld_tv") + "_mixraw.wav", "-af", ln + ",aresample=48000", "-c:a", "pcm_s16le", out_wav])
    return js

if __name__ == "__main__":
    print("shots", len(SH), "TOTAL", round(TOTAL, 3))
    assert all(x["n"] > 0 for x in SH), [x for x in SH if x["n"] <= 0]
    if "--list" in sys.argv:
        t = 0
        for x in SH: print(f"{t / FPS:7.2f} {x['n']:4d} {x.get('clip', x.get('card', x['kind']))} {x.get('f0', '')} {x.get('fr', '')}"); t += x["n"]
        for e in EV:
            if e["bus"] == "line": print(f"  LINE {e['at']:6.2f} +{e['dur']:.2f} (in {e['fin']:.2f}) {e['who']}: {e['text'][:70]}")
        for c in CHAN: print("  CH", c)
        sys.exit()
    OUT = os.environ.get("OUT", "krelworld_tv")
    segs = [render_shot(i, x) for i, x in enumerate(SH)]
    with open(T + OUT + "_concat.txt", "w") as f:
        for p in segs: f.write(f"file '{p}'\n")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", T + OUT + "_concat.txt", "-c", "copy", T + OUT + "_video.mp4"])
    js = build_mix(T + OUT + "_mix.wav")
    print("loudnorm", js["input_i"], "->", js["output_i"])
    run(["ffmpeg", "-v", "error", "-y", "-i", T + OUT + "_video.mp4", "-i", T + OUT + "_mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-t", f"{TOTAL:.3f}", "-movflags", "+faststart", T + OUT + ".mp4"])
    run(["ffmpeg", "-v", "error", "-y", "-i", T + OUT + ".mp4", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-maxrate", os.environ.get("MAXRATE", "20M"), "-bufsize", "8M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", T + OUT + "_share.mp4"])
    json.dump(dict(shots=SH, events=EV, chan=CHAN, total=TOTAL), open(T + OUT + "_edl.json", "w"), indent=1)
    print("done")
