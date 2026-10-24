import { css, dot, faceColour, hex, inlay, mix, proj, sub, TAU, type Ctx, type RGB, type Tone } from '../core';
import { cut, glyphPath, lightOf, RUNE_GOLD, RUNE_WHITE, type Eye } from '../../runestone';
import {
  BRIDGE_INK, U, bayAt, box, ownerOf, refugeGaps, samples,
  type Bay, type BridgePainter, type BridgeStyle, type FaceInfo, type Kit, type L, type Part3, type Plan, type Role,
} from './core';

/**
 * Marble: the classical bridge (the showpiece). White ashlar in great veined
 * slabs, round arches with voussoir rings and a carved rune keystone, a
 * dentilled cornice under the deck, a balustrade of turned balusters between
 * square posts with ball finials, heavy newel pedestals with urns at the ends;
 * on a ramp, stepped treads between raking balustrades.
 *
 * The machinery here (`classical`) is shared with sandstone, which takes the
 * same bridge in its own stone with a solid parapet and carved spandrels.
 */

/* ---- what a classical bridge is told ------------------------------------------------------- */

export interface Classical {
  /** The field, the dressings (ring, cornice, coping, plinth), the keystone, the deck. */
  stone: Tone;
  ring: Tone;
  trim: Tone;
  key: Tone;
  deck: Tone;
  rune: string;
  glow: string;
  ringDepth: number;
  parapetHeight: number;
  /** A balustrade, or a solid wall with dies; what stands on the posts and the newels. */
  parapet: 'balustrade' | 'solid';
  finial: 'ball' | 'urn';
  /** What the posts (or dies) are of: the field's stone, or the dressing's. */
  posts?: 'stone' | 'trim';
  newelFinial: 'ball' | 'urn';
  /** Carved roundels in the spandrels. */
  roundels?: boolean;
  paint: Partial<Record<Role, BridgePainter>>;
}

/* ---- faces told where they are --------------------------------------------------------------- */

/**
 * What a classical painter is told of a face beyond `FaceInfo`: its extent
 * in its own frame (the core gives some faces' in another), the slope of its
 * first edge (a ramp's bands run with it), that edge's first point, the frame
 * `x` of a point along the bridge, and for a ring its voussoir joints and for
 * a spandrel its roundels, in the frame.
 */
export interface Info extends FaceInfo {
  rise?: number;
  bx?: number;
  by?: number;
  /** The face's height over its first edge. */
  h?: number;
  /** The frame `x` of `s` tiles along the bridge: `xs0 + s * xds`. */
  xs0?: number;
  xds?: number;
  joints?: Array<[number, number, number, number, number]>;
  /** A ring's arch and all its joints, in the bridge's frame. */
  ring?: [(s: number) => number, Array<[number, number, number, number, number]>];
  roundels?: Array<[number, number, number]>;
  /** A tread: whether the ramp climbs with `s`. */
  up?: boolean;
  /** A horizontal face (a top) rather than an upright one. */
  flat?: boolean;
}

type Extra = (inf: Info, pts: L[], xy: (p: L) => [number, number]) => void;

/** The kit with every framed face's info made good in its own frame (`Info`), and `extra` told of it. */
export function framed(k: Kit, extra?: Extra): Kit {
  const o0 = k.m([0, 0, 0]);
  const face: Kit['face'] = (part, pts, out, tone, inf, frame) => {
    if (inf && frame && pts.length >= 3) {
      const mo = k.m(frame.o), ma = sub(k.m(frame.a), o0), mb = sub(k.m(frame.b), o0);
      const aa = dot(ma, ma), bb = dot(mb, mb);
      const xy = (p: L): [number, number] => { const d = sub(k.m(p), mo); return [dot(d, ma) / aa, dot(d, mb) / bb]; };
      const XY = pts.map(xy);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of XY) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const [p, q] = XY;
      const rise = Math.abs(q[0] - p[0]) > 1e-6 ? (q[1] - p[1]) / (q[0] - p[0]) : 0;
      const t = pts[0][1], z = pts[0][2];
      const xa = xy([0, t, z])[0], xb = xy([1, t, z])[0];
      const nf: Info = {
        ...inf, x0, x1, y0, y1, rise, bx: p[0], by: p[1], h: XY.length === 4 ? XY[3][1] - XY[0][1] : y1 - y0,
        xs0: xa, xds: xb - xa, flat: Math.abs(mb[2]) < 1e-9,
      };
      extra?.(nf, pts, xy);
      inf = nf;
    }
    k.face(part, pts, out, tone, inf, frame);
  };
  return { ...k, face };
}

/** Paint in a band's own frame: `x` as the face's, `y` up from its first edge, which a ramp's slope tilts. */
function inBand(g: Ctx, f: Info, draw: (h: number) => void): void {
  const r = f.rise ?? 0;
  g.save();
  g.transform(1, r, 0, 1, 0, (f.by ?? f.y0) - r * (f.bx ?? f.x0));
  draw(f.h ?? f.y1 - f.y0);
  g.restore();
}

/* ---- a little hashing, so that a stone across a slice's cut is the same stone either side ---------- */

export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x27d4eb2f, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const DUSK = hex('#5a4e5e');
const CREAM: RGB = [255, 251, 242];

/* ---- painters ------------------------------------------------------------------------------- */

export interface SlabOpts {
  /** Course heights, turn about; how long a block is, and by how much it varies. */
  courses: number[];
  len: number;
  vary?: number;
  /** How dark the joint is, and how far a block's tone wanders. */
  joint?: number;
  tint?: number;
  /** Veins: the grey a vein is laid in, how many blocks in a hundred carry one. */
  vein?: RGB;
  veined?: number;
  /** Beds: the faint laminae across a block, and the odd block banded with iron. */
  beds?: RGB;
  iron?: RGB;
  salt?: number;
}

/** Ashlar of blocks laid in courses, each block its own hair of tone, veined or bedded. */
export function slabPaint(o: SlabOpts): BridgePainter {
  const period = o.courses.reduce((a, b) => a + b, 0);
  return (g, k, f) => {
    const dark = css(mix(k.fill, DUSK, o.joint ?? 0.36), 0.85);
    const lite = css(mix(k.fill, CREAM, 0.7), 0.7);
    const x0 = f.x0, x1 = f.x1;
    const salt = o.salt ?? 0;
    const tint = o.tint ?? 0.07;
    const lift = css(mix(k.fill, CREAM, 0.6), 1);
    const sink = css(mix(k.fill, DUSK, 0.5), 1);
    let y = Math.floor(f.y0 / period) * period, row = Math.floor(f.y0 / period) * o.courses.length;
    g.lineCap = 'round';
    while (y < f.y1) {
      const ch = o.courses[((row % o.courses.length) + o.courses.length) % o.courses.length];
      // The joints of this course: a block every `len`, each wandering by `vary`, a half block over the course below.
      const off = (row & 1) * o.len * 0.5;
      const c0 = Math.floor((x0 - off) / o.len) - 1, c1 = Math.ceil((x1 - off) / o.len) + 1;
      const jx = (c: number): number => c * o.len + off + (o.vary ? (hash(c, row, salt) - 0.5) * o.len * o.vary : 0);
      for (let c = c0; c < c1; c++) {
        const a = jx(c), b = jx(c + 1);
        if (b < x0 || a > x1) continue;
        const v = hash(c, row, salt + 7);
        const tn = (v - 0.5) * 2 * tint;
        g.fillStyle = tn > 0 ? lift : sink;
        g.globalAlpha = Math.min(1, Math.abs(tn) * 2.2);
        g.fillRect(a, y, b - a, ch);
        g.globalAlpha = 1;
        if (o.iron && v > 0.93) {
          g.fillStyle = css(mix(k.fill, o.iron, 0.3), 0.8);
          g.fillRect(a, y + ch * 0.35, b - a, ch * 0.3);
        }
        if (o.beds) {
          g.strokeStyle = css(mix(k.fill, o.beds, 0.22), 0.7);
          g.lineWidth = 0.14;
          const nb = 2 + Math.floor(hash(c, row, salt + 3) * 2);
          for (let q = 1; q <= nb; q++) {
            const yy = y + (ch * q) / (nb + 1) + (hash(c, row * 7 + q, salt) - 0.5) * 0.4;
            g.beginPath();
            g.moveTo(a + 0.4, yy);
            g.quadraticCurveTo((a + b) / 2, yy + (hash(q, c, row) - 0.5) * 0.8, b - 0.4, yy + (hash(c, q, row) - 0.5) * 0.4);
            g.stroke();
          }
        }
        if (o.vein && v < (o.veined ?? 0.45)) {
          // A vein: a thread that crinkles across the block, a lesser one off it.
          const T = (i: number): number => hash(c * 13 + i, row * 7 + i, salt + 11);
          let px = a + (b - a) * T(1), py = y + ch * T(2);
          let ang = (T(3) - 0.5) * 1.6 + (T(4) < 0.5 ? 0 : Math.PI);
          const step = (b - a) / 4.5;
          g.beginPath();
          g.moveTo(px, py);
          for (let i = 0; i < 6; i++) {
            ang += (T(10 + i) - 0.5) * 1.1;
            px += Math.cos(ang) * step;
            py += Math.sin(ang) * step * 0.45;
            g.lineTo(px, py);
          }
          g.strokeStyle = css(mix(k.fill, o.vein, 0.55), 0.75);
          g.lineWidth = 0.26;
          g.stroke();
          g.strokeStyle = css(mix(k.fill, o.vein, 0.25), 0.45);
          g.lineWidth = 0.7;
          g.stroke();
        }
        // The upright joint.
        g.strokeStyle = dark;
        g.lineWidth = 0.3;
        g.beginPath(); g.moveTo(a, y); g.lineTo(a, y + ch); g.stroke();
      }
      g.strokeStyle = dark;
      g.lineWidth = 0.22;
      g.beginPath(); g.moveTo(x0 - 1, y); g.lineTo(x1 + 1, y); g.stroke();
      g.strokeStyle = lite;
      g.lineWidth = 0.18;
      g.beginPath(); g.moveTo(x0 - 1, y - 0.3); g.lineTo(x1 + 1, y - 0.3); g.stroke();
      y += ch;
      row++;
    }
  };
}

