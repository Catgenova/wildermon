// The hair's volume carved from the reference sheet's five silhouettes (tools/sculpt/lowhairsheet.py writes them to
// tools/sculpt/hairs/<style>-mask.json): a visual hull on the male's head, under the sheet's five cameras
// (tools/sculpt/lowhaircams.json, fitted to the sheet's face, ears and neck; the back's scale and height its own, by
// its ears against the front's: the sheet draws that view about 6% smaller), kept outside his skull. Read back as a
// thickness over the skull: per direction from the skull's centre (over, out: tools/sculpt/lowhair.mjs dirOf) how far
// the hull stands off the skin. A thickness, so it carries to any head: hers takes his hair's thickness on her own skull.
//
//   node tools/sculpt/lowhairhull.mjs [--style swept]      # the hull's size, per view how much of the silhouette it fills
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit } from './lowrig.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
export const PIV = [0, 1, 0.1];
/** A body's sheet cameras (tools/sculpt/lowhairreg.mjs: the man's lowhaircams.json, the woman's lowhaircams-female.json). */
export const camsFile = (who = 'male') => join(DIR, who === 'female' ? 'lowhaircams-female.json' : 'lowhaircams.json');
export const camsFor = (who = 'male') => JSON.parse(readFileSync(existsSync(camsFile(who)) ? camsFile(who) : camsFile('male'), 'utf8'));
export const CAMS = camsFor('male');

/** A point on the sheet under one of its cameras (tools/sculpt/lowcam.mjs project, orthographic), then the view's own
 * 2D correction (tools/sculpt/lowhairreg.mjs: the sheet's face drawn a little narrower or sheared against the body's):
 * turned `roll` degrees in the picture, its across stretched `ax`, its up `ay`, and sheared `sh` (across by up). */
export function project(p, c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const x = p[0] - PIV[0], y = p[1] - PIV[1], z = p[2] - PIV[2];
  let qx = ca * x + sa * z, qy = sb * sa * x + cb * y - sb * ca * z;
  const qz = -cb * sa * x + sb * y + cb * ca * z;
  if (c.roll || c.ax || c.ay || c.sh) {
    const r = ((c.roll ?? 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
    const rx = cr * qx - sr * qy, ry = sr * qx + cr * qy;
    qx = (c.ax ?? 1) * (rx + (c.sh ?? 0) * ry); qy = (c.ay ?? 1) * ry;
  }
  return [c.cx + c.s * qx, c.cy - c.s * qy, qz];
}
/** The view's 2D correction as a map of the head's space (for a renderer that takes yaw, pitch and scale only): a point
 * moved so that the plain camera draws it where project() puts it. */
export function warpOf(c) {
  if (!(c.roll || c.ax || c.ay || c.sh)) return (p) => p;
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const Rm = [[ca, 0, sa], [sb * sa, cb, -sb * ca], [-cb * sa, sb, cb * ca]];
  const r = ((c.roll ?? 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
  return (p) => {
    const d = [p[0] - PIV[0], p[1] - PIV[1], p[2] - PIV[2]], q = Rm.map((row) => row[0] * d[0] + row[1] * d[1] + row[2] * d[2]);
    const rx = cr * q[0] - sr * q[1], ry = sr * q[0] + cr * q[1], w = [(c.ax ?? 1) * (rx + (c.sh ?? 0) * ry), (c.ay ?? 1) * ry, q[2]];
    return [0, 1, 2].map((k) => PIV[k] + Rm[0][k] * w[0] + Rm[1][k] * w[1] + Rm[2][k] * w[2]);
  };
}
/** The view's direction toward the viewer, in the head's space. */
export function toViewer(c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180;
  return [-Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)];
}

/** The sheet's silhouettes: inside(x, y) for a sheet pixel. */
export function maskOf(style = 'swept', grow = 0) {
  const M = JSON.parse(readFileSync(join(DIR, `hairs/${style}-mask.json`), 'utf8'));
  const A = new Uint8Array(M.w * M.h);
  M.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * M.w + r[k], y * M.w + r[k + 1]); });
  // grown by `grow` pixels (a disc), for the cameras' registration error
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

/**
 * How well a mesh's outline meets the sheet's hair silhouettes, per view: the pixels of the sheet's silhouette the mesh
 * leaves bare, the pixels the mesh covers outside it, and their sum over the silhouette's own outline length (a mean
 * distance between the two outlines, in sheet pixels). tris: triangles as three points each; the hair counts only where
 * it stands in front of the male's head (body).
 */
export function outlineDiff(tris, style = 'swept', body = bodyTris(buildRig('male').B)) {
  const m = maskOf(style), out = {};
  for (const v of VIEWS) {
    const c = CAMS[v], Z = new Float32Array(m.w * m.h).fill(-Infinity), cov = new Uint8Array(m.w * m.h);
    // the hair where it is in front of the head
    raster(body, c, Z, m.w, m.h, cov, 0);
    raster(tris, c, Z, m.w, m.h, cov, 1);
    // only this view's own columns
    const [lo, hi] = SPAN[v];
    let bare = 0, over = 0, edge = 0;
    for (let y = 0; y < m.h; y++) for (let x = lo; x < hi; x++) {
      const i = y * m.w + x, a = m.raw[i];
      if (a && !cov[i]) bare++;
      if (!a && cov[i]) over++;
      if (a && (!m.raw[i - 1] || !m.raw[i + 1] || !m.raw[i - m.w] || !m.raw[i + m.w])) edge++;
    }
    out[v] = { bare, over, px: +((bare + over) / Math.max(1, edge)).toFixed(2) };
  }
  return out;
}
/** Triangles (three points each) into a depth buffer (larger toward the viewer) under a camera; where one is in front,
 * `ids` (if given) takes `id`. */
export function raster(tris, c, Z, W, Hh, ids = null, id = 1) {
  for (const t of tris) {
    const p = t.map((q) => project(q, c));
    const ar = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(ar) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[1][1] - py) * (p[2][0] - px)) / ar, w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[2][1] - py) * (p[0][0] - px)) / ar, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2], i = y * W + x;
      if (z > Z[i]) { Z[i] = z; if (ids) ids[i] = id; }
    }
  }
}
/** The head, the neck and the shoulders of a body as triangles (three points each). */
export const bodyTris = (B, P = B.verts) => B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => P[i]));

