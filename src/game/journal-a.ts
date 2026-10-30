/**
 * Journal goals, part A: the wildermon (bred, evolved, kept, geared and worked)
 * and what a settlement can be built into.
 *
 * Each reads either what the browser already holds of your own (your
 * wildermon, your pieces, your settlement) or a count the island keeps for you
 * (`journal_note`, read on the beat into `Game.tally`). Every text, hint and
 * how-to is read at the moment it is shown, off the rule it names: the
 * definitions it quotes load after the journal does.
 */
import type { Game } from './game';
import type { Goal } from './journal';
import type { Creature, GatherKind } from './creatures';
import { MUTATION_ODDS, PEDIGREE_MOST, stageSlots, TRAIT_SLOTS } from './traits';
import { COLOUR_FORM_ODDS, FORM_PASS, SIZE_FORM_ODDS } from './wildforms';
import { GEAR_SLOTS, gearA } from './wildgear';
import { furnitureDef, FURNITURE_BY_ID } from './furniture';
import { OUTSIDE_STAIR_LEVEL, WALL_TYPES } from './building';
import { BRIDGES } from './bridges';
import { ROSE_FLOWER, roseStage } from './roses';
import { isRuneLantern } from './runelantern';
import { MEMORIAL } from './memorial';
import { WATER_PLANTS } from '../world/waterplants';
import { listed, listedOr, percent } from './words';
import { WATER_MOTES_EACH } from './motes';
import { itemDef } from './items';

/*
 * Every line here is a getter, read when it is shown, through `late`: the
 * journal is loaded from inside the game's own module graph (`recipes.ts`
 * fills its goals' numbers as it loads, and `journal.ts` reads every how-to
 * as it builds the list), before `game.ts` and the creatures have run, so a
 * line read then would read a rule that is not there yet. Read that early it
 * is empty; read by the window, it is whole.
 */
const late = (line: () => string): string => {
  try {
    return line();
  } catch {
    return '';
  }
};

/*
 * The rules of the wildermon, the Field guide and a settlement's level, handed
 * over by `game.ts` once it runs (`journalRulesA`) rather than imported: the
 * journal is loaded from inside the module graph, ahead of the game, and
 * importing the creatures here would run them, and the recipes they lean on,
 * before the journal they fill is there. Read when a line is read or a goal is
 * asked, by which time the game has run.
 */
type CreatureRules = typeof import('./creatures');
type GuideRules = typeof import('./guide');
interface DeedRules {
  most: number;
  workersAt: (level: number) => number;
}
let heldCreatures: CreatureRules | undefined;
let heldGuide: GuideRules | undefined;
let heldDeed: DeedRules | undefined;
export function journalRulesA(creatures: CreatureRules, guide: GuideRules, deed: DeedRules): void {
  heldCreatures = creatures;
  heldGuide = guide;
  heldDeed = deed;
}
const handed = <T>(r: T | undefined): T => {
  if (!r) throw new Error('journal-a: the game has not handed its rules over yet');
  return r;
};
const C = (): CreatureRules => handed(heldCreatures);
const GD = (): GuideRules => handed(heldGuide);
const DEED = (): DeedRules => handed(heldDeed);

const did = (key: string, n = 1) => (g: Game): boolean => (g.tally[key] ?? 0) >= n;
/** Only your own: absent `mine` is the game's own word for yours. */
const ours = <T extends { mine?: boolean }>(xs: Iterable<T>): T[] => [...xs].filter((x) => x.mine !== false);
/** Whether you founded the settlement you stand on. */
const founded = (g: Game): boolean => !!g.deed && g.deed.mine !== false;

/** The stage a kind that evolves reaches at each of `EVOLVE_AT`, counted from its first as one. */
const stageNo = (i: number): number => i + 2;
/** The last stage, and the trait slots it has. */
const lastStage = (): number => C().EVOLVE_AT.length + 1;
const mostSlots = (): number => stageSlots(C().EVOLVE_AT.length);
/** How many stage-3 ones at once. */
const TOP_KEPT = 3;
/** Line depths the two line goals ask for: three generations, and the deepest a line is counted. */
const LINE_SHORT = 3;
/** Field guide kinds marked seen for the first count. */
const SEEN_SOME = 25;
/** The level of its trade the trade goal asks for. */
const TRADE_AT = 50;
/** The storey the storey goal asks for. */
const STOREY3 = 3;

