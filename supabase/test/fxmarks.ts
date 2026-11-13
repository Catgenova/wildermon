/**
 * The effect marks on the clips, followed body by body (`src/sculpt/fxmarks.ts`), with no browser: the one-handed fight's
 * sparks mark, a body's clip time moved as a frame would move it.
 *
 *   * a mark fires once each time the clip's time passes it going forward, a loop's wrap counted;
 *   * time going back a little and forward again fires nothing twice; going back further (a new go) fires it again;
 *   * a leap past `SKIP`, a change of clip, or a body unseen for `GAP` starts afresh and fires nothing;
 *   * a timed job's go fitted to its length (`fitTime`) fires the mark once a go, however long the go;
 *   * the mirrored clip (played left-handed) fires from the other hand, and the point is where the weapon is, the same
 *     every time it is asked.
 */
import { fxTrack, GAP, REWIND, SKIP } from '../../src/sculpt/fxmarks';
import { clipFor } from '../../src/sculpt/anim';
import { markTime, runsOf } from '../../src/sculpt/anim/clip';
import type { FigurePose } from '../../src/render/figure';
import { check, finish } from './harness';

const look = { gender: 'man', hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 } as FigurePose['look'];
const fighter = (id: string, phase: number, facing = 1, act?: FigurePose['act']): FigurePose => ({
  id, phase, moving: false, facing, swimming: false, working: true, job: 'attack_creature', look,
  gear: { weapon: { id: 'sword', material: 'steel' } }, ...(act ? { act } : {}),
});
const c0 = clipFor(fighter('a', 0))!;
const L = c0.clip.length, at = markTime(c0.clip, c0.clip.fx![0]);
/** The phase that puts body `id` at clip time t (its time is the phase over six and its own share of the loop). */
const phaseAt = (id: string, t: number): number => (t - (clipFor(fighter(id, 0))!.t)) * 6;

let now = 100;
const DT = 1 / 30;
/** Body `id` moved from clip time a to b in frames of DT, the fires counted. */
function run(id: string, a: number, b: number): number {
  let n = 0;
  for (let t = a; t <= b + 1e-9; t += DT) { now += DT; n += fxTrack(id, fighter(id, phaseAt(id, t)), now).length; }
  return n;
}

check('the one-handed fight carries its sparks mark', c0.clip.fx?.[0]?.kind === 'sparks', `${c0.clip.name}: ${JSON.stringify(c0.clip.fx)}`);
{
  const runs = 3, n = run('loop', at - 0.3, at - 0.3 + runs * L);
  check(`a mark fires once a run of the loop: ${runs} runs, ${runs} fires`, n === runs, `${n}`);
}
{
  run('jit', at - 0.3, at + 0.1);
  const back = run('jit', at + 0.1 - REWIND * 0.6, at + 0.2);
  check(`back ${(REWIND * 0.6).toFixed(2)} s over the mark and on again: it does not fire twice`, back === 0, `${back} more`);
  const again = run('jit', at - REWIND * 2, at + 0.1);
  check(`back ${(REWIND * 2).toFixed(2)} s (a new go): it fires again`, again === 1, `${again}`);
}
{
  run('leap', at - 0.5, at - 0.4);
  now += DT;
  const n = fxTrack('leap', fighter('leap', phaseAt('leap', at - 0.4 + SKIP + 0.2)), now).length;
  check(`a frame that leaps ${(SKIP + 0.2).toFixed(1)} s over the mark fires nothing`, n === 0, `${n}`);
  run('gap', at - 0.5, at - 0.1);
  now += GAP + 0.5;
  const g = fxTrack('gap', fighter('gap', phaseAt('gap', at + 0.05)), now).length;
  check(`a body unseen for ${GAP + 0.5} s crossing the mark fires nothing`, g === 0, `${g}`);
}
{
  // A timed go of the fight a second and a half long, started three times: the mark once a go.
  let n = 0;
  for (let go = 0; go < 3; go++) for (let s = 0; s <= 1.5; s += DT) { now += DT; n += fxTrack('act', fighter('act', 0, 1, { t: s, length: 1.5 }), now).length; }
  const each = runsOf(c0.clip, 1.5).runs;
  check(`a timed go fitted to its length fires the mark once a run of it: 3 goes of ${each}, ${3 * each} fires`, n === 3 * each, `${n}`);
}
{
  let right: string | undefined, left: string | undefined, again: string | undefined, hand: string | undefined;
  for (const [facing, set] of [[1, (s: string) => (right = s)], [3, (s: string) => (left = s)]] as const) {
    const id = `side${facing}`;
    for (let t = at - 0.3; t <= at + 0.1; t += DT) {
      now += DT;
      for (const c of fxTrack(id, fighter(id, phaseAt(id, t), facing), now)) {
        const p = c.point();
        set(`${c.clip} ${c.mark.from && 'tool' in c.mark.from ? c.mark.from.side ?? 'r' : '?'} ${p ? p.at.map((v) => v.toFixed(2)).join(',') : 'none'}`);
        if (facing === 1) { again = JSON.stringify(c.point()) === JSON.stringify(p) ? 'same' : 'not'; hand = p?.held; }
      }
    }
  }
  check('played right-handed, from the right hand; left-handed (the mirrored clip), from the left', !!right && !!left && / r /.test(right) && /-left l /.test(left), `${right}; ${left}`);
  check('the point is on the weapon, and the same each time it is asked', hand === 'sword' && again === 'same', `${hand}, ${again}`);
}
finish('the effect marks on the clips, followed body by body');
