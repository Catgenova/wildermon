import { HEIGHT_SCALE } from '../iso';
import { rand } from '../ivy';
import { flame, glow, speckle } from './hearthstone';
import { strut } from './outdoor';
import {
  css, deeper, extrude, grain, hex, lathe, mix, paler, prism, proj, TAU, toneOf,
  type Ctx, type Face, type KitLook, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type Side, type Tone, type V3,
} from './core';

/**
 * The monster lairs (`lairs.ts`), one tile each (`hw` and `hd` ten units), in
 * the kit: a goblin warren's burrow mound, an orc camp's palisade round its
 * fire, an ogre cave's mouth in a rocky outcrop, and a dragon roost's nest of
 * bones. Each is the island's, set down where it sites the lair. The camp's
 * fire burns while its garrison holds it and is out once it is cleared
 * (`lair_piece`, the piece's `lit`).
 */

/* ---- the palette ------------------------------------------------------------------ */

/** Turned earth, a warren's spoil. */
const EARTH: Tone = toneOf('#b48a66', '#664a56');
/** Turf over a mound. */
const TURF: Tone = toneOf('#b8c98e', '#5f7a62');
/** The outcrop's stone: a lilac-grey, paler than the rock the ground draws. */
const CRAG: Tone = toneOf('#d8c6d6', '#6a5494');
/** The dark of a hole in the ground, never black: a deep plum. */
const DARK = '#4a3a52';
/** Logs, bark on. */
const LOG: Tone = toneOf('#b08a68', '#62485a');
/** Bone and ivory. */
const BONE: Tone = toneOf('#f4ead6', '#a89aa0');
/** Twigs and straw. */
const STRAW: Tone = toneOf('#dcc28c', '#8a7060');
/** The splash: war red, and hoard gold. */
const RED = '#d8463e';
const GOLD = '#f2c24a';

/* ---- painting -------------------------------------------------------------------- */

/** Clods over a face of earth: darker and paler lumps, a pebble now and then. */
const clods = (seed: number, k0 = 0.6) => (g: Ctx, k: PaintCtx, s: Side): void => {
  const T = rand(seed);
  const n = Math.max(2, Math.round(s.w * s.h * k0 * 0.5));
  for (let i = 0; i < n; i++) {
    const x = T() * s.w, y = T() * s.h, r = 0.2 + T() * 0.35;
    g.beginPath();
    g.ellipse(x, y, r * 1.3, r, (T() - 0.5) * 0.8, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(k.fill, hex('#4a3440'), 0.32), 0.5) : css(mix(k.fill, [255, 236, 210], 0.22), 0.4);
    g.fill();
  }
};

/** Turf: blades of a paler and a darker green over a face. */
const blades = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  const T = rand(seed);
  g.lineCap = 'round';
  g.lineWidth = 0.16;
  const n = Math.max(3, Math.round(Math.abs(s.w * s.h) * 0.5));
  for (let i = 0; i < n; i++) {
    const x = (T() - 0.5) * s.w, y = (T() - 0.5) * s.h, h = 0.4 + T() * 0.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (T() - 0.5) * 0.3, y + h);
    g.strokeStyle = T() < 0.5 ? css(mix(k.fill, hex('#f0f6c8'), 0.3), 0.7) : css(mix(k.fill, hex('#3e5a48'), 0.35), 0.6);
    g.stroke();
  }
};

/** A rock's skin: speckled, with a crack or two run across it. */
const rockSkin = (seed: number) => (g: Ctx, k: PaintCtx, s: Side): void => {
  speckle(g, k.fill, s.w, s.h, seed + 5, 0.8);
  const T = rand(seed);
  g.lineCap = 'round';
  g.strokeStyle = css(mix(k.fill, hex('#4a3a5a'), 0.4), 0.55);
  g.lineWidth = 0.14;
  for (let i = 0; i < 1 + Math.floor(T() * 2); i++) {
    let x = T() * s.w, y = T() * s.h;
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 3; j++) { x += (T() - 0.5) * 1.6; y += (T() - 0.3) * 1.2; g.lineTo(x, y); }
    g.stroke();
  }
};

