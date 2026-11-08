# The side braid's scalp map: the crown's lines over her skull seen from above (tools/sculpt/lowbraidlift.mjs mapOfDir:
# each direction's angle from straight up laid off toward its heading; her face at the top, her right at the right; the
# rings 30, 60, 90 and 120 degrees from straight up). Draws the traced lines lifted onto the hull (tools/sculpt/hairs/braid-lifted.json,
# tools/sculpt/lowbraidlift.mjs), each run in its line's colour, its view's mark at its start (F front, Q three-quarter,
# P profile, R rear three-quarter, B back), and, if given, the style's lines and clumps (tools/sculpt/hairs/braid-map.json,
# written by tools/sculpt/lowbraid.mjs --map: each clump's run as an arrow, front to back).
#
#   python3 tools/sculpt/lowbraidmap.py <png>
import json, os, sys
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(D, 'hairs/braid-lifted.json')))
M = json.load(open(os.path.join(D, 'hairs/braid-map.json'))) if os.path.exists(os.path.join(D, 'hairs/braid-map.json')) else None
K, R0, PAD = 3.2, 135, 40
Wd = Hd = int(2 * R0 * K + 2 * PAD)
img = Image.new('RGB', (Wd, Hd + 30), (34, 28, 31)); d = ImageDraw.Draw(img)
at = lambda e, n: (Wd / 2 + e * K, 30 + Hd / 2 - n * K)
for r in (30, 60, 90, 120):
    x0, y0 = at(-r, r); x1, y1 = at(r, -r); d.ellipse([x0, y0, x1, y1], outline=(70, 60, 64)); d.text((at(0, r)[0] + 3, at(0, r)[1] + 2), f'{r}', fill=(150, 140, 135))
d.line([at(-R0, 0), at(R0, 0)], fill=(60, 52, 56)); d.line([at(0, -R0), at(0, R0)], fill=(60, 52, 56))
d.text((PAD, 8), 'Scalp map from above: her face up, her right to the right', fill=(240, 225, 210))
for name, (e, n) in {'brow': (0, 80), 'crown': (0, 0), 'nape': (0, -110), 'her right ear': (95, 5), 'her left ear': (-95, 5)}.items():
    x, y = at(e, n); d.text((x - 20, y - 6), name, fill=(130, 120, 115))
pal = [(255, 230, 60), (60, 230, 255), (120, 255, 120), (255, 140, 255), (255, 170, 80), (160, 160, 255), (255, 255, 255), (80, 255, 200), (255, 100, 100), (200, 255, 80), (100, 200, 255), (255, 200, 200), (200, 140, 255), (140, 255, 255)]
MARK = {'front': 'F', 'q3': 'Q', 'profile': 'P', 'r3': 'R', 'back': 'B'}
if M:
    for k, ln in enumerate(M.get('lines', {}).items()):
        name, pts = ln
        d.line([at(o, u) for o, u in pts], fill=(150, 140, 135), width=5)
    for cl in M.get('clumps', []):
        pts = cl['run']
        d.line([at(o, u) for o, u in pts], fill=tuple(cl.get('col', (255, 255, 255))), width=2)
        (o0, u0), (o1, u1) = pts[-2], pts[-1]; x1, y1 = at(o1, u1)
        d.ellipse([x1 - 4, y1 - 4, x1 + 4, y1 + 4], fill=tuple(cl.get('col', (255, 255, 255))))
        x, y = at(*pts[len(pts) // 2]); d.text((x + 4, y + 2), cl['id'], fill=tuple(cl.get('col', (255, 255, 255))))
for k, (name, ln) in enumerate(L.items()):
    c = pal[k % len(pal)]
    for v, runs in ln['runs'].items():
        for run in runs:
            seg = []
            for p in run + [None]:
                if p is None:
                    if len(seg) > 1: d.line([at(*q) for q in seg], fill=c, width=2)
                    seg = []
                else: seg.append(p)
            first = next((p for p in run if p), None)
            if first: x, y = at(*first); d.text((x - 3, y - 12), MARK[v], fill=c)
    if ln['pts']:
        x, y = at(*ln['pts'][len(ln['pts']) // 2]); d.text((x + 5, y + 4), name, fill=c)
img.save(sys.argv[1])
