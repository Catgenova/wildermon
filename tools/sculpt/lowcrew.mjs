// The crew cut (tools/sculpt/hairs/crew.mjs) for the low-poly bodies: the game's 'crew', "Crew cut". No reference sheet: built
// straight on each body's own skull from the style's numbers, as one closed shell of locks (buildCrew):
//
//   whorl    the locks run out from one point at the back of the crown (the style's pole): forward over the top to the
//            fringe, down the sides to the ears, down the back to the nape; each column a direction round the pole.
//   hairline the hair's edge on the skull, off the body's own marks (hairlineOf): the forehead's (t0), the temples, a short
//            sideburn in front of the ear, over the ear, behind it and the nape; each column runs from the pole to it.
//   height   off the skin: the top (high up the head, more so toward the front) the style's topBack to topFront, the sides
//            and the back side/back, fading to `edge` at the hairline over fadeDeg (the taper to the ears and the nape);
//            the front locks' tips carried past the hairline and stood off the forehead, a ridge's longer and a border's
//            shorter (the ragged fringe), the tip's cut face in the valleys' shade.
//   locks    a ridge between each two borders stood out, the borders sunk (each lock two planes); the top's borders each a
//            narrow crease in a valley shade.
//   inside   the shell's inner side sunk into the scalp, the fringe's tips' just off the forehead; the rim between it and
//            the outside at the hairline (flush on the sides and the back, the fringe's cut at the front).
//
// Each vertex weighted as the skin under it (the skin's triangle hit from the skull's middle, its corners' weights
// blended), so the hair moves with the scalp; the outside kept clear of the skin at rest (clearSkin). The scalp it covers:
// the head's polygons with a corner under it; those wholly under it drawn in the shaved tone (scalpOf).
//
//   node tools/sculpt/lowcrew.mjs [--who female,male]   # counts, open edges, crossings at rest and with the head turned
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { centreOf } from './lowhairhull.mjs';
import { crossings, openEdges, skinHair } from './lowhair.mjs';
import { POSES, crossReport } from './lowbob.mjs';
import CREW from './hairs/crew.mjs';

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
/** A direction from the skull's middle: theta round from the front toward her left, phi up from level (degrees). */
export const dirOf = (th, ph) => { const t = th * RAD, p = ph * RAD; return [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)]; };
const angOf = (d) => [Math.atan2(d[0], d[2]) * DEG, Math.asin(Math.max(-1, Math.min(1, d[1]))) * DEG];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A repeatable number in [0, 1) for an integer pair. */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };

/** The furthest crossing of a ray from o along unit d with triangles ({ P: three points, i }), with its barycentrics. */
function farHit(tris, o, d) {
  let best = { t: 0, tri: null, u: 0, v: 0 };
  for (const tri of tris) {
    const [a, b, c] = tri.P, e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-9 || u > 1 + 1e-9) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-9 || u + v > 1 + 1e-9) continue;
    const t = dot(e2, q) / det; if (t > best.t) best = { t, tri, u, v };
  }
  return best;
}

/** The hairline on her left, [theta, phi] from the front (0) round to the back (180), off the body's own marks. */
export function hairlineOf(rig, C, S = CREW) {
  const B = rig.B, P = (n) => B.verts[B.index.get(n)], ang = (p) => angOf(unit(sub(p, C)));
  const front = ang(P('t0'))[1] - S.frontDrop;
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? ang(B.verts[i]) : null)).filter(Boolean);
  const top = Math.max(...ear.map((a) => a[1])), upper = ear.filter((a) => a[1] > top - 22);
  const eF = Math.min(...upper.map((a) => a[0])), eB = Math.max(...upper.map((a) => a[0]));
  return [
    [0, front], ...S.temple.map(([th, d]) => [th, front + d]),
    // the sideburn: its front edge down, its foot back to the ear
    [eF - S.sideburnW, top - S.sideburn + 4], [eF - S.sideburnW + 1, top - S.sideburn], [eF - 1, top - S.sideburn],
    // up the ear's front, over its top, down behind it (clear of the ear's back, which stands off the head)
    [eF + 1, top + S.overEar * 0.5], [(eF + eB) / 2, top + S.overEar], [eB + 4, top + S.overEar * 0.8], [eB + S.behindEar, top - 2], [eB + S.behindEar + 6, top - 12],
    // round to the nape
    [eB + S.behindEar + 22, (top - 12 + S.nape) / 2 - 2], [155, S.nape + 2], [180, S.nape],
  ];
}

