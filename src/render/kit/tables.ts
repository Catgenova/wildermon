import {
  BRASS, css, deeper, extrude, faceColour, grain, hex, lathe, mix, nail, prism, proj, slab, stud,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type V3,
} from './core';
import { border, INKPOT, knob, leg, LEATHER, PAPER, topBoards, woodSides, woodTones, writing } from './woodwork';

/**
 * The tables (`table`, two subtiles by two; `long_table`, three by two) and
 * the writing desk (`desk`, two by two), in the kit, of a set with the chair
 * (`chair.ts`) and the bench: the chair's square legs a hair thicker, its
 * rails a step deeper, a top of boards with its edge softened.
 *
 * A table is a top of four boards on an apron and four legs, a gold stud in
 * the apron's front. A long table is a top of three long boards nailed down
 * to two trestles -- a foot, an upright and a bearer under the top, the ends
 * of foot and bearer cut away -- with a stretcher between the uprights, its
 * tenons through them and wedged. A writing desk is a top over a pedestal of
 * three drawers with brass knobs at its left and two legs at its right, a
 * panel across the back and a shallow drawer in the knee hole; on it a sheet
 * of writing, a closed book, an inkwell and its quill. Of wood alone, so a
 * dye is a paint over the wood (the book and the paper stay as they are).
 */

/* ---- the table ---------------------------------------------------------------------- */

const TABLE_TOP = 6.8, TABLE_LEG = 1.2;

function tableOf(look: KitLook, hw: number, hd: number): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const x = hw - 2.4, y = hd - 2.4, t0 = TABLE_TOP - 0.8;
  ([[-x, -y], [x, -y], [x, y], [-x, y]] as Pt[]).forEach(([lx, ly], i) => parts.push({ faces: leg(lx, ly, 0, t0, WOOD, 11 + i * 4, TABLE_LEG) }));
  // The apron round under the top, between the legs, a stud in its front.
  parts.push({ faces: slab(-x + 0.25, x - 0.25, -y + 0.25, y - 0.25, t0 - 1.4, t0, END, {
    paint: { ...woodSides(31, 'x'), front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 31, 'x', 0.7); stud(g, s.w / 2, s.h / 2, 0.4); } },
  }) });
  const X = x + 1.15, Y = y + 1.15;
  parts.push({ faces: slab(-X, X, -Y, Y, t0, TABLE_TOP, TOP, { corner: 0.6, bevel: 0.24, paint: { top: topBoards(4, 41, 'x'), ...woodSides(42, 'x') } }), edges: true });
  return { parts, shade: [[-X, -Y, 0], [X, -Y, 0], [X, Y, 0], [-X, Y, 0]] };
}

/* ---- the long table ----------------------------------------------------------------- */

const LONG_TOP = 7.2;

function longTableOf(look: KitLook, hw: number, hd: number): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const L = hw - 1.2, D = hd - 2.4, t0 = LONG_TOP - 0.8;
  const TX = L - 3.2, FOOT = 1.0, BEAR = t0 - 0.8, SZ0 = 2.3, SZ1 = 3.15;
  // A cut-away end on a member seen end on: an outline in y (across the table) and z, pushed through its thickness along x.
  const member = (x: number, half: number, outline: Pt[], seed: number): Face[] => extrude([x, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0], outline, -half, half, WOOD, 0.14, {
    front: (g, k) => { g.save(); g.translate(-D, 0); grain(g, k.fill, D * 2, LONG_TOP, seed, 'x', 0.45); g.restore(); },
    back: (g, k) => { g.save(); g.translate(-D, 0); grain(g, k.fill, D * 2, LONG_TOP, seed + 1, 'x', 0.45); g.restore(); },
  });
  for (const [i, x] of [-TX, TX].entries()) {
    const fy = D - 0.7, by = D - 0.9;
    parts.push({ faces: member(x, 0.62, [[-fy, 0], [fy, 0], [fy, 0.45], [fy - 0.9, FOOT], [-fy + 0.9, FOOT], [-fy, 0.45]], 51 + i * 3) });
    parts.push({ faces: slab(x - 0.55, x + 0.55, -0.85, 0.85, FOOT, BEAR, WOOD, { corner: 0.14, paint: woodSides(61 + i * 4, 'y') }) });
    parts.push({ faces: member(x, 0.6, [[-by + 1.1, BEAR], [by - 1.1, BEAR], [by, BEAR + 0.45], [by, t0], [-by, t0], [-by, BEAR + 0.45]], 71 + i * 3) });
    // The stretcher's tenon through the upright, and the wedge driven through it.
    const sgn = x < 0 ? -1 : 1, x0 = sgn > 0 ? x + 0.55 : x - 1.25, x1 = sgn > 0 ? x + 1.25 : x - 0.55;
    parts.push({ faces: slab(x0, x1, -0.36, 0.36, SZ0 + 0.08, SZ1 - 0.08, END, { corner: 0.08, bevel: 0.08, paint: {
      top: (g, k) => { g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.45)); g.fillRect(-0.18, -0.36, 0.36, 0.72); },
    } }) });
  }
  // The stretcher between the uprights, a stud in its front.
  parts.push({ faces: slab(-TX + 0.55, TX - 0.55, -0.4, 0.4, SZ0, SZ1, END, { corner: 0.1, paint: {
    ...woodSides(81, 'x', 0.6), front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 81, 'x', 0.6); stud(g, s.w / 2, s.h / 2, 0.36); },
  } }) });
  // The top: three long boards, nailed down to the bearers.
  const fixed = (g: Ctx, k: PaintCtx, s: Side): void => {
    topBoards(3, 91, 'x')(g, k, s);
    for (const x of [-TX, TX]) for (const y of [-2 * D / 3, 0, 2 * D / 3]) for (const dx of [-0.25, 0.25]) nail(g, k.fill, x + dx, y + (dx > 0 ? 0.6 : -0.6), 0.13);
  };
  parts.push({ faces: slab(-L, L, -D, D, t0, LONG_TOP, TOP, { corner: 0.6, bevel: 0.24, paint: { top: fixed, ...woodSides(92, 'x') } }), edges: true });
  return { parts, shade: [[-L, -D, 0], [L, -D, 0], [L, D, 0], [-L, D, 0]] };
}