/** A line at least this deep bred: the island notes the deepest of each birth (`line:<depth>`). */
const lineBred = (depth: number) => (g: Game): boolean =>
  Object.entries(g.tally).some(([k, n]) => k.startsWith('line:') && Number(k.slice(5)) >= depth && n > 0);

/** The skill its trade, or what it learns by, trains. */
function tradeSkill(c: Creature): string | null {
  const at = C().learnsAt(c);
  if (!at) return null;
  return at in C().GATHER_SKILL ? C().GATHER_SKILL[at as GatherKind] : C().SPECIES[c.species]?.learns?.skill ?? null;
}

const wallName = (id: string): string => WALL_TYPES.find((w) => w.id === id)?.name ?? id;
const pieceName = (id: string): string => FURNITURE_BY_ID.get(id)?.name ?? id;
const lower = (s: string): string => s.toLowerCase();

export const WILDERMON_A: Goal[] = [
  {
    id: 'evolve2',
    get text() { return late(() => `Evolve a wildermon to stage ${stageNo(0)}`); },
    get hint() { return late(() => `Level ${C().EVOLVE_AT[0]}`); },
    get how() { return late(() => `A tamed wildermon of a kind that evolves (its Field guide page lists its stages) reaches stage ${stageNo(0)} at level ${C().EVOLVE_AT[0]}: work it on your settlement, or at a work post, until its level skill gets there. Wild ones that come in past their first stage do not count.`); },
    met: did('evolved:1'),
  },
  {
    id: 'evolve3',
    get text() { return late(() => `Evolve a wildermon to stage ${lastStage()}`); },
    get hint() { return late(() => `Level ${C().EVOLVE_AT[C().EVOLVE_AT.length - 1]}`); },
    get how() { return late(() => `Keep working a wildermon that has evolved once until its level skill reaches ${C().EVOLVE_AT[C().EVOLVE_AT.length - 1]}. It evolves while yours; one tamed already at its last stage does not count.`); },
    met: (g) => did(`evolved:${C().EVOLVE_AT.length}`)(g),
  },
  {
    id: 'topkept',
    get text() { return late(() => `Keep ${TOP_KEPT} stage-${lastStage()} wildermon at once`); },
    get how() { return late(() => `Wildermon at level ${C().EVOLVE_AT[C().EVOLVE_AT.length - 1]} or more of kinds that evolve, all yours at once: following you, working, at a post or in a wildermon crate.`); },
    met: (g) => g.creatures.yours().filter((c) => C().stageOf(c) === C().EVOLVE_AT.length).length >= TOP_KEPT,
  },
  {
    id: 'slots',
    get text() { return late(() => `Fill all ${mostSlots()} trait slots on one wildermon`); },
    get hint() { return late(() => `${TRAIT_SLOTS} at stage 1, one more at each stage after`); },
    get how() { return late(() => `A wildermon of a kind that evolves gains a trait slot at each stage, drawn as it evolves, up to ${mostSlots()} at stage ${lastStage()}. Its card lists its traits; an ancient lamp fills an empty slot.`); },
    met: (g) => g.creatures.yours().some((c) => c.traits.length >= mostSlots()),
  },
  {
    id: 'mutation',
    text: 'Breed a mutation',
    get hint() { return late(() => `1 birth in ${MUTATION_ODDS}`); },
    get how() { return late(() => `Breed wildermon: a grown male and female of one kind, tamed, fed and side by side, "Put it to <mate>". One young in ${MUTATION_ODDS} is born with a trait neither parent carries, one rarity above their best; the birth line names it. Born to a dam of yours.`); },
    met: did('mutated'),
  },
  {
    id: 'line3',
    get text() { return late(() => `Breed a line ${LINE_SHORT} generations deep`); },
    get how() { return late(() => `A young one's line on a channel is one generation deeper than its deeper parent's, where it carries a trait on that channel. Breed bred parents that carry traits on the same channel, then their young; the card says "Line (<channel>): N generations". Born to a dam of yours.`); },
    met: lineBred(LINE_SHORT),
  },
  {
    id: 'line5',
    get text() { return late(() => `Breed a line ${PEDIGREE_MOST} generations deep`); },
    get hint() { return late(() => `The deepest a line is counted`); },
    get how() { return late(() => `As for a shorter line, ${PEDIGREE_MOST} generations in a row bred for traits on one channel: each pairing's parents carry a trait on it and the young does too. Born to a dam of yours.`); },
    met: (g) => lineBred(PEDIGREE_MOST)(g),
  },
  {
    id: 'formtame',
    text: 'Tame a wildermon in a wild form',
    get hint() { return late(() => `Colour form 1 in ${COLOUR_FORM_ODDS}, size form 1 in ${SIZE_FORM_ODDS} wild`); },
    get how() { return late(() => `A wild wildermon in a colour form, or a large or small one, is named so on its card and in the Field guide. Tame it with a food it eats ("Tame"), or take it live out of a trap.`); },
    met: did('tamed:form'),
  },
  {
    id: 'formbred',
    text: 'Breed a young in a wild form',
    get hint() { return late(() => `Each form passes at ${percent(FORM_PASS)} for each parent in it`); },
    get how() { return late(() => `Breed a wildermon in a wild form (tamed in one) with a mate of its kind. Each form passes to the young at ${percent(FORM_PASS)} for each parent that has it. Born to a dam of yours.`); },
    met: did('bred:form'),
  },
  {
    id: 'guidepage',
    get text() { return late(() => `Complete a Field guide page: ${listed(GD().GUIDE_MARKS.map((m) => lower(GD().MARK_NAMES[m])))}`); },
    get how() { return late(() => 'One kind seen, tamed by you (an offering or a trap) and bred by you (a young born to your dam). Journal window, Field guide tab: the marks show on its page.'); },
    met: did('guide:page'),
  },
  {
    id: 'seen25',
    get text() { return late(() => `Mark ${SEEN_SOME} kinds seen in the Field guide`); },
    get how() { return late(() => 'A kind is marked seen when one stands in your sight, out of a crate; its stages and forms do not count as kinds. Each region has its own; the Field guide names where each lives.'); },
    met: did('guide:seen', SEEN_SOME),
  },
  {
    id: 'seenall',
    get text() { return late(() => `Mark all ${GD().guidePages().length} kinds seen in the Field guide`); },
    get hint() { return late(() => 'Seasonal kinds and monsters included'); },
    get how() { return late(() => 'Every page in the Field guide marked seen: each kind in your sight once, monsters and kinds that come out only in their season included. A page shows where its kind lives once seen; an unseen one only its shape.'); },
    met: (g) => did('guide:seen', GD().guidePages().length)(g),
  },
  {
    id: 'tracked',
    text: 'Track a wildermon from the Field guide',
    get how() { return late(() => 'Journal window, Field guide tab: on the page of a kind marked seen, "Track". Ticks when a wild one is found and its trail is read; trains tracking.'); },
    met: did('tracked'),
  },
  {
    id: 'geared',
    get text() { return late(() => `Fit ${listed(GEAR_SLOTS.map((s) => `${gearA(s)}${s}`))} on one wildermon`); },
    get how() { return late(() => `In Crafting (R), make each in the size of the wildermon's bed (on its card); then on the wildermon: ${listed(GEAR_SLOTS.map((s) => `"Fit ${gearA(s)}wildermon ${s}"`))}.`); },
    met: (g) => g.creatures.yours().some((c) => GEAR_SLOTS.every((s) => !!c.gear?.[s])),
  },
  {
    id: 'mirror',
    text: 'Use a bronze mirror on a pairing',
    get how() { return late(() => 'Restore a bronze mirror from its pieces. On a wildermon of yours: "Mirror it with the bronze mirror", then breed it. Ticks at the covering that copies its best trait into the young.'); },
    met: did('mirrored'),
  },
  {
    id: 'lamp',
    text: 'Rekindle a trait with an ancient lamp',
    get how() { return late(() => 'Restore an ancient lamp from its pieces. On a wildermon of yours: "Rekindle a trait with the ancient lamp". Ticks when a trait is kindled; it takes the lowest-tier slot.'); },
    met: did('rekindled'),
  },
  {
    id: 'den',
    text: 'Rest a wildermon in a bed you built',
    get how() { return late(() => `Build a ${lower(pieceName('den_small'))}, ${lower(pieceName('den_medium'))} or ${lower(pieceName('den_large'))} (Crafting (R)), the size its card names, and set it down on your settlement. A worker of yours there lies down in it when tired.`); },
    met: did('bedded:own'),
  },
  {
    id: 'workers',
    get text() { return late(() => `Keep ${DEED().workersAt(DEED().most)} wildermon working on your settlement at once`); },
    get hint() { return late(() => `The most a level ${DEED().most} settlement takes`); },
    get how() { return late(() => `Raise your settlement to level ${DEED().most}, then "Assign to settlement" on ${DEED().workersAt(DEED().most)} tamed wildermon. Work posts do not count.`); },
    met: (g) => g.creatures.workers().length >= DEED().workersAt(DEED().most),
  },
  {
    id: 'trade50',
    get text() { return late(() => `Raise a wildermon to level ${TRADE_AT} in its trade`); },
    get how() { return late(() => 'The skill its trade trains, on its card: raised by its work on your settlement or at a work post, or for a kind that learns otherwise, by what it learns by.'); },
    met: (g) => g.creatures.yours().some((c) => { const s = tradeSkill(c); return !!s && (c.skills[s] ?? 0) >= TRADE_AT; }),
  },
  {
    id: 'spar',
    get text() { return late(() => `Spar a ${C().SPECIES.sparra?.name ?? 'Sparra'} against your guard on your settlement`); },
    get how() { return late(() => `"Assign to settlement" on a tamed ${C().SPECIES.sparra?.name ?? 'Sparra'} and on a guard; both idle and rested.`); },
    met: did('sparred'),
  },
];

