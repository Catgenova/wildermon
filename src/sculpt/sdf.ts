/**
 * Sculpt: a character as a signed-distance model.
 *
 * A model is a list of primitives -- capsules, ellipsoids, rounded boxes,
 * torus segments, tubes along a spline, sheets lofted through rings -- each
 * tagged with a material, a bone and the zoom band it first appears at, and
 * blended together with a smooth union (or cut away with a smooth
 * subtraction) by its blend radius. Stamps paint material regions onto a
 * primitive's surface: a sigil, stripes, an eye. The model is baked into a
 * mesh (`./bake`), skinned on the rig (`./rig`) and drawn by the GPU
 * (`./gl`); nothing here draws.
 *
 * Units are the figure's: tenths of a metre, `x` to the body's right, `y`
 * forward, `z` up from the ground between the feet.
 */

export type V3 = [number, number, number];
export type V2 = [number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, x));
export const smooth = (t: number): number => { const u = clamp(t); return u * u * (3 - 2 * u); };

/** The zoom band a thing first appears at: far (zoomed out), game (the island's play zooms), close (portraits and the mirror). */
export type Band = 0 | 1 | 2;
export const BAND_FAR: Band = 0, BAND_GAME: Band = 1, BAND_CLOSE: Band = 2;

/** A material: its colour as `#rrggbb` and what the shader does with it. */
export interface Material {
  colour: string;
  /** Unlit, kept at night, and glowing a little past its edge. */
  emissive?: boolean;
  /** Skin: a shadow a touch cooler and a light barely tinted, so a face stays a face. */
  skin?: boolean;
  /** Metal: a sharper, brighter highlight. */
  metal?: boolean;
  /** The eye's parts: drawn in the lid's colour (the first material's, a shade darker) while the lids are shut. */
  eye?: boolean;
  /** The face's planes: four tones rather than three, a half-shadow from a quarter turned from the light to three quarters, the shadow only past that, so a plane turned a little from the light steps down rather than falling to the dark. */
  soft?: boolean;
  /** A small part standing off the body (an ear): the silhouette ink next to it is thin, so it reads as the part and not as its line. */
  thinInk?: boolean;
  /** No ink inside the silhouette: a mitt's grooves and tips are read by their shading alone. */
  noInk?: boolean;
  /** No ink along a crease between two of its facets (a part standing in front of another is still inked): the face's planes. */
  noCrease?: boolean;
  /** Cloth over a low-poly body (`./lowpoly`): lit by the body's light, in its own colour over the skin the light was fitted to. */
  cloth?: boolean;
}

/** Where a primitive hangs: one of the rig's bones (`./rig`), or a chain link of a sway chain. */
export type BoneName = string;

/** How one primitive joins the model. */
export interface Join {
  /** Smooth union by this radius (nought: a hard union). */
  blend?: number;
  /** Cut this shape out of what is before it rather than adding it. */
  cut?: boolean;
  /** Keep only what is inside this shape and what is before it. */
  keep?: boolean;
}

/**
 * A stamp: a region painted on a primitive's surface in another material.
 * Given a surface point and its outward normal it says the material and how
 * far inside the region the point is (`d` > 0 inside, < 0 outside); near its
 * edge it answers on both sides, so the edge is drawn straight between the
 * vertices rather than along the mesh's cells. Nothing, where it has no say.
 */
export interface StampHit { m: number; d: number }
export type Stamp = (p: V3, n: V3) => StampHit | undefined;
/** How far outside its edge a stamp still answers, in units. */
export const STAMP_MARGIN = 0.6;
const hit = (m: number, d: number): StampHit | undefined => (d > -STAMP_MARGIN ? { m, d } : undefined);

export interface Prim extends Join {
  /** Signed distance to the primitive at `p`. */
  d: (p: V3) => number;
  /** Its material, as an index into the model's materials. */
  m: number;
  bone: BoneName;
  /** A second bone and how much of the primitive follows it: for a part that bends between two joints. */
  bone2?: BoneName;
  /** From nought (all `bone`) to one (all `bone2`) along `axis` from `from` over `span`: a blend of the two. */
  split?: { from: V3; axis: V3; span: number };
  /** The band it first appears at, and the last it is in: a mitten that gives way to fingers close up. */
  band: Band;
  until?: Band;
  /** Its box, grown by its blend, for skipping the samples it cannot reach. */
  box: [V3, V3];
  stamps?: Array<{ at: Stamp; band: Band }>;
  /** A name, for the debug view. */
  name?: string;
}

