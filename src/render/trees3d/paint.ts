/**
 * A tree's solid painted from one eye under one light: its wood as tapering
 * round limbs, lit across their width and furrowed, its leaf as clumps shaded
 * as spheres and edged in the species' own leaf, everything laid back to
 * front, and the whole ruled round in the kit's ink.
 *
 * Drawn in pixels at zoom one, the foot at the origin, as a kit piece is.
 */
import { HALF_W, HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import { KIT_INK, KIT_INK_W } from '../kit/core';
import { cut, glyphPath, proj, type Eye } from '../runestone';
import { mulberry32 } from '../../world/noise';
import type { Light } from './light';
import type { Clump, Dress, Leaf, Limb, Ramp, RGB, Skeleton, Species3D, V3 } from './types';
import { add, cross, dot, hex, len, lerp, mixRgb, mul, rgb, sub, unit } from './vec';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;

/** Pixels at zoom one a unit across something round comes to: a ground circle's half-width on the screen. */
export const ACROSS = (HALF_W * Math.SQRT2) / UNITS_PER_TILE;

/** The screen direction a world vector goes, at zoom one. */
const projVec = (e: Eye, v: V3): Pt => [v[0] * e.ux + v[1] * e.vx, v[0] * e.uy + v[1] * e.vy - v[2] * HEIGHT_SCALE];
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export interface Job {
  sk: Skeleton;
  spec: Species3D;
  dress: Dress;
  light: Light;
  e: Eye;
  seed: number;
  /** Which of the wind's frames, for what is in the air. */
  frame: number;
}

/* ---- what is shown ------------------------------------------------------------- */

/**
 * A spray as a day shows it: the leaves it has out, the ramp they are
 * painted on -- and in autumn the ramps of its underside and its top, deeper
 * red under and gold over -- and how far grown its leaves are.
 */
export interface Shown { c: Clump; leaves: Leaf[]; ramp: Ramp; under: Ramp; over: Ramp; grown: number }

function rampMix(a: Ramp, b: Ramp, t: number): Ramp {
  return a.map((c, i) => rgbHex(mixRgb(hex(c), hex(b[i] ?? b[b.length - 1]), t)));
}
const rgbHex = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Autumn's colour at `t`: crimson at nought, orange at a half, gold at one. */
function autumnAt(spec: Species3D, t: number): Ramp {
  const [crimson, orange, gold] = spec.leaf.autumn;
  const u = clamp01(t);
  return u < 0.5 ? rampMix(crimson, orange, u * 2) : rampMix(orange, gold, (u - 0.5) * 2);
}
/** Where on autumn's colours a spray is: crimson at the top of the crown, gold out at its rim and underside. */
const autumnT = (c: Clump): number => 1.45 * (1 - c.up) - 0.2 + (c.k - 0.5) * 0.3;

/** The order a spray turns in autumn: the top of the crown and its outside first. */
const turnOrder = (c: Clump): number => 0.55 * (1 - c.up) + 0.25 * (1 - c.out) + 0.35 * c.k;

export function shownOf(job: Job): Shown[] {
  const { sk, spec, dress } = job;
  const out: Shown[] = [];
  if (dress.full <= 0) return out;
  const spring = dress.season === 'spring';
  const keepAll = (r: Ramp): Pick<Shown, 'ramp' | 'under' | 'over'> => ({ ramp: r, under: r, over: r });
  for (const c of sk.clumps) {
    let look = keepAll(spec.leaf.summer);
    let grown = 1;
    let share = 1;
    if (spring && dress.step === 0) {
      // Before the leaf: the red flower in small tufts over the bare crown.
      if (c.k > 0.75) continue;
      look = keepAll(spec.leaf.bud);
      grown = 0.6;
      share = 0.35;
    } else if (spring && dress.full < 1) {
      // The leaf coming out, small, among the last of the flower.
      grown = 0.65 + 0.3 * dress.full;
      share = dress.full;
      look = { ramp: spec.leaf.spring, under: spec.leaf.bud, over: spec.leaf.spring };
    } else if (spring) {
      look = keepAll(spec.leaf.spring);
    } else if (dress.season === 'autumn') {
      share = dress.full;
      const o = turnOrder(c) / 1.15;
      const t = autumnT(c);
      if (dress.turned >= 1 || o < dress.turned) look = { ramp: autumnAt(spec, t), under: autumnAt(spec, t - 0.45), over: autumnAt(spec, t + 0.45) };
      else if (o < dress.turned + 0.15) look = { ramp: spec.leaf.summer, under: spec.leaf.summer, over: autumnAt(spec, t + 0.3) };
    }
    const leaves = share >= 1 ? c.leaves : c.leaves.filter((l) => l.k < share);
    if (leaves.length) out.push({ c, leaves, ...look, grown });
  }
  return out;
}

/* ---- a leaf ---------------------------------------------------------------------- */

/** One small leaf lying or flying: a five-pointed maple leaf `s` across, turned `a`, squashed `flat` top to bottom. */
function leafAt(g: Ctx | Path2D, x: number, y: number, s: number, a: number, flat = 1): void {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const t = a + (i / 10) * TAU - Math.PI / 2;
    const r = i % 2 === 0 ? (i === 0 ? 1 : i === 2 || i === 8 ? 0.85 : 0.6) : 0.36;
    pts.push([x + Math.cos(t) * r * s, y + Math.sin(t) * r * s * flat]);
  }
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath();
}

