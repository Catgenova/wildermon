import { HEIGHT_SCALE } from './iso';
import { PPM, rand, STAGES, strandPic } from './ivy';
import { star } from './shine';
import {
  add, area2, at, bakeGlow, canvasOf, cushion, cut, drawFaces, drawPads, dot, eyeOfView, glyphPath, groundNear, hex, inset, lichen, mix,
  css, mul, noise2, plate, proj, roundelStrokes, scaleFor, skin, strokesPath, sub, toneOf, unit, boulder,
  type Ctx, type Eye, type Face, type Glow, type NightMask, type Pad, type PaintCtx, type Painter, type Pt, type Thing, type V3,
} from './runestone';

/**
 * The enchanter's plinth: a carved stone table, hip high, where a scroll is
 * put into a thing (`enchant.ts`, `plinth.ts` in the game).
 *
 * Cut by the same hands as the Runestones and built of the same kit
 * (`runestone.ts`): faceted plates in tenths of a metre, chamfered and a
 * little out of true, put on the screen through the piece's turn so it
 * stands right at all eight viewpoints, lit as every piece on the island is,
 * and inked in the stone's warm grey. A coursed step on the ground with
 * fieldstones round its foot; a waisted shaft on it, a carved roundel on its
 * front; and a thick slab across its head, its rim cut all the way round
 * with a band of runes between two rules, its top dressed to a margin and
 * dished in the middle, a star-roundel cut in the floor of the dish.
 *
 * Moss gathers on it as on a statue (`greening.ts`): from the shady side of
 * its step and up the foot of the shaft, along the lee of its top, and ivy
 * up the shaft once it has stood a week.
 *
 * It is baked once for each way it is seen, each scale (`BAKE_STEPS`) and
 * each stage of its moss; a frame is one blit and the runes' light over it
 * (`drawPlinthRunes`): faint at rest, a slow wave of it going round the rim,
 * and bright while somebody enchants at it, the wave quick, the dish full of
 * light, a scroll laid open in it and motes rising off it. After dark the
 * runes take the night back off themselves in their own shapes, kept off
 * whatever stands in front of them, as a runestone's do (`plinthNight`,
 * through `RunestoneNight`).
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
const STONE = toneOf('#e6dac6', '#a2939f');
/** The step a shade warmer and darker, and the fieldstones under it darker still. */
const STEP = toneOf('#dccfba', '#9a8b98');
const FIELD = toneOf('#c9bfae', '#8e8596');
const LICHEN: [string, string] = ['#e9d08a', '#dfe0b4'];

/** Where each part stands: the step's top, the shaft's foot and head, the slab's middle and top. */
const STEP_TOP = 1.5;
const SHAFT_FOOT = 1.4;
const SLAB_MID = 9.85;
const SLAB_HALF = 1.45;
const SLAB_TOP = SLAB_MID + SLAB_HALF;
const SLAB_BEVEL = 0.36;

/** The step, in plan: hand-cut, no two sides alike. */
const STEP_OUTLINE: Pt[] = [[-8.4, -6.2], [-6.6, -7.8], [6.2, -7.6], [8.6, -5.6], [8.3, 6.0], [6.4, 7.7], [-6.0, 7.9], [-8.7, 5.8]];
/** The shaft, across and up: broad at its foot, drawn in at the waist, flaring to its head. */
const SHAFT_OUTLINE: Pt[] = [
  [-4.9, 0], [5.1, 0], [4.7, 1.1], [3.7, 2.5], [3.3, 4.0], [3.5, 5.4], [4.2, 6.4], [4.8, 7.1],
  [-4.7, 7.1], [-4.0, 6.3], [-3.3, 5.3], [-3.1, 3.9], [-3.6, 2.4], [-4.5, 1.0],
];
const SHAFT_TOP = 7.1;
/** The slab across its head, in plan: an octagon cut by eye, the back left corner the longest. */
const SLAB_OUTLINE: Pt[] = [[-9.0, -5.4], [-7.4, -7.6], [-2.0, -7.9], [6.8, -7.5], [9.2, -5.2], [9.0, 5.6], [7.0, 7.7], [-6.6, 7.9], [-8.8, 6.0], [-9.3, 0.4]];
const SLAB_O: V3 = [0.2, 0, SLAB_MID];
/** The dish in its top, in the slab's own plan: its middle and how far it reaches each way. */
const DISH = { x: 0, y: 0.3, rx: 5.0, ry: 4.2 };
/** The runes round the rim: how far apart along it, and how big. */
const RIM_STEP = 2.7;
const RIM_SIZE = 0.78;
const RIM_W = 0.36;
const RIM_GLYPHS = ['algiz', 'sowilo', 'ingwaz', 'tiwaz', 'dagaz', 'othala', 'laguz', 'diamond', 'star6', 'cross', 'tri', 'harrow', 'eye', 'key'];

