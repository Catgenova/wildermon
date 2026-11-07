// The low-poly bodies' hair (tools/sculpt/lowarm.mjs buildArmBody, rigged by tools/sculpt/lowrig.mjs): one separate
// mesh per style, fitted to each body's own skull, skinned to the head. A style (tools/sculpt/hairs/<id>.mjs, keyed by the
// game's HAIRSTYLES id in STYLES below) is a list of clumps and a shave:
//
//   clump: { id, path: [[yaw, rise, lift?], ...], w: [...], h: [...], sec?, ridge?, curl? }
//     path  the clump's spine on the skull (the stations evenly along its length): per control point the direction from the skull's centre (over, degrees about
//           the head's left-right axis: 0 straight ahead at the centre's level, 90 straight up, 180 straight back; out,
//           degrees toward the head's left, + its left, - its right) and how far off the skin the spine stands there
//           (head units). The spine runs through the points (Catmull-Rom), sampled
//           at `n` stations; the first and the last are the clump's tips, single points.
//     w, h  its width across the skull and its height off it, along the inner stations (the first value at the first
//           ring after the front tip, the last at the last ring before the back tip; between, evenly).
//     lip   the front ring's roots stand just off the skin (LIP), so the lock's front edge overhangs; float: every
//           ring's (a lip along the whole lock, as the fringe's lower edge over the forehead).
//     ends  [front, back]: how far each tip stands beyond its ring, as a share of the spline's own spacing (1 the
//           spline's end; less, a blunter end). tipUp: how high each tip stands off the spine, as a share of the
//           ring's height.
//     twist the upper corners leaned across by this share of their height (+ toward the head's left), along the inner
//           stations.
//     sec   its cross-section (or the name of one of the style's), [across (-0.5..0.5 of w), up (0..1 of h)] corners, the first and the last on the skin (sunk
//           SINK into it so the root never shows a gap); the corners' order runs from the head's right to its left.
//   jitter: the corners above the roots moved by up to this much (head units, where the roll is 0.2 high; less where it
//           is lower), each its own way (repeatably), so the rolls break into facets.
//   shave: the head's own polygons drawn in the shaved tone, as names of their corners (lowhead.mjs FACES, sides
//           dropped): every polygon whose corners are all in the set.
//
// buildHair(rig, style) -> { verts, polys: [{ v, piece }], tris: [[a, b, c, poly]], weights: [[bone, w], ...] per vertex,
// pieces: [{ id, polys: [first, end) }], shave: [body polygon indices], centre, checks }.
//
//   node tools/sculpt/lowhair.mjs [--who male|female] [--style swept]   # counts and checks
import { buildRig, posed, skin, add, sub, mul, dot, cross, unit, lerp } from './lowrig.mjs';
import SWEPT from './hairs/swept.mjs';
import { angOf, carve, outlineDiff } from './lowhairhull.mjs';

export const STYLES = { swept: SWEPT };
// (the game's 'undercut', "Shaved sides", may later take this style's shave with a top of its own)

const SINK = 0.04;
/** A corner's least height off the skin (a lock never thinner), and the gap under a lip's front edge. */
const MIN_H = 0.03, LIP = 0.015;

/** The skull: the head's skin without the ears, as triangles, and its centre (level with the brow's outer end, midway
 * between the forehead and the back of the skull). */
export function skullOf(B) {
  const P = (n) => B.verts[B.index.get(n)];
  const tris = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => t.v.map((i) => B.verts[i]));
  const centre = [0, P('b5.L')[1], (P('t0')[2] + P('bk')[2]) / 2];
  return { tris, centre };
}

/** Where a ray from o along unit d leaves the skull (its furthest crossing), and that triangle's outward normal. */
function hit(tris, o, d) {
  let best = -1, nrm = d;
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) / det;
    if (t > best) { best = t; nrm = unit(cross(e1, e2)); if (dot(nrm, d) < 0) nrm = mul(nrm, -1); }
  }
  return { t: best, n: nrm };
}

