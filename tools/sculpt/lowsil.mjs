// What the low-poly fitters share (tools/sculpt/lowfit.mjs for the heads, tools/sculpt/lowtfit.mjs for the torsos):
// a mesh's silhouette under a camera at the reference masks' resolution, its outline, the distance to an outline, and
// the coordinate descent.
import { project } from './lowcam.mjs';

/** The silhouette of a list of triangles (each three points) under cam, in the box [x0, y0, x1, y1] at K sheet pixels
 * per mask pixel. */
export function rasterSilhouette(triangles, cam, box, K) {
  const [x0, y0, x1, y1] = box;
  const w = Math.floor((x1 - x0) / K), h = Math.floor((y1 - y0) / K);
  const m = new Uint8Array(w * h);
  for (const tri of triangles) {
    const p = tri.map((q) => { const s = project(q, cam); return [(s[0] - x0) / K - 0.5, (s[1] - y0) / K - 0.5]; });
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      let inside = true;
      for (let e = 0; e < 3 && inside; e++) {
        const a = p[e], b = p[(e + 1) % 3];
        const c = (b[0] - a[0]) * (j - a[1]) - (b[1] - a[1]) * (i - a[0]);
        if (c * area < -1e-9) inside = false;
      }
      if (inside) m[j * w + i] = 1;
    }
  }
  return { m, w, h };
}

/** The outline's pixels (inside, with a neighbour outside, not counting the box's edge). */
export function outline({ m, w, h }) {
  const o = [];
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    if (!m[j * w + i]) continue;
    if (!m[j * w + i - 1] || !m[j * w + i + 1] || !m[(j - 1) * w + i] || !m[(j + 1) * w + i]) o.push(j * w + i);
  }
  return o;
}

/** Distance to the nearest outline pixel, in pixels at the mask's resolution (a two-pass 3-4 chamfer). */
export function distanceTo(ol, w, h) {
  const d = new Float32Array(w * h).fill(1e6);
  for (const k of ol) d[k] = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - w] + 1); if (i > 0) v = Math.min(v, d[k - w - 1] + 1.414); if (i < w - 1) v = Math.min(v, d[k - w + 1] + 1.414); }
    d[k] = v;
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i; let v = d[k];
    if (i < w - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < h - 1) { v = Math.min(v, d[k + w] + 1); if (i < w - 1) v = Math.min(v, d[k + w + 1] + 1.414); if (i > 0) v = Math.min(v, d[k + w - 1] + 1.414); }
    d[k] = v;
  }
  return d;
}

/** Coordinate descent: each parameter up and down by its step while that lowers f; the steps halve when none do. */
export function descend(params, f, rounds = 6) {
  let best = f();
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const p of params) {
      for (const dir of [1, -1]) {
        for (;;) {
          const old = p.get(); p.set(old + dir * p.step);
          const e = f();
          if (e < best - 1e-6) { best = e; moved = true; } else { p.set(old); break; }
        }
      }
    }
    if (!moved) for (const p of params) p.step /= 2;
  }
  return best;
}
