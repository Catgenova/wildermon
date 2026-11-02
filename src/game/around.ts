import type { ActionDef, Target } from './actions';
import { crateOf, crateToHand, letOut } from './creaturecrate';
import { ERRAND_JOBS, GATHER_VERB, SPECIES, STORE_RECIPES, workRangeOf, type AroundFrom, type Creature, type GatherKind } from './creatures';
import type { Game } from './game';
import { POST_FOLLOW_REACH } from './posts';

/**
 * Work around me: a wildermon of yours works its trade within its work range of you, wherever you are, into storage
 * in reach of you.
 *
 * Asked for: "Allow wildermon to Work Around Me, provided there is storage nearby (carts and wagons and accessible
 * boats included)", and "It is an action of the player. The player is the focal point, not a work post or the
 * settlement totem."
 *
 * It is set on one wildermon at a time, as a post takes one: one following you within `POST_FOLLOW_REACH`, or one in
 * a crate in your pack or standing within reach. It works as a worker does (`mode` 'deed'), with `around` set to where
 * it came from and no post: its ground is your tile, read each step (`Game.workSite`); its stores are the storage in
 * reach of you (`Game.aroundStores`); it is on no settlement's roll. With no storage in reach it does not set out
 * (`nostore`), and with no room it holds its load (`full`). Stop sends every one working round you back where it came
 * from (`Game.endAround`), as does your going offline on the island (`around_sweep`).
 *
 * The island's `around_refusal`, `perform_around` and `around_end`.
 */

/** Where Stop sends them, and the island's words for it. */
export const AROUND_STOPPED = 'Work around me stopped';

/**
 * A trade worked round you: one that walks out to the ground and carries its loads home, as at a post, and of the
 * errands the ones worked at the stores (`STORE_RECIPES`). Not guarding, stoking, or an errand tied to the
 * settlement's own buildings, stations or creatures. The island's `around_trade`.
 */
export const aroundTrade = (kind: GatherKind | null | undefined): boolean =>
  !!kind && kind !== 'guard' && kind !== 'stoke' && (!ERRAND_JOBS.has(kind) || STORE_RECIPES[kind] !== undefined);

/** The errands worked round you: the trades at the stores (`STORE_RECIPES`), by their verb. */
export const aroundStoreTrades = (): string[] => (Object.keys(STORE_RECIPES) as GatherKind[]).map((k) => GATHER_VERB[k]);

type CreatureTarget = Extract<Target, { kind: 'creature' }>;
const creatureOf = (g: Game, t: Target): Creature | undefined => (t.kind === 'creature' ? g.creatures.get((t as CreatureTarget).id) : undefined);

/** Where one in a crate came out of, for it to go back to: the piece standing, or the crate in your pack. */
function crateFrom(g: Game, c: Creature): AroundFrom {
  const h = crateOf(g, c.id);
  if (h && 'piece' in h) return { was: 'crate', placed: h.piece.id };
  if (h) return { was: 'crate', item: h.item.uid };
  return { was: 'crate' };
}

/** Why this one may not be set to work round you, or null; in the island's words. */
export function aroundRefusal(g: Game, c: Creature | undefined): string | null {
  if (!c) return 'Gone.';
  const def = SPECIES[c.species];
  if (c.mode === 'wild' || c.mine === false) return `${c.name} is not yours to set to work.`;
  if (c.hitchedTo !== null || c.ridden) return `${c.name} is in harness.`;
  if (c.around) return `${c.name} already works around you.`;
  if (c.mode === 'stored') {
    if (!crateToHand(g, c)) return `${c.name} is in a crate out of reach.`;
  } else if (c.mode !== 'active') return `${c.name} is not following you.`;
  else if (Math.hypot(c.x - g.player.x, c.y - g.player.y) > POST_FOLLOW_REACH) return `${c.name} is too far.`;
  const kind = c.trade ?? def.gathers;
  if (!kind) return `${def.name}: no task.`;
  if (!aroundTrade(kind)) return `Settlement only: ${GATHER_VERB[kind]}.`;
  return null;
}

export const AROUND_ACTIONS: ActionDef[] = [
  {
    id: 'work_around',
    label: 'Work around me',
    verb: 'setting it to work',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mine !== false && !c.around && c.hitchedTo === null && !c.ridden
        && (c.mode === 'active' || (c.mode === 'stored' && !!crateToHand(g, c)));
    },
    check: (t, g) => aroundRefusal(g, creatureOf(g, t)),
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c || aroundRefusal(g, c)) return;
      const was: AroundFrom = c.mode === 'stored' ? crateFrom(g, c) : { was: 'follow' };
      if (c.mode === 'stored') letOut(g, c);
      g.clearPost(c);
      c.mode = 'deed';
      c.around = was;
      c.enemy = null;
      c.state = 'idle';
      c.until = g.time;
      c.idle = null;
      const def = SPECIES[c.species];
      const kind = (c.trade ?? def.gathers) as GatherKind;
      g.logMsg(`Work around me: ${c.name}, ${GATHER_VERB[kind]} within ${workRangeOf(c, def)} tiles of you.`, 'wildermon');
      g.events.emit('creature');
    },
  },
  {
    id: 'stop_work_around',
    label: 'Stop work around me',
    verb: 'calling them back',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => !!creatureOf(g, t)?.around,
    check: (_t, g) => (g.creatures.aroundYou().length ? null : 'Nothing works around you.'),
    perform: (_t, g) => {
      for (const c of g.creatures.aroundYou()) g.endAround(c, AROUND_STOPPED);
    },
  },
];

export const AROUND_ACTION_BY_ID = new Map(AROUND_ACTIONS.map((a) => [a.id, a]));
