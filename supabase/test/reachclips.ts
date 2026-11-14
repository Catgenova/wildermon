/**
 * The clips of reaching up to pick, reading what is held and the lanterns (`src/sculpt/anim/clips/reach.ts`), on both
 * bodies, in node with no browser: each clip sampled over its run on the skeleton the game draws with (`clipLocal`, the
 * procedural layer's reach and planted feet included).
 *
 *   * each of the fourteen jobs plays its clip, not the placeholder, from every facing: the right-handed clip, or its
 *     mirror from the facings the flat figure works left-handed from (three and seven);
 *   * every prop a clip holds is one the bodies hold (a hand tool of `lowpoly.ts`);
 *   * the feet stay where the clip stands them: neither ankle (nor, up on the toes, the ball of either foot) moves over
 *     the run by more than `SLIDE`;
 *   * the other hand on a held thing (the page's edge, the tablet's runes, the sheet's and the map's far edge) is where
 *     the clip puts it on that thing, within `ON`, throughout;
 *   * no reached hand goes behind the chest's front: every grip under the shoulders (`SHOULDERS`) at least `AHEAD`
 *     forward of the feet's line;
 *   * the lantern clips reach his hands up within `UNDER` of the foot of a lantern on a post (`LAMP_HANG.arm`, less the
 *     lantern's half height and its plate: `src/render/kit/lamps.ts` lantern, its size `LAMP_GLASS`), and the reach for
 *     fruit gets his fist up level with the crown of his head (`CROWN` of his height, his sole to his crown).
 */
import { CLIPS, clipFor, PLACEHOLDER, workClipOf } from '../../src/sculpt/anim';
import { clipLocal, plantAt } from '../../src/sculpt/anim/player';
import { secondAt, type Side } from '../../src/sculpt/anim/clip';
import { lowSkeleton, lowToolHeld } from '../../src/sculpt/lowpoly';
import { LAMP_GLASS, LAMP_HANG } from '../../src/game/lamps';
import type { FigurePose } from '../../src/render/figure';
import type { V } from '../../src/sculpt/anim/math';
import MALE from '../../src/sculpt/assets/lowmale.json';
import FEMALE from '../../src/sculpt/assets/lowfemale.json';
import { check, finish } from './harness';

/** The jobs and the clip each plays. */
const JOBS: Record<string, string> = {
  pick_fruit: 'pick-high', pick_sprout: 'pick-high', pick_grapes: 'pick-grapes', take_honey: 'take-honey',
  study_book: 'read-book', read_rune_tablet: 'read-tablet', read_recipe: 'read-sheet', read_formula: 'read-sheet', study_map: 'read-map',
  fit_lamp: 'lamp-fit', take_lamp: 'lamp-take', candle_lamp: 'lamp-candle', light_lamp: 'lamp-light', douse_lamp: 'lamp-douse',
};
/** Body heights: the most a planted foot slides over a run, a hand misses its place on a held thing, and a grip's least forward. */
const SLIDE = 0.004, ON = 0.02, AHEAD = 0.05;
/** Body heights over the ground under which a hand is before the chest (over it, a hand reached up overhead). */
const SHOULDERS = 0.75;
/** Body heights the man's hands may stop under a post's lantern's foot at the top of their reach. */
const UNDER = 0.05;
/** The share of his height his fist reaches to for fruit, at the least. */
const CROWN = 0.97;
/** Moments sampled over a run of each clip. */
const SAMPLES = 32;

const look = { gender: 'man', hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 } as FigurePose['look'];
const working = (job: string, facing: number): FigurePose => ({ id: undefined, phase: 0, moving: false, facing, swimming: false, working: true, job, look, act: { t: 0.3, length: 4 } } as FigurePose);

// the routes, from every facing
for (const [job, name] of Object.entries(JOBS)) {
  check(`${job} plays ${name}`, workClipOf(job) === name && workClipOf(job) !== PLACEHOLDER && !!CLIPS[name], workClipOf(job));
  const by = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => clipFor(working(job, f))?.clip.name);
  const want = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => (f === 3 || f === 7 ? `${name}-left` : name));
  check(`${job}: right-handed from facings 0-2 and 4-6, its mirror from 3 and 7`, by.join() === want.join(), by.join());
}

const clips = [...new Set(Object.values(JOBS))].flatMap((n) => [CLIPS[n], CLIPS[`${n}-left`]]);
const FLOOR = { man: (MALE as { floor: number }).floor, woman: (FEMALE as { floor: number }).floor };
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V): number => Math.hypot(a[0], a[1], a[2]);
const mv = (R: number[], v: V): V => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];