const dirOf = (over, out) => { const a = (over * Math.PI) / 180, b = (out * Math.PI) / 180; return [Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a)]; };
/** Catmull-Rom through points (arrays of numbers), at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
const at = (arr, u) => { const n = arr.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.min(n - 1, Math.floor(x)); return n ? arr[i] + (arr[i + 1] - arr[i]) * (x - i) : arr[0]; };

/** The style's clumps laid on the body's skull. With a hull (tools/sculpt/lowhairhull.mjs carve, the sheet's hair
 * carved from its silhouettes), each corner above the roots stands off the skin by its share of the hull's thickness
 * there (sec's up, of the hull rather than of h), so the locks fill the sheet's outline and their ridges and grooves
 * are the section's. */
export function buildHair(rig, style = SWEPT, hull = null) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B);
  // the skull's size against the male's, for the clumps' widths and heights
  const P = (n) => B.verts[B.index.get(n)];
  const k = (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79);
  const surf = (over, out) => { const d = dirOf(over, out), h = hit(skull, C, d); return { p: add(C, mul(d, h.t)), n: h.n, d }; };
  const verts = [], polys = [], pieces = [];
  // a point moved along its direction from the skull's centre to `b` of the hull's thickness off the skin there
  const onHull = (q, b) => {
    const dq = unit(sub(q, C)), hq = hit(skull, C, dq), [o, u] = angOf(dq);
    return add(C, mul(dq, hq.t + Math.max(MIN_H * k, b * hull.thick.at(o, u) * k * (style.hullScale ?? 1))));
  };
  for (const cl of style.clumps) {
    const n = cl.n ?? 9, sec = typeof cl.sec === 'string' ? style[cl.sec] : cl.sec ?? style.sec;
    const first = polys.length, base = verts.length;
    // the spine: each control point on the skin, stood off it by its lift along the skull's outward direction
    const ctrl = cl.path.map(([over, out, lift = 0]) => { const s = surf(over, out); return add(s.p, mul(unit(add(s.n, s.d)), lift * k)); });
    // the stations evenly along the spine's length
    const fine = Array.from({ length: 241 }, (_, i) => spline(ctrl, i / 240));
    const len = [0]; for (let i = 1; i < fine.length; i++) len.push(len[i - 1] + Math.hypot(...sub(fine[i], fine[i - 1])));
    const S = Array.from({ length: n }, (_, i) => {
      const want = (len[240] * i) / (n - 1); let j = 1; while (j < 240 && len[j] < want) j++;
      return lerp(fine[j - 1], fine[j], (want - len[j - 1]) / Math.max(1e-9, len[j] - len[j - 1]));
    });
    const ring = [];
    // the inner stations' share of the run, for the widths and heights (the tips have none)
    const ui = (i) => (i - 1) / Math.max(1, n - 3);
    for (let i = 0; i < n; i++) {
      // the skin under the station: the ray from the centre through it
      const d = unit(sub(S[i], C)), h0 = hit(skull, C, d), up = unit(add(h0.n, d));
      const T = unit(sub(S[Math.min(n - 1, i + 1)], S[Math.max(0, i - 1)]));
      const side = unit(cross(up, T)); // the head's left of the spine as it runs
      const nup = unit(cross(T, side));
      if (i === 0 || i === n - 1) {
        // a tip: drawn in toward its neighbour (ends: 1 the spline's own end, less blunter), raised off the spine
        const e = cl.ends ? cl.ends[i ? 1 : 0] : 1, nb = S[i ? n - 2 : 1];
        const hh = (i ? cl.h[cl.h.length - 1] : cl.h[0]) * k;
        const up0 = cl.tipUp ? cl.tipUp[i ? 1 : 0] : 0.4;
        let q = add(lerp(nb, S[i], e), mul(nup, hh * up0));
        if (hull) q = onHull(q, Math.max(up0, 0.15));
        verts.push(q);
        ring.push([verts.length - 1]);
        continue;
      }
      const w = at(cl.w, ui(i)) * k, hh = at(cl.h, ui(i)) * k, tw = cl.twist ? at(cl.twist, ui(i)) : 0;
      // the skin under the station: the spine's own height off it, so the roots sit on it however the spine is lifted
      const above = Math.max(0, dot(sub(S[i], h0.t > 0 ? add(C, mul(d, h0.t)) : S[i]), nup));
      const r = [];
      sec.forEach(([a, b], j) => {
        const root = j === 0 || j === sec.length - 1;
        const across = a + tw * b;
        let q = add(add(S[i], mul(side, -across * w)), mul(nup, root ? -above : b * hh));
        // a root on the skin under it, sunk into it
        // (at a lip, the front ring's roots stand just off the skin: the lock's front edge overhangs the forehead)
        if (root) { const dq = unit(sub(q, C)), hq = hit(skull, C, dq); if (hq.t > 0) q = add(C, mul(dq, hq.t + ((cl.lip && i === 1) || cl.float ? LIP * k : -SINK * k))); }
        else if (hull) q = onHull(q, b);
        if (!root && style.jitter) q = add(q, [0, 1, 2].map((c) => (hash(pieces.length * 101 + i * 7 + j, c) - 0.5) * 2 * style.jitter * Math.min(1, hh / (0.2 * k)) * k));
        verts.push(q);
        r.push(verts.length - 1);
      });
      ring.push(r);
    }
    // the faces: each band between two stations, a fan to each tip, outward
    const m = sec.length;
    const quad = (a, b, c, d) => polys.push({ v: [a, b, c, d], piece: pieces.length });
    for (let i = 1; i < n - 2; i++) for (let j = 0; j < m; j++) quad(ring[i][j], ring[i][(j + 1) % m], ring[i + 1][(j + 1) % m], ring[i + 1][j]);
    for (let j = 0; j < m; j++) {
      polys.push({ v: [ring[0][0], ring[1][(j + 1) % m], ring[1][j]], piece: pieces.length });
      polys.push({ v: [ring[n - 1][0], ring[n - 2][j], ring[n - 2][(j + 1) % m]], piece: pieces.length });
    }
    pieces.push({ id: cl.id, polys: [first, polys.length], verts: [base, verts.length] });
  }
  orientOut(verts, polys, pieces);
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else {
      // a quad split along its shorter diagonal, so it folds rather than twists
      const [a, b, c, d] = p.v, dac = Math.hypot(...sub(verts[a], verts[c])), dbd = Math.hypot(...sub(verts[b], verts[d]));
      if (dac <= dbd) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    }
  });
  const weights = weightsOf(rig, verts, style);
  const shave = shaveOf(B, style.shave);
  return { verts, polys, tris, weights, pieces, shave, centre: C, k };
}

