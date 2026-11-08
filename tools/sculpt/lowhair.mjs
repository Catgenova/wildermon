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
//     scale the hull's thickness taken this many times (the views disagree: one may carve what the others keep); hs, a
//           further share of it along the inner stations (a lock kept low where it runs under another).
//     lip   the front ring's roots stand just off the skin (LIP), so the lock's front edge overhangs; float: every
//           ring's (a lip along the whole lock, as the fringe's lower edge over the forehead).
//     ends  [front, back]: how far each tip stands beyond its ring, as a share of the spline's own spacing (1 the
//           spline's end; less, a blunter end). tipUp: how high each tip stands off the spine, as a share of the
//           ring's height.
//     twist the upper corners leaned across by this share of their height (+ toward the head's left), along the inner
//           stations.
//     sec   its cross-section (or the name of one of the style's), [across (-0.5..0.5 of w), up (0..1 of h)] corners, the first and the last on the skin (sunk
//           SINK into it so the root never shows a gap); the corners' order runs from the head's right to its left.
//           Two corners side by side marked by a third value (the groove's depth, 0..1) are a groove's floor: the faces
//           between them, the lock's length, its valley (polygon `valley`, a shade: shadeOf), darkest at the lock's
//           root and fading toward its tip.
//   jitter: the corners above the roots moved by up to this much (head units, where the roll is 0.2 high; less where it
//           is lower), each its own way (repeatably), so the rolls break into facets.
//   buzz:  { lean, drop, ahead }: the side faces forward of the shave buzzed as far as a sideburn's line (buzzOf).
//   shave: the head's own polygons drawn in the shaved tone, as names of their corners (lowhead.mjs FACES, sides
//           dropped): every polygon whose corners are all in the set.
//
// buildHair(rig, style) -> { verts, polys: [{ v, piece }], tris: [[a, b, c, poly]], weights: [[bone, w], ...] per vertex,
// pieces: [{ id, polys: [first, end) }], shave: [body polygon indices], centre, checks }.
//
//   node tools/sculpt/lowhair.mjs [--who male|female] [--style swept]   # counts and checks
//   node tools/sculpt/lowhair.mjs --asset   # every style on both bodies into src/sculpt/assets/lowhair.json (gameHair)
import { writeFileSync } from 'node:fs';
import { buildRig, posed, skin, add, sub, mul, dot, cross, unit, lerp } from './lowrig.mjs';
import SWEPT from './hairs/swept.mjs';
import { angOf, carve, outlineDiff, camsFor, maskOf, project, raster, bodyTris, VIEWS } from './lowhairhull.mjs';

export const STYLES = { swept: SWEPT };
// (the game's 'undercut', "Shaved sides", may later take this style's shave with a top of its own)

const SINK = 0.04;
/** A corner's least height off the skin (a lock never thinner), and the gap under a lip's front edge. */
const MIN_H = 0.03, LIP = 0.015;
/** How far a mass's border over the face's skin (not the scalp) stands off it. */
const FACE_LIP = 0.015;

/** The skull: the head's skin without the ears, as triangles (each with its polygon, .poly), and its centre (level with
 * the brow's outer end, midway between the forehead and the back of the skull). */
export function skullOf(B) {
  const P = (n) => B.verts[B.index.get(n)];
  const tris = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => Object.assign(t.v.map((i) => B.verts[i]), { poly: t.poly }));
  const centre = [0, P('b5.L')[1], (P('t0')[2] + P('bk')[2]) / 2];
  return { tris, centre };
}

/** Where a ray from o along unit d leaves the skull (its furthest crossing), that triangle's outward normal and its
 * polygon. */
function hit(tris, o, d) {
  let best = -1, nrm = d, poly = -1;
  for (const tri of tris) {
    const [a, b, c] = tri;
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const t = dot(e2, q) / det;
    if (t > best) { best = t; poly = tri.poly; nrm = unit(cross(e1, e2)); if (dot(nrm, d) < 0) nrm = mul(nrm, -1); }
  }
  return { t: best, n: nrm, poly };
}

