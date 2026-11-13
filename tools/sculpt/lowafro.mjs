// The afro (tools/sculpt/hairs/afro.mjs) for the low-poly bodies: the game's 'afro', "Afro". No reference sheet: built
// directly on each body's own skull as one closed shell (buildAfro):
//
//   rings    about an axis from the skull's middle tipped back (`tilt`), so the hairline lies near their equator all round:
//            the pole one point, each ring's points `step` degrees apart round it and the rings `step` apart down to the
//            hairline (each column's own: where the skin falls under the hairline's height, by the head's azimuth),
//            neighbouring rings zipped into triangles; the last rows (`hemRows`) the same count, the lower edge.
//   outline  each point stood off the skin to an egg round the head (wider than it, `centre` and radii), at least
//            `minThick` (the nape's short hair); over the lower edge the thickness falls as a quarter circle to the
//            hairline (`edgeFrom`), so the mass turns in under itself to the skin.
//   curls    domes about a Fibonacci spread of centres (`curlSpacing`, jittered) raise the outside, each corner jittered
//            besides: a lumpy, faceted surface; a face low among the domes (between two curls) in a valley's shade.
//   inside   coarser rings sunk into the scalp, closed to the hairline row by a thin rim.
//
// Rigid on the head. Kept off the face, the ears, the neck and the shoulders at rest and in the game's clips' poses
// (tools/sculpt/hairs/afro-poses-<who>.json, tools/sculpt/lowafroanim.mjs --write): clearBody.
//
//   node tools/sculpt/lowafro.mjs [--who female,male] [--raw]   # counts, open edges, crossings at rest and with the head
//                                                               # turned (--raw: before the clearance)
//   node tools/sculpt/lowafro.mjs --clear   # the clearance through every pose, into tools/sculpt/hairs/afro-clear-<who>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { crossings, openEdges, skinHair, shadeOf } from './lowhair.mjs';
import AFRO from './hairs/afro.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The furthest crossing of a ray from o along unit d with triangles (three points each), or 0. */
function farHit(tris, o, d) {
  let best = 0;
  for (const [a, b, c] of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > best) best = t;
  }
  return best;
}

/** A body's skull: the head's skin without the ears, and the neck's (the nape under the skull), as triangles; the
 * skull's middle; its size against the male's. */
function skullOf(B) {
  const P = (n) => B.verts[B.index.get(n)];
  const tris = B.tris.filter((t) => { const p = B.polys[t.poly]; return (p.part === 'head' && p.mat === 'skin' && !p.ear) || p.part === 'neck'; }).map((t) => t.v.map((i) => B.verts[i]));
  const k = (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79);
  return { tris, C: centreOf(B), k };
}

/** Piecewise-linear through [x, y] pairs. */
const pl = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + ((yb - ya) * (x - a)) / (b - a); }
  return pts.at(-1)[1];
};

/** Two rings (each a list of [vertex, angle in degrees round the axis, ascending in [0, 360)) zipped into triangles,
 * a's edges run forward, b's back (as a ring's quads: a_j, a_j+1, b_j+1, b_j). */
function zip(a, b, tri) {
  const na = a.length, nb = b.length, wrap = (x) => ((x % 360) + 360) % 360, sd = (x) => { const w = wrap(x); return w > 180 ? w - 360 : w; };
  const A0 = a[0][1];
  let j0 = 0, best = Infinity;
  b.forEach(([, t], j) => { const e = Math.abs(sd(t - A0)); if (e < best) { best = e; j0 = j; } });
  const B0 = A0 + sd(b[j0][1] - A0);
  const ua = (i) => A0 + wrap(a[i % na][1] - A0) + (i >= na ? 360 : 0);
  const ub = (j) => B0 + wrap(b[(j0 + j) % nb][1] - b[j0][1]) + (j >= nb ? 360 : 0);
  const bv = (j) => b[(j0 + j) % nb][0];
  let i = 0, j = 0;
  while (i < na || j < nb) {
    if (j >= nb || (i < na && ua(i + 1) <= ub(j + 1))) { tri([a[i % na][0], a[(i + 1) % na][0], bv(j)]); i++; } else { tri([a[i % na][0], bv(j + 1), bv(j)]); j++; }
  }
}

