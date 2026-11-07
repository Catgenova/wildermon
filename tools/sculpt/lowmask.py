# The reference sheets' silhouettes and features, per view, for tools/sculpt/lowfit.mjs:
#
#   python3 tools/sculpt/lowmask.py tools/sculpt/ref/head-lowpoly.png out.json   # and head-lowpoly-female.png
#
# For each of the seven views (its box on the 1536x1024 sheet below), at half resolution: the head's silhouette (every
# pixel that is not the background, the holes filled), and the centroids of its pupils (dark slate) and its brows (dark
# brown), as sheet pixels. Written as JSON: { scale, views: { name: { box, w, h, mask (a string of 0/1 rows), pupils,
# brows, marks (the front view's nose underside and chin), lum (the luminance, row by row) } } }.
import json, sys
from PIL import Image

BOXES = {
    'front': (20, 25, 324, 455), 'q3': (326, 25, 630, 455), 'profile': (630, 25, 934, 455),
    'r3': (934, 25, 1238, 455), 'back': (1238, 25, 1530, 455),
    'top': (30, 560, 336, 915), 'bottom': (340, 560, 652, 915),
}
K = 2  # half resolution

def views(src):
    im = Image.open(src).convert('RGB')
    if im.size != (1536, 1024):
        im = im.resize((1536, 1024), Image.LANCZOS)
    px = im.load()
    out = {'scale': K, 'views': {}}
    for name, (x0, y0, x1, y1) in BOXES.items():
        w, h = (x1 - x0) // K, (y1 - y0) // K
        # the background's colour
        cs = [px[x, y0 + 2] for x in range(x0, x1, 4)] + [px[x0 + 2, y] for y in range(y0, y1, 4)] + [px[x1 - 3, y] for y in range(y0, y1, 4)]
        bg = [sorted(c[k] for c in cs)[len(cs) // 2] for k in range(3)]  # the median of the box's top and sides
        fg = [[False] * w for _ in range(h)]
        for j in range(h):
            for i in range(w):
                c = px[x0 + i * K + K // 2, y0 + j * K + K // 2]
                fg[j][i] = sum(abs(c[k] - bg[k]) for k in range(3)) > 36
        # fill holes: the background is what a flood from the box's edge reaches
        seen = [[False] * w for _ in range(h)]
        stack = [(i, 0) for i in range(w)] + [(i, h - 1) for i in range(w)] + [(0, j) for j in range(h)] + [(w - 1, j) for j in range(h)]
        while stack:
            i, j = stack.pop()
            if i < 0 or j < 0 or i >= w or j >= h or seen[j][i] or fg[j][i]:
                continue
            seen[j][i] = True
            stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
        mask = [''.join('0' if seen[j][i] else '1' for i in range(w)) for j in range(h)]
        inside = lambda x, y: mask[min(h - 1, (y - y0) // K)][min(w - 1, (x - x0) // K)] == '1'
        def blobs(test, region=None, single=False, comps=False):
            pts = {(x, y) for y in range(y0, y1) for x in range(x0, x1) if inside(x, y) and (region is None or region(x, y)) and test(px[x, y])}
            if not pts:
                return []
            if comps:
                # connected pieces of a plausible pupil's size, compact
                groups, left = [], set(pts)
                while left:
                    st = [left.pop()]; g = []
                    while st:
                        p = st.pop(); g.append(p)
                        for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)):
                            if q in left: left.remove(q); st.append(q)
                    xs = [p[0] for p in g]; ys = [p[1] for p in g]
                    bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
                    if 15 <= len(g) <= 600 and bw <= 30 and bh <= 30 and len(g) > 0.45 * bw * bh:
                        groups.append(g)
            else:
                pts = list(pts)
                mid = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
                groups = [pts] if single or max(p[0] for p in pts) - min(p[0] for p in pts) < 40 else [[p for p in pts if p[0] < mid], [p for p in pts if p[0] >= mid]]
            # each blob's centroid, its size, and its two ends (the mean of its leftmost and its rightmost columns)
            def ends(g):
                lo, hi = min(p[0] for p in g), max(p[0] for p in g)
                L = [p for p in g if p[0] <= lo + 1]; R = [p for p in g if p[0] >= hi - 1]
                return [lo, sum(p[1] for p in L) / len(L), hi, sum(p[1] for p in R) / len(R)]
            return [[sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g), len(g)] + ends(g) for g in groups if len(g) > 12]
        # pupils: holes in the silhouette, near the background's own colour; brows: dark brown just above them
        pupil = lambda c: c[2] >= c[0] - 3 and 110 < sum(c) < 260 and c[2] - c[1] < 25 and abs(c[0] - c[1]) < 10
        brow = lambda c: c[0] - c[2] > 30 and 55 < c[0] < 140 and c[1] < 100
        eyes = blobs(pupil, lambda x, y: y < y0 + (y1 - y0) * 0.75, comps=True) if name in ('front', 'q3', 'profile', 'bottom') else []
        # the profile sees one eye whole: keep the rightmost blob (the face looks right); the three-quarter sees both
        if name == 'profile' and eyes:
            eyes = [max(eyes, key=lambda e: e[0])]
        if name == 'q3' and len(eyes) > 2:
            eyes = sorted(eyes, key=lambda e: -e[2])[:2]
        brows = []
        for e in eyes:
            got = blobs(brow, lambda x, y, e=e: abs(x - e[0]) < 42 and -40 < y - e[1] < -8, single=True)
            if got: brows.append(got[0])
        marks = {}
        if name in ('front', 'bottom') and eyes:
            # down the face's centre line below the eyes (between the two, or the silhouette's middle at their height):
            # the first sharp drop into shadow is the nose's underside (the cliff), the last before the neck the chin's
            ey = round(max(e[1] for e in eyes))
            if len(eyes) == 2:
                cx = round((eyes[0][0] + eyes[1][0]) / 2)
            else:
                row = mask[(ey - y0) // K]
                cx = x0 + K * (row.index('1') + len(row) - row[::-1].index('1')) // 2
            lum = lambda y: sum(0.3 * px[x, y][0] + 0.59 * px[x, y][1] + 0.11 * px[x, y][2] for x in range(cx - 4, cx + 5)) / 9
            drops = [y for y in range(ey + 2, y1 - 8) if lum(y - 2) - lum(y + 1) > 35]
            runs = [y for i, y in enumerate(drops) if i == 0 or y - drops[i - 1] > 6]
            # each drop's dark run: how far below it the line stays dark; a run that never comes back to the light is
            # the neck's end, not a feature
            def run(y):
                base = lum(y + 3)
                for z in range(y + 3, y1 - 2):
                    if lum(z) > base + 30:
                        return z - y
                return None
            spans = [(y, run(y)) for y in runs if y > ey + (0 if name == 'bottom' else 12)]
            spans = [(y, r) for y, r in spans if r is not None]
            if spans:
                marks['cliff'] = [cx, spans[0][0]]
                marks['chin'] = [cx, max(spans[1:] or spans, key=lambda t: t[1])[0]]
        # the luminance at the mask's resolution, the mean of each 2x2 block
        Y = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
        lum = [[round(sum(Y(px[x0 + i * K + a, y0 + j * K + b]) for a in range(K) for b in range(K)) / (K * K)) for i in range(w)] for j in range(h)]
        out['views'][name] = {'box': [x0, y0, x1, y1], 'w': w, 'h': h, 'mask': mask, 'pupils': eyes, 'brows': brows, 'marks': marks, 'lum': lum}
    return out

def main(src, dst):
    json.dump(views(src), open(dst, 'w'))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
