/**
 * Stumps and felled logs drawn as solids (`stump3dSprite`, `log3dSprite` in
 * `./index`), in their species' bark as its trees are painted (`./paint`).
 *
 * A stump is the foot of its species' mature tree on that tile, sawn off
 * flat: the same trunk, root flare or buttresses and bark, with a cut top of
 * growth rings in the pale wood the flat stump's face is (`woodOf`). A log is
 * a length of the same trunk lying on the ground, both ends sawn.
 */
import { KIT_INK, KIT_INK_W } from '../kit/core';
import { proj } from '../runestone';
import { dulled, mix, tone } from '../trees/kit';
import { mulberry32 } from '../../world/noise';
import { ACROSS, bandPath, buttress, chainsOf, footOf, paintChain, paintFoot, SNOW_EDGE, type Chain, type Item, type Job } from './paint';
import type { Light } from './light';
import type { Limb, Skeleton, Species3D, V3 } from './types';
import { add, dot, hex, lerp, mixRgb, mul, rgb, sub, unit } from './vec';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** A sawn face: its middle, its radius, which way it faces, and the piece of wood it ends. */
export interface Cut {
  c: V3;
  r: number;
  n: V3;
  limb: number;
  /** A log's end: the log's way across on the screen there, and how far the end is turned to the eye, 0 to 1. */
  side?: { n: Pt; f: number };
}

/** A stump's model: its wood, cut, and each stem's sawn top. */
export interface StumpModel {
  sk: Skeleton;
  cuts: Cut[];
}

/** The cut wood's tones, as the flat stump's face (`stumpSprite`): the face and its rings, from the species' trunk colour. */
export function woodOf(trunk: string): { face: string; ring: string } {
  return { face: dulled(trunk, -0.62), ring: dulled(trunk, -0.12) };
}

/** The lowest and highest a stump is sawn, in model units. */
const CUT_LO = 2.6;
const CUT_HI = 8;
/** How high up a stump its roots leave it, against where it is sawn. */
const ROOT_UP = 0.5;
/** How much of its tree's lean a stump keeps. */
const LEAN_KEPT = 0.12;
/** Where a stump's stem is cut into pieces, as shares of its height: close at its foot, where it flares. */
const STEM_AT = [0, 0.12, 0.3, 0.6, 1];
/** How far a sawn face's rings are taken toward the bark's furrows. */
const RING_DARK = 0.3;
/** A pale bark's dashes on a stump or a log, against its tree's: seen close to, they are small. */
const MARKS_FINE = 0.3;

/**
 * What sets one kind of stump apart, by how its tree grows (`Build.habit`,
 * `Build.whorls`): its sawn face's radius in model units, whatever its tree's
 * girth, so a field of them stays within a size of each other; how high it is
 * sawn against that radius; how far its roots reach against its tree's; a
 * stem with no flare at its foot; and knobs on its stem.
 */
export interface StumpShape {
  radius: number;
  cut: number;
  roots: number;
  straight?: boolean;
  knobs?: number;
}
export const STUMP_SHAPES: Record<'conifer' | 'spreading' | 'upright' | 'orchard' | 'dome', StumpShape> = {
  // Tall, on a broad foot of long buttresses.
  conifer: { radius: 4.2, cut: 1.55, roots: 1 },
  // Broad and low, craggy with its buttresses.
  spreading: { radius: 4.9, cut: 0.8, roots: 0.75 },
  // Straight-sided, with no flare.
  upright: { radius: 3.9, cut: 1.35, roots: 0.6, straight: true },
  // Short and knobbly.
  orchard: { radius: 4.3, cut: 0.8, roots: 0.6, knobs: 3 },
  dome: { radius: 4.6, cut: 1.05, roots: 0.78 },
};

/** The radius of the first stem of a tree's trunk at height `z`. */
function radiusAt(limbs: Limb[], z: number): number {
  for (const L of limbs) {
    if (L.order !== 0) continue;
    if (L.b[2] >= z) return L.ra + (L.rb - L.ra) * clamp01((z - L.a[2]) / Math.max(1e-6, L.b[2] - L.a[2]));
  }
  return limbs[0]?.rb ?? 2;
}

