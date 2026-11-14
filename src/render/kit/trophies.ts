import { stoneSkin, strut } from './outdoor';
import { DRESSED } from './hearthstone';
import {
  css, deeper, extrude, hex, lathe, mix, paler, slab, TAU, toneOf,
  type Ctx, type Face, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tone, type V3,
} from './core';

/**
 * The trophies out of a lair's hoard (`lairs.ts`), one subtile each, in the
 * kit: each on the same small plinth of dressed stone -- a goblin chief's ear
 * pinned upright with a gold ring through it, a warlord's tusk on a cradle, an
 * ogre king's jaw with its teeth, and a great dragon scale stood on edge, red
 * with a gold rim.
 */

/** The plinth: its base, its die and its cap, half widths and heads. */
const BASE = 2.2, BASE_Z = 0.5, DIE = 1.7, DIE_Z = 2.9, CAP = 2.0, Z = 3.4;

/** A goblin chief's skin, a warlord's tusk and an ogre king's bone, a dragon's scale, and the gold set in them. */
const SKIN: Tone = toneOf('#b4c27c', '#5e7046');
const IVORY: Tone = toneOf('#f6ecd6', '#b0a08c');
const JAW: Tone = toneOf('#ece0d2', '#9c8890');
const SCALE: Tone = toneOf('#e0705a', '#7a3040');
const GOLD = '#f2c24a';

/** The plinth every trophy stands on. */
function plinth(parts: KitPart[]): KitPart {
  const skin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => stoneSkin(g, k.fill, s.w, s.h, seed, 1);
  parts.push({ faces: slab(-BASE, BASE, -BASE, BASE, 0, BASE_Z, DRESSED, { corner: 0.2, bevel: 0.12, paint: { front: skin(1), back: skin(2), left: skin(3), right: skin(4) } }), edges: true });
  parts.push({ faces: slab(-DIE, DIE, -DIE, DIE, BASE_Z, DIE_Z, DRESSED, { corner: 0.15, paint: { front: skin(5), back: skin(6), left: skin(7), right: skin(8) } }) });
  const cap: KitPart = { faces: slab(-CAP, CAP, -CAP, CAP, DIE_Z, Z, DRESSED, { corner: 0.2, bevel: 0.18 }), edges: true };
  parts.push(cap);
  return cap;
}

/** An outline stood upright on the plinth, `t` thick, facing the front. */
const upright = (outline: Pt[], t: number, tone: Tone, bevel: number, front?: (g: Ctx, k: PaintCtx) => void): Face[] =>
  extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], outline, -t / 2, t / 2, tone, bevel, front ? { front, back: front } : {});

function earOf(): KitModel {
  const parts: KitPart[] = [];
  const cap = plinth(parts);
  // The ear: long, pointed up and out to the right, its lobe at the foot.
  const ear: Pt[] = [[-0.9, Z + 0.4], [-0.2, Z + 0.1], [0.6, Z + 0.5], [1.3, Z + 1.8], [1.8, Z + 4.4], [0.9, Z + 3.2], [0.1, Z + 2.4], [-0.8, Z + 1.6], [-1.1, Z + 0.9]];
  parts.push({
    faces: upright(ear, 0.5, SKIN, 0.16, (g, k) => {
      // Its inner fold, a darker curve up its middle.
      g.beginPath();
      g.moveTo(-0.4, Z + 0.8);
      g.quadraticCurveTo(0.5, Z + 1.6, 1.3, Z + 3.4);
      g.strokeStyle = css(mix(k.fill, hex('#3e5034'), 0.45), 0.8);
      g.lineWidth = 0.22;
      g.stroke();
      // The gold ring through its lobe.
      g.beginPath();
      g.ellipse(-0.55, Z + 0.75, 0.32, 0.32, 0, 0, TAU);
      g.strokeStyle = GOLD;
      g.lineWidth = 0.16;
      g.stroke();
    }),
    after: [cap],
    edges: true,
  });
  return { parts, shade: [[-BASE, -BASE, 0], [BASE, -BASE, 0], [BASE, BASE, 0], [-BASE, BASE, 0]] };
}

