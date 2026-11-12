# The warhammer's views beside the reference sheet's (tools/sculpt/ref/warhammer-runestone.png), at the sheet's own
# scale, and each orthographic view's outline measured against the sheet's:
#   python3 tools/sculpt/lowhammersheet.py <dir>   reads <dir>/sheet-views.png, sheet-masks.png, sheet-top.png and
#   sheet-details.png (tools/sculpt/lowhammershot.mjs --only sheet); writes <dir>/warhammer-sheet.png (the sheet's front,
#   side 90°, back and side 270° over ours plain and enchanted, the head from above), <dir>/warhammer-outline.png (each
#   view's two outlines laid over each other: the sheet's red, ours cyan, both white), <dir>/warhammer-details.png (the
#   sheet's Key Details over ours) and <dir>/outline.json: each view's IoU (intersection over union of the silhouettes)
#   and edge distance (each outline's pixels to the nearest of the other's, mean and 95th percentile, in the sheet's px;
#   the views are 269 px long), whole and by part (the head, the haft, the pommel), and the lit parts' places.
import sys, json
from PIL import Image, ImageDraw
import numpy as np
d = sys.argv[1]
ref = Image.open(__file__.rsplit('/', 1)[0] + '/ref/warhammer-runestone.png').convert('RGB')
F3, CW, CH = 3, 136 * 3, 290 * 3
GROUND = (39, 21, 19)
FOOT = 368  # the pommel's foot, the sheet's y; U = FOOT - y
CY = FOOT - 134.5
def crop(cx, cy, w, h, f):
    W, H = round(w / f), round(h / f)
    out = Image.new('RGB', (W, H), GROUND)
    x0, y0 = round(cx - W / 2), round(cy - H / 2)
    out.paste(ref.crop((max(0, x0), max(0, y0), min(ref.width, x0 + W), min(ref.height, y0 + H))), (max(0, -x0), max(0, -y0)))
    return out.resize((w, h), Image.LANCZOS)
# the sheet's views, the haft's centre line in each
VIEWS = [('front', 472.5), ('side 90', 608.5), ('back', 742.5), ('side 270', 872.5)]
row = Image.new('RGB', (4 * CW, CH))
for i, (_, cx) in enumerate(VIEWS):
    row.paste(crop(cx, CY, CW, CH, F3), (i * CW, 0))
