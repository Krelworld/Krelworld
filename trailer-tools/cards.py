"""Cards and overlays for the KrelTV promo (1920x1080)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os
T = os.path.dirname(os.path.abspath(__file__)) + "/"
OUT = T + "cards/"; os.makedirs(OUT, exist_ok=True)
FONT = "/home/user/Rory-s-rangers-/public/fonts/krel-bold.ttf"
MONO = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-ExtraBold.ttf"
W, H = 1920, 1080
GOLD = (232, 180, 40); WHITE = (240, 240, 240); GREEN = (90, 255, 110)
def F(s, f=FONT): return ImageFont.truetype(f, s)
def spaced(d, cx, y, text, font, fill, track=0.12):
    sp = font.size * track
    ws = [d.textlength(c, font=font) for c in text]
    x = cx - (sum(ws) + sp * (len(text) - 1)) / 2
    for c, w in zip(text, ws):
        d.text((x, y), c, font=font, fill=fill, anchor="ls"); x += w + sp
def bg(top=(10, 14, 40), bot=(2, 2, 10)):
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / H; d.line([(0, y), (W, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * k) for i in range(3)))
    for y in range(0, H, 4): d.line([(0, y), (W, y)], fill=(0, 0, 0))  # scanlines
    return im
def glow_text(im, items, glow, rad=22):
    g = Image.new("RGB", (W, H)); gd = ImageDraw.Draw(g)
    for t, s, c, tr, y in items: spaced(gd, W / 2, y, t, F(s), glow, tr)
    im = ImageChops.add(im, g.filter(ImageFilter.GaussianBlur(rad)))
    d = ImageDraw.Draw(im)
    for t, s, c, tr, y in items: spaced(d, W / 2, y, t, F(s), c, tr)
    return im
def badge(im, cx, cy, w, h):
    # the telly's own gold "KRELTV" plate, big
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], radius=28, fill=(60, 36, 14), outline=GOLD, width=10)
    d.rounded_rectangle([cx - w / 2 + 22, cy - h / 2 + 22, cx + w / 2 - 22, cy + h / 2 - 22], radius=16, outline=(150, 105, 25), width=4)
    return im

im = bg()
im = glow_text(im, [("TONIGHT ON", 72, WHITE, 0.3, 400)], (80, 90, 160), 14)
im = badge(im, W / 2, 600, 1240, 300)
im = glow_text(im, [("KRELTV", 180, GOLD, 0.08, 670)], (160, 100, 10), 26)
im.save(OUT + "tonight.png")

im = bg()
im = badge(im, W / 2, 400, 1240, 300)
im = glow_text(im, [("KRELTV", 180, GOLD, 0.08, 470)], (160, 100, 10), 26)
im = glow_text(im, [("SEEN BY 9", 110, WHITE, 0.2, 720)], (90, 90, 140), 18)
d = ImageDraw.Draw(im)
d.line([(560, 790), (W - 560, 790)], fill=(120, 120, 150), width=3)
spaced(d, W / 2, 870, "KRELWORLD  -  PLAY FREE IN YOUR BROWSER", F(46), WHITE, 0.1)
spaced(d, W / 2, 950, "krelworld.github.io/Krelworld", F(42), GOLD, 0.04)
im.save(OUT + "endcard.png")

# channel OSD overlays (transparent), green VCR style, top-left of the picture
CH = {1: "KRUNCHE NEWS", 2: "CHANNEL KREZ", 3: "BBK ONE", 4: "WONKING MACHINE SHOPPING NETWORK", 5: "KRELWORLD DOCUMENTARIES"}
for n, name in CH.items():
    o = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    x, y = 330, 60
    for dx, dy, col in ((5, 5, (0, 0, 0, 230)), (0, 0, GREEN + (255,))):
        d.text((x + dx, y + dy), f"CH {n:02d}", font=F(96, MONO), fill=col)
        d.text((x + dx, y + 118 + dy), name, font=F(44, MONO), fill=col)
    o.save(OUT + f"osd{n}.png")
print("cards ok")
