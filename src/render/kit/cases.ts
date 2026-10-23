import {
  boards, clothTone, css, deeper, extrude, faceColour, hex, metalTone, mix, paler, prism, sheen, slab, stud, TAU, toneOf, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Side, type Tone, type V3,
} from './core';
import { grained, joint, keyhole, knob, panel, topGrain } from './joinery';

/**
 * The tall cases (`cupboard`, `wardrobe`, `larder`), in the kit: each a
 * frame-and-panel carcass on a plinth under an overhanging cornice, its doors
 * painted on its front -- the cupboard two panelled doors with a jug and a
 * bowl on its top; the wardrobe two doors of two panels each over a long
 * drawer, an arched crest over its cornice with a gold stud in it; the larder two doors each with a pierced
 * tin panel over a wooden one, a sack of flour and a cheese on its top. The
 * wood is what it was built of; dyed, its boards are painted in the dye and
 * the brass and iron are left bare. The plinth stays bare wood, as a chest's.
 */

/** Crockery and what is kept: the kiln's cream stoneware, a blue-grey glaze, and a cheese's rind. */
export const STONEWARE: Tone = toneOf('#ecd6c0', '#a68f94');
export const GLAZE: Tone = toneOf('#bccbd6', '#76809a');
export const CHEESE: Tone = toneOf('#f5d47e', '#b8925a');

/** Rings round an upright axis, as `lathe`, with the top's paint: a jug's mouth, a bowl's hollow, a sack's tie. */
export function turnedWith(cx: number, cy: number, profile: ReadonlyArray<[number, number]>, sides: number, tone: Tone, top?: (g: Ctx, k: PaintCtx, s: Side) => void, side?: (g: Ctx, k: PaintCtx, s: Side, band: number) => void): Face[] {
  const rings = profile.map(([z, r]) => Array.from({ length: sides }, (_, i) => {
    const a = ((i + 0.5) / sides) * TAU;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as V3;
  }));
  return prism(rings, tone, (k, _i, s) => ({ crease: 0.18, ...(side ? { paint: (g: Ctx, kk: PaintCtx) => side(g, kk, s, k) } : {}) }), top ? (s) => ({ paint: (g: Ctx, k: PaintCtx) => top(g, k, s) }) : undefined);
}

/** A hollow seen from over it: a deeper round inside its rim, darker toward the far side. */
export function hollow(r: number, deep = 0.55) {
  return (g: Ctx, k: PaintCtx): void => {
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fillStyle = css(mix(k.fill, hex('#4a3a4a'), deep));
    g.fill();
    g.beginPath();
    g.arc(0.12 * r, 0.18 * r, r * 0.72, 0, TAU);
    g.fillStyle = css(mix(k.fill, hex('#4a3a4a'), deep * 0.55), 0.8);
    g.fill();
  };
}

/** What a case is: its carcass's half width and depth, its plinth's top, its carcass's top, its cornice's thickness and overhang, and how its faces are painted. */
interface CaseSpec {
  x: number;
  y: number;
  base: number;
  top: number;
  cap: number;
  over: number;
  front: (g: Ctx, k: PaintCtx, s: Side, wood: Tone) => void;
  side: (g: Ctx, k: PaintCtx, s: Side, wood: Tone) => void;
  /** Painted on the cornice's front: a frieze, a stud. */
  frieze?: (g: Ctx, k: PaintCtx, s: Side) => void;
  /** What stands on its top, at `z`. */
  on?: (z: number) => Face[][];
  /** An arched crest board along the front of its top, this high. */
  crest?: number;
}