/** Whether the segment p-q passes through the triangle. */
function segTri(p, q, [a, b, c]) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return false;
  const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qq) / det; return t > 0 && t < 1;
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
  let cl = null;
  const onHull = (q, b) => {
    const dq = unit(sub(q, C)), hq = hit(skull, C, dq), [o, u] = angOf(dq);
    return add(C, mul(dq, hq.t + Math.max(MIN_H * k, b * hull.thick.at(o, u) * k * (cl.scale ?? 1))));
  };
  for (cl of style.clumps) {
    if (cl.mass) { massOf(cl, { skull, C, k, verts, polys, pieces, hull, scalp: new Set(shaveOf(B, style.scalp ?? style.shave)) }); continue; }
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
    // each corner's key for its jitter: a groove's two corners (a valley's floor, marked by a third value) the one key,
    // so they move as one
    const key = []; sec.forEach((c, j) => key.push(j && c[2] && sec[j - 1][2] ? key[j - 1] : j ? key[j - 1] + 1 : 0));
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
        else if (hull) q = onHull(q, b * (cl.hs ? at(cl.hs, ui(i)) : 1));
        if (!root && style.jitter) q = add(q, [0, 1, 2].map((c) => (hash(pieces.length * 101 + i * 7 + key[j], c) - 0.5) * 2 * style.jitter * Math.min(1, hh / (0.2 * k)) * k));
        verts.push(q);
        r.push(verts.length - 1);
      });
      ring.push(r);
    }
    // the faces: each band between two stations, a fan to each tip, outward
    const m = sec.length;
    // (a face between a groove's two corners is its valley, the whole length of the lock: its depth, fading from the
    // root (u 0) toward the tip (u 1))
    const vl = (j, u) => (sec[j][2] && sec[(j + 1) % m][2] ? shadeOf(sec[j][2] * (1 - 0.7 * u)) : {});
    const quad = (a, b, c, d, j, u) => polys.push({ v: [a, b, c, d], piece: pieces.length, ...vl(j, u) });
    for (let i = 1; i < n - 2; i++) for (let j = 0; j < m; j++) quad(ring[i][j], ring[i][(j + 1) % m], ring[i + 1][(j + 1) % m], ring[i + 1][j], j, (i - 0.5) / (n - 2));
    for (let j = 0; j < m; j++) {
      polys.push({ v: [ring[0][0], ring[1][(j + 1) % m], ring[1][j]], piece: pieces.length, ...vl(j, 0) });
      polys.push({ v: [ring[n - 1][0], ring[n - 2][j], ring[n - 2][(j + 1) % m]], piece: pieces.length, ...vl(j, 1) });
    }
    pieces.push({ id: cl.id, polys: [first, polys.length], verts: [base, verts.length] });
  }
  if (style.v) aboveV(style, verts, pieces, skull, C, k);
  if (style.side) sideOf(style.side, verts, pieces, skull, C, k);
  // (the pieces' roots, their edges sunk in the skin, before any is laid on another)
  const roots = new Set(verts.map((p, i) => i).filter((i) => { const r = sub(verts[i], C), l = Math.hypot(...r); return l <= hit(skull, C, mul(r, 1 / l)).t; }));
  if (style.layers) layersOf(style, verts, polys, pieces, skull, C, k, roots);
  orientOut(verts, polys, pieces);
  // the outline onto the sheet's in its five views (outlineFit)
  if (style.outline && hull) outlineFit(rig, style.outline, verts, polys, pieces, skull, C, k);
  // the buzz: the head's side faces forward of the shave as far as the sideburn's line, as patches just off them
  if (style.buzz) buzzOf(B, style, verts, polys, k);
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else if (p.v.length > 4) for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]);
    else {
      // a quad split along its shorter diagonal, so it folds rather than twists
      const [a, b, c, d] = p.v, dac = Math.hypot(...sub(verts[a], verts[c])), dbd = Math.hypot(...sub(verts[b], verts[d]));
      if (dac <= dbd) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    }
  });
  // where a lower piece still shows through an upper (hairCrossings), its corners there pressed down toward the skin a
  // little at a time
  const upper = new Map(), height0 = new Map(), outsideOf = (pc) => outsideFaces(polys, pieces[pc]), farOf = (F, d) => farAlong(verts, C, F, d);
  if (style.layers) for (let it = 0; it < (style.layerPress ?? 12); it++) {
    upper.clear();
    const X = hairCrossings(rig, { verts, polys, tris, pieces, centre: C, k });
    if (!X.length) break;
    for (const x of X) {
      const pair = style.layers.find(([u, l]) => (u === x.a && l === x.b) || (u === x.b && l === x.a));
      if (!pair) continue;
      const pi = x.polys.find((q) => !polys[q].buzz && pieces[polys[q].piece].id === pair[1]);
      if (pi === undefined) continue;
      // the lower face's corner nearest where they cross a step toward the skin, if the upper is over it (so the step is
      // hidden); else the upper face's nearest corner on its edge a step out, so its edge rides over the lower
      const at = x.points[0], near = (v) => v.reduce((m, j) => (Math.hypot(...sub(verts[j], at)) < Math.hypot(...sub(verts[m], at)) ? j : m), v[0]);
      const upPi = x.polys.find((q) => q !== pi), upPc = polys[upPi].piece;
      const U = upper.get(upPc) ?? upper.set(upPc, outsideOf(upPc)).get(upPc);
      // (covered: the upper's outside along the corner's ray stands a good way off the skin, over where it goes)
      const off = (j) => { const r = sub(verts[j], C), l = Math.hypot(...r), d = mul(r, 1 / l), skin = hit(skull, C, d).t; return l - skin > 0.004 * k && farOf(U, d) > skin + 0.03 * k; };
      const v = polys[pi].v.filter(off);
      if (v.length) {
        const i = near(v), r = sub(verts[i], C), l = Math.hypot(...r), d = mul(r, 1 / l), skin = hit(skull, C, d).t;
        verts[i] = add(C, mul(d, Math.max(skin + 0.002 * k, l - 0.006 * k)));
        continue;
      }
      // (the upper's edge: its roots, or corners low on the skin)
      const w = polys[upPi].v.filter((j) => { const r = sub(verts[j], C), l = Math.hypot(...r); return roots.has(j) || l - hit(skull, C, mul(r, 1 / l)).t < 0.06 * k; });
      if (w.length) {
        const u = near(w), r = sub(verts[u], C), l = Math.hypot(...r), d = mul(r, 1 / l);
        if (l - hit(skull, C, d).t < (style.layerLift ?? 0.1) * k) { verts[u] = add(verts[u], mul(d, 0.006 * k)); continue; }
      }
      // neither: the lower face's nearest corner off the skin a step down all the same, to no less than layerKeep (0.6) of its height
      const lo = polys[pi].v.filter((j) => { const r = sub(verts[j], C), l = Math.hypot(...r), skin = hit(skull, C, mul(r, 1 / l)).t; return l - skin > (style.layerKeep ?? 0.6) * (height0.get(j) ?? l - skin) + 0.006 * k; });
      if (!lo.length) continue;
      const i = near(lo), r = sub(verts[i], C), l = Math.hypot(...r), d = mul(r, 1 / l);
      height0.has(i) || height0.set(i, l - hit(skull, C, d).t);
      verts[i] = add(C, mul(d, l - 0.006 * k));
    }
  }
  const shave = shaveOf(B, style.shave), scalp = shaveOf(B, style.scalp ?? style.shave);
  // a face still through the skin at rest (the face's, off the scalp): its corners stood off the skin a little at a time
  for (let it = 0; it < 12; it++) {
    const X = crossings(rig, { verts, polys, tris, scalp, pieces }, B.verts, verts);
    if (!X.n) break;
    for (const [pi] of X.hits) for (const i of polys[pi].v) { const r = sub(verts[i], C), l = Math.hypot(...r); verts[i] = add(C, mul(r, (l + 0.004 * k) / l)); }
  }
  const weights = weightsOf(rig, verts, style);
  return { verts, polys, tris, weights, pieces, shave, scalp, centre: C, k };
}

