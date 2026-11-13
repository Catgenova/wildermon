// The sawhorse and its log the saw clip's other palm presses on (src/sculpt/anim/clips/saw.ts), for the left palm and
// mirrored for the right: built in tools/sculpt/gear/sawfish.mjs, written here to src/sculpt/assets/sawhorse.json and
// sawhorse_r.json (lowgear.mjs gearAsset, the sockets the palm laid flat).
//   node tools/sculpt/gear/sawhorse.mjs [--out <dir>]
import { writeAsset } from './sawfish.mjs';

const args = process.argv.slice(2), at = args.indexOf('--out');
for (const id of ['sawhorse', 'sawhorse_r']) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
