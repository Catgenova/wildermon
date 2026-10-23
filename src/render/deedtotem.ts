import { standIn } from './settle';
import { MAX_DEED_LEVEL } from '../game/game';
import { hashOf, PPM, rand, STAGES, strandPic } from './ivy';
import {
  add, at, bakeGlow, bakeRune, breath, canvasOf, css, cut, dot, drawFaces, drawGlows, drawPads, eyeOf, flowerClump, glowHoles, glowMasks,
  glyphPath, grassTuft, groundNear, hex, lichen, mix, mossOver, mul, newell, noise2, panelArch, plate, proj, RUNE_GOLD, RUNE_WHITE, scaleFor,
  STONE_INK, CREASE_INK, sub, TAU, toneOf, unit,
  type Ctx, type Eye, type Face, type Glow, type GlowSpec, type NightHole, type NightMask, type NightSource, type Pad, type PaintCtx, type Painter, type Pt, type RGB, type Thing, type Tone, type V3,
} from './runestone';

/**
 * A settlement's token (`Game.isToken`), drawn as a runic totem: built as the
 * rune lantern post is (`runelantern.ts`), from the runestones' kit
 * (`runestone.ts`) -- a small model of faceted solids in tenths of a metre,
 * put on the screen through the camera's turn, baked for each way it is seen,
 * each scale and each level, and the runes' light laid over the bake.
 *
 * It is a stack of carved blocks on a low outcrop, a block for each level the
 * settlement has reached (`deedLevel`, up to `MAX_DEED_LEVEL`): each level
 * keeps what the one under it had and stands a block taller, and each block
 * is a different width and a different shape from the one under it, so the
 * outline changes at every level and not only the height. One rune is cut in
 * the front of every block and lit, so the lit runes up its front are as many
 * as the settlement has levels, and as many as it may keep wildermon at work
 * (`deedWorkersAt`). Each block is what its level was earned with
 * (`DEED_UPGRADES`):
 *
 *  1. Founded: a stout dressed post a little over chest high, a margin
 *     drafted round each face and a pointed panel sunk in it, the homestead's
 *     rune (othala) cut in the panel; ivy and lichen on it from the start.
 *  2. A crate and a campfire: a broad fire bowl corbelled out round the head
 *     of the post, its dish sunk under a raised lip, charred and full of
 *     embers that glow; and standing in it a narrower block with the torch
 *     (kenaz) cut in each face under a frieze of carved flames.
 *  3. A smelter: a wider block strapped with two bands of forged iron
 *     standing well proud of it, riveted, the rust run down the stone under
 *     each, and the day-stave (dagaz) cut between them.
 *  4. An anvil: a thunderbird, its body a narrower block with the thorn
 *     (thurisaz) on its breast, its eyes cut and its hooked beak standing out
 *     over the rune, its wings spread from its sides and swept forward, their
 *     long feathers fingered and their tips raised over its head; two hammers
 *     crossed in a sunk panel on its back.
 *  5. A building and three wildermon at work: the crown, a block roofed as a
 *     house is, its slates coursed, its gables bossed in gold and a tall gilt
 *     finial on its ridge, the people's rune (mannaz) cut in each face, and
 *     three wildermon heads carved out from three of its corners, muzzled and
 *     eared and picked out in ochre.
 *
 * Every level but the last stands under its own capstone -- a broad flat slab
 * on the post, a steep hood over the hearth, an iron-rimmed slab over the
 * smelter's block, a crest over the bird -- so a token is a finished thing at
 * every level and not one half built. Every block is turned a little off the
 * one under it, as the lantern's are. Which of three hands cut it goes by
 * where it stands (`deedTotemVariant`).
 *
 * Anything that wraps a block -- the bowl, an iron band -- is laid a side at
 * a time, each side where it stands, so its near side goes over the block and
 * its far side under it.
 *
 * After dark its stone keeps some of the night; each rune's light lies on the
 * stone round it, the embers in the bowl glow and light its dish, a bloom
 * round each lit block lights the air and a faint sheen runs up the stack;
 * the runes breathe from the foot up and take the night off themselves in
 * their own shapes, kept off whatever stands in front (`deedTotemNight`, laid
 * by the runestones' `RunestoneNight`). It throws no light of the game's own:
 * the island's lights are a rule the browser and the island share, and this
 * is a picture of one.
 */

/**
 * Which way it faces: to the south-east, where the camera looks from at its
 * first turn, so the wings and the crown's gable are seen spread and square
 * from where the island is first seen; and an eighth of a half turn off
 * that, as the runestones are turned, so two of its faces show.
 */
const YAW = -Math.PI / 4 + Math.PI / 8;

/** How many ways one may be cut, so two settlements are not one totem twice: by where it stands. */
export const DEED_TOTEM_VARIANTS = 3;

/* ---- the stone ----------------------------------------------------------------- */

/** The blocks' stone, the runestones' and the lantern's warm cream; the crown's roof a step cooler; the outcrop a step darker. */
const STONE: Tone = toneOf('#eadbc2', '#a89794');
const ROOF: Tone = toneOf('#d9cbbd', '#928594');
const ROCK: Tone = toneOf('#dccbb5', '#9e8f8d');
/** Forged iron: a cool grey, its shade a blue-black, dark enough to read as metal and not so dark it outweighs the runes. */
const IRON: Tone = toneOf('#a9aab6', '#595866');
/** Gold leaf, on the crown alone: its finial and its bosses. */
const GOLD: Tone = toneOf('#f4d27a', '#b48843');
/** The wildermon heads: the stone picked out in ochre, as carved heads are painted. */
const OCHRE: Tone = toneOf('#ecc597', '#a8857f');

/** The outcrop's top, and how deep the post is let into it. */
const OUTCROP_H = 1.8;
const FOOT = 1.0;
/** How far the whole of it leans, across and toward its front, per unit up: a hair, so it is not set out with a rule. */
const LEAN: [number, number] = [0.008, -0.006];

/**
 * One block: how tall, how wide across at its foot and its head (half), how
 * deep (half), its rune and where on a face (`s` from its middle to its top,
 * `z` up the face), which faces it is cut in (front, right, back, left), and
 * how far it is turned off the block under it.
 */
interface Course {
  h: number;
  hx: [number, number];
  hy: number;
  rune: string;
  s: number;
  z: number;
  faces: number[];
  turn: number;
}

/** The blocks from the foot up, one for each level: wide, narrow, wide, narrow, wide, so no two together are one width. */
const COURSES: Course[] = [
  { h: 9.4, hx: [3.5, 3.15], hy: 2.95, rune: 'othala', s: 2.0, z: 5.9, faces: [0, 1, 2, 3], turn: 0 },
  { h: 5.6, hx: [2.7, 2.55], hy: 2.4, rune: 'kenaz', s: 1.6, z: 2.15, faces: [0, 1, 2, 3], turn: 0.06 },
  { h: 6.0, hx: [3.35, 3.25], hy: 2.85, rune: 'dagaz', s: 1.7, z: 3.0, faces: [0, 1, 2, 3], turn: -0.05 },
  { h: 6.0, hx: [2.6, 2.45], hy: 2.4, rune: 'thurisaz', s: 1.55, z: 2.0, faces: [0, 2], turn: 0.04 },
  { h: 4.4, hx: [2.95, 2.95], hy: 2.65, rune: 'mannaz', s: 1.5, z: 2.3, faces: [0, 1, 2, 3], turn: -0.035 },
];
/** The fire bowl under the second block: how tall to its lip, how far out past the post's head the lip stands, how wide the lip, and how far down its dish is sunk. */
const BOWL_H = 1.7;
const BOWL_OUT = 3.0;
const BOWL_LIP = 0.42;
const DISH = BOWL_H - 0.38;
/** Where the iron bands of the third block run, up it, foot and head of each; how far they stand out of the stone, and the chamfer over and under each. */
const BANDS: Array<[number, number]> = [[0, 0.8], [5.2, 6.0]];
const BAND_OUT = 0.5;
const BAND_LIP = 0.3;
/** The bird's wings: how far back each is swept from square across it: an eighth of a turn (see `wing`). */
const WING_SWEEP = -Math.PI / 4;
/** The crown's roof: how far its eaves stand past the block either side and at the gables, its rise, and its thickness. */
const EAVE = 1.6;
const GABLE_OUT = 0.3;
const ROOF_RISE = 3.5;
const ROOF_T = 0.75;
/** The capstone over the top block of each level but the last: its overhang, the height of its upright edge, its rise, which way its ridge runs, and whether its edge is iron. */
interface Cap {
  out: number;
  edge: number;
  rise: number;
  ridge: 'across' | 'through' | 'point';
  iron?: boolean;
}
const CAPS: Cap[] = [
  { out: 0.85, edge: 1.0, rise: 0.45, ridge: 'across' },
  { out: 0.35, edge: 0.45, rise: 3.2, ridge: 'point' },
  { out: 0.7, edge: 0.75, rise: 1.0, ridge: 'across', iron: true },
  { out: 0.45, edge: 0.55, rise: 2.3, ridge: 'through' },
];

/** How wide a rune's groove is, in units; and the least it is across at a scale, as units times the scale, for its gold. */
const RUNE_W = 0.6;
const RUNE_PX = 2;
/** And its cut channel round that, darker: so much wider again on the screen, in pixels. */
const CHANNEL_PX = 3;
/**
 * A rune's lit groove, as on the lantern: the runestones' own gold without
 * their all-but-white middle, its channel's edge the shadow of its cut.
 */
const RUNE_INNER = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6));
const RUNE_MID = RUNE_GOLD;
const RUNE_CHANNEL = 'rgba(112, 84, 74, 0.9)';
/** And after dark, a pale gold that the night's wash over the stone round it never lifts to white. */
const NIGHT_INNER = 'rgb(255, 236, 184)';
const NIGHT_MID = 'rgb(255, 214, 140)';
/** The embers' light: an orange edge, a hot orange, a yellow heart. */
const EMBER = { edge: 'rgba(196, 72, 30, 0.9)', mid: '#ff8f3e', inner: '#ffd27a' };
/** A cool dark for the reveal round a sunk panel and the shadow under an overhang: the lantern's. */
const REVEAL = '#5a5266';
/** The size of its ivy against the runestones', as on the lantern. */
const IVY_K = 0.7;

