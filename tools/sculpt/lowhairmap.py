# The swept-back hair's scalp map, seen from above: every crease pixel of the sheet's five views lifted onto the hull
# (tools/sculpt/hairs/swept-creases3d.json, tools/sculpt/lowhairtrace.mjs), drawn in an azimuthal map about the skull's
# centre (the crown at the middle, the face at the top, his right on the right as seen from above; the distance from
# the middle the angle from straight up, 7 px a degree, rings every 30 degrees, a grid every 10: a point's map
# degrees east (toward his right) and north (toward the face) are how the creases are traced, swept-lines.json), one colour per view, brighter where the
# hull faces that view squarely. With the traced creases (tools/sculpt/hairs/swept-lines.json, read back as
# swept-lines3d.json) as lines and each tuft's run (front to back, its middle) as arrows.
#
#   python3 tools/sculpt/lowhairmap.py <out.png> [--centre x,y,z]
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

D = os.path.dirname(os.path.abspath(__file__))
K, R = 7, 80
SIZE = 2 * R * K + 40
COL = {'front': (255, 70, 70), 'q3': (255, 160, 40), 'profile': (240, 230, 60), 'r3': (60, 220, 255), 'back': (230, 90, 255)}


def to_map(p, C):
    d = np.array(p) - C; d = d / np.linalg.norm(d)
    a = math.degrees(math.acos(max(-1, min(1, d[1])))); t = math.atan2(d[0], d[2])
    return SIZE / 2 - a * math.sin(t) * K, SIZE / 2 - a * math.cos(t) * K


