import { rand } from '../ivy';
import { cut, RUNE_GOLD, STONE_INK } from '../runestone';
import { ashlar, DOME, DRESSED, FIRE, flame, FOOTING, glow, lilac, ringCourses, speckle, STONE } from './hearthstone';
import {
  css, hex, lathe, mix, slab, TAU, woodTone,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type RGB, type Side,
} from './core';

/**
 * An oven (`oven`, two subtiles by two), in the kit: a brick dome on a square
 * plinth of the kiln's cream stone, a chimney up its back, and at its front a
 * porch with an arched mouth in pale voussoirs, a gold diamond in its
 * keystone. Under the mouth, in the plinth's front, an arched niche stacked
 * with split wood. Lit, the mouth is full of fire and throws its light over
 * the stone round it.
 */

/* ---- where it stands, in units ----------------------------------------------------- */

/** The plinth: half its width and depth, and its top. */
const PX = 9, PY = 8.6, PZ = 5;
/** The dome: its middle, set back, and its profile, [height, radius] from its foot up. */
const DOME_Y = -0.8;
const DOME_PROFILE: Array<[number, number]> = [[PZ, 7.6], [6.8, 7.4], [8.6, 6.7], [10.2, 5.4], [11.4, 3.6], [12.1, 1.7], [12.35, 0.5]];
/** The chimney: half its width, its back and front, its foot in the dome and the foot of its cap. */
const CH_X = 1.35, CH_Y0 = -7.3, CH_Y1 = -4.5, CH_Z0 = 9.2, CH_Z1 = 15.4;
/** The porch: half its width, its back (in the dome) and front, its head. */
const PORCH_X = 3.6, PORCH_Y0 = 5, PORCH_Y1 = 8, PORCH_Z = 11.2;
/** The mouth in the porch's front: its half width, where its arch springs from, its foot; the voussoirs' depth. */
const MOUTH_R = 1.95, MOUTH_SPRING = 2.1, MOUTH_FOOT = 0.35, RING = 0.8;
/** The niche in the plinth's front: half its width, its foot, where its arch springs and its crown. */
const NICHE_R = 3.3, NICHE_FOOT = 0.35, NICHE_SPRING = 1.7, NICHE_TOP = 4.3;

/* ---- painting ------------------------------------------------------------------------- */

/** An arch's outline in a face's frame, `r` half across from `cx`, springing at `spring` and rising `rise` over it, its jambs down to `foot`. */
function archPath(g: Ctx, cx: number, r: number, foot: number, spring: number, rise: number): void {
  g.beginPath();
  g.moveTo(cx - r, foot);
  g.lineTo(cx - r, spring);
  g.ellipse(cx, spring, r, rise, 0, Math.PI, 0, true);
  g.lineTo(cx + r, foot);
  g.closePath();
}

/** The plinth's front: its stone in courses round the niche, and the niche stacked with split wood seen end on. */
function plinthFront(g: Ctx, k: PaintCtx, s: Side): void {
  const fill = k.fill, cx = s.w / 2;
  speckle(g, fill, s.w, s.h, 3);
  ashlar(g, fill, s.w, s.h, 5, 1.25, (x0, x1, z0) => x1 > cx - NICHE_R - 0.3 && x0 < cx + NICHE_R + 0.3 && z0 < NICHE_TOP);
  // Its dressed surround, paler, and the dark inside of it.
  archPath(g, cx, NICHE_R + 0.45, 0, NICHE_SPRING, NICHE_TOP - NICHE_SPRING + 0.45);
  g.fillStyle = css(mix(fill, hex('#fbf0e2'), 0.5));
  g.fill();
  archPath(g, cx, NICHE_R, NICHE_FOOT, NICHE_SPRING, NICHE_TOP - NICHE_SPRING);
  g.fillStyle = '#4a3a44';
  g.fill();
  g.save();
  archPath(g, cx, NICHE_R, NICHE_FOOT, NICHE_SPRING, NICHE_TOP - NICHE_SPRING);
  g.clip();
  // The split logs, stacked three and two and one, their ends pale with a ring or two of grain.
  const wood = woodTone();
  const end: RGB = mix(wood.lit, [255, 244, 222], 0.25 * Math.min(1, k.L));
  const T = rand(9);
  const logs: Array<[number, number]> = [[-2.15, 1.15], [0, 1.15], [2.15, 1.15], [-1.08, 2.85], [1.08, 2.85], [0, 4.4]];
  for (const [dx, z] of logs) {
    const r = 0.92 + 0.08 * T();
    g.beginPath();
    g.ellipse(cx + dx, z, r, r * 0.9, 0, 0, TAU);
    g.fillStyle = css(mix(wood.shade, hex('#4a3640'), 0.25));
    g.fill();
    g.beginPath();
    g.ellipse(cx + dx - 0.06, z + 0.04, r - 0.2, r * 0.9 - 0.2, 0, 0, TAU);
    g.fillStyle = css(end);
    g.fill();
    g.beginPath();
    g.ellipse(cx + dx - 0.06, z + 0.04, (r - 0.2) * 0.5, (r * 0.9 - 0.2) * 0.5, 0, 0, TAU);
    g.strokeStyle = css(mix(end, hex('#8a6448'), 0.5), 0.7);
    g.lineWidth = 0.1;
    g.stroke();
  }
  g.restore();
}

