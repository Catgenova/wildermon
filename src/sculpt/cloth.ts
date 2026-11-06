/**
 * Cloth over the base: a garment is tubes lofted along chains of the rig's
 * joints, each ring kept at least an offset off the body (its radius read off
 * the body's own vertices around the axis) and pushed out to the silhouette
 * traced from the design sheet where that is wider, ending on a hem that can
 * rise and fall around the tube. Each ring vertex borrows the bone weights of
 * the body vertex nearest it, so the cloth bends where the body does; a piece
 * can hang its lower part on a sway chain instead, hung from the joint the
 * hem is below and swung by the rig's tail. Prints are the stamps the base
 * already draws with: a border up from the hem, a collar down from the top, a
 * band, a sigil, each a signed distance the shader blends at its edge.
 * `garments/base.json` holds the traced garments; `garmentChains` gives the
 * rig the sway chains they ask for; `clothe` appends the cloth to a bake.
 */
import GARMENTS from './garments/base.json';
import { STRIDE, type Baked } from './bake';
import { M } from './models/body';
import { at, type Bones, type Chain } from './rig';
import type { V3 } from './sdf';

export type Print =
  | { kind: 'border'; width: number; material: string }
  | { kind: 'collar'; width: number; material: string }
  | { kind: 'band'; t: [number, number]; material: string }
  | { kind: 'sigil'; at: [number, number]; r: number; material: string; shape?: 'disc' | 'diamond' };
export interface Piece {
  name: string;
  /** One tube on each side, the chain's joints suffixed 0 and 1. */
  mirror?: boolean;
  /** Joints the tube's axis runs through: a joint's name, or [name, dz] for the point dz body heights above it. */
  chain: Array<string | [string, number]>;
  /** Where along the chain the tube starts and ends, nought to one. */
  t: [number, number];
  rings: number;
  sides: number;
  /** How far off the body the cloth stays, in body heights. */
  offset: number;
  /** The slope the cloth drapes over a ledge in what is under it at, in reach per unit along the tube (1.2 unless said). */
  drape?: number;
  /** Which body vertices are under this tube, by the name of their first bone. */
  bones: string;
  /** More of them: vertices on these bones that stand above a joint (by dz heights), so a shirt's body takes in the shoulders. */
  include?: Array<{ bones: string; above: [string, number] }>;
  /** The front view's traced edge, [x, z] in body heights, x out from the axis. */
  front?: number[][];
  /** The profile's traced edges, [y, z], y forward from the axis. */
  profile?: { front: number[][]; back: number[][] };
  /** The hem's rise and fall around the tube: [angle, dt] pairs, angles from the front toward the body's left. */
  hem?: number[][];
  /** The part of the tube past `from` hangs on a sway chain of `links` links `step` heights long. */
  sway?: { from: number; links: number; step: number; stiffness: number };
  prints?: Print[];
}
export interface Garment { material: string; pieces: Piece[] }
interface SheetView { crown: number; sole: number; x: number }
interface GarmentFile { sheet: Record<string, SheetView>; garments: Record<string, Garment>; demo: Record<string, Record<string, Print[]>> }
export const GARMENT_FILE = GARMENTS as unknown as GarmentFile;

type Mat = keyof typeof M;
const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** The name of a piece's sway chain, on a side for a mirrored piece. */
const chainName = (garment: string, piece: Piece, k: number): string => `${garment}-${piece.name}${piece.mirror ? k : ''}`;
const boneName = (name: string, piece: Piece, k: number): string => (piece.mirror ? `${name}${k}` : name);

