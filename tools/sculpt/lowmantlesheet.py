"""The fur mantle's sheet (mantle-sheet.png) beside and under the low-poly model, in the sheet's own pixels.

  python3 tools/sculpt/lowmantlesheet.py reg <proj.json> <sheet.png> <out.png>
      the body's wire (its front-facing polygons' edges) over each of the sheet's ten worn views, at 2x: the cameras'
      registration (tools/sculpt/lowmantlecams.json)
  python3 tools/sculpt/lowmantlesheet.py compare <proj.json> <sheet.png> <masks.json> <out.png> [--enchanted]
      per view: the sheet, ours (the layers in their colours), and the sheet with our layers' outlines over it and the
      sheet's own mask outlines, at 2x; prints per view and layer the outline's mean distance (px)

proj.json is tools/sculpt/lowmantlereg.mjs's; masks.json is lowmantlemask.py's (the sheet's layers per view).
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

VIEWS = ['front', 'q3', 'side', 'back', 'r3']
NAMES = {1: 'body', 2: 'ring', 3: 'collar', 4: 'mid1', 5: 'mid2', 6: 'main', 7: 'clasp'}
COL = {1: (150, 110, 95), 2: (60, 40, 35), 3: (255, 120, 200), 4: (255, 220, 90), 5: (90, 220, 255), 6: (140, 255, 120), 7: (255, 160, 40)}


def unrle(rows, w, h, dt=np.uint8):
    A = np.zeros((h, w), dt)
    for y, r in enumerate(rows):
        for k in range(0, len(r), 3):
            A[y, r[k]:r[k + 1]] = r[k + 2]
    return A


def outline(A):
    """The pixels of a boolean mask on its edge."""
    e = np.zeros_like(A)
    e[1:, :] |= A[1:, :] != A[:-1, :]
    e[:, 1:] |= A[:, 1:] != A[:, :-1]
    return e & A


def big(im, k=2):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def reg(proj, sheet, out):
    S = Image.open(sheet).convert('RGB')
    rows = []
    for who in ['male', 'female']:
        cells = []
        for v in VIEWS:
            d = proj[who][v]
            x, y, w, h = d['box']
            k = 3
            im = S.crop((x, y, x + w, y + h)).resize((w * k, h * k), Image.LANCZOS)
            dr = ImageDraw.Draw(im)
            for a, b, c, e in d['body']:
                dr.line([(a * k, b * k), (c * k, e * k)], fill=(80, 255, 255), width=1)
            dr.text((4, 4), f'{who} {v}', fill=(255, 255, 255))
            cells.append(im)
        rows.append(cells)
    W = sum(c.width for c in rows[0]) + 10 * 4
    H = sum(max(c.height for c in r) for r in rows) + 10
    o = Image.new('RGB', (W, H), (30, 24, 26))
    yy = 0
    for r in rows:
        xx = 0
        for c in r:
            o.paste(c, (xx, yy))
            xx += c.width + 10
        yy += max(c.height for c in r) + 10
    o.save(out)
    print('wrote', out)


if __name__ == '__main__':
    cmd = sys.argv[1]
    proj = json.load(open(sys.argv[2]))
    if cmd == 'reg':
        reg(proj, sys.argv[3], sys.argv[4])


# ---- the sheet's own: hand-read from 3x crops with a 5 px grid (sheet pixels) ------------------------------------------
# The layers' hems where they show (x, y), the clasps (centre x, y, radius); the outer outline and the top are the sheet's
# own (figure against background), read by figureOf.
TRACE = {
    'male': {
        'back': {'mid1': [(530, 200), (545, 205), (570, 203), (600, 208), (630, 203), (655, 205), (668, 200)],
                 'mid2': [(540, 222), (560, 225), (580, 228), (600, 232), (620, 228), (640, 225), (658, 222)],
                 'main': [(540, 222), (550, 232), (575, 245), (600, 260), (625, 245), (650, 232), (660, 222)]},
        'side': {'mid1': [(470, 200), (500, 200)], 'mid2': [(470, 215), (495, 215)], 'main': [(430, 215), (470, 225), (497, 228)]},
        'front': {'clasps': [(88, 188, 11), (147, 188, 11)]},
    },
    'female': {
        'back': {'mid1': [(540, 535), (570, 538), (600, 545), (630, 538), (655, 535)],
                 'mid2': [(548, 552), (575, 555), (600, 560), (625, 555), (652, 552)],
                 'main': [(548, 552), (575, 568), (600, 582), (625, 568), (652, 552)]},
        'side': {'mid1': [(470, 532), (495, 532)], 'mid2': [(470, 540), (493, 540)], 'main': [(430, 540), (470, 545), (495, 545)]},
        'front': {'clasps': [(97, 521, 9), (145, 521, 9)]},
    },
}
# the mantle's rows in each view's outline count (sheet y): from its top to the side tips' lowest
BAND = {'male': (148, 228), 'female': (483, 548)}


def figureOf(S, box):
    """The figure (anything not the sheet's dark background) and the head's skin, in a box."""
    x, y, w, h = box
    A = np.asarray(S.crop((x, y, x + w, y + h))).astype(float)
    bg = np.array([42.0, 27.0, 29.0])
    fig = np.sqrt(((A - bg) ** 2).sum(2)) > 45
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    mx, mn = A.max(2), A.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    skin = (sat > 0.38) & (mx > 140) & (r > g * 1.25) & (g > b * 1.1)
    return fig, skin


def ours(d):
    x, y, w, h = d['box']
    return unrle(d['labels'], w, h), {int(k): unrle(v, w, h) for k, v in d['alone'].items()}


def measure(proj, S):
    """Per view: the outer outline's mean distance (rows in the band, left and right), the top's (columns beside the
    head), the hems' (traced points: our layer's lowest pixel in that column), the clasps' centres and radii (px)."""
    rep = {}
    for who in ['male', 'female']:
        rep[who] = {}
        for v in VIEWS:
            d = proj[who][v]
            bx, by, w, h = d['box']
            L, alone = ours(d)
            fig, skin = figureOf(S, d['box'])
            mant = (L >= 2)
            y0, y1 = BAND[who]
            ol = []
            for Y in range(y0, y1):
                yy = Y - by
                if yy < 0 or yy >= h:
                    continue
                fs, os_ = np.nonzero(fig[yy])[0], np.nonzero((L[yy] >= 1))[0]
                if len(fs) and len(os_):
                    ol.append(abs(fs[0] - os_[0]))
                    ol.append(abs(fs[-1] - os_[-1]))
            # the top: columns where the sheet's topmost figure pixel is not the head's
            tops = []
            for X in range(w):
                col = np.nonzero(fig[:, X])[0]
                oc = np.nonzero(mant[:, X])[0]
                if not len(col) or not len(oc):
                    continue
                if skin[col[0], X] or col[0] + by < y0 - 6:
                    continue
                tops.append(abs(col[0] - oc[0]))
            hem = {}
            for lay, pts in TRACE[who].get(v, {}).items():
                if lay == 'clasps':
                    A = alone.get(7)
                    out = []
                    for cx, cy, r in pts:
                        if A is None:
                            continue
                        ys, xs = np.nonzero(A)
                        side = xs + bx < (pts[0][0] + pts[1][0]) / 2 if cx == pts[0][0] else xs + bx >= (pts[0][0] + pts[1][0]) / 2
                        if side.sum() == 0:
                            continue
                        mx_, my_ = xs[side].mean() + bx, ys[side].mean() + by
                        rr = np.sqrt(side.sum() / np.pi)
                        out.append(round(float(np.hypot(mx_ - cx, my_ - cy)), 1))
                        out.append(round(float(rr - r), 1))
                    hem['clasps'] = out
                    continue
                lab = {'mid1': 4, 'mid2': 5, 'main': 6}[lay]
                A = alone.get(lab)
                ds = []
                for X, Y in pts:
                    xx = X - bx
                    if A is None or xx < 0 or xx >= w:
                        continue
                    ys = np.nonzero(A[:, xx])[0]
                    if len(ys):
                        ds.append(round(float(ys[-1] + by - Y), 1))
                hem[lay] = ds
            rep[who][v] = {'outline': round(float(np.mean(ol)), 2) if ol else None, 'top': round(float(np.mean(tops)), 2) if tops else None, **hem}
    return rep


