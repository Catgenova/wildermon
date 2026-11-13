import { PROUD } from './coping';
import { CAP_H, TH, TW, blob, channels, cnv, ctxOf, hexA, hexOf, lighten, poly, rand } from './draw';
import type { Kit } from './kit';
import { stoneCapPier } from './laid';
import { A_CX, A_CY, A_R } from './openings';
import type { Block, Ctx, Lay, Low, Masonry, Pt, Rand } from './types';

/**
 * Timbercraft: an oak frame pegged together on a stone footing, its panels limewashed.
 */

/**
 * How thick the frame's members are -- a post, the rails over and under an
 * opening, a brace -- and the plate at a storey's head and the sole the
 * ground storey stands on.
 *
 * Wider than life across. A face seen from a diagonal is laid at about two
 * thirds of its width, and at the true widths a post came out thinner on
 * screen than the rail it carried: a white box ruled in brown lines rather
 * than a frame with the weight on its posts.
 */
const POST = 48, RAIL = 28, BRACE = 30, PLATE = 28, SOLE = 24;

/** Where the middle post stands: the same in every section, so it stands over the one in the storey below. */
export const XM = TW / 2;

/**
 * The shade a member standing proud of the limewash throws on it: hard-edged
 * and a chalky lilac, two hands wide down the side of a post away from the
 * light and a hand deep under a plate, so on screen the frame stands three
 * or four pixels off the wall. At a finger it was under a pixel, and near
 * grey, it read as an outline rather than as depth.
 */
export const PROUD_SH = 11, PROUD_SIDE = 16, PROUD_INK = 'rgba(72, 66, 156, 0.3)';

/** How far a post's edge wanders off true over its height, and a rail's over its length. */
const WANDER_POST = 4.5, WANDER_RAIL = 1.2;

/** The jambs of an opening: lighter than the frame's own posts, which stay the heaviest thing standing in it. */
const JAMB = 32;

/**
 * One member of the frame: a squared oak baulk of its own oak, its grain two
 * long broken strokes down its length with a check or two opened in it, and
 * the ink round it every member is drawn in. A post's edges wander a hand
 * off true over the storey, each its own way; the light down its left edge
 * swells and narrows along it, as a painter's stroke does, and its right
 * edge is dark, the light being on the left of every picture. A rail runs
 * truer, lit along its top and dark along its underside. `across` is a
 * member that runs over a section's seams: its edges come true at both
 * ends, it takes the frame's own oak, so it arrives at a seam where the next
 * section's leaves it. `edges` is false for a member whose sides are the
 * light of two faces, the renderer's to give.
 */
export function member(kit: Kit, g: Ctx, x0: number, y0: number, x1: number, y1: number, R: Rand, across = false, edges = true): void {
  const { FRAME_OAK, OAKS, TONES, PASTEL } = kit;
  const w = x1 - x0, h = y1 - y0, flat = w > h;
  const len = flat ? w : h;
  const n = Math.max(1, Math.round(len / (flat ? 60 : 96))), amp = flat ? WANDER_RAIL : WANDER_POST;
  const wob = (i: number): number => (across && (i === 0 || i === n) ? 0 : (R() - 0.5) * 2 * amp);
  // Its two long edges, each a hand off true: the top and the underside of
  // a rail, the left and the right of a post.
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    if (flat) { a.push([x0 + w * u, y0 + wob(i)]); b.push([x0 + w * u, y1 + wob(i)]); }
    else { a.push([x0 + wob(i), y0 + h * u]); b.push([x1 + wob(i), y0 + h * u]); }
  }
  const pts: Pt[] = [...a, ...b.slice().reverse()];
  /** A band along one edge, in from it by `d(i)` at each of its points. */
  const band = (edge: Pt[], d: (i: number) => number): Pt[] =>
    [...edge, ...edge.map(([x, y], i): Pt => (flat ? [x, y + d(i)] : [x + d(i), y])).reverse()];
  const body = across ? FRAME_OAK : OAKS[Math.floor(R() * OAKS.length)];
  const T = TONES.dress;
  const light = lighten(body, 8), dark = T.shade;
  g.save();
  g.beginPath(); poly(g, pts); g.fillStyle = body; g.fill(); g.clip();
  if (flat) {
    g.beginPath(); poly(g, band(a, () => Math.min(7, h * 0.28))); g.fillStyle = hexA(light, 0.9); g.fill();
    g.beginPath(); poly(g, band(b, () => -Math.min(7, h * 0.28))); g.fillStyle = dark; g.fill();
  } else if (edges) {
    const lit = a.map(() => Math.min(w * 0.34, 4 + R() * 12)), dim = b.map(() => Math.min(w * 0.2, 5 + R() * 4));
    g.beginPath(); poly(g, band(a, (i) => lit[i])); g.fillStyle = hexA(light, 0.9); g.fill();
    g.beginPath(); poly(g, band(b, (i) => -dim[i])); g.fillStyle = dark; g.fill();
  }
  // The grain: two long strokes, broken where a check has opened.
  const GR = across ? rand(Math.round(y0 * 7 + x1)) : R;
  g.strokeStyle = hexA(T.shade, 0.8); g.lineWidth = 1.3; g.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const at = 0.34 + 0.32 * i + (GR() - 0.5) * 0.08;
    let s = (flat ? x0 : y0) + GR() * 20;
    const end = flat ? x1 : y1;
    while (s < end) {
      const e = Math.min(end, s + 40 + GR() * 80);
      g.beginPath();
      if (flat) { g.moveTo(s, y0 + h * at); g.lineTo(e, y0 + h * at + (GR() - 0.5) * 2); }
      else { g.moveTo(x0 + w * at, s); g.lineTo(x0 + w * at + (GR() - 0.5) * 2, e); }
      g.stroke();
      s = e + 10 + GR() * 26;
    }
  }
  // A check or two, where the oak has split as it dried: dark, and long
  // enough to be seen.
  if (!flat && edges) {
    g.strokeStyle = hexA(PASTEL.line, 0.75); g.lineWidth = 2.2;
    for (let i = 0, k = 1 + (R() < 0.5 ? 1 : 0); i < k; i++) {
      const cx = x0 + w * (0.45 + R() * 0.3), cy = y0 + h * (0.12 + R() * 0.7), cl = 20 + R() * 30;
      g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + (R() - 0.5) * 4, cy + cl / 2, cx + (R() - 0.5) * 3, cy + cl); g.stroke();
    }
  }
  g.lineCap = 'butt';
  g.restore();
  g.beginPath(); poly(g, pts);
  g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.7; g.lineJoin = 'round'; g.stroke();
}

