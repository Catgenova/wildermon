// The chain set's shawl (tools/sculpt/garments/chainshawl.mjs, built here) in the garments' own renderer
// (lowgarmentshot.mjs shoot): alone, and on each body over the hauberk (and the coif's hood) at rest, from the front,
// three-quarter, side and back; with --poses, posed (arms overhead, out and forward, the swing's and the one-handed
// fight's key frames, the ground clip's kneel), the shawl's polygons crossing the body or what is under it red and those
// they cross blue, the count of crossing triangle pairs in each cell's label.
//
//   node tools/sculpt/lowchainshawlshot.mjs --out <dir> [--tag chainshawl] [--poses] [--who male,female] [--counts]
//     (--counts: the posed crossings printed, nothing drawn)
//     <tag>-alone.png, <tag>-worn.png; with --poses <tag>-poses-<who>.png
import { build } from 'esbuild';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { buildRig, posed, skin, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment, crossPairs } from './lowgarment.mjs';
import { buildClear, chainShawlWeights, underOf, assetMesh, MATS } from './garments/chainshawl.mjs';
import { MATS as CHAIN } from './garments/chainmail.mjs';
import { shoot, closeBrowser, SKIN } from './lowgarmentshot.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const OUT = opt('out', 'tmp/lowchainshawl'), TAG = opt('tag', 'chainshawl'), WHO = opt('who', 'male,female').split(',');
mkdirSync(OUT, { recursive: true });
const RED = [0.95, 0.1, 0.1], BLUE = [0.2, 0.4, 1];
// (the mail lit as the plain look shows it: the materials' colours, the shawl's a shade darker than the hauberk's so the two part)
const colOf = (m) => (MATS[m] ?? CHAIN[m] ?? [0.5, 0.5, 0.5]);
const under = {}, rigs = {}, shawls = {};
for (const who of WHO) {
  // (the shawl's own fit; shown and checked over the hauberk and the coif's hood)
  rigs[who] = buildRig(who); under[who] = [assetMesh('lowchainchest', who), assetMesh('lowchaincoif', who, { to: 'drop' })];
  const G = buildClear(rigs[who], undefined, underOf(who)); G.vw = chainShawlWeights(rigs[who], G); shawls[who] = G;
  const mats = {}; for (const p of G.polys) mats[p.mat] = (mats[p.mat] ?? 0) + 1;
  console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, lifted ${JSON.stringify(G.extra)}`, G.left ? 'left ' + JSON.stringify(G.left) : 'clear', JSON.stringify(mats));
}
const meshOfG = (who, G, P = G.verts, hot = new Set()) => ({ who, P, polys: G.polys.map((p) => p.v), tris: G.tris.map((t) => [...t.v, t.poly]), col: G.polys.map((p, i) => (hot.has(i) ? RED : colOf(p.mat))), edges: false });
const bodyMesh = (who, P, hot = new Set()) => { const B = rigs[who].B; return { who, P, polys: B.polys.map((p) => p.nv ?? p.v), tris: B.tris.map((t) => [...t.v, t.poly]), col: B.polys.map((p, i) => (hot.has(i) ? BLUE : p.mat === 'skin' ? SKIN : [0.22, 0.15, 0.13])) }; };
const underMesh = (who, m, P = m.verts) => ({ who, P, polys: m.asset.polys.map(([v]) => v), tris: m.tris.map((t) => [...t.v, t.poly]), col: m.asset.polys.map(([, k]) => { const n = m.asset.mats[k]; return n === 'plate' || n === 'shade' ? CHAIN[n].map((x) => x * 0.8) : CHAIN[n] ?? [0.4, 0.4, 0.4]; }) });

// ---- alone, and worn
const COUNTS = args.includes('--counts');
if (!COUNTS) {
  const cw = 300, ch = 330, cells = [], YAWS = [[0, 'front'], [-40, '3/4'], [-90, 'side'], [180, 'back']];
  WHO.forEach((who, wi) => YAWS.forEach(([yaw, lab], k) => cells.push({ meshes: [meshOfG(who, shawls[who])], cam: { yaw, pitch: 12, s: 70, c: [0, -0.9, 0] }, box: [k * cw, 34 + wi * ch, cw, ch], label: `${who} ${lab}` })));
  // and from above
  WHO.forEach((who, wi) => cells.push({ meshes: [meshOfG(who, shawls[who])], cam: { yaw: -20, pitch: 70, s: 62, c: [0, -0.9, 0] }, box: [4 * cw, 34 + wi * ch, cw, ch], label: `${who} above` }));
  await shoot(5 * cw, 34 + WHO.length * ch, cells, join(OUT, `${TAG}-alone.png`), { texts: [{ css: 'left:10px;top:6px', html: 'The chain shawl (petal gorget) alone, plain look, both bodies' }] });
}
if (!COUNTS) {
  const cw = 300, ch = 420, cells = [], YAWS = [[0, 'front'], [-40, '3/4'], [-90, 'side'], [180, 'back']];
  WHO.forEach((who, wi) => YAWS.forEach(([yaw, lab], k) => cells.push({ meshes: [bodyMesh(who, rigs[who].B.verts), ...under[who].map((m) => underMesh(who, m)), meshOfG(who, shawls[who])], cam: { yaw, pitch: 8, s: 40, c: [0, -1.6, 0] }, box: [k * cw, 34 + wi * ch, cw, ch], label: `${who} ${lab}` })));
  await shoot(4 * cw, 34 + WHO.length * ch, cells, join(OUT, `${TAG}-worn.png`), { texts: [{ css: 'left:10px;top:6px', html: 'The chain shawl over the hauberk and the coif\'s hood (its tippet left out), at rest' }] });
}

// ---- posed
if (args.includes('--poses') || COUNTS) {
  const ROOT = new URL('../..', import.meta.url).pathname;
  const AN = await import('data:text/javascript;base64,' + Buffer.from((await build({ stdin: { contents: `export { CLIPS } from './src/sculpt/anim'; export { clipLocal } from './src/sculpt/anim/player'; export { lowSkeleton, lowHeld } from './src/sculpt/lowpoly';`, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT })).outputFiles[0].text).toString('base64'));
  for (const who of WHO) {
    const rig = rigs[who], G = shawls[who], body = who === 'male' ? 'man' : 'woman', sk = AN.lowSkeleton(body);
    const clip = (name, t) => { const c = AN.CLIPS[name], r = AN.clipLocal(sk, c, t, c.grip ? AN.lowHeld(body) : undefined), p = {}; r.local.forEach((m, i) => { if (m && rig.bones[i].kind === 'control') p[rig.bones[i].name] = m; }); return p; };
    const W = (bone, deg, ax = [0, 0, 1]) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(ax, deg), R)); };
    const up = (p, s, deg) => { const m = s === 'l' ? 1 : -1; p[`clavicle_${s}`] = W(`clavicle_${s}`, m * 22 * deg / 140); p[`upperarm_${s}`] = W(`upperarm_${s}`, m * deg); p[`lowerarm_${s}`] = W(`lowerarm_${s}`, m * 8); return p; };
    const fwd = (p, s, deg) => { p[`upperarm_${s}`] = W(`upperarm_${s}`, -deg, [1, 0, 0]); return p; };
    const L = (n) => AN.CLIPS[n].length;
    const poses = [
      ['rest', {}], ['arms out', up(up({}, 'l', 85), 'r', 85)], ['arms overhead', up(up({}, 'l', 140), 'r', 140)], ['arms forward', fwd(fwd({}, 'l', 80), 'r', 80)],
      ...[0.27, 0.46, 0.84, 1.3].map((t) => [`swing ${t}s`, clip('swing', t)]),
      ...[0.3, 0.55, 0.75].map((u) => [`fight ${u}`, clip('fight', u * L('fight'))]),
      ...[0.35, 0.6].map((u) => [`ground ${u}`, clip('ground', u * L('ground'))]),
    ];
    const cw = 250, ch = 300, YAWS = [-35, 145], cells = [];
    poses.forEach(([label, pose], fi) => {
      const f = posed(rig, pose), PB = skin(rig, f), PG = skinGarment(rig, f, G), PU = under[who].map((m) => skinGarment(rig, f, { verts: m.verts, vw: m.asset.weights.map((w) => { const o = []; for (let k = 0; k < w.length; k += 2) o.push([w[k], w[k + 1]]); return o; }) }));
      const xb = crossPairs(PG, G.tris, PB, rig.B.tris), xu = under[who].flatMap((m, k) => crossPairs(PG, G.tris, PU[k], m.tris)), xs = crossPairs(PG, G.tris).filter(([a, b]) => G.polys[G.tris[a].poly].part !== G.polys[G.tris[b].poly].part);
      const hot = new Set([...xb, ...xu, ...xs.flat().map((a) => [a])].map(([a]) => G.tris[a].poly)), hb = new Set(xb.map(([, b]) => rig.B.tris[b].poly));
      const meshes = [bodyMesh(who, PB, hb), ...under[who].map((m, k) => underMesh(who, m, PU[k])), meshOfG(who, G, PG, hot)];
      const c = f[rig.at.get('spine_03')].P;
      YAWS.forEach((yaw, yi) => cells.push({ meshes, cam: { yaw, pitch: 10, s: 46, c: [c[0], c[1] + 0.2, c[2]] }, box: [(fi % 6) * 2 * cw + yi * cw, 34 + Math.floor(fi / 6) * ch, cw, ch], label: `${label} · body ${xb.length} under ${xu.length} self ${xs.length}` }));
      console.log(who, label, 'body', xb.length, 'under', xu.length, 'self', xs.length);
    });
    if (!COUNTS) await shoot(12 * cw, 34 + Math.ceil(poses.length / 6) * ch, cells, join(OUT, `${TAG}-poses-${who}.png`), { texts: [{ css: 'left:10px;top:6px', html: `The chain shawl posed (${who}): red, the shawl's polygons crossing the body, the hauberk or the coif, or another of its parts; blue, the body's it crosses` }] });
  }
}
await closeBrowser();
