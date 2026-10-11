import { HEIGHT_SCALE } from './iso';
import { PPM, rand, STAGES, strandPic } from './ivy';
import { star } from './shine';
import {
  add, area2, at, bakeGlow, boulder, canvasOf, css, cut, dot, drawFaces, drawPads, eyeOfView, flowerClump, glyphPath, grassTuft, groundNear,
  hex, inset, lichen, mix, mul, newell, noise2, plate, proj, scaleFor, skin, strokesPath, sub, toneOf, unit,
  type Ctx, type Eye, type Face, type Glow, type NightMask, type Pad, type PaintCtx, type Painter, type Pt, type Stroke, type Thing, type Tone, type V3,
} from './runestone';

/**
 * The enchanter's plinth: a carved stone table, hip high, where a scroll is
 * put into a thing (`enchant.ts`, `plinth.ts` in the game).
 *
 * Cut by the same hands as the Runestones and built of the same kit
 * (`runestone.ts`): faceted plates in tenths of a metre, chamfered and out
 * of true, put on the screen through the piece's turn so it stands right at
 * all eight viewpoints, lit as every piece on the island is, and inked in the
 * stone's warm grey. A coursed step bedded on part-buried fieldstones; a
 * waisted shaft leaning a hair off its middle, a sigil cut into its front;
 * and a slab across its head about a metre and a quarter across, tipped a
 * degree or two, uneven in its depth and with its front corner knocked off
 * -- the piece lies in the grass below -- its rim cut all the way round with
 * a band of runes between two rules, its top dressed to a margin and dished
 * where the scroll is laid, a star cut into the floor of the dish.
 *
 * Moss gathers on it as on a statue (`greening.ts`): in clumps in the inner
 * corner where the shaft meets its step and up the shaft's shady foot, along
 * the lee of the top, with grass and a flower or two breaking through, and
 * ivy up one arris of the shaft once it has stood a while.
 *
 * It is baked once for each way it is seen, each scale (`BAKE_STEPS`) and
 * each stage of its moss; a frame is one blit and the runes' light over it
 * (`drawPlinthRunes`): at rest the rim's runes a ring of gold marks, a slow
 * wave of light going round it, and bright while somebody enchants at it,
 * the wave quick, the dish full of light, a scroll laid open in it and motes
 * rising off it. After dark the runes take the night back off themselves in
 * their own shapes, kept off whatever stands in front of them, as a
 * runestone's do (`plinthNight`, through `RunestoneNight`).
 */

const TAU = Math.PI * 2;

/** A piece's turn on the screen: pixels at zoom one a unit across it and toward its front carry you (`PieceView`). */
export interface PlinthView {
  ux: number;
  uy: number;
  vx: number;
  vy: number;
}

/* ---- the stone ------------------------------------------------------------- */

/** The dressed stone: a warm cream grey in the light, a cool lilac grey turned from it, as the Crownstone's. */
const STONE = toneOf('#e6dac6', '#9f90a0');
/** The step a shade warmer and darker, and the fieldstones under it warmer still. */
const STEP = toneOf('#dccfba', '#978897');
const FIELD = toneOf('#dcc8aa', '#988795');
const FIELD_GREY = toneOf('#cbc6bd', '#8b8698');
/** And one gone green with lichen. */
const FIELD_GREEN = toneOf('#c8cba6', '#86907f');
const LICHEN: [string, string] = ['#e9d08a', '#dfe0b4'];
/** The ink round a solid, in units at zoom one: the Runestone's weight at the plinth's size. */
const INK = 0.55;

/** Where each part stands: the step's top, the shaft's foot, the slab's top and how thick it is over its middle at least and at most. */
const STEP_TOP = 0.95;
const SHAFT_FOOT = 0.9;
const SLAB_O: V3 = [0.9, -0.35, 8.3];
const SLAB_UP = 1.2;
/** How wide each of the slab's chamfers is, edge by edge: cut by eye, no two the same; the break raw. */
const SLAB_BEVELS = [0.42, 0.22, 0.34, 0.27, 0.46, 0.06, 0.06, 0.06, 0.3, 0.4, 0.24, 0.36];
/** The step is bedded out of level, its back left edge sunk into the turf: how far it falls along each way. */
const STEP_FALL: [number, number] = [0.06, 0.035];
/** The slab is tipped this far, across and toward its front: two degrees or so. */
const TIP: [number, number] = [0.035, -0.025];

/** The step, in plan: hand-cut, no two sides alike. */
const STEP_OUTLINE: Pt[] = [[-7.6, -5.6], [-6.0, -7.1], [5.4, -6.9], [7.7, -5.1], [7.5, 5.3], [5.8, 7.0], [-5.3, 7.2], [-7.8, 5.1]];
/** The step's top at a point of its plan. */
const stepZ = (x: number, y: number): number => STEP_TOP + STEP_FALL[0] * x + STEP_FALL[1] * y;
const SHAFT_TOP = 6.2;
/** The shaft's left edge, across, at a height up it: where the shady arris is, for the ivy. */
const shaftLeft = (z: number): number => {
  const side: Pt[] = [[-3.9, 0], [-3.6, 0.8], [-2.85, 1.9], [-2.45, 3.1], [-2.6, 4.3], [-3.15, 5.35], [-3.6, 6.2]];
  for (let i = 1; i < side.length; i++) if (z <= side[i][1]) return side[i - 1][0] + ((side[i][0] - side[i - 1][0]) * (z - side[i - 1][1])) / (side[i][1] - side[i - 1][1]);
  return side[side.length - 1][0];
};
/** The slab, in plan: an octagon cut by eye, its front right corner knocked off. */
const SLAB_OUTLINE: Pt[] = [
  [-6.4, -3.9], [-5.2, -5.5], [-1.4, -5.7], [4.6, -5.4], [6.5, -3.6], [6.4, 1.0], [5.0, 2.3], [4.4, 4.1], [2.5, 5.6], [-4.7, 5.7], [-6.3, 4.3], [-6.6, 0.3],
];
/** The edges of the break, by the corner each starts from: raw, pale, unchamfered and uncut. */
const BREAK_FROM = new Set(['6.4,1', '5,2.3', '4.4,4.1']);
/** How deep the slab is under its top at a point of its outline: uneven, as a slab split from the bed is. */
const slabDepth = (s: number, t: number): number => 1.3 + 0.22 * (0.5 + 0.5 * Math.sin(s * 0.9 + t * 0.4 + 1.3)) + 0.12 * (0.5 + 0.5 * Math.cos(t * 1.3 - s * 0.2));
/** The dish in its top, in the slab's own plan: its middle and how far it reaches each way. */
const DISH = { x: -0.2, y: 0.2, rx: 3.5, ry: 2.9 };
/** The runes round the rim: how far apart along it, how big, how wide cut, and where across the band. */
const RIM_STEP = 1.9;
const RIM_SIZE = 0.64;
const RIM_W = 0.16;
const RIM_Y = 0.02;
const RIM_GLYPHS = ['algiz', 'sowilo', 'ingwaz', 'tiwaz', 'dagaz', 'othala', 'laguz', 'diamond', 'star6', 'cross', 'tri', 'harrow', 'eye', 'key'];

const norm = (o: Pt[]): Pt[] => (area2(o) < 0 ? o.slice().reverse() : o);

/** The slab's own frame: across, toward its front and up out of its top, tipped. */
const SU: V3 = unit([1, 0, TIP[0]]);
const SW: V3 = unit([0, 1, TIP[1]]);
const SA: V3 = unit([SU[1] * SW[2] - SU[2] * SW[1], SU[2] * SW[0] - SU[0] * SW[2], SU[0] * SW[1] - SU[1] * SW[0]]);
const onSlab = (s: number, t: number, up = 0): V3 => at(SLAB_O, [s, SU], [t, SW], [up, SA]);

/**
 * A sigil cut into the stone, as the Runestones' roundels are but sparer, for
 * its size: a ring, rays or an eye inside it, the stone showing between.
 */
