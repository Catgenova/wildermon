import { css, hex, mix, type Tone } from '../core';
import { box, BUILDERS, byRole, ownerOf, REFUGE_OUT, refugeHalf, refugeOutline, runeLine, turned, U, type BridgePainter, type Kit, type L, type Part3, type Role } from './core';
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

type ST = [number, number];

/** Upright faces along a run of (s, t) points from `z0` to `z1`, each turned away from `from`, cut to the slice; painted as brick in its own frame. */
function upright(k: Kit, part: Part3, line: ST[], z0: number, z1: number, tone: Tone, from: ST, role: Role | null, seed: number): void {
  for (let q = 0; q + 1 < line.length; q++) {
    const [a, b] = [line[q], line[q + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-4) continue;
    const m: ST = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const out: L = [m[0] - from[0], m[1] - from[1], 0];
    const fr = { o: [a[0], a[1], 0] as L, a: [(b[0] - a[0]) / len / U, (b[1] - a[1]) / len / U, 0] as L, b: [0, 0, 1] as L };
    cface(k, part, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], out, tone, role ? fi(role, 0, len * U, z0, z1, seed + q) : undefined, role ? fr : undefined);
  }
}

/** A run of (s, t) points pulled toward `c` by `fs` along the bridge and `ft` across it. */
const toward = (line: ST[], c: ST, fs: number, ft: number): ST[] => line.map(([s0, t0]) => [c[0] + (s0 - c[0]) * fs, c[1] + (t0 - c[1]) * ft]);

/**
 * Over each pier of a bridge two lanes wide or more, a refuge on the core's
 * outline (`refugeOutline`, a half-hexagon stepped out over the pier): a
 * brick buttress of the same plan standing on the ground, three courses
 * corbelled out from it, the floor in the deck's pavers, its edge the
 * cornice's, and round it a wall of the parapet's brick under the dark
 * coping, the parapet's rune line along it; at three lanes a lamp in it.
 */
function refuges(k: Kit): void {
  const { plan, sl, st } = k;
  const H = st.parapetHeight ?? 10, T = 0.09, cop = 1.6;
  for (const p of plan.piers) {
    if (p.end) continue;
    const half = refugeHalf(p);
    if (p.s + half < sl.s0 - 0.02 || p.s - half > sl.s1 + 0.02) continue;
    const z = plan.deck(p.s), zb = z - plan.thick - 1.4;
    for (const edge of sl.edges) {
      const t = edge > 0 ? sl.t1 : sl.t0;
      const part: Part3 = edge === sl.near ? 'rail' : 'front';
      const line = refugeOutline(plan, p, edge, t) as ST[];
      const c: ST = [p.s, t - edge * 0.12];
      // The floor, and its edge the cornice's.
      k.solid('front', k.ord(edge, 0.9));
      cface(k, 'front', line.map(([s0, t0]) => [s0, t0, z] as L), [0, 0, 1], PAVER, fi('deck', 0, 1, 0, 1, 1), { o: [0, 0, z], a: [1 / U, 0, 0], b: [0, 1 / U, 0] });
      upright(k, 'front', line, zb, z, st.trim, c, 'cornice', 0);
      if (seen(k, edge)) {
        // Three courses corbelled out, and the buttress under them on the ground.
        const at: ST = [p.s, t];
        for (let q = 0; q < 3; q++) {
          k.solid('front', k.ord(edge, 0.85 - q * 0.01));
          upright(k, 'front', toward(line, at, 0.94 - 0.06 * q, 0.9 - 0.12 * q), zb - (q + 1) * 2.6, zb - q * 2.6, BRICK, c, 'pier', q * 7);
        }
        const foot = Math.min(...line.map(([s0, t0]) => plan.ground(s0, t + (t0 - t) * 0.5))) - 0.5;
        k.solid('front', k.ord(edge, 0.8));
        upright(k, 'front', toward(line, at, 0.76, 0.54), foot, zb - 3 * 2.6, BRICK, c, 'pier', 31);
      }
      // The wall round it, its coping, and where it meets the parapet's ends.
      const inner = line.map(([s0, t0], i): ST => {
        const ends = i === 0 || i === line.length - 1;
        return ends ? [s0 + (i === 0 ? T : -T) * 1.2, t0 - edge * T] : [s0 + (s0 < p.s ? T : -T) * 0.6, t0 - edge * T];
      });
      k.solid(part, 2);
      upright(k, part, line, z, z + H - cop, DEEP, c, 'parapet', 3);
      upright(k, part, inner, z, z + H - cop, DEEP, [c[0], c[1] + edge * 2], 'parapet', 5);
      const zc = z + H;
      k.solid(part, 2.1);
      for (let q = 0; q + 1 < line.length; q++) {
        const o0 = line[q], o1 = line[q + 1], i0 = inner[q], i1 = inner[q + 1];
        const grow = (pt: ST, from: ST, d: number): ST => { const l = Math.hypot(pt[0] - from[0], pt[1] - from[1]) || 1; return [pt[0] + ((pt[0] - from[0]) / l) * d, pt[1] + ((pt[1] - from[1]) / l) * d]; };
        const [O0, O1] = [grow(o0, i0, 0.012), grow(o1, i1, 0.012)], [I0, I1] = [grow(i0, o0, 0.012), grow(i1, o1, 0.012)];
        cface(k, part, [[O0[0], O0[1], zc], [O1[0], O1[1], zc], [I1[0], I1[1], zc], [I0[0], I0[1], zc]], [0, 0, 1], st.trim);
        upright(k, part, [O0, O1], zc - cop, zc, st.trim, c, 'cap', q);
        const a = Math.max(Math.min(o0[0], o1[0]), sl.s0), b = Math.min(Math.max(o0[0], o1[0]), sl.s1);
        if (b > a + 1e-4) {
          const tAt = (s0: number): number => o0[1] + ((o1[1] - o0[1]) * (s0 - o0[0])) / ((o1[0] - o0[0]) || 1e-6);
          k.glow.lines.push([k.m([a, tAt(a) + edge * 0.004, zc - cop * 0.5]), k.m([b, tAt(b) + edge * 0.004, zc - cop * 0.5])]);
        }
      }
      // The parapet's ends meet it a little inside: fill the corner.
      for (const [s0, s1] of [[line[0][0], line[0][0] + T * 1.2], [line[line.length - 1][0] - T * 1.2, line[line.length - 1][0]]]) {
        box(k, part, s0, s1, Math.min(t, t - edge * T), Math.max(t, t - edge * T), z, z + H - cop, DEEP, 'parapet', 1.9);
      }
      if (plan.width >= 3 && ownerOf(k, p.s - 0.05, p.s + 0.05) !== null) lampPost(k, part, p.s, t + edge * REFUGE_OUT * 0.5, z, st.trim);
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
