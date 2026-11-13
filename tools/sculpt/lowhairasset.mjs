// The hairstyles as the game loads them: every style on both low-poly bodies (tools/sculpt/lowhair.mjs gameHair) into
// src/sculpt/assets/lowhair.json, and each style's id and name into src/sculpt/assets/lowhair-styles.json, the list the
// character creator offers (src/game/look.ts HAIRSTYLES, with Bald). The styles lowhair.mjs builds (its STYLES) and the
// side braid, built by tools/sculpt/lowbraid.mjs; the bob, by tools/sculpt/lowbob.mjs (its outline fit read from
// tools/sculpt/hairs/bob-fit-<who>.json); the shoulder length, by tools/sculpt/lowwarrior.mjs. A style's name is its module's `name` (tools/sculpt/hairs/<id>.mjs).
//
//   node tools/sculpt/lowhairasset.mjs   (or node tools/sculpt/lowhair.mjs --asset)
import { writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { STYLES, buildHair, gameHair } from './lowhair.mjs';
import { carve } from './lowhairhull.mjs';
import { buildBraid, carve as carveBraid } from './lowbraid.mjs';
import BRAID from './hairs/braid.mjs';
import { bobOf } from './lowbob.mjs';
import BOB from './hairs/bob.mjs';
import { warriorOf } from './lowwarrior.mjs';
import WARRIOR from './hairs/warrior.mjs';

const braidHull = carveBraid();
const BUILDERS = {
  ...Object.fromEntries(Object.entries(STYLES).map(([id, st]) => [id, { name: st.name, build: (rig) => buildHair(rig, st, carve(id)) }])),
  braid: { name: BRAID.name, build: (rig) => buildBraid(rig, BRAID, braidHull) },
  bob: { name: BOB.name, build: (rig) => bobOf(rig, BOB) },
  warrior: { name: WARRIOR.name, build: (rig) => warriorOf(rig, WARRIOR) },
};

const out = { built: 'node tools/sculpt/lowhair.mjs --asset (tools/sculpt/lowhair.mjs gameHair)' };
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  out[who] = Object.fromEntries(Object.entries(BUILDERS).map(([id, b]) => [id, gameHair(rig, b.build(rig))]));
}
const file = new URL('../../src/sculpt/assets/lowhair.json', import.meta.url);
writeFileSync(file, JSON.stringify(out));
console.log('wrote', file.pathname);
const index = new URL('../../src/sculpt/assets/lowhair-styles.json', import.meta.url);
writeFileSync(index, `${JSON.stringify({ built: 'node tools/sculpt/lowhair.mjs --asset', styles: Object.entries(BUILDERS).map(([id, b]) => ({ id, name: b.name })) }, null, 1)}\n`);
console.log('wrote', index.pathname);