export interface Model {
  prims: Prim[];
  materials: Material[];
  /** The box the whole model fits in. */
  box: [V3, V3];
}

/* ---- blending ------------------------------------------------------------------ */

/** The polynomial smooth minimum: the two shapes rounded into one over radius `k`. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return lerp(b, a, h) - k * h * (1 - h);
}
export const smax = (a: number, b: number, k: number): number => -smin(-a, -b, k);

/* ---- primitives ----------------------------------------------------------------- */

const grow = (lo: V3, hi: V3, r: number): [V3, V3] => [[lo[0] - r, lo[1] - r, lo[2] - r], [hi[0] + r, hi[1] + r, hi[2] + r]];
const boxOf = (pts: V3[], r: number): [V3, V3] => {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  return grow(lo, hi, r);
};

export interface Tag { m: number; bone: BoneName; bone2?: BoneName; split?: Prim['split']; band?: Band; until?: Band; blend?: number; cut?: boolean; keep?: boolean; name?: string }
const tagged = (d: (p: V3) => number, box: [V3, V3], t: Tag): Prim => ({
  d, box: grow(box[0], box[1], t.blend ?? 0), m: t.m, bone: t.bone, bone2: t.bone2, split: t.split, band: t.band ?? BAND_FAR, until: t.until, blend: t.blend, cut: t.cut, keep: t.keep, name: t.name,
});

/** A sphere. */
export const sphere = (c: V3, r: number, t: Tag): Prim => tagged((p) => len(sub(p, c)) - r, boxOf([c], r), t);

/** An ellipsoid with radii `r`, optionally turned: `axes` are its three unit axes. */
export function ellipsoid(c: V3, r: V3, t: Tag, axes?: [V3, V3, V3]): Prim {
  const d = (p: V3): number => {
    const q = sub(p, c);
    const l: V3 = axes ? [dot(q, axes[0]), dot(q, axes[1]), dot(q, axes[2])] : q;
    const k0 = Math.hypot(l[0] / r[0], l[1] / r[1], l[2] / r[2]);
    const k1 = Math.hypot(l[0] / (r[0] * r[0]), l[1] / (r[1] * r[1]), l[2] / (r[2] * r[2]));
    return (k0 * (k0 - 1)) / (k1 || 1e-6);
  };
  const R = Math.max(r[0], r[1], r[2]);
  return tagged(d, boxOf([c], R), t);
}

/** A capsule from `a` to `b`, radius `ra` at `a` tapering to `rb` at `b`. */
export function capsule(a: V3, b: V3, ra: number, rb = ra, t: Tag = { m: 0, bone: 'pelvis' }): Prim {
  const ab = sub(b, a), l2 = dot(ab, ab) || 1e-9;
  const d = (p: V3): number => {
    const ap = sub(p, a);
    const h = clamp(dot(ap, ab) / l2);
    return len(sub(ap, mul(ab, h))) - lerp(ra, rb, h);
  };
  return tagged(d, boxOf([a, b], Math.max(ra, rb)), t);
}

/** A rounded box centred at `c`, half-sizes `h`, corners rounded by `r`, turned by unit `axes`. */
export function roundBox(c: V3, h: V3, r: number, t: Tag, axes?: [V3, V3, V3]): Prim {
  const d = (p: V3): number => {
    const q0 = sub(p, c);
    const l: V3 = axes ? [dot(q0, axes[0]), dot(q0, axes[1]), dot(q0, axes[2])] : q0;
    const q: V3 = [Math.abs(l[0]) - h[0] + r, Math.abs(l[1]) - h[1] + r, Math.abs(l[2]) - h[2] + r];
    const o = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
    return o + Math.min(Math.max(q[0], q[1], q[2]), 0) - r;
  };
  const R = len(h);
  return tagged(d, boxOf([c], R), t);
}

