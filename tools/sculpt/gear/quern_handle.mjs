// The kitchen prop `quern_handle` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/quern_handle.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/quern_handle.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('quern_handle', at < 0 ? undefined : args[at + 1]);
