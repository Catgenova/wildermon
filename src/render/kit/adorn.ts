import { WALL_THICK } from '../../game/building';
import { HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import { rand } from '../ivy';
import {
  clothTone, css, deeper, grain, hex, IRON, lathe, mix, paler, prism, proj, slab, TAU, toneOf, warped, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type KitView, type PaintCtx, type RGB, type Side, type Tone, type V3,
} from './core';
import { leg, rod, woodSide, woodSides } from './woodwork';
import { DRESSED, STONE, stoneSkin, strut } from './outdoor';
import { glow } from './hearthstone';

/**
 * The adornments (`adorn.ts`), in the kit: a lily pond, an ivy wall panel, a
 * garden obelisk, a herb spiral, a buoy, a cauldron hearth, a cheese rack, a
 * pelt rug, a plush wildermon, a game table, a gem lamp, a pedigree board,
 * and the worker nameplate a wildermon bed wears.
 *
 * Each piece's `trim` is what it holds and how it stands, worked out by the
 * renderer off what the island keeps (`adornTrim` in `render/adornlook.ts`)
 * and read back here. A plush's kind is drawn as a soft portrait of its model
 * (`plushie`), as a carved figure's is cut in wood.
 */

const shadeOf = (x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
/** A round piece's shade: its own ring, not a square round it. */
const shadeRound = (r: number, n = 12): V3[] => Array.from({ length: n }, (_, i): V3 => [Math.cos((i / n) * TAU) * r, Math.sin((i / n) * TAU) * r, 0]);
const onScreen = (sx: number, sy: number, zoom: number, v: KitView, p: V3): [number, number] =>
  [sx + (p[0] * v.ux + p[1] * v.vx) * zoom, sy + (p[0] * v.uy + p[1] * v.vy - p[2] * HEIGHT_SCALE) * zoom];
const across = (e: { ux: number; vx: number }): number => Math.hypot(e.ux, e.vx);
const loose = (a: V3, b: V3, draw: (g: Ctx, e: import('../runestone').Eye) => void, solid = false, pad = 0): KitPart => ({
  reach: [0, 1, 2, 3, 4, 5, 6, 7].map((i): V3 => [i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]]), draw, solid, ...(pad ? { pad } : {}),
});
/** Where a wall's face is, from the middle of the row of spots along it (the fish mount's). */
const FACE_Y = UNITS_PER_TILE / 8 - WALL_THICK * UNITS_PER_TILE;
const DUSK: RGB = hex('#5a4660');
const CREAM: RGB = [255, 250, 240];
const toneFrom = (c: RGB, k = 0.42): Tone => ({ lit: mix(c, CREAM, 0.12), shade: mix(c, DUSK, k) });
/** A colour packed in fifteen bits, nought for none. */
export const colourCode = (h: string | undefined | null): number => {
  if (!h || !/^#[0-9a-f]{6}$/i.test(h)) return 0;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) >> 3);
  return 1 + ((r << 10) | (g << 5) | b);
};
const colourOf = (c: number): RGB | null => (c <= 0 ? null : [(((c - 1) >> 10) & 31) * 8.2, (((c - 1) >> 5) & 31) * 8.2, ((c - 1) & 31) * 8.2]);
const COLOUR_BASE = 32769;
const said = (t: number | undefined): number => Math.max(0, Math.floor(t ?? 0));
const LEAF: RGB = hex('#7fae6a'), LEAF_DEEP: RGB = hex('#557f5a');
const WATER: Tone = toneOf('#9fd0de', '#5f8aa4');
const SOIL: Tone = toneOf('#9a7a62', '#5e4652');
/** A stone set round, for edging: a slab knocked out of square, turned to face out from the middle at `a`. */
function edgeStone(r: number, a: number, w: number, d: number, h: number, seed: number): Face[] {
  const T = rand(seed);
  const s = slab(-w / 2, w / 2, -d / 2, d / 2, 0, h, STONE, { corner: 0.35, bevel: 0.3, paint: { front: stoneP(seed), back: stoneP(seed + 1), left: stoneP(seed + 2), right: stoneP(seed + 3), top: stoneP(seed + 4) } });
  // Each stone a little out of true, turned to face out from the middle, set at its place round the ring: frames carried with it.
  const kx = 0.9 + T() * 0.2, kz = 0.85 + T() * 0.3, b = a + Math.PI / 2, c = Math.cos(b), sn = Math.sin(b);
  return warped(s, ([x, y, z]): V3 => {
    const jx = x * kx;
    return [jx * c - y * sn + Math.cos(a) * r, jx * sn + y * c + Math.sin(a) * r, z * kz];
  });
}
const stoneP = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 0.9);

/* ---- 1. the lily pond ------------------------------------------------------------------------------- */

/** A pond's trim: its lily roots planted. */
export const pondTrim = (lilies: number): number => Math.max(0, Math.min(3, Math.floor(lilies)));
const POND_R = 5.8;
const PADS: Array<[number, number, number]> = [[-2.2, -1.2, 1.3], [2.1, 1.5, 1.1], [0.3, -2.8, 1.0]];

function pondOf(look: KitLook): KitModel {
  const n = said(look.trim);
  const parts: KitPart[] = [];
  // A bowl of still water a little under the rim, its lily pads floating on it, flowering.
  const water: KitPart = {
    faces: prism([12, 12].map((_, k) => Array.from({ length: 12 }, (__, i): V3 => {
      const a = ((i + 0.5) / 12) * TAU;
      return [Math.cos(a) * POND_R, Math.sin(a) * POND_R, k ? 0.9 : 0.2];
    })), WATER, undefined, () => ({
      paint: (g: Ctx, k: PaintCtx) => {
        g.fillStyle = css(k.fill); g.fillRect(-POND_R, -POND_R, POND_R * 2, POND_R * 2);
        g.strokeStyle = css(mix(k.fill, CREAM, 0.45), 0.6); g.lineWidth = 0.12;
        for (const [x, y, r] of [[1.5, -0.5, 1.4], [-1.2, 2.4, 0.9], [3.2, -2.6, 0.7]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.stroke(); }
        for (let i = 0; i < n; i++) {
          const [x, y, r] = PADS[i];
          g.fillStyle = css(i % 2 ? LEAF : mix(LEAF, LEAF_DEEP, 0.4));
          g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, 0.35 + i, TAU - 0.35 + i); g.closePath(); g.fill();
          g.strokeStyle = css(mix(LEAF_DEEP, DUSK, 0.3), 0.7); g.lineWidth = 0.08; g.stroke();
        }
      },
    }),
    ),
    first: true,
  };
  parts.push(water);
  for (let i = 0; i < n; i++) {
    const [x, y, r] = PADS[i];
    // The flower on each pad, a cup of petals up off the water.
    parts.push({ faces: lathe(x + r * 0.15, y - r * 0.1, [[0.9, 0.15], [1.25, 0.55], [1.6, 0.42]], 7, toneOf('#fbd6e2', '#c78aa2'), 0.5), after: [water] });
  }
  // Its edging: rough stones round the rim.
  const N = 11;
  for (let i = 0; i < N; i++) parts.push({ faces: edgeStone(POND_R + 1.1, (i / N) * TAU, 3.4, 2.2, 1.6 + (i % 3) * 0.25, 1501 + i * 7), edges: true });
  return { parts, shade: shadeRound(POND_R + 2.4) };
}

export const LILY_POND: KitPiece = {
  model: (look) => pondOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'no lilies' }, { trim: 3, label: 'lilies' }],
};

