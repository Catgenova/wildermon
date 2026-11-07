# The low-poly arm against its reference, view by view (tools/sculpt/ARM_SPEC.md, ARM_SPEC_FEMALE.md):
#
#   node tools/sculpt/lowarmshot.mjs --who male --out <dir> --ids
#   python3 tools/sculpt/lowashape.py male <dir>
#
# writes <dir>/vs-ref-arm-<who>.png: the reference's arm views above ours, its hand views above ours, its topology and
# colour-coded panels above ours, and the full body's arm (reference, ours) side by side; and <dir>/shape-arm-<who>.png,
# shape only: per view, first the reference with our facet edges over it (cyan), then ours as flat, distinct per-facet
# colours with the reference's outline (white) and its facet edges found from its colour steps (yellow). No light in the
# second: where the planes fall is all it shows.
import sys, os, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowamask import ARM_BOXES, BODY_BOXES
from lowshape import erode, blur, strip, stack

VIEWS = ['front', 'q3', 'profile', 'r3', 'back', 'hback', 'hq3', 'hprofile', 'hr3', 'hpalm']
PANELS = {
    'female': [(820, 515, 1095, 700), (700, 795, 1075, 985), (1370, 45, 1510, 460)],
    'male': [(890, 650, 1220, 915), (1370, 55, 1510, 530)],
}

def main(who, d, th=9.0):
    here = os.path.dirname(os.path.abspath(__file__))
    ref = np.asarray(Image.open(os.path.join(here, 'ref', 'arm-lowpoly-%s.png' % who)).convert('RGB'), dtype=float)
    ours = np.asarray(Image.open(os.path.join(d, 'sheet-arm-%s.png' % who)).convert('RGB').resize((1536, 1024)))
    boxes = ARM_BOXES[who]
    crop = lambda im, b: im[b[1]:b[3], b[0]:b[2]].astype(np.uint8)
    rows = []
    for group in (VIEWS[:5], VIEWS[5:]):
        rows.append(strip([crop(ref, boxes[v]) for v in group])); rows.append(strip([crop(ours, boxes[v]) for v in group]))
    pan = PANELS[who]
    rows.append(strip([crop(ref, b) for b in pan] + [crop(ours, b) for b in pan]))
    bref = np.asarray(Image.open(os.path.join(here, 'ref', 'body-%s.png' % who)).convert('RGB'))
    bours = np.asarray(Image.open(os.path.join(d, 'body-arm-%s.png' % who)).convert('RGB'))
    x0, y0, x1, y1 = BODY_BOXES[who]
    bx = (max(0, x0 - 40), max(0, y0 - 120), min(887, x1 + 260), min(1774, y1 + 40))
    bodyrow = strip([crop(bref, bx), crop(bours, bx), (0.5 * crop(bref, bx) + 0.5 * crop(bours, bx)).astype(np.uint8)])
    top = stack(rows)
    Image.fromarray(stack([top, bodyrow]) if bodyrow.shape[1] <= top.shape[1] else strip([top, bodyrow])).save(os.path.join(d, 'vs-ref-arm-%s.png' % who))

    ids = np.frombuffer(open(os.path.join(d, 'ids-arm-%s.bin' % who), 'rb').read(), dtype=np.int16).reshape(len(VIEWS), 1024, 1536).astype(np.int32)
    pal = np.random.RandomState(3).randint(70, 240, (ids.max() + 2, 3)).astype(np.uint8)
    fg = np.abs(ref - ref[8, 700]).sum(2) > 40
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
    Image.fromarray(stack([strip(A[:5]), strip(B[:5]), strip(A[5:]), strip(B[5:])])).save(os.path.join(d, 'shape-arm-%s.png' % who))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], *(float(x) for x in sys.argv[3:4]))
