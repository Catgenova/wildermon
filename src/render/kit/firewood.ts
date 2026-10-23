import {
  css, deeper, extrude, faceColour, grain, hex, mix, nail, paler, slab, TAU, woodTone,
  type Ctx, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side,
} from './core';
import { rand } from '../ivy';
import { area2 } from '../runestone';

/**
 * The firewood rack (`firewood_rack`, two subtiles by one), in the kit: a
 * frame of the wood it was built of -- a runner along the foot of either
 * side, a post up each corner, a rail across each end at the top -- and,
 * stacked in it, split lengths laid across, four courses each bedded in the
 * one under it, their ends a wall of rings to the front and the back and
 * their bark along the top. The rack takes the dye; the logs do not.
 *
 * The island sends it no `trim`, and the old model drew it full: so is this.
 */

/** The frame: half its length and depth, its height, its runners' height, and the posts' and rails' thickness. */
const X = 9.1, Y = 3.4, H = 8.6, FOOT = 1, POST = 0.9;
/** The logs: how round, how far apart along a course, how far one course over the next, and how many courses. */
const R = 1.02, DS = 2.0, DT = 1.72, ROWS = 4;
/** How deep the stack is, front to back. */
const DEPTH = Y - 0.1;

/** The logs of each course: their middles, along it and up it. Even courses have eight, odd ones seven bedded between them. */
const LOGS: Pt[] = Array.from({ length: ROWS }, (_, r) => {
  const n = r % 2 ? 7 : 8;
  return Array.from({ length: n }, (_, j) => [(j - (n - 1) / 2) * DS, FOOT + R + r * DT] as Pt);
}).flat();
const W = 3.5 * DS + R;

/** The stack seen end on: its foot, then over the top of its logs from right to left. */
function stackOutline(): Pt[] {
  const out: Pt[] = [[-W, FOOT], [W, FOOT]];
  const top = LOGS.filter(([, z]) => z > FOOT + R + (ROWS - 3) * DT);
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const s = W - (i / steps) * 2 * W;
    let z = FOOT;
    for (const [cs, cz] of top) {
      const d = s - cs;
      if (Math.abs(d) <= R) z = Math.max(z, cz + Math.sqrt(R * R - d * d));
    }
    out.push([s, z]);
  }
  return out;
}

/** The ends of the logs: a ring of bark, the pale sawn wood, a growth ring or two, the heart and a check split out from it. */
function ends(endTone: ReturnType<typeof woodTone>) {
  return (g: Ctx, k: PaintCtx): void => {
    const T = rand(23);
    // Dark between the logs, where the light does not get in.
    g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.35));
    g.fillRect(-W - 1, FOOT - 1, W * 2 + 2, ROWS * DT + 4);
    const end = faceColour(endTone, k.L);
    for (const [s, t] of LOGS) {
      const tint = T();
      const fill = tint < 0.3 ? mix(end, [255, 250, 236], 0.18) : tint > 0.75 ? mix(end, hex('#b08060'), 0.18) : end;
      g.beginPath(); g.arc(s, t, R - 0.04, 0, TAU);
      g.fillStyle = css(mix(k.fill, hex('#4a3640'), 0.15));
      g.fill();
      g.beginPath(); g.arc(s + 0.03, t - 0.03, R * 0.8, 0, TAU);
      g.fillStyle = css(fill);
      g.fill();
      g.strokeStyle = css(mix(fill, hex('#8a6a58'), 0.4), 0.55);
      g.lineWidth = 0.08;
      g.beginPath(); g.arc(s + 0.05, t - 0.05, R * 0.48, 0, TAU); g.stroke();
      g.beginPath(); g.arc(s + 0.06, t - 0.06, 0.1, 0, TAU);
      g.fillStyle = css(mix(fill, hex('#6e5060'), 0.5));
      g.fill();
      const a = T() * TAU;
      g.lineWidth = 0.07;
      g.strokeStyle = css(mix(fill, hex('#5c4048'), 0.5), 0.6);
      g.beginPath(); g.moveTo(s + 0.06, t - 0.06); g.lineTo(s + Math.cos(a) * R * 0.75, t + Math.sin(a) * R * 0.75); g.stroke();
      // The light on the upper left of each round, where it stands proud of the next.
      g.strokeStyle = css(mix(fill, [255, 252, 240], 0.5), 0.6);
      g.lineWidth = 0.1;
      g.beginPath(); g.arc(s, t, R * 0.86, Math.PI * 0.55, Math.PI * 1.05); g.stroke();
    }
  };
}

