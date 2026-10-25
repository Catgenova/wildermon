/**
 * Thorn bush: a knee-to-waist-high thicket of stiff, kinked stems out of one
 * tight foot, criss-crossing, twigs off every kink, spines on the outer wood,
 * small toothed masses of leaf on the twig ends with the dark tangle showing
 * between them. Its colours are `BUSH_DEFS`' and `bushYear`'s: its leaf, its
 * blossom in spring, its turned leaf and haws in autumn, bare in winter with
 * snow along the tops of its stems. The wood is its own dark leaf taken most
 * of the way to the kit's ink.
 */
import { mulberry32 } from '../../../world/noise';
import { HEIGHT_SCALE } from '../../iso';
import { KIT_INK, KIT_INK_W } from '../../kit/core';
import { proj } from '../../runestone';
import { dulled, mix, tone } from '../../trees/kit';
import { ACROSS } from '../paint';
import { outOf } from '../skeleton';
import type { Bush3D, BushJob, Clump, Envelope, Limb, Ramp, Skeleton, V3 } from '../types';
import { add, cross, dot, hex, len, lerp, mixRgb, mul, rgb, turn, unit } from '../vec';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const hexOf = (c: readonly number[]): string => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const INK = hexOf(KIT_INK);

/* ---- the thicket ------------------------------------------------------------------- */

/** Height at the middle of its range, in the trees' units (tenths of a metre). */
const HEIGHT = 9.2;
/** Its half-width against its height. */
const SPREAD = 1.2;
/** Stems out of the foot. */
const STEMS = 8;
/** Kinks up a stem. */
const KINKS = 5;
/** Masses of leaf, and each one's radius against the half-width. */
const MASSES = 44;
const MASS_R = 0.175;
/** A stem's radius at its foot and at its tip; a twig's. */
const STEM_R: readonly [number, number] = [0.45, 0.15];
const TWIG_R: readonly [number, number] = [0.12, 0.05];

