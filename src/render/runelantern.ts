import type { Side } from '../game/building';
import { hashOf, rand, STAGES, strandPic, PPM } from './ivy';
import { star } from './shine';
import {
  add, at, bakeGlow, boulder, canvasOf, cut, dot, drawFaces, drawGlows, drawPads, flowerClump, glowHoles, glowMasks,
  glyphPath, grassTuft, groundNear, hex, lichen, mix, mul, newell, noise2, plate, proj, scaleFor, strokesPath, roundelStrokes, eyeOf, css,
  type Ctx, type Eye, type Face, type Glow, type GlowSpec, type NightHole, type NightMask, type NightSource, type Pad, type PaintCtx, type Painter, type Pt, type Thing, type Tone, type V3,
  toneOf, TAU,
} from './runestone';

/**
 * A rune lantern post (`game/runelantern.ts`), drawn as the runestones are
 * (`runestone.ts`), from their kit: a small model of faceted solids in tenths
 * of a metre, put on the screen through the camera's turn, baked for each way
 * it is seen and each scale, and the runes' light laid over the bake.
 *
 * A squat pillar a little over chest high on a low mossy outcrop: a tapered
 * shaft with a sun cut in its front, a band of runes round its head set a
 * step in under a broad capstone, and a small pointed head over that with a
 * star cut in it, the runestones' head in little. The runes go round all
 * four faces of the band and breathe one after another round it, and light
 * motes rise off them. It stands an eighth of a half turn off square to the
 * way it faces, as the runestones do, so it is never seen flat on.
 *
 * Moss gathers on it as on any stone set down out of doors (`greening.ts`):
 * its outcrop, the foot of its shaft on the side away from the sun, the
 * ledge round the band, the tops of its cap and head, and ivy up its shady
 * corner, all by the stage the moss has reached. Grass and a few flowers
 * grow round its foot from the first day.
 *
 * After dark the runes take the night off themselves in their own shapes and
 * light the stone round the band (`runeLanternNight`, laid by the
 * runestones' `RunestoneNight`, which keeps it off whatever stands in front),
 * and the light it throws on the ground is the game's (`runeLanternLight`).
 */

/** How far off square to the way it faces it stands: an eighth of a half turn, as the runestones are turned. */
const ASKEW = Math.PI / 8;
/** The way a piece facing each side has its front turned, as a heading is (`eyeOf`): nought faces south. */
const YAW: Record<Side, number> = { s: 0, e: -Math.PI / 2, n: Math.PI, w: Math.PI / 2 };

/** How many ways one may be cut, so a street of them is not one stone over and over: by where it stands. */
export const RUNE_LANTERN_VARIANTS = 3;

/* ---- the stone ----------------------------------------------------------------- */

/** The pillar's stone, warm and pale, the shade a cool lilac grey; the band a step cooler, as stone set back out of the sun is; the outcrop a step darker. */
const STONE: Tone = toneOf('#f1e5cf', '#a8969d');
const BAND: Tone = toneOf('#ddd2c2', '#9a8fa0');
const ROCK: Tone = toneOf('#ddd2c0', '#a89ba5');
const LICHEN: [string, string] = ['#e9d48c', '#dcdfb2'];

/** Where the solids stand, up from the ground, in units: the outcrop's top, then the shaft, the band, the cap and the head. */
const OUTCROP_H = 1.7;
const FOOT = 1.0;
const SHAFT_H = 4.0;
const BAND_H = 2.8;
const CAP_H = 1.45;
const HEAD_H = 2.4;
/** How far the shaft leans, across and toward its front, per unit up: a hair, so it is not set out with a rule. */
const LEAN: [number, number] = [0.018, -0.012];

/** The runes round the band: the sun-stave and stars, two to a face, in order round it. */
const BAND_RUNES = ['sowilo', 'sunDot', 'star6', 'algiz', 'diamondDot', 'ingwaz', 'tiwaz', 'star8'];
/** How big a rune on the band is, in units from its middle to its top, and how wide its groove. */
const RUNE_S = 1.0;
const RUNE_W = 0.42;
/** The least a rune's lit groove is across at a scale, as units times the scale: about a pixel and a quarter on the screen. */
const RUNE_PX = 1.1;
/** Where across a face of the band its two runes stand, from the middle, and how high, up the band. */
const RUNE_X = 1.3;
const RUNE_Z = 1.4;

interface Model {
  things: Thing[];
  /** The pillar's own solids, without the outcrop or anything round it: what it is picked by. */
  pillar: Face[];
  /** The band's four faces as frames runes are laid in: across each as the eye sees it, and up it. */
  band: Array<{ o: V3; a: V3; b: V3; n: V3; runes: GlowSpec[] }>;
  /** The middle of the band, and the top of the head: where the motes rise from and to. */
  glowAt: V3;
  top: number;
  turf: Pt[];
}