/** A tree's wood, every point and radius `k` times. */
const scaled = (limbs: Limb[], k: number): Limb[] => limbs.map((L) => ({ ...L, a: mul(L.a, k), b: mul(L.b, k), ra: L.ra * k, rb: L.rb * k }));

/**
 * The stump a tree leaves: its main stem up to where it is sawn, brought to
 * its kind's size (`StumpShape`), and its roots below the cut, flared out as
 * lobes on the ground (`lobesOf`); knobs on it where its kind has them. Its
 * own contact shade at its foot just past the trunk (`Skeleton.foot`).
 */
export function stumpOf(tree: Skeleton, shape: StumpShape, seed: number): StumpModel {
  const k = shape.radius / Math.max(0.5, radiusAt(tree.limbs, 4));
  const L = scaled(tree.limbs, k);
  const zc = Math.max(CUT_LO, Math.min(CUT_HI, shape.radius * shape.cut));
  // Its buttresses rise to three quarters of the foot's radius and stand out of it from seven tenths of it
  // (`buttress`): the foot no wider than lets them fit under the cut and inside the stem a little way up.
  const footR = Math.min(L[0]?.ra ?? 0, zc / (1.02 * 0.95), radiusAt(L, zc * 0.6) * 1.12);
  const limbs: Limb[] = [];
  const cuts: Cut[] = [];
  const kept = new Map<number, number>();
  // One stem: the first, the tree's main one, stood where the foot is, stood up straighter -- its lean kept only as
  // far as `LEAN_KEPT` -- and its girth at each height its own, or the same all the way down where it is straight.
  for (let i = 0; i < L.length && !cuts.length; i++) {
    if (L[i].order !== 0 || L[i].parent >= 0) continue;
    const run = [i];
    for (let k = i + 1; k < L.length; k++) if (L[k].order === 0 && L[k].parent === run[run.length - 1]) run.push(k);
    const foot = L[i].a;
    const straight = shape.straight ? radiusAt(L, zc * 0.8) : 0;
    const along = (z: number): { p: V3; r: number } => {
      for (const k of run) {
        const P = L[k];
        if (P.b[2] < z && k !== run[run.length - 1]) continue;
        const t = clamp01((z - P.a[2]) / Math.max(1e-6, P.b[2] - P.a[2]));
        const q = lerp(P.a, P.b, t);
        return { p: [(q[0] - foot[0]) * LEAN_KEPT, (q[1] - foot[1]) * LEAN_KEPT, z], r: straight || P.ra + (P.rb - P.ra) * t };
      }
      return { p: [0, 0, z], r: straight || L[i].ra };
    };
    const first = limbs.length;
    for (const k of run) kept.set(k, first);
    // Upright over its last piece, so the saw's cut meets its sides square.
    const stand = (j: number): { p: V3; r: number } => {
      const o = along(zc * STEM_AT[j]);
      if (j < STEM_AT.length - 1) return o;
      const below = along(zc * STEM_AT[j - 1]);
      return { p: [below.p[0], below.p[1], o.p[2]], r: o.r };
    };
    for (let j = 0; j + 1 < STEM_AT.length; j++) {
      const lo = stand(j), hi = stand(j + 1);
      limbs.push({ a: lo.p, b: hi.p, ra: lo.r, rb: hi.r, order: 0, parent: j ? limbs.length - 1 : -1, bough: -1 });
    }
    if (first === 0 && !straight) limbs[0].ra = Math.min(limbs[0].ra, footR);
    const top = limbs[limbs.length - 1];
    cuts.push({ c: top.b, r: top.rb, n: [0, 0, 1], limb: limbs.length - 1 });
  }
  for (let i = 0; i < L.length && !shape.straight; i++) {
    const P = L[i];
    if (P.order !== -1) continue;
    const parent = kept.get(P.parent);
    if (parent === undefined) continue;
    // Out of the trunk low under the cut, and drawn in toward it or out from it as its kind's roots reach.
    const a: V3 = L[P.parent].order === 0 ? [P.a[0] * 0.8, P.a[1] * 0.8, Math.min(P.a[2], zc * ROOT_UP)] : P.a;
    const b: V3 = [P.b[0] * shape.roots, P.b[1] * shape.roots, P.b[2]];
    // The piece out of a knee starts where the piece to it now ends.
    const from = L[P.parent].order === -1 ? limbs[parent].b : a;
    // A root in one piece is given a knee, as a buttressed one has: its foot's lobes are drawn from the piece out of a knee (`lobesOf`).
    const single = L[P.parent].order === 0 && !L.some((K) => K.order === -1 && K.parent === i);
    let up = parent;
    if (single) {
      limbs.push({ ...P, a: from, b: lerp(from, b, 0.35), parent, ra: P.ra * 0.85, rb: P.ra * 0.7 });
      up = limbs.length - 1;
    }
    kept.set(i, limbs.length);
    limbs.push({ ...P, a: single ? limbs[up].b : from, b, parent: up, ra: P.ra * 0.85, rb: P.rb * 0.85 });
  }
  // Knobs: short, thick stubs where limbs once were, low round the stem and level, each a third of the way on round;
  // smooth, as a branch is (`paintChain`), not furrowed as the stem.
  const R = mulberry32(seed);
  const stem = limbs.filter((l) => l.order === 0);
  for (let k = 0; k < (shape.knobs ?? 0); k++) {
    const a = R() * 0.6 + (k * TAU) / (shape.knobs ?? 1);
    const z = zc * (0.22 + 0.25 * R());
    const at = stem.findIndex((l) => l.b[2] >= z);
    const P = stem[Math.max(0, at)];
    const r = radiusAt(stem, z);
    const d: V3 = [Math.cos(a), Math.sin(a), 0];
    const base: V3 = [P.a[0] + d[0] * r * 0.55, P.a[1] + d[1] * r * 0.55, z];
    limbs.push({ a: base, b: add(base, mul(d, r * 0.62)), ra: r * 0.3, rb: r * 0.26, order: 2, parent: limbs.indexOf(P), bough: -1 });
  }
  const r0 = Math.max(...cuts.map((c) => Math.hypot(c.c[0], c.c[1]) + c.r), 1);
  const reach = Math.max(r0, ...limbs.filter((l) => l.order < 0).map((l) => Math.hypot(l.b[0], l.b[1]) + l.rb));
  return {
    sk: {
      // The crown's reach is what the picture's bounds take in round the foot (`boundsOf`).
      limbs, clumps: [], crown: { c: [0, 0, zc], r: Math.max(reach * 2.1, (r0 * 1.6) / 0.55 + 2), rz: 1 }, height: zc, rune: null, hollow: null,
      rough: tree.rough ? Math.min(tree.rough * k, zc * 0.4) : undefined,
      foot: Math.max(2.5, r0 * ACROSS * 1.12),
    },
    cuts,
  };
}