/** One solid's frame: where its outline's (0, 0) is, and the ways its outline and its thickness run. */
interface Frame {
  o: V3;
  U: V3;
  W: V3;
  A: V3;
}
/** A point (s, t) of a solid's outline, `y` through its thickness. */
const P = (f: Frame, s: number, t: number, y = 0): V3 => at(f.o, [s, f.U], [t, f.W], [y, f.A]);
/** A frame on top of another at (s, t) of its outline, turned `d` about the upright: no course laid square on the last. */
const onTop = (f: Frame, s: number, t: number, d: number): Frame => {
  const c = Math.cos(d), n = Math.sin(d);
  return { o: P(f, s, t), U: [c, n, 0], W: [LEAN[0], LEAN[1], 1], A: [-n, c, 0] };
};
/** A face of a solid along its outline's edge from p to q, seen side on: its own frame, across it as the eye in front of it sees it, and up it. */
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
/** The middle of some points. */
const mid = (pts: readonly V3[]): V3 => mul(pts.reduce<V3>((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
/** A face through `pts`, turned away from `from` (and up by `up` more), in `tone`. */
const faceOut = (pts: V3[], from: V3, tone: Tone, extra: Partial<Face> = {}, up = 0): Face => {
  let nn = newell(pts);
  if (dot(nn, add(sub(mid(pts), from), [0, 0, up])) < 0) nn = mul(nn, -1);
  return { pts, n: nn, tone, crease: 0.4, ...extra };
};

/** A face of a block as runes are laid in it: its frame, which way it looks, its corners, and its runes. */
interface RuneFace {
  o: V3;
  a: V3;
  b: V3;
  n: V3;
  poly: V3[];
  runes: GlowSpec[];
  /** The block it is cut in. */
  course: number;
}

/** A thing of the model, and which part of the totem it is, for what it is clicked by. */
type Part = Thing & { part?: string };

interface Model {
  things: Part[];
  /** The totem's own solids, without the outcrop or anything round it: what it is picked by and what keeps the night. */
  solids: Set<Thing>;
  /** The things whose tops catch the light on their near arrises (`litEdges`). */
  lit: Set<Thing>;
  /** Each block: the thing its runes are cut in, so their light is kept off whatever is drawn after it. */
  carved: Thing[];
  faces: RuneFace[];
  /** The bowl's dish and the embers in it, as their light is laid: the dish, its frame, its outline, and each hot ember. */
  embers: { dish: Thing; o: V3; a: V3; b: V3; poly: V3[]; dots: Array<[number, number, number]> } | null;
  /** Where each light is on its own stone after dark: its middle, how far it reaches, its colour, and which things it falls on. */
  warm: Array<{ at: V3; r: number; on: Thing[]; colour: string; k: number }>;
  /** The middle of each block's runes, for its bloom; and the top of it all. */
  glowAt: V3[];
  top: number;
  turf: Pt[];
}

const models = new Map<string, Model>();

/**
 * The model of a totem of `level` blocks, cut the `variant`th way: its hand
 * turns each block a little more or less, lays its outcrop and its rocks,
 * and sets the third head on one back corner of the crown or the other.
 */
function modelOf(level: number, variant: number): Model {
  const key = `${level}|${variant}`;
  const had = models.get(key);
  if (had) return had;
  const seed = 613 + variant * 131;
  const R = rand(seed);
  const things: Part[] = [];
  const solids = new Set<Thing>();
  const lit = new Set<Thing>();
  /** A solid of the totem, standing at (x, y) for the order, part of `part`. */
  const solid = (faces: Face[], part: string, x = 0, y = 0, catches = true): Part => {
    const t: Part = { x, y, faces, part };
    things.push(t);
    solids.add(t);
    if (catches) lit.add(t);
    return t;
  };
  /** Faces laid a side at a time: each group its own thing, standing where it stands, so a near side is laid over what it wraps and a far side under it. */
  const sides = (groups: Face[][], part: string): Part[] => groups.map((fs) => {
    const c = mid(fs.flatMap((f) => f.pts));
    return solid(fs, part, c[0], c[1]);
  });
  const hand = variant - 1;

  /*
   * The stone's skin on a face `x0` to `x1` across and `h` up: flat patches
   * a step paler and a step greyer, grit thicker toward the foot, a few pits
   * with a lit lip, and the damp up out of the ground at the foot of the post
   * -- the lantern's skin, the runestones' at this size.
   */
  const skin = (g: Ctx, fill: RGB, x0: number, x1: number, h: number, salt: number, damp: boolean): void => {
    const T = rand(seed * 31 + salt);
    for (let i = 0; i < Math.round((x1 - x0) * h * 0.3) + 3; i++) {
      const x = x0 + T() * (x1 - x0), z = T() * h;
      g.beginPath();
      g.ellipse(x, z, 0.5 + T() * 1.4, 0.3 + T() * 0.8, (T() - 0.5) * 0.8, 0, TAU);
      g.fillStyle = T() < 0.5 ? css(mix(fill, [255, 252, 244], 0.4), 0.4) : css(mix(fill, hex('#9c94a4'), 0.32), 0.28);
      g.fill();
    }
    if (damp) {
      g.beginPath();
      g.moveTo(x0 - 1, -1);
      for (let x = x0 - 1; x <= x1 + 1; x += 0.6) g.lineTo(x, 1.1 + 1.1 * noise2(x / 1.8, 0.5, seed + salt));
      g.lineTo(x1 + 1, -1);
      g.closePath();
      g.fillStyle = css(mix(fill, hex('#7f8486'), 0.35), 0.45);
      g.fill();
    }
    g.fillStyle = css(mix(fill, hex('#6d6274'), 0.5), 0.32);
    for (let i = 0; i < Math.round((x1 - x0) * h * 0.8); i++) {
      const z = Math.pow(T(), 1.5) * h, x = x0 + T() * (x1 - x0);
      g.fillRect(x, z, 0.1 + T() * 0.08, 0.1 + T() * 0.08);
    }
    for (let i = 0; i < 2; i++) {
      const x = x0 + 0.5 + T() * (x1 - x0 - 1), z = 0.4 + T() * (h - 0.8), r = 0.1 + T() * 0.13;
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
  /** A face's rune cut in it, its channel never so narrow on the screen that its dark does not show either side of its gold. */
  const cutRune = (g: Ctx, fill: RGB, c: Course): void => {
    const tr = g.getTransform();
    const px = Math.max(1e-6, Math.min(Math.hypot(tr.a, tr.b), Math.hypot(tr.c, tr.d)));
    cut(g, fill, Math.max(RUNE_W * 1.3, CHANNEL_PX / px), () => glyphPath(g, c.rune, 0, c.z, c.s));
  };
  /** A margin drafted a finger in from a face's arrises, as dressed stone is, from `z0` up to `z1`. */
  const margin = (g: Ctx, fill: RGB, half0: number, half1: number, z0: number, z1: number, h: number): void => {
    const w = (z: number): number => half0 + ((half1 - half0) * z) / h - 0.5;
    cut(g, fill, 0.17, () => {
      g.beginPath();
      g.moveTo(-w(z0), z0); g.lineTo(-w(z1), z1); g.lineTo(w(z1), z1); g.lineTo(w(z0), z0); g.closePath();
    });
  };
  /** The shadow an overhang over a face throws across its head: hard along its lip and soft under that. */
  const underLip = (g: Ctx, half: number, h: number, deep: number): void => {
    g.fillStyle = css(hex(REVEAL), 0.22 * deep);
    g.fillRect(-half - 1, h - 1.0, 2 * half + 2, 2);
    g.fillStyle = css(hex(REVEAL), 0.5 * deep);
    g.fillRect(-half - 1, h - 0.36, 2 * half + 2, 2);
  };
  /** A panel sunk a step into a face: filled in the shade of its reveal and ruled round. */
  const sunk = (g: Ctx, fill: RGB, draw: () => void): void => {
    draw();
    g.fillStyle = css(mix(fill, hex('#a39aac'), 0.45), 0.6);
    g.fill();
    g.strokeStyle = css(hex(REVEAL), 0.5);
    g.lineWidth = 0.3;
    g.stroke();
  };

  /* -- the outcrop it stands on, and rocks hugging its foot -------------------------------- */
  /*
   * A rock of the outcrop: a ring of corners on the ground, two up its side
   * and a broad top a little in from that, each pushed about by its seed --
   * a flat-topped, faceted stone, as the lantern's outcrop is split; moss
   * over its top as far as `moss` says (`mossOver`).
   */
  const slab = (cx: number, cy: number, rx: number, ry: number, h: number, turn: number, salt: number, moss: number): Face[] => {
    const Q = rand(salt);
    const n = 8 + Math.floor(Q() * 3);
    const c = Math.cos(turn), sn = Math.sin(turn);
    const jit = Array.from({ length: n }, () => [(Q() - 0.5) * 0.4, 1 + (Q() - 0.5) * 0.25] as Pt);
    const ring = (k: number, z: number, tilt: number): V3[] => jit.map(([da, dr], i) => {
      const a = (i / n) * TAU + da;
      const kr = k * dr * (1 + (Q() - 0.5) * 0.12);
      const x = Math.cos(a) * rx * kr, y = Math.sin(a) * ry * kr;
      return [cx + x * c - y * sn, cy + x * sn + y * c, z + tilt * (x / rx) + (Q() - 0.5) * 0.16 * h] as V3;
    });
    const tilt = (Q() - 0.5) * 0.18 * h;
    const rings = [ring(1, -0.5, 0), ring(1.0, h * 0.38, tilt * 0.3), ring(0.95, h * 0.74, tilt * 0.7), ring(0.84, h, tilt)];
    const own: Tone = { lit: mix(ROCK.lit, Q() < 0.5 ? hex('#ecdcc4') : hex('#d7dad6'), 0.2 + 0.2 * Q()), shade: ROCK.shade };
    const faces: Face[] = [];
    const bands: Array<{ pts: V3[]; k: number; n: V3 }> = [];
    const face = (pts: V3[], expect: V3, extra: Partial<Face> = {}): Face => {
      let nn = newell(pts);
      if (dot(nn, expect) < 0) nn = mul(nn, -1);
      const f: Face = { pts, n: nn, tone: own, crease: 0.3, ...extra };
      faces.push(f);
      return f;
    };
    for (let b = 0; b < 3; b++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const lo = rings[b], hi = rings[b + 1];
        const m = mul(add(lo[i], lo[j]), 0.5);
        const f = face([lo[i], lo[j], hi[j], hi[i]], add([m[0] - cx, m[1] - cy, 0], [0, 0, b * 0.8]));
        bands.push({ pts: f.pts, k: b / 2, n: f.n });
      }
    }
    const top = rings[3];
    const hz = top.reduce((sum, p) => sum + p[2], 0) / n;
    face(top.slice(), [0, 0, 1], {
      frame: { o: [cx, cy, hz], a: [1, 0, 0], b: [0, 1, 0] }, crease: 0.4,
      over: moss > 0 ? mossOver(top.map((p) => [p[0], p[1]] as Pt), hz, bands, moss, salt) : undefined,
    });
    return faces;
  };
  const outcropT: Thing = { x: 0, y: 0, first: true, faces: slab(0, 0, 7.4, 6.7, OUTCROP_H, R() * TAU, seed * 3 + 1, 0.5) };
  things.push(outcropT);
  lit.add(outcropT);
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.25 + R() * 0.5) / 4) * TAU, d = 7.0 + R() * 1.1;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const r = 1.5 + R() * 0.8;
    things.push({ x, y, faces: slab(x, y, r, r * (0.68 + R() * 0.25), 0.6 + R() * 0.45, R() * TAU, seed * 17 + i, 0.25 + 0.3 * R()) });
  }
  /** Cushions of moss: `n` of them about `c`, each `r` or so across, laid on the screen at the point of the model they are on. */
  const cushions = (c: V3, r: number, n: number, salt: number, part?: string): void => {
    things.push({
      x: c[0], y: c[1], reach: [add(c, [0, 0, 1.5])], part,
      draw: (g, e) => {
        const T = rand(seed * 43 + salt);
        const across = Math.hypot(e.ux, e.uy);
        const ps: Pad[] = [];
        for (let j = 0; j < n; j++) {
          const [px, py] = proj(e, add(c, [(T() - 0.5) * r * 1.4, (T() - 0.5) * r * 1.2, T() * 0.4]));
          const rr = r * (0.55 + 0.45 * T());
          ps.push([px, py, rr * across, rr * across * 0.7]);
        }
        drawPads(g, ps);
      },
    } as Part);
  };
  // Banked against the post's foot on its front and right, as on the lantern's.
  cushions([3.4, 2.9, FOOT + 0.4], 1.3, 5, 1);
  cushions([-3.6, 1.6, FOOT + 0.2], 0.9, 3, 2);

  /* -- the blocks --------------------------------------------------------------------------- */
  const carved: Thing[] = [];
  const faces: RuneFace[] = [];
  const warm: Model['warm'] = [];
  const glowAt: V3[] = [];
  const RUNE_WARM = '242, 214, 170';
  const ground: Frame = { o: [0, 0, FOOT], U: [1, 0, 0], W: [LEAN[0], LEAN[1], 1], A: [0, 1, 0] };
  /** A face's own painting, on top of its skin and before its rune: which face (front, right, back, left), how wide it is at its foot and head, half, and its fill. */
  type Dress = (g: Ctx, fill: RGB, j: number, half0: number, half1: number) => void;
  /** A block: tapered, its faces dressed and its rune cut in the faces it has one in, and those faces as its runes' light is laid. */
  const block = (n: number, f: Frame, dress: Dress, salt: number, bevel: number, frontOver?: Painter): Thing => {
    const c = COURSES[n];
    const [hx0, hx1] = c.hx;
    const outline: Pt[] = [[-hx0, 0], [hx0, 0], [hx1, c.h], [-hx1, c.h]];
    const paint = (j: number, g: Ctx, k: PaintCtx): void => {
      const [h0, h1] = j % 2 === 0 ? [hx0, hx1] : [c.hy, c.hy];
      skin(g, k.fill, -h0 - 0.4, h0 + 0.4, c.h, salt + j, n === 0);
      dress(g, k.fill, j, h0, h1);
      if (c.faces.includes(j)) cutRune(g, k.fill, c);
    };
    const edge = (i: number, up: number): { paint?: Painter } | undefined => {
      if (Math.abs(up) > 0.35) return undefined;
      const fr = sideFrame(f, outline[i], outline[(i + 1) % 4]);
      return { paint: (g, k) => { inFrame(g, k, fr); paint(fr.right ? 1 : 3, g, k); } };
    };
    const t = solid(plate({
      ...f, outline, half: [c.hy, c.hy], tTop: c.h, bevel, tone: STONE,
      front: (g, k) => paint(0, g, k), back: (g, k) => paint(2, g, k), frontOver, edge, sunk: true,
    }), `c${n}`);
    carved.push(t);
    // Its faces as its runes are laid in them: front, right, back, left, so their breath runs round it.
    const fr = sideFrame(f, outline[1], outline[2]), fl = sideFrame(f, outline[3], outline[0]);
    const quads: Array<{ o: V3; a: V3; b: V3; out: V3; poly: V3[] }> = [
      { o: P(f, 0, 0, c.hy), a: f.U, b: f.W, out: f.A, poly: [P(f, -hx0, 0, c.hy), P(f, hx0, 0, c.hy), P(f, hx1, c.h, c.hy), P(f, -hx1, c.h, c.hy)] },
      { o: fr.o, a: fr.a, b: fr.b, out: f.U, poly: [P(f, hx0, 0, c.hy), P(f, hx0, 0, -c.hy), P(f, hx1, c.h, -c.hy), P(f, hx1, c.h, c.hy)] },
      { o: P(f, 0, 0, -c.hy), a: mul(f.U, -1), b: f.W, out: mul(f.A, -1), poly: [P(f, hx0, 0, -c.hy), P(f, -hx0, 0, -c.hy), P(f, -hx1, c.h, -c.hy), P(f, hx1, c.h, -c.hy)] },
      { o: fl.o, a: fl.a, b: fl.b, out: mul(f.U, -1), poly: [P(f, -hx0, 0, -c.hy), P(f, -hx0, 0, c.hy), P(f, -hx1, c.h, c.hy), P(f, -hx1, c.h, -c.hy)] },
    ];
    quads.forEach((q, j) => {
      if (!c.faces.includes(j)) return;
      let nn = newell([q.o, add(q.o, q.a), add(add(q.o, q.a), q.b)]);
      if (dot(nn, q.out) < 0) nn = mul(nn, -1);
      faces.push({ o: q.o, a: q.a, b: q.b, n: nn, poly: q.poly, course: n, runes: [{ glyph: c.rune, x: 0, z: c.z, s: c.s, i: n * 2 + j * 0.25, w: RUNE_W }] });
    });
    glowAt.push(P(f, 0, c.z));
    warm.push({ at: P(f, 0, c.z), r: Math.max(c.h * 0.8, 5), on: [t], colour: RUNE_WARM, k: 0.42 });
    return t;
  };

  /*
   * The capstone over the top block of a level that has none over it yet:
   * an upright edge standing out past it all round, and a top rising from
   * that -- to a ridge across it, a ridge through it, or a point -- with moss
   * on its front shoulder; so a token of any level stands finished.
   */
  const capstone = (f: Frame, hx: number, hy: number, cap: Cap, n: number): void => {
    const X = hx + cap.out, Y = hy + cap.out;
    const lo = [P(f, -X, 0, -Y), P(f, X, 0, -Y), P(f, X, 0, Y), P(f, -X, 0, Y)];
    const hi = [P(f, -X, cap.edge, -Y), P(f, X, cap.edge, -Y), P(f, X, cap.edge, Y), P(f, -X, cap.edge, Y)];
    const z = cap.edge + cap.rise;
    const ctr = P(f, 0, cap.edge * 0.5, 0);
    const out: Face[] = [];
    const face = (pts: V3[], tone: Tone, crease = 0.42): void => { out.push(faceOut(pts, ctr, tone, { crease })); };
    for (let i = 0; i < 4; i++) face([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]], cap.iron ? IRON : STONE, 0.5);
    if (cap.ridge === 'point') {
      const apex = P(f, 0, z, 0);
      for (let i = 0; i < 4; i++) face([hi[i], hi[(i + 1) % 4], apex], STONE);
    } else if (cap.ridge === 'across') {
      const r = Math.max(0.3, X - Y + 0.3);
      const r0 = P(f, -r, z, 0), r1 = P(f, r, z, 0);
      face([hi[0], hi[1], r1, r0], STONE);
      face([hi[2], hi[3], r0, r1], STONE);
      face([hi[1], hi[2], r1], STONE);
      face([hi[3], hi[0], r0], STONE);
    } else {
      const r = Math.max(0.3, Y - X + 0.3);
      const r0 = P(f, 0, z, -r), r1 = P(f, 0, z, r);
      face([hi[1], hi[2], r1, r0], STONE);
      face([hi[3], hi[0], r0, r1], STONE);
      face([hi[0], hi[1], r0], STONE);
      face([hi[2], hi[3], r1], STONE);
    }
    const t = solid(out, 'cap');
    // The capstone's underside and edge catch the block's light after dark, as the lantern's cap does its band's.
    warm[warm.length - 1].on.push(t);
    // Moss on its front shoulder, on the mossy side as on the lantern's cap.
    cushions(P(f, X * 0.55, cap.edge + (cap.ridge === 'point' ? 0.3 : cap.rise * 0.4), Y * 0.5), cap.ridge === 'point' ? 0.6 : 0.9 + 0.15 * n, 3, 20 + n, 'cap');
  };

  // 1: the post, founded.
  const postF: Frame = onTop(ground, 0, 0, COURSES[0].turn + 0.02 * hand);
  const c0 = COURSES[0];
  /*
   * Ivy up the front of the post by its right arris, from its foot toward its
   * head, as the runestones' climbs their faces: strands of heart-shaped
   * leaves laid in the face and let run a leaf past its edge.
   */
  const ivy: Painter = (g) => {
    g.save();
    g.beginPath();
    g.rect(-c0.hx[0] - 0.8, -1, 2 * c0.hx[0] + 1.6, c0.h - 1.2);
    g.clip();
    for (const st of [{ kind: 'climb' as const, v: 1 + variant, x: c0.hx[0] - 0.55, k: IVY_K, stage: STAGES }, { kind: 'vine' as const, v: variant, x: c0.hx[0] - 1.3, k: IVY_K * 0.7, stage: Math.round(STAGES * 0.6) }]) {
      const pic = strandPic(st.kind, st.v, st.stage, true);
      if (!pic) continue;
      const sc = (st.k * 10) / PPM;
      g.save();
      g.translate(st.x, -0.4);
      g.scale(sc, -sc);
      g.drawImage(pic.img, -pic.ax, -pic.ay);
      g.restore();
    }
    g.restore();
  };
  block(0, postF, (g, fill, j, h0, h1) => {
    margin(g, fill, h0, h1, 1.3, c0.h - 0.6, c0.h);
    // A plinth line cut round its foot, out of the damp.
    cut(g, fill, 0.2, () => { g.beginPath(); g.moveTo(-h0, 1.65); g.lineTo(h0, 1.65); });
    // The panel its rune is cut in, sunk a step into the face: pointed at its head, the reveal round it in shadow.
    const hw = Math.min(1.75, h1 - 0.85);
    sunk(g, fill, () => panelArch(g, 0, 0, hw, c0.z - 3.0, c0.z + 2.0, 1.2, 0));
    // A drilled dot either side of the panel's head, and a short rule under its foot.
    for (const x of [-hw - 0.5, hw + 0.5]) cut(g, fill, 0.3, () => { g.beginPath(); g.moveTo(x, c0.z + 1.75); g.lineTo(x, c0.z + 1.69); });
    cut(g, fill, 0.18, () => { g.beginPath(); g.moveTo(-hw * 0.6, c0.z - 3.5); g.lineTo(hw * 0.6, c0.z - 3.5); });
    // Lichen in a few patches low on it, and on its shady faces more.
    const L = rand(seed * 89 + j);
    for (let i = 0; i < (j === 0 || j === 1 ? 2 : 4); i++) lichen(g, L, (L() - 0.5) * 2 * (h0 - 0.6), 1.6 + L() * 3.5, 0.45 + L() * 0.35);
    if (j === 2) {
      // A crack in from an edge on the back, and its lit lip.
      const T = rand(seed * 5 + 3);
      let x = -h0 + 0.2, z = 2.6 + T() * 1.2, a = 0.1;
      const pts: Pt[] = [[x, z]];
      for (let i = 0; i < 4; i++) { a += (T() - 0.5) * 0.9; x += Math.cos(a) * 0.45; z += Math.sin(a) * 0.45; pts.push([x, z]); }
      cut(g, fill, 0.17, () => { g.beginPath(); pts.forEach(([px, pz], i) => (i ? g.lineTo(px, pz) : g.moveTo(px, pz))); });
    }
    if (level === 1) underLip(g, h1, c0.h, 1.4);
  }, 10, 0.55, ivy);
  let top = postF, topH = c0.h, topN = 0;

  // 2: the fire bowl and the hearth block standing in it, for a crate and a campfire.
  let embers: Model['embers'] = null;
  if (level >= 2) {
    const c = COURSES[1];
    const bowlF = onTop(top, 0, topH, c.turn * 0.5 + 0.02 * hand);
    /*
     * The bowl: its sides flaring out from round the post's head to a broad
     * rim, an upright lip round that, the lip's flat top, and inside it a
     * wall down to a dish sunk below the lip, charred and full of embers --
     * the block standing up out of the middle of it.
     */
    const n = 10;
    const k = 1 / Math.cos(Math.PI / n);
    const ring = (rx: number, ry: number, t: number): V3[] => Array.from({ length: n }, (_, i) => {
      const a = ((i + 0.5) / n) * TAU;
      return P(bowlF, Math.cos(a) * rx, t, Math.sin(a) * ry);
    });
    const r0x = c0.hx[1] * k * 0.97, r0y = c0.hy * k * 0.97;
    const r1x = (c0.hx[1] + BOWL_OUT) * k, r1y = (c0.hy + BOWL_OUT * 0.92) * k;
    const r2x = r1x - BOWL_LIP * k, r2y = r1y - BOWL_LIP * k;
    const foot = ring(r0x, r0y, 0), rim = ring(r1x, r1y, BOWL_H * 0.7), lipOut = ring(r1x, r1y, BOWL_H), lipIn = ring(r2x, r2y, BOWL_H), floor = ring(r2x, r2y, DISH);
    const axis = P(bowlF, 0, BOWL_H * 0.5);
    // The dish, first: the block stands on it, and everything of the bowl is laid round it.
    const dishO = P(bowlF, 0, DISH);
    const T = rand(seed * 71 + 2);
    const ex = r2x / k, ey = r2y / k;
    const lumps = Array.from({ length: 30 }, () => {
      const a = T() * TAU, r = 0.62 + 0.36 * T();
      return [Math.cos(a) * r * (ex - 0.25), Math.sin(a) * r * (ey - 0.25), 0.18 + 0.2 * T(), T() < 0.5 ? 1 : 0] as [number, number, number, number];
    });
    const dishFace: Face = {
      pts: floor.slice(), n: [0, 0, 1], tone: STONE, crease: 0.45,
      frame: { o: dishO, a: bowlF.U, b: bowlF.A },
      paint: (g, kk) => {
        // Charred, ash greying it toward the wall, the coals lying in it and the hot ones lit.
        g.beginPath();
        g.ellipse(0, 0, ex + 0.5, ey + 0.5, 0, 0, TAU);
        g.fillStyle = css(mix(kk.fill, hex('#352628'), 0.8), 1);
        g.fill();
        for (const [x, y, r, hot] of lumps) {
          g.beginPath();
          g.ellipse(x, y, r + 0.12, r, 0, 0, TAU);
          g.fillStyle = hot ? 'rgba(232, 104, 48, 1)' : 'rgba(118, 96, 96, 0.9)';
          g.fill();
          if (hot) {
            g.beginPath();
            g.ellipse(x - 0.04, y + 0.03, r * 0.6, r * 0.45, 0, 0, TAU);
            g.fillStyle = 'rgba(255, 214, 120, 1)';
            g.fill();
          }
        }
      },
    };
    const dishT = solid([dishFace], 'bowl', 0, 0, false);
    embers = { dish: dishT, o: dishO, a: bowlF.U, b: bowlF.A, poly: floor.slice(), dots: lumps.filter((l) => l[3]).map(([x, y, r]) => [x, y, r]) };
    // Each side of it: its flare, its lip, the lip's top and the wall in from that, a side at a time.
    const groups: Face[][] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      groups.push([
        faceOut([foot[i], foot[j], rim[j], rim[i]], axis, STONE, { crease: 0.35 }),
        faceOut([rim[i], rim[j], lipOut[j], lipOut[i]], axis, STONE, { crease: 0.5 }),
        faceOut([lipOut[i], lipOut[j], lipIn[j], lipIn[i]], axis, STONE, { crease: 0.45 }, 9),
        // The wall inside the lip looks in, toward the axis.
        (() => { const f = faceOut([lipIn[i], lipIn[j], floor[j], floor[i]], axis, STONE, { crease: 0.4, tone: toneOf('#9c8a86', '#6e5f66') }); return { ...f, n: mul(f.n, -1) }; })(),
      ]);
    }
    const bowl = sides(groups, 'bowl');
    const f = onTop(bowlF, 0, DISH, c.turn + 0.02 * hand);
    block(1, f, (g, fill, _j, h0, h1) => {
      margin(g, fill, h0, h1, 0.6, c.h - 2.25, c.h);
      /*
       * A frieze of flames across its head: tongues left standing in the
       * stone, the ground between them cut back into shadow, so it reads as a
       * row of teeth of fire round the block.
       */
      const z0 = c.h - 1.95, z1 = c.h - 0.15, n2 = 4;
      g.beginPath();
      g.moveTo(-h1 - 0.5, z1);
      for (let i = 0; i <= n2 * 2; i++) {
        const x = -h1 + (2 * h1 * i) / (n2 * 2);
        const z = i % 2 ? z1 - 0.15 : z0;
        if (i % 2) g.quadraticCurveTo(x - 0.25, (z0 + z1) / 2, x, z);
        else g.quadraticCurveTo(x + 0.25, (z0 + z1) / 2, x, z);
      }
      g.lineTo(h1 + 0.5, z1);
      g.closePath();
      g.fillStyle = css(mix(fill, hex(REVEAL), 0.72), 0.92);
      g.fill();
      g.strokeStyle = css(mix(fill, [255, 250, 238], 0.55), 0.85);
      g.lineWidth = 0.2;
      g.stroke();
      if (level === 2) underLip(g, h1, c.h, 1.4);
    }, 30, 0.3);
    // The embers' light on the bowl and on the block's foot after dark.
    warm.push({ at: P(bowlF, 0, BOWL_H * 0.8), r: c0.hx[1] + BOWL_OUT, on: [...bowl, dishT, carved[1]], colour: '255, 150, 80', k: 0.5 });
    warm[warm.length - 2].on.push(...bowl);
    top = f; topH = c.h; topN = 1;
  }

  // 3: the iron-bound block, for a smelter.
  if (level >= 3) {
    const c = COURSES[2];
    const f = onTop(top, 0, topH, c.turn + 0.025 * hand);
    const rustAt = (half: number): number[] => [-half * 0.7, -half * 0.25, half * 0.15, half * 0.62];
    block(2, f, (g, fill, j, h0, h1) => {
      // The rust run down the stone under each band, in streaks.
      const T = rand(seed * 83 + j);
      for (const [z0] of BANDS) {
        if (z0 < 0.5) continue;
        for (const x of rustAt(h0)) {
          const xx = x + (T() - 0.5) * 0.4, len = 1.4 + T() * 1.6, w = 0.2 + T() * 0.14;
          const z = z0 - BAND_LIP;
          g.beginPath();
          g.moveTo(xx - w, z);
          g.lineTo(xx + w, z);
          g.lineTo(xx + w * 0.3, z - len);
          g.lineTo(xx - w * 0.4, z - len * 0.75);
          g.closePath();
          g.fillStyle = 'rgba(150, 84, 56, 0.6)';
          g.fill();
        }
      }
      // And a few rust flecks splashed under the lower one, on the post's head below.
      const L = rand(seed * 97 + j);
      for (let i = 0; i < 2; i++) lichen(g, L, (L() - 0.5) * 2 * (h0 - 0.8), 2.0 + L() * 2.4, 0.4 + L() * 0.3);
      if (level === 3) underLip(g, h1, c.h, 1.4);
    }, 40, 0.28);
    /*
     * Its two bands: forged iron strapped round it, standing well proud of
     * the stone with a chamfered lip over and under, each face riveted at its
     * ends and its middle, the rivet heads catching the light; each band laid
     * a side at a time.
     */
    const rivets = (g: Ctx, fill: RGB, half: number, h: number): void => {
      // A forge's scale along its foot.
      g.fillStyle = 'rgba(150, 96, 70, 0.32)';
      g.fillRect(-half, 0, 2 * half, h * 0.3);
      for (const x of [-half + 0.55, 0, half - 0.55]) {
        g.beginPath();
        g.arc(x + 0.05, h / 2 - 0.06, 0.3, 0, TAU);
        g.fillStyle = css(mix(fill, hex('#24232c'), 0.55), 0.9);
        g.fill();
        g.beginPath();
        g.arc(x - 0.04, h / 2 + 0.04, 0.21, 0, TAU);
        g.fillStyle = css(mix(fill, [240, 240, 244], 0.6), 0.95);
        g.fill();
      }
    };
    const hxAt = (z: number): number => c.hx[0] + ((c.hx[1] - c.hx[0]) * z) / c.h;
    for (const [z0, z1] of BANDS) {
      const box = (z: number, k: number, y: number): V3[] => [P(f, -hxAt(z) - k, z, -y), P(f, hxAt(z) + k, z, -y), P(f, hxAt(z) + k, z, y), P(f, -hxAt(z) - k, z, y)];
      const lo = box(z0, BAND_OUT, c.hy + BAND_OUT), hi = box(z1, BAND_OUT, c.hy + BAND_OUT);
      const over = box(Math.min(c.h, z1 + BAND_LIP), 0, c.hy), under = box(Math.max(0, z0 - BAND_LIP), 0, c.hy);
      const ctr = P(f, 0, (z0 + z1) / 2);
      const groups: Face[][] = [];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const len = Math.hypot(...sub(lo[j], lo[i]));
        const g: Face[] = [faceOut([lo[i], lo[j], hi[j], hi[i]], ctr, IRON, {
          crease: 0.5,
          frame: { o: mul(add(lo[i], lo[j]), 0.5), a: mul(sub(lo[j], lo[i]), 1 / len), b: mul(sub(hi[i], lo[i]), 1 / (z1 - z0)) },
          paint: (gg, kk) => rivets(gg, kk.fill, len / 2, z1 - z0),
        })];
        // Its lip over and under: chamfered in to the stone, or flat where the band is at the block's head or foot.
        g.push(faceOut([hi[i], hi[j], over[j], over[i]], ctr, IRON, { crease: 0.35 }, 3));
        g.push(faceOut([under[i], under[j], lo[j], lo[i]], ctr, IRON, { crease: 0.35 }, -3));
        groups.push(g);
      }
      warm[warm.length - 1].on.push(...sides(groups, 'c2'));
    }
    top = f; topH = c.h; topN = 2;
  }

  // 4: the thunderbird, for an anvil.
  if (level >= 4) {
    const c = COURSES[3];
    const f = onTop(top, 0, topH, c.turn + 0.02 * hand);
    block(3, f, (g, fill, j, h0, h1) => {
      if (j === 0) {
        // Its eyes, ringed and drilled, under its brow.
        for (const x of [-1.05, 1.05]) {
          cut(g, fill, 0.32, () => { g.beginPath(); g.arc(x, 4.75, 0.55, 0, TAU); });
          cut(g, fill, 0.42, () => { g.beginPath(); g.moveTo(x, 4.78); g.lineTo(x, 4.72); });
        }
        cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(-1.9, 5.55); g.quadraticCurveTo(0, 5.95, 1.9, 5.55); });
      } else if (j === 2) {
        // Two hammers crossed in a panel sunk in its back, over its rune.
        sunk(g, fill, () => { g.beginPath(); g.rect(-1.7, 3.85, 3.4, 1.95); });
        for (const sd of [-1, 1]) {
          cut(g, fill, 0.36, () => { g.beginPath(); g.moveTo(-sd * 1.25, 4.05); g.lineTo(sd * 0.9, 5.45); });
          cut(g, fill, 0.6, () => { g.beginPath(); g.moveTo(sd * 0.55, 5.6); g.lineTo(sd * 1.3, 5.12); });
        }
      } else {
        // Its sides, under the wings: feathers in rows.
        for (let z = 0.9; z < c.h - 0.4; z += 1.05) {
          cut(g, fill, 0.16, () => {
            g.beginPath();
            for (let x = -h0 + 0.3; x < h0 - 0.3; x += 0.9) { g.moveTo(x, z); g.quadraticCurveTo(x + 0.45, z - 0.55, x + 0.9, z); }
          });
        }
      }
      if (level === 4) underLip(g, h1, c.h, 1.4);
    }, 50, 0.28);
    // Its beak: hooked, out of its face between its eyes, its tip over the rune.
    {
      const y = c.hy - 0.05;
      const ridge = P(f, 0, 5.15, y + 0.45), l = P(f, -0.75, 4.3, y), r = P(f, 0.75, 4.3, y), tip = P(f, 0, 3.55, y + 1.85), u = P(f, 0, 3.8, y + 0.15), base = P(f, 0, 4.6, y);
      const b = [faceOut([ridge, l, tip], base, STONE), faceOut([ridge, tip, r], base, STONE), faceOut([l, u, tip], base, STONE), faceOut([u, r, tip], base, STONE), faceOut([ridge, r, base], base, STONE), faceOut([ridge, base, l], base, STONE)];
      const m = P(f, 0, 4.3, y + 1.4);
      solid(b, 'c3', m[0], m[1]);
    }
    /*
     * The wings: one each side, out of the block's side, swept back by an
     * eighth of a turn, clear of the bird's face. The block stands an eighth of a half turn off square
     * to every way the camera looks, so a wing swept so is never seen nearer
     * edge on than that, and the two never at once: from every side one is
     * seen spread. Their leading edge rises to a tip over the bird's head,
     * their trailing edge is fingered into four long feathers.
     */
    const wing = (sd: number): void => {
      const ca = Math.cos(WING_SWEEP), sa = Math.sin(WING_SWEEP);
      const wf: Frame = { o: P(f, sd * (c.hx[0] - 0.15), 0, 0.5), U: add(mul(f.U, ca), mul(f.A, sd * sa)), W: f.W, A: add(mul(f.U, -sd * sa), mul(f.A, ca)) };
      const pts: Pt[] = [
        [0, 0.7], [2.0, 1.05], [3.0, 0.1], [3.9, 1.5], [5.2, 0.55], [5.85, 2.15], [7.3, 1.6], [7.7, 3.2], [9.4, 3.15], [9.3, 4.5],
        [11.4, 7.3], [9.9, 7.05], [7.5, 6.05], [4.8, 5.5], [2.1, 5.35], [0, 5.3],
      ];
      const outline = pts.map(([s2, t]) => [s2 * sd, t] as Pt);
      const feathers: Painter = (g, k) => {
        // The coverts in an arc along it, and the long feathers out to their tips: deep cuts, each a lit lip on its far side.
        cut(g, k.fill, 0.3, () => {
          g.beginPath();
          g.moveTo(0.8 * sd, 4.55); g.quadraticCurveTo(5.2 * sd, 4.6, 10.3 * sd, 6.7);
          for (const [x, z] of [[3.0, 0.1], [5.2, 0.55], [7.3, 1.6], [9.4, 3.15]]) { g.moveTo((x - 1.3) * sd, z + 3.4); g.lineTo((x - 0.2) * sd, z + 0.45); }
        });
      };
      const wt = plate({
        ...wf, outline, half: [0.85, 0.85], tTop: 6, bevel: 0.22, tone: STONE,
        front: feathers, back: (g, k) => { g.scale(-1, 1); feathers(g, k); }, edgeCrease: 0.45,
      });
      const m = P(wf, sd * 5, 2.5);
      // Each its own box to be clicked by, so the air between a wing and the block is not the totem.
      warm[warm.length - 1].on.push(solid(wt, sd < 0 ? 'wingL' : 'wingR', m[0], m[1]));
    };
    wing(-1);
    wing(1);
    top = f; topH = c.h; topN = 3;
  }

  // 5: the crown, for a building and three wildermon at work.
  if (level >= 5) {
    const c = COURSES[4];
    const f = onTop(top, 0, topH, c.turn + 0.02 * hand);
    block(4, f, (g, fill, _j, h0, h1) => {
      margin(g, fill, h0, h1, 0.4, c.h - 0.5, c.h);
      underLip(g, h1, c.h, 1.6);
    }, 60, 0.25);
    const crownWarm = warm[warm.length - 1];
    /*
     * Its roof: a stone roof as a house's is, ridged front to back so its
     * gable looks out over the front, the eaves out past the block either
     * side and the gables a little past its faces; cut in courses of slates;
     * its barge boards ruled.
     */
    const E = c.hx[1] + EAVE, D = ROOF_T / Math.cos(Math.atan2(ROOF_RISE, E));
    const roofF: Frame = { ...f, o: P(f, 0, c.h) };
    const chevron: Pt[] = [[E, -D], [E, 0], [0, ROOF_RISE], [-E, 0], [-E, -D], [0, ROOF_RISE - D]];
    const slope = Math.hypot(E, ROOF_RISE);
    const barge: Painter = (g, k) => cut(g, k.fill, 0.15, () => { g.beginPath(); g.moveTo(-E + 0.6, -D * 0.5); g.lineTo(0, ROOF_RISE - D * 0.5); g.lineTo(E - 0.6, -D * 0.5); });
    const roof = plate({
      ...roofF, outline: chevron, half: [c.hy + GABLE_OUT, c.hy + GABLE_OUT], tTop: ROOF_RISE, bevel: 0.12, tone: ROOF,
      front: barge, back: barge,
      edge: (_i, up) => up > 0.35 ? {
        // A slope: its slates in courses along the eave, each course's joints staggered against the last.
        paint: (g, k) => {
          const half = c.hy + GABLE_OUT;
          for (let u = 0.8, row = 0; u < slope - 0.2; u += 0.78, row++) {
            cut(g, k.fill, 0.12, () => { g.beginPath(); g.moveTo(u, -half); g.lineTo(u, half); });
            for (let v = -half + (row % 2 ? 0.55 : 0.15); v < half; v += 0.95) {
              cut(g, k.fill, 0.08, () => { g.beginPath(); g.moveTo(u - 0.78, v); g.lineTo(u, v); });
            }
          }
          // Moss along its lowest course on the mossy end.
          const M = rand(seed * 7 + 5);
          for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.ellipse(0.4 + M() * 0.8, half - 0.5 - M() * 1.6, 0.35 + M() * 0.3, 0.5 + M() * 0.4, 0, 0, TAU);
            g.fillStyle = M() < 0.5 ? 'rgba(130, 168, 98, 0.85)' : 'rgba(168, 196, 120, 0.8)';
            g.fill();
          }
        },
        crease: 0.55,
      } : undefined,
      sunk: false, edgeCrease: 0.5,
    });
    const roofParts: Thing[] = [];
    // The gable under it, flush with the block's front and back, its apex tucked up under the ridge, bossed in gold.
    const gw = c.hx[1] + 0.05, apex = ROOF_RISE - D + 0.08;
    const boss = (g: Ctx, fill: RGB): void => {
      const z = apex * 0.4;
      g.beginPath();
      g.arc(0, z, 0.82, 0, TAU);
      g.fillStyle = css(mix(fill, hex(REVEAL), 0.4), 0.85);
      g.fill();
      g.beginPath();
      g.arc(0, z, 0.64, 0, TAU);
      g.fillStyle = css(GOLD.lit);
      g.fill();
      g.beginPath();
      g.arc(-0.17, z + 0.17, 0.26, 0, TAU);
      g.fillStyle = 'rgba(255, 246, 214, 0.95)';
      g.fill();
    };
    roofParts.push(solid(plate({
      ...roofF, outline: [[-gw, -0.05], [gw, -0.05], [0, apex]], half: [c.hy, c.hy], tTop: ROOF_RISE, bevel: 0.08, tone: STONE,
      front: (g, k) => boss(g, k.fill), back: (g, k) => boss(g, k.fill), sunk: true,
    }), 'roof', 0, 0, false));
    roofParts.push(solid(roof, 'roof'));
    /*
     * The finial: a gilt collar on the ridge's middle, a waist, an orb, and a
     * tall spike over the orb -- with the bosses, the only gold on it.
     */
    {
      const ff: Frame = { ...roofF, o: P(roofF, 0, ROOF_RISE - 0.15) };
      const rings: Array<[number, number]> = [[0.5, 0], [0.5, 0.35], [0.3, 0.5], [0.3, 0.75], [0.58, 0.95], [0.7, 1.3], [0.58, 1.65], [0.26, 1.85]];
      const n = 7;
      const pts = rings.map(([r, t]) => Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU + 0.3;
        return P(ff, Math.cos(a) * r, t, Math.sin(a) * r);
      }));
      const tip = P(ff, 0, 2.85);
      const ctr = P(ff, 0, 1.1);
      const out: Face[] = [];
      for (let b = 0; b + 1 < pts.length; b++) for (let i = 0; i < n; i++) out.push(faceOut([pts[b][i], pts[b][(i + 1) % n], pts[b + 1][(i + 1) % n], pts[b + 1][i]], ctr, GOLD, { crease: 0.25 }));
      for (let i = 0; i < n; i++) out.push(faceOut([pts[pts.length - 1][i], pts[pts.length - 1][(i + 1) % n], tip], ctr, GOLD, { crease: 0.25 }));
      roofParts.push(solid(out, 'roof', 0, 0, true));
    }
    crownWarm.on.push(...roofParts);
    /*
     * The three heads, for the three wildermon the crown was earned with:
     * carved out from three corners of the block, under the eaves, each with
     * a round skull, a blunt muzzle out in front, two big pricked ears, its
     * eyes and nose cut, and picked out in ochre; the fourth corner, at the
     * back, left plain.
     */
    const back = variant % 2 === 0 ? -1 : 1;
    const corners: Array<[number, number]> = [[-1, 1], [1, 1], [back, -1]];
    for (const [sx, sy] of corners) {
      const zc = 1.55;
      const base = P(f, sx * (c.hx[1] - 0.2), zc, sy * (c.hy - 0.2));
      const dir = unit(add(mul(f.U, sx * 0.85), mul(f.A, sy)));
      const side: V3 = [-dir[1], dir[0], 0];
      const ctr = at(base, [1.0, dir]);
      const up: V3 = [0, 0, 1];
      const n = 9;
      const ringAt = (r: number, dz: number, push: number, w = 1): V3[] => Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        return at(ctr, [ca * r + Math.max(0, ca) * push, dir], [sa * r * w, side], [dz, up]);
      });
      const rs = [ringAt(0.7, -0.95, 0.2, 0.9), ringAt(1.15, -0.35, 0.75, 0.95), ringAt(1.1, 0.3, 0.45), ringAt(0.72, 0.85, 0.05)];
      const out: Face[] = [];
      for (let b = 0; b < 3; b++) for (let i = 0; i < n; i++) out.push(faceOut([rs[b][i], rs[b][(i + 1) % n], rs[b + 1][(i + 1) % n], rs[b + 1][i]], ctr, OCHRE, { crease: 0.3 }));
      out.push(faceOut(rs[3].slice(), ctr, OCHRE, { crease: 0.3 }, 3));
      // The ears, big and pricked, either side of its crown.
      for (const e of [-1, 1]) {
        const eb = at(ctr, [-0.1, dir], [e * 0.5, side], [0.7, up]);
        const a0 = at(eb, [-0.34, side]), a1 = at(eb, [0.34, side]), a2 = at(eb, [-0.36, dir]), tipE = at(eb, [0.1, dir], [e * 0.25, side], [1.05, up]);
        for (const q of [[a0, a1, tipE], [a1, a2, tipE], [a2, a0, tipE]]) out.push(faceOut(q, eb, OCHRE, { crease: 0.45 }));
      }
      const [hx, hy] = [ctr[0] + dir[0] * 0.6, ctr[1] + dir[1] * 0.6];
      crownWarm.on.push(solid(out, 'roof', hx, hy));
      // Its eyes, its nose and its mouth, cut: seen only from its side of the block.
      const eyes = [-1, 1].map((e) => at(ctr, [0.95, dir], [e * 0.45, side], [0.2, up]));
      const nose = at(ctr, [1.85, dir], [-0.2, up]);
      const mouth = at(ctr, [1.6, dir], [-0.62, up]);
      things.push({
        x: hx + dir[0] * 0.05, y: hy + dir[1] * 0.05, part: 'roof',
        draw: (g, e) => {
          if (dot(dir, e.toward) <= 0.05) return;
          const across = Math.hypot(e.ux, e.uy);
          for (const q of eyes) {
            const [px, py] = proj(e, q);
            g.beginPath();
            g.ellipse(px, py, Math.max(0.55, 0.24 * across), Math.max(0.5, 0.19 * across), 0, 0, TAU);
            g.fillStyle = 'rgba(58, 42, 50, 0.95)';
            g.fill();
            g.beginPath();
            g.arc(px - 0.06 * across, py - 0.06 * across, Math.max(0.2, 0.07 * across), 0, TAU);
            g.fillStyle = 'rgba(255, 246, 226, 0.9)';
            g.fill();
          }
          const [nx, ny] = proj(e, nose);
          g.beginPath();
          g.ellipse(nx, ny, Math.max(0.5, 0.2 * across), Math.max(0.4, 0.13 * across), 0, 0, TAU);
          g.fillStyle = 'rgba(70, 50, 56, 0.9)';
          g.fill();
          const [mx, my] = proj(e, mouth);
          g.strokeStyle = 'rgba(90, 64, 70, 0.75)';
          g.lineWidth = Math.max(0.5, 0.09 * across);
          g.beginPath();
          g.moveTo(mx - 0.32 * across, my - 0.04 * across);
          g.quadraticCurveTo(mx, my + 0.12 * across, mx + 0.32 * across, my - 0.04 * across);
          g.stroke();
        },
      } as Part);
    }
  } else {
    const c = COURSES[topN];
    capstone(onTop(top, 0, topH, c.turn * 0.6 - 0.02 * hand), c.hx[1], c.hy, CAPS[level - 1], level);
  }

  /* -- grass and a few flowers round its foot -- */
  const colours = ['yellow', 'cream', 'rose'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + R() * 0.5, d = 6.8 + R() * 2.4;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const s0 = seed * 77 + i;
    const flower = i % 3 === 1;
    const colour = colours[(Math.floor(i / 3) + variant) % colours.length];
    things.push({
      x, y, reach: [[x, y, 4]],
      draw: (g, e) => {
        const [px, py] = proj(e, [x, y, 0.2]);
        if (flower) flowerClump(g, px, py, colour, s0, 0.45);
        else grassTuft(g, px, py, s0, 0.6);
      },
    });
  }

  const turf: Pt[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU, r = 9.0 + R() * 1.4;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.92] as Pt;
  });
  let topZ = 0;
  for (const t of solids) for (const f of t.faces ?? []) for (const p of f.pts) topZ = Math.max(topZ, p[2]);
  const model: Model = { things, solids, lit, carved, faces, embers, warm, glowAt, top: topZ, turf };
  models.set(key, model);
  return model;
}

