/**
 * The clips of lifting, setting down, taking apart, bridges and aqueducts on the sculpted bodies
 * (`src/sculpt/anim/clips/build.ts`), with no browser, on the game's own skeleton and player:
 *
 *   * each of the jobs plays its own clip, not the placeholder, from every facing, on both bodies; the handed clips their
 *     mirror from the facings worked left-handed from (three and seven), the two-handed lifts as they are;
 *   * the heavy pieces (a smelter, a kiln, an anvil) lift and set down slower and deeper than a light one;
 *   * every reached hand gets to its place (the arm never short of it) through a run, both bodies, both hands;
 *   * the feet stay where they stand through a run (no sliding);
 *   * the leant-out strike (bridges and aqueducts) brings the mallet's face down onto the chisel's top;
 *   * the lifts and set-downs are one a go; the hammer's clips carry their blow;
 *   * Animations Off: the still pose is stood, at none of these clips.
 */
import { CLIPS, clipFor, PLACEHOLDER, workClipOf } from '../../src/sculpt/anim';
import { handsAt, type Clip } from '../../src/sculpt/anim/clip';
import { clipLocal } from '../../src/sculpt/anim/player';
import { lowSkeleton, lowToolHeld } from '../../src/sculpt/lowpoly';
import { IMPACT } from '../../src/sculpt/anim/clips/work';
import { stillPose, type FigurePose } from '../../src/render/figure';
import MALE from '../../src/sculpt/assets/lowmale.json';
import FEMALE from '../../src/sculpt/assets/lowfemale.json';
import MALLET from '../../src/sculpt/assets/mallet.json';
import CHISEL from '../../src/sculpt/assets/chisel.json';
import { check, finish } from './harness';

/** The jobs and the clip each plays. */
const JOBS: Record<string, string> = {
  pick_up_furniture: 'lift', pick_up_crate: 'lift', pick_up_post: 'lift',
  pick_up_smelter: 'lift-heavy', pick_up_kiln: 'lift-heavy', pick_up_anvil: 'lift-heavy',
  place_furniture: 'set-down', place_crate: 'set-down', place_post: 'set-down', set_aqueduct_mote: 'set-down',
  place_smelter: 'set-down-heavy', place_kiln: 'set-down-heavy', place_anvil: 'set-down-heavy',
  turn_furniture: 'turn', remove_wall: 'pry', remove_column: 'pry', remove_storey: 'pry', demolish_bridge: 'pry', demolish_aqueduct: 'pry',
  remove_floor: 'pry-low', strip_wall_paint: 'scrape', mark_out: 'mark', no_plan: 'mark', remove_from_plan: 'pull-stake',
  plan_bridge: 'work-out', build_bridge: 'work-out', plan_aqueduct: 'work-out', build_aqueduct: 'work-out',
};
/** The clips played as they are from every facing: both hands alike. */
const BOTH_HANDS = new Set(['lift', 'lift-heavy', 'set-down', 'set-down-heavy']);
const BODIES = ['man', 'woman'] as const;
/** Centimetres of a 1.8 m man: how far a reached hand may be from its place, a planted foot may slide, the mallet's face from the chisel. */
const REACH_CM = 2.5, SLIDE_CM = 1, FACE_CM = 3;

const pose = (job: string, facing: number, gender: 'man' | 'woman', t = 0.3): FigurePose => ({
  id: undefined, phase: 0, moving: false, facing, swimming: false, working: true, job, act: { t, length: 4 },
  look: { gender, hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 } as FigurePose['look'],
});

for (const [job, want] of Object.entries(JOBS)) {
  check(`${job} plays ${want}`, workClipOf(job) === want && !!CLIPS[want] && want !== PLACEHOLDER, workClipOf(job));
  const wrong: string[] = [];
  for (const gender of BODIES) for (let f = 0; f < 8; f++) {
    const name = clipFor(pose(job, f, gender), gender)?.clip.name, left = !BOTH_HANDS.has(want) && (f === 3 || f === 7);
    if (name !== (left ? `${want}-left` : want)) wrong.push(`${gender} f${f}: ${name}`);
  }
  check(`${job}: its clip from every facing on both bodies, the mirror from three and seven where handed`, !wrong.length, wrong.join(', '));
}
{
  const c = (n: string): Clip => CLIPS[n];
  const deep = (n: string): number => Math.min(...(c(n).move ?? []).map((k) => k.v[1]));
  check('the heavy lift is slower and deeper than the light', c('lift-heavy').length > c('lift').length && deep('lift-heavy') < deep('lift'), `${c('lift-heavy').length} s against ${c('lift').length} s`);
  check('the heavy set-down is slower and deeper than the light', c('set-down-heavy').length > c('set-down').length && deep('set-down-heavy') < deep('set-down'));
  check('lifts and set-downs and the marks are one a go', ['lift', 'lift-heavy', 'set-down', 'set-down-heavy', 'mark', 'pull-stake'].every((n) => c(n).oneAGo));
  check('the pry carries its blow, a hammer in hand', ['pry', 'pry-low'].every((n) => c(n).tools?.r === 'hammer' && c(n).events?.some((e) => e.name === 'impact')));
}

