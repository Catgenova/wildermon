// The planar head and the mitt hands drawn in place of MakeHuman's (docs/aesthetic 11, 12, 13): hard facets, each with
// vertices of its own so the cel shading gives it one flat value, built per body in MakeHuman's space (y up, z forward,
// x the body's left) from landmarks measured on that body, with the same topology for both bodies.
//
// A facet is a flat polygon pushed as a fan of triangles. Regions: 1 skin of the face, 2 skin of a hand, 6 an eye
// (the dark rectangle), 8 a brow, 13 the dark groove between two fingers. Bones are [name, weight] lists per vertex.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** A mesh of facets: fresh vertices per facet, so every facet shades flat. */
export function facets() {
  const out = { pos: [], tris: [], region: [], bones: [], stamp: [] };
  const centroid = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
  /** A flat polygon of `pts` (any order round it) facing away from `inside`, in `region`, on `bones`. */
  out.facet = (pts, region, bones, inside) => {
    // Newell's normal; the winding is turned so it points away from the inside.
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
    const c = centroid(pts);
    const order = dot(n, sub(c, inside)) < 0 ? [...pts].reverse() : pts;
    const base = out.pos.length;
    for (const p of order) { out.pos.push([p[0], p[1], p[2]]); out.region.push(region); out.bones.push(bones); out.stamp.push(-1); }
    for (let i = 1; i + 1 < order.length; i++) out.tris.push([base, base + i, base + i + 1]);
  };
  /** A loft between two rings of the same length, as quads, facing away from the rings' middle; weights per ring. */
  out.loft = (ringA, ringB, region, bonesA, bonesB = bonesA) => {
    const inside = centroid([...ringA, ...ringB]);
    const n = ringA.length;
    const wA = typeof bonesA === 'function' ? bonesA : () => bonesA, wB = typeof bonesB === 'function' ? bonesB : () => bonesB;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // A quad's four corners carry their own weights (per ring, or per point by a function of its index).
      const quad = [ringA[i], ringA[j], ringB[j], ringB[i]], w = [wA(i), wA(j), wB(j), wB(i)];
      out.facetWeighted(quad, w, region, inside);
    }
  };
  out.facetWeighted = (pts, w, region, inside) => {
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); }
    const c = centroid(pts);
    const flip = dot(n, sub(c, inside)) < 0;
    const idx = pts.map((_, i) => i);
    const order = flip ? idx.reverse() : idx;
    const base = out.pos.length;
    for (const i of order) { out.pos.push([...pts[i]]); out.region.push(region); out.bones.push(w[i]); out.stamp.push(-1); }
    for (let i = 1; i + 1 < order.length; i++) out.tris.push([base, base + i, base + i + 1]);
  };
  /** A fan from a ring to a point. */
  out.cap = (ring, apex, region, bonesRing, bonesApex = bonesRing) => {
    const inside = centroid([...ring, apex]);
    const n = ring.length;
    const wR = typeof bonesRing === 'function' ? bonesRing : () => bonesRing, wX = typeof bonesApex === 'function' ? bonesApex : () => bonesApex;
    for (let i = 0; i < n; i++) out.facetWeighted([ring[i], ring[(i + 1) % n], apex], [wR(i), wR((i + 1) % n), wX(i)], region, inside);
  };
  /** Where a ray from `from` along `dir` first meets the facets pushed so far, with that facet's normal; null if none. */
  out.hit = (from, dir) => {
    let best = null;
    for (const t of out.tris) {
      const a = out.pos[t[0]], b = out.pos[t[1]], c = out.pos[t[2]];
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(dir, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-9) continue;
      const inv = 1 / det, s = sub(from, a), u = dot(s, p) * inv; if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = dot(dir, q) * inv; if (v < 0 || u + v > 1) continue;
      const d = dot(e2, q) * inv; if (d <= 0) continue;
      if (!best || d < best.d) best = { d, p: add(from, mul(dir, d)), n: unit(cross(e1, e2)) };
    }
    return best;
  };
  return out;
}

/* ---- the head ------------------------------------------------------------------------------------------------------- */

