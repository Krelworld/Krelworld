"""PixelLab characters: create, make states, animate, and download as game sheets.
The API key is injected by the proxy (dummy bearer here).

  python3 tools/pl_char.py new NAME "description"             -> assets/raw/char-NAME.json (id)
  python3 tools/pl_char.py state NAME FROM "edit description"  -> a state of FROM's character, saved as NAME
  python3 tools/pl_char.py anim NAME ANIM "action" [frames]    -> animate all 8 directions
        action is a website template ("walking", "punch", "two punch combo", "high kick", "uppercut", ...)
        or free text (v3 custom), e.g. "recoils from a punch to the face"
  python3 tools/pl_char.py status NAME                         -> what is done
  python3 tools/pl_char.py sheets NAME [PREFIX]                -> assets/art/PREFIX-rot.png and PREFIX-ANIM.png
        (rot: 8 cells S, SE, E, NE, N, NW, W, SW; anim: one row per direction, frames across)
"""
import io, json, os, sys, urllib.error, urllib.request
from PIL import Image

API = "https://api.pixellab.ai/v2"
H = {"Authorization": "Bearer x", "Content-Type": "application/json"}
ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW, ART = os.path.join(ROOT, "assets", "raw"), os.path.join(ROOT, "assets", "art")
DIRS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
TEMPLATES = {"walking", "running", "full sprinting", "idle breathing", "punch", "left punch", "high kick", "swoop kick", "two punch combo", "uppercut"}


def call(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, headers=H, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:600]}


def img(url):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8.5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGBA")


def ids():
    p = os.path.join(RAW, "pl-characters.json")
    d = json.load(open(p)) if os.path.exists(p) else {}
    old = os.path.join(RAW, "characters-jobs.json")
    if os.path.exists(old):
        for k, v in json.load(open(old)).items():
            d.setdefault(k, v.get("character_id"))
    return d


def save_id(name, cid):
    d = ids(); d[name] = cid
    json.dump(d, open(os.path.join(RAW, "pl-characters.json"), "w"), indent=1)


cmd = sys.argv[1]
if cmd == "new":
    name, desc = sys.argv[2], sys.argv[3]
    code, r = call("POST", "/create-character-v3", {"description": desc, "name": f"KD {name}", "image_size": {"width": 64, "height": 64},
                                                     "view": "low top-down", "outline": "single color black outline", "detail": "medium detail",
                                                     **({"template_id": os.environ["TEMPLATE"]} if os.environ.get("TEMPLATE") else {}),
                                                     **({"image_size": {"width": int(os.environ["SIZE"]), "height": int(os.environ["SIZE"])}} if os.environ.get("SIZE") else {})})
    print(name, code, json.dumps(r)[:300])
    if r.get("character_id"): save_id(name, r["character_id"])
elif cmd == "state":
    name, src, edit = sys.argv[2], sys.argv[3], sys.argv[4]
    code, r = call("POST", "/create-character-state", {"character_id": ids()[src], "edit_description": edit, "state_name": name[:20],
                                                        "use_color_palette_from_reference": True})
    print(name, code, json.dumps(r)[:300])
    cid = r.get("character_id") or r.get("new_character_id") or (r.get("data") or {}).get("character_id")
    if cid: save_id(name, cid)
elif cmd == "anim":
    name, anim, action = sys.argv[2], sys.argv[3], sys.argv[4]
    frames = int(sys.argv[5]) if len(sys.argv) > 5 else None
    # ONLY=south animates just the one direction (a TV close-up only ever faces the camera).
    dirs = os.environ["ONLY"].split(",") if os.environ.get("ONLY") else DIRS
    body = {"character_id": ids()[name], "animation_name": anim, "directions": dirs}
    if action in ("walking", "running", "full sprinting"): body.update({"mode": "v3", "template_action": action})
    elif action in TEMPLATES: body.update({"mode": "pixminimax", "template_action": action}); frames = frames and max(4, round(frames / 4) * 4)
    else: body.update({"mode": "v3", "action_description": action})
    if frames: body["frame_count"] = frames
    code, r = call("POST", "/characters/animations", body)
    print(name, anim, code, json.dumps(r)[:300])
elif cmd == "queue":
    # Run a list of jobs (one per line: the arguments to this script), retrying while the job slots are full.
    import shlex, subprocess, time
    lines = [l for l in open(sys.argv[2]).read().splitlines() if l.strip() and not l.startswith("#")]
    for l in lines:
        while True:
            out = subprocess.run([sys.executable, __file__, *shlex.split(l)], capture_output=True, text=True).stdout
            print(out.strip()[:200], flush=True)
            if " 429 " in out or "job slots" in out: time.sleep(25); continue
            break
elif cmd == "status":
    code, c = call("GET", f"/characters/{ids()[sys.argv[2]]}")
    print(c.get("status"), [(a["display_name"], [(d["direction"], d.get("frame_count")) for d in a["directions"]]) for a in c.get("animations", [])])
elif cmd == "sheets":
    name = sys.argv[2]; prefix = sys.argv[3] if len(sys.argv) > 3 else name
    code, c = call("GET", f"/characters/{ids()[name]}")
    if c.get("status") != "completed": print(name, "not ready:", c.get("status")); sys.exit(1)
    rot = [img(c["rotation_urls"][d]) for d in DIRS]
    # The game's cells are 88 px with the 64 px figure frame 12 px in, as the first sheets were.
    W = Hh = int(os.environ.get("CELLSZ", "88")); P = 12
    sheet = Image.new("RGBA", (W * 8, Hh))
    for i, f in enumerate(rot): sheet.paste(f, (i * W + (W - f.width) // 2, (Hh - f.height) // 2))
    if not (len(sys.argv) > 4 and sys.argv[4] == "anims"): sheet.save(os.path.join(ART, f"{prefix}-rot.png")); print("rot", W, Hh)
    rows = os.environ["ONLY"].split(",") if os.environ.get("ONLY") else DIRS
    for a in c.get("animations", []):
        by = {d["direction"]: d["frames"] for d in a["directions"]}
        if not all(d in by for d in rows): print("skip incomplete", a["display_name"], sorted(by)); continue
        if len(sys.argv) > 4 and sys.argv[4] == "anims" and a["display_name"] in ("walk",): continue
        n = max(len(v) for v in by.values())
        out = Image.new("RGBA", (W * n, Hh * len(rows)))
        for r_, d in enumerate(rows):
            for i, u in enumerate(by[d]):
                f = img(u)
                out.paste(f, (i * W + (W - f.width) // 2, r_ * Hh + (Hh - f.height) // 2))
        out.save(os.path.join(ART, f"{prefix}-{a['display_name']}.png")); print("anim", a["display_name"], n)
    json.dump(c, open(os.path.join(RAW, f"char-{name}.json"), "w"))
