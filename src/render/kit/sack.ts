import { rand } from '../ivy';
import { eyeOf, glyphPath, type Eye } from '../runestone';
import {
  css, dot, hex, lathe, mix, proj, stud, TAU, toneOf, warped,
  type Ctx, type Face, type KitModel, type KitPart, type PaintCtx, type Side, type Tone, type V3,
} from './core';

/**
 * What lies on the ground (`lyingSprite`), in the kit: a sack of undyed
 * hessian set down where things were dropped, slumped wider at its foot,
 * gathered at the neck and tied with a teal cord whose ends hang down its
 * front to a gold bead, a lilac patch stitched on its front with othala --
 * what is someone's -- in gold thread. As big as what is in it: one thing,
 * a few, or a full sack (`sackSize`).
 */

/** Its sizes: one thing, a few, a full sack; how tall each stands to its neck and how round it is, in tenths of a metre. */
const NECK = [5.0, 6.2, 7.4];
const GIRTH = [4.3, 5.3, 6.2];

/** A full sack: so many stacks on the tile, or so many things. */
export const SACK_FULL = { stacks: 4, things: 20 } as const;

/** How full a sack the things on a tile make: nought for one thing, one for more, two for a full sack (`SACK_FULL`). */
export function sackSize(items: readonly { count?: number }[]): number {
  const n = items.reduce((m, it) => m + (it.count ?? 1), 0);
  if (items.length <= 1 && n <= 1) return 0;
  return items.length >= SACK_FULL.stacks || n >= SACK_FULL.things ? 2 : 1;
}

/** The eye every sack is drawn from: it lies the same whichever way the camera turns, as the heap it replaces did. */
export const SACK_EYE: Eye = eyeOf(0, 0);

/* ---- its colours ------------------------------------------------------------------- */

/** Hessian: the linen's cream warmed toward caramel, and lilac in the shade. */
const HESSIAN: Tone = toneOf('#f0dcb6', '#ad8f9c');
/** The patch: the kit's lilac. */
const PATCH = hex('#c9b3e2');
/** The cord, the splash: teal, its shade a deep sea green. */
const CORD: Tone = toneOf('#4fc4b8', '#2a7d82');
/** Gold thread. */
const THREAD = '#f2c35a';

/* ---- what is painted on it ----------------------------------------------------------- */

/** The weave over a side `w` by `h`: a faint cross of threads a step paler and deeper, and a fleck of chaff. */
function weave(g: Ctx, fill: number[], w: number, h: number, seed: number): void {
  const T = rand(seed);
  g.lineWidth = 0.07;
  g.strokeStyle = css(mix(fill as [number, number, number], hex('#7a5c62'), 0.35), 0.14);
  g.beginPath();
  for (let y = 0.25 + T() * 0.2; y < h; y += 0.42) { g.moveTo(-0.2, y); g.lineTo(w + 0.2, y + (T() - 0.5) * 0.08); }
  g.stroke();
  g.strokeStyle = css(mix(fill as [number, number, number], [255, 248, 232], 0.4), 0.16);
  g.beginPath();
  for (let x = 0.2 + T() * 0.2; x < w; x += 0.42) { g.moveTo(x, -0.2); g.lineTo(x + (T() - 0.5) * 0.08, h + 0.2); }
  g.stroke();
}

/** The folds the cord gathers it into, running up a side to the neck: soft streaks a step deeper, longer the higher up. */
function folds(g: Ctx, fill: number[], s: Side, z0: number, neck: number, seed: number): void {
  const T = rand(seed);
  const top = s.h, rise = Math.max(0, Math.min(1, (z0 + s.h - neck * 0.45) / (neck * 0.55)));
  if (rise <= 0) return;
  g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const x = s.w * (0.25 + 0.5 * T());
    g.beginPath();
    g.moveTo(x + (T() - 0.5) * 0.3, top * (1 - rise * 0.9));
    g.quadraticCurveTo(x + (T() - 0.5) * 0.5, top * 0.6, x + (T() - 0.5) * 0.2, top + 0.1);
    g.strokeStyle = css(mix(fill as [number, number, number], hex('#7a5c72'), 0.4), 0.45);
    g.lineWidth = 0.16;
    g.stroke();
  }
}

