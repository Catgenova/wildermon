import {
  add, beat, blush, coatPalette, cross, curve, cyc, darker, DEG, disc, eyes, lighter, merge, mirrored, mix, moved, onEgg, orb, orbAlong, paint, pastel,
  quadBones, quadBonesOf, quadPose, smile, sub, taper, TAU, tube, unit, type Anim, type Kind, type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { mesh, place, type RGB, type V3 } from './figure';
import { cut, legPieces, pawMesh, smooth01, under } from './beastkit';

/** The small wildermon: the seavic, which bounds, and the woola. */

export const scale3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/* ---- legs set by where the feet go ------------------------------------------------ */

/**
 * The swing and the fold (`QuadPose.legs`) that put a leg's ankle at a point
 * in the body's own frame, `y` forward and `z` up: the knee forward of the
 * line from hip to ankle, as a hind leg bends, or with `elbow` behind it, as
 * a fore leg does. A point out of reach gets the leg straight at it.
 */
function legTo(s: LegSpec, y: number, z: number, elbow = false): [number, number] {
  const rest = s.rest ?? [0, 0, 0], folds = s.fold ?? [45, 75];
  const L0 = s.len[0], L1 = s.len[1];
  const dy = y - s.at[1], dz = z - s.at[2];
  const d = Math.min(L0 + L1 - 1e-3, Math.max(Math.abs(L0 - L1) + 1e-3, Math.hypot(dy, dz)));
  const knee = Math.acos(Math.max(-1, Math.min(1, (L0 * L0 + d * d - L1 * L1) / (2 * L0 * d))));
  const a1 = Math.atan2(dy, -dz) + (elbow ? -knee : knee);
  const ky = s.at[1] + L0 * Math.sin(a1), kz = s.at[2] - L0 * Math.cos(a1);
  let a2 = Math.atan2(y - ky, kz - z) - a1;
  while (a2 > Math.PI) a2 -= TAU;
  while (a2 < -Math.PI) a2 += TAU;
  const sw = a1 / DEG - rest[0];
  return [sw, (rest[1] - a2 / DEG) / lerp(folds[0], folds[1], Math.min(1, Math.abs(sw) / 40))];
}

/**
 * Every foot flat on the ground, the fore paws `fore` ahead of the body's
 * bone and the hind feet `hind`, under a body `high` over the ground at the
 * pitch it is posed at: each leg set to reach its foot (`legTo`), laid over
 * the pose by `k`.
 */
function planted(s: QuadSpec, p: QuadPose, high: number, fore: number, hind: number, k: number): void {
  const P = p.pitch * DEG, cp = Math.cos(P), sp = Math.sin(P);
  for (let i = 0; i < 4; i++) {
    const leg = i < 2 ? s.fore : s.hind, y = i < 2 ? fore : hind, z = leg.len[2] - high;
    const [sw, fold] = legTo(leg, y * cp + z * sp, -y * sp + z * cp, i < 2);
    p.legs[i] = [lerp(p.legs[i][0], sw, k), lerp(p.legs[i][1], fold, k), p.legs[i][2] * (1 - k)];
    p.foot[i] = lerp(p.foot[i], -(leg.rest?.[2] ?? 0), k);
  }
  p.lift *= 1 - k;
}

/* ---- the woola ---------------------------------------------------------------------- */

/**
 * A woola: a round, mild grazer under a fleece that is a cloud -- a few big
 * billows heaped over a small body, which shrink to a crop when it is shorn
 * and grow back. A soft face in a colour of its own, eyes that are mostly
 * eye, two shells curled on its head like a snail's, and legs that are
 * barely there.
 */
const WOOLA_SPEC: QuadSpec = {
  high: 1.2,
  fore: { at: [0.8, 0.98, -0.4], len: [0.3, 0.28, 0.14], rest: [0, 0, 0], fold: [70, 90], toe: [0.27, 0.15] },
  hind: { at: [0.8, -0.78, -0.4], len: [0.3, 0.28, 0.14], rest: [4, -8, 0], fold: [70, 90], toe: [0.27, 0.15] },
  neck: { at: [0, 1.35, 0.25], len: 0.3, lean: 58 },
  head: { pitch: -2 },
  ears: { at: [0.78, -0.25, 0.02], out: 95, back: 25 },
  swing: [34, 44],
  graze: 24,
  nose: 12,
  bow: 10,
  rock: 5,
};

const WOOLA_HEAD = { c: [0, 0.45, 0.15] as V3, r: [1.0, 0.92, 0.8] as V3 };
/** Where the chin is in the head's frame, and the hinge it chews on. */
const WOOLA_CHIN: V3 = [0, 1.25, -0.4];
const WOOLA_HINGE: V3 = [0, 0.75, -0.25];

/** How far through a chew it is, nought shut to one open, and to which side the jaw is ground: in bursts of about three seconds. */
function woolaChew(t: number): [number, number] {
  const burst = smooth01((cyc(t, 3, 0.6) - 0.15) * 3);
  return [burst * (0.5 + 0.5 * cyc(t, 36)), burst * cyc(t, 18)];
}

/**
 * The chin of the face, corners `from` to `to` of it, turned down on its
 * hinge and ground from side to side as it chews the cud, standing; still
 * while it walks or grazes, where the tug at the grass is the head's.
 */
const chewed = (from: number, to: number) => (v: readonly V3[], a: Anim): V3[] => {
  if (a.go > 0 || a.graze > 0) return v as V3[];
  const [open, side] = woolaChew(a.t);
  if (!open && !side) return v as V3[];
  const c = Math.cos(open * 16 * DEG), sn = Math.sin(open * 16 * DEG);
  const out = v.slice() as V3[];
  for (let i = from; i < to; i++) {
    const y = v[i][1] - WOOLA_HINGE[1], z = v[i][2] - WOOLA_HINGE[2];
    out[i] = [v[i][0] + 0.12 * side, WOOLA_HINGE[1] + y * c + z * sn, WOOLA_HINGE[2] - y * sn + z * c];
  }
  return out;
};

/** Where the body under the fleece is, and its egg, which a shorn fleece hugs. */
const WOOLA_CORE: V3 = [0, 0, 0.05];
const WOOLA_EGG: V3 = [0.95, 1.35, 0.8];

/** The fleece: big billows heaped across the top, so the outline is a cloud's scallop from every side, over a flatter skirt of smaller puffs. */
const BILLOWS: Array<[V3, number]> = [
  [[0, -0.7, 0.72], 1.08], [[0.05, 0.55, 0.8], 0.98], [[0.12, -0.05, 1.12], 0.88], [[0.82, 0.05, 0.5], 0.82], [[-0.8, -0.25, 0.5], 0.84],
  [[0, -0.1, -0.05], 1.25],
];
const SKIRT: Array<[V3, number]> = Array.from({ length: 7 }, (_, q) => {
  const a = (q / 7) * Math.PI * 2 + 0.3;
  return [[Math.cos(a) * 1.05, Math.sin(a) * 1.3, -0.25], 0.62] as [V3, number];
});

/**
 * The fleece, puff by puff, with where each puff's corners are in the whole:
 * a skirt puff is flat underneath, the colour of a cloud's underside.
 */
function fleeceOf(n: number, k: number): { mesh: ReturnType<typeof merge>; puffs: Array<{ from: number; to: number; c: V3 }> } {
  const puffs: Array<{ from: number; to: number; c: V3 }> = [];
  const meshes: Array<ReturnType<typeof orb>> = [];
  let at = 0;
  const add = (m: ReturnType<typeof orb>, c: V3): void => {
    puffs.push({ from: at, to: at + m.v.length, c });
    at += m.v.length;
    meshes.push(m);
  };
  BILLOWS.forEach(([c, r], q) => add(orb(c, [r * 1.02, r, r * 0.78], n + 1, k, q === 2 ? 'coatLight' : 'coat'), c));
  for (const [c, r] of SKIRT) {
    const m = orb(c, [r, r, r * 0.7], n, k - 1, 'coat');
    const floor = c[2] - r * 0.7 * 0.45;
    const v = m.v.map((p) => [p[0], p[1], Math.max(floor, p[2])] as V3);
    const f = m.f.map((face) => (face.i.reduce((z, i) => z + v[i][2], 0) / face.i.length < floor + 0.05 ? { ...face, m: 'coatDark' as const } : face));
    add(mesh(v, f), c);
  }
  return { mesh: merge(...meshes), puffs };
}

/** A small cloud of three puffs, for the ones that follow a woola about: a cool white of their own, lighter than any fleece. */
const cloudlet = (r: number, n: number, k: number): ReturnType<typeof merge> => merge(
  orb([0, 0, 0], [r, r * 0.9, r * 0.75], n, k, 'cap'), orb([r * 0.8, r * 0.1, -r * 0.15], r * 0.62, n, k, 'cap'), orb([-r * 0.75, -r * 0.1, -r * 0.2], r * 0.55, n, k, 'cap'),
);

function woolaBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  // The body under the fleece, which is all that shows of it once it is shorn: an egg.
  const body = orb(WOOLA_CORE, WOOLA_EGG, n, k, 'mark');
  const { mesh: fleece, puffs } = fleeceOf(n, k);
  // A fleece growing back: every puff smaller about its own middle and drawn in onto the body, so a crop is a close, bumpy coat
  // over the egg of it, and never gone. Shorn, each puff sits on the egg's skin where the line out to it crosses it, half out, so
  // the crop covers the belly and the sides as well as the back.
  const shorn = puffs.map((pf) => {
    const { p: at, n: out } = onEgg(WOOLA_CORE, WOOLA_EGG, sub(pf.c, WOOLA_CORE));
    return add(at, scale3(out, -0.12));
  });
  const grown = (v: readonly V3[], a: Anim): V3[] => {
    const f = Math.max(0, Math.min(1, a.fleece));
    if (f >= 1) return v as V3[];
    const size = 0.45 + 0.55 * f;
    const out = v.slice() as V3[];
    puffs.forEach((pf, q) => {
      const c: V3 = [lerp(shorn[q][0], pf.c[0], f), lerp(shorn[q][1], pf.c[1], f), lerp(shorn[q][2], pf.c[2], f)];
      for (let i = pf.from; i < pf.to; i++) out[i] = [c[0] + (v[i][0] - pf.c[0]) * size, c[1] + (v[i][1] - pf.c[1]) * size, c[2] + (v[i][2] - pf.c[2]) * size];
    });
    return out;
  };
  const H = WOOLA_HEAD;
  // A face with a profile: a soft muzzle standing well out from the skull under a dip at the brow, so side on it is a face and not an
  // egg; under it a chin, which is what chews (`chewed`).
  const skull = orb(H.c, H.r, n + 1, k + 1, 'muzzle');
  const chin = orbAlong(WOOLA_CHIN, [0, 1, -0.3], [0.34, 0.32, 0.2], n, k, 'muzzle');
  const face = merge(
    skull,
    chin,
    orbAlong([0, 1.28, -0.2], [0, 1, -0.2], [0.5, 0.46, 0.36], n, k, 'muzzle'),
    paint([disc([0, 1.73, -0.08], [0, 1, 0.2], 0.15, 0.09, 6, 'nose')]),
    smile([0, 1.74, -0.3], [0, 1, 0], 0.26, 'nose'),
    blush(H.c, H.r, [0.8, 0.45, -0.35], 0.2),
  );
  // Eyes half round to the side and a little up, so side on the whole eye and its rim show, from the front both still look at you,
  // and a band of face shows between each and the shell over it.
  const look = (shut: boolean): ReturnType<typeof eyes> => eyes(H.c, H.r, [0.68, 0.68, 0.24], 0.34, { tall: 1.15, shut, rim: 0.14 });
  // A tuft of fleece on the brow.
  const tuft = merge(orb([0, 0.25, 0.84], [0.5, 0.44, 0.3], n, k, 'coat'), orb([0.32, 0.08, 0.72], 0.3, n, k, 'coat'), orb([-0.32, 0.08, 0.72], 0.3, n, k, 'coat'));
  // A snail's shell up at each back corner of the head, framing the face: a whorl winding out along an axis turned out, forward and
  // up, so its spiral faces a viewer from the front and the three-quarters and shows as a cone side on; a groove down the join
  // of its turns, and a spark of light on it.
  const shell = (sd: number): ReturnType<typeof merge> => {
    const ax = unit([sd * 0.61, 0.61, 0.5]);
    const e1 = unit(cross(ax, [0, 0, 1])), e2 = cross(ax, e1);
    const C: V3 = [sd * 0.8, -0.2, 0.74];
    const pts: V3[] = [], rs: number[] = [], groove: V3[] = [];
    const N = 12;
    for (let q = 0; q <= N; q++) {
      const u = q / N, a = u * Math.PI * 2.3, R = 0.42 * (1 - u * 0.82), rr = 0.24 * (1 - u * 0.86);
      const p = add(add(C, scale3(e1, Math.cos(a) * R)), add(scale3(e2, Math.sin(a) * R), scale3(ax, u * 0.4 + u ** 3 * 0.15)));
      pts.push(p);
      rs.push(rr);
      groove.push(add(p, add(scale3(ax, rr * 0.75), scale3(sub(C, p), 0.35 * rr / Math.max(0.05, R)))));
    }
    return merge(
      tube(pts, rs, rs, n, 'shell'),
      tube(groove.slice(1, N), 0.06, 0.06, 4, 'shellDark'),
      paint([disc(add(pts[2], scale3(ax, rs[2] * 1.02)), ax, 0.07, 0.07, 5, 'glint', { lit: true })]),
    );
  };
  const ear = tube(curve([0, 0, 0], [0, 0.05, 0.25], [0, 0.02, 0.5], 3), [0.12, 0.22, 0.2, 0.05], 0.07, 6, 'muzzle', { up: [0, 1, 0], seam: 'start' });
  const hide = [{ c: H.c, r: H.r }];
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'trunk', bias: 0 },
    // Over the tops of the legs, which go up into it; one outline round the whole cloud, no lines inside it, and a silver edge.
    { key: 'fleece', mesh: fleece, bone: 'fleece', bias: 0.04, after: ['body', 'fl0', 'fr0', 'hl0', 'hr0'], bent: grown, breathes: { c: [0, 0, 0.2], k: 0.18 }, lines: false, sheen: 'crystal' },
    { key: 'neck', mesh: tube([[0, 0, -0.2], [0, 0, 0.4]], 0.52, 0.46, n, 'muzzle', { seam: 'both' }), bone: 'neck', bias: 0, under: 'head', convex: true },
    { key: 'head', mesh: merge(face, look(false)), shut: merge(face, look(true)), bone: 'head', bias: 0.2, bent: chewed(skull.v.length, skull.v.length + chin.v.length) },
    { key: 'tuft', mesh: tuft, bone: 'head', bias: 0.21, after: 'head', hide, lines: false },
    { key: 'shells', mesh: merge(shell(1), shell(-1)), bone: 'head', bias: 0.215, after: ['head', 'tuft'] },
    { key: 'ear0', mesh: ear, bone: 'ear0', bias: 0.205, after: 'head', hide, hideIn: 'head' },
    { key: 'ear1', mesh: ear, bone: 'ear1', bias: 0.205, after: 'head', hide, hideIn: 'head' },
    // Two little clouds that keep it company, behind and above the rump.
    { key: 'cloud0', mesh: cloudlet(0.46, n, k), bone: 'cloud0', bias: -0.1, lines: false, airy: true, thin: true, sheen: 'crystal', shown: (a) => a.fleece > 0.6 },
    { key: 'cloud1', mesh: cloudlet(0.32, n, k), bone: 'cloud1', bias: -0.1, lines: false, airy: true, thin: true, sheen: 'crystal', shown: (a) => a.fleece > 0.6 },
  ];
  // Round bean feet on short legs, set wide, so two show in front from the front and three or four side on: flat on the ground,
  // longer than they are tall.
  const foot = pawMesh(0.21, n, k, 'hoof', 0.14);
  for (const leg of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    pieces.push(...legPieces(leg[0], leg[2], leg[1], [[0, 0, 0.3], [0, 0, -0.3]], [0.24, 0.2], [[0, 0, 0], [0, 0, -0.28]], [0.19, 0.18], leg[1] < 0 ? mirrored(foot) : foot, n, 'muzzle'));
  }
  return pieces;
}

