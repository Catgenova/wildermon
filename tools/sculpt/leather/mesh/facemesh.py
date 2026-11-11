# a view's trace made into faces: each plate a bevel band round its outline (quads to a mitred inset) and its face inside
# (triangulated); each ring outer bevel, flat band and hole (N sides); trim lines and lacing thin strips; rivets small
# fans. Draws the faces as a wireframe over the dimmed sheet beside the sheet, and counts the triangles.
#   python3 facemesh.py view.json out.png [K] [--json faces.json]
import os, sys, json, math, numpy as np, cv2, mapbox_earcut as earcut, triangle as tr
from PIL import Image
import os
SHEET = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../ref/leather-chest.png')
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else 4
RING_N = 16
def area(P): return 0.5 * sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))
def inset(P, b):
    n = len(P); s = 1 if area(P) > 0 else -1; out = []
    for i in range(n):
        a, p, c = np.array(P[i - 1]), np.array(P[i]), np.array(P[(i + 1) % n])
        e1, e2 = p - a, c - p
        n1 = np.array([-e1[1], e1[0]]) * s / (np.linalg.norm(e1) + 1e-9); n2 = np.array([-e2[1], e2[0]]) * s / (np.linalg.norm(e2) + 1e-9)
        m = n1 + n2; m /= (np.linalg.norm(m) + 1e-9); d = b / max(0.35, float(np.dot(m, n1)))
        out.append((p + m * min(d, 2.5 * b)).tolist())
    return out
faces = []  # (kind, [points])
from shapely.geometry import Polygon, LineString
def strips(P):
    # (slices across the polygon's long axis through each corner and every GRID between; each slice cut into the same
    # number of points, quads between neighbours; None where a slice meets the outline other than in one segment)
    A = np.array(P); c = A.mean(0); w, V = np.linalg.eigh(np.cov((A - c).T)); ax = V[:, 1]; nx = V[:, 0]
    t = (A - c) @ ax; lo, hi = t.min(), t.max(); poly = Polygon(P)
    if not poly.is_valid: return None
    ts = sorted(set([round(x, 4) for x in t] + [round(x, 4) for x in np.arange(lo, hi, GRID)[1:]]))
    ts2 = [ts[0]]
    for x in ts[1:]:
        if x - ts2[-1] > 0.6: ts2.append(x)
        else: ts2[-1] = x if x == hi else ts2[-1]
    ts = ts2
    if len(ts) < 2: return None
    width = 0; segs = []
    for x in ts:
        x = min(max(x, lo + 1e-3), hi - 1e-3); o = c + ax * x; L = LineString([o - nx * 1e4, o + nx * 1e4]); g = L.intersection(poly.buffer(1e-6))
        if g.geom_type != 'LineString' or g.length < 1e-6:
            if g.is_empty: return None
            if g.geom_type == 'Point' or g.length < 1e-6: g = LineString([g.coords[0] if g.geom_type != 'Point' else (g.x, g.y)] * 2) if g.geom_type == 'Point' else g
            else: return None
        a, b2 = np.array(g.coords[0]), np.array(g.coords[-1])
        if (a - c) @ nx > (b2 - c) @ nx: a, b2 = b2, a
        segs.append((a, b2)); width = max(width, np.linalg.norm(b2 - a))
    m = max(1, int(round(width / GRID)))
    G = [[(a + (b2 - a) * (i / m)).tolist() for i in range(m + 1)] for a, b2 in segs]
    quads = []
    for j in range(len(G) - 1):
        for i in range(m):
            q = [G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]]
            qq = [p for k, p in enumerate(q) if np.linalg.norm(np.array(p) - np.array(q[k - 1])) > 1e-3]
            if len(qq) >= 3: quads.append(qq)
    ring = [G[0][i] for i in range(m + 1)] + [G[j][m] for j in range(1, len(G))] + [G[-1][i] for i in range(m - 1, -1, -1)] + [G[j][0] for j in range(len(G) - 2, 0, -1)]
    R2 = [ring[0]]
    for p in ring[1:]:
        if np.linalg.norm(np.array(p) - np.array(R2[-1])) > 1e-3: R2.append(p)
    return quads, R2
