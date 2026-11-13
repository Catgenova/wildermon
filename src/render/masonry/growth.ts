import { CH, COURSES, EDGE, TH, TW, blob, clamp, cnv, ctxOf, hexA, shadowOf, shape, unionPath } from './draw';
import type { Kit } from './kit';
import type { Block, Ctx, Drape, Hedge, Lobe, Rand } from './types';

/**
 * What grows on a wall: masses of lobes (ivy, hedge, a tussock), moss in its joints, grass
 * blades; laid on the masonries whose stock has growth.
 */

/* Growth: a body, a deeper green in the shade, a pale one where the light catches an edge, and a dark
 * line with a tight halo round every mass. Begun as the castle reference's own tones, picked off it by
 * k-means, and carried into the island's teal with everything else that grows -- what a thing was
 * sampled from stops mattering the moment the field it stands in moves. */
const VEG = { top: '#80cc94', lit: '#6bb180', shade: '#65957a', pale: '#abe3b5', line: '#4b6c57' };

export const MOSS = { fill: '#7bb98b', under: '#669d75', fleck: '#598768' };

export const MARGIN = 77;                                   // no growth over the top nearer a section edge than this

const keepX = (x: number, r: number): number => clamp(x, EDGE + r + 5, TW - EDGE - r - 5);

const keepD = (x: number, r: number): number => clamp(x, MARGIN + r, TW - MARGIN - r);

/** A lobe's size: small, middling or large, so a mass is an aggregate of unequal lobes. */
const lobeSize = (R: Rand): number => { const t = R(); return t < 0.3 ? 0.55 : t < 0.75 ? 0.9 : 1.4; };

/** Lobes along a row in the three sizes: far enough apart to notch the edge a third deep, and where
 *  two neighbours fall short of touching, a small lobe bridges them, or the line would show in the gap.
 *  `notch` is the chance an end lobe is left out, biting the edge a lobe deep; and most rows get a
 *  crumb -- a lobe a third the size -- tucked against an end, so the edge is crumbly there. */
function row(cs: Lobe[], x0: number, x1: number, y: number, r: number, R: Rand, spacing?: number, notch?: number, keep?: (x: number, r: number) => number): void {
  const K = keep || keepX;
  const n = Math.max(1, Math.round((x1 - x0) / (r * (spacing || 1.45)))), made: Lobe[] = [];
  for (let i = 0; i <= n; i++) {
    const rr = r * lobeSize(R);
    made.push([K(x0 + (x1 - x0) * (n ? i / n : 0.5) + (R() - 0.5) * r * 0.3, rr), y + (R() - 0.5) * r * 0.3, rr]);
  }
  if (notch && made.length >= 3 && R() < notch) made.splice(R() < 0.5 ? 0 : made.length - 1, 1);
  const m = made.length;
  for (let i = 0; i + 1 < m; i++) {
    const a = made[i], b = made[i + 1];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > a[2] + b[2] - 3) made.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(a[2], b[2]) * 0.8]);
  }
  for (const s of [-1, 1]) {
    const e = s < 0 ? made[0] : made[m - 1];
    if (R() < 0.7) { const rr = e[2] * 0.36; made.push([K(e[0] + s * e[2] * 0.95, rr), e[1] + (R() - 0.5) * e[2] * 0.8, rr]); }
  }
  cs.push(...made);
}

/** The union of a mass's lobes, rasterised: any pocket the lobes enclose that is smaller than
 *  `maxArea` gets a lobe over it, because the line drawn beneath the mass would otherwise show
 *  through the pocket as a dark speck. Bigger pockets are left: the wall shows through them. */
