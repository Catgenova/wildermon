import {
  boards, clothTone, css, deeper, faceColour, hex, mix, paler, seam, slab, TAU, toneOf, turned, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type RGB, type Side, type Tone,
} from './core';
import { GLAZE, hollow, STONEWARE, turnedWith } from './cases';
import { grained, topGrain } from './joinery';

/**
 * The open shelving (`shelves`, `bookshelf`, `crate_shelf`), in the kit.
 *
 * Shelves: three bays between four uprights, boarded at the back, four
 * shelves and a cap, with what is kept on them -- crocks, glazed jars, green
 * bottles and linen sacks -- and two more crocks on top. A bookshelf: two
 * sides on a plinth, a boarded back, two shelves and a cap, a row of books on
 * each shelf in runs of a height, the odd gap and one book leant over. A
 * crate shelf: a pallet rack two tiers high and two bays long, its decks
 * slatted, and the crates on it as `trim` says (`Renderer.pieceTrim`: a bit a
 * spot), drawn as the old rack drew them -- bit `k` on tier `k >> 2`, bay
 * `k & 3` from the front.
 *
 * The wood is what it was built of; dyed, its boards are painted in the dye.
 * What is on them keeps its own colours.
 */

const addTo = (parts: KitPart[]) => (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
  const p: KitPart = { faces, ...more };
  parts.push(p);
  return p;
};

/* ---- what is kept on shelves ---------------------------------------------------- */

/** Green glass. */
const GLASS: Tone = toneOf('#b6d4b4', '#62807a');

type Ware = 'crock' | 'jar' | 'bottle' | 'sack';

/** A thing kept, standing at (x, y) on a shelf at `z`. */
function ware(kind: Ware, x: number, y: number, z: number): Face[] {
  switch (kind) {
    case 'crock':
      // Stoneware, its lid on, a knob on that.
      return turnedWith(x, y, [[z, 0.82], [z + 0.3, 1.0], [z + 1.35, 1.05], [z + 1.85, 0.86], [z + 2.0, 0.7], [z + 2.15, 0.74], [z + 2.25, 0.66]], 10, STONEWARE,
        (g, k) => { g.beginPath(); g.arc(0, 0, 0.26, 0, TAU); g.fillStyle = css(mix(k.fill, hex('#5a4458'), 0.35)); g.fill(); },
        (g, k, s, band) => { if (band === 1) { g.fillStyle = css(faceColour(GLAZE, k.L), 0.9); g.fillRect(-0.5, s.h * 0.62, s.w + 1, s.h * 0.2); } });
    case 'jar':
      return turnedWith(x, y, [[z, 0.6], [z + 0.2, 0.74], [z + 1.0, 0.72], [z + 1.25, 0.5], [z + 1.55, 0.52]], 10, GLAZE, hollow(0.36, 0.5));
    case 'bottle':
      return turnedWith(x, y, [[z, 0.44], [z + 1.55, 0.46], [z + 1.95, 0.24], [z + 2.4, 0.16], [z + 2.55, 0.2]], 8, GLASS,
        (g, k) => { g.beginPath(); g.arc(0, 0, 0.12, 0, TAU); g.fillStyle = css(mix(k.fill, hex('#8a6448'), 0.7)); g.fill(); });
    case 'sack':
      return turnedWith(x, y, [[z, 1.05], [z + 0.35, 1.25], [z + 1.2, 1.15], [z + 1.75, 0.7], [z + 2.0, 0.3], [z + 2.12, 0.45], [z + 2.35, 0.3]], 8, clothTone(), undefined,
        (g, k, s, band) => { if (band === 3) { g.fillStyle = css(mix(k.fill, hex('#8a6e58'), 0.45)); g.fillRect(-0.5, s.h - 0.2, s.w + 1, 0.2); } });
  }
}

/* ---- shelves --------------------------------------------------------------------- */

function shelvesOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.08);
  const BACK = deeper(WOOD, 0.25);
  const x = hw - 1.5, y = hd - 2.5, H = 12.4;
  const parts: KitPart[] = [];
  const add = addTo(parts);
  // Boarded at the back, the boards running up it.
  add(slab(-x, x, -y - 0.35, -y, 0, H, BACK, {
    paint: { front: (g, k, s) => boards(g, k.fill, s.w, s.h, 9, 11, 'y'), back: (g, k, s) => boards(g, k.fill, s.w, s.h, 9, 12, 'y') },
  }));
  const posts = [-x, -x / 3, x / 3, x];
  posts.forEach((px, i) => add(slab(px - 0.4, px + 0.4, -y, y + 0.1, 0, H, WOOD, {
    corner: 0.1, paint: { front: grained(21 + i, 'y'), left: grained(25 + i, 'y'), right: grained(29 + i, 'y') },
  })));
  // The shelves in each bay: the lowest a deep board on the floor, then three over it.
  const levels: Array<[number, number]> = [[0, 0.7], [4.3, 4.75], [8.2, 8.65], [11.9, H]];
  for (let b = 0; b < 3; b++) {
    const x0 = posts[b] + 0.4, x1 = posts[b + 1] - 0.4;
    levels.forEach(([z0, z1], i) => add(slab(x0, x1, -y, y, z0, z1, TOP, {
      paint: { front: grained(40 + b * 4 + i, 'x', 0.6), top: topGrain(50 + b * 4 + i, 'x', 0.5) },
    }), { edges: true }));
  }
  // The cap over all of it.
  const capTop = H + 0.5;
  add(slab(-x - 0.55, x + 0.55, -y - 0.6, y + 0.4, H, capTop, TOP, {
    corner: 0.2, bevel: 0.2,
    paint: { front: grained(61, 'x', 0.6), top: topGrain(62, 'x', 0.5), left: grained(63), right: grained(64) },
  }), { edges: true });
  // What is kept on them, from the floor up, and on top.
  const kept: Array<[number, Ware]>[] = [
    [[-11, 'sack'], [-7.2, 'crock'], [-2.6, 'crock'], [0.2, 'jar'], [2.4, 'jar'], [7.5, 'sack'], [11.2, 'crock']],
    [[-11.4, 'bottle'], [-10, 'bottle'], [-6.8, 'jar'], [-1.5, 'crock'], [2.2, 'bottle'], [6.5, 'crock'], [10.5, 'jar'], [12.1, 'jar']],
    [[-10.5, 'jar'], [-7.5, 'crock'], [-2.8, 'sack'], [1.8, 'jar'], [7, 'bottle'], [8.3, 'bottle'], [11.2, 'crock']],
    [[-10.4, 'crock'], [-8.1, 'jar'], [10.4, 'crock']],
  ];
  const sx = x / 13.5;
  kept.forEach((row, i) => {
    const z = i < 3 ? levels[i][1] : capTop;
    for (const [wx, kind] of row) add(ware(kind, wx * sx, 0.2, z), { edges: true });
  });
  return { parts, shade: [[-x - 0.4, -y - 0.4, 0], [x + 0.4, -y - 0.4, 0], [x + 0.4, y + 0.1, 0], [-x - 0.4, y + 0.1, 0]] };
}

/* ---- the bookshelf ------------------------------------------------------------------ */

/** Cloth-bound covers, in the island's pastels: madder, woad, sage, ochre, plum, teal, rust and slate. */
const BOOKS: Tone[] = [
  toneOf('#cf8476', '#7a4650'), toneOf('#8aa2cc', '#4e5a82'), toneOf('#a8b47a', '#5e6650'), toneOf('#dcb06a', '#86664a'),
  toneOf('#a888b4', '#5c4a6c'), toneOf('#7ab2a8', '#456a6a'), toneOf('#da9672', '#86564e'), toneOf('#959ebe', '#545a78'),
];
const PAGES: RGB = hex('#f6ecd6');