/** Its legs shorter and it lower as its fleece goes: shorn, it is not a cushion on a stool. */
const woolaSpecs = new Map<number, QuadSpec>();
function woolaSpec(fleece: number): QuadSpec {
  const key = Math.round(Math.max(0, Math.min(1, fleece)) * 6);
  let s = woolaSpecs.get(key);
  if (!s) {
    const k = 1 - 0.38 * (1 - key / 6);
    const S = WOOLA_SPEC;
    s = { ...S, fore: { ...S.fore, len: [S.fore.len[0] * k, S.fore.len[1] * k, S.fore.len[2]] }, hind: { ...S.hind, len: [S.hind.len[0] * k, S.hind.len[1] * k, S.hind.len[2]] } };
    woolaSpecs.set(key, s);
  }
  return s;
}

/** The trundle's rise and fall, over a stride: up twice, once off each pair of feet. */
const trundle = (w: number): number => 0.24 * Math.abs(Math.sin(w * TAU));

function woolaOwn(p: QuadPose, a: Anim): void {
  const w = a.u - Math.floor(a.u);
  if (a.go < 1) woolaStill(p, a, 1 - smooth01(a.go));
  if (a.go > 0) {
    // A trundle: up and down twice a stride, rocking nose to tail and rolling a little, the head nodding.
    p.lift += a.go * trundle(w);
    p.pitch += a.go * 4 * Math.sin(w * TAU * 2 + 0.8);
    p.roll += a.go * 3 * Math.sin(w * TAU);
    p.squash += a.go * 0.07 * Math.max(0, Math.cos(w * TAU * 2));
    p.neck[0] += a.go * 5 * Math.sin(w * TAU * 2 + 0.6);
  }
}

