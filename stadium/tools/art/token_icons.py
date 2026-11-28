#!/usr/bin/env python3
"""Draws the hydration plant's token icons (assets/icons/*.png, 48 px, the same chunky look as the rest):
flat shapes at 24 px doubled up, then a dark one-pixel outline round the lot.
   python3 tools/art/token_icons.py
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "icons")
DARK = (22, 19, 15, 255)

def finish(im):
    big = im.resize((48, 48), Image.NEAREST)
    px = big.load()
    out = big.copy(); op = out.load()
    for y in range(48):
        for x in range(48):
            if px[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < 48 and 0 <= ny < 48 and px[nx, ny][3]:
                    op[x, y] = DARK
                    break
    return out

def canvas():
    im = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def rocket_tonic():
    im, d = canvas()
    d.rectangle((8, 4, 15, 21), fill=(216, 52, 36, 255))          # the can
    d.rectangle((8, 4, 9, 21), fill=(240, 96, 70, 255))           # its shine
    d.rectangle((14, 4, 15, 21), fill=(160, 30, 24, 255))
    d.rectangle((8, 3, 15, 4), fill=(196, 200, 206, 255))         # rim and ring pull
    d.rectangle((8, 21, 15, 22), fill=(150, 154, 160, 255))
    d.rectangle((11, 2, 13, 2), fill=(150, 154, 160, 255))
    d.rectangle((9, 9, 14, 17), fill=(250, 240, 220, 255))        # the label
    d.polygon([(11, 10), (12, 10), (13, 12), (13, 14), (10, 14), (10, 12)], fill=(40, 60, 150, 255))  # a rocket
    d.point((11, 12), fill=(250, 240, 220, 255))
    d.rectangle((10, 15, 10, 15), fill=(242, 200, 30, 255)); d.rectangle((13, 15, 13, 15), fill=(242, 200, 30, 255))
    d.rectangle((11, 15, 12, 16), fill=(255, 140, 20, 255))
    return finish(im)

def sleepy_syrup():
    im, d = canvas()
    d.rectangle((8, 8, 16, 21), fill=(104, 62, 170, 255))         # the bottle
    d.rectangle((8, 8, 9, 21), fill=(140, 100, 205, 255))
    d.rectangle((15, 8, 16, 21), fill=(70, 40, 122, 255))
    d.rectangle((10, 5, 14, 7), fill=(104, 62, 170, 255))         # neck
    d.rectangle((10, 2, 14, 4), fill=(236, 232, 220, 255))        # cap
    d.rectangle((10, 4, 14, 4), fill=(190, 186, 174, 255))
    d.rectangle((9, 11, 15, 18), fill=(244, 238, 222, 255))       # label
    d.ellipse((10, 12, 14, 16), fill=(240, 190, 40, 255))         # a moon
    d.ellipse((12, 11, 15, 15), fill=(244, 238, 222, 255))
    d.point((14, 17), fill=(104, 62, 170, 255)); d.point((13, 17), fill=(104, 62, 170, 255))
    return finish(im)

def dodgy_electrolytes():
    im, d = canvas()
    d.polygon([(6, 5), (18, 3), (19, 20), (5, 21)], fill=(40, 190, 184, 255))    # a sachet, not square
    d.polygon([(6, 5), (8, 5), (7, 21), (5, 21)], fill=(110, 226, 220, 255))
    d.polygon([(6, 5), (18, 3), (18, 5), (6, 7)], fill=(22, 130, 128, 255))       # the crimp
    for x in (8, 11, 14, 17):
        d.point((x, 4), fill=(110, 226, 220, 255))
    d.polygon([(13, 8), (9, 14), (12, 14), (10, 19), (15, 12), (12, 12)], fill=(246, 214, 40, 255))  # a bolt
    d.rectangle((15, 16, 17, 18), fill=(216, 52, 36, 255))        # a price sticker somebody's picked at
    return finish(im)

def ronson_filth():
    im, d = canvas()
    d.ellipse((5, 11, 18, 22), fill=(92, 62, 26, 255))            # it
    d.ellipse((7, 8, 16, 16), fill=(108, 74, 30, 255))
    d.ellipse((9, 5, 14, 11), fill=(122, 86, 36, 255))
    d.rectangle((11, 4, 12, 5), fill=(122, 86, 36, 255))
    d.rectangle((8, 13, 10, 13), fill=(150, 112, 56, 255)); d.rectangle((10, 8, 11, 8), fill=(150, 112, 56, 255)); d.rectangle((7, 18, 9, 18), fill=(150, 112, 56, 255))
    d.rectangle((13, 19, 16, 19), fill=(64, 42, 16, 255)); d.rectangle((13, 14, 15, 14), fill=(64, 42, 16, 255))
    for x, y in ((18, 5), (19, 4), (19, 8), (20, 7), (3, 6), (4, 5)):   # what comes off it
        d.point((x, y), fill=(150, 190, 60, 255))
    d.point((20, 12), fill=(30, 30, 30, 255)); d.point((2, 10), fill=(30, 30, 30, 255))  # flies
    return finish(im)

if __name__ == "__main__":
    for name, fn in (("rocket_tonic", rocket_tonic), ("sleepy_syrup", sleepy_syrup), ("dodgy_electrolytes", dodgy_electrolytes), ("ronson_filth", ronson_filth)):
        fn().save(os.path.join(OUT, f"{name}.png"))
        print("wrote", name)