function sigil(kind: 'star' | 'eye' | 'dish'): Stroke[] {
  const ring = (r: number, n = 28): Stroke => ({ pts: Array.from({ length: n }, (_, i) => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r] as Pt), closed: true });
  const ray = (a: number, r0: number, r1: number): Stroke => ({ pts: [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]] });
  const out: Stroke[] = [ring(1)];
  if (kind === 'eye') {
    const lid = (k: number): Pt[] => Array.from({ length: 11 }, (_, i) => { const x = -0.7 + (1.4 * i) / 10; return [x, k * 0.36 * (1 - (x / 0.7) ** 2)] as Pt; });
    out.push({ pts: lid(1) }, { pts: lid(-1) }, ring(0.13, 10));
  } else {
    for (let i = 0; i < 8; i++) out.push(ray(Math.PI / 2 + (i / 8) * TAU, 0.3, i % 2 ? 0.6 : 0.8));
    out.push(ring(0.14, 10));
    if (kind === 'dish') out.push(ring(1.28, 36));
  }
  return out;
}

/** A rune on a face of the plinth: where in the face's frame, and what. */
interface RuneAt {
  frame: { o: V3; a: V3; b: V3 };
  n: V3;
  glyph: string;
  x: number;
  z: number;
  s: number;
  /** A sigil rather than a rune, and which. */
  sigil?: 'star' | 'eye' | 'dish';
  /** What it is: one of the band round the rim, the shaft's sigil, or the dish's. */
  kind: 'rim' | 'panel' | 'dish';
  /** Cut across the face it is on, upright when the face runs up rather than along: a rune down the shaft's side. */
  upright?: boolean;
  /** How far round the rim it is, nought to one, for the wave of light that goes round. */
  round: number;
  /** Its light kept inside the face it is cut in (`keep`) and off whatever stands over it there (`off`). */
  clip?: { keep: V3[]; off?: V3[] };
}

interface Model {
  things: Thing[];
  runes: RuneAt[];
  /** The top's frame, for the dish and what is laid in it. */
  top: { o: V3; a: V3; b: V3 };
}

/** The moss a stage is worth, nought (bare, the day it is set down) to one. */
const mossK = (stage: number): number => Math.max(0, Math.min(7, stage)) / 7;


/** Cushions of moss at points of the model, laid on the screen at zoom one (`drawPads`): each point, how big, how flat. */
type MossAt = [V3, number, number];
function padsAt(g: Ctx, k: PaintCtx, pts: MossAt[]): void {
  if (!pts.length) return;
  const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
  const ps: Pad[] = pts.map(([p, r, flat]) => {
    const [x, y] = proj(k.e, p);
    return [x, y, r * across, r * across * flat];
  });
  g.save();
  g.setTransform(k.base);
  drawPads(g, ps);
  specks(g, ps);
  g.restore();
}

/**
 * Moss beaded over the stone, the Runestones' way: many small cushions, each a
 * point on a surface, how big, and which way the side it sits on faces (none
 * for a top, which is always seen). Laid on the screen at zoom one, only those
 * on a side the eye sees, flat on a top and standing on a side, with their
 * flecks.
 */
type Drape = Array<[V3, number, V3 | null]>;
const drapeOf = (drape: Drape) => (g: Ctx, e: Eye): void => {
  const across = Math.hypot(e.ux, e.uy) * 0.9;
  const ps: Pad[] = drape.filter(([, , n]) => !n || dot(n, e.toward) > 0).map(([p, r, n]) => {
    const [x, y] = proj(e, p);
    return [x, y, r * across, r * across * (n ? 0.82 : 0.58)] as Pad;
  });
  drawPads(g, ps);
  specks(g, ps);
};

/** How far a face turned along `n` is turned from the light on the screen, nought to one: away to the right and toward the eye. */
function turnedFrom(e: Eye, n: V3): number {
  const sx = n[0] * e.ux + n[1] * e.vx, sy = n[0] * e.uy + n[1] * e.vy;
  const l = Math.hypot(sx, sy);
  if (l < 1e-6) return 0;
  return Math.max(0, Math.min(1, (0.62 * sx + 0.42 * sy) / l + 0.1));
}

/**
 * An upright strip of a face, `len` along and `lo` to `hi` across, a clear
 * step darker and cooler as far as it is turned from the light -- the
 * Runestones' own two tones are for broad faces, and two narrow rims side by
 * side read as one without it -- and worn pale along its upper arris where
 * it catches the light.
 */
function shadeStrip(g: Ctx, k: PaintCtx, n: V3, len: number, lo: number, hi: number, T: () => number): void {
  const away = turnedFrom(k.e, n);
  if (away > 0.05) {
    g.fillStyle = css(mix(k.fill, hex('#5a5474'), 0.55), 0.42 * away);
    g.fillRect(-1, lo - 1, len + 2, hi - lo + 2);
  }
  if (away < 0.5) {
    // Chips and wear along the lit arris.
    for (let j = 0; j < len / 2.6; j++) {
      const s0 = T() * (len - 1), w = 0.4 + T() * 0.9;
      g.beginPath();
      g.moveTo(s0, hi + 0.1);
      g.lineTo(s0 + w * 0.5, hi - 0.18 - T() * 0.25);
      g.lineTo(s0 + w, hi + 0.1);
      g.fillStyle = css(mix(k.fill, [255, 252, 242], 0.6), 0.75);
      g.fill();
    }
  }
}

/** The pale flecks on moss where the sky catches it, on every other cushion and the small ones too: the Runestones' beading. */
function specks(g: Ctx, ps: readonly Pad[]): void {
  g.fillStyle = '#d4eab4';
  g.beginPath();
  ps.forEach(([x, y, rx, ry], i) => {
    if (i % 2) return;
    const r = Math.max(0.35, rx * 0.32);
    g.moveTo(x - rx * 0.3 + r, y - ry * 0.35);
    g.ellipse(x - rx * 0.3, y - ry * 0.35, r, r * 0.8, 0, 0, TAU);
  });
  g.fill();
}

/** Ivy a step lighter than the walls' own, toward the Runestones' greens, so a thin strand reads on pale stone: each picture once. */
const lightened = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function ivyOf(pic: { img: HTMLCanvasElement }): HTMLCanvasElement {
  let c = lightened.get(pic.img);
  if (c) return c;
  const [cv, h] = canvasOf(pic.img.width, pic.img.height);
  h.drawImage(pic.img, 0, 0);
  h.globalCompositeOperation = 'source-atop';
  h.fillStyle = 'rgba(162, 205, 147, 0.38)';
  h.fillRect(0, 0, cv.width, cv.height);
  lightened.set(pic.img, (c = cv));
  return c;
}

const models = new Map<number, Model>();