/**
 * A mass (the front and top of the hair as one piece, its tufts combed straight back): the creases between its tufts as
 * lines over the skull, his right to his left, the first and the last its borders; each line its stations front to
 * back as (over, out) points: the root on the scalp, the sole, the tip at the hairline on the forehead, the tuft's
 * front lifted up off it and rolled back, on back to its end at the crown. Between two creases the band's rows (band:
 * [share of the way across, drop under the envelope]; the creases `groove` under it, so the tufts' fronts stand apart
 * with notches between and their tops are ridges running back; grooveAt: the groove's share per station). Every
 * corner stands on the ray from the skull's centre through it, off the skin by its thickness: the sole's and the
 * tip's `flush` ([sole, tip]: the tip on the forehead at the hairline, nothing hanging over the brow), the rest the
 * solved one (cl.fit.t, per row and station, head units on the male, from a solver since retired) or, unsolved, the
 * hull's. The border (the first and the last rows, the roots behind the hairline and at the crown) are sunk in the
 * skin, the undersides clear of the face; the piece closes in a fan from the skull's centre under them. The pieces'
 * record keeps each corner's ray, its drop and its role (sole, tip) for the solver, and each row's line or band (src:
 * a crease's two rows the one).
 */
export function massOf(cl, { skull, C, k, verts, polys, pieces, hull, scalp }) {
  const n = cl.lines[0].length, band = cl.band ?? [[0.5, 0]], groove = cl.groove ?? 0.04, laid = [];
  cl.lines.forEach((cr, i) => {
    if (cr.length !== n) throw new Error(`${cl.id}: every line ${n} stations`);
    const crease = i > 0 && i < cl.lines.length - 1;
    laid.push({ dirs: cr, drop: crease ? groove : 0, crease, ci: crease ? i - 1 : -1 });
    // (ridges: each tuft's one band row laid out on its own, rather than between its creases)
    if (i < cl.lines.length - 1) for (const [f, drop] of band) laid.push({ dirs: cl.ridges ? cl.ridges[i] : cr.map((a, j) => [0, 1].map((c) => a[c] + (cl.lines[i + 1][j][c] - a[c]) * f)), drop, tuft: i });
  });
  // the valleys (strip: { from, to, w, depth, merge, peak }, each but peak a number or one per crease between two tufts):
  // each crease from station `from` to `to` two rows, each `w` of the way toward the ridge beside it at the crease's
  // own depth, the strip between them its valley; before and after, one row (the two share their corners). The crease
  // `depth` deep (of the groove; its shade the same share), past `to` `merge` of that (the two tufts closing up); the
  // strip darkest at its `peak` end ('from' or 'to'), fading toward the other
  const st = cl.strip, per = (x, c) => (Array.isArray(x) ? x[c] : x ?? 1);
  const from = (c) => per(st.from, c), to = (c) => per(st.to, c), depth = (c) => (st ? per(st.depth, c) : 1);
  const split = (j, c) => !!st && c >= 0 && j >= from(c) && j <= to(c), rows = [];
  laid.forEach((row, i) => {
    if (!st || !row.crease) { rows.push({ ...row, src: i }); return; }
    for (const [side, nb] of [[0, laid[i - 1]], [1, laid[i + 1]]]) {
      rows.push({ ...row, src: i, side, dirs: row.dirs.map((a, j) => (split(j, row.ci) ? [0, 1].map((c) => a[c] + (nb.dirs[j][c] - a[c]) * per(st.w, row.ci)) : a)) });
    }
  });
  // the crease's drop at a station: its depth, less past its strip
  const dropOf = (row, j) => row.drop * (row.crease ? depth(row.ci) * (st && j > to(row.ci) ? st.merge ?? 1 : 1) : 1);
  const R = rows.length, first = polys.length, base = verts.length, rays = [];
  // the groove's share at each station (grooveAt: deep at the tips' notches, shallow over the top), 1 without
  const gAt = (j) => (cl.grooveAt ? cl.grooveAt[j] : 1);
  // (a solve for another layout of rows and stations is not this one's)
  const fit = cl.fit && cl.fit.t.length === laid.length && cl.fit.t[0].length === n ? cl.fit : null;
  const ids = [];
  rows.forEach((row, i) => ids.push(row.dirs.map(([o, u], j) => {
    let d = dirOf(o, u), h = hit(skull, C, d);
    const border = i === 0 || i === R - 1 || j === 0 || j === n - 1;
    let t;
    // (a border that meets another mass rather than the skin: its first or last row (borderUp) or its last station
    // (endUp) at that share of the hull's thickness, where the two masses meet in a crease, not sunk)
    const up = j === 0 ? null : i === 0 ? cl.borderUp?.[0] : i === R - 1 ? cl.borderUp?.[1] : j === n - 1 ? cl.endUp : null;
    const upEnd = j === n - 1 && cl.endUp != null && !(i === 0 && cl.borderUp?.[0] == null) && !(i === R - 1 && cl.borderUp?.[1] == null);
    if (border && (up != null || upEnd)) t = Math.max(MIN_H, (hull ? hull.thick.at(o, u) * (cl.scale ?? 1) : 0.12) * Math.min(up ?? 1, upEnd ? cl.endUp : 1));
    // (a border over the face's skin, not the scalp, stands on it rather than in it: the whorl on the forehead)
    else if (border) t = scalp && !scalp.has(h.poly) ? FACE_LIP : -(cl.sink ?? SINK);
    else if ((j === 1 || j === 2) && cl.flush) t = cl.flush[j - 1];
    else if (fit) t = fit.t[row.src][j] + (row.drop - dropOf(row, j)) * gAt(j);
    else t = Math.max(MIN_H, Math.max(cl.least ? cl.least[j] : 0, hull ? hull.thick.at(o, u) * (cl.scale ?? 1) : 0.12) - dropOf(row, j) * gAt(j));
    // each tuft's lifted front (lift: one per tuft) raised or lowered by its share, half that a station behind
    if (cl.lift && row.tuft !== undefined && !border && (j === 3 || j === 4)) t *= 1 + (cl.lift[row.tuft] - 1) * (j === 3 ? 1 : 0.5);
    rays.push({ i, j, d, r0: h.t, border, drop: dropOf(row, j) * gAt(j), role: j === 1 ? 'sole' : j === 2 ? 'tip' : '' });
    // (a crease's second row shares the first's corners where it is not split; with apex, every row's first corner is
    // the one, the tufts' common root)
    if (row.side === 1 && !split(j, row.ci)) return ids[i - 1][j];
    if (cl.apex && j === 0 && i > 0) return ids[0][0];
    return verts.push(add(C, mul(d, h.t + t * k))) - 1;
  })));
  // the tuft's underside clear of the face on any head: where a root's quads to the rows beside it (either way split)
  // pass through the face (a forehead that runs higher than the male's), that row's sole (and then its tip) raised off
  // the skin until they do not
  if (scalp) {
    const face = skull.filter((tri) => !scalp.has(tri.poly));
    const cross2 = (A, T) => [0, 1, 2].some((e) => segTri(A[e], A[(e + 1) % 3], T) || segTri(T[e], T[(e + 1) % 3], A));
    const V = (r, j) => verts[ids[r][j]];
    const clear = (i) => [i - 1, i + 1].filter((m) => m >= 0 && m < R).every((m) => [0, 1, 2].every((j) =>
      ![[V(i, j), V(i, j + 1), V(m, j + 1)], [V(i, j), V(m, j + 1), V(m, j)], [V(i, j), V(i, j + 1), V(m, j)], [V(i, j + 1), V(m, j + 1), V(m, j)]]
        .some((A) => face.some((T) => cross2(A, T)))));
    for (let i = 1; i < R - 1; i++) for (let up = 0; up < 30 && !clear(i); up++) for (const j of up < 10 ? [1] : [1, 2]) {
      const r = rays[i * n + j];
      verts[ids[i][j]] = add(verts[ids[i][j]], mul(r.d, 0.01 * k));
    }
    // a border's corner whose faces pass through the face (sunk in the scalp at the face's edge) raised out of the skin
    // a little at a time, with the row beside it, to stand on it
    for (const i of [0, R - 1]) {
      const m = i ? R - 2 : 1;
      for (let j = 1; j < n - 1; j++) for (let up = 0; up < 8; up++) {
        const quads = [j - 1, j].filter((q) => q >= 0 && q + 1 < n).flatMap((q) => [[V(i, q), V(i, q + 1), V(m, q + 1)], [V(i, q), V(m, q + 1), V(m, q)]]);
        if (!quads.some((A) => face.some((T) => cross2(A, T)))) break;
        for (const r of [i, m]) verts[ids[r][j]] = add(verts[ids[r][j]], mul(rays[r * n + j].d, 0.006 * k));
      }
    }
  }
  const centre = verts.push([...C]) - 1;
  // (a face with corners shared, where a crease's two rows meet, a triangle or none)
  const face = (v, extra) => { v = v.filter((a, m) => a !== v[(m + 1) % v.length]); if (v.length >= 3) polys.push({ v, piece: pieces.length, ...extra }); };
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j + 1 < n; j++) {
    // a valley: between a crease's two rows, from where they part (not the front end) to the back, its shade the
    // crease's depth fading from its peak end; under the lifted fronts (under: per station, the faces from the sole and
    // from the tip) the occlusion's shade
    const c = rows[i].ci;
    let shade = cl.under && j >= 1 && j <= cl.under.length ? cl.under[j - 1] : 0;
    if (rows[i].side === 0 && rows[i + 1].side === 1 && split(j, c) && j >= from(c)) {
      const f = (j - from(c)) / Math.max(1, to(c) - from(c));
      shade = depth(c) * (1 - 0.75 * (st.peak === 'to' ? 1 - f : f));
    }
    face([ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]], shadeOf(shade));
  }
  // the border, once round (the first row front to back, the back end across, the last row back to front, the front
  // end across), fanned to the centre
  const ring = [...ids[0], ...ids.slice(1).map((r) => r[n - 1]), ...ids[R - 1].slice(0, -1).reverse(), ...ids.slice(1, -1).reverse().map((r) => r[0])].filter((a, m, all) => a !== all[(m + 1) % all.length]);
  ring.forEach((a, m) => polys.push({ v: [centre, ring[(m + 1) % ring.length], a], piece: pieces.length }));
  pieces.push({ id: cl.id, polys: [first, polys.length], verts: [base, verts.length], mass: { ids, rays, rows: R, n, src: rows.map((r) => r.src) } });
}

