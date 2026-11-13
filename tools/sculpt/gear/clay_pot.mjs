// The kitchen prop `clay_pot` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/clay_pot.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/clay_pot.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('clay_pot', at < 0 ? undefined : args[at + 1]);
