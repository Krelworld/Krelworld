"""Generate an 8-direction object with PixelLab and save it as a sheet (S, SE, E, NE, N, NW, W, SW).
Usage: python3 tools/pl_obj8.py name size "description" """
import json, sys, time, urllib.request, urllib.error, io, os
from PIL import Image
API = "https://api.pixellab.ai/v2"; H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "world")
DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:400]}
def get_png(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.0"})
    with urllib.request.urlopen(req, timeout=120) as r: return Image.open(io.BytesIO(r.read())).convert("RGBA")
name, size, desc = sys.argv[1], int(sys.argv[2]), sys.argv[3]
code, r = call("POST", "/create-8-direction-object", {"description": desc, "size": size, "view": "low top-down"})
print("submit", code, json.dumps(r)[:200])
oid = r.get("object_id")
for _ in range(90):
    time.sleep(8)
    code, o = call("GET", f"/objects/{oid}")
    rot = (o.get("rotation_urls") or o.get("rotations") or (o.get("data") or {}).get("rotation_urls"))
    if code == 200 and rot and all((rot.get(d) if isinstance(rot, dict) else None) for d in DIRS):
        sheet = Image.new("RGBA", (size * 8, size))
        for i, d in enumerate(DIRS): sheet.alpha_composite(get_png(rot[d]).resize((size, size)), (i * size, 0))
        sheet.save(f"{OUT}/{name}-8.png"); print("done", name); break
    if code not in (200, 423): print("status", code, json.dumps(o)[:300])
else: print("timed out", json.dumps(o)[:600])