function plugHoles(cs: Lobe[], maxArea: number): void {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, r] of cs) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  const ox = Math.floor(x0) - 2, oy = Math.floor(y0) - 2, W = Math.ceil(x1) - ox + 3, Hh = Math.ceil(y1) - oy + 3;
  if (W <= 0 || Hh <= 0 || W * Hh > 4e6) return;
  const c = cnv(W, Hh), g = ctxOf(c);
  unionPath(g, cs, -ox, -oy, 0); g.fillStyle = '#000'; g.fill();
  const d = g.getImageData(0, 0, W, Hh).data, mark = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) if (d[i * 4 + 3] > 127) mark[i] = 1;
  const stack: number[] = [];
  const flood = (start: number, tag: number, box?: number[]): void => {
    stack.push(start);
    while (stack.length) {
      const i = stack.pop() as number;
      if (mark[i]) continue;
      mark[i] = tag;
      const x = i % W, y = (i - x) / W;
      if (box) { box[0] = Math.min(box[0], x); box[1] = Math.max(box[1], x); box[2] = Math.min(box[2], y); box[3] = Math.max(box[3], y); box[4]++; }
      if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < Hh - 1) stack.push(i + W);
    }
  };
  for (let x = 0; x < W; x++) { flood(x, 2); flood((Hh - 1) * W + x, 2); }
  for (let y = 0; y < Hh; y++) { flood(y * W, 2); flood(y * W + W - 1, 2); }
  for (let i = 0; i < W * Hh; i++) {
    if (mark[i]) continue;
    const box = [W, 0, Hh, 0, 0];
    flood(i, 3, box);
    if (box[4] <= maxArea) cs.push([ox + (box[0] + box[1] + 1) / 2, oy + (box[2] + box[3] + 1) / 2, Math.hypot(box[1] - box[0] + 1, box[3] - box[2] + 1) / 2 + 1.5]);
  }
}

/** One mass. An outline -- the halo, then the dark line -- round the union of the lobes, and a
 *  fainter line round every third lobe inside; then the light from above, the way the reference
 *  paints a bush -- the faint lines only in the middle band: the top third of the mass in the pale
 *  lime, with a cream leaf or three or four of
 *  different sizes on it if `o.lobe` is set, never two level side by side; the middle in the lit
 *  green, a third of its lobes carrying a crescent of shade at the lower right; the underside in the
 *  shade green, each lobe with a thin sliver of light at its upper left. Every mass has a light side
 *  and a dark side, and that survives being shrunk to a few pixels. */
export function mass(g: Ctx, cs: Lobe[], R: Rand, o: { r: number; lw?: number; lobe?: number }): void {
  const r = o.r, dx = -r * 0.38, dy = -r * 0.5, lw = o.lw || 3;
  const m0 = cs.length;
  for (let i = 0; i < m0; i++) for (let j = i + 1; j < m0; j++) {
    const a = cs[i], b = cs[j], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > a[2] + b[2] - 2 && d < a[2] + b[2] + 2 * lw + 2) cs.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(a[2], b[2]) * 0.7]);
  }
  plugHoles(cs, 220);
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y, rr] of cs) { y0 = Math.min(y0, y - rr); y1 = Math.max(y1, y + rr); }
  const Hh = Math.max(1, y1 - y0), band = (c: Lobe): number => (c[1] - y0) / Hh;
  unionPath(g, cs, 0, 0, lw + 1.8); g.fillStyle = hexA(VEG.line, 0.4); g.fill();
  unionPath(g, cs, 0, 0, lw); g.fillStyle = VEG.line; g.fill();
  unionPath(g, cs, 0, 0, 0); g.fillStyle = VEG.shade; g.fill();
  g.save(); unionPath(g, cs, 0, 0, 0); g.clip();
  unionPath(g, cs, dx, dy, 0); g.fillStyle = VEG.lit; g.fill();
  const topL = cs.filter((c) => band(c) < 0.3);
  if (topL.length) { unionPath(g, topL, 0, 0, -0.5); g.fillStyle = VEG.top; g.fill(); }
  for (const c of cs) {
    const b = band(c), low = b > 0.62;
    if (b < 0.3 || (!low && R() > 0.35)) continue;
    const k = low ? 1.05 : 0.3;
    g.save(); g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.clip();
    g.fillStyle = VEG.shade; g.fillRect(c[0] - c[2], c[1] - c[2], 2 * c[2], 2 * c[2]);
    g.beginPath(); g.arc(c[0] - c[2] * k, c[1] - c[2] * k * 1.15, c[2], 0, 7); g.fillStyle = VEG.lit; g.fill();
    g.restore();
  }
  // a few leaf edges inside the middle band: an open arc a third of the way round, low and right,
  // on one lobe in three or four, in the shade green -- never a closed ring
  g.strokeStyle = hexA(VEG.shade, 0.8); g.lineWidth = lw * 0.4; g.lineCap = 'round';
  for (let i = 0; i < m0; i += 3 + Math.floor(R() * 2)) { const c = cs[i], b = band(c); if (b < 0.3 || b > 0.62) continue; g.beginPath(); g.arc(c[0], c[1], Math.max(1, c[2] - lw * 0.35), Math.PI * 0.15, Math.PI * 0.8); g.stroke(); }
  if (o.lobe && topL.length) {
    const n = [1, 3, 3, 4][Math.floor(R() * 4)], pale: Lobe[] = [], cands = topL.slice().sort(() => R() - 0.5);
    for (const c of cands) {
      if (pale.length >= n) break;
      if (pale.some((p) => Math.abs(p[1] - c[1]) < r * 0.8 && Math.abs(p[0] - c[0]) < r * 5)) continue;
      pale.push([c[0] + (R() - 0.5) * c[2] * 0.6, c[1] + (R() - 0.5) * c[2] * 0.6, 5.5 + 1.5 * pale.length] as Lobe);
    }
    if (pale.length) { unionPath(g, pale, 0, 0, 0); g.fillStyle = VEG.pale; g.fill(); }
  }
  g.restore();
}

