import { PROUD } from './coping';
import { TH, TW, blob, cnv, ctxOf, hexA, poly, rand } from './draw';
import { LOW_FOOT, PROUD_SH, PROUD_SIDE, XM, dressUnder } from './frame';
import type { Kit } from './kit';
import { stoneCapPier } from './laid';
import { A_CX, A_CY, A_R } from './openings';
import { flatCap, flatLowCap } from './render';
import type { Block, Ctx, Lay, Low, Masonry, Pt, Rand } from './types';

/**
 * Silver and gold: worked metal throughout, chased panels between fluted pilasters.
 */

/**
 * A pilaster's width, half of it either side of a seam, and the frieze
 * along the head of a storey. The pilaster is wide because a wall is laid
 * narrow: on the game's iso faces a texture pixel comes out about 0.18 of
 * a screen pixel across and 0.31 up, so what is painted across a wall has
 * to be painted nearly twice as wide as it is to read.
 */
const PIL = 64, FRIEZE = 48;

/** How far the recess reaches from a pilaster to the frame of the panel beside it. */
const GAP = 14;

/** Eggs to a section's frieze: at twelve and at ten they came out a row of beads and a toothed strip. */
const EGGS = 7;

/** Where a storey's panels begin and end, under the frieze and over the foot. */
const PANEL_TOP = FRIEZE + 20, PANEL_FOOT = TH - 24;

/**
 * How much wider than it is tall round work is painted, so it is round as
 * laid on an iso face (see `PIL`). Painted round it came out a tall oval,
 * and an oval cartouche a slot.
 */
const WIDE = 1.6;

/**
 * A frame's bevels: across the verticals, along the head and along the
 * foot, and the reflected dark inside a lit one -- each wide enough across
 * to be seen at the game's own zoom.
 */
const BEV_V = 12, BEV_H = 7, BEV_FOOT = 10, CORE_V = 6, CORE_H = 4;

/** Where the light comes from, in a picture: its upper left. */
const LX = -Math.SQRT1_2, LY = -Math.SQRT1_2;

/**
 * A slab of worked silver from (x0, y0) to (x1, y1), bevelled `b` round its
 * edge: its face; the bevel along its top turned up at the sky, with the
 * reflected dark hard under it; the one down its left a step up from the
 * face; the bevel along its underside taking the lawn and the one down its
 * right the dark. No ink round it: the bevels are its edge. For the small
 * mouldings -- capitals, cornices, sills -- that are cut true.
 */
function slab(kit: Kit, g: Ctx, x0: number, y0: number, x1: number, y1: number, face: string, b: number): void {
  const { PASTEL } = kit;
  const quad = (pts: Pt[], col: string): void => { g.beginPath(); poly(g, pts); g.fillStyle = col; g.fill(); };
  const f = Math.min(b * 1.5, (y1 - y0) / 3);
  quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], face);
  if (y1 - y0 > 2 * b + 4) quad([[x0 + b, y0 + b], [x1 - b, y0 + b], [x1 - b, y0 + b + 3], [x0 + b, y0 + b + 3]], PASTEL.core);
  quad([[x0, y0], [x1, y0], [x1 - b, y0 + b], [x0 + b, y0 + b]], PASTEL.rim);
  quad([[x0, y0], [x0 + b, y0 + b], [x0 + b, y1 - f], [x0, y1]], PASTEL.edgeHi);
  quad([[x0, y1], [x0 + b, y1 - f], [x1 - b, y1 - f], [x1, y1]], PASTEL.reflect);
  quad([[x1, y0], [x1, y1], [x1 - b, y1 - f], [x1 - b, y0 + b]], PASTEL.edgeLo);
}

/**
 * The plinth's face as chrome shows it: a band of sky brightening to a lip
 * on the horizon, the darkest of the reflection right under it, and the
 * ground stepping lighter to its foot. Its lines come level at both ends,
 * where it meets the next section's, and dip between.
 */
function mirror(kit: Kit, g: Ctx, R: Rand, x0: number, y0: number, x1: number, y1: number): void {
  const { PASTEL } = kit;
  const w = x1 - x0, h = y1 - y0, sky = h * 0.36, hy = y0 + sky;
  const dip = 2 + R() * 5, at = 0.25 + R() * 0.5;
  const line = (y: number): Pt[] => Array.from({ length: 9 }, (_, i): Pt => {
    const u = i / 8, end = i === 0 || i === 8;
    return [x0 + w * u, y + dip * Math.sin(Math.PI * u) * Math.exp(-(((u - at) / 0.3) ** 2)) + (end ? 0 : (R() - 0.5) * 1.6)];
  });
  const band = (a: Pt[], b: Pt[], col: string): void => {
    g.beginPath(); poly(g, [[a[0][0] - 3, a[0][1]], ...a, [a[8][0] + 3, a[8][1]], [b[8][0] + 3, b[8][1]], ...b.slice().reverse(), [b[0][0] - 3, b[0][1]]]);
    g.fillStyle = col; g.fill();
  };
  const deep = Math.min(10, (y1 - hy) * 0.25), rest = y1 - hy - deep;
  const ys = [y0 - 3, hy - sky * 0.55, hy - sky * 0.2, hy - 4, hy, hy + deep, hy + deep + rest * 0.3, hy + deep + rest * 0.64, y1 + 3];
  const cols = [PASTEL.skyHead, PASTEL.skyMid, PASTEL.skyLow, PASTEL.lip, PASTEL.deep, PASTEL.groundA, PASTEL.groundB, PASTEL.groundC];
  const lines = ys.map((y, i) => (i === 0 || i === ys.length - 1 ? line(y).map(([x]): Pt => [x, y]) : line(Math.max(y0, Math.min(y1, y)))));
  g.save();
  g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  for (let i = 0; i < cols.length; i++) band(lines[i], lines[i + 1], cols[i]);
  g.restore();
}

/**
 * What a flat face of it standing upright shows, between (x0, y0) and
 * (x1, y1), faintly, in flat shapes: the sky over its upper part, a step
 * lighter than it; a thin line of the far horizon at `hy`, its underside
 * dipping from left to right; its own satin under that; and the lawn at
 * its foot. `body` is its own tone. The values sit close, so it reads as
 * satin reflecting, not as a pane of glass or a blind half drawn. `cols`
 * are its sky, its horizon and its lawn: the ground behind the panels
 * takes them a step off its own darker satin, not the panels'.
 */
function sheen(kit: Kit, g: Ctx, R: Rand, x0: number, y0: number, x1: number, y1: number, hy: number, body: string, foot: number, cols = [kit.PASTEL.plateSky, kit.PASTEL.plateLine, kit.PASTEL.plateFoot]): void {
  const w = x1 - x0, dip = 10 + R() * 10, lw = 10 + R() * 4;
  const cut = (y: number, d: number): Pt[] => Array.from({ length: 7 }, (_, i): Pt => [x0 - 3 + ((w + 6) * i) / 6, y + (d * i) / 6 + (i && i < 6 ? (R() - 0.5) * 2.4 : 0)]);
  g.save();
  g.beginPath(); g.rect(x0, y0, w, y1 - y0); g.clip();
  g.fillStyle = body; g.fillRect(x0, y0, w, y1 - y0);
  const top = cut(hy, 0), under = cut(hy + lw, dip);
  g.beginPath(); poly(g, [[x0 - 3, y0 - 3], [x1 + 3, y0 - 3], ...top.slice().reverse()]); g.fillStyle = cols[0]; g.fill();
  g.beginPath(); poly(g, [...top, ...under.slice().reverse()]); g.fillStyle = cols[1]; g.fill();
  const f = cut(y1 - foot, 0);
  g.beginPath(); poly(g, [...f, [x1 + 3, y1 + 3], [x0 - 3, y1 + 3]]); g.fillStyle = cols[2]; g.fill();
  g.restore();
}

