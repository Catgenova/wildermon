// The hairstyles as the game loads them: every style on both low-poly bodies (tools/sculpt/lowhair.mjs gameHair) into
// src/sculpt/assets/lowhair.json, and each style's id and name into src/sculpt/assets/lowhair-styles.json, the list the
// character creator offers (src/game/look.ts HAIRSTYLES, with Bald). The styles lowhair.mjs builds (its STYLES) and the
// side braid, built by tools/sculpt/lowbraid.mjs; the bob, by tools/sculpt/lowbob.mjs (its outline fit read from
// tools/sculpt/hairs/bob-fit-<who>.json); the pompadour, by tools/sculpt/lowpomp.mjs; the side shave, by
// tools/sculpt/lowsideshave.mjs; balding and the monk cut, by tools/sculpt/lowring.mjs. A style's name is its module's
// `name` (tools/sculpt/hairs/<id>.mjs).
//
//   node tools/sculpt/lowhairasset.mjs   (or node tools/sculpt/lowhair.mjs --asset)
//   node tools/sculpt/lowhairasset.mjs --only balding,monk   (those styles built, every other entry kept as written)
import { readFileSync, writeFileSync } from 'node:fs';
import { buildRig } from './lowrig.mjs';
import { STYLES, buildHair, gameHair } from './lowhair.mjs';
import { carve } from './lowhairhull.mjs';
import { buildBraid, carve as carveBraid } from './lowbraid.mjs';
import BRAID from './hairs/braid.mjs';
import { bobOf } from './lowbob.mjs';
import BOB from './hairs/bob.mjs';
import { pompOf } from './lowpomp.mjs';
import POMP from './hairs/pompadour.mjs';
import { buildTopknot } from './lowtopknot.mjs';
import TOPKNOT from './hairs/topknot.mjs';
import { crewOf } from './lowcrew.mjs';
import CREW from './hairs/crew.mjs';
import { mohawkOf } from './lowmohawk.mjs';
import MOHAWK from './hairs/mohawk.mjs';
import { cornrowsOf } from './lowcornrows.mjs';
import CORNROWS from './hairs/cornrows.mjs';
import { buzzOf } from './lowbuzz.mjs';
import BUZZ from './hairs/buzz.mjs';
import { afroOf } from './lowafro.mjs';
import AFRO from './hairs/afro.mjs';
import { warriorOf } from './lowwarrior.mjs';
import WARRIOR from './hairs/warrior.mjs';
import { dreadsOf } from './lowdreads.mjs';
import DREADS from './hairs/dreads.mjs';
import { crownbraidOf } from './lowcrownbraid.mjs';
import CROWNBRAID from './hairs/crownbraid.mjs';
import { spacebunsOf } from './lowspacebuns.mjs';
import SPACEBUNS from './hairs/spacebuns.mjs';
import { pixieOf } from './lowpixie.mjs';
import PIXIE from './hairs/pixie.mjs';
import { chignonOf } from './lowchignon.mjs';
import CHIGNON from './hairs/chignon.mjs';
import { shagOf } from './lowshag.mjs';
import SHAG from './hairs/shag.mjs';
import { ponytailOf } from './lowponytail.mjs';
import PONYTAIL from './hairs/ponytail.mjs';
import { sideshaveOf } from './lowsideshave.mjs';
import SIDESHAVE from './hairs/sideshave.mjs';
import { twinBraidsOf } from './lowtwinbraids.mjs';
import TWIN from './hairs/twinbraids.mjs';
import { wavesOf } from './lowwaves.mjs';
import WAVES from './hairs/waves.mjs';
import { baldingOf, monkOf } from './lowring.mjs';
import BALDING from './hairs/balding.mjs';
import MONK from './hairs/monk.mjs';

const braidHull = carveBraid();
const BUILDERS = {
  ...Object.fromEntries(Object.entries(STYLES).map(([id, st]) => [id, { name: st.name, build: (rig) => buildHair(rig, st, carve(id)) }])),
  braid: { name: BRAID.name, build: (rig) => buildBraid(rig, BRAID, braidHull) },
  bob: { name: BOB.name, build: (rig) => bobOf(rig, BOB) },
  pompadour: { name: POMP.name, build: (rig) => pompOf(rig, POMP) },
  topknot: { name: TOPKNOT.name, build: (rig) => buildTopknot(rig, TOPKNOT) },
  crew: { name: CREW.name, build: (rig) => crewOf(rig, CREW) },
  mohawk: { name: MOHAWK.name, build: (rig) => mohawkOf(rig, MOHAWK) },
  cornrows: { name: CORNROWS.name, build: (rig) => cornrowsOf(rig) },
  buzz: { name: BUZZ.name, build: (rig) => buzzOf(rig, BUZZ) },
  afro: { name: AFRO.name, build: (rig) => afroOf(rig, AFRO) },
  warrior: { name: WARRIOR.name, build: (rig) => warriorOf(rig, WARRIOR) },
  dreads: { name: DREADS.name, build: (rig) => dreadsOf(rig, DREADS) },
  crownbraid: { name: CROWNBRAID.name, build: (rig) => crownbraidOf(rig, CROWNBRAID) },
  spacebuns: { name: SPACEBUNS.name, build: (rig) => spacebunsOf(rig, SPACEBUNS) },
  pixie: { name: PIXIE.name, build: (rig) => pixieOf(rig, PIXIE) },
  chignon: { name: CHIGNON.name, build: (rig) => chignonOf(rig, CHIGNON) },
  shag: { name: SHAG.name, build: (rig) => shagOf(rig, SHAG) },
  ponytail: { name: PONYTAIL.name, build: (rig) => ponytailOf(rig, PONYTAIL) },
  sideshave: { name: SIDESHAVE.name, build: (rig) => sideshaveOf(rig, SIDESHAVE) },
  twinbraids: { name: TWIN.name, build: (rig) => twinBraidsOf(rig, TWIN) },
  waves: { name: WAVES.name, build: (rig) => wavesOf(rig, WAVES) },
  balding: { name: BALDING.name, build: (rig) => baldingOf(rig, BALDING) },
  monk: { name: MONK.name, build: (rig) => monkOf(rig, MONK) },
};

const file = new URL('../../src/sculpt/assets/lowhair.json', import.meta.url);
// (--only: those styles built, the rest read back from the file as they were written)
const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const was = only ? JSON.parse(readFileSync(file, 'utf8')) : null;
const out = { built: 'node tools/sculpt/lowhair.mjs --asset (tools/sculpt/lowhair.mjs gameHair)' };
for (const who of ['male', 'female']) {
  const rig = buildRig(who);
  out[who] = Object.fromEntries(Object.entries(BUILDERS).map(([id, b]) => [id, only && !only.includes(id) ? was[who][id] : gameHair(rig, b.build(rig))]));
}
writeFileSync(file, JSON.stringify(out));
console.log('wrote', file.pathname);
const index = new URL('../../src/sculpt/assets/lowhair-styles.json', import.meta.url);
writeFileSync(index, `${JSON.stringify({ built: 'node tools/sculpt/lowhair.mjs --asset', styles: Object.entries(BUILDERS).map(([id, b]) => ({ id, name: b.name })) }, null, 1)}\n`);
console.log('wrote', index.pathname);
