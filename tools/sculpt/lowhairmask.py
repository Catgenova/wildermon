# The hair's silhouette in each of the reference sheet's five views (tools/sculpt/ref/hair-swept-undercut.png): the
# sheet's figure (anything not its plain background: warm, or bright as the rim light) above the hair's lower edge
# traced by hand (tools/sculpt/hairs/swept-trace.json): each column from the figure's top down to that edge. Writes
# tools/sculpt/hairs/swept-mask.png (the sheet's top 430 rows, white the hair) and the same as runs per row,
# tools/sculpt/hairs/swept-mask.json, for tools/sculpt/lowhairhull.mjs; and the creases' pixels,
# tools/sculpt/hairs/swept-creases.json.
#
#   python3 tools/sculpt/lowhairmask.py
import json, os
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
im = np.asarray(Image.open(os.path.join(D, 'ref/hair-swept-undercut.png')).convert('RGB')).astype(float)[:430]
R, G, B = im[..., 0], im[..., 1], im[..., 2]
fig = ((R - B) > 20) | (R + G + B > 260)
trace = json.load(open(os.path.join(D, 'hairs/swept-trace.json')))
mask = np.zeros(fig.shape, bool)
H = fig.shape[0]
for view, line in trace['hairline'].items():
    xs = np.array([p[0] for p in line], float); ys = np.array([p[1] for p in line], float)
    for x in range(int(xs[0]), int(xs[-1]) + 1):
        y = np.interp(x, xs, ys)
        # the column from the figure's top down to the edge (the creases' dark pixels, near the background's colour, kept)
        top = np.flatnonzero(fig[:int(y), x])
        if len(top): mask[top[0]:int(y), x] = True

Image.fromarray((mask * 255).astype(np.uint8)).save(os.path.join(D, 'hairs/swept-mask.png'))
# the same as runs per row ([x0, x1) pairs), for the hull's carving in node
runs = []
for row in mask:
    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
    runs.append([int(v) for pair in zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)) for v in pair])
json.dump({'w': int(mask.shape[1]), 'h': int(mask.shape[0]), 'runs': runs}, open(os.path.join(D, 'hairs/swept-mask.json'), 'w'), separators=(',', ':'))
print('hair pixels per view', {v: int(mask[:, int(l[0][0]):int(l[-1][0]) + 1].sum()) for v, l in trace['hairline'].items()})

# the creases: the dark grooves between the locks and under each lock's edge, inside the silhouette (3 px in from its
# edge): pixels darker than their 9 px neighbourhood by 14 and dark outright, for tools/sculpt/lowhairtrace.mjs
lum = 0.3 * R + 0.59 * G + 0.11 * B
def box(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode='edge'), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2
inner = mask.copy()
for k in (1, 2, 3):
    inner &= np.roll(mask, k, 0) & np.roll(mask, -k, 0) & np.roll(mask, k, 1) & np.roll(mask, -k, 1)
crease = inner & (lum < box(lum, 4) - 14) & (lum < 95)
ys, xs = np.nonzero(crease)
json.dump({'pts': [[int(x), int(y)] for x, y in zip(xs, ys)]}, open(os.path.join(D, 'hairs/swept-creases.json'), 'w'), separators=(',', ':'))
print('crease pixels', len(xs))
