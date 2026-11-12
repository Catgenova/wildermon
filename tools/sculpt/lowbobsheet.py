# The bob's sheet read off (tools/sculpt/ref/hair-bob.png, its top 430 rows, five views): per view the figure, its skin
# and its hair, and the face's landmarks. Writes tools/sculpt/hairs/bob-sheet.json: { w, h, fig, hair, skin: runs per
# row ([x0, x1) pairs), marks: { view: {...} }, spans } and the hair as bob-mask.json / bob-mask.png (white the hair,
# grey the skin) for tools/sculpt/lowbob.mjs.
#
#  fig    the background is one flat colour (BG), bluer than green: a pixel is the figure where it is over BG_D off it, or
#         warm (its blue under its green plus WARM: the hair's darkest shade inside the curtain is as dark as the
#         background).
#  seeds  sure skin: green over red (3x3 mean) over SKIN_GR and the skin's hue ((G - B) / R) over SKIN_H; sure hair: green
#         over red under HAIR_GR (the hair's 0.52-0.55 however lit, the skin's 0.57-0.69), or the lilac rim light (blue
#         over green, far from the background, above LILAC_Y), or darker than DARK under DARK_Y (the curtain's shaded
#         inside beside the jaw: the neck's shade is lighter; above, the brows and the lashes); sure background.
#  split  the rest (the neck's and the jaw's shade, the hair's lit specks) to the seed it reaches across the smallest
#         colour step (a watershed on the colour gradient: the hair's edge over the shaded neck is a step, the shade
#         itself smooth).
#  clean  per view the hair is its largest piece and pieces of 150 px or more; a hole in it under HOLE px is hair (a lit
#         speck); a piece of hair inside the face (the brows, the eyes, the nose's shade) is skin.
#  marks  the pupils: the grey squares; the brows: the dark bars over them (two ends, middle); the profile's nose tip
#         (front-most skin in the nose's rows) and chin (the face's lowest front corner); the front's and three-quarter's
#         nose (the darkest skin between the pupils in the nose's rows); the front's and three-quarter's chin (the
#         lit jaw's lowest edge over the neck's shade down the face's middle); the neck's sides NECK_DY under the chin
#         (at NECK_Y in the views from behind).
#
#   python tools/sculpt/lowbobsheet.py [--show <png>]
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

D = os.path.dirname(os.path.abspath(__file__))
H = 430
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-bob.png')).convert('RGB')).astype(float)[:H]
W = im.shape[1]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
lum = 0.3 * R + 0.59 * G + 0.11 * B
SPAN = {'front': (30, 305), 'q3': (305, 590), 'profile': (590, 876), 'r3': (876, 1155), 'back': (1155, 1430)}
BG = np.array([54, 32, 41])
BG_D, SKIN_H, SKIN_GR, HAIR_GR, LILAC_Y, HOLE, SLIVER, TOP, WARM, DARK, DARK_Y = 20, 0.105, 0.595, 0.556, 315, 400, 600, 95, 1, 45, 255


def box(a, r):
    return ndi.uniform_filter(a, 2 * r + 1, mode='nearest')


def view_of(x):
    return next((v for v, (a, b) in SPAN.items() if a <= x < b), None)


# ---- the figure ---------------------------------------------------------------------------------------------------
dist = np.sqrt(((im - BG) ** 2).sum(-1))
fig = (box(dist, 1) > BG_D) | (box(B - G, 1) < WARM)
fig[:TOP] = False
fig[:, :SPAN['front'][0]] = False; fig[:, SPAN['back'][1]:] = False
lab, n = ndi.label(fig)
sizes = ndi.sum(fig, lab, range(n + 1))
fig = np.isin(lab, np.flatnonzero(sizes > 2000))
fig = ndi.binary_fill_holes(fig)