/**
 * Where a member stands proud of the limewash, the shade it throws there:
 * under a rail, and down the side of a post away from the light. It starts
 * under the member, as far as the member's edge can wander, so that where
 * the edge comes in the shade comes with it and no limewash shows between.
 */
export function proud(g: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  g.fillStyle = PROUD_INK;
  if (x1 - x0 > y1 - y0) g.fillRect(x0, y1 - WANDER_RAIL - 1, x1 - x0, PROUD_SH + WANDER_RAIL + 1);
  else g.fillRect(x1 - WANDER_POST - 1, y0, PROUD_SIDE + WANDER_POST + 1, y1 - y0);
}

/**
 * A brace's four corners, from one joint to the other and a brace's width
 * on past each, for the bay it stands in to cut off plumb against a post
 * and level under a plate.
 */
function braceAt(ax: number, ay: number, bx: number, by: number, R: Rand): Pt[] {
  const l = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / l, uy = (by - ay) / l;
  const nx = -uy * (BRACE / 2), ny = ux * (BRACE / 2);
  const [sx, sy, ex, ey] = [ax - ux * BRACE, ay - uy * BRACE, bx + ux * BRACE, by + uy * BRACE];
  const j = (): number => (R() - 0.5) * 2;
  return [[sx + nx + j(), sy + ny + j()], [ex + nx + j(), ey + ny + j()], [ex - nx + j(), ey - ny + j()], [sx - nx + j(), sy - ny + j()]];
}

/**
 * A brace: the same oak as the posts on the slant from one joint to
 * another, cut to the bay it stands in -- plumb against the post and level
 * under the plate, as it is housed in them -- its upper edge lit and its
 * lower in shade, and its shade on the limewash down and away from the
 * light, as a post's is. Drawn a step darker than the posts and lit along
 * its underside, it was a line of ink across the panel.
 */
