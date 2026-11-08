# The side braid's sheet read off (tools/sculpt/ref/hair-side-braid.png, its top 400 rows, five views): per view the
# figure, its skin and its hair, exactly, and the face's landmarks, found by their colours. Writes
# tools/sculpt/hairs/braid-sheet.json: { w, h, fig, hair, skin: runs per row ([x0, x1) pairs), marks: { view: {...} },
# creases: [[x, y, depth]] } and the hair as braid-mask.json / braid-mask.png (white the hair, grey the skin) for
# tools/sculpt/lowbraid.mjs.
#
#  fig    the background is one flat dark colour; a pixel is the figure where it is over BG_D off it, or where it is as
#         dark but not reached from the sheet's edge through wide stretches of it (the creases between the locks).
#  skin   the skin's hue: (G - B) / R over SKIN_H (3x3 mean): the skin 0.13 to 0.17, the hair 0.03 to 0.11 however lit;
#         or pale with its green as high as its blue (the rim light), or lit with its green over 0.67 of its red (the
#         bust's cool shade).
#         The largest piece per view is the body; a piece of 400 px or more is an ear cut off by a lock; the rest (the
#         hair tie, lit specks on the hair) is hair. A piece of the rest of the figure that is not the view's hair mass
#         (the bust's edges in the lavender rim light) is skin.
#  marks  pupils: the grey squares (5-14 px a side); brows: the dark warm bars over them (two ends, middle); the
#         nose's tip: the profile's front-most skin pixel in the nose's rows, else the nose's shadow's lowest middle; the
#         chin: the profile's jaw corner, the front's and three-quarter's the lowest point of the step from the face's lit
#         underside to the neck's shade; the ears: the profile's and the rear three-quarter's
#         cut-off skin piece's middle; the neck's sides: where its skin meets the background, NECK_DY under the chin
#         (the views from behind: at NECK_Y).
#
#   python3 tools/sculpt/lowbraidsheet.py [--show <png>]
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
H = 405
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-side-braid.png')).convert('RGB')).astype(float)[:H]
W = im.shape[1]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
lum = 0.3 * R + 0.59 * G + 0.11 * B
SPAN = {'front': (40, 345), 'q3': (345, 650), 'profile': (650, 955), 'r3': (955, 1245), 'back': (1245, 1536)}
BG = np.array([58, 42, 47])
BG_D, SKIN_H, FLOOR = 22, 0.122, 405


def box(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge'), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2


def components(m):
    """4-connected components of a mask: a label image (0 none) and each label's pixel count."""
    h, w = m.shape
    lab = np.zeros(m.shape, np.int32)
    sizes = [0]
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]: continue
        n = len(sizes); lab[y0, x0] = n; q = deque([(y0, x0)]); c = 0
        while q:
            y, x = q.popleft(); c += 1
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; q.append((yy, xx))
        sizes.append(c)
    return lab, np.array(sizes)


def view_of(x):
    return next((v for v, (a, b) in SPAN.items() if a <= x < b), None)


# ---- the figure -------------------------------------------------------------------------------------------------------
dist = np.sqrt(((im - BG) ** 2).sum(-1))
plain = dist < BG_D
wide = plain & (box(dist, 3) < 14)
lab, sizes = components(wide)
bg = np.zeros(plain.shape, bool)
edge_labels = set(lab[0]) | set(lab[:, 0]) | set(lab[:, -1]) | set(np.flatnonzero(sizes > 20000))
edge_labels.discard(0)
bg = np.isin(lab, list(edge_labels))
for _ in range(4):
    g = bg.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): g |= np.roll(bg, (dy, dx), (0, 1))
    bg = g & plain
fig = ~bg
fig[FLOOR:] = False

# ---- the skin and the hair --------------------------------------------------------------------------------------------
hue = box((G - B) / np.maximum(R, 1), 1)
# (and the skin in the lavender rim light: pale, its green over its red's 0.78 and not under its blue; the hair's rim
# light has more blue than green)
rim = ((G / np.maximum(R, 1) > 0.78) & (G - B >= -2) & (lum > 95)) | ((G / np.maximum(R, 1) > 0.67) & (hue > 0.06) & (lum > 110))
skin0 = fig & ((hue > SKIN_H) | rim)
lab, sizes = components(skin0)
skin = np.zeros(fig.shape, bool)
for v, (a, b) in SPAN.items():
    ls, cs = np.unique(lab[:, a:b][lab[:, a:b] > 0], return_counts=True)
    if not len(ls): continue
    big = ls[np.argmax(sizes[ls])]
    for l in ls:
        if l == big or sizes[l] >= 400: skin |= lab == l
