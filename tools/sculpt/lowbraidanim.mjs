// The side braid (tools/sculpt/lowbraid.mjs) through the moves: the head turned each way and nodded, the arms forward
// and out (tools/sculpt/lowbraid.mjs armPoses),
// the game's walk (eight phases) and idle (eight phases, src/render/figure sculptRig), the hair's crossings with the
// face, the neck and the chest counted in each.
//
//   node tools/sculpt/lowbraidanim.mjs [--who female,male]
import { join } from 'node:path';
import { buildRig, posed, skin, gameRig, fromGame } from './lowrig.mjs';
import { skinHair } from './lowhair.mjs';
import { carve, buildBraid, crossReport, POSES, armPoses } from './lowbraid.mjs';

/** The moves on a rig: [name, pose] pairs. */
export async function moves(rig, tmp) {
  const arms = Object.entries(armPoses(rig));
  const out = [...Object.entries(POSES), ...arms];
  const g = await gameRig(rig, tmp);
  for (const [what, moving] of [['walk', true], ['idle', false]]) for (let i = 0; i < 8; i++) {
    const p = { phase: (i / 8) * Math.PI * 2, moving, facing: 0, swimming: false, working: false, look: g.look };
    out.push([`${what} ${i}`, fromGame(rig, g.bonesOf(g.sculptRig(p).rig, g.PROPS, [], g.REST_EXTRAS), g.gRest)]);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const H = carve(), tmp = join(new URL('.', import.meta.url).pathname, '../../tmp/lowbraidanim');
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = who === 'female' ? H.rig : buildRig(who), hair = buildBraid(rig, undefined, H), bad = [];
    for (const [name, pose] of await moves(rig, tmp)) {
      // (fromGame gives the frames themselves; a pose table is posed first)
      const f = Array.isArray(pose) ? pose : posed(rig, pose), r = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f));
      const n = r.face + r.neck + r.torso;
      if (n) bad.push(`${name} ${JSON.stringify(r.byPiece)}`);
    }
    console.log(who, bad.length ? `crossings in ${bad.length} moves: ${bad.join('; ')}` : 'no crossings in any move');
  }
}
