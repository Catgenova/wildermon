/**
 * Casting a spell on the sculpted body (`src/sculpt/anim/clips/cast.ts`, routed by `src/sculpt/anim` clipFor), with no
 * browser:
 *
 *   * every spell there is, cast stood by a man and a woman from each of the eight facings with what it is cast with in
 *     hand, plays a casting clip or the fight's own clip for its weapon, never the placeholder;
 *   * each casting clip starts and ends with the arms hanging as the idle's, and its release (`releaseOf`) falls on the
 *     spell's own (`castTime` at `CastTiming.release`);
 *   * run through a cast in frames (`fxTrack`), the release mark fires once, on the frame the cast passes the spell's
 *     release, from the hand that sends it (the right, or the left from the facings it is played mirrored from);
 *   * walking, a spell cast with the hands is laid over the walk; one cast with a weapon is not;
 *   * a throw, a blow and a shot draw the weapon in hand (`toolsIn`, `heldIn`);
 *   * with Animations off, the still pose drops the cast (`stillPose`): the idle, nothing played over it.
 */
import { CLIPS, clipFor, castClipOf, heldIn, toolsIn, PLACEHOLDER } from '../../src/sculpt/anim';
import { fxTrack } from '../../src/sculpt/fxmarks';
import { CAST_CLIPS, castTime, releaseOf } from '../../src/sculpt/anim/clips/cast';
import { sampleClip } from '../../src/sculpt/anim/clip';
import { ALL_SPELL_IDS, spellInfo, visualOf } from '../../src/render/spells/index';
import { stillPose, type FigurePose, type GearLook } from '../../src/render/figure';
import { check, finish } from './harness';

const lookOf = (gender: 'man' | 'woman') => ({ gender, hair: 'swept', hairColour: 0.3, hairBright: 0.5, skin: 0.4 }) as FigurePose['look'];
/** What a spell is cast with in hand, as the spells' preview gives it (`src/render/spells/preview.ts` gearFor). */
function gearFor(id: string): GearLook {
  const info = spellInfo(id);
  const by: Record<string, string> = { archery: 'short_bow', throwing: 'javelin', skirmish: 'javelin', knives: 'hunting_knife', axes: 'battle_axe', mauls: 'maul', shield: 'sword' };
  const group: Record<string, string> = { blade: 'sword', berserker: 'battle_axe', pikeman: 'spear', archer: 'short_bow', skirmisher: 'javelin', chirurgeon: 'hunting_knife' };
  const w = (info?.needs ? by[info.needs] : undefined) ?? (info ? group[info.group] : undefined);
  return w ? { weapon: { id: w, material: 'iron' } } : {};
}
const caster = (id: string, spell: string, t: number, o: { facing?: number; gender?: 'man' | 'woman'; moving?: boolean; phase?: number; at?: string } = {}): FigurePose => ({
  id, phase: o.phase ?? 0, moving: !!o.moving, gait: 0, facing: o.facing ?? 1, swimming: false, working: false, look: lookOf(o.gender ?? 'man'), gear: gearFor(spell),
  cast: { id: spell, t, ...(o.at ? { at: o.at } : {}) } as FigurePose['cast'],
});
const WEAPON_CLIPS = new Set(['fight', 'fight-left', 'swing', 'shoot']);

