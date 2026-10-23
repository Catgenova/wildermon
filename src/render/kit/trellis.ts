import { WALL_HEIGHT, WALL_THICK } from '../../game/building';
import { SUBTILES } from '../../game/crates';
import { UNITS_PER_TILE } from '../iso';
import { drawFaces } from '../runestone';
import {
  css, deeper, grain, hex, KIT_INK, KIT_INK_W, mix, paler, proj, slab, TAU, woodTone,
  type Ctx, type Eye, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type RGB, type Side, type V3,
} from './core';
import { strut } from './outdoor';

/**
 * A trellis (`trellis`, a tile along a wall), in the kit: set against the
 * outer face of a wall and running its width (`vineyard.ts`), its front toward
 * the wall and standing just clear of it. Three square posts of the wood it
 * was built of, two-thirds of a storey high and capped; a rail along the
 * foot, the middle and the head; laths crossed corner to corner between them
 * in a diamond lattice, the layer nearer you laid over the other; and the
 * vine on it as far as it has grown. Beside another along the same wall it
 * runs on to the edge of its tile and the two share a post.
 *
 * Its `trim` is the old model's (`vineTrim` in furniture.ts), read the same
 * way: the vine's stage (none, young, grown, ripe) in its lowest two bits,
 * which of `VINE_VARIANTS` ways it grew over that, and the neighbours it
 * joins (`VINE_JOIN`) over that.
 */

/** How many ways a vine is grown (`VINE_VARIANTS`), and where in the trim the joins start (`VINE_JOIN`). */
const VINE_VARIANTS = 6;
const VINE_JOIN = 4 * VINE_VARIANTS;
/** Half its span, end post to end post; how high its head is; and how far toward its front the lattice stands (`TRELLIS_*` in furniture.ts). */
const SPAN = UNITS_PER_TILE / 2 - WALL_THICK * UNITS_PER_TILE - 0.5;
const H = (WALL_HEIGHT * 2) / 3;
const LY = UNITS_PER_TILE / SUBTILES / 2 - WALL_THICK * UNITS_PER_TILE - 0.9;
const EDGE = UNITS_PER_TILE / 2;

/** A grapevine's leaves, lit, mid and deep; its wood; its grapes and the bloom on them. */
const LEAF: RGB[] = [hex('#b0d684'), hex('#74a85a'), hex('#4c7a48')];
const STEM: RGB = hex('#86684e');
const GRAPE: RGB = hex('#6a4c84'), BLOOM: RGB = hex('#b4a2d0');
/** The ink round leaf and stem: a deep green, and the kit's warm brown. */
const LEAF_INK: RGB = mix(LEAF[2], KIT_INK, 0.35);
const INK = 0.8;

/* ---- the vine ---------------------------------------------------------------------------- */

/** A run of rod through `pts` on the screen, `r` units about its line tapering to `r1`: inked, then filled. */
function rod(g: Ctx, e: Eye, pts: V3[], r: number, r1 = r, fill: RGB = STEM): void {
  const across = Math.hypot(e.ux, e.vx);
  const scr = pts.map((p) => proj(e, p));
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const pass of [0, 1]) {
    for (let i = 1; i < scr.length; i++) {
      const w = (r + ((r1 - r) * i) / (scr.length - 1)) * 2 * across;
      g.beginPath();
      g.moveTo(scr[i - 1][0], scr[i - 1][1]);
      g.lineTo(scr[i][0], scr[i][1]);
      g.strokeStyle = pass ? css(fill) : css(mix(fill, KIT_INK, 0.55));
      g.lineWidth = pass ? w : w + INK * 1.4;
      g.stroke();
    }
  }
}

/**
 * The vine on a trellis, as the old model grows it (`grapevine` in
 * furniture.ts): one stem up from the foot to a little under the middle rail,
 * an arm along the lattice each way to its ends, canes off the arms to its
 * head; young, the stem and its first few leaves; grown, leaf over the whole
 * lattice; ripe, its bunches hanging along the arms and off the canes.
 */
