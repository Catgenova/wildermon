// The feathered cap's design fitted to the hat sheet's silhouettes (tools/sculpt/lowhatfit.mjs) by a pattern search:
// under the registration's cameras (a lowhatfit.mjs --out run's hat-reg.json), the design's numbers named in PARAMS
// stepped one by one (steps halving) while the mean overlap over the views (the equipped view twice) grows. Prints the
// design found; garments/hat.mjs DESIGN takes it by hand.
//
//   node tools/sculpt/lowhatopt.mjs --reg <hat-reg.json> [--who male] [--rounds 3] [--loops 1] [--only brim,crown,feather,place]
//     (--loops n: n times the design searched, then the cameras searched again from where they were)
import { readFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { buildHat, DESIGN } from './garments/hat.mjs';
import { raster, VIEWS, fit } from './lowhatfit.mjs';
import { hairMesh } from './garments/hat.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const REG = JSON.parse(readFileSync(opt('reg'), 'utf8'));
const MASKS = JSON.parse(readFileSync(new URL('./leather/hat-masks.json', import.meta.url), 'utf8'));
const groups = opt('only', 'brim,crown,place').split(',');
const unpack = (m) => { const A = new Uint8Array(m.w * m.h); m.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * m.w + r[k], y * m.w + r[k + 1]); }); return A; };

/** The numbers searched: [path, step, low, high]. */
const PARAMS = {
  brim: [
    ...[0, 1, 2].map((i) => [`brim.R.${i}.1`, 0.12, 1.2, 2.6]),
    // (the front's drop held within the sheet's 0.10-0.18 H, 0.2-0.37: the brim clears the brow)
    ['brim.drop.0.1', 0.06, 0.2, 0.37], ...[1, 2, 3, 4, 5].map((i) => [`brim.drop.${i}.1`, 0.1, 0.2, 1.4]),
    ['brim.curve', 0.3, 0.8, 4],
  ],
  crown: [['sec.0.1', 0.04, 0.8, 1.2], ['sec.2.0', 0.08, 0.45, 1.0], ['sec.2.1', 0.05, 0.6, 1.1], ['sec.3.0', 0.08, 0.7, 1.3], ['sec.3.1', 0.06, 0.3, 1.0], ['apex', 0.08, 0.8, 1.6], ['oval.1', 0.04, 0.9, 1.25], ['oval.2', 0.04, 0.9, 1.25], ['band.h', 0.04, 0.18, 0.42]],
  feather: [0, 1].flatMap((f) => [[`feathers.${f}.len`, 0.12, 0.6, 1.8], [`feathers.${f}.w`, 0.03, 0.1, 0.3], [`feathers.${f}.dir.0`, 0.1, -0.2, 1], [`feathers.${f}.dir.1`, 0.1, 0.2, 1], [`feathers.${f}.dir.2`, 0.1, -1, 0.3]]),
  place: [['C.1', 0.05, 1.2, 1.8], ['C.2', 0.04, -0.3, 0.2], ['pitch', 2, -10, 15]],
};
const get = (o, p) => p.split('.').reduce((a, k) => a[k], o);
const set = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };

for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), H = hairMesh(who), D = structuredClone(DESIGN[who]);
  const B = rig.B, occ = [{ P: B.verts, tris: B.tris.filter((t) => t.v.every((i) => B.verts[i][1] > -1.6)).map((t) => t.v) }, { P: H.verts, tris: H.tris.map((t) => t.v) }];
  const views = VIEWS.map((v) => { const key = v === 'eq' ? (who === 'male' ? 'eqm' : 'eqf') : v, m = MASKS[key]; return { v, m, A: unpack(m), cam: REG[who][v].cam, wgt: v === 'eq' ? 2 : 1 }; });
  for (let loop = 0; loop < +opt('loops', 1); loop++) {
  if (loop > 0) { const R = fit(who, buildHat(rig, D), rig, { prev: Object.fromEntries(views.map((x) => [x.v, { cam: x.cam }])) }); for (const x of views) x.cam = R[x.v].cam; console.log(who, 'cameras', views.map((x) => `${x.v} y${x.cam.yaw.toFixed(0)} p${x.cam.pitch.toFixed(0)} s${x.cam.s.toFixed(1)}`).join(' ')); }
  const score = (d) => {
    let G; try { G = buildHat(rig, d); } catch { return -1; }
    const hat = { P: G.verts, tris: G.tris.map((t) => t.v) };
    let tot = 0, W = 0;
    for (const { v, m, A, cam, wgt } of views) {
      const O = raster(hat, v === 'eq' ? occ : [], cam, m.w, m.h);
      let b = 0, u = 0; for (let i = 0; i < A.length; i++) { if (A[i] && O[i]) b++; if (A[i] || O[i]) u++; }
      tot += wgt * b / u; W += wgt;
    }
    return tot / W;
  };
  const list = groups.flatMap((g) => PARAMS[g]);
  let best = score(D);
  console.log(who, 'start', best.toFixed(4));
  for (let r = 0; r < +opt('rounds', 3); r++) {
    for (const [p, st0, lo, hi] of list) {
      const st = st0 / 2 ** r;
      for (const sg of [1, -1]) {
        let moved = true;
        while (moved) {
          moved = false;
          const x = get(D, p), y = Math.max(lo, Math.min(hi, x + sg * st));
          if (y === x) break;
          set(D, p, y); const v = score(D);
          if (v > best + 1e-5) { best = v; moved = true; } else set(D, p, x);
        }
      }
    }
    console.log(who, 'round', r, best.toFixed(4));
  }
  }
  const r3 = (x) => (typeof x === 'number' ? +x.toFixed(3) : Array.isArray(x) ? x.map(r3) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, r3(v)])) : x);
  console.log(who, JSON.stringify(r3(D)));
  console.log(who, 'cams', JSON.stringify(Object.fromEntries(views.map((x) => [x.v, r3(x.cam)]))));
}
