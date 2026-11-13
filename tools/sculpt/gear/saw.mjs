// The saw (src/game/items.ts saw): built in tools/sculpt/gear/sawfish.mjs, written here to
// src/sculpt/assets/saw.json (lowgear.mjs gearAsset).
//   node tools/sculpt/gear/saw.mjs [--out <dir>]
import { writeAsset } from './sawfish.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('saw', at < 0 ? undefined : args[at + 1]);
