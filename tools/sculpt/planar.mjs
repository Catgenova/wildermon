// The planar head and the mitt hands drawn in place of MakeHuman's, traced from docs/aesthetic/13 (the man's and the
// woman's heads, front; the open hand from the back) with depths from 11 and 12: an explicit vertex list and face list
// per body, in head units (x the viewer's right, y up from the chin's centre, z forward; the head one tall), mirrored
// left for right. Every facet has vertices of its own, so the cel shading gives it one flat value.
//
// Regions: 1 skin of the face, 2 skin of a hand, 6 an eye (the dark rectangle), 8 a brow. Bones are [name, weight]
// lists per vertex.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** A mesh of facets: fresh vertices per facet, so every facet shades flat. */
export function facets() {
  const out = { pos: [], tris: [], region: [], bones: [], stamp: [] };
  const centroid = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
  const newell = (pts) => { let n = [0, 0, 0]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); } return n; };
  /**
   * A flat polygon of `pts` (any order round it) in `region`, with weights `w` (one list for all, or one per point),
   * its normal turned to point away from `inside` (a point) or along `inside` (a direction, when `isDir`).
   */
  out.facet = (pts, region, w, inside, isDir = false) => {
    const n = newell(pts), c = centroid(pts);
    const flip = dot(n, isDir ? inside : sub(c, inside)) < 0;
    const idx = pts.map((_, i) => i);
    const order = flip ? idx.reverse() : idx;
    const base = out.pos.length;
    for (const i of order) { out.pos.push([...pts[i]]); out.region.push(region); out.bones.push(Array.isArray(w[0]) && Array.isArray(w[0][0]) ? w[i] : w); out.stamp.push(-1); }
    for (let i = 1; i + 1 < order.length; i++) out.tris.push([base, base + i, base + i + 1]);
  };
  /** A loft between two rings of the same length, as quads, each facing away from the rings' middle; weights per ring or per point. */
  out.loft = (ringA, ringB, region, bonesA, bonesB = bonesA) => {
    const inside = centroid([...ringA, ...ringB]);
    const n = ringA.length;
    const wA = typeof bonesA === 'function' ? bonesA : () => bonesA, wB = typeof bonesB === 'function' ? bonesB : () => bonesB;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      out.facet([ringA[i], ringA[j], ringB[j], ringB[i]], region, [wA(i), wA(j), wB(j), wB(i)], inside);
    }
  };
  /** A fan from a ring to a point. */
  out.cap = (ring, apex, region, bonesRing, bonesApex = bonesRing) => {
    const inside = centroid([...ring, apex]);
    const n = ring.length;
    const wR = typeof bonesRing === 'function' ? bonesRing : () => bonesRing, wX = typeof bonesApex === 'function' ? bonesApex : () => bonesApex;
    for (let i = 0; i < n; i++) out.facet([ring[i], ring[(i + 1) % n], apex], region, [wR(i), wR((i + 1) % n), wX(i)], inside);
  };
  return out;
}

/* ---- the head: traced ----------------------------------------------------------------------------------------------- */

/**
 * The head's vertices, right half (u >= 0; the left is the mirror): name -> [man [u, v, z], woman [u, v, z]], u, v read
 * off ref 13's front views (the man's head 520 px tall, chin at y 628, centre x 283; the woman's 495 px, chin y 635,
 * centre x 773), z off ref 11's three-quarter view and the depths a planar skull has.
 */
