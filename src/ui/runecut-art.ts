import {
  crack, cut, drawMote, faceColour, glyphPath, LICHEN, lichen, MOTES, moteU, panelArch, STONE_INK, stoneSkin, bakeRune, drawGlows, toneOf, css, mix, hex,
  type Ctx, type Glow, type Pad, type Pt, type RGB, type Tone,
} from '../render/runestone';
import { hashOf, PPM, rand } from '../render/ivy';
import { NIGHT_WASH } from '../render/nightwash';
import { FRAME_REACH, FRAMES, frameFor, frameLabel, paintFrame, type FrameDef, type FrameOpts } from './runecut-frames';

/**
 * Runecut's art: a window as a slab of the runestones' stone, its rune cut
 * in a niche at the head of it, and a frame round it of the stuff of what it
 * holds -- the slab painted with the stones' own painters
 * (src/render/runestone.ts), never redrawn by hand, so a window and the stone
 * beside it are one stone; the frames in the island's own materials
 * (src/ui/runecut-frames.ts).
 *
 * Nothing here touches the page but the canvases it is handed, and nothing
 * reads the game: the proposal page bundles this file as it is and calls the
 * same painters, so the page and the game draw the same thing.
 *
 *   paintPlate(g, w, h, o)             the slab, behind a w × h window's content, its rim plain stone
 *   paintFrame(g, w, h, kind, o)       a frame (`FRAMES`) over the slab's rim, out to `FRAME_REACH` past the edge
 *   paintNiche(g, glyph, o, t)         the niche and its rune, on a NICHE_W × NICHE_H canvas
 *   paintNightGlow(g, glyph, o, t)     the front window's rune after dark, breathing, and its motes
 *
 * Each takes a context already scaled to CSS pixels, its origin at the top
 * left of what it paints -- for `paintFrame`, the window's top left, with
 * `FRAME_REACH` of canvas round it on every side.
 *
 * The ivy and moss that grew on the rim before the frames is gone: at the
 * rim's width it could not be told for what it was.
 */

/**
 * What every painter is told: a seed (`seedOf` a window's id), after dark or
 * not, which side its lichen gathers toward, and how wide the window's rim
 * is (`RIM` unless it says otherwise: a phone's window, the status panel and
 * the toolbar are given narrower ones).
 */
export interface ArtOpts {
  seed: number;
  night: boolean;
  side: 'left' | 'right';
  rim?: number;
}

/**
 * The slab's rim: the band round a window's face, this wide in CSS px, that
 * its frame is painted on -- or, with frames set to plain stone, a raised
 * margin of the stone, as the rune panels have round theirs. The window's
 * content stands two pixels inside it, and the window is made that much
 * bigger rather than its content smaller.
 */
export const RIM = 16;
/**
 * The rims narrower than `RIM` where there is less room: a window on a phone's
 * screen, the status panel and the toolbar, which are small to begin with.
 */
export const RIMS = { window: RIM, phone: 10, hud: 10, toolbar: 8 } as const;
/** The slab: its corners cut this deep, and the side plane along its foot and down its right this thick. */
export const SLAB = { cut: 7, foot: 4, side: 3 } as const;
/** The niche's canvas, in CSS px. */
export const NICHE_W = 24;
export const NICHE_H = 40;

/** The stone: the Crownstone's lit face and the rune gate's lilac shade (`toneOf` in runestone.ts). */
export const STONE: Tone = toneOf('#f5e8cf', '#aa9fac');

/** A window id's seed, so a window grows the same every time. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The side its ivy is on, off its seed. */
export const sideOf = (seed: number): 'left' | 'right' => (hashOf(seed, 1, 2, 3) < 0.5 ? 'left' : 'right');

/**
 * The island's night over what has just been painted: the renderer's own
 * wash (`skyWash`), at the dead of night, laid only where there is paint.
 */
