import {
  css, cut, cushion, drawPads, faceColour, glyphPath, grassTuft, hex, mix, roundelStrokes, STONE_INK, strokesPath, toneOf,
  type Ctx, type Pad, type Pt, type RGB,
} from '../render/runestone';
import { MOSS, rand } from '../render/ivy';
import { star } from '../render/star';
import { BRASS_PAINT, IRON_PAINT, LINEN_PAINT, LOG, MARBLE, METAL_TONE, WOOD_TONE } from '../render/materials';
import { NIGHT_WASH } from '../render/nightwash';

/**
 * Runecut's window frames: a band round the whole of a window, made of the
 * stuff of what the window holds -- sackcloth round the pack, a crate's
 * planks round a store, a scroll round the log -- so a window says what it is
 * before a word of it is read.
 *
 * Each is drawn in the island's own colours (materials.ts: its woods,
 * metals, linen, the wall-builders' plank, log and marble; the stones' tone,
 * cushions, flowers and grass) and edged in `STONE_INK`, like everything the
 * island draws. A few bold things each -- a knot, nail heads, a stitched
 * seam, a buckle -- sized to be read at the interface's own size, not fine
 * texture.
 *
 * A frame is the band from a window's edge in to its rim (`ArtOpts.rim`), and
 * may stand out past the edge by no more than `FRAME_REACH`: a knob, a knot,
 * a seal. Nothing of it is ever further in than the rim, where the content is.
 */

/** How far past a window's edge a frame may stand, in CSS px. */
export const FRAME_REACH = 4;
/**
 * Frames that stand further past a window than `FRAME_REACH`: the sack's
 * lumps, and the lavender and wheat caught in it, hang a little out over the
 * island. Never more than a few pixels: a frame is not to cover the game.
 */
export const FRAME_REACHES: Partial<Record<string, number>> = { burlap: 10, crate: 8, bench: 12, runestone: 12, guild: 12, altar: 8, parchment: 12, treasure: 14, stall: 36, scroll: 42, book: 24 };
/** How far past a window's edge a frame of this kind may stand. */
export const reachOf = (kind: string): number => FRAME_REACHES[kind] ?? FRAME_REACH;

/** One frame: what it is called, and the windows (by id) it goes round. */
export interface FrameDef {
  kind: string;
  label: string;
  for: string[];
}

/** Every frame, and the windows each goes round. A window not named in any has the plain stone rim. */
export const FRAMES: FrameDef[] = [
  { kind: 'burlap', label: 'Burlap sack', for: ['inventory'] },
  { kind: 'crate', label: 'Wooden crate', for: ['crate', 'stores'] },
  { kind: 'bench', label: "Carpenter's bench", for: ['craft'] },
  { kind: 'runestone', label: 'Stone pillars and oak', for: ['skills'] },
  { kind: 'guild', label: 'Iron-bound planks', for: ['trades'] },
  { kind: 'altar', label: 'Marble, pearl and sea glass', for: ['faith'] },
  { kind: 'parchment', label: 'Map stone, gold and sky', for: ['map'] },
  { kind: 'treasure', label: 'Treasure map', for: ['hoard'] },
  { kind: 'stall', label: 'Market stall', for: ['market'] },
  { kind: 'scroll', label: 'Blue marble and gold', for: ['events'] },
  { kind: 'book', label: 'Starred leather book', for: ['journal'] },
  { kind: 'noticeboard', label: 'Notice board', for: ['news'] },
  { kind: 'letter', label: 'Sealed letter', for: ['social'] },
  { kind: 'palisade', label: 'Palisade', for: ['deed'] },
  { kind: 'wicker', label: 'Wicker basket', for: ['wildermon'] },
  { kind: 'fieldbook', label: 'Field-worn leather', for: ['guide'] },
  { kind: 'laurel', label: 'Carved wood and laurel', for: ['boards'] },
  { kind: 'mirror', label: 'Gilded mirror', for: ['look'] },
  { kind: 'turf', label: 'Turf', for: ['tile'] },
  { kind: 'rope', label: 'Knotted rope', for: ['tracker'] },
  { kind: 'ironbound', label: 'Iron-bound oak', for: ['settings'] },
  { kind: 'chain', label: 'Iron chain', for: ['keeper'] },
  { kind: 'strap', label: 'Leather strap', for: ['hud'] },
  { kind: 'toolbelt', label: 'Tool belt', for: ['toolbar'] },
];

/**
 * Frames whose band is wider than a window's `RIM`, in CSS px, because what
 * they are made of is bulky: a stuffed sack's roll does not lie flat in 16.
 * The window grows by it like any rim, so its content keeps its room.
 */
export const FRAME_RIM: Partial<Record<string, number>> = { burlap: 34, crate: 24, bench: 26, runestone: 32, guild: 26, altar: 22, parchment: 22, treasure: 26, stall: 30, scroll: 26, book: 28 };

/**
 * The frames that are wider or stand further out than the rest, in words for
 * the text that states the numbers: "the burlap sack's 30 pixels" and so on,
 * read from `FRAME_RIM` and `FRAME_REACHES` so it cannot drift from them.
 */
export function frameOddities(of: Partial<Record<string, number>>): string {
  return FRAMES.filter((f) => of[f.kind] !== undefined).map((f) => `the ${f.label.toLowerCase()}'s ${of[f.kind]}`).join(', ');
}

/** The frame a window wears, by its id: 'stone' for the plain rim. */
export const frameFor = (id: string): string => FRAMES.find((f) => f.for.includes(id))?.kind ?? 'stone';

/** What a window's frame is called, by its id, for the words that name it. */
export const frameLabel = (id: string): string => FRAMES.find((f) => f.for.includes(id))?.label ?? 'Stone';

/** What a frame painter is told: its seed, after dark or not, and how wide its band is. */
export interface FrameOpts {
  seed: number;
  night: boolean;
  rim: number;
}

/* ---- the kit ------------------------------------------------------------------ */

const INK = css(STONE_INK);
const STONE = toneOf('#f5e8cf', '#aa9fac');
const shade = (c: RGB, k: number): RGB => mix(c, [64, 52, 58], k);
const light = (c: RGB, k: number): RGB => mix(c, [255, 252, 244], k);
const H = (h: string): RGB => hex(h);
const WOOD = { oak: H(WOOD_TONE.oak), pine: H(WOOD_TONE.pine), cherry: H(WOOD_TONE.cherry), willow: H(WOOD_TONE.willow), birch: H(WOOD_TONE.birch), walnut: H(WOOD_TONE.plum) };
const IRON = { body: H(IRON_PAINT.body), ink: H(IRON_PAINT.ink) };
const BRASS = { body: H(BRASS_PAINT.body), ink: H(BRASS_PAINT.ink) };
const GOLD: RGB = METAL_TONE.gold;
const LINEN = H(LINEN_PAINT.body);
const PARCH: RGB = [239, 226, 192];
const SEAL: RGB = [180, 88, 74];

/**
 * A side of the band, laid along x from its corner, `len` long, the band from
 * y = 0 at the window's edge in to y = F; out past the edge is y < 0. `i` is
 * which side: 0 the top, then the right, the bottom and the left, and `lit`
 * how much of the light it catches, the top and the left the most.
 */
interface Side {
  i: number;
  len: number;
  lit: number;
}

const LIT = [1, 0.8, 0.72, 0.92];

/** Do something along each side, in its own frame (`Side`). */
function eachSide(g: Ctx, w: number, h: number, draw: (s: Side) => void): void {
  const at: Array<[number, number, number, number]> = [[0, 0, 0, w], [w, 0, Math.PI / 2, h], [w, h, Math.PI, w], [0, h, -Math.PI / 2, h]];
  at.forEach(([x, y, a, len], i) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    draw({ i, len, lit: LIT[i] });
    g.restore();
  });
}

/** And at each corner, in the frame of the side that starts there: the corner is the square [0, F] × [0, F]. */
function eachCorner(g: Ctx, w: number, h: number, draw: (i: number) => void): void {
  eachSide(g, w, h, (s) => draw(s.i));
}

/** The band's own outline: the window's edge round the outside and the rim round the inside. */
function band(g: Ctx, w: number, h: number, F: number, inset = 0): void {
  g.beginPath();
  g.rect(inset, inset, w - inset * 2, h - inset * 2);
  g.rect(F, F, w - F * 2, h - F * 2);
}

/** A side's strip, mitred at both corners, so a side clipped to it meets the next on the diagonal. */
function mitre(g: Ctx, len: number, F: number, out = 0): void {
  g.beginPath();
  g.moveTo(-out, -out);
  g.lineTo(len + out, -out);
  g.lineTo(len - F, F);
  g.lineTo(F, F);
  g.closePath();
}

/** Fill the band, edged in ink round both sides. */
function fillBand(g: Ctx, w: number, h: number, F: number, fill: string | CanvasGradient | CanvasPattern): void {
  band(g, w, h, F);
  g.fillStyle = fill;
  g.fill('evenodd');
}

function inkBand(g: Ctx, w: number, h: number, F: number, wd = 1): void {
  g.strokeStyle = INK;
  g.lineWidth = wd;
  g.strokeRect(wd / 2, wd / 2, w - wd, h - wd);
  g.strokeRect(F - wd / 2, F - wd / 2, w - F * 2 + wd, h - F * 2 + wd);
}

/** A round head -- a nail, a rivet, a stud -- in a metal: its rim in ink, its body, and a glint up and to the left. */
function head(g: Ctx, x: number, y: number, r: number, body: RGB, ink: RGB): void {
  g.beginPath();
  g.arc(x, y, r + 0.5, 0, Math.PI * 2);
  g.fillStyle = css(ink);
  g.fill();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = css(body);
  g.fill();
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, Math.PI * 2);
  g.fillStyle = css(light(body, 0.6), 0.9);
  g.fill();
}

/** Wood grain along a board from x0 to x1, between y0 and y1: long wandering lines a step darker, and now and then a knot. */
function grain(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, tone: RGB, knots = true): void {
  const lines = Math.max(2, Math.round((y1 - y0) / 3.2));
  g.lineWidth = 0.7;
  for (let j = 0; j < lines; j++) {
    const y = y0 + ((j + 0.5) / lines) * (y1 - y0);
    const ph = R() * 6.28, amp = 0.5 + R() * 0.7, f = 0.04 + R() * 0.05;
    g.beginPath();
    for (let x = x0; x <= x1; x += 3) {
      const yy = y + Math.sin(x * f + ph) * amp;
      if (x === x0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.strokeStyle = css(shade(tone, 0.28), 0.55);
    g.stroke();
  }
  if (!knots) return;
  for (let x = x0 + 20 + R() * 40; x < x1 - 8; x += 50 + R() * 70) {
    const y = y0 + (y1 - y0) * (0.3 + R() * 0.4);
    g.beginPath();
    g.ellipse(x, y, 2.6, 1.3, 0, 0, Math.PI * 2);
    g.fillStyle = css(shade(tone, 0.35));
    g.fill();
    g.beginPath();
    g.ellipse(x, y, 4.2, 2.1, 0, 0, Math.PI * 2);
    g.strokeStyle = css(shade(tone, 0.3), 0.6);
    g.lineWidth = 0.6;
    g.stroke();
  }
}

/** A board along a side, from x0 to x1, the band's width: its face, its grain, its lit top edge and its ink. */
function board(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, tone: RGB, lit: number): void {
  const c = mix(shade(tone, 0.25), tone, lit);
  g.fillStyle = css(c);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  grain(g, R, x0 + 1, x1 - 1, y0 + 1, y1 - 1, c);
  g.fillStyle = css(light(c, 0.35), 0.8);
  g.fillRect(x0, y0 + 0.5, x1 - x0, 1);
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
}

/** A run of planks along a side, butted end to end every 40 to 80 px. Returns where the joints are. */
function planks(g: Ctx, R: () => number, len: number, y0: number, y1: number, tone: RGB, lit: number, from = 0, to = len): number[] {
  const joints: number[] = [];
  let x = from;
  while (x < to) {
    const next = Math.min(to, x + 40 + R() * 40);
    const t = mix(tone, light(tone, 0.12), R());
    board(g, R, x, to - next < 20 ? to : next, y0, y1, t, lit);
    if (to - next < 20) break;
    joints.push(next);
    x = next;
  }
  return joints;
}

/** Stitches along a line from x0 to x1 at y: dashes 3 px long, 3 px apart, in thread. */
function stitches(g: Ctx, x0: number, x1: number, y: number, thread: RGB, len = 3, gap = 3): void {
  g.lineCap = 'round';
  for (let x = x0; x + len <= x1; x += len + gap) {
    g.beginPath();
    g.moveTo(x, y + 0.6);
    g.lineTo(x + len, y + 0.6);
    g.strokeStyle = css(shade(thread, 0.6), 0.5);
    g.lineWidth = 1.5;
    g.stroke();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y);
    g.strokeStyle = css(thread);
    g.lineWidth = 1.1;
    g.stroke();
  }
}

/**
 * A twisted rope from x0 to x1 along y, `t` thick: its body, and the twist
 * as slanted strands every `t` or so, edged in ink.
 */
function rope(g: Ctx, x0: number, x1: number, y: number, t: number, tone: RGB): void {
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.strokeStyle = INK;
  g.lineWidth = t + 1.2;
  g.stroke();
  g.strokeStyle = css(tone);
  g.lineWidth = t;
  g.stroke();
  g.lineWidth = 1;
  for (let x = x0 + 1; x < x1 - 1; x += t * 0.9) {
    g.beginPath();
    g.moveTo(x - t * 0.3, y + t * 0.45);
    g.quadraticCurveTo(x, y, x + t * 0.3, y - t * 0.45);
    g.strokeStyle = css(shade(tone, 0.42));
    g.stroke();
    g.beginPath();
    g.moveTo(x - t * 0.05, y + t * 0.1);
    g.lineTo(x + t * 0.25, y - t * 0.3);
    g.strokeStyle = css(light(tone, 0.45), 0.8);
    g.stroke();
  }
}

/** Gilt: a line of gold with its lit and shaded edges. */
function gilt(g: Ctx, path: () => void, w = 1.4): void {
  path();
  g.strokeStyle = css(shade(GOLD, 0.45));
  g.lineWidth = w + 1;
  g.stroke();
  path();
  g.strokeStyle = css(GOLD);
  g.lineWidth = w;
  g.stroke();
  path();
  g.strokeStyle = css(light(GOLD, 0.55), 0.8);
  g.lineWidth = w * 0.35;
  g.stroke();
}

/** A ragged edge along a side, eating in from y = 0 by up to `deep`, then cleared: deckle, a tear, a burn. */
function ragged(g: Ctx, R: () => number, len: number, deep: number, step = 3): Pt[] {
  const pts: Pt[] = [];
  for (let x = 0; x <= len; x += step) pts.push([x, R() * deep * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.05)))]);
  pts.push([len, 0]);
  return pts;
}

/** A spray of laurel from x along y, `len` long (negative runs back): a stem, and leaves 6 px long in pairs every 6 px, smaller toward the tip. */
function sprig(g: Ctx, x: number, len: number, y: number): void {
  const dir = Math.sign(len), n = Math.max(2, Math.floor(Math.abs(len) / 6));
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + len, y);
  g.strokeStyle = css(H('#4b6c57'));
  g.lineWidth = 1;
  g.stroke();
  for (let k = 0; k < n; k++) {
    const at = x + dir * (k + 0.6) * 6, s = 1 - (k / n) * 0.45;
    for (const sg of [-1, 1]) {
      g.save();
      g.translate(at, y);
      g.rotate(dir * sg * 0.6 + (dir < 0 ? Math.PI : 0));
      g.beginPath();
      g.ellipse(3.2 * s, 0, 3.4 * s, 1.5 * s, 0, 0, Math.PI * 2);
      g.fillStyle = css(sg < 0 ? H('#86ad8e') : H('#6f9a78'));
      g.fill();
      g.strokeStyle = css(H('#3f5c49'));
      g.lineWidth = 0.7;
      g.stroke();
      g.restore();
    }
  }
}

/** A tally knot at (x, y) on a rope, `r` across: a barrel of turns round the rope, ruled with the wraps. */
function barrel(g: Ctx, x: number, y: number, r: number, tone: RGB): void {
  g.beginPath();
  g.ellipse(x, y, r * 1.1, r, 0, 0, Math.PI * 2);
  g.fillStyle = css(light(tone, 0.08));
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.stroke();
  g.save();
  g.clip();
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.moveTo(x + k * r * 0.45 - r * 0.25, y + r);
    g.lineTo(x + k * r * 0.45 + r * 0.25, y - r);
    g.strokeStyle = css(shade(tone, 0.45));
    g.lineWidth = 1;
    g.stroke();
  }
  g.restore();
  g.beginPath();
  g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2);
  g.fillStyle = css(light(tone, 0.5), 0.7);
  g.fill();
}


/* ---- the sack's own kit ---------------------------------------------------- */

/** A wobble along a length, between about 0 and 1: two waves of the seed's own, for a stuffed thing's lumps. */
function lumps(R: () => number, l1: number, l2: number): (s: number) => number {
  const p1 = R() * Math.PI * 2, p2 = R() * Math.PI * 2;
  return (s) => 0.5 + 0.3 * Math.sin((s / l1) * Math.PI * 2 + p1) + 0.2 * Math.sin((s / l2) * Math.PI * 2 + p2);
}

/**
 * Round a rectangle `d` in from the window's edge with its corners `r` round,
 * pushed out from it by `off(s)` at `s` along it from the top: a stuffed
 * roll's lumpy edge, as points every 2 px.
 */
function lumpyRect(w: number, h: number, d: number, r: number, off: (s: number) => number): Pt[] {
  const pts: Pt[] = [];
  const x0 = d, y0 = d, x1 = w - d, y1 = h - d;
  let s = 0;
  const line = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number): void => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 2));
    for (let i = 0; i < n; i++) {
      const t = i / n, o = off(s + len * t);
      pts.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]);
    }
    s += len;
  };
  const arc = (cx: number, cy: number, a0: number): void => {
    const len = (r * Math.PI) / 2, n = Math.max(2, Math.ceil(len / 2));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2), o = off(s + (len * i) / n);
      pts.push([cx + Math.cos(a) * (r + o), cy + Math.sin(a) * (r + o)]);
    }
    s += len;
  };
  line(x0 + r, y0, x1 - r, y0, 0, -1);
  arc(x1 - r, y0 + r, -Math.PI / 2);
  line(x1, y0 + r, x1, y1 - r, 1, 0);
  arc(x1 - r, y1 - r, 0);
  line(x1 - r, y1, x0 + r, y1, 0, 1);
  arc(x0 + r, y1 - r, Math.PI / 2);
  line(x0, y1 - r, x0, y0 + r, -1, 0);
  arc(x0 + r, y0 + r, Math.PI);
  return pts;
}

/** A closed outline through points, as a new path. */
function poly(g: Ctx, pts: Pt[]): void {
  g.beginPath();
  polyTo(g, pts);
}

/** A closed outline through points, added to the path as it is. */
function polyTo(g: Ctx, pts: Pt[]): void {
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/**
 * Burlap: a coarse plain weave, as it looks close to: every thread shows as a
 * short rounded strand where it passes over the one across it, and dips out
 * of sight under the next, so along and across alternate like a chequer with
 * the dark of the gaps between. Each thread is a little lighter or darker,
 * thicker or thinner than its neighbour, and here and there is a slub where
 * the jute bunched. Over the box from (x0, y0) to (x1, y1), and only the
 * `band` along its edges, which is all of it a frame shows.
 */
function burlapWeave(g: Ctx, R: () => number, x0: number, y0: number, x1: number, y1: number, band: number, base: RGB): void {
  const step = 3.4;
  g.fillStyle = css(shade(base, 0.6));
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rows: Array<[number, number]> = [], cols: Array<[number, number]> = [];
  for (let y = y0; y < y1; y += step) rows.push([(R() - 0.5) * 0.26, 0.62 + R() * 0.22]);
  for (let x = x0; x < x1; x += step) cols.push([(R() - 0.5) * 0.26, 0.62 + R() * 0.22]);
  const inBand = (x: number, y: number): boolean => x < x0 + band + 4 || x > x1 - band - 4 || y < y0 + band + 4 || y > y1 - band - 4;
  const pill = (x: number, y: number, pw: number, ph: number): void => {
    const r = Math.min(pw, ph) / 2;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + pw - r, y);
    g.arc(x + pw - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    g.lineTo(x + r, y + ph);
    g.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
    g.fill();
  };
  rows.forEach(([rt, rw], j) => {
    const y = y0 + j * step;
    cols.forEach(([ct, cw], i) => {
      const x = x0 + i * step;
      if (!inBand(x, y)) return;
      if ((i + j) % 2 === 0) {
        // The thread along, over this one across.
        const th = step * rw;
        g.fillStyle = css(mix(base, light(base, 0.25), 0.4 + rt * 2));
        pill(x - step * 0.12, y + (step - th) / 2, step * 1.24, th);
        g.fillStyle = css(light(base, 0.34 + rt), 0.75);
        g.fillRect(x + step * 0.2, y + (step - th) / 2 + th * 0.22, step * 0.6, th * 0.22);
      } else {
        // The thread across, over this one along.
        const tw = step * cw;
        g.fillStyle = css(mix(shade(base, 0.08), base, 0.5 + ct * 2));
        pill(x + (step - tw) / 2, y - step * 0.12, tw, step * 1.24);
        g.fillStyle = css(light(base, 0.22 + ct), 0.6);
        g.fillRect(x + (step - tw) / 2 + tw * 0.22, y + step * 0.2, tw * 0.22, step * 0.6);
      }
    });
  });
  // Slubs: a thread thickened for a few weaves.
  for (let k = 0; k < ((x1 - x0) + (y1 - y0)) / 12; k++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
    if (!inBand(x, y)) continue;
    g.fillStyle = css(light(base, 0.18), 0.85);
    if (R() < 0.5) pill(x, y, 7 + R() * 7, 1.6);
    else pill(x, y, 1.6, 7 + R() * 7);
  }
}

/** A dashed line of stitches along an outline: `on` px of thread, `off` px gap, in thread over its own shadow. */
function dashAlong(g: Ctx, pts: Pt[], on: number, off: number, thread: RGB): void {
  g.lineCap = 'round';
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const seg = Math.hypot(bx - ax, by - ay);
    const startOn = acc % (on + off) < on;
    acc += seg;
    if (!startOn) continue;
    g.beginPath();
    g.moveTo(ax, ay + 0.7);
    g.lineTo(bx, by + 0.7);
    g.strokeStyle = css(shade(thread, 0.6), 0.45);
    g.lineWidth = 1.7;
    g.stroke();
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.strokeStyle = css(light(thread, 0.15));
    g.lineWidth = 1.2;
    g.stroke();
  }
}

/** A cross-stitch at (x, y), `r` from its middle to a corner: two strokes of thread over their shadow. */
function crossStitch(g: Ctx, x: number, y: number, r: number, thread: RGB): void {
  g.lineCap = 'round';
  for (const [dx, dy, c, wd] of [[0.6, 0.8, css(shade(thread, 0.65), 0.55), 2], [0, 0, css(light(thread, 0.2)), 1.3]] as Array<[number, number, string, number]>) {
    g.beginPath();
    g.moveTo(x - r + dx, y - r + dy);
    g.lineTo(x + r + dx, y + r + dy);
    g.moveTo(x + r + dx, y - r + dy);
    g.lineTo(x - r + dx, y + r + dy);
    g.strokeStyle = c;
    g.lineWidth = wd;
    g.stroke();
  }
}

/** A patch sewn on at (x, y) in a side's frame: sage cloth `pw` by `ph`, turned `rot`, its edge whipped down in pale thread. */
function patch(g: Ctx, R: () => number, x: number, y: number, pw: number, ph: number, rot: number, thread: RGB): void {
  const sage = H('#8fa58c');
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const corners: Pt[] = [[-pw / 2 + R(), -ph / 2 + R()], [pw / 2 - R(), -ph / 2 + R()], [pw / 2 - R(), ph / 2 - R()], [-pw / 2 + R(), ph / 2 - R()]];
  g.save();
  poly(g, corners);
  g.shadowColor = 'rgba(60, 40, 26, 0.45)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.fillStyle = css(sage);
  g.fill();
  g.restore();
  g.save();
  poly(g, corners);
  g.clip();
  // Its own finer weave, and the light across it.
  for (let yy = -ph / 2; yy < ph / 2; yy += 2) {
    for (let xx = -pw / 2 + (Math.round(yy / 2) % 2) * 2; xx < pw / 2; xx += 4) {
      g.fillStyle = css(light(sage, 0.14), 0.8);
      g.fillRect(xx, yy, 2, 1.2);
    }
  }
  const lit = g.createLinearGradient(0, -ph / 2, 0, ph / 2);
  lit.addColorStop(0, 'rgba(255, 252, 236, 0.22)');
  lit.addColorStop(1, 'rgba(40, 52, 44, 0.25)');
  g.fillStyle = lit;
  g.fillRect(-pw / 2, -ph / 2, pw, ph);
  g.restore();
  poly(g, corners);
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.stroke();
  // Whipped down: a stitch across the edge every 4 px.
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k], [bx, by] = corners[(k + 1) % 4];
    const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let t = 3; t < len - 2; t += 4) {
      const px = ax + ((bx - ax) * t) / len, py = ay + ((by - ay) * t) / len;
      g.beginPath();
      g.moveTo(px + nx * 2.2, py + ny * 2.2);
      g.lineTo(px - nx * 2 + (bx - ax) / len, py - ny * 2 + (by - ay) / len);
      g.strokeStyle = css(thread);
      g.lineWidth = 0.9;
      g.stroke();
    }
  }
  g.restore();
}

/** A quadratic curve from a through c to b, as points about 2 px apart. */
function curve(a: Pt, c: Pt, b: Pt): Pt[] {
  const n = Math.max(4, Math.ceil((Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(b[0] - c[0], b[1] - c[1])) / 2));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

/** An ellipse about (x, y), turned `rot`, as points round it. */
function ellipsePts(x: number, y: number, rx: number, ry: number, rot: number): Pt[] {
  const pts: Pt[] = [];
  const n = Math.max(12, Math.ceil((rx + ry) * 1.6));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    pts.push([x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)]);
  }
  return pts;
}

/**
 * A twisted cord along points, `t` thick: its body over its ink, and the lay
 * -- the strands crossing it on the slant every 0.85 of its thickness, each
 * shaded on one side and lit on the other.
 */
function twist(g: Ctx, pts: Pt[], t: number, tone: RGB): void {
  const path = (): void => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  path();
  g.strokeStyle = INK;
  g.lineWidth = t + 1.6;
  g.stroke();
  path();
  g.strokeStyle = css(tone);
  g.lineWidth = t;
  g.stroke();
  const step = t * 0.85;
  let next = step * 0.5;
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (!seg) continue;
    const ux = (bx - ax) / seg, uy = (by - ay) / seg, nx = -uy, ny = ux;
    while (next <= run + seg) {
      const d = next - run, x = ax + ux * d, y = ay + uy * d;
      g.beginPath();
      g.moveTo(x - nx * t * 0.5 - ux * t * 0.35, y - ny * t * 0.5 - uy * t * 0.35);
      g.quadraticCurveTo(x + ux * t * 0.05, y + uy * t * 0.05, x + nx * t * 0.5 + ux * t * 0.35, y + ny * t * 0.5 + uy * t * 0.35);
      g.strokeStyle = css(shade(tone, 0.5));
      g.lineWidth = 0.9;
      g.stroke();
      g.beginPath();
      g.moveTo(x - nx * t * 0.1 + ux * t * 0.12, y - ny * t * 0.1 + uy * t * 0.12);
      g.lineTo(x + nx * t * 0.3 + ux * t * 0.36, y + ny * t * 0.3 + uy * t * 0.36);
      g.strokeStyle = css(light(tone, 0.5), 0.85);
      g.lineWidth = 0.8;
      g.stroke();
      next += step;
    }
    run += seg;
  }
}

/** The end of a cord at (x, y): bound in a whipping, and frayed out below it. */
function tassel(g: Ctx, x: number, y: number, tone: RGB): void {
  g.lineCap = 'round';
  for (let k = -3; k <= 3; k++) {
    g.beginPath();
    g.moveTo(x, y + 1);
    g.quadraticCurveTo(x + k * 0.6, y + 5, x + k * 1.1, y + 9 + Math.abs(k % 2) * 1.5);
    g.strokeStyle = css(k % 2 ? light(tone, 0.25) : tone);
    g.lineWidth = 1;
    g.stroke();
  }
  barrel(g, x, y, 2.6, shade(tone, 0.1));
}

/** A brass grommet at (x, y), `r` across: a ring of brass round a hole through the cloth. */
function grommet(g: Ctx, x: number, y: number, r: number): void {
  head(g, x, y, r, BRASS.body, BRASS.ink);
  g.beginPath();
  g.arc(x + 0.3, y + 0.3, r * 0.45, 0, Math.PI * 2);
  g.fillStyle = css(H('#3c2a22'));
  g.fill();
  g.strokeStyle = css(shade(BRASS.body, 0.4));
  g.lineWidth = 0.8;
  g.stroke();
}

