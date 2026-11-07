# The reference sheets' silhouettes and features, per view, for tools/sculpt/lowfit.mjs:
#
#   python3 tools/sculpt/lowmask.py tools/sculpt/ref/head-lowpoly.png out.json   # and head-lowpoly-female.png
#
# For each of the seven views (its box on the 1536x1024 sheet below), at half resolution: the head's silhouette (every
# pixel that is not the background, the holes filled), and the centroids of its pupils (dark slate) and its brows (dark
# brown), as sheet pixels. Written as JSON: { scale, views: { name: { box, w, h, mask (a string of 0/1 rows), pupils,
# brows } } }.
import json, sys
from PIL import Image

BOXES = {
    'front': (20, 25, 324, 455), 'q3': (326, 25, 630, 455), 'profile': (630, 25, 934, 455),
    'r3': (934, 25, 1238, 455), 'back': (1238, 25, 1530, 455),
    'top': (30, 560, 336, 915), 'bottom': (340, 560, 664, 915),
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
            return [[sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g), len(g)] for g in groups if len(g) > 12]
        # pupils: holes in the silhouette, near the background's own colour; brows: dark brown just above them
        pupil = lambda c: c[2] >= c[0] - 3 and 110 < sum(c) < 260 and c[2] - c[1] < 25 and abs(c[0] - c[1]) < 10
        brow = lambda c: c[0] - c[2] > 30 and 55 < c[0] < 140 and c[1] < 100
        eyes = blobs(pupil, lambda x, y: y < y0 + (y1 - y0) * 0.75, comps=True) if name in ('front', 'q3', 'profile', 'bottom') else []
        # a side view sees one eye whole: keep the rightmost blob (the face looks right)
        if name in ('q3', 'profile') and eyes:
            eyes = [max(eyes, key=lambda e: e[0])]
        brows = []
        for e in eyes:
            got = blobs(brow, lambda x, y, e=e: abs(x - e[0]) < 42 and -40 < y - e[1] < -8, single=True)
            if got: brows.append(got[0])
        out['views'][name] = {'box': [x0, y0, x1, y1], 'w': w, 'h': h, 'mask': mask, 'pupils': eyes, 'brows': brows}
    return out

def main(src, dst):
    json.dump(views(src), open(dst, 'w'))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