/** The thicket grown from a seed. */
export function growThorn(seed: number): Skeleton {
  const R = mulberry32(seed);
  const H = HEIGHT * (0.9 + 0.2 * R());
  const W = H * SPREAD * (0.92 + 0.16 * R());
  const crown: Envelope = { c: [0, 0, H * 0.48], r: W, rz: H * 0.52 };
  const limbs: Limb[] = [];
  const tips: Array<{ p: V3; limb: number }> = [];
  const push = (L: Limb): number => limbs.push(L) - 1;
  // Back toward the middle and up when a stem or twig has run out of the bush's shape.
  const steer = (p: V3, d: V3): V3 => {
    const o = outOf(crown, p);
    if (o < 0.9) return d;
    const home = unit([crown.c[0] - p[0], crown.c[1] - p[1], crown.c[2] + crown.rz * 0.4 - p[2]]);
    return unit(add(mul(d, 1 - 0.55 * clamp01(o - 0.6)), mul(home, 0.55 * clamp01(o - 0.6) + 0.15)));
  };
  const twig = (from: V3, parent: number, d0: V3, n: number, seg: number, r: readonly [number, number], order: number, bough: number): void => {
    let p = from, d = d0, par = parent;
    for (let i = 0; i < n; i++) {
      const b = add(p, mul(d, seg * (0.8 + 0.4 * R())));
      b[2] = Math.max(0.6, b[2]);
      const t0 = i / n, t1 = (i + 1) / n;
      par = push({ a: p, b, ra: r[0] + (r[1] - r[0]) * t0, rb: r[0] + (r[1] - r[0]) * t1, order, parent: par, bough, tip: i === n - 1 });
      p = b;
      // A thorn's wood grows in short stiff runs, each turned off the last.
      d = steer(p, unit(turn(d, unit(cross(d, [R() - 0.5, R() - 0.5, R() - 0.5])), (R() - 0.5) * 1.1)));
      // A fine spur off a twig's middle.
      if (order === 3 && i === 0 && n > 1 && R() < 0.5) {
        const side = unit(turn(d, unit(cross(d, [0, 0, 1])), (R() < 0.5 ? -1 : 1) * (0.8 + 0.5 * R())));
        twig(p, par, side, 1, seg * 0.8, [r[1] * 1.1, r[1] * 0.6], 4, bough);
      }
    }
    tips.push({ p, limb: par });
    if (order === 3) tips.push({ p: lerp(from, p, 0.5), limb: par });
  };
  const a0 = R() * TAU;
  for (let s = 0; s < STEMS; s++) {
    const az = a0 + (s / STEMS) * TAU + (R() - 0.5) * 0.7;
    // Out of a tight foot, leaning out 20 to 50 degrees from upright; the odd one leaning back over the middle.
    const back = R() < 0.25 ? Math.PI * (0.7 + 0.6 * R()) : 0;
    const foot: V3 = [Math.cos(az) * (0.5 + 1.2 * R()), Math.sin(az) * (0.5 + 1.2 * R()), 0];
    const lean = s % 3 === 0 ? 0.15 + 0.3 * R() : 0.55 + 0.5 * R();
    const ad = az + back;
    let d: V3 = unit([Math.cos(ad) * Math.sin(lean), Math.sin(ad) * Math.sin(lean), Math.cos(lean)]);
    const long = H * (1.05 + 0.3 * R());
    const seg = long / KINKS;
    let p = foot, par = -1;
    for (let k = 0; k < KINKS; k++) {
      const b = add(p, mul(d, seg * (0.85 + 0.3 * R())));
      const t0 = k / KINKS, t1 = (k + 1) / KINKS;
      par = push({ a: p, b, ra: STEM_R[0] + (STEM_R[1] - STEM_R[0]) * t0, rb: STEM_R[0] + (STEM_R[1] - STEM_R[0]) * t1, order: 1, parent: par, bough: s, tip: k === KINKS - 1 });
      p = b;
      // The zig-zag: each run turned the other way off the last, and kept inside the bush.
      const side = unit(cross(d, [0, 0, 1]));
      d = steer(p, unit(turn(d, len(side) > 0.1 ? side : [1, 0, 0], (k % 2 ? 1 : -1) * (0.3 + 0.35 * R()))));
      // A twig off every kink past the first, out to the side and up, some back across the middle.
      if (k >= 1) {
        const n = k >= KINKS - 2 ? 2 : 3;
        for (let j = 0; j < (k >= 2 ? 2 : 1); j++) {
          const out = unit(turn(d, unit(cross(d, [R() - 0.5, R() - 0.5, 0.2])), (j ? -1 : 1) * (0.7 + 0.6 * R())));
          twig(p, par, out, n, seg * 0.6, TWIG_R, 3, s);
        }
        // And one back in across the middle: the tangle.
        if (R() < 0.4) {
          const inward = unit([-p[0] + (R() - 0.5) * 2, -p[1] + (R() - 0.5) * 2, 0.3 + R() * 0.6]);
          twig(p, par, inward, 2, seg * 0.55, TWIG_R, 3, s);
        }
      }
    }
    tips.push({ p, limb: par });
  }
  // Leaf over the whole dome, each mass on the twig end nearest it, kept apart so the tangle shows between.
  const clumps: Clump[] = [];
  const r0 = W * MASS_R;
  const spots: Array<{ p: V3; limb: number; o: number }> = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    // A spiral over the dome from its top down to near the ground, just inside its skin.
    const u = (i + 0.5) / N, z = 1 - 1.15 * u, ring = Math.sqrt(Math.max(0, 1 - z * z)), a = i * 2.39996;
    const k = 0.8 + 0.16 * R();
    const q: V3 = [crown.c[0] + Math.cos(a) * ring * crown.r * k, crown.c[1] + Math.sin(a) * ring * crown.r * k, crown.c[2] + z * crown.rz * k];
    let best = tips[0], bd = Infinity;
    for (const t of tips) {
      const d = len([t.p[0] - q[0], t.p[1] - q[1], t.p[2] - q[2]]);
      if (d < bd) { bd = d; best = t; }
    }
    spots.push({ p: lerp(q, best.p, 0.3), limb: best.limb, o: R() });
  }
  spots.sort((x, y) => x.o - y.o);
  for (const t of spots) {
    if (clumps.length >= MASSES) break;
    const r = r0 * (0.8 + 0.4 * R());
    const c: V3 = [t.p[0], t.p[1], Math.max(r * 0.8, t.p[2])];
    if (clumps.some((q) => len([q.c[0] - c[0], q.c[1] - c[1], (q.c[2] - c[2]) * 1.2]) < (q.r + r) * 0.6)) continue;
    clumps.push({ c, r, limb: t.limb, k: R(), out: clamp01(outOf(crown, c)), up: clamp01(c[2] / (H * 1.05)) });
  }
  return { limbs, clumps, crown, height: H, rune: null, hollow: null, leafReach: 1.2, foot: W * ACROSS * 0.45 };
}

