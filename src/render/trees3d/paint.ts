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
import { sprigOf } from '../outcrops';
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
  const shade = hex(L.dead && spec.bark.deadShade ? spec.bark.deadShade : spec.bark.shade);
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
  // What is never drawn is not looked at: under a full crown the finer wood, among any leaf an open crown's finest twigs.
  // An open crown in full leaf hides its branches: only the limbs off the trunk show, low and through its gaps.
  const cut = leafy ? 2 : job.spec.open && job.dress.full > 0 ? 4 : 99;
  for (let i = 0; i < limbs.length; i++) if (limbs[i].order < cut && goesOn(i)) next.set(limbs[i].parent, i);
  const V = unit(e.toward as V3);
  const snowy = job.dress.season === 'winter';
  const out: Chain[] = [];
  for (let i = 0; i < limbs.length; i++) {
    if (limbs[i].order >= cut || goesOn(i)) continue;
    const first = limbs[i];
    // Under a full crown the finest twigs are never seen.
    // Under a full crown only the trunk and the limbs it splits into are ever seen, below the crown.
    if (leafy && first.order >= 2) continue;
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
  // An open crown's limbs leave the trunk from its side: the start rounded off too, where it shows past the trunk.
  if (job.spec.open && c.order === 1 && j0 === 0) {
    g.fillStyle = c.cols[1];
    g.beginPath();
    g.arc(c.q[0][0], c.q[0][1], c.r[0] * 0.95, 0, TAU);
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
    else if (job.spec.bark.strands && c.order === 0) fibres(g, c, j0, j1, Math.min(7, Math.floor(rm / 1.1)), R, job.spec.bark.strands);
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
  // A conifer's buttressed foot likewise, up to its first cut.
  else if (job.spec.buttress && c.order === 0) j0 = Math.max(j0, Math.min(j1 - 1, 1));
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

/**
 * Stringy bark: `n` long furrows down the trunk, each swaying gently across
 * it, and a pale fibre beside each, broken here and there. Laid in the
 * furrows' stroke (`paintChain`), the fibres in their own.
 */
function fibres(g: Ctx, c: Chain, j0: number, j1: number, n: number, R: () => number, pale: string): void {
  const SUB = 1;
  const line = (p: Path2D, s: number, ph: number, broken: boolean): void => {
    let on = false;
    for (let j = j0; j < j1; j++) {
      for (let k = j === j0 ? 0 : 1; k <= SUB; k++) {
        const t = k / SUB;
        const r = c.r[j] + (c.r[j + 1] - c.r[j]) * t;
        const qx = c.q[j][0] + (c.q[j + 1][0] - c.q[j][0]) * t, qy = c.q[j][1] + (c.q[j + 1][1] - c.q[j][1]) * t;
        const nx = c.n[j][0] + (c.n[j + 1][0] - c.n[j][0]) * t, ny = c.n[j][1] + (c.n[j + 1][1] - c.n[j][1]) * t;
        const w = (s + 0.05 * Math.sin((j + t) * 1.9 + ph)) * r;
        const x = qx + nx * w, y = qy + ny * w;
        if (!on || (broken && R() < 0.12)) { p.moveTo(x, y); on = true; } else p.lineTo(x, y);
      }
    }
  };
  const dark = new Path2D(), light = new Path2D();
  for (let i = 0; i < n; i++) {
    const s = -0.82 + (1.64 * (i + 0.5)) / n;
    const ph = R() * TAU;
    line(dark, s, ph, false);
    line(light, s + 0.55 / n, ph, true);
  }
  g.stroke(dark);
  const was = g.globalAlpha;
  g.strokeStyle = pale;
  g.globalAlpha = 0.55;
  g.lineWidth = 0.32;
  g.stroke(light);
  g.globalAlpha = was;
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
function massPath(p: Path2D, cx: number, cy: number, rx: number, ry: number, o: Outline, k = 1, edge: ReadonlyArray<Pt> = LEAF_EDGE, steps = 28): void {
  const [a1, p1, a2, p2] = o.lumps;
  const rad = (t: number): number => 1 + a1 * Math.sin(3 * t + p1) + a2 * Math.sin(5 * t + p2);
  let first = true;
  const pt = (t: number, r: number): void => {
    const x = cx + Math.cos(t) * rx * r, y = cy + Math.sin(t) * ry * r;
    if (first) { p.moveTo(x, y); first = false; } else p.lineTo(x, y);
  };
  const STEP = TAU / steps;
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

/** A cluster's lumps on the screen: where each is, how big, and its outline's shape. */
interface Lump { x: number; y: number; rx: number; ry: number; o: Outline; seed: number }

function lumpsOf(job: Job, s: Shown): Lump[] {
  const { c } = s;
  const pad = job.spec.pad ?? 0.86;
  return (c.subs ?? []).map((u, j) => {
    const [x, y] = proj(job.e, [c.c[0] + u.o[0] * s.grown, c.c[1] + u.o[1] * s.grown, c.c[2] + u.o[2] * s.grown]);
    const rx = u.r * ACROSS * s.grown;
    const seed = job.seed * 31 + Math.round(c.k * 1e6) + j * 7;
    // The middle lump is mostly inside the cluster: its edge plain; the others' edges in leaves.
    return { x, y, rx, ry: rx * pad, o: outlineOf(mulberry32(seed), j === 0 ? 0 : 1 + (j % 2)), seed };
  });
}

/**
 * A cluster of lumps as one mass, as `paintMass` paints one: its rim laid
 * first and its fill over the inside of it, so only its outside edge is
 * inked; then its shade's core, its middle and its lit plane, each a plane
 * in every lump at once, so each lump is shaded as its own and the cluster
 * is still four flat tones.
 */
function paintCluster(g: Ctx, job: Job, s: Shown, sun: { sx: number; sy: number; front: number }, outline: Path2D, lumps: Lump[], rim: string): void {
  const L = clumpLight(job, s.c);
  const top = s.ramp.length - 1;
  const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.2))));
  const off = 1 - 0.55 * sun.front;
  const edge = edgeOf(job.spec);
  g.strokeStyle = rim;
  g.lineWidth = KIT_INK_W * 2;
  g.lineJoin = 'round';
  g.stroke(outline);
  g.fillStyle = s.under[b];
  g.fill(outline);
  g.save();
  g.clip(outline);
  const [ccx, ccy] = proj(job.e, s.c.c);
  const plane = (along: number, down: number, k: number, col: string, n: number, lit = false): void => {
    const p = new Path2D();
    for (const u of lumps) {
      // The lit plane only on the lumps turned to the sun and up: the rest are in the cluster's own shade.
      if (lit && (u.x - ccx) * sun.sx + (u.y - ccy) * sun.sy - (u.y - ccy) * 0.5 < -u.rx * 0.35) continue;
      // A plane is inside the mass: lumpy, with no leaves standing out of it.
      massPath(p, u.x + sun.sx * u.rx * along * off, u.y + sun.sy * u.ry * along * off + u.ry * down, u.rx * k, u.ry * k, outlineOf(mulberry32(u.seed + n), 0), 0.9, edge, 14);
    }
    g.fillStyle = col;
    g.fill(p);
  };
  // The core of the shade: away from the sun and under; the middle, and the lit side, toward the sun and up.
  plane(-0.5, 0.28, 0.72, s.under[b - 1], 1);
  plane(0.16, -0.1, 0.8, s.ramp[b + 1], 2);
  if (!job.light.night || L > 0.6) plane(0.38, -0.22, 0.48, s.over[b + 2], 3, true);
  // A leaf or two where the light catches the top lump's edge.
  const R = mulberry32(lumps[0]?.seed ?? 1);
  const u = lumps.reduce((m, v) => (v.y - v.ry < m.y - m.ry ? v : m), lumps[0]);
  if (u) {
    g.fillStyle = s.over[Math.min(top, b + 2)];
    g.beginPath();
    const a = Math.atan2(sun.sy - 0.6, sun.sx) + (R() - 0.5) * 1.2;
    leafOf(job.spec)(g, u.x + Math.cos(a) * u.rx * 0.5, u.y + Math.sin(a) * u.ry * 0.5, u.rx * 0.3, (R() - 0.5) * 0.8, 0.85);
    g.fill();
  }
  g.restore();
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
    const path = new Path2D();
    // A cluster: its lumps' outlines in the one path, filled as one.
    if (s.c.subs) {
      const lumps = lumpsOf(job, s);
      for (const u of lumps) massPath(path, u.x, u.y, u.rx, u.ry, u.o, 1, edgeOf(spec), 24);
      return { o, path, lumps };
    }
    const [cx, cy] = proj(e, s.c.c);
    const rx = s.c.r * ACROSS * s.grown;
    massPath(path, cx, cy, rx, rx * (spec.pad ?? 0.86), o, 1, edgeOf(spec));
    return { o, path, lumps: null };
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
  const foot = spec.open && trunk ? footOf(job) : null;
  if (foot && trunk) {
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(foot.base);
    items.push({ d: near(sk.limbs[0].a) - 0.6, draw: () => paintFoot(g, foot, trunk) });
    // Each buttress by its own depth: those behind the trunk under it, those in front over it.
    foot.lobes.forEach(([a, out], k) => {
      const b = buttress(job, a, out, k);
      items.push({ d: near(b.at) - 0.5, draw: () => b.draw(g) });
    });
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
        const lumps = masses[i].lumps;
        if (lumps) paintCluster(g, job, s, sun, masses[i].path, lumps, rim);
        else paintMass(g, job, s, sun, masses[i].path, masses[i].o, rim);
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
function footPath(job: Job, lobes: Array<[number, number]>): Path2D {
  const rT = job.sk.limbs[0].ra * 1.02;
  return groundShape(job, (t) => {
    let r = rT;
    for (const [a, out] of lobes) r += Math.max(0, out) * Math.pow(Math.max(0, Math.cos(t - a)), 6);
    return r;
  }, lobes.length ? 48 : 32);
}

/** A trunk's foot on the screen: its round base on the ground, and the buttresses standing out of it. */
interface Foot { base: Path2D; lobes: Array<[number, number]> }
function footOf(job: Job): Foot {
  return { base: footPath(job, []), lobes: lobesOf(job) };
}

/** The foot's base filled in the trunk's own bands, carried down across it, so the two are one piece of wood. */
function paintFoot(g: Ctx, foot: Foot, c: Chain): void {
  const [x, y] = c.q[0];
  const [nx, ny] = c.n[0];
  const ax = c.q[1][0] - x, ay = c.q[1][1] - y;
  const al = Math.hypot(ax, ay) || 1;
  const ux = (ax / al) * 400, uy = (ay / al) * 400;
  const r = c.r[0];
  g.save();
  g.clip(foot.base);
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
  g.restore();
}

/**
 * One buttress, standing out of the trunk's foot: a ridge from high on the
 * trunk running down to the ground at its end, its two sides falling from
 * the ridge to the ground. Each side lit as it faces, the far one laid
 * first; moss low on a shaded side; snow along the ridge in winter; inked
 * along the ground and round its end. Where it stands, for its depth, and
 * how to draw it.
 */
function buttress(job: Job, a: number, out: number, k: number): { at: V3; draw: (g: Ctx) => void } {
  const { sk, spec, light, e } = job;
  const base = sk.limbs[0].a;
  const rT = sk.limbs[0].ra * 1.02;
  const dir: V3 = [Math.cos(a), Math.sin(a), 0];
  const perp: V3 = [-dir[1], dir[0], 0];
  const r0 = rT * 0.72, r1 = rT + Math.max(rT * 0.3, out);
  const h0 = rT * 0.75, w0 = rT * 0.62;
  const N = 8;
  const ridge: V3[] = [], left: V3[] = [], right: V3[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const c = add(base, mul(dir, r0 + (r1 - r0) * s));
    // Falling steeply off the trunk and running out low; rounded off at its end.
    const z = h0 * Math.pow(1 - s, 2.2) + rT * 0.08 * (1 - s * s);
    const w = w0 * Math.sqrt(Math.max(0, 1 - s * s * s)) * (1 - 0.3 * s);
    ridge.push([c[0], c[1], c[2] + z]);
    left.push(add(c, mul(perp, w)));
    right.push(add(c, mul(perp, -w)));
  }
  const P = (p: V3): Pt => proj(e, p);
  const face = (side: V3[]): Path2D => {
    const p = new Path2D();
    ridge.forEach((q, i) => (i ? p.lineTo(...P(q)) : p.moveTo(...P(q))));
    for (let i = N; i >= 0; i--) p.lineTo(...P(side[i]));
    p.closePath();
    return p;
  };
  // Its sides are steep: lit mostly as the trunk's sides are, a little more from above.
  const nL = unit(add(perp, [0, 0, 0.35])), nR = unit(add(mul(perp, -1), [0, 0, 0.35]));
  // A dead trunk's foot in its dead wood, where that has its own shade.
  const deadFoot = sk.limbs[0].dead ? spec.bark.deadShade : undefined;
  const colOf = (n: V3): string => {
    const lam = Math.max(0, dot(n, light.sun));
    // A step under the limbs' light: a buttress is low, in the trunk's shade much of the day.
    return rgb(mixRgb(hex(deadFoot ?? spec.bark.shade), hex(deadFoot ? spec.bark.dead : spec.bark.lit), 0.6 * clamp01((light.ambient + light.direct * lam - 0.22) / 0.82)));
  };
  const toward = e.toward as V3;
  const sides: Array<[V3[], V3]> = [[left, nL], [right, nR]];
  sides.sort((p, q) => dot(p[1], toward) - dot(q[1], toward));
  return {
    at: add(base, mul(dir, (r0 + r1) / 2)),
    draw: (g) => {
      for (const [side, n] of sides) {
        g.fillStyle = colOf(n);
        g.fill(face(side));
      }
      // Moss low on the side turned from the sun.
      const dark = sides[0][1];
      if (spec.bark.moss && k % 2 === 0 && dot(dark, light.sun) < 0.3) {
        const side = dot(nL, light.sun) < dot(nR, light.sun) ? left : right;
        const m = new Path2D();
        side.forEach((q, i) => (i ? m.lineTo(...P(q)) : m.moveTo(...P(q))));
        for (let i = N; i >= 0; i--) m.lineTo(...P(lerp(side[i], ridge[i], 0.35 + 0.15 * Math.sin(i * 1.7 + k))));
        m.closePath();
        g.globalAlpha = 0.75;
        g.fillStyle = spec.bark.moss;
        g.fill(m);
        g.globalAlpha = 1;
      }
      if (job.dress.season === 'winter') {
        g.strokeStyle = 'rgba(250,252,255,0.9)';
        g.lineWidth = KIT_INK_W * 0.9;
        g.lineCap = 'round';
        g.beginPath();
        ridge.slice(0, N).forEach((q, i) => (i ? g.lineTo(...P(q)) : g.moveTo(...P(q))));
        g.stroke();
      }
      // Ink along the ground and round its end.
      g.strokeStyle = rgb(KIT_INK, 0.85);
      g.lineWidth = KIT_INK_W * 0.9;
      g.lineJoin = 'round';
      g.beginPath();
      left.forEach((q, i) => (i ? g.lineTo(...P(q)) : g.moveTo(...P(q))));
      g.lineTo(...P(ridge[N]));
      for (let i = N; i >= 0; i--) g.lineTo(...P(right[i]));
      g.stroke();
    },
  };
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
  for (const c of sk.clumps) {
    if (!c.subs) { take(c.c, c.r * (sk.leafReach ?? 1.45)); continue; }
    // A cluster by its lumps: each out to its leaves' tips across, and no more than a mass's height up and down.
    for (const u of c.subs) {
      const [x, y] = proj(e, [c.c[0] + u.o[0], c.c[1] + u.o[1], c.c[2] + u.o[2]]);
      const rx = u.r * ACROSS * 1.5 + KIT_INK_W * 2, ry = u.r * ACROSS * 0.86 * 1.5 + KIT_INK_W * 2;
      x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx);
      y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry);
    }
  }
  // A hanging pad out to its fingers' tips (`Clump.pad`).
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

/** A closed outline through `p`: rounded along its first `round` points (its top, `hung`), straight through the rest (its fringe). */
function polyPath(path: Path2D, p: Pt[], round = 0): void {
  path.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < round; i++) {
    const a = p[i], b = p[i + 1];
    path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  for (let i = Math.max(1, round); i < p.length; i++) path.lineTo(p[i][0], p[i][1]);
  path.closePath();
}

/**
 * What a ring of points on the screen covers with something hanging `h`
 * under each: along its top from its leftmost point to its rightmost, then
 * back along its underside with each point let down; `under` marks which
 * of the points are on the underside.
 */
function hung(q: Pt[], h: number[], under?: boolean[], tops?: { n: number }): Pt[] {
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
  if (tops) tops.n = top.length;
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
 * A spray's outline: narrow where it leaves its branch, broad past its
 * middle, its end cut into a few blunt fingers between sharp notches, the
 * fingers hanging lower than the rest and the needles under them longest.
 */
function rimOf(p: Pad, R: () => number): Rim[] {
  const L = p.reach, W = p.w, H = p.hang;
  // A spray: a narrow heel on its branch, widening to a fingered end.
  const wAt = (t: number): number => W * (0.3 + 0.7 * Math.min(1, t * 1.7));
  const out: Rim[] = [];
  for (const t of [0, 0.3]) out.push({ x: t * L, y: -wAt(t), dz: 0, h: H * (0.2 + 0.3 * t), finger: false });
  const xc = 0.62 * L, rx = 0.38 * L, ry = wAt(0.62);
  const F = p.fingers;
  const at = (a: number, k: number, dz: number, h: number, finger: boolean): void => {
    out.push({ x: xc + Math.cos(a) * rx * k, y: Math.sin(a) * ry * k, dz, h, finger });
  };
  for (let j = 0; j <= F; j++) {
    const a = -Math.PI / 2 + (Math.PI * j) / F;
    // A sharp notch, cut deep between two fingers.
    const notch = j === 0 || j === F ? 0.97 : 0.58 + 0.14 * R();
    at(a, notch, 0, H * 0.22, false);
    at(a, notch, 0, H * 0.22, false);
    if (j === F) break;
    // A blunt finger, the ones round the end longest.
    const m = a + Math.PI / (2 * F) + (R() - 0.5) * (Math.PI / (4 * F));
    const half = (Math.PI / (2 * F)) * 0.16;
    const end = 0.55 + 0.45 * Math.cos(m);
    const k = 1.12 + 0.3 * R();
    const dz = -H * (0.25 + 0.3 * R()) * end;
    const h = H * (0.6 + 1.0 * R()) * (0.5 + 0.5 * end);
    at(m - half, k, dz, h, true);
    at(m + half, k * (0.96 + 0.08 * R()), dz, h * (0.9 + 0.2 * R()), true);
  }
  for (const t of [0.3, 0]) out.push({ x: t * L, y: wAt(t), dz: 0, h: H * (0.2 + 0.3 * t), finger: false });
  return out;
}

/**
 * A lacy spray's outline (`Whorls.lace`): a narrow heel widening to a broad
 * end parted into `fingers` lobes between deep notches, each lobe and both
 * sides a scalloped fringe -- shallow notches between small pointed tips
 * hanging under it, `lace` of them across the end, the end's the longest.
 */
function laceRimOf(p: Pad, R: () => number): Rim[] {
  const L = p.reach, W = p.w, H = p.hang, F = Math.max(1, p.fingers), per = Math.max(2, Math.round((p.lace ?? 6) / F));
  const wAt = (t: number): number => W * (0.28 + 0.72 * Math.min(1, t * 1.6));
  const xc = 0.58 * L, rx = 0.42 * L, ry = wAt(0.58);
  const out: Rim[] = [];
  const notch = (x: number, y: number, h: number): void => { out.push({ x, y, dz: 0, h, finger: false }); };
  /** A tip at `x`, `y`, standing out `k` along `nx`, `ny`, its point hanging `h`. */
  const tip = (x: number, y: number, nx: number, ny: number, k: number, h: number): void => {
    out.push({ x: x + nx * k, y: y + ny * k, dz: -h * 0.25, h, finger: true });
  };
  const SIDE = [0.15, 0.3, 0.45];
  notch(0, -wAt(0), H * 0.1);
  for (const t of SIDE) {
    notch(t * L, -wAt(t) * 0.93, H * 0.15);
    tip((t + 0.055) * L, -wAt(t + 0.055), 0.4, -1, W * (0.07 + 0.06 * R()), H * (0.25 + 0.25 * R()));
  }
  // Round the end: each lobe from a deep notch, its tips between shallow ones, to the next deep notch.
  const N = F * per;
  for (let j = 0; j <= N; j++) {
    const a = -Math.PI / 2 + (Math.PI * j) / N;
    const deep = j % per === 0 && j > 0 && j < N;
    const k = j === 0 || j === N ? 0.95 : deep ? 0.66 + 0.1 * R() : 0.9 + 0.05 * R();
    notch(xc + Math.cos(a) * rx * k, Math.sin(a) * ry * k, H * (deep ? 0.12 : 0.24));
    if (j === N) break;
    const m = a + Math.PI / (2 * N) + (R() - 0.5) * (Math.PI / (3 * N));
    const end = 0.5 + 0.5 * Math.cos(m);
    tip(xc + Math.cos(m) * rx, Math.sin(m) * ry, Math.cos(m), Math.sin(m), (0.04 + 0.05 * R()) * L, H * (0.4 + 0.45 * R()) * (0.6 + 0.4 * end));
  }
  for (const t of [...SIDE].reverse()) {
    tip((t + 0.055) * L, wAt(t + 0.055), 0.4, 1, W * (0.07 + 0.06 * R()), H * (0.25 + 0.25 * R()));
    notch(t * L, wAt(t) * 0.93, H * 0.15);
  }
  notch(0, wAt(0), H * 0.1);
  return out;
}

/** A lacy spray's outline is its own whatever the eye: worked out once (`laceRimOf`). */
const laceRims = new WeakMap<Pad, Rim[]>();
function laceRimCached(p: Pad, R: () => number): Rim[] {
  let r = laceRims.get(p);
  if (!r) laceRims.set(p, (r = laceRimOf(p, R)));
  return r;
}
/**
 * A lacy spray's layers' outlines, from its own (`laceRimOf`): the inner
 * layer's without the tips along its sides, the top layer's the end only.
 */
const laceLayers = new WeakMap<Rim[], { end: Rim[]; inner: Rim[] }>();
function layersOf(rim: Rim[], L: number): { end: Rim[]; inner: Rim[] } {
  let o = laceLayers.get(rim);
  if (!o) {
    const last = rim.length - 1;
    o = {
      end: rim.filter((r, i) => i === 0 || i === last || r.x > L * 0.5),
      inner: rim.filter((r, i) => i === 0 || i === last || !r.finger || r.x > L * 0.5),
    };
    laceLayers.set(rim, o);
  }
  return o;
}

/** A spray's thin ink, from its ramp's deepest. */
const rimCols = new Map<string, string>();
function rimOfRamp(ramp: Ramp): string {
  let c = rimCols.get(ramp[0]);
  if (!c) rimCols.set(ramp[0], (c = rgb(mixRgb(hex(ramp[0]), KIT_INK, 0.55), 0.85)));
  return c;
}

/** A bough or the top's tuft, ready to lay: its outline with the needles under it, its planes, and its ink. */
interface Bough { d: number; out: Path2D; planes: Array<[Path2D, string]>; rim: string | null }

/** How lit a face turned `n` is, as a mass is (`clumpLight`): wrapped round, the lower whorls in the upper ones' shade. */
function faceLight(job: Job, n: V3, up: number): number {
  const wrap = clamp01((dot(n, job.light.sun) + 0.3) / 1.3);
  return (job.light.ambient + job.light.direct * wrap) * (0.7 + 0.3 * up);
}

/**
 * How far round a spray, and its branch, is turned aside from pointing at
 * the eye: the whorls part up the front so the trunk shows between them, as
 * the flat conifers hang a pair either side of the trunk.
 */
function partOf(e: Eye, d: V3): number {
  const ex = e.toward[0], ey = e.toward[1];
  const el = Math.hypot(ex, ey) || 1;
  const phi = Math.atan2((ex * d[1] - ey * d[0]) / el, (ex * d[0] + ey * d[1]) / el);
  if (Math.abs(phi) >= PART) return 0;
  return (phi < 0 ? -1 : 1) * (PART + Math.abs(phi) * 0.3) - phi;
}
/** `p` turned `a` about the upright through `o`. */
function spin(p: V3, o: V3, a: number): V3 {
  if (!a) return p;
  const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1];
  return [o[0] + x * c - y * s, o[1] + x * s + y * c, p[2]];
}

/**
 * A spray laid on its branch: its outline with the needles hanging under it
 * filled in its underside's tone, its top in the top's, and a smooth lit
 * band along the top toward the sun -- three flat planes -- with a thin rim
 * of ink, the heavy ink being the tree's own outline (`paintWhorls`).
 */
function boughOf(job: Job, s: Shown, all: Path2D[], turnBy: number): Bough {
  const { e, light, dress, spec } = job;
  const c = s.c;
  const p = c.pad as Pad;
  const R = mulberry32(job.seed * 977 + Math.round(c.k * 1e6));
  const base = add(c.c, p.base);
  const root = spin(add(c.c, p.root), base, turnBy);
  const top = s.ramp.length - 1;
  const rimCol = rimOfRamp(s.ramp);
  const out = new Path2D();
  const planes: Array<[Path2D, string]> = [];
  const winter = dress.season === 'winter';
  const snow = (l: number): string => rgb(mixRgb(hex('#c4d0e4'), hex('#fbfcff'), clamp01(l)));
  const d = spin(p.d, [0, 0, 0], turnBy);
  const centre = add(root, [d[0] * p.reach * 0.5, d[1] * p.reach * 0.5, -(root[2] - c.c[2])]);
  const side: V3 = [-d[1], d[0], 0];
  const L = p.reach, W = p.w;
  // Out nearly level, falling only over its outer part; a lacy spray swept up a little first and its sides falling away.
  const lace = p.lace !== undefined;
  const at = (x: number, y: number, dz: number): V3 => {
    const t = Math.max(0, x / L);
    const z = -p.drop * Math.pow(t, 2.4) + L * 0.05 * Math.sin(Math.PI * t) - 0.1 * (y * y) / W + dz;
    return [root[0] + d[0] * x + side[0] * y, root[1] + d[1] * x + side[1] * y, root[2] + z];
  };
  // A lacy spray's points straight onto the screen, as `proj(e, at(...))` would put them.
  const [ox, oy] = proj(e, root), [dx, dy] = projVec(e, d), [wx, wy] = projVec(e, side);
  const laceAt = (x: number, y: number, dz: number): Pt => {
    const t = Math.max(0, x / L);
    const z = -p.drop * Math.pow(t, 1.8) + L * 0.1 * Math.sin(Math.PI * t * 0.8) - 0.3 * (y * y) / W + dz;
    return [ox + dx * x + wx * y, oy + dy * x + wy * y - z * HEIGHT_SCALE];
  };
  const rim = lace ? laceRimCached(p, R) : rimOf(p, R);
  const q = lace ? rim.map((r) => laceAt(r.x, r.y, r.dz)) : rim.map((r) => proj(e, at(r.x, r.y, r.dz)));
  const hs = rim.map((r) => r.h * HEIGHT_SCALE);
  const under: boolean[] = [];
  const tops = { n: 0 };
  const outline = hung(q, hs, under, tops);
  // A lacy spray's top rounded, its fringe in straight strokes: its many small tips sharp.
  if (lace) polyPath(out, outline, tops.n);
  else roundPath(out, outline);
  all.push(out);
  // The light on its top, sloping out and down, and on the needles hanging off its end.
  const slope = p.drop / L;
  const nTop = unit([d[0] * slope, d[1] * slope, 1]);
  const lt = faceLight(job, nTop, c.up);
  const lh = faceLight(job, d, c.up);
  const bt = Math.max(1, Math.min(top - 2, Math.round(lt * (top - 1.2))));
  const bh = Math.max(0, Math.min(top - 3, Math.round(lh * (top - 1.2)) - 2));
  // Behind the leader: the sprays in front hide all of it but its edge, which is in one tone between its top's and its underside's.
  const tw = Math.hypot(e.toward[0], e.toward[1]) || 1;
  if ((d[0] * e.toward[0] + d[1] * e.toward[1]) / tw < -0.55) {
    planes.push([out, s.ramp[Math.max(1, Math.round((bt + bh) / 2))]]);
    return { d: dot(centre, e.toward as V3), out, planes, rim: null };
  }
  planes.push([out, s.ramp[lace ? Math.min(bh, 2) : bh]]);
  // A lacy spray's top is its layers.
  if (!lace) {
    const face = new Path2D();
    roundPath(face, q);
    planes.push([face, s.ramp[bt]]);
  }
  // The lit band: along its top from near its heel to short of its fingers, toward the sun's side.
  const sx = light.sun[0], sy = light.sun[1];
  const sl = Math.hypot(sx, sy) || 1;
  const toSun = (d[0] * sx + d[1] * sy) / sl, across = (side[0] * sx + side[1] * sy) / sl;
  const band = (x0: number, x1: number, ky: number, lift: number): Path2D => {
    const pp = new Path2D();
    const pts: Pt[] = [];
    for (const r of rim) {
      if (r.finger) continue;
      const t = r.x / L;
      pts.push(proj(e, at(L * (x0 + (x1 - x0) * t), (r.y * ky) + W * 0.25 * across, lift)));
    }
    roundPath(pp, pts);
    return pp;
  };
  if (lace) {
    // A lacy spray's top in layers, each a smaller spray on the one under it with its own fringe hanging over it: lit toward the sun, snowed on in winter.
    // The top layer's outline is the end of the spray's only.
    const { end, inner } = layersOf(rim, L);
    const layer = (x0: number, x1: number, ky: number, lift: number, hk: number, of = rim): Path2D => {
      const pts = of.map((r) => laceAt(L * x0 + (x1 - x0) * r.x, r.y * ky + W * 0.2 * across, r.dz * hk + lift));
      const pp = new Path2D();
      const n = { n: 0 };
      polyPath(pp, hung(pts, of.map((r) => r.h * hk * HEIGHT_SCALE), undefined, n), n.n);
      return pp;
    };
    const lit = (!light.night || lt > 0.6) && toSun > -0.6;
    // By day every spray's top is lit over its deep underside, the most toward the sun.
    const day = !light.night;
    const step = (i: number, lo: number, hi: number): string => s.ramp[Math.max(0, Math.min(top, day ? Math.max(lo, Math.min(hi, i)) : i))];
    if (winter) planes.push([layer(0.2, 0.95, 0.62, 0.3, 0.25), snow(lt * 1.1)]);
    else {
      planes.push([layer(0.1, 0.98, 0.8, 0.1, 0.5, inner), step(bt - 1, 2, 4)]);
      if (lit || day) planes.push([layer(0.3, 0.95, 0.56, 0.22, 0.42, end), step(bt + (toSun > 0.2 ? 2 : 1), 4, top)]);
    }
  } else if (winter) {
    planes.push([band(0.08, 0.86, 0.66, 0.25), snow(lt * 1.1)]);
  } else if ((!light.night || lt > 0.6) && toSun > -0.6) {
    planes.push([band(0.08, 0.84, 0.68, 0.08), s.ramp[Math.min(top, bt + (toSun > 0.2 ? 2 : 1))]]);
  }
  // New growth on the ends of the fingers through the spring: the tip of each, where it hangs in sight or lies on the top.
  if (dress.season === 'spring') {
    const tips = new Path2D();
    const k = dress.step === 0 ? 0.22 : 0.38;
    const seen = (i: number): Pt => (under[i] ? [q[i][0], q[i][1] + hs[i]] : q[i]);
    // A lacy spray's tips are single points: each tip with a little of the edge either side of it.
    if (lace) for (let i = 1; i + 1 < rim.length; i++) {
      if (!rim[i].finger) continue;
      const a = seen(i), na = seen(i - 1), nb = seen(i + 1);
      tips.moveTo(a[0], a[1]);
      tips.lineTo(a[0] + (nb[0] - a[0]) * k * 1.6, a[1] + (nb[1] - a[1]) * k * 1.6);
      tips.lineTo(a[0] + (na[0] - a[0]) * k * 1.6, a[1] + (na[1] - a[1]) * k * 1.6);
      tips.closePath();
    }
    else for (let i = 1; i + 2 < rim.length; i++) {
      if (!rim[i].finger || !rim[i + 1].finger) continue;
      const a = seen(i), b = seen(i + 1), na = seen(i - 1), nb = seen(i + 2);
      roundPath(tips, [a, b, [b[0] + (nb[0] - b[0]) * k, b[1] + (nb[1] - b[1]) * k], [a[0] + (na[0] - a[0]) * k, a[1] + (na[1] - a[1]) * k]]);
      i++;
    }
    planes.push([tips, spec.leaf.spring[Math.min(top, bt + 2)]]);
  }
  return { d: dot(centre, e.toward as V3), out, planes, rim: rimCol };
}
/** How far round from the eye a spray is turned aside, at the least, in radians. */
const PART = 0.28;

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
  const { e } = job;
  const near = (p: V3): number => dot(p, e.toward as V3);
  // Each spray's turn aside from the eye, and its branch turned with it.
  // A crown parted only low (`Skeleton.parted`): its sprays above that over the trunk, but for a few.
  const low = job.sk.parted;
  const turns = job.sk.clumps.map((c) => (c.pad && (low === undefined || c.up < low || c.k < 0.08) ? partOf(e, c.pad.d) : 0));
  const limbs = job.sk.limbs.map((L) => {
    const a = L.pad !== undefined ? turns[L.pad] : 0;
    if (!a) return L;
    const c = job.sk.clumps[L.pad as number];
    const o = add(c.c, (c.pad as Pad).base);
    return { ...L, a: spin(L.a, o, a), b: spin(L.b, o, a) };
  });
  const sk = { ...job.sk, limbs };
  // The branches behind the leader are hidden by the boughs in front of it.
  const el = Math.hypot(e.toward[0], e.toward[1]) || 1;
  const behind = (L: Limb): boolean => {
    if (L.pad === undefined) return false;
    const d = spin((job.sk.clumps[L.pad].pad as Pad).d, [0, 0, 0], turns[L.pad]);
    return (d[0] * e.toward[0] + d[1] * e.toward[1]) / el < -0.55;
  };
  // A dense crown (`Skeleton.core`) hides its branches: only the trunk, the roots and the dead stubs are looked at.
  const chains = chainsOf({ ...job, sk }, (sk.core ?? 0) >= 0.4).filter((c) => !behind(sk.limbs[c.pieces[0]]));
  const all: Path2D[] = [];
  const kept = keptOf(job);
  const boughs = kept.map((s, i) => boughOf(job, s, all, turns[i]));
  const core = sk.core && kept.length ? coreOf(job, kept[0].ramp) : null;
  if (core) all.push(core.path);
  g.strokeStyle = rgb(KIT_INK);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = KIT_INK_W * 2;
  for (const p of all) g.stroke(p);
  // The branches' ink in one stroke, as thick as the thickest of them.
  const twigs = new Path2D();
  let tw = 0;
  for (const c of chains) {
    if (c.thin) {
      c.q.forEach(([x, y], j) => (j ? twigs.lineTo(x, y) : twigs.moveTo(x, y)));
      tw = Math.max(tw, c.r[0] + c.r[c.r.length - 1]);
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
  g.lineWidth = tw + KIT_INK_W * 2;
  g.stroke(twigs);
  const items: Item[] = [];
  // The crown's dark middle, behind all of it.
  if (core) items.push({ d: -1e6, draw: () => { g.fillStyle = core.col; g.fill(core.path); } });
  // A buttressed foot, as an open crown's (`paintTree3d`).
  const trunk = chains.find((c) => c.order === 0);
  if (job.spec.buttress && trunk) {
    const foot = footOf(job);
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(foot.base);
    items.push({ d: near(sk.limbs[0].a) - 0.6, draw: () => paintFoot(g, foot, trunk) });
    foot.lobes.forEach(([a, out], k) => {
      const b = buttress(job, a, out, k);
      items.push({ d: near(b.at) - 0.5, draw: () => b.draw(g) });
    });
  }
  if (job.spec.undergrowth) undergrowth(g, job, items);
  for (const c of chains) {
    // The leader is laid whole, where the leader stands: everything is laid by how near it is along the ground.
    if (c.order === 0) {
      const L = sk.limbs[c.pieces[0]];
      items.push({ d: near(L.a) - 0.5, draw: () => paintChain(g, job, c, 0, c.q.length - 1, mulberry32(job.seed + c.pieces[0] * 13)) });
      continue;
    }
    // A branch is laid whole, where its middle is; so is a cedar's (`Skeleton.core`), however thick.
    if (c.thin || (sk.core !== undefined && c.order === 3)) {
      const L = sk.limbs[c.pieces[Math.floor(c.pieces.length / 2)]];
      items.push({ d: near(L.a), draw: () => paintChain(g, job, c, 0, c.q.length - 1, mulberry32(job.seed + c.pieces[0] * 13)) });
      continue;
    }
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
        if (!b.rim) return;
        g.strokeStyle = b.rim;
        g.lineWidth = KIT_INK_W * 0.55;
        g.lineJoin = 'round';
        g.stroke(b.out);
      },
    });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  paintCarving(g, job);
  // An inked rune has its glow (`inkedRune`).
  if (!job.spec.inkedRune) runeGlow(g, job);
}

