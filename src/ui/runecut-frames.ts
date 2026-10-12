import {
  css, cut, cushion, drawPads, faceColour, glyphPath, grassTuft, hex, mix, roundelStrokes, STONE_INK, strokesPath, toneOf,
  type Ctx, type Pad, type Pt, type RGB,
} from '../render/runestone';
import { rand } from '../render/ivy';
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
  { kind: 'runestone', label: 'Runestone', for: ['skills'] },
  { kind: 'guild', label: 'Guild leather', for: ['trades'] },
  { kind: 'altar', label: 'Altar marble', for: ['faith'] },
  { kind: 'parchment', label: 'Parchment', for: ['map'] },
  { kind: 'treasure', label: 'Treasure map', for: ['hoard'] },
  { kind: 'stall', label: 'Market stall', for: ['market'] },
  { kind: 'scroll', label: 'Scroll', for: ['events'] },
  { kind: 'book', label: 'Leather book', for: ['journal'] },
  { kind: 'ledger', label: 'Account book', for: ['ledger'] },
  { kind: 'clothbook', label: 'Cloth-bound book', for: ['help'] },
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

/** A knot at (x, y), `r` across: the rope's turns as three lobes round a tight middle. */
function knot(g: Ctx, x: number, y: number, r: number, tone: RGB): void {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
    g.fillStyle = css(mix(tone, light(tone, 0.2), k / 2));
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.9;
    g.stroke();
  }
  g.beginPath();
  g.arc(x, y, r * 0.28, 0, Math.PI * 2);
  g.fillStyle = css(shade(tone, 0.35));
  g.fill();
}

/** A metal corner: a triangle over the band's corner, ruled in ink, with a rivet. */
function cornerPlate(g: Ctx, F: number, body: RGB, ink: RGB, reach = 0.95): void {
  const s = F * reach;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(s * 1.25, 0);
  g.lineTo(0, s * 1.25);
  g.closePath();
  g.fillStyle = css(body);
  g.fill();
  g.strokeStyle = css(ink);
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(2, s * 1.25 - 3);
  g.lineTo(s * 1.25 - 3, 2);
  g.strokeStyle = css(light(body, 0.5), 0.8);
  g.stroke();
  head(g, s * 0.38, s * 0.38, Math.max(1.2, F * 0.1), light(body, 0.15), ink);
}