/** A drape and its crest, one silhouette, made of lobes the size of leaf clusters: a crest spilling
 *  over the cap, wider than it is tall, one shoulder a third wider than the other and dropping most
 *  of a course lower down the face; and under it, where `m.fall` asks for one, a curtain rooted at
 *  seven tenths of the crest's width, tapering to a third of it, that frays over its last third into
 *  two or three tongues side by side of unequal length, each narrowing to a lobe and stopping there.
 *  No neck, no club: the curtain is never more than three times as long as it is wide. */
export function drapeLayout(m: Drape, R: Rand): { cs: Lobe[]; r: number } {
  const cs: Lobe[] = [], W = m.w, half = W / 2, r0 = 11 + W * 0.012;
  const cx = clamp(m.cx, MARGIN + half, TW - MARGIN - half);
  const peak = (R() - 0.5) * 0.7, rise = 14 + W * 0.07, depth = 6 + W * 0.09, wideSide = R() < 0.5 ? -1 : 1;
  for (let y = -rise; y <= depth; y += r0) {
    const t = (y + rise) / (depth + rise);
    const wide = t < 0.4 ? 0.55 + 0.45 * Math.pow(t / 0.4, 0.6) : 1;
    const c = cx + peak * half * 0.5 * Math.max(0, 1 - t / 0.4);
    const w = half * wide * (0.94 + 0.12 * R()), spill = t > 0.25 ? w * 0.3 : 0;
    row(cs, c - w - (wideSide < 0 ? spill : 0), c + w + (wideSide > 0 ? spill : 0), y, r0 * (0.9 + 0.2 * R()), R, 1.3, t > 0.5 ? 0.25 : 0, keepD);
  }
  const drop = CH * (0.5 + 0.3 * R());
  for (let y = depth + r0; y < depth + drop; y += r0 * 1.1) {
    const t2 = (y - depth) / drop, xa = cx + wideSide * half * (0.25 + 0.3 * t2), xb = cx + wideSide * half * (1.2 - 0.55 * t2);
    row(cs, Math.min(xa, xb), Math.max(xa, xb), y, r0 * (0.95 - 0.25 * t2), R, 1.3, 0.3, keepD);
  }
  if (m.fall) {
    const top = depth + r0 * 0.8, L = TH * m.fall, span = Math.max(r0 * 2, L - top), lean = (R() - 0.5) * 0.2;
    const hwAt = (t: number): number => half * (0.72 - 0.4 * t), split = top + span * 0.62;
    for (let y = top; y < split; y += r0 * 1.15) {
      const t = (y - top) / span, hw = hwAt(t) * (0.94 + 0.12 * R()), c = cx + lean * (y - top);
      row(cs, c - hw, c + hw, y, r0 * (0.95 - 0.2 * t), R, 1.3, t > 0.2 ? 0.3 : 0, keepD);
    }
    const n = m.tongues || 2, lens = [1, 0.78, 0.6].sort(() => R() - 0.5).slice(0, n), hwS = hwAt((split - top) / span);
    for (let k = 0; k < n; k++) {
      const Lk = split + (L - split) * lens[k], u = (k - (n - 1) / 2) * (2 * hwS / n), hwT = hwS / n;
      let j = 0;
      for (let y = split; y < Lk; y += r0 * 1.15, j++) {
        const t = (y - split) / Math.max(1, Lk - split), hw = Math.max(r0 * 0.3, hwT * (1 - 0.6 * t)), c = cx + u + lean * (y - top) + (R() - 0.5) * r0 * 0.3;
        row(cs, c - hw, c + hw, y, r0 * (0.85 - 0.3 * t), R, 1.25, j > 0 ? 0.35 : 0, keepD);
      }
    }
  }
  return { cs, r: r0 };
}

