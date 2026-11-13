import { COPE } from './coping';
import { BAND, COURSES, EDGE, TH, TW, channels, clamp, hexA, poly, rand } from './draw';
import type { Kit } from './kit';
import { LAID_LAY, fieldTone } from './laid';
import { chipCorner, slabs, stone, weather } from './stone';
import type { Block, Ctx, Lay, Pt, Rand } from './types';

/**
 * Bond: a moulded unit laid to a line in a half lap (brick, stone brick, sandstone, and the
 * field of slate), its firing, its quoins and its garden wall.
 */

/**
 * The field of a bond: units of one size, laid to a line in a half lap.
 *
 * What the rubble field keeps by hand the bond keeps by the lay. Every
 * other course is set over by half a unit, so the joints stagger by
 * themselves and on those courses a unit lies across the section's seam --
 * drawn at both edges from one seed, so any section butts any other -- while
 * the courses between leave a joint there no wider than any other joint.
 * Every fourth course is headers, which is what a wall thick enough to
 * stand three storeys is actually bonded with, and it is the thing that
 * stops twelve courses of stretchers reading as ruled paper.
 *
 * What is drawn rather than laid is the colour. A kiln fires unevenly and
 * the load comes out in batches, so a brick wall is one hue in a dozen
 * values -- and on a wall where every unit is the same size, that is the
 * whole of what there is to look at.
 */
function paintBond(kit: Kit, g: Ctx, R: Rand, crests: Pt[]): Block[] {
  const { PASTEL, S, MORTAR } = kit;
  g.fillStyle = PASTEL.joint;
  g.fillRect(0, 0, TW, TH);
  slabs(kit, g, 0, BAND, R);
  const own: Block[] = [];
  const zone = firing(kit, R);
  /*
   * Where each bed joint falls.
   *
   * Evenly divided courses are the tell of a wall nobody laid: ten beds at
   * exactly a tenth is graph paper whatever is drawn between them. These
   * come off a seed every variant shares, because a course has to arrive at
   * a section's seam at the height it left the last one.
   */
  const tops = bedTops(kit);
  for (let i = 0; i < S.rows; i++) {
    const y0 = tops[i], ch = tops[i + 1] - y0;
    // The course under the band of an ornate wall is its dogtooth, laid after.
    if (S.ornate && i === 0) continue;
    // Headers every fourth course, on brick, which is what a wall thick
    // enough to stand three storeys is actually bonded with, and the thing
    // that stops ten courses of stretchers reading as ruled paper. Cut stone
    // is bonded through its own depth and shows stretchers only.
    const head = S.headers > 0 && i % S.headers === S.headers - 1;
    const n = head ? S.across * 2 : S.across;
    const lap = head ? 0 : (i % 2) * 0.5;
    // The course's own sag. It is a sine on a span that is zero at both
    // ends, so a bed arrives at the seam level however far its middle has
    // dropped, and the drop is what says the wall has stood a while.
    const kw = 1 + Math.floor(R() * 2), aw = ch * (S.master ? 0.015 : 0.17) * (R() < 0.5 ? -1 : 1);
    const q = Math.min(COURSES - 1, Math.floor((i / S.rows) * COURSES));
    const units: Array<[number, number, boolean]> = S.ornate ? flemishOf(i) : unitsOf(kit, n, lap, R, 1511 + i * 13).map(([x, w]): [number, number, boolean] => [x, w, head]);
    for (const [x, uw, hd] of units) {
      const mid = clamp(x + uw / 2, EDGE, TW - EDGE);
      const seam = x < 0 || x + uw > TW;
      const sag = Math.sin((Math.PI * kw * (mid - EDGE)) / (TW - 2 * EDGE)) * aw;
      // The unit across the seam is the same unit in every variant, so it is
      // laid from a seed of the course's own rather than from the variant's.
      const RR = seam ? rand(811 + i * 7) : R;
      const priv = x + MORTAR / 2 > EDGE && x + uw - MORTAR / 2 < TW - EDGE;
      const tone = S.ornate && hd && diaperAt(x + uw / 2, i) ? 'diaper' : zone(RR, seam ? 0 : x + uw / 2, y0, hd, q, crests, i < 2);
      const jw = MORTAR + (priv ? RR() * (S.master ? 0.5 : 2.2) : 0);
      const drift = (RR() - 0.5) * (S.master ? 0.5 : 2.4) + sag;
      const shrink = RR() * (S.master ? 0.5 : 2);
      const b: Block = {
        x: x + jw / 2,
        y: y0 + MORTAR / 2 + drift + shrink / 2,
        w: uw - jw,
        h: ch - MORTAR - shrink,
        course: q,
        pts: [],
      };
      // A degree would be a brick somebody dropped in. A bond is laid to a
      // line and what it has instead is a hand's worth of it, which is a
      // fortieth of a degree and shows as an edge rather than as a slope.
      const tilt = priv && RR() < 0.3 ? (RR() - 0.5) * (S.master ? 0 : 0.012) : 0;
      // And a lost edge here and there: one brick in six drawn with half the
      // ink, so the outline is a hand going round them and not a stencil.
      const ink = priv && RR() < 0.17 ? 0.7 : 1.35;
      b.pts = stone(kit, g, b.x, b.y, b.w, b.h, RR, tone, 'unit', tilt, ink);
      if (priv && b.w > 24) own.push(b);
    }
  }
  if (S.ornate) dogtooth(kit, g, tops[0], tops[1]);
  weather(kit, g, own, R);
  /*
   * And the band course standing proud of the brick under it. A dressing
   * that is flush with the wall is a painted stripe; what says it is a
   * course of stone laid on and projecting is the line of shade it throws
   * down the brick, and the arris of it catching the light above that.
   */
  oversail(kit, g, 0, BAND, 12);
  return own;
}

