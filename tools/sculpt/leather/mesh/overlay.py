# a view's traced pieces over the sheet at K x: filled lightly, outlined, named; mirrored pieces (.r -> .l) about x = mirror
import sys, json, numpy as np, cv2
from PIL import Image
SHEET = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../ref/leather-chest.png')
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 4
x0, y0, x1, y1 = J['box']
im = np.array(Image.open(SHEET).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS))[..., ::-1].copy()
P = dict(J['pieces'])
if 'mirror' in J:
    for k, v in list(P.items()):
        if k.endswith('.r'):
            n = k[:-2] + '.l'
            if n in P: continue
            P[n] = {'ellipse': [J['mirror'] - v['ellipse'][0], *v['ellipse'][1:]]} if isinstance(v, dict) else [[J['mirror'] - x, y] for x, y in v]
pal = {}
def col(k):
    base = k.split('.')[0]
    if base not in pal: rng = np.random.default_rng(abs(hash(base)) % 2**32); pal[base] = tuple(int(x) for x in rng.integers(60, 255, 3))
    return pal[base]
fill = im.copy()
for k, v in P.items():
    if isinstance(v, dict):
        cx, cy, rx, ry = v['ellipse']; cv2.ellipse(fill, ((int((cx - x0) * K), int((cy - y0) * K))), (int(rx * K), int(ry * K)), 0, 0, 360, col(k), -1)
    else:
        cv2.fillPoly(fill, [np.array([[(x - x0) * K, (y - y0) * K] for x, y in v], np.int32)], col(k))
im = cv2.addWeighted(fill, 0.3, im, 0.7, 0)
for k, v in P.items():
    if isinstance(v, dict):
        cx, cy, rx, ry = v['ellipse']; cv2.ellipse(im, ((int((cx - x0) * K), int((cy - y0) * K))), (int(rx * K), int(ry * K)), 0, 0, 360, (255, 255, 255), 1); c = (cx, cy)
    else:
        pts = np.array([[(x - x0) * K, (y - y0) * K] for x, y in v], np.int32); cv2.polylines(im, [pts], True, (255, 255, 255), 1)
        for p in pts: cv2.circle(im, tuple(int(a) for a in p), 2, (0, 255, 255), -1)
        c = np.mean(np.array(v), 0)
    cv2.putText(im, k, (int((c[0] - x0) * K) - 14, int((c[1] - y0) * K)), cv2.FONT_HERSHEY_SIMPLEX, 0.33, (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(out, im); print(len(P), 'pieces')