/** Standing and grazing, laid over the pose by `n`. */
function woolaStill(p: QuadPose, a: Anim, n: number): void {
  const t = a.t, gz = a.graze;
  // Every foot flat where it stands, grazing as well, the body let down as the chest bows so the hind feet stay on the grass; and
  // shorn, on its shorter legs, bowing less.
  const s = woolaSpec(a.fleece), k = s.fore.len[0] / WOOLA_SPEC.fore.len[0];
  p.pitch += gz * 11 * (1 - k) * n;
  const P = p.pitch * DEG;
  planted(s, p, 0.54 + 0.5626 * k + 0.78 * Math.sin(P) + 0.4 * (Math.cos(P) - 1), 0.98, -0.78, n);
  p.roll *= 1 - n;
  // Chewing the cud in bursts, the head going with the jaw a little; a shuffle from foot to foot; and now and then a shake of the
  // head that runs through the fleece.
  const shake = beat(t, [9.6, 20.4], 1.0) * n;
  p.head[2] += 18 * shake * Math.sin(t * Math.PI * 6);
  p.roll += 4 * shake * Math.sin(t * Math.PI * 6 + 1);
  p.head[0] += 1.5 * woolaChew(t)[0] * (1 - shake) * (1 - gz) * n;
  p.legs[0][0] += 6 * beat(t, [3.4], 0.8) * n;
  p.legs[3][0] += 6 * beat(t, [15.1], 0.8) * n;
}

