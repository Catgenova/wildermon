"""The painted body (tools/sculpt/lowlchestpaint.mjs) drawn in each of the sheet's views beside the sheet's own crop:
each small triangle filled in its piece's colour where the paint put a piece, the bare body grey.

  python3 tools/sculpt/lowlchestpaint.py <paint-who.json> <out.png> [K]
"""
import sys, json, os, zlib, numpy as np, cv2
from PIL import Image
SHEET = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ref/leather-chest.png')
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 3
sheet = Image.open(SHEET).convert('RGB')
def col(n):
    if n == '-': return (120, 120, 120)
    h = zlib.crc32(n.split('.')[0].encode()); rng = np.random.default_rng(h)
    c = rng.integers(70, 255, 3); return tuple(int(x) for x in c)
rows = []
for view in ['front', 'q3', 'side', 'r3', 'back']:
    V = J['views'][view]; x0, y0, x1, y1 = V['box']
    src = np.array(sheet.crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS))[..., ::-1].copy()
    pnt = np.full_like(src, 40)
    for s, t in V['tris']:
        lab = J['labels'][s]; pts = np.array([[(p[0] - x0) * K, (p[1] - y0) * K] for p in t], np.int32)
        cv2.fillConvexPoly(pnt, pts, col(lab)[::-1], cv2.LINE_AA)
    rows.append(np.concatenate([src, np.full((src.shape[0], 4, 3), 30, np.uint8), pnt], 1))
H = max(r.shape[0] for r in rows); rows = [np.pad(r, ((0, H - r.shape[0]), (0, 0), (0, 0))) for r in rows]
img = np.concatenate([np.concatenate([r, np.full((H, 10, 3), 30, np.uint8)], 1) for r in rows], 1)
cv2.imwrite(out, img); print(img.shape)
