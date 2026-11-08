// The long sword carried on the back (src/sculpt/assets/long_sword.json sockets.<who>.back, tools/sculpt/lowgear.mjs
// backSocketOf), checked in the game's own path: lowScene's bake and bones for a body wielding it with no clip gripping
// it, skinned as the shader skins them, the swept hair on, every garment at the game's default (the hood down) and
// again with the hood up. Per body, the sword's triangles crossing the body's (and the hair's), each garment's, in
// the idle clip over its whole loop and in the walk (the walk reported, the idle a failure), and its clearance: the
// nearest any of its points comes to everything else drawn (game units).
//
//   node tools/sculpt/lowbackcheck.mjs [--idle 24] [--walk 16] [--who male|female]
//   Exits 1 when the sword crosses anything in the idle.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { crossPairs, closestOnTri } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { CLIPS } from './src/sculpt/anim';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const json = (f) => JSON.parse(readFileSync(new URL(f, `file://${ROOT}`), 'utf8'));

const SWORD = json('src/sculpt/assets/long_sword.json');
let nSword = 0;
for (let t = 0; t < SWORD.tris.length; t += 4) if (SWORD.tris[t + 3] < SWORD.glowFrom) nSword++;
const HAIR = json('src/sculpt/assets/lowhair.json');

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
  const body = json(`src/sculpt/assets/low${who}.json`);
  const G = Object.fromEntries(['shawl', 'trousers', 'boots', 'tunic', 'hood'].map((g) => [g, json(`src/sculpt/assets/low${g}-${who}.json`)]));
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'swept', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  for (const hood of [false, true]) {
    // (the bake: the body less what the garments hide, the hair (not under the hood), each garment worn, the sword)
    const worn = ['shawl', 'trousers', 'boots', 'tunic', ...(hood ? ['hood'] : [])];
    const hidden = new Set(worn.flatMap((g) => G[g].hides ?? []));
    const parts = [['body', body.tris.filter((_, k) => k % 4 === 3).filter((pi) => !hidden.has(pi)).length], ['hair', hood ? 0 : HAIR[who].swept.tris.length / 4], ...worn.map((g) => [g, G[g].tris.length / 4]), ['sword', nSword]];
    const r = {};
    for (const [kind, moving, n] of [['idle', false, nIdle], ['walk', true, nWalk]]) {
      const c = (r[kind] = { ...Object.fromEntries(parts.filter(([p, m]) => p !== 'sword' && m).map(([p]) => [p, 0])), clear: Infinity, at: null });
      for (let k = 0; k < n; k++) {
        // (the idle's time is its phase over six: the whole loop is six times its length)
        const phase = moving ? (k / n) * Math.PI * 2 : (k / n) * 6 * idleLen;
        const s = TS.lowScene({ phase, moving, facing: 0, swimming: false, working: false, look, gear: { weapon: { id: 'long_sword' } }, outfit: { hood } });
        const { P, T } = skinned(s);
        if (T.length !== parts.reduce((a, [, m]) => a + m, 0)) { console.log(who, 'the bake is not', parts.map(([p]) => p).join(', ')); fail = true; break; }
        let at = 0;
        const sl = Object.fromEntries(parts.map(([p, m]) => { const x = T.slice(at, at + m); at += m; return [p, x]; }));
        for (const [p, m] of parts) if (p !== 'sword' && m) c[p] += crossPairs(P, sl.sword, P, sl[p]).length;
        const d = clearance(P, sl.sword, T.slice(0, T.length - nSword));
        if (d < c.clear) { c.clear = d; c.at = moving ? `walk ${k}/${n}` : `idle ${(phase / 6).toFixed(2)} s`; }
      }
      c.clear = +c.clear.toFixed(3);
      if (kind === 'idle' && Object.entries(c).some(([p, v]) => p !== 'clear' && p !== 'at' && v)) fail = true;
    }
    console.log(who, hood ? 'hood up' : 'hood down', JSON.stringify(r));
  }
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