/** One solid's frame: where its outline's (0, 0) is, and the ways its outline and its thickness run. */
interface Frame {
  o: V3;
  U: V3;
  W: V3;
  A: V3;
}
/** A point (s, t) of a solid's outline, `y` through its thickness. */
const P = (f: Frame, s: number, t: number, y = 0): V3 => at(f.o, [s, f.U], [t, f.W], [y, f.A]);

/**
 * How shady a face of it turned along (nx, ny) in its own frame is, nought
 * to one, against the sun in the south-east, which is the island's
 * (`mossOf` in `furniture.ts`): the frame's own ways turned into the world.
 */
function shadeOf(yaw: number, nx: number, ny: number): number {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = nx * c - ny * s, wy = nx * s + ny * c;
  return 0.5 - 0.5 * (wx + wy) * Math.SQRT1_2;
}

const models = new Map<string, Model>();

/**
 * The model for a pillar facing `yaw` (its moss lies by the sun, which does
 * not turn with it), its moss at `moss` of the way on, nought to one, and cut
 * the `variant`th way.
 */
function modelOf(yaw: number, moss: number, variant: number): Model {
  const key = `${yaw.toFixed(3)}|${moss.toFixed(3)}|${variant}`;
  const had = models.get(key);
  if (had) return had;
  const seed = 401 + variant * 97;
  const R = rand(seed);
  const things: Thing[] = [];
  const m = moss;
  // Which way across it is shady, in its own frame: its left (-1) or its right (1).
  const shadySide = shadeOf(yaw, 1, 0) >= shadeOf(yaw, -1, 0) ? 1 : -1;
  const shadyFront = shadeOf(yaw, 0, 1) >= shadeOf(yaw, 0, -1) ? 1 : -1;
  const W: V3 = [LEAN[0], LEAN[1], 1];
  const U: V3 = [1, 0, 0];
  const A: V3 = [0, 1, 0];

  /* -- moss on an upright face: cushions up from its foot, more and higher the shadier the face -- */
  const footMoss = (g: Ctx, k: PaintCtx, x0: number, x1: number, shade: number, salt: number, rise = 1.1): void => {
    const amount = m * (0.15 + 0.95 * shade);
    if (amount <= 0.08) return;
    const T = rand(seed * 13 + salt);
    const tr = g.getTransform(), inv = k.base.inverse();
    const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
    const ps: Pad[] = [];
    // One mass up from the foot, its top lobed where the noise has it, cushions close enough to run together.
    const top = (x: number): number => (0.3 + rise * amount) * (0.4 + 0.8 * noise2(x / 1.2, 0.5, seed + salt));
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.8 + 0.35 * T()) {
      const h = top(x);
      for (let z = 0.15 + 0.25 * T(); z < h; z += 0.85 + 0.3 * T()) {
        const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x + (T() - 0.5) * 0.4, z)));
        const r = (0.62 + 0.5 * T() * T()) * (0.75 + 0.35 * (1 - z / Math.max(0.4, h)));
        ps.push([q.x, q.y, r * across, r * across * 0.9]);
      }
    }
    g.save();
    g.setTransform(k.base);
    drawPads(g, ps);
    g.restore();
  };

  /* -- moss over a top, as far in from its shady edge as it has got -- */
  const topMoss = (g: Ctx, k: PaintCtx, len: number, half: number, shade: number, salt: number): void => {
    const amount = m * (0.3 + 0.9 * shade);
    if (amount <= 0.04) return;
    const T = rand(seed * 17 + salt);
    const tr = g.getTransform(), inv = k.base.inverse();
    const across = Math.hypot(k.e.ux, k.e.uy);
    const ps: Pad[] = [];
    for (let i = 0, n = Math.round(len * half * 2.2); i < n; i++) {
      const s = T() * len, y = -half + 0.2 + T() * (2 * half - 0.4);
      const nz = noise2(s / 1.5, y / 1.5, seed + salt * 3);
      if (amount * 1.25 + (nz - 0.5) * 1.3 < 0.62) continue;
      const q = inv.transformPoint(tr.transformPoint(new DOMPoint(s, y)));
      const r = 0.3 + 0.45 * T() * T();
      ps.push([q.x, q.y, r * across, r * across * 0.6]);
    }
    g.save();
    g.setTransform(k.base);
    drawPads(g, ps);
    g.restore();
  };

  /*
   * The stone's skin on a face `x0` to `x1` across and `h` up: flat patches
   * a step paler and a step greyer, grit thicker toward the foot, a few pits
   * with a lit lip, a hairline or two, and the damp up out of the ground at
   * the foot of the shaft -- the runestones' skin at this size.
   */
  const skin = (g: Ctx, fill: [number, number, number], x0: number, x1: number, h: number, salt: number, damp: boolean): void => {
    const T = rand(seed * 31 + salt);
    for (let i = 0; i < Math.round((x1 - x0) * h * 0.35) + 3; i++) {
      const x = x0 + T() * (x1 - x0), z = T() * h;
      g.beginPath();
      g.ellipse(x, z, 0.5 + T() * 1.5, 0.3 + T() * 0.9, (T() - 0.5) * 0.8, 0, TAU);
      g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.42) : css(mix(fill, hex('#9c94a4'), 0.32), 0.3);
      g.fill();
    }
    if (damp) {
      g.beginPath();
      g.moveTo(x0 - 1, -1);
      for (let x = x0 - 1; x <= x1 + 1; x += 0.6) g.lineTo(x, 0.9 + 0.9 * noise2(x / 1.8, 0.5, seed + salt));
      g.lineTo(x1 + 1, -1);
      g.closePath();
      g.fillStyle = css(mix(fill, hex('#7f8486'), 0.35), 0.42);
      g.fill();
    }
    g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.35);
    for (let i = 0; i < Math.round((x1 - x0) * h * 0.9); i++) {
      const z = Math.pow(T(), 1.6) * h, x = x0 + T() * (x1 - x0);
      g.fillRect(x, z, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
    }
    for (let i = 0; i < 3; i++) {
      const x = x0 + 0.5 + T() * (x1 - x0 - 1), z = 0.4 + T() * (h - 0.8), r = 0.1 + T() * 0.14;
      g.beginPath();
      g.ellipse(x, z, r * 1.3, r, 0, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#5d5464'), 0.4), 0.55);
      g.fill();
      g.beginPath();
      g.ellipse(x + r * 0.35, z - r * 0.45, r * 1.1, r * 0.5, 0, 0, TAU);
      g.fillStyle = css(mix(fill, [255, 252, 244], 0.6), 0.6);
      g.fill();
    }
  };

  /*
   * The band's runes: two to a face, cut, with a rule cut along the band
   * under them and over them, each rune's light baked later from the same
   * place (`band`). In order round it -- front, right, back, left as each is
   * seen from in front of it -- so their breath runs round it.
   */
  const bandRunes = (face: number): GlowSpec[] => [-RUNE_X, RUNE_X].map((x, j) => ({
    glyph: BAND_RUNES[(face * 2 + j + variant * 3) % BAND_RUNES.length], x, z: RUNE_Z, s: RUNE_S, i: face * 2 + j, w: RUNE_W,
  }));
  const carveBand = (g: Ctx, fill: [number, number, number], half: number, runes: GlowSpec[], salt: number): void => {
    skin(g, fill, -half, half, BAND_H, salt, false);
    // The two rules along it, a hair off level, cut by hand.
    const T = rand(seed * 7 + salt);
    for (const z of [0.22, BAND_H - 0.24]) {
      const d = (T() - 0.5) * 0.12;
      cut(g, fill, 0.2, () => { g.beginPath(); g.moveTo(-half + 0.15, z - d); g.lineTo(half - 0.15, z + d); });
    }
    // A drilled dot between the two runes.
    cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(0, RUNE_Z + 0.03); g.lineTo(0, RUNE_Z - 0.03); });
    for (const r of runes) cut(g, fill, RUNE_W, () => glyphPath(g, r.glyph, r.x, r.z, r.s));
  };

  /* -- the outcrop it stands on, and rocks hugging its foot -- */
  things.push({ x: 0, y: 0, first: true, faces: boulder(0, 0, 5.6, 5.1, OUTCROP_H, R() * TAU, seed * 3 + 1, ROCK, m * 0.9) });
  for (let i = 0; i < 3; i++) {
    const a = ((i + 0.3 + R() * 0.4) / 3) * TAU, d = 5 + R() * 1.2;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const r = 1.1 + R() * 0.8;
    const sh = shadeOf(yaw, Math.cos(a), Math.sin(a));
    things.push({ x, y, faces: boulder(x, y, r, r * (0.7 + R() * 0.3), 0.9 + R() * 0.8, R() * TAU, seed * 17 + i, ROCK, m * (0.1 + 0.35 * sh)) });
  }

  /* -- the shaft: a tapered block, a hair askew, a sun cut in its front -- */
  const shaftF: Frame = { o: [0, 0, FOOT], U, W, A };
  /** A frame on top of another at (s, t) of its outline, turned `d` about the upright from it and leaning `lean` more: no course laid square on the last. */
  const onTop = (f: Frame, s: number, t: number, d: number, lean: [number, number] = [0, 0]): Frame => {
    const c = Math.cos(d), n = Math.sin(d);
    return { o: P(f, s, t), U: [c, n, 0], W: [LEAN[0] + lean[0], LEAN[1] + lean[1], 1], A: [-n, c, 0] };
  };
  const shaftOutline: Pt[] = [[-3.45, 0], [3.4, 0], [3.18, SHAFT_H], [-3.24, SHAFT_H - 0.04]];
  const shaftHalf: [number, number] = [3.15, 2.95];
  const sun = R() < 0.5 ? 'sun' : 'star8';
  const shaftFace = (front: boolean): Painter => (g, k) => {
    const fill = k.fill;
    skin(g, fill, -3.5, 3.5, SHAFT_H, front ? 1 : 2, true);
    // A margin drafted round it, a finger in from its edges, as dressed stone is.
    cut(g, fill, 0.16, () => {
      g.beginPath();
      g.moveTo(-2.75, 0.9); g.lineTo(-2.62, SHAFT_H - 0.5); g.lineTo(2.58, SHAFT_H - 0.48); g.lineTo(2.7, 0.9);
    });
    if (front) {
      // The sun the light is from, in a roundel sunk a step into the face.
      g.beginPath();
      g.arc(0, 2.2, 1.18, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#a39aac'), 0.38), 0.5);
      g.fill();
      cut(g, fill, 0.27, () => strokesPath(g, roundelStrokes(sun), 0, 2.2, 1.34));
    } else {
      // A crack in from an edge on the back, and its lit lip.
      const T = rand(seed * 5 + 3);
      let x = -3.2, z = 1.8 + T() * 1.5, a = -0.2;
      const pts: Pt[] = [[x, z]];
      for (let i = 0; i < 5; i++) { a += (T() - 0.5) * 0.9; x += Math.cos(a) * 0.55; z += Math.sin(a) * 0.55; pts.push([x, z]); }
      cut(g, fill, 0.16, () => { g.beginPath(); pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz))); });
    }
    const T = rand(seed * 11 + (front ? 1 : 2));
    for (let i = 0; i < 3; i++) lichen(g, T, (T() - 0.5) * 5, 1.4 + T() * 3, 0.32 + T() * 0.3, LICHEN);
    footMoss(g, k, -3.5, 3.5, shadeOf(yaw, 0, front ? 1 : -1), front ? 1 : 2);
  };
  // A face of a solid along its outline's edge from p to q, seen side on: its own frame, across it as the eye in front of it sees it, and up it.
  const sideFrame = (f: Frame, p: Pt, q: Pt): { o: V3; a: V3; b: V3; right: boolean } => {
    const [lo, hi] = p[1] <= q[1] ? [p, q] : [q, p];
    const right = lo[0] + hi[0] > 0;
    return { o: P(f, lo[0], lo[1]), a: right ? mul(f.A, -1) : f.A, b: at(f.W, [(hi[0] - lo[0]) / Math.max(1e-6, hi[1] - lo[1]), f.U]), right };
  };
  const inFrame = (g: Ctx, k: PaintCtx, fr: { o: V3; a: V3; b: V3 }): void => {
    const [ox, oy] = proj(k.e, fr.o), [ax, ay] = proj(k.e, fr.a), [bx, by] = proj(k.e, fr.b);
    g.setTransform(k.base);
    g.transform(ax, ay, bx, by, ox, oy);
  };
  const shaftEdge = (outline: Pt[], f: Frame, half: number, h: number, salt: number, ledge: boolean) => (i: number, up: number): { paint?: Painter } | undefined => {
    const p = outline[i], q = outline[(i + 1) % outline.length];
    if (up > 0.35) {
      // A top: moss over it, the ledge round the band only out past the band.
      return {
        paint: (g, k) => {
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (!ledge) topMoss(g, k, len, half, 0.5 + 0.5 * shadeOf(yaw, 0, 0), salt);
          else {
            // Round the band's foot: the strips of the ledge either side of it, front and back.
            const T = rand(seed * 19 + salt);
            const tr = g.getTransform(), inv = k.base.inverse(), across = Math.hypot(k.e.ux, k.e.uy);
            const ps: Pad[] = [];
            for (let j = 0; j < 40; j++) {
              const s = T() * len, y = (T() < 0.5 ? -1 : 1) * (2.45 + T() * (half - 2.45));
              const sh = shadeOf(yaw, 0, Math.sign(y));
              if (T() > m * (0.2 + 0.9 * sh)) continue;
              const qq = inv.transformPoint(tr.transformPoint(new DOMPoint(s, y)));
              const r = 0.28 + 0.3 * T();
              ps.push([qq.x, qq.y, r * across, r * across * 0.6]);
            }
            g.save();
            g.setTransform(k.base);
            drawPads(g, ps);
            g.restore();
          }
        },
      };
    }
    if (Math.abs(up) > 0.35) return undefined;
    const fr = sideFrame(f, p, q);
    return {
      paint: (g, k) => {
        inFrame(g, k, fr);
        skin(g, k.fill, -half - 0.5, half + 0.5, h, salt + (fr.right ? 5 : 6), ledge);
        if (ledge) footMoss(g, k, -half - 0.5, half + 0.5, shadeOf(yaw, fr.right ? 1 : -1, 0), salt + (fr.right ? 5 : 6));
      },
    };
  };
  const shaft = plate({
    ...shaftF, outline: shaftOutline, half: shaftHalf, tTop: SHAFT_H, bevel: 0.55, tone: STONE,
    front: shaftFace(true), back: shaftFace(false), edge: shaftEdge(shaftOutline, shaftF, 3.05, SHAFT_H, 10, true), sunk: true,
  });
  things.push({ x: 0, y: 0, faces: shaft });

  /* -- the band: set a step in, its runes round all four faces -- */
  const bandF: Frame = onTop(shaftF, 0.05, SHAFT_H, 0.045 * (variant - 1) + 0.035);
  const bandHalfX = 2.72, bandHalfY = 2.55;
  const bandOutline: Pt[] = [[-bandHalfX, 0], [bandHalfX, 0], [bandHalfX - 0.04, BAND_H], [-bandHalfX + 0.02, BAND_H]];
  const runesOf = [bandRunes(0), bandRunes(1), bandRunes(2), bandRunes(3)];
  const bandEdge = (i: number, up: number): { paint?: Painter } | undefined => {
    if (Math.abs(up) > 0.35) return undefined;
    const p = bandOutline[i], q = bandOutline[(i + 1) % bandOutline.length];
    const fr = sideFrame(bandF, p, q);
    return { paint: (g, k) => { inFrame(g, k, fr); carveBand(g, k.fill, bandHalfY, runesOf[fr.right ? 1 : 3], fr.right ? 21 : 23); } };
  };
  const band = plate({
    ...bandF, outline: bandOutline, half: [bandHalfY, bandHalfY], tTop: BAND_H, bevel: 0.3, tone: BAND,
    front: (g, k) => carveBand(g, k.fill, bandHalfX, runesOf[0], 20), back: (g, k) => carveBand(g, k.fill, bandHalfX, runesOf[2], 22), edge: bandEdge, sunk: true,
  });
  things.push({ x: 0, y: 0, faces: band });

  /* -- the cap: broad, overhanging the band, its top drawn in to a ridge of the head -- */
  const capF: Frame = onTop(bandF, -0.05, BAND_H, -0.07, [0.035, -0.02]);
  const capOutline: Pt[] = [[-3.95, 0], [4.0, 0], [4.1, 0.6], [3.72, 1.02], [3.2, 0.98], [3.02, CAP_H], [-3.38, CAP_H - 0.06], [-4.04, 0.68]];
  const cap = plate({
    ...capF, outline: capOutline, half: [3.75, 2.95], tTop: CAP_H, bevel: 0.45, tone: STONE,
    front: (g, k) => { skin(g, k.fill, -4.2, 4.2, CAP_H, 30, false); const T = rand(seed + 31); lichen(g, T, (T() - 0.5) * 5, 0.8, 0.35, LICHEN); },
    back: (g, k) => skin(g, k.fill, -4.2, 4.2, CAP_H, 31, false),
    edge: (i, up) => {
      const p = capOutline[i], q = capOutline[(i + 1) % capOutline.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (up > 0.35) return { paint: (g, k) => topMoss(g, k, len, 3.2, 0.4 + 0.6 * shadeOf(yaw, 0, 0), 32 + i) };
      if (up > 0.1) return { paint: (g, k) => topMoss(g, k, len, 3.4, 0.2 + 0.8 * shadeOf(yaw, Math.sign(p[0] + q[0]), 0), 40 + i) };
      return undefined;
    },
    sunk: true,
  });
  things.push({ x: 0, y: 0, faces: cap });

  /* -- the head: a little pointed stone, the runestones' head in small, a star cut in its front -- */
  const headF: Frame = onTop(capF, -0.15, CAP_H - 0.25, 0.11 - 0.06 * variant, [-0.03, 0.02]);
  const headOutline: Pt[] = [[-2.0, 0], [1.95, 0], [1.9, 0.85], [1.4, 1.7], [0.5, HEAD_H], [-0.35, HEAD_H - 0.05], [-1.35, 1.78], [-1.95, 0.9]];
  const head = plate({
    ...headF, outline: headOutline, half: [1.75, 1.2], tTop: HEAD_H, bevel: 0.4, tone: STONE,
    front: (g, k) => {
      skin(g, k.fill, -2.2, 2.2, HEAD_H, 50, false);
      cut(g, k.fill, 0.17, () => glyphPath(g, 'star8', 0, 1.1, 0.6));
    },
    back: (g, k) => skin(g, k.fill, -2.2, 2.2, HEAD_H, 51, false),
    edge: (i, up) => {
      if (up < 0.2) return undefined;
      const p = headOutline[i], q = headOutline[(i + 1) % headOutline.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return { paint: (g, k) => topMoss(g, k, len, 1.3, 0.3 + 0.7 * shadeOf(yaw, Math.sign(p[0] + q[0] + 1e-6), 0), 60 + i) };
    },
    sunk: true,
  });
  things.push({ x: 0, y: 0, faces: head });

  /* -- ivy up its shady corner, as far as the moss has got -- */
  const ivyStage = Math.round(m * STAGES * 0.9);
  if (ivyStage > 0) {
    const pic = strandPic('climb', 1 + variant, ivyStage, true);
    if (pic) {
      // Up the side of the shaft away from the sun, by its shadier corner, leaves let run over its edge.
      const sc = (0.3 * 10) / PPM;
      const root: V3 = add(shaftF.o, [shadySide * 3.42, shadyFront * 1.7, 0.3]);
      const across: V3 = shadySide > 0 ? mul(A, -1) : A;
      const n: V3 = [shadySide, 0, 0];
      things.push({
        x: shadySide * 3.6, y: shadyFront * 1.7,
        draw: (g, e) => {
          if (dot(n, e.toward) <= 0) return;
          const [ox, oy] = proj(e, root), [ax, ay] = proj(e, across), [bx, by] = proj(e, [0, 0, 1]);
          g.save();
          g.transform(ax, ay, bx, by, ox, oy);
          g.scale(shadyFront * (shadySide > 0 ? -1 : 1) * sc, -sc);
          g.drawImage(pic.img, -pic.ax, -pic.ay);
          g.restore();
        },
        reach: [add(root, [0, 0, 7])],
      });
    }
  }

  /* -- grass and a few flowers round its foot, from the first day -- */
  const colours = ['white', 'yellow', 'white', 'pink', 'lilac'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R() * 0.5, d = 5.2 + R() * 2.6;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const s0 = seed * 77 + i;
    const flower = i % 3 === 1;
    const colour = colours[Math.floor(R() * colours.length)];
    things.push({
      x, y, reach: [[x, y, 4]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0.2]);
        if (flower) flowerClump(g, px, py, colour, s0, 0.42);
        else grassTuft(g, px, py, s0, 0.55);
      },
    });
  }

  /* -- the band's faces, as runes are laid in them: front, right, back, left -- */
  const fFront = { o: P(bandF, 0, 0, bandHalfY), a: bandF.U, b: bandF.W };
  const fBack = { o: P(bandF, 0, 0, -bandHalfY), a: mul(bandF.U, -1), b: bandF.W };
  const fRight = sideFrame(bandF, bandOutline[1], bandOutline[2]);
  const fLeft = sideFrame(bandF, bandOutline[3], bandOutline[0]);
  const bandFaces = [fFront, fRight, fBack, fLeft].map((fr, j) => {
    let n = newell([fr.o, add(fr.o, fr.a), add(add(fr.o, fr.a), fr.b)]);
    const out: V3 = j === 0 ? bandF.A : j === 2 ? mul(bandF.A, -1) : j === 1 ? bandF.U : mul(bandF.U, -1);
    if (dot(n, out) < 0) n = mul(n, -1);
    return { o: fr.o, a: fr.a, b: fr.b, n, runes: runesOf[j] };
  });

  const turf: Pt[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU, r = 7.4 + R() * 1.4;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.92] as Pt;
  });
  const model: Model = {
    things, pillar: [...shaft, ...band, ...cap, ...head], band: bandFaces,
    glowAt: P(bandF, 0, BAND_H / 2), top: P(headF, 0, HEAD_H)[2], turf,
  };
  models.set(key, model);
  return model;
}