/** The lantern's foot on a post over the ground, game units: its middle less half its glass (3.4 high) and its plate (0.4). */
const LANTERN_FOOT = LAMP_HANG.arm - (3.4 / 2 + 0.4) * LAMP_GLASS;
const top: Record<string, number> = {};

for (const body of ['man', 'woman'] as const) {
  const sk = lowSkeleton(body), H = sk.height, tools = (id: string) => lowToolHeld(body, id);
  for (const c of clips) {
    for (const [s, id] of Object.entries(c.tools ?? {}) as Array<[Side, string]>) check(`${body} ${c.name}: holds ${id} in the ${s === 'l' ? 'left' : 'right'} fist`, !!tools(id));
    let slide = 0, off = 0, behind = Infinity, high = -Infinity;
    const feet0: V[] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (k / SAMPLES) * c.length;
      const r = clipLocal(sk, c, t, undefined, tools), F = sk.fk(r.local, r.move);
      // the ground under the planted feet (the frame the hands are reached in, `Skeleton.finish`)
      const plant = plantAt(sk, c, t), up = plant ? Math.min(...(['foot_l', 'foot_r'].map((b, s) => plant.at[s][1] - sk.bones[sk.at.get(b) as number].head[1]))) : 0;
      const ground = FLOOR[body] + up;
      // the feet: the ankles, and up on the toes the balls of the feet
      const toes = !!c.feet;
      const pts = (toes ? ['ball_l', 'ball_r'] : ['foot_l', 'foot_r']).map((b) => F[sk.at.get(b) as number].P);
      pts.forEach((p, i) => { if (!feet0[i]) feet0[i] = p; slide = Math.max(slide, len(sub(p, feet0[i])) / H); });
      // the hands reached ahead of the chest
      const held: Partial<Record<Side, ReturnType<typeof tools>>> = Object.fromEntries(Object.entries(c.tools ?? {}).map(([s, id]) => [s, tools(id as string)]));
      for (const s of Object.keys(c.hands ?? {}) as Side[]) {
        const g = sk.gripOf(F, held[s])[s === 'l' ? 0 : 1];
        const y = (g.at[1] - ground) / H;
        if (y < SHOULDERS) behind = Math.min(behind, g.at[2] / H);
        high = Math.max(high, y);
      }
      // the other hand on the held thing
      const two = secondAt(c, t, body);
      if (two) {
        const inHand = held[two.side === 'l' ? 'r' : 'l'];
        if (inHand) {
          const g = sk.gripOf(F, inHand)[two.side === 'l' ? 1 : 0];
          const want = g.at.map((x, i) => x + mv(g.R as number[], [(two.at[0] - 0) / inHand.scale, (two.at[1] - inHand.lead) / inHand.scale, two.at[2] / inHand.scale])[i]) as V;
          const got = sk.gripOf(F)[two.side === 'l' ? 0 : 1].at;
          off = Math.max(off, len(sub(got, want)) / H);
          if ((got[1] - ground) / H < SHOULDERS) behind = Math.min(behind, got[2] / H);
        }
      }
    }
    check(`${body} ${c.name}: the feet stay put (slide ${slide.toFixed(4)} ≤ ${SLIDE})`, slide <= SLIDE);
    if (c.second) check(`${body} ${c.name}: the other hand on what is held (off by ${off.toFixed(4)} ≤ ${ON})`, off <= ON);
    check(`${body} ${c.name}: the hands ahead of the chest (${behind.toFixed(3)} ≥ ${AHEAD})`, behind >= AHEAD);
    top[`${body} ${c.name}`] = high;
  }
}
// how high the man reaches: to the lantern's foot on a post, and over his crown for fruit
const manTall = lowSkeleton('man').height / lowSkeleton('man').perGame;
for (const n of ['lamp-fit', 'lamp-take', 'lamp-candle', 'lamp-light', 'lamp-douse']) {
  const h = top[`man ${n}`], foot = LANTERN_FOOT / manTall;
  check(`man ${n}: the hands up to the lantern's foot on a post (${h.toFixed(3)} of ${foot.toFixed(3)} body heights, within ${UNDER})`, h >= foot - UNDER, `${h}`);
}
check(`man pick-high: the fist up level with the crown (${top['man pick-high'].toFixed(3)} ≥ ${CROWN} body heights)`, top['man pick-high'] >= CROWN);
finish('reach clips: picking, reading, the lanterns');
