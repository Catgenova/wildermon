"""The chest sheet registered to the low-poly bodies and the armour laid over it (run by tools/sculpt/lowplatechestreg.mjs,
which writes the bodies, the armour and the paths to a JSON file given as the one argument).

Each view an orthographic turntable camera: a point p (the body's units) at turn `yaw` goes to
    qx = cos(yaw) x + sin(yaw) z,  qy = y,  depth = -sin(yaw) x + cos(yaw) z
    u = cx + s ax qx,  v = cy - s qy        (sheet pixels)
its scale s, horizontal stretch ax and centre fitted to the landmarks by least squares (u and v apart, both linear), its
turn the best of a few about the sheet's own (0, 45, 90, 135, 180; front and back held). The sheet's figure is every
pixel off its background colour by more than FG; ours, the armour's triangles filled, painter's order, flat shaded."""
import json, math, sys
from PIL import Image, ImageDraw

D = json.load(open(sys.argv[1]))
SHEET = Image.open(D['sheet']).convert('RGB')
MARKS = json.load(open(D['marks']))
VIEWS = [('front', 0, (0, 250)), ('q3', 45, (225, 420)), ('side', 90, (392, 510)), ('r3', 135, (482, 690)), ('back', 180, (655, 862))]
ROWS = {'male': (92, 347), 'female': (435, 690)}
BG, FG, K = (50, 31, 34), 60, 2


def proj(p, c):
    a = math.radians(c['yaw']); ca, sa = math.cos(a), math.sin(a)
    qx, qy, qz = ca * p[0] + sa * p[2], p[1], -sa * p[0] + ca * p[2]
    return (c['cx'] + c['s'] * c['ax'] * qx, c['cy'] - c['s'] * qy, qz)


def lsq(xs, ys):
    """y = a x + b by least squares (a, b), and with one x the slope left to the caller."""
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx if sxx > 1e-9 else None
    return a, (my - (a or 0) * mx)


def fit(who, view, yaw0, held, shared=None):
    """A view's camera: front and back their own scale, stretch and centre; the rest (the sheet a turntable) the front's
    and back's mean scale and row, ax 1, their turn and column fitted."""
    M, B = MARKS[who][view], D['bodies'][who]['marks']
    pairs = [(M[k][s], B[k][s]) for k in ('elbow', 'wrist') for s in M[k]]
    best = None
    for dy in ([0] if held else [d * 1.0 for d in range(-15, 16)]):
        yaw = yaw0 + dy; a = math.radians(yaw); ca, sa = math.cos(a), math.sin(a)
        qx = [ca * p[0] + sa * p[2] for _, p in pairs] + [sa * -0.2]
        us = [m[0] for m, _ in pairs] + [M['neck']]
        if shared is None:
            qy = [p[1] for _, p in pairs]; vs = [m[1] for m, _ in pairs]
            S, cy = lsq(qy, vs); S = -S
            A, cx = lsq(qx, us)
            c = {'yaw': yaw, 's': S, 'ax': A / S, 'cx': cx, 'cy': cy}
        else:
            S, cy = shared
            cx = sum(u - S * q for u, q in zip(us, qx)) / len(us)
            c = {'yaw': yaw, 's': S, 'ax': 1.0, 'cx': cx, 'cy': cy}
        res = [math.hypot(proj(p, c)[0] - m[0], proj(p, c)[1] - m[1]) for m, p in pairs]
        rms = math.sqrt(sum(r * r for r in res) / len(res))
        if not best or rms < best[0]: best = (rms, c, res)
    return best


def shade(col, n):
    k = 0.5 + 0.5 * max(0.0, abs(n[2]))
    return tuple(int(max(0, min(1, x)) * 255 * k) if x <= 1.5 else int(min(1, x - 2) * 255) for x in col)


def draw_mesh(img, verts, tris, cols, c, ox, oy, mask=None):
    """Triangles filled far to near (flat shaded), offset by (ox, oy) and scaled by K; `mask` (an 'L' image) gets them all."""
    P = [proj(v, c) for v in verts]
    order = sorted(range(len(tris)), key=lambda i: sum(P[j][2] for j in tris[i]))
    d = ImageDraw.Draw(img); dm = ImageDraw.Draw(mask) if mask is not None else None
    for i in order:
        t = tris[i]; pts = [((P[j][0] - ox) * K, (P[j][1] - oy) * K) for j in t]
        a, b, e = [P[j] for j in t]
        n = ((b[1] - a[1]) * (e[2] - a[2]) - (b[2] - a[2]) * (e[1] - a[1]), (b[2] - a[2]) * (e[0] - a[0]) - (b[0] - a[0]) * (e[2] - a[2]), (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]))
        l = math.sqrt(sum(x * x for x in n)) or 1
        d.polygon(pts, fill=shade(cols[i] if isinstance(cols[0], list) else cols, [x / l for x in n]))
        if dm: dm.polygon(pts, fill=255)


def sheet_mask(box):
    x0, y0, x1, y1 = box
    m = Image.new('L', ((x1 - x0) * K, (y1 - y0) * K))
    px = SHEET.load(); mp = m.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y]
            if abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2]) > FG:
                for dy in range(K):
                    for dx in range(K): mp[(x - x0) * K + dx, (y - y0) * K + dy] = 255
    return m


def edges(m):
    w, h = m.size; p = m.load(); out = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if p[x, y] and (not p[x - 1, y] or not p[x + 1, y] or not p[x, y - 1] or not p[x, y + 1]): out.append((x, y))
    return out


