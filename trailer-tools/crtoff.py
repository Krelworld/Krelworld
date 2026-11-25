"""CRT switch-off: the screen collapses to a bright line, then a dot, the room goes dark. Writes cards/crtoff/%03d.png"""
import os, subprocess, sys
from PIL import Image, ImageEnhance, ImageDraw
from tv_engine import T, FR, SCREEN, out_rect, frames
def make(clip, f, fr="set", n=26):
    d = T + "cards/crtoff/"; os.makedirs(d, exist_ok=True)
    for x in os.listdir(d): os.remove(d + x)
    a = frames(clip).index(f)
    x, y, w, h = FR[fr]
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", T + f"clips/{clip}.mp4", "-vf", f"select=eq(n\\,{a}),crop={w}:{h}:{x}:{y},scale=1920:1080:flags=neighbor", "-frames:v", "1", d + "src.png"], check=True)
    src = Image.open(d + "src.png").convert("RGB"); os.remove(d + "src.png")
    rx, ry, rw, rh = out_rect(fr, SCREEN)
    scr = src.crop((rx, ry, rx + rw, ry + rh))
    cx, cy = rx + rw // 2, ry + rh // 2
    for k in range(n):
        im = src.copy()
        im.paste((0, 0, 0), (rx, ry, rx + rw, ry + rh))
        if k < 7:      # squash vertically, getting brighter
            sh = max(4, int(rh * (1 - (k + 1) / 7) ** 2))
            p = ImageEnhance.Brightness(scr.resize((rw, sh))).enhance(1 + k * 0.5)
            im.paste(p, (rx, cy - sh // 2))
        elif k < 13:   # a white line shrinking to a dot
            lw = max(6, int(rw * (1 - (k - 6) / 6) ** 2)); ImageDraw.Draw(im).rectangle([cx - lw // 2, cy - 3, cx + lw // 2, cy + 3], fill=(255, 255, 255))
        elif k < 17:
            r = 6 - (k - 13); ImageDraw.Draw(im).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255))
        # the room dims with the picture
        im = ImageEnhance.Brightness(im).enhance(max(0.0, 1 - k / (n - 1)))
        im.save(d + f"{k:03d}.png")
    return d + "%03d.png", n
if __name__ == "__main__":
    print(make(sys.argv[1], int(sys.argv[2])))