/** One log lying: from `a` to `b`, `ra` thick at `a` and `rb` at `b`. */
export interface Log {
  a: V3;
  b: V3;
  ra: number;
  rb: number;
}

/**
 * `n` logs (one to three) lying along `angle` on the ground: one; two side
 * by side; or two with a third in the groove on top. Beside a stump, moved
 * off it to one side. Each its own length, a little off the others' ends.
 */
export function logsOf(r: number, length: number, n: number, angle: number, off: number, seed: number): { sk: Skeleton; logs: Log[] } {
  const R = mulberry32(seed);
  const d: V3 = [Math.cos(angle), Math.sin(angle), 0];
  const p: V3 = [-d[1], d[0], 0];
  const at: Array<[number, number]> = n <= 1 ? [[0, 0]] : n === 2 ? [[-1, 0], [1, 0]] : [[-1, 0], [1, 0], [0, 1]];
  const logs: Log[] = at.map(([s, up], i) => {
    const rr = r * (0.88 + 0.2 * R());
    const len = length * (0.84 + 0.22 * R());
    const mid = add(add(mul(p, off + s * r * 1.04), mul(d, (R() - 0.5) * r * 1.2)), [0, 0, rr + up * r * 1.72]);
    const flip = (i + Math.round(R())) % 2 ? 1 : -1;
    const half = mul(d, (len / 2) * flip);
    return { a: sub(mid, half), b: add(mid, half), ra: rr * 1.06, rb: rr * 0.94 };
  });
  const limbs: Limb[] = logs.map((l) => ({ a: l.a, b: l.b, ra: l.ra, rb: l.rb, order: 0, parent: -1, bough: -1 }));
  // And each one's shade on the ground under it, for the picture's bounds only (`boundsOf`): `paintLogs3d` paints the first `logs.length`.
  for (const l of logs) limbs.push({ a: [l.a[0], l.a[1], 0], b: [l.b[0], l.b[1], 0], ra: l.ra * 1.3, rb: l.rb * 1.3, order: 0, parent: -1, bough: -1 });
  const reach = Math.max(...logs.flatMap((l) => [Math.hypot(l.a[0], l.a[1]), Math.hypot(l.b[0], l.b[1])])) + r;
  return { sk: { limbs, clumps: [], crown: { c: [0, 0, r], r: reach, rz: r }, height: r * 2, rune: null, hollow: null }, logs };
}