const norm = (o: Pt[]): Pt[] => (area2(o) < 0 ? o.slice().reverse() : o);

/** A rune on a face of the plinth: where in the face's frame, and what. */
interface RuneAt {
  frame: { o: V3; a: V3; b: V3 };
  n: V3;
  glyph: string;
  x: number;
  z: number;
  s: number;
  /** A carved roundel rather than a rune, and which. */
  roundel?: string;
  /** What it is: one of the band round the rim, the shaft's roundel, or the dish's. */
  kind: 'rim' | 'panel' | 'dish';
  /** How far round the rim it is, nought to one, for the wave of light that goes round. */
  round: number;
}

interface Model {
  things: Thing[];
  runes: RuneAt[];
  /** The top's frame, for the dish and what is laid in it. */
  top: { o: V3; a: V3; b: V3 };
}

/** The moss a stage is worth, nought (bare, the day it is set down) to one. */
const mossK = (stage: number): number => Math.max(0, Math.min(7, stage)) / 7;

/** A point of a face's frame. */
const onFrame = (f: { o: V3; a: V3; b: V3 }, s: number, t: number): V3 => at(f.o, [s, f.a], [t, f.b]);

/** Cushions of moss at points of the model, laid on the screen at zoom one (`drawPads`). */
function padsAt(g: Ctx, k: PaintCtx, pts: Array<[V3, number, number]>): void {
  if (!pts.length) return;
  const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
  const ps: Pad[] = pts.map(([p, r, flat]) => {
    const [x, y] = proj(k.e, p);
    return [x, y, r * across, r * across * flat];
  });
  g.save();
  g.setTransform(k.base);
  drawPads(g, ps);
  g.restore();
}

const models = new Map<number, Model>();

