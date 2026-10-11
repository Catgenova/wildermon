import { hashOf, PPM, rand, STAGES, strandPic, type StrandKind } from './ivy';
import {
  add, area2, at, boulder, canvasOf, css, cushion, cut, dot, drawFaces, drawPads, eyeOf, flowerClump, glowOf, glyphPath, grassTuft, groundNear,
  hex, inset, lichen, mix, mul, newell, noise2, plate, proj, roundelStrokes, scaleFor, strokesPath, TAU, toneOf,
  type Eye, type Glow, type NightHole, type NightMask, type Pad, type Painter, type Pt, type Thing, type Tone, type V3,
} from './runestone';
import { star } from './shine';

/**
 * The rune gate (`../game/runegate.ts`): two pillars cut with runes under a
 * lintel, on a tile's border, the kin of the Runestones.
 *
 * Built as a Runestone is, out of its kit (`runestone.ts`): a small model in
 * tenths of a metre -- across the border, through it (its front looks out of
 * the tile the border is the north or west edge of), and up -- of faceted
 * plates and boulders, put on the screen through the camera's turn so it
 * stands right at all eight viewpoints, baked once for each way it is seen,
 * each scale and each of its three hands (`VARIANTS`), and the runes' light
 * laid over the bake each frame. Each pillar is a small monolith of its own,
 * tapered, leaning in a little and cut off square at a different slant, on a
 * dressed foot stone, with a sunk panel of three runes down its front and its
 * back; the lintel laid over them rises in the middle to a crest with a
 * carved roundel, a rune cut either side, and one end of it is chipped. Moss
 * comes up from the feet in masses and lies along the lintel, ivy climbs one
 * pillar, a worn threshold stone lies between them, and flowers and grass
 * grow at the feet and in the moss on the lintel.
 *
 * Everything stands within the border's own length, so a fence or a wall
 * run up to either end meets a pillar's side rather than passing through it.
 *
 * Its runes are dark until a citizen is in the opening (`runeGateLit`):
 * then they light from the foot of both pillars up, the lintel's last and
 * the roundel last of all, breathe while it stays lit and go out when it
 * fades; motes of light rise through the opening; and after dark they take
 * the night off themselves in their own shapes, as a Runestone's do
 * (`RunestoneNight.light`).
 */

/* ---- the model ------------------------------------------------------------- */

/** How far each pillar's middle stands from the middle of the border, in units: the opening between their inner faces is about two and a half metres. */
const PILLAR_X = 15.1;
/** The top of a foot stone, which a pillar stands on. */
const FOOT_TOP = 2.4;
/** How tall a pillar stands over its foot stone, and so where the lintel's underside is. */
const PILLAR_H = 26.4;
const LINTEL_Z = FOOT_TOP + PILLAR_H - 0.6;
/** How far a rune's middle is from its top, on a pillar's panel and on the lintel. */
const RUNE_S = 1.9;
const LINTEL_RUNE_S = 1.35;
/** And the rune down each pillar's outer end. */
const END_RUNE_S = 1.6;
/** Nothing of it stands further than this from the middle of the border along it: a hair inside the tile's corner. */
const REACH_X = 19.6;

/** One of the three hands a gate is cut in, by where it stands: its stone's colour, how its pillars lean, which side the moss and ivy are on, its runes. */
interface Hand {
  stone: Tone;
  rock: Tone;
  lichen: [string, string];
  /** How far each pillar leans in toward the opening and through the gate, per unit up: left, then right. */
  lean: [[number, number], [number, number]];
  /** How far the lintel is off level, in radians, its right end the higher for more than nought: the two pillars are not cut to one height. */
  tilt: number;
  /** How stout each pillar is against the other, left then right: no two stones are dressed to one width. */
  girth: [number, number];
  /** Which pillar the moss is thicker on and the ivy climbs: -1 the left, 1 the right. */
  mossSide: -1 | 1;
  moss: number;
  /** The runes down each pillar's front and back, from the foot up, left then right; and either side of the roundel. */
  runes: { front: [string[], string[]]; back: [string[], string[]]; lintel: [string, string]; ends: [string, string] };
  roundel: string;
  /** The colours of the flowers at its feet, by how many of each. */
  flowers: Array<[string, number]>;
  seed: number;
}

const VARIANTS: Hand[] = [
  {
    stone: toneOf('#eee4d0', '#aa9fac'), rock: toneOf('#dcd1bf', '#9d95a5'), lichen: ['#e6e0ae', '#ead9a0'],
    lean: [[0.045, 0.004], [-0.04, -0.003]], tilt: 0.011, girth: [1, 0.87], mossSide: 1, moss: 0.72,
    runes: { front: [['othala', 'algiz', 'dagaz'], ['ingwaz', 'tiwaz', 'diamondDot']], back: [['tiwaz', 'ring', 'algiz'], ['dagaz', 'othala', 'star6']], lintel: ['algiz', 'othala'], ends: ['tiwaz', 'ingwaz'] },
    roundel: 'key', flowers: [['white', 4], ['yellow', 2], ['pink', 2]], seed: 101,
  },
  {
    stone: toneOf('#e6e4d6', '#a2a4b0'), rock: toneOf('#d4d2c4', '#999ba8'), lichen: ['#d3dcb4', '#e2e0b4'],
    lean: [[0.04, -0.004], [-0.05, 0.003]], tilt: -0.013, girth: [0.88, 1], mossSide: -1, moss: 0.85,
    runes: { front: [['laguz', 'ingwaz', 'algiz'], ['othala', 'dagaz', 'crescent']], back: [['diamond', 'tiwaz', 'laguz'], ['algiz', 'ingwaz', 'ring']], lintel: ['tiwaz', 'algiz'], ends: ['othala', 'dagaz'] },
    roundel: 'eye', flowers: [['lilac', 3], ['blue', 2], ['white', 3]], seed: 211,
  },
  {
    stone: toneOf('#f2e0cf', '#b29fa9'), rock: toneOf('#e0d1bd', '#a596a3'), lichen: ['#efcf7a', '#e6e0ae'],
    lean: [[0.05, 0.002], [-0.042, -0.004]], tilt: 0.008, girth: [1, 0.86], mossSide: 1, moss: 0.6,
    runes: { front: [['algiz', 'sowilo', 'othala'], ['dagaz', 'star8', 'ingwaz']], back: [['ingwaz', 'algiz', 'sunDot'], ['othala', 'tiwaz', 'diamond']], lintel: ['sowilo', 'dagaz'], ends: ['algiz', 'tiwaz'] },
    roundel: 'star8', flowers: [['pink', 3], ['yellow', 3], ['white', 2]], seed: 307,
  },
];

/** A rune of the gate, where it is cut, for its light: which plate and face, its glyph, and its turn in the climb. */
interface GateRune {
  face: string;
  glyph: string;
  x: number;
  z: number;
  s: number;
  /** Its place in the climb: nought at the pillars' feet, up to the roundel. */
  o: number;
  roundel?: string;
}

/** A thing of the model and where in the order it goes: under everything, by where it stands, the lintel, or on the lintel. */
type GateThing = Thing & { rank?: number };

interface Model {
  hand: Hand;
  things: GateThing[];
  /** Each carved face's frame, as its painting is laid (`plate`): its point, across it and up it; and which way it looks. */
  frames: Map<string, { o: V3; a: V3; b: V3; n: V3 }>;
  runes: GateRune[];
  turf: Pt[];
  /** The last step of the climb: the roundel's. */
  top: number;
}

const models = new Map<number, Model>();

/**
 * A pillar's outline, across it from its middle and up it, its outer side
 * on `out`'s side: widest at the foot and drawn in to a head about four
 * fifths as wide, the long sides not quite straight; one with its outer
 * shoulder cut back on a slant under the lintel's overhang, the other square.
 * Its head is cut level and stands into the lintel, so nothing of it shows
 * between the two.
 */