def compare(proj, sheet, out, title=''):
    S = Image.open(sheet).convert('RGB')
    rep = measure(proj, S)
    k = 2
    rows = []
    for who in ['male', 'female']:
        cells = []
        for v in VIEWS:
            d = proj[who][v]
            x, y, w, h = d['box']
            L, alone = ours(d)
            sh = S.crop((x, y, x + w, y + h))
            o = np.zeros((h, w, 3), np.uint8)
            o[:] = (34, 26, 30)
            for l, c in COL.items():
                o[L == l] = c
            ourim = Image.fromarray(o)
            ov = np.asarray(sh).copy()
            fig, skin = figureOf(S, d['box'])
            ov[outline(fig)] = (255, 255, 255)
            for l in [6, 5, 4, 3, 7]:
                if l in alone:
                    ov[outline(alone[l] > 0)] = COL[l]
            ovim = Image.fromarray(ov)
            for X, Y in [p for lay, pts in TRACE[who].get(v, {}).items() if lay != 'clasps' for p in pts]:
                pass
            trip = Image.new('RGB', (3 * w * k + 8, h * k), (20, 16, 18))
            trip.paste(big(sh, k), (0, 0))
            trip.paste(big(ourim, k), (w * k + 4, 0))
            trip.paste(big(ovim, k), (2 * w * k + 8, 0))
            dr = ImageDraw.Draw(trip)
            for lay, pts in TRACE[who].get(v, {}).items():
                if lay == 'clasps':
                    continue
                c = COL[{'mid1': 4, 'mid2': 5, 'main': 6}[lay]]
                q = [((X - x) * k + 2 * w * k + 8, (Y - y) * k) for X, Y in pts]
                dr.line(q, fill=c, width=1)
                for p in q:
                    dr.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], outline=c)
            m = rep[who][v]
            dr.text((4, 4), f'{who} {v}: sheet / ours / overlay', fill=(255, 255, 255))
            dr.text((4, h * k - 14), 'outline %s px, top %s px %s' % (m['outline'], m['top'], ' '.join(f'{a} {b}' for a, b in m.items() if a not in ('outline', 'top'))), fill=(255, 255, 160))
            cells.append(trip)
        rows.append(cells)
    W = max(sum(c.width for c in r[:3]) + 20 for r in rows)
    lay = []
    for r in rows:
        lay.append(r[:3])
        lay.append(r[3:])
    W = max(sum(c.width for c in r) + 10 * (len(r) - 1) for r in lay)
    H = sum(max(c.height for c in r) for r in lay) + 10 * len(lay) + 30
    o = Image.new('RGB', (W, H), (30, 24, 26))
    dr = ImageDraw.Draw(o)
    dr.text((6, 6), title or 'The fur mantle against its sheet: each view the sheet, ours (main green, mid2 blue, mid1 yellow, collar pink, clasps orange), and the sheet with the outlines over it (white: the sheet\'s figure; traced hems as dotted lines)', fill=(255, 255, 255))
    yy = 30
    for r in lay:
        xx = 0
        for c in r:
            o.paste(c, (xx, yy))
            xx += c.width + 10
        yy += max(c.height for c in r) + 10
    o.save(out)
    print('wrote', out)
    print(json.dumps(rep))