/** What of a species a stump or a log is painted as: its bark, always on an open foot; no leaf, no crown; moss only where `moss`. */
export function woodSpec(spec: Species3D, trunk: string, moss: boolean, lying = false): Species3D {
  // In its flat stump's own wood (`TREE_DEFS` trunk), lit and shaded as the trees' bark is from theirs; a pale marked
  // bark (`marks`), whose look is its marks, in its tree's.
  const bark: Species3D['bark'] = spec.bark.marks ? spec.bark : {
    ...spec.bark,
    lit: tone(trunk, 0.35), shade: mix(trunk, '#3e3040', 0.3), dead: tone(trunk, 0.5), furrow: mix(trunk, '#2e2230', 0.55),
    ...(spec.bark.strands ? { strands: tone(trunk, 0.5) } : {}),
    ...(spec.bark.rope ? { rope: tone(trunk, 0.5) } : {}),
  };
  return {
    ...spec,
    build: { ...spec.build, whorls: undefined, ...(lying ? { habit: undefined } : {}) },
    open: !lying, haze: false, evergreen: undefined, orchard: undefined, keys: undefined, buds: undefined,
    // A stump's roots flare out of its foot as lobes on the ground, whatever its tree's are (`stumpOf`).
    buttress: lying ? spec.buttress : true,
    bark: {
      ...bark,
      ...(moss ? {} : { moss: undefined }),
      ...(spec.bark.marks ? { marks: { ...spec.bark.marks, fine: MARKS_FINE } } : {}),
    },
  };
}

/** How much light a face turned along `n` catches, 0 to 1, as the bark is lit (`./paint` barkAt). */
const litBy = (job: Job, n: V3): number => clamp01((job.light.ambient + job.light.direct * Math.max(0, dot(n, job.light.sun)) - 0.22) / 0.82);

/** A colour in shade and in the light, at `l`: both hex. */
const lit = (shade: string, light: string, l: number): string => mix(shade, light, l);

/** A sawn face on the screen: its middle, and where a unit of the model goes along each of its two ways across it. */
interface Frame { o: Pt; u: Pt; v: Pt }

/**
 * A stump's top lies flat on the ground's plane, seen as the ground is. A
 * log's end stands square to the log: drawn as wide as the log is drawn
 * across (`ACROSS`, as every limb is), and as deep as it is turned to the eye.
 */
function frameOf(job: Job, cut: Cut): Frame {
  const o = proj(job.e, cut.c);
  if (!cut.side) return { o, u: [job.e.ux, job.e.uy], v: [job.e.vx, job.e.vy] };
  const [nx, ny] = cut.side.n;
  return { o, u: [nx * ACROSS, ny * ACROSS], v: [-ny * ACROSS * cut.side.f, nx * ACROSS * cut.side.f] };
}
const at = (f: Frame, s: number, t: number): Pt => [f.o[0] + f.u[0] * s + f.v[0] * t, f.o[1] + f.u[1] * s + f.v[1] * t];

