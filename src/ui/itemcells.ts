import { DAMAGE_WARN, type Game } from '../game/game';

/** Damage past which the pack calls a thing about to go to pieces. */
export const DAMAGE_BREAKING = 90;
import { itemName, type Item, rarityOf } from '../game/items';
import { dyeHexOf } from '../game/dyestuffs';
import { isJobTool } from './compare';

/**
 * The three cells a list of things is made of.
 *
 * There are two windows that show you things you own -- your pack and whatever
 * container you have open -- and they were writing their rows separately. The
 * pack's row knew that a rare thing is written in its own colour, that a thing
 * kept back is written in italics, that a blunt tool is not worth what it says
 * on it and that a tool at ninety damage is about to go to pieces. The
 * container's row knew none of it: it wrote the name in the ordinary colour
 * and the two numbers plain, so a fantastic hatchet in a crate looked exactly
 * like every other hatchet in the crate. Reported: *"item rarities aren't
 * displayed inside of containers."*
 *
 * So the cells live here, and both windows build their rows out of them. There
 * is nowhere left for the two to disagree.
 */

/**
 * The name of a thing.
 *
 * `itemName` already puts the word -- rare, supreme, fantastic -- into the
 * name; what this adds is the colour, which is the thing anybody actually
 * scans a list for, and the marks for what is worn and what is kept back.
 */
export function nameCell(item: Item, opts: { worn?: boolean; occupant?: string } = {}): HTMLSpanElement {
  const name = document.createElement('span');
  name.className = 'inv-name';
  const worn = opts.worn ?? false;
  // A creature crate says who is in it.
  const marks = [worn ? 'worn' : '', item.locked ? 'kept' : '', opts.occupant ? `${opts.occupant} inside` : ''].filter(Boolean);
  const full = (item.count > 1 ? `${itemName(item)} (${item.count})` : itemName(item))
    + (marks.length ? ` · ${marks.join(' · ')}` : '');
  name.textContent = full;
  // The column is narrow and some of these names are long.
  name.title = item.locked ? `${full}. Kept back: nothing will spend, drop or feed it away.` : full;
  // A swatch of its colour, for a thing dyed and a bucket of dye, and the hex beside the name on hover.
  const hex = dyeHexOf(item.dye);
  if (hex) {
    const swatch = document.createElement('span');
    swatch.className = 'inv-swatch';
    swatch.style.backgroundColor = hex;
    name.prepend(swatch);
    name.title += ` · ${hex}`;
  }
  const rare = rarityOf(item);
  if (rare.css) {
    name.style.color = rare.css;
    // For the notch Runecut cuts at the head of the row (src/style.css), so rarity is not told by colour alone.
    name.dataset.rare = rare.name;
  }
  if (worn) name.classList.add('inv-worn');
  if (item.locked) name.classList.add('inv-kept');
  return name;
}

/**
 * Its quality, and what it is worth at the work today where the two differ:
 * the number it was made at dragged down by the state it is in and lifted by
 * its metal, its rarity and any blessing on it.
 */
export function qualityCell(game: Game, item: Item): HTMLSpanElement {
  const ql = document.createElement('span');
  ql.className = 'inv-ql';
  ql.textContent = item.ql.toFixed(1);
  /*
   * Only for what a job works with. Armour, a shield and a weapon nobody works
   * with are read at the QL they were made at, through rules of their own
   * (`pieceSoak`, `blockChance`, `weaponDamage`), so a working QL on them
   * would be a number nothing uses.
   */
  if (!isJobTool(item.id)) return ql;
  const worth = game.toolWorth(item);
  ql.title = `Made at QL ${item.ql.toFixed(1)}; with its damage, metal, rarity and blessing counted it works as QL ${worth.toFixed(1)} today.`;
  if (worth < item.ql - 0.05) {
    ql.classList.add('inv-blunt');
    ql.textContent = `${item.ql.toFixed(1)}→${worth.toFixed(0)}`;
  } else if (worth > item.ql + 0.05) {
    ql.classList.add('inv-keen');
    ql.textContent = `${item.ql.toFixed(1)}→${worth.toFixed(0)}`;
  }
  return ql;
}

/**
 * The row of column names over a list of things: Item, QL, Dmg, and the last
 * column's own name (`last`, Wt in the pack and nothing over a store's Take
 * buttons). Each says on hover what its number is.
 */
export function headRow(last: { label: string; title?: string; className?: string }): HTMLDivElement {
  const head = document.createElement('div');
  head.className = 'inv-head';
  const cols: Array<[string, string, string]> = [
    ['Item', '', 'Name, and how many there are in the stack'],
    ['QL', 'inv-ql', 'Quality, out of 100. A tool shows after the arrow what it works as today.'],
    ['Dmg', 'inv-dmg', 'Damage, out of 100. A repair takes it off; at 100 the thing is gone.'],
    [last.label, last.className ?? '', last.title ?? ''],
  ];
  for (const [label, cls, title] of cols) {
    const span = document.createElement('span');
    span.textContent = label;
    if (cls) span.className = cls;
    if (title) span.title = title;
    head.append(span);
  }
  return head;
}

/** Its damage, and a word about it where it is close to going to pieces. */
export function damageCell(item: Item): HTMLSpanElement {
  const dmg = document.createElement('span');
  dmg.className = 'inv-dmg';
  dmg.textContent = item.dmg.toFixed(1);
  // None at all is the usual case, and is written faint so the worn ones stand out.
  if (item.dmg <= 0) dmg.classList.add('inv-nil');
  if (item.dmg >= DAMAGE_BREAKING) {
    dmg.classList.add('inv-breaking');
    dmg.title = 'About to go to pieces. Repair it now.';
  } else if (item.dmg >= DAMAGE_WARN) {
    dmg.classList.add('inv-worn-out');
    dmg.title = 'Getting badly worn. Repair it before it breaks.';
  }
  return dmg;
}