/* ---- 2. the ivy wall panel -------------------------------------------------------------------------- */

/** A panel's trim: how far its own ivy has grown, nought to seven. */
export const panelTrim = (days: number, span: number): number => Math.max(0, Math.min(7, Math.round((days / Math.max(1, span)) * 7)));
const PNL_X = 8.6, PNL_Z0 = 3, PNL_Z1 = 22;

function ivyPanelOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const stage = said(look.trim);
  const parts: KitPart[] = [];
  const y1 = FACE_Y - 0.05, y0 = y1 - 0.5;
  // A frame of battens on the wall, a diamond lattice in it.
  const frame: KitPart = {
    faces: slab(-PNL_X, PNL_X, y0, y1, PNL_Z0, PNL_Z1, W, {
      paint: {
        // Its outward face (the slab's back, toward the room or the yard; its front is against the wall).
        back: (g, k, s) => {
          g.clearRect(0, 0, s.w, s.h);
          g.fillStyle = css(mix(k.fill, DUSK, 0.55), 0.18); g.fillRect(0, 0, s.w, s.h);
          g.strokeStyle = css(k.fill); g.lineWidth = 0.55;
          for (let i = -6; i < 12; i++) {
            g.beginPath(); g.moveTo(i * 2.6, 0); g.lineTo(i * 2.6 + s.h, s.h); g.stroke();
            g.beginPath(); g.moveTo(i * 2.6, s.h); g.lineTo(i * 2.6 + s.h, 0); g.stroke();
          }
          g.lineWidth = 1.1; g.strokeRect(0.5, 0.5, s.w - 1, s.h - 1);
        },
      },
    }),
    edges: true,
  };
  parts.push(frame);
  // Its ivy, rooted at the foot, up the lattice the further it has grown.
  if (stage > 0) {
    parts.push({
      ...loose([-PNL_X, y0 - 1.2, PNL_Z0 - 1], [PNL_X, y0, PNL_Z1 + 1], (g, e) => {
        // Seen from the wall's side, it is the wall in front of it.
        if (e.toward[1] > 0.05) return;
        const T = rand(1601);
        const u = across(e);
        const top = PNL_Z0 + ((PNL_Z1 - PNL_Z0) * stage) / 7;
        for (let s = 0; s < 4; s++) {
          let x = -PNL_X + 2 + s * 4.4, z = PNL_Z0;
          g.strokeStyle = css(mix(LEAF_DEEP, DUSK, 0.4)); g.lineWidth = Math.max(0.5, 0.12 * u);
          g.beginPath();
          let [px, py] = proj(e, [x, y0 - 0.3, z]);
          g.moveTo(px, py);
          while (z < top) { x += (T() - 0.5) * 1.6; z += 1.2; [px, py] = proj(e, [Math.max(-PNL_X, Math.min(PNL_X, x)), y0 - 0.3, Math.min(z, top)]); g.lineTo(px, py); }
          g.stroke();
        }
        const leaves = 12 + stage * 15;
        for (let i = 0; i < leaves; i++) {
          const z = PNL_Z0 + T() * (top - PNL_Z0), x = -PNL_X + 0.6 + T() * (PNL_X * 2 - 1.2);
          const [lx, ly] = proj(e, [x, y0 - 0.4 - T() * 0.5, z]);
          const r = (0.55 + T() * 0.35) * u;
          g.fillStyle = css(T() < 0.5 ? LEAF : mix(LEAF, LEAF_DEEP, 0.6));
          g.beginPath();
          for (let j = 0; j < 3; j++) { const a = -Math.PI / 2 + (j - 1) * 0.9; g.ellipse(lx + Math.cos(a) * r * 0.5, ly + Math.sin(a) * r * 0.5, r * 0.55, r * 0.4, a, 0, TAU); }
          g.fill();
        }
      }),
      after: [frame],
    });
  }
  return { parts, shade: null };
}

export const IVY_PANEL: KitPiece = {
  model: (look) => ivyPanelOf(look), uses: { trim: true, material: true },
  states: [0, 3, 7].map((t) => ({ trim: t, label: `ivy ${t}` })),
};

/* ---- 3. the garden obelisk -------------------------------------------------------------------------- */

