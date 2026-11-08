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
//     scale the hull's thickness taken this many times (the views disagree: one may carve what the others keep).
//     lip   the front ring's roots stand just off the skin (LIP), so the lock's front edge overhangs; float: every
//           ring's (a lip along the whole lock, as the fringe's lower edge over the forehead).
//     ends  [front, back]: how far each tip stands beyond its ring, as a share of the spline's own spacing (1 the
//           spline's end; less, a blunter end). tipUp: how high each tip stands off the spine, as a share of the
//           ring's height.
//     twist the upper corners leaned across by this share of their height (+ toward the head's left), along the inner
//           stations.
//     sec   its cross-section (or the name of one of the style's), [across (-0.5..0.5 of w), up (0..1 of h)] corners, the first and the last on the skin (sunk
//           SINK into it so the root never shows a gap); the corners' order runs from the head's right to its left.
//           Two corners side by side marked by a third value (1) are a groove's floor: the faces between them, the
//           lock's length, its valley (polygon `valley`, drawn a tone darker).
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
import { angOf, carve, outlineDiff } from './lowhairhull.mjs';

export const STYLES = { swept: SWEPT };
// (the game's 'undercut', "Shaved sides", may later take this style's shave with a top of its own)

const SINK = 0.04;
/** A corner's least height off the skin (a lock never thinner), and the gap under a lip's front edge. */
const MIN_H = 0.03, LIP = 0.015;

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
        else if (hull) q = onHull(q, b);
        if (!root && style.jitter) q = add(q, [0, 1, 2].map((c) => (hash(pieces.length * 101 + i * 7 + key[j], c) - 0.5) * 2 * style.jitter * Math.min(1, hh / (0.2 * k)) * k));
        verts.push(q);
        r.push(verts.length - 1);
      });
      ring.push(r);
    }
    // the faces: each band between two stations, a fan to each tip, outward
    const m = sec.length;
    // (a face between a groove's two corners is its valley, the whole length of the lock)
    const vl = (j) => (sec[j][2] && sec[(j + 1) % m][2] ? { valley: true } : {});
    const quad = (a, b, c, d, j) => polys.push({ v: [a, b, c, d], piece: pieces.length, ...vl(j) });
    for (let i = 1; i < n - 2; i++) for (let j = 0; j < m; j++) quad(ring[i][j], ring[i][(j + 1) % m], ring[i + 1][(j + 1) % m], ring[i + 1][j], j);
    for (let j = 0; j < m; j++) {
      polys.push({ v: [ring[0][0], ring[1][(j + 1) % m], ring[1][j]], piece: pieces.length, ...vl(j) });
      polys.push({ v: [ring[n - 1][0], ring[n - 2][j], ring[n - 2][(j + 1) % m]], piece: pieces.length, ...vl(j) });
    }
    pieces.push({ id: cl.id, polys: [first, polys.length], verts: [base, verts.length] });
  }
  if (style.v) aboveV(style, verts, pieces, skull, C, k);
  orientOut(verts, polys, pieces);
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
  const weights = weightsOf(rig, verts, style);
  const shave = shaveOf(B, style.shave), scalp = shaveOf(B, style.scalp ?? style.shave);
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
 * solved one (cl.fit.t, per row and station, head units on the male, tools/sculpt/lowhairfront.mjs) or, unsolved, the
 * hull's. The border (the first and the last rows, the roots behind the hairline and at the crown) are sunk in the
 * skin, the undersides clear of the face; the piece closes in a fan from the skull's centre under them. The pieces'
 * record keeps each corner's ray, its drop and its role (sole, tip) for the solver, and each row's line or band (src:
 * a crease's two rows the one).
 */
export function massOf(cl, { skull, C, k, verts, polys, pieces, hull, scalp }) {
  const n = cl.lines[0].length, band = cl.band ?? [[0.5, 0]], groove = cl.groove ?? 0.04, laid = [];
  cl.lines.forEach((cr, i) => {
    if (cr.length !== n) throw new Error(`${cl.id}: every line ${n} stations`);
    laid.push({ dirs: cr, drop: i > 0 && i < cl.lines.length - 1 ? groove : 0, crease: i > 0 && i < cl.lines.length - 1 });
    // (ridges: each tuft's one band row laid out on its own, rather than between its creases)
    if (i < cl.lines.length - 1) for (const [f, drop] of band) laid.push({ dirs: cl.ridges ? cl.ridges[i] : cr.map((a, j) => [0, 1].map((c) => a[c] + (cl.lines[i + 1][j][c] - a[c]) * f)), drop });
  });
  // the valleys (strip: { from, to, w }): each crease from station `from` to `to` two rows, each `w` of the way toward
  // the ridge beside it at the crease's own depth, the strip between them its valley; before and after, one row (the
  // two share their corners)
  const st = cl.strip, split = (j) => !!st && j >= st.from && j <= st.to, rows = [];
  laid.forEach((row, i) => {
    if (!st || !row.crease) { rows.push({ ...row, src: i }); return; }
    for (const [side, nb] of [[0, laid[i - 1]], [1, laid[i + 1]]]) {
      rows.push({ ...row, src: i, side, dirs: row.dirs.map((a, j) => (split(j) ? [0, 1].map((c) => a[c] + (nb.dirs[j][c] - a[c]) * st.w) : a)) });
    }
  });
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
    if (border) t = -(cl.sink ?? SINK);
    else if ((j === 1 || j === 2) && cl.flush) t = cl.flush[j - 1];
    else if (fit) t = fit.t[row.src][j];
    else t = Math.max(MIN_H, Math.max(cl.least ? cl.least[j] : 0, hull ? hull.thick.at(o, u) * (cl.scale ?? 1) : 0.12) - row.drop * gAt(j));
    rays.push({ i, j, d, r0: h.t, border, drop: row.drop * gAt(j), role: j === 1 ? 'sole' : j === 2 ? 'tip' : '' });
    // (a crease's second row shares the first's corners where it is not split)
    if (row.side === 1 && !split(j)) return ids[i - 1][j];
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
  }
  const centre = verts.push([...C]) - 1;
  // (a face with corners shared, where a crease's two rows meet, a triangle or none)
  const face = (v, extra) => { v = v.filter((a, m) => a !== v[(m + 1) % v.length]); if (v.length >= 3) polys.push({ v, piece: pieces.length, ...extra }); };
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j + 1 < n; j++) {
    // a valley: between a crease's two rows, from where they part (not the front end) to the back
    const valley = rows[i].side === 0 && rows[i + 1].side === 1 && split(j) && j >= st.from;
    face([ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]], valley ? { valley: true } : {});
  }
  // the border, once round (the first row front to back, the back end across, the last row back to front, the front
  // end across), fanned to the centre
  const ring = [...ids[0], ...ids.slice(1).map((r) => r[n - 1]), ...ids[R - 1].slice(0, -1).reverse(), ...ids.slice(1, -1).reverse().map((r) => r[0])].filter((a, m, all) => a !== all[(m + 1) % all.length]);
  ring.forEach((a, m) => polys.push({ v: [centre, ring[(m + 1) % ring.length], a], piece: pieces.length }));
  pieces.push({ id: cl.id, polys: [first, polys.length], verts: [base, verts.length], mass: { ids, rays, rows: R, n, src: rows.map((r) => r.src) } });
}

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
  for (const [a, b, c, pi] of hair.tris) {
    if (hair.polys[pi].buzz) continue;
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
    // each polygon's material: 4 the hair, 5 the hair in a valley (a tone darker), 3 the buzz (the shave's tone)
    mat: hair.polys.map((p) => (p.buzz ? 3 : p.valley ? 5 : 4)),
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
    if (who === 'male') console.log('outline difference against the sheet (mean px):', Object.entries(outlineDiff(hair.tris.filter(([, , , pi]) => !hair.polys[pi].buzz).map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]))).map(([v, d]) => `${v} ${d.px}`).join(', '));
  }
}