/**
 * A torus segment: a ring of radius `R` in the plane square to unit `axis`
 * at `c`, tube radius `r`, over the angles `a0..a1` (radians, about the axis
 * from `u0`); a whole ring when the angles are left out.
 */
export function torus(c: V3, axis: V3, u0: V3, R: number, r: number, t: Tag, a0?: number, a1?: number): Prim {
  const n = unit(axis), u = unit(sub(u0, mul(n, dot(u0, n)))), v = cross(n, u);
  const d = (p: V3): number => {
    const q = sub(p, c);
    const x = dot(q, u), y = dot(q, v), z = dot(q, n);
    let ang = Math.atan2(y, x);
    if (a0 !== undefined && a1 !== undefined) {
      // Clamped to the arc: the nearest end cap when outside it.
      let a = ang;
      while (a < a0) a += Math.PI * 2;
      while (a > a1 + Math.PI * 2) a -= Math.PI * 2;
      if (a > a1) {
        const toEnd = Math.min(Math.abs(a - a1), Math.abs(a - Math.PI * 2 - a0));
        if (toEnd > 0) {
          const e = a - a1 < Math.PI * 2 + a0 - a ? a1 : a0;
          const ex = Math.cos(e) * R, ey = Math.sin(e) * R;
          return Math.hypot(x - ex, y - ey, z) - r;
        }
      }
      ang = a;
    }
    return Math.hypot(Math.hypot(x, y) - R, z) - r;
  };
  return tagged(d, boxOf([c], R + r), t);
}

/** `n + 1` points along a Catmull-Rom spline through `pts`, clamped at its ends. */
export function spline(pts: V3[], n: number): V3[] {
  const out: V3[] = [];
  const P = (i: number): V3 => pts[clamp(i, 0, pts.length - 1)];
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(t)), f = t - i;
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const f2 = f * f, f3 = f2 * f;
    out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * f + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * f3)) as V3);
  }
  return out;
}

/** A tube along a spline through `pts`, its radius `r(t)` for `t` nought to one along it. */
export function tube(pts: V3[], r: (t: number) => number, t: Tag, segs = 12): Prim {
  const line = spline(pts, segs);
  const d = (p: V3): number => {
    let best = Infinity;
    for (let k = 0; k < line.length - 1; k++) {
      const a = line[k], b = line[k + 1], ab = sub(b, a), l2 = dot(ab, ab) || 1e-9;
      const ap = sub(p, a), h = clamp(dot(ap, ab) / l2);
      const dd = len(sub(ap, mul(ab, h))) - r((k + h) / (line.length - 1));
      if (dd < best) best = dd;
    }
    return best;
  };
  let rm = 0;
  for (let k = 0; k <= 8; k++) rm = Math.max(rm, r(k / 8));
  return tagged(d, boxOf(line, rm), t);
}

/**
 * A ring of a lofted sheet: at height `z`, an ellipse `rx` across and `ry`
 * deep round `(cx, cy)`; `drop(theta)` lowers the ring's edge by angle round
 * it, for a hem that hangs lower at the corners.
 */
export interface Ring { z: number; rx: number; ry: number; cx?: number; cy?: number }

/**
 * A sheet lofted through rings, `thick` thick, open at the bottom: a poncho,
 * a skirt, a hood. Between two rings the ellipse is interpolated; above the
 * top ring it closes over as a dome if `closed`, else ends with a rounded
 * rim. `hem(theta)` gives the height the sheet ends at round its bottom edge,
 * and `face` when set opens a hole: points where `face(p) < 0` are cut.
 */