/**
 * The sides' lower edge straight (side: { a, b, from, to, x, pull, band, lip }): on either side (|x| over `x` of the
 * skull's size), between z `from` and `to` from the skull's centre (from the start of the back's V to the temple's
 * corner), the hair's edge on the skin the one line y = a + b z (from the skull's centre, head units; mirrored, the two
 * sides alike): a corner whose foot (the skin under it, along the ray from the centre) is below it moved up onto it,
 * at its own height off the skin, and a root less than `pull` above it down onto it; a corner a little above it
 * (within `band`), not a root, stood `lip` off the skin, so the side's lowest faces are one even wall over the buzz.
 */
function sideOf(side, verts, pieces, skull, C, k) {
  const { a, b, from, to, x = 0.4, pull = 0, band = 0, lip = 0 } = side;
  const foot = (d) => add(C, mul(d, hit(skull, C, d).t));
  // how far the foot under a direction is above the line (head units, the skull's own)
  const over = (d) => { const f = foot(d); return (f[1] - C[1]) / k - (a + (b * (f[2] - C[2])) / k); };
  for (const pc of pieces) for (let i = pc.verts[0]; i < pc.verts[1]; i++) {
    const p = verts[i], d = unit(sub(p, C)), f = foot(d), z = (f[2] - C[2]) / k;
    if (Math.abs(f[0] - C[0]) < x * k || z < from || z > to) continue;
    const h = Math.hypot(...sub(p, C)) - hit(skull, C, d).t, g = over(d);
    const root = h <= 0;
    if (root ? g >= pull : g >= band) continue;
    // onto the line (up, or a root down): the direction's out moved, its over kept, until the foot is on the line
    let d2 = d;
    if (g < 0 || root) {
      const [o, u] = angOf(d);
      let lo = g < 0 ? u : Math.sign(u) * Math.min(89, Math.abs(u) * 1.5), hi = g < 0 ? u * 0.3 : u;
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (over(dirOf(o, m)) < 0) lo = m; else hi = m; }
      d2 = dirOf(o, hi);
    }
    verts[i] = add(C, mul(d2, hit(skull, C, d2).t + (h > 0 && lip ? lip * k : h)));
  }
}