/** A voussoir ring: its joints square to the arch (`Info.joints`), every other voussoir a step paler. */
export function ringPaint(alt: RGB, step = 0.12): BridgePainter {
  return (g, k, f) => {
    const j = (f as Info).joints;
    if (!j?.length) return;
    g.fillStyle = css(mix(k.fill, alt, step), 1);
    for (let i = 0; i + 1 < j.length; i++) {
      if (j[i][4] % 2) continue;
      g.beginPath();
      g.moveTo(j[i][0], j[i][1]); g.lineTo(j[i][2], j[i][3]); g.lineTo(j[i + 1][2], j[i + 1][3]); g.lineTo(j[i + 1][0], j[i + 1][1]);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = css(mix(k.fill, DUSK, 0.45), 0.9);
    g.lineWidth = 0.34;
    g.lineCap = 'round';
    for (const [xa, ya, xb, yb] of j) { g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke(); }
  };
}

/** The cornice band under the deck: a fillet over a row of dentils, the shadow of the corona between; or a carved running scroll. */
export function cornicePaint(kind: 'dentil' | 'scroll'): BridgePainter {
  return (g, k, f) => inBand(g, f as Info, (h) => {
    const x0 = f.x0 - 3, x1 = f.x1 + 3;
    const dark = css(mix(k.fill, DUSK, 0.45), 0.85);
    const lite = css(mix(k.fill, CREAM, 0.6), 0.8);
    // The corona's shadow, and the light along its arris.
    g.fillStyle = css(mix(k.fill, DUSK, 0.18), 0.9);
    g.fillRect(x0, h * 0.5, x1 - x0, h * 0.12);
    g.strokeStyle = lite; g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(x0, h * 0.84); g.lineTo(x1, h * 0.84); g.stroke();
    g.strokeStyle = dark; g.lineWidth = 0.18;
    g.beginPath(); g.moveTo(x0, h * 0.62); g.lineTo(x1, h * 0.62); g.stroke();
    if (kind === 'dentil') {
      const every = 2.4;
      for (let x = Math.floor(x0 / every) * every; x < x1; x += every) {
        g.fillStyle = css(mix(k.fill, CREAM, 0.35), 0.9);
        g.fillRect(x, h * 0.1, every * 0.55, h * 0.36);
        g.fillStyle = css(mix(k.fill, DUSK, 0.32), 0.9);
        g.fillRect(x + every * 0.55, h * 0.1, every * 0.12, h * 0.36);
      }
    } else {
      // A running scroll, cut: a wave that curls over at every crest.
      const every = 6, y = h * 0.28, a = h * 0.17;
      cut(g, k.fill, 0.34, () => {
        g.beginPath();
        for (let x = Math.floor(x0 / every) * every; x < x1; x += every) {
          g.moveTo(x, y - a);
          g.bezierCurveTo(x + every * 0.35, y - a, x + every * 0.3, y + a, x + every * 0.6, y + a);
          g.arc(x + every * 0.6, y + a * 0.35, a * 0.65, Math.PI / 2, -Math.PI / 2, true);
          g.moveTo(x + every * 0.6, y + a);
          g.bezierCurveTo(x + every * 0.85, y + a, x + every * 0.8, y - a, x + every, y - a);
        }
      });
    }
    g.strokeStyle = dark; g.lineWidth = 0.16;
    g.beginPath(); g.moveTo(x0, h * 0.06); g.lineTo(x1, h * 0.06); g.stroke();
  });
}

/** A coping, a plinth or any band with a ramp's slope: a groove along it, gold laid in it and runes along it on a long run. */
export function copingPaint(glyph: string, runes = true): BridgePainter {
  return (g, k, f) => {
    const inf = f as Info;
    if (inf.flat) {
      // A top: a groove along the coping only (not a post's cap).
      if (f.x1 - f.x0 < 12) return;
      const y = (f.y0 + f.y1) / 2;
      g.strokeStyle = css(mix(k.fill, DUSK, 0.18), 0.5);
      g.lineWidth = 0.18;
      g.beginPath(); g.moveTo(f.x0 - 1, y); g.lineTo(f.x1 + 1, y); g.stroke();
      return;
    }
    inBand(g, inf, (h) => {
      const y = h * 0.5, x0 = f.x0 - 2, x1 = f.x1 + 2;
      g.strokeStyle = css(mix(k.fill, DUSK, 0.35), 0.8);
      g.lineWidth = 0.34;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.3), 0.8);
      g.lineWidth = 0.15;
      g.stroke();
      if (!runes) return;
      const every = 10;
      for (let x = Math.ceil(x0 / every) * every; x < x1; x += every) {
        glyphPath(g, glyph, x, y, 0.5);
        g.strokeStyle = css(hex(RUNE_GOLD), 0.85);
        g.lineWidth = 0.13;
        g.stroke();
      }
    });
  };
}

/** A plain band (a plinth's face): a fillet of light along its top. */
export const plinthPaint: BridgePainter = (g, k, f) => {
  const inf = f as Info;
  if (inf.flat) return;
  inBand(g, inf, (h) => {
    g.strokeStyle = css(mix(k.fill, CREAM, 0.55), 0.7);
    g.lineWidth = 0.2;
    g.beginPath(); g.moveTo(f.x0 - 2, h - 0.35); g.lineTo(f.x1 + 2, h - 0.35); g.stroke();
    g.strokeStyle = css(mix(k.fill, DUSK, 0.3), 0.6);
    g.lineWidth = 0.15;
    g.beginPath(); g.moveTo(f.x0 - 2, h * 0.35); g.lineTo(f.x1 + 2, h * 0.35); g.stroke();
  });
};

/** A post's or a pedestal's die: a sunk panel, its shadow along the top and the near side. */
export const panelPaint: BridgePainter = (g, k, f) => {
  const inf = f as Info;
  if (inf.flat) return;
  const w = f.x1 - f.x0, h = f.y1 - f.y0;
  if (w < 3 || h < 4) return;
  const m = Math.min(w, h) * 0.18;
  const x0 = f.x0 + m, x1 = f.x1 - m, y0 = f.y0 + m * 1.2, y1 = f.y1 - m * 1.2;
  g.fillStyle = css(mix(k.fill, DUSK, 0.1), 0.8);
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.lineWidth = 0.22;
  g.strokeStyle = css(mix(k.fill, DUSK, 0.4), 0.85);
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y1); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = css(mix(k.fill, CREAM, 0.6), 0.8);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1, y0); g.lineTo(x0, y0); g.stroke();
};

