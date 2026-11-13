// The kitchen prop `clay_jar` (src/sculpt/anim/clips/kitchen.ts): built in tools/sculpt/gear/kitchen.mjs, written here to
// src/sculpt/assets/clay_jar.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/clay_jar.mjs [--out <dir>]
import { writeAsset } from './kitchen.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('clay_jar', at < 0 ? undefined : args[at + 1]);
