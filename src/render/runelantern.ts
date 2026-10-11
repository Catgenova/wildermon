import type { Side } from '../game/building';
import { furnitureCentre, type PlacedFurniture } from '../game/furniture';
import { LAMP_CAST_ALPHA } from '../game/lamps';
import type { LightSource } from '../game/light';
import { VIEWS } from './view';
import { HALF_H } from './iso';
import { hashOf, rand, STAGES, strandPic, PPM } from './ivy';
import {
  add, at, sub, unit, bakeGlow, canvasOf, cut, dot, drawFaces, drawGlows, drawPads, flowerClump, glowHoles, glowMasks,
  glyphPath, grassTuft, groundNear, hex, mix, RUNE_GOLD, RUNE_WHITE, STONE_INK, CREASE_INK, mossOver, mul, newell, noise2, plate, proj, scaleFor, strokesPath, roundelStrokes, eyeOf, css,
  type Ctx, type Eye, type Face, type Glow, type GlowSpec, type NightHole, type NightMask, type NightSource, type Pad, type PaintCtx, type Painter, type Pt, type Thing, type Tone, type V3,
  toneOf, TAU,
} from './runestone';

/**
 * A rune lantern post (`game/runelantern.ts`), drawn as the runestones are
 * (`runestone.ts`), from their kit: a small model of faceted solids in tenths
 * of a metre, put on the screen through the camera's turn, baked for each way
 * it is seen and each scale, and the runes' light laid over the bake.
 *
 * A squat pillar a little over chest high on a low outcrop: a shaft tapered
 * and leaning, a corner knocked off its head, with a sun cut in its front; a
 * band set deep under a broad capstone dropped at one corner, a dark reveal
 * round each face and the cap's shadow across its head, one rune lit in each
 * face like a lantern's firebox; and over the cap the low stub of a taller
 * capstone broken off across a sheared diagonal, its fracture paler and
 * rougher than the dressed stone and seen from every side. The runes breathe
 * one after another round the band. It
 * stands an eighth of a half turn off square to the way it faces, as the
 * runestones do, each course turned a little off the last.
 *
 * Moss gathers on it as on any stone set down out of doors (`greening.ts`),
 * on its front and right shoulder as a runestone's on its mossy side: a lump
 * on the cap and a first sprig of ivy from the first days, two from halfway
 * with a mass of moss up the shaft's foot, cushions on the outcrop and the
 * ivy halfway up, three at the end with the ivy at the ledge and a strand
 * hanging off the cap's corner. Grass and chalk
 * flowers grow round its foot from the first day.
 *
 * After dark its stone keeps some of the night whatever light falls on it,
 * and what grows round it a little less; each face of the band is a window
 * lit from inside, pale gold behind its rune; the band lights its own stone, down
 * the shaft from under the band to nothing at its foot and up the cap's
 * underside, so the band is the brightest thing on it; a bloom round the band
 * and a pool at its foot light the ground and not the stone; and the runes
 * take the night off themselves in their own shapes, each kept to its own face
 * of the band and off whatever stands in front (`runeLanternNight`, laid by
 * the runestones' `RunestoneNight`). The light it throws on the ground is the
 * game's (`runeLanternLight`).
 */

/** How far off square to the way it faces it stands: an eighth of a half turn, as the runestones are turned. */
const ASKEW = Math.PI / 8;
/** The way a piece facing each side has its front turned, as a heading is (`eyeOf`): nought faces south. */
const YAW: Record<Side, number> = { s: 0, e: -Math.PI / 2, n: Math.PI, w: Math.PI / 2 };

/** How many ways one may be cut, so a street of them is not one stone over and over: by where it stands. */
export const RUNE_LANTERN_VARIANTS = 3;

/* ---- the stone ----------------------------------------------------------------- */

/** The pillar's stone, the runestones' warm cream, the shade a warm mauve-grey well under it, so its two faces read as two; the band a step cooler, as stone set back out of the sun is; the outcrop a step darker. */
const STONE: Tone = toneOf('#eadbc2', '#a89794');
const BAND: Tone = toneOf('#d3c2ae', '#94827f');
const ROCK: Tone = toneOf('#dccbb5', '#9e8f8d');
/** The broken face of its capstone: paler than the dressed stone round it, as fresh fracture is. */
const FRACTURE: Tone = toneOf('#f9f0de', '#cbb9ac');

/** Where the solids stand, up from the ground, in units: the outcrop's top, then the shaft, the band, the cap and the head. */
const OUTCROP_H = 1.7;
const FOOT = 1.0;
const SHAFT_H = 4.0;
const BAND_H = 2.8;
const CAP_H = 1.45;
/** How far the shaft leans, across and toward its front, per unit up: a hair, so it is not set out with a rule. */
const LEAN: [number, number] = [0.018, -0.012];

/** The runes round the band: the sun-stave and stars, one to a face, in order round it, from where its cut starts in this list. */
const BAND_RUNES = ['sowilo', 'sunDot', 'star6', 'algiz', 'diamondDot', 'ingwaz', 'tiwaz', 'star8'];
/** How big a rune on the band is, in units from its middle to its top, and how wide its groove. */
const RUNE_S = 1.3;
const RUNE_W = 0.42;
/** The least a rune's lit groove is across at a scale, as units times the scale: its gold, the middle seven tenths of it (`bakeGlow`), at least a pixel on the screen. */
const RUNE_PX = 1.45;
/** And its cut channel round that, darker: so much wider again on the screen, in pixels. */
const CHANNEL_PX = 2.6;
/** How high a face's rune stands up the band, and how far either side of it a drilled dot is. */
const RUNE_Z = 1.32;
const DOT_X = 1.48;
/** The reveal round a face of the band and the cap's shadow across its head: a cool grey-mauve a step under the band's shade. */
const REVEAL = '#5a5266';
/**
 * A rune's lit groove: the runestones' own gold through and through, without
 * their all-but-white middle, so that in the island's warm light over it at
 * night it peaks a pale gold and never lemon or white.
 */
const RUNE_INNER = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6));
const RUNE_MID = RUNE_GOLD;
/** The edge of its groove round the gold: the shadow down the side of its cut channel, not a runestone's amber, so a small rune reads as cut and not as a blur of light. */
const RUNE_CHANNEL = 'rgba(112, 84, 74, 0.9)';
/**
 * And after dark, under the island's warm light, which lays about 46, 37, 23
 * over it at the lantern: the same gold and white taken down to what that
 * light lifts to a pale gold of about 255, 238, 185 and no further.
 */
const NIGHT_LIFT: [number, number, number] = [46, 37, 23];
const NIGHT_INNER = css(mix(hex(RUNE_WHITE), hex(RUNE_GOLD), 0.6).map((v, i) => Math.min(v, [255, 238, 185][i] - NIGHT_LIFT[i] - 1)) as [number, number, number]);
const NIGHT_MID = css(hex(RUNE_GOLD).map((v, i) => Math.min(v * 0.92, [255, 222, 150][i] - NIGHT_LIFT[i])) as [number, number, number]);
/**
 * The window each face of the band is after dark, lit from inside behind its
 * rune: pale gold at the rune, a dim warm at the reveal round it.
 */
const WINDOW: Array<[number, string]> = [[0, 'rgba(246, 227, 176, 0.95)'], [0.5, 'rgba(222, 186, 138, 0.9)'], [1, 'rgba(138, 106, 88, 0.85)']];

