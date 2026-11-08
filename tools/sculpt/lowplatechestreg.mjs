// The chest sheet (tools/sculpt/ref/plate-chest.png) registered to the low-poly bodies, and the armour
// (tools/sculpt/garments/platechest.mjs) laid over it view by view:
//
//   node tools/sculpt/lowplatechestreg.mjs --out <dir> [--tag <name>] [--enchanted]
//     fits each view's camera (tools/sculpt/lowplatechestcams.json: its turn, scale, horizontal stretch and centre, an
//     orthographic turntable as the sheet is drawn) to the landmarks (tools/sculpt/lowplatechestmarks.json: elbows,
//     wrists, the neck's middle) by least squares, and draws, by tools/sculpt/lowplatechestsheet.py:
//       platechest-<tag>-reg.png: the body's wire over each of the sheet's views (both bodies), the landmarks' residuals;
//       platechest-<tag>-overlay.png: per view the sheet, ours, and ours outlined over the sheet (red ours, green the
//         sheet's), at 2x, both bodies (plain, and with --enchanted plain and enchanted);
//       platechest-<tag>-fit.json: per view the silhouettes' agreement (IoU) and the rows' widths off (px).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildPlateChest, plateChestWeights, MATS, LOOKS } from './garments/platechest.mjs';
import { lookColour } from './lowgarmentshot.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowplatechest')), tag = opt('tag', 'x');
mkdirSync(out, { recursive: true });
const DIR = new URL('.', import.meta.url).pathname;
const SKIN = [0.68, 0.49, 0.41];
const data = { sheet: join(DIR, 'ref/plate-chest.png'), marks: join(DIR, 'lowplatechestmarks.json'), cams: join(DIR, 'lowplatechestcams.json'), out, tag, looks: args.includes('--enchanted') ? ['plain', 'enchanted'] : ['plain'], bodies: {} };
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildPlateChest(rig), { B, J } = rig, hidden = new Set(G.hides);
  const r4 = (p) => p.map((x) => +x.toFixed(4));
  const colOf = (mat, look) => { const l = LOOKS[look][mat]; return Array.isArray(l) ? l : lookColour(l); };
  data.bodies[who] = {
    marks: { elbow: { l: J.elbow, r: [-J.elbow[0], J.elbow[1], J.elbow[2]] }, wrist: { l: J.wrist, r: [-J.wrist[0], J.wrist[1], J.wrist[2]] } },
    body: { verts: B.verts.map(r4), tris: B.tris.filter((t) => !hidden.has(t.poly)).map((t) => t.v), all: B.tris.map((t) => t.v), col: SKIN },
    armour: { verts: G.verts.map(r4), tris: G.tris.map((t) => t.v), col: Object.fromEntries(data.looks.map((l) => [l, G.tris.map((t) => colOf(G.polys[t.poly].mat, l).map((x) => +x.toFixed(3)))])) },
  };
}
const file = join(out, `.reg-${process.pid}.json`);
writeFileSync(file, JSON.stringify(data));
execFileSync('python3', [join(DIR, 'lowplatechestsheet.py'), file], { stdio: 'inherit' });
