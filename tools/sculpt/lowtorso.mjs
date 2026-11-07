// The low-poly torsos (male and female) for the reference sheets in tools/sculpt/TORSO_SPEC.md and
// tools/sculpt/TORSO_SPEC_FEMALE.md, drawn by tools/sculpt/lowshot.mjs --torso and fitted by tools/sculpt/lowtfit.mjs:
//
//   node tools/sculpt/lowtorso.mjs [--who male|female]     # prints the triangle counts and checks the mesh is closed
//
// Units are the low-poly head's (tools/sculpt/lowhead.mjs): y up (the chin's underside at 0), z forward, x the body's
// left (the viewer's right in the front view). The torso begins at the head's neck foot, its ring nm0..nm5, taken from
// the head itself, so head plus torso is one continuous body: joined (buildLowBody), the torso replaces the head's
// shoulder stub and the head's neck replaces the torso's own neck. The torso's neck (part 'neck', from that ring up to a
// flat cut) is drawn only when the torso is shown alone, as the sheets show it.
//
// One half authored by name and mirrored. The surface is a grid of rows round the body, top to bottom (tr the
// trapezius and the clavicles; sd the shoulders' widest; da db dc the arm's cut from its top to the armpit, at the front
// the pectorals or the breasts from their top to their lower edge; ra rb rc the ribs and the abs; wa the waist; hi the
// hips' top; hw the hips' widest; bt the bottom cut's edge), each of nine columns from the front's centre line (0) round
// the side (4) to the back's centre line (8): 1 and 2 the front's planes (the abs' edge, the obliques' line), 3 the front's
// corner, 5 the back's corner, 6 and 7 the back's planes (the shoulder blades' and the lats' line, the spine's muscles).
// Cut flat: the neck's top, each arm (one face on rows da db dc, columns 3 to 5, as the sheets draw it), the hips.
// Her breasts: on rows da db dc, columns 0 to 2, a fan of facets round the point db1 (a middle ring br0..br7).
//
// Parts: torso (counted against the 400-800 triangle budget with the neck), neck. Regions, for the planes panel:
// shoulder, chest, abdomen, pelvis.

import { existsSync, readFileSync } from 'node:fs';
import { PRESETS as HEADS, buildLowHead } from './lowhead.mjs';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mx = (p) => [-p[0], p[1], p[2]];

export const ROWS = ['tr', 'sd', 'da', 'db', 'dc', 'ra', 'rb', 'rc', 'wa', 'hi', 'hw', 'bt'];
export const COLS = 9;
/** The head's neck foot, one half: nm0 at the front's centre line round to nm5 at the back's. */
export const NECK_FOOT = ['nm0', 'nm1', 'nm2', 'nm3', 'nm4', 'nm5'];
// Each of the neck foot's points meets the column of tr with this index; the columns between them close in triangles.
const FOOT_COL = [0, 1, 2, 4, 6, 8];
const ARM = { rows: ['da', 'db', 'dc'], cols: [3, 4, 5] };
const BREAST = { rows: ['da', 'db', 'dc'], cols: [0, 1, 2] };

