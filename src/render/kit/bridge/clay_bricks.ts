import { css, hex, mix, type Tone } from '../core';
import { box, BUILDERS, byRole, ownerOf, refugeGaps, runeLine, turned, U, type BridgePainter, type Kit, type L, type Part3 } from './core';
import { stoneBase } from './base';
import { arcade, brickPaint, cface, fi, herringbonePaint, lampPost, ringPaint, runeKey, seen, tilePaint, vaultPaint } from './clay';

/**
 * Clay bricks: the brick of the island's brick houses (`BRICK` in
 * `masonry.ts`), in its own field tone and mortar, dressed as they are in a
 * slate-mauve cut stone -- copings, cornice, imposts, keystones, the newels'
 * caps. Brick arches of two rings of voussoirs on edge, radiating, as deep at
 * the springing as at the crown; herringbone pavers on the deck, as the
 * houses' floors; stone treads on a ramp, as their stairs.
 */

const MORTAR = '#8e6f67';
/** The houses' cut stone, the dark of their quoins and dressings: copings, courses, imposts, keystones, quoins. */
const DRESS: Tone = { lit: hex('#8c879a'), shade: hex('#58556a') };
/** The field brick, the houses' own; the arch's rubbed brick, a step paler and warmer, in a pale fine joint; the parapet's, a step deeper. */
const BRICK: Tone = { lit: hex('#cf7f6d'), shade: hex('#98524f') };
const RUBBED: Tone = { lit: hex('#e9a983'), shade: hex('#b8735f') };
const DEEP: Tone = { lit: hex('#b96a60'), shade: hex('#7f4448') };
/** The pavers: a buff brick, worn paler than the walls. */
const PAVER: Tone = { lit: hex('#dcb7a0'), shade: hex('#a68a84') };

const brick = brickPaint(2.6, 6.6, MORTAR);

/** A cut-stone band: long stones, a groove ruled along it. */
const bandPaint: BridgePainter = (g, k, f) => {
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1), y0 = Math.min(f.y0, f.y1), y1 = Math.max(f.y0, f.y1);
  const p = new Path2D();
  for (let x = Math.floor(x0 / 11) * 11; x < x1; x += 11) { p.moveTo(x, y0 - 1); p.lineTo(x, y1 + 1); }
  g.strokeStyle = css(mix(k.fill, hex('#4f4a5c'), 0.35), 0.75);
  g.lineWidth = 0.3;
  g.stroke(p);
  g.beginPath(); g.moveTo(x0 - 1, y0 + (y1 - y0) * 0.3); g.lineTo(x1 + 1, y0 + (y1 - y0) * 0.3);
  g.strokeStyle = css(mix(k.fill, hex('#4f4a5c'), 0.3), 0.6);
  g.lineWidth = 0.28;
  g.stroke();
};

/** The parapet: the core's wall and coping in the deeper brick, with a pilaster over each pier where no refuge breaks it. */
function parapet(k0: Kit, edge: number, part: Part3): void {
  const k: Kit = { ...k0, st: { ...k0.st, stone: DEEP } };
  BUILDERS.parapet(k, edge, part);
  const { plan, sl, st } = k;
  if (plan.width >= 2) return;
  const H = st.parapetHeight ?? 10;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const ta = tOut + edge * 0.024, tb = tOut - edge * 0.112;
  const [t0, t1] = [Math.min(ta, tb), Math.max(ta, tb)];
  for (const p of plan.piers) {
    if (p.end) continue;
    const w = 0.075, z = plan.deck(p.s);
    box(k, part, p.s - w, p.s + w, t0, t1, z, z + H + 0.4, DEEP, 'parapet', 2.5);
    box(k, part, p.s - w - 0.014, p.s + w + 0.014, t0 - 0.014, t1 + 0.014, z + H + 0.4, z + H + 2, st.trim, 'cap', 2.6);
  }
}