export const WOOLA: Kind = {
  bones: (a) => {
    const p = quadPose(WOOLA_SPEC, a);
    woolaOwn(p, a);
    const b = quadBones(woolaSpec(a.fleece), p);
    // The fleece a moment behind the body: lagging below it as it rises and above it as it comes down, so it settles after each step.
    const w = a.u - Math.floor(a.u);
    const lag = a.go > 0 ? a.go * 0.7 * (trundle((w - 0.07 + 1) % 1) - trundle(w)) : 0;
    b.fleece = { m: b.trunk.m, t: [b.trunk.t[0], b.trunk.t[1], b.trunk.t[2] + lag] };
    // The two clouds: bobbing on their own over the rump standing, trailing further back and lower going, and puffed down at each
    // footfall.
    const t = a.t, go = a.go;
    const bob0 = 0.14 * cyc(t, 5) + go * 0.2 * Math.sin((w - 0.15) * TAU * 2);
    const bob1 = 0.12 * cyc(t, 7, 1.3) + go * 0.2 * Math.sin((w - 0.25) * TAU * 2);
    b.cloud0 = { m: b.body.m, t: place(b.body, [0.7, -2.55 - 0.5 * go, 0.95 - 0.2 * go + bob0]) };
    b.cloud1 = { m: b.body.m, t: place(b.body, [-0.62, -3.6 - 0.7 * go, 1.55 - 0.25 * go + bob1]) };
    return b;
  },
  build: woolaBuild,
  palette: (coat0, mark0) => {
    const coat = pastel(coat0);
    // The face a colour of its own, well away from the fleece: a soft cocoa under a pale fleece, cream under a dark one.
    const pale = coat[0] + coat[1] + coat[2] > 480;
    const face: RGB = pale ? mix([150, 116, 126], pastel(mark0), 0.25) : [240, 228, 212];
    return coatPalette(coat0, mark0, {
      coatLight: lighter(coat, 0.1), coatDark: mix(coat, [168, 176, 226], 0.45), muzzle: face, mark: face, horn: [236, 214, 176], hoof: darker(face, 0.45), nose: darker(face, 0.5),
      shell: [248, 196, 160], shellDark: [168, 102, 90], inner: [238, 160, 172], crystal: mix(lighter(coat, 0.4), [236, 242, 255], 0.6),
      cap: mix(lighter(coat, 0.5), [226, 230, 250], 0.5),
    });
  },
  shadow: [2.1, 1.6],
  stride: 1.1,
  size: 2.45,
  blinks: 4,
};

