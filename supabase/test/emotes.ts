/**
 * The bow, the cheer, the point, the clap and sat on the ground (`src/game/emotes.ts`, the sculpted clips in
 * `src/sculpt/anim/clips/emotes2.ts`), with no browser:
 *
 *   * every emote plays a clip of its own on the sculpted bodies, never the placeholder; the point with the left arm from
 *     the facings that say so, the right from the rest;
 *   * the one-shot clips start and end stood as the idle stands, so they fade in from it and out to it;
 *   * the clap's hands meet at each clap and are apart between, on both bodies; the point's hand is out ahead;
 *   * an emote is drawn only while it runs (none after: the idle), and the sit is held at its end until the body moves,
 *     swims or works, on this body and on a peer's (`Roster`), and nothing else is ended by moving;
 *   * sat, the body is on the ground (`onTheGround`) and its loop runs on the island's clock;
 *   * with Animations Off the new emotes are shown at their still pose while they run, and the wave as before (stood).
 */
import { EMOTES, EMOTE_BY_ID, emoteAt, emoteLeft, emoteNow } from '../../src/game/emotes';
import { clipFor, PLACEHOLDER } from '../../src/sculpt/anim';
import { clipLocal } from '../../src/sculpt/anim/player';
import { onTheGround } from '../../src/sculpt/anim/down';
import { lowSkeleton } from '../../src/sculpt/lowpoly';
import { stillPose, type FigurePose } from '../../src/render/figure';
import { Roster } from '../../src/game/roster';
import type { PeerState } from '../../src/net/protocol';
import { check, finish } from './harness';

const NEW = ['bow', 'cheer', 'point', 'clap', 'sit'];
const look = (gender: 'man' | 'woman') => ({ gender, hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 }) as FigurePose['look'];
const pose = (emote: string, emoteT: number, o: Partial<FigurePose> = {}): FigurePose =>
  ({ id: `b-${emote}`, phase: 3, moving: false, facing: 0, swimming: false, working: false, look: look('man'), emote, emoteT, ...o });

for (const id of NEW) {
  check(`${id}: an emote`, EMOTE_BY_ID.has(id));
  for (let f = 0; f < 8; f++) {
    const c = clipFor(pose(id, 0.5, { facing: f }));
    const want = id === 'point' ? (f === 1 || f === 5 ? 'point-left' : 'point') : id;
    check(`${id} facing ${f}: its own clip`, c?.clip.name === want && c.clip.name !== PLACEHOLDER, c?.clip.name ?? 'none');
  }
}

// stood at both ends, as the idle stands
for (const id of ['bow', 'cheer', 'point', 'clap']) {
  const c = clipFor(pose(id, 0))!.clip;
  const a = c.tracks, end = c.length;
  let worst = 0;
  for (const keys of Object.values(a)) {
    const first = keys[0].v, last = keys[keys.length - 1].v;
    if (keys[0].t > 1e-6 || Math.abs(keys[keys.length - 1].t - end) > 1e-6) continue;
    worst = Math.max(worst, ...first.map((x, i) => Math.abs(x - last[i])));
  }
  check(`${id}: ends where it starts`, worst < 1e-6, `${worst}`);
  check(`${id}: one-shot over the emote's seconds`, !c.loop && Math.abs(c.length - EMOTE_BY_ID.get(id)!.seconds) < 1e-9);
}

