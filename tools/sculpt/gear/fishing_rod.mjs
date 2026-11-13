// The fishing rod (src/game/items.ts fishing_rod): built in tools/sculpt/gear/sawfish.mjs, written here to
// src/sculpt/assets/fishing_rod.json (lowgear.mjs gearAsset).
//   node tools/sculpt/gear/fishing_rod.mjs [--out <dir>]
import { writeAsset } from './sawfish.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('fishing_rod', at < 0 ? undefined : args[at + 1]);
