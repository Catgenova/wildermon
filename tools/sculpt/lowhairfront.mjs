// The swept-back hair's front mass (tools/sculpt/hairs/swept.mjs, the clump with `mass`, built by tools/sculpt/lowhair.mjs
// massOf) solved against the reference sheet: each corner off the skin along its ray from the skull's centre, by as much
// as makes the hair's outline meet the sheet's five silhouettes (tools/sculpt/lowhairhull.mjs maskOf), the front and the
// three-quarter most, all five at once, so a corner is placed by every view that sees it. Between the views the corners
// keep to a smooth envelope (each row its own drop under it: the creases `groove`), and nothing crosses the face.
// Coordinate descent from the hull's thickness. Writes tools/sculpt/hairs/swept-front.json { t: [[row][station]] } (head
// units on the male; the female takes them scaled to her skull).
//
//   node tools/sculpt/lowhairfront.mjs [--sweeps 30] [--fresh]
import { writeFileSync } from 'node:fs';
import { buildRig, add, mul } from './lowrig.mjs';
import { buildHair, crossings } from './lowhair.mjs';
import SWEPT from './hairs/swept.mjs';
import { carve, maskOf, raster, bodyTris, CAMS, VIEWS } from './lowhairhull.mjs';

/** Each view's weight in the fit (the front and the three-quarter, where the mass is most seen, the most). */
const WEIGHT = { front: 1.6, q3: 1.6, profile: 1, r3: 1, back: 1.2 };
const SPAN = { front: [40, 370], q3: [345, 660], profile: [650, 960], r3: [960, 1260], back: [1260, 1530] };
/** The envelope's bend penalty (per head unit of second difference, squared) and a crossing's. */
const SMOOTH = 40, CROSS = 3;
/** The least thickness of a corner, of a tuft's tip and of the sole behind it (so the tips' undersides clear the
 * forehead). */
const MIN = 0.03, TIP = 0.09, SOLE = 0.08;