/** A ring of `n` points round (cx, cy) at height z, each pushed in or out by its own little amount. */
function lumpy(n: number, cx: number, cy: number, rx: number, ry: number, z: number, seed: number, by = 0.1, turn = 0): V3[] {
  const J = rand(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + turn) / n) * TAU, j = 1 + (J() - 0.5) * 2 * by;
    return [cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j, z] as V3;
  });
}

/** Rings drawn in as they rise, all from one set of lumps so they stack. */
function mound(n: number, cx: number, cy: number, rx: number, ry: number, steps: Array<[number, number]>, seed: number, by = 0.08): V3[][] {
  const J = rand(seed);
  const jit = Array.from({ length: n }, () => 1 + (J() - 0.5) * 2 * by);
  return steps.map(([k, z]) => jit.map((j, i) => {
    const a = (i / n) * TAU;
    return [cx + Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j, z] as V3;
  }));
}

/** An arched doorway's outline, in its own plane: `w` across, its springing at `s` and its crown at `h`. */
function arch(w: number, s: number, h: number, n = 10): Pt[] {
  const pts: Pt[] = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([Math.cos(a) * (w / 2), s + Math.sin(a) * (h - s)]);
  }
  return pts;
}

/** The dark of an opening painted on the face of a block, in its frame (`x` across, `y` up): a hole in the ground, a rim of light round it. */
function opening(w: number, s: number, h: number, rim: string) {
  return (g: Ctx): void => {
    const path = (k: number, dz = 0): void => {
      g.beginPath();
      g.moveTo(-w / 2 * k, dz);
      g.lineTo(-w / 2 * k, s * k + dz);
      g.ellipse(0, s * k + dz, w / 2 * k, (h - s) * k, 0, Math.PI, 0, true);
      g.lineTo(w / 2 * k, dz);
      g.closePath();
    };
    path(1);
    g.fillStyle = rim;
    g.fill();
    path(0.82, 0);
    g.fillStyle = DARK;
    g.fill();
    // The floor going in: a lip of light earth.
    g.beginPath();
    g.ellipse(0, 0.15, w * 0.36, 0.35, 0, 0, TAU);
    g.fillStyle = css(hex('#7a5a5e'), 0.8);
    g.fill();
  };
}

/** A point drawn up from a square end (`base`, four corners) to `apex`: a stake's or a horn's tip. */
function tip(base: V3[], apex: V3, tone: Tone): Face[] {
  const c: V3 = [0, 1, 2].map((d) => base.reduce((m, p) => m + p[d], 0) / base.length) as V3;
  return base.map((p, i) => {
    const q = base[(i + 1) % base.length];
    const u: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v: V3 = [apex[0] - p[0], apex[1] - p[1], apex[2] - p[2]];
    let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(...n) || 1;
    n = [n[0] / m, n[1] / m, n[2] / m];
    const mid: V3 = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1], (p[2] + q[2]) / 2 - c[2]];
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0) n = [-n[0], -n[1], -n[2]];
    return { pts: [p, q, apex], n, tone, crease: 0.3 };
  });
}

/** A sharpened stake from `a` to the point `b`, `r` thick. */
function stake(a: V3, b: V3, r: number, tone: Tone, seed: number): Face[] {
  const neck: V3 = [a[0] + (b[0] - a[0]) * 0.85, a[1] + (b[1] - a[1]) * 0.85, a[2] + (b[2] - a[2]) * 0.85];
  const shaft = strut(a, neck, r, r, tone, (g, k, s) => grain(g, k.fill, s.w, s.h, seed, 'x', 0.7));
  return [...shaft, ...tip(shaft.slice(0, 4).map((f) => f.pts[3]), b, paler(tone, 0.25))];
}

/** A bone from `a` to `b`: a shaft and a knuckle at each end. */
function bone(a: V3, b: V3, r: number): Face[] {
  return [
    ...strut(a, b, r, r, BONE),
    ...lathe(a[0], a[1], [[a[2] - r * 0.6, r * 0.2], [a[2] - r * 0.3, r * 0.95], [a[2] + r * 0.4, r * 0.95], [a[2] + r * 0.7, r * 0.2]], 6, BONE),
    ...lathe(b[0], b[1], [[b[2] - r * 0.6, r * 0.2], [b[2] - r * 0.3, r * 0.95], [b[2] + r * 0.4, r * 0.95], [b[2] + r * 0.7, r * 0.2]], 6, BONE),
  ];
}

