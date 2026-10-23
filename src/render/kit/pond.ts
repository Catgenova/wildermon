import { rand } from '../ivy';
import { cut } from '../runestone';
import {
  css, hex, KIT_INK, lathe, mix, paler, prism, proj, TAU, toneOf,
  type Ctx, type Eye, type Face, type KitModel, type KitPart, type KitPiece, type PaintCtx, type Pt, type RGB, type Tone, type V3,
} from './core';
import { ashlar, STONE, stoneSkin } from './outdoor';

/**
 * A fish pond (`fish_pond`, two subtiles by two), in the kit: a round of
 * dressed stone set in the ground, a course of walling under a coping, the
 * water standing a hand under the coping's top -- its far wall seen down
 * into it, the deep middle a step darker, two koi turning in it, three pads
 * floating on it, one in flower, and the sky on it -- and a clump of reeds at
 * the back of the rim with bulrushes on the tallest.
 */

/** The wall's radius, the coping's, its height, the water's radius, and how far under the coping it stands. */
const R = 8.8, RC = 9.2, ZK = 1.5, POOL = 7, SINK = 0.45;
/** The water: lit, and its deep middle. */
const WATER = hex('#94c6cc'), DEEP = hex('#6a9db2');
/** The pads: lit, the shade under them, and their rim. */
const PAD: [string, string, string] = ['#a8cc84', '#7aa462', '#557c4c'];
/** The reeds (green lit, in shade, and their rim) and the bulrushes' heads. */
const REED: Tone = toneOf('#a8cb80', '#5c8258');
const REED_INK: RGB = hex('#55764a');
const RUSH: Tone = toneOf('#b88466', '#6e4a4a');

/** A ring of points round the middle at height `z`, on the screen. */
const ringAt = (e: Eye, r: number, z: number, n = 40, cx = 0, cy = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => proj(e, [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r, z]));
const poly = (g: Ctx, pts: readonly Pt[]): void => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