/** A piece's axis: its joints at rest, and the point and direction at any fraction of its length. */
function axisOf(piece: Piece, k: number, rest: Bones, H: number): { pts: V3[]; cum: number[]; L: number; P: (t: number) => V3; T: (t: number) => V3; jointAt: (t: number) => string } {
  const pts: V3[] = piece.chain.map((e) => {
    const [name, dz] = typeof e === 'string' ? [e, 0] : e;
    const p = at(rest, boneName(name, piece, k));
    return [p[0], p[1], p[2] + dz * H];
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  const L = cum[cum.length - 1] || 1;
  const seg = (t: number): [number, number] => {
    const s = t * L;
    let i = 0; while (i < pts.length - 2 && s > cum[i + 1]) i++;
    const l = cum[i + 1] - cum[i] || 1;
    return [i, (s - cum[i]) / l];
  };
  return {
    pts, cum, L,
    P: (t) => { const [i, u] = seg(t); return [0, 1, 2].map((c) => pts[i][c] + (pts[i + 1][c] - pts[i][c]) * u) as V3; },
    T: (t) => { const [i] = seg(t); return unit(sub(pts[i + 1], pts[i])); },
    jointAt: (t) => { let i = 0; while (i < pts.length - 1 && cum[i + 1] <= t * L) i++; const e = piece.chain[i]; return boneName(typeof e === 'string' ? e : e[0], piece, k); },
  };
}

/** The sway chains the garments hang their hems on, from the rig at rest. */
export function garmentChains(garments: Record<string, Garment>, rest: Bones, H: number): Chain[] {
  const out: Chain[] = [];
  for (const [gname, g] of Object.entries(garments)) for (const piece of g.pieces) {
    if (!piece.sway) continue;
    for (const k of piece.mirror ? [0, 1] : [0]) {
      const ax = axisOf(piece, k, rest, H);
      const parent = ax.jointAt(piece.sway.from), x = rest[parent];
      const p = sub(ax.P(piece.sway.from), x.t), d = ax.T(piece.sway.from), m = x.m;
      // Into the parent's frame: the rotation's transpose.
      const local = (v: V3): V3 => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
      out.push({ name: chainName(gname, piece, k), parent, at: local(p), dir: local(d), links: piece.sway.links, step: piece.sway.step * H, stiffness: piece.sway.stiffness });
    }
  }
  return out;
}

/** A polyline's x at height z, by the two points around z, held at the ends. */
function along(poly: number[][], z: number): number {
  const s = [...poly].sort((a, b) => a[1] - b[1]);
  if (z <= s[0][1]) return s[0][0];
  for (let i = 1; i < s.length; i++) if (z <= s[i][1]) { const u = (z - s[i - 1][1]) / (s[i][1] - s[i - 1][1] || 1); return s[i - 1][0] + (s[i][0] - s[i - 1][0]) * u; }
  return s[s.length - 1][0];
}
/** The hem's rise at an angle, between the pairs given, around the tube. */
function hemAt(hem: number[][] | undefined, deg: number): number {
  if (!hem || !hem.length) return 0;
  const s = [...hem].sort((a, b) => a[0] - b[0]);
  const a = ((deg % 360) + 360) % 360;
  const wrapped = [...s, [s[0][0] + 360, s[0][1]]];
  const first = [s[s.length - 1][0] - 360, s[s.length - 1][1]];
  const all = [first, ...wrapped];
  for (let i = 1; i < all.length; i++) if (a <= all[i][0]) { const u = (a - all[i - 1][0]) / (all[i][0] - all[i - 1][0] || 1); return all[i - 1][1] + (all[i][1] - all[i - 1][1]) * u; }
  return s[0][1];
}
const angleDiff = (a: number, b: number): number => { let d = ((a - b) % 360 + 540) % 360 - 180; if (d < -180) d += 360; return d; };

interface Shell { verts: number[]; tris: number[] }

/** One tube of a piece on one side, as bake vertices and triangles, over the body's vertices. */
function tube(gname: string, piece: Piece, k: number, mat: number, prints: Print[], body: Baked, rest: Bones, order: string[], H: number): Shell {
  const ax = axisOf(piece, k, rest, H);
  // The body's vertices under this tube: those whose first bone is one of the piece's.
  const re = new RegExp(piece.bones);
  const under: number[] = [];
  const more = (piece.include ?? []).map((inc) => ({ re: new RegExp(inc.bones), z: at(rest, boneName(inc.above[0], piece, k))[2] + inc.above[1] * H }));
  for (let i = 0; i < body.nVerts; i++) {
    const name = order[body.verts[i * STRIDE + 7]];
    const side = !piece.mirror || name.endsWith(String(k));
    if (side && (re.test(name) || more.some((m) => m.re.test(name) && body.verts[i * STRIDE + 2] > m.z))) under.push(i);
  }
  const bv = body.verts;
  const nearest = (p: V3): number => {
    let best = under[0] ?? 0, bd = Infinity;
    for (const i of under) { const o = i * STRIDE, dd = (bv[o] - p[0]) ** 2 + (bv[o + 1] - p[1]) ** 2 + (bv[o + 2] - p[2]) ** 2; if (dd < bd) { bd = dd; best = i; } }
    return best;
  };
  const [t0, t1] = piece.t, off = piece.offset * H;
  const N = piece.sides, R = piece.rings;
  const spacing = (ax.L * Math.abs(t1 - t0)) / R, core = Math.max(0.15, 0.5 * spacing), wide = Math.max(0.6, 1.5 * spacing), drape = piece.drape ?? 1.2;
  /*
   * How far the body reaches from a ring's axis point, by sector round it: the furthest vertex in each sector, those
   * near the ring's plane as they are and those further up or down the tube less by `drape` for each unit they are
   * off it, so a ledge in the body below (the deltoid under a shirt's shoulder) is draped over at that slope rather
   * than sat on, and a sparse mesh still has something in reach. One table a ring, read for every vertex on it.
   */
  const frame = (t: number): { c: V3; tg: V3; u: V3; v: V3 } => {
    const c = ax.P(t), tg = ax.T(t);
    let u = cross([0, 1, 0], tg); if (Math.hypot(...u) < 1e-4) u = [1, 0, 0]; u = unit(u);
    return { c, tg, u, v: unit(cross(tg, u)) };
  };
  const table = (f: { c: V3; tg: V3; u: V3; v: V3 }): Float64Array => {
    const sect = new Float64Array(N).fill(-1);
    for (const i of under) {
      const o = i * STRIDE, q: V3 = [bv[o] - f.c[0], bv[o + 1] - f.c[1], bv[o + 2] - f.c[2]];
      const dz = Math.abs(dot(q, f.tg)); if (dz > wide) continue;
      const qu = dot(q, f.u), qv = dot(q, f.v);
      const eff = Math.hypot(qu, qv) - drape * Math.max(0, dz - core);
      const sidx = ((Math.round((Math.atan2(-qu, qv) / (Math.PI * 2)) * N) % N) + N) % N;
      if (eff > sect[sidx]) sect[sidx] = eff;
    }
    return sect;
  };
  const reach = (sect: Float64Array, j: number): number => {
    for (const w of [1, 2, 4, Math.ceil(N / 2)]) {
      let r = -1;
      for (let s = j - w; s <= j + w; s++) r = Math.max(r, sect[((s % N) + N) % N]);
      if (r >= 0) return r;
    }
    return off * 2;
  };
  const pos: V3[] = [], dirs: V3[] = [], param: Array<{ a: number; t: number; th: number; r: number }> = [];
  // The rings down the tube, then a lip: the hem ring again, drawn in under the cloth, so the hem has a thickness and
  // the cloth's colour shows where the inside would.
  for (let i = 0; i <= R + 1; i++) {
    const lip = i > R, ti = t0 + (t1 - t0) * (Math.min(i, R) / R);
    const sect = table(frame(ti));
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2, deg = (j / N) * 360;
      const th = t1 + hemAt(piece.hem, deg), t = t0 + (th - t0) * (Math.min(i, R) / R) - (lip ? 0.015 : 0);
      const { c, u, v } = frame(t);
      const d: V3 = [Math.cos(a) * v[0] - Math.sin(a) * u[0], Math.cos(a) * v[1] - Math.sin(a) * u[1], Math.cos(a) * v[2] - Math.sin(a) * u[2]];
      let r = reach(sect, j) + off;
      // The traced silhouette, where it stands wider than the body: an ellipse through the front view's width and the
      // profile's depths (or the body's own depth at the front and back where there is no profile).
      if (piece.front) {
        const z = c[2] / H, w = along(piece.front, z) * H;
        const fr = piece.profile ? along(piece.profile.front, z) * H : reach(sect, 0) + off;
        const bk = piece.profile ? along(piece.profile.back, z) * H : reach(sect, N >> 1) + off;
        const dep = Math.cos(a) >= 0 ? fr : bk;
        const sil = 1 / Math.sqrt((Math.sin(a) / Math.max(w, 1e-3)) ** 2 + (Math.cos(a) / Math.max(dep, 1e-3)) ** 2);
        r = Math.max(r, sil);
      }
      if (lip) r = Math.max(r - 0.5 * off, 0.05);
      pos.push([c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r]);
      dirs.push(lip ? [-d[0], -d[1], -d[2]] : d);
      param.push({ a: deg, t, th, r });
    }
  }
  const tris: number[] = [];
  for (let i = 0; i <= R; i++) for (let j = 0; j < N; j++) {
    const a = i * N + j, b = i * N + ((j + 1) % N), c = (i + 1) * N + j, d = (i + 1) * N + ((j + 1) % N);
    tris.push(a, c, d, a, d, b);
  }
  // Smooth normals, turned outward.
  const nrm: V3[] = pos.map(() => [0, 0, 0]);
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    const fn = cross(sub(pos[b], pos[a]), sub(pos[c], pos[a]));
    for (const i of [a, b, c]) { nrm[i][0] += fn[0]; nrm[i][1] += fn[1]; nrm[i][2] += fn[2]; }
  }
  const verts: number[] = [];
  for (let i = 0; i < pos.length; i++) {
    let n = unit(nrm[i]);
    if (dot(n, dirs[i]) < 0) n = [-n[0], -n[1], -n[2]];
    const p = pos[i], q = param[i];
    // Weights: the body's nearest vertex, or the sway chain's link past the hang.
    let bones: number[] = [0, 0, 0, 0], weights: number[] = [0, 0, 0, 0];
    if (piece.sway && q.t > piece.sway.from) {
      const li = Math.min(piece.sway.links - 1, Math.floor(((q.t - piece.sway.from) / (1 - piece.sway.from)) * piece.sway.links));
      bones = [Math.max(0, order.indexOf(`${chainName(gname, piece, k)}${li}`)), 0, 0, 0]; weights = [1, 0, 0, 0];
    } else {
      const o = nearest(p) * STRIDE;
      bones = [bv[o + 7], bv[o + 8], bv[o + 9], bv[o + 10]]; weights = [bv[o + 11], bv[o + 12], bv[o + 13], bv[o + 14]];
    }
    // The print with the most claim on this vertex.
    let sm = mat, sd = -1;
    const hemD = (q.th - q.t) * ax.L, topD = (q.t - t0) * ax.L;
    for (const pr of prints) {
      let d = -1;
      if (pr.kind === 'border') d = pr.width * H - hemD;
      else if (pr.kind === 'collar') d = pr.width * H - topD;
      else if (pr.kind === 'band') d = Math.min(q.t - pr.t[0], pr.t[1] - q.t) * ax.L;
      else { const dx = (angleDiff(q.a, pr.at[0]) * Math.PI / 180) * q.r, dz = (q.t - pr.at[1]) * ax.L; d = pr.r * H - (pr.shape === 'diamond' ? Math.abs(dx) + Math.abs(dz) : Math.hypot(dx, dz)); }
      if (d > sd) { sd = d; sm = M[pr.material as Mat]; }
    }
    verts.push(p[0], p[1], p[2], n[0], n[1], n[2], mat, ...bones, ...weights, sm, sd);
  }
  return { verts, tris };
}

