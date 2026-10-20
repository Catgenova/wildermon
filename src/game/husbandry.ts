import { tryGain } from './learn';
import type { ActionDef, Target } from './actions';
import {
  ageOf,
  BREED_REST,
  breedPlus,
  careWord,
  GESTATION,
  maxHealth,
  SEX_NAMES,
  SPECIES,
  type Creature,
} from './creatures';
import type { Game } from './game';
import { clockLeft } from './boons';
import { itemName, RARITIES, RARITY_ODDS } from './items';
import { workingQl } from './materials';
import {
  bestTier, breedOdds, CHANNELS, depthMul, inheritChance, lineIfCarried, MUTATION_ODDS, mutationTier, pct, TIERS, traitList, traitName, traitTier,
  TRAIT_SLOTS, upgradeChance,
} from './traits';

/** What one pairing teaches, whether or not it takes. */
export const BREED_GAIN = 0.9;

/**
 * Animal husbandry: the brush, and the breeding of a herd.
 *
 * Two things sit under the skill. **Brushing** a wildermon down with a brush
 * puts care into it, and a beast that is cared for works quicker, learns
 * faster and throws better young. **Pairing** a male and a female of one
 * species puts a young one on the way, and what it is born carrying is decided
 * at that moment by the blood of the two of them, the keeper's skill, and how
 * well the pair have been kept.
 */

export const HUSBANDRY = 'animal_husbandry';

type CreatureTarget = Extract<Target, { kind: 'creature' }>;
const isCreature = (t: Target): t is CreatureTarget => t.kind === 'creature';
const creatureOf = (g: Game, t: Target): Creature | undefined => (isCreature(t) ? g.creatures.get(t.id) : undefined);
const nearPlayer = (g: Game, c: Creature, within = 1.9): boolean => Math.hypot(c.x - g.player.x, c.y - g.player.y) <= within;
/** Yours, and standing in the world rather than put away at the token. */
const outWithYou = (c: Creature): boolean => c.mode === 'active' || c.mode === 'deed';

/** How far apart a pair may stand and still be put together. */
export const PAIR_RANGE = 4;
/** Care will not be brushed past this in one go; it takes a while to get one up. */
export const GROOM_CAP = 1;

/**
 * What one brushing is worth. A poor brush in an unpractised hand puts a
 * little in; a good brush and a hundred in the skill puts most of a full
 * grooming in at once.
 */
export const groomGain = (skill: number, ql: number): number => 0.18 + (skill / 100) * 0.34 + (Math.min(100, ql) / 100) * 0.22;

/** How much of its health a brushing sees to. */
export const GROOM_HEAL = 0.06;

/** The odds a pairing takes. */
export const breedChance = (skill: number, care: number): number =>
  Math.min(0.97, 0.35 + (Math.max(0, Math.min(100, skill)) / 100) * 0.5 + Math.max(0, Math.min(1, care)) * 0.15);

/**
 * The mate standing nearest this one: same species, the other sex, tamed,
 * grown, fed, and rested since its last covering.
 */
export function mateFor(g: Game, c: Creature): Creature | undefined {
  let best: Creature | undefined;
  let bestD = Infinity;
  for (const o of g.creatures.list.values()) {
    if (o.id === c.id || o.species !== c.species || o.sex === c.sex) continue;
    if (!outWithYou(o) || o.due > 0) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d > PAIR_RANGE || d >= bestD) continue;
    best = o;
    bestD = d;
  }
  return best;
}

/** Why these two will not be put together, or null. */
export function pairRefuses(g: Game, a: Creature, b: Creature): string | null {
  for (const c of [a, b]) {
    if (ageOf(c, g.time) !== 'grown') {
      return ageOf(c, g.time) === 'young' ? `${c.name} is not grown.` : `${c.name} is too old.`;
    }
    if (c.hunger < 0.5) return `${c.name} is too hungry: feed it first.`;
    if (g.time - c.bredAt < BREED_REST) return `${c.name} bred recently: ${clockLeft(BREED_REST - (g.time - c.bredAt))} left.`;
    if (c.due > 0) return `${c.name} is already in young.`;
  }
  return null;
}