/**
 * Where each bed joint of a bond falls, from the band down.
 *
 * Evenly divided courses are the tell of a wall nobody laid: ten beds at
 * exactly a tenth is graph paper whatever is drawn between them. These come
 * off a seed every variant shares, because a course has to arrive at a
 * section's seam at the height it left the last one -- and because a quoin
 * is two courses of brick deep and has to know where they are.
 */
/** How deep course `i` is laid against the others: turn about tall and short where the stock asks for it. */
function rhythmOf(kit: Kit, i: number): number {
  const { S } = kit;
  return S.rhythm ? (i % 2 ? 1 - S.rhythm : 1 + S.rhythm) : 1;
}

/**
 * Where the units of a course of `n` stand, `lap` of one over, as
 * [x, width]: evenly, or on sandstone at lengths no two alike -- every joint
 * inside the course moved up to a fifth of a unit either way. A unit that
 * crosses the section's seam takes its two ends off the course's own
 * `seed`, so that it is the same stone in every variant.
 */
function unitsOf(kit: Kit, n: number, lap: number, R: Rand, seed: number): Array<[number, number]> {
  const { S } = kit;
  const uw = TW / n, out: Array<[number, number]> = [];
  if (!S.grain && !S.slab) {
    for (let k = lap ? -1 : 0; k < n; k++) out.push([(k + lap) * uw, uw]);
    return out;
  }
  const jit = (r: Rand): number => (r() - 0.5) * 0.4 * uw;
  const js: number[] = [];
  if (!lap) {
    js.push(0);
    for (let k = 1; k < n; k++) js.push(k * uw + jit(R));
    js.push(TW);
  } else {
    const SR = rand(seed), a = uw / 2 + jit(SR), b = uw / 2 + jit(SR);
    js.push(-a, b);
    for (let k = 1; k <= n - 2; k++) js.push((k + 0.5) * uw + jit(R));
    js.push(TW - a, TW + b);
  }
  for (let k = 0; k + 1 < js.length; k++) out.push([js[k], js[k + 1] - js[k]]);
  return out;
}

/** Flemish bond: pairs of a stretcher and a header to the section, and the stretcher's share of a pair. */
const FLEM = 4, FLEM_P = TW / FLEM, STRETCH = FLEM_P * (2 / 3), HEADER = FLEM_P / 3;

