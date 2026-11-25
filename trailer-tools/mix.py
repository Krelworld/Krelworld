"""Audio mix for trailer 2: music bed (arranged score) + narrator VO + game voice lines + SFX, ducked and loudness-normalised."""
import json, subprocess, os
from engine import run, T, GSFX
import music_arr as MA
SCORE = T + "music/score_v1.mp3"

def build(events, total, out_wav, music=None):
    """events: list of dict(bus='vo'|'line'|'sfx', file, at, gain=1, fin=0, dur=None, fi=0, fo=0)"""
    inputs, chains, buses = [], [], {"mus": [], "vo": [], "line": [], "sfx": []}
    def add(bus, file, at, gain=1.0, fin=0.0, dur=None, fi=0.0, fo=0.0):
        k = len(inputs)
        a = ["-ss", f"{fin:.3f}"] + (["-t", f"{dur:.3f}"] if dur else []) + ["-i", file]
        inputs.append(a)
        f = f"[{k}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
        if fi: f += f",afade=t=in:d={fi}"
        if fo and dur: f += f",afade=t=out:st={max(0, dur - fo):.3f}:d={fo}"
        f += f",volume={gain},adelay={int(round(at * 1000))}:all=1[a{k}]"
        chains.append(f)
        buses[bus].append(f"[a{k}]")
    for p in (MA.P if music is None else music):
        add("mus", SCORE, p["at"], p["g"], p["a"], p["b"] - p["a"], p["fi"], p["fo"])
    for e in events:
        add(e.get("bus", "sfx"), e["file"], e["at"], e.get("gain", 1.0), e.get("fin", 0.0), e.get("dur"), e.get("fi", 0.0), e.get("fo", 0.0))
    fc = list(chains)
    for b, labs in buses.items():
        if not labs: fc.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[{b}]"); continue
        fc.append(f"{''.join(labs)}amix=inputs={len(labs)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.3f}[{b}]")
    # narrator: trailer-voice chain (warmth, presence, compression, a little hall)
    fc.append("[vo]equalizer=f=110:t=q:w=1:g=4,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=0.08:ratio=4:attack=5:release=180:makeup=2,aecho=0.8:0.5:45|90:0.18|0.10[vop]")
    fc.append("[line]acompressor=threshold=0.12:ratio=3:attack=5:release=150:makeup=1.6[linep]")
    fc.append("[vop]asplit=2[vo1][vosc]")
    fc.append("[linep]asplit=2[ln1][lnsc]")
    fc.append("[vosc][lnsc]amix=inputs=2:normalize=0[sc]")
    fc.append("[mus][sc]sidechaincompress=threshold=0.02:ratio=8:attack=12:release=420:makeup=1[musd]")
    fc.append("[sfx]acompressor=threshold=0.3:ratio=3:attack=3:release=120[sfxp]")
    fc.append("[vo1]volume=1.7[vog]")
    fc.append("[ln1]volume=1.35[lng]")
    fc.append("[musd]volume=0.85[musg]")
    fc.append("[vog][lng][sfxp][musg]amix=inputs=4:normalize=0,alimiter=limit=0.95:attack=2:release=60[mix]")
    open(T + "afilter.txt", "w").write(";\n".join(fc))
    args = ["ffmpeg", "-v", "error", "-y"]
    for a in inputs: args += a
    run(args + ["-filter_complex_script", T + "afilter.txt", "-map", "[mix]", "-ar", "48000", "-c:a", "pcm_s16le", T + "mix_raw.wav"])
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", T + "mix_raw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=20:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    js = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    ln = f"loudnorm=I=-14:TP=-1.5:LRA=20:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
    run(["ffmpeg", "-v", "error", "-y", "-i", T + "mix_raw.wav", "-af", ln + ",aresample=48000", "-c:a", "pcm_s16le", out_wav])
    return js