function modelOf(stage: number): Model {
  const had = models.get(stage);
  if (had) return had;
  const m = mossK(stage);
  const things: Thing[] = [];
  const runes: RuneAt[] = [];

  /* -- the shaft's frame first: the step's shade and moss gather about its foot -- */
  // Leaning a hand's breadth over its height, toward its right and back, and set off the step's middle.
  const W: V3 = [0.12, -0.045, 1];
  const half0 = 3.3, half1 = 2.4;
  const f = (half1 - half0) / SHAFT_TOP;
  const O: V3 = [1.1, -0.55, SHAFT_FOOT];
  /** Where the overhang's shade begins down the shaft. */
  const UNDER = SHAFT_TOP - 1.8;

  /* -- the step: a slab bedded out of level, its back left edge in the turf, its shady side greening -- */
  const step = norm(STEP_OUTLINE);
  const stepU: V3 = unit([1, 0, STEP_FALL[0]]), stepW: V3 = unit([0, 1, STEP_FALL[1]]);
  const stepA: V3 = unit([stepU[1] * stepW[2] - stepU[2] * stepW[1], stepU[2] * stepW[0] - stepU[0] * stepW[2], stepU[0] * stepW[1] - stepU[1] * stepW[0]]);
  const stepO: V3 = [0, 0, STEP_TOP - 1];
  /** The shaft's foot on the step, drawn out by `k`: what its contact shade covers. */
  const footRing = (k: number): Pt[] => Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU;
    return [O[0] + 0.1 + Math.cos(a) * 4.2 * k, O[1] + Math.sin(a) * 3.2 * k] as Pt;
  });
  const stepTop: Painter = (g, k) => {
    const T = rand(4211);
    g.save();
    g.translate(-8, 0);
    skin(g, k.fill, T, 16, 7.4);
    g.restore();
    // Dressed to a margin only: a coursed joint across it read as a stack of boxes.
    cut(g, k.fill, 0.22, () => {
      const ins = inset(step, 0.8);
      g.beginPath();
      ins.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    });
    // The shaft's own shade where it stands on the step, cool, close in.
    for (const [kk, al] of [[1.25, 0.18], [1.08, 0.24]] as Array<[number, number]>) {
      const ring = footRing(kk);
      g.beginPath();
      ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fillStyle = css(mix(k.fill, hex('#4c4866'), 0.6), al);
      g.fill();
    }
    lichen(g, T, 5.9, 4.6, 0.55, LICHEN);
    lichen(g, T, -4.8, 5.6, 0.4, LICHEN);
  };
  const stepEdge = (i: number, up: number): { paint?: Painter } | undefined => {
    if (up > 0.35) return undefined;
    const p = step[i], q = step[(i + 1) % step.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const out: V3 = [(q[1] - p[1]) / len, -(q[0] - p[0]) / len, 0];
    return {
      paint: (g, k) => {
        const T = rand(4300 + i);
        skin(g, k.fill, T, len, 1);
        shadeStrip(g, k, out, len, -1, 0.6, T);
      },
    };
  };
  things.push({ x: 0, y: 0, faces: plate({ o: stepO, U: stepU, W: stepW, A: stepA, outline: step, half: [1, 1], tTop: 1, bevel: 0.4, tone: STEP, front: stepTop, edge: stepEdge }) });
  /*
   * Moss as the Runestones drape it: beads of it along the step's shady
   * arrises, on the top within a hand of the edge and down over the edge no
   * more than a third of its height, gathered where the noise has it.
   */
  {
    const M = rand(4219);
    const drape: Drape = [];
    step.forEach((p, i) => {
      const q = step[(i + 1) % step.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const out: V3 = [(q[1] - p[1]) / len, -(q[0] - p[0]) / len, 0];
      const shady = Math.max(0, -out[0] * 0.8 - out[1] * 0.6);
      if (shady < 0.25 || m <= 0.1) return;
      const a: V3 = [(q[0] - p[0]) / len, (q[1] - p[1]) / len, 0];
      for (let j = 0; j < len * 14 * m * shady; j++) {
        const sAlong = 0.3 + M() * (len - 0.6);
        if (noise2(sAlong / 1.6, i * 3.1, 77) < 0.5 - 0.35 * m) continue;
        const bx = p[0] + a[0] * sAlong, by = p[1] + a[1] * sAlong;
        if (M() < 0.55) {
          const d = M() * (0.4 + 0.8 * m);
          drape.push([[bx - out[0] * d, by - out[1] * d, stepZ(bx, by) + 0.04], 0.16 + 0.28 * M(), null]);
        } else {
          const z = stepZ(bx, by) - M() * 0.34;
          if (z < 0.05) continue;
          drape.push([[bx + out[0] * 0.1, by + out[1] * 0.1, z], 0.16 + 0.26 * M(), out]);
        }
      }
    });
    if (drape.length) things.push({ x: 0, y: 0, draw: drapeOf(drape) });
  }

  /*
   * -- fieldstones the step is bedded on, sunk in the turf to a third and
   * more of their height, three times one another's size: one warm, one
   * grey, one green with moss -- and grass grown up over where they go in --
   */
  // The big one tucked under the step's sunk corner, so the step's edge cuts across it; and one at each other side, so one breaks the step's outline from wherever it is seen.
  const stones: Array<[number, number, number, number, number, number, number, Tone]> = [
    [-7.0, -5.6, 4.1, 3.0, 2.4, 1.0, 911, FIELD],
    [8.4, -1.6, 2.5, 1.8, 1.7, 0.65, 923, FIELD_GREY],
    [-1.4, 8.7, 2.2, 1.5, 1.4, 0.55, 937, FIELD_GREEN],
  ];
  stones.forEach(([x, y, rx, ry, h, sink, seed, tone], n) => {
    const faces = boulder(x, y, rx, ry, h, seed * 0.37, seed, tone, 0);
    for (const fc of faces) fc.pts = fc.pts.map((p) => [p[0], p[1], p[2] - sink] as V3);
    // Its own cool shade on the turf, thrown away from the light, under it.
    things.push({
      x, y,
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0]);
        const across = Math.hypot(e.ux, e.uy);
        g.fillStyle = 'rgba(44, 74, 78, 0.2)';
        g.beginPath();
        g.ellipse(px + rx * 0.35 * across, py + 0.4 * across, rx * 1.15 * across, ry * 0.75 * across, 0.1, 0, TAU);
        g.fill();
      },
    });
    things.push({ x, y, faces });
    // Moss beaded over the top of the big one, where it is shaded by the step.
    if (n === 0 && m > 0.1) {
      const top = faces[faces.length - 1].pts;
      const flat = top.map((p) => [p[0], p[1]] as Pt);
      const zt = top.reduce((a, p) => a + p[2], 0) / top.length;
      const M = rand(seed + 5);
      const drape: Drape = [];
      for (let j = 0; j < 120 * m; j++) {
        const px = x + (M() - 0.5) * rx * 2, py = y + (M() - 0.5) * ry * 2;
        if (!inside(flat, px, py) || noise2(px / 1.5, py / 1.5, 91) < 0.55 - 0.3 * m) continue;
        drape.push([[px, py, zt + 0.05], 0.18 + 0.3 * M(), null]);
      }
      if (drape.length) things.push({ x, y, draw: drapeOf(drape) });
    }
    for (const [a, k] of [[0.6, 1], [2.3, 0.8], [4.1, 0.9]] as Array<[number, number]>) {
      const gx = x + Math.cos(a + n) * rx * 0.95, gy = y + Math.sin(a + n) * ry * 0.95;
      things.push({ x: gx + 0.01, y: gy + 0.01, reach: [[gx, gy, 5]], draw: (g, e) => { const [px, py] = proj(e, [gx, gy, 0]); grassTuft(g, px, py, seed + Math.round(a * 10), 0.3 * k); } });
    }
  });

  /* -- the corner snapped off the slab, lying in the grass below the break, its half rune dead -- */
  {
    const a0 = 0.7, tl = 0.32;
    const U: V3 = [Math.cos(a0), Math.sin(a0), 0];
    const Wc: V3 = [-Math.sin(a0) * Math.cos(tl), Math.cos(a0) * Math.cos(tl), Math.sin(tl)];
    const A: V3 = unit([U[1] * Wc[2] - U[2] * Wc[1], U[2] * Wc[0] - U[0] * Wc[2], U[0] * Wc[1] - U[1] * Wc[0]]);
    const chip: Pt[] = [[-1.5, -0.7], [1.3, -0.9], [1.7, 0.3], [0.4, 1.0], [-1.2, 0.65]];
    things.push({
      x: 8.6, y: 7.0,
      faces: plate({
        o: [8.6, 7.0, 0.12], U, W: Wc, A, outline: chip, half: [0.36, 0.36], tTop: 1, bevel: 0.12, tone: STONE,
        front: (g, k) => {
          cut(g, k.fill, 0.18, () => { g.beginPath(); g.moveTo(-1.3, 0.36); g.lineTo(1.2, 0.2); });
          cut(g, k.fill, 0.2, () => glyphPath(g, 'algiz', 0.25, -0.25, 0.48));
        },
        edge: () => ({ paint: (g, k) => { g.fillStyle = css(mix(k.fill, [252, 246, 232], 0.4), 0.7); g.fillRect(-1, -1, 6, 2); } }),
      }),
    });
  }

  /* -- grass and a flower or two breaking out of the moss at the foot, different all round -- */
  if (m > 0.25) {
    const spots: Array<[number, number, string]> = [[-8.4, 1.6, 'grass'], [-2.6, -8.2, 'grass'], [7.4, -6.6, 'grass'], [-8.6, 4.4, 'grass'], [2.8, 8.6, 'grass']];
    // Clusters of heads beside the grass, as at the Runestones' feet: two colours, white the more, a cluster more as the moss comes on.
    const blooms: Array<[number, number, string]> = [[-9.3, -1.6, 'white'], [5.8, -7.6, 'yellow'], [-4.6, 9.1, 'white']];
    spots.push(...blooms.slice(0, m > 0.8 ? 3 : m > 0.45 ? 2 : 0));
    spots.forEach(([x, y, kind], i) => things.push({
      x, y, reach: [[x, y, 7]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0]);
        if (kind === 'grass') grassTuft(g, px, py, 300 + i, 0.45 + 0.2 * m);
        else flowerClump(g, px, py, kind, 400 + i, 0.48);
      },
    }));
  }

  /*
   * -- the shaft: one solid, eight-sided in plan, its plan drawn in at the
   * waist and out at its foot and head, both across and through it, and
   * leaning off the step's middle. Each ring of it a little wider or
   * narrower than the last, the faces between them lit as they are turned and
   * no line drawn where one meets the next, so it is one stone turned to the
   * light. A sigil cut on its front and back, a rune up each side. --
   */
  const RINGS = [0, 0.9, 2.0, 3.1, 4.3, 5.35, SHAFT_TOP];
  const sideAt = (pts: Pt[], z: number): number => {
    for (let i = 1; i < pts.length; i++) if (z <= pts[i][1]) return pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * (z - pts[i - 1][1])) / (pts[i][1] - pts[i - 1][1]);
    return pts[pts.length - 1][0];
  };
  const RIGHT: Pt[] = [[4.1, 0], [3.8, 0.9], [3.0, 2.0], [2.6, 3.2], [2.75, 4.4], [3.3, 5.3], [3.7, SHAFT_TOP]];
  const xr = (z: number): number => sideAt(RIGHT, z), xl = (z: number): number => shaftLeft(z);
  const shaftDepthAt = (z: number): number => half0 + f * z - 0.55 * Math.sin((Math.PI * z) / SHAFT_TOP);
  const centre = (z: number): V3 => at(O, [z, W]);
  /** A ring's eight corners, anticlockwise from the back right, about its middle. */
  const ring = (z: number): V3[] => {
    const R = xr(z), L = xl(z), Y = shaftDepthAt(z), c = 0.75 + 0.1 * Math.sin(z * 1.3);
    const o = centre(z);
    return ([[R - c, -Y], [R, -Y + c], [R, Y - c], [R - c, Y], [L + c, Y], [L, Y - c], [L, -Y + c], [L + c, -Y]] as Pt[]).map(([x, y]) => [o[0] + x, o[1] + y, o[2]] as V3);
  };
  const rings = RINGS.map(ring);
  const PANEL = { z: 2.9, r: 1.2 };
  const yFace = shaftDepthAt(PANEL.z);
  const frontF = { o: at(O, [yFace, [0, 1, 0]]), a: [1, 0, 0] as V3, b: W };
  const backF = { o: at(O, [-yFace, [0, 1, 0]]), a: [-1, 0, 0] as V3, b: W };
  const SIDE_Z = 3.4;
  const rightF = { o: at(O, [xr(SIDE_Z), [1, 0, 0]]), a: [0, -1, 0] as V3, b: W };
  const leftF = { o: at(O, [xl(SIDE_Z), [1, 0, 0]]), a: [0, 1, 0] as V3, b: W };
  // Front and back as polygons up one corner and down the other, for the sigils' light to be kept to.
  const facePoly = (a: number, b: number): V3[] => [...rings.map((r) => r[a]), ...rings.map((r) => r[b]).reverse()];
  const slabHull: V3[] = [];
  for (const [s, t] of SLAB_OUTLINE) slabHull.push(onSlab(s, t, SLAB_UP), onSlab(s, t, -slabDepth(s, t)));
  runes.push({ frame: frontF, n: [0, 1, 0], glyph: '', x: 0, z: PANEL.z, s: PANEL.r, sigil: 'star', kind: 'panel', round: 0, clip: { keep: facePoly(3, 4), off: slabHull } });
  runes.push({ frame: backF, n: [0, -1, 0], glyph: '', x: 0, z: PANEL.z, s: 1.1, sigil: 'eye', kind: 'panel', round: 0.5, clip: { keep: facePoly(7, 0), off: slabHull } });
  runes.push({ frame: rightF, n: [1, 0, 0], glyph: 'sowilo', x: 0, z: SIDE_Z, s: 0.62, kind: 'rim', round: 0.25, clip: { keep: facePoly(1, 2), off: slabHull } });
  runes.push({ frame: leftF, n: [-1, 0, 0], glyph: 'othala', x: 0, z: SIDE_Z, s: 0.62, kind: 'rim', round: 0.75, clip: { keep: facePoly(5, 6), off: slabHull } });

  /** What is cut and grows on a broad side of it, in that side's frame: across it and up it. */
  const broad = (side: 'front' | 'back' | 'right' | 'left'): Painter => (g, k) => {
    const T = rand({ front: 5101, back: 5107, right: 5113, left: 5119 }[side]);
    g.save();
    g.translate(-5, 3.2);
    skin(g, k.fill, T, 10, 3.6);
    g.restore();
    if (side === 'front' || side === 'back') {
      const r = side === 'front' ? PANEL.r : 1.1;
      g.beginPath();
      g.arc(0, PANEL.z, r * 1.05, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#8f879c'), 0.3), 0.32);
      g.fill();
      cut(g, k.fill, 0.24, () => strokesPath(g, sigil(side === 'front' ? 'star' : 'eye'), 0, PANEL.z, r));
      for (const sx of [-1, 1]) for (const dz of [-0.7, 0, 0.7]) cut(g, k.fill, 0.22, () => { g.beginPath(); g.moveTo(sx * (r + 0.7), PANEL.z + dz + 0.04); g.lineTo(sx * (r + 0.7), PANEL.z + dz - 0.04); });
      if (side === 'back') cut(g, k.fill, 0.2, () => { g.beginPath(); g.moveTo(2.4, 4.2); g.lineTo(1.7, 3.9); g.lineTo(1.3, 4.1); g.lineTo(0.8, 3.6); });
      lichen(g, T, side === 'front' ? 1.9 : -1.6, 3.7, 0.42, LICHEN);
    } else {
      // A rune up the side, in a little sunk field of its own.
      g.beginPath();
      g.ellipse(0, SIDE_Z, 0.8, 0.95, 0, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#8a8098'), 0.4), 0.5);
      g.fill();
      cut(g, k.fill, RIM_W, () => glyphPath(g, side === 'right' ? 'sowilo' : 'othala', 0, SIDE_Z, 0.62));
    }
  };
  const SIDE_OF: Array<'front' | 'back' | 'right' | 'left' | null> = [null, 'right', null, 'front', null, 'left', null, 'back'];
  const FRAME_OF = { front: frontF, back: backF, right: rightF, left: leftF };
  const shaftFaces: Face[] = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const z0 = RINGS[k], z1 = RINGS[k + 1];
    for (let j = 0; j < 8; j++) {
      const pts = [rings[k][j], rings[k][(j + 1) % 8], rings[k + 1][(j + 1) % 8], rings[k + 1][j]];
      const a2: Pt = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
      const out: V3 = unit([a2[1], -a2[0], 0]);
      let n = newell(pts);
      if (dot(n, out) < 0) n = mul(n, -1);
      const side = SIDE_OF[j];
      const lo = z0, hi = z1;
      const len = Math.hypot(a2[0], a2[1]);
      const frame = side ? FRAME_OF[side] : { o: pts[0], a: unit(sub(pts[1], pts[0])), b: W };
      const T = rand(5200 + k * 8 + j);
      const paint: Painter = (g, kk) => {
        if (side) broad(side)(g, kk);
        else {
          g.save();
          g.translate(0, (lo + hi) / 2 - lo);
          skin(g, kk.fill, T, len, (hi - lo) / 2 + 0.3);
          g.restore();
        }
        // The same stone turned from the light: a clear step darker and cooler on the far side, no line between.
        const away = turnedFrom(kk.e, out);
        if (away > 0.05) { g.fillStyle = css(mix(kk.fill, hex('#57517a'), 0.55), 0.38 * away); g.fillRect(-8, -2, 16, 12); }
        // The slab's shade over the head of it, and the cool where it stands on the step.
        const zz = (z: number): number => (side ? z : z - lo);
        if (hi > UNDER) {
          g.beginPath();
          g.moveTo(-8, 12);
          for (let x = -8; x <= 8; x += 1) g.lineTo(x, zz(UNDER) + 0.35 * noise2(x / 1.8, 3.5 + j, 5));
          g.lineTo(8, 12);
          g.closePath();
          g.fillStyle = css(mix(kk.fill, hex('#4e4868'), 0.55), 0.46);
          g.fill();
        }
        if (lo < 1) {
          g.beginPath();
          g.moveTo(-8, -2);
          for (let x = -8; x <= 8; x += 1) g.lineTo(x, zz(0.75) + 0.4 * noise2(x / 2.5, 0.5 + j, 3));
          g.lineTo(8, -2);
          g.closePath();
          g.fillStyle = css(mix(kk.fill, hex('#57536e'), 0.5), 0.42);
          g.fill();
        }
      };
      shaftFaces.push({ pts, n, tone: STONE, frame, paint, crease: 0 });
    }
  }
  // Ivy up its shady front left arris, a thin chain of leaves with a spray of flower, from the step toward the cap.
  if (m >= 0.35) {
    const fr = shaftFaces[3];
    fr.over = (g) => {
      const pic = strandPic('climb', 3, Math.max(2, Math.round(STAGES * 0.4 * Math.min(1, (m - 0.2) / 0.7))), true);
      if (!pic) return;
      const sc = (0.4 * 10) / PPM;
      g.save();
      g.translate(xl(0.2) + 0.7, 0.1);
      g.scale(sc, -sc);
      g.drawImage(ivyOf(pic), -pic.ax, -pic.ay);
      g.restore();
    };
  }
  things.push({ x: 0, y: 0, faces: shaftFaces });
  // A drape of moss over its foot on the shady side, low down, beaded: drawn only where it lies on a side the eye sees.
  {
    const M = rand(5401);
    const drape: Array<[V3, number, V3]> = [];
    for (let i = 0; m > 0.15 && i < 80 * m; i++) {
      const j = 4 + Math.floor(M() * 4), r0 = rings[0];
      const u = M(), a = r0[j], b = r0[(j + 1) % 8];
      const z = Math.pow(M(), 1.8) * (0.35 + 0.65 * m);
      const p = add(add(a, mul(sub(b, a), u)), [0, 0, z]);
      const o = centre(z);
      const outw = unit([p[0] - o[0], p[1] - o[1], 0]);
      drape.push([add(p, mul(outw, 0.12)), 0.2 + 0.26 * M(), outw]);
    }
    if (drape.length) {
      things.push({
        x: 0, y: 0,
        draw: (g, e) => {
          const across = Math.hypot(e.ux, e.uy) * 0.9;
          const ps: Pad[] = drape.filter(([, , n]) => dot(n, e.toward) > 0).map(([p, r]) => {
            const [x, y] = proj(e, p);
            return [x, y, r * across, r * across * 0.82] as Pad;
          });
          drawPads(g, ps);
          specks(g, ps);
        },
      });
    }
  }

  /* -- the slab: tipped, its chamfers unequal, a corner snapped off, a dark band of runes round its rim, its top dished -- */
  const slab = norm(SLAB_OUTLINE);
  const per = slab.map((p, i) => Math.hypot(slab[(i + 1) % slab.length][0] - p[0], slab[(i + 1) % slab.length][1] - p[1]));
  const broken = (i: number): boolean => BREAK_FROM.has(`${slab[i][0]},${slab[i][1]}`);
  const rimLen = per.reduce((a, b) => a + b, 0);
  /** The band's top across a rim face: under its chamfer. */
  const bandTop = (i: number): number => SLAB_UP - SLAB_BEVELS[i] - 0.08;
  const BAND_LO = -0.58;
  let along = 0, gi = 0;
  const rimRunes: Array<Array<{ s: number; glyph: string }>> = slab.map((p, i) => {
    const len = per[i];
    const n = broken(i) ? 0 : Math.max(0, Math.min(3, Math.floor((len - 0.6) / RIM_STEP)));
    const q = slab[(i + 1) % slab.length];
    const es = (q[0] - p[0]) / len, et = (q[1] - p[1]) / len;
    const a = unit(at([0, 0, 0], [es, SU], [et, SW]));
    const nOut = unit(at([0, 0, 0], [et, SU], [-es, SW]));
    const out: Array<{ s: number; glyph: string }> = [];
    for (let j = 0; j < n; j++) {
      const s = (len * (j + 0.5)) / n;
      const glyph = RIM_GLYPHS[(gi++ * 5) % RIM_GLYPHS.length];
      out.push({ s, glyph });
      runes.push({ frame: { o: onSlab(p[0], p[1]), a, b: SA }, n: nOut, glyph, x: s, z: RIM_Y, s: RIM_SIZE, kind: 'rim', round: (along + s) / rimLen });
    }
    along += len;
    return out;
  });
  const slabEdge = (i: number, up: number): { paint?: Painter; over?: Painter } | undefined => {
    if (Math.abs(up) > 0.3) return undefined;
    const len = per[i];
    const p = slab[i], q = slab[(i + 1) % slab.length];
    const es = (q[0] - p[0]) / len, et = (q[1] - p[1]) / len;
    const nOut = unit(at([0, 0, 0], [et, SU], [-es, SW]));
    const hi = bandTop(i);
    if (broken(i)) {
      // The break: raw stone, paler than the weathered skin, grained and stepped, no rules and no runes.
      return {
        paint: (g, k) => {
          const T = rand(6500 + i);
          g.fillStyle = css(mix(k.fill, [252, 246, 232], 0.42), 0.9);
          g.fillRect(-1, -2, len + 2, 4);
          for (let j = 0; j < len * 6; j++) {
            g.fillStyle = T() < 0.5 ? css(mix(k.fill, hex('#a99aa2'), 0.4), 0.45) : css([255, 252, 244], 0.5);
            g.fillRect(T() * len, -1.4 + T() * 2.6, 0.18 + T() * 0.25, 0.12 + T() * 0.15);
          }
          // Two little facets where it came away, a step in the break.
          g.beginPath();
          g.moveTo(len * 0.3, -1.5); g.lineTo(len * 0.45, 0.2); g.lineTo(len * 0.7, -0.3); g.lineTo(len * 0.8, -1.5);
          g.fillStyle = css(mix(k.fill, hex('#8f879c'), 0.35), 0.5);
          g.fill();
          shadeStrip(g, k, nOut, len, -1.5, hi, T);
        },
      };
    }
    // Ivy hanging over the back left corner of the cap, from the strand up the shaft.
    // Kept to the face, rooted under its top, and not drawn at all when the face is near edge on.
    const hangOver: Painter | undefined = i === 0 && m >= 0.5 ? (g, k) => {
      const tw = k.e.toward, tl = Math.hypot(tw[0], tw[1], tw[2]) || 1;
      if (dot(nOut, tw) / tl < 0.42) return;
      const pic = strandPic('hang', 0, Math.max(2, Math.round(STAGES * 0.5 * Math.min(1, (m - 0.4) / 0.6))), true);
      if (!pic) return;
      const sc = (0.45 * 10) / PPM;
      g.save();
      g.beginPath();
      g.rect(0, -2.2, len, hi + 2.2);
      g.clip();
      g.translate(len * 0.5, hi - 0.15);
      g.scale(sc, -sc);
      g.drawImage(ivyOf(pic), -pic.ax, -pic.ay);
      g.restore();
    } : undefined;
    return {
      over: hangOver,
      paint: (g, k) => {
        const T = rand(6100 + i);
        skin(g, k.fill, T, len, 1.3);
        shadeStrip(g, k, nOut, len, -1.5, hi + 0.08, T);
        // The band: cut back a step, darker and cooler than the stone, ruled both sides, the runes thin in it.
        g.fillStyle = css(mix(k.fill, hex('#8a8098'), 0.5), 0.62);
        g.fillRect(0.25, BAND_LO, len - 0.5, hi - BAND_LO);
        for (const y of [hi, BAND_LO]) cut(g, k.fill, 0.14, () => { g.beginPath(); g.moveTo(0.25, y); g.lineTo(len - 0.25, y); });
        const band = mix(k.fill, hex('#8a8098'), 0.31);
        for (const r of rimRunes[i]) cut(g, band, RIM_W, () => glyphPath(g, r.glyph, r.s, RIM_Y, RIM_SIZE));
        // A chip out of the lower arris now and then.
        if (len > 4) {
          const s0 = len * (0.2 + 0.5 * T());
          const lo = -slabDepth(p[0] + (q[0] - p[0]) * (s0 / len), p[1] + (q[1] - p[1]) * (s0 / len)) + 0.3;
          g.beginPath();
          g.moveTo(s0, lo - 0.2); g.lineTo(s0 + 0.6, lo + 0.3); g.lineTo(s0 + 1.3, lo - 0.2);
          g.fillStyle = css(mix(k.fill, hex('#8e8798'), 0.45), 0.6);
          g.fill();
        }
        if (p[0] < 0 || p[1] < -4.5) lichen(g, T, len * (0.2 + 0.6 * T()), -0.85, 0.32, LICHEN);
      },
    };
  };
  const top = { o: onSlab(0, 0, SLAB_UP), a: SU, b: SW };
  const topFace = slab.map(([s, t]) => onSlab(s, t, SLAB_UP));
  runes.push({ frame: top, n: SA, glyph: '', x: DISH.x, z: DISH.y, s: 1.75, sigil: 'dish', kind: 'dish', round: 0, clip: { keep: topFace } });
  // Moss only where water stands: in the low side of the dish, low down.

  const slabTop: Painter = (g, k) => {
    const T = rand(7001);
    g.save();
    g.translate(-7, 0);
    skin(g, k.fill, T, 14, 6);
    g.restore();
    cut(g, k.fill, 0.22, () => {
      const ins = inset(slab, 0.85);
      g.beginPath();
      ins.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    });
    dish(g, k);
    for (const [x, y, r] of [[-5.4, -3.5, 0.5], [5.3, -4.4, 0.4], [-4.9, 4.6, 0.38]] as Array<[number, number, number]>) lichen(g, T, x, y, r, LICHEN);
    // Moss beaded along the outer margin on its sheltered back and left, out of the dish.
    const pts: MossAt[] = [];
    for (let j = 0; m > 0.25 && j < 90 * m; j++) {
      const x = -6.6 + T() * 13, y = -5.8 + T() * 11.6;
      if (!(x < -3 || y < -3.6) || !inside(inset(slab, 0.15), x, y) || inside(inset(slab, 1.0), x, y)) continue;
      if (noise2(x / 1.8, y / 1.8, 63) < 0.55 - 0.3 * m) continue;
      pts.push([onSlab(x, y, SLAB_UP + 0.03), 0.16 + 0.26 * T(), 0.55]);
    }
    padsAt(g, k, pts);
  };
  const depthAt = (s: number, t: number): [number, number] => {
    const d = slabDepth(s, t);
    return [(SLAB_UP - d) / 2, (SLAB_UP + d) / 2];
  };
  things.push({ x: 0, y: 0, faces: plate({ o: SLAB_O, U: SU, W: SW, A: SA, outline: slab, half: [SLAB_UP, SLAB_UP], tTop: 1, bevel: 0.3, bevels: SLAB_BEVELS, tone: STONE, front: slabTop, edge: slabEdge, depthAt }) });

  const model = { things, runes, top };
  models.set(stage, model);
  return model;
}

