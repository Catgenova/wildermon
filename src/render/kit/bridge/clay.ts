import { cut, glyphPath, lightOf, proj, RUNE_GOLD } from '../../runestone';
import { css, faceColour, hex, mix, type Ctx, type RGB, type Tone, type V3 } from '../core';
import { bayAt, box, ownerOf, RAMP_CUTWATER, RAMP_WALL, rampReturns, refugeGaps, refugeHalf, samples, turned, U, type Bay, type BridgePainter, type FaceInfo, type Kit, type L, type Part3, type Pier, type Plan, type Role } from './core';

/**
 * What the two clay bridges share, built their own way rather than the
 * core's: an arcade whose arch rings keep their depth all the way down to
 * the springing (radiating voussoirs for the brick, a soft rolled band for
 * the adobe), and the pieces a material needs about it -- imposts, piers,
 * keystones -- each cut to the slice it is drawn in.
 */

const EPS = 1e-6;

export const fi = (role: Role, x0: number, x1: number, y0: number, y1: number, seed: number, along?: boolean): FaceInfo => ({ role, x0, x1, y0, y1, seed, along });
/** The frame of an outer face at `t`: `x` along the bridge in units (backwards on the low edge, so nothing on it reads mirrored), `y` up. */
export const wallFrame = (t: number, out: number): { o: L; a: L; b: L } => ({ o: [0, t, 0], a: [out > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] });

