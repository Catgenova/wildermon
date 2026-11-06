/**
 * Baking a sculpt: the model's distance sampled on a grid and the surface
 * drawn through it (naive surface nets: one vertex per crossing cell at the
 * mean of its edge crossings, a quad across every grid edge that changes
 * sign), smooth normals from the field's gradient, a material per vertex from
 * the nearest primitive and its stamps, and bone weights per vertex from the
 * primitives that reach it. Baked once per (model, band) and kept.
 */
import {
  BAND_CLOSE, BAND_FAR, BAND_GAME, distanceAt, unit, type Band, type Hit, type Model, type Prim, type V3,
} from './sdf';

export interface Baked {
  band: Band;
  /** Per vertex: rest position (3), normal (3), material (1), bones (4), weights (4), the stamp's material and how far inside it (2): 17 floats. */
  verts: Float32Array;
  /** Triangles, three vertex indices each. */
  tris: Uint32Array;
  nVerts: number;
  nTris: number;
  /** The bones in the order the weights index them. */
  bones: string[];
  /** How long the bake took, ms, and the grid it ran on. */
  ms: number;
  grid: [number, number, number];
  cell: number;
}

/** Floats per vertex. */
export const STRIDE = 17;

/** The grid cell per band, in units: a body is seventeen tall. */
export const CELL: Record<Band, number> = { 0: 0.3, 1: 0.17, 2: 0.085 };

/** How far a primitive's influence reaches a vertex for skinning, in units. */
const REACH = 0.45;