/**
 * The afro on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave, scalp,
 * centre, k, grid }. style: tools/sculpt/hairs/afro.mjs.
 */
export function buildAfro(rig, S = AFRO, { clear = true } = {}) {
  const B = rig.B, { tris: skullT, C, k } = skullOf(B);
  const P = (n) => B.verts[B.index.get(n)];
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? B.verts[i] : null)).filter(Boolean);
  const LM = { front: P('t0')[1], ear: Math.max(...ear.map((p) => p[1])), nape: P('bk')[1] };
  const line = S.hairline.map(([th, lm, dy]) => [th, LM[lm] + dy * k]);
  const yh = (th) => pl(line, th);
  // the rings' frame: the axis A tipped back, F its front, X the head's left
  const tau = rad(S.tilt), A = [0, Math.cos(tau), -Math.sin(tau)], F = [0, Math.sin(tau), Math.cos(tau)], X = [1, 0, 0];
  const dirAt = (psi, al) => { const p = rad(psi), a = rad(al); return unit(add(mul(A, Math.cos(p)), mul(add(mul(F, Math.cos(a)), mul(X, Math.sin(a))), Math.sin(p)))); };
  const memo = new Map();
  const rb = (d) => { const key = d.map((x) => x.toFixed(5)).join(); if (!memo.has(key)) memo.set(key, farHit(skullT, C, d)); return memo.get(key); };
  const azOf = (p) => deg(Math.atan2(Math.abs(p[0] - C[0]), p[2] - C[2]));
  // each column's hairline: the first angle from the pole where the skin falls under the hairline's height there
  const hairMemo = new Map();
  const psiH = (al) => {
    const key = Math.abs(((al + 540) % 360) - 180).toFixed(3);
    if (hairMemo.has(key)) return hairMemo.get(key);
    let prev = null, out = 150;
    for (let psi = 30; psi <= 170; psi += 0.5) {
      const d = dirAt(psi, al), p = add(C, mul(d, rb(d))), f = p[1] - yh(azOf(p));
      if (prev && prev.f >= 0 && f < 0) { out = prev.psi + (0.5 * prev.f) / (prev.f - f); break; }
      prev = { psi, f };
    }
    hairMemo.set(key, out);
    return out;
  };
  // the egg: the radius from the skull's middle along d to its surface
  const O = add(C, mul(S.centre, k));
  const envOf = (d) => {
    const g = (t) => { const p = sub(add(C, mul(d, t)), O); const rx = S.across * k, ry = (p[1] > 0 ? S.up : S.down) * k, rz = (p[2] > 0 ? S.forward : S.back) * k; return Math.hypot(p[0] / rx, p[1] / ry, p[2] / rz); };
    let lo = 0, hi = 4;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (g(m) < 1) lo = m; else hi = m; }
    return lo;
  };
  // the curls' centres: a Fibonacci spread over the sphere, each moved a little its own way
  const nCurl = Math.round((4 * Math.PI) / rad(S.curlSpacing) ** 2 * 0.9);
  const curls = [];
  for (let i = 0; i < nCurl; i++) {
    const y = 1 - (2 * (i + 0.5)) / nCurl, r = Math.sqrt(1 - y * y), ph = i * Math.PI * (3 - Math.sqrt(5));
    let c = [r * Math.cos(ph), y, r * Math.sin(ph)];
    const j = rad(S.curlSpacing) * S.curlJitter;
    c = unit(add(c, [(hash(i, 1) - 0.5) * 2 * j, (hash(i, 2) - 0.5) * 2 * j, (hash(i, 3) - 0.5) * 2 * j]));
    curls.push({ c, h: 0.75 + 0.5 * hash(i, 4) });
  }
  const rho = rad(S.curlSpacing) * 0.62;
  /** The curls' height at a direction (0 at a dome's foot, about 1 at its top) and the dome's index. */
  const curlAt = (d) => {
    let best = 0, who = -1;
    for (let i = 0; i < curls.length; i++) {
      const cs = dot(d, curls[i].c); if (cs < Math.cos(rho * 1.6)) continue;
      const a = Math.acos(Math.min(1, cs)) / rho, v = Math.max(0, 1 - a * a) * curls[i].h;
      if (v > best) { best = v; who = i; }
    }
    return { v: best, who };
  };
  // the rows: shares of the way from the pole to the hairline
  const nTop = Math.max(2, Math.round(92 / S.step));
  const u0 = S.hemRows[0];
  const rows = [];
  for (let i = 0; i <= nTop; i++) { const u = (i / nTop) * u0; if (u < u0 - 1e-6) rows.push(u); }
  rows.push(...S.hemRows);
  const N = Math.max(8, Math.round((360 * Math.sin(rad(92 * u0))) / S.step));
  const verts = [], polys = [], info = [];
  const V = (p, inf) => { verts.push(p); info.push(inf); return verts.length - 1; };
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const outerAt = (u, al, ri, ci) => {
    const psi = u * psiH(al), d = dirAt(psi, al), r0 = rb(d);
    const T = Math.max(0, envOf(d) - r0);
    // (the lower edge: the thickness falls as a quarter circle over the last rows)
    const ef = pl(S.edgeFrom, 180 - Math.abs(((al + 540) % 360) - 180));
    const e = u <= ef ? 1 : Math.sqrt(Math.max(0, 1 - ((u - ef) / (1 - ef)) ** 2));
    const last = u >= 1 - 1e-9;
    let r = last ? r0 + S.lip * k : r0 + Math.max(S.minThick * k, T * e);
    const fade = 1 - ramp(u, S.curlFade[0], S.curlFade[1]);
    const cu = curlAt(d);
    if (!last) r += (S.curlHeight * k * (cu.v - 0.5) + S.jitter * k * (hash(ri * 131 + 7, ci * 17 + 3) - 0.5) * 2) * fade;
    r = Math.max(r, r0 + (last ? S.lip : S.minThick * 0.6) * k);
    return { p: add(C, mul(d, r)), inf: { side: 'out', row: ri, u, al, curl: cu.v, fade, d, r0 } };
  };
  const ringsO = rows.map((u, ri) => {
    if (u === 0) return [[V(add(C, mul(A, rb(A) + Math.max(S.minThick * k, envOf(A) - rb(A)) + S.curlHeight * k * (curlAt(A).v - 0.5))), { side: 'out', row: 0, u: 0, curl: curlAt(A).v, fade: 1, d: A, r0: rb(A) }), 0]];
    const n = u >= u0 - 1e-6 ? N : Math.max(6, Math.round((360 * Math.sin(rad(92 * u))) / S.step));
    const off = ri % 2 ? 180 / n : 0;
    return Array.from({ length: n }, (_, j) => { const al = off + (360 * j) / n, o = outerAt(u, al, ri, j); return [V(o.p, o.inf), al]; });
  });
  const tri = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  // the outside: the pole's fan, then each ring zipped to the next
  for (let ri = 0; ri + 1 < ringsO.length; ri++) {
    const a = ringsO[ri], b = ringsO[ri + 1];
    if (a.length === 1) { b.forEach(([v], j) => tri([a[0][0], b[(j + 1) % b.length][0], v])); continue; }
    if (a.length === b.length && ri + 1 >= rows.length - S.hemRows.length) {
      // (the lower edge's rows: quads, the same count)
      for (let j = 0; j < a.length; j++) tri([a[j][0], a[(j + 1) % a.length][0], b[(j + 1) % b.length][0], b[j][0]], { under: ri + 1 === ringsO.length - 1 });
      continue;
    }
    zip(a, b, tri);
  }
  // the inside: coarser rings sunk into the scalp, its last at the hairline just inside the outside's
  const nIn = Math.max(2, Math.round(92 / S.innerStep));
  const ringsI = [];
  for (let i = 0; i <= nIn; i++) {
    const u = i / nIn;
    if (i === 0) { ringsI.push([[V(add(C, mul(A, rb(A) - S.sink * k)), { side: 'in', u: 0 }), 0]]); continue; }
    const n = i === nIn ? N : Math.max(6, Math.round((360 * Math.sin(rad(92 * u))) / S.innerStep));
    const off = i === nIn ? (ringsO.at(-1)[1] ? ringsO.at(-1)[0][1] : 0) : 0;
    ringsI.push(Array.from({ length: n }, (_, j) => {
      const al = i === nIn ? ringsO.at(-1)[j][1] : off + (360 * j) / n, psi = u * psiH(al), d = dirAt(psi, al), r0 = rb(d);
      const r = i === nIn ? r0 + S.innerLip * k : r0 - S.sink * k;
      return [V(add(C, mul(d, r)), { side: 'in', u, al, d, r0 }), al];
    }));
  }
  const inside = { valley: S.insideShade, inside: true };
  for (let ri = 0; ri + 1 < ringsI.length; ri++) {
    const a = ringsI[ri], b = ringsI[ri + 1];
    if (a.length === 1) { b.forEach(([v], j) => tri([a[0][0], v, b[(j + 1) % b.length][0]], inside)); continue; }
    zip(a, b, (v) => tri(v.slice().reverse(), inside));
  }
  // the rim: the hairline row to the inside's last
  const hemO = ringsO.at(-1), hemI = ringsI.at(-1);
  for (let j = 0; j < N; j++) tri([hemO[j][0], hemO[(j + 1) % N][0], hemI[(j + 1) % N][0], hemI[j][0]], { valley: S.undersideShade, rim: true });
  // orientation: outward (the outside wound one way; all turned if the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(verts[p.v[0]], cross(verts[p.v[j]], verts[p.v[j + 1]]));
  if (vol < 0) for (const p of polys) p.v.reverse();
  const hair = { verts, polys, info, weights: verts.map(() => [['head', 1]]), pieces: [{ id: 'afro', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }], centre: C, k: 1, grid: { ringsO, ringsI, rows, N } };
  shade(hair, S);
  trisOf(hair);
  hair.scalp = scalpOf(B, C, hair);
  hair.shave = hair.scalp;
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/** Each face's shade: the underside (the lower edge's last row) and the inside theirs; a face of the outside low among
 * the curls' domes (its corners' mean height under them) in a valley's, by how low. */