/** A chance as a whole percentage, as the island rounds it. */
const wholePct = (x: number): string => `${Math.round(x * 100)}%`;

/**
 * What a Herdsman's Stud Book says of one of yours and the mate it would be
 * put to: the odds the pairing takes, and for each of the young's traits the
 * odds it is drawn from their blood and comes out a tier better, at your
 * husbandry, their care and your perks. Nothing without the perk, for one that
 * is not yours or not out, or with no mate in reach. The island's `stud_book`.
 */
export function studBook(g: Game, c: Creature): string {
  if (g.perk('stud_book', 0) <= 0 || c.mine === false || !outWithYou(c)) return '';
  const mate = mateFor(g, c);
  if (!mate) return '';
  const skill = g.skills.get(HUSBANDRY);
  const care = (c.care + mate.care) / 2;
  const keep = Math.min(1, inheritChance(skill, care) + g.perk('breed:inherit', 0));
  const up = Math.min(1, upgradeChance(skill, care) + g.perk('breed:upgrade', 0));
  return ` Paired with ${mate.name}: success ${wholePct(breedChance(skill, care))}; each of ${TRAIT_SLOTS} traits `
    + `inherited ${wholePct(keep)}, tier-up ${wholePct(up)}.`;
}

/** A share as a percentage, to a whole one, or to the first figure that is not nought under one. */
const sharePct = (x: number): string => {
  const n = x * 100;
  return `${n >= 1 || n === 0 ? Math.round(n) : n >= 0.1 ? n.toFixed(1) : n.toFixed(2)}%`;
};

/** The share of everything born that comes into the world at each step of rarity, off `RARITY_ODDS` rolled in turn. */
export const rarityShares = (): number[] => RARITY_ODDS.map((_, i) =>
  RARITY_ODDS.slice(0, i + 1).reduce((p, o) => p * o, 1) * (i + 1 < RARITY_ODDS.length ? 1 - RARITY_ODDS[i + 1] : 1));

/**
 * What putting these two together would throw, in plain lines, asked before
 * the pairing is made. Asked for: "Before a pairing is confirmed, show for that
 * pair: each trait either parent carries, with the chance the foal inherits it;
 * the chance the foal comes out at each tier better than common, given the
 * pair's care and the breeder's skill; the chance of a mutation and what tier it
 * would be; the pedigree bonus the foal would start with."
 *
 * Every share is counted off the covering's own draw (`breedOdds`, which runs
 * `breedTraits`) at the husbandry, care and perks the covering would read
 * (`breedPlus`), so it cannot say anything the covering does not do. A trait
 * of theirs too good for your husbandry to read is counted and not named, as on
 * the card.
 */
export function breedPreview(g: Game, dam: Creature, sire: Creature): string {
  const skill = g.skills.get(HUSBANDRY);
  const care = (dam.care + sire.care) / 2;
  const { keepPlus, upPlus } = breedPlus(g);
  const odds = breedOdds(sire.traits, dam.traits, skill, care, keepPlus, upPlus);
  const readable = (id: string): boolean => g.holds('knowledge_reader') || skill >= 1 + TIER_LEVEL[traitTier(id)];
  const theirs = Object.keys(odds.carry).sort((a, b) => odds.carry[b] - odds.carry[a]);
  const hidden = theirs.filter((id) => !readable(id)).length;
  const lines = [
    `Pair ${sire.name} with ${dam.name} (animal husbandry ${Math.floor(skill)}, care ${wholePct(care)}):`,
    `Success: ${wholePct(breedChance(skill, care))}.`,
    `Each of ${TRAIT_SLOTS} traits: inherited ${wholePct(Math.min(1, inheritChance(skill, care) + keepPlus))}`
      + `, tier-up ${wholePct(Math.min(1, upgradeChance(skill, care) + upPlus))}.`,
    `Born carrying: ${theirs.filter(readable).map((id) => `${traitName(id)} ${sharePct(odds.carry[id])}`).join(', ') || 'none readable'}`
      + `${hidden ? `; ${hidden} more unreadable` : ''}.`,
    `Best trait tier: ${TIERS.map((t) => `${t} ${sharePct(odds.best[t])}`).join(', ')}.`,
    `Mutation: 1 in ${MUTATION_ODDS} (${sharePct(1 / MUTATION_ODDS)}): a ${mutationTier(sire.traits, dam.traits)} trait in neither parent, in its lowest slot.`,
  ];
  // How deep its line would run, on each channel either of them carries a trait on.
  const parents = [{ traits: dam.traits, line: dam.pedigree?.line }, { traits: sire.traits, line: sire.pedigree?.line }] as const;
  for (const ch of CHANNELS) {
    const d = lineIfCarried(parents[0], parents[1], ch.id);
    if (d > 1 && odds.on[ch.id] > 0) {
      lines.push(`Line (${ch.label}): ${d} generations, ${pct(depthMul(d, ch.id))} ${ch.label}, if it carries a ${ch.label} trait (${sharePct(odds.on[ch.id])}).`);
    }
  }
  const rare = rarityShares();
  lines.push(`Rarity, as any wildermon: ${rare.map((p, i) => `${RARITIES[i + 1].name} ${sharePct(p)}`).join(', ')}.`);
  return lines.join('\n');
}