/** The patch on its front, in a side's frame: lilac, stitched round in gold, othala stitched on it. */
function patch(g: Ctx, k: PaintCtx, s: Side): void {
  const pw = Math.min(s.w * 0.86, 2.8), ph = Math.min(s.h * 0.8, 2.3);
  const x0 = (s.w - pw) / 2, y0 = (s.h - ph) / 2;
  const L = k.L;
  // Its cloth lit as the side is: the lilac in the light, toward the kit's mauve turned away.
  const fill = mix(PATCH, hex('#7d6890'), Math.max(0, Math.min(1, (1 - L) / 0.31)) * 0.75);
  g.fillStyle = css(mix(fill, hex('#5a4458'), 0.55));
  g.fillRect(x0 - 0.1, y0 - 0.1, pw + 0.2, ph + 0.2);
  g.fillStyle = css(fill);
  g.fillRect(x0, y0, pw, ph);
  // Its stitches round it, dashes of gold thread.
  g.setLineDash([0.22, 0.16]);
  g.strokeStyle = THREAD;
  g.lineWidth = 0.11;
  g.strokeRect(x0 + 0.18, y0 + 0.18, pw - 0.36, ph - 0.36);
  g.setLineDash([]);
  // Othala in gold thread, a hair of deep gold under it so it holds on the lilac.
  const r = Math.min(pw, ph) * 0.28;
  glyphPath(g, 'othala', s.w / 2, s.h / 2, r);
  g.strokeStyle = '#a9733a';
  g.lineWidth = 0.26;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
  glyphPath(g, 'othala', s.w / 2, s.h / 2, r);
  g.strokeStyle = THREAD;
  g.lineWidth = 0.15;
  g.stroke();
}

/* ---- the model ---------------------------------------------------------------------------- */

function sackOf(size: number): KitModel {
  const neck = NECK[size], R = GIRTH[size];
  const SIDES = 10;
  // Its body from the floor to the neck: slumped out at its foot, full in its belly, drawn in to where it is tied.
  const body: Array<[number, number]> = [
    [0, R * 0.82], [neck * 0.1, R * 0.97], [neck * 0.25, R], [neck * 0.6, R * 0.9], [neck * 0.82, R * 0.6], [neck * 0.94, R * 0.3], [neck, 0.95],
  ];
  // Which side of it looks most nearly to the eye, a side round to the light: where its patch is.
  const toward = SACK_EYE.toward;
  let front = 0, best = -Infinity;
  for (let i = 0; i < SIDES; i++) {
    const a = ((i + 1) / SIDES) * TAU;
    const n: V3 = [Math.cos(a), Math.sin(a), 0];
    const [lx] = proj(SACK_EYE, n);
    const d = dot(n, toward) - 0.25 * lx;
    if (d > best) { best = d; front = i; }
  }
  // The patch on the band that bellies out most toward the eye.
  const belly = 2;
  // Slumped: a little to one side and flattened front to back, as a sack set down on the ground lies.
  const slump = (p: V3): V3 => {
    const k = Math.max(0, 1 - p[2] / neck);
    return [p[0] * (1 + 0.05 * k) + 0.25 * (p[2] / neck) ** 2, p[1] * (0.94 + 0.04 * k), p[2]];
  };
  const bodyFaces = warped(lathe(0, 0, body, SIDES, HESSIAN, 0.5, (k, i, s) => ({
    crease: 0.08,
    paint: (g: Ctx, kk: PaintCtx) => {
      weave(g, kk.fill, s.w, s.h, 11 + k * 13 + i);
      folds(g, kk.fill, s, body[k][0], neck, 50 + k * 13 + i);
      if (k === belly && i === front) patch(g, kk, s);
      // The seam up its back, a run of stitches.
      if (i === (front + SIDES / 2) % SIDES) {
        g.setLineDash([0.2, 0.2]);
        g.strokeStyle = css(mix(kk.fill, hex('#6e5060'), 0.45), 0.7);
        g.lineWidth = 0.1;
        g.beginPath(); g.moveTo(s.w / 2, 0); g.lineTo(s.w / 2, s.h); g.stroke();
        g.setLineDash([]);
      }
    },
  })), slump);
  const parts: KitPart[] = [{ faces: bodyFaces, edges: true }];

  // The gathered mouth over the tie: flared out in folds, alternate sides in and out, and the dark of its opening at the top.
  const top = neck + 0.35 + size * 0.15;
  const ruff: V3[][] = [[neck - 0.05, 0.9], [neck + 0.6, 1.9], [top + 0.6, 1.0]].map(([z, r]) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = ((i + 0.5) / 10) * TAU, rr = z > neck ? r * (i % 2 ? 0.78 : 1.05) : r;
      return [Math.cos(a) * rr + 0.25, Math.sin(a) * rr * 0.94, z] as V3;
    }));
  const ruffFaces = ringsToFaces(ruff, HESSIAN);
  parts.push({ faces: ruffFaces, edges: false });

  // The cord: a band round the neck, teal.
  const tie = warped(lathe(0, 0, [[neck - 0.25, 1.12], [neck + 0.05, 1.28], [neck + 0.35, 1.12]], 10, CORD, 0.5, () => ({ crease: 0.2 })), (p) => [p[0] + 0.25, p[1] * 0.94, p[2]]);
  parts.push({ faces: tie, edges: false, inkColour: mix(CORD.shade, hex('#1e3a46'), 0.5) });

  // Its ends hanging from the knot down the front, a gold bead on the longer one: drawn loose, over the sack.
  const [fx, fy] = (() => { const a = ((front + 1) / SIDES) * TAU; return [Math.cos(a), Math.sin(a)]; })();
  const knot: V3 = [fx * 1.25 + 0.25, fy * 1.18, neck + 0.05];
  const end1: V3 = [fx * (R * 0.5) + 0.25 - fy * 0.5, fy * (R * 0.48) + fx * 0.5, neck * 0.62];
  const end2: V3 = [fx * (R * 0.42) + 0.25 + fy * 0.7, fy * (R * 0.4) - fx * 0.7, neck * 0.72];
  parts.push({
    reach: [knot, end1, end2], solid: false, pad: 2, after: [parts[0], parts[2]],
    draw: (g, e) => {
      const [kx, ky] = proj(e, knot);
      g.lineCap = 'round';
      for (const [end, bulge] of [[end1, -1.4], [end2, 1.2]] as Array<[V3, number]>) {
        const [ex, ey] = proj(e, end);
        const path = (): void => { g.beginPath(); g.moveTo(kx, ky); g.quadraticCurveTo((kx + ex) / 2 + bulge, (ky + ey) / 2 - 0.5, ex, ey); };
        path(); g.strokeStyle = css(mix(CORD.shade, hex('#1e3a46'), 0.5)); g.lineWidth = 1.5; g.stroke();
        path(); g.strokeStyle = css(CORD.lit); g.lineWidth = 0.8; g.stroke();
      }
      // The knot, and the bead.
      g.beginPath(); g.ellipse(kx, ky, 1.3, 0.95, 0, 0, TAU);
      g.fillStyle = css(mix(CORD.shade, hex('#1e3a46'), 0.5)); g.fill();
      g.beginPath(); g.ellipse(kx - 0.15, ky - 0.1, 0.85, 0.55, 0, 0, TAU);
      g.fillStyle = css(CORD.lit); g.fill();
      const [bx, by] = proj(e, end1);
      stud(g, bx, by + 0.9, 1.25);
    },
  });

  return { parts, shade: [[-R * 0.95, -R * 0.85, 0], [R * 0.95, -R * 0.85, 0], [R * 0.95, R * 0.85, 0], [-R * 0.95, R * 0.85, 0]] };
}

