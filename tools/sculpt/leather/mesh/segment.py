# a view of the sheet split into its pieces by a watershed on the sheet's own edges from seed strokes (one per piece,
# plus background and skin); each piece's outline taken from its region. Writes the regions overlay and the outlines.
#   python3 segment.py seeds.json out.png [outlines.json]
import sys, json, numpy as np, cv2, os
from PIL import Image
from skimage.segmentation import watershed
from skimage.filters import sobel
SHEET = os.environ.get('SHEET', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../ref/leather-chest.png'))
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = 4
x0, y0, x1, y1 = J['box']
rgb = np.array(Image.open(SHEET).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS)).astype(np.float32) / 255
lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
g = sum(sobel(cv2.GaussianBlur(lab[..., c], (0, 0), 1.2)) * w for c, w in [(0, 1.0), (1, 0.6), (2, 0.6)])
# (the drawn strokes: darker than their surroundings, ridges the regions should meet on)
L = lab[..., 0]; dark = np.clip(cv2.GaussianBlur(L, (0, 0), 3) - L, 0, None)
elev = g + float(os.environ.get('DW', '1.0')) * dark
names = list(J['seeds'].keys()); markers = np.zeros(L.shape, np.int32)
T = lambda p: (int(round((p[0] - x0) * K)), int(round((p[1] - y0) * K)))
for i, n in enumerate(names, 1):
    pts = J['seeds'][n]
    for p in pts: cv2.circle(markers, T(p), 3, i, -1)
    for a, b in zip(pts, pts[1:]): cv2.line(markers, T(a), T(b), i, 2)
# (the background and the skin by colour: the figure is what is left; the pieces grow only within it)
R, Gc, B = rgb[..., 0] * 255, rgb[..., 1] * 255, rgb[..., 2] * 255
bgm = (R < 62) & (Gc < 38)
# (only the background reached from the crop's edge: a dark stroke inside the figure is the figure's)
n_, cc = cv2.connectedComponents(bgm.astype(np.uint8), connectivity=4)
edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))) - {0}
bgm = np.isin(cc, list(edge))
skinm = (R > 150) & (Gc > 0.58 * R) & (B > 0.42 * R)
fig = ~bgm & ~skinm
fig = cv2.morphologyEx(fig.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
ib, isk = names.index('bg') + 1, names.index('skin') + 1
markers[markers == ib] = 0; markers[markers == isk] = 0
markers[~fig] = 0
lbl = watershed(elev, markers, mask=fig)
lbl[bgm] = ib; lbl[skinm] = isk
if os.environ.get('RAWOUT'):
    r2 = np.random.default_rng(1).integers(40, 255, (len(names) + 2, 3)).astype(np.uint8); cv2.imwrite(os.environ['RAWOUT'], r2[lbl])
# overlay
vis = (rgb * 255).astype(np.uint8)[..., ::-1].copy(); over = vis.copy()
rng = np.random.default_rng(7); outl = {}; vis_e = np.zeros_like(vis)
for i, n in enumerate(names, 1):
    if n in ('bg', 'skin'): continue
    m = (lbl == i).astype(np.uint8)
    # (the region smoothed: its edge's single-pixel teeth and spikes gone, its corners kept)
    m = (cv2.GaussianBlur(m.astype(np.float32), (0, 0), float(os.environ.get('SM', '3'))) > 0.5).astype(np.uint8)
    col = tuple(int(x) for x in rng.integers(60, 255, 3)); over[m > 0] = col
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs: continue
    c = max(cs, key=cv2.contourArea)
    if n in J.get('fixed', {}):
        outl[n] = J['fixed'][n]; e = J['fixed'][n]['ellipse']; cv2.ellipse(vis_e, T(e[:2]), (int(e[2] * K), int(e[3] * K)), 0, 0, 360, (255, 255, 255), 1, cv2.LINE_AA); continue
    if n in J.get('ellipses', []) and len(c) >= 5:
        (ex, ey), (ew, eh), ang = cv2.fitEllipse(c); a = np.radians(ang)
        outl[n] = {'ellipse': [round(x0 + ex / K, 2), round(y0 + ey / K, 2), round(ew / 2 / K, 2), round(eh / 2 / K, 2)], 'angle': round(float(ang), 1)}
        cv2.ellipse(vis_e, ((ex, ey), (ew, eh), ang), (255, 255, 255), 1, cv2.LINE_AA); continue
    # (the fewest corners whose polygon still covers FIT of the region and adds no more than 1 - FIT outside it)
    area = float(m.sum()); best = None
    for eps in np.arange(0.4, 6.01, 0.2):
        poly = cv2.approxPolyDP(c, eps * K, True)[:, 0]
        if len(poly) < 3: break
        pm = np.zeros_like(m); cv2.fillPoly(pm, [poly], 1)
        inter = float((pm & m).sum()); iou = inter / (area + pm.sum() - inter)
        if iou >= float(os.environ.get('FIT', '0.93')): best = poly
        else: break
    poly = best if best is not None else cv2.approxPolyDP(c, 0.4 * K, True)[:, 0]
    outl[n] = [[round(x0 + p[0] / K, 2), round(y0 + p[1] / K, 2)] for p in poly]
vis = cv2.addWeighted(over, 0.35, vis, 0.65, 0)
vis = np.maximum(vis, vis_e)
for n, P in outl.items():
    if isinstance(P, dict): continue
    pts = np.array([T(p) for p in P], np.int32); cv2.polylines(vis, [pts], True, (255, 255, 255), 1, cv2.LINE_AA)
    c = pts.mean(0).astype(int); cv2.putText(vis, n, (int(c[0]) - 12, int(c[1])), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1, cv2.LINE_AA)
for i, n in enumerate(names, 1):
    for p in J['seeds'][n]: cv2.circle(vis, T(p), 2, (0, 0, 0), -1)
cv2.imwrite(out, vis)
if len(sys.argv) > 3: json.dump({'view': J['view'], 'box': J['box'], 'pieces': outl}, open(sys.argv[3], 'w'), indent=1)
print(len(outl), 'pieces', sum(len(p) for p in outl.values() if isinstance(p, list)), 'corners')
