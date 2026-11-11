"""The leather chest's arm plates sculpted from the approved trace on the arm charts (tools/sculpt/lowlchestarm.mjs):
each traced arm piece (the strap, the pauldron's dark top and tooth band, the two lames, the sleeve, the bracer, its
cuff and ring, the wrist band) mapped into its arm's chart through the view's projection table (each outline point the
front-most chart cell it falls in), kept where that view faces the chart most squarely, joined over the views, and
meshed on an even grid in the chart, out from the arm by its layer (the pauldron's well off the shoulder), its face
rising over the bevel, its edge a wall. Added to sculpt-<who>.json.

  python3 tools/sculpt/lowlchestarm.py <sculpt dir> [who ...]
"""
import sys, os, json, math, numpy as np, cv2
from PIL import Image
from shapely.geometry import Polygon, Point, box as sbox
from shapely.ops import unary_union
import mapbox_earcut as earcut
D = os.path.dirname(os.path.abspath(__file__)); MESH = os.path.join(D, 'leather/mesh')
SHEET = np.array(Image.open(os.path.join(D, 'ref/leather-chest.png')).convert('RGB')).astype(float)
ARM = ['strap', 'captop', 'capband', 'lame1', 'lame2', 'sleeve', 'bracer.cuff', 'bracer', 'brune', 'band']
LAYER = {'strap': 0.1, 'captop': 0.3, 'capband': 0.3, 'lame1': 0.2, 'lame2': 0.14, 'sleeve': 0.03, 'bracer': 0.06, 'bracer.cuff': 0.085, 'brune': 0.09, 'band': 0.075}
RISE, BEV, THICK, GRID = 0.014, 0.04, 0.035, 0.1
YAW = {'front': 0, 'q3': 40, 'side': 280, 'r3': 219, 'back': 180}
def canon(n, view):
    side = None
    m = n.rsplit('.', 1)
    if len(m) == 2 and m[1] in ('l', 'r'): base, side = m
    else: base = n
    if base == 'bring': base = 'brune'
    if view == 'side' and side is None: side = 'l'
    return base, side