/**
 * A glint where a form turns square to the sun, at (x, y): a dab of white
 * `w` across and `h` high, painted wide as everything across a wall is.
 * Pure white is kept for these; laid as a line round every form it read as
 * icing.
 */
function glint(kit: Kit, g: Ctx, x: number, y: number, w = 8, h = 4): void {
  const { PASTEL } = kit;
  g.beginPath(); g.ellipse(x, y, (w / 2) * WIDE, h / 2, -0.25, 0, Math.PI * 2); g.fillStyle = PASTEL.glint; g.fill();
}

/**
 * A run of the glint along an edge turned to the sky, from `x0` to `x1` at
 * `y`, `t` high: broken in two or three, and placed by `R`, so no two
 * sections carry it at the same place.
 */
function whiteRun(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, y: number, t: number): void {
  const { PASTEL } = kit;
  const len = (x1 - x0) * (0.2 + R() * 0.12), n = 2 + Math.floor(R() * 2);
  let x = x0 + R() * (x1 - x0 - len);
  g.fillStyle = PASTEL.glint;
  for (let i = 0; i < n; i++) {
    const w = (len / n) * (0.6 + R() * 0.5);
    g.beginPath(); poly(g, [[x, y + t * 0.3], [x + 3, y], [x + w, y], [x + w - 2, y + t], [x, y + t]]); g.fill();
    x += w + 6 + R() * 14;
  }
}

/**
 * Tarnish lying in a corner at (x, y), opening along (dx, dy), `r` along
 * each side: a flat pool, its open edge cut by hand and never quite
 * straight, in `col`.
 */
function pool(g: Ctx, R: Rand, x: number, y: number, dx: number, dy: number, r: number, col: string): void {
  const a = r * (0.8 + R() * 0.4), b = r * (0.8 + R() * 0.4), k = 0.45 + R() * 0.2;
  g.beginPath(); poly(g, [[x, y], [x + dx * a * WIDE, y], [x + dx * a * WIDE * k, y + dy * b * k], [x, y + dy * b]]);
  g.fillStyle = col; g.fill();
}

/**
 * A form chased up from the silver in two flat facets, split along the
 * line through (cx, cy) running (ax, ay): the half that faces the light
 * in `lit`, the other in `shade`, over the shade it throws down to its
 * lower right, `e` across. One recipe of a white line along the top and a
 * dark one along the foot of every form read as an emboss filter.
 */
function facet(kit: Kit, g: Ctx, path: () => void, cx: number, cy: number, ax: number, ay: number, e = 2.5, lit = kit.PASTEL.facetLit, shade = kit.PASTEL.facetShade): void {
  const { PASTEL } = kit;
  g.save(); g.translate(e, e); path(); g.fillStyle = PASTEL.reliefLo; g.fill(); g.restore();
  path(); g.fillStyle = shade; g.fill();
  let nx = -ay, ny = ax;
  if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
  const B = 2000;
  g.save(); path(); g.clip();
  g.beginPath(); poly(g, [[cx - ax * B, cy - ay * B], [cx + ax * B, cy + ay * B], [cx + ax * B + nx * B, cy + ay * B + ny * B], [cx - ax * B + nx * B, cy - ay * B + ny * B]]);
  g.fillStyle = lit; g.fill();
  g.restore();
}

/**
 * A hollow sunk into chased work, `path` its shape: the shade of the rim
 * `e` across down its upper left, where the rim stands over it; its ground
 * a step under the plate; and the rim's inner wall lit `k` across along
 * its lower right, which faces the light.
 */
function hollow(kit: Kit, g: Ctx, path: () => void, e = 3, k = 3): void {
  const { PASTEL } = kit;
  g.save();
  path(); g.clip();
  path(); g.fillStyle = PASTEL.facetLit; g.fill();
  g.save(); g.translate(-k, -k); path(); g.restore(); g.clip();
  path(); g.fillStyle = PASTEL.reliefLo; g.fill();
  g.save(); g.translate(e, e); path(); g.fillStyle = PASTEL.sunk; g.fill(); g.restore();
  g.restore();
}

/** A boss: a dome in two facets with a ring of tarnish at its root, and where `lit`, a glint on its crown. */
function boss(kit: Kit, g: Ctx, cx: number, cy: number, r: number, lit = false): void {
  const { PASTEL } = kit;
  g.beginPath(); g.arc(cx, cy, r + 3.5, 0, Math.PI * 2); g.fillStyle = PASTEL.pool; g.fill();
  facet(kit, g, () => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); }, cx, cy, 1, -1, 2);
  if (lit) glint(kit, g, cx - r * 0.35, cy - r * 0.4, Math.max(4, r * 0.5), Math.max(3, r * 0.35));
}

/** A rosette: petals of no two sizes or angles, each in two facets, round a boss, and the tarnish lying between them. */
function rosette(kit: Kit, g: Ctx, R: Rand, cx: number, cy: number, r: number, n: number): void {
  const { PASTEL } = kit;
  g.beginPath(); g.arc(cx, cy, r * 0.8, 0, Math.PI * 2); g.fillStyle = PASTEL.pool; g.fill();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (R() - 0.5) * 0.35, rx = r * (0.36 + (R() - 0.5) * 0.14), ry = r * (0.22 + (R() - 0.5) * 0.08);
    const d = r * (0.55 + (R() - 0.5) * 0.1), px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
    facet(kit, g, () => { g.beginPath(); g.ellipse(px, py, rx, ry, a, 0, Math.PI * 2); }, px, py, Math.cos(a), Math.sin(a), 2);
  }
  boss(kit, g, cx, cy, r * 0.3, true);
}

/**
 * What a panel is chased with: an oval cartouche with a rosette in it, a
 * great rosette, a scallop shell, a quatrefoil, a lozenge with a boss at
 * each point, a running scroll, an interlace of two, or a drop of husks
 * hung from a boss, for a panel too narrow for anything round -- each `s`
 * across, a step under the architecture, so the frames lead and the
 * chasing follows, and at most one glint to it.
 */
type Motif = 'cartouche' | 'rosette' | 'shell' | 'quatrefoil' | 'lozenge' | 'scroll' | 'crossed' | 'drop';

/** How wide and how tall each round one is, for its `s`, before it is widened. */
const MOTIF_BOX: Record<string, [number, number]> = { cartouche: [0.84, 1.2], rosette: [0.96, 0.96], shell: [1.12, 0.86], quatrefoil: [1.1, 1.1], lozenge: [0.88, 1.24] };

function motif(kit: Kit, g: Ctx, R: Rand, kind: Motif, cx: number, cy: number, s: number, w = s, h = s): void {
  if (kind === 'scroll' || kind === 'crossed' || kind === 'drop') { chased(kit, g, R, kind, cx, cy, s, w, h); return; }
  // the tarnish in its shadow, down its lower right
  g.save(); g.translate(cx, cy); g.scale(WIDE, 1); g.translate(-cx, -cy);
  chased(kit, g, R, kind, cx, cy, s, w, h);
  g.restore();
}

