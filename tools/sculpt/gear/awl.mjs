// The awl (src/game/items.ts awl) in the Runecut line: built in tools/sculpt/gear/finetools.mjs, written here to
// src/sculpt/assets/awl.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/awl.mjs [--out <dir>]
import { writeAsset } from './finetools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('awl', at < 0 ? undefined : args[at + 1]);
