// A weapon held in a fight (src/sculpt/anim: the one-handed fight's striking fist, or both hands in the overhead swing),
// checked in the game's own path: lowScene's bake and bones for a body fighting with it (job attack_creature, a go of its
// clip's length), skinned as the shader skins them. Per body and outfit, over the go, the weapon's triangles crossing
// anything else drawn (the body, the hair, the garments), by the bone of what it crosses (the striking hand's own
// fingers, closed on the grip, are not counted), and at which moments of the go (seconds).
//
//   node tools/sculpt/lowweaponheldcheck.mjs [--weapon sword] [--asset sword] [--n 24] [--who male,female] [--outfits cloth,plate]
//   Exits 1 when the weapon crosses anything but the hand that holds it.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { crossPairs } from './lowgarment.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const WEAPON = opt('weapon', 'sword'), ASSET = opt('asset', WEAPON === 'maul' ? 'warhammer' : WEAPON === 'ancient_short_sword' ? 'short_sword' : WEAPON);
const ROOT = new URL('../..', import.meta.url).pathname;
const b = await build({
  stdin: { contents: `export { lowScene } from './src/sculpt/lowpoly'; export { clipFor } from './src/sculpt/anim';`, resolveDir: ROOT, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', absWorkingDir: ROOT,
  loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' },
  define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' },
});
const TS = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
const PROP = JSON.parse(readFileSync(new URL(`src/sculpt/assets/${ASSET}.json`, `file://${ROOT}`), 'utf8'));
let nProp = 0;
for (let t = 0; t < PROP.tris.length; t += 4) if (PROP.tris[t + 3] < PROP.glowFrom) nProp++;

const OUTFITS = {
  cloth: {},
  plate: { plateChest: true, plateLegs: true, plateBoots: true, plateHelm: true, plateMantle: true },
  leather: { leatherChest: true, leatherLegs: true, leatherBoots: true, leatherHat: true, leatherShawl: true },
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
/** A triangle's heaviest bone (its first corner's). */
const boneOf = (s, t) => { const V = s.baked.verts, o = t.v[0] * 17; let bi = 0, bw = -1; for (let j = 0; j < 4; j++) if (V[o + 11 + j] > bw) { bw = V[o + 11 + j]; bi = V[o + 7 + j]; } return s.baked.bones[bi]; };
/** The holding fist's own bones: the fingers closed on the grip touch it. */
const FIST = /^(hand|thumb_0[123]|fingers_0[12]|fingers_mid|knuckles)_[lr]$/;

const n = +opt('n', '24');
let fail = false;
for (const who of opt('who', 'male,female').split(',')) {
  const look = { gender: who === 'male' ? 'man' : 'woman', skin: 'light', hair: 'swept', hairColour: 'brown', eyes: 'brown', beard: 'none', shirt: 'unbleached', trousers: 'walnut' };
  for (const name of opt('outfits', 'cloth,plate,leather').split(',')) {
    const outfit = OUTFITS[name];
    const base = { phase: 0, moving: false, facing: 0, swimming: false, working: true, job: 'attack_creature', look, gear: { weapon: { id: WEAPON } }, outfit };
    const length = TS.clipFor({ ...base, act: { t: 0.1, length: 99 } })?.clip.length ?? 1;
    const r = { cross: 0, fist: 0, by: {}, at: {} };
    for (let k = 0; k < n; k++) {
      const s = TS.lowScene({ ...base, act: { t: (k / n) * length, length } });
      const { P, T } = skinned(s);
      const prop = T.slice(T.length - nProp), rest = T.slice(0, T.length - nProp);
      for (const [, j] of crossPairs(P, prop, P, rest)) {
        const bn = boneOf(s, rest[j]);
        if (FIST.test(bn)) { r.fist++; continue; }
        r.cross++; r.by[bn] = (r.by[bn] ?? 0) + 1;
        const at = ((k / n) * length).toFixed(2); r.at[at] = (r.at[at] ?? 0) + 1;
      }
    }
    if (r.cross) fail = true;
    console.log(who, name.padEnd(8), JSON.stringify(r));
  }
}
console.log(fail ? 'FAIL' : 'ok');
process.exit(fail ? 1 : 0);
