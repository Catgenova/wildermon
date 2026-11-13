// The kitchen prop `skewer` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/skewer.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/skewer.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('skewer', at < 0 ? undefined : args[at + 1]);