/** A hedge at the foot: a long low mass of lobes painted on the wall itself, widest at the ground and
 *  narrowing to its top, its top notched, its rows close enough to leave no holes; its lowest rows
 *  lie below the ground line, so the canvas cuts it flat two pixels above it and the cut reads as the
 *  shadow it stands in. The mass's own tone rule darkens its underside along the scalloped foot. On
 *  half of them a few cream leaves, and a few blossoms over the upper half. */
export function hedge(kit: Kit, g: Ctx, b: Hedge, R: Rand, base = TH): void {
  const { PASTEL } = kit;
  const cs: Lobe[] = [], half = b.w / 2, r = 6 + b.h * 0.08;
  for (let y = base - b.h + r; y <= base + r; y += r * 1.25) {
    const t = (base - y) / b.h;
    const w = half * (t > 0.2 ? 1 - 0.4 * Math.pow((t - 0.2) / 0.8, 1.4) : 1) * (0.94 + 0.12 * R());
    row(cs, b.cx - w, b.cx + w, y, r * (0.9 + 0.2 * R()), R, 1.3, t > 0.4 ? 0.3 : 0);
  }
  g.save(); g.beginPath(); g.rect(0, 0, TW, base - 2); g.clip();
  shadowOf(g, cs, 6, 4);
  mass(g, cs, R, { r, lobe: R() < 0.5 ? 1 : 0 });
  // three to five blossoms on the crown, white and pink as the reference has them: four petals round
  // a sand centre, under a thin dark line so they hold against the pale lime, big enough to survive 1x
  const crown = cs.filter((c) => c[1] < base - b.h * 0.55);
  for (let i = 0; i < (b.flowers || 0) && crown.length; i++) {
    const c = crown[Math.floor(R() * crown.length)], x = c[0] + (R() - 0.5) * c[2], y = c[1] + (R() - 0.5) * c[2], fr = 9 + 3 * R();
    const petals: Lobe[] = [[x, y - fr * 0.5, fr * 0.5], [x - fr * 0.5, y, fr * 0.5], [x + fr * 0.5, y, fr * 0.5], [x, y + fr * 0.5, fr * 0.5]];
    unionPath(g, petals, 0, 0, 1.3); g.fillStyle = VEG.line; g.fill();
    unionPath(g, petals, 0, 0, 0); g.fillStyle = R() < 0.6 ? '#f7f3e6' : PASTEL.blush; g.fill();
    g.beginPath(); g.arc(x, y, fr * 0.22, 0, 7); g.fillStyle = PASTEL.sand; g.fill();
  }
  g.restore();
}

/** Moss on a joint: a short lens, half a brick long, thick in the middle and thin at the ends, two
 *  or three shallow bumps along its top and flat along the joint, in a grey olive between the stone
 *  and the growth, with the darker olive showing only as a hairline along the underside. `y` is the
 *  joint; the lens hangs above it. */