/** The porch's front: coursed stone, soot up over the mouth, the voussoirs and keystone, and the mouth -- dark, or full of fire. */
function porchFront(lit: boolean, frame: number) {
  return (g: Ctx, k: PaintCtx, s: Side): void => {
    const fill = k.fill, cx = s.w / 2;
    speckle(g, fill, s.w, s.h, 11);
    ashlar(g, fill, s.w, s.h, 13, 1.2, (x0, x1, z0) => x1 > cx - MOUTH_R - RING - 0.2 && x0 < cx + MOUTH_R + RING + 0.2 && z0 < MOUTH_SPRING + MOUTH_R + RING - 0.3);
    // Soot up the face over the mouth, from every fire it has had.
    const sg = g.createRadialGradient(cx, MOUTH_SPRING + MOUTH_R + 1.6, 0.4, cx, MOUTH_SPRING + MOUTH_R + 1.6, 3.4);
    sg.addColorStop(0, 'rgba(78, 64, 82, 0.4)');
    sg.addColorStop(1, 'rgba(78, 64, 82, 0)');
    g.fillStyle = sg;
    g.fillRect(cx - 4, MOUTH_SPRING, 8, s.h);
    // The voussoirs, paler, with the joints between them cut.
    const dress = mix(fill, hex('#fbf0e2'), 0.6);
    archPath(g, cx, MOUTH_R + RING, MOUTH_FOOT, MOUTH_SPRING, MOUTH_R + RING);
    g.fillStyle = css(dress);
    g.fill();
    g.strokeStyle = css(mix(fill, STONE_INK, 0.5), 0.7);
    g.lineWidth = 0.16;
    g.stroke();
    for (let j = 1; j < 7; j++) {
      const a = Math.PI - (j / 7) * Math.PI;
      if (Math.abs(a - Math.PI / 2) < 0.25) continue;
      cut(g, dress, 0.12, () => {
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * MOUTH_R, MOUTH_SPRING + Math.sin(a) * MOUTH_R);
        g.lineTo(cx + Math.cos(a) * (MOUTH_R + RING), MOUTH_SPRING + Math.sin(a) * (MOUTH_R + RING));
      });
    }
    // The keystone, proud of them, and a gold diamond in it.
    const kz = MOUTH_SPRING + MOUTH_R;
    g.beginPath();
    g.moveTo(cx - 0.45, kz - 0.1);
    g.lineTo(cx - 0.66, kz + RING + 0.3);
    g.lineTo(cx + 0.66, kz + RING + 0.3);
    g.lineTo(cx + 0.45, kz - 0.1);
    g.closePath();
    g.fillStyle = css(mix(dress, [255, 250, 240], 0.3));
    g.fill();
    g.strokeStyle = css(mix(fill, STONE_INK, 0.45), 0.7);
    g.lineWidth = 0.12;
    g.stroke();
    const kc = kz + (RING + 0.2) / 2;
    g.beginPath();
    g.moveTo(cx, kc + 0.42);
    g.lineTo(cx + 0.3, kc);
    g.lineTo(cx, kc - 0.42);
    g.lineTo(cx - 0.3, kc);
    g.closePath();
    g.fillStyle = RUNE_GOLD;
    g.fill();
    g.strokeStyle = 'rgba(112, 84, 74, 0.9)';
    g.lineWidth = 0.08;
    g.stroke();
    // A pale lip round the opening, so cold it still reads as a mouth.
    archPath(g, cx, MOUTH_R + 0.1, MOUTH_FOOT, MOUTH_SPRING, MOUTH_R + 0.1);
    g.strokeStyle = css(mix(fill, [255, 250, 240], 0.7), 0.9);
    g.lineWidth = 0.22;
    g.stroke();
    // The mouth.
    archPath(g, cx, MOUTH_R, MOUTH_FOOT, MOUTH_SPRING, MOUTH_R);
    if (lit) {
      const fg = g.createRadialGradient(cx, MOUTH_FOOT + 0.4, 0.2, cx, MOUTH_FOOT + 0.4, MOUTH_R * 1.75);
      for (const [t, c] of FIRE) fg.addColorStop(t, c);
      g.fillStyle = fg;
      g.fill();
      g.save();
      archPath(g, cx, MOUTH_R, MOUTH_FOOT, MOUTH_SPRING, MOUTH_R);
      g.clip();
      // The bed of coals and the fire standing up off it (the frame's y is up, so the flame is drawn with its height down).
      g.fillStyle = '#ffb04a';
      g.beginPath();
      g.ellipse(cx, MOUTH_FOOT, MOUTH_R * 0.9, 0.6, 0, 0, TAU);
      g.fill();
      flame(g, cx, MOUTH_FOOT + 0.2, MOUTH_R * 0.75, -(MOUTH_SPRING + MOUTH_R * 0.6), 4, frame);
      g.restore();
      // Its light on the voussoirs and the stone round the mouth.
      g.save();
      g.globalCompositeOperation = 'lighter';
      glow(g, cx, MOUTH_SPRING, MOUTH_R + RING + 2.4, 0.16);
      g.restore();
    } else {
      const ig = g.createLinearGradient(0, MOUTH_FOOT, 0, MOUTH_SPRING + MOUTH_R);
      ig.addColorStop(0, '#523e4c');
      ig.addColorStop(1, '#30242f');
      g.fillStyle = ig;
      g.fill();
      // Ash on its floor.
      g.save();
      archPath(g, cx, MOUTH_R, MOUTH_FOOT, MOUTH_SPRING, MOUTH_R);
      g.clip();
      g.fillStyle = 'rgba(150, 138, 144, 0.85)';
      g.beginPath();
      g.ellipse(cx, MOUTH_FOOT, MOUTH_R * 0.75, 0.55, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  };
}

/** A flat side of plain coursed stone. */
const coursedSide = (seed: number, course = 1.25) => (g: Ctx, k: PaintCtx, s: Side): void => {
  speckle(g, k.fill, s.w, s.h, seed);
  ashlar(g, k.fill, s.w, s.h, seed + 1, course);
};

/** A top paved in flags, in its frame from its middle. */
const paved = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  g.save();
  g.translate(-s.w / 2, -s.h / 2);
  speckle(g, k.fill, s.w, s.h, seed, 0.6);
  const T = rand(seed);
  for (let y = 3; y < s.h - 1; y += 3 + T()) cut(g, k.fill, 0.13, () => { g.beginPath(); g.moveTo(0, y); g.lineTo(s.w, y); });
  for (let x = 3.5; x < s.w - 1; x += 3.5 + T() * 1.5) cut(g, k.fill, 0.11, () => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s.h); });
  g.restore();
};

