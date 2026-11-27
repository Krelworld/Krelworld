#!/usr/bin/env python3
"""Contact sheet of a QA session's frames: one PNG a critic (or a person) can take in at a glance.
   python3 tools/qa/sheet.py qa-out/NAME   ->  qa-out/NAME/sheet.png (and sheet-2.png ... if there are many)"""
import os, sys
from PIL import Image, ImageDraw
out = sys.argv[1]
fr = sorted(f for f in os.listdir(os.path.join(out, "frames")) if f.endswith(".png"))
if not fr: sys.exit(0)
W, COLS, PER = 260, 6, 24
for page in range(0, len(fr), PER):
    chunk = fr[page:page + PER]
    ims = [Image.open(os.path.join(out, "frames", f)).convert("RGB") for f in chunk]
    h = int(W * ims[0].height / ims[0].width)
    rows = (len(ims) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * W, rows * (h + 18)), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for i, (im, f) in enumerate(zip(ims, chunk)):
        x, y = (i % COLS) * W, (i // COLS) * (h + 18)
        sheet.paste(im.resize((W, h), Image.LANCZOS), (x, y + 18))
        d.text((x + 4, y + 3), f[:-4][:40], fill=(240, 220, 120))
    sheet.save(os.path.join(out, "sheet.png" if page == 0 else f"sheet-{page // PER + 1}.png"))
print(f"sheet: {len(fr)} frames")