/* ---- baking ------------------------------------------------------------------- */

/**
 * The light caught on a top's near arrises, as on a chamfer: a hair of pale
 * stone along each edge of an upward face that is nearer the eye than the
 * face's middle -- a capstone's rim, the bowl's lip, the outcrop's top. The
 * lantern's.
 */
function litEdges(g: Ctx, e: Eye, faces: readonly Face[], seed: number): void {
  const T = rand(seed);
  g.save();
  g.lineCap = 'round';
  for (const f of faces) {
    if (f.n[2] < 0.8 || dot(f.n, e.toward) <= 1e-6 || f.pts.length < 3) continue;
    const m = mid(f.pts);
    const m0 = dot(m, e.toward);
    const scr = f.pts.map((q) => proj(e, q));
    g.strokeStyle = f.tone === IRON ? 'rgba(226, 228, 236, 0.6)' : f.tone === GOLD ? 'rgba(255, 244, 200, 0.7)' : 'rgba(250, 242, 224, 0.55)';
    g.save();
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    for (let i = 0; i < f.pts.length; i++) {
      const j = (i + 1) % f.pts.length;
      if (dot(mul(add(f.pts[i], f.pts[j]), 0.5), e.toward) <= m0 + 0.05) continue;
      const [ax, ay] = scr[i], [bx, by] = scr[j];
      for (let u = T() * 0.1; u < 1;) {
        const len = 0.18 + 0.32 * T();
        const v = Math.min(1, u + len);
        g.lineWidth = 0.7 + 0.6 * T();
        g.beginPath();
        g.moveTo(ax + (bx - ax) * u, ay + (by - ay) * u);
        g.lineTo(ax + (bx - ax) * v, ay + (by - ay) * v);
        g.stroke();
        u = v + 0.05 + 0.14 * T();
      }
    }
    g.restore();
  }
  g.restore();
}