/** An obelisk's trim: its sweet peas' stage (`RoseStage`: bare, leaf, bud, flower) and the colour they flower in (`PEA_COLOURS`, by its place). */
export const obeliskTrim = (stage: number, colour: number): number => Math.max(0, Math.min(3, stage)) + 4 * Math.max(0, colour);
export const PEA_TONES: readonly RGB[] = ['#ec9cc0', '#a77ccc', '#f6f0f2', '#dc5f78'].map(hex);
const OB_H = 22, OB_B = 3.6, OB_T = 0.7;

function obeliskOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.55);
  const t = said(look.trim), stage = t % 4, colour = PEA_TONES[Math.floor(t / 4) % PEA_TONES.length];
  const parts: KitPart[] = [];
  const corner = (sx: number, sy: number, k: number): V3 => [sx * (OB_B + (OB_T - OB_B) * k), sy * (OB_B + (OB_T - OB_B) * k), k * OB_H];
  // Four legs leaning in to a point, rails round them at three heights, a ball on top.
  const legs: KitPart[] = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p: KitPart = { faces: strut(corner(sx, sy, 0), corner(sx, sy, 1), 0.6, 0.6, W, woodSide(1701, 'y')), edges: true };
    parts.push(p); legs.push(p);
  }
  for (const k of [0.22, 0.5, 0.76]) {
    const r = OB_B + (OB_T - OB_B) * k, z = k * OB_H;
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]] as Array<[[number, number], [number, number]]>) {
      parts.push({ faces: rod([a[0] * r, a[1] * r, z], [b[0] * r, b[1] * r, z], 0.18, deeper(W, 0.1), 4), after: legs });
    }
  }
  parts.push({ faces: lathe(0, 0, [[OB_H - 0.2, 0.3], [OB_H + 0.4, 0.75], [OB_H + 1.2, 0.8], [OB_H + 1.9, 0.4], [OB_H + 2.1, 0.05]], 8, paler(W, 0.1)), edges: true });
  // Its sweet peas, up the legs from the foot: bare, in leaf, in bud, in flower.
  if (stage > 0) {
    parts.push({
      ...loose([-OB_B - 1.2, -OB_B - 1.2, 0], [OB_B + 1.2, OB_B + 1.2, OB_H], (g, e) => {
        const T = rand(1711);
        const u = across(e);
        const top = OB_H * (stage === 1 ? 0.6 : 0.88);
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          // Only the legs on the near side, so the far ones' vines are behind the frame.
          const near = sx * e.toward[0] + sy * e.toward[1] > -0.2;
          if (!near) continue;
          g.strokeStyle = css(LEAF_DEEP); g.lineWidth = Math.max(0.45, 0.1 * u);
          g.beginPath();
          for (let z = 0; z <= top; z += 0.8) {
            const k = z / OB_H, w = Math.sin(z * 1.3 + sx) * 0.5;
            const [x, y] = proj(e, [corner(sx, sy, k)[0] + w * sy, corner(sx, sy, k)[1] - w * sx, z]);
            if (z) g.lineTo(x, y); else g.moveTo(x, y);
          }
          g.stroke();
          for (let z = 1; z < top; z += 0.85) {
            const k = z / OB_H, c = corner(sx, sy, k);
            const [x, y] = proj(e, [c[0] * 1.12, c[1] * 1.12, z]);
            g.fillStyle = css(T() < 0.5 ? LEAF : mix(LEAF, LEAF_DEEP, 0.5));
            g.beginPath(); g.ellipse(x + (T() - 0.5) * u, y, 0.6 * u, 0.36 * u, T() * 3, 0, TAU); g.fill();
            if (stage >= 2 && T() < 0.7) {
              const fx = x + (T() - 0.5) * 1.6 * u, fy = y - 0.4 * u;
              if (stage === 2) { g.fillStyle = css(mix(LEAF, colour, 0.45)); g.beginPath(); g.ellipse(fx, fy, 0.3 * u, 0.4 * u, 0, 0, TAU); g.fill(); }
              else {
                g.fillStyle = css(colour);
                g.beginPath(); g.ellipse(fx - 0.25 * u, fy, 0.42 * u, 0.5 * u, -0.4, 0, TAU); g.ellipse(fx + 0.25 * u, fy, 0.42 * u, 0.5 * u, 0.4, 0, TAU); g.fill();
                g.fillStyle = css(mix(colour, CREAM, 0.5)); g.beginPath(); g.ellipse(fx, fy + 0.25 * u, 0.22 * u, 0.25 * u, 0, 0, TAU); g.fill();
              }
            }
          }
        }
      }, false, 2),
      after: legs,
    });
  }
  return { parts, shade: shadeOf(-OB_B, OB_B, -OB_B, OB_B) };
}

export const GARDEN_OBELISK: KitPiece = {
  model: (look) => obeliskOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: obeliskTrim(0, 0), label: 'bare' }, { trim: obeliskTrim(1, 0), label: 'leaf' }, { trim: obeliskTrim(2, 1), label: 'bud' },
    ...PEA_TONES.map((_, i) => ({ trim: obeliskTrim(3, i), label: `flower ${i}` }))],
};

/* ---- 4. the herb spiral ----------------------------------------------------------------------------- */

/** A spiral's trim: each slot's herb (one more than its place among the herbs, nought empty) and how far it has grown, nought to three, five bits a slot. */
export const spiralTrim = (slots: ReadonlyArray<[number, number] | null>): number =>
  slots.slice(0, 4).reduce((n, s, i) => n + (s && s[0] >= 0 ? ((s[0] + 1) * 4 + Math.max(0, Math.min(3, s[1]))) : 0) * 32 ** i, 0);
/** The herbs' greens, by their place among the herbs a spiral grows (`SPIRAL_HERBS`), set by `adornlook.ts`. */
export const SPIRAL_GREENS: { of: Array<[RGB, RGB]> } = { of: [] };
const SP_R = 13;