/** Each view's columns on the sheet. */
const SPAN = { front: [40, 370], q3: [345, 660], profile: [650, 960], r3: [960, 1260], back: [1260, 1530] };

export const dirOf = (over, out) => { const a = (over * Math.PI) / 180, b = (out * Math.PI) / 180; return [Math.sin(b), Math.cos(b) * Math.sin(a), Math.cos(b) * Math.cos(a)]; };
export const angOf = (d) => { const out = (Math.asin(Math.max(-1, Math.min(1, d[0]))) * 180) / Math.PI; let over = (Math.atan2(d[1], d[2]) * 180) / Math.PI; if (over < -60) over += 360; return [over, out]; };

/** The skull's radius from its centre along each direction, as a table over (over, out). */
export function skullTable(B, centre, step = 2) {
  const tris = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => t.v.map((i) => B.verts[i]));
  const ray = (d) => {
    let best = 0;
    for (const [a, b, c] of tris) {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const s = sub(centre, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
      const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = dot(e2, q) / det; if (t > best) best = t;
    }
    return best;
  };
  return gridOf(step, (over, out) => ray(dirOf(over, out)));
}

/** A table over over -60..300 and out -90..90 at `step` degrees, read back bilinearly. */
function gridOf(step, f) {
  const no = Math.round(360 / step) + 1, nu = Math.round(180 / step) + 1, T = new Float64Array(no * nu);
  for (let i = 0; i < no; i++) for (let j = 0; j < nu; j++) T[i * nu + j] = f(-60 + i * step, -90 + j * step);
  const at = (over, out) => {
    const x = Math.min(no - 1.001, Math.max(0, (over + 60) / step)), y = Math.min(nu - 1.001, Math.max(0, (out + 90) / step));
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const v = (a, b) => T[a * nu + b];
    return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy;
  };
  return { T, at, step, no, nu };
}

/** The skull's centre (as lowhair.mjs skullOf). */
export function centreOf(B) { const P = (n) => B.verts[B.index.get(n)]; return [0, P('b5.L')[1], (P('t0')[2] + P('bk')[2]) / 2]; }

/**
 * The visual hull on the male's head, read back as the hair's thickness over his skull: thick(over, out) in head units
 * (0 where the hull leaves the skin bare). Voxels `vox` apart, inside `need` of the five silhouettes (grown by `grow`
 * pixels), outside the skull; the
 * thickness along a direction is how far past the skin the hull runs on without a break.
 */