/** A deck of flags: rows across, each flag its own hair of tone; on a ramp's tread a nosing at its front and the riser's shadow at its back. */
export function flagPaint(along: number, across: number, tint = 0.06): BridgePainter {
  return (g, k, f) => {
    const inf = f as Info;
    const dark = css(mix(k.fill, DUSK, 0.28), 0.6);
    const r0 = Math.floor(f.y0 / across), r1 = Math.ceil(f.y1 / across);
    g.lineWidth = 0.18;
    for (let r = r0; r < r1; r++) {
      const y = r * across;
      const off = (r & 1) * along * 0.5;
      for (let c = Math.floor((f.x0 - off) / along); c * along + off < f.x1; c++) {
        const x = c * along + off;
        const v = hash(c, r, 5) - 0.5;
        g.fillStyle = css(v > 0 ? mix(k.fill, CREAM, 0.5) : mix(k.fill, DUSK, 0.3), Math.abs(v) * tint * 6);
        g.fillRect(x, y, along, across);
        g.strokeStyle = dark;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + across); g.stroke();
      }
      g.strokeStyle = dark;
      g.beginPath(); g.moveTo(f.x0 - 1, y); g.lineTo(f.x1 + 1, y); g.stroke();
    }
    if (f.role === 'tread' && inf.up !== undefined) {
      const front = inf.up ? f.x0 : f.x1, back = inf.up ? f.x1 : f.x0, d = inf.up ? 1 : -1;
      g.fillStyle = css(mix(k.fill, CREAM, 0.7), 0.9);
      g.fillRect(Math.min(front, front + d * 1.2), f.y0 - 1, 1.2, f.y1 - f.y0 + 2);
      g.fillStyle = css(mix(k.fill, DUSK, 0.35), 0.55);
      g.fillRect(Math.min(back, back - d * 1.6), f.y0 - 1, 1.6, f.y1 - f.y0 + 2);
    }
  };
}

/** A keystone's rune: cut deep and inlaid in gold, as large as the stone allows. */
export function keystonePaint(glyph: string): BridgePainter {
  return (g, k, f) => {
    const w = f.x1 - f.x0, h = f.y1 - f.y0;
    const x = (f.x0 + f.x1) / 2, y = f.y0 + h * 0.46;
    // The stone's bevel: light down its left and over its top, shade down its right.
    g.lineWidth = 0.35;
    g.strokeStyle = css(mix(k.fill, CREAM, 0.6), 0.8);
    g.beginPath(); g.moveTo(f.x0 + 0.5, f.y0 + 0.4); g.lineTo(f.x0 + 0.5, f.y1 - 0.5); g.lineTo(f.x1 - 0.5, f.y1 - 0.5); g.stroke();
    g.strokeStyle = css(mix(k.fill, DUSK, 0.3), 0.7);
    g.beginPath(); g.moveTo(f.x1 - 0.5, f.y1 - 0.5); g.lineTo(f.x1 - 0.5, f.y0 + 0.4); g.stroke();
    inlay(g, k.fill, glyph, x, y, Math.min(w * 0.36, h * 0.3), 0.36);
  };
}

/** A carved roundel at each of a spandrel's `Info.roundels`: a moulded ring and a rosette, in the dressing's stone. */
export function roundelPaint(under: BridgePainter, dress: RGB): BridgePainter {
  return (g, k, f, st) => {
    under(g, k, f, st);
    const rs = (f as Info).roundels;
    if (!rs?.length) return;
    for (const [x, y, R] of rs) {
      if (x + R < f.x0 || x - R > f.x1) continue;
      const disc = mix(k.fill, dress, 0.55);
      g.beginPath();
      g.ellipse(x, y, R, R * 0.55, 0, 0, TAU);
      g.fillStyle = css(disc);
      g.fill();
      const ring = (r: number, w: number): void => cut(g, disc, w, () => { g.beginPath(); g.ellipse(x, y, r, r * 0.55, 0, 0, TAU); });
      ring(R * 0.96, 0.7);
      ring(R * 0.76, 0.5);
      // The rosette: eight petals about a boss.
      cut(g, disc, 0.45, () => {
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          const r0 = R * 0.16, r1 = R * 0.62, wv = R * 0.13;
          g.moveTo(x + ca * r0, y + sa * r0 * 0.55);
          g.quadraticCurveTo(x + ca * (r0 + r1) / 2 - sa * wv, y + (sa * (r0 + r1) / 2 + ca * wv) * 0.55, x + ca * r1, y + sa * r1 * 0.55);
          g.quadraticCurveTo(x + ca * (r0 + r1) / 2 + sa * wv, y + (sa * (r0 + r1) / 2 - ca * wv) * 0.55, x + ca * r0, y + sa * r0 * 0.55);
        }
      });
      g.beginPath();
      g.ellipse(x, y, R * 0.13, R * 0.13 * 0.55, 0, 0, TAU);
      g.fillStyle = css(mix(hex(RUNE_GOLD), disc, 0.35));
      g.fill();
    }
  };
}

/* ---- geometry the plan gives ------------------------------------------------------------------ */

/** The height a step's tread stands at over `s` on a ramp (three treads a tile, as the core lays them), or the deck's. */
function treadAt(plan: Plan, s: number): number {
  if (!plan.ramp) return plan.deck(s);
  const up = plan.deck(plan.n) >= plan.deck(0);
  const j = Math.min(plan.n * 3, Math.max(0, up ? Math.ceil(s * 3 - 1e-6) : Math.floor(s * 3 + 1e-6)));
  return plan.deck(j / 3);
}
/** The foot of an upright face along `t` from `sb` back to `sa`: the deck's line, or on a ramp down each tread in turn. */
function steps(plan: Plan, sb: number, sa: number, t: number): L[] {
  if (!plan.ramp) return [[sb, t, plan.deck(sb)], [sa, t, plan.deck(sa)]];
  const out: L[] = [[sb, t, treadAt(plan, sb - 1e-4)]];
  for (let q = Math.ceil(sb * 3 - 1e-6) - 1; q / 3 > sa + 1e-6; q--) {
    const b = q / 3;
    out.push([b, t, treadAt(plan, b + 1e-4)], [b, t, treadAt(plan, b - 1e-4)]);
  }
  out.push([sa, t, treadAt(plan, sa + 1e-4)]);
  return out;
}
/** How far one tread stands over the next on a ramp. */
const stepOf = (plan: Plan): number => (plan.ramp ? Math.abs(plan.deck(plan.n) - plan.deck(0)) / (plan.n * 3) : 0);

/** A ring's voussoir joints, square to the arch: [s, z] inside to [s, z] outside, by arch. */
const jointCache = new WeakMap<(s: number) => number, Array<[number, number, number, number, number]>>();
function voussoirs(bay: Bay, f: (s: number) => number, ringD: number, every: number): Array<[number, number, number, number, number]> {
  const got = jointCache.get(f);
  if (got) return got;
  const s0 = bay.c - bay.a, s1 = bay.c + bay.a;
  const N = 120;
  const P: Array<[number, number]> = [];
  const cum = [0];
  for (let i = 0; i <= N; i++) {
    // Closer together at the springs, where a round arch is steep.
    const u = (1 - Math.cos((i / N) * Math.PI)) / 2;
    const s = s0 + (s1 - s0) * u;
    P.push([s * U, f(s)]);
    if (i) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  }
  const len = cum[N];
  let nv = Math.max(7, Math.round(len / every));
  if (nv % 2 === 0) nv++;
  const out: Array<[number, number, number, number, number]> = [];
  for (let q = 1; q < nv; q++) {
    const want = (len * q) / nv;
    let i = 1;
    while (i < N && cum[i] < want) i++;
    const u = (want - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const X = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, Z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u;
    let dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    // The outward normal (the arch is walked with `s`, so it is up and away from the middle).
    const nx = -dz, nz = dx;
    // Out along it to the ring's back (the arch less its depth), no further than the pier's face.
    const gfn = (t: number): number => Z + nz * t - (f(Math.min(s1, Math.max(s0, (X + nx * t) / U))) + ringD);
    let lo = 0, hi = ringD * 3;
    const wall = nx < 0 ? (X - s0 * U) / -nx : nx > 0 ? (s1 * U - X) / nx : Infinity;
    hi = Math.min(hi, wall);
    if (gfn(hi) > 0) {
      for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (gfn(m) > 0) hi = m; else lo = m; }
    }
    const t = hi;
    out.push([X / U, Z, (X + nx * t) / U, Z + nz * t, q]);
  }
  jointCache.set(f, out);
  return out;
}