/** A signed distance (px) to a mask's edge over a W x H grid: negative inside, positive outside (chamfer, 3-4). */
function signedDist(M, W, Hh) {
  const pass = (on) => {
    const D = new Float32Array(W * Hh).fill(1e6);
    for (let i = 0; i < M.length; i++) if (!!M[i] === on) D[i] = 0;
    const f = (i, j, w) => { if (D[j] + w < D[i]) D[i] = D[j] + w; };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (x) f(i, i - 1, 1); if (y) { f(i, i - W, 1); if (x) f(i, i - W - 1, 1.4); if (x < W - 1) f(i, i - W + 1, 1.4); } }
    for (let y = Hh - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (x < W - 1) f(i, i + 1, 1); if (y < Hh - 1) { f(i, i + W, 1); if (x < W - 1) f(i, i + W + 1, 1.4); if (x) f(i, i + W - 1, 1.4); } }
    return D;
  };
  const out = pass(true), inn = pass(false), S = new Float32Array(W * Hh);
  for (let i = 0; i < S.length; i++) S[i] = M[i] ? -inn[i] + 0.5 : out[i] - 0.5;
  return S;
}
let SD = null;
const BODY = new Map();
/**
 * The hair's outline onto the sheet's (outline: { rounds, step }): in each of the five views (the body's own cameras,
 * tools/sculpt/lowhairreg.mjs), every corner above the skin on the hair's outline there (seen, with a pixel within 2
 * of it not the hair's: the background or the skin) stands where the sheet's silhouette is: moved along its ray from the skull's centre by the
 * signed distance (px) from its projection to the sheet's hair's edge, over the pixels a head unit of that ray spans,
 * at most `step` (head units) a round, the views' moves averaged.
 */
function outlineFit(rig, o, verts, polys, pieces, skull, C, k) {
  const cams = camsFor(rig.who), M = maskOf('swept');
  SD ??= signedDist(M.raw, M.w, M.h);
  const N = verts.map(() => [0, 0, 0]);
  const fixed = new Set();
  for (const pc of pieces) if (pc.mass) fixed.add(pc.verts[1] - 1);
  for (let r = 0; r < (o.rounds ?? 8); r++) {
    N.forEach((n) => n.fill(0));
    for (const p of polys) {
      if (p.buzz) continue;
      const v = p.v, nn = [0, 0, 0];
      for (let i = 0; i < v.length; i++) { const a = verts[v[i]], b = verts[v[(i + 1) % v.length]]; nn[0] += (a[1] - b[1]) * (a[2] + b[2]); nn[1] += (a[2] - b[2]) * (a[0] + b[0]); nn[2] += (a[0] - b[0]) * (a[1] + b[1]); }
      for (const i of v) for (let c = 0; c < 3; c++) N[i][c] += nn[c];
    }
    const moves = verts.map(() => [0, 0]);
    const tris = [];
    for (const p of polys) if (!p.buzz) for (let j = 1; j + 1 < p.v.length; j++) tris.push([verts[p.v[0]], verts[p.v[j]], verts[p.v[j + 1]]]);
    for (const v of VIEWS) {
      const c = cams[v], Z = new Float32Array(M.w * M.h).fill(-Infinity), id = new Uint8Array(M.w * M.h);
      raster(BODY.get(rig.who) ?? BODY.set(rig.who, bodyTris(rig.B)).get(rig.who), c, Z, M.w, M.h, id, 2);
      raster(tris, c, Z, M.w, M.h, id, 1);
      verts.forEach((q, i) => {
        if (fixed.has(i)) return;
        const r0 = sub(q, C), l = Math.hypot(...r0), d = mul(r0, 1 / l), skin = hit(skull, C, d).t;
        if (l - skin < 0.01 * k) return;
        const s = project(q, c), X = Math.floor(s[0]), Y = Math.floor(s[1]);
        if (X < 2 || Y < 2 || X >= M.w - 2 || Y >= M.h - 2 || s[2] < Z[Y * M.w + X] - 0.02) return;
        // (on the hair's outline in this view: a pixel within 2 of it not the hair's)
        let edge = false;
        for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) if (id[(Y + dy) * M.w + X + dx] !== 1) { edge = true; break; }
        if (!edge) return;
        const s2 = project(add(q, mul(d, 0.05)), c), ppu = Math.hypot(s2[0] - s[0], s2[1] - s[1]) / 0.05;
        if (ppu < 20) return;
        moves[i][0] += -SD[Y * M.w + X] / ppu; moves[i][1]++;
      });
    }
    verts.forEach((q, i) => {
      if (!moves[i][1]) return;
      const r0 = sub(q, C), l = Math.hypot(...r0), d = mul(r0, 1 / l), skin = hit(skull, C, d).t;
      const m = Math.max(-(o.step ?? 0.02) * k, Math.min((o.step ?? 0.02) * k, moves[i][0] / moves[i][1]));
      verts[i] = add(C, mul(d, Math.max(skin + MIN_H * k, l + m)));
    });
  }
}