function shade(hair, S) {
  for (const p of hair.polys) {
    if (p.inside || p.rim) continue;
    if (p.under) { p.valley = S.undersideShade; continue; }
    const I = p.v.map((v) => hair.info[v]);
    const lo = 1 - I.reduce((a, q) => a + q.curl, 0) / I.length, f = Math.min(...I.map((q) => q.fade));
    Object.assign(p, shadeOf(Math.max(0, ((lo - S.valleyFrom) / (1 - S.valleyFrom)) * S.valleyGain * f)));
  }
  for (const p of hair.polys) { delete p.under; delete p.inside; delete p.rim; if (!p.valley) delete p.valley; }
}

/** The triangles: a quad's diagonal the shorter. */
function trisOf(hair) {
  const { verts, polys } = hair, tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    const [a, b, c, d] = p.v;
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  hair.tris = tris;
}

/** The scalp: the head's skin polygons (not the ears) the hair covers, every corner seen from the skull's middle. */
function scalpOf(B, C, hair) {
  const T = hair.tris.map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]), memo = new Map();
  const under = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))) > 0); return memo.get(vi); };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every(under)) out.push(i); });
  return out;
}

/**
 * The hair clear of the body at rest, in the game's clips' poses (tools/sculpt/hairs/afro-poses-<who>.json) and in POSES: a face
 * of it through the skin that is not the scalp it covers (the face, the ears, the neck, the shoulders) has its corners
 * moved out from the skull's middle `step` at a time (through the shoulders, raised), until none is. The rest first, then
 * the poses that still cross (all of them looked at again once those are clear, up to `rounds` times). The inside's
 * hairline row keeps under the outside's (its mate). Returns each moved vertex's offset.
 */
