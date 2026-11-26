"""Plain Pro image generation (no layout sketch). Usage: python3 tools/pl_img.py <out.png> <w> <h> "<description>" [style.png]"""
import base64, json, os, sys, time, urllib.request, urllib.error
API = "https://api.pixellab.ai/v2"; H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:600]}
out, w, h, desc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
body = {"description": desc, "image_size": {"width": w, "height": h}, "no_background": os.environ.get("NOBG", "0") == "1"}
if len(sys.argv) > 5:
    from PIL import Image
    sw, sh = Image.open(sys.argv[5]).size
    body["style_image"] = {"image": {"base64": base64.b64encode(open(sys.argv[5], "rb").read()).decode()}, "size": {"width": sw, "height": sh}}
code, r = call("POST", "/generate-image-v2", body)
print("submit", code, json.dumps(r)[:200], flush=True)
job = r.get("background_job_id")
if not job: sys.exit(1)
for _ in range(120):
    time.sleep(6)
    code, r = call("GET", f"/background-jobs/{job}")
    if r.get("status") in ("completed", "failed"): break
lr = r.get("last_response") or {}
imgs = lr.get("images") or []
i0 = imgs[0] if imgs else None
data = (i0.get("base64") or (i0.get("image") or {}).get("base64")) if isinstance(i0, dict) else i0
if not data: print("failed", json.dumps(r)[:500]); sys.exit(1)
if "," in data[:80]: data = data.split(",", 1)[1]
open(out, "wb").write(base64.b64decode(data)); print("done", out, flush=True)