/** Rings one over the next as faces (`prism` without a top): the gathered mouth, open at its head. */
function ringsToFaces(rings: V3[][], tone: Tone): Face[] {
  const out: Face[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const lo = rings[k], hi = rings[k + 1];
    for (let i = 0; i < lo.length; i++) {
      const j = (i + 1) % lo.length;
      const pts = [lo[i], lo[j], hi[j], hi[i]];
      const c = pts.reduce<V3>((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4, m[2] + p[2] / 4], [0, 0, 0]);
      const ax = 0.25;
      let n: V3 = [c[0] - ax, c[1], k ? 0.55 : 0.2];
      const l = Math.hypot(...n);
      n = [n[0] / l, n[1] / l, n[2] / l];
      out.push({
        pts, n, tone, crease: 0.3,
        frame: { o: lo[i], a: [hi[i][0] - lo[i][0], 0, 0], b: [0, 0, 1] },
      });
    }
  }
  // The opening at the top, in the dark of the sack.
  const last = rings[rings.length - 1];
  out.push({ pts: last.map((p) => [p[0], p[1], p[2] - 0.05] as V3), n: [0, 0, 1], tone: { lit: mix(HESSIAN.shade, hex('#5a4458'), 0.4), shade: mix(HESSIAN.shade, hex('#4a3448'), 0.45) }, crease: 0.2 });
  return out;
}

const models = new Map<number, KitModel>();
/** A sack's model, by its size (`sackSize`), built once. */
export function sackModel(size: number): KitModel {
  const s = Math.max(0, Math.min(2, Math.round(size)));
  let m = models.get(s);
  if (!m) models.set(s, (m = sackOf(s)));
  return m;
}
