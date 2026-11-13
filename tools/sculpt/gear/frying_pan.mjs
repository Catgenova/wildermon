// The kitchen prop `frying_pan` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/frying_pan.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/frying_pan.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('frying_pan', at < 0 ? undefined : args[at + 1]);
