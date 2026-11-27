/**
 * A low-poly body's occlusion, baked with its mesh (`./lowpoly` lowBaked): per polygon, how much of the sky over it the
 * polygons near it take, at rest. Each polygon is a disc of its own area at its middle, facing its own way, and shades the
 * polygons in front of it (on the side their faces look to) by the solid angle it covers there, either side of it facing
 * (a garment is a shell). Out to `reach` only, fading to nothing there, so what it finds are creases, hems over what is
 * under them, the gaps between pieces and the hair over the neck, never the far side of the body.
 *
 * Polygons are the mesh's own: its vertices are never shared between two (every polygon has its own corners, drawn flat),
 * so the triangles sharing a vertex are one polygon, and each of its corners takes the polygon's one value.
 */

import { AO_MOST } from './shading';

/**
 * The occlusion (summed solid angles, as `occlusion` adds them) that takes a polygon half of `AO_MOST` dark; by its
 * square, so a surface only a little in the lee of what is near it stays its colour and a crease goes dark.
 */
export const AO_HALF = 0.6;
/** How far a polygon shades others, as a share of the body's height. */
export const AO_REACH = 0.045;

/**
 * Per vertex, what its light is multiplied by: one where nothing is in front of its polygon, down to 1 - `AO_MOST`. Only
 * the vertices before `upTo` take part (a body, its hair and its garments); those after (what is held, laid at rest on a
 * hand) are one and shade nothing.
 */
export function occlusion(verts: ArrayLike<number>, stride: number, tris: ArrayLike<number>, nVerts: number, upTo: number): Float32Array {
  const out = new Float32Array(nVerts).fill(1);
  if (upTo <= 0) return out;
  // the polygons: the vertices joined by the triangles through them
  const up = new Int32Array(upTo);
  for (let i = 0; i < upTo; i++) up[i] = i;
  const root = (i: number): number => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  const nTris = Math.floor(tris.length / 3);
  for (let t = 0; t < nTris; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    if (a >= upTo || b >= upTo || c >= upTo) continue;
    const ra = root(a), rb = root(b), rc = root(c);
    if (rb !== ra) up[rb] = ra;
    if (rc !== ra) up[rc] = ra;
  }
  const poly = new Int32Array(upTo).fill(-1);
  let n = 0;
  for (let i = 0; i < upTo; i++) { const r = root(i); if (poly[r] < 0) poly[r] = n++; poly[i] = poly[r]; }
  // each polygon's area, middle (by its triangles' areas) and normal (its corners')
  const area = new Float64Array(n), mid = new Float64Array(n * 3), nrm = new Float64Array(n * 3);
  let zLo = Infinity, zHi = -Infinity;
  for (let t = 0; t < nTris; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    if (a >= upTo || b >= upTo || c >= upTo) continue;
    const ax = verts[a * stride], ay = verts[a * stride + 1], az = verts[a * stride + 2];
    const ux = verts[b * stride] - ax, uy = verts[b * stride + 1] - ay, uz = verts[b * stride + 2] - az;
    const vx = verts[c * stride] - ax, vy = verts[c * stride + 1] - ay, vz = verts[c * stride + 2] - az;
    const s = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), p = poly[a];
    area[p] += s;
    mid[p * 3] += s * (ax + (ux + vx) / 3); mid[p * 3 + 1] += s * (ay + (uy + vy) / 3); mid[p * 3 + 2] += s * (az + (uz + vz) / 3);
    nrm[p * 3] = verts[a * stride + 3]; nrm[p * 3 + 1] = verts[a * stride + 4]; nrm[p * 3 + 2] = verts[a * stride + 5];
    zLo = Math.min(zLo, az); zHi = Math.max(zHi, az);
  }
  for (let p = 0; p < n; p++) if (area[p] > 0) for (let k = 0; k < 3; k++) mid[p * 3 + k] /= area[p];
  const reach = AO_REACH * Math.max(1e-6, zHi - zLo), r2 = reach * reach;
  // a grid of cells `reach` on a side, each polygon in the cell of its middle
  const cellOf = (x: number): number => Math.floor(x / reach) + 512;
  const keyOf = (x: number, y: number, z: number): number => (x * 1024 + y) * 1024 + z;
  const grid = new Map<number, number[]>();
  for (let p = 0; p < n; p++) {
    if (!(area[p] > 0)) continue;
    const key = keyOf(cellOf(mid[p * 3]), cellOf(mid[p * 3 + 1]), cellOf(mid[p * 3 + 2]));
    const g = grid.get(key);
    if (g) g.push(p); else grid.set(key, [p]);
  }
  const shade = new Float32Array(n).fill(1);
  for (let p = 0; p < n; p++) {
    if (!(area[p] > 0)) continue;
    const px = mid[p * 3], py = mid[p * 3 + 1], pz = mid[p * 3 + 2], nx = nrm[p * 3], ny = nrm[p * 3 + 1], nz = nrm[p * 3 + 2];
    const cx = cellOf(px), cy = cellOf(py), cz = cellOf(pz);
    let occ = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const g = grid.get(keyOf(cx + i, cy + j, cz + k));
      if (!g) continue;
      for (const q of g) {
        if (q === p) continue;
        const dx = mid[q * 3] - px, dy = mid[q * 3 + 1] - py, dz = mid[q * 3 + 2] - pz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2), front = (dx * nx + dy * ny + dz * nz) / d;
        if (front <= 0) continue;
        const facing = Math.abs(dx * nrm[q * 3] + dy * nrm[q * 3 + 1] + dz * nrm[q * 3 + 2]) / d;
        // the disc's solid angle over the hemisphere, as far round as it faces here, as high over the horizon as it stands
        occ += (1 - 1 / Math.sqrt(area[q] / (Math.PI * d2) + 1)) * facing * Math.min(1, 4 * front) * (1 - d / reach);
      }
    }
    shade[p] = 1 - AO_MOST * occ * occ / (occ * occ + AO_HALF * AO_HALF);
  }
  for (let i = 0; i < upTo; i++) out[i] = shade[poly[i]];
  return out;
}