/**
 * How square on the eye must see a face for its runes' light to be laid, and
 * how much more for all of it: lower than the lantern's, so the runes on a
 * face seen slantwise are lit too, fainter, and not left as grey cuts.
 */
const GLOW_SEEN = 0.18;
const GLOW_FULL = 0.45;
/** The ink round its solids, in pixels at zoom one: the lantern's. */
const INK = 0.75;
/**
 * The colour of night on its stone, and how much of it stays on the totem
 * after dark whatever light falls there: less than on the lantern, which
 * stands in a light of its own that would lift its stone to white, where
 * this one stands in the night's wash and in whatever light is near it.
 */
const NIGHT_STONE = 'rgb(46, 44, 72)';
const NIGHT_KEEP = 0.2;
/** And of its gold, against its stone's: less, so the gilt still catches its runes' light. */
const GOLD_KEEP = 0.5;
/** How much of that night what grows and lies round its foot keeps, against its stone's; and the outcrop. */
const FLORA_KEEP = 0.5;
const OUTCROP_KEEP = 0.4;
/** The ink after dark, and how much of the night it keeps: a firm line, so the wings and the crown stand off the dark ground. */
const NIGHT_INK = 'rgb(30, 24, 40)';
const NIGHT_INK_KEEP = 0.75;
/** How much its runes add after dark against a runestone's: no lantern stands over them, so more than a lantern's (`HEAT` there). */
const HEAT = 0.45;

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What it covers from its footprint's middle, in pixels at zoom one: left, top, right, bottom. */
  bounds: [number, number, number, number];
  /** What it is clicked by: a box round each part of the totem, so the air between its wings and beside its stack is not it. */
  hits: Array<[number, number, number, number]>;
  /** The totem alone in the night's colour, less whatever stands in front of it; its outline's own night; and its lights on its stone. */
  shade: HTMLCanvasElement;
  rim: HTMLCanvasElement;
  warm: HTMLCanvasElement;
  glows: Glow[];
  nightGlows: Glow[];
  seen: number[];
  /** Each lit block's middle on the screen at zoom one from the footprint's middle, and the glow its breath is read off. */
  blooms: Array<{ course: number; at: Pt; glow: Glow }>;
}

