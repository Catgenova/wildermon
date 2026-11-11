# the sheet's view beside the traced mesh: each piece's faces (the polygon, fan-split into triangles from its centre for
# outlines of more than four corners) drawn as a wireframe over a dimmed sheet
import sys, json, numpy as np, cv2
from PIL import Image
SHEET = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../ref/leather-chest.png')
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 4
x0, y0, x1, y1 = J['box']
src = np.array(Image.open(SHEET).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS))[..., ::-1].copy()
wire = (src * 0.45).astype(np.uint8)
T = lambda p: (int(round((p[0] - x0) * K)), int(round((p[1] - y0) * K)))
for k, v in J['pieces'].items():
    if isinstance(v, dict):
        cx, cy, rx, ry = v['ellipse']; v = [[cx + rx * np.cos(a), cy + ry * np.sin(a)] for a in np.linspace(0, 2 * np.pi, 13)[:-1]]
    pts = np.array([T(p) for p in v], np.int32)
    cv2.polylines(wire, [pts], True, (240, 240, 240), 1, cv2.LINE_AA)
    for p in pts: cv2.circle(wire, tuple(int(a) for a in p), 2, (0, 220, 255), -1, cv2.LINE_AA)
for k, v in J.get('lines', {}).items():
    cv2.polylines(wire, [np.array([T(p) for p in v], np.int32)], False, (120, 200, 255), 1, cv2.LINE_AA)
for d in J.get('dots', []):
    cv2.circle(wire, T(d[:2]), max(2, int(d[2] * K)), (120, 200, 255), 1, cv2.LINE_AA)
both = np.concatenate([src, np.full((src.shape[0], 8, 3), 30, np.uint8), wire], 1)
cv2.putText(both, J['view'] + ': the sheet | the traced mesh', (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(out, both); print(both.shape)
