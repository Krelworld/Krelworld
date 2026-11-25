# qa.py clip [step] -> qa/clip.jpg (orig frame numbers stamped), and the logged line starts
import sys, subprocess, os
from PIL import Image, ImageDraw
from tv_engine import frames, says
c = sys.argv[1]; step = int(sys.argv[2]) if len(sys.argv) > 2 else 30; cols = 6
fr = frames(c)
os.makedirs('qa/tmp', exist_ok=True)
for f in os.listdir('qa/tmp'): os.remove('qa/tmp/' + f)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'clips/{c}.mp4', '-vf', f"select='not(mod(n\\,{step}))',scale=480:270", '-vsync', '0', 'qa/tmp/%04d.png'], check=True)
fs = sorted(os.listdir('qa/tmp')); rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (480 * cols, 270 * rows))
for i, f in enumerate(fs):
    im = Image.open('qa/tmp/' + f); d = ImageDraw.Draw(im); n = i * step
    d.rectangle([0, 0, 60, 14], fill=(0, 0, 0)); d.text((2, 1), str(fr[n]), fill=(255, 255, 0))
    S.paste(im, ((i % cols) * 480, (i // cols) * 270))
S.save(f'qa/{c}.jpg', quality=80)
print(c, len(fr), fr[0], fr[-1], 'gaps', [(a, b) for a, b in zip(fr, fr[1:]) if b != a + 1])
for s in says(c): print('  say', s[0], s[1], s[2][:60])
