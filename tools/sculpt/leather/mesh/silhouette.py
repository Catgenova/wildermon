"""Each view's figure outline on the sheet (everything that is not the background reached from the crop's edge), as
row runs for tools/sculpt/lowlchestenv.mjs: silhouettes.json { who: { view: { box, runs: per sheet row (y0 + i) the
[x0, x1) runs } } }.

  python3 tools/sculpt/leather/mesh/silhouette.py
"""
import json, os, numpy as np, cv2
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
im = np.array(Image.open(os.path.join(D, '../../ref/leather-chest.png')).convert('RGB')).astype(int)
out = {}
for who in ['male', 'female']:
    out[who] = {}
    for view in ['front', 'q3', 'side', 'r3', 'back']:
        x0, y0, x1, y1 = json.load(open(os.path.join(D, f'{who}-{view}.json')))['box']
        c = im[y0:y1, x0:x1]; bg = ((c[..., 0] < 62) & (c[..., 1] < 38)).astype(np.uint8)
        n, cc = cv2.connectedComponents(bg, connectivity=4)
        edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))) - {0}
        fig = (~np.isin(cc, list(edge))).astype(np.uint8)
        fig = cv2.morphologyEx(fig, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        runs = []
        for row in fig:
            r, x = [], 0
            while x < len(row):
                if row[x]:
                    s = x
                    while x < len(row) and row[x]: x += 1
                    r.append([x0 + s, x0 + x])
                else: x += 1
            runs.append(r)
        out[who][view] = {'box': [x0, y0, x1, y1], 'runs': runs}
json.dump(out, open(os.path.join(D, 'silhouettes.json'), 'w'))
print('ok')
