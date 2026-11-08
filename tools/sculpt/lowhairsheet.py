# The swept-back hair's sheet read off (tools/sculpt/ref/hair-swept-undercut.png, its top 430 rows, five views): per
# view the figure (anything not the plain background), the hair's exact silhouette, and the face's landmarks found by
# their colour components. Writes tools/sculpt/hairs/swept-sheet.json: { w, h, fig: runs per row, hair: runs per row,
# marks: { view: { name: [x, y] } } } (runs: [x0, x1) pairs), and the hair's silhouette as swept-mask.json / .png for
# tools/sculpt/lowhairhull.mjs.
#
#  fig    the background is one flat colour (its corner's); a pixel is the figure where it is over BG_D off it.
#  hair   the hair's lower edge per column: within EDGE_BAND px of the hand-traced edge (tools/sculpt/hairs/
#         swept-trace.json), the row that parts the hair's colours above from the skin's below best (each pixel the
#         nearer of two colour sets, k-means of sure hair and sure skin in that view); smoothed over 3 columns. The hair
#         is each column of the figure from its top down to that row.
#  marks  pupils: the dark square components (8-18 px a side); brows: the dark bars (over 25 px long, under 16 tall)
#         at the brows' rows, their two ends (the middle of the end column's run) and middle; the profile's nose tip
#         (the figure's furthest pixel forward in the nose's rows) and chin (its furthest forward under the mouth); the
#         ears' middles across, by hand (EARS).
#
#   python3 tools/sculpt/lowhairsheet.py
import json, os
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-swept-undercut.png')).convert('RGB')).astype(float)[:430]
H, W = im.shape[:2]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
lum = 0.3 * R + 0.59 * G + 0.11 * B
SPAN = {'front': (40, 370), 'q3': (345, 660), 'profile': (650, 960), 'r3': (960, 1260), 'back': (1260, 1530)}
BG_D, EDGE_BAND = 22, 9

bg = im[5:15, 5:15].reshape(-1, 3).mean(0)
fig = np.sqrt(((im - bg) ** 2).sum(-1)) > BG_D


def label(m):
    """4-connected components of a mask: a list of (ys, xs)."""
    h, w = m.shape; seen = np.zeros_like(m, bool); out = []
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]: continue
        st = [(y0, x0)]; seen[y0, x0] = True; py = []; px = []
        while st:
            y, x = st.pop(); py.append(y); px.append(x)
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
        out.append((np.array(py), np.array(px)))
    return out


def kmeans(X, k, it=20, seed=1):
    rng = np.random.default_rng(seed); C = X[rng.choice(len(X), k, replace=False)]
    for _ in range(it):
        a = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([X[a == j].mean(0) if (a == j).any() else C[j] for j in range(k)])
    return C


# ---- the hair: its lower edge per column, refined off the traced one --------------------------------------------------
trace = json.load(open(os.path.join(D, 'hairs/swept-trace.json')))
hair = np.zeros((H, W), bool)
edge = {}
for view, line in trace['hairline'].items():
    xs = np.array([p[0] for p in line], float); ys = np.array([p[1] for p in line], float)
    cols = np.arange(int(xs[0]), int(xs[-1]) + 1); ty = np.interp(cols, xs, ys)
    # sure hair: 6+ px above the traced edge; sure skin: 6 to 30 px under it (the brows lower still)
    hs, ss = [], []
    for x, y in zip(cols, ty):
        top = np.flatnonzero(fig[:, x]); top = top[0] if len(top) else int(y)
        hs += [im[yy, x] for yy in range(top + 2, int(y) - 6)]
        ss += [im[yy, x] for yy in range(int(y) + 6, min(H, int(y) + 30)) if fig[yy, x]]
    Ch, Cs = kmeans(np.array(hs), 8), kmeans(np.array(ss), 8)
    def is_hair(p): return ((p[:, None] - Ch[None]) ** 2).sum(-1).min(1) < ((p[:, None] - Cs[None]) ** 2).sum(-1).min(1)
    best = []
    for x, y in zip(cols, ty):
        y0, y1 = max(0, int(y) - EDGE_BAND), min(H, int(y) + EDGE_BAND + 1)
        hcol = is_hair(im[y0:y1, x])
        # the row r: hair over it, skin from it: cost the skin-coloured above plus the hair-coloured from r down
        cost = [(~hcol[:r]).sum() + hcol[r:].sum() for r in range(len(hcol) + 1)]
        best.append(y0 + int(np.argmin(cost)))
    best = np.array(best, float)
    sm = best.copy(); sm[1:-1] = np.median(np.stack([best[:-2], best[1:-1], best[2:]]), 0)
    edge[view] = [[int(x), float(y)] for x, y in zip(cols, sm)]
    for x, y in zip(cols, sm):
        top = np.flatnonzero(fig[:int(round(y)), x])
        if len(top): hair[top[0]:int(round(y)), x] = True