/** The faces of one half, by vertex name: [names, part, name of the polygon]. */
export function halfFaces(breasts) {
  const F = [];
  const f = (v, part, name) => F.push({ v, part, name: name ?? v.join('-') });
  // the neck, standing alone: from the foot up to the flat cut nt0..nt5
  for (let i = 0; i < 5; i++) f([NECK_FOOT[i], NECK_FOOT[i + 1], `nt${i + 1}`, `nt${i}`], 'neck');
  // from the neck's foot to tr: a quad where the columns meet one to one, else a triangle to the column between and a quad
  for (let i = 0; i < 5; i++) {
    const a = NECK_FOOT[i], b = NECK_FOOT[i + 1], ja = FOOT_COL[i], jb = FOOT_COL[i + 1];
    if (jb - ja === 1) f([a, b, `tr${jb}`, `tr${ja}`], 'torso');
    else { f([a, `tr${ja + 1}`, `tr${ja}`], 'torso'); f([a, b, `tr${jb}`, `tr${ja + 1}`], 'torso'); }
  }
  const inArm = (r, j) => ARM.rows.indexOf(r) >= 0 && ARM.rows.indexOf(r) < 2 && j >= ARM.cols[0] && j < ARM.cols[2];
  const inBreast = (r, j) => breasts && BREAST.rows.indexOf(r) >= 0 && BREAST.rows.indexOf(r) < 2 && j >= BREAST.cols[0] && j < BREAST.cols[2];
  for (let i = 0; i + 1 < ROWS.length; i++) for (let j = 0; j < COLS - 1; j++) {
    const r = ROWS[i], s = ROWS[i + 1];
    if (inArm(r, j) || inBreast(r, j)) continue;
    f([`${r}${j}`, `${r}${j + 1}`, `${s}${j + 1}`, `${s}${j}`], 'torso');
  }
  // the arm's cut: one flat face
  f(['da3', 'da4', 'da5', 'db5', 'dc5', 'dc4', 'dc3', 'db3'], 'torso', 'arm cut');
  if (breasts) {
    const B = ['da0', 'da1', 'da2', 'db2', 'dc2', 'dc1', 'dc0', 'db0'];
    for (let k = 0; k < 8; k++) {
      const k1 = (k + 1) % 8;
      f([B[k], B[k1], `br${k1}`, `br${k}`], 'torso');
      f([`br${k}`, `br${k1}`, 'db1'], 'torso');
    }
  }
  return F;
}
/** The faces across the centre line, emitted once; a name with ' is the other side's vertex. */
export function spanFaces() {
  const ring = (p, n) => [...Array.from({ length: n }, (_, i) => `${p}${i}`), ...Array.from({ length: n - 2 }, (_, i) => `${p}${n - 2 - i}'`)];
  return [
    { v: ring('nt', 6), part: 'neck', name: 'neck cut' },
    { v: ring('bt', 9), part: 'torso', name: 'hip cut' },
  ];
}

/** The region of a face, for the planes panel: shoulder, chest, abdomen or pelvis. */
function regionOf(name, who) {
  if (name.startsWith('nt') || name === 'neck cut' || name.startsWith('nm')) return 'shoulder';
  const m = name.match(/^([a-z]{2})(\d)/);
  if (!m) return name === 'hip cut' ? 'pelvis' : name === 'arm cut' ? 'shoulder' : 'chest';
  const r = ROWS.indexOf(m[1]), j = +m[2];
  if (name.startsWith('br') || (who === 'female' && name.startsWith('da') && j < 2)) return 'chest';
  if (r <= 1) return j >= 1 && j <= 1 && r === 1 ? 'chest' : 'shoulder';
  if (r <= 3) return j <= 1 || (j === 2 && r <= 3) ? 'chest' : 'shoulder';
  if (r === 4) return j <= 2 ? 'abdomen' : j >= 6 ? 'abdomen' : 'abdomen';
  if (r >= 8) return 'pelvis';
  return 'abdomen';
}

/* ---- the two torsos --------------------------------------------------------------------------------------------- */
// A row below the arms: half-width W, the front's z F and the back's B at height y; the columns' share of W
// (front and back) and how square the section is (n: 2 an ellipse, higher squarer).
const SHARE = [0, 0.55, 0.8, 0.95, 1, 0.94, 0.7, 0.36, 0];
function ring(row, y, W, F, B, n = 2.6, dy = []) {
  const zc = (F + B) / 2, af = F - zc, ab = zc - B, out = {};
  for (let j = 0; j < COLS; j++) {
    const t = SHARE[j], g = Math.pow(Math.max(0, 1 - Math.pow(t, n)), 1 / n);
    const z = j < 4 ? zc + af * g : j > 4 ? zc - ab * g : zc;
    out[`${row}${j}`] = [+(t * W).toFixed(3), +(y + (dy[j] ?? 0)).toFixed(3), +z.toFixed(3)];
  }
  return out;
}