export function sheet(rings: Ring[], thick: number, t: Tag, o: { closed?: boolean; hem?: (theta: number) => number; face?: (p: V3) => number; flare?: (theta: number, u: number) => number } = {}): Prim {
  const rs = rings.slice().sort((a, b) => a.z - b.z);
  const zlo = rs[0].z, zhi = rs[rs.length - 1].z;
  const at = (z: number): { rx: number; ry: number; cx: number; cy: number } => {
    const zz = clamp(z, zlo, zhi);
    for (let k = 0; k < rs.length - 1; k++) {
      const a = rs[k], b = rs[k + 1];
      if (zz <= b.z) {
        const u = b.z === a.z ? 0 : (zz - a.z) / (b.z - a.z);
        return { rx: lerp(a.rx, b.rx, u), ry: lerp(a.ry, b.ry, u), cx: lerp(a.cx ?? 0, b.cx ?? 0, u), cy: lerp(a.cy ?? 0, b.cy ?? 0, u) };
      }
    }
    const l = rs[rs.length - 1];
    return { rx: l.rx, ry: l.ry, cx: l.cx ?? 0, cy: l.cy ?? 0 };
  };
  const d = (p: V3): number => {
    const r = at(p[2]);
    const x = p[0] - r.cx, y = p[1] - r.cy;
    const theta = Math.atan2(y, x);
    const u = (p[2] - zlo) / Math.max(1e-6, zhi - zlo);
    const fl = o.flare ? o.flare(theta, u) : 1;
    const rx = r.rx * fl, ry = r.ry * fl;
    // Distance from the ellipse's rim, scaled back to units by the smaller radius: good enough for a sheet.
    const k = Math.hypot(x / rx, y / ry);
    const lateral = (k - 1) * Math.min(rx, ry);
    let dd = Math.abs(lateral) - thick;
    // Above the top: closed over as a dome, or ended at a rounded rim.
    if (p[2] > zhi) {
      if (o.closed) {
        const top = at(zhi);
        const kk = Math.hypot(x / (top.rx * fl), y / (top.ry * fl), (p[2] - zhi) / Math.min(top.rx, top.ry));
        dd = Math.abs((kk - 1) * Math.min(top.rx, top.ry)) - thick;
      } else dd = Math.max(dd, p[2] - zhi);
    }
    // The hem: cut at the height the edge hangs to, with a rounded lip.
    const hemZ = o.hem ? o.hem(theta) : zlo;
    dd = Math.max(dd, hemZ - p[2]);
    if (o.face) dd = Math.max(dd, -o.face(p));
    return dd;
  };
  let R = 0, zmin = zlo;
  for (const r of rs) R = Math.max(R, Math.hypot(r.rx + Math.abs(r.cx ?? 0), r.ry + Math.abs(r.cy ?? 0)));
  if (o.hem) for (let k = 0; k < 32; k++) zmin = Math.min(zmin, o.hem((k / 32) * Math.PI * 2));
  const fl = o.flare ? 1.5 : 1;
  return tagged(d, [[-R * fl - thick, -R * fl - thick, zmin - thick], [R * fl + thick, R * fl + thick, zhi + (o.closed ? R : 0) + thick]], t);
}

/** The primitive with whatever `cut(p) > 0` taken off: a curved lid, a hairline that is not a plane. `cut` should be about a distance. */
export const clipBy = (pr: Prim, cut: (p: V3) => number): Prim => {
  const d0 = pr.d;
  return { ...pr, d: (p) => Math.max(d0(p), cut(p)) };
};

/**
 * A wedge: a tube along a spline with a flattened, elliptical section --
 * `w(t)` wide across and `h(t)` thick along `up` -- for a lock of hair that
 * is a ribbon rather than a string, a strap, a leaf.
 */
export function wedge(pts: V3[], w: (t: number) => number, h: (t: number) => number, up: V3, t: Tag, segs = 10): Prim {
  const line = spline(pts, segs);
  const U = unit(up);
  const d = (p: V3): number => {
    let best = Infinity;
    for (let k = 0; k < line.length - 1; k++) {
      const a = line[k], b = line[k + 1], ab = sub(b, a), l2 = dot(ab, ab) || 1e-9;
      const ap = sub(p, a), s = clamp(dot(ap, ab) / l2);
      const v = sub(ap, mul(ab, s));
      const dir = unit(ab);
      // Across the wedge, square to its run and to `up`; and along `up`.
      let across = cross(U, dir);
      if (len(across) < 1e-4) across = cross([1, 0, 0], dir);
      across = unit(across);
      const n = unit(cross(dir, across));
      const va = dot(v, across), vn = dot(v, n), vd = dot(v, dir);
      const tt = (k + s) / (line.length - 1);
      const ww = w(tt), hh = h(tt);
      const kk = Math.hypot(va / ww, vn / hh);
      let dd = (kk - 1) * Math.min(ww, hh);
      // Rounded ends: past either end of the run, the distance along it counts too.
      if (Math.abs(vd) > 1e-6) dd = Math.hypot(Math.max(dd, 0), vd) + Math.min(dd, 0);
      if (dd < best) best = dd;
    }
    return best;
  };
  let rm = 0;
  for (let k = 0; k <= 8; k++) rm = Math.max(rm, w(k / 8), h(k / 8));
  return tagged(d, boxOf(line, rm), t);
}

