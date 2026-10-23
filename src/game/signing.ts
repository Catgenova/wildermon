import type { ActionDef, Target } from './actions';
import { cleanLine } from './chat';
import { FURNITURE_BY_ID } from './furniture';
import type { Game } from './game';
import { itemDef, type Item } from './items';

/**
 * Signed masterworks.
 *
 * A thing made at QL `SIGN_QL` or better carries its maker's name, as rare
 * work always has (`Item.maker`; on the island the row's `maker`): the bench
 * and the anvil write it on as the thing comes off them (`madeBy`, the
 * island's `made_by`). Its maker, and nobody else, may then **Sign** it once
 * with a short line of their own words: cleaned as talk is (`cleanLine`, as a
 * memorial stone's line is), no longer than `SIGN_MAX`, and kept on the
 * thing's `engraving` -- the field a memorial stone in a pack keeps its line
 * on -- wherever it goes after. Examine says who made it and what they signed
 * it with.
 *
 * One thing at a time, never a pile: a pile's QL is the average of what went
 * onto it, so it is not "made at" any one QL. And never a piece of furniture,
 * which keeps no maker once it is set down.
 */

/** The job. */
export const SIGN = 'sign_item';
/** The QL a thing has to be made at to carry its maker's name, and to be signed. */
export const SIGN_QL = 90;
/** The longest line a signature takes, in characters. */
export const SIGN_MAX = 40;
/** Seconds a signature takes. */
export const SIGN_TIME = 5;

/** A line as it will be signed: a line of talk's cleaning, at a signature's own length. */
export const cleanSignature = (raw: string): string => cleanLine(raw, SIGN_MAX);

/**
 * The maker's name a thing just made carries, or nothing: rare work always,
 * and one thing (not a pile) made at `SIGN_QL` or better. The island's `made_by`.
 */
export const madeBy = (name: string, id: string, ql: number, rare?: number | null): string | undefined =>
  rare || (ql >= SIGN_QL && !itemDef(id).stackable) ? name : undefined;

/** Whether a thing of this kind is ever signed: one thing, not a pile, and not a piece of furniture. */
export const signableKind = (id: string): boolean => !itemDef(id).stackable && !FURNITURE_BY_ID.has(id);

/** What a refused signing says. The island says the same (`sign_said`, `sign_not_yours_said`). */
export const SIGN_SAID = {
  notMade: `Only single items made at QL ${SIGN_QL} or better carry a maker's name to sign; not piles or furniture.`,
  signed: 'Already signed: once only.',
  nothing: 'Signature is empty.',
};
/** And to somebody who did not make it. */
export const signNotYours = (maker: string): string => `Made by ${maker}: only ${maker} may sign it.`;

/** What signing says. The island's `signed_said`. */
export const signedSaid = (text: string): string => `Signed: “${text}”.`;

/**
 * What Examine says of who made a thing: its maker, and the line they signed
 * it with if they have. A memorial stone's line is its own (`engravedItemSays`).
 * The island's `maker_says`.
 */
export const makerSays = (it: Pick<Item, 'id' | 'maker' | 'engraving'>): string =>
  makerLine(it.maker, signableKind(it.id) ? it.engraving : undefined);
/** The words of it, off the maker's name and the line signed, if any. The island's `maker_says`. */
export const makerLine = (maker: string | null | undefined, signed: string | null | undefined): string =>
  !maker ? '' : signed ? ` Made by ${maker}, signed: “${signed}”.` : ` Made by ${maker}.`;

type ItemTarget = Extract<Target, { kind: 'item' }>;
const itemOf = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get((t as ItemTarget).uid) : undefined);

/**
 * Why a thing cannot be signed now, or null: in the island's order -- there,
 * made at the QL, by you, not signed yet, and the words (`sign_refusal`).
 */
export function signRefusal(g: Game, t: Target): string | null {
  const it = itemOf(g, t);
  if (!it) return 'It is gone.';
  if (!it.maker || !signableKind(it.id) || it.ql < SIGN_QL) return SIGN_SAID.notMade;
  if (it.maker !== g.player.name) return signNotYours(it.maker);
  if (it.engraving) return SIGN_SAID.signed;
  const asked = (t as { name?: unknown }).name;
  // Not yet asked: the box is opened first (`askName`), and the words are asked about when they come.
  if (typeof asked !== 'string') return null;
  return cleanSignature(asked) ? null : SIGN_SAID.nothing;
}

export const SIGN_ACTIONS: ActionDef[] = [
  {
    id: SIGN,
    label: 'Sign',
    verb: 'signing',
    stamina: 0,
    baseTime: SIGN_TIME,
    asks: {
      question: `What should it say? Up to ${SIGN_MAX} characters, once: it cannot be signed again.`,
      declined: 'Left unsigned.',
      max: SIGN_MAX,
    },
    applies: (t, g) => {
      const it = itemOf(g, t);
      return !!it && !!it.maker && !it.engraving && signableKind(it.id) && it.ql >= SIGN_QL && it.maker === g.player.name;
    },
    check: (t, g) => signRefusal(g, t),
    perform: (t, g) => {
      const it = itemOf(g, t);
      if (!it || signRefusal(g, t)) return;
      const text = cleanSignature(String((t as { name?: unknown }).name ?? ''));
      it.engraving = text;
      g.note('signed');
      g.inventory.onChange?.();
      g.logMsg(signedSaid(text), 'event');
      g.events.emit('inventory');
    },
  },
];