export function mossLens(g: Ctx, s: Block, y: number, R: Rand): void {
  const len = Math.min(TW - 2 * EDGE - 10, s.w * (0.4 + 0.5 * R())), h = CH * (0.1 + 0.06 * R());
  const x0 = clamp(s.x + (s.w - len) * R(), EDGE + 5, TW - EDGE - len - 5), cx = x0 + len / 2;
  const body = blob(cx, y - h * 0.45, len / 2, h * 0.55, 14, R, 0.8, 0.25, 0.15), bumps: Lobe[] = [];
  for (let k = 0; k < 2 + (R() < 0.5 ? 1 : 0); k++) bumps.push([x0 + len * (0.2 + 0.6 * R()), y - h * 0.7, h * (0.35 + 0.2 * R())]);
  g.save(); g.beginPath(); g.rect(x0 - 12, y - CH, len + 24, CH); g.clip();
  const paint = (tone: string, oy: number): void => {
    g.fillStyle = tone;
    g.save(); g.translate(0, oy); shape(g, body); g.fill(); unionPath(g, bumps, 0, 0, 0); g.fill(); g.restore();
  };
  paint(MOSS.under, 1.5);
  paint(MOSS.fill, 0);
  g.restore();
}

/** A fleck of dark moss in the corner of a joint. */
export function mossFleck(g: Ctx, s: Block, R: Rand): void {
  const onTop = R() < 0.6, x = s.x + s.w * (0.05 + 0.9 * R()), y = onTop ? s.y + 2.5 : s.y + s.h - 2.5;
  g.beginPath(); g.arc(x, y, 1.5 + R(), 0, 7); g.fillStyle = hexA(MOSS.fleck, 0.8); g.fill();
}

/** A faint dab of moss on a brick's face. */
function mossDab(g: Ctx, s: Block, R: Rand): void {
  const x = s.x + s.w * (0.15 + 0.7 * R()), y = s.y + s.h * (0.3 + 0.5 * R()), rr = 1.5 + 1.5 * R();
  g.beginPath(); g.arc(x, y, rr, 0, 7); g.fillStyle = hexA(MOSS.fill, 0.55); g.fill();
}

/** The foot of the ground storey: a band of shade along the ground line; one to three lenses of moss
 *  on as many different courses of the lowest three, one of them now and then rising from the ground
 *  line itself; three to six flecks in the corners of joints low down; a dab or two on the bricks. */
export function footMoss(kit: Kit, g: Ctx, stones: Block[], count: number, R: Rand): void {
  const { MORTAR } = kit;
  g.fillStyle = 'rgba(110,100,80,0.16)'; g.fillRect(0, TH - 10, TW, 10);
  const courses = [COURSES - 1, COURSES - 2, COURSES - 3].sort(() => R() - 0.5).slice(0, Math.min(count, 1 + Math.floor(R() * 3)));
  for (const c of courses) {
    const pool = stones.filter((s) => s.course === c);
    if (!pool.length) continue;
    const s = pool[Math.floor(R() * pool.length)];
    mossLens(g, s, c === COURSES - 1 && R() < 0.34 ? TH + 1 : s.y - MORTAR / 2, R);
  }
  const low = stones.filter((s) => s.course >= COURSES - 2);
  for (let i = 0; i < 3 + Math.floor(R() * 4) && low.length; i++) mossFleck(g, low[Math.floor(R() * low.length)], R);
  for (let i = 0; i < 1 + Math.floor(R() * 2) && low.length; i++) mossDab(g, low[Math.floor(R() * low.length)], R);
}

/* ---- what grows in a way through --------------------------------------- */
/**
 * Growth does not stop at a doorway.
 *
 * The first arch clipped every green thing to the stone, so the ivy that had
 * got over the top of the section was sliced off along the curve and the
 * hedge at the foot stopped dead at the jamb, both on a line nothing in the
 * picture explains. But a plant does not know there is an opening. It grows
 * down the face and dangles in the gap; it grows round the jamb and into the
 * reveal; and where a wall has been broken through, the seed gets in and
 * there is grass standing in the way.
 *
 * These two layers are painted per variant off that variant's own drapes and
 * hedges, so a tongue over an opening hangs from ivy that is really there
 * and no two archways are overgrown the same. The variant with nothing over
 * its top gets no tongue; the one with the widest hedge gets it across the
 * threshold.
 */