/** A run of books standing together, `widths` across from its left, `colours` theirs: the spines on its front, the tops of their pages over it. */
function bookRun(x0: number, widths: number[], colours: number[], y0: number, y1: number, z0: number, h: number): Face[] {
  const x1 = x0 + widths.reduce((s, w) => s + w, 0);
  const tone = BOOKS[colours[0]];
  const edges = widths.reduce<number[]>((a, w) => [...a, a[a.length - 1] + w], [0]);
  const books = (g: Ctx, k: PaintCtx, along: (i: number) => [number, number], each: (i: number, a: number, b: number, c: RGB) => void): void => {
    widths.forEach((_, i) => {
      const [a, b] = along(i);
      const c = faceColour(BOOKS[colours[i]], k.L);
      g.fillStyle = css(c);
      g.fillRect(a, -50, b - a, 100);
      each(i, a, b, c);
    });
  };
  return slab(x0, x1, y0, y1, z0, z0 + h, tone, {
    crease: 0.3,
    paint: {
      front: (g, k, s) => books(g, k, (i) => [edges[i], edges[i + 1]], (i, a, b, c) => {
        // A gilt band at the head and foot of each spine, and the shade between two.
        g.fillStyle = css(mix(c, hex('#f6dc9a'), 0.6), 0.9);
        g.fillRect(a + 0.08, s.h - 0.55, b - a - 0.16, 0.14);
        g.fillRect(a + 0.08, 0.35, b - a - 0.16, 0.14);
        if (i) { g.fillStyle = css(mix(c, hex('#3e2c38'), 0.55), 0.9); g.fillRect(a - 0.04, 0, 0.08, s.h); }
      }),
      back: (g, k, s) => books(g, k, (i) => [s.w - edges[i + 1], s.w - edges[i]], (_i, a, b) => {
        g.fillStyle = css(mix(PAGES, faceColour(tone, k.L), 0.3));
        g.fillRect(a + 0.07, 0.07, b - a - 0.14, s.h - 0.14);
      }),
      top: (g, k, s) => books(g, k, (i) => [edges[i] - s.w / 2, edges[i + 1] - s.w / 2], (_i, a, b) => {
        // The pages' heads, inside the covers, the spine at the front.
        g.fillStyle = css(mix(PAGES, [255, 255, 255], Math.max(0, k.L - 0.9)));
        g.fillRect(a + 0.08, -s.h / 2 + 0.08, b - a - 0.16, s.h - 0.42);
      }),
      left: (g, k) => { g.fillStyle = css(faceColour(BOOKS[colours[0]], k.L)); g.fillRect(-50, -50, 100, 100); },
      right: (g, k) => { g.fillStyle = css(faceColour(BOOKS[colours[colours.length - 1]], k.L)); g.fillRect(-50, -50, 100, 100); },
    },
  });
}