/** A sprig of lavender tied on at (x, y), hanging `len`: a few stems, narrow leaves at the tie, and the flower spikes at their ends. */
function lavender(g: Ctx, R: () => number, x: number, y: number, len: number): void {
  const stem = H('#6f8b5a'), bloom = H('#8f7cc4'), pale = H('#b9a9de');
  const ends: Array<[number, number, number]> = [];
  for (let k = 0; k < 5; k++) {
    const ex = x - 5 + (k - 2) * 4.4 + (R() - 0.5) * 2, ey = y + len * (0.78 + R() * 0.22);
    ends.push([ex, ey, (k - 2) * 0.1]);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (k - 2) * 1.6, (y + ey) / 2, ex, ey);
    g.strokeStyle = css(shade(stem, 0.35));
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = css(stem);
    g.lineWidth = 0.9;
    g.stroke();
  }
  // Leaves, narrow and grey-green, off the stems below the tie, hanging down with them.
  for (const [dy, a] of [[3, -0.32], [5, 0.26], [9, -0.18], [12, 0.34], [16, -0.1]] as Array<[number, number]>) {
    g.save();
    g.translate(x - dy * 0.12, y + dy);
    g.rotate(a);
    g.beginPath();
    g.ellipse(0, 5, 1, 5.2, 0, 0, Math.PI * 2);
    g.fillStyle = css(H('#8aa577'));
    g.fill();
    g.strokeStyle = css(H('#45603b'));
    g.lineWidth = 0.6;
    g.stroke();
    g.restore();
  }
  // The spikes: whorls of buds up the last third of each stem.
  for (const [ex, ey, lean] of ends) {
    for (let j = 0; j < 8; j++) {
      const t = j / 8, bx = ex - lean * j * 2, by = ey - len * 0.4 * (1 - t);
      for (const sg of [-1, 1]) {
        g.beginPath();
        g.ellipse(bx + sg * 1.3, by, 1.6 - t * 0.4, 2.2 - t * 0.4, sg * 0.4, 0, Math.PI * 2);
        g.fillStyle = css(j % 2 ? pale : bloom);
        g.fill();
        g.strokeStyle = css(shade(bloom, 0.5));
        g.lineWidth = 0.6;
        g.stroke();
      }
    }
  }
  barrel(g, x, y, 2.4, H('#a7834f'));
}

/** A few ears of wheat at (x, y), standing up `len`: their stalks, and the grains in two rows with awns off them. */
function wheat(g: Ctx, R: () => number, x: number, y: number, len: number): void {
  const straw = H('#c9a65a'), grain = H('#e1bf6c');
  for (let k = 0; k < 3; k++) {
    const lean = (k - 1) * 0.16 - 0.12, tx = x + Math.sin(lean) * len + (R() - 0.5) * 2, ty = y - Math.cos(lean) * len * (0.85 + k * 0.08);
    g.beginPath();
    g.moveTo(x, y + len * 0.25);
    g.quadraticCurveTo(x + (tx - x) * 0.3, (y + ty) / 2, tx, ty);
    g.strokeStyle = css(shade(straw, 0.45));
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = css(straw);
    g.lineWidth = 0.9;
    g.stroke();
    const ux = (tx - x) / len, uy = (ty - y) / len;
    for (let j = 0; j < 7; j++) {
      const t = 0.56 + j * 0.065, gx = x + (tx - x) * t, gy = y + (ty - y) * t;
      for (const sg of [-1, 1]) {
        const ox = -uy * sg * 1.8, oy = ux * sg * 1.8;
        g.beginPath();
        g.ellipse(gx + ox, gy + oy, 1.6, 2.8, Math.atan2(uy, ux) + Math.PI / 2 + sg * 0.5, 0, Math.PI * 2);
        g.fillStyle = css(grain);
        g.fill();
        g.strokeStyle = css(shade(grain, 0.55));
        g.lineWidth = 0.6;
        g.stroke();
        g.beginPath();
        g.moveTo(gx + ox, gy + oy);
        g.lineTo(gx + ox * 3 + ux * 5, gy + oy * 3 + uy * 5);
        g.strokeStyle = css(shade(straw, 0.2), 0.8);
        g.lineWidth = 0.5;
        g.stroke();
      }
    }
  }
  barrel(g, x, y + len * 0.2, 2.2, H('#a7834f'));
}

/**
 * The pack's rune, on a linen tag hung from its drawstring -- `W` by `H` --
 * rather than cut in a stone niche: its edge stitched, an eyelet at its top
 * with the cord through it, and the rune painted in amber at (x, y) from the
 * top, `s` its size, where the niche's would be.
 */
export function paintTag(g: Ctx, glyph: string, W: number, Hh: number, x: number, y: number, s: number, night: boolean): void {
  const linen = H('#efe2c4'), twine = H('#a7834f');
  const shape = (): void => {
    g.beginPath();
    g.moveTo(5, 6);
    g.lineTo(W - 5, 6);
    g.quadraticCurveTo(W - 3, 6, W - 3, 8);
    g.lineTo(W - 3, Hh - 4);
    g.quadraticCurveTo(W - 3, Hh - 2, W - 5, Hh - 2);
    g.lineTo(5, Hh - 2);
    g.quadraticCurveTo(3, Hh - 2, 3, Hh - 4);
    g.lineTo(3, 8);
    g.quadraticCurveTo(3, 6, 5, 6);
    g.closePath();
  };
  g.save();
  g.lineJoin = 'round';
  shape();
  g.shadowColor = 'rgba(46, 30, 22, 0.45)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.2;
  g.fillStyle = css(linen);
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  for (let yy = 6; yy < Hh; yy += 2) {
    g.fillStyle = css(shade(linen, 0.06), 0.7);
    g.fillRect(3, yy, W - 6, 0.7);
  }
  const lit = g.createLinearGradient(0, 6, 0, Hh);
  lit.addColorStop(0, 'rgba(255, 252, 240, 0.35)');
  lit.addColorStop(1, 'rgba(120, 90, 60, 0.18)');
  g.fillStyle = lit;
  g.fillRect(0, 0, W, Hh);
  g.restore();
  shape();
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.stroke();
  // Stitched round, just in from its edge.
  g.setLineDash([2, 1.6]);
  g.strokeStyle = css(twine);
  g.lineWidth = 0.8;
  g.strokeRect(5.2, 8.2, W - 10.4, Hh - 12.4);
  g.setLineDash([]);
  // The eyelet, and the cord through it up and away to the knot.
  head(g, W / 2, 10.5, 2, BRASS.body, BRASS.ink);
  g.beginPath();
  g.arc(W / 2, 10.5, 0.9, 0, Math.PI * 2);
  g.fillStyle = css(H('#3c2a22'));
  g.fill();
  twist(g, [[W / 2, 10.5], [W / 2 - 3, 4], [W / 2 - 8, 0.5], [-2, -1]], 2.2, twine);
  // The rune, painted on in amber over a darker stroke.
  g.save();
  g.translate(0, Hh);
  g.scale(1, -1);
  glyphPath(g, glyph, x, Hh - y, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = css(H('#7a4a1c'));
  g.lineWidth = 2.6;
  g.stroke();
  g.strokeStyle = css(H('#d39a3a'));
  g.lineWidth = 1.6;
  g.stroke();
  g.restore();
  if (night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-4, -4, W + 8, Hh + 8);
    g.restore();
  }
}


/**
 * A corner of the sack gathered up and tied: three or four lobes of the cloth
 * flaring out past the corner from a neck at (x, y), in its weave, shaded
 * into the neck and folded toward it, and a turn of twine round the neck.
 * `ang` is the way out from the corner.
 */
function gather(g: Ctx, R: () => number, x: number, y: number, ang: number, F: number, sack: RGB, twine: RGB): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const lobes: Array<[number, number, number]> = [[-0.75, F * 0.62, F * 0.3], [-0.05, F * 0.78, F * 0.34], [0.7, F * 0.6, F * 0.3]];
  const shape = (): void => {
    g.beginPath();
    for (const [a, len, wd] of lobes) {
      const cx = Math.cos(a) * len * 0.55, cy = Math.sin(a) * len * 0.55;
      g.ellipse(cx, cy, len * 0.55, wd, a, 0, Math.PI * 2);
    }
  };
  // The outline first, wide, so the cloth laid over it leaves only the outside of it showing.
  g.save();
  shape();
  g.shadowColor = 'rgba(46, 30, 22, 0.5)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.strokeStyle = css(H('#3d2a1c'));
  g.lineWidth = 3.2;
  g.stroke();
  g.restore();
  g.save();
  shape();
  g.clip('nonzero');
  burlapWeave(g, R, -F, -F, F, F, F * 2, sack);
  const neck = g.createRadialGradient(0, 0, 1, 0, 0, F * 0.85);
  neck.addColorStop(0, 'rgba(62, 38, 20, 0.7)');
  neck.addColorStop(0.35, 'rgba(62, 38, 20, 0.15)');
  neck.addColorStop(0.62, 'rgba(255, 244, 214, 0.28)');
  neck.addColorStop(1, 'rgba(62, 38, 20, 0.4)');
  g.fillStyle = neck;
  g.fillRect(-F, -F, F * 2, F * 2);
  // Where one lobe lies over the next, a fold of shade along its edge.
  for (const [a2, len, wd] of lobes.slice(1)) {
    g.beginPath();
    g.ellipse(Math.cos(a2) * len * 0.55, Math.sin(a2) * len * 0.55, len * 0.55, wd, a2, Math.PI * 0.55, Math.PI * 1.45);
    g.strokeStyle = 'rgba(62, 38, 20, 0.5)';
    g.lineWidth = 1.2;
    g.stroke();
  }
  // Folds running in to the neck.
  for (let k = 0; k < 7; k++) {
    const a2 = -1.1 + (k / 6) * 2.2 + (R() - 0.5) * 0.15, r = F * (0.45 + R() * 0.3);
    g.beginPath();
    g.moveTo(Math.cos(a2) * 3, Math.sin(a2) * 3);
    g.quadraticCurveTo(Math.cos(a2 + 0.12) * r * 0.5, Math.sin(a2 + 0.12) * r * 0.5, Math.cos(a2) * r, Math.sin(a2) * r);
    g.strokeStyle = 'rgba(70, 44, 26, 0.5)';
    g.lineWidth = 1;
    g.stroke();
  }
  g.restore();
  // Tied round the neck: three turns of twine across it.
  for (let k = -1; k <= 1; k++) twist(g, curve([k * 2.6 - 1, -F * 0.24], [k * 2.6 - 3.5, 0], [k * 2.6 - 1, F * 0.24]), 2.4, twine);
  g.restore();
}


/** A small brass bell hung from (x, y0) on a cord to its crown at y1: its body, a lit side, its mouth and the clapper showing. */
function bell(g: Ctx, x: number, y0: number, y1: number, twine: RGB): void {
  twist(g, [[x, y0], [x + 0.6, (y0 + y1) / 2], [x, y1 - 2]], 1.8, twine);
  const r = 5.4;
  g.beginPath();
  g.moveTo(x - r * 0.45, y1 - 1);
  g.quadraticCurveTo(x - r * 0.6, y1 + r * 0.9, x - r, y1 + r * 1.55);
  g.lineTo(x + r, y1 + r * 1.55);
  g.quadraticCurveTo(x + r * 0.6, y1 + r * 0.9, x + r * 0.45, y1 - 1);
  g.closePath();
  const body = g.createLinearGradient(x - r, 0, x + r, 0);
  body.addColorStop(0, css(light(BRASS.body, 0.45)));
  body.addColorStop(0.45, css(BRASS.body));
  body.addColorStop(1, css(shade(BRASS.body, 0.35)));
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.ellipse(x, y1 + r * 1.55, r, r * 0.3, 0, 0, Math.PI * 2);
  g.fillStyle = css(shade(BRASS.body, 0.55));
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(x + 0.6, y1 + r * 1.75, 1.1, 0, Math.PI * 2);
  g.fillStyle = css(BRASS.ink);
  g.fill();
}


/* ---- the crate's own kit --------------------------------------------------- */

/** A rounded plank from x0 to x1 between y0 and y1 in a side's frame: its face, its grain, a lit top edge, a shaded foot, and its outline. */
function plank(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, tone: RGB): void {
  const r = Math.min(3.5, (y1 - y0) / 3);
  const path = (): void => {
    g.beginPath();
    g.moveTo(x0 + r, y0);
    g.lineTo(x1 - r, y0);
    g.quadraticCurveTo(x1, y0, x1, y0 + r);
    g.lineTo(x1, y1 - r);
    g.quadraticCurveTo(x1, y1, x1 - r, y1);
    g.lineTo(x0 + r, y1);
    g.quadraticCurveTo(x0, y1, x0, y1 - r);
    g.lineTo(x0, y0 + r);
    g.quadraticCurveTo(x0, y0, x0 + r, y0);
    g.closePath();
  };
  g.save();
  path();
  g.shadowColor = 'rgba(60, 40, 24, 0.4)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 1.5;
  g.fillStyle = css(tone);
  g.fill();
  g.restore();
  g.save();
  path();
  g.clip();
  grain(g, R, x0 + 1, x1 - 1, y0 + 2, y1 - 2, tone);
  const round = g.createLinearGradient(0, y0, 0, y1);
  round.addColorStop(0, 'rgba(255, 250, 236, 0.55)');
  round.addColorStop(0.18, 'rgba(255, 250, 236, 0.08)');
  round.addColorStop(0.75, 'rgba(90, 60, 34, 0)');
  round.addColorStop(1, 'rgba(90, 60, 34, 0.32)');
  g.fillStyle = round;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  path();
  g.strokeStyle = css(H('#6a4a30'));
  g.lineWidth = 1.3;
  g.stroke();
}

/** A corner block, a size larger than the band and standing a little out past it, dovetailed to the planks either side and pinned with a brass rivet. */
function cornerBlock(g: Ctx, R: () => number, F: number, tone: RGB): void {
  const s = F * 1.14, o = -1.5;
  plank(g, R, o, s, o, s, tone);
  // The tail of the plank along it showing in the block's face, and the one down it.
  g.strokeStyle = css(H('#6a4a30'));
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(s, F * 0.22);
  g.lineTo(F * 0.62, F * 0.22);
  g.lineTo(F * 0.62, F * 0.62);
  g.lineTo(s, F * 0.62);
  g.moveTo(F * 0.22, s);
  g.lineTo(F * 0.22, F * 0.78);
  g.lineTo(F * 0.6, F * 0.78);
  g.lineTo(F * 0.6, s);
  g.stroke();
  g.fillStyle = css(shade(tone, 0.12), 0.6);
  g.fillRect(F * 0.62, F * 0.22, s - F * 0.62, F * 0.4);
  head(g, F * 0.32, F * 0.36, Math.max(1.6, F * 0.11), BRASS.body, BRASS.ink);
}

/** A brass hasp across a bar at x, its middle at y in a side's frame: a plate with rounded corners, a slot, and a screw at each end. */
function hasp(g: Ctx, x: number, y: number, F: number): void {
  const pw = F * 0.5, ph = F * 0.82;
  g.save();
  g.beginPath();
  g.roundRect(x - pw / 2, y - ph / 2, pw, ph, 2);
  g.shadowColor = 'rgba(50, 34, 20, 0.45)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  const b = g.createLinearGradient(x - pw / 2, 0, x + pw / 2, 0);
  b.addColorStop(0, css(light(BRASS.body, 0.4)));
  b.addColorStop(0.5, css(BRASS.body));
  b.addColorStop(1, css(shade(BRASS.body, 0.3)));
  g.fillStyle = b;
  g.fill();
  g.restore();
  g.beginPath();
  g.roundRect(x - pw / 2, y - ph / 2, pw, ph, 2);
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.roundRect(x - pw * 0.18, y - ph * 0.12, pw * 0.36, ph * 0.24, 1);
  g.fillStyle = css(shade(BRASS.body, 0.6));
  g.fill();
  head(g, x, y - ph * 0.33, Math.max(1, F * 0.06), light(BRASS.body, 0.1), BRASS.ink);
  head(g, x, y + ph * 0.33, Math.max(1, F * 0.06), light(BRASS.body, 0.1), BRASS.ink);
}

/** A brass bar handle on a side at x: two round mounts on the plank and the bar between them, bowed out past the window's edge. */
function barHandle(g: Ctx, x: number, F: number): void {
  const span = F * 1.5, out = -6;
  const bar = (): void => {
    g.beginPath();
    g.moveTo(x - span, F * 0.42);
    g.bezierCurveTo(x - span, out, x + span, out, x + span, F * 0.42);
  };
  g.lineCap = 'round';
  bar();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 5.4;
  g.stroke();
  bar();
  g.strokeStyle = css(BRASS.body);
  g.lineWidth = 3.6;
  g.stroke();
  bar();
  g.strokeStyle = css(light(BRASS.body, 0.55), 0.9);
  g.lineWidth = 1.1;
  g.stroke();
  for (const mx of [x - span, x + span]) {
    g.beginPath();
    g.arc(mx, F * 0.42, F * 0.22, 0, Math.PI * 2);
    g.fillStyle = css(BRASS.body);
    g.fill();
    g.strokeStyle = css(BRASS.ink);
    g.lineWidth = 1;
    g.stroke();
    head(g, mx, F * 0.42, Math.max(1, F * 0.07), light(BRASS.body, 0.2), BRASS.ink);
  }
}

/** A sprig burnt into a plank at (x, y): three leaves fanned from the middle, and a stem curling away each side with a leaf or two on it. */
function burnt(g: Ctx, x: number, y: number, F: number, tone: RGB): void {
  const s = F * 0.3;
  g.save();
  g.strokeStyle = css(tone, 0.85);
  g.fillStyle = css(tone, 0.22);
  g.lineWidth = 1;
  for (const a of [-0.75, 0, 0.75]) {
    g.save();
    g.translate(x, y + s * 0.6);
    g.rotate(a - Math.PI / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(s * 0.5, -s * 0.45, s * 1.2, 0);
    g.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0);
    g.fill();
    g.stroke();
    g.restore();
  }
  for (const sg of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sg * s * 0.4, y + s * 0.5);
    g.bezierCurveTo(x + sg * s * 1.6, y + s * 0.9, x + sg * s * 2.4, y - s * 0.4, x + sg * s * 3.6, y);
    g.stroke();
    g.beginPath();
    g.arc(x + sg * s * 3.9, y - s * 0.2, s * 0.35, 0, Math.PI * 1.6);
    g.stroke();
    for (const t of [1.6, 2.8]) {
      g.save();
      g.translate(x + sg * s * t, y + s * (t < 2 ? 0.55 : 0.05));
      g.rotate(sg < 0 ? Math.PI + 0.5 : -0.5);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(s * 0.35, -s * 0.3, s * 0.8, 0);
      g.quadraticCurveTo(s * 0.35, s * 0.3, 0, 0);
      g.fill();
      g.stroke();
      g.restore();
    }
  }
  g.restore();
}

/** A clump of moss at (x, y), `r` across: little cushions in the stones' moss greens, darker at the foot of each. */
function mossClump(g: Ctx, R: () => number, x: number, y: number, r: number): void {
  for (let k = 0; k < 9; k++) {
    const a = R() * Math.PI * 2, d = R() * r, cr = r * (0.22 + R() * 0.25);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6;
    g.beginPath();
    g.arc(cx, cy, cr, 0, Math.PI * 2);
    g.fillStyle = css(H(MOSS.under));
    g.fill();
    g.beginPath();
    g.arc(cx - cr * 0.2, cy - cr * 0.25, cr * 0.75, 0, Math.PI * 2);
    g.fillStyle = css(H(k % 3 ? MOSS.fill : MOSS.lit));
    g.fill();
  }
}

/** An ivy leaf at (x, y) pointing along `ang`, `s` long: heart-based and pointed, two greens, a darker edge and its veins. */
function ivyLeaf(g: Ctx, x: number, y: number, ang: number, s: number, lit: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const shape = (): void => {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-s * 0.2, -s * 0.62, s * 0.55, -s * 0.72, s, 0);
    g.bezierCurveTo(s * 0.55, s * 0.72, -s * 0.2, s * 0.62, 0, 0);
    g.closePath();
  };
  shape();
  const f = g.createLinearGradient(0, -s * 0.5, s * 0.6, s * 0.5);
  f.addColorStop(0, css(H(lit ? MOSS.lit : MOSS.fill)));
  f.addColorStop(1, css(H(lit ? MOSS.fill : MOSS.under)));
  g.fillStyle = f;
  g.fill();
  g.strokeStyle = css(H(MOSS.dark));
  g.lineWidth = 0.8;
  g.stroke();
  g.beginPath();
  g.moveTo(s * 0.08, 0);
  g.lineTo(s * 0.85, 0);
  g.moveTo(s * 0.3, 0);
  g.lineTo(s * 0.55, -s * 0.28);
  g.moveTo(s * 0.3, 0);
  g.lineTo(s * 0.55, s * 0.28);
  g.strokeStyle = css(H(MOSS.dark), 0.55);
  g.lineWidth = 0.6;
  g.stroke();
  g.restore();
}

/** A flower's petals and their edge: white, or lavender. */
type Petal = readonly [string, string];
const WHITE_PETAL: Petal = ['#fdf8ee', '#b9ae98'];
const LILAC_PETAL: Petal = ['#c4b3ea', '#7f6aa8'];

/** A small flower at (x, y): five petals round a yellow eye, white unless told otherwise. */
function blossom(g: Ctx, x: number, y: number, r: number, petal: Petal = WHITE_PETAL): void {
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.4, a, 0, Math.PI * 2);
    g.fillStyle = css(H(petal[0]));
    g.fill();
    g.strokeStyle = css(H(petal[1]));
    g.lineWidth = 0.6;
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, Math.PI * 2);
  g.fillStyle = css(H('#e8c25a'));
  g.fill();
}

/** A strand of ivy along points: its stem, leaves off it every 6 to 9 px on alternate sides, and now and then a flower, in turn from `petals`. */
function vine(g: Ctx, R: () => number, pts: Pt[], F: number, flowers: boolean, petals: readonly Petal[] = [WHITE_PETAL]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = css(H(MOSS.dark));
  g.lineWidth = 1.8;
  g.lineCap = 'round';
  g.stroke();
  let run = 0, next = 2, side = 1, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    run += Math.hypot(bx - ax, by - ay);
    if (run < next) continue;
    const t = i / pts.length;
    const ang = Math.atan2(by - ay, bx - ax) + side * (0.8 + R() * 0.6);
    const sz = F * (0.36 + R() * 0.12) * (1 - t * 0.45);
    ivyLeaf(g, bx, by, ang, sz, R() < 0.5);
    // Thickest at the corner it grows from: a second leaf there, the other way.
    if (t < 0.3) ivyLeaf(g, bx, by, ang + side * 1.9, sz * 0.8, R() < 0.5);
    if (flowers && n % 3 === 1) blossom(g, bx + Math.cos(ang) * sz * 0.45, by + Math.sin(ang) * sz * 0.45, F * 0.15, petals[((n - 1) / 3) % petals.length]);
    side = -side;
    n++;
    next = run + 5 + t * 9 + R() * (3 + t * 8);
  }
}


/* ---- the bench's own kit --------------------------------------------------- */

/** Weathering along a beam, in its own frame (along x, its width from 0 to F): cracks with the grain and a few dents. */
function beamWear(g: Ctx, R: () => number, len: number, F: number): void {
  for (let x = R() * 40; x < len; x += 30 + R() * 50) {
    const y = F * (0.25 + R() * 0.5), l = 10 + R() * 22;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + l / 2, y + (R() - 0.5) * 2, x + l, y + (R() - 0.5) * 1.5);
    g.strokeStyle = 'rgba(40, 26, 18, 0.55)';
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    g.moveTo(x + 1, y + 1);
    g.quadraticCurveTo(x + l / 2, y + 1.6, x + l - 1, y + 1);
    g.strokeStyle = 'rgba(255, 236, 206, 0.22)';
    g.lineWidth = 0.7;
    g.stroke();
  }
}

/** An iron peg standing out of a beam at (x, y). */
function peg(g: Ctx, x: number, y: number): void {
  head(g, x, y, 2, IRON.body, IRON.ink);
}

/** A cloth hung over a peg at (x, y), `len` long: folds down it, and a hem at its foot. */
function drape(g: Ctx, R: () => number, x: number, y: number, F: number, len: number): void {
  const cloth = H('#e9dfc8'), wd = F * 0.9;
  peg(g, x - 2, y);
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x - wd * 0.55, y + 2);
    g.quadraticCurveTo(x, y - 3, x + wd * 0.5, y + 2);
    g.lineTo(x + wd * 0.58, y + len);
    for (let k = 0; k <= 4; k++) g.lineTo(x + wd * 0.58 - (k * wd * 1.16) / 4, y + len + (k % 2 ? 3 : -1) + R() * 2);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 26, 18, 0.45)';
  g.shadowBlur = 3;
  g.shadowOffsetX = -1;
  g.shadowOffsetY = 2;
  g.fillStyle = css(cloth);
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  for (let k = 0; k < 4; k++) {
    const fx = x - wd * 0.4 + k * wd * 0.27;
    const fold = g.createLinearGradient(fx - 3, 0, fx + 3, 0);
    fold.addColorStop(0, 'rgba(120, 100, 76, 0)');
    fold.addColorStop(0.5, 'rgba(120, 100, 76, 0.28)');
    fold.addColorStop(1, 'rgba(120, 100, 76, 0)');
    g.fillStyle = fold;
    g.fillRect(fx - 3, y, 6, len + 4);
  }
  g.restore();
  shape();
  g.strokeStyle = css(H('#7d6a52'));
  g.lineWidth = 1;
  g.stroke();
}

/**
 * A firmer chisel hung by a leather thong from a peg at (x, y), handle up: a
 * turned handle with a domed top, a brass ferrule, the bolster, and a flat
 * blade ground to a bevel at its edge.
 */
function hangChisel(g: Ctx, x0: number, y0: number, F: number): void {
  // Drawn at a third over the beam's scale, so it reads as a tool across the room.
  g.save();
  g.translate(x0, y0);
  g.scale(4 / 3, 4 / 3);
  const x = 0, y = 0;
  const top = y + 3, hEnd = top + F * 1.25, fEnd = hEnd + 3, bTop = fEnd + 3, bEnd = bTop + F * 1.35;
  // Its shadow on the beam first.
  g.save();
  g.translate(-1.5, 2);
  g.fillStyle = 'rgba(30, 18, 12, 0.35)';
  g.beginPath();
  g.roundRect(x - 4, top, 8, bEnd - top, 3);
  g.fill();
  g.restore();
  // The thong, looped over the peg and through the handle's end.
  g.beginPath();
  g.moveTo(x - 2.4, top + 3);
  g.bezierCurveTo(x - 3.5, y - 4, x + 3.5, y - 4, x + 2.4, top + 3);
  g.strokeStyle = css(H('#5c3b26'));
  g.lineWidth = 1.4;
  g.stroke();
  peg(g, x, y - 1);
  // The handle: domed at the top, swelling, then waisted down to the ferrule.
  const handle = (): void => {
    g.beginPath();
    g.moveTo(x - 2.6, top + 2.5);
    g.quadraticCurveTo(x, top - 2, x + 2.6, top + 2.5);
    g.bezierCurveTo(x + 4.2, top + F * 0.35, x + 4, top + F * 0.8, x + 2.8, hEnd);
    g.lineTo(x - 2.8, hEnd);
    g.bezierCurveTo(x - 4, top + F * 0.8, x - 4.2, top + F * 0.35, x - 2.6, top + 2.5);
    g.closePath();
  };
  handle();
  const wood = g.createLinearGradient(x - 4, 0, x + 4, 0);
  wood.addColorStop(0, css(light(WOOD.cherry, 0.35)));
  wood.addColorStop(0.4, css(WOOD.cherry));
  wood.addColorStop(1, css(shade(WOOD.cherry, 0.35)));
  g.fillStyle = wood;
  g.fill();
  g.save();
  handle();
  g.clip();
  g.strokeStyle = 'rgba(60, 30, 20, 0.35)';
  g.lineWidth = 0.6;
  for (const dx of [-1.6, 0.4, 2]) {
    g.beginPath();
    g.moveTo(x + dx, top);
    g.quadraticCurveTo(x + dx * 1.3, top + F * 0.6, x + dx * 0.8, hEnd);
    g.stroke();
  }
  g.restore();
  handle();
  g.strokeStyle = INK;
  g.lineWidth = 0.9;
  g.stroke();
  // The ferrule.
  g.beginPath();
  g.roundRect(x - 3.1, hEnd - 0.5, 6.2, fEnd - hEnd + 0.5, 1);
  const brass = g.createLinearGradient(x - 3, 0, x + 3, 0);
  brass.addColorStop(0, css(light(BRASS.body, 0.45)));
  brass.addColorStop(0.5, css(BRASS.body));
  brass.addColorStop(1, css(shade(BRASS.body, 0.35)));
  g.fillStyle = brass;
  g.fill();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  // The bolster, a collar of the steel before the blade.
  const steel = (x0: number, x1: number): CanvasGradient => {
    const s = g.createLinearGradient(x0, 0, x1, 0);
    s.addColorStop(0, css(light(IRON.body, 0.55)));
    s.addColorStop(0.45, css(light(IRON.body, 0.2)));
    s.addColorStop(1, css(shade(IRON.body, 0.15)));
    return s;
  };
  g.beginPath();
  g.moveTo(x - 2.2, fEnd);
  g.lineTo(x + 2.2, fEnd);
  g.lineTo(x + 1.6, bTop);
  g.lineTo(x - 1.6, bTop);
  g.closePath();
  g.fillStyle = steel(x - 2.2, x + 2.2);
  g.fill();
  g.strokeStyle = css(IRON.ink);
  g.lineWidth = 0.8;
  g.stroke();
  // The blade: flat, widening a little to its edge, the bevel ground in the last of it.
  const bevel = bEnd - 4.5;
  g.beginPath();
  g.moveTo(x - 2, bTop);
  g.lineTo(x + 2, bTop);
  g.lineTo(x + 2.9, bEnd);
  g.lineTo(x - 2.9, bEnd);
  g.closePath();
  g.fillStyle = steel(x - 3, x + 3);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(x - 2.75, bevel);
  g.lineTo(x + 2.75, bevel);
  g.lineTo(x + 2.9, bEnd);
  g.lineTo(x - 2.9, bEnd);
  g.closePath();
  g.fillStyle = css(light(IRON.body, 0.75));
  g.fill();
  g.strokeStyle = css(IRON.ink);
  g.lineWidth = 0.6;
  g.stroke();
  // The light down the flat.
  g.beginPath();
  g.moveTo(x - 0.9, bTop + 1);
  g.lineTo(x - 1.3, bevel - 1);
  g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  g.lineWidth = 0.7;
  g.stroke();
  g.restore();
}