/** A sawn face's outline at `k` of its radius, its middle moved `off` model units along its two ways. */
function ringPath(f: Frame, r: number, k = 1, off: Pt = [0, 0]): Path2D {
  const p = new Path2D();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    const [x, y] = at(f, off[0] + r * k * Math.cos(t), off[1] + r * k * Math.sin(t));
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

/** A sawn face, its bark round it and its rings: the stump's top or a log's end. */
function paintFace(g: Ctx, job: Job, cut: Cut, wood: { face: string; ring: string }, seed: number): void {
  const { spec } = job;
  const l = litBy(job, cut.n);
  const R = mulberry32(seed);
  const f = frameOf(job, cut);
  // The bark round it, seen edge on.
  g.fillStyle = lit(spec.bark.shade, spec.bark.lit, l * 0.85);
  g.fill(ringPath(f, cut.r));
  // The wood: the pale face, in the bark's shade as the light leaves it.
  const face = lit(mix(wood.face, spec.bark.shade, 0.5), wood.face, l);
  // The rings a step toward the bark's furrows, so they show on a pale wood too.
  const rings = mix(wood.ring, spec.bark.furrow, RING_DARK);
  const ring = lit(mix(rings, spec.bark.shade, 0.5), rings, l);
  g.fillStyle = face;
  g.fill(ringPath(f, cut.r, 0.84));
  // The rings, round a heart a little off the middle, each the further out the more it is drawn toward the edge.
  const ha = R() * TAU, hd = cut.r * 0.14;
  const hs = Math.cos(ha) * hd, ht = Math.sin(ha) * hd;
  const px = cut.r * ACROSS;
  g.strokeStyle = ring;
  g.lineWidth = Math.max(0.32, Math.min(0.55, px * 0.07));
  for (const k of [0.62, 0.38, 0.17]) {
    if (px * k < 0.7) continue;
    g.stroke(ringPath(f, cut.r, k, [hs * (1 - k), ht * (1 - k)]));
  }
  // A check: a crack out from the heart to the bark.
  if (px > 2.2) {
    const a = ha + Math.PI * (0.6 + 0.8 * R());
    const [x0, y0] = at(f, hs, ht);
    const [x1, y1] = at(f, hs + Math.cos(a) * cut.r * 0.7, ht + Math.sin(a) * cut.r * 0.7);
    g.strokeStyle = rgb(mixRgb(hex(ring), KIT_INK, 0.45));
    g.lineWidth = Math.max(0.35, g.lineWidth);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo((x0 + x1) / 2 + (R() - 0.5) * 0.4, (y0 + y1) / 2 + (R() - 0.5) * 0.4);
    g.lineTo(x1, y1);
    g.stroke();
  }
}

/** Moss over the back of a stump's bark rim, on the side turned from the sun: the damp seasons (`Species3D.bark.moss`). */
function paintRimMoss(g: Ctx, job: Job, cut: Cut, moss: string): void {
  const s = job.light.sun;
  const away = Math.atan2(-s[1], -s[0]);
  const p = new Path2D();
  const N = 14;
  const at = (t: number, k: number): Pt => proj(job.e, add(cut.c, [Math.cos(t) * cut.r * k, Math.sin(t) * cut.r * k, 0]));
  for (let i = 0; i <= N; i++) {
    const t = away - 1.3 + (2.6 * i) / N;
    const [x, y] = at(t, 1.02);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const t = away - 1.3 + (2.6 * i) / N;
    p.lineTo(...at(t, 0.8 + 0.07 * Math.sin(i * 2.3) - 0.1 * Math.sin((i / N) * Math.PI)));
  }
  p.closePath();
  g.globalAlpha = 0.8;
  g.fillStyle = moss;
  g.fill(p);
  g.globalAlpha = 1;
}

/** How thick the snow lies on a sawn top, against its radius; and how far in from its edge. */
const SNOW_DEEP = 0.12;
const SNOW_IN = 0.93;
/** Snow's top and its side, as the snow on the trees' wood is lit (`./paint` barkAt). */
const SNOW_TOP = '#f4f7fd';
const SNOW_SIDE = '#c9d3e6';

/** Snow on a sawn top: a cushion a little in from its edge, its top and its front side, and its outline for the ink. */
function capOf(job: Job, cut: Cut): { top: Path2D; side: Path2D } {
  const lift: V3 = [0, 0, cut.r * SNOW_DEEP];
  const N = 28;
  const ring = (z: V3, k: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * TAU;
      out.push(proj(job.e, add(add(cut.c, z), [Math.cos(t) * cut.r * k, Math.sin(t) * cut.r * k, 0])));
    }
    return out;
  };
  const hi = ring(lift, SNOW_IN), lo = ring([0, 0, 0], SNOW_IN + 0.02);
  const top = new Path2D();
  hi.forEach(([x, y], i) => (i ? top.lineTo(x, y) : top.moveTo(x, y)));
  top.closePath();
  // Its side: round the front from one end of the top to the other, between the top's edge and the face.
  const [, cy] = proj(job.e, cut.c);
  const side = new Path2D();
  // From where the rim comes round to the front, on round to where it goes behind again.
  const isFront = (i: number): boolean => lo[i % N][1] >= cy - 0.01;
  let from = 0;
  while (from < N && !(isFront(from) && !isFront(from + N - 1))) from++;
  const front: Array<readonly [Pt, Pt]> = [];
  for (let k = 0; k < N && isFront(from + k); k++) front.push([hi[(from + k) % N], lo[(from + k) % N]]);
  if (front.length > 1) {
    front.forEach(([p], i) => (i ? side.lineTo(p[0], p[1]) : side.moveTo(p[0], p[1])));
    for (let i = front.length - 1; i >= 0; i--) side.lineTo(front[i][1][0], front[i][1][1]);
    side.closePath();
  }
  return { top, side };
}

