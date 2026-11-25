"""Generate world art (buildings, props) as PixelLab map objects.
Usage: python3 tools/pl_world.py <spec.json> [name ...]
spec: {name: {"description": ..., "w": px, "h": px, "view": "low top-down", "style": "file.png"?}}
Writes assets/world/<name>.png. The API key is injected by the proxy (dummy bearer here)."""
import json, sys, time, urllib.request, urllib.error, base64, os
API = "https://api.pixellab.ai/v2"
H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "world")

def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:400]}

def fetch(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0"})
    with urllib.request.urlopen(req, timeout=120) as r: open(path, "wb").write(r.read())

spec = json.load(open(sys.argv[1]))
names = sys.argv[2:] or list(spec)
jobs = {}
for n in names:
    s = spec[n]
    if os.path.exists(f"{OUT}/{n}.png") and not os.environ.get("FORCE"): print("skip", n); continue
    body = {"description": s["description"], "image_size": {"width": s["w"], "height": s["h"]}, "view": s.get("view", "low top-down"),
            "outline": s.get("outline", "single color outline"), "shading": s.get("shading", "medium shading"), "detail": s.get("detail", "high detail")}
    if s.get("seed") is not None: body["seed"] = s["seed"]
    code, r = call("POST", "/map-objects", body)
    print("submit", n, code, json.dumps(r)[:200])
    oid = r.get("object_id") or r.get("id") or (r.get("data") or {}).get("object_id")
    if oid: jobs[n] = oid
for _ in range(60):
    if not jobs: break
    time.sleep(8)
    for n, oid in list(jobs.items()):
        code, r = call("GET", f"/map-objects/{oid}")
        if code == 423: continue
        if code == 200:
            url = r.get("download_url") or (r.get("data") or {}).get("download_url")
            if url:
                fetch(url, f"{OUT}/{n}.png"); print("done", n); del jobs[n]; continue
        print("status", n, code, json.dumps(r)[:300]); 
        if code in (404, 410): del jobs[n]
print("left", list(jobs))