/**
 * The head's template: rings of seven points round the right half (front centre, front side, side front, side, side
 * back, back side, back centre), each [u, v, w]: u out from the middle in skull half-widths, v forward from the skull's
 * centre in half-depths, w up from the chin in head heights. Mirrored to the left. The man's; the woman's differences
 * are laid over (`WOMAN`).
 */
const RINGS = {
  // Under the jaw, where it meets the neck: the throat.
  L0: [[0, -0.1, 0.1], [0.38, -0.15, 0.1], [0.62, -0.3, 0.1], [0.7, -0.5, 0.12], [0.55, -0.68, 0.14], [0.3, -0.78, 0.17], [0, -0.82, 0.2]],
  // The jawline: chin, chin's corner, the jaw's side, its angle, then on round under the skull to the nape.
  L1: [[0, 0.9, 0.0], [0.5, 0.88, 0.0], [0.82, 0.66, 0.06], [0.95, 0.15, 0.2], [0.86, -0.4, 0.28], [0.48, -0.78, 0.3], [0, -0.9, 0.3]],
  // The lower face under the nose: the cheek hollowed between the chin's corner and the jaw's side.
  L2: [[0, 1.02, 0.3], [0.46, 0.98, 0.3], [0.84, 0.72, 0.3], [1.0, 0.12, 0.3], [0.9, -0.45, 0.3], [0.5, -0.85, 0.3], [0, -0.95, 0.3]],
  // The cheekbones: a hard plane at the side front, the widest of the face.
  L3: [[0, 1.0, 0.43], [0.4, 0.92, 0.42], [0.9, 0.68, 0.43], [1.04, 0.1, 0.43], [0.94, -0.5, 0.43], [0.52, -0.9, 0.43], [0, -1.0, 0.43]],
  // The eyes: the socket set back under the brow.
  L4: [[0, 1.0, 0.55], [0.42, 0.94, 0.545], [0.86, 0.68, 0.55], [1.04, 0.1, 0.55], [0.94, -0.52, 0.55], [0.52, -0.92, 0.55], [0, -1.02, 0.55]],
  // The brow: one shelf, the most forward of the head.
  L5: [[0, 1.08, 0.6], [0.45, 1.05, 0.61], [0.86, 0.82, 0.61], [1.04, 0.2, 0.6], [0.92, -0.5, 0.6], [0.5, -0.92, 0.6], [0, -1.02, 0.6]],
  // The forehead, flat, leaning back a little.
  L6: [[0, 0.98, 0.8], [0.5, 0.94, 0.8], [0.9, 0.64, 0.8], [1.06, 0.1, 0.8], [0.96, -0.5, 0.8], [0.54, -0.92, 0.8], [0, -1.0, 0.8]],
  // The dome, in two rings to the crown.
  L7: [[0, 0.76, 0.91], [0.5, 0.7, 0.91], [0.84, 0.46, 0.91], [1.0, 0.02, 0.91], [0.86, -0.42, 0.91], [0.5, -0.74, 0.91], [0, -0.84, 0.91]],
  L8: [[0, 0.42, 0.98], [0.3, 0.38, 0.98], [0.5, 0.22, 0.98], [0.58, 0, 0.98], [0.52, -0.24, 0.98], [0.3, -0.42, 0.98], [0, -0.48, 0.98]],
};
const APEX = [0, -0.05, 1.0];
/** The woman's: a narrower jaw as a softer wedge, cheekbones high, a lighter brow, a slimmer neck. */
const WOMAN = {
  L0: [[0, -0.1, 0.1], [0.32, -0.15, 0.1], [0.54, -0.3, 0.1], [0.6, -0.5, 0.12], [0.48, -0.68, 0.14], [0.27, -0.78, 0.17], [0, -0.82, 0.2]],
  L1: [[0, 0.9, 0.0], [0.36, 0.88, 0.01], [0.68, 0.68, 0.07], [0.84, 0.16, 0.22], [0.78, -0.42, 0.28], [0.44, -0.78, 0.3], [0, -0.9, 0.3]],
  L2: [[0, 1.02, 0.3], [0.4, 0.98, 0.3], [0.76, 0.72, 0.31], [0.96, 0.12, 0.3], [0.88, -0.45, 0.3], [0.5, -0.85, 0.3], [0, -0.95, 0.3]],
  L3: [[0, 1.0, 0.43], [0.4, 0.92, 0.42], [0.88, 0.7, 0.44], [1.02, 0.1, 0.43], [0.93, -0.5, 0.43], [0.52, -0.9, 0.43], [0, -1.0, 0.43]],
  L5: [[0, 1.04, 0.6], [0.45, 1.02, 0.61], [0.86, 0.8, 0.61], [1.03, 0.2, 0.6], [0.92, -0.5, 0.6], [0.5, -0.92, 0.6], [0, -1.02, 0.6]],
};
const ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];

