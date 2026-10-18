import {
  beat, coatPalette, curve, cyc, DEG, disc, eyes, lighter, merge, mirrored, moved, orb, orbAlong, paint, quadBonesOf, taper, TAU, tube, type Anim,
  type Kind, type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import type { V3 } from './figure';
import { cut, legPieces, pawMesh, smooth01, under } from './beastkit';

/** The small wildermon: the seavic, which bounds; and legs set by where the feet go, for any kind that wants them. */

export const scale3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/* ---- legs set by where the feet go ------------------------------------------------ */

/**
 * The swing and the fold (`QuadPose.legs`) that put a leg's ankle at a point
 * in the body's own frame, `y` forward and `z` up: the knee forward of the
 * line from hip to ankle, as a hind leg bends, or with `elbow` behind it, as
 * a fore leg does. A point out of reach gets the leg straight at it.
 */
export function legTo(s: LegSpec, y: number, z: number, elbow = false): [number, number] {
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
export function planted(s: QuadSpec, p: QuadPose, high: number, fore: number, hind: number, k: number): void {
  const P = p.pitch * DEG, cp = Math.cos(P), sp = Math.sin(P);
  for (let i = 0; i < 4; i++) {
    const leg = i < 2 ? s.fore : s.hind, y = i < 2 ? fore : hind, z = leg.len[2] - high;
    const [sw, fold] = legTo(leg, y * cp + z * sp, -y * sp + z * cp, i < 2);
    p.legs[i] = [lerp(p.legs[i][0], sw, k), lerp(p.legs[i][1], fold, k), p.legs[i][2] * (1 - k)];
    p.foot[i] = lerp(p.foot[i], -(leg.rest?.[2] ?? 0), k);
  }
  p.lift *= 1 - k;
}

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
