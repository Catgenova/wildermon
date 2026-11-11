"""The leather chest sheet cut into its pieces (tools/sculpt/ref/leather-chest.png, 1536 x 1024), five views per body: each
pixel of the figure given to one piece of the armour, for tools/sculpt/lowleatherchestfit.mjs to fit each plate to its own
outline.

  python3 tools/sculpt/lowleatherchestmask.py [<preview png>]

  figure    not the background (within BG_D of its colour) and not skin (green over 0.6 of red, blue over 0.42 of red)
  barriers  the trim (the raised strips, the lacing, the emblem: saturation over 0.55, hue 12-38, value over 0.72), the drawn strokes (luminance STROKE under its 7 px box mean) and the cuts drawn by hand
            (tools/sculpt/leather/chest-seeds.json `cuts`: polylines, per body and view)
  seeds     per body, view and piece, points or discs ([x, y] or [x, y, r]) on the sheet, by hand
  labels    each figure pixel the piece whose seeds reach it cheapest: a step onto a plain pixel costs 1, onto a barrier
            4 (so a plate's own face is its seeds' and a rim between two plates is split down its middle)

Writes tools/sculpt/leather/chest-labels.png (each pixel its piece's index in PIECES plus 1, 0 the background) and
tools/sculpt/leather/chest-masks.json ({ pieces, views: { who: { view: { box: [x0, y0, x1, y1], runs: per row
[x0, x1, piece index + 1, ...] from the box's left } } } }); with a preview path, the
sheet's views at 2x with the pieces coloured over them and their outlines, the seeds as dots.
"""
import heapq, json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(D, 'ref/leather-chest.png')
SEEDS = json.load(open(os.path.join(D, 'leather/chest-seeds.json')))
# the views' boxes on the sheet (x0, y0, x1, y1)
BOX = {'male': {'front': (18, 98, 228, 348), 'q3': (222, 98, 388, 348), 'side': (388, 98, 490, 348), 'r3': (488, 98, 656, 348), 'back': (654, 98, 830, 348)},
       'female': {'front': (18, 432, 228, 662), 'q3': (222, 432, 388, 662), 'side': (388, 432, 490, 662), 'r3': (488, 432, 656, 662), 'back': (654, 432, 830, 662)}}
PIECES = ['collar', 'chest', 'back', 'belt', 'skirt.f', 'skirt.b',
          *[f'{p}.{s}' for p in ['side', 'skirtU', 'skirtL', 'pauldron', 'plame1', 'plame2', 'sleeve', 'bracer', 'band'] for s in 'lr']]
BG_D, STROKE, COST = 0.06, 0.06, 4

im = np.asarray(Image.open(SHEET).convert('RGB')).astype(float) / 255
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1); sat = (mx - mn) / np.maximum(mx, 1e-6); dd = np.maximum(mx - mn, 1e-6)
hue = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
lum = 0.3 * r + 0.59 * g + 0.11 * b
blur = np.asarray(Image.fromarray((lum * 255).astype('uint8')).filter(ImageFilter.BoxBlur(3))).astype(float) / 255
BGC = np.array([47, 29, 28]) / 255
bg = np.sqrt(((im - BGC) ** 2).sum(-1)) < BG_D
skin = (g > 0.6 * r) & (b > 0.42 * r) & (r > 0.3)
gold = (sat > 0.55) & (hue > 12) & (hue < 38) & (mx > 0.72)
stroke = lum < blur - STROKE

