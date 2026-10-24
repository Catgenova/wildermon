import { glyphPath, RUNE_GOLD, RUNE_WHITE } from '../../runestone';
import { css, hex, mix, type Tone } from '../core';
import { box, BUILDERS, byRole, ownerOf, REFUGE_OUT, refugeHalf, refugeLine, refugeOutline, turned, U, type BridgePainter, type Kit, type L, type Part3, type Role } from './core';
import { stoneBase } from './base';
import { arcade, brickPaint, cface, fi, herringbonePaint, lampPost, refuged, ringPaint, runeKey, seen, whole, tilePaint, vaultPaint } from './clay';

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

/** The walls' brick in a lime mortar paler than the brick, a band of burnt headers every seventh course. */
const brick = brickPaint(2.6, 6.6, '#e3d3c3', 7);

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

/**
 * The rune line along the dark coping, inlaid broad enough in pale gold that
 * the night, which shows what lies under it, has something bright to show:
 * a groove, the gold in it, little runes along it.
 */
function boldRuneLine(glyph: string): BridgePainter {
  return (g, k, f) => {
    const y = (f.y0 + f.y1) / 2;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(f.x0 - 1, y); g.lineTo(f.x1 + 1, y);
    g.strokeStyle = css(mix(k.fill, hex('#3e3a4c'), 0.45), 0.9);
    g.lineWidth = 0.75;
    g.stroke();
    g.strokeStyle = css(mix(hex(RUNE_GOLD), hex(RUNE_WHITE), 0.35));
    g.lineWidth = 0.42;
    g.stroke();
    for (let x = Math.ceil(Math.min(f.x0, f.x1) / 10) * 10; x < Math.max(f.x0, f.x1); x += 10) {
      glyphPath(g, glyph, x, y, 0.5);
      g.strokeStyle = css(hex(RUNE_GOLD), 0.9);
      g.lineWidth = 0.14;
      g.stroke();
    }
  };
}

/** The parapet: the core's wall and coping in the deeper brick, with a pilaster over each pier where no refuge breaks it. */
function parapet(k0: Kit, edge: number, part: Part3): void {
  const k: Kit = { ...k0, st: { ...k0.st, stone: DEEP } };
  BUILDERS.parapet(k, edge, part);
  const { plan, sl, st } = k;
  if (plan.width >= 2 || plan.ramp) return;
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
function refuges(k0: Kit): void {
  const { plan, sl, st } = k0;
  if (!refuged(plan)) return;
  const H = st.parapetHeight ?? 10, T = 0.09, cop = 1.6;
  for (const p of plan.piers) {
    if (p.end) continue;
    const half = refugeHalf(p);
    const k = whole(k0, p.s - half, p.s + half);
    if (!k) continue;
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
      // The wall round it and its coping, between the outline and itself moved in, mitred at its corners and ending on the
      // bridge's edge square to the parapet's ends (`refugeLine`); each side's outward normal off the outline.
      const zc = z + H;
      const lOut = refugeLine(line, edge, 0), lIn = refugeLine(line, edge, T), lCo = refugeLine(line, edge, -0.012), lCi = refugeLine(line, edge, T + 0.012);
      const nOf = (q: number): ST => { const [a, b] = [line[q], line[q + 1]]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(-(b[1] - a[1]) / l) * edge, ((b[0] - a[0]) / l) * edge]; };
      const cut: Kit['face'] = (q, pts, out, tone, inf, fr) => cface(k, q, pts, out, tone, inf, fr);
      const segFr = (a: ST, b: ST): { o: L; a: L; b: L } => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { o: [a[0], a[1], 0], a: [(b[0] - a[0]) / l / U, (b[1] - a[1]) / l / U, 0], b: [0, 0, 1] }; };
      // Each side a solid of its own, in the bridge's own run's orders (wall, then coping), so a side and the run it leaves
      // sort by depth. A side's root is flush with the run's end and has no face of its own.
      for (let q = 0; q + 1 < line.length; q++) {
        const n = nOf(q), [a, b, ai, bi] = [lOut[q], lOut[q + 1], lIn[q], lIn[q + 1]];
        k.solid(part, 1);
        cut(part, [[a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], zc - cop], [a[0], a[1], zc - cop]], [n[0], n[1], 0], DEEP, fi('parapet', 0, 1, z, zc - cop, 3 + q), segFr(a, b));
        cut(part, [[bi[0], bi[1], z], [ai[0], ai[1], z], [ai[0], ai[1], zc - cop], [bi[0], bi[1], zc - cop]], [-n[0], -n[1], 0], DEEP, fi('parapet', 0, 1, z, zc - cop, 7 + q), segFr(bi, ai));
      }
      for (let q = 0; q + 1 < line.length; q++) {
        const n = nOf(q), [O0, O1, I0, I1] = [lCo[q], lCo[q + 1], lCi[q], lCi[q + 1]];
        k.solid(part, 2);
        cut(part, [[O0[0], O0[1], zc], [O1[0], O1[1], zc], [I1[0], I1[1], zc], [I0[0], I0[1], zc]], [0, 0, 1], st.trim);
        cut(part, [[O0[0], O0[1], zc - cop], [O1[0], O1[1], zc - cop], [O1[0], O1[1], zc], [O0[0], O0[1], zc]], [n[0], n[1], 0], st.trim, fi('cap', 0, 1, zc - cop, zc, q), segFr(O0, O1));
        cut(part, [[I1[0], I1[1], zc - cop], [I0[0], I0[1], zc - cop], [I0[0], I0[1], zc], [I1[0], I1[1], zc]], [-n[0], -n[1], 0], st.trim);
        const [o0, o1] = [line[q], line[q + 1]];
        const a = Math.min(o0[0], o1[0]), b = Math.max(o0[0], o1[0]);
        if (b > a + 1e-4) {
          const tAt = (s0: number): number => o0[1] + ((o1[1] - o0[1]) * (s0 - o0[0])) / ((o1[0] - o0[0]) || 1e-6);
          k.glow.lines.push([k.m([a, tAt(a) + edge * 0.004, zc - cop * 0.5]), k.m([b, tAt(b) + edge * 0.004, zc - cop * 0.5])]);
        }
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
  rune: 'dagaz',
  paint: byRole({
    wall: brick, pier: brick, parapet: brick, post: brick,
    ring: ringPaint('#f6e6d6', vaultPaint(2.6, 6.6, MORTAR)),
    key: runeKey('dagaz', 0.74),
    cap: boldRuneLine('dagaz'),
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
