import { hashOf, rand } from './ivy';
import {
  add, area2, at, boulder, canvasOf, css, cushion, cut, dot, drawFaces, drawPads, eyeOf, flowerClump, glowOf, glyphPath, grassTuft, groundNear,
  hex, lichen, mix, mul, newell, noise2, plate, proj, roundelStrokes, scaleFor, strokesPath, TAU, toneOf,
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
const FOOT_TOP = 3.0;
/** How tall a pillar stands over its foot stone, and so where the lintel's underside is. */
const PILLAR_H = 26.4;
const LINTEL_Z = FOOT_TOP + PILLAR_H - 0.6;
/** How far a rune's middle is from its top, on a pillar's panel and on the lintel. */
const RUNE_S = 1.75;
const LINTEL_RUNE_S = 1.35;
/** And the rune down each pillar's outer end. */
const END_RUNE_S = 1.6;
/** Nothing of it stands further than this from the middle of the border along it: a hair inside the tile's corner. */
const REACH_X = 19.6;
/** Half a pillar's breadth at its foot, at its hand's girth one. */
const PILLAR_FOOT = 4.15;
/** Units to a tile. */
const TILE = 40;

/**
 * The opening, in tiles, for the renderer to draw whoever stands in it
 * between the gate's two pictures: `half` from the middle of the border to
 * a pillar's inner face at its foot, `body` the breadth of a body short of
 * that, and `depth` how far through the gate either way the pillars and the
 * planting at their feet stand -- anyone further off is wholly behind them
 * or wholly in front.
 */
export const RUNE_GATE_OPENING = { half: (PILLAR_X - PILLAR_FOOT) / TILE, body: 0.03, depth: 8 / TILE };

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
  /** How wide each pillar's head is against its foot, left then right: no two drawn in alike. */
  taper: [number, number];
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
    stone: toneOf('#eee4d0', '#aa9fac'), rock: toneOf('#dcd1bf', '#9d95a5'), lichen: ['#b8bfa4', '#c2bc9f'],
    lean: [[0.045, 0.004], [-0.04, -0.003]], tilt: 0.011, girth: [1, 0.87], taper: [0.79, 0.87], mossSide: 1, moss: 0.72,
    runes: { front: [['othala', 'algiz', 'dagaz'], ['ingwaz', 'tiwaz', 'diamondDot']], back: [['tiwaz', 'ring', 'algiz'], ['dagaz', 'othala', 'star6']], lintel: ['algiz', 'othala'], ends: ['tiwaz', 'ingwaz'] },
    roundel: 'key', flowers: [['white', 4], ['yellow', 2], ['pink', 2]], seed: 101,
  },
  {
    stone: toneOf('#e6e4d6', '#a2a4b0'), rock: toneOf('#d4d2c4', '#999ba8'), lichen: ['#b3bea6', '#bfc2a6'],
    lean: [[0.04, -0.004], [-0.05, 0.003]], tilt: -0.013, girth: [0.88, 1], taper: [0.86, 0.78], mossSide: -1, moss: 0.85,
    runes: { front: [['laguz', 'ingwaz', 'algiz'], ['othala', 'dagaz', 'crescent']], back: [['diamond', 'tiwaz', 'laguz'], ['algiz', 'ingwaz', 'ring']], lintel: ['tiwaz', 'algiz'], ends: ['othala', 'dagaz'] },
    roundel: 'eye', flowers: [['lilac', 3], ['blue', 2], ['white', 3]], seed: 211,
  },
  {
    stone: toneOf('#f2e0cf', '#b29fa9'), rock: toneOf('#e0d1bd', '#a596a3'), lichen: ['#c4bb98', '#b6bea2'],
    lean: [[0.05, 0.002], [-0.042, -0.004]], tilt: 0.008, girth: [1, 0.86], taper: [0.8, 0.88], mossSide: 1, moss: 0.6,
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
function pillarOutline(R: () => number, out: -1 | 1, kind: number, H: number, girth: number, taper: number): Pt[] {
  const j = (k: number): number => (R() - 0.5) * k;
  /*
   * Up the outer side and down the inner, as `s` across from the inner side
   * to the outer: the foot widest, a swell a third of the way up, drawing in
   * to the head, and every point off the true line by a little -- a side
   * dressed by eye, not ruled.
   */
  const top = H * 0.86;
  const side = (w0: number, w1: number, us: readonly number[], up: boolean): Pt[] => us.map((_, i) => {
    const u = up ? us[i] : us[us.length - 1 - i];
    const t = top * u;
    const w = w0 + (w1 - w0) * u + 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.6)) + j(0.3);
    return [w, t] as Pt;
  });
  const foot = PILLAR_FOOT * girth, head = foot * taper;
  // The outer side runs straight through its middle, a long face for the end rune's panel.
  // Two arrises up the outer side, the end rune's long face between them, and one up the inner, each at its own height.
  const outer = side(foot, head, [0, 0.2 + 0.1 * R(), 0.74 + 0.1 * R(), 1], true);
  const inner = side(foot * 0.98, head * 1.02, [0, 0.32 + 0.3 * R(), 1], false).map(([w, t]) => [-w, t] as Pt);
  const hw = head + 0.05;
  const crown: Pt[] = kind === 0
    // The outer shoulder cut back on a slant, the cut under the lintel's overhang.
    ? [[hw - 0.1, H - 3.2], [hw - 1.5, H - 1.0], [hw - 1.6, H + 0.15], [0.3 + j(0.3), H + 0.3], [-hw + 0.2, H + 0.1]]
    : [[hw - 0.15, H + 0.05], [0.6 + j(0.3), H + 0.3], [-hw + 0.2, H + 0.15]];
  const pts = [...outer, ...crown, ...inner];
  // `s` runs from the inner side to the outer: as the model's `x`, that is the way `out` says.
  return pts.map(([s2, t]) => [s2 * out, t] as Pt);
}

/**
 * The lintel's crest: three flat planes cut over the roundel -- a shoulder
 * either side at one slope, rising `rise` from the slab's top to a short flat
 * top -- its ridge `c` off the middle, toward the dry end.
 */