export const HUSBANDRY_ACTIONS: ActionDef[] = [
  {
    id: 'groom',
    label: 'Brush it down',
    verb: 'brushing it down',
    skill: HUSBANDRY,
    stamina: 0.03,
    baseTime: 7,
    repeat: true,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild' && !SPECIES[c.species]?.monster;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (SPECIES[c.species]?.monster) return `${SPECIES[c.species].name}: cannot be brushed.`;
      if (!nearPlayer(g, c)) return `Stand next to ${c.name}.`;
      if (!g.inventory.has('brush')) return 'Need a brush.';
      if (c.care >= 0.995) return `${c.name}: care full.`;
      return null;
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      const brush = g.inventory.tool('brush');
      if (!c || !brush) return;
      const skill = g.skills.get(HUSBANDRY);
      // More of it at a go for a Herdsman's Brushwork.
      c.care = Math.min(GROOM_CAP, c.care + groomGain(skill, workingQl(brush.ql, brush.extra)) * g.perk('groom:care', 1));
      // A brushing is also a looking-over: it finds the small hurts and sees to them, more of them for Healing Hands.
      const top = maxHealth(c, SPECIES[c.species]);
      if (c.health < top) c.health = Math.min(top, c.health + top * g.perk('groom:heal', GROOM_HEAL));
      // Three uses' wear on the brush, as the island has it (`wear_tool`): it had been a flat
      // three hundredths here, where the island wore it by its quality, and a Mender's Tool Care
      // is read there.
      g.wearTool('brush', 3);
      g.gainSkill(HUSBANDRY, 0.4);
      g.note('groom');
      if (c.care >= 0.995) g.note('groomfull');
      g.logMsg(`Brushed ${c.name}: ${careWord(c.care)}.`, 'event');
      g.events.emit('creature');
    },
  },
  {
    id: 'pair_creature',
    label: 'Put it to a mate',
    verb: 'putting them together',
    skill: HUSBANDRY,
    stamina: 0.04,
    baseTime: 9,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && outWithYou(c) && c.due === 0;
    },
    labelFor: (t, g) => {
      const c = creatureOf(g, t);
      const mate = c && mateFor(g, c);
      return mate ? `Put it to ${mate.name}` : 'Put it to a mate';
    },
    // What it would throw, before it is done (`breedPreview`); nothing where it would be refused, which says why instead.
    confirms: (t, g) => {
      const c = creatureOf(g, t);
      const mate = c && mateFor(g, c);
      if (!c || !mate || !g.deed || c.due > 0 || pairRefuses(g, c, mate)) return null;
      const dam = c.sex === 'female' ? c : mate;
      return `${breedPreview(g, dam, dam === c ? mate : c)}\nPair them?`;
    },
    check: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return 'Gone.';
      if (!g.deed) return 'Need a settlement: the young go to its token.';
      if (!nearPlayer(g, c, 2.4)) return `Stand next to ${c.name}.`;
      if (c.due > 0) return `${c.name} is already in young.`;
      const mate = mateFor(g, c);
      if (!mate) {
        const def = SPECIES[c.species];
        return `No ${def.name.toLowerCase()} of the other sex within ${PAIR_RANGE} tiles. ${c.name} is ${SEX_NAMES[c.sex]}.`;
      }
      return pairRefuses(g, c, mate);
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const mate = mateFor(g, c);
      if (!mate || pairRefuses(g, c, mate)) return;
      const dam = c.sex === 'female' ? c : mate;
      const sire = dam === c ? mate : c;
      const skill = g.skills.get(HUSBANDRY);
      const care = (dam.care + sire.care) / 2;
      const took = g.rand() < breedChance(skill, care);
      g.gainSkill(HUSBANDRY, tryGain(took, BREED_GAIN));
      if (!took) {
        // A failed pairing costs both of them a rest, but only half of one: half a shorter one for Short Rest.
        dam.bredAt = g.time - BREED_REST * (1 - g.perk('breed:rest', 1) / 2);
        sire.bredAt = dam.bredAt;
        g.logMsg(`Pairing failed: ${dam.name} and ${sire.name}.`, 'error');
        return;
      }
      // The sex a Herdsman with Choose the Sex asked for, and even odds without it.
      const sex = g.perk('breed:sex', 0) > 0 && isCreature(t) && (t.sex === 'male' || t.sex === 'female') ? t.sex : undefined;
      g.creatures.pair(g, dam, sire, skill, sex);
      g.note('paired');
      g.logMsg(
        `Paired: ${sire.name} with ${dam.name}. Due in ${clockLeft(GESTATION * g.perk('breed:gestation', 1))}. Traits between them: ${traitList([...new Set([...sire.traits, ...dam.traits])])}.`,
        'event',
      );
      g.events.emit('creature');
    },
  },
  {
    id: 'read_blood',
    label: 'Look it over',
    verb: 'looking it over',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      const c = creatureOf(g, t);
      return !!c && c.mode !== 'wild';
    },
    perform: (t, g) => {
      const c = creatureOf(g, t);
      if (!c) return;
      const def = SPECIES[c.species];
      const skill = g.skills.get(HUSBANDRY);
      // Blood does not read itself. Without the skill you can see that there is
      // something in it; with the skill you can see what.
      const seen = c.traits.filter((id) => g.holds('knowledge_reader') || skill >= 1 + TIER_LEVEL[traitTier(id)]);
      const hidden = c.traits.length - seen.length;
      const carrying = c.due > 0 ? ` In young, due in ${clockLeft(c.due - g.time)}.` : '';
      g.logMsg(
        `${c.name}, ${SEX_NAMES[c.sex]} ${def.name.toLowerCase()}, ${ageOf(c, g.time)}, ${careWord(c.care)}. Traits: ${seen.length ? traitList(seen) : 'none readable'}${hidden ? `, ${hidden} unreadable` : ''}.${carrying}`,
        'event',
      );
    },
  },
];

/**
 * The husbandry it takes to read a trait off an animal. Anyone can see that
 * something is quick on its feet; it takes a breeder to know old blood when
 * it is standing in front of them.
 */
export const TIER_LEVEL = { common: 0, rare: 15, supreme: 35, fantastic: 60 } as const;

/** What a herd is worth at a glance, for the journal and the panel. */
export const herdBest = (g: Game): string => {
  let best = 'common';
  for (const c of g.creatures.yours()) {
    const t = bestTier(c.traits);
    if (['common', 'rare', 'supreme', 'fantastic'].indexOf(t) > ['common', 'rare', 'supreme', 'fantastic'].indexOf(best)) best = t;
  }
  return best;
};

/** The brush in hand, named, for a message. */
export const brushName = (g: Game): string => {
  const b = g.inventory.find('brush');
  return b ? itemName(b).toLowerCase() : 'brush';
};