/** Small even weave in two tones, for cloth: threads along and across every `step` px. */
function weave(g: Ctx, len: number, F: number, base: RGB, step: number, contrast: number): void {
  g.fillStyle = css(base);
  g.fillRect(0, 0, len, F);
  for (let y = 0; y < F; y += step) {
    for (let x = ((y / step) % 2) * step; x < len; x += step * 2) {
      g.fillStyle = css(light(base, contrast));
      g.fillRect(x, y, step, step * 0.55);
      g.fillStyle = css(shade(base, contrast * 0.9));
      g.fillRect(x + step, y + step * 0.45, step * 0.55, step * 0.55);
    }
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

/**
 * Sackcloth: a coarse open weave, its threads 3 px apart so the over and
 * under shows at the interface's own size -- a thread along lying over one
 * across, then under the next.
 */
function sackcloth(g: Ctx, len: number, F: number, base: RGB): void {
  g.fillStyle = css(shade(base, 0.42));
  g.fillRect(0, 0, len, F);
  const step = 3;
  for (let y = 0; y < F; y += step) {
    for (let x = 0; x < len; x += step) {
      const along = ((x + y) / step) % 2 === 0;
      g.fillStyle = css(along ? light(base, 0.12) : shade(base, 0.06));
      if (along) g.fillRect(x, y + 0.5, step, step - 1);
      else g.fillRect(x + 0.5, y, step - 1, step);
    }
  }
}

/** A cord along a path: the path stroked `t` thick in the tone over its ink, and a lit thread down it. */
function cord(g: Ctx, path: () => void, t: number, tone: RGB): void {
  g.lineCap = 'round';
  path();
  g.strokeStyle = INK;
  g.lineWidth = t + 1.4;
  g.stroke();
  path();
  g.strokeStyle = css(tone);
  g.lineWidth = t;
  g.stroke();
  path();
  g.strokeStyle = css(light(tone, 0.4), 0.8);
  g.lineWidth = t * 0.3;
  g.stroke();
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

/* ---- the frames -------------------------------------------------------------- */

type Painter = (g: Ctx, w: number, h: number, F: number, R: () => number, o: FrameOpts) => void;

const PAINTERS: Record<string, Painter> = {
  /* The pack: sackcloth, its coarse weave, a hem stitched in twine, and the drawstring gathered in a knot at a top corner. */
  burlap(g, w, h, F, R) {
    const sack = H('#d6bf94'), twine = H('#8f6a40');
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      sackcloth(g, s.len, F, mix(shade(sack, 0.18), sack, s.lit));
      // The hem: the cloth turned over along the inner edge.
      g.fillStyle = css(shade(sack, 0.45), 0.75);
      g.fillRect(0, F - 6, s.len, 1);
      g.restore();
      // Stitched down in twine, 3 px a stitch.
      stitches(g, F, s.len - F, F - 3.2, twine, 3, 3);
      // The frayed outer edge: loose threads standing off it.
      g.strokeStyle = css(shade(sack, 0.3));
      g.lineWidth = 0.9;
      for (let x = 2; x < s.len - 2; x += 2.5 + R() * 3) {
        g.beginPath();
        g.moveTo(x, 1);
        g.lineTo(x + (R() - 0.5) * 2.4, -0.6 - R() * 2.6);
        g.stroke();
      }
      if (s.i === 0) {
        // The mouth gathered on its drawstring: folds across the top, crowding toward the knot.
        for (let x = F * 1.2; x < s.len - F; x += 3 + (x / s.len) * 6) {
          g.beginPath();
          g.moveTo(x, 0.5);
          g.quadraticCurveTo(x + 1.6, F * 0.45, x + 0.4, F - 6.5);
          g.strokeStyle = css(shade(sack, 0.62));
          g.lineWidth = 1;
          g.stroke();
          g.beginPath();
          g.moveTo(x + 1.3, 0.8);
          g.quadraticCurveTo(x + 2.9, F * 0.45, x + 1.7, F - 7);
          g.strokeStyle = css(light(sack, 0.4), 0.7);
          g.stroke();
        }
      }
    });
    inkBand(g, w, h, F);
    // The drawstring along the top, through the gathers.
    cord(g, () => { g.beginPath(); g.moveTo(F * 0.6, F * 0.42); g.lineTo(w - F * 0.7, F * 0.42); }, 3, twine);
    // The bow at the top left: a loop along the top, a loop down the side, two tails hanging, and the knot over them.
    cord(g, () => { g.beginPath(); g.ellipse(F * 1.55, F * 0.42, F * 1.05, F * 0.3, 0, 0, Math.PI * 2); }, 2.6, twine);
    cord(g, () => { g.beginPath(); g.ellipse(F * 0.42, F * 1.55, F * 0.3, F * 1.05, 0, 0, Math.PI * 2); }, 2.6, twine);
    for (const [x, len] of [[F * 0.28, F * 3.6], [F * 0.68, F * 2.9]]) {
      cord(g, () => { g.beginPath(); g.moveTo(F * 0.45, F * 0.5); g.quadraticCurveTo(x - 1, F * 1.6, x, len); }, 2.6, twine);
      // The frayed end of the tail.
      g.strokeStyle = css(light(twine, 0.25));
      g.lineWidth = 0.8;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(x, len);
        g.lineTo(x + k * 1.2, len + 2.6);
        g.stroke();
      }
    }
    knot(g, F * 0.45, F * 0.45, F * 0.52, twine);
  },

  /* A store: a crate's planks, darker corner posts, nail heads, and a rope handle on one side. */
  crate(g, w, h, F, R) {
    const pine = WOOD.pine, post = shade(WOOD.oak, 0.12);
    const nails: Array<[number, number]> = [];
    eachSide(g, w, h, (s) => {
      const joints = planks(g, R, s.len, 0, F, pine, s.lit, F, s.len - F);
      for (const j of [F + 4, ...joints.flatMap((x) => [x - 4, x + 4]), s.len - F - 4]) nails.push([s.i, j]);
    });
    eachSide(g, w, h, (s) => {
      for (const [i, x] of nails) if (i === s.i) { head(g, x, F * 0.3, F * 0.12, IRON.body, IRON.ink); head(g, x, F * 0.7, F * 0.12, IRON.body, IRON.ink); }
      // The rope handle, through two holes on the right-hand side, standing out past the edge.
      if (s.i === 1) {
        const m = s.len / 2;
        for (const hx of [m - F, m + F]) {
          g.beginPath();
          g.arc(hx, F * 0.45, F * 0.16, 0, Math.PI * 2);
          g.fillStyle = css(LOG.under === undefined ? IRON.ink : H(LOG.line));
          g.fill();
        }
        g.save();
        g.beginPath();
        g.moveTo(m - F, F * 0.45);
        g.bezierCurveTo(m - F * 0.8, -FRAME_REACH * 0.8, m + F * 0.8, -FRAME_REACH * 0.8, m + F, F * 0.45);
        g.strokeStyle = INK;
        g.lineWidth = F * 0.3 + 1.2;
        g.lineCap = 'round';
        g.stroke();
        g.strokeStyle = css(H('#c9a978'));
        g.lineWidth = F * 0.3;
        g.stroke();
        g.setLineDash([2, 2.5]);
        g.strokeStyle = css(H('#8f7048'));
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
    });
    eachCorner(g, w, h, () => {
      g.fillStyle = css(post);
      g.fillRect(0, 0, F, F);
      grain(g, R, 1, F - 1, 1, F - 1, post, false);
      g.fillStyle = css(light(post, 0.3));
      g.fillRect(0, 0, F, 1.5);
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, F - 1, F - 1);
      head(g, F / 2, F / 2, F * 0.14, IRON.body, IRON.ink);
    });
    inkBand(g, w, h, F);
  },

  /* The bench: oak, a boxwood rule along the top with its ticks, nicks from the tools, and a vice at a corner. */
  bench(g, w, h, F, R) {
    const oak = WOOD.oak;
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      planks(g, R, s.len, 0, F, oak, s.lit);
      // Nicks along the edge where the tools caught it.
      for (let x = 12 + R() * 30; x < s.len - 12; x += 30 + R() * 60) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 1.5, 2.5 + R() * 1.5);
        g.lineTo(x + 3, 0);
        g.fillStyle = css(shade(oak, 0.45));
        g.fill();
      }
      g.restore();
      if (s.i === 0) {
        // The rule: a strip of boxwood, ticks every 4 px, longer every 20.
        const y0 = F * 0.2, y1 = F * 0.68, x0 = F * 1.6, x1 = s.len - F * 1.6;
        g.fillStyle = css(H('#ecdcae'));
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = INK;
        g.lineWidth = 0.8;
        g.strokeRect(x0 + 0.4, y0 + 0.4, x1 - x0 - 0.8, y1 - y0 - 0.8);
        g.strokeStyle = css(H('#5a4636'));
        for (let x = x0 + 4, n = 1; x < x1 - 1; x += 4, n++) {
          g.beginPath();
          g.moveTo(x, y1 - 0.5);
          g.lineTo(x, y1 - 0.5 - (n % 5 === 0 ? (y1 - y0) * 0.65 : (y1 - y0) * 0.3));
          g.lineWidth = n % 5 === 0 ? 1 : 0.6;
          g.stroke();
        }
      }
    });
    inkBand(g, w, h, F);
    // The vice at the bottom right: a wooden jaw and its iron screw.
    g.save();
    g.translate(w, h);
    g.rotate(Math.PI);
    const vw = F * 2.4;
    g.fillStyle = css(shade(oak, 0.15));
    g.fillRect(F * 0.15, F * 0.1, vw, F * 0.8);
    grain(g, R, F * 0.2, F * 0.15 + vw, F * 0.15, F * 0.85, shade(oak, 0.15), false);
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.strokeRect(F * 0.15 + 0.5, F * 0.1 + 0.5, vw - 1, F * 0.8 - 1);
    head(g, F * 0.15 + vw / 2, F * 0.5, F * 0.2, IRON.body, IRON.ink);
    g.beginPath();
    g.moveTo(F * 0.15 + vw / 2 - F * 0.5, F * 0.5);
    g.lineTo(F * 0.15 + vw / 2 + F * 0.5, F * 0.5);
    g.strokeStyle = css(IRON.ink);
    g.lineWidth = 1.6;
    g.stroke();
    g.restore();
  },

  /* The skills: a runestone's grey margin, tally notches cut along it in fives, a rune cut at each corner, its edge chipped. */
  runestone(g, w, h, F, R) {
    const fill = faceColour(STONE, 0.62);
    eachSide(g, w, h, (s) => {
      const c = mix(faceColour(STONE, 0.5), fill, s.lit);
      g.save();
      mitre(g, s.len, F);
      g.clip();
      g.fillStyle = css(c);
      g.fillRect(0, 0, s.len, F);
      // Grit and a few pale flecks.
      for (let k = 0; k < s.len / 3; k++) {
        g.fillStyle = css(R() < 0.6 ? shade(c, 0.3) : light(c, 0.4), 0.5);
        g.fillRect(R() * s.len, R() * F, 1, 1);
      }
      // The arris along the outer edge, lit.
      g.fillStyle = css(light(c, 0.35), 0.8);
      g.fillRect(0, 1, s.len, 1.2);
      g.restore();
      // Tallies: four strokes across the band, the fifth slashed through them.
      for (let x = F * 1.7; x + 14 < s.len - F * 1.5; x += 24) {
        for (let k = 0; k < 4; k++) cut(g, c, 1.4, () => { g.beginPath(); g.moveTo(x + k * 3.2, F * 0.24); g.lineTo(x + k * 3.2, F * 0.76); });
        cut(g, c, 1.3, () => { g.beginPath(); g.moveTo(x - 2, F * 0.7); g.lineTo(x + 11.6, F * 0.3); });
      }
      // Chips out of the outer edge.
      for (let k = 0; k < s.len / 70; k++) {
        const x = F + R() * (s.len - F * 2), d = 1.5 + R() * 1.5, l = 3 + R() * 3;
        g.beginPath();
        g.moveTo(x - l, 0);
        g.lineTo(x, d);
        g.lineTo(x + l, 0);
        g.fillStyle = css(shade(c, 0.25));
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 0.8;
        g.stroke();
      }
    });
    eachCorner(g, w, h, (i) => {
      const c = faceColour(STONE, 0.56);
      g.fillStyle = css(c);
      g.fillRect(0.5, 0.5, F - 1, F - 1);
      g.strokeStyle = css(shade(c, 0.4));
      g.lineWidth = 0.8;
      g.strokeRect(1.5, 1.5, F - 3, F - 3);
      g.save();
      g.translate(F / 2, F / 2);
      g.scale(1, -1);
      cut(g, c, 1.5, () => glyphPath(g, ['tiwaz', 'algiz', 'othala', 'laguz'][i], 0, 0, F * 0.4));
      g.restore();
    });
    inkBand(g, w, h, F);
  },

  /* The trades: guild leather, a tooled border, brass studs, stitched along its edge. */
  guild(g, w, h, F, R) {
    const hide = H('#a67452');
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      g.fillStyle = css(mix(shade(hide, 0.2), hide, s.lit));
      g.fillRect(0, 0, s.len, F);
      // The tooling: a groove each side, diamonds pressed between.
      for (const y of [F * 0.3, F * 0.78]) {
        g.fillStyle = css(shade(hide, 0.4));
        g.fillRect(0, y, s.len, 1);
        g.fillStyle = css(light(hide, 0.25), 0.7);
        g.fillRect(0, y + 1, s.len, 0.6);
      }
      for (let x = 0; x < s.len; x += 9) {
        g.beginPath();
        g.moveTo(x, F * 0.54);
        g.lineTo(x + 2.5, F * 0.4);
        g.lineTo(x + 5, F * 0.54);
        g.lineTo(x + 2.5, F * 0.68);
        g.closePath();
        g.fillStyle = css(shade(hide, 0.3));
        g.fill();
      }
      g.restore();
      stitches(g, 2, s.len - 2, F * 0.12, LINEN, 3, 2.5);
      for (let x = F * 2; x < s.len - F * 1.5; x += 34) head(g, x + 2.5, F * 0.54, F * 0.15, BRASS.body, BRASS.ink);
      void R;
    });
    eachCorner(g, w, h, () => head(g, F * 0.5, F * 0.5, F * 0.22, BRASS.body, BRASS.ink));
    inkBand(g, w, h, F);
  },

  /* The faith: the altar's marble, veined, gold filigree along it, a small constellation at each corner. */
  altar(g, w, h, F, R) {
    const m = H(MARBLE.stone);
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      g.fillStyle = css(mix(H(MARBLE.dark), m, s.lit));
      g.fillRect(0, 0, s.len, F);
      g.strokeStyle = css(H(MARBLE.line), 0.45);
      g.lineWidth = 0.7;
      for (let k = 0; k < s.len / 40; k++) {
        const x = R() * s.len;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 8, F * 0.3, x - 6, F * 0.6, x + 10, F);
        g.stroke();
      }
      g.restore();
      // The filigree: a running scroll of gold, a curl every 14 px.
      gilt(g, () => {
        g.beginPath();
        for (let x = F; x <= s.len - F; x += 2) {
          const y = F * 0.5 + Math.sin((x / 14) * Math.PI) * F * 0.18;
          if (x === F) g.moveTo(x, y); else g.lineTo(x, y);
        }
      }, 1.1);
      for (let x = F + 7; x < s.len - F - 4; x += 28) gilt(g, () => { g.beginPath(); g.arc(x, F * 0.32, 2, 0, Math.PI * 1.6); }, 0.9);
    });
    // A constellation at each corner: a bright star over the corner and two lesser along the sides, joined in gold.
    eachCorner(g, w, h, (i) => {
      const r2 = rand(i * 17 + 3);
      const pts: Array<[number, number, number]> = [
        [F * 0.5, F * 0.5, F * 0.52],
        [F * (1.5 + r2() * 0.6), F * (0.3 + r2() * 0.4), F * 0.22],
        [F * (0.3 + r2() * 0.4), F * (1.5 + r2() * 0.6), F * 0.22],
      ];
      g.strokeStyle = css(shade(GOLD, 0.2), 0.9);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(pts[1][0], pts[1][1]);
      g.lineTo(pts[0][0], pts[0][1]);
      g.lineTo(pts[2][0], pts[2][1]);
      g.stroke();
      for (const [x, y, r] of pts) {
        g.save();
        g.translate(x, y);
        star(g, r, r * 0.42);
        g.fillStyle = css(GOLD);
        g.fill();
        g.strokeStyle = css(shade(GOLD, 0.5), 0.8);
        g.lineWidth = 0.5;
        g.stroke();
        g.restore();
      }
    });
    inkBand(g, w, h, F);
  },

  /* The map: parchment with a deckled edge, an inked border, and a compass rose at a corner. */
  parchment(g, w, h, F, R) {
    paper(g, w, h, F, R, PARCH, 2.4, false);
    eachSide(g, w, h, (s) => {
      g.strokeStyle = css(H('#7d6a52'), 0.85);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(F * 0.4, F - 3.5);
      g.lineTo(s.len - F * 0.4, F - 3.5);
      g.stroke();
    });
    // The rose, in the top right, inked.
    g.save();
    g.translate(w - F * 0.95, F * 0.95);
    g.beginPath();
    g.arc(0, 0, F * 0.95, 0, Math.PI * 2);
    g.fillStyle = css(light(PARCH, 0.3));
    g.fill();
    g.scale(1, -1);
    strokesPath(g, roundelStrokes('star8'), 0, 0, F * 0.95);
    g.strokeStyle = css(H('#5a4a3a'));
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
    g.save();
    g.translate(w - F * 0.95, F * 0.95);
    star(g, F * 0.8, F * 0.16);
    g.fillStyle = css(H('#b4584a'), 0.85);
    g.fill();
    g.restore();
  },

  /* The treasure map: older parchment, its edge torn and scorched, and the X at a corner. */
  treasure(g, w, h, F, R) {
    paper(g, w, h, F, R, mix(PARCH, H('#c8a26a'), 0.45), 4.5, true);
    // The X, in red ink, at the bottom right.
    g.save();
    g.translate(w - F * 0.9, h - F * 0.9);
    g.lineCap = 'round';
    for (const [w2, c] of [[3.6, '#5f3a2e'], [2.4, '#b4584a']] as Array<[number, string]>) {
      g.strokeStyle = c;
      g.lineWidth = w2;
      g.beginPath();
      g.moveTo(-F * 0.42, -F * 0.42);
      g.lineTo(F * 0.42, F * 0.42);
      g.moveTo(F * 0.42, -F * 0.42);
      g.lineTo(-F * 0.42, F * 0.42);
      g.stroke();
    }
    g.restore();
  },

  /* The market: a striped awning scalloped along the top, a plank counter round the rest. */
  stall(g, w, h, F, R) {
    const counter = WOOD.cherry;
    eachSide(g, w, h, (s) => {
      if (s.i !== 0) planks(g, R, s.len, 0, F, counter, s.lit, s.i === 2 ? 0 : F, s.i === 2 ? s.len : s.len - F);
    });
    // The awning: stripes across, a scallop along its lower edge.
    const stripe = 8, a = H('#f1e4cc'), b = H('#d77f71');
    g.save();
    g.beginPath();
    g.moveTo(0, -1);
    g.lineTo(w, -1);
    g.lineTo(w, F * 0.7);
    for (let x = w; x > 0; x -= stripe) g.arc(x - stripe / 2, F * 0.7, stripe / 2, 0, Math.PI, false);
    g.closePath();
    g.save();
    g.clip();
    for (let x = 0; x < w; x += stripe) {
      g.fillStyle = css(Math.floor(x / stripe) % 2 ? a : b);
      g.fillRect(x, -1, stripe, F + 1);
    }
    g.fillStyle = 'rgba(64, 52, 58, 0.12)';
    g.fillRect(0, F * 0.45, w, F * 0.6);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.stroke();
    g.restore();
    // The rod along its head.
    rope(g, 1, w - 1, 1.2, 2.2, shade(counter, 0.1));
    inkBand(g, w, h, F);
  },

  /* The log: a paper scroll, rolled at the top and the bottom on wooden rods, their knobs standing out at the corners. */
  scroll(g, w, h, F, R) {
    const p = light(PARCH, 0.15), rod = WOOD.walnut;
    eachSide(g, w, h, (s) => {
      if (s.i === 1 || s.i === 3) {
        g.fillStyle = css(mix(shade(p, 0.12), p, s.lit));
        g.fillRect(F, 0, s.len - F * 2, F);
        g.fillStyle = css(shade(p, 0.25), 0.6);
        g.fillRect(F, F * 0.15, s.len - F * 2, 0.8);
      }
    });
    for (const y of [0, h - F]) {
      // The roll: shaded round, the turn of the paper at its lip.
      const gr = g.createLinearGradient(0, y, 0, y + F);
      gr.addColorStop(0, css(shade(p, 0.15)));
      gr.addColorStop(0.35, css(light(p, 0.4)));
      gr.addColorStop(1, css(shade(p, 0.3)));
      g.fillStyle = gr;
      g.fillRect(F * 0.35, y + 0.5, w - F * 0.7, F - 1);
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.strokeRect(F * 0.35 + 0.5, y + 1, w - F * 0.7 - 1, F - 2);
      g.strokeStyle = css(shade(p, 0.35), 0.7);
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(F * 0.6, y + F * (y === 0 ? 0.72 : 0.28));
      g.lineTo(w - F * 0.6, y + F * (y === 0 ? 0.72 : 0.28));
      g.stroke();
      // The rod's knobs, turned wood, standing out at both ends.
      for (const x of [F * 0.2, w - F * 0.2]) {
        const r = F * 0.42;
        g.beginPath();
        g.arc(x, y + F / 2, r, 0, Math.PI * 2);
        const kg = g.createRadialGradient(x - r * 0.3, y + F / 2 - r * 0.3, 1, x, y + F / 2, r);
        kg.addColorStop(0, css(light(rod, 0.45)));
        kg.addColorStop(1, css(rod));
        g.fillStyle = kg;
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 1;
        g.stroke();
      }
    }
    void R;
  },

  /* The journal: a leather binding, its spine stitched down the left with raised bands, metal corners. */
  book(g, w, h, F, R) {
    leatherBand(g, w, h, F, H('#9c5f4c'), R);
    // The spine on the left: raised bands across it.
    for (let y = F * 2; y < h - F * 2; y += 34) {
      g.fillStyle = css(shade(H('#9c5f4c'), 0.35));
      g.fillRect(1, y, F - 2, 3);
      g.fillStyle = css(light(H('#9c5f4c'), 0.35), 0.8);
      g.fillRect(1, y, F - 2, 1);
    }
    g.save();
    g.translate(0, h);
    g.rotate(-Math.PI / 2);
    stitches(g, F, h - F, F - 3, LINEN);
    g.restore();
    eachCorner(g, w, h, (i) => { if (i === 0 || i === 1) cornerPlate(g, F, METAL_TONE.pewter, IRON.ink); });
  },

  /* The ledger: an account book in cloth, its corners in gilt. */
  ledger(g, w, h, F, R) {
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      weave(g, s.len, F, mix(shade(H('#6f8f7a'), 0.2), H('#6f8f7a'), s.lit), 2, 0.1);
      g.restore();
    });
    inkBand(g, w, h, F);
    eachCorner(g, w, h, () => cornerPlate(g, F, GOLD, shade(GOLD, 0.55), 1.1));
    void R;
  },

  /* The help: a book bound in blue cloth, a gilt rule round it. */
  clothbook(g, w, h, F, R) {
    eachSide(g, w, h, (s) => {
      g.save();
      mitre(g, s.len, F);
      g.clip();
      weave(g, s.len, F, mix(shade(H('#7f95b8'), 0.2), H('#7f95b8'), s.lit), 2, 0.1);
      g.restore();
    });
    gilt(g, () => { g.beginPath(); g.rect(F * 0.42, F * 0.42, w - F * 0.84, h - F * 0.84); }, 1.3);
    eachCorner(g, w, h, () => gilt(g, () => { g.beginPath(); g.moveTo(F * 0.42, F * 0.9); g.lineTo(F * 0.9, F * 0.42); }, 1));
    inkBand(g, w, h, F);
    void R;
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
  // Nothing of a frame past `FRAME_REACH` out or past its band in, whatever a painter does.
  g.beginPath();
  g.rect(-FRAME_REACH, -FRAME_REACH, w + FRAME_REACH * 2, h + FRAME_REACH * 2);
  g.rect(F, F, w - F * 2, h - F * 2);
  g.clip('evenodd');
  paint(g, w, h, F, rand(o.seed * 7 + 3), o);
  g.restore();
  if (o.night) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${NIGHT_WASH.colour}, ${NIGHT_WASH.alpha * NIGHT_FRAME})`;
    g.fillRect(-FRAME_REACH, -FRAME_REACH, w + FRAME_REACH * 2, h + FRAME_REACH * 2);
    g.restore();
  }
}