/** Where Crafting's lantern hangs on its frame, `F` its rim: the end of its bracket. */
const benchLamp = (F: number): Pt => [F * 0.15, F * 1.25];

/** A lantern's body hung from (x, y): the middle of its glass, where its flame is, its glass's top, half its width and its height. */
function lanternBody(x: number, y: number, F: number): { cx: number; top: number; bw: number; bh: number; flame: Pt } {
  const cx = x - 2, top = y + F * 0.62, bw = F * 0.46, bh = F * 1.05;
  return { cx, top, bw, bh, flame: [cx, top + bh * 0.52] };
}

/**
 * The lights a frame carries, in its own px from its top left, each with the
 * reach of its light: the window lays a glow over each that breathes
 * (src/ui/runecut-dress.ts). Crafting's lantern is the one.
 */
export function frameLamps(kind: string, w: number, h: number, F: number): Array<{ x: number; y: number; r: number }> {
  const at = kind === 'bench' && h > F * 6 ? benchLamp(F) : null;
  if (!at) return [];
  const b = lanternBody(at[0], at[1], F);
  return [{ x: b.flame[0], y: b.flame[1], r: F * 1.9 }];
}

/**
 * A wrought-iron lantern on a bracket out of the beam at (x, y): the arm
 * bolted to the beam with a scrolled brace under it, a ring and two links of
 * chain, a hood with a ring on its top, two corner posts and a middle bar
 * over glass lit from a candle inside, and a tray with a drop under it. Its
 * light on the beam is painted faintly here; the glow that breathes over it
 * is the window's.
 */
function lantern(g: Ctx, x: number, y: number, F: number): void {
  const iron = H('#3f3a44'), ironHi = H('#6d6672');
  const { cx, top, bw, bh, flame } = lanternBody(x, y, F);
  const bolt = x + F * 0.62;
  const ironLine = (w: number): void => {
    g.strokeStyle = css(iron);
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  };
  // The light on the beam, faint and still.
  const glow = g.createRadialGradient(flame[0], flame[1], 1, flame[0], flame[1], F * 1.3);
  glow.addColorStop(0, 'rgba(255, 206, 120, 0.42)');
  glow.addColorStop(0.5, 'rgba(255, 190, 100, 0.14)');
  glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
  g.fillStyle = glow;
  g.fillRect(flame[0] - F * 1.4, flame[1] - F * 1.4, F * 2.8, F * 2.8);
  // The bracket: an arm out of the beam, a brace under it ending in a scroll.
  g.save();
  g.translate(1, 1.5);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(bolt, y);
  g.lineTo(cx, y);
  ironLine(2.4);
  g.strokeStyle = 'rgb(30, 18, 12)';
  g.stroke();
  g.restore();
  g.beginPath();
  g.moveTo(bolt + 1, y);
  g.lineTo(cx - 1, y);
  ironLine(2.4);
  g.stroke();
  g.beginPath();
  g.moveTo(bolt, y + F * 0.42);
  g.bezierCurveTo(bolt - F * 0.05, y + F * 0.1, cx + F * 0.35, y + F * 0.05, cx + F * 0.12, y + 1);
  ironLine(1.5);
  g.stroke();
  g.beginPath();
  g.arc(bolt - F * 0.2, y + F * 0.3, F * 0.1, 0.3, Math.PI * 1.7);
  g.stroke();
  g.beginPath();
  g.moveTo(bolt + 1, y - 0.6);
  g.lineTo(cx - 1, y - 0.6);
  g.strokeStyle = css(ironHi, 0.7);
  g.lineWidth = 0.6;
  g.stroke();
  head(g, bolt, y, 1.9, IRON.body, IRON.ink);
  head(g, bolt, y + F * 0.42, 1.6, IRON.body, IRON.ink);
  // A hook at the arm's end, and two links of chain down to the lantern's ring.
  g.beginPath();
  g.moveTo(cx - 1.5, y);
  g.quadraticCurveTo(cx - 2.2, y + 3, cx, y + 3.4);
  ironLine(1.2);
  g.stroke();
  const ringY = top - F * 0.3;
  for (let k = 0; k < 2; k++) {
    const ly = y + 4.6 + k * ((ringY - y - 6) / 2);
    g.beginPath();
    g.ellipse(cx, ly + 1.4, k % 2 ? 0.8 : 1.2, 1.7, 0, 0, Math.PI * 2);
    ironLine(0.9);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, ringY + 0.6, 1.7, 0, Math.PI * 2);
  ironLine(1);
  g.stroke();
  // The hood: a low pyramid with a flared skirt, lit on its left.
  const hood = (): void => {
    g.beginPath();
    g.moveTo(cx - 1.6, ringY + 2);
    g.lineTo(cx + 1.6, ringY + 2);
    g.quadraticCurveTo(cx + bw * 0.7, top - 3, cx + bw + 1.6, top + 0.5);
    g.lineTo(cx - bw - 1.6, top + 0.5);
    g.quadraticCurveTo(cx - bw * 0.7, top - 3, cx - 1.6, ringY + 2);
    g.closePath();
  };
  hood();
  const hoodFill = g.createLinearGradient(cx - bw, 0, cx + bw, 0);
  hoodFill.addColorStop(0, css(ironHi));
  hoodFill.addColorStop(0.45, css(H('#4c4652')));
  hoodFill.addColorStop(1, css(H('#2d2932')));
  g.fillStyle = hoodFill;
  g.fill();
  g.strokeStyle = 'rgb(28, 24, 30)';
  g.lineWidth = 0.8;
  g.stroke();
  g.beginPath();
  g.roundRect(cx - bw - 1.8, top - 0.6, bw * 2 + 3.6, 2.2, 0.8);
  g.fillStyle = css(iron);
  g.fill();
  // The glass, lit from the candle: brightest round the flame, warm to its edges.
  g.beginPath();
  g.rect(cx - bw, top + 1.6, bw * 2, bh - 1.6);
  const lit = g.createRadialGradient(flame[0], flame[1], 0.5, flame[0], flame[1], bh * 0.8);
  lit.addColorStop(0, '#fff4cf');
  lit.addColorStop(0.35, '#ffd27a');
  lit.addColorStop(0.75, '#eea04a');
  lit.addColorStop(1, '#c9772f');
  g.fillStyle = lit;
  g.fill();
  // The candle inside, and its flame.
  const candleTop = flame[1] + F * 0.16;
  g.beginPath();
  g.roundRect(cx - F * 0.11, candleTop, F * 0.22, top + bh - candleTop, [1.2, 1.2, 0, 0]);
  g.fillStyle = '#f6e9cc';
  g.fill();
  g.strokeStyle = 'rgba(150, 100, 50, 0.6)';
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.moveTo(flame[0], flame[1] - F * 0.26);
  g.bezierCurveTo(flame[0] + F * 0.15, flame[1] - F * 0.04, flame[0] + F * 0.11, flame[1] + F * 0.13, flame[0], flame[1] + F * 0.14);
  g.bezierCurveTo(flame[0] - F * 0.11, flame[1] + F * 0.13, flame[0] - F * 0.15, flame[1] - F * 0.04, flame[0], flame[1] - F * 0.26);
  const fl = g.createRadialGradient(flame[0], flame[1] + F * 0.05, 0.2, flame[0], flame[1], F * 0.24);
  fl.addColorStop(0, '#ffffff');
  fl.addColorStop(0.45, '#fff2a8');
  fl.addColorStop(1, '#ff9a2e');
  g.fillStyle = fl;
  g.fill();
  // A glint down the left pane.
  g.beginPath();
  g.moveTo(cx - bw * 0.72, top + 4);
  g.lineTo(cx - bw * 0.5, top + 4);
  g.lineTo(cx - bw * 0.62, top + bh - 4);
  g.lineTo(cx - bw * 0.8, top + bh - 4);
  g.closePath();
  g.fillStyle = 'rgba(255, 255, 255, 0.32)';
  g.fill();
  // The corner posts and the middle bar, iron, the posts lit on their left.
  for (const px of [cx - bw, cx + bw]) {
    g.beginPath();
    g.roundRect(px - 1.3, top + 0.8, 2.6, bh, 0.8);
    g.fillStyle = css(iron);
    g.fill();
    g.beginPath();
    g.moveTo(px - 0.6, top + 2);
    g.lineTo(px - 0.6, top + bh - 0.6);
    g.strokeStyle = css(ironHi);
    g.lineWidth = 0.6;
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx, top + 1.6);
  g.lineTo(cx, flame[1] - F * 0.3);
  g.moveTo(cx - bw, top + bh * 0.3);
  g.lineTo(cx + bw, top + bh * 0.3);
  g.strokeStyle = css(iron, 0.85);
  g.lineWidth = 0.9;
  g.stroke();
  // The tray, and a drop of iron under it.
  g.beginPath();
  g.moveTo(cx - bw - 2, top + bh + 0.5);
  g.lineTo(cx + bw + 2, top + bh + 0.5);
  g.lineTo(cx + bw * 0.6, top + bh + 3.6);
  g.lineTo(cx - bw * 0.6, top + bh + 3.6);
  g.closePath();
  g.fillStyle = css(iron);
  g.fill();
  g.beginPath();
  g.moveTo(cx - bw - 1.6, top + bh + 1);
  g.lineTo(cx + bw + 1.6, top + bh + 1);
  g.strokeStyle = 'rgba(255, 200, 120, 0.55)';
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.arc(cx, top + bh + 5.2, 1.5, 0, Math.PI * 2);
  g.fillStyle = css(iron);
  g.fill();
}

/**
 * Crafting's badge, where another window's rune is: a square of cloth pinned
 * at the top, its foot torn, with two hammers crossed on it in brown -- the
 * workshop's sign. `W` by `Hh`.
 */
export function paintHammers(g: Ctx, W: number, Hh: number, night: boolean): void {
  const cloth = H('#efe6d2');
  const shape = (): void => {
    g.beginPath();
    g.moveTo(1, 4);
    g.lineTo(W - 1, 4);
    g.lineTo(W - 1, Hh - 6);
    for (let k = 0; k <= 5; k++) g.lineTo(W - 1 - (k * (W - 2)) / 5, Hh - 6 + (k % 2 ? 4 : 0));
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 26, 18, 0.45)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.2;
  g.fillStyle = css(cloth);
  g.fill();
  g.restore();
  shape();
  g.strokeStyle = css(H('#8a775c'));
  g.lineWidth = 0.9;
  g.stroke();
  // Pinned at both top corners.
  head(g, 4, 6.5, 1.3, BRASS.body, BRASS.ink);
  head(g, W - 4, 6.5, 1.3, BRASS.body, BRASS.ink);
  // Two hammers, crossed.
  const brown = H('#5a3c28');
  for (const sg of [-1, 1]) {
    g.save();
    g.translate(W / 2, Hh / 2 + 1);
    g.rotate(sg * 0.72);
    g.fillStyle = css(brown);
    g.beginPath();
    g.roundRect(-1.1, -6, 2.2, 15, 1);
    g.fill();
    g.beginPath();
    g.roundRect(-4.6, -9.5, 9.2, 4.4, 1);
    g.fill();
    g.restore();
  }
  if (night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-4, -4, W + 8, Hh + 8);
    g.restore();
  }
}

/* ---- the stone pillars' own kit ------------------------------------------ */

/** The pillars' pale stone, a little lilac in its shadow, and the gems set in them. */
const PILLAR = { body: H('#dcd7de'), lit: H('#f1eef3'), shade: H('#b3aab8'), ink: H('#776d80') };
const GEM = { body: H('#a796cf'), lit: H('#dcd2f2'), shade: H('#6c5c99') };

/** Gold, lit from the top left, across a box. */
function goldFill(g: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  f.addColorStop(0, css(light(BRASS.body, 0.5)));
  f.addColorStop(0.45, css(BRASS.body));
  f.addColorStop(1, css(shade(BRASS.body, 0.3)));
  return f;
}

/** A lavender stone in a gold setting at (x, y), `r` from its middle to its top: a gold diamond, the stone cut in four facets, and a glint. */
function gem(g: Ctx, x: number, y: number, r: number): void {
  const dia = (s: number): void => {
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.78, y);
    g.lineTo(x, y + s);
    g.lineTo(x - s * 0.78, y);
    g.closePath();
  };
  g.save();
  dia(r);
  g.shadowColor = 'rgba(50, 36, 30, 0.45)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.fillStyle = goldFill(g, x - r, y - r, x + r, y + r);
  g.fill();
  g.restore();
  dia(r);
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.9;
  g.stroke();
  const s = r * 0.6, w = s * 0.78;
  const facets: Array<[Pt, Pt, RGB]> = [[[x, y - s], [x - w, y], GEM.lit], [[x, y - s], [x + w, y], GEM.body], [[x + w, y], [x, y + s], GEM.shade], [[x, y + s], [x - w, y], mix(GEM.body, GEM.shade, 0.4)]];
  for (const [a, b, c] of facets) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.closePath();
    g.fillStyle = css(c);
    g.fill();
  }
  dia(s);
  g.strokeStyle = css(shade(GEM.shade, 0.25));
  g.lineWidth = 0.7;
  g.stroke();
  g.beginPath();
  g.arc(x - w * 0.3, y - s * 0.4, Math.max(0.7, r * 0.12), 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  g.fill();
}

/** Pale stone across a box, lit from the left, with grit in it and its ink round it. */
function stone(g: Ctx, R: () => number, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const path = (): void => {
    g.beginPath();
    g.roundRect(x0, y0, x1 - x0, y1 - y0, r);
  };
  g.save();
  path();
  g.shadowColor = 'rgba(50, 40, 50, 0.35)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1;
  g.shadowOffsetY = 1.5;
  const f = g.createLinearGradient(x0, 0, x1, 0);
  f.addColorStop(0, css(PILLAR.lit));
  f.addColorStop(0.4, css(PILLAR.body));
  f.addColorStop(1, css(PILLAR.shade));
  g.fillStyle = f;
  g.fill();
  g.restore();
  g.save();
  path();
  g.clip();
  for (let k = 0; k < ((x1 - x0) * (y1 - y0)) / 40; k++) {
    g.fillStyle = css(R() < 0.6 ? PILLAR.shade : PILLAR.lit, 0.55);
    g.fillRect(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 1, 1);
  }
  g.restore();
  path();
  g.strokeStyle = css(PILLAR.ink);
  g.lineWidth = 1.1;
  g.stroke();
}

/**
 * A pillar's shaft from y0 to y1 across x0..x1: the stone, a panel sunk down
 * the middle of it, a band carved round it at `bandAt`, and the capital and
 * base standing out past it either side, each with a gem set in its face.
 */
function pillar(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, F: number, bandAt: number): void {
  stone(g, R, x0, y0, x1, y1, 1);
  const inset = (x1 - x0) * 0.26;
  g.beginPath();
  g.roundRect(x0 + inset, y0 + F * 1.4, x1 - x0 - inset * 2, y1 - y0 - F * 2.8, 2);
  g.strokeStyle = css(PILLAR.shade);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(x0 + inset + 1, y0 + F * 1.4 + 2);
  g.lineTo(x0 + inset + 1, y1 - F * 1.4 - 2);
  g.strokeStyle = css(PILLAR.lit, 0.9);
  g.lineWidth = 0.7;
  g.stroke();
  stone(g, R, x0 - 2, bandAt - 3, x1 + 2, bandAt + 3, 1.5);
  const mid = (x0 + x1) / 2, out = 3;
  for (const top of [true, false]) {
    // The block, and a slab a step wider across its outer end.
    const [a, b] = top ? [y0 - 4, y0 + F * 1.2] : [y1 - F * 1.2, y1 + 4];
    stone(g, R, x0 - out, a, x1 + out, b, 2);
    const [sa, sb] = top ? [y0 - 8, y0 - 1] : [y1 + 1, y1 + 8];
    stone(g, R, x0 - out - 3, sa, x1 + out + 3, sb, 2);
    // A neck where it meets the shaft.
    const n = top ? b : a - 4;
    stone(g, R, x0 - 1, n, x1 + 1, n + 4, 1);
    // The gem set in a panel sunk in its face.
    const gy = (a + b) / 2 + (top ? 1 : -1), pw = (x1 - x0) * 0.62, ph = (b - a) * 0.66;
    g.beginPath();
    g.roundRect(mid - pw / 2, gy - ph / 2, pw, ph, 1.5);
    g.fillStyle = css(PILLAR.shade, 0.35);
    g.fill();
    g.strokeStyle = css(PILLAR.shade);
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    g.moveTo(mid - pw / 2 + 0.6, gy + ph / 2 + 0.6);
    g.lineTo(mid + pw / 2 + 0.6, gy + ph / 2 + 0.6);
    g.lineTo(mid + pw / 2 + 0.6, gy - ph / 2 + 0.6);
    g.strokeStyle = css(PILLAR.lit);
    g.lineWidth = 0.7;
    g.stroke();
    gem(g, mid, gy, F * 0.24);
  }
}

/** A bunch of flowers at (x, y), `r` across each: their leaves first, then the flowers, white and lavender in turn. */
function posy(g: Ctx, R: () => number, x: number, y: number, r: number, n: number, first: Petal = WHITE_PETAL): void {
  for (let k = 0; k < n + 2; k++) ivyLeaf(g, x + (R() - 0.5) * r * 2, y + (R() - 0.5) * r * 1.6, R() * Math.PI * 2, r * 1.5, R() < 0.5);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + R();
    blossom(g, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.6, r * (0.9 + R() * 0.25), k % 2 ? (first === WHITE_PETAL ? LILAC_PETAL : WHITE_PETAL) : first);
  }
}

/** A curve through its points, each pair a bend: so a strand can wander rather than make one arc. */
function wander(...pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 2 < pts.length; i += 2) out.push(...curve(pts[i], pts[i + 1], pts[i + 2]).slice(i ? 1 : 0));
  return out;
}

/**
 * Skills' badge, where another window's rune is: a lavender tablet arched at
 * its top in a gold setting, a gold sprig on it. `W` by `Hh`.
 */
export function paintTablet(g: Ctx, W: number, Hh: number, night: boolean): void {
  const arch = (d: number): void => {
    const x0 = 1.5 + d, x1 = W - 1.5 - d, y0 = 2 + d, y1 = Hh - 2 - d, r = (x1 - x0) / 2;
    g.beginPath();
    g.moveTo(x0, y1 - 2);
    g.lineTo(x0, y0 + r);
    g.arc((x0 + x1) / 2, y0 + r, r, Math.PI, 0);
    g.lineTo(x1, y1 - 2);
    g.quadraticCurveTo(x1, y1, x1 - 2, y1);
    g.lineTo(x0 + 2, y1);
    g.quadraticCurveTo(x0, y1, x0, y1 - 2);
    g.closePath();
  };
  g.save();
  arch(0);
  g.shadowColor = 'rgba(40, 26, 30, 0.45)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.2;
  g.fillStyle = goldFill(g, 0, 0, W, Hh);
  g.fill();
  g.restore();
  arch(0);
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.9;
  g.stroke();
  arch(2.2);
  const lav = g.createLinearGradient(0, 0, W, Hh);
  lav.addColorStop(0, css(light(GEM.body, 0.25)));
  lav.addColorStop(0.55, css(GEM.body));
  lav.addColorStop(1, css(GEM.shade));
  g.fillStyle = lav;
  g.fill();
  g.strokeStyle = css(shade(BRASS.ink, 0.1), 0.8);
  g.lineWidth = 0.7;
  g.stroke();
  // The sprig: a stem, and three pairs of leaves up it, the top one alone.
  const mid = W / 2, foot = Hh - 7, tip = 9;
  g.beginPath();
  g.moveTo(mid, foot);
  g.quadraticCurveTo(mid + 0.8, (foot + tip) / 2, mid, tip);
  g.strokeStyle = css(light(BRASS.body, 0.25));
  g.lineWidth = 1.1;
  g.lineCap = 'round';
  g.stroke();
  const leaf = (y: number, ang: number, s: number): void => {
    g.save();
    g.translate(mid, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(s * 0.5, -s * 0.38, s, 0);
    g.quadraticCurveTo(s * 0.5, s * 0.38, 0, 0);
    g.fillStyle = css(light(BRASS.body, 0.3));
    g.fill();
    g.strokeStyle = css(BRASS.ink);
    g.lineWidth = 0.5;
    g.stroke();
    g.restore();
  };
  for (const [y, s] of [[foot - 4, 6.5], [foot - 10, 5.5], [foot - 16, 4.5]] as Array<[number, number]>) {
    leaf(y, -Math.PI * 0.78, s);
    leaf(y, -Math.PI * 0.22, s);
  }
  leaf(tip + 1, -Math.PI / 2, 4.5);
  if (night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-4, -4, W + 8, Hh + 8);
    g.restore();
  }
}

/* ---- the plank frame's own kit -------------------------------------------- */

/** A dark iron band across a plank at its middle (x, y), `wd` by `ht`, with a brass rivet near each end along `ht`. */
function ironBand(g: Ctx, x: number, y: number, wd: number, ht: number): void {
  g.save();
  g.beginPath();
  g.roundRect(x - wd / 2, y - ht / 2, wd, ht, 1.5);
  g.shadowColor = 'rgba(30, 20, 14, 0.45)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  const f = g.createLinearGradient(x - wd / 2, 0, x + wd / 2, 0);
  f.addColorStop(0, '#5a4a40');
  f.addColorStop(1, '#3a2f29');
  g.fillStyle = f;
  g.fill();
  g.restore();
  g.strokeStyle = '#221a16';
  g.lineWidth = 1;
  g.stroke();
  const r = Math.min(wd, ht) * 0.22, along = ht >= wd;
  for (const k of [-1, 1]) head(g, along ? x : x + k * (wd / 2 - r * 2), along ? y + k * (ht / 2 - r * 2) : y, r, BRASS.body, BRASS.ink);
}

/** An iron plate over a corner, `s` square with its corner at (0, 0) in the corner's own frame, two brass rivets in it. */
function ironCorner(g: Ctx, s: number): void {
  g.save();
  g.beginPath();
  g.roundRect(-2, -2, s, s, 2);
  g.shadowColor = 'rgba(30, 20, 14, 0.45)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  const f = g.createLinearGradient(0, 0, s, s);
  f.addColorStop(0, '#5f4f45');
  f.addColorStop(1, '#382d27');
  g.fillStyle = f;
  g.fill();
  g.restore();
  g.strokeStyle = '#221a16';
  g.lineWidth = 1;
  g.stroke();
  head(g, s * 0.3, s * 0.3, s * 0.11, BRASS.body, BRASS.ink);
  head(g, s * 0.62, s * 0.62, s * 0.11, BRASS.body, BRASS.ink);
}

/**
 * Trades' banner: linen hung on a rope looped over the top plank at (x0..x1),
 * from y down `len`, its foot torn, the window's crescent on it in gold.
 */
function crescentBanner(g: Ctx, R: () => number, x0: number, x1: number, y: number, len: number): void {
  const wd = x1 - x0, cloth = H('#efe7d4');
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.lineTo(x1 + 1, y + len - 8);
    for (let k = 0; k <= 6; k++) g.lineTo(x1 + 1 - (k * (wd + 2)) / 6, y + len - 8 + (k % 2 ? 9 : 0) + (R() - 0.5) * 3);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 26, 16, 0.45)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1;
  g.shadowOffsetY = 2;
  g.fillStyle = css(cloth);
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  for (let k = 0; k < 3; k++) {
    const fx = x0 + wd * (0.2 + k * 0.3);
    const fold = g.createLinearGradient(fx - 3, 0, fx + 3, 0);
    fold.addColorStop(0, 'rgba(120, 100, 76, 0)');
    fold.addColorStop(0.5, 'rgba(120, 100, 76, 0.2)');
    fold.addColorStop(1, 'rgba(120, 100, 76, 0)');
    g.fillStyle = fold;
    g.fillRect(fx - 3, y, 6, len);
  }
  g.restore();
  shape();
  g.strokeStyle = css(H('#8a775c'));
  g.lineWidth = 1;
  g.stroke();
  // The crescent, in gold.
  const cx = (x0 + x1) / 2 - 1, cy = y + len * 0.45, r = wd * 0.36;
  g.beginPath();
  g.arc(cx, cy, r, Math.PI * 0.3, Math.PI * 1.7);
  g.arc(cx + r * 0.42, cy - r * 0.08, r * 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
  g.closePath();
  g.fillStyle = goldFill(g, cx - r, cy - r, cx + r, cy + r);
  g.fill();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  // The rope: over the plank, round the banner's head, and its end hanging.
  const rope = H('#c9a46c');
  twist(g, curve([x0 - 2, y + 2], [(x0 + x1) / 2, y - 14], [x1 + 2, y + 2]), 2.6, rope);
  twist(g, [[x0 - 1, y + 1], [x1 + 1, y + 1]], 2.6, rope);
  twist(g, curve([x1 + 1, y + 2], [x1 + 5, y + 10], [x1 + 3, y + 16]), 2.2, rope);
}

/* ---- the altar frame's own kit ------------------------------------------- */

/** Sea glass: the pale aqua of the waves on Faith's marble, its light and its deep. */
const GLASS = { body: H('#a9e0df'), lit: H('#eafaf8'), deep: H('#62afb3') };

/** A pearl at (x, y), `r` across, in a gold setting: the ring of gold, the pearl lit from the top left, its sheen and its glint. */
function pearl(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.beginPath();
  g.arc(x, y, r * 1.32, 0, Math.PI * 2);
  g.shadowColor = 'rgba(60, 50, 40, 0.4)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.fillStyle = goldFill(g, x - r, y - r, x + r, y + r);
  g.fill();
  g.restore();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  const p = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  p.addColorStop(0, '#ffffff');
  p.addColorStop(0.35, '#f4eef0');
  p.addColorStop(0.8, '#ddd2d8');
  p.addColorStop(1, '#bfb2bb');
  g.fillStyle = p;
  g.fill();
  g.strokeStyle = 'rgba(120, 100, 90, 0.55)';
  g.lineWidth = 0.6;
  g.stroke();
  // A warm sheen round its lower edge, and a glint.
  g.beginPath();
  g.arc(x, y, r * 0.78, Math.PI * 0.15, Math.PI * 0.85);
  g.strokeStyle = 'rgba(240, 210, 200, 0.6)';
  g.lineWidth = r * 0.22;
  g.stroke();
  g.beginPath();
  g.arc(x - r * 0.38, y - r * 0.38, r * 0.16, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.95)';
  g.fill();
}

/** A small four-pointed star of gold at (x, y), `r` to its points. */
function goldStar(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  star(g, r, r * 0.3);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();
}

/**
 * A wave of sea glass lying on the marble in a side's frame: a ribbon from
 * x0, `dir` along the side, `len` long, rising and falling across the band
 * about `mid`, swelling then tapering, its end rolled over in a curl that
 * stays on the band; a deeper layer under a lighter, lit along its crest,
 * and lines of foam along it.
 */
function wave(g: Ctx, x0: number, mid: number, len: number, dir: 1 | -1, amp: number, wd: number): void {
  const pts: Pt[] = [];
  const n = Math.max(12, Math.ceil(len / 3));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + dir * len * t, mid + amp * Math.sin(t * Math.PI * 2.2 + 0.4)]);
  }
  // The curl: over and back on itself, its top no higher than the crest of the wave.
  const [ex, ey] = pts[pts.length - 1], cr = wd * 0.45;
  const cx = ex, cy = ey - cr;
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 1.6, rr = cr * (1 - (i / 16) * 0.5);
    const th = Math.PI / 2 - dir * a;
    pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
  }
  const N = pts.length, total = n + 16;
  const ribbon = (wdk: number, dy: number): { left: Pt[]; right: Pt[] } => {
    const left: Pt[] = [], right: Pt[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / total;
      const hw = (wd * wdk * (u < 0.28 ? 0.2 + (u / 0.28) * 0.8 : 1 - ((u - 0.28) / 0.72) * 0.78)) / 2;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw + dy]);
      right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw + dy]);
    }
    return { left, right };
  };
  const fillRibbon = (r: { left: Pt[]; right: Pt[] }, fill: string | CanvasGradient, edge: string): void => {
    g.beginPath();
    r.left.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let i = r.right.length - 1; i >= 0; i--) g.lineTo(r.right[i][0], r.right[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = 0.7;
    g.stroke();
  };
  // The deeper glass under, a little lower and wider.
  g.save();
  g.shadowColor = 'rgba(40, 90, 100, 0.3)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  fillRibbon(ribbon(1.15, 1.6), css(mix(GLASS.body, GLASS.deep, 0.55)), css(shade(GLASS.deep, 0.2), 0.9));
  g.restore();
  // The light glass over it.
  const f = g.createLinearGradient(0, mid - wd * 0.6, 0, mid + wd * 0.6);
  f.addColorStop(0, css(GLASS.lit));
  f.addColorStop(0.55, css(GLASS.body));
  f.addColorStop(1, css(mix(GLASS.body, GLASS.deep, 0.35)));
  const top = ribbon(0.82, -0.4);
  fillRibbon(top, f, css(shade(GLASS.deep, 0.1), 0.7));
  // Foam: a bright line along the crest and a fainter one inside it.
  for (const [k, al, lw] of [[0.55, 0.85, 0.8], [0.15, 0.45, 0.6]] as Array<[number, number, number]>) {
    g.beginPath();
    const upTo = Math.floor(N * 0.78);
    for (let i = 2; i < upTo; i++) {
      const [x, y] = pts[i], [lx, ly] = top.left[i];
      const fx = x + (lx - x) * k, fy = y - 0.4 + (ly - y + 0.4) * k;
      if (i === 2) g.moveTo(fx, fy); else g.lineTo(fx, fy);
    }
    g.strokeStyle = `rgba(255, 255, 255, ${al})`;
    g.lineWidth = lw;
    g.stroke();
  }
}

