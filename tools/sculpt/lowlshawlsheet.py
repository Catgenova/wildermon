"""The leather shawl's references (lineup-shawl.png, enchanted-glow-ref.png) beside and under the low-poly model, in the
references' own pixels (tools/sculpt/lowlshawlcams.json; meshes from tools/sculpt/lowlshawlreg.mjs).

  python3 tools/sculpt/lowlshawlsheet.py reg <meshes.json> <refdir> <out.png>
      the body's wire (its front-facing polygons' edges) over each view, at 2x: the cameras' registration
  python3 tools/sculpt/lowlshawlsheet.py heads <meshes.json> <refdir>
      per view the figure's head (its top rows' centre) against the body's: the cx and yaw residuals
  python3 tools/sculpt/lowlshawlsheet.py trace <refdir> <out.png>
      the traced outlines (tools/sculpt/lowlshawl-trace.json) over each view, at 2x, with a 10 px grid
  python3 tools/sculpt/lowlshawlsheet.py compare <meshes.json> <refdir> <out.png> [--json <scores.json>]
      per view: the reference, ours (flat, its materials), and the reference with our shawl's outline (green) and the
      traced one (magenta); prints per view the IoU of the shawl's silhouette and the outlines' mean distance (px)
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
CAMS = json.load(open(os.path.join(HERE, 'lowlshawlcams.json')))
TRACE_FILE = os.path.join(HERE, 'lowlshawl-trace.json')
ONLY = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None


def views(who):
    return [k for k in CAMS[who].keys()]


def project(P, c):
    a = np.radians(c['yaw'])
    P = np.asarray(P, float)
    x = c['cx'] + c['s'] * c.get('ax', 1) * (np.cos(a) * P[:, 0] + np.sin(a) * P[:, 2])
    y = c['cy'] + c.get('dy', 0) - c['s'] * P[:, 1]
    z = -np.sin(a) * P[:, 0] + np.cos(a) * P[:, 2]
    return np.stack([x, y, z], 1)


def facing(P3, polys):
    """Polygons facing the viewer (screen y down: a counter-clockwise polygon on screen faces away)."""
    out = []
    for p in polys:
        q = P3[p]
        ar = 0.0
        for k in range(len(p)):
            a, b = q[k], q[(k + 1) % len(p)]
            ar += a[0] * b[1] - b[0] * a[1]
        out.append(ar < 0)
    return out


def ref_of(refdir, c, cache={}):
    f = os.path.join(refdir, CAMS['refs'][c['ref']])
    if f not in cache:
        cache[f] = Image.open(f).convert('RGB')
    return cache[f]


def grid(cells, cols, pad=8, bg=(30, 24, 26)):
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    W = max(sum(c.width for c in r) + pad * (len(r) - 1) for r in rows)
    H = sum(max(c.height for c in r) for r in rows) + pad * (len(rows) - 1)
    o = Image.new('RGB', (W, H), bg)
    yy = 0
    for r in rows:
        xx = 0
        for c in r:
            o.paste(c, (xx, yy))
            xx += c.width + pad
        yy += max(c.height for c in r) + pad
    return o


def crop2(S, box, k=2):
    x, y, w, h = box
    return S.crop((x, y, x + w, y + h)).resize((w * k, h * k), Image.LANCZOS)


def wire(dr, P3, polys, box, k, col, keep=None):
    x0, y0 = box[0], box[1]
    fac = facing(P3, polys)
    for i, p in enumerate(polys):
        if not fac[i] or (keep is not None and not keep[i]):
            continue
        for j in range(len(p)):
            a, b = P3[p[j]], P3[p[(j + 1) % len(p)]]
            dr.line([((a[0] - x0) * k, (a[1] - y0) * k), ((b[0] - x0) * k, (b[1] - y0) * k)], fill=col, width=1)


def reg(M, refdir, out):
    cells = []
    for who in ['male', 'female']:
        for v in views(who):
            c = CAMS[who][v]
            S = ref_of(refdir, c)
            im = crop2(S, c['box'])
            dr = ImageDraw.Draw(im)
            B = M[who]['body']
            P3 = project(B['verts'], c)
            wire(dr, P3, B['polys'], c['box'], 2, (80, 255, 255))
            dr.text((4, 4), f'{who} {v} yaw {c["yaw"]}', fill=(255, 255, 255))
            cells.append(im)
    grid(cells, 5).save(out)
    print('wrote', out)


def figure(S, box, thr=40):
    x, y, w, h = box
    A = np.asarray(S.crop((x, y, x + w, y + h))).astype(float)
    bg = A[2, 2]
    return np.sqrt(((A - bg) ** 2).sum(2)) > thr


def heads(M, refdir):
    """The head's top and its centre over its top 0.9 units (rows), sheet against body."""
    for who in ['male', 'female']:
        for v in views(who):
            c = CAMS[who][v]
            S = ref_of(refdir, c)
            fig = figure(S, c['box'])
            rows = np.nonzero(fig.any(1))[0]
            top = rows.min()
            band = int(0.9 * c['s'])
            xs = [np.nonzero(fig[r])[0] for r in range(top + 2, top + band)]
            fc = np.mean([(r.min() + r.max()) / 2 for r in xs if len(r)]) + c['box'][0]
            B = M[who]['body']
            P = np.asarray(B['verts'])
            P3 = project(P, c)
            ytop = P[:, 1].max()
            sel = P[:, 1] > ytop - 0.9
            bc = (P3[sel, 0].min() + P3[sel, 0].max()) / 2
            print(f'{who} {v}: figure top {top + c["box"][1]}, body top {P3[:, 1].min():.1f}; head centre figure {fc:.1f}, body {bc:.1f}: cx {c["cx"] + fc - bc:.1f}')