/* ---- the model ------------------------------------------------------------------------- */

function ovenOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };

  // The plinth, its niche of wood in its front.
  add(slab(-PX, PX, -PY, PY, 0, PZ, FOOTING, {
    corner: 0.35, bevel: 0.3,
    paint: { front: plinthFront, back: coursedSide(21), left: coursedSide(23), right: coursedSide(25), top: paved(27) },
  }), { edges: true });

  // The dome, brick in courses closing in to its crown, washed lilac away from the light and sooted toward the top.
  add(lathe(0, DOME_Y, DOME_PROFILE, 16, DOME, 0.5, (k, i, s) => ({
    crease: 0.14,
    paint: (g: Ctx, kk: PaintCtx) => {
      g.globalAlpha = 1 - 0.12 * Math.max(0, Math.min(1, kk.L));
      ringCourses(g, kk.fill, s, i, 40 + k * 17 + i, 1.15, 0.1, true);
      g.globalAlpha = 1;
      lilac(g, kk.L, s.w, s.h);
      if (k === 0) {
        g.fillStyle = 'rgba(86, 72, 98, 0.3)';
        g.fillRect(-1, -0.2, s.w + 2, 0.5);
      }
      if (k >= 4) {
        g.fillStyle = `rgba(70, 58, 78, ${0.1 + 0.08 * (k - 4)})`;
        g.fillRect(-1, -1, s.w + 2, s.h + 2);
      }
    },
  })), { edges: true });

  // The chimney up its back, and the cap over it, sooted round the flue.
  add(slab(-CH_X, CH_X, CH_Y0, CH_Y1, CH_Z0, CH_Z1, STONE, {
    corner: 0.18,
    paint: { front: coursedSide(51, 1.1), back: coursedSide(53, 1.1), left: coursedSide(55, 1.1), right: coursedSide(57, 1.1) },
  }));
  add(slab(-CH_X - 0.4, CH_X + 0.4, CH_Y0 - 0.4, CH_Y1 + 0.4, CH_Z1, CH_Z1 + 0.75, DRESSED, {
    corner: 0.15, bevel: 0.22,
    paint: {
      top: (g) => {
        g.fillStyle = 'rgba(66, 52, 66, 0.5)';
        g.fillRect(-CH_X * 0.9, -1.1, CH_X * 1.8, 2.2);
        g.fillStyle = '#30242f';
        g.fillRect(-CH_X * 0.6, -0.75, CH_X * 1.2, 1.5);
      },
    },
  }), { edges: true });

  // The porch at its front, and the mouth in it.
  add(slab(-PORCH_X, PORCH_X, PORCH_Y0, PORCH_Y1, PZ, PORCH_Z, STONE, {
    corner: 0.2, bevel: 0.32,
    paint: { front: porchFront(look.lit, look.frame ?? 0), left: coursedSide(61, 1.2), right: coursedSide(63, 1.2), top: paved(65) },
  }), { edges: true });

  return { parts, shade: [[-PX, -PY, 0], [PX, -PY, 0], [PX, PY, 0], [-PX, PY, 0]] };
}

export const OVEN: KitPiece = {
  model: (look) => ovenOf(look),
  uses: { lit: true },
  flicker: 4,
};