function inside(poly: readonly Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** The dish's rim, in the top's plan: an ellipse cut by eye, moved by (dx, dy) and grown by `k`; `back` runs it the other way. */
function dishPath(g: Ctx, dx = 0, dy = 0, k = 1, back = false, fresh = true): void {
  if (fresh) g.beginPath();
  for (let i = 0; i < 22; i++) {
    const a = ((back ? -i : i) / 22) * TAU;
    const w = 1 + 0.035 * Math.sin(a * 3 + 1.1) + 0.02 * Math.cos(a * 5);
    const x = DISH.x + dx + Math.cos(a) * DISH.rx * k * w, y = DISH.y + dy + Math.sin(a) * DISH.ry * k * w;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}

/** Which way, in a top's plan, is right and which is down on the screen: what the dish is lit and shaded along. */
function screenAxes(e: Eye): { right: Pt; down: Pt } {
  const det = e.ux * e.vy - e.vx * e.uy;
  const r: Pt = [e.vy / det, -e.uy / det], d: Pt = [-e.vx / det, e.ux / det];
  const lr = Math.hypot(...r) || 1, ld = Math.hypot(...d) || 1;
  return { right: [r[0] / lr, r[1] / lr], down: [d[0] / ld, d[1] / ld] };
}

/**
 * The dish, a shallow bowl sunk into the top, in flat fields: the far wall,
 * which faces the eye, in shade where the lip keeps the light off it; the
 * floor a step paler; a lit crescent on the right; and the near lip catching
 * the light. A cut ring round the lip and the star cut in its floor.
 */
function dish(g: Ctx, k: PaintCtx): void {
  const { right, down } = screenAxes(k.e);
  const fill = k.fill;
  const deep = mix(fill, hex('#564f6c'), 0.62), wall = mix(fill, hex('#7a7290'), 0.45), floor = mix(fill, hex('#958ea2'), 0.3), lit = mix(fill, [255, 250, 238], 0.5);
  cut(g, fill, 0.32, () => dishPath(g, 0, 0, 1.1));
  g.save();
  dishPath(g);
  g.clip();
  g.fillStyle = css(deep);
  g.fillRect(-12, -12, 24, 24);
  // The far wall: lit a little lower down it, where the light gets in over the near lip.
  dishPath(g, down[0] * 0.45, down[1] * 0.45, 0.98);
  g.fillStyle = css(wall);
  g.fill();
  dishPath(g, right[0] * 0.35 + down[0] * 1.05, right[1] * 0.35 + down[1] * 1.05, 0.88);
  g.fillStyle = css(floor);
  g.fill();
  // The wall on the right, lit: the dish less itself moved to the left.
  g.beginPath();
  g.rect(-12, -12, 24, 24);
  dishPath(g, -right[0] * 0.6, -right[1] * 0.6, 1, true, false);
  g.fillStyle = css(lit, 0.5);
  g.fill('evenodd');
  cut(g, floor, 0.36, () => strokesPath(g, sigil('dish'), DISH.x, DISH.y, 1.75));
  g.restore();
  // The near lip catching the light, outside the bowl.
  g.save();
  g.beginPath();
  g.rect(-12, -12, 24, 24);
  dishPath(g, 0, 0, 1.02, true, false);
  g.clip('evenodd');
  dishPath(g, down[0] * 0.18, down[1] * 0.18, 1.04);
  g.strokeStyle = css(mix(fill, [255, 252, 244], 0.65), 0.7);
  g.lineWidth = 0.16;
  g.stroke();
  g.restore();
}

/* ---- baking ----------------------------------------------------------------- */

interface Lit {
  gl: Glow;
  kind: RuneAt['kind'];
  round: number;
}

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What the stone covers from the footprint's middle, in pixels at zoom one: left, top, right, bottom. */
  bounds: [number, number, number, number];
  glows: Lit[];
  /** The top's frame on the screen at zoom one, for the dish's light, the scroll and the motes: a 2x3 matrix. */
  top: [number, number, number, number, number, number];
  e: Eye;
}

const BAKED_BUDGET = 8e6;
const baked = new Map<string, Baked>();
let bakedArea = 0;

/** The hull of points on the screen: what a solid covers, near enough. */
function hull(ps: Pt[]): Pt[] {
  const p = ps.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Keep a rune's baked light inside `keep` and off `off`, on the screen at zoom one: every picture of it. */
function clipGlow(gl: Glow, scale: number, keep: Pt[], off?: Pt[]): void {
  const [a, b] = gl.box;
  const poly = (h: Ctx, ps: Pt[]): void => {
    h.beginPath();
    ps.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
    h.closePath();
  };
  for (const cv of [gl.core, gl.halo, gl.dusk, gl.mask]) {
    const h = cv.getContext('2d') as Ctx;
    h.save();
    h.setTransform(scale, 0, 0, scale, -a * scale, -b * scale);
    h.globalCompositeOperation = 'destination-in';
    poly(h, keep);
    h.fill();
    if (off) {
      h.globalCompositeOperation = 'destination-out';
      poly(h, off);
      h.fill();
    }
    h.restore();
  }
}

function bake(view: PlinthView, stage: number, scale: number): Baked {
  const model = modelOf(stage);
  const e = eyeOfView(view);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p: V3): void => {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const t of model.things) {
    for (const fc of t.faces ?? []) for (const p of fc.pts) take(p);
    for (const p of t.reach ?? []) take(p);
  }
  const bounds: [number, number, number, number] = [Math.floor(x0 - 2), Math.floor(y0 - 2), Math.ceil(x1 + 2), Math.ceil(y1 + 2)];
  const pad = 10;
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  // Its shade on the ground, thrown away from the light: flat, one field, as every shade on the island is.
  {
    const [sx, sy] = proj(e, [0, 0, 0]);
    const across = Math.hypot(e.ux, e.uy);
    g.fillStyle = 'rgba(44, 74, 78, 0.17)';
    g.beginPath();
    g.ellipse(sx + 2.4 * across, sy + 1 * across, 8.6 * across, 5 * across, 0.1, 0, TAU);
    g.fill();
  }
  const things = model.things.slice().sort((a, b) => (a.first ? -1 : b.first ? 1 : groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y)));
  for (const t of things) {
    if (t.draw) t.draw(g, e);
    else if (t.faces) drawFaces(g, e, t.faces as Face[], INK);
  }

  const glows: Lit[] = [];
  for (const r of model.runes) {
    if (dot(r.n, e.toward) <= 1e-6) continue;
    const [ox, oy] = proj(e, r.frame.o), [ax, ay] = proj(e, r.frame.a), [bx, by] = proj(e, r.frame.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    const path = (h: Ctx): void => (r.sigil ? strokesPath(h, sigil(r.sigil), r.x, r.z, r.s) : glyphPath(h, r.glyph, r.x, r.z, r.s));
    const gl = bakeGlow(M, path, r.x, r.z, r.s, !!r.sigil, 0, scale, r.sigil === 'dish' ? 0.3 : r.sigil ? 0.2 : RIM_W, r.sigil ? 0.8 : 0.5);
    if (r.clip) clipGlow(gl, scale, r.clip.keep.map((p) => proj(e, p)), r.clip.off ? hull(r.clip.off.map((p) => proj(e, p))) : undefined);
    glows.push({ gl, kind: r.kind, round: r.round });
  }
  const tf = model.top;
  const [ox, oy] = proj(e, tf.o), [ax, ay] = proj(e, tf.a), [bx, by] = proj(e, tf.b);
  return { canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds, glows, top: [ax, ay, bx, by, ox, oy], e };
}

function bakedFor(view: PlinthView, stage: number, zoom: number): Baked {
  const scale = scaleFor(zoom);
  const key = `${view.ux.toFixed(3)},${view.uy.toFixed(3)},${view.vx.toFixed(3)},${view.vy.toFixed(3)}|${stage}|${scale}`;
  let b = baked.get(key);
  if (b) {
    baked.delete(key);
    baked.set(key, b);
    return b;
  }
  b = bake(view, stage, scale);
  baked.set(key, b);
  bakedArea += b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= old.canvas.width * old.canvas.height;
  }
  return b;
}

