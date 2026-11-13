// The kitchen prop `quern` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/quern.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/quern.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('quern', at < 0 ? undefined : args[at + 1]);