cams, fits, regrow = {}, {}, []
for who in ('male', 'female'):
    cams[who] = {}; fits[who] = {}
    y0, y1 = ROWS[who]; Bd = D['bodies'][who]
    cols_out = []
    held = {v: fit(who, v, yaw, True) for v, yaw, _ in VIEWS if v in ('front', 'back')}
    shared = (sum(h[1]['s'] for h in held.values()) / 2, sum(h[1]['cy'] for h in held.values()) / 2)
    for view, yaw, (x0, x1) in VIEWS:
        rms, c, res = held[view] if view in held else fit(who, view, yaw, False, shared)
        cams[who][view] = {k: round(v, 4) for k, v in c.items()}
        box = (x0, y0, x1, y1); W, H = (x1 - x0) * K, (y1 - y0) * K
        crop = SHEET.crop(box).resize((W, H), Image.NEAREST)
        # the registration: the body's wire over the sheet, the landmarks (green the sheet's, red ours)
        reg = crop.copy(); d = ImageDraw.Draw(reg)
        P = [proj(v, c) for v in Bd['body']['verts']]
        for t in Bd['body']['all']:
            pts = [((P[j][0] - x0) * K, (P[j][1] - y0) * K) for j in t]
            d.line(pts + [pts[0]], fill=(90, 200, 255), width=1)
        M = MARKS[who][view]
        for k in ('elbow', 'wrist'):
            for s, m in M[k].items():
                q = proj(Bd['marks'][k][s], c)
                d.ellipse([(m[0] - x0) * K - 5, (m[1] - y0) * K - 5, (m[0] - x0) * K + 5, (m[1] - y0) * K + 5], outline=(0, 255, 0), width=2)
                d.ellipse([(q[0] - x0) * K - 4, (q[1] - y0) * K - 4, (q[0] - x0) * K + 4, (q[1] - y0) * K + 4], fill=(255, 40, 40))
        d.text((6, 6), f"{who} {view} yaw {c['yaw']:.1f} ax {c['ax']:.3f} s {c['s']:.1f}px  rms {rms:.1f}px", fill=(255, 255, 0))
        regrow.append((who, reg))
        # ours: the armour alone (the sheet draws no body), and its silhouette against the sheet's
        for look in D['looks']:
            ours = Image.new('RGB', (W, H), BG); om = Image.new('L', (W, H))
            draw_mesh(ours, Bd['armour']['verts'], Bd['armour']['tris'], Bd['armour']['col'][look], c, x0, y0, om)
            sm = sheet_mask(box)
            ov = Image.blend(crop, ours, 0.45); dv = ImageDraw.Draw(ov)
            for e in edges(sm): dv.point(e, fill=(40, 255, 60))
            for e in edges(om): dv.point(e, fill=(255, 40, 40))
            a, b = sm.load(), om.load(); inter = uni = 0; dw = []
            for y in range(H):
                rs = [x for x in range(W) if a[x, y]]; ro = [x for x in range(W) if b[x, y]]
                for x in range(W):
                    s1, s2 = a[x, y] > 0, b[x, y] > 0
                    inter += s1 and s2; uni += s1 or s2
                if rs and ro: dw.append(abs((max(rs) - min(rs)) - (max(ro) - min(ro))) / K)
            iou = inter / max(1, uni)
            if look == 'plain': fits[who][view] = {'iou': round(iou, 3), 'widthOffPx': round(sum(dw) / max(1, len(dw)), 2), 'regRmsPx': round(rms, 2), 'residualsPx': [round(r, 1) for r in res]}
            cols_out.append((view, look, crop, ours, ov, iou))
    # per body: the sheet, ours and the overlay, a column per view (and per look)
    Wt = sum(c[2].size[0] for c in cols_out); Ht = (y1 - y0) * K * 3 + 30
    img = Image.new('RGB', (Wt, Ht), (30, 24, 26)); d = ImageDraw.Draw(img); x = 0
    for view, look, crop, ours, ov, iou in cols_out:
        h = crop.size[1]
        img.paste(crop, (x, 30)); img.paste(ours, (x, 30 + h)); img.paste(ov, (x, 30 + 2 * h))
        d.text((x + 4, 4), f"{view} {look}  IoU {iou:.2f}", fill=(255, 230, 180)); x += crop.size[0]
    d.text((4, 18), f"{who}: the sheet / ours / ours over the sheet (red ours, green the sheet's outline)", fill=(200, 200, 200))
    img.save(f"{D['out']}/platechest-{D['tag']}-overlay-{who}.png")
# the registration sheet: both bodies, a row each
rows = {w: [r for ww, r in regrow if ww == w] for w in ('male', 'female')}
Wt = sum(r.size[0] for r in rows['male']); Ht = sum(rows[w][0].size[1] for w in rows)
img = Image.new('RGB', (Wt, Ht)); y = 0
for w in ('male', 'female'):
    x = 0
    for r in rows[w]: img.paste(r, (x, y)); x += r.size[0]
    y += rows[w][0].size[1]
img.save(f"{D['out']}/platechest-{D['tag']}-reg.png")
json.dump(cams, open(D['cams'], 'w'), indent=1)
json.dump(fits, open(f"{D['out']}/platechest-{D['tag']}-fit.json", 'w'), indent=1)
for w in fits:
    print(w, ' '.join(f"{v}: IoU {f['iou']} width±{f['widthOffPx']}px reg {f['regRmsPx']}px" for v, f in fits[w].items()))