/**
 * The units of course `i` of Flemish bond, as [x, width, header]: a
 * stretcher and a header turn about, every other course set over by half
 * a pair, so that each header sits on the middle of the stretcher under
 * it. The unit across the seam is one stone, laid at both edges.
 */
function flemishOf(i: number): Array<[number, number, boolean]> {
  const off = (i % 2) * (FLEM_P / 2), out: Array<[number, number, boolean]> = [];
  for (let k = -1; k <= FLEM; k++) {
    for (const [dx, w, h] of [[0, STRETCH, false], [STRETCH, HEADER, true]] as Array<[number, number, boolean]>) {
      const a = off + k * FLEM_P + dx;
      if (a + w > 0 && a < TW) out.push([a, w, h]);
    }
  }
  return out;
}

/** The diaper's lozenges, in header steps: a lozenge the section across, and as many courses tall. */
const DIAPER = 8;

/**
 * Whether the header centred at `xc` on course `i` of the field is one the
 * diaper picks out: headers a half pair apart on the courses above and
 * below lie on a diagonal, and the diaper is two families of them crossing.
 */
function diaperAt(xc: number, i: number): boolean {
  const m = Math.round((xc - STRETCH - HEADER / 2) / (FLEM_P / 2));
  const a = (((m - i) % DIAPER) + DIAPER) % DIAPER, b = (((m + i) % DIAPER) + DIAPER) % DIAPER;
  return a === 0 || b === 0;
}

/**
 * A course of dogtooth from `y0` to `y1`: bricks set corner-out, twelve to
 * the section and one on each seam, so the course is a row of teeth, each
 * lit down its left face and in shade down its right, with the dark of the
 * recess between them -- the ornament a bricklayer makes out of nothing
 * but the brick, and the one that reads from across a deed.
 */
function dogtooth(kit: Kit, g: Ctx, y0: number, y1: number): void {
  const { MORTAR, PASTEL } = kit;
  const n = 12, P = TW / n, t = y0 + MORTAR / 2, b = y1 - MORTAR / 2;
  g.fillStyle = PASTEL.recess; g.fillRect(-2, y0, TW + 4, y1 - y0);
  g.lineJoin = 'round';
  for (let k = 0; k <= n; k++) {
    const cx = k * P, l = cx - P / 2 + 1.5, r = cx + P / 2 - 1.5;
    g.beginPath(); poly(g, [[l, t], [cx, t], [cx, b]]); g.fillStyle = PASTEL.toothLit; g.fill();
    g.beginPath(); poly(g, [[cx, t], [r, t], [cx, b]]); g.fillStyle = PASTEL.toothShade; g.fill();
    g.beginPath(); poly(g, [[l, t], [r, t], [cx, b]]); g.strokeStyle = PASTEL.line; g.lineWidth = 1.3; g.stroke();
  }
}

export function bedTops(kit: Kit): number[] {
  const { S } = kit;
  const HR = rand(2027);
  const hs: number[] = [];
  let tot = 0;
  for (let i = 0; i < S.rows; i++) { const w = (S.master ? 0.975 + 0.05 * HR() : 0.92 + 0.16 * HR()) * rhythmOf(kit, i); hs.push(w); tot += w; }
  const tops: number[] = [BAND];
  for (let i = 0; i < S.rows; i++) tops.push(tops[i] + ((TH - BAND) * hs[i]) / tot);
  return tops;
}

/**
 * The quoins a free end of a bond is finished with, toothed into the face.
 *
 * A column of equal stones up a corner is a strip of trim; what makes it
 * masonry is that it is bonded into the brick either side -- a long stone,
 * then a short one, each two courses of brick deep, so the brick is laid
 * into the notches between them. `side` is which edge of the section the
 * stones are on, and the two edges start their long-and-short on opposite
 * courses, so at a corner where two walls meet the long face of one is
 * over the short face of the other, the way a quoin turns a corner.
 */