/* ---- colours ------------------------------------------------------------------------ */

/** A ramp of seven from the leaf's two tones (light, dark), matte: dulled toward grey, no bright top. */
const rampOf = ([lit, deep]: readonly [string, string]): Ramp => {
  const l = dulled(lit, 0.12), d = dulled(deep, 0.1);
  return [mix(tone(d, -0.3), INK, 0.3), mix(tone(d, -0.14), INK, 0.1), d, mix(d, l, 0.45), mix(d, l, 0.75), l, tone(l, 0.1)];
};
/** The wood: its dark leaf most of the way to ink, in shade and in the light. */
const barkOf = (dark: string): { shade: string; lit: string } => ({ shade: tone(mix(dark, INK, 0.7), -0.35), lit: mix(dulled(dark, 0.55), INK, 0.4) });

/* ---- painting ------------------------------------------------------------------------- */

interface Seg { qa: Pt; qb: Pt; w: number; L: Limb; d: number }

/** How many depth slices the wood is laid in among the leaf, and the leaf in. */
const SLICES = 4;
const LAYERS = 3;
/** Spines: how far apart along a twig, how long, at what angle off it; in pixels at zoom one. */
const SPINE_GAP = 2.4;
const SPINE_LEN = 1.2;
const SPINE_ANGLE = 0.8;
/** The long spines on the outermost tips. */
const LONG_SPINE = 2.1;