/** The top: the coping's stones round it, and the water in it, on the screen. */
function pondTop(g: Ctx, k: PaintCtx): void {
  const e = k.e;
  g.save();
  g.setTransform(k.base);
  stoneTop(g, k);
  const zw = ZK - SINK;
  // The inside of the coping, seen on the far side down to the water.
  poly(g, ringAt(e, POOL, ZK));
  g.fillStyle = css(mix(k.fill, hex('#8a7684'), 0.45));
  g.fill();
  g.save();
  poly(g, ringAt(e, POOL, ZK));
  g.clip();
  // The water, a hand down: lit, its middle deeper, the fish in it, the sky on it.
  poly(g, ringAt(e, POOL, zw));
  g.fillStyle = css(WATER);
  g.fill();
  g.save();
  poly(g, ringAt(e, POOL, zw));
  g.clip();
  const [mx, my] = proj(e, [0.6, 0.4, zw]);
  const across = Math.hypot(e.ux, e.uy);
  g.beginPath();
  g.ellipse(mx, my, POOL * 0.62 * across, POOL * 0.3 * across, 0, 0, TAU);
  g.fillStyle = css(DEEP, 0.5);
  g.fill();
  // The shade of the wall over the water along its far edge.
  poly(g, ringAt(e, POOL, ZK - 0.05));
  g.strokeStyle = css(DEEP, 0.55);
  g.lineWidth = 1.2;
  g.stroke();
  for (const [fx, fy, turn, salt] of [[-2.4, 1.2, 0.5, 1], [2.2, -1.6, 2.6, 2]]) {
    const [px, py] = proj(e, [fx, fy, zw - 0.2]);
    g.save();
    g.translate(px, py);
    g.rotate(turn);
    g.fillStyle = 'rgba(232, 146, 98, 0.9)';
    g.beginPath();
    g.ellipse(0, 0, 1.55, 0.58, 0, 0, TAU);
    g.moveTo(-1.25, 0);
    g.lineTo(-2.25, -0.65);
    g.lineTo(-2.0, 0);
    g.lineTo(-2.25, 0.65);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255, 246, 236, 0.85)';
    g.beginPath();
    g.ellipse(salt === 1 ? 0.5 : -0.2, -0.1, 0.45, 0.3, 0.3, 0, TAU);
    g.fill();
    g.restore();
  }
  // The sky on the water, and rings where something rose.
  g.strokeStyle = 'rgba(244, 250, 252, 0.7)';
  g.lineWidth = 0.55;
  const [rx, ry] = proj(e, [-1.2, -2.6, zw]);
  g.beginPath(); g.ellipse(rx, ry, 1.6, 0.7, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(rx, ry, 2.6, 1.15, 0, 0.3, 2.4); g.stroke();
  g.fillStyle = 'rgba(250, 252, 255, 0.45)';
  for (const [x, y, w] of [[3.4, -3.2, 2.2], [-4.4, 1.8, 1.4], [1.0, 4.2, 1.8]]) {
    const [px, py] = proj(e, [x, y, zw]);
    g.fillRect(px - w / 2, py, w, 0.35);
  }
  g.restore();
  // The pads, each with its notch, floating; a flower on the biggest.
  for (const [i, [cx, cy, r]] of [[3.2, 2.8, 1.3], [4.5, 0.6, 0.9], [-3.9, -2.6, 1.05]].entries()) {
    const pts: Pt[] = [];
    for (let j = 0; j <= 13; j++) {
      const a = (j / 13) * TAU * 0.88 + 0.35 + i;
      pts.push(proj(e, [cx + Math.cos(a) * r, cy + Math.sin(a) * r, zw]));
    }
    pts.push(proj(e, [cx, cy, zw]));
    poly(g, pts.map(([x, y]) => [x + 0.25, y + 0.3] as Pt));
    g.fillStyle = css(DEEP, 0.55);
    g.fill();
    poly(g, pts);
    g.fillStyle = PAD[0];
    g.fill();
    g.strokeStyle = PAD[2];
    g.lineWidth = 0.45;
    g.stroke();
    const [vx, vy] = proj(e, [cx, cy, zw]);
    g.strokeStyle = css(hex(PAD[1]), 0.8);
    g.lineWidth = 0.25;
    g.beginPath();
    for (const a of [0.9, 2.2, 3.6, 5.0]) { const [x, y] = proj(e, [cx + Math.cos(a + i) * r * 0.75, cy + Math.sin(a + i) * r * 0.75, zw]); g.moveTo(vx, vy); g.lineTo(x, y); }
    g.stroke();
    if (i === 0) {
      // A water lily on it, pale with a pink heart.
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * TAU;
        g.beginPath();
        g.ellipse(vx + Math.cos(a) * 0.55, vy - 0.3 + Math.sin(a) * 0.3, 0.42, 0.26, a, 0, TAU);
        g.fillStyle = p % 2 ? '#fbeef0' : '#f4cfd8';
        g.fill();
      }
      g.beginPath();
      g.arc(vx, vy - 0.35, 0.28, 0, TAU);
      g.fillStyle = '#f2d06a';
      g.fill();
    }
  }
  g.restore();
  // The water's edge against the stone, ruled.
  poly(g, ringAt(e, POOL, ZK));
  g.strokeStyle = css(mix(k.fill, KIT_INK, 0.6), 0.9);
  g.lineWidth = 0.55;
  g.stroke();
  g.restore();
}

/** The coping's top, round the water: the stones' joints cut across it, a skin over each. */
function stoneTop(g: Ctx, k: PaintCtx): void {
  const e = k.e;
  const T = rand(77);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1 + (T() - 0.5) * 0.08;
    const [px, py] = proj(e, [Math.cos(a) * POOL, Math.sin(a) * POOL, ZK]);
    const [qx, qy] = proj(e, [Math.cos(a) * RC, Math.sin(a) * RC, ZK]);
    cut(g, k.fill, 0.32, () => { g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); });
    // A fleck or two of the stone's skin on each.
    const b = a + (TAU / 32), r = POOL + (RC - POOL) * (0.3 + 0.4 * T());
    const [sx, sy] = proj(e, [Math.cos(b) * r, Math.sin(b) * r, ZK]);
    g.beginPath();
    g.ellipse(sx, sy, 0.9 + T(), 0.4, 0, 0, TAU);
    g.fillStyle = T() < 0.5 ? css(mix(k.fill, [255, 252, 244], 0.4), 0.45) : css(mix(k.fill, hex('#9c94a4'), 0.3), 0.3);
    g.fill();
  }
}