/** The shade's tone and strength on the ground: one flat shape at one alpha, as the flat stumps' contact shade (`contact`). */
const SHADE = 'rgba(44,74,78,0.2)';
/** The shortest a stump's shade is thrown by day, against its height: as the flat ones', it always falls a little away from the sun. */
const THROW_LEAST = 0.55;

/** Which way and how far the light throws a stump's shade along the ground for each unit up: none at night. */
function throwOf(light: Light): [number, number] {
  if (light.night) return [0, 0];
  const fl = Math.hypot(light.sun[0], light.sun[1]) || 1;
  const t = Math.max(THROW_LEAST, light.throw);
  return [(-light.sun[0] / fl) * t, (-light.sun[1] / fl) * t];
}

/**
 * The stump's model with pieces on the ground out to the end of its shade
 * under `light`, so the picture it is baked into takes it in (`boundsOf`):
 * never painted as wood (`paintStump3d`).
 */
export function thrown(m: StumpModel, light: Light): Skeleton {
  const [dx, dy] = throwOf(light);
  if (!dx && !dy) return m.sk;
  const ends = m.cuts.map((c): Limb => {
    const z = c.c[2];
    const p: V3 = [c.c[0] + dx * z, c.c[1] + dy * z, 0];
    return { a: p, b: p, ra: c.r, rb: c.r, order: 0, parent: -1, bough: -1 };
  });
  return { ...m.sk, limbs: [...m.sk.limbs, ...ends] };
}

/**
 * Its shade on the ground, in the picture under it: round its foot, and
 * thrown away from the sun along its stem to its cut, as the trees' is laid
 * from discs along their wood (`./index` makeShade). It is low and small, so
 * it goes in its own picture, a step of the sun to each, rather than in the
 * shade laid with the ground.
 */