function pillarOutline(R: () => number, out: -1 | 1, kind: number, H: number, girth: number): Pt[] {
  const j = (k: number): number => (R() - 0.5) * k;
  /*
   * Up the outer side and down the inner, as `s` across from the inner side
   * to the outer: the foot widest, a swell a third of the way up, drawing in
   * to the head, and every point off the true line by a little -- a side
   * dressed by eye, not ruled.
   */
  const top = H * 0.86;
  const side = (w0: number, w1: number, n: number, up: boolean): Pt[] => Array.from({ length: n }, (_, i) => {
    const u = up ? i / (n - 1) : 1 - i / (n - 1);
    const t = top * u;
    const w = w0 + (w1 - w0) * u + 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.6)) + j(0.3);
    return [w, t] as Pt;
  });
  const foot = 4.15 * girth, head = foot * 0.82;
  const outer = side(foot, head, 7, true);
  const inner = side(foot * 0.98, head * 1.02, 7, false).map(([w, t]) => [-w, t] as Pt);
  const hw = head + 0.05;
  const crown: Pt[] = kind === 0
    // The outer shoulder cut back on a slant, the cut under the lintel's overhang.
    ? [[hw - 0.1, H - 3.2], [hw - 1.5, H - 1.0], [hw - 1.6, H + 0.15], [0.3 + j(0.3), H + 0.3], [-hw + 0.2, H + 0.1]]
    : [[hw - 0.15, H + 0.05], [0.6 + j(0.3), H + 0.3], [-hw + 0.2, H + 0.15]];
  const pts = [...outer, ...crown, ...inner];
  // `s` runs from the inner side to the outer: as the model's `x`, that is the way `out` says.
  return pts.map(([s2, t]) => [s2 * out, t] as Pt);
}

/** The lintel's outline, across the gate and up from its underside: a slab with a low crest in the middle, the roundel's, and one end chipped. */
function lintelOutline(R: () => number, chip: -1 | 1): Pt[] {
  const j = (k: number): number => (R() - 0.5) * k;
  const E = REACH_X - 0.1;
  const pts: Pt[] = [
    [-E + 0.6, 0.6 + j(0.3)], [-E + 1.8 + j(0.4), -0.05], [-7, -0.2], [0, -0.05], [7, -0.15], [E - 1.7 + j(0.4), 0], [E - 0.2, 0.7 + j(0.3)],
    [E, 3.2 + j(0.3)], [E - 0.5, 4.9], [E - 2.2, 5.5 + j(0.2)], [9.6, 5.75 + j(0.2)], [6.6, 6.2], [4.6, 8.1], [1.8, 9.4], [-1.4, 9.55],
    [-4.4, 8.4], [-6.6, 6.3], [-9.8, 5.7 + j(0.2)], [-E + 2.3, 5.45 + j(0.3)], [-E + 0.3, 4.6], [-E, 2.6 + j(0.3)],
  ];
  // A corner broken off one end, along the top: the end steps down in two facets.
  return pts.map(([x, z]) => {
    if (x * chip > E - 3.2 && z > 3.2) return [x - chip * (z - 3.2) * 0.55, z - (x * chip > E - 1 ? 1.1 : 0.4)] as Pt;
    return [x, z] as Pt;
  });
}
const LINTEL_ROUNDEL = { x: 0, z: 5.15, r: 2.95 };

/**
 * A gate's face's skin, in its frame: flat patches a step paler and a step
 * greyer, the damp up from the foot, grit, a few weathered pits, the marks of
 * the chisel it was dressed with, hairline crazing and streaks down from the
 * head -- the Runestones' own, at a pillar's size. `xs` is how far across
 * the face reaches at a height, `tall` how tall it is.
 */
function skin(g: CanvasRenderingContext2D, fill: [number, number, number], T: () => number, xs: (z: number) => [number, number], tall: number, foot: boolean): void {
  for (let i = 0; i < 18; i++) {
    const z = T() * tall, [a, b] = xs(z);
    const x = a + T() * (b - a);
    const rx = 0.7 + T() * 2.4, rz = 0.5 + T() * 1.9, turn = (T() - 0.5) * 0.8, n = 6 + Math.floor(T() * 3);
    g.beginPath();
    for (let j = 0; j < n; j++) {
      const q = (j / n) * TAU, w = 0.7 + T() * 0.45;
      const px = Math.cos(q) * rx * w, pz = Math.sin(q) * rz * w;
      const X = x + px * Math.cos(turn) - pz * Math.sin(turn), Z = z + px * Math.sin(turn) + pz * Math.cos(turn);
      if (j) g.lineTo(X, Z); else g.moveTo(X, Z);
    }
    g.closePath();
    g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.4) : css(mix(fill, hex('#9c94a4'), 0.32), 0.28);
    g.fill();
  }
  // The chisel: short strokes laid aslant in patches, a step darker, as a face is dressed by hand.
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const z = 2 + T() * (tall - 3), [a, b] = xs(z);
    const x = a + 0.6 + T() * Math.max(0, b - a - 1.2), ang = 0.9 + (T() - 0.5) * 0.4;
    g.beginPath();
    for (let k = 0; k < 4 + Math.floor(T() * 4); k++) {
      const ox = x + (k - 2) * 0.42 + (T() - 0.5) * 0.15, oz = z + (T() - 0.5) * 0.4;
      g.moveTo(ox - Math.cos(ang) * 0.45, oz - Math.sin(ang) * 0.45);
      g.lineTo(ox + Math.cos(ang) * 0.45, oz + Math.sin(ang) * 0.45);
    }
    g.strokeStyle = css(mix(fill, hex('#7f7488'), 0.4), 0.18);
    g.lineWidth = 0.13;
    g.stroke();
  }
  if (foot) {
    // The damp up out of the ground: a band a step darker over the lowest part, and the foot darker still.
    g.beginPath();
    g.moveTo(-30, -2);
    for (let x = -30; x <= 30; x += 1.5) g.lineTo(x, tall * (0.12 + 0.07 * noise2(x / 4, 2.5, 7)));
    g.lineTo(30, -2);
    g.closePath();
    g.fillStyle = css(mix(fill, hex('#8c8f8e'), 0.3), 0.28);
    g.fill();
    g.beginPath();
    g.moveTo(-30, -2);
    for (let x = -30; x <= 30; x += 1.5) g.lineTo(x, 1.3 + 1.2 * noise2(x / 3, 0.5, 11));
    g.lineTo(30, -2);
    g.closePath();
    g.fillStyle = css(mix(fill, hex('#7f8486'), 0.35), 0.42);
    g.fill();
  }
  g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.3);
  for (let i = 0; i < 60; i++) {
    const z = Math.pow(T(), 1.5) * tall, [a, b] = xs(z);
    g.fillRect(a + T() * (b - a), z, 0.13 + T() * 0.12, 0.13 + T() * 0.12);
  }
  for (let i = 0; i < 4; i++) {
    const z = T() * tall * 0.95, [a, b] = xs(z);
    const x = a + 0.5 + T() * Math.max(0, b - a - 1), r = 0.12 + T() * 0.14;
    g.beginPath();
    g.ellipse(x, z, r * 1.3, r, 0, 0, TAU);
    g.fillStyle = css(mix(fill, hex('#5d5464'), 0.35), 0.4);
    g.fill();
    g.beginPath();
    g.ellipse(x + r * 0.35, z - r * 0.45, r * 1.1, r * 0.5, 0, 0, TAU);
    g.fillStyle = css(mix(fill, [255, 252, 244], 0.6), 0.55);
    g.fill();
  }
  for (let i = 0; i < 3; i++) {
    let z = T() * tall;
    const [a, b] = xs(z);
    let x = a + T() * (b - a), ang = T() * TAU;
    g.beginPath();
    g.moveTo(x, z);
    for (let j = 0; j < 4 + T() * 4; j++) {
      ang += (T() - 0.5) * 1.1;
      x += Math.cos(ang) * 0.9;
      z += Math.sin(ang) * 0.9;
      g.lineTo(x, z);
    }
    g.strokeStyle = css(mix(fill, hex('#6d6274'), 0.45), 0.35);
    g.lineWidth = 0.12;
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const z1 = tall * (0.75 + T() * 0.22), [a, b] = xs(z1);
    const x = a + (0.1 + T() * 0.8) * (b - a), len = tall * (0.2 + T() * 0.35), w = 0.3 + T() * 0.6;
    g.beginPath();
    g.moveTo(x - w, z1);
    g.quadraticCurveTo(x - w * 0.6, z1 - len * 0.6, x, z1 - len);
    g.quadraticCurveTo(x + w * 0.6, z1 - len * 0.6, x + w, z1);
    g.fillStyle = css(mix(fill, hex('#8e8798'), 0.4), 0.18);
    g.fill();
  }
}

