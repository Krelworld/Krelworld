"""Generate a whole building (roof seen from above, front below it) with PixelLab's Pro image model,
guided by a layout sketch so the footprint and doors stay where the game has them.
Usage: python3 tools/pl_bld.py <name> <width> <height> <sketch.png> "<description>" [style.png]
Writes assets/world/bld-<name>.png. Key injected by the proxy (dummy bearer here)."""
import base64, json, os, sys, time, urllib.request, urllib.error
API = "https://api.pixellab.ai/v2"; H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
OUT = os.environ.get("OUT_DIR") or os.path.join(os.path.dirname(__file__), "..", "assets", "world")
def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, {"error": e.read().decode()[:600]}
def b64(p): return base64.b64encode(open(p, "rb").read()).decode()
def size(p):
    from PIL import Image
    im = Image.open(p); return im.size
name, w, h, sketch, desc = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
style = sys.argv[6] if len(sys.argv) > 6 else None
sw, sh = size(sketch)
body = {"description": desc, "image_size": {"width": w, "height": h}, "no_background": True,
        "reference_images": [{"image": {"base64": b64(sketch)}, "size": {"width": sw, "height": sh},
                              "usage_description": "Layout guide: keep exactly this composition - the roof seen from above in the upper part, the front wall facing the viewer along the bottom, and the doorway in exactly this place. Redraw it as detailed pixel art."}]}
if os.environ.get("SEED"): body["seed"] = int(os.environ["SEED"])
if style:
    stw, sth = size(style)
    body["style_image"] = {"image": {"base64": b64(style)}, "size": {"width": stw, "height": sth}}
code, r = call("POST", "/generate-image-v2", body)
print("submit", code, json.dumps(r)[:300], flush=True)
job = r.get("background_job_id")
if not job: sys.exit(1)
for _ in range(120):
    time.sleep(6)
    code, r = call("GET", f"/background-jobs/{job}")
    st = r.get("status")
    if st in ("completed", "failed"): break
if st != "completed": print("failed", json.dumps(r)[:600]); sys.exit(1)
lr = r.get("last_response") or {}
imgs = lr.get("images") or lr.get("output_images") or []
open(f"/tmp/claude-0/-home-user/df8e9996-9506-5081-be7a-814898a7fcd1/scratchpad/t/bld/{name}.json", "w").write(json.dumps({k: (v if k != "images" else "...") for k, v in lr.items()})[:3000])
i0 = imgs[0] if imgs else None
data = None
if isinstance(i0, dict): data = i0.get("base64") or (i0.get("image") or {}).get("base64")
elif isinstance(i0, str): data = i0
if not data: print("no image", json.dumps(lr)[:800]); sys.exit(1)
if "," in data[:80]: data = data.split(",", 1)[1]
os.makedirs(OUT, exist_ok=True)
open(f"{OUT}/bld-{name}.png", "wb").write(base64.b64decode(data))
print("done", name, flush=True)
