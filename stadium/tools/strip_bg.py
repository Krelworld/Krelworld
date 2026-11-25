"""Make a picture's flat background transparent: flood from the edges through pixels close to the corner colour."""
import sys
from collections import deque
from PIL import Image
def strip(path, tol=28):
    im = Image.open(path).convert("RGBA"); w, h = im.size; px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    ref = max(set(corners), key=corners.count)
    close = lambda c: c[3] > 0 and sum(abs(c[i] - ref[i]) for i in range(3)) <= tol
    seen = set(); q = deque()
    for x in range(w): q.extend([(x, 0), (x, h - 1)])
    for y in range(h): q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        if not close(px[x, y]): continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    im.save(path)
for p in sys.argv[1:]: strip(p); print("stripped", p)