const SLAB_TOP = 5.5;
const CREST = { foot: 6.0, top: 2.6, rise: 1.9 };
/** The lintel's outline, across the gate and up from its underside: a slab, the crest over its middle a little off centre, and one end chipped. */
function lintelOutline(R: () => number, chip: -1 | 1, c: number): Pt[] {
  const j = (k: number): number => (R() - 0.5) * k;
  const E = REACH_X - 0.1;
  const T = SLAB_TOP, H = SLAB_TOP + CREST.rise;
  const pts: Pt[] = [
    [-E + 0.6, 0.6 + j(0.3)], [-E + 1.8 + j(0.4), -0.05], [-7, -0.2], [0, -0.05], [7, -0.15], [E - 1.7 + j(0.4), 0], [E - 0.2, 0.7 + j(0.3)],
    [E, 3.2 + j(0.3)], [E - 0.5, 4.9], [E - 2.2, T + j(0.15)], [c + CREST.foot, T], [c + CREST.top, H], [c - CREST.top, H],
    [c - CREST.foot, T], [-E + 2.3, T + j(0.15)], [-E + 0.3, 4.6], [-E, 2.6 + j(0.3)],
  ];
  // A corner broken off one end, along the top: the end steps down in two facets.
  return pts.map(([x, z]) => {
    if (x * chip > E - 3.2 && z > 3.2) return [x - chip * (z - 3.2) * 0.55, z - (x * chip > E - 1 ? 1.1 : 0.4)] as Pt;
    return [x, z] as Pt;
  });
}
/** The roundel in the crest, across from the ridge: as high and as big as the flat top over it allows. */
const LINTEL_ROUNDEL = { z: 4.4, r: 2.15 };

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
  // Grit, as the Runestones' is and in their colour, sparser, more toward the foot.
  g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.5);
  for (let i = 0; i < 26; i++) {
    const z = Math.pow(T(), 1.6) * tall, [a, b] = xs(z);
    g.fillRect(a + T() * (b - a), z, 0.5 + T() * 0.3, 0.5 + T() * 0.3);
  }
  // Two or three spalls, where a flake has come away: a shallow scar a step paler, its broken upper edge dark.
  for (let i = 0, n = 2 + (T() < 0.5 ? 1 : 0); i < n; i++) {
    const z = tall * (0.15 + 0.7 * T()), [a, b] = xs(z);
    const x = a + 1 + T() * Math.max(0, b - a - 2), rx = 1.1 + T() * 0.5, rz = 0.8 + T() * 0.35, k = 7;
    const pts: Pt[] = Array.from({ length: k }, (_, j) => {
      const q = (j / k) * TAU, w = 0.75 + T() * 0.4;
      return [x + Math.cos(q) * rx * w, z + Math.sin(q) * rz * w] as Pt;
    });
    g.beginPath();
    pts.forEach(([px, pz], j) => (j ? g.lineTo(px, pz) : g.moveTo(px, pz)));
    g.closePath();
    g.fillStyle = css(mix(fill, [255, 250, 238], 0.45), 0.85);
    g.fill();
    g.beginPath();
    for (let j = 0; j <= k / 2; j++) {
      const [px, pz] = pts[j % k];
      if (j) g.lineTo(px, pz); else g.moveTo(px, pz);
    }
    g.strokeStyle = css(mix(fill, hex('#5d5464'), 0.55), 0.85);
    g.lineWidth = 0.4;
    g.stroke();
  }
  // Pits weathered into it: a dark hollow and the lit lip below it.
  for (let i = 0; i < 6; i++) {
    const z = T() * tall * 0.95, [a, b] = xs(z);
    const x = a + 0.5 + T() * Math.max(0, b - a - 1), r = 0.22 + T() * 0.22;
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

/** The ivy's greens, as the Runestones' leaves are laid: the rim round every leaf, three fills, and the lit edge. */
const IVY = { rim: '#3d6a4c', fills: ['#4f7a5f', '#5e9165', '#6f9c7c'], lit: 'rgba(176, 214, 158, 0.9)', stem: '#4a5a40', stemLit: '#71805a' };

/**
 * One ivy leaf on the screen, as the Runestones' are: a heart hanging from
 * its stalk at (x, y), `w` pixels across, turned `ang` off straight down
 * (more than nought swings its tip to the right), in fill `tone` of `IVY`,
 * with a lighter rim along one lobe and its midrib.
 */
function ivyLeaf(g: CanvasRenderingContext2D, x: number, y: number, w: number, ang: number, tone: number, lit: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(-ang);
  // The heart's path is about 1.25 across at size one.
  const k = w / 1.25;
  g.scale(k, -k);
  const heart = (): void => {
    g.beginPath();
    g.moveTo(0, -0.08);
    g.bezierCurveTo(0.32, 0.18, 0.72, 0.05, 0.6, -0.36);
    g.bezierCurveTo(0.5, -0.68, 0.16, -0.92, 0, -1.12);
    g.bezierCurveTo(-0.16, -0.92, -0.5, -0.68, -0.6, -0.36);
    g.bezierCurveTo(-0.72, 0.05, -0.32, 0.18, 0, -0.08);
    g.closePath();
  };
  heart();
  g.fillStyle = IVY.rim;
  g.fill();
  g.save();
  g.scale(0.82, 0.84);
  g.translate(0, -0.08);
  heart();
  g.fillStyle = IVY.fills[tone];
  g.fill();
  g.restore();
  if (lit) {
    g.beginPath();
    g.moveTo(-0.1, -0.16);
    g.bezierCurveTo(-0.34, 0.02, -0.6, -0.08, -0.5, -0.38);
    g.bezierCurveTo(-0.44, -0.6, -0.22, -0.78, -0.08, -0.94);
    g.strokeStyle = IVY.lit;
    g.lineWidth = 0.11;
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, -0.12);
  g.lineTo(0, -0.9);
  g.strokeStyle = 'rgba(38, 72, 50, 0.55)';
  g.lineWidth = 0.06;
  g.stroke();
  g.restore();
}

/**
 * A strand of ivy as a thing of the model: a stem through `stem` (points on
 * the stone, root first) and `n` leaves along it, alternating sides, each
 * stalk set off the stem along `off` (a direction in the stone's face), the
 * leaves from `big` units across at the root down to `small` at the tip, in
 * the three greens. Drawn upright on the screen at the island's scale, as
 * the moss's cushions and the flowers are -- a pillar's faces are narrow
 * and seen slantwise, and painted into one a leaf would be squeezed to a
 * sliver -- so at any zoom a leaf is the size of a Runestone's, and stone
 * shows between them. Shown only while `seen` says its face is in view.
 */
function ivyStrand(stem: V3[], n: number, off: V3, big: number, small: number, seed: number, rank: number, seen: (e: Eye) => boolean): GateThing {
  const L = rand(seed);
  // Where along the stem each leaf is, and its side, tone, turn and size.
  const total = stem.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - stem[i][0], p[1] - stem[i][1], p[2] - stem[i][2]), 0);
  const pointAt = (d: number): V3 => {
    let left = d;
    for (let i = 1; i < stem.length; i++) {
      const a = stem[i - 1], b = stem[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (left <= l || i === stem.length - 1) {
        const u = Math.min(1, left / Math.max(1e-6, l));
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      }
      left -= l;
    }
    return stem[stem.length - 1];
  };
  const leaves = Array.from({ length: n }, (_, i) => {
    const u = (i + 0.4 + (L() - 0.5) * 0.3) / n;
    const side = i % 2 ? 1 : -1;
    const p = pointAt(u * total);
    const w = big + (small - big) * u + (L() - 0.5) * 0.3;
    return { p, side, w, reach: 0.38 * w, tone: Math.floor(L() * 3), turn: 0.45 + L() * 0.45, lit: L() < 0.5 };
  });
  const lo = Math.min(...stem.map((p) => p[2])), hi = Math.max(...stem.map((p) => p[2]));
  const xs = stem.map((p) => p[0]), ys = stem.map((p) => p[1]);
  return {
    x: stem[0][0], y: stem[0][1], rank,
    reach: [[Math.min(...xs) - big, Math.min(...ys) - big, lo - big], [Math.max(...xs) + big, Math.max(...ys) + big, hi + big]],
    draw: (g, e) => {
      if (!seen(e)) return;
      const across = Math.hypot(e.ux, e.uy);
      const pts = stem.map((p) => proj(e, p));
      // Which way the stalks go off the stem on the screen: along the face, and never less than a little either side.
      const [ox, oy] = proj(e, off), [zx, zy] = proj(e, [0, 0, 0]);
      let sx = ox - zx, sy = oy - zy;
      const sl = Math.hypot(sx, sy);
      if (sl < 0.35 * across) { sx = 0.35 * across; sy = 0; } else { sx *= 1 / Math.max(1, sl / across); sy *= 1 / Math.max(1, sl / across); }
      const right = sx >= 0 ? 1 : -1;
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const [col, wd] of [[IVY.stem, 0.42], [IVY.stemLit, 0.22]] as Array<[string, number]>) {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = col;
        g.lineWidth = Math.max(1, wd * across);
        g.stroke();
      }
      for (const lf of leaves) {
        const [px, py] = proj(e, lf.p);
        const lx = px + sx * lf.side * lf.reach, ly = py + sy * lf.side * lf.reach;
        // The stalk.
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(lx, ly);
        g.strokeStyle = IVY.stem;
        g.lineWidth = Math.max(0.8, 0.16 * across);
        g.stroke();
        const toRight = lf.side * right;
        ivyLeaf(g, lx, ly, lf.w * across, toRight * lf.turn, lf.tone, toRight < 0 === lf.lit);
      }
      g.restore();
    },
  };
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
        // Laid flush, its top 0.04 m over the turf: whoever stands on it stands on the ground.
        o: [0, 0, -0.1], U: [1, 0, 0], W: [0, 1, 0], A: [0, 0, 1], outline: out, half: [0.5, 0.5], tTop: 1, bevel: 0.35, tone: hand.rock,
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
          // Moss along the ends, where nobody treads.
          const pts: Array<[number, number, number]> = [];
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
      return [fx + Math.cos(a) * 4.55 * r, Math.sin(a) * 7.0 * r] as Pt;
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
    const outline = pillarOutline(R, side, (li + hand.seed) % 2, PILLAR_H + Math.tan(hand.tilt) * cx, hand.girth[li], hand.taper[li])
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
    const panel = { w: 4.6, z0: 2.8, z1: 20.0, arch: 2.4 };
    const face = (which: 'front' | 'back'): { paint: Painter } => {
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
        // Drilled dots between the two rules, all the way round: a dark hollow and its lit lip.
        for (let z = panel.z0 + 1.4; z < panel.z1 - 0.2; z += 1.5) {
          for (const sx of [-1, 1]) {
            g.beginPath();
            g.arc(sx * (hw - 0.38), z, 0.2, 0, TAU);
            g.fillStyle = css(mix(fill, hex('#5d5464'), 0.45), 0.7);
            g.fill();
            g.beginPath();
            g.arc(sx * (hw - 0.38) + 0.06, z - 0.1, 0.11, 0, TAU);
            g.fillStyle = css(mix(fill, [255, 252, 244], 0.6), 0.6);
            g.fill();
          }
        }
        for (const r of runes) if (r.face === key) cut(g, fill, 0.55, () => glyphPath(g, r.glyph, r.x, r.z, r.s));
        // A band cut across the head, where the lintel comes down on it.
        const zb = tTop - 3.4;
        cut(g, fill, 0.32, () => { g.beginPath(); g.moveTo(xs(zb)[0] + 0.5, zb); g.lineTo(xs(zb)[1] - 0.5, zb + 0.1); });
        // One hairline crack on one broad face of each pillar, the left's front and the right's back, in from the outer edge and down toward the foot.
        {
          const z0 = tTop * (0.28 + 0.2 * T()), [a, b] = xs(z0);
          let x = outer > 0 ? b : a, z = z0, ang = outer > 0 ? Math.PI + 0.45 : -0.45;
          const pts: Pt[] = [[x, z]];
          for (let i = 0; i < 9; i++) {
            ang += (T() - 0.5) * 0.7;
            // Never into the panel: it turns down along its edge.
            const nx = x + Math.cos(ang) * 0.6;
            if (Math.abs(nx) < hw + 0.5) ang = -Math.PI / 2 + (T() - 0.5) * 0.4;
            x += Math.cos(ang) * 0.6;
            z += Math.sin(ang) * 0.6;
            pts.push([x, z]);
          }
          if (which === (li === 0 ? 'front' : 'back')) {
            // One unbroken dark hairline, and the pale lip of stone over it.
            const line = (): void => { g.beginPath(); pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz))); };
            g.lineCap = 'round';
            g.lineJoin = 'round';
            g.save();
            g.translate(0.2, 0.32);
            line();
            g.strokeStyle = css(mix(fill, [255, 250, 238], 0.7), 0.9);
            g.lineWidth = 0.34;
            g.stroke();
            g.restore();
            line();
            g.strokeStyle = css(mix(fill, hex('#463d50'), 0.7), 1);
            g.lineWidth = 0.5;
            g.stroke();
          }
        }
        // One chip off the outer arris of the front, at its own height on each pillar: a fresh pale break and its shadowed lip.
        if (which === 'front') {
          const zc = tTop * (li === 0 ? 0.3 : 0.62), [a, b] = xs(zc);
          const ex = outer > 0 ? b : a;
          const chip: Pt[] = [[ex + outer * 0.3, zc - 2.4], [ex - outer * 2.0, zc - 0.8], [ex - outer * 1.7, zc + 0.9], [ex - outer * 0.4, zc + 1.6], [ex + outer * 0.3, zc + 1.7]];
          g.beginPath();
          chip.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz)));
          g.closePath();
          // The fresh break: paler than the weathered face round it, and its far edge in shadow.
          g.fillStyle = css(mix(fill, [255, 251, 242], 0.7), 1);
          g.fill();
          g.beginPath();
          g.moveTo(chip[0][0], chip[0][1]);
          g.lineTo(chip[1][0], chip[1][1]);
          g.lineTo(chip[2][0], chip[2][1]);
          g.lineTo(chip[3][0], chip[3][1]);
          g.strokeStyle = css(mix(fill, hex('#463d50'), 0.65), 0.95);
          g.lineWidth = 0.45;
          g.lineJoin = 'round';
          g.stroke();
        }
        /* -- lichen on the upper half, outside the panel -- */
        for (let i = 0; i < 2; i++) {
          const z = tTop * (0.3 + 0.55 * T()), [a, b] = xs(z);
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
      return { paint };
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
    const endAt = tTop * 0.47;
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
          g.fillStyle = css(mix(k.fill, hex('#6d6274'), 0.5), 0.5);
          for (let j = 0; j < len * 0.6; j++) g.fillRect(T() * len, (T() - 0.5) * 2 * G, 0.5 + T() * 0.3, 0.5 + T() * 0.3);
          if (len > 10 && Math.abs(up) < 0.3) {
            // A spall: a flake gone, its scar a step paler, its broken edge dark.
            const sx = len * (0.3 + 0.4 * T()), sy = (T() - 0.5) * G, rx = 1.2 + T() * 0.5, ry = 0.9 + T() * 0.4;
            const pts: Pt[] = Array.from({ length: 7 }, (_, j) => {
              const q = (j / 7) * TAU, w = 0.75 + T() * 0.4;
              return [sx + Math.cos(q) * rx * w, sy + Math.sin(q) * ry * w] as Pt;
            });
            g.beginPath();
            pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py)));
            g.closePath();
            g.fillStyle = css(mix(k.fill, [255, 250, 238], 0.45), 0.85);
            g.fill();
            g.beginPath();
            for (let j = 0; j <= 3; j++) { const [px, py] = pts[j]; if (j) g.lineTo(px, py); else g.moveTo(px, py); }
            g.strokeStyle = css(mix(k.fill, hex('#5d5464'), 0.55), 0.85);
            g.lineWidth = 0.4;
            g.stroke();
          }
          if (i === endI && endRune) {
            // The end rune, upright on the face, in a sunk panel with a pointed head ruled twice round, as the broad faces' are.
            g.save();
            g.transform(0, endRune.hand, endRune.dir, 0, endRune.s, 0);
            const pw = END_RUNE_S * 1.35, z0 = -END_RUNE_S * 2.1, z1 = END_RUNE_S * 1.45, arch = END_RUNE_S * 0.9;
            const border = (d: number): void => {
              const top = z1 + arch - d * 0.4;
              g.beginPath();
              g.moveTo(-pw + d, z0 + d);
              g.lineTo(-pw + d, z1);
              g.quadraticCurveTo(-pw + d, z1 + (top - z1) * 0.7, 0, top);
              g.quadraticCurveTo(pw - d, z1 + (top - z1) * 0.7, pw - d, z1);
              g.lineTo(pw - d, z0 + d);
              g.closePath();
            };
            border(0.5);
            g.fillStyle = css(mix(k.fill, hex('#a39aac'), 0.42), 0.55);
            g.fill();
            cut(g, k.fill, 0.36, () => border(0));
            cut(g, k.fill, 0.26, () => border(0.5));
            const rr = runes.find((r) => r.face === `${li}end`);
            if (rr) cut(g, k.fill, 0.5, () => glyphPath(g, rr.glyph, 0, 0, END_RUNE_S));
            g.restore();
          }
          // A soft drift in tone along a side, darker toward the foot: one face, dressed as one.
          if (Math.abs(up) < 0.6) {
            const lowEnd = dz >= 0 ? 0 : len;
            const gr = g.createLinearGradient(lowEnd, 0, len - lowEnd, 0);
            gr.addColorStop(0, css(mix(k.fill, hex('#8c8a94'), 0.35), 0.28));
            gr.addColorStop(1, css(mix(k.fill, [255, 252, 244], 0.5), 0.16));
            g.fillStyle = gr;
            g.fillRect(-1, -40, len + 2, 80);
          }
          let pts: Array<[number, number, number]> = [];
          // A head is under the lintel: nothing grows on it.
          if (up > 0.35) {
            // (bare)
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
      o: O, U: [1, 0, 0], W, A: [0, 1, 0], outline, half, tTop, bevel: 1.4, tone: hand.stone,
      front: front.paint, back: back.paint, edge, sunk: true, edgeCrease: 0.05,
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
    if (mossy) {
      /*
       * Ivy up the jamb, the face to the opening, from the foot nearly to the
       * head, wandering a little, its leaves either side of it across the
       * jamb (no panel on it). Seen while the jamb is, or near enough edge on
       * that it shows down the pillar's inner edge.
       */
      const [lo, hi] = widthAt(0.5);
      const jx = cx + (side < 0 ? hi : lo) - side * 0.2;
      const nJamb: V3 = [-side, 0, 0];
      const seenJamb = (e: Eye): boolean => dot(nJamb, e.toward) > -0.05;
      const climbStem = (y0: number, top: number, sd: number): V3[] => {
        const W2 = rand(sd);
        return Array.from({ length: 9 }, (_, i) => {
          const z = FOOT_TOP + 0.6 + (top * i) / 8;
          // Up the pillar's lean as it goes.
          return [jx + lx * (z - FOOT_TOP) - side * 0.02 * z, y0 + Math.sin(i * 1.3 + W2() * 2) * 0.5 + ly * (z - FOOT_TOP), z] as V3;
        });
      };
      // Its leaves as big on the screen as a Runestone's: about 4.8 units across at the root.
      things.push(ivyStrand(climbStem(-0.8, tTop * 0.84, seed + 41), 12, [0, 1, 0], 4.8, 3.9, seed + 43, 0.5, seenJamb));
    }

    /* -- rocks hugging the foot stone in front and behind, mossy as the pillar is -- */
    for (let i = 0; i < 3; i++) {
      const sy = i === 1 ? -1 : 1;
      const x = Math.max(-REACH_X + 3.4, Math.min(REACH_X - 3.4, cx + side * (1.2 + R() * 2.2) - (i === 2 ? side * 4.4 : 0)));
      const y = sy * (8.2 + R() * 1.2);
      const r0 = 1.3 + R() * 1.1, sq = 0.7 + R() * 0.3, h = 1 + R() * 1.2, turn = R() * TAU;
      // One stone each side, seen whole: its crown under a cushion of moss and its sides bare; the third left out.
      if (i === 2) continue;
      const r = 1.9 + (r0 - 1.3) * 0.3;
      things.push({ x, y, faces: boulder(x, y, r, r * sq, 1.6 + h * 0.2, turn, seed * 17 + i, hand.rock, 0.45) });
    }
  }

  /* -- the lintel: a slab laid over both heads, a crest in its middle with the roundel cut in it -- */
  {
    const chip = (-hand.mossSide) as -1 | 1;
    // The ridge a unit off the middle, toward the dry end.
    const C = -hand.mossSide * 1.0;
    const outline = lintelOutline(R, chip, C);
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
      // The back's frame runs the other way along it.
      const c = which === 'front' ? C : -C;
      runes.push({ face: key, glyph: g2[0], x: c - 6.4, z: 2.75, s: LINTEL_RUNE_S, o: climb });
      runes.push({ face: key, glyph: g2[1], x: c + 6.4, z: 2.75, s: LINTEL_RUNE_S, o: climb });
      runes.push({ face: key, glyph: '', x: c, z: LINTEL_ROUNDEL.z, s: LINTEL_ROUNDEL.r, o: climb + 1, roundel: hand.roundel });
    }
    const slope = (CREST.foot - CREST.top) / CREST.rise;
    const xsL = (z: number, c = C): [number, number] => (z > SLAB_TOP
      ? [c - CREST.foot + (z - SLAB_TOP) * slope, c + CREST.foot - (z - SLAB_TOP) * slope] : [-REACH_X + 0.5, REACH_X - 0.5]);
    const face = (which: 'front' | 'back'): Painter => (g, k) => {
      const key = `l${which}`;
      const T = rand(lseed + (which === 'front' ? 1 : 2));
      const fill = k.fill;
      // Which end of it the moss is on, as this face's frame runs.
      const toMoss = which === 'front' ? hand.mossSide : -hand.mossSide;
      const c = which === 'front' ? C : -C;
      skin(g, fill, T, (z) => xsL(z, c), tTop, false);
      // A rule cut along its foot and one along its brow, stopping short of the crest.
      const E = REACH_X - 1.8;
      cut(g, fill, 0.36, () => { g.beginPath(); g.moveTo(-E, 0.95); g.lineTo(E, 0.9); });
      cut(g, fill, 0.3, () => { g.beginPath(); g.moveTo(-E + 0.2, 4.45); g.lineTo(c - 3.1, 4.4); g.moveTo(c + 3.1, 4.4); g.lineTo(E - 0.2, 4.45); });
      // Drilled dots between the rules, out toward each end.
      for (let x = -E + 0.8; x <= E - 0.8; x += 1.7) {
        if (Math.abs(x - c) < 9) continue;
        cut(g, fill, 0.24, () => { g.beginPath(); g.moveTo(x, 2.7 + 0.03); g.lineTo(x, 2.7 - 0.03); });
      }
      // The roundel, sunk, ringed and carved.
      const x = c, { z, r } = LINTEL_ROUNDEL;
      g.beginPath();
      g.arc(x, z, r * 0.9, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#a39aac'), 0.38), 0.5);
      g.fill();
      for (const rr of runes) {
        if (rr.face !== key) continue;
        if (rr.roundel) cut(g, fill, 0.36, () => strokesPath(g, roundelStrokes(rr.roundel!), rr.x, rr.z, rr.s));
        else cut(g, fill, 0.46, () => glyphPath(g, rr.glyph, rr.x, rr.z, rr.s));
      }
      for (let i = 0; i < 2; i++) {
        const lx = -toMoss * (11 + T() * 6), lz = 1.6 + T() * 2.4;
        lichen(g, T, lx, lz, 0.45 + T() * 0.45, hand.lichen);
      }
      // Moss along its brow at the mossy end in one mass, kept on the face, short of the crest.
      const pts = mossMass(T, 260, () => {
        const sx = toMoss * (6.8 + Math.pow(T(), 0.8) * (REACH_X - 7.6));
        return [sx, 4.6 - Math.pow(T(), 1.6) * 2.0];
      }, (sx, zz) => {
        const along = (sx * toMoss - 6.8) / (REACH_X - 6.8);
        const drop = (4.6 - zz) / 2.0;
        return hand.moss * (1.15 - 0.55 * along) - drop * 0.55;
      }, lseed, 0.6);
      padsIn(g, k.base, k.e, pts);
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
          // Not on the short facets at the ends and the crest's foot, where its cushions would stand in a row across the lintel.
          if (up > 0.35 && Math.abs(mx - C) > CREST.foot && len > 4) {
            // Its top: a carpet of moss over the mossy end, thinning out toward the crest, which is bare; well inside the face, so it never stands proud of its edge.
            const xAt = (s: number): number => p[0] + ((q[0] - p[0]) * s) / Math.max(0.01, len);
            const pts = mossMass(T, Math.round(len * 14), () => [0.8 + T() * Math.max(0, len - 1.6), (T() - 0.5) * 4.6], (s, y) => {
              const toward = (xAt(s) * hand.mossSide) / REACH_X;
              return hand.moss * (0.62 + 0.62 * toward) - Math.max(0, Math.abs(y) - 1.8) * 0.3;
            }, lseed + 3, 0.5);
            padsIn(g, k.base, k.e, pts, 0.62);
          }
        },
      };
    };
    const faces = plate({
      o: O, U, W: Wl, A: [0, 1, 0], outline, half, tTop, bevel: 0.75, tone: hand.stone,
      front: face('front'), back: face('back'), edge,
    });
    things.push({ x: 0, y: 0, faces, rank: 1 });
    const A: V3 = [0, 1, 0];
    const fr = { o: at(O, [half[0], A]), a: U, b: at(Wl, [f, A]) };
    const bk = { o: at(O, [-half[0], A]), a: mul(U, -1), b: at(Wl, [-f, A]) };
    frames.set('lfront', { ...fr, n: [0, 1, 0] });
    frames.set('lback', { ...bk, n: [0, -1, 0] });

    /*
     * Ivy trailing along its brow from the mossy end toward the crest, one
     * strand either face, its leaves turned up over the edge into the moss
     * and down over the face; from a leaf inside the lintel's end to short
     * of the rune at that end. Only on a face the eye sees.
     */
    for (const sy of [1, -1]) {
      const seen = (e: Eye): boolean => e.toward[1] * sy > 0.02;
      // Where the rune nearest the mossy end is cut, along the gate, and how far it reaches.
      const runeAt = hand.mossSide * (6.4 - 1.0) + hand.mossSide * LINTEL_RUNE_S;
      const x0 = hand.mossSide * (REACH_X - 0.1 - 2.5), x1 = runeAt + hand.mossSide * 2.4;
      const stem: V3[] = Array.from({ length: 7 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / 6;
        return [x, sy * (half[0] + 0.25), LINTEL_Z + 4.0 - 0.5 * Math.sin((i / 6) * Math.PI) + Math.tan(hand.tilt) * x] as V3;
      });
      things.push(ivyStrand(stem, 9, [0, 0, 1], 4.2, 3.4, lseed + 71 + sy, 1.5, seen));
    }

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

  /*
   * Flowers, grass and moss at the feet, as on a Runestone's outcrop, never
   * in the way through: a foxglove at the mossy pillar's foot and the hand's
   * yellow at the other, a few daisies behind, grass between; each clump's
   * leaves and heads spread about four units either way of its root, so every
   * root is that far inside the border's end, where a wall run up to the gate
   * would stand over anything further out, and no two closer than five.
   */
  const placed: Array<[number, number]> = [];
  /** The size of a tuft of grass in front of the opening: its blades under 0.3 m, so they never stand over a boot. */
  const LOW = 0.5;
  /** A seed `flowerClump` draws a spike for, in pink: a foxglove. Its own draws, in its own order: leaves, their lengths, then the spike. */
  const spikeSeed = (from: number): number => {
    for (let sd = from; ; sd++) {
      const Q = rand(sd);
      const leaves = 5 + Math.floor(Q() * 3);
      for (let i = 0; i < leaves; i++) Q();
      if (Q() < 0.3) return sd;
    }
  };
  const has = (c: string): boolean => hand.flowers.some(([k]) => k === c);
  const tuft = (x: number, y: number, flower: string | null, big: number, seedAt?: number): void => {
    if (Math.abs(x) + 4.6 * big > REACH_X) return;
    if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < 5)) return;
    placed.push([x, y]);
    const seed = seedAt ?? hand.seed * 1000 + things.length;
    things.push({
      x, y, reach: [[x, y, 16]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0]);
        if (flower) flowerClump(g, px, py, flower, seed, big, 5, 1.3);
        else grassTuft(g, px, py, seed, big);
      },
    });
  };
  /** A low cushion of moss on the ground beside a foot: a few pads flat on the turf. */
  const cushionAt = (x: number, y: number, n: number, seed: number): void => {
    const C = rand(seed);
    const pts: V3[] = Array.from({ length: n }, () => [x + (C() - 0.5) * 3, y + (C() - 0.5) * 2, 0] as V3);
    const rs = pts.map(() => 0.7 + C() * 0.7);
    things.push({
      x, y, reach: [[x, y, 2]],
      draw: (g, e) => {
        const across = Math.hypot(e.ux, e.uy);
        drawPads(g, pts.map((p, i) => { const [px, py] = proj(e, p); return [px, py, rs[i] * across, rs[i] * across * 0.55] as Pad; }));
      },
    });
  };
  for (const side of [-1, 1]) {
    const cx = side * PILLAR_X;
    const mossy = side === hand.mossSide;
    // In front: the foxglove at the mossy foot, the hand's yellow at the other, grass further in.
    // Anything taller than a boot stands out past the pillar's middle, toward the border's end; in front of the opening only short grass.
    tuft(side * (REACH_X - 4.6 * 0.9 - 0.05), 8.2, mossy ? 'pink' : has('yellow') ? 'yellow' : hand.flowers[0][0], 0.9, mossy ? spikeSeed(hand.seed * 50 + 7) : undefined);
    tuft(cx - side * 6.2, 7.4, null, LOW);
    // Behind: the hand's first flower, a small clump, and grass.
    tuft(side * (REACH_X - 4.6 * 0.8 - 0.05), -8.4, hand.flowers[0][0], 0.8);
    tuft(cx - side * 6.4, -7.4, null, LOW);
    // Rubble chipped off in the dressing, mossed over, and a cushion of moss on the turf at the foot.
    for (const [dx, sy, r] of [[2.6, 1, 0.9], [-1.8, -1, 1.1]] as Array<[number, number, number]>) {
      const x = cx - side * dx, y = sy * (7.6 + R() * 0.8), turn = R() * TAU;
      if (sy < 0) {
        // Behind, a bit of rubble, a fleck of moss on it.
        things.push({ x, y, faces: boulder(x, y, r * 0.8, r * 0.6, 0.9, turn, hand.seed * 31 + side * 5 + sy, hand.rock, 0.3) });
        continue;
      }
      // The dry foot has the lintel's broken corner lying in front of it already.
      if (!mossy) continue;
      const piece: Pt[] = [[-1.7, 0], [1.9, 0], [1.6, 1.5], [-0.2, 2.1], [-1.5, 1.4]];
      const c = Math.cos(turn), sn = Math.sin(turn);
      things.push({
        x, y,
        faces: plate({
          o: [x, y, 0.35], U: [c, sn, 0], W: [-sn, c, 0], A: [0, 0, 1], outline: piece.map(([px, py]) => [px, py - 1] as Pt), half: [0.45, 0.45], tTop: 1.1,
          bevel: 0.25, tone: hand.stone,
          front: (g, k) => {
            // A dressed face: the panel's rule along it, and a drilled dot.
            cut(g, k.fill, 0.3, () => { g.beginPath(); g.moveTo(-1.3, -0.2); g.lineTo(1.4, -0.35); });
            g.beginPath();
            g.arc(0.3, 0.45, 0.2, 0, TAU);
            g.fillStyle = css(mix(k.fill, hex('#5d5464'), 0.45), 0.7);
            g.fill();
          },
        }),
      });
    }
    // A cushion of moss on the turf behind the foot.
    if (mossy) cushionAt(cx - side * 3.4, -7.4, 6, hand.seed * 13 + side);
  }

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
type GateGlow = Omit<Glow, 'i' | 'roundel'> & { o: number; roundel: boolean; front: boolean; shade: HTMLCanvasElement | null };

