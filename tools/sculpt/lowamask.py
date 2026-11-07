# The arm sheets' silhouettes, per view, for tools/sculpt/lowafit.mjs (tools/sculpt/ARM_SPEC.md, ARM_SPEC_FEMALE.md):
#
#   python3 tools/sculpt/lowamask.py male /tmp/aref-male.json      # and female
#
# The ten views of each sheet (the arm's five on the top row, the hand's five below; boxes clear of their neighbours,
# the bracket and the labels) and the full-body reference's front view (tools/sculpt/ref/body-<who>.png, in its own
# pixels, view 'body': the body's right arm, the viewer's left), each at half resolution as tools/sculpt/lowmask.py
# makes them: { scale, views: { name: { box, w, h, mask (rows of 0/1), cut } } }. A pixel is the arm's when its colour is
# off the background's and it is not the titles' cream lettering (light and unsaturated, at the sheet's top); holes are
# filled; on the sheets only the largest piece is kept. 'cut' (the
# body view only): per mask row, the column past which the row is the torso or the thigh, not the arm (the middle of
# the row's widest gap, below the armpit), so the fitter compares the arm alone.
import json, os, sys
from PIL import Image

ARM_BOXES = {
    'female': {
        'front': (138, 45, 300, 428), 'q3': (300, 45, 485, 428), 'profile': (485, 45, 655, 428),
        'r3': (655, 45, 850, 428), 'back': (850, 45, 1030, 428),
        'hback': (40, 515, 185, 690), 'hq3': (185, 515, 335, 690), 'hprofile': (335, 515, 455, 690),
        'hr3': (455, 515, 600, 690), 'hpalm': (600, 515, 760, 690),
    },
    'male': {
        'front': (108, 45, 265, 522), 'q3': (265, 45, 470, 522), 'profile': (470, 45, 655, 522),
        'r3': (655, 45, 865, 522), 'back': (865, 45, 1050, 522),
        'hback': (20, 650, 207, 915), 'hq3': (207, 650, 380, 915), 'hprofile': (380, 650, 515, 915),
        'hr3': (515, 650, 680, 915), 'hpalm': (680, 650, 860, 915),
    },
}
BODY_BOXES = {'male': (60, 330, 300, 1090), 'female': (120, 380, 330, 1030)}
# below this body-reference row the arm stands clear of the torso
ARMPIT = {'male': 545, 'female': 520}
K = 2

def mask_of(im, box, sheet=True):
    px = im.load()
    x0, y0, x1, y1 = box
    w, h = (x1 - x0) // K, (y1 - y0) // K
    cs = [px[x, y0 + 2] for x in range(x0, x1, 4)] + [px[x0 + 2, y] for y in range(y0, y1, 4)] + [px[x1 - 3, y] for y in range(y0, y1, 4)]
    bg = [sorted(c[k] for c in cs)[len(cs) // 2] for k in range(3)]
    def fg(c, y):
        if sum(abs(c[k] - bg[k]) for k in range(3)) <= 36: return False
        return not (sheet and y < 74 and min(c) > 165 and c[0] - c[2] < 40)  # the titles' cream lettering
    m = [[fg(px[x0 + i * K + K // 2, y0 + j * K + K // 2], y0 + j * K) for i in range(w)] for j in range(h)]
    seen = [[False] * w for _ in range(h)]
    st = [(i, 0) for i in range(w)] + [(i, h - 1) for i in range(w)] + [(0, j) for j in range(h)] + [(w - 1, j) for j in range(h)]
    while st:
        i, j = st.pop()
        if i < 0 or j < 0 or i >= w or j >= h or seen[j][i] or m[j][i]: continue
        seen[j][i] = True
        st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    # specks: keep the largest piece only
    lab = [[-1] * w for _ in range(h)]; best, bi = 0, -1; n = 0
    for j in range(h):
        for i in range(w):
            if seen[j][i] or lab[j][i] >= 0: continue
            st = [(i, j)]; lab[j][i] = n; c = 0
            while st:
                a, b = st.pop(); c += 1
                for q in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= q[0] < w and 0 <= q[1] < h and not seen[q[1]][q[0]] and lab[q[1]][q[0]] < 0:
                        lab[q[1]][q[0]] = n; st.append(q)
            if c > best: best, bi = c, n
            n += 1
    mask = [''.join('1' if (lab[j][i] == bi if sheet else not seen[j][i]) else '0' for i in range(w)) for j in range(h)]
    return {'box': [x0, y0, x1, y1], 'w': w, 'h': h, 'mask': mask}

def main(who, dst):
    here = os.path.dirname(os.path.abspath(__file__))
    sheet = Image.open(os.path.join(here, 'ref', 'arm-lowpoly-%s.png' % who)).convert('RGB')
    out = {'scale': K, 'views': {v: mask_of(sheet, b) for v, b in ARM_BOXES[who].items()}}
    body = mask_of(Image.open(os.path.join(here, 'ref', 'body-%s.png' % who)).convert('RGB'), BODY_BOXES[who], sheet=False)
    y0 = body['box'][1]
    cut = []
    for j, row in enumerate(body['mask']):
        c = len(row)
        if y0 + j * K >= ARMPIT[who] and '1' in row:
            # the widest gap inside the row (not the thumb's, beside the hand); none: the arm alone in the row
            gaps, i = [], row.index('1')
            while True:
                g0 = row.find('0', i)
                if g0 < 0: break
                g1 = row.find('1', g0)
                if g1 < 0: break
                gaps.append((g1 - g0, g0, g1)); i = g1
            if gaps:
                _, g0, g1 = max(gaps)
                c = (g0 + g1) // 2
        cut.append(c)
    body['cut'] = cut
    out['views']['body'] = body
    json.dump(out, open(dst, 'w'))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
