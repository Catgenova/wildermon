// The fishing net (src/game/items.ts fishing_net): built in tools/sculpt/gear/sawfish.mjs, written here to
// src/sculpt/assets/fishing_net.json (lowgear.mjs gearAsset).
//   node tools/sculpt/gear/fishing_net.mjs [--out <dir>]
import { writeAsset } from './sawfish.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('fishing_net', at < 0 ? undefined : args[at + 1]);
