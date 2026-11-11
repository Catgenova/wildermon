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
from shapely.geometry import Polygon, MultiPolygon, Point, box as sbox
from shapely.ops import unary_union
from shapely import affinity
import mapbox_earcut as earcut
D = os.path.dirname(os.path.abspath(__file__)); MESH = os.path.join(D, 'leather/mesh')
SHEET = np.array(Image.open(os.path.join(D, 'ref/leather-chest.png')).convert('RGB')).astype(float)
WRAP = {'belt', 'collar', 'undershirt', 'back.side', 'side'}
TORSO = ['skirt.f', 'skirt.f2', 'skirt.b', 'skirtU.l', 'skirtU.r', 'skirtL.l', 'skirtL.r', 'collar', 'core', 'band1', 'band2', 'ring', 'ring.hole', 'stripe', 'belt', 'back.top', 'back.strap', 'back.panel', 'back.side', 'back.low', 'side', 'undershirt']
LAYER = {'undershirt': 0.03, 'core': 0.06, 'back.top': 0.06, 'back.panel': 0.075, 'back.side': 0.06, 'back.low': 0.06, 'side': 0.06, 'back.strap': 0.09,
         'collar': 0.1, 'skirtL.l': 0.08, 'skirtL.r': 0.08, 'skirtU.l': 0.1, 'skirtU.r': 0.1, 'skirt.b': 0.11, 'skirt.f': 0.12, 'skirt.f2': 0.11, 'band1': 0.09, 'band2': 0.09, 'belt': 0.1, 'ring': 0.115, 'ring.hole': 0.118, 'stripe': 0.11}
FOLD = 40
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

