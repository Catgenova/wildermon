// The bob with blunt bangs (tools/sculpt/ref/hair-bob.png) for the low-poly bodies: the game's 'bob', "Bob". The sheet's
// five views (their hair silhouettes, tools/sculpt/lowbobsheet.py; their cameras registered to each body's head,
// tools/sculpt/lowbobcams.mjs) carved into a visual hull on that body (carve), read back as the hair's outer radius from
// the skull's middle per direction (outerOf), and the hair built over it as one closed shell of locks (buildBob):
//
//   columns  round the head at the style's angles (tools/sculpt/hairs/bob.mjs): a lock between two borders, its ridge
//            stood out and its borders sunk, so each lock shows two flat planes; the fringe's locks across the forehead,
//            the temple's border doubled (the fringe's end and the side's), the back's locks to the nape.
//   rows     from the crown (one point) down each column to its hem, where the hull ends: the fringe's over the brows,
//            the sides' at the jaw, the back's at the nape; a ridge's hem a little lower than its borders' (the lock's
//            tip); the last rows curled in toward the head (the bob's turned-under ends).
//   inside   the shell's inner side: sunk into the scalp under the cap, the curtain's inside a thickness in from its
//            outside and clear of the face, the ears and the neck; the rim between them at the hem (the blunt cut's
//            thickness) in the valleys' shade, the inside too.
//
// Rigid on the head. The fit: each outer corner moved in or out along its ray so the outline meets the sheet's in all
// five views (fitOutline: the share of the hair's pixels both cover, IoU, per view).
//
//   node tools/sculpt/lowbob.mjs [--who female,male] [--fit]   # counts, crossings, IoU per view
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, posed, skin } from './lowrig.mjs';
import { raster, centreOf } from './lowhairhull.mjs';
import { bodyInside } from './lowbraid.mjs';
import { BOB_VIEWS as VIEWS, BOB_SPAN as SPAN, bobCams, bodyAt, sheetAt } from './lowbobcams.mjs';
import { crossings, openEdges, skinHair } from './lowhair.mjs';
import BOB from './hairs/bob.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export { VIEWS, SPAN };

/** The sheet's hair silhouettes: inside(x, y) for a sheet pixel, grown by `grow` pixels (a disc). */
export function maskOf(grow = 0) {
  const M = JSON.parse(readFileSync(join(DIR, 'hairs/bob-mask.json'), 'utf8'));
  const A = new Uint8Array(M.w * M.h);
  M.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * M.w + r[k], y * M.w + r[k + 1]); });
  let G = A;
  if (grow > 0) {
    G = new Uint8Array(A.length);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!A[y * M.w + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
        if (dx * dx + dy * dy > grow * grow) continue;
        const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < M.w && Y < M.h) G[Y * M.w + X] = 1;
      }
    }
  }
  const f = (x, y) => { const X = Math.floor(x), Y = Math.floor(y); return X >= 0 && Y >= 0 && X < M.w && Y < M.h && G[Y * M.w + X] === 1; };
  f.raw = A; f.w = M.w; f.h = M.h;
  return f;
}

/** A body's head, neck and torso as triangles: what hides the hair in the sheet's views. */
export const bodyTris = (B, P = B.verts) => B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => P[i]));

/** Each view's body depth (the body stretched as the camera says), for the hair's outline against the sheet's. */
function bodyDepth(B, cams, w, h) {
  const body = bodyTris(B);
  return Object.fromEntries(VIEWS.map((v) => { const c = cams[v], Z = new Float32Array(w * h).fill(-Infinity); raster(body.map((t) => t.map(bodyAt(c))), c, Z, w, h); return [v, Z]; }));
}

/**
 * The hair's outline against the sheet's, per view: the hair's pixels in front of the body (the body stretched and
 * drawn under the view's camera, as the sheet hides the hair behind the neck), against the sheet's hair. IoU (both over
 * either), the sheet's hair left bare, the hair over the background, in the view's columns. tris: three points each.
 */