/** A piece's trim as the moss stage it carries (`mossTrim`): nought to seven. */
const stageOf = (trim: number | undefined): number => (trim ? Math.max(0, trim) % 8 : 0);

/**
 * Draw the plinth's stone with its footprint's middle at (sx, sy): the bake
 * alone, without its runes' light (`drawPlinthRunes`). Returns what the stone
 * covers from (sx, sy), in screen pixels: left, top, right, bottom.
 */
export function drawPlinth(ctx: Ctx, sx: number, sy: number, zoom: number, view: PlinthView, trim?: number): [number, number, number, number] {
  const b = bakedFor(view, stageOf(trim), zoom);
  const k = zoom / b.scale;
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  const [l, t, r, bt] = b.bounds;
  return [l * zoom, t * zoom, r * zoom, bt * zoom];
}

/* ---- the light of its runes -------------------------------------------------- */

/** Seconds to the wave of light going once round the rim at rest, and while somebody enchants. */
const ROUND_REST = 7;
const ROUND_BUSY = 1.8;
/** Motes rising off the dish while it is in use: how many, and the seconds each takes. */
const MOTES = 6;
const MOTE_RISE = 2.6;

/** How far into its breath a rune is at `t`, nought to one: a wave going round the rim, the dish and roundels slower. */
function breath(l: Lit, t: number, busy: boolean): number {
  if (l.kind === 'rim') return 0.5 + 0.5 * Math.sin((t / (busy ? ROUND_BUSY : ROUND_REST) - l.round * (busy ? 2 : 1)) * TAU);
  return busy ? 0.75 + 0.25 * Math.sin((t / 1.1) * TAU) : 0.5 + 0.5 * Math.sin((t / 8 + l.round) * TAU);
}

