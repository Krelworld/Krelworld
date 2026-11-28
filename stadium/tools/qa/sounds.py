#!/usr/bin/env python3
"""What a QA session sounded like: how often each sound was asked for, and the worst repeats.
   python3 tools/qa/sounds.py qa-out/NAME"""
import json, sys, collections
d = sys.argv[1]
log = json.load(open(f"{d}/audio.json"))
if not log: print("no sounds asked for"); sys.exit()
t0, t1 = log[0][1], log[-1][1]; mins = max(1e-9, (t1 - t0) / 3600)
by = collections.defaultdict(list)
for name, t, vol in log: by[name].append((t, vol))
print(f"{len(log)} sounds asked for in {mins:.1f} game minutes = {len(log)/mins:.0f} a minute; {len(by)} different clips")
rows = []
for name, xs in by.items():
    ts = [t for t, _ in xs]; worst = 0
    for i, t in enumerate(ts):
        j = i
        while j < len(ts) and ts[j] - t <= 1800: j += 1
        worst = max(worst, j - i)
    rows.append((len(xs), worst, sum(v for _, v in xs) / len(xs), name))
print(f"{'clip':22} {'times':>5} {'most in 30s':>11} {'avg vol':>7}")
for n, worst, vol, name in sorted(rows, reverse=True)[:40]: print(f"{name:22} {n:5d} {worst:11d} {vol:7.2f}")
