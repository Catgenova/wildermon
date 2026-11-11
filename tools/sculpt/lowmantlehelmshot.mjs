// The fur mantle, the plate chest piece and the plate helm (another checkout's garments/helm.mjs, as
// tools/sculpt/lowmantlehelm.mjs takes it) on each body close up at the swing's times, the mantle's and the helm's
// crossing polygons red. Run from the repository root.
//
//   node tools/sculpt/lowmantlehelmshot.mjs <helm root> <out.png> ['{"male":{design},"female":{design}}']
//        ['{"male":[t...],"female":[t...]}' (a time under 0: rest)] [title]
//   ZOOM (75) the scale, YAWS ('[-35,60,-150]') the views per time.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const W = process.cwd(), T = (f) => import(pathToFileURL(join(W, 'tools/sculpt', f)).href);
const { buildRig, posed, skin } = await T('lowrig.mjs');
const { crossPairs, skinGarment } = await T('lowgarment.mjs');
const { buildMantle, mantleWeights, chestOf, MATS, LOOKS: ML, DESIGN } = await T('garments/mantle.mjs');
const { shoot, closeBrowser, lookColour, SKIN } = await T('lowgarmentshot.mjs');
const [HROOT, OUT, dj, tj, title] = process.argv.slice(2), over = JSON.parse(dj || '{}');
const H_ = await import(pathToFileURL(join(HROOT, 'tools/sculpt/garments/helm.mjs')).href);
const AN = await import('data:text/javascript;base64,' + Buffer.from((await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: W, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: W })).outputFiles[0].text).toString('base64'));
const RED = [0.95, 0.1, 0.1], cc = (...ms) => { for (const m of ms) if (m) return Array.isArray(m) ? m : lookColour(m); return [1, 0, 1]; };
const times = { male: [1.33, 1.5, 1.92], female: [0.0, 0.42, 1.83] };
if (tj) Object.assign(times, JSON.parse(tj));
const cells = [], cw = 300, ch = 300;
let row = 0;
for (const who of ['male', 'female']) {
  const rig = buildRig(who), G = buildMantle(rig, { ...DESIGN[who], ...(over[who] ?? over) }); G.vw = mantleWeights(rig, G);
  const Hm = H_.buildHelm(rig); Hm.vw = H_.helmWeights(rig, Hm); const C = chestOf(who);
  const clip = AN.CLIPS.swing, body = who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
  let k = 0;
  for (const t of times[who]) {
    const r = AN.clipLocal(sk, clip, Math.max(0, t), AN.lowHeld(body)), pose = {};
    if (t >= 0) r.local.forEach((m, j) => { if (m && rig.bones[j].kind === 'control') pose[rig.bones[j].name] = m; });
    const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PH = skinGarment(rig, f, Hm), PC = skinGarment(rig, f, C, C.vw);
    const x = crossPairs(PG, G.tris, PH, Hm.tris), hitG = new Set(x.map(([a]) => G.tris[a].poly)), hitH = new Set(x.map(([, b]) => Hm.tris[b].poly));
    const hid = new Set([...C.hides, ...Hm.hides]);
    const meshes = [
      { who, P: PB, polys: rig.B.polys.map((p) => p.nv ?? p.v), tris: rig.B.tris.filter((tt) => !hid.has(tt.poly)).map((tt) => [...tt.v, tt.poly]), col: rig.B.polys.map((p) => (p.mat === 'skin' ? SKIN : [0.22, 0.15, 0.13])) },
      { who, P: PC, polys: C.polys.map((p) => p.v), tris: C.tris.map((tt) => [...tt.v, tt.poly]), col: C.polys.map((p) => lookColour(C.plain[C.mats.indexOf(p.mat)])) },
      { who, P: PH, polys: Hm.polys.map((p) => p.v), tris: Hm.tris.map((tt) => [...tt.v, tt.poly]), col: Hm.polys.map((p, i) => (hitH.has(i) ? RED : cc(H_.LOOKS.plain[p.mat], H_.MATS[p.mat]))) },
      { who, P: PG, polys: G.polys.map((p) => p.v), tris: G.tris.map((tt) => [...tt.v, tt.poly]), col: G.polys.map((p, i) => (hitG.has(i) ? RED : cc(ML.plain?.[p.mat], MATS[p.mat]))) },
    ];
    // head position for framing
    const hd = f[rig.at.get('head')], hc = hd?.t ?? hd?.p ?? [0, 0, 0];
    const YAWS = JSON.parse(process.env.YAWS ?? '[-35,60,-150]'), NC = YAWS.length;
    for (const [yi, yaw] of YAWS.entries()) {
      cells.push({ meshes, cam: { yaw, pitch: 10, s: +(process.env.ZOOM ?? 75), c: f[rig.at.get('neck_02')].P }, box: [(k * NC + yi) * cw, 34 + row * ch, cw, ch], label: `${who} ${t < 0 ? 'rest' : 'swing ' + t.toFixed(2) + ' s'} · helm ${x.length}` });
    }
    k++;
  }
  row++;
}
await shoot(Math.max(...Object.values(times).map((l) => l.length)) * (JSON.parse(process.env.YAWS ?? '[-35,60,-150]').length) * cw, 34 + row * ch, cells, OUT, { texts: [{ css: 'left:10px;top:6px', html: title ?? 'The swing: fur mantle against the plate helm (red: crossing)' }] });
await closeBrowser();