/** Cushions of moss at points of a face's frame, painted on the screen as the Runestones' are (`drawPads`). */
function padsIn(g: CanvasRenderingContext2D, base: DOMMatrix, e: Eye, pts: Array<[number, number, number]>, squat = 0.9): void {
  if (!pts.length) return;
  const tr = g.getTransform(), inv = base.inverse();
  const across = Math.hypot(e.ux, e.uy) * 0.9;
  const ps: Pad[] = pts.map(([x, z, r]) => {
    const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x, z)));
    return [q.x, q.y, r * across, r * across * squat];
  });
  g.save();
  g.setTransform(base);
  drawPads(g, ps);
  g.restore();
}

/**
 * Moss in masses over a stretch of a face: `share(x, z)` is how far it has
 * got at a point, nought to one, and where that and the noise together are
 * over a half a cushion goes down, close enough to its neighbours that they
 * run together into one mass with a lobed edge, as on the Runestones.
 */
function mossMass(T: () => number, n: number, at: () => [number, number], share: (x: number, z: number) => number, seed: number, size = 0.6): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = at();
    const s = share(x, z);
    if (s <= 0) continue;
    const nz = noise2(x / 2.4, z / 2.4, seed) * 0.7 + noise2(x / 1, z / 1, seed + 1) * 0.3;
    if (s * 1.3 + (nz - 0.5) * 1.1 < 0.62) continue;
    out.push([x, z, (cushion(T, s) + 0.3) * size]);
  }
  return out;
}

