import { hash2, mulberry32 } from '../world/noise';
import { PINK_PETAL } from '../world/tiles';
import { HEIGHT_SCALE } from './iso';

/**
 * Wildflowers, drawn.
 *
 * Where they grow and how thick is `world/flowers.ts`, which the island reads
 * too; this is what a clump of them looks like and where on its tile each one
 * stands. A tile in flower carries one clump for each its drift gives it --
 * thin at a drift's edge, full in its middle -- and a clump is a tuft of
 * leaves with a handful of small flowers on stems over it: pink, white,
 * yellow, and now and then blue, each patch of meadow mostly one of them.
 *
 * Painted, as the world is (`docs/aesthetic.md`): no ink round a head; each
 * petal and leaf in three values of its own colour -- a tinted light toward
 * the key over the viewer's left shoulder, the colour, and a shade shifted
 * cool -- with a mottle of close values over them. A clump's arrangement is
 * also its kind of flower: open daisies, cups, umbels of small florets, or
 * spikes, so a patch of one colour is still four plants.
 *
 * Nothing in a clump gives light: under the night's wash it goes as dark as
 * the grass it stands in.
 *
 * They sway. The wind leans them all one way, harder in a stronger wind, and
 * each clump nods on its own clock round that. The sway is painted ahead as a
 * few frames of the clump leaning -- stems bending, heads carried over -- and
 * a clump is drawn from whichever frame its lean is nearest, so the wind costs
 * a choice of picture and not a transform a clump.
 */

type Ctx = CanvasRenderingContext2D;

/**
 * The four colours a meadow flowers in: the petals (`petal`, what a clump far
 * off is a speck of), their light toward the key and their shade, and the eye.
 */
export const FLOWER_COLOURS: ReadonlyArray<{ name: string; petal: string; light: string; shade: string; eye: string }> = [
  { name: 'pink', petal: PINK_PETAL, light: '#fbd2dc', shade: '#c47fa8', eye: '#f2cf62' },
  { name: 'white', petal: '#f5f0e4', light: '#fdf8e6', shade: '#bdb8d8', eye: '#eabd45' },
  { name: 'yellow', petal: '#f4d35a', light: '#fbeca2', shade: '#d99b52', eye: '#c97c3a' },
  { name: 'blue', petal: '#98b8ee', light: '#cde0fa', shade: '#7480c8', eye: '#f3ecd2' },
];

/** A clump's leaves: the light along a blade's upper edge, the blade, its shade (teal), the deep at the back of the tuft, and a stem. */
const LEAF = { light: '#b2d39a', mid: '#82b087', shade: '#719f89', deep: '#679486', stem: '#73a37b' } as const;

/**
 * Which colour a patch of meadow is mostly, as running shares: a third pink,
 * nearly as much white, a fifth yellow and the last tenth blue.
 */
const COLOUR_CUTS = [0.36, 0.66, 0.9, 1];

/** Frames of lean either side of upright, and the arrangements of heads a clump comes in. */
export const SWAYS = 2;
const VARIANTS = 4;
/** How far over the top of a clump is carried in its furthest frame, in pixels at zoom one. */
const LEAN = 2;
/** Painted at three times the size it is drawn, as the meadow's clumps are. */
const SCALE = 3;

/** A painted clump, and where it is rooted in its own picture. Sizes in pixels at zoom one. */
export interface FlowerSprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/**
 * Where the heads of each arrangement stand over the root, in pixels at zoom
 * one: (x, up), the top of each flower. Each arrangement is a kind of flower
 * (`FLOWER_KINDS`): open daisies, cups, umbels and spikes.
 */