function chased(kit: Kit, g: Ctx, R: Rand, kind: Motif, cx: number, cy: number, s: number, w: number, h: number): void {
  const { PASTEL } = kit;
  // a rosette too small to show its petals is a star of scratches: a plain boss instead
  const centre = (r: number, n: number): void => { if (r >= 12) rosette(kit, g, R, cx, cy, r, n); else boss(kit, g, cx, cy, Math.max(6, r * 0.7), true); };
  /** A ring: tarnish in the shade it throws, the ring in two facets, the hollow inside it. */
  const ring = (outer: () => void, inner: () => void, t: number): void => {
    g.save(); g.translate(t * 0.7, t * 0.7); outer(); g.fillStyle = PASTEL.pool; g.fill(); g.restore();
    facet(kit, g, outer, cx, cy, 1, -1, 3, PASTEL.ring, PASTEL.facetShade);
    hollow(kit, g, inner, 3, 3);
  };
  if (kind === 'cartouche') {
    const rx = s * 0.42, ry = s * 0.6, t = Math.max(10, s * 0.1);
    ring(() => { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }, () => { g.beginPath(); g.ellipse(cx, cy, rx - t, ry - t, 0, 0, Math.PI * 2); }, t);
    glint(kit, g, cx - rx * 0.72, cy - ry * 0.62, 7, 4);
    centre(s * 0.26, 8);
  } else if (kind === 'rosette') {
    rosette(kit, g, R, cx, cy, s * 0.52, 11);
  } else if (kind === 'shell') {
    // ribs touching from a hinge with two ears, fanning to a scalloped rim
    const r = s * 0.58, hy = cy + r * 0.42, n = 10, a0 = Math.PI * 1.06, a1 = Math.PI * 1.94;
    const cuts = [0]; for (let i = 1; i < n; i++) cuts.push(i / n + (R() - 0.5) * 0.035); cuts.push(1);
    const outline = (): void => {
      g.beginPath(); g.moveTo(cx, hy);
      for (let i = 0; i < n; i++) {
        const a = a0 + cuts[i] * (a1 - a0), b = a0 + cuts[i + 1] * (a1 - a0), m = (a + b) / 2;
        g.quadraticCurveTo(cx + Math.cos(m) * r * 1.1, hy + Math.sin(m) * r * 1.1, cx + Math.cos(b) * r, hy + Math.sin(b) * r);
      }
      g.closePath();
    };
    g.save(); g.translate(5, 5); outline(); g.fillStyle = PASTEL.pool; g.fill(); g.restore();
    for (let i = 0; i < n; i++) {
      const a = a0 + cuts[i] * (a1 - a0), b = a0 + cuts[i + 1] * (a1 - a0), m = (a + b) / 2;
      facet(kit, g, () => {
        g.beginPath(); g.moveTo(cx, hy); g.lineTo(cx + Math.cos(a) * r, hy + Math.sin(a) * r);
        g.quadraticCurveTo(cx + Math.cos(m) * r * 1.1, hy + Math.sin(m) * r * 1.1, cx + Math.cos(b) * r, hy + Math.sin(b) * r); g.closePath();
      }, cx, hy, Math.cos(m), Math.sin(m), 1.5);
    }
    for (const side of [-1, 1]) facet(kit, g, () => { g.beginPath(); poly(g, [[cx + side * r * 0.12, hy - r * 0.08], [cx + side * r * 0.34, hy - r * 0.06], [cx + side * r * 0.3, hy + r * 0.12], [cx + side * r * 0.1, hy + r * 0.14]]); }, cx + side * r * 0.22, hy + r * 0.03, 1, -1, 2);
    boss(kit, g, cx, hy + r * 0.02, r * 0.1);
    glint(kit, g, cx - r * 0.45, hy - r * 0.62, 7, 4);
  } else if (kind === 'quatrefoil') {
    // a moulded ring in four lobes, its ground sunk, and a rosette at its heart: a solid one was a cloud
    const t = Math.max(10, s * 0.085), lobes = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [dx * s * 0.27, dy * s * 0.27, s * (0.25 + R() * 0.04)]);
    const shape = (inset: number) => (): void => {
      g.beginPath();
      for (const [dx, dy, r] of lobes) { g.moveTo(cx + dx + r - inset, cy + dy); g.arc(cx + dx, cy + dy, r - inset, 0, Math.PI * 2); }
      g.moveTo(cx + s * 0.22 - inset, cy); g.arc(cx, cy, s * 0.22 - inset, 0, Math.PI * 2);
    };
    ring(shape(0), shape(t), t);
    glint(kit, g, cx - s * 0.4, cy - s * 0.3, 7, 4);
    centre(s * 0.2, 8);
  } else if (kind === 'lozenge') {
    // no narrower than 1 to 1.4, or it reads as a cross or a blade
    const hw = s * 0.44, hh = s * 0.62, t = Math.max(10, s * 0.1), iw = hw - t, ih = hh - t * 1.4;
    ring(() => { g.beginPath(); poly(g, [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]]); }, () => { g.beginPath(); poly(g, [[cx, cy - ih], [cx + iw, cy], [cx, cy + ih], [cx - iw, cy]]); }, t);
    for (const [px, py] of [[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]]) boss(kit, g, px, py, Math.max(6, s * 0.07), px < cx);
    centre(s * 0.2, 6);
  } else if (kind === 'scroll' || kind === 'crossed') {
    // one leafy stem running the whole length, or two interlaced, cut in two facets and thick enough to read
    const x0 = cx - w / 2, x1 = cx + w / 2, amp = s * 0.3, n = Math.max(2, Math.round(w / (kind === 'crossed' ? 70 : 84))), step = (x1 - x0) / n, lw = Math.max(12, Math.min(18, s * 0.3));
    const at = (x: number, ph: number): number => cy + Math.sin(((x - x0) / step) * Math.PI + ph) * amp * Math.min(1, (x - x0) / 12, (x1 - x) / 12);
    const stem = (ph: number): void => { g.beginPath(); for (let x = x0; x <= x1 + 0.1; x += 3) g.lineTo(x, at(x, ph)); };
    g.lineCap = 'round';
    for (const ph of kind === 'crossed' ? [0, Math.PI] : [0]) {
      g.save(); g.translate(3, 3); stem(ph); g.strokeStyle = PASTEL.reliefLo; g.lineWidth = lw; g.stroke(); g.restore();
      stem(ph); g.strokeStyle = PASTEL.facetShade; g.lineWidth = lw; g.stroke();
      g.save(); g.translate(-lw * 0.18, -lw * 0.18); stem(ph); g.strokeStyle = PASTEL.facetLit; g.lineWidth = lw * 0.5; g.stroke(); g.restore();
      // on a single scroll, a leaf lying along the stem where it crosses its middle, on alternate sides
      if (kind === 'scroll') for (let i = 1; i < n; i++) {
        const lx = x0 + step * i, ly = at(lx, ph), d = at(lx + 3, ph) - at(lx - 3, ph), a = Math.atan2(d, 6), side = i % 2 ? 1 : -1;
        const ox = lx + Math.cos(a) * lw * 1.1 - Math.sin(a) * side * lw * 0.55, oy = ly + Math.sin(a) * lw * 1.1 + Math.cos(a) * side * lw * 0.55;
        facet(kit, g, () => { g.beginPath(); g.ellipse(ox, oy, lw * 1.2, lw * 0.45, a + side * 0.35, 0, Math.PI * 2); }, ox, oy, Math.cos(a + side * 0.35), Math.sin(a + side * 0.35), 2);
      }
    }
    g.lineCap = 'butt';
  } else {
    // a boss, and three husks hung from it, each smaller than the one over it and none quite straight
    const top = cy - h / 2 + 8, hw0 = Math.min(w * 0.42, 26);
    boss(kit, g, cx, top + 10, Math.min(hw0 * 0.5, 11), true);
    let y = top + 28;
    for (let i = 0; i < 3 && y < cy + h / 2 - 20; i++) {
      const k = 1 - i * 0.14, hw = hw0 * k, hh = 22 * k, x = cx + (R() - 0.5) * 3;
      facet(kit, g, () => { g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + hw, y + hh * 0.2, x + hw * 0.7, y + hh * 1.6, x, y + hh * 2); g.bezierCurveTo(x - hw * 0.7, y + hh * 1.6, x - hw, y + hh * 0.2, x, y); }, x, y + hh, 0, 1, 2.5);
      y += hh * 2 + 8;
    }
  }
}