const BAKED_BUDGET = 8e6;
const baked = new Map<string, Baked>();
let bakedArea = 0;
/** The last bake made of each token less its size. */
const lastBake = new Map<string, string>();

/** Its shade on the ground: where it lies from its foot and how big, in pixels at zoom one, longer the taller it stands. */
const shadeOf = (top: number): { x: number; y: number; rx: number; ry: number } => {
  const k = Math.min(1.7, 0.85 + top / 40);
  return { x: 6 * k, y: 2.4 * k, rx: 14 * k, ry: 5.2 * k };
};

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
  // And its shade on the ground, which is laid in screen pixels from its foot.
  const s = shadeOf(model.top);
  x0 = Math.min(x0, s.x - s.rx - 1); x1 = Math.max(x1, s.x + s.rx + 1); y0 = Math.min(y0, s.y - s.ry - 2); y1 = Math.max(y1, s.y + s.ry + 2);
  const pad = 6;
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

function bake(level: number, rotation: number, variant: number, scale: number): Baked {
  const model = modelOf(level, variant);
  const e = eyeOf(YAW, rotation);
  const [x0, y0, x1, y1] = measure(model, e);
  const [canvas, g] = canvasOf((x1 - x0) * scale, (y1 - y0) * scale);
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  g.setTransform(M0);

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
    const F = rand(variant * 991 + 11);
    const across = Math.hypot(e.ux, e.uy);
    for (let i = 0; i < 30; i++) {
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
    const s = shadeOf(model.top);
    g.fillStyle = 'rgba(44, 74, 78, 0.17)';
    g.beginPath();
    g.ellipse(s.x, s.y, s.rx, s.ry, 0.12, 0, TAU);
    g.fill();
  }

  /* -- everything standing, in order: the outcrop first, then the rest by where it stands -- */
  const things = model.things.slice().sort((a, b) => (a.first ? -1 : b.first ? 1 : groundNear(e, a.x, a.y) - groundNear(e, b.x, b.y)));
  for (const t of things) {
    if (t.draw) t.draw(g, e);
    else if (t.faces) {
      drawFaces(g, e, t.faces, INK, mix(STONE_INK, CREASE_INK, 0.4));
      if (model.lit.has(t)) litEdges(g, e, t.faces, t.faces.length * 7 + Math.round(t.x * 13));
    }
  }

  /* -- after dark: the night it keeps, its outline, and its lights on its own stone -- */
  const [shade, sg] = canvasOf(canvas.width, canvas.height);
  const [lone, lg] = canvasOf(canvas.width, canvas.height);
  sg.setTransform(M0);
  lg.setTransform(M0);
  sg.lineJoin = 'round';
  const poly = (h: Ctx | Path2D, pts: readonly V3[]): void => {
    if (!(h instanceof Path2D)) h.beginPath();
    pts.forEach((p, i) => { const [x, y] = proj(e, p); if (i) h.lineTo(x, y); else h.moveTo(x, y); });
    h.closePath();
  };
  const fillSolid = (h: Ctx, t: Thing, ink: boolean): void => {
    for (const f of t.faces ?? []) {
      if (dot(f.n, e.toward) <= 1e-6) continue;
      poly(h, f.pts);
      h.fill();
      if (ink) h.stroke();
    }
  };
  const gilt = (t: Thing): boolean => (t.faces ?? []).some((f) => f.tone === GOLD);
  for (const t of things) {
    if (model.solids.has(t)) {
      sg.globalCompositeOperation = 'source-over';
      sg.globalAlpha = gilt(t) ? GOLD_KEEP : 1;
      sg.fillStyle = sg.strokeStyle = NIGHT_STONE;
      sg.lineWidth = INK * 2;
      fillSolid(sg, t, true);
      sg.globalAlpha = 1;
      continue;
    }
    // Anything else, as its own shape: drawn alone, in the night's colour, laid over what it stands in front of.
    lg.save();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, lone.width, lone.height);
    lg.restore();
    lg.globalCompositeOperation = 'source-over';
    if (t.draw) t.draw(lg, e);
    else { lg.fillStyle = '#000'; fillSolid(lg, t, false); }
    lg.save();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-in';
    lg.fillStyle = NIGHT_STONE;
    lg.fillRect(0, 0, lone.width, lone.height);
    lg.restore();
    sg.save();
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'destination-out';
    sg.drawImage(lone, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.globalAlpha = t.first ? OUTCROP_KEEP : FLORA_KEEP;
    sg.drawImage(lone, 0, 0);
    sg.restore();
  }
  sg.globalCompositeOperation = 'source-over';
  sg.globalAlpha = 1;

  const [rim, rg] = canvasOf(canvas.width, canvas.height);
  rg.setTransform(M0);
  rg.lineJoin = 'round';
  {
    rg.fillStyle = rg.strokeStyle = NIGHT_INK;
    rg.lineWidth = INK * 2.6;
    let past = false;
    for (const t of things) {
      if (t.first) continue;
      if (model.solids.has(t)) {
        rg.globalCompositeOperation = 'source-over';
        fillSolid(rg, t, true);
        past = true;
        continue;
      }
      if (!past) continue;
      rg.globalCompositeOperation = 'destination-out';
      if (t.draw) t.draw(rg, e);
      else fillSolid(rg, t, false);
    }
    rg.globalCompositeOperation = 'destination-out';
    for (const t of things) if (model.solids.has(t)) fillSolid(rg, t, false);
    rg.globalCompositeOperation = 'source-over';
  }

  /*
   * Each light on its own stone after dark -- each block's runes, warmest at
   * the runes and gone a little past the block, and the embers on the bowl
   * and the block's foot -- on what it falls on, in the order they are drawn,
   * whatever stands in front taken off.
   */
  const [warm, wg] = canvasOf(canvas.width, canvas.height);
  wg.setTransform(M0);
  {
    const lightOn = new Map<Thing, CanvasGradient[]>();
    for (const w of model.warm) {
      const [cx, cy] = proj(e, w.at);
      const R = w.r * Math.hypot(e.ux, e.uy) * 1.35;
      const grad = wg.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, `rgba(${w.colour}, ${w.k})`);
      grad.addColorStop(0.55, `rgba(${w.colour}, ${(w.k * 0.45).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${w.colour}, 0)`);
      for (const t of w.on) lightOn.set(t, [...(lightOn.get(t) ?? []), grad]);
    }
    for (const t of things) {
      if (t.first) continue;
      const grads = lightOn.get(t);
      if (grads) {
        wg.globalCompositeOperation = 'source-over';
        // Laid on what is under it first, so a nearer part over a lit one takes its place.
        wg.save();
        wg.globalCompositeOperation = 'destination-out';
        wg.fillStyle = '#000';
        fillSolid(wg, t, false);
        wg.restore();
        for (const grad of grads) {
          wg.fillStyle = grad;
          fillSolid(wg, t, false);
        }
        continue;
      }
      wg.globalCompositeOperation = 'destination-out';
      wg.fillStyle = '#000';
      if (t.draw) t.draw(wg, e);
      else fillSolid(wg, t, false);
    }
    wg.globalCompositeOperation = 'source-over';
  }

  /* -- each rune's light, on the faces the eye sees, kept to its face and off whatever is drawn over it -- */
  const glows: Glow[] = [];
  const nightGlows: Glow[] = [];
  const seen: number[] = [];
  const blooms: Baked['blooms'] = [];
  /** What is drawn after a thing, as one outline the same way round: the faces the eye sees of every solid laid after it. */
  const overOf = (thing: Thing): Path2D => {
    const path = new Path2D();
    let past = false;
    for (const t of things) {
      if (t === thing) { past = true; continue; }
      if (!past || !model.solids.has(t)) continue;
      for (const f of t.faces ?? []) {
        if (dot(f.n, e.toward) <= 1e-6) continue;
        const pts = f.pts.map((p) => proj(e, p));
        let a2 = 0;
        for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; a2 += ax * by - bx * ay; }
        if (Math.abs(a2) < 1e-6) continue;
        (a2 > 0 ? pts : pts.reverse()).forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
        path.closePath();
      }
    }
    return path;
  };
  const keepTo = (c: HTMLCanvasElement, box: readonly number[], face: readonly V3[], over: Path2D): void => {
    const h = c.getContext('2d') as Ctx;
    h.setTransform(scale, 0, 0, scale, -box[0] * scale, -box[1] * scale);
    h.globalCompositeOperation = 'destination-in';
    poly(h, face);
    h.fill();
    h.globalCompositeOperation = 'destination-out';
    h.fill(over);
    h.globalCompositeOperation = 'source-over';
  };
  const overs = model.carved.map(overOf);
  for (const f of model.faces) {
    // Not on a face seen all but edge on; fainter as a face turns toward that, rather than gone at a step.
    const cos = dot(f.n, e.toward) / Math.hypot(...e.toward);
    if (cos < GLOW_SEEN) continue;
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const ease = 0.25 + 0.75 * fade * fade * (3 - 2 * fade);
    const [ox, oy] = proj(e, f.o), [ax, ay] = proj(e, f.a), [bx, by] = proj(e, f.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    for (const r of f.runes) {
      const spec = { ...r, w: Math.max(r.w ?? RUNE_W, RUNE_PX / scale) };
      const gl = bakeRune(M, { ...spec, inner: RUNE_INNER, mid: RUNE_MID, edge: RUNE_CHANNEL }, scale);
      const gn = bakeRune(M, { ...spec, inner: NIGHT_INNER, mid: NIGHT_MID }, scale);
      gl.fade = ease;
      // By day the groove alone, gold in its channel, with no haze round it.
      (gl.halo.getContext('2d') as Ctx).clearRect(0, 0, gl.halo.width, gl.halo.height);
      for (const c of [gl.core, gl.halo, gl.dusk, gl.mask, gn.core, gn.halo, gn.dusk, gn.mask]) keepTo(c, gl.box, f.poly, overs[f.course]);
      glows.push(gl);
      nightGlows.push(gn);
      seen.push(ease);
      const b = blooms.find((bb) => bb.course === f.course);
      if (!b) blooms.push({ course: f.course, at: proj(e, model.glowAt[f.course]), glow: gl });
    }
  }
  /*
   * The embers' light: each hot coal in the dish a spot of orange, the dish
   * itself kept to and whatever stands over it -- the block, the near side of
   * the bowl -- taken off; lit by day a little and breathing faster than the
   * runes, and after dark the warmest thing on it.
   */
  if (model.embers) {
    const em = model.embers;
    const [ox, oy] = proj(e, em.o), [ax, ay] = proj(e, em.a), [bx, by] = proj(e, em.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    const reach = Math.max(...em.dots.map(([x, y]) => Math.hypot(x, y))) + 0.6;
    const path = (h: Ctx): void => {
      h.beginPath();
      for (const [x, y, r] of em.dots) { h.moveTo(x + r * 0.6, y); h.arc(x, y, r * 0.6, 0, TAU); }
    };
    for (const night of [false, true]) {
      const gl = bakeGlow(M, path, 0, 0, reach / 1.9, false, -1, scale, Math.max(0.35, 1.2 / scale), 1.3, night ? { ...EMBER, inner: '#ffe2a0' } : EMBER);
      (gl.halo.getContext('2d') as Ctx).clearRect(0, 0, gl.halo.width, gl.halo.height);
      const over = overOf(em.dish);
      for (const c of [gl.core, gl.halo, gl.dusk, gl.mask]) keepTo(c, gl.box, em.poly, over);
      gl.fade = 1;
      (night ? nightGlows : glows).push(gl);
      if (!night) seen.push(1);
    }
  }
  // What it is clicked by: a box round each part of it.
  const boxes = new Map<string, [number, number, number, number]>();
  for (const t of model.things as Part[]) {
    if (!model.solids.has(t) || !t.part) continue;
    const b = boxes.get(t.part) ?? [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of t.faces ?? []) for (const p of f.pts) {
      const [x, y] = proj(e, p);
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
    boxes.set(t.part, b);
  }
  const hits = [...boxes.values()].map(([l, t, r, b]) => [Math.floor(l - 1), Math.floor(t - 1), Math.ceil(r + 1), Math.ceil(b + 1)] as [number, number, number, number]);
  return {
    canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hits,
    shade, rim, warm, glows, nightGlows, seen, blooms,
  };
}

/** The blocks a settlement of `level` shows: one to a level, never fewer than one nor more than there are blocks. */
export const deedTotemStage = (level: number): number => Math.max(1, Math.min(MAX_DEED_LEVEL, COURSES.length, Math.round(level)));

function bakedFor(look: DeedTotemLook, rotation: number, zoom: number): Baked {
  const scale = scaleFor(zoom);
  const level = deedTotemStage(look.level);
  const turn = ((rotation % 8) + 8) % 8;
  const piece = `${level}|${turn}|${look.variant}`;
  const key = `${piece}|${scale}`;
  let b = baked.get(key);
  if (b) {
    baked.delete(key);
    baked.set(key, b);
    return b;
  }
  // While the zoom moves, the bake at the last size stands in (`standIn`): a token's is a tenth of a second.
  const other = standIn(baked, lastBake, piece, key);
  if (other) return other;
  b = bake(level, turn, look.variant, scale);
  baked.set(key, b);
  bakedArea += b.canvas.width * b.canvas.height;
  for (const [k, old] of baked) {
    if (bakedArea <= BAKED_BUDGET || k === key) break;
    baked.delete(k);
    bakedArea -= old.canvas.width * old.canvas.height;
  }
  return b;
}

/** How a token is drawn: the level of its settlement (`deedLevel`), and which of its cuts it is (`deedTotemVariant`). */
export interface DeedTotemLook {
  level: number;
  variant: number;
}

/* ---- drawing it ------------------------------------------------------------------------ */

/**
 * Draw a settlement's token whose footprint's middle is at (sx, sy) on the
 * screen, from viewpoint `rotation`, at `t` seconds, under a night `night`
 * dark: the bake, and unless `live` is false its runes' light over it
 * (`drawDeedTotemLive`). Returns what it covers from (sx, sy), in screen
 * pixels: left, top, right, bottom.
 */
export function drawDeedTotem(ctx: Ctx, sx: number, sy: number, zoom: number, look: DeedTotemLook, rotation: number, night = 0, t = performance.now() / 1000, live = true): [number, number, number, number] {
  const b = bakedFor(look, rotation, zoom);
  const k = zoom / b.scale;
  if (live) drawDeedTotemBloom(ctx, sx, sy, zoom, look, rotation, night, t);
  const x = sx - b.ox * k, y = sy - b.oy * k, w = b.canvas.width * k, h = b.canvas.height * k;
  ctx.drawImage(b.canvas, x, y, w, h);
  if (night > 0.02) {
    const wasA = ctx.globalAlpha;
    ctx.globalAlpha = wasA * night * NIGHT_KEEP;
    ctx.drawImage(b.shade, x, y, w, h);
    ctx.globalAlpha = wasA * night * NIGHT_INK_KEEP;
    ctx.drawImage(b.rim, x, y, w, h);
    ctx.globalAlpha = wasA * night;
    ctx.drawImage(b.warm, x, y, w, h);
    ctx.globalAlpha = wasA;
  }
  if (live) drawDeedTotemLive(ctx, sx, sy, zoom, look, rotation, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/** How far a lit block's bloom reaches after dark, in pixels at zoom one; and how wide the sheen up the stack is. */
const BLOOM = 15;
const SHEEN = 7;

/**
 * After dark, a pale gold bloom round each lit block, breathing with its
 * runes, the foot's first, and a faint sheen up the stack between the lowest
 * and the highest: laid before the stone (`drawDeedTotem`), so it lights the
 * air round the totem and not the totem itself.
 */
export function drawDeedTotemBloom(ctx: Ctx, sx: number, sy: number, zoom: number, look: DeedTotemLook, rotation: number, night = 0, t = performance.now() / 1000): void {
  if (night <= 0.02) return;
  const b = bakedFor(look, rotation, zoom);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const { at: [bx, by], glow } of b.blooms) {
    const p = breath(glow, t);
    const x = sx + bx * zoom, y = sy + by * zoom, R = BLOOM * zoom;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, R);
    grad.addColorStop(0, `rgba(255, 214, 160, ${(0.15 * night * (0.7 + 0.3 * p)).toFixed(3)})`);
    grad.addColorStop(0.45, `rgba(255, 206, 150, ${(0.055 * night * (0.8 + 0.2 * p)).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 206, 150, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
  }
  if (b.blooms.length > 1) {
    const ys = b.blooms.map((q) => q.at[1]), xs = b.blooms.map((q) => q.at[0]);
    const xm = sx + (xs.reduce((s, v) => s + v, 0) / xs.length) * zoom, top = sy + Math.min(...ys) * zoom, bot = sy + Math.max(...ys) * zoom;
    const W = SHEEN * zoom;
    const grad = ctx.createLinearGradient(xm - W, 0, xm + W, 0);
    grad.addColorStop(0, 'rgba(255, 210, 150, 0)');
    grad.addColorStop(0.5, `rgba(255, 210, 150, ${(0.06 * night).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 210, 150, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(xm - W, top - BLOOM * 0.4 * zoom, 2 * W, bot - top + BLOOM * 0.8 * zoom);
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** What of a token moves, over its bake: its runes' light and its embers as they breathe. */
export function drawDeedTotemLive(ctx: Ctx, sx: number, sy: number, zoom: number, look: DeedTotemLook, rotation: number, night = 0, t = performance.now() / 1000): void {
  const b = bakedFor(look, rotation, zoom);
  b.glows.forEach((gl, i) => { gl.fade = b.seen[i] * (1 - night); });
  b.nightGlows.forEach((gl, i) => { gl.fade = b.seen[i] * night; });
  drawGlows(ctx, b.glows, sx, sy, zoom, night, t, HEAT);
  if (night > 0.01) drawGlows(ctx, b.nightGlows, sx, sy, zoom, night, t, HEAT);
}

/** What it is clicked by, from its footprint's middle, in pixels at zoom one: a box round each part of it, not the outcrop. */
export function deedTotemHits(look: DeedTotemLook, rotation: number, zoom = 1): ReadonlyArray<[number, number, number, number]> {
  return bakedFor(look, rotation, zoom).hits;
}

/** What it covers from its footprint's middle, in pixels at zoom one, turf and shade and all. */
export function deedTotemBounds(look: DeedTotemLook, rotation: number, zoom = 1): [number, number, number, number] {
  return bakedFor(look, rotation, zoom).bounds;
}

/**
 * How it takes the night back off itself, drawn at a zoom, for the
 * runestones' keeping (`RunestoneNight.source`): each rune and ember in its
 * own shape and a soft hole round each, and a small one at each lit block --
 * each faded as its face turns away.
 */
export function deedTotemNight(look: DeedTotemLook, rotation: number, zoom: number): NightSource {
  const b = bakedFor(look, rotation, zoom);
  let l = 0, tp = 0, r = 0, bt = 0;
  for (const { at: [x, y] } of b.blooms) {
    l = Math.min(l, x - BLOOM); r = Math.max(r, x + BLOOM); tp = Math.min(tp, y - BLOOM); bt = Math.max(bt, y + BLOOM);
  }
  return {
    glows: b.glows,
    rise: 0,
    reach: [l, tp, r, bt],
    holes: (sx, sy, z, t): NightHole[] => {
      const out = glowHoles(b.glows, sx, sy, z, t, 1.5).map((h, i) => ({ ...h, a: h.a * b.seen[i] }));
      for (const { at: [x, y], glow } of b.blooms) {
        const p = breath(glow, t);
        out.push({ x: sx + x * z, y: sy + y * z, r: BLOOM * z, a: 0.16 + 0.05 * p });
      }
      return out;
    },
    masks: (sx, sy, z, t): NightMask[] => glowMasks(b.glows, sx, sy, z, t).map((mk, i) => ({ ...mk, a: mk.a * b.seen[i] })),
  };
}

/** Which of its cuts the token on tile (x, y) is. */
export const deedTotemVariant = (x: number, y: number): number => Math.floor(hashOf(x, y, 7, 4111) * DEED_TOTEM_VARIANTS) % DEED_TOTEM_VARIANTS;