/** The roundels carved in a bridge's spandrels: [s, z, radius in units], by plan. */
const roundelCache = new WeakMap<Plan, Array<[number, number, number]>>();
function roundelsOf(plan: Plan, ringD: number): Array<[number, number, number]> {
  const got = roundelCache.get(plan);
  if (got) return got;
  const out: Array<[number, number, number]> = [];
  const RMAX = 7, RMIN = 3.2;
  // The top of whatever stands under the spandrel at `s`: a ring's back, or nothing over a pier.
  const under = (s: number): number => {
    if (s < 0 || s > plan.n) return Infinity;
    const bay = bayAt(plan, s);
    const pier = plan.piers.find((p) => Math.abs(p.s - s) <= p.half);
    if (pier) return pier.end ? -Infinity : -Infinity;
    return bay.arch(s) + ringD;
  };
  const deckUnder = (s: number): number => plan.deck(s) - plan.thick - 1.4;
  const fits = (s: number, R: number): number | null => {
    const zc = deckUnder(s) - R * 0.55 - 1.2;
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      const ss = s + (Math.cos(a) * R) / U, zz = zc + Math.sin(a) * R * 0.55;
      if (zz < under(ss) + 0.8) return null;
      if (ss < 0.02 || ss > plan.n - 0.02) return null;
    }
    for (const ds of [-R, R]) if (zc < under(s + ds / U) + 0.8) return null;
    return zc;
  };
  const best = (lo: number, hi: number, avoid: Array<[number, number]>): [number, number, number] | null => {
    let found: [number, number, number] | null = null;
    for (let s = lo; s <= hi + 1e-9; s += 0.02) {
      for (let R = RMAX; R >= RMIN; R -= 0.5) {
        if (avoid.some(([a, b]) => s + R / U > a && s - R / U < b)) continue;
        const zc = fits(s, R);
        if (zc === null) continue;
        if (!found || R > found[2] + 0.01) found = [s, zc, R];
        break;
      }
    }
    return found;
  };
  const cutters = plan.width >= 2 ? plan.piers.filter((p) => !p.end).map((p): [number, number] => [p.s - p.half, p.s + p.half]) : [];
  for (const p of plan.piers) {
    if (!p.end && plan.width < 2) {
      const r = best(p.s, p.s, []);
      if (r) out.push(r);
      continue;
    }
    // Either side of an abutment or a pier with a cutwater up its face: in the haunch.
    for (const side of [-1, 1]) {
      const from = p.s + side * p.half;
      if (from < 0 || from > plan.n) continue;
      const bay = bayAt(plan, from + side * 0.01);
      const lim = bay.c - side * bay.a * 0.25;
      const [lo, hi] = side > 0 ? [from, lim] : [lim, from];
      if (hi <= lo) continue;
      const r = best(lo, hi, cutters);
      if (r) out.push(r);
    }
  }
  roundelCache.set(plan, out);
  return out;
}

/* ---- the builders ---------------------------------------------------------------------------- */

/** A shape turned on a lathe, drawn as its outline: [height, radius] in units up from `at`, lit from the left as the kit's faces are. */
function lathe(g: Ctx, e: Eye, k: Kit, at: L, profile: ReadonlyArray<[number, number]>, tone: Tone, ink = 0.55): void {
  const [bx, by] = proj(e, k.m(at));
  const up = proj(e, k.m([at[0], at[1], at[2] + 1]))[1] - by;
  const hx = Math.hypot(e.ux, e.vx);
  let rmax = 0;
  for (const [, r] of profile) rmax = Math.max(rmax, r);
  g.beginPath();
  const pts = profile.map(([h, r]) => [r * hx, by + h * up] as [number, number]);
  g.moveTo(bx - pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
    g.quadraticCurveTo(bx - r0, y0, bx - (r0 + r1) / 2, (y0 + y1) / 2);
    if (i === pts.length - 1) g.lineTo(bx - r1, y1);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const [r1, y1] = pts[i];
    if (i === pts.length - 1) { g.lineTo(bx + r1, y1); continue; }
    const [r0, y0] = pts[i + 1];
    g.quadraticCurveTo(bx + r0, y0, bx + (r0 + r1) / 2, (y0 + y1) / 2);
    if (i === 0) g.lineTo(bx + r1, y1);
  }
  g.closePath();
  g.strokeStyle = css(BRIDGE_INK);
  g.lineWidth = ink * 2;
  g.lineJoin = 'round';
  g.stroke();
  const w = rmax * hx;
  const grad = g.createLinearGradient(bx - w, 0, bx + w, 0);
  grad.addColorStop(0, css(faceColour(tone, 0.97)));
  grad.addColorStop(0.35, css(faceColour(tone, 1)));
  grad.addColorStop(0.62, css(faceColour(tone, 0.84)));
  grad.addColorStop(1, css(faceColour(tone, 0.7)));
  g.fillStyle = grad;
  g.fill();
}

/** A baluster's profile, a unit tall and a unit at its widest: a square foot, a vase, a neck and a collar. */
const BALUSTER: ReadonlyArray<[number, number]> = [
  [0, 0.8], [0.09, 0.8], [0.12, 0.48], [0.18, 0.58], [0.38, 1], [0.56, 0.82], [0.7, 0.36], [0.77, 0.32], [0.83, 0.66], [0.89, 0.42], [1, 0.74],
];
/** A ball on a short neck, and an urn with its lid, in units. */
const BALL: ReadonlyArray<[number, number]> = [[0, 0.9], [0.45, 0.55], [0.75, 1.05], [1.3, 1.45], [1.9, 1.5], [2.5, 1.2], [2.9, 0.6], [3.05, 0]];
const URN: ReadonlyArray<[number, number]> = [
  [0, 1.9], [0.45, 1.9], [0.6, 0.8], [1.0, 0.7], [1.3, 1.9], [2.2, 2.9], [3.1, 2.6], [3.7, 1.5], [3.9, 1.3], [4.1, 2.0], [4.45, 2.0], [4.6, 1.2],
  [5.3, 1.15], [5.8, 0.45], [6.05, 0.75], [6.5, 0],
];

interface Run { sa: number; sb: number }

/** The posts and gaps of a bridge's parapet, along it: posts at every tile's middle and either side of a refuge; the newels at the ends. */
const layoutCache = new WeakMap<Plan, { posts: Array<[number, number]>; gaps: Array<[number, number]> }>();
const POST = 0.055;
const NEWEL = 0.095;
function layoutOf(plan: Plan): { posts: Array<[number, number]>; gaps: Array<[number, number]> } {
  const got = layoutCache.get(plan);
  if (got) return got;
  const stops: Array<[number, number]> = [[-1, 2 * NEWEL], [plan.n - 2 * NEWEL, plan.n + 1]];
  const posts: Array<[number, number]> = [];
  const refuges = refugeGaps(plan);
  for (const [g0, g1] of refuges) {
    stops.push([g0, g1]);
    posts.push([g0 - 2 * POST, g0], [g1, g1 + 2 * POST]);
  }
  for (let i = 0; i < plan.n; i++) {
    const s = i + 0.5;
    const near = [...stops, ...posts].some(([a, b]) => s + POST > a - 0.22 && s - POST < b + 0.22);
    if (!near) posts.push([s - POST, s + POST]);
  }
  const all = [...stops, ...posts].sort((a, b) => a[0] - b[0]);
  const gaps: Array<[number, number]> = [];
  for (let i = 0; i + 1 < all.length; i++) if (all[i + 1][0] - all[i][1] > 0.04) gaps.push([all[i][1], all[i + 1][0]]);
  const out = { posts, gaps };
  layoutCache.set(plan, out);
  return out;
}

/**
 * A run of the parapet along one outer edge at `tOut`: a plinth stepped to
 * the treads on a ramp and raking with it, posts, balusters (or a solid wall
 * between dies), and the coping over all with the rune line along it.
 */
