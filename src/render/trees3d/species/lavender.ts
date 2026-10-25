import { mulberry32 } from '../../../world/noise';
import { HEIGHT_SCALE } from '../../iso';
import { KIT_INK, KIT_INK_W } from '../../kit/core';
import { proj, type Eye } from '../../runestone';
import { mix, tone } from '../../trees/kit';
import { SWAY_FRAMES } from '../index';
import { ACROSS, paintTree3d } from '../paint';
import { WIND } from '../skeleton';
import type { Build, Bush3D, BushJob, Clump, Envelope, Limb, Ramp, Skeleton, Species3D, V3 } from '../types';
import { add, dot, hex, mixRgb, mul, rgb } from '../vec';

const TAU = Math.PI * 2;
type Pt = [number, number];
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** A colour taken `k` of the way to its own grey: what makes a leaf silvery. */
const grey = (c: string, k: number): string => {
  const [r, g, b] = hex(c);
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const h = l.toString(16).padStart(2, '0');
  return mix(c, `#${h}${h}${h}`, k);
};
/** A colour taken `k` times as far from its own grey: below one duller, above it brighter. */
const vivid = (c: string, k: number): string => {
  const [r, g, b] = hex(c);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, l + (v - l) * k))).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * A ramp of seven from a bush's two tones (`bushYear`'s foliage, light and
 * dark): the dark a step deeper under it, the light greyed toward silver
 * over it.
 */
const rampOf = ([lit, deep]: readonly [string, string]): Ramp =>
  [tone(deep, -0.2), deep, mix(deep, lit, 0.35), mix(deep, lit, 0.68), lit, tone(lit, 0.12), grey(tone(lit, 0.3), 0.3)];

/** The mound, in model units: its half-width and its height. */
const REACH = 9.7;
const TOP = 8.8;
/** Flower stems: how many, at least, and how many more a bush may have. */
const STEMS = 22;
const STEMS_MORE = 8;
/** The share of a stem its head covers, from its tip. */
const HEAD = 0.42;
/** A head's half-width, in model units. */
const HEAD_W = 0.52;
/** How far a stem's tip goes in the wind, in model units, at its fullest. */
const SPIKE_SWAY = 1.6;

const BUILD: Build = {
  height: TOP, stem: 0, spread: REACH / TOP, dome: 0.6, droop: 0, girth: 0.08, flare: 1, scaffolds: 5, forks: 0, branching: 0,
  clumps: 7, clumpSize: 0.45, gnarl: 0, lean: 0, dead: 0, bare: false, rune: false, hollow: false,
};

/**
 * A lavender grown from a seed: a low, round mound of small upright tufts --
 * one on the top, a ring round it down to the ground -- on a few short woody
 * stems splaying out from the foot, and a fan of flower stems out of its top,
 * upright in the middle and leaning out the further out they stand.
 */
function growLavender(seed: number): Skeleton {
  const R = mulberry32(seed);
  const reach = REACH * (0.92 + 0.16 * R());
  const top = TOP * (0.92 + 0.16 * R());
  const env: Envelope = { c: [0, 0, top * 0.42], r: reach, rz: top * 0.58 };
  const limbs: Limb[] = [];
  const a0 = R() * TAU;
  const woody = 5;
  for (let i = 0; i < woody; i++) {
    const a = a0 + (i / woody) * TAU + (R() - 0.5) * 0.6;
    const out = reach * (0.34 + 0.08 * R());
    limbs.push({
      a: [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0], b: [Math.cos(a) * out, Math.sin(a) * out, top * (0.3 + 0.08 * R())],
      ra: 0.7, rb: 0.42, order: 0, parent: -1, bough: i, tip: true,
    });
  }
  /*
   * The leaf: one dome of small tufts, in rows round it from the ground to the
   * top, each row turned from the one under it -- one mass, so only its own
   * outline is inked and the tufts show by their light and their needles.
   */
  const lr = reach * 0.33;
  const c: V3 = [0, 0, top * 0.5];
  const subs: Array<{ o: V3; r: number }> = [];
  const rows: Array<[number, number]> = [[0, 10], [0.52, 7], [1, 4], [1.4, 1]];
  rows.forEach(([el, n], i) => {
    const a1 = a0 + i * 0.9;
    for (let j = 0; j < n; j++) {
      const az = a1 + (j / n) * TAU + (R() - 0.5) * (TAU / n) * 0.4;
      const e = el + (R() - 0.5) * 0.12;
      const k = 0.92 + 0.12 * R();
      subs.push({
        o: [Math.cos(az) * Math.cos(e) * (reach - lr) * k, Math.sin(az) * Math.cos(e) * (reach - lr) * k, lr * 0.5 - c[2] + Math.sin(e) * (top - lr * 0.75 - lr * 0.5)],
        r: lr * (0.85 + 0.3 * R()) * (i === 3 ? 1.15 : 1),
      });
    }
  });
  // The middle of the top, under the rest.
  subs.unshift({ o: [0, 0, top - lr * 1.1 - c[2]], r: lr * 1.3 });
  // Its radius is what it throws shade with (`bush3dShadow`): a low mound's lies mostly under it.
  const clumps: Clump[] = [{ c, r: reach * 0.62, limb: 0, k: R(), subs, out: 1, up: 1 }];

  /* ---- the flower stems: a fan out of the top ---- */
  const spikes: Array<{ a: V3; b: V3; k: number }> = [];
  const n = STEMS + Math.floor(R() * STEMS_MORE);
  const inner = reach * 0.66;
  for (let i = 0; i < n; i++) {
    const rho = inner * Math.sqrt((i + R()) / n);
    const az = a0 + i * 2.39996 + (R() - 0.5) * 0.4;
    const surface = top * Math.sqrt(Math.max(0, 1 - Math.pow(rho / reach, 2)));
    const a: V3 = [Math.cos(az) * rho, Math.sin(az) * rho, surface - 1.2];
    const tilt = 0.06 + 0.7 * (rho / inner) + (R() - 0.5) * 0.18;
    const l = top * (0.55 + 0.4 * R()) * (1 - 0.15 * (rho / inner));
    spikes.push({ a, b: add(a, [Math.cos(az) * Math.sin(tilt) * l, Math.sin(az) * Math.sin(tilt) * l, Math.cos(tilt) * l]), k: R() });
  }
  return { limbs, clumps, crown: env, height: top, rune: null, hollow: null, spikes, foot: reach * ACROSS * 1.05 };
}