/* ---- the writing desk ---------------------------------------------------------------- */

const DESK_TOP = 7.4;

/** A drawer front painted on a face: its frame a step deeper, its own face, a brass knob in its middle. */
function drawer(g: Ctx, k: PaintCtx, x0: number, y0: number, x1: number, y1: number, r: number): void {
  g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.55), 0.95);
  g.fillRect(x0 - 0.18, y0 - 0.18, x1 - x0 + 0.36, y1 - y0 + 0.36);
  g.fillStyle = css(mix(k.fill, [255, 248, 232], 0.08));
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.save();
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.clip();
  g.translate(x0, y0);
  grain(g, k.fill, x1 - x0, y1 - y0, Math.round(x0 * 7 + y0 * 13), 'x', 0.7);
  g.restore();
  // The light along its upper edge.
  g.fillStyle = css(mix(k.fill, [255, 250, 236], 0.4), 0.6);
  g.fillRect(x0, y1 - 0.12, x1 - x0, 0.12);
  knob(g, k, (x0 + x1) / 2, (y0 + y1) / 2, r, BRASS);
}

function deskOf(look: KitLook, hw: number, hd: number): KitModel {
  const { wood: WOOD, top: TOP, end: END } = woodTones(look.material, look.tint);
  const parts: KitPart[] = [];
  const x = hw - 1.6, y = hd - 3.2, t0 = DESK_TOP - 0.7;
  const PX = -x + 6;
  // The pedestal of drawers on its plinth.
  parts.push({ faces: slab(-x - 0.15, PX + 0.15, -y - 0.15, y - 0.25, 0, 0.55, deeper(WOOD, 0.15), { corner: 0.12, bevel: 0.12 }) });
  const panel = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => { grain(g, k.fill, s.w, s.h, seed, 'y', 0.6); border(g, k.fill, s.w, s.h, 0.55); };
  parts.push({ faces: slab(-x, PX, -y, y - 0.4, 0.55, t0, WOOD, { corner: 0.14, paint: {
    left: panel(11), right: panel(12), back: panel(13),
    front: (g, k, s) => {
      const n = 3, gap = 0.3, h = (s.h - 0.4 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) { const y0 = 0.25 + i * (h + gap); drawer(g, k, 0.5, y0, s.w - 0.5, y0 + h, 0.46); }
    },
  } }) });
  // The legs at the right, the panel across the back, and the shallow drawer in the knee hole.
  for (const [i, ly] of [-y + 0.5, y - 0.9].entries()) parts.push({ faces: leg(x - 0.55, ly, 0, t0, WOOD, 21 + i * 4, 1.0) });
  parts.push({ faces: slab(PX, x - 1.05, -y, -y + 0.45, t0 - 3, t0, END, { paint: { ...woodSides(31, 'x'), front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 31, 'x'); border(g, k.fill, s.w, s.h, 0.4); } } }) });
  parts.push({ faces: slab(PX, x - 1.05, y - 0.85, y - 0.4, t0 - 1.05, t0, END, { paint: {
    ...woodSides(35, 'x'), front: (g, k, s) => { grain(g, k.fill, s.w, s.h, 35, 'x', 0.5); drawer(g, k, s.w * 0.25, 0.2, s.w * 0.75, s.h - 0.2, 0.3); },
  } }) });
  // The top, its edge softened.
  const X0 = -x - 0.45, X1 = x + 0.45, Y0 = -y - 0.65, Y1 = y + 0.4;
  const top = slab(X0, X1, Y0, Y1, t0, DESK_TOP, TOP, { corner: 0.5, bevel: 0.22, paint: { top: topBoards(3, 41, 'x'), ...woodSides(42, 'x') } });
  parts.push({ faces: top, edges: true });

  // On it: a sheet of writing turned a little, a closed book at the back, the inkwell and its quill.
  const z = DESK_TOP;
  const turnedRing = (cx: number, cy: number, w: number, d: number, a: number, zz: number): V3[] => {
    const c = Math.cos(a), s = Math.sin(a);
    return ([[-w, -d], [w, -d], [w, d], [-w, d]] as Pt[]).map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c, zz] as V3);
  };
  const paperAt = (zz: number): V3[] => turnedRing(-1.6, 1.4, 1.75, 2.3, 0.18, zz);
  parts.push({
    faces: prism([paperAt(z), paperAt(z + 0.08)], PAPER, () => ({ crease: 0.2 }), {
      crease: 0.25, paint: (g: Ctx, k: PaintCtx) => { g.save(); g.translate(-1.75, -2.3); writing(g, k.fill, 3.5, 4.6, 7, 3); g.restore(); },
    }),
    ink: 0.55,
  });
  // The book: leather boards, the pages' edges cream between them on three sides.
  const pages = (g: Ctx, k: PaintCtx, s: Side): void => {
    const cream = faceColour(PAPER, k.L);
    g.fillStyle = css(cream);
    g.fillRect(0.2, 0.17, s.w - 0.4, s.h - 0.34);
    g.strokeStyle = css(mix(cream, hex('#8a7468'), 0.4), 0.6);
    g.lineWidth = 0.05;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0.25, 0.17 + (i * (s.h - 0.34)) / 4); g.lineTo(s.w - 0.25, 0.17 + (i * (s.h - 0.34)) / 4); g.stroke(); }
  };
  const bx0 = 2.9, bx1 = 6.5, by0 = -y + 0.3, by1 = -y + 2.9;
  parts.push({ faces: slab(bx0, bx1, by0, by1, z, z + 0.85, LEATHER, { corner: 0.12, bevel: 0.1, paint: {
    front: pages, right: pages, back: pages,
    top: (g, k, s) => {
      g.strokeStyle = css(mix(k.fill, [255, 236, 200], 0.35), 0.7);
      g.lineWidth = 0.12;
      g.strokeRect(-s.w / 2 + 0.35, -s.h / 2 + 0.35, s.w - 0.7, s.h - 0.7);
      g.fillStyle = css(mix(k.fill, hex('#3e2a30'), 0.35));
      g.fillRect(-s.w / 2, -s.h / 2, 0.45, s.h);
    },
  } }) });
  // The inkwell, squat, its neck and lip.
  const ix = 2.3, iy = 2.2;
  parts.push({ faces: lathe(ix, iy, [[z, 0.75], [z + 0.55, 0.8], [z + 0.85, 0.55], [z + 0.95, 0.32], [z + 1.15, 0.36]], 10, INKPOT), edges: true });
  // The quill standing in it: a fine shaft, and the vane down one side of its upper two-thirds.
  const A: V3 = [ix, iy, z + 1.05], B: V3 = [ix + 1.5, iy - 1.1, z + 4.0];
  parts.push({
    reach: [A, B],
    draw: (g, e) => {
      const a = proj(e, A), b = proj(e, B);
      const along = (t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const up = dx > 0 ? -1 : 1, nx = (-dy / l) * up, ny = (dx / l) * up;
      const [m, q, en] = [along(0.3), along(0.62), along(1)];
      g.beginPath();
      g.moveTo(m[0], m[1]);
      g.quadraticCurveTo(q[0] + nx * 1.3, q[1] + ny * 1.3, en[0], en[1]);
      g.closePath();
      g.fillStyle = '#fbf3e4';
      g.fill();
      g.strokeStyle = css(mix(hex('#fbf3e4'), hex('#8a7468'), 0.6));
      g.lineWidth = 0.35;
      g.stroke();
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(en[0], en[1]);
      g.strokeStyle = css(hex('#a89488'));
      g.lineWidth = 0.4;
      g.lineCap = 'round';
      g.stroke();
    },
  });
  return { parts, shade: [[X0, Y0, 0], [X1, Y0, 0], [X1, Y1, 0], [X0, Y1, 0]] };
}

export const TABLE: KitPiece = { model: (look, { hw, hd }) => tableOf(look, hw, hd), uses: { tint: true, material: true } };
export const LONG_TABLE: KitPiece = { model: (look, { hw, hd }) => longTableOf(look, hw, hd), uses: { tint: true, material: true } };
export const DESK: KitPiece = { model: (look, { hw, hd }) => deskOf(look, hw, hd), uses: { tint: true, material: true } };