export function outlineIoU(tris, who, ctx = ioUCtx(who)) {
  const out = {};
  for (const v of VIEWS) out[v] = viewIoU(tris, v, ctx);
  return out;
}
export function ioUCtx(who, rig = buildRig(who)) {
  const m = maskOf(), cams = bobCams(who);
  // (the fringe's band per view that shows the face: the face's columns, from FRINGE_TOP to a little under the cut,
  // tools/sculpt/lowbobsheet.py)
  const band = JSON.parse(readFileSync(join(DIR, 'hairs/bob-sheet.json'), 'utf8')).marks.fringe ?? {};
  return { m, cams, band, Zb: bodyDepth(rig.B, cams, m.w, m.h) };
}
export function viewIoU(tris, v, ctx) {
  const { m, cams, Zb } = ctx;
  const c = cams[v], Z = Float32Array.from(Zb[v]), cov = new Uint8Array(m.w * m.h), st = bodyAt(c);
  raster(tris.map((t) => t.map(st)), c, Z, m.w, m.h, cov, 1);
  const [lo, hi] = SPAN[v];
  let both = 0, either = 0, bare = 0, over = 0;
  for (let y = 0; y < m.h; y++) for (let x = lo; x < hi; x++) {
    const i = y * m.w + x, a = m.raw[i], b = cov[i];
    if (a || b) either++;
    if (a && b) both++; else if (a) bare++; else if (b) over++;
  }
  const out = { iou: +(both / Math.max(1, either)).toFixed(4), bare, over };
  // the fringe's band alone: its strands and the forehead between them
  const fb = ctx.band?.[v];
  if (fb) {
    let b2 = 0, e2 = 0;
    for (let y = 150; y < fb.cut + 6; y++) for (let x = fb.columns[0]; x <= fb.columns[1]; x++) { const i = y * m.w + x, a = m.raw[i], b = cov[i]; if (a || b) e2++; if (a && b) b2++; }
    out.fringe = +(b2 / Math.max(1, e2)).toFixed(4);
  }
  return out;
}

/**
 * The visual hull on a body: voxels `vox` apart in a box round the head, kept where every view keeps them (inside its
 * hair silhouette grown by `grow` px, or hidden there behind the body) and outside the body, and kept only with their
 * mirror across the head's middle when `mirror` (the style's `symmetric`: the sheet's views see one side each).
 */
export function carve(rig, { vox = 0.02, grow = 1, cams = bobCams(rig.who), mirror = true } = {}) {
  const B = rig.B, body = bodyTris(B), inside = maskOf(grow), W = inside.w, Hh = inside.h;
  const cl = VIEWS.map((v) => cams[v]);
  const zbuf = cl.map((c) => { const Z = new Float32Array(W * Hh).fill(-Infinity); raster(body.map((t) => t.map(bodyAt(c))), c, Z, W, Hh); return Z; });
  const lo = [-1.5, -0.9, -1.6], hi = [1.5, 2.7, 1.5];
  const n = lo.map((a, k) => Math.ceil((hi[k] - a) / vox));
  const [nx, ny, nz] = n, keep = new Uint8Array(nx * ny * nz);
  const inBody = bodyInside(body, lo, n, vox);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = i + nx * (j + ny * k);
    if (inBody[idx]) continue;
    const p = [lo[0] + (i + 0.5) * vox, lo[1] + (j + 0.5) * vox, lo[2] + (k + 0.5) * vox];
    let ok = true;
    for (let c = 0; c < cl.length && ok; c++) {
      const s = sheetAt(p, cl[c]);
      if (inside(s[0], s[1])) continue;
      const X = Math.floor(s[0]), Y = Math.floor(s[1]);
      ok = X >= 0 && Y >= 0 && X < W && Y < Hh && s[2] < zbuf[c][Y * W + X] - 0.02;
    }
    if (ok) keep[idx] = 1;
  }
  const solid = new Uint8Array(keep.length);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = i + nx * (j + ny * k);
    solid[idx] = keep[idx] && (!mirror || keep[nx - 1 - i + nx * (j + ny * k)]) ? 1 : 0;
  }
  const at = (p) => { const i = Math.floor((p[0] - lo[0]) / vox), j = Math.floor((p[1] - lo[1]) / vox), k = Math.floor((p[2] - lo[2]) / vox); return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && solid[i + nx * (j + ny * k)] === 1; };
  return { solid, lo, n, vox, at, rig };
}

/** A direction from the skull's middle: theta round from the front toward her left, phi up from level (degrees). */
export const dirOf = (th, ph) => { const t = (th * Math.PI) / 180, p = (ph * Math.PI) / 180; return [Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p)]; };

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

/** The head's (with its ears) and the neck's skin as a radius from the skull's middle per direction, and the hull's
 * outermost point along the same ray (0 where the ray meets no hair), on a grid `step` degrees apart: theta 0..180
 * -180..180 (her left positive), phi -90..90. */
