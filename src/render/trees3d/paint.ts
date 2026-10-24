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
import type { Clump, Dress, Limb, Pad, Ramp, RGB, Skeleton, Species3D, V3 } from './types';
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
  if (spec.evergreen) return keptOf(job);
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
    if (leafy && first.order >= 2) continue;
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
    if (snowy && Math.abs(D[2]) < 0.5) {
      const on: number[] = [];
      for (let s = -0.95; s <= 0.951; s += 0.1) if (normal(s)[2] > 0.68) on.push(s);
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
 * One leaf standing out of the edge of a mass, across it from 0 to 1: a
 * broad round-pointed scallop in three lobes, the middle one tallest, as the
 * flat maple's leaves are cut.
 */
const LEAF_EDGE: ReadonlyArray<Pt> = Array.from({ length: 15 }, (_, i) => {
  const u = i / 14;
  return [u, Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.42 * Math.pow(Math.abs(Math.cos(3 * Math.PI * u)), 6) * Math.sin(Math.PI * u))] as Pt;
});

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
function massPath(p: Path2D, cx: number, cy: number, rx: number, ry: number, o: Outline, k = 1): void {
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
    for (const [u, h] of LEAF_EDGE) {
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
  const rx = c.r * ACROSS * s.grown, ry = rx * 0.86;
  const L = clumpLight(job, c);
  const top = s.ramp.length - 1;
  const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.2))));
  const off = 1 - 0.55 * sun.front;
  const plane = (dx: number, dy: number, k: number, col: string, seed: number): void => {
    const p = new Path2D();
    const po = outlineOf(mulberry32(seed), 3);
    massPath(p, cx + dx, cy + dy, rx * k, ry * k, po, 0.9);
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
    leafAt(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * 0.24, (R() - 0.5) * 0.8, 0.85);
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
    leafAt(g, x, y, 1.1, R() * TAU, 0.75 + 0.25 * R());
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
  if (spec.build.whorls) return paintWhorls(g, job);
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
    massPath(path, cx, cy, rx, rx * 0.86, o);
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
      g.lineWidth = c.r[0] + c.r[c.r.length - 1] + KIT_INK_W * 2;
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
  // The wood, a few pieces of a limb at a time, so each run is laid in its own place among the leaf.
  for (const c of chains) {
    const per = c.order <= 0 ? 8 : 2;
    for (let j0 = 0; j0 < c.q.length - 1; j0 += per) {
      const j1 = Math.min(c.q.length - 1, j0 + per);
      const L0 = sk.limbs[c.pieces[j0]], L1 = sk.limbs[c.pieces[j1 - 1]];
      const R = mulberry32(job.seed + c.pieces[j0] * 13);
      // Under a full crown the wood goes in first: the crown is in front of all of it.
      items.push({ d: leafy ? -1e6 : near(lerp(L0.a, L1.b, 0.5)) + (c.order <= 0 ? -0.5 : 0), draw: () => paintChain(g, job, c, j0, j1, R) });
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
  for (const c of sk.clumps) if (c.pad) take(add(c.c, add(c.pad.root, [0, 0, -c.pad.drop - c.pad.hang * 1.6])), c.r * 0.5);
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

/* ---- a conifer's whorls (`growWhorls`) ------------------------------------------------ */

/** An evergreen's boughs as a day shows them: winter's darker leaf, summer's the rest of the year. */
function keptOf(job: Job): Shown[] {
  const { sk, spec, dress } = job;
  const r = dress.season === 'winter' && spec.evergreen ? spec.evergreen.winter : spec.leaf.summer;
  return sk.clumps.map((c) => ({ c, ramp: r, under: r, over: r, grown: 1 }));
}

/** A closed outline through `p`, rounded: a curve through each edge's middle bent by its corner, as the flat conifers' boughs are cut. */
function roundPath(path: Path2D, p: Pt[]): void {
  const n = p.length;
  if (n < 3) return;
  path.moveTo((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2);
  for (let i = 1; i <= n; i++) {
    const a = p[i % n], b = p[(i + 1) % n];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  path.closePath();
}

/**
 * What a ring of points on the screen covers with something hanging `h`
 * under each: along its top from its leftmost point to its rightmost, then
 * back along its underside with each point let down; `under` marks which
 * of the points are on the underside.
 */
function hung(q: Pt[], h: number[], under?: boolean[]): Pt[] {
  const n = q.length;
  let iL = 0, iR = 0;
  for (let i = 1; i < n; i++) {
    if (q[i][0] < q[iL][0]) iL = i;
    if (q[i][0] > q[iR][0]) iR = i;
  }
  const chain = (from: number, to: number): number[] => {
    const out = [from];
    for (let i = from; i !== to;) {
      i = (i + 1) % n;
      out.push(i);
    }
    return out;
  };
  const A = chain(iL, iR), B = chain(iR, iL);
  const avg = (c: number[]): number => c.reduce((s, i) => s + q[i][1], 0) / c.length;
  const [top, low] = avg(A) <= avg(B) ? [A, B] : [B, A];
  const out: Pt[] = top.map((i) => q[i]);
  for (const i of low) out.push([q[i][0], q[i][1] + h[i]]);
  if (under) {
    under.length = n;
    under.fill(false);
    for (const i of low) under[i] = true;
  }
  return out;
}

/** A point round a bough's outline, in its own frame: `x` out from the leader, `y` across, `dz` under its top, `h` the needles hanging under it. */
interface Rim { x: number; y: number; dz: number; h: number; finger: boolean }

/**
 * A bough's outline: narrow where it leaves the leader, widest past its
 * middle, its end cut into fingers that hang lower than the rest, the
 * needles under them hanging longest.
 */
function rimOf(p: Pad, R: () => number): Rim[] {
  const L = p.reach, W = p.w, H = p.hang;
  const wAt = (t: number): number => W * (0.22 + 0.78 * Math.sin(Math.PI * Math.min(1, t) * 0.8));
  const out: Rim[] = [];
  for (const t of [0, 0.2, 0.38]) out.push({ x: t * L, y: -wAt(t), dz: 0, h: H * (0.15 + 0.4 * t), finger: false });
  const xc = 0.55 * L, rx = 0.45 * L + W * 0.08, ry = wAt(0.55);
  const F = p.fingers;
  const at = (a: number, k: number, dz: number, h: number, finger: boolean): void => {
    out.push({ x: xc + Math.cos(a) * rx * k, y: Math.sin(a) * ry * k, dz, h, finger });
  };
  for (let j = 0; j <= F; j++) {
    const a = -Math.PI / 2 + (Math.PI * j) / F;
    const notch = 0.8 - 0.1 * R();
    at(a, notch, 0, H * 0.18, false);
    at(a, notch, 0, H * 0.18, false);
    if (j === F) break;
    const m = a + Math.PI / (2 * F), half = (Math.PI / (2 * F)) * 0.32;
    const k = 1.08 + 0.14 * R();
    const end = 0.3 + 0.7 * Math.cos(m);
    const dz = -H * (0.2 + 0.25 * R()) * end;
    const h = H * (0.9 + 0.6 * R()) * (0.55 + 0.45 * end);
    at(m - half, k, dz, h, true);
    at(m + half, k, dz, h * (0.9 + 0.2 * R()), true);
  }
  for (const t of [0.38, 0.2, 0]) out.push({ x: t * L, y: wAt(t), dz: 0, h: H * (0.15 + 0.4 * t), finger: false });
  return out;
}

/** A bough or the top's tuft, ready to lay: its outline with the needles under it, its planes, and its ink. */
interface Bough { d: number; out: Path2D; planes: Array<[Path2D, string]>; rim: string }

/** How lit a face turned `n` is, as a mass is (`clumpLight`): wrapped round, the lower whorls in the upper ones' shade. */
function faceLight(job: Job, n: V3, up: number): number {
  const wrap = clamp01((dot(n, job.light.sun) + 0.3) / 1.3);
  return (job.light.ambient + job.light.direct * wrap) * (0.7 + 0.3 * up);
}

function boughOf(job: Job, s: Shown, all: Path2D): Bough {
  const { e, light, dress, spec } = job;
  const c = s.c;
  const p = c.pad as Pad;
  const R = mulberry32(job.seed * 977 + Math.round(c.k * 1e6));
  const root = add(c.c, p.root);
  const top = s.ramp.length - 1;
  const rimCol = rgb(mixRgb(hex(s.ramp[0]), KIT_INK, 0.7), 0.9);
  const out = new Path2D();
  const planes: Array<[Path2D, string]> = [];
  const winter = dress.season === 'winter';
  const snow = (l: number): string => rgb(mixRgb(hex('#c4d0e4'), hex('#fbfcff'), clamp01(l)));
  if (p.spire) {
    // The top: a narrow cone of needles on the leader, its hem hanging in fingers.
    const apex = add(root, [0, 0, p.drop * 0.72]);
    const K = 12;
    const ring: Pt[] = [], h: number[] = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * TAU + c.k * 3;
      const r = p.reach * (k % 2 ? 0.8 : 1.05);
      ring.push(proj(e, add(root, [Math.cos(a) * r, Math.sin(a) * r, k % 2 ? 0 : -p.hang * 0.3])));
      h.push(p.hang * HEIGHT_SCALE * (k % 2 ? 0.25 : 0.7 + 0.4 * R()));
    }
    const q = proj(e, apex);
    // Its underside: from the ring's leftmost point round the front to its rightmost, each point let down.
    let iL = 0, iR = 0;
    ring.forEach((pt, i) => { if (pt[0] < ring[iL][0]) iL = i; if (pt[0] > ring[iR][0]) iR = i; });
    const run = (from: number, to: number): number[] => {
      const o = [from];
      for (let i = from; i !== to;) { i = (i + 1) % K; o.push(i); }
      return o;
    };
    const A = run(iL, iR), B = run(iR, iL).reverse();
    const avg = (c: number[]): number => c.reduce((t, i) => t + ring[i][1], 0) / c.length;
    const under = (avg(A) >= avg(B) ? A : B).map((i): Pt => [ring[i][0], ring[i][1] + h[i]]);
    const pts: Pt[] = [q, q, ...under];
    roundPath(out, pts);
    roundPath(all, pts);
    const L = faceLight(job, [0, 0, 1], 1);
    const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.2))));
    planes.push([out, s.ramp[b]]);
    const sun = sunOnScreen(job);
    const lit = new Path2D();
    const side = sun.sx >= 0 ? 1 : -1;
    // The sunward half of it lit: the far half drawn in to the middle.
    roundPath(lit, [q, q, ...under.map((pt): Pt => {
      const dx = pt[0] - q[0];
      return [q[0] + dx * (dx * side > 0 ? 0.88 : 0.12), q[1] + (pt[1] - q[1]) * 0.88];
    })]);
    if (!light.night || L > 0.6) planes.push([lit, winter ? snow(L) : s.ramp[b + 2]]);
    return { d: dot(c.c, e.toward as V3), out, planes, rim: rimCol };
  }
  const d = p.d;
  const side: V3 = [-d[1], d[0], 0];
  const L = p.reach, W = p.w;
  const at = (x: number, y: number, dz: number): V3 => {
    const t = x / L;
    const z = -p.drop * Math.pow(Math.max(0, t), 1.5) + L * 0.05 * Math.sin(Math.PI * t) - 0.3 * (y * y) / W + dz;
    return [root[0] + d[0] * x + side[0] * y, root[1] + d[1] * x + side[1] * y, root[2] + z];
  };
  const rim = rimOf(p, R);
  const q = rim.map((r) => proj(e, at(r.x, r.y, r.dz)));
  const hs = rim.map((r) => r.h * HEIGHT_SCALE);
  const under: boolean[] = [];
  const outline = hung(q, hs, under);
  roundPath(out, outline);
  roundPath(all, outline);
  // The light on its top, sloping out and down, and on the needles hanging off its end.
  const slope = p.drop / L;
  const nTop = unit([d[0] * slope, d[1] * slope, 1]);
  const lt = faceLight(job, nTop, c.up);
  const lh = faceLight(job, d, c.up);
  const bt = Math.max(1, Math.min(top - 2, Math.round(lt * (top - 1.2))));
  const bh = Math.max(0, Math.min(top - 3, Math.round(lh * (top - 1.2)) - 1));
  planes.push([out, s.ramp[bh]]);
  const face = new Path2D();
  roundPath(face, q);
  planes.push([face, s.ramp[bt + 1]]);
  // The inner part of its top in the shade of the whorl over it.
  if (c.up < 0.95) {
    const inner = new Path2D();
    const pts: Pt[] = [];
    for (const r of rim) pts.push(proj(e, at(r.x * 0.48, r.y * 0.85, 0)));
    roundPath(inner, pts);
    planes.push([inner, s.ramp[Math.max(1, bt - 1)]]);
  }
  // The lit part of its top: toward the sun, out past the whorl over it.
  const sx = light.sun[0], sy = light.sun[1];
  const sl = Math.hypot(sx, sy) || 1;
  const fx = (d[0] * sx + d[1] * sy) / sl, fy = (side[0] * sx + side[1] * sy) / sl;
  const cx = L * (0.62 + 0.12 * fx), cy = W * 0.38 * fy;
  const patch = (k: number, ky: number, lift: number, keep: (r: Rim) => boolean): Path2D => {
    const pp = new Path2D();
    const pts: Pt[] = [];
    for (const r of rim) if (keep(r)) pts.push(proj(e, at(cx + (r.x - cx) * k, cy + (r.y - cy) * ky, r.dz * k + lift)));
    roundPath(pp, pts);
    return pp;
  };
  if (winter) {
    planes.push([patch(0.78, 0.7, 0.25, () => true), snow(lt * 0.9)]);
    if (!light.night) planes.push([patch(0.5, 0.45, 0.3, () => true), snow(lt * 1.25)]);
  } else if (!light.night || lt > 0.6) {
    planes.push([patch(0.74, 0.66, 0.05, () => true), s.ramp[Math.min(top, bt + 2)]]);
    if (dot(nTop, light.sun) > 0.35 && !light.night) planes.push([patch(0.4, 0.38, 0.1, () => true), s.ramp[top]]);
  }
  // New growth on the ends of the fingers through the spring: along their tops, and where they hang in sight.
  if (dress.season === 'spring') {
    const tips = new Path2D();
    const k = dress.step === 0 ? 0.88 : 0.74;
    const pts: Pt[] = [];
    const end = rim.filter((r) => r.finger);
    for (const r of end) pts.push(proj(e, at(r.x, r.y, r.dz)));
    for (let i = end.length - 1; i >= 0; i--) {
      const r = end[i];
      pts.push(proj(e, at(L * 0.55 + (r.x - L * 0.55) * k, r.y * k, r.dz * k)));
    }
    roundPath(tips, pts);
    const f = dress.step === 0 ? 0.25 : 0.42;
    for (let i = 0; i + 1 < rim.length; i++) {
      if (!rim[i].finger || !rim[i + 1].finger || !under[i] || !under[i + 1]) continue;
      const [a, b] = [q[i], q[i + 1]];
      const [ha, hb] = [hs[i], hs[i + 1]];
      roundPath(tips, [[a[0], a[1] + ha * (1 - f)], [a[0], a[1] + ha * 0.97], [b[0], b[1] + hb * 0.97], [b[0], b[1] + hb * (1 - f)]]);
      i++;
    }
    planes.push([tips, spec.leaf.spring[Math.min(top, bt + 3)]]);
  }
  return { d: dot(c.c, e.toward as V3), out, planes, rim: rimCol };
}