function quoins(kit: Kit, side: -1 | 1): HTMLCanvasElement {
  const { S, PASTEL, MORTAR } = kit;
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d') as Ctx;
  if (S.lay === 'render') {
    /*
     * A mud wall has no quoins: its corner is rounded, by the trowel and
     * then by the weather, so a free end is an arris that turns towards
     * the light on the left of a section and away from it on the right --
     * a flat strip of each, with a wobbling inner edge.
     */
    const R = rand(side < 0 ? 1811 : 1831), w = 15;
    g.beginPath();
    const xe = side < 0 ? 0 : TW;
    g.moveTo(xe, -2);
    for (let y = 0; y <= TH; y += 24) g.lineTo(xe - side * (w + (R() - 0.5) * 6), y);
    g.lineTo(xe, TH + 2); g.closePath();
    g.fillStyle = side < 0 ? hexA(PASTEL.stoneHi, 0.8) : 'rgba(46, 34, 62, 0.22)';
    g.fill();
    return c;
  }
  if (S.slab) {
    /*
     * A marble wall is not quoined. Where it stops or turns a corner it is
     * finished with a strip of the dove grey down the arris, a stone to
     * each course of slabs, so every face is framed -- the band over it,
     * a strip down each end and the plinth under it -- and the strip
     * stands a hair proud, so it throws a line of shade on the white.
     */
    const W = 30, FH = TH - BAND, RS = rand(side < 0 ? 1709 : 1733);
    for (let k = 0; k < 2; k++) {
      const y0 = BAND + (k * FH) / 2, x0 = side < 0 ? -6 : TW - W;
      g.fillStyle = PASTEL.joint; g.fillRect(side < 0 ? 0 : x0 - 2, y0, W + 2, FH / 2);
      stone(kit, g, x0, y0 + 1, W + 6, FH / 2 - 2, RS, k ? 'plinth' : 'dress', 'unit', 0, 1.4);
    }
    if (side < 0) { g.fillStyle = 'rgba(60, 52, 84, 0.2)'; g.fillRect(W + 2, BAND, 4, FH); }
    return c;
  }
  const tops = bedTops(kit);
  const R = rand(side < 0 ? 1709 : 1733);
  const LONG = 94, SHORT = 54;
  for (let q = 0; q * 2 < S.rows; q++) {
    const y0 = tops[q * 2], y1 = tops[Math.min(S.rows, q * 2 + 2)];
    const long = (q % 2 === 0) === (side < 0);
    const reach = (long ? LONG : SHORT) + (R() - 0.5) * 8;
    // Where the stone ends against the brick, and the mortar round it.
    const x0 = side < 0 ? -6 : TW - reach, x1 = side < 0 ? reach : TW + 6;
    g.fillStyle = PASTEL.joint;
    g.fillRect(x0 - MORTAR, y0, x1 - x0 + MORTAR * 2, y1 - y0);
    const tone = R() < (S.master ? 0.12 : 0.3) ? 'plinth' : 'dress';
    const pts = stone(kit, g, x0 + MORTAR / 2, y0 + MORTAR / 2, x1 - x0 - MORTAR, y1 - y0 - MORTAR, R, tone, 'unit', 0, 1.8);
    const b: Block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, course: q, pts };
    if (R() < (S.master ? 0.04 : 0.35)) chipCorner(kit, g, b, R);
    // A quoin stands a hair proud of the brick and it throws that much
    // shade on the course beside it, on the side away from the light.
    if (side > 0) {
      g.fillStyle = 'rgba(46, 38, 60, 0.26)';
      g.fillRect(x0 - MORTAR - 5, y0 + 2, 5, y1 - y0 - 2);
    }
  }
  return c;
}

/**
 * How a load of brick came out of the kiln, over one section.
 *
 * A kiln fires unevenly and a load gets laid where it was set down, so the
 * colour of a brick wall arrives in zones a yard or two across: one that
 * stood near the fire and came out scorched, one further off that came out
 * soft. Rolling every unit on its own gives a tweed -- the eye lands on
 * bricks instead of on the wall -- and it was the first thing an art
 * director said about this.
 *
 * The zones come off a coarse field over the section whose left-hand column
 * is drawn from a seed every variant shares and which wraps in x, so the
 * field has the same value at both edges of every section and carries
 * across a seam like everything else here. The roll inside a zone is what
 * stops the zone having an edge.
 */
