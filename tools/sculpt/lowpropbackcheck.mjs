// A prop carried on the back or at the belt (src/sculpt/assets/<asset>.json sockets.<who>.back or .belt, tools/sculpt/lowgear.mjs
// backSocketOf, beltSocketOf),
// checked in the game's own path in every outfit: lowScene's bake and bones for a body wielding it with no clip gripping
// it, skinned as the shader skins them. Per body and outfit, the prop's triangles crossing anything else drawn (the body,
// the hair, the garments), in the idle clip over its whole loop and in the walk (the walk reported, the idle a failure),
// and its clearance: the nearest any of its points comes to everything else (game units).
//
//   node tools/sculpt/lowpropbackcheck.mjs [--weapon maul] [--asset warhammer] [--idle 24] [--walk 16] [--who male,female]
//   Exits 1 when the prop crosses anything in the idle.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { crossPairs, closestOnTri } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const WEAPON = opt('weapon', 'maul'), ASSET = opt('asset', WEAPON === 'maul' ? 'warhammer' : WEAPON);
const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const PROP = JSON.parse(readFileSync(new URL(`src/sculpt/assets/${ASSET}.json`, `file://${ROOT}`), 'utf8'));
let nProp = 0;
for (let t = 0; t < PROP.tris.length; t += 4) if (PROP.tris[t + 3] < PROP.glowFrom) nProp++;

/** The outfits: the first (hood down, and up), the plate set, the leather set (its shawl over its chest), and each set's pieces with the cloth. */
const OUTFITS = {
  cloth: {},
  'cloth hood': { hood: true },
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  'plate no mantle': { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true },
  leather: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true, leatherShawl: true },
  'leather no shawl': { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true },
  'leather shawl': { leatherShawl: true },
};

/** The bake's points in the figure's frame, as the shader skins them, and its triangles. */
function skinned(s) {
  const V = s.baked.verts, Bn = s.bones, P = [];
  for (let i = 0; i < s.baked.nVerts; i++) {
    const o = i * 17, p = [V[o], V[o + 1], V[o + 2]], q = [0, 0, 0];
    for (let j = 0; j < 4; j++) {
      const w = V[o + 11 + j]; if (w <= 0) continue;
      const m = V[o + 7 + j] * 12;
      for (let c = 0; c < 3; c++) q[c] += w * (Bn[m + c * 4] * p[0] + Bn[m + c * 4 + 1] * p[1] + Bn[m + c * 4 + 2] * p[2] + Bn[m + c * 4 + 3]);
    }
    P.push(q);
  }
  return { P, T: Array.from({ length: s.baked.nTris }, (_, t) => ({ v: [s.baked.tris[t * 3], s.baked.tris[t * 3 + 1], s.baked.tris[t * 3 + 2]] })) };
}
/** The nearest any point of A's triangles comes to B's triangles (each of A's corners against B's triangles near it). */
function clearance(P, A, B) {
  const pts = [...new Set(A.flatMap((t) => t.v))].map((i) => P[i]);
  const lo = [0, 1, 2].map((c) => Math.min(...pts.map((p) => p[c])) - 1), hi = [0, 1, 2].map((c) => Math.max(...pts.map((p) => p[c])) + 1);
  const near = B.filter((t) => t.v.some((i) => P[i].every((x, c) => x >= lo[c] && x <= hi[c])));
  let d = Infinity;
  for (const p of pts) for (const t of near) { const [q] = closestOnTri(p, P[t.v[0]], P[t.v[1]], P[t.v[2]]), e = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (e < d) d = e; }
  return d;
}

const nIdle = +opt('idle', '24'), nWalk = +opt('walk', '16'), idleLen = TS.CLIPS.idle.length;
let fail = false;
for (const who of opt('who', 'male,female').split(',')) {
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'swept', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  for (const [name, outfit] of Object.entries(OUTFITS)) {
    const r = {};
    for (const [kind, moving, n] of [['idle', false, nIdle], ['walk', true, nWalk]]) {
      const c = (r[kind] = { cross: 0, clear: Infinity, at: null });
      for (let k = 0; k < n; k++) {
        // (the idle's time is its phase over six: the whole loop is six times its length)
        const phase = moving ? (k / n) * Math.PI * 2 : (k / n) * 6 * idleLen;
        const s = TS.lowScene({ phase, moving, facing: 0, swimming: false, working: false, look, gear: { weapon: { id: WEAPON } }, outfit });
        const { P, T } = skinned(s);
        const prop = T.slice(T.length - nProp), rest = T.slice(0, T.length - nProp);
        c.cross += crossPairs(P, prop, P, rest).length;
        const d = clearance(P, prop, rest);
        if (d < c.clear) { c.clear = d; c.at = moving ? `walk ${k}/${n}` : `idle ${(phase / 6).toFixed(2)} s`; }
      }
      c.clear = +c.clear.toFixed(3);
      if (kind === 'idle' && c.cross) fail = true;
    }
    console.log(who, name.padEnd(16), JSON.stringify(r));
  }
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