/** Lobes for a curtain hanging at `cx` from `y0`, `w` half-wide, fraying as it falls. */
export function tongueLobes(cs: Lobe[], cx: number, y0: number, w: number, len: number, R: Rand): void {
  const r0 = 8.5;
  for (let y = y0; y < y0 + len; y += r0 * 1.1) {
    const t = (y - y0) / len;
    const hw = Math.max(r0 * 0.5, w * (1 - 0.62 * t) * (0.9 + 0.2 * R()));
    row(cs, cx - hw + (R() - 0.5) * r0 * 0.4, cx + hw, y, r0 * (0.95 - 0.3 * t), R, 1.3, t > 0.2 ? 0.32 : 0, (x) => x);
  }
}

/**
 * Grass out of a joint: a fan of blades from one root.
 *
 * The turf at the foot of a wall was tussocks, and a tussock is built of the
 * same round lobes as the hedge standing next to it -- one plant language
 * used twice, which reads as two sizes of the same bush rather than as grass
 * against a shrub. The tall wall works because its hanging ivy and its foot
 * hedge do not look alike.
 *
 * Grass has no lobes. It has blades: wide at the root, bending further over
 * the further out they are fanned, and thinner every pixel until they stop.
 * The outermost are drawn first and in the deeper green, so a clump has a
 * back and a front.
 */
export function blades(kit: Kit, g: Ctx, x: number, base: number, w: number, h: number, R: Rand, tone = 0): void {
  const { PASTEL } = kit;
  // Paler, the wall's own green, or deeper, so no two clumps along a run
  // are the same colour.
  const ink = tone > 0
    ? [PASTEL.leafDeep, VEG.lit, PASTEL.leafPale]
    : tone < 0
      ? [PASTEL.leafLine, PASTEL.leafDeep, VEG.shade]
      : [VEG.shade, VEG.lit, VEG.top];
  const n = 5 + Math.floor(R() * 5);
  const fan: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = (t - 0.5) * 1.35 + (R() - 0.5) * 0.3;
    // The ones leaning furthest out stand shortest, which is what stops a
    // fan from being a semicircle.
    fan.push([a, h * (0.6 + 0.4 * Math.cos(a)) * (0.78 + R() * 0.3), x + (R() - 0.5) * w * 0.6, 1.3 + R() * 1.3]);
  }
  fan.sort((p, q) => Math.abs(q[0]) - Math.abs(p[0]));
  g.save();
  g.lineJoin = 'round';
  for (let i = 0; i < fan.length; i++) {
    const [a, len, rx, bw] = fan[i];
    const sa = Math.sin(a), ca = Math.cos(a);
    // it keeps bending the way it started, so the tip is further out than the lean alone
    const tipX = rx + sa * len * 1.28, tipY = base - ca * len;
    const midX = rx + sa * len * 0.46, midY = base - ca * len * 0.62;
    g.beginPath();
    g.moveTo(rx - ca * bw, base - sa * bw);
    g.quadraticCurveTo(midX - ca * bw * 0.55, midY - sa * bw * 0.55, tipX, tipY);
    g.quadraticCurveTo(midX + ca * bw * 0.55, midY + sa * bw * 0.55, rx + ca * bw, base + sa * bw);
    g.closePath();
    const t = i / Math.max(1, fan.length - 1);
    g.fillStyle = t < 0.45 ? ink[0] : t < 0.88 ? ink[1] : ink[2];
    g.fill();
    g.strokeStyle = VEG.line; g.lineWidth = 0.9; g.stroke();
  }
  g.restore();
}

/** A low mound of growth standing on `base`, `w` by `h`, wherever it is rooted. */
export function tussock(g: Ctx, x: number, base: number, w: number, h: number, R: Rand): void {
  const cs: Lobe[] = [], r = 5.5 + h * 0.08;
  for (let y = base - h + r; y <= base + r; y += r * 1.2) {
    const t = (base - y) / h;
    const hw = (w / 2) * (t > 0.25 ? 1 - 0.55 * Math.pow((t - 0.25) / 0.75, 1.3) : 1) * (0.9 + 0.2 * R());
    row(cs, x - hw, x + hw, y, r * (0.9 + 0.2 * R()), R, 1.3, t > 0.35 ? 0.35 : 0, (q) => q);
  }
  g.save(); g.beginPath(); g.rect(0, 0, TW, TH - 2); g.clip();
  shadowOf(g, cs, 5, 4);
  mass(g, cs, R, { r, lobe: R() < 0.4 ? 1 : 0 });
  g.restore();
}