function caseOf(look: KitLook, c: CaseSpec): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const TOP = paler(WOOD, 0.08);
  const BASE = deeper(woodTone(look.material), 0.22);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const { x, y } = c;
  add(slab(-x - 0.25, x + 0.25, -y - 0.25, y + 0.25, 0, c.base, BASE, {
    corner: 0.15, bevel: 0.22,
    paint: { front: grained(5, 'x', 0.5), back: grained(6, 'x', 0.5), left: grained(7, 'x', 0.5), right: grained(8, 'x', 0.5) },
  }), { edges: true });
  add(slab(-x, x, -y, y, c.base, c.top, WOOD, {
    corner: 0.12,
    paint: {
      front: (g, k, s) => c.front(g, k, s, WOOD),
      left: (g, k, s) => c.side(g, k, s, WOOD),
      right: (g, k, s) => c.side(g, k, s, WOOD),
      back: (g, k, s) => boards(g, k.fill, s.w, s.h, 5, 41, 'y'),
    },
  }));
  // The cornice: a frieze band a hair proud of the carcass, and the cap over it.
  const fz = c.cap * 0.45;
  add(slab(-x - 0.15, x + 0.15, -y - 0.15, y + 0.15, c.top, c.top + fz, WOOD, {
    corner: 0.12,
    paint: {
      front: (g, k, s) => { grained(51, 'x', 0.6)(g, k, s); c.frieze?.(g, k, s); },
      left: grained(52, 'x', 0.6), right: grained(53, 'x', 0.6), back: grained(54, 'x', 0.6),
    },
  }));
  add(slab(-x - c.over, x + c.over, -y - c.over, y + c.over, c.top + fz, c.top + c.cap, TOP, {
    corner: 0.25, bevel: 0.3,
    paint: { top: topGrain(61, 'x', 0.5), front: grained(62, 'x', 0.5), left: grained(63, 'x', 0.5), right: grained(64, 'x', 0.5), back: grained(65, 'x', 0.5) },
  }), { edges: true });
  for (const f of c.on?.(c.top + c.cap) ?? []) add(f, { edges: true });
  if (c.crest) {
    const z = c.top + c.cap, cw = x * 0.86, h = c.crest, yf = y + c.over - 0.3;
    const rise = (k: number): number => z + h * 0.4 + h * 0.6 * Math.sin((k * Math.PI) / 2);
    add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0],
      [[-cw, z], [cw, z], [cw, z + h * 0.4], [cw * 0.66, rise(0.5)], [cw * 0.33, rise(0.85)], [0, z + h], [-cw * 0.33, rise(0.85)], [-cw * 0.66, rise(0.5)], [-cw, z + h * 0.4]],
      yf - 0.55, yf, TOP, 0.14, {
        front: (g, k) => { g.save(); g.translate(-cw, z); grained(57, 'x', 0.6)(g, k, { w: cw * 2, h } as Side); g.restore(); stud(g, 0, z + h * 0.5, 0.34); },
        back: (g, k) => { g.save(); g.translate(-cw, z); grained(58, 'x', 0.6)(g, k, { w: cw * 2, h } as Side); g.restore(); },
      }), { edges: true });
  }
  return { parts, shade: [[-x - 0.3, -y - 0.3, 0], [x + 0.3, -y - 0.3, 0], [x + 0.3, y + 0.3, 0], [-x - 0.3, y + 0.3, 0]] };
}

/** Two doors meeting in the middle of a front from `y0` to `y1`: a joint round each, their panels (`inner` lays each door's), and knobs at the meeting stiles. */
function pairOfDoors(g: Ctx, k: PaintCtx, w: number, y0: number, y1: number, inner: (x0: number, x1: number, d: number) => void, knobY: number, bold = false): void {
  const m = 0.32, mid = w / 2, seam = bold ? 0.36 : undefined, r = bold ? 0.36 : 0.28;
  for (const [d, a, b] of [[0, m, mid - 0.05], [1, mid + 0.05, w - m]] as Array<[number, number, number]>) {
    joint(g, k.fill, a, y0, a, y1, seam);
    joint(g, k.fill, b, y0, b, y1, seam);
    joint(g, k.fill, a, y1, b, y1, seam);
    joint(g, k.fill, a, y0, b, y0, seam);
    inner(a, b, d);
  }
  // Bold: the gap where the two doors meet, a dark slot down the middle.
  if (bold) {
    g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.72));
    g.fillRect(mid - 0.2, y0, 0.4, y1 - y0);
  }
  knob(g, k, mid - 0.55 - (r - 0.28), knobY, r);
  knob(g, k, mid + 0.55 + (r - 0.28), knobY, r);
  keyhole(g, k, mid + 0.6, knobY - 1.35, 0.8);
}

