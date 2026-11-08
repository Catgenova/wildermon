"""The helm sheet's five silhouettes per body (the plate set's helm sheet, 1672 x 941): each view's helm cut from the
dark ground by its brightness, the one piece reached from its dome, its holes filled, the body below it cut off where
the view joins it (a row per view). Written to tools/sculpt/plate/helm-masks.json as runs per row, each view with its
box on the sheet, for tools/sculpt/lowhelmfit.mjs.

  python3 tools/sculpt/lowhelmmask.py <helm sheet png> [<preview png>]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw

SHEET = sys.argv[1]
VIEWS = {'male': [110, 276, 446, 606, 746], 'female': [945, 1082, 1265, 1425, 1580]}
# rows (sheet y) under which a view's helm is cut from the body it touches; none where the neck parts them
CUT = {'male': [None, None, None, 228, None], 'female': [None, 230, None, None, None]}
Y0, Y1, HALF, TH = 100, 292, 82, 62

lum = np.array(Image.open(SHEET).convert('RGB')).astype(int).sum(2) / 3
out, tiles = {}, []
for who, xs in VIEWS.items():
    out[who] = []
    for i, xc in enumerate(xs):
        x0, x1 = xc - HALF, xc + HALF
        a = (lum[Y0:Y1, x0:x1] > TH)
        if CUT[who][i]: a[CUT[who][i] - Y0:] = False
        m = Image.fromarray((a * 100).astype('uint8')).copy()
        ys, xs_ = np.where(a[10:60])
        k = np.argmin((xs_ - HALF) ** 2 + (ys + 10 - 30) ** 2)
        ImageDraw.floodfill(m, (int(xs_[k]), int(ys[k]) + 10), 255)
        c = np.array(m) == 255
        bg = Image.fromarray(((~c) * 100).astype('uint8')).copy()
        ImageDraw.floodfill(bg, (0, 0), 255)
        c = c | (np.array(bg) == 100)
        runs = []
        for r in c:
            d = np.flatnonzero(np.diff(np.concatenate([[0], r.astype(int), [0]])))
            runs.append([int(v) for v in d])
        out[who].append({'x0': int(x0), 'y0': Y0, 'w': int(c.shape[1]), 'h': int(c.shape[0]), 'runs': runs})
        tiles.append(c)
dst = os.path.join(os.path.dirname(__file__), 'plate', 'helm-masks.json')
json.dump(out, open(dst, 'w'))
print('wrote', dst)
if len(sys.argv) > 2:
    W = Image.new('L', (2 * HALF * 5, (Y1 - Y0) * 2))
    for n, t in enumerate(tiles): W.paste(Image.fromarray((t * 255).astype('uint8')), ((n % 5) * 2 * HALF, (n // 5) * (Y1 - Y0)))
    W.save(sys.argv[2])
