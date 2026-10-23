import type { Game } from './game';
import type { Goal } from './journal';
import { RELICS } from './archaeology';
import { SCHOOLS } from './arcane';
import { CLASS_TIER_AT } from './classes';
import { GEMS } from './gems';
import { GRAVE_KEEPS } from './graves';
import { RARITIES } from './items';
import { METALS } from './metal';
import { FAITH_SPELLS, PATRON_AT, PATRONS } from './patrons';
import { RUNESTONES, STONE_VISIT } from './runestones';
import { CLASS_SPELL_BY_ID } from './talents';
import { capital, listed, listedOr, spanWords } from './words';
import { BANDS } from '../world/atlas-world';
import { REGIONS } from '../world/regions';
import { metres, WEAR_FALL, WEAR_TRAIL } from '../world/tiles';

/**
 * The journal's goals for the island itself, for fighting and faith, and for
 * people and trade. `journal.ts` puts them into `JOURNAL`: the first as their
 * own chapter after the water, the second at the end of the wildermon's, the
 * third as their own chapter before a lifetime.
 *
 * Every count is the island's, noted where the thing is done (the migration
 * `journal_the_island_fighting_and_trade`), and by `Game.note` at the same
 * event where the browser has one.
 */

const did = (key: string, n = 1) => (g: Game): boolean => (g.tally[key] ?? 0) >= n;
/** Whether every key is counted. */
const all = (keys: readonly string[]) => (g: Game): boolean => keys.every((k) => (g.tally[k] ?? 0) > 0);

/** Every metal that comes out of the ground as ore, by its ore. */
const ORES = METALS.filter((m) => m.ore !== null);
/** The stones a focus is cut from: every school's. */
const ARCANE = [...new Set(SCHOOLS.flatMap((s) => s.stones))];
const gemName = (id: string): string => (GEMS.find((g) => g.id === id)?.name ?? id).toLowerCase();
/** "rare, supreme or fantastic". */
const RARE_WORDS = capital(listedOr(RARITIES.slice(1).map((r) => r.name)));
/** The kills the hundred asks for. */
const KILLS = 100;
/** How many spells of one trade cast: one a class tier, which is as many as can be held. */
const TRADE_SPELLS = CLASS_TIER_AT.length;
/** The last class tier, as the class level it opens at. */
const CLASS_TOP = CLASS_TIER_AT[CLASS_TIER_AT.length - 1];

/** Kills counted, of every kind. */
const kills = (g: Game): number =>
  Object.entries(g.tally).reduce((n, [k, v]) => (k.startsWith('slew:') ? n + v : n), 0);

/** The most different spells cast of any one fighting trade. */
function tradeSpellsCast(g: Game): number {
  const by = new Map<string, number>();
  for (const k of Object.keys(g.tally)) {
    const s = k.startsWith('cast:') ? CLASS_SPELL_BY_ID.get(k.slice('cast:'.length)) : undefined;
    if (s) by.set(s.class, (by.get(s.class) ?? 0) + 1);
  }
  return Math.max(0, ...by.values());
}