const HV = {
  // The dome and the back of the skull.
  A0: [[0, 1.0, -0.06], [0, 1.0, -0.05]],
  T0: [[0, 0.975, 0.12], [0, 0.975, 0.1]], T1: [[0.09, 0.975, 0.1], [0.1, 0.975, 0.08]], T2: [[0.22, 0.93, 0.06], [0.21, 0.94, 0.05]],
  T3: [[0.2, 0.93, -0.24], [0.19, 0.94, -0.22]], T4: [[0, 0.95, -0.33], [0, 0.955, -0.3]],
  H0: [[0, 0.88, 0.24], [0, 0.88, 0.22]], H1: [[0.2, 0.86, 0.19], [0.19, 0.87, 0.17]], H2: [[0.3, 0.81, 0.0], [0.28, 0.83, 0.0]],
  SK1: [[0.34, 0.72, -0.02], [0.33, 0.73, -0.02]], SK0: [[0.34, 0.55, 0.05], [0.335, 0.56, 0.05]],
  SK2: [[0.33, 0.6, -0.24], [0.33, 0.6, -0.22]], SK3: [[0.3, 0.78, -0.28], [0.29, 0.8, -0.26]],
  R1: [[0.2, 0.6, -0.43], [0.2, 0.6, -0.4]], R2: [[0, 0.6, -0.48], [0, 0.6, -0.45]], R3: [[0.18, 0.8, -0.39], [0.17, 0.82, -0.36]], R4: [[0, 0.82, -0.43], [0, 0.84, -0.4]],
  Q0: [[0.3, 0.26, -0.24], [0.28, 0.28, -0.22]], Q1: [[0.18, 0.28, -0.41], [0.17, 0.3, -0.38]], Q2: [[0, 0.3, -0.45], [0, 0.32, -0.42]],
  // The brow shelf: its top, and its front's lower edge.
  B0: [[0, 0.64, 0.34], [0, 0.62, 0.32]], B1: [[0.2, 0.64, 0.32], [0.2, 0.62, 0.3]], B2: [[0.33, 0.63, 0.12], [0.325, 0.61, 0.11]],
  S0: [[0, 0.585, 0.36], [0, 0.565, 0.34]], S1: [[0.2, 0.58, 0.345], [0.2, 0.56, 0.325]], S2: [[0.33, 0.575, 0.14], [0.325, 0.555, 0.13]],
  // The socket plane under the shelf.
  E0: [[0.05, 0.565, 0.31], [0.05, 0.545, 0.29]], E1: [[0.29, 0.56, 0.21], [0.29, 0.54, 0.19]], E2: [[0.29, 0.44, 0.23], [0.285, 0.4, 0.21]], E3: [[0.08, 0.45, 0.33], [0.08, 0.41, 0.31]],
  // The nose: a long wedge from the glabella to the tip, a third of the face: a ridge plane catching the light, a side
  // plane each way turned well round, a flat underside.
  N0: [[0.03, 0.578, 0.365], [0.025, 0.558, 0.345]], N1: [[0.08, 0.5, 0.33], [0.07, 0.47, 0.31]], N2: [[0.045, 0.31, 0.5], [0.04, 0.28, 0.45]],
  N3: [[0.115, 0.33, 0.35], [0.1, 0.3, 0.32]], N4: [[0, 0.262, 0.4], [0, 0.242, 0.37]], N5: [[0.09, 0.262, 0.34], [0.08, 0.242, 0.31]],
  // The cheekbone, the hollow cheek, the jaw and the chin.
  C0: [[0.31, 0.3, 0.08], [0.29, 0.31, 0.08]], C1: [[0.18, 0.41, 0.31], [0.17, 0.38, 0.29]], C2: [[0.12, 0.26, 0.33], [0.1, 0.24, 0.3]], C3: [[0.26, 0.19, 0.17], [0.21, 0.17, 0.16]],
  J0: [[0.27, 0.16, -0.07], [0.235, 0.18, -0.05]], J1: [[0.095, 0.03, 0.27], [0.07, 0.02, 0.24]], J2: [[0.09, 0.17, 0.31], [0.07, 0.15, 0.28]],
  CH0: [[0, 0.0, 0.26], [0, 0.0, 0.23]], CH1: [[0, 0.17, 0.33], [0, 0.15, 0.3]],
  // The throat ring under the jaw: front centre, the cord, side front, side, side back, back side, back centre.
  K0: [[0, -0.03, 0.08], [0, -0.02, 0.06]], K1: [[0.17, -0.03, 0.03], [0.12, -0.02, 0.02]], K2: [[0.24, -0.02, -0.1], [0.16, -0.01, -0.08]], K3: [[0.25, 0.0, -0.2], [0.165, 0.0, -0.17]],
  K4: [[0.2, 0.02, -0.3], [0.13, 0.02, -0.26]], K5: [[0.11, 0.03, -0.35], [0.07, 0.03, -0.3]], K6: [[0, 0.04, -0.37], [0, 0.04, -0.32]],
  // The ear: a wedge off the skull's side, its outer face flat.
  EA0: [[0.335, 0.54, -0.02], [0.33, 0.49, -0.02]], EA1: [[0.33, 0.53, -0.16], [0.325, 0.48, -0.15]], EA2: [[0.33, 0.3, -0.16], [0.325, 0.29, -0.15]], EA3: [[0.335, 0.3, -0.02], [0.33, 0.29, -0.02]],
  EF0: [[0.4, 0.52, -0.03], [0.4, 0.47, -0.03]], EB0: [[0.41, 0.5, -0.11], [0.41, 0.45, -0.1]], EF1: [[0.385, 0.34, -0.03], [0.385, 0.32, -0.03]], EB1: [[0.39, 0.33, -0.11], [0.39, 0.31, -0.1]],
};
/** The facets, right half, as names round each; `d` a direction hint for the normal where the head's middle misleads. */
const HF = [
  // The dome.
  { f: ['A0', 'T0', 'T1'] }, { f: ['A0', 'T1', 'T2'] }, { f: ['A0', 'T2', 'T3'] }, { f: ['A0', 'T3', 'T4'] },
  { f: ['H0', 'H1', 'T2', 'T1', 'T0'] }, { f: ['H1', 'H2', 'T2'] }, { f: ['H2', 'SK3', 'T3', 'T2'] },
  { f: ['T3', 'R3', 'R4', 'T4'] }, { f: ['T3', 'SK3', 'R3'] },
  // The back and the sides.
  { f: ['R3', 'R1', 'R2', 'R4'] }, { f: ['SK3', 'SK2', 'R1', 'R3'] }, { f: ['SK2', 'Q0', 'Q1', 'R1'] }, { f: ['R1', 'Q1', 'Q2', 'R2'] },
  { f: ['H2', 'SK1', 'SK3'] }, { f: ['SK1', 'SK2', 'SK3'] }, { f: ['SK1', 'SK0', 'C0', 'J0', 'Q0', 'SK2'] },
  { f: ['H2', 'B2', 'S2', 'SK0', 'SK1'] },
  // The forehead and the brow shelf.
  { f: ['H0', 'H1', 'B1', 'B0'] }, { f: ['H1', 'H2', 'B2', 'B1'] },
  { f: ['B0', 'B1', 'S1', 'S0'] }, { f: ['B1', 'B2', 'S2', 'S1'] },
  { f: ['S0', 'S1', 'E1', 'E0'], d: [0, -1, 0.3] }, { f: ['S1', 'S2', 'E1'], d: [0, -1, 0.3] },
  // The socket, the side of the face, the nose, the cheek.
  { f: ['E0', 'E1', 'E2', 'E3'] }, { f: ['S2', 'E1', 'E2', 'C0', 'SK0'] },
  { f: ['N0', "N0'", "N2'", 'N2'] }, { f: ['S0', 'N0', "N0'"] }, { f: ['N0', 'N2', 'N3', 'N1'] }, { f: ['S0', 'N0', 'E0'] }, { f: ['E0', 'N1', 'E3'] }, { f: ['N0', 'N1', 'E0'] }, { f: ['N1', 'N3', 'E3'] },
  { f: ['N2', "N2'", 'N4'], d: [0, -1, 0.2] }, { f: ['N2', 'N4', 'N5', 'N3'], d: [0, -1, 0.2] }, { f: ['N3', 'N5', 'C2'] },
  { f: ['E3', 'C1', 'C2', 'N3'] }, { f: ['E3', 'E2', 'C1'] }, { f: ['E2', 'C0', 'C1'] }, { f: ['C1', 'C0', 'C3', 'C2'] },
  // The mouthless lower face, the chin, the jaw.
  { f: ['N4', 'N5', 'C2', 'J2', 'CH1'] }, { f: ['CH1', 'J2', 'J1', 'CH0'] }, { f: ['J2', 'C2', 'C3', 'J1'] }, { f: ['C3', 'C0', 'J0'] }, { f: ['C3', 'J0', 'J1'] },
  // Under the jaw and the skull, to the throat.
  { f: ['CH0', 'J1', 'K1', 'K0'], d: [0, -1, 0] }, { f: ['J1', 'J0', 'K2', 'K1'], d: [0, -1, 0] }, { f: ['J0', 'Q0', 'K3', 'K2'], d: [0, -1, 0] },
  { f: ['Q0', 'Q1', 'K4', 'K3'], d: [0, -1, 0] }, { f: ['Q1', 'Q2', 'K6', 'K5', 'K4'], d: [0, -1, 0] },
  // The ear.
  { f: ['EF0', 'EB0', 'EB1', 'EF1'], d: [1, 0, 0] }, { f: ['EA0', 'EF0', 'EF1', 'EA3'], d: [0, 0, 1] }, { f: ['EA1', 'EA2', 'EB1', 'EB0'], d: [0, 0, -1] },
  { f: ['EA0', 'EA1', 'EB0', 'EF0'], d: [0, 1, 0] }, { f: ['EA3', 'EF1', 'EB1', 'EA2'], d: [0, -1, 0] }, { f: ['EA0', 'EA1', 'EA2', 'EA3'], d: [-1, 0, 0] },
];
/** The throat ring's order, round from the front centre over the body's left (u > 0) to the back and round. */
const THROAT = ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', "K5'", "K4'", "K3'", "K2'", "K1'"];
/** The eyes and the brows: [u0, u1, v0, v1] of the rectangle, man and woman; the brow's ends and middle heights. */
const EYE = { man: [0.13, 0.178, 0.49, 0.532], woman: [0.135, 0.191, 0.433, 0.486] };
const BROW = { man: { u: [0.075, 0.18, 0.285], top: [0.612, 0.614, 0.604], h: 0.022 }, woman: { u: [0.085, 0.19, 0.3], top: [0.578, 0.591, 0.573], h: 0.015 } };