function modelOf(variant: number): Model {
  const had = models.get(variant);
  if (had) return had;
  const hand = VARIANTS[variant % VARIANTS.length];
  const R = rand(hand.seed * 7919 + 3);
  const things: GateThing[] = [];
  const frames = new Map<string, { o: V3; a: V3; b: V3; n: V3 }>();
  const runes: GateRune[] = [];
  const climb = 3;

  /* -- the threshold: a worn flag lying flush between the feet, a crack across it and moss in its joints -- */
  {
    const out: Pt[] = [[-10.4, -3.8], [-4, -4.7], [5.2, -4.2], [10.3, -3.3], [10.6, 3], [3.4, 4.6], [-6.2, 4.3], [-10.1, 3.4]].map(([x, y]) => [x + (R() - 0.5) * 0.6, y + (R() - 0.5) * 0.5] as Pt);
    const T0 = Math.floor(R() * 1000);
    things.push({
      x: 0, y: 0, rank: -1,
      faces: plate({
        o: [0, 0, 0.25], U: [1, 0, 0], W: [0, 1, 0], A: [0, 0, 1], outline: out, half: [0.55, 0.55], tTop: 1, bevel: 0.45, tone: hand.rock,
        front: (g, k) => {
          const T = rand(T0 + 5);
          const fill = k.fill;
          // Worn pale down the middle, where the feet go.
          g.beginPath();
          g.ellipse(0, 0, 7.5, 2.6, 0, 0, TAU);
          g.fillStyle = css(mix(fill, [255, 252, 244], 0.45), 0.4);
          g.fill();
          for (let i = 0; i < 10; i++) {
            g.beginPath();
            g.ellipse((T() - 0.5) * 18, (T() - 0.5) * 7, 0.8 + T() * 2.2, 0.5 + T() * 1.2, 0, 0, TAU);
            g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.3), 0.35) : css(mix(fill, hex('#8f8a9a'), 0.3), 0.28);
            g.fill();
          }
          cut(g, fill, 0.32, () => { g.beginPath(); g.moveTo(-3.2, 4.4); g.lineTo(-2.4, 1.8); g.lineTo(-3.4, -0.6); g.lineTo(-1.9, -4.4); });
          cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(6.8, -4); g.lineTo(7.6, -1.6); g.lineTo(9.3, -0.2); });
          lichen(g, T, -8.4, 2.2, 0.8, hand.lichen);
          lichen(g, T, 8.6, -2, 0.6, hand.lichen);
          // Moss in the crack and along the ends, where nobody treads.
          const pts: Array<[number, number, number]> = [];
          for (let i = 0; i < 10; i++) pts.push([-3 + (T() - 0.5) * 1.2, 4.2 - i * 0.88, 0.3 + T() * 0.3]);
          for (const sx of [-1, 1]) for (let i = 0; i < 14; i++) pts.push([sx * (9.1 + T() * 1.4), (T() - 0.5) * 6.5, 0.4 + T() * 0.5]);
          padsIn(g, k.base, k.e, pts, 0.6);
        },
      }),
    });
  }

  /* -- the two pillars, each on its foot stone -- */
  for (const side of [-1, 1] as const) {
    const li = side < 0 ? 0 : 1;
    const cx = side * PILLAR_X;
    const mossy = side === hand.mossSide;
    const m = hand.moss * (mossy ? 1 : 0.55);
    const seed = hand.seed * 13 + li * 7;

    // The foot stone: a dressed block, its edges knocked off, a step wider than the pillar, kept inside the border's length.
    const fx = cx - side * 0.55;
    const footOut: Pt[] = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * TAU + (R() - 0.5) * 0.12;
      const r = 1 + (R() - 0.5) * 0.1;
      return [fx + Math.cos(a) * 4.55 * r, Math.sin(a) * 6.7 * r] as Pt;
    });
    const footSeed = seed + 3;
    things.push({
      x: cx, y: 0,
      faces: plate({
        o: [0, 0, FOOT_TOP / 2 - 0.3], U: [1, 0, 0], W: [0, 1, 0], A: [0, 0, 1], outline: footOut, half: [FOOT_TOP / 2 + 0.3, FOOT_TOP / 2 + 0.3], tTop: 1,
        bevel: 0.75, tone: hand.rock,
        front: (g, k) => {
          // Its top: lichen, and moss round the rim, thickest on the gate's outer side and on the mossy pillar, none under the pillar.
          const T = rand(footSeed);
          lichen(g, T, fx + (T() - 0.5) * 4, -4.2, 0.7, hand.lichen);
          const pts = mossMass(T, 180, () => {
            const a = T() * TAU, rr = 0.55 + T() * 0.45;
            return [fx + Math.cos(a) * 4.3 * rr, Math.sin(a) * 6.3 * rr];
          }, (x, y) => (Math.abs(x - cx) < 4.0 && Math.abs(y) < 5.1 ? 0 : m * (0.75 + 0.5 * Math.max(0, (x - fx) * side / 5))), footSeed, 0.62)
            // Rounded off short of the border's end, where a wall run up to the gate would stand over it.
            .filter(([x, , r]) => Math.abs(x) + r < REACH_X);
          padsIn(g, k.base, k.e, pts, 0.62);
        },
        edge: (i) => ({
          paint: (g, k) => {
            const T = rand(footSeed * 5 + i);
            for (let j = 0; j < 4; j++) {
              g.beginPath();
              g.ellipse(T() * 3.2, (T() - 0.5) * 2, 0.5 + T() * 1.2, 0.3 + T() * 0.5, 0, 0, TAU);
              g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.35), 0.35) : css(mix(k.fill, hex('#9c94a4'), 0.3), 0.28);
              g.fill();
            }
            // Its sides: moss up out of the grass, in a band along the foot.
            // Smaller on its outer end, which a wall run up to the gate stands against.
            const end = (footOut[i][0] - fx) * side > 2.4;
            const pts = mossMass(T, 26, () => [T() * 3.4, -1.6 + T() * 1.8], (_s, y) => m * (1.05 - (y + 1.6) / 2.4), footSeed + i * 7, end ? 0.32 : 0.62);
            padsIn(g, k.base, k.e, pts, 0.85);
          },
        }),
      }),
    });

    // The pillar: a plate, tapered and leaning in a little, on its foot stone.
    // As tall as the lintel is high over it: the lintel is laid a little off level.
    const outline = pillarOutline(R, side, (li + hand.seed) % 2, PILLAR_H + Math.tan(hand.tilt) * cx, hand.girth[li])
      // And never out past the end of the border, whatever its swell.
      .map(([s, t]) => [Math.min(s * side, REACH_X - 0.3 - PILLAR_X) * side, t] as Pt);
    // Anticlockwise, as `plate` lays it, so an edge's number here is its number there.
    if (area2(outline) < 0) outline.reverse();
    const tTop = Math.max(...outline.map((p) => p[1]));
    const [lx, ly] = hand.lean[li];
    const W: V3 = [lx, ly, 1];
    // Deep enough to stand out past both faces of a wall run up to it, as a buttress does, and less so at the head.
    const half: [number, number] = [5.3 * (0.85 + 0.15 * hand.girth[li]), 4.0 * (0.85 + 0.15 * hand.girth[li])];
    const f = (half[1] - half[0]) / tTop;
    const O: V3 = [cx, 0, FOOT_TOP - 0.2];
    const widthAt = (z: number): [number, number] => {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        if ((a[1] - z) * (b[1] - z) > 0 || a[1] === b[1]) continue;
        const x = a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
      return lo < hi ? [lo, hi] : [0, 0];
    };
    const panel = { w: 4.6, z0: 3.4, z1: 19.0, arch: 2.4 };
    const face = (which: 'front' | 'back'): { paint: Painter; over: Painter } => {
      const key = `${li}${which}`;
      const glyphs = hand.runes[which][li];
      // On the back the frame runs the other way across it, so what is on the gate's outer side is mirrored.
      const outer = which === 'front' ? side : -side;
      const xs = (z: number): [number, number] => {
        const [a, b] = widthAt(z);
        return which === 'front' ? [a, b] : [-b, -a];
      };
      const step = (panel.z1 - panel.z0 - RUNE_S * 2.5) / (glyphs.length - 1);
      glyphs.forEach((glyph, i) => runes.push({ face: key, glyph, x: 0, z: panel.z0 + RUNE_S * 1.25 + step * i, s: RUNE_S, o: i }));
      const fseed = seed * 31 + (which === 'front' ? 1 : 2);
      const hw = panel.w / 2;
      const paint: Painter = (g, k) => {
        const T = rand(fseed);
        const fill = k.fill;
        skin(g, fill, T, xs, tTop, true);
        /* -- the panel: a field sunk a step, ruled twice round, a pointed head; drilled dots between the rules -- */
        const border = (d: number): void => {
          const top = panel.z1 + panel.arch - d * 0.4;
          g.beginPath();
          g.moveTo(-hw + d, panel.z0 + d);
          g.lineTo(-hw + d, panel.z1);
          g.quadraticCurveTo(-hw + d, panel.z1 + (top - panel.z1) * 0.7, 0, top);
          g.quadraticCurveTo(hw - d, panel.z1 + (top - panel.z1) * 0.7, hw - d, panel.z1);
          g.lineTo(hw - d, panel.z0 + d);
          g.closePath();
        };
        border(0.75);
        g.fillStyle = css(mix(fill, hex('#a39aac'), 0.42), 0.55);
        g.fill();
        cut(g, fill, 0.42, () => border(0));
        cut(g, fill, 0.3, () => border(0.75));
        for (let z = panel.z0 + 1.6; z < panel.z1 - 0.4; z += 1.7) {
          for (const sx of [-1, 1]) cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(sx * (hw - 0.38), z + 0.03); g.lineTo(sx * (hw - 0.38), z - 0.03); });
        }
        for (const r of runes) if (r.face === key) cut(g, fill, 0.55, () => glyphPath(g, r.glyph, r.x, r.z, r.s));
        // A band cut across the head, where the lintel comes down on it.
        const zb = tTop - 3.4;
        cut(g, fill, 0.32, () => { g.beginPath(); g.moveTo(xs(zb)[0] + 0.5, zb); g.lineTo(xs(zb)[1] - 0.5, zb + 0.1); });
        // A crack in from the outer edge, its lit lip under it.
        {
          const z0 = tTop * (0.35 + 0.3 * T()), [a, b] = xs(z0);
          let x = outer > 0 ? b : a, z = z0, ang = outer > 0 ? Math.PI + 0.3 : -0.3;
          const pts: Pt[] = [[x, z]];
          for (let i = 0; i < 5; i++) {
            ang += (T() - 0.5) * 0.9;
            x += Math.cos(ang) * 0.5;
            z += Math.sin(ang) * 0.5;
            pts.push([x, z]);
          }
          cut(g, fill, 0.28, () => { g.beginPath(); pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz))); });
        }
        /* -- lichen on the upper half, outside the panel -- */
        for (let i = 0; i < 5; i++) {
          const z = tTop * (0.3 + 0.62 * T()), [a, b] = xs(z);
          const x = a + T() * (b - a);
          if (Math.abs(x) < hw + 0.4 && z > panel.z0 && z < panel.z1 + panel.arch + 0.4) continue;
          lichen(g, T, x, z, 0.4 + T() * 0.5, hand.lichen);
        }
        /* -- moss: up from the foot in a band, higher on the gate's outer side and on the mossy pillar, and up that edge -- */
        const foot = 2.6 + 6 * m;
        const reach = tTop * (0.2 + 0.5 * m);
        const pts = mossMass(T, 520, () => {
          const z = 0.2 + T() * tTop, [a, b] = xs(z);
          return [a + 0.15 + T() * (b - a - 0.3), z];
        }, (x, z) => {
          const [a, b] = xs(z);
          const across = (x * outer) / 4;
          const inFoot = 1 - z / (foot * (0.45 + 0.55 * Math.max(0, across + 0.5)));
          const d = outer > 0 ? b - x : x - a, w = (1.2 + 2.4 * m) * (1 - z / reach);
          const inEdge = w > 0 ? 1 - d / w : 0;
          if (Math.abs(x) < hw && z > panel.z0 + 1.2 && z < panel.z1 + panel.arch && inFoot < 0.5) return 0;
          return Math.max(inFoot, inEdge);
        }, fseed, 0.75)
          // Rounded off short of the border's end, where a wall run up to the gate would stand in front of it.
          .filter(([x, , r]) => Math.abs(cx + (which === 'front' ? x : -x)) + r < REACH_X);
        padsIn(g, k.base, k.e, pts);
      };
      const over: Painter = (g) => {
        // Ivy up the outer edge of the mossy pillar, front and back, kept off the panel.
        if (!mossy) return;
        const B = rand(fseed * 3 + 1);
        const strands: Array<{ kind: StrandKind; v: number; k: number; z: number }> = which === 'front'
          ? [{ kind: 'climb', v: 2 + (hand.seed % 3), k: 1.05, z: 0.3 }, { kind: 'vine', v: 1, k: 0.8, z: 7 }]
          : [{ kind: 'climb', v: 4, k: 0.9, z: 0.3 }];
        for (const iv of strands) {
          const pic = strandPic(iv.kind, iv.v, STAGES, true);
          if (!pic) continue;
          const sc = (iv.k * 10) / PPM;
          const [a, b] = xs(Math.max(1, iv.z));
          const right = (pic.img.width - pic.ax) * sc, left = pic.ax * sc;
          // As far out on the outer edge as keeps its root on the stone and its leaves off the panel.
          const x = outer > 0 ? Math.min(b - 0.6, Math.max(hw + 0.4 + left, b - 1.2)) : Math.max(a + 0.6, Math.min(-hw - 0.4 - right, a + 1.2));
          g.save();
          g.beginPath();
          // No leaf further off the stone than about a leaf.
          const grown = inset(area2(outline) < 0 ? outline.slice().reverse() : outline, -0.8).map(([s, t]) => [which === 'front' ? s : -s, t] as Pt);
          grown.forEach(([hx, hz], i) => (i ? g.lineTo(hx + (B() - 0.5) * 0.5, hz) : g.moveTo(hx, hz)));
          g.closePath();
          g.clip();
          // And never over the panel.
          g.beginPath();
          const edgeX = outer > 0 ? hw + 0.35 : -hw - 0.35;
          g.moveTo(edgeX, -5);
          for (let z = -5; z <= tTop + 5; z += 1) g.lineTo(edgeX + outer * (0.3 + 0.3 * Math.sin(z * 1.7) + 0.25 * noise2(z / 2, 1, fseed)), z);
          g.lineTo(edgeX + outer * 50, tTop + 5);
          g.lineTo(edgeX + outer * 50, -5);
          g.closePath();
          g.clip();
          // Nor out past the border's end, where a wall run up to it would stand in front: its leaves end along a ragged line.
          g.beginPath();
          const endX = outer * (REACH_X - 0.6 - PILLAR_X);
          g.moveTo(endX, -5);
          for (let z = -5; z <= tTop + 5; z += 0.8) g.lineTo(endX - outer * (0.35 + 0.35 * Math.sin(z * 2.3 + fseed) + 0.3 * noise2(z / 1.5, 3, fseed)), z);
          g.lineTo(endX - outer * 50, tTop + 5);
          g.lineTo(endX - outer * 50, -5);
          g.closePath();
          g.clip();
          g.translate(x, iv.z);
          g.scale(outer > 0 ? sc : -sc, -sc);
          g.drawImage(pic.img, -pic.ax, -pic.ay);
          g.restore();
        }
      };
      return { paint, over };
    };
    const front = face('front');
    const back = face('back');
    /*
     * A rune down the pillar's outer side, the narrow end it shows along the
     * wall: on the edge of the outline that crosses about halfway up, upright
     * on it however the edge leans, in a sunk oval, and lit in the climb with
     * the panels' middle runes -- so a gate seen end on shows its light too.
     */
    const P = (pt: Pt): V3 => at(O, [pt[0], [1, 0, 0]], [pt[1], W]);
    const endAt = tTop * 0.55;
    const endI = outline.findIndex((pt, i) => {
      const q = outline[(i + 1) % outline.length];
      return pt[0] * side > 0 && q[0] * side > 0 && (pt[1] - endAt) * (q[1] - endAt) <= 0 && pt[1] !== q[1];
    });
    const endRune = ((): { s: number; dir: 1 | -1; hand: 1 | -1 } | null => {
      if (endI < 0) return null;
      const p0 = outline[endI], q0 = outline[(endI + 1) % outline.length];
      const P0 = P(p0), Q0 = P(q0);
      const d: V3 = [Q0[0] - P0[0], Q0[1] - P0[1], Q0[2] - P0[2]];
      const len = Math.hypot(d[0], d[1], d[2]);
      const along: V3 = [d[0] / len, d[1] / len, d[2] / len];
      const fz = (endAt - p0[1]) / (q0[1] - p0[1]);
      const dir = (along[2] > 0 ? 1 : -1) as 1 | -1;
      // Out of the face, away from the opening; and which way along the face the eye reads as right, looking at it.
      // Its normal is square to the edge and to the way through the gate; facing it, right is along that way by the normal's sign.
      let n: V3 = [-along[2], 0, along[0]];
      if (n[0] * side < 0) n = mul(n, -1);
      const handed = (n[0] > 0 ? 1 : -1) as 1 | -1;
      const o = at(P0, [fz * len, along]);
      runes.push({ face: `${li}end`, glyph: hand.runes.ends[li], x: 0, z: 0, s: END_RUNE_S, o: 1 });
      frames.set(`${li}end`, { o, a: [0, handed, 0], b: mul(along, dir), n });
      return { s: fz * len, dir, hand: handed };
    })();
    const edge = (i: number, up: number): { paint?: Painter; over?: Painter } | undefined => {
      const p = outline[i], q = outline[(i + 1) % outline.length];
      const mx = (p[0] + q[0]) / 2;
      const dz = q[1] - p[1];
      const len = Math.hypot(q[0] - p[0] + lx * dz, ly * dz, dz);
      const inner = Math.sign(mx) === -side;
      const G = half[0] + f * ((p[1] + q[1]) / 2) - 0.9;
      return {
        paint: (g, k) => {
          const T = rand(seed * 101 + i);
          for (let j = 0; j < Math.ceil(len / 3); j++) {
            g.beginPath();
            g.ellipse(T() * len, (T() - 0.5) * 2 * G, 0.6 + T() * 1.8, 0.4 + T() * 1.1, (T() - 0.5) * 0.6, 0, TAU);
            g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.4) : css(mix(k.fill, hex('#9c94a4'), 0.32), 0.28);
            g.fill();
          }
          g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.3);
          for (let j = 0; j < len * 1.5; j++) g.fillRect(T() * len, (T() - 0.5) * 2 * G, 0.14 + T() * 0.12, 0.14 + T() * 0.12);
          if (i === endI && endRune) {
            // The end rune, in its sunk oval, upright on the face.
            g.save();
            g.transform(0, endRune.hand, endRune.dir, 0, endRune.s, 0);
            g.beginPath();
            g.ellipse(0, 0.1, END_RUNE_S * 1.25, END_RUNE_S * 1.75, 0, 0, TAU);
            g.fillStyle = css(mix(k.fill, hex('#a39aac'), 0.42), 0.5);
            g.fill();
            cut(g, k.fill, 0.3, () => { g.beginPath(); g.ellipse(0, 0.1, END_RUNE_S * 1.25, END_RUNE_S * 1.75, 0, 0, TAU); });
            const rr = runes.find((r) => r.face === `${li}end`);
            if (rr) cut(g, k.fill, 0.5, () => glyphPath(g, rr.glyph, 0, 0, END_RUNE_S));
            g.restore();
          }
          let pts: Array<[number, number, number]> = [];
          if (up > 0.35) {
            // A head: moss over what the lintel leaves showing.
            pts = mossMass(T, 30, () => [T() * len, (T() - 0.5) * 2 * G], () => 0.4 + m * 0.6, seed + i, 0.7);
          } else if (Math.abs(up) < 0.3 && len > 4) {
            if (inner && len > 10) {
              // Down the side to the opening, tally notches cut across its front arris, in groups of one to five, as the oldest stones are lettered.
              const N = rand(seed * 211 + i);
              const edgeY = G + 0.5;
              for (let s0 = 3.5; s0 < len - 4;) {
                const n = 1 + Math.floor(N() * 5);
                for (let j = 0; j < n; j++) {
                  const sj = s0 + j * 0.7;
                  cut(g, k.fill, 0.24, () => { g.beginPath(); g.moveTo(sj, edgeY); g.lineTo(sj, edgeY - (N() < 0.5 ? 2.2 : 1.4)); });
                }
                s0 += n * 0.7 + 1.6 + N() * 1.2;
              }
            }
            // Moss up from the foot, higher on the outer side and the mossy pillar.
            const rise = (inner ? 3 : 4.8) + 9 * m;
            const along = dz >= 0 ? 1 : -1;
            const zAt = (s: number): number => Math.min(p[1], q[1]) + (along > 0 ? s : len - s) * Math.abs(dz) / Math.max(0.01, len);
            // Kept small on the outer end, which a wall run up to the gate stands against.
            pts = mossMass(T, Math.round(len * 9), () => [T() * len, (T() - 0.5) * 2 * G], (s, y) => (i === endI && Math.abs(y) < END_RUNE_S * 1.6 ? 0 : 1 - zAt(s) / rise),
              seed + i * 3, inner ? 0.7 : 0.42);
          }
          padsIn(g, k.base, k.e, pts);
        },
      };
    };
    const faces = plate({
      o: O, U: [1, 0, 0], W, A: [0, 1, 0], outline, half, tTop, bevel: 1.1, tone: hand.stone,
      front: front.paint, frontOver: front.over, back: back.paint, backOver: back.over, edge, sunk: true,
    });
    things.push({ x: cx, y: 0, faces });
    const A: V3 = [0, 1, 0];
    const fr = { o: at(O, [half[0], A]), a: [1, 0, 0] as V3, b: at(W, [f, A]) };
    const bk = { o: at(O, [-half[0], A]), a: [-1, 0, 0] as V3, b: at(W, [-f, A]) };
    const nOf = (q: { o: V3; a: V3; b: V3 }, want: V3): V3 => {
      const n = newell([q.o, add(q.o, q.a), add(add(q.o, q.a), q.b)]);
      return dot(n, want) < 0 ? mul(n, -1) : n;
    };
    frames.set(`${li}front`, { ...fr, n: nOf(fr, [0, 1, 0]) });
    frames.set(`${li}back`, { ...bk, n: nOf(bk, [0, -1, 0]) });

    /* -- rocks hugging the foot stone in front and behind, mossy as the pillar is -- */
    for (let i = 0; i < 3; i++) {
      const sy = i === 1 ? -1 : 1;
      const x = Math.max(-REACH_X + 3.4, Math.min(REACH_X - 3.4, cx + side * (1.2 + R() * 2.2) - (i === 2 ? side * 4.4 : 0)));
      const y = sy * (8.2 + R() * 1.2);
      const r = 1.3 + R() * 1.1;
      things.push({ x, y, faces: boulder(x, y, r, r * (0.7 + R() * 0.3), 1 + R() * 1.2, R() * TAU, seed * 17 + i, hand.rock, Math.min(1, m + 0.25)) });
    }
  }

  /* -- the lintel: a slab laid over both heads, a crest in its middle with the roundel cut in it -- */
  {
    const chip = (-hand.mossSide) as -1 | 1;
    const outline = lintelOutline(R, chip);
    const tTop = Math.max(...outline.map((p) => p[1]));
    const O: V3 = [0, 0, LINTEL_Z];
    // Along it and up it, laid off level by the hand's tilt.
    const U: V3 = [Math.cos(hand.tilt), 0, Math.sin(hand.tilt)];
    const Wl: V3 = [-Math.sin(hand.tilt), 0, Math.cos(hand.tilt)];
    // Deeper than the pillars' heads, so it covers them through and through.
    const half: [number, number] = [4.7, 4.5];
    const f = (half[1] - half[0]) / tTop;
    const lseed = hand.seed * 41;
    for (const which of ['front', 'back'] as const) {
      const key = `l${which}`;
      const [ga, gb] = hand.runes.lintel;
      const g2 = which === 'front' ? [ga, gb] : [gb, ga];
      runes.push({ face: key, glyph: g2[0], x: -6.4, z: 2.75, s: LINTEL_RUNE_S, o: climb });
      runes.push({ face: key, glyph: g2[1], x: 6.4, z: 2.75, s: LINTEL_RUNE_S, o: climb });
      runes.push({ face: key, glyph: '', x: LINTEL_ROUNDEL.x, z: LINTEL_ROUNDEL.z, s: LINTEL_ROUNDEL.r, o: climb + 1, roundel: hand.roundel });
    }
    const xsL = (z: number): [number, number] => (z > 5.6 ? [-6.5 + (z - 5.6) * 1.3, 6.5 - (z - 5.6) * 1.3] : [-REACH_X + 0.5, REACH_X - 0.5]);
    const face = (which: 'front' | 'back'): Painter => (g, k) => {
      const key = `l${which}`;
      const T = rand(lseed + (which === 'front' ? 1 : 2));
      const fill = k.fill;
      // Which end of it the moss is on, as this face's frame runs.
      const toMoss = which === 'front' ? hand.mossSide : -hand.mossSide;
      skin(g, fill, T, xsL, tTop, false);
      // A rule cut along its foot and one along its brow, stopping short of the crest.
      const E = REACH_X - 1.8;
      cut(g, fill, 0.36, () => { g.beginPath(); g.moveTo(-E, 0.95); g.lineTo(E, 0.9); });
      cut(g, fill, 0.3, () => { g.beginPath(); g.moveTo(-E + 0.2, 4.45); g.lineTo(-5.5, 4.4); g.moveTo(5.5, 4.4); g.lineTo(E - 0.2, 4.45); });
      // Drilled dots between the rules, out toward each end.
      for (let x = -E + 0.8; x <= E - 0.8; x += 1.7) {
        if (Math.abs(x) < 9) continue;
        cut(g, fill, 0.24, () => { g.beginPath(); g.moveTo(x, 2.7 + 0.03); g.lineTo(x, 2.7 - 0.03); });
      }
      // The roundel, sunk, ringed and carved.
      const { x, z, r } = LINTEL_ROUNDEL;
      g.beginPath();
      g.arc(x, z, r * 0.9, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#a39aac'), 0.38), 0.5);
      g.fill();
      for (const rr of runes) {
        if (rr.face !== key) continue;
        if (rr.roundel) cut(g, fill, 0.36, () => strokesPath(g, roundelStrokes(rr.roundel!), rr.x, rr.z, rr.s));
        else cut(g, fill, 0.46, () => glyphPath(g, rr.glyph, rr.x, rr.z, rr.s));
      }
      for (let i = 0; i < 4; i++) {
        const lx = -toMoss * (11 + T() * 6), lz = 1.6 + T() * 2.4;
        lichen(g, T, lx, lz, 0.45 + T() * 0.45, hand.lichen);
      }
      // Moss hanging over its brow at the mossy end in one mass, running out along it.
      const pts = mossMass(T, 260, () => {
        const sx = toMoss * (6.8 + Math.pow(T(), 0.8) * (REACH_X - 7.6));
        return [sx, 5.5 - Math.pow(T(), 1.6) * 2.4];
      }, (sx, zz) => {
        const along = (sx * toMoss - 6.8) / (REACH_X - 6.8);
        const drop = (5.5 - zz) / 2.4;
        return hand.moss * (1.15 - 0.55 * along) - drop * 0.55;
      }, lseed, 0.75);
      padsIn(g, k.base, k.e, pts);
    };
    // Ivy hanging off the lintel's brow at the mossy end, over the head of the pillar under it, short of its panel.
    const hang = (which: 'front' | 'back'): Painter => (g) => {
      const toMoss = which === 'front' ? hand.mossSide : -hand.mossSide;
      const pic = strandPic('hang', which === 'front' ? 2 : 3, STAGES, true);
      if (!pic) return;
      const sc = (0.62 * 10) / PPM;
      const x = toMoss * (PILLAR_X + 1.6);
      g.save();
      g.translate(x, 5.3);
      g.scale(toMoss > 0 ? sc : -sc, -sc);
      g.drawImage(pic.img, -pic.ax, -pic.ay);
      g.restore();
    };
    const edge = (i: number, up: number): { paint?: Painter } | undefined => {
      const p = outline[i], q = outline[(i + 1) % outline.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const mx = (p[0] + q[0]) / 2;
      return {
        paint: (g, k) => {
          const T = rand(lseed * 7 + i);
          for (let j = 0; j < Math.ceil(len / 3); j++) {
            g.beginPath();
            g.ellipse(T() * len, (T() - 0.5) * 6, 0.6 + T() * 1.8, 0.4 + T() * 1.1, 0, 0, TAU);
            g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.4) : css(mix(k.fill, hex('#9c94a4'), 0.32), 0.28);
            g.fill();
          }
          if (up > 0.35) {
            // Its top: a carpet of moss over the mossy end, thinning out toward the crest and the other end in masses.
            const xAt = (s: number): number => p[0] + ((q[0] - p[0]) * s) / Math.max(0.01, len);
            const pts = mossMass(T, Math.round(len * 14), () => [T() * len, (T() - 0.5) * 6.2], (s, y) => {
              const toward = (xAt(s) * hand.mossSide) / REACH_X;
              return hand.moss * (0.62 + 0.62 * toward) - Math.max(0, Math.abs(y) - 2.4) * 0.25;
            }, lseed + 3, 0.8);
            padsIn(g, k.base, k.e, pts, 0.62);
          } else if (Math.abs(mx) > REACH_X - 2 && Math.abs(up) < 0.4) {
            lichen(g, T, len / 2, (T() - 0.5) * 3, 0.55, hand.lichen);
          }
        },
      };
    };
    const faces = plate({
      o: O, U, W: Wl, A: [0, 1, 0], outline, half, tTop, bevel: 0.75, tone: hand.stone,
      front: face('front'), back: face('back'), frontOver: hang('front'), backOver: hang('back'), edge,
    });
    things.push({ x: 0, y: 0, faces, rank: 1 });
    const A: V3 = [0, 1, 0];
    const fr = { o: at(O, [half[0], A]), a: U, b: at(Wl, [f, A]) };
    const bk = { o: at(O, [-half[0], A]), a: mul(U, -1), b: at(Wl, [-f, A]) };
    frames.set('lfront', { ...fr, n: [0, 1, 0] });
    frames.set('lback', { ...bk, n: [0, -1, 0] });

    // A tuft of grass and a few flowers rooted in the moss on its mossy end.
    for (const [dx, dy, flower] of [[13.4, 0.8, true], [15.2, -1.6, false], [10.8, -0.6, false]] as Array<[number, number, boolean]>) {
      const x = hand.mossSide * dx, y = dy;
      const top = LINTEL_Z + 5.5 + Math.tan(hand.tilt) * x;
      const colour = hand.flowers[0][0];
      const s2 = hand.seed * 77 + Math.round(dx);
      things.push({
        x, y, rank: 2, reach: [[x, y, top + 8]],
        draw: (g, e) => {
          const [px, py] = proj(e, [x, y, top]);
          if (flower) flowerClump(g, px, py, colour, s2, 0.75);
          else grassTuft(g, px, py, s2, 0.8);
        },
      });
    }
  }

  /* -- what has come off it: the chip broken off the lintel's end, lying in the grass in front of the foot, a rune still on it -- */
  {
    const sx = (-hand.mossSide) as -1 | 1;
    const x = sx * (PILLAR_X + 1.5), y = 9.6 + R() * 1.5;
    const piece: Pt[] = [[-2.2, 0], [2.4, 0], [2.0, 2.4], [0.4, 3.1], [-1.9, 2.2]];
    const turn = 0.5 + R();
    const c = Math.cos(turn), s = Math.sin(turn);
    const lean = 1.2;
    const Av: V3 = [c * Math.cos(lean), s * Math.cos(lean), Math.sin(lean)];
    const Wv: V3 = [-c * Math.sin(lean), -s * Math.sin(lean), Math.cos(lean)];
    things.push({
      x, y,
      faces: plate({
        o: [x, y, -0.3], U: [-s, c, 0], W: Wv, A: Av, outline: piece, half: [0.7, 0.6], tTop: 3.1, bevel: 0.3, tone: hand.stone,
        front: (g, k) => {
          cut(g, k.fill, 0.3, () => glyphPath(g, hand.runes.lintel[0], 0.1, 1.4, 0.85));
          lichen(g, rand(hand.seed + 9), -1.1, 1.9, 0.45, hand.lichen);
        },
      }),
    });
  }

  /* -- flowers and grass at the feet and along the threshold, never in the way through and never past the border's ends -- */
  const kinds: string[] = [];
  for (const [c, k] of hand.flowers) for (let i = 0; i < k; i++) kinds.push(c);
  const tuft = (x: number, y: number, z: number, flower: boolean, big: number): void => {
    if (Math.abs(x) + 4.6 * big > REACH_X) return;
    const colour = kinds[Math.floor(R() * kinds.length)];
    const seed = hand.seed * 1000 + things.length;
    things.push({
      x, y, reach: [[x, y, z + 10]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, z]);
        if (flower) flowerClump(g, px, py, colour, seed, big);
        else grassTuft(g, px, py, seed, big);
      },
    });
  };
  /*
   * At each foot, in front and behind, and either side of the threshold: a
   * clump's leaves and heads spread about four units either way of its root,
   * so every root is that far inside the border's end, where a wall run up to
   * the gate would stand over anything further out.
   */
  for (const side of [-1, 1]) {
    const cx = side * PILLAR_X;
    for (const sy of [-1, 1]) {
      tuft(cx - side * (0.5 + R() * 1.5), sy * (7.6 + R() * 1.2), 0, side === hand.mossSide || R() < 0.4, 0.95 + R() * 0.15);
      tuft(cx - side * (3.5 + R() * 2), sy * (7 + R() * 1.5), 0, false, 0.95 + R() * 0.2);
      tuft(cx - side * (1.5 + R() * 2), sy * (10 + R() * 1.6), 0, R() < 0.5, 0.85 + R() * 0.2);
    }
  }
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) tuft(sx * (5 + R() * 3.5), sy * (5.4 + R() * 1.1), 0, false, 0.85);

  /* -- the turf it stands in: a ragged band along the border, a little past the feet -- */
  const turf: Pt[] = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * TAU;
    const r = 1 + (R() - 0.5) * 0.12;
    return [Math.cos(a) * 25 * r, Math.sin(a) * 12 * r] as Pt;
  });

  const model: Model = { hand, things, frames, runes, turf, top: climb + 1 };
  models.set(variant, model);
  return model;
}