/** The island: its stones, its regions, its heights, its ground and what is under it. */
export const ISLAND_GOALS: Goal[] = [
  {
    id: 'runestones', text: `Stand beside all ${RUNESTONES.length} Runestones`,
    hint: `${listed(RUNESTONES.map((s) => s.name))}; within ${STONE_VISIT} tiles of a stone's centre`,
    how: `Walk, ride or travel by Telestone to each stone on the Crescent's inner bay and stand on dry ground within ${STONE_VISIT} tiles of its centre tile. Each stone counts once; the order does not matter.`,
    met: all(RUNESTONES.map((s) => `stone:${s.id}`)),
  },
  {
    id: 'telestone', text: 'Travel by Telestone',
    how: 'Make "Cut a Telestone" in Crafting (R): {recipe.make_telestone.earth_mote} earth motes and {recipe.make_telestone.stone_brick} stone brick, with a chisel. Right-click it in your Inventory and choose "Travel to <stone>" for a Runestone within its reach. Not while driving, aboard, mounted, swimming or with a wildermon following.',
    met: did('telestone'),
  },
  {
    id: 'fragment', text: 'Dig up a relic fragment',
    how: 'Right-click dry ground you may dig and choose "Investigate" with a trowel (starting kit). A find is a fragment, a bauble or nothing; which relics turn up depends on your archaeology. A bauble does not count.',
    met: did('fragment'),
  },
  {
    id: 'allrelics', text: `Restore all ${RELICS.length} relics`,
    hint: listed(RELICS.map((r) => r.name)),
    how: 'Each relic once: dig its fragments with "Investigate", and with every piece in your pack right-click one and choose "Restore". Deeper relics turn up only at higher archaeology. A failed go damages the pieces and does not count.',
    met: all(RELICS.map((r) => `restored:${r.result}`)),
  },
  {
    id: 'regions', text: 'Set foot in every region',
    hint: listed(REGIONS.map((r) => r.name)),
    how: 'Stand on dry ground in each region of the island; the islands beyond the Crescent are reached by boat. On the water, in a boat or swimming, it does not count.',
    met: all(REGIONS.map((_, i) => `region:${i}`)),
  },
  {
    id: 'snowline', text: `Stand above the snow line: height ${metres(BANDS.snow)} m`,
    how: `Climb to ground at height ${metres(BANDS.snow)} m or more: the high mountains, where the ground is snow or bare rock. "Examine" on a tile says its height.`,
    met: did('snowline'),
  },
  {
    id: 'allore', text: 'Mine every kind of ore',
    hint: listed(ORES.map((m) => m.name.toLowerCase())),
    how: 'Right-click a seam and choose "Mine" (or "Chip corner"), or dig a cellar under a building on a seam. Each metal needs a mining level; the refusal names it. "Prospect" finds seams. Some ores lie on one island only.',
    met: all(ORES.map((m) => `ore:${m.ore}`)),
  },
  {
    id: 'arcstone', text: `Mine a ${listedOr(ARCANE.map(gemName))}`,
    hint: 'The stones a focus is cut from',
    how: 'Any "Mine" or "Chip corner" swing in rock can bring a stone up with the rock; most stones are one of these. The stone goes into your pack and the log names it.',
    met: (g) => ARCANE.some((id) => (g.tally[`gem:${id}`] ?? 0) > 0),
  },
  {
    id: 'trail', text: 'Wear a trail into the ground',
    hint: `Wear ${WEAR_TRAIL} on one tile; −${WEAR_FALL} each day`,
    how: `Walk over the same tile of grass, lawn, steppe, tundra or moss on foot, a point of wear a step, until it reaches ${WEAR_TRAIL}. Each day takes ${WEAR_FALL} off. Riding, driving and building on it do not wear it.`,
    met: did('trail'),
  },
  {
    id: 'theirmap', text: "Dig up a hoard from another player's treasure map",
    how: 'Get a treasure map another player found (a deal in the Market window, or handed over), stand on the spot it shows, right-click it in your Inventory and choose "Dig it up" with a shovel. Its guard comes for you.',
    met: did('hoard:theirs'),
  },
];

