"""The leather chest sculpted from the approved trace (tools/sculpt/leather/mesh/<who>-<view>.json): the torso's
plates cut from one smooth shell (tools/sculpt/lowlchestshell.mjs: the trunk as a chart, azimuth by height). Each
traced outline mapped into the chart through its view's camera (the sheet's trunk map and projection, inverted along
the shell), each view only over the azimuths it faces (front -20..40, q3 -60..-20, side 40..110, r3 110..160, back
160..180 and -180..-160; the right flank, which no view faces, the side and r3 views mirrored); a piece's charted
outlines joined; each plate meshed on an even grid in the chart, out from the body by its layer, its face rising over
the bevel from its edge, its edge a wall back down by its thickness. Writes sculpt-<who>.json { verts, faces: [{ v,
col, piece }] } for tools/sculpt/lowlchestliftshot.mjs.

  python3 tools/sculpt/lowlchestsculpt.py <shell dir> <out dir> [who ...]
"""
import sys, os, json, math, numpy as np
from PIL import Image
from shapely.geometry import Polygon, MultiPolygon, box as sbox
from shapely.ops import unary_union
from shapely import affinity
import mapbox_earcut as earcut
D = os.path.dirname(os.path.abspath(__file__)); MESH = os.path.join(D, 'leather/mesh')
SHEET = np.array(Image.open(os.path.join(D, 'ref/leather-chest.png')).convert('RGB')).astype(float)
TORSO = ['skirt.f', 'skirt.f2', 'skirt.b', 'skirtU.l', 'skirtU.r', 'skirtL.l', 'skirtL.r', 'collar', 'core', 'band1', 'band2', 'ring', 'ring.hole', 'stripe', 'belt', 'back.top', 'back.strap', 'back.panel', 'back.side', 'back.low', 'side', 'undershirt']
LAYER = {'undershirt': 0.03, 'core': 0.06, 'back.top': 0.06, 'back.panel': 0.075, 'back.side': 0.06, 'back.low': 0.06, 'side': 0.06, 'back.strap': 0.09,
         'collar': 0.1, 'skirtL.l': 0.08, 'skirtL.r': 0.08, 'skirtU.l': 0.1, 'skirtU.r': 0.1, 'skirt.b': 0.11, 'skirt.f': 0.12, 'skirt.f2': 0.11, 'band1': 0.09, 'band2': 0.09, 'belt': 0.1, 'ring': 0.115, 'ring.hole': 0.118, 'stripe': 0.11}
RISE, BEV, THICK, GRID = 0.014, 0.05, 0.035, 0.14
def canon(n):
    if n.startswith('stripe'): return 'stripe'
    if n.startswith('collar') or n == 'notch': return 'collar'
    if n.startswith('core'): return 'core'
    if n.startswith('belt'): return 'belt'
    if n.startswith('back.side'): return 'back.side'
    if n.startswith('side'): return 'side'
    if n.startswith('undershirt.layer'): return 'undershirt'
    if n.startswith('skirt.mid'): return 'skirt.b'
    return n
WIN = {'front': [(-20, 40)], 'q3': [(-60, -20)], 'side': [(40, 110)], 'r3': [(110, 160)], 'back': [(160, 180), (-180, -160)]}
MIRROR = {'side': [(-110, -60)], 'r3': [(-160, -110)]}