# ---- seeds and the split -----------------------------------------------------------------------------------------
hue = box((G - B) / np.maximum(R, 1), 1)
gr = box(G / np.maximum(R, 1), 1)
lilac = (B > G + 4) & (dist > 60)
lilac[LILAC_Y:] = False
sure_skin = fig & (hue > SKIN_H) & (gr > SKIN_GR)
dark = box(lum, 1) < DARK
dark[:DARK_Y] = False
sure_hair = fig & (((gr < HAIR_GR) & (dist > 30)) | lilac | dark)
# (the rim-lit bust's pale edges: skin, low on the sheet)
sure_hair[340:] = False
sure_skin[350:] |= fig[350:]
# (the skin's seeds kept to its big pieces; small lit specks inside the hair are left to the split)
lab, n = ndi.label(sure_skin)
sizes = ndi.sum(sure_skin, lab, range(n + 1))
sure_skin = np.isin(lab, np.flatnonzero(sizes > 300))
lab, n = ndi.label(sure_hair)
sizes = ndi.sum(sure_hair, lab, range(n + 1))
sure_hair = np.isin(lab, np.flatnonzero(sizes > 60)) & ~sure_skin
grad = np.zeros(lum.shape)
for c in (R, G, B):
    sm = box(c, 1)
    grad += ndi.sobel(sm, 0) ** 2 + ndi.sobel(sm, 1) ** 2
grad = np.sqrt(grad)
g8 = np.clip(grad / np.percentile(grad[fig], 99) * 255, 0, 255).astype(np.uint8)
markers = np.zeros(lum.shape, np.int16)
markers[~fig] = 1
markers[sure_skin] = 2
markers[sure_hair] = 3
ws = ndi.watershed_ift(g8, markers)
skin = (ws == 2) & fig
hair = (ws == 3) & fig

# ---- clean ----------------------------------------------------------------------------------------------------------
out_h = np.zeros(hair.shape, bool)
for v, (a, b) in SPAN.items():
    m = np.zeros(hair.shape, bool); m[:, a:b] = hair[:, a:b]
    lab, n = ndi.label(m)
    if not n: continue
    sizes = ndi.sum(m, lab, range(n + 1)); sizes[0] = 0
    big = int(np.argmax(sizes))
    keep = lab == big
    out_h |= keep
    # holes in the hair (lit specks), not the face
    f = ndi.binary_fill_holes(keep) & ~keep
    lab2, n2 = ndi.label(f)
    s2 = ndi.sum(f, lab2, range(n2 + 1))
    out_h |= np.isin(lab2, np.flatnonzero((s2 > 0) & (s2 < HOLE)))
hair = out_h
skin = fig & ~hair
# (a small piece of skin apart from the face and the neck, between two locks' tips, is the hair's shaded inside)
lab, n = ndi.label(skin)
sizes = ndi.sum(skin, lab, range(n + 1))
for l in np.flatnonzero((sizes > 0) & (sizes < SLIVER)):
    hair |= lab == l
skin = fig & ~hair

# ---- the landmarks ----------------------------------------------------------------------------------------------------
marks = {v: {} for v in SPAN}
grey = fig & (lum > 55) & (lum < 120) & (np.abs(R - G) < 20) & (np.abs(G - B) < 14)
grey[:212] = False; grey[240:] = False
lab, n = ndi.label(grey)
for l in range(1, n + 1):
    ys, xs = np.nonzero(lab == l)
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    v = view_of(xs.mean())
    if v and 3 <= w <= 14 and 3 <= h <= 14 and len(ys) >= 9:
        marks[v].setdefault('pupils', []).append([round(float(xs.mean() + 0.5), 2), round(float(ys.mean() + 0.5), 2)])
brow = fig & (lum < 110) & (R - G > 25) & ~hair & (hue > 0.05)
brow[:192] = False; brow[218:] = False
lab, n = ndi.label(brow)
for l in range(1, n + 1):
    ys, xs = np.nonzero(lab == l)
    v = view_of(xs.mean())
    if v and xs.max() - xs.min() > 12 and ys.max() - ys.min() < 12 and len(ys) > 25:
        def end(x):
            r = ys[xs == x]; return [float(x + 0.5), float((r.min() + r.max()) / 2 + 0.5)]
        marks[v].setdefault('brows', []).append({'a': end(xs.min()), 'b': end(xs.max()), 'mid': [round(float(xs.mean() + 0.5), 2), round(float(ys.mean() + 0.5), 2)]})
for v in marks:
    for k in ('pupils', 'brows'):
        if k in marks[v]: marks[v][k].sort(key=lambda p: (p['mid'] if isinstance(p, dict) else p)[0])