function bookshelfOf(look: KitLook, hw: number, hd: number): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.08);
  const BACK = deeper(WOOD, 0.25);
  const BASE = deeper(woodTone(look.material), 0.22);
  const x = hw - 1.8, y = hd - 2.4, H = 11;
  const T = 0.35;
  const parts: KitPart[] = [];
  const add = addTo(parts);
  for (const [i, px] of [-x, x].entries()) {
    add(slab(px - T, px + T, -y - 0.35, y, 0, H, WOOD, {
      corner: 0.08, paint: { front: grained(11 + i, 'y'), left: grained(13 + i, 'y'), right: grained(15 + i, 'y'), back: grained(17 + i, 'y') },
    }));
  }
  add(slab(-x + T, x - T, -y - 0.35, -y, 0.8, H, BACK, { paint: { front: (g, k, s) => boards(g, k.fill, s.w, s.h, 6, 21, 'y'), back: (g, k, s) => boards(g, k.fill, s.w, s.h, 6, 22, 'y') } }));
  add(slab(-x + T, x - T, -y, y, 0, 0.8, BASE, { paint: { front: grained(23, 'x', 0.5), top: topGrain(24, 'x', 0.5) } }), { edges: true });
  const shelves = [0.8, 4.2, 7.6];
  const boardsUnder = [parts[parts.length - 1]];
  for (const [i, z] of shelves.slice(1).entries()) {
    boardsUnder.push(add(slab(-x + T, x - T, -y, y, z - 0.4, z, TOP, { paint: { front: grained(31 + i, 'x', 0.6), top: topGrain(33 + i, 'x', 0.5) } }), { edges: true }));
  }
  add(slab(-x - 0.55, x + 0.55, -y - 0.75, y + 0.45, H, H + 0.65, TOP, {
    corner: 0.2, bevel: 0.24,
    paint: { front: grained(41, 'x', 0.6), top: topGrain(42, 'x', 0.5), left: grained(43), right: grained(44), back: grained(45) },
  }), { edges: true });

  /*
   * The books: runs of two to four of a height, an empty space now and then,
   * and one leant over in the middle row. Each row is laid after its shelf
   * and everything on the rows under it: a run at one end of a row is clear
   * along x of a run at the other end of the row below, and their boxes alone
   * would put them in an order the shelf between them cannot keep.
   */
  const below: KitPart[] = [];
  const left = -x + T + 0.15, right = x - T - 0.15;
  shelves.forEach((z, row) => {
    const on = (faces: Face[]): void => { mine.push(add(faces, { after: [boardsUnder[row], ...below] })); };
    const mine: KitPart[] = [];
    let bx = left;
    let n = row * 7 + 3;
    const R = (m: number): number => { n = (n * 37 + 11) % 101; return n % m; };
    let leant = row !== 1;
    while (bx < right - 0.6) {
      const count = 2 + R(3);
      const widths = Array.from({ length: count }, () => 0.5 + R(3) * 0.08);
      const colours = Array.from({ length: count }, () => R(BOOKS.length));
      let w = widths.reduce((s, v) => s + v, 0);
      if (bx + w > right) {
        while (widths.length > 1 && bx + w > right) w -= widths.pop()!;
        if (bx + w > right) break;
        colours.length = widths.length;
      }
      const h = 2.25 + R(4) * 0.2;
      on(bookRun(bx, widths, colours, -y + 0.25, y - 0.45, z, h));
      bx += w + 0.03;
      // Now and then a gap, with a book leant into it against the run before.
      if (R(4) === 0 && bx < right - 2) {
        if (!leant) {
          leant = true;
          const bw = 0.55, bh = 2.5, gap = 1.5;
          const book = bookRun(bx + gap - bw, [bw], [R(BOOKS.length)], -y + 0.25, y - 0.45, z, bh);
          // Leant to the left on the edge of its foot, its head against the run before.
          on(turned(book, [bx + gap - bw, 0, z], [0, 1, 0], -Math.asin((gap - bw - 0.05) / bh)));
          bx += gap + 0.05;
        } else bx += 0.9 + R(2) * 0.4;
      }
    }
    below.push(...mine);
  });
  return { parts, shade: [[-x - 0.4, -y - 0.4, 0], [x + 0.4, -y - 0.4, 0], [x + 0.4, y + 0.1, 0], [-x - 0.4, y + 0.1, 0]] };
}

/* ---- the crate shelf ------------------------------------------------------------------ */

/** A crate's planks: a shade paler than any frame it stands on, so a crate on a rack of the same wood still stands out from it. */
const CRATE_BOARD = hex('#c9a46c');
const CRATE: Tone = { lit: mix(CRATE_BOARD, hex('#fff2dc'), 0.2), shade: mix(CRATE_BOARD, hex('#6a5468'), 0.55) };

/** A plank crate's side: three boards, a batten up each end, a brace across. */
function crateSide(seed: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    boards(g, k.fill, s.w, s.h, 3, seed);
    const dark = css(mix(k.fill, hex('#5a4050'), 0.28));
    g.fillStyle = dark;
    g.fillRect(0, 0, 0.75, s.h);
    g.fillRect(s.w - 0.75, 0, 0.75, s.h);
    seam(g, k.fill, 0.75, 0, 0.75, s.h, 0.12);
    seam(g, k.fill, s.w - 0.75, 0, s.w - 0.75, s.h, 0.12);
  };
}

