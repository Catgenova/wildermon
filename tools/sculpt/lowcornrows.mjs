// Cornrows (tools/sculpt/hairs/cornrows.mjs) for the low-poly bodies: the game's 'cornrows', "Cornrows". Rows of flat
// plaits on the skull (tools/sculpt/lowhair.mjs skullOf: the head's skin without the ears), each row a path round the
// skull from the forehead's hairline over the crown to the nape, and along it a chain of links:
//
//   link   a flattened heart (after the side braid's, tools/sculpt/lowbraidbraid.mjs heartAt): a rim of six corners on
//          the skin (sunk `sink` into it) round two lobes, the notch at its top toward the forehead and its point toward
//          the nape; the two lobes' peaks `height` off the skin, the notch and the crease between the peaks lower and in
//          the valleys' shades; under it one face, inside the skull. Each link `pitch` along the row from the one before
//          and `length` long, so its top is tucked under the one before's point. Every corner is laid on the skull along
//          the ray from its centre (its height off the skin along that ray), so the links hug the head's facets.
//   cap    the parts: a sheet over the scalp `capLift` off it in the shaved tone (its polygons `buzz`, material 3 in the
//          game, as the buzzed sides of tools/sculpt/lowhair.mjs buzzOf), its edges the hairline round the rows; the
//          head's polygons wholly under it drawn shaved too (shave).
//
// Each vertex weighted as the skin under it (on the head; at the nape partly on the upper neck, as the nape is). Each
// link its own closed piece; the cap one open sheet.
//
//   node tools/sculpt/lowcornrows.mjs [--who male,female]   # counts, open edges, crossings with the face, ears, neck at rest
import { buildRig, add, sub, mul, dot, cross, unit } from './lowrig.mjs';
import { skullOf, openEdges } from './lowhair.mjs';
import CORNROWS from './hairs/cornrows.mjs';

/** A direction from the skull's centre (tools/sculpt/lowhair.mjs dirOf): over about the left-right axis from ahead, out toward the left. */
export const dirOf = (over, out) => { const a = (over * Math.PI) / 180, b = (out * Math.PI) / 180; return [Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a)]; };
/** A direction's over and out (degrees; over from -90 to 270, so the back of the head runs on past 180). */
export const angOf = (d) => { const out = (Math.asin(Math.max(-1, Math.min(1, d[0]))) * 180) / Math.PI; let over = (Math.atan2(d[1], d[2]) * 180) / Math.PI; if (over < -90) over += 360; return [over, out]; };

/** Where a ray from o along unit d leaves the triangles (its furthest crossing), and that triangle's polygon. */
function hit(tris, o, d) {
  let best = -1, poly = -1;
  for (const tri of tris) {
    const [a, b, c] = tri;
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) / det;
    if (t > best) { best = t; poly = tri.poly; }
  }
  return { t: best, poly };
}

/** Whether the ray from o along unit d passes through the triangle. */
function rayTri(o, d, [a, b, c]) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(o, a), u = dot(s, p) / det; if (u < 0 || u > 1) return false;
  const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) return false;
  return dot(e2, q) / det > 0;
}

/** Whether two triangles pass through each other (an edge of either through the other). */
export function triTri(A, Bt) {
  const seg = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  for (let k = 0; k < 3; k++) if (seg(A[k], A[(k + 1) % 3], Bt) || seg(Bt[k], Bt[(k + 1) % 3], A)) return true;
  return false;
}

/** Each vertex's weights the skin's under it (along the ray from the skull's centre: its triangle's three corners'
 * weights, by where the ray meets it), so the rows' ends at the nape move with the nape's skin. */
function skinWeights(rig, verts, C) {
  const B = rig.B, T = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; });
  return verts.map((q) => {
    const d = unit(sub(q, C));
    let best = -1, bw = null;
    for (const t of T) {
      const [a, b, c] = t.v.map((i) => B.verts[i]), e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const s = sub(C, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
      const qq = cross(s, e1), v = dot(d, qq) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const tt = dot(e2, qq) / det;
      if (tt > best) { best = tt; bw = [[t.v[0], 1 - u - v], [t.v[1], u], [t.v[2], v]]; }
    }
    if (!bw) return [['head', 1]];
    const m = new Map();
    for (const [i, f] of bw) for (const [bn, w] of rig.weights[B.names[i]]) m.set(bn, (m.get(bn) ?? 0) + Math.max(0, f) * w);
    const sum = [...m.values()].reduce((x, y) => x + y, 0), l = [...m].filter(([, w]) => w / sum > 1e-3).map(([bn, w]) => [bn, w / sum]);
    const s2 = l.reduce((x, [, w]) => x + w, 0);
    return l.map(([bn, w]) => [bn, w / s2]);
  });
}