# the skin's holes: the eyes, the brows, the lids, the nose's shade, the lips' line (not touching the background, under
# 600 px, and inside the face: their rows)
lab, sizes = components(fig & ~skin)
hair = np.zeros(fig.shape, bool)
for v, (a, b) in SPAN.items():
    sub = lab[:, a:b]
    ls = np.unique(sub[sub > 0])
    if not len(ls): continue
    big = ls[np.argmax(sizes[ls])]
    for l in ls:
        m = lab == l
        if l == big: hair |= m; continue
        ys, xs = np.nonzero(m)
        ring = np.zeros(fig.shape, bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): ring[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, W - 1)] = True
        ring &= ~m
        if skin[ring].mean() > 0.95: skin |= m          # a hole in the skin: the eye, the brow
        elif sizes[l] >= 150: hair |= m                  # a lock apart from the mass (the tip, cut off by the tie)
        else: skin |= m                                  # the bust's lit edges, specks
skin &= ~hair
# the hair tie: the skin's colour, but between the braid above and its tip below (hair within TIE px both up and down
# the column), low on the sheet
TIE = 12
up = np.zeros(fig.shape, bool); dn = np.zeros(fig.shape, bool)
for k in range(1, TIE + 1): up[k:] |= hair[:-k]; dn[:-k] |= hair[k:]
tie = skin & up & dn
tie[:300] = False
hair |= tie; skin &= ~tie

# ---- the landmarks ----------------------------------------------------------------------------------------------------
marks = {v: {} for v in SPAN}
grey = fig & (lum > 50) & (lum < 100) & (R - G < 30) & (np.abs(G - B) < 8)
grey[:145] = False; grey[185:] = False
lab, sizes = components(grey)
for l in range(1, len(sizes)):
    ys, xs = np.nonzero(lab == l)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    v = view_of(xs.mean())
    if v and 4 <= w <= 14 and 5 <= h <= 14 and len(ys) >= 20:
        marks[v].setdefault('pupils', []).append([round(float(xs.mean() + 0.5), 2), round(float(ys.mean() + 0.5), 2)])
brow = fig & (lum < 85) & (R - G > 30) & ~hair
brow[:120] = False; brow[155:] = False
lab, sizes = components(brow)
for l in range(1, len(sizes)):
    ys, xs = np.nonzero(lab == l)
    v = view_of(xs.mean())
    if v and xs.max() - xs.min() > 30 and ys.max() - ys.min() < 14 and len(ys) > 40:
        def end(x):
            r = ys[xs == x]; return [float(x + 0.5), float((r.min() + r.max()) / 2 + 0.5)]
        marks[v].setdefault('brows', []).append({'a': end(xs.min()), 'b': end(xs.max()), 'mid': [round(float(xs.mean() + 0.5), 2), round(float(ys.mean() + 0.5), 2)]})
for v in marks:
    for k in ('pupils', 'brows'):
        if k in marks[v]: marks[v][k].sort(key=lambda p: (p['mid'] if isinstance(p, dict) else p)[0])

# the profile: the nose's tip (the front-most skin in rows 175-205) and the chin (the jaw's corner: the lowest row whose
# front-most skin is within 6 px of the chin's front)
a, b = SPAN['profile']
front = np.array([(np.flatnonzero(skin[y, a:b]).max() + a if skin[y, a:b].any() else -1) for y in range(H)])
yn = 175 + int(np.argmax(front[175:205]))
marks['profile']['nose'] = [float(front[yn] + 0.5), float(yn + 0.5)]
# (the chin: the jaw's corner, the outline's point furthest from the line from its front at row 215 to the neck's at 262)
P0, P1 = np.array([front[215], 215.0]), np.array([front[262], 262.0])
dn = np.array([P1[1] - P0[1], -(P1[0] - P0[0])]); dn /= np.linalg.norm(dn)
yc = max(range(215, 262), key=lambda y: abs((np.array([front[y], y]) - P0) @ dn))
marks['profile']['chin'] = [float(front[yc] + 0.5), float(yc + 0.5)]
# the front and three-quarter: the nose's shadow (the darkest skin in a 3 px box in rows 185-205 between the pupils)
# and the chin (down the face's middle under the nose, the row where the skin's luminance drops most: the lit jaw over
# the neck's shade)
L3 = box(lum, 1)
for v in ('front', 'q3'):
    p = marks[v].get('pupils', [])
    if len(p) < 2: continue
    x0, x1 = int(p[0][0]), int(p[1][0])
    sub = np.where(skin[185:205, x0:x1], L3[185:205, x0:x1], 999)
    yy, xx = np.unravel_index(np.argmin(sub), sub.shape)
    marks[v]['nose'] = [float(x0 + xx + 0.5), float(185 + yy + 0.5)]
    # (the chin: per column between the pupils the row under the nose where the skin's luminance drops most, the lit
    # jaw over the neck's shade; the chin the lowest of those, the columns within 2 px of it averaged)
    rows = []
    for cx in range(x0, x1 + 1):
        col = L3[215:270, cx]
        rows.append(215 + int(np.argmax(col[:-3] - col[3:])) + 2)
    rows = np.array(rows); lo = rows.max(); xs = np.flatnonzero(rows >= lo - 1) + x0
    marks[v]['chin'] = [float(xs.mean() + 0.5), float(lo)]
