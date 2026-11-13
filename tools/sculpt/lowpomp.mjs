// The pompadour (tools/sculpt/hairs/pompadour.mjs) for the low-poly bodies: the game's 'pompadour', "Pompadour". No
// reference sheet: the shape is the style's numbers laid on each body's own skull (buildPomp), one closed shell of
// locks:
//
//   columns  round the crown's whorl (a point over the back of the top, style.whorl), each lock between two borders
//            (style.borders), its ridge between them stood out and its borders sunk, a crease each side of a border in
//            a valley's shade: the quiff's narrow locks over the forehead, wider ones down the sides and the back.
//   rows     from the whorl along each column to the shell's hem (the forehead's hairline at the head's t0 and t1, the
//            temple's corner at f2, then over the ears and round the back, style.hem); a ridge's rows staggered toward
//            the hem near the front, so the quiff's facets run diagonally along the sweep.
//   height   off the skin along the ray from the skull's middle: the taper (thin at the hem, rising to the top of the
//            sides) plus the quiff (tall over the forehead's hairline, falling away across to the temples and back over
//            the top toward the whorl), its front leaned forward over the forehead.
//   inside   the hem's rim (the cut's thickness, in a valley's shade) down to a ring sunk into the scalp, and a fan from
//            that ring to a point inside the skull.
//
// The sides and the back under the hem are the head's own polygons drawn in the shaved tone (style.shave), the temples
// forward of them buzzed to the sideburn (tools/sculpt/lowhair.mjs buzzOf). Rigid on the head.
//
//   node tools/sculpt/lowpomp.mjs [--who male,female]   # counts, open edges, crossings at rest and in the test poses
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { skullOf, shaveOf, buzzOf, crossings, openEdges, skinHair } from './lowhair.mjs';
import { angOf } from './lowhairhull.mjs';
import { POSES, crossReport } from './lowbob.mjs';
import POMP from './hairs/pompadour.mjs';

const RAD = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Piecewise linear through [x, y] points (sorted by x), held flat past the ends. */
const pwl = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [a, p] = P[i - 1], [b, q] = P[i]; return p + ((q - p) * (x - a)) / (b - a); }
  return P.at(-1)[1];
};
/** Theta (round from the front toward the head's left) and phi (up from level) of a direction, degrees. */
const thOf = (d) => Math.atan2(d[0], d[2]) / RAD, phOf = (d) => Math.asin(Math.max(-1, Math.min(1, d[1]))) / RAD;

/** The furthest crossing of the ray from o along unit d with triangles (three points each, .poly), and its polygon. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const tri of tris) {
    const [a, b, c] = tri, e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = tri.poly; }
  }
  return { t: best, poly };
}

/**
 * The pompadour on a body: { verts, polys: [{ v, piece, valley?, buzz? }], tris: [[a, b, c, poly]], weights, pieces,
 * shave, scalp, centre, k, grid }.
 */