def draw(out, C, lines=None):
    pts = json.load(open(os.path.join(D, 'hairs/swept-creases3d.json')))
    img = Image.new('RGB', (SIZE, SIZE + 60), (30, 26, 28)); dr = ImageDraw.Draw(img)
    # the map's own grid, every 10 degrees (east: toward his right; north: toward the face), for tracing on it
    for g in range(-R // 10 * 10, R + 1, 10):
        q = SIZE / 2 + g * K
        dr.line([q, 0, q, SIZE], fill=(44, 44, 48)); dr.line([0, q, SIZE, q], fill=(44, 44, 48))
        dr.text((q + 2, 2), str(g), fill=(90, 90, 100)); dr.text((2, SIZE - q + 2), str(g), fill=(90, 90, 100))
    for a in (30, 60, 90):
        r = a * K; dr.ellipse([SIZE / 2 - r, SIZE / 2 - r, SIZE / 2 + r, SIZE / 2 + r], outline=(80, 80, 88)); dr.text((SIZE / 2 + 3, SIZE / 2 - r + 2), f'{a} deg from the top', fill=(120, 120, 130))
    for t, lab in ((0, 'face'), (90, 'his right'), (180, 'back'), (270, 'his left')):
        x, y = SIZE / 2 + math.sin(math.radians(t)) * R * K, SIZE / 2 - math.cos(math.radians(t)) * R * K
        dr.line([SIZE / 2, SIZE / 2, x, y], fill=(55, 55, 60)); dr.text((x - 20 if t else x + 4, y + (4 if t != 180 else -14)), lab, fill=(160, 160, 170))
    for v, L in pts.items():
        if v.startswith('edge-'):
            for p in L:
                X, Y = to_map(p, C); dr.point((X, Y), fill=(235, 235, 235))
            continue
        c = np.array(COL[v])
        for x, y, z, dep, face, *_ in L:
            if face < 0.25: continue
            X, Y = to_map((x, y, z), C); f = min(1, 0.35 + face * 0.8)
            dr.rectangle([X - 1, Y - 1, X + 1, Y + 1], fill=tuple(int(q) for q in c * f))
    if lines:
        for ln in lines:
            ln['col'] = tuple(ln.get('col', (255, 255, 255)))
            P = [to_map(p, C) for p in ln['pts']]
            dr.line(P, fill=ln.get('col', (255, 255, 255)), width=3 if ln.get('border') else 2)
            if ln.get('arrow'):
                for k in range(1, len(P), max(1, len(P) // 4)):
                    (x0, y0), (x1, y1) = P[k - 1], P[k]; a = math.atan2(y1 - y0, x1 - x0)
                    dr.polygon([(x1, y1), (x1 - 12 * math.cos(a - 0.4), y1 - 12 * math.sin(a - 0.4)), (x1 - 12 * math.cos(a + 0.4), y1 - 12 * math.sin(a + 0.4))], fill=ln.get('col', (255, 255, 255)))
            if ln.get('label'):
                m = P[len(P) // 2]; dr.text((m[0] + 4, m[1] + 2), ln['label'], fill=(255, 255, 255))
    x = 10
    for v, c in COL.items():
        dr.rectangle([x, SIZE + 10, x + 14, SIZE + 24], fill=c); dr.text((x + 20, SIZE + 10), v, fill=(220, 220, 220)); x += 110
    dr.text((10, SIZE + 34), 'The sheet\'s creases lifted onto the hull, seen from above (azimuthal about the skull\'s centre); brighter where the hull faces the view', fill=(220, 210, 200))
    img.save(out)


def views(out):
    """Each sheet view at 2x with the traced creases projected into it (solid where seen, faint where hidden behind the
    hull or the head) and the tufts' runs as arrows."""
    im = Image.open(os.path.join(D, 'ref/hair-swept-undercut.png')).convert('RGB')
    two = json.load(open(os.path.join(D, 'hairs/swept-lines2d.json')))
    SPAN = {'front': (40, 370), 'q3': (345, 660), 'profile': (650, 960), 'r3': (960, 1260), 'back': (1260, 1530)}
    K2, cw, ch = 2, 300, 200
    img = Image.new('RGB', (3 * cw * K2 + 40, 2 * ch * K2 + 70), (47, 41, 43)); dr = ImageDraw.Draw(img)
    for i, (v, (a, b)) in enumerate(SPAN.items()):
        x0 = (a + b) // 2 - cw // 2 + (12 if v == 'q3' else 0); y0 = 10
        X, Y = 10 + (i % 3) * (cw * K2 + 10), 40 + (i // 3) * (ch * K2 + 20)
        img.paste(Image.fromarray((np.asarray(im.crop((x0, y0, x0 + cw, y0 + ch))).astype(float) * 0.75).astype(np.uint8)).resize((cw * K2, ch * K2), Image.LANCZOS), (X, Y))
        for ln in two[v]:
            P = [(X + (p[0] - x0) * K2, Y + (p[1] - y0) * K2, p[2]) for p in ln['pts']]
            col = tuple(ln['col'])
            for (x1, y1, s1), (x2, y2, s2) in zip(P, P[1:]):
                if s1 and s2: dr.line([x1, y1, x2, y2], fill=col, width=2)
                elif not ln['arrow']: dr.line([x1, y1, x2, y2], fill=tuple(int(c * 0.3) for c in col), width=1)
            seen = [p for p in P if p[2]]
            if seen:
                m = seen[len(seen) // 2]; dr.text((m[0] + 4, m[1] - 12), ln['id'], fill=col)
            if ln['arrow']:
                for k in range(2, len(P), 4):
                    (xa, ya, sa), (xb, yb, sb) = P[k - 1], P[k]
                    if not (sa and sb): continue
                    an = math.atan2(yb - ya, xb - xa)
                    dr.polygon([(xb, yb), (xb - 9 * math.cos(an - 0.45), yb - 9 * math.sin(an - 0.45)), (xb - 9 * math.cos(an + 0.45), yb - 9 * math.sin(an + 0.45))], fill=col)
        dr.text((X + 6, Y + 4), v, fill=(255, 240, 220))
    dr.text((12, 12), 'The traced creases (lines; his right warm, his left cool) and the tufts\' runs (white arrows, front to back) projected into the sheet\'s views (2x)', fill=(255, 230, 210))
    img.save(out)


if __name__ == '__main__':
    if '--views' in sys.argv:
        views(sys.argv[1]); sys.exit()
    C = np.array([0, 1.1997, -0.0257])
    if '--centre' in sys.argv: C = np.array([float(q) for q in sys.argv[sys.argv.index('--centre') + 1].split(',')])
    lines = json.load(open(os.path.join(D, 'hairs/swept-lines3d.json'))) if os.path.exists(os.path.join(D, 'hairs/swept-lines3d.json')) else None
    draw(sys.argv[1], C, lines)
