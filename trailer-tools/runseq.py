# one browser at a time; retry a crashed capture once
import json, subprocess, sys, os, time
T = os.path.dirname(os.path.abspath(__file__)) + "/"
B = json.load(open(T + sys.argv[1]))
for n, s in B.items():
    if os.path.exists(T + f"clips/{n}.frames.txt"): print(n, "exists", flush=True); continue
    for attempt in (1, 2):
        f = T + f"specs/{n}.json"; json.dump(s, open(f, "w"))
        t = time.time()
        with open(T + f"logs/{n}.log", "w") as lg:
            r = subprocess.run(["node", T + "tvcap.cjs", n, f], stdout=lg, stderr=subprocess.STDOUT)
        ok = os.path.exists(T + f"clips/{n}.frames.txt")
        print(n, "attempt", attempt, "ok" if ok else "FAILED", int(time.time() - t), "s", flush=True)
        if ok: break
