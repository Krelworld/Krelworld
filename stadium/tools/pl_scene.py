"""Generate a pixel-art scene picture (up to 400x400 area) with PixelLab pixflux.
Usage: python3 tools/pl_scene.py name W H "description" """
import base64, json, os, sys, time, urllib.error, urllib.request
API = "https://api.pixellab.ai/v2"; H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "scenes")
def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:400]}
name, w, h, desc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
code, r = call("POST", "/create-image-pixflux-background", {"description": desc, "image_size": {"width": w, "height": h}, "text_guidance_scale": 9, "no_background": False, "detail": "highly detailed", "shading": "detailed shading", "outline": "lineless"})
print("submit", code, json.dumps(r)[:200])
jid = r.get("background_job_id")
for _ in range(60):
    time.sleep(6)
    code, j = call("GET", f"/background-jobs/{jid}")
    if j.get("status") == "completed":
        lr = j.get("last_response") or {}
        img = lr.get("image") or (lr.get("images") or [None])[0]
        b64 = img.get("base64") if isinstance(img, dict) else img
        if b64:
            open(f"{OUT}/{name}.png", "wb").write(base64.b64decode(b64.split(",")[-1])); print("done", name)
        else: print("no image", json.dumps(lr)[:400])
        break
    if j.get("status") in ("failed", "error"): print("failed", json.dumps(j)[:400]); break