/**
 * A thin cool shadow under a rune's groove, a little down the face from it,
 * on a picture the size of its light (`box`): laid under its glow by day at
 * play zoom, so a lit rune drawn a few pixels high reads as a stroke and not a
 * smudge of warm on pale stone.
 */
function grooveShade(M: DOMMatrix, r: GateRune, scale: number, box: [number, number, number, number], w: number): HTMLCanvasElement {
  const [a, b, bw, bh] = box;
  const [cv, h] = canvasOf(bw * scale, bh * scale);
  h.setTransform(scale, 0, 0, scale, -a * scale, -b * scale);
  h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
  h.lineCap = 'round';
  h.lineJoin = 'round';
  const path = (): void => (r.roundel ? strokesPath(h, roundelStrokes(r.roundel), r.x, r.z, r.s) : glyphPath(h, r.glyph, r.x, r.z, r.s));
  // Never thinner than a pixel at zoom one: how many pixels a unit of the face is, at its narrower way.
  const px = Math.min(Math.hypot(M.a, M.b), Math.hypot(M.c, M.d));
  // A roundel's strokes lie close: thinner, so its ring and figure stay apart.
  const core = Math.max(w, (r.roundel ? 0.75 : 1.15) / px);
  h.save();
  h.translate(0, -r.s * 0.12);
  path();
  h.strokeStyle = 'rgba(58, 60, 92, 0.6)';
  h.lineWidth = core * 1.6;
  h.stroke();
  h.restore();
  // The groove itself, lit: solid pale gold.
  path();
  h.strokeStyle = '#ffd36e';
  h.lineWidth = core;
  h.stroke();
  return cv;
}

