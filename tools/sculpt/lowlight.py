# The low-poly head's light fitted to its reference (tools/sculpt/lowshot.mjs reads the result): per view of the top row,
# the skin's colour as a function of each facet's normal in view space, real spherical harmonics to the third order and
# three rims (the cool light from behind on the left, a rim either side), fitted by least squares to the reference's
# colour over each facet's interior in all five views of the top row at once: one light for every view, fixed to the
# camera as on a turntable (the references light every view so: a light fixed to the head explains them far worse,
# HEAD=1 tries it). The occlusion a fixed factor over it (AOLO, as lowshot's). As a diagnostic, each view's own light
# drawn toward the shared one (ridge, lam) is fitted and reported too (PERVIEW=1 writes it): a facet that needs its
# view's own light to match is a plane facing the wrong way, to fix in the geometry. TONE=g,b holds the skin's green and blue over its red at
# these ratios (her skin the male's tone).
#
#   node tools/sculpt/lowshot.mjs --who male --out /tmp/l --dump /tmp/l/dump.json --rig
#   node tools/sculpt/lowids.mjs male /tmp/l/ids.bin
#   python3 tools/sculpt/lowlight.py male /tmp/l/ids.bin /tmp/l/dump.json /tmp/l/sheet-male.png 3 0.1 tools/sculpt/lowlight-male.json
#
# With the key light's cast shadow (lowshot.mjs; the references show it under the chin on the neck, under the nose):
#
#   node tools/sculpt/lowshot.mjs --who male --out /tmp/l/m --shmask --shdir 0.2195,0.5299,0.8192 --shsoft 0.04
#   SHMASK=/tmp/l/m/sheet-male.png SHDIR=0.2195,0.5299,0.8192 SHSOFT=0.04 SHK=within python3 tools/sculpt/lowlight.py ...
#
# The direction (15 degrees right of the camera, 32 up) and the softness are the ones whose mask best explains the
# references' change inside the facets, for both heads.
import sys, json, math, os
import numpy as np
from PIL import Image
who, idsf, dumpf, sheet = sys.argv[1:5]; order = int(sys.argv[5]); lam = float(sys.argv[6]); outf = sys.argv[7] if len(sys.argv) > 7 else None
HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, 'ref', 'head-lowpoly%s.png' % ('' if who == 'male' else '-female'))
cams = json.load(open(os.path.join(HERE, 'lowcams.json')))[who]
ref = np.asarray(Image.open(REF).convert('RGB').resize((1536, 1024)), dtype=float)
me = np.asarray(Image.open(sheet).convert('RGB').resize((1536, 1024)), dtype=float)
ids = np.frombuffer(open(idsf, 'rb').read(), dtype=np.int32); H = ids.size // (5 * 1536); ids = ids.reshape(5, H, 1536)
names = json.load(open(idsf + '.names.json')); D = json.load(open(dumpf))
views = ['front', 'q3', 'profile', 'r3', 'back']
AOLO = float(os.environ.get('AOLO','0.8'))

RIMS = os.environ.get('RIMS','1')=='1'
def rot(c):
  a, b = math.radians(c['yaw']), math.radians(c['pitch']); ca, sa, cb, sb = math.cos(a), math.sin(a), math.cos(b), math.sin(b)
  return np.array([[ca, 0, sa], [sb * sa, cb, -sb * ca], [-cb * sa, sb, cb * ca]])
def basis(n, sm=None):
  b = basis0(n)
  return b + [-t for t in sm] if SHM is not None else b
def basis0(n):
  x, y, z = n
  b = [1, x, y, z]
  if order >= 2: b += [x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y]
  if order >= 3: b += [y * (3 * x * x - y * y), x * y * z, y * (5 * z * z - 1), z * (5 * z * z - 3), x * (5 * z * z - 1), z * (x * x - y * y), x * (x * x - 3 * y * y)]
  if order >= 3 and RIMS:
    l = np.array([-0.95, 0.25, -0.2]); l = l / np.linalg.norm(l)
    b += [max(0.0, x * l[0] + y * l[1] + z * l[2]) ** 8, max(-x, 0) * (1 - max(z, 0)) ** 3, max(x, 0) * (1 - max(z, 0)) ** 3]
  return b
