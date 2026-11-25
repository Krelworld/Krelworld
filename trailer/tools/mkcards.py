from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
W, H = 1920, 1080
FONT = "/home/user/Krelworld/public/fonts/krel-bold.ttf"
P = Image.open("/home/user/Krelworld/krelworld_poster.png").convert("RGB")  # 1536x2048
def F(s): return ImageFont.truetype(FONT, s)
def ctext(d, y, t, size, fill, stroke=6, sc=(0, 0, 0)):
    f = F(size); w = d.textlength(t, font=f)
    d.text(((W - w) / 2, y), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=sc)
# --- end card: the krew band of the poster, darkened, with the poster's own logo on top
bg = P.crop((0, 760, 1536, 760 + 864)).resize((W, H), Image.NEAREST)
bg = ImageEnhance.Brightness(bg).enhance(0.55)
g = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(g)
for y in range(H): gd.line([(0, y), (W, y)], fill=int(200 * max(0, 1 - y / 420)) + int(220 * max(0, (y - 760) / 320)))
bg = Image.composite(Image.new("RGB", (W, H), (8, 4, 16)), bg, g)
logo = P.crop((60, 20, 1476, 290))  # KRELWORLD lettering
lw = 1500; logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.NEAREST)
mask = Image.eval(logo.convert("L"), lambda v: 255 if v > 60 else 0).filter(ImageFilter.MaxFilter(3))
bg.paste(logo, ((W - lw) // 2, 40), mask)
d = ImageDraw.Draw(bg)
ctext(d, 850, "WONK TIL YOU KREZ", 72, (255, 182, 193))
ctext(d, 950, "PLAY FREE ON PHONE AND LAPTOP", 50, (255, 210, 63), 4)
bg.save("cards/endcard.png")
# logo alone on black (for the title slam)
t = Image.new("RGB", (W, H), (0, 0, 0)); t.paste(logo, ((W - lw) // 2, (H - logo.height) // 2), mask); t.save("cards/title.png")
print("ok", logo.size)