export const PRESETS = {
  male: {
    // measured off his reference: x and y of the front-facing points off the front view, of the back-facing off the back
    // view, z off the profile (66 sheet pixels a unit, the pivot [0, -2, 0] at the front view's (163, 239))
    V: {
      nt0: [0, 0.33, 0.39], nt1: [0.22, 0.35, 0.33], nt2: [0.42, 0.4, -0.02], nt3: [0.4, 0.45, -0.32], nt4: [0.24, 0.48, -0.46], nt5: [0, 0.49, -0.5],
      tr0: [0, -0.64, 0.55], tr1: [0.47, -0.59, 0.55], tr2: [0.85, -0.55, 0.45], tr3: [1.17, -0.53, 0.25], tr4: [1.45, -0.53, -0.05], tr5: [1.35, -0.5, -0.45], tr6: [0.91, -0.53, -0.85], tr7: [0.45, -0.45, -0.92], tr8: [0, -0.35, -0.88],
      sd0: [0, -0.88, 0.72], sd1: [0.5, -0.86, 0.78], sd2: [1.0, -0.79, 0.62], sd3: [1.5, -0.92, 0.38], sd4: [1.83, -1.06, 0], sd5: [1.5, -0.92, -0.55], sd6: [1.0, -0.7, -1.1], sd7: [0.5, -0.72, -1.12], sd8: [0, -0.72, -1.08],
      da0: [0, -1.11, 0.85], da1: [0.6, -1.11, 0.9], da2: [1.17, -1.03, 0.75], da3: [1.6, -1.55, 0.35], da4: [1.79, -1.6, 0], da5: [1.6, -1.55, -0.45], da6: [1.05, -1.0, -1.15], da7: [0.5, -1.0, -1.18], da8: [0, -1.0, -1.15],
      db0: [0, -1.48, 0.92], db1: [0.77, -1.45, 0.95], db2: [1.32, -1.26, 0.7], db3: [1.45, -1.66, 0.45], db5: [1.45, -1.66, -0.5], db6: [1.1, -1.3, -1.12], db7: [0.45, -1.3, -1.15], db8: [0, -1.3, -1.12],
      dc0: [0, -1.55, 0.82], dc1: [0.8, -1.81, 0.82], dc2: [1.17, -1.6, 0.6], dc3: [1.3, -1.66, 0.35], dc4: [1.32, -1.68, 0], dc5: [1.3, -1.66, -0.42], dc6: [1.1, -1.6, -1.05], dc7: [0.4, -1.56, -1.08], dc8: [0, -1.6, -1.05],
      ...ring('ra', -2.03, 1.14, 0.9, -0.9, 2.6, [0, -0.09, -0.21, -0.2, -0.15]),
      ...ring('rb', -2.38, 0.95, 0.85, -0.8, 2.6, [0, -0.06, -0.08, -0.05]),
      ...ring('rc', -2.73, 0.89, 0.79, -0.65, 2.6, [0, -0.03, 0.05, 0.1, 0.12, 0.1]),
      ...ring('wa', -3.0, 0.92, 0.76, -0.64),
      ...ring('hi', -3.3, 0.98, 0.76, -0.72, 2.6, [0, 0, 0.06, 0.04]),
      ...ring('hw', -3.6, 1.05, 0.72, -0.8, 2.6, [0, -0.08, -0.04, 0, 0.05]),
      ...ring('bt', -3.97, 0.55, 0.65, -0.55, 2.2),
    },
    breasts: false,
  },
};

