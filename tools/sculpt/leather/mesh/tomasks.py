"""The approved trace (<who>-<view>.json) written as the builder's piece masks (tools/sculpt/leather/chest-masks.json,
read by lowleatherchestview.mjs sheetLabels and lowleatherchestsolve.mjs): every sheet pixel of a view its piece, the
trace's pieces grouped into the builder's (the chest core, its bands, emblem and lacing as `chest`; the pauldron's dark
top and tooth band as `pauldron`; the bracer's cuff and ring as the bracer's; the back's top, strap, panel and low plate
as `back`; the strap plates, the second front skirt plate and the undershirt left out: the builder has none yet).

  python3 tools/sculpt/leather/mesh/tomasks.py
"""
import json, os, re, numpy as np, cv2
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, '../chest-masks.json')
PIECES = json.load(open(OUT))['pieces']
def builder(n, view):
    m = re.match(r'^(.*)\.(l|r)$', n); side = 'l' if view == 'side' else None
    if m and not n.startswith('back.side'): base, side = m.group(1), m.group(2)
    else: base = n
    if n.startswith('back.side'): return 'side.' + n[-1]
    if n == 'side.r': return 'side.r'
    if base.startswith('core') or base in ('band1', 'band2', 'ring', 'ring.hole', 'stripe1', 'stripe2', 'stripes', 'lacing'): return 'chest'
    if base.startswith('collar') or base == 'notch': return 'collar'
    if base in ('belt', 'belt.mid'): return 'belt'
    if base == 'skirt.f': return 'skirt.f'
    if base.startswith('skirt.mid') or base == 'skirt.b': return 'skirt.b'
    if base in ('skirtU', 'skirtL'): return f'{base}.{side}'
    if base in ('back.top', 'back.low', 'back.strap', 'back.panel'): return 'back'
    if view == 'side' and re.match(r'plate[12]$', base): return 'belt'
    if view == 'side' and base == 'plate3': return 'skirtU.l'
    if view == 'side' and re.match(r'plate[4-7]$', base): return 'skirtL.l'
    if base in ('captop', 'capband'): return f'pauldron.{side}'
    if base in ('lame1', 'lame2'): return f'plame{base[-1]}.{side}'
    if base in ('sleeve', 'band'): return f'{base}.{side}'
    if base in ('bracer', 'bracer.cuff', 'bring'): return f'bracer.{side}'
    return None
rank = lambda k: 2 if re.match(r'(ring|stripe|bring)', k) else 1
views = {}
for who in ['male', 'female']:
    views[who] = {}
    for view in ['front', 'q3', 'side', 'r3', 'back']:
        T = json.load(open(os.path.join(D, f'{who}-{view}.json'))); x0, y0, x1, y1 = T['box']; W, H = x1 - x0, y1 - y0
        L = np.zeros((H * 4, W * 4), np.uint8)
        for k in sorted(T['pieces'], key=rank):
            if k.endswith('.layer'): continue
            b = builder(k, view)
            if b not in PIECES: continue
            v = T['pieces'][k]; i = PIECES.index(b) + 1
            if isinstance(v, dict): cx, cy, rx, ry = v['ellipse']; cv2.ellipse(L, (int((cx - x0) * 4), int((cy - y0) * 4)), (int(rx * 4), int(ry * 4)), 0, 0, 360, i, -1)
            else: cv2.fillPoly(L, [np.array([[(x - x0) * 4, (y - y0) * 4] for x, y in v], np.int32)], i)
        L = L[2::4, 2::4]
        runs = []
        for row in L:
            r, x = [], 0
            while x < W:
                if row[x]:
                    s, l = x, row[x]
                    while x < W and row[x] == l: x += 1
                    r += [s, x, int(l)]
                else: x += 1
            runs.append(r)
        views[who][view] = {'box': [x0, y0, x1, y1], 'runs': runs}
json.dump({'pieces': PIECES, 'views': views}, open(OUT, 'w'))
print('wrote', OUT)
