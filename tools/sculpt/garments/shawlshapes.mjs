// The shawl's corrective shapes (tools/sculpt/garments/shawl.mjs SHAPES): offsets at bind for its vertices, added by a
// weight driven from the body's pose (lowgarment.mjs driveOf), so the cloth parts round the arms where its bones alone
// put it through them: `over_l`, `over_r` each arm raised over the shoulder, `cross_l`, `cross_r` each forearm brought
// across the front of the chest. The right's are the left's mirrored. At rest, idle, walking, arms out and arms forward
// every weight is 0.
//
//   node tools/sculpt/garments/shawlshapes.mjs [--who male,female] [--rounds 8] [--again]
//     writes tools/sculpt/garments/shawlshapes-male.json and shawlshapes-female.json (read by shawl.mjs buildShawl): each
//     shape's numbers a column; --again starts from the numbers there (after the shawl or the body changes)
//
// A shape is sculpted column by column in the shawl's own section (shawl.mjs: each column a section in its half-plane,
// radius r and height y), five numbers a column: `a` the cape below the cowl turned about its top (T0) up and out by a
// degrees; `o`, `h` the cape moved out from the axis and up; `ow`, `hw` the cowl. Each section keeps its shape (the cloth's
// thickness and the cowl's rolls), so the cloth does not fold through itself where a column moves; neighbouring columns
// are held to move alike. The numbers are found against the poses that need them: the swing (src/sculpt/anim/clips/swing.ts,
// with the long sword) through its guard, lift, top, blow and impact, and arms overhead (both, the left, the right): each
// number in turn tried a step either way and kept where it lowers, over all those poses at their weights, the shawl's
// triangles crossing the body's, plus those crossing each other past the shawl's own without the shapes, plus the
// columns' unevenness and a little of the move itself; the steps halved as it settles.
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRig, posed, skin } from '../lowrig.mjs';
import { skinGarment, garmentFrames, crossPairs, triTri, shapeWeights, add } from '../lowgarment.mjs';
import { buildShawl, shawlWeights, SHAPES, shapesOf } from './shawl.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROUNDS = +opt('rounds', '8'), ONLY = opt('who', 'male,female').split(',');
const ROOT = new URL('../../..', import.meta.url).pathname;
const bundle = await build({
  stdin: { contents: `export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly'; export { clipLocal } from './src/sculpt/anim/player'; export { SWING } from './src/sculpt/anim/clips/swing';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const mm3 = (a, c) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * c[j] + a[i * 3 + 1] * c[3 + j] + a[i * 3 + 2] * c[6 + j]));
const tr3 = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const axisAngle = (a, deg) => { const l = Math.hypot(...a), [x, y, z] = a.map((v) => v / l), t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c; return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]; };

/** The poses the shapes are sculpted in: the swing's, and arms overhead (both, the left, the right). */
export function poses(rig) {
  const body = rig.who === 'male' ? 'man' : 'woman', sk = TS.lowSkeleton(body), held = TS.lowHeld(body);
  const fromClip = (t) => { const r = TS.clipLocal(sk, TS.SWING, t, held); const p = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') p[rig.bones[i].name] = m; }); return p; };
  const W = (bone, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm3(tr3(R), mm3(axisAngle([0, 0, 1], deg), R)); };
  const up = (p, s, deg) => { const m = s === 'l' ? 1 : -1; p[`clavicle_${s}`] = W(`clavicle_${s}`, m * 22 * deg / 140); p[`upperarm_${s}`] = W(`upperarm_${s}`, m * deg); p[`lowerarm_${s}`] = W(`lowerarm_${s}`, m * 8); return p; };
  return [
    ...[0, 0.2, 0.36, 0.4, 0.43, 0.46, 0.5, 0.56, 0.82, 0.84, 0.86, 0.88, 0.9, 1.0, 1.2, 1.4].map((t) => ({ id: `swing ${t}`, pose: fromClip(t) })),
    { id: 'overhead', pose: up(up({}, 'l', 140), 'r', 140) }, { id: 'overhead l', pose: up({}, 'l', 140) }, { id: 'overhead r', pose: up({}, 'r', 140) },
    { id: 'raised', pose: up(up({}, 'l', 110), 'r', 110) },
  ];
}

/** Each garment vertex's skinning turn in a pose: Σ w S over its bones (the garment's own driven). */
function skinTurns(rig, frames, G) {
  const F = garmentFrames(rig, G, frames);
  return G.vw.map((l) => { const m = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const [bi, w] of l) F[bi].S.forEach((x, k) => { m[k] += w * x; }); return m; });
}

/** What the cloth must clear, as triangles (three points each) in a grid: the count of a garment's triangles crossing them. */
function bodyGrid(B) {
  const cell = 0.25, g = new Map(), box = (T) => [[0, 1, 2].map((j) => Math.min(T[0][j], T[1][j], T[2][j])), [0, 1, 2].map((j) => Math.max(T[0][j], T[1][j], T[2][j]))];
  const bb = B.map(box);
  bb.forEach(([lo, hi], k) => { for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) { const key = `${x},${y},${z}`; (g.get(key) ?? g.set(key, []).get(key)).push(k); } });
  return (X, T) => {
    let n = 0;
    for (const t of T) {
      const A = t.v.map((v) => X[v]), [lo, hi] = box(A), seen = new Set();
      for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
        for (const k of g.get(`${x},${y},${z}`) ?? []) {
          if (seen.has(k)) continue; seen.add(k);
          const [l2, h2] = bb[k];
          if (lo[0] > h2[0] || l2[0] > hi[0] || lo[1] > h2[1] || l2[1] > hi[1] || lo[2] > h2[2] || l2[2] > hi[2]) continue;
          if (triTri(A, B[k])) n++;
        }
      }
    }
    return n;
  };
}

/** How much a shape's numbers cost: their columns' unevenness and the move itself (a in degrees, o and h in body units). */
const SCALE = [30, 0.3, 0.3, 0.3, 0.3], EVEN = 1.5, SMALL = 0.3;
/** How far a column may go: a (degrees), o, h, ow, hw (body units). */
const BOUNDS = [[-30, 60], [-0.15, 0.5], [-0.3, 0.3], [-0.15, 0.5], [-0.3, 0.3]];
/** The cloth kept off the face: no vertex of a front column (within FRONT degrees of the front) higher in the chest's frame
 * than the cowl's rim at rest and RIM over it; each one that is costs FACE. */
const FRONT = 60, RIM = 0.15, FACE = 4;
function shapeCost(q) {
  const N = q.length; let c = 0;
  for (let k = 0; k < N; k++) for (let j = 0; j < q[k].length; j++) { const x = q[k][j] / SCALE[j], dx = (q[k][j] - q[(k + 1) % N][j]) / SCALE[j]; c += EVEN * dx * dx + SMALL * Math.abs(x); }
  return c;
}

/**
 * The shapes' columns' numbers for a body's shawl (G.cols: [a, o, h] each, the left shapes'; the right's their mirror's).
 * o.obstacles(rig, frames, P): what else the cloth must clear in a pose besides the body, as triangles of three points
 * (a garment worn under it, as its sleeves); o.Q the numbers to start from.
 */
export function sculpt(who, log = console.log, o = {}) {
  const rig = buildRig(who), G = buildShawl(rig, undefined, { shapes: false });
  G.vw = shawlWeights(rig, G);
  const N = G.cols.length, T = G.tris.map((t) => ({ v: t.v })), tris = rig.B.tris;
  G.shapes = SHAPES.map((s) => ({ ...s }));
  const left = SHAPES.filter((s) => s.drive.side === 'l').map((s) => s.name);
  const Q = (o.Q ?? left.map(() => G.cols.map(() => [0, 0, 0]))).map((q) => q.map((c) => (c.length === 3 ? [...c, c[1], c[2]] : c)));
  const D = () => shapesOf(G, Object.fromEntries(left.map((n, q) => [n, Q[q]]))).map((sh) => sh.d);
  const pairOf = left.map((n) => SHAPES.findIndex((s) => s.name === n.replace(/_l$/, '_r'))), leftAt = left.map((n) => SHAPES.findIndex((s) => s.name === n));
  // the poses, each with what its cloth needs to be posed with any offsets: skinned without shapes, each vertex's turn
  const PS = poses(rig).map((e) => {
    const fr = posed(rig, e.pose), P = skin(rig, fr), w = shapeWeights(rig, fr, G);
    const X0 = skinGarment(rig, fr, G, G.vw, []), M = skinTurns(rig, fr, G);
    const obstacles = [...tris.map((t) => t.v.map((i) => P[i])), ...(o.obstacles ? o.obstacles(rig, fr, P) : [])];
    const c = rig.at.get('spine_03'), C = mm3(fr[c].W, tr3(rig.bones[c].R));
    return { ...e, w, X0, M, body: bodyGrid(obstacles), self0: crossPairs(X0, T).length, up: (x) => mv(tr3(C), [x[0] - fr[c].P[0], x[1] - fr[c].P[1], x[2] - fr[c].P[2]])[1] };
  }).filter((e) => e.w.some((x) => x > 0));
  for (const e of PS) e.body0 = e.body(e.X0, T);
  const at = (e, d) => e.X0.map((x, i) => { let v = [0, 0, 0]; e.w.forEach((w, k) => { if (w > 0) v = add(v, [w * d[k][i][0], w * d[k][i][1], w * d[k][i][2]]); }); return add(x, mv(e.M[i], v)); });
  // the front columns' vertices, and how high the cowl's rim is at rest in the chest's frame
  const chest = rig.bones[rig.at.get('spine_03')].head, front = new Set();
  G.cols.forEach((c, k) => { if (Math.abs(((c.deg + 540) % 360) - 180) <= FRONT) for (const key of Object.keys(G.rings)) front.add(G.rings[key][k]); });
  const cap = Math.max(...G.rings.u1.map((i) => G.verts[i][1])) - chest[1] + RIM;
  const score = (e, d) => { const X = at(e, d); let face = 0; for (const i of front) if (e.up(X[i]) > cap) face++; return [e.body(X, T), crossPairs(X, T).length, face]; };
  // (each pose's part kept, and only the poses a shape weighs in worked out again when its numbers change)
  const part = PS.map(() => 0), uses = left.map((_, q) => PS.map((e) => e.w[leftAt[q]] > 0 || e.w[pairOf[q]] > 0));
  const cost = (only = -1) => {
    const d = D();
    PS.forEach((e, p) => { if (only >= 0 && !uses[only][p]) return; const [xb, xs, face] = score(e, d); part[p] = xb + Math.max(0, xs - e.self0) + FACE * face; });
    return part.reduce((a, x) => a + x, 0) + Q.reduce((a, q) => a + shapeCost(q), 0);
  };
  const report = (tag) => { const d = D(); log(who, tag, PS.map((e) => { const [xb, xs, face] = score(e, d); return `${e.id}: ${e.body0}/${e.self0}->${xb}/${xs}${face ? ` face ${face}` : ''}`; }).join(', ')); };
  report('start');
  // the moves: each number of a window of five columns round each column, the middle most (a fold of cloth moves together)
  const WIN = [0.3, 0.7, 1, 0.7, 0.3];
  let best = cost(), step = [32, 0.3, 0.3, 0.3, 0.3];
  for (let round = 0; round < ROUNDS; round++) {
    let gained = 0;
    for (let s = 0; s < Q.length; s++) for (let k = 0; k < N; k++) for (let j = 0; j < 5; j++) {
      const was = WIN.map((_, m) => Q[s][(k + m - 2 + N) % N][j]);
      const put = (dx) => WIN.forEach((f, m) => { Q[s][(k + m - 2 + N) % N][j] = Math.min(BOUNDS[j][1], Math.max(BOUNDS[j][0], was[m] + f * dx)); });
      let pick = 0;
      // (further steps too while the steps are long: a fold may cross more on its way before it clears)
      for (const m of round < 3 ? [1, -1, 2, -2, 3, -3] : [1, -1]) { const dx = m * step[j]; put(dx); const c = cost(s); if (c < best - 1e-9) { best = c; pick = dx; } }
      // (a move that helped, tried again further)
      if (pick) { put(2 * pick); const c = cost(s); if (c < best - 1e-9) { best = c; pick *= 2; } }
      put(pick);
      cost(s);
      if (pick) gained++;
    }
    log(who, `round ${round + 1}: cost ${best.toFixed(1)}, ${gained} moved, steps ${step.map((x) => +x.toFixed(3))}`);
    if (!gained || round % 2) step = step.map((x) => x / 2);
  }
  report('end');
  const d = D();
  G.shapes.forEach((sh, k) => { sh.d = d[k]; });
  return { rig, G, Q };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const who of ONLY) {
    const from = args.includes('--again') && existsSync(new URL(`./shawlshapes-${who}.json`, import.meta.url)) ? JSON.parse(readFileSync(new URL(`./shawlshapes-${who}.json`, import.meta.url), 'utf8')).columns : null;
    const { Q } = sculpt(who, console.log, from ? { Q: SHAPES.filter((x) => x.drive.side === 'l').map((x) => from[x.name].map((c) => [...c])) } : {});
    const file = new URL(opt('json', `./shawlshapes-${who}.json`).replace('{who}', who), import.meta.url);
    const columns = Object.fromEntries(SHAPES.filter((s) => s.drive.side === 'l').map((s, i) => [s.name, Q[i].map((c) => c.map((x) => +x.toFixed(3)))]));
    writeFileSync(file, JSON.stringify({ built: 'node tools/sculpt/garments/shawlshapes.mjs', columns }, null, 1));
    console.log('wrote', file.pathname);
  }
}
