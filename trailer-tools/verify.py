"""Frame checks for krelworld_tv.mp4: inside every game shot, (1) framemd5 repeats in the output must also be repeats in
the capture (a still picture in the game, not a duplicated frame), (2) every output frame must match its own capture frame
better than its neighbours (no drop / no slip), (3) frame counts add up."""
import json, subprocess, hashlib
import numpy as np
from tv_engine import T, FR, frames
import os
NAME = os.environ.get("OUT", "krelworld_tv")
E = json.load(open(T + (NAME + "_edl.json" if os.path.exists(T + NAME + "_edl.json") else "edl.json")))
W, H = 64, 36
def thumbs(path, vf, n=None):
    a = ["ffmpeg", "-v", "error", "-i", path, "-vf", vf + f",scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(a, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
def md5s(path, vf=""):
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:v"] + (["-vf", vf] if vf else []) + ["-f", "framemd5", "-"], capture_output=True, text=True, check=True).stdout
    return [l.split(",")[-1].strip() for l in out.splitlines() if l and not l.startswith("#")]
out_md5 = md5s(T + NAME + ".mp4")
tot = sum(s["n"] for s in E["shots"])
print("output frames", len(out_md5), "expected", tot, "OK" if len(out_md5) == tot else "MISMATCH")
OUT = thumbs(T + NAME + ".mp4", "null")
t = 0; bad = 0; rep_total = 0; checked = 0
lines = []
for i, s in enumerate(E["shots"]):
    n = s["n"]
    if s["kind"] == "clip":
        fl = frames(s["clip"]); a = fl.index(s["f0"])
        x, y, w, h = FR[s["fr"]]
        lo, hi = max(0, a - 2), min(len(fl), a + n + 2)
        src = thumbs(T + f"clips/{s['clip']}.mp4", f"trim=start_frame={lo}:end_frame={hi},setpts=PTS-STARTPTS,crop={w}:{h}:{x}:{y}")
        smd = md5s(T + f"clips/{s['clip']}.mp4", f"trim=start_frame={a}:end_frame={a + n},setpts=PTS-STARTPTS")
        # (1) repeats
        orep = [k for k in range(1, n) if out_md5[t + k] == out_md5[t + k - 1]]
        srep = set(k for k in range(1, n) if smd[k] == smd[k - 1])
        dup = [k for k in orep if k not in srep]
        # (2) alignment: skip the first frames (static burst + OSD change the picture) and frames whose neighbours are identical
        st = max(s.get("static", 0), 0) + 2
        slip = 0
        for k in range(st, n):
            o = OUT[t + k]
            j = a + k - lo
            d = [np.abs(src[j + m] - o).mean() if 0 <= j + m < len(src) else 1e9 for m in (-1, 0, 1)]
            if min(d[0], d[2]) < d[1] - 0.05 and abs(d[0] - d[2]) > 0.05: slip += 1
            checked += 1
        osd = s.get("osd") is not None
        lines.append(f"shot {i:2d} {s['clip']:9s} f{s['f0']}+{n}: repeats out {len(orep)} / capture {len(srep)} -> duplicated {len(dup)}; slipped {slip}{' (OSD on first 75)' if osd else ''}")
        bad += len(dup) + slip; rep_total += len(orep)
    t += n
print("\n".join(lines))
print("frames aligned-checked", checked, "problems", bad)