/* ---- baking ------------------------------------------------------------------- */

/** How square on the eye must see a face of the band, as the cosine of the angle off it, for its runes' light to be laid. */
const GLOW_SEEN = 0.3;

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What it covers from its footprint's middle, in pixels at zoom one: left, top, right, bottom. */
  bounds: [number, number, number, number];
  /** And what of that is the pillar, which it is clicked by. */
  hit: [number, number, number, number];
  glows: Glow[];
  /** The middle of the band and the top of the head, on the screen at zoom one from the footprint's middle, for the motes. */
  glowAt: Pt;
  topAt: Pt;
}

const BAKED_BUDGET = 8e6;
const baked = new Map<string, Baked>();
let bakedArea = 0;

function measure(model: Model, e: Eye): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (p: V3): void => {
    const [x, y] = proj(e, p);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const t of model.things) {
    for (const f of t.faces ?? []) for (const p of f.pts) take(p);
    for (const p of t.reach ?? []) take(p);
  }
  for (const [x, y] of model.turf) take([x, y, 0]);
  const pad = 6;
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function bake(facing: Side, rotation: number, moss: number, variant: number, scale: number): Baked {
  const yaw = YAW[facing] + ASKEW;
  const model = modelOf(yaw, moss, variant);
  const e = eyeOf(yaw, rotation);
  const [x0, y0, x1, y1] = measure(model, e);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  g.setTransform(new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]));

  /* -- the turf round its foot, a flat field ragged at its edge, and its shade thrown away from the light -- */
  g.beginPath();
  model.turf.forEach(([x, y], i) => {
    const [px, py] = proj(e, [x * 0.85, y * 0.85, 0]);
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  });
  g.closePath();
  g.fillStyle = 'rgba(118, 156, 122, 0.36)';
  g.fill();
  {
    const F = rand(variant * 991 + 7);
    const across = Math.hypot(e.ux, e.uy);
    for (let i = 0; i < 26; i++) {
      const q = model.turf[Math.floor(F() * model.turf.length)];
      const k = 0.8 + F() * 0.3;
      const [px, py] = proj(e, [q[0] * k, q[1] * k, 0]);
      const r = (0.6 + F() * 1.1) * across;
      g.fillStyle = `rgba(118, 156, 122, ${(0.36 * (1.1 - k) * 2).toFixed(3)})`;
      g.beginPath();
      g.ellipse(px, py, r, r * 0.5, 0, 0, TAU);
      g.fill();
    }
  }
  {
    const [sx, sy] = proj(e, [0, 0, 0]);
    g.fillStyle = 'rgba(44, 74, 78, 0.17)';
    g.beginPath();
    g.ellipse(sx + 5, sy + 2.2, 12, 4.6, 0.12, 0, TAU);
    g.fill();
  }

  /* -- everything standing, in order: the outcrop first, then the rest by where it stands -- */
  const things = model.things.slice().sort((a, b) => (a.first ? -1 : b.first ? 1 : groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y)));
  for (const t of things) {
    if (t.draw) t.draw(g, e);
    else if (t.faces) drawFaces(g, e, t.faces, 1.15);
  }

  /* -- each rune's light, on the faces of the band the eye sees -- */
  const glows: Glow[] = [];
  for (const f of model.band) {
    // Not on a face seen all but edge on, where a rune's light would be a smear along the band's corner.
    if (dot(f.n, e.toward) / Math.hypot(...e.toward) < GLOW_SEEN) continue;
    const [ox, oy] = proj(e, f.o), [ax, ay] = proj(e, f.a), [bx, by] = proj(e, f.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    // A groove no thinner on the screen than `RUNE_PX` over the scale it is baked at, so at a small zoom a rune is still a stroke of light and not a hair.
    for (const r of f.runes) glows.push(bakeGlow(M, { ...r, w: Math.max(r.w ?? RUNE_W, RUNE_PX / scale) }, scale));
  }
  let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
  for (const f of model.pillar) for (const p of f.pts) {
    const [x, y] = proj(e, p);
    hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y);
  }
  return {
    canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hit: [Math.floor(hx0 - 2), Math.floor(hy0 - 2), Math.ceil(hx1 + 2), Math.ceil(hy1 + 1)],
    glows, glowAt: proj(e, model.glowAt), topAt: proj(e, [0, 0, model.top]),
  };
}