function clearBody(rig, hair, S, { step = 0.006, rounds = 3, log = false } = {}) {
  const { verts } = hair, C = hair.centre, start = verts.map((p) => [...p]);
  const hemO = hair.grid.ringsO.at(-1), hemI = hair.grid.ringsI.at(-1), mate = new Map(hemI.map(([v], j) => [v, hemO[j][0]]));
  let poses = [];
  try { poses = JSON.parse(readFileSync(join(DIR, `hairs/afro-poses-${rig.who}.json`), 'utf8')); } catch { /* none written */ }
  // (and the head turned and nodded further than the clips do, POSES)
  poses = [...poses, ...Object.entries(POSES).map(([n, p]) => ({ ...p, $clip: n }))];
  const states = [{ P: rig.B.verts, f: null, name: 'rest' }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f, name: pose.$clip }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  const settle = (active) => {
    for (let it = 0; it < 80; it++) {
      const hits = active.flatMap(hitsIn);
      if (!hits.length) return;
      const up = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'torso').flatMap(([hp]) => hair.polys[hp].v));
      for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
        const d = up.has(v) ? [0, 1, 0] : unit(sub(verts[v], C));
        verts[v] = add(verts[v], mul(d, step));
        const o = mate.get(v);
        if (o !== undefined) { const gap = dot(sub(verts[o], verts[v]), d); if (gap < 0.004) verts[o] = add(verts[o], mul(d, 0.004 - gap)); }
      }
    }
  };
  settle(states.slice(0, 1));
  let left = [];
  for (let r = 0; r < rounds; r++) {
    left = states.filter((st) => hitsIn(st).length);
    if (log) console.log(rig.who, 'clearance round', r, 'poses still crossing', left.length, left.slice(0, 8).map((s) => s.name).join(', '));
    if (!left.length) break;
    settle(left);
  }
  hair.clearedIn = left.map((st) => [st.name, hitsIn(st).length]);
  const off = {};
  verts.forEach((p, i) => { const d = sub(p, start[i]); if (Math.hypot(...d) > 1e-6) off[i] = d.map((x) => +x.toFixed(5)); });
  hair.moved = Object.keys(off).length;
  return off;
}

