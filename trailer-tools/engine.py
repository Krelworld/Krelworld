"""Render engine for trailer 2: shots -> 1920x1080/60 segments, music arrangement, audio mix."""
import json, os, subprocess
T = os.path.dirname(os.path.abspath(__file__)) + "/"
SEG = T + "seg/"
os.makedirs(SEG, exist_ok=True)
FPS = 60
GSFX = "/home/user/Rory-s-rangers-/public/audio/sfx/"
def run(a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode: raise SystemExit("FAIL " + " ".join(a)[:300] + "\n" + r.stderr[-2000:])
    return r
_FR = {}
def frames(clip):
    if clip not in _FR: _FR[clip] = [int(x[:5]) for x in open(T + f"clips/{clip}.frames.txt").read().split()]
    return _FR[clip]
def idx(clip, orig):
    """packed index of an original frame number"""
    return frames(clip).index(orig)

LB = 138  # letterbox bar height (2.39:1-ish scope look)

def render_shot(i, s):
    """s: dict(kind='clip'|'card'|'black', clip, f0 (orig frame), n (frames), z0, z1, cx, cy, grade, lb, fin, fout, flash)"""
    import hashlib
    n = s["n"]
    key = json.dumps(s, sort_keys=True)
    out = SEG + hashlib.md5(key.encode()).hexdigest()[:14] + ".mp4"
    if os.path.exists(out): return out
    z0, z1 = s.get("z0", 1.0), s.get("z1", s.get("z0", 1.0))
    cx, cy = s.get("cx", 0.5), s.get("cy", 0.5)
    cx1, cy1 = s.get("cx1", cx), s.get("cy1", cy)
    N = max(1, n - 1)
    zexpr = f"{z0}+({z1}-{z0})*on/{N}"
    xexpr = f"max(0,min(iw-iw/zoom,(({cx})+(({cx1})-({cx}))*on/{N})*iw-iw/zoom/2))"
    yexpr = f"max(0,min(ih-ih/zoom,(({cy})+(({cy1})-({cy}))*on/{N})*ih-ih/zoom/2))"
    vf = []
    if s["kind"] == "clip":
        a = idx(s["clip"], s["f0"])
        assert idx(s["clip"], s["f0"] + n - 1) == a + n - 1, f"shot {i} crosses a window gap"
        inp = ["-i", T + f"clips/{s['clip']}.mp4"]
        vf += [f"trim=start_frame={a}:end_frame={a + n}", "setpts=PTS-STARTPTS", "scale=1920:1080:flags=neighbor"] + (["hflip"] if s.get("hflip") else [])
    elif s["kind"] == "card":
        inp = ["-loop", "1", "-framerate", str(FPS), "-t", f"{n / FPS:.4f}", "-i", T + f"cards/{s['card']}.png"]
        vf += ["scale=1920:1080"]
    else:
        inp = ["-f", "lavfi", "-i", f"color=c=black:s=1920x1080:r={FPS}:d={n / FPS:.4f}"]
    vf += [f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}':d=1:s=1920x1080:fps={FPS}"]
    if s["kind"] == "clip":
        vf += [s.get("grade", "eq=contrast=1.07:saturation=1.12:gamma=0.97")]
        if s.get("shake"):
            A = s["shake"]
            vf += [f"crop=1920-{2*A}:1080-{2*A}:{A}+{A}*sin(n*2.1):{A}+{A}*cos(n*2.7)", "scale=1920:1080"]
        vf += ["vignette=angle=PI/5"]
        if s.get("lb", True): vf += [f"drawbox=x=0:y=0:w=1920:h={LB}:color=black:t=fill", f"drawbox=x=0:y={1080-LB}:w=1920:h={LB}:color=black:t=fill"]
    if s.get("flash"): vf += [f"fade=t=in:st=0:d={s['flash']}:color=white"]
    if s.get("fin"): vf += [f"fade=t=in:st=0:d={s['fin']}"]
    if s.get("fout"): vf += [f"fade=t=out:st={n / FPS - s['fout']:.4f}:d={s['fout']}"]
    vf += [f"trim=end_frame={n}", "format=yuv420p"]
    run(["ffmpeg", "-v", "error", "-y", *inp, "-vf", ",".join(vf), "-r", str(FPS), "-frames:v", str(n), "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", out])
    return out