/** Gold scrollwork growing from a corner along one side of it, in the corner's frame: a stem with a curl at its end and two leaves off it. */
function scroll(g: Ctx, F: number, flip: boolean): void {
  g.save();
  if (flip) g.transform(0, 1, 1, 0, 0, 0);
  gilt(g, () => {
    g.beginPath();
    g.moveTo(F * 0.85, F * 0.3);
    g.bezierCurveTo(F * 1.6, F * 0.05, F * 2.2, F * 0.75, F * 2.9, F * 0.45);
    g.arc(F * 2.75, F * 0.3, F * 0.2, Math.PI * 0.25, Math.PI * 1.9, true);
  }, 1.5);
  for (const [x, y, a] of [[F * 1.45, F * 0.22, -0.5], [F * 2.1, F * 0.62, 0.6]] as Array<[number, number, number]>) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(F * 0.18, -F * 0.16, F * 0.38, 0);
    g.quadraticCurveTo(F * 0.18, F * 0.16, 0, 0);
    g.fillStyle = goldFill(g, 0, -F * 0.2, F * 0.4, F * 0.2);
    g.fill();
    g.strokeStyle = css(BRASS.ink, 0.8);
    g.lineWidth = 0.5;
    g.stroke();
    g.restore();
  }
  g.restore();
}

/* ---- the map frame's own kit -------------------------------------------- */

/** The map's sky blue: the pennants and the marbling in the band. */
const SKY = { body: H('#93b3d3'), lit: H('#cfe0f0'), deep: H('#5f84a8') };

/** A gold four-pointed star burst on a pale lozenge at (x, y), `r` to its points: the lozenge edged in gold, a lesser star turned under the great one. */
function starBurst(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  // The lozenge.
  g.beginPath();
  g.moveTo(0, -r * 0.82);
  g.lineTo(r * 0.82, 0);
  g.lineTo(0, r * 0.82);
  g.lineTo(-r * 0.82, 0);
  g.closePath();
  g.save();
  g.shadowColor = 'rgba(60, 50, 40, 0.35)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  const pale = g.createLinearGradient(-r, -r, r, r);
  pale.addColorStop(0, '#fbf7ee');
  pale.addColorStop(1, '#e7dfcf');
  g.fillStyle = pale;
  g.fill();
  g.restore();
  g.strokeStyle = css(BRASS.body);
  g.lineWidth = 1.4;
  g.stroke();
  g.strokeStyle = css(BRASS.ink, 0.7);
  g.lineWidth = 0.5;
  g.stroke();
  // The lesser star, turned, then the great one over it.
  g.save();
  g.rotate(Math.PI / 4);
  star(g, r * 0.78, r * 0.14);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.7);
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();
  star(g, r * 1.25, r * 0.22);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.6;
  g.stroke();
  g.restore();
}

/** A sky-blue pennant hung on a side at (x, y), `wd` across and `len` long, its foot cut to a point: edged in gold, three small gold stars down it. */
function pennant(g: Ctx, x: number, y: number, wd: number, len: number): void {
  const x0 = x - wd / 2, x1 = x + wd / 2;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.lineTo(x1, y + len - wd * 0.6);
    g.lineTo(x, y + len);
    g.lineTo(x0, y + len - wd * 0.6);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 50, 70, 0.35)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.5;
  const f = g.createLinearGradient(x0, 0, x1, 0);
  f.addColorStop(0, css(SKY.lit));
  f.addColorStop(0.5, css(SKY.body));
  f.addColorStop(1, css(mix(SKY.body, SKY.deep, 0.5)));
  g.fillStyle = f;
  g.fill();
  g.restore();
  shape();
  g.strokeStyle = css(BRASS.body);
  g.lineWidth = 1.4;
  g.stroke();
  g.strokeStyle = css(BRASS.ink, 0.7);
  g.lineWidth = 0.5;
  g.stroke();
  // Its rod across the top, gold, a knob at each end.
  g.beginPath();
  g.roundRect(x0 - 2, y - 2, wd + 4, 3, 1.5);
  g.fillStyle = goldFill(g, x0, y - 2, x1, y + 1);
  g.fill();
  for (let k = 0; k < 3; k++) goldStar(g, x, y + len * (0.22 + k * 0.22), wd * (k === 1 ? 0.34 : 0.24));
}

/**
 * The map's badge, where another window's rune is: a compass rose of gold
 * on a pale disc ringed in gold, its four great points and four lesser, and
 * the north point darkened. `W` by `Hh`.
 */
export function paintCompass(g: Ctx, W: number, Hh: number, night: boolean): void {
  const cx = W / 2, cy = Hh / 2, r = W / 2 - 1;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.shadowColor = 'rgba(40, 30, 20, 0.4)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.fillStyle = goldFill(g, cx - r, cy - r, cx + r, cy + r);
  g.fill();
  g.restore();
  g.beginPath();
  g.arc(cx, cy, r - 1.8, 0, Math.PI * 2);
  g.fillStyle = '#f8f2e4';
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.6;
  g.stroke();
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.PI / 4);
  star(g, r * 0.62, r * 0.12);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.restore();
  g.save();
  g.translate(cx, cy);
  star(g, r * 0.9, r * 0.18);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.9);
  g.lineWidth = 0.6;
  g.stroke();
  // The north point, darker.
  g.beginPath();
  g.moveTo(0, -r * 0.9);
  g.lineTo(r * 0.18 * 0.6, -r * 0.18 * 0.6);
  g.lineTo(0, 0);
  g.closePath();
  g.fillStyle = css(shade(BRASS.body, 0.45));
  g.fill();
  g.beginPath();
  g.arc(0, 0, 1.3, 0, Math.PI * 2);
  g.fillStyle = css(BRASS.ink);
  g.fill();
  g.restore();
  if (night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-4, -4, W + 8, Hh + 8);
    g.restore();
  }
}

/* ---- the treasure map's own kit ------------------------------------------ */

/** The treasure map's paper, older than the map's: its face, the light on it, the brown it ages to at the edge, and the scorch. */
const OLD_PAPER = { body: H('#ecd5a6'), lit: H('#f7e8c6'), deep: H('#c9a167'), burn: H('#6e4a2c') };
/** Its ink, the sea washed on it, and the woods. */
const SEPIA = H('#7a5a3c');
const SHALLOWS = H('#9fd3cd');
const WOODS = H('#9cb586');
const X_RED = H('#b4473a');
const CORD = H('#c9a679');

/** The torn outline of the paper round a w × h window, clockwise: bitten in by up to `deep`, and now and then a deeper tear. */
function tornOutline(R: () => number, w: number, h: number, deep: number): Pt[] {
  const pts: Pt[] = [];
  const sides: Array<[number, number, number, number, number]> = [[0, 0, 1, 0, w], [w, 0, 0, 1, h], [w, h, -1, 0, w], [0, h, 0, -1, h]];
  sides.forEach(([x0, y0, ux, uy, len], i) => {
    let tear = 0, at = 0, deeper = 0;
    for (let d = 0; d < len; d += 2.5 + R() * 2) {
      let b = R() * deep * (0.35 + 0.65 * Math.abs(Math.sin(d * 0.045 + i)));
      if (!tear && d > 8 && d < len - 14 && R() < 0.04) [tear, at, deeper] = [3 + Math.floor(R() * 3), 0, deep * (0.8 + R() * 0.9)];
      if (tear) {
        b += deeper * Math.sin((Math.PI * ++at) / (tear + 1));
        if (at === tear) tear = 0;
      }
      pts.push([x0 + ux * d - uy * b, y0 + uy * d + ux * b]);
    }
  });
  return pts;
}

/** Ink, as the map is drawn in: sepia at `a`, `wd` wide. */
function sepia(g: Ctx, a: number, wd = 0.8): void {
  g.strokeStyle = css(SEPIA, a);
  g.lineWidth = wd;
  g.lineCap = 'round';
  g.lineJoin = 'round';
}

/** A ship under sail at (x, y), its waterline, `s` long: the hull inked in, two square sails bellied, a pennant, and a wave under it. */
function inkShip(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.04);
  g.lineTo(s * 0.5, -s * 0.08);
  g.lineTo(s * 0.34, s * 0.16);
  g.lineTo(-s * 0.36, s * 0.16);
  g.closePath();
  g.fillStyle = css(SEPIA, 0.6);
  g.fill();
  sepia(g, 0.8);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -s * 0.04);
  g.lineTo(0, -s * 0.86);
  g.stroke();
  for (const [top, bot, half] of [[-0.74, -0.46, 0.3], [-0.42, -0.1, 0.36]]) {
    g.beginPath();
    g.moveTo(-s * half, s * top);
    g.quadraticCurveTo(0, s * (top + 0.06), s * half, s * top);
    g.lineTo(s * half * 1.05, s * bot);
    g.quadraticCurveTo(0, s * (bot + 0.1), -s * half * 1.05, s * bot);
    g.closePath();
    g.fillStyle = css(light(OLD_PAPER.lit, 0.4), 0.9);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.moveTo(0, -s * 0.86);
  g.lineTo(s * 0.22, -s * 0.8);
  g.lineTo(0, -s * 0.75);
  g.fillStyle = css(X_RED, 0.75);
  g.fill();
  sepia(g, 0.55, 0.7);
  for (const dx of [-0.42, 0.12]) {
    g.beginPath();
    g.moveTo(s * dx, s * 0.28);
    g.quadraticCurveTo(s * (dx + 0.08), s * 0.2, s * (dx + 0.16), s * 0.28);
    g.quadraticCurveTo(s * (dx + 0.24), s * 0.36, s * (dx + 0.32), s * 0.28);
    g.stroke();
  }
  g.restore();
}

/** A stretch of shallow sea washed on at (x, y), about rx × ry: its coast inked round it, a few ripples on it. */
function shallows(g: Ctx, R: () => number, x: number, y: number, rx: number, ry: number): void {
  const pts: Pt[] = [];
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, r = 0.75 + R() * 0.4;
    pts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
  }
  g.beginPath();
  pts.forEach(([px, py], k) => {
    const [qx, qy] = pts[(k + 1) % n];
    if (!k) g.moveTo((px + qx) / 2, (py + qy) / 2);
    else g.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  });
  const [px, py] = pts[0], [qx, qy] = pts[1];
  g.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
  g.closePath();
  g.fillStyle = css(SHALLOWS, 0.5);
  g.fill();
  sepia(g, 0.45, 0.7);
  g.stroke();
  sepia(g, 0.3, 0.6);
  for (let k = 0; k < 3; k++) {
    const wx = x + (R() - 0.5) * rx, wy = y + (R() - 0.5) * ry * 0.9;
    g.beginPath();
    g.moveTo(wx - 2.5, wy);
    g.quadraticCurveTo(wx - 1.2, wy - 1.2, wx, wy);
    g.quadraticCurveTo(wx + 1.2, wy + 1.2, wx + 2.5, wy);
    g.stroke();
  }
}

/** A range of `n` peaks from (x, y), their feet, `s` high: each inked, hatched down its shadowed side. */
function peaks(g: Ctx, x: number, y: number, s: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const px = x + k * s * 0.7, ps = s * (k % 2 ? 0.75 : 1);
    g.beginPath();
    g.moveTo(px - ps * 0.55, y);
    g.lineTo(px, y - ps);
    g.lineTo(px + ps * 0.55, y);
    g.fillStyle = css(light(OLD_PAPER.lit, 0.3), 0.8);
    g.fill();
    sepia(g, 0.7);
    g.stroke();
    sepia(g, 0.4, 0.6);
    for (let j = 1; j <= 3; j++) {
      const t = j / 4;
      g.beginPath();
      g.moveTo(px + ps * 0.55 * t, y - ps * (1 - t));
      g.lineTo(px + ps * 0.55 * t - ps * 0.12, y);
      g.stroke();
    }
  }
}

/** A wood of `n` trees from (x, y), their feet, `s` high: round crowns washed green, inked, on a trunk. */
function woods(g: Ctx, x: number, y: number, s: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const tx = x + k * s * 0.62, ty = y - (k % 2) * s * 0.18, r = s * 0.32;
    sepia(g, 0.7);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx, ty - s * 0.4);
    g.stroke();
    g.beginPath();
    g.arc(tx, ty - s * 0.4 - r * 0.8, r, 0, Math.PI * 2);
    g.fillStyle = css(WOODS, 0.65);
    g.fill();
    g.stroke();
  }
}

/** A trail of dashes through points. */
function trail(g: Ctx, pts: Pt[]): void {
  g.save();
  sepia(g, 0.6, 0.9);
  g.setLineDash([2.6, 2.4]);
  g.beginPath();
  pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.stroke();
  g.restore();
}

/** X marks the spot, at (x, y), `r` from its middle to an arm's end, in red ink. */
function redX(g: Ctx, x: number, y: number, r: number): void {
  g.lineCap = 'round';
  for (const [wd, c, a] of [[2.6, SEPIA, 0.35], [1.7, X_RED, 0.95]] as Array<[number, RGB, number]>) {
    g.strokeStyle = css(c, a);
    g.lineWidth = wd;
    g.beginPath();
    g.moveTo(x - r, y - r);
    g.lineTo(x + r, y + r);
    g.moveTo(x + r, y - r);
    g.lineTo(x - r, y + r);
    g.stroke();
  }
}

/** The compass rose inked at (x, y), `r` to its north point: two rings, sixteen ticks, four great points and four lesser, each half dark and half pale. */
function inkRose(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  sepia(g, 0.7, 0.9);
  for (const k of [0.78, 0.66]) {
    g.beginPath();
    g.arc(0, 0, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    g.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    g.stroke();
  }
  for (const [len, wide, turn] of [[0.62, 0.11, Math.PI / 4], [1, 0.15, 0]]) {
    for (let k = 0; k < 4; k++) {
      g.save();
      g.rotate(turn + (k * Math.PI) / 2);
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, -r * len);
        g.lineTo(side * r * wide, -r * wide);
        g.closePath();
        g.fillStyle = side < 0 ? css(SEPIA, 0.85) : css(light(OLD_PAPER.lit, 0.5), 0.95);
        g.fill();
        sepia(g, 0.9, 0.7);
        g.stroke();
      }
      g.restore();
    }
  }
  g.restore();
}

/** A roll of the paper from x0 to x1 across y, `t` thick: a shaded cylinder, its open end at x0 showing the turns of the roll. */
function paperRoll(g: Ctx, x0: number, x1: number, y: number, t: number): void {
  const r = t / 2;
  // Its shadow on the band below it.
  g.beginPath();
  g.ellipse((x0 + x1) / 2 + 2, y + r * 0.7, (x1 - x0) / 2, r * 0.6, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(70, 45, 25, 0.22)';
  g.fill();
  const body = g.createLinearGradient(0, y - r, 0, y + r);
  body.addColorStop(0, css(OLD_PAPER.deep));
  body.addColorStop(0.3, css(OLD_PAPER.lit));
  body.addColorStop(0.65, css(OLD_PAPER.body));
  body.addColorStop(1, css(shade(OLD_PAPER.deep, 0.25)));
  g.beginPath();
  g.moveTo(x0, y - r);
  g.lineTo(x1 - r * 0.4, y - r);
  g.quadraticCurveTo(x1 + r * 0.25, y, x1 - r * 0.4, y + r);
  g.lineTo(x0, y + r);
  g.closePath();
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = css(OLD_PAPER.burn, 0.85);
  g.lineWidth = 0.9;
  g.stroke();
  // Scorch along its outer lip.
  g.fillStyle = css(OLD_PAPER.burn, 0.35);
  g.fillRect(x0 + r * 0.4, y - r + 0.5, x1 - x0 - r * 1.2, 1.2);
  // The open end: the roll seen end on, its turns spiralling in.
  g.beginPath();
  g.ellipse(x0, y, r * 0.42, r, 0, 0, Math.PI * 2);
  g.fillStyle = css(OLD_PAPER.lit);
  g.fill();
  g.strokeStyle = css(OLD_PAPER.burn, 0.9);
  g.stroke();
  g.beginPath();
  for (let k = 0; k <= 40; k++) {
    const a = (k / 40) * Math.PI * 5, s = 1 - k / 46;
    const px = x0 + Math.cos(a) * r * 0.36 * s, py = y + Math.sin(a) * r * 0.86 * s;
    if (k) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.strokeStyle = css(OLD_PAPER.deep);
  g.lineWidth = 0.7;
  g.stroke();
}

/** A brass compass at (x, y), `r` across: a brass ring ticked round, and on a cream face a gold rose, its north point dark. Struck in brass all over when `coin`. */
function brassCompass(g: Ctx, x: number, y: number, r: number, coin: boolean): void {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.save();
  g.shadowColor = 'rgba(50, 30, 15, 0.45)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.2;
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.restore();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.9;
  g.stroke();
  const face = r * (coin ? 0.78 : 0.72);
  g.beginPath();
  g.arc(0, 0, face, 0, Math.PI * 2);
  g.fillStyle = coin ? goldFill(g, r, r, -r, -r) : '#f7efdc';
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.6;
  g.stroke();
  if (!coin) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * face, Math.sin(a) * face);
      g.lineTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1));
      g.strokeStyle = css(BRASS.ink, 0.6);
      g.lineWidth = 0.6;
      g.stroke();
    }
  }
  g.save();
  g.rotate(Math.PI / 4);
  star(g, face * 0.62, face * 0.12);
  g.fillStyle = coin ? css(shade(BRASS.body, 0.25)) : goldFill(g, -r, -r, r, r);
  g.fill();
  g.restore();
  star(g, face * 0.92, face * 0.18);
  g.fillStyle = coin ? css(light(BRASS.body, 0.35)) : goldFill(g, -r, -r, r, r);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.9);
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.moveTo(0, -face * 0.92);
  g.lineTo(face * 0.11, -face * 0.11);
  g.lineTo(0, 0);
  g.closePath();
  g.fillStyle = css(coin ? BRASS.ink : X_RED, 0.85);
  g.fill();
  g.restore();
}

/** A brass ring at (x, y), `r` across, that a thing hangs by. */
function bail(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = css(BRASS.body);
  g.lineWidth = 1.4;
  g.stroke();
}

/** A cream tag at (x, y), its top, `wd` × `ht`: its corners clipped at the top, a hole, and a compass star inked on it. */
function starTag(g: Ctx, x: number, y: number, wd: number, ht: number): void {
  const c = wd * 0.28;
  g.beginPath();
  g.moveTo(x - wd / 2 + c, y);
  g.lineTo(x + wd / 2 - c, y);
  g.lineTo(x + wd / 2, y + c);
  g.lineTo(x + wd / 2, y + ht);
  g.lineTo(x - wd / 2, y + ht);
  g.lineTo(x - wd / 2, y + c);
  g.closePath();
  g.save();
  g.shadowColor = 'rgba(50, 30, 15, 0.35)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.fillStyle = '#f8f0dd';
  g.fill();
  g.restore();
  g.strokeStyle = css(OLD_PAPER.burn, 0.8);
  g.lineWidth = 0.8;
  g.stroke();
  g.beginPath();
  g.arc(x, y + c * 0.8, 1.2, 0, Math.PI * 2);
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  g.save();
  g.translate(x, y + ht * 0.6);
  star(g, wd * 0.36, wd * 0.08);
  g.fillStyle = css(SEPIA, 0.85);
  g.fill();
  g.restore();
}

/** A knot in a cord at (x, y), `r` across: loops of the cord laid over each other. */
function knot(g: Ctx, x: number, y: number, r: number, t: number): void {
  twist(g, ellipsePts(x, y, r, r * 0.7, 0.5), t, CORD);
  twist(g, ellipsePts(x + 0.5, y + 0.3, r * 0.8, r * 0.55, -0.6), t, light(CORD, 0.1));
}


/* ---- the market stall's own kit ----------------------------------------- */

/** The stall's weathered timber, its awning's green and cream, the teal of a cloth, the gold of its trim and tassels, and the ink of the banner's marks. */
const STALL_WOOD = H('#9a7553');
const AWNING = { green: H('#7aa27b'), greenDeep: H('#4f7553'), cream: H('#f3ecd8'), creamDeep: H('#cbbd9c') };
const TEAL = H('#7fb0b4');
const TASSEL = H('#d9b25c');
const MARK = H('#8a5a34');

/** An upright post from (x0, y0) to (x1, y1): a plank stood on end, lit from the left. */
function post(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, tone: RGB): void {
  g.save();
  g.translate(x0, y1);
  g.rotate(-Math.PI / 2);
  plank(g, R, 0, y1 - y0, 0, x1 - x0, tone);
  g.restore();
}

/** A brass finial on a post's top at (x, y), `s` across: a square collar and a pointed cap over it, lit on the left. */
function finial(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.shadowColor = 'rgba(50, 30, 15, 0.4)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.beginPath();
  g.roundRect(x - s * 0.5, y - s * 0.32, s, s * 0.36, 1.5);
  g.fillStyle = goldFill(g, x - s / 2, y - s * 0.32, x + s / 2, y);
  g.fill();
  g.restore();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  const top = y - s * 1.25, foot = y - s * 0.32;
  for (const [side, c] of [[-1, light(BRASS.body, 0.35)], [1, shade(BRASS.body, 0.25)]] as Array<[number, RGB]>) {
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + side * s * 0.34, foot);
    g.lineTo(x, foot);
    g.closePath();
    g.fillStyle = css(c);
    g.fill();
  }
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x + s * 0.34, foot);
  g.lineTo(x - s * 0.34, foot);
  g.closePath();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.8;
  g.stroke();
  g.beginPath();
  g.arc(x, top + 0.5, 1.4, 0, Math.PI * 2);
  g.fillStyle = css(light(BRASS.body, 0.5));
  g.fill();
}

/** A lashing of `n` turns of cord round a post across it from x0 to x1, the first turn at y, on the slant. */
function lashing(g: Ctx, x0: number, x1: number, y: number, n: number): void {
  for (let k = 0; k < n; k++) twist(g, [[x0 - 1, y + k * 3.3 - 1.6], [x1 + 1, y + k * 3.3 + 1.6]], 2.6, CORD);
}

/**
 * The awning from x0 to x1, its head at y0: panels green and cream in turn,
 * each billowed and swagged down to a scallop `drop` below, trimmed in gold
 * along its hem, gathered in a roll along its head.
 */
function awning(g: Ctx, x0: number, x1: number, y0: number, drop: number, F: number): void {
  const n = Math.max(3, Math.round((x1 - x0) / (F * 2.3)));
  const pw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const px = x0 + i * pw, green = i % 2 === 0;
    const side = y0 + drop * 0.66;
    const shape = (): void => {
      g.beginPath();
      g.moveTo(px, y0);
      g.lineTo(px + pw, y0);
      g.lineTo(px + pw, side);
      g.quadraticCurveTo(px + pw / 2, y0 + drop * 1.4, px, side);
      g.closePath();
    };
    g.save();
    shape();
    g.shadowColor = 'rgba(40, 30, 20, 0.35)';
    g.shadowBlur = 3;
    g.shadowOffsetY = 2;
    const [c, deep] = green ? [AWNING.green, AWNING.greenDeep] : [AWNING.cream, AWNING.creamDeep];
    const f = g.createLinearGradient(px, 0, px + pw, 0);
    f.addColorStop(0, css(mix(c, deep, 0.45)));
    f.addColorStop(0.35, css(light(c, 0.12)));
    f.addColorStop(0.7, css(c));
    f.addColorStop(1, css(mix(c, deep, 0.6)));
    g.fillStyle = f;
    g.fill();
    g.restore();
    // Its folds, gathered at the head and falling to the scallop.
    g.save();
    shape();
    g.clip();
    for (const t of [0.3, 0.55, 0.78]) {
      g.beginPath();
      g.moveTo(px + pw * (0.5 + (t - 0.5) * 0.5), y0);
      g.quadraticCurveTo(px + pw * t, y0 + drop * 0.5, px + pw * (0.5 + (t - 0.5) * 1.3), y0 + drop * 1.05);
      g.strokeStyle = css(green ? AWNING.greenDeep : AWNING.creamDeep, 0.55);
      g.lineWidth = 1;
      g.stroke();
    }
    const head = g.createLinearGradient(0, y0, 0, y0 + drop * 0.35);
    head.addColorStop(0, 'rgba(50, 36, 24, 0.3)');
    head.addColorStop(1, 'rgba(50, 36, 24, 0)');
    g.fillStyle = head;
    g.fillRect(px, y0, pw, drop * 0.35);
    g.restore();
    shape();
    g.strokeStyle = css(green ? shade(AWNING.greenDeep, 0.2) : AWNING.creamDeep);
    g.lineWidth = 0.8;
    g.stroke();
    // The gold along its hem.
    gilt(g, () => {
      g.beginPath();
      g.moveTo(px + pw, side);
      g.quadraticCurveTo(px + pw / 2, y0 + drop * 1.4, px, side);
    }, 1.7);
  }
  // The roll at its head, over the beam.
  for (let i = 0; i < n; i++) {
    const px = x0 + i * pw;
    g.beginPath();
    g.moveTo(px, y0 + 2.5);
    g.quadraticCurveTo(px + pw / 2, y0 - 3.5, px + pw, y0 + 2.5);
    g.lineTo(px + pw, y0 + 4.5);
    g.quadraticCurveTo(px + pw / 2, y0 + 0.5, px, y0 + 4.5);
    g.closePath();
    g.fillStyle = css(i % 2 ? AWNING.creamDeep : AWNING.greenDeep);
    g.fill();
  }
}

/** The scales, the market's mark, inked at (x, y), their top, `s` high: a post, a beam, a pan hung from each end, and a foot. */
function scalesMark(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.strokeStyle = css(MARK);
  g.fillStyle = css(MARK);
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x, y + s * 0.08);
  g.lineTo(x, y + s * 0.82);
  g.moveTo(x - s * 0.44, y + s * 0.24);
  g.quadraticCurveTo(x, y + s * 0.14, x + s * 0.44, y + s * 0.24);
  g.stroke();
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + s * 0.06, y + s * 0.08);
  g.lineTo(x, y + s * 0.16);
  g.lineTo(x - s * 0.06, y + s * 0.08);
  g.closePath();
  g.fill();
  for (const d of [-1, 1]) {
    const ex = x + d * s * 0.44, ey = y + s * 0.24, py = y + s * 0.56;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(ex - s * 0.15, py);
    g.moveTo(ex, ey);
    g.lineTo(ex + s * 0.15, py);
    g.stroke();
    g.beginPath();
    g.moveTo(ex - s * 0.18, py);
    g.quadraticCurveTo(ex, py + s * 0.16, ex + s * 0.18, py);
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.moveTo(x - s * 0.2, y + s * 0.92);
  g.quadraticCurveTo(x, y + s * 0.76, x + s * 0.2, y + s * 0.92);
  g.closePath();
  g.fill();
  g.restore();
}

