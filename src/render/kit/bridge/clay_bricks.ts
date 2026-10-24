import { css, hex, mix, type Tone } from '../core';
import { box, BUILDERS, byRole, runeLine, turned, type BridgePainter, type Kit, type Part3 } from './core';
import { stoneBase } from './base';
import { arcade, brickPaint, fixKit, herringbonePaint, ringPaint, tilePaint, vaultPaint, wide , ownerOf, runeKey } from './clay';

/**
 * Clay bricks: the brick of the island's brick houses (`BRICK` in
 * `masonry.ts`), in its own field tone and mortar, dressed as they are in a
 * slate-mauve cut stone -- copings, cornice, imposts, keystones, the newels'
 * caps. Brick arches of two rings of voussoirs on edge, radiating, as deep at
 * the springing as at the crown; herringbone pavers on the deck, as the
 * houses' floors; stone treads on a ramp, as their stairs.
 */

const MORTAR = '#8e6f67';
/** The houses' cut stone: its dress and its band. */
const DRESS: Tone = { lit: hex('#aea3ad'), shade: hex('#77707f') };
const BRICK: Tone = { lit: hex('#cf7f6d'), shade: hex('#98524f') };

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

/** The parapet: the core's brick wall and stone coping, with a brick pilaster over each pier where no refuge breaks it. */
function parapet(k0: Kit, edge: number, part: Part3): void {
  const k = fixKit(k0);
  BUILDERS.parapet(k, edge, part);
  const { plan, sl, st } = k;
  if (plan.width >= 2) return;
  const H = st.parapetHeight ?? 10;
  const tOut = edge > 0 ? sl.t1 : sl.t0;
  const ta = tOut + edge * 0.024, tb = tOut - edge * 0.112;
  const [t0, t1] = [Math.min(ta, tb), Math.max(ta, tb)];
  const kw = wide(k, t0 - 0.014, t1 + 0.014);
  for (const p of plan.piers) {
    if (p.end) continue;
    const w = 0.075, z = plan.deck(p.s);
    box(kw, part, p.s - w, p.s + w, t0, t1, z, z + H + 0.4, st.stone, 'parapet', 2.5);
    box(kw, part, p.s - w - 0.014, p.s + w + 0.014, t0 - 0.014, t1 + 0.014, z + H + 0.4, z + H + 2, st.trim, 'cap', 2.6);
  }
}

/** A brick gate pier at each end of each outer edge: a stone plinth, a brick shaft, a stone cap and a stone ball on it. */
function ends(k0: Kit): void {
  const k = fixKit(k0);
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
  ring: { lit: hex('#d58c78'), shade: hex('#a05c55') },
  trim: DRESS,
  deck: { lit: hex('#c98272'), shade: hex('#98605c') },
  parapet: 'brick',
  ringDepth: 5.2,
  rune: 'kenaz',
  paint: byRole({
    wall: brick, pier: brick, parapet: brick, post: brick,
    ring: ringPaint(MORTAR, vaultPaint(2.6, 6.6, MORTAR)),
    key: runeKey('kenaz', 0.46),
    cap: runeLine('kenaz'),
    cornice: bandPaint,
    deck: herringbonePaint(2.3, '#b3a296'),
    tread: tilePaint(40 / 3, '#6a6476', DRESS),
  }),
  build: {
    arches: arcade({ ringD: 4.6, proud: 0.03, ring: 'voussoir', key: 'wedge', keyTone: (st) => st.trim, pier: 'cutwater', impost: (st) => st.trim }),
    parapet,
    ends,
    refuges: (k) => BUILDERS.refuges(fixKit(k)),
    deck: (k) => BUILDERS.deck(fixKit(k)),
  },
});