function spiralOf(look: KitLook): KitModel {
  const t = said(look.trim);
  const parts: KitPart[] = [];
  // Three tiers of earth, smaller and higher toward the middle, each walled in dry stone along the spiral.
  const tiers: Array<[number, number]> = [[SP_R, 1.8], [SP_R * 0.66, 3.4], [SP_R * 0.34, 5.0]];
  const soils: KitPart[] = [];
  tiers.forEach(([r, h], k) => {
    const soil: KitPart = { faces: lathe(0, 0, [[0, r - 0.6], [h - 0.3, r - 0.6]], 14, SOIL, 0.5 + k * 0.2, () => ({ crease: 0.2 })), edges: false };
    parts.push(soil); soils.push(soil);
    const N = Math.max(6, Math.ceil((TAU * r) / 2.6));
    for (let i = 0; i < N; i++) {
      // The wall spirals up: a gap in each ring where the next one starts, each stone a little proud of the earth it holds.
      const a = (i / N) * TAU + k * 1.7;
      if (k < 2 && i === N - 1) continue;
      parts.push({ faces: edgeStone(r, a, (TAU * r) / N - 0.25, 1.3, h + 0.4 + (i / N) * 0.5, 1801 + k * 61 + i * 5), edges: true });
    }
  });
  // The four slots, a quarter of the spiral each, a herb in each grown as far as it has.
  for (let i = 0; i < 4; i++) {
    const code = Math.floor(t / 32 ** i) % 32;
    if (!code) continue;
    const herb = Math.floor(code / 4) - 1, grown = code % 4;
    const [leaf, tip] = SPIRAL_GREENS.of[herb] ?? [LEAF, mix(LEAF, CREAM, 0.3)];
    const a = (i / 4) * TAU + 0.6, k = i < 2 ? 0 : i < 3 ? 1 : 2;
    const r = k === 2 ? 0 : (tiers[k][0] + tiers[k + 1][0]) / 2, z = tiers[k][1];
    const c: V3 = [Math.cos(a) * r, Math.sin(a) * r, z];
    parts.push({
      ...loose([c[0] - 2.6, c[1] - 2.6, z], [c[0] + 2.6, c[1] + 2.6, z + 5], (g, e) => {
        const T = rand(1901 + i);
        const u = across(e);
        const size = 0.6 + grown * 0.45;
        const deep = mix(leaf, LEAF_DEEP, 0.55);
        for (let j = 0; j < 12 + grown * 8; j++) {
          const r2 = Math.sqrt(T()) * 1.8 * size, b = T() * TAU, up = T() * size * 2.4;
          const [x, y] = proj(e, [c[0] + Math.cos(b) * r2, c[1] + Math.sin(b) * r2, z + up]);
          g.fillStyle = css(up < size ? deep : j % 3 ? leaf : tip);
          g.strokeStyle = css(mix(deep, DUSK, 0.4), 0.6); g.lineWidth = 0.08 * u;
          g.beginPath(); g.ellipse(x, y, 0.7 * u, 0.42 * u, T() * 3, 0, TAU); g.fill(); g.stroke();
        }
      }, false, 1),
      after: [soils[k]],
    });
  }
  return { parts, shade: shadeRound(SP_R + 0.8) };
}

export const HERB_SPIRAL: KitPiece = {
  model: (look) => spiralOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'empty' }, { trim: spiralTrim([[0, 3], [1, 3], [2, 2], [3, 3]]), label: 'full' }],
};

/* ---- 5. the buoy ----------------------------------------------------------------------------------- */

/** How far a buoy rides up and down, in units, and how long a bob takes, in seconds. */
export const BUOY_BOB: readonly [number, number] = [0.6, 2.8];
const BUOY_LAMP: V3 = [0, 0, 11.4];
const RED: Tone = toneOf('#ee8a86', '#a4566a');
const WHITE: Tone = toneOf('#fbf3ea', '#bcaab4');

function buoyOf(): KitModel {
  const parts: KitPart[] = [];
  // A float, banded red and white, sat in the water; a cage on a short mast, a lamp in it.
  const body: KitPart = { faces: lathe(0, 0, [[-0.6, 1.6], [0.6, 3.1], [2.4, 3.3], [4.0, 2.9], [5.2, 1.6], [5.6, 0.5]], 12, RED, 0.5, (k, _i, s) => ({
    crease: 0.15,
    paint: (g: Ctx, kk: PaintCtx) => {
      g.fillStyle = css(kk.fill); g.fillRect(0, 0, s.w, s.h);
      if (k === 3) { g.fillStyle = css(mix(WHITE.lit, kk.fill, 0.35)); g.fillRect(0, 0, s.w, s.h); }
    },
  })), edges: true };
  parts.push(body);
  const mast: KitPart = { faces: rod([0, 0, 5.4], [0, 0, 9.6], 0.32, IRON, 6), after: [body] };
  parts.push(mast);
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    const at = (i: number): V3 => [Math.cos(i * TAU / 4 + 0.4) * 1.0, Math.sin(i * TAU / 4 + 0.4) * 1.0, 9.6];
    parts.push({ faces: rod(at(a), [at(a)[0], at(a)[1], 12.8], 0.12, IRON, 4), after: [mast] });
    void b;
  }
  parts.push({ faces: lathe(0, 0, [[9.6, 0.5], [10.2, 0.92], [12.4, 0.92], [12.8, 0.4]], 8, toneOf('#ffd27a', '#e09a50')), after: [mast] });
  parts.push({ faces: lathe(0, 0, [[12.8, 1.25], [13.4, 1.1], [13.7, 0.2]], 8, IRON), after: [mast] });
  // The rings it sends out on the water, which are drawn over it (`live`).
  parts.push(loose([-7.8, -7.8, 0], [7.8, 7.8, 0.1], () => undefined, true));
  return { parts, shade: null };
}