/* ---- wood -------------------------------------------------------------------------- */

function barkAt(job: Job, L: Limb, n: V3, snow: boolean): string {
  const { light, spec } = job;
  const lam = Math.max(0, dot(n, light.sun));
  const l = clamp01((light.ambient + light.direct * lam - 0.22) / 0.82);
  const lit = hex(L.dead ? spec.bark.dead : spec.bark.lit);
  const shade = hex(spec.bark.shade);
  if (snow && n[2] > 0.42) return rgb(mixRgb(hex('#c9d3e6'), hex('#fbfcff'), l));
  return rgb(mixRgb(shade, lit, l));
}

/**
 * A run of limb pieces drawn as one curved, tapering limb: where it runs on
 * the screen, how thick it is at each point, the way across it at each point
 * (the two pieces either side of a point agreeing on it, so the limb bends
 * without a kink), and its colours across its width.
 */
interface Chain {
  pieces: number[];
  q: Pt[];
  r: number[];
  n: Pt[];
  /** Its colours from one side to the other, in `CHAIN_BANDS`, and the snow's where it lies. */
  cols: string[];
  snow: [number, number] | null;
  /** How far along its first piece its ink starts: clear of what it grows out of. */
  skip: number;
  order: number;
  thin: boolean;
}

/** Bands across a limb, from one side to the other: the shade side, the middle, the lit side. */
const CHAIN_BANDS: ReadonlyArray<[number, number, number]> = [[-1, -0.36, -0.7], [-0.36, 0.34, 0], [0.34, 1, 0.66]];