/**
 * The head for one body in MakeHuman's space. `L`: chin and crown heights, the skull's centre depth `zc`; `base`: the
 * neck's base ring (twelve points round the body's own surface, in `THROAT`'s order); `style` 'man' or 'woman'.
 * Returns the chin's and the crown's points, for the sheets that hold the head against the picture.
 */
export function tracedHead(L, base, style, f) {
  const woman = style === 'woman', col = woman ? 1 : 0;
  const H = L.crown - L.chin;
  const P = ([u, v, z]) => [u * H, L.chin + v * H, L.zc + (z + 0.05) * H];
  const V = (name) => { const m = name.endsWith("'"); const [u, v, z] = HV[name.slice(0, m ? -1 : undefined)][col]; return P([m ? -u : u, v, z]); };
  const HEAD = [['head', 1]], THR = [['head', 0.5], ['neck', 0.5]], NECK = [['neck', 1]];
  const wOf = (name) => (name.startsWith('K') ? THR : HEAD);
  const inside = P([0, 0.5, -0.05]);
  const push = (names, d, mirror) => {
    const list = mirror ? names.map((n) => (HV[n][col][0] === 0 ? n : `${n}'`)) : names;
    const pts = list.map(V);
    const dir = d ? (mirror ? [-d[0], d[1], d[2]] : d) : null;
    f.facet(pts, 1, pts.map((_, i) => wOf(list[i])), dir ?? inside, !!dir);
  };
  for (const { f: names, d } of HF) { push(names, d, false); if (!names.some((n) => n.endsWith("'"))) push(names, d, true); }
  f.loft(base, THROAT.map(V), 1, NECK, THR);
  // The eyes: a dark rectangle a hair off the socket plane; the brows: a slab on the shelf's front, its top lit.
  const plane = (names) => { const pts = names.map(V); const n = unit(newellOf(pts)); return { pts, n, at: (u, v) => { const p = pts[0]; const uu = u * H, vv = L.chin + v * H; return [uu, vv, n[2] !== 0 ? p[2] - (n[0] * (uu - p[0]) + n[1] * (vv - p[1])) / n[2] : p[2]]; } }; };
  const eye = EYE[style], bw = BROW[style];
  for (const s of [1, -1]) {
    const sock = plane(s > 0 ? ['E0', 'E1', 'E2', 'E3'] : ["E0'", "E1'", "E2'", "E3'"]);
    const lift = mul(sock.n, 0.012 * H);
    f.facet([[s * eye[0], eye[3]], [s * eye[1], eye[3]], [s * eye[1], eye[2]], [s * eye[0], eye[2]]].map(([u, v]) => add(sock.at(u, v), lift)), 6, HEAD, sock.n, true);
    // The rectangle's top edge a lighter slate, a hair in front, so it reads set in.
    const le = eye[3], lb = eye[3] - 0.007;
    f.facet([[s * eye[0], le], [s * eye[1], le], [s * eye[1], lb], [s * eye[0], lb]].map(([u, v]) => add(sock.at(u, v), mul(sock.n, 0.016 * H))), 7, HEAD, sock.n, true);
    const shelf = plane(s > 0 ? ['B0', 'B1', 'S1', 'S0'] : ["B0'", "B1'", "S1'", "S0'"]);
    const out = mul(shelf.n, 0.015 * H);
    for (let i = 0; i + 1 < bw.u.length; i++) {
      const u0 = s * bw.u[i], u1 = s * bw.u[i + 1], t0 = bw.top[i], t1 = bw.top[i + 1];
      const a = add(shelf.at(u0, t0), out), b = add(shelf.at(u1, t1), out), c = add(shelf.at(u1, t1 - bw.h), out), d = add(shelf.at(u0, t0 - bw.h), out);
      f.facet([a, b, c, d], 8, HEAD, shelf.n, true);
    }
  }
  return { chin: V('CH0'), crown: V('A0'), skull: Object.keys(HV).flatMap((n) => [V(n), V(`${n}'`)]) };
}
const newellOf = (pts) => { let n = [0, 0, 0]; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]); } return n; };

