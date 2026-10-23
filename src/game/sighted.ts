/** A wild one worth a look, said in the log as it comes into view. */
import { kindName, SPECIES, type Creature } from './creatures';
import { RARITIES } from './items';
import { TRACK_POINTS } from './tracking';
import { formName, formsOf } from './wildforms';

/**
 * The log line for a wild one in view that is rare or in a wild form: its kind, what is rare about it, how far and
 * which way. Asked for: "Add a text line when the player comes into view of a rare or variant wild wildermon".
 */
export function sightedLine(c: Pick<Creature, 'species' | 'skills' | 'rare' | 'formColour' | 'formSize' | 'x' | 'y'>, x: number, y: number): string {
  const def = SPECIES[c.species];
  const what = [...(c.rare ? [RARITIES[c.rare].name.toLowerCase()] : []), ...formsOf(c).map((f) => formName(def, f).toLowerCase())];
  const dx = c.x - x;
  const dy = c.y - y;
  // Eight points, clockwise from north, which is up the map.
  const turn = Math.atan2(dx, -dy) / (2 * Math.PI);
  const point = TRACK_POINTS[(((Math.round(turn * 8) % 8) + 8) % 8) * 2];
  return `Sighted: ${kindName(c)} (${what.join(', ')}), ${Math.round(Math.hypot(dx, dy))} tiles ${point}.`;
}