/* ---- the goblin warren ----------------------------------------------------------------- */

/**
 * A burrow mound: a hummock of turned earth turfed over its crown, the burrow's
 * mouth in its front framed in rough stones, a spoil heap beside it, and two
 * sharpened stakes crossed at its shoulder with a red rag tied where they cross.
 */
function warrenOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const N = 18;
  const rings = mound(N, 0, -1.2, 8.4, 7.4, [[1, 0], [0.97, 1.6], [0.86, 3.4], [0.66, 5.0], [0.4, 6.0], [0.14, 6.4]], 31, 0.07);
  const hill = add(prism(rings, EARTH, (k, i, s) => (k >= 2
    ? { tone: TURF, crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => blades(k * 50 + i)(g, kk, s) }
    : { crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => clods(k * 40 + i)(g, kk, s) }),
  (s) => ({ tone: TURF, crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => blades(77)(g, kk, s) })));
  // The mouth: a block of rough stones set into the mound's front, its face the hole.
  const MW = 4.6, MS = 1.6, MH = 3.4, Y0 = 4.4, Y1 = 6.9;
  add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], arch(MW + 1.4, MS + 0.3, MH + 0.7), Y0, Y1, deeper(EARTH, 0.08), 0.3, {
    front: (g, k) => {
      // Rough stones round the arch.
      const T = rand(5);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI - (i / 8) * Math.PI;
        const x = Math.cos(a) * (MW / 2 + 0.3), z = (i === 0 || i === 8 ? 0.5 : MS + Math.sin(a) * (MH - MS) + 0.05);
        g.beginPath();
        g.ellipse(x, z, 0.6 + T() * 0.15, 0.45 + T() * 0.12, a, 0, TAU);
        g.fillStyle = css(mix(hex('#cfc0bc'), T() < 0.5 ? hex('#fff4ea') : hex('#7a6a7a'), 0.25));
        g.fill();
        g.strokeStyle = css(mix(k.fill, hex('#4a3a4a'), 0.5), 0.7);
        g.lineWidth = 0.12;
        g.stroke();
      }
      opening(MW, MS, MH, css(mix(k.fill, hex('#5a4250'), 0.55)))(g);
    },
  }), { edges: true });
  // The spoil heap at its foot, to the right of the mouth.
  add(prism(mound(10, 5.2, 6.2, 2.4, 1.8, [[1, 0], [0.7, 0.9], [0.25, 1.4]], 41, 0.12), EARTH,
    (k, i, s) => ({ crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => clods(90 + k * 10 + i, 1)(g, kk, s) }),
    (s) => ({ crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => { g.save(); g.translate(-s.w / 2, -s.h / 2); clods(99, 1)(g, kk, s); g.restore(); } })));
  // Two stakes crossed on its left shoulder, and the rag tied where they cross.
  const s1 = add(stake([-6.4, 1.6, 0], [-4.2, 3.6, 9.4], 0.55, LOG, 61));
  const s2 = add(stake([-3.4, 2.8, 0.2], [-6.2, 3.0, 9.0], 0.55, LOG, 62));
  void hill;
  const knot: V3 = [-5.05, 3.0, 6.8];
  parts.push({
    reach: [[knot[0] - 1, knot[1] - 0.5, knot[2] - 2.4], [knot[0] + 1.6, knot[1] + 0.5, knot[2] + 0.6]],
    pad: 3,
    // Counted in its box and its height, as a solid is (`kitHeight`), though nothing clicks a rag.
    solid: true,
    after: [s1, s2],
    draw: (g, e) => {
      const [x, y] = proj(e, knot);
      const u = Math.hypot(e.ux, e.vx);
      g.beginPath();
      g.moveTo(x - 0.4 * u, y);
      g.quadraticCurveTo(x + 1.4 * u, y + 0.6 * HEIGHT_SCALE, x + 1.1 * u, y + 2.2 * HEIGHT_SCALE);
      g.lineTo(x + 0.4 * u, y + 1.8 * HEIGHT_SCALE);
      g.quadraticCurveTo(x + 0.5 * u, y + 0.8 * HEIGHT_SCALE, x - 0.4 * u, y + 0.5 * HEIGHT_SCALE);
      g.closePath();
      g.fillStyle = RED;
      g.fill();
      g.strokeStyle = css(mix(hex(RED), hex('#3a1a2a'), 0.5));
      g.lineWidth = 0.6;
      g.stroke();
    },
  });
  return { parts, shade: [[-7.2, -7.6, 0], [7.2, -7.6, 0], [7.2, 5.6, 0], [-7.2, 5.6, 0]] };
}