/** The heads a panel's frame is given: a quarter round cut from each corner, a segmental arch, or square with an ear at each top corner. */
type Head = 'notch' | 'arch' | 'ears';

const HEADS: Head[] = ['notch', 'arch', 'ears'];

/** How a panel is chased: with `kind` at `scale` of what it would take, or not at all; `flat` for a fence's plate. */
type Chase = { kind: Motif | null; scale?: number; flat?: boolean };

/**
 * A raised panel of it between (x0, y0) and (x1, y1), standing on the
 * ground, its frame's head `head`: a polished frame, its edges a hand off
 * straight, each face of its bevel lit as it faces -- the sky along the
 * top, the lit side down the left, each with the reflected dark hard
 * inside it, the dark down the right and the lawn along the foot -- and
 * every bevel as wide across as a wall laid narrow needs; its plate, which
 * shows the storey's horizon at `hy`; a pool of tarnish in each of its
 * inside corners; its chasing, a little under half its width; and a glint
 * on the top left of its frame.
 */
function silverPanel(kit: Kit, g: Ctx, R: Rand, x0: number, y0: number, x1: number, y1: number, head: Head, chase: Chase, hy: number): void {
  const { SILVER_INK, PASTEL } = kit;
  const flat = !!chase.flat, n = 4, w = x1 - x0, h = y1 - y0;
  const bv = flat ? BEV_V * 0.8 : BEV_V, bh = flat ? BEV_H * 0.8 : BEV_H, bf = flat ? BEV_FOOT * 0.8 : BEV_FOOT;
  const j = (k = 1): number => (R() - 0.5) * 7 * k;
  const edge = (ax: number, ay: number, bx: number, by: number): Pt[] =>
    Array.from({ length: n + 1 }, (_, i): Pt => [ax + ((bx - ax) * i) / n + (i && i < n ? j(0.9) : 0), ay + ((by - ay) * i) / n + (i && i < n ? j(0.6) : 0)]);
  const c = [[x0 + j(0.4), y0 + j(0.3)], [x1 + j(0.4), y0 + j(0.3)], [x1 + j(0.4), y1 + j(0.3)], [x0 + j(0.4), y1 + j(0.3)]];
  // Each run of the outline and which way it faces: up, left, right or down.
  type Face = 'up' | 'left' | 'right' | 'down';
  const runs: Array<{ pts: Pt[]; face: Face }> = [];
  let rise = 0, gx = x0 + bv * 0.5, gy = y0 + bh * 0.5;
  if (head === 'notch') {
    const rc = Math.min(22, w * 0.13, h * 0.2);
    const notch = (k: number, [ox, oy]: number[]): Pt[] =>
      Array.from({ length: 7 }, (_, i): Pt => { const a = Math.PI + (k * Math.PI) / 2 - (i / 6) * (Math.PI / 2); return [ox + rc * Math.cos(a), oy + rc * Math.sin(a)]; });
    runs.push({ pts: edge(c[0][0] + rc, c[0][1], c[1][0] - rc, c[1][1]), face: 'up' });
    runs.push({ pts: notch(0, c[1]), face: 'up' });
    runs.push({ pts: edge(c[1][0], c[1][1] + rc, c[2][0], c[2][1] - rc), face: 'right' });
    runs.push({ pts: notch(1, c[2]), face: 'right' });
    runs.push({ pts: edge(c[2][0] - rc, c[2][1], c[3][0] + rc, c[3][1]), face: 'down' });
    runs.push({ pts: notch(2, c[3]), face: 'down' });
    runs.push({ pts: edge(c[3][0], c[3][1] - rc, c[0][0], c[0][1] + rc), face: 'left' });
    runs.push({ pts: notch(3, c[0]), face: 'up' });
    gx = x0 + rc + bv * 0.3;
  } else if (head === 'arch') {
    rise = Math.min(w * 0.16, h * 0.18);
    runs.push({ pts: Array.from({ length: 13 }, (_, i): Pt => { const u = i / 12; return [c[0][0] + (c[1][0] - c[0][0]) * u, c[0][1] + rise - rise * Math.sin(Math.PI * u) + (i && i < 12 ? j(0.3) : 0)]; }), face: 'up' });
    runs.push({ pts: edge(c[1][0], c[1][1] + rise, c[2][0], c[2][1]), face: 'right' });
    runs.push({ pts: edge(c[2][0], c[2][1], c[3][0], c[3][1]), face: 'down' });
    runs.push({ pts: edge(c[3][0], c[3][1], c[0][0], c[0][1] + rise), face: 'left' });
    gx = x0 + w * 0.16; gy = y0 + rise * 0.55 + bh * 0.4;
  } else {
    const ew = Math.min(9, GAP * 0.6), eh = Math.min(24, h * 0.25);
    runs.push({ pts: edge(c[0][0] - ew, c[0][1], c[1][0] + ew, c[1][1]), face: 'up' });
    runs.push({ pts: [[c[1][0] + ew, c[1][1]], [c[1][0] + ew, c[1][1] + eh]], face: 'right' });
    runs.push({ pts: [[c[1][0] + ew, c[1][1] + eh], [c[1][0], c[1][1] + eh]], face: 'down' });
    runs.push({ pts: edge(c[1][0], c[1][1] + eh, c[2][0], c[2][1]), face: 'right' });
    runs.push({ pts: edge(c[2][0], c[2][1], c[3][0], c[3][1]), face: 'down' });
    runs.push({ pts: edge(c[3][0], c[3][1], c[0][0], c[0][1] + eh), face: 'left' });
    runs.push({ pts: [[c[0][0], c[0][1] + eh], [c[0][0] - ew, c[0][1] + eh]], face: 'down' });
    runs.push({ pts: [[c[0][0] - ew, c[0][1] + eh], [c[0][0] - ew, c[0][1]]], face: 'left' });
    gx = x0 - ew + bv * 0.5;
  }
  const outline: Pt[] = runs.flatMap((r) => r.pts);
  // its shade on the ground, down and to the right of it
  g.save(); g.translate(5, 5); g.beginPath(); poly(g, outline); g.fillStyle = SILVER_INK; g.fill(); g.restore();
  g.save();
  g.beginPath(); poly(g, outline); g.clip();
  sheen(kit, g, R, x0 - 10, y0 - 10, x1 + 10, y1 + 10, flat ? y0 + h * 0.3 : hy, flat ? PASTEL.plateFlat : PASTEL.plate, bf + (flat ? 8 : 20));
  // tarnish lying in the inside corners of the frame
  for (const [px, py, dx, dy, r] of [[x0 + bv, y0 + bh + rise, 1, 1, 10], [x1 - bv, y0 + bh + rise, -1, 1, 10], [x0 + bv, y1 - bf, 1, -1, 22], [x1 - bv, y1 - bf, -1, -1, 26]]) pool(g, R, px, py, dx, dy, (flat ? 0.55 : 1) * r * (0.85 + R() * 0.3), PASTEL.patina);
  const stroke = (pts: Pt[], col: string, lw: number): void => {
    g.beginPath(); for (const [x, y] of pts) g.lineTo(x, y);
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  };
  g.lineJoin = 'round';
  const across = (f: Face): number => (f === 'left' || f === 'right' ? bv : f === 'up' ? bh : bf);
  for (const r of runs) if (r.face === 'up' || r.face === 'left') stroke(r.pts, PASTEL.core, 2 * (across(r.face) + (r.face === 'left' ? CORE_V : CORE_H)));
  const COL: Record<Face, string> = { up: PASTEL.rim, left: PASTEL.edgeHi, right: PASTEL.edgeLo, down: PASTEL.reflect };
  for (const f of ['down', 'right', 'left', 'up'] as Face[]) for (const r of runs) if (r.face === f) stroke(r.pts, COL[f], 2 * across(f));
  g.restore();
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + rise * 0.35;
  const fw = w - 2 * bv - 10, fh2 = h - bh - bf - rise - 10, k = chase.scale ?? 1;
  if (chase.kind === 'scroll' || chase.kind === 'crossed') motif(kit, g, R, chase.kind, cx, cy, Math.min(fh2 * (flat ? 0.8 : 0.7), 56), fw - 24);
  else if (chase.kind === 'drop') motif(kit, g, R, 'drop', cx, cy, fw, fw, fh2 * 0.62);
  else if (chase.kind) {
    // round work is painted WIDE wider than tall: a little under half the panel across, and a little over half its height
    const [bw, bh2] = MOTIF_BOX[chase.kind];
    const s = Math.min((fw * (flat ? 0.8 : 0.46)) / (WIDE * bw), (fh2 * (flat ? 0.86 : 0.58)) / bh2) * k;
    motif(kit, g, R, chase.kind, cx, cy, s);
  }
  if (!flat) glint(kit, g, gx, gy, 10, 5);
}