/** The primitive with the side of each plane its normal points to taken off: the plane through `at` facing `n`. */
export function clip(pr: Prim, ...planes: Array<[V3, V3]>): Prim {
  const ps = planes.map(([at, n]) => [at, unit(n)] as [V3, V3]);
  const d0 = pr.d;
  return { ...pr, d: (p) => { let d = d0(p); for (const [at, n] of ps) d = Math.max(d, dot(sub(p, at), n)); return d; } };
}

/** The primitive with its stamps. */
export const stamped = (pr: Prim, ...stamps: Array<{ at: Stamp; band?: Band }>): Prim => ({ ...pr, stamps: [...(pr.stamps ?? []), ...stamps.map((s) => ({ at: s.at, band: s.band ?? BAND_FAR }))] });

/** A half-space: everything on the far side of the plane through `at` facing `n` is inside. Used with `keep` or `cut`. */
export const halfSpace = (at: V3, n: V3, t: Tag): Prim => {
  const u = unit(n);
  return tagged((p) => dot(sub(p, at), u), [[-1e3, -1e3, -1e3], [1e3, 1e3, 1e3]], t);
};

/* ---- stamps ------------------------------------------------------------------------ */

/** A disc of material `m` on the surface round `c`, radius `r`, facing roughly `n` (a point on the far side of the body is left alone). */
export const disc = (c: V3, r: number, m: number, n?: V3): Stamp => (p, pn) =>
  (!n || dot(pn, n) > 0 ? hit(m, r - len(sub(p, c))) : undefined);

/** A ring of material `m`: between radii `r0` and `r1` round `c`. */
export const ring = (c: V3, r0: number, r1: number, m: number, n?: V3): Stamp => (p, pn) => {
  const l = len(sub(p, c));
  return !n || dot(pn, n) > 0 ? hit(m, Math.min(l - r0, r1 - l)) : undefined;
};

/** A band of material `m` between heights `z0` and `z1`, the boundary wavy by `wave(theta)` round the body's axis at `(cx, cy)`. */
export const band = (z0: number, z1: number, m: number, o: { cx?: number; cy?: number; wave?: (theta: number) => number; only?: (p: V3, n: V3) => boolean } = {}): Stamp => (p, n) => {
  const th = Math.atan2(p[1] - (o.cy ?? 0), p[0] - (o.cx ?? 0));
  const w = o.wave ? o.wave(th) : 0;
  return !o.only || o.only(p, n) ? hit(m, Math.min(p[2] - z0 - w, z1 + w - p[2])) : undefined;
};

/** Stripes of material `m` along `axis`, `period` apart, each `width` wide, from `phase`. */
export const stripes = (axis: V3, period: number, width: number, m: number, phase = 0, only?: (p: V3, n: V3) => boolean): Stamp => {
  const a = unit(axis);
  return (p, n) => {
    const t = ((dot(p, a) + phase) % period + period) % period;
    return !only || only(p, n) ? hit(m, Math.min(t, width - t)) : undefined;
  };
};

/** A line of material `m` along the polyline `pts` on the surface, `width` wide; a brow, a smile, a seam. */
export const curveStamp = (pts: V3[], width: number, m: number, n?: V3): Stamp => (p, pn) => {
  if (n && dot(pn, n) <= 0) return undefined;
  let best = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], ab = sub(b, a), l2 = dot(ab, ab) || 1e-9;
    const ap = sub(p, a), h = clamp(dot(ap, ab) / l2);
    best = Math.min(best, len(sub(ap, mul(ab, h))));
  }
  return hit(m, width - best);
};

