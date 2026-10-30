/** A wild one worth a look, said in the log as it comes into view: as much of it as your Tracking notices. */
import { creatureLevel, kindName, SPECIES, type Creature } from './creatures';
import { RARITIES } from './items';
import { bearingTo, pointName, trackBand, TRACK_BANDS } from './tracking';
import { formName, formsOf, type FormId } from './wildforms';

/*
 * Asked for: "Add a text line when the player comes into view of a rare or variant wild wildermon", and then "the
 * mechanic that writes in chat if a rare wildermon is nearby is dependent on tracking skill levels, tiered for rarity,
 * variations etc".
 *
 * So each thing a wild one can be has the Tracking level it is first noticed at (`SIGHT_RARITY_AT`, `SIGHT_FORM_AT`),
 * the rarer the higher, read whole as a track is (`trackLevel`). A wild one is said once, when something about it is
 * noticed, and only what is noticed is said. How the line reads goes by the band of Tracking a track reads in
 * (`TRACK_BANDS`): the way to it to four points, eight, sixteen or the degree; how far from the second band; its level
 * in the last.
 */

/** The Tracking level each step of rarity (`RARITIES`) is noticed in view at: rare one in a hundred, supreme in a thousand, fantastic in ten thousand. */
export const SIGHT_RARITY_AT: readonly number[] = [0, 5, 40, 70];
/** And each wild form's: a size form one in `2 × SIZE_FORM_ODDS`, the colour form one in `COLOUR_FORM_ODDS`. */
export const SIGHT_FORM_AT: Readonly<Record<FormId, number>> = { large: 15, small: 15, colour: 25 };

type Sightable = Pick<Creature, 'species' | 'skills' | 'rare' | 'formColour' | 'formSize' | 'x' | 'y'>;

/** What of a wild one Tracking at `level` notices: its rarity's step (nought for none or not noticed) and its forms. */
export function noticed(c: Pick<Creature, 'rare' | 'formColour' | 'formSize'>, level: number): { rare: number; forms: FormId[] } {
  const rare = c.rare && level >= SIGHT_RARITY_AT[c.rare] ? c.rare : 0;
  return { rare, forms: formsOf(c).filter((f) => level >= SIGHT_FORM_AT[f]) };
}

/** What Tracking at `level` notices in view, as a label: "rare, large and small forms". */
export function sightedAt(level: number): string {
  const rare = RARITIES.flatMap((r, step) => (step && level >= SIGHT_RARITY_AT[step] ? [r.name] : []));
  const size = level >= SIGHT_FORM_AT.large ? ['large and small forms'] : [];
  const colour = level >= SIGHT_FORM_AT.colour ? ['pale and dark forms'] : [];
  const all = [...rare, ...size, ...colour];
  return all.length ? all.join(', ') : 'nothing';
}

/**
 * The log line for a wild one in view, from Tracking at `level`: its kind, what of it is rare as far as that level
 * notices, the way to it and how far as finely as the band reads, and its level in the last band. Null when nothing
 * about it is noticed.
 */
export function sightedLine(c: Sightable, x: number, y: number, level: number): string | null {
  const seen = noticed(c, level);
  if (!seen.rare && !seen.forms.length) return null;
  const def = SPECIES[c.species];
  const what = [...(seen.rare ? [RARITIES[seen.rare].name] : []), ...seen.forms.map((f) => formName(def, f).toLowerCase())];
  const b = TRACK_BANDS[trackBand(level)];
  const step = 360 / b.points;
  const i = Math.floor(bearingTo(x, y, c.x, c.y) / step + 0.5) % b.points;
  const way = b.points === 360 ? `bearing ${i}°` : pointName(b.points, i);
  const far = b.round === null ? '' : `${Math.round(Math.hypot(c.x - x, c.y - y))} tiles `;
  const lvl = b.detail ? `, level ${creatureLevel(c)}` : '';
  return `Sighted: ${kindName(c)} (${what.join(', ')})${lvl}, ${far}${way}.`;
}