export function carve(style = 'swept', vox = 0.02, grow = 2, need = 5, mirror = true) {
  const rig = buildRig('male'), B = rig.B, C = centreOf(B), skull = skullTable(B, C);
  const inside = maskOf(style, grow);
  const cams = VIEWS.map((v) => CAMS[v]);
  // each view's depth of the head (and neck and shoulders): a voxel behind the head in a view is hidden there, so that
  // view cannot carve it (the sheet's hair is a silhouette only where nothing stands in front of it)
  const W = 1536, Hh = 430;
  const body = bodyTris(B);
  const zbuf = cams.map((c) => { const Z = new Float32Array(W * Hh).fill(-Infinity); raster(body, c, Z, W, Hh); return Z; });
  const keeps = (p, k) => {
    const s = project(p, cams[k]);
    if (inside(s[0], s[1])) return true;
    const X = Math.floor(s[0]), Y = Math.floor(s[1]);
    return X >= 0 && Y >= 0 && X < W && Y < Hh && s[2] < zbuf[k][Y * W + X] - 0.02;
  };
  // (the sheet's views are drawn, not rendered from one model: they disagree by a few pixels here and there, the profile
  // most, so a voxel stays where `need` of the five keep it)
  // (his left side: the sheet draws only his right in the three-quarter, the profile and the rear three-quarter, so his
  // left is carved by those three mirrored too, the hair's envelope the same both sides; else only the front and the
  // back would carve it, and it stands out in their corners)
  const side = VIEWS.map((v, k) => (['q3', 'profile', 'r3'].includes(v) ? k : -1)).filter((k) => k >= 0);
  const inHull = (p) => {
    let n = 0; for (let k = 0; k < cams.length; k++) if (keeps(p, k)) n++;
    if (n < need) return false;
    if (!mirror) return true;
    const m = [2 * C[0] - p[0], p[1], p[2]];
    return side.every((k) => keeps(m, k));
  };
  const thick = gridOf(2, (over, out) => {
    const d = dirOf(over, out), r0 = skull.at(over, out);
    if (!(r0 > 0)) return 0;
    // (the outermost of the hull along the ray, gaps under it filled: a lock's lip overhangs the buzz, a voxel at the
    // skin under it carved by the view that sees the buzz there)
    let t = 0;
    for (let u = 0; u < 0.6; u += vox / 2) if (inHull(add(C, mul(d, r0 + u + vox / 2)))) t = u + vox / 2;
    return t;
  });
  return { C, skull, thick, inHull, rig };
}

/** The hull as a surface for a look (not the hair's mesh): its outer skin over a grid of directions `step` apart, on a
 * body's own skull (rig), the thickness the male's. */
export function hullSurface(H, rig, step = 3) {
  const C = centreOf(rig.B), skull = rig.who === 'male' ? H.skull : skullTable(rig.B, C);
  const verts = [], polys = [], id = new Map();
  const V = (o, u) => {
    const key = o + ',' + u;
    if (!id.has(key)) { const t = H.thick.at(o, u); id.set(key, t > 0.005 ? verts.push(add(C, mul(dirOf(o, u), skull.at(o, u) + t))) - 1 : -1); }
    return id.get(key);
  };
  for (let o = -30; o < 240; o += step) for (let u = -90; u < 90; u += step) {
    const q = [V(o, u), V(o + step, u), V(o + step, u + step), V(o, u + step)];
    if (q.every((i) => i >= 0)) polys.push({ v: q[0] === q[1] ? q.slice(1) : q, piece: 0 });
  }
  const tris = [];
  polys.forEach((p, pi) => { for (let k = 1; k + 1 < p.v.length; k++) tris.push([p.v[0], p.v[k], p.v[k + 1], pi]); });
  return { verts, polys, tris, pieces: [{ id: 'hull', polys: [0, polys.length] }], shave: [] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const t0 = Date.now(), H = carve(opt('style', 'swept'), 0.02, +opt('grow', 2), +opt('need', 5));
  let n = 0, max = 0; for (const v of H.thick.T) { if (v > 0.01) n++; max = Math.max(max, v); }
  console.log('hull: directions covered', n, 'of', H.thick.T.length, 'thickest', max.toFixed(3), 'ms', Date.now() - t0);
  const S = hullSurface(H, H.rig, 2);
  console.log('outline difference (sheet px):', JSON.stringify(outlineDiff(S.tris.map(([a, b, c]) => [S.verts[a], S.verts[b], S.verts[c]]))));
}