/** A sprig inked at (x, y), its tip, `s` long: a stem down with two pairs of leaves. */
function sprigMark(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.strokeStyle = css(MARK);
  g.fillStyle = css(MARK);
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y + s);
  g.stroke();
  for (const [t, len] of [[0.35, 0.42], [0.65, 0.5]]) {
    for (const d of [-1, 1]) {
      g.beginPath();
      g.ellipse(x + d * s * len * 0.45, y + s * t - s * 0.08, s * len * 0.42, s * 0.1, d * -0.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.beginPath();
  g.ellipse(x, y - s * 0.02, s * 0.08, s * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The market's banner on a rod from x0 to x1 at y, `len` long to its point:
 * cream on green, edged in gold, the scales and a sprig on it, gold tassels
 * at its corners and its point.
 */
function marketBanner(g: Ctx, x0: number, x1: number, y: number, len: number): void {
  const wd = x1 - x0, mid = (x0 + x1) / 2;
  const shape = (d: number): void => {
    g.beginPath();
    g.moveTo(x0 + d, y + 1);
    g.lineTo(x1 - d, y + 1);
    g.lineTo(x1 - d, y + len * 0.8 - d * 0.4);
    g.lineTo(mid, y + len - d * 1.5);
    g.lineTo(x0 + d, y + len * 0.8 - d * 0.4);
    g.closePath();
  };
  g.save();
  shape(0);
  g.shadowColor = 'rgba(40, 30, 20, 0.4)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1;
  g.shadowOffsetY = 2;
  g.fillStyle = css(AWNING.green);
  g.fill();
  g.restore();
  shape(0);
  g.strokeStyle = css(AWNING.greenDeep);
  g.lineWidth = 1;
  g.stroke();
  const b = wd * 0.14;
  shape(b);
  const f = g.createLinearGradient(x0, 0, x1, 0);
  f.addColorStop(0, css(light(AWNING.cream, 0.3)));
  f.addColorStop(1, css(mix(AWNING.cream, AWNING.creamDeep, 0.4)));
  g.fillStyle = f;
  g.fill();
  gilt(g, () => shape(b), 0.9);
  scalesMark(g, mid, y + len * 0.13, wd * 0.82);
  sprigMark(g, mid, y + len * 0.5, wd * 0.6);
  // The rod: wood, a brass knob at each end.
  g.beginPath();
  g.roundRect(x0 - 5, y - 2.2, wd + 10, 4.4, 2.2);
  g.fillStyle = css(shade(STALL_WOOD, 0.15));
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.8;
  g.stroke();
  head(g, x0 - 5, y, 2.6, BRASS.body, BRASS.ink);
  head(g, x1 + 5, y, 2.6, BRASS.body, BRASS.ink);
  for (const [tx, ty] of [[x0 + 2, y + len * 0.8], [x1 - 2, y + len * 0.8], [mid, y + len - 1]] as Pt[]) tassel(g, tx, ty, TASSEL);
}

/** A cloth hung down the right post from (x0, y) to x1, `len` long on its inner edge: cream, folded, two gold lines down that edge, its hem cut on the slant up to its outer one. */
function hungCloth(g: Ctx, x0: number, x1: number, y: number, len: number): void {
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x0 + 2, y);
    g.quadraticCurveTo((x0 + x1) / 2, y - 3, x1, y + 1);
    g.quadraticCurveTo(x1 + 2, y + len * 0.3, x1 - 1, y + len * 0.62);
    g.quadraticCurveTo((x0 + x1) / 2 - 2, y + len * 0.78, x0 - 1, y + len);
    g.quadraticCurveTo(x0 - 3, y + len * 0.5, x0 + 2, y);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 30, 20, 0.4)';
  g.shadowBlur = 3;
  g.shadowOffsetX = -1;
  g.shadowOffsetY = 2;
  g.fillStyle = css(AWNING.cream);
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  const wd = x1 - x0;
  // Two soft folds falling from where it hangs, wider toward the hem.
  for (const t of [0.35, 0.7]) {
    const fx = x0 + wd * t;
    g.beginPath();
    g.moveTo(fx - 1, y);
    g.lineTo(fx + 1, y);
    g.lineTo(fx + 4, y + len);
    g.lineTo(fx - 4, y + len);
    g.closePath();
    const fold = g.createLinearGradient(fx - 4, 0, fx + 4, 0);
    fold.addColorStop(0, 'rgba(120, 100, 70, 0)');
    fold.addColorStop(0.5, 'rgba(120, 100, 70, 0.32)');
    fold.addColorStop(1, 'rgba(120, 100, 70, 0)');
    g.fillStyle = fold;
    g.fill();
  }
  const side = g.createLinearGradient(x0, 0, x1, 0);
  side.addColorStop(0.6, 'rgba(90, 70, 50, 0)');
  side.addColorStop(1, 'rgba(90, 70, 50, 0.3)');
  g.fillStyle = side;
  g.fillRect(x0 - 2, y - 4, wd + 4, len + 4);
  for (const dx of [3.5, 6]) gilt(g, () => {
    g.beginPath();
    g.moveTo(x0 + dx, y + 2);
    g.quadraticCurveTo(x0 + dx - 3, y + len * 0.5, x0 + dx - 1, y + len - dx * 0.6);
  }, 0.7);
  g.restore();
  shape();
  g.strokeStyle = css(AWNING.creamDeep);
  g.lineWidth = 0.9;
  g.stroke();
}

/** A barrel stood on end at (x, yb), its foot, `wd` × `ht`: staves bellied out, three iron hoops, its head. */
function standingBarrel(g: Ctx, x: number, yb: number, wd: number, ht: number, tone: RGB): void {
  const hw = wd * 0.42, bulge = wd * 0.54;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x - hw, yb - ht);
    g.quadraticCurveTo(x - bulge * 1.08, yb - ht / 2, x - hw, yb);
    g.lineTo(x + hw, yb);
    g.quadraticCurveTo(x + bulge * 1.08, yb - ht / 2, x + hw, yb - ht);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 26, 18, 0.45)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 2;
  const f = g.createLinearGradient(x - bulge, 0, x + bulge, 0);
  f.addColorStop(0, css(shade(tone, 0.2)));
  f.addColorStop(0.35, css(light(tone, 0.2)));
  f.addColorStop(1, css(shade(tone, 0.35)));
  g.fillStyle = f;
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  for (let k = -2; k <= 2; k++) {
    const sx = x + k * hw * 0.42;
    g.beginPath();
    g.moveTo(sx, yb - ht);
    g.quadraticCurveTo(sx + k * wd * 0.07, yb - ht / 2, sx, yb);
    g.strokeStyle = css(shade(tone, 0.45), 0.8);
    g.lineWidth = 0.8;
    g.stroke();
  }
  for (const t of [0.14, 0.5, 0.86]) {
    const yy = yb - ht * t, ww = t === 0.5 ? bulge * 1.04 : hw * 1.1;
    g.beginPath();
    g.moveTo(x - ww - 2, yy - 1);
    g.quadraticCurveTo(x, yy + 3, x + ww + 2, yy - 1);
    g.strokeStyle = css(IRON.ink);
    g.lineWidth = 3.4;
    g.stroke();
    g.strokeStyle = css(light(IRON.body, 0.1));
    g.lineWidth = 2.2;
    g.stroke();
  }
  g.restore();
  shape();
  g.strokeStyle = css(shade(tone, 0.55));
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.ellipse(x, yb - ht, hw, wd * 0.11, 0, 0, Math.PI * 2);
  g.fillStyle = css(light(tone, 0.15));
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(x, yb - ht + 0.6, hw * 0.78, wd * 0.07, 0, 0, Math.PI * 2);
  g.strokeStyle = css(shade(tone, 0.35), 0.8);
  g.lineWidth = 0.7;
  g.stroke();
}

/** A crate from (x0, y0) to (x1, y1): boards across, framed round, braced on the diagonal, nailed at its corners. */
function crate(g: Ctx, R: () => number, x0: number, y0: number, x1: number, y1: number, tone: RGB): void {
  const wd = x1 - x0, ht = y1 - y0, b = Math.min(wd, ht) * 0.16;
  g.save();
  g.shadowColor = 'rgba(40, 26, 18, 0.45)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 2;
  g.fillStyle = css(shade(tone, 0.12));
  g.fillRect(x0, y0, wd, ht);
  g.restore();
  g.save();
  g.beginPath();
  g.rect(x0, y0, wd, ht);
  g.clip();
  grain(g, R, x0, x1, y0 + 1, y1 - 1, shade(tone, 0.12), false);
  for (let k = 1; k < 3; k++) {
    g.fillStyle = css(shade(tone, 0.5), 0.7);
    g.fillRect(x0, y0 + (ht * k) / 3, wd, 0.9);
  }
  // The brace, across the inside of the frame.
  const ang = Math.atan2(-(ht - b * 2), wd - b * 2), L = Math.hypot(wd, ht);
  g.save();
  g.translate(x0 + wd / 2, y0 + ht / 2);
  g.rotate(ang);
  g.fillStyle = css(tone);
  g.fillRect(-L / 2, -b * 0.45, L, b * 0.9);
  g.strokeStyle = css(shade(tone, 0.5));
  g.lineWidth = 0.8;
  g.strokeRect(-L / 2, -b * 0.45, L, b * 0.9);
  g.restore();
  // The frame round it, lit on its top and its left.
  for (const [rx, ry, rw, rh, lit] of [[x0, y0, wd, b, 0.25], [x0, y1 - b, wd, b, 0], [x0, y0, b, ht, 0.18], [x1 - b, y0, b, ht, -0.1]] as Array<[number, number, number, number, number]>) {
    g.fillStyle = css(lit >= 0 ? light(tone, lit) : shade(tone, -lit));
    g.fillRect(rx, ry, rw, rh);
    g.strokeStyle = css(shade(tone, 0.5));
    g.lineWidth = 0.8;
    g.strokeRect(rx + 0.4, ry + 0.4, rw - 0.8, rh - 0.8);
  }
  g.restore();
  g.strokeStyle = css(H('#5a3e28'));
  g.lineWidth = 1.1;
  g.strokeRect(x0, y0, wd, ht);
  for (const [nx, ny] of [[x0 + b / 2, y0 + b / 2], [x1 - b / 2, y0 + b / 2], [x0 + b / 2, y1 - b / 2], [x1 - b / 2, y1 - b / 2]] as Pt[]) head(g, nx, ny, 1, IRON.body, IRON.ink);
}

/** A cloth thrown over the corner of a crate from (x, y), `wd` wide, falling `len`: cream with a teal stripe down it, gold lines either side, fringed at its foot. */
function throwCloth(g: Ctx, x: number, y: number, wd: number, len: number): void {
  const lean = wd * 0.18;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + wd, y - 2);
    g.lineTo(x + wd + lean, y + len);
    g.lineTo(x + lean, y + len + 1.5);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 30, 20, 0.4)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.5;
  g.fillStyle = css(AWNING.cream);
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  g.beginPath();
  g.moveTo(x + wd * 0.38, y - 2);
  g.lineTo(x + wd * 0.66, y - 2);
  g.lineTo(x + wd * 0.66 + lean, y + len + 2);
  g.lineTo(x + wd * 0.38 + lean, y + len + 2);
  g.closePath();
  g.fillStyle = css(TEAL);
  g.fill();
  for (const t of [0.32, 0.72]) gilt(g, () => {
    g.beginPath();
    g.moveTo(x + wd * t, y - 2);
    g.lineTo(x + wd * t + lean, y + len + 2);
  }, 0.6);
  const fold = g.createLinearGradient(0, y, 0, y + len);
  fold.addColorStop(0, 'rgba(90, 70, 50, 0.25)');
  fold.addColorStop(0.3, 'rgba(90, 70, 50, 0)');
  g.fillStyle = fold;
  g.fillRect(x - 2, y - 3, wd + lean + 4, len + 6);
  g.restore();
  shape();
  g.strokeStyle = css(AWNING.creamDeep);
  g.lineWidth = 0.8;
  g.stroke();
  for (let fx = x + lean + 1; fx < x + wd + lean; fx += 1.8) {
    g.beginPath();
    g.moveTo(fx, y + len + 1);
    g.lineTo(fx + 0.3, y + len + 4.5);
    g.strokeStyle = css(AWNING.creamDeep);
    g.lineWidth = 0.7;
    g.stroke();
  }
}

/** A sack stood at (x, yb), its foot, `wd` × `ht`: burlap, full at its foot, tied at its neck with twine, its mouth ruffled open. */
function sackOf(g: Ctx, x: number, yb: number, wd: number, ht: number): void {
  const hw = wd / 2, neck = yb - ht * 0.72, burlap = H('#d9c49c');
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x - hw * 0.28, neck);
    g.bezierCurveTo(x - hw * 1.15, neck + ht * 0.15, x - hw * 1.1, yb, x - hw * 0.5, yb);
    g.lineTo(x + hw * 0.5, yb);
    g.bezierCurveTo(x + hw * 1.1, yb, x + hw * 1.15, neck + ht * 0.15, x + hw * 0.28, neck);
    g.lineTo(x + hw * 0.5, yb - ht);
    g.lineTo(x + hw * 0.15, yb - ht * 0.94);
    g.lineTo(x - hw * 0.1, yb - ht * 1.02);
    g.lineTo(x - hw * 0.5, yb - ht * 0.95);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(40, 30, 20, 0.4)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 2;
  const f = g.createRadialGradient(x - hw * 0.35, yb - ht * 0.4, 1, x, yb - ht * 0.3, wd);
  f.addColorStop(0, css(light(burlap, 0.3)));
  f.addColorStop(1, css(shade(burlap, 0.3)));
  g.fillStyle = f;
  g.fill();
  g.restore();
  g.save();
  shape();
  g.clip();
  for (let yy = neck; yy < yb; yy += 2.2) {
    g.fillStyle = css(shade(burlap, 0.25), 0.35);
    g.fillRect(x - wd, yy, wd * 2, 0.6);
  }
  g.restore();
  shape();
  g.strokeStyle = css(H('#7d6a4c'));
  g.lineWidth = 0.9;
  g.stroke();
  twist(g, [[x - hw * 0.34, neck - 0.5], [x + hw * 0.34, neck + 0.5]], 2, CORD);
  twist(g, [[x - hw * 0.3, neck + 2.2], [x + hw * 0.3, neck + 2.8]], 2, CORD);
}

/** A bottle stood at (x, yb), its foot, `wd` × `ht`: blue glass, round-shouldered, corked, a light down its left. */
function bottle(g: Ctx, x: number, yb: number, wd: number, ht: number): void {
  const hw = wd / 2, sh = yb - ht * 0.55, nk = wd * 0.17;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(x - nk, yb - ht * 0.88);
    g.lineTo(x - nk, sh - ht * 0.12);
    g.quadraticCurveTo(x - hw, sh - ht * 0.05, x - hw, sh + ht * 0.1);
    g.quadraticCurveTo(x - hw * 1.05, yb, x - hw * 0.7, yb);
    g.lineTo(x + hw * 0.7, yb);
    g.quadraticCurveTo(x + hw * 1.05, yb, x + hw, sh + ht * 0.1);
    g.quadraticCurveTo(x + hw, sh - ht * 0.05, x + nk, sh - ht * 0.12);
    g.lineTo(x + nk, yb - ht * 0.88);
    g.closePath();
  };
  shape();
  const f = g.createLinearGradient(x - hw, 0, x + hw, 0);
  f.addColorStop(0, 'rgba(176, 200, 214, 0.95)');
  f.addColorStop(0.5, 'rgba(126, 156, 182, 0.95)');
  f.addColorStop(1, 'rgba(86, 110, 138, 0.95)');
  g.fillStyle = f;
  g.fill();
  g.strokeStyle = css(H('#4a5a6c'));
  g.lineWidth = 0.9;
  g.stroke();
  g.beginPath();
  g.moveTo(x - hw * 0.55, sh + ht * 0.08);
  g.lineTo(x - hw * 0.55, yb - ht * 0.1);
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.roundRect(x - nk * 1.15, yb - ht, nk * 2.3, ht * 0.14, 1);
  g.fillStyle = css(H('#b08a5e'));
  g.fill();
  g.strokeStyle = css(H('#6a4a30'));
  g.lineWidth = 0.7;
  g.stroke();
}

/** A clump of ivy and white flowers about (x, y), `r` across. */
function flowerClump(g: Ctx, R: () => number, x: number, y: number, r: number, F: number): void {
  for (let k = 0; k < 7; k++) {
    const a = R() * Math.PI * 2, d = r * (0.2 + R() * 0.6);
    ivyLeaf(g, x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.5, a, F * (0.32 + R() * 0.12), R() < 0.5);
  }
  for (let k = 0; k < 3; k++) {
    const a = R() * Math.PI * 2, d = r * R() * 0.5;
    blossom(g, x + Math.cos(a) * d, y + Math.sin(a) * d, F * 0.15);
  }
}

/* ---- the event log's own kit ------------------------------------------------ */

/** The event log's marble: white, clouded in patches of pale blue, the patches parted by veins of gold. */
const VEIN_GOLD = 'rgba(206, 164, 76, 0.85)';
const PATCH = { body: H('#a9c3dc'), lit: H('#d4e3f0'), deep: H('#7f9fc0') };

/** Blue-veined marble over the box (x0, y0)–(x1, y1), in whatever is clipped: its white, the blue patches, and the gold and grey veins between them. */
function blueMarble(g: Ctx, R: () => number, x0: number, y0: number, x1: number, y1: number, F: number): void {
  const base = g.createLinearGradient(x0, y0, x1, y1);
  base.addColorStop(0, '#fbf8f2');
  base.addColorStop(1, '#ece8e1');
  g.fillStyle = base;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const area = (x1 - x0) * (y1 - y0), rx = (): number => x0 + R() * (x1 - x0), ry = (): number => y0 + R() * (y1 - y0);
  // Clouds of blue, soft, run together.
  for (let k = 0; k < area / (F * F * 1.3); k++) {
    const cx = rx(), cy = ry(), r = F * (0.45 + R() * 0.6);
    g.save();
    g.translate(cx, cy);
    g.scale(1.4, 0.8);
    const c = g.createRadialGradient(0, 0, 0, 0, 0, r);
    c.addColorStop(0, css(PATCH.body, 0.38));
    c.addColorStop(1, css(PATCH.body, 0));
    g.fillStyle = c;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  // Patches of a deeper blue, broken stone-like, their edges softened.
  const edges: Pt[][] = [];
  for (let k = 0; k < area / (F * F * 1.6); k++) {
    const cx = rx(), cy = ry(), r = F * (0.25 + R() * 0.35), m = 5 + Math.floor(R() * 3);
    const pts: Pt[] = [];
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2 + R() * 0.5, d = r * (0.6 + R() * 0.55);
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7]);
    }
    g.save();
    g.filter = 'blur(0.8px)';
    poly(g, pts);
    const f = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    f.addColorStop(0, css(PATCH.lit, 0.55));
    f.addColorStop(1, css(PATCH.deep, 0.5));
    g.fillStyle = f;
    g.fill();
    g.restore();
    edges.push(pts);
  }
  // Gold cracks: along some patch edges, and wandering through the white, now and then forking.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pts of edges) {
    if (R() < 0.35) continue;
    const s0 = Math.floor(R() * pts.length), n = 2 + Math.floor(R() * 2);
    g.beginPath();
    for (let j = 0; j <= n; j++) {
      const [px, py] = pts[(s0 + j) % pts.length];
      if (j) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.strokeStyle = VEIN_GOLD;
    g.lineWidth = 0.7;
    g.stroke();
  }
  const crack = (x: number, y: number, a: number, steps: number, wd: number): void => {
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < steps; j++) {
      a += (R() - 0.5) * 0.9;
      x += Math.cos(a) * (3 + R() * 5);
      y += Math.sin(a) * (3 + R() * 5);
      g.lineTo(x, y);
      if (wd > 0.45 && R() < 0.12) {
        g.strokeStyle = VEIN_GOLD;
        g.lineWidth = wd;
        g.stroke();
        crack(x, y, a + (R() < 0.5 ? 1 : -1) * (0.6 + R() * 0.5), Math.floor(steps / 2), wd * 0.7);
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.strokeStyle = VEIN_GOLD;
    g.lineWidth = wd;
    g.stroke();
  };
  for (let k = 0; k < area / (F * F * 3); k++) crack(rx(), ry(), R() * Math.PI * 2, 5 + Math.floor(R() * 6), 0.65);
  for (let k = 0; k < area / (F * F * 2.5); k++) {
    let x = rx(), y = ry();
    const a = R() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) {
      x += Math.cos(a) * 5 + (R() - 0.5) * 3;
      y += Math.sin(a) * 5 + (R() - 0.5) * 3;
      g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(150, 160, 176, 0.35)';
    g.lineWidth = 0.45;
    g.stroke();
  }
}

/** Marble in a path: clipped to it, filled over its box, and edged in gold. */
function marbleShape(g: Ctx, R: () => number, path: () => void, x0: number, y0: number, x1: number, y1: number, F: number, edge = 1.2): void {
  g.save();
  path();
  g.shadowColor = 'rgba(60, 60, 80, 0.3)';
  g.shadowBlur = 3;
  g.shadowOffsetY = 1.5;
  g.fillStyle = '#f4f1ea';
  g.fill();
  g.restore();
  g.save();
  path();
  g.clip();
  blueMarble(g, R, x0, y0, x1, y1, F);
  g.restore();
  gilt(g, path, edge);
}

/** A square pillar from x0 to x1, y0 to y1: blue-veined marble shaded round from the left, gold down both its edges. */
function marblePillar(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, F: number): void {
  const path = (): void => {
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
  };
  marbleShape(g, R, path, x0, y0, x1, y1, F, 1.1);
  g.save();
  path();
  g.clip();
  const round = g.createLinearGradient(x0, 0, x1, 0);
  round.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  round.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
  round.addColorStop(0.8, 'rgba(70, 80, 110, 0.05)');
  round.addColorStop(1, 'rgba(70, 80, 110, 0.22)');
  g.fillStyle = round;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
  for (const x of [x0 + 3, x1 - 3]) gilt(g, () => {
    g.beginPath();
    g.moveTo(x, y0 + 2);
    g.lineTo(x, y1 - 2);
  }, 0.6);
}

/** A pillar's capital or base about (x, y), `wd` across: two marble slabs stepped, the wider outside, gold-edged. `up` for a capital, whose wide slab is on top. */
function plinthAt(g: Ctx, R: () => number, x: number, y: number, wd: number, F: number, up: boolean): void {
  const d = up ? -1 : 1;
  // The narrow slab against the pillar, a gold band, then the wide slab beyond.
  const slab = (w2: number, ya: number, tall: number): void => {
    const top = d < 0 ? ya - tall : ya;
    marbleShape(g, R, () => {
      g.beginPath();
      g.roundRect(x - w2 / 2, top, w2, tall, 1.5);
    }, x - w2 / 2, top, x + w2 / 2, top + tall, F, 1);
  };
  slab(wd * 1.06, y, F * 0.26);
  const by = y + d * F * 0.26;
  g.beginPath();
  g.roundRect(x - wd * 0.6, d < 0 ? by - F * 0.12 : by, wd * 1.2, F * 0.12, 1);
  g.fillStyle = goldFill(g, x - wd * 0.6, by - F * 0.1, x + wd * 0.6, by + F * 0.1);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.6;
  g.stroke();
  slab(wd * 1.3, by + d * F * 0.12, F * 0.3);
}

/** A gold scroll from (x, y) running `len` along, `dir` 1 to the right or -1 to the left: a swelling curve ending in a curl, and a leaf off it. */
function giltScroll(g: Ctx, x: number, y: number, len: number, dir: 1 | -1, F: number, sag = 1): void {
  const ex = x + dir * len, r = F * 0.17;
  gilt(g, () => {
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + dir * len * 0.35, y + F * 0.3 * sag, x + dir * len * 0.7, y - F * 0.2 * sag, ex, y + F * 0.05);
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 1.7, rr = r * (1 - k / 22);
      g.lineTo(ex - dir * r + dir * Math.cos(a) * rr * 1, y + F * 0.05 - r + Math.sin(a + Math.PI / 2) * rr);
    }
  }, 1.2);
  g.save();
  g.translate(x + dir * len * 0.45, y + F * 0.06 * sag);
  g.rotate(dir > 0 ? -0.6 : Math.PI + 0.6);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(F * 0.16, -F * 0.13, F * 0.34, 0);
  g.quadraticCurveTo(F * 0.16, F * 0.13, 0, 0);
  g.fillStyle = goldFill(g, 0, -F * 0.2, F * 0.4, F * 0.2);
  g.fill();
  g.strokeStyle = css(BRASS.ink, 0.8);
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();
}

/** A four-pointed star with arms of a length, centred on the origin, `r` to each point and `inner` to the dips between, its sides curving in. */
function crossStar(g: Ctx, r: number, inner: number): void {
  g.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 - Math.PI / 2, b = a + Math.PI / 4, c = a + Math.PI / 2;
    if (!k) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    g.quadraticCurveTo(Math.cos(b) * inner, Math.sin(b) * inner, Math.cos(c) * r, Math.sin(c) * r);
  }
  g.closePath();
}

/** An eight-pointed star of gold at (x, y), `r` to its great points: a lesser star turned under the great one. */
function goldStar8(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  g.shadowColor = 'rgba(60, 40, 10, 0.35)';
  g.shadowBlur = 2;
  g.shadowOffsetY = 1;
  g.save();
  g.rotate(Math.PI / 4);
  crossStar(g, r * 0.62, r * 0.16);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.restore();
  crossStar(g, r, r * 0.2);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = css(BRASS.ink, 0.85);
  g.lineWidth = 0.6;
  g.stroke();
  // Each great point ridged: lit on one face.
  for (let k = 0; k < 4; k++) {
    g.save();
    g.rotate((k * Math.PI) / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r);
    g.lineTo(-r * 0.12, -r * 0.12);
    g.closePath();
    g.fillStyle = 'rgba(255, 246, 214, 0.45)';
    g.fill();
    g.restore();
  }
  g.restore();
}

/** A star of pale crystal at (x, y) in a gold lozenge `r` to its points: the lozenge's face blue, the star white and blue, faceted. */
function crystalStar(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  const lozenge = (k: number): void => {
    g.beginPath();
    g.moveTo(0, -r * k);
    g.lineTo(r * k * 0.82, 0);
    g.lineTo(0, r * k);
    g.lineTo(-r * k * 0.82, 0);
    g.closePath();
  };
  g.save();
  lozenge(1);
  g.shadowColor = 'rgba(40, 50, 70, 0.4)';
  g.shadowBlur = 2.5;
  g.shadowOffsetY = 1.2;
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.restore();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.7;
  g.stroke();
  lozenge(0.78);
  const face = g.createLinearGradient(-r, -r, r, r);
  face.addColorStop(0, css(PATCH.lit));
  face.addColorStop(1, css(PATCH.deep));
  g.fillStyle = face;
  g.fill();
  star(g, r * 0.72, r * 0.16);
  const s = g.createLinearGradient(-r, -r, r, r);
  s.addColorStop(0, '#ffffff');
  s.addColorStop(0.5, '#dfeaf5');
  s.addColorStop(1, '#9db8d4');
  g.fillStyle = s;
  g.fill();
  g.strokeStyle = 'rgba(70, 96, 130, 0.8)';
  g.lineWidth = 0.6;
  g.stroke();
  g.beginPath();
  g.moveTo(-r * 0.72, 0);
  g.lineTo(r * 0.72, 0);
  g.moveTo(0, -r * 0.72);
  g.lineTo(0, r * 0.72);
  g.strokeStyle = 'rgba(70, 96, 130, 0.35)';
  g.lineWidth = 0.5;
  g.stroke();
  g.restore();
}

/**
 * The crest over the middle of the top at x, `F` the rim: an arch of the
 * marble rising out of the band, gold round it and a gold line inside it,
 * a round of blue in it with the great gold star over that, and gold
 * scrolls running off its feet along the band.
 */
function crest(g: Ctx, R: () => number, x: number, F: number): void {
  const A = F * 3.1, T = F * 1.25, foot = F * 0.55;
  const arch = (k: number): void => {
    g.beginPath();
    g.moveTo(x - A * k, foot);
    g.bezierCurveTo(x - A * k, -T * k * 0.55, x - A * k * 0.55, -T * k, x, -T * k);
    g.bezierCurveTo(x + A * k * 0.55, -T * k, x + A * k, -T * k * 0.55, x + A * k, foot);
    g.closePath();
  };
  marbleShape(g, R, () => arch(1), x - A, -T, x + A, foot, F, 1.5);
  gilt(g, () => {
    g.beginPath();
    g.moveTo(x - A * 0.84, foot - 1);
    g.bezierCurveTo(x - A * 0.84, -T * 0.84 * 0.55, x - A * 0.84 * 0.55, -T * 0.84, x, -T * 0.84);
    g.bezierCurveTo(x + A * 0.84 * 0.55, -T * 0.84, x + A * 0.84, -T * 0.84 * 0.55, x + A * 0.84, foot - 1);
  }, 0.9);
  for (const dir of [-1, 1] as const) giltScroll(g, x + dir * A * 0.92, F * 0.45, F * 2.3, dir, F);
  const my = -F * 0.25, mr = F * 0.72;
  g.beginPath();
  g.arc(x, my, mr, 0, Math.PI * 2);
  const blue = g.createRadialGradient(x - mr * 0.3, my - mr * 0.3, 1, x, my, mr);
  blue.addColorStop(0, css(PATCH.lit));
  blue.addColorStop(1, css(mix(PATCH.deep, H('#5f7898'), 0.5)));
  g.fillStyle = blue;
  g.fill();
  gilt(g, () => {
    g.beginPath();
    g.arc(x, my, mr, 0, Math.PI * 2);
  }, 1.4);
  goldStar8(g, x, my, F * 1.05);
}

/* ---- the journal's own kit ---------------------------------------------------- */

/** The journal's leather, its pages' edges, and its ribbon. */
const HIDE = { body: H('#8e5a3c'), lit: H('#b47a55'), deep: H('#5c3624') };
const LEAVES = { body: H('#f1e6cc'), line: H('#c9b892') };
const RIBBON = { body: H('#7e9ab8'), lit: H('#a9c0d8'), deep: H('#566f8c') };

/** Leather over the box (x0, y0)–(x1, y1), in whatever is clipped: its face, a soft grain of pores and a few scuffs. */
function hide(g: Ctx, R: () => number, x0: number, y0: number, x1: number, y1: number, F: number): void {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  f.addColorStop(0, css(HIDE.lit));
  f.addColorStop(0.5, css(HIDE.body));
  f.addColorStop(1, css(mix(HIDE.body, HIDE.deep, 0.45)));
  g.fillStyle = f;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const area = (x1 - x0) * (y1 - y0);
  for (let k = 0; k < area / 14; k++) {
    g.fillStyle = css(HIDE.deep, 0.22 + R() * 0.2);
    g.fillRect(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 0.9, 0.9);
  }
  for (let k = 0; k < area / (F * F * 2); k++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), r = F * (0.3 + R() * 0.6);
    const c = g.createRadialGradient(x, y, 0, x, y, r);
    c.addColorStop(0, css(R() < 0.5 ? HIDE.lit : HIDE.deep, 0.22));
    c.addColorStop(1, css(HIDE.body, 0));
    g.fillStyle = c;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** A four-pointed gold star at (x, y), `r` to its points, a dot of light at its heart. */
function goldStar4(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  g.shadowColor = 'rgba(40, 20, 10, 0.45)';
  g.shadowBlur = 1.5;
  g.shadowOffsetY = 0.8;
  crossStar(g, r, r * 0.21);
  g.fillStyle = goldFill(g, -r, -r, r, r);
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = css(BRASS.ink, 0.85);
  g.lineWidth = 0.5;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 246, 214, 0.9)';
  g.fill();
  g.restore();
}