const SMOOTH_HULL = 14;
export function outerOf(H, C, step = 2) {
  const B = H.rig.B, skinT = B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const nt = Math.round(360 / step) + 1, np = Math.round(180 / step) + 1, body = new Float64Array(nt * np), out = new Float64Array(nt * np);
  for (let a = 0; a < nt; a++) for (let b = 0; b < np; b++) {
    const d = dirOf(-180 + a * step, -90 + b * step), rb = farHit(skinT, C, d);
    body[a * np + b] = rb;
    let last = 0;
    for (let t = Math.max(0.2, rb); t < 2.2; t += H.vox / 2) if (H.at(add(C, mul(d, t)))) last = t;
    out[a * np + b] = last;
  }
  // (the hull's voxels step, and its five views leave flat facets where a dome was: its radius smoothed over its
  // neighbours where they find the hull too, SMOOTH_HULL passes)
  for (let pass = 0; pass < SMOOTH_HULL; pass++) {
    const was = Float64Array.from(out);
    for (let a = 0; a < nt; a++) for (let b = 0; b < np; b++) {
      if (!(was[a * np + b] > 0)) continue;
      let s = 0, w = 0;
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) {
        const A = Math.min(nt - 1, Math.max(0, a + da)), Bq = b + db;
        if (Bq < 0 || Bq >= np || !(was[A * np + Bq] > 0)) continue;
        const k = da || db ? 1 : 2; s += was[A * np + Bq] * k; w += k;
      }
      out[a * np + b] = s / w;
    }
  }
  const read = (T) => (th, ph) => {
    th = ((th + 540) % 360) - 180;
    const x = Math.min(nt - 1.001, Math.max(0, (th + 180) / step)), y = Math.min(np - 1.001, Math.max(0, (ph + 90) / step)), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const v = (p, q) => T[p * np + q];
    return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy;
  };
  return { body: read(body), out: read(out), raw: { body, out, nt, np, step } };
}

/** A column's hem: down the column from `from`, while the hull stands off the skin, the point where the hull's outside is
 * lowest (the curtain's outer lower corner: past it the hull's underside runs in toward the neck), the first within
 * `tol` of the lowest. */
function hemOf(R, C, th, from = 60, tol = 0.012) {
  let last = from;
  const pts = [];
  for (let ph = from; ph >= -88; ph -= 0.5) {
    const o = R.out(th, ph), b = R.body(th, ph);
    if (o > 0 && o > b + 0.01) { last = ph; pts.push([ph, C[1] + o * Math.sin((ph * Math.PI) / 180)]); } else if (ph < last - 4) break;
  }
  if (!pts.length) return from;
  const low = Math.min(...pts.map((p) => p[1]));
  return pts.find((p) => p[1] <= low + tol)[0];
}

const CACHE = new Map();
/** The hull and its radii for a body, once. */
export function hullOf(rig, style = BOB) {
  if (!CACHE.has(rig.who)) {
    const H = carve(rig, { mirror: style.symmetric }), C = centreOf(rig.B);
    CACHE.set(rig.who, { H, C, R: outerOf(H, C) });
  }
  return CACHE.get(rig.who);
}

/**
 * The bob on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces, shave, scalp,
 * centre, k, grid }. style: tools/sculpt/hairs/bob.mjs. adjust: per outer corner [column][row] a radial offset (head
 * units) from the fit.
 */
