import { COPE, LEVEL, PROUD, copeSeed } from './coping';
import { BAND, CAP_H, CH, TH, TW, clamp, cnv, ctxOf, rand } from './draw';
import { blades, hedge, mossFleck, mossLens } from './growth';
import type { Kit } from './kit';
import { FENCE_GAP, OVER } from './openings';
import { abrade, chipCorner, crack, masterWeather, pits, recessed, slop, spall } from './stone';
import type { Low, Pt } from './types';
import { VARIANTS } from './variants';

/**
 * The garden wall, at whatever height is asked for: its face, cap, end, gate and crest.
 */

/**
 * The pillows a mud garden wall's cap is laid in, by the variant's cope
 * seed: where each armful meets the next, and how high it stands between.
 * The lengths are what an armful of mud made, three quarters of a metre to
 * a metre and a half, each its own height; four equal ones to a section
 * were a wave you could count along a street. A section starts and ends on
 * a joint, so the cap arrives at a seam where it left.
 */
export function pillowsOf(seed: number): { joints: number[]; peaks: number[] } {
  const R = rand(seed + 19);
  const joints: number[] = [0];
  for (;;) {
    const at = joints[joints.length - 1] + 96 + R() * 96;
    if (at > TW - 80) break;
    joints.push(at);
  }
  joints.push(TW);
  return { joints, peaks: joints.slice(1).map(() => 8 + R() * 8) };
}

/** How far a cap of pillows rises over the head of its wall at `x`: nothing at a joint, the pillow's height at its middle. */
function pillowRise(p: { joints: number[]; peaks: number[] }, x: number): number {
  let j = 0;
  while (j < p.joints.length - 2 && x > p.joints[j + 1]) j++;
  const t = clamp((x - p.joints[j]) / (p.joints[j + 1] - p.joints[j]), 0, 1);
  return p.peaks[j] * Math.pow(Math.sin(Math.PI * t), 0.7);
}

/** A low wall's face, per variant, `fh` tall over `PROUD` for its coping: its body, coping and weather, and on a masonry that has growth its moss, hedge and turf. */
function lowFaces(kit: Kit, fh: number, rows: number): HTMLCanvasElement[] {
  const { S, PASTEL, LAY, MORTAR } = kit;
  return VARIANTS.map((v, vi) => {
    const c = cnv(TW, fh + PROUD), g = ctxOf(c);
    g.translate(0, PROUD);
    const R = rand(v.seed * 83 + 5);
    g.fillStyle = PASTEL.joint; g.fillRect(0, 0, TW, fh);
    const own = LAY.lowCourses(kit, g, R, fh, rows, vi);
    LAY.levelling?.(kit, g, R);
    // The head of a low wall of logs is the top of its topmost log, and of
    // planks the cap board its boards are painted with: those have no coping.
    LAY.coping?.(kit, g, copeSeed(v.seed));
    // At the stock's own rate of wear, as the tall wall's is: a garden wall
    // of brick took the whole of a novice's rubble's and was specked with it.
    const k = S.wear;
    if (S.master) masterWeather(kit, g, own, R);
    else for (const s of own) {
      const t = R();
      if (t < 0.18 * k) chipCorner(kit, g, s, R);
      else if (t < 0.34 * k) crack(kit, g, s, R);
      else if (t < 0.41 * k) spall(kit, g, s, R);
      else if (t < 0.46 * k) recessed(kit, g, s, R);
      if (R() < 0.22 * k) abrade(kit, g, s, R);
      if (R() < 0.25 * k) pits(kit, g, s, R);
      if (R() < 0.15 * k) slop(kit, g, s, R);
    }
    // The damp along the ground, then moss in the low joints, then the hedge.
    g.fillStyle = 'rgba(110,100,80,0.16)'; g.fillRect(0, fh - 9, TW, 9);
    if (!S.growth) return c;
    const lowest = own.filter((s) => s.course >= rows - 2);
    for (let i = 0; i < v.extras.moss && lowest.length; i++) {
      const s = lowest[Math.floor(R() * lowest.length)];
      mossLens(g, s, R() < 0.4 ? fh + 1 : s.y - MORTAR / 2, R);
    }
    for (let i = 0; i < 3 + Math.floor(R() * 4) && lowest.length; i++) mossFleck(g, lowest[Math.floor(R() * lowest.length)], R);
    /*
     * The hedge, cut to the wall it is at the foot of. The variants' hedges
     * were sized against three metres of wall; dropped whole onto one and a
     * quarter they came up over the coping and the fence was a hedge with
     * some stone showing through it.
     */
    const body = fh - COPE - LEVEL;
    for (const b of v.foot.hedges) {
      hedge(kit, g, { ...b, w: b.w * 0.78, h: Math.min(b.h * 0.72, body * 0.62) }, rand(b.seed), fh);
    }
    /*
     * And the turf at the foot of it. A wall does not stop at a ruled line
     * either: the bottom course is bedded an inch or two into the ground
     * and the grass comes up at it, so a few tufts break the bottom edge
     * the way the proud stones break the top one.
     */
    for (let i = 0; i < 5 + Math.floor(R() * 4); i++) {
      blades(kit, g, 6 + R() * (TW - 12), fh - 1 - R() * 3, 20 + R() * 20, 14 + R() * 16, R);
    }
    return c;
  });
}