/**
 * An Ionic capital over a shaft from `x0` to `x1`, its top at `y`: an
 * abacus turned up at the sky, an echinus in two tones, and a volute at
 * each end in two facets, the one to the light with a glint in its eye.
 * 26 deep. Its spiral cut as a line was a hatching at the game's own zoom.
 */
function ionic(kit: Kit, g: Ctx, x0: number, x1: number, y: number): void {
  const { PASTEL } = kit;
  slab(kit, g, x0 - 9, y, x1 + 9, y + 7, PASTEL.dress, 3);
  g.fillStyle = PASTEL.flankLit; g.fillRect(x0 - 4, y + 7, x1 - x0 + 8, 6);
  g.fillStyle = PASTEL.flankShade; g.fillRect(x0 - 4, y + 13, x1 - x0 + 8, 6);
  g.fillStyle = PASTEL.reflect; g.fillRect(x0 + 2, y + 19, x1 - x0 - 4, 5);
  for (const [vx, i] of [[x0 - 1, 0], [x1 + 1, 1]]) {
    facet(kit, g, () => { g.beginPath(); g.ellipse(vx, y + 15, 9 * WIDE, 9, 0, 0, Math.PI * 2); }, vx, y + 15, 1, -1, 2);
    g.beginPath(); g.ellipse(vx, y + 15, 3.2 * WIDE, 3.2, 0, 0, Math.PI * 2); g.fillStyle = PASTEL.core; g.fill();
    if (i === 0) glint(kit, g, vx - 5, y + 10, 5, 3);
  }
}

/** An Attic base under a shaft from `x0` to `x1`, its foot at `y`: two rolls, each lit over and shaded under, with a hollow between them. 16 high. */
function attic(kit: Kit, g: Ctx, x0: number, x1: number, y: number): void {
  const { PASTEL } = kit;
  const roll = (a: number, b: number, t: number, bot: number): void => {
    g.fillStyle = PASTEL.flankShade; g.fillRect(a, t, b - a, bot - t);
    g.fillStyle = PASTEL.rim; g.fillRect(a, t, b - a, (bot - t) * 0.5);
    g.fillStyle = PASTEL.reflect; g.fillRect(a, bot - (bot - t) * 0.25, b - a, (bot - t) * 0.25);
  };
  roll(x0 - 7, x1 + 7, y - 8, y);
  g.fillStyle = PASTEL.core; g.fillRect(x0 - 3, y - 11, x1 - x0 + 6, 3);
  roll(x0 - 4, x1 + 4, y - 16, y - 11);
}

/**
 * A pilaster's shaft from `x0`, `w` wide and `h` high from `y0`: a lit
 * flank down its left and a shaded one down its right, two flat tones
 * wide enough to read, and three broad flutes, each a channel of the dark
 * with its far side lit and tarnish lying in the foot of it.
 */
function shaft(kit: Kit, g: Ctx, R: Rand, x0: number, y0: number, w: number, h: number): void {
  const { PASTEL } = kit;
  const k = w / PIL;
  const strip = (x: number, a: number, b: number, wd: number, col: string, wob = 1): void => {
    const n = Math.max(2, Math.round((b - a) / 40));
    const l = Array.from({ length: n + 1 }, (_, i): Pt => [x + (i && i < n ? (R() - 0.5) * 2 * wob : 0), a + ((b - a) * i) / n]);
    const r = Array.from({ length: n + 1 }, (_, i): Pt => [x + wd + (i && i < n ? (R() - 0.5) * 2 * wob : 0), a + ((b - a) * i) / n]);
    g.beginPath(); poly(g, [...l, ...r.reverse()]); g.fillStyle = col; g.fill();
  };
  g.fillStyle = PASTEL.shaft; g.fillRect(x0, y0, w, h);
  strip(x0, y0, y0 + h, 20 * k, PASTEL.flankLit);
  strip(x0 + w - 20 * k, y0, y0 + h, 20 * k, PASTEL.flankShade);
  const fa = y0 + 26, fb = y0 + h - 24;
  for (const f of [0.2, 0.46, 0.72]) {
    const fx = x0 + w * f, fw = 7 * k;
    strip(fx, fa, fb, fw, PASTEL.flute, 0.6);
    strip(fx + fw, fa, fb, 3 * k, PASTEL.fluteLit, 0.4);
    g.fillStyle = PASTEL.pool; g.fillRect(fx, fb - (fb - fa) * (0.12 + R() * 0.06), fw, (fb - fa) * (0.12 + R() * 0.06));
  }
  g.fillStyle = PASTEL.edgeLo; g.fillRect(x0 + w - 2, y0, 2, h);
}

/**
 * A fluted pilaster centred on `cx` from `y0` to `y1`: its shaft, its
 * capital and base, and its shade on the bay beside it, deep in a strip
 * right against it and paler past that.
 */
function pilaster(kit: Kit, g: Ctx, R: Rand, cx: number, y0: number, y1: number, w = PIL): void {
  const { PASTEL, SILVER_INK } = kit;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  g.fillStyle = PASTEL.recess; g.fillRect(x1 - 1, y0, 6, y1 - y0);
  g.fillStyle = SILVER_INK; g.fillRect(x1 - 1, y0, PROUD_SIDE * 0.8, y1 - y0);
  shaft(kit, g, R, x0, y0, w, y1 - y0);
  ionic(kit, g, x0, x1, y0);
  attic(kit, g, x0, x1, y1);
}