# the ears cut off by the hair: the profile's (her right) and the rear three-quarter's (her left): the skin pieces apart
# from the body's
lab, sizes = components(skin)
for v in ('profile', 'r3'):
    a, b = SPAN[v]
    ls = np.unique(lab[:, a:b][lab[:, a:b] > 0])
    big = ls[np.argmax(sizes[ls])]
    for l in ls:
        if l == big or sizes[l] < 200: continue
        ys, xs = np.nonzero(lab == l)
        if 140 < ys.mean() < 230: marks[v].setdefault('ears', []).append([round(float(xs.mean() + 0.5), 2), round(float(ys.mean() + 0.5), 2)])
# (the ears read off by hand where no skin piece of their own is found: their middles; the profile's is her right, the
# rear three-quarter's her left)
EARS = {'profile': [[773.5, 175.5]], 'r3': [[1040.5, 176.5]]}
for v, e in EARS.items(): marks[v].setdefault('ears', e)
# the neck's sides where its skin meets the background: NECK_DY under the chin (the views with a chin), at NECK_Y in the
# views from behind (the sheet's neck is longer than hers: only across counts)
NECK_DY, NECK_Y = 22, 262
for v, (a, b) in SPAN.items():
    y = int(marks[v]['chin'][1]) + NECK_DY if 'chin' in marks[v] else NECK_Y
    row = skin[y, a:b]
    xs = np.flatnonzero(row)
    if not len(xs): continue
    out = []
    for x, s in ((xs.min() + a, -1), (xs.max() + a, 1)):
        # (a side counts where the background, not the hair, is next to it)
        nxt = x + s * 2
        if not fig[y, nxt]: out.append([float(x + (1 if s > 0 else 0)), float(y + 0.5)])
    marks[v]['neck'] = out

# ---- the creases: the dark grooves inside the hair (darker than their 7x7 box's mean by over CREASE_D), 2 px in --------
CREASE_D = 6
valley = box(lum, 3) - lum
inner = hair.copy()
for k in (1, 2): inner &= np.roll(hair, k, 0) & np.roll(hair, -k, 0) & np.roll(hair, k, 1) & np.roll(hair, -k, 1)
cr = inner & (valley > CREASE_D)
creases = [[int(x), int(y), round(float(valley[y, x]), 1)] for y, x in zip(*np.nonzero(cr))]


def runs(m):
    out = []
    for row in m:
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        out.append([int(x) for pr in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)) for x in pr])
    return out


json.dump({'w': W, 'h': H, 'fig': runs(fig), 'hair': runs(hair), 'skin': runs(skin), 'marks': marks, 'creases': creases},
          open(os.path.join(D, 'hairs/braid-sheet.json'), 'w'), separators=(',', ':'))
json.dump({'w': W, 'h': H, 'runs': runs(hair), 'skin': runs(skin)}, open(os.path.join(D, 'hairs/braid-mask.json'), 'w'), separators=(',', ':'))
out = np.zeros(hair.shape, np.uint8); out[skin] = 110; out[hair] = 255
Image.fromarray(out).save(os.path.join(D, 'hairs/braid-mask.png'))
print(json.dumps(marks))
print('hair pixels per view', {v: int(hair[:, a:b].sum()) for v, (a, b) in SPAN.items()})

# --show <png>: each view at 2x: the hair's outline (green), the skin's (blue), the creases (red), the landmarks (yellow)
if '--show' in sys.argv:
    from PIL import ImageDraw
    o = im.copy(); o[cr] = o[cr] * 0.3 + np.array([255, 40, 40]) * 0.7
    e = hair ^ (np.roll(hair, 1, 0) & np.roll(hair, -1, 0) & np.roll(hair, 1, 1) & np.roll(hair, -1, 1)); o[e] = [60, 255, 60]
    e2 = skin ^ (np.roll(skin, 1, 0) & np.roll(skin, -1, 0) & np.roll(skin, 1, 1) & np.roll(skin, -1, 1)); o[e2 & ~e] = [80, 160, 255]
    K, cw, ch = 2, 300, 390
    big = Image.new('RGB', (5 * cw * K + 60, ch * K + 40), (47, 41, 43)); dr = ImageDraw.Draw(big)
    for i, (v, (a, b)) in enumerate(SPAN.items()):
        cx = (a + b) // 2; x0 = max(0, min(W - cw, cx - cw // 2))
        X = 10 + i * (cw * K + 10)
        big.paste(Image.fromarray(o[:ch, x0:x0 + cw].astype(np.uint8)).resize((cw * K, ch * K), Image.NEAREST), (X, 30))
        for k, ps in marks[v].items():
            if not ps: continue
            for p in (ps if isinstance(ps, list) and isinstance(ps[0], (list, dict)) else [ps]):
                for q in ([p['a'], p['b'], p['mid']] if isinstance(p, dict) else [p]):
                    qx, qy = X + (q[0] - x0) * K, 30 + q[1] * K
                    dr.ellipse([qx - 5, qy - 5, qx + 5, qy + 5], outline=(255, 225, 70), width=2)
        dr.text((X + 6, 8), f'{v}: hair {int(hair[:, a:b].sum())} px', fill=(255, 240, 220))
    big.save(sys.argv[sys.argv.index('--show') + 1])
