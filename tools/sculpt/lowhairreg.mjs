// The swept-back hair's sheet cameras registered to a body's head (tools/sculpt/lowhaircams.json the man's,
// lowhaircams-female.json the woman's, read by
// tools/sculpt/lowhairhull.mjs project): per view its turn, tilt, scale and centre, and a 2D correction (roll, across
// stretch ax, shear sh: the sheet's face is drawn a little longer and narrower than the body's), fitted so that
//   - the body's landmarks land on the sheet's (tools/sculpt/lowhairsheet.py: the pupils, the brows' two ends, the
//     profile's nose tip and chin, the ears across), and
//   - the body's head and neck cover the sheet's skin and nothing of its background, in the rows from the hair's lower
//     edge down to the chin (CUT; the sheet's hair, which hides the skull, left out of the count).
// Coordinate descent from the last fit; the priors keep the correction small (roll 0, ax 1, sh 0). Prints each
// landmark's residual (px) and the outline's mean distance (px).
//
//   node tools/sculpt/lowhairreg.mjs [--who male|female] [--rounds 7] [--skull]   # --skull: by the skull and the hair, not the face (skullCost)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { project, raster, camsFile, camsFor, carve, hullSurface } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
export const SPAN = { front: [40, 370], q3: [345, 660], profile: [650, 960], r3: [960, 1260], back: [1260, 1530] };
/** The rows the outline counts in: from the hair's lower edge's highest down to the chin (the jaw in the views from
 * behind, the sheet's neck longer than his). */
const ROWS = { front: [95, 166], q3: [95, 166], profile: [95, 166], r3: [95, 172], back: [95, 172] };
/** Each landmark's weight per square pixel off, [across, up]: the ears across only (his sit lower than the sheet's), the
 * chin not at all (his face is longer): both reported. */
const MARK_W = { pupil: [6, 30], 'brow end': [6, 30], 'nose tip': [6, 6], chin: [0, 0], ear: [20, 0] }, PRIOR = { roll: 40, ax: 3e3, sh: 4e4 };
/** The back's turn held near straight behind (its ears and its skull's sides are each other's mirror; the rows it is fitted
 * in are few, under the hair): per square degree. */
const BACK_YAW = [180, 3];

export function sheetOf() {
  const S = JSON.parse(readFileSync(join(DIR, 'hairs/swept-sheet.json'), 'utf8'));
  const grid = (runs) => { const A = new Uint8Array(S.w * S.h); runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * S.w + r[k], y * S.w + r[k + 1]); }); return A; };
  return { ...S, F: grid(S.fig), Hm: grid(S.hair) };
}

/** The body's landmarks: the pupils' and the brows' middles and ends, the nose's tip, the chin. */
export function bodyMarks(B) {
  const mid = (ps) => [0, 1, 2].map((k) => ps.reduce((a, q) => a + q[k], 0) / ps.length);
  const of = (mat, s) => [...new Set(B.polys.filter((p) => p.mat === mat).flatMap((p) => p.v))].map((i) => B.verts[i]).filter((q) => Math.sign(q[0]) === s);
  const out = { pupils: [], brows: [] };
  for (const s of [-1, 1]) {
    out.pupils.push(mid(of('pupil', s)));
    const b = of('brow', s), ax = b.map((q) => Math.abs(q[0])), lo = Math.min(...ax), hi = Math.max(...ax);
    out.brows.push({ inner: mid(b.filter((q) => Math.abs(q[0]) < lo + 0.02)), outer: mid(b.filter((q) => Math.abs(q[0]) > hi - 0.02)), mid: mid(b) });
  }
  out.nose = B.polys.filter((p) => p.part === 'head').flatMap((p) => p.v).map((i) => B.verts[i]).reduce((a, q) => (q[2] > a[2] ? q : a));
  out.chin = B.verts[B.index.get('ch0')];
  out.ears = ['L', 'R'].map((sd) => mid(B.names.map((n, i) => (n && n.startsWith('ear.' + sd) ? B.verts[i] : null)).filter(Boolean)));
  return out;
}