function vine(g: Ctx, e: Eye, trim: number, X0: number, X1: number, ly: number): void {
  const stage = trim % 4;
  if (stage <= 0) return;
  const variant = Math.floor(trim / 4) % VINE_VARIANTS;
  const ACROSS = Math.max(3, Math.round((9 * (X1 - X0)) / (2 * SPAN)));
  const unit = Math.hypot(e.ux, e.vx);
  const jit = (i: number, k: number): number => {
    const v = Math.sin(i * 12.9898 + k * 78.233 + variant * 4.123) * 43758.5453;
    return v - Math.floor(v);
  };
  const fy = (d: number): number => ly - d;
  const ARM = H * 0.36;
  const mid = (X0 + X1) / 2, half = (X1 - X0) / 2;
  const foot = mid + (jit(1, 1) - 0.5) * half * 0.5;
  /** A vine leaf at (x, y) turned to `a`, `L` across: five lobes round the notch its stalk goes into. */
  const vineLeaf = (x: number, y: number, a: number, L: number, c: RGB, veins: boolean): void => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    const R = L / 2;
    g.beginPath();
    g.moveTo(0, R * 0.55);
    g.quadraticCurveTo(-R * 0.55, R * 0.62, -R * 0.78, R * 0.18);
    g.quadraticCurveTo(-R * 1.08, -R * 0.12, -R * 0.62, -R * 0.42);
    g.quadraticCurveTo(-R * 0.42, -R * 0.98, 0, -R * 0.96);
    g.quadraticCurveTo(R * 0.42, -R * 0.98, R * 0.62, -R * 0.42);
    g.quadraticCurveTo(R * 1.08, -R * 0.12, R * 0.78, R * 0.18);
    g.quadraticCurveTo(R * 0.55, R * 0.62, 0, R * 0.55);
    g.closePath();
    g.fillStyle = css(c);
    g.fill();
    g.strokeStyle = css(LEAF_INK, 0.85);
    g.lineWidth = INK * 0.55;
    g.stroke();
    if (veins && L > 3) {
      g.beginPath();
      for (const t of [-0.75, -0.3, 0.3, 0.75]) {
        g.moveTo(0, R * 0.4);
        g.lineTo(Math.sin(t * 1.6) * R * 0.66, R * 0.4 - Math.cos(t * 1.6) * R * 0.9);
      }
      g.strokeStyle = css(LEAF[2], 0.5);
      g.lineWidth = INK * 0.4;
      g.stroke();
    }
    g.restore();
  };
  /** A bunch of grapes hanging from (x, y): berries in narrowing rows, inked, the bloom on their lit side. */
  const bunch = (x: number, y: number, B: number, rows: number, lean: number): void => {
    g.beginPath();
    g.moveTo(x, y - B * 0.6);
    g.lineTo(x + lean * B, y + B * 0.2);
    g.strokeStyle = css(STEM);
    g.lineWidth = INK * 0.7;
    g.stroke();
    const berries: Array<[number, number]> = [];
    for (let row = 0; row < rows; row++) {
      const n = Math.max(1, Math.round((rows - row) * 0.8 + (row === 0 ? 0.6 : 0)));
      for (let c = 0; c < n; c++) berries.push([x + lean * B * (1 + row * 0.25) + (c - (n - 1) / 2) * B * 0.92, y + B * (0.55 + row * 0.8)]);
    }
    g.beginPath();
    for (const [bx, by] of berries) { g.moveTo(bx + B * 0.62, by); g.arc(bx, by, B * 0.62, 0, TAU); }
    g.strokeStyle = css(mix(GRAPE, KIT_INK, 0.55));
    g.lineWidth = INK * 1.2;
    g.stroke();
    berries.forEach(([bx, by], k) => {
      g.beginPath();
      g.arc(bx, by, B * 0.52, 0, TAU);
      g.fillStyle = css(k % 3 === 1 ? mix(GRAPE, [255, 255, 255], 0.12) : k % 3 === 2 ? mix(GRAPE, KIT_INK, 0.12) : GRAPE);
      g.fill();
    });
    for (const [bx, by] of berries) {
      g.beginPath();
      g.arc(bx - B * 0.18, by - B * 0.2, B * 0.17, 0, TAU);
      g.fillStyle = css(BLOOM, 0.85);
      g.fill();
    }
  };
  /** A mass of leaf at `at`, `r` across, with `grapes` bunches under it; or, `single`, a young vine's leaf or two. */
  const masses: Array<{ at: V3; draw: () => void }> = [];
  const mass = (at: V3, r: number, seed: number, grapes: number, single = false): void => {
    masses.push({ at, draw: () => {
      const [px, py] = proj(e, at);
      const R = r * unit;
      if (single) {
        vineLeaf(px, py, (jit(seed, 30) - 0.5) * 1.4, R * 1.5, LEAF[1], true);
        if (jit(seed, 31) < 0.6) vineLeaf(px + (jit(seed, 32) - 0.5) * R * 1.2, py - R * 0.5, (jit(seed, 33) - 0.5) * 1.6, R * 1.05, LEAF[0], true);
        return;
      }
      const lobes: Array<[number, number, number]> = [[-0.58, 0.12, 0.46], [0.56, 0.08, 0.44], [-0.12, -0.34, 0.48], [0.3, -0.3, 0.42], [-0.22, 0.36, 0.4], [0.24, 0.34, 0.4], [0, 0, 0.56]];
      g.beginPath();
      for (const [lx, lz, lr] of lobes) {
        g.moveTo(px + lx * R + lr * R, py + lz * R * 0.86);
        g.ellipse(px + lx * R, py + lz * R * 0.86, lr * R, lr * R * 0.86, 0, 0, TAU);
      }
      g.strokeStyle = css(LEAF_INK, 0.95);
      g.lineWidth = INK * 1.4;
      g.stroke();
      g.fillStyle = css(mix(LEAF[2], LEAF[1], 0.25));
      g.fill();
      const N = 7;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * TAU + jit(seed, 40 + k) * 0.7;
        const deep = Math.sin(a) > 0.35;
        const d = 0.5 + 0.18 * jit(seed, 45 + k);
        vineLeaf(px + Math.cos(a) * R * d * 1.1, py + Math.sin(a) * R * d * 0.85, a + Math.PI / 2 + (jit(seed, 50 + k) - 0.5) * 0.6, R * (0.66 + 0.2 * jit(seed, 60 + k)), deep ? LEAF[2] : LEAF[1], !deep);
      }
      vineLeaf(px + (jit(seed, 70) - 0.6) * R * 0.6, py - R * (0.18 + 0.14 * jit(seed, 71)), (jit(seed, 72) - 0.5) * 0.9, R * (0.62 + 0.14 * jit(seed, 73)), LEAF[0], true);
      for (let b = 0; b < grapes; b++) {
        const bx = px + (grapes === 1 ? (jit(seed, 80) - 0.5) * 0.6 : b === 0 ? -0.42 : 0.4) * R;
        bunch(bx, py + R * (0.42 + 0.12 * jit(seed, 81 + b)), Math.max(1, R * 0.21), 4 + Math.round(jit(seed, 83 + b) * 1.6), (jit(seed, 85 + b) - 0.5) * 0.5);
      }
    } });
  };
  const flush = (): void => {
    masses.sort((a, b) => a.at[0] * e.toward[0] + a.at[1] * e.toward[1] + a.at[2] * e.toward[2] - (b.at[0] * e.toward[0] + b.at[1] * e.toward[1] + b.at[2] * e.toward[2]));
    for (const m of masses) m.draw();
  };

  // The stem, up from the foot: a young one only so far.
  const stemTop = stage === 1 ? H * 0.52 : ARM;
  const stem: V3[] = [];
  for (let k = 0; k <= 6; k++) {
    const q = k / 6;
    stem.push([foot + Math.sin(q * 5 + variant) * 0.7 * (1 - q * 0.5), fy(0.5), 0.2 + (stemTop - 0.2) * q]);
  }
  rod(g, e, stem, stage === 1 ? 0.22 : 0.42, stage === 1 ? 0.2 : 0.3);
  if (stage === 1) {
    rod(g, e, [stem[3], [stem[3][0] + (jit(2, 2) < 0.5 ? -3.2 : 3.2), fy(0.5), stem[3][2] + 2.2]], 0.14);
    for (let i = 0; i < 5; i++) {
      const q = 0.25 + i * 0.17;
      const x = foot + (i % 2 ? 1 : -1) * (1 + 1.4 * jit(i, 3));
      mass([x, fy(0.9), 0.4 + stemTop * q], 1.9 + 0.7 * jit(i, 4) * (1 - q * 0.4), i + 11, 0, true);
    }
    const top = stem[stem.length - 1];
    mass([top[0], fy(0.9), top[2] + 0.6], 1.4, 19, 0, true);
    flush();
    return;
  }
  // The two arms, along the lattice to its ends, and the canes off them up to the head.
  const armAt = (x: number): number => ARM + Math.sin(x * 0.45 + variant * 1.7) * 0.5;
  for (const m of [-1, 1]) {
    const pts: V3[] = [[foot, fy(0.4), ARM]];
    for (let k = 1; k <= 8; k++) {
      const x = foot + ((m < 0 ? X0 + 0.8 : X1 - 0.8) - foot) * k / 8;
      pts.push([x, fy(0.4), armAt(x)]);
    }
    rod(g, e, pts, 0.3, 0.18);
  }
  const CANES = 9;
  for (let c = 0; c < CANES; c++) {
    const x = X0 + 1.6 + ((X1 - X0 - 3.2) * (c + 0.2 + 0.6 * jit(c, 5))) / CANES;
    rod(g, e, [[x, fy(0.4), armAt(x)], [x + (jit(c, 6) - 0.5) * 2.4, fy(0.5), H - 0.6 - 1.4 * jit(c, 7)]], 0.16);
  }
  // Leaf over the whole of it: in rows from just under the arms to the head, end to end.
  const ripe = stage === 3;
  const ROWS = [ARM - 2.6, ARM + 2.4, ARM + (H - ARM) * 0.55, H - 2.2];
  let n = 0;
  ROWS.forEach((z0, row) => {
    const across = row === 0 ? ACROSS - 2 : ACROSS;
    for (let i = 0; i < across; i++) {
      const seed = row * 31 + i;
      const x = X0 + 1.5 + ((X1 - X0 - 3) * (i + 0.5 + (jit(seed, 8) - 0.5) * 0.55)) / across;
      const z = z0 + (jit(seed, 9) - 0.5) * 1.6;
      const r = row === 0 ? 1.8 + 0.6 * jit(seed, 10) : 2.3 + 0.8 * jit(seed, 10);
      const xs = Math.max(X0 + r * 0.75, Math.min(X1 - r * 0.75, x));
      const grapes = !ripe ? 0 : row === 1 ? (jit(seed, 11) < 0.25 ? 1 : 2) : row === 2 ? (jit(seed, 12) < 0.7 ? 1 : 0) : 0;
      mass([xs, fy(0.9 + 0.5 * jit(seed, 13)), z], r, seed + 100 + n++, grapes);
    }
  });
  flush();
}

