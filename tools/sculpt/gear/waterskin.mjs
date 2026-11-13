// The waterskin (the eat and drink clips, src/sculpt/anim/clips/meal.ts): built in tools/sculpt/gear/vessels.mjs, written here to
// src/sculpt/assets/waterskin.json (lowgear.mjs gearAsset, with its contact point).
//   node tools/sculpt/gear/waterskin.mjs [--out <dir>]
import { writeAsset } from './vessels.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
await writeAsset('waterskin', at < 0 ? undefined : args[at + 1]);
