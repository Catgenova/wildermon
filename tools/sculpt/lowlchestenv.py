"""The envelope (tools/sculpt/lowlchestenv.mjs) against the sheet's armour outline, per view: green where both are,
red the envelope alone, blue the sheet's armour alone (from the approved trace); the agreement (IoU) per view.

  python3 tools/sculpt/lowlchestenv.py <env-who.json> <out.png> [K]
"""
import sys, json, os, numpy as np, cv2
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); SHEET = os.path.join(D, 'ref/leather-chest.png')
J = json.load(open(sys.argv[1])); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 3
sheet = Image.open(SHEET).convert('RGB'); rows = []; ious = []
SIL = json.load(open(os.path.join(D, 'leather/mesh/silhouettes.json'))); CHIN = {'male': 132, 'female': 466}
for view in ['front', 'q3', 'side', 'r3', 'back']:
    V = J['views'][view]; x0, y0, x1, y1 = V['box']; W, H = (x1 - x0) * K, (y1 - y0) * K
    T = json.load(open(os.path.join(D, f"leather/mesh/{J['who']}-{view}.json")))
    sm = np.zeros((H, W), np.uint8)
    for i, r in enumerate(SIL[J['who']][view]['runs']):
        for a, b in r: sm[i * K:(i + 1) * K, (a - x0) * K:(b - x0) * K] = 1
    # (the head left out: the sheet draws it smaller than the body's; compared from the collar's top down)
    top = int((CHIN[J['who']] - y0) * K); sm[:top] = 0
    em = np.zeros((H, W), np.uint8)
    for t in V['tris']: cv2.fillConvexPoly(em, np.array([[(p[0] - x0) * K, (p[1] - y0) * K] for p in t], np.int32), 1)
    em[:top] = 0
    src = np.array(sheet.crop((x0, y0, x1, y1)).resize((W, H), Image.LANCZOS))[..., ::-1]
    vis = (src * 0.35).astype(np.uint8)
    vis[(sm > 0) & (em > 0)] = (80, 200, 80); vis[(sm == 0) & (em > 0)] = (60, 60, 230); vis[(sm > 0) & (em == 0)] = (230, 120, 50)
    iou = ((sm > 0) & (em > 0)).sum() / max(1, ((sm > 0) | (em > 0)).sum()); ious.append(iou)
    cv2.putText(vis, f'{view} IoU {iou:.3f}', (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    rows.append(np.concatenate([src, np.full((H, 4, 3), 30, np.uint8), vis], 1))
Hm = max(r.shape[0] for r in rows); rows = [np.pad(r, ((0, Hm - r.shape[0]), (0, 0), (0, 0))) for r in rows]
cv2.imwrite(out, np.concatenate([np.concatenate([r, np.full((Hm, 10, 3), 30, np.uint8)], 1) for r in rows], 1))
print(J['who'], ' '.join(f'{v}:{i:.3f}' for v, i in zip(['front', 'q3', 'side', 'r3', 'back'], ious)))