/** The pole's frame: p the pole, f toward the front across it, l toward her left. */
function frameOf(S) {
  const p = dirOf(...S.pole), f = unit(sub([0, 0, 1], mul(p, p[2]))), l = cross(p, f);
  return { p, f, l, at: (al, be) => { const a = al * RAD, b = be * RAD; return unit(add(mul(p, Math.cos(b)), mul(add(mul(f, Math.cos(a)), mul(l, Math.sin(a))), Math.sin(b)))); }, polar: (d) => [Math.atan2(dot(d, l), dot(d, f)) * DEG, Math.acos(Math.max(-1, Math.min(1, dot(d, p)))) * DEG] };
}

/** The hairline's distance from the pole (degrees) per column's angle round it: the both sides' line, densified, read
 * where it crosses the column. */
function reachOf(line, F) {
  const both = [...line.slice(1).reverse().map(([t, p]) => [-t, p]), ...line];
  const dense = [];
  for (let i = 0; i + 1 < both.length; i++) {
    const [t0, p0] = both[i], [t1, p1] = both[i + 1], n = Math.max(1, Math.ceil(Math.hypot(t1 - t0, p1 - p0)));
    for (let k = 0; k < n; k++) dense.push([t0 + ((t1 - t0) * k) / n, p0 + ((p1 - p0) * k) / n]);
  }
  dense.push(both.at(-1));
  const pol = dense.map(([t, p]) => F.polar(dirOf(t, p)));
  return (al) => {
    let best = 0;
    for (let i = 0; i + 1 < pol.length; i++) {
      const [a0, b0] = pol[i], [a1, b1] = pol[i + 1];
      const d0 = ((al - a0 + 540) % 360) - 180, d1 = ((al - a1 + 540) % 360) - 180, span = ((a1 - a0 + 540) % 360) - 180;
      if (Math.abs(span) < 1e-9 || Math.sign(d0) === Math.sign(d1) && d0 !== 0) continue;
      if (Math.abs(span) > 90 || Math.abs(d0) > 90 || Math.abs(d1) > 90) continue;
      const s = d0 / (d0 - d1), b = b0 + (b1 - b0) * s;
      if (b > best) best = b;
    }
    return best;
  };
}

/**
 * The crew cut on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave,
 * scalp, centre, k, grid }.
 */