/**
 * How much nearer the eye than the middle of the opening a thing has to stand
 * to be drawn over whoever is in it, in units along the ground: the near
 * pillar seen slantwise or end on, and what grows in front of the gate.
 */
const NEAR = 2;

interface Baked {
  /** What stands behind whoever is in the opening: the turf, the threshold, the far pillar, what grows behind. */
  canvas: HTMLCanvasElement;
  /** And what stands in front of them, on its own picture the same size: the near pillar and its foot, what grows in front, and the lintel over them. */
  front: HTMLCanvasElement;
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
  // Kept within the opening's depth through the gate: whoever stands further off, drawn before the gate, is not tinted by it.
  g.save();
  {
    const D = RUNE_GATE_OPENING.depth * TILE;
    g.beginPath();
    ([[-30, -D], [30, -D], [30, D], [-30, D]] as Pt[]).forEach(([x, y], i) => { const [px, py] = proj(e, [x, y, 0]); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.closePath();
    g.clip();
  }
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
  g.restore();

  /*
   * Everything standing, in order: what lies flat first, then by where it
   * stands, the lintel last. On two pictures: what is nearer the eye than
   * the middle of the opening by `NEAR` goes on the front one, which the
   * renderer lays over whoever stands in the opening, and so does the
   * lintel, over both pillars' heads.
   */
  const [front, gf] = canvasOf(canvas.width, canvas.height);
  gf.setTransform(base);
  const rank = (t: GateThing): number => t.rank ?? 0;
  const near = (x: number, y: number): boolean => groundNear(e, x, y) > NEAR;
  const things = model.things.slice().sort((a, b) => rank(a) - rank(b) || groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y));
  for (const t of things) {
    const on = rank(t) >= 1 || near(t.x, t.y) ? [gf] : [g];
    for (const h of on) {
      if (t.draw) t.draw(h, e);
      else if (t.faces) drawFaces(h, e, t.faces, 0.8);
    }
  }

  /* -- each rune's light, for the faces the eye sees -- */
  const glows: GateGlow[] = [];
  for (const [key, fr] of model.frames) {
    if (dot(fr.n, e.toward) <= 1e-6) continue;
    const [ox, oy] = proj(e, fr.o), [ax, ay] = proj(e, fr.a), [bx, by] = proj(e, fr.b);
    // The frame's own axes on the screen: `a` and `b` are directions, so their projection is from the origin.
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    // A pillar's runes go with its picture; the lintel's with the front one, which has the lintel over everything.
    const onFront = key.startsWith('l') || near(key.startsWith('0') ? -PILLAR_X : PILLAR_X, 0);
    for (const r of model.runes) {
      if (r.face !== key) continue;
      // Drawn at play zoom the groove's light is a little heavier, so a lit gate reads as lit; the bloom and the night's cut-out are half a Runestone's, so a small rune stays its own shape.
      const stroke = (r.roundel ? 0.55 : 0.68) * (scale <= 1 ? 1.45 : 1);
      const gl = glowOf(M, r, scale, stroke, 0.5, 0.5);
      const shade = scale <= 1 ? grooveShade(M, r, scale, gl.box, (r.roundel ? 0.62 : 0.78) * stroke) : null;
      glows.push({ ...gl, o: r.o, roundel: !!r.roundel, front: onFront, shade });
    }
  }
  const [mx, my] = proj(e, [0, 0, 0]);
  const [ux, uy] = proj(e, [1, 0, 0]);
  return { canvas, front, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], glows, opening: { x: mx, y: my, ux: ux - mx, uy: uy - my } };
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
  bakedArea += 2 * b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= 2 * old.canvas.width * old.canvas.height;
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
  lit: number, since: number, rise: number, night: number, t: number, layer: 'back' | 'front' = 'back'): GateDrawn {
  const b0 = bakedFor(dir, rotation, variant, zoom);
  const isFront = layer === 'front';
  // This layer's picture and its runes; the motes rise behind whoever is in the opening, with the back.
  const b = { ...b0, glows: b0.glows.filter((gl) => gl.front === isFront) };
  const img = isFront ? b0.front : b0.canvas;
  const model = modelOf(variant);
  const k = zoom / b.scale;
  const X0 = sx - b.ox * k, Y0 = sy - b.oy * k, W = img.width * k, H = img.height * k;
  ctx.drawImage(img, X0, Y0, W, H);
  const out: GateDrawn = { img, x: X0, y: Y0, w: W, h: H, lightBox: null, holes: () => [], masks: () => [] };
  if (lit <= 0.001) return out;
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  const day = 1 - night;
  // Drawn small, a rune's glow is drawn tighter and fainter, so the three down a panel stay three marks.
  const near = Math.min(1, Math.max(0, zoom - 1));
  const each = b.glows.map((gl) => runeLit(gl, lit, since, rise, model.top, t));
  b.glows.forEach((gl, i) => {
    const q = each[i];
    if (q <= 0.002) return;
    const [x, y, w, h] = gl.box;
    const Xg = sx + x * zoom, Yg = sy + y * zoom, Wg = w * zoom, Hg = h * zoom;
    // Drawn small by day, each groove a solid pale-gold stroke over its cool shadow, and no wide glow to blur three runes into one.
    const small = !!gl.shade && zoom <= 1.25 && day > 0.01;
    if (small) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, day * q / 0.8);
      ctx.drawImage(gl.shade!, Xg, Yg, Wg, Hg);
    } else if (day > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, day * q * 0.85 * (gl.roundel ? 0.75 : 1) * gl.square * (0.7 + 0.3 * near));
      ctx.drawImage(gl.halo, Xg, Yg, Wg, Hg);
    }
    if (night > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, night * q * (gl.roundel ? 0.24 : 0.28) * (0.5 + 0.5 * near));
      ctx.drawImage(gl.dusk, Xg, Yg, Wg, Hg);
    }
    ctx.globalCompositeOperation = 'source-over';
    // The lit groove: by day a little light added over it as well; after dark only the groove, so each rune stays its own shape.
    ctx.globalAlpha = Math.min(1, q * (0.85 - 0.2 * night) * (small ? night : 1));
    if (ctx.globalAlpha > 0.002) ctx.drawImage(gl.core, Xg, Yg, Wg, Hg);
    if (!gl.roundel && day > 0.01 && !small) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.1 * day * q;
      ctx.drawImage(gl.core, Xg, Yg, Wg, Hg);
    }
  });
  const motes = isFront ? [] : motesAt(b, t, zoom).map((m) => ({ ...m, a: m.a * lit }));
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
      if (each[i] > 0.002) hs.push({ x: x0 + gl.cx * zoom, y: y0 + gl.cy * zoom, r: gl.r * 0.55 * zoom * (0.6 + 0.4 * near), a: 0.05 * each[i] });
    });
    for (const m of motes) hs.push({ x: x0 + m.x * zoom, y: y0 + m.y * zoom, r: m.r * 2.2, a: 0.8 * m.a });
    return hs;
  };
  out.masks = (x0, y0) => b.glows.flatMap((gl, i) => {
    if (each[i] <= 0.002) return [];
    const [x, y, w, h] = gl.box;
    return [{ canvas: gl.mask, x: x0 + x * zoom, y: y0 + y * zoom, w: w * zoom, h: h * zoom, a: Math.min(1, (gl.roundel ? 0.8 : 0.9) * each[i]) }];
  });
  return out;
}

/** What a rune gate is clicked by, from the middle of its border, in pixels at zoom one: its pillars and lintel, not the grass round it. */
export function runeGateBounds(dir: 'h' | 'v', rotation: number, variant: number): [number, number, number, number] {
  const model = modelOf(variant);
  return measure(model, eyeOf(yawOf(dir), rotation));
}

