// The rake (src/game/items.ts rake) in the Runecut line: built in tools/sculpt/gear/farmtools.mjs, written here to
// src/sculpt/assets/rake.json (lowgear.mjs gearAsset, with its contact point: the teeth's tips).
//   node tools/sculpt/gear/rake.mjs [--out <dir>]
import { writeAsset } from './farmtools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('rake', at < 0 ? undefined : args[at + 1]);
