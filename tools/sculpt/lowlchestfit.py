"""The built leather chest (tools/sculpt/lowlchestfit.mjs label buffers) measured against the approved trace
(tools/sculpt/leather/mesh/<who>-<view>.json), piece by piece and view by view: the overlap (IoU) and the edge error
(the mean distance, sheet pixels, between the built piece's outline and the traced one, both ways), and over the whole view the share of the labelled pixels where the two labels differ; an overlay per view
(the sheet dimmed, the trace's outlines green, the build's red) and the table.

  python3 tools/sculpt/lowlchestfit.py <fit-who.json> <out.png> [--only group,group] [--confusion]
"""
import sys, os, json, base64, re, numpy as np, cv2
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(sys.argv[1])); out = sys.argv[2]; GR = J['groups']; who = J['who']
only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
sheet = Image.open(os.path.join(D, 'ref/leather-chest.png')).convert('RGB')
def group(n, view):
    side = 'l' if view == 'side' else None
    m = re.match(r'^(.*)\.(l|r)$', n)
    if m and m.group(1) not in ('back.side',): base, side = m.group(1), m.group(2)
    else: base = n
    if base in ('back.side.l', 'back.side.r'): return 'side.' + base[-1]
    if n.startswith('back.side'): return 'side.' + n[-1]
    if base.startswith('core') or base == 'side' and view in ('front', 'q3') and False: return 'core'
    if n == 'side.r': return 'side.r'
    if base in ('band1', 'band2'): return base
    if base in ('ring', 'ring.hole', 'stripe1', 'stripe2', 'stripes'): return 'emblem'
    if base.startswith('collar') or base == 'notch' or base == 'collar': return 'collar'
    if base in ('belt', 'belt.mid'): return 'belt'
    if base == 'skirt.f' or base == 'skirt.f2': return base
    if base.startswith('skirt.mid') or base == 'skirt.b': return 'skirt.b'
    if base in ('skirtU', 'skirtL') and side: return f'{base}.{side}'
    if base in ('back.top', 'back.low', 'back.strap'): return 'back'
    if base == 'back.panel': return 'back.panel'
    if view == 'side' and re.match(r'plate[12]$', base): return 'belt'
    if view == 'side' and base == 'plate3': return 'skirtU.l'
    if view == 'side' and re.match(r'plate[4-7]$', base): return 'skirtL.l'
    if base in ('captop', 'capband'): return f'cap.{side}'
    if base in ('lame1', 'lame2', 'sleeve', 'strap', 'band'): return f'{base}.{side}'
    if base in ('bracer', 'bracer.cuff'): return f'bracer.{side}'
    if base == 'bring': return f'rune.{side}'
    if base == 'undershirt': return 'undershirt'
    return None
rank = lambda k: 2 if re.match(r'(ring|stripe|bring)', k) else (0 if k == 'undershirt' else 1)
rows, table, whole = [], {}, {}
ids = [gi for gi, g in enumerate(GR, 1) if g != 'body' and (not only or g in only)]
for view in ['front', 'q3', 'side', 'r3', 'back']:
    V = J['views'][view]; K, W, H = V['K'], V['W'], V['H']; x0, y0, x1, y1 = V['box']
    built = np.frombuffer(base64.b64decode(V['lab']), np.uint8).reshape(H, W)
    T = json.load(open(os.path.join(D, f'leather/mesh/{who}-{view}.json')))
    trace = np.zeros((H, W), np.uint8)
    for k in sorted(T['pieces'], key=rank):
        if k.endswith('.layer'): continue
        g = group(k, view); v = T['pieces'][k]
        if g is None or g not in GR: continue
        gi = GR.index(g) + 1
        if isinstance(v, dict): cx, cy, rx, ry = v['ellipse']; cv2.ellipse(trace, (int((cx - x0) * K), int((cy - y0) * K)), (int(rx * K), int(ry * K)), 0, 0, 360, gi, -1)
        else: cv2.fillPoly(trace, [np.array([[(x - x0) * K, (y - y0) * K] for x, y in v], np.int32)], gi)
    src = np.array(sheet.crop((x0, y0, x1, y1)).resize((W, H), Image.LANCZOS))[..., ::-1]
    vis = (src * 0.45).astype(np.uint8)
    for gi, g in enumerate(GR, 1):
        if g == 'body' or (only and g not in only): continue
        a, b = (built == gi).astype(np.uint8), (trace == gi).astype(np.uint8)
        if a.sum() < 30 * K * K / 4 and b.sum() < 30 * K * K / 4: continue
        iou = (a & b).sum() / max(1, (a | b).sum())
        ea = cv2.morphologyEx(a, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)); eb = cv2.morphologyEx(b, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
        if ea.sum() and eb.sum():
            da = cv2.distanceTransform(1 - eb, cv2.DIST_L2, 3); db = cv2.distanceTransform(1 - ea, cv2.DIST_L2, 3)
            err = (da[ea > 0].mean() + db[eb > 0].mean()) / 2 / K
        else: err = float('nan')
        table.setdefault(g, {})[view] = (round(float(iou), 2), round(float(err), 1), int(a.sum() // (K * K)), int(b.sum() // (K * K)))
        vis[eb > 0] = (60, 230, 60); vis[ea > 0] = (60, 60, 240)
    # (the whole view: the share of the pixels either labels where the two labels differ)
    sel = np.isin(built, ids) | np.isin(trace, ids)
    if '--confusion' in sys.argv:
        pr = (trace.astype(np.int32) * 256 + built)[((built != trace) & sel)]
        u, n = np.unique(pr, return_counts=True); nm = lambda i: GR[i - 1] if i else '-'
        print(f'  {view} confusions (traced -> built, sheet px):', ', '.join(f'{nm(a // 256)}->{nm(a % 256)} {c // (K * K)}' for a, c in sorted(zip(u, n), key=lambda t: -t[1])[:14]))
    whole[view] = round(float(((built != trace) & sel).sum() / max(1, sel.sum())), 3)
    cv2.putText(vis, view, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    rows.append(np.concatenate([src, np.full((H, 4, 3), 30, np.uint8), vis], 1))
Hm = max(r.shape[0] for r in rows); rows = [np.pad(r, ((0, Hm - r.shape[0]), (0, 0), (0, 0))) for r in rows]
img = np.concatenate([np.concatenate([r, np.full((Hm, 10, 3), 30, np.uint8)], 1) for r in rows], 1)
cv2.imwrite(out, img)
print(f'{who}: piece  view: IoU / edge error (sheet px) / built px / traced px')
for g, d in table.items(): print(f'  {g:11s}', '  '.join(f'{v}:{x[0]:.2f}/{x[1]:.1f}/{x[2]}/{x[3]}' for v, x in d.items()))
print('  mismatch', '  '.join(f'{v}:{x:.3f}' for v, x in whole.items()), f'mean:{np.mean(list(whole.values())):.3f}')
table['_mismatch'] = whole
json.dump(table, open(out.replace('.png', '.json'), 'w'))