/* ---- the seavic --------------------------------------------------------------------- */

/**
 * A seavic: a quick red-brown treetop thing with cheeks stuffed with seed.
 * Its great tail, worn like a cloak, is a frond of oak leaves rather than
 * fur, and an acorn's cap sits on its head like a hat it will not take off.
 * It does not graze with its nose in the grass: it sits up on its haunches
 * with what it found held in its fore paws, and nibbles.
 */
const SEAVIC_SPEC: QuadSpec = {
  high: 1.55,
  fore: { at: [0.5, 0.85, -0.45], len: [0.45, 0.42, 0.14], rest: [8, -12, 0], fold: [50, 80], toe: [0.25, 0.1] },
  hind: { at: [0.72, -0.95, -0.2], len: [0.8, 0.95, 0.14], rest: [58, -112, 0], fold: [20, 35], toe: [0.85, 0.2] },
  neck: { at: [0, 0.85, 0.45], len: 0.4, lean: 22 },
  head: { pitch: 0 },
  tail: { at: [0, -1.55, 0.3], links: 3, len: 0.55, lift: 72, curl: 32, sway: 8 },
  ears: { at: [0.42, -0.05, 0.72], out: 16, back: 6 },
  swing: [30, 46],
  duty: [0.42, 0.28],
  graze: 0,
  nose: 0,
  bow: 0,
  bound: true,
  rock: 0,
};

