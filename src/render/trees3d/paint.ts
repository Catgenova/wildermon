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
import { cut, glyphPath, proj, RUNE_EDGE, RUNE_GOLD, RUNE_WHITE, type Eye } from '../runestone';
import { mulberry32 } from '../../world/noise';
import type { Light } from './light';
import type { Clump, Dress, Limb, Ramp, RGB, Skeleton, Species3D, V3 } from './types';
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
 * A mass as a day shows it: the ramp it is painted on -- in autumn, the ramp
 * of its top and of its underside too -- and how far grown it is.
 */
export interface Shown { c: Clump; ramp: Ramp; under: Ramp; over: Ramp; grown: number }

function rampMix(a: Ramp, b: Ramp, t: number): Ramp {
  return a.map((c, i) => rgbHex(mixRgb(hex(c), hex(b[i] ?? b[b.length - 1]), t)));
}
const rgbHex = (c: RGB): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Autumn's colour at `t`: the crown's top at nought, through the summer leaf, to gold at one. */
function autumnAt(spec: Species3D, t: number): Ramp {
  const [top, mid, rim] = spec.leaf.autumn;
  const u = clamp01(t);
  return u < 0.5 ? rampMix(top, mid, u * 2) : rampMix(mid, rim, (u - 0.5) * 2);
}
/** Where on autumn's colours a mass is: its own colour at the top of the crown, toward gold low and out at the rim. */
const autumnT = (c: Clump): number => 1.3 * (1 - c.up) - 0.15 + (c.k - 0.5) * 0.3;

/** The order a mass turns in autumn and goes bare in: the top of the crown and its outside first. */
const turnOrder = (c: Clump): number => 0.55 * (1 - c.up) + 0.25 * (1 - c.out) + 0.35 * c.k;