export function buildBob(rig, style = BOB, { adjust = null, clear = true, temple = [0, 0], crown = [0, 0] } = {}) {
  const { C, R } = hullOf(rig, style);
  const S = style;
  // the columns: per lock its two borders and its ridge between; the temple's border doubled
  const half = [];
  const borders = S.borders;
  for (let i = 0; i + 1 < borders.length; i++) {
    const a = borders[i], b = borders[i + 1];
    half.push({ th: a, ridge: false, fringe: a < S.temple });
    half.push({ th: (a + b) / 2, ridge: true, fringe: (a + b) / 2 < S.temple });
  }
  half.push({ th: borders.at(-1), ridge: false, fringe: false });
  // (the temple's border: the fringe's end a hair before it, the side's a hair after)
  const ti = half.findIndex((c) => c.th === S.temple);
  half.splice(ti, 1, { th: S.temple - S.templeGap[0], ridge: false, fringe: true }, { th: S.temple + S.templeGap[1], ridge: false, fringe: false });
  // both sides: her right (negative) mirrored, then her left; the front's and the back's middle once
  const cols = [...half.slice().reverse().filter((c) => c.th > 0 && c.th < 180).map((c) => ({ ...c, th: -c.th })), ...half.filter((c) => c.th < 180)];
  if (half.some((c) => c.th === 0)) cols.splice(cols.findIndex((c) => c.th === 0), 1), cols.splice(cols.findIndex((c) => c.th >= 0), 0, half.find((c) => c.th === 0));
  // (each lock's border, but the temple's, as a narrow valley between two columns `valleyHalf` degrees each side of it,
  // the strip between them in the valleys' shade: the crease between two locks)
  if (S.valleyHalf) for (let j = cols.length - 1; j >= 0; j--) {
    const c = cols[j];
    if (c.ridge || Math.abs(Math.abs(c.th) - S.temple) <= Math.max(...S.templeGap) + 1e-6) continue;
    cols.splice(j, 1, { ...c, th: c.th - S.valleyHalf, strip: true, part: c.th === 0 }, { ...c, th: c.th + S.valleyHalf, part: c.th === 0 });
  }
  // (the fringe's notches, where the sheet's forehead shows between its strands: each a column at the notch's apex,
  // its cut raised to the apex, between two at its base's ends, the columns between left out; placed where the front
  // view's camera puts them on this body's fringe, tools/sculpt/hairs/bob.mjs notches)
  if (S.notches) {
    const cam = bobCams(rig.who).front, st = bodyAt(cam), ph0 = S.notchPhi;
    const thOf = (x) => { let best = 0, err = Infinity; for (let th = -70; th <= 70; th += 0.25) { const q = sheetAt(add(C, mul(dirOf(th, ph0), R.body(th, ph0) + S.notchOut)), cam); const e = Math.abs(q[0] - x); if (e < err) { err = e; best = th; } } return best; };
    for (const n of S.notches) {
      const a = thOf(n.base[0]), b = thOf(n.base[1]), t = thOf(n.x), lo = Math.min(a, b), hi = Math.max(a, b);
      for (let j = cols.length - 1; j >= 0; j--) if (cols[j].th > lo - 1.5 && cols[j].th < hi + 1.5) cols.splice(j, 1);
      cols.push({ th: lo, ridge: false, fringe: true }, { th: t, ridge: false, fringe: true, notch: (n.cut - n.apex) / cam.s }, { th: hi, ridge: false, fringe: true });
    }
    cols.sort((p, q) => p.th - q.th);
  }
  // (the fit's temple per side: her right's [0] and her left's [1] fringe end and curtain front edge turned that many
  // degrees back, negative forward)
  for (const c of cols) if (Math.abs(Math.abs(c.th) - S.temple) <= Math.max(...S.templeGap) + 1e-6) c.th += Math.sign(c.th) * temple[c.th < 0 ? 0 : 1];
  const nc = cols.length;
  // (a fit made for another set of columns is left out)
  if (adjust && adjust.length !== nc) adjust = null;
  // each column's hem: where the hull ends (smoothed along the fringe and along the sides), a ridge's lower by its tip
  for (const c of cols) c.hem0 = hemOf(R, C, c.th, c.fringe ? S.fringeFrom : 40);
  // (the sides' and the back's hems as heights, smoothed along the columns `hemSmooth` passes: the hull's voxels step)
  {
    const side = cols.map((c, j) => (c.fringe ? -1 : j)).filter((j) => j >= 0), yh = (c) => C[1] + R.out(c.th, c.hem0) * Math.sin((c.hem0 * Math.PI) / 180);
    let Y = side.map((j) => yh(cols[j]));
    for (let pass = 0; pass < S.hemSmooth; pass++) Y = Y.map((y, k) => (k === 0 || k === Y.length - 1 ? y : (Y[k - 1] + 2 * y + Y[k + 1]) / 4));
    side.forEach((j, k) => {
      const c = cols[j];
      // (the phi down the column whose hull point is at that height)
      let best = c.hem0, err = Infinity;
      for (let ph = c.hem0 + 25; ph >= c.hem0 - 25; ph -= 0.25) { const r = R.out(c.th, ph); if (!(r > 0)) continue; const e = Math.abs(C[1] + r * Math.sin((ph * Math.PI) / 180) - Y[k]); if (e < err) { err = e; best = ph; } }
      c.hem0 = best;
    });
  }
  // (the fringe cut level: every fringe column's hem at the height the hull's middle fringe ends at, |theta| under
  // `fringeMid`)
  // (the fringe's radius the greatest within `fringeFill` degrees across: the sheet's parting shows as a groove in the
  // hull, the fringe's cut is one straight line)
  const rOut = (c, ph) => { if (!c.fringe) return R.out(c.th, ph); let m = 0; for (let d = -S.fringeFill; d <= S.fringeFill; d += 2) m = Math.max(m, R.out(c.th + d, ph)); return m; };
  const yOf = (th, ph, c = { th }) => C[1] + rOut(c, ph) * Math.sin((ph * Math.PI) / 180);
  const mids = cols.filter((c) => c.fringe && Math.abs(c.th) < S.fringeMid);
  // (and never lower than the brows' top less `browCover`: the fringe is cut just above the brows, the eyes clear)
  const browTop = Math.max(...rig.B.polys.filter((p) => p.mat === 'brow').flatMap((p) => p.v).map((i) => rig.B.verts[i][1]));
  const Yf = Math.max(mids.reduce((a, c) => a + yOf(c.th, c.hem0), 0) / mids.length + (S.fringeShift ?? 0), browTop - S.browCover);
  // the rows: from the crown to the fringe's cut (S.rowsTop, the same in every column, so the rows run level round the
  // head), then on the sides and the back on down to the hem (S.rowsLow): a side column's rows past the fringe's are the
  // curtain's front edge where it meets the fringe at the temple
  const KT = S.rowsTop.length - 1, KL = S.rowsLow.length, nOf = (c) => (c.fringe ? KT : KT + KL);
  cols.forEach((c, j) => {
    // (past the hull's own end the fringe carried straight down: c.hold, the radius at the hull's end kept level)
    if (c.fringe) {
      let ph = S.fringeFrom, last = rOut(c, ph), lastPh = ph;
      const y = (q) => { const r = rOut(c, q); if (r > 0) { last = r; lastPh = q; return C[1] + r * Math.sin((q * Math.PI) / 180); } return C[1] + Math.tan((q * Math.PI) / 180) * last * Math.cos((lastPh * Math.PI) / 180); };
      while (ph > -40 && y(ph - 0.25) > Yf) ph -= 0.25;
      c.hem0 = ph; c.hold = { r: last, ph: lastPh };
    }
    const deg = (x) => (x * 180) / Math.PI, r0 = rOut(c, c.hem0) || c.hold?.r || 0, h0 = (c.hem0 * Math.PI) / 180;
    // (the fit's own drop for the column, adjust[j][its rows])
    const drop = S.hemDrop + (adjust?.[j]?.[nOf(c)] ?? 0);
    c.hem = (c.fringe ? c.hem0 : deg(Math.atan2(r0 * Math.sin(h0) - drop, r0 * Math.cos(h0)))) + (c.ridge ? -(c.fringe ? S.fringeTip : S.tip) : 0) + (c.th === 0 ? S.partRise : 0);
  });
  // (the level the top rows end at on the sides: the fringe's cut at the temple)
  const tc = cols.filter((c) => c.fringe).reduce((a, c) => (Math.abs(c.th) > Math.abs(a.th) ? c : a));
  const phF = tc.hem;
  // (a ridge's rows staggered `stagger` of the way to the next row: the facets run diagonally and no row rings the head)
  const stag = (fs, c) => fs.map((f, i) => (c.ridge && i + 1 < fs.length && i > 0 ? f + S.stagger * (fs[i + 1] - f) : f));
  const rowPhis = (c) => {
    const top = c.fringe ? c.hem : Math.max(phF, c.hem + 10);
    const all = c.fringe ? S.rowsTop.slice(1) : [...S.rowsTop.slice(1), ...S.rowsLow.map((f) => 1 + f)];
    const fs = stag([0, ...all], c).slice(1);
    return fs.map((f) => (f <= 1 ? 90 - (90 - top) * f : top + (c.hem - top) * (f - 1)));
  };
  const outer = [], inner = [];
  const P = (th, ph, r) => add(C, mul(dirOf(th, ph), r));
  const bodyAt3 = (th, ph) => R.body(th, ph);
  // how far into the face (in front of the temples, below the forehead's hairline) or down the nape a skin point is: 0
  // the scalp, 1 off it
  const B = rig.B, hairline = B.verts[B.index.get('t0')][1] - S.hairlineDrop;
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const faceShare = (p) => Math.max(ramp(p[2] - C[2], 0.05, 0.3) * ramp(hairline - p[1], 0, 0.08), ramp(C[1] - 0.35 - p[1], 0, 0.15));
  const rad = (x) => (x * Math.PI) / 180;
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = [], n = [], phis = rowPhis(c), last = phis.length - 1;
    phis.forEach((ph, i) => {
      // (the hull's radius; under the hull's hem, the curtain carried straight down: the radius that keeps the hem's
      // distance from the upright axis)
      let r = rOut(c, ph);
      if (ph < c.hem0 || !(r > 0)) { const h = c.hold && !(rOut(c, c.hem0) > 0) ? c.hold : { r: rOut(c, c.hem0), ph: c.hem0 }; r = (h.r * Math.cos(rad(h.ph))) / Math.max(0.2, Math.cos(rad(ph))); }
      const rb = bodyAt3(c.th, ph);
      // the lock: the ridge stood out, the borders in (by the share of the hair's thickness there, at most `relief`)
      const t = Math.max(0, r - rb);
      let rr = r + (c.ridge ? 1 : -1) * Math.min(S.relief, S.reliefShare * t) * (S.reliefRows[i] ?? 1);
      if (adjust) rr += adjust[j][i] ?? 0;
      rr = Math.max(rr, rb + S.minThick);
      // the curl: the last rows turned in toward the head's upright axis (counted from the hem)
      const cu = c.fringe ? 0 : S.curl[S.curl.length - 1 - (last - i)] ?? 0, d0 = dirOf(c.th, 0);
      let po = add(P(c.th, ph, rr), mul(d0, -cu));
      // (the fringe's cut level at Yf: a strand's middle `fringeTipY` lower, the parting `partRiseY` higher)
      const yCut = Yf - (c.ridge ? S.fringeTipY : 0) + (c.th === 0 || c.part ? S.partRiseY : 0) + (c.notch ?? 0);
      if (c.fringe && i === last) po = [po[0], yCut, po[2]];
      o.push(po);
      // the inside: sunk into the scalp where the hair lies on it; a thickness in from the outside where it hangs free,
      // clear of the skin (over the face and the nape the skin is not the scalp: the inside stays off it there)
      const free = rr - rb > S.thick + S.clear, f = faceShare(P(c.th, ph, rb));
      let ri = free ? Math.max(rb + S.clear, rr - S.thick) : rb - S.sink + (S.sink + S.clear) * f;
      // (the hem's inside, and the curtain's front edge's, just off the skin: the cut's thickness shows, the fringe not
      // glued to the forehead)
      if (i === last || (!c.fringe && i >= KT - 1)) ri = Math.max(ri, Math.min(rr - S.minThick, rb + S.lip));
      // (the fringe a thin sheet over the forehead: below the hairline its inside a sheet's thickness in from its outside)
      if (c.fringe && f > 0) ri = Math.max(ri, rr - S.fringeSheet - (1 - f) * (rr - ri));
      let pi = add(P(c.th, ph, Math.min(ri, rr - S.minThick * 0.5)), mul(d0, -cu));
      if (c.fringe && i === last) pi = [pi[0], yCut, pi[2]];
      n.push(pi);
    });
    outer.push(o); inner.push(n);
  }
  // the crown: one point over the head, the hull's top
  const topR = R.out(0, 90) || R.body(0, 90) + S.minThick;
  const verts = [], polys = [];
  const V = (p) => verts.push(p) - 1;
  // (the crown's point: the hull's top, raised by the fit's crown[0] and tipped crown[1] degrees toward the front)
  const crownO = V(P(0, 90 - crown[1], (R.out(0, 90 - crown[1]) || topR) + crown[0])), crownI = V(P(0, 90, R.body(0, 90) - S.sink));
  const oi = outer.map((col) => col.map(V)), ii = inner.map((col) => col.map(V));
  const poly = (v, sh = {}) => polys.push({ v, piece: 0, ...sh });
  const rim = (v) => poly(v, { valley: S.rimShade });
  for (let j = 0; j < nc; j++) {
    const k = (j + 1) % nc, Lj = oi[j].length, Lk = oi[k].length, L = Math.min(Lj, Lk);
    poly([crownO, oi[k][0], oi[j][0]]);
    poly([crownI, ii[j][0], ii[k][0]], { valley: S.insideShade });
    const crease = cols[j].strip ? { valley: S.creaseShade } : {};
    for (let i = 0; i + 1 < L; i++) {
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], i ? crease : {});
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade });
    }
    // the rim: the blunt cut's thickness, under the shorter of the two; down the longer's front edge past it
    rim([oi[j][L - 1], oi[k][L - 1], ii[k][L - 1], ii[j][L - 1]]);
    for (let i = L - 1; i + 1 < Lj; i++) rim([oi[j][i + 1], oi[j][i], ii[j][i], ii[j][i + 1]]);
    for (let i = L - 1; i + 1 < Lk; i++) rim([oi[k][i], oi[k][i + 1], ii[k][i + 1], ii[k][i]]);
  }
  // (each quad two flat triangles, each its own facet: the sheet's long diagonal planes)
  if (S.triFacets) for (const p of polys.splice(0)) {
    if (p.v.length === 3) { polys.push(p); continue; }
    const [a, b, cc, d] = p.v, { v, ...sh } = p;
    if (Math.hypot(...sub(verts[a], verts[cc])) <= Math.hypot(...sub(verts[b], verts[d]))) polys.push({ v: [a, b, cc], ...sh }, { v: [a, cc, d], ...sh });
    else polys.push({ v: [a, b, d], ...sh }, { v: [b, cc, d], ...sh });
  }
  // orientation: outward from the skull's middle on the outside (the faces were wound one way round; turned if the
  // shell's volume comes out negative)
  let vol = 0;
  for (const p of polys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(verts[p.v[0]], cross(verts[p.v[j]], verts[p.v[j + 1]]));
  if (vol < 0) for (const p of polys) p.v.reverse();
  for (const p of polys) if (!p.valley) delete p.valley;
  const tris = [];
  polys.forEach((p, pi) => {
    if (p.v.length === 3) { tris.push([...p.v, pi]); return; }
    const [a, b, c, d] = p.v;
    // (the quad's diagonal the shorter one, so a lock's plane folds along its length)
    if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
  });
  const pieces = [{ id: 'bob', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const hair = { verts, polys, tris, weights: verts.map(() => [['head', 1]]), pieces, centre: C, k: 1, grid: { cols, outer: oi, inner: ii, crownO, crownI } };
  hair.scalp = scalpOf(rig.B, C, hair);
  hair.shave = hair.scalp;
  if (clear) clearBody(rig, hair, S);
  return hair;
}

/**
 * The hair clear of the body at rest: a face of it through the skin that is not the scalp it covers (the face, the
 * ears, the jaw, the neck) has its corners moved out `step` at a time (from the skull's middle; below the jaw's
 * height level, out from the head's upright axis, so the ends stand off the neck and do not drop onto the shoulders; an
 * inner corner's outer one with it, the shell kept its least thickness; through the shoulders, raised), until none is,
 * at rest and in the game's clips' poses (tools/sculpt/hairs/bob-poses-<who>.json).
 */
function clearBody(rig, hair, S, step = 0.006) {
  const { verts, grid } = hair, C = hair.centre, mate = new Map();
  grid.inner.forEach((col, j) => col.forEach((v, i) => mate.set(v, grid.outer[j][i])));
  // (the body at rest and in the game's clips' poses, tools/sculpt/lowbobanim.mjs --write: the body's own vertices in
  // each, and the frames that carry the hair, rigid on the head)
  let poses = [];
  try { poses = JSON.parse(readFileSync(join(DIR, `hairs/bob-poses-${rig.who}.json`), 'utf8')); } catch { /* none written */ }
  const states = [{ P: rig.B.verts, f: null }, ...poses.map((pose) => { const f = posed(rig, pose); return { P: skin(rig, f), f }; })];
  const hitsIn = (st) => crossings(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts).hits;
  for (let it = 0; it < 80; it++) {
    const hits = states.flatMap(hitsIn);
    if (!hits.length) break;
    const out = (p) => { const d = sub(p, C); return unit(p[1] < C[1] - S.levelBelow ? [d[0], 0, d[2]] : d); };
    // (through the shoulders: the ends raised instead)
    const up = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'torso').flatMap(([hp]) => hair.polys[hp].v));
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
      const d = up.has(v) ? [0, 1, 0] : out(verts[v]);
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) {
        const gap = dot(sub(verts[o], verts[v]), d);
        if (gap < S.minThick * 0.5) verts[o] = add(verts[o], mul(d, S.minThick * 0.5 - gap));
      }
    }
  }
  hair.clearedIn = states.map(hitsIn).map((h) => h.length);
  hair.cleared = crossings(rig, hair, rig.B.verts, verts).n;
  return hair;
}