{
  const bad: string[] = [], seen = new Set<string>();
  for (const spell of ALL_SPELL_IDS) for (const gender of ['man', 'woman'] as const) for (let facing = 0; facing < 8; facing++) {
    const c = clipFor(caster('all', spell, 0.3, { facing, gender }));
    const name = c?.clip.name ?? 'none';
    seen.add(name.replace(/-left$/, ''));
    if (!c || name === PLACEHOLDER || !(name in CAST_CLIPS || WEAPON_CLIPS.has(name))) bad.push(`${spell} ${gender} f${facing}: ${name}`);
  }
  check(`every spell (${ALL_SPELL_IDS.length}) cast stood plays a casting clip or its weapon's fight clip, never the placeholder`, bad.length === 0, bad.slice(0, 6).join('; '));
  const own = Object.keys(CAST_CLIPS).filter((n) => !n.endsWith('-left'));
  check(`every casting clip is played by some spell (${own.length})`, own.every((n) => seen.has(n)), own.filter((n) => !seen.has(n)).join(', '));
}
{
  const bad: string[] = [];
  const rest = sampleClip(CLIPS.idle, 0).rot;
  for (const [name, clip] of Object.entries(CAST_CLIPS)) {
    for (const t of [0, clip.length]) {
      const r = sampleClip(clip, t).rot;
      for (const b of ['spine_03', 'head', 'pelvis']) if (Math.hypot(...(r[b] ?? [0, 0, 0])) > 1e-6) bad.push(`${name} ${b} at ${t}`);
      for (const s of ['l', 'r'] as const) { const y = clip.hands?.[s]?.at.find((k) => k.t === t)?.v[1] ?? 0; if (y > 0.5) bad.push(`${name} hand ${s} at ${t}: ${y}`); }
    }
    if (!clip.fx?.some((m) => m.kind === 'cast')) bad.push(`${name}: no release mark`);
  }
  check('each casting clip starts and ends stood, the arms hanging, and carries its release mark', bad.length === 0 && !!rest, bad.slice(0, 6).join('; '));
}
{
  const bad: string[] = [];
  for (const spell of ALL_SPELL_IDS) {
    const name = castClipOf(caster('rel', spell, 0.3)), clip = CLIPS[name], r = visualOf(spell)?.cast.timing.release ?? 0.5;
    if (!clip) continue;
    const at = castTime(clip, r, r);
    if (Math.abs(at - releaseOf(clip)) > 1e-9) bad.push(`${spell}: ${name} ${at} not ${releaseOf(clip)}`);
    if (castTime(clip, 0, r) !== 0 || Math.abs(castTime(clip, 1, r) - clip.length) > 1e-9) bad.push(`${spell}: ends`);
  }
  check('the clip\'s release falls on each spell\'s own; the cast\'s start and end on the clip\'s', bad.length === 0, bad.slice(0, 6).join('; '));
}
{
  // Each kind's spell run through in frames of a sixtieth of its cast: the release mark once, on the frame that passes the
  // spell's release, from the right hand (facing 1) or the left (facing 6, mirrored).
  const spells = ['ember', 'chaos_hex', 'aegis', 'blessing_soothe', 'pyre', 'blessing_benediction', 'beastmaster_sic', 'knowledge_seek', 'skirmisher_snap_throw'];
  const bad: string[] = [];
  let now = 1000;
  for (const spell of spells) for (const facing of [1, 6]) {
    const v = visualOf(spell);
    if (!v) { bad.push(`${spell}: no visual`); continue; }
    const secs = v.cast.timing.secs, r = v.cast.timing.release, dt = secs / 60, id = `${spell}${facing}`;
    const fired: Array<{ t: number; side: string; clip: string }> = [];
    for (let e = 0; e <= secs + 1e-9; e += dt) {
      now += dt;
      for (const c of fxTrack(id, caster(id, spell, e / secs, { facing }), now)) if (c.mark.kind === 'cast') fired.push({ t: e / secs, side: 'bone' in c.mark.from ? c.mark.from.bone : '?', clip: c.clip });
    }
    const hand = facing === 1 ? 'hand_r' : 'hand_l';
    if (!fired.length || !fired.some((f) => f.side === hand)) bad.push(`${spell} f${facing}: ${JSON.stringify(fired)}`);
    else if (fired.some((f) => f.t < r - 1e-9 || f.t > r + 1 / 60 + 1e-9)) bad.push(`${spell} f${facing}: fired at ${fired.map((f) => f.t.toFixed(3)).join(',')} not ${r}`);
    else if (new Set(fired.map((f) => f.side)).size !== fired.length) bad.push(`${spell} f${facing}: twice from one hand`);
  }
  check('run through a cast, the release fires once from each sending hand, on the frame the spell is let go, the right hand (the left mirrored)', bad.length === 0, bad.slice(0, 4).join('; '));
}
{
  const walk = clipFor(caster('w', 'ember', 0.4, { moving: true, phase: 1 }));
  check('walking, a spell cast with the hands is laid over the walk', walk?.clip.name === 'walk' && walk.over?.clip.name === 'cast-bolt', `${walk?.clip.name} + ${walk?.over?.clip.name}`);
  const armed = clipFor(caster('w2', 'blade_lunge', 0.4, { moving: true, phase: 1 }));
  check('walking, a blow with the weapon keeps the figure\'s pose (no stood clip slid over the ground)', !armed, armed?.clip.name);
}
{
  const thrown = toolsIn(caster('t', 'skirmisher_snap_throw', 0.3));
  check('a throw holds the javelin in the right fist', thrown?.tools.r === 'javelin', JSON.stringify(thrown));
  const blow = clipFor(caster('b', 'blade_lunge', 0.3)), cut = toolsIn(caster('b', 'blade_lunge', 0.3));
  check('a blow with a sword plays the one-handed fight, the sword in hand', blow?.clip.name === 'fight' && cut?.tools.r === 'sword', `${blow?.clip.name} ${JSON.stringify(cut)}`);
  const shot = clipFor(caster('s', 'archer_quick_shot', 0.3));
  check('a shot plays the bow\'s, the bow in hand', shot?.clip.name === 'shoot' && heldIn(caster('s', 'archer_quick_shot', 0.3)) === 'short_bow', `${shot?.clip.name}`);
  const smash = clipFor(caster('m', 'berserker_overhead_smash', 0.3));
  check('a blow with a two-handed axe plays the overhead swing, the axe in both hands', smash?.clip.name === 'swing' && heldIn(caster('m', 'berserker_overhead_smash', 0.3)) === 'battle_axe', `${smash?.clip.name}`);
  const self = clipFor(caster('a', 'blessing_soothe', 0.3, { at: 'self' }));
  check('a spell on somebody cast on oneself plays the ward\'s', self?.clip.name === 'cast-ward', self?.clip.name);
}
{
  const still = clipFor(stillPose(caster('o', 'ember', 0.5)));
  check('with Animations off, the still pose is stood idle, no cast over it', still?.clip.name === 'idle', still?.clip.name);
}
finish('casting a spell on the sculpted body');