# ---- the landmarks ------------------------------------------------------------------------------------------------------
marks = {v: {} for v in SPAN}
dark = (lum < 70) & (R < 90); dark[:150] = False; dark[200:] = False
for ys, xs in label(dark):
    w, h = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    v = next((k for k, (a, b) in SPAN.items() if a <= xs.mean() < b), None)
    if v is None: continue
    if 5 <= w <= 18 and 8 <= h <= 18 and len(ys) > 40:
        marks[v].setdefault('pupils', []).append([float(xs.mean() + 0.5), float(ys.mean() + 0.5)])
    elif w > 25 and h < 16 and 155 < ys.mean() < 185:
        def end(x):
            r = ys[xs == x]; return [float(x + 0.5), float((r.min() + r.max()) / 2 + 0.5)]
        marks[v].setdefault('brows', []).append({'a': end(xs.min()), 'b': end(xs.max()), 'mid': [float(xs.mean() + 0.5), float(ys.mean() + 0.5)]})
for v in marks:
    for k in ('pupils', 'brows'):
        if k in marks[v]: marks[v][k].sort(key=lambda p: (p['mid'] if isinstance(p, dict) else p)[0])
# the profile's nose tip and chin: the figure's furthest pixel to the right in their rows
a, b = SPAN['profile']
def front_most(y0, y1):
    best = None
    for y in range(y0, y1):
        xs = np.flatnonzero(fig[y, a:b])
        if len(xs) and (best is None or xs.max() + a > best[0]): best = [float(xs.max() + a + 0.5), float(y + 0.5)]
    return best
marks['profile']['nose'] = front_most(200, 245)
marks['profile']['chin'] = front_most(270, 300)
# the ears' middles across (read off the sheet by hand: the ear's outer and inner edges at its middle row; the ears'
# colours run into the lit cheek's, so no component finds them): their height is the sheet's own (his sit lower)
EARS = {'front': [[115.5, 205], [297, 205]], 'q3': [[431, 206]], 'profile': [[785, 205]], 'r3': [[1038.5, 208]], 'back': [[1290.5, 207], [1465, 207]]}
for v, e in EARS.items(): marks[v]['ears'] = e


def runs(m):
    out = []
    for row in m:
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        out.append([int(x) for pr in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)) for x in pr])
    return out


json.dump({'w': W, 'h': H, 'fig': runs(fig), 'hair': runs(hair), 'edge': edge, 'marks': marks}, open(os.path.join(D, 'hairs/swept-sheet.json'), 'w'), separators=(',', ':'))
json.dump({'w': W, 'h': H, 'runs': runs(hair)}, open(os.path.join(D, 'hairs/swept-mask.json'), 'w'), separators=(',', ':'))
Image.fromarray((hair * 255).astype(np.uint8)).save(os.path.join(D, 'hairs/swept-mask.png'))
print(json.dumps(marks))
print('hair pixels per view', {v: int(hair[:, a:b].sum()) for v, (a, b) in SPAN.items()})
