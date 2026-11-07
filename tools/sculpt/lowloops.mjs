// The male body's extra edge loops for the rig (tools/sculpt/lowrig.mjs), put into buildArmBody's mesh
// (tools/sculpt/lowarm.mjs) after the parts are joined. Each loop's vertices lie ON the approved surface: each on one of
// its edges (a fraction t of the way from a to b), and each loop edge runs across one existing polygon, cutting it in two.
// So the rest silhouette and the facets stay as they were, but for the new edges inside faces that were flat
// (tools/sculpt/lowrigshot.mjs --only rings measures it). Every polygon holding a cut edge takes its new vertex, so no
// T-junctions.
//
//   nk   the neck's middle ring, halfway between the head's neck ring (g0..g3, n6) and the neck's foot (nm0..nm4): nine
//        vertices round the neck (nk0 at the front, nk1..nk4 each side)
//   ax   the front of the armpit (axilla), per arm: between the torso's arm cut (r: dc3 db3 da3) and the deltoid's ring
//        ja, from the armpit's floor (dc4) up the front to the shoulder's top (da4): arm/ax6, arm/ax7, arm/ax0
//   gf   the groin and the gluteal fold, per leg: a ring round the thigh's top between the hip row (gl) with the crotch
//        (cx) and the thigh's top ring (th): gf0 (groin, front) round the outside to gf6 (the gluteal fold, back), gf7
//        (under the buttock), gf8 (the crotch, inside) and gf9 (front of the crotch)
//   qp   the knuckles' second ring, palm side, per hand: across the four-finger mass's palm side between the knuckle
//        line (kp) and the middle line (mp), its ends at the back's outer knuckles (kb0, kb4): arm/qp0..arm/qp4
//
// Names follow the body's (lowrig.mjs buildNamedBody): .L the body's left, .R the right, arm/ before the arm's.

import { PRESETS as HEADS } from './lowhead.mjs';
import { buildLowTorso } from './lowtorso.mjs';
import { buildLowLegs } from './lowlegs.mjs';
import { buildLowArm, tris } from './lowarm.mjs';

const mx = (p) => [-p[0], p[1], p[2]];
const key = (p) => p.map((x) => x.toFixed(6)).join(',');
const sideOf = (p) => (p[0] > 1e-9 ? '.L' : p[0] < -1e-9 ? '.R' : '');

/** The body's vertices named by the parts' own names, .L or .R by side; null where no part names it (the head's closed
 * pieces). The legs are named by the leg they belong to (the left leg authored, the right its mirror), since the thigh's
 * crotch point (th6) lies a little over the centre line. */
export function nameVerts(who, verts) {
  const byKey = new Map();
  const put = (n, k) => { if (!byKey.has(k)) byKey.set(k, n); };
  const both = (V, pre = '') => { for (const [n, p] of Object.entries(V)) { put(pre + n + sideOf(p), key(p)); if (p[0] !== 0) put(pre + n + sideOf(mx(p)), key(mx(p))); } };
  both(HEADS[who].V);
  both(buildLowTorso(who).V);
  for (const [n, p] of Object.entries(buildLowLegs(who).V)) {
    if (p[0] === 0) put(n, key(p));
    else { put(n + '.L', key(p)); put(n + '.R', key(mx(p))); }
  }
  // the arm's names (fc, kb, tb...) are also the legs' and the head's: arm/ before them
  both(buildLowArm(who, null, { cap: false }).V, 'arm/');
  return verts.map((p) => byKey.get(key(p)) ?? null);
}

const flip = (n) => n.replace(/\.L$/, '.@').replace(/\.R$/, '.L').replace(/\.@$/, '.R');
/** The loops, by vertex names: { ring, closed, pts: [[a, b, t, name]], ends: [first, last] (an open loop's) }. */
export function loopSpecs() {
  const L = [];
  // the neck's middle ring: front centre, round the left, the nape, back round the right
  const NK = [['g0', 'nm0', 0], ['g1.L', 'nm1.L', 1], ['g2.L', 'nm2.L', 2], ['g3.L', 'nm3.L', 3], ['n6.L', 'nm4.L', 4]];
  const nk = NK.map(([a, b, k]) => [a, b, 0.5, `nk${k}${k ? '.L' : ''}`]);
  L.push({ ring: 'nk', closed: true, pts: [...nk, ...nk.slice(1).reverse().map(([a, b, t, n]) => [flip(a), flip(b), t, flip(n)])] });
  for (const s of ['.L', '.R']) {
    const S = (n) => n + s;
    // the front of the armpit: dc3 -> ja6, db3 -> ja7, da3 -> ja0 (the torso's ring r6, r7, r0 to the deltoid's ja)
    L.push({ ring: 'ax', closed: false, ends: [S('dc4'), S('da4')], pts: [['dc3', 'arm/ja6', 0.5, 'arm/ax6'], ['db3', 'arm/ja7', 0.5, 'arm/ax7'], ['da3', 'arm/ja0', 0.5, 'arm/ax0']].map(([a, b, t, n]) => [S(a), S(b), t, S(n)]) });
    // the groin and the gluteal fold: each rung from the hip row (or the crotch) to the thigh's top ring
    const GF = [['gl1', 'th0'], ['gl2', 'th1'], ['gl3', 'th1'], ['gl4', 'th2'], ['gl5', 'th3'], ['gl6', 'th3'], ['gl7', 'th4'], ['gl8', 'th5'], ['cx', 'th6'], ['gl0', 'th7']];
    const C = (n) => (['gl0', 'gl8', 'cx'].includes(n) ? n : S(n));
    L.push({ ring: 'gf', closed: true, pts: GF.map(([a, b], k) => [C(a), S(b), TGF[k], S(`gf${k}`)]) });
    // the knuckles' palm-side second ring
    L.push({ ring: 'qp', closed: false, ends: [S('arm/kb0'), S('arm/kb4')], pts: [0, 1, 2, 3, 4].map((k) => [S(`arm/kp${k}`), S(`arm/mp${k}`), 0.35, S(`arm/qp${k}`)]) });
  }
  return L;
}
// the groin ring's place along each rung (from the hip row toward the thigh's top): nearer the thigh at the back (the
// gluteal fold under the buttock), halfway at the front and the crotch
const TGF = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.55, 0.55, 0.5, 0.5];