/** Each piece's faces turned outward: the faces are built wound one way round the piece; all turned over where that
 * way encloses a negative volume. */
function orientOut(verts, polys, pieces) {
  for (const pc of pieces) {
    let vol = 0;
    for (let i = pc.polys[0]; i < pc.polys[1]; i++) {
      const v = polys[i].v;
      for (let j = 1; j + 1 < v.length; j++) vol += dot(verts[v[0]], cross(verts[v[j]], verts[v[j + 1]]));
    }
    if (vol < 0) for (let i = pc.polys[0]; i < pc.polys[1]; i++) polys[i].v.reverse();
  }
}

/** Every vertex on the head, rigid; a vertex low at the back (under the head's own pivot, toward the nape) takes some of
 * the upper neck, as the skin under it does. */
function weightsOf(rig, verts, style) {
  const head = rig.bones[rig.at.get('head')].head;
  const nape = style.nape ?? 0;
  return verts.map((p) => {
    const below = (rig.B.verts[rig.B.index.get('bk')][1] - p[1]);
    if (!nape || below <= 0 || p[2] > head[2]) return [['head', 1]];
    const w = Math.min(nape, below * nape * 4);
    return [['head', 1 - w], ['neck_02', w]];
  });
}

/** The body's polygons drawn shaved: every head polygon whose corners are all named in the set. */
export function shaveOf(B, names) {
  const S = new Set(names), out = [];
  B.polys.forEach((p, i) => {
    if (p.part !== 'head' || p.mat !== 'skin' || p.ear) return;
    if (p.v.every((v) => S.has((B.names[v] ?? '').replace(/\.[LR]$/, '')))) out.push(i);
  });
  return out;
}