function brace(kit: Kit, g: Ctx, pts: Pt[], bay: [number, number, number, number]): void {
  const { TONES, PASTEL } = kit;
  const T = TONES.dress, [bx0, by0, bx1, by1] = bay;
  g.save();
  g.beginPath(); g.rect(bx0, by0, bx1 - bx0, by1 - by0); g.clip();
  g.save(); g.translate(PROUD_SIDE * 0.6, PROUD_SH * 0.8); g.beginPath(); poly(g, pts); g.fillStyle = PROUD_INK; g.fill(); g.restore();
  g.beginPath(); poly(g, pts); g.fillStyle = T.lit; g.fill();
  g.save(); g.clip();
  // Which long edge is the upper: [0]-[1] or [3]-[2].
  const [p0, p1, p2, p3] = pts;
  const upper = (p0[1] + p1[1]) < (p3[1] + p2[1]);
  const [u0, u1, l0, l1] = upper ? [p0, p1, p3, p2] : [p3, p2, p0, p1];
  const ln = Math.hypot(l0[0] - u0[0], l0[1] - u0[1]), dx = (l0[0] - u0[0]) / ln, dy = (l0[1] - u0[1]) / ln;
  g.beginPath(); poly(g, [u0, u1, [u1[0] + dx * 7, u1[1] + dy * 7], [u0[0] + dx * 7, u0[1] + dy * 7]]);
  g.fillStyle = hexA(lighten(T.lit, 8), 0.9); g.fill();
  g.beginPath(); poly(g, [l0, l1, [l1[0] - dx * 6, l1[1] - dy * 6], [l0[0] - dx * 6, l0[1] - dy * 6]]);
  g.fillStyle = T.shade; g.fill();
  g.restore();
  g.beginPath(); poly(g, pts);
  g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.7; g.lineJoin = 'round'; g.stroke();
  g.restore();
}

/** A peg through a joint: a dark round end with a pale rim on its upper side. */
function peg(kit: Kit, g: Ctx, x: number, y: number): void {
  const { PASTEL, TONES } = kit;
  g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fillStyle = hexA(PASTEL.line, 0.8); g.fill();
  g.beginPath(); g.arc(x, y - 0.9, 1.3, Math.PI, Math.PI * 2); g.strokeStyle = hexA(TONES.dress.hi, 0.7); g.lineWidth = 0.9; g.stroke();
}

/**
 * The splash and the dirt along the foot of the ground storey, from `x0` to
 * `x1` over `y1`: a tide mark, ragged, higher where the rain threw it up and
 * lower between. Only there: on the storeys over it no splash reaches.
 */
function splash(g: Ctx, R: Rand, x0: number, x1: number, y1: number): void {
  const n = Math.max(3, Math.round((x1 - x0) / 18)), hs: number[] = [];
  for (let i = 0; i <= n; i++) hs.push(12 + R() * 22);
  const sm = hs.map((v, i) => (v * 2 + (hs[i - 1] ?? v) + (hs[i + 1] ?? v)) / 4);
  const edge: Pt[] = sm.map((v, i): Pt => [x0 + ((x1 - x0) * i) / n, y1 - v]);
  g.beginPath(); poly(g, [[x0, y1 + 2], ...edge, [x1, y1 + 2]]);
  g.fillStyle = 'rgba(150, 118, 86, 0.14)'; g.fill();
  g.beginPath(); poly(g, [[x0, y1 + 2], ...edge.map(([x, y]): Pt => [x, y1 - (y1 - y) * 0.45]), [x1, y1 + 2]]);
  g.fillStyle = 'rgba(128, 100, 78, 0.1)'; g.fill();
}

/** On a low wall, which the rain reaches all of: two or three splashes along the foot of a bay, a hand high at most and none alike. */
function splashes(g: Ctx, R: Rand, x0: number, x1: number, y1: number): void {
  for (let i = 0, k = 2 + (R() < 0.5 ? 1 : 0); i < k; i++) {
    const w = 22 + R() * 46, cx = x0 + (x1 - x0) * ((i + 0.2 + R() * 0.6) / k), h = 5 + R() * 7;
    g.beginPath(); poly(g, blob(cx, y1 - h / 2 + 1, w / 2, h / 2 + 1, 10, R, 0.8, 0.35, 0.25));
    g.fillStyle = 'rgba(150, 118, 86, 0.2)'; g.fill();
  }
}

/**
 * The coats a bay of limewash can be laid in: a step or two either side of
 * the wash's own tone in value and in warmth, as a day's mixing comes out.
 * `[lightness, warmth]`: warmth takes red up and blue down.
 */
export const COATS: Array<[number, number]> = [[0, 0], [3, 1], [-3.2, -1], [1.2, 5], [-1.4, -5], [2.4, -4], [-2.2, 4]];

/** A coat's colour. */
function coatOf(kit: Kit, [dl, warm]: [number, number]): string {
  const { PASTEL } = kit;
  const [r, gg, b] = channels(lighten(PASTEL.stone, dl));
  return hexOf([r + warm, gg, b - warm]);
}

/** The coats of the bays of one section, by a hash: none the same as the one beside it. */
function coats(kit: Kit, R: Rand, n: number): string[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let c = Math.floor(R() * COATS.length);
    if (i > 0 && c === out[i - 1]) c = (c + 1 + Math.floor(R() * (COATS.length - 1))) % COATS.length;
    out.push(c);
  }
  return out.map((c) => coatOf(kit, COATS[c]));
}

