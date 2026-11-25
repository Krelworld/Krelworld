import json, subprocess, sys, os, time
from concurrent.futures import ThreadPoolExecutor
T = os.path.dirname(os.path.abspath(__file__)) + "/"
B = json.load(open(T + sys.argv[1])); only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
os.makedirs(T + "specs", exist_ok=True); os.makedirs(T + "logs", exist_ok=True)
def go(item):
    n, s = item
    f = T + f"specs/{n}.json"; json.dump(s, open(f, "w"))
    t = time.time()
    with open(T + f"logs/{n}.log", "w") as lg:
        r = subprocess.run(["node", T + "tvcap.cjs", n, f], stdout=lg, stderr=subprocess.STDOUT, timeout=4 * 3600)
    print(n, r.returncode, int(time.time() - t), "s", open(T + f"logs/{n}.log").read().strip().split("\n")[-1][:150], flush=True)
items = [(n, s) for n, s in B.items() if not only or n in only]
with ThreadPoolExecutor(int(sys.argv[2])) as ex: list(ex.map(go, items))