export const BUOY: KitPiece = {
  model: () => buoyOf(), uses: {},
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, BUOY_LAMP);
    return [{ x, y, r: 2.2 * zoom, a: 0.95 }, { x, y, r: 6 * zoom, a: 0.3 }];
  },
  live: (ctx, sx, sy, zoom, view, night, t) => {
    // Rings out from where it sits in the water, one after another.
    for (let i = 0; i < 2; i++) {
      const k = (t / BUOY_BOB[1] + i / 2) % 1;
      const r = 3.6 + k * 4;
      ctx.strokeStyle = `rgba(240, 250, 255, ${(0.55 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, 0.35 * zoom);
      ctx.beginPath();
      for (let j = 0; j <= 24; j++) {
        const a = (j / 24) * TAU;
        const [x, y] = onScreen(sx, sy, zoom, view, [Math.cos(a) * r, Math.sin(a) * r, 0]);
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    if (night <= 0.02) return;
    const [x, y] = onScreen(sx, sy, zoom, view, BUOY_LAMP);
    glow(ctx, x, y, 6 * zoom, 0.5 * night, '255, 214, 150');
  },
};

/* ---- 6. the cauldron hearth ------------------------------------------------------------------------- */

const CAULDRON: Tone = toneOf('#8c8aa0', '#3e3a50');
const STEW: RGB = hex('#b0784e');
const CAUL_LIP: V3 = [0, 0, 7.6];

function cauldronOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  // A ring of dressed stones round a fire bed; three iron legs over it; the cauldron hung between them.
  const bed: KitPart = {
    faces: prism([0, 1].map((k) => Array.from({ length: 10 }, (_, i): V3 => [Math.cos(((i + 0.5) / 10) * TAU) * 6.4, Math.sin(((i + 0.5) / 10) * TAU) * 6.4, k ? 0.5 : 0])), SOIL,
      undefined, () => ({
        paint: (g: Ctx, k: PaintCtx) => {
          g.fillStyle = css(mix(k.fill, DUSK, 0.4)); g.fillRect(-7, -7, 14, 14);
          const T = rand(2001);
          for (let i = 0; i < 22; i++) {
            g.fillStyle = look.lit ? css(mix(hex('#ffc070'), hex('#e0603a'), T())) : css(mix(hex('#4a3a40'), hex('#8a7a80'), T()));
            g.beginPath(); g.ellipse((T() - 0.5) * 8, (T() - 0.5) * 8, 1.0, 0.7, T() * 3, 0, TAU); g.fill();
          }
        },
      })),
    first: true,
  };
  parts.push(bed);
  for (let i = 0; i < 9; i++) parts.push({ faces: edgeStone(7.6, (i / 9) * TAU, 4.6, 2.2, 2.2 + (i % 2) * 0.4, 2011 + i * 3), edges: true });
  const legs: KitPart[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    const p: KitPart = { faces: rod([Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0], [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 12.6], 0.32, IRON, 5), edges: true };
    parts.push(p); legs.push(p);
  }
  const pot: KitPart = {
    faces: lathe(0, 0, [[2.2, 1.2], [2.8, 3.2], [4.4, 4.5], [6.4, 4.3], [7.3, 3.6], [7.6, 3.9]], 14, CAULDRON, 0.5, () => ({ crease: 0.12 })),
    edges: true, after: [bed],
  };
  parts.push(pot);
  // The stew in it, a skin of brown under the lip.
  parts.push({ faces: lathe(0, 0, [[7.2, 3.5], [7.3, 0.1]], 14, toneFrom(STEW)), after: [pot] });
  parts.push({ faces: rod([0, 0, 7.6], [0, 0, 12.4], 0.12, IRON, 4), after: [pot] });
  // The steam off it, which is drawn over it (`live`).
  parts.push(loose([-4, -4, 7.6], [4, 4, 22], () => undefined, true));
  return { parts, shade: shadeRound(8.6) };
}

/** The cauldrons whose fire burns, by the piece's id, as the renderer last worked it out (`adornTrim`): what the flames and steam are drawn on. */
export const CAULDRONS_LIT = new Set<number>();

export const CAULDRON_HEARTH: KitPiece = {
  model: (look) => cauldronOf(look), uses: { lit: true },
  holesLit: true,
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, [0, 0, 0.5]);
    return [{ x, y, r: 8 * zoom, a: 0.8 }];
  },
  live: (ctx, sx, sy, zoom, view, night, t, air) => {
    // Its fire while it burns (the studio, which names no piece, draws it alight).
    if (air?.seed !== undefined && !CAULDRONS_LIT.has(air.seed)) return;
    // Flames licking up round the pot's belly, and steam off the stew.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + t * 0.7;
      const [x, y] = onScreen(sx, sy, zoom, view, [Math.cos(a) * 3, Math.sin(a) * 3, 1]);
      const h = (2.2 + Math.sin(t * 7 + i * 2) * 0.8) * zoom;
      ctx.fillStyle = `rgba(255, ${150 + i * 15}, 80, 0.75)`;
      ctx.beginPath(); ctx.moveTo(x - 0.9 * zoom, y); ctx.quadraticCurveTo(x, y - h * 2.4, x + 0.9 * zoom, y); ctx.fill();
    }
    const [x, y] = onScreen(sx, sy, zoom, view, CAUL_LIP);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.5 + i / 3) % 1;
      ctx.fillStyle = `rgba(250, 246, 240, ${0.4 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(t + i) * 2 * zoom, y - k * 14 * zoom, (1.5 + k * 2.5) * zoom, (1 + k * 1.5) * zoom, 0, 0, TAU); ctx.fill();
    }
    if (night > 0.02) glow(ctx, x, y + 12 * zoom, 9 * zoom, 0.45 * night, '255, 170, 100');
  },
};

/* ---- 7. the cheese rack ----------------------------------------------------------------------------- */

/** A rack's trim: its cheeses, to its room. */
export const rackTrim = (n: number): number => Math.max(0, Math.min(8, Math.floor(n)));
const CR_X = 8.6, CR_Y = 3.4, CR_TIER = 5.4;
const CHEESE: Tone = toneOf('#f6d27a', '#b48a52');

function cheeseRackOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const n = said(look.trim);
  const parts: KitPart[] = [];
  // Two shelves of slats between four posts; four wheels a shelf, rind out.
  const posts: KitPart[] = [];
  for (const [x, y] of [[-CR_X, -CR_Y], [CR_X, -CR_Y], [CR_X, CR_Y], [-CR_X, CR_Y]]) {
    const p: KitPart = { faces: leg(x, y, 0, 1.6 + CR_TIER + 1.4, W, 2101), edges: true };
    parts.push(p); posts.push(p);
  }
  const shelves: KitPart[] = [];
  for (let k = 0; k < 2; k++) {
    const z = 1.6 + k * CR_TIER;
    const s: KitPart = { faces: slab(-CR_X + 0.5, CR_X - 0.5, -CR_Y + 0.2, CR_Y - 0.2, z - 0.5, z, paler(W, 0.05), { paint: woodSides(2111 + k, 'x'), corner: 0.1 }), edges: true, after: posts };
    parts.push(s); shelves.push(s);
  }
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / 4), x = -CR_X + 2.4 + (i % 4) * ((CR_X * 2 - 4.8) / 3), z = 1.6 + k * CR_TIER;
    parts.push({
      faces: lathe(x, 0, [[z, 1.75], [z + 0.2, 1.95], [z + 1.2, 1.95], [z + 1.4, 1.75]], 12, CHEESE, 0.5, (_k, _i, s) => ({
        crease: 0.12, paint: (g: Ctx, kk: PaintCtx) => { g.fillStyle = css(kk.fill); g.fillRect(0, 0, s.w, s.h); g.fillStyle = css(mix(kk.fill, hex('#c06a3a'), 0.25)); g.fillRect(0, s.h * 0.45, s.w, s.h * 0.1); },
      })),
      edges: true, after: [shelves[k]],
    });
  }
  return { parts, shade: shadeOf(-CR_X, CR_X, -CR_Y, CR_Y) };
}

export const CHEESE_RACK: KitPiece = {
  model: (look) => cheeseRackOf(look), uses: { trim: true, material: true },
  states: [{ trim: 0, label: 'empty' }, { trim: 8, label: 'full' }],
};

/* ---- 8. the pelt rug -------------------------------------------------------------------------------- */

/** A pelt's trim: its kind's body and belly colours (`peltColours`), fifteen bits each; nought for fur of no kind. */
export const peltTrim = (body: string | undefined, belly: string | undefined): number => colourCode(body) + COLOUR_BASE * colourCode(belly);
const PELT_PLAIN: [RGB, RGB] = [hex('#b89a7a'), hex('#e8d8c0')];
/** A pelt's outline, from its nose round to its tail: a body, four legs out, a head and a tail. */
const PELT: Array<[number, number]> = [
  [0, -8.4], [1.6, -7.2], [1.8, -5.8], [4.8, -6.6], [5.6, -5.2], [3.4, -3.6], [3.8, 2.4], [6.0, 3.6], [5.0, 5.0], [2.6, 4.4], [1.2, 6.6], [0.5, 8.6],
  [-0.5, 8.6], [-1.2, 6.6], [-2.6, 4.4], [-5.0, 5.0], [-6.0, 3.6], [-3.8, 2.4], [-3.4, -3.6], [-5.6, -5.2], [-4.8, -6.6], [-1.8, -5.8], [-1.6, -7.2],
];

function peltOf(look: KitLook): KitModel {
  const t = said(look.trim);
  const body = colourOf(t % COLOUR_BASE) ?? PELT_PLAIN[0], belly = colourOf(Math.floor(t / COLOUR_BASE)) ?? PELT_PLAIN[1];
  const tone = toneFrom(body, 0.35);
  // Flat on the floor, its fur brushed out from the spine, the belly's colour down the middle.
  const faces = prism([0, 0.35].map((z) => PELT.map(([x, y]): V3 => [x, y, z])), tone, undefined, () => ({
    paint: (g: Ctx, k: PaintCtx) => {
      g.fillStyle = css(k.fill); g.fillRect(-7, -9, 14, 18);
      g.fillStyle = css(mix(belly, k.fill, 0.15));
      g.beginPath(); g.ellipse(0, -0.4, 2.4, 5.2, 0, 0, TAU); g.fill();
      const T = rand(2201);
      g.lineWidth = 0.12;
      for (let i = 0; i < 160; i++) {
        const y = -8 + T() * 16, x = (T() - 0.5) * 9;
        g.strokeStyle = css(mix(k.fill, T() < 0.5 ? DUSK : CREAM, 0.25), 0.6);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sign(x || 1) * 0.7, y + 0.3); g.stroke();
      }
    },
  }));
  return { parts: [{ faces, edges: true, first: true }], shade: null };
}

export const PELT_RUG: KitPiece = {
  model: (look) => peltOf(look), uses: { trim: true },
  states: [{ trim: 0, label: 'no kind' }, { trim: peltTrim('#c08a5a', '#f0e0c8'), label: 'tawny' }, { trim: peltTrim('#6a6a7a', '#c8c8d0'), label: 'grey' }, { trim: peltTrim('#e8e4dc', '#fbf8f2'), label: 'pale' }],
};

/* ---- 9. the plush wildermon ------------------------------------------------------------------------- */

/**
 * A plush's kind as its trim carries it: one more than its place in the field
 * guide's kinds, and a thousand more once its model has come in, as a carved
 * figure's (`figureTrim`).
 */
export const plushTrim = (index: number, ready: boolean): number => (index < 0 ? 0 : index + 1 + (ready ? 1000 : 0));
/** What draws a kind as a plush, soft, in its coat or its dye: set by `render/adornlook.ts`, which loads the models. */
export const plushie: { draw: ((g: Ctx, index: number, w: number, h: number, dye: RGB | null) => boolean) | null } = { draw: null };
const PLUSH_H = 6.4;