/** A tooled gold flourish on the spine at (x, y), `s` high: a drop-shaped leaf above and below a small lozenge, curls out to either side. */
function spineFlourish(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.shadowColor = 'rgba(40, 20, 10, 0.4)';
  g.shadowBlur = 1.2;
  g.shadowOffsetY = 0.6;
  g.fillStyle = goldFill(g, -s, -s, s, s);
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, d * s * 0.16);
    g.quadraticCurveTo(s * 0.16, d * s * 0.38, 0, d * s * 0.62);
    g.quadraticCurveTo(-s * 0.16, d * s * 0.38, 0, d * s * 0.16);
    g.fill();
  }
  g.beginPath();
  g.moveTo(0, -s * 0.12);
  g.lineTo(s * 0.12, 0);
  g.lineTo(0, s * 0.12);
  g.lineTo(-s * 0.12, 0);
  g.closePath();
  g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = css(BRASS.body);
  g.lineWidth = 1;
  g.lineCap = 'round';
  for (const d of [-1, 1]) {
    g.beginPath();
    g.moveTo(d * s * 0.16, 0);
    g.bezierCurveTo(d * s * 0.32, -s * 0.06, d * s * 0.32, -s * 0.24, d * s * 0.2, -s * 0.24);
    g.moveTo(d * s * 0.16, 0);
    g.bezierCurveTo(d * s * 0.32, s * 0.06, d * s * 0.32, s * 0.24, d * s * 0.2, s * 0.24);
    g.stroke();
  }
  g.restore();
}

/**
 * The book's spine down the left, from x0 to x1 and y0 to y1: leather
 * rounded across, raised bands across it each edged in gold, and between
 * them gold stars and a tooled flourish.
 */
function spine(g: Ctx, R: () => number, x0: number, x1: number, y0: number, y1: number, F: number): void {
  const wd = x1 - x0, cx = (x0 + x1) / 2, len = y1 - y0, rr = wd * 0.22;
  const path = (): void => {
    g.beginPath();
    g.roundRect(x0, y0, wd, len, rr);
  };
  g.save();
  path();
  g.shadowColor = 'rgba(30, 16, 8, 0.45)';
  g.shadowBlur = 4;
  g.shadowOffsetX = 2;
  g.shadowOffsetY = 2;
  g.fillStyle = css(HIDE.body);
  g.fill();
  g.restore();
  g.save();
  path();
  g.clip();
  hide(g, R, x0, y0, x1, y1, F);
  const round = g.createLinearGradient(x0, 0, x1, 0);
  round.addColorStop(0, 'rgba(40, 20, 10, 0.45)');
  round.addColorStop(0.32, 'rgba(255, 220, 180, 0.18)');
  round.addColorStop(0.55, 'rgba(255, 220, 180, 0)');
  round.addColorStop(1, 'rgba(40, 20, 10, 0.5)');
  g.fillStyle = round;
  g.fillRect(x0, y0, wd, len);
  g.restore();
  path();
  g.strokeStyle = css(HIDE.deep);
  g.lineWidth = 1;
  g.stroke();
  // The raised bands: a rib standing proud of the spine, rounded at its ends, lit on top and shaded under, two gold lines along it.
  const bands = [0.06, 0.16, 0.37, 0.56, 0.78, 0.94];
  for (const t of bands) {
    const y = y0 + len * t, bh = F * 0.42;
    const rib = (): void => {
      g.beginPath();
      g.roundRect(x0 - 1.5, y - bh / 2, wd + 3, bh, bh * 0.45);
    };
    g.save();
    rib();
    g.shadowColor = 'rgba(30, 16, 8, 0.45)';
    g.shadowBlur = 2;
    g.shadowOffsetY = 1.5;
    const ridge = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
    ridge.addColorStop(0, css(light(HIDE.lit, 0.1)));
    ridge.addColorStop(0.4, css(HIDE.body));
    ridge.addColorStop(1, css(HIDE.deep));
    g.fillStyle = ridge;
    g.fill();
    g.restore();
    g.save();
    rib();
    g.clip();
    g.fillStyle = round;
    g.fillRect(x0 - 2, y - bh / 2, wd + 4, bh);
    g.restore();
    rib();
    g.strokeStyle = css(HIDE.deep);
    g.lineWidth = 0.8;
    g.stroke();
    for (const e of [-1, 1]) gilt(g, () => {
      g.beginPath();
      g.moveTo(x0 + 1, y + e * bh * 0.22);
      g.lineTo(x1 - 1, y + e * bh * 0.22);
    }, 0.8);
  }
  // Between the bands: the stars, and the flourish in the longest gap.
  const between = (a: number, b: number): number => y0 + len * (a + b) / 2;
  goldStar4(g, cx, between(0.06, 0.16), wd * 0.26);
  goldStar8(g, cx, between(0.16, 0.37), wd * 0.48);
  goldStar4(g, cx, between(0.37, 0.56), wd * 0.3);
  spineFlourish(g, cx, between(0.56, 0.78), Math.min(wd * 0.9, len * 0.18));
  goldStar4(g, cx, between(0.78, 0.94), wd * 0.3);
}

/** A brass corner cap over the corner at the origin of the side frame (the corner square [0, F]): a triangle with its inner edge scalloped in, a gold star on it, two rivets. */
function brassCorner(g: Ctx, F: number): void {
  const s = F * 1.45;
  const shape = (): void => {
    g.beginPath();
    g.moveTo(-F * 0.12, -F * 0.12);
    g.lineTo(s, -F * 0.12);
    g.quadraticCurveTo(s * 0.62, s * 0.18, s * 0.5, s * 0.5);
    g.quadraticCurveTo(s * 0.18, s * 0.62, -F * 0.12, s);
    g.closePath();
  };
  g.save();
  shape();
  g.shadowColor = 'rgba(30, 16, 8, 0.45)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1;
  g.shadowOffsetY = 1.5;
  g.fillStyle = goldFill(g, 0, 0, s, s);
  g.fill();
  g.restore();
  shape();
  g.strokeStyle = css(BRASS.ink);
  g.lineWidth = 0.9;
  g.stroke();
  g.beginPath();
  g.moveTo(s * 0.86, F * 0.06);
  g.quadraticCurveTo(s * 0.55, s * 0.24, s * 0.44, s * 0.44);
  g.quadraticCurveTo(s * 0.24, s * 0.55, F * 0.06, s * 0.86);
  g.strokeStyle = css(light(BRASS.body, 0.45), 0.8);
  g.lineWidth = 0.8;
  g.stroke();
  goldStar4(g, s * 0.3, s * 0.3, F * 0.34);
  head(g, s * 0.72, F * 0.16, 1.3, BRASS.body, BRASS.ink);
  head(g, F * 0.16, s * 0.72, 1.3, BRASS.body, BRASS.ink);
}

/** The edges of the pages over the box (x0, y0)–(x1, y1), seen side on: cream, fine lines along the long way. */
function pageEdges(g: Ctx, x0: number, y0: number, x1: number, y1: number, along: 'x' | 'y'): void {
  const f = along === 'y' ? g.createLinearGradient(x0, 0, x1, 0) : g.createLinearGradient(0, y0, 0, y1);
  f.addColorStop(0, css(light(LEAVES.body, 0.3)));
  f.addColorStop(1, css(mix(LEAVES.body, LEAVES.line, 0.6)));
  g.fillStyle = f;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = css(LEAVES.line, 0.8);
  g.lineWidth = 0.5;
  const n = Math.floor(((along === 'y' ? x1 - x0 : y1 - y0)) / 1.6);
  for (let k = 1; k < n; k++) {
    g.beginPath();
    if (along === 'y') {
      const x = x0 + k * 1.6;
      g.moveTo(x, y0);
      g.lineTo(x, y1);
    } else {
      const y = y0 + k * 1.6;
      g.moveTo(x0, y);
      g.lineTo(x1, y);
    }
    g.stroke();
  }
}

/** The clasp strap over the right edge at y, `ht` high, from x0 out to x1: leather stitched along both edges, its end rounded, a gold star stud on it. */
function claspStrap(g: Ctx, R: () => number, x0: number, x1: number, y: number, ht: number, F: number): void {
  const path = (): void => {
    g.beginPath();
    g.roundRect(x0, y, x1 - x0, ht, [2, ht * 0.3, ht * 0.3, 2]);
  };
  g.save();
  path();
  g.shadowColor = 'rgba(30, 16, 8, 0.5)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1.5;
  g.shadowOffsetY = 2;
  g.fillStyle = css(HIDE.body);
  g.fill();
  g.restore();
  g.save();
  path();
  g.clip();
  hide(g, R, x0, y, x1, y + ht, F);
  const round = g.createLinearGradient(0, y, 0, y + ht);
  round.addColorStop(0, 'rgba(255, 220, 180, 0.2)');
  round.addColorStop(1, 'rgba(40, 20, 10, 0.35)');
  g.fillStyle = round;
  g.fillRect(x0, y, x1 - x0, ht);
  g.restore();
  path();
  g.strokeStyle = css(HIDE.deep);
  g.lineWidth = 1;
  g.stroke();
  for (const sy of [y + 3, y + ht - 3]) stitches(g, x0 + 3, x1 - 4, sy, LEAVES.body, 2.4, 2);
  goldStar4(g, x0 + (x1 - x0) * 0.62, y + ht / 2, ht * 0.32);
}

/** A ribbon marking the page, hanging from (x, y) `len` down, `wd` across: blue silk, gold lines down its edges, a gold star on it, cut in a swallowtail. */
function ribbonMark(g: Ctx, x: number, y: number, wd: number, len: number): void {
  const x0 = x - wd / 2, x1 = x + wd / 2, notch = wd * 0.6;
  const shape = (d: number): void => {
    g.beginPath();
    g.moveTo(x0 + d, y);
    g.lineTo(x1 - d, y);
    g.lineTo(x1 - d, y + len - d * 0.5);
    g.lineTo(x, y + len - notch + d * 0.8);
    g.lineTo(x0 + d, y + len - d * 0.5);
    g.closePath();
  };
  g.save();
  shape(0);
  g.shadowColor = 'rgba(30, 30, 50, 0.4)';
  g.shadowBlur = 3;
  g.shadowOffsetX = 1.5;
  g.shadowOffsetY = 2;
  const f = g.createLinearGradient(x0, 0, x1, 0);
  f.addColorStop(0, css(RIBBON.lit));
  f.addColorStop(0.5, css(RIBBON.body));
  f.addColorStop(1, css(RIBBON.deep));
  g.fillStyle = f;
  g.fill();
  g.restore();
  shape(0);
  g.strokeStyle = css(shade(RIBBON.deep, 0.3));
  g.lineWidth = 0.8;
  g.stroke();
  gilt(g, () => shape(wd * 0.14), 0.6);
  goldStar4(g, x, y + len * 0.6, wd * 0.42);
}

/* ---- the frames -------------------------------------------------------------- */

type Painter = (g: Ctx, w: number, h: number, F: number, R: () => number, o: FrameOpts) => void;

