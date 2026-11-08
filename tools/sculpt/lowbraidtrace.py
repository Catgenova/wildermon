# The side braid's lines traced on its sheet (tools/sculpt/hairs/braid-traces.json: per line its rough points in each
# view that shows it, sheet pixels, in the order it runs) snapped onto the sheet's own creases: each run resampled
# every STEP px, each sample free to move up to REACH px square to the run, the moves chosen together (dynamic
# programming: the sample's cost the sheet's valley there, its luminance under its 7x7 box's mean, negated; a move
# against its neighbour's costing BEND per px) so the run lies in the groove. A run marked `step` lies on the step from
# a dark side above to a lit side below instead (`stepup`: lit above): a lock's shaded underside over the next one's lit
# top, where the sheet's light leaves the groove itself unshaded. A run marked `edge` keeps to the hair's
# outline (the hairline: the hair's lower edge, tools/sculpt/lowbraidsheet.py). Writes
# tools/sculpt/hairs/braid-traced.json { line: { view: [[x, y], ...] } } for tools/sculpt/lowbraidlift.mjs.
#
#   python3 tools/sculpt/lowbraidtrace.py [--show <png> [view ...]]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(D, 'hairs/braid-sheet.json')))
W, H = S['w'], S['h']
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-side-braid.png')).convert('RGB')).astype(float)[:H]
lum = 0.3 * im[..., 0] + 0.59 * im[..., 1] + 0.11 * im[..., 2]
STEP, REACH, BEND = 1.5, 5, 1.2


def box(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge'), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2


def grid(runs):
    A = np.zeros((H, W), bool)
    for y, r in enumerate(runs):
        for k in range(0, len(r), 2): A[y, r[k]:r[k + 1]] = True
    return A


hair = grid(S['hair'])
valley = box(lum, 3) - lum
Ls = box(lum, 1)
# the hair's outline: a hair pixel with a non-hair neighbour
edge = hair & ~(np.roll(hair, 1, 0) & np.roll(hair, -1, 0) & np.roll(hair, 1, 1) & np.roll(hair, -1, 1))
dist_edge = np.full((H, W), 99.0)
ys, xs = np.nonzero(edge)


def sample(a, x, y):
    x0, y0 = int(np.floor(x)), int(np.floor(y)); fx, fy = x - x0, y - y0
    x0 = min(max(x0, 0), W - 2); y0 = min(max(y0, 0), H - 2)
    return a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy


def resample(pts, step):
    P = np.array(pts, float)
    L = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    n = max(2, int(L[-1] / step) + 1)
    t = np.linspace(0, L[-1], n)
    return np.stack([np.interp(t, L, P[:, 0]), np.interp(t, L, P[:, 1])], 1)


def snap(pts, mode):
    P = resample(pts, STEP)
    T = np.gradient(P, axis=0); T /= np.maximum(1e-9, np.hypot(*T.T))[:, None]
    N = np.stack([-T[:, 1], T[:, 0]], 1)
    offs = np.arange(-REACH, REACH + 0.01, 0.5)
    cost = np.zeros((len(P), len(offs)))
    for i, (p, n) in enumerate(zip(P, N)):
        for j, o in enumerate(offs):
            x, y = p + n * o
            if mode == 'edge':
                # (on the outline: the hair inside, not outside; a hair pixel next to a non-hair one)
                cost[i, j] = 0 if sample(edge.astype(float), x, y) > 0.3 else 3
            elif mode in ('step', 'stepup'):
                # (a step: the run's one side dark, its other lit, as where a lock's shaded underside meets the lit top
                # of the lock under it; `step` lit below, `stepup` lit above)
                s = 1 if (n[1] > 0) == (mode == 'step') else -1
                cost[i, j] = -s * (sample(Ls, x + 2 * n[0], y + 2 * n[1]) - sample(Ls, x - 2 * n[0], y - 2 * n[1])) / 3 + 0.05 * abs(o)
            else:
                cost[i, j] = -sample(valley, x, y) + 0.05 * abs(o)
    acc = cost[0].copy(); back = []
    for i in range(1, len(P)):
        tot = acc[None, :] + BEND * np.abs(offs[:, None] - offs[None, :])
        back.append(tot.argmin(1)); acc = cost[i] + tot.min(1)
    j = int(acc.argmin()); path = [j]
    for b in reversed(back): j = int(b[j]); path.append(j)
    path = path[::-1]
    return [[round(float(p[0] + n[0] * offs[j]), 2), round(float(p[1] + n[1] * offs[j]), 2)] for p, n, j in zip(P, N, path)]


T = json.load(open(os.path.join(D, 'hairs/braid-traces.json')))
out = {}
for ln in T['lines']:
    out[ln['id']] = {}
    for v, pts, *mode in ln['src']:
        out[ln['id']].setdefault(v, []).append(snap(pts, mode[0] if mode else 'crease'))
json.dump(out, open(os.path.join(D, 'hairs/braid-traced.json'), 'w'), separators=(',', ':'))
print('lines', len(out), 'runs', sum(len(r) for l in out.values() for r in l.values()))

# --show <png> [views]: each view's crown at 3x, the creases (red), the rough runs (thin white) and the snapped ones
# (each line its colour, named)
if '--show' in sys.argv:
    i = sys.argv.index('--show'); views = sys.argv[i + 2:] or ['front', 'q3', 'profile', 'r3', 'back']
    BOX = {'front': (60, 5, 320, 300), 'q3': (380, 5, 640, 300), 'profile': (670, 5, 930, 300), 'r3': (970, 5, 1240, 300), 'back': (1255, 5, 1515, 300)}
    K = 3
    o = im.copy()
    for x, y, d in S['creases']: o[y, x] = o[y, x] * 0.5 + np.array([255, 40, 40]) * 0.5
    pal = [(255, 230, 60), (60, 230, 255), (120, 255, 120), (255, 140, 255), (255, 170, 80), (160, 160, 255), (255, 255, 255), (80, 255, 200), (255, 100, 100), (200, 255, 80), (100, 200, 255), (255, 200, 200)]
    tiles = []
    for v in views:
        x0, y0, x1, y1 = BOX[v]
        t = Image.fromarray(o[y0:y1, x0:x1].astype(np.uint8)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS)
        d = ImageDraw.Draw(t)
        for k, ln in enumerate(T['lines']):
            c = pal[k % len(pal)]
            for vv, pts, *m in ln['src']:
                if vv != v: continue
                d.line([((x - x0) * K, (y - y0) * K) for x, y in pts], fill=(255, 255, 255), width=1)
            for run in out[ln['id']].get(v, []):
                d.line([((x - x0) * K, (y - y0) * K) for x, y in run], fill=c, width=3)
                x, y = run[len(run) // 2]
                d.text(((x - x0) * K + 4, (y - y0) * K - 12), ln['id'], fill=c)
        d.text((6, 4), v, fill=(255, 255, 255))
        tiles.append(t)
    big = Image.new('RGB', (sum(t.width for t in tiles) + 10 * len(tiles), max(t.height for t in tiles)), (30, 26, 28))
    x = 0
    for t in tiles: big.paste(t, (x, 0)); x += t.width + 10
    big.save(sys.argv[i + 1])
