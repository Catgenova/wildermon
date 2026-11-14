/**
 * Where a spell's effects find a caster's hands, chest and head while the sculpted body plays a casting clip
 * (`../../sculpt/anim/clips/cast.ts`, its clips named `cast-...`): on the sculpted body as the clip has it
 * (`../figure.ts` sculptFx, `../../sculpt/fxmarks.ts` fxPoint), not on the flat figure's cast pose, which is not what is
 * drawn. In the flat figure's frame and units (`figureJoint`): x the body's right, y ahead, z up from its feet. Nothing
 * where the flat figure is drawn, where the body plays no casting clip, or for a point the clip does not answer for (a
 * weapon's: those of a blow, a thrust or a shot, played on the fight's own clips): the flat figure's then.
 */
import { flatFigures, sculptedReady, sculptFx, type FigurePose } from '../figure';

type V3 = [number, number, number];
/** The flat figure's joints by the sculpted bones each is found at, the right side's (1) and the left's (0). */
const SIDED: Readonly<Record<string, string>> = { wrist: 'hand', elbow: 'lowerarm', arm: 'upperarm', hip: 'thigh', knee: 'calf', ankle: 'foot' };
const TRUNK: Readonly<Record<string, string>> = { pelvis: 'pelvis', spine: 'spine_02', chest: 'spine_03', neck: 'neck_01', head: 'head' };
/** Height units from the sculpted head's bone (the skull's base) up to the middle of the head, where the flat figure's head point is. */
const HEAD_UP = 1.3;

/** A point of a caster on the sculpted body playing a casting clip, or null (see the top of this file). */
export function sculptedJoint(pose: FigurePose, bone: string): V3 | null {
  const fx = sculptFx();
  if (!fx || !sculptedReady() || flatFigures() || !pose.cast) return null;
  const c = fx.clip(pose);
  if (!c || !c.name.startsWith('cast-')) return null;
  const m = /^([a-z]+)([01])$/.exec(bone), left = c.name.endsWith('-left');
  if (m && SIDED[m[1]]) {
    // (played left-handed, the cast's hand is the left: what the flat figure has in its right is found in the left)
    const side = (m[2] === '1') !== left ? 'r' : 'l', name = `${SIDED[m[1]]}_${side}`;
    const p = fx.point(pose, { bone: name });
    if (!p || m[1] !== 'wrist') return p ? p.at : null;
    // a hand: the middle of the fist, between the wrist and the knuckles
    const q = fx.point(pose, { bone: `fingers_01_${side}` });
    return q ? [(p.at[0] + q.at[0]) / 2, (p.at[1] + q.at[1]) / 2, (p.at[2] + q.at[2]) / 2] : p.at;
  }
  const t = TRUNK[bone];
  if (!t) return null;
  const p = fx.point(pose, { bone: t });
  return p ? (bone === 'head' ? [p.at[0], p.at[1], p.at[2] + HEAD_UP] : p.at) : null;
}