export function shownOf(job: Job): Shown[] {
  const { sk, spec, dress } = job;
  const out: Shown[] = [];
  if (dress.full <= 0) return out;
  const one = (r: Ramp): Pick<Shown, 'ramp' | 'under' | 'over'> => ({ ramp: r, under: r, over: r });
  for (const c of sk.clumps) {
    let look = one(spec.leaf.summer);
    let grown = 1;
    // Coming out in spring and coming down in autumn, every mass is there: those not yet out, or nearly bare, small.
    if (dress.full < 1) grown = c.k < dress.full ? 0.72 + 0.28 * dress.full : 0.4 + 0.15 * dress.full;
    if (dress.season === 'spring') {
      look = one(spec.leaf.spring);
    } else if (dress.season === 'autumn') {
      if (dress.full < 0.5 && c.k > dress.full + 0.45) continue;
      const o = turnOrder(c) / 1.15;
      const t = autumnT(c);
      if (dress.turned >= 1 || o < dress.turned) look = { ramp: autumnAt(spec, t), under: autumnAt(spec, t + 0.35), over: autumnAt(spec, t - 0.25) };
      else if (o < dress.turned + 0.15) look = { ramp: spec.leaf.summer, under: spec.leaf.summer, over: autumnAt(spec, t) };
    }
    out.push({ c, ...look, grown });
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

/** One small oak leaf lying or flying: long, in round lobes either side, `s` long, turned `a`, squashed `flat` top to bottom. */
function oakLeafAt(g: Ctx | Path2D, x: number, y: number, s: number, a: number, flat = 1): void {
  const ca = Math.cos(a), sa = Math.sin(a);
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    const u = (1 - Math.cos(t)) / 2;
    const w = Math.sin(Math.PI * u) * (0.62 + 0.38 * Math.abs(Math.sin(4.5 * Math.PI * u))) * 0.42 * Math.sign(Math.sin(t) || 1);
    const lx = (u - 0.5) * s * 1.2, ly = w * s;
    const px = x + lx * ca - ly * sa, py = y + (lx * sa + ly * ca) * flat;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

/** The leaf a species lies and falls in. */
const leafOf = (spec: Species3D): typeof leafAt => (spec.leafForm === 'oak' ? oakLeafAt : leafAt);

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
    // Under a full crown only the trunk and the limbs it splits into are ever seen, below the crown.
    if (leafy && first.order >= (job.spec.open ? 3 : 2)) continue;
    // The finest twigs only on the bare wood: among leaf they would be scratches over it.
    if (job.spec.open && first.order >= 4 && job.dress.full > 0) continue;
    // A buttressed foot's roots are drawn as the foot's lobes (`footPath`).
    if (job.spec.buttress && first.order < 0) continue;
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
    // No snow on an open crown's roots: they are the trunk's foot.
    if (snowy && Math.abs(D[2]) < 0.5 && !(job.spec.open && first.order < 0)) {
      const on: number[] = [];
      for (let s = -0.95; s <= 0.951; s += 0.1) if (normal(s)[2] > 0.68) on.push(s);
      if (on.length) snow = [Math.max(-1, on[0] - 0.05), Math.min(1, on[on.length - 1] + 0.05)];
      // Only along the top edge: the end of the snowy stretch nearest the limb's edge, a fifth of its width.
      if (snow && job.spec.snowLine) {
        const top = Math.abs(snow[1]) >= Math.abs(snow[0]) ? snow[1] : snow[0];
        const w = Math.min(0.4, snow[1] - snow[0]);
        snow = top > 0 ? [top - w, top] : [top, top + w];
      }
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
    if (job.spec.open) {
      // Tapering to its tip, a stroke a piece.
      for (let j = j0; j < j1; j++) {
        g.lineWidth = c.r[j] + c.r[j + 1];
        g.beginPath();
        g.moveTo(c.q[j][0], c.q[j][1]);
        g.lineTo(c.q[j + 1][0], c.q[j + 1][1]);
        g.stroke();
      }
    } else {
      g.lineWidth = c.r[j0] + c.r[j1];
      g.beginPath();
      for (let j = j0; j <= j1; j++) (j === j0 ? g.moveTo(c.q[j][0], c.q[j][1]) : g.lineTo(c.q[j][0], c.q[j][1]));
      g.stroke();
    }
    if (c.snow) {
      g.strokeStyle = 'rgba(250,252,255,0.9)';
      g.lineWidth = (c.r[j0] + c.r[j1]) * (job.spec.snowLine ? 0.3 : 0.5);
      g.beginPath();
      for (let j = j0; j <= j1; j++) (j === j0 ? g.moveTo(c.q[j][0], c.q[j][1] - c.r[j] * 0.5) : g.lineTo(c.q[j][0], c.q[j][1] - c.r[j] * 0.5));
      g.stroke();
    }
    return;
  }
  if (job.spec.open && c.order >= 2) {
    // An open crown's branches in two: the whole in its middle tone, its shaded side over it.
    g.fillStyle = c.cols[1];
    g.fill(bandPath(c, j0, j1, -1, 1));
    g.fillStyle = c.cols[0];
    g.fill(bandPath(c, j0, j1, -1, -0.3));
  } else {
    CHAIN_BANDS.forEach(([s0, s1], i) => {
      g.fillStyle = c.cols[i];
      g.fill(bandPath(c, j0, j1, i === 0 ? s0 : s0 - 0.04, i === 2 ? s1 : s1 + 0.04));
    });
  }
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
  // A buttressed foot has its moss on the buttresses (`paintFoot`).
  if (job.spec.bark.moss && !job.spec.buttress && c.order === 0 && j0 === 0) paintMoss(g, job.spec.bark.moss, c, R);
  // Furrows down the bark of the trunk and the big limbs.
  const rm = Math.max(c.r[j0], c.r[j1]);
  // Rough bark only where it is broad enough to show.
  if (rm > (job.spec.bark.ridged && c.order > 0 ? 3 : 2.2) && c.order <= 1) {
    g.strokeStyle = job.spec.bark.furrow;
    g.globalAlpha = c.order < 0 ? 0.35 : 0.5;
    g.lineWidth = 0.42;
    g.beginPath();
    const n = Math.min(6, Math.floor(rm / 1.3));
    if (job.spec.bark.ridged) ridges(g, c, j0, j1, n, R);
    else for (let i = 0; i < n; i++) {
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
  // An open crown's roots and the foot of its trunk are one mass: only the ink round the whole tree is on them.
  if (job.spec.open && c.order < 0) return;
  if (job.spec.open && c.order === 0) j0 = Math.max(j0, Math.min(j1 - 1, 2));
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

/** Furrows as rough bark has them: wandering, broken into ridges, between `n` lines across. */
function ridges(g: Ctx, c: Chain, j0: number, j1: number, n: number, R: () => number): void {
  // Steps enough to wander: fewer on a run of many short pieces.
  const SUB = j1 - j0 >= 4 ? 1 : 3;
  for (let i = 0; i < n; i++) {
    const s = -0.8 + (1.6 * (i + 0.5)) / n;
    let on = false;
    for (let j = j0; j < j1; j++) {
      for (let k = 0; k <= SUB; k++) {
        const t = k / SUB;
        const r = c.r[j] + (c.r[j + 1] - c.r[j]) * t;
        const qx = c.q[j][0] + (c.q[j + 1][0] - c.q[j][0]) * t, qy = c.q[j][1] + (c.q[j + 1][1] - c.q[j][1]) * t;
        const nx = c.n[j][0] + (c.n[j + 1][0] - c.n[j][0]) * t, ny = c.n[j][1] + (c.n[j + 1][1] - c.n[j][1]) * t;
        const w = s * r + (R() - 0.5) * r * 0.22;
        const x = qx + nx * w, y = qy + ny * w;
        // A ridge runs two or three steps and breaks.
        if (!on || R() < 0.22) { g.moveTo(x, y); on = true; } else g.lineTo(x, y);
      }
    }
  }
}

/** Moss up the trunk's shaded side from the ground: a flat patch with a ragged top, gone by half way up. */
function paintMoss(g: Ctx, moss: string, c: Chain, R: () => number): void {
  const top = Math.max(1, Math.round((c.q.length - 1) * 0.5));
  const SUB = 3;
  const p = new Path2D();
  const at = (j: number, t: number, s: number): Pt => {
    const r = c.r[j] + (c.r[j + 1] - c.r[j]) * t;
    return [
      c.q[j][0] + (c.q[j + 1][0] - c.q[j][0]) * t + (c.n[j][0] + (c.n[j + 1][0] - c.n[j][0]) * t) * r * s,
      c.q[j][1] + (c.q[j + 1][1] - c.q[j][1]) * t + (c.n[j][1] + (c.n[j + 1][1] - c.n[j][1]) * t) * r * s,
    ];
  };
  p.moveTo(...at(0, 0, -1));
  // Up the shaded edge, then down its ragged inner edge.
  for (let j = 0; j < top; j++) for (let k = 1; k <= SUB; k++) p.lineTo(...at(j, k / SUB, -1));
  for (let j = top - 1; j >= 0; j--) {
    for (let k = SUB; k >= 0; k--) {
      const f = (j + k / SUB) / top;
      p.lineTo(...at(j, k / SUB, -1 + (1 - f) * (0.55 + 0.45 * R()) + (k % 2 ? 0.12 : 0)));
    }
  }
  p.closePath();
  g.fillStyle = moss;
  g.globalAlpha = 0.8;
  g.fill(p);
  g.globalAlpha = 1;
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
 * One leaf standing out of the edge of a mass, across it from 0 to 1: a
 * broad round-pointed scallop in three lobes, the middle one tallest, as the
 * flat maple's leaves are cut.
 */
const LEAF_EDGE: ReadonlyArray<Pt> = Array.from({ length: 15 }, (_, i) => {
  const u = i / 14;
  return [u, Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.42 * Math.pow(Math.abs(Math.cos(3 * Math.PI * u)), 6) * Math.sin(Math.PI * u))] as Pt;
});

/** An oak leaf's edge standing out of a mass: long and low, in round lobes with a notch between each. */
const OAK_EDGE: ReadonlyArray<Pt> = Array.from({ length: 13 }, (_, i) => {
  const u = i / 12;
  return [u, Math.pow(Math.sin(Math.PI * u), 0.6) * (0.55 + 0.45 * Math.sqrt(Math.abs(Math.sin(3 * Math.PI * u))))] as Pt;
});
/** The edge a species' masses stand out of. */
const edgeOf = (spec: Species3D): ReadonlyArray<Pt> => (spec.leafForm === 'oak' ? OAK_EDGE : LEAF_EDGE);

/** The shape of a mass, seeded: two waves of lumps round it and the leaves standing out of its edge. */
interface Outline { lumps: [number, number, number, number]; leaves: Array<{ at: number; w: number; h: number }> }

function outlineOf(R: () => number, leaves: number): Outline {
  const out: Outline = { lumps: [0.07 + 0.05 * R(), R() * TAU, 0.04 + 0.03 * R(), R() * TAU], leaves: [] };
  const a0 = R() * TAU;
  for (let i = 0; i < leaves; i++) out.leaves.push({ at: a0 + ((i + 0.3 * R()) / leaves) * TAU, w: Math.min(TAU / leaves - 0.1, 0.8 + 0.3 * R()), h: 0.2 + 0.1 * R() });
  out.leaves.sort((p, q) => p.at - q.at);
  return out;
}

/** A mass's outline round (cx, cy), lumpy, with its leaves standing out of it `k` as far. */
function massPath(p: Path2D, cx: number, cy: number, rx: number, ry: number, o: Outline, k = 1, edge: ReadonlyArray<Pt> = LEAF_EDGE): void {
  const [a1, p1, a2, p2] = o.lumps;
  const rad = (t: number): number => 1 + a1 * Math.sin(3 * t + p1) + a2 * Math.sin(5 * t + p2);
  let first = true;
  const pt = (t: number, r: number): void => {
    const x = cx + Math.cos(t) * rx * r, y = cy + Math.sin(t) * ry * r;
    if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
  };
  const STEP = TAU / 28;
  const start = o.leaves.length ? o.leaves[0].at - o.leaves[0].w / 2 : 0;
  let t = start;
  for (const L of o.leaves) {
    const from = L.at - L.w / 2;
    for (; t < from; t += STEP) pt(t, rad(t));
    for (const [u, h] of edge) {
      const a = from + u * L.w;
      pt(a, rad(a) + h * L.h * k);
    }
    t = from + L.w;
  }
  for (; t < start + TAU; t += STEP) pt(t, rad(t));
  p.closePath();
}

/**
 * A mass of leaf, as the island's flat shapes are painted: its outline filled
 * in its shaded tone, the core of its shade a step deeper on the side away
 * from the sun, then a middle plane and a lit plane laid toward the sun, each
 * the mass's own lumpy shape smaller -- four flat pastel planes -- with a few
 * big leaves picked out where the light catches the edge, and ink round it.
 */
function paintMass(g: Ctx, job: Job, s: Shown, sun: { sx: number; sy: number; front: number }, outline: Path2D, o: Outline, rim: string): void {
  const { c } = s;
  const R = mulberry32(job.seed * 977 + Math.round(c.k * 1e6));
  const [cx, cy] = proj(job.e, c.c);
  const rx = c.r * ACROSS * s.grown, ry = rx * (job.spec.pad ?? 0.86);
  const L = clumpLight(job, c);
  const top = s.ramp.length - 1;
  const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.2))));
  const off = 1 - 0.55 * sun.front;
  const plane = (dx: number, dy: number, k: number, col: string, seed: number): void => {
    const p = new Path2D();
    const po = outlineOf(mulberry32(seed), 3);
    massPath(p, cx + dx, cy + dy, rx * k, ry * k, po, 0.9, edgeOf(job.spec));
    g.fillStyle = col;
    g.fill(p);
  };
  g.fillStyle = s.under[b];
  g.fill(outline);
  g.save();
  g.clip(outline);
  const seed = Math.round(c.k * 1e6);
  // The core of the shade: away from the sun and under.
  plane(-sun.sx * rx * 0.5 * off, -sun.sy * ry * 0.5 * off + ry * 0.28, 0.72, s.under[b - 1], seed + 1);
  // The middle, and the lit side, toward the sun and up.
  plane(sun.sx * rx * 0.16 * off, sun.sy * ry * 0.16 * off - ry * 0.1, 0.8, s.ramp[b + 1], seed + 2);
  if (!job.light.night || L > 0.6) plane(sun.sx * rx * 0.38 * off, sun.sy * ry * 0.38 * off - ry * 0.22, 0.48, s.over[b + 2], seed + 3);
  // A few big leaves where the light catches the edge.
  g.fillStyle = s.over[Math.min(top, b + 2)];
  g.beginPath();
  for (let i = 0; i < 2; i++) {
    const a = Math.atan2(sun.sy - 0.6, sun.sx) + (R() - 0.5) * 1.4;
    const d = 0.4 + 0.3 * R();
    leafOf(job.spec)(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * 0.24, (R() - 0.5) * 0.8, 0.85);
  }
  g.fill();
  g.restore();
  g.strokeStyle = rim;
  g.lineWidth = KIT_INK_W;
  g.lineJoin = 'round';
  g.stroke(outline);
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
      leafOf(spec)(g, x, y, 1.5 + R(), R() * TAU, 0.5);
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
    leafOf(spec)(g, x, y, 1.1, R() * TAU, 0.75 + 0.25 * R());
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

/**
 * A rune cut in the bark and inked as the kit inks: the ink, the groove in
 * the bark's own shade inside it, and a lit edge; after dark the groove lit
 * gold as a runestone's runes are, in a glow of widening faint strokes.
 * In the glyph's own frame, a unit from its middle to its top.
 */
function inkedRune(g: Ctx, face: RGB, night: boolean): void {
  const path = (): void => { g.beginPath(); glyphPath(g, 'algiz', 0, 0, 1); };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (night) {
    for (const [k, al] of [[2.2, 0.06], [1.6, 0.1], [1.15, 0.16], [0.8, 0.24]] as Array<[number, number]>) {
      path();
      g.strokeStyle = `rgba(255, 172, 72, ${al})`;
      g.lineWidth = k;
      g.stroke();
    }
    for (const [col, w] of [[RUNE_EDGE, 0.36], [RUNE_GOLD, 0.25], [RUNE_WHITE, 0.12]] as Array<[string, number]>) {
      path();
      g.strokeStyle = col;
      g.lineWidth = w;
      g.stroke();
    }
    return;
  }
  path();
  g.strokeStyle = rgb(KIT_INK);
  g.lineWidth = 0.42;
  g.stroke();
  path();
  g.strokeStyle = rgb(mixRgb(face, hex('#2a2030'), 0.55));
  g.lineWidth = 0.26;
  g.stroke();
  g.save();
  g.translate(0.05, 0.05);
  path();
  g.strokeStyle = rgb(mixRgb(face, [255, 246, 228], 0.35), 0.7);
  g.lineWidth = 0.08;
  g.stroke();
  g.restore();
}

/** How high the trunk goes before it splits. */
const trunkTop = (job: Job): number => job.sk.limbs.reduce((m, l) => (l.order === 0 ? Math.max(m, l.b[2]) : m), 0);

function paintCarving(g: Ctx, job: Job): void {
  const { sk, spec, e } = job;
  if (sk.hollow !== null) {
    const at = onTrunk(job, Math.min(sk.height * 0.2, trunkTop(job) * 0.75), sk.hollow);
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
    const at = onTrunk(job, Math.min(sk.height * 0.12, trunkTop(job) * 0.45), sk.rune);
    if (at && at.seen > 0.3) {
      const [x, y] = proj(e, at.p);
      const tan: V3 = [-at.n[1], at.n[0], 0];
      const [tx, ty] = projVec(e, tan);
      const s = at.r * 0.5;
      g.save();
      g.transform(tx * s, ty * s, 0, -HEIGHT_SCALE * s, x, y);
      const lam = Math.max(0, dot(at.n, job.light.sun));
      const face = mixRgb(hex(spec.bark.shade), hex(spec.bark.lit), clamp01((job.light.ambient + job.light.direct * lam - 0.22) / 0.82));
      if (spec.inkedRune) inkedRune(g, face, job.light.night);
      else cut(g, face, 0.3, () => glyphPath(g, 'algiz', 0, 0, 1));
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
  const chains = chainsOf(job, leafy);
  // Each mass's outline, worked out once: the ink is laid under all of them before any is painted.
  const masses = shown.map((s) => {
    const o = outlineOf(mulberry32(job.seed * 31 + Math.round(s.c.k * 1e6)), 4 + Math.floor(s.c.k * 2.99));
    const [cx, cy] = proj(e, s.c.c);
    const rx = s.c.r * ACROSS * s.grown;
    const path = new Path2D();
    massPath(path, cx, cy, rx, rx * (spec.pad ?? 0.86), o, 1, edgeOf(spec));
    return { o, path };
  });
  /*
   * The ink round the whole tree, laid first under everything: every spray's
   * outline and every limb's stroked one ink's width out in the kit's ink.
   * Whatever is laid after covers it wherever two of them meet, so what is
   * left of it is the tree's own outline -- against the sky, and through
   * every gap in the crown.
   */
  g.strokeStyle = rgb(KIT_INK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = KIT_INK_W * 2;
  for (const m of masses) g.stroke(m.path);
  for (const c of chains) {
    if (c.thin) {
      // An open crown's twigs inked finer, or the ink is all there is of them.
      g.lineWidth = c.r[0] + c.r[c.r.length - 1] + KIT_INK_W * (spec.open && c.order >= 3 ? 1.2 : 2);
      g.beginPath();
      c.q.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    } else {
      g.lineWidth = KIT_INK_W * 2;
      g.stroke(bandPath(c, 0, c.q.length - 1, -1, 1));
      const [x, y] = c.q[c.q.length - 1];
      g.beginPath();
      g.arc(x, y, c.r[c.r.length - 1] + KIT_INK_W, 0, TAU);
      g.fillStyle = rgb(KIT_INK);
      g.fill();
    }
  }
  // An open crown's trunk stands on a round foot, the ground's circle of it, laid just behind the trunk.
  const trunk = chains.find((c) => c.order === 0);
  const foot = spec.open && trunk ? footPath(job) : null;
  if (foot && trunk) {
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(foot);
    g.stroke(footTop(job));
    items.push({ d: near(sk.limbs[0].a) - 0.6, draw: () => paintFoot(g, job, foot, trunk) });
  }
  // The wood, a few pieces of a limb at a time, so each run is laid in its own place among the leaf.
  for (const c of chains) {
    // An open crown's branches go in whole: each is short, and among the masses by its own depth.
    const per = c.order <= 0 ? 8 : spec.open ? (c.order === 1 ? 4 : 6) : 2;
    for (let j0 = 0; j0 < c.q.length - 1; j0 += per) {
      const j1 = Math.min(c.q.length - 1, j0 + per);
      const L0 = sk.limbs[c.pieces[j0]], L1 = sk.limbs[c.pieces[j1 - 1]];
      const R = mulberry32(job.seed + c.pieces[j0] * 13);
      // Under a full crown the wood goes in first: the crown is in front of all of it. An open crown's
      // wood is among its masses, set back a little so a branch's end goes into the mass on it.
      const d = near(lerp(L0.a, L1.b, 0.5)) + (c.order <= 0 ? -0.5 : 0);
      const at = leafy && !spec.open ? -1e6 : spec.open && shown.length ? d - sk.crown.r * 0.12 * Math.max(0, c.order) : d;
      items.push({ d: at, draw: () => paintChain(g, job, c, j0, j1, R) });
    }
  }
  const sizeOfKey = sk.crown.r * 0.12;
  const keyed = spec.keys && dress.keys && ((dress.season === 'spring' && dress.step >= 3) || dress.season === 'summer');
  shown.forEach((s, i) => {
    const rim = rgb(mixRgb(hex(s.under[0]), KIT_INK, 0.7), 0.9);
    items.push({
      d: near(s.c.c),
      draw: () => {
        paintMass(g, job, s, sun, masses[i].path, masses[i].o, rim);
        if (keyed && s.c.up < 0.6 && s.c.k < 0.55) {
          const [x, y] = proj(e, s.c.c);
          const col = dress.season === 'summer' ? mixRgbHex(spec.keys!.colour, spec.keys!.ripe, 0.2) : spec.keys!.colour;
          paintKeys(g, x + (s.c.k - 0.4) * s.c.r * ACROSS, y + s.c.r * ACROSS * 0.62, sizeOfKey * ACROSS * 0.4, 2 + Math.floor(s.c.k * 8), col, mulberry32(job.seed + Math.round(s.c.k * 1e5)));
        }
      },
    });
  });
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

/** Where a buttressed foot's lobes go: the way each root runs, and how far past the trunk it reaches. */
function lobesOf(job: Job): Array<[number, number]> {
  const { sk } = job;
  const base = sk.limbs[0].a;
  const rT = sk.limbs[0].ra * 1.02;
  const out: Array<[number, number]> = [];
  if (!job.spec.buttress) return out;
  for (const R of sk.limbs) {
    if (R.order >= 0 || sk.limbs[R.parent]?.order !== -1) continue;
    out.push([Math.atan2(R.b[1] - base[1], R.b[0] - base[0]), Math.hypot(R.b[0] - base[0], R.b[1] - base[1]) + R.rb - rT]);
  }
  return out;
}

/** A closed shape round the trunk's foot, `r(t)` from its axis at each way round, `z(t)` up. */
function groundShape(job: Job, r: (t: number) => number, N: number, z: (t: number) => number = () => 0): Path2D {
  const base = job.sk.limbs[0].a;
  const p = new Path2D();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    const rr = r(t);
    const [x, y] = proj(job.e, [base[0] + Math.cos(t) * rr, base[1] + Math.sin(t) * rr, z(t)]);
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

/**
 * The ground's shape under a trunk, as a path on the screen: its circle, and
 * where it is buttressed a lobe out along each root with a soft dip between.
 */
function footPath(job: Job): Path2D {
  const rT = job.sk.limbs[0].ra * 1.02;
  const lobes = lobesOf(job);
  return groundShape(job, (t) => {
    let r = rT;
    for (const [a, out] of lobes) r += Math.max(0, out) * Math.pow(Math.max(0, Math.cos(t - a)), 6);
    return r;
  }, lobes.length ? 72 : 36);
}

/**
 * The tops of the buttresses: the foot's shape drawn in a little and raised,
 * highest against the trunk and coming down toward each lobe's end, so the
 * foot stands up off the ground with its side showing under it.
 */
function footTop(job: Job): Path2D {
  const rT = job.sk.limbs[0].ra * 1.02;
  const lobes = lobesOf(job);
  const h = rT * 0.42;
  const most = Math.max(1e-6, ...lobes.map(([, o]) => o));
  const lobeAt = (t: number): number => {
    let r = 0;
    for (const [a, out] of lobes) r += Math.max(0, out) * Math.pow(Math.max(0, Math.cos(t - a)), 6);
    return r;
  };
  return groundShape(job, (t) => rT * 0.96 + lobeAt(t) * 0.82, 72, (t) => h * (1 - 0.75 * Math.min(1, lobeAt(t) / most)));
}

/**
 * The foot filled in the trunk's own bands, carried down across it, so the
 * two are one piece of wood; then each buttress's ridge, lit as its top
 * faces, with moss on those turned from the sun, and a crease in each dip.
 */
function paintFoot(g: Ctx, job: Job, foot: Path2D, c: Chain): void {
  // Its side, under the tops: the bark's shade, a step toward the ink.
  g.fillStyle = rgb(mixRgb(hex(job.spec.bark.shade), KIT_INK, 0.25));
  g.fill(foot);
  const top = footTop(job);
  const [x, y] = c.q[0];
  const [nx, ny] = c.n[0];
  const ax = c.q[1][0] - x, ay = c.q[1][1] - y;
  const al = Math.hypot(ax, ay) || 1;
  const ux = (ax / al) * 400, uy = (ay / al) * 400;
  const r = c.r[0];
  g.save();
  g.clip(top);
  const BANDS: Array<[number, number, number]> = [[-40, -0.36, 0], [-0.36, 0.34, 1], [0.34, 40, 2]];
  for (const [s0, s1, i] of BANDS) {
    g.fillStyle = c.cols[i];
    g.beginPath();
    g.moveTo(x + nx * r * s0 - ux, y + ny * r * s0 - uy);
    g.lineTo(x + nx * r * s1 - ux, y + ny * r * s1 - uy);
    g.lineTo(x + nx * r * s1 + ux, y + ny * r * s1 + uy);
    g.lineTo(x + nx * r * s0 + ux, y + ny * r * s0 + uy);
    g.closePath();
    g.fill();
  }
  const { sk, spec, light } = job;
  const rT = sk.limbs[0].ra * 1.02;
  const lobes = lobesOf(job);
  const base = sk.limbs[0].a;
  lobes.forEach(([a, out], k) => {
    // The ridge: the lobe narrower and drawn in to the trunk, lit by the way its top faces.
    const ridge = groundShape(job, (t) => rT * 0.6 + Math.max(0, out) * 0.8 * Math.pow(Math.max(0, Math.cos(t - a)), 8), 48);
    const n = unit([Math.cos(a), Math.sin(a), 1.1]);
    const lam = Math.max(0, dot(n, light.sun));
    const l = clamp01((light.ambient + light.direct * lam - 0.22) / 0.82);
    g.fillStyle = rgb(mixRgb(hex(spec.bark.shade), hex(spec.bark.lit), l));
    g.globalAlpha = 0.5;
    g.fill(ridge);
    g.globalAlpha = 1;
    if (spec.bark.moss && lam < 0.45 && k % 2 === 0) {
      g.globalAlpha = 0.7;
      g.fillStyle = spec.bark.moss;
      g.fill(groundShape(job, (t) => rT * 0.55 + Math.max(0, out) * 0.6 * Math.pow(Math.max(0, Math.cos(t - a)), 18), 40));
      g.globalAlpha = 1;
    }
  });
  // A crease in each dip between two lobes, from the trunk out.
  g.strokeStyle = spec.bark.furrow;
  g.globalAlpha = 0.6;
  g.lineWidth = KIT_INK_W * 0.6;
  g.lineCap = 'round';
  const sorted = lobes.map(([a]) => ((a % TAU) + TAU) % TAU).sort((p, q) => p - q);
  g.beginPath();
  sorted.forEach((a, i) => {
    const b2 = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU;
    const m = (a + b2) / 2;
    const [x0, y0] = proj(job.e, [base[0] + Math.cos(m) * rT * 0.9, base[1] + Math.sin(m) * rT * 0.9, 0]);
    const [x1, y1] = proj(job.e, [base[0] + Math.cos(m) * rT * 1.25, base[1] + Math.sin(m) * rT * 1.25, 0]);
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
  });
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

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

/** How far round its foot a tree's own shade reaches, in pixels at zoom one across: under it, the shade it throws is not laid. */
export const footReach = (sk: Skeleton): number => Math.max(4, (sk.limbs[0]?.ra ?? 2) * ACROSS * 2.6);

/**
 * The shade right at its foot, laid under everything else, in the colour and
 * strength the shade it throws is laid at by day (`Renderer.solidFrame`),
 * which leaves this much round its foot to it.
 */
export function footShade(g: Ctx, sk: Skeleton): void {
  const r = footReach(sk);
  g.save();
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = 'rgba(30,56,66,0.27)';
  g.beginPath();
  g.ellipse(0, 0.5, r, r * 0.5, 0, 0, TAU);
  g.fill();
  g.restore();
}
