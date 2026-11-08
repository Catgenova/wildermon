// The mantle sheet's ten cameras (tools/sculpt/lowmantlecams.json) fitted to the sheet's figures by the parts the mantle
// does not hide: per view its centre (cx, cy), turn (yaw), scale (s) and across stretch (ax), by coordinate descent, so that
//   - the body's head and neck cover the sheet's bare skin (lowmantle-sheetmasks.json skin) in the head's rows, and
//   - nothing of the body lies on the sheet's background (the head's rows fully, the rest of the figure at BG_LOW:
//     the sheet's plate is thicker than the body, so the body only has to stay inside it),
// with priors holding s near the row's (the sheet draws one size per row), ax near 1 and the turn near the view's name.
// Prints each view's cost before and after, the skin's uncovered and the body's outside pixels, and the changes.
//
//   node tools/sculpt/lowmantleregfit.mjs [--who male|female] [--rounds 6] [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { CAMS, BOXES, VIEWS, raster } from './lowmantlereg.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const SM = JSON.parse(readFileSync(join(DIR, 'lowmantle-sheetmasks.json'), 'utf8'));
const grid = (rows, W, H) => { const A = new Uint8Array(W * H); rows.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * W + r[k], y * W + r[k + 1]); }); return A; };
/** The head's rows per body (from the box's top). */
const HEAD = { male: 72, female: 64 }, BG_LOW = 0.15;
const YAW = { front: 0, q3: 45, side: -90, back: 180, r3: -135 };
const PRIOR = { s: 60, ax: 2000, yaw: 0.05 };

export function regCost(who, v, c, tris) {
  const d = SM.views[who][v], box = BOXES[who][v], [, , W, H] = box, n = W * H;
  const fig = (d._fig ??= grid(d.fig, W, H)), skin = (d._skin ??= grid(d.skin, W, H));
  const Z = new Float32Array(n).fill(-Infinity), A = new Uint8Array(n);
  raster(tris, c, box, Z, A, 1);
  let miss = 0, out = 0, outLow = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (y < HEAD[who]) { if (skin[i] && !A[i]) miss++; if (A[i] && !fig[i]) out++; } else if (A[i] && !fig[i]) outLow++;
  }
  const s0 = CAMS[who].front.s;
  const prior = PRIOR.s * (c.s - s0) ** 2 + PRIOR.ax * ((c.ax ?? 1) - 1) ** 2 + PRIOR.yaw * (c.yaw - YAW[v]) ** 2;
  return { cost: miss + out + BG_LOW * outLow + prior, miss, out, outLow };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const rounds = +opt('rounds', '6'), cams = structuredClone(CAMS);
  for (const who of opt('who', null) ? [opt('who')] : ['male', 'female']) {
    const B = buildRig(who).B, tris = B.tris.map((t) => t.v.map((i) => B.verts[i]));
    for (const v of VIEWS) {
      let c = { ax: 1, dy: 0, ...cams[who][v] }, best = regCost(who, v, c, tris);
      const start = best;
      const steps = { cx: 2, cy: 2, s: 0.8, ax: 0.03, yaw: v === 'front' || v === 'back' ? 0 : 4 };
      for (let r = 0; r < rounds; r++) {
        for (const key of Object.keys(steps)) {
          if (!steps[key]) continue;
          for (let tries = 0; tries < 8; tries++) {
            let moved = false;
            for (const sg of [1, -1]) { const c2 = { ...c, [key]: +(c[key] + sg * steps[key]).toFixed(3) }, m = regCost(who, v, c2, tris); if (m.cost < best.cost - 0.01) { c = c2; best = m; moved = true; break; } }
            if (!moved) break;
          }
        }
        for (const key of Object.keys(steps)) steps[key] /= 2;
      }
      const o = cams[who][v];
      console.log(`${who} ${v}: cost ${start.cost.toFixed(0)} (miss ${start.miss} out ${start.out} low ${start.outLow}) -> ${best.cost.toFixed(0)} (miss ${best.miss} out ${best.out} low ${best.outLow}); cx ${o.cx}->${c.cx} cy ${o.cy}->${c.cy} s ${o.s}->${c.s} ax ${o.ax ?? 1}->${c.ax} yaw ${o.yaw}->${c.yaw}`);
      cams[who][v] = { yaw: c.yaw, s: c.s, cx: c.cx, cy: c.cy, ax: c.ax, dy: 0 };
    }
  }
  if (args.includes('--write')) {
    const lines = ['{', ` "about": ${JSON.stringify(CAMS.about)},`];
    ['male', 'female'].forEach((who, wi) => { lines.push(` "${who}": {`); VIEWS.forEach((v, i) => lines.push(`  "${v}": ${JSON.stringify(cams[who][v]).replace(/,/g, ', ').replace(/:/g, ': ').replace(/^\{/, '{ ').replace(/\}$/, ' }')}${i < 4 ? ',' : ''}`)); lines.push(` }${wi ? '' : ','}`); });
    lines.push('}');
    writeFileSync(join(DIR, 'lowmantlecams.json'), lines.join('\n') + '\n');
    console.log('wrote lowmantlecams.json');
  }
}
