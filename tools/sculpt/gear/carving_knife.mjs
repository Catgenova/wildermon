// The carving knife (src/game/items.ts carving_knife) in the Runecut line: built in tools/sculpt/gear/finetools.mjs, written here to
// src/sculpt/assets/carving_knife.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/carving_knife.mjs [--out <dir>]
import { writeAsset } from './finetools.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('carving_knife', at < 0 ? undefined : args[at + 1]);