/**
 * A bay's limewash, its own flat coat, with a mark or two in it cut by
 * hand: a patch limed again, fresher and paler, a palm to an arm across; or
 * a patch worn back to the daub against the timber, where hands and weather
 * catch the edge of a panel. Each is a step off the coat and no more, so the
 * frame is still what is seen first. Every bay the same flat cream, with a
 * faint cloud in it, read as graph paper.
 */
function limewash(g: Ctx, R: Rand, x0: number, y0: number, x1: number, y1: number, coat: string, inset: [number, number, number, number]): void {
  const w = x1 - x0, h = y1 - y0;
  g.save();
  g.beginPath(); g.rect(x0, y0, w, h); g.clip();
  g.fillStyle = coat; g.fillRect(x0, y0, w, h);
  // The bay as it shows between the members that frame it.
  const [ix0, iy0, ix1, iy1] = inset, iw = ix1 - ix0, ih = iy1 - iy0;
  const marks = 1 + (R() < 0.55 ? 1 : 0);
  for (let i = 0; i < marks; i++) {
    if (R() < 0.6) {
      const mw = Math.min(iw * 0.8, 40 + R() * 80), mh = Math.min(ih * 0.6, mw * (0.45 + R() * 0.4));
      const cx = ix0 + mw / 2 + R() * Math.max(0, iw - mw), cy = iy0 + mh / 2 + R() * Math.max(0, ih - mh);
      g.beginPath(); poly(g, blob(cx, cy, mw / 2, mh / 2, 14, R, 0.8, 0.3, 0.14));
      g.fillStyle = lighten(coat, 2.6); g.fill();
    } else {
      const mw = 15 + R() * 25, mh = mw * (0.8 + R() * 1.4), side = Math.floor(R() * 3);
      const cx = side === 0 ? ix0 + mw * 0.3 : side === 1 ? ix1 - mw * 0.3 : ix0 + mw + R() * Math.max(0, iw - 2 * mw);
      const cy = side === 2 ? iy0 + mh * 0.3 : iy0 + mh / 2 + R() * Math.max(0, ih - mh);
      const [r, gg, b] = channels(lighten(coat, -3.2));
      g.beginPath(); poly(g, blob(cx, cy, mw / 2, mh / 2, 12, R, 0.75, 0.35, 0.2));
      g.fillStyle = hexOf([r + 2, gg - 1, b - 6]); g.fill();
    }
  }
  g.restore();
}

/**
 * The bracing of a plain face, by variant: none on most of them, and on two
 * a single brace in the left bay, rising from the end post to the head of
 * the middle post or falling from the head of the end post to the middle
 * post. A brace in every bay and a rail across every storey was a lattice
 * -- more timber than wall -- and the frame is read by its posts, its
 * plates and the odd brace keeping it square. In the left bay only, so no
 * post ever takes a brace from both sides: two of them meeting on one post
 * from sections either side of it were a chevron, and read as ornament.
 */
const FIGURES = ['plain', 'rise', 'plain', 'fall', 'plain'] as const;

/** How far down its post a brace's foot is let in, as a share of the storey under the plate. */
const BRACE_DROP = 0.62;

/**
 * The field of a frame.
 *
 * Two bays of limewash to a section, between a post at each end and one in
 * the middle, under the plate along the storey's head. There is no sole
 * along its foot: a storey stands on the plate of the one under it, so a
 * floor is one beam across the wall rather than two, and the ground storey
 * stands on the sole the foot lays along the footing. On two variants in
 * five a brace crosses the left bay between the head of one of its posts
 * and the other post, let in a little over a third of the way down it. The
 * middle post is at the middle of every section, a hand wider or narrower
 * than the next, so it stands over the one in the storey below; the posts
 * at a section's ends are one post shared with the next section, laid from
 * one seed; and the plate runs straight through every seam. Each bay's
 * limewash goes on under the posts either side of it, so a post's edge can
 * wander off true without showing anything but limewash behind it.
 *
 * `open` is a section an opening will be cut in, which keeps its middle
 * clear for the opening's own posts and rails, and `vi` the variant a plain
 * face is.
 */