/* ---- baking ------------------------------------------------------------------ */

/** A rune's light, baked, with its turn in the climb. */
type GateGlow = Omit<Glow, 'i' | 'roundel'> & { o: number; roundel: boolean };

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What it covers from the middle of the border, in pixels at zoom one: left, top, right, bottom. */
  bounds: [number, number, number, number];
  glows: GateGlow[];
  /** The opening on the screen at zoom one, for the motes: its foot's middle, how far across a unit takes you, and how high. */
  opening: { x: number; y: number; ux: number; uy: number };
}

const BAKED_BUDGET = 12e6;
const baked = new Map<string, Baked>();
let bakedArea = 0;

/** How a gate's frame turns in the world: across a border running east and west, or one running north and south. */
const yawOf = (dir: 'h' | 'v'): number => (dir === 'h' ? 0 : Math.PI / 2);

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
  const pad = 8;
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function bake(dir: 'h' | 'v', rotation: number, variant: number, scale: number): Baked {
  const model = modelOf(variant);
  const e = eyeOf(yawOf(dir), rotation);
  const [x0, y0, x1, y1] = measure(model, e);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  const base = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  g.setTransform(base);

  /* -- the turf, a flat field of moss green, ragged at its edge; and the shade thrown away from the light -- */
  const ring = (k: number): void => {
    g.beginPath();
    model.turf.forEach(([x, y], i) => {
      const [px, py] = proj(e, [x * k, y * k, 0]);
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    });
    g.closePath();
  };
  ring(0.8);
  g.fillStyle = 'rgba(118, 156, 122, 0.32)';
  g.fill();
  {
    const F = rand(model.hand.seed * 991 + 7);
    const across = Math.hypot(e.ux, e.uy);
    for (let i = 0; i < 46; i++) {
      const q = model.turf[Math.floor(F() * model.turf.length)];
      const k = 0.7 + F() * 0.3;
      const [px, py] = proj(e, [q[0] * k + (F() - 0.5) * 3, q[1] * k + (F() - 0.5) * 2, 0]);
      const r = (0.8 + F() * 1.6) * across;
      g.fillStyle = `rgba(118, 156, 122, ${(0.3 * (1.2 - k)).toFixed(3)})`;
      g.beginPath();
      g.ellipse(px, py, r, r * 0.5, 0, 0, TAU);
      g.fill();
    }
  }
  {
    // Each pillar's shade and the lintel's, flat and cool, thrown down and to the right of the screen as every shade on the island is.
    g.fillStyle = 'rgba(44, 74, 78, 0.16)';
    for (const side of [-1, 1]) {
      const [sx, sy] = proj(e, [side * PILLAR_X, 0, 0]);
      g.beginPath();
      g.ellipse(sx + 9, sy + 3, 17, 7, 0.12, 0, TAU);
      g.fill();
    }
  }

  /* -- everything standing, in order: what lies flat first, then by where it stands, the lintel last -- */
  const rank = (t: GateThing): number => t.rank ?? 0;
  const things = model.things.slice().sort((a, b) => rank(a) - rank(b) || groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y));
  for (const t of things) {
    if (t.draw) t.draw(g, e);
    else if (t.faces) drawFaces(g, e, t.faces, 0.8);
  }

  /* -- each rune's light, for the faces the eye sees -- */
  const glows: GateGlow[] = [];
  for (const [key, fr] of model.frames) {
    if (dot(fr.n, e.toward) <= 1e-6) continue;
    const [ox, oy] = proj(e, fr.o), [ax, ay] = proj(e, fr.a), [bx, by] = proj(e, fr.b);
    // The frame's own axes on the screen: `a` and `b` are directions, so their projection is from the origin.
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    for (const r of model.runes) {
      if (r.face !== key) continue;
      glows.push({ ...glowOf(M, r, scale, r.roundel ? 0.55 : 0.68), o: r.o, roundel: !!r.roundel });
    }
  }
  const [mx, my] = proj(e, [0, 0, 0]);
  const [ux, uy] = proj(e, [1, 0, 0]);
  return { canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], glows, opening: { x: mx, y: my, ux: ux - mx, uy: uy - my } };
}

