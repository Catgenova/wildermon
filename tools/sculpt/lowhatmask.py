"""The hat sheet's silhouettes (the leather set's hat sheet, 1536 x 1024): per view the hat cut from the dark ground
(every pixel the ground's flood from the view's border cannot reach), the turnaround's six views alone, the equipped
views (his, hers) with the face, the hair and the collar under the brim's traced lower edge (LOWER) cut off. Written to
tools/sculpt/leather/hat-masks.json as runs per row, each view with its box on the sheet, for tools/sculpt/lowhatfit.mjs;
its trim-coloured pixels to tools/sculpt/leather/hat-bright.json (the pieces).

  python3 tools/sculpt/lowhatmask.py <hat sheet png> [<preview png>]
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw

SHEET = sys.argv[1]
BG, TH = np.array([40, 21, 17]), 14
V = {'front': (530, 106, 676, 208), 'q45': (675, 106, 817, 208), 'side': (815, 106, 957, 208),
     'rq': (530, 250, 680, 356), 'back': (675, 250, 817, 356), 'top': (818, 250, 958, 356),
     'eqm': (15, 105, 265, 300), 'eqf': (258, 105, 508, 300)}
# the brim's lower edge over the face in the equipped views (sheet pixels, left to right): below it is not the hat
LOWER = {
    'eqm': [(15, 237), (27, 237), (60, 247), (95, 253), (102, 252), (103, 208), (140, 206), (172, 207), (183, 211), (190, 222), (196, 238), (206, 252), (232, 257), (262, 253), (265, 253)],
    'eqf': [(258, 238), (270, 239), (300, 251), (334, 257), (337, 222), (380, 214), (415, 217), (428, 230), (438, 250), (470, 257), (500, 233), (508, 233)],
}
# stray marks in a view's box that are not the hat (the sheet's spark over her hat)
ERASE = {'eqf': [(388, 105, 416, 132)], 'eqm': [], 'front': [(530, 106, 600, 112)]}
im = np.array(Image.open(SHEET).convert('RGB')).astype(int)
near = np.abs(im - BG).sum(2) < TH

def outside(a):
    m = Image.fromarray((a * 100).astype('uint8')).copy(); h, w = a.shape
    for x in range(w):
        for y in (0, h - 1):
            if m.getpixel((x, y)) == 100: ImageDraw.floodfill(m, (x, y), 255)
    for y in range(h):
        for x in (0, w - 1):
            if m.getpixel((x, y)) == 100: ImageDraw.floodfill(m, (x, y), 255)
    return np.array(m) == 255

out, tiles = {}, []
for k, (x0, y0, x1, y1) in V.items():
    a = near[y0:y1, x0:x1].copy()
    for (ex0, ey0, ex1, ey1) in ERASE.get(k, []): a[max(0, ey0 - y0):ey1 - y0, max(0, ex0 - x0):ex1 - x0] = True
    hat = ~outside(a)
    if k in LOWER:
        cut = Image.new('L', (x1 - x0, y1 - y0), 0)
        P = [(x - x0, y - y0) for x, y in LOWER[k]]
        ImageDraw.Draw(cut).polygon(P + [(x1 - x0, y1 - y0), (0, y1 - y0)], fill=255)
        hat &= np.array(cut) == 0
    runs = []
    for r in hat:
        d = np.flatnonzero(np.diff(np.concatenate([[0], r.astype(int), [0]])))
        runs.append([int(v) for v in d])
    out[k] = {'x0': x0, 'y0': y0, 'w': x1 - x0, 'h': y1 - y0, 'runs': runs}
    tiles.append((k, hat, im[y0:y1, x0:x1]))
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'leather', 'hat-masks.json')
json.dump(out, open(dst, 'w'))
# the trim-coloured pixels per view (the tan: red over 175, green over 100, red over blue by 70), as '0'/'1' per pixel,
# for the pieces (tools/sculpt/lowhatfit.mjs piecesFit)
bright = {}
for k, (x0, y0, x1, y1) in V.items():
    a = im[y0:y1, x0:x1]
    b = (a[..., 0] > 175) & (a[..., 1] > 100) & (a[..., 0] - a[..., 2] > 70)
    bright[k] = ''.join('1' if v else '0' for v in b.flatten())
json.dump(bright, open(os.path.join(os.path.dirname(dst), 'hat-bright.json'), 'w'))
print('wrote', dst)
if len(sys.argv) > 2:
    T = []
    for k, hat, src in tiles:
        t = (src * 0.45).astype(np.uint8); t[hat] = (t[hat] * 0.4 + np.array([255, 255, 255]) * 0.6).astype(np.uint8)
        T.append(Image.fromarray(t).resize((hat.shape[1] * 2, hat.shape[0] * 2), Image.NEAREST))
    W = sum(t.width for t in T); C = Image.new('RGB', (W, max(t.height for t in T))); x = 0
    for t in T: C.paste(t, (x, 0)); x += t.width
    C.save(sys.argv[2])