/** The landmark pairs of a view under a camera: [name, sheet [x, y], body point]. */
export function pairsOf(v, c, S, M) {
  const sm = S.marks[v] ?? {}, out = [], px = (p) => project(p, c);
  const nearest = (list, at) => list.reduce((a, q) => (Math.hypot(px(q.mid ?? q)[0] - at[0], px(q.mid ?? q)[1] - at[1]) < Math.hypot(px(a.mid ?? a)[0] - at[0], px(a.mid ?? a)[1] - at[1]) ? q : a));
  for (const p of sm.pupils ?? []) out.push(['pupil', p, nearest(M.pupils, p)]);
  for (const b of sm.brows ?? []) {
    const ours = nearest(M.brows, b.mid), ends = [ours.inner, ours.outer].sort((a, q) => px(a)[0] - px(q)[0]);
    out.push(['brow end', b.a, ends[0]], ['brow end', b.b, ends[1]]);
  }
  if (sm.nose) out.push(['nose tip', sm.nose, M.nose]);
  if (sm.chin) out.push(['chin', sm.chin, M.chin]);
  for (const e of sm.ears ?? []) out.push(['ear', e, M.ears.reduce((a, q) => (Math.abs(px(q)[0] - e[0]) < Math.abs(px(a)[0] - e[0]) ? q : a))]);
  return out;
}

/** The head and neck as triangles. */
export const headTris = (B) => B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));

/** The outline's misfit in a view: the sheet's skin pixels the head leaves bare and the background it covers (the
 * sheet's hair left out), and that over the sheet's outline length (a mean distance, px). */
export function outlineOf(v, c, S, tris) {
  const [lo, hi] = SPAN[v], [y0, y1] = ROWS[v], Z = new Float32Array(S.w * S.h).fill(-Infinity), cov = new Uint8Array(S.w * S.h);
  raster(tris, c, Z, S.w, S.h, cov, 1);
  let bare = 0, over = 0, edge = 0;
  for (let y = y0; y < y1; y++) for (let x = lo; x < hi; x++) {
    const i = y * S.w + x;
    if (S.Hm[i]) continue;
    const f = S.F[i];
    if (f && !cov[i]) bare++; else if (!f && cov[i]) over++;
    if (f && (!S.F[i - 1] || !S.F[i + 1])) edge++;
  }
  return { bare, over, px: (bare + over) / Math.max(1, edge) };
}

/** The cameras from the fit's parameters: the sheet a turntable, so the tilt, the height scale and the pivot's row
 * are one for all five views (its brows and pupils sit on the same rows in every view); per view its turn, its
 * column, its across scale (as ax against the height's), a roll and a shear. */
export function camsOf(g) {
  return Object.fromEntries(VIEWS.map((v) => { const p = g[v]; return [v, { yaw: p.yaw, pitch: g.pitch, s: g.sv, cx: p.cx, cy: g.cy, roll: p.roll, ax: p.sx / g.sv, ay: 1, sh: p.sh }]; }));
}

/**
 * skull: the head registered by its skull and the hair only (for a body whose face is not the sheet's: hers), not by the
 * face: the ears across; the head's sides in the rows from the hair's lower edge to the ears' middle (SKULL_ROWS); and
 * above them the head with the hair's hull on it (the male's thickness on this skull, tools/sculpt/lowhairhull.mjs
 * hullSurface) against the sheet's hair and skin together. The face's landmarks still reported.
 */
const SKULL_ROWS = { front: [95, 128], q3: [95, 128], profile: [95, 128], r3: [95, 132], back: [95, 132] };
function skullCost(v, c, S, tris, hull) {
  const [lo, hi] = SPAN[v], Z = new Float32Array(S.w * S.h).fill(-Infinity), cov = new Uint8Array(S.w * S.h);
  raster(tris, c, Z, S.w, S.h, cov, 1); raster(hull, c, Z, S.w, S.h, cov, 1);
  let miss = 0;
  for (let y = 0; y < SKULL_ROWS[v][1]; y++) for (let x = lo; x < hi; x++) {
    const i = y * S.w + x, inHair = S.Hm[i], f = S.F[i];
    // (below the hair's top rows only the head's sides count: the face's own pixels are the sheet's face, not hers)
    if (y >= SKULL_ROWS[v][0] && !inHair && f && cov[i]) continue;
    if ((inHair || f) !== !!cov[i]) miss++;
  }
  return miss;
}