function bakedFor(dir: 'h' | 'v', rotation: number, variant: number, zoom: number): Baked {
  const scale = scaleFor(zoom);
  const key = `${dir}|${((rotation % 8) + 8) % 8}|${variant}|${scale}`;
  let b = baked.get(key);
  if (b) {
    baked.delete(key);
    baked.set(key, b);
    return b;
  }
  b = bake(dir, rotation, variant, scale);
  baked.set(key, b);
  bakedArea += b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= old.canvas.width * old.canvas.height;
  }
  return b;
}

/* ---- the light ----------------------------------------------------------------- */

/** Seconds to a breath of the runes while lit, and how far behind the one under it each breathes, in turns. */
const BREATH = 3.6;
const STAGGER = 0.12;
/** Motes rising through the opening while it is lit: how many, and the seconds each takes to rise. */
const MOTES = 6;
const MOTE_RISE = 3.2;

/** Which of the gate's hands a border has: the same one every time it is drawn. */
export const gateVariant = (dir: 'h' | 'v', x: number, y: number): number => Math.floor(hashOf(x, y, dir === 'h' ? 1 : 2, 4127) * VARIANTS.length) % VARIANTS.length;

/** How lit each rune is: `lit` of the way, once the climb has reached its step, and breathing while it holds. */
function runeLit(gl: GateGlow, lit: number, since: number, rise: number, top: number, t: number): number {
  if (lit <= 0) return 0;
  const start = (gl.o / (top + 1)) * rise;
  const up = Math.max(0, Math.min(1, (since - start) / Math.max(0.05, rise / (top + 1))));
  const p = 0.5 + 0.5 * Math.sin((t / BREATH - gl.o * STAGGER) * TAU);
  return lit * up * up * (3 - 2 * up) * (0.8 + 0.2 * p);
}