/** The first stamp that paints, of several. */
export const firstOf = (...ss: Stamp[]): Stamp => (p, n) => { for (const s of ss) { const h = s(p, n); if (h && h.d > 0) return h; } for (const s of ss) { const h = s(p, n); if (h) return h; } return undefined; };

/**
 * A sun sigil: a disc, a gap, a ring, and `rays` short rays out of it, on
 * the surface round `c` facing `n`, with `u` and `v` the sigil's across and
 * up on that surface.
 */
export function sun(c: V3, u: V3, v: V3, r: number, m: number, rays = 8, n?: V3): Stamp {
  const U = unit(u), V = unit(v);
  return (p, pn) => {
    if (n && dot(pn, n) <= 0) return undefined;
    const q = sub(p, c), x = dot(q, U), y = dot(q, V);
    const l = Math.hypot(x, y);
    let d = r * 0.36 - l;
    d = Math.max(d, Math.min(l - r * 0.5, r * 0.64 - l));
    const a = Math.atan2(y, x), per = (Math.PI * 2) / rays;
    const f = ((a % per) + per) % per;
    // A ray: inside its angle and its radii; the angle's distance taken at the radius.
    d = Math.max(d, Math.min(Math.min(l - r * 0.74, r - l), (per * 0.14 - Math.min(f, per - f)) * l));
    return hit(m, d);
  };
}

/** Patchwork: cells of a grid along `u` and `v`, each in one of `ms` by a hash, leaving the base where the hash picks `-1`. */
export function patchwork(u: V3, v: V3, size: number, ms: number[], keep = 0.4, only?: (p: V3, n: V3) => boolean): Stamp {
  const U = unit(u), V = unit(v);
  return (p, n) => {
    if (only && !only(p, n)) return undefined;
    const su = dot(p, U) / size, sv = dot(p, V) / size;
    const i = Math.floor(su), j = Math.floor(sv);
    const h = Math.abs(Math.sin(i * 127.1 + j * 311.7) * 43758.5453) % 1;
    if (h < keep) return undefined;
    // Inside its cell by how far from the cell's nearest edge.
    const d = Math.min(su - i, i + 1 - su, sv - j, j + 1 - sv) * size;
    return hit(ms[Math.floor(((h - keep) / (1 - keep)) * ms.length) % ms.length], d);
  };
}

/* ---- the model ---------------------------------------------------------------------- */

/** What the model is at a point: its distance, and the primitive nearest the surface there. */
export interface Hit { d: number; prim: Prim | null }

export function modelOf(prims: Prim[], materials: Material[]): Model {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) {
    if (p.cut || p.keep) continue;
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.box[0][i]); hi[i] = Math.max(hi[i], p.box[1][i]); }
  }
  return { prims, materials, box: [lo, hi] };
}

/** The model's distance at `p`, over the primitives of bands up to `band`, from a list already culled to those whose box holds `p`. */
export function distanceAt(prims: Prim[], p: V3, band: Band, out?: Hit): number {
  let d = 1e3, near: Prim | null = null, nd = Infinity;
  for (const pr of prims) {
    if (pr.band > band || (pr.until !== undefined && band > pr.until)) continue;
    const b = pr.box;
    if (p[0] < b[0][0] || p[0] > b[1][0] || p[1] < b[0][1] || p[1] > b[1][1] || p[2] < b[0][2] || p[2] > b[1][2]) {
      // Out of its box: a cut or keep is still in force (a cut far away cuts nothing; a keep far away keeps nothing).
      if (pr.keep) d = Math.max(d, 1e3);
      continue;
    }
    const pd = pr.d(p);
    if (pr.cut) d = smax(d, -pd, pr.blend ?? 0);
    else if (pr.keep) d = Math.max(d, pd);
    else {
      d = smin(d, pd, pr.blend ?? 0);
      if (pd < nd) { nd = pd; near = pr; }
    }
  }
  if (out) { out.d = d; out.prim = near; }
  return d;
}