/** A side of a case: boarded up it, so it is not taken for a front. */
const sideBoards = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => boards(g, k.fill, s.w, s.h, Math.max(2, Math.round(s.w / 2.6)), seed, 'y');

/* ---- the cupboard -------------------------------------------------------------- */

function cupboardOf(look: KitLook, hw: number, hd: number): KitModel {
  const x = hw - 1.6, y = hd - 1.6;
  return caseOf(look, {
    x, y, base: 0.8, top: 10.8, cap: 1.1, over: 0.5,
    front: (g, k, s) => {
      grained(31, 'y', 0.5)(g, k, s);
      pairOfDoors(g, k, s.w, 0.45, s.h - 0.45, (a, b, d) => panel(g, k.fill, a + 0.8, 1.35, b - 0.8, s.h - 1.3, 90 + d), s.h * 0.52);
    },
    side: (g, k, s) => sideBoards(81)(g, k, s),
    on: (z) => [
      // A stoneware jug with a blue-grey glaze about its shoulder, and a wide bowl.
      turnedWith(-x + 3, 0, [[z, 0.8], [z + 0.35, 1.05], [z + 1.2, 1.25], [z + 2.0, 0.95], [z + 2.5, 0.55], [z + 2.85, 0.62], [z + 3.05, 0.7]], 12, STONEWARE, hollow(0.5),
        (g, k, s, band) => { if (band === 2 || band === 3) { g.fillStyle = css(faceColour(GLAZE, k.L)); g.fillRect(-0.5, band === 2 ? s.h * 0.45 : 0, s.w + 1, band === 2 ? s.h * 0.55 : s.h * 0.6); } }),
      turnedWith(x - 3.2, -0.4, [[z, 0.75], [z + 0.25, 1.05], [z + 0.7, 1.6], [z + 0.85, 1.72]], 14, GLAZE, hollow(1.4, 0.4)),
    ],
  });
}

/* ---- the wardrobe ---------------------------------------------------------------- */

function wardrobeOf(look: KitLook, hw: number, hd: number): KitModel {
  const x = hw - 2, y = hd - 1.2;
  return caseOf(look, {
    x, y, base: 0.8, top: 13.5, cap: 1.2, over: 0.55,
    front: (g, k, s) => {
      grained(32, 'y', 0.5)(g, k, s);
      // The long drawer at its foot, its two knobs.
      const d0 = 0.4, d1 = 2.6;
      joint(g, k.fill, 0.32, d0, s.w - 0.32, d0, 0.36);
      joint(g, k.fill, 0.32, d1, s.w - 0.32, d1, 0.36);
      joint(g, k.fill, 0.32, d0, 0.32, d1, 0.36);
      joint(g, k.fill, s.w - 0.32, d0, s.w - 0.32, d1, 0.36);
      panel(g, k.fill, 0.95, d0 + 0.45, s.w - 0.95, d1 - 0.45, 94, false, 1.3);
      knob(g, k, s.w * 0.27, (d0 + d1) / 2, 0.36);
      knob(g, k, s.w * 0.73, (d0 + d1) / 2, 0.36);
      // The doors over it, each a tall panel over a short one.
      const y0 = 3.0, y1 = s.h - 0.4;
      pairOfDoors(g, k, s.w, y0, y1, (a, b, d) => {
        const split = y0 + (y1 - y0) * 0.36;
        panel(g, k.fill, a + 0.75, y0 + 0.8, b - 0.75, split - 0.4, 96 + d, true, 1.5);
        panel(g, k.fill, a + 0.75, split + 0.4, b - 0.75, y1 - 0.85, 98 + d, true, 1.5);
      }, y0 + (y1 - y0) * 0.36, true);
    },
    side: (g, k, s) => sideBoards(82)(g, k, s),
    crest: 1.2,
    frieze: (g, k, s) => {
      // A bead along its foot.
      g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.35), 0.6);
      g.fillRect(0, 0.12, s.w, 0.1);
    },
  });
}