/* ---- the flower spikes ---------------------------------------------------------------- */

/** One stem on the screen: its line up to its head, and its head's outline along it. */
interface Stem { line: Pt[]; head: Pt[]; lit: Pt[]; glint: Pt[] }

/**
 * A stem as the wind has it at a frame: bowed along the wind by its length,
 * each a beat of its own, nothing at all in still air (frame 0). Its head's
 * outline is beaded, a whorl of florets after another, narrowing to its tip;
 * its lit half and a glint along its lit edge are the planes laid over it.
 */
function stemOf(e: Eye, s: { a: V3; b: V3; k: number }, ph: number, sun: Pt, short: number, thin: number, from: number): Stem {
  const sway = SPIKE_SWAY * (Math.sin(ph + s.k * TAU) - Math.sin(s.k * TAU));
  const d: V3 = [(s.b[0] - s.a[0]) * short, (s.b[1] - s.a[1]) * short, (s.b[2] - s.a[2]) * short];
  const at = (t: number): Pt => proj(e, add(add(s.a, mul(d, t)), mul(WIND, sway * t * t * short)));
  const t0 = 1 - HEAD;
  const line = [from, from + (t0 - from) * 0.5, t0 + 0.05].map(at);
  const N = 7;
  const axis: Pt[] = [];
  for (let i = 0; i <= N; i++) axis.push(at(t0 + (HEAD * i) / N));
  const w = HEAD_W * ACROSS * thin;
  const side: Pt[] = [], other: Pt[] = [], lit: Pt[] = [], glint: Pt[] = [];
  // Which side of it is toward the sun on the screen.
  const [ax, ay] = axis[0], [bx, by] = axis[N];
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / l, ny = (bx - ax) / l;
  const sgn = nx * sun[0] + ny * sun[1] >= 0 ? 1 : -1;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // Whorls of florets, a gap between the lowest ones, tapering to a round tip.
    const bead = 0.78 + 0.22 * Math.abs(Math.cos(u * Math.PI * 4.5)) * (u < 0.3 ? 1.6 : 1);
    const r = w * Math.min(1, 0.35 + u * 5) * (1 - 0.35 * u) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.8) / 0.2, 2))) * bead;
    const [x, y] = axis[i];
    side.push([x + nx * r * sgn, y + ny * r * sgn]);
    other.push([x - nx * r * sgn, y - ny * r * sgn]);
    lit.push([x + nx * r * sgn * -0.1, y + ny * r * sgn * -0.1]);
    if (u > 0.12 && u < 0.85) glint.push([x + nx * r * sgn * 0.45, y + ny * r * sgn * 0.45]);
  }
  const head = [...side, ...other.reverse()];
  return { line, head, lit: [...side, ...lit.reverse()], glint: glint.length ? [...side.slice(2, 2 + glint.length), ...glint.reverse()] : [] };
}

const poly = (p: Path2D, q: Pt[]): void => {
  if (q.length < 3) return;
  p.moveTo(q[0][0], q[0][1]);
  for (let i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]);
  p.closePath();
};

/**
 * A batch of stems, laid as one: every stem's ink and every head's ink
 * first, then the stems, then the heads in their shade tone, their lit
 * halves and their glints -- four paths and two strokes however many there
 * are.
 */