/** Every reached hand at its place, and the feet still, through a run of each clip and its mirror, both bodies. */
const sub = (a: number[], b: number[]): number[] => a.map((x, i) => x - b[i]);
const len = (a: number[]): number => Math.hypot(...a);
const names = [...new Set(Object.values(JOBS))].flatMap((n) => (BOTH_HANDS.has(n) || n === 'work-out' ? [n] : [n, `${n}-left`]));
for (const body of BODIES) {
  const sk = lowSkeleton(body), floor = (body === 'man' ? MALE : FEMALE).floor as number, cm = 180 / sk.height;
  const tools = (id: string) => lowToolHeld(body, id);
  for (const n of names) {
    const c = CLIPS[n];
    let worst = 0, at = '', slide = 0;
    const feet: Record<string, number[]> = {};
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * c.length, r = clipLocal(sk, c, t, undefined, tools, { ids: c.tools }), F = sk.fk(r.local, r.move);
      const want = handsAt(c, t, body) ?? {}, held = { l: c.tools?.l ? tools(c.tools.l) : undefined, r: c.tools?.r ? tools(c.tools.r) : undefined };
      for (const s of ['l', 'r'] as const) {
        const h = want[s];
        if (!h) continue;
        const g = sk.gripOf(F, held[s])[s === 'l' ? 0 : 1].at, p = [h.at[0] * sk.height, floor + h.at[1] * sk.height, h.at[2] * sk.height];
        const d = len(sub(g, p)) * cm;
        if (d > worst) { worst = d; at = `${s} at ${t.toFixed(2)} s`; }
      }
      for (const b of ['foot_l', 'foot_r']) {
        const P = F[sk.at.get(b) as number].P;
        if (!feet[b]) feet[b] = P; else slide = Math.max(slide, len(sub(P, feet[b])) * cm);
      }
    }
    check(`${body} ${n}: every reached hand at its place (within ${REACH_CM} cm)`, worst <= REACH_CM, `${worst.toFixed(1)} cm, ${at}`);
    check(`${body} ${n}: the feet still (within ${SLIDE_CM} cm)`, slide <= SLIDE_CM, `${slide.toFixed(2)} cm`);
  }
  // the leant-out strike's blow onto the chisel's top
  {
    const c = CLIPS['work-out'], r = clipLocal(sk, c, IMPACT, undefined, tools, { ids: c.tools }), F = sk.fk(r.local, r.move);
    const mal = tools('mallet'), chi = tools('chisel');
    if (mal && chi) {
      const gr = sk.gripOf(F, mal)[1], gl = sk.gripOf(F, chi)[0];
      const mv = (m: number[], v: number[]): number[] => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
      const top = gl.at.map((x, i) => x + mv(gl.R, sub(CHISEL.contact, CHISEL.grip.lead).map((y) => y / chi.scale))[i]);
      const face = gr.at.map((x, i) => x + mv(gr.R, sub(MALLET.contact, MALLET.grip.lead).map((y) => y / mal.scale))[i]);
      const d = len(sub(face, top)) * cm;
      check(`${body} work-out: the mallet's face on the chisel's top at the blow (within ${FACE_CM} cm)`, d <= FACE_CM, `${d.toFixed(1)} cm`);
    } else check(`${body} work-out: the mallet and the chisel are held`, false);
  }
}
{
  const moving = Object.keys(JOBS).filter((job) => { const p = stillPose(pose(job, 1, 'man')); return p.job !== undefined || p.act !== undefined || clipFor(p, 'man')?.clip.name !== 'idle'; });
  check('Animations Off: the still pose at each of these jobs is stood, the idle', !moving.length, moving.join(', '));
}

finish('Lifting, taking apart, bridges and aqueducts on the sculpted bodies');