/**
 * The frieze along the head of a storey, `y0` to `y1`, which the storey
 * over it stands on: a polished band, a fillet along its top turned up at
 * the sky with the reflected dark under it and a broken run of the glint
 * on it, and its underside taking the lawn; and between them egg and dart
 * -- each egg in two facets in a dark cup, painted wide so it stands upright
 * as laid, a glint on its crown of one of three shapes in turn, no two eggs
 * the same width; a dark arrowhead of a dart between each two, tarnish in
 * its pocket -- seven to a section, the same egg on every seam, so the run
 * goes on through them; and under it the band of shade it throws.
 */
function frieze(kit: Kit, g: Ctx, R: Rand, y0: number, y1: number): void {
  const { PASTEL } = kit;
  const h = y1 - y0, my = y0 + h * 0.55, P = TW / EGGS, ry = 14;
  g.fillStyle = PASTEL.cup; g.fillRect(-2, y1, TW + 4, 10);
  g.fillStyle = PASTEL.dress; g.fillRect(-2, y0, TW + 4, h);
  g.fillStyle = PASTEL.rim; g.fillRect(-2, y0, TW + 4, 8);
  g.fillStyle = PASTEL.core; g.fillRect(-2, y0 + 8, TW + 4, 3);
  g.fillStyle = PASTEL.soffit; g.fillRect(-2, y1 - 9, TW + 4, 9);
  whiteRun(kit, g, R, 24, TW - 24, y0 + 1, 5.5);
  for (let i = 0; i <= EGGS; i++) {
    const ex = i * P, dx = (i + 0.5) * P, rx = i === 0 || i === EGGS ? 22 : 22 + (R() - 0.5) * 4, seam = i === 0 || i === EGGS;
    g.beginPath(); g.ellipse(ex + 2, my + 2, rx + 4, ry + 3, 0, 0, Math.PI * 2); g.fillStyle = PASTEL.cup; g.fill();
    facet(kit, g, () => { g.beginPath(); g.ellipse(ex, my, rx, ry, 0, 0, Math.PI * 2); }, ex, my, 1, -0.6, 2.5, PASTEL.ring, PASTEL.facetShade);
    const kind = seam ? 0 : i % 3, gx = ex - rx * 0.42, gy = my - ry * 0.5;
    g.fillStyle = PASTEL.crown;
    if (kind === 0) { g.beginPath(); g.ellipse(gx, gy, 6, 3, -0.3, 0, Math.PI * 2); g.fill(); }
    else if (kind === 1) { g.beginPath(); g.ellipse(gx + 2, gy + 1, 4, 4, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); poly(g, [[gx - 6, gy + 2], [gx + 4, gy - 3], [gx + 6, gy - 1], [gx - 4, gy + 4]]); g.fill(); }
    if (i < EGGS) {
      const lean = (R() - 0.5) * 4;
      g.beginPath(); poly(g, [[dx - 6, my - 14], [dx + lean, my + 14], [dx + 6, my - 14], [dx + lean * 0.4, my - 6]]); g.fillStyle = PASTEL.cup; g.fill();
      g.beginPath(); poly(g, blob(dx + lean, my + 12, 5, 3, 7, R, 0.8, 0.3, 0.3)); g.fillStyle = PASTEL.pool; g.fill();
    }
  }
}

/**
 * The bay layout of a plain face, by variant: one panel the width of the
 * section with a piece of chasing in it, whose kind is the variant's own;
 * the same under a band of interlace; or two narrow panels either side of
 * a pilaster, each with a drop of husks, where the eye can rest. On the
 * game's iso faces a 2 m bay is too narrow for round work to be more than a
 * speck in it, and a pilaster every 2 m a barcode.
 */
const SILVER_LAYOUTS = ['grand', 'pair', 'grand', 'banded', 'grand'] as const;

const GRAND: Motif[] = ['cartouche', 'cartouche', 'quatrefoil', 'rosette', 'shell'];

/** Where a bay's recess and its panels begin and end, `a` to `b` between two pilasters. */
const bayOf = (a: number, b: number): [number, number] => [a + PIL / 2 + GAP, b - PIL / 2 - GAP];

/** The horizon a storey's panels show, by variant: near the same height in all of them, and never exactly, so it rules no line along a street. */
const horizonOf = (v: number): number => PANEL_TOP + 76 + [0, 9, -7, 4, -11][v % 5];

/**
 * The field of a silver wall: the ground it stands on, which shows the
 * same sky and lawn as the panels; its panels; a pilaster at each end --
 * one pilaster shared with the next section, laid alike in both -- and one
 * at the middle where the section is two bays; and the frieze along the
 * head. A face with an opening in it is left without panels: the opening
 * lays its own, clear of its surround.
 */
function paintSilver(kit: Kit, g: Ctx, R: Rand, open: boolean, vi: number): Block[] {
  const { PASTEL, GROUND } = kit;
  const top = FRIEZE, bot = TH, v = Math.max(0, vi), layout = open ? 'open' : SILVER_LAYOUTS[v % SILVER_LAYOUTS.length];
  // an opening lays its own panels, clear of its surround, and they show the horizon every opening's do
  const mid = layout === 'pair', hy = horizonOf(open ? 0 : v);
  sheen(kit, g, R, 0, 0, TW, TH, hy, PASTEL.tarnish, 30, GROUND);
  const [a, b] = bayOf(0, TW), y0 = PANEL_TOP, y1 = PANEL_FOOT, kind = GRAND[v % GRAND.length];
  if (layout === 'grand') silverPanel(kit, g, R, a, y0, b, y1, HEADS[v % 3], { kind }, hy);
  else if (layout === 'banded') {
    silverPanel(kit, g, R, a, y0, b, y0 + 74, 'notch', { kind: 'crossed' }, y0 + 30);
    silverPanel(kit, g, R, a, y0 + 90, b, y1, HEADS[(v + 1) % 3], { kind, scale: 1.1 }, hy + 40);
  } else if (mid) {
    for (const [i, [x0, x1]] of [bayOf(0, XM), bayOf(XM, TW)].entries()) silverPanel(kit, g, R, x0, y0, x1, y1, HEADS[(v + i) % 3], { kind: 'drop' }, hy);
  }
  pilaster(kit, g, R, 0, top, bot); pilaster(kit, g, R, TW, top, bot);
  if (mid) pilaster(kit, g, R, XM, top, bot);
  frieze(kit, g, R, 0, top);
  return [];
}

/**
 * Panels either side of an opening whose surround runs from `a` to `b`,
 * each ended short of it by the ground, and only where there is room for a
 * whole one: a sliver of a panel cut off by a surround is not a panel.
 * Too narrow for anything round, each carries a drop of husks.
 */
function sidePanels(kit: Kit, g: Ctx, R: Rand, a: number, b: number, hy: number): void {
  const [l0, r1] = bayOf(0, TW);
  if (a - GAP - l0 >= 48) silverPanel(kit, g, R, l0, PANEL_TOP, a - GAP, PANEL_FOOT, 'ears', { kind: 'drop' }, hy);
  if (r1 - (b + GAP) >= 48) silverPanel(kit, g, R, b + GAP, PANEL_TOP, r1, PANEL_FOOT, 'ears', { kind: 'drop' }, hy);
}

/**
 * The ground storey's foot: a plinth of it, heavy, so a tall front stands on
 * a base -- a torus rolled along its head, which the pilasters stand on,
 * turned up at the sky with the reflected dark under it and a broken run of
 * the glint along its crown, and a face under that polished to chrome, its
 * horizon level where it meets the next section's and dipping between, so
 * the run does not step at the seams. `R` places the dip and the glint, so
 * each variant has its own.
 */