/**
 * The head for one body. `L`: chin and crown heights, the skull's centre depth `zc`, half-width `W`, half-depth `D`,
 * the eye's x; `base`: the neck's base ring (twelve points in MakeHuman's space, built from the body's own surface),
 * `style` 'man' or 'woman'. Bones: `head` and `neck`.
 */
export const HEAD_WIDEN = 1.14;
export const HEAD_SHORTEN = 0.92;
export function planarHead(L, base, style, f) {
  const woman = style === 'woman';
  // The references' box: wider and shorter than MakeHuman's, the crown kept where the hair sits.
  const H = (L.crown - L.chin) * HEAD_SHORTEN, chin = L.crown - H, W = L.W * HEAD_WIDEN;
  const P = ([u, v, w]) => [u * W, chin + w * H, L.zc + v * L.D];
  const ring = (name) => {
    const half = (woman && WOMAN[name]) || RINGS[name];
    const left = half.slice(1, -1).reverse().map(([u, v, w]) => [-u, v, w]);
    return [...half, ...left].map(P);
  };
  const HEAD = [['head', 1]], NECK = [['neck', 1]], THROAT = [['head', 0.4], ['neck', 0.6]];
  const rings = ORDER.map(ring);
  f.loft(base, rings[0], 1, NECK, THROAT);
  f.loft(rings[0], rings[1], 1, THROAT, HEAD);
  for (let i = 1; i + 1 < rings.length; i++) f.loft(rings[i], rings[i + 1], 1, HEAD);
  f.cap(rings[rings.length - 1], P(APEX), 1, HEAD);
  // The nose: a wedge from the root between the brows to the tip, a flat underside back to the lip.
  const tv = woman ? 1.28 : 1.36, tw = woman ? 0.33 : 0.31;
  const nose = { rootL: P([0.07, 1.03, 0.57]), rootR: P([-0.07, 1.03, 0.57]), tipL: P([0.09, tv, tw]), tipR: P([-0.09, tv, tw]), alaL: P([0.24, 1.0, 0.3]), alaR: P([-0.24, 1.0, 0.3]), under: P([0, 1.02, 0.25]) };
  const noseIn = P([0, 0.9, 0.4]);
  f.facet([nose.rootL, nose.rootR, nose.tipR, nose.tipL], 1, HEAD, noseIn);
  f.facet([nose.rootL, nose.tipL, nose.alaL], 1, HEAD, noseIn);
  f.facet([nose.rootR, nose.alaR, nose.tipR], 1, HEAD, noseIn);
  f.facet([nose.tipL, nose.tipR, nose.alaR, nose.under, nose.alaL], 1, HEAD, noseIn);
  // The ears: a flap each side, two planes meeting at an edge out from the skull, rooted inside it.
  for (const s of [1, -1]) {
    const o = (u, v, w) => P([s * u, v, w]);
    const ft = o(0.98, 0.1, 0.6), fb = o(0.98, 0.06, 0.34), bt = o(0.98, -0.48, 0.58), bb = o(0.98, -0.46, 0.34);
    const ot = o(1.28, -0.24, 0.57), ob = o(1.28, -0.2, 0.38);
    const inside = o(0.9, -0.16, 0.47);
    f.facet([ft, ot, ob, fb], 1, HEAD, inside);
    f.facet([ot, bt, bb, ob], 1, HEAD, inside);
    f.facet([ft, bt, ot], 1, HEAD, inside);
    f.facet([fb, ob, bb], 1, HEAD, inside);
  }
  // The eyes: a dark rectangle each, laid on the socket's plane; and the brows, a bar on the shelf, the man's straight and
  // thick, the woman's thinner and arched. Both found by casting onto the head from in front.
  const onFace = (u, w, lift) => {
    const from = P([u, 2.0, w]), h = f.hit(from, [0, 0, -1]);
    const p = h ? h.p : P([u, 1.0, w]);
    const n = h ? h.n : [0, 0, 1];
    // Lifted off the facet, and a touch forward besides, so a quad whose corners sit on different facets clears them all.
    return add(add(p, mul(n, lift)), [0, 0, lift * 0.6]);
  };
  const quads = [];
  for (const s of [1, -1]) {
    quads.push([[onFace(s * 0.18, 0.54, 0.03), onFace(s * 0.52, 0.54, 0.03), onFace(s * 0.52, 0.49, 0.03), onFace(s * 0.18, 0.49, 0.03)], 6, P([s * 0.4, 0, 0.52])]);
    const bx = [0.14, 0.36, 0.58, 0.78];
    const by = woman ? [0.6, 0.612, 0.615, 0.605] : [0.603, 0.603, 0.6, 0.594];
    const bh = woman ? [0.007, 0.008, 0.008, 0.006] : [0.011, 0.012, 0.011, 0.009];
    for (let i = 0; i + 1 < bx.length; i++) {
      const q = [onFace(s * bx[i], by[i] + bh[i], 0.03), onFace(s * bx[i + 1], by[i + 1] + bh[i + 1], 0.03), onFace(s * bx[i + 1], by[i + 1] - bh[i + 1], 0.03), onFace(s * bx[i], by[i] - bh[i], 0.03)];
      quads.push([q, 8, P([s * 0.4, 0, 0.62])]);
    }
  }
  for (const [q, region, inside] of quads) f.facet(q, region, HEAD, inside);
  return f;
}