function crate(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Face[] {
  return slab(x0, x1, y0, y1, z0, z1, CRATE, {
    corner: 0.12, bevel: 0.12,
    paint: {
      front: crateSide(71), back: crateSide(72), left: crateSide(73), right: crateSide(74),
      top: (g, k, s) => {
        g.save();
        g.translate(-s.w / 2, -s.h / 2);
        boards(g, k.fill, s.w, s.h, 4, 75, 'x');
        g.fillStyle = css(mix(k.fill, hex('#5a4050'), 0.22));
        for (const t of [0.7, s.w - 1.5]) g.fillRect(t, 0, 0.8, s.h);
        g.restore();
      },
    },
  });
}

/** The crate rack's tiers' decks: how high, and how many spots there are on each. */
const TIERS = [2.2, 9.0];

function crateShelfOf(look: KitLook, hw: number, hd: number): KitModel {
  // The frame a step deeper than the wood, so the crates (paler) stand out on it.
  const WOOD = deeper(woodTone(look.material, look.tint, 0.75), 0.2);
  const DECK = paler(WOOD, 0.06);
  const x = hw - 4.2, y = hd - 0.8, H = 14.6;
  const bay = (2 * y) / 4;
  const mask = Math.round(look.trim ?? 0);
  const parts: KitPart[] = [];
  const add = addTo(parts);
  const spans: Array<[number, number]> = [[-y + 0.5, -0.5], [0.5, y - 0.5]];
  // The uprights at its ends and its middle, and a tie across the head of each pair.
  [-y, 0, y].forEach((py, j) => {
    for (const [i, px] of [-x, x].entries()) {
      add(slab(px - 0.5, px + 0.5, py - 0.5, py + 0.5, 0, H, WOOD, {
        corner: 0.12, bevel: 0.15,
        paint: { front: grained(11 + i + j * 2, 'y'), back: grained(17 + i + j * 2, 'y'), left: grained(23 + i + j * 2, 'y'), right: grained(29 + i + j * 2, 'y') },
      }), { edges: true });
    }
    add(slab(-x + 0.5, x - 0.5, py - 0.4, py + 0.4, H - 1.0, H - 0.1, WOOD, {
      paint: { front: grained(35 + j, 'x'), back: grained(38 + j, 'x'), top: topGrain(41 + j, 'x') },
    }), { edges: true });
  });
  // Each tier: a runner down each side, and the deck slatted across between them.
  TIERS.forEach((z, t) => spans.forEach(([a, b], s) => {
    for (const [i, px] of [-x, x].entries()) {
      add(slab(px - 0.45, px + 0.45, a, b, z - 1.1, z - 0.1, WOOD, { paint: { left: grained(51 + t * 8 + s * 2 + i, 'x'), right: grained(61 + t * 8 + s * 2 + i, 'x') } }));
    }
    add(slab(-x + 0.45, x - 0.45, a, b, z - 0.5, z, DECK, {
      paint: {
        top: (g, k, sd) => {
          // The slats, a gap between each: the dark down between them.
          const n = Math.round(sd.h / 1.6);
          g.save();
          g.translate(-sd.w / 2, -sd.h / 2);
          for (let i = 0; i < n; i++) {
            g.save();
            g.translate(0, (i * sd.h) / n);
            topGrain(71 + i + t * 13 + s * 7, 'x', 0.5)(g, k, { w: sd.w, h: sd.h / n } as Side);
            g.restore();
            if (i) {
              g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.55), 0.9);
              g.fillRect(0, (i * sd.h) / n - 0.18, sd.w, 0.36);
            }
          }
          g.restore();
        },
        front: grained(91 + t * 2 + s, 'x'), back: grained(95 + t * 2 + s, 'x'),
      },
    }), { edges: true });
  }));
  // The crates, by the mask: bit k on tier k >> 2, bay k & 3 from the front.
  for (let k = 0; k < 8; k++) {
    if (!(mask & (1 << k))) continue;
    const z = TIERS[k >> 2], cy = y - ((k & 3) + 0.5) * bay;
    add(crate(-4.3, 4.3, cy - 4.1, cy + 4.1, z, z + 5), { edges: true });
  }
  return { parts, shade: [[-x - 0.6, -y - 0.6, 0], [x + 0.6, -y - 0.6, 0], [x + 0.6, y + 0.6, 0], [-x - 0.6, y + 0.6, 0]] };
}

export const SHELVES: KitPiece = { model: (look, s) => shelvesOf(look, s.hw, s.hd), uses: { tint: true, material: true } };
export const BOOKSHELF: KitPiece = { model: (look, s) => bookshelfOf(look, s.hw, s.hd), uses: { tint: true, material: true } };
export const CRATE_SHELF: KitPiece = {
  model: (look, s) => crateShelfOf(look, s.hw, s.hd),
  uses: { tint: true, material: true, trim: true },
  states: [
    { trim: 0, label: 'empty' },
    { trim: 0b00000001, label: 'one' },
    { trim: 0b00001111, label: 'low tier' },
    { trim: 0b10100101, label: 'four, mixed' },
    { trim: 0b11111111, label: 'full' },
  ],
};