/** The clearance's offsets written by `--clear` (tools/sculpt/hairs/afro-clear-<who>.json), applied to a build with as
 * many vertices. */
function clearFromFile(rig, hair) {
  let F = null;
  try { F = JSON.parse(readFileSync(join(DIR, `hairs/afro-clear-${rig.who}.json`), 'utf8')); } catch { return false; }
  if (F.verts !== hair.verts.length || F.style !== JSON.stringify(AFRO)) return false;
  for (const [i, d] of Object.entries(F.off)) hair.verts[+i] = add(hair.verts[+i], d);
  hair.moved = Object.keys(F.off).length;
  return true;
}

const CACHE = new Map();
/** The afro on a body, once per body, with the clearance written by `--clear` (else cleared at rest alone). */
export function afroOf(rig, style = AFRO) {
  if (!CACHE.has(rig.who) || style !== AFRO) {
    const hair = buildAfro(rig, style, { clear: false });
    if (!clearFromFile(rig, hair)) clearBody(rig, hair, style, { rounds: 0 });
    if (style !== AFRO) return hair;
    CACHE.set(rig.who, hair);
  }
  return CACHE.get(rig.who);
}

/** The head turned and nodded (tools/sculpt/lowbraid.mjs's poses). */
export const POSES = { 'turn left': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, 'turn right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] }, nod: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] }, 'look up': { neck_01: [-10, 0, 0], neck_02: [-12, 0, 0], head: [-14, 0, 0] } };

/** The hair's crossings through the body, by where: the face (in front of the ears, below the brows), the ears, the
 * neck, the torso, the scalp's edge. */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const B = rig.B, r = crossings(rig, hair, P, Hv), out = { face: 0, ear: 0, neck: 0, torso: 0, edge: 0 };
  const C = hair.centre;
  for (const [, sp] of r.hits) {
    const poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
    out[poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear ? 'ear' : c[2] > C[2] + 0.35 && c[1] < C[1] + 0.25 ? 'face' : 'edge']++;
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildAfro(rig, AFRO, { clear: false });
    if (args.includes('--clear')) {
      // the clearance through every pose, written for afroOf
      const off = clearBody(rig, hair, AFRO, { log: true });
      writeFileSync(join(DIR, `hairs/afro-clear-${who}.json`), JSON.stringify({ built: 'node tools/sculpt/lowafro.mjs --clear', style: JSON.stringify(AFRO), verts: hair.verts.length, left: hair.clearedIn, off }) + '\n');
    } else if (!args.includes('--raw') && !clearFromFile(rig, hair)) clearBody(rig, hair, AFRO, { rounds: 0 });
    const vs = hair.polys.filter((p) => p.valley).length;
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'valley polys', vs, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'ring count', hair.grid.N, 'moved by the clearance', hair.moved ?? 0, 'left in', JSON.stringify(hair.clearedIn ?? []).slice(0, 80), 'ms', Date.now() - t0);
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
