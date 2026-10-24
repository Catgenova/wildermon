import { css, faceColour, type Tone } from '../core';
import { U, type BridgePainter, type BridgeStyle, type Kit, type L, type Part3 } from './core';
import {
  archesKeyed, copingRun, framed, hash, houseTone, infoOf, keystone, moulding, newelPost, rubble, runsOf, voussoirs, wallFrame, wallRun,
  type Beds, type Placed,
} from './stone_brick';

/**
 * Cobblestone: the island's rubble, as its cottages are laid (`masonry.ts`,
 * `RUBBLE`): fieldstone of every size in rough courses, arches turned in
 * rough wedges of the paler dressing stone, and a rough parapet whose top is
 * a row of stones set on edge, tall and short turn about.
 */

/** The house's shade, by channel: the warm grey goes greyer, not bluer. */
const DUSK: [number, number, number] = [0.79, 0.79, 0.8];
const t = (h: string): Tone => houseTone(h, DUSK);

const FIELD = t('#cbc0b0');
const BEDS: Beds = [[FIELD, 5], [t('#c6bdab'), 2], [t('#c6bba8'), 1.5], [t('#bdc09b'), 1.6], [t('#bdb9a9'), 1.5], [t('#dcd3c2'), 1.2], [t('#a89e8a'), 1.2]];
const JOINT = t('#a7a294');
const HI = t('#ddd4c6');
/** The paler stone its openings are picked out in. */
const DRESS = t('#ded5c4');
const DRESS_BEDS: Beds = [[DRESS, 3], [t('#d3c9b8'), 2], [t('#e6ded0'), 1.5], [t('#cfc6b3'), 1.5]];
const RING_JOINT = t('#a09a8a');
const BAND = t('#d3c9b8');
/** Its crazy paving (`flooring.ts`). */
const FLOOR_BEDS: Beds = [[t('#ded5c4'), 3], [t('#d5cbb8'), 2], [t('#e6ded0'), 2], [t('#cfc6b3'), 2], [t('#d4d2bf'), 1], [t('#dccfbf'), 1]];
const FLOOR_BED = t('#aaa392');

const RUNE = 'cross';

const LINE = t('#94896c');
const wall = rubble({ rows: [3.4, 5.4], len: [4.5, 10.5], beds: BEDS, joint: JOINT, hi: HI, gap: 0.6, line: LINE });
const deck = rubble({ rows: [7, 11], len: [7, 15], beds: FLOOR_BEDS, joint: FLOOR_BED, hi: t('#f4eee4'), gap: 0.9, line: t('#8d846f') });

/** The wall of the parapet, and the stones on edge along its top: how many to the tile, and how high, least and most. */
const WALL = 6.2;
const STRING = 1.1;
const ON_EDGE = 11;
const LOW = 2.4, TALL = 3.8;
const heightOf = (q: number): number => (q % 2 === 0 ? TALL - hash(q, 1) * 0.8 : LOW + hash(q, 2) * 0.7);
const toneOf = (q: number): Tone => DRESS_BEDS[Math.floor(hash(q, 3) * DRESS_BEDS.length)][0];

/** The stones on edge, painted on a face of the cope: each its own tone, a joint between each, a paler top. */
const onEdge: BridgePainter = (g, k, f) => {
  const pf = f as Placed;
  const x0 = Math.min(f.x0, f.x1), x1 = Math.max(f.x0, f.x1);
  const sx = pf.sx || 1;
  const w = U / ON_EDGE;
  const joints = new Path2D();
  for (let x = Math.floor(x0 / w) * w; x < x1 + w; x += w) {
    const q = Math.round((sx > 0 ? x : -x - w) / w);
    g.fillStyle = css(faceColour(toneOf(q), k.L));
    g.fillRect(x, f.y0 - 1, w, f.y1 - f.y0 + 2);
    joints.moveTo(x, f.y0 - 1);
    joints.lineTo(x, f.y1 + 1);
  }
  g.strokeStyle = css(faceColour(RING_JOINT, k.L));
  g.lineWidth = 0.5;
  g.stroke(joints);
};

/** A rough parapet: rubble to a string course with the rune line in it, then a row of stones on edge. */
function roughParapet(k: Kit, edge: number, part: Part3): void {
  const { plan, sl, st } = k;
  const T = 0.095;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const tIn = tOut - edge * T;
  const [t0, t1] = edge > 0 ? [tIn, tOut] : [tOut, tIn];
  const deckAt = plan.deck;
  const step = plan.ramp ? 1 / 3 : 1;
  for (const [sa, sb] of runsOf(plan, sl)) {
    wallRun(k, part, sa, sb, { tOut, tIn, edge, foot: deckAt, top: (s) => deckAt(s) + WALL, tone: st.stone, role: 'parapet', order: 1 }, step, false);
    copingRun(k, part, sa, sb, edge, t0, t1, (s) => deckAt(s) + WALL, STRING, 0.008, st.trim, step);
    copeOnEdge(k, part, sa, sb, edge, t0 + 0.006, t1 - 0.006, (s) => deckAt(s) + WALL + STRING);
  }
}

