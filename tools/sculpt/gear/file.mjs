// The file (src/game/items.ts file) in the Runecut line: built in tools/sculpt/gear/finetools.mjs, written here to
// src/sculpt/assets/file.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/file.mjs [--out <dir>]
import { writeAsset } from './finetools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('file', at < 0 ? undefined : args[at + 1]);