/** A bake with shells appended. */
function appended(body: Baked, shells: Shell[]): Baked {
  const nv = shells.reduce((s, sh) => s + sh.verts.length / STRIDE, 0), nt = shells.reduce((s, sh) => s + sh.tris.length, 0);
  const verts = new Float32Array((body.nVerts + nv) * STRIDE), tris = new Uint32Array(body.nTris * 3 + nt);
  verts.set(body.verts.subarray(0, body.nVerts * STRIDE));
  tris.set(body.tris.subarray(0, body.nTris * 3));
  let vo = body.nVerts, to = body.nTris * 3;
  for (const sh of shells) {
    verts.set(sh.verts, vo * STRIDE);
    for (let i = 0; i < sh.tris.length; i++) tris[to + i] = sh.tris[i] + vo;
    vo += sh.verts.length / STRIDE; to += sh.tris.length;
  }
  return { ...body, verts, tris, nVerts: vo, nTris: to / 3 };
}

/**
 * The bake with the garments' cloth appended, over the body it was baked for: each garment in the file's order is lofted
 * over the body and the garments before it, so a shirt sits over the trousers it is listed after. `demo` adds the print
 * demonstrations.
 */
export function clothe(body: Baked, garments: Record<string, Garment>, rest: Bones, order: string[], H: number, demo?: Record<string, Record<string, Print[]>>): Baked {
  const t0 = performance.now();
  let work = body;
  for (const [gname, g] of Object.entries(garments)) {
    const shells: Shell[] = [];
    for (const piece of g.pieces) for (const k of piece.mirror ? [0, 1] : [0]) {
      const prints = [...(piece.prints ?? []), ...(demo?.[gname]?.[piece.name] ?? [])];
      shells.push(tube(gname, piece, k, M[g.material as Mat], prints, work, rest, order, H));
    }
    work = appended(work, shells);
  }
  return { ...work, ms: body.ms + performance.now() - t0 };
}