/**
 * The loops put into a joined body { verts, polys }: returns the new { verts, polys } (polygons cut in two keep their
 * part, region and material; their names gain /a, /b; each piece's `nv` is the whole face's outline, whose normal it is
 * shaded by, so a face cut by a loop is still drawn as the one facet it was) and `added`, [index, name] of each new vertex.
 */
export function addLoops(body, who = 'male') {
  const verts = body.verts.map((p) => [...p]);
  let polys = body.polys.map((p, k) => ({ ...p, v: [...p.v], src: k }));
  // each first polygon's outline, the new vertices on its edges put in: the face its pieces are drawn as (one normal)
  const outline = body.polys.map((p) => [...p.v]);
  const names = nameVerts(who, verts);
  const at = new Map();
  names.forEach((n, i) => { if (n) at.set(n, i); });
  const id = (n) => { const i = at.get(n); if (i === undefined) throw new Error(`loops: no vertex ${n}`); return i; };
  const added = [];
  const splitEdge = (a, b, t, name) => {
    const p = verts[a].map((x, k) => x + (verts[b][k] - x) * t), i = verts.length;
    verts.push(p); at.set(name, i); added.push([i, name]);
    let n = 0;
    for (const q of [...polys, ...outline.map((v) => ({ v }))]) {
      for (let k = 0; k < q.v.length; k++) {
        const u = q.v[k], w = q.v[(k + 1) % q.v.length];
        if ((u === a && w === b) || (u === b && w === a)) { q.v.splice(k + 1, 0, i); n++; break; }
      }
    }
    if (!n) throw new Error(`loops: ${name}: no edge ${names[a]}-${names[b]}`);
    return i;
  };
  const cut = (u, w, tag) => {
    const qi = polys.findIndex((q) => { const iu = q.v.indexOf(u), iw = q.v.indexOf(w); if (iu < 0 || iw < 0) return false; const d = Math.abs(iu - iw); return d !== 1 && d !== q.v.length - 1; });
    if (qi < 0) throw new Error(`loops: ${tag}: no polygon across ${u}-${w}`);
    const q = polys[qi], iu = q.v.indexOf(u), iw = q.v.indexOf(w), n = q.v.length;
    const A = [], Bv = [];
    for (let k = iu; ; k = (k + 1) % n) { A.push(q.v[k]); if (k === iw) break; }
    for (let k = iw; ; k = (k + 1) % n) { Bv.push(q.v[k]); if (k === iu) break; }
    polys.splice(qi, 1, { ...q, v: A, name: `${q.name}/a` }, { ...q, v: Bv, name: `${q.name}/b` });
  };
  for (const L of loopSpecs()) {
    const ids = L.pts.map(([a, b, t, n]) => splitEdge(id(a), id(b), t, n));
    const chain = L.closed ? [...ids, ids[0]] : [id(L.ends[0]), ...ids, id(L.ends[1])];
    for (let k = 0; k + 1 < chain.length; k++) cut(chain[k], chain[k + 1], L.ring);
  }
  // the triangles of every polygon again (a cut polygon's own; the rest as they were)
  for (const p of polys) { if (p.v.length !== outline[p.src].length) p.nv = outline[p.src]; delete p.src; }
  const triList = [];
  polys.forEach((p, pi) => { for (const t of tris(p.v, verts)) triList.push({ v: t, part: p.part, region: p.region, mat: p.mat, poly: pi }); });
  const counts = {};
  for (const t of triList) counts[t.part] = (counts[t.part] ?? 0) + 1;
  return { verts, polys, tris: triList, counts, added };
}