export function solve({ sweeps = 30, fresh = false, log = true } = {}) {
  const H = carve('swept'), rig = buildRig('male'), B = rig.B;
  const cl = SWEPT.clumps.find((c) => c.mass), style = { ...SWEPT, clumps: SWEPT.clumps.map((c) => (c === cl && fresh ? { ...c, fit: null } : c)) };
  const hair = buildHair(rig, style, H), pc = hair.pieces.find((p) => p.mass), { ids, rays, rows: R, n } = pc.mass, k = hair.k;
  const C = hair.centre, drop = (i, j) => rays[i * n + j].drop;
  // the free corners: every one off the border
  // the sole and the tip lie on the forehead (cl.flush): not the solve's
  const fixed = (i, j) => cl.flush != null && rays[i * n + j].role !== '';
  const T = ids.map((row, i) => row.map((v, j) => { const r = rays[i * n + j]; return r.border ? null : (Math.hypot(...hair.verts[v].map((x, c) => x - C[c])) - r.r0) / k; }));
  for (let i = 1; i < R - 1; i++) for (let j = 1; j < n - 1; j++) if (!fixed(i, j)) T[i][j] = Math.max(least(i, j), T[i][j]);
  function least(i, j) { const role = rays[i * n + j].role; return role === 'sole' ? SOLE : role === 'tip' ? TIP : MIN + 0.01 - Math.min(0.01, drop(i, j)); }
  const place = (i, j) => { const r = rays[i * n + j]; hair.verts[ids[i][j]] = add(C, mul(r.d, r.r0 + T[i][j] * k)); };
  for (let i = 1; i < R - 1; i++) for (let j = 1; j < n - 1; j++) place(i, j);
  const mine = (pi) => pi >= pc.polys[0] && pi < pc.polys[1];
  const ftris = hair.tris.filter(([, , , pi]) => mine(pi));
  const others = hair.tris.filter(([, , , pi]) => !mine(pi) && !hair.polys[pi].buzz).map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]);
  // per view: the head's depth and the other pieces' cover, fixed; the XOR with the sheet's silhouette outside a box read
  // from a summed table
  const m = maskOf('swept'), W = m.w, Hh = m.h, body = bodyTris(B);
  const V = VIEWS.map((v) => {
    const c = CAMS[v], Z = new Float32Array(W * Hh).fill(-Infinity), cov = new Uint8Array(W * Hh);
    raster(body, c, Z, W, Hh, cov, 0); raster(others, c, Z, W, Hh, cov, 1);
    const [lo, hi] = SPAN[v], S = new Int32Array((W + 1) * (Hh + 1));
    let edge = 0;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, inSpan = x >= lo && x < hi, a = m.raw[i];
      const bad = inSpan && (a ? !cov[i] : cov[i]) ? 1 : 0;
      S[(y + 1) * (W + 1) + x + 1] = bad + S[y * (W + 1) + x + 1] + S[(y + 1) * (W + 1) + x] - S[y * (W + 1) + x];
      if (inSpan && a && (!m.raw[i - 1] || !m.raw[i + 1] || !m.raw[i - W] || !m.raw[i + W])) edge++;
    }
    return { v, c, Z, cov, S, edge, lo, hi };
  });
  const sum = (S, x0, y0, x1, y1) => S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
  const viewCost = (Vw) => {
    const tris = ftris.map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]);
    // the box the mass covers in this view
    let x0 = W, y0 = Hh, x1 = 0, y1 = 0;
    const proj = new Map();
    for (const t of tris) for (const p of t) {
      const a = (Vw.c.yaw * Math.PI) / 180, b = (Vw.c.pitch * Math.PI) / 180;
      const X = p[0], Y = p[1] - 1, Zz = p[2] - 0.1, qx = Math.cos(a) * X + Math.sin(a) * Zz, qy = Math.sin(b) * Math.sin(a) * X + Math.cos(b) * Y - Math.sin(b) * Math.cos(a) * Zz;
      const sx = Vw.c.cx + Vw.c.s * qx, sy = Vw.c.cy - Vw.c.s * qy;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    x0 = Math.max(Vw.lo, Math.floor(x0) - 1); x1 = Math.min(Vw.hi, Math.ceil(x1) + 2); y0 = Math.max(0, Math.floor(y0) - 1); y1 = Math.min(Hh, Math.ceil(y1) + 2);
    let bad = 0;
    if (x1 > x0 && y1 > y0) {
      const bw = x1 - x0, bh = y1 - y0, Z = new Float32Array(bw * bh), cov = new Uint8Array(bw * bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { Z[y * bw + x] = Vw.Z[(y + y0) * W + x + x0]; cov[y * bw + x] = Vw.cov[(y + y0) * W + x + x0]; }
      const c = { ...Vw.c, cx: Vw.c.cx - x0, cy: Vw.c.cy - y0 };
      raster(tris, c, Z, bw, bh, cov, 1);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const a = m.raw[(y + y0) * W + x + x0]; if (a ? !cov[y * bw + x] : cov[y * bw + x]) bad++; }
    }
    bad += sum(Vw.S, Vw.lo, 0, Vw.hi, Hh) - (x1 > x0 && y1 > y0 ? sum(Vw.S, x0, y0, x1, y1) : 0);
    return bad / Vw.edge;
  };
  // the face: the head's skin outside the scalp
  const scalp = new Set(hair.scalp);
  const face = B.tris.filter((t) => B.polys[t.poly].part === 'head' && !scalp.has(t.poly));
  const sub = { ...hair, tris: ftris };
  const crossN = () => crossings(rig, { ...sub, scalp: hair.scalp }, B.verts, hair.verts).n;
  const env = (i, j) => T[i][j] + drop(i, j);
  const smooth = () => {
    let s = 0;
    // (along a tuft from its lifted front back: the root, the sole and the tip fold under it)
    for (let i = 1; i < R - 1; i++) for (let j = 4; j < n - 2; j++) s += (env(i, j - 1) - 2 * env(i, j) + env(i, j + 1)) ** 2;
    for (let j = 1; j < n - 1; j++) for (let i = 3; i < R - 2; i++) s += (env(i - 1, j) - 2 * env(i, j) + env(i + 1, j)) ** 2;
    return s * SMOOTH;
  };
  const per = () => Object.fromEntries(V.map((Vw) => [Vw.v, +viewCost(Vw).toFixed(2)]));
  const cost = () => V.reduce((a, Vw) => a + WEIGHT[Vw.v] * viewCost(Vw), 0) + smooth() + CROSS * crossN();
  void face;
  let best = cost();
  if (log) console.log('start', best.toFixed(3), JSON.stringify(per()), 'crossings', crossN());
  for (let s = 0, step = 0.06; s < sweeps; s++) {
    let moved = 0;
    for (let i = 1; i < R - 1; i++) for (let j = 1; j < n - 1; j++) {
      if (fixed(i, j)) continue;
      for (const dt of [step, -step]) {
        const old = T[i][j], nt = Math.max(least(i, j), old + dt);
        if (nt === old) continue;
        T[i][j] = nt; place(i, j);
        const c = cost();
        if (c < best - 1e-6) { best = c; moved++; break; }
        T[i][j] = old; place(i, j);
      }
    }
    if (log) console.log('sweep', s, 'step', step.toFixed(3), 'cost', best.toFixed(3), 'moved', moved);
    if (!moved) { step /= 2; if (step < 0.004) break; }
  }
  if (log) console.log('end', best.toFixed(3), JSON.stringify(per()), 'crossings', crossN());
  return { t: T.map((row, i) => row.map((x, j) => (x === null ? null : +x.toFixed(4)))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const fit = solve({ sweeps: +opt('sweeps', 30), fresh: args.includes('--fresh') });
  writeFileSync(new URL('./hairs/swept-front.json', import.meta.url), JSON.stringify(fit));
  console.log('wrote tools/sculpt/hairs/swept-front.json');
}