/* ---- the orc camp ---------------------------------------------------------------------- */

/** The palisade's ring, its posts, and the gap in its front. */
const PAL_R = 8.4, POSTS = 16, GATE = 3;
/** Where the fire stands on its logs. */
const FIRE_AT: V3 = [0, 0.6, 0.6];

/**
 * A palisade round a fire: a ring of sharpened logs on trodden earth with a gap
 * at its front, a pit of stones in its middle with logs laid in it, burning
 * while the camp is held, and a war banner on a pole at its back.
 */
function campOf(look: KitLook): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // Trodden earth.
  add(prism([lumpy(16, 0, 0, 9.4, 9.4, 0, 3, 0.04), lumpy(16, 0, 0, 9.2, 9.2, 0.18, 3, 0.04)], deeper(EARTH, 0.05), undefined,
    (s) => ({ crease: 0.1, paint: (g: Ctx, kk: PaintCtx) => { g.save(); g.translate(-s.w / 2, -s.h / 2); clods(7, 0.25)(g, kk, s); g.restore(); } })), { first: true });
  // The posts, the gap at the front (toward +y) left open.
  const J = rand(23);
  for (let i = 0; i < POSTS; i++) {
    const a = (i / POSTS) * TAU + TAU / POSTS / 2;
    const toFront = Math.abs(((a - Math.PI / 2 + Math.PI) % TAU) - Math.PI);
    if (toFront < (GATE / POSTS) * TAU * 0.6) continue;
    const x = Math.cos(a) * PAL_R, y = Math.sin(a) * PAL_R, h = 3.6 + J() * 1.4, r = 0.58 + J() * 0.1;
    add(lathe(x, y, [[0, r], [h, r * 0.95], [h + 1.3, 0.06]], 7, LOG, J(), (k, ii, s) => (k === 0
      ? { paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, s.w, s.h, i * 7 + ii, 'y', 0.6) }
      : { tone: paler(LOG, 0.22), crease: 0.25 })), { edges: true });
  }
  // The pit: a ring of stones, the logs laid in it, and the fire.
  const stones: KitPart[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    stones.push(add(lathe(Math.cos(a) * 2.1, 0.6 + Math.sin(a) * 2.1, [[0, 0.65], [0.5, 0.7], [0.85, 0.4], [0.95, 0.05]], 6, CRAG, i * 0.3,
      (_k, ii, s) => ({ paint: (g: Ctx, kk: PaintCtx) => rockSkin(i * 9 + ii)(g, kk, s) })), { edges: true }));
  }
  const logs = add([
    ...strut([-1.3, -0.4, 0.3], [1.3, 1.6, 0.6], 0.55, 0.55, deeper(LOG, 0.25)),
    ...strut([1.2, -0.5, 0.3], [-1.2, 1.7, 0.6], 0.55, 0.55, deeper(LOG, 0.2)),
  ], { after: stones });
  // The fire's room is kept lit or not, so the camp is as tall and as wide as it is drawn burning.
  {
    const FW = 4.4, FH = 6.4, at: V3 = [FIRE_AT[0], FIRE_AT[1], FIRE_AT[2]];
    parts.push({
      // Up to the top of its glow, which stands over the flame.
      reach: [[-FW / 2, -FW / 2 + 0.6, 0.6], [FW / 2, FW / 2 + 0.6, 0.6], [-FW / 2, 0.6, FH + 4], [FW / 2, 0.6, FH + 4]],
      pad: 6,
      // In its box and its height: the fire is as tall as the camp is drawn.
      solid: true,
      after: [logs, ...stones],
      draw: (g, e) => {
        if (!look.lit) return;
        const [x, y] = proj(e, at);
        const W = FW * Math.hypot(e.ux, e.vx) * 0.5, H = FH * HEIGHT_SCALE;
        glow(g, x, y - H * 0.3, W * 2.6, 0.38);
        flame(g, x, y + 0.5, W, H, 3, look.frame ?? 0);
      },
    });
  }
  // The banner at its back left: a pole, a cross-bar, and the red cloth hung off it with a pale mark cut in it.
  const px = -5.2, py = -5.4, top = 9.5;
  const pole = add(strut([px, py, 0], [px, py, top], 0.45, 0.45, LOG, (g, k, s) => grain(g, k.fill, s.w, s.h, 3, 'x', 0.6)), { edges: true });
  add(strut([px - 1.6, py, top - 0.7], [px + 1.6, py, top - 0.7], 0.32, 0.32, deeper(LOG, 0.1)), { after: [pole] });
  add(extrude([px, py, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [[-1.5, top - 0.9], [1.5, top - 0.9], [1.5, top - 4.6], [0, top - 3.8], [-1.5, top - 4.6]], 0.2, 0.42, toneOf(RED, '#8a2a3a'), 0.06, {
    front: (g) => {
      g.beginPath();
      g.moveTo(-0.7, top - 1.6);
      g.lineTo(0, top - 3.0);
      g.lineTo(0.7, top - 1.6);
      g.strokeStyle = css(hex('#fff0dc'), 0.85);
      g.lineWidth = 0.32;
      g.stroke();
    },
  }), { after: [pole] });
  return { parts, shade: [[-6.8, -6.8, 0], [6.8, -6.8, 0], [6.8, 6.8, 0], [-6.8, 6.8, 0]] };
}