export const STANDING_A: Goal[] = [
  {
    id: 'deedtop',
    get text() { return late(() => `Raise your settlement to level ${DEED().most}`); },
    get how() { return late(() => `Keep upgrading a settlement you founded: Settlement window (N), "Upgrade settlement". The window says what each level still wants.`); },
    met: (g) => founded(g) && g.deedLevel >= DEED().most,
  },
  {
    id: 'runegate',
    get text() { return late(() => `Build a ${lower(wallName('rune_gate'))}`); },
    get how() { return late(() => `Right-click a tile edge: "Plan fence (<side>)", ${wallName('rune_gate')}, stone brick. Then "Build ${lower(wallName('rune_gate'))} (<side>)" until finished; light motes go into its bill.`); },
    met: did('built:rune_gate'),
  },
  {
    id: 'gates',
    get text() { return late(() => `Build a ${lower(wallName('portcullis'))}, a ${lower(BRIDGES.draw.name)} and a ${lower(wallName('hidden_door'))}`); },
    get how() { return late(() => `${wallName('portcullis')}: on a building's ground floor, "Plan wall (<side>)", ${wallName('portcullis')}, a stone or brick. ${wallName('hidden_door')}: "Plan wall (<side>)", ${wallName('hidden_door')}. Then "Build wall (<side>)" until each is finished. ${BRIDGES.draw.name}: "Throw a bridge across from here", ${BRIDGES.draw.name}, then "Work on the bridge" until the last span is decked.`); },
    met: (g) => did('built:portcullis')(g) && did('bridged:draw')(g) && did('built:hidden_door')(g),
  },
  {
    id: 'cellar',
    text: 'Dig a cellar and store something in it',
    get how() { return late(() => 'In a finished building, on its ground floor: "Dig out the cellar" (shovel), then "Mine out the cellar" (pickaxe) once it reaches rock, until it is a storey deep. Then, down in the cellar, "Drop" something from your pack.'); },
    met: (g) => did('cellar')(g) && did('cellared')(g),
  },
  {
    id: 'spring',
    text: 'Dig a spring',
    get how() { return late(() => `Right-click a tile with a shovel and ${WATER_MOTES_EACH} water mote in your pack: "Dig a spring". Not inside a building; the refusal names what else the ground lacks.`); },
    met: did('spring'),
  },
  {
    id: 'aqueduct',
    text: 'Carry a spring\'s water over an aqueduct',
    get how() { return late(() => 'Dig a spring and let it fill a pond or a pool. Right-click a tile out from it where the water could pour: "Lead an aqueduct here", then "Work on the aqueduct" until every span is laid. Ticks at the last span when a spring\'s water runs along it.'); },
    met: did('aqueduct'),
  },
  {
    id: 'well',
    text: 'Draw water from a well you built',
    get how() { return late(() => `Build a ${lower(pieceName('well'))} (Crafting (R), masonry) and set it down. Standing beside it with an empty bucket in your pack: "Fill with water" on the bucket.`); },
    met: did('well:own'),
  },
  {
    id: 'glasshouse',
    text: 'Harvest a crop grown in a glasshouse',
    get how() { return late(() => 'A building of one storey walled all round, every roof tile of it in glass. Till a ground-floor tile, sow it and harvest it ripe; it grows in every season.'); },
    met: did('harvest:glass'),
  },
  {
    id: 'pier',
    text: 'Build a pier',
    get how() { return late(() => 'Plan a building, or add a tile to one, on a sloping or shallow-water tile: its ground floor stands on piers ("on piers" in the menu). "Plan floor" and "Build floor" on that tile until finished.'); },
    met: did('pier'),
  },
  {
    id: 'outstair',
    text: 'Build an outside staircase',
    get how() { return late(() => `On a building of more than ${OUTSIDE_STAIR_LEVEL} ${OUTSIDE_STAIR_LEVEL === 1 ? 'storey' : 'storeys'}, right-click the open tile beside it on storey ${OUTSIDE_STAIR_LEVEL + 1} ("Work on storey ${OUTSIDE_STAIR_LEVEL + 1}"): "Plan floor", a staircase, its head against the building. "Build floor" until finished.`); },
    met: did('outstair'),
  },
  {
    id: 'storey3',
    get text() { return late(() => `Build storey ${STOREY3}`); },
    get how() { return late(() => `"Plan another storey" on a finished building until it has ${STOREY3}, then on storey ${STOREY3} ("Work on storey ${STOREY3}") "Plan floor" and "Build floor" until a floor tile is finished.`); },
    met: did(`storey:${STOREY3}`),
  },
  {
    id: 'roses',
    get text() { return late(() => `Grow a ${listedOr([lower(pieceName('rose_arch')), lower(pieceName('lavender_arch'))])} to full`); },
    get hint() { return late(() => `${ROSE_FLOWER} days after it is set down`); },
    get how() { return late(() => `Build a ${listedOr([lower(pieceName('rose_arch')), lower(pieceName('lavender_arch'))])} (Crafting (R)) and set it down; leave it standing ${ROSE_FLOWER} days. Picking it up starts it again.`); },
    met: (g) => ours(g.furniture.values()).some((f) => !!furnitureDef(f.kind).climber && f.setAt !== undefined && roseStage(f.setAt, g.wallNow()).days >= ROSE_FLOWER),
  },
  {
    id: 'watergarden',
    get text() { return late(() => `Lay stepping stones and plant a ${listedOr(WATER_PLANTS.map((p) => lower(p.name)))}`); },
    get how() { return late(() => `Right-click shallow water with stone slabs in your pack: "Lay stepping stones". With ${listedOr(WATER_PLANTS.map((p) => lower(itemDef(p.from).name)))} in your pack, right-click still water: ${listedOr(WATER_PLANTS.map((p) => `"Plant a ${lower(p.name)}"`))}.`); },
    met: (g) => did('stones')(g) && did('waterplant')(g),
  },
  {
    id: 'memorial',
    get text() { return late(() => `Set a ${lower(pieceName(MEMORIAL))}`); },
    get how() { return late(() => `Build a ${lower(pieceName(MEMORIAL))} (Crafting (R), masonry) and set it down.`); },
    met: (g) => ours(g.furniture.values()).some((f) => f.kind === MEMORIAL),
  },
  {
    id: 'runelantern',
    get text() { return late(() => `Set a ${lower(pieceName('rune_lantern'))}`); },
    get how() { return late(() => `Build a ${lower(pieceName('rune_lantern'))} (Crafting (R), masonry: stone bricks and light motes) and set it down. It lights at night with nothing in it.`); },
    met: (g) => ours(g.furniture.values()).some((f) => isRuneLantern(f)),
  },
  {
    id: 'binfull',
    get text() { return late(() => `Fill a ${lower(pieceName('bulk_bin'))} to full`); },
    get how() { return late(() => `Build a ${lower(pieceName('bulk_bin'))} and set it down; "Put away" raw materials into it (ore, logs, dirt, shards) until it holds all it takes. A worker of yours sorting the stores into it counts.`); },
    met: did('binfull'),
  },
  {
    id: 'delivered',
    text: 'Have another citizen deliver work you set',
    get how() { return late(() => 'Settlement window (N), Work tab: set a kind of thing and how many (founder, or a rank that holds Set work). Ticks when another citizen delivers toward it ("Deliver", beside the token).'); },
    met: did('delivered'),
  },
  {
    id: 'specialty',
    text: 'Earn your settlement a specialty',
    get hint() { return late(() => `${C().SPECIALTY_AT} workers of one trade`); },
    get how() { return late(() => `${C().SPECIALTY_AT} or more wildermon at one trade working your settlement, its citizens' included. The Settlement window (N) says "Specialty" beside the trade.`); },
    met: (g) => g.creatures.specialties().some((s) => s.n >= C().SPECIALTY_AT),
  },
];