export function buildCrew(rig, S = CREW, { clear = true } = {}) {
  const B = rig.B, C = centreOf(B), F = frameOf(S);
  const skull = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => ({ P: t.v.map((i) => B.verts[i]), v: t.v, poly: t.poly }));
  const under = (d) => farHit(skull, C, d);
  const line = hairlineOf(rig, C, S), reach = reachOf(line, F);
  const fwd = [0, 0, 1], up = [0, 1, 0];
  const topness = (d) => smooth(S.topLo, S.topHi, dot(d, up) + S.tilt * dot(d, fwd));
  // the columns round the pole: per lock its borders and its ridge; the style's creases (borders on the top) each a
  // crease's two sides
  const half = [{ al: 0, ridge: true }];
  S.borders.forEach((b, i) => {
    if (i > 0) half.push({ al: (S.borders[i - 1] + b) / 2, ridge: true });
    if (S.creases.includes(b)) half.push({ al: b - S.valleyHalf, ridge: false, strip: true }, { al: b + S.valleyHalf, ridge: false });
    else half.push({ al: b, ridge: false });
  });
  const cols = [...half.filter((c) => c.al > 0 && c.al < 180).reverse().map((c) => ({ ...c, al: -c.al, strip: false })), ...half];
  // (a crease's strip lies between its two columns: on her right side, mirrored, the strip is the column before)
  for (let j = 0; j < cols.length; j++) if (cols[j].al < 0 && half.some((h) => h.strip && Math.abs(h.al + cols[j].al + 2 * S.valleyHalf) < 1e-6)) cols[j].strip = true;
  const nc = cols.length, NR = S.rows.length;
  // each column: its reach, whether it ends in the fringe (and how much), its rows' directions
  const rows = S.rows;
  for (const [j, c] of cols.entries()) {
    c.reach = reach(c.al);
    const dEnd = F.at(c.al, c.reach), th = angOf(dEnd)[0];
    c.fringe = Math.abs(th) < 60 ? smooth(0.3, 0.75, topness(dEnd)) : 0;
    const rag = c.fringe ? (c.ridge ? S.ragLong : S.ragShort) + S.ragJit * (2 * hash(j, 7) - 1) : 0;
    c.tip = c.reach + c.fringe * (S.fringeOver + rag);
    c.betas = rows.map((f, i) => (i === NR - 1 ? c.tip : f * c.reach));
  }
  // the hair's height off the skin at a direction, `deg` degrees short of the hairline along its column
  const heightAt = (c, i, d) => {
    const deg = c.reach - c.betas[i], tp = topness(d);
    // (the back's own height, faded over a longer reach: the skull runs in under the back of the head to the nape)
    const bk = smooth(0, -0.5, dot(d, fwd)), fadeDeg = S.fadeDeg + (S.backFade - S.fadeDeg) * bk;
    const sideT = S.edge + (S.side + (S.back - S.side) * bk - S.edge) * smooth(0, fadeDeg, deg);
    const front = smooth(-0.3, 0.7, dot(d, fwd));
    let topT = S.topBack + (S.topFront - S.topBack) * front;
    // (the fringe's last rows eased to the tip's height)
    const fromEnd = NR - 1 - i;
    if (c.fringe && fromEnd < S.fringeEase) topT += (S.fringeTip - topT) * c.fringe * (1 - fromEnd / S.fringeEase);
    // (where the top meets the hairline but is not the fringe, the top fades too)
    if (!c.fringe) topT = S.edge + (topT - S.edge) * smooth(0, fadeDeg, deg);
    return sideT + (topT - sideT) * tp;
  };
  const outer = [], inner = [], wOut = [], wIn = [];
  const verts = [], polys = [], weights = [];
  const weightOf = (h) => {
    if (!h.tri) return [['head', 1]];
    const bw = [1 - h.u - h.v, h.u, h.v], m = new Map();
    h.tri.v.forEach((vi, k) => { for (const [bn, w] of rig.weights[B.names[vi]]) m.set(bn, (m.get(bn) ?? 0) + w * bw[k]); });
    const l = [...m].filter(([, w]) => w > 1e-3), s = l.reduce((a, [, w]) => a + w, 0);
    return l.map(([bn, w]) => [bn, w / s]);
  };
  const V = (p, w) => { verts.push(p); weights.push(w); return verts.length - 1; };
  cols.forEach((c, j) => {
    const o = [], n = [];
    c.betas.forEach((be, i) => {
      const d = F.at(c.al, be), h = under(d), rb = h.t, w = weightOf(h);
      const t = heightAt(c, i, d);
      // the lock's relief
      const rel = Math.min(S.relief, S.reliefShare * t) * (c.ridge ? 1 : -1) * (S.reliefFrom[i] ?? 1);
      const tip = i === NR - 1;
      o.push(V(add(C, mul(d, rb + Math.max(S.edge * 0.6, t + (tip && !c.fringe ? 0 : rel)))), w));
      // the inside: sunk, but the fringe's tip just off the forehead
      if (S.innerRows.includes(i)) n.push(V(add(C, mul(d, tip && c.fringe > 0.05 ? rb + S.lip * c.fringe - S.sink * (1 - c.fringe) : rb - S.sink)), w));
    });
    outer.push(o); inner.push(n);
  });
  // the whorl: one point over the pole, out and in
  const hp = under(F.p), crownO = V(add(C, mul(F.p, hp.t + S.topBack)), weightOf(hp)), crownI = V(add(C, mul(F.p, hp.t - S.sink)), weightOf(hp));
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  const NI = S.innerRows.length;
  for (let j = 0; j < nc; j++) {
    const k = (j + 1) % nc, cj = cols[j];
    poly([crownO, outer[k][0], outer[j][0]]);
    // (the sides' and the back's last band, the fade's end, in the shaved tone: `buzz`, as tools/sculpt/lowhair.mjs
    // gameHair draws it; still a part of the closed shell)
    const fade = !cj.fringe && !cols[k].fringe && topness(F.at(cj.al, cj.reach)) < S.stubbleTop ? { buzz: true } : {};
    for (let i = 0; i + 1 < NR; i++) {
      // (a crease's strip in its valley shade where the lock is the top's, short of the whorl)
      const d = F.at(cj.al, (cj.betas[i] + cj.betas[i + 1]) / 2);
      const sh = i + 2 === NR ? fade : cj.strip && i >= S.creaseFrom && topness(d) > S.creaseTop ? { valley: S.creaseShade } : {};
      poly([outer[j][i], outer[k][i], outer[k][i + 1], outer[j][i + 1]], sh);
    }
    poly([crownI, inner[j][0], inner[k][0]], { valley: S.insideShade });
    for (let i = 0; i + 1 < NI; i++) poly([inner[j][i], inner[j][i + 1], inner[k][i + 1], inner[k][i]], { valley: S.insideShade });
    // the rim: the hairline's edge, the fringe's cut
    poly([outer[j][NR - 1], outer[k][NR - 1], inner[k][NI - 1], inner[j][NI - 1]], fade.buzz ? fade : { valley: S.rimShade });
  }
  // orientation: outward (the faces were wound one way round; turned if the shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of polys) p.v.reverse();
  const hair = { verts, polys, weights, centre: C, k: 1, grid: { cols, outer, inner, crownO, crownI, line }, pieces: [{ id: 'crew', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }] };
  hair.tris = trisOf(hair);
  Object.assign(hair, scalpOf(rig, hair));
  if (clear) clearSkin(rig, hair);
  return hair;
}