function paintFrame(kit: Kit, g: Ctx, R: Rand, open: boolean, vi: number): Block[] {
  const { PASTEL } = kit;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, TW, TH);
  const e = POST / 2, m = open ? 0 : e + (R() - 0.5) * 12;
  const bays: Array<[number, number]> = open ? [[0, TW]] : [[0, XM], [XM, TW]];
  const coat = coats(kit, R, bays.length);
  bays.forEach(([a, b], i) => limewash(g, R, a, PLATE, b, TH, coat[i], [a === 0 ? e : XM + m, PLATE, b === TW ? TW - e : XM - m, TH]));
  const figure = open ? null : FIGURES[(vi < 0 ? Math.floor(R() * FIGURES.length) : vi) % FIGURES.length];
  const foot = PLATE + (TH - PLATE) * BRACE_DROP;
  const bay: [number, number, number, number] = [e - WANDER_POST - 1, PLATE - 3, XM - m + WANDER_POST + 1, TH + 4];
  if (figure === 'rise') brace(kit, g, braceAt(e, foot, XM - m, PLATE, R), bay);
  if (figure === 'fall') brace(kit, g, braceAt(e, PLATE, XM - m, foot, R), bay);
  // The members, each over the shade it throws.
  const posts: Array<[number, number, Rand]> = [[-e, e, rand(1753)], [TW - e, TW + e, rand(1753)]];
  if (!open) posts.push([XM - m, XM + m, R]);
  for (const [a, b] of posts) proud(g, a, PLATE, b, TH);
  proud(g, -6, 0, TW + 6, PLATE);
  for (const [a, b, RR] of posts) member(kit, g, a, PLATE - 2, b, TH + 2, RR);
  member(kit, g, -6, 0, TW + 6, PLATE, rand(1747), true);
  // Pegs through the joints of the plate with the posts, one on each post
  // head: the posts at the ends are shared, so theirs is half in this
  // picture and half in the next, and a pair of them no longer marks
  // every seam.
  for (const x of open ? [0, TW] : [0, XM, TW]) peg(kit, g, x, PLATE / 2 + 1);
  return [];
}

/**
 * A window in a frame: a post either side of it from the plate to the foot
 * of the storey, a rail over it and a sill rail under it standing out to
 * throw the rain clear, with the hard shade it throws -- the opening is
 * framed, not cut.
 */
function frameSurround(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, sill: number, shelf: number): void {
  const sy = sill + RAIL - 2 + shelf * 0.6;
  proud(g, x0 - JAMB, PLATE, x0, TH); proud(g, x1, PLATE, x1 + JAMB, TH);
  proud(g, x0 - JAMB, head - RAIL, x1 + JAMB, head);
  member(kit, g, x0 - JAMB, PLATE - 2, x0, TH + 2, R);
  member(kit, g, x1, PLATE - 2, x1 + JAMB, TH + 2, R);
  member(kit, g, x0 - JAMB, head - RAIL, x1 + JAMB, head, R);
  g.fillStyle = PROUD_INK; g.fillRect(x0 - JAMB - 8 - shelf, sy - 2, x1 - x0 + 2 * JAMB + 16 + 2 * shelf, PROUD_SH);
  member(kit, g, x0 - JAMB - 8 - shelf, sill, x1 + JAMB + 8 + shelf, sy, R);
  peg(kit, g, x0 - JAMB / 2, head - RAIL / 2); peg(kit, g, x1 + JAMB / 2, head - RAIL / 2);
}

/**
 * A doorway in it: posts either side from the plate to the ground and a
 * head over the way through, a gate's the deeper. No knee braces under a
 * gate's head: they stand in the opening, which is cut out of the picture
 * after, and all that was left of them was a stub either side.
 */
function frameDoorway(kit: Kit, g: Ctx, R: Rand, x0: number, x1: number, head: number, deep: number): void {
  proud(g, x0 - JAMB, PLATE, x0, TH); proud(g, x1, PLATE, x1 + JAMB, TH);
  proud(g, x0 - JAMB, head - deep + 4, x1 + JAMB, head);
  member(kit, g, x0 - JAMB, PLATE - 2, x0, TH, R);
  member(kit, g, x1, PLATE - 2, x1 + JAMB, TH, R);
  member(kit, g, x0 - JAMB, head - deep + 4, x1 + JAMB, head, R);
  peg(kit, g, x0 - JAMB / 2, head - deep / 2); peg(kit, g, x1 + JAMB / 2, head - deep / 2);
}