function paintStumpShade(g: Ctx, job: Job, m: StumpModel): void {
  const [dx, dy] = throwOf(job.light);
  const path = new Path2D();
  const disc = (p: V3, r: number): void => {
    const z = Math.max(0, p[2]);
    const [sx, sy] = proj(job.e, [p[0] + dx * z, p[1] + dy * z, 0]);
    const rx = r * ACROSS;
    path.moveTo(sx + rx, sy);
    path.ellipse(sx, sy, rx, rx / 2, 0, 0, TAU);
  };
  const foot = m.sk.foot ?? 4;
  path.moveTo(foot, 0.5);
  path.ellipse(0, 0.5, foot, foot * 0.5, 0, 0, TAU);
  if (dx || dy) {
    for (const L of m.sk.limbs) {
      if (L.order !== 0) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(L.b[0] - L.a[0] + (dx * (L.b[2] - L.a[2])), L.b[1] - L.a[1] + dy * (L.b[2] - L.a[2])) / Math.max(0.5, L.rb)));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        disc(lerp(L.a, L.b, t), L.ra + (L.rb - L.ra) * t);
      }
    }
  }
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = SHADE;
  g.fill(path, 'nonzero');
  g.restore();
}

/**
 * A stump: its foot and buttresses, its trunk banded and inked as its tree's
 * is, and each stem's sawn top, laid back to front; its bark's moss over the
 * rim in the damp seasons, snow capped on the top in winter.
 */