/* ---- the frame ----------------------------------------------------------------------------- */

function trellisOf(look: KitLook): KitModel {
  const t = look.trim ?? 0, join = Math.floor(t / VINE_JOIN);
  const left = (join & 1) !== 0, right = (join & 2) !== 0;
  const X0 = left ? -EDGE : -SPAN, X1 = right ? EDGE : SPAN;
  const WOOD = woodTone(look.material);
  const LATH = paler(WOOD, 0.1);
  const RAIL = deeper(WOOD, 0.06);
  const parts: KitPart[] = [];

  /*
   * The laths, crossed: each at a slope of one up the lattice from rail to
   * rail, on a pitch that goes into a tile a whole number of times from its
   * edge, so a run of trellises along a wall is one lattice. One part, laid a
   * layer at a time -- the one away from you, then the one over it -- each
   * lath ruled round on its own.
   */
  const Z0 = 1.4, Z1 = H - 0.4, STEP = UNITS_PER_TILE / 12;
  const laths: Array<{ layer: number; faces: Face[] }> = [];
  for (const dir of [1, -1]) {
    for (let k = -12; k <= 24; k++) {
      const c = -EDGE + k * STEP;
      const xAt = (z: number): number => dir * (c + (z - Z0));
      const zAt = (x: number): number => dir * x - c + Z0;
      const za = Math.max(Z0, zAt(dir > 0 ? X0 : X1)), zb = Math.min(Z1, zAt(dir > 0 ? X1 : X0));
      if (zb - za < 0.6) continue;
      const y = LY + dir * 0.17;
      laths.push({ layer: dir, faces: strut([xAt(za), y, za], [xAt(zb), y, zb], 0.46, 0.28, LATH, (g, k2, s) => grain(g, k2.fill, s.w, s.h, 7 + laths.length, 'x', 0.4), [0, 1, 0]) });
    }
  }
  const lattice: KitPart = {
    reach: [[X0, LY - 0.33, Z0], [X1, LY + 0.33, Z1]],
    solid: true,
    draw: (g, e) => {
      const near = e.toward[1] > 0 ? 1 : -1;
      for (const layer of [-near, near]) for (const l of laths) if (l.layer === layer) drawFaces(g, e, l.faces, KIT_INK_W * 0.85, KIT_INK);
    },
  };
  parts.push(lattice);

  // The posts, one at each end -- but not the right-hand one where it runs on into a neighbour, whose left-hand post that is -- and one in the middle.
  const posts = [X0, (X0 + X1) / 2, ...(right ? [] : [X1])];
  for (const [i, x] of posts.entries()) {
    const side = (n: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 30 + i * 4 + n, 'y', 0.7);
    parts.push({ faces: slab(x - 0.58, x + 0.58, LY - 0.52, LY + 0.52, 0, H + 0.6, WOOD, { corner: 0.12, paint: { front: side(0), back: side(1), left: side(2), right: side(3) } }), after: [lattice] });
    parts.push({ faces: slab(x - 0.82, x + 0.82, LY - 0.76, LY + 0.76, H + 0.6, H + 1.15, paler(WOOD, 0.08), { corner: 0.18, bevel: 0.16 }), edges: true });
  }
  // The rails at the foot, the middle and the head, between the posts.
  const stops = [...posts.map((x) => [x - 0.58, x + 0.58]), ...(right ? [[X1, X1]] : [])].sort((a, b) => a[0] - b[0]);
  for (const [r, z] of [0.9, H * 0.5, H - 0.1].entries()) {
    for (let j = 0; j + 1 < stops.length; j++) {
      const a = stops[j][1], b = stops[j + 1][0];
      if (b - a < 0.2) continue;
      const along = (n: number) => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, 50 + r * 9 + j * 3 + n, 'x', 0.6);
      parts.push({ faces: slab(a, b, LY - 0.38, LY + 0.38, z - 0.42, z + 0.42, RAIL, { paint: { front: along(0), back: along(1) } }), after: [lattice], edges: true });
    }
  }

  // The vine, standing out in front of the lattice on the side away from the wall.
  const stage = t % VINE_JOIN;
  if (stage % 4) {
    parts.push({
      reach: [[X0, LY - 1.0, 0], [X1, LY - 0.53, H + 1]],
      solid: false,
      draw: (g, e) => vine(g, e, stage, X0, X1, LY - 0.5),
    });
  }
  return { parts, shade: [[X0 - 0.6, LY - 1.6, 0], [X1 + 0.6, LY - 1.6, 0], [X1 + 0.6, LY + 0.6, 0], [X0 - 0.6, LY + 0.6, 0]] };
}

/** A trellis's trim, as `vineTrim` makes it: the stage (0 none, 1 young, 2 grown, 3 ripe), the variant, and the joins. */
const trimOf = (stage: number, variant = 0, left = false, right = false): number => stage + 4 * variant + VINE_JOIN * ((left ? 1 : 0) + (right ? 2 : 0));

export const TRELLIS: KitPiece = {
  model: (look) => trellisOf(look),
  uses: { trim: true, material: true },
  states: [
    { trim: trimOf(1, 0), label: 'young' },
    { trim: trimOf(2, 1), label: 'grown' },
    { trim: trimOf(3, 2), label: 'ripe' },
    { trim: trimOf(3, 4, true, false), label: 'ripe, joins left' },
    { trim: trimOf(2, 5, true, true), label: 'grown, joins both' },
  ],
};
