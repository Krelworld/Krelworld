"""Generate a set of independent square top-down floor tiles with PixelLab tiles-pro.
Usage: python3 tools/pl_tiles.py name "1). ... 2). ..." count"""
import json, sys, time, urllib.request, urllib.error, base64, os
API = "https://api.pixellab.ai/v2"; H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "tiles")
def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:500]}
name, desc = sys.argv[1], sys.argv[2]
code, r = call("POST", "/create-tiles-pro", {"description": desc, "tile_type": "square_topdown", "tile_size": 32, "tile_view": "top-down", "outline_mode": "segmentation"})
print("submit", code, json.dumps(r)[:300])
tid = r.get("tile_id") or r.get("id") or (r.get("data") or {}).get("tile_id")
for _ in range(90):
    time.sleep(8)
    code, t = call("GET", f"/tiles-pro/{tid}")
    tiles = t.get("tiles") or (t.get("data") or {}).get("tiles")
    urls = t.get("storage_urls")
    if code == 200 and urls:
        for k, u in sorted(urls.items()):
            req = urllib.request.Request(u, headers={"User-Agent": "curl/8.5.0"})
            open(f"{OUT}/{name}-{k.split('_')[1]}.png", "wb").write(urllib.request.urlopen(req, timeout=60).read())
        print("done", name, len(urls)); break
    if code == 200 and tiles:
        for i, tile in enumerate(tiles):
            b64 = tile.get("base64") or (tile.get("image") or {}).get("base64")
            open(f"{OUT}/{name}-{i}.png", "wb").write(base64.b64decode(b64))
        print("done", name, len(tiles)); break
    if code not in (200, 423, 202): print("status", code, json.dumps(t)[:300]); break
else: print("timed out", json.dumps(t)[:300])