/**
 * Over each pier of a bridge two lanes wide or more, a refuge: a brick
 * buttress standing out from the pier, three courses corbelled out over it,
 * and on them a bay of deck stepped out from the parapet's line, walled round
 * on its three sides in the parapet's brick and coping, dark quoins at its
 * corners; at three lanes a lamp in it.
 */
function refuges(k: Kit): void {
  const { plan, sl, st } = k;
  const gaps = refugeGaps(plan);
  const H = st.parapetHeight ?? 10, T = 0.09, cop = 1.6;
  for (const [gi, p] of plan.piers.filter((q) => !q.end).entries()) {
    const [g0, g1] = gaps[gi];
    if (g1 < sl.s0 - 0.05 || g0 > sl.s1 + 0.05) continue;
    const z = plan.deck(p.s), zb = z - plan.thick - 1.4;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const P = 0.3, Pb = 0.18, wb = Math.min(p.half * 0.8, (g1 - g0) / 2 - 0.05);
      const tt = (d: number): [number, number] => (edge > 0 ? [t - 0.002, t + d] : [t - d, t + 0.002]);
      // The floor stepped out, its edge the cornice's.
      const [fa, fb] = tt(P);
      box(k, 'front', g0, g1, fa, fb, zb, z - 0.02, st.trim, 'cornice', k.ord(edge, 0.9));
      const floor: L[] = [[g0, fa, z], [g1, fa, z], [g1, fb, z], [g0, fb, z]];
      k.solid('front', k.ord(edge, 0.95));
      cface(k, 'front', floor, [0, 0, 1], PAVER, fi('deck', g0 * U, g1 * U, fa * U, fb * U, gi), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
      if (seen(k, edge)) {
        // Three courses corbelled out, and the buttress under them.
        for (let c = 0; c < 3; c++) {
          const d = Pb + ((P - Pb) * (2 - c)) / 3, [ca, cb] = tt(d), w = wb + (((g1 - g0) / 2 - wb) * (2 - c)) / 3;
          box(k, 'front', p.s - w, p.s + w, ca, cb, zb - (c + 1) * 2.6, zb - c * 2.6, BRICK, 'pier', k.ord(edge, 0.85 - c * 0.01));
        }
        const [ba, bb] = tt(Pb);
        const foot = Math.min(plan.ground(p.s - wb, t + edge * Pb), plan.ground(p.s + wb, t + edge * Pb), plan.ground(p.s, t)) - 0.5;
        const top = zb - 3 * 2.6;
        box(k, 'front', p.s - wb, p.s + wb, ba, bb, foot, top, BRICK, 'pier', k.ord(edge, 0.8));
        // Quoins up its two front corners, long and short by turns round each.
        for (let zq = foot, j = 0; zq < top - 0.5; zq += 5.2, j++) {
          const z1 = Math.min(top, zq + 5.2), w = Math.min(wb * 0.7, j % 2 ? 0.11 : 0.065), d = j % 2 ? 0.065 : 0.11;
          for (const side of [-1, 1]) {
            const sc = p.s + side * wb, a = Math.min(sc, sc - side * w), b = Math.max(sc, sc - side * w);
            if (ownerOf(k, a - 0.01, b + 0.01) === null) continue;
            box(k, 'front', a - (side < 0 ? 0.006 : 0), b + (side > 0 ? 0.006 : 0), ...tt(Pb + 0.006).map((v, i) => (i === (edge > 0 ? 0 : 1) ? t + edge * (Pb - d) : v)) as [number, number], zq, z1, st.trim, 'plinth', k.ord(edge, 0.82));
          }
        }
      }
      // The walls round it, front and two sides, and their coping.
      const [wa, wbT] = tt(P);
      const front: [number, number] = edge > 0 ? [wbT - T, wbT] : [wa, wa + T];
      const [sa, sb] = edge > 0 ? [t - T, wbT] : [wa, t + T];
      box(k, part, g0, g1, front[0], front[1], z, z + H - cop, DEEP, 'parapet', 2);
      for (const s0 of [g0, g1 - T]) box(k, part, s0, s0 + T, sa, sb, z, z + H - cop, DEEP, 'parapet', 2);
      box(k, part, g0 - 0.012, g1 + 0.012, front[0] - 0.012, front[1] + 0.012, z + H - cop, z + H, st.trim, 'cap', 2.1);
      for (const s0 of [g0, g1 - T]) box(k, part, s0 - 0.012, s0 + T + 0.012, sa - 0.012, sb + 0.012, z + H - cop, z + H, st.trim, 'cap', 2.1);
      const tg = edge > 0 ? front[1] + 0.004 : front[0] - 0.004;
      const ga = Math.max(g0, sl.s0), gb = Math.min(g1, sl.s1);
      if (gb > ga) k.glow.lines.push([k.m([ga, tg, z + H - cop * 0.5]), k.m([gb, tg, z + H - cop * 0.5])]);
      if (plan.width >= 3 && ownerOf(k, p.s - 0.05, p.s + 0.05) !== null) lampPost(k, part, p.s, t + edge * P * 0.5, z, st.trim);
    }
  }
}