const PAINTERS: Record<string, Painter> = {
  /*
   * The pack: a sack's mouth rolled over and stuffed, lumpy all round, its
   * coarse weave creased where it bunches, sewn down to the cloth inside with
   * a running stitch and tacked across, patched in sage cloth where it has
   * worn through. Its drawstring is knotted at the top left and runs off along
   * the top and down the side to a bound tassel, with a sprig of lavender tied
   * into it; a brass grommet lower down that side, and a few ears of wheat
   * caught in the roll on the right.
   */
  burlap(g, w, h, F, R) {
    const sack = H('#bf955c'), twine = H('#9c7542'), thread = H('#efe4c8');
    const L1 = lumps(R, 53, 21), L2 = lumps(R, 41, 15);
    const outer = lumpyRect(w, h, 0.6, F * 0.85, (s) => 8.6 * L1(s) - 3.2);
    const inner = lumpyRect(w, h, F - 1.4, 6, (s) => 4 * L2(s));
    // Its shadow on whatever is behind, as far as the reach lets it fall.
    g.save();
    poly(g, outer);
    polyTo(g, inner);
    g.shadowColor = 'rgba(46, 30, 22, 0.55)';
    g.shadowBlur = 5;
    g.shadowOffsetY = 2;
    g.fillStyle = css(shade(sack, 0.3));
    g.fill('evenodd');
    g.restore();
    g.save();
    poly(g, outer);
    polyTo(g, inner);
    g.clip('evenodd');
    burlapWeave(g, R, -4, -4, w + 4, h + 4, F + 2, sack);
    eachSide(g, w, h, (sd) => {
      g.save();
      mitre(g, sd.len, F, 4);
      g.clip();
      // Round like a stuffed tube: in shade where it turns under at both edges, lit along its crown.
      const lit = sd.lit;
      const tube = g.createLinearGradient(0, -1, 0, F);
      tube.addColorStop(0, 'rgba(52, 32, 16, 0.85)');
      tube.addColorStop(0.22, 'rgba(52, 32, 16, 0.3)');
      tube.addColorStop(0.42, `rgba(255, 236, 196, ${(0.3 * lit).toFixed(2)})`);
      tube.addColorStop(0.56, `rgba(255, 236, 196, ${(0.06 * lit).toFixed(2)})`);
      tube.addColorStop(0.74, 'rgba(52, 32, 16, 0.38)');
      tube.addColorStop(1, 'rgba(52, 32, 16, 0.88)');
      g.fillStyle = tube;
      g.fillRect(-4, -4, sd.len + 8, F + 4);
      // Stuffed in lumps: pinched every 24 to 40 px, each lump catching the light on its crown.
      let x = F * 0.9 + R() * 10;
      while (x < sd.len - F * 0.9) {
        const next = Math.min(sd.len - F * 0.5, x + 24 + R() * 16), mid = (x + next) / 2;
        const crown = g.createRadialGradient(mid - 3, F * 0.36, 1, mid, F * 0.42, (next - x) * 0.55);
        crown.addColorStop(0, `rgba(255, 238, 200, ${(0.32 * lit).toFixed(2)})`);
        crown.addColorStop(1, 'rgba(255, 248, 228, 0)');
        g.fillStyle = crown;
        g.fillRect(x - 4, -4, next - x + 8, F + 4);
        // Where one lump meets the next the roll dents in from both edges, a little way, not across.
        for (const [y0, y1] of [[-1, F * (0.22 + R() * 0.12)], [F, F * (0.7 - R() * 0.12)]]) {
          const lean = (R() - 0.5) * 5;
          g.save();
          g.filter = 'blur(1.2px)';
          g.beginPath();
          g.moveTo(next - 2.5, y0);
          g.quadraticCurveTo(next + lean, (y0 + y1) / 2, next + lean * 0.5, y1);
          g.quadraticCurveTo(next + lean, (y0 + y1) / 2, next + 2.5, y0);
          g.fillStyle = 'rgba(62, 38, 20, 0.45)';
          g.fill();
          g.restore();
          g.beginPath();
          g.moveTo(next, y0);
          g.quadraticCurveTo(next + lean, (y0 + y1) / 2, next + lean * 0.5, y1);
          g.strokeStyle = 'rgba(74, 48, 28, 0.6)';
          g.lineWidth = 0.9;
          g.stroke();
        }
        x = next;
      }
      // And creased where it bunches, short folds in from each edge.
      for (let cx = F * 0.7 + R() * 8; cx < sd.len - F * 0.7; cx += 7 + R() * 10) {
        const fromOut = R() < 0.55, deep = F * (0.18 + R() * 0.2), lean = (R() - 0.5) * 6;
        const y0 = fromOut ? 1 : F - 2, y1 = fromOut ? y0 + deep : y0 - deep;
        g.beginPath();
        g.moveTo(cx, y0);
        g.quadraticCurveTo(cx + lean, (y0 + y1) / 2, cx + lean * 0.4, y1);
        g.strokeStyle = 'rgba(84, 56, 34, 0.42)';
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
    });
    g.restore();
    poly(g, outer);
    g.strokeStyle = css(H('#3d2a1c'));
    g.lineWidth = 2;
    g.stroke();
    poly(g, inner);
    g.lineWidth = 1.6;
    g.stroke();
    // The corners on the right gathered up and tied off, as a sack's are.
    gather(g, R, w - F * 0.42, F * 0.42, -Math.PI / 4, F, sack, twine);
    gather(g, R, w - F * 0.42, h - F * 0.42, Math.PI / 4, F, sack, twine);
    // Sewn down to the cloth inside: a running stitch along the roll's inner lip.
    dashAlong(g, lumpyRect(w, h, F - 5.4, 7, (s) => 4 * L2(s)), 3.8, 2.6, twine);
    // Tacked across the seam every so often, and here and there on the roll.
    eachSide(g, w, h, (sd) => {
      for (let x = F * 1.4 + R() * 30; x < sd.len - F * 1.4; x += 46 + R() * 50) crossStitch(g, x, F - 4, 3.2, twine);
      for (let x = F * 2 + R() * 60; x < sd.len - F * 2; x += 90 + R() * 90) crossStitch(g, x, F * 0.3, 3, twine);
    });
    // Patches where it has worn through, in sage cloth sewn on with pale thread.
    eachSide(g, w, h, (sd) => {
      if (sd.len < F * 6) return;
      const at = [0.8, 0.28, 0.8, 0.58][sd.i] + (R() - 0.5) * 0.08;
      patch(g, R, sd.len * at, F * 0.46, F * (0.95 + R() * 0.25), F * (0.66 + R() * 0.12), (R() - 0.5) * 0.3, thread);
    });
    // Low on the left, the cord wound three times round the roll, and its end hanging out of the corner.
    eachSide(g, w, h, (sd) => {
      if (sd.i !== 3) return;
      for (let k = 0; k < 3; k++) {
        const x = F * 1.15 + k * 5.2;
        twist(g, curve([x - 1, -2], [x + 3.5, F * 0.5], [x - 0.5, F - 1]), 3.4, twine);
      }
    });
    twist(g, curve([F * 0.2, h - F * 1.45], [-1, h - F * 0.6], [F * 0.5, h - 1]), 3.4, twine);
    tassel(g, F * 0.5, h - 2, twine);
    // The drawstring: off the knot along the top and down the side.
    const kx = F * 0.5, ky = F * 0.5;
    twist(g, curve([kx, ky], [w * 0.15, F * 0.66], [Math.min(w * 0.32, w - F * 4), F * 0.28]), 3.6, twine);
    const tail = Math.min(h * 0.36, h - F * 5);
    // A sprig of lavender tied into it on the way down.
    lavender(g, R, F * 0.28, tail * 0.5, F * 3.3);
    twist(g, curve([kx, ky], [F * 0.78, tail * 0.5], [F * 0.4, tail]), 3.6, twine);
    tassel(g, F * 0.4, tail, twine);
    // A small brass bell on a cord off the coil.
    bell(g, F * 0.2, F * 1.05, F * 1.95, twine);
    // A coil of the cord at the corner, turned three ways, and the knot binding it.
    for (const [rot, rx, ry] of [[0.2, 0.62, 0.36], [1.25, 0.58, 0.34], [2.3, 0.55, 0.32]]) twist(g, ellipsePts(kx, ky, F * rx, F * ry, rot), 3.2, twine);
    barrel(g, kx, ky, F * 0.2, twine);
    // A brass grommet low on the left, and wheat caught in the roll on the right.
    grommet(g, F * 0.48, h * 0.7, F * 0.24);
    wheat(g, R, w - F * 0.22, h * 0.64, F * 3.2);
  },

  /*
   * A store: a crate of pale planed planks, one along each side with its
   * edges rounded, butted into dovetailed corner blocks pinned with brass;
   * brass hasps along the bars, a brass bar handle standing out on the right,
   * a sprig burnt into the middle of the top and bottom, and ivy grown over
   * its corners and down its sides, flowering, with moss where it is damp.
   */
  crate(g, w, h, F, R) {
    const wood = H('#e7cc9c'), block = H('#d6b47f'), burn = H('#94643c');
    // The planks, between the corner blocks.
    eachSide(g, w, h, (sd) => {
      plank(g, R, F * 0.9, sd.len - F * 0.9, 1, F - 1, mix(shade(wood, 0.12), wood, sd.lit));
      // A sprig burnt into the middle of the top and the bottom.
      if (sd.i % 2 === 0 && sd.len > F * 9) burnt(g, sd.len / 2, F / 2, F, burn);
    });
    // The corner blocks, dovetailed, each pinned with a brass rivet.
    eachCorner(g, w, h, () => cornerBlock(g, R, F, block));
    // Brass hasps along the bars, and the handle on the right.
    eachSide(g, w, h, (sd) => {
      const at = sd.i === 1 ? [0.28] : sd.i === 3 ? [0.3, 0.72] : [0.24, 0.76];
      if (sd.len > F * 7) for (const t of at) hasp(g, sd.len * t, F * 0.5, F);
      if (sd.i === 1 && sd.len > F * 7) barHandle(g, sd.len * 0.56, F);
    });
    // Moss where it is damp: the corners, under the ivy.
    for (const [x, y] of [[F * 1.4, F * 0.55], [w - F * 1.6, F * 0.45], [F * 0.5, h - F * 1.4], [w - F * 0.5, h * 0.66], [w - F * 1.8, h - F * 0.5], [w * 0.62, F * 0.75]] as Pt[]) mossClump(g, R, x, y, F * 0.42);
    // Ivy over the corners and down the sides.
    // Each strand starts just past a corner block, so the dovetail and its rivet stay in sight.
    const vines: Array<[Pt, Pt, Pt]> = [
      [[F * 1.25, F * 0.2], [F * 2.6, F * 0.0], [Math.min(w * 0.3, F * 4.6), F * 0.25]],
      [[F * 0.2, F * 1.25], [F * -0.15, h * 0.22], [F * 0.3, Math.min(h * 0.46, h - F * 4)]],
      [[w - F * 0.2, F * 1.25], [w + F * 0.1, F * 3.2], [w - F * 0.25, Math.min(F * 6.5, h * 0.3)]],
      [[w - F * 1.25, F * 0.2], [w - F * 2.4, F * 0.0], [w - F * 3.6, F * 0.3]],
      [[w - F * 0.3, h * 0.66], [w + F * 0.1, h * 0.8], [w - F * 0.2, h - F * 1.3]],
      [[w - F * 1.3, h - F * 0.2], [w - F * 2.4, h + F * 0.05], [w - F * 3.8, h - F * 0.3]],
      [[F * 0.2, h - F * 1.3], [F * -0.1, h - F * 2.8], [F * 0.35, h - F * 4.6]],
      [[F * 1.3, h - F * 0.2], [F * 2.4, h + F * 0.05], [F * 3.8, h - F * 0.35]],
    ];
    vines.forEach(([a, c, b], k) => vine(g, R, curve(a, c, b), F, k % 3 !== 2));
  },

  /*
   * Crafting: a carpenter's frame of dark weathered beams, the sides run
   * full height and the top and bottom laid across them, bolted with iron
   * where they cross and along their length. A lantern hangs on its bracket
   * at the top left; a cloth and a chisel hang on pegs down the right; ivy
   * has grown over the corners and along the top, flowering.
   */
  bench(g, w, h, F, R) {
    const beamTone = H('#86603f'), dark = H('#6a4a32');
    // The sides, full height.
    for (const x of [0, w - F]) {
      g.save();
      g.translate(x + F, 0);
      g.rotate(Math.PI / 2);
      plank(g, R, -2, h + 2, 0.5, F - 0.5, mix(dark, beamTone, x === 0 ? 0.8 : 0.55));
      beamWear(g, R, h, F);
      g.restore();
    }
    // The top and bottom across them, their ends standing a little past the sides.
    for (const y of [0, h - F]) {
      plank(g, R, -3, w + 3, y + 0.5, y + F - 0.5, mix(dark, beamTone, y === 0 ? 1 : 0.6));
      g.save();
      g.translate(0, y);
      beamWear(g, R, w, F);
      g.restore();
    }
    // Bolts where they cross, and along each beam.
    for (const [x, y] of [[F * 0.3, F * 0.3], [F * 0.7, F * 0.7], [w - F * 0.3, F * 0.3], [w - F * 0.7, F * 0.7], [F * 0.3, h - F * 0.3], [F * 0.7, h - F * 0.7], [w - F * 0.3, h - F * 0.3], [w - F * 0.7, h - F * 0.7]] as Pt[]) head(g, x, y, F * 0.1, IRON.body, IRON.ink);
    for (let x = F * 2.4 + R() * 20; x < w - F * 2.4; x += 70 + R() * 40) for (const y of [F * 0.5, h - F * 0.5]) head(g, x, y, F * 0.09, IRON.body, IRON.ink);
    // Down the right: a cloth hung over a peg, and a chisel below it; no bolt goes where they or the lantern hang.
    const right = w - F * 0.5, hung = h > F * 10;
    const clothAt = h * 0.34, clothLen = h * 0.2, chiselAt = h * 0.62, chiselLen = F * 4.2;
    const behind = (y: number): boolean => hung && ((y > clothAt - F && y < clothAt + clothLen + F * 0.6) || (y > chiselAt - F && y < chiselAt + chiselLen));
    for (let y = F * 2.4 + R() * 20; y < h - F * 2.4; y += 80 + R() * 40) for (const x of [F * 0.5, w - F * 0.5]) if (x === F * 0.5 ? !(h > F * 6 && y < F * 3.5) : !behind(y)) head(g, x, y, F * 0.09, IRON.body, IRON.ink);
    if (hung) {
      drape(g, R, right + 2, clothAt, F, clothLen);
      hangChisel(g, right, chiselAt, F);
    }
    // The lantern at the top left, on its bracket, lit.
    if (h > F * 6) lantern(g, ...benchLamp(F), F);
    // Ivy over the corners and along the top, flowering.
    const vines: Array<[Pt, Pt, Pt]> = [
      [[F * 0.3, F * 0.3], [F * 2.2, F * -0.05], [Math.min(w * 0.22, F * 4.2), F * 0.3]],
      [[F * 0.25, F * 4.2], [F * -0.1, h * 0.35], [F * 0.3, Math.min(h * 0.55, h - F * 4)]],
      [[w * 0.6, F * 0.25], [w * 0.68, F * -0.1], [w * 0.76, F * 0.3]],
      [[w - F * 0.3, F * 0.3], [w - F * 1.8, F * -0.05], [w - F * 3.6, F * 0.3]],
      [[w - F * 0.3, F * 0.35], [w + F * 0.05, F * 1.6], [w - F * 0.2, F * 3]],
      [[F * 0.3, h - F * 0.3], [F * -0.1, h - F * 2.6], [F * 0.3, h - F * 4.6]],
      [[F * 0.35, h - F * 0.3], [F * 2.2, h + F * 0.05], [F * 4, h - F * 0.3]],
      [[w - F * 0.35, h - F * 0.3], [w - F * 2, h + F * 0.05], [w - F * 3.6, h - F * 0.3]],
    ];
    vines.forEach(([a, c, b]) => vine(g, R, curve(a, c, b), F, true));
  },

  /*
   * Skills: a doorway of pale stone and oak. A stone pillar runs down each
   * side with a capital and a base standing out past it and a band carved
   * round it, oak beams lie across the top and the bottom between them, and
   * an oak moulding runs round the content inside. Gold-set lavender stones
   * are let into the capitals, the bases, the pillars and the middle of each
   * beam; ivy flowering white and lavender climbs the pillars, a bunch of
   * flowers sits on the top right capital and a sprig of lavender by the
   * bottom right base.
   */
  runestone(g, w, h, F, R) {
    const P = F * 0.7, oak = H('#8d6142'), oakInk = H('#4f3322');
    // The oak moulding round the content.
    g.beginPath();
    g.roundRect(F * 0.4, F * 0.4, w - F * 0.8, h - F * 0.8, 6);
    g.roundRect(F - 1, F - 1, w - F * 2 + 2, h - F * 2 + 2, 5);
    const mould = g.createLinearGradient(0, 0, w, h);
    mould.addColorStop(0, css(light(oak, 0.12)));
    mould.addColorStop(1, css(shade(oak, 0.12)));
    g.fillStyle = mould;
    g.fill('evenodd');
    g.beginPath();
    g.roundRect(F - 2.5, F - 2.5, w - F * 2 + 5, h - F * 2 + 5, 5.5);
    g.strokeStyle = 'rgba(255, 232, 196, 0.45)';
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.roundRect(F - 1, F - 1, w - F * 2 + 2, h - F * 2 + 2, 5);
    g.strokeStyle = css(oakInk);
    g.lineWidth = 1.2;
    g.stroke();
    // The beams across the top and the bottom, between the pillars.
    plank(g, R, P - 4, w - P + 4, -1.5, F * 0.56, oak);
    plank(g, R, P - 4, w - P + 4, h - F * 0.56, h + 1.5, oak);
    // The pillars, each with its band a little below the middle.
    pillar(g, R, -2, P, 0, h, F, h * 0.62);
    pillar(g, R, w - P, w + 2, 0, h, F, h * 0.62);
    // Stones let into the shafts.
    if (h > F * 10) {
      gem(g, P / 2 - 1, h * 0.33, F * 0.2);
      gem(g, w - P / 2 + 1, h * 0.27, F * 0.2);
      gem(g, w - P / 2 + 1, h * 0.47, F * 0.2);
    }
    // The beams' stones: a small one at the top, set on the beam; a larger at the foot, on an oak boss with a sprig either side.
    gem(g, w / 2, F * 0.14, F * 0.42);
    // A plaque carved on the foot beam under it, dipping below the beam.
    g.save();
    g.beginPath();
    g.moveTo(w / 2 - F * 1.5, h - F * 0.56);
    g.quadraticCurveTo(w / 2 - F * 0.9, h - F * 0.56, w / 2 - F * 0.7, h - F * 0.9);
    g.quadraticCurveTo(w / 2, h - F * 1.15, w / 2 + F * 0.7, h - F * 0.9);
    g.quadraticCurveTo(w / 2 + F * 0.9, h - F * 0.56, w / 2 + F * 1.5, h - F * 0.56);
    g.lineTo(w / 2 + F * 1.2, h + 1);
    g.quadraticCurveTo(w / 2 + F * 0.5, h + 2, w / 2, h + 8);
    g.quadraticCurveTo(w / 2 - F * 0.5, h + 2, w / 2 - F * 1.2, h + 1);
    g.closePath();
    g.shadowColor = 'rgba(40, 26, 18, 0.4)';
    g.shadowBlur = 3;
    g.shadowOffsetY = 1.5;
    const boss = g.createLinearGradient(0, h - F * 1.1, 0, h + 8);
    boss.addColorStop(0, css(light(oak, 0.18)));
    boss.addColorStop(1, css(shade(oak, 0.2)));
    g.fillStyle = boss;
    g.fill();
    g.restore();
    g.strokeStyle = css(oakInk);
    g.lineWidth = 1.1;
    g.stroke();
    for (const sg of [-1, 1]) vine(g, R, curve([w / 2 + sg * F * 1.1, h - F * 0.3], [w / 2 + sg * F * 2, h - F * 0.62], [w / 2 + sg * F * 3, h - F * 0.26]), F * 0.9, true, [sg < 0 ? WHITE_PETAL : LILAC_PETAL]);
    gem(g, w / 2, h - F * 0.4, F * 0.46);
    // Ivy up the pillars and over the top right capital.
    const L = P / 2, Rx = w - P / 2;
    if (h > F * 8) {
      const lush = F * 1.2;
      vine(g, R, wander([L + 1, h - F * 1.2], [L - 7, h * 0.82], [L + 2, h * 0.74], [L + 8, h * 0.66], [L - 1, h * 0.56]), lush, true, [LILAC_PETAL, WHITE_PETAL]);
      vine(g, R, wander([L + 3, F * 1.2], [L - 7, F * 2.8], [L + 1, F * 4.6]), lush * 0.9, false);
      vine(g, R, wander([w - F * 1.1, F * 0.3], [w - F * 2.6, F * 0.95], [w - F * 4.4, F * 0.25]), lush * 0.85, true);
      vine(g, R, wander([Rx, F * 1.1], [Rx + 7, h * 0.12], [Rx - 2, h * 0.2], [Rx - 8, h * 0.26], [Rx + 1, h * 0.32]), lush, true, [WHITE_PETAL, LILAC_PETAL]);
      vine(g, R, wander([Rx - 1, h - F * 1.2], [Rx + 7, h * 0.86], [Rx - 1, h * 0.78], [Rx - 7, h * 0.72], [Rx + 1, h * 0.66]), lush, true);
      posy(g, R, w - F * 0.4, F * 0.5, F * 0.3, 4, LILAC_PETAL);
      posy(g, R, F * 0.45, h - F * 1.5, F * 0.28, 4);
      // Lavender standing up by the bottom right base.
      g.save();
      g.translate(w - F * 0.3, h - F * 1.2);
      g.scale(0.8, -0.8);
      lavender(g, R, 0, 0, F * 2.2);
      g.restore();
      blossom(g, w - F * 0.8, h - F * 1.4, F * 0.22);
    }
  },

  /*
   * Trades: four planks of weathered oak, the top and the foot across the
   * full width and the sides between them, a dark board round the content
   * inside, an iron plate with two brass rivets over each corner and an iron
   * band riveted across the planks beside it; a linen banner with the
   * window's crescent in gold hangs on a rope at the top left.
   */
  guild(g, w, h, F, R) {
    const oak = H('#8c6544'), P = F * 0.78;
    g.beginPath();
    g.rect(P - 2, P - 2, w - (P - 2) * 2, h - (P - 2) * 2);
    g.rect(F, F, w - F * 2, h - F * 2);
    g.fillStyle = css(H('#5e4330'));
    g.fill('evenodd');
    g.strokeStyle = css(H('#3e2b1e'));
    g.lineWidth = 1;
    g.strokeRect(F - 0.5, F - 0.5, w - F * 2 + 1, h - F * 2 + 1);
    // The sides, between the top and the foot.
    for (const x of [-1, w - P + 1]) {
      g.save();
      g.translate(x + P, P - 3);
      g.rotate(Math.PI / 2);
      plank(g, R, 0, h - P * 2 + 6, 0, P, shade(oak, 0.05));
      g.restore();
    }
    plank(g, R, -3, w + 3, -2, P, oak);
    plank(g, R, -3, w + 3, h - P, h + 2, oak);
    // Iron over the corners, and a band beside each along both planks.
    const s = P + 3, band = 7;
    eachCorner(g, w, h, () => {
      ironCorner(g, s);
      ironBand(g, s + band, P / 2 - 1, band, P - 4);
      ironBand(g, P / 2 - 1, s + band, P - 4, band);
    });
    if (h > F * 6) crescentBanner(g, R, -10, F - 3, F * 0.3, F * 3.6);
  },

  /*
   * Faith: white marble veined in grey and gold, edged in gold inside and
   * out; a pearl in a gold setting at each corner with gold scrollwork
   * growing from it along both sides; a larger pearl at the middle of the
   * top and the foot with a gold star either side; two small pearls along
   * the foot; and waves of aqua sea glass lying on the marble, curling away
   * from the middle pearls and along the sides from the corners.
   */
  altar(g, w, h, F, R) {
    // The marble, side by side, mitred at the corners.
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      const base = g.createLinearGradient(0, 0, 0, F);
      // The walls' own marble (masonry.ts), warmed a touch toward the slab inside.
      const warm = H('#f7f1e6');
      base.addColorStop(0, css(mix(mix(H(MARBLE.shade), warm, 0.4), mix(H(MARBLE.hi), warm, 0.4), s.lit)));
      base.addColorStop(0.5, css(mix(H(MARBLE.hi), warm, 0.5)));
      base.addColorStop(1, css(mix(mix(H(MARBLE.dark), warm, 0.3), mix(H(MARBLE.stone), warm, 0.3), s.lit)));
      g.fillStyle = base;
      g.fillRect(0, 0, s.len, F);
      // Clouds of grey in it.
      for (let k = 0; k < s.len / 26; k++) {
        const x = R() * s.len, y = R() * F, r = F * (0.5 + R());
        const c = g.createRadialGradient(x, y, 0, x, y, r);
        c.addColorStop(0, 'rgba(170, 176, 186, 0.22)');
        c.addColorStop(1, 'rgba(170, 176, 186, 0)');
        g.fillStyle = c;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Veins, grey and a few of gold, wandering along it.
      for (let k = 0; k < s.len / 22; k++) {
        const gold = R() < 0.3;
        let x = R() * s.len, y = R() * F;
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 6 + R() * 8; j++) {
          x += 5 + R() * 9;
          y = Math.max(1, Math.min(F - 1, y + (R() - 0.5) * 6));
          g.lineTo(x, y);
        }
        g.strokeStyle = gold ? 'rgba(200, 160, 80, 0.5)' : css(H(MARBLE.line), 0.3);
        g.lineWidth = gold ? 0.6 : 0.4 + R() * 0.4;
        g.stroke();
      }
      g.restore();
      // Gold along the outer edge and the inner.
      gilt(g, () => { g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(s.len - 1.5, 1.5); }, 1.2);
      gilt(g, () => { g.beginPath(); g.moveTo(F - 2, F - 2); g.lineTo(s.len - F + 2, F - 2); }, 1);
    });
    const mid = F * 0.56, wd = F * 0.46;
    // A wave and a lesser strand curling in step with it, a little inside it and behind.
    const waves = (x0: number, len: number, dir: 1 | -1, k: number): void => {
      wave(g, x0 + dir * F * 0.5, mid + F * 0.12, len * 0.62, dir, F * 0.13 * k, wd * 0.62 * k);
      wave(g, x0, mid - F * 0.04, len, dir, F * 0.2 * k, wd * k);
    };
    eachSide(g, w, h, (s) => {
      const top = s.i === 0 || s.i === 2;
      if (top) {
        // Waves curling away from the middle pearl, a lesser one under each.
        for (const dir of [1, -1] as const) waves(s.len / 2 + dir * F * 1.2, Math.min(F * 5.5, s.len * 0.24), dir, 1);
      }
      // Along the side from each corner, a wave rolling toward the middle of the side.
      if (s.len > F * 14) {
        // Clear of the corner's scrollwork, which runs F * 3 along.
        waves(F * 3.2, Math.min(F * 3.6, s.len * 0.14), 1, 0.85);
        if (!top) waves(s.len - F * 3.2, Math.min(F * 3.6, s.len * 0.14), -1, 0.85);
      }
    });
    // The corners: scrollwork along both sides, and the pearl over it.
    eachCorner(g, w, h, () => {
      scroll(g, F, false);
      scroll(g, F, true);
      pearl(g, F * 0.42, F * 0.42, F * 0.3);
    });
    // The middle of the top and the foot: a pearl with a gold star either side; two small pearls along the foot.
    eachSide(g, w, h, (s) => {
      if (s.i !== 0 && s.i !== 2) return;
      const x = s.len / 2;
      goldStar(g, x, F * 0.95, F * 0.32);
      pearl(g, x, F * 0.32, F * 0.36);
      for (const dx of [-1, 1]) goldStar(g, x + dx * F * 0.95, F * 0.36, F * 0.26);
      // Two small pearls at the foot, where its waves end.
      if (s.i === 2 && s.len > F * 16) for (const dx of [-1, 1]) pearl(g, x + dx * (F * 1.2 + Math.min(F * 5.5, s.len * 0.24) + F * 0.75), F * 0.5, F * 0.15);
    });
  },

  /*
   * The map: a band of pale stone marbled faintly in sky blue, rounded at
   * its corners, edged in gold outside with a finer line inside it and gold
   * round the content; a gold star burst on a pale lozenge over three
   * corners; a sky-blue pennant with gold stars down the right side under
   * the top right one and a lesser one at the bottom left; small gold stars
   * along the band; and ivy flowering white over the top left and bottom
   * right corners.
   */
  parchment(g, w, h, F, R) {
    const rr = 9;
    // The band.
    g.save();
    g.beginPath();
    g.roundRect(0, 0, w, h, rr);
    g.clip();
    const base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#f8f2e6');
    base.addColorStop(0.5, '#f3ecdd');
    base.addColorStop(1, '#efe6d4');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // Marbled faintly with sky: soft clouds and wandering veins, only in the band.
    eachSide(g, w, h, (s) => {
      for (let k = 0; k < s.len / 28; k++) {
        const x = R() * s.len, y = R() * F, r = F * (0.5 + R() * 0.9);
        const c = g.createRadialGradient(x, y, 0, x, y, r);
        c.addColorStop(0, 'rgba(160, 186, 210, 0.32)');
        c.addColorStop(1, 'rgba(160, 186, 210, 0)');
        g.fillStyle = c;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let k = 0; k < s.len / 30; k++) {
        let x = R() * s.len, y = 2 + R() * (F - 4);
        g.beginPath();
        g.moveTo(x, y);
        for (let j = 0; j < 5 + R() * 6; j++) {
          x += 6 + R() * 10;
          y = Math.max(2, Math.min(F - 2, y + (R() - 0.5) * 7));
          g.lineTo(x, y);
        }
        g.strokeStyle = css(SKY.deep, 0.3);
        g.lineWidth = 0.6;
        g.stroke();
      }
    });
    g.restore();
    // Gold: the outer edge, a finer line inside it, and round the content.
    const edge = (inset: number, r: number, wd: number): void => gilt(g, () => {
      g.beginPath();
      g.roundRect(inset, inset, w - inset * 2, h - inset * 2, r);
    }, wd);
    edge(1.2, rr - 1, 1.3);
    edge(4.5, rr - 4, 0.6);
    edge(F - 2, 4, 1);
    // Small gold stars along the band, and a lozenge at the middle of the foot.
    for (const t of [0.22, 0.7]) goldStar(g, w * t, F * 0.5, F * 0.3);
    for (const t of [0.2, 0.8]) goldStar(g, w * t, h - F * 0.5, F * 0.28);
    if (h > F * 10) {
      goldStar(g, F * 0.5, h * 0.42, F * 0.3);
      goldStar(g, w - F * 0.5, h * 0.62, F * 0.3);
    }
    g.save();
    g.translate(w / 2, h - F * 0.5);
    g.beginPath();
    g.moveTo(0, -F * 0.3);
    g.lineTo(F * 0.22, 0);
    g.lineTo(0, F * 0.3);
    g.lineTo(-F * 0.22, 0);
    g.closePath();
    g.fillStyle = goldFill(g, -F * 0.3, -F * 0.3, F * 0.3, F * 0.3);
    g.fill();
    g.strokeStyle = css(BRASS.ink, 0.8);
    g.lineWidth = 0.5;
    g.stroke();
    g.restore();
    // Ivy over the top left and the bottom right.
    if (h > F * 8) {
      const lush = F * 1.3;
      vine(g, R, curve([F * 0.3, F * 0.4], [F * 2.5, F * -0.15], [F * 5, F * 0.35]), lush, true);
      vine(g, R, curve([F * 0.35, F * 0.5], [F * -0.15, F * 3.5], [F * 0.35, F * 7]), lush, false);
      vine(g, R, curve([w - F * 0.4, h - F * 1.6], [w + F * 0.1, h - F * 4.5], [w - F * 0.35, h - F * 8]), lush, true);
      vine(g, R, curve([w - F * 1.6, h - F * 0.4], [w - F * 4, h + F * 0.1], [w - F * 7, h - F * 0.35]), lush, true);
    }
    // The pennants, then the star bursts over the corners.
    if (h > F * 10) {
      pennant(g, w - F * 0.5, F * 1.9, F * 0.75, F * 3.2);
      pennant(g, F * 0.5, h - F * 4.6, F * 0.6, F * 2.4);
    }
    starBurst(g, w - F * 0.45, F * 0.45, F * 0.95);
    starBurst(g, F * 0.45, h - F * 0.45, F * 0.85);
    starBurst(g, w - F * 0.45, h - F * 0.45, F * 0.85);
  },

  /*
   * The treasure map: old paper, torn and scorched round its outer edge and
   * browned toward it, rolled up at its top and bottom left, a cord bound
   * round the lower roll. A brass compass hangs from the upper roll with a
   * starred tag under it; a rope runs down the right from a brass stud to a
   * knot with a brass compass coin on it. On the band, in faint ink: a ship
   * on its sea, coasts, woods, peaks, dashed trails, two X's in red and a
   * compass rose at the bottom right, pinned through its middle by a stud.
   */
  treasure(g, w, h, F, R) {
    const edge = tornOutline(R, w, h, 4.5);
    const outline = (): void => {
      g.beginPath();
      edge.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    };
    g.save();
    outline();
    g.clip();
    const face = g.createLinearGradient(0, 0, w, h);
    face.addColorStop(0, css(OLD_PAPER.lit));
    face.addColorStop(0.55, css(OLD_PAPER.body));
    face.addColorStop(1, css(mix(OLD_PAPER.body, OLD_PAPER.deep, 0.45)));
    g.fillStyle = face;
    g.fillRect(0, 0, w, h);
    // Foxing: soft brown stains here and there.
    eachSide(g, w, h, (s) => {
      for (let k = 0; k < s.len / 40; k++) {
        const x = R() * s.len, y = R() * F, r = 3 + R() * 8;
        const st = g.createRadialGradient(x, y, 0, x, y, r);
        st.addColorStop(0, css(OLD_PAPER.deep, 0.35));
        st.addColorStop(1, css(OLD_PAPER.deep, 0));
        g.fillStyle = st;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    // Browned toward the torn edge, and scorched at it.
    for (let k = 0; k < 10; k++) {
      outline();
      g.strokeStyle = css(OLD_PAPER.burn, 0.045);
      g.lineWidth = 22 - k * 2;
      g.stroke();
    }
    outline();
    g.strokeStyle = css(OLD_PAPER.burn, 0.4);
    g.lineWidth = 3;
    g.stroke();
    // The map, in faint ink.
    shallows(g, R, F * 0.5, h * 0.47, F * 0.62, F * 1.6);
    inkShip(g, F * 0.48, h * 0.47, F * 0.68);
    woods(g, F * 0.3, h * 0.3, F * 0.5, 2);
    peaks(g, F * 0.28, h * 0.7, F * 0.42, 2);
    trail(g, [[F * 0.5, h * 0.33], [F * 0.7, h * 0.37], [F * 0.42, h * 0.41]]);
    trail(g, [[F * 0.55, h * 0.56], [F * 0.3, h * 0.62], [F * 0.55, h * 0.66]]);
    peaks(g, w * 0.24, F * 0.72, F * 0.46, 3);
    trail(g, [[w * 0.24 + F * 1.8, F * 0.55], [w * 0.31, F * 0.28], [w * 0.36, F * 0.62], [w * 0.4 - F * 0.4, F * 0.5]]);
    redX(g, w * 0.4, F * 0.5, F * 0.17);
    shallows(g, R, w * 0.66, F * 0.4, F * 2, F * 0.42);
    woods(g, w * 0.82, F * 0.78, F * 0.5, 3);
    woods(g, w - F * 0.62, h * 0.5, F * 0.48, 2);
    trail(g, [[w - F * 0.45, h * 0.52], [w - F * 0.7, h * 0.56], [w - F * 0.5, h * 0.6 - F * 0.35]]);
    redX(g, w - F * 0.5, h * 0.6, F * 0.17);
    shallows(g, R, w - F * 0.5, h * 0.74, F * 0.5, F * 1.3);
    woods(g, w * 0.22, h - F * 0.2, F * 0.5, 2);
    shallows(g, R, w * 0.48, h - F * 0.5, F * 2.2, F * 0.42);
    peaks(g, w * 0.7, h - F * 0.24, F * 0.44, 3);
    trail(g, [[w * 0.7 + F * 1.8, h - F * 0.5], [w * 0.82, h - F * 0.72], [w - F * 1.5, h - F * 0.4]]);
    inkRose(g, w - F * 0.55, h - F * 0.55, F);
    g.restore();
    outline();
    g.strokeStyle = css(shade(OLD_PAPER.burn, 0.3));
    g.lineWidth = 1.1;
    g.stroke();
    // The window's own edge, a line in from it.
    g.strokeStyle = css(OLD_PAPER.deep, 0.8);
    g.lineWidth = 0.8;
    g.strokeRect(F - 3.5, F - 3.5, w - F * 2 + 7, h - F * 2 + 7);
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.strokeRect(F - 0.5, F - 0.5, w - F * 2 + 1, h - F * 2 + 1);
    // The rope down the right, from its stud to the knot, and the coin on it.
    const sx = w - F * 0.5, ky = Math.min(h * 0.3, F * 6);
    twist(g, curve([sx, F * 0.5], [sx - 3, (F * 0.5 + ky) / 2], [sx, ky]), 3.6, CORD);
    const cy = ky + F * 1.15;
    twist(g, curve([sx, ky], [sx + 1, ky + F * 0.3], [sx, cy - F * 0.42]), 1.4, CORD);
    bail(g, sx, cy - F * 0.42, 2.2);
    brassCompass(g, sx, cy, F * 0.4, true);
    knot(g, sx, ky, 4.6, 2.8);
    head(g, sx, F * 0.5, F * 0.17, BRASS.body, BRASS.ink);
    head(g, w - F * 0.55, h - F * 0.55, F * 0.15, BRASS.body, BRASS.ink);
    // The rolls at the left, a cord round the lower, and the compass on its cord from the upper.
    const mx = F * 0.48, my = F * 2.5, mr = F * 0.56, ry = F * 0.24, rt = F * 0.66, x0 = -FRAME_REACHES.treasure! + 3;
    twist(g, curve([F * 0.62, ry + rt * 0.3], [F * 0.36, F * 1.3], [mx, my - mr - 2]), 1.8, CORD);
    paperRoll(g, x0, F * 2.6, ry, rt);
    paperRoll(g, x0, F * 2.6, h - ry, rt);
    const wrap = (k: number): number => F * 0.35 + k * F * 0.36;
    for (let k = 0; k < 3; k++) twist(g, [[wrap(k) - 2.2, h - ry - rt / 2], [wrap(k) + 2.2, h - ry + rt / 2]], 2.2, CORD);
    const end: Pt = [F * 3.3, h - ry + rt * 0.1];
    twist(g, curve([wrap(2) + 2.2, h - ry + rt / 2], [F * 2.1, h - ry + rt * 0.75], end), 2.2, CORD);
    g.save();
    g.translate(end[0], end[1]);
    g.rotate(-Math.PI / 2 - 0.25);
    tassel(g, 0, 0, CORD);
    g.restore();
    bail(g, mx, my - mr - 1.5, 2.4);
    brassCompass(g, mx, my, mr, false);
    twist(g, [[mx, my + mr], [mx + 0.5, my + mr + F * 0.32]], 1, CORD);
    starTag(g, mx + 0.5, my + mr + F * 0.3, F * 0.52, F * 0.68);
  },

  /*
   * The market: a stall of weathered timber, a post up each side capped in
   * brass and a beam across the top and the foot, lashed with cord. Under the
   * top beam a green and cream awning swagged to a gold-trimmed scallop. On
   * the left post the market's banner, the scales, and ivy flowering white
   * down it; a barrel and a crate with a
   * striped cloth at its foot. A cloth hung over the right post, and crates,
   * a sack and a bottle at its foot among flowering ivy.
   */
  stall(g, w, h, F, R) {
    const wood = STALL_WOOD, top = -F * 0.45;
    fillBand(g, w, h, F, css(shade(wood, 0.45)));
    plank(g, R, -4, w + 4, top, F * 0.1, wood);
    awning(g, F * 0.85, w - F * 0.85, F * 0.02, F * 0.9, F);
    post(g, R, 0, F * 0.92, top, h, wood);
    post(g, R, w - F * 0.92, w, top, h, wood);
    plank(g, R, -4, w + 4, h - F * 0.68, h + 2, shade(wood, 0.05));
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.strokeRect(F - 0.5, F - 0.5, w - F * 2 + 1, h - F * 2 + 1);
    finial(g, F * 0.46, top, F * 0.55);
    finial(g, w - F * 0.46, top, F * 0.55);
    // Lashings: the beam to each post, and round the posts below.
    for (const x of [0, w - F * 0.92]) lashing(g, x, x + F * 0.92, top + F * 0.12, 3);
    lashing(g, 0, F * 0.92, h * 0.64, 3);
    lashing(g, w - F * 0.92, w, h * 0.66, 3);
    // The right post: the cloth over it, tied on.
    hungCloth(g, w - F * 0.78, w + F * 0.28, F * 0.55, Math.min(h * 0.45, F * 8));
    lashing(g, w - F * 0.82, w + F * 0.2, F * 1.6, 3);
    // The left post: banner, ivy.
    marketBanner(g, -F * 0.62, F * 0.9, F * 0.95, F * 4);
    vine(g, R, wander([F * 0.85, F * 5.3], [F * 0.5, h * 0.55], [F * 0.8, h * 0.68], [F * 0.45, h * 0.8], [F * 0.75, h - F * 1.7]), F, true);
    // The foot of the left post: a barrel, and a crate with a cloth over it.
    standingBarrel(g, -F * 0.18, h + 8, F * 1.5, F * 2.0, H(WOOD_TONE.oak));
    crate(g, R, F * 0.45, h - F * 0.98, F * 2.9, h + 8, H('#a98a5c'));
    throwCloth(g, F * 0.7, h - F * 1.0, F * 0.95, F * 1.0);
    flowerClump(g, R, F * 0.45, h - F * 0.95, F * 0.7, F);
    // The foot of the right post: crates, a sack and a bottle, and ivy.
    vine(g, R, wander([w - F * 0.2, h - F * 2.2], [w - F * 0.6, h - F * 3.4], [w - F * 0.35, h - F * 4.4]), F, true);
    crate(g, R, w - F * 0.9, h - F * 2.25, w + F * 0.65, h - F * 0.98, H('#a98a5c'));
    crate(g, R, w - F * 1.7, h - F * 0.98, w + F * 0.6, h + 8, H('#9c7c52'));
    flowerClump(g, R, w - F * 0.95, h - F * 2.25, F * 0.7, F);
    sackOf(g, w - F * 2.15, h + 8, F * 1.3, F * 1.25);
    bottle(g, w - F * 3.1, h + 6, F * 0.6, F * 1.15);
  },

  /*
   * The event log: a band of white marble clouded in pale blue and veined
   * in gold, edged in gold; a square pillar of it up each side on a stepped
   * base under a stepped capital, a gold star near its head and a gold
   * scroll under that. Over the middle of the top an arch of the marble
   * with the great gold star on a round of blue, gold scrolls off its feet;
   * at the middle of the foot a crystal star in a gold lozenge, scrolls
   * either side of it.
   */
  scroll(g, w, h, F, R) {
    const px = F * 0.12;
    // The top and the foot, between the pillars.
    for (const y of [0, h - F]) {
      marbleShape(g, R, () => {
        g.beginPath();
        g.rect(F * 0.9, y, w - F * 1.8, F);
      }, F * 0.9, y, w - F * 0.9, y + F, F, 1);
      gilt(g, () => {
        g.beginPath();
        g.moveTo(F, y === 0 ? F * 0.2 : h - F * 0.2);
        g.lineTo(w - F, y === 0 ? F * 0.2 : h - F * 0.2);
      }, 0.6);
    }
    crest(g, R, w / 2, F);
    // The foot's middle: the crystal star, scrolls off either side.
    for (const dir of [-1, 1] as const) giltScroll(g, w / 2 + dir * F * 0.75, h - F * 0.5, F * 2.4, dir, F, -1);
    crystalStar(g, w / 2, h - F * 0.42, F * 0.82);
    // The pillars, their capitals and bases, a star and a scroll at the head of each.
    for (const [x0, x1] of [[-px, F], [w - F, w + px]]) {
      const cx = (x0 + x1) / 2, wd = x1 - x0;
      marblePillar(g, R, x0, x1, F * 0.12, h - F * 0.12, F);
      plinthAt(g, R, cx, F * 0.12, wd * 1.05, F, true);
      plinthAt(g, R, cx, h - F * 0.12, wd * 1.05, F, false);
      if (h > F * 6) {
        goldStar8(g, cx, F * 1.7, F * 0.72);
        const inner = x0 < w / 2 ? x1 - 3 : x0 + 3, dir = x0 < w / 2 ? -1 : 1;
        gilt(g, () => {
          g.beginPath();
          g.moveTo(cx, F * 2.25);
          g.bezierCurveTo(inner, F * 2.6, inner + dir * F * 0.05, F * 3.3, cx + dir * F * 0.05, F * 3.9);
          g.arc(cx + dir * F * 0.05 + F * 0.14 * -dir, F * 3.95, F * 0.14, dir > 0 ? 0 : Math.PI, dir > 0 ? Math.PI * 1.6 : -Math.PI * 0.6, dir < 0);
        }, 1.1);
      }
    }
    // Gold round the content.
    gilt(g, () => {
      g.beginPath();
      g.rect(F - 1.5, F - 1.5, w - F * 2 + 3, h - F * 2 + 3);
    }, 0.9);
  },

  /*
   * The journal: a book bound in brown leather, stitched round its cover.
   * Down the left its spine, rounded and standing out past the cover, raised
   * bands across it edged in gold, gold stars and a tooled flourish between
   * them. Down the right and along the foot the edges of its pages; brass
   * caps with a gold star on the right-hand corners; a strap over the right
   * edge with a gold star stud, and a blue ribbon marking the page hanging
   * from under it.
   */
  book(g, w, h, F, R) {
    // The cover.
    g.save();
    g.beginPath();
    g.roundRect(0, 0, w + F * 0.12, h, [2, 6, 6, 2]);
    g.clip();
    hide(g, R, 0, 0, w + F * 0.12, h, F);
    g.restore();
    g.beginPath();
    g.roundRect(0.5, 0.5, w + F * 0.12 - 1, h - 1, [2, 6, 6, 2]);
    g.strokeStyle = css(HIDE.deep);
    g.lineWidth = 1;
    g.stroke();
    // The pages' edges inside it, down the right and along the foot.
    pageEdges(g, w - F * 0.72, F * 0.55, w - F * 0.14, h - F * 0.3, 'y');
    pageEdges(g, F, h - F * 0.72, w - F * 0.14, h - F * 0.3, 'x');
    // The stitching round the cover.
    stitches(g, F, w - F * 0.8, F * 0.28, LEAVES.body, 3, 2.4);
    stitches(g, F, w - F * 0.8, h - F * 0.14, LEAVES.body, 3, 2.4);
    // A gold line round the page, just inside the cover.
    gilt(g, () => {
      g.beginPath();
      g.rect(F - 2.5, F - 2.5, w - F * 2 + 5, h - F * 2 + 5);
    }, 0.8);
    // The brass caps on the right-hand corners.
    eachCorner(g, w, h, (i) => { if (i === 1 || i === 2) brassCorner(g, F); });
    // The strap and the ribbon under it.
    if (h > F * 8) {
      const sy = Math.max(F * 2.6, h * 0.24), sh = F * 1.3;
      ribbonMark(g, w + F * 0.42, sy + sh * 0.5, F * 0.85, Math.min(h * 0.32, F * 7));
      claspStrap(g, R, w - F * 0.75, w + F * 0.75, sy, sh, F);
    }
    // The spine.
    spine(g, R, -F * 0.72, F * 0.92, -F * 0.28, h + F * 0.28, F);
  },

  /* The news: a notice board, pinned all round. */
  noticeboard(g, w, h, F, R) {
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      planks(g, R, s.len, 0, F, WOOD.pine, s.lit);
      g.restore();
      // Scraps of paper pinned along it, and the pins.
      const pins = ['#c9574a', '#4f7ab8', '#e0b23e', '#5f9a5f'];
      for (let x = F * 2 + R() * 10; x < s.len - F * 2; x += 46 + R() * 30) {
        g.save();
        g.translate(x, F * 0.55);
        g.rotate((R() - 0.5) * 0.4);
        g.fillStyle = css(light(PARCH, 0.3));
        g.fillRect(-F * 0.5, -F * 0.35, F, F * 0.6);
        g.strokeStyle = css(shade(PARCH, 0.4), 0.8);
        g.lineWidth = 0.6;
        g.strokeRect(-F * 0.5, -F * 0.35, F, F * 0.6);
        g.restore();
        head(g, x, F * 0.35, F * 0.15, H(pins[Math.floor(R() * pins.length)]), STONE_INK);
      }
    });
    inkBand(g, w, h, F);
    eachCorner(g, w, h, (i) => head(g, F * 0.5, F * 0.5, F * 0.18, H(['#c9574a', '#4f7ab8', '#e0b23e', '#5f9a5f'][i]), STONE_INK));
  },

  /* Social: a letter's paper, tied round with twine, sealed at a corner in red wax. */
  letter(g, w, h, F, R) {
    paper(g, w, h, F, R, light(PARCH, 0.25), 1.2, false);
    const twine = H('#a5824f');
    eachSide(g, w, h, (s) => rope(g, F * 0.2, s.len - F * 0.2, F * 0.5, F * 0.16, twine));
    // The seal at the top right: wax spread round a stamped ring.
    g.save();
    g.translate(w - F * 0.9, F * 0.9);
    g.beginPath();
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = F * (0.98 + (k % 2) * 0.1);
      if (k) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(r, 0);
    }
    g.fillStyle = css(SEAL);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, F * 0.55, 0, Math.PI * 2);
    g.strokeStyle = css(shade(SEAL, 0.4));
    g.lineWidth = 1.2;
    g.stroke();
    g.beginPath();
    g.arc(-F * 0.2, -F * 0.25, F * 0.22, 0, Math.PI * 2);
    g.fillStyle = css(light(SEAL, 0.4), 0.7);
    g.fill();
    g.scale(1, -1);
    strokesPath(g, roundelStrokes('crown').slice(2), 0, 0, F * 0.48);
    g.strokeStyle = css(shade(SEAL, 0.5));
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
  },

  /* The settlement: a palisade, its stakes 8 px thick and pointed outward, lashed with rope, a post at each corner. */
  palisade(g, w, h, F, R) {
    const bark = H(LOG.side), lit = H(LOG.top), cutEnd = H(LOG.grain), line = H(LOG.line);
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F, FRAME_REACH);
      g.clip();
      // Stakes, 8 px thick, set side by side, each sharpened to a point standing past the edge.
      const sw = 8;
      for (let x = F - sw * 0.5; x < s.len - F + sw * 0.5; x += sw) {
        const t = mix(bark, lit, R() * 0.35);
        const c = mix(shade(t, 0.2), t, s.lit);
        const tip = -FRAME_REACH + 0.6 + R() * 0.8;
        g.beginPath();
        g.moveTo(x, F);
        g.lineTo(x, 2.5);
        g.lineTo(x + sw / 2, tip);
        g.lineTo(x + sw, 2.5);
        g.lineTo(x + sw, F);
        g.closePath();
        g.fillStyle = css(c);
        g.fill();
        // Round: lit down one side, in the shade down the other.
        g.fillStyle = css(light(c, 0.3), 0.8);
        g.fillRect(x + 1, 3, 1.6, F - 3);
        g.fillStyle = css(shade(c, 0.3), 0.7);
        g.fillRect(x + sw - 2.4, 3, 1.6, F - 3);
        // The point, cut fresh and pale.
        g.beginPath();
        g.moveTo(x + 0.6, 2.5);
        g.lineTo(x + sw / 2, tip);
        g.lineTo(x + sw / 2, 3.6);
        g.closePath();
        g.fillStyle = css(cutEnd);
        g.fill();
        g.beginPath();
        g.moveTo(x, F);
        g.lineTo(x, 2.5);
        g.lineTo(x + sw / 2, tip);
        g.lineTo(x + sw, 2.5);
        g.lineTo(x + sw, F);
        g.strokeStyle = css(line);
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
      // Lashed together by a rope across them.
      rope(g, F, s.len - F, F * 0.62, 2.6, H('#c9ad7c'));
    });
    // A post at each corner, its end grain to the eye: rings round a pith.
    eachCorner(g, w, h, () => {
      const r = F * 0.62;
      g.beginPath();
      g.arc(F * 0.5, F * 0.5, r, 0, Math.PI * 2);
      g.fillStyle = css(bark);
      g.fill();
      g.strokeStyle = css(line);
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.arc(F * 0.5, F * 0.5, r - 1.6, 0, Math.PI * 2);
      g.fillStyle = css(cutEnd);
      g.fill();
      g.strokeStyle = css(H(LOG.ring));
      g.lineWidth = 0.8;
      for (const k of [0.3, 0.6]) {
        g.beginPath();
        g.arc(F * 0.5, F * 0.5, (r - 1.6) * k, 0, Math.PI * 2);
        g.stroke();
      }
    });
  },

  /* The wildermon: woven willow, rows over and under upright stakes, a coiled rim round the edge. */
  wicker(g, w, h, F, R) {
    const straw = H(WOOD_TONE.willow), rod = shade(H(WOOD_TONE.willow), 0.15);
    eachSide(g, w, h, (s) => {
      const c = mix(shade(straw, 0.15), straw, s.lit);
      g.save();
      mitre(g, s.len, F);
      g.clip();
      g.fillStyle = css(shade(c, 0.55));
      g.fillRect(0, 0, s.len, F);
      // Under and over: rows of willow 3.5 px high woven through upright stakes 8 px apart, each row a stake out of step with the last.
      const top = 5, rh = 3.5, step = 8;
      for (let r2 = 0; top + r2 * rh < F; r2++) {
        const y = top + r2 * rh;
        for (let x = -step + (r2 % 2) * step; x < s.len + step; x += step * 2) {
          // Over a stake: the willow, round, lit along its top.
          g.beginPath();
          g.roundRect(x + 0.4, y + 0.3, step * 2 - 0.8, rh - 0.6, rh / 2);
          g.fillStyle = css(mix(c, light(c, 0.25), R() * 0.6));
          g.fill();
          g.strokeStyle = css(shade(c, 0.5));
          g.lineWidth = 0.7;
          g.stroke();
          g.fillStyle = css(light(c, 0.5), 0.8);
          g.fillRect(x + 2, y + 0.9, step * 2 - 4, 0.7);
        }
        // The stakes showing where the willow passes behind them.
        for (let x = (r2 % 2 ? step : 0) + step; x < s.len; x += step * 2) {
          g.fillStyle = css(mix(shade(rod, 0.1), rod, s.lit));
          g.fillRect(x - 1.3, y, 2.6, rh);
          g.strokeStyle = css(shade(rod, 0.5));
          g.lineWidth = 0.6;
          g.strokeRect(x - 1.3, y, 2.6, rh);
        }
      }
      g.restore();
      // The rim: a thick coil of willow bound round the edge.
      rope(g, 0, s.len, 2.4, 4, light(straw, 0.05));
    });
    inkBand(g, w, h, F);
  },

  /* The field guide: worn leather, scuffed, stitched, with flowers pressed flat at its corners. */
  fieldbook(g, w, h, F, R) {
    const hide = H('#a9805c');
    leatherBand(g, w, h, F, hide, R);
    eachSide(g, w, h, (s) => {
      // Scuffs, paler where it has been handled, and a stitched edge.
      for (let k = 0; k < s.len / 40; k++) {
        g.beginPath();
        g.ellipse(F + R() * (s.len - F * 2), F * (0.3 + R() * 0.4), 5 + R() * 8, 1.6 + R() * 1.6, 0, 0, Math.PI * 2);
        g.fillStyle = css(light(hide, 0.35), 0.45);
        g.fill();
      }
      stitches(g, F * 0.4, s.len - F * 0.4, 2.6, LINEN, 3, 3);
    });
    // Flowers pressed flat at three corners, each on its stem with two leaves: five petals round an eye, 6 px a petal.
    const pressed = (x: number, y: number, a: number, petal: RGB): void => {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(F * 0.8, F * 0.15, F * 1.9, -F * 0.05);
      g.strokeStyle = css(H('#4b6c57'));
      g.lineWidth = 1.2;
      g.stroke();
      for (const [lx, sg] of [[F * 0.9, 1], [F * 1.45, -1]]) {
        g.beginPath();
        g.ellipse(lx, sg * F * 0.16, F * 0.3, F * 0.12, sg * 0.5, 0, Math.PI * 2);
        g.fillStyle = css(H('#7fa36c'));
        g.fill();
        g.strokeStyle = css(H('#4b6c57'));
        g.lineWidth = 0.7;
        g.stroke();
      }
      for (let k = 0; k < 5; k++) {
        const pa = (k / 5) * Math.PI * 2;
        g.beginPath();
        g.ellipse(Math.cos(pa) * 3.1, Math.sin(pa) * 3.1, 3.1, 2, pa, 0, Math.PI * 2);
        g.fillStyle = css(petal);
        g.fill();
        g.strokeStyle = css(shade(petal, 0.5));
        g.lineWidth = 0.7;
        g.stroke();
      }
      g.beginPath();
      g.arc(0, 0, 1.5, 0, Math.PI * 2);
      g.fillStyle = css(H('#e8c25a'));
      g.fill();
      g.strokeStyle = css(H('#9a7a2c'));
      g.lineWidth = 0.6;
      g.stroke();
      g.restore();
    };
    pressed(F * 0.5, F * 0.5, 0.15, H('#c9a7d8'));
    pressed(w - F * 0.5, h - F * 0.5, Math.PI + 0.15, H('#9fbadf'));
    pressed(w - F * 0.5, F * 0.5, Math.PI / 2 + 0.1, H('#eaa8b4'));
    void R;
  },

  /* The leaderboards: carved cherry, a cove and a bead along it, sprays of laurel out of each corner and a gilt rosette over it. */
  laurel(g, w, h, F, R) {
    const wood = WOOD.cherry;
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      const c = mix(shade(wood, 0.25), wood, s.lit);
      g.fillStyle = css(c);
      g.fillRect(0, 0, s.len, F);
      grain(g, R, 0, s.len, 1, F - 1, c, false);
      // Carved: a cove along the outside and a bead along the inside.
      cut(g, c, 1.2, () => { g.beginPath(); g.moveTo(0, 3); g.lineTo(s.len, 3); });
      cut(g, c, 1.2, () => { g.beginPath(); g.moveTo(0, F - 3); g.lineTo(s.len, F - 3); });
      g.restore();
      g.strokeStyle = css(shade(wood, 0.5), 0.7);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(F, F);
      g.stroke();
      // A spray of laurel out of each corner along the side, a third of its length or 70 px at most.
      sprig(g, F * 0.8, Math.min(s.len * 0.3, 70), F * 0.5);
      sprig(g, s.len - F * 0.8, -Math.min(s.len * 0.3, 70), F * 0.5);
    });
    inkBand(g, w, h, F);
    // A gilt rosette over each corner where the sprays start.
    eachCorner(g, w, h, () => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.beginPath();
        g.ellipse(F * 0.5 + Math.cos(a) * 2.2, F * 0.5 + Math.sin(a) * 2.2, 2, 1.3, a, 0, Math.PI * 2);
        g.fillStyle = css(light(GOLD, 0.15));
        g.fill();
        g.strokeStyle = css(shade(GOLD, 0.55));
        g.lineWidth = 0.6;
        g.stroke();
      }
      head(g, F * 0.5, F * 0.5, 1.6, GOLD, shade(GOLD, 0.55));
    });
  },

  /* How you look: a gilded mirror frame, mitred, beaded inside, a shell at each corner. */
  mirror(g, w, h, F, R) {
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      const gr = g.createLinearGradient(0, 0, 0, F);
      gr.addColorStop(0, css(shade(GOLD, 0.25)));
      gr.addColorStop(0.4, css(light(GOLD, 0.35 * s.lit)));
      gr.addColorStop(1, css(shade(GOLD, 0.35)));
      g.fillStyle = gr;
      g.fillRect(0, 0, s.len, F);
      for (let x = 2; x < s.len; x += 4) head(g, x, F - 2.6, 1.1, light(GOLD, 0.2), shade(GOLD, 0.55));
      g.restore();
      g.strokeStyle = css(shade(GOLD, 0.6));
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(F, F);
      g.stroke();
    });
    eachCorner(g, w, h, () => {
      g.save();
      g.translate(F * 0.45, F * 0.45);
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.ellipse(0, 0, F * 0.48, F * 0.13, Math.PI / 4 + (k - 2) * 0.32, 0, Math.PI * 2);
        g.fillStyle = css(light(GOLD, 0.25 + k * 0.05));
        g.fill();
        g.strokeStyle = css(shade(GOLD, 0.55));
        g.lineWidth = 0.6;
        g.stroke();
      }
      g.restore();
    });
    inkBand(g, w, h, F);
    void R;
  },

  /* The tile: turf, sod round its edge and grass standing off the top, over a cut of the soil with roots and pebbles in it, moss at two corners. */
  turf(g, w, h, F, R, o) {
    const soil = H('#9b7b5e'), dark = H('#7d614b'), grass = H('#8fbf7a'), deep = H('#5f8a6c');
    eachSide(g, w, h, (s) => {
      const top = s.i === 0;
      g.save();
      mitre(g, s.len, F);
      g.clip();
      g.fillStyle = css(mix(shade(soil, 0.2), soil, s.lit));
      g.fillRect(0, 0, s.len, F);
      // Darker earth deeper in, and roots threading down through it.
      g.fillStyle = css(dark, 0.55);
      g.fillRect(0, F * 0.65, s.len, F * 0.35);
      g.strokeStyle = css(shade(soil, 0.45), 0.7);
      g.lineWidth = 0.7;
      for (let x = 3; x < s.len; x += 5 + R() * 6) {
        g.beginPath();
        g.moveTo(x, top ? F * 0.4 : 0);
        g.quadraticCurveTo(x + (R() - 0.5) * 5, F * 0.6, x + (R() - 0.5) * 4, F * (0.7 + R() * 0.25));
        g.stroke();
      }
      // Pebbles in the earth, 2 to 5 px.
      for (let k = 0; k < s.len / 10; k++) {
        const x = R() * s.len, y = F * ((top ? 0.5 : 0.25) + R() * 0.45), r = 1 + R() * 1.5;
        g.beginPath();
        g.ellipse(x, y, r * 1.3, r, R(), 0, Math.PI * 2);
        g.fillStyle = css(mix(H('#d3cbbd'), H('#a39a8c'), R()));
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 0.6;
        g.stroke();
      }
      // Sod along every outer edge, deepest along the top.
      const sod = top ? F * 0.42 : 3;
      g.fillStyle = css(mix(deep, grass, s.lit));
      g.fillRect(0, 0, s.len, sod);
      g.fillStyle = css(deep);
      g.fillRect(0, sod - 1, s.len, 1);
      g.restore();
      // Grass standing up off the top and out past the edge, no further than the frame may reach.
      if (top) {
        g.lineCap = 'round';
        for (let x = 2; x < s.len - 2; x += 1.6 + R() * 2.2) {
          const tall = 3 + R() * (FRAME_REACH + F * 0.2 - 3.5), lean = (R() - 0.5) * 3;
          g.beginPath();
          g.moveTo(x, sod);
          g.quadraticCurveTo(x, sod - tall * 0.6, Math.max(-FRAME_REACH + 0.5, x + lean), Math.max(-FRAME_REACH + 0.6, sod - tall - F * 0.2));
          g.strokeStyle = css(R() < 0.5 ? deep : mix(grass, deep, 0.3));
          g.lineWidth = 1.3;
          g.stroke();
        }
      }
    });
    // A cushion of moss at two corners (`drawPads`), and a tuft of grass by each.
    const pads: Pad[] = [];
    for (const [cx, cy] of [[F * 0.6, F * 0.75], [w - F * 0.6, h - F * 0.55]] as Pt[]) {
      for (let k = 0; k < 8; k++) {
        const r = cushion(R) * 1.2 + 0.8;
        pads.push([cx + (R() - 0.5) * F * 0.8, cy + (R() - 0.5) * F * 0.6, r, r * 0.65]);
      }
    }
    drawPads(g, pads.sort((a, b) => a[1] - b[1]));
    grassTuft(g, w - F * 0.4, h - F * 0.3, (o.seed + 5) | 0, F / 16);
    inkBand(g, w, h, F);
  },

  /* The tracker: a knotted rope all round, a tally knot every 30 to 42 px, the ropes lashed at each corner. */
  rope(g, w, h, F, R) {
    const hemp = H('#cdb07e');
    paperBack(g, w, h, F, light(LINEN, 0.1));
    eachSide(g, w, h, (s) => {
      rope(g, F * 0.5, s.len - F * 0.5, F * 0.5, F * 0.4, hemp);
      // A tally knot every 30 to 42 px: the rope tied back on itself, a fat barrel of turns.
      for (let x = F * 2 + R() * 10; x < s.len - F * 2; x += 30 + R() * 12) barrel(g, x, F * 0.5, F * 0.42, hemp);
    });
    // At each corner the two ropes lashed together, a bigger barrel across the corner.
    eachCorner(g, w, h, () => {
      g.save();
      g.translate(F * 0.5, F * 0.5);
      g.rotate(Math.PI / 4);
      barrel(g, 0, 0, F * 0.55, shade(hemp, 0.08));
      g.restore();
    });
  },

  /* Settings: oak bound in iron, straps across it and brackets at its corners, riveted. */
  ironbound(g, w, h, F, R) {
    const oak = shade(WOOD.oak, 0.12);
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      planks(g, R, s.len, 0, F, oak, s.lit);
      g.restore();
      for (let x = F * 3.5; x < s.len - F * 3; x += 70) strap(g, x, F);
    });
    eachCorner(g, w, h, () => {
      // An L of iron over the corner.
      g.fillStyle = css(IRON.body);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(F * 2.2, 0);
      g.lineTo(F * 2.2, F * 0.7);
      g.lineTo(F * 0.7, F * 0.7);
      g.lineTo(F * 0.7, F * 2.2);
      g.lineTo(0, F * 2.2);
      g.closePath();
      g.fill();
      g.strokeStyle = css(IRON.ink);
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = css(light(IRON.body, 0.4), 0.7);
      g.fillRect(1, 1, F * 2.2 - 2, 1);
      for (const [x, y] of [[F * 0.35, F * 0.35], [F * 1.7, F * 0.35], [F * 0.35, F * 1.7]] as Pt[]) head(g, x, y, F * 0.12, light(IRON.body, 0.2), IRON.ink);
    });
    inkBand(g, w, h, F);
  },

  /* The island keeper: iron chain links all round, over the stone. */
  chain(g, w, h, F, R) {
    paperBack(g, w, h, F, faceColour(STONE, 0.85));
    const iron: RGB = METAL_TONE.iron;
    eachSide(g, w, h, (s) => {
      const L = F * 0.95;
      let k = 0;
      for (let x = F * 0.5; x < s.len - F * 0.3; x += L * 0.72, k++) {
        g.save();
        g.translate(x + L / 2, F * 0.5);
        g.beginPath();
        if (k % 2) g.ellipse(0, 0, L * 0.5, F * 0.12, 0, 0, Math.PI * 2);
        else g.ellipse(0, 0, L * 0.5, F * 0.3, 0, 0, Math.PI * 2);
        g.strokeStyle = css(IRON_PAINT.ink === undefined ? iron : H(IRON_PAINT.ink));
        g.lineWidth = F * 0.22;
        g.stroke();
        g.strokeStyle = css(mix(shade(iron, 0.15), light(iron, 0.15), s.lit));
        g.lineWidth = F * 0.13;
        g.stroke();
        g.restore();
      }
      void R;
    });
    inkBand(g, w, h, F);
  },

  /* The status panel: a leather strap round it, stitched both edges, buckled on the right. */
  strap(g, w, h, F, R) {
    const hide = H('#9e6d4d');
    leatherBand(g, w, h, F, hide, R);
    eachSide(g, w, h, (s) => {
      stitches(g, F * 0.3, s.len - F * 0.3, 1.8, LINEN, 2.4, 2.2);
      stitches(g, F, s.len - F, F - 1.8, LINEN, 2.4, 2.2);
    });
    // The buckle on the right side, a frame of brass and its prong, and the strap's holes below it.
    g.save();
    g.translate(w, h / 2);
    g.fillStyle = css(BRASS.body);
    g.strokeStyle = css(BRASS.ink);
    g.lineWidth = 1;
    const bw = F * 1.4, bh = F * 2;
    g.beginPath();
    g.rect(-F - 1, -bh / 2, bw, bh);
    g.rect(-F + 1.8, -bh / 2 + 2.6, bw - 5.6, bh - 5.2);
    g.fill('evenodd');
    g.stroke();
    g.beginPath();
    g.moveTo(-F - 1, 0);
    g.lineTo(-F + bw * 0.8, 0);
    g.lineWidth = 1.6;
    g.stroke();
    g.restore();
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.arc(w - F / 2, h / 2 + F * 1.2 + k * F * 0.7, F * 0.12, 0, Math.PI * 2);
      g.fillStyle = css(shade(hide, 0.6));
      g.fill();
    }
  },

  /* The toolbar: a tool belt, leather with stitched loops across it, a hammer, a chisel or an awl through each. */
  toolbelt(g, w, h, F, R) {
    const hide = H('#a07050'), loop = shade(H('#a07050'), 0.35);
    leatherBand(g, w, h, F, hide, R);
    eachSide(g, w, h, (s) => {
      stitches(g, 2, s.len - 2, F * 0.22, LINEN, 2.2, 2);
      if (s.i === 1 || s.i === 3) return;
      // A tool through a loop every 64 px, lying along the belt: a hammer, a chisel or an awl.
      let k = 0;
      for (let x = 30; x + 40 < s.len - 10; x += 64, k++) {
        const lw = 9, y = F / 2, tool = (k + (s.i === 2 ? 1 : 0)) % 3;
        const h0 = x - 12, h1 = x + lw + (tool === 0 ? 12 : 8);
        // The handle, oak, round-ended.
        g.beginPath();
        g.roundRect(h0, y - 1.9, h1 - h0, 3.8, 1.9);
        g.fillStyle = css(WOOD.oak);
        g.fill();
        g.strokeStyle = css(H(LOG.line));
        g.lineWidth = 0.9;
        g.stroke();
        g.fillStyle = css(light(WOOD.oak, 0.45), 0.8);
        g.fillRect(h0 + 2, y - 1.2, h1 - h0 - 4, 0.8);
        // The iron at its end.
        g.beginPath();
        if (tool === 0) g.rect(h1 - 1, -FRAME_REACH * 0.5, 4.5, F + FRAME_REACH * 0.5 - 1);
        else if (tool === 1) {
          g.moveTo(h1 - 1, y - 2.4);
          g.lineTo(h1 + 9, y - 1.6);
          g.lineTo(h1 + 10, y + 1.6);
          g.lineTo(h1 - 1, y + 2.4);
          g.closePath();
        } else {
          g.moveTo(h1 - 1, y - 1.2);
          g.lineTo(h1 + 10, y);
          g.lineTo(h1 - 1, y + 1.2);
          g.closePath();
        }
        g.fillStyle = css(IRON.body);
        g.fill();
        g.strokeStyle = css(IRON.ink);
        g.lineWidth = 0.9;
        g.stroke();
        // The loop over it, stitched down at both edges.
        g.fillStyle = css(mix(shade(loop, 0.15), loop, s.lit));
        g.fillRect(x, 0, lw, F);
        g.strokeStyle = INK;
        g.lineWidth = 0.9;
        g.strokeRect(x + 0.45, 0.45, lw - 0.9, F - 0.9);
        g.fillStyle = css(light(loop, 0.35), 0.8);
        g.fillRect(x + 1, 1, 1, F - 2);
        g.beginPath();
        g.moveTo(x + 2.2, 1.2);
        g.lineTo(x + 2.2, F - 1.2);
        g.moveTo(x + lw - 2.2, 1.2);
        g.lineTo(x + lw - 2.2, F - 1.2);
        g.setLineDash([1.6, 1.4]);
        g.strokeStyle = css(LINEN);
        g.lineWidth = 0.9;
        g.stroke();
        g.setLineDash([]);
      }
    });
  },
};