export function bake(model: Model, band: Band, boneOrder: string[], cell = CELL[band]): Baked {
  const t0 = performance.now();
  const prims = model.prims.filter((p) => p.band <= band && (p.until === undefined || band <= p.until));
  const lo = model.box[0], hi = model.box[1];
  const pad = cell * 2;
  const x0 = lo[0] - pad, y0 = lo[1] - pad, z0 = lo[2] - pad;
  const nx = Math.ceil((hi[0] - lo[0] + 2 * pad) / cell) + 1, ny = Math.ceil((hi[1] - lo[1] + 2 * pad) / cell) + 1, nz = Math.ceil((hi[2] - lo[2] + 2 * pad) / cell) + 1;
  const field = new Float32Array(nx * ny * nz);
  const I = (x: number, y: number, z: number): number => (z * ny + y) * nx + x;
  // Per z-slab, the primitives whose box crosses it: most samples see a handful.
  const slab: Prim[][] = [];
  for (let z = 0; z < nz; z++) {
    const zz = z0 + z * cell;
    slab.push(prims.filter((p) => p.cut || p.keep || (p.box[0][2] <= zz + cell && p.box[1][2] >= zz - cell)));
  }
  const p: V3 = [0, 0, 0];
  for (let z = 0; z < nz; z++) {
    p[2] = z0 + z * cell;
    const ps = slab[z];
    for (let y = 0; y < ny; y++) {
      p[1] = y0 + y * cell;
      for (let x = 0; x < nx; x++) {
        p[0] = x0 + x * cell;
        field[I(x, y, z)] = distanceAt(ps, p, band);
      }
    }
  }
  // Vertices: one per cell with a sign change, at the mean of its edge crossings.
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const C = (x: number, y: number, z: number): number => (z * (ny - 1) + y) * (nx - 1) + x;
  const pos: number[] = [];
  const corner = (x: number, y: number, z: number): V3 => [x0 + x * cell, y0 + y * cell, z0 + z * cell];
  const EDGES: Array<[number, number, number, number, number, number]> = [
    [0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1],
  ];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [ax, ay, az, bx, by, bz] of EDGES) {
      const a = field[I(x + ax, y + ay, z + az)], b = field[I(x + bx, y + by, z + bz)];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      const pa = corner(x + ax, y + ay, z + az), pb = corner(x + bx, y + by, z + bz);
      sx += pa[0] + (pb[0] - pa[0]) * t; sy += pa[1] + (pb[1] - pa[1]) * t; sz += pa[2] + (pb[2] - pa[2]) * t;
      n++;
    }
    if (!n) continue;
    cellVert[C(x, y, z)] = pos.length / 3;
    pos.push(sx / n, sy / n, sz / n);
  }
  // Faces: across each grid edge with a sign change, the quad of the four cells round it, wound toward the outside.
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const v = field[I(x, y, z)];
    const inside = v < 0;
    if (x + 1 < nx) {
      const w = field[I(x + 1, y, z)];
      if ((w < 0) !== inside) quad(cellVert[C(x, y - 1, z - 1)], cellVert[C(x, y, z - 1)], cellVert[C(x, y, z)], cellVert[C(x, y - 1, z)], !inside);
    }
    if (y + 1 < ny) {
      const w = field[I(x, y + 1, z)];
      if ((w < 0) !== inside) quad(cellVert[C(x - 1, y, z - 1)], cellVert[C(x - 1, y, z)], cellVert[C(x, y, z)], cellVert[C(x, y, z - 1)], !inside);
    }
    if (z + 1 < nz) {
      const w = field[I(x, y, z + 1)];
      if ((w < 0) !== inside) quad(cellVert[C(x - 1, y - 1, z)], cellVert[C(x, y - 1, z)], cellVert[C(x, y, z)], cellVert[C(x - 1, y, z)], !inside);
    }
  }
  // Per vertex: the normal from the field's gradient, the material from the nearest primitive and its stamps, the bones from what reaches it.
  const nV = pos.length / 3;
  const verts = new Float32Array(nV * STRIDE);
  const boneIndex = new Map(boneOrder.map((b, i) => [b, i]));
  const hit: Hit = { d: 0, prim: null };
  const e = cell * 0.5;
  const q: V3 = [0, 0, 0];
  const weights = new Map<number, number>();
  for (let i = 0; i < nV; i++) {
    const vx = pos[i * 3], vy = pos[i * 3 + 1], vz = pos[i * 3 + 2];
    const zi = Math.max(0, Math.min(nz - 1, Math.round((vz - z0) / cell)));
    const ps = slab[zi];
    q[0] = vx + e; q[1] = vy; q[2] = vz; const dx1 = distanceAt(ps, q, band);
    q[0] = vx - e; const dx0 = distanceAt(ps, q, band);
    q[0] = vx; q[1] = vy + e; const dy1 = distanceAt(ps, q, band);
    q[1] = vy - e; const dy0 = distanceAt(ps, q, band);
    q[1] = vy; q[2] = vz + e; const dz1 = distanceAt(ps, q, band);
    q[2] = vz - e; const dz0 = distanceAt(ps, q, band);
    const n = unit([dx1 - dx0, dy1 - dy0, dz1 - dz0]);
    q[2] = vz;
    distanceAt(ps, q, band, hit);
    const m = hit.prim ? hit.prim.m : 0;
    const vp: V3 = [vx, vy, vz];
    // The stamp with most say here, over every primitive the vertex is near (a blend between two is either's surface): inside one,
    // the one it is deepest in; outside all, the nearest edge, so the edge interpolates straight across.
    let mB = m, dB = -1;
    // Bones: every primitive within reach weighs in by how near it is, split between its two bones where it has two.
    weights.clear();
    for (const pr of ps) {
      if (pr.cut || pr.keep) continue;
      const b = pr.box;
      if (vx < b[0][0] - REACH || vx > b[1][0] + REACH || vy < b[0][1] - REACH || vy > b[1][1] + REACH || vz < b[0][2] - REACH || vz > b[1][2] + REACH) continue;
      const d = pr.d(vp);
      if (d > REACH) continue;
      if (pr.stamps && d < (pr.blend ?? 0) + e * 2) for (const s of pr.stamps) {
        if (s.band > band) continue;
        const sh = s.at(vp, n);
        if (sh && sh.d > dB) { dB = sh.d; mB = sh.m; }
      }
      const w = d <= 0 ? 1 : 1 - d / REACH;
      const bi = boneIndex.get(pr.bone) ?? 0;
      if (pr.bone2 && pr.split) {
        const t = Math.max(0, Math.min(1, (((vx - pr.split.from[0]) * pr.split.axis[0] + (vy - pr.split.from[1]) * pr.split.axis[1] + (vz - pr.split.from[2]) * pr.split.axis[2])) / pr.split.span));
        const bj = boneIndex.get(pr.bone2) ?? 0;
        weights.set(bi, (weights.get(bi) ?? 0) + w * (1 - t));
        weights.set(bj, (weights.get(bj) ?? 0) + w * t);
      } else weights.set(bi, (weights.get(bi) ?? 0) + w);
    }
    const top = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    const o = i * STRIDE;
    verts[o] = vx; verts[o + 1] = vy; verts[o + 2] = vz;
    verts[o + 3] = n[0]; verts[o + 4] = n[1]; verts[o + 5] = n[2];
    verts[o + 6] = m;
    for (let k = 0; k < 4; k++) { verts[o + 7 + k] = top[k] ? top[k][0] : 0; verts[o + 11 + k] = top[k] ? top[k][1] / sum : 0; }
    verts[o + 15] = mB; verts[o + 16] = dB;
  }
  return { band, verts, tris: Uint32Array.from(tris), nVerts: nV, nTris: tris.length / 3, bones: boneOrder, ms: performance.now() - t0, grid: [nx, ny, nz], cell };
}

/** The band a zoom is drawn at: far under one, the game's zooms to two and a half, close over that (the figure's `STILL_BELOW`). */
export const bandOf = (zoom: number): Band => (zoom < 1 ? BAND_FAR : zoom < 2.5 ? BAND_GAME : BAND_CLOSE);