/** The coping from above: the same run of stones, laid across the thickness. */
function lowCaps(kit: Kit): HTMLCanvasElement[] {
  const { LAY } = kit;
  return VARIANTS.map((v) => {
    const c = cnv(TW, CAP_H + PROUD), g = ctxOf(c);
    g.translate(0, PROUD);
    LAY.lowCap(kit, g, v);
    return c;
  });
}

/**
 * And the end of a run, where the thickness shows.
 *
 * It was four slabs the width of the wall stacked up, which is a slice
 * cut out of a cake rather than the end of anything built. The head of a
 * dry wall is the hardest part of it to lay and the part that shows the
 * mason: two stones to a course set the other way about, with the joint
 * between them on the other side each course up, so the two skins are
 * tied into each other the whole way to the top. The cope shows its
 * width as two or three stone ends, not as one.
 */
function lowEndsPicture(kit: Kit, fh: number, rows: number): HTMLCanvasElement {
  const { LAY } = kit;
  return (() => {
    const Wc = 64, c = cnv(Wc, fh), g = ctxOf(c), R = rand(11);
    LAY.lowEnds(kit, g, R, Wc, fh, rows);
    return c;
  })();
}

function lowGates(kit: Kit, fh: number, face: HTMLCanvasElement[], gx0: number, gx1: number): HTMLCanvasElement[] {
  const { LAY } = kit;
  return VARIANTS.map((v, i) => {
    const c = cnv(TW, fh + PROUD), g = ctxOf(c);
    g.translate(0, PROUD);
    g.drawImage(face[i], 0, -PROUD);
    const R = rand(v.seed * 197 + 71);
    for (const side of [-1, 1]) {
      const line = side < 0 ? gx0 : gx1;
      LAY.gatePier?.(kit, g, R, side, line, fh);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(gx0, -PROUD, gx1 - gx0, fh + PROUD);
    g.globalCompositeOperation = 'source-over';
    LAY.gateAfter?.(kit, g, R, fh, gx0, gx1);
    return c;
  });
}

/**
 * And the top of that wall, with the gap taken out.
 *
 * The cap was laid across the whole section whether or not there was a
 * section under it, so a gate had the top of the wall painted straight
 * over its opening. It is cut to the gap here rather than clipped at the
 * draw, because a texture that is wrong is wrong once.
 *
 * What is left over the piers is not coping. A cope on edge is laid along
 * a wall; a pier is finished with one flat stone, and that stone is what
 * makes a step up at a gateway read as a gateway rather than as two
 * crews who did not measure.
 */
function lowGateCaps(kit: Kit, cap: HTMLCanvasElement[], gx0: number, gx1: number): HTMLCanvasElement[] {
  const { LAY } = kit;
  return VARIANTS.map((v, i) => {
    const c = cnv(TW, cap[i].height), g = ctxOf(c), R = rand(v.seed * 311 + 29);
    g.drawImage(cap[i], 0, 0);
    g.translate(0, PROUD);
    for (const side of [-1, 1]) {
      const x = side < 0 ? gx0 + OVER - 52 : gx1 - OVER;
      LAY.gateCapPier(kit, g, R, x);
    }
    // Last, not first. The pier stones overhang into the gap the way every
    // other dressed stone in this file does, and cutting before drawing
    // them left ten pixels of each one projecting over the opening with
    // nothing under it -- a tongue of stone hanging in the gateway.
    g.clearRect(gx0, -PROUD, gx1 - gx0, c.height);
    return c;
  });
}

/*
 * How far the head of the low wall rises over its line along a section:
 * the pillows of its cap, by variant; and at a gate, over each pier a
 * dome standing a hand clear of the wall, and nothing over the gap.
 */
function lowCrests(gx0: number, gx1: number): { crest: number[][]; gateCrest: number[][] } {
  const crest = VARIANTS.map((v) => {
    const p = pillowsOf(copeSeed(v.seed));
    return Array.from({ length: 65 }, (_, i) => pillowRise(p, (i / 64) * TW));
  });
  const gateCrest = VARIANTS.map((v) => {
    const p = pillowsOf(copeSeed(v.seed));
    const piers: Pt[] = [[gx0 + OVER - 52, gx0 + OVER], [gx1 - OVER, gx1 - OVER + 52]];
    return Array.from({ length: 129 }, (_, i) => {
      const x = (i / 128) * TW;
      for (const [a, b] of piers) {
        if (x < a || x > b) continue;
        const u = (x - (a + b) / 2) / ((b - a) / 2);
        return 10 + 12 * Math.sqrt(Math.max(0, 1 - u * u));
      }
      return x > gx0 + OVER && x < gx1 - OVER ? 0 : pillowRise(p, x);
    });
  });
  return { crest, gateCrest };
}

/**
 * The low wall, at whatever height is asked for, painted once per height.
 *
 * Everything a fence carries is in the one picture, because a fence has no
 * openings to clip growth out of and no storey above it to belong to: the
 * courses, the coping, the weather, the moss in its low joints, the hedge
 * and the turf at its foot and the damp along its ground line.
 *
 * Nothing grows on the top of it. A dry coping holds whatever blows into
 * its joints and it had four metres of grass and moss and a hanging drape
 * to show for it; the wall is barer without them and it is the coping you
 * look at now, which is the point of a coping.
 */
export function low(kit: Kit, k: number): Low {
  const { LOWS, S, LAY } = kit;
  const had = LOWS.get(k);
  if (had) return had;
  const fh = Math.max(COPE + LEVEL + 70, Math.round(TH * k));
  // As many courses as the room under the coping and its levelling course
  // allows, at the size the tall wall's stones are, so a fence and a house
  // are the same masonry rather than the same masonry and some brickwork.
  const unitH = S.lay === 'bond' ? (TH - BAND) / S.rows : CH * 0.66;
  const rows = Math.max(S.lay === 'bond' ? 3 : 2, Math.round((fh - COPE - LEVEL) / unitH));
  const face = lowFaces(kit, fh, rows);
  const cap = lowCaps(kit);
  const ends = lowEndsPicture(kit, fh, rows);
  /*
   * And the same wall with a gate in it: the field, then a pier laid up each
   * side of the gap and overhanging into it, and then the gap taken out of
   * the lot in one pass -- the way every other opening in this file is made.
   * The pier gets a flat stone of its own on top instead of the coping,
   * because a cope on edge is a thing you lay along a wall, not the thing
   * you finish a pier with.
   */
  const gx0 = TW * FENCE_GAP.t0, gx1 = TW * FENCE_GAP.t1;
  const gate = lowGates(kit, fh, face, gx0, gx1);
  const gateCap = lowGateCaps(kit, cap, gx0, gx1);
  const { crest, gateCrest } = lowCrests(gx0, gx1);
  const post = LAY.lowPost?.(kit, fh);
  /** The cope stone over a corner or a junction (`Low.corner`), laid across the run's thickness as the cap's are. */
  const corner = LAY.lowCorner?.(kit);
  const made: Low = { face, gate, cap, gateCap, ends, h: fh, proud: PROUD, crest, gateCrest, post, corner };
  LOWS.set(k, made);
  return made;
}