/** An iron strap across a side's band at x, riveted top and bottom. */
function strap(g: Ctx, x: number, F: number): void {
  g.fillStyle = css(IRON.body);
  g.fillRect(x, 0, F * 0.55, F);
  g.strokeStyle = css(IRON.ink);
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, 0.5, F * 0.55 - 1, F - 1);
  g.fillStyle = css(light(IRON.body, 0.4), 0.6);
  g.fillRect(x + 1, 1, 1, F - 2);
  head(g, x + F * 0.28, F * 0.25, F * 0.1, light(IRON.body, 0.2), IRON.ink);
  head(g, x + F * 0.28, F * 0.75, F * 0.1, light(IRON.body, 0.2), IRON.ink);
}

/** Leather all round: its face, darker on the sides away from the light, a blind tooled line, and its ink. */
function leatherBand(g: Ctx, w: number, h: number, F: number, hide: RGB, R: () => number): void {
  eachSide(g, w, h, (s) => {
    g.save();
    mitre(g, s.len, F);
    g.clip();
    g.fillStyle = css(mix(shade(hide, 0.22), hide, s.lit));
    g.fillRect(0, 0, s.len, F);
    // The grain of the hide: fine dark pores.
    g.fillStyle = css(shade(hide, 0.35), 0.35);
    for (let k = 0; k < s.len / 3; k++) g.fillRect(R() * s.len, R() * F, 0.9, 0.9);
    g.fillStyle = css(shade(hide, 0.35));
    g.fillRect(0, F * 0.5, s.len, 0.9);
    g.fillStyle = css(light(hide, 0.25), 0.7);
    g.fillRect(0, F * 0.5 + 0.9, s.len, 0.6);
    g.restore();
  });
  inkBand(g, w, h, F);
}

/** A plain ground behind something laid on it, edged in ink. */
function paperBack(g: Ctx, w: number, h: number, F: number, c: RGB): void {
  fillBand(g, w, h, F, css(c));
  inkBand(g, w, h, F);
}

/**
 * Paper round the window: its face, foxed with stains, its outer edge
 * ragged by up to `deep` (a deckle, a tear), scorched dark along it when
 * `burnt`.
 */
function paper(g: Ctx, w: number, h: number, F: number, R: () => number, p: RGB, deep: number, burnt: boolean): void {
  eachSide(g, w, h, (s) => {
    g.save();
    mitre(g, s.len, F);
    g.clip();
    g.fillStyle = css(mix(shade(p, 0.12), p, s.lit));
    g.fillRect(0, 0, s.len, F);
    for (let k = 0; k < s.len / 30; k++) {
      g.beginPath();
      g.ellipse(R() * s.len, R() * F, 3 + R() * 7, 2 + R() * 3, 0, 0, Math.PI * 2);
      g.fillStyle = css(shade(p, 0.18), 0.25);
      g.fill();
    }
    // The ragged edge: cut away from the outside, ink round what is left, and scorch along it.
    const edge = ragged(g, R, s.len, deep);
    if (burnt) {
      g.beginPath();
      edge.forEach(([x, y], k) => (k ? g.lineTo(x, y + 3.5) : g.moveTo(x, y + 3.5)));
      g.lineTo(s.len, -1);
      g.lineTo(0, -1);
      g.closePath();
      g.fillStyle = css(H('#6b4a34'), 0.7);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(0, -1);
    edge.forEach(([x, y]) => g.lineTo(x, y));
    g.lineTo(s.len, -1);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.beginPath();
    edge.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = css(burnt ? H('#3f2c22') : shade(p, 0.5));
    g.lineWidth = burnt ? 1.2 : 0.8;
    g.stroke();
    g.restore();
  });
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.strokeRect(F - 0.5, F - 0.5, w - F * 2 + 1, h - F * 2 + 1);
}

/**
 * How much of the island's night wash (`NIGHT_WASH`) a frame takes after
 * dark: as much as the stones' ivy takes where their runes light it, three
 * fifths. Under the whole of it every frame went the same slate and could
 * not be told from the next.
 */
const NIGHT_FRAME = 0.6;

/**
 * A window's frame of `kind` (`FRAMES`), round a w × h window, its band
 * `o.rim` wide: in the window's own frame, on a canvas `FRAME_REACH` bigger
 * all round. Nothing for 'stone', the plain rim the slab has already.
 */
export function paintFrame(g: Ctx, w: number, h: number, kind: string, o: FrameOpts): void {
  const paint = PAINTERS[kind];
  if (!paint) return;
  const F = o.rim;
  g.save();
  g.lineJoin = 'round';
  // Nothing of a frame past its reach out or past its band in, whatever a painter does.
  const out = reachOf(kind);
  g.beginPath();
  g.rect(-out, -out, w + out * 2, h + out * 2);
  g.rect(F, F, w - F * 2, h - F * 2);
  g.clip('evenodd');
  paint(g, w, h, F, rand(o.seed * 7 + 3), o);
  g.restore();
  if (o.night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-out, -out, w + out * 2, h + out * 2);
    g.restore();
  }
}