function nightOver(g: Ctx, x: number, y: number, w: number, h: number, k = 1): void {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * k})`;
  g.fillRect(x, y, w, h);
  g.restore();
}

/**
 * How strongly the stones' skin is laid on a window's face: as near their own
 * as the writing over it allows. At this the darkest hundredth of a face is
 * still 7:1 under the ink and 4.5:1 under every other colour of writing.
 */
const SKIN = 0.85;

/** The face's outline: a w × h window less its side planes, corners cut. */
function faceOutline(w: number, h: number): Pt[] {
  const W = w - SLAB.side, H = h - SLAB.foot, c = SLAB.cut;
  return [[c, 0], [W - c, 0], [W, c], [W, H - c], [W - c, H], [c, H], [0, H - c], [0, c]];
}

const trace = (g: Ctx, pts: readonly Pt[]): void => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

/**
 * The slab behind a w × h window: its face in the stone's skin, with lichen,
 * a crack or two on a big one and chips out of its edges; its foot and its
 * right side in the shade, a lit lip along the top; every plane ruled in the
 * stone's ink. Opaque, so it is the window's background.
 */
export function paintPlate(g: Ctx, w: number, h: number, o: ArtOpts): void {
  const R = rand(o.seed * 7 + 11);
  const face = faceOutline(w, h);
  const d: Pt = [SLAB.side, SLAB.foot];
  const fill = faceColour(STONE, 1);
  const ink = css(STONE_INK);
  g.save();
  g.lineJoin = 'round';

  // The side planes: each edge of the face turned toward the eye, pushed back through the slab.
  const sides: Array<[number, number]> = [];
  for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length];
    const nx = b[1] - a[1], ny = a[0] - b[0];
    if (nx * d[0] + ny * d[1] > 0.01) sides.push([i, (nx * 0.6 + ny * 0.9) / Math.hypot(nx, ny)]);
  }
  for (const [i, turn] of sides) {
    const a = face[i], b = face[(i + 1) % face.length];
    const quad: Pt[] = [a, b, [b[0] + d[0], b[1] + d[1]], [a[0] + d[0], a[1] + d[1]]];
    trace(g, quad);
    // Light as the stones take it: the more a plane looks down, away from the sky, the deeper into the shade.
    g.fillStyle = css(faceColour(STONE, 0.86 - 0.2 * Math.max(0, turn)));
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 1;
    g.stroke();
  }

  // The face.
  trace(g, face);
  g.fillStyle = css(fill);
  g.fill();
  g.save();
  trace(g, face);
  g.clip();
  /*
   * The skin, quiet: the stones' own (`stoneSkin`) laid in their frame, z up
   * from the foot, at a fraction of its strength so writing over it keeps its
   * contrast. Its marks are kept to a stone's size in pixels whatever the
   * window's, and as many as the face has room for.
   */
  const W = w - SLAB.side, H = h - SLAB.foot;
  const U = W / 80, area = W * H;
  g.save();
  g.globalAlpha = SKIN;
  g.translate(W / 2, H);
  g.scale(U, -U);
  stoneSkin(g, R, fill, H / U, () => [-40, 40], o.seed % 997, {
    size: 2.6 / U,
    patches: Math.round(area / 1500),
    grit: Math.round(area / 260),
    pits: Math.round(area / 2600),
    hairs: area > 90_000 ? 2 : area > 45_000 ? 1 : 0,
    streaks: Math.round(W / 60),
  });
  g.restore();
  // A crack or two on a big one, in from an edge, cut as the stones' are.
  if (area > 80_000) {
    const n = area > 160_000 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const left = R() < 0.5;
      const z = H * (0.25 + R() * 0.5);
      g.save();
      g.translate(0, H);
      g.scale(2, -2);
      crack(g, fill, R, left ? 0 : W / 2, z / 2, left ? (R() - 0.5) * 0.6 : Math.PI + (R() - 0.5) * 0.6, 7 + R() * 5);
      g.restore();
    }
  }
  // Lichen: a few spots, gathered toward the foot and the growth's side.
  const spots = Math.max(2, Math.round(area / 30_000));
  for (let i = 0; i < spots; i++) {
    const ux = Math.pow(R(), 1.8), uy = Math.pow(R(), 0.55);
    const x = o.side === 'left' ? 6 + ux * W * 0.6 : W - 6 - ux * W * 0.6;
    lichen(g, R, x, 8 + uy * (H - 14), 3.4 + R() * 3, LICHEN);
  }

  /*
   * The rim: a margin of the face standing a step proud of the field the
   * content is on, as a rune panel's border stands round its runes -- its
   * outer edge turned down into the shade, the field cut a groove in from it
   * with the lit lip on its far side (`cut`), and on a full-width rim a row of
   * drilled dots along its middle, as the panels have between their rules.
   */
  const rim = o.rim ?? RIM;
  const inner = (d: number): Pt[] => {
    const c = Math.max(2, SLAB.cut - d * 0.4);
    return [[d + c, d], [W - d - c, d], [W - d, d + c], [W - d, H - d - c], [W - d - c, H - d], [d + c, H - d], [d, H - d - c], [d, d + c]];
  };
  trace(g, face);
  g.strokeStyle = css(faceColour(STONE, 0.8), 0.55);
  g.lineWidth = 5;
  g.stroke();
  trace(g, face);
  g.strokeStyle = css(mix(fill, [255, 252, 244], 0.6), 0.75);
  g.lineWidth = 1;
  g.save();
  g.translate(1.5, 1.5);
  g.stroke();
  g.restore();
  cut(g, fill, 1.1, () => trace(g, inner(rim)));
  if (rim >= 10) {
    const mid = inner(rim / 2);
    for (let i = 0; i < mid.length; i++) {
      const [ax, ay] = mid[i], [bx, by] = mid[(i + 1) % mid.length];
      const len = Math.hypot(bx - ax, by - ay), n = Math.floor(len / 11);
      for (let j = 1; j < n; j++) {
        const x = ax + ((bx - ax) * j) / n, y = ay + ((by - ay) * j) / n;
        cut(g, fill, 1.3, () => { g.beginPath(); g.moveTo(x, y + 0.08); g.lineTo(x, y - 0.08); });
      }
    }
  }
  g.restore();

  // A lit lip along the top and down the left, where the face turns to the sky.
  g.beginPath();
  g.moveTo(face[7][0] + 0.5, face[7][1] + 1);
  g.lineTo(face[0][0] + 1, face[0][1] + 1.2);
  g.lineTo(face[1][0] - 1, face[1][1] + 1.2);
  g.moveTo(1.2, face[7][1]);
  g.lineTo(1.2, face[6][1]);
  g.strokeStyle = css(mix(fill, [255, 252, 244], 0.7), 0.9);
  g.lineWidth = 1.2;
  g.stroke();

  // Chips nicked out of the edges, where the ink dips in.
  const chips = 3 + Math.round(R() * 3 + (W + H) / 260);
  for (let i = 0; i < chips; i++) {
    const e = Math.floor(R() * face.length);
    const a = face[e], b = face[(e + 1) % face.length];
    const t = 0.15 + R() * 0.7, len = 3 + R() * 4, deep = 1.2 + R() * 1.6;
    const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
    const ux = ex / el, uy = ey / el, nx = -uy, ny = ux; // n points into the face for an anticlockwise-on-screen run
    const px = a[0] + ex * t, py = a[1] + ey * t;
    const chip: Pt[] = [[px - ux * len * 0.5, py - uy * len * 0.5], [px + ux * (R() - 0.5) * len * 0.4 + nx * deep, py + uy * (R() - 0.5) * len * 0.4 + ny * deep], [px + ux * len * 0.5, py + uy * len * 0.5]];
    trace(g, chip);
    g.fillStyle = css(faceColour(STONE, 0.78));
    g.fill();
    g.beginPath();
    g.moveTo(chip[0][0], chip[0][1]);
    g.lineTo(chip[1][0], chip[1][1]);
    g.lineTo(chip[2][0], chip[2][1]);
    g.strokeStyle = ink;
    g.lineWidth = 0.8;
    g.stroke();
  }

  // The ink round the face.
  trace(g, face);
  g.strokeStyle = ink;
  g.lineWidth = 1;
  g.stroke();
  g.restore();
  if (o.night) nightOver(g, 0, 0, w, h);
}

/** A niche's rune light, baked once for a glyph at a scale (`bakeRune`), kept. */
const glows = new Map<string, Glow>();

/** Where the niche's rune is, in its face frame: units are CSS px, z up from the canvas's foot. */
const NICHE = { mid: NICHE_W / 2, z0: 3, z1: 23, arch: 9, hw: 8.5, rune: { z: 14, s: 5.6 } };

function glowOf(glyph: string, scale: number): Glow {
  const key = `${glyph}|${scale}`;
  let gl = glows.get(key);
  if (!gl) {
    gl = bakeRune(new DOMMatrix([1, 0, 0, -1, 0, NICHE_H]), { glyph, x: NICHE.mid, z: NICHE.rune.z, s: NICHE.rune.s, i: 0, w: 0.95 }, scale);
    glows.set(key, gl);
  }
  return gl;
}

/**
 * The niche at the head of a window: a small field sunk into the face with a
 * pointed head, ruled twice round, and the window's rune cut in it -- the
 * stones' panel (`panelArch`, `cut`) at the size of a title. Its light is
 * painted here, held still, unless `lit` is false: the front window's after
 * dark is `paintNightGlow`'s, over one painted unlit. `scale` is the device
 * pixels a CSS pixel, for the light's bake.
 */
export function paintNiche(g: Ctx, glyph: string, o: ArtOpts, scale: number, lit = true): void {
  const fill = faceColour(STONE, 1);
  g.save();
  g.translate(0, NICHE_H);
  g.scale(1, -1);
  const border = (dd: number): void => panelArch(g, NICHE.mid, NICHE.mid, NICHE.hw, NICHE.z0, NICHE.z1, NICHE.arch, dd);
  border(1.4);
  g.fillStyle = css(mix(fill, hex('#a39aac'), 0.42), 0.55);
  g.fill();
  cut(g, fill, 0.9, () => border(0));
  cut(g, fill, 0.6, () => border(1.4));
  cut(g, fill, 1.1, () => glyphPath(g, glyph, NICHE.mid, NICHE.rune.z, NICHE.rune.s));
  g.restore();
  if (o.night) nightOver(g, 0, 0, NICHE_W, NICHE_H);
  // By day its light is laid on as colour, still; after dark the dusk light, held at the middle of its breath. Unlit, for `paintNightGlow` to light each frame.
  if (lit) drawGlows(g, [glowOf(glyph, scale)], 0, 0, 1, o.night ? 1 : 0, 1.2);
}

/**
 * The front window's rune after dark: its light breathing (`breath`, inside
 * `drawGlows`) and motes rising off it, at `t` seconds. Laid over a copy of
 * the niche painted at night; the caller clears to that copy each frame.
 */
export function paintNightGlow(g: Ctx, glyph: string, o: ArtOpts, t: number, scale: number): void {
  drawGlows(g, [glowOf(glyph, scale)], 0, 0, 1, 1, t, 1.4);
  for (let i = 0; i < MOTES; i++) {
    const u = moteU(i, t);
    const y = NICHE_H - NICHE.z0 - u * (NICHE_H - 2);
    const x = NICHE.mid + Math.sin(u * Math.PI * 1.6 + i * 1.9) * NICHE.hw * 0.7;
    drawMote(g, x, y, 0.6 + 0.25 * ((i * 0.618) % 1), Math.pow(Math.sin(Math.PI * u), 1.4) * (o.night ? 1 : 0.2));
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

/** For the proposal page: everything a caller needs, as one object. */
export const RUNECUT_ART = { paintPlate, paintFrame, paintNiche, paintNightGlow, seedOf, sideOf, frameFor, FRAMES, FRAME_REACH, RIM, RIMS, SLAB, NICHE_W, NICHE_H, STONE, PPM };
export { FRAME_REACH, FRAMES, frameFor, frameLabel, paintFrame };
export type { FrameDef, FrameOpts, Pad, RGB };