def outer_of(p, I, v):
    # (the outline point for an inset point: on the inset edge it lies on, the same share along the outline's edge)
    p = np.array(p); best = None
    for i in range(len(I)):
        a, b2 = np.array(I[i]), np.array(I[(i + 1) % len(I)]); d = b2 - a; L = d @ d
        t = 0 if L < 1e-12 else max(0, min(1, (p - a) @ d / L)); e = np.linalg.norm(a + d * t - p)
        if best is None or e < best[0]: best = (e, i, t)
    _, i, t = best; a, b2 = np.array(v[i]), np.array(v[(i + 1) % len(v)])
    return (a + (b2 - a) * t).tolist()
MAXA = float(os.environ.get('MAXA', '30'))  # the largest face triangle (square sheet px)
def tri_fill(P, kind, quality=True):
    n = len(P)
    if quality:
        try:
            t = tr.triangulate({'vertices': np.array(P, float), 'segments': np.array([[i, (i + 1) % n] for i in range(n)])}, f'pq28a{MAXA}Y')
            V = t['vertices'].tolist()
            for a, b, c in t['triangles']: faces.append((kind, [V[a], V[b], V[c]]))
            return
        except Exception as e: pass
    idx = earcut.triangulate_float32(np.array(P, np.float32).reshape(-1, 2), np.array([len(P)], np.uint32))
    for i in range(0, len(idx), 3): faces.append((kind, [P[idx[i]], P[idx[i + 1]], P[idx[i + 2]]]))
EDGE = float(os.environ.get('EDGE', '6'))
GRID = float(os.environ.get('GRID', '7'))  # a quad grid's cell (sheet px)  # outline edges split to at most this (sheet px)
def resample(P):
    out = []
    for i in range(len(P)):
        a, c = np.array(P[i]), np.array(P[(i + 1) % len(P)]); m = max(1, int(math.ceil(np.linalg.norm(c - a) / EDGE)))
        for k in range(m): out.append((a + (c - a) * k / m).tolist())
    return out