function chainsOf(job: Job, leafy: boolean): Chain[] {
  const { sk, e } = job;
  const limbs = sk.limbs;
  // A piece goes on from its parent when it starts where its parent ends, at the same order.
  const next = new Map<number, number>();
  const goesOn = (i: number): boolean => {
    const L = limbs[i];
    if (L.parent < 0) return false;
    const P = limbs[L.parent];
    return P.order === L.order && len(sub(L.a, P.b)) < 1e-6;
  };
  for (let i = 0; i < limbs.length; i++) if (goesOn(i)) next.set(limbs[i].parent, i);
  const V = unit(e.toward as V3);
  const snowy = job.dress.season === 'winter';
  const out: Chain[] = [];
  for (let i = 0; i < limbs.length; i++) {
    if (goesOn(i)) continue;
    const first = limbs[i];
    // Under a full crown the finest twigs are never seen.
    if (leafy && first.order >= 4) continue;
    const pieces = [i];
    for (let k = next.get(i); k !== undefined; k = next.get(k)) pieces.push(k);
    const pts: V3[] = [limbs[pieces[0]].a, ...pieces.map((k) => limbs[k].b)];
    const rs = [limbs[pieces[0]].ra, ...pieces.map((k) => limbs[k].rb)].map((r) => Math.max(0.24, r * ACROSS));
    const q = pts.map((p) => proj(e, p));
    const n: Pt[] = q.map((_, j) => {
      const a = q[Math.max(0, j - 1)], b = q[Math.min(q.length - 1, j + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    // Lit across its width as a round limb is, from its middle piece.
    const mid = limbs[pieces[Math.floor(pieces.length / 2)]];
    const D = unit(sub(mid.b, mid.a));
    let P = cross(D, V);
    P = len(P) < 1e-4 ? [1, 0, 0] : unit(P);
    const pv = projVec(job.e, P);
    const nm = n[Math.floor(n.length / 2)];
    if (pv[0] * nm[0] + pv[1] * nm[1] < 0) P = mul(P, -1);
    const Vp = unit(sub(V, mul(D, dot(V, D))));
    const normal = (s: number): V3 => unit(add(mul(P, s), mul(Vp, Math.sqrt(Math.max(0, 1 - s * s)))));
    const cols = CHAIN_BANDS.map(([, , s]) => barkAt(job, mid, normal(s), false));
    let snow: [number, number] | null = null;
    if (snowy && Math.abs(D[2]) < 0.6) {
      const on: number[] = [];
      for (let s = -0.95; s <= 0.951; s += 0.1) if (normal(s)[2] > 0.62) on.push(s);
      if (on.length) snow = [Math.max(-1, on[0] - 0.05), Math.min(1, on[on.length - 1] + 0.05)];
    }
    const par = first.parent >= 0 && first.order > 0 ? limbs[first.parent] : null;
    const l0 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) || 1;
    out.push({
      pieces, q, r: rs, n, cols, snow, order: first.order,
      skip: par ? Math.min(0.7, (par.rb * ACROSS * 1.1) / l0) : 0,
      thin: Math.max(...rs) < 0.75,
    });
  }
  return out;
}

/** Part of a chain, points `j0` to `j1`: a band of it from `s0` to `s1` across, as a path. */
function bandPath(c: Chain, j0: number, j1: number, s0: number, s1: number): Path2D {
  const p = new Path2D();
  for (let j = j0; j <= j1; j++) {
    const x = c.q[j][0] + c.n[j][0] * c.r[j] * s1, y = c.q[j][1] + c.n[j][1] * c.r[j] * s1;
    if (j === j0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  for (let j = j1; j >= j0; j--) p.lineTo(c.q[j][0] + c.n[j][0] * c.r[j] * s0, c.q[j][1] + c.n[j][1] * c.r[j] * s0);
  p.closePath();
  return p;
}

/** Points `j0` to `j1` of a chain (its pieces `j0` to `j1 - 1`): banded, ink down its sides, furrowed. */
function paintChain(g: Ctx, job: Job, c: Chain, j0: number, j1: number, R: () => number): void {
  if (c.thin) {
    // A twig is a line: the colour of its middle.
    g.strokeStyle = c.cols[1];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = c.r[j0] + c.r[j1];
    g.beginPath();
    for (let j = j0; j <= j1; j++) (j === j0 ? g.moveTo(c.q[j][0], c.q[j][1]) : g.lineTo(c.q[j][0], c.q[j][1]));
    g.stroke();
    if (c.snow) {
      g.strokeStyle = 'rgba(250,252,255,0.9)';
      g.lineWidth = (c.r[j0] + c.r[j1]) * 0.5;
      g.beginPath();
      for (let j = j0; j <= j1; j++) (j === j0 ? g.moveTo(c.q[j][0], c.q[j][1] - c.r[j] * 0.5) : g.lineTo(c.q[j][0], c.q[j][1] - c.r[j] * 0.5));
      g.stroke();
    }
    return;
  }
  CHAIN_BANDS.forEach(([s0, s1], i) => {
    g.fillStyle = c.cols[i];
    g.fill(bandPath(c, j0, j1, i === 0 ? s0 : s0 - 0.04, i === 2 ? s1 : s1 + 0.04));
  });
  if (c.snow) {
    g.fillStyle = '#f4f7fd';
    g.fill(bandPath(c, j0, j1, c.snow[0], c.snow[1]));
  }
  // The open end of a limb rounded off.
  if (j1 === c.q.length - 1) {
    g.fillStyle = c.cols[1];
    g.beginPath();
    g.arc(c.q[j1][0], c.q[j1][1], c.r[j1], 0, TAU);
    g.fill();
  }
  // Furrows down the bark of the trunk and the big limbs.
  const rm = Math.max(c.r[j0], c.r[j1]);
  if (rm > 2.2 && c.order <= 1) {
    g.strokeStyle = job.spec.bark.furrow;
    g.globalAlpha = c.order < 0 ? 0.35 : 0.5;
    g.lineWidth = 0.42;
    g.beginPath();
    const n = Math.min(6, Math.floor(rm / 1.3));
    for (let i = 0; i < n; i++) {
      const s = -0.75 + (1.5 * (i + 0.5)) / n + (R() - 0.5) * 0.18;
      for (let j = j0; j <= j1; j++) {
        const w = (R() - 0.5) * 0.45;
        const x = c.q[j][0] + c.n[j][0] * (s * c.r[j] + w), y = c.q[j][1] + c.n[j][1] * (s * c.r[j] + w);
        if (j === j0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  // Its two sides in ink, from clear of whatever it grows out of.
  g.strokeStyle = rgb(KIT_INK, 0.85);
  g.lineWidth = KIT_INK_W * 0.75;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  for (const side of [1, -1]) {
    for (let j = j0; j <= j1; j++) {
      let x = c.q[j][0] + c.n[j][0] * c.r[j] * side, y = c.q[j][1] + c.n[j][1] * c.r[j] * side;
      if (j === 0 && c.skip > 0) {
        const t = c.skip;
        const r = c.r[0] + (c.r[1] - c.r[0]) * t;
        x = c.q[0][0] + (c.q[1][0] - c.q[0][0]) * t + c.n[0][0] * r * side;
        y = c.q[0][1] + (c.q[1][1] - c.q[0][1]) * t + c.n[0][1] * r * side;
      }
      if (j === j0) g.moveTo(x, y); else g.lineTo(x, y);
    }
  }
  g.stroke();
}

/* ---- leaf -------------------------------------------------------------------------- */

/** The sun's way across the screen, and how much of a ball facing the eye it lights: 0 lit from behind to 1 from the front. */
function sunOnScreen(job: Job): { sx: number; sy: number; front: number } {
  const { e, light } = job;
  const v = projVec(e, light.sun);
  const l = Math.hypot(v[0], v[1]) || 1;
  const V = unit(e.toward as V3);
  return { sx: v[0] / l, sy: v[1] / l, front: (1 + dot(V, light.sun)) / 2 };
}

function clumpLight(job: Job, c: Clump): number {
  const { sk, light, e } = job;
  const env = sk.crown;
  const n = unit([(c.c[0] - env.c[0]) / env.r, (c.c[1] - env.c[1]) / env.r, (c.c[2] - env.c[2]) / env.rz * 0.8]);
  const wrap = clamp01((dot(n, light.sun) + 0.3) / 1.3);
  const V = unit(e.toward as V3);
  // Deep in the crown, low under it, or turned away from the eye: in the crown's own shade.
  const occ = (0.45 + 0.55 * Math.pow(c.out, 1.4)) * (0.72 + 0.28 * c.up) * (1 + 0.3 * Math.min(0, dot(n, V)));
  return (light.ambient + light.direct * wrap) * occ;
}

/**
 * A spray: its leaves, each a small five-pointed leaf, laid from its
 * underside up -- first all of them a step deeper and a little lower, the
 * shade the spray throws on itself, then each in the tone its place on the
 * spray and the spray's place in the crown give it: the tops toward the sun
 * lit, the undersides in shade.
 */
function paintClump(g: Ctx, job: Job, s: Shown, sun: { sx: number; sy: number; front: number }): void {
  const { c } = s;
  const e = job.e;
  const L = clumpLight(job, c);
  const top = s.ramp.length - 1;
  const sz = job.spec.leafSize * ACROSS * s.grown;
  const [cx, cy] = proj(e, c.c);
  const span = c.r * ACROSS || 1;
  const back = new Path2D();
  const groups = new Map<number, Path2D>();
  const flutter = job.frame * 0.35;
  for (const lf of s.leaves) {
    const [x, y] = proj(e, add(c.c, lf.p));
    const a = lf.a + flutter * (lf.k - 0.5);
    leafAt(back, x, y + sz * 0.45, sz * lf.s * 1.18, a, 0.72);
    const side = ((x - cx) * sun.sx + (y - cy) * sun.sy) / span;
    const lit = L * (0.78 + 0.6 * lf.top) + 0.14 * side;
    const idx = Math.max(1, Math.min(top, Math.round(lit * (top - 0.4))));
    const which = lf.top > 0.62 ? 2 : lf.top < 0.3 ? 0 : 1;
    const key = idx * 3 + which;
    let p = groups.get(key);
    if (!p) groups.set(key, (p = new Path2D()));
    leafAt(p, x, y, sz * lf.s, a, 0.72);
  }
  const base = Math.max(0, Math.min(top - 1, Math.round(L * (top - 0.4)) - 1));
  g.fillStyle = s.under[base];
  g.fill(back);
  for (const key of [...groups.keys()].sort((p, q) => p - q)) {
    const which = key % 3;
    g.fillStyle = (which === 0 ? s.under : which === 2 ? s.over : s.ramp)[(key - which) / 3];
    g.fill(groups.get(key)!);
  }
}

/** Winged keys hanging in a bunch from under a clump: pairs of wings on short stalks. */
function paintKeys(g: Ctx, x: number, y: number, size: number, n: number, colour: string, R: () => number): void {
  const wing = hex(colour);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = x + (R() - 0.5) * size * 1.4;
    const drop = size * (0.5 + 0.7 * R());
    const sy = y + drop;
    g.strokeStyle = rgb(mixRgb(wing, KIT_INK, 0.5));
    g.lineWidth = 0.3;
    g.beginPath();
    g.moveTo(x + (sx - x) * 0.3, y);
    g.lineTo(sx, sy);
    g.stroke();
    const spread = 0.5 + 0.3 * R();
    const tilt = (R() - 0.5) * 0.5;
    for (const side of [-1, 1]) {
      const a = Math.PI / 2 + side * spread + tilt;
      const L = size * 0.9;
      const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
      const nx = -Math.sin(a) * L * 0.28, ny = Math.cos(a) * L * 0.28;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + (ex - sx) * 0.5 + nx, sy + (ey - sy) * 0.5 + ny, ex, ey);
      g.quadraticCurveTo(sx + (ex - sx) * 0.4 - nx * 0.2, sy + (ey - sy) * 0.4 - ny * 0.2, sx, sy);
      g.fillStyle = rgb(mixRgb(wing, [255, 250, 235], side > 0 ? 0.25 : 0));
      g.fill();
      g.strokeStyle = rgb(mixRgb(wing, KIT_INK, 0.55), 0.8);
      g.lineWidth = 0.3;
      g.stroke();
    }
    g.fillStyle = rgb(mixRgb(wing, hex('#7a5a40'), 0.5));
    g.beginPath();
    g.arc(sx, sy, size * 0.14, 0, TAU);
    g.fill();
  }
}

/* ---- the ground at its foot ---------------------------------------------------------- */

function paintLitter(g: Ctx, job: Job, R: () => number): void {
  const { dress, spec, sk } = job;
  const n = dress.litter;
  if (n <= 0) return;
  const reach = Math.min(16, sk.crown.r * 0.55);
  const autumn = dress.season === 'autumn';
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const d = reach * Math.sqrt(0.08 + 0.92 * R());
    const p: V3 = [Math.cos(a) * d, Math.sin(a) * d, 0];
    const [x, y] = proj(job.e, p);
    if (autumn) {
      const ramp = spec.leaf.autumn[Math.floor(R() * 3)];
      g.fillStyle = ramp[3 + Math.floor(R() * 3)];
      g.beginPath();
      leafAt(g, x, y, 1.5 + R(), R() * TAU, 0.5);
      g.fill();
      g.strokeStyle = rgb(KIT_INK, 0.45);
      g.lineWidth = 0.3;
      g.stroke();
    } else if (spec.keys) {
      g.fillStyle = spec.keys.ripe;
      g.beginPath();
      const t = R() * TAU;
      g.ellipse(x, y, 1.4, 0.5, t, 0, TAU);
      g.ellipse(x + Math.cos(t + 1) * 1.2, y + Math.sin(t + 1) * 0.6, 1.3, 0.45, t + 1, 0, TAU);
      g.fill();
    }
  }
}

/** Leaves on their way down, somewhere under the crown; where, by the wind's frame. */
function paintFalling(g: Ctx, job: Job, n: number): void {
  const R = mulberry32(job.seed * 31 + job.frame * 7919);
  const { sk, spec } = job;
  const low = sk.crown.c[2] - sk.crown.rz;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = sk.crown.r * (0.3 + 0.6 * R());
    const p: V3 = [Math.cos(a) * d, Math.sin(a) * d, low * (0.15 + 0.7 * R())];
    const [x, y] = proj(job.e, p);
    g.fillStyle = spec.leaf.autumn[Math.floor(R() * 3)][4];
    g.beginPath();
    leafAt(g, x, y, 1.2, R() * TAU, 0.45 + 0.5 * R());
    g.fill();
    g.strokeStyle = rgb(KIT_INK, 0.6);
    g.lineWidth = 0.3;
    g.stroke();
  }
}

/* ---- carving --------------------------------------------------------------------------- */

/** A point on the trunk's skin at height `z` facing `az`, and whether the eye sees it. */
function onTrunk(job: Job, z: number, az: number): { p: V3; n: V3; seen: number; r: number } | null {
  const trunk = job.sk.limbs.filter((l) => l.order === 0);
  const L = trunk.find((l) => l.a[2] <= z && l.b[2] >= z);
  if (!L) return null;
  const t = (z - L.a[2]) / Math.max(1e-6, L.b[2] - L.a[2]);
  const axis = lerp(L.a, L.b, t);
  const r = L.ra + (L.rb - L.ra) * t;
  const n: V3 = [Math.cos(az), Math.sin(az), 0];
  const seen = dot(n, unit(job.e.toward as V3));
  return { p: add(axis, mul(n, r * 0.92)), n, seen, r };
}

function paintCarving(g: Ctx, job: Job): void {
  const { sk, spec, e } = job;
  if (sk.hollow !== null) {
    const at = onTrunk(job, sk.height * 0.2, sk.hollow);
    if (at && at.seen > 0.15) {
      const [x, y] = proj(e, at.p);
      const w = at.r * ACROSS * 0.55 * at.seen;
      g.fillStyle = rgb(mixRgb(hex(spec.bark.shade), hex('#2a2030'), 0.6));
      g.beginPath();
      g.ellipse(x, y, w, at.r * HEIGHT_SCALE * 0.7, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgb(KIT_INK);
      g.lineWidth = KIT_INK_W * 0.7;
      g.stroke();
    }
  }
  if (sk.rune !== null) {
    const at = onTrunk(job, sk.height * 0.12, sk.rune);
    if (at && at.seen > 0.3) {
      const [x, y] = proj(e, at.p);
      const tan: V3 = [-at.n[1], at.n[0], 0];
      const [tx, ty] = projVec(e, tan);
      const s = at.r * 0.5;
      g.save();
      g.transform(tx * s, ty * s, 0, -HEIGHT_SCALE * s, x, y);
      const lam = Math.max(0, dot(at.n, job.light.sun));
      const face = mixRgb(hex(spec.bark.shade), hex(spec.bark.lit), clamp01((job.light.ambient + job.light.direct * lam - 0.22) / 0.82));
      cut(g, face, 0.3, () => glyphPath(g, 'algiz', 0, 0, 1));
      g.restore();
    }
  }
}

/* ---- the whole ---------------------------------------------------------------------------- */

type Item = { d: number; draw: () => void };

export function paintTree3d(g: Ctx, job: Job): void {
  const { sk, e, dress, spec } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  paintLitter(g, job, mulberry32(job.seed + 5));
  const shown = shownOf(job);
  const sun = sunOnScreen(job);
  const items: Item[] = [];
  const leafy = shown.length > 0 && dress.full >= 0.6;
  // The wood, a few pieces of a limb at a time, so each run is laid in its own place among the leaf.
  for (const c of chainsOf(job, leafy)) {
    const per = c.order <= 0 ? 8 : 2;
    for (let j0 = 0; j0 < c.q.length - 1; j0 += per) {
      const j1 = Math.min(c.q.length - 1, j0 + per);
      const L0 = sk.limbs[c.pieces[j0]], L1 = sk.limbs[c.pieces[j1 - 1]];
      const R = mulberry32(job.seed + c.pieces[j0] * 13);
      items.push({ d: near(lerp(L0.a, L1.b, 0.5)) + (c.order <= 0 ? -0.5 : 0), draw: () => paintChain(g, job, c, j0, j1, R) });
    }
  }
  const sizeOfKey = sk.crown.r * 0.12;
  const keyed = spec.keys && dress.keys && ((dress.season === 'spring' && dress.step >= 3) || dress.season === 'summer');
  for (const s of shown) {
    items.push({
      d: near(s.c.c),
      draw: () => {
        paintClump(g, job, s, sun);
        if (keyed && s.c.up < 0.5 && s.c.k < 0.3) {
          const [x, y] = proj(e, s.c.c);
          const col = dress.season === 'summer' ? mixRgbHex(spec.keys!.colour, spec.keys!.ripe, 0.2) : spec.keys!.colour;
          paintKeys(g, x + (s.c.k - 0.2) * 6, y + s.c.r * ACROSS * 0.55, sizeOfKey * ACROSS * 0.4, 2 + Math.floor(s.c.k * 8), col, mulberry32(job.seed + Math.round(s.c.k * 1e5)));
        }
      },
    });
  }
  // Red buds on every tip, the first days of spring, before the leaf is out.
  if (spec.buds && dress.season === 'spring' && dress.full < 1) {
    for (const L of sk.limbs) {
      if (!L.tip || L.dead) continue;
      items.push({
        d: near(L.b) + 0.01,
        draw: () => {
          const [x, y] = proj(e, L.b);
          g.fillStyle = spec.buds!;
          g.beginPath();
          g.arc(x, y, 0.75, 0, TAU);
          g.fill();
        },
      });
    }
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  paintCarving(g, job);
  if (dress.season === 'autumn' && dress.full < 1 && dress.full > 0) paintFalling(g, job, 4);
}

const mixRgbHex = (a: string, b: string, t: number): string => rgbHex(mixRgb(hex(a), hex(b), t));

/** What a tree covers from an eye, in pixels at zoom one from its foot: left, top, right, bottom. */
export function boundsOf(sk: Skeleton, e: Eye): [number, number, number, number] {
  let x0 = -12, y0 = -12, x1 = 12, y1 = 10;
  const take = (p: V3, r: number): void => {
    const [x, y] = proj(e, p);
    const rr = r * ACROSS * 1.15;
    x0 = Math.min(x0, x - rr); x1 = Math.max(x1, x + rr);
    y0 = Math.min(y0, y - rr); y1 = Math.max(y1, y + rr);
  };
  for (const L of sk.limbs) { take(L.a, L.ra); take(L.b, L.rb); }
  for (const c of sk.clumps) take(c.c, c.r * 1.45);
  // The litter round its foot.
  const reach = Math.min(16, sk.crown.r * 0.55) + 2;
  for (const a of [0, 1, 2, 3]) take([Math.cos(a * Math.PI / 2) * reach, Math.sin(a * Math.PI / 2) * reach, 0], 1);
  return [Math.floor(x0 - 4), Math.floor(y0 - 8), Math.ceil(x1 + 4), Math.ceil(y1 + 6)];
}

/**
 * The ink round the whole tree: its own shape in the kit's ink, laid under it
 * one ink's width out every way, so all that shows is a rim.
 */
export function inkRound(cv: HTMLCanvasElement, w: number): void {
  const ink = document.createElement('canvas');
  ink.width = cv.width;
  ink.height = cv.height;
  const k = ink.getContext('2d');
  const g = cv.getContext('2d');
  if (!k || !g) return;
  k.drawImage(cv, 0, 0);
  k.globalCompositeOperation = 'source-in';
  k.fillStyle = rgb(KIT_INK);
  k.fillRect(0, 0, ink.width, ink.height);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-over';
  const d = w * 0.7071;
  for (const [x, y] of [[w, 0], [-w, 0], [0, w], [0, -w], [d, d], [-d, d], [d, -d], [-d, -d]]) g.drawImage(ink, x, y);
  g.restore();
}

/** The soft shade right at its foot, laid under everything else. */
export function footShade(g: Ctx, sk: Skeleton): void {
  const r = Math.max(4, (sk.limbs[0]?.ra ?? 2) * ACROSS * 2.6);
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = 'rgba(44,74,78,0.2)';
  g.beginPath();
  g.ellipse(0, 0.5, r, r * 0.5, 0, 0, TAU);
  g.fill();
  g.restore();
}
