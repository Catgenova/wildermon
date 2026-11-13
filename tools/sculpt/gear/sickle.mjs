// The sickle (src/game/items.ts sickle) in the Runecut line: built in tools/sculpt/gear/farmtools.mjs, written here to
// src/sculpt/assets/sickle.json (lowgear.mjs gearAsset, with its contact point: the middle of the blade's edge).
//   node tools/sculpt/gear/sickle.mjs [--out <dir>]
import { writeAsset } from './farmtools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('sickle', at < 0 ? undefined : args[at + 1]);