for k, v in J['pieces'].items():
    if isinstance(v, dict):
        cx, cy, rx, ry = v['ellipse']
        ring = lambda f: [[cx + rx * f * math.cos(2 * math.pi * i / RING_N), cy + ry * f * math.sin(2 * math.pi * i / RING_N)] for i in range(RING_N)]
        if k.endswith('hole'): tri_fill(ring(1), 'hole', False); continue
        R = [ring(1), ring(0.88), ring(0.62), ring(0.52)] if not k.startswith('ring.') or k == 'ring' else [ring(1), ring(0.85), ring(0.6)]
        for a, b in zip(R, R[1:]):
            for i in range(RING_N): j = (i + 1) % RING_N; faces.append(('ring', [a[i], a[j], b[j], b[i]]))
        continue
    b = max(0.6, min(1.4, 0.11 * math.sqrt(abs(area(v)))))
    if len(v) == 4:
        # (a four-cornered plate: a quad grid, its rows and columns as long as the sides allow, the outer ring the bevel)
        I = inset(v, b); A, B, C, Dd = [np.array(p) for p in I]
        nu = max(1, round(max(np.linalg.norm(B - A), np.linalg.norm(C - Dd)) / GRID)); nv = max(1, round(max(np.linalg.norm(Dd - A), np.linalg.norm(C - B)) / GRID))
        G = [[(A + (B - A) * (i / nu)) * (1 - j / nv) + (Dd + (C - Dd) * (i / nu)) * (j / nv) for i in range(nu + 1)] for j in range(nv + 1)]
        for j in range(nv):
            for i in range(nu): faces.append(('face', [G[j][i].tolist(), G[j][i + 1].tolist(), G[j + 1][i + 1].tolist(), G[j + 1][i].tolist()]))
        ring_in = [G[0][i].tolist() for i in range(nu)] + [G[j][nu].tolist() for j in range(nv)] + [G[nv][i].tolist() for i in range(nu, 0, -1)] + [G[j][0].tolist() for j in range(nv, 0, -1)]
        ring_out = []
        for (a, c), m in [((0, 1), nu), ((1, 2), nv), ((2, 3), nu), ((3, 0), nv)]:
            pa, pc = np.array(v[a]), np.array(v[c])
            for k in range(m): ring_out.append((pa + (pc - pa) * k / m).tolist())
        for i in range(len(ring_in)): jn = (i + 1) % len(ring_in); faces.append(('bevel', [ring_out[i], ring_out[jn], ring_in[jn], ring_in[i]]))
        continue
    I = inset(v, b)
    S = strips(I)
    if S is None:
        v = resample(v); I = inset(v, b)
        for i in range(len(v)): j = (i + 1) % len(v); faces.append(('bevel', [v[i], v[j], I[j], I[i]]))
        tri_fill(I, 'face'); continue
    quads, ring_in = S
    faces.extend(('face', q) for q in quads)
    # (the bevel: the outline's points matched to the inset ring's, each inset point to the outline point it came from
    # or the outline's point at the same place along the edge)
    ring_out = [outer_of(p, I, v) for p in ring_in]
    for i in range(len(ring_in)): jn = (i + 1) % len(ring_in); faces.append(('bevel', [ring_out[i], ring_out[jn], ring_in[jn], ring_in[i]]))
for k, v in J.get('lines', {}).items():
    w = 0.6 if 'lace' not in k else 0.8
    for a, c in zip(v, v[1:]):
        a, c = np.array(a), np.array(c); d = c - a; nrm = np.array([-d[1], d[0]]) / (np.linalg.norm(d) + 1e-9) * w
        faces.append(('trim', [(a + nrm).tolist(), (c + nrm).tolist(), (c - nrm).tolist(), (a - nrm).tolist()]))
for x, y, r in J.get('dots', []):
    pts = [[x + r * math.cos(2 * math.pi * i / 6), y + r * math.sin(2 * math.pi * i / 6)] for i in range(6)]
    for i in range(6): faces.append(('rivet', [[x, y], pts[i], pts[(i + 1) % 6]]))
ntri = sum(len(f) - 2 for _, f in faces)
# (each plate's outline also gets its thickness in 3D: two triangles per outline edge)
nedge = sum(len([f for f in faces if f[0] == 'bevel']) for _ in [0])
x0, y0, x1, y1 = J['box']
src = np.array(Image.open(SHEET).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS))[..., ::-1].copy()
wire = (src * 0.4).astype(np.uint8)
T = lambda p: [int(round((p[0] - x0) * K)), int(round((p[1] - y0) * K))]
COL = {'bevel': (170, 170, 170), 'face': (240, 240, 240), 'ring': (120, 200, 255), 'hole': (120, 200, 255), 'trim': (90, 170, 255), 'rivet': (90, 220, 255)}
for kind, f in faces: cv2.polylines(wire, [np.array([T(p) for p in f], np.int32)], True, COL[kind], 1, cv2.LINE_AA)
both = np.concatenate([src, np.full((src.shape[0], 8, 3), 30, np.uint8), wire], 1)
cv2.putText(both, f"{J['view']}: {ntri} triangles on the faces seen (+{2 * nedge} for the plates' thickness)", (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(out, both)
if '--json' in sys.argv: json.dump([{'kind': k, 'p': f} for k, f in faces], open(sys.argv[sys.argv.index('--json') + 1], 'w'))
print('faces', len(faces), 'triangles', ntri, 'thickness', 2 * nedge)