/** The scalp: the head's skin polygons (not the ears) the hair covers, every corner seen from the skull's middle. */
function scalpOf(B, C, hair) {
  const T = hair.tris.map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]), memo = new Map();
  const under = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))) > 0); return memo.get(vi); };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every(under)) out.push(i); });
  return out;
}

/** The bob on a body with its outline fit (tools/sculpt/hairs/bob-fit-<who>.json, `--fit`), else as built. */
export function bobOf(rig, style = BOB) {
  let fit = {};
  try { fit = JSON.parse(readFileSync(join(DIR, `hairs/bob-fit-${rig.who}.json`), 'utf8')); } catch { /* not fitted yet */ }
  return buildBob(rig, style, { adjust: fit.adjust ?? null, temple: fit.temple ?? [0, 0], crown: fit.crown ?? [0, 0] });
}

/** The hair's triangles as three points each. */
export const tri3 = (h, P = h.verts) => h.tris.map(([a, b, c]) => [P[a], P[b], P[c]]);

/**
 * The fit, in two stages, each raising the five views' IoU sum:
 *   smooth  the temple per side (buildBob temple), the crown's point (raised, tipped forward), and per row (and for the hems' drop) an offset round the head as a short Fourier series in theta (FOURIER terms:
 *           even, then each side's own), so a row moves as one smooth band and the hem stays one even line;
 *   fine    then each corner alone (the corners above and below it by half), small steps, a lock's bend along its
 *           length and two neighbours apart costing (SMOOTH), the hems' drops kept even (HEM_EVEN).
 * The score: the five views' IoU, and FRINGE_W of each fringe band's (its strands and the forehead between them).
 * Coordinate descent, the step halved each round.
 */