const HEADS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-5.6, 7], [-1.6, 11.2], [3.2, 8.8], [6.4, 5.6], [0.8, 4.8], [-3.4, 3.4], [4.4, 12.2]],
  [[-4.8, 9], [0.2, 12.4], [5, 9.8], [-1.2, 6.2], [7, 6.4], [-7, 5]],
  [[-3.4, 10.2], [2.6, 11.8], [6, 7.4], [-6.4, 6.4], [1.2, 6.6]],
  [[-4.2, 10.6], [0.4, 13.2], [4.6, 11.4], [-7.2, 7.8], [7.4, 8.4]],
];
type Kind = 'daisy' | 'cup' | 'umbel' | 'spike';
export const FLOWER_KINDS: readonly Kind[] = ['daisy', 'cup', 'umbel', 'spike'];

/**
 * How high a clump's flowers stand over the ground, in height units: its
 * highest head. For whatever comes to them (`life.ts`: a tile in flower is a
 * home for butterflies, at this height).
 */
export const FLOWER_TOP = Math.max(...HEADS.flatMap((h) => h.map(([, up]) => up))) / HEIGHT_SCALE;

/** The leaves round the foot of a clump: (x, up, length, lean) in pixels at zoom one, the two at the back first. */
const LEAVES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-1, 2, 4.8, -0.25], [1.8, 1.7, 4.4, 0.35], [-6.2, 0.4, 4, -1.25], [6.2, 0.3, 4, 1.2], [-4.2, 1, 5.6, -0.9], [3.8, 1.2, 5.4, 0.8], [0.4, 0.8, 3.8, 0.1],
];

const W = 23;
const H = 21;
/** The root, in the picture: a pixel and a half up from its foot, in the middle. */
const AX = W / 2;
const AY = H - 1.5;

const cache = new Map<number, FlowerSprite>();

/** A clump in one colour and arrangement, leaning `frame` frames over from upright (negative is left). */
export function flowerSprite(colour: number, variant: number, frame: number): FlowerSprite {
  const key = (colour * VARIANTS + variant) * (2 * SWAYS + 1) + frame + SWAYS;
  const had = cache.get(key);
  if (had) return had;
  const c = document.createElement('canvas');
  c.width = W * SCALE;
  c.height = H * SCALE;
  const g = c.getContext('2d') as Ctx;
  g.scale(SCALE, SCALE);
  const v = variant % HEADS.length;
  // The same heads in every frame of a clump: only its lean changes.
  paint(g, FLOWER_COLOURS[colour], HEADS[v], FLOWER_KINDS[v], (frame / SWAYS) * LEAN, mulberry32(colour * 97 + v * 31 + 7));
  const made = { canvas: c, w: W, h: H, ax: AX, ay: AY };
  cache.set(key, made);
  return made;
}

type Col = (typeof FLOWER_COLOURS)[number];