/** The hair's vertices in a pose (frames from lowrig.mjs posed()). */
export function skinHair(rig, hair, frames) {
  return hair.verts.map((v, i) => {
    let x = [0, 0, 0];
    for (const [bn, w] of hair.weights[i]) {
      const bi = rig.at.get(bn), f = frames[bi], b = rig.bones[bi];
      const q = add(mvS(f.S, sub(v, b.head)), f.P);
      x = add(x, mul(q, w));
    }
    return x;
  });
}
const mvS = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/* ---- checks --------------------------------------------------------------------------------------------------------- */
/** Each piece closed (every edge in two of its faces, the two running it opposite ways). */
export function openEdges(hair) {
  const E = new Map();
  for (const p of hair.polys) p.v.forEach((a, j) => { const b = p.v[(j + 1) % p.v.length]; const key = a + ',' + b; E.set(key, (E.get(key) ?? 0) + 1); });
  let open = 0;
  for (const [key, c] of E) { const [a, b] = key.split(','); if (c !== 1 || E.get(b + ',' + a) !== 1) open++; }
  return open;
}

function triTri(A, Bt) {
  // segment-triangle tests both ways (the triangles of two meshes pass through each other)
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true;
  return false;
}

/** The hair's triangles that pass through the body's skin where it does not move with the head: the face and the
 * ears at rest (a clump fitted through them), the neck and the shoulders in a pose (the head turned or nodded onto them).
 * The clumps' roots sit in the scalp by design: the polygons in the shave set and the rigid scalp are left out. P, H: the
 * body's and the hair's vertices posed. */
export function crossings(rig, hair, P, H) {
  const B = rig.B, scalp = new Set(hair.shave);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso'].includes(p.part) && !(scalp.has(t.poly) && t.v.every(rigid)); });
  const bb = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const tb = skinT.map((t) => bb(t.v.map((i) => P[i])));
  const hits = [];
  for (const [a, b, c, pi] of hair.tris) {
    const A = [H[a], H[b], H[c]], ab = bb(A);
    for (let s = 0; s < skinT.length; s++) {
      if (ab.some(([lo, hi], k) => hi < tb[s][k][0] || lo > tb[s][k][1])) continue;
      if (triTri(A, skinT[s].v.map((i) => P[i]))) { hits.push([pi, skinT[s].poly]); break; }
    }
  }
  return { n: hits.length, hits };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const HULL = carve(opt('style', 'swept'));
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), hair = buildHair(rig, STYLES[opt('style', 'swept')], HULL);
    const rest = crossings(rig, hair, rig.B.verts, hair.verts);
    console.log(who, 'tris', hair.tris.length, 'pieces', hair.pieces.map((p) => `${p.id}:${(p.polys[1] - p.polys[0])}`).join(' '), 'open edges', openEdges(hair), 'shaved polys', hair.shave.length, 'crossings at rest', rest.n, JSON.stringify(rest.hits.slice(0, 6).map(([h, s]) => [h, rig.B.polys[s].name])));
    if (who === 'male') console.log('outline difference against the sheet (mean px):', Object.entries(outlineDiff(hair.tris.map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]))).map(([v, d]) => `${v} ${d.px}`).join(', '));
  }
}
