// The mantle's clumps from the sheet: the lifted traces (tools/sculpt/lowmantlelift.mjs: per layer and view, each tip and
// notch as [azimuth, length along the body's line]) made into one clump list per layer, shared by all views: each
// azimuth taken from the view that sees it most squarely (PRIMARY: the back from 130 to 230 degrees, the rear
// three-quarter from 100 to 130, the side none (from the front to 100 the front view, through the hem the fitter fits to it: the sheet's side draws the flank's fur far shorter than its front does; the side is a check); each flank's mirror where only the other side is drawn), the
// points in azimuth order, tips and notches alternating (two tips with no notch between get one at their middle, two
// notches with no tip a tip at their middle); from the front end of the layer (`from`) to the first traced notch, clumps of the
// traced ones' mean width on the design's hem. Writes `clumps` into lowmantle-design.json per body and layer:
// { notch: [[az, s], ...], tip: [[az, s], ...] } (s in the man's units, as `hem`).
//
//   node tools/sculpt/lowmantleclumps.mjs [--lifted <lifted.json>] [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('.', import.meta.url).pathname;
export const PRIMARY = { back: [130, 230], r3: [100, 130], side: [0, 0], q3: [0, 40], front: [0, 30] };
const interp = (table, x) => { if (x <= table[0][0]) return table[0][1]; for (let i = 1; i < table.length; i++) if (x <= table[i][0]) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); } return table[table.length - 1][1]; };
const ff = (deg) => Math.abs(((deg % 360) + 540) % 360 - 180);

export function clumpsOf(lifted, T, scaleS = 1) {
  const pts = [];
  for (const [v, list] of Object.entries(lifted ?? {})) {
    const [a0, a1] = PRIMARY[v];
    for (const [t, az, s] of list) {
      const ok = (d) => (v === 'back' ? d >= a0 && d <= a1 : d >= a0 && d < a1);
      if (ok(az)) pts.push([t, az, s / scaleS, v]);
      // a flank drawn on one side only: its mirror on the other
      if (v !== 'back' && ok(az) && az < PRIMARY.back[0]) pts.push([t, 360 - az, s / scaleS, v + '*']);
      if (v === 'back' || v === 'front') continue;
    }
  }
  pts.sort((a, b) => a[1] - b[1]);
  // (a point mirrored onto a flank the back also sees is dropped where the back has one within 4 degrees)
  const seq = [];
  for (const p of pts) {
    const last = seq[seq.length - 1];
    if (last && Math.abs(last[1] - p[1]) < 3 && last[0] === p[0]) { last[1] = (last[1] + p[1]) / 2; last[2] = (last[2] + p[2]) / 2; continue; }
    if (last && last[0] === p[0]) {
      if (p[0] === 't') seq.push(['n', (last[1] + p[1]) / 2, 0.85 * Math.min(last[2], p[2])]);
      else seq.push(['t', (last[1] + p[1]) / 2, 1.12 * Math.max(last[2], p[2])]);
    }
    seq.push([...p]);
  }
  // notches at both ends
  if (seq[0][0] === 't') seq.unshift(['n', seq[0][1] - 4, 0.85 * seq[0][2]]);
  if (seq[seq.length - 1][0] === 't') seq.push(['n', seq[seq.length - 1][1] + 4, 0.85 * seq[seq.length - 1][2]]);
  const notch = seq.filter((p) => p[0] === 'n').map((p) => [+p[1].toFixed(1), +p[2].toFixed(3)]), tip = seq.filter((p) => p[0] === 't').map((p) => [+p[1].toFixed(1), +p[2].toFixed(3)]);
  // the front ends: clumps of the mean width on the design's hem
  const wMean = (notch[notch.length - 1][0] - notch[0][0]) / tip.length, hem = (d) => interp(T.hem, ff(d)), tipL = T.tip;
  const lead = [], tail = [];
  { const span = notch[0][0] - T.from, n = Math.max(0, Math.round(span / wMean)), w = n ? span / n : 0; for (let j = 0; j < n; j++) { const a = T.from + j * w; lead.push([[+a.toFixed(1), +hem(a).toFixed(3)], [+(a + w / 2).toFixed(1), +(hem(a + w / 2) + tipL).toFixed(3)]]); } }
  { const e = 360 - T.from, span = e - notch[notch.length - 1][0], n = Math.max(0, Math.round(span / wMean)), w = n ? span / n : 0; for (let j = 0; j < n; j++) { const a = notch[notch.length - 1][0] + (j + 1) * w; tail.push([[+a.toFixed(1), +hem(a).toFixed(3)], [+(a - w / 2).toFixed(1), +(hem(a - w / 2) + tipL).toFixed(3)]]); } }
  return { notch: [...lead.map((l) => l[0]), ...notch, ...tail.map((l) => l[0])], tip: [...lead.map((l) => l[1]), ...tip, ...tail.map((l) => l[1])] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const L = JSON.parse(readFileSync(opt('lifted', join(DIR, 'lowmantle-lifted.json')), 'utf8'));
  const file = join(DIR, 'lowmantle-design.json'), F = JSON.parse(readFileSync(file, 'utf8'));
  for (const who of ['male', 'female']) {
    const src = L[who] ? who : 'male', D = F[who], scaleS = src === who ? D.scale : 1;
    for (const T of [...D.tiers, ...(args.includes('--collar') ? [{ ...D.collar, name: 'collar', hem: D.collar.len, tip: 0 }] : [])]) {
      if (!L[src][T.name]) continue;
      const C = clumpsOf(L[src][T.name], T, src === who ? scaleS * (D.hemK?.[T.name] ?? 1) : 1);
      console.log(who, T.name, `${C.tip.length} clumps:`, C.tip.map((t, i) => `${C.notch[i][0]}|${t[0]}:${t[1]}`).join(' '), `|${C.notch[C.notch.length - 1][0]}`);
      if (T.name === 'collar') D.collar.clumps = C; else D.tiers.find((t) => t.name === T.name).clumps = C;
    }
  }
  if (args.includes('--write')) { writeFileSync(file, JSON.stringify(F, null, 1)); console.log('wrote', file); }
}
