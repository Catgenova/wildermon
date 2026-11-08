// The shawl's corrective shapes (tools/sculpt/garments/shawl.mjs SHAPES): offsets at bind for its vertices, added by
// weights driven from the body's pose (lowgarment.mjs poseIn, driveOf), so the cloth parts round the arms where its bones
// alone put it through them: over_l, over_r (an arm raised), side_l, side_r (raised out to the side), top (both raised
// forward, a blade over the head), cross_l, cross_r (a hand across the chest), impact (bent over, hands ahead). All
// nought at rest, idle, walking, arms out and arms forward.
//
//   node tools/sculpt/garments/shawlshapes.mjs [--who male,female] [--again] [--rounds 0] [--free 30] [--json <file>]
//     writes tools/sculpt/garments/shawlshapes-<who>.json (read by shawl.mjs buildShawl); --again starts from what is
//     there (after the shawl or the body changes)
//
// Each shape is two things (shawl.mjs shapesOf): a few numbers a column in the shawl's own section (`a` the cape turned
// about its top, `o` `h` the cape out and up, `ow` `hw` the cowl), and free offsets on the vertices it moves. Both are
// found against the poses that need them: the swing (src/sculpt/anim/clips/swing.ts, with the long sword) frame by frame
// and arms overhead (both, the left, the right, raised part way), every shape at its weight there, scored by the shawl's
// triangles crossing the body's, those crossing each other past the shawl's own without the shapes, and the front
// columns' vertices that rise past the cowl's rim (the cloth kept off the face).
//   --rounds: the columns' numbers, a window of five columns at a time a step either way, kept where the score drops.
//   --free: the free offsets: in every pose each shawl triangle through the body moved out of the body triangle's plane
//   the shorter way, each vertex less than it crosses the face's cap pulled down, the moves taken back to bind, shared
//   among the shapes by their weights, smoothed over the cloth (its thickness moving as one), and kept as far as the score
//   drops (a whole step, a half, a quarter).
import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRig, posed, skin, armsOut } from '../lowrig.mjs';
import { skinGarment, garmentFrames, crossPairs, triTri, shapeWeights, add, sub, mul, dot, cross, unit } from '../lowgarment.mjs';
import { buildShawl, shawlWeights, SHAPES, shapesOf } from './shawl.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROUNDS = +opt('rounds', '0'), FREE = +opt('free', '30'), ONLY = opt('who', 'male,female').split(',');
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
const inv3 = (m) => {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
};
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const axisAngle = (a, deg) => { const l = Math.hypot(...a), [x, y, z] = a.map((v) => v / l), t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), C = 1 - c; return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]; };