function plushOf(look: KitLook): KitModel {
  const t = said(look.trim);
  const index = (t % 1000) - 1, ready = t >= 1000 && index >= 0;
  const dye = look.tint ? hex(look.tint.colour) : null;
  if (!ready) {
    // No kind yet, or its model not come in: a stuffed cloth lump with two ears.
    const C = clothTone(look.tint);
    const lump: KitPart = { faces: lathe(0, 0, [[0, 1.2], [0.6, 2.2], [2.4, 2.4], [4.2, 1.8], [4.9, 0.6]], 10, C), edges: true };
    return { parts: [lump, ...[-1, 1].map((s) => ({ faces: lathe(s * 1.0, 0, [[4.4, 0.5], [5.4, 0.42], [5.9, 0.1]], 6, C), after: [lump] }))], shade: shadeOf(-2.4, 2.4, -2.4, 2.4) };
  }
  return {
    parts: [loose([-3, -3, 0], [3, 3, PLUSH_H], (g, e) => {
      const [x, y] = proj(e, [0, 0, 0]);
      const pw = 6 * across(e) * 1.1, ph = PLUSH_H * 2.25;
      g.save();
      g.translate(x - pw / 2, y - ph);
      plushie.draw?.(g, index, pw, ph, dye);
      g.restore();
    }, true)],
    shade: shadeOf(-2.6, 2.6, -2.2, 2.2),
  };
}

export const PLUSH: KitPiece = {
  model: (look) => plushOf(look), uses: { trim: true, tint: true },
  states: [...[0, 4, 8].map((i) => ({ trim: plushTrim(i, true), label: `kind ${i + 1}` })), { trim: 0, label: 'no kind' }],
};

/* ---- 10. the game table ----------------------------------------------------------------------------- */

/** A table's trim: whether a round is on, its stones out on the board. */
export const tableTrim = (round: boolean): number => (round ? 1 : 0);
const GT_X = 6.4, GT_Z = 7.4;

function gameTableOf(look: KitLook): KitModel {
  const W = woodTone(look.material, look.tint, 0.55);
  const on = said(look.trim) > 0;
  const parts: KitPart[] = [];
  const top: KitPart = {
    faces: slab(-GT_X, GT_X, -GT_X, GT_X, GT_Z - 0.7, GT_Z, paler(W, 0.06), {
      corner: 0.3, bevel: 0.2,
      paint: {
        top: (g, k) => {
          grain(g, k.fill, GT_X * 2, GT_X * 2, 2301, 'x', 0.4);
          // The board: a track of twelve hollows round it, a start and a finish.
          g.strokeStyle = css(mix(k.fill, DUSK, 0.45)); g.lineWidth = 0.18;
          g.strokeRect(-GT_X + 1.2, -GT_X + 1.2, GT_X * 2 - 2.4, GT_X * 2 - 2.4);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU;
            g.fillStyle = css(mix(k.fill, DUSK, 0.25));
            g.beginPath(); g.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.45, 0, TAU); g.fill();
          }
          if (on) for (const [c, a] of [['#f2ecdc', 0.4], ['#5a5a6a', 3.2]] as Array<[string, number]>) {
            g.fillStyle = c; g.beginPath(); g.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.55, 0, TAU); g.fill();
          }
        },
      },
    }),
    edges: true,
  };
  parts.push(top);
  for (const [x, y] of [[-GT_X + 1, -GT_X + 1], [GT_X - 1, -GT_X + 1], [GT_X - 1, GT_X - 1], [-GT_X + 1, GT_X - 1]]) parts.push({ faces: leg(x, y, 0, GT_Z - 0.7, W, 2311), edges: true });
  // Two stools, either side, for the two players.
  for (const s of [-1, 1]) {
    const seat: KitPart = { faces: slab(-1.8, 1.8, s * 8.6 - 1.6, s * 8.6 + 1.6, 4.0, 4.6, paler(W, 0.04), { corner: 0.5, paint: woodSides(2321, 'x') }), edges: true };
    parts.push(seat);
    for (const [x, y] of [[-1.2, s * 8.6 - 1.0], [1.2, s * 8.6 - 1.0], [1.2, s * 8.6 + 1.0], [-1.2, s * 8.6 + 1.0]]) parts.push({ faces: leg(x, y, 0, 4.0, W, 2331, 0.6), edges: true });
  }
  return { parts, shade: shadeOf(-GT_X, GT_X, -GT_X, GT_X) };
}

export const GAME_TABLE: KitPiece = {
  model: (look) => gameTableOf(look), uses: { trim: true, material: true, tint: true },
  states: [{ trim: 0, label: 'no round' }, { trim: 1, label: 'a round on' }],
};

/* ---- 11. the gem lamp ------------------------------------------------------------------------------- */

/** A gem lamp's trim: its gem's colour (fifteen bits), nought for a stone nobody knows. */
export const gemLampTrim = (colour: string | undefined): number => colourCode(colour);
const GEM_AT: V3 = [0, 0, 10.4];
/** The lamps whose gem glows, by the piece's id, and the colour it glows (`adornTrim`). */
export const GEM_GLOWS = new Map<number, string>();

function gemLampOf(look: KitLook): KitModel {
  const gem = colourOf(said(look.trim)) ?? hex('#e8eef4');
  const parts: KitPart[] = [];
  // A turned stone pillar, a cupped head, the gem set in it.
  const skin = (seed: number) => (_k: number, _i: number, s: Side) => ({ crease: 0.2, paint: (g: Ctx, k: PaintCtx) => stoneSkin(g, k.fill, s.w, s.h, seed, 0.7) });
  const pillar: KitPart = { faces: lathe(0, 0, [[0, 2.6], [1.2, 2.6], [1.6, 1.8], [7.6, 1.4], [8.2, 2.0], [8.8, 2.3]], 8, DRESSED, 0.5, skin(2401)), edges: true };
  parts.push(pillar);
  const tone: Tone = { lit: mix(gem, CREAM, 0.15), shade: mix(gem, DUSK, 0.25) };
  parts.push({ faces: lathe(0, 0, [[8.6, 0.3], [9.6, 1.6], [10.6, 1.7], [12.4, 0.1]], 6, tone, 0.5, () => ({ crease: 0.5 })), edges: true, after: [pillar], inkColour: mix(gem, DUSK, 0.6) });
  return { parts, shade: shadeOf(-2.6, 2.6, -2.6, 2.6) };
}

