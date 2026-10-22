import { mix, tone } from '../kit';
import { boleOf } from '../paint';
import type { Hook, TreeLook } from '../types';

/**
 * The twist of an old olive's bole: ridges of bark wound round it, each a
 * shaded groove with a lit rib beside it, kept inside the bole's own outline.
 */
const twist: Hook = (ctx, geo, info) => {
  if (info.ageKey === 'sapling') return;
  const t = geo.trunk;
  const s = info.shape;
  // The same bole the shared painter laid, from the same seed (`tree.ts` seedOf).
  const b = boleOf(t.x0, t.y0, t.x1, t.y1, t.w0, t.w1, s.flare, s.gnarl, info.species * 7.13 + 1.7);
  const n = b.y.length;
  const ridges = info.ageKey === 'young' ? 1 : 3;
  const groove: number[] = [];
  const rib: number[] = [];
  const hollowY = s.hollow ? b.y[Math.max(1, Math.min(n - 2, Math.round(0.3 * (n - 1))))] : null;
  let brk = false;
  for (let k = 0; k < ridges; k++) {
    const from = 0.08 + k * 0.17 + info.wob(1900 + k) * 0.06;
    const span = 0.42 + 0.12 * info.wob(1910 + k);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const at = Math.min(0.98, from + span * u) * (n - 1);
      const j = Math.min(n - 2, Math.floor(at));
      const f = at - j;
      const lx = b.lx[j] + (b.lx[j + 1] - b.lx[j]) * f;
      const rx = b.rx[j] + (b.rx[j + 1] - b.rx[j]) * f;
      const y = b.y[j] + (b.y[j + 1] - b.y[j]) * f;
      // Wound round from the right flank to the left going up, as a spiral seen from the front.
      const across = 0.5 - 0.5 * Math.cos(Math.PI * (1 - u));
      const x = lx + (rx - lx) * (0.14 + 0.76 * (1 - across));
      // Broken off where it would run across the hollow's mouth (`paint.ts` paintHollow).
      const hw = (rx - lx) * 0.34;
      if (hollowY !== null && ((x - (lx + (rx - lx) * 0.52)) / hw) ** 2 + ((y - hollowY) / (hw * 1.5)) ** 2 < 1) {
        brk = true;
        continue;
      }
      const flag = brk || i === 0 ? 0 : 1;
      brk = false;
      groove.push(x, y, flag);
      rib.push(Math.max(lx + (rx - lx) * 0.1, x - (rx - lx) * 0.08), y + (rx - lx) * 0.03, flag);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = (pts: number[], colour: string, w: number): void => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 3) {
      if (pts[i + 2] === 0) ctx.moveTo(pts[i], pts[i + 1]);
      else ctx.lineTo(pts[i], pts[i + 1]);
    }
    ctx.stroke();
  };
  const w = Math.max(0.35, t.w0 * 0.13);
  draw(rib, mix(info.bark, '#fff4e0', 0.24), w * 1.3);
  draw(groove, tone(info.bark, -0.36), w);
};

/** Olive: a broad, layered silvery grey-green crown on a fat twisted trunk; small dark olives. */
export const olive: TreeLook = {
  form: 'broadleaf',
  leaf: ['#cadbb6', '#98b393', '#5e7f69'],
  bark: '#8d735f',
  marks: 'smooth',
  cluster: { style: 'puff', lobes: 7, depth: 0.8, flecks: 4 },
  shape: {
    height: 62, trunk: 0.4, width: 1.62, girth: 0.085, gnarl: 0.85, flare: 1.8, lean: 0.25, clusters: 16, clusterSize: 0.35,
    limbs: 4, flat: 0.4, gaps: 0.1,
  },
  ages: { old: { hollow: true, gaps: 0.16 } },
  fruit: { colour: '#3d3a3a', size: 0.75, count: 10, shape: 'oval' },
  beforeCrown: twist,
};