views = Image.open(d + '/sheet-views.png').convert('RGB')
masks = Image.open(d + '/sheet-masks.png').convert('RGB')
top = Image.open(d + '/sheet-top.png').convert('RGB')
# the sheet's top and bottom of the head, at the sheet's top-view scale
tref = Image.new('RGB', (top.width // 2, top.height), GROUND)
tr = crop(1035, 135, top.width // 2, top.height, F3); tref.paste(tr, (0, 0))
br = crop(1035, 252, top.width // 2, top.height, F3)
out = Image.new('RGB', (4 * CW, 30 + 3 * CH + 30 + 2 * top.height + 30), (30, 26, 28))
out.paste(row, (0, 30)); out.paste(views, (0, 30 + CH))
y = 30 + 3 * CH + 30
out.paste(tref, (0, y)); out.paste(top.crop((0, 0, top.width // 2, top.height)), (top.width // 2, y))
out.paste(br, (0, y + top.height)); out.paste(top.crop((top.width // 2, 0, top.width, top.height)), (top.width // 2, y + top.height))
g = ImageDraw.Draw(out)
for x, yy, t in [(6, 8, 'Sheet: front (0°), side (90°), back (180°), side (270°)'), (6, 30 + CH + 6, 'Ours, plain'), (6, 30 + 2 * CH + 6, 'Ours, enchanted'), (6, y - 22, 'Sheet: the head from above, from below | ours from above, plain and enchanted')]:
    g.text((x, yy), t, fill=(250, 240, 230))
out.save(d + '/warhammer-sheet.png')

# the close-ups: the sheet's Key Details (hub, head plate, hammer face, haft, pommel) over ours enchanted and plain
try:
    det = Image.open(d + '/sheet-details.png').convert('RGB')
    row2 = Image.new('RGB', (1500, 290), GROUND)
    for i, (x0, x1) in enumerate([(852, 986), (997, 1121), (1132, 1253), (1267, 1388), (1400, 1522)]):
        c = ref.crop((x0, 466, x1, 591)); f = min(300 / c.width, 290 / c.height); c = c.resize((round(c.width * f), round(c.height * f)), Image.LANCZOS)
        row2.paste(c, (i * 300 + (300 - c.width) // 2, (290 - c.height) // 2))
    dd = Image.new('RGB', (1500, 3 * 290 + 3 * 22), (30, 26, 28)); g2 = ImageDraw.Draw(dd)
    for r, (im2, t) in enumerate([(row2, 'Sheet: Key Details (central hub, head plate, hammer face, wooden haft, pommel)'), (det.crop((0, 290, 1500, 580)), 'Ours, enchanted'), (det.crop((0, 0, 1500, 290)), 'Ours, plain')]):
        dd.paste(im2, (0, 22 + r * 312)); g2.text((6, 5 + r * 312), t, fill=(250, 240, 230))
    dd.save(d + '/warhammer-details.png')
except FileNotFoundError:
    pass

def edge(m):
    e = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    return np.argwhere(e)
def near(p, q):
    o = np.empty(len(p))
    for i in range(0, len(p), 512):
        dd_ = ((p[i:i + 512, None, :] - q[None, :, :]) ** 2).sum(axis=2)
        o[i:i + 512] = np.sqrt(dd_.min(axis=1))
    return o / F3
def score(a, b, rows):
    A, B = a[rows], b[rows]
    iou = (A & B).sum() / max(1, (A | B).sum())
    ea, eb = edge(A), edge(B)
    if len(ea) == 0 or len(eb) == 0: return {'iou': round(float(iou), 4)}
    da, db = near(ea, eb), near(eb, ea)
    both = np.concatenate([da, db])
    return {'iou': round(float(iou), 4), 'edgeMeanPx': round(float(both.mean()), 2), 'edge95Px': round(float(np.percentile(both, 95)), 2)}
ys = CY + (np.arange(CH) - CH / 2) / F3
U = FOOT - ys
res = {}
ov = np.zeros((CH, 4 * CW, 3), np.uint8)
for i, (name, cx) in enumerate(VIEWS):
    a = np.asarray(crop(cx, CY, CW, CH, F3)).astype(int).max(axis=2) > 60
    a[(ys < 95) | (ys > 372), :] = False
    b = np.abs(np.asarray(masks.crop((i * CW, 0, (i + 1) * CW, CH))).astype(int) - np.array(GROUND)).sum(axis=2) > 30
    res[name] = {'whole': score(a, b, slice(None)), 'head (U 200+)': score(a, b, U >= 200), 'haft (U 29-200)': score(a, b, (U >= 29) & (U < 200)), 'pommel (U < 29)': score(a, b, U < 29), 'areaSheetPx': int(a.sum() / F3 ** 2), 'areaOursPx': int(b.sum() / F3 ** 2)}
    o = ov[:, i * CW:(i + 1) * CW]; o[a & ~b] = (230, 60, 50); o[b & ~a] = (60, 220, 230); o[a & b] = (235, 235, 235)
res['meanIoU'] = round(float(np.mean([res[n]['whole']['iou'] for n, _ in VIEWS])), 4)
Image.fromarray(ov).save(d + '/warhammer-outline.png')

# the lit parts' places: where the sheet's views are lit gold against ours enchanted (the centre of its lit pixels in a
# window round each, the sheet's px: X from the haft's line, U up)
def litc(img, i):
    px = np.asarray(img).astype(int)
    m = (px[:, :, 0] > 235) & (px[:, :, 1] > 150) & (px[:, :, 2] < 150) & (px[:, :, 0] - px[:, :, 2] > 90)
    yy, xx = np.nonzero(m)
    return xx / F3 - CW / 2 / F3, FOOT - (CY + (yy - CH / 2) / F3)
WINDOWS = {'hub star (front)': (0, -14, 14, 220, 248), 'pommel star (front)': (0, -9, 9, 10, 28), 'face star (side 90)': (1, -20, 20, 212, 252), 'face star (side 270)': (3, -20, 20, 212, 252)}
res['glows'] = {}
for name, (vi, x0, x1, u0, u1) in WINDOWS.items():
    SX, SU = litc(crop(VIEWS[vi][1], CY, CW, CH, F3), vi); OX, OU = litc(views.crop((vi * CW, CH, (vi + 1) * CW, 2 * CH)), vi)
    a_ = (SX >= x0) & (SX <= x1) & (SU >= u0) & (SU <= u1); b_ = (OX >= x0) & (OX <= x1) & (OU >= u0) & (OU <= u1)
    if a_.sum() == 0 or b_.sum() == 0: res['glows'][name] = {'sheetPx': int(a_.sum()), 'oursPx': int(b_.sum())}; continue
    s_, o_ = (float(SX[a_].mean()), float(SU[a_].mean())), (float(OX[b_].mean()), float(OU[b_].mean()))
    res['glows'][name] = {'sheet': [round(s_[0], 1), round(s_[1], 1)], 'ours': [round(o_[0], 1), round(o_[1], 1)], 'offPx': round(((s_[0] - o_[0]) ** 2 + (s_[1] - o_[1]) ** 2) ** 0.5, 2), 'litAreaSheet': int(a_.sum() / 9), 'litAreaOurs': int(b_.sum() / 9)}
json.dump(res, open(d + '/outline.json', 'w'), indent=1)
print(json.dumps({n: res[n]['whole'] for n, _ in VIEWS}), 'mean IoU', res['meanIoU'])
print(json.dumps(res['glows']))
print('wrote', d + '/warhammer-sheet.png', d + '/warhammer-outline.png', d + '/warhammer-details.png')