if __name__ == '__main__' and sys.argv[1] == 'compare':
    compare(json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else '')


def masks(sheet, out):
    """The sheet's figure and head skin per view box (run-length rows of 0/1), and the traces, for lowmantlefit.mjs."""
    S = Image.open(sheet).convert('RGB')
    import importlib
    boxes = {'male': {'front': [20, 95, 195, 245], 'q3': [215, 95, 185, 245], 'side': [398, 95, 122, 245], 'back': [515, 95, 150, 245], 'r3': [668, 95, 147, 245]},
             'female': {'front': [20, 438, 195, 225], 'q3': [215, 438, 185, 225], 'side': [395, 438, 122, 225], 'back': [515, 438, 150, 225], 'r3': [668, 438, 147, 225]}}
    res = {'trace': TRACE, 'band': BAND, 'views': {}}
    for who, bs in boxes.items():
        res['views'][who] = {}
        for v, box in bs.items():
            fig, skin = figureOf(S, box)
            enc = lambda A: [[int(x) for x in np.flatnonzero(np.diff(np.concatenate([[0], r.astype(np.int8), [0]])))] for r in A]
            res['views'][who][v] = {'box': box, 'fig': enc(fig), 'skin': enc(skin)}
    json.dump(res, open(out, 'w'))
    print('wrote', out)