/** A number off two whole numbers, the same wherever it is asked: what tint a brick is fired. */
export function hash2(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A polygon of the frame cut to the slice's run along the bridge. */
export function clipS(pts: L[], s0: number, s1: number): L[] {
  let out = pts;
  for (const [lim, lo] of [[s0, true], [s1, false]] as Array<[number, boolean]>) {
    const inp = out;
    out = [];
    const keep = (p: L): boolean => (lo ? p[0] >= lim - EPS : p[0] <= lim + EPS);
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ia = keep(a), ib = keep(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const u = (lim - a[0]) / (b[0] - a[0]);
        out.push([lim, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

/** A polygon of the frame cut to where `f` of a point is not below nought (linear along any edge). */
export function clipBy(pts: L[], f: (p: L) => number): L[] {
  const out: L[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const u = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
  }
  return out.length >= 3 ? out : [];
}

/** The ground along an outer edge across the slice, a line from its start to its end: what a ring or a pier is buried in at a bank. */
export function groundLine(k: Kit, t: number): (p: L) => number {
  const { sl, plan } = k;
  const g0 = plan.ground(sl.s0, t) - 0.3, g1 = plan.ground(sl.s1, t) - 0.3;
  return (p) => p[2] - (g0 + ((g1 - g0) * (p[0] - sl.s0)) / Math.max(1e-6, sl.s1 - sl.s0));
}

/** Whether a bridge has refuges over its piers: two lanes or more, and not a ramp (`refugeGaps`). */
export const refuged = (plan: Plan): boolean => refugeGaps(plan).length > 0;

/** Whether an outer edge is the one toward the eye: what stands out from the far one, under the deck, is hidden by the bridge. */
export const seen = (k: Kit, edge: number): boolean => k.sl.near === edge;

/**
 * The kit for something drawn whole from `a` to `b` along the bridge by the
 * one slice that owns it (`ownerOf`, the nearer the eye where it straddles a
 * cut, which is laid after the other): its run widened to take it in, or
 * null in the slice that does not own it. A refuge over a pier on a cut is
 * then never half under the next slice's vault.
 */
export function whole(k: Kit, a: number, b: number): Kit | null {
  if (ownerOf(k, a, b) === null) return null;
  return { ...k, sl: { ...k.sl, s0: Math.min(k.sl.s0, a - 0.05), s1: Math.max(k.sl.s1, b + 0.05) } };
}

/** A face cut to the slice. */
export function cface(k: Kit, part: Part3, pts: L[], out: L, tone: Tone, info?: FaceInfo, frame?: { o: L; a: L; b: L }): void {
  const c = clipS(pts, k.sl.s0, k.sl.s1);
  if (c.length >= 3) k.face(part, c, out, tone, info, frame);
}

/** The piers at the start and end of a bay. */
export const piersOf = (plan: Plan, bay: Bay): [Pier, Pier] => [plan.piers.find((p) => Math.abs(p.s - bay.s0) < EPS)!, plan.piers.find((p) => Math.abs(p.s - bay.s1) < EPS)!];

/** Whether `s` is in a bay's opening rather than in a pier. */
export function inOpening(plan: Plan, s: number): boolean {
  const bay = bayAt(plan, s);
  const [p0, p1] = piersOf(plan, bay);
  return s > p0.s + p0.half + EPS && s < p1.s - p1.half - EPS;
}

/* ---- arcs ----------------------------------------------------------------------------- */

/**
 * An arch's intrados as an ellipse in the frame: its middle along the bridge
 * in tiles, its half-span and rise in units, the height of its centre, and
 * the angle it springs at (nought for a round one, more for a segment).
 */
export interface Arc { c: number; A: number; B: number; zc: number; th0: number }

export function arcOf(bay: Bay): Arc {
  if (bay.form === 'low') {
    const A = bay.a * U, r = Math.max(0.5, bay.crown - bay.spring);
    const R = (A * A + r * r) / (2 * r);
    return { c: bay.c, A: R, B: R, zc: bay.crown - R, th0: Math.asin(Math.max(-1, Math.min(1, (R - r) / R))) };
  }
  return { c: bay.c, A: bay.a * U, B: bay.crown - bay.spring, zc: bay.spring, th0: 0 };
}

/**
 * How a bay is carried, as the core plans it (`planOf`): its arch, and over a
 * deep drop two tiers -- a string course, the upper arch springing just over
 * it, and under it a round arch `lowerHalf` either side of the bay's middle,
 * the pier the thicker beside it.
 */
export interface Shape { upper: Arc; arch: (s: number) => number; lower?: Arc; lowerArch?: (s: number) => number; course?: number; lowerHalf?: number }

export function shapeOf(_plan: Plan, bay: Bay, _D: number): Shape {
  const sh: Shape = { upper: arcOf(bay), arch: bay.arch };
  if (bay.lower && bay.course !== undefined && bay.lowerCrown !== undefined && bay.lowerSpring !== undefined) {
    const half = bay.lowerHalf ?? bay.a;
    sh.lower = { c: bay.c, A: half * U, B: bay.lowerCrown - bay.lowerSpring, zc: bay.lowerSpring, th0: 0 };
    sh.lowerArch = bay.lower;
    sh.course = bay.course;
    sh.lowerHalf = half;
  }
  return sh;
}

/** A point `d` units out from the intrados at angle `th`: tiles along, units up. */
export const arcAt = (r: Arc, th: number, d: number): [number, number] => [r.c + ((r.A + d) * Math.cos(th)) / U, r.zc + (r.B + d) * Math.sin(th)];
/** Where the arch springs, its height. */
export const springOf = (r: Arc): number => r.zc + r.B * Math.sin(r.th0);

/** The angles of the joints between `w`-unit voussoirs round the curve `d` out, an odd number of them so one is at the crown. */
export function jointsOf(r: Arc, d: number, w: number): number[] {
  const N = 72, th1 = Math.PI - r.th0;
  const cum = [0];
  let prev = arcAt(r, r.th0, d);
  for (let i = 1; i <= N; i++) {
    const p = arcAt(r, r.th0 + ((th1 - r.th0) * i) / N, d);
    cum.push(cum[i - 1] + Math.hypot((p[0] - prev[0]) * U, p[1] - prev[1]));
    prev = p;
  }
  const len = cum[N];
  let n = Math.max(3, Math.round(len / w));
  if (n % 2 === 0) n++;
  const out: number[] = [];
  for (let j = 0; j <= n; j++) {
    const want = (len * j) / n;
    let i = 1;
    while (i < N && cum[i] < want) i++;
    const u = (want - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    out.push(r.th0 + ((th1 - r.th0) * (i - 1 + Math.min(1, u))) / N);
  }
  return out;
}

/** The band from the intrados to `D` out, round the whole arch, as a polygon of the frame at `t`. */
function bandPoly(r: Arc, D: number, t: number, n: number): L[] {
  const th1 = Math.PI - r.th0;
  const pts: L[] = [];
  for (let i = 0; i <= n; i++) { const [s, z] = arcAt(r, r.th0 + ((th1 - r.th0) * i) / n, D); pts.push([s, t, z]); }
  for (let i = n; i >= 0; i--) { const [s, z] = arcAt(r, r.th0 + ((th1 - r.th0) * i) / n, 0); pts.push([s, t, z]); }
  return pts;
}

/** Each arch of the plan that reaches into the slice, with its bay's shape. */
function arcsIn(k: Kit, D: number): Array<{ sh: Shape; arc: Arc }> {
  const out: Array<{ sh: Shape; arc: Arc }> = [];
  for (const bay of k.plan.bays) {
    const sh = shapeOf(k.plan, bay, D);
    for (const arc of [sh.upper, sh.lower]) {
      if (!arc) continue;
      const reach = (arc.A + D) / U;
      if (arc.c + reach < k.sl.s0 - EPS || arc.c - reach > k.sl.s1 + EPS) continue;
      out.push({ sh, arc });
    }
  }
  return out;
}

/* ---- the arcade ---------------------------------------------------------------------- */

export interface ArcadeLook {
  /** How deep the ring is, and how proud of the wall. */
  ringD: number;
  proud: number;
  /** The ring: radiating voussoirs (faces, painted) or a soft rolled band (no line round it). */
  ring: 'voussoir' | 'soft';
  /** The keystone: a wedge of cut stone, or a round plaque. */
  key: 'wedge' | 'plaque';
  keyTone: (st: Kit['st']) => Tone;
  /** The piers' outer faces: a pointed cutwater, or a round buttress. */
  pier: 'cutwater' | 'round';
  /** Imposts of cut stone under each springing. */
  impost?: (st: Kit['st']) => Tone;
  /** Two tiers: the top of the lower tier between the faces, seen through the upper arches, in the shade of the vault over it. */
  inner: (st: Kit['st']) => Tone;
  /** Dressed quoins up each jamb of an opening, long and short by turns, as the houses' corners have. */
  quoins?: (st: Kit['st']) => Tone;
  /** At two lanes and more the refuge builds the pier's outer face itself (no cutwater). */
  refugePier?: boolean;
}

/** What a ring's painter is told besides the face: its arch, its depth and its joints. */
export interface RingInfo extends FaceInfo { arc?: Arc; D?: number; joints?: number[]; outer?: number[] }

export function arcade(look: ArcadeLook): (k: Kit) => void {
  return (k) => {
    const { plan, sl, st } = k;
    const breaks: number[] = [];
    for (const p of plan.piers) breaks.push(p.s - p.half, p.s + p.half, p.s);
    for (const bay of plan.bays) breaks.push(bay.c, ...(bay.lowerHalf !== undefined ? [bay.c - bay.lowerHalf, bay.c + bay.lowerHalf] : []));
    const xs = samples(sl.s0, sl.s1, breaks, 0.125);
    const deckBottom = (s: number): number => plan.deck(s) - plan.thick - 1.4;
    const D = look.ringD;
    const arcs = arcsIn(k, D);
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const fr = wallFrame(t, edge);
      // The wall: a pier from the ground to the deck, a spandrel over each opening, one face (and two tiers' lower spandrels).
      k.solid('front', k.ord(edge, -1));
      const bot: L[] = [], topl: L[] = [];
      let lower: L[] = [];
      const lowers: L[][] = [];
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b = xs[j + 1], mid = (a + b) / 2;
        const open = inOpening(plan, mid), sh = shapeOf(plan, bayAt(plan, mid), D);
        const z = (s: number): number => (open ? sh.arch(s) : plan.ground(s, t) - 0.5);
        bot.push([a, t, z(a)], [b, t, z(b)]);
        topl.push([a, t, deckBottom(a)], [b, t, deckBottom(b)]);
        if (open && sh.lowerArch && sh.course !== undefined) {
          const bay = bayAt(plan, mid);
          const lz = (s: number): number => (Math.abs(mid - bay.c) < sh.lowerHalf! ? sh.lowerArch!(s) : plan.ground(s, t) - 0.5);
          if (!lower.length) lower.push([a, t, sh.course], [a, t, lz(a)]);
          else lower.push([a, t, lz(a)]);
          lower.push([b, t, lz(b)]);
        } else if (lower.length) { lowers.push(lower); lower = []; }
        if (j + 2 === xs.length && lower.length) { lowers.push(lower); lower = []; }
      }
      const wall = [...bot, ...topl.reverse()];
      const zs = wall.map((p) => p[2]);
      k.face('front', wall, [0, edge, 0], st.stone, fi('wall', sl.s0 * U, sl.s1 * U, Math.min(...zs), Math.max(...zs), sl.i), fr);
      for (const lw of lowers) {
        const last = lw[lw.length - 1];
        lw.push([last[0], t, lw[0][2]]);
        const lz = lw.map((p) => p[2]);
        k.face('front', lw, [0, edge, 0], st.stone, fi('wall', lw[0][0] * U, last[0] * U, Math.min(...lz), Math.max(...lz), sl.i), fr);
      }
      // Two tiers: a thin course on the face, the upper arch springing from its top.
      const tt = t + edge * 0.02;
      k.solid('front', k.ord(edge, 0.3));
      for (let j = 0; j + 1 < xs.length; j++) {
        const a = xs[j], b = xs[j + 1], sh = shapeOf(plan, bayAt(plan, (a + b) / 2), D);
        if (sh.course === undefined) continue;
        const z = sh.course;
        k.face('front', [[a, tt, z - 1.8], [b, tt, z - 1.8], [b, tt, z], [a, tt, z]], [0, edge, 0], st.trim, fi('cornice', a * U, b * U, z - 1.8, z, sl.i), wallFrame(tt, edge));
        k.face('front', [[a, t, z], [b, t, z], [b, tt, z], [a, tt, z]], [0, 0, 1], st.trim);
      }
      if (!seen(k, edge)) continue;
      if (look.impost) imposts(k, edge, t, look.impost(st), D);
      for (const { arc } of arcs) {
        if (look.ring === 'voussoir') voussoirRing(k, edge, t, arc, D, look.proud);
        else softRing(k, edge, t, arc, D);
        keystone(k, edge, t, arc, D, look);
      }
      if (look.quoins) quoins(k, edge, t, look.quoins(st), D);
      if (look.pier === 'cutwater') { if (!(look.refugePier && refuged(plan))) cutwaters(k, edge, t, D); }
      else buttresses(k, edge, t, D);
    }
    // Across the lane: the lower tier's top in the vault's shade, the vault under each arch, and the pier sides facing into the bay.
    k.solid('front', -6);
    let run: [number, number, number] | null = null;
    const inner = look.inner(st);
    const course = (): void => {
      if (!run) return;
      const [a, b, z] = run;
      k.face('front', [[a, sl.t0, z], [b, sl.t0, z], [b, sl.t1, z], [a, sl.t1, z]], [0, 0, 1], inner,
        fi('wall', a * U, b * U, sl.t0 * U, sl.t1 * U, sl.i), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
      run = null;
    };
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1], mid = (a + b) / 2;
      const sh = shapeOf(plan, bayAt(plan, mid), D);
      if (!inOpening(plan, mid) || sh.course === undefined) { course(); continue; }
      if (run && Math.abs(run[2] - sh.course) < 1e-6 && Math.abs(run[1] - a) < 1e-6) run[1] = b;
      else { course(); run = [a, b, sh.course]; }
    }
    course();
    k.solid('back', 0);
    for (let j = 0; j + 1 < xs.length; j++) {
      const a = xs[j], b = xs[j + 1], mid = (a + b) / 2;
      if (!inOpening(plan, mid)) continue;
      const bay = bayAt(plan, mid), sh = shapeOf(plan, bay, D);
      for (const f of [sh.arch, sh.lowerArch]) {
        if (!f) continue;
        if (f === sh.lowerArch && Math.abs(mid - bay.c) >= sh.lowerHalf!) continue;
        const za = f(a), zb = f(b);
        const m = (zb - za) / ((b - a) * U);
        k.face('back', [[a, sl.t0, za], [b, sl.t0, zb], [b, sl.t1, zb], [a, sl.t1, za]], [(bay.c - mid) * 0.3, 0, -1], st.stone,
          fi('ring', a * U, b * U, sl.t0 * U, sl.t1 * U, sl.i, false), { o: [0, 0, za - m * a * U], a: [1 / U, 0, m], b: [0, 1 / U, 0] });
      }
    }
    for (const bay of plan.bays) {
      const [p0, p1] = piersOf(plan, bay);
      for (const [s, dirn] of [[p0.s + p0.half, 1], [p1.s - p1.half, -1]] as Array<[number, number]>) {
        if (s < sl.s0 - EPS || s > sl.s1 + EPS) continue;
        const g0 = plan.ground(s, sl.t0) - 0.5, g1 = plan.ground(s, sl.t1) - 0.5;
        const sh = shapeOf(plan, bay, D);
        const tops: Array<[number, number, number]> = sh.course !== undefined
          ? [[sh.course, sh.course, sh.arch(s)]]
          : [[g0, g1, sh.arch(s)]];
        for (const [z0, z0b, z1] of tops) {
          if (z1 - Math.max(z0, z0b) < 0.1) continue;
          k.solid('back', -1);
          // Under a ramp the arcade is two walls along the outer edges, the deck vaulted between: a pier's side only as deep as its wall.
          for (const [ta, tb] of plan.ramp ? rampReturns(plan, sl) : [[sl.t0, sl.t1]]) {
            const za = ta === sl.t0 ? z0 : z0b, zb = tb === sl.t1 ? z0b : z0;
            k.face('back', [[s, ta, za], [s, tb, zb], [s, tb, z1], [s, ta, z1]], [dirn, 0, 0], st.stone,
              fi('pier', ta * U, tb * U, Math.min(za, zb), z1, Math.round(s * 10)), { o: [s, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
          }
        }
      }
      // Two tiers: the lower arch's sides, from the ground to its springing, where the pier is the thicker under the course.
      const sh = shapeOf(plan, bay, D);
      if (sh.lower && sh.lowerHalf !== undefined) {
        for (const [s, dirn] of [[bay.c - sh.lowerHalf, 1], [bay.c + sh.lowerHalf, -1]] as Array<[number, number]>) {
          if (s < sl.s0 - EPS || s > sl.s1 + EPS) continue;
          const g0 = plan.ground(s, sl.t0) - 0.5, g1 = plan.ground(s, sl.t1) - 0.5, z1 = springOf(sh.lower);
          if (z1 - Math.max(g0, g1) < 0.1) continue;
          k.solid('back', -1);
          k.face('back', [[s, sl.t0, g0], [s, sl.t1, g1], [s, sl.t1, z1], [s, sl.t0, z1]], [dirn, 0, 0], st.stone,
            fi('pier', sl.t0 * U, sl.t1 * U, Math.min(g0, g1), z1, Math.round(s * 10)), { o: [s, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
        }
      }
    }
    // Under a ramp, each wall's inner face over its arches and down its piers, and the wall's underside over each arch.
    if (plan.ramp) {
      for (const edge of sl.edges) {
        const ti = edge > 0 ? sl.t1 - RAMP_WALL : sl.t0 + RAMP_WALL;
        k.solid('back', -0.8);
        const bot: L[] = [], topl: L[] = [];
        for (let j = 0; j + 1 < xs.length; j++) {
          const a = xs[j], b = xs[j + 1], mid = (a + b) / 2;
          const open = inOpening(plan, mid), sh = shapeOf(plan, bayAt(plan, mid), D);
          const z = (s: number): number => (open ? sh.arch(s) : plan.ground(s, ti) - 0.5);
          bot.push([a, ti, z(a)], [b, ti, z(b)]);
          topl.push([a, ti, deckBottom(a)], [b, ti, deckBottom(b)]);
          if (open) {
            const [t0, t1] = edge > 0 ? [ti, sl.t1] : [sl.t0, ti];
            k.face('back', [[a, t0, z(a)], [b, t0, z(b)], [b, t1, z(b)], [a, t1, z(a)]], [0, 0, -1], st.stone);
          }
        }
        const wall = [...bot, ...topl.reverse()];
        const zs = wall.map((q) => q[2]);
        k.face('back', wall, [0, -edge, 0], st.stone, fi('wall', sl.s0 * U, sl.s1 * U, Math.min(...zs), Math.max(...zs), sl.i), wallFrame(ti, -edge));
      }
    }
  };
}


/** A ring of voussoirs proud of the wall, as deep at its springing as at its crown: its face, the top of it and, on the near face, its soffit. */
function voussoirRing(k: Kit, edge: number, t: number, arc: Arc, D: number, proud: number): void {
  const { sl, st } = k;
  const tr = t + edge * proud;
  const n = Math.max(12, Math.round((arc.A / U) * 14));
  const joints = jointsOf(arc, D * 0.5, 2.7);
  const info: RingInfo = { ...fi('ring', 0, 0, 0, 0, Math.round(arc.c * 10), true), arc, D, joints };
  const [sa] = arcAt(arc, Math.PI - arc.th0, D), [sb] = arcAt(arc, arc.th0, D);
  info.x0 = sa * U; info.x1 = sb * U; info.y0 = springOf(arc); info.y1 = arc.zc + arc.B + D;
  k.solid('front', k.ord(edge, 0.5));
  const above = groundLine(k, t);
  const band = clipBy(clipS(bandPoly(arc, D, tr, n), sl.s0, sl.s1), above);
  if (band.length) k.face('front', band, [0, edge, 0], st.ring, info, { o: [0, tr, 0], a: [1 / U, 0, 0], b: [0, 0, 1] });
  const th1 = Math.PI - arc.th0;
  for (let i = 0; i < n; i++) {
    const u0 = arc.th0 + ((th1 - arc.th0) * i) / n, u1 = arc.th0 + ((th1 - arc.th0) * (i + 1)) / n;
    const [s0, z0] = arcAt(arc, u0, D), [s1, z1] = arcAt(arc, u1, D);
    const mid = (s0 + s1) / 2;
    if (Math.max(s0, s1) < sl.s0 - EPS || Math.min(s0, s1) > sl.s1 + EPS) continue;
    if (above([s0, t, z0]) < 0 && above([s1, t, z1]) < 0) continue;
    const outv: L = [mid - arc.c, 0, ((z0 + z1) / 2 - arc.zc) / U];
    cface(k, 'front', [[s0, t, z0], [s1, t, z1], [s1, tr, z1], [s0, tr, z0]], outv, st.ring);
    if (edge === sl.near) {
      const [i0, y0] = arcAt(arc, u0, 0), [i1, y1] = arcAt(arc, u1, 0);
      cface(k, 'front', [[i0, t, y0], [i1, t, y1], [i1, tr, y1], [i0, tr, y0]], [-(mid - arc.c), 0, -((y0 + y1) / 2 - arc.zc) / U], st.ring);
    }
  }
  // Its two ends, on the imposts.
  for (const th of [arc.th0, th1]) {
    const [s0, z0] = arcAt(arc, th, 0), [s1, z1] = arcAt(arc, th, D);
    if (above([s0, t, z0]) < 0) continue;
    cface(k, 'front', [[s0, t, z0], [s1, t, z1], [s1, tr, z1], [s0, tr, z0]], [Math.cos(th) > 0 ? 1 : -1, 0, -0.2], st.ring);
  }
}

/** A band of the coat rolled round the opening, a step paler, with no line round it: a loose drawing, cut to the slice. */
function softRing(k: Kit, edge: number, t: number, arc: Arc, D: number): void {
  const { sl, st } = k;
  const tr = t + edge * 0.004;
  const n = Math.max(16, Math.round((arc.A / U) * 24));
  const zLo = springOf(arc) - 2, zHi = arc.zc + arc.B + D + 2;
  const n3 = (() => { const o = k.m([0, edge, 0]), z = k.m([0, 0, 0]); const v: V3 = [o[0] - z[0], o[1] - z[1], o[2] - z[2]]; const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] as V3; })();
  const [sa] = arcAt(arc, Math.PI - arc.th0, D), [sb] = arcAt(arc, arc.th0, D);
  k.loose('front', (g: Ctx, e) => {
    if ((n3[0] * e.toward[0] + n3[1] * e.toward[1] + n3[2] * e.toward[2]) <= 1e-6) return;
    const L = lightOf(e, n3);
    const fill = faceColour(st.ring, L);
    const P = (p: L): [number, number] => proj(e, k.m(p));
    g.save();
    // Cut to the slice's run, a hair over its cuts so the slices meet.
    const c0 = sl.s0 - 0.004, c1 = sl.s1 + 0.004;
    const gl = groundLine(k, t);
    const gz = (s: number): number => Math.max(zLo, -gl([s, t, 0]));
    const q = [P([c0, tr, gz(c0)]), P([c1, tr, gz(c1)]), P([c1, tr, zHi]), P([c0, tr, zHi])];
    g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    // The band, fading out from the arris.
    for (const [d, al] of [[D, 0.45], [D * 0.66, 0.5], [D * 0.33, 0.6]] as Array<[number, number]>) {
      g.beginPath();
      bandPoly(arc, d, tr, n).forEach((p, i) => { const [x, y] = P(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fillStyle = css(fill, al);
      g.fill();
    }
    // And the arris itself, turned into the light.
    g.beginPath();
    const th1 = Math.PI - arc.th0;
    for (let i = 0; i <= n; i++) { const [s, z] = arcAt(arc, arc.th0 + ((th1 - arc.th0) * i) / n, 0.5); const [x, y] = P([s, tr, z]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokeStyle = css(mix(fill, [255, 252, 244], 0.5), 0.8);
    g.lineWidth = 1.1;
    g.stroke();
    g.restore();
  }, [[sa, tr, zLo], [sb, tr, zHi]], k.ord(edge, 0.5));
}

/** The keystone at an arch's crown, wholly in the slice nearer the eye where it straddles a cut, a rune cut in it. */
function keystone(k: Kit, edge: number, t: number, arc: Arc, D: number, look: ArcadeLook): void {
  const { st } = k;
  const crown = arc.zc + arc.B;
  const tone = look.keyTone(st);
  const tk = t + edge * (look.proud + 0.018);
  const sg = edge > 0 ? 1 : -1;
  if (look.key === 'wedge') {
    const wi = 0.075, wo = 0.11;
    if (ownerOf(k, arc.c - wo, arc.c + wo) === null) return;
    const z0 = crown - 1.8, z1 = crown + D + 1.4;
    k.solid('front', k.ord(edge, 0.8));
    const pts: L[] = [[arc.c - wi, tk, z0], [arc.c + wi, tk, z0], [arc.c + wo, tk, z1], [arc.c - wo, tk, z1]];
    k.face('front', pts, [0, edge, 0], tone, fi('key', -wo * U, wo * U, z0, z1, Math.round(arc.c * 10)), { o: [arc.c, tk, 0], a: [sg / U, 0, 0], b: [0, 0, 1] });
    k.face('front', [[arc.c - wi, t, z0], [arc.c - wi, tk, z0], [arc.c - wo, tk, z1], [arc.c - wo, t, z1]], [-1, 0, -0.1], tone);
    k.face('front', [[arc.c + wi, t, z0], [arc.c + wi, tk, z0], [arc.c + wo, tk, z1], [arc.c + wo, t, z1]], [1, 0, -0.1], tone);
    k.face('front', [[arc.c - wo, t, z1], [arc.c + wo, t, z1], [arc.c + wo, tk, z1], [arc.c - wo, tk, z1]], [0, 0, 1], tone);
    k.face('front', [[arc.c - wi, t, z0], [arc.c + wi, t, z0], [arc.c + wi, tk, z0], [arc.c - wi, tk, z0]], [0, 0, -1], tone);
    k.glow.runes.push({ at: k.m([arc.c, tk, (z0 + z1) / 2]), s: (z1 - z0) * 0.32, glyph: st.rune });
  } else {
    // A round plaque set in the coat over the crown.
    const r = 3.3, rs = r / U;
    if (ownerOf(k, arc.c - rs, arc.c + rs) === null) return;
    const zc = crown + D * 0.5 + 0.6;
    const n = 14;
    const ring = (tt: number): L[] => Array.from({ length: n }, (_, i) => [arc.c + Math.cos((i / n) * Math.PI * 2) * rs, tt, zc + Math.sin((i / n) * Math.PI * 2) * r] as L);
    k.solid('front', k.ord(edge, 0.8));
    k.face('front', ring(tk), [0, edge, 0], tone, fi('key', -r, r, zc - r, zc + r, Math.round(arc.c * 10)), { o: [arc.c, tk, 0], a: [sg / U, 0, 0], b: [0, 0, 1] });
    const a = ring(t), b = ring(tk);
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n, th = ((i + 0.5) / n) * Math.PI * 2;
      k.face('front', [a[i], a[i2], b[i2], b[i]], [Math.cos(th), 0, Math.sin(th) / U], tone);
    }
    k.glow.runes.push({ at: k.m([arc.c, tk, zc]), s: r * 0.55, glyph: st.rune });
  }
}

/** Cut stone under each springing, on the pier's outer face: from a hair inside the opening back over the ring's foot. */
function imposts(k: Kit, edge: number, t: number, tone: Tone, D: number): void {
  const { plan } = k;
  const out = 0.034;
  const [ta, tb] = edge > 0 ? [t - 0.002, t + out] : [t - out, t + 0.002];
  for (const bay of plan.bays) {
    const sh = shapeOf(plan, bay, D);
    // Two tiers: the lower arch's springing only, the upper springing from over the course.
    const arc = sh.lower ?? sh.upper;
    const half = sh.lowerHalf ?? bay.a;
    const z = springOf(arc);
    const back = Math.min(0.12, D / U + 0.04);
    for (const dirn of [-1, 1]) {
      const jamb = bay.c + dirn * half;
      // Not buried in a bank, nor on the ground where an arch springs from it.
      if (z - 1.7 < plan.ground(jamb, t) + 1) continue;
      const s0 = Math.min(jamb - dirn * 0.02, jamb + dirn * back), s1 = Math.max(jamb - dirn * 0.02, jamb + dirn * back);
      box(k, 'front', s0, s1, ta, tb, z - 1.7, z, tone, 'plinth', k.ord(edge, 0.45));
    }
  }
}

/** Quoins up each jamb: blocks two courses high, long and short by turns into the pier, a hair proud of it. */
function quoins(k: Kit, edge: number, t: number, tone: Tone, D: number): void {
  const { plan, sl } = k;
  const tq = t + edge * 0.006;
  const H = 5.2;
  for (const bay of plan.bays) {
    const sh = shapeOf(plan, bay, D);
    const runs: Array<[number, number, number]> = [];
    if (sh.lower && sh.lowerHalf !== undefined) {
      runs.push([sh.lowerHalf, -Infinity, springOf(sh.lower)]);
      if (springOf(sh.upper) - sh.course! > 3) runs.push([bay.a, sh.course!, springOf(sh.upper)]);
    } else runs.push([bay.a, -Infinity, springOf(sh.upper)]);
    for (const [half, from, to] of runs) {
      for (const dirn of [-1, 1]) {
        const jamb = bay.c + dirn * half;
        if (jamb < sl.s0 - 0.1 || jamb > sl.s1 + 0.1) continue;
        const g = Math.max(from, plan.ground(jamb, t) - 0.5);
        for (let z = g, j = 0; z < to - 0.5; z += H, j++) {
          const z1 = Math.min(to, z + H);
          const pier = piersOf(plan, bay)[dirn < 0 ? 0 : 1];
          const room = (Math.abs(pier.s - jamb) + 0.002) * 0.9;
          const w = Math.min(room, (j + Math.round(bay.c * 10)) % 2 ? 0.13 : 0.08);
          const a = jamb, b = jamb + dirn * w;
          if (ownerOf(k, Math.min(a, b), Math.max(a, b)) === null) continue;
          k.solid('front', k.ord(edge, 0.4));
          k.face('front', [[a, tq, z], [b, tq, z], [b, tq, z1], [a, tq, z1]], [0, edge, 0], tone);
        }
      }
    }
  }
}

/** A pointed cutwater on each pier's outer face, from its foot to over its springing, capped with a slope. */
function cutwaters(k: Kit, edge: number, t: number, D: number): void {
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    if (p.s < sl.s0 - p.half - EPS || p.s > sl.s1 + p.half + EPS) continue;
    const bay = bayAt(plan, p.s - 0.01);
    const sh = shapeOf(plan, bay, D);
    const spring = springOf(sh.lower ?? sh.upper);
    // Up to the refuge it carries, or over the springing; under a ramp's run of arches a short one at the foot.
    // Under a ramp the core's (`RAMP_CUTWATER`): plain piers.
    if (plan.ramp && RAMP_CUTWATER <= 0) continue;
    const top = refuged(plan) ? plan.deck(p.s) - plan.thick - 1.4 : plan.ramp ? Math.min(p.foot + 1.5 + RAMP_CUTWATER, spring) : spring + 1;
    const nose = 0.2;
    // Not where the arches spring from the ground: a cutwater there is a stub.
    if (top - (plan.ground(p.s, t) - 0.5) < 6) continue;
    for (const side of [-1, 1]) {
      const sa = p.s, sb = p.s + side * p.half;
      if ((side < 0 && p.s <= sl.s0 + EPS) || (side > 0 && p.s >= sl.s1 - EPS)) continue;
      const tip = t + edge * nose;
      const fb = plan.ground(sb, t) - 0.5, fa = plan.ground(sa, tip) - 0.5;
      k.solid('front', k.ord(edge, 0.2));
      k.face('front', [[sb, t, fb], [sa, tip, fa], [sa, tip, top], [sb, t, top]], [side * 0.5, edge, 0], st.stone,
        fi('pier', 0, Math.hypot(p.half, nose) * U, Math.min(fa, fb), top, Math.round(p.s * 10)), { o: [sb, t, 0], a: [(sa - sb) / Math.hypot(sa - sb, nose) / U, (edge * nose) / Math.hypot(sa - sb, nose) / U, 0], b: [0, 0, 1] });
      if (!refuged(plan)) {
        const capTop = top + nose * U * 0.45;
        k.face('front', [[sb, t, top], [sa, tip, top], [sa, t, capTop]], [side * 0.3, edge * 0.6, 1], st.trim);
      }
    }
  }
}

/* ---- round things ------------------------------------------------------------------------ */

/** How far out a round pier stands from the wall, in tiles: under a refuge, as far as the refuge it carries (the parapet's gap, `refugeHalf`). */
export const roundOut = (p: Pier, plan: Plan): number => (refuged(plan) ? refugeHalf(p) : (p.half + 0.08) * 0.85);

/**
 * A round buttress on each pier's outer face, battered out to its foot:
 * under a refuge, up to the deck's edge to carry it; otherwise to over its
 * springing, rounded off into the wall.
 */
function buttresses(k: Kit, edge: number, t: number, D: number): void {
  const { plan, sl, st } = k;
  const n = 8;
  for (const p of plan.piers) {
    if (p.end) continue;
    // Under a ramp's run of arches, a low battered foot to each pier, as the stone kinds' short cutwaters.
    const R0 = roundOut(p, plan) * (plan.ramp ? 0.72 : 1), R1 = R0 * (plan.ramp ? 1.3 : 1.18);
    if (p.s + R1 < sl.s0 - EPS || p.s - R1 > sl.s1 + EPS) continue;
    const bay = bayAt(plan, p.s - 0.01), bay2 = bayAt(plan, p.s + 0.01);
    const deckBottom = plan.deck(p.s) - plan.thick - 1.4;
    const domeH = R0 * U * 0.55;
    // Under a refuge, up to the deck's edge to carry it; else domed off under the lower of its two springings, into the wall.
    const spring = Math.min(...[bay, bay2].map((b) => { const sh = shapeOf(plan, b, D); return springOf(sh.lower ?? sh.upper); }));
    const top = refuged(plan) ? deckBottom : Math.min(deckBottom - domeH - 0.5, spring - domeH, plan.ramp ? p.foot + 1.5 + 6 : Infinity);
    if (top - (plan.ground(p.s, t) - 0.5) < 3) continue;
    const at = (phi: number, R: number, z: number): L => [p.s + R * Math.sin(phi), t + edge * R * Math.cos(phi), z];
    k.solid('front', k.ord(edge, 0.2));
    for (let i = 0; i < n; i++) {
      const f0 = -Math.PI / 2 + (Math.PI * i) / n, f1 = -Math.PI / 2 + (Math.PI * (i + 1)) / n, fm = (f0 + f1) / 2;
      const g0 = plan.ground(at(f0, R1, 0)[0], at(f0, R1, 0)[1]) - 0.5, g1 = plan.ground(at(f1, R1, 0)[0], at(f1, R1, 0)[1]) - 0.5;
      cface(k, 'front', [at(f0, R1, g0), at(f1, R1, g1), at(f1, R0, top), at(f0, R0, top)], [Math.sin(fm), edge * Math.cos(fm), 0.1], st.stone);
      if (refuged(plan)) continue;
      // The dome over it.
      const rings = 2;
      for (let q = 0; q < rings; q++) {
        const ps0 = (q / rings) * (Math.PI / 2), ps1 = ((q + 1) / rings) * (Math.PI / 2);
        const r0 = R0 * Math.cos(ps0), r1 = R0 * Math.cos(ps1), z0 = top + domeH * Math.sin(ps0), z1 = top + domeH * Math.sin(ps1);
        const pm = (ps0 + ps1) / 2;
        const pts: L[] = q + 1 < rings ? [at(f0, r0, z0), at(f1, r0, z0), at(f1, r1, z1), at(f0, r1, z1)] : [at(f0, r0, z0), at(f1, r0, z0), at(fm, 0, z1)];
        cface(k, 'front', pts, [Math.sin(fm) * Math.cos(pm), edge * Math.cos(fm) * Math.cos(pm), Math.sin(pm) * 2], st.trim);
      }
    }
  }
}

/* ---- parapets ------------------------------------------------------------------------------- */

/** The runs of parapet in a slice: the slice less the refuges' gaps. */
export function runsOf(plan: Plan, s0: number, s1: number): Array<[number, number]> {
  let runs: Array<[number, number]> = [[s0, s1]];
  for (const [g0, g1] of refugeGaps(plan)) {
    runs = runs.flatMap(([a, b]): Array<[number, number]> => {
      if (g1 <= a || g0 >= b) return [[a, b]];
      const out: Array<[number, number]> = [];
      if (g0 > a + 0.02) out.push([a, g0]);
      if (g1 < b - 0.02) out.push([g1, b]);
      return out;
    });
  }
  return runs;
}

/* ---- lamps ---------------------------------------------------------------------------------------- */

/** A lamp post: an iron post on a plinth, a glass lantern and its cap, as the other stone bridges have. */
export function lampPost(k: Kit, part: Part3, s: number, t: number, z: number, plinth: Tone): void {
  const H = 26;
  const iron = { lit: hex('#a6b2c6'), shade: hex('#454c66') } as Tone;
  box(k, part, s - 0.04, s + 0.04, t - 0.04, t + 0.04, z, z + 3, plinth, 'plinth', 4);
  turned(k, part, s, t, z + 3, [[0, 0.02], [H - 6, 0.016], [H - 5, 0.025]], 6, iron, 4.1);
  box(k, part, s - 0.03, s + 0.03, t - 0.03, t + 0.03, z + H - 2, z + H + 2.5, { lit: hex('#ffe7a4'), shade: hex('#e9b468') }, 'lamp', 4.2);
  turned(k, part, s, t, z + H + 2.5, [[0, 0.04], [1.4, 0]], 4, iron, 4.3);
  k.glow.lamps.push(k.m([s, t, z + H]));
}

/* ---- painters ------------------------------------------------------------------------------------- */

const shade = (c: RGB, toward: RGB | string, k: number, a: number): string => css(mix(c, typeof toward === 'string' ? hex(toward) : toward, k), a);

/**
 * Brick in running bond, `course` units a course and `len` a stretcher: each
 * unit its own firing (a tint off two whole numbers, so it is the same brick
 * on either side of a cut), bedded in mortar a step under it, a hair of
 * light along each course's top.
 */
export function brickPaint(course: number, len: number, mortar: string): BridgePainter {
  return (g, k, f) => {
    const x0 = Math.min(f.x0, f.x1) - 1, x1 = Math.max(f.x0, f.x1) + 1;
    const r0 = Math.floor(Math.min(f.y0, f.y1) / course) - 1, r1 = Math.ceil(Math.max(f.y0, f.y1) / course) + 1;
    const pale = shade(k.fill, [255, 246, 236], 0.14, 0.85), deep = shade(k.fill, '#7a4650', 0.14, 0.8), burnt = shade(k.fill, '#6d5a78', 0.18, 0.8);
    const joints = new Path2D(), lit = new Path2D();
    for (let r = r0; r <= r1; r++) {
      const y = r * course, off = (r & 1) * len * 0.5;
      joints.moveTo(x0, y); joints.lineTo(x1, y);
      lit.moveTo(x0, y + course - 0.42); lit.lineTo(x1, y + course - 0.42);
      for (let c = Math.floor((x0 - off) / len); c * len + off < x1; c++) {
        const x = c * len + off;
        const v = hash2(c, r);
        if (v < 0.2) { g.fillStyle = pale; g.fillRect(x, y, len, course); }
        else if (v > 0.9) { g.fillStyle = burnt; g.fillRect(x, y, len, course); }
        else if (v > 0.74) { g.fillStyle = deep; g.fillRect(x, y, len, course); }
        joints.moveTo(x, y); joints.lineTo(x, y + course);
      }
    }
    g.strokeStyle = css(mix(k.fill, [255, 248, 240], 0.3), 0.35);
    g.lineWidth = 0.3;
    g.stroke(lit);
    g.strokeStyle = shade(k.fill, mortar, 0.6, 0.9);
    g.lineWidth = 0.42;
    g.stroke(joints);
  };
}

/**
 * The ring's voussoirs: radiating joints round the arch from the face's own
 * `arc`, each unit fired its own tint, a joint along the middle where two
 * rings of brick on edge are laid one over the other; and under the arch,
 * courses running through the vault.
 */
export function ringPaint(mortar: string, vault: BridgePainter): BridgePainter {
  return (g, k, f, st) => {
    const fr = f as RingInfo;
    if (!f.along || !fr.arc || !fr.joints || fr.D === undefined) { vault(g, k, f, st); return; }
    const { arc, D, joints } = fr;
    const Pt = (th: number, d: number): [number, number] => { const [s, z] = arcAt(arc, th, d); return [s * U, z]; };
    const pale = shade(k.fill, [255, 246, 236], 0.12, 0.8), deep = shade(k.fill, '#7a4650', 0.12, 0.8);
    const lines = new Path2D();
    const half = D * 0.5;
    // Two rings: the inner on the joints given, the outer staggered half a unit.
    for (const [d0, d1, stagger] of [[0, half, 0], [half, D, 0.5]] as Array<[number, number, number]>) {
      for (let j = 0; j + 1 < joints.length; j++) {
        const a = joints[j] + (joints[j + 1] - joints[j]) * stagger, b = joints[j + 1] + (j + 2 < joints.length ? (joints[j + 2] - joints[j + 1]) * stagger : 0);
        const v = hash2(j * 3 + (stagger ? 1 : 0), Math.round(arc.c * 10));
        if (v < 0.22 || v > 0.84) {
          const p = [Pt(a, d0), Pt(b, d0), Pt(b, d1), Pt(a, d1)];
          g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
          g.fillStyle = v < 0.22 ? pale : deep;
          g.fill();
        }
        const [x0, y0] = Pt(a, d0), [x1, y1] = Pt(a, d1);
        if (!(stagger && j === 0)) { lines.moveTo(x0, y0); lines.lineTo(x1, y1); }
      }
    }
    // The joint between the two rings.
    const th1 = Math.PI - arc.th0;
    for (let i = 0; i <= 48; i++) { const [x, y] = Pt(arc.th0 + ((th1 - arc.th0) * i) / 48, half); if (i) lines.lineTo(x, y); else lines.moveTo(x, y); }
    g.strokeStyle = shade(k.fill, mortar, 0.6, 0.9);
    g.lineWidth = 0.4;
    g.stroke(lines);
  };
}

/**
 * A rune cut in a keystone or a plaque, a step larger than the core's so it
 * reads at zoom one, upright in the face's frame (`y` runs up it), inlaid in
 * the runes' gold; a plaque with a rim ruled round it.
 */
export function runeKey(glyph: string, scale = 0.42, rim = false): BridgePainter {
  return (g, k, f) => {
    const x = (f.x0 + f.x1) / 2, y = (f.y0 + f.y1) / 2;
    const w = Math.min(Math.abs(f.x1 - f.x0), Math.abs(f.y1 - f.y0)), s = w * scale;
    g.save();
    g.translate(x, y);
    g.scale(1, -1);
    if (rim) {
      g.beginPath(); g.arc(0, 0, w * 0.4, 0, Math.PI * 2);
      g.strokeStyle = css(mix(k.fill, hex('#7a4a3c'), 0.4), 0.8);
      g.lineWidth = w * 0.05;
      g.stroke();
    }
    cut(g, k.fill, s * 0.3, () => glyphPath(g, glyph, 0, 0, s));
    glyphPath(g, glyph, 0, 0, s);
    g.strokeStyle = RUNE_GOLD;
    g.lineWidth = s * 0.16;
    g.stroke();
    g.restore();
  };
}

/** Courses of brick running through a vault, across the bridge. */
export function vaultPaint(course: number, len: number, mortar: string): BridgePainter {
  return (g, k, f) => {
    const x0 = Math.min(f.x0, f.x1) - 1, x1 = Math.max(f.x0, f.x1) + 1, y0 = Math.min(f.y0, f.y1) - 1, y1 = Math.max(f.y0, f.y1) + 1;
    const p = new Path2D();
    for (let c = Math.floor(x0 / course); c * course < x1; c++) {
      const x = c * course;
      p.moveTo(x, y0); p.lineTo(x, y1);
      const off = (c & 1) * len * 0.5;
      for (let y = Math.floor((y0 - off) / len) * len + off; y < y1; y += len) { p.moveTo(x, y); p.lineTo(x + course, y); }
    }
    g.strokeStyle = shade(k.fill, mortar, 0.5, 0.7);
    g.lineWidth = 0.4;
    g.stroke(p);
  };
}

/** Pavers in herringbone, `w` units wide and twice as long, each its own tint, bedded in a paler sand. */
export function herringbonePaint(w: number, bed: string, cast?: Tone): BridgePainter {
  return (g, k, f) => {
    const fill = cast ? faceColour(cast, k.L) : k.fill;
    if (cast) { g.fillStyle = css(fill); g.fillRect(Math.min(f.x0, f.x1) - 2, Math.min(f.y0, f.y1) - 2, Math.abs(f.x1 - f.x0) + 4, Math.abs(f.y1 - f.y0) + 4); }
    const X0 = Math.floor(Math.min(f.x0, f.x1) / w) - 3, X1 = Math.ceil(Math.max(f.x0, f.x1) / w) + 1;
    const Y0 = Math.floor(Math.min(f.y0, f.y1) / w) - 3, Y1 = Math.ceil(Math.max(f.y0, f.y1) / w) + 1;
    const pale = shade(fill, [255, 246, 236], 0.1, 0.8), deep = shade(fill, '#7a4650', 0.1, 0.75);
    const joints = new Path2D();
    for (let u = X0; u <= X1; u++) {
      for (let v = Y0 + (((u - Y0) % 4) + 4) % 4; v <= Y1; v += 4) {
        // A stretcher along at (u, v) and a header across over it.
        for (const [x, y, bw, bh, id] of [[u, v, 2, 1, 0], [u, v + 1, 1, 2, 1]] as Array<[number, number, number, number, number]>) {
          const h = hash2(u * 2 + id, v);
          if (h < 0.22 || h > 0.86) { g.fillStyle = h < 0.22 ? pale : deep; g.fillRect(x * w, y * w, bw * w, bh * w); }
          joints.rect(x * w, y * w, bw * w, bh * w);
        }
      }
    }
    g.strokeStyle = shade(fill, bed, 0.55, 0.85);
    g.lineWidth = 0.38;
    g.stroke(joints);
  };
}

/** Square tiles laid by hand, `w` units, wide pale joints, each tile its own firing (`vary`: how many tiles of ten are off the field's tone, and how far). */
export function tilePaint(w: number, bed: string, cast?: Tone, vary = 1): BridgePainter {
  return (g, k, f) => {
    const fill = cast ? faceColour(cast, k.L) : k.fill;
    if (cast) { g.fillStyle = css(fill); g.fillRect(Math.min(f.x0, f.x1) - 2, Math.min(f.y0, f.y1) - 2, Math.abs(f.x1 - f.x0) + 4, Math.abs(f.y1 - f.y0) + 4); }
    const x0 = Math.min(f.x0, f.x1) - w, x1 = Math.max(f.x0, f.x1) + w, y0 = Math.min(f.y0, f.y1) - w, y1 = Math.max(f.y0, f.y1) + w;
    const pale = shade(fill, [255, 240, 226], 0.12 * vary, 0.8), deep = shade(fill, '#9a5a50', 0.1 * vary, 0.75);
    const joints = new Path2D();
    for (let i = Math.floor(x0 / w); i * w < x1; i++) {
      for (let j = Math.floor(y0 / w); j * w < y1; j++) {
        const h = hash2(i, j);
        if (h < 0.25 * vary || h > 1 - 0.18 * vary) { g.fillStyle = h < 0.25 ? pale : deep; g.fillRect(i * w, j * w, w, w); }
      }
      joints.moveTo(i * w, y0); joints.lineTo(i * w, y1);
    }
    for (let j = Math.floor(y0 / w); j * w < y1; j++) { joints.moveTo(x0, j * w); joints.lineTo(x1, j * w); }
    g.strokeStyle = css(hex(bed), 0.5 + 0.4 * Math.min(1, vary));
    g.lineWidth = 0.6;
    g.stroke(joints);
  };
}