function tuskOf(): KitModel {
  const parts: KitPart[] = [];
  const cap = plinth(parts);
  // The cradle: two little posts.
  const posts: KitPart[] = [-1.1, 1.1].map((x) => {
    const p: KitPart = { faces: slab(x - 0.22, x + 0.22, -0.3, 0.3, Z, Z + 0.9, deeper(DRESSED, 0.12), { corner: 0.08 }), after: [cap] };
    parts.push(p);
    return p;
  });
  // The tusk: a curve across the cradle, thick at its root, rising to its point, in four tapering lengths.
  const pts: V3[] = [[-1.9, 0, Z + 1.1], [-0.6, 0, Z + 1.0], [0.6, 0, Z + 1.35], [1.5, 0, Z + 2.1], [1.9, 0, Z + 3.1]];
  const faces: Face[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const w = 0.85 * (1 - i * 0.2);
    faces.push(...strut(pts[i], pts[i + 1], w, w, i === 0 ? deeper(IVORY, 0.08) : IVORY));
  }
  faces.push(...lathe(pts[4][0], pts[4][1], [[pts[4][2] - 0.1, 0.2], [pts[4][2] + 0.45, 0.02]], 5, paler(IVORY, 0.1)));
  // A gold band round its root.
  faces.push(...strut([-1.75, 0, Z + 1.1], [-1.45, 0, Z + 1.08], 0.95, 0.95, toneOf(GOLD, '#9a7230')));
  parts.push({ faces, after: [cap, ...posts], edges: true });
  return { parts, shade: [[-BASE, -BASE, 0], [BASE, -BASE, 0], [BASE, BASE, 0], [-BASE, BASE, 0]] };
}

function jawOf(): KitModel {
  const parts: KitPart[] = [];
  const cap = plinth(parts);
  // The jaw: a U lying on the cap, its chin to the front, its two rami rising at the back.
  const faces: Face[] = [];
  const u: V3[] = [[-1.5, -1.1, Z + 1.6], [-1.5, -0.6, Z + 0.45], [-1.1, 0.8, Z + 0.4], [0, 1.4, Z + 0.4], [1.1, 0.8, Z + 0.4], [1.5, -0.6, Z + 0.45], [1.5, -1.1, Z + 1.6]];
  for (let i = 0; i + 1 < u.length; i++) faces.push(...strut(u[i], u[i + 1], 0.7, 0.7, JAW));
  parts.push({ faces, after: [cap], edges: true });
  // The teeth along its top, and a gold one at the front.
  const teeth: Face[] = [];
  [[-1.3, 0.2], [-0.8, 0.95], [0, 1.3], [0.8, 0.95], [1.3, 0.2]].forEach(([x, y], i) => {
    const big = i === 0 || i === 4;
    teeth.push(...lathe(x, y, [[Z + 0.7, 0.24], [Z + (big ? 1.5 : 1.15), 0.04]], 5, i === 2 ? toneOf(GOLD, '#9a7230') : paler(JAW, 0.15)));
  });
  parts.push({ faces: teeth, after: [cap, parts[parts.length - 1]] });
  return { parts, shade: [[-BASE, -BASE, 0], [BASE, -BASE, 0], [BASE, BASE, 0], [-BASE, BASE, 0]] };
}

function scaleOf(): KitModel {
  const parts: KitPart[] = [];
  const cap = plinth(parts);
  // A foot to hold it upright.
  const foot: KitPart = { faces: slab(-1.0, 1.0, -0.55, 0.55, Z, Z + 0.45, deeper(DRESSED, 0.12), { corner: 0.2, bevel: 0.1 }), after: [cap], edges: true };
  parts.push(foot);
  // The scale: a broad shield, round at its head and pointed at its foot, stood on edge, rimmed in gold.
  const sc: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    sc.push([Math.cos(a) * 1.75, Z + 3.0 + Math.sin(a) * 1.5]);
  }
  sc.push([-1.2, Z + 1.3], [0, Z + 0.35], [1.2, Z + 1.3]);
  parts.push({
    faces: upright(sc.map(([x, z]) => [x, z] as Pt).reverse(), 0.38, SCALE, 0.14, (g, k) => {
      // The ridge down its middle and the lines fanning from it.
      g.strokeStyle = css(mix(k.fill, hex('#fff0e0'), 0.3), 0.7);
      g.lineWidth = 0.12;
      for (const d of [-1, -0.5, 0, 0.5, 1]) {
        g.beginPath();
        g.moveTo(0, Z + 0.7);
        g.quadraticCurveTo(d * 0.6, Z + 2.4, d * 1.2, Z + 4.1);
        g.stroke();
      }
      // The gold rim.
      g.beginPath();
      sc.forEach(([x, z], i) => (i ? g.lineTo(x * 0.92, Z + (z - Z - 2.2) * 0.92 + 2.2) : g.moveTo(x * 0.92, Z + (z - Z - 2.2) * 0.92 + 2.2)));
      g.closePath();
      g.strokeStyle = GOLD;
      g.lineWidth = 0.22;
      g.stroke();
    }),
    after: [cap, foot],
    edges: true,
  });
  return { parts, shade: [[-BASE, -BASE, 0], [BASE, -BASE, 0], [BASE, BASE, 0], [-BASE, BASE, 0]] };
}

export const CHIEF_EAR: KitPiece = { model: () => earOf(), uses: {} };
export const WARLORD_TUSK: KitPiece = { model: () => tuskOf(), uses: {} };
export const OGRE_KING_JAW: KitPiece = { model: () => jawOf(), uses: {} };
export const GREAT_DRAGON_SCALE: KitPiece = { model: () => scaleOf(), uses: {} };
