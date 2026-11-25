# clipsheet.py clip [step] [cols] -> qa/clip.jpg: every step-th frame of a packed clip, stamped with its original frame number
import sys, os, subprocess
from PIL import Image, ImageDraw
c = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 30; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
fr = [int(x[:5]) for x in open(f"clips/{c}.frames.txt").read().split()]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f"clips/{c}.mp4", "-vf", f"select='not(mod(n\\,{step}))',scale=320:180", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
n = len(raw) // (320 * 180 * 3); rows = (n + cols - 1) // cols
S = Image.new("RGB", (320 * cols, 180 * rows))
for i in range(n):
    im = Image.frombuffer("RGB", (320, 180), raw[i * 172800:(i + 1) * 172800]); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 44, 13], fill=(0, 0, 0)); d.text((2, 1), str(fr[i * step]), fill=(255, 255, 0))
    S.paste(im, ((i % cols) * 320, (i // cols) * 180))
os.makedirs("qa", exist_ok=True); S.save(f"qa/{c}.jpg", quality=82); print(f"qa/{c}.jpg", len(fr), "frames", fr[0], "-", fr[-1])