/** A piece's outside as triangles (corner indices): its faces bar a mass's underside (the fan to the centre). */
function outsideFaces(polys, pc) {
  const out = [], centre = pc.mass ? pc.verts[1] - 1 : -1;
  for (let i = pc.polys[0]; i < pc.polys[1]; i++) {
    const v = polys[i].v; if (v.includes(centre)) continue;
    for (let j = 1; j + 1 < v.length; j++) out.push([v[0], v[j], v[j + 1]]);
  }
  return out;
}
/** The outermost crossing of the ray from C along d with the triangles F (its distance), or -1. */
function farAlong(verts, C, F, d) {
  let best = -1;
  for (const [ia, ib, ic] of F) {
    const a = verts[ia], b = verts[ib], c = verts[ic], e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s0 = sub(C, a), u = dot(s0, p) / det; if (u < 0 || u > 1) continue;
    const q = cross(s0, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) continue;
    const t = dot(e2, q) / det; if (t > best) best = t;
  }
  return best;
}

/**
 * Pieces laid one on another (style.layers: [upper, lower] ids), so neither pokes through the other: twice over, each
 * corner of the lower (above the skin) under the upper's outside by `gap` where the upper is over it, and each root of
 * the upper (its edge sunk in the skin) over the lower's outside by `gap` where the lower is under it, so the upper's
 * edge rests on the lower rather than cutting through it. Along the ray from the skull's centre; the outside of a
 * piece its faces bar a mass's underside (the fan to the centre).
 */
function layersOf(style, verts, polys, pieces, skull, C, k, roots, rest = false) {
  const gap = (style.layerGap ?? 0.004) * k, byId = (id) => pieces.findIndex((p) => p.id === id);
  const outside = (pi) => outsideFaces(polys, pieces[pi]), far = (F, d) => farAlong(verts, C, F, d);
  for (let pass = 0; pass < (rest ? 1 : style.layerPasses ?? 2); pass++) for (const [upId, loId] of style.layers) {
    const up = byId(upId), lo = byId(loId);
    if (up < 0 || lo < 0) continue;
    const U = outside(up), L = outside(lo), mine = (pc, i) => i >= pc.verts[0] && i < pc.verts[1] && !(pc.mass && i === pc.verts[1] - 1);
    if (!rest) for (let i = pieces[lo].verts[0]; i < pieces[lo].verts[1]; i++) {
      if (!mine(pieces[lo], i)) continue;
      const r = sub(verts[i], C), l = Math.hypot(...r), d = mul(r, 1 / l), skin = hit(skull, C, d).t;
      if (l <= skin) continue;
      const t = far(U, d);
      if (t > 0 && l > t - gap) verts[i] = add(C, mul(d, Math.max(skin + 0.002 * k, t - gap)));
    }
    for (let i = pieces[up].verts[0]; i < pieces[up].verts[1]; i++) {
      if (!mine(pieces[up], i)) continue;
      if (!roots.has(i)) continue;
      const d = unit(sub(verts[i], C)), t = far(L, d);
      if (t > 0) verts[i] = add(C, mul(d, t + gap));
    }
  }
}

/** A face's shade (0 none .. 1 the darkest) as its valley tone's step: 1 the darkest (HAIR_VALLEYS in src/sculpt/gl.ts)
 * to 4 the lightest, none under a fifth. */
export const shadeOf = (s) => (s >= 0.85 ? { valley: 1 } : s >= 0.6 ? { valley: 2 } : s >= 0.38 ? { valley: 3 } : s >= 0.2 ? { valley: 4 } : {});

/**
 * Every piece with `aboveV` kept above the style's V at the nape (style.v: { point, arm, rise }, the V's lower edge at
 * over point - rise |out| / arm, for |out| up to arm) by that many degrees: a corner below that moved up to it along
 * its own out, at its own height off the skin.
 */