/**
 * The neck's base ring: twelve points round the body's own surface at height `y`, on the template's directions about
 * the neck's middle, a hair outside it, so the body's cut edge above is hidden inside the lofted neck.
 */
export function neckBase(L, pts, y, style) {
  const half = (style === 'woman' && WOMAN.L0) || RINGS.L0;
  const left = half.slice(1, -1).reverse().map(([u, v, w]) => [-u, v, w]);
  const dirs = [...half, ...left].map(([u, v]) => Math.atan2(v * L.D + 0.3 * L.D, u * L.W * HEAD_WIDEN));
  const cz = L.zc - 0.3 * L.D;
  const cap = L.W * 1.25;
  return dirs.map((a) => {
    let r = 0;
    for (const p of pts) {
      if (Math.abs(p[1] - y) > 0.08) continue;
      const dx = p[0], dz = p[2] - cz, rr = Math.hypot(dx, dz);
      if (rr > cap) continue;
      let da = Math.atan2(dz, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < Math.PI / 10) r = Math.max(r, rr);
    }
    r = (r || L.W * 0.6) + 0.035;
    return [Math.cos(a) * r, y, cz + Math.sin(a) * r];
  });
}

/* ---- the hands ------------------------------------------------------------------------------------------------------- */

/**
 * A mitt: one block for the palm and the four fingers, with a knuckle ridge and three V-grooves the length of the
 * finger block (geometry only, lit by their walls; from the second band up), and a thumb as a square wedge angled out
 * from the palm. Built in the body's own hand frame from its joints: `J.wrist`, the knuckles `J.k2`..`J.k5`, the middle
 * fingertip `J.tip3`, the thumb's joints `J.t0`, `J.t1`, `J.tip1`; `pts` the body's forearm surface for the cuff. `k` is
 * the side (0 the body's left). Bones: wrist, fing (the three outer fingers), index (the forefinger's strip of the
 * block, so it can stay straight to point) and thumb of that side, and the elbow for the cuff.
 */
