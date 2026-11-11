"""The leather chest's design numbers fitted to the approved trace: each number of the job nudged up and down by its step
(tools/sculpt/lowlchestfit.mjs rebuilds and renders, lowlchestfit.py measures), kept where the error drops, the steps
halved each round; the probes run 4 at a time (two numbers, each up and down), both moves kept when each helps and
together they still do. The error: over the job's groups and the views where each is built or traced, its edge error
(sheet pixels; 20 where only one of the two has it) plus 4 x (1 - its overlap), averaged; plus 10 x the share of the
pixels labelled with those groups where the two labels differ. Prints each kept move and the final numbers; writes them
over tools/sculpt/leather/chest-fit.json with --write.

  python3 tools/sculpt/lowlchestopt.py <work dir> <who> '<job json: { "groups": [...], "params": [[path, step], ...] }>'
      [--rounds 2] [--write]
  a path is the design's keys and indices with dots: back.panel.top, core.bottom.3, skirt.plates.6.bottom.1; or the
  cameras' under cams: cams.pose.abd, cams.views.q3.dp.0 (printed, not written: they belong in lowleatherchestcams.json)
"""
import sys, os, json, subprocess, copy
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(D))
work, who, job = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
rounds = int(sys.argv[sys.argv.index('--rounds') + 1]) if '--rounds' in sys.argv else 2
base = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', f"const L=await import('{D}/garments/leatherchest.mjs');const V=await import('{D}/lowleatherchestview.mjs');process.stdout.write(JSON.stringify({{...L.designOf('{who}'),cams:V.loadCams()['{who}']}}))"], cwd=ROOT))
def get(d, path):
    for k in path.split('.'): d = d[int(k)] if isinstance(d, list) else d[k]
    return d
def put(d, path, v):
    ks = path.split('.')
    for k in ks[:-1]: d = d[int(k)] if isinstance(d, list) else d[k]
    k = ks[-1]
    if isinstance(d, list): d[int(k)] = v
    else: d[k] = v
tops = sorted({p.split('.')[0] for p, _ in job['params']} - {'cams'})
camKeys = sorted({p.split('.')[1] for p, _ in job['params'] if p.startswith('cams.')})
def cost(Dd, slot=0):
    w = os.path.join(work, f's{slot}'); os.makedirs(w, exist_ok=True)
    over = {k: Dd[k] for k in tops}
    cams = ['--cams', json.dumps({k: Dd['cams'][k] for k in camKeys})] if camKeys else []
    r = subprocess.run(['node', f'{D}/lowlchestfit.mjs', w, '--who', who, '--design', json.dumps(over), *cams], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if r.returncode: print('  build failed:', r.stderr.decode()[-300:], flush=True); return 1e9
    subprocess.check_call([sys.executable, f'{D}/lowlchestfit.py', f'{w}/fit-{who}.json', f'{w}/opt.png', '--only', ','.join(job['groups'])], cwd=ROOT, stdout=subprocess.DEVNULL)
    T = json.load(open(f'{w}/opt.json')); c, n = 0, 0
    for g in job['groups']:
        for v, x in T.get(g, {}).items():
            if max(x[2], x[3]) < 150: continue
            e = x[1] if x[1] == x[1] and min(x[2], x[3]) > 0 else 20
            c += e + 4 * (1 - x[0]); n += 1
    m = T['_mismatch']
    return c / max(1, n) + 10 * sum(m.values()) / len(m)
pool = ThreadPoolExecutor(4)
Dd = copy.deepcopy(base); best = cost(Dd); print('start', round(best, 3), flush=True)
steps = {p: s for p, s in job['params']}
P = [p for p, _ in job['params']]
for r in range(rounds):
    for i in range(0, len(P), 2):
        pair = P[i:i + 2]; cands = []
        for p in pair:
            for dv in (steps[p], -steps[p]):
                E = copy.deepcopy(Dd); put(E, p, round(get(Dd, p) + dv, 4)); cands.append((p, E))
        cs = list(pool.map(lambda a: cost(a[1][1], a[0]), enumerate(cands)))
        won = {}
        for (p, E), c in zip(cands, cs):
            if c < best - 1e-3 and (p not in won or c < won[p][1]): won[p] = (E, c)
        if not won: continue
        if len(won) == 1:
            (p, (E, c)), = won.items(); print(f'  {p} {get(Dd, p)} -> {get(E, p)}: {c:.3f}', flush=True); Dd, best = E, c
        else:
            E = copy.deepcopy(Dd)
            for p, (Ep, _) in won.items(): put(E, p, get(Ep, p))
            c = cost(E)
            if c < min(x[1] for x in won.values()) - 1e-3: print('  ' + ', '.join(f'{p} {get(Dd, p)} -> {get(E, p)}' for p in won) + f': {c:.3f}', flush=True); Dd, best = E, c
            else:
                p, (E, c) = min(won.items(), key=lambda t: t[1][1]); print(f'  {p} {get(Dd, p)} -> {get(E, p)}: {c:.3f}', flush=True); Dd, best = E, c
    steps = {p: s / 2 for p, s in steps.items()}
    print('round', r + 1, round(best, 3), flush=True)
res = {k: Dd[k] for k in tops}
print('RESULT', json.dumps(res))
if camKeys: print('CAMS', json.dumps({k: Dd['cams'][k] for k in camKeys}))
if '--write' in sys.argv:
    fp = os.path.join(D, 'leather/chest-fit.json'); F = json.load(open(fp)); F.setdefault(who, {}).update(res); json.dump(F, open(fp, 'w')); print('wrote', fp)