function rackOf(look: KitLook): KitModel {
  const WOOD = woodTone(look.material, look.tint, 0.75);
  const RAIL = paler(WOOD, 0.06);
  const BARK = deeper(woodTone('oak'), 0.62);
  const END = woodTone('pine');
  const parts: KitPart[] = [];
  const side = (seed: number, along: 'x' | 'y') => (g: Ctx, k: PaintCtx, s: Side): void => grain(g, k.fill, s.w, s.h, seed, along, 0.6);
  const all = (seed: number, along: 'x' | 'y') => ({ front: side(seed, along), back: side(seed + 1, along), left: side(seed + 2, along), right: side(seed + 3, along) });

  // The runners along the foot of each side, the posts nailed to them.
  for (const [i, y] of [-Y, Y].entries()) {
    parts.push({ faces: slab(-X, X, y - 0.45, y + 0.45, 0, FOOT, deeper(WOOD, 0.12), { corner: 0.12, bevel: 0.14, paint: all(10 + i * 4, 'x') }), edges: true });
  }
  for (const [i, x] of [-(X - 0.5), X - 0.5].entries()) {
    for (const [j, y] of [-Y, Y].entries()) {
      parts.push({
        faces: slab(x - POST / 2, x + POST / 2, y - POST / 2, y + POST / 2, FOOT, H, WOOD, {
          corner: 0.14, bevel: 0.14,
          paint: {
            ...all(20 + i * 8 + j * 4, 'y'),
            // The nails into the rail at its head.
            [y > 0 ? 'front' : 'back']: (g: Ctx, k: PaintCtx, s: Side) => { grain(g, k.fill, s.w, s.h, 40 + i + j, 'y', 0.6); nail(g, k.fill, s.w / 2, s.h - 0.42, 0.13); nail(g, k.fill, s.w / 2, 0.4, 0.13); },
          },
        }),
        edges: true,
      });
    }
    // The rail across the end at the top, between the posts.
    parts.push({
      faces: slab(x - POST / 2 + 0.05, x + POST / 2 - 0.05, -Y + POST / 2, Y - POST / 2, H - 0.85, H, RAIL, {
        bevel: 0.12,
        paint: { ...all(50 + i * 4, 'x'), top: (g, k, s) => { g.save(); g.translate(-s.w / 2, -s.h / 2); grain(g, k.fill, s.w, s.h, 58 + i, 'y', 0.6); g.restore(); } },
      }),
      edges: true,
    });
  }

  // The stack, end on: the rings of its logs to the front and back, their bark over its top.
  const outline = stackOutline();
  const wound = area2(outline) < 0 ? outline.slice().reverse() : outline;
  parts.push({
    faces: extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, -DEPTH, DEPTH, BARK, 0.1, {
      front: ends(END), back: ends(END),
      edge: (i) => ({
        crease: 0.12,
        paint: (g: Ctx, k: PaintCtx) => {
          const T = rand(70 + i);
          const p = wound[i], q = wound[(i + 1) % wound.length];
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          g.lineCap = 'round';
          // An end of the stack: the sides of the logs of the even courses, the odd ones set back between them in the dark.
          if (len > 2 && Math.abs(q[0] - p[0]) < 0.01) {
            const z0 = Math.min(p[1], q[1]);
            for (let r = 1; r < ROWS; r += 2) {
              const z = FOOT + R + r * DT - z0;
              const at = p[1] < q[1] ? z : len - z;
              g.fillStyle = css(mix(k.fill, hex('#3e3040'), 0.45), 0.85);
              g.fillRect(at - 0.55, -DEPTH - 0.5, 1.1, DEPTH * 2 + 1);
            }
          }
          for (let n = 0; n < Math.max(2, Math.round(len * 2.5)); n++) {
            const x = T() * len;
            g.strokeStyle = T() < 0.5 ? css(mix(k.fill, hex('#3e3040'), 0.3), 0.5) : css(mix(k.fill, [255, 240, 220], 0.3), 0.45);
            g.lineWidth = 0.1 + T() * 0.08;
            g.beginPath(); g.moveTo(x, -DEPTH + T() * 1.5); g.lineTo(x, DEPTH - T() * 1.5); g.stroke();
          }
        },
      }),
      edgeCrease: 0.12,
    }),
    edges: false,
  });
  return { parts, shade: [[-X, -Y - 0.45, 0], [X, -Y - 0.45, 0], [X, Y + 0.45, 0], [-X, Y + 0.45, 0]] };
}

export const FIREWOOD_RACK: KitPiece = { model: (look) => rackOf(look), uses: { tint: true, material: true } };
