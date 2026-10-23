import {
  band, BRASS, css, deeper, extrude, faceColour, grain, hex, IRON, mix, sheen, slab, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt,
} from './core';
import { grained, hinge, joint, knob, panel } from './joinery';

/**
 * A mailbox (`mailbox`, one subtile), in the kit: a post on a cross foot
 * under a box with a gabled end to its front and back, bound in two iron
 * straps, a brass plate round the slot on its front and a door on its back
 * hung on two hinges with a brass knob, under a shingled roof whose ridge
 * runs front to back. The wood is what it was built of; dyed, it is painted
 * and the iron and brass are left bare.
 */

/** The box: half its width and depth, its foot, its eaves and its apex. */
const BX = 2.8, BY = 2.2, FOOT = 8.6, EAVE = 12.2, APEX = 13.9;
/** The roof: half its span and length, the underside at the eaves and the ridge, and its thickness. */
const RX = 3.3, RY = 2.7, R0 = 11.95, RIDGE = 13.95, RT = 0.4;
/** The straps round the box: how far up from its foot each runs, and how wide. */
const STRAPS = [0.5, 2.65], STRAP_W = 0.5;

/** Shingles over a slope `len` along and `w` across (centred): courses down it, each stepped, the joints staggered. */
function shingles(g: Ctx, k: PaintCtx, len: number, w: number, seed: number): void {
  const course = 0.62;
  const n = Math.ceil(len / course);
  for (let c = 0; c < n; c++) {
    const x0 = c * course;
    // Each course a hair darker at its tail, where the one over it laps it.
    g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.45), 0.85);
    g.fillRect(x0, -w / 2, 0.16, w);
    g.fillStyle = css(mix(k.fill, [255, 248, 232], 0.35), 0.6);
    g.fillRect(x0 + course - 0.12, -w / 2, 0.1, w);
    const off = ((c * 7 + seed) % 3) * 0.33;
    g.fillStyle = css(mix(k.fill, hex('#3e2c38'), 0.45), 0.8);
    for (let y = -w / 2 + off; y < w / 2; y += 1.0) g.fillRect(x0, y, course, 0.08);
  }
}

function mailboxOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const BASE = deeper(woodTone(look.material), 0.22);
  const ROOF = deeper(WOOD, 0.5);
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The cross foot, as one: two sills halved into each other.
  const cross: Pt[] = [[-2.4, -0.55], [-0.55, -0.55], [-0.55, -2.4], [0.55, -2.4], [0.55, -0.55], [2.4, -0.55], [2.4, 0.55], [0.55, 0.55], [0.55, 2.4], [-0.55, 2.4], [-0.55, 0.55], [-2.4, 0.55]];
  add(extrude([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], cross, 0, 0.7, BASE, 0.12, {
    front: (g, k) => {
      for (const [x0, y0, w, h, along] of [[-2.4, -0.55, 4.8, 1.1, 'x'], [-0.55, -2.4, 1.1, 4.8, 'y']] as const) {
        g.save(); g.translate(x0, y0); grain(g, k.fill, w, h, 12, along, 0.6); g.restore();
      }
    },
  }), { edges: true });
  // The post.
  add(slab(-0.6, 0.6, -0.6, 0.6, 0.7, FOOT, WOOD, {
    corner: 0.15, paint: { front: grained(21, 'y'), back: grained(22, 'y'), left: grained(23, 'y'), right: grained(24, 'y') },
  }));

  // The box, its gabled ends to the front and back.
  const outline: Pt[] = [[-BX, FOOT], [BX, FOOT], [BX, EAVE], [0, APEX], [-BX, EAVE]];
  const straps = (g: Ctx, k: PaintCtx): void => { for (const s of STRAPS) band(g, k, -BX - 0.1, BX + 0.1, FOOT + s, FOOT + s + STRAP_W, 3, false); };
  const box = add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, -BY, BY, WOOD, 0.14, {
    front: (g, k) => {
      g.save(); g.translate(-BX, FOOT); grain(g, k.fill, BX * 2, APEX - FOOT, 31, 'x', 0.7); g.restore();
      straps(g, k);
      // The slot, in a brass plate.
      const fill = faceColour(BRASS, Math.min(1, k.L + 0.08));
      const [x0, x1, z0, z1] = [-1.75, 1.75, FOOT + 1.45, FOOT + 2.35];
      g.fillStyle = css(mix(fill, hex('#3a2c30'), 0.55), 0.95);
      g.fillRect(x0 - 0.12, z0 - 0.12, x1 - x0 + 0.24, z1 - z0 + 0.24);
      g.fillStyle = css(fill);
      g.fillRect(x0, z0, x1 - x0, z1 - z0);
      g.save(); g.translate(x0, z0); sheen(g, fill, x1 - x0, z1 - z0, 9); g.restore();
      g.fillStyle = css(mix(fill, hex('#2a2030'), 0.85));
      g.fillRect(x0 + 0.4, z0 + 0.32, x1 - x0 - 0.8, 0.3);
      g.fillStyle = css(mix(fill, [255, 255, 255], 0.5), 0.7);
      g.fillRect(x0, z1 - 0.1, x1 - x0, 0.1);
    },
    back: (g, k) => {
      g.save(); g.translate(-BX, FOOT); grain(g, k.fill, BX * 2, APEX - FOOT, 32, 'x', 0.7); g.restore();
      // The door: a panel in its frame, hung on two hinges, a knob to open it by. Seen from behind, its left is the model's right.
      const [x0, x1, z0, z1] = [-BX + 0.4, BX - 0.4, FOOT + 0.3, EAVE - 0.3];
      joint(g, k.fill, x0, z0, x1, z0); joint(g, k.fill, x0, z1, x1, z1); joint(g, k.fill, x0, z0, x0, z1); joint(g, k.fill, x1, z0, x1, z1);
      panel(g, k.fill, x0 + 0.55, z0 + 0.55, x1 - 0.55, z1 - 0.55, 33, false);
      for (const z of [z0 + 0.45, z1 - 1.0]) hinge(g, k, x1, z, z + 0.55, -1.1, IRON);
      knob(g, k, x0 + 0.55, (z0 + z1) / 2, 0.3);
    },
    edge: (i) => {
      const p = outline[i], q = outline[(i + 1) % outline.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return {
        paint: (g: Ctx, k: PaintCtx) => {
          g.save(); g.translate(0, -BY); grain(g, k.fill, len, BY * 2, 40 + i, 'x', 0.7); g.restore();
          // Up its sides (edge 1 rises, edge 4 falls), the straps round it.
          if (i === 1) for (const s of STRAPS) band(g, k, s, s + STRAP_W, -BY - 0.1, BY + 0.1, 2, true);
          if (i === 4) for (const s of STRAPS) band(g, k, len - s - STRAP_W, len - s, -BY - 0.1, BY + 0.1, 2, true);
        },
      };
    },
  }));

  // The roof: two shingled slopes over the box, its ridge running front to back.
  const roof: Pt[] = [[-RX, R0], [0, RIDGE], [RX, R0], [RX, R0 + RT], [0, RIDGE + RT], [-RX, R0 + RT]];
  add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], roof, -RY, RY, ROOF, 0.1, {
    front: (g, k) => { g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.2), 0.5); g.fillRect(-RX, R0, RX * 2, RT * 0.3); },
    edge: (i) => {
      const p = roof[i], q = roof[(i + 1) % roof.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (i !== 3 && i !== 4) return undefined;
      // The two top slopes: edge 3 up the right from its eave, edge 4 down the left to its eave.
      return { paint: (g: Ctx, k: PaintCtx) => shingles(g, k, len, RY * 2, i) };
    },
  }), { edges: true, after: [box] });

  return { parts, shade: [[-2.8, -2.8, 0], [2.8, -2.8, 0], [2.8, 2.8, 0], [-2.8, 2.8, 0]] };
}

export const MAILBOX: KitPiece = {
  model: (look) => mailboxOf(look),
  uses: { tint: true, material: true },
};