# The key light's cast shadow (lowshot.mjs): SHMASK=<sheet rendered with --shmask --shdir x,y,z --shsoft r> holds, per
# pixel, the share of the key light blocked times the facet's cosine to it; the colour there loses k (per channel) times
# that, k fitted with the light as one more term (the facet's mean of the mask), and the per-pixel error (px) judges
# where the shadow falls inside a facet. SHDIR, SHSOFT are written with it.
# Several lights may cast shadows: SHMASK, SHDIR and SHSOFT then hold one entry per light, separated by ';'.
SHMS = [np.asarray(Image.open(f).convert('L').resize((1536, 1024)), dtype=float) / 255 for f in os.environ['SHMASK'].split(';')] if os.environ.get('SHMASK') else []
SHM = np.stack(SHMS, -1) if SHMS else None
NS = len(SHMS)
rows = []
for vi, v in enumerate(views):
  I = ids[vi]; er = (I >= 0).copy()
  for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2)]: er[2:-2, 2:-2] &= (I[2 + dy:H - 2 + dy, 2 + dx:1534 + dx] == I[2:-2, 2:-2])
  R = rot(cams[v])
  for p in np.unique(I[er]):
    if D[p]['mat'] != 'skin' or names[p].startswith('ear'): continue
    m = er & (I == p); k = m.sum()
    if k < 30: continue
    n = np.array(D[p]['n']) if os.environ.get('HEAD') else R @ np.array(D[p]['n'])
    if (R @ n if os.environ.get('HEAD') else n)[2] < 0: n = -n
    occ = D[p]['ao']; aot = AOLO + (1.06 - AOLO) * occ * occ
    mpx = SHM[:H][m] if SHM is not None else np.zeros((k, 0))
    rows.append(dict(v=v, name=names[p], n=n, ref=ref[:H][m].mean(0), me=me[:H][m].mean(0), k=k, aot=aot, stub=names[p].startswith('stub'),
                     px=ref[:H][m], mpx=mpx))
lum = lambda c: c @ np.array([.299, .587, .114])
def r2(y, x, w):
  mx, my = np.average(x, weights=w), np.average(y, weights=w)
  sxy = np.sum(w * (x - mx) * (y - my)); return sxy * sxy / (np.sum(w * (x - mx) ** 2) * np.sum(w * (y - my) ** 2))
def report(tag, pred):
  out = []; tot = 0
  for v in views:
    sel = [i for i, r in enumerate(rows) if r['v'] == v and not r['stub']]
    y = np.array([lum(rows[i]['ref']) for i in sel]); x = np.array([lum(pred[i]) for i in sel]); w = np.array([rows[i]['k'] for i in sel], float)
    d = np.average(np.abs(x - np.average(x, weights=w) - y + np.average(y, weights=w)), weights=w); tot += d
    off = np.average(x - y, weights=w)
    out.append('%s %.3f/%.1f(%+.0f)' % (v, r2(y, x, w), d, off))
  print(tag, ' '.join(out), 'dsum %.1f' % tot)
report('ours', [r['me'] for r in rows])
# SHK=r,g,b[;r,g,b...]: the shadows' strengths held (measured off the reference's change inside the facets the shadow
# crosses, which the facets' means cannot tell from the light), not fitted
# SHK=within: each shadow's strength the slope of the reference's colour on its mask inside the facets (their means
# taken out), over the head's and the neck's facets (the stub takes no shadow), never below 0
def within():
  ys = np.concatenate([r['px'] - r['px'].mean(0) for r in rows if not r['stub']]); xs = np.concatenate([r['mpx'] - r['mpx'].mean(0) for r in rows if not r['stub']])
  return np.maximum(0, -np.linalg.lstsq(xs, ys, rcond=None)[0])