export const GEM_LAMP: KitPiece = {
  model: (look) => gemLampOf(look), uses: { trim: true },
  states: [{ trim: gemLampTrim('#e26278'), label: 'ruby' }, { trim: gemLampTrim('#6c94e4'), label: 'sapphire' }, { trim: gemLampTrim('#62c092'), label: 'emerald' }],
  holes: (sx, sy, zoom, view) => {
    const [x, y] = onScreen(sx, sy, zoom, view, GEM_AT);
    return [{ x, y, r: 2.6 * zoom, a: 0.95 }, { x, y, r: 7 * zoom, a: 0.3 }];
  },
  live: (ctx, sx, sy, zoom, view, night, t, air) => {
    const c = GEM_GLOWS.get(air?.seed ?? -1) ?? '255, 236, 236';
    const [x, y] = onScreen(sx, sy, zoom, view, GEM_AT);
    // A glint round its facets by day, turning; its glow by night.
    const a = t * 1.1, r = 1.2 * zoom;
    const gx = x + Math.cos(a) * r, gy = y - 0.6 * zoom + Math.sin(a) * r * 0.5;
    ctx.fillStyle = `rgba(255, 252, 245, ${(0.55 + 0.35 * Math.sin(t * 2.3)).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(gx, gy - 1.1 * zoom); ctx.lineTo(gx + 0.3 * zoom, gy); ctx.lineTo(gx, gy + 1.1 * zoom); ctx.lineTo(gx - 0.3 * zoom, gy); ctx.closePath(); ctx.fill();
    if (night <= 0.02) return;
    glow(ctx, x, y, (7 + Math.sin(t * 1.3) * 0.4) * zoom, 0.6 * night, c);
  },
};

/* ---- 12. the pedigree board ------------------------------------------------------------------------- */

/** A board's trim: whether a wildermon's line is on it. */
export const boardTrim = (line: boolean): number => (line ? 1 : 0);
const PB_X = 7.8, PB_Z0 = 6, PB_Z1 = 17;

function boardOf(look: KitLook): KitModel {
  const W = woodTone(look.material, undefined, 0.55);
  const on = said(look.trim) > 0;
  const parts: KitPart[] = [];
  const legs: KitPart[] = [];
  for (const x of [-PB_X + 0.6, PB_X - 0.6]) {
    const p: KitPart = { faces: strut([x, 1.4, 0], [x, -0.2, PB_Z1 + 0.8], 0.8, 0.8, W, woodSide(2501, 'y')), edges: true };
    parts.push(p); legs.push(p);
  }
  parts.push({
    faces: slab(-PB_X, PB_X, -0.6, 0.2, PB_Z0, PB_Z1, W, {
      corner: 0.1,
      paint: {
        front: (g, k, s) => {
          g.fillStyle = css(mix(k.fill, CREAM, 0.6)); g.fillRect(0.6, 0.6, s.w - 1.2, s.h - 1.2);
          g.strokeStyle = css(mix(k.fill, DUSK, 0.3)); g.lineWidth = 0.5; g.strokeRect(0.6, 0.6, s.w - 1.2, s.h - 1.2);
          if (!on) return;
          // The tree: the wildermon at the foot, its dam and sire over it, theirs over them, joined.
          const box = (x: number, y: number): void => { g.fillStyle = css(mix(k.fill, CREAM, 0.85)); g.fillRect(x - 1.4, y - 0.7, 2.8, 1.4); g.strokeRect(x - 1.4, y - 0.7, 2.8, 1.4); };
          g.strokeStyle = css(mix(k.fill, DUSK, 0.55)); g.lineWidth = 0.18;
          const w = s.w, h = s.h;
          const rows: Array<Array<number>> = [[w / 2], [w * 0.3, w * 0.7], [w * 0.15, w * 0.4, w * 0.6, w * 0.85]];
          const ys = [h * 0.2, h * 0.5, h * 0.8];
          for (let r = 1; r < 3; r++) rows[r].forEach((x, i) => { g.beginPath(); g.moveTo(x, ys[r] - 0.7); g.lineTo(rows[r - 1][Math.floor(i / 2)], ys[r - 1] + 0.7); g.stroke(); });
          rows.forEach((row, r) => row.forEach((x) => box(x, ys[r])));
        },
      },
    }),
    edges: true, after: legs,
  });
  return { parts, shade: shadeOf(-PB_X, PB_X, -1, 1.6) };
}

export const PEDIGREE_BOARD: KitPiece = {
  model: (look) => boardOf(look), uses: { trim: true, material: true },
  states: [{ trim: 0, label: 'blank' }, { trim: 1, label: 'a line' }],
};

/* ---- 13. the worker nameplate ---------------------------------------------------------------------- */

/** Where a nameplate's board is, off its stake's foot: its middle, and half its width and height. */
export const PLATE_BOARD: readonly [V3, number, number] = [[0, -0.3, 4.6], 2.6, 1.2];

function nameplateOf(): KitModel {
  const W = woodTone('oak', undefined, 0.55);
  const stake: KitPart = { faces: slab(-0.3, 0.3, -0.3, 0.3, 0, 4, deeper(W, 0.1)), edges: true };
  const [c, hw, hh] = PLATE_BOARD;
  return {
    parts: [stake, {
      faces: slab(c[0] - hw, c[0] + hw, c[1] - 0.25, c[1] + 0.25, c[2] - hh, c[2] + hh, paler(W, 0.1), {
        corner: 0.2, bevel: 0.1,
        paint: { front: (g, k, s) => { g.fillStyle = css(mix(k.fill, CREAM, 0.3)); g.fillRect(0.3, 0.3, s.w - 0.6, s.h - 0.6); }, back: (g, k, s) => grain(g, k.fill, s.w, s.h, 2601, 'x', 0.6) },
      }),
      edges: true, after: [stake],
    }],
    shade: null,
  };
}

export const NAMEPLATE: KitPiece = { model: () => nameplateOf(), uses: {} };