function paintThorn(g: Ctx, job: BushJob): void {
  const { sk, look, light, e } = job;
  const toward = e.toward as V3;
  const near = (p: V3): number => dot(p, toward);
  const sunV: Pt = [light.sun[0] * e.ux + light.sun[1] * e.vx, light.sun[0] * e.uy + light.sun[1] * e.vy - light.sun[2] * HEIGHT_SCALE];
  const sl = Math.hypot(sunV[0], sunV[1]) || 1;
  const sun = { sx: sunV[0] / sl, sy: sunV[1] / sl, front: (1 + dot(unit(toward), light.sun)) / 2 };
  const winter = look.foliage === null && job.season === 'winter';
  const spring = job.season === 'spring';
  const bark = barkOf(job.def.foliage[1]);
  const l = clamp01((light.ambient + light.direct * 0.55 - 0.22) / 0.82);
  const woodMid = hexOf(mixRgb(hex(bark.shade), hex(bark.lit), l * 0.55));
  const woodLit = rgb(mixRgb(hex(bark.shade), hex(bark.lit), light.night ? l * 0.6 : Math.min(1, l * 1.1)));
  const inkCss = rgb(KIT_INK);
  const spineLit = tone(bark.lit, 0.12);

  /* the wood in segments on the screen, in depth slices */
  const segs: Seg[] = sk.limbs.map((L) => ({ qa: proj(e, L.a), qb: proj(e, L.b), w: (L.ra + L.rb) * ACROSS, L, d: near(add(L.a, L.b)) / 2 }));
  let d0 = Infinity, d1 = -Infinity;
  for (const s of segs) { d0 = Math.min(d0, s.d); d1 = Math.max(d1, s.d); }
  const sliceOf = (d: number): number => Math.min(SLICES - 1, Math.floor(((d - d0) / Math.max(1e-6, d1 - d0)) * SLICES));
  // Width classes: a stem's foot, the rest of the stem, twigs, spurs.
  const classOf = (s: Seg): number => (s.L.order === 1 ? (s.L.ra > (STEM_R[0] + STEM_R[1]) / 2 ? 0 : 1) : s.L.order === 3 ? 2 : 3);
  const CLASSES = 4;
  const widths = new Array(CLASSES).fill(0), counts = new Array(CLASSES).fill(0);
  for (const s of segs) { const c = classOf(s); widths[c] += s.w; counts[c]++; }
  for (let c = 0; c < CLASSES; c++) widths[c] = Math.max(0.3, widths[c] / Math.max(1, counts[c]));
  const slices = Array.from({ length: SLICES }, () => ({
    wood: Array.from({ length: CLASSES }, () => new Path2D()),
    lit: new Path2D(), snow: new Path2D(), spines: new Path2D(), long: new Path2D(), haws: [] as Pt[], lo: Infinity, any: false,
  }));
  const leafy = look.full > 0;
  const R = mulberry32(job.seed * 7 + 11);
  for (const s of segs) {
    const sl = slices[sliceOf(s.d)];
    const c = classOf(s);
    sl.any = true;
    sl.lo = Math.min(sl.lo, s.d);
    sl.wood[c].moveTo(s.qa[0], s.qa[1]);
    sl.wood[c].lineTo(s.qb[0], s.qb[1]);
    const dx = s.qb[0] - s.qa[0], dy = s.qb[1] - s.qa[1];
    const ln = Math.hypot(dx, dy);
    if (ln < 0.05) continue;
    const ux = dx / ln, uy = dy / ln;
    // The lit side of a stem: a narrower line along it toward the sun.
    let nx = -uy, ny = ux;
    if (nx * sun.sx + ny * sun.sy < 0) { nx = -nx; ny = -ny; }
    if (c <= 1) {
      const o = widths[c] * 0.22;
      sl.lit.moveTo(s.qa[0] + nx * o, s.qa[1] + ny * o);
      sl.lit.lineTo(s.qb[0] + nx * o, s.qb[1] + ny * o);
    }
    // Snow along the top of what lies near level.
    if (winter) {
      const D = unit([s.L.b[0] - s.L.a[0], s.L.b[1] - s.L.a[1], s.L.b[2] - s.L.a[2]]);
      if (c <= 1 && Math.abs(D[2]) < 0.65) {
        const o = widths[c] * 0.42;
        const [tx, ty] = ny < 0 || (ny === 0 && nx < 0) ? [nx, ny] : [-nx, -ny];
        sl.snow.moveTo(s.qa[0] + tx * o, s.qa[1] + ty * o - 0.1);
        sl.snow.lineTo(s.qb[0] + tx * o, s.qb[1] + ty * o - 0.1);
      }
    }
    // Spines on the outer wood: the twigs and spurs, and the upper half of each stem.
    if (s.L.order >= 3 || s.L.rb < (STEM_R[0] + STEM_R[1]) * 0.55) {
      let side = R() < 0.5 ? 1 : -1;
      const ca = Math.cos(SPINE_ANGLE), sa = Math.sin(SPINE_ANGLE);
      const half = widths[c] / 2;
      for (let t = SPINE_GAP * (0.3 + 0.5 * R()); t < ln - 0.2; t += SPINE_GAP * (0.8 + 0.4 * R())) {
        const px = s.qa[0] + ux * t, py = s.qa[1] + uy * t;
        const sx = -uy * side, sy = ux * side;
        const k = SPINE_LEN * (0.75 + 0.5 * R());
        sl.spines.moveTo(px + sx * half, py + sy * half);
        sl.spines.lineTo(px + sx * half + (ux * ca + sx * sa) * k, py + sy * half + (uy * ca + sy * sa) * k);
        side = -side;
      }
    }
    if (s.L.tip && s.L.order >= 3 && s.L.b[2] > sk.height * 0.35 && outOf(sk.crown, s.L.b) > 0.8) {
      for (const [t, side] of [[0.7, R() < 0.5 ? 1 : -1]]) {
        const px = s.qa[0] + dx * t, py = s.qa[1] + dy * t;
        const sx = -uy * side, sy = ux * side;
        const k = LONG_SPINE * (0.8 + 0.4 * R());
        sl.long.moveTo(px, py);
        sl.long.lineTo(px + (ux * 0.77 + sx * 0.64) * k, py + (uy * 0.77 + sy * 0.64) * k);
      }
    }
    // Haws on the bare tips, once the leaf is thinning.
    if (look.flowers && job.season === 'autumn' && s.L.tip && look.full < 1 && R() < 0.6) sl.haws.push(s.qb);
    // Blossom on the bare tips before the leaf is out.
    if (look.flowers && spring && s.L.tip && look.full < 1 && R() < 0.25) sl.haws.push(s.qb);
  }

  /* the masses as the day shows them */
  const shown = leafy ? sk.clumps.filter((c) => c.k < look.full + 0.35) : [];
  const grown = 0.45 + 0.55 * look.full;
  const ramp = look.foliage ? rampOf(look.foliage) : null;
  const leafInk = new Path2D();
  const masses = shown.map((c) => {
    const [x, y] = proj(e, c.c);
    const rx = c.r * ACROSS * grown;
    const u: Lump = { x, y, rx, ry: rx * 0.72, seed: job.seed * 31 + Math.round(c.k * 1e6) };
    const lumps = [u];
    // Its outline, and the same a rim's and an ink's width out: filled, not stroked, as a stroke round so many points is slow to lay.
    const shapes = shapesOfMass();
    const t = shapes[u.seed % shapes.length];
    const path = new Path2D(), rim = new Path2D();
    path.addPath(t, { a: u.rx, b: 0, c: 0, d: u.ry, e: u.x, f: u.y });
    rim.addPath(t, { a: u.rx + RIM_W, b: 0, c: 0, d: u.ry + RIM_W, e: u.x, f: u.y });
    leafInk.addPath(t, { a: u.rx + KIT_INK_W, b: 0, c: 0, d: u.ry + KIT_INK_W, e: u.x, f: u.y });
    return { c, lumps, path, rim };
  });

  /* the ink under everything: the bush's outline, and through every gap in it */
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = inkCss;
  g.fillStyle = inkCss;
  g.fill(leafInk);
  for (let c = 0; c < CLASSES; c++) {
    g.lineWidth = widths[c] + KIT_INK_W * (c <= 1 ? 1.2 : 0.7);
    for (const sl of slices) g.stroke(sl.wood[c]);
  }

  type Item = { d: number; draw: () => void };
  const items: Item[] = [];
  slices.forEach((sl, i) => {
    if (!sl.any) return;
    items.push({
      d: sl.lo,
      draw: () => {
        g.lineCap = 'round';
        g.lineJoin = 'round';
        // In front of leaf the wood keeps its own ink.
        if (i > 0 && masses.length) {
          g.strokeStyle = inkCss;
          for (let c = 0; c < CLASSES; c++) {
            g.lineWidth = widths[c] + KIT_INK_W * (c <= 1 ? 0.9 : 0.6);
            g.stroke(sl.wood[c]);
          }
        }
        g.strokeStyle = rgb(mixRgb(hex(bark.shade), hex(woodMid), (i + 1) / SLICES), 1);
        for (let c = 0; c < CLASSES; c++) {
          g.lineWidth = widths[c];
          g.stroke(sl.wood[c]);
        }
        g.strokeStyle = woodLit;
        g.lineWidth = widths[1] * 0.45;
        g.stroke(sl.lit);
        if (winter) {
          g.strokeStyle = 'rgba(248,250,255,0.95)';
          g.lineWidth = Math.max(0.3, widths[1] * 0.4);
          g.stroke(sl.snow);
        }
        g.strokeStyle = rgb(KIT_INK, 0.92);
        g.lineWidth = KIT_INK_W * 0.55;
        g.stroke(sl.spines);
        // The long spines on the outermost tips, pale in their ink.
        g.lineWidth = KIT_INK_W * 0.8;
        g.stroke(sl.long);
        g.strokeStyle = spineLit;
        g.lineWidth = KIT_INK_W * 0.38;
        g.stroke(sl.long);
        if (sl.haws.length && look.flowers) berries(g, sl.haws, look.flowers, spring ? 0.55 : 0.6, spring);
      },
    });
  });
  // The masses in layers by depth, each layer laid in a few fills.
  const byDepth = masses.map((m) => ({ m, d: near(m.c.c) })).sort((x, y) => x.d - y.d);
  const per = Math.max(1, Math.ceil(byDepth.length / LAYERS));
  for (let i = 0; i < byDepth.length; i += per) {
    const part = byDepth.slice(i, i + per);
    items.push({ d: part[0].d, draw: () => paintLayer(g, job, part.map((x) => x.m), sun, ramp as Ramp) });
  }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
  // Blossom or haws over every mass turned to the eye, in one go.
  if (look.flowers && (spring || job.season === 'autumn')) {
    const at: Pt[] = [];
    const V = unit(toward);
    for (const m of masses) {
      const n = unit([m.c.c[0] - sk.crown.c[0], m.c.c[1] - sk.crown.c[1], (m.c.c[2] - sk.crown.c[2]) * 1.4]);
      if (dot(n, V) > -0.2) extrasOf(m.lumps, spring, at);
    }
    berries(g, at, look.flowers, spring ? 0.62 : 0.6, spring);
  }
}