SHK = (within() if os.environ['SHK'] == 'within' else np.array([[float(t) for t in k.split(',')] for k in os.environ['SHK'].split(';')])) if os.environ.get('SHK') else None
if SHK is not None: print('shadow k held', SHK.round(1).tolist())
A = np.array([basis(r['n'], r['mpx'].mean(0)) for r in rows]); W = (np.array([r['k'] for r in rows], float) * np.array([0.5 if r['stub'] else 1 for r in rows])) ** float(os.environ.get('WPOW', '0.5'))
AOT = np.array([r['aot'] for r in rows])
Y = np.array([r['ref'] for r in rows]) / AOT[:, None]
if SHK is not None: Y = Y + np.array([r['mpx'].mean(0) @ SHK for r in rows]); A = A[:, :-NS]
# Anchors where the views show no facet (straight up, straight down, the far side): the hand-set rig's colour
# (lowshot.mjs --rig) over the whole sphere, scaled to the data, with a small weight, so the fitted light stays a light
# there instead of running off to blue or black
RIG = dict(amb=0.57, key=0.42, warm=0.32, cool=2, rim=0.42, upr=0.12, cspec=0.52, kx=-0.15, ky=1.4, lcz=0.35, lbz=-0.2, cpow=8, rpow=3)
if who == 'female': RIG.update(cool=0.2, cpow=0.8, ky=0.7)
def unit(v): v = np.array(v, float); return v / np.linalg.norm(v)
def rig(n):
  R = RIG; base = np.array([0.68, 0.49, 0.41]); k = 1.0
  dk, dr, dc = max(np.dot(n, unit([R['kx'], R['ky'], 0.84])), 0), max(np.dot(n, unit([1, 0.45, 0.05])), 0), max(np.dot(n, unit([-0.7, 0.6, R['lcz']])), 0)
  du = max(np.dot(n, unit([0.6, 0.75, 0.3])), 0); a = R['amb'] + 0.06 * max(n[1], 0)
  L = np.array([a * 1.02, a * 0.98, a * 0.94]) + R['key'] * dk * np.array([1, 0.97, 0.92]) + R['warm'] * dr * np.array([1.04, 0.96, 0.84]) + R['upr'] * du * du * np.array([1.08, 0.9, 0.86])
  cool = R['cool'] * max(np.dot(n, unit([-0.95, 0.25, R['lbz']])), 0) ** R['cpow']; rim = R['rim'] * max(-n[0], 0) * (1 - max(n[2], 0)) ** R['rpow']
  return 255 * (base * L + k * (R['cspec'] * dc ** 6 * np.array([0.12, 0.34, 0.6]) + cool * np.array([0.2, 0.27, 0.36]) + rim * np.array([0.5, 0.62, 0.85])))
anc = [unit((math.sin(t) * math.cos(f), math.cos(t), math.sin(t) * math.sin(f))) for t in np.linspace(0, math.pi, 13) for f in np.linspace(0, 2 * math.pi, 24, endpoint=False)]
anc = [n for n in anc if n[2] > -0.3]
Ar = np.array([rig(n) for n in anc]); Aa = np.array([basis(n, [0.0] * NS) for n in anc])
if SHK is not None: Aa = Aa[:, :-NS]
# the rig's colour scaled to the data's level: the data's mean over the rig's at the data's own normals
scale = np.average(Y, axis=0, weights=W ** 2).sum() / np.average(np.array([rig(r['n']) for r in rows]), axis=0, weights=W ** 2).sum()
wa = math.sqrt(float(os.environ.get('ANCHOR', '0.03')) * np.sum(W ** 2) / len(anc))
A = np.vstack([A, Aa]); Y = np.vstack([Y, Ar * scale]); W = np.concatenate([W, np.full(len(anc), wa)])
NROW = len(rows)
Cg, *_ = np.linalg.lstsq(A * W[:, None], Y * W[:, None], rcond=None)
A, Y, W = A[:NROW], Y[:NROW], W[:NROW]
if SHK is not None: Cg = np.vstack([Cg, SHK]); A = np.hstack([A, -np.array([r['mpx'].mean(0) for r in rows])])
if SHM is not None: print('shadow k', Cg[-NS:].round(1).tolist())
report('global', (A @ Cg) * AOT[:, None])
# per pixel, each view's mean taken out: how well the light and the shadow explain the colour inside the facets
def pxerr(pred):
  out = []; tot = 0
  for v in views:
    e = []; w = []
    for i, r in enumerate(rows):
      if r['v'] != v or r['stub']: continue
      # the facet's colour without its shadow term, then each pixel's own shadow
      if SHM is None: e.append(lum(r['px']) - lum(pred[i])); continue
      K = Cg[-NS:]  # NS x 3
      flat = pred[i] + (r['mpx'].mean(0) @ K) * r['aot']
      e.append(lum(r['px']) - (lum(flat) - (r['mpx'] @ lum(K)) * r['aot']))
    e = np.concatenate(e); d = np.mean(np.abs(e - e.mean())); tot += d; out.append('%s %.1f' % (v, d))
  print('px', ' '.join(out), 'sum %.2f' % tot)
  return tot