function firing(kit: Kit, R: Rand): (RR: Rand, x: number, y: number, head: boolean, course: number, crests: Pt[], drip?: boolean) => string {
  const { S } = kit;
  const NX = 4, NY = 3;
  const edge = rand(1601);
  const grid: number[] = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i < NX; i++) grid.push(i === 0 ? edge() : R());
  /*
   * And a wash: a run down part of the section where the rain off the band
   * above has had the colour out of the brick. Most sections have one, well
   * inside the seams, a brick or so wide.
   */
  const washed = R() < 0.65;
  const washX = EDGE + 70 + R() * (TW - 2 * EDGE - 140), washW = 26 + R() * 34;
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const at = (i: number, j: number): number => grid[Math.min(NY, j) * NX + (i % NX)];
  return (RR, x, y, head, course, crests, drip) => {
    const u = (x / TW) * NX, v = (y / TH) * NY;
    const i = Math.floor(u), j = Math.floor(v);
    const fu = ease(u - i), fv = ease(v - j);
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
    const bot = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
    // Stretched, because the average of four uniforms sits near a half and
    // a field that never reaches its ends has no drifts in it, only a haze.
    const d = clamp(0.5 + (top + (bot - top) * fv - 0.5) * 1.9, 0, 1);
    /*
     * Which of the seven values: the drift, a little roll so a drift has no
     * edge, and three things that darken a brick where it is. A course or
     * two under a band course is in the drip of it; the foot of a wall and
     * the brick under a crest of ivy are damp, which is what the moss was
     * saying, but said as damp and not as a khaki brick; and a header is the
     * end of the brick, which is the end that went into the fire first.
     */
    let k = Math.round((d - 0.5) * 5.2 + (RR() - 0.5) * 1.3);
    if (drip) k -= 1;
    if (course >= COURSES - 1 || crests.some(([a, b]) => x > a && x < b)) k -= 1;
    if (head) k -= 1;
    if (washed && Math.abs(x - washX) < washW) k += 2;
    k = clamp(k, -3, 3);
    const t = RR();
    /*
     * One unit in twelve off another part of the kiln, near enough in value
     * to its neighbours that it is a brick and not a hole -- and where that
     * part of the kiln put it: the over-fired ones in the scorched drift,
     * the soft ones in the pale, so they come in clusters rather than as a
     * sprinkle of singles over the whole wall.
     */
    if (d < 0.32 && t < 0.16) return head || t < 0.07 ? 'burnt' : 'brown';
    if (d > 0.68 && t < 0.12) return 'warm';
    if (t < 0.02) return 'brown';
    return (RR() < (S.master ? 0.05 : 0.15) ? 'p' : 'f') + k;
  };
}

/**
 * A course of dressed stone standing proud of what is under it: the shade
 * it throws down the wall, and the arris of it taking the light above.
 */
export function oversail(kit: Kit, g: Ctx, top: number, y: number, deep: number): void {
  const { PASTEL } = kit;
  // The shade it throws down the wall: hard for a hand's width under the
  // arris and then gone, and cool, as every shadow on this island is.
  const sh = g.createLinearGradient(0, y, 0, y + deep);
  sh.addColorStop(0, 'rgba(40, 32, 62, 0.46)');
  sh.addColorStop(0.35, 'rgba(40, 32, 62, 0.3)');
  sh.addColorStop(1, 'rgba(40, 32, 62, 0)');
  g.fillStyle = sh;
  g.fillRect(0, y, TW, deep);
  // And its top, weathered and turned up at the sky: a step lighter than
  // its face, which is the whole of what says the course stands out.
  const lit = g.createLinearGradient(0, top, 0, top + 7);
  lit.addColorStop(0, hexA(PASTEL.dressHi, 0.62));
  lit.addColorStop(1, hexA(PASTEL.dressHi, 0));
  g.fillStyle = lit;
  g.fillRect(0, top, TW, 7);
}

/**
 * And a garden wall in a bond, which is the same lay at the same unit size
 * as the house: the courses are counted off the room under the coping
 * rather than divided into it, so a brick is a brick however high the wall
 * is. There is no header course in it -- a wall you can see over is one
 * unit thick, and there is nothing for a header to bond to.
 */
