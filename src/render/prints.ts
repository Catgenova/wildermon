/**
 * Prints on cloth, as pictures: a small image each, made once, that a facet
 * of a garment is mapped onto (`Face.tex`, `printed` in `./figure`).
 *
 * Every print is drawn here, not loaded: a print is an id out of this table,
 * never a file or a URL anybody chose, so nothing from the wire ever becomes a
 * picture. Each is drawn at a few pixels to the tile, so it carries a grain at
 * any size it is seen at -- flat local colour in tiles of related hues, as the
 * island's cloth is printed -- and never a gradient.
 *
 * `u` runs round the garment from its right toward its front, `v` down it
 * from the neck to the hem.
 */

export const PRINT_W = 192;
export const PRINT_H = 96;

const prints = new Map<string, HTMLCanvasElement>();

/** One of the print table's pictures; nothing for an id that is not in it. */
export function printImage(id: string): HTMLCanvasElement | undefined {
  let c = prints.get(id);
  if (c) return c;
  const make = PRINTS[id];
  if (!make) return undefined;
  c = document.createElement('canvas');
  c.width = PRINT_W;
  c.height = PRINT_H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  make(g);
  prints.set(id, c);
  return c;
}

/** The ids there are, for a Look to pick from. */
export const PRINT_IDS = (): string[] => Object.keys(PRINTS);

/* -- the inks: dusty, never candy ---------------------------------------------- */

// The ground of a garment is the kit's pastel; the saturated colour is the motifs on it only.
const TEAL = '#8ec4bd';
const TEAL_DEEP = '#78b0aa';
const TEAL_HOT = '#2aa39c';
const LILAC = '#b58fe0';
const LILAC_DEEP = '#8a62c4';
const SALMON = '#f08a6a';
const PINK = '#e07cb8';
const PEACH = '#efc4a0';
const GOLD = '#f0bf3e';
const OCHRE = '#d4922e';
const MINT = '#9fd4b8';
const CREAM = '#f0e6d2';
const VIOLET = '#7d63a5';

/** A quick hash in [0, 1) for a cell, the same every time. */
const h2 = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A field of tiles, `cell` pixels square, each in one of `inks` by hash, with a little jitter to its size. */
function tiles(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, cell: number, inks: string[], seed = 0): void {
  for (let y = y0; y < y0 + h; y += cell) {
    for (let x = x0; x < x0 + w; x += cell) {
      const r = h2(x, y, seed);
      g.fillStyle = inks[Math.floor(r * inks.length)];
      // Most tiles fill their cell; one in four is a smaller tile with the ground showing round it.
      const inset = h2(x, y, seed + 1) < 0.25 ? 1 : 0;
      g.fillRect(x + inset, y + inset, cell - 2 * inset, cell - 2 * inset);
    }
  }
}