/** A rune cut in the bark lit from inside at night, as the island's runes are. */
function runeGlow(g: Ctx, job: Job): void {
  const { sk, e } = job;
  if (sk.rune === null || !job.light.night) return;
  const at = onTrunk(job, sk.height * 0.12, sk.rune);
  if (!at || at.seen <= 0.3) return;
  const [x, y] = proj(e, at.p);
  const tan: V3 = [-at.n[1], at.n[0], 0];
  const [tx, ty] = projVec(e, tan);
  const s = at.r * 0.5;
  g.save();
  g.transform(tx * s, ty * s, 0, -HEIGHT_SCALE * s, x, y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const stroke = (col: string, w: number): void => {
    g.beginPath();
    glyphPath(g, 'algiz', 0, 0, 1);
    g.strokeStyle = col;
    g.lineWidth = w;
    g.stroke();
  };
  for (const [k, al] of [[2.2, 0.06], [1.6, 0.1], [1.15, 0.16], [0.8, 0.24]] as Array<[number, number]>) stroke(`rgba(255, 172, 72, ${al})`, k);
  stroke(RUNE_EDGE, 0.36);
  stroke(RUNE_GOLD, 0.25);
  stroke(RUNE_WHITE, 0.12);
  g.restore();
}

/**
 * A conifer: its trunk a piece between each two whorls, and its boughs,
 * laid back to front among them, so the boughs behind the leader go under
 * it, those in front over it, and each whorl hangs over the one under it;
 * the whole ruled round in ink first, as the broadleaves are.
 */
function paintWhorls(g: Ctx, job: Job): void {
  const { sk, e } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  const chains = chainsOf(job, false);
  const all = new Path2D();
  const boughs = keptOf(job).map((s) => boughOf(job, s, all));
  g.strokeStyle = rgb(KIT_INK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = KIT_INK_W * 2;
  g.stroke(all);
  for (const c of chains) {
    if (c.thin) {
      g.lineWidth = c.r[0] + c.r[c.r.length - 1] + KIT_INK_W * 2;
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
  const items: Item[] = [];
  for (const c of chains) {
    for (let j0 = 0; j0 < c.q.length - 1; j0++) {
      const L = sk.limbs[c.pieces[j0]];
      const R = mulberry32(job.seed + c.pieces[j0] * 13);
      items.push({ d: near(lerp(L.a, L.b, 0.5)) - (c.order <= 0 ? 0.5 : 0), draw: () => paintChain(g, job, c, j0, j0 + 1, R) });
    }
  }
  for (const b of boughs) {
    items.push({
      d: b.d,
      draw: () => {
        for (const [p, col] of b.planes) {
          g.fillStyle = col;
          g.fill(p);
        }
        g.strokeStyle = b.rim;
        g.lineWidth = KIT_INK_W;
        g.lineJoin = 'round';
        g.stroke(b.out);
      },
    });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  paintCarving(g, job);
  runeGlow(g, job);
}