function lowBond(kit: Kit, g: Ctx, R: Rand, fh: number, rows: number): Block[] {
  const { S, MORTAR } = kit;
  const top = COPE;
  const own: Block[] = [];
  const zone = firing(kit, R);
  const n = S.across;
  const HR = rand(3121);
  const hs: number[] = [];
  let tot = 0;
  for (let i = 0; i < rows; i++) { const w = (S.slab ? 0.85 + 0.3 * HR() : S.master ? 0.975 + 0.05 * HR() : 0.92 + 0.16 * HR()) * rhythmOf(kit, i); hs.push(w); tot += w; }
  const tops: number[] = [top];
  for (let i = 0; i < rows; i++) tops.push(tops[i] + ((fh - top) * hs[i]) / tot);
  for (let i = 0; i < rows; i++) {
    const y0 = tops[i], ch = tops[i + 1] - y0;
    // The course under the cope of an ornate wall is its dogtooth, laid after.
    if (S.ornate && i === 0) continue;
    const lap = (i % 2) * 0.5;
    const kw = 1 + Math.floor(R() * 2), aw = ch * (S.master ? 0.015 : 0.17) * (R() < 0.5 ? -1 : 1);
    const units: Array<[number, number, boolean]> = S.ornate ? flemishOf(i) : unitsOf(kit, n, lap, R, 1733 + i * 17).map(([x, w]): [number, number, boolean] => [x, w, false]);
    for (const [x, uw, hd] of units) {
      const mid = clamp(x + uw / 2, EDGE, TW - EDGE);
      const seam = x < 0 || x + uw > TW;
      const RR = seam ? rand(647 + i * 11) : R;
      const priv = x + MORTAR / 2 > EDGE && x + uw - MORTAR / 2 < TW - EDGE;
      const sag = Math.sin((Math.PI * kw * (mid - EDGE)) / (TW - 2 * EDGE)) * aw;
      // A garden wall was laid out of what was left over, so it carries the
      // weathered and the bleached units a house wall was picked clear of.
      const tone = S.ornate && hd && diaperAt(x + uw / 2, i) ? 'diaper'
        : !seam && RR() < 0.08 ? fieldTone(kit, RR)
          : zone(RR, seam ? 0 : x + uw / 2, y0, hd, i + COURSES - rows, [], i === 0);
      const jw = MORTAR + (priv ? RR() * (S.master ? 0.5 : 2.2) : 0);
      const drift = (RR() - 0.5) * (S.master ? 0.5 : 2.4) + sag;
      const shrink = RR() * (S.master ? 0.5 : 2);
      /*
       * The bottom course runs past the picture and the canvas edge cuts
       * it, the way the hedge at its foot already does: a wall a metre and
       * a quarter high is mostly its ground line, and a ruled one shows.
       */
      const bh = ch - MORTAR - shrink + (i === rows - 1 ? 4 + RR() * 4 : 0);
      const b: Block = { x: x + jw / 2, y: y0 + MORTAR / 2 + drift + shrink / 2, w: uw - jw, h: bh, course: i, pts: [] };
      b.pts = stone(kit, g, b.x, b.y, b.w, b.h, RR, tone, 'unit', priv && RR() < 0.3 ? (RR() - 0.5) * (S.master ? 0 : 0.014) : 0, 1.35);
      if (priv && b.w > 24) own.push(b);
    }
  }
  if (S.ornate) dogtooth(kit, g, tops[0], tops[1]);
  return own;
}

/** Under a bond laid with its grain showing or by a master, the joint; under any other, nothing. */
function bondUnder(kit: Kit): [number, number, number] | undefined { const { S, PASTEL } = kit; return S.grain || S.master ? channels(PASTEL.joint) : undefined; }

/** A moulded unit laid to a line in a half lap, dressed in cut stone: brick, stone brick, sandstone. */
export const BOND_LAY: Lay = {
  ...LAID_LAY,
  courses: paintBond,
  lowCourses: lowBond,
  quoins,
  under: bondUnder,
};