function silverPlinth(kit: Kit, g: Ctx, y0: number, y1: number, R: Rand = rand(2621)): void {
  const { SILVER_INK, PASTEL } = kit;
  const roll = 16;
  g.fillStyle = SILVER_INK; g.fillRect(-2, y0 - 6, TW + 4, 8);
  slab(kit, g, -8, y0 + roll - 2, TW + 8, y1 + 4, PASTEL.footing, 5);
  mirror(kit, g, R, -8, y0 + roll + 3, TW + 8, y1 - 2);
  g.fillStyle = PASTEL.dress; g.fillRect(-2, y0, TW + 4, roll);
  g.fillStyle = PASTEL.rim; g.fillRect(-2, y0, TW + 4, roll * 0.45);
  g.fillStyle = PASTEL.core; g.fillRect(-2, y0 + roll * 0.45, TW + 4, 2.5);
  g.fillStyle = PASTEL.reflect; g.fillRect(-2, y0 + roll * 0.62, TW + 4, roll * 0.38);
  whiteRun(kit, g, R, 24, TW - 24, y0 + 1, 5);
}

/**
 * A window in it: an eared architrave of polished silver round it, so a
 * window and a panel differ in outline, with a keystone and a cornice over
 * it and a sill under it; an apron panel under the sill; and panels either
 * side, clear of it.
 */
function silverSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, shelf: number): void {
  const { SILVER_INK, PASTEL } = kit;
  const aw = 24, ew = 12, eh = 26, hy = horizonOf(0);
  sidePanels(kit, g, R, x0 - aw - ew, x1 + aw + ew, hy);
  const apron = sill + 30 + shelf;
  if (PANEL_FOOT - apron >= 40) silverPanel(kit, g, R, x0 - aw + 4, apron, x1 + aw - 4, PANEL_FOOT, 'notch', { kind: 'crossed' }, apron + 16);
  g.fillStyle = SILVER_INK; g.fillRect(x1 + aw + ew, head - aw, PROUD_SIDE * 0.8, sill - head + aw + 4);
  // the architrave, and its ears at the head
  slab(kit, g, x0 - aw, head - aw, x1 + aw, sill + 4, PASTEL.dress, 8);
  slab(kit, g, x0 - aw - ew, head - aw, x0 - aw + 8, head + eh, PASTEL.dress, 6);
  slab(kit, g, x1 + aw - 8, head - aw, x1 + aw + ew, head + eh, PASTEL.dress, 6);
  slab(kit, g, x0 - 7, head - 7, x1 + 7, sill + 2, PASTEL.sunk, 3);
  const kc = (x0 + x1) / 2;
  facet(kit, g, () => { g.beginPath(); poly(g, [[kc - 13, head - 30], [kc + 13, head - 30], [kc + 9, head + 2], [kc - 9, head + 2]]); }, kc, head - 14, 0, 1, 3);
  g.fillStyle = SILVER_INK; g.fillRect(x0 - aw - ew - 6, head - aw, x1 - x0 + 2 * (aw + ew + 6), PROUD_SH);
  slab(kit, g, x0 - aw - ew - 6, head - aw - 16, x1 + aw + ew + 6, head - aw, PASTEL.dress, 5);
  g.fillStyle = SILVER_INK; g.fillRect(x0 - aw - 4 - shelf, sill + 18, x1 - x0 + 2 * (aw + 4) + 2 * shelf, PROUD_SH);
  slab(kit, g, x0 - aw - 4 - shelf, sill + 2, x1 + aw + 4 + shelf, sill + 20 + shelf * 0.6, PASTEL.dress, 5);
  whiteRun(kit, g, R, x0 - aw - ew, x1 + aw + ew, head - aw - 15, 5);
  whiteRun(kit, g, R, x0 - aw, x1 + aw, sill + 3, 4);
  glint(kit, g, kc - 7, head - 25, 8, 4);
}

/**
 * A doorway in it: one architrave of polished silver 28 wide down to the
 * ground, a cornice over it with a keystone, stopped short of the panels
 * either side, a rosette in the head of a gate's, and the panels either
 * side, clear of it. A half-pilaster and a doubled architrave either side
 * as well were a barcode at the game's own zoom.
 */
function silverDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number): void {
  const { SILVER_INK, PASTEL } = kit;
  const aw = 28, top = head - deep, hy = horizonOf(0);
  sidePanels(kit, g, R, x0 - aw - 12, x1 + aw + 12, hy);
  g.fillStyle = SILVER_INK; g.fillRect(x1 + aw, top, PROUD_SIDE * 0.8, TH - top);
  slab(kit, g, x0 - aw, top, x1 + aw, TH + 4, PASTEL.dress, 9);
  slab(kit, g, x0 - 7, head - 7, x1 + 7, TH + 4, PASTEL.sunk, 3);
  if (deep > 40) rosette(kit, g, R, (x0 + x1) / 2, head - deep / 2 - 2, Math.min(24, deep * 0.4), 10);
  const kc = (x0 + x1) / 2;
  facet(kit, g, () => { g.beginPath(); poly(g, [[kc - 15, top - 6], [kc + 15, top - 6], [kc + 10, head + 2], [kc - 10, head + 2]]); }, kc, (top + head) / 2, 0, 1, 3);
  const [l0, r1] = bayOf(0, TW);
  const cx0 = Math.max(x0 - aw - 10, l0 + 10), cx1 = Math.min(x1 + aw + 10, r1 - 10);
  g.fillStyle = SILVER_INK; g.fillRect(cx0, top, cx1 - cx0, PROUD_SH);
  slab(kit, g, cx0, top - 18, cx1, top, PASTEL.dress, 6);
  whiteRun(kit, g, R, cx0, cx1, top - 17, 5);
  glint(kit, g, kc - 8, top - 1, 8, 4);
}

/**
 * An archway in it: the jambs, an archivolt of polished silver round the
 * curve, a keystone at its crown, and panels either side, clear of it.
 */
function silverArch(kit: Kit, g: Ctx, R: Rand): void {
  const { PASTEL, SILVER_INK } = kit;
  const w = 22, hy = horizonOf(0);
  sidePanels(kit, g, R, A_CX - A_R - w, A_CX + A_R + w, hy);
  for (const x of [A_CX - A_R - 20, A_CX + A_R]) slab(kit, g, x, A_CY, x + 20, TH + 4, PASTEL.dress, 6);
  const ring = (): void => {
    g.beginPath();
    g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2);
    g.lineTo(A_CX + A_R, A_CY);
    g.arc(A_CX, A_CY, A_R, Math.PI * 2, Math.PI, true);
    g.closePath();
  };
  g.save(); g.translate(0, PROUD_SH); ring(); g.fillStyle = SILVER_INK; g.fill(); g.restore();
  facet(kit, g, ring, A_CX, A_CY, 1, -1, 0, PASTEL.flankLit, PASTEL.dress);
  g.save(); ring(); g.clip();
  g.beginPath(); g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = PASTEL.rim; g.stroke();
  g.beginPath(); g.arc(A_CX, A_CY, A_R + w - 5.5, Math.PI, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = PASTEL.core; g.stroke();
  g.beginPath(); g.arc(A_CX, A_CY, A_R, Math.PI, Math.PI * 2); g.lineWidth = 9; g.strokeStyle = PASTEL.reflect; g.stroke();
  g.restore();
  const ky = A_CY - A_R - w;
  facet(kit, g, () => { g.beginPath(); poly(g, [[A_CX - 14, ky - 8], [A_CX + 14, ky - 8], [A_CX + 9, ky + w + 4], [A_CX - 9, ky + w + 4]]); }, A_CX, ky + w / 2, 0, 1, 3);
  glint(kit, g, A_CX - 8, ky - 3, 8, 4);
}