function aboveV(style, verts, pieces, skull, C, k) {
  const { point, arm, rise } = style.v;
  style.clumps.forEach((cl, ci) => {
    if (cl.aboveV === undefined) return;
    const pc = pieces[ci];
    for (let i = pc.verts[0]; i < pc.verts[1]; i++) {
      const d = unit(sub(verts[i], C)), [o, u] = angOf(d), lim = point - (rise * Math.abs(u)) / arm - cl.aboveV;
      if (Math.abs(u) > arm || o <= lim) continue;
      const h = Math.hypot(...sub(verts[i], C)) - hit(skull, C, d).t, d2 = dirOf(lim, u);
      verts[i] = add(C, mul(d2, hit(skull, C, d2).t + h));
    }
  });
}

/**
 * The buzzed sides forward of the shaved polygons to the sideburn's edge: the head's own side faces (not shaved, the
 * ears and the face's parts left out) clipped to behind a near-vertical line from the ear's front top up to the hair
 * (z under ear front + buzz.lean (y - ear top), y over the ear's top less buzz.drop), each kept part a patch BUZZ off its
 * face (polygons marked buzz, drawn in the shave's tone; not a closed piece). The head's mesh is left as it is.
 */
function buzzOf(B, style, verts, polys, k) {
  const ear = B.names.map((n, i) => (n && n.startsWith('ear.L') ? B.verts[i] : null)).filter(Boolean);
  const top = Math.max(...ear.map((p) => p[1])), front = Math.max(...ear.filter((p) => p[1] > top - 0.15).map((p) => p[2]));
  const { lean = 0.25, drop = 0.03, ahead = 0 } = style.buzz;
  const planes = [(p) => front + ahead + lean * (p[1] - top) - p[2], (p) => p[1] - (top - drop)];
  const shaved = new Set(shaveOf(B, style.shave));
  const clip = (P, f) => {
    const out = [];
    P.forEach((a, i) => {
      const b = P[(i + 1) % P.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) out.push(lerp(a, b, fa / (fa - fb)));
    });
    return out;
  };
  B.polys.forEach((p, pi) => {
    if (p.part !== 'head' || p.mat !== 'skin' || p.ear || shaved.has(pi)) return;
    const P0 = (p.nv ?? p.v).map((i) => B.verts[i]);
    if (P0.every((q) => Math.abs(q[0]) < 0.35)) return;
    let P = P0;
    for (const f of planes) P = P.length ? clip(P, f) : P;
    if (P.length < 3) return;
    let n = [0, 0, 0];
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
    const area = Math.hypot(...n) / 2;
    if (area < 1e-4) return;
    n = unit(n);
    // outward: away from the head's middle
    const mid = mul(P.reduce((a, q) => add(a, q), [0, 0, 0]), 1 / P.length);
    if (dot(n, [mid[0], 0, 0]) < 0 && Math.abs(mid[0]) > 0.3) n = mul(n, -1);
    const base = verts.length;
    for (const q of P) verts.push(add(q, mul(n, BUZZ * k)));
    const v = P.map((_, i) => base + i);
    polys.push({ v: dot(cross(sub(verts[v[1]], verts[v[0]]), sub(verts[v[2]], verts[v[0]])), n) < 0 ? v.reverse() : v, piece: -1, buzz: true });
  });
}
const BUZZ = 0.004;

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
  for (const p of hair.polys) if (!p.buzz) p.v.forEach((a, j) => { const b = p.v[(j + 1) % p.v.length]; const key = a + ',' + b; E.set(key, (E.get(key) ?? 0) + 1); });
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

/**
 * Where the hair's pieces pass through one another or through the buzz where it shows: each pair of triangles (of two
 * pieces, or of a piece and a buzz patch) that cross at a point standing off the skin (over 0.01 of the skull's size)
 * with no other hair farther out along the ray from the skull's centre through it (so on the hair's outside, not
 * under another piece). A mass's underside (its fan to the centre, every point of it straight under the mass's edge
 * along the ray from the centre) meeting a piece is that edge resting on the piece (layersOf), not a crossing. Each:
 * { a, b } (the pieces' ids,
 * 'buzz'), the points, and whether one is on a side (|x| over
 * 0.4 of the skull's size, z from 0.3 behind the skull's centre to 0.2 ahead: the temple's corner back to the V's
 * start). H: the hair's vertices (posed, or as built).
 */
export function hairCrossings(rig, hair, H = hair.verts) {
  const { tris: skull0 } = skullOf(rig.B), C = hair.centre, k = hair.k;
  const segX = (p, q, [a, b, c]) => {
    const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return null;
    const s = sub(p, a), u = dot(s, h) / det; if (u < 0 || u > 1) return null;
    const qq = cross(s, e1), v = dot(d, qq) / det; if (v < 0 || u + v > 1) return null;
    const t = dot(e2, qq) / det; return t > 1e-6 && t < 1 - 1e-6 ? add(p, mul(d, t)) : null;
  };
  const bb = (P) => [0, 1, 2].map((c) => [Math.min(...P.map((p) => p[c])), Math.max(...P.map((p) => p[c]))]);
  const T = hair.tris.map(([a, b, c, pi]) => {
    const P = [H[a], H[b], H[c]], p = hair.polys[pi], pc = p.buzz ? null : hair.pieces[p.piece];
    // a mass's underside
    const fan = !!(pc && pc.mass && p.v.includes(pc.verts[1] - 1));
    return { v: [a, b, c], P, piece: p.piece, buzz: !!p.buzz, pi, bb: bb(P), fan };
  });

  const above = (p) => { const r = sub(p, C), l = Math.hypot(...r); return l - hit(skull0, C, mul(r, 1 / l)).t; };
  const outer = (p, A, B) => {
    const d = unit(sub(p, C)), q0 = add(p, mul(d, 0.002 * k)), q1 = add(p, mul(d, 2));
    return !T.some((t) => t !== A && t !== B && !t.buzz && segX(q0, q1, t.P));
  };
  const side = (p) => Math.abs(p[0] - C[0]) >= 0.4 * k && (p[2] - C[2]) / k >= -0.3 && (p[2] - C[2]) / k <= 0.2;
  const out = [];
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const A = T[i], B = T[j];
    if ((A.buzz && B.buzz) || (!A.buzz && !B.buzz && A.piece === B.piece)) continue;
    if (A.v.some((a) => B.v.includes(a)) || A.bb.some(([lo, hi], c) => hi < B.bb[c][0] || lo > B.bb[c][1])) continue;
    const X = [];
    for (let e = 0; e < 3; e++) for (const x of [segX(A.P[e], A.P[(e + 1) % 3], B.P), segX(B.P[e], B.P[(e + 1) % 3], A.P)]) if (x) X.push(x);
    if (A.fan || B.fan) continue;
    const seen = X.filter((p) => above(p) > 0.01 * k && outer(p, A, B));
    if (!seen.length) continue;
    const id = (t) => (t.buzz ? 'buzz' : hair.pieces[t.piece].id);
    out.push({ a: id(A), b: id(B), points: X, polys: [A.pi, B.pi], side: seen.some(side) });
  }
  return out;
}