// the clap's hands meet, on both bodies
for (const body of ['man', 'woman'] as const) {
  const sk = lowSkeleton(body), c = clipFor(pose('clap', 0, { look: look(body) }), body)!.clip;
  const gap = (t: number): number => {
    const r = clipLocal(sk, c, t), F = sk.fk(r.local, r.move);
    const w = (n: string): number[] => F[sk.at.get(n) as number].P;
    const l = w('hand_l'), rr = w('hand_r'), fl = w('fingers_02_l'), fr = w('fingers_02_r');
    return Math.min(Math.hypot(l[0] - rr[0], l[1] - rr[1], l[2] - rr[2]), Math.hypot(fl[0] - fr[0], fl[1] - fr[1], fl[2] - fr[2])) / sk.height;
  };
  const claps = (c.poses ?? []).filter((p) => p.name === 'clap').map((p) => p.t), aparts = (c.poses ?? []).filter((p) => p.name === 'apart').map((p) => p.t);
  check(`${body}: four claps`, claps.length === 4, `${claps.length}`);
  const met = Math.max(...claps.map(gap)), open = Math.min(...aparts.map(gap));
  // the palms a hand's thickness from each other at a clap: the hands' middles within 5% of the height; apart, past 12%
  check(`${body}: the hands meet at every clap`, met < 0.05, met.toFixed(3));
  check(`${body}: and are apart between`, open > 0.12, open.toFixed(3));
  // the point's hand out ahead of the chest (the arm a third of the way out to the side, so seen from in front)
  const p = clipFor(pose('point', 0.4, { look: look(body) }), body)!;
  const r = clipLocal(sk, p.clip, p.t), F = sk.fk(r.local, r.move), hand = F[sk.at.get('hand_r') as number].P, chest = F[sk.at.get('spine_03') as number].P;
  check(`${body}: the point's hand ahead`, (hand[2] - chest[2]) / sk.height > 0.09, ((hand[2] - chest[2]) / sk.height).toFixed(3));
}

// drawn only while it runs
check('a bow over: not drawn', Object.keys(emoteNow('bow', 10, 10 + 2.3)).length === 0);
check('a bow half way: drawn', Math.abs((emoteNow('bow', 10, 11.1).emoteT ?? -1) - 0.5) < 1e-9);
check('the sit held at its end', emoteAt('sit', 10, 100) === 1 && emoteNow('sit', 10, 100).emote === 'sit');
check('ended by moving: the sit only', NEW.concat(['wave', 'hop', '67']).every((id) => emoteLeft(id, true) === !!EMOTE_BY_ID.get(id)?.held) && !emoteLeft('sit', false));
check('only the sit is held', EMOTES.filter((e) => e.held).map((e) => e.id).join() === 'sit');

// a peer sat: kept while they stand there, ended when they walk off
const roster = new Roster();
const peer = (o: Partial<PeerState> = {}): PeerState => ({ id: 7, x: 5.5, y: 5.5, dirX: 0, dirY: 1, level: 0, moving: false, swimming: false, working: false, ...o } as PeerState);
roster.saw(peer());
roster.emoted(7, 'sit');
roster.ease(1 / 30);
check('a peer sat: kept stood still', roster.get(7)?.emote === 'sit');
roster.saw(peer({ x: 6.5, moving: true }));
roster.ease(1 / 30);
check('a peer sat: ended when they walk off', roster.get(7)?.emote === undefined);
roster.emoted(7, 'bow');
roster.ease(1 / 30);
check('a peer bowing on the move: kept', roster.get(7)?.emote === 'bow');

// sat: on the ground, its loop on the island's clock
const s1 = clipFor(pose('sit', 1, { phase: 6 })), s2 = clipFor(pose('sit', 1, { phase: 18 }));
check('sat: its own loop', s1?.clip.name === 'sit' && s1.clip.loop);
check('sat: on the island\'s clock', !!s1 && !!s2 && Math.abs(s2.t - s1.t) > 1e-3, `${s1?.t} ${s2?.t}`);
check('sat: on the ground', onTheGround('nobody', 'sit'));

// Animations Off
for (const id of NEW) {
  const st = stillPose(pose(id, 0.3));
  check(`${id}: still pose with animations off`, st.emote === id && st.emoteT === EMOTE_BY_ID.get(id)!.still);
}
check('wave: stood with animations off, as before', stillPose(pose('wave', 0.3)).emote === undefined);
check('a bow over: nothing kept with animations off', stillPose({ ...pose('bow', 0), emoteT: undefined }).emote === undefined);

finish('Emotes: bow, cheer, point, clap and sit');
