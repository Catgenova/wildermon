# a region of the sheet at K x with a labelled grid (every 5 sheet px, labels every 10) and a view's traced pieces drawn
# over it as thin outlines (pieces: polygons or ellipses; lines: open polylines; dots: [x, y, r])
import sys, json, numpy as np, cv2
from PIL import Image
SHEET = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../ref/leather-chest.png')
J = json.load(open(sys.argv[1])); x0, y0, x1, y1 = map(float, sys.argv[2].split(',')); out = sys.argv[3]; K = int(sys.argv[4]) if len(sys.argv) > 4 else 8
X0, Y0 = int(x0), int(y0); X1, Y1 = int(x1), int(y1)
im = np.array(Image.open(SHEET).convert('RGB').crop((X0, Y0, X1, Y1)).resize(((X1 - X0) * K, (Y1 - Y0) * K), Image.LANCZOS))[..., ::-1].copy()
T = lambda p: (int(round((p[0] - X0) * K)), int(round((p[1] - Y0) * K)))
for x in range((X0 // 5 + 1) * 5, X1, 5):
    c = (90, 90, 60) if x % 10 else (140, 140, 70); cv2.line(im, T((x, Y0)), T((x, Y1)), c, 1)
    if x % 10 == 0: cv2.putText(im, str(x), (T((x, Y0))[0] + 2, 10), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 255), 1)
for y in range((Y0 // 5 + 1) * 5, Y1, 5):
    c = (90, 90, 60) if y % 10 else (140, 140, 70); cv2.line(im, T((X0, y)), T((X1, y)), c, 1)
    if y % 10 == 0: cv2.putText(im, str(y), (2, T((X0, y))[1] - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 255), 1)
for k, v in J['pieces'].items():
    if isinstance(v, dict):
        cx, cy, rx, ry = v['ellipse']; cv2.ellipse(im, T((cx, cy)), (int(rx * K), int(ry * K)), 0, 0, 360, (0, 255, 0), 1, cv2.LINE_AA); c = (cx, cy)
    else:
        pts = np.array([T(p) for p in v], np.int32); cv2.polylines(im, [pts], True, (0, 255, 0), 1, cv2.LINE_AA)
        for p in pts: cv2.circle(im, tuple(int(a) for a in p), 2, (0, 0, 255), -1)
        c = np.mean(np.array(v), 0)
    if X0 <= c[0] <= X1 and Y0 <= c[1] <= Y1: cv2.putText(im, k, T(c), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1, cv2.LINE_AA)
for k, v in J.get('lines', {}).items():
    cv2.polylines(im, [np.array([T(p) for p in v], np.int32)], False, (255, 0, 255), 1, cv2.LINE_AA)
for d in J.get('dots', []):
    cv2.circle(im, T(d[:2]), int(d[2] * K), (255, 255, 0), 1, cv2.LINE_AA)
cv2.imwrite(out, im)