/**
 * A conifer's dark middle round its leader (`Skeleton.core`), seen through
 * the gaps between its whorls: from under the lowest boughs to the top
 * whorl, as wide as so much of each whorl's reach, its sides scalloped.
 */
function coreOf(job: Job, ramp: Ramp): { path: Path2D; col: string } {
  const { sk, e } = job;
  const k = sk.core ?? 0;
  const pads: Array<[number, number, number]> = [];
  for (const c of sk.clumps) {
    if (!c.pad) continue;
    const b = add(c.c, c.pad.base), r = add(c.c, c.pad.root);
    pads.push([b[2], Math.hypot(r[0] - b[0], r[1] - b[1]) + c.pad.reach, c.pad.drop]);
  }
  const trunk = sk.limbs.filter((l) => l.order === 0);
  const axis = (z: number): V3 => {
    const L = trunk.find((l) => l.b[2] >= z) ?? trunk[trunk.length - 1];
    return lerp(L.a, L.b, clamp01((z - L.a[2]) / Math.max(1e-6, L.b[2] - L.a[2])));
  };
  const z0 = Math.min(...pads.map(([z, , dr]) => z - dr * 0.6));
  const z1 = Math.max(...pads.map(([z]) => z));
  const N = 14;
  const left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const z = z0 + ((z1 - z0) * i) / N;
    // The reach of the boughs about this height.
    let r = 0;
    for (const [pz, reach, dr] of pads) if (z <= pz + 1 && z >= pz - dr - 2) r = Math.max(r, reach);
    r *= k * (i === 0 ? 0.55 : i % 2 ? 1.08 : 0.9) * ACROSS;
    const [x, y] = proj(e, axis(z));
    left.push([x - r, y]);
    right.push([x + r, y]);
  }
  const path = new Path2D();
  roundPath(path, [...left, ...right.reverse()]);
  return { path, col: ramp[1] };
}