/** A colour `t` of the way from `a` to `b`, both `#rrggbb`. */
function mixC(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (sh: number): number => Math.round(((x >> sh) & 255) + (((y >> sh) & 255) - ((x >> sh) & 255)) * k);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Dabs of broken colour over what is on `g` already, kept inside `clip`: `n` of them in `cols`, about `r` across, over the box. */
function dabs(g: Ctx, clip: Path2D, cols: readonly string[], n: number, x0: number, y0: number, w: number, h: number, r: number, R: () => number): void {
  g.save();
  g.clip(clip);
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.ellipse(x0 + R() * w, y0 + R() * h, r * (0.7 + R() * 0.6), r * (0.45 + R() * 0.4), R() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

let tuftKept: HTMLCanvasElement | null = null;

/**
 * The tuft of leaves every clump stands in, and its shade: the same whatever
 * its colour, arrangement or lean, so painted once and laid under each.
 */
function tuft(): HTMLCanvasElement {
  if (tuftKept) return tuftKept;
  const c = document.createElement('canvas');
  c.width = W * SCALE;
  c.height = H * SCALE;
  const g = c.getContext('2d') as Ctx;
  g.scale(SCALE, SCALE);
  paintTuft(g, mulberry32(4271));
  tuftKept = c;
  return c;
}

/** Paint one clump: its tuft (`tuft`), the stems carried over by `lean` at the top, and the heads, lit from the left. */
function paint(g: Ctx, col: Col, heads: ReadonlyArray<readonly [number, number]>, kind: Kind, lean: number, R: () => number): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.drawImage(tuft(), 0, 0, W, H);
  stemsAndHeads(g, col, heads, kind, lean, R);
}

/** The shade at a clump's foot and its leaves. */
function paintTuft(g: Ctx, R: () => number): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // The shade at its foot, so it stands in the grass rather than on it: soft, and a little to the right.
  g.beginPath();
  g.ellipse(AX + 1, AY + 0.3, 7.4, 1.9, 0, 0, 7);
  g.fillStyle = 'rgba(46, 74, 86, 0.14)';
  g.fill();

  // The leaves: each blade's left half lit and its right half in shade, the two at the back a value down.
  const blade = (x: number, up: number, len: number, tilt: number, side: number): Path2D => {
    const bx = AX + x, by = AY - up;
    const tx = bx + tilt * len * 0.8, ty = by - len;
    const mx = bx + tilt * len * 0.35, my = by - len * 0.55;
    const p = new Path2D();
    p.moveTo(bx + side * 0.15, by);
    p.quadraticCurveTo(mx + side * 1.05, my, tx, ty);
    p.quadraticCurveTo(mx + side * 0.1, my + 0.4, bx, by);
    p.closePath();
    return p;
  };
  const leaves = new Path2D();
  LEAVES.forEach(([x, up, len, tilt], i) => {
    const back = i < 2;
    const right = blade(x, up, len, tilt, 1), left = blade(x, up, len, tilt, -1);
    g.fillStyle = back ? LEAF.deep : LEAF.shade;
    g.fill(right);
    g.fillStyle = back ? LEAF.shade : LEAF.mid;
    g.fill(left);
    leaves.addPath(right);
    leaves.addPath(left);
    if (back) return;
    // The light along its upper, left edge.
    g.strokeStyle = LEAF.light;
    g.lineWidth = 0.32;
    g.beginPath();
    g.moveTo(AX + x - 0.3, AY - up - 0.3);
    g.quadraticCurveTo(AX + x + tilt * len * 0.35 - 0.85, AY - up - len * 0.55, AX + x + tilt * len * 0.8, AY - up - len);
    g.stroke();
  });
  dabs(g, leaves, [mixC(LEAF.mid, LEAF.light, 0.45), mixC(LEAF.shade, LEAF.mid, 0.5), mixC(LEAF.mid, '#9cc6a8', 0.6)], 26, AX - 9, AY - 7, 18, 7, 0.55, R);
}

/** A clump's stems, carried over by `lean` at the top, and its heads, the lower first. */
function stemsAndHeads(g: Ctx, col: Col, heads: ReadonlyArray<readonly [number, number]>, kind: Kind, lean: number, R: () => number): void {
  // The stems, each from the root to its head, bending with the lean the more the higher it goes.
  const topOf = (hx: number, up: number): [number, number] => [AX + hx + lean * (up / 12) * (up / 12), AY - up];
  for (const [hx, up] of heads) {
    const [tx, ty] = topOf(hx, up);
    g.strokeStyle = hx > 0 ? mixC(LEAF.stem, LEAF.shade, 0.35) : LEAF.stem;
    g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(AX + hx * 0.25, AY - 0.4);
    g.quadraticCurveTo(AX + hx * 0.7, AY - up * 0.5, tx, ty + (kind === 'spike' ? 3 : kind === 'cup' ? 1.2 : 0));
    g.stroke();
    if (kind !== 'cup' && kind !== 'spike') continue;
    // A leaf up the stem, which a cup or a spike carries clear of the tuft.
    const sx = AX + hx * 0.55 + lean * 0.2, sy = AY - up * 0.42, d = hx >= 0 ? 1 : -1;
    g.fillStyle = d > 0 ? LEAF.shade : LEAF.mid;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(sx + d * 1.4, sy - 1.6, sx + d * 2.4, sy - 1.2);
    g.quadraticCurveTo(sx + d * 1.2, sy - 0.2, sx, sy);
    g.fill();
  }

  // And the heads, the lower ones first so the higher stand in front of them.
  const order = [...heads].sort((a, b) => a[1] - b[1]);
  order.forEach(([hx, up], i) => {
    const [cx, cy] = topOf(hx, up);
    const k = 1 - ((i * 7 + Math.round(up)) % 3) * 0.08;
    if (kind === 'daisy') daisy(g, col, cx, cy, 2.05 * k, i * 1.3, R);
    else if (kind === 'cup') cup(g, col, cx, cy, 2.1 * k, R);
    else if (kind === 'umbel') umbel(g, col, cx, cy, 2.5 * k);
    else spike(g, col, cx, cy, 1.75 * k, 5.4 * k, R);
  });
}

/** How lit a part facing (dx, dy) on the screen is: one toward the key (up and to the left), nought turned from it. */
const litAt = (dx: number, dy: number): number => {
  const l = Math.hypot(dx, dy) || 1;
  return Math.max(0, Math.min(1, 0.5 + 0.5 * ((-dx * 0.62 - dy * 0.78) / l)));
};
/** A petal's colour lit `lit`: its shade at nought, its own colour at a half, its light at one. */
const petalCol = (col: Col, lit: number): string =>
  lit > 0.5 ? mixC(col.petal, col.light, (lit - 0.5) * 1.7) : mixC(col.shade, col.petal, lit * 2);

/** An open daisy seen from a little above: six petals round an eye, each lit by the way it faces. */
function daisy(g: Ctx, col: Col, cx: number, cy: number, r: number, turn: number, R: () => number): void {
  const petals: Array<{ a: number; p: Path2D }> = [];
  for (let k = 0; k < 6; k++) {
    const a = turn + (k / 6) * Math.PI * 2;
    const ex = Math.cos(a), ey = Math.sin(a) * 0.72;
    const p = new Path2D();
    p.ellipse(cx + ex * r * 0.55, cy + ey * r * 0.55, r * 0.58, r * 0.3, Math.atan2(ey, ex), 0, Math.PI * 2);
    petals.push({ a, p });
  }
  // The far petals (up the screen) first: the near ones lie over them.
  petals.sort((u, v) => Math.sin(u.a) - Math.sin(v.a));
  petals.forEach(({ a, p }, k) => {
    const lit = litAt(Math.cos(a), Math.sin(a) * 0.72) * 0.6 + 0.25;
    g.fillStyle = petalCol(col, lit);
    g.fill(p);
    // Broken colour: a dab a step off the petal's own, well inside it, on every other petal.
    if ((k + Math.floor(R() * 2)) % 2) return;
    const d = r * (0.45 + R() * 0.2);
    g.fillStyle = petalCol(col, lit + (R() < 0.5 ? 0.18 : -0.18));
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * 0.72 * d, r * 0.2, r * 0.13, Math.atan2(Math.sin(a) * 0.72, Math.cos(a)), 0, Math.PI * 2);
    g.fill();
  });
  eye(g, col, cx, cy - r * 0.05, r * 0.34);
}