function fit(rounds, who, skull = false) {
  const rig = buildRig(who), B = rig.B, M = bodyMarks(B), tris = headTris(B), S = sheetOf();
  const HS = skull ? hullSurface(carve('swept'), rig) : null, hull = HS ? HS.tris.map(([a, b, c]) => [HS.verts[a], HS.verts[b], HS.verts[c]]) : null;
  const old = camsFor(who);
  const g = { pitch: old.front.pitch, sv: old.front.s * (old.front.ay ?? 1), cy: old.front.cy };
  for (const v of VIEWS) g[v] = { yaw: old[v].yaw, cx: old[v].cx, sx: old[v].s * (old[v].ax ?? 1), roll: old[v].roll ?? 0, sh: old[v].sh ?? 0 };
  const viewCost = (v, c) => {
    if (skull) {
      let m = 0;
      for (const [n, at, p] of pairsOf(v, c, S, M)) if (n === 'ear') { const q = project(p, c); m += MARK_W.ear[0] * (q[0] - at[0]) ** 2; }
      return skullCost(v, c, S, tris, hull) + m + PRIOR.roll * c.roll ** 2 + PRIOR.ax * (c.ax - 1) ** 2 + PRIOR.sh * c.sh ** 2 + (v === 'back' ? BACK_YAW[1] * (c.yaw - BACK_YAW[0]) ** 2 : 0);
    }
    const o = outlineOf(v, c, S, tris);
    let m = 0;
    for (const [n, at, p] of pairsOf(v, c, S, M)) { const q = project(p, c); m += MARK_W[n][0] * (q[0] - at[0]) ** 2 + MARK_W[n][1] * (q[1] - at[1]) ** 2; }
    return o.bare + o.over + m + PRIOR.roll * c.roll ** 2 + PRIOR.ax * (c.ax - 1) ** 2 + PRIOR.sh * c.sh ** 2 + (v === 'back' ? BACK_YAW[1] * (c.yaw - BACK_YAW[0]) ** 2 : 0);
  };
  const per = Object.fromEntries(VIEWS.map((v) => [v, viewCost(v, camsOf(g)[v])]));
  let best = Object.values(per).reduce((a, q) => a + q, 0);
  // (a per-view parameter moves that view's cost only; a shared one all five)
  const keys = [['pitch', 1], ['sv', 2], ['cy', 1.5], ...VIEWS.flatMap((v) => [[v + '.yaw', 2], [v + '.cx', 1.5], [v + '.sx', 2], [v + '.roll', 1], [v + '.sh', 0.03]])];
  const get = (k) => (k.includes('.') ? g[k.split('.')[0]][k.split('.')[1]] : g[k]);
  const set = (k, x) => { if (k.includes('.')) g[k.split('.')[0]][k.split('.')[1]] = x; else g[k] = x; };
  const tryIt = (k, x) => {
    const was = get(k); set(k, x);
    const cs = camsOf(g), views = k.includes('.') ? [k.split('.')[0]] : VIEWS, nv = {};
    for (const v of views) nv[v] = viewCost(v, cs[v]);
    const tot = best - views.reduce((a, v) => a + per[v], 0) + views.reduce((a, v) => a + nv[v], 0);
    if (tot < best) { best = tot; Object.assign(per, nv); return true; }
    set(k, was); return false;
  };
  for (let r = 0; r < rounds; r++) for (const [k, st0] of keys) {
    const st = st0 / 2 ** r;
    for (let it = 0; it < 16; it++) if (!tryIt(k, get(k) + st) && !tryIt(k, get(k) - st)) break;
  }
  const out = camsOf(g);
  for (const v of VIEWS) {
    const c = out[v];
    for (const k of Object.keys(c)) c[k] = +c[k].toFixed(4);
    const o = outlineOf(v, c, S, tris), res = pairsOf(v, c, S, M).map(([n, at, p]) => { const q = project(p, c); return n === 'ear' ? `ear across ${Math.abs(q[0] - at[0]).toFixed(2)}` : `${n} ${Math.hypot(q[0] - at[0], q[1] - at[1]).toFixed(2)}`; });
    console.log(v, JSON.stringify(c), `outline ${o.px.toFixed(2)} px; landmarks (px): ${res.join(', ')}`);
  }
  writeFileSync(camsFile(who), JSON.stringify(out, null, 1) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  fit(+opt('rounds', 7), opt('who', 'male'), args.includes('--skull'));
}
