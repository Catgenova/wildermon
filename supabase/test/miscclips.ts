/**
 * The gates', the carts' and a few jobs' own clips (`src/sculpt/anim/clips/misc.ts`), with no browser:
 *
 *   * each job plays its clip, never the placeholder: the winch turned raising a portcullis or a drawbridge and turned
 *     back letting either down, the key turned in a padlock, a cart's shafts taken up, climbed aboard (the reins, the
 *     helm, a passenger's place), the team's tack undone, the bell's rope pulled, the stake driven in founding and
 *     upgrading a settlement, a bauble set in the altar, a statue enchanted;
 *   * from every facing, on both bodies; the one-handed clips (the key, the bauble) played mirrored from the facings
 *     the flat figure works left-handed from, the rest as they are;
 *   * the hands put where the clip puts them: both fists on the winch's handle, the lock and its key, the bell's rope,
 *     the stake and the shafts, both palms out, their distance apart as placed (the arms not stretched short of it)
 *     through every run;
 *   * a go fitted to the job's length: a timed one-shot (the shafts, the step up) played once to its end, a loop as many
 *     runs as come nearest;
 *   * with Animations Off, the still pose: none of these clips.
 */
import { CLIPS, PLACEHOLDER, clipFor, workClipOf } from '../../src/sculpt/anim';
import { clipLocal } from '../../src/sculpt/anim/player';
import { handsAt } from '../../src/sculpt/anim/clip';
import { lowSkeleton } from '../../src/sculpt/lowpoly';
import { ACTION_BY_ID } from '../../src/game/actions';
import { stillPose, type FigurePose } from '../../src/render/figure';
import { check, finish } from './harness';

const ROUTES: Record<string, string> = {
  raise_portcullis: 'crank', raise_drawbridge: 'crank', lower_portcullis: 'crank-back', lower_drawbridge: 'crank-back',
  take_off_lock: 'key', pull_cart: 'cart', board_vehicle: 'board', board_passenger: 'board', unhitch_team: 'tack',
  ring_bell: 'bell', found_settlement: 'totem', upgrade_deed: 'totem', set_bauble: 'bauble', enchant_statue: 'enchant',
};
/** The clips played mirrored from facings three and seven. */
const ONE_HANDED = new Set(['key', 'bauble', 'tack']);

const look = (gender: 'man' | 'woman') => ({ gender, hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 }) as FigurePose['look'];
const at = (job: string, facing: number, gender: 'man' | 'woman', act?: FigurePose['act']): FigurePose => ({
  id: `${job}-${facing}-${gender}`, phase: 3, moving: false, facing, swimming: false, working: true, job, look: look(gender), ...(act ? { act } : {}),
});

for (const [job, clip] of Object.entries(ROUTES)) {
  check(`${job}: an action of the game`, ACTION_BY_ID.has(job));
  check(`${job} plays ${clip}, not the placeholder`, workClipOf(job) === clip && !!CLIPS[clip] && clip !== PLACEHOLDER, `${workClipOf(job)}`);
  const wrong: string[] = [];
  for (const gender of ['man', 'woman'] as const) for (let facing = 0; facing < 8; facing++) {
    const want = ONE_HANDED.has(clip) && (facing === 3 || facing === 7) ? `${clip}-left` : clip, got = clipFor(at(job, facing, gender), gender)?.clip.name;
    if (got !== want) wrong.push(`${gender} f${facing}: ${got} (want ${want})`);
  }
  check(`${job}: ${clip} from every facing on both bodies, mirrored where worked left-handed`, wrong.length === 0, wrong.join('; '));
  const still = clipFor(stillPose(at(job, 1, 'man')), 'man')?.clip.name;
  check(`${job} with Animations Off: the still pose (the idle), not ${clip}`, still === 'idle', `${still}`);
}

/** The two-handed clips whose fists are put on one thing: their distance apart, as placed, kept to within this, body heights. */
const APART = 0.02;
for (const name of ['crank', 'crank-back', 'key', 'cart', 'board', 'bell', 'totem', 'enchant']) {
  const c = CLIPS[name];
  for (const body of ['man', 'woman'] as const) {
    const sk = lowSkeleton(body);
    let worst = 0, when = 0;
    for (let k = 0; k <= 24; k++) {
      const t = (k / 24) * c.length, want = handsAt(c, t, body), r = clipLocal(sk, c, t);
      if (!want?.l || !want.r) continue;
      const g = sk.gripOf(sk.fk(r.local, r.move)), got = g[0].at.map((v, i) => (v - g[1].at[i]) / sk.height), placed = want.l.at.map((v, i) => v - (want.r?.at[i] ?? 0));
      const d = Math.hypot(...got.map((v, i) => v - placed[i]));
      if (d > worst) { worst = d; when = t; }
    }
    check(`${name}, ${body}: both hands where the clip puts them, apart as placed (within ${APART} body heights)`, worst <= APART, `${worst.toFixed(3)} at ${when.toFixed(2)} s`);
  }
}

// a go fitted to its job's length: the shafts taken up once (1.5 s), the stake driven in once every two seconds (4 s, 8 s), the winch turned seven times in 10 s
{
  const goes: Array<[string, number, number]> = [['pull_cart', 1.5, 1], ['board_vehicle', 1.5, 1], ['found_settlement', 4, 2], ['upgrade_deed', 8, 4], ['raise_drawbridge', 10, 7]];
  for (const [job, length, runs] of goes) {
    const c = clipFor(at(job, 1, 'man', { t: length * 0.999, length }), 'man');
    const ran = c ? c.t / c.clip.length : 0;
    check(`${job}, a go of ${length} s: ${runs} run${runs === 1 ? '' : 's'} of ${c?.clip.name}, played to its end`, !!c && Math.abs(ran - runs) < 0.01, `${ran.toFixed(3)} runs`);
  }
}
finish('the gates, the carts and a few jobs of their own play their clips');