/**
 * A mass of small toothed leaves, a unit across: three or four broad lobes
 * round it, its edge cut into fine points, in a few seeded shapes laid by
 * `addPath` -- one shape a mass, so a bush of them is cheap to lay.
 */
const TEETH = 15;
let massShapes: Path2D[] | null = null;
const shapesOfMass = (): Path2D[] => (massShapes ??= Array.from({ length: 8 }, (_, v) => {
  const R = mulberry32(7717 + v * 31);
  const p = new Path2D();
  const a0 = R() * TAU, lobes = 3 + (v % 2), p1 = R() * TAU, p2 = R() * TAU;
  for (let i = 0; i < TEETH * 2; i++) {
    const t = a0 + (i / (TEETH * 2)) * TAU;
    const body = 0.86 + 0.14 * Math.sin(lobes * t + p1) + 0.06 * Math.sin(7 * t + p2);
    const k = body + (i % 2 === 0 ? 0.13 * (0.5 + 0.5 * R()) : -0.05);
    if (i === 0) p.moveTo(Math.cos(t) * k, Math.sin(t) * k); else p.lineTo(Math.cos(t) * k, Math.sin(t) * k);
  }
  p.closePath();
  return p;
}));
/** How far a layer's rim stands out of its masses, in pixels at zoom one. */
const RIM_W = KIT_INK_W * 0.6;