function parapetLine(k: Kit, cfg: Classical, part: Part3, edge: number, tOut: number, runs: Run[], posts: Array<[number, number]>, gaps: Array<[number, number]>, order = 1): void {
  const { plan, sl, st } = k;
  const deck = plan.deck;
  const H = cfg.parapetHeight;
  const lift = stepOf(plan);
  const T = 0.1;
  const tIn = tOut - edge * T;
  const [t0, t1] = edge > 0 ? [tIn, tOut] : [tOut, tIn];
  const plinth = cfg.parapet === 'balustrade' ? 2.2 : 1.8;
  const coping = 1.7;
  const topP = (s: number): number => deck(s) + lift + plinth;
  const railLow = (s: number): number => deck(s) + lift + H - coping;
  // Each run is whole faces, one to a side (the deck is straight within a slice), so no joint is inked across it.
  const wallTop = cfg.parapet === 'solid' ? railLow : topP;
  const outLow = (s: number): number => deck(s) - 0.6;
  const role: Role = cfg.parapet === 'solid' ? 'parapet' : 'plinth';
  const tone = cfg.parapet === 'solid' ? st.stone : st.trim;
  const info = (r: Role): FaceInfo => ({ role: r, x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i });
  const lt = tOut + edge * 0.018;
  for (const { sa, sb } of runs) {
    if (sb - sa < 0.01) continue;
    // The plinth (on a solid parapet, the wall itself up to the coping): its outer face down to the cornice,
    // its inner face stepped down to each tread.
    k.solid(part, order);
    k.face(part, [[sa, tOut, outLow(sa)], [sb, tOut, outLow(sb)], [sb, tOut, wallTop(sb)], [sa, tOut, wallTop(sa)]], [0, edge, 0], tone, info(role), wallF(tOut, edge));
    k.face(part, [[sa, tIn, wallTop(sa)], [sb, tIn, wallTop(sb)], ...steps(plan, sb, sa, tIn)], [0, -edge, 0], tone, info(role), wallF(tIn, -edge));
    if (cfg.parapet === 'balustrade') k.face(part, [[sa, t0, topP(sa)], [sb, t0, topP(sb)], [sb, t1, topP(sb)], [sa, t1, topP(sa)]], [0, 0, 1], st.trim);
    for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
      if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
      k.face(part, [[s, t0, outLow(s)], [s, t1, outLow(s)], [s, t1, wallTop(s)], [s, t0, wallTop(s)]], [dirn, 0, 0], tone);
    }
    // A solid parapet's plinth course, proud of the wall.
    if (cfg.parapet === 'solid') {
      // Laid after the wall on the near side, before it on the far one, where the wall stands in front of it.
      k.solid(part, part === 'rail' ? order + 0.2 : order - 0.2);
      const tt = tOut + edge * 0.012;
      k.face(part, [[sa, tt, outLow(sa)], [sb, tt, outLow(sb)], [sb, tt, topP(sb)], [sa, tt, topP(sa)]], [0, edge, 0], st.trim, info('plinth'), wallF(tt, edge));
      k.face(part, [[sa, tOut, topP(sa)], [sb, tOut, topP(sb)], [sb, tt, topP(sb)], [sa, tt, topP(sa)]], [0, 0, 1], st.trim);
    }
    // The coping, the rune line along its outer face.
    const over = 0.014;
    const c0 = t0 - over, c1 = t1 + over;
    const cz = (s: number): number => railLow(s) + coping;
    k.solid(part, order + 1);
    k.face(part, [[sa, c0, cz(sa)], [sb, c0, cz(sb)], [sb, c1, cz(sb)], [sa, c1, cz(sa)]], [0, 0, 1], st.trim,
      info('cap'), { o: [0, 0, cz(0)], a: [1 / U, 0, (cz(1) - cz(0)) / U], b: [0, 1 / U, 0] });
    for (const [t, out] of [[c1, 1], [c0, -1]] as Array<[number, number]>) {
      k.face(part, [[sa, t, railLow(sa)], [sb, t, railLow(sb)], [sb, t, cz(sb)], [sa, t, cz(sa)]], [0, out, 0], st.trim, info('cap'), wallF(t, out));
    }
    if (cfg.parapet === 'balustrade') k.face(part, [[sa, c0, railLow(sa)], [sb, c0, railLow(sb)], [sb, c1, railLow(sb)], [sa, c1, railLow(sa)]], [0, 0, -1], st.trim);
    for (const [s, dirn] of [[sa, -1], [sb, 1]] as Array<[number, number]>) {
      if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
      k.face(part, [[s, c0, railLow(s)], [s, c1, railLow(s)], [s, c1, cz(s)], [s, c0, cz(s)]], [dirn, 0, 0], st.trim);
    }
    k.glow.lines.push([k.m([sa, lt, railLow(sa) + coping * 0.5]), k.m([sb, lt, railLow(sb) + coping * 0.5])]);
  }
  // Posts (dies on a solid parapet), each with a cap over the coping and its finial.
  const inRuns = (s: number): boolean => runs.some((r) => s >= r.sa - 1e-6 && s <= r.sb + 1e-6);
  for (const [p0, p1] of posts) {
    const sp = (p0 + p1) / 2;
    if (sp < sl.s0 - 1e-6 || sp >= sl.s1 - 1e-6 || !inRuns(sp)) continue;
    const solid = cfg.parapet === 'solid';
    const dt = solid ? 0.02 : 0.01;
    box(k, part, p0, p1, t0 - dt, t1 + dt, treadAt(plan, sp), railLow(sp) + (solid ? coping : 0), cfg.posts === 'trim' ? st.trim : st.stone, 'post', order + 0.5);
    const capZ = railLow(sp) + coping;
    box(k, part, p0 - 0.012, p1 + 0.012, t0 - dt - 0.012, t1 + dt + 0.012, capZ, capZ + 1.3, st.trim, 'cap', order + 1.6);
    const tc = (t0 + t1) / 2;
    const fin = cfg.finial === 'urn' ? URN : BALL;
    const sc = cfg.finial === 'urn' ? 0.55 : 0.8;
    k.loose(part, (g, e) => lathe(g, e, k, [sp, tc, capZ + 1.3], fin.map(([h, r]) => [h * sc, r * sc]), st.stone, 0.45),
      [[sp - 0.05, tc, capZ], [sp + 0.05, tc, capZ + 1.3 + 3.2 * sc]], order + 1.7);
  }
  // The balusters, a run of them in each gap between posts: those whose middles are in this slice.
  if (cfg.parapet !== 'balustrade') return;
  const tc = (t0 + t1) / 2;
  const R = 1.25;
  for (const [g0, g1] of gaps) {
    if (g1 < sl.s0 || g0 > sl.s1) continue;
    const n = Math.max(1, Math.round((g1 - g0) / 0.088));
    const ss: number[] = [];
    for (let j = 0; j < n; j++) {
      const s = g0 + ((g1 - g0) * (j + 0.5)) / n;
      if (s >= sl.s0 - 1e-6 && s < sl.s1 - 1e-6 && inRuns(s)) ss.push(s);
    }
    if (!ss.length) continue;
    const towardS = dot(k.A, k.e.toward);
    if (towardS < 0) ss.reverse();
    k.loose(part, (g, e) => {
      for (const s of ss) {
        const z = topP(s), h = railLow(s) - z;
        lathe(g, e, k, [s, tc, z], BALUSTER.map(([y, r]) => [y * h, r * R]), st.stone, 0.4);
      }
    }, [[ss[0], tc, topP(ss[0])], [ss[ss.length - 1], tc, railLow(ss[ss.length - 1])]], order + 0.5);
  }
}

/** The frame of an upright face along the bridge at `t`, as the core's. */
const wallF = (t: number, out: number): { o: L; a: L; b: L } => ({ o: [0, t, 0], a: [out > 0 ? 1 / U : -1 / U, 0, 0], b: [0, 0, 1] });

/** The runs of a slice's parapet: the slice less the refuges' gaps. */
function runsOf(plan: Plan, s0: number, s1: number): Run[] {
  let runs: Run[] = [{ sa: s0, sb: s1 }];
  for (const [g0, g1] of refugeGaps(plan)) {
    runs = runs.flatMap((r): Run[] => {
      if (g1 <= r.sa || g0 >= r.sb) return [r];
      const out: Run[] = [];
      if (g0 > r.sa + 0.02) out.push({ sa: r.sa, sb: g0 });
      if (g1 < r.sb - 0.02) out.push({ sa: g1, sb: r.sb });
      return out;
    });
  }
  return runs;
}

/** A heavy newel pedestal at an end of the bridge: a base, a die with a sunk panel, a corniced cap and its urn or ball. */
function newelAt(k: Kit, cfg: Classical, part: Part3, s: number, t: number): void {
  const { plan, st } = k;
  if (ownerOf(k, s - NEWEL, s + NEWEL) === null) return;
  const z = treadAt(plan, s);
  const lift = stepOf(plan);
  const H = cfg.parapetHeight + lift + 2.5;
  const w = NEWEL, d = 0.075;
  box(k, part, s - w, s + w, t - w, t + w, plan.deck(s) - 0.6, z + 2.6, st.trim, 'plinth', 3);
  box(k, part, s - d, s + d, t - d, t + d, z + 2.6, z + H - 2.2, st.stone, 'post', 3.1);
  box(k, part, s - w, s + w, t - w, t + w, z + H - 2.2, z + H, st.trim, 'cap', 3.2);
  box(k, part, s - 0.06, s + 0.06, t - 0.06, t + 0.06, z + H, z + H + 0.9, st.trim, 'cap', 3.3);
  const fin = cfg.newelFinial === 'urn' ? URN : BALL;
  const sc = cfg.newelFinial === 'urn' ? 1.15 : 1.4;
  k.loose(part, (g, e) => lathe(g, e, k, [s, t, z + H + 0.9], fin.map(([h, r]) => [h * sc, r * sc]), cfg.newelFinial === 'urn' ? st.stone : st.trim, 0.55),
    [[s - w, t, z + H], [s + w, t, z + H + 0.9 + 6.5 * sc]], 3.4);
}