/** The moss a piece's stage (nought to `PIECE_STAGES`) is, nought to one, in the steps it is baked at. */
const mossOf = (stage: number, stages: number): number => Math.max(0, Math.min(1, Math.round(stage) / Math.max(1, stages)));

function bakedFor(facing: Side, rotation: number, moss: number, variant: number, zoom: number): Baked {
  const scale = scaleFor(zoom);
  const key = `${facing}|${((rotation % 8) + 8) % 8}|${moss.toFixed(3)}|${variant}|${scale}`;
  let b = baked.get(key);
  if (b) {
    baked.delete(key);
    baked.set(key, b);
    return b;
  }
  b = bake(facing, ((rotation % 8) + 8) % 8, moss, variant, scale);
  baked.set(key, b);
  bakedArea += b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= old.canvas.width * old.canvas.height;
  }
  return b;
}

/** How it is drawn: which way it faces, the moss on it (its stage of `stages`), and which of its cuts it is. */
export interface RuneLanternLook {
  facing: Side;
  stage: number;
  stages: number;
  variant: number;
}

/* ---- the motes ---------------------------------------------------------------------- */

/** How far the band's bloom reaches after dark, in pixels at zoom one. */
const BLOOM = 18;

/** Light motes rising off the band past the head, fading as they go: how many, and the seconds each takes. */
const MOTES = 3;
const MOTE_RISE = 5.2;