/** Where the motes are at `t`: rising through the opening from the threshold to the lintel, swaying, fading in and out. */
function motesAt(b: Baked, t: number, zoom: number): Array<{ x: number; y: number; a: number; r: number }> {
  const { x, y, ux, uy } = b.opening;
  const out: Array<{ x: number; y: number; a: number; r: number }> = [];
  for (let i = 0; i < MOTES; i++) {
    const u = ((t / (MOTE_RISE + i * 0.37) + i * 0.41) % 1 + 1) % 1;
    const z = 1.5 + u * (LINTEL_Z - 3);
    const across = Math.sin(u * TAU * 0.9 + i * 2.1) * 6.5 + (((i * 0.618) % 1) - 0.5) * 6;
    out.push({
      x: x + ux * across, y: y + uy * across - z * 2.25,
      a: Math.pow(Math.sin(Math.PI * u), 1.3),
      r: (0.9 + 0.4 * ((i * 0.618) % 1)) * zoom ** 0.75,
    });
  }
  return out;
}

/** What a gate drawn this frame leaves for the renderer: its picture and where it went, and its night shapes as at (x, y). */
export interface GateDrawn {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  /** What its light covers, left, top, right, bottom on the screen, or null when it is dark. */
  lightBox: [number, number, number, number] | null;
  holes: (x: number, y: number) => NightHole[];
  masks: (x: number, y: number) => NightMask[];
}