/**
 * Stones and ferns round a tree's foot (`Species3D.undergrowth`), each laid
 * by its depth: a few stones lit as the ground is, snowed on in winter, and
 * the island's own ferns and tufts (`sprigOf`) out of winter.
 */
function undergrowth(g: Ctx, job: Job, items: Item[]): void {
  const { sk, e, light, spec } = job;
  const R = mulberry32(job.seed * 53 + 11);
  const r0 = sk.limbs[0].ra;
  const toward = e.toward as V3;
  const winter = job.dress.season === 'winter';
  const stone = spec.undergrowth?.stone ?? [168, 166, 178];
  const sun = sunOnScreen(job);
  const a0 = R() * TAU;
  const n = 5 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + (R() - 0.5) * 0.6;
    const d = r0 * (1.15 + 0.7 * R());
    const p: V3 = [Math.cos(a) * d, Math.sin(a) * d, 0];
    const fern = i % 2 === 1;
    const size = 0.6 + 0.5 * R();
    if (fern) {
      if (winter) continue;
      const kind = i % 4 === 1 ? 'fern' : 'tuft';
      const sp = sprigOf(kind, Math.floor(R() * 4));
      const k = (kind === 'fern' ? 0.55 : 0.6) * size;
      items.push({ d: dot(p, toward), draw: () => {
        const [x, y] = proj(e, p);
        g.drawImage(sp.canvas, x - sp.ax * k, y - sp.ay * k, sp.w * k, sp.h * k);
      } });
      continue;
    }
    const r = r0 * (0.2 + 0.14 * R()) * ACROSS;
    const o = outlineOf(R, 0);
    items.push({ d: dot(p, toward), draw: () => {
      const [x, y] = proj(e, p);
      const l = clamp01((light.ambient + light.direct * Math.max(0, light.sun[2]) - 0.22) / 0.82);
      const body = new Path2D();
      massPath(body, x, y - r * 0.35, r, r * 0.72, o, 0, LEAF_EDGE, 12);
      g.fillStyle = rgb(mixRgb(stone, hex('#3e3040'), 0.42 - 0.2 * l));
      g.fill(body);
      g.save();
      g.clip(body);
      const top = new Path2D();
      massPath(top, x + sun.sx * r * 0.25, y - r * 0.62, r * 0.78, r * 0.48, o, 0, LEAF_EDGE, 12);
      g.fillStyle = winter ? '#f4f7fd' : rgb(mixRgb(stone, [255, 250, 240], 0.15 * l));
      g.fill(top);
      g.restore();
      g.strokeStyle = rgb(KIT_INK, 0.85);
      g.lineWidth = KIT_INK_W * 0.8;
      g.stroke(body);
    } });
  }
}