function modelOf(stage: number): Model {
  const had = models.get(stage);
  if (had) return had;
  const m = mossK(stage);
  const things: Thing[] = [];
  const runes: RuneAt[] = [];

  /* -- the step: a coursed slab on the ground, its shady side greening -- */
  const step = norm(STEP_OUTLINE);
  const stepO: V3 = [0, 0, STEP_TOP - 1];
  const stepTop: Painter = (g, k) => {
    const T = rand(4211);
    g.save();
    g.translate(-9, 0);
    skin(g, k.fill, T, 18, 8);
    g.restore();
    // Dressed to a margin, and the joint of its two courses across it.
    cut(g, k.fill, 0.3, () => {
      const ins = inset(step, 1.0);
      g.beginPath();
      ins.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    });
    cut(g, k.fill, 0.28, () => { g.beginPath(); g.moveTo(0.6, -7.4); g.lineTo(0.2, -4.6); g.moveTo(0.4, 4.4); g.lineTo(0.8, 7.5); });
    lichen(g, T, 6.8, 4.6, 0.7, LICHEN);
    // Moss in from its shady side and back, where the step stays damp.
    const pts: Array<[V3, number, number]> = [];
    const M = rand(4219);
    for (let i = 0; i < 160 && m > 0; i++) {
      const x = -8.5 + M() * 17, y = -8 + M() * 16;
      if (!inside(step, x, y) || inside(inset(step, 2.6), x, y) && Math.abs(x) < 6) continue;
      const shade = Math.max(-x / 8.5, -y / 8, 0);
      const nz = noise2(x / 3.5, y / 3.5, 31);
      if (m * (0.4 + 0.9 * shade) + (nz - 0.5) * 1.1 < 0.5) continue;
      pts.push([[x, y, STEP_TOP], cushion(M, m) * 0.55 + 0.2, 0.6]);
    }
    padsAt(g, k, pts);
  };
  const stepEdge = (i: number, up: number): { paint?: Painter } | undefined => {
    if (up > 0.35) return undefined;
    const p = step[i], q = step[(i + 1) % step.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const out: Pt = [(q[1] - p[1]) / len, -(q[0] - p[0]) / len];
    const shade = Math.max(0, -out[0] * 0.8 - out[1] * 0.6);
    return {
      paint: (g, k) => {
        const T = rand(4300 + i);
        skin(g, k.fill, T, len, 1);
        // Where the two courses meet, a joint along it.
        cut(g, k.fill, 0.22, () => { g.beginPath(); g.moveTo(len * 0.47, -0.8); g.lineTo(len * 0.47, 0.8); });
        const pts: Array<[V3, number, number]> = [];
        const a = unit(sub([q[0], q[1], 0], [p[0], p[1], 0]));
        for (let j = 0; j < len * 1.6 && m > 0; j++) {
          const s = T() * len, z = T() * 1.4;
          if (m * (0.5 + shade) * (1 - z / 1.6) + (noise2(s / 2, i, 17) - 0.5) * 0.9 < 0.42) continue;
          pts.push([add(add([p[0], p[1], stepO[2] - 0.7 + z], mul(a, s)), [out[0] * 0.3, out[1] * 0.3, 0]), cushion(T, m) * 0.5 + 0.2, 0.85]);
        }
        padsAt(g, k, pts);
      },
    };
  };
  things.push({ x: 0, y: 0, first: true, faces: plate({ o: stepO, U: [1, 0, 0], W: [0, 1, 0], A: [0, 0, 1], outline: step, half: [1, 1], tTop: 1, bevel: 0.5, tone: STEP, front: stepTop, edge: stepEdge }) });

  /* -- fieldstones the step is bedded on, showing round its foot -- */
  const R = rand(977);
  for (const [x, y, r, h] of [[-8.9, -2.6, 1.9, 0.55], [7.8, -7.6, 1.5, 0.45], [-7.6, 7.9, 1.3, 0.4], [-1.8, -8.9, 1.3, 0.35]] as Array<[number, number, number, number]>) {
    things.push({ x, y, faces: boulder(x, y, r, r * (0.7 + R() * 0.25), h, R() * TAU, 900 + Math.round(x * 7 + y), FIELD, 0) });
  }

  /* -- the shaft: waisted, leaning a hair, a roundel cut on its front -- */
  const shaft = norm(SHAFT_OUTLINE);
  const W: V3 = [0.025, -0.012, 1];
  const half0 = 3.7, half1 = 3.2;
  const f = (half1 - half0) / SHAFT_TOP;
  const O: V3 = [0, -0.4, SHAFT_FOOT];
  const frontFrame = { o: at(O, [half0, [0, 1, 0]]), a: [1, 0, 0] as V3, b: at(W, [f, [0, 1, 0]]) };
  const backFrame = { o: at(O, [-half0, [0, 1, 0]]), a: [-1, 0, 0] as V3, b: at(W, [-f, [0, 1, 0]]) };
  const PANEL = { x: 0, z: 4.0, r: 1.75 };
  runes.push({ frame: frontFrame, n: [0, 1, 0], glyph: '', x: PANEL.x, z: PANEL.z, s: PANEL.r, roundel: 'star', kind: 'panel', round: 0 });
  runes.push({ frame: backFrame, n: [0, -1, 0], glyph: '', x: 0, z: 3.9, s: 1.6, roundel: 'eye', kind: 'panel', round: 0.5 });
  const shaftFace = (which: 'front' | 'back'): { paint: Painter; over?: Painter } => {
    const fr = which === 'front' ? frontFrame : backFrame;
    const paint: Painter = (g, k) => {
      const T = rand(which === 'front' ? 5101 : 5107);
      g.save();
      g.translate(-6, 3.3);
      skin(g, k.fill, T, 12, 3.3);
      g.restore();
      // The damp up out of the step, a band a step darker over its foot.
      g.beginPath();
      g.moveTo(-7, -1);
      for (let x = -7; x <= 7; x += 1) g.lineTo(x, 0.7 + 0.5 * noise2(x / 2.5, 0.5, which === 'front' ? 3 : 4));
      g.lineTo(7, -1);
      g.closePath();
      g.fillStyle = css(mix(k.fill, hex('#7f8486'), 0.35), 0.4);
      g.fill();
      // Dressed in to a margin, the arris left proud.
      const ins = inset(shaft.map(([x, z]) => [which === 'front' ? x : -x, z] as Pt), 0.75);
      cut(g, k.fill, 0.26, () => { g.beginPath(); ins.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath(); });
      // The roundel, a disc sunk into it and the figure cut in that.
      const r = which === 'front' ? PANEL.r : 1.6, z = which === 'front' ? PANEL.z : 3.9;
      g.beginPath();
      g.arc(0, z, r * 0.9, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#a39aac'), 0.38), 0.5);
      g.fill();
      cut(g, k.fill, 0.36, () => strokesPath(g, roundelStrokes(which === 'front' ? 'star' : 'eye'), 0, z, r));
      // Drilled dots either side of it, and a crack in from the edge on the back.
      for (const sx of [-1, 1]) for (const dz of [-0.9, 0, 0.9]) cut(g, k.fill, 0.3, () => { g.beginPath(); g.moveTo(sx * (r + 0.9), z + dz + 0.04); g.lineTo(sx * (r + 0.9), z + dz - 0.04); });
      if (which === 'back') cut(g, k.fill, 0.24, () => { g.beginPath(); g.moveTo(3.9, 4.6); g.lineTo(2.9, 4.2); g.lineTo(2.4, 4.5); g.lineTo(1.6, 3.9); });
      lichen(g, T, which === 'front' ? 3.1 : -2.6, 5.6, 0.6, LICHEN);
      // Moss up its foot, most on its shady left.
      const pts: Array<[V3, number, number]> = [];
      const side = which === 'front' ? -1 : 1;
      for (let i = 0; i < 90 && m > 0; i++) {
        const x = -5.4 + T() * 10.8, z = T() * 3.2;
        const lean = (x * side) / 5.4;
        const share = m * (0.5 + 0.6 * Math.max(0, lean)) * (1 - z / (1.2 + 2.6 * m * Math.max(0.2, lean)));
        if (share * 1.3 + (noise2(x / 1.8, z / 1.8, 23) - 0.5) * 1.1 < 0.55) continue;
        if (Math.hypot(x, z - PANEL.z) < PANEL.r + 0.4) continue;
        pts.push([onFrame(fr, x, z), cushion(T, share) * 0.5 + 0.18, 0.88]);
      }
      padsAt(g, k, pts);
    };
    // Ivy up its shady arris, once it has stood long enough.
    const over: Painter | undefined = which === 'front' && m >= 0.4 ? (g) => {
      const pic = strandPic('climb', 2, Math.max(1, Math.round(STAGES * (m - 0.25) / 0.75)), true);
      if (!pic) return;
      const sc = (0.5 * 10) / PPM;
      g.save();
      g.beginPath();
      g.rect(-6.2, -0.5, 3.6, SHAFT_TOP + 0.3);
      g.clip();
      g.translate(-4.6, 0.2);
      g.scale(sc, -sc);
      g.drawImage(pic.img, -pic.ax, -pic.ay);
      g.restore();
    } : undefined;
    return { paint, over };
  };
  const sf = shaftFace('front'), sb = shaftFace('back');
  const shaftEdge = (i: number): { paint?: Painter } | undefined => {
    const p = shaft[i], q = shaft[(i + 1) % shaft.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return {
      paint: (g, k) => {
        const T = rand(5200 + i);
        skin(g, k.fill, T, len, half0);
        // Moss up the shady side's foot.
        if (m > 0 && p[0] < 0 && Math.min(p[1], q[1]) < 2.6) {
          const tr = g.getTransform(), inv = k.base.inverse();
          const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
          const ps: Pad[] = [];
          for (let j = 0; j < 30; j++) {
            const s = T() * len, y = (T() - 0.5) * 2 * (half0 - 0.6);
            const z = p[1] + ((q[1] - p[1]) * s) / len;
            if (m * (1 - z / (1 + 2.8 * m)) * 1.3 + (noise2(z, y / 2, 41) - 0.5) < 0.5) continue;
            const pt = inv.transformPoint(tr.transformPoint(new DOMPoint(s, y)));
            const r = cushion(T, m) * 0.5 + 0.2;
            ps.push([pt.x, pt.y, r * across, r * across * 0.88]);
          }
          g.save();
          g.setTransform(k.base);
          drawPads(g, ps);
          g.restore();
        }
      },
    };
  };
  things.push({
    x: 0, y: 0,
    faces: plate({ o: O, U: [1, 0, 0], W, A: [0, 1, 0], outline: shaft, half: [half0, half1], tTop: SHAFT_TOP, bevel: 0.7, tone: STONE, front: sf.paint, frontOver: sf.over, back: sb.paint, edge: shaftEdge, sunk: true }),
  });

  /* -- the slab: a band of runes round its rim between two rules, its top dished -- */
  const slab = norm(SLAB_OUTLINE);
  const G = SLAB_HALF - SLAB_BEVEL;
  const per = slab.map((p, i) => Math.hypot(slab[(i + 1) % slab.length][0] - p[0], slab[(i + 1) % slab.length][1] - p[1]));
  const rimLen = per.reduce((a, b) => a + b, 0);
  let along = 0, gi = 0;
  const rimRunes: Array<Array<{ s: number; glyph: string }>> = slab.map((p, i) => {
    const len = per[i];
    const n = Math.max(0, Math.floor((len - 1.4) / RIM_STEP));
    const out: Array<{ s: number; glyph: string }> = [];
    for (let j = 0; j < n; j++) {
      const s = (len * (j + 0.5)) / n;
      out.push({ s, glyph: RIM_GLYPHS[(gi++ * 5) % RIM_GLYPHS.length] });
      const q = slab[(i + 1) % slab.length];
      const a = unit([q[0] - p[0], q[1] - p[1], 0]);
      const o: V3 = [SLAB_O[0] + p[0], SLAB_O[1] + p[1], SLAB_MID];
      runes.push({ frame: { o, a, b: [0, 0, 1] }, n: [a[1], -a[0], 0], glyph: out[out.length - 1].glyph, x: s, z: 0, s: RIM_SIZE, kind: 'rim', round: (along + s) / rimLen });
    }
    along += len;
    return out;
  });
  const slabEdge = (i: number, up: number): { paint?: Painter } | undefined => {
    if (Math.abs(up) > 0.3) return undefined;
    const len = per[i];
    const p = slab[i];
    return {
      paint: (g, k) => {
        const T = rand(6100 + i);
        skin(g, k.fill, T, len, G);
        // The band: two rules along the rim and the runes between them, each cut and lit gold in its groove.
        for (const y of [G - 0.32, -G + 0.32]) cut(g, k.fill, 0.24, () => { g.beginPath(); g.moveTo(0.5, y); g.lineTo(len - 0.5, y); });
        for (const r of rimRunes[i]) cut(g, k.fill, RIM_W, () => glyphPath(g, r.glyph, r.s, 0, RIM_SIZE));
        // A chip out of the arris now and then.
        if (len > 6) {
          const s0 = len * (0.2 + 0.5 * T());
          g.beginPath();
          g.moveTo(s0, G + 0.2); g.lineTo(s0 + 0.9, G - 0.35); g.lineTo(s0 + 1.8, G + 0.2);
          g.fillStyle = css(mix(k.fill, hex('#8e8798'), 0.4), 0.55);
          g.fill();
        }
        // Lichen on the shady rim, and moss along its foot where it weeps.
        if (p[0] < 0 || p[1] < -6) lichen(g, T, len * (0.2 + 0.6 * T()), -G + 0.4, 0.45, LICHEN);
        if (m > 0.3 && (p[0] < -6 || p[1] < -6)) {
          const tr = g.getTransform(), inv = k.base.inverse();
          const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
          const ps: Pad[] = [];
          for (let j = 0; j < len * 1.2; j++) {
            const s = T() * len;
            if ((m - 0.3) * 1.6 + (noise2(s / 2, i, 53) - 0.5) * 1.2 < 0.45) continue;
            const pt = inv.transformPoint(tr.transformPoint(new DOMPoint(s, -G + 0.1 - T() * 0.3)));
            const r = cushion(T, m) * 0.35 + 0.15;
            ps.push([pt.x, pt.y, r * across, r * across * 0.8]);
          }
          g.save();
          g.setTransform(k.base);
          drawPads(g, ps);
          g.restore();
        }
      },
    };
  };
  const top = { o: [SLAB_O[0], SLAB_O[1], SLAB_TOP] as V3, a: [1, 0, 0] as V3, b: [0, 1, 0] as V3 };
  runes.push({ frame: top, n: [0, 0, 1], glyph: '', x: DISH.x, z: DISH.y, s: 2.5, roundel: 'star', kind: 'dish', round: 0 });
  const slabTop: Painter = (g, k) => {
    const T = rand(7001);
    g.save();
    g.translate(-9.5, 0);
    skin(g, k.fill, T, 19, 8);
    g.restore();
    // Dressed to a margin round the top, inside the arris.
    cut(g, k.fill, 0.28, () => {
      const ins = inset(slab, 1.05);
      g.beginPath();
      ins.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    });
    dish(g, k);
    // Lichen out on the margin, and moss in the lee of its back left corner.
    for (const [x, y, r] of [[-7.6, -4.6, 0.7], [7.4, -6.2, 0.55], [-6.9, 6.4, 0.5]] as Array<[number, number, number]>) lichen(g, T, x, y, r, LICHEN);
    const pts: Array<[V3, number, number]> = [];
    for (let i = 0; i < 70 && m > 0.15; i++) {
      const x = -9.3 + T() * 18.5, y = -8 + T() * 16;
      if (!inside(slab, x, y) || inside(inset(slab, 1.6), x, y)) continue;
      const lee = Math.max(0, (-x - y) / 13);
      if ((m - 0.15) * (0.4 + 1.3 * lee) + (noise2(x / 3.5, y / 3.5, 61) - 0.5) * 1.6 < 0.55) continue;
      pts.push([[SLAB_O[0] + x, SLAB_O[1] + y, SLAB_TOP], cushion(T, m) * 0.45 + 0.18, 0.6]);
    }
    padsAt(g, k, pts);
  };
  things.push({ x: 0, y: 0, faces: plate({ o: SLAB_O, U: [1, 0, 0], W: [0, 1, 0], A: [0, 0, 1], outline: slab, half: [SLAB_HALF, SLAB_HALF], tTop: 1, bevel: SLAB_BEVEL, tone: STONE, front: slabTop, edge: slabEdge }) });

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

/** The dish's rim, in the top's plan: an ellipse cut by eye, moved by (dx, dy) and grown by `k`. */
function dishPath(g: Ctx, dx = 0, dy = 0, k = 1): void {
  g.beginPath();
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
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
 * The dish, sunk into the top: its far wall in shade where the light does
 * not reach over the lip, its floor a step paler, the wall on the right lit,
 * all in flat fields; a cut ring round its lip and the star-roundel cut in
 * its floor.
 */
function dish(g: Ctx, k: PaintCtx): void {
  const { right, down } = screenAxes(k.e);
  const fill = k.fill;
  const deep = mix(fill, hex('#5f5876'), 0.58), floor = mix(fill, hex('#958ea2'), 0.36), lit = mix(fill, [255, 250, 238], 0.45);
  cut(g, fill, 0.42, () => dishPath(g, 0, 0, 1.1));
  g.save();
  dishPath(g);
  g.clip();
  g.fillStyle = css(deep);
  g.fillRect(-12, -12, 24, 24);
  dishPath(g, right[0] * 0.7 + down[0] * 0.9, right[1] * 0.7 + down[1] * 0.9, 0.94);
  g.fillStyle = css(floor);
  g.fill();
  // The wall on the right, lit: the dish less itself moved to the left.
  g.beginPath();
  g.rect(-12, -12, 24, 24);
  for (let i = 0; i < 22; i++) {
    const a = (-i / 22) * TAU;
    const w = 1 + 0.035 * Math.sin(a * 3 + 1.1) + 0.02 * Math.cos(a * 5);
    const x = DISH.x - right[0] * 0.75 + Math.cos(a) * DISH.rx * w, y = DISH.y - right[1] * 0.75 + Math.sin(a) * DISH.ry * w;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = css(lit, 0.55);
  g.fill('evenodd');
  cut(g, floor, 0.34, () => strokesPath(g, roundelStrokes('star'), DISH.x, DISH.y, 2.5));
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

function bake(view: PlinthView, stage: number, scale: number): Baked {
  const model = modelOf(stage);
  const e = eyeOfView(view);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of model.things) for (const fc of t.faces ?? []) for (const p of fc.pts) {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
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
    g.ellipse(sx + 3 * across, sy + 1.2 * across, 11 * across, 6.4 * across, 0.1, 0, TAU);
    g.fill();
  }
  const things = model.things.slice().sort((a, b) => (a.first ? -1 : b.first ? 1 : groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y)));
  for (const t of things) if (t.faces) drawFaces(g, e, t.faces as Face[], 1);

  const glows: Lit[] = [];
  for (const r of model.runes) {
    if (dot(r.n, e.toward) <= 1e-6) continue;
    const [ox, oy] = proj(e, r.frame.o), [ax, ay] = proj(e, r.frame.a), [bx, by] = proj(e, r.frame.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    const path = (h: Ctx): void => (r.roundel ? strokesPath(h, roundelStrokes(r.roundel), r.x, r.z, r.s) : glyphPath(h, r.glyph, r.x, r.z, r.s));
    glows.push({ gl: bakeGlow(M, path, r.x, r.z, r.s, !!r.roundel, 0, scale, r.roundel ? 0.34 : RIM_W), kind: r.kind, round: r.round });
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
    const rr = 1.6 + 1.6 * ((i * 0.618) % 1);
    const [x, y] = onTop(b, DISH.x + Math.cos(a0) * rr * (1 - u * 0.4), DISH.y + Math.sin(a0) * rr * 0.8 * (1 - u * 0.4), 0.4 + u * 16);
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
  const hw = 2.5, hh = 1.55;
  const poly = (pts: Pt[]): void => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  poly([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)]);
  ctx.fillStyle = '#f2e6c8';
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
  const [mx, my] = P(1.1, 0.15);
  ctx.save();
  ctx.translate(mx, my);
  ctx.transform(a * zoom, bb * zoom, cc * zoom, d * zoom, 0, 0);
  ctx.transform(c, s, -s, c, 0, 0);
  ctx.lineCap = 'round';
  glyphPath(ctx, 'algiz', 0, 0, 0.9);
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
    const k = 0.32 + 0.3 * night + 0.08 * Math.sin(t * 5.7);
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
  }
  for (const l of b.glows) {
    const gl = l.gl;
    const p = breath(l, t, busy);
    const [x, y, w, h] = gl.box;
    const X = sx + x * zoom, Y = sy + y * zoom, Wd = w * zoom, Ht = h * zoom;
    if (busy && l.kind === 'dish') continue;
    if (day > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = day * (busy ? 0.45 + 0.4 * p : 0.16 + 0.16 * p) * gl.square;
      ctx.drawImage(gl.halo, X, Y, Wd, Ht);
    }
    const round = l.kind !== 'rim';
    if (night > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = night * (busy ? (round ? 0.2 + 0.12 * p : 0.32 + 0.35 * p) : 0.12 + 0.12 * p);
      ctx.drawImage(gl.dusk, X, Y, Wd, Ht);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, busy ? 0.75 + 0.25 * p : 0.48 + 0.12 * night + 0.2 * p);
    ctx.drawImage(gl.core, X, Y, Wd, Ht);
    if (busy && !round) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.12 + 0.22 * night) * p;
      ctx.drawImage(gl.core, X, Y, Wd, Ht);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (busy) {
    drawScroll(ctx, b, sx, sy, zoom, t);
    for (const m of motesAt(b, t, zoom)) {
      const px = sx + m.x * zoom, py = sy + m.y * zoom;
      const a = m.a * (0.45 + 0.55 * night);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.3;
      ctx.fillStyle = 'rgb(255, 196, 110)';
      ctx.beginPath();
      ctx.arc(px, py, m.r * 1.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgb(255, 238, 190)';
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
        const p = breath(l, t, busy);
        out.push({ x: sx + dx + l.gl.cx * zoom, y: sy + dy + l.gl.cy * zoom, r: l.gl.r * 1.5 * zoom, a: busy ? 0.04 + 0.03 * p : 0.015 + 0.015 * p });
      }
      out.push({ x: sx + dx + cx * zoom, y: sy + dy + cy * zoom, r: dishR * zoom, a: busy ? 0.18 + 0.05 * Math.sin(t * 5.7) : 0.04 });
      if (busy) for (const m of motesAt(b, t, zoom)) out.push({ x: sx + dx + m.x * zoom, y: sy + dy + m.y * zoom, r: m.r * 2.2, a: 0.8 * m.a });
      return out;
    },
    masks: (dx, dy) => b.glows.filter((l) => !(busy && l.kind === 'dish')).map((l) => {
      const p = breath(l, t, busy);
      const [x, y, w, h] = l.gl.box;
      return { canvas: l.gl.mask, x: sx + dx + x * zoom, y: sy + dy + y * zoom, w: w * zoom, h: h * zoom, a: l.kind === 'rim' ? (busy ? 0.82 + 0.18 * p : 0.4 + 0.2 * p) : (busy ? 0.42 + 0.1 * p : 0.28 + 0.1 * p) };
    }),
  };
}

/** What the plinth covers from its footprint's middle at zoom one, for the box it is clicked by: left, top, right, bottom. */
export function plinthBounds(view: PlinthView): [number, number, number, number] {
  return bakedFor(view, 0, 1).bounds;
}