/** Each quad two triangles on its shorter diagonal (a lock's plane folds along its length). */
function trisOf(hair) {
  const { verts, polys } = hair, tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    const [a, b, c, d] = p.v;
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  return tris;
}

/** The scalp: the head's skin polygons (not the ears) with a corner under the hair seen from the skull's middle (the
 * inside sinks into them); the shave, those drawn in the shaved tone: the ones wholly under it (those partly out from
 * under it keep the skin's own tone: the head's polygons are large, the nape's run down to the neck). */
function scalpOf(rig, hair) {
  const B = rig.B, C = hair.centre, T = hair.tris.map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]] })), memo = new Map();
  const isUnder = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const scalp = [], shave = [];
  B.polys.forEach((p, i) => {
    if (p.part !== 'head' || p.mat !== 'skin' || p.ear || !p.v.some(isUnder)) return;
    scalp.push(i);
    if (p.v.every(isUnder)) shave.push(i);
  });
  return { scalp, shave };
}

/**
 * The outside kept off the skin at rest: an outside triangle through the face's skin, the ears, the neck or the shoulders
 * has its corners moved out from the skull's middle `step` at a time, until none is (through the shaved scalp it may go:
 * the fade's skin showing through).
 */
function clearSkin(rig, hair, step = 0.003) {
  const B = rig.B, C = hair.centre, { verts, polys, tris } = hair;
  const inner = new Set(hair.grid.inner.flat().concat([hair.grid.crownI]));
  // (the scalp it covers, where rigid on the head, left out: under the fade the skin shows through, in the shaved tone)
  const scalp = new Set(hair.shave), rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part) && !(scalp.has(t.poly) && t.v.every(rigid)));
  const bb = (P) => [0, 1, 2].map((k) => [Math.min(...P.map((p) => p[k])), Math.max(...P.map((p) => p[k]))]);
  const sb = skinT.map((t) => bb(t.v.map((i) => B.verts[i])));
  const outerTris = tris.filter(([a, b, c]) => ![a, b, c].some((v) => inner.has(v)));
  const segTri = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
    const t = dot(e2, qq) / det; return t > 0 && t < 1;
  };
  const triTri = (A, Bt) => { for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true; return false; };
  let moved = 0;
  for (let it = 0; it < 60; it++) {
    const hit = new Set();
    for (const [a, b, c] of outerTris) {
      const A = [verts[a], verts[b], verts[c]], ab = bb(A);
      for (let s = 0; s < skinT.length; s++) {
        if (ab.some(([lo, hi], k) => hi < sb[s][k][0] || lo > sb[s][k][1])) continue;
        if (triTri(A, skinT[s].v.map((i) => B.verts[i]))) { for (const v of [a, b, c]) if (!inner.has(v)) hit.add(v); break; }
      }
    }
    if (!hit.size) break;
    for (const v of hit) verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), step));
    moved += hit.size;
  }
  hair.clearMoves = moved;
  return hair;
}

/** The crew cut on a body. */
export const crewOf = (rig, style = CREW) => buildCrew(rig, style);
/** The hair with its fade's band counted as hair (tools/sculpt/lowhair.mjs openEdges and crossings pass over `buzz`
 * polygons, the swept style's patches on the skin; here they are a part of the shell). */
export const checked = (hair) => ({ ...hair, polys: hair.polys.map(({ buzz, ...p }) => p) });

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = buildRig(who), t0 = Date.now(), hair = checked(crewOf(rig));
    console.log(who, 'polys', hair.polys.length, 'tris', hair.tris.length, 'verts', hair.verts.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'clear moves', hair.clearMoves, 'ms', Date.now() - t0);
    console.log(who, 'hairline', JSON.stringify(hair.grid.line.map((p) => p.map((x) => +x.toFixed(1)))));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