interface Model {
  things: Thing[];
  /** The pillar's own solids, without the outcrop or anything round it: what it is picked by. */
  pillar: Face[];
  /** The things that are the pillar, for its shade after dark (`Baked.shade`); and of them the shaft and the cap, which the band lights (`Baked.warm`). */
  solids: Set<Thing>;
  /** The things whose tops catch the light on their near arrises (`litEdges`). */
  lit: Set<Thing>;
  shaftT: Thing;
  capT: Thing;
  /** The foot of the band, the foot of the shaft and the foot of the cap, up from the ground: where its light on its own stone is laid from. */
  heights: { band: V3; foot: V3; cap: V3 };
  /** What stands over the band and in front of its top, the cap and the head: no rune's light is laid over them. */
  over: Face[];
  /** The band's four faces as frames runes are laid in: across each as the eye sees it, and up it. */
  band: Array<{ o: V3; a: V3; b: V3; n: V3; runes: GlowSpec[]; poly: V3[]; xs: number }>;
  /** The middle of the band, and the top of the head. */
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
 * How far a face of it turned along (nx, ny) in its own frame has greened
 * against the rest, nought to one: as a runestone has a mossy side
 * (`Spec.mossSide`), its front and right shoulder take the moss and the ivy,
 * its back and left the least, so the moss is on the side it is seen from
 * when it is set down facing the way it is meant to be looked at.
 */
const shadeOf = (nx: number, ny: number): number => Math.max(0, Math.min(1, 0.5 + 0.3 * nx + 0.3 * ny));
/** Its mossy side in its own frame: its right, and its front. */
const MOSS_SIDE = 1;
const MOSS_FRONT = 1;

const models = new Map<string, Model>();

/**
 * The model for a pillar facing `yaw`, its moss at `moss` of the way on,
 * nought to one, and cut the `variant`th way.
 */
function modelOf(yaw: number, moss: number, variant: number): Model {
  const key = `${yaw.toFixed(3)}|${moss.toFixed(3)}|${variant}`;
  const had = models.get(key);
  if (had) return had;
  const seed = 401 + variant * 97;
  const R = rand(seed);
  const things: Thing[] = [];
  const m = moss;
  /*
   * How far each growth has got, nought to one, so the stages read apart:
   * a lump on the cap and a first sprig of ivy from the first, cushions on
   * the outcrop and at the shaft's foot from halfway, the ivy climbing to the
   * band by the end.
   */
  const capM = Math.min(1, m / 0.6);
  const footM = Math.min(1, Math.max(0, (m - 0.15) / 0.7));
  const ivyM = Math.max(0, (m - 0.2) / 0.8);
  // Which way across it is shady, in its own frame: its left (-1) or its right (1).
  const shadySide = MOSS_SIDE;
  const shadyFront = MOSS_FRONT;
  const W: V3 = [LEAN[0], LEAN[1], 1];
  const U: V3 = [1, 0, 0];
  const A: V3 = [0, 1, 0];

  /* -- moss on an upright face: cushions up from its foot, more and higher the shadier the face -- */
  const footMoss = (g: Ctx, k: PaintCtx, x0: number, x1: number, shade: number, salt: number, rise = 1.8): void => {
    const amount = footM * (0.15 + 0.95 * shade);
    if (amount <= 0.08) return;
    const T = rand(seed * 13 + salt);
    const tr = g.getTransform(), inv = k.base.inverse();
    const across = Math.hypot(k.e.ux, k.e.uy) * 0.9;
    // How long a unit across the face and up it is where the pads are laid: a face seen slantwise has its cushions narrowed as it is.
    const o0 = inv.transformPoint(tr.transformPoint(new DOMPoint(0, 0)));
    const o1 = inv.transformPoint(tr.transformPoint(new DOMPoint(1, 0)));
    const o2 = inv.transformPoint(tr.transformPoint(new DOMPoint(0, 1)));
    const kx = Math.max(0.3 * across, Math.min(across, 0.9 * Math.hypot(o1.x - o0.x, o1.y - o0.y)));
    const kz = Math.max(0.3 * across, Math.min(across, 0.9 * Math.hypot(o2.x - o0.x, o2.y - o0.y)));
    const ps: Pad[] = [];
    /*
     * One mass up from the foot, cushions close enough to run together: its
     * top lobed where the noise has it, dropping all but away here and there;
     * its foot ragged too, the ground showing under it in places; and strays
     * over it where it is creeping up.
     */
    // Noise along a row of its lattice, not between two, so it swings its whole way.
    const n1 = (x: number): number => noise2(x / 0.9, 0, seed + salt), n2 = (x: number): number => noise2(x / 0.38, 3, seed + salt);
    const top = (x: number): number => (0.4 + rise * amount) * Math.max(0, 0.15 + 1.25 * n1(x) + 0.6 * (n2(x) - 0.5));
    const low = (x: number): number => 0.05 + 0.55 * noise2(x / 0.7, 6, seed + salt) * (1 - 0.5 * amount);
    for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.42 + 0.25 * T()) {
      const h = top(x), z0 = low(x);
      for (let z = z0; z < h; z += 0.5 + 0.2 * T()) {
        const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x + (T() - 0.5) * 0.3, z)));
        const r = (0.5 + 0.4 * T()) * (0.75 + 0.5 * Math.min(1, h / 1.4)) * (z + 0.6 > h ? 0.8 : 1);
        ps.push([q.x, q.y, r * kx, r * kz]);
      }
      if (T() < 0.18 + 0.35 * amount) {
        const z = Math.max(h, z0) + 0.35 + T() * 0.9;
        const q = inv.transformPoint(tr.transformPoint(new DOMPoint(x + (T() - 0.5) * 0.5, z)));
        const r = 0.3 + 0.3 * T();
        ps.push([q.x, q.y, r * kx, r * kz]);
      }
    }
    g.save();
    g.setTransform(k.base);
    drawPads(g, ps);
    g.restore();
  };

  /* -- moss over a top, as far in from its shady edge as it has got -- */
  const topMoss = (g: Ctx, k: PaintCtx, len: number, half: number, shade: number, salt: number, corner = false): void => {
    const amount = capM * (0.45 + 0.8 * shade);
    if (amount <= 0.04) return;
    const T = rand(seed * 17 + salt);
    const tr = g.getTransform(), inv = k.base.inverse();
    const across = Math.hypot(k.e.ux, k.e.uy);
    const ps: Pad[] = [];
    /*
     * Out from its mossy corner -- the back of its mossy end, where the
     * edge starts, or ends where `corner` says -- in one lobed mass,
     * as far as it has got: a fleck or two at first, a cushioned shoulder
     * at the end.
     */
    const edge = -shadyFront * half;
    const R0 = 0.8 + 3.2 * amount;
    for (let u = 0.3; u < Math.min(len - 0.3, R0 * 1.6); u += 0.75 + 0.3 * T()) {
      for (let d = 0.3; d < 2 * half - 0.3; d += 0.75 + 0.25 * T()) {
        const du = u / (R0 * 1.6), dd = d / R0;
        const reach = 0.75 + 0.5 * noise2(u / 1.4, d / 1.4, seed + salt);
        if (du * du + dd * dd > reach * reach) continue;
        const q = inv.transformPoint(tr.transformPoint(new DOMPoint(corner ? len - u : u, edge + shadyFront * d)));
        const r = (0.6 + 0.45 * T()) * (0.8 + 0.5 * amount);
        ps.push([q.x, q.y, r * across, r * across * 0.62]);
      }
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
  const bandRunes = (face: number): GlowSpec[] => [{
    glyph: BAND_RUNES[(face * 2 + variant * 3) % BAND_RUNES.length], x: 0, z: RUNE_Z, s: RUNE_S, i: face * 2, w: RUNE_W,
  }];
  const carveBand = (g: Ctx, fill: [number, number, number], half: number, runes: GlowSpec[], salt: number): void => {
    skin(g, fill, -half, half, BAND_H, salt, false);
    // A cool dark reveal round the face, where it is set in under the cap and over the shaft's ledge.
    g.strokeStyle = css(hex(REVEAL), 0.5);
    g.lineWidth = 0.42;
    g.strokeRect(-half + 0.12, 0.1, 2 * half - 0.24, BAND_H - 0.2);
    // The cap's shadow across its head: hard along its lip, and soft under that.
    g.fillStyle = css(hex(REVEAL), 0.22);
    g.fillRect(-half - 1, BAND_H - 1.0, 2 * half + 2, 2);
    g.fillStyle = css(hex(REVEAL), 0.55);
    g.fillRect(-half - 1, BAND_H - 0.42, 2 * half + 2, 2);
    // A drilled dot either side of its rune.
    for (const x of [-DOT_X, DOT_X]) cut(g, fill, 0.26, () => { g.beginPath(); g.moveTo(x, RUNE_Z + 0.03); g.lineTo(x, RUNE_Z - 0.03); });
    // The channel each is cut in, never so narrow on the screen that its dark does not show either side of its gold.
    const tr = g.getTransform();
    const px = Math.max(1e-6, Math.min(Math.hypot(tr.a, tr.b), Math.hypot(tr.c, tr.d)));
    for (const r of runes) cut(g, fill, Math.max(RUNE_W, CHANNEL_PX / px), () => glyphPath(g, r.glyph, r.x, r.z, r.s));
  };

  /*
   * A rock of the outcrop: a ring of six to eight corners on the ground, one
   * up its side a little in, and a broad top a little in from that, each
   * corner pushed about by its seed -- a flat-topped, faceted stone, as the
   * runestones' outcrops are split, not a rounded one; moss over its top and
   * down the sides seen as far as `moss` says (`mossOver`).
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
        const mid = mul(add(lo[i], lo[j]), 0.5);
        const f = face([lo[i], lo[j], hi[j], hi[i]], add([mid[0] - cx, mid[1] - cy, 0], [0, 0, b * 0.8]));
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

  /* -- the outcrop it stands on, and rocks hugging its foot -- */
  const outcropT: Thing = { x: 0, y: 0, first: true, faces: slab(0, 0, 5.6, 5.1, OUTCROP_H, R() * TAU, seed * 3 + 1, footM * 0.75) };
  things.push(outcropT);
  for (let i = 0; i < 3; i++) {
    const a = ((i + 0.3 + R() * 0.4) / 3) * TAU, d = 5.4 + R() * 1.0;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const r = 1.5 + R() * 0.7;
    const sh = shadeOf(Math.cos(a), Math.sin(a));
    things.push({ x, y, faces: slab(x, y, r, r * (0.68 + R() * 0.25), 0.55 + R() * 0.35, R() * TAU, seed * 17 + i, footM * (0.1 + 0.4 * sh)) });
  }

  /*
   * Fat cushions on the outcrop's shady shoulder, as on the runestones'
   * outcrops, big enough to carry their flecks of light: from halfway on.
   */
  if (footM > 0) {
    // At the foot of the shaft's mossy corner, banked up against it.
    const fx = shadySide * 3.25, fy = shadyFront * 2.75, fr = 1.2 + 1.0 * footM;
    things.push({
      x: fx * 1.06, y: fy * 1.06, reach: [[fx, fy, OUTCROP_H + 2]],
      draw: (g, e) => {
        const T = rand(seed * 43 + 1);
        const across = Math.hypot(e.ux, e.uy);
        const ps: Pad[] = [];
        for (let j = 0; j < 4; j++) {
          const [px, py] = proj(e, [fx + (T() - 0.5) * fr * 1.4, fy + (T() - 0.5) * fr * 1.2, FOOT + 0.25 + T() * 0.5]);
          const rr = fr * (0.6 + 0.4 * T());
          ps.push([px, py, rr * across, rr * across * 0.8]);
        }
        drawPads(g, ps);
      },
    });
    const d = Math.hypot(shadySide, shadyFront);
    for (const [k, r, salt] of [[1, 1.0 + 0.8 * footM, 1], [-0.45, 0.6 + 0.5 * footM, 2]] as Array<[number, number, number]>) {
      const ax = (shadySide / d) * (k > 0 ? 1 : -0.3) + (k > 0 ? 0 : shadyFront * 0.9), ay = (shadyFront / d) * (k > 0 ? 1 : 0.5);
      const al = Math.hypot(ax, ay) || 1;
      const cx = (ax / al) * 4.9, cy = (ay / al) * 4.4;
      if (k < 0 && footM < 0.6) continue;
      things.push({
        x: cx, y: cy, reach: [[cx, cy, OUTCROP_H + 2]],
        draw: (g, e) => {
          const T = rand(seed * 41 + salt);
          const across = Math.hypot(e.ux, e.uy);
          const ps: Pad[] = [];
          for (let j = 0; j < 5; j++) {
            const [px, py] = proj(e, [cx + (T() - 0.5) * r * 1.6, cy + (T() - 0.5) * r * 1.2, OUTCROP_H * 0.75]);
            const rr = r * (0.55 + 0.45 * T());
            ps.push([px, py, rr * across, rr * across * 0.7]);
          }
          drawPads(g, ps);
        },
      });
    }
  }

  /* -- the shaft: a tapered block, a hair askew, a sun cut in its front -- */
  const shaftF: Frame = { o: [0, 0, FOOT], U, W, A };
  /** A frame on top of another at (s, t) of its outline, turned `d` about the upright from it and leaning `lean` more: no course laid square on the last. */
  const onTop = (f: Frame, s: number, t: number, d: number, lean: [number, number] = [0, 0]): Frame => {
    const c = Math.cos(d), n = Math.sin(d);
    return { o: P(f, s, t), U: [c, n, 0], W: [LEAN[0] + lean[0], LEAN[1] + lean[1], 1], A: [-n, c, 0] };
  };
  const shaftOutline: Pt[] = [[-3.5, 0], [3.45, 0], [2.95, SHAFT_H - 0.42], [2.58, SHAFT_H], [-2.88, SHAFT_H - 0.05]];
  const shaftHalf: [number, number] = [3.2, 2.5];
  const sun = R() < 0.5 ? 'sun' : 'star8';
  const shaftFace = (front: boolean): Painter => (g, k) => {
    const fill = k.fill;
    skin(g, fill, -3.5, 3.5, SHAFT_H, front ? 1 : 2, true);
    // A margin drafted round it, a finger in from its edges, as dressed stone is.
    cut(g, fill, 0.16, () => {
      g.beginPath();
      g.moveTo(-2.8, 0.9); g.lineTo(-2.35, SHAFT_H - 0.5); g.lineTo(2.2, SHAFT_H - 0.55); g.lineTo(2.75, 0.9);
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
    footMoss(g, k, -3.5, 3.5, shadeOf(0, front ? 1 : -1), front ? 1 : 2);
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
          if (!ledge) topMoss(g, k, len, half, 0.5 + 0.5 * shadeOf(0, 0), salt);
          else {
            // Round the band's foot: the strips of the ledge either side of it, front and back.
            const T = rand(seed * 19 + salt);
            const tr = g.getTransform(), inv = k.base.inverse(), across = Math.hypot(k.e.ux, k.e.uy);
            const ps: Pad[] = [];
            for (let j = 0; j < 40; j++) {
              const s = T() * len, y = (T() < 0.5 ? -1 : 1) * (1.95 + T() * (half - 1.95));
              const sh = shadeOf(0, Math.sign(y));
              if (T() > capM * (0.15 + 0.9 * sh)) continue;
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
        if (ledge) {
          // A margin drafted a finger in from its arrises, and notches cut across the front one in groups, as the old stones are lettered on their edges.
          cut(g, k.fill, 0.15, () => { g.beginPath(); g.moveTo(-half + 0.75, 0.9); g.lineTo(-half + 0.95, h - 0.6); g.lineTo(half - 0.95, h - 0.65); g.lineTo(half - 0.75, 0.9); });
          const N = rand(seed * 211 + salt + (fr.right ? 1 : 2));
          const front = fr.right ? -1 : 1;
          for (let z = 1.4; z < h - 0.9;) {
            const n = 1 + Math.floor(N() * 3);
            for (let j = 0; j < n; j++) {
              const zz = z + j * 0.42;
              cut(g, k.fill, 0.15, () => { g.beginPath(); g.moveTo(front * (half - 0.2), zz); g.lineTo(front * (half - 0.62), zz); });
            }
            z += n * 0.42 + 0.55 + N() * 0.4;
          }
        }
        if (ledge) footMoss(g, k, -half - 0.5, half + 0.5, shadeOf(fr.right ? 1 : -1, 0), salt + (fr.right ? 5 : 6));
      },
    };
  };
  /*
   * Ivy up the front of the shaft by its mossy arris, from its foot toward the
   * band, as the runestones' climbs their faces: strands of heart-shaped
   * leaves laid in the face and let run a leaf past its edge, never up onto
   * the band. A first strand from halfway, a second as it thickens.
   */
  const ivyStage = Math.ceil(ivyM * STAGES);
  const strands = ivyStage > 0 ? [
    { kind: 'climb' as const, v: 1 + variant, x: shadySide * 2.75, z: -0.6, k: IVY_K, stage: ivyStage },
    { kind: 'vine' as const, v: variant, x: shadySide * 2.2, z: -0.2, k: IVY_K * 0.62, stage: Math.round(Math.max(0, ivyM - 0.3) / 0.7 * STAGES) },
    { kind: 'climb' as const, v: 3 + variant, x: shadySide * 1.5, z: -0.5, k: IVY_K * 0.78, stage: Math.round(Math.max(0, ivyM - 0.65) / 0.35 * STAGES) },
  ] : [];
  const ivy: Painter | undefined = strands.length ? (g) => {
    g.save();
    // A leaf past the shaft's arrises, and no higher than the foot of the band.
    g.beginPath();
    for (const [x, z] of [[-4.2, -1], [4.2, -1], [3.65, SHAFT_H - 0.6], [3.25, SHAFT_H - 0.18], [-3.6, SHAFT_H - 0.18]] as Pt[]) g.lineTo(x, z);
    g.closePath();
    g.clip();
    for (const st of strands) {
      const pic = st.stage > 0 ? strandPic(st.kind, st.v, st.stage, true) : null;
      if (!pic) continue;
      const sc = (st.k * 10) / PPM;
      g.save();
      g.translate(st.x, st.z);
      g.scale(shadySide < 0 ? -sc : sc, -sc);
      g.drawImage(pic.img, -pic.ax, -pic.ay);
      g.restore();
    }
    g.restore();
  } : undefined;
  const shaft = plate({
    ...shaftF, outline: shaftOutline, half: shaftHalf, tTop: SHAFT_H, bevel: 0.62, tone: STONE,
    front: shaftFace(true), back: shaftFace(false), frontOver: shadyFront > 0 ? ivy : undefined, backOver: shadyFront < 0 ? ivy : undefined,
    edge: shaftEdge(shaftOutline, shaftF, 2.85, SHAFT_H, 10, true), sunk: true,
  });
  const shaftT: Thing = { x: 0, y: 0, faces: shaft };
  things.push(shaftT);

  /* -- the band: set a step in, its runes round all four faces -- */
  const bandF: Frame = onTop(shaftF, 0.05, SHAFT_H, 0.045 * (variant - 1) + 0.035);
  const bandHalfX = 2.02, bandHalfY = 1.86;
  const bandOutline: Pt[] = [[-bandHalfX, 0], [bandHalfX, 0], [bandHalfX - 0.04, BAND_H], [-bandHalfX + 0.02, BAND_H]];
  const runesOf = [bandRunes(0), bandRunes(1), bandRunes(2), bandRunes(3)];
  const bandEdge = (i: number, up: number): { paint?: Painter } | undefined => {
    if (Math.abs(up) > 0.35) return undefined;
    const p = bandOutline[i], q = bandOutline[(i + 1) % bandOutline.length];
    const fr = sideFrame(bandF, p, q);
    return { paint: (g, k) => { inFrame(g, k, fr); carveBand(g, k.fill, bandHalfY, runesOf[fr.right ? 1 : 3], fr.right ? 21 : 23); } };
  };
  const band = plate({
    ...bandF, outline: bandOutline, half: [bandHalfY, bandHalfY], tTop: BAND_H, bevel: 0.22, tone: BAND,
    front: (g, k) => carveBand(g, k.fill, bandHalfX, runesOf[0], 20), back: (g, k) => carveBand(g, k.fill, bandHalfX, runesOf[2], 22), edge: bandEdge, sunk: true,
  });
  const bandT: Thing = { x: 0, y: 0, faces: band };
  things.push(bandT);

  /* -- the cap: broad, overhanging the band, its top drawn in to a ridge of the head -- */
  const capF: Frame = onTop(bandF, -0.05, BAND_H, -0.07, [0.035, -0.02]);
  const capOutline: Pt[] = [[-3.7, 0], [3.95, 0], [4.05, 0.58], [3.68, 1.0], [3.2, 0.96], [3.02, CAP_H], [-2.4, CAP_H - 0.08], [-3.05, CAP_H - 0.55], [-3.6, 0.82], [-3.88, 0.38]];
  const cap = plate({
    ...capF, outline: capOutline, half: [3.55, 2.75], tTop: CAP_H, bevel: 0.52, tone: STONE,
    // Thrust forward at its mossy end and drawn back at the other: no two arrises of its rim alike.
    depthAt: (cs, _t, h) => [0.22 * (cs / 4), h * (1 + 0.06 * (cs / 4))],
    front: (g, k) => skin(g, k.fill, -4.2, 4.2, CAP_H, 30, false),
    // At the end, a strand of ivy hangs off its mossy corner beside the band, not over it.
    frontOver: ivyM > 0.75 && shadyFront > 0 ? (g) => {
      const pic = strandPic('hang', 2 + variant, Math.round(((ivyM - 0.75) / 0.25) * STAGES), true);
      if (!pic) return;
      g.save();
      g.beginPath();
      g.rect(shadySide > 0 ? 2.25 : -4.6, -2.2, 2.35, CAP_H + 2.4);
      g.clip();
      const sc = (IVY_K * 0.8 * 10) / PPM;
      g.translate(shadySide * 3.05, CAP_H - 0.1);
      g.scale(shadySide < 0 ? -sc : sc, -sc);
      g.drawImage(pic.img, -pic.ax, -pic.ay);
      g.restore();
    } : undefined,
    back: (g, k) => skin(g, k.fill, -4.2, 4.2, CAP_H, 31, false),
    sunk: true,
  });
  const capT: Thing = { x: 0, y: 0, faces: cap };
  things.push(capT);
  /*
   * Moss on the cap's top: lumps on its mossy shoulder, drawn straight after
   * it and before the head -- one at first, two from halfway, three at the
   * end -- each cushions run together, as the runestones' are (`drawPads`).
   */
  if (capM > 0) {
    const spots: Array<[number, number, number]> = [[2.85, 2.05, 1], [1.75, 2.25, 0.8], [3.15, 0.95, 0.85]];
    const n = capM < 0.5 ? 1 : capM < 0.95 ? 2 : 3;
    const lumps = spots.slice(0, n).map(([cs, cy, k]) => ({ at: P(capF, shadySide * cs, CAP_H - 0.05, shadyFront * cy), r: k * (1.0 + 0.7 * capM) }));
    things.push({
      x: 0, y: 0,
      draw: (g, e) => {
        const across = Math.hypot(e.ux, e.uy);
        const T = rand(seed * 31 + 5);
        const ps: Pad[] = [];
        for (const { at: q, r } of lumps) {
          const [px, py] = proj(e, q);
          const rx = r * across, ry = rx * 0.62;
          // Each lump three cushions run together, a little uneven.
          for (const [dx, dd, pk] of [[0, 0, 1], [-0.5, -0.22, 0.72 + 0.2 * T()], [0.48, -0.12, 0.62 + 0.2 * T()]]) ps.push([px + dx * rx, py + dd * ry * 2, rx * pk, ry * pk]);
        }
        drawPads(g, ps);
      },
    });
  }

  /*
   * The head: what is left of a taller capstone, sheared off all but level --
   * a low stub whose top is mostly the flat of the break, paler and rougher
   * than the dressed stone, with a low tooth of the old stone left standing on
   * the rim at one corner.
   */
  const head: Face[] = [];
  {
    const Q = rand(seed * 59 + 3);
    const n = 4, rx = 1.95, ry = 1.6;
    const turn = 0.45 + 0.3 * variant;
    const c = Math.cos(turn), sn = Math.sin(turn);
    const corners = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * TAU + Math.PI / 4 + (Q() - 0.5) * 0.35, k = 1 + (Q() - 0.5) * 0.2;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      return [x * c - y * sn, x * sn + y * c] as Pt;
    });
    const at3 = ([u, v]: Pt, z: number): V3 => P(capF, u, CAP_H - 0.1 + z, v);
    const foot = corners.map((q) => at3(q, -0.1));
    const lerp = (a: Pt, b: Pt, t: number, k = 1): Pt => [(a[0] + (b[0] - a[0]) * t) * k, (a[1] + (b[1] - a[1]) * t) * k];
    // The corner it snapped at, where a low tooth of the taller stone still stands on the rim.
    const hi = corners.reduce((b, q, i) => (q[0] - 0.6 * q[1] < corners[b][0] - 0.6 * corners[b][1] ? i : b), 0);
    const nx = (hi + 1) % n, op = (hi + 2) % n, pv = (hi + 3) % n;
    const rim: V3[] = corners.map((q, i) => at3([q[0] * 0.86, q[1] * 0.86], i === hi ? 0.84 + 0.06 * Q() : i === op ? 0.36 + 0.05 * Q() : 0.44 + 0.06 * Q()));
    // Where the tooth's two broken faces meet the flat of the break: a notch on each rim either side of it, and a point in from it.
    const m1 = at3(lerp(corners[hi], corners[nx], 0.4, 0.86), 0.52 + 0.04 * Q());
    const m2 = at3(lerp(corners[hi], corners[pv], 0.4, 0.86), 0.5 + 0.04 * Q());
    const inner = at3([corners[hi][0] * 0.32, corners[hi][1] * 0.32], 0.56 + 0.04 * Q());
    const ctr = at3([0, 0], 0.2);
    const side = (pts: V3[], a: V3, b: V3): void => {
      let nn = newell(pts);
      if (dot(nn, sub(mul(add(a, b), 0.5), ctr)) < 0) nn = mul(nn, -1);
      head.push({ pts, n: nn, tone: STONE, crease: 0.35 });
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (i === hi) side([foot[i], foot[j], rim[j], m1, rim[i]], foot[i], foot[j]);
      else if (j === hi) side([foot[i], foot[j], rim[j], m2, rim[i]], foot[i], foot[j]);
      else side([foot[i], foot[j], rim[j], rim[i]], foot[i], foot[j]);
    }
    const up = (pts: V3[]): V3 => {
      const nn = newell(pts);
      return nn[2] < 0 ? mul(nn, -1) : nn;
    };
    // The tooth's two broken faces, steep, falling from its point on the rim to the flat.
    for (const pts of [[rim[hi], m1, inner], [rim[hi], inner, m2]]) head.push({ pts, n: up(pts), tone: STONE, crease: 0.5 });
    // And the flat of the break: the most of its top, all but level, the fresh pale stone it sheared to.
    {
      const pts = [m1, rim[nx], rim[op], rim[pv], m2, inner];
      const nn = up(pts);
      const mid = mul(pts.reduce((acc, q) => add(acc, q), [0, 0, 0] as V3), 1 / pts.length);
      const a = unit(sub(rim[op], rim[hi]));
      const b0 = sub(rim[nx], rim[pv]);
      const b = unit(sub(b0, mul(a, dot(a, b0))));
      const o = sub(sub(mid, mul(a, 2)), mul(b, 1.6));
      head.push({
        pts, n: nn, tone: FRACTURE, crease: 0.55,
        frame: { o, a, b },
        // Grainy and pitted, with a step or two where it broke unevenly.
        paint: (g, k) => {
          const T = rand(seed * 61 + 1);
          for (let q = 0; q < 40; q++) {
            const x = T() * 4, y = T() * 3.2;
            g.fillStyle = T() < 0.5 ? css(mix(k.fill, hex('#6d6274'), 0.4), 0.4) : css(mix(k.fill, [255, 253, 246], 0.6), 0.55);
            g.fillRect(x, y, 0.1 + 0.12 * T(), 0.1 + 0.12 * T());
          }
          for (let q = 0; q < 2; q++) {
            let x = 0.4 + T() * 0.6, y = 0.6 + T() * 1.8;
            g.beginPath();
            g.moveTo(x, y);
            for (let j = 0; j < 3; j++) { x += 0.5 + T() * 0.5; y += (T() - 0.5) * 0.6; g.lineTo(x, y); }
            g.strokeStyle = css(mix(k.fill, hex('#7a6f80'), 0.45), 0.5);
            g.lineWidth = 0.13;
            g.stroke();
          }
        },
      });
    }
  }
  const headT: Thing = { x: 0, y: 0, faces: head };
  things.push(headT);

  /* -- grass and a few flowers round its foot, from the first day -- */
  const colours = ['yellow', 'rose', 'cream'];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R() * 0.5, d = 5.2 + R() * 2.6;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const s0 = seed * 77 + i;
    const flower = i % 3 === 1;
    const colour = colours[(Math.floor(i / 3) + variant) % colours.length];
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
    // The face itself, out to the arrises: across it from one corner to the other, and up it.
    const xs = j % 2 === 0 ? bandHalfX : bandHalfY;
    const poly: V3[] = [at(fr.o, [-xs, fr.a]), at(fr.o, [xs, fr.a]), at(fr.o, [xs, fr.a], [BAND_H, fr.b]), at(fr.o, [-xs, fr.a], [BAND_H, fr.b])];
    return { o: fr.o, a: fr.a, b: fr.b, n, runes: runesOf[j], poly, xs };
  });

  const turf: Pt[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU, r = 7.4 + R() * 1.4;
    return [Math.cos(a) * r, Math.sin(a) * r * 0.92] as Pt;
  });
  const model: Model = {
    things, pillar: [...shaft, ...band, ...cap, ...head], solids: new Set([shaftT, bandT, capT, headT]), lit: new Set([shaftT, capT, headT]), shaftT, capT,
    heights: { band: P(bandF, 0, 0), foot: P(shaftF, 0, 0.4), cap: P(capF, 0, 0) }, over: [...cap, ...head], band: bandFaces,
    glowAt: P(bandF, 0, BAND_H / 2), top: Math.max(...head.flatMap((f) => f.pts.map((q) => q[2]))), turf,
  };
  models.set(key, model);
  return model;
}