/** The reeds at the back of the rim: [x, y, height] at their tips. */
const REEDS: V3[] = [[-6.2, -5.4, 8.6], [-5.2, -6.4, 6.8], [-7.2, -4.2, 7.4], [-4.2, -7, 5.4], [-7.6, -2.8, 5]];

/** Short blades round the reeds' feet, on the screen: loose leaves arching out over the rim. */
function blades(g: Ctx, e: Eye): void {
  const across = Math.hypot(e.ux, e.uy);
  for (const [i, [x, y]] of REEDS.entries()) {
    const T = rand(i * 13 + 5);
    const [ax, ay] = proj(e, [x + 0.2, y + 0.1, ZK]), [bx, by] = proj(e, [x - 1.2 - T(), y + 0.8, ZK + 1.6 + T()]);
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * 0.3 * across, ny = (dx / l) * 0.3 * across;
    const mx = (ax + bx) / 2 + nx, my = (ay + by) / 2 + ny;
    g.beginPath();
    g.moveTo(ax - nx, ay - ny);
    g.quadraticCurveTo(mx - nx * 0.5, my - ny * 0.5, bx, by);
    g.quadraticCurveTo(mx + nx * 0.5, my + ny * 0.5, ax + nx, ay + ny);
    g.closePath();
    g.lineJoin = 'round';
    g.strokeStyle = css(REED_INK);
    g.lineWidth = 0.9;
    g.stroke();
    g.fillStyle = css(REED.shade);
    g.fill();
  }
}

/** A reed: a blade tapering from its foot to its tip, square in section. */
function spike(foot: V3, tip: V3, w: number, tone: Tone): Face[] {
  const sq = (p: V3, r: number): V3[] => [[p[0] - r, p[1] - r, p[2]], [p[0] + r, p[1] - r, p[2]], [p[0] + r, p[1] + r, p[2]], [p[0] - r, p[1] + r, p[2]]];
  return prism([sq(foot, w / 2), sq(tip, 0.06)], tone, () => ({ crease: 0.2 }));
}

function pondOf(): KitModel {
  const wall = (k: number, i: number, s: { w: number; h: number }) => (g: Ctx, kk: PaintCtx): void => {
    if (k === 0) ashlar(g, kk.fill, s.w, s.h, s.h, 3.6, 30 + i, i * s.w);
    else if (k === 2) {
      stoneSkin(g, kk.fill, s.w, s.h, 50 + i, 1.4);
      if (i % 2 === 0) cut(g, kk.fill, 0.14, () => { g.beginPath(); g.moveTo(0.12, 0.05); g.lineTo(0.12, s.h - 0.05); });
    }
  };
  const SIDES = 32;
  const faces = lathe(0, 0, [[0, R], [0.85, R], [0.9, RC], [ZK - 0.12, RC], [ZK, RC - 0.12]], SIDES, STONE, 0.5, (k, i, s) => ({
    crease: k === 1 || k === 3 ? 0.35 : 0.2,
    paint: wall(k, i, s),
  }));
  // The top: the coping and the water in it.
  faces[faces.length - 1] = { ...faces[faces.length - 1], paint: pondTop, crease: 0.3 };
  const parts: KitPart[] = [{ faces, edges: true }];
  parts.push({ draw: blades, reach: REEDS.flatMap(([x, y]) => [[x - 2.4, y - 0.2, ZK], [x + 0.3, y + 1.0, ZK + 2.6]] as V3[]), solid: false });
  // The reeds, and a bulrush up each of the tallest.
  for (const [i, [x, y, h]] of REEDS.entries()) {
    const stem = { faces: spike([x - 0.1, y, ZK], [x + 0.3, y - 0.2, h], 0.62, i % 2 ? REED : paler(REED, 0.12)) };
    parts.push(stem);
    if (h > 6) {
      const cx = x + 0.26, cy = y - 0.17;
      parts.push({ faces: lathe(cx, cy, [[h - 2.15, 0.2], [h - 2.0, 0.42], [h - 1.0, 0.44], [h - 0.6, 0.36], [h - 0.48, 0.12]], 8, RUSH), after: [stem] });
    }
  }
  return {
    parts,
    shade: Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * TAU) * RC, Math.sin((i / 16) * TAU) * RC, 0] as V3),
  };
}

export const FISH_POND: KitPiece = {
  model: () => pondOf(),
  uses: {},
};
