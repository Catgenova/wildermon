// The leather shawl (tools/sculpt/garments/leathershawl.mjs) on each body in the swing (src/sculpt/anim/clips/swing.ts,
// the long sword held) and arms overhead, without and with its corrective shapes (leathershawlshapes-<who>.json), each
// frame from the front three-quarter and the back three-quarter; the shawl's polygons crossing the body red, the body's
// it crosses blue; the count of crossing triangle pairs on each.
//
//   node tools/sculpt/lowlshawlswing.mjs <out.png> [--times 0,0.27,0.46,0.84,1.3] [--shapes off|on|both] [--json <shapes json per {who}>]
import { join } from 'node:path';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { buildRig, posed, skin, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, crossPairs, shapeWeights } from './lowgarment.mjs';
import { buildLeatherShawl, leatherShawlWeights, leatherShawlShapes, columnOffsets, shapesFrom, MATS } from './garments/leathershawl.mjs';
import { SHAPES } from './garments/shawl.mjs';
import { shoot, closeBrowser, SKIN } from './lowgarmentshot.mjs';

const args = process.argv.slice(2), OUT = args[0];
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const TIMES = opt('times', '0,0.27,0.46,0.84,1.3').split(',').map(Number), MODE = opt('shapes', 'both'), JSONF = opt('json', null);
const ROOT = new URL('../..', import.meta.url).pathname;
const TS = await import('data:text/javascript;base64,' + Buffer.from((await build({ stdin: { contents: `export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly'; export { clipLocal } from './src/sculpt/anim/player'; export { SWING } from './src/sculpt/anim/clips/swing';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT, loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' } })).outputFiles[0].text).toString('base64'));
const RED = [0.95, 0.1, 0.1], BLUE = [0.2, 0.4, 1];
const cw = 260, ch = 300, YAWS = [-35, -145], cells = [];
let row = 0;
for (const who of ['male', 'female']) {
  const rig = buildRig(who), body = who === 'male' ? 'man' : 'woman', sk = TS.lowSkeleton(body), held = TS.lowHeld(body);
  const G = buildLeatherShawl(rig, undefined, { shapes: false }); G.vw = leatherShawlWeights(rig, G);
  let shaped = leatherShawlShapes(who, G);
  if (JSONF) { const J = JSON.parse(readFileSync(JSONF.replace('{who}', who), 'utf8')); shaped = SHAPES.map((s) => { const q = J.columns?.[s.name], r = q ? columnOffsets(G, q) : G.verts.map(() => [0, 0, 0]), f = J.free?.[s.name]; if (f) f.at.forEach((i, k) => { for (let j = 0; j < 3; j++) r[i][j] += f.d[k * 3 + j]; }); return { ...s, d: shapesFrom(G, r) }; }); }
  const W = (bone, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle([0, 0, 1], deg), R)); };
  const up = (p, s, deg) => { const m = s === 'l' ? 1 : -1; p[`clavicle_${s}`] = W(`clavicle_${s}`, m * 22 * deg / 140); p[`upperarm_${s}`] = W(`upperarm_${s}`, m * deg); p[`lowerarm_${s}`] = W(`lowerarm_${s}`, m * 8); return p; };
  const frames = [...TIMES.map((t) => { const r = TS.clipLocal(sk, TS.SWING, t, held), p = { $move: r.move }; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') p[rig.bones[i].name] = m; }); return [`swing ${t}`, p]; }), ['overhead', up(up({}, 'l', 140), 'r', 140)]];
  for (const mode of MODE === 'both' ? ['off', 'on'] : [MODE]) {
    G.shapes = mode === 'on' ? shaped : undefined;
    frames.forEach(([label, pose], fi) => {
      const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), x = crossPairs(PG, G.tris, PB, rig.B.tris);
      const hg = new Set(x.map(([a]) => G.tris[a].poly)), hb = new Set(x.map(([, b]) => rig.B.tris[b].poly));
      const meshes = [
        { who, P: PB, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.map((t) => [...t.v, t.poly]), col: rig.B.polys.map((p, i) => (hb.has(i) ? BLUE : p.mat === 'skin' ? SKIN : [0.22, 0.15, 0.13])) },
        { who, P: PG, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p, i) => (hg.has(i) ? RED : MATS[p.mat] ?? [0.5, 0.5, 0.5])) },
      ];
      const c = f[rig.at.get('spine_03')].P;
      YAWS.forEach((yaw, yi) => cells.push({ meshes, cam: { yaw, pitch: 10, s: 46, c: [c[0], c[1] - 0.3, c[2]] }, box: [(fi * YAWS.length + yi) * cw, 34 + row * ch, cw, ch], label: `${who} ${label} · ${mode === 'on' ? 'shapes' : 'no shapes'} · ${x.length}` }));
    });
    row++;
  }
}
await shoot((TIMES.length + 1) * YAWS.length * cw, 34 + row * ch, cells, OUT, { texts: [{ css: 'left:10px;top:6px', html: 'The leather shawl in the swing and arms overhead, without and with its corrective shapes (red: crossing the body; blue: what it crosses; the count: crossing pairs)' }] });
await closeBrowser();