const SMOOTH = 2, HEM_EVEN = 40, FOURIER = 4, FRINGE_W = 0.5;
const basisOf = (th) => { const t = (th * Math.PI) / 180, out = [1]; for (let k = 1; k <= FOURIER; k++) out.push(Math.cos(k * t), Math.sin(k * t)); return out; };
export function fitOutline(rig, style = BOB, { rounds = 3, fine = 2, step = 0.03, log = true } = {}) {
  const ctx = ioUCtx(rig.who, rig);
  let hair = buildBob(rig, style, { clear: false });
  const nc = hair.grid.cols.length, NRj = hair.grid.outer.map((c) => c.length), NR = Math.max(...NRj);
  const Bs = hair.grid.cols.map((c) => basisOf(c.th)), NB = Bs[0].length;
  // (per row its coefficients, and last the hems' drop's)
  const coef = Array.from({ length: NR + 1 }, () => new Array(NB).fill(0));
  const fineAdj = NRj.map((n) => new Array(n + 1).fill(0));
  const expand = () => NRj.map((n, j) => Array.from({ length: n + 1 }, (_, i) => { const c = coef[i === n ? NR : i]; let v = fineAdj[j][i]; for (let k = 0; k < NB; k++) v += c[k] * Bs[j][k]; return v; }));
  const rough = () => {
    let e = 0;
    for (let j = 0; j < nc; j++) for (let i = 0; i <= NRj[j]; i++) {
      const nr = NRj[j], k = (j + 2) % nc, k1 = (j + 1) % nc, A = fineAdj;
      if (i > 0 && i + 1 < nr) e += (A[j][i - 1] - 2 * A[j][i] + A[j][i + 1]) ** 2;
      if (i < nr && i < NRj[k]) e += 0.25 * (A[j][i] - A[k][i]) ** 2;
      if (i === nr && NRj[k1] === nr) e += HEM_EVEN * (A[j][i] - A[k1][i]) ** 2;
    }
    return SMOOTH * e;
  };
  const temple = [0, 0], crown = [0, 0];
  const score = () => { const r = outlineIoU(tri3(hair = buildBob(rig, style, { adjust: expand(), clear: false, temple, crown })), rig.who, ctx); return { r, s: Object.values(r).reduce((a, q) => a + q.iou + FRINGE_W * (q.fringe ?? 0), 0) - rough() }; };
  let best = score();
  const say = (what) => log && console.log(rig.who, what, Object.entries(best.r).map(([v, q]) => `${v} ${q.iou}`).join(' '));
  say('fit start');
  const descend = (get, set, st) => {
    for (const sg of [1, -1]) {
      let moved = false;
      for (let it = 0; it < 6; it++) {
        set(get() + sg * st);
        const s = score();
        if (s.s > best.s + 1e-5) { best = s; moved = true; } else { set(get() - sg * st); break; }
      }
      if (moved) return;
    }
  };
  for (let round = 0; round < rounds; round++) {
    const st = step / 2 ** round;
    for (const sd of [0, 1]) descend(() => temple[sd], (x) => { temple[sd] = x; }, 3 / 2 ** round);
    descend(() => crown[0], (x) => { crown[0] = x; }, st);
    descend(() => crown[1], (x) => { crown[1] = x; }, 4 / 2 ** round);
    for (let i = 0; i <= NR; i++) for (let k = 0; k < NB; k++) descend(() => coef[i][k], (x) => { coef[i][k] = x; }, k ? st / 2 : st);
    say(`smooth round ${round}`);
  }
  for (let round = 0; round < fine; round++) {
    const st = step / 4 / 2 ** round;
    for (let j = 0; j < nc; j++) for (let i = 0; i <= (hair.grid.cols[j].fringe ? NRj[j] - 1 : NRj[j]); i++) {
      const nr = NRj[j];
      const bump = (d) => { if (i === nr) { fineAdj[j][nr] += d; return; } fineAdj[j][i] += d; if (i > 0) fineAdj[j][i - 1] += d / 2; if (i + 1 < nr) fineAdj[j][i + 1] += d / 2; };
      let acc = 0;
      descend(() => acc, (x) => { bump(x - acc); acc = x; }, st);
    }
    say(`fine round ${round}`);
  }
  return { temple: temple.map((x) => +x.toFixed(2)), crown: crown.map((x) => +x.toFixed(3)), coef: coef.map((r) => r.map((x) => +x.toFixed(4))), adjust: expand().map((r) => r.map((x) => +x.toFixed(4))), iou: best.r };
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

if (import.meta.url === `file://${process.argv[1]}` && !process.argv.includes('--fit')) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who);
    const h0 = hullOf(rig);
    let nv = 0; for (const v of h0.H.solid) nv += v;
    console.log(who, 'hull voxels', nv, 'ms', Date.now() - t0);
    const hair = bobOf(rig);
    console.log(who, 'tris', hair.tris.length, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'columns', hair.grid.cols.length, 'hems', hair.grid.cols.filter((c) => c.th >= 0).map((c) => `${c.th}:${c.hem.toFixed(0)}`).join(' '));
    console.log(who, 'IoU', JSON.stringify(outlineIoU(tri3(hair), who)));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)));
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); return `${n} ${JSON.stringify(crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)))}`; }).join('; '));
  }
}

// node tools/sculpt/lowbob.mjs --fit [--who female,male]: the outline fit written to tools/sculpt/hairs/bob-fit-<who>.json
if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--fit')) {
  const { writeFileSync } = await import('node:fs');
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), r = fitOutline(buildRig(who), BOB, { rounds: +opt('rounds', 3), fine: +opt('fine', 2) });
    writeFileSync(join(DIR, `hairs/bob-fit-${who}.json`), JSON.stringify({ built: 'node tools/sculpt/lowbob.mjs --fit', iou: r.iou, temple: r.temple, crown: r.crown, coef: r.coef, adjust: r.adjust }) + '\n');
    console.log(who, 'fitted in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
}
