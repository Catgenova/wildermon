# The low-poly legs against their references, view by view (tools/sculpt/LEGS_SPEC.md):
#
#   node tools/sculpt/lowlshot.mjs --who male --out <dir> --ref /tmp/lref-male.json
#   python3 tools/sculpt/lowlcomp.py male <dir> /tmp/lref-male.json
#
# writes <dir>/vs-ref-legs-<who>.png: the reference's views above ours (the sheet's top row, its topology panel, its leg
# planes panel, and the full-body reference's legs beside ours); and <dir>/shape-legs-<who>.png, shape only: per view, the
# reference with our facet edges over it (cyan), then ours in flat, distinct per-facet colours with the reference's
# outline (white) and its facet edges, found from its colour steps (yellow). No light in the second.
import sys, os, json
import numpy as np
from PIL import Image

TOP = ['front', 'q3', 'profile', 'r3', 'back']
TOPO = ['tfront', 'tq3', 'tprofile', 'tr3', 'tback']
PLANES = {'male': (1240, 460, 1490, 735), 'female': (1160, 455, 1410, 725)}


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


def erode(m, n=1):
    for _ in range(n):
        e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]; m = e
    return m


def blur(a):
    b = a.copy(); b[1:-1] = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4; c = b.copy(); c[:, 1:-1] = (b[:, :-2] + 2 * b[:, 1:-1] + b[:, 2:]) / 4; return c


def main(who, d, refjson, th=9.0):
    here = os.path.dirname(os.path.abspath(__file__))
    V = json.load(open(refjson))['views']
    ref = np.asarray(Image.open(os.path.join(here, 'ref', 'legs-lowpoly-%s.png' % who)).convert('RGB'), dtype=float)
    bref = np.asarray(Image.open(os.path.join(here, 'ref', 'body-%s.png' % who)).convert('RGB'), dtype=float)
    ours = np.asarray(Image.open(os.path.join(d, 'sheet-legs-%s.png' % who)).convert('RGB'))
    bours = np.asarray(Image.open(os.path.join(d, 'body-%s.png' % who)).convert('RGB'))
    crop = lambda im, b: im[b[1]:b[3], b[0]:b[2]].astype(np.uint8)
    bb = V['body']['box']; bodybox = (bb[0], bb[1] - 60, bb[2], bb[3])
    small = lambda a, k: np.asarray(Image.fromarray(a).resize((a.shape[1] // k, a.shape[0] // k), Image.LANCZOS))
    rows = [strip([crop(ref, V[v]['box']) for v in TOP]), strip([crop(ours, V[v]['box']) for v in TOP])]
    rows.append(strip([crop(ref, V[v]['box']) for v in TOPO] + [crop(ref, PLANES[who])] + [small(crop(bref, bodybox), 3)]))
    rows.append(strip([crop(ours, V[v]['box']) for v in TOPO] + [crop(ours, PLANES[who])] + [small(crop(bours, bodybox), 3)]))
    Image.fromarray(stack(rows)).save(os.path.join(d, 'vs-ref-legs-%s.png' % who))

    meta = json.load(open(os.path.join(d, 'ids-legs-%s.json' % who)))
    allids = np.frombuffer(open(os.path.join(d, 'ids-legs-%s.bin' % who), 'rb').read(), dtype=np.int32)
    pal = np.random.RandomState(3).randint(70, 240, (2000, 3)).astype(np.uint8)
    A, B = [], []
    for v in TOP + ['body'] + TOPO:
        if v not in meta:
            continue
        m = meta[v]; x0, y0, x1, y1 = m['box']; w, h = x1 - x0, y1 - y0
        I = allids[m['off']:m['off'] + w * h].reshape(h, w)
        src = bref if v == 'body' else ref
        R = src[y0:y1, x0:x1]
        bg = R[2, 2]
        fg = np.abs(R - bg).sum(2) > 40
        sm = blur(blur(R)); gx = np.zeros_like(sm); gy = np.zeros_like(sm)
        gx[:, 1:-1] = sm[:, 2:] - sm[:, :-2]; gy[1:-1] = sm[2:] - sm[:-2]
        edge = (np.sqrt((gx ** 2 + gy ** 2).sum(2)) > th) & erode(fg, 3)
        out = fg & ~erode(fg, 1)
        E = np.zeros(I.shape, bool); E[1:, :] |= I[1:, :] != I[:-1, :]; E[:, 1:] |= I[:, 1:] != I[:, :-1]
        a = (R * 0.85).astype(np.uint8).copy(); a[E] = (0, 235, 255)
        b = np.where((I >= 0)[..., None], pal[np.maximum(I, 0) % 2000], np.array([40, 34, 38], np.uint8))
        b[edge] = (255, 230, 0); b[out] = (255, 255, 255)
        # the top: the belt's lower edge, where the comparison starts
        t = V[v]['top'] - y0
        if 0 <= t < h:
            a[t, ::3] = (0, 255, 0); b[t, ::3] = (0, 255, 0)
        if v == 'body':
            a, b = small(a, 3), small(b, 3)
        A.append(a); B.append(b)
    Image.fromarray(stack([strip(A[:6]), strip(B[:6]), strip(A[6:] + B[6:])])).save(os.path.join(d, 'shape-legs-%s.png' % who))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], *(float(x) for x in sys.argv[4:5]))