/** A lamp standard on a refuge: a pedestal, an iron post, a lantern. */
function lampAt(k: Kit, part: Part3, s: number, t: number, z: number): void {
  const { st } = k;
  const iron: Tone = { lit: hex('#a6b2c6'), shade: hex('#454c66') };
  const H = 26;
  box(k, part, s - 0.05, s + 0.05, t - 0.05, t + 0.05, z, z + 4, st.trim, 'plinth', 4);
  k.loose(part, (g, e) => {
    lathe(g, e, k, [s, t, z + 4], [[0, 0.9], [1.2, 0.6], [H - 7, 0.45], [H - 6, 0.9], [H - 5.6, 0.5]], iron, 0.45);
  }, [[s - 0.05, t, z + 4], [s + 0.05, t, z + H]], 4.1);
  box(k, part, s - 0.032, s + 0.032, t - 0.032, t + 0.032, z + H - 5.6, z + H - 1, { lit: hex('#ffe7a4'), shade: hex('#e9b468') }, 'lamp', 4.2);
  k.loose(part, (g, e) => lathe(g, e, k, [s, t, z + H - 1], [[0, 1.9], [0.8, 1.4], [2, 0.3], [2.6, 0.6], [3, 0]], iron, 0.45),
    [[s - 0.05, t, z + H - 1], [s + 0.05, t, z + H + 2]], 4.3);
  k.glow.lamps.push(k.m([s, t, z + H - 3.3]));
}

/** Over each pier of a bridge two lanes wide, a refuge on a corbel: its own parapet round three sides, a lamp at three lanes. */
function refugesOf(k: Kit, cfg: Classical): void {
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const out = 0.17;
      const w = p.half + 0.08;
      if (p.s + w < sl.s0 || p.s - w > sl.s1) continue;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const z = plan.deck(p.s);
      const [ta, tb] = edge > 0 ? [t, t + out] : [t - out, t];
      const k2: Kit = { ...k, sl: { ...sl, t0: Math.min(sl.t0, ta), t1: Math.max(sl.t1, tb) } };
      box(k2, 'front', p.s - w, p.s + w, ta, tb, z - plan.thick - 1.4, z, st.trim, 'cornice', k.ord(edge, 0.9));
      box(k2, 'front', p.s - w * 0.75, p.s + w * 0.75, Math.min(ta, tb - edge * 0.04), Math.max(tb, ta - edge * 0.04), z - plan.thick - 7, z - plan.thick - 1.4, st.stone, 'pier', k.ord(edge, 0.85));
      // Its parapet: a run along its front between corner posts, and its two sides.
      const tFront = edge > 0 ? tb : ta;
      const runs = [{ sa: Math.max(sl.s0, p.s - w), sb: Math.min(sl.s1, p.s + w) }];
      const posts: Array<[number, number]> = [[p.s - w, p.s - w + 2 * POST], [p.s + w - 2 * POST, p.s + w]];
      parapetLine(k2, cfg, part, edge, tFront, runs, posts, [[p.s - w + 2 * POST, p.s + w - 2 * POST]], 2);
      const H = cfg.parapetHeight;
      for (const s0 of [p.s - w, p.s + w - 2 * POST]) {
        const [u0, u1] = edge > 0 ? [t, tFront - 0.1] : [tFront + 0.1, t];
        box(k2, part, s0, s0 + 2 * POST, u0, u1, z, z + H - 1.7, st.stone, 'parapet', 2);
        box(k2, part, s0 - 0.012, s0 + 2 * POST + 0.012, u0, u1, z + H - 1.7, z + H, st.trim, 'cap', 2.1);
      }
      if (plan.width >= 3 && ownerOf(k2, p.s - 0.05, p.s + 0.05) !== null) lampAt(k2, part, p.s, (ta + tb) / 2 + (edge > 0 ? -0.03 : 0.03), z);
    }
  }
}

/** A keystone at each crown in the slice, larger than the ring and hanging under it, its rune cut in gold. */
function keystones(k: Kit, cfg: Classical): void {
  const { plan, sl, st } = k;
  const ringD = cfg.ringDepth;
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0;
    for (const bay of plan.bays) {
      const tiers: Array<[number, number]> = [[bay.crown, plan.deck(bay.c) - plan.thick - 1.4]];
      if (bay.lowerCrown !== undefined && bay.course !== undefined) tiers.push([bay.lowerCrown, bay.course - 1.6]);
      for (const [crown, ceil] of tiers) {
        const wb = 0.062, wt = 0.08;
        if (ownerOf(k, bay.c - wt, bay.c + wt) === null) continue;
        const tk = t + edge * 0.036;
        const z0 = crown - 3.4, z1 = Math.min(crown + ringD + 0.8, ceil);
        k.solid('front', k.ord(edge, 0.85));
        const c = bay.c;
        const fr = { o: [c - wt * edge, tk, 0] as L, a: [edge > 0 ? 1 / U : -1 / U, 0, 0] as L, b: [0, 0, 1] as L };
        k.face('front', [[c - wb, tk, z0], [c + wb, tk, z0], [c + wt, tk, z1], [c - wt, tk, z1]], [0, edge, 0], cfg.key,
          { role: 'key', x0: 0, x1: wt * 2 * U, y0: z0, y1: z1, seed: Math.round(c * 10) }, fr);
        k.face('front', [[c - wb, t, z0], [c - wb, tk, z0], [c - wt, tk, z1], [c - wt, t, z1]], [-1, 0, 0.2], cfg.key);
        k.face('front', [[c + wb, t, z0], [c + wb, tk, z0], [c + wt, tk, z1], [c + wt, t, z1]], [1, 0, 0.2], cfg.key);
        k.face('front', [[c - wt, t, z1], [c + wt, t, z1], [c + wt, tk, z1], [c - wt, tk, z1]], [0, 0, 1], cfg.key);
        k.face('front', [[c - wb, t, z0], [c + wb, t, z0], [c + wb, tk, z0], [c - wb, tk, z0]], [0, 0, -1], cfg.key);
        const size = Math.min(wt * 2 * U * 0.36, (z1 - z0) * 0.3);
        k.glow.runes.push({ at: k.m([c, tk, z0 + (z1 - z0) * 0.46]), s: size, glyph: st.rune });
      }
    }
  }
}

/* ---- the deck and the arches, in whole faces ---------------------------------------------------- */

/**
 * The deck of the slice: its top (in treads and risers on a ramp), and on
 * each outer edge the cornice band under it, proud of the wall, with its
 * ledge. Each a single face to the slice.
 */