PXERR = pxerr((A @ Cg) * AOT[:, None])
P = np.zeros_like(Y); out = {'order': order, 'aolo': AOLO, 'global': (Cg[:-NS] if NS else Cg).T.tolist(), 'views': {}}
if NS:
  dirs = [[float(t) for t in d.split(',')] for d in os.environ['SHDIR'].split(';')]; softs = [float(t) for t in os.environ['SHSOFT'].split(';')]
  out['shadows'] = [dict(dir=dirs[i], k=[float(t) for t in Cg[-NS + i]], soft=softs[i % len(softs)]) for i in range(NS)]
nb = A.shape[1]
for v in views:
  sel = np.array([i for i, r in enumerate(rows) if r['v'] == v])
  Aw = A[sel] * W[sel, None]; Yw = Y[sel] * W[sel, None]
  sc = np.sum(W[sel] ** 2)
  M = Aw.T @ Aw + lam * sc * np.eye(nb); Cv = np.linalg.solve(M, Aw.T @ Yw + lam * sc * Cg)
  P[sel] = A[sel] @ Cv; out['views'][v] = (Cv[:-NS] if NS else Cv).T.tolist()
  # sanity: the light over the visible hemisphere
  g = [basis((math.sin(t) * math.cos(f), math.sin(t) * math.sin(f), math.cos(t)), [0.0] * NS) for t in np.linspace(0, 1.45, 12) for f in np.linspace(0, 6.28, 24)]
  lv = np.array(g) @ Cv
  if lv.min() < 20 or lv.max() > 300: print('  ', v, 'range', lv.min(0).round(), lv.max(0).round())
report('perview lam %g' % lam, P * AOT[:, None])
# TONE=g,b: the skin's green and blue over its red held at these ratios (her skin the male's tone, 2026-11-07)
if os.environ.get('TONE'):
  Yr = np.array([r['ref'] for r in rows]); w = np.array([r['k'] for r in rows], float); m = np.average(Yr, axis=0, weights=w)
  tg, tb = map(float, os.environ['TONE'].split(',')); f = [1, tg / (m[1] / m[0]), tb / (m[2] / m[0])]
  print('tone factors', np.round(f, 3))
  for k in ['global']: out[k] = [[c * f[ch] for c in out[k][ch]] for ch in range(3)]
  for v in out['views']: out['views'][v] = [[c * f[ch] for c in out['views'][v][ch]] for ch in range(3)]
  for sd in out.get('shadows', []): sd['k'] = [sd['k'][ch] * f[ch] for ch in range(3)]
# one light for every view (the default): the per-view lights are a diagnostic only, PERVIEW=1 writes them
if os.environ.get('PERVIEW') != '1': out['views'] = {}
if outf: json.dump(out, open(outf, 'w'))
Yr = np.array([r['ref'] for r in rows]); w = np.array([r['k'] for r in rows], float)
print('ref mean rgb', np.average(Yr, axis=0, weights=w).round(1), 'ratio', (np.average(Yr, axis=0, weights=w) / np.average(Yr, axis=0, weights=w)[0]).round(3))
