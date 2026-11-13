// Checks the chain set (tools/sculpt/garments/chain*.mjs) as the game wears it (src/sculpt/lowpoly.ts, bundled and run
// in node): every chain item equipped is drawn (outfitOf gives it a wear switch, and the bake grows by its garment), each
// piece takes its own metal and its enchantment, and the materials a draw takes stay within the renderer's
// (src/sculpt/gl.ts MAX_MATS) for every outfit the armour's slots can make (each slot empty or any piece of any set,
// bare or with the tool belt, a shield and a jewel, plain or enchanted, both bodies: lowMaterialsMost).
//
//   node tools/sculpt/lowchaincheck.mjs [VERBOSE=1]
//     prints the checks' outcome and the most materials any outfit takes; exits 1 on a failure.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../..', import.meta.url).pathname;
const MAX = +readFileSync(new URL('../../src/sculpt/gl.ts', import.meta.url), 'utf8').match(/const MAX_MATS = (\d+)/)[1];
const entry = `
import { lowScene, lowMaterialsMost, outfitOf } from './src/sculpt/lowpoly';
import { DEFAULT_LOOK } from './src/game/look';
import { ARMOUR } from './src/game/gear';
const ITEMS = { head: 'chain_coif', chest: 'chain_hauberk', shawl: 'chain_shawl', legs: 'chain_leggings', feet: 'chain_boots' };
const KEY = { chain_coif: 'chainCoif', chain_hauberk: 'chainChest', chain_shawl: 'chainChest', chain_leggings: 'chainLegs', chain_boots: 'chainBoots' };
const fails = [];
const ok = (c, m) => { if (!c || process.env.VERBOSE) console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails.push(m); };
const pose = (gender, gear) => ({ phase: 0, moving: false, facing: 1, swimming: false, working: false, look: { ...DEFAULT_LOOK, gender }, gear });
for (const gender of ['man', 'woman']) {
  const bare = lowScene(pose(gender, {}));
  for (const [slot, id] of Object.entries(ITEMS)) {
    const o = outfitOf({ [slot]: { id, material: 'gold', enchanted: true } });
    ok(o[KEY[id]] === true, gender + ' ' + id + ': worn as ' + KEY[id]);
    ok(o.metal?.[KEY[id]] === 'gold', gender + ' ' + id + ': in its metal');
    ok(o.enchanted?.[KEY[id]] === true, gender + ' ' + id + ': enchanted');
    const d = lowScene(pose(gender, { [slot]: { id, material: 'copper' } }));
    ok(d.baked.nTris > bare.baked.nTris, gender + ' ' + id + ': drawn (' + bare.baked.nTris + ' -> ' + d.baked.nTris + ' triangles)');
  }
}
console.log('chain items: ' + (fails.length ? fails.length + ' failed' : 'each worn, drawn, in its metal and enchanted'));
for (const gender of ['man', 'woman']) {
  const all = Object.fromEntries(Object.entries(ITEMS).map(([s, id]) => [s, { id, material: 'steel' }])), d = lowScene(pose(gender, all)), bare = lowScene(pose(gender, {}));
  const plate = lowScene(pose(gender, { head: { id: 'helm' }, chest: { id: 'plate_breastplate' }, legs: { id: 'plate_legs' }, feet: { id: 'plate_boots' } }));
  const leather = lowScene(pose(gender, { head: { id: 'leather_cap' }, chest: { id: 'leather_jerkin' }, legs: { id: 'leather_trousers' }, feet: { id: 'leather_boots' } }));
  console.log(gender + ' the whole set: ' + d.baked.nTris + ' triangles drawn, baked in ' + Math.round(d.baked.ms) + ' ms (the first outfit ' + bare.baked.nTris + ', plate ' + plate.baked.nTris + ' in ' + Math.round(plate.baked.ms) + ' ms, leather ' + leather.baked.nTris + ' in ' + Math.round(leather.baked.ms) + ' ms)');
}
// every outfit the armour slots can make
const bySlot = { head: [], chest: [], shawl: [], legs: [], feet: [] };
for (const a of ARMOUR) if (bySlot[a.slot]) bySlot[a.slot].push(a.id);
const slots = Object.keys(bySlot);
// with the tool belt, either shield and either jewel worn over it
const KITS = [{}, ...['wooden_shield', 'metal_shield'].flatMap((offhand) => ['jewelled_pendant', 'jewelled_ring'].map((jewel) => ({ belt: 'toolbelt', offhand, jewel })))];
let most = 0, worst = '', n = 0;
const walk = (k, gear) => {
  if (k === slots.length) {
    for (const lit of [false, true]) for (const gender of ['man', 'woman']) for (const kit of KITS) {
      const g = { ...Object.fromEntries(Object.entries(gear).map(([s, id]) => [s, { id, material: 'iron', ...(lit ? { enchanted: true } : {}) }])), ...Object.fromEntries(Object.entries(kit).map(([s, id]) => [s, { id, ...(lit ? { enchanted: true } : {}) }])) };
      const m = lowMaterialsMost(pose(gender, g));
      n++;
      if (m > most) { most = m; worst = gender + ' ' + [...Object.values(gear), ...Object.values(kit)].join(' ') + (lit ? ' enchanted' : ''); }
    }
    return;
  }
  walk(k + 1, gear);
  for (const id of bySlot[slots[k]]) walk(k + 1, { ...gear, [slots[k]]: id });
};
walk(0, {});
console.log('materials: the most any of ' + n + ' outfits takes, both hands holding tools: ' + most + ' of ${MAX} (' + worst + ')');
ok(most <= ${MAX}, 'materials within the renderer');
globalThis.__fails = fails.length;
`;
const b = await build({ stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'error', target: 'es2022', loader: { '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.wav': 'dataurl', '.ogg': 'dataurl', '.mp3': 'dataurl' }, define: { 'import.meta.env': '{}', __DEPLOY__: 'undefined' }, absWorkingDir: ROOT });
globalThis.window ??= globalThis;
await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
if (globalThis.__fails) process.exit(1);