/* ---- baking ------------------------------------------------------------------- */

/**
 * The light caught on a top's near arrises, as on a chamfer: a hair of pale
 * stone along each edge of an upward face that is nearer the eye than the
 * face's middle -- the ledge round the band, the cap's rim, the outcrop's top.
 */
function litEdges(g: Ctx, e: Eye, faces: readonly Face[], seed: number): void {
  const T = rand(seed);
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(250, 242, 224, 0.55)';
  for (const f of faces) {
    if (f.n[2] < 0.8 || dot(f.n, e.toward) <= 1e-6 || f.pts.length < 3) continue;
    const mid = mul(f.pts.reduce<V3>((m, q) => add(m, q), [0, 0, 0]), 1 / f.pts.length);
    const m0 = dot(mid, e.toward);
    const scr = f.pts.map((q) => proj(e, q));
    g.save();
    // Kept to its own top: the half of the stroke inside it is what shows.
    g.beginPath();
    scr.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    for (let i = 0; i < f.pts.length; i++) {
      const j = (i + 1) % f.pts.length;
      if (dot(mul(add(f.pts[i], f.pts[j]), 0.5), e.toward) <= m0 + 0.05) continue;
      const [ax, ay] = scr[i], [bx, by] = scr[j];
      // One broken line along it: runs of light of their own widths, with gaps and the odd chip out.
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

/** How square on the eye must see a face of the band, as the cosine of the angle off it, for its runes' light to be laid; and how much more for all of it. */
const GLOW_SEEN = 0.42;
const GLOW_FULL = 0.3;
/** The ink round its solids, in pixels at zoom one, and its colour: a pixel at zoom one and no more than two at two, a step lighter than a runestone's. */
const INK = 0.75;
/**
 * The colour of night on its stone, and how much of it stays on the pillar
 * after dark whatever light falls there: its own light lights the ground and
 * whoever stands by it, and the band is lit from inside, but the stone round
 * the band is in the dark of its own cap.
 */
const NIGHT_STONE = 'rgb(46, 44, 72)';
const NIGHT_KEEP = 0.45;
/** How much of that night what grows and lies round its foot keeps, against its stone's. */
const FLORA_KEEP = 0.7;
/** And of the outcrop under it. */
const OUTCROP_KEEP = 0.5;
/** The ink after dark, and how much more of the night it keeps than the stone. */
const NIGHT_INK = 'rgb(38, 32, 46)';
const NIGHT_INK_KEEP = 0.35;
/** The band's light on its own stone after dark: its colour, how strong just under the band, and on the cap's underside. */
const WARM = '242, 222, 190';
const WARM_SHAFT = 0.78;
const WARM_SOFFIT = 0.72;
/** What grows at its foot after dark: taken toward this pale gold, out to so many pixels at zoom one from its middle. */
const FLORA_GOLD = '226, 210, 168';
const FLORA_GLOW = 16;
/** Pixels a unit up is on the screen at zoom one. */
const HEIGHT_PX = 2.25;
/** How much a lantern's runes add after dark against a runestone's: it stands in its own light. */
const HEAT = 0.12;
/** The size of its ivy against the runestones', where a strand's leaves are two or three pixels across at zoom one. */
const IVY_K = 0.62;

/** A face of the band lit from inside after dark: its picture, where it goes from the footprint's middle in pixels at zoom one, and how square on it is seen. */
interface Window {
  canvas: HTMLCanvasElement;
  box: [number, number, number, number];
  fade: number;
}

interface Baked {
  canvas: HTMLCanvasElement;
  scale: number;
  ox: number;
  oy: number;
  /** What it covers from its footprint's middle, in pixels at zoom one: left, top, right, bottom. */
  bounds: [number, number, number, number];
  /** And what of that is the pillar, which it is clicked by. */
  hit: [number, number, number, number];
  /**
   * The pillar alone, in the night's colour, less whatever stands in front of
   * it: laid over it after dark, so the light it throws on the ground round it
   * does not lift its own stone to white and the band stays the brightest
   * thing on it.
   */
  shade: HTMLCanvasElement;
  /** And the light its band throws on its own stone, laid over that shade after dark; and its outline's own night. */
  warm: HTMLCanvasElement;
  rim: HTMLCanvasElement;
  /** Each face of the band the eye sees, lit from inside after dark. */
  windows: Window[];
  glows: Glow[];
  /** The same runes in their colours after dark, and how square on each is seen: the two are laid crossfaded by how dark it is. */
  nightGlows: Glow[];
  seen: number[];
  /** The middle of the band and the top of the head, on the screen at zoom one from the footprint's middle. */
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
    else if (t.faces) {
      drawFaces(g, e, t.faces, INK, mix(STONE_INK, CREASE_INK, 0.4));
      if (model.lit.has(t)) litEdges(g, e, t.faces, t.faces.length * 7 + Math.round(t.x * 13));
    }
  }

  /*
   * The night it keeps: the pillar's faces and their ink whole, and what grows
   * and lies round its foot -- grass, flowers, rocks, moss -- at `FLORA_KEEP`
   * of that, each over what it stands in front of; the outcrop, which is
   * ground its light falls on, at `OUTCROP_KEEP`, so its pale stone under that
   * light comes up no brighter than the band.
   */
  const [shade, sg] = canvasOf(canvas.width, canvas.height);
  const [lone, lg] = canvasOf(canvas.width, canvas.height);
  const M0 = new DOMMatrix([scale, 0, 0, scale, -x0 * scale, -y0 * scale]);
  sg.setTransform(M0);
  lg.setTransform(M0);
  sg.lineJoin = 'round';
  const poly = (h: Ctx, pts: readonly V3[]): void => {
    h.beginPath();
    pts.forEach((p, i) => { const [x, y] = proj(e, p); if (i) h.lineTo(x, y); else h.moveTo(x, y); });
    h.closePath();
  };
  const solid = (h: Ctx, t: Thing, ink: boolean): void => {
    for (const f of t.faces ?? []) {
      if (dot(f.n, e.toward) <= 1e-6) continue;
      poly(h, f.pts);
      h.fill();
      if (ink) h.stroke();
    }
  };
  for (const t of things) {
    if (model.solids.has(t)) {
      sg.globalCompositeOperation = 'source-over';
      sg.globalAlpha = 1;
      sg.fillStyle = sg.strokeStyle = NIGHT_STONE;
      sg.lineWidth = INK * 2;
      solid(sg, t, true);
      continue;
    }
    // Anything else, as its own shape: drawn alone, in the night's colour, laid over what it stands in front of.
    lg.save();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, lone.width, lone.height);
    lg.restore();
    lg.globalCompositeOperation = 'source-over';
    if (t.draw) t.draw(lg, e);
    else { lg.fillStyle = '#000'; solid(lg, t, false); }
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

  /*
   * Its outline after dark: the ink round the pillar alone -- its solids drawn
   * with their ink, less the solids without it -- less what stands in front,
   * laid over the shade so the ink stays a step under the stone at night.
   */
  const [rim, rg] = canvasOf(canvas.width, canvas.height);
  rg.setTransform(M0);
  rg.lineJoin = 'round';
  {
    rg.fillStyle = rg.strokeStyle = NIGHT_INK;
    rg.lineWidth = INK * 2;
    let past = false;
    for (const t of things) {
      if (t.first) continue;
      if (model.solids.has(t)) {
        rg.globalCompositeOperation = 'source-over';
        solid(rg, t, true);
        past = true;
        continue;
      }
      if (!past) continue;
      rg.globalCompositeOperation = 'destination-out';
      if (t.draw) t.draw(rg, e);
      else solid(rg, t, false);
    }
    rg.globalCompositeOperation = 'destination-out';
    for (const t of things) if (model.solids.has(t)) solid(rg, t, false);
    rg.globalCompositeOperation = 'source-over';
  }

  /*
   * The light the band throws on its own stone after dark: down the shaft,
   * warmest under the band and gone by its foot, and up the cap's underside
   * and lip in one soft band -- less whatever stands in front of either.
   */
  const [warm, wg] = canvasOf(canvas.width, canvas.height);
  wg.setTransform(M0);
  {
    const [, yBand] = proj(e, model.heights.band), [, yFoot] = proj(e, model.heights.foot), [, yCap] = proj(e, model.heights.cap);
    const down = wg.createLinearGradient(0, yBand, 0, yFoot);
    down.addColorStop(0, `rgba(${WARM}, ${WARM_SHAFT})`);
    down.addColorStop(0.4, `rgba(${WARM}, ${(WARM_SHAFT * 0.55).toFixed(3)})`);
    down.addColorStop(1, `rgba(${WARM}, 0)`);
    const up = wg.createLinearGradient(0, yCap, 0, yCap - CAP_H * 0.45 * HEIGHT_PX);
    up.addColorStop(0, `rgba(${WARM}, ${WARM_SOFFIT})`);
    up.addColorStop(1, `rgba(${WARM}, 0)`);
    // Laid in the order everything is drawn: each lit solid where it is drawn, and whatever is drawn after it in front taken off.
    let past = false;
    for (const t of things) {
      if (t === model.shaftT || t === model.capT) {
        wg.globalCompositeOperation = 'source-over';
        wg.fillStyle = t === model.shaftT ? down : up;
        solid(wg, t, false);
        past = true;
        continue;
      }
      if (!past || t.first) continue;
      wg.globalCompositeOperation = 'destination-out';
      wg.fillStyle = '#000';
      if (t.draw) t.draw(wg, e);
      else solid(wg, t, false);
    }
    /*
     * And what grows at its foot, in the order it is drawn and less the
     * pillar where the pillar stands in front of it: taken toward pale gold
     * near the foot, so the light there falls on it as on stone and does not
     * turn the green to lime.
     */
    const [fx, fy] = proj(e, [0, 0, 0]);
    const gold = wg.createRadialGradient(fx, fy, 0, fx, fy, FLORA_GLOW);
    gold.addColorStop(0, `rgba(${FLORA_GOLD}, 0.32)`);
    gold.addColorStop(0.6, `rgba(${FLORA_GOLD}, 0.16)`);
    gold.addColorStop(1, `rgba(${FLORA_GOLD}, 0)`);
    const [fl, flg] = canvasOf(canvas.width, canvas.height);
    flg.setTransform(M0);
    for (const t of things) {
      if (t.first) continue;
      if (model.solids.has(t)) {
        flg.globalCompositeOperation = 'destination-out';
        flg.fillStyle = '#000';
        solid(flg, t, false);
        continue;
      }
      if (t.draw) {
        lg.save();
        lg.setTransform(1, 0, 0, 1, 0, 0);
        lg.clearRect(0, 0, lone.width, lone.height);
        lg.restore();
        lg.globalCompositeOperation = 'source-over';
        t.draw(lg, e);
        lg.globalCompositeOperation = 'source-in';
        lg.fillStyle = gold;
        lg.fillRect(-1e3, -1e3, 2e3, 2e3);
        lg.globalCompositeOperation = 'source-over';
        flg.save();
        flg.setTransform(1, 0, 0, 1, 0, 0);
        flg.globalCompositeOperation = 'source-over';
        flg.drawImage(lone, 0, 0);
        flg.restore();
      }
    }
    wg.save();
    wg.setTransform(1, 0, 0, 1, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    wg.drawImage(fl, 0, 0);
    wg.restore();
    wg.globalCompositeOperation = 'source-over';
  }

  /* -- each rune's light, on the faces of the band the eye sees, and the window it is lit in -- */
  const glows: Glow[] = [];
  const nightGlows: Glow[] = [];
  const seen: number[] = [];
  const windows: Window[] = [];
  /** A picture laid on the screen in a box, kept to a face of the band and off the cap and head over it. */
  const keepTo = (c: HTMLCanvasElement, box: readonly number[], face: readonly V3[]): void => {
    const h = c.getContext('2d') as Ctx;
    h.setTransform(scale, 0, 0, scale, -box[0] * scale, -box[1] * scale);
    h.globalCompositeOperation = 'destination-in';
    poly(h, face);
    h.fill();
    h.globalCompositeOperation = 'destination-out';
    for (const o of model.over) { poly(h, o.pts); h.fill(); }
    h.globalCompositeOperation = 'source-over';
  };
  for (const f of model.band) {
    /*
     * Not on a face seen all but edge on, where a rune's light would be a
     * sliver down the band's corner; and faded out as a face turns toward
     * that, rather than gone at a step.
     */
    const cos = dot(f.n, e.toward) / Math.hypot(...e.toward);
    if (cos < GLOW_SEEN) continue;
    const fade = Math.min(1, (cos - GLOW_SEEN) / GLOW_FULL);
    const [ox, oy] = proj(e, f.o), [ax, ay] = proj(e, f.a), [bx, by] = proj(e, f.b);
    const M = new DOMMatrix([ax, ay, bx, by, ox, oy]);
    const ease = fade * fade * (3 - 2 * fade);
    {
      // The window inside the reveal: pale gold behind the rune, a dim warm at the reveal round it.
      const x0w = -f.xs + 0.36, x1w = f.xs - 0.36, z0w = 0.3, z1w = BAND_H - 0.4;
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const [x, z] of [[x0w, z0w], [x1w, z0w], [x1w, z1w], [x0w, z1w]]) {
        const q = M.transformPoint(new DOMPoint(x, z));
        a = Math.min(a, q.x); c = Math.max(c, q.x); b = Math.min(b, q.y); d = Math.max(d, q.y);
      }
      a -= 1; b -= 1; c += 1; d += 1;
      const [cv, h] = canvasOf((c - a) * scale, (d - b) * scale);
      h.setTransform(scale, 0, 0, scale, -a * scale, -b * scale);
      h.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      const gr = h.createRadialGradient(0, RUNE_Z, 0, 0, RUNE_Z, Math.max(f.xs, BAND_H * 0.55));
      for (const [k, col] of WINDOW) gr.addColorStop(k, col);
      h.fillStyle = gr;
      h.fillRect(x0w, z0w, x1w - x0w, z1w - z0w);
      const box: [number, number, number, number] = [a, b, c - a, d - b];
      keepTo(cv, box, f.poly);
      windows.push({ canvas: cv, box, fade: ease });
    }
    for (const r of f.runes) {
      // A groove no thinner on the screen than `RUNE_PX` over the scale it is baked at, so at a small zoom a rune is still a stroke of light and not a hair.
      const spec = { ...r, w: Math.max(r.w ?? RUNE_W, RUNE_PX / scale) };
      const gl = bakeGlow(M, { ...spec, inner: RUNE_INNER, mid: RUNE_MID, edge: RUNE_CHANNEL }, scale);
      const gn = bakeGlow(M, { ...spec, inner: NIGHT_INNER, mid: NIGHT_MID }, scale);
      gl.fade = ease;
      // By day the groove alone, gold in its channel, with no haze round it.
      (gl.halo.getContext('2d') as Ctx).clearRect(0, 0, gl.halo.width, gl.halo.height);
      // Each picture of its light kept to its own face of the band, and off the cap and head over it.
      for (const c of [gl.core, gl.halo, gl.dusk, gl.mask, gn.core, gn.halo, gn.dusk, gn.mask]) keepTo(c, gl.box, f.poly);
      glows.push(gl);
      nightGlows.push(gn);
      seen.push(ease);
    }
  }
  let hx0 = Infinity, hy0 = Infinity, hx1 = -Infinity, hy1 = -Infinity;
  for (const f of model.pillar) for (const p of f.pts) {
    const [x, y] = proj(e, p);
    hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y);
  }
  return {
    canvas, scale, ox: -x0 * scale, oy: -y0 * scale, bounds: [x0, y0, x1, y1], hit: [Math.floor(hx0 - 2), Math.floor(hy0 - 2), Math.ceil(hx1 + 2), Math.ceil(hy1 + 1)],
    glows, nightGlows, seen, windows, glowAt: proj(e, model.glowAt), topAt: proj(e, [0, 0, model.top]), shade, warm, rim,
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

/** How far its spot at its foot reaches across the ground, in tiles. */
const POOL_REACH = 1.2;
/** How far toward the eye its middle stands from the middle of its footprint, in tiles: out on the ground in front of its foot rather than up its stone. */
const POOL_OUT = 0.6;
/** The pale gold of that spot, and how strong it is at its middle at full dark: twice a lantern's warmth. */
const POOL_CAST = '255, 214, 158';
const POOL_CAST_ALPHA = LAMP_CAST_ALPHA * 2;

/** How far the band's bloom reaches after dark, in pixels at zoom one. */
const BLOOM = 12;
/** And the hole its spot makes in the night, at its middle, in pixels at zoom one. */
const FOOT_HOLE = 28;
/** How far down the screen from its footprint's middle that spot's middle is, in pixels at zoom one: `POOL_OUT` tiles toward the eye. */
const POOL_DOWN = POOL_OUT * Math.SQRT2 * HALF_H;

/**
 * Its spot at its foot, seen from viewpoint `rotation`, laid as a light of
 * its own over and above the one it throws (`runeLanternLight`): no further
 * in the dark, only warmer round its foot, and laid over whatever lies there
 * -- a path or a paving drawn after it as well as grass. The renderer's
 * alone; the eye reaches no further for it.
 */
export function runeLanternPool(f: PlacedFurniture, rotation: number): LightSource {
  const [x, y] = furnitureCentre(f);
  // Straight down the screen, on the ground: (u, v) = (1, 1) turned back by the view.
  const { cos, sin } = VIEWS[((rotation % 8) + 8) % 8];
  const k = POOL_OUT / Math.SQRT2;
  return { x: x + k * (cos - sin), y: y + k * (sin + cos), radius: POOL_REACH, strength: 0, steady: true, cast: POOL_CAST, castAlpha: POOL_CAST_ALPHA };
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
  if (live) drawRuneLanternBloom(ctx, sx, sy, zoom, look, rotation, night, t);
  ctx.drawImage(b.canvas, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
  if (night > 0.02) {
    const wasA = ctx.globalAlpha;
    ctx.globalAlpha = wasA * night * NIGHT_KEEP;
    ctx.drawImage(b.shade, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
    ctx.globalAlpha = wasA * night * NIGHT_INK_KEEP;
    ctx.drawImage(b.rim, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
    ctx.globalAlpha = wasA * night;
    ctx.drawImage(b.warm, sx - b.ox * k, sy - b.oy * k, b.canvas.width * k, b.canvas.height * k);
    for (const w of b.windows) {
      ctx.globalAlpha = wasA * night * w.fade;
      const [x, y, ww, wh] = w.box;
      ctx.drawImage(w.canvas, sx + x * zoom, sy + y * zoom, ww * zoom, wh * zoom);
    }
    ctx.globalAlpha = wasA;
  }
  if (live) drawRuneLanternLive(ctx, sx, sy, zoom, look, rotation, night, t);
  const [l, tp, r, bt] = b.bounds;
  return [l * zoom, tp * zoom, r * zoom, bt * zoom];
}

/**
 * After dark, a pale gold bloom round the band, breathing with its runes:
 * laid before the stone (`drawRuneLantern`), so it lights the air round the
 * pillar and not the pillar itself. Its spot on the ground is the night's
 * (`runeLanternNight`, `runeLanternPool`), laid over the ground and the paths
 * and kept off whoever stands in front.
 */
export function drawRuneLanternBloom(ctx: Ctx, sx: number, sy: number, zoom: number, look: RuneLanternLook, rotation: number, night = 0, t = performance.now() / 1000): void {
  if (night <= 0.02) return;
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  const was = ctx.globalCompositeOperation, wasA = ctx.globalAlpha;
  const p = 0.5 + 0.5 * Math.sin((t / 4.8) * TAU);
  ctx.globalAlpha = 1;
  {
    // Round the band, light added: the air about it.
    ctx.globalCompositeOperation = 'lighter';
    const x = sx + b.glowAt[0] * zoom, y = sy + b.glowAt[1] * zoom, R = BLOOM * zoom;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, R);
    grad.addColorStop(0, `rgba(255, 214, 160, ${(0.2 * night * (0.85 + 0.15 * p)).toFixed(3)})`);
    grad.addColorStop(0.45, `rgba(255, 206, 150, ${(0.08 * night).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(255, 206, 150, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** What of a rune lantern post moves, over its bake: its runes' light as it breathes. */
export function drawRuneLanternLive(ctx: Ctx, sx: number, sy: number, zoom: number, look: RuneLanternLook, rotation: number, night = 0, t = performance.now() / 1000): void {
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  b.glows.forEach((gl, i) => { gl.fade = b.seen[i] * (1 - night); });
  b.nightGlows.forEach((gl, i) => { gl.fade = b.seen[i] * night; });
  drawGlows(ctx, b.glows, sx, sy, zoom, night, t, HEAT);
  if (night > 0.01) drawGlows(ctx, b.nightGlows, sx, sy, zoom, night, t, HEAT);
}

/** What it is clicked by  ctx.globalCompositeOperation = was;
  ctx.globalAlpha = wasA;
}

/** What it is clicked by, from its footprint's middle, in pixels at zoom one: the pillar and a little round it, not the outcrop. */
export function runeLanternHit(look: RuneLanternLook, rotation: number, zoom = 1): [number, number, number, number] {
  return bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom).hit;
}

/**
 * How it takes the night back off itself, drawn at a zoom, for the
 * runestones' keeping (`RunestoneNight.glowing`): each rune in its own shape,
 * a soft hole round each a half again a runestone's, a small one over the
 * band and the cap's underside, and the motes -- each faded as its face
 * turns away.
 */
export function runeLanternNight(look: RuneLanternLook, rotation: number, zoom: number): NightSource {
  const b = bakedFor(look.facing, rotation, mossOf(look.stage, look.stages), look.variant, zoom);
  return {
    glows: b.glows,
    rise: 0,
    reach: [-FOOT_HOLE * 1.5, -FOOT_HOLE + POOL_DOWN, FOOT_HOLE * 1.5, FOOT_HOLE + POOL_DOWN],
    holes: (sx, sy, z, t): NightHole[] => {
      const out = glowHoles(b.glows, sx, sy, z, t, 1.5).map((h, i) => ({ ...h, a: h.a * b.seen[i] }));
      const p = 0.5 + 0.5 * Math.sin((t / 4.8) * TAU);
      out.push({ x: sx + b.glowAt[0] * z, y: sy + b.glowAt[1] * z, r: 14 * z, a: 0.27 + 0.05 * p });
      // Its spot on the ground, out in front of its foot where its warmth is laid: three holes along the ground, flattened as it is seen, breathing with the band.
      const fy = sy + POOL_DOWN * z;
      out.push({ x: sx, y: fy, r: FOOT_HOLE * z, a: 0.48 + 0.06 * p });
      for (const d of [-1, 1]) out.push({ x: sx + d * FOOT_HOLE * 0.7 * z, y: fy, r: FOOT_HOLE * 0.75 * z, a: 0.26 + 0.04 * p });
      return out;
    },
    masks: (sx, sy, z, t): NightMask[] => [
      ...b.windows.map((w) => ({ canvas: w.canvas, x: sx + w.box[0] * z, y: sy + w.box[1] * z, w: w.box[2] * z, h: w.box[3] * z, a: 0.6 * w.fade })),
      ...glowMasks(b.glows, sx, sy, z, t).map((mk, i) => ({ ...mk, a: mk.a * b.seen[i] })),
    ],
  };
}

/** Which of its cuts a piece standing at subtile (sx, sy) of tile (x, y) is. */
export const runeLanternVariant = (x: number, y: number, sx: number, sy: number): number =>
  Math.floor(hashOf(x * 4 + sx, y * 4 + sy, 5, 913) * RUNE_LANTERN_VARIANTS) % RUNE_LANTERN_VARIANTS;