/** A link's rim, across (u: -0.5 the row's right .. 0.5 its left) and along (v: 0 its top, toward the forehead, .. 1 its
 * point): the notch, the left lobe's top, its side, the point, the right lobe's side, its top. */
const RIM = [[0, 0.16], [0.3, 0], [0.5, 0.4], [0, 1], [-0.5, 0.4], [-0.3, 0]];
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** A row's path: per over its out (the out at the crown, bending toward its front and back outs as a square of the way
 * there, so the row runs level through the crown). */
const outAt = (row, over) => {
  const f = row.front ?? row.out, b = row.back ?? row.out;
  if (over < 90) { const s = (90 - over) / (90 - row.from); return row.out + (f - row.out) * s * s; }
  const s = (over - 90) / (row.to - 90); return row.out + (b - row.out) * s * s;
};

/** Every row (the right's mirrored from the left's), from her right to her left. */
export const rowsOf = (style) => [...style.rows.filter((r) => r.out > 0).reverse().map((r) => ({ ...r, out: -r.out, front: r.front !== undefined ? -r.front : undefined, back: r.back !== undefined ? -r.back : undefined })), ...style.rows];

export function buildCornrows(rig, style = CORNROWS) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B), P = (n) => B.verts[B.index.get(n)];
  // the skull's size against the male's (tools/sculpt/lowhair.mjs buildOnce)
  const k = (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79);
  const on = (d, h = 0) => { const r = hit(skull, C, d); return { p: add(C, mul(d, r.t + h)), poly: r.poly, t: r.t }; };
  const verts = [], polys = [], pieces = [], under = new Set(), paths = [];
  const V = (p) => verts.push(p) - 1;
  const S = style, W = S.width * k, L = S.length * k, H = S.height * k, sink = S.sink * k;
  rowsOf(S).forEach((row, ri) => {
    // the path on the skin, finely, and its length along it
    const N = 400, pts = Array.from({ length: N + 1 }, (_, i) => { const a = row.from + ((row.to - row.from) * i) / N; return on(dirOf(a, outAt(row, a))).p; });
    const len = [0]; for (let i = 1; i <= N; i++) len.push(len[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
    const along = (s) => { const w = Math.max(0, Math.min(len[N], s)); let i = 1; while (i < N && len[i] < w) i++; return add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), (w - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]))); };
    paths.push({ row, pts });
    // the links: the first's top at the hairline, the last's point at the nape, evenly between
    const n = Math.max(2, Math.round((len[N] - L) / (S.pitch * k)) + 1), pitch = (len[N] - L) / (n - 1);
    for (let li = 0; li < n; li++) {
      const s0 = li * pitch, c = along(s0 + L / 2), Nr = unit(sub(c, C));
      const T0 = sub(along(s0 + L / 2 + 0.01), along(s0 + L / 2 - 0.01)), T = unit(sub(T0, mul(Nr, dot(T0, Nr)))), U = cross(Nr, T);
      // (the row tapering at its ends)
      const tp = li === 0 ? S.taper[0] : li === n - 1 ? S.taper[1] : 1, w = W * tp, h = H * (0.6 + 0.4 * tp) * (0.92 + 0.16 * hash(ri * 31 + li, 1));
      // a corner across u, along v, w of the height off the skin (the rim sunk)
      const pt = (u, v, up) => {
        const q = add(c, add(mul(U, u * w), mul(T, (v - 0.5) * L))), d = unit(sub(q, C)), r = on(d, up > 0 ? up * h : -sink);
        if (up === 0) under.add(r.poly);
        return r.p;
      };
      const first = polys.length, base = verts.length;
      const rim = RIM.map(([u, v]) => V(pt(u, v, 0)));
      const [lu, lv] = S.lobe;
      const Lp = V(pt(lu, lv, 1)), Rp = V(pt(-lu, lv, 1)), Cn = V(pt(0, 0.26, S.notch)), Cm = V(pt(0, 0.62, S.crease));
      const [r0, r1, r2, r3, r4, r5] = rim, notch = { valley: S.shades[0] }, crease = { valley: S.shades[1] };
      // each lobe a fan round its peak; the notch's faces (where the link before tucks in) and the crease's between the
      // peaks darker; the point's two faces from the lobes' sides
      const faces = [
        [[r0, r1, Lp]], [[r1, r2, Lp]], [[r2, Cm, Lp]], [[r2, r3, Cm]], [[r0, Lp, Cn], notch], [[Cn, Lp, Cm], crease],
        [[r0, Rp, r5]], [[r5, Rp, r4]], [[r4, Rp, Cm]], [[r4, Cm, r3]], [[r0, Cn, Rp], notch], [[Cn, Cm, Rp], crease],
      ];
      // each top face turned out (away from the skull), the bottom in
      const nrm = (v) => cross(sub(verts[v[1]], verts[v[0]]), sub(verts[v[2]], verts[v[0]]));
      for (const [v, sh = {}] of faces) polys.push({ v: dot(nrm(v), Nr) < 0 ? [...v].reverse() : v, piece: pieces.length, ...sh });
      polys.push({ v: dot(nrm([r3, r4, r2]), Nr) > 0 ? [...rim].reverse() : rim, piece: pieces.length, valley: 1, fan: r3 });
      pieces.push({ id: `row${ri + 1}.${li + 1}`, kind: 'link', polys: [first, polys.length], verts: [base, verts.length] });
    }
  });
  // the parts: a cap over the scalp in the shaved tone (each polygon `buzz`, drawn as the buzzed sides are,
  // tools/sculpt/lowhair.mjs buzzOf), `capLift` off the skin, from the outermost rows' outer sides `capOut` degrees past
  // their middles and `capEnd` degrees past the rows' ends: columns at those sides and midway between each two rows,
  // under each row's middle, `capAlong` rows of quads from the forehead to the nape
  const rows = rowsOf(S), m = rows.length, rowAt = (r, t) => { const a = r.from + t * (r.to - r.from); return [a, outAt(r, a)]; };
  const cols = [
    (t) => { const [a, b] = rowAt(rows[0], t); return [a, b - S.capOut]; },
    ...rows.flatMap((r, i) => [(t) => rowAt(r, t), ...(i + 1 < m ? [(t) => { const p = rowAt(r, t), q = rowAt(rows[i + 1], t); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }] : [])]),
    (t) => { const [a, b] = rowAt(rows[m - 1], t); return [a, b + S.capOut]; },
  ];
  const span = rows.map((r) => r.to - r.from).reduce((a, b) => a + b) / m, t0 = -S.capEnd / span, t1 = 1 + S.capEnd / span;
  const capV = cols.map((f) => Array.from({ length: S.capAlong + 1 }, (_, i) => V(on(dirOf(...f(t0 + ((t1 - t0) * i) / S.capAlong)), S.capLift * k).p)));
  const capFirst = polys.length;
  for (let j = 0; j + 1 < capV.length; j++) for (let i = 0; i < S.capAlong; i++) {
    const v = [capV[j][i], capV[j][i + 1], capV[j + 1][i + 1], capV[j + 1][i]], mid = mul(v.reduce((a, x) => add(a, verts[x]), [0, 0, 0]), 0.25);
    const n = cross(sub(verts[v[2]], verts[v[0]]), sub(verts[v[3]], verts[v[1]]));
    polys.push({ v: dot(n, sub(mid, C)) < 0 ? v.reverse() : v, piece: -1, buzz: true });
  }
  // the triangles: each top face its own; the bottom a fan from the link's point; a cap's quad split along its shorter
  // diagonal
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    if (p.buzz) {
      const [a, b, c, d] = p.v;
      if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
      return;
    }
    const i0 = p.v.indexOf(p.fan), mm = p.v.length;
    for (let j = 1; j + 1 < mm; j++) tris.push([p.v[i0], p.v[(i0 + j) % mm], p.v[(i0 + j + 1) % mm], pi]);
    delete p.fan;
  });
  // the head's polygons (skin, not the ears) wholly under the cap drawn shaved as well (where the skull's facets would
  // show through it); those any of it is over, and those the links are sunk into, are the scalp (left out of the
  // crossings with the skin)
  const capT = tris.filter(([, , , pi]) => polys[pi].buzz).map(([a, b, c]) => [verts[a], verts[b], verts[c]]);
  const covered = (p) => { const d = unit(sub(p, C)); return capT.some((t) => rayTri(C, d, t)); };
  const shave = [], over = [];
  B.polys.forEach((p, i) => {
    if (p.part !== 'head' || p.mat !== 'skin' || p.ear) return;
    const c = p.v.map((v) => covered(B.verts[v]));
    if (c.every(Boolean)) shave.push(i);
    if (c.some(Boolean) || covered(mul(p.v.reduce((a, v) => add(a, B.verts[v]), [0, 0, 0]), 1 / p.v.length))) over.push(i);
  });
  // (the cap clear of the skin where the skin is not drawn shaved: where a triangle of it passes through such a polygon
  // of the head's skin, between two of the skull's facets at the hairline, its corners raised `capStep` along their
  // rays at a time, each no more than `capMax` in all, until none does; under the cap the skin is shaved, so a facet
  // through the cap there shows in the cap's own tone)
  const shaved = new Set(shave), headT = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear && !shaved.has(t.poly); }).map((t) => t.v.map((i) => B.verts[i]));
  const capTris = tris.filter(([, , , pi]) => polys[pi].buzz), lifted = new Map();
  for (let it = 0; it < 20; it++) {
    const up = new Set(capTris.filter(([a, b, c]) => headT.some((t) => triTri([verts[a], verts[b], verts[c]], t))).flatMap(([a, b, c]) => [a, b, c]));
    let moved = 0;
    for (const v of up) {
      const l = lifted.get(v) ?? 0, d = Math.min(S.capStep, S.capMax - l) * k;
      if (d <= 0) continue;
      verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), d)); lifted.set(v, l + d / k); moved++;
    }
    if (!moved) break;
  }
  const hair = { verts, polys, tris, weights: skinWeights(rig, verts, C), pieces, centre: C, k, shave, cap: [capFirst, polys.length] };
  hair.scalp = [...new Set([...shave, ...over, ...under])].filter((i) => i >= 0);
  return hair;
}