/** The female torso: the same rows and columns, moved to her proportions, and her breasts. */
PRESETS.female = {
  V: {
    nt0: [0, 0.2, 0.22], nt1: [0.18, 0.21, 0.18], nt2: [0.3, 0.23, -0.05], nt3: [0.27, 0.25, -0.3], nt4: [0.18, 0.26, -0.44], nt5: [0, 0.27, -0.48],
    tr0: [0, -0.74, 0.3], tr1: [0.4, -0.66, 0.32], tr2: [0.85, -0.6, 0.22], tr3: [1.2, -0.62, 0.1], tr4: [1.38, -0.6, -0.12], tr5: [1.2, -0.56, -0.42], tr6: [0.8, -0.45, -0.6], tr7: [0.38, -0.42, -0.66], tr8: [0, -0.45, -0.68],
    sd0: [0, -0.88, 0.42], sd1: [0.42, -0.84, 0.48], sd2: [0.9, -0.8, 0.38], sd3: [1.36, -0.92, 0.18], sd4: [1.6, -1.05, -0.12], sd5: [1.36, -0.92, -0.45], sd6: [0.9, -0.7, -0.72], sd7: [0.42, -0.66, -0.78], sd8: [0, -0.7, -0.76],
    da0: [0, -1.08, 0.5], da1: [0.55, -0.98, 0.62], da2: [1.0, -1.0, 0.45], da3: [1.45, -1.32, 0.14], da4: [1.55, -1.32, -0.14], da5: [1.45, -1.32, -0.42], da6: [0.98, -0.95, -0.82], da7: [0.45, -0.92, -0.86], da8: [0, -0.95, -0.84],
    db0: [0, -1.38, 0.62], db1: [0.62, -1.42, 1.25], db2: [1.06, -1.4, 0.48], db3: [1.3, -1.48, 0.18], db5: [1.3, -1.48, -0.46], db6: [1.0, -1.2, -0.86], db7: [0.46, -1.18, -0.88], db8: [0, -1.2, -0.86],
    dc0: [0, -1.78, 0.6], dc1: [0.6, -1.85, 0.62], dc2: [1.0, -1.75, 0.4], dc3: [1.12, -1.6, 0.14], dc4: [1.1, -1.62, -0.16], dc5: [1.12, -1.6, -0.44], dc6: [0.98, -1.45, -0.84], dc7: [0.45, -1.42, -0.86], dc8: [0, -1.45, -0.84],
    br0: [0.22, -1.12, 0.85], br1: [0.58, -1.08, 1.0], br2: [0.92, -1.15, 0.85], br3: [1.0, -1.42, 0.9], br4: [0.9, -1.7, 0.95], br5: [0.58, -1.75, 1.0], br6: [0.24, -1.7, 0.85], br7: [0.18, -1.42, 0.9],
    ...ring('ra', -2.0, 0.92, 0.58, -0.84),
    ...ring('rb', -2.3, 0.85, 0.6, -0.78),
    ...ring('rc', -2.55, 0.8, 0.58, -0.72),
    ...ring('wa', -2.8, 0.78, 0.56, -0.7),
    ...ring('hi', -3.2, 0.95, 0.6, -0.86),
    ...ring('hw', -3.6, 1.12, 0.6, -1.0),
    ...ring('bt', -3.92, 0.8, 0.5, -0.82, 2.2),
  },
  breasts: true,
};

// The fitted vertices (tools/sculpt/lowtfit.mjs) over the hand-set ones: tools/sculpt/lowtfit-<who>.json, when present.
for (const who of Object.keys(PRESETS)) {
  const file = new URL(`./lowtfit-${who}.json`, import.meta.url);
  if (!existsSync(file)) continue;
  const fit = JSON.parse(readFileSync(file, 'utf8'));
  if (fit.V) PRESETS[who].V = { ...PRESETS[who].V, ...fit.V };
}

/* ---- the builder ------------------------------------------------------------------------------------------------ */
export function buildLowTorso(who = 'male', preset = null) {
  const P = preset ?? PRESETS[who];
  if (!P) throw new Error(`no torso ${who}`);
  // the neck's foot is the head's own, exactly
  const foot = HEADS[who].V;
  const V = { ...P.V };
  for (const n of NECK_FOOT) V[n] = [...foot[n]];
  const verts = [], polys = [];
  const vert = (p) => { verts.push(p); return verts.length - 1; };
  const ids = { 1: {}, [-1]: {} };
  for (const [name, p] of Object.entries(V)) {
    if (p[0] === 0) ids[1][name] = ids[-1][name] = vert([...p]);
    else { ids[1][name] = vert([...p]); ids[-1][name] = vert(mx(p)); }
  }
  // Every face wound to look out, away from the body's axis at its own height (the arm's cut away from the shoulder's
  // inside).
  const outward = (v, name) => {
    const pts = v.map((i) => verts[i]);
    const c = mul(pts.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / pts.length);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
    let ref;
    if (name === 'neck cut') ref = [0, 1, 0];
    else if (name === 'hip cut') ref = [0, -1, 0];
    else if (name === 'arm cut') ref = [Math.sign(c[0]), -0.6, 0];
    else ref = sub(c, [0, c[1], -0.15]);
    return dot(n, ref) < 0 ? [...v].reverse() : v;
  };
  const poly = (v, part, name, region) => polys.push({ v, part, region, mat: 'skin', name });
  for (const s of [1, -1]) {
    const sd = s > 0 ? 'R' : 'L';
    for (const f of halfFaces(P.breasts)) {
      const v = outward(f.v.map((n) => ids[s][n]), f.name);
      poly(v, f.part, f.name + ':' + sd, regionOf(f.name, who));
    }
  }
  const span = (n) => (n.endsWith("'") ? ids[-1][n.slice(0, -1)] : ids[1][n]);
  for (const f of spanFaces()) poly(outward(f.v.map(span), f.name), f.part, f.name, regionOf(f.name, who));

  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts, V, ids };
}

