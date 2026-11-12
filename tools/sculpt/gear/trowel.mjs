// The trowel (src/game/items.ts trowel) in the Runecut line: built in tools/sculpt/gear/finetools.mjs, written here to
// src/sculpt/assets/trowel.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/trowel.mjs [--out <dir>]
import { writeAsset } from './finetools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('trowel', at < 0 ? undefined : args[at + 1]);