/** The hair's triangles that pass through the body's skin where it does not move with the head: the face and the
 * ears at rest (a clump fitted through them), the neck and the shoulders in a pose (the head turned or nodded onto them).
 * The clumps' roots sit in the scalp by design: the style's scalp polygons, where rigid on the head, are left out. P, H: the
 * body's and the hair's vertices posed. */
export function crossings(rig, hair, P, H) {
  const B = rig.B, scalp = new Set(hair.scalp ?? hair.shave);
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const skinT = B.tris.filter((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso'].includes(p.part) && !(scalp.has(t.poly) && t.v.every(rigid)); });
  const bb = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
  const tb = skinT.map((t) => bb(t.v.map((i) => P[i])));
  const hits = [];
  // (a mass's underside, its fan to the skull's centre, is inside the head: left out)
  const fanOf = (pi) => { const p = hair.polys[pi], pc = hair.pieces[p.piece]; return !!(pc && pc.mass && p.v.includes(pc.verts[1] - 1)); };
  for (const [a, b, c, pi] of hair.tris) {
    if (hair.polys[pi].buzz || fanOf(pi)) continue;
    const A = [H[a], H[b], H[c]], ab = bb(A);
    for (let s = 0; s < skinT.length; s++) {
      if (ab.some(([lo, hi], k) => hi < tb[s][k][0] || lo > tb[s][k][1])) continue;
      if (triTri(A, skinT[s].v.map((i) => P[i]))) { hits.push([pi, skinT[s].poly]); break; }
    }
  }
  return { n: hits.length, hits };
}

/**
 * The hair as the game loads it (src/sculpt/lowpoly.ts): per style its vertices (the body's units), its polygons (corners,
 * each in triangles), each vertex's (bone index, weight) list in the body asset's bone order, and the body's polygons
 * drawn shaved.
 */
export function gameHair(rig, hair) {
  const r5 = (x) => +x.toFixed(5);
  return {
    verts: hair.verts.flat().map(r5),
    polys: hair.polys.map((p) => p.v),
    // each polygon's material: 4 the hair, 5 to 8 the hair in a valley (its step, the darkest first), 3 the buzz (the
    // shave's tone)
    mat: hair.polys.map((p) => (p.buzz ? 3 : p.valley ? 4 + p.valley : 4)),
    tris: hair.tris.flat(),
    weights: hair.weights.map((l) => l.flatMap(([bn, w]) => [rig.at.get(bn), +w.toFixed(4)])),
    shave: hair.shave,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const HULL = carve(opt('style', 'swept'));
  if (args.includes('--asset')) {
    const out = { built: 'node tools/sculpt/lowhair.mjs --asset (tools/sculpt/lowhair.mjs gameHair)' };
    for (const who of ['male', 'female']) {
      const rig = buildRig(who);
      out[who] = Object.fromEntries(Object.entries(STYLES).map(([id, st]) => [id, gameHair(rig, buildHair(rig, st, carve(id)))]));
    }
    const file = new URL('../../src/sculpt/assets/lowhair.json', import.meta.url);
    writeFileSync(file, JSON.stringify(out));
    console.log('wrote', file.pathname);
  }
  for (const who of opt('who', args.includes('--asset') ? '' : 'male,female').split(',').filter(Boolean)) {
    const rig = buildRig(who), hair = buildHair(rig, STYLES[opt('style', 'swept')], HULL);
    const rest = crossings(rig, hair, rig.B.verts, hair.verts);
    console.log(who, 'tris', hair.tris.length, 'valleys', hair.polys.filter((p) => p.valley).length, 'pieces', hair.pieces.map((p) => `${p.id}:${(p.polys[1] - p.polys[0])}`).join(' '), 'open edges', openEdges(hair), 'shaved polys', hair.shave.length, 'crossings at rest', rest.n, JSON.stringify(rest.hits.slice(0, 6).map(([h, s]) => [h, rig.B.polys[s].name])));
    const X = hairCrossings(rig, hair), count = (l) => { const m = {}; for (const x of l) { const key = [x.a, x.b].sort().join('-'); m[key] = (m[key] ?? 0) + 1; } return JSON.stringify(m); };
    console.log('  pieces through one another where it shows:', X.length, count(X), 'on the sides', X.filter((x) => x.side).length, count(X.filter((x) => x.side)));
    if (who === 'male') console.log('outline difference against the sheet (mean px):', Object.entries(outlineDiff(hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz).map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]))).map(([v, d]) => `${v} ${d.px}`).join(', '));
  }
}