/** A point of the top's plan, `z` over it, on the screen at zoom one from the footprint's middle. */
function onTop(b: Baked, x: number, y: number, z = 0): Pt {
  const [a, bb, c, d, e, f] = b.top;
  return [a * x + c * y + e, bb * x + d * y + f - z * HEIGHT_SCALE];
}

/** Where the motes are at `t`: rising off the dish and fading, in pixels at zoom one, how bright, and how big at `zoom`. */
function motesAt(b: Baked, t: number, zoom: number): Array<{ x: number; y: number; a: number; r: number }> {
  const out: Array<{ x: number; y: number; a: number; r: number }> = [];
  for (let i = 0; i < MOTES; i++) {
    const u = ((t / (MOTE_RISE + i * 0.37) + i * 0.41) % 1 + 1) % 1;
    const a0 = i * 2.4 + u * 2.2;
    const rr = 1.0 + 1.2 * ((i * 0.618) % 1);
    const [x, y] = onTop(b, DISH.x + Math.cos(a0) * rr * (1 - u * 0.4), DISH.y + Math.sin(a0) * rr * 0.8 * (1 - u * 0.4), 0.4 + u * 13);
    out.push({ x, y, a: Math.pow(Math.sin(Math.PI * u), 1.3), r: (0.9 + 0.5 * ((i * 0.618) % 1)) * zoom ** 0.75 });
  }
  return out;
}