/** The grain: every so many pixels nudged toward a neighbour's value, flat colour broken but never graded. */
function grain(g: CanvasRenderingContext2D, seed: number, every = 0.18): void {
  const img = g.getImageData(0, 0, PRINT_W, PRINT_H), d = img.data;
  for (let y = 0; y < PRINT_H; y++) {
    for (let x = 0; x < PRINT_W; x++) {
      if (h2(x, y, seed) > every) continue;
      const i = (y * PRINT_W + x) * 4, k = h2(x, y, seed + 7) < 0.5 ? 0.9 : 1.08;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  g.putImageData(img, 0, 0);
}

/** A cloud: a row of rounded tops over a flat foot, flat colour. */
function clouds(g: CanvasRenderingContext2D, y: number, ink: string, seed: number, r = 7): void {
  g.fillStyle = ink;
  for (let x = -r; x < PRINT_W + r; x += r * 1.6) {
    const rr = r * (0.75 + 0.5 * h2(x, y, seed));
    g.beginPath();
    g.arc(x, y, rr, Math.PI, 2 * Math.PI);
    g.lineTo(x + rr, y + 40);
    g.lineTo(x - rr, y + 40);
    g.closePath();
    g.fill();
  }
}

/** The sun sigil: an arc with a dot in it and three rays under, as the reference has it. */
function sun(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: string): void {
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = Math.max(2, r * 0.3);
  g.lineCap = 'butt';
  g.beginPath();
  g.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy - r * 0.25, r * 0.32, 0, 2 * Math.PI);
  g.fill();
  for (const [dx, len] of [[-0.7, 0.55], [0, 0.75], [0.7, 0.55]] as Array<[number, number]>) {
    g.fillRect(cx + dx * r - g.lineWidth / 2, cy + r * 0.45, g.lineWidth, r * len);
  }
}

const PRINTS: Record<string, (g: CanvasRenderingContext2D) => void> = {
  /** The Rover's poncho: teal, a band of lilac and salmon cloud over a mosaic, a striped hem, and the sun sigil on the left breast. */
  rover_sun: (g) => {
    g.fillStyle = TEAL;
    g.fillRect(0, 0, PRINT_W, PRINT_H);
    // A deeper teal in big soft tiles, so the ground is broken colour and not a flat.
    tiles(g, 0, 0, PRINT_W, 58, 8, [TEAL, TEAL, TEAL, TEAL_DEEP], 3);
    // A few hot teal tiles low on the ground, where the skyline rises: the splash, a tenth of it.
    for (let x = 0; x < PRINT_W; x += 8) if (h2(x, 48, 4) < 0.3) { g.fillStyle = TEAL_HOT; g.fillRect(x, 48, 8, 10); }
    // Pale columns rising out of the cloud band, as the reference's skyline does.
    for (let x = 4; x < PRINT_W; x += 14) {
      const h = 6 + 10 * h2(x, 1, 5);
      g.fillStyle = h2(x, 2, 6) < 0.5 ? PEACH : LILAC;
      g.fillRect(x, 60 - h, 3, h);
    }
    // The cloud band: lilac behind, salmon and pink in front, over a mosaic of their own hues.
    clouds(g, 60, LILAC_DEEP, 11, 9);
    clouds(g, 64, LILAC, 12, 8);
    clouds(g, 69, PINK, 13, 7);
    clouds(g, 73, SALMON, 14, 6);
    tiles(g, 0, 74, PRINT_W, 10, 3, [SALMON, PINK, LILAC, PEACH], 21);
    // The striped hem: gold, violet, gold.
    g.fillStyle = GOLD; g.fillRect(0, 84, PRINT_W, 3);
    g.fillStyle = VIOLET; g.fillRect(0, 87, PRINT_W, 5);
    g.fillStyle = OCHRE; g.fillRect(0, 92, PRINT_W, 4);
    // The sigil on the left breast: a hundred and thirty-five degrees round from the body's right, three-eighths of the way.
    sun(g, PRINT_W * 0.375, 28, 15, GOLD);
    grain(g, 31);
  },
  /** Patchwork: squares of related hues, teal to violet to ochre, with a few in mint. */
  patchwork: (g) => {
    g.fillStyle = TEAL_DEEP;
    g.fillRect(0, 0, PRINT_W, PRINT_H);
    tiles(g, 0, 0, PRINT_W, PRINT_H, 12, [TEAL, VIOLET, LILAC, OCHRE, SALMON, MINT, TEAL_DEEP], 41);
    // Smaller tiles over a third of the big ones.
    for (let y = 0; y < PRINT_H; y += 12) for (let x = 0; x < PRINT_W; x += 12) if (h2(x, y, 43) < 0.3) tiles(g, x, y, 12, 12, 4, [CREAM, GOLD, PINK, LILAC], 44);
    grain(g, 45);
  },
  /** A mosaic ground: the herald's field, tiles of teal and lilac and gold with a cream grout. */
  mosaic: (g) => {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, PRINT_W, PRINT_H);
    tiles(g, 0, 0, PRINT_W, PRINT_H, 6, [TEAL, LILAC, GOLD, MINT, VIOLET, SALMON], 51);
    grain(g, 52);
  },
};