if '--debug' in sys.argv:
    print(json.dumps(marks))
json.dump({'w': W, 'h': H}, open(os.devnull, 'w'))


def runs(m):
    out = []
    for row in m:
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        out.append([int(x) for pr in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)) for x in pr])
    return out


# (the profile faces the viewer's left: its nose the left-most skin in the nose's rows, its chin the jaw's corner)
a, b = SPAN['profile']
front = np.array([(np.flatnonzero(skin[y, a:b]).min() + a if skin[y, a:b].any() else 10 ** 4) for y in range(H)])
NOSE = (238, 270)
yn = NOSE[0] + int(np.argmin(front[NOSE[0]:NOSE[1]]))
marks['profile']['nose'] = [float(front[yn]), float(yn + 0.5)]
lab, n = ndi.label(skin)
face = lab == lab[yn, int(front[yn]) + 2]
ys, xs = np.nonzero(face)
low = ys >= ys.max() - 1
marks['profile']['chin'] = [float(xs[low].min()), float(ys.max() + 1)]
L3 = box(lum, 1)
for v in ('front', 'q3'):
    p = marks[v].get('pupils', [])
    if len(p) < 2: continue
    x0, x1 = int(p[0][0]), int(p[1][0])
    sub = np.where(skin[245:268, x0:x1], L3[245:268, x0:x1], 999)
    yy, xx = np.unravel_index(np.argmin(sub), sub.shape)
    marks[v]['nose'] = [float(x0 + xx + 0.5), float(245 + yy + 0.5)]
    rows = []
    for cx in range(x0, x1 + 1):
        col = L3[280:330, cx]
        rows.append(280 + int(np.argmax(col[:-3] - col[3:])) + 2)
    rows = np.array(rows); lo = rows.max(); xs = np.flatnonzero(rows >= lo - 1) + x0
    marks[v]['chin'] = [float(xs.mean() + 0.5), float(lo)]
NECK_DY, NECK_Y = 28, 330
for v, (a, b) in SPAN.items():
    y = int(marks[v]['chin'][1]) + NECK_DY if 'chin' in marks[v] else NECK_Y
    xs = np.flatnonzero(skin[y, a:b])
    if not len(xs): continue
    out = []
    for x, s in ((xs.min() + a, -1), (xs.max() + a, 1)):
        if not fig[y, x + s * 2]: out.append([float(x + (1 if s > 0 else 0)), float(y + 0.5)])
    marks[v]['neck'] = out

json.dump({'w': W, 'h': H, 'span': SPAN, 'fig': runs(fig), 'hair': runs(hair), 'skin': runs(skin), 'marks': marks},
          open(os.path.join(D, 'hairs/bob-sheet.json'), 'w'), separators=(',', ':'))
json.dump({'w': W, 'h': H, 'runs': runs(hair), 'skin': runs(skin)}, open(os.path.join(D, 'hairs/bob-mask.json'), 'w'), separators=(',', ':'))
o = np.zeros(hair.shape, np.uint8); o[skin] = 110; o[hair] = 255
Image.fromarray(o).save(os.path.join(D, 'hairs/bob-mask.png'))
print(json.dumps(marks))
print('hair pixels per view', {v: int(hair[:, a:b].sum()) for v, (a, b) in SPAN.items()})

if '--show' in sys.argv:
    from PIL import ImageDraw
    o = im.copy()
    e = hair ^ ndi.binary_erosion(hair); o[e] = [60, 255, 60]
    e2 = skin ^ ndi.binary_erosion(skin); o[e2 & ~e] = [80, 160, 255]
    K = 2
    big = Image.fromarray(o.astype(np.uint8)).resize((W * K, H * K), Image.NEAREST); dr = ImageDraw.Draw(big)
    for v in marks:
        for k, ps in marks[v].items():
            for p in (ps if isinstance(ps, list) and ps and isinstance(ps[0], (list, dict)) else [ps]):
                for q in ([p['a'], p['b'], p['mid']] if isinstance(p, dict) else [p]):
                    dr.ellipse([q[0] * K - 4, q[1] * K - 4, q[0] * K + 4, q[1] * K + 4], outline=(255, 225, 70), width=2)
    big.save(sys.argv[sys.argv.index('--show') + 1])