export function paintStump3d(g: Ctx, job: Job, m: StumpModel, wood: { face: string; ring: string }): void {
  const { sk, e, spec } = job;
  const cuts = m.cuts;
  const near = (p: V3): number => dot(p, e.toward as V3);
  // The model's own wood: what `throwOf` added past it is only for the picture's bounds.
  const chains = chainsOf(job, false).filter((c) => c.pieces[0] < m.sk.limbs.length);
  const sawn = new Set(cuts.map((c) => c.limb));
  for (const c of chains) if (sawn.has(c.pieces[c.pieces.length - 1])) c.cut = true;
  const winter = job.dress.season === 'winter';
  const items: Item[] = [];
  // The ink round the whole of it, laid first: what is laid after covers it but at its outline.
  g.strokeStyle = rgb(KIT_INK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = KIT_INK_W * 2;
  for (const c of chains) {
    if (c.thin) continue;
    g.stroke(bandPath(c, 0, c.q.length - 1, -1, 1));
    if (c.cut) continue;
    const [x, y] = c.q[c.q.length - 1];
    g.beginPath();
    g.arc(x, y, c.r[c.r.length - 1] + KIT_INK_W, 0, TAU);
    g.fillStyle = rgb(KIT_INK);
    g.fill();
  }
  for (const cut of cuts) {
    g.stroke(ringPath(frameOf(job, cut), cut.r));
    if (winter) {
      const cap = capOf(job, cut);
      g.stroke(cap.top);
      g.stroke(cap.side);
    }
  }
  // Each stem's foot, round on the ground, and the buttresses out of it.
  for (const trunk of chains.filter((c) => c.order === 0 && sk.limbs[c.pieces[0]].parent < 0)) {
    const at = trunk.pieces[0];
    const foot = footOf(job, at);
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(foot.base);
    items.push({ d: near(sk.limbs[at].a) - 0.6, draw: () => paintFoot(g, foot, trunk) });
    foot.lobes.forEach(([a, out], k) => {
      const b = buttress(job, a, out, k);
      items.push({ d: near(b.at) - 0.5, draw: () => b.draw(g) });
    });
  }
  for (const c of chains) {
    const R = mulberry32(job.seed + c.pieces[0] * 13);
    const L0 = sk.limbs[c.pieces[0]], L1 = sk.limbs[c.pieces[c.pieces.length - 1]];
    // Roots under the stem they come out of: it covers where they leave it, and they run out from under it.
    items.push({ d: near(lerp(L0.a, L1.b, 0.5)) - (c.order < 0 ? 1e5 : 0.5), draw: () => paintChain(g, job, c, 0, c.q.length - 1, R) });
  }
  cuts.forEach((cut, i) => {
    items.push({
      d: near(cut.c) + 0.25,
      draw: () => {
        paintFace(g, job, cut, wood, job.seed + i * 977);
        if (spec.bark.moss) paintRimMoss(g, job, cut, spec.bark.moss);
        if (winter) {
          const cap = capOf(job, cut);
          g.fillStyle = SNOW_SIDE;
          g.fill(cap.side);
          g.fillStyle = SNOW_TOP;
          g.fill(cap.top);
          g.strokeStyle = SNOW_EDGE;
          g.lineWidth = Math.max(0.35, cut.r * ACROSS * 0.05);
          g.stroke(cap.side);
        }
      },
    });
  });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  paintStumpShade(g, job, m);
}

/**
 * Logs lying on the ground: each its own contact shade under it, inked
 * round, its far end's bark showing past it, its body banded and marked as
 * its tree's trunk is, and its near end sawn, with its rings; laid back to front.
 */
export function paintLogs3d(g: Ctx, job: Job, logs: Log[], wood: { face: string; ring: string }): void {
  const { e } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  const chains = chainsOf(job, false);
  const toward = unit(e.toward as V3);
  // The shade each lays on the ground under it, under everything, in the trees' foot shade's tone.
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = SHADE;
  for (const l of logs) {
    if (l.a[2] > l.ra * 1.5) continue;
    const d = unit(sub(l.b, l.a));
    const p: V3 = [-d[1], d[0], 0];
    const path = new Path2D();
    const N = 10;
    const ring: V3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / N;
      ring.push(add([l.b[0], l.b[1], 0], add(mul(d, Math.cos(t) * l.rb * 0.7), mul(p, Math.sin(t) * l.rb * 1.25))));
    }
    for (let i = 0; i <= N; i++) {
      const t = Math.PI / 2 + (Math.PI * i) / N;
      ring.push(add([l.a[0], l.a[1], 0], add(mul(d, Math.cos(t) * l.ra * 0.7), mul(p, Math.sin(t) * l.ra * 1.25))));
    }
    ring.forEach((q, i) => (i ? path.lineTo(...proj(e, q)) : path.moveTo(...proj(e, q))));
    path.closePath();
    g.fill(path);
  }
  g.restore();
  const items: Item[] = [];
  chains.forEach((c: Chain) => {
    const L = job.sk.limbs[c.pieces[0]];
    const l = logs[c.pieces[0]];
    if (!l) return;
    c.cut = true;
    const d = unit(sub(l.b, l.a));
    // The end turned to the eye shows its face; the other, its bark round past the body.
    const bNear = dot(d, toward) >= 0;
    // As far as an end is turned to the eye, square on it a circle and edge on a line.
    const f = Math.max(0.3, Math.min(0.85, Math.abs(dot(d, toward)) * 1.6));
    const last = c.q.length - 1;
    const ends: Cut[] = [
      { c: l.a, r: l.ra, n: mul(d, -1), limb: c.pieces[0], side: { n: c.n[0], f } },
      { c: l.b, r: l.rb, n: d, limb: c.pieces[0], side: { n: c.n[last], f } },
    ];
    const [farEnd, nearEnd] = bNear ? ends : [ends[1], ends[0]];
    const R = mulberry32(job.seed + c.pieces[0] * 13);
    items.push({
      d: near(lerp(L.a, L.b, 0.5)),
      draw: () => {
        g.strokeStyle = rgb(KIT_INK);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.lineWidth = KIT_INK_W * 2;
        g.stroke(bandPath(c, 0, c.q.length - 1, -1, 1));
        const farPath = ringPath(frameOf(job, farEnd), farEnd.r);
        const nearPath = ringPath(frameOf(job, nearEnd), nearEnd.r);
        g.stroke(farPath);
        g.stroke(nearPath);
        // The far end: the body's bands carried round it.
        g.fillStyle = c.cols[1];
        g.fill(farPath);
        g.save();
        g.clip(farPath);
        g.fillStyle = c.cols[0];
        g.fill(bandPath(c, 0, c.q.length - 1, -2.5, -0.36));
        g.fillStyle = c.cols[2];
        g.fill(bandPath(c, 0, c.q.length - 1, 0.34, 2.5));
        g.restore();
        paintChain(g, job, c, 0, c.q.length - 1, R);
        paintFace(g, job, nearEnd, wood, job.seed + c.pieces[0] * 977);
      },
    });
  });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}
