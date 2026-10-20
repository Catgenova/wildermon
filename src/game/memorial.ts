import type { ActionDef, Target } from './actions';
import { cleanLine } from './chat';
import { furnitureDef, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { describeFrom, itemDef } from './items';
import { lampTooFar } from './lamps';

/**
 * A memorial stone: a small carved stone, built by a mason and set down like
 * any piece, that somebody cuts a line of their own words into.
 *
 * Its words are the piece's own (`engraving`; on the island the placed row's
 * `engraving` column), and they go where the piece goes: picked up, the stone
 * in the pack carries them (`Item.engraving`, `item.engraving`), and set down
 * again it reads the same. A line is cleaned as a line of talk is (`cleanLine`,
 * the island's `rpc_say`): newlines and tabs to spaces, runs of spaces to one,
 * trimmed, and no longer than `ENGRAVE_MAX`; and somebody a keeper has muted
 * cuts nothing, as they say nothing.
 *
 * Whoever set it down may cut it and cut it again, and so may anybody of the
 * settlement it stands on -- the same hands that may take from a chest there
 * (`craft_stock`, `Game.craftStock`). Examine reads it back in quotes.
 */

export const MEMORIAL = 'memorial_stone';
/** Cutting a line into it, or a new line over the old one. */
export const ENGRAVE = 'engrave_memorial';
/** Examine, on the stone standing: what it reads. */
export const READ_MEMORIAL = 'read_memorial';

/** The longest line a memorial stone takes, in characters. */
export const ENGRAVE_MAX = 72;
/** Seconds a line takes to cut, before skill and the chisel. */
export const ENGRAVE_TIME = 15;
/** And the wind it costs. */
export const ENGRAVE_WIND = 0.03;
/** What it is cut with, and the trade that cuts it. */
export const ENGRAVE_TOOL = 'chisel';
export const ENGRAVE_SKILL = 'masonry';

/** A line as it will be cut: a line of talk's cleaning, at the stone's own length. */
export const cleanEngraving = (raw: string): string => cleanLine(raw, ENGRAVE_MAX);

const chisel = (): string => itemDef(ENGRAVE_TOOL).name.toLowerCase();

/** What a refused cutting says. The island says the same (`memorial_said`). */
export const MEMORIAL_SAID = {
  notYours: 'Only whoever set this stone down, or a citizen of its settlement, may engrave it.',
  get noChisel(): string { return `Need a ${chisel()}.`; },
  nothing: 'Text is empty.',
  same: 'Already reads that.',
};

/** The words, as they are quoted back. */
export const quoted = (text: string): string => `“${text}”`;

/**
 * What Examine says of a stone standing: its line in quotes, or that nothing
 * is cut into it yet and what will be. The island's `memorial_says`.
 */
export const memorialSays = (text: string | undefined): string => (text
  ? `Memorial stone: ${quoted(text)}`
  : `Memorial stone: blank. Engrave it with a ${chisel()}, up to ${ENGRAVE_MAX} characters.`);

/** What cutting it says: a first line, or a new line where an old one was. The island's `engraved_said`. */
export const engravedSaid = (text: string, recut: boolean): string => (recut
  ? `Re-engraved: ${quoted(text)}.`
  : `Engraved: ${quoted(text)}.`);

/** What Examine adds of a stone in the pack with words on it. The island's `engraved_item_says`. */
export const engravedItemSays = (it: { engraving?: string }): string => (it.engraving ? ` Engraved: ${quoted(it.engraving)}.` : '');

type PieceTarget = Extract<Target, { kind: 'furniture' }>;
const memorialOf = (g: Game, t: Target): PlacedFurniture | undefined => {
  if (t.kind !== 'furniture') return undefined;
  const f = g.furniture.get((t as PieceTarget).id);
  return f && f.kind === MEMORIAL ? f : undefined;
};
const word = (): string => furnitureDef(MEMORIAL).name.toLowerCase();

/** Whether these hands may cut it: whoever set it down, or anybody of the settlement it stands on. */
export const mayEngrave = (g: Game, f: PlacedFurniture): boolean => f.mine !== false || g.onDeed(f.x, f.y);

/**
 * Why a stone cannot be cut, or read, now, or null: in the island's order --
 * there, in reach, whose, the chisel, and the words (`memorial_refusal`).
 */
export function memorialRefusal(g: Game, id: string, t: Target): string | null {
  const f = memorialOf(g, t);
  if (!f) return 'It is gone.';
  if (!g.besidePiece(f)) return lampTooFar(word());
  if (id !== ENGRAVE) return null;
  if (!mayEngrave(g, f)) return MEMORIAL_SAID.notYours;
  if (!g.inventory.has(ENGRAVE_TOOL)) return MEMORIAL_SAID.noChisel;
  const asked = (t as { name?: unknown }).name;
  // Not yet asked: the box is opened first (`askName`), and the words are asked about when they come.
  if (typeof asked !== 'string') return null;
  const text = cleanEngraving(asked);
  if (!text) return MEMORIAL_SAID.nothing;
  return text === f.engraving ? MEMORIAL_SAID.same : null;
}

export const MEMORIAL_ACTIONS: ActionDef[] = [
  {
    id: ENGRAVE,
    label: 'Engrave',
    labelFor: (t, g) => (memorialOf(g, t)?.engraving ? 'Cut a new line' : 'Engrave'),
    verb: 'engraving the stone',
    skill: ENGRAVE_SKILL,
    tool: ENGRAVE_TOOL,
    stamina: ENGRAVE_WIND,
    baseTime: ENGRAVE_TIME,
    asks: {
      question: `What should it read? Up to ${ENGRAVE_MAX} characters.`,
      fallback: (t, g) => memorialOf(g, t)?.engraving ?? '',
      declined: 'Left unchanged.',
      max: ENGRAVE_MAX,
    },
    applies: (t, g) => !!memorialOf(g, t),
    check: (t, g) => memorialRefusal(g, ENGRAVE, t),
    perform: (t, g) => {
      const f = memorialOf(g, t);
      if (!f || memorialRefusal(g, ENGRAVE, t)) return;
      const text = cleanEngraving(String((t as { name?: unknown }).name ?? ''));
      const recut = !!f.engraving;
      f.engraving = text;
      g.logMsg(engravedSaid(text, recut), 'event');
      g.events.emit('world', f.x, f.y);
    },
  },
  {
    id: READ_MEMORIAL,
    label: 'Examine',
    verb: 'reading the stone',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => !!memorialOf(g, t),
    check: (t, g) => memorialRefusal(g, READ_MEMORIAL, t),
    perform: (t, g) => {
      const f = memorialOf(g, t);
      if (f) g.logMsg(memorialSays(f.engraving), 'event');
    },
  },
];

describeFrom(MEMORIAL, { max: ENGRAVE_MAX, chisel: chisel() });