def solid(G, lay, piece, col, at, add, fold=0.8, simp=0.09, thick=0.06, cham=0.035, rise=0.02):
    """A plate as a low-poly solid from its chart outline(s) G: the outline cut to its drawn corners (simplified by
    `simp`), its face a few flat facets (a constrained triangulation, with points only on fold lines every `fold`
    across), a chamfer from the face (inset by `cham`, `rise` up) down to the rim, the rim a wall `thick` deep, and a
    back face. at(x, y, offset) puts a chart point in the body's space."""
    import triangle as tr
    for g in G:
        if g.area < 3e-4: continue
        o = g.simplify(simp, preserve_topology=True)
        if not isinstance(o, Polygon) or o.is_empty: continue
        outer = [tuple(p) for p in o.exterior.coords[:-1]]
        if len(outer) < 3: continue
        ins = o.buffer(-cham, join_style=2)
        if not isinstance(ins, Polygon) or ins.is_empty or ins.area < 0.2 * o.area: ins = o.buffer(-cham * 0.4, join_style=2)
        if not isinstance(ins, Polygon) or ins.is_empty: ins = o
        inner = [tuple(p) for p in ins.exterior.coords[:-1]]
        # (the face: the inset outline triangulated with points only where it folds round the body)
        x0, y0, x1, y1 = ins.bounds; steiner = []
        for fx in np.arange(math.ceil(x0 / fold) * fold, x1, fold):
            for fy in np.linspace(y0, y1, max(2, int((y1 - y0) / 0.9) + 2))[1:-1]:
                if ins.buffer(-0.05).contains(Point(fx, fy)): steiner.append((fx, fy))
        V2 = inner + steiner; n = len(inner)
        try:
            t = tr.triangulate({'vertices': np.array(V2), 'segments': np.array([[k, (k + 1) % n] for k in range(n)])}, 'p')
            VV, TT = t['vertices'].tolist(), t['triangles'].tolist()
        except Exception:
            idx = earcut.triangulate_float32(np.array(inner, np.float32).reshape(-1, 2), np.array([n], np.uint32)); VV, TT = inner, [idx[k:k + 3] for k in range(0, len(idx), 3)]
        top = lay + rise
        for a, b, c in TT: add([at(*VV[a], top), at(*VV[b], top), at(*VV[c], top)], piece, col)
        # (the chamfer: each outer corner to the inset ring's nearest, a quad or triangle each edge)
        def near(p): return min(range(len(inner)), key=lambda k: (inner[k][0] - p[0]) ** 2 + (inner[k][1] - p[1]) ** 2)
        m = [near(p) for p in outer]; cl = [min(255, x * 1.18) for x in col]
        for k in range(len(outer)):
            k1 = (k + 1) % len(outer); a, b = m[k], m[k1]
            seq = [a]
            while seq[-1] != b and len(seq) <= len(inner): seq.append((seq[-1] + 1) % len(inner))
            if len(seq) > len(inner): seq = [a, b] if a != b else [a]
            ring = [at(*outer[k], lay), at(*outer[k1], lay)] + [at(*inner[q], top) for q in reversed(seq)]
            add(ring, piece, cl)
        # (the rim: the outline down by the thickness; the back face)
        dk = [x * 0.5 for x in col]
        for k in range(len(outer)):
            k1 = (k + 1) % len(outer); add([at(*outer[k1], lay), at(*outer[k], lay), at(*outer[k], lay - thick), at(*outer[k1], lay - thick)], piece, dk)
        idx = earcut.triangulate_float32(np.array(outer, np.float32).reshape(-1, 2), np.array([len(outer)], np.uint32))
        for k in range(0, len(idx), 3): add([at(*outer[idx[k + 2]], lay - thick), at(*outer[idx[k + 1]], lay - thick), at(*outer[idx[k]], lay - thick)], piece, dk)
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
        yaw = math.radians(C['views'][view]['yaw'])
        UZ = []
        for a in A:
            p = point(a, y, off); x = p[0] * (-1 if mirror else 1)
            X, Z = x * pw(C['sx'], p[1]), p[2] * pw(C['sz'], p[1])
            UZ.append((C['views'][view]['cx'] + C['s'] * (math.cos(yaw) * X + math.sin(yaw) * Z), -math.sin(yaw) * X + math.cos(yaw) * Z))
        U = np.array([q[0] for q in UZ]); Zd = np.array([q[1] for q in UZ]); bz = -1e9
        # (the crossing nearest the camera: the shell's surface that faces the view)
        for k in range(len(A) - 1):
            if (U[k] - u) * (U[k + 1] - u) <= 0 and U[k] != U[k + 1]:
                f = (u - U[k]) / (U[k + 1] - U[k]); a = A[k] + f * (A[k + 1] - A[k]); z = Zd[k] + f * (Zd[k + 1] - Zd[k])
                if z > bz: bz = z; best = a
        if best is None: best = A[int(np.argmin(abs(U - u)))]
        return best, y
    RM = float(R.mean())
    SX = math.pi / 180 * RM  # chart: azimuth degrees to arc units
    charts, cols = {}, {}
    # (each plate from its best view, the one that shows the most of it, mapped over a wide band and not clipped; only
    # the pieces that wrap round the body joined over the views' own bands)
    areas = {}
    for view in ['front', 'q3', 'side', 'r3', 'back']:
        for name, v in json.load(open(os.path.join(MESH, f'{who}-{view}.json')))['pieces'].items():
            c = canon(name)
            if c in TORSO and isinstance(v, list): areas.setdefault(c, {}); areas[c][view] = areas[c].get(view, 0) + Polygon(v).area
    prim = {c: max(a, key=a.get) for c, a in areas.items()}
    for c in ('ring', 'ring.hole'): prim.setdefault(c, 'front')
    WIDE = {'front': (-70, 70), 'q3': (-100, 20), 'side': (20, 150), 'r3': (80, 200), 'back': (110, 250)}
    for view in ['front', 'q3', 'side', 'r3', 'back']:
        T = json.load(open(os.path.join(MESH, f'{who}-{view}.json')))
        jobs = [(False, WIN[view]), (True, MIRROR.get(view, [])), ('prim', [WIDE[view]])]
        for mirror, wins in jobs:
            for (lo, hi) in wins:
                for name, v in T['pieces'].items():
                    c = canon(name)
                    if c not in TORSO: continue
                    if (mirror == 'prim') != (c not in WRAP and prim.get(c) == view): continue
                    if mirror != 'prim' and c not in WRAP: continue
                    if isinstance(v, dict):
                        cx, cy, rx, ry = v['ellipse']; v = [[cx + rx * math.cos(t), cy + ry * math.sin(t)] for t in np.linspace(0, 2 * math.pi, 33)[:-1]]
                    v = list(Polygon(v).buffer(0).simplify(1.0).exterior.coords)[:-1] if len(v) > 3 else v
                    # (the outline resampled every sheet pixel, so its chart outline follows the shell)
                    pts = []
                    for i in range(len(v)):
                        p0, p1 = np.array(v[i]), np.array(v[(i + 1) % len(v)]); m = max(1, int(np.linalg.norm(p1 - p0)))
                        for k in range(m): pts.append(p0 + (p1 - p0) * k / m)
                    u_shift = 0
                    ch = []
                    for u, vv in pts:
                        uu = (2 * C['views'][view]['cx'] - u) if mirror is True else u
                        a, y = to_chart(uu, vv, view, lo, hi, LAYER.get(c, 0.06), mirror is True)
                        ch.append((a * SX, y))
                    P = Polygon(ch).buffer(0)
                    clip = P if mirror == 'prim' else P.intersection(sbox(lo * SX, -99, hi * SX, 99))
                    if clip.is_empty or clip.area < 1e-4: continue
                    charts.setdefault(c, []).append(clip)
                    if mirror is not True and c not in cols:
                        m = np.zeros(SHEET.shape[:2], np.uint8)
                        import cv2; cv2.fillPoly(m, [np.array([[int(x), int(y)] for x, y in v], np.int32)], 1)
                        cols[c] = np.median(SHEET[m > 0], 0).tolist() if m.sum() else [120, 70, 50]
    if os.environ.get('DBG'):
        for c in os.environ['DBG'].split(','):
            for g in charts.get(c, []): print('DBG', c, 'az %.1f..%.1f' % (g.bounds[0] / SX, g.bounds[2] / SX), 'y %.2f..%.2f' % (g.bounds[1], g.bounds[3]), 'area %.3f' % g.area)
    verts, faces = [], []
    def add(pts, piece, col):
        b = len(verts); verts.extend([list(map(lambda x: round(float(x), 4), p)) for p in pts]); faces.append({'v': list(range(b, b + len(pts))), 'col': [round(c) for c in col], 'piece': piece})
    for c, polys in charts.items():
        # (the views' outlines joined and closed over their slips (a little out and back), holes filled, the main part
        # kept with any a quarter its size: a plate is one clean shape, as drawn)
        G = unary_union(polys).buffer(0.06, join_style=2).buffer(-0.06, join_style=2)
        G = [G] if isinstance(G, Polygon) else [g for g in getattr(G, 'geoms', []) if isinstance(g, Polygon)]
        G = [Polygon(g.exterior) for g in G]
        if G: big = max(g.area for g in G); G = [g for g in G if g.area >= 0.25 * big]
        solid(G, LAYER.get(c, 0.06), c, cols.get(c, [120, 70, 50]), lambda x, y, o: point(x / SX, y, o), add, fold=FOLD * SX)
    json.dump({'who': who, 'verts': verts, 'faces': faces}, open(os.path.join(outdir, f'sculpt-{who}.json'), 'w'))
    print(who, len(faces), 'faces', sum(len(f['v']) - 2 for f in faces), 'triangles', sorted(charts))
if __name__ == '__main__':
    for who in (sys.argv[3:] or ['male']): run(sys.argv[1], sys.argv[2], who)