def run(shdir, outdir, who):
    S = json.load(open(os.path.join(shdir, f'shell-{who}.json'))); C = S['cams']
    AS, YS, AX, R = np.array(S['as'], float), np.array(S['ys'], float), np.array(S['axis'], float), np.array(S['R'], float)
    def pw(m, y):
        Y, k = m['y'], m['k']
        if y >= Y[0]: return k[0]
        for i in range(len(Y) - 1):
            if y >= Y[i + 1]: t = (y - Y[i]) / (Y[i + 1] - Y[i]); return k[i] + (k[i + 1] - k[i]) * t
        return k[-1]
    def radius(a, y):
        a = (a + 180) % 360 - 180; fy = np.clip((YS[0] - y) / (YS[0] - YS[1]), 0, len(YS) - 1.001); i = int(fy); ty = fy - i
        fa = (a + 180) / 2; j = int(math.floor(fa)) % len(AS); ta = fa - math.floor(fa); j1 = (j + 1) % len(AS)
        r0 = R[i, j] * (1 - ta) + R[i, j1] * ta; r1 = R[i + 1, j] * (1 - ta) + R[i + 1, j1] * ta
        ax = AX[i] * (1 - ty) + AX[i + 1] * ty
        return r0 * (1 - ty) + r1 * ty, ax
    def point(a, y, off):
        r, ax = radius(a, y); t = math.radians(a)
        return np.array([ax[0] + (r + off) * math.sin(t), y, ax[1] + (r + off) * math.cos(t)])
    def sheet_of(p, view, mirror=False):
        v = C['views'][view]; yaw = math.radians(v['yaw']); x = p[0] * (-1 if mirror else 1)
        X, Z = x * pw(C['sx'], p[1]), p[2] * pw(C['sz'], p[1])
        return v['cx'] + C['s'] * (math.cos(yaw) * X + math.sin(yaw) * Z), C['cy'] - C['s'] * p[1]
    YN = {'male': (-1.0, -0.36), 'female': (-1.0, -0.3)}[who]
    def ystretch(y):
        # (the sheet's neck: its head is drawn smaller, its collar's top reaching the chin; ours from YN[0] up stretched so)
        return y if y <= YN[0] else YN[0] + (y - YN[0]) * (-0.06 - YN[0]) / (YN[1] - YN[0])
    def to_chart(u, vv, view, lo, hi, off, mirror=False):
        y = ystretch((C['cy'] - vv) / C['s']); best = None
        A = np.arange(lo - 30, hi + 30.01, 1.0)
        U = np.array([sheet_of(point(a, y, off), view, mirror)[0] for a in A])
        # (the front surface of the view: the stretch of azimuth, round the window, where u runs one way)
        for k in range(len(A) - 1):
            if (U[k] - u) * (U[k + 1] - u) <= 0 and U[k] != U[k + 1]:
                a = A[k] + (u - U[k]) / (U[k + 1] - U[k]) * (A[k + 1] - A[k])
                if best is None or abs(a - (lo + hi) / 2) < abs(best - (lo + hi) / 2): best = a
        if best is None: best = A[int(np.argmin(abs(U - u)))]
        return best, y
    RM = float(R.mean())
    SX = math.pi / 180 * RM  # chart: azimuth degrees to arc units
    charts, cols = {}, {}
    for view in ['front', 'q3', 'side', 'r3', 'back']:
        T = json.load(open(os.path.join(MESH, f'{who}-{view}.json')))
        for mirror, wins in [(False, WIN[view]), (True, MIRROR.get(view, []))]:
            for (lo, hi) in wins:
                for name, v in T['pieces'].items():
                    c = canon(name)
                    if c not in TORSO: continue
                    if isinstance(v, dict):
                        cx, cy, rx, ry = v['ellipse']; v = [[cx + rx * math.cos(t), cy + ry * math.sin(t)] for t in np.linspace(0, 2 * math.pi, 33)[:-1]]
                    # (the outline resampled every sheet pixel, so its chart outline follows the shell)
                    pts = []
                    for i in range(len(v)):
                        p0, p1 = np.array(v[i]), np.array(v[(i + 1) % len(v)]); m = max(1, int(np.linalg.norm(p1 - p0)))
                        for k in range(m): pts.append(p0 + (p1 - p0) * k / m)
                    u_shift = 0
                    ch = []
                    for u, vv in pts:
                        uu = (2 * C['views'][view]['cx'] - u) if mirror else u
                        a, y = to_chart(uu, vv, view, lo, hi, LAYER.get(c, 0.06), mirror)
                        ch.append((a * SX, y))
                    P = Polygon(ch).buffer(0)
                    clip = P.intersection(sbox(lo * SX, -99, hi * SX, 99))
                    if clip.is_empty or clip.area < 1e-4: continue
                    charts.setdefault(c, []).append(clip)
                    if not mirror and c not in cols:
                        m = np.zeros(SHEET.shape[:2], np.uint8)
                        import cv2; cv2.fillPoly(m, [np.array([[int(x), int(y)] for x, y in v], np.int32)], 1)
                        cols[c] = np.median(SHEET[m > 0], 0).tolist() if m.sum() else [120, 70, 50]
    verts, faces = [], []
    def add(P, off_of, piece, col):
        b = len(verts); verts.extend(P); faces.append({'v': list(range(b, b + len(P))), 'col': col, 'piece': piece})
    for c, polys in charts.items():
        G = unary_union(polys).buffer(0.004).buffer(-0.004)
        G = [G] if isinstance(G, Polygon) else list(G.geoms)
        lay = LAYER.get(c, 0.06); col = cols.get(c, [120, 70, 50])
        for g in G:
            if g.area < 2e-4: continue
            bnd = g.boundary
            def off(x, y):
                from shapely.geometry import Point
                d = bnd.distance(Point(x, y)); return lay + RISE * min(1.0, d / BEV)
            def P3(x, y, o=None): return point(x / SX, y, off(x, y) if o is None else o).round(4).tolist()
            x0, y0, x1, y1 = g.bounds
            for gx in np.arange(x0, x1, GRID):
                for gy in np.arange(y0, y1, GRID):
                    cell = sbox(gx, gy, gx + GRID, gy + GRID)
                    q = cell.intersection(g)
                    if q.is_empty: continue
                    for part in ([q] if isinstance(q, Polygon) else [p for p in getattr(q, 'geoms', []) if isinstance(p, Polygon)]):
                        if part.area < 1e-7: continue
                        ring = list(part.exterior.coords)[:-1]
                        if part.equals(cell): add([P3(x, y) for x, y in ring], None, c, col); continue
                        idx = earcut.triangulate_float32(np.array(ring, np.float32).reshape(-1, 2), np.array([len(ring)], np.uint32))
                        for i in range(0, len(idx), 3): add([P3(*ring[idx[i]]), P3(*ring[idx[i + 1]]), P3(*ring[idx[i + 2]])], None, c, col)
            # (the wall: the outline down by the leather's thickness, darker)
            for ringc in [g.exterior] + list(g.interiors):
                cs = list(ringc.coords)
                for (xa, ya), (xb, yb) in zip(cs, cs[1:]):
                    n = max(1, int(math.hypot(xb - xa, yb - ya) / GRID))
                    for k in range(n):
                        pa = (xa + (xb - xa) * k / n, ya + (yb - ya) * k / n); pb = (xa + (xb - xa) * (k + 1) / n, ya + (yb - ya) * (k + 1) / n)
                        add([P3(*pa, lay), P3(*pb, lay), P3(*pb, lay - THICK), P3(*pa, lay - THICK)], None, c, [x * 0.55 for x in col])
    json.dump({'who': who, 'verts': verts, 'faces': faces}, open(os.path.join(outdir, f'sculpt-{who}.json'), 'w'))
    print(who, len(faces), 'faces', sum(len(f['v']) - 2 for f in faces), 'triangles', sorted(charts))
if __name__ == '__main__':
    for who in (sys.argv[3:] or ['male']): run(sys.argv[1], sys.argv[2], who)