const SEAVIC_HEAD = { c: [0, 0.3, 0.35] as V3, r: [0.86, 0.84, 0.74] as V3 };
/** Where the acorn cap's cup sits on the crown, which it is tipped forward about. */
const SEAVIC_CAP: V3 = [0, 0.18, 1.1];

function seavicBuild(lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6);
  const ys = [-1.7, -1.5, -1.05, -0.4, 0.3, 0.85, 1.15];
  const body = tube(ys.map((y, q) => [0, y, [0.3, 0.3, 0.28, 0.24, 0.24, 0.32, 0.4][q]] as V3), [0.15, 0.78, 1.02, 1.0, 0.88, 0.64, 0.15], [0.12, 0.64, 0.82, 0.8, 0.72, 0.56, 0.15], n,
    (ring, j) => (ring > 0 && ring < ys.length - 1 && under(n, j) ? 'mark' : 'coat'));
  const H = SEAVIC_HEAD;
  const skull = orb(H.c, H.r, n + 1, k + 1, 'coat');
  // Cheeks stuffed round with seed, bulging out to the sides rather than hanging under the jaw, and a pale muzzle between them.
  const cheeks = merge(
    orb([0.56, 0.78, 0.14], [0.34, 0.3, 0.28], n, k, 'mark'), orb([-0.56, 0.78, 0.14], [0.34, 0.3, 0.28], n, k, 'mark'),
    orbAlong([0, 1.02, 0.12], [0, 1, 0], [0.26, 0.24, 0.22], n, k, 'muzzle'),
    orbAlong([0, 1.22, 0.24], [0, 1, 0.3], [0.1, 0.07, 0.07], 5, 3, 'nose'),
  );
  // Eyes round to the side, clear of the outline side on, the muzzle in front of them.
  const look = (shut: boolean) => eyes(H.c, H.r, [0.76, 0.54, 0.3], 0.3, { tall: 1.18, shut, rim: 0.1 });
  // The acorn cap: a cup worked in two rows, dark and light, sat up on the crown and tipped forward so it shows side on, and a stalk.
  const cap = moved(moved(merge(
    tube([[0, 0, -0.08], [0, 0, 0.02], [0, 0, 0.12], [0, 0, 0.24]], [0.46, 0.52, 0.46, 0.2], [0.46, 0.52, 0.46, 0.2], n, (ring) => (ring === 1 ? 'shellDark' : 'bark')),
    taper(curve([0, 0, 0.24], [0, -0.02, 0.38], [0.06, -0.08, 0.5], 2), 0.08, 0.05, 5, 'bark'),
  ), [0, 0, 0], 0, -12), SEAVIC_CAP);
  // An ear, turned out so it shows its face side on, pink inside.
  const ear = moved(merge(
    taper(curve([0, 0, 0], [0, 0, 0.3], [0, -0.05, 0.55], 2), 0.26, 0.03, n, 'coat', 0.35, [0, 1, 0]),
    paint([disc([0, 0.1, 0.2], [0, 1, 0.1], 0.13, 0.16, 6, 'inner')]),
  ), [0, 0, 0], -35);
  // The tail: three links of oak leaf, each a broad frond overlapping the next, veined, fanning as it curls, and each rolled on its
  // length the other way from the last, so from any side some of it shows its face rather than its edge.
  const frond = (w: number, len: number, roll: number): ReturnType<typeof tube> => moved(merge(
    tube(curve([0, 0.05, 0], [0, -len * 0.5, 0.05], [0, -len * 1.05, 0], 4), [0.1, w * 0.8, w, w * 0.7, 0.02], 0.1, n, (ring) => (ring >= 3 ? 'leafDark' : 'leaf'), { up: [0, 0, 1] }),
    tube([[0, 0, 0.1], [0, -len * 0.9, 0.12]], 0.05, 0.05, 4, 'leafDark'),
    moved(tube(curve([0, 0, 0], [0.3, -len * 0.4, 0.05], [w * 0.9, -len * 0.75, 0.0], 3), [0.05, w * 0.35, w * 0.3, 0.02], 0.07, 6, 'leafDark', { up: [0, 0, 1] }), [0, -0.1, -0.05]),
    moved(tube(curve([0, 0, 0], [-0.3, -len * 0.4, 0.05], [-w * 0.9, -len * 0.75, 0.0], 3), [0.05, w * 0.35, w * 0.3, 0.02], 0.07, 6, 'leafDark', { up: [0, 0, 1] }), [0, -0.1, -0.05]),
  ), [0, 0, 0], 0, 0, roll);
  const hide = [{ c: H.c, r: H.r }];
  const pieces: Piece[] = [
    { key: 'body', mesh: body, bone: 'body', bias: 0, breathes: { c: [0, 0, 0.3], k: 0.05 } },
    { key: 'tail0', mesh: frond(0.62, 0.78, 55), bone: 'tail0', bias: -0.1, chain: 'tail' },
    { key: 'tail1', mesh: frond(0.76, 0.78, -50), bone: 'tail1', bias: -0.09, chain: 'tail' },
    { key: 'tail2', mesh: frond(0.84, 0.88, 55), bone: 'tail2', bias: -0.08, chain: 'tail' },
    { key: 'neck', mesh: tube([[0, 0, -0.25], [0, 0, 0.3], [0, 0.05, 0.55]], [0.58, 0.54, 0.5], [0.52, 0.5, 0.48], n, 'coat'), bone: 'neck', bias: 0, under: 'head', convex: true },
    { key: 'head', mesh: merge(skull, cheeks, look(false)), shut: merge(skull, cheeks, look(true)), bone: 'head', bias: 0.2 },
    { key: 'cap', mesh: cap, bone: 'head', bias: 0.21, after: 'head', hide },
    { key: 'ear0', mesh: mirrored(ear), bone: 'ear0', bias: 0.215, after: ['head', 'cap'], hide, hideIn: 'head' },
    { key: 'ear1', mesh: ear, bone: 'ear1', bias: 0.215, after: ['head', 'cap'], hide, hideIn: 'head' },
  ];
  const paw = pawMesh(0.17, n, k, 'coatDark', 0.14);
  const hindFoot = tube([[0, -0.2, -0.08], [0, 0.3, -0.12], [0, 0.8, -0.1], [0, 1.0, -0.06]], [0.16, 0.24, 0.2, 0.08], [0.13, 0.14, 0.12, 0.06], n, 'coatDark');
  const haunch = orbAlong([0, 0.05, -0.3], [0, -0.5, 1], [0.5, 0.6, 0.66], n, k, 'coat');
  for (const [key, side] of [['fl', -1], ['fr', 1]] as Array<[string, number]>) {
    pieces.push(...legPieces(key, true, side, [[0, 0, 0.3], [0, 0, -0.45]], [0.28, 0.2], [[0, 0, 0], [0, 0.02, -0.42]], [0.2, 0.16], paw, n));
  }
  for (const [key, side] of [['hl', -1], ['hr', 1]] as Array<[string, number]>) {
    const front: V3 = [side * 0.7, -0.7, 0];
    pieces.push(
      { key: `${key}0`, mesh: moved(haunch, [side * 0.05, 0, 0]), bone: `${key}0`, bias: 0.01, after: 'body', front },
      { key: `${key}1`, mesh: tube([[0, 0, 0.1], [0, 0, -0.95]], [0.18, 0.15], [0.18, 0.15], n, 'coat'), bone: `${key}1`, bias: 0.005, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: hindFoot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return pieces;
}

/**
 * Sitting up to eat, as far as `gz` says: up on its haunches, the fore paws
 * held up at the mouth, the head bowed over them, and nibbling -- the head
 * and the paws working on every other still, in bursts.
 */
function seavicNibble(p: QuadPose, a: Anim, gz: number): void {
  const t = a.t;
  const burst = 0.4 + 0.6 * Math.max(0, cyc(t, 8));
  const nib = cyc(t, 72) * burst;
  p.pitch += gz * 46;
  p.neck[0] += gz * (26 + 3 * nib);
  p.head[0] -= gz * (60 + 4 * nib);
  for (const i of [0, 1]) {
    p.legs[i][0] += gz * (86 + 5 * nib);
    p.legs[i][1] += gz * (1.3 - 0.85);
  }
  // The tail up along the back behind it, as a squirrel sits.
  p.tail[0] += gz * 45;
}

export const SEAVIC: Kind = {
  bones: quadBonesOf(SEAVIC_SPEC, (p, a) => {
    const w = a.u - Math.floor(a.u);
    const duty = 0.42 + (0.28 - 0.42) * a.gait;
    const air = Math.max(0, Math.min(1, (w - duty) / (0.5 - duty)));
    const leap = w > duty && w < 0.5 ? Math.sin(air * Math.PI) : 0;
    p.lift += a.go * (0.5 + 0.6 * a.gait) * leap;
    p.pitch += a.go * ((8 + 6 * a.gait) * Math.cos((w - duty) * Math.PI * 2) - 2);
    // The tail rides up over the back standing, and streams out behind at a run; standing, flicked up and aside now and then, quickly.
    const flick = beat(a.t, [3.4, 11.1, 18.8], 0.5) * (1 - a.go);
    p.tail[0] -= a.go * 45 * a.gait + 25 * flick;
    p.tail[1] += 20 * flick;
    p.tail[2] -= a.go * 25 * a.gait;
    if (a.graze > 0 && a.go < 1) seavicNibble(p, a, a.graze * (1 - smooth01(a.go)));
  }),
  build: seavicBuild,
  palette: (coat, mark) => coatPalette(coat, mark, { leaf: [226, 182, 74], leafDark: [176, 124, 52], bark: [120, 84, 60], shellDark: [196, 160, 112], muzzle: lighter(mark, 0.3), nose: [96, 60, 64] }),
  shadow: [1.7, 1.0],
  stride: 1.5,
  size: 2.4,
};