function deckOf(k: Kit, cfg: Classical): void {
  const { plan, sl, st } = k;
  const top = plan.deck;
  k.solid('front', 0);
  if (plan.ramp) {
    const up = plan.deck(plan.n) >= plan.deck(0);
    for (let j = 0; j < 3; j++) {
      const a = sl.s0 + (sl.s1 - sl.s0) * j / 3, b = sl.s0 + (sl.s1 - sl.s0) * (j + 1) / 3;
      const z = treadAt(plan, (a + b) / 2);
      k.face('front', [[a, sl.t0, z], [b, sl.t0, z], [b, sl.t1, z], [a, sl.t1, z]], [0, 0, 1], st.deck,
        { role: 'tread', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i * 7 + j, along: true, up } as Info, { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
    }
    // The risers: at every tread's edge, in the slice of the higher tread, so that one at a cut is laid behind the lower.
    for (let q = Math.ceil(sl.s0 * 3 - 1e-6); q / 3 <= sl.s1 + 1e-6; q++) {
      const s = q / 3;
      const zl = treadAt(plan, s - 1e-4), zr = treadAt(plan, s + 1e-4);
      if (Math.abs(zl - zr) < 1e-3) continue;
      if (zr > zl ? s >= sl.s1 - 1e-6 : s <= sl.s0 + 1e-6) continue;
      k.face('front', [[s, sl.t0, Math.min(zl, zr)], [s, sl.t1, Math.min(zl, zr)], [s, sl.t1, Math.max(zl, zr)], [s, sl.t0, Math.max(zl, zr)]], [zr > zl ? -1 : 1, 0, 0], st.trim);
    }
  } else {
    k.face('front', [[sl.s0, sl.t0, top(sl.s0)], [sl.s1, sl.t0, top(sl.s1)], [sl.s1, sl.t1, top(sl.s1)], [sl.s0, sl.t1, top(sl.s0)]], [0, 0, 1], st.deck,
      { role: 'deck', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i * 7 + sl.o, along: true }, { o: [0, 0, top(sl.s0)], a: [1 / U, 0, (top(sl.s1) - top(sl.s0)) / U], b: [0, 1 / U, 0] });
  }
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0;
    const tt = t + edge * 0.03;
    const lo = (s: number): number => top(s) - plan.thick - 1.4, hi = (s: number): number => top(s) - 0.6;
    const [a, b] = [sl.s0, sl.s1];
    k.solid('front', 1);
    k.face('front', [[a, tt, lo(a)], [b, tt, lo(b)], [b, tt, hi(b)], [a, tt, hi(a)]], [0, edge, 0], st.trim,
      { role: 'cornice', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i }, wallF(tt, edge));
    k.face('front', [[a, t, hi(a)], [b, t, hi(b)], [b, tt, hi(b)], [a, tt, hi(a)]], [0, 0, 1], st.trim);
    k.face('front', [[a, t, lo(a)], [b, t, lo(b)], [b, tt, lo(b)], [a, tt, lo(a)]], [0, 0, -1], st.trim);
  }
  void cfg;
}

/** Where the bay's opening is at `s`, if it is in one: not over a pier. */
function openAt(plan: Plan, s: number): Bay | null {
  for (const p of plan.piers) if (s > p.s - p.half - 1e-6 && s < p.s + p.half + 1e-6) return null;
  return bayAt(plan, s);
}

/**
 * The stone under the deck, each piece one face to the slice: on each outer
 * edge the wall from the ground (or the ring's back) up to the cornice, the
 * ring proud of it in voussoirs, for two tiers the lower spandrel and the
 * course; a cutwater on each pier; across the lane the vault (a loose
 * drawing, shaded a strip at a time, coursed) and the side of each pier
 * facing into its bay.
 */
function archesOf(k: Kit, cfg: Classical): void {
  const { plan, sl, st } = k;
  const ringD = cfg.ringDepth;
  const db = (s: number): number => plan.deck(s) - plan.thick - 1.4;
  const breaks: number[] = [];
  for (const p of plan.piers) breaks.push(p.s - p.half, p.s + p.half);
  for (const bay of plan.bays) breaks.push(bay.c);
  const xs = samples(sl.s0, sl.s1, breaks, 1 / 16);
  const env = (s: number, t: number): number => {
    const bay = openAt(plan, s);
    if (!bay) return plan.ground(s, t) - 0.5;
    return Math.min(db(s) - 0.01, bay.arch(s) + ringD);
  };
  const ringFns = (bay: Bay): Array<[(s: number) => number, (s: number) => number]> => {
    const out: Array<[(s: number) => number, (s: number) => number]> = [[bay.arch, db]];
    if (bay.lower && bay.course !== undefined) { const c = bay.course; out.push([bay.lower, () => c - 1.6]); }
    return out;
  };
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 : sl.t0;
    const fr = wallF(t, edge);
    // The wall: along the cornice's foot, and back along the ground and the rings' backs.
    k.solid('front', k.ord(edge, -1));
    const wall: L[] = [[sl.s0, t, db(sl.s0)], [sl.s1, t, db(sl.s1)]];
    for (let j = xs.length - 1; j >= 0; j--) {
      const s = xs[j];
      const r = j < xs.length - 1 ? env(s + 1e-4, t) : null, l = j > 0 ? env(s - 1e-4, t) : null;
      if (r !== null) wall.push([s, t, r]);
      if (l !== null && (r === null || Math.abs(l - r) > 1e-3)) wall.push([s, t, l]);
    }
    k.face('front', wall, [0, edge, 0], st.stone, { role: 'wall', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i }, fr);
    // Two tiers: the lower spandrel, from the lower ring's back to the course.
    for (const bay of plan.bays) {
      if (!bay.lower || bay.course === undefined) continue;
      const a = Math.max(sl.s0, bay.c - bay.a), b = Math.min(sl.s1, bay.c + bay.a);
      if (b - a < 1e-4) continue;
      const c = bay.course;
      const pts: L[] = [[a, t, c], [b, t, c]];
      for (const s of xs.filter((x) => x > a + 1e-6 && x < b - 1e-6).concat([a, b]).sort((p, q) => q - p)) pts.push([s, t, Math.min(c - 0.01, bay.lower(s) + ringD)]);
      k.face('front', pts, [0, edge, 0], st.stone, { role: 'wall', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i + 1 }, fr);
    }
    // The rings, proud of the wall: one face a bay and a tier.
    const tr = t + edge * 0.015;
    for (const bay of plan.bays) {
      const a = Math.max(sl.s0, bay.c - bay.a), b = Math.min(sl.s1, bay.c + bay.a);
      if (b - a < 1e-4) continue;
      for (const [f, ceil] of ringFns(bay)) {
        k.solid('front', k.ord(edge, 0.5));
        const ss = xs.filter((x) => x > a + 1e-6 && x < b - 1e-6).concat([a, b]).sort((p, q) => p - q);
        const pts: L[] = ss.map((s) => [s, tr, f(s)] as L);
        for (let j = ss.length - 1; j >= 0; j--) pts.push([ss[j], tr, Math.min(ceil(ss[j]), f(ss[j]) + ringD)]);
        const joints = voussoirs(bay, f, ringD, ringD * 1.15);
        k.face('front', pts, [0, edge, 0], st.ring, { role: 'ring', x0: 0, x1: 1, y0: 0, y1: 1, seed: Math.round(bay.c * 10), along: true, ring: [f, joints] } as Info, wallF(tr, edge));
      }
    }
    cutwatersOf(k, cfg, edge, t);
  }
  // Two tiers: the course the upper arcade stands on, across the lane, and its band on each outer face.
  for (const bay of plan.bays) {
    if (bay.course === undefined) continue;
    const z = bay.course;
    const a = Math.max(sl.s0, bay.s0), b = Math.min(sl.s1, bay.s1);
    if (b - a < 1e-4) continue;
    const oa = Math.max(a, bay.c - bay.a), ob = Math.min(b, bay.c + bay.a);
    if (ob - oa > 1e-4) {
      k.solid('front', -6);
      k.face('front', [[oa, sl.t0, z], [ob, sl.t0, z], [ob, sl.t1, z], [oa, sl.t1, z]], [0, 0, 1], st.trim,
        { role: 'deck', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i, along: true }, { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
    }
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0, tt = t + edge * 0.022;
      k.solid('front', k.ord(edge, 0.3));
      k.face('front', [[a, tt, z - 1.6], [b, tt, z - 1.6], [b, tt, z + 0.4], [a, tt, z + 0.4]], [0, edge, 0], st.trim,
        { role: 'cornice', x0: 0, x1: 1, y0: 0, y1: 1, seed: sl.i }, wallF(tt, edge));
      k.face('front', [[a, t, z + 0.4], [b, t, z + 0.4], [b, tt, z + 0.4], [a, tt, z + 0.4]], [0, 0, 1], st.trim);
    }
  }
  // Across the lane: the vault under each arch, a loose drawing so its strips meet with no ink between them.
  vaultOf(k, cfg, xs);
  // The side of each pier facing into its bay, up to the spring (for two tiers, to each spring).
  for (const bay of plan.bays) {
    const p0 = plan.piers.find((p) => Math.abs(p.s - bay.s0) < 1e-6), p1 = plan.piers.find((p) => Math.abs(p.s - bay.s1) < 1e-6);
    if (!p0 || !p1) continue;
    for (const [s, dirn] of [[p0.s + p0.half, 1], [p1.s - p1.half, -1]] as Array<[number, number]>) {
      if (s < sl.s0 - 1e-6 || s > sl.s1 + 1e-6) continue;
      const g0 = plan.ground(s, sl.t0) - 0.5, g1 = plan.ground(s, sl.t1) - 0.5;
      const spans: Array<[number, number, number]> = bay.lower ? [[g0, g1, bay.lower(s)], [bay.course!, bay.course!, bay.arch(s)]] : [[g0, g1, bay.arch(s)]];
      for (const [z0, z0b, z1] of spans) {
        if (z1 - Math.max(z0, z0b) < 0.1) continue;
        k.solid('back', -1);
        k.face('back', [[s, sl.t0, z0], [s, sl.t1, z0b], [s, sl.t1, z1], [s, sl.t0, z1]], [dirn, 0, 0], st.stone,
          { role: 'pier', x0: 0, x1: 1, y0: 0, y1: 1, seed: Math.round(s * 10) }, { o: [s, 0, 0], a: [0, 1 / U, 0], b: [0, 0, 1] });
      }
    }
  }
}

/** The underside of each arch across the lane: strips shaded by how each faces the light, a joint along each voussoir's. */
function vaultOf(k: Kit, cfg: Classical, xs: number[]): void {
  const { plan, sl, st } = k;
  const strips: Array<{ pts: L[]; n: [number, number, number] }> = [];
  const joints: L[][] = [];
  const reach: L[] = [];
  for (const bay of plan.bays) {
    const a = Math.max(sl.s0, bay.c - bay.a), b = Math.min(sl.s1, bay.c + bay.a);
    if (b - a < 1e-4) continue;
    for (const f of [bay.arch, bay.lower]) {
      if (!f) continue;
      const ss = xs.filter((x) => x > a + 1e-6 && x < b - 1e-6).concat([a, b]).sort((p, q) => p - q);
      for (let j = 0; j + 1 < ss.length; j++) {
        const s0 = ss[j], s1 = ss[j + 1];
        const pts: L[] = [[s0, sl.t0, f(s0)], [s1, sl.t0, f(s1)], [s1, sl.t1, f(s1)], [s0, sl.t1, f(s0)]];
        // Its normal, down and in toward the middle of the opening.
        const m0 = k.m(pts[0]), m1 = k.m(pts[1]), m3 = k.m(pts[3]);
        const u = sub(m1, m0), v = sub(m3, m0);
        let n: [number, number, number] = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (n[2] > 0) n = [-n[0], -n[1], -n[2]];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        strips.push({ pts, n: [n[0] / l, n[1] / l, n[2] / l] });
        reach.push(pts[0], pts[2]);
      }
      for (const [s, z] of voussoirs(bay, f, cfg.ringDepth, cfg.ringDepth * 1.15)) if (s > a && s < b) joints.push([[s, sl.t0, z], [s, sl.t1, z]]);
    }
  }
  if (!strips.length) return;
  k.loose('back', (g, e) => {
    const seen = strips.filter((q) => dot(q.n, e.toward) > 0);
    seen.sort((p, q) => dot(k.m(p.pts[0]), e.toward) - dot(k.m(q.pts[0]), e.toward));
    g.lineJoin = 'round';
    for (const q of seen) {
      const c = css(faceColour(st.stone, Math.max(0.55, lightOf(e, q.n) - 0.12)));
      g.beginPath();
      q.pts.forEach((p, i) => { const [x, y] = proj(e, k.m(p)); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.closePath();
      g.fillStyle = c;
      g.fill();
      g.strokeStyle = c;
      g.lineWidth = 0.6;
      g.stroke();
    }
    g.strokeStyle = css(mix(faceColour(st.stone, 0.7), DUSK, 0.35), 0.7);
    g.lineWidth = 0.35;
    for (const [p, q] of joints) {
      const [x0, y0] = proj(e, k.m(p)), [x1, y1] = proj(e, k.m(q));
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  }, reach, 0);
}

/** A pointed cutwater on each pier's outer face, from its foot to its spring (to the deck under a refuge), capped with a sloped top. */
function cutwatersOf(k: Kit, cfg: Classical, edge: number, t: number): void {
  const { plan, sl, st } = k;
  for (const p of plan.piers) {
    if (p.end) continue;
    if (p.s < sl.s0 - p.half - 1e-6 || p.s > sl.s1 + p.half + 1e-6) continue;
    const bay = bayAt(plan, p.s - 0.01);
    const top = plan.width >= 2 ? plan.deck(p.s) - plan.thick - 1.4 : (bay.lower ? bay.lowerSpring! : bay.spring) + 1;
    const nose = 0.2;
    for (const side of [-1, 1]) {
      const sa = p.s, sb = p.s + side * p.half;
      if ((side < 0 && p.s <= sl.s0 + 1e-6) || (side > 0 && p.s >= sl.s1 - 1e-6)) continue;
      const tip: L = [sa, t + edge * nose, 0];
      const fb = plan.ground(sb, t) - 0.5, fa = plan.ground(sa, tip[1]) - 0.5;
      k.solid('front', k.ord(edge, 0.2));
      k.face('front', [[sb, t, fb], [sa, tip[1], fa], [sa, tip[1], top], [sb, t, top]], [side * 0.5, edge, 0], st.stone,
        { role: 'pier', x0: 0, x1: 1, y0: 0, y1: 1, seed: Math.round(p.s * 10) }, { o: [sb, t, 0], a: [(sa - sb) / U, edge * nose / U, 0], b: [0, 0, 1] });
      if (plan.width < 2) {
        // Its cap: a band of the dressing, then a slope up from the nose to the wall.
        const capTop = top + nose * U * 0.45;
        k.face('front', [[sb, t, top], [sa, tip[1], top], [sa, t, capTop]], [side * 0.3, edge * 0.6, 1], st.trim);
      }
    }
  }
  void cfg;
}

/** The classical bridge's style off its description. */
export function classical(cfg: Classical): BridgeStyle {
  const style: BridgeStyle = {
    family: 'stone',
    stone: cfg.stone,
    ring: cfg.ring,
    trim: cfg.trim,
    deck: cfg.deck,
    parapet: cfg.parapet,
    parapetHeight: cfg.parapetHeight,
    ringDepth: cfg.ringDepth,
    rune: cfg.rune,
    glow: cfg.glow,
    paint: cfg.paint,
    build: {
      deck(k) { deckOf(framed(k), cfg); },
      arches(k) {
        const { plan } = k;
        archesOf(framed(k, (inf, pts, xy) => {
          if (inf.role === 'ring' && inf.ring) {
            const [, all] = inf.ring;
            const s0 = Math.min(...pts.map((p) => p[0])) - 0.15, s1 = Math.max(...pts.map((p) => p[0])) + 0.15;
            const t = pts[0][1];
            inf.joints = all.filter((j) => j[0] >= s0 && j[0] <= s1).map(([sa, za, sb, zb, q]) => [...xy([sa, t, za]), ...xy([sb, t, zb]), q] as [number, number, number, number, number]);
          } else if (cfg.roundels && inf.role === 'wall') {
            const t = pts[0][1];
            inf.roundels = roundelsOf(plan, cfg.ringDepth).map(([s, z, R]) => { const [x, y] = xy([s, t, z]); return [x, y, R] as [number, number, number]; });
          }
        }), cfg);
        keystones(framed(k), cfg);
      },
      parapet(k, edge, part) {
        const { plan, sl } = k;
        const kk = framed(k);
        const tOut = edge > 0 ? sl.t1 : sl.t0;
        const { posts, gaps } = layoutOf(plan);
        parapetLine(kk, cfg, part, edge, tOut, runsOf(plan, sl.s0, sl.s1), posts, gaps);
      },
      ends(k) {
        const { plan, sl } = k;
        // Widened to take in the pedestal, which stands proud of the parapet's line.
        const kk = framed({ ...k, sl: { ...sl, t0: sl.t0 - 0.06, t1: sl.t1 + 0.06 } });
        for (const edge of sl.edges) {
          const t = edge > 0 ? sl.t1 - 0.05 : sl.t0 + 0.05;
          const part: Part3 = edge === sl.near ? 'rail' : 'front';
          if (sl.i === 0) newelAt(kk, cfg, part, NEWEL, t);
          if (sl.i === plan.n - 1) newelAt(kk, cfg, part, plan.n - NEWEL, t);
        }
      },
      refuges(k) { refugesOf(framed(k), cfg); },
    },
  };
  return style;
}

/* ---- marble ------------------------------------------------------------------------------------ */

/** The house marble's white, cool, and the dove grey it is dressed in (`masonry.ts`), shaded toward the island's lilac. */
const WHITE: Tone = { lit: hex('#f4f5f7'), shade: hex('#a9abbd') };
const DOVE: Tone = { lit: hex('#dde0e6'), shade: hex('#8f92a6') };
const VEIN = hex('#9ea6b4');

export const marble = classical({
  stone: WHITE,
  ring: { lit: hex('#eceef2'), shade: hex('#a0a3b6') },
  trim: DOVE,
  key: { lit: hex('#fbf6ea'), shade: hex('#b8b0b4') },
  deck: { lit: hex('#e9eaee'), shade: hex('#a7a9ba') },
  rune: 'star8',
  glow: '#cfe6ff',
  ringDepth: 4.2,
  parapetHeight: 10,
  parapet: 'balustrade',
  finial: 'ball',
  newelFinial: 'urn',
  paint: {
    wall: slabPaint({ courses: [6.5], len: 13, vary: 0.25, tint: 0.05, vein: VEIN, veined: 0.5, joint: 0.22 }),
    pier: slabPaint({ courses: [5.5], len: 10, vary: 0.2, tint: 0.05, vein: VEIN, veined: 0.4, joint: 0.25, salt: 3 }),
    parapet: slabPaint({ courses: [4], len: 10, tint: 0.04, vein: VEIN, veined: 0.3 }),
    ring: ringPaint(CREAM, 0.3),
    key: keystonePaint('star8'),
    cornice: cornicePaint('dentil'),
    cap: copingPaint('star8'),
    plinth: plinthPaint,
    post: panelPaint,
    deck: flagPaint(12, 10),
    tread: flagPaint(14, 10),
  },
});