/** Each polygon fanned along its shorter diagonal (quads) or from its first point. */
function tris(v, verts) {
  if (v.length === 3) return [v];
  if (v.length === 4 && verts) {
    const [a, b, c, d] = v.map((i) => verts[i]);
    const behind = dot(cross(sub(b, a), sub(c, a)), sub(d, a)) < 0;
    return behind ? [[v[0], v[1], v[2]], [v[0], v[2], v[3]]] : [[v[0], v[1], v[3]], [v[1], v[2], v[3]]];
  }
  const out = [];
  for (let i = 1; i + 1 < v.length; i++) out.push([v[0], v[i], v[i + 1]]);
  return out;
}

/** The edges used by other than two faces (none, for a closed mesh with no T-junctions), and edges with a vertex lying
 * on them (a T-junction). Vertices at the same place are one. */
export function openEdges(mesh) {
  const key = (i) => mesh.verts[i].map((x) => x.toFixed(5)).join(',');
  const count = new Map();
  for (const p of mesh.polys) for (let i = 0; i < p.v.length; i++) {
    const a = key(p.v[i]), b = key(p.v[(i + 1) % p.v.length]);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count].filter(([, n]) => n !== 2);
}

/** Head and torso as one body: the head with its neck and without its shoulder stub, the torso without its own neck;
 * they meet at the neck's foot (nm0..nm5), the same points. */
export function buildLowBody(who = 'male') {
  const head = buildLowHead(who), torso = buildLowTorso(who);
  const verts = [], polys = [], at = new Map();
  const take = (m, keep) => {
    const map = new Map();
    m.polys.forEach((p) => {
      if (!keep(p)) return;
      const v = p.v.map((i) => {
        if (!map.has(i)) {
          const k = m.verts[i].map((x) => x.toFixed(6)).join(',');
          // the neck's foot: one point for the head and the torso
          if (at.has(k)) map.set(i, at.get(k)); else { verts.push([...m.verts[i]]); at.set(k, verts.length - 1); map.set(i, verts.length - 1); }
        }
        return map.get(i);
      });
      polys.push({ ...p, v });
    });
  };
  take(head, (p) => p.part !== 'shoulders');
  take(torso, (p) => p.part !== 'neck');
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  return { verts, polys, tris: triList };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--who');
  for (const who of i < 0 ? ['male', 'female'] : [args[i + 1]]) {
    const m = buildLowTorso(who);
    const n = m.tris.length;
    console.log(who, JSON.stringify(m.counts), 'triangles', n, n >= 400 && n <= 800 ? '(in 400-800)' : '(OUT of 400-800)', 'verts', m.verts.length, 'polys', m.polys.length);
    const open = openEdges(m);
    console.log('  torso alone: edges not shared by exactly two faces', open.length);
    // the joined body: any open edge not already open in the head alone (its brows' and lids' strips stand open in its
    // skin) is a gap at the seam
    const own = new Set(openEdges(buildLowHead(who)).map(([k]) => k));
    const seam = openEdges(buildLowBody(who)).filter(([k]) => !own.has(k));
    console.log('  head + torso: edges at the seam not shared by exactly two faces', seam.length);
  }
}