def run(sdir, who):
    A = json.load(open(os.path.join(sdir, f'arm-{who}.json')))['arms']
    out = json.load(open(os.path.join(sdir, f'sculpt-{who}.json')))
    verts, faces = out['verts'], [f for f in out['faces'] if f['piece'].split('@')[0] not in ARM]
    verts_keep = verts
    for s, Ar in A.items():
        ts, ths = np.array(Ar['ts']), np.array(Ar['ths'], float); nt, nth = len(ts), len(ths)
        P, N = np.array(Ar['P']), np.array(Ar['N'])
        RM = 0.45; SX = math.pi / 180 * RM
        # (each node's best view: its rest normal against the view's direction)
        dirs = {v: np.array([-math.sin(math.radians(y)), 0, math.cos(math.radians(y))]) for v, y in YAW.items()}
        face = {v: (N * dirs[v]).sum(-1) for v in YAW}
        best = np.argmax(np.stack([face[v] for v in YAW]), 0); VIEWN = list(YAW)
        charts, cols = {}, {}
        for vi, view in enumerate(VIEWN):
            Q = np.array(Ar['views'][view]).reshape(nt, nth, 3)
            T = json.load(open(os.path.join(MESH, f'{who}-{view}.json')))
            # (the view's best region in the chart: the union of the cells it faces best)
            cells = [sbox(j * 10 * SX, ts[i], (j + 1) * 10 * SX, ts[i + 1]) for i in range(nt - 1) for j in range(nth) if best[i, j] == vi or best[i + 1, j] == vi]
            region = unary_union(cells) if cells else None
            if region is None or region.is_empty: continue
            def locate(u, v):
                bestd, hit = -1e9, None
                for i in range(nt - 1):
                    for j in range(nth):
                        j1 = (j + 1) % nth
                        q = [Q[i, j], Q[i, j1], Q[i + 1, j1], Q[i + 1, j]]
                        xs = [p[0] for p in q]; ys = [p[1] for p in q]
                        if u < min(xs) or u > max(xs) or v < min(ys) or v > max(ys): continue
                        for (a, b, c), (ca, cb, cc) in [((0, 1, 2), ((i, j), (i, j + 1), (i + 1, j + 1))), ((0, 2, 3), ((i, j), (i + 1, j + 1), (i + 1, j)))]:
                            pa, pb, pc = q[a], q[b], q[c]
                            d = (pb[1] - pc[1]) * (pa[0] - pc[0]) + (pc[0] - pb[0]) * (pa[1] - pc[1])
                            if abs(d) < 1e-9: continue
                            l0 = ((pb[1] - pc[1]) * (u - pc[0]) + (pc[0] - pb[0]) * (v - pc[1])) / d; l1 = ((pc[1] - pa[1]) * (u - pc[0]) + (pa[0] - pc[0]) * (v - pc[1])) / d; l2 = 1 - l0 - l1
                            if min(l0, l1, l2) < -1e-6: continue
                            z = l0 * pa[2] + l1 * pb[2] + l2 * pc[2]
                            if z > bestd:
                                bestd = z; th = l0 * ca[1] + l1 * cb[1] + l2 * cc[1]; t = l0 * ts[ca[0]] + l1 * ts[cb[0]] + l2 * ts[cc[0]]
                                hit = (th * 10 * SX, t)
                return hit
            for name, v in T['pieces'].items():
                base, side = canon(name, view)
                if base not in ARM or side != s: continue
                if isinstance(v, dict):
                    cx, cy, rx, ry = v['ellipse']; v = [[cx + rx * math.cos(a), cy + ry * math.sin(a)] for a in np.linspace(0, 2 * math.pi, 25)[:-1]]
                pts = []
                for k in range(len(v)):
                    p0, p1 = np.array(v[k]), np.array(v[(k + 1) % len(v)]); m = max(1, int(np.linalg.norm(p1 - p0) / 1.5))
                    for q in range(m): pts.append(p0 + (p1 - p0) * q / m)
                ch = [locate(u, vv) for u, vv in pts]; ch = [c for c in ch if c]
                if len(ch) < 3: continue
                # (unwrapped round θ from the first point, then folded back into 0..360)
                X0 = ch[0][0]; per = 360 * SX; ch2 = []
                for x, y in ch:
                    while x - X0 > per / 2: x -= per
                    while x - X0 < -per / 2: x += per
                    ch2.append((x, y))
                Pg = Polygon(ch2).buffer(0)
                if Pg.is_empty: continue
                parts = []
                for sh in (-per, 0, per):
                    from shapely import affinity
                    g = affinity.translate(Pg, sh, 0).intersection(sbox(0, -9, per, 9))
                    if not g.is_empty: parts.append(g)
                Pg = unary_union(parts).intersection(region)
                if Pg.is_empty or Pg.area < 1e-5: continue
                charts.setdefault(base, []).append(Pg)
                if base not in cols:
                    m = np.zeros(SHEET.shape[:2], np.uint8); cv2.fillPoly(m, [np.array([[int(x), int(y)] for x, y in v], np.int32)], 1)
                    cols[base] = np.median(SHEET[m > 0], 0).tolist() if m.sum() else [120, 70, 50]
        def node(x, t, off):
            th = (x / SX) % 360; fj = th / 10; j = int(fj) % nth; j1 = (j + 1) % nth; a = fj - math.floor(fj)
            fi = np.clip(np.interp(t, ts, np.arange(nt)), 0, nt - 1.001); i = int(fi); b = fi - i
            p = (P[i, j] * (1 - a) + P[i, j1] * a) * (1 - b) + (P[i + 1, j] * (1 - a) + P[i + 1, j1] * a) * b
            n = (N[i, j] * (1 - a) + N[i, j1] * a) * (1 - b) + (N[i + 1, j] * (1 - a) + N[i + 1, j1] * a) * b
            n = n / (np.linalg.norm(n) or 1); return (p + n * off).round(4).tolist()
        def add(pts, piece, col):
            b = len(verts); verts.extend(pts); faces.append({'v': list(range(b, b + len(pts))), 'col': col, 'piece': f'{piece}.{s}'})
        for base, polys in charts.items():
            G = unary_union(polys).buffer(0.01).buffer(-0.01)
            G = [G] if isinstance(G, Polygon) else [g for g in getattr(G, 'geoms', []) if isinstance(g, Polygon)]
            lay = LAYER[base]; col = cols[base]
            for g in G:
                if g.area < 1e-4: continue
                bnd = g.boundary
                P3 = lambda x, y, o=None: node(x, y, (lay + RISE * min(1.0, bnd.distance(Point(x, y)) / BEV)) if o is None else o)
                x0, y0, x1, y1 = g.bounds
                for gx in np.arange(x0, x1, GRID):
                    for gy in np.arange(y0, y1, GRID):
                        cell = sbox(gx, gy, gx + GRID, gy + GRID); q = cell.intersection(g)
                        for part in ([q] if isinstance(q, Polygon) else [p for p in getattr(q, 'geoms', []) if isinstance(p, Polygon)]):
                            if part.is_empty or part.area < 1e-8: continue
                            ring = list(part.exterior.coords)[:-1]
                            if part.equals(cell): add([P3(x, y) for x, y in ring], base, col); continue
                            idx = earcut.triangulate_float32(np.array(ring, np.float32).reshape(-1, 2), np.array([len(ring)], np.uint32))
                            for k in range(0, len(idx), 3): add([P3(*ring[idx[k]]), P3(*ring[idx[k + 1]]), P3(*ring[idx[k + 2]])], base, col)
                for rg in [g.exterior] + list(g.interiors):
                    cs = list(rg.coords)
                    for (xa, ya), (xb, yb) in zip(cs, cs[1:]):
                        add([P3(xa, ya, lay), P3(xb, yb, lay), P3(xb, yb, lay - THICK), P3(xa, ya, lay - THICK)], base, [c * 0.55 for c in col])
        print(who, s, sorted(charts))
    json.dump({'who': who, 'verts': verts, 'faces': faces}, open(os.path.join(sdir, f'sculpt-{who}.json'), 'w'))
    print(who, len(faces), 'faces')
if __name__ == '__main__':
    for who in (sys.argv[2:] or ['male']): run(sys.argv[1], who)