/** A cup seen from the side: its inside over the near rim, the cup lit on the left and shaded on the right, three petal tips. */
function cup(g: Ctx, col: Col, cx: number, cy: number, r: number, R: () => number): void {
  const top = cy - r * 0.2, foot = cy + r * 1.15;
  g.fillStyle = mixC(col.shade, col.petal, 0.25);
  g.beginPath();
  g.ellipse(cx, top, r * 0.85, r * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  const body = new Path2D();
  body.moveTo(cx - r * 0.95, top);
  body.quadraticCurveTo(cx - r * 0.9, foot, cx, foot);
  body.quadraticCurveTo(cx + r * 0.9, foot, cx + r * 0.95, top);
  body.lineTo(cx + r * 0.55, top - r * 0.55);
  body.lineTo(cx + r * 0.2, top - r * 0.05);
  body.lineTo(cx - r * 0.05, top - r * 0.7);
  body.lineTo(cx - r * 0.35, top - r * 0.05);
  body.lineTo(cx - r * 0.65, top - r * 0.6);
  body.closePath();
  g.fillStyle = petalCol(col, 0.2);
  g.fill(body);
  g.save();
  g.clip(body);
  g.fillStyle = col.petal;
  g.beginPath();
  g.ellipse(cx - r * 0.35, cy + r * 0.2, r * 0.75, r * 1.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = col.light;
  g.beginPath();
  g.ellipse(cx - r * 0.55, cy + r * 0.05, r * 0.28, r * 0.75, 0.15, 0, Math.PI * 2);
  g.fill();
  // Broken colour, under the same clip: a dab a step lighter on its lit half and one a step darker on its shaded half.
  for (const [u, c] of [[-0.25, mixC(col.petal, col.light, 0.5)], [0.45, mixC(col.petal, col.shade, 0.35)]] as const) {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(cx + u * r, cy + r * (0.25 + R() * 0.4), r * 0.2, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // Its stamens, in the eye's colour, standing up out of the mouth between the petal tips.
  g.fillStyle = col.eye;
  g.beginPath();
  g.ellipse(cx + r * 0.08, top - r * 0.14, r * 0.26, r * 0.2, 0, 0, Math.PI * 2);
  g.fill();
}

/** Where an umbel's florets sit, against its size: (across, down, size), the far ones up the screen. */
const FLORETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, -0.42, 0.36], [-0.3, -0.12, 0.38], [0.32, -0.1, 0.38], [-0.62, 0.08, 0.36], [0.62, 0.1, 0.36], [0, 0.22, 0.4], [-0.4, 0.38, 0.32], [0.42, 0.38, 0.32],
];

/** An umbel: a dome of small florets on fine stalks, the far ones darker, each lit on its left. */
function umbel(g: Ctx, col: Col, cx: number, cy: number, r: number): void {
  g.strokeStyle = mixC(LEAF.stem, LEAF.shade, 0.3);
  g.lineWidth = 0.32;
  g.beginPath();
  for (const [u, v] of FLORETS) {
    g.moveTo(cx, cy + r * 0.9);
    g.lineTo(cx + u * r, cy + v * r);
  }
  g.stroke();
  for (const [u, v, s] of FLORETS) {
    const x = cx + u * r, y = cy + v * r, fr = s * r;
    const lit = 0.55 + v * 0.4 - u * 0.25;
    g.fillStyle = petalCol(col, Math.max(0, lit - 0.35));
    g.beginPath();
    g.arc(x, y, fr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = petalCol(col, Math.min(1, lit + 0.1));
    g.beginPath();
    g.arc(x - fr * 0.22, y - fr * 0.22, fr * 0.68, 0, Math.PI * 2);
    g.fill();
  }
  eye(g, col, cx - r * 0.05, cy - r * 0.05, r * 0.16);
}

/**
 * A spike: florets up a tapering stem from its foot to its top at (cx, cy),
 * one side and then the other, lit on the left; the lower ones open on their
 * throats, the top ones still in bud.
 */
function spike(g: Ctx, col: Col, cx: number, cy: number, r: number, tall: number, R: () => number): void {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const side = i % 2 ? 1 : -1;
    const w = r * (1 - t * 0.5), x = cx + side * w * 0.38 * (1 - t * 0.5), y = cy + tall * (1 - t) * 0.95 + 0.3;
    const bud = t > 0.8;
    g.fillStyle = bud ? mixC(col.shade, LEAF.mid, 0.25 + t * 0.2) : petalCol(col, side > 0 ? 0.32 : 0.6);
    g.beginPath();
    g.ellipse(x, y, w * 0.62, w * 0.48, side * 0.35, 0, Math.PI * 2);
    g.fill();
    if (bud) continue;
    g.fillStyle = petalCol(col, side > 0 ? 0.62 : 0.98);
    g.beginPath();
    g.ellipse(x - w * 0.16, y - w * 0.12, w * 0.4, w * 0.3, side * 0.35, 0, Math.PI * 2);
    g.fill();
    if (i < 3 || R() < 0.4) {
      // The throat of an open floret, in the eye's colour.
      g.fillStyle = mixC(col.eye, col.shade, 0.2);
      g.beginPath();
      g.arc(x + side * w * 0.12, y + w * 0.08, w * 0.15, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** A flower's eye: its colour, shaded on its lower right. */
function eye(g: Ctx, col: Col, cx: number, cy: number, r: number): void {
  g.fillStyle = mixC(col.eye, '#a8643a', 0.3);
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = mixC(col.eye, '#fff6d8', 0.25);
  g.beginPath();
  g.arc(cx - r * 0.25, cy - r * 0.25, r * 0.62, 0, Math.PI * 2);
  g.fill();
}

/** Value noise over the map, smooth over nine tiles: which colour a patch of meadow is. Drawing only. */
function tint(x: number, y: number): number {
  const s = 1 / 9;
  const gx = Math.floor(x * s), gy = Math.floor(y * s);
  const fx = x * s - gx, fy = y * s - gy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(gx, gy, 6211), b = hash2(gx + 1, gy, 6211);
  const c = hash2(gx, gy + 1, 6211), d = hash2(gx + 1, gy + 1, 6211);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

const pickColour = (t: number): number => {
  for (let i = 0; i < COLOUR_CUTS.length; i++) if (t < COLOUR_CUTS[i]) return i;
  return COLOUR_CUTS.length - 1;
};

/** The colour most of a tile's flowers are, off where it is. */
export const tileColour = (x: number, y: number): number => pickColour(tint(x, y));

/**
 * Where on its tile the `i`th clump of `n` stands, and what it is: (u, v) in
 * the tile's own square, its colour, its arrangement, its phase in the wind
 * and its size. Off the tile's coordinates alone, so it never moves and every page
 * puts it in the same place. The clumps are spread over the four quarters of
 * the tile rather than thrown at it, so four of them are a tile in flower and
 * not a heap in one corner.
 */
export function clumpOf(x: number, y: number, i: number, n: number, main: number): [number, number, number, number, number, number] {
  const q = (Math.floor(hash2(x, y, 6301) * 4) + i) % 4;
  const qu = n === 1 ? 0.5 : q % 2 === 0 ? 0.3 : 0.7;
  const qv = n === 1 ? 0.5 : q < 2 ? 0.3 : 0.7;
  const u = qu + (hash2(x, y, 6303 + i * 7) - 0.5) * (n === 1 ? 0.4 : 0.32);
  const v = qv + (hash2(x, y, 6305 + i * 7) - 0.5) * (n === 1 ? 0.4 : 0.32);
  // And its own size, a tenth either way and in tenths, so a full drift is not a grid of one clump.
  const size = 0.9 + Math.floor(hash2(x, y, 6315 + i * 7) * 3) * 0.1;
  // A fifth of them another colour than the patch's, which is what a meadow does.
  const other = hash2(x, y, 6307 + i * 7);
  const colour = other < 0.2 ? pickColour(hash2(x, y, 6309 + i * 7)) : main;
  const variant = Math.floor(hash2(x, y, 6311 + i * 7) * VARIANTS);
  const phase = hash2(x, y, 6313 + i * 7) * Math.PI * 2;
  return [u, v, colour, variant, phase, size];
}

/**
 * How many frames over a clump leans now: the wind's lean across the screen,
 * `lean` (-1 to 1, times its force), and the clump's own nod round it.
 */
export function swayFrame(lean: number, force: number, t: number, phase: number): number {
  const nod = Math.sin(t * (1.5 + (phase % 1) * 0.9) + phase) * (0.22 + 0.45 * force);
  const s = lean * 0.75 + nod;
  return Math.max(-SWAYS, Math.min(SWAYS, Math.round(s * SWAYS)));
}