/* ---- the larder ------------------------------------------------------------------- */

/** A pierced tin panel from (x0, y0) to (x1, y1): tin in its frame, punched in rows of small holes, a rivet at each corner. */
function tin(g: Ctx, k: PaintCtx, x0: number, y0: number, x1: number, y1: number): void {
  const T = metalTone('steel');
  const fill = faceColour(T, Math.min(1, k.L + 0.05));
  g.fillStyle = css(mix(fill, hex('#3a3040'), 0.55), 0.9);
  g.fillRect(x0 - 0.12, y0 - 0.12, x1 - x0 + 0.24, y1 - y0 + 0.24);
  g.fillStyle = css(fill);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.save();
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  g.translate(x0, y0);
  sheen(g, fill, x1 - x0, y1 - y0, 7);
  g.restore();
  const cols = Math.max(2, Math.round((x1 - x0) / 0.85)), rows = Math.max(2, Math.round((y1 - y0) / 0.85));
  const hole = css(mix(fill, hex('#2e2838'), 0.75));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    // A quincunx: every other row set over by half.
    const ox = (j % 2 ? 0.5 : 0) + 0.5, px = x0 + ((i + ox) / cols) * (x1 - x0), py = y0 + ((j + 0.5) / rows) * (y1 - y0);
    if (px > x1 - 0.25) continue;
    g.beginPath();
    g.arc(px, py, 0.13, 0, TAU);
    g.fillStyle = hole;
    g.fill();
  }
  g.fillStyle = css(mix(fill, [255, 255, 255], 0.5), 0.6);
  g.fillRect(x0, y1 - 0.1, x1 - x0, 0.1);
}

function larderOf(look: KitLook, hw: number, hd: number): KitModel {
  const x = hw - 2, y = hd - 0.6;
  const LINEN = clothTone();
  return caseOf(look, {
    x, y, base: 0.8, top: 13.4, cap: 1.0, over: 0.55,
    front: (g, k, s) => {
      grained(33, 'y', 0.5)(g, k, s);
      const y0 = 0.45, y1 = s.h - 0.45, split = s.h * 0.5;
      pairOfDoors(g, k, s.w, y0, y1, (a, b, d) => {
        panel(g, k.fill, a + 0.8, y0 + 0.8, b - 0.8, split - 0.5, 92 + d);
        tin(g, k, a + 0.9, split + 0.3, b - 0.9, y1 - 0.9);
      }, split - 0.1);
    },
    side: (g, k, s) => sideBoards(83)(g, k, s),
    on: (z) => [
      // A sack of flour, its neck tied, and a cheese.
      turnedWith(-x + 3.4, -1, [[z, 1.6], [z + 0.5, 1.95], [z + 1.4, 1.85], [z + 2.2, 1.25], [z + 2.6, 0.5], [z + 2.75, 0.7], [z + 3.05, 0.45]], 10, LINEN, undefined,
        (g, k, s, band) => { if (band === 3) { g.fillStyle = css(mix(k.fill, hex('#8a6e58'), 0.45)); g.fillRect(-0.5, s.h - 0.22, s.w + 1, 0.22); } }),
      turnedWith(x - 3.2, 0.6, [[z, 1.65], [z + 0.15, 1.8], [z + 0.8, 1.8], [z + 0.95, 1.65]], 14, CHEESE,
        (g, k) => { g.beginPath(); g.arc(0, 0, 1.2, 0, TAU); g.strokeStyle = css(mix(k.fill, hex('#a07a2e'), 0.3), 0.5); g.lineWidth = 0.12; g.stroke(); }),
    ],
  });
}

export const CUPBOARD: KitPiece = { model: (look, s) => cupboardOf(look, s.hw, s.hd), uses: { tint: true, material: true } };
export const WARDROBE: KitPiece = { model: (look, s) => wardrobeOf(look, s.hw, s.hd), uses: { tint: true, material: true } };
export const LARDER: KitPiece = { model: (look, s) => larderOf(look, s.hw, s.hd), uses: { tint: true, material: true } };