function motesAt(b: Baked, t: number, zoom: number): Array<{ x: number; y: number; a: number; r: number }> {
  const out: Array<{ x: number; y: number; a: number; r: number }> = [];
  const [gx, gy] = b.glowAt, [, ty] = b.topAt;
  const rise = gy - ty + 8;
  for (let i = 0; i < MOTES; i++) {
    const u = ((t / (MOTE_RISE + i * 0.9) + i * 0.41) % 1 + 1) % 1;
    out.push({
      x: gx + Math.sin(u * TAU * 0.7 + i * 2.1) * 4.2,
      y: gy - u * rise,
      a: Math.pow(Math.sin(Math.PI * u), 1.5),
      r: (0.75 + 0.3 * ((i * 0.618) % 1)) * zoom ** 0.75,
    });
  }
  return out;
}

/* ---- drawing it ------------------------------------------------------------------------ */

/**
 * Draw a rune lantern post whose footprint's middle is at (sx, sy) on the
 * screen, from viewpoint `rotation`, at `t` seconds, under a night `night`
 * dark: the bake, and unless `live` is false, its runes' light over it and
 * the motes rising off them (`drawRuneLanternLive`). Returns what it covers
 * from (sx, sy), in screen pixels: left, top, right, bottom.
 */
export function drawRuneLantern(ctx: Ctx, sx: number, sy: number, zoom: number, look: RuneLanternLook, rotation: number, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  const k = zoom / b.scale;
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  if (live) drawRuneLanternLive(ctx, sx, sy, zoom, look, rotation, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** What of a rune lantern post moves, over its bake: its runes' light as it breathes, and the motes rising off them. */
export function drawRuneLanternLive(ctx: Ctx, sx: number, sy: number, zoom: number, look: RuneLanternLook, rotation: number, night = 0, t = performance.now() / 1000): void {
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  drawGlows(ctx, b.glows, sx, sy, zoom, night, t);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  if (night > 0.02) {
    /*
     * After dark the band blooms, as a lantern does, a pale gold round it
     * breathing with the runes: light over what is behind it and under what
     * is drawn in front of it after, which is drawn over it.
     */
    const x = sx + b.glowAt[0] * zoom, y = sy + b.glowAt[1] * zoom, R = BLOOM * zoom;
    const p = 0.5 + 0.5 * Math.sin((t / 4.8) * TAU);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, R);
    grad.addColorStop(0, `rgba(255, 200, 118, ${(0.17 * night * (0.85 + 0.15 * p)).toFixed(3)})`);
    grad.addColorStop(0.35, `rgba(255, 192, 110, ${(0.07 * night).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 196, 120, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
  }
  for (const m of motesAt(b, t, zoom)) {
    const px = sx + m.x * zoom, py = sy + m.y * zoom;
    const a = m.a * (0.25 + 0.75 * night);
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
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** What it is clicked by, from its footprint's middle, in pixels at zoom one: the pillar and a little round it, not the outcrop. */
export function runeLanternHit(look: RuneLanternLook, rotation: number, zoom = 1): [number, number, number, number] {
  return bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom).hit;
}

/**
 * How it takes the night back off itself, drawn at a zoom, for the
 * runestones' keeping (`RunestoneNight.glowing`): each rune in its own shape,
 * a softer hole round each a good deal stronger than a runestone's, since
 * this is a lantern and lights its own stone, one over the band and the cap
 * over it, and the motes.
 */
export function runeLanternNight(look: RuneLanternLook, rotation: number, zoom: number): NightSource {
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  return {
    glows: b.glows,
    rise: b.glowAt[1] - b.topAt[1] + 12,
    holes: (sx, sy, z, t): NightHole[] => {
      const out = glowHoles(b.glows, sx, sy, z, t, 3);
      const p = 0.5 + 0.5 * Math.sin((t / 4.8) * TAU);
      out.push({ x: sx + b.glowAt[0] * z, y: sy + b.glowAt[1] * z, r: 15 * z, a: 0.32 + 0.08 * p });
      for (const m of motesAt(b, t, z)) out.push({ x: sx + m.x * z, y: sy + m.y * z, r: m.r * 2.2, a: 0.8 * m.a });
      return out;
    },
    masks: (sx, sy, z, t): NightMask[] => glowMasks(b.glows, sx, sy, z, t),
  };
}

/** Which of its cuts a piece standing at subtile (sx, sy) of tile (x, y) is. */
export const runeLanternVariant = (x: number, y: number, sx: number, sy: number): number =>
  Math.floor(hashOf(x * 4 + sx, y * 4 + sy, 5, 913) * RUNE_LANTERN_VARIANTS) % RUNE_LANTERN_VARIANTS;