/* ---- the ogre cave --------------------------------------------------------------------- */

/**
 * A mass of rock: a few-sided block, its corners pushed about and its crown
 * tilted, drawn in as it rises -- angular, not turned. Its top turfed with moss
 * where `moss` says.
 */
function rockMass(cx: number, cy: number, rx: number, ry: number, h: number, sides: number, seed: number, moss: boolean): Face[] {
  const J = rand(seed);
  const jit = Array.from({ length: sides }, () => 1 + (J() - 0.5) * 0.45);
  const lean = Array.from({ length: sides }, () => (J() - 0.5) * 0.3 * h);
  const turn = J();
  const at = (k: number, z: number, tilt: number): V3[] => jit.map((j, i) => {
    const a = ((i + turn) / sides) * TAU;
    return [cx + Math.cos(a) * rx * k * j, cy + Math.sin(a) * ry * k * j, Math.max(0, z + lean[i] * tilt)] as V3;
  });
  return prism([at(1, 0, 0), at(0.96, h * 0.5, 0.5), at(0.62, h, 1)], CRAG,
    (k, i, s) => ({ crease: 0.4, paint: (g: Ctx, kk: PaintCtx) => rockSkin(seed * 10 + k * 7 + i)(g, kk, s) }),
    (s) => (moss ? { tone: TURF, crease: 0.25, paint: (g: Ctx, kk: PaintCtx) => blades(seed)(g, kk, s) } : { crease: 0.4, paint: (g: Ctx, kk: PaintCtx) => rockSkin(seed + 3)(g, kk, s) }));
}

/**
 * A cave mouth in a rocky crag: angular masses of rock heaped at its back and
 * shoulders, moss on their crowns, the dark of the cave cut in between the two
 * at its front under the one that overhangs it, a red hand smeared over it, and
 * before it a skull, a thighbone, a rib and a few rocks.
 */
function caveOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  // The crag: two great masses at the back, a crown over them, and a shoulder each side of the mouth.
  add(rockMass(-3.6, -3.0, 4.9, 4.6, 9.0, 6, 11, true), { edges: true });
  add(rockMass(3.8, -2.4, 4.6, 4.8, 7.4, 5, 12, false), { edges: true });
  add(rockMass(0.2, -1.6, 4.2, 3.6, 11.0, 5, 13, true), { edges: true });
  add(rockMass(-4.8, 3.2, 3.0, 3.0, 5.6, 5, 14, true), { edges: true });
  add(rockMass(4.6, 3.6, 3.1, 2.8, 4.4, 6, 15, false), { edges: true });
  // The mouth: an angular dark cut between the shoulders, set back in the crag, the hand over it.
  const mouthAt: Pt[] = [[-2.7, 0], [2.6, 0], [2.5, 2.9], [1.6, 4.9], [0.2, 5.8], [-1.4, 5.2], [-2.5, 3.3]];
  add(extrude([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], mouthAt, 1.2, 2.6, deeper(CRAG, 0.12), 0.25, {
    front: (g) => {
      g.beginPath();
      mouthAt.forEach(([x, z], i) => { const px = x * 0.84, pz = z * 0.86 + 0.05; if (i) g.lineTo(px, pz); else g.moveTo(px, pz); });
      g.closePath();
      g.fillStyle = DARK;
      g.fill();
      // The floor going in, and a glint of something pale inside.
      g.beginPath();
      g.ellipse(0, 0.2, 1.7, 0.3, 0, 0, TAU);
      g.fillStyle = css(hex('#6e5a68'), 0.85);
      g.fill();
      g.beginPath();
      g.ellipse(-0.6, 1.0, 0.22, 0.14, 0.3, 0, TAU);
      g.fillStyle = css(hex('#c8bcc4'), 0.6);
      g.fill();
      // The hand, over its crown.
      g.save();
      g.translate(0.4, 6.7);
      g.fillStyle = css(hex(RED), 0.9);
      g.beginPath();
      g.ellipse(0, 0, 0.5, 0.42, 0, 0, TAU);
      g.fill();
      for (const [dx, dy, a] of [[-0.5, 0.42, -0.5], [-0.18, 0.58, -0.15], [0.16, 0.6, 0.1], [0.48, 0.46, 0.4], [0.64, -0.05, 1.2]] as Array<[number, number, number]>) {
        g.beginPath();
        g.ellipse(dx, dy, 0.12, 0.3, a, 0, TAU);
        g.fill();
      }
      g.restore();
    },
  }), { edges: true });
  // Before it: a skull, a thighbone, a rib, and a few rocks.
  add(lathe(-2.6, 7.4, [[0, 0.45], [0.35, 0.85], [0.95, 0.9], [1.4, 0.62], [1.6, 0.18]], 7, BONE, 0.5, (k, i, s) => (k === 1 && (i === 2 || i === 3)
    ? { paint: (g: Ctx) => { g.beginPath(); g.ellipse(s.w * 0.5, s.h * 0.45, 0.2, 0.18, 0, 0, TAU); g.fillStyle = DARK; g.fill(); } }
    : undefined)), { edges: true });
  add(bone([0.6, 6.6, 0.35], [3.0, 7.6, 0.35], 0.38));
  add(strut([1.4, 8.6, 0.25], [2.6, 8.2, 1.1], 0.3, 0.3, BONE));
  for (const [x, y, r, seed] of [[-5.6, 7.2, 1.0, 21], [6.4, 7.4, 0.8, 22], [-0.6, 9.2, 0.6, 23]] as Array<[number, number, number, number]>) {
    add(rockMass(x, y, r * 1.2, r, r * 1.3, 5, seed, false), { edges: true });
  }
  return { parts, shade: [[-7.8, -7.4, 0], [7.8, -7.4, 0], [7.8, 6.2, 0], [-7.8, 6.2, 0]] };
}

/* ---- the dragon roost ------------------------------------------------------------------ */

/**
 * A nest of bones: a wide low ring of twigs and straw, its hollow dark and
 * glinting with the hoard's gold, and great ribs rising from its rim and
 * curving in over it, the tallest at its back.
 */
