# The side braid's silhouettes in each of its reference sheet's five views (tools/sculpt/ref/hair-side-braid.png): the
# sheet's figure (anything not its plain background) less its skin (the face, the ears, the neck and the bust: the
# skin's orange, R:G:B about 1:0.69:0.52, in blobs of 300 pixels or more, their holes (eyes, brows, the nose's shadow)
# filled), corrected by hand where the skin's shadow reads as hair or a lit lock as skin
# (tools/sculpt/hairs/braid-trace.json: polygons, sheet pixels, each `skin` or `hair`). Writes
# tools/sculpt/hairs/braid-mask.png (the sheet's top 410 rows: white the hair, grey the skin) and the same as runs per
# row (runs the hair, skin the skin), tools/sculpt/hairs/braid-mask.json, for tools/sculpt/lowbraid.mjs; and the creases' pixels (the dark grooves
# between the locks and between the braid's lobes), tools/sculpt/hairs/braid-creases.json.
#
#   python3 tools/sculpt/lowbraidmask.py
import json, os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__))
H = 410
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-side-braid.png')).convert('RGB')).astype(float)[:H]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
dist = np.sqrt((R - 58) ** 2 + (G - 42) ** 2 + (B - 47) ** 2)


def components(m):
    """Each 4-connected component of a mask as a list of flat indices."""
    h, w = m.shape
    seen = np.zeros(m.shape, bool)
    out = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]: continue
        seen[y0, x0] = True
        q, comp = deque([(y0, x0)]), []
        while q:
            y, x = q.popleft(); comp.append(y * w + x)
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; q.append((yy, xx))
        out.append(comp)
    return out


def box(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge'), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2


# the background: the sheet's plain colour reached from its edge through wide stretches of it (a 7 px box of it), so the
# creases between the locks, as dark as the background but narrow, stay the figure's; then 4 px on into the plain colour
plain = dist < 22
wide = plain & (box(dist, 3) < 14)
bg = np.zeros(plain.shape, bool)
for c in components(wide):
    ys, xs = np.divmod(np.array(c), plain.shape[1])
    if ys.min() == 0 or xs.min() == 0 or xs.max() == plain.shape[1] - 1 or len(c) > 20000: bg.flat[c] = True
for _ in range(4):
    g = bg.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): g |= np.roll(bg, (dy, dx), (0, 1))
    bg = g & plain
fig = ~bg
skin0 = fig & (G / np.maximum(R, 1) > 0.635) & (B / np.maximum(R, 1) < 0.62)
skin = np.zeros(fig.shape, bool)
for c in components(skin0):
    if len(c) >= 300: skin.flat[c] = True
# the skin's holes: anything not skin wholly inside it (not touching the background) and under 400 pixels
for c in components(~skin):
    if len(c) >= 400: continue
    ys, xs = np.divmod(np.array(c), skin.shape[1])
    ring = np.zeros(skin.shape, bool)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ring[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, skin.shape[1] - 1)] = True
    ring.flat[c] = False
    if skin[ring].all(): skin.flat[c] = True

trace = json.load(open(os.path.join(D, 'hairs/braid-trace.json')))
for kind in ('hair', 'skin'):
    pim = Image.new('L', (skin.shape[1], H), 0)
    dr = ImageDraw.Draw(pim)
    for view, polys in trace[kind].items():
        for p in polys: dr.polygon([tuple(q) for q in p], fill=255)
    pm = np.asarray(pim) > 0
    if kind == 'skin': skin |= pm & fig
    else: skin &= ~pm
hair = fig & ~skin
# (the views' labels and the rule under them are not the figure)
hair[int(trace.get('floor', 392)):] = False

out = np.zeros(hair.shape, np.uint8); out[skin] = 110; out[hair] = 255
Image.fromarray(out).save(os.path.join(D, 'hairs/braid-mask.png'))
def runsOf(m):
    out = []
    for row in m:
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        out.append([int(v) for pair in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)) for v in pair])
    return out
json.dump({'w': int(hair.shape[1]), 'h': H, 'runs': runsOf(hair), 'skin': runsOf(skin & ~hair)}, open(os.path.join(D, 'hairs/braid-mask.json'), 'w'), separators=(',', ':'))
SPAN = {'front': (40, 345), 'q3': (345, 650), 'profile': (650, 955), 'r3': (955, 1245), 'back': (1245, 1536)}
print('hair pixels per view', {v: int(hair[:, a:b].sum()) for v, (a, b) in SPAN.items()})

# the creases: pixels darker than their 9 px neighbourhood by 14 and dark outright, 2 px in from the hair's edge
lum = 0.3 * R + 0.59 * G + 0.11 * B
inner = hair.copy()
for k in (1, 2):
    inner &= np.roll(hair, k, 0) & np.roll(hair, -k, 0) & np.roll(hair, k, 1) & np.roll(hair, -k, 1)
crease = inner & (lum < box(lum, 4) - 12) & (lum < 100)
ys, xs = np.nonzero(crease)
json.dump({'pts': [[int(x), int(y)] for x, y in zip(xs, ys)]}, open(os.path.join(D, 'hairs/braid-creases.json'), 'w'), separators=(',', ':'))
print('crease pixels', len(xs))