/** Fighting and faith, at the end of the wildermon's chapter, beside the altar and the dragon. */
export const WILDERMON_GOALS_C: Goal[] = [
  {
    id: 'fighter', text: 'Choose a fighting trade',
    how: 'Trades window (F): pick a fighting class and confirm. A fighting class asks for no skill level. Changing it later costs silver.',
    met: did('fighter'),
  },
  {
    id: 'classtop', text: `Open all ${CLASS_TIER_AT.length} class tiers of a fighting trade`,
    hint: `Class level ${CLASS_TIER_AT.join(', ')}`,
    how: `Class level rises with every blow or shot that lands on a creature while you hold the trade, and more for a kill. The last class tier opens at class level ${CLASS_TOP}; the Trades window (F) shows it.`,
    met: did('classtop'),
  },
  {
    id: 'classcast', text: `Cast ${TRADE_SPELLS} different spells of one fighting trade`,
    hint: 'A spell, not the passive, at every class tier',
    how: `Trades window (F): at each of the ${CLASS_TIER_AT.length} class tiers take a spell rather than the passive. Put them on the spell bar and cast each at least once (Shift + slot number).`,
    met: (g) => tradeSpellsCast(g) >= TRADE_SPELLS,
  },
  {
    id: 'kills', text: `Kill ${KILLS} wild creatures`,
    hint: 'Monsters and wild wildermon',
    how: 'Attack anything wild ("Attack" in its menu, or Space) and land the killing blow or shot yourself. A kill by a companion or a settlement wildermon does not count.',
    met: (g) => kills(g) >= KILLS,
  },
  {
    id: 'rarekill', text: 'Kill a rare wildermon',
    hint: `${RARE_WORDS}; drawn larger than its kind`,
    how: 'Find a wild wildermon drawn larger than others of its kind ("Look it over" names its rarity) and land the killing blow or shot yourself.',
    met: did('slewrare'),
  },
  {
    id: 'staunch', text: 'Stop a bleeding wound with a dressing',
    hint: "Yours or another player's; the dressing must hold",
    how: 'Dress a wound that is bleeding ("Dress <wound>", or "Dress <name>\'s wounds" beside another player) with a bandage or a cover. It counts when the dressing holds.',
    met: did('staunched'),
  },
  {
    id: 'sacrifice', text: 'Sacrifice a rare item at an altar',
    hint: RARE_WORDS,
    how: 'Stand at an altar, right-click it and choose "Sacrifice" and a rare, supreme or fantastic item from your pack. One of a stack goes.',
    met: did('sacrificed'),
  },
  {
    id: 'patron', text: 'Take a patron and cast a faith spell',
    hint: `Patron at faith ${PATRON_AT}`,
    how: `At faith ${PATRON_AT}: Faith window, pick ${listedOr(PATRONS.map((p) => p.name))} (permanent), then take a spell at the first faith tier, put it on the spell bar and cast it (Shift + slot number). It costs favour.`,
    met: (g) => FAITH_SPELLS.some((s) => (g.tally[`cast:${s.id}`] ?? 0) > 0),
  },
  {
    id: 'swirl', text: 'Collect motes from a swirl',
    how: 'Find a mote swirl (new ones each day, drawn on the ground), stand within arm\'s reach, right-click it and choose "Collect motes". Bare hands.',
    met: did('swirl'),
  },
  {
    id: 'grave', text: 'Take everything back from your grave',
    get hint() {
      return `Before it crumbles: ${spanWords(GRAVE_KEEPS)}`;
    },
    how: 'After dying, walk back to your grave (marked on your map), right-click it and choose "Take everything". Only you can open it.',
    met: did('grave'),
  },
];

/** People and trade: selling, buying for somebody, writing, living with others, and standing among them. */
export const TRADE_GOALS: Goal[] = [
  {
    id: 'sold', text: 'Sell an item from your stall or shop counter',
    how: 'Make "Build market stall" in Crafting (R) and set it down, put items in it and give each a price (Market window, U: Stall tab). It counts when another player buys one.',
    met: did('sold'),
  },
  {
    id: 'filled', text: "Deliver to another player's buy order",
    how: 'At a settlement totem or a mailbox: Market window (U), Orders tab, "Fill" on another player\'s order with matching items in your pack. Paid from what the order holds.',
    met: did('filled'),
  },
  {
    id: 'letter', text: 'Send a letter',
    how: 'Social window (Y): "Write" beside a contact, type and send. A parcel posted without a note does not count.',
    met: did('letter'),
  },
  {
    id: 'citizen', text: 'Become a citizen of another settlement',
    how: 'Be invited by its founder or a citizen with Invite and choose "Move in" (Social window, Y), or ask to join and be let in.',
    met: did('citizen'),
  },
  {
    id: 'bell', text: 'Ring a bell',
    how: 'Right-click a bell standing on a settlement and choose "Ring bell": the settlement\'s working wildermon come to you. A bell is "Build bell" in Crafting (R).',
    met: did('rang'),
  },
  {
    id: 'board', text: 'Place on an island leaderboard',
    hint: 'A skill board or the wildermon board',
    how: 'Journal, Leaderboards tab: a skill of yours, or a wildermon you keep, on its board. It counts when the tab shows you there.',
    met: did('board'),
  },
];