function paintStems(g: CanvasRenderingContext2D, stems: Stem[], heads: Ramp, b: number, stemCol: string, rim: string, stemRim: string): void {
  if (!stems.length) return;
  const lines = new Path2D(), outline = new Path2D(), lit = new Path2D(), glint = new Path2D();
  for (const s of stems) {
    lines.moveTo(s.line[0][0], s.line[0][1]);
    for (const p of s.line.slice(1)) lines.lineTo(p[0], p[1]);
    poly(outline, s.head);
    poly(lit, s.lit);
    poly(glint, s.glint);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = stemRim;
  g.lineWidth = 0.32 + KIT_INK_W * 0.7;
  g.stroke(lines);
  g.strokeStyle = rim;
  g.lineWidth = KIT_INK_W * 1.25;
  g.stroke(outline);
  g.strokeStyle = stemCol;
  g.lineWidth = 0.32;
  g.stroke(lines);
  g.fillStyle = heads[b - 1];
  g.fill(outline);
  g.fillStyle = heads[b + 1];
  g.fill(lit);
  g.fillStyle = heads[Math.min(heads.length - 1, b + 2)];
  g.fill(glint);
}

/**
 * Lavender bush: a low, round, knee-high mound of fine, upright, silvery
 * grey-green needle leaves on a short woody foot, its colours `bushYear`'s
 * (`BUSH_DEFS`, `../../foliage`): grey-green the year round, greyer in
 * winter with snow along its tufts. In flower a fan of slender stems stands
 * up out of it, each topped by a spike in its flowers' colour, swaying in
 * the wind well past the mound; in autumn a few dry stalks are left.
 */
export const lavender: Bush3D = {
  name: 'Lavender bush',
  grow: growLavender,
  paint: (g, job: BushJob) => {
    const foliage = job.look.foliage ?? job.def.foliage;
    const leaf = rampOf(foliage);
    const spec: Species3D = {
      name: job.def.name, build: BUILD, ages: {},
      bark: { lit: grey(tone(foliage[1], -0.1), 0.6), shade: grey(tone(foliage[1], -0.45), 0.6), dead: foliage[0], furrow: tone(foliage[1], -0.5) },
      leafForm: 'needle', snowCap: true, pad: 0.84,
      leaf: { summer: leaf, spring: leaf, autumn: [leaf, leaf, leaf] },
    };
    const dress = { season: job.season, step: 0, full: job.look.full, turned: 0, litter: 0, keys: false };
    // In flower, every stem and its spike; in autumn the dry stalks of a few; none in spring before the flowers or in winter.
    const flowers = job.look.flowers;
    const dry = !flowers && job.season === 'autumn' && job.def.flowers ? grey(tone(mix(job.def.flowers, foliage[0], 0.5), 0.12), 0.55) : null;
    const col = flowers ? vivid(flowers, 3.2) : dry;
    const all = job.sk.spikes ?? [];
    const shown = col ? (flowers ? all : all.filter((s) => s.k < 0.45)) : [];
    if (!col || !shown.length) return paintTree3d(g, { sk: job.sk, spec, dress, light: job.light, e: job.e, seed: job.seed, frame: job.frame });
    const { e, light } = job;
    const heads: Ramp = [tone(col, -0.45), tone(col, -0.3), col, tone(col, 0.2), tone(col, 0.42)];
    // How lit a head is, as a mass is: wrapped round, from above.
    const L = (light.ambient + light.direct * clamp01((light.sun[2] + 0.3) / 1.3));
    const b = Math.max(1, Math.min(2, Math.round(L * 2.2)));
    const sv = [light.sun[0] * e.ux + light.sun[1] * e.vx, light.sun[0] * e.uy + light.sun[1] * e.vy - light.sun[2] * HEIGHT_SCALE];
    const sl = Math.hypot(sv[0], sv[1]) || 1;
    const sun: Pt = [sv[0] / sl, sv[1] / sl];
    const ph = (job.frame / SWAY_FRAMES) * TAU;
    const rim = rgb(mixRgb(hex(heads[0]), KIT_INK, 0.35), 0.85);
    const stemRim = rgb(KIT_INK, 0.5);
    const stemCol = grey(mix(foliage[0], foliage[1], 0.4), 0.3);
    const back: Stem[] = [], front: Stem[] = [];
    const mid = dot(job.sk.crown.c, e.toward as V3);
    const { r: reach, c: [, , cz], rz } = job.sk.crown;
    for (const s of shown) {
      // A stem in front shows from where it comes out of the leaf: from its top's height over where it stands.
      const rho = Math.hypot(s.a[0], s.a[1]) / reach;
      const surface = cz + rz * Math.sqrt(Math.max(0, 1 - rho * rho));
      const inFront = dot(s.a, e.toward as V3) >= mid;
      const from = inFront ? clamp01((surface + 0.3 - s.a[2]) / Math.max(0.1, s.b[2] - s.a[2])) : 0;
      (inFront ? front : back).push(stemOf(e, s, ph, sun, dry ? 0.85 : 1, dry ? 0.45 : 1, Math.min(from, 1 - HEAD)));
    }
    // Those behind the mound's middle go in under it, the rest over it.
    paintStems(g, back, heads, b, stemCol, rim, stemRim);
    paintTree3d(g, { sk: job.sk, spec, dress, light, e, seed: job.seed, frame: job.frame });
    paintStems(g, front, heads, b, stemCol, rim, stemRim);
  },
};
