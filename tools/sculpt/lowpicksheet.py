# The pickaxe's views beside the reference sheet's (tools/sculpt/ref/pickaxe-runestone.png), at the sheet's own scale, and
# its front view's outline measured against the sheet's:
#   python3 tools/sculpt/lowpicksheet.py <dir>   reads <dir>/sheet-views.png, sheet-front-mask.png and sheet-hero.png
#   (tools/sculpt/lowpickshot.mjs --only sheet); writes <dir>/pickaxe-sheet.png (the sheet's front, side and back over ours
#   plain and enchanted; the sheet's hero beside ours), <dir>/pickaxe-outline.png (the two outlines laid over each other:
#   the sheet's red, ours cyan, both white) and <dir>/outline.json: the outlines' IoU (intersection over union of the
#   silhouettes) and their edge distance (each outline's pixels to the nearest of the other's, mean and 95th percentile,
#   in the sheet's px; the front view is 240 px long), whole and by part (the head, the haft, the pommel).
import sys, json
from PIL import Image, ImageDraw
import numpy as np
d = sys.argv[1]
ref = Image.open(__file__.rsplit('/', 1)[0] + '/ref/pickaxe-runestone.png').convert('RGB')
F3, CW, CH = 3, 270 * 3, 273 * 3
GROUND = (39, 21, 19)
def crop(cx, cy, w, h, f):
    W, H = round(w / f), round(h / f)
    out = Image.new('RGB', (W, H), GROUND)
    x0, y0 = round(cx - W / 2), round(cy - H / 2)
    out.paste(ref.crop((max(0, x0), max(0, y0), min(ref.width, x0 + W), min(ref.height, y0 + H))), (max(0, -x0), max(0, -y0)))
    return out.resize((w, h), Image.LANCZOS)
# the sheet's views: the front (haft at x 542.5, our cell round X -34), the side (x 676.5), the back (haft at x 815, the
# pick to the right: round X +34); y 223 the haft's middle (the front's foot y 343, top y 103)
VIEWS = [(542.5 - 34, 223), (676.5, 227), (815 + 34, 223)]
row = Image.new('RGB', (3 * CW, CH))
for i, (cx, cy) in enumerate(VIEWS):
    c = crop(cx, cy, CW, CH, F3)
    # only the view itself: blank the neighbours' strays outside its own column of the sheet
    row.paste(c, (i * CW, 0))
views = Image.open(d + '/sheet-views.png').convert('RGB')
hero = Image.open(d + '/sheet-hero.png').convert('RGB')
href = crop(193, 228, 740, 680, 740 / 370)
out = Image.new('RGB', (3 * CW, 30 + 3 * CH + 30 + hero.height), (30, 26, 28))
out.paste(row, (0, 30)); out.paste(views, (0, 30 + CH))
y = 30 + 3 * CH + 30
out.paste(href, (0, y)); out.paste(hero.crop((0, 0, 740, hero.height)), (740, y)); out.paste(hero.crop((740, 0, 1480, hero.height)), (1480, y))
g = ImageDraw.Draw(out)
for x, yy, t in [(6, 8, 'Sheet: front (0°), side (90°), back (180°)'), (6, 30 + CH + 6, 'Ours, plain'), (6, 30 + 2 * CH + 6, 'Ours, enchanted'), (6, y - 22, 'Sheet: hero'), (746, y - 22, 'Ours, plain'), (1486, y - 22, 'Ours, enchanted')]:
    g.text((x, yy), t, fill=(250, 240, 230))
out.save(d + '/pickaxe-sheet.png')

# the outlines: the sheet's front view (its own pixels, brighter than the ground) against ours (anything off the ground)
a = np.asarray(crop(*VIEWS[0], CW, CH, F3)).astype(int).max(axis=2) > 45
m = np.asarray(Image.open(d + '/sheet-front-mask.png').convert('RGB')).astype(int)
b = np.abs(m - np.array(GROUND)).sum(axis=2) > 30
# the sheet's view alone: nothing of its neighbours (the side view starts 112 px right of the haft)
xs = (np.arange(CW) - CW / 2) / F3 - 34
ys = 223 + (np.arange(CH) - CH / 2) / F3
a[:, xs > 98] = False; b[:, xs > 98] = False
# (and nothing of the panel's frame, its title or the view's caption: the sheet's x 392 on, y 99 to 347)
a[:, xs + 542.5 < 392] = False; a[(ys < 99) | (ys > 347), :] = False
def edge(m):
    e = m & ~(np.roll(m, 1, 0) & np.roll(m, -1, 0) & np.roll(m, 1, 1) & np.roll(m, -1, 1))
    return np.argwhere(e)
def near(p, q):
    out = np.empty(len(p))
    for i in range(0, len(p), 512):
        dd = ((p[i:i + 512, None, :] - q[None, :, :]) ** 2).sum(axis=2)
        out[i:i + 512] = np.sqrt(dd.min(axis=1))
    return out / F3
def score(rows):
    A, B = a[rows], b[rows]
    iou = (A & B).sum() / max(1, (A | B).sum())
    ea, eb = edge(A), edge(B)
    if len(ea) == 0 or len(eb) == 0: return {'iou': round(float(iou), 4)}
    da, db = near(ea, eb), near(eb, ea)
    both = np.concatenate([da, db])
    return {'iou': round(float(iou), 4), 'edgeMeanPx': round(float(both.mean()), 2), 'edge95Px': round(float(np.percentile(both, 95)), 2), 'sheetToOursMeanPx': round(float(da.mean()), 2), 'oursToSheetMeanPx': round(float(db.mean()), 2)}
# rows by U: the sheet's y = 223 + (row - CH/2) / F3; U = 343 - y
U = 343 - (223 + (np.arange(CH) - CH / 2) / F3)
res = {'whole': score(slice(None)), 'head (U 165-240)': score(U >= 165), 'haft (U 23-165)': score((U >= 23) & (U < 165)), 'pommel (U < 23)': score(U < 23)}
res['areaSheetPx'] = int(a.sum() / F3 ** 2); res['areaOursPx'] = int(b.sum() / F3 ** 2)
# the hero: a three-quarter in the sheet's own perspective, ours orthographic; each outline cut to its bounds and both
# set to 120 px square, then their IoU, and the bounds' aspects (width over height)
def bounds(m):
    ys, xs = np.nonzero(m)
    c = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return np.asarray(Image.fromarray((c * 255).astype(np.uint8)).resize((120, 120))) > 127, round(float((xs.max() - xs.min() + 1) / (ys.max() - ys.min() + 1)), 3)
hs, hsa = bounds(np.asarray(ref).astype(int)[66:390, 16:376].max(axis=2) > 70)
ho, hoa = bounds(np.abs(np.asarray(hero.crop((0, 0, 740, hero.height))).astype(int) - np.array(GROUND)).sum(axis=2) > 30)
res['hero'] = {'iou': round(float((hs & ho).sum() / (hs | ho).sum()), 4), 'aspectSheet': hsa, 'aspectOurs': hoa}
json.dump(res, open(d + '/outline.json', 'w'), indent=1)
print(json.dumps(res))
ov = np.zeros((CH, CW, 3), np.uint8); ov[a & ~b] = (230, 60, 50); ov[b & ~a] = (60, 220, 230); ov[a & b] = (235, 235, 235)
Image.fromarray(ov).save(d + '/pickaxe-outline.png')
print('wrote', d + '/pickaxe-sheet.png', d + '/pickaxe-outline.png')