/** A plane inside a lump: a lumpy round of a few points, in a few seeded shapes (no curves: they are slow to lay). */
let planeShapes: Path2D[] | null = null;
const shapesOfPlane = (): Path2D[] => (planeShapes ??= Array.from({ length: 6 }, (_, v) => {
  const R = mulberry32(911 + v * 17);
  const p = new Path2D();
  const a0 = R() * TAU;
  for (let i = 0; i < 9; i++) {
    const t = a0 + (i / 9) * TAU, k = 1 + (R() - 0.5) * 0.16;
    if (i === 0) p.moveTo(Math.cos(t) * k, Math.sin(t) * k); else p.lineTo(Math.cos(t) * k, Math.sin(t) * k);
  }
  p.closePath();
  return p;
}));

/** A plane inside a mass: its lumps a step smaller, lumpy, no teeth. */
function planeOf(p: Path2D, lumps: Lump[], dx: number, dy: number, k: number, only?: (u: Lump) => boolean): void {
  for (const u of lumps) {
    if (only && !only(u)) continue;
    const shapes = shapesOfPlane();
    p.addPath(shapes[(u.seed + Math.round(k * 10)) % shapes.length], { a: u.rx * k, b: 0, c: 0, d: u.ry * k, e: u.x + dx * u.rx, f: u.y + dy * u.ry });
  }
}

type Lump = { x: number; y: number; rx: number; ry: number; seed: number };
type Mass = { c: Clump; lumps: Lump[]; path: Path2D; rim: Path2D };

/**
 * A layer of masses of leaf at about one depth, as the trees' are painted:
 * their rim laid first and their fill over its inside, so only the layer's
 * outside edge is inked; then in each mass the core of its shade away from
 * the sun, a middle and a lit plane toward it -- four flat tones -- each
 * tone of the whole layer in one fill.
 */