/**
 * Draw a rune gate with the middle of its border at (sx, sy) on the screen,
 * the border running `dir`, from viewpoint `rotation`, in hand `variant`;
 * `lit` of the way lit, `since` seconds after it was lit from dark (the
 * climb is timed from that, over `rise`), under a night `night` dark, at `t`
 * seconds for the breath and the motes.
 */
export function drawRuneGate(ctx: CanvasRenderingContext2D, sx: number, sy: number, zoom: number, dir: 'h' | 'v', rotation: number, variant: number,
  lit: number, since: number, rise: number, night: number, t: number): GateDrawn {
  const b = bakedFor(dir, rotation, variant, zoom);
  const model = modelOf(variant);
  const k = zoom / b.scale;
  const X0 = sx - b.ox * k, Y0 = sy - b.oy * k, W = b.canvas.width * k, H = b.canvas.height * k;
  ctx.drawImage(b.canvas, X0, Y0, W, H);
  const out: GateDrawn = { img: b.canvas, x: X0, y: Y0, w: W, h: H, lightBox: null, holes: () => [], masks: () => [] };
  if (lit <= 0.001) return out;
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  const day = 1 - night;
  const each = b.glows.map((gl) => runeLit(gl, lit, since, rise, model.top, t));
  b.glows.forEach((gl, i) => {
    const q = each[i];
    if (q <= 0.002) return;
    const [x, y, w, h] = gl.box;
    const Xg = sx + x * zoom, Yg = sy + y * zoom, Wg = w * zoom, Hg = h * zoom;
    if (day > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, day * q * 0.85 * (gl.roundel ? 0.75 : 1) * gl.square);
      ctx.drawImage(gl.halo, Xg, Yg, Wg, Hg);
    }
    if (night > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, night * q * (gl.roundel ? 0.24 : 0.28));
      ctx.drawImage(gl.dusk, Xg, Yg, Wg, Hg);
    }
    ctx.globalCompositeOperation = 'source-over';
    // The lit groove: by day a little light added over it as well; after dark only the groove, so each rune stays its own shape.
    ctx.globalAlpha = Math.min(1, q * (0.85 - 0.2 * night));
    ctx.drawImage(gl.core, Xg, Yg, Wg, Hg);
    if (!gl.roundel && day > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1 * day * q;
      ctx.drawImage(gl.core, Xg, Yg, Wg, Hg);
    }
  });
  const motes = motesAt(b, t, zoom).map((m) => ({ ...m, a: m.a * lit }));
  for (const m of motes) {
    const px = sx + m.x * zoom, py = sy + m.y * zoom;
    const a = m.a * (0.35 + 0.65 * night);
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
  let L = Infinity, T = Infinity, Rr = -Infinity, B = -Infinity;
  for (const gl of b.glows) {
    const [x, y, w, h] = gl.box;
    L = Math.min(L, sx + x * zoom, sx + (gl.cx - gl.r * 1.5) * zoom); T = Math.min(T, sy + y * zoom, sy + (gl.cy - gl.r * 1.5) * zoom);
    Rr = Math.max(Rr, sx + (x + w) * zoom, sx + (gl.cx + gl.r * 1.5) * zoom); B = Math.max(B, sy + (y + h) * zoom, sy + (gl.cy + gl.r * 1.5) * zoom);
  }
  for (const m of motes) {
    L = Math.min(L, sx + m.x * zoom - 6); Rr = Math.max(Rr, sx + m.x * zoom + 6);
    T = Math.min(T, sy + m.y * zoom - 6); B = Math.max(B, sy + m.y * zoom + 6);
  }
  if (Rr > L && B > T) out.lightBox = [L, T, Rr, B];
  out.holes = (x0, y0) => {
    const hs: NightHole[] = [];
    b.glows.forEach((gl, i) => {
      if (each[i] > 0.002) hs.push({ x: x0 + gl.cx * zoom, y: y0 + gl.cy * zoom, r: gl.r * 1.1 * zoom, a: 0.05 * each[i] });
    });
    for (const m of motes) hs.push({ x: x0 + m.x * zoom, y: y0 + m.y * zoom, r: m.r * 2.2, a: 0.8 * m.a });
    return hs;
  };
  out.masks = (x0, y0) => b.glows.flatMap((gl, i) => {
    if (each[i] <= 0.002) return [];
    const [x, y, w, h] = gl.box;
    return [{ canvas: gl.mask, x: x0 + x * zoom, y: y0 + y * zoom, w: w * zoom, h: h * zoom, a: Math.min(1, (gl.roundel ? 0.55 : 0.6) * each[i]) }];
  });
  return out;
}

/** What a rune gate is clicked by, from the middle of its border, in pixels at zoom one: its pillars and lintel, not the grass round it. */
export function runeGateBounds(dir: 'h' | 'v', rotation: number, variant: number): [number, number, number, number] {
  const model = modelOf(variant);
  return measure(model, eyeOf(yawOf(dir), rotation));
}

