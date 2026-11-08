// The mantle sheet's traced clumps lifted onto the mantle's own layers: each traced point (a clump's tip or the notch
// between two clumps, per layer, per view, in the sheet's pixels: tools/sculpt/lowmantle-trace.json) taken to the point
// of its layer's outside (azimuth, length along the body's line) that the view's camera (lowmantlecams.json) shows there,
// the front-most where several do; a point outside the layer's silhouette to the nearest it shows. All views then share
// one clump list per layer (tools/sculpt/lowmantleclumps.mjs merges them).
//
//   node tools/sculpt/lowmantlelift.mjs [--trace <trace.json>] [--out <lifted.json>]
//     per body, layer and view: [type, azimuth, length, sheet x, y, px off, facing]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildMantle, DESIGN } from './garments/mantle.mjs';
import { CAMS, project } from './lowmantlereg.mjs';

const DIR = new URL('.', import.meta.url).pathname;

/** The layer's outside sampled every degree and every 0.02 down its line, projected into a view. */
export function hullOf(G, D, name, c) {
  const T = name === 'collar' ? D.collar : D.tiers.find((t) => t.name === name), k = D.scale, pos = G.tiers[name].pos;
  const lift = ((T.thick ?? 0.1) + (T.edge ?? 0.08)) * k, a = (c.yaw * Math.PI) / 180, view = [-Math.sin(a), Math.cos(a)];
  const maxS = name === 'collar' ? 1.6 : 4.6, out = [];
  for (let deg = 0; deg < 360; deg += 1) {
    const r = (deg * Math.PI) / 180, facing = Math.sin(r) * view[0] + Math.cos(r) * view[1];
    for (let s = 0; s <= maxS; s += 0.02) { const p = pos(deg, s, lift), q = project(p, c); out.push([q[0], q[1], q[2], deg, +s.toFixed(2), facing]); }
  }
  return out;
}

export function liftPoint(H, x, y) {
  let best = null, bd = Infinity;
  for (const h of H) { if (h[5] < -0.15) continue; const d = Math.hypot(h[0] - x, h[1] - y); if (d < 1.2 && (!best || bd >= 1.2 || h[2] > best[2])) { best = h; bd = d; } else if (bd >= 1.2 && d < bd) { best = h; bd = d; } }
  return [best[3], best[4], +bd.toFixed(1), +best[5].toFixed(2)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const T = JSON.parse(readFileSync(opt('trace', join(DIR, 'lowmantle-trace.json')), 'utf8')), out = {};
  for (const who of Object.keys(T)) {
    const rig = buildRig(who), D = DESIGN[who], G = buildMantle(rig, D);
    out[who] = {};
    for (const [v, layers] of Object.entries(T[who])) for (const [name, pts] of Object.entries(layers)) {
      const H = hullOf(G, D, name, CAMS[who][v]);
      ((out[who][name] ??= {})[v] = pts.map(([t, x, y]) => [t, ...liftPoint(H, x, y).slice(0, 2), x, y, ...liftPoint(H, x, y).slice(2)]));
    }
  }
  writeFileSync(opt('out', join(DIR, 'lowmantle-lifted.json')), JSON.stringify(out));
  for (const who of Object.keys(out)) for (const [name, vs] of Object.entries(out[who])) for (const [v, pts] of Object.entries(vs)) console.log(who, name, v, pts.map((p) => `${p[0]}${p[1]}/${p[2]}${p[5] > 1.5 ? '!' + p[5] : ''}`).join(' '));
}
