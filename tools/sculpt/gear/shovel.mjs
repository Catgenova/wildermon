// The shovel (src/game/items.ts shovel) in the Runecut line: built in tools/sculpt/gear/farmtools.mjs, written here to
// src/sculpt/assets/shovel.json (lowgear.mjs gearAsset, with its contact point: the blade's tip).
//   node tools/sculpt/gear/shovel.mjs [--out <dir>]
import { writeAsset } from './farmtools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('shovel', at < 0 ? undefined : args[at + 1]);