export function mitt(J, pts, k, detail, f) {
  const a = unit(sub(J.k3, J.wrist));
  let s = sub(J.k2, J.k5); s = unit(sub(s, mul(a, dot(s, a))));
  let n = cross(a, s);
  if (dot(sub(J.t1, J.wrist), n) < 0) { n = mul(n, -1); }
  const fdir = unit(sub(J.tip3, J.k3));
  const pl = Math.hypot(...sub(J.k3, J.wrist)), fl = Math.hypot(...sub(J.tip3, J.k3));
  const span = Math.hypot(...sub(J.k2, J.k5)), pw = span * 0.5 + span / 3 * 0.5, sc = pw / 0.48;
  const t = 0.19 * sc;
  const at = (x, y, z) => add(add(add(J.wrist, mul(s, x)), mul(n, y)), mul(a, z));
  const WR = [[`wrist${k}`, 1]], FG = [[`fing${k}`, 1]], IX = [[`index${k}`, 1]], CUFF = [[`elbow${k}`, 0.6], [`wrist${k}`, 0.4]], TH = [[`thumb${k}`, 1]], THB = [[`wrist${k}`, 0.5], [`thumb${k}`, 0.5]];
  const KN = [[`wrist${k}`, 0.5], [`fing${k}`, 0.5]], KNI = [[`wrist${k}`, 0.5], [`index${k}`, 0.5]], KNH = [[`wrist${k}`, 0.5], [`fing${k}`, 0.25], [`index${k}`, 0.25]];
  const HALF = [[`fing${k}`, 0.5], [`index${k}`, 0.5]];
  // A ring across the hand: halfW across, halfT through, the broad faces cut by a V-groove `groove` deep at the three
  // valleys between the fingers (detail) or plain (band 0). Points go round from the thumb side over the palm; each
  // remembers its place across (`x`, in half-widths) so the forefinger's strip can take its own bone.
  const section = (halfW, halfT, groove, frame, back = 1) => {
    const out = [], xs = [];
    const pt = (x, y) => { out.push(frame(x * halfW, y)); xs.push(x); };
    if (detail) {
      const across = [1, 0.8, 0.56, 0.5, 0.44, 0.3, 0.06, 0, -0.06, -0.3, -0.44, -0.5, -0.56, -0.8, -1];
      const dip = (x) => (Math.abs(Math.abs(x) - 0.5) < 1e-6 || Math.abs(x) < 1e-6 ? groove : 0);
      for (const x of across) pt(x, Math.abs(x) === 1 ? halfT * 0.7 : halfT - dip(x));
      for (let i = across.length - 1; i >= 0; i--) { const x = across[i]; pt(x, Math.abs(x) === 1 ? -halfT * 0.7 * back : -(halfT * back - dip(x))); }
    } else {
      for (const [x, y] of [[1, 0.7], [0.5, 1], [-0.5, 1], [-1, 0.7], [-1, -0.7 * back], [-0.5, -back], [0.5, -back], [1, -0.7 * back]]) pt(x, y * halfT);
    }
    out.x = xs;
    return out;
  };
  const fingerBones = (ring, inner, outer) => (i) => (ring.x[i] > 0.5 + 1e-6 ? outer : ring.x[i] < 0.5 - 1e-6 ? inner : inner === KN ? KNH : HALF);
  // The cuff over the forearm, from the body's own surface; then the wrist, and the knuckles where the fingers hinge.
  const cuffZ = -0.3 * sc;
  const N = detail ? 30 : 8;
  const cuffRing = (() => {
    const c = at(0, 0, cuffZ);
    return Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2).map((ang) => {
      let r = 0;
      for (const p of pts) {
        const d = sub(p, c); const along = dot(d, a); if (Math.abs(along) > 0.08 * sc) continue;
        const x = dot(d, s), y = dot(d, n), rr = Math.hypot(x, y); if (rr > 0.6 * sc) continue;
        let da = Math.atan2(y, x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < Math.PI / 6) r = Math.max(r, rr);
      }
      r = (r || 0.28 * sc) + 0.025;
      return at(Math.cos(ang) * r, Math.sin(ang) * r, cuffZ);
    });
  })();
  const palmFrame = (z) => (x, y) => at(x, y, z);
  // The back of the hand rises from the wrist to the knuckle ridge; the palm side is flat.
  const wristRing = section(0.3 * sc, 0.17 * sc, 0, palmFrame(0.05 * sc), 0.85);
  const knuckles = at(0, 0, pl * 0.97);
  const knuckleRing = section(pw, t, 0, palmFrame(pl * 0.97), 1.15);
  f.loft(cuffRing, wristRing, 2, CUFF, WR);
  f.loft(wristRing, knuckleRing, 2, WR, fingerBones(knuckleRing, KN, KNI));
  // The fingers: one block from the knuckles along the middle finger's line, tapering, the little finger's side a little
  // shorter and the forefinger's a touch; the grooves deepen past the knuckles and run to the tips.
  let fn = cross(fdir, s); if (dot(fn, n) < 0) fn = mul(fn, -1);
  const fat = (x, y, z) => add(add(add(knuckles, mul(s, x)), mul(fn, y)), mul(fdir, z));
  const fingerFrame = (z) => (x, y) => fat(x, y, z + (x < -0.6 * pw ? -fl * 0.12 : x > 0.6 * pw ? -fl * 0.04 : 0));
  const g = 0.075 * sc;
  const r1 = section(pw, t, g, fingerFrame(fl * 0.3));
  const r2 = section(pw * 0.97, t * 0.92, g, fingerFrame(fl * 0.72));
  const r3 = section(pw * 0.92, t * 0.6, g * 0.7, fingerFrame(fl * 0.97));
  f.loft(knuckleRing, r1, 2, fingerBones(knuckleRing, KN, KNI), fingerBones(r1, FG, IX));
  f.loft(r1, r2, 2, fingerBones(r1, FG, IX), fingerBones(r2, FG, IX));
  f.loft(r2, r3, 2, fingerBones(r2, FG, IX), fingerBones(r3, FG, IX));
  // The tips: the block's end as two facets, the forefinger's own and the rest's, so the point bends between them.
  const tipOf = (x) => fat(x * pw * 0.9, 0, fl * 0.99 + (x < -0.6 ? -fl * 0.12 : x > 0.6 ? -fl * 0.04 : 0));
  f.cap(r3, tipOf(0.2), 2, fingerBones(r3, FG, IX), (i) => (r3.x[i] > 0.5 + 1e-6 ? IX : FG));
  // The thumb: a square wedge from inside the palm's thumb edge, angled out from the palm and toward the fingers,
  // its flats with the palm's, tapering to a point.
  const mh = unit(sub(J.tip1, J.t0));
  const splay = unit(add(add(mul(s, 0.3), mul(n, 0.25)), mul(a, 0.9)));
  const tdir = unit(add(mh, splay));
  let tu = unit(cross(tdir, n)); const tv = cross(tu, tdir);
  const base0 = at(pw * 0.78, 0.06 * sc, pl * 0.32);
  const tl = Math.hypot(...sub(J.tip1, J.t0)) * 0.95;
  const tring = (c, rx, ry) => { const M = detail ? 4 : 4; return Array.from({ length: M }, (_, i) => { const ang = ((i + 0.5) / M) * Math.PI * 2; return add(add(c, mul(tu, Math.cos(ang) * rx * Math.SQRT2)), mul(tv, Math.sin(ang) * ry * Math.SQRT2)); }); };
  const t0 = tring(base0, 0.24 * sc, 0.19 * sc), t1 = tring(add(base0, mul(tdir, tl * 0.45)), 0.19 * sc, 0.15 * sc), t2 = tring(add(base0, mul(tdir, tl * 0.88)), 0.13 * sc, 0.1 * sc);
  f.loft(t0, t1, 2, THB, TH);
  f.loft(t1, t2, 2, TH);
  f.cap(t2, add(base0, mul(tdir, tl)), 2, TH);
  return f;
}