/** The stones on edge from `sa` to `sb`: one solid, its two long faces stepped along their tops, each stone's top and the step up to the next. */
function copeOnEdge(k: Kit, part: Part3, sa: number, sb: number, edge: number, t0: number, t1: number, base: (s: number) => number): void {
  const { sl } = k;
  const w = 1 / ON_EDGE;
  const qs: Array<[number, number, number]> = [];
  for (let q = Math.floor(sa / w); q * w < sb - 1e-6; q++) {
    const a = Math.max(sa, q * w), b = Math.min(sb, (q + 1) * w);
    if (b - a > 1e-4) qs.push([q, a, b]);
  }
  if (!qs.length) return;
  const top = (q: number, s: number): number => base(s) + heightOf(q);
  k.solid(part, 2.4);
  for (const [t, out] of [[t1, 1], [t0, -1]] as Array<[number, number]>) {
    const pts: L[] = [[sa, t, base(sa)], [sb, t, base(sb)]];
    for (let j = qs.length - 1; j >= 0; j--) {
      const [q, a, b] = qs[j];
      pts.push([b, t, top(q, b)], [a, t, top(q, a)]);
    }
    k.face(part, pts, [0, out, 0], DRESS, infoOf('rail', 0, 0, 0, 0, sl.i), wallFrame(t, out));
  }
  for (let j = 0; j < qs.length; j++) {
    const [q, a, b] = qs[j];
    const tone = toneOf(q);
    k.face(part, [[a, t0, top(q, a)], [b, t0, top(q, b)], [b, t1, top(q, b)], [a, t1, top(q, a)]], [0, 0, 1], tone);
    // The step between this stone and the next, facing the lower one.
    const next = j + 1 < qs.length ? qs[j + 1] : null;
    if (next) {
      const h0 = top(q, b), h1 = top(next[0], b);
      if (Math.abs(h1 - h0) > 0.05) {
        const dirn = h0 > h1 ? 1 : -1;
        k.face(part, [[b, t0, Math.min(h0, h1)], [b, t1, Math.min(h0, h1)], [b, t1, Math.max(h0, h1)], [b, t0, Math.max(h0, h1)]], [dirn, 0, 0], dirn > 0 ? tone : toneOf(next[0]));
      }
    }
  }
  // Its ends, where a refuge or the bridge's end stops it.
  for (const [s, dirn, q] of [[sa, -1, qs[0][0]], [sb, 1, qs[qs.length - 1][0]]] as Array<[number, number, number]>) {
    if ((dirn < 0 && sa <= sl.s0 + 1e-6) || (dirn > 0 && sb >= sl.s1 - 1e-6)) continue;
    k.face(part, [[s, t0, base(s)], [s, t1, base(s)], [s, t1, top(q, s)], [s, t0, top(q, s)]], [dirn, 0, 0], toneOf(q));
  }
  void edge;
}

/** At each end, on each outer edge: a rubble newel, a dressed cap, a rough ball on it. */
function roughEnds(k: Kit): void {
  const { plan, sl, st } = k;
  for (const edge of sl.edges) {
    const tt = edge > 0 ? sl.t1 - 0.08 : sl.t0 + 0.08;
    const part: Part3 = edge === sl.near ? 'rail' : 'front';
    const o = { shaft: WALL + STRING + TALL + 2.5, half: 0.08, tone: st.stone, trim: st.trim, finial: st.ring, profile: [[0, 0.036], [0.6, 0.05], [2.4, 0.058], [4.2, 0.04], [5, 0]] as Array<[number, number]> };
    if (sl.i === 0) newelPost(k, part, 0.08, tt, plan.deck(0.08), o);
    if (sl.i === plan.n - 1) newelPost(k, part, plan.n - 0.08, tt, plan.deck(plan.n - 0.08), o);
  }
}

export const cobblestone: BridgeStyle = framed({
  family: 'stone',
  stone: FIELD,
  ring: DRESS,
  trim: BAND,
  deck: t('#d9d0be'),
  parapet: 'rough',
  parapetHeight: WALL + STRING,
  ringDepth: 3.8,
  rune: RUNE,
  glow: '#d4f2c4',
  paint: {
    wall, pier: wall, parapet: wall, post: wall,
    ring: voussoirs({ width: 3.4, wander: 0.45, ragged: 0.35, beds: DRESS_BEDS, joint: RING_JOINT, soffit: rubble({ rows: [3, 4.6], len: [4, 8], beds: BEDS, joint: JOINT, gap: 0.6, line: LINE }) }),
    key: keystone(RUNE),
    cap: moulding({ joint: RING_JOINT, hi: t('#efe8dc'), len: 9, rune: RUNE, wide: deck }),
    cornice: moulding({ joint: RING_JOINT, hi: t('#efe8dc'), len: 8 }),
    plinth: moulding({ joint: RING_JOINT, hi: t('#efe8dc'), len: 8 }),
    rail: onEdge,
    deck, tread: deck,
  },
  build: { parapet: roughParapet, ends: roughEnds, arches: archesKeyed(0.1, 2, 1) },
});
