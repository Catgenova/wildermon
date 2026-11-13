// The kitchen prop `wooden_spoon` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/wooden_spoon.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/wooden_spoon.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('wooden_spoon', at < 0 ? undefined : args[at + 1]);