if __name__ == '__main__' and sys.argv[1] == 'masks':
    masks(sys.argv[3], sys.argv[4])


def clumpColour(cid):
    """A clump's own colour: its layer's hue band (main green, mid2 blue, mid1 yellow, collar pink), each clump a step round it."""
    import colorsys
    lab, q = cid // 64, cid % 64
    base = {6: 0.33, 5: 0.55, 4: 0.14, 3: 0.88, 2: 0.0, 7: 0.08}.get(lab, 0.0)
    h = (base + ((q * 0.37) % 1 - 0.5) * 0.16) % 1
    r, g, b = colorsys.hsv_to_rgb(h, 0.55 + 0.45 * (q % 2), 1.0 - 0.25 * ((q // 2) % 2))
    return (int(r * 255), int(g * 255), int(b * 255))


def clumps(proj, sheet, out, trace=None, title='', views=VIEWS, whos=('male', 'female'), k=3):
    """Per view: the sheet, ours with each clump in its own colour, and the sheet with each visible clump's outline in its
    colour and the traced tips (circles) and notches (squares) of lowmantle-trace.json."""
    S = Image.open(sheet).convert('RGB')
    T = json.load(open(trace)) if trace else {}
    tcol = {'collar': (255, 120, 200), 'mid1': (255, 220, 90), 'mid2': (90, 220, 255), 'main': (140, 255, 120)}
    cells = []
    for who in whos:
        for v in views:
            d = proj[who][v]
            x, y, w, h = d['box']
            Y0 = 35 if who == 'male' else 30
            H = 160 if who == 'male' else 140
            C = unrle(d['clumps'], w, h, np.uint16)[Y0:Y0 + H]
            sh = S.crop((x, y + Y0, x + w, y + Y0 + H))
            o = np.zeros((H, w, 3), np.uint8)
            o[:] = (34, 26, 30)
            o[C == 1] = COL[1]
            ov = np.asarray(sh).copy()
            for cid in np.unique(C):
                if cid < 128:
                    continue
                M = C == cid
                o[M] = clumpColour(int(cid))
                ov[outline(M)] = clumpColour(int(cid))
            trip = Image.new('RGB', (3 * w * k + 8, H * k), (20, 16, 18))
            trip.paste(big(sh, k), (0, 0))
            trip.paste(big(Image.fromarray(o), k), (w * k + 4, 0))
            trip.paste(big(Image.fromarray(ov), k), (2 * w * k + 8, 0))
            dr = ImageDraw.Draw(trip)
            for lay, pts in T.get(who, {}).get(v, {}).items():
                for t, X, Yp in pts:
                    p = ((X - x) * k + 2 * w * k + 8, (Yp - y - Y0) * k)
                    r = 4 if t == 't' else 3
                    (dr.ellipse if t == 't' else dr.rectangle)([p[0] - r, p[1] - r, p[0] + r, p[1] + r], outline=tcol[lay], width=2)
            dr.text((4, 4), f'{who} {v}: sheet / ours, a colour per clump / overlay', fill=(255, 255, 255))
            cells.append(trip)
    rows = [cells[i:i + 3] for i in range(0, len(cells), 3)]
    W = max(sum(c.width for c in r) + 10 * (len(r) - 1) for r in rows)
    Ht = sum(max(c.height for c in r) for r in rows) + 10 * len(rows) + 24
    o = Image.new('RGB', (W, Ht), (30, 24, 26))
    ImageDraw.Draw(o).text((6, 6), title or 'The fur mantle per clump against its sheet (circles: traced tips, squares: traced notches)', fill=(255, 255, 255))
    yy = 24
    for r in rows:
        xx = 0
        for c in r:
            o.paste(c, (xx, yy))
            xx += c.width + 10
        yy += max(c.height for c in r) + 10
    o.save(out)
    print('wrote', out, o.size)


if __name__ == '__main__' and sys.argv[1] == 'clumps':
    a = sys.argv
    opt = lambda n, f=None: a[a.index('--' + n) + 1] if '--' + n in a else f
    clumps(json.load(open(a[2])), a[3], a[4], opt('trace'), opt('title', ''), opt('views', ','.join(VIEWS)).split(','), opt('who', 'male,female').split(','), int(opt('k', '3')))