/** The poses the shapes are sculpted in: the swing's, and arms overhead (both, the left, the right). */
export function poses(rig) {
  const body = rig.who === 'male' ? 'man' : 'woman', sk = TS.lowSkeleton(body), held = TS.lowHeld(body);
  const fromClip = (t) => { const r = TS.clipLocal(sk, TS.SWING, t, held); const p = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') p[rig.bones[i].name] = m; }); return p; };
  const W = (bone, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm3(tr3(R), mm3(axisAngle([0, 0, 1], deg), R)); };
  const up = (p, s, deg) => { const m = s === 'l' ? 1 : -1; p[`clavicle_${s}`] = W(`clavicle_${s}`, m * 22 * deg / 140); p[`upperarm_${s}`] = W(`upperarm_${s}`, m * deg); p[`lowerarm_${s}`] = W(`lowerarm_${s}`, m * 8); return p; };
  return [
    ...[0, 0.1, 0.2, 0.23, 0.25, 0.27, 0.3, 0.33, 0.36, 0.4, 0.43, 0.46, 0.5, 0.56, 0.7, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.95, 1.0, 1.1, 1.2, 1.3, 1.4].map((t) => ({ id: `swing ${t}`, pose: fromClip(t) })),
    { id: 'overhead', pose: up(up({}, 'l', 140), 'r', 140) }, { id: 'overhead l', pose: up({}, 'l', 140) }, { id: 'overhead r', pose: up({}, 'r', 140) },
    { id: 'raised', pose: up(up({}, 'l', 110), 'r', 110) }, { id: 'raised l', pose: up({}, 'l', 110) },
    { id: 'overhead out', pose: armsOut(rig, up(up({}, 'l', 140), 'r', 140)) },
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
  const count = (X, T, pairs = null) => {
    let n = 0;
    for (let ti = 0; ti < T.length; ti++) {
      const t = T[ti];
      const A = t.v.map((v) => X[v]), [lo, hi] = box(A), seen = new Set();
      for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
        for (const k of g.get(`${x},${y},${z}`) ?? []) {
          if (seen.has(k)) continue; seen.add(k);
          const [l2, h2] = bb[k];
          if (lo[0] > h2[0] || l2[0] > hi[0] || lo[1] > h2[1] || l2[1] > hi[1] || lo[2] > h2[2] || l2[2] > hi[2]) continue;
          if (triTri(A, B[k])) { n++; pairs?.push([ti, k]); }
        }
      }
    }
    return n;
  };
  count.tris = B;
  return count;
}

/** How much a shape's numbers cost: their columns' unevenness and the move itself (a in degrees, o and h in body units). */
const SCALE = [30, 0.3, 0.3, 0.3, 0.3], EVEN = 1.5, SMALL = 0.3;
/** How far a column may go: a (degrees), o, h, ow, hw (body units). */
const BOUNDS = [[-30, 75], [-0.15, 0.7], [-0.3, 0.3], [-0.15, 0.7], [-0.3, 0.3]];
/** The cloth kept off the face: no vertex of a front column (within FRONT degrees of the front) higher in the chest's frame
 * than the cowl's rim at rest and RIM over it; each one that is costs FACE. */
const FRONT = 60, RIM = 0.15, FACE = 4;
/** How far a free offset moves a triangle off a body triangle's plane; what the free offsets cost (per square unit). */
const CLEAR = 0.04, FREE_COST = 0.5;
function shapeCost(q) {
  const N = q.length; let c = 0;
  for (let k = 0; k < N; k++) for (let j = 0; j < q[k].length; j++) { const x = q[k][j] / SCALE[j], dx = (q[k][j] - q[(k + 1) % N][j]) / SCALE[j]; c += EVEN * dx * dx + SMALL * Math.abs(x); }
  return c;
}

/**
 * The shapes for a body's shawl: S0 what to start from ({ columns, free }, shawl.mjs shapesOf), o.obstacles(rig, frames, P)
 * what else the cloth must clear in a pose besides the body, as triangles of three points (a garment worn under it, as
 * its sleeves). Returns { G, S } with G.shapes the shapes and S what to keep.
 */
export function sculpt(who, S0 = {}, o = {}, log = console.log) {
  const rig = buildRig(who), G = buildShawl(rig, undefined, { shapes: false });
  G.vw = shawlWeights(rig, G);
  const NC = G.cols.length, NV = G.verts.length, K = SHAPES.length, T = G.tris.map((t) => ({ v: t.v })), tris = rig.B.tris;
  G.shapes = SHAPES.map((s) => ({ ...s }));
  const Q = SHAPES.map((s) => (S0.columns?.[s.name] ?? G.cols.map(() => [0, 0, 0, 0, 0])).map((c) => (c.length === 3 ? [...c, c[1], c[2]] : [...c])));
  const R = SHAPES.map((s) => { const r = G.verts.map(() => [0, 0, 0]), f = S0.free?.[s.name]; if (f) f.at.forEach((i, k) => { r[i] = f.d.slice(k * 3, k * 3 + 3); }); return r; });
  const D = (Rr = R) => shapesOf(G, { columns: Object.fromEntries(SHAPES.map((s, k) => [s.name, Q[k]])) }).map((sh, k) => sh.d.map((v, i) => add(v, Rr[k][i])));
  // the poses, each with what its cloth needs to be posed with any offsets: skinned without shapes, each vertex's turn
  const PS = poses(rig).map((e) => {
    const fr = posed(rig, e.pose), P = skin(rig, fr), w = shapeWeights(rig, fr, G);
    const X0 = skinGarment(rig, fr, G, G.vw, []), M = skinTurns(rig, fr, G);
    const obstacles = [...tris.map((t) => t.v.map((i) => P[i])), ...(o.obstacles ? o.obstacles(rig, fr, P) : [])];
    const c = rig.at.get('spine_03'), C = mm3(fr[c].W, tr3(rig.bones[c].R));
    return { ...e, w, X0, M, Minv: M.map(inv3), body: bodyGrid(obstacles), self0: crossPairs(X0, T).length, upDir: [C[1], C[4], C[7]], up: (x) => mv(tr3(C), [x[0] - fr[c].P[0], x[1] - fr[c].P[1], x[2] - fr[c].P[2]])[1] };
  }).filter((e) => e.w.some((x) => x > 0));
  for (const e of PS) e.body0 = e.body(e.X0, T);
  const at = (e, d) => e.X0.map((x, i) => { let v = [0, 0, 0]; e.w.forEach((w, k) => { if (w > 0) v = add(v, [w * d[k][i][0], w * d[k][i][1], w * d[k][i][2]]); }); return add(x, mv(e.M[i], v)); });
  // the front columns' vertices, and how high the cowl's rim is at rest in the chest's frame
  const chest = rig.bones[rig.at.get('spine_03')].head, front = new Set();
  G.cols.forEach((c, k) => { if (Math.abs(((c.deg + 540) % 360) - 180) <= FRONT) for (const key of Object.keys(G.rings)) front.add(G.rings[key][k]); });
  const cap = Math.max(...G.rings.u1.map((i) => G.verts[i][1])) - chest[1] + RIM;
  const score = (e, d) => { const X = at(e, d); let face = 0; for (const i of front) if (e.up(X[i]) > cap) face++; return [e.body(X, T), crossPairs(X, T).length, face]; };
  const partOf = (e, d) => { const [xb, xs, face] = score(e, d); return xb + Math.max(0, xs - e.self0) + FACE * face; };
  const freeCost = (Rr) => Rr.reduce((a, r) => a + r.reduce((b, v) => b + dot(v, v), 0), 0) * FREE_COST;
  const total = (d, Rr = R) => PS.reduce((a, e) => a + partOf(e, d), 0) + Q.reduce((a, q) => a + shapeCost(q), 0) + freeCost(Rr);
  const report = (tag) => { const d = D(); log(who, tag, PS.map((e) => { const [xb, xs, face] = score(e, d); return `${e.id} [${e.w.map((x) => +x.toFixed(2)).join(' ')}]: ${e.body0}/${e.self0}->${xb}/${xs}${face ? ` face ${face}` : ''}`; }).join(', ')); };
  report('start');

  // the columns: a window of five columns round each, each number a step either way
  const WIN = [0.3, 0.7, 1, 0.7, 0.3], uses = SHAPES.map((_, k) => PS.map((e) => e.w[k] > 0));
  const part = PS.map(() => 0);
  const cost = (only) => { const d = D(); PS.forEach((e, p) => { if (only >= 0 && !uses[only][p]) return; part[p] = partOf(e, d); }); return part.reduce((a, x) => a + x, 0) + Q.reduce((a, q) => a + shapeCost(q), 0); };
  let best = cost(-1), step = [32, 0.3, 0.3, 0.3, 0.3].map((x) => x * (o.step ?? 1));
  for (let round = 0; round < (o.rounds ?? 0); round++) {
    let gained = 0;
    for (let s = 0; s < K; s++) for (let k = 0; k < NC; k++) for (let j = 0; j < 5; j++) {
      const was = WIN.map((_, m) => Q[s][(k + m - 2 + NC) % NC][j]);
      const put = (dx) => WIN.forEach((f, m) => { Q[s][(k + m - 2 + NC) % NC][j] = Math.min(BOUNDS[j][1], Math.max(BOUNDS[j][0], was[m] + f * dx)); });
      let pick = 0;
      for (const m of [1, -1]) { put(m * step[j]); const c = cost(s); if (c < best - 1e-9) { best = c; pick = m * step[j]; } }
      put(pick); cost(s);
      if (pick) gained++;
    }
    log(who, `columns, round ${round + 1}: cost ${best.toFixed(1)}, ${gained} moved`);
    step = step.map((x) => x / 2);
  }

  // the free offsets
  const nb = G.verts.map(() => new Set());
  for (const p of G.polys) p.v.forEach((a, k) => { const c = p.v[(k + 1) % p.v.length]; nb[a].add(c); nb[c].add(a); });
  const Rg = G.rings, groups = [];
  for (let k = 0; k < NC; k++) groups.push(['T0', 'IT'].map((r) => Rg[r][k]), ['T1', 'I1'].map((r) => Rg[r][k]), ['T5', 'I5'].map((r) => Rg[r][k]));
  const smooth = (U, passes) => {
    for (let p = 0; p < passes; p++) U = U.map((u, i) => { let m = [0, 0, 0]; for (const j of nb[i]) m = add(m, U[j]); return add(mul(u, 0.5), mul(m, 0.5 / nb[i].size)); });
    for (const g of groups) { const m = mul(g.reduce((a, i) => add(a, U[i]), [0, 0, 0]), 1 / g.length); for (const i of g) U[i] = m; }
    return U;
  };
  best = total(D());
  for (let it = 0; it < (o.free ?? 30); it++) {
    const d = D();
    // each pose's moves, taken back to bind, shared among its shapes by their weights
    const num = SHAPES.map(() => G.verts.map(() => [0, 0, 0])), den = SHAPES.map(() => new Array(NV).fill(0));
    for (const e of PS) {
      const X = at(e, d), pairs = [], need = G.verts.map(() => [0, 0, 0]);
      const want = (i, n, amt) => { const s2 = dot(need[i], n); if (s2 < amt) need[i] = add(need[i], mul(n, amt - s2)); };
      e.body(X, T, pairs);
      for (const [ti, k] of pairs) {
        const [a, b2, c] = e.body.tris[k], n = unit(cross(sub(b2, a), sub(c, a))), sd = T[ti].v.map((v) => dot(sub(X[v], a), n));
        // (out of the body triangle's plane the shorter way, out by preference)
        const out = sd.reduce((q, x) => q + Math.max(0, CLEAR - x), 0), inn = sd.reduce((q, x) => q + Math.max(0, CLEAR + x), 0);
        const dir = out <= 1.5 * inn ? 1 : -1;
        T[ti].v.forEach((v, m) => { const amt = Math.min(0.12, CLEAR - dir * sd[m]); if (amt > 0) want(v, mul(n, dir), amt); });
      }
      for (const i of front) { const h = e.up(X[i]) - cap; if (h > 0) want(i, mul(e.upDir, -1), h + 0.02); }
      need.forEach((u, i) => {
        if (!u[0] && !u[1] && !u[2]) return;
        const b = mv(e.Minv[i], u);
        e.w.forEach((w, k) => { if (w > 0) { num[k][i] = add(num[k][i], mul(b, w)); den[k][i] += w * w; } });
      });
    }
    const dR = num.map((r, k) => smooth(r.map((v, i) => (den[k][i] > 0 ? mul(v, 1 / (den[k][i] + 0.05)) : v)), 3));
    // (each shape's share taken as far as it lowers the score over the poses it weighs in: a whole step down to a
    // sixteenth)
    const took = [];
    PS.forEach((e, p) => { part[p] = partOf(e, D()); });
    for (let k = 0; k < K; k++) {
      const base = part.reduce((a, x) => a + x, 0) + freeCost(R);
      let pick = 0;
      for (const eta of [1, 0.5, 0.25, 0.125, 0.0625]) {
        const R2 = R.slice(); R2[k] = R[k].map((v, i) => add(v, mul(dR[k][i], eta)));
        const d2 = D(R2), p2 = part.slice();
        PS.forEach((e, p) => { if (uses[k][p]) p2[p] = partOf(e, d2); });
        if (p2.reduce((a, x) => a + x, 0) + freeCost(R2) < base - 1e-9) { R[k] = R2[k]; p2.forEach((x, p) => { part[p] = x; }); pick = eta; break; }
      }
      took.push(pick);
    }
    best = part.reduce((a, x) => a + x, 0) + freeCost(R) + Q.reduce((a, q) => a + shapeCost(q), 0);
    log(who, `free, pass ${it + 1}: cost ${best.toFixed(1)}, steps ${took.join(' ')}`);
    if (!took.some((x) => x)) break;
  }
  report('end');
  const d = D();
  G.shapes.forEach((sh, k) => { sh.d = d[k]; });
  // what to keep: the columns' numbers where a shape has any, the free offsets on the vertices they move
  const r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
  const S = {
    columns: Object.fromEntries(SHAPES.map((s, k) => [s.name, Q[k]]).filter(([, q]) => q.some((c) => c.some((x) => x))).map(([n, q]) => [n, q.map((c) => c.map(r3))])),
    free: Object.fromEntries(SHAPES.map((s, k) => { const at2 = R[k].map((v, i) => (v.some((x) => Math.abs(x) >= 5e-4) ? i : -1)).filter((i) => i >= 0); return [s.name, { at: at2, d: at2.flatMap((i) => R[k][i].map(r4)) }]; }).filter(([, f]) => f.at.length)),
  };
  return { rig, G, S };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const who of ONLY) {
    const here = new URL(`./shawlshapes-${who}.json`, import.meta.url);
    const S0 = args.includes('--again') && existsSync(here) ? JSON.parse(readFileSync(here, 'utf8')) : {};
    const { S } = sculpt(who, S0, { rounds: ROUNDS, free: FREE, step: +opt('step', '1') });
    const file = new URL(opt('json', `./shawlshapes-${who}.json`).replace('{who}', who), import.meta.url);
    writeFileSync(file, JSON.stringify({ built: 'node tools/sculpt/garments/shawlshapes.mjs', ...S }));
    console.log('wrote', file.pathname);
  }
}