/**
 * The neck's base ring: twelve points round the body's own surface at height `y`, in the throat ring's directions about
 * the neck's middle, a hair outside it, so the body's cut edge above is hidden inside the lofted neck.
 */
export function neckBase(L, pts, y, style) {
  const col = style === 'woman' ? 1 : 0;
  const H = L.crown - L.chin, cz = L.zc - 0.1 * H;
  const dirs = THROAT.map((n) => { const m = n.endsWith("'"); const [u, , z] = HV[n.slice(0, m ? -1 : undefined)][col]; return Math.atan2((z + 0.05) * H + 0.1 * H, (m ? -u : u) * H); });
  const cap = H * 0.5;
  return dirs.map((a) => {
    let r = 0;
    for (const p of pts) {
      if (Math.abs(p[1] - y) > 0.08) continue;
      const dx = p[0], dz = p[2] - cz, rr = Math.hypot(dx, dz);
      if (rr > cap) continue;
      let da = Math.atan2(dz, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < Math.PI / 10) r = Math.max(r, rr);
    }
    r = (r || H * 0.25) + 0.035;
    return [Math.cos(a) * r, y, cz + Math.sin(a) * r];
  });
}

/* ---- the hands: traced ---------------------------------------------------------------------------------------------- */

/**
 * A mitt traced from ref 13's open hand (seen from the back): the hand one long from the wrist to the middle fingertip,
 * 0.59 wide, the wrist 0.38, the knuckle line 0.52 up; four finger strips with a V-groove between each pair (the index
 * 0.9 long, the middle 1.0, the ring 0.935, the little 0.82); the thumb a square wedge in two segments off the palm's
 * edge, out and forward. Built in the body's own hand frame from its joints `J` (wrist, k2..k5, tip3, t0, t1, tip1) at
 * the body's own length; `pts` the forearm surface for the cuff; `k` the side (0 the body's left). Bones: wrist, fing
 * (the three outer fingers), index, thumb; the elbow for the cuff. `detail` false is the far band's plainer mitt.
 */