export function buildPomp(rig, S = POMP) {
  const B = rig.B, { tris: skull, centre: C } = skullOf(B);
  const P = (n) => B.verts[B.index.get(n)];
  // the skull's size against the male's (as tools/sculpt/lowhair.mjs): the style's lengths scaled by it
  const k = (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (0.73 + 0.739 + 0.79);
  const skinAt = (d) => farHit(skull, C, d);
  // the skin's radius round a ray, over the directions within `soft` degrees of it (the skull's folds smoothed away)
  const softAt = (d) => {
    const u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(d, u), s = Math.tan(S.soft * RAD);
    let sum = 0, n = 0, most = 0;
    for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) { const t = skinAt(unit(add(d, add(mul(u, x * s), mul(v, y * s))))).t; sum += t; n++; most = Math.max(most, t); }
    // (halfway from the mean to the greatest: over a fold the shell rounds it rather than dipping onto it)
    return (sum / n + most) / 2;
  };
  const angles = (p) => { const d = unit(sub(p, C)); return [thOf(d), phOf(d)]; };
  // the hem: phi per theta (0..180, mirrored), through the hairline's landmarks and the style's points, smoothed
  const [th1, ph1] = angles(P('t1.L')), [thT, phT] = angles(P('f2.L')), [, ph0] = angles(P('t0'));
  const ctrl = [[-th1, ph1 + S.front], [0, ph0 + S.front], [th1, ph1 + S.front], [thT, phT + S.temple], ...S.hem, [360 - S.hem.at(-2)[0], S.hem.at(-2)[1]]];
  const hemRaw = (th) => pwl(ctrl, th);
  const hemPh = (th) => { th = Math.abs(((th + 540) % 360) - 180); let s = 0, w = 0; for (let d = -10; d <= 10; d += 2) { const q = 1 - Math.abs(d) / 12; s += hemRaw(Math.abs(th + d)) * q; w += q; } return s / w; };
  // (and never off the shaved polygons rigid on the head: the rim sinks into the scalp there)
  const shaved = new Set(shaveOf(B, S.shave));
  const below = (d) => phOf(d) < hemPh(thOf(d));
  const rigid = (pi) => B.polys[pi].v.every((i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3));
  const off = (d) => { const pi = skinAt(d).poly; return !shaved.has(pi) || !rigid(pi); };
  // the whorl's frame: its axis, toward the front across it (e1), toward the head's left (e2)
  const a = [0, Math.sin(S.whorl * RAD), Math.cos(S.whorl * RAD)];
  const e1 = unit(sub([0, 0, 1], mul(a, a[2]))), e2 = [1, 0, 0];
  const merid = (al, be) => unit(add(mul(a, Math.cos(al * RAD)), mul(add(mul(e1, Math.cos(be * RAD)), mul(e2, Math.sin(be * RAD))), Math.sin(al * RAD))));
  // (`edge` degrees short of the shaved polygons' edge, so the rim's faces sink into them alone)
  const past = (al, be) => below(merid(al, be)) || off(merid(al + S.edge, be));
  const hemAl = (be) => { let al = 0; while (al < 179 && !past(al + 0.5, be)) al += 0.5; let lo = al, hi = al + 0.5; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (past(m, be)) hi = m; else lo = m; } return lo; };
  // the quiff's along-the-sweep origin: the hem's over per out (degrees back from it along the sweep)
  const hemOver = new Map();
  const overHem = (out) => {
    const key = Math.round(out);
    if (!hemOver.has(key)) {
      let over = 100;
      const dir = (o) => [Math.sin(key * RAD), Math.cos(key * RAD) * Math.sin(o * RAD), Math.cos(key * RAD) * Math.cos(o * RAD)];
      while (over > -40 && !below(dir(over - 0.5))) over -= 0.5;
      hemOver.set(key, over);
    }
    return hemOver.get(key);
  };
  const Q = S.quiff;
  /** The quiff's share of its height along a direction (0..1). */
  const quiffShare = (d) => {
    const [over, out] = angOf(d);
    const across = smooth(Q.edge, Q.full, Math.abs(out));
    return across ? across * pwl(Q.along, over - overHem(out)) : 0;
  };
  /** The hair's height off the skin along a direction: the taper's and the quiff's. */
  const thick = (d) => {
    const h = phOf(d) - hemPh(thOf(d)), t = S.taper;
    return (t.hem + (t.top - t.hem) * smooth(0, t.rise, h) + Q.height * quiffShare(d)) * k;
  };
  // the columns: per lock its two borders and its ridge between, a crease each side of a border
  const half = S.borders;
  const cols = [{ be: 0, ridge: true }];
  for (let i = 0; i < half.length; i++) {
    const b = half[i];
    if (b < 180) cols.push({ be: b - S.valleyHalf, border: true }, { be: b + S.valleyHalf, border: true, strip: true });
    else cols.push({ be: 180 - S.valleyHalf, border: true }, { be: 180 + S.valleyHalf, border: true, strip: true });
    if (i + 1 < half.length) cols.push({ be: (b + half[i + 1]) / 2, ridge: true });
  }
  // (the head's right: the left's mirrored, the crease's strip on its other side)
  const right = cols.filter((c) => c.be > 0 && c.be < 180 - S.valleyHalf - 1e-6).map((c) => ({ ...c, be: 360 - c.be })).reverse();
  for (const c of right) if (c.border) c.strip = !c.strip;
  const all = [...cols, ...right].sort((p, q) => p.be - q.be);
  // (the strip is the face from a column to the next: a crease's strip on its first column)
  all.forEach((c, j) => { const n = all[(j + 1) % all.length]; c.crease = c.border && n.border && Math.abs(((n.be - c.be + 540) % 360) - 180) < 2 * S.valleyHalf + 1e-6; });
  const nc = all.length, R = S.rows.length - 1;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  const fwd = (be) => Math.abs(((be + 540) % 360) - 180) > 180 - S.staggerFront;
  const outer = [], ring = [];
  for (const c of all) {
    c.hem = hemAl(c.be);
    const fs = S.rows.slice(1).map((f, i) => (c.ridge && fwd(c.be) && i + 1 < R ? f + S.stagger * (S.rows[i + 2] - f) : f));
    const col = fs.map((f, i) => {
      const d = merid(f * c.hem, c.be), sk = skinAt(d), t = thick(d);
      const rel = Math.min(S.relief * k, S.reliefShare * t) * (S.reliefRows[i] ?? 1);
      // (laid over the skin's radius averaged round the ray, so the shell does not copy the skull's folds; never
      // nearer the skin itself than the least thickness)
      let r = Math.max(sk.t + S.minThick * k, softAt(d) + t + (c.ridge ? rel : c.border ? -rel : 0));
      if (i === R - 1) r = sk.t + S.taper.hem * k;
      let p = add(C, mul(d, r));
      // (the quiff's front leaned forward over the forehead, by its share of the height, near the hairline)
      const qs = quiffShare(d), [over, out] = angOf(d), u = over - overHem(out);
      if (qs > 0 && i < R - 1) p = add(p, [0, 0, S.quiff.lean * k * qs * smooth(Q.reach, 0, u)]);
      return V(p);
    });
    outer.push(col);
    const dh = merid(c.hem, c.be);
    ring.push(V(add(C, mul(dh, skinAt(dh).t - S.sink * k))));
  }
  // the whorl's point, and the inside's point within the skull
  const W = V(add(C, mul(a, skinAt(a).t + thick(a)))), I = V(add(C, [0, 0.25 * k, 0]));
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  for (let j = 0; j < nc; j++) {
    const q = (j + 1) % nc, o = outer[j], p = outer[q], crease = all[j].crease ? { valley: S.creaseShade } : {};
    poly([W, o[0], p[0]]);
    for (let i = 0; i + 1 < R; i++) poly([o[i], o[i + 1], p[i + 1], p[i]], i >= S.creaseFrom ? crease : {});
    poly([o[R - 1], ring[j], ring[q], p[R - 1]], { valley: S.rimShade });
    poly([I, ring[q], ring[j]], { valley: S.insideShade });
  }
  // outward: turned over if the shell encloses a negative volume
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(verts[p.v[0]], cross(verts[p.v[j]], verts[p.v[j + 1]]));
  if (vol < 0) for (const p of polys) p.v.reverse();
  const shellPolys = polys.length;
  // the temples forward of the shave buzzed to the sideburn
  if (S.buzz) buzzOf(B, S, verts, polys, k);
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    if (p.v.length > 4) { for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]); return; }
    const [w, x, y, z] = p.v;
    // (the quad's shorter diagonal, so it folds rather than twists)
    if (Math.hypot(...sub(verts[w], verts[y])) <= Math.hypot(...sub(verts[x], verts[z]))) tris.push([w, x, y, pi], [w, y, z, pi]); else tris.push([w, x, z, pi], [x, y, z, pi]);
  });
  const pieces = [{ id: 'pompadour', kind: 'shell', polys: [0, shellPolys], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, centre: C, k, grid: { cols: all, outer, ring, W, I } };
  hair.shave = shaveOf(B, S.shave);
  // the scalp the shell's rim sinks into (left out of the crossing checks): the shaved polygons and those the shell
  // covers whole
  const T = tris.filter(([, , , pi]) => !polys[pi].buzz).map(([x, y, z]) => [verts[x], verts[y], verts[z]]);
  const under = new Map(), covered = (vi) => { if (!under.has(vi)) under.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return under.get(vi); };
  const cov = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every(covered)) cov.push(i); });
  hair.scalp = [...new Set([...hair.shave, ...cov])].sort((x, y) => x - y);
  return hair;
}

export const pompOf = (rig, style = POMP) => buildPomp(rig, style);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'male,female').split(',')) {
    const rig = buildRig(who), hair = pompOf(rig);
    const shell = hair.polys.filter((p) => !p.buzz).length;
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, `(shell ${shell}, buzz ${hair.polys.length - shell})`, 'tris', hair.tris.length, 'valleys', hair.polys.filter((p) => p.valley).length, 'columns', hair.grid.cols.length, 'open edges', openEdges(hair), 'shave', hair.shave.length, 'scalp', hair.scalp.length);
    const top = Math.max(...hair.verts.map((p) => p[1])), front = Math.max(...hair.verts.map((p) => p[2]));
    console.log(who, 'top', top.toFixed(3), 'crown skin', rig.B.verts[rig.B.index.get('c')][1].toFixed(3), 'front', front.toFixed(3), 'brow', rig.B.verts[rig.B.index.get('bm.L')][2].toFixed(3));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)), JSON.stringify(crossings(rig, hair, rig.B.verts, hair.verts).hits.slice(0, 8).map(([h, s]) => [h, rig.B.polys[s].name])));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}