function roostOf(): KitModel {
  const parts: KitPart[] = [];
  const add = (faces: Face[], more: Partial<KitPart> = {}): KitPart => {
    const p: KitPart = { faces, ...more };
    parts.push(p);
    return p;
  };
  const N = 20;
  const nest = add(prism(mound(N, 0, 0, 9.0, 8.6, [[1, 0], [1.02, 1.2], [0.95, 2.1], [0.78, 2.5]], 9, 0.05), STRAW,
    (k, i, s) => ({ crease: 0.14, paint: (g: Ctx, kk: PaintCtx) => grain(g, kk.fill, s.w, s.h, k * 20 + i, 'x', 1.1) }),
    (s) => ({
      tone: deeper(STRAW, 0.15), crease: 0.2,
      paint: (g: Ctx, kk: PaintCtx) => {
        // The hollow, dark, and the gold in it.
        g.beginPath();
        g.ellipse(0, 0, s.w * 0.36, s.h * 0.36, 0, 0, TAU);
        g.fillStyle = css(mix(kk.fill, hex('#4a3448'), 0.6));
        g.fill();
        const T = rand(11);
        for (let i = 0; i < 22; i++) {
          const a = T() * TAU, r = Math.sqrt(T()) * s.w * 0.3;
          g.beginPath();
          g.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.95, 0.42, 0.32, T(), 0, TAU);
          g.fillStyle = i % 4 ? GOLD : '#fff3c4';
          g.fill();
        }
        // Twigs over the rim.
        g.lineCap = 'round';
        for (let i = 0; i < 30; i++) {
          const a = T() * TAU, r = s.w * (0.38 + T() * 0.1);
          g.beginPath();
          g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          g.lineTo(Math.cos(a + 0.25) * (r + 0.6), Math.sin(a + 0.25) * (r + 0.6));
          g.strokeStyle = css(mix(kk.fill, T() < 0.5 ? hex('#5a4038') : hex('#fff0cc'), 0.35), 0.7);
          g.lineWidth = 0.2;
          g.stroke();
        }
      },
    })));
  // The ribs: up from the back half of the rim, bowed out and then hooked in over the hollow, tapering to a point.
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const a = Math.PI + 0.35 + (i / (ribs - 1)) * (Math.PI - 0.7);
    const back = Math.max(0, -Math.sin(a));
    const h = 6 + back * 4, r0 = 7.8;
    const at = (k: number, z: number): V3 => [Math.cos(a) * r0 * k, Math.sin(a) * r0 * k, z];
    const pts = [at(1, 1.8), at(1.1, 1.8 + h * 0.42), at(0.98, 1.8 + h * 0.8), at(0.7, 1.8 + h), at(0.46, 1.8 + h * 0.86)];
    const faces: Face[] = [];
    for (let j = 0; j + 1 < pts.length - 1; j++) {
      const w = 0.78 * (1 - j * 0.22);
      faces.push(...strut(pts[j], pts[j + 1], w, w, BONE));
    }
    faces.push(...tip(strut(pts[3], pts[4], 0.3, 0.3, BONE).slice(0, 4).map((f) => f.pts[0]), pts[4], paler(BONE, 0.1)));
    add(faces, { after: [nest], edges: true });
  }
  // A long bone and a horn on the near rim.
  add(bone([-3.4, 7.6, 1.9], [0.8, 8.4, 2.2], 0.5), { after: [nest] });
  add(lathe(4.2, 7.4, [[1.7, 0.75], [2.6, 0.55], [3.6, 0.3], [4.3, 0.05]], 7, paler(BONE, 0.1)), { after: [nest], edges: true });
  return { parts, shade: [[-6.8, -6.8, 0], [6.8, -6.8, 0], [6.8, 6.8, 0], [-6.8, 6.8, 0]] };
}

export const GOBLIN_WARREN: KitPiece = { model: () => warrenOf(), uses: {} };
export const ORC_CAMP: KitPiece = {
  model: (look) => campOf(look),
  uses: { lit: true },
  flicker: 4,
  // Its fire takes the night off itself while it burns: the camp is held; out once it is cleared.
  holes: (sx, sy, zoom, view) => {
    const at = (z: number): [number, number] => [sx + (FIRE_AT[0] * view.ux + FIRE_AT[1] * view.vx) * zoom,
      sy + (FIRE_AT[0] * view.uy + FIRE_AT[1] * view.vy - z * HEIGHT_SCALE) * zoom];
    const [x0, y0] = at(FIRE_AT[2] + 1.2), [x1, y1] = at(FIRE_AT[2] + 3.6);
    return [{ x: x0, y: y0, r: 5 * zoom, a: 0.95 }, { x: x1, y: y1, r: 4 * zoom, a: 0.85 }, { x: x0, y: y0, r: 14 * zoom, a: 0.3 }];
  },
  holesLit: true,
};
export const OGRE_CAVE: KitPiece = { model: () => caveOf(), uses: {} };
export const DRAGON_ROOST: KitPiece = { model: () => roostOf(), uses: {} };