/**
 * The pilaster a silver wall is finished with at a corner or a stopped
 * end, over the face carried round it: polished, its outer edge off the
 * picture so the two faces of a corner meet on it, its capital and base.
 */
function silverCorner(kit: Kit, h: number, capital = true): HTMLCanvasElement {
  const w = 64, c = cnv(w, h), g = ctxOf(c);
  shaft(kit, g, rand(2633), 0, 0, w, h);
  if (capital) ionic(kit, g, 0, w, 0);
  attic(kit, g, 0, w, h);
  return c;
}

/** What a fence's long panel is chased with, by variant: a leafy running scroll or an interlace, which a fence's height carries; and a half wall's. */
const FENCE_MOTIFS: Motif[] = ['scroll', 'crossed', 'scroll', 'crossed', 'crossed'];

const HALF_MOTIFS: Motif[] = ['rosette', 'shell', 'quatrefoil', 'cartouche', 'lozenge'];

/**
 * A garden wall of it: a cap moulding along its head turned up at the sky;
 * a long panel chased with the variant's work and a short plain one,
 * either side of a pilaster, their order turned about from variant to
 * variant, so a run of it has a beat and is not ruled off in equal plates;
 * a pilaster at each end; and a plinth of it at the foot. A rosette small
 * enough to fit the short one was a speck, two side by side a pair, and a
 * lozenge with a boss at each point a cluster of dots.
 */
function lowSilver(kit: Kit, g: Ctx, R: Rand, fh: number, vi: number): Block[] {
  const { PASTEL, GROUND, SILVER_INK } = kit;
  const sole = fh - LOW_FOOT, cap = 22, v = Math.max(0, vi), split = TW * (v % 2 ? 0.6 : 0.4);
  const p0 = cap + 12, p1 = sole - 10;
  sheen(kit, g, R, 0, 0, TW, fh, p0 + (p1 - p0) * 0.3, PASTEL.tarnish, 14, GROUND);
  const set = sole - cap - 30 > 90 ? HALF_MOTIFS : FENCE_MOTIFS;
  for (const [i, [a, b]] of ([[PIL / 2, split - PIL / 2], [split + PIL / 2, TW - PIL / 2]] as Array<[number, number]>).entries()) {
    const long = b - a > TW * 0.4, head = HEADS[(v + i) % 3] === 'arch' ? 'notch' : HEADS[(v + i) % 3];
    silverPanel(kit, g, R, a + 12, p0, b - 12, p1, head, { kind: long ? set[v % set.length] : null, flat: true }, 0);
  }
  pilaster(kit, g, R, 0, cap, sole); pilaster(kit, g, R, TW, cap, sole); pilaster(kit, g, R, split, cap, sole);
  g.fillStyle = SILVER_INK; g.fillRect(-2, cap, TW + 4, PROUD_SH);
  slab(kit, g, -8, 0, TW + 8, cap, PASTEL.dress, 6);
  whiteRun(kit, g, R, 24, TW - 24, 1, 4);
  silverPlinth(kit, g, sole, fh, R);
  return [];
}

/** The end of a silver wall is the side of its pilaster, the frieze over it. */
function silverEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  const { PASTEL } = kit;
  g.drawImage(silverCorner(kit, TH, false), 0, 0, Wc, TH);
  g.fillStyle = PASTEL.dress; g.fillRect(0, 0, Wc, FRIEZE);
  g.fillStyle = PASTEL.rim; g.fillRect(0, 0, Wc, 6);
  g.fillStyle = PASTEL.soffit; g.fillRect(0, FRIEZE - 7, Wc, 7);
  g.fillStyle = hexA(PASTEL.line, 0.8); g.fillRect(0, FRIEZE - 1.5, Wc, 1.5);
}

/** A silver wall's ground storey at its end: the pilaster's side on the plinth. */
function silverEndsFoot(kit: Kit, g: Ctx, R: Rand, Wc: number, y0: number, ends: HTMLCanvasElement): void {
  g.drawImage(ends, 0, 0);
  g.save(); g.beginPath(); g.rect(0, 0, Wc, TH); g.clip();
  silverPlinth(kit, g, y0, TH);
  g.restore();
}

/** The end of a low silver wall: the side of its pilaster, the cap moulding over it, on the plinth. */
function silverLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number): void {
  const { PASTEL } = kit;
  const sole = fh - LOW_FOOT;
  g.drawImage(silverCorner(kit, sole, false), 0, 0, Wc, sole);
  slab(kit, g, -8, 0, Wc + 8, 22, PASTEL.dress, 5);
  g.save(); g.beginPath(); g.rect(0, 0, Wc, fh); g.clip();
  silverPlinth(kit, g, sole, fh);
  g.restore();
}

/**
 * A pier either side of the way through a low silver wall, as wide as the
 * wall between the gap and the pilaster at the end, so no sliver of a panel
 * is left standing between them; the cap moulding run on over it, cut to the wall.
 */
function silverGate(kit: Kit, g: Ctx, R: Rand, fh: number, gx0: number, gx1: number): void {
  const { PASTEL } = kit;
  const sole = fh - LOW_FOOT;
  g.save();
  g.beginPath(); g.rect(0, -PROUD, gx0, fh + PROUD); g.rect(gx1, -PROUD, TW - gx1, fh + PROUD); g.clip();
  pilaster(kit, g, R, (PIL / 2 + gx0) / 2, 22, sole, gx0 - PIL / 2); pilaster(kit, g, R, (gx1 + TW - PIL / 2) / 2, 22, sole, TW - PIL / 2 - gx1);
  slab(kit, g, -8, 0, TW + 8, 22, PASTEL.dress, 5);
  g.restore();
}

function silverPost(kit: Kit): NonNullable<Masonry['post']> {
  return { img: silverCorner(kit, TH), reach: PIL / 2, free: true };
}

function silverLowPost(kit: Kit, fh: number): NonNullable<Low['post']> {
  return { img: silverCorner(kit, fh - LOW_FOOT), foot: LOW_FOOT };
}

/** Silver and gold: worked metal throughout, chased panels between fluted pilasters. */
export const GILD_LAY: Lay = {
  courses: (kit, g, R, crests, open, vi) => paintSilver(kit, g, R, open, vi),
  arch: silverArch,
  surround: (kit, g, R, x0, x1, head, sill, wide, shelf) => silverSurround(kit, g, R, x0, x1, head, sill, shelf),
  doorway: silverDoorway,
  foot: (kit, g, R) => silverPlinth(kit, g, TH - kit.S.plinth, TH, R),
  cap: flatCap,
  ends: silverEnds,
  endsFoot: silverEndsFoot,
  lowCourses: (kit, g, R, fh, rows, vi) => lowSilver(kit, g, R, fh, vi),
  lowCap: flatLowCap,
  lowEnds: silverLowEnds,
  gateAfter: silverGate,
  gateCapPier: stoneCapPier,
  lowPost: silverLowPost,
  post: silverPost,
  under: dressUnder,
  head: FRIEZE,
  wrap: true,
  scatter: true,
  handed: true,
  gleam: true,
};