/** An archway in it: the posts, and the head bent round the curve as one piece of oak. */
function frameArch(kit: Kit, g: Ctx, R: Rand): void {
  const { TONES, PASTEL } = kit;
  proud(g, A_CX - A_R - JAMB, PLATE, A_CX - A_R, TH); proud(g, A_CX + A_R, PLATE, A_CX + A_R + JAMB, TH);
  member(kit, g, A_CX - A_R - JAMB, PLATE - 2, A_CX - A_R, TH, R);
  member(kit, g, A_CX + A_R, PLATE - 2, A_CX + A_R + JAMB, TH, R);
  const T = TONES.dress, w = RAIL;
  const ring = (): void => {
    g.beginPath();
    g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2);
    g.lineTo(A_CX + A_R, A_CY);
    g.arc(A_CX, A_CY, A_R, Math.PI * 2, Math.PI, true);
    g.closePath();
  };
  g.save(); g.translate(0, PROUD_SH); ring(); g.fillStyle = PROUD_INK; g.fill(); g.restore();
  ring(); g.fillStyle = T.lit; g.fill();
  g.save(); ring(); g.clip();
  g.beginPath(); g.arc(A_CX, A_CY, A_R + w, Math.PI, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = hexA(T.hi, 0.85); g.stroke();
  g.beginPath(); g.arc(A_CX, A_CY, A_R, Math.PI, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = hexA(T.shade, 0.9); g.stroke();
  g.restore();
  ring(); g.strokeStyle = hexA(PASTEL.line, 0.8); g.lineWidth = 1.7; g.stroke();
}

/**
 * The footing a frame stands on: field stone laid flat on its bed, as a
 * waller lays it -- some stones the height of the course and some two
 * courses of smaller ones, their faces cut roughly square, in five tones of
 * it from warm to cool, each with the light along its top -- in the dark of
 * wet stone, its joints darker again. The stones across a seam are laid from
 * their own seed, so the footing runs on into the next section's. Rounded
 * pills of one height in two greys read as a course of cobbles.
 */
export function footing(kit: Kit, g: Ctx, R: Rand, y0: number, y1: number): void {
  const { PASTEL, TONES } = kit;
  const h = y1 - y0, top = y0 + 7;
  const [fr, fg, fb] = channels(PASTEL.footing);
  const tones = [PASTEL.footing, lighten(PASTEL.footing, 3.5), lighten(PASTEL.footing, -3.5), hexOf([fr - 13, fg - 16, fb - 24]), hexOf([fr - 27, fg - 22, fb - 14])];
  g.fillStyle = PASTEL.ringJoint; g.fillRect(0, y0, TW, h);
  /** One stone, its corners knocked off and its faces a hand off square. */
  const stone = (x: number, y: number, w: number, sh: number, RR: Rand): void => {
    const c = (): number => 1.5 + RR() * 4, j = (): number => (RR() - 0.5) * 2;
    const pts: Pt[] = [
      [x + c(), y + j()], [x + w - c(), y + j()], [x + w + j(), y + c()], [x + w + j(), y + sh - c()],
      [x + w - c(), y + sh + j()], [x + c(), y + sh + j()], [x + j(), y + sh - c()], [x + j(), y + c()],
    ];
    const tone = tones[Math.floor(RR() * tones.length)];
    g.save();
    g.beginPath(); poly(g, pts); g.fillStyle = tone; g.fill(); g.clip();
    g.fillStyle = lighten(tone, 9); g.fillRect(x - 2, y - 3, w + 4, 6 + RR() * 2);
    g.fillStyle = hexA(PASTEL.ringJoint, 0.5); g.fillRect(x - 2, y + sh - 3, w + 4, 4);
    g.restore();
    g.beginPath(); poly(g, pts); g.strokeStyle = hexA(PASTEL.line, 0.85); g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke();
  };
  const lay = (x: number, w: number, RR: Rand): void => {
    const room = y1 - 1 - top;
    if (w > 34 && RR() < 0.4) {
      // two courses of smaller stones
      const lo = room * (0.45 + RR() * 0.15), w2 = w * (0.55 + RR() * 0.4);
      stone(x + 1, y1 - 1 - lo, w - 3, lo, RR);
      stone(x + 1 + RR() * (w - w2), top, w2 - 3, room - lo - 3, RR);
    } else {
      const sh = room * (0.78 + RR() * 0.22);
      stone(x + 1, y1 - 1 - sh, w - 3, sh, RR);
    }
  };
  const seamW = 44;
  lay(-seamW / 2, seamW, rand(2311));
  lay(TW - seamW / 2, seamW, rand(2311));
  let x = seamW / 2;
  while (x < TW - seamW / 2 - 20) {
    const w = Math.min(TW - seamW / 2 - x, 30 + R() * 50);
    lay(x, w, R);
    x += w;
  }
  const wet = g.createLinearGradient(0, y1, 0, y0);
  wet.addColorStop(0, 'rgba(56, 50, 60, 0.28)'); wet.addColorStop(1, 'rgba(56, 50, 60, 0)');
  g.fillStyle = wet; g.fillRect(0, y0, TW, h);
  // Its top course dressed flat into a ledge a finger out from the frame,
  // lit, with the shade of the sole along the back of it. Flush, the
  // footing read as the shadow of the wall rather than the stone it
  // stands on.
  g.fillStyle = TONES.foot.hi; g.fillRect(0, y0, TW, 6);
  g.fillStyle = PROUD_INK; g.fillRect(0, y0, TW, 3);
  g.fillStyle = hexA(PASTEL.line, 0.55); g.fillRect(0, y0 + 6, TW, 1.4);
}

/**
 * The ground storey's foot: the footing, with the sole of the frame sitting
 * on it, and over the sole the tide mark of splash the limewash takes at the
 * foot of every bay -- which on the ground storey the footing hides.
 */
function footingOf(kit: Kit, g: Ctx, R: Rand): void {
  const { S } = kit;
  const y0 = TH - S.plinth;
  splash(g, R, 0, TW, y0 - SOLE);
  footing(kit, g, R, y0, TH);
  member(kit, g, -6, y0 - SOLE, TW + 6, y0, rand(1733), true);
}

/** How deep the course of footing under a low wall's frame is. */
export const LOW_FOOT = 38;

/**
 * A half wall of it, or a fence: the frame at the height it stands to, on a
 * course of the footing -- a post at each end and one in the middle, a
 * rail along its head and a sole along its foot, and no brace. At that
 * height a brace lies nearly flat, and a run of them, each section braced
 * its own way, was the busiest thing in the garden.
 */
function lowFrame(kit: Kit, g: Ctx, R: Rand, fh: number): Block[] {
  const { PASTEL } = kit;
  const sole = fh - LOW_FOOT, e = POST / 2, top = 24, m = e + (R() - 0.5) * 12;
  g.fillStyle = PASTEL.stone; g.fillRect(0, 0, TW, sole);
  const coat = coats(kit, R, 2);
  ([[0, XM], [XM, TW]] as Array<[number, number]>).forEach(([a, b], i) => {
    const ia = a === 0 ? e : XM + m, ib = b === TW ? TW - e : XM - m;
    limewash(g, R, a, top, b, sole - SOLE, coat[i], [ia, top, ib, sole - SOLE]);
    splashes(g, R, ia, ib, sole - SOLE);
  });
  proud(g, -6, 0, TW + 6, top);
  for (const [a, b] of [[XM - m, XM + m], [-e, e], [TW - e, TW + e]]) proud(g, a, top, b, sole - SOLE);
  member(kit, g, XM - m, top - 2, XM + m, sole - SOLE + 2, R);
  member(kit, g, -e, 0, e, sole, rand(1759));
  member(kit, g, TW - e, 0, TW + e, sole, rand(1759));
  member(kit, g, -6, sole - SOLE, TW + 6, sole, rand(1763), true);
  footing(kit, g, R, sole, fh);
  return [];
}

/** Its cap: a rail along the head. The shade it throws is laid with the frame, under the posts, which are flush with it. */
function frameCope(kit: Kit, g: Ctx): void {
  member(kit, g, -6, 0, TW + 6, 24, rand(1767), true);
}

/**
 * The corner post a frame is finished with where a run turns a corner or
 * stops: the heaviest member of the frame, `h` px tall, over the ends of
 * the plate and the sole, which run into it and are pegged there. Its
 * outer edge runs off the picture, so the two faces of a corner meet on
 * oak and not on the limewash under it.
 */
function cornerPost(kit: Kit, h: number, pegs: number[]): HTMLCanvasElement {
  const w = 64, c = cnv(w, h), g = ctxOf(c);
  member(kit, g, -8, 0, w - 1, h, rand(1777), false, false);
  for (const y of pegs) peg(kit, g, w * 0.6, y);
  return c;
}

/**
 * The top of a frame is its plate seen from above: the oak turned up
 * at the sky, a step paler, and its grain running along it.
 */
function frameCap(kit: Kit, g: Ctx): void {
  const { TONES } = kit;
  g.fillStyle = TONES.top.lit; g.fillRect(0, 0, TW, CAP_H);
  g.strokeStyle = hexA(TONES.top.shade, 0.8); g.lineWidth = 1.2;
  for (const f of [0.3, 0.55, 0.8]) {
    g.beginPath();
    for (let x = 0; x <= TW; x += 16) g.lineTo(x, CAP_H * f + Math.sin(x * 0.02 + f * 9) * 1.5);
    g.stroke();
  }
}

/** The end of a frame is the side of its end post, the plate over it. */
function frameEnds(kit: Kit, g: Ctx, R: Rand, Wc: number): void {
  member(kit, g, -2, 0, Wc + 2, TH, R, false, false);
  member(kit, g, -2, 0, Wc + 2, PLATE, R);
}

/** A frame's ground storey at its end: the end post's side on the sole, and the footing round the end. */
function frameEndsFoot(kit: Kit, g: Ctx, R: Rand, Wc: number, y0: number): void {
  member(kit, g, -2, 0, Wc + 2, y0, R, false, false);
  member(kit, g, -2, 0, Wc + 2, PLATE, R);
  member(kit, g, -2, y0 - SOLE, Wc + 2, y0, R);
  footing(kit, g, R, y0, TH);
}

/** The rail along the head of a frame, seen from above: oak, paler for facing the sky. */
function frameLowCap(kit: Kit, g: Ctx): void {
  const { TONES } = kit;
  g.fillStyle = TONES.top.lit; g.fillRect(0, -2, TW, CAP_H + 2);
  g.strokeStyle = hexA(TONES.top.shade, 0.8); g.lineWidth = 1.2;
  for (const f of [0.35, 0.7]) {
    g.beginPath();
    for (let x = 0; x <= TW; x += 16) g.lineTo(x, CAP_H * f + Math.sin(x * 0.02 + f * 7) * 1.5);
    g.stroke();
  }
}

/**
 * The end of a low frame: the side of the end post, the rail over it, and
 * the footing it stands on, which goes round the end as it runs along the face.
 */
function frameLowEnds(kit: Kit, g: Ctx, R: Rand, Wc: number, fh: number): void {
  member(kit, g, -2, 0, Wc + 2, fh - LOW_FOOT, R, false, false);
  member(kit, g, -2, 0, Wc + 2, 24, R);
  member(kit, g, -2, fh - LOW_FOOT - SOLE, Wc + 2, fh - LOW_FOOT, R);
  footing(kit, g, R, fh - LOW_FOOT, fh);
}

/**
 * A gate post either side of the way through, from the rail down to
 * the sole and out to the fence's own end post -- after the gap is
 * cut, so its edge on the gateway keeps its ink. A bay of limewash a
 * hand wide between the two posts was a daub panel nobody would
 * build, and a pale slit down every gate post; and a post of its own
 * beside the end post was a doubled post.
 */
function frameGate(kit: Kit, g: Ctx, R: Rand, fh: number, gx0: number, gx1: number): void {
  g.save();
  g.beginPath(); g.rect(0, -PROUD, gx0, fh + PROUD); g.rect(gx1, -PROUD, TW - gx1, fh + PROUD); g.clip();
  const e = POST / 2, sole = fh - LOW_FOOT;
  // Cut from the same oak as the fence's own end post, laid from the
  // same seed, so the two read as one post where they meet at the seam.
  for (const [a, b] of [[-e, gx0], [gx1, TW + e]]) member(kit, g, a, 0, b, sole, rand(1759));
  // And the sole and the rail run on over them, as over every post of the fence.
  member(kit, g, -6, sole - SOLE, TW + 6, sole, rand(1763), true);
  frameCope(kit, g);
  g.restore();
}

function framePost(kit: Kit): NonNullable<Masonry['post']> {
  return { img: cornerPost(kit, TH, [PLATE / 2 + 1]), reach: POST / 2, free: true };
}

function frameLowPost(kit: Kit, fh: number): NonNullable<Low['post']> {
  return { img: cornerPost(kit, fh - LOW_FOOT, []), foot: LOW_FOOT };
}

/** Under a frame, a plank wall or worked metal, the oak or the metal its seams fall in. */
export function dressUnder(kit: Kit): [number, number, number] { const { PASTEL } = kit; return channels(PASTEL.dress); }

/** Timbercraft: an oak frame on a stone footing, its panels limewashed. */
export const FRAME_LAY: Lay = {
  courses: (kit, g, R, crests, open, vi) => paintFrame(kit, g, R, open, vi),
  arch: frameArch,
  surround: (kit, g, R, x0, x1, head, sill, wide, shelf) => frameSurround(kit, g, R, x0, x1, head, sill, shelf),
  doorway: frameDoorway,
  foot: footingOf,
  cap: frameCap,
  ends: frameEnds,
  endsFoot: frameEndsFoot,
  coping: (kit, g) => frameCope(kit, g),
  lowCourses: (kit, g, R, fh) => lowFrame(kit, g, R, fh),
  lowCap: frameLowCap,
  lowEnds: frameLowEnds,
  gateAfter: frameGate,
  gateCapPier: stoneCapPier,
  lowPost: frameLowPost,
  post: framePost,
  under: dressUnder,
  head: PLATE,
  wrap: true,
  scatter: true,
  handed: true,
};
