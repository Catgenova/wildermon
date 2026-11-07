# The low-poly torso against its reference, view by view (tools/sculpt/TORSO_SPEC.md):
#
#   node tools/sculpt/lowids.mjs male /tmp/ids-male.bin --torso
#   python3 tools/sculpt/lowshape.py male <dir>/sheet-torso-male.png /tmp/ids-male.bin <dir>/
#
# writes <dir>/vs-ref-<who>.png: the reference's eight views above ours, the planes and topology panels likewise; and
# <dir>/shape-<who>.png, shape only: per view, first the reference with our facet edges drawn over it (cyan), then ours
# as flat, distinct per-facet colours with the reference's outline (white) and the reference's facet edges, found from
# its colour steps (yellow). No light in the second: where the planes fall is all it shows.
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowmask import TORSO_BOXES

VIEWS = ['front', 'q3', 'profile', 'r3', 'back', 'top', 'bottom', 'under']
# the panels past the views, per sheet: the planes front and back (her side silhouette) and the topology front and back
PANELS = {
    'male': [(705, 474, 945, 735), (965, 474, 1205, 735), (1018, 786, 1222, 1003), (1222, 786, 1412, 1003)],
    'female': [(690, 490, 880, 735), (950, 490, 1140, 735), (1050, 770, 1225, 1005), (1255, 770, 1425, 1005)],
}

def erode(m, n=1):
    for _ in range(n):
        e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]; m = e
    return m

def blur(a):
    b = a.copy(); b[1:-1] = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4; c = b.copy(); c[:, 1:-1] = (b[:, :-2] + 2 * b[:, 1:-1] + b[:, 2:]) / 4; return c

def strip(arrs, gap=4):
    h = max(a.shape[0] for a in arrs); w = sum(a.shape[1] for a in arrs) + gap * (len(arrs) - 1)
    o = np.full((h, w, 3), 255, np.uint8); x = 0
    for a in arrs:
        o[:a.shape[0], x:x + a.shape[1]] = a; x += a.shape[1] + gap
    return o

def stack(rows, gap=6):
    w = max(r.shape[1] for r in rows); h = sum(r.shape[0] for r in rows) + gap * (len(rows) - 1)
    o = np.full((h, w, 3), 255, np.uint8); y = 0
    for r in rows:
        o[y:y + r.shape[0], :r.shape[1]] = r; y += r.shape[0] + gap
    return o

def main(who, sheet, idsf, outdir, th=9.0):
    here = os.path.dirname(os.path.abspath(__file__))
    ref = np.asarray(Image.open(os.path.join(here, 'ref', 'torso-lowpoly-%s.png' % who)).convert('RGB').resize((1536, 1024)), dtype=float)
    ours = np.asarray(Image.open(sheet).convert('RGB').resize((1536, 1024)))
    boxes = TORSO_BOXES[who]
    # the comparison: the reference above ours
    crop = lambda im, b: im[b[1]:b[3], b[0]:b[2]].astype(np.uint8)
    rows = []
    for group in (VIEWS[:5], VIEWS[5:]):
        rows.append(strip([crop(ref, boxes[v]) for v in group])); rows.append(strip([crop(ours, boxes[v]) for v in group]))
    pan = PANELS[who]
    rows.append(strip([crop(ref, b) for b in pan])); rows.append(strip([crop(ours, b) for b in pan]))
    Image.fromarray(stack(rows)).save(os.path.join(outdir, 'vs-ref-%s.png' % who))

    # shape only
    ids = np.frombuffer(open(idsf, 'rb').read(), dtype=np.int32).reshape(len(VIEWS), 1024, 1536)
    names = json.load(open(idsf + '.names.json'))
    pal = np.random.RandomState(3).randint(70, 240, (len(names) + 2, 3)).astype(np.uint8)
    fg = np.abs(ref - ref[5, 700]).sum(2) > 40
    sm = blur(blur(ref))
    gx = np.zeros_like(sm); gy = np.zeros_like(sm); gx[:, 1:-1] = sm[:, 2:] - sm[:, :-2]; gy[1:-1] = sm[2:] - sm[:-2]
    refedge = (np.sqrt((gx ** 2 + gy ** 2).sum(2)) > th) & erode(fg, 3)
    refout = fg & ~erode(fg, 1)
    A, B = [], []
    for vi, v in enumerate(VIEWS):
        x0, y0, x1, y1 = boxes[v]
        I = ids[vi, y0:y1, x0:x1]
        E = np.zeros(I.shape, bool)
        E[1:, :] |= I[1:, :] != I[:-1, :]; E[:, 1:] |= I[:, 1:] != I[:, :-1]
        a = (ref[y0:y1, x0:x1] * 0.85).astype(np.uint8).copy(); a[E] = (0, 235, 255)
        b = np.where((I >= 0)[..., None], pal[np.maximum(I, 0)], np.array([40, 34, 38], np.uint8))
        b[refedge[y0:y1, x0:x1]] = (255, 230, 0); b[refout[y0:y1, x0:x1]] = (255, 255, 255)
        A.append(a); B.append(b)
    Image.fromarray(stack([strip(A[:5]), strip(B[:5]), strip(A[5:] + B[5:])])).save(os.path.join(outdir, 'shape-%s.png' % who))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], *(float(x) for x in sys.argv[5:6]))