def trace(refdir, out):
    T = json.load(open(TRACE_FILE))
    cells = []
    for who in ['male', 'female']:
        for v in views(who):
            c = CAMS[who][v]
            S = ref_of(refdir, c)
            k = 3
            im = crop2(S, c['box'], k)
            dr = ImageDraw.Draw(im)
            x0, y0 = c['box'][0], c['box'][1]
            for gx in range((x0 // 10 + 1) * 10, x0 + c['box'][2], 10):
                dr.line([((gx - x0) * k, 0), ((gx - x0) * k, im.height)], fill=(90, 90, 90) if gx % 50 else (160, 160, 60), width=1)
            for gy in range((y0 // 10 + 1) * 10, y0 + c['box'][3], 10):
                dr.line([(0, (gy - y0) * k), (im.width, (gy - y0) * k)], fill=(90, 90, 90) if gy % 50 else (160, 160, 60), width=1)
            for name, pts in T.get(who, {}).get(v, {}).items():
                col = (255, 60, 220) if name == 'outline' else (60, 255, 120)
                q = [((x - x0) * k, (y - y0) * k) for x, y in pts]
                if len(q) > 1:
                    dr.line(q + ([q[0]] if name == 'outline' else []), fill=col, width=2)
            dr.text((4, 4), f'{who} {v} (grid 10 px, yellow 50)', fill=(255, 255, 255))
            cells.append(im)
    grid(cells, 4).save(out)
    print('wrote', out)


MATCOL = {'leather': (106, 57, 45), 'dark': (74, 40, 33), 'light': (136, 73, 56), 'trim': (232, 132, 72), 'rune': (232, 132, 72)}
GLOW = (254, 202, 109)
SKIN = (173, 125, 105)


def render(M, who, c, box, k, enchanted=False, body=True, shawl=True, flat=None):
    """Body and shawl painted back to front (one colour per triangle, a simple light), at k times the reference's pixels."""
    x0, y0, w, h = box
    im = Image.new('RGBA', (w * k, h * k), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    L = np.array([-0.35, 0.55, 0.75]); L /= np.linalg.norm(L)
    items = []
    a = np.radians(c['yaw'])
    for part in (['body'] if body else []) + (['shawl'] if shawl and 'shawl' in M[who] else []):
        m = M[who][part]
        P = np.asarray(m['verts'], float)
        P3 = project(P, c)
        T = np.asarray(m['tris'])
        for ti, t in enumerate(T):
            A, B, C = P[t[0]], P[t[1]], P[t[2]]
            n = np.cross(B - A, C - A); ln = np.linalg.norm(n)
            if ln < 1e-12:
                continue
            n /= ln
            # the view direction in body space (toward the viewer)
            vdir = np.array([-np.sin(a), 0, np.cos(a)])
            if part == 'body':
                mat = m['mat'][ti] if 'mat' in m and len(m['mat']) == len(T) else None
                col = SKIN
            else:
                pi = m['tpoly'][ti]
                mat = m['mat'][pi]
                col = MATCOL.get(mat, (200, 0, 200))
                if mat == 'rune' and enchanted:
                    col = GLOW
            if flat is not None:
                col = flat.get(part, col)
            nd = abs(np.dot(n, L))
            sh = 0.5 + 0.6 * nd
            if part == 'shawl' and mat == 'rune' and enchanted:
                sh = 1.0
            cc = tuple(int(min(255, v * sh)) for v in col)
            q = P3[t]
            items.append((q[:, 2].mean(), [((q[i, 0] - x0) * k, (q[i, 1] - y0) * k) for i in range(3)], cc))
    items.sort(key=lambda e: e[0])
    for _, pts, cc in items:
        dr.polygon(pts, fill=cc + (255,))
    return im


def compare(M, refdir, out, enchanted=False, k=2):
    cells = []
    for who in ['male', 'female']:
        for v in views(who):
            if ONLY and f'{who}.{v}' not in ONLY:
                continue
            c = CAMS[who][v]
            if enchanted != (c['ref'] == 'glow') and v not in ('front', 'q3'):
                pass
            S = ref_of(refdir, c)
            ref = crop2(S, c['box'], k)
            ours = Image.new('RGB', ref.size, (44, 40, 42))
            r = render(M, who, c, c['box'], k, enchanted=(c['ref'] == 'glow') or enchanted)
            ours.paste(r, (0, 0), r)
            if '--wire' in sys.argv:
                m = M[who]['shawl']
                P3 = project(m['verts'], c)
                # (the edges in front: each polygon facing the viewer whose centre is not behind the rendered depth is
                # approximated by drawing polygons facing the viewer of the shell's outside and the pieces)
                wire(ImageDraw.Draw(ours), P3, m['polys'], c['box'], k, (40, 22, 18), keep=[mt != 'dark' for mt in m['mat']])
            # the overlay: the reference, our shawl's silhouette outline (green) and the traced outline (magenta)
            ov = ref.copy()
            sil = render(M, who, c, c['box'], k, body=False, flat={'shawl': (255, 255, 255)})
            A = np.asarray(sil)[..., 3] > 0
            e = np.zeros_like(A)
            e[1:, :] |= A[1:, :] != A[:-1, :]
            e[:, 1:] |= A[:, 1:] != A[:, :-1]
            O = np.asarray(ov).copy()
            O[e] = (60, 255, 90)
            ov = Image.fromarray(O)
            dr = ImageDraw.Draw(ov)
            if os.path.exists(TRACE_FILE):
                T = json.load(open(TRACE_FILE)).get(who, {}).get(v, {})
                for name, pts in T.items():
                    if name.startswith('_'):
                        continue
                    q = [((x - c['box'][0]) * k, (y - c['box'][1]) * k) for x, y in pts]
                    if len(q) > 1:
                        dr.line(q, fill=(255, 60, 220), width=2)
            lab = ImageDraw.Draw(ref)
            lab.text((4, 4), f'{who} {v}: reference', fill=(255, 255, 255))
            ImageDraw.Draw(ours).text((4, 4), 'ours', fill=(255, 255, 255))
            ImageDraw.Draw(ov).text((4, 4), 'overlay (ours green)', fill=(255, 255, 255))
            cells += [ref, ours, ov]
    grid(cells, 6).save(out)
    print('wrote', out)


RING_OF = {'hem': 'H', 'band': 'BT0', 'yoke': 'Y1', 'collar': 'u'}


def measure(M):
    """Per view and traced line: our ring's projected line (its columns facing the view) against the traced points, the
    mean and the largest vertical distance (px), the sign ours below (+) or above (-)."""
    T = json.load(open(TRACE_FILE))
    out = {}
    for who in ['male', 'female']:
        for v, lines in T.get(who, {}).items():
            c = CAMS[who][v]
            m = M[who]['shawl']
            a = np.radians(c['yaw'])
            P = np.asarray(m['verts'], float)
            for name, pts in lines.items():
                idx = m['rings'][RING_OF[name]]
                keep = [i for k, i in enumerate(idx) if np.cos(np.radians(m['deg'][k]) + a) > -0.05]
                q = project(P[keep], c)
                q = q[np.argsort(q[:, 0])]
                d = []
                for x, y in pts:
                    if x < q[0, 0] or x > q[-1, 0]:
                        continue
                    d.append(np.interp(x, q[:, 0], q[:, 1]) - y)
                if d:
                    d = np.array(d)
                    out[f'{who}.{v}.{name}'] = [round(float(np.abs(d).mean()), 1), round(float(np.abs(d).max()), 1), round(float(d.mean()), 1)]
    for k, v in out.items():
        print(f'{k}: mean {v[0]} px, worst {v[1]}, bias {v[2]:+}')
    return out


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'reg':
        reg(json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4])
    elif cmd == 'heads':
        heads(json.load(open(sys.argv[2])), sys.argv[3])
    elif cmd == 'compare':
        compare(json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4], '--enchanted' in sys.argv, int(sys.argv[sys.argv.index('--k') + 1]) if '--k' in sys.argv else 2)
    elif cmd == 'measure':
        r = measure(json.load(open(sys.argv[2])))
        if '--json' in sys.argv:
            json.dump(r, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    elif cmd == 'trace':
        trace(sys.argv[2], sys.argv[3])