/** A brick gate pier at each end of each outer edge: a stone plinth, a brick shaft, a stone cap and a stone ball on it. */
function ends(k: Kit): void {
  const { plan, sl, st } = k;
  const pier = (part: Part3, s: number, t: number, z: number): void => {
    if (ownerOf(k, s - 0.085, s + 0.085) === null) return;
    const H = (st.parapetHeight ?? 10) + 3;
    box(k, part, s - 0.085, s + 0.085, t - 0.085, t + 0.085, z, z + 1.8, st.trim, 'plinth', 3);
    box(k, part, s - 0.072, s + 0.072, t - 0.072, t + 0.072, z + 1.8, z + H - 1.2, st.stone, 'post', 3.1);
    box(k, part, s - 0.085, s + 0.085, t - 0.085, t + 0.085, z + H - 1.2, z + H + 0.5, st.trim, 'cap', 3.2);
    turned(k, part, s, t, z + H + 0.5, [[0, 0.03], [0.5, 0.022], [1, 0.036], [2.1, 0.05], [3.3, 0.04], [4, 0.014], [4.3, 0]], 8, st.trim, 3.3);
  };
  for (const edge of sl.edges) {
    const t = edge > 0 ? sl.t1 - 0.085 : sl.t0 + 0.085;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    if (sl.i === 0) pier(part, 0.085, t, plan.deck(0.085));
    if (sl.i === plan.n - 1) pier(part, plan.n - 0.085, t, plan.deck(plan.n - 0.085));
  }
}

/** Clay bricks: brick voussoirs, brick coursing, a brick parapet on a stone coping. */
export const clay_bricks = stoneBase('clay_bricks', {
  stone: BRICK,
  ring: RUBBED,
  trim: DRESS,
  deck: PAVER,
  parapet: 'brick',
  ringDepth: 5.2,
  rune: 'kenaz',
  paint: byRole({
    wall: brick, pier: brick, parapet: brick, post: brick,
    ring: ringPaint('#f6e6d6', vaultPaint(2.6, 6.6, MORTAR)),
    key: runeKey('kenaz', 0.46),
    cap: runeLine('kenaz'),
    cornice: bandPaint,
    deck: herringbonePaint(2.3, '#c9b3a2'),
    tread: tilePaint(40 / 3, '#6a6476', DRESS),
  }),
  build: {
    arches: arcade({ ringD: 4.6, proud: 0.03, ring: 'voussoir', key: 'wedge', keyTone: (st) => st.trim, pier: 'cutwater', impost: (st) => st.trim, quoins: (st) => st.trim, refugePier: true, inner: () => ({ lit: hex('#9a5a54'), shade: hex('#6e3f44') }) }),
    parapet,
    ends,
    refuges,
    deck: (k) => BUILDERS.deck(k),
  },
});