function paintLayer(g: Ctx, job: BushJob, layer: Mass[], sun: { sx: number; sy: number; front: number }, ramp: Ramp): void {
  const { sk, light, e } = job;
  const env = sk.crown;
  const V = unit(e.toward as V3);
  const top = ramp.length - 1;
  const off = 1 - 0.55 * sun.front;
  const rims = new Path2D();
  const tones = new Map<number, Path2D>();
  const at = (i: number): Path2D => {
    let p = tones.get(i);
    if (!p) tones.set(i, (p = new Path2D()));
    return p;
  };
  for (const m of layer) {
    const { c, lumps } = m;
    const n = unit([(c.c[0] - env.c[0]) / env.r, (c.c[1] - env.c[1]) / env.r, ((c.c[2] - env.c[2]) / env.rz) * 0.8 + 0.25]);
    const wrap = clamp01((dot(n, light.sun) + 0.3) / 1.3);
    const occ = (0.5 + 0.5 * Math.pow(c.out, 1.3)) * (0.75 + 0.25 * c.up) * (1 + 0.3 * Math.min(0, dot(n, V)));
    const L = (light.ambient + light.direct * wrap) * occ;
    const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.2))));
    rims.addPath(m.rim);
    at(b * 8).addPath(m.path);
    planeOf(at(b * 8 + 1), lumps, -sun.sx * 0.28 * off, -sun.sy * 0.28 * off + 0.18, 0.66);
    planeOf(at(b * 8 + 2), lumps, sun.sx * 0.12 * off, sun.sy * 0.12 * off - 0.08, 0.7);
    if (!light.night || L > 0.6) planeOf(at(b * 8 + 3), lumps, sun.sx * 0.3 * off, sun.sy * 0.3 * off - 0.2, 0.42);
  }
  g.fillStyle = rgb(mixRgb(hex(ramp[0]), KIT_INK, 0.45), 0.9);
  g.fill(rims);
  // The fills first, then the planes: a mass's shade over its neighbour's fill, never under it.
  const keys = [...tones.keys()].sort((x, y) => (x % 8) - (y % 8) || x - y);
  for (const k of keys) {
    const b = Math.floor(k / 8), plane = k % 8;
    g.fillStyle = ramp[plane === 0 ? b : plane === 1 ? b - 1 : b + plane - 1];
    g.fill(tones.get(k) as Path2D);
  }
}

/** Where a mass wears its blossom (over its top and front) or its haws (hanging at its foot). */
function extrasOf(lumps: Lump[], spring: boolean, at: Pt[]): void {
  for (const u of lumps) {
    const R = mulberry32(u.seed + 99);
    for (let i = 0; i < 3; i++) {
      if (R() < (spring ? 0.4 : 0.5)) continue;
      const a = spring ? -Math.PI / 2 + (i - 1) * 1.1 + (R() - 0.5) * 0.6 : Math.PI / 2 + (i - 1) * 0.9 + (R() - 0.5) * 0.5;
      const d = spring ? 0.25 + 0.4 * R() : 0.55 + 0.2 * R();
      at.push([u.x + Math.cos(a) * u.rx * d, u.y + Math.sin(a) * u.ry * d]);
    }
  }
}

/**
 * Blossom (a few round petals in a knot) or haws (two or three round fruits
 * in a bunch) at points on the screen, all in one path for each tone: the
 * shaded side, the face, a rim, and the light on a haw.
 */
function berries(g: Ctx, at: Pt[], colour: string, r: number, blossom: boolean): void {
  if (!at.length) return;
  const face = new Path2D(), lit = new Path2D();
  const R = mulberry32(at.length * 97 + Math.round(at[0][0] * 13));
  for (const [x, y] of at) {
    const n = blossom ? 5 : 2 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R();
      const d = blossom ? r * 0.85 : r * 1.1;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8 + (blossom ? 0 : r * 0.4);
      face.moveTo(px + r, py);
      face.arc(px, py, r, 0, TAU);
      if (blossom && i === 0) { lit.moveTo(x + r * 0.45, y); lit.arc(x, y, r * 0.45, 0, TAU); }
      if (!blossom) { lit.moveTo(px - r * 0.2 + r * 0.32, py - r * 0.35); lit.arc(px - r * 0.2, py - r * 0.35, r * 0.32, 0, TAU); }
    }
  }
  g.strokeStyle = rgb(mixRgb(hex(colour), KIT_INK, blossom ? 0.65 : 0.75), 0.95);
  g.lineWidth = KIT_INK_W * 0.6;
  g.stroke(face);
  g.fillStyle = blossom ? colour : tone(colour, -0.05);
  g.fill(face);
  g.fillStyle = blossom ? tone(colour, -0.3) : tone(colour, 0.35);
  g.fill(lit);
}

export const thorn: Bush3D = {
  name: 'Thorn bush',
  grow: growThorn,
  paint: paintThorn,
};