labels = np.zeros(lum.shape, np.uint8)
for who, views in BOX.items():
    for view, (x0, y0, x1, y1) in views.items():
        H, W = y1 - y0, x1 - x0
        fig = ~(bg | skin)[y0:y1, x0:x1]
        # (the figure only: the largest piece of it, so the sheet's frames and labels in the box are left out)
        bar = (gold | stroke)[y0:y1, x0:x1].copy()
        cut = Image.new('L', (W, H)); dc = ImageDraw.Draw(cut)
        for line in SEEDS.get('cuts', {}).get(who, {}).get(view, []):
            dc.line([(x - x0, y - y0) for x, y in line], fill=255, width=1)
        cutm = np.asarray(cut) > 0
        cost = np.where(bar, COST, 1) + np.where(cutm, 40, 0)
        dist = np.full((H, W), np.inf); lab = np.zeros((H, W), np.uint8); hq = []
        for piece, pts in SEEDS[who].get(view, {}).items():
            k = PIECES.index(piece) + 1
            for p in pts:
                x, y = p[0] - x0, p[1] - y0; rr = p[2] if len(p) > 2 else 0
                for yy in range(int(y - rr), int(y + rr) + 1):
                    for xx in range(int(x - rr), int(x + rr) + 1):
                        if 0 <= yy < H and 0 <= xx < W and (xx - x) ** 2 + (yy - y) ** 2 <= rr * rr + 0.5 and fig[yy, xx]:
                            dist[yy, xx] = 0; lab[yy, xx] = k; heapq.heappush(hq, (0.0, yy, xx))
        while hq:
            dv, y, x = heapq.heappop(hq)
            if dv > dist[y, x]: continue
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and fig[yy, xx]:
                    nd = dv + cost[yy, xx]
                    if nd < dist[yy, xx]: dist[yy, xx] = nd; lab[yy, xx] = lab[y, x]; heapq.heappush(hq, (nd, yy, xx))
        # (the drawn strokes between plates are as dark as the background: the figure's slits up to about 2 px across
        # closed and its holes filled, each such pixel given to the nearest piece)
        def mx(m, k): return np.asarray(Image.fromarray(m.astype('uint8') * 255).filter(ImageFilter.MaxFilter(k))) > 0
        def mn(m, k): return np.asarray(Image.fromarray(m.astype('uint8') * 255).filter(ImageFilter.MinFilter(k))) > 0
        sk = skin[y0:y1, x0:x1]
        full = mn(mx(lab > 0, 5), 5) | (lab > 0)
        out = np.zeros_like(full); out[0, :] = out[-1, :] = out[:, 0] = out[:, -1] = True; out &= ~full
        while True:
            grow = out.copy(); grow[1:] |= out[:-1]; grow[:-1] |= out[1:]; grow[:, 1:] |= out[:, :-1]; grow[:, :-1] |= out[:, 1:]
            grow &= ~full
            if (grow == out).all(): break
            out = grow
        full = ~out & ~sk
        for _ in range(12):
            todo = full & (lab == 0)
            if not todo.any(): break
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nb = np.roll(np.roll(lab, dy, 0), dx, 1)
                lab = np.where(todo & (lab == 0) & (nb > 0), nb, lab)
        fig = fig | (full & (lab > 0))
        labels[y0:y1, x0:x1] = np.where(fig, lab, 0)

Image.fromarray(labels).save(os.path.join(D, 'leather/chest-labels.png'))
def runs(L):
    out = []
    for row in L:
        rr, x = [], 0
        while x < len(row):
            k = int(row[x]); x1 = x
            while x1 < len(row) and row[x1] == k: x1 += 1
            if k: rr += [x, x1, k]
            x = x1
        out.append(rr)
    return out
json.dump({'pieces': PIECES, 'views': {w: {v: {'box': list(b), 'runs': runs(labels[b[1]:b[3], b[0]:b[2]])} for v, b in vs.items()} for w, vs in BOX.items()}}, open(os.path.join(D, 'leather/chest-masks.json'), 'w'), separators=(',', ':'))

if len(sys.argv) > 1:
    K = 2
    rng = np.random.default_rng(7)
    PAL = rng.uniform(0.15, 1, (len(PIECES) + 1, 3)); PAL[0] = 0
    tiles = []
    for who, views in BOX.items():
        row = []
        for view, (x0, y0, x1, y1) in views.items():
            L = labels[y0:y1, x0:x1]
            col = (im[y0:y1, x0:x1] * 0.45 + PAL[L] * 0.55)
            edge = np.zeros_like(L, bool)
            edge[1:, :] |= L[1:, :] != L[:-1, :]; edge[:, 1:] |= L[:, 1:] != L[:, :-1]
            col[edge] = 1
            t = Image.fromarray((col * 255).astype('uint8')).resize(((x1 - x0) * K, (y1 - y0) * K), Image.NEAREST)
            d = ImageDraw.Draw(t)
            for piece, pts in SEEDS[who].get(view, {}).items():
                for p in pts:
                    d.ellipse([(p[0] - x0) * K - 2, (p[1] - y0) * K - 2, (p[0] - x0) * K + 2, (p[1] - y0) * K + 2], fill=(0, 0, 0))
            for k in np.unique(L):
                if k == 0: continue
                ys, xs = np.nonzero(L == k)
                d.text((xs.mean() * K - 10, ys.mean() * K - 5), PIECES[k - 1], fill=(0, 0, 0))
            row.append(t)
        tiles.append(row)
    Wt = sum(t.size[0] for t in tiles[0]); Ht = sum(r[0].size[1] for r in tiles)
    out = Image.new('RGB', (Wt, Ht)); y = 0
    for row in tiles:
        x = 0
        for t in row: out.paste(t, (x, y)); x += t.size[0]
        y += row[0].size[1]
    out.save(sys.argv[1])
    print('wrote', sys.argv[1])