/** The scroll laid open in the dish while somebody enchants: a sheet across it, its ends rolled, a rune on it alight. */
function drawScroll(ctx: Ctx, b: Baked, sx: number, sy: number, zoom: number, t: number): void {
  const th = 0.35, c = Math.cos(th), s = Math.sin(th);
  const P = (u: number, v: number, z = 0.35): Pt => {
    const [x, y] = onTop(b, DISH.x + u * c - v * s, DISH.y + u * s + v * c, z);
    return [sx + x * zoom, sy + y * zoom];
  };
  const hw = 1.9, hh = 1.15;
  const poly = (pts: Pt[]): void => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  poly([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)]);
  ctx.fillStyle = '#e8d9b6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(154, 130, 98, 0.7)';
  ctx.lineWidth = Math.max(0.5, 0.35 * zoom);
  ctx.stroke();
  // A few lines written across it.
  ctx.strokeStyle = 'rgba(120, 96, 72, 0.55)';
  ctx.lineWidth = Math.max(0.5, 0.35 * zoom);
  for (const v of [-1.0, -0.4, 0.8, 1.25]) {
    const [x0, y0] = P(-hw + 0.6, v), [x1, y1] = P(v > 0 ? hw - 1.2 : -0.9, v);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // The rolled ends, standing a little proud of it.
  for (const u of [-hw, hw]) {
    const [x0, y0] = P(u, -hh - 0.15, 0.55), [x1, y1] = P(u, hh + 0.15, 0.55);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8f7656';
    ctx.lineWidth = 0.75 * Math.hypot(b.top[0], b.top[1]) * zoom;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#e4d3ae';
    ctx.lineWidth = 0.45 * Math.hypot(b.top[0], b.top[1]) * zoom;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // Its rune, alight.
  const [a, bb, cc, d] = b.top;
  const [mx, my] = P(0.8, 0.1);
  ctx.save();
  ctx.translate(mx, my);
  ctx.transform(a * zoom, bb * zoom, cc * zoom, d * zoom, 0, 0);
  ctx.transform(c, s, -s, c, 0, 0);
  ctx.lineCap = 'round';
  glyphPath(ctx, 'algiz', 0, 0, 0.62);
  ctx.strokeStyle = 'rgba(214, 140, 52, 0.9)';
  ctx.lineWidth = 0.42;
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 236, 180, ${0.75 + 0.25 * Math.sin(t * 5)})`;
  ctx.lineWidth = 0.2;
  ctx.stroke();
  ctx.restore();
}

/**
 * The plinth's runes over its bake, at (sx, sy), as they are at `t` under a
 * night `night` dark: faint at rest, a slow wave going round the rim; and
 * while somebody enchants at it (`busy`) bright, the wave quick, the dish
 * full of light, the scroll laid open in it and motes rising.
 */
export function drawPlinthRunes(ctx: Ctx, sx: number, sy: number, zoom: number, view: PlinthView, trim: number | undefined, night: number, busy: boolean, t = performance.now() / 1000): void {
  const b = bakedFor(view, stageOf(trim), zoom);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  const day = 1 - night;
  if (busy) {
    // The dish full of light, under the scroll.
    const [cx, cy] = onTop(b, DISH.x, DISH.y, 0.2);
    const X = sx + cx * zoom, Y = sy + cy * zoom, rr = DISH.rx * Math.hypot(b.top[0], b.top[1]) * 1.25 * zoom;
    ctx.save();
    ctx.translate(X, Y);
    ctx.scale(1, Math.max(0.3, Math.abs(b.top[3] / Math.hypot(b.top[0], b.top[1]))) * 0.95);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    const k = 0.15 + 0.12 * night + 0.04 * Math.sin(t * 5.7);
    grad.addColorStop(0, `rgba(255, 214, 140, ${k.toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(255, 190, 110, ${(k * 0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // And a pool of pale gold filling the bowl itself, laid over and never past the dish's own light: the brightest thing on it.
    ctx.beginPath();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const [px, py] = onTop(b, DISH.x + Math.cos(a) * DISH.rx * 0.92, DISH.y + Math.sin(a) * DISH.ry * 0.92, -0.2);
      if (i) ctx.lineTo(sx + px * zoom, sy + py * zoom); else ctx.moveTo(sx + px * zoom, sy + py * zoom);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.6 + 0.08 * Math.sin(t * 5.7);
    ctx.fillStyle = 'rgb(240, 214, 152)';
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const l of b.glows) {
    const gl = l.gl;
    const p = breath(l, t, busy);
    const [x, y, w, h] = gl.box;
    const X = sx + x * zoom, Y = sy + y * zoom, Wd = w * zoom, Ht = h * zoom;
    if (busy && l.kind === 'dish') continue;
    const round = l.kind !== 'rim';
    if (day > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = day * (busy ? 0.45 + 0.4 * p : round ? 0.04 : 0.14 + 0.12 * p) * gl.square;
      ctx.drawImage(gl.halo, X, Y, Wd, Ht);
    }
    if (night > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = night * (busy ? (round ? 0.2 + 0.12 * p : 0.08 + 0.08 * p) : 0.02 + 0.02 * p);
      ctx.drawImage(gl.dusk, X, Y, Wd, Ht);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(0.92, busy ? 0.72 + 0.2 * p : round ? 0.36 + 0.1 * night + 0.12 * p : 0.62 - 0.14 * night + 0.2 * p);
    ctx.drawImage(gl.core, X, Y, Wd, Ht);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (busy) {
    drawScroll(ctx, b, sx, sy, zoom, t);
    for (const m of motesAt(b, t, zoom)) {
      const px = sx + m.x * zoom, py = sy + m.y * zoom;
      const a = m.a * (0.45 + 0.55 * night);
      // Pale gold laid over, not added: added on the grass by day it went green-white, and at night past the dish's own light.
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a * 0.28;
      ctx.fillStyle = 'rgb(236, 196, 122)';
      ctx.beginPath();
      ctx.arc(px, py, m.r * 1.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a * 0.95;
      ctx.fillStyle = 'rgb(245, 228, 180)';
      ctx.save();
      ctx.translate(px, py);
      star(ctx, m.r * 1.7, m.r * 0.6);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/**
 * What the plinth at (sx, sy) takes back off the night this frame, for
 * `RunestoneNight.glowing`: the box its shapes cover in screen pixels (left,
 * top, right, bottom), the soft light round its runes and over its dish, and
 * its runes in their own shapes -- each moved by (dx, dy) when asked.
 */
export function plinthNight(sx: number, sy: number, zoom: number, view: PlinthView, trim: number | undefined, busy: boolean, t = performance.now() / 1000): {
  box: [number, number, number, number];
  holes: (dx: number, dy: number) => Array<{ x: number; y: number; r: number; a: number }>;
  masks: (dx: number, dy: number) => NightMask[];
} {
  const b = bakedFor(view, stageOf(trim), zoom);
  const across = Math.hypot(b.top[0], b.top[1]);
  const [cx, cy] = onTop(b, DISH.x, DISH.y, 0.2);
  const dishR = DISH.rx * across * (busy ? 1.3 : 1.1);
  let L = sx + (cx - dishR) * zoom, T = sy + (cy - dishR) * zoom, R = sx + (cx + dishR) * zoom, B = sy + (cy + dishR) * zoom;
  for (const { gl } of b.glows) {
    const [x, y, w, h] = gl.box;
    L = Math.min(L, sx + x * zoom, sx + (gl.cx - gl.r * 1.5) * zoom); T = Math.min(T, sy + y * zoom, sy + (gl.cy - gl.r * 1.5) * zoom);
    R = Math.max(R, sx + (x + w) * zoom, sx + (gl.cx + gl.r * 1.5) * zoom); B = Math.max(B, sy + (y + h) * zoom, sy + (gl.cy + gl.r * 1.5) * zoom);
  }
  if (busy) T = Math.min(T, sy + (cy - 18 * HEIGHT_SCALE) * zoom);
  return {
    box: [L, T, R, B],
    holes: (dx, dy) => {
      const out: Array<{ x: number; y: number; r: number; a: number }> = [];
      for (const l of b.glows) {
        // The rim's runes take the night off in their own shapes alone: a soft round of light about each read as a lit window.
        if (l.kind === 'rim') continue;
        const p = breath(l, t, busy);
        out.push({ x: sx + dx + l.gl.cx * zoom, y: sy + dy + l.gl.cy * zoom, r: l.gl.r * 1.5 * zoom, a: busy ? 0.04 + 0.03 * p : 0.015 + 0.015 * p });
      }
      out.push({ x: sx + dx + cx * zoom, y: sy + dy + cy * zoom, r: dishR * zoom * (busy ? 0.75 : 1), a: busy ? 0.42 + 0.06 * Math.sin(t * 5.7) : 0.03 });
      if (busy) for (const m of motesAt(b, t, zoom)) out.push({ x: sx + dx + m.x * zoom, y: sy + dy + m.y * zoom, r: m.r * 2.2, a: 0.8 * m.a });
      return out;
    },
    masks: (dx, dy) => b.glows.filter((l) => !(busy && l.kind === 'dish')).map((l) => {
      const p = breath(l, t, busy);
      const [x, y, w, h] = l.gl.box;
      return { canvas: l.gl.mask, x: sx + dx + x * zoom, y: sy + dy + y * zoom, w: w * zoom, h: h * zoom, a: l.kind === 'rim' ? (busy ? 0.6 + 0.2 * p : 0.35 + 0.15 * p) : (busy ? 0.42 + 0.1 * p : 0.28 + 0.1 * p) };
    }),
  };
}

/** What the plinth covers from its footprint's middle at zoom one, for the box it is clicked by: left, top, right, bottom. */
export function plinthBounds(view: PlinthView): [number, number, number, number] {
  return bakedFor(view, 0, 1).bounds;
}
