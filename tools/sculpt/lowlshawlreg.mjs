// The leather shawl's references (lineup-shawl.png, enchanted-glow-ref.png) against the low-poly bodies: the bodies and
// the shawl at rest written out for tools/sculpt/lowlshawlsheet.py, which projects them into the references' views
// (tools/sculpt/lowlshawlcams.json), lays them over the references and measures them against the traced outlines
// (tools/sculpt/lowlshawl-trace.json).
//
//   node tools/sculpt/lowlshawlreg.mjs --out <file.json> [--design '{...}'] [--bare]
//     per body: the body's vertices, triangles and polygons (front-facing edges are drawn), and the shawl's vertices,
//     triangles, polygons, each polygon's material and part (with --bare the body alone)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowlshawlreg/meshes.json')), over = JSON.parse(opt('design', '{}'));
const r4 = (x) => +x.toFixed(4);

/** One body's and its shawl's rest meshes for the page. */
export async function meshesOf(who, design = {}, bare = false) {
  const rig = buildRig(who), B = rig.B;
  const body = { verts: B.verts.map((p) => p.map(r4)), tris: B.tris.map((t) => t.v), polys: B.polys.map((p) => p.nv ?? p.v), mat: B.polys.map((p) => p.mat), floor: rig.J.floor };
  if (bare) return { body };
  const { buildLeatherShawl, DESIGN } = await import('./garments/leathershawl.mjs');
  const G = buildLeatherShawl(rig, { ...DESIGN[who], ...(design[who] ?? {}) });
  return { body, shawl: { verts: G.verts.map((p) => p.map(r4)), tris: G.tris.map((t) => t.v), tpoly: G.tris.map((t) => t.poly), polys: G.polys.map((p) => p.v), mat: G.polys.map((p) => p.mat), part: G.polys.map((p) => p.part), deg: G.cols.map((c) => c.deg), rings: Object.fromEntries(['H', 'BT0', 'Y1', 'u'].map((k) => [k, G.rings[k]])) } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(dirname(out), { recursive: true });
  const all = {};
  for (const who of ['male', 'female']) all[who] = await meshesOf(who, over, args.includes('--bare'));
  writeFileSync(out, JSON.stringify(all));
  console.log('wrote', out);
}