/** The hair's (the links' and the cap's) triangles through the body's skin that is not its scalp (the face, the ears,
 * the rest of the head, the neck, the chest and shoulders), by where on the body: each hair triangle counted once. P, H:
 * the body's and the hair's vertices posed. */
export function skinCrossings(rig, hair, P, H) {
  const B = rig.B, scalp = new Set(hair.scalp), C = hair.centre, out = { face: 0, ear: 0, neck: 0, torso: 0, other: 0 };
  const bb = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const skinT = B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part) && !scalp.has(t.poly)), tb = skinT.map((t) => bb(t.v.map((i) => P[i])));
  const fan = (pi) => { const p = hair.polys[pi]; return !p.buzz && p.valley === 1 && p.v.length > 3; };
  for (const [a, b, c, pi] of hair.tris) {
    if (fan(pi)) continue;
    const A = [H[a], H[b], H[c]], ab = bb(A);
    for (let s = 0; s < skinT.length; s++) {
      if (ab.some(([lo, hi], k) => hi < tb[s][k][0] || lo > tb[s][k][1])) continue;
      if (!triTri(A, skinT[s].v.map((i) => P[i]))) continue;
      const poly = B.polys[skinT[s].poly], m = mul(poly.v.reduce((q, i) => add(q, B.verts[i]), [0, 0, 0]), 1 / poly.v.length);
      out[poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear ? 'ear' : m[2] > C[2] + 0.35 && m[1] < C[1] + 0.25 ? 'face' : 'other']++;
      break;
    }
  }
  return out;
}

/** The cornrows on a body as the game takes them. */
export const cornrowsOf = (rig) => buildCornrows(rig, CORNROWS);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), hair = cornrowsOf(rig);
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, 'links', hair.pieces.length,
      'rows', rowsOf(CORNROWS).length, 'valleys', hair.polys.filter((p) => p.valley).length, 'open edges', openEdges(hair),
      'shaved polys', hair.shave.length, 'cap tris', hair.tris.filter(([, , , pi]) => hair.polys[pi].buzz).length,
      'crossings with the skin off the scalp at rest', JSON.stringify(skinCrossings(rig, hair, rig.B.verts, hair.verts)));
  }
}