export function mitt(J, pts, k, detail, f) {
  const a = unit(sub(J.k3, J.wrist));
  // Across: from the forefinger to the little finger, so the thumb's side is x < 0; `n` out of the back of the hand.
  let s = sub(J.k5, J.k2); s = unit(sub(s, mul(a, dot(s, a))));
  let n = cross(a, s);
  if (dot(sub(J.t1, J.wrist), n) > 0) n = mul(n, -1);
  const L = Math.hypot(...sub(J.k3, J.wrist)) + Math.hypot(...sub(J.tip3, J.k3));
  // The block sits a touch toward the little finger from the wrist's line, as the picture has it.
  const at = (x, y, z) => add(add(add(J.wrist, mul(s, (x + 0.01) * L)), mul(n, y * L)), mul(a, z * L));
  const WR = [[`wrist${k}`, 1]], FG = [[`fing${k}`, 1]], IX = [[`index${k}`, 1]], CUFF = [[`elbow${k}`, 0.6], [`wrist${k}`, 0.4]], TH = [[`thumb${k}`, 1]], THB = [[`wrist${k}`, 0.5], [`thumb${k}`, 0.5]];
  const KN = [[`wrist${k}`, 0.5], [`fing${k}`, 0.5]], KNI = [[`wrist${k}`, 0.5], [`index${k}`, 0.5]];
  // The cuff over the forearm, from the body's own surface.
  const cuffZ = -0.07;
  const N = detail ? 18 : 8;
  const cuff = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2).map((ang) => {
    const c = at(0, 0, cuffZ);
    let r = 0;
    for (const p of pts) {
      const d = sub(p, c); const along = dot(d, a); if (Math.abs(along) > 0.08 * L) continue;
      const x = dot(d, s), y = dot(d, n), rr = Math.hypot(x, y); if (rr > 0.5 * L) continue;
      let da = Math.atan2(y, x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < Math.PI / 6) r = Math.max(r, rr);
    }
    r = (r || 0.2 * L) + 0.02;
    return add(add(c, mul(s, Math.cos(ang) * r)), mul(n, Math.sin(ang) * r));
  });
  // Rings across the hand: the wrist (a box), and the knuckle line, the back raised to a ridge and cut by the grooves.
  // Points go round from the thumb side over the back, then under the palm; each knows its place across and through.
  const half = 0.315, T = 0.1, g = 0.035;
  const ring = (z, hw, tb, tp, groove) => {
    const out = [], xy = [];
    const pt = (x, y) => { out.push(at(x, y, z)); xy.push([x, y]); };
    const across = detail ? [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1] : [-1, -0.5, 0.5, 1];
    const dip = (x) => (detail && (Math.abs(x) === 0.5 || x === 0) ? groove : 0);
    for (const x of across) pt(x * hw, Math.abs(x) === 1 ? tb * 0.75 : tb - dip(x));
    for (let i = across.length - 1; i >= 0; i--) { const x = across[i]; pt(x * hw, Math.abs(x) === 1 ? -tp * 0.75 : -tp + dip(x) * 0.6); }
    out.xy = xy;
    return out;
  };
  // The forefinger's strip of the knuckle ring (the thumb side, x < 0) takes the index bone; the valley between is shared.
  const weigh = (r, outer, inner) => (i) => { const x = r.xy[i][0]; return x < -0.5 * half - 1e-6 ? inner : x > -0.5 * half + 1e-6 ? outer : inner === KNI ? KN : [...inner, ...outer].map(([b, w]) => [b, w / 2]); };
  const wrist = ring(0.0, 0.19, 0.085, 0.085, 0);
  const heel = ring(0.12, 0.27, 0.095, 0.095, 0);
  const knuckle = ring(0.52, half, T * 1.15, T, g);
  f.loft(cuff, wrist, 2, CUFF, WR);
  // The wrist block flares to the palm's heel, then runs to the knuckles: the back rising to the ridge, the palm flat.
  f.loft(wrist, heel, 2, WR);
  f.loft(heel, knuckle, 2, WR, weigh(knuckle, KN, KNI));
  // The fingers: each strip its own tapered loft from its share of the knuckle ring to its tip, the grooves running on.
  const tips = detail ? [0.92, 1.0, 0.95, 0.86] : [0.96, 0.96, 0.88];
  const strips = detail ? [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 8]] : [[0, 1], [1, 2], [2, 3]];
  const m = knuckle.length;
  for (let si = 0; si < strips.length; si++) {
    const idx = strips[si], tip = tips[si];
    const bone = si === 0 ? IX : FG;
    const ids = [...idx, ...idx.slice().reverse().map((i) => m - 1 - i)];
    const sect = (z, wScale, tScale) => ids.map((i) => { const [x, y] = knuckle.xy[i]; return at(x * wScale, y * tScale, z); });
    const r0 = ids.map((i) => knuckle[i]), w0 = (j) => weigh(knuckle, KN, KNI)(ids[j]);
    // Square-ended: the strip tapers a little in thickness to a flat end.
    const r1 = sect(0.52 + (tip - 0.52) * 0.5, 1.0, 0.9), r2 = sect(tip, 1.0, 0.7);
    f.loft(r0, r1, 2, w0, bone);
    f.loft(r1, r2, 2, bone);
    f.facet(r2, 2, bone, [0, 0, 0].map((_, i) => a[i]), true);
  }
  // The thumb: a square wedge from inside the palm's thumb edge, out and forward of the palm, in two segments.
  const root = at(-half * 0.72, -0.01, 0.16);
  const dir1 = unit(add(add(mul(s, -0.72), mul(n, -0.3)), mul(a, 0.63)));
  const dir2 = unit(add(add(mul(s, -0.5), mul(n, -0.4)), mul(a, 0.77)));
  const kn = add(root, mul(dir1, 0.27 * L)), tipT = add(kn, mul(dir2, 0.19 * L));
  const box = (c, d, hw, ht) => { const u = unit(cross(d, n)), v = unit(cross(u, d)); return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, y]) => add(add(c, mul(u, x * hw * L)), mul(v, y * ht * L))); };
  const t0 = box(root, dir1, 0.115, 0.1), t1 = box(kn, dir1, 0.095, 0.085), t2 = box(add(kn, mul(dir2, 0.02 * L)), dir2, 0.09, 0.08), t3 = box(add(kn, mul(dir2, 0.17 * L)), dir2, 0.07, 0.06);
  f.loft(t0, t1, 2, THB, TH);
  f.loft(t1, t2, 2, TH);
  f.loft(t2, t3, 2, TH);
  f.cap(t3, tipT, 2, TH);
  f.cap(t0.slice().reverse(), add(root, mul(dir1, -0.06 * L)), 2, THB);
  return f;
}
